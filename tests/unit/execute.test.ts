import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import {
  ExecuteSystem,
  type ExecuteEnemy,
} from '../../src/combat/melee/execute';
import { StatusSystem } from '../../src/combat/status';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { Rng } from '../../src/core/rng';
import { EnemyManager } from '../../src/enemies/manager';
import { initPhysics } from '../../src/physics';
import { createEnemyView } from '../../src/enemies/views';

function setup() {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const owner = entities.create('player', 'player');
  const player = new Health(() => 100);
  player.set(50);
  const t = structuredClone(tuning);
  const enemies: ExecuteEnemy[] = [];
  const statuses = new StatusSystem(bus, damage, {
    targets: () => enemies.map((e) => e.id),
    position: () => null,
  });
  const addEnergy = vi.fn();
  const heal = vi.fn((amount: number) => player.heal(amount));
  const castWall = vi.fn<() => number | null>(() => null);
  const system = new ExecuteSystem({
    bus,
    damage,
    owner,
    tuning: t,
    statuses,
    enemies: () => enemies,
    aim: () => ({ origin: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 } }),
    addEnergy,
    heal,
    castWall,
  });
  damage.register(owner, player, {
    invulnerable: () => system.invulnerable(),
    outgoing: () => 1.25,
  });
  const spawn = (
    kind = 'trooper',
    hp = 25,
    position = { x: 0, y: 1, z: -2 },
  ) => {
    const id = entities.create(kind, 'enemy');
    const health = new Health(() => 100);
    health.set(hp);
    damage.register(id, health);
    enemies.push({ id, kind, position });
    return { id, health };
  };
  return {
    bus,
    entities,
    damage,
    owner,
    player,
    t,
    enemies,
    statuses,
    addEnergy,
    heal,
    castWall,
    system,
    spawn,
  };
}

describe('wykończenia', () => {
  it('próg HP, niższy próg elity, status stunned; boss i martwy nigdy', () => {
    const f = setup();
    const edge = f.spawn();
    const above = f.spawn('trooper', 26);
    const elite = f.spawn('executor', 15);
    f.spawn('executor', 16);
    const boss = f.spawn('boss', 1);
    f.spawn('trooper', 0);
    f.system.step(1 / 60);
    expect(f.system.readyIds()).toEqual([edge.id, elite.id]);
    f.statuses.apply(above.id, { id: 'stunned', durationS: 1 }, f.owner);
    f.statuses.apply(boss.id, { id: 'stunned', durationS: 1 }, f.owner);
    f.system.step(1 / 60);
    expect(f.system.readyIds()).toEqual([edge.id, elite.id, above.id]);
    f.statuses.step(1);
    f.system.step(1 / 60);
    expect(f.system.readyIds()).toEqual([edge.id, elite.id]);
  });

  it('emituje tylko zmiany, w tym utratę gotowości, śmierć i despawn', () => {
    const f = setup();
    const enemy = f.spawn();
    const changed = vi.fn();
    f.bus.on('enemy_executable', changed);
    f.system.step(0);
    expect(changed).not.toHaveBeenCalled();
    f.system.step(0.1);
    f.system.step(0.1);
    expect(changed).toHaveBeenCalledExactlyOnceWith({
      id: enemy.id,
      ready: true,
    });
    enemy.health.set(30);
    f.system.step(0.1);
    expect(changed).toHaveBeenLastCalledWith({ id: enemy.id, ready: false });
    enemy.health.set(10);
    f.system.step(0.1);
    f.enemies.length = 0;
    f.system.step(0.1);
    expect(changed).toHaveBeenCalledTimes(4);
    expect(f.system.readyIds()).toEqual([]);
  });

  it('wyklucza oba rodzaje nietykalności i sprawdza stan ponownie przy ataku', () => {
    const f = setup();
    const enemy = f.spawn();
    let protectedNow = true;
    f.damage.register(enemy.id, enemy.health, {
      invulnerable: () => protectedNow,
      invulnMs: () => 200,
    });
    f.system.step(0.1);
    expect(f.system.readyIds()).toEqual([]);
    protectedNow = false;
    f.damage.deal(enemy.id, { amount: 1, source: f.owner, tags: ['#melee'] });
    f.system.step(0.1);
    expect(f.system.readyIds()).toEqual([]);
    f.damage.step(0.2);
    f.system.step(0.1);
    expect(f.system.readyIds()).toEqual([enemy.id]);
    protectedNow = true;
    expect(f.system.tryExecute()).toBe(false);
    expect(f.addEnergy).not.toHaveBeenCalled();
  });

  it.each([
    { x: 0, y: 1, z: -2.81 },
    { x: 2, y: 1, z: -1 },
    { x: 0, y: 1, z: 1 },
  ])('poza stożkiem/zasięgiem nic nie robi: %j', (position) => {
    const f = setup();
    const enemy = f.spawn('trooper', 25, position);
    const performed = vi.fn();
    f.bus.on('execute_performed', performed);
    expect(f.system.tryExecute()).toBe(false);
    expect(enemy.health.current).toBe(25);
    expect(f.addEnergy).not.toHaveBeenCalled();
    expect(f.heal).not.toHaveBeenCalled();
    expect(performed).not.toHaveBeenCalled();
    expect(f.system.invulnerable()).toBe(false);
  });

  it('zabija, nagradza, emituje feedback i chroni gracza przez executeInvulnS', () => {
    const f = setup();
    const enemy = f.spawn();
    const performed = vi.fn(),
      stop = vi.fn(),
      slow = vi.fn(),
      shake = vi.fn(),
      dealt = vi.fn();
    f.bus.on('execute_performed', performed);
    f.bus.on('hitstop', stop);
    f.bus.on('slowmo', slow);
    f.bus.on('camera_shake', shake);
    f.bus.on('damage_dealt', dealt);
    f.system.step(0.01);
    expect(f.system.tryExecute()).toBe(true);
    expect(enemy.health.dead).toBe(true);
    expect(f.system.readyIds()).toEqual([]);
    expect(f.addEnergy).toHaveBeenCalledExactlyOnceWith(20);
    expect(f.heal).toHaveBeenCalledExactlyOnceWith(6);
    expect(f.player.current).toBe(56);
    expect(performed).toHaveBeenCalledExactlyOnceWith({
      attacker: f.owner,
      target: enemy.id,
      point: { x: 0, y: 1, z: -2 },
    });
    expect(dealt).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ['#melee', '#execute'],
        source: f.owner,
        knockback: 10,
        dir: { x: 0, y: 0, z: -1 },
      }),
    );
    expect(stop).toHaveBeenCalledExactlyOnceWith({ ms: 110 });
    expect(slow).toHaveBeenCalledExactlyOnceWith({
      timeScale: 0.35,
      durationS: 0.3,
    });
    expect(shake).toHaveBeenCalledWith(
      expect.objectContaining({ intensity: 0.6 }),
    );
    const hurt = () =>
      f.damage.deal(f.owner, { amount: 10, source: null, tags: [] });
    expect(hurt()).toBe(0);
    f.system.step(0);
    f.system.step(f.t.melee.executeInvulnS - 0.01);
    expect(hurt()).toBe(0);
    f.system.step(0.011);
    expect(hurt()).toBe(10);
    expect(f.system.tryExecute()).toBe(false);
    expect(f.addEnergy).toHaveBeenCalledTimes(1);
  });

  it('wybiera najbliższego osi wzroku, a przy remisie bliższego gracza', () => {
    const f = setup();
    const offAxis = f.spawn('trooper', 20, { x: 0.2, y: 1, z: -1 });
    const onAxis = f.spawn('trooper', 20, { x: 0, y: 1, z: -2.8 });
    expect(f.system.targetId()).toBe(onAxis.id);
    expect(f.system.tryExecute()).toBe(true);
    expect(offAxis.health.dead).toBe(false);
    const far = f.spawn('trooper', 20, { x: 0, y: 1, z: -2.7 });
    const near = f.spawn('trooper', 20, { x: 0, y: 1, z: -2 });
    expect(f.system.targetId()).toBe(near.id);
    expect(far.health.dead).toBe(false);
  });

  it('ściana, martwy gracz i dispose uniemożliwiają wykonanie', () => {
    const f = setup();
    f.spawn();
    f.castWall.mockReturnValue(1);
    expect(f.system.tryExecute()).toBe(false);
    f.castWall.mockReturnValue(null);
    f.player.set(0);
    expect(f.system.tryExecute()).toBe(false);
    f.player.reset();
    f.system.step(0.1);
    f.system.dispose();
    f.system.step(0.1);
    expect(f.system.readyIds()).toEqual([]);
    expect(f.system.tryExecute()).toBe(false);
  });
});

describe('obrona wrogów i znacznik', () => {
  beforeAll(async () => {
    await initPhysics();
  });
  it.each(['shielder', 'executor'])(
    '%s: blokuje lekki, ginie od wykończenia',
    async (kind) => {
      const rapier = await initPhysics();
      const f = setup();
      const world = new rapier.World({ x: 0, y: 0, z: 0 });
      const manager = new EnemyManager(
        { bus: f.bus, tuning: f.t, rng: new Rng('execute-guard') },
        {
          world,
          entities: f.entities,
          damage: f.damage,
          hurtboxes: new Hurtboxes(),
          statuses: f.statuses,
          getTarget: () => ({ id: f.owner, position: { x: 0, y: 1, z: 0 } }),
        },
      );
      const enemy = manager.spawn(kind, { x: 0, y: 0, z: -2 });
      const health = f.damage.health(enemy.id)!;
      health.set(health.max * 0.1);
      f.enemies.push({ id: enemy.id, kind, position: { x: 0, y: 1, z: -2 } });
      const view = createEnemyView(enemy, false);
      try {
        expect(
          f.damage.deal(enemy.id, {
            amount: health.current,
            source: f.owner,
            tags: ['#melee'],
            dir: { x: 0, y: 0, z: -1 },
          }),
        ).toBe(0);
        f.system.step(0.01);
        expect(f.system.readyIds()).toContain(enemy.id);
        view.setExecutable?.(true, 0.1, 3);
        expect(view.root.getObjectByName('executeMarker')?.visible).toBe(true);
        expect(f.system.tryExecute()).toBe(true);
        expect(health.dead).toBe(true);
        // Świeży wróg zachowuje gotową gardę/parowanie.
        const fresh = manager.spawn(kind, { x: 0, y: 0, z: -2 });
        const freshHealth = f.damage.health(fresh.id)!;
        freshHealth.set(freshHealth.max * 0.1);
        f.enemies.push({ id: fresh.id, kind, position: { x: 0, y: 1, z: -2 } });
        expect(f.system.tryExecute()).toBe(true);
        expect(freshHealth.dead).toBe(true);
        view.setExecutable?.(false, 0.1, 3);
        expect(view.root.getObjectByName('executeMarker')?.visible).toBe(false);
      } finally {
        view.dispose();
        manager.dispose();
        f.statuses.dispose();
        f.system.dispose();
        world.free();
      }
    },
  );
});
