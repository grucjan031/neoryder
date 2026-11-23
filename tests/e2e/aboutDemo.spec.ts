import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { LOAD_TIMEOUT } from './helpers';

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string };

async function openPause(
  page: Page,
  url = '/?scene=room-test&debug=1&seed=demo-report&fx=lite',
): Promise<void> {
  await page.goto(url);
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.tick() ?? 0), {
      timeout: LOAD_TIMEOUT,
    })
    .toBeGreaterThan(0);
  if (url.includes('scene=arena')) {
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.query('state')), {
        timeout: LOAD_TIMEOUT,
      })
      .toBe('select');
    await page.getByRole('button', { name: 'Ostrze', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.query('state')))
      .toBe('playing');
  }
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Pauza', exact: true }),
  ).toBeVisible();
}

test('wersja menu jest zgodna z package.json', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.main-menu__version')).toHaveText(
    new RegExp(`^v${version.replaceAll('.', '\\.')} · (?:[0-9a-f]+|dev)$`),
  );
});

test('pauza pokazuje wersję i seed; Esc zamyka tylko sterowanie', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openPause(page);
  const pause = page.getByRole('dialog', { name: 'Pauza', exact: true });
  await expect(pause.locator('.pause-menu__version')).toContainText(
    /v0\.9\.0 · \S+/,
  );
  await expect(pause.locator('.pause-menu__version')).toContainText(
    'Seed: demo-report',
  );
  const tick = await page.evaluate(() => window.__neoryder!.tick());
  await pause.getByRole('button', { name: 'Ustawienia', exact: true }).click();
  const settings = page.getByRole('dialog', {
    name: 'Ustawienia',
    exact: true,
  });
  await settings.getByRole('tab', { name: 'Sterowanie: klawiatura' }).click();
  await settings.locator('[data-action="dash"]').click();
  await page.keyboard.press('KeyV');
  await settings.getByRole('button', { name: 'Wróć', exact: true }).click();
  const trigger = pause.getByRole('button', {
    name: 'Sterowanie i zapis',
    exact: true,
  });
  await trigger.click();
  const about = page.getByRole('dialog', {
    name: 'Sterowanie i zapis',
    exact: true,
  });
  await expect(about).toBeVisible();
  await expect(about).toContainText('Ruch do przodu');
  await expect(
    about.locator('dt', { hasText: 'Doskok' }).locator('+ dd'),
  ).toHaveText('V');
  await expect(about).toContainText(
    'Wyczyszczenie danych przeglądarki usuwa zapis',
  );
  await page.keyboard.press('Escape');
  await expect(about).not.toBeVisible();
  await expect(pause).toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.__neoryder!.tick())).toBe(tick);
  expect(errors).toEqual([]);
});

test('zgłoszenie kopiuje raport i pokazuje potwierdzenie oraz adres', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openPause(page);
  await page
    .getByRole('button', { name: 'Zgłoś problem', exact: true })
    .click();
  const report = page.getByRole('dialog', {
    name: 'Zgłoś problem',
    exact: true,
  });
  await expect(report.getByRole('status')).toContainText(
    'Skopiowano dane techniczne',
  );
  await expect(report.getByRole('link')).toHaveAttribute(
    'href',
    'https://github.com/grucjan031/neoryder/issues',
  );
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(`Wersja: ${version}`);
  expect(copied).toContain('Seed: demo-report');
  expect(copied).toContain('Scena: room-test');
  expect(copied).toContain('Rozdzielczość okna: 1280 × 720');
  await page.keyboard.press('Escape');
  await expect(report).not.toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'Pauza', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Zgłoś problem', exact: true }),
  ).toBeFocused();
});

for (const seed of [undefined, 'demo-rc']) {
  test(`arena: seed ${seed ?? 'losowany'} jest zgodny z raportem`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: () => Promise.reject(new Error('clipboard denied')),
        },
      });
    });
    await openPause(
      page,
      `/?scene=arena&debug=1&fx=lite${seed ? `&seed=${seed}` : ''}`,
    );
    const pause = page.getByRole('dialog', { name: 'Pauza', exact: true });
    const info = pause.locator('.pause-menu__version');
    await expect(info).toContainText(/v0\.9\.0 · \S+/);
    const displayedSeed = (await info.innerText()).match(
      /Seed: (.*?) · Scena:/,
    )?.[1];
    expect(displayedSeed).toBeTruthy();
    expect(displayedSeed).not.toBe('brak');
    if (seed) expect(displayedSeed).toBe(seed);
    await expect(info).toContainText('Scena: arena');
    const trigger = pause.getByRole('button', {
      name: 'Zgłoś problem',
      exact: true,
    });
    expect(await trigger.isEnabled()).toBe(true);
    await trigger.click();
    const report = page.getByRole('dialog', {
      name: 'Zgłoś problem',
      exact: true,
    });
    const field = report.getByRole('textbox', {
      name: 'Dane techniczne zgłoszenia',
    });
    await expect(field).toBeVisible();
    expect((await field.inputValue()).split('\n')).toContain(
      `Seed: ${displayedSeed}`,
    );
    await report.getByRole('button', { name: 'Wróć', exact: true }).click();
    await expect(report).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
}

test('odmowa schowka udostępnia zaznaczony raport do ręcznego kopiowania', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('clipboard denied')) },
    });
  });
  await openPause(page);
  await page
    .getByRole('button', { name: 'Zgłoś problem', exact: true })
    .click();
  const report = page.getByRole('dialog', {
    name: 'Zgłoś problem',
    exact: true,
  });
  await expect(report.getByRole('status')).toContainText(
    'Nie można skopiować automatycznie',
  );
  const field = report.getByRole('textbox', {
    name: 'Dane techniczne zgłoszenia',
  });
  await expect(field).toHaveValue(/Seed: demo-report/);
  await expect(field).toBeFocused();
  expect(
    await field.evaluate(
      (node: HTMLTextAreaElement) =>
        node.selectionStart === 0 && node.selectionEnd === node.value.length,
    ),
  ).toBe(true);
});
