import { expect, test } from '@playwright/test';
import type { RunState } from '../../src/core/runTypes';
import { LOAD_TIMEOUT } from './helpers';

test('F5 w pokoju zachowuje kredyty, ale wymaga powtórzenia pokoju', async ({
  playwright,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const browser = await playwright.chromium.launch({
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
    ],
  });
  try {
    const page = await browser.newPage({ baseURL });
    const query = (key: string) =>
      page.evaluate((name) => window.__neoryder?.query(name), key);
    const command = (text: string) =>
      page.evaluate((value) => window.__neoryder?.command(value), text);
    await page.goto('/?scene=run&seed=test1&debug=1&fx=lite');
    await expect
      .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
      .toBe('map');
    await command('god');
    const before = (await query('runState')) as RunState;
    const node = before.map.layers[0]![0]!.id;
    await command(`run node ${node}`);
    // Pokój w SwiftShader na runnerze CI ładuje się dłużej niż domyślne 30 s.
    await expect
      .poll(() => query('loading'), { timeout: LOAD_TIMEOUT })
      .toBe(false);
    expect(await command('spawn drone 2')).toBe('Utworzono: 2');
    await command('kill all');
    await expect
      .poll(async () => ((await query('runState')) as RunState).credits)
      .toBeGreaterThan(before.credits);
    // Czekamy na opóźniony zapis kredytów przed rzeczywistym F5.
    const earned = ((await query('runState')) as RunState).credits;
    await page.waitForTimeout(3000);
    await expect.poll(() => query('savePending')).toBe(false);
    await page.reload();
    await expect
      .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
      .toBe('map');
    const restored = (await query('runState')) as RunState;
    expect(restored.credits).toBeGreaterThanOrEqual(earned);
    expect(restored.currentNodeId).toBe(before.currentNodeId);
    expect(restored.visited).not.toContain(node);
    await expect(page.locator(`[data-node-id="${node}"]`)).toBeEnabled();
    expect(await query('saveError')).toBeNull();
  } finally {
    await browser.close();
  }
});
