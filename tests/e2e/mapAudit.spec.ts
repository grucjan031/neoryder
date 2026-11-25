import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT } from './helpers';

for (const id of ['puzzlePlate', 'arena', 'm10-archiwum', 'hideout']) {
  test(`audyt wczytuje ${id} i rysuje widok z góry`, async ({ page }) => {
    await page.goto(`/?scene=map-audit&map=${id}&debug=1&fx=lite`);
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.query('auditMap')), {
        timeout: LOAD_TIMEOUT,
      })
      .toBe(id);
    expect(
      await page.evaluate(() => window.__neoryder!.query('auditViews')),
    ).toContain('spawn');
    expect(
      await page.evaluate(() => window.__neoryder!.command('audit view top')),
    ).toBe('top');
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.query('auditView')), {
        timeout: LOAD_TIMEOUT,
      })
      .toBe('top');
    await expect(page.locator('#app > canvas')).toBeVisible();
    await expect(page.locator('.hint')).toBeHidden();
  });
}
