import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import type { InputSnapshot } from '../../src/core/input';
import { Scene as ThreeScene } from 'three';
import { RoomScene } from '../../src/scenes/roomScene';
import { roomDefinitions } from '../../src/world/rooms';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { Rng } from '../../src/core/rng';
import type { MapNode, RunState } from '../../src/core/runTypes';
import type { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import sectorRaw from '../../src/data/sectors/kurogane.json';
import roomRaw from '../../src/data/rooms/combatYard.json';
import { enemySchema } from '../../src/enemies/enemySchema';
import { EnemyManager } from '../../src/enemies/manager';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { threatLevels } from '../../src/progression/threatSchema';
import { loadRoom } from '../../src/world/roomSchema';
import { loadSector } from '../../src/world/sectorSchema';
import {
  planWaves,
  threatLevelDef,
  threatModifiers,
} from '../../src/world/threat';
import type { WavesDefinition } from '../../src/world/waves';

const sector = loadSector(sectorRaw);
const room = loadRoom(roomRaw);
const costs = new Map(
  Object.values(
    import.meta.glob<unknown>('../../src/data/enemies/*.json', {
      eager: true,
      import: 'default',
    }),
  )
    .map((raw) => enemySchema.parse(raw))
    .map((enemy) => [enemy.id, enemy.threatCost ?? 0] as const),
);
const node = (type: 'combat' | 'elite', layer: number): MapNode => ({
  id: `n-${type}-${layer}`,
  type,
  layer,
  index: 0,
  next: [],
});
const total = (plan: WavesDefinition) =>
  plan.waves.reduce(
    (sum, wave) =>
      sum + wave.groups.reduce((s, g) => s + costs.get(g.enemy)! * g.count, 0),
    0,
  );

describe('Poziom zagrożenia: dane i modyfikatory', () => {
  it('poziom 0 nie daje modyfikatorów; nieznany poziom to błąd', () => {
    expect(threatModifiers(0)).toEqual([]);
    expect(() => threatLevelDef(99)).toThrow();
    expect(() => threatLevelDef(-1)).toThrow();
    expect(() => threatLevelDef(1.5)).toThrow();
  });
  it('modyfikatory mają źródło threat:<poziom> i wartości z danych', () => {
    for (const def of threatLevels.slice(1)) {
      const source = `threat:${def.level}`;
      expect(threatModifiers(def.level)).toEqual([
        { stat: 'maxHealth', type: 'percent', value: def.enemyHealth, source },
        { stat: 'damage', type: 'percent', value: def.enemyDamage, source },
      ]);
    }
  });
  it('mnożniki rosną monotonicznie z poziomem', () => {
    for (let i = 1; i < threatLevels.length; i++) {
      const a = threatLevels[i - 1]!;
      const b = threatLevels[i]!;
      expect(b.budgetMult).toBeGreaterThanOrEqual(a.budgetMult);
      expect(b.enemyHealth).toBeGreaterThanOrEqual(a.enemyHealth);
      expect(b.enemyDamage).toBeGreaterThanOrEqual(a.enemyDamage);
    }
  });
});

describe('Poziom zagrożenia: planWaves', () => {
  it('poziom 0 (jawny i domyślny) daje plan identyczny jak dotąd', () => {
    for (const type of ['combat', 'elite'] as const)
      for (const layer of [1, 4, 8]) {
        const n = node(type, layer);
        const base = planWaves(room, sector, n, new Rng('seed'));
        expect(planWaves(room, sector, n, new Rng('seed'), 0)).toEqual(base);
      }
  });
  it('budżet fal rośnie monotonicznie z poziomem 0–10', () => {
    for (const type of ['combat', 'elite'] as const)
      for (const layer of [1, 4, 8]) {
        let previous = 0;
        for (const def of threatLevels) {
          const plan = planWaves(
            room,
            sector,
            node(type, layer),
            new Rng('seed'),
            def.level,
          );
          const sum = total(plan);
          expect(sum).toBeGreaterThanOrEqual(previous);
          previous = sum;
        }
      }
    const plan = (level: number) =>
      total(planWaves(room, sector, node('combat', 4), new Rng('x'), level));
    expect(plan(10)).toBeGreaterThan(plan(0));
  });
});

let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
});

function setup(level: number) {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const settings = structuredClone(tuning);
  const physics = new rapier.World({ x: 0, y: settings.physics.gravity, z: 0 });
  physics.createCollider(
    ColliderDesc.cuboid(40, 0.5, 40)
      .setTranslation(0, -0.5, 0)
      .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
  );
  const player = entities.create('player', 'player');
  const body = physics.createRigidBody(
    RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 0),
  );
  const collider = physics.createCollider(
    ColliderDesc.capsule(0.55, 0.35).setCollisionGroups(
      interactionGroups(CollisionGroup.Player, 0xffff),
    ),
    body,
  );
  hurtboxes.add(player, collider);
  entities.bindCollider(player, collider.handle);
  damage.register(player, new Health(() => 1e9));
  const projectiles = new ProjectileSystem(
    physics,
    entities,
    hurtboxes,
    damage,
    bus,
    settings,
  );
  const manager = new EnemyManager(
    { bus, rng: new Rng('threat'), tuning: settings },
    {
      world: physics,
      entities,
      damage,
      hurtboxes,
      projectiles,
      getTarget: () => ({ id: player, position: { x: 0, y: 0.9, z: 0 } }),
    },
  );
  manager.setSpawnModifiers(threatModifiers(level));
  physics.step();
  cleanup.push(() => {
    manager.dispose();
    projectiles.dispose();
    physics.free();
  });
  const spawn = (id: string) => {
    const enemy = manager.spawn(id, { x: 8, y: 0, z: 8 });
    const stats = (enemy as unknown as { stats: Stats }).stats;
    return { stats, health: damage.health(enemy.id)! };
  };
  return { spawn };
}

describe('Poziom zagrożenia: wrogowie w EnemyManager', () => {
  it('poziom 0 zostawia statystyki bez zmian', () => {
    const { stats, health } = setup(0).spawn('assaulter');
    expect(stats.get('maxHealth')).toBe(60);
    expect(stats.get('damage')).toBe(15);
    expect(health.current).toBe(60);
  });
  it('poziom 3 zwiększa obrażenia i startuje z pełnym, większym HP', () => {
    const def = threatLevelDef(3);
    const base = setup(0).spawn('assaulter');
    const boosted = setup(3).spawn('assaulter');
    expect(boosted.stats.get('damage')).toBeGreaterThan(
      base.stats.get('damage'),
    );
    expect(boosted.stats.get('damage')).toBeCloseTo(15 * (1 + def.enemyDamage));
    expect(boosted.health.max).toBeCloseTo(60 * (1 + def.enemyHealth));
    expect(boosted.health.current).toBe(boosted.health.max);
    expect(boosted.health.current).toBeGreaterThan(base.health.current);
  });
  it('maxHealth wroga rośnie monotonicznie z poziomem 0–10', () => {
    let previous = 0;
    for (const def of threatLevels) {
      const { health } = setup(def.level).spawn('gunner');
      expect(health.max).toBeGreaterThanOrEqual(previous);
      expect(health.current).toBe(health.max);
      previous = health.max;
    }
  });
  it('boss dostaje modyfikatory i pełne zwiększone HP', () => {
    const def = threatLevelDef(3);
    const base = setup(0).spawn('securityChief');
    const boosted = setup(3).spawn('securityChief');
    expect(boosted.health.max).toBeCloseTo(900 * (1 + def.enemyHealth));
    expect(boosted.health.current).toBe(boosted.health.max);
    expect(boosted.health.max).toBeGreaterThan(base.health.max);
    expect(
      boosted.stats.modifiers('damage').some((m) => m.source === 'threat:3'),
    ).toBe(true);
  });
});

describe('Poziom zagrożenia: pokój (RoomScene)', () => {
  it('boss w pokoju z run.threatLevel 3 ma powiększone, pełne HP', async () => {
    const idle: InputSnapshot = {
      held: new Set(),
      pressed: new Set(),
      released: new Set(),
      lookDelta: { x: 0, y: 0 },
    };
    const run: RunState = {
      seed: 'threat-room',
      sectorId: 'test',
      loadoutId: 'classic',
      loadout: loadoutDefinitions.get('classic')!,
      talents: [],
      threatLevel: 3,
      startedAtMs: 0,
      elapsedS: 0,
      map: {
        sectorId: 'test',
        layers: [[{ id: 'boss', layer: 8, index: 0, type: 'boss', next: [] }]],
      },
      currentNodeId: 'boss',
      visited: [],
      hp: 100,
      energy: 50,
      credits: 0,
      implants: [],
      stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
    };
    const scene = new RoomScene(
      roomDefinitions.get('bossRoom')!,
      run,
      {
        id: 'room:boss',
        firstBreakS: 0,
        breakS: 0,
        maxAlive: 8,
        minSpawnDistance: 0,
        spawnPoints: [],
        waves: [],
      },
      { loadModels: false },
    );
    await scene.init(
      {
        bus: new EventBus(),
        commands: new CommandRegistry(),
        rng: new Rng('threat-room'),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: structuredClone(tuning),
        debug: false,
      },
      new ThreeScene(),
    );
    cleanup.push(() => scene.dispose());
    scene.step(SIM_DT, idle);
    expect(scene.query('boss')).toMatchObject({
      hp: expect.closeTo(900 * (1 + threatLevelDef(3).enemyHealth), 5),
    });
  });
});
