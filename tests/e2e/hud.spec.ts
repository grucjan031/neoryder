import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

test('mobilna Odlewnia: cel, kierunek i pasek bossa nie nachodzą na siebie, nazwa jest pełna', async ({
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
  const query = (key: string) =>
    page
      .evaluate((name) => window.__neoryder?.query(name), key)
      .catch(() => undefined);
  const command = (line: string) =>
    page.evaluate((text) => window.__neoryder?.command(text), line);
  const mission = async () =>
    ((await query('mission')) as
      | { activeEncounters: string[]; completedEncounters: string[] }
      | undefined) ?? { activeEncounters: [], completedEncounters: [] };
  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          if (game?.query('screen') !== 'map') return false;
          game.command('campaign complete m01-maszty');
          game.command('campaign complete m03-list-przewozowy');
          game.command('campaign complete m04-ladunek-klasy-k');
          game.command('campaign complete m05-adiutant');
          return true;
        }),
      { timeout: LOAD_TIMEOUT },
    )
    .toBe(true);
  await expect.poll(() => query('savePending')).toBe(false);
  await page.goto(
    '/?scene=mission&mission=m06-odlewnia&seed=hud-odlewnia&debug=1&fx=lite',
  );
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('playing');
  await command('god');
  for (const [id, x] of [
    ['patrol-sluza', 14],
    ['piece', 44],
    ['formowanie-front', 92],
    ['formowanie-tyl', 113],
    ['straz', 143],
  ] as const) {
    await command(`tp ${x} 0 -90`);
    await expect
      .poll(async () => (await mission()).activeEncounters, {
        timeout: SIM_TIMEOUT,
      })
      .toContain(id);
    await command('encounter clear');
    await expect
      .poll(async () => (await mission()).completedEncounters, {
        timeout: SIM_TIMEOUT,
      })
      .toContain(id);
  }
  await command('tp 167 0 -90');
  await waitSimSteps(page, 30);
  await command('tp 185 0 -90');
  await expect(page.locator('.run-hud__boss:visible')).toBeVisible({
    timeout: SIM_TIMEOUT,
  });
  await page.evaluate(() => document.fonts.ready);
  const layout = await page.evaluate(() => {
    const visible = (selector: string) =>
      [...document.querySelectorAll<HTMLElement>(selector)].find(
        (node) => node.getBoundingClientRect().height > 0,
      );
    const goal = visible('.mission-goals')!.getBoundingClientRect();
    const boss = visible('.run-hud__boss')!.getBoundingClientRect();
    const direction = visible('.mission-direction')?.getBoundingClientRect();
    const name = document.querySelector('.run-hud__boss-name')!;
    const range = document.createRange();
    range.selectNodeContents(name);
    return {
      goal: goal.toJSON(),
      boss: boss.toJSON(),
      direction: direction?.toJSON() ?? null,
      text: range.getBoundingClientRect().toJSON(),
      name: name.getBoundingClientRect().toJSON(),
      lines: range.getClientRects().length,
    };
  });
  const overlaps = (
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number },
  ) =>
    a.left < b.right &&
    b.left < a.right &&
    a.top < b.bottom &&
    b.top < a.bottom;
  expect(overlaps(layout.goal, layout.boss)).toBe(false);
  if (layout.direction)
    expect(overlaps(layout.direction, layout.boss)).toBe(false);
  for (const rect of [layout.goal, layout.boss]) {
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(390);
  }
  expect(layout.lines).toBe(1);
  expect(layout.text.left).toBeGreaterThanOrEqual(layout.name.left);
  expect(layout.text.right).toBeLessThanOrEqual(layout.name.right);
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
