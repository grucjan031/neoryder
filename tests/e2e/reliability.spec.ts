import { expect, test as base, type Page } from '@playwright/test';
import { LOAD_TIMEOUT } from './helpers';

const test = base.extend({
  // W tym środowisku wspólny Chromium potrafi zatrzymać ładowanie bundla
  // w kolejnych kontekstach, jeszcze przed startem gry. Izolujemy proces,
  // zachowując opcje projektu i artefakty Playwright oraz jeden kontekst dla F5.
  context: async ({ playwright, browserName }, use) => {
    const browser = await playwright[browserName].launch();
    try {
      const context = await browser.newContext();
      try {
        await use(context);
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  },
});

// CI (GitHub runner) ładuje pokój wolniej niż lokalnie: limity jak w innych spec.
test.describe.configure({ timeout: 180_000 });
const query = (page: Page, name: string) =>
  page.evaluate((key) => window.__neoryder?.query(key), name);
const command = (page: Page, line: string) =>
  page.evaluate((value) => window.__neoryder?.command(value), line);

async function enterRoom(page: Page, mode = '') {
  await page.goto(
    `/?scene=run&seed=reliability&debug=1&fx=lite${mode ? `&mode=${mode}` : ''}`,
    { waitUntil: 'commit', timeout: 15_000 },
  );
  if (!mode) {
    await expect
      .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
      .toBe('map');
    await page.locator('.run-screen [data-node-id]').first().click();
  }
  await expect
    .poll(() => query(page, 'loading'), { timeout: LOAD_TIMEOUT })
    .toBe(false);
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('room');
}

test('walka: hidden przez 5 s nie zmienia zdrowia; powrót pozwala wznowić', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enterRoom(page, 'heist');
  await expect
    .poll(() => query(page, 'enemies'), { timeout: 10_000 })
    .toBeGreaterThan(0);
  await page.getByLabel('Scena NEORYDER', { exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement !== null), {
      timeout: 5000,
    })
    .toBe(true);
  const before = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    return {
      tick: window.__neoryder?.tick(),
      hp: window.__neoryder?.query('playerHp'),
    };
  });
  expect(before.hp).toBeDefined();
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await query(page, 'playerHp')).toEqual(before.hp);
  expect(await page.evaluate(() => window.__neoryder?.tick())).toBe(
    before.tick,
  );
  await page.locator('.pause-menu button').first().click();
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.tick()), {
      timeout: 5000,
    })
    .toBeGreaterThan(before.tick!);
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement !== null), {
      timeout: 5000,
    })
    .toBe(true);
  expect(errors).toEqual([]);
});

test('pauza 5 s zatrzymuje timer Kradzieży rdzenia', async ({ page }) => {
  await enterRoom(page, 'heist');
  await page.keyboard.press('KeyW');
  await expect
    .poll(() => query(page, 'audioState'), { timeout: 5000 })
    .toBe('running');
  await expect
    .poll(
      async () =>
        ((await query(page, 'heist')) as { elapsedS: number }).elapsedS,
      { timeout: 5000 },
    )
    .toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.pause-menu')).toBeVisible();
  await expect
    .poll(() => query(page, 'audioState'), { timeout: 5000 })
    .toBe('suspended');
  const before = await query(page, 'heist');
  await page.waitForTimeout(5000);
  expect(await query(page, 'heist')).toEqual(before);
});

for (const damaged of [false, true]) {
  test(`start z ${damaged ? 'uszkodzonym' : 'przyszłym'} zapisem pokazuje komunikat`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?debug=1&fx=lite', {
      waitUntil: 'commit',
      timeout: 15_000,
    });
    await page.evaluate(async (damaged) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('neoryder', 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('saves');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(
            damaged ? '{broken' : { saveVersion: Number.MAX_SAFE_INTEGER },
            'meta',
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
      });
    }, damaged);
    await page.goto('/?scene=run&debug=1&fx=lite', {
      waitUntil: 'commit',
      timeout: 15_000,
    });
    await expect
      .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
      .toBe('map');
    await expect(page.locator('#save-warning')).toContainText(
      damaged ? 'Nie można odczytać' : 'nowszej wersji',
    );
    await expect(page.locator('#save-warning')).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('save-warning.png') });
  });
}

test('F5 w runie zachowuje zapisane kredyty i implanty', async ({ page }) => {
  await enterRoom(page);
  await command(page, 'credits 123');
  await command(page, 'run clear');
  await expect
    .poll(() => query(page, 'screen'), { timeout: 10_000 })
    .toBe('reward');
  await page.locator('.run-screen button').first().click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: 10_000 })
    .toBe('map');
  await expect
    .poll(() => query(page, 'savePending'), { timeout: 5000 })
    .toBe(false);
  const before = (await query(page, 'runState')) as {
    credits: number;
    implants: string[];
  };
  expect(before.credits).toBeGreaterThan(0);
  expect(before.implants).toHaveLength(1);
  await page.reload({ waitUntil: 'commit', timeout: 15_000 });
  await expect
    .poll(() => query(page, 'screen'), { timeout: 20_000 })
    .toBe('map');
  expect(await query(page, 'runState')).toMatchObject({
    credits: before.credits,
    implants: before.implants,
  });
});
