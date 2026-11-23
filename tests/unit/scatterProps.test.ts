import { afterEach, describe, expect, it, vi } from 'vitest';
import type { World } from '@dimforge/rapier3d-compat';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { ScatterProps } from '../../src/world/scatterProps';
import type { ScatterPlayer } from '../../src/world/scatterProps';

const worlds: World[] = [];
afterEach(() => {
  for (const world of worlds.splice(0)) world.free();
  vi.restoreAllMocks();
});

const idle: ScatterPlayer = {
  position: { x: 50, y: 1, z: 50 },
  velocity: { x: 0, y: 0, z: 0 },
  sliding: false,
  sprinting: false,
  dashS: 0,
};

async function setup() {
  const rapier = await initPhysics();
  const t = structuredClone(tuning);
  const bus = new EventBus();
  const world = new rapier.World({ x: 0, y: t.physics.gravity, z: 0 });
  worlds.push(world);
  world.createCollider(
    rapier.ColliderDesc.cuboid(80, 0.5, 80)
      .setTranslation(0, -0.5, 0)
      .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
  );
  const system = new ScatterProps({ world, bus, tuning: t, playerId: 1 });
  const step = (seconds: number, player: ScatterPlayer = idle) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      world.step();
      system.step(1 / 60, player);
    }
  };
  const poses = () => {
    const out: { x: number; y: number; z: number }[] = [];
    system.forEach((_i, view) => out.push({ ...view.position }));
    return out;
  };
  return { t, bus, world, system, step, poses };
}

const cone = (x: number, z: number) => ({
  model: 'city_traffic_cone' as const,
  position: { x, y: 0, z },
  yaw: 0,
});

describe('ScatterProps', () => {
  it('bez zakłócenia nie ma ciał i nie ma zmian', async () => {
    const { system, step, poses } = await setup();
    system.add(cone(3, 0));
    const before = poses();
    step(1);
    expect(system.bodyCount).toBe(0);
    expect(poses()).toEqual(before);
  });

  it('wybuch przewraca dekorację w promieniu, daleka zostaje; po uspokojeniu ciało znika', async () => {
    const { bus, system, step, poses, t } = await setup();
    system.add(cone(2, 0));
    system.add(cone(30, 0));
    bus.emit('explosion', {
      point: { x: 0, y: 0.5, z: 0 },
      radiusM: 3,
      owner: 1,
      tags: ['#hazard'],
    });
    expect(system.bodyCount).toBe(1);
    step(0.3);
    const moved = poses();
    expect(moved[0]!.x).toBeGreaterThan(2.3);
    expect(moved[1]).toEqual({ x: 30, y: 0, z: 0 });
    step(6);
    expect(system.bodyCount).toBe(0);
    // Zostaje w pozie końcowej na podłodze.
    const settled = poses()[0]!;
    expect(settled.x).toBeGreaterThan(2.5);
    expect(settled.y).toBeLessThan(1);
    expect(t.props.scatterMaxBodies).toBeGreaterThan(0);
  });

  it('dash w pobliżu odrzuca dekorację, daleki nie', async () => {
    const { bus, system, step, poses } = await setup();
    system.add(cone(1.5, 0));
    system.add(cone(15, 0));
    step(0.1, { ...idle, position: { x: 0, y: 1, z: 0 } });
    bus.emit('dash_used', { user: 1, dir: { x: 1, y: 0, z: 0 } });
    step(0.3, { ...idle, position: { x: 0, y: 1, z: 0 } });
    expect(poses()[0]!.x).toBeGreaterThan(1.8);
    expect(poses()[1]!.x).toBe(15);
    // Dash cudzej encji nic nie robi.
    const other = await setup();
    other.system.add(cone(1.5, 0));
    other.step(0.1, { ...idle, position: { x: 0, y: 1, z: 0 } });
    other.bus.emit('dash_used', { user: 99, dir: { x: 1, y: 0, z: 0 } });
    expect(other.system.bodyCount).toBe(0);
  });

  it('sprint tuż obok przewraca dekorację, chód nie', async () => {
    const walk = await setup();
    walk.system.add(cone(0.5, 0));
    walk.step(0.2, {
      ...idle,
      position: { x: 0, y: 1, z: 0 },
      velocity: { x: 7, y: 0, z: 0 },
      sprinting: false,
    });
    expect(walk.system.bodyCount).toBe(0);
    const run = await setup();
    run.system.add(cone(0.5, 0));
    run.step(0.1, {
      ...idle,
      position: { x: 0, y: 1, z: 0 },
      velocity: { x: 11, y: 0, z: 0 },
      sprinting: true,
    });
    expect(run.system.bodyCount).toBe(1);
  });

  it('respektuje scatterMaxBodies', async () => {
    const { bus, system, t } = await setup();
    t.props.scatterMaxBodies = 3;
    for (let i = 0; i < 8; i++) system.add(cone(1 + i * 0.4, 0));
    bus.emit('explosion', {
      point: { x: 0, y: 0, z: 0 },
      radiusM: 5,
      owner: 1,
      tags: [],
    });
    expect(system.bodyCount).toBe(3);
  });

  it('kolizje: tylko Debris z filtrem World (bez gracza, wrogów i pocisków), deterministyczne', async () => {
    const random = vi.spyOn(Math, 'random');
    const { bus, system, world, step, poses } = await setup();
    system.add(cone(2, 0));
    bus.emit('explosion', {
      point: { x: 0, y: 0, z: 0 },
      radiusM: 3,
      owner: 1,
      tags: [],
    });
    const groups: number[] = [];
    world.forEachCollider((collider) =>
      groups.push(collider.collisionGroups()),
    );
    const ours = groups.find((g) => g >>> 16 === CollisionGroup.Debris);
    expect(ours).toBeDefined();
    const filter = ours! & 0xffff;
    expect(filter & CollisionGroup.Enemy).toBe(0);
    expect(filter & CollisionGroup.PlayerProjectile).toBe(0);
    expect(filter & CollisionGroup.EnemyProjectile).toBe(0);
    expect(filter & CollisionGroup.World).not.toBe(0);
    // Czysto kosmetyczne: gracz ich nie czuje.
    expect(filter & CollisionGroup.Player).toBe(0);
    step(2);
    const a = poses();
    const again = await setup();
    again.system.add(cone(2, 0));
    again.bus.emit('explosion', {
      point: { x: 0, y: 0, z: 0 },
      radiusM: 3,
      owner: 1,
      tags: [],
    });
    again.step(2);
    expect(again.poses()).toEqual(a);
    expect(random).not.toHaveBeenCalled();
  });

  it('klatka osiadania stoi dokładnie w pozie końcowej niezależnie od alpha', async () => {
    const { bus, system, step } = await setup();
    system.add(cone(2, 0));
    bus.emit('explosion', {
      point: { x: 0, y: 0, z: 0 },
      radiusM: 3,
      owner: 1,
      tags: [],
    });
    let guard = 0;
    while (system.bodyCount > 0 && guard++ < 600) step(1 / 60);
    let moving = false;
    let same = false;
    system.forEach((_i, v) => {
      moving = v.moving;
      same =
        v.position.x === v.previousPosition.x &&
        v.position.y === v.previousPosition.y &&
        v.position.z === v.previousPosition.z;
    });
    expect(moving).toBe(true);
    expect(same).toBe(true);
    system.forEach((_i, v) => (moving = v.moving));
    expect(moving).toBe(false);
  });
});
