import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { LOAD_TIMEOUT, waitSimSteps } from './helpers';

// Panel debug lil-gui (dev) zasłania prawy dolny róg; ekrany stacji mają tam przyciski.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.lil-gui { display: none !important; }';
      document.head.append(style);
    });
  });
});

const command = (page: Page, line: string) =>
  page.evaluate((text) => window.__neoryder?.command(text), line);

/** Liczba nieprzezroczystych pikseli canvasa podglądu (tło WebGL jest przezroczyste). */
const paintedPixels = (canvas: Locator): Promise<number> =>
  canvas.evaluate((node) => {
    const source = node as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const ctx = copy.getContext('2d');
    if (!ctx) return 0;
    ctx.drawImage(source, 0, 0);
    const { data } = ctx.getImageData(0, 0, copy.width, copy.height);
    let count = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) count += 1;
    return count;
  });

test('warsztat: podgląd 3D broni z modułem, zmiana slotu zmienia podgląd', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('hub');
  await waitSimSteps(page, 5);
  await command(page, 'meta unlock all');
  await command(page, 'hub open workshop');
  await expect(page.locator('.hub-screen .workshop')).toBeVisible();

  const preview = page.getByTestId('weapon-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('data-weapon', 'blaster');
  await expect(preview).toHaveAttribute('data-modules', '');
  const canvas = preview.locator('canvas');
  await expect.poll(() => paintedPixels(canvas)).toBeGreaterThan(500);

  // Gniazda dodatków edytuje się w kategorii Wyposażenie.
  await page.locator('[data-action="tab"][data-tab="equipment"]').click();
  const select = page.locator('select[data-weapon="blaster"][data-slot="0"]');
  await select.selectOption('pierce');
  await expect(preview).toHaveAttribute('data-modules', /pierce/);
  await expect.poll(() => paintedPixels(canvas)).toBeGreaterThan(500);

  // Przeciągnięcie obraca model (klatka się zmienia).
  const before = await canvas.evaluate((node) =>
    (node as HTMLCanvasElement).toDataURL(),
  );
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  await expect
    .poll(() =>
      canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL()),
    )
    .not.toBe(before);
  expect(errors).toEqual([]);
});
