// Przegląd widoków areny: liczba wywołań rysowania i trójkątów (renderer.info z całej klatki) w 4 kierunkach
// z każdego punktu przejęcia i ze startu. Najgorszy widok sprawdza budżet ADR 0011 D8 (≤ 800 wywołań, medium).
// Użycie: node tools/perf/viewSweep.mjs <idPokoju> [--url http://127.0.0.1:5173] [--quality medium] [--scene room-test|conquest] [--extra '&parametr=wartość']
// `conquest` mierzy scenę Przejęcia z wrogami (jak benchmark), `room-test` sam pokój.
// Wymaga działającego serwera z trybem debug (npm run dev albo vite preview z ?debug=1).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: 'string', default: 'http://127.0.0.1:5173' },
    quality: { type: 'string', default: 'medium' },
    scene: { type: 'string', default: 'room-test' },
    extra: { type: 'string', default: '' },
  },
});
const room = positionals[0] ?? 'arenaContainerPort';
const def = JSON.parse(
  await readFile(join(ROOT, `src/data/rooms/${room}.json`), 'utf8'),
);
const points = (def.arena?.points ?? []).map((p) => [
  p.position.x,
  p.position.z,
]);
points.push([def.playerSpawn.x, def.playerSpawn.z]);

const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await (
  await browser.newContext({ viewport: { width: 1920, height: 1080 } })
).newPage();
await page.addInitScript((quality) => {
  localStorage.setItem('neoryder.settings', JSON.stringify({ quality }));
}, values.quality);
const query =
  values.scene === 'conquest'
    ? `scene=conquest&arena=${room}`
    : `scene=room-test&room=${room}`;
await page.goto(
  `${values.url}/?${query}&loadout=classic&seed=bench&debug=1${values.extra}`,
);
await page.waitForFunction(
  () => {
    const game = window.__neoryder;
    return (
      !!game &&
      (game.sceneId() === 'room-test' ||
        (game.query('loading') === false && game.query('screen') === 'room'))
    );
  },
  undefined,
  {
    timeout: 90_000,
  },
);
await page.evaluate(() => window.__neoryder.command('god'));
const rows = [];
for (const [x, z] of points)
  for (const yaw of [0, 90, 180, 270]) {
    await page.evaluate(
      ([x, z, yaw]) => window.__neoryder.command(`tp ${x} ${z} ${yaw} 0`),
      [x, z, yaw],
    );
    await page.waitForTimeout(400);
    const info = await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              resolve({ ...window.__neoryder.query('renderInfo') }),
            ),
          ),
        ),
    );
    rows.push({ x, z, yaw, calls: info.calls, triangles: info.triangles });
  }
const worst = rows.reduce((a, b) => (b.calls > a.calls ? b : a));
const mean = (key) =>
  Math.round(rows.reduce((sum, row) => sum + row[key], 0) / rows.length);
console.log(
  `${room} (${values.quality}): ${rows.length} widoków, calls max ${worst.calls} (x=${worst.x} z=${worst.z} yaw=${worst.yaw}), średnio ${mean('calls')}; trójkąty max ${Math.max(...rows.map((r) => r.triangles))}, średnio ${mean('triangles')}`,
);
await browser.close();
