import { beforeAll, expect, it } from 'vitest';
import { DamageSystem, Hurtboxes } from '../../src/combat/damage';
import { PlayerEnergy } from '../../src/combat/powers/energy';
import { createPower } from '../../src/combat/powers/registry';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { FeelSystem } from '../../src/core/feel';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { EnemyManager } from '../../src/enemies/manager';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';

let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});

function travel(focused: boolean, freeze: boolean) {
  // Izoluj skalę poziomego ruchu od zależnego od dt docisku kapsuły do podłoża.
  const settings = structuredClone(tuning);
  settings.physics.gravity = 0;
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const world = new rapier.World({ x: 0, y: tuning.physics.gravity, z: 0 });
  world.createCollider(
    rapier.ColliderDesc.cuboid(30, 0.5, 30)
      .setTranslation(0, -0.5, 0)
      .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
  );
  const owner = entities.create('player', 'player');
  const energy = new PlayerEnergy(
    owner,
    new Stats({ maxEnergy: 100, energyRegen: 0 }),
    bus,
    tuning,
  );
  const projectiles = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    tuning,
  );
  const manager = new EnemyManager(
    { bus, rng: new Rng('focus-world'), tuning: settings },
    {
      world,
      entities,
      hurtboxes,
      damage,
      projectiles,
      getTarget: () => ({ id: owner, position: { x: 0, y: 0.9, z: 20 } }),
    },
  );
  const enemy = manager.spawn('assaulter', { x: 0, y: 0, z: 0 });
  world.step();
  // Rozpocznij pościg przed pomiarem dystansu, bez wliczania przejścia idle → chase.
  manager.step(SIM_DT);
  world.step();
  const startZ = enemy.current.position.z;
  const projectile = projectiles.spawn({
    owner,
    team: 'player',
    origin: { x: 10, y: 4, z: 0 },
    dir: { x: 0, y: 0, z: 1 },
    speed: 5,
    damage: 1,
    tags: ['#gun'],
    lifetimeS: 10,
  });
  const power = createPower('focus', {
    owner,
    bus,
    damage,
    energy,
    tuning,
    aim: () => ({ origin: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 } }),
    targets: () => [],
    castWall: () => null,
  });
  let playerElapsed = 0;
  const loop = new GameLoop({
    step(dt) {
      const playerDt = feel.playerDt(dt);
      playerElapsed += playerDt;
      power.step(playerDt, { pressed: false, held: false, released: false });
      manager.step(dt);
      if (dt > 0) {
        world.timestep = dt;
        world.step();
      }
      projectiles.step(dt);
    },
    render() {},
  });
  const feel = new FeelSystem(bus, loop, tuning);
  if (focused)
    power.step(SIM_DT, { pressed: true, held: true, released: false });
  if (freeze) bus.emit('hitstop', { ms: 1000 });
  for (let frame = 0; frame < 60; frame++) {
    loop.advance(SIM_DT * 1000);
    feel.update(SIM_DT);
  }
  let projectileZ = 0;
  projectiles.forEachActive((id, position) => {
    if (id === projectile) projectileZ = position.z;
  });
  const result = {
    enemyM: enemy.current.position.z - startZ,
    projectileM: projectileZ,
    playerElapsed,
    energy: energy.current,
  };
  power.reset();
  manager.dispose();
  projectiles.dispose();
  energy.dispose();
  feel.dispose();
  world.free();
  return result;
}

it('moc Skupienia: w 1 s rzeczywistej wróg i pocisk Rapier pokonują 0,3 dystansu, czas gracza bez zmian', () => {
  const plain = travel(false, false);
  const focused = travel(true, false);
  expect(plain.enemyM).toBeGreaterThan(3);
  expect(focused.enemyM).toBeCloseTo(plain.enemyM * 0.3, 2);
  expect(focused.projectileM).toBeCloseTo(plain.projectileM * 0.3, 6);
  expect(focused.playerElapsed).toBeCloseTo(plain.playerElapsed, 6);
});

it('hitstop w prawdziwej pętli zatrzymuje wroga, pocisk i odpływ energii Skupienia', () => {
  const frozen = travel(true, true);
  expect(frozen.enemyM).toBe(0);
  expect(frozen.projectileM).toBe(0);
  expect(frozen.playerElapsed).toBe(0);
  expect(frozen.energy).toBe(80);
});
