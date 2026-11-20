import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { BarrierPower } from '../../src/combat/powers/barrier';
import { PlayerEnergy } from '../../src/combat/powers/energy';
import type { PowerInput } from '../../src/combat/powers/power';
import { createPower, loadPower } from '../../src/combat/powers/registry';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { Vec3 } from '../../src/core/math';
import { SIM_DT } from '../../src/core/loop';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import data from '../../src/data/powers/barrier.json';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { BarrierRenderer } from '../../src/render/barrierRenderer';

const idle: PowerInput = { pressed: false, held: false, released: false };
const press: PowerInput = { ...idle, pressed: true, held: true };
let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()));

function setup(shooterPos: Vec3 = { x: 2, y: 1, z: -6 }) {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const world = new rapier.World({ x: 0, y: 0, z: 0 });
  const add = (team: 'player' | 'enemy', position: Vec3) => {
    const id = entities.create(team, team);
    const health = new Health(() => 100);
    damage.register(id, health);
    const collider = world.createCollider(
      rapier.ColliderDesc.ball(0.35)
        .setTranslation(position.x, position.y, position.z)
        .setCollisionGroups(
          interactionGroups(
            team === 'player' ? CollisionGroup.Player : CollisionGroup.Enemy,
            0xffff,
          ),
        ),
    );
    hurtboxes.add(id, collider);
    return { id, health };
  };
  const player = add('player', { x: 0, y: 1, z: 0 });
  const shooter = add('enemy', shooterPos);
  world.step();
  const energy = new PlayerEnergy(
    player.id,
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
  const remove = vi.fn();
  const register = projectiles.addInterceptor.bind(projectiles);
  vi.spyOn(projectiles, 'addInterceptor').mockImplementation((fn) => {
    const off = register(fn);
    return () => {
      remove();
      off();
    };
  });
  let targets = [{ id: shooter.id, position: shooterPos }];
  const power = createPower('barrier', {
    owner: player.id,
    bus,
    damage,
    energy,
    tuning,
    projectiles,
    aim: () => ({ origin: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 } }),
    targets: () => targets,
    castWall: () => null,
  }) as BarrierPower;
  const reflected = vi.fn();
  const hits = vi.fn();
  bus.on('projectile_reflected', reflected);
  bus.on('damage_dealt', hits);
  const fire = () =>
    projectiles.spawn({
      owner: shooter.id,
      team: 'enemy',
      origin: shooterPos,
      dir: { x: -shooterPos.x, y: 0, z: -shooterPos.z },
      speed: 10,
      damage: 12,
      tags: ['#gun'],
      lifetimeS: 4,
    });
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
      power.step(SIM_DT, idle);
      projectiles.step(SIM_DT);
    }
  };
  cleanup.push(() => {
    power.reset();
    energy.dispose();
    projectiles.dispose();
    world.free();
  });
  return {
    bus,
    entities,
    power,
    energy,
    projectiles,
    reflected,
    hits,
    player,
    shooter,
    fire,
    run,
    remove,
    removeShooter: () => {
      targets = [];
    },
  };
}

describe('Bariera — rzeczywiste pociski Rapier', () => {
  it.each([
    { angle: 90, reflects: false },
    { angle: data.arcDeg / 2, reflects: true },
  ])('kąt $angle°: odbicie = $reflects', ({ angle, reflects }) => {
    const rad = (angle * Math.PI) / 180;
    const c = setup({ x: Math.sin(rad) * 6, y: 1, z: -Math.cos(rad) * 6 });
    c.power.step(SIM_DT, press);
    c.fire();
    c.run(0.7);
    expect(c.reflected).toHaveBeenCalledTimes(reflects ? 1 : 0);
    expect(c.player.health.current).toBe(reflects ? 100 : 88);
  });

  it.each([false, true])(
    'ignoruje wciśnięcie na granicy wygaśnięcia (kolejka: %s)',
    (queued) => {
      const c = setup();
      const denied = vi.fn();
      const used = vi.fn();
      c.bus.on('power_denied', denied);
      c.bus.on('power_used', used);
      c.power.step(SIM_DT, press);
      c.run(data.durationS - SIM_DT);
      if (queued) c.power.step(0, press);
      c.power.step(SIM_DT, queued ? idle : press);
      expect(c.power.active).toBe(false);
      expect(c.energy.current).toBe(100 - data.cost);
      expect(c.projectiles.addInterceptor).toHaveBeenCalledTimes(1);
      expect(c.remove).toHaveBeenCalledTimes(1);
      expect(used).toHaveBeenCalledTimes(1);
      expect(denied).not.toHaveBeenCalled();
    },
  );

  it('reflect czyści trafione cele i odnawia pierwotny lifetimeS', () => {
    const c = setup({ x: 0, y: 1, z: -6 });
    const id = c.projectiles.spawn({
      owner: c.player.id,
      team: 'player',
      origin: { x: 0, y: 1, z: -4 },
      dir: { x: 0, y: 0, z: -1 },
      speed: 10,
      damage: 12,
      tags: ['#gun'],
      lifetimeS: 0.4,
      pierce: { count: 3, falloff: 0 },
    });
    c.run(0.3);
    expect(c.shooter.health.current).toBe(88);
    c.projectiles.reflect(id, c.player.id, 'player', { x: 0, y: 0, z: 1 });
    c.run(0.3);
    expect(c.shooter.health.current).toBe(76);
    expect(c.projectiles.activeCount).toBe(1);
    c.run(0.12);
    expect(c.projectiles.activeCount).toBe(0);
  });
  it('waliduje dane i odbija z przodu do strzelca jako pocisk gracza, pobierając energię', () => {
    const c = setup();
    expect(c.power).toBeInstanceOf(BarrierPower);
    expect(c.power.def).toEqual(data);
    for (const patch of [
      { arcDeg: 0 },
      { arcDeg: 361 },
      { durationS: 0 },
      { costPerReflect: -1 },
    ])
      expect(() => loadPower({ ...data, ...patch })).toThrow();
    c.power.step(SIM_DT, press);
    expect(c.energy.current).toBe(100 - data.cost);
    const id = c.fire();
    c.run(0.7);
    expect(c.reflected).toHaveBeenCalledExactlyOnceWith({
      id,
      newOwner: c.player.id,
    });
    expect(c.entities.team(id)).toBe('player');
    expect(c.energy.current).toBe(100 - data.cost - data.costPerReflect);
    expect(c.power.reflectionFlashS).toBeGreaterThan(0);
    c.run(0.7);
    expect(c.player.health.current).toBe(100);
    expect(c.shooter.health.current).toBe(88);
    expect(c.hits).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: c.player.id,
        target: c.shooter.id,
        amount: 12,
      }),
    );
  });

  it('przepuszcza pocisk z tyłu bez kosztu odbicia', () => {
    const c = setup({ x: 0, y: 1, z: 6 });
    c.power.step(SIM_DT, press);
    c.fire();
    c.run(0.7);
    expect(c.reflected).not.toHaveBeenCalled();
    expect(c.player.health.current).toBe(88);
    expect(c.energy.current).toBe(100 - data.cost);
    expect(c.power.active).toBe(true);
  });

  it('odczepia interceptor po durationS i przy resecie; kolejne pociski trafiają', () => {
    const c = setup();
    c.power.step(SIM_DT, press);
    c.run(data.durationS - SIM_DT);
    expect(c.power.active).toBe(true);
    c.power.step(SIM_DT, idle);
    expect(c.power.active).toBe(false);
    expect(c.remove).toHaveBeenCalledTimes(1);
    c.fire();
    c.run(0.7);
    expect(c.player.health.current).toBe(88);
    expect(c.reflected).not.toHaveBeenCalled();
    c.power.reset();
    c.power.step(SIM_DT, press);
    c.power.reset();
    expect(c.remove).toHaveBeenCalledTimes(2);
    expect(c.power.active).toBe(false);
  });

  it('brak energii na kolejne odbicie gasi Barierę i przepuszcza bieżący pocisk', () => {
    const c = setup();
    c.energy.set(data.cost + data.costPerReflect);
    c.power.step(SIM_DT, press);
    c.fire();
    c.run(0.7);
    expect(c.energy.current).toBe(0);
    expect(c.reflected).toHaveBeenCalledTimes(1);
    c.fire();
    c.run(0.7);
    expect(c.power.active).toBe(false);
    expect(c.player.health.current).toBe(88);
    expect(c.remove).toHaveBeenCalledTimes(1);
    expect(c.reflected).toHaveBeenCalledTimes(1);
  });

  it('wyczerpana Bariera zdejmująca się w trakcie trafienia nie pomija kolejnych interceptorów', () => {
    const c = setup();
    c.energy.set(data.cost);
    c.power.step(SIM_DT, press);
    const later = vi.fn(() => true);
    c.projectiles.addInterceptor(later);
    c.fire();
    c.run(0.7);
    expect(later).toHaveBeenCalled();
  });

  it('ponowne wciśnięcie jest ignorowane, a hitstop nie odlicza czasu', () => {
    const c = setup();
    const denied = vi.fn();
    c.bus.on('power_denied', denied);
    c.power.step(SIM_DT, press);
    c.power.step(0, press);
    c.power.step(SIM_DT, idle);
    expect(c.energy.current).toBe(100 - data.cost);
    expect(c.projectiles.addInterceptor).toHaveBeenCalledTimes(1);
    expect(denied).not.toHaveBeenCalled();
    c.power.step(0, idle);
    expect(c.power.active).toBe(true);
  });

  it('przy braku strzelca odbija przeciwnie do lotu; wybuch obszarowy omija Barierę', () => {
    const c = setup();
    c.power.step(SIM_DT, press);
    c.removeShooter();
    c.fire();
    c.run(0.7);
    expect(c.reflected).toHaveBeenCalledTimes(1);
    c.projectiles.forEachActive((_id, _pos, dir, team) => {
      const length = Math.hypot(2, 6);
      expect(dir.x).toBeCloseTo(2 / length);
      expect(dir.y).toBeCloseTo(0);
      expect(dir.z).toBeCloseTo(-6 / length);
      expect(team).toBe('player');
    });
    c.projectiles.spawn({
      owner: c.shooter.id,
      team: 'enemy',
      origin: { x: 0, y: 2, z: 0 },
      dir: { x: 0, y: 1, z: 0 },
      speed: 0,
      damage: 0,
      tags: ['#gun'],
      lifetimeS: SIM_DT,
      explode: { radiusM: 2, damage: 20, tags: ['#explosion'] },
    });
    c.projectiles.step(SIM_DT);
    expect(c.player.health.current).toBe(80);
    expect(c.reflected).toHaveBeenCalledTimes(1);
  });

  it('renderer czyta stan, pokazuje cyjanowy płat i błysk, znika przy końcu', () => {
    const c = setup();
    const renderer = new BarrierRenderer(tuning);
    cleanup.push(() => renderer.dispose());
    const pose = {
      position: { x: 0, y: 1, z: 0 },
      yaw: 0,
      pitch: 0,
      roll: 0,
      fov: 90,
    };
    renderer.render(c.power, pose);
    expect(renderer.root.visible).toBe(false);
    c.power.step(SIM_DT, press);
    renderer.render(c.power, pose);
    expect(renderer.root.visible).toBe(true);
    const mesh = renderer.root.children[0] as import('three').Mesh<
      import('three').CylinderGeometry,
      import('three').MeshBasicMaterial
    >;
    expect(mesh.material.color.getHexString()).toBe('00e5ff');
    expect(mesh.material.opacity).toBe(tuning.vfx.barrierOpacity);
    c.fire();
    c.run(0.7);
    const flash = c.power.reflectionFlashS;
    renderer.render(c.power, pose);
    expect(mesh.material.opacity).toBeGreaterThan(tuning.vfx.barrierOpacity);
    renderer.render(c.power, pose);
    expect(c.power.reflectionFlashS).toBe(flash);
    c.power.reset();
    renderer.render(c.power, pose);
    expect(renderer.root.visible).toBe(false);
  });
});
