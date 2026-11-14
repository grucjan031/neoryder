import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ColliderDesc,
  Ray,
  RigidBodyDesc,
  RigidBodyType,
} from '@dimforge/rapier3d-compat';
import type { RigidBody } from '@dimforge/rapier3d-compat';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { PlayerEnergy } from '../../src/combat/powers/energy';
import { GrabPower } from '../../src/combat/powers/grab';
import type { PowerInput } from '../../src/combat/powers/power';
import {
  createPower,
  loadPower,
  powerDefinitions,
} from '../../src/combat/powers/registry';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import type { Vec3 } from '../../src/core/math';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import raw from '../../src/data/powers/grab.json';
import sceneRaw from '../../src/data/scenes/grabTest.json';
import { EnemyManager } from '../../src/enemies/manager';
import { enemyDefinitions } from '../../src/enemies/registry';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { GrabPhysics } from '../../src/physics/grabPhysics';

const press: PowerInput = { pressed: true, held: true, released: false };
const hold: PowerInput = { pressed: false, held: true, released: false };
const release: PowerInput = { pressed: false, held: false, released: true };
const idle: PowerInput = { pressed: false, held: false, released: false };
let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
  vi.restoreAllMocks();
});

function setup(overrides: Partial<typeof raw> = {}) {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const world = new rapier.World({ x: 0, y: tuning.physics.gravity, z: 0 });
  world.createCollider(
    ColliderDesc.cuboid(50, 0.5, 50)
      .setTranslation(0, -0.5, 0)
      .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
  );
  const owner = entities.create('player', 'player');
  damage.register(owner, new Health(() => 1000));
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
  let target: { id: number; position: Vec3 } | null = null;
  let stunRemaining = 0;
  const manager = new EnemyManager(
    { bus, rng: new Rng('grab-test'), tuning },
    {
      world,
      entities,
      damage,
      hurtboxes,
      projectiles,
      getTarget: () => target,
      statuses: {
        has: (_id, status) => status === 'stunned' && stunRemaining > 0,
        remaining: (_id, status) => (status === 'stunned' ? stunRemaining : 0),
        stacks: () => 0,
      },
    },
    { director: sceneRaw.director },
  );
  const physics = new GrabPhysics(world, entities, () => manager.grabTargets());
  let origin = { x: 0, y: 1.7, z: 0 };
  let dir = { x: 0, y: 0, z: -1 };
  const deps = {
    owner,
    bus,
    tuning,
    damage,
    energy,
    aim: () => ({ origin, dir }),
    targets: () => [],
    grab: physics,
    castWall: (from: Vec3, forward: Vec3, max: number) =>
      world.castRay(
        new Ray(from, forward),
        max,
        true,
        undefined,
        interactionGroups(0xffff, CollisionGroup.World),
      )?.timeOfImpact ?? null,
  };
  const def = loadPower({ ...raw, ...overrides });
  if (def.kind !== 'grab') throw new Error('Nieprawidłowy kind testu.');
  const power = new GrabPower(def, deps);
  const denials: GameEvents['power_denied'][] = [];
  const hits: GameEvents['damage_dealt'][] = [];
  bus.on('power_denied', (event) => denials.push(event));
  bus.on('damage_dealt', (event) => hits.push(event));
  const objects: { id: number; body: RigidBody; unregister(): void }[] = [];
  const box = (position: Vec3, massKg = 10) => {
    const id = entities.create('crate', 'neutral');
    const body = world.createRigidBody(
      RigidBodyDesc.dynamic().setTranslation(
        position.x,
        position.y,
        position.z,
      ),
    );
    const collider = world.createCollider(
      ColliderDesc.cuboid(0.4, 0.4, 0.4)
        .setMass(massKg)
        .setCollisionGroups(interactionGroups(CollisionGroup.Debris, 0xffff)),
      body,
    );
    entities.bindCollider(id, collider.handle);
    const object = {
      id,
      body,
      unregister: physics.registerObject(id, body, massKg),
    };
    objects.push(object);
    return object;
  };
  const wall = (z: number) =>
    world.createCollider(
      ColliderDesc.cuboid(10, 5, 0.1)
        .setTranslation(0, 5, z)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
  const tick = (input: PowerInput = idle, dt = SIM_DT, playerDt = dt) => {
    power.step(playerDt, input, dt);
    if (!(dt > 0)) return;
    manager.step(dt);
    world.timestep = dt;
    world.step();
    manager.captureControlled();
    projectiles.step(dt);
  };
  const run = (frames: number, input = idle) => {
    for (let i = 0; i < frames; i++) tick(input);
  };
  cleanup.push(() => {
    power.reset();
    manager.dispose();
    for (const object of objects) object.unregister();
    energy.dispose();
    projectiles.dispose();
    world.free();
  });
  return {
    bus,
    entities,
    owner,
    damage,
    world,
    manager,
    energy,
    physics,
    power,
    deps,
    denials,
    hits,
    box,
    wall,
    tick,
    run,
    setStun: (seconds: number) => {
      stunRemaining = seconds;
    },
    aim: (from: Vec3, forward: Vec3) => {
      origin = from;
      dir = forward;
    },
    enableAi: () => {
      target = { id: owner, position: { x: 0, y: 0.9, z: 0 } };
    },
  };
}

describe('Chwyt — dane, wybór celu i odmowy', () => {
  it('rejestruje kind grab i waliduje dane', () => {
    const c = setup();
    expect(createPower('grab', c.deps)).toBeInstanceOf(GrabPower);
    expect(powerDefinitions.get('grab')).toEqual(raw);
    for (const field of [
      'rangeM',
      'maxMassKg',
      'maxHoldS',
      'holdDistanceM',
      'throwSpeed',
      'landingSpeedMps',
    ])
      expect(() => loadPower({ ...raw, [field]: 0 })).toThrow();
    expect(() => loadPower({ ...raw, aimConeDeg: 361 })).toThrow();
    expect(() => loadPower({ ...raw, drainPerS: -1 })).toThrow();
  });

  it('wybiera najbliższy cel w stożku, zamiast celu najbliższego osi, i pomija zasięg/plecy', () => {
    const c = setup();
    c.box({ x: 0, y: 1.7, z: -8 });
    const nearest = c.box({ x: 0.6, y: 1.7, z: -4 });
    c.box({ x: 3, y: 1.7, z: -2 });
    c.box({ x: 0, y: 1.7, z: 2 });
    c.box({ x: 0, y: 1.7, z: -20 });
    c.world.step();
    c.tick(press);
    expect(c.power.heldTarget).toBe(nearest.id);
    expect(c.energy.current).toBe(100 - raw.cost);
    expect(c.power.cooldownRemaining).toBe(0);
  });

  it('nie chwyta przez ścianę i nie pobiera kosztu', () => {
    const c = setup();
    c.box({ x: 0, y: 1.7, z: -5 });
    c.wall(-3);
    c.world.step();
    c.tick(press);
    expect(c.denials.at(-1)?.reason).toBe('out_of_range');
    expect(c.energy.current).toBe(100);
    expect(c.power.active).toBe(false);
  });

  it.each(['executor', 'crate', 'absent', 'far'])(
    'odmawia %s bez kosztu i odnowienia',
    (kind) => {
      const c = setup();
      if (kind === 'executor')
        c.manager.spawn('executor', { x: 0, y: 0, z: -4 });
      if (kind === 'crate') c.box({ x: 0, y: 1.7, z: -4 }, raw.maxMassKg + 1);
      if (kind === 'far') c.box({ x: 0, y: 1.7, z: -raw.rangeM - 1 });
      c.world.step();
      c.tick(press);
      expect(c.denials.at(-1)?.reason).toBe(
        ['executor', 'crate'].includes(kind) ? 'too_heavy' : 'out_of_range',
      );
      expect(c.energy.current).toBe(100);
      expect(c.power.cooldownRemaining).toBe(0);
    },
  );

  it('dane wskazują pięć lekkich archetypów i ciężkiego Egzekutora', () => {
    for (const id of ['assaulter', 'gunner', 'sniper', 'drone', 'shielder'])
      expect(enemyDefinitions.get(id)?.grabbable).toBe(true);
    expect(enemyDefinitions.get('executor')?.grabbable).toBe(false);
  });

  it('nie omija bliższej ciężkiej skrzyni na rzecz dalszego lekkiego celu', () => {
    const c = setup();
    c.box({ x: 0, y: 1.7, z: -3 }, 200);
    c.box({ x: 0, y: 1.7, z: -6 }, 10);
    c.world.step();
    c.tick(press);
    expect(c.denials.at(-1)?.reason).toBe('too_heavy');
    expect(c.energy.current).toBe(100);
  });

  it('brak energii odmawia chwytu, a samo trzymanie klawisza nie ponawia próby', () => {
    const c = setup();
    c.box({ x: 0, y: 1.7, z: -3 });
    c.world.step();
    c.energy.set(raw.cost - 1);
    c.tick(press);
    expect(c.denials.at(-1)?.reason).toBe('no_energy');
    expect(c.energy.current).toBe(raw.cost - 1);
    c.energy.set(100);
    c.tick(hold);
    expect(c.power.heldTarget).toBeNull();
    c.tick(press);
    expect(c.power.heldTarget).not.toBeNull();
  });
});

describe('Chwyt — trzymanie, czas gracza i zwalnianie', () => {
  it('prowadzi ciało kinematycznie przed kamerą, obraca punkt trzymania i drenuje energię', () => {
    const c = setup();
    const box = c.box({ x: 0, y: 1.7, z: -5 });
    c.world.step();
    c.tick(press);
    expect(box.body.bodyType()).toBe(RigidBodyType.KinematicPositionBased);
    expect(box.body.translation().z).toBeCloseTo(-raw.holdDistanceM);
    c.aim({ x: 2, y: 3, z: 0 }, { x: 1, y: 0, z: 0 });
    c.tick(hold);
    expect(box.body.translation()).toMatchObject({
      x: 2 + raw.holdDistanceM,
      y: 3,
      z: 0,
    });
    expect(c.energy.current).toBeCloseTo(
      100 - raw.cost - raw.drainPerS * SIM_DT,
    );
    c.power.step(0, hold);
    expect(c.energy.current).toBeCloseTo(
      100 - raw.cost - raw.drainPerS * SIM_DT,
    );
    expect(c.power.beam).not.toBeNull();
  });

  it('prowadzenie kinematyczne zatrzymuje cel przed ścianą', () => {
    const c = setup();
    const box = c.box({ x: 0, y: 1.7, z: -5 });
    c.world.step();
    c.tick(press);
    c.wall(-4);
    c.world.step();
    c.aim({ x: 0, y: 1.7, z: -4 }, { x: 0, y: 0, z: -1 });
    c.tick(hold);
    expect(box.body.translation().z).toBeGreaterThan(-4);
  });

  it.each(['assaulter', 'gunner', 'sniper', 'drone', 'shielder'])(
    'wstrzymuje AI i oddaje token %s',
    (kind) => {
      const c = setup({ aimConeDeg: 360 });
      c.enableAi();
      const enemy = c.manager.spawn(kind, { x: 0, y: 0, z: -1.4 });
      c.world.step();
      c.manager.step(SIM_DT);
      const token = ['assaulter', 'shielder'].includes(kind) ? 'melee' : 'shot';
      c.manager.director!.requestToken(enemy.id, token);
      expect(c.manager.director!.snapshot().tokens[token]).toContain(enemy.id);
      c.tick(press);
      expect(enemy.current.controlled).toBe(true);
      expect(enemy.current.position.z).toBeCloseTo(-raw.holdDistanceM);
      expect(c.manager.director!.snapshot().tokens[token]).not.toContain(
        enemy.id,
      );
      const fired = vi.fn();
      c.bus.on('projectile_spawned', fired);
      c.run(30, hold);
      expect(enemy.current.state).toBe('idle');
      expect(enemy.current.position.z).toBeCloseTo(-raw.holdDistanceM);
      expect(fired).not.toHaveBeenCalled();
      expect(c.manager.director!.snapshot().tokens[token]).not.toContain(
        enemy.id,
      );
      c.power.reset();
      expect(enemy.current.controlled).toBe(false);
    },
  );

  it.each(['energy', 'timeout'])(
    'puszcza bez rzutu po %s, zaczyna odnowienie i wraca do AI po lądowaniu',
    (reason) => {
      const c = setup({ maxHoldS: 0.1 });
      const enemy = c.manager.spawn('assaulter', { x: 0, y: 0, z: -4 });
      c.world.step();
      c.tick(press);
      if (reason === 'energy') c.energy.set(0);
      c.run(reason === 'energy' ? 1 : 6, hold);
      const body = enemy.grabTarget!().body;
      expect(c.power.active).toBe(false);
      expect(c.power.beam).toBeNull();
      expect(c.power.cooldownRemaining).toBeCloseTo(raw.cooldownS);
      expect(body.isDynamic()).toBe(true);
      expect(body.linvel().z).toBe(0);
      c.run(120);
      expect(enemy.current.controlled).toBe(false);
      expect(body.bodyType()).toBe(RigidBodyType.KinematicPositionBased);
      expect(c.hits).toEqual([]);
    },
  );

  it('buforuje puszczenie w hitstopie i rzuca tylko raz po wznowieniu', () => {
    const c = setup();
    const box = c.box({ x: 0, y: 1.7, z: -4 });
    c.world.step();
    const released = vi.fn();
    c.bus.on('power_released', released);
    c.power.step(0, press);
    c.power.step(0, release);
    expect(c.energy.current).toBe(100);
    c.tick(idle);
    expect(c.power.active).toBe(false);
    expect(box.body.isDynamic()).toBe(true);
    expect(box.body.linvel().z).toBeCloseTo(-raw.throwSpeed);
    c.tick(idle);
    expect(released).toHaveBeenCalledTimes(1);
  });

  it('usuwa także oczekujący token dyrektora przy przejęciu', () => {
    const c = setup();
    const holder = c.manager.spawn('assaulter', { x: 4, y: 0, z: -4 });
    const waiting = c.manager.spawn('assaulter', { x: 0, y: 0, z: -4 });
    c.manager.director!.requestToken(holder.id, 'melee');
    c.manager.director!.requestToken(waiting.id, 'melee');
    expect(c.manager.director!.snapshot().waiting.melee).toContain(waiting.id);
    c.world.step();
    c.tick(press);
    expect(c.power.heldTarget).toBe(waiting.id);
    expect(c.manager.director!.snapshot().waiting.melee).not.toContain(
      waiting.id,
    );
    expect(c.manager.director!.snapshot().tokens.melee).not.toContain(
      waiting.id,
    );
  });

  it('lądowanie na czarnej skrzyni zwalnia AI bez obrażeń za sam kontakt ze skrzynią', () => {
    const c = setup();
    const enemy = c.manager.spawn('assaulter', { x: 0, y: 0, z: -4 });
    const platform = c.world.createRigidBody(
      RigidBodyDesc.fixed().setTranslation(0, 0.4, -3),
    );
    c.world.createCollider(
      ColliderDesc.cuboid(2, 0.4, 2).setCollisionGroups(
        interactionGroups(CollisionGroup.Debris, 0xffff),
      ),
      platform,
    );
    c.world.step();
    c.tick(press);
    c.energy.set(0);
    c.tick(hold);
    c.run(120);
    expect(enemy.current.controlled).toBe(false);
    expect(enemy.grabTarget!().body.isKinematic()).toBe(true);
    expect(c.hits).toHaveLength(0);
  });

  it('zwalnia chwyt natychmiast po śmierci lub despawnie celu', () => {
    const c = setup();
    const enemy = c.manager.spawn('assaulter', { x: 0, y: 0, z: -4 });
    c.world.step();
    c.tick(press);
    c.damage.deal(enemy.id, {
      source: c.owner,
      amount: 1000,
      tags: ['#debug'],
    });
    expect(c.power.heldTarget).toBeNull();
    expect(c.power.beam).toBeNull();
    expect(enemy.current.controlled).toBe(false);
    c.power.reset();
    const box = c.box({ x: 0, y: 1.7, z: -3 });
    c.world.step();
    c.tick(press);
    c.entities.destroy(box.id);
    expect(c.power.heldTarget).toBeNull();
    expect(box.body.isDynamic()).toBe(true);
  });

  it('reset przywraca ciała, CCD i przejęcia oraz odłącza subskrypcje', () => {
    const c = setup({ cooldownS: 0 });
    const box = c.box({ x: 0, y: 1.7, z: -4 });
    c.world.step();
    c.tick(press);
    c.tick(release);
    expect(box.body.isCcdEnabled()).toBe(true);
    const enemy = c.manager.spawn('shielder', { x: 0, y: 0, z: -4 });
    c.world.step();
    c.tick(press);
    expect(enemy.current.controlled).toBe(true);
    c.power.reset();
    expect(enemy.current.controlled).toBe(false);
    expect(box.body.isCcdEnabled()).toBe(false);
    expect(c.power.cooldownRemaining).toBe(0);
    const restore = vi.spyOn(box.body, 'setBodyType');
    c.bus.emit('player_died', { id: c.owner });
    c.bus.emit('enemy_killed', { id: enemy.id, killer: c.owner, tags: [] });
    expect(restore).not.toHaveBeenCalled();
  });

  it('śmierć gracza opuszcza cel i wyłącza obrażenia wszystkich lotów', () => {
    const c = setup();
    const enemy = c.manager.spawn('assaulter', { x: 0, y: 0, z: -4 });
    c.world.step();
    c.tick(press);
    c.bus.emit('player_died', { id: c.owner });
    expect(c.power.heldTarget).toBeNull();
    expect(enemy.grabTarget!().body.isDynamic()).toBe(true);
    c.run(120);
    expect(enemy.current.controlled).toBe(false);
    expect(c.hits).toHaveLength(0);
  });
});

describe('Chwyt — rzut i pojedyncze obrażenia uderzenia', () => {
  it('rzuca w kierunku celowania, odnowienie biegnie od puszczenia, wróg i trafiony cel tracą HP raz', () => {
    const c = setup();
    const thrown = c.manager.spawn('assaulter', { x: 0, y: 0, z: -4 });
    const victim = c.manager.spawn('shielder', { x: 0, y: 0, z: -6 });
    c.world.step();
    c.tick(press);
    c.run(10, hold);
    expect(c.power.cooldownRemaining).toBe(0);
    c.tick(release);
    expect(thrown.grabTarget!().body.linvel().z).toBeCloseTo(-raw.throwSpeed);
    expect(c.power.cooldownRemaining).toBe(raw.cooldownS);
    c.run(120);
    const hits = c.hits.filter((hit) => hit.tags.includes('#grab'));
    expect(hits.map((hit) => hit.target).sort()).toEqual(
      [thrown.id, victim.id].sort(),
    );
    for (const hit of hits) {
      expect(hit.source).toBe(c.owner);
      expect(hit.amount).toBe(raw.impactDamage);
      expect(hit.tags).toEqual(['#power', '#grab']);
    }
    expect(thrown.current.controlled).toBe(false);
    expect(thrown.grabTarget!().body.bodyType()).toBe(
      RigidBodyType.KinematicPositionBased,
    );
  });

  it('ściana rani rzucanego wroga raz, późniejsze lądowanie nie powtarza obrażeń', () => {
    const c = setup();
    const enemy = c.manager.spawn('assaulter', { x: 0, y: 0, z: -4 });
    c.wall(-6);
    c.world.step();
    c.tick(press);
    c.tick(release);
    c.run(150);
    expect(c.hits).toHaveLength(1);
    expect(c.hits[0]?.target).toBe(enemy.id);
    expect(c.hits[0]?.amount).toBe(raw.impactDamage);
    expect(enemy.current.controlled).toBe(false);
  });

  it.each(['assaulter', 'drone'])(
    'skrzynia rani trafiony cel %s, nie potrzebując własnego Health',
    (kind) => {
      const c = setup();
      if (kind === 'drone')
        c.aim({ x: 0, y: 2.6, z: 0 }, { x: 0, y: 0, z: -1 });
      const box = c.box({ x: 0, y: 1.7, z: -4 });
      const victim = c.manager.spawn(kind, { x: 0, y: 0, z: -6 });
      c.world.step();
      c.tick(press);
      expect(c.power.heldTarget).toBe(box.id);
      c.tick(release);
      c.run(120);
      expect(c.hits).toHaveLength(1);
      expect(c.hits[0]?.target).toBe(victim.id);
      expect(box.body.isDynamic()).toBe(true);
      expect(box.body.isCcdEnabled()).toBe(false);
    },
  );

  it('prędkość poniżej progu nie zadaje obrażeń, a reset usuwa oczekujące trafienia', () => {
    const c = setup({ minImpactSpeed: 1000 });
    const enemy = c.manager.spawn('assaulter', { x: 0, y: 0, z: -4 });
    c.wall(-5);
    c.world.step();
    c.tick(press);
    c.tick(release);
    c.run(120);
    expect(c.hits).toHaveLength(0);
    c.power.reset();
    expect(enemy.current.controlled).toBe(false);
    c.run(120);
    expect(c.hits).toHaveLength(0);
  });

  it('śmierć rzucanego od uderzenia nie przerywa obrażeń trafionego wroga', () => {
    const c = setup({ impactDamage: 1000 });
    const thrown = c.manager.spawn('assaulter', { x: 0, y: 0, z: -4 });
    const victim = c.manager.spawn('shielder', { x: 0, y: 0, z: -6 });
    c.world.step();
    c.tick(press);
    c.tick(release);
    c.run(30);
    expect(c.hits.map((hit) => hit.target).sort()).toEqual(
      [thrown.id, victim.id].sort(),
    );
    expect(c.hits.every((hit) => hit.killed)).toBe(true);
    expect(thrown.current.controlled).toBe(false);
  });
});

describe('F2-09 — regresje przeglądu zewnętrznego', () => {
  it('1: Dron upuszczony stycznie do ściany wychodzi z marginesu skinM', () => {
    const c = setup({ aimConeDeg: 360 });
    const drone = c.manager.spawn('drone', { x: 0, y: 0, z: -4 });
    c.aim({ x: 0, y: 0.4, z: 0 }, { x: 0, y: 0, z: -1 });
    c.world.step();
    c.tick(press);
    c.wall(-3.45);
    c.world.step();
    c.energy.set(0);
    c.tick(hold);
    c.run(180);
    expect(drone.current.controlled).toBe(false);
    expect(drone.current.position.y).toBeCloseTo(2.6, 1);
  });
  it('1: Dron po rzucie w ścianę ląduje i wraca na pułap oraz do ruchu AI', () => {
    const c = setup({ impactDamage: 1 });
    c.enableAi();
    const drone = c.manager.spawn('drone', { x: 0, y: 0, z: -4 });
    c.wall(-5);
    c.aim({ x: 0, y: 1, z: 0 }, { x: 0, y: 0.3, z: -1 });
    c.world.step();
    c.tick(press);
    c.aim({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 });
    c.tick(release);
    let landed = false;
    for (let i = 0; i < 600; i++) {
      c.tick();
      if (!drone.current.controlled) landed = true;
    }
    expect(landed).toBe(true);
    expect(drone.current.position.y).toBeCloseTo(2.6, 1);
    expect(drone.current.distance).toBeGreaterThan(2);
  });

  it('2: pierwszy krok rzutu trafia bliski sensor Drona, także przy początkowym nakładaniu', () => {
    const c = setup({ throwSpeed: 150 });
    c.aim({ x: 0, y: 2.6, z: 0 }, { x: 0, y: 0, z: -1 });
    c.box({ x: 0, y: 2.6, z: -2 });
    const victim = c.manager.spawn('drone', { x: 0, y: 0, z: -3.6 });
    c.world.step();
    c.tick(press);
    c.tick(release);
    expect(c.hits.some((hit) => hit.target === victim.id)).toBe(true);
  });

  it('3: poziomy rzut po podłodze nie rani rzucanego i nie kończy szybkiego lotu', () => {
    const c = setup();
    c.aim({ x: 0, y: 0.9, z: 0 }, { x: 0, y: 0, z: -1 });
    const enemy = c.manager.spawn('assaulter', { x: 0, y: 0, z: -4 });
    c.world.step();
    c.tick(press);
    c.tick(release);
    c.run(3);
    expect(c.hits).toHaveLength(0);
    expect(enemy.current.controlled).toBe(true);
    expect(enemy.current.position.z).toBeLessThan(-3.5);
  });

  it('3: chwyt i puszczenie z hitstopu rzucają z punktu trzymania', () => {
    const c = setup();
    const box = c.box({ x: 0, y: 1.7, z: -8 });
    c.world.step();
    c.power.step(0, press);
    c.power.step(0, release);
    c.tick();
    expect(box.body.translation().z).toBeCloseTo(
      -raw.holdDistanceM - raw.throwSpeed * SIM_DT,
      1,
    );
  });

  it('4: przy równoczesnym kontakcie ze światem i wrogiem trafia wroga', () => {
    const c = setup();
    c.box({ x: 0, y: 1.7, z: -4 });
    const victim = c.manager.spawn('shielder', { x: 8, y: 0, z: -8 });
    c.world.step();
    c.tick(press);
    c.tick(release);
    const contact = {
      impact: true,
      point: { x: 0, y: 1, z: -3 },
      normalY: 0,
      normal: { x: 0, y: 0, z: 1 },
    };
    vi.spyOn(c.physics, 'contacts').mockReturnValue([
      { ...contact, enemy: null },
      { ...contact, enemy: victim.id },
    ]);
    c.tick();
    expect(c.hits.some((hit) => hit.target === victim.id)).toBe(true);
  });

  it('5: w Skupieniu lot sprawdza dt świata, drenaż nadal dt gracza', () => {
    const c = setup();
    c.box({ x: 0, y: 1.7, z: -4 });
    c.world.step();
    const sweep = vi.spyOn(c.physics, 'sweep');
    c.tick(press);
    c.tick(hold, SIM_DT * 0.3, SIM_DT);
    expect(c.energy.current).toBeCloseTo(
      100 - raw.cost - raw.drainPerS * SIM_DT,
    );
    c.tick(release, SIM_DT * 0.3, SIM_DT);
    c.tick(idle, SIM_DT * 0.3, SIM_DT);
    expect(sweep).toHaveBeenCalled();
    expect(sweep.mock.calls.at(-1)?.[2]).toBeCloseTo(SIM_DT * 0.3);
  });

  it('6: puszczenie bez chwytu i kolejki nie rzuca późniejszego chwytu', () => {
    const c = setup();
    c.box({ x: 0, y: 1.7, z: -4 });
    c.world.step();
    c.power.step(0, release);
    c.power.step(0, press);
    c.tick(hold);
    expect(c.power.active).toBe(true);
  });

  it.each(['energy', 'timeout'])(
    '7: puszczenie wygrywa z końcem %s',
    (reason) => {
      const c = setup({ maxHoldS: SIM_DT });
      const box = c.box({ x: 0, y: 1.7, z: -4 });
      c.world.step();
      c.tick(press);
      if (reason === 'energy') c.energy.set(0);
      c.tick(release);
      expect(box.body.linvel().z).toBeCloseTo(-raw.throwSpeed);
    },
  );

  it.each(['assaulter', 'gunner', 'drone'])(
    '8: obrażenia ciężkie nie przełączają controlled %s',
    (kind) => {
      const c = setup({ aimConeDeg: 360 });
      const enemy = c.manager.spawn(kind, { x: 0, y: 0, z: -4 });
      c.world.step();
      c.tick(press);
      c.damage.deal(enemy.id, {
        source: c.owner,
        amount: 1,
        tags: ['#heavy'],
        knockback: 10,
        dir: { x: 1, y: 0, z: 0 },
      });
      expect(enemy.current.state).toBe('idle');
      c.setStun(2);
      c.power.reset();
      expect(enemy.current.state).toBe('stunned');
    },
  );

  it('8: controlled Egzekutor nie paruje', () => {
    const c = setup();
    const enemy = c.manager.spawn('executor', { x: 0, y: 0, z: -4 });
    enemy.grabTarget!().setControlled!(true);
    expect(
      c.damage.deal(enemy.id, { source: c.owner, amount: 1, tags: ['#melee'] }),
    ).toBe(1);
  });

  it('9: punkt chwytu pozostaje po stronie oka cienkiej ściany i poza kapsułą gracza', () => {
    const c = setup();
    const box = c.box({ x: 0, y: 1.7, z: -4 });
    c.world.step();
    c.tick(press);
    c.wall(-2);
    c.world.step();
    c.tick(hold);
    expect(box.body.translation().z).toBeGreaterThan(-2);
    expect(Math.abs(box.body.translation().z)).toBeGreaterThan(
      tuning.player.capsuleRadius + 0.4,
    );
  });

  it('10: sensor Drona nie omija limitu masy', () => {
    const c = setup({ aimConeDeg: 360, maxMassKg: 0.01 });
    c.manager.spawn('drone', { x: 0, y: 0, z: -4 });
    c.world.step();
    c.tick(press);
    expect(c.denials.at(-1)?.reason).toBe('too_heavy');
    expect(c.energy.current).toBe(100);
  });

  it('10: limit i ciało Drona używają jawnej masy z danych', () => {
    const c = setup({ aimConeDeg: 360, maxMassKg: 4 });
    const drone = c.manager.spawn('drone', { x: 0, y: 0, z: -4 });
    expect(drone.grabTarget!().massKg).toBe(
      enemyDefinitions.get('drone')!.drone!.massKg,
    );
    expect(drone.grabTarget!().body.mass()).toBeCloseTo(5);
    c.world.step();
    c.tick(press);
    expect(c.denials.at(-1)?.reason).toBe('too_heavy');
  });

  it('9: brak miejsca przed kapsułą gracza zwalnia chwyt zamiast wpychać cel w gracza', () => {
    const c = setup();
    const playerBody = c.world.createRigidBody(
      RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 0),
    );
    const player = c.world.createCollider(
      ColliderDesc.capsule(0.55, 0.35).setCollisionGroups(
        interactionGroups(CollisionGroup.Player, 0xffff),
      ),
      playerBody,
    );
    c.entities.bindCollider(c.owner, player.handle);
    const box = c.box({ x: 0, y: 1.7, z: -4 });
    c.world.step();
    c.tick(press);
    c.wall(-0.7);
    c.world.step();
    c.tick(hold);
    expect(c.power.active).toBe(false);
    const contact = player.contactCollider(box.body.collider(0), 0);
    expect(contact === null || contact.distance >= 0).toBe(true);
  });

  it('11: inna instancja Chwytu nie przejmuje controlled wroga', () => {
    const c = setup();
    c.manager.spawn('assaulter', { x: 0, y: 0, z: -4 });
    c.world.step();
    c.tick(press);
    const other = new GrabPower(c.power.def, c.deps);
    cleanup.unshift(() => other.reset());
    other.step(SIM_DT, press);
    expect(other.active).toBe(false);
  });

  it('12: hitstop zrównuje snapshoty wiązki', () => {
    const c = setup();
    c.box({ x: 0, y: 1.7, z: -4 });
    c.world.step();
    c.tick(press);
    c.aim({ x: 1, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 });
    c.tick(hold);
    c.tick(hold, 0);
    expect(c.power.beam?.previous).toEqual(c.power.beam?.current);
  });
});
