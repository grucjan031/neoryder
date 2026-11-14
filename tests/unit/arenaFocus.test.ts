/** F2-06: Skupienie w prawdziwej arenie — gracz w czasie rzeczywistym, świat zwolniony. */
import { afterEach, expect, it } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { Arena } from '../../src/scenes/arena';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { EventBus } from '../../src/core/events';
import { FeelSystem } from '../../src/core/feel';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import type { InputSnapshot } from '../../src/core/input';
import type { Vec3 } from '../../src/core/math';

const forward: InputSnapshot = {
  held: new Set(['moveForward']),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};

const active: { dispose(): void }[] = [];
afterEach(() => {
  for (const item of active.splice(0)) item.dispose();
});

async function run(focus: boolean) {
  const scene = new Arena(false);
  const bus = new EventBus();
  const t = structuredClone(tuning);
  const loop = new GameLoop({ step() {}, render() {} });
  const feel = new FeelSystem(bus, loop, t);
  await scene.init(
    {
      bus,
      rng: new Rng('focus'),
      loop,
      tuning: t,
      debug: false,
      camera: new PerspectiveCamera(),
      commands: new CommandRegistry(),
      feel,
    },
    new ThreeScene(),
  );
  active.push(scene, feel);
  const start = scene.query('playerPos') as Vec3;
  if (focus) bus.emit('focus', { worldScale: 0.3, durationS: 2 });
  let worldS = 0;
  // 1 s czasu rzeczywistego: 60 klatek, w każdej jeden krok świata SIM_DT × timeScale.
  for (let i = 0; i < 60; i++) {
    const dt = SIM_DT * loop.timeScale;
    worldS += dt;
    scene.step(dt, forward);
    feel.update(SIM_DT);
  }
  const end = scene.query('playerPos') as Vec3;
  return { moved: Math.hypot(end.x - start.x, end.z - start.z), worldS };
}

it('player moves the same distance in 1 s of real time with focus while the world advances 0.3 s', async () => {
  const plain = await run(false);
  const focus = await run(true);
  expect(plain.moved).toBeGreaterThan(1);
  expect(focus.moved).toBeCloseTo(plain.moved, 2);
  expect(plain.worldS).toBeCloseTo(1, 6);
  expect(focus.worldS).toBeCloseTo(0.3, 6);
});
