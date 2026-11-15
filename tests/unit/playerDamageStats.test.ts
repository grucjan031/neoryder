import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import { EventBus } from '../../src/core/events';
import { EntityRegistry } from '../../src/core/entities';
import type { Action, InputSnapshot } from '../../src/core/input';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { ResourcePool } from '../../src/core/resource';
import { Rng } from '../../src/core/rng';
import type { RunState } from '../../src/core/runTypes';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { DamageSystem } from '../../src/combat/damage';
import { plasmaBladeDefinition } from '../../src/combat/melee/bladeSchema';
import { PlasmaBlade } from '../../src/combat/melee/plasmaBlade';
import { Weapon } from '../../src/combat/weapons/weapon';
import { blasterDefinition } from '../../src/combat/weapons/weaponSchema';
import type { EnemyManager } from '../../src/enemies/manager';
import { loadImplant } from '../../src/progression/implantSchema';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { RoomScene } from '../../src/scenes/roomScene';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { roomDefinitions } from '../../src/world/rooms';
import { loadWaves } from '../../src/world/waves';
import wavesData from '../../src/data/waves/roomTest.json';

const input = (held: Action[] = [], pressed: Action[] = []): InputSnapshot => ({
  held: new Set(held),
  pressed: new Set(pressed),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});
const aim = { origin: { x: 0, y: 1.6, z: 0 }, dir: { x: 0, y: 0, z: -1 } };

function bladeFixture(speed?: number) {
  const bus = new EventBus();
  const stats = new Stats({ attackSpeed: 1 });
  if (speed !== undefined)
    stats.add({
      stat: 'attackSpeed',
      type: 'mult',
      value: speed,
      source: 'test',
    });
  const blade = new PlasmaBlade(
    plasmaBladeDefinition,
    {
      owner: 1,
      team: 'player',
      stats,
      ...(speed === undefined
        ? {}
        : { attackSpeed: () => stats.get('attackSpeed') }),
      damage: new DamageSystem(bus, new EntityRegistry(bus)),
      energy: new ResourcePool({ max: () => 100, regenPerS: () => 0 }),
      queryArc: () => [],
      aim: () => aim,
      projectiles: { reflect: vi.fn() },
    },
    bus,
    structuredClone(tuning),
  );
  return blade;
}

describe('attackSpeed', () => {
  it.each([undefined, 1.25, 10, 0])(
    'skaluje każdą fazę lekką i ciężką, speed=%s',
    (speed) => {
      const blade = bladeFixture(speed);
      const multiplier =
        speed === undefined
          ? 1
          : Math.max(
              tuning.melee.attackSpeedMin,
              Math.min(tuning.melee.attackSpeedMax, speed),
            );
      for (const heavy of [false, true]) {
        blade.reset();
        blade.step(SIM_DT, input(['attack'], ['attack']));
        if (heavy) {
          for (let i = 0; i < 40; i++) blade.step(SIM_DT, input(['attack']));
          expect(blade.view().charge).toBe(1);
          blade.step(0, input());
        }
        const m = tuning.melee;
        const durations = heavy
          ? [m.heavyWindupS, m.heavyActiveS, m.heavyRecoveryS]
          : [m.lightWindupS, m.lightActiveS, m.lightRecoveryS];
        let total = 0;
        for (const [index, phase] of (
          ['windup', 'active', 'recovery'] as const
        ).entries()) {
          expect(blade.view().phase).toBe(phase);
          const duration =
            (durations[index]! * plasmaBladeDefinition.timeScale) / multiplier;
          blade.step(duration / 2, input());
          expect(blade.view().phaseT).toBeCloseTo(0.5);
          blade.step(duration / 2 + 1e-10, input());
          total += duration;
        }
        expect(blade.view().state).toBe('idle');
        expect(total).toBeCloseTo(
          (durations.reduce((a, b) => a + b, 0) *
            plasmaBladeDefinition.timeScale) /
            multiplier,
        );
      }
      blade.dispose();
    },
  );

  it.each([1, 1.25, 10])(
    'nie zmienia okna parowania ani ładowania ciężkiego: %s',
    (speed) => {
      const blade = bladeFixture(speed);
      const hit = {
        projectile: 3,
        owner: 2,
        target: 1,
        team: 'enemy' as const,
        point: aim.origin,
        dir: { x: 0, y: 0, z: 1 },
        speed: 10,
      };
      blade.step(SIM_DT, input(['block']));
      blade.step(tuning.melee.parryWindowMs / 1000 - 0.001, input(['block']));
      expect(blade.interceptProjectile(hit)).toBe(true);
      blade.step(0.002, input(['block']));
      expect(blade.interceptProjectile(hit)).toBe(false);
      blade.reset();
      blade.step(SIM_DT, input(['attack'], ['attack']));
      for (let i = 0; i < 20; i++) blade.step(SIM_DT, input(['attack']));
      expect(blade.view().state).toBe('charging');
      expect(blade.view().charge).toBeCloseTo(
        (21 * SIM_DT) / tuning.melee.heavyChargeS,
      );
      blade.dispose();
    },
  );

  it.each([undefined, 1.25, 10, 0])(
    'skraca odstęp strzałów, zachowuje ciepło na strzał: %s',
    (speed) => {
      const stats = new Stats({
        heatCapacity: 1000,
        coolingRate: 0,
        attackSpeed: speed ?? 1,
      });
      const spawn = vi.fn();
      const weapon = new Weapon(
        1,
        {
          bus: new EventBus(),
          rng: new Rng('speed'),
          tuning: structuredClone(tuning),
        },
        stats,
        {
          projectiles: { spawn },
          ...(speed === undefined
            ? {}
            : { attackSpeed: () => stats.get('attackSpeed') }),
        },
        { ...blasterDefinition, automatic: true },
      );
      const multiplier =
        speed === undefined
          ? 1
          : Math.max(
              tuning.melee.attackSpeedMin,
              Math.min(tuning.melee.attackSpeedMax, speed),
            );
      const interval = 1 / blasterDefinition.fireRateHz / multiplier;
      const fire = { ...aim, triggerHeld: true };
      weapon.step(SIM_DT, fire);
      weapon.step(interval - 0.001, fire);
      expect(spawn).toHaveBeenCalledTimes(1);
      weapon.step(0.001, fire);
      expect(spawn).toHaveBeenCalledTimes(2);
      expect(weapon.heat.current).toBe(2 * blasterDefinition.heatPerShot);
    },
  );
});

const scenes = new Set<RoomScene>();
afterEach(() => {
  for (const scene of scenes) scene.dispose();
  scenes.clear();
  vi.restoreAllMocks();
});

async function roomDamage(kind: 'blade' | 'gun' | 'push', boosted: boolean) {
  const implant = loadImplant({
    id: 'damageTest',
    name: 'Test',
    rarity: 'common',
    tags: [],
    modifiers: [{ stat: 'damage', type: 'percent', value: 0.15 }],
  });
  const run: RunState = {
    seed: 'damage-test',
    sectorId: 'test',
    loadoutId: 'classic',
    loadout: loadoutDefinitions.get('classic')!,
    talents: [],
    threatLevel: 0,
    startedAtMs: 0,
    elapsedS: 0,
    map: {
      sectorId: 'test',
      layers: [[{ id: 'node', layer: 2, index: 0, type: 'combat', next: [] }]],
    },
    currentNodeId: 'node',
    visited: [],
    hp: 100,
    energy: 100,
    credits: 0,
    implants: boosted ? [implant.id] : [],
    stats: { kills: 0, damage: { melee: 0, gun: 0, power: 0, other: 0 } },
  };
  const room = roomDefinitions.get('combatYard')!;
  const scene = new RoomScene(
    room,
    run,
    loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
    { loadModels: false, implantDefinitions: new Map([[implant.id, implant]]) },
  );
  const bus = new EventBus();
  const commands = new CommandRegistry();
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng(run.seed),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
    },
    new ThreeScene(),
  );
  scenes.add(scene);
  // Publiczne komendy spawnu umieszczają cel poza zasięgiem ostrza; test wybiera bliski cel.
  const manager = Reflect.get(scene, 'manager') as EnemyManager;
  const enemy = manager.spawn('gunner', {
    x: room.playerSpawn.x,
    y: 0,
    z: room.playerSpawn.z - 1.5,
  });
  scene.step(SIM_DT, input());
  let amount = 0;
  bus.on('damage_dealt', (event) => {
    if (event.target === enemy.id && amount === 0) amount = event.amount;
  });
  if (kind === 'gun') commands.execute('hold gun');
  const action = kind === 'push' ? 'power' : 'attack';
  scene.step(SIM_DT, input([action], [action]));
  for (let i = 0; i < 60 && amount === 0; i++) scene.step(SIM_DT, input());
  scene.dispose();
  scenes.delete(scene);
  return amount;
}

it.each(['blade', 'gun', 'push'] as const)(
  'pokój headless: implant damage wzmacnia %s o 15 procent',
  async (kind) => {
    const baseline = await roomDamage(kind, false);
    const boosted = await roomDamage(kind, true);
    expect(baseline).toBeGreaterThan(0);
    expect(boosted).toBeCloseTo(baseline * 1.15);
  },
);
