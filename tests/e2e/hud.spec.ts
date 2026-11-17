import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT } from './helpers';

test('mobilny HUD misji rozdziela cel, fale, implanty i radio od mocy', async ({
  page,
}) => {
  test.setTimeout(6 * LOAD_TIMEOUT);
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.lil-gui { display: none !important; }';
      document.head.append(style);
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    '/?scene=run&mission=m01-maszty&seed=hud-maszty&debug=1&fx=lite',
  );
  const screen = () => page.evaluate(() => window.__neoryder?.query('screen'));
  for (let layer = 1; layer <= 3; layer++) {
    await expect.poll(screen, { timeout: LOAD_TIMEOUT }).toBe('map');
    await page.evaluate((layer) => {
      const game = window.__neoryder!;
      const state = game.query('runState') as {
        map: { layers: { id: string }[][] };
      };
      game.command(`run node ${state.map.layers[layer - 1]![0]!.id}`);
    }, layer);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = window.__neoryder;
            if (!game || game.query('loading') !== false) return false;
            const current = game.query('screen');
            if (current === 'room') {
              game.command('god');
              return true;
            }
            return current === 'shop' || current === 'rest';
          }),
        { timeout: LOAD_TIMEOUT },
      )
      .toBe(true);
    if (layer === 1) {
      // Widoczność i pomiar w jednym evaluate: w fx=lite na wolnym runnerze kwestia radia
      // gaśnie szybciej niż kolejne zapytanie testu, więc w razie potrzeby wywołujemy ją ponownie.
      let radio: {
        bottom: number;
        powersTop: number;
        height: number;
        lineHeight: number;
      } | null = null;
      await expect
        .poll(
          async () =>
            (radio = await page.evaluate(() => {
              const node = document.querySelector<HTMLElement>(
                '.mission-radio--run',
              );
              const paragraph = node?.querySelector('p');
              if (!node || node.hidden || !paragraph) {
                window.__neoryder?.command('mission radio runStart');
                return null;
              }
              const powers = [
                ...document.querySelectorAll('.hud__power-list'),
              ].find((el) => el.getBoundingClientRect().height > 0)!;
              return {
                bottom: node.getBoundingClientRect().bottom,
                powersTop: powers.getBoundingClientRect().top,
                height: paragraph.getBoundingClientRect().height,
                lineHeight: parseFloat(getComputedStyle(paragraph).lineHeight),
              };
            })),
          { timeout: LOAD_TIMEOUT, intervals: [50] },
        )
        .not.toBeNull();
      radio = radio!;
      expect(radio.bottom).toBeLessThan(radio.powersTop);
      expect(radio.height).toBeLessThanOrEqual(2 * radio.lineHeight + 1);
    }
    if (layer === 3) break;
    const current = await screen();
    if (current === 'room') {
      await page.evaluate(() => window.__neoryder?.command('run clear'));
      await expect.poll(screen, { timeout: LOAD_TIMEOUT }).toBe('reward');
      await page.locator('.run-screen__card').first().click();
    } else if (current === 'rest')
      await page.locator('.run-screen__heal').click();
    else await page.getByRole('button', { name: 'Wyjdź', exact: true }).click();
  }
  await expect(page.locator('.hud__wave:visible')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  const layout = await page.evaluate(() => {
    const rect = (selector: string) =>
      [...document.querySelectorAll(selector)]
        .map((el) => el.getBoundingClientRect())
        .find((r) => r.height > 0)!;
    const goal = rect('.mission-goals');
    const wave = rect('.hud__wave');
    const implants = rect('.run-hud__implants');
    const caption = getComputedStyle(
      document.querySelector('.run-hud__implants')!,
      '::before',
    );
    return {
      top: goal.top,
      bottom: goal.bottom,
      waveBottom: wave.bottom,
      implantsTop: implants.top + parseFloat(caption.top),
    };
  });
  expect(layout.top).toBeGreaterThan(layout.waveBottom);
  expect(layout.bottom).toBeLessThan(layout.implantsTop);
});
