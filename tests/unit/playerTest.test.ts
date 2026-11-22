import { afterEach, expect, it } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { PlayerTest } from '../../src/scenes/playerTest';
import { scenes } from '../../src/scenes';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import type { InputSnapshot } from '../../src/core/input';
import type { Vec3 } from '../../src/core/math';

const input: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const active: PlayerTest[] = [];
afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
});

it('player-test rejestruje scenę, ląduje po tp i interpoluje kamerę bez zmiany symulacji', async () => {
  expect((await scenes['player-test']?.())?.().id).toBe('player-test');
  const scene = new PlayerTest(false);
  const three = new ThreeScene();
  const camera = new PerspectiveCamera();
  await scene.init(
    {
      bus: new EventBus(),
      rng: new Rng('player-test'),
      loop: new GameLoop({ step: () => {}, render: () => {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera,
    },
    three,
  );
  active.push(scene);
  for (let i = 0; i < 10; i++) scene.step(SIM_DT, input);
  expect(scene.query('grounded')).toBe(true);
  scene.teleport({ x: 0, y: 5, z: 0 });
  expect(scene.query('grounded')).toBe(false);
  expect(scene.query('playerVel')).toEqual({ x: 0, y: 0, z: 0 });
  scene.step(SIM_DT, input);
  const current = scene.query('playerPos') as Vec3;
  const eyeOffset = tuning.player.eyeHeight - tuning.player.capsuleHeight / 2;
  scene.render(0);
  expect(camera.position.y).toBe(5 + eyeOffset);
  scene.render(0.5);
  expect(camera.position.y).toBeCloseTo((5 + current.y) / 2 + eyeOffset);
  expect(scene.query('playerPos')).toEqual(current);
  scene.step(0, input);
  scene.render(0);
  expect(camera.position.y).toBeCloseTo(current.y + eyeOffset);
  for (let i = 0; i < 120; i++) scene.step(SIM_DT, input);
  expect(scene.query('grounded')).toBe(true);
  expect((scene.query('playerPos') as Vec3).y).toBeCloseTo(0.92, 1);
  expect(scene.query('missing')).toBeUndefined();
  scene.reset();
  expect(scene.query('playerPos')).toEqual({ x: 0, y: 0.92, z: 0 });
  scene.dispose();
  active.splice(active.indexOf(scene), 1);
  expect(three.children).toHaveLength(0);
});
