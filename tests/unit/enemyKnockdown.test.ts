import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { selectEnemyAnimation } from '../../src/enemies/enemyAnimation';
import {
  canKnockDown,
  knockdownFrame,
  knockdownPose,
  knockdownTiming,
} from '../../src/enemies/enemyKnockdown';
import { EnemyManager } from '../../src/enemies/manager';
import { enemyDefinitions } from '../../src/enemies/registry';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';

let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
});

const k = tuning.vfx.enemyKnockdown;
const HUMANOIDS = ['assaulter', 'gunner', 'sniper', 'shielder', 'executor'];
const NOT_HUMANOID = ['drone', 'hacker', 'turret', 'securityChief'];

function setup(kind: string) {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const settings = structuredClone(tuning);
  const world = new rapier.World({ x: 0, y: settings.physics.gravity, z: 0 });
  world.createCollider(
    ColliderDesc.cuboid(30, 0.5, 30)
      .setTranslation(0, -0.5, 0)
      .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
  );
  const player = entities.create('player', 'player');
  const body = world.createRigidBody(
    RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 6),
  );
  const collider = world.createCollider(
    ColliderDesc.capsule(0.55, 0.35).setCollisionGroups(
      interactionGroups(CollisionGroup.Player, 0xffff),
    ),
    body,
  );
  hurtboxes.add(player, collider);
  entities.bindCollider(player, collider.handle);
  damage.register(player, new Health(() => 10000));
  const projectiles = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    settings,
  );
  const manager = new EnemyManager(
    { bus, rng: new Rng('knockdown'), tuning: settings },
    {
      world,
      entities,
      damage,
      hurtboxes,
      projectiles,
      getTarget: () => ({ id: player, position: { x: 0, y: 0.9, z: 6 } }),
    },
  );
  world.step();
  cleanup.push(() => {
    manager.dispose();
    projectiles.dispose();
    world.free();
  });
  const enemy = manager.spawn(kind, { x: 0, y: 0, z: 0 });
  world.step();
  const steps = (n: number): void => {
    for (let i = 0; i < n; i++) {
      damage.step(SIM_DT);
      manager.step(SIM_DT);
      world.timestep = SIM_DT;
      world.step();
      projectiles.step(SIM_DT);
    }
  };
  const hit = (knockback: number, amount = 1) =>
    damage.deal(enemy.id, {
      source: player,
      amount,
      tags: [],
      dir: { x: 0, y: 0, z: -1 },
      knockback,
    });
  return { enemy, steps, hit, settings };
}

describe('przewrócenie i kip-up wroga (tylko widok)', () => {
  it.each(HUMANOIDS)(
    '%s: cała sekwencja mieści się w stunOnHeavyS i kończy w pionie',
    (kind) => {
      const def = enemyDefinitions.get(kind)!;
      expect(canKnockDown(def)).toBe(true);
      const timing = knockdownTiming(def.stunOnHeavyS, k);
      expect(timing.totalS).toBeLessThanOrEqual(def.stunOnHeavyS + 1e-9);
      expect(timing.landAtS).toBeLessThan(timing.totalS);
      const fallen = knockdownPose(timing.fallS, def.stunOnHeavyS, k);
      expect(fallen.tiltDeg).toBeCloseTo(k.lieTiltDeg);
      const end = knockdownPose(def.stunOnHeavyS, def.stunOnHeavyS, k);
      expect(end.tiltDeg).toBeCloseTo(0);
      expect(end.liftM).toBeCloseTo(0);
      expect(end.squash).toBeCloseTo(1);
      // Kip-up wyskakuje ponad ziemię.
      const mid = knockdownPose(
        timing.fallS + timing.lieS + timing.kipS * ((k.tuckAt + k.landAt) / 2),
        def.stunOnHeavyS,
        k,
      );
      expect(mid.liftM).toBeGreaterThan(k.jumpM * 0.5);
    },
  );

  it('krótsze ogłuszenie skaluje upadek i kip-up, nie wydłuża ogłuszenia', () => {
    const timing = knockdownTiming(0.3, k);
    expect(timing.totalS).toBeCloseTo(0.3);
    expect(timing.lieS).toBeCloseTo(0);
  });

  it.each(NOT_HUMANOID)('%s nie przewraca się', (kind) => {
    expect(canKnockDown(enemyDefinitions.get(kind)!)).toBe(false);
  });

  it('mocny odrzut przewraca w kierunku odrzutu, czas ogłuszenia bez zmian; lekkie trafienie nie', () => {
    const light = setup('assaulter');
    light.hit(light.settings.enemies.stunKnockback - 1);
    expect(light.enemy.current.knockdown).toBeUndefined();
    expect(light.enemy.current.state).not.toBe('stunned');
    const heavy = setup('gunner');
    heavy.hit(heavy.settings.enemies.stunKnockback + 2);
    expect(heavy.enemy.current.state).toBe('stunned');
    expect(heavy.enemy.current.knockdown).toEqual({ x: 0, z: -1 });
    const def = heavy.enemy.definition;
    heavy.steps(Math.round(def.stunOnHeavyS / SIM_DT) - 1);
    expect(heavy.enemy.current.state).toBe('stunned');
    heavy.steps(2);
    expect(heavy.enemy.current.state).not.toBe('stunned');
    expect(heavy.enemy.current.knockdown).toBeUndefined();
  });

  it('dron po mocnym odrzucie nie dostaje przewrócenia', () => {
    const f = setup('drone');
    f.hit(f.settings.enemies.stunKnockback + 2);
    expect(f.enemy.current.knockdown).toBeUndefined();
    expect(knockdownFrame(f.enemy.definition, f.enemy.current, k)).toBeNull();
  });

  it('śmierć w leżeniu: zwykły rozpad, bez kip-upu', () => {
    const f = setup('assaulter');
    f.hit(f.settings.enemies.stunKnockback + 2);
    f.steps(Math.round(k.fallS / SIM_DT) + 1);
    expect(knockdownFrame(f.enemy.definition, f.enemy.current, k)?.phase).toBe(
      'lie',
    );
    f.hit(0, 100000);
    expect(f.enemy.current.state).toBe('dead');
    expect(f.enemy.current.knockdown).toBeUndefined();
    expect(knockdownFrame(f.enemy.definition, f.enemy.current, k)).toBeNull();
    // Nawet gdyby zostało pole przewrócenia, martwy wróg nie wstaje.
    expect(
      knockdownFrame(
        f.enemy.definition,
        { state: 'dead', stateTimeS: 0.5, knockdown: { x: 0, z: 1 } },
        k,
      ),
    ).toBeNull();
  });

  it('od wyskoku wróg ląduje w pozie bojowej (Sword_Idle / Pistol_Idle_Loop)', () => {
    for (const [kind, clip] of [
      ['assaulter', 'Sword_Idle'],
      ['gunner', 'Pistol_Idle_Loop'],
    ] as const) {
      const def = enemyDefinitions.get(kind)!;
      const timing = knockdownTiming(def.stunOnHeavyS, k);
      const base = {
        position: { x: 0, y: 0, z: 0 },
        yaw: 0,
        speed: 0,
        state: 'stunned' as const,
        distance: 0,
        knockdown: { x: 0, z: 1 },
      };
      expect(
        selectEnemyAnimation(def, { ...base, stateTimeS: timing.fallS }).clip,
      ).toBe('Hit_Chest');
      expect(
        selectEnemyAnimation(def, {
          ...base,
          stateTimeS: timing.landAtS,
        }).clip,
      ).toBe(clip);
      // Bez przewrócenia (np. ogłuszenie przez status) — jak dotąd.
      const { knockdown: _skip, ...plain } = base;
      void _skip;
      expect(
        selectEnemyAnimation(def, { ...plain, stateTimeS: timing.landAtS })
          .clip,
      ).toBe('Hit_Chest');
    }
  });
});
