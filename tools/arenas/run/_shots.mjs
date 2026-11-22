// Zrzuty ekranu aren runu (kontrola wizualna). Uruchom serwer: npx vite --port 5192 --strictPort
//   node tools/arenas/run/_shots.mjs <katalog-wyjściowy> <id> [<id>...]
// Widoki bierze z eksportu `shots` generatora: { name, x, z, yaw, pitch, floorY }.
// yaw w stopniach: 0 = patrz na północ (−Z), 90 = zachód, 180 = południe, 270 = wschód.
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const [output, ...ids] = process.argv.slice(2);
const base = process.env.SHOT_BASE ?? 'http://localhost:5192';
await mkdir(resolve(output), { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
  ],
});
try {
  for (const id of ids) {
    const { shots } = await import(
      pathToFileURL(resolve(here, `${id}.mjs`)).href
    );
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${base}/?scene=room-test&room=${id}&debug=1&seed=shots`);
    await page.waitForFunction(() => window.__neoryder?.tick() > 30, null, {
      timeout: 420_000,
    });
    const run = (line) =>
      page.evaluate((l) => window.__neoryder.command(l), line);
    await run('god on').catch(() => {});
    await run('run clear');
    for (const s of shots) {
      await run(
        `tp ${s.x} ${s.z} ${s.yaw ?? 0} ${s.pitch ?? 0} ${s.floorY ?? 0}`,
      );
      const start = await page.evaluate(() => window.__neoryder.tick());
      await page.waitForFunction(
        (t) => window.__neoryder.tick() > t,
        start + 40,
        {
          timeout: 120_000,
        },
      );
      await page.screenshot({ path: resolve(output, `${id}-${s.name}.png`), timeout: 180_000 });
      console.log(`${id}-${s.name}.png`);
    }
    if (errors.length)
      console.log(`  błędy konsoli (${id}):`, errors.slice(0, 5));
    await page.close();
  }
} finally {
  await browser.close();
}
