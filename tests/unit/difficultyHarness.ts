import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import {
  BLOCK_SOURCE,
  DamageSystem,
  Health,
  Hurtboxes,
} from '../../src/combat/damage';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import type { Vec3 } from '../../src/core/math';
import { EnemyManager } from '../../src/enemies/manager';
import type { Enemy } from '../../src/enemies/types';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import {
  difficulties,
  type DifficultyId,
  type DifficultyProfile,
} from '../../src/world/difficulty';

/** Gra sprzed zmian: mnożniki 1, tokeny pokoju, wszystkie taktyki wyłączone. */
export const baselineProfile: DifficultyProfile = {
  ...difficulties.normal,
  health: 1,
  damage: 1,
  count: 1,
  maxAlive: 1,
  telegraph: 1,
  accuracy: 1,
  spread: 1,
  burstBreak: 1,
  attackTokens: 3,
  shotTokens: 2,
  flankChance: 0,
  coverUse: 0,
  groupAttack: 0,
  heavyDodgeChance: 0,
  dashDodgeChance: 0,
};
import { loadWaves, WaveDirector } from '../../src/world/waves';

export async function difficultyArena(
  difficulty: DifficultyId,
  seed = 'difficulty',
  block = false,
  profile?: DifficultyProfile,
) {
  const rapier = await initPhysics();
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const t = structuredClone(tuning);
  const world = new rapier.World({ x: 0, y: t.physics.gravity, z: 0 });
  const obstacle = (position: Vec3, size: Vec3) =>
    world.createCollider(
      ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
        .setTranslation(position.x, position.y, position.z)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
  obstacle({ x: 0, y: -0.5, z: 0 }, { x: 60, y: 1, z: 60 });
  const player = entities.create('player', 'player');
  const position = { x: 0, y: 0.9, z: 0 };
  const body = world.createRigidBody(
    RigidBodyDesc.kinematicPositionBased().setTranslation(
      position.x,
      position.y,
      position.z,
    ),
  );
  const collider = world.createCollider(
    ColliderDesc.capsule(0.55, 0.35).setCollisionGroups(
      interactionGroups(CollisionGroup.Player, 0xffff),
    ),
    body,
  );
  hurtboxes.add(player, collider);
  entities.bindCollider(player, collider.handle);
  const health = new Health(() => 100000);
  const stats = new Stats({ damageTaken: 1 });
  if (block)
    stats.add({
      stat: 'damageTaken',
      type: 'mult',
      value: 0.3,
      source: BLOCK_SOURCE,
    });
  damage.register(player, health, { stats });
  const projectiles = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    t,
  );
  let yaw = 0;
  const manager = new EnemyManager(
    { bus, rng: new Rng(seed), tuning: t },
    {
      world,
      entities,
      damage,
      hurtboxes,
      projectiles,
      getTarget: () => ({ id: player, position, yaw }),
    },
    {
      difficulty,
      ...(profile ? { profile } : {}),
      director: {
        attackTokens: 3,
        shotTokens: 2,
        maxHoldS: 4,
        reassignS: 1,
        probeHeightM: 1,
        slots: {
          melee: { count: 8, offsetDeg: 0 },
          shot: { count: 8, offsetDeg: 22.5 },
        },
      },
    },
  );
  const enemies: Enemy[] = [];
  const spawn = (kind: string, point: Vec3) => {
    const enemy = manager.spawn(kind, point);
    enemies.push(enemy);
    return enemy;
  };
  const trace: unknown[] = [];
  let time = 0;
  bus.on('enemy_telegraph', (event) => trace.push({ time, ...event }));
  bus.on('damage_dealt', (event) => trace.push({ time, ...event }));
  let waves: WaveDirector | undefined;
  const step = (n = 1, dt = SIM_DT) => {
    for (let i = 0; i < n; i++) {
      time += dt;
      damage.step(dt);
      waves?.step(dt);
      manager.step(dt);
      if (dt > 0) {
        world.timestep = dt;
        world.step();
        projectiles.step(dt);
      }
    }
  };
  world.step();
  return {
    bus,
    world,
    damage,
    manager,
    enemies,
    health,
    player,
    position,
    projectiles,
    trace,
    t,
    obstacle,
    spawn,
    step,
    face: (value: number) => {
      yaw = value;
    },
    startWave() {
      waves = new WaveDirector(
        loadWaves({
          id: 'difficulty-sim',
          firstBreakS: 0,
          breakS: 1,
          maxAlive: 12,
          minSpawnDistance: 3,
          spawnPoints: Array.from({ length: 12 }, (_, i) => ({
            x: Math.sin((i * Math.PI) / 6) * 9,
            z: Math.cos((i * Math.PI) / 6) * 9,
          })),
          waves: [
            {
              spawnIntervalS: 0.15,
              groups: [
                { enemy: 'assaulter', count: 6 },
                { enemy: 'gunner', count: 2 },
              ],
            },
          ],
        }),
        {
          spawn: (kind, point) => spawn(kind, point).id,
          playerPosition: () => position,
        },
        bus,
        new Rng(seed).fork('waves'),
      );
      waves.start();
      return waves;
    },
    dispose() {
      waves?.dispose();
      manager.dispose();
      projectiles.dispose();
      world.free();
    },
  };
}
