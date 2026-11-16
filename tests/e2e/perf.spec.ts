import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT } from './helpers';

test('perf: arena pod obciążeniem', async ({ page }, testInfo) => {
  const quality = process.env.PERF_QUALITY ?? 'high';
  if (!['low', 'medium', 'high'].includes(quality))
    throw new Error(`Nieprawidłowe PERF_QUALITY: ${quality}`);
  await page.addInitScript((quality) => {
    localStorage.setItem('neoryder.settings', JSON.stringify({ quality }));
  }, quality);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=arena&debug=1&seed=perf-e2e&loadout=classic');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('arena');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('phase')), {
      timeout: SIM_TIMEOUT,
    })
    .toBe('fighting');

  const setup = await page.evaluate(() => {
    const debug = window.__neoryder!;
    const god = debug.command('god');
    const missing = Math.max(0, 20 - Number(debug.query('enemies')));
    const assaulters = Math.ceil(missing / 2);
    const gunners = missing - assaulters;
    const commands = [];
    if (assaulters > 0)
      commands.push(debug.command(`spawn assaulter ${assaulters}`));
    if (gunners > 0) commands.push(debug.command(`spawn gunner ${gunners}`));
    return { god, commands, enemies: debug.query('enemies') };
  });
  expect(setup.god).toBe('Nieśmiertelność: włączona');
  expect(setup.enemies).toBeGreaterThanOrEqual(15);

  const report = await page.evaluate(async () => {
    const debug = window.__neoryder!;
    const canvas = document.querySelector<HTMLCanvasElement>('#app canvas');
    const gl = canvas?.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    const rendererInfo =
      gl && extension
        ? {
            vendor: String(gl.getParameter(extension.UNMASKED_VENDOR_WEBGL)),
            renderer: String(
              gl.getParameter(extension.UNMASKED_RENDERER_WEBGL),
            ),
          }
        : null;
    const objects = () => {
      const count = (name: string): number => {
        const value = debug.query(name);
        if (
          typeof value !== 'number' ||
          !Number.isSafeInteger(value) ||
          value < 0
        )
          throw new Error(`Nieprawidłowy licznik ${name}: ${String(value)}`);
        return value;
      };
      return {
        enemies: count('enemies'),
        debris: count('debris'),
        bodies: count('bodies'),
      };
    };
    const measure = (durationMs: number, shatter = false) => {
      const before = objects();
      const tickBefore = debug.tick();
      // Start przed komendą obejmuje również koszt początku rozpadu.
      const start = performance.now();
      if (shatter) debug.command('kill all');
      const afterCommand = objects();
      let previous = start;
      const frameTimes: number[] = [];
      return new Promise<{
        requestedDurationMs: number;
        elapsedMs: number;
        frames: number;
        fps: number;
        meanFrameMs: number;
        p95FrameMs: number;
        maxFrameMs: number;
        before: ReturnType<typeof objects>;
        afterCommand: ReturnType<typeof objects>;
        after: ReturnType<typeof objects>;
        tickBefore: number;
        tickAfter: number;
      }>((resolve) => {
        const frame = () => {
          const now = performance.now();
          frameTimes.push(now - previous);
          previous = now;
          const elapsedMs = now - start;
          if (elapsedMs < durationMs) {
            requestAnimationFrame(frame);
            return;
          }
          const sorted = [...frameTimes].sort((a, b) => a - b);
          resolve({
            requestedDurationMs: durationMs,
            elapsedMs,
            frames: frameTimes.length,
            fps: (frameTimes.length * 1000) / elapsedMs,
            meanFrameMs: elapsedMs / frameTimes.length,
            p95FrameMs: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
            maxFrameMs: sorted[sorted.length - 1]!,
            before,
            afterCommand,
            after: objects(),
            tickBefore,
            tickAfter: debug.tick(),
          });
        };
        requestAnimationFrame(frame);
      });
    };

    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    const combat = await measure(5000);
    // Bez rozgrzewki ani oczekiwania na kroki symulacji po zabiciu wrogów.
    const shatter = await measure(3000, true);
    return {
      date: new Date().toISOString(),
      userAgent: navigator.userAgent,
      rendererInfo,
      enemyCount: combat.before.enemies,
      debrisCount: shatter.afterCommand.debris,
      measurements: { combat, shatter },
    };
  });

  const json = JSON.stringify({ ...report, quality }, null, 2) + '\n';
  await mkdir('perf-report', { recursive: true });
  await writeFile('perf-report/arena.json', json, 'utf8');
  await testInfo.attach('arena-perf', {
    body: json,
    contentType: 'application/json',
  });
  console.log(
    `perf: arena — walka ${report.measurements.combat.fps.toFixed(2)} FPS; rozpad ${report.measurements.shatter.fps.toFixed(2)} FPS`,
  );

  expect(report.enemyCount).toBeGreaterThanOrEqual(15);
  expect(report.debrisCount).toBeGreaterThan(0);
  expect(report.measurements.shatter.afterCommand.enemies).toBe(0);
  for (const measurement of Object.values(report.measurements)) {
    expect(measurement.frames).toBeGreaterThan(0);
    expect(measurement.elapsedMs).toBeGreaterThanOrEqual(
      measurement.requestedDurationMs,
    );
    expect(measurement.tickAfter).toBeGreaterThan(measurement.tickBefore);
  }
  expect(errors).toEqual([]);
});
