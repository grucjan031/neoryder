import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT } from './helpers';

test('mobilna Odlewnia: cel, boss i implanty nie nachodzą na siebie, nazwa jest pełna', async ({
  page,
}) => {
  test.setTimeout(8 * LOAD_TIMEOUT);
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.lil-gui { display: none !important; }';
      document.head.append(style);
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          if (game?.query('screen') !== 'map') return false;
          game.command('campaign complete m01-maszty');
          game.command('campaign complete m03-list-przewozowy');
          return true;
        }),
      { timeout: LOAD_TIMEOUT },
    )
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('savePending')))
    .toBe(false);
  await page.goto(
    '/?scene=run&mission=m06-odlewnia&seed=hud-odlewnia&debug=1&fx=lite',
  );
  const screen = () => page.evaluate(() => window.__neoryder?.query('screen'));
  for (let layer = 1; layer <= 7; layer++) {
    await expect
      .poll(
        () =>
          page.evaluate((layer) => {
            const game = window.__neoryder;
            if (game?.query('screen') !== 'map') return false;
            if (layer === 1)
              for (const id of ['overclock', 'thermalFuse', 'nanoBloodstream'])
                game.command(`implant ${id}`);
            const state = game.query('runState') as {
              map: { layers: { id: string }[][] };
            };
            game.command(`run node ${state.map.layers[layer - 1]![0]!.id}`);
            return true;
          }, layer),
        { timeout: LOAD_TIMEOUT },
      )
      .toBe(true);
    await expect
      .poll(
        () =>
          page.evaluate((final) => {
            const game = window.__neoryder;
            if (!game || game.query('loading') !== false) return false;
            const screen = game.query('screen');
            if (screen === 'shop' || screen === 'rest') return true;
            if (screen !== 'room') return false;
            game.command('god');
            if (!final) game.command('run clear');
            else game.command('boss phase 2');
            return true;
          }, layer === 7),
        { timeout: LOAD_TIMEOUT },
      )
      .toBe(true);
    if (layer === 7) break;
    await expect
      .poll(screen, { timeout: LOAD_TIMEOUT })
      .toMatch(/^(reward|shop|rest)$/);
    const current = await screen();
    if (current === 'reward')
      await page.locator('.run-screen__card').first().click();
    else if (current === 'rest')
      await page.locator('.run-screen__heal').click();
    else await page.getByRole('button', { name: 'Wyjdź', exact: true }).click();
  }
  await expect(page.locator('.run-hud__boss:visible')).toBeVisible();
  expect(
    await page.locator('.run-hud__implant:visible').count(),
  ).toBeGreaterThanOrEqual(3);
  await page.evaluate(() => document.fonts.ready);
  const layout = await page.evaluate(() => {
    const rect = (selector: string) =>
      [...document.querySelectorAll<HTMLElement>(selector)]
        .find((node) => node.getBoundingClientRect().height > 0)!
        .getBoundingClientRect();
    const goal = rect('.mission-goals');
    const boss = rect('.run-hud__boss');
    const implants = rect('.run-hud__implants');
    const caption = getComputedStyle(
      document.querySelector('.run-hud__implants')!,
      '::before',
    );
    const name = document.querySelector('.run-hud__boss-name')!;
    const range = document.createRange();
    range.selectNodeContents(name);
    const text = range.getBoundingClientRect();
    return {
      goal: goal.toJSON(),
      boss: boss.toJSON(),
      implants: {
        ...implants.toJSON(),
        top: implants.top + parseFloat(caption.top),
      },
      text: text.toJSON(),
      name: name.getBoundingClientRect().toJSON(),
      lines: range.getClientRects().length,
    };
  });
  expect(layout.goal.bottom).toBeLessThan(layout.boss.top);
  expect(layout.boss.bottom).toBeLessThan(layout.implants.top);
  for (const rect of [layout.goal, layout.boss, layout.implants]) {
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(390);
  }
  expect(layout.lines).toBe(1);
  expect(layout.text.left).toBeGreaterThanOrEqual(layout.name.left);
  expect(layout.text.right).toBeLessThanOrEqual(layout.name.right);
  expect(layout.text.right).toBeLessThanOrEqual(390);
});

test('mobilny HUD misji liniowej rozdziela cel, kierunek i radio od mocy', async ({
  page,
}) => {
  test.setTimeout(4 * LOAD_TIMEOUT);
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.lil-gui { display: none !important; }';
      document.head.append(style);
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    '/?scene=mission&mission=m01-maszty&seed=hud-maszty&debug=1&fx=lite',
  );
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('screen')), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('playing');
  await page.evaluate(() => window.__neoryder?.command('god'));
  await expect
    .poll(
      () =>
        page.evaluate(() => {
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
        }),
      { timeout: LOAD_TIMEOUT, intervals: [50] },
    )
    .not.toBeNull();
  const layout = await page.evaluate(() => {
    const rect = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect();
    const goal = rect('.mission-goals');
    const direction = rect('[data-mission-direction]');
    const powers = rect('.hud__power-list');
    const radio = rect('.mission-radio--run');
    const paragraph = document.querySelector('.mission-radio--run p')!;
    return {
      goalTop: goal.top,
      goalBottom: goal.bottom,
      directionBottom: direction.bottom,
      radioBottom: radio.bottom,
      powersTop: powers.top,
      radioHeight: paragraph.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(paragraph).lineHeight),
    };
  });
  expect(layout.goalTop).toBeGreaterThan(layout.directionBottom);
  expect(layout.goalBottom).toBeLessThan(layout.powersTop);
  expect(layout.radioBottom).toBeLessThan(layout.powersTop);
  expect(layout.radioHeight).toBeLessThanOrEqual(2 * layout.lineHeight + 1);
  await expect(page.locator('.hud__wave')).toBeHidden();
  await expect(page.locator('.run-hud__credits')).toBeHidden();
  await expect(page.locator('.run-hud__implants')).toBeHidden();
});
