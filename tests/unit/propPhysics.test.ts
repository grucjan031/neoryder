import { afterEach, describe, expect, it, vi } from 'vitest';
import type { World } from '@dimforge/rapier3d-compat';
import { DamageSystem, Hurtboxes } from '../../src/combat/damage';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { PlayerController } from '../../src/player/playerController';
import { DebrisSystem } from '../../src/vfx/debris';
import { WorldDebris } from '../../src/vfx/worldDebris';
import { PropPhysicsSystem, propKindOf } from '../../src/world/propPhysics';
import type { PropBlock } from '../../src/world/propPhysics';

const worlds: World[] = [];
afterEach(() => {
  for (const world of worlds.splice(0)) world.free();
  vi.restoreAllMocks();
});

const small = (
  x: number,
  z: number,
  extra: Partial<PropBlock> = {},
): PropBlock => ({
  size: { x: 0.5, y: 0.5, z: 0.5 },
  position: { x, y: 0.25, z },
  model: 'crate_small',
  ...extra,
});
const big = (x: number, z: number): PropBlock => ({
  size: { x: 1, y: 1, z: 1 },
  position: { x, y: 0.5, z },
  model: 'crate',
});

async function setup(doors: { x: number; y: number; z: number }[] = []) {
  const rapier = await initPhysics();
  const t = structuredClone(tuning);
  const bus = new EventBus();
  const world = new rapier.World({ x: 0, y: t.physics.gravity, z: 0 });
  worlds.push(world);
  world.createCollider(
    rapier.ColliderDesc.cuboid(40, 0.5, 40)
      .setTranslation(0, -0.5, 0)
      .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
  );
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const props = new PropPhysicsSystem({
    world,
    bus,
    damage,
    entities,
    hurtboxes,
    tuning: t,
    doors,
  });
  const destroyed: GameEvents['prop_destroyed'][] = [];
  bus.on('prop_destroyed', (event) => destroyed.push(event));
  const step = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      world.step();
      props.step(1 / 60);
    }
  };
  const hit = (id: number, amount: number, dir = { x: 1, y: 0, z: 0 }) =>
    damage.deal(id, {
      source: null,
      amount,
      tags: ['#gun'],
      dir,
      knockback: 0,
    });
  return { t, bus, world, damage, hurtboxes, props, destroyed, step, hit };
}

describe('propKindOf', () => {
  it('rozpoznaje tylko zniszczalne skrzynie', () => {
    expect(propKindOf(small(0, 0))).toBe('crate_small');
    expect(propKindOf(big(0, 0))).toBe('crate');
    expect(propKindOf(small(0, 0, { destructible: false }))).toBeNull();
    expect(propKindOf(small(0, 0, { walkable: true }))).toBeNull();
    expect(propKindOf(small(0, 0, { instance: true }))).toBeNull();
    expect(propKindOf({ ...big(0, 0), model: 'pillar' })).toBeNull();
    expect(propKindOf({ ...big(0, 0), model: undefined })).toBeNull();
  });
});

describe('PropPhysicsSystem', () => {
  it('duża skrzynia jest nieruchoma, mała ma ciało, obie mają hurtbox i zdrowie', async () => {
    const { props, damage, world } = await setup();
    expect(props.claim(big(0, 0))).toBe(true);
    expect(props.claim(small(3, 0))).toBe(true);
    expect(props.claim({ ...big(5, 5), model: 'pillar' })).toBe(false);
    expect(props.aliveCount).toBe(2);
    expect(props.bodyCount).toBe(1);
    const [bigId, smallId] = props.entityIds();
    expect(damage.health(bigId!)?.max).toBe(tuning.props.crateHealth);
    expect(damage.health(smallId!)?.max).toBe(tuning.props.smallCrateHealth);
    expect(world.bodies.len()).toBe(1 + 0); // tylko mała skrzynia (podłoga to sam collider)
  });

  it('zniszczenie usuwa collider i ciało, emituje zdarzenie i odłamki z puli', async () => {
    const { props, bus, world, hit, destroyed, t } = await setup();
    props.claim(big(0, 0));
    props.claim(small(3, 0));
    const colliders = world.colliders.len();
    const [bigId, smallId] = props.entityIds();
    const debris = new DebrisSystem({ maxDebris: 200 });
    const listener = new WorldDebris(bus, debris, { tuning: t });
    // Duża: dwa trafienia po 20 (hp 35).
    expect(hit(bigId!, 20)).toBeGreaterThan(0);
    expect(destroyed).toHaveLength(0);
    expect(world.colliders.len()).toBe(colliders);
    hit(bigId!, 20);
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0]?.kind).toBe('crate');
    expect(world.colliders.len()).toBe(colliders - 1);
    expect(debris.activeCount).toBe(t.props.crateDebrisCount);
    // Mała: jedno trafienie 20 > hp 15.
    hit(smallId!, 20);
    expect(destroyed).toHaveLength(2);
    expect(world.bodies.len()).toBe(0);
    expect(props.bodyCount).toBe(0);
    expect(props.aliveCount).toBe(0);
    expect(debris.activeCount).toBe(
      t.props.crateDebrisCount + t.props.smallCrateDebrisCount,
    );
    // Po zniszczeniu kolejne obrażenia nic nie robią.
    expect(hit(bigId!, 99)).toBe(0);
    listener.dispose();
  });

  it('odłamki skrzyń są deterministyczne i nie używają Math.random', async () => {
    const random = vi.spyOn(Math, 'random');
    const run = async () => {
      const { props, bus, hit, t, step } = await setup();
      props.claim(small(2, 2));
      const debris = new DebrisSystem({ maxDebris: 100 });
      new WorldDebris(bus, debris, { tuning: t });
      hit(props.entityIds()[0]!, 50);
      step(0.5);
      debris.step(0.1);
      const out: number[] = [];
      debris.forEachActive((p) => out.push(p.x, p.y, p.z));
      return out;
    };
    const a = await run();
    const b = await run();
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
    expect(random).not.toHaveBeenCalled();
  });

  it('respektuje maxPropBodies: nadmiar skrzyń zostaje nieruchomy, ale zniszczalny', async () => {
    const { props, t } = await setup();
    // Limit czytany z tuning przekazanego do systemu.
    t.physics.maxPropBodies = 3;
    for (let i = 0; i < 8; i++) props.claim(small(-6 + i * 1.5, 4));
    expect(props.aliveCount).toBe(8);
    expect(props.bodyCount).toBe(3);
  });

  it('skrzynie przy drzwiach nie dostają ciała (nie zablokują wejścia)', async () => {
    const { props } = await setup([{ x: 0, y: 1.5, z: 10 }]);
    props.claim(small(0, 7)); // 3 m od drzwi < doorClearM + maxDriftM
    props.claim(small(0, -5)); // daleko
    expect(props.aliveCount).toBe(2);
    expect(props.bodyCount).toBe(1);
  });

  it('startuje uśpiona, trafienie ją budzi i przesuwa, a po chwili znów zasypia', async () => {
    const { props, hit, step } = await setup();
    props.claim(small(0, 0));
    const id = props.entityIds()[0]!;
    step(1.5); // ciało osiada i zasypia
    expect(props.awakeCount).toBe(0);
    let before = { x: 0, z: 0 };
    props.forEach(
      (view) => (before = { x: view.position.x, z: view.position.z }),
    );
    hit(id, 1, { x: 1, y: 0, z: 0 });
    step(0.1);
    expect(props.awakeCount).toBe(1);
    step(4);
    let after = { x: 0, z: 0 };
    props.forEach(
      (view) => (after = { x: view.position.x, z: view.position.z }),
    );
    expect(after.x).toBeGreaterThan(before.x + 0.1);
    expect(props.awakeCount).toBe(0);
  });

  it('ciało odsunięte dalej niż maxDriftM jest zamrażane i przestaje liczyć się do limitu', async () => {
    const { props, hit, step, t } = await setup();
    t.props.maxDriftM = 0.3;
    props.claim(small(0, 0));
    expect(props.bodyCount).toBe(1);
    const id = props.entityIds()[0]!;
    for (let i = 0; i < 6; i++) {
      hit(id, 0.01, { x: 1, y: 0, z: 0 });
      step(0.3);
    }
    expect(props.bodyCount).toBe(0);
    expect(props.aliveCount).toBe(1);
    // Nadal zniszczalna.
    hit(id, 50);
    expect(props.aliveCount).toBe(0);
  });

  it('rozbita skrzynia znika z rejestru encji w następnym kroku bez fałszywego enemy_killed; dispose sprząta', async () => {
    const { props, bus, hit, step } = await setup();
    const killed: unknown[] = [];
    const despawned: number[] = [];
    bus.on('enemy_killed', (e) => killed.push(e));
    bus.on('entity_despawned', (e) => despawned.push(e.id));
    props.claim(small(0, 0));
    props.claim(big(4, 0));
    const [a, b] = props.entityIds();
    hit(a!, 50);
    expect(killed).toHaveLength(0);
    step(0.05);
    expect(despawned).toEqual([a]);
    props.dispose();
    expect(despawned).toContain(b);
    expect(props.bodyCount).toBe(0);
  });

  it('skrzynia wybita w powietrze nie zamarza w locie: Fixed dopiero po opadnięciu', async () => {
    const { props, hit, step, t } = await setup();
    t.props.maxDriftM = 0.2;
    props.claim(small(0, 0));
    const id = props.entityIds()[0]!;
    hit(id, 1, { x: 1, y: 0.8, z: 0 });
    step(0.1);
    let y = 0;
    props.forEach((v) => (y = v.position.y));
    expect(props.bodyCount).toBe(1); // jeszcze w locie
    step(3);
    props.forEach((v) => (y = v.position.y));
    expect(props.bodyCount).toBe(0);
    expect(y).toBeLessThan(0.5);
  });

  it('cele wybuchów obejmują żywe skrzynie', async () => {
    const { props, hit } = await setup();
    props.claim(big(0, 0));
    props.claim(small(3, 0));
    expect(props.targets()).toHaveLength(2);
    hit(props.entityIds()[1]!, 50);
    expect(props.targets()).toHaveLength(1);
  });
});

describe('popychanie przez gracza', () => {
  it('biegnący gracz przesuwa małą skrzynię (enableDynamicPush), a skrzynia go nie blokuje na stałe', async () => {
    const { props, world, bus, t, step } = await setup();
    props.claim(small(0, -2));
    const ctx = { bus, tuning: t };
    const player = new PlayerController(7, world, ctx, {
      x: 0,
      y: t.player.capsuleHeight / 2 + t.player.controllerOffset,
      z: 2,
    });
    player.enableDynamicPush(t.puzzle.pushMassKg);
    const forward = {
      held: new Set(['moveForward', 'sprint'] as const),
      pressed: new Set<never>(),
      released: new Set<never>(),
      lookDelta: { x: 0, y: 0 },
    };
    for (let i = 0; i < 120; i++) {
      player.step(1 / 60, forward);
      world.step();
      props.step(1 / 60);
    }
    let z = 0;
    props.forEach((view) => (z = view.position.z));
    expect(z).toBeLessThan(-2.2);
    expect(player.getState().position.z).toBeLessThan(0);
    player.dispose();
    void step;
  });
});
