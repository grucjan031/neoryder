import { beforeAll, describe, expect, it } from 'vitest';
import type * as RAPIER from '@dimforge/rapier3d-compat';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { EntityRegistry } from '../../src/core/entities';
import type { Action, InputSnapshot } from '../../src/core/input';
import { SIM_DT } from '../../src/core/loop';
import { ResourcePool } from '../../src/core/resource';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { plasmaBladeDefinition } from '../../src/combat/melee/bladeSchema';
import { PlasmaBlade } from '../../src/combat/melee/plasmaBlade';
import { HeldItem } from '../../src/combat/heldItem';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import {
  initPhysics,
  CollisionGroup,
  interactionGroups,
} from '../../src/physics';

const input = (held: Action[] = []): InputSnapshot => ({
  held: new Set(held),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});

let R: typeof RAPIER;
beforeAll(async () => {
  R = await initPhysics();
});

/** Gracz w (0,1,0) patrzy w -Z; strzelec w (0,1,-10) strzela w gracza pociskiem 10 m/s. */
function setup() {
  const t = structuredClone(tuning);
  const bus = new EventBus();
  const world = new R.World({ x: 0, y: -20, z: 0 });
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const projectiles = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    t,
  );
  const add = (
    kind: string,
    team: 'player' | 'enemy',
    z: number,
    group: number,
    hp: number,
    stats?: Stats,
  ) => {
    const id = entities.create(kind, team);
    const health = new Health(() => hp);
    damage.register(id, health, stats ? { stats } : {});
    const collider = world.createCollider(
      R.ColliderDesc.capsule(0.5, 0.35)
        .setTranslation(0, 1, z)
        .setCollisionGroups(interactionGroups(group, 0xffff)),
    );
    hurtboxes.add(id, collider);
    entities.bindCollider(id, collider.handle);
    return { id, health };
  };
  const playerStats = new Stats({ maxHealth: 100 });
  const player = add(
    'player',
    'player',
    0,
    CollisionGroup.Player,
    100,
    playerStats,
  );
  const shooter = add('gunner', 'enemy', -10, CollisionGroup.Enemy, 100);
  world.step();
  const blade = new PlasmaBlade(
    plasmaBladeDefinition,
    {
      owner: player.id,
      team: 'player',
      damage,
      stats: playerStats,
      energy: new ResourcePool({ max: () => 100, regenPerS: () => 0 }),
      queryArc: () => [],
      aim: () => ({
        origin: { x: 0, y: 1.6, z: 0 },
        dir: { x: 0, y: 0, z: -1 },
      }),
      projectiles,
      positionOf: (id) => (id === shooter.id ? { x: 0, y: 0, z: -10 } : null),
    },
    bus,
    t,
  );
  projectiles.addInterceptor(blade.interceptProjectile);
  const log: { type: keyof GameEvents; payload: unknown }[] = [];
  for (const type of [
    'parry_success',
    'projectile_reflected',
    'hitstop',
    'damage_dealt',
  ] as const)
    bus.on(type, (payload) => log.push({ type, payload }));
  const fire = () =>
    projectiles.spawn({
      owner: shooter.id,
      team: 'enemy',
      origin: { x: 0, y: 1, z: -9 },
      dir: { x: 0, y: 0, z: 1 },
      speed: 10,
      damage: 12,
      tags: ['#gun'],
      lifetimeS: 4,
    });
  /** Kroki symulacji z danym wejściem (blok = przytrzymany PPM). */
  const run = (seconds: number, held: Action[] = []) => {
    for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
      blade.step(SIM_DT, input(held));
      projectiles.step(SIM_DT);
      damage.step(SIM_DT);
      world.step();
    }
  };
  // Pocisk z z = -9 do powierzchni kapsuły gracza (z ≈ -0,35) leci ok. 0,865 s.
  const flightS = (9 - 0.35) / 10;
  return {
    t,
    bus,
    world,
    projectiles,
    blade,
    player,
    shooter,
    log,
    fire,
    run,
    flightS,
  };
}

describe('parowanie pocisków (#10)', () => {
  it('PPM with a gun starts the parry window in the same step and reflects the incoming projectile', () => {
    const c = setup();
    const hands = new HeldItem(c.bus, c.player.id, c.t, 'gun');
    c.fire();
    c.run(c.flightS - 0.08);
    const block = { ...input(['block']), pressed: new Set<Action>(['block']) };
    const routed = hands.step(SIM_DT, block, { bladeBusy: false });
    c.blade.step(SIM_DT, routed.bladeInput);
    expect(hands.held).toBe('blade');
    expect(routed.triggerHeld).toBe(false);
    expect(c.blade.view()).toMatchObject({ state: 'blocking', blockAgeS: 0 });
    c.run(0.2, ['block']);
    expect(c.log.some((event) => event.type === 'parry_success')).toBe(true);
    expect(c.player.health.current).toBe(100);
    hands.dispose();
  });
  it('blok wciśnięty w oknie odbija pocisk w strzelca: parry_success, hitstop, obrażenia ×2', () => {
    const c = setup();
    c.fire();
    c.run(c.flightS - 0.08); // 80 ms przed trafieniem…
    c.run(0.2, ['block']); // …gracz wciska blok (okno 150 ms)
    c.run(2, ['block']);
    const types = c.log.map((e) => e.type);
    expect(types).toContain('parry_success');
    expect(types).toContain('projectile_reflected');
    expect(c.log.find((e) => e.type === 'hitstop')?.payload).toEqual({
      ms: c.t.melee.parryHitstopMs,
    });
    expect(c.player.health.current).toBe(100);
    expect(c.shooter.health.current).toBe(100 - 12 * c.t.melee.parryDamageMult);
    const parry = c.log.find((e) => e.type === 'parry_success')
      ?.payload as GameEvents['parry_success'];
    expect(parry.attacker).toBe(c.shooter.id);
  });

  it('blok trzymany dłużej niż okno: zwykły blok −70%, bez odbicia', () => {
    const c = setup();
    c.fire();
    c.run(c.flightS - 0.4);
    c.run(2, ['block']); // blok od 400 ms przed trafieniem
    expect(c.log.some((e) => e.type === 'parry_success')).toBe(false);
    expect(c.player.health.current).toBeCloseTo(
      100 - 12 * plasmaBladeDefinition.blockDamageMult,
    );
    expect(c.shooter.health.current).toBe(100);
  });

  it('bez bloku pocisk po prostu rani gracza', () => {
    const c = setup();
    c.fire();
    c.run(2);
    expect(c.player.health.current).toBe(88);
    expect(c.log.some((e) => e.type === 'parry_success')).toBe(false);
  });

  it('pocisk z tyłu nie jest parowany', () => {
    const c = setup();
    c.projectiles.spawn({
      owner: c.shooter.id,
      team: 'enemy',
      origin: { x: 0, y: 1, z: 9 },
      dir: { x: 0, y: 0, z: -1 },
      speed: 10,
      damage: 12,
      tags: ['#gun'],
      lifetimeS: 4,
    });
    c.run(c.flightS - 0.08);
    c.run(1, ['block']);
    expect(c.log.some((e) => e.type === 'parry_success')).toBe(false);
  });
});
