import { afterEach, expect, it, vi } from 'vitest';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { Scene as ThreeScene } from 'three';
import { RoomScene } from '../../src/scenes/roomScene';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import type { RunState } from '../../src/core/runTypes';
import type { InputSnapshot } from '../../src/core/input';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { enemyDefinitions } from '../../src/enemies/registry';
import { roomDefinitions } from '../../src/world/rooms';
import { loadRoom } from '../../src/world/roomSchema';
import type { WavesDefinition } from '../../src/world/waves';
import { CommandRegistry } from '../../src/ui/debugCommands';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const active = new Set<RoomScene>();
const noWaves: WavesDefinition = {
  id: 'room:boss',
  firstBreakS: 0,
  breakS: 0,
  maxAlive: 8,
  minSpawnDistance: 0,
  spawnPoints: [],
  waves: [],
};

function runState(): RunState {
  return {
    seed: 'boss-room',
    sectorId: 'test',
    loadoutId: 'classic',
    loadout: loadoutDefinitions.get('classic')!,
    talents: [],
    threatLevel: 0,
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
}

async function setup(bus = new EventBus()) {
  const scene = new RoomScene(
    roomDefinitions.get('bossRoom')!,
    runState(),
    noWaves,
    { loadModels: false },
  );
  const commands = new CommandRegistry();
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('boss-room').fork('room:boss'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
    },
    new ThreeScene(),
  );
  active.add(scene);
  const steps = (n: number) => {
    for (let i = 0; i < n; i++) scene.step(SIM_DT, idle);
  };
  return { scene, commands, bus, steps };
}

afterEach(() => {
  for (const scene of active) scene.dispose();
  active.clear();
  vi.restoreAllMocks();
});

it('pokój bossa przechodzi walidację: typ boss, tylko drzwi entry, boss z danych wskazuje archetyp boss', () => {
  const room = roomDefinitions.get('bossRoom')!;
  expect(room.type).toBe('boss');
  expect(room.doors.map((door) => door.role)).toEqual(['entry']);
  expect(room.bossEnemy).toBe('securityChief');
  expect(enemyDefinitions.get(room.bossEnemy!)?.kind).toBe('boss');
  expect(room.spawnPoints).toHaveLength(6);
  expect(() => loadRoom({ ...room, type: 'combat' })).toThrow(/bossEnemy/);
});

it('boss pojawia się po wejściu, bez WaveDirector; room_cleared dopiero po śmierci bossa, a słudzy giną razem z nim', async () => {
  const bus = new EventBus();
  const spawned = vi.fn(),
    cleared = vi.fn(),
    entered = vi.fn(),
    killed = vi.fn(),
    waves = vi.fn();
  bus.on('boss_spawned', spawned);
  bus.on('room_cleared', cleared);
  bus.on('room_entered', entered);
  bus.on('enemy_killed', killed);
  bus.on('wave_started', waves);
  const { scene, commands, steps } = await setup(bus);
  expect(entered).toHaveBeenCalledOnce();
  expect(spawned).toHaveBeenCalledExactlyOnceWith({
    id: expect.any(Number),
    name: 'Dyrektor Ochrony Kurogane Arms',
    maxHealth: 900,
    phaseThresholds: [0.65, 0.3],
  });
  expect(scene.query('boss')).toMatchObject({
    phase: 1,
    hp: 900,
    shield: 0,
    minions: 0,
  });
  expect(scene.query('enemies')).toBe(1);
  expect(scene.query('doors')).toEqual({
    entry: { role: 'entry', open: false },
  });
  commands.execute('god');
  steps(240);
  expect(scene.query('phase')).toBe('stopped');
  expect(waves).not.toHaveBeenCalled();
  expect(cleared).not.toHaveBeenCalled();

  // Wezwanie: sługi nie kończą pokoju, boss żyje.
  expect(commands.execute('boss pattern summon')).toContain('summon');
  steps(100);
  const minions = (scene.query('boss') as { minions: number }).minions;
  expect(minions).toBeGreaterThan(0);
  expect(scene.query('enemies')).toBe(1 + minions);
  expect(cleared).not.toHaveBeenCalled();
  expect(commands.execute('boss pattern nope')).toContain('Podaj');

  // Progi faz: jeden kill all przechodzi najwyżej jeden próg.
  commands.execute('kill all');
  expect(scene.query('boss')).toMatchObject({ phase: 2 });
  expect(cleared).not.toHaveBeenCalled();
  steps(70);
  commands.execute('kill all');
  expect(scene.query('boss')).toMatchObject({ phase: 3 });
  steps(70);
  expect(cleared).not.toHaveBeenCalled();
  commands.execute('kill all');
  expect(cleared).toHaveBeenCalledExactlyOnceWith({
    nodeId: 'boss',
    type: 'boss',
    timeS: expect.any(Number),
  });
  expect(scene.query('roomCleared')).toBe(true);
  expect(scene.query('enemies')).toBe(0);
  expect(killed.mock.calls.length).toBeGreaterThanOrEqual(1 + minions);
  steps(60);
  expect(cleared).toHaveBeenCalledOnce();
});

it('śmierć gracza w pokoju bossa nie emituje room_cleared', async () => {
  const bus = new EventBus();
  const cleared = vi.fn(),
    died = vi.fn();
  bus.on('room_cleared', cleared);
  bus.on('player_died', died);
  const { scene, commands, steps } = await setup(bus);
  commands.execute('hurt 1000');
  expect(died).toHaveBeenCalledOnce();
  expect(scene.query('dead')).toBe(true);
  steps(60);
  expect(cleared).not.toHaveBeenCalled();
});
