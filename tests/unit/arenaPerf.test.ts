/**
 * Budżet wydajności symulacji areny (F1 #16: „30 wrogów jednocześnie”).
 * Mierzy tylko symulację (AI, Rapier, pociski, obrażenia, odłamki) w node — render i GPU
 * sprawdza się ręcznie (docs/playtest-F1.md). Krok symulacji to 1/60 s, więc przy 60 FPS
 * na całą klatkę jest 16,7 ms; symulacji dajemy najwyżej 6 ms średnio na krok (zapas na wolne maszyny CI; lokalnie ~1 ms).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { Arena } from '../../src/scenes/arena';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import type { InputSnapshot } from '../../src/core/input';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};

const active: Arena[] = [];
afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
});

async function setup() {
  const scene = new Arena(false);
  const commands = new CommandRegistry();
  const t = structuredClone(tuning);
  await scene.init(
    {
      bus: new EventBus(),
      rng: new Rng('perf'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: t,
      debug: false,
      camera: new PerspectiveCamera(),
      commands,
    },
    new ThreeScene(),
  );
  active.push(scene);
  return { scene, commands };
}

describe('wydajność symulacji areny', () => {
  it('30 wrogów (Szturmowcy + Strzelcy) mieści się w budżecie 6 ms na krok', async () => {
    const { scene, commands } = await setup();
    commands.execute('god');
    commands.execute('spawn assaulter 20');
    commands.execute('spawn gunner 10');
    expect(scene.query('enemies')).toBe(30);
    // Rozgrzewka JIT i ustawienie się wrogów wokół gracza.
    for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
    const steps = 600; // 10 s symulacji
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) scene.step(SIM_DT, idle);
    const perStepMs = (performance.now() - t0) / steps;
    console.info(
      `[perf] arena 30 wrogów: ${perStepMs.toFixed(3)} ms / krok symulacji`,
    );
    expect(scene.query('enemies')).toBeGreaterThanOrEqual(30);
    expect(perStepMs).toBeLessThan(6);
  }, 60_000);

  it('30 wrogów z mieszanki fal F2 (wszystkie archetypy) mieści się w budżecie', async () => {
    const { scene, commands } = await setup();
    commands.execute('god');
    for (const [kind, n] of [
      ['assaulter', 8],
      ['gunner', 6],
      ['drone', 6],
      ['sniper', 4],
      ['shielder', 4],
      ['executor', 2],
    ] as const)
      commands.execute(`spawn ${kind} ${n}`);
    expect(scene.query('enemies')).toBe(30);
    for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
    const steps = 600;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) scene.step(SIM_DT, idle);
    const perStepMs = (performance.now() - t0) / steps;
    console.info(
      `[perf] arena 30 wrogów F2: ${perStepMs.toFixed(3)} ms / krok symulacji`,
    );
    expect(scene.query('enemies')).toBeGreaterThanOrEqual(30);
    expect(perStepMs).toBeLessThan(6);
  }, 60_000);

  it('masowe zabójstwo 30 wrogów naraz (odłamki) nie przekracza budżetu', async () => {
    const { scene, commands } = await setup();
    commands.execute('spawn assaulter 30');
    for (let i = 0; i < 30; i++) scene.step(SIM_DT, idle);
    const t0 = performance.now();
    commands.execute('kill all');
    for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
    const perStepMs = (performance.now() - t0) / 120;
    console.info(
      `[perf] rozpad 30 wrogów: ${perStepMs.toFixed(3)} ms / krok, odłamki: ${String(scene.query('debris'))}`,
    );
    expect(scene.query('kills')).toBe(30);
    expect(perStepMs).toBeLessThan(6);
  }, 60_000);
});
