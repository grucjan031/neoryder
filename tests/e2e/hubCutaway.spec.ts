import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT, waitSimSteps } from './helpers';
const command = (p: Page, line: string) =>
  p.evaluate((l) => window.__neoryder?.command(l), line);
const query = (p: Page, name: string) =>
  p.evaluate((n) => window.__neoryder?.query(n), name);

type Point = [number, number, number];
interface Measurement {
  t: number;
  hand: Point;
  chin: Point;
  cat: Point;
  bowl: Point;
  bowlBase: Point;
  rest: Point;
  full: boolean;
  shot: { degrees: number; occlusions: number; position: Point; look: Point };
  ndc: Record<'head' | 'bowl' | 'cat' | 'hela', Point>;
}
const distance = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
async function expectBowlOnCounter(page: Page) {
  const d = (await query(page, 'cutawayDebug')) as Measurement;
  expect(distance(d.bowlBase, d.rest)).toBeLessThanOrEqual(0.05);
  // Górna powierzchnia metalowego blatu w hideout.json.
  expect(d.bowlBase[1]).toBeCloseTo(1.08, 4);
  expect(Math.abs(d.bowlBase[2] + 17.6) + 0.14).toBeLessThan(0.85 / 2);
  expect(d.full).toBe(true);
  console.log(
    'Miska na ladzie',
    d.bowlBase,
    'odchylenie',
    distance(d.bowlBase, d.rest),
  );
}
test.beforeEach(async ({ page }) => {
  await page.goto('/?scene=hub&debug=1&fx=lite&seed=ujecie');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('hub');
  await waitSimSteps(page, 5);
});
for (const kind of ['noodles', 'cat']) {
  test(
    kind + ' blokuje ruch, kończy się i oddaje sterowanie',
    async ({ page }) => {
      expect(await command(page, 'cutaway ' + kind)).toBe('true');
      await expect
        .poll(() => query(page, 'hubCutaway'))
        .toMatchObject({ active: true, kind });
      const start = await query(page, 'playerPos');
      await page.keyboard.down('KeyD');
      await waitSimSteps(page, 15);
      expect(await query(page, 'playerPos')).toEqual(start);
      const sample = await page.waitForFunction(
        () => {
          const d = window.__neoryder?.query('cutawayDebug') as Measurement;
          return d?.t >= 0.49 && d;
        },
        null,
        { timeout: 90000 },
      );
      const d = await sample.jsonValue();
      if (!d) throw new Error('Brak pomiaru w połowie ujęcia');
      expect(d.t).toBeLessThan(0.58);
      const noodles = kind === 'noodles';
      const contact = distance(d.hand, noodles ? d.chin : d.cat);
      console.log(
        kind,
        JSON.stringify({
          t: d.t,
          shot: d.shot,
          ndc: d.ndc,
          contact,
          bowlHand: noodles ? distance(d.bowl, d.hand) : undefined,
        }),
      );
      expect(contact).toBeLessThanOrEqual(0.12);
      if (noodles) expect(distance(d.bowl, d.hand)).toBeLessThanOrEqual(0.1);
      expect(d.shot.occlusions).toBe(0);
      expect(distance(d.shot.position, d.shot.look)).toBeCloseTo(
        noodles ? 1.9 : 1.6,
        4,
      );
      expect(d.shot.position[1]).toBeCloseTo(noodles ? 1.45 : 1.1, 2);
      for (const [x, y, z] of [d.ndc.head, noodles ? d.ndc.bowl : d.ndc.cat]) {
        expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(0.75);
        expect(z).toBeGreaterThan(-1);
        expect(z).toBeLessThan(1);
      }
      await expect
        .poll(() => query(page, 'hubCutaway'), { timeout: 90000 })
        .toMatchObject({ active: false });
      if (noodles) await expectBowlOnCounter(page);
      await waitSimSteps(page, 12);
      await page.keyboard.up('KeyD');
      expect(await query(page, 'playerPos')).not.toEqual(start);
    },
  );
}
for (const key of ['skip', 'KeyE', 'Escape']) {
  test(key + ' skraca ujęcie do powrotu kamery', async ({ page }) => {
    await command(page, key === 'skip' ? 'cutaway noodles' : 'cutaway cat');
    await waitSimSteps(page, key === 'skip' ? 200 : 5);
    if (key === 'skip') await command(page, 'cutaway skip');
    else await page.keyboard.press(key);
    await waitSimSteps(page, 40);
    expect(await query(page, 'hubCutaway')).toMatchObject({ active: false });
    if (key === 'skip') await expectBowlOnCounter(page);
    await expect(page.locator('dialog.pause-menu')).toBeHidden();
  });
}
