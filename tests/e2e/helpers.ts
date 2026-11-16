import type { Page } from '@playwright/test';

/** Limit dla warunków zależnych od symulacji: na wolnym GPU (CI, SwiftShader) gra zwalnia. */
export const SIM_TIMEOUT = 60_000;

/** Ładowanie pokoju z modelami .glb na SwiftShaderze może trwać ponad 30 s. */
export const LOAD_TIMEOUT = 90_000;

/**
 * Czeka, aż symulacja wykona `steps` kroków (SIM_DT = 1/60 s), zamiast czekać na czas ścienny.
 * Pętla ogranicza liczbę kroków na klatkę, więc na wolnej maszynie czas symulacji płynie wolniej.
 */
export async function waitSimSteps(page: Page, steps: number): Promise<void> {
  const start = await page.evaluate(() => window.__neoryder?.tick() ?? 0);
  await page.waitForFunction(
    (target) => (window.__neoryder?.tick() ?? 0) >= target,
    start + steps,
    { timeout: SIM_TIMEOUT },
  );
}
