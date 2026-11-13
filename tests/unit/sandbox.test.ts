import { afterEach, describe, expect, it } from 'vitest';
import { Scene as ThreeScene, Mesh } from 'three';
import { Sandbox } from '../../src/scenes/sandbox';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import type { GameContext } from '../../src/core/context';
import type { InputSnapshot } from '../../src/core/input';

const input: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const active: Sandbox[] = [];
afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
});

async function setup() {
  const scene = new Sandbox();
  const three = new ThreeScene();
  const ctx: GameContext = {
    bus: new EventBus(),
    rng: new Rng('sandbox-unit'),
    loop: new GameLoop({ step: () => {}, render: () => {} }),
    tuning: structuredClone(tuning),
    debug: false,
  };
  await scene.init(ctx, three);
  active.push(scene);
  return { scene, three, ctx };
}

describe('sandbox bez WebGL', () => {
  it('kostka spada i stabilizuje się na podłodze po 3 s symulacji', async () => {
    const { scene } = await setup();
    expect(scene.query('cubeY')).toBe(tuning.sandbox.cubeSpawnHeight);
    scene.step(SIM_DT, input);
    expect(scene.query('cubeY')).toBeLessThan(tuning.sandbox.cubeSpawnHeight);
    for (let i = 1; i < 180; i++) scene.step(SIM_DT, input);
    expect(scene.query('cubeY')).toBeCloseTo(0.5, 1);
    const settled = scene.query('cubeY') as number;
    for (let i = 0; i < 30; i++) scene.step(SIM_DT, input);
    expect(Math.abs((scene.query('cubeY') as number) - settled)).toBeLessThan(
      0.02,
    );
  });
  it('dt=0 pomija Rapier i render interpoluje wyłącznie stan wizualny', async () => {
    const { scene, three } = await setup();
    const start = scene.query('cubeY') as number;
    scene.step(0, input);
    expect(scene.query('cubeY')).toBe(start);
    scene.step(SIM_DT, input);
    const current = scene.query('cubeY') as number;
    const cube = three.children.find(
      (object) => object instanceof Mesh && object.position.y === start,
    );
    expect(cube).toBeDefined();
    scene.render(0);
    expect(cube?.position.y).toBe(start);
    scene.render(0.5);
    expect(cube?.position.y).toBeCloseTo((start + current) / 2, 8);
    expect(scene.query('cubeY')).toBe(current);
    scene.step(0, input);
    scene.render(0);
    expect(cube?.position.y).toBe(current);
    scene.render(0.9);
    expect(cube?.position.y).toBe(current);
  });
  it('czyta aktualną grawitację i wysokość spawnu, przestrzega limitu i resetuje scenę', async () => {
    const { scene, ctx } = await setup();
    expect(scene.query('bodies')).toBe(2);
    ctx.tuning.physics.gravity = 0;
    scene.step(SIM_DT, input);
    expect(scene.query('cubeY')).toBe(tuning.sandbox.cubeSpawnHeight);
    ctx.tuning.physics.maxDynamicBodies = 2;
    expect(scene.spawnCube()).toBe(true);
    expect(scene.query('bodies')).toBe(3);
    expect(scene.spawnCube()).toBe(false);
    ctx.tuning.sandbox.cubeSpawnHeight = 8;
    scene.reset();
    expect(scene.query('bodies')).toBe(2);
    expect(scene.query('cubeY')).toBe(8);
  });
  it('dispose usuwa obiekty sceny i emituje despawn', async () => {
    const { scene, three, ctx } = await setup();
    const despawned: number[] = [];
    ctx.bus.on('entity_despawned', ({ id }) => despawned.push(id));
    scene.dispose();
    active.splice(active.indexOf(scene), 1);
    expect(three.children).toHaveLength(0);
    expect(despawned).toHaveLength(1);
  });
});
