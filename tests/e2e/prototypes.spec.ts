import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

/** S4-03: prototypy eskorty więźnia i wagonu; sprawdzane przez komendy i zapytania debug. */
interface Xz {
  x: number;
  z: number;
}
interface EscortState {
  state: string;
  position: Xz;
  stuckEvents: number;
}
interface PayloadState {
  status: string;
  holdRemainingS: number;
  position: Xz;
  progress: number;
}

const query = <T>(page: Page, name: string) =>
  page.evaluate((n) => window.__neoryder?.query(n), name) as Promise<T>;
const command = (page: Page, line: string) =>
  page.evaluate((l) => window.__neoryder?.command(l), line);

async function open(page: Page, scene: string, errors: string[]) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`/?scene=${scene}&debug=1&fx=lite`);
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe(scene);
}

test('escort-test: uwolnienie, marsz po nawigacji i ewakuacja więźnia', async ({
  page,
}) => {
  test.setTimeout(6 * SIM_TIMEOUT);
  const errors: string[] = [];
  await open(page, 'escort-test', errors);
  expect(await query<EscortState>(page, 'escort')).toMatchObject({
    state: 'waiting',
  });
  await command(page, 'god');
  await command(page, 'escort free');
  await expect
    .poll(async () => (await query<EscortState>(page, 'escort')).state)
    .toBe('following');
  // Gracz teleportuje się krok po kroku wzdłuż trasy nawigacji; więzień dogania go sam.
  for (let hop = 0; hop < 40; hop++) {
    const escort = await query<EscortState>(page, 'escort');
    if (escort.state === 'evacuated') break;
    expect(escort.state).not.toBe('dead');
    const path = await query<Xz[]>(page, 'escortPath');
    let along = 0;
    let target = path[path.length - 1]!;
    for (let i = 1; i < path.length; i++) {
      along += Math.hypot(
        path[i]!.x - path[i - 1]!.x,
        path[i]!.z - path[i - 1]!.z,
      );
      if (along >= 12) {
        target = path[i]!;
        break;
      }
    }
    await command(page, 'kill all');
    await command(page, `tp ${target.x} ${target.z}`);
    await expect
      .poll(
        async () => {
          const s = await query<EscortState>(page, 'escort');
          const p = await query<{ x: number; z: number }>(page, 'playerPos');
          return (
            s.state === 'evacuated' ||
            Math.hypot(s.position.x - p.x, s.position.z - p.z) < 5
          );
        },
        { timeout: SIM_TIMEOUT },
      )
      .toBe(true);
  }
  await expect
    .poll(async () => (await query<EscortState>(page, 'escort')).state, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('evacuated');
  await expect(page.locator('.proto-hud')).toContainText('sukces');
  expect(errors).toEqual([]);
});

test('escort-test: HP 0 oznacza porażkę', async ({ page }) => {
  const errors: string[] = [];
  await open(page, 'escort-test', errors);
  await command(page, 'escort hp 0');
  await waitSimSteps(page, 5);
  expect(await query<EscortState>(page, 'escort')).toMatchObject({
    state: 'dead',
  });
  await expect(page.locator('.proto-hud')).toContainText('porażka');
  expect(errors).toEqual([]);
});

test('payload-test: wagon jedzie z postojami do końca trasy', async ({
  page,
}) => {
  test.setTimeout(6 * SIM_TIMEOUT);
  const errors: string[] = [];
  await open(page, 'payload-test', errors);
  expect(await query<PayloadState>(page, 'payload')).toMatchObject({
    status: 'waitingPlayer',
  });
  await command(page, 'god');
  // Gracz przy wagonie: skład rusza sam.
  const wagon = (await query<PayloadState>(page, 'payload')).position;
  await command(page, `tp ${wagon.x + 4} ${wagon.z + 3}`);
  await expect
    .poll(async () => (await query<PayloadState>(page, 'payload')).progress, {
      timeout: SIM_TIMEOUT,
    })
    .toBeGreaterThan(0);
  // Na każdym postoju wzmocnienia giną, skład rusza dalej; ostatni odcinek przez skip.
  for (let stop = 0; stop < 3; stop++) {
    await command(page, 'payload skip');
    await expect
      .poll(async () => (await query<PayloadState>(page, 'payload')).status)
      .toBe('holding');
    await expect
      .poll(() => query<number>(page, 'enemies'), { timeout: SIM_TIMEOUT })
      .toBeGreaterThan(0);
    await expect
      .poll(
        async () => {
          await command(page, 'kill all');
          const s = await query<PayloadState>(page, 'payload');
          return s.status !== 'holding';
        },
        { timeout: SIM_TIMEOUT },
      )
      .toBe(true);
  }
  await command(page, 'payload skip');
  expect(await query<PayloadState>(page, 'payload')).toMatchObject({
    status: 'arrived',
    progress: 1,
  });
  await expect(page.locator('.proto-hud')).toContainText('sukces');
  expect(errors).toEqual([]);
});

test('payload-test: zniszczenie wagonu oznacza porażkę', async ({ page }) => {
  const errors: string[] = [];
  await open(page, 'payload-test', errors);
  await command(page, 'payload hp 0');
  await waitSimSteps(page, 5);
  expect(await query<PayloadState>(page, 'payload')).toMatchObject({
    status: 'destroyed',
  });
  await expect(page.locator('.proto-hud')).toContainText('porażka');
  expect(errors).toEqual([]);
});
