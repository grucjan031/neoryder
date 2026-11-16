import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://127.0.0.1:5173' },
    scene: { type: 'string', default: 'room-test' },
    room: { type: 'string', default: 'alleyMarket' },
    quality: { type: 'string', default: 'medium' },
    seconds: { type: 'string', default: '10' },
  },
});
const seconds = Number(values.seconds);
if (!Number.isFinite(seconds) || seconds <= 0)
  throw new Error('--seconds musi być dodatnią, skończoną liczbą.');
if (!['low', 'medium', 'high'].includes(values.quality))
  throw new Error('--quality: low, medium albo high.');
if (!/^[a-z0-9-]+$/i.test(values.scene))
  throw new Error('--scene może zawierać litery, cyfry i myślniki.');
const url = new URL(values.url);
if (!['http:', 'https:'].includes(url.protocol))
  throw new Error('--url musi być adresem HTTP(S) działającego serwera.');
url.searchParams.set('scene', values.scene);
url.searchParams.set('room', values.room);
url.searchParams.set('debug', '1');
if (!url.searchParams.has('seed'))
  url.searchParams.set('seed', 'frame-profile');
if (!url.searchParams.has('loadout')) url.searchParams.set('loadout', 'gunner');

const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript((quality) => {
    const raw = localStorage.getItem('neoryder.settings');
    let settings = {};
    try {
      settings = raw ? JSON.parse(raw) : {};
    } catch {
      // Uszkodzony zapis nie blokuje pomiaru w nowym kontekście.
    }
    localStorage.setItem(
      'neoryder.settings',
      JSON.stringify({ ...settings, quality }),
    );
  }, values.quality);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url.href);
  await page.waitForFunction(
    (scene) => window.__neoryder?.sceneId() === scene,
    values.scene,
    { timeout: 120_000 },
  );
  const god = await page.evaluate(() => window.__neoryder.command('god'));
  await page.waitForTimeout(3000);
  const report = await page.evaluate(async (durationMs) => {
    const debug = window.__neoryder;
    const gl = document.querySelector('#app canvas')?.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    const gpu =
      gl && extension
        ? {
            vendor: String(gl.getParameter(extension.UNMASKED_VENDOR_WEBGL)),
            renderer: String(
              gl.getParameter(extension.UNMASKED_RENDERER_WEBGL),
            ),
          }
        : null;
    debug.command('profile on');
    const start = performance.now();
    const tickBefore = debug.tick();
    let frames = 0;
    await new Promise((resolve) => {
      const frame = () => {
        frames++;
        if (performance.now() - start < durationMs)
          requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    const elapsedMs = performance.now() - start;
    // Kopia przed off: raport aplikacji jest współdzielonym buforem.
    const profile = structuredClone(debug.query('frameProfile'));
    debug.command('profile off');
    if (!profile || profile.totalFrames === 0)
      throw new Error('Profiler nie zwrócił żadnej klatki.');
    return {
      elapsedMs,
      frames,
      fps: (frames * 1000) / elapsedMs,
      tickBefore,
      tickAfter: debug.tick(),
      enemies: debug.query('enemies') ?? null,
      userAgent: navigator.userAgent,
      gpu,
      profile,
    };
  }, seconds * 1000);
  const output = fileURLToPath(new URL('../../perf-report/', import.meta.url));
  const path = join(output, `profile-${values.scene}-${values.quality}.json`);
  await mkdir(output, { recursive: true });
  await writeFile(
    path,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        url: url.href,
        scene: values.scene,
        room: values.room,
        quality: values.quality,
        requestedSeconds: seconds,
        viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
        god,
        errors,
        ...report,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.table(
    Object.entries(report.profile.stages).map(([stage, times]) => ({
      etap: stage,
      'CPU ms': Number(times.cpuMs.toFixed(3)),
      'GPU ms': times.gpuMs === null ? null : Number(times.gpuMs.toFixed(3)),
    })),
  );
  console.log(
    `FPS: ${report.fps.toFixed(2)}; okno: ${report.profile.frames} klatek; GPU: ${report.profile.gpuFrames} klatek`,
  );
  console.log('Liczniki (średnie na klatkę):', report.profile.counters);
  console.log(`Raport: ${path}`);
  if (errors.length) throw new Error(`Błędy strony: ${errors.join('; ')}`);
} finally {
  await browser.close();
}
