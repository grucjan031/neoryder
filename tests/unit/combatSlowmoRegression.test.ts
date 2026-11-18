import { afterEach, expect, it, vi } from 'vitest';
import { Group, Matrix4, Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { PlasmaBlade } from '../../src/combat/melee/plasmaBlade';
import { plasmaBladeDefinition } from '../../src/combat/melee/bladeSchema';
import { DamageSystem, Health } from '../../src/combat/damage';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { FeelSystem } from '../../src/core/feel';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { ResourcePool } from '../../src/core/resource';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import type { InputSnapshot } from '../../src/core/input';
import { FppBlade } from '../../src/render/fppBlade';
import { FppBladeFx } from '../../src/render/fppBladeFx';
import { HandRig } from '../../src/render/handRig';
import { ExecuteSystem } from '../../src/combat/melee/execute';

afterEach(() => vi.restoreAllMocks());
const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};

async function setup(execute: boolean) {
  const model = new Group();
  const edge = new Group();
  edge.name = 'blade';
  const tip = new Group();
  tip.name = 'blade_tip';
  tip.position.z = -1;
  edge.add(tip);
  model.add(edge);
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue({
    scene: model,
  } as GLTF);
  vi.spyOn(HandRig.prototype, 'load').mockResolvedValue();
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const owner = entities.create('player', 'player');
  const target = entities.create('enemy', 'enemy');
  const health = new Health(() => 100);
  health.set(1);
  damage.register(target, health);
  const query = vi.fn(() => [
    { entity: target, colliderHandle: 1, multiplier: 1 },
  ]);
  const aim = () => ({
    origin: { x: 0, y: 1, z: 0 },
    dir: { x: 0, y: 0, z: -1 },
  });
  const execution = new ExecuteSystem({
    bus,
    damage,
    tuning,
    owner,
    enemies: () => [
      { id: target, kind: 'enemy', position: { x: 0, y: 1, z: -1 } },
    ],
    statuses: { has: () => false, remaining: () => 0, stacks: () => 0 },
    aim,
    addEnergy: () => {},
    heal: () => {},
  });
  const blade = new PlasmaBlade(
    plasmaBladeDefinition,
    {
      owner,
      team: 'player',
      damage,
      stats: new Stats({}),
      energy: new ResourcePool({ max: () => 100, regenPerS: () => 0 }),
      queryArc: query,
      aim,
      tryExecute: execute ? () => execution.tryExecute() : undefined,
    },
    bus,
    tuning,
  );
  const view = new FppBlade();
  await view.load();
  const fx = vi.spyOn(FppBladeFx.prototype, 'update');
  const loop = new GameLoop({
    step: (dt) => blade.step(dt, idle),
    render: () => {},
  });
  const feel = new FeelSystem(bus, loop, tuning);
  return { blade, view, fx, query, loop, feel, health, execution };
}

it('wykończenie pokazuje cięcie i smugę w czasie gracza, bez drugiego trafienia', async () => {
  const f = await setup(true);
  try {
    f.view.place(new Matrix4(), f.blade.view());
    const rest = f.view.root.children[0]!.matrix.clone();
    f.blade.step(SIM_DT, { ...idle, pressed: new Set(['attack']) });
    expect(f.health.dead).toBe(true);
    f.view.place(new Matrix4(), f.blade.view());
    expect(f.view.root.children[0]!.matrix.equals(rest)).toBe(false);
    for (let i = 0; i < 18; i++) {
      const before = f.blade.view();
      f.loop.advance(1000 / 60);
      f.feel.update(SIM_DT);
      f.view.place(new Matrix4(), f.blade.view(), SIM_DT);
      if (i > 0 && i < 5) expect(f.blade.view()).toEqual(before); // hitstop
    }
    const trails: Mesh[] = [];
    f.view.root.traverse((node) => {
      if (node instanceof Mesh && node.geometry.getAttribute('color'))
        trails.push(node);
    });
    expect(trails.some((trail) => trail.visible)).toBe(true);
    expect(f.query).not.toHaveBeenCalled();
    f.blade.reset();
    f.view.place(new Matrix4(), f.blade.view(), SIM_DT);
    expect(f.blade.view().execution).toBeNull();
  } finally {
    f.view.dispose();
    f.blade.dispose();
    f.feel.dispose();
    f.execution.dispose();
  }
});

it('zegar efektów zwykłego cięcia zwalnia razem z symulacją i stoi w hitstopie', async () => {
  const f = await setup(false);
  try {
    f.blade.step(SIM_DT, { ...idle, pressed: new Set(['attack']) });
    f.view.place(new Matrix4(), f.blade.view());
    f.loop.timeScale = 0.1;
    f.loop.advance(1000 / 60);
    f.view.place(new Matrix4(), f.blade.view(), SIM_DT);
    expect(f.fx.mock.calls.at(-1)![1]).toBeCloseTo(SIM_DT * 0.1, 8);
    f.loop.hitstop(100);
    f.loop.advance(1000 / 60);
    f.view.place(new Matrix4(), f.blade.view(), SIM_DT);
    expect(f.fx.mock.calls.at(-1)![1]).toBe(0);
  } finally {
    f.view.dispose();
    f.blade.dispose();
    f.feel.dispose();
    f.execution.dispose();
  }
});

it('hitstop zachowuje geometrię i alfę smugi przez 120 klatek renderu', () => {
  const model = new Group();
  const edge = new Group();
  edge.name = 'blade';
  const tip = new Group();
  tip.name = 'blade_tip';
  tip.position.z = -1;
  edge.add(tip);
  model.add(edge);
  model.position.set(0.2, -0.2, -0.6);
  const fx = new FppBladeFx();
  const item = { key: 'main' as const, model, visible: true, slashing: true };
  try {
    fx.update(new Matrix4(), SIM_DT, [item]);
    model.position.x += 0.1;
    fx.update(new Matrix4(), SIM_DT, [item]);
    let trail: Mesh | undefined;
    fx.root.traverse((node) => {
      if (node instanceof Mesh && node.geometry.getAttribute('color'))
        trail = node;
    });
    expect(trail?.visible).toBe(true);
    const position = [...trail!.geometry.getAttribute('position').array];
    const color = [...trail!.geometry.getAttribute('color').array];
    for (let i = 0; i < 120; i++) fx.update(new Matrix4(), 0, [item]);
    expect(trail!.visible).toBe(true);
    expect([...trail!.geometry.getAttribute('position').array]).toEqual(
      position,
    );
    expect([...trail!.geometry.getAttribute('color').array]).toEqual(color);
  } finally {
    fx.dispose();
  }
});
