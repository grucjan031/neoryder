// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { Arena } from '../../src/scenes/arena';
import { RoomScene } from '../../src/scenes/roomScene';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { loadSettings } from '../../src/core/save';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { roomDefinitions } from '../../src/world/rooms';
import { loadWaves } from '../../src/world/waves';
import { loadoutDefinitions } from '../../src/progression/loadout';
import type { RunState } from '../../src/core/runTypes';
import type { ExecuteSystem } from '../../src/combat/melee/execute';
import type { EnemyManager } from '../../src/enemies/manager';
import type { EnemyViewLike } from '../../src/enemies/views';
import wavesData from '../../src/data/waves/roomTest.json';

const active: (Arena | RoomScene)[] = [];
afterEach(() => {
  active.splice(0).forEach((scene) => scene.dispose());
  vi.restoreAllMocks();
});

async function setup(kind: string) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const room = { ...roomDefinitions.get('combatYard')!, maxAlive: 10 };
  const run: RunState = {
    seed: 'z8',
    sectorId: 'test',
    loadoutId: 'classic',
    loadout: loadoutDefinitions.get('classic')!,
    talents: [],
    threatLevel: 0,
    startedAtMs: 0,
    elapsedS: 0,
    map: {
      sectorId: 'test',
      layers: [[{ id: 'node', layer: 0, index: 0, type: 'combat', next: [] }]],
    },
    currentNodeId: 'node',
    visited: [],
    hp: 100,
    energy: 100,
    credits: 0,
    implants: [],
    stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
  };
  const scene =
    kind === 'arena'
      ? new Arena(false)
      : new RoomScene(
          room,
          run,
          loadWaves({
            ...wavesData,
            maxAlive: 10,
            spawnPoints: room.spawnPoints,
          }),
          { loadModels: false },
        );
  const commands = new CommandRegistry();
  const camera = new PerspectiveCamera();
  await scene.init(
    {
      commands,
      camera,
      bus: new EventBus(),
      tuning: structuredClone(tuning),
      rng: new Rng('z8'),
      debug: false,
      loop: new GameLoop({ step() {}, render() {} }),
    },
    new ThreeScene(),
  );
  active.push(scene);
  return { scene, commands, camera };
}

it.each(['arena', 'room'])(
  '%s: kamera zmienia stan i render bez kroku symulacji',
  async (kind) => {
    const { scene, commands, camera } = await setup(kind);
    commands.execute('tp 3 4 90 0');
    expect(scene.query('playerPos')).toMatchObject({ x: 3, z: 4 });
    expect(scene.query('playerLook')).toEqual({ yawDeg: 90, pitchDeg: 0 });
    scene.render(0);
    expect(camera.rotation.y).toBeCloseTo(Math.PI / 2);
    const position = scene.query('playerPos');
    const settings = loadSettings();
    const original = { ...settings };
    try {
      settings.invertY = true;
      settings.mouseSensitivity = 2;
      commands.execute('look -45 20');
      expect(scene.query('playerLook')).toEqual({ yawDeg: -45, pitchDeg: 20 });
      expect(scene.query('playerPos')).toEqual(position);
      commands.execute('look 0 180');
      expect(scene.query('playerLook')).toEqual({
        yawDeg: 0,
        pitchDeg: tuning.player.maxPitchDeg,
      });
      for (const invalid of ['tp NaN 2', 'tp 3', 'look Infinity', 'look 2 3 4'])
        expect(commands.execute(invalid)).toContain('Uzycie:');
      expect(scene.query('playerPos')).toEqual(position);
    } finally {
      Object.assign(settings, original);
    }
  },
);

it.each(['arena', 'room'])(
  '%s: pula 10 wrogów przez 100 kroków; render nie pobiera wrogów',
  async (kind) => {
    const { scene, commands } = await setup(kind);
    expect(commands.execute('spawn gunner 10')).toBe('Utworzono: 10');
    // Odczyt prywatnego połączenia modułów pozwala testować prawdziwy callback sceny.
    const execute = Reflect.get(scene, 'execute') as ExecuteSystem;
    const deps = execute['deps'];
    const enemies = vi.spyOn(deps, 'enemies');
    const buffer = deps.enemies();
    expect(buffer).toHaveLength(10);
    const entries = [...buffer];
    const positions = buffer.map((enemy) => enemy.position);
    for (let i = 0; i < 100; i++) {
      execute.step(1 / 60);
      expect(enemies.mock.lastCall).toEqual([]);
      expect(enemies.mock.results.at(-1)?.value).toBe(buffer);
      for (let j = 0; j < 10; j++) {
        expect(buffer[j]).toBe(entries[j]);
        expect(buffer[j]?.position).toBe(positions[j]);
      }
    }
    enemies.mockClear();
    scene.render(0.5);
    scene.render(1);
    expect(enemies).not.toHaveBeenCalled();
  },
);

it.each(['arena', 'room'])(
  '%s: look i tp odrzucają przepełnienia i argumenty poza limitem bez zmiany stanu',
  async (kind) => {
    const { scene, commands } = await setup(kind);
    commands.execute('tp 3 4 45 20');
    const position = scene.query('playerPos');
    const look = scene.query('playerLook');
    for (const command of [
      'look 1e308',
      'look -1e308',
      'look 1000001',
      'look -1000001',
      'look 0 1000001',
      'look 0 -1000001',
      'tp 1e308 0',
      'tp 10001 0',
      'tp -10001 0',
      'tp 0 10001',
      'tp 0 -10001',
      'tp 8 9 1e308',
      'tp 8 9 1000001',
      'tp 8 9 0 -1000001',
    ]) {
      expect.soft(commands.execute(command), command).toContain('Uzycie:');
      expect.soft(scene.query('playerPos'), command).toEqual(position);
      expect.soft(scene.query('playerLook'), command).toEqual(look);
    }
  },
);

it.each(['arena', 'room'])(
  '%s: look i tp normalizują yaw w stopniach i obcinają pitch do limitu kontrolera',
  async (kind) => {
    const { scene, commands, camera } = await setup(kind);
    for (const [yaw, expectedYaw] of [
      [180, -180],
      [-180, -180],
      [540, -180],
      [-540, -180],
      [1000000, -80],
      [-1000000, 80],
    ]) {
      for (const prefix of ['look', 'tp 10000 -10000']) {
        expect(commands.execute(`${prefix} ${yaw} 1000000`)).not.toContain(
          'Uzycie:',
        );
        const look = scene.query('playerLook') as {
          yawDeg: number;
          pitchDeg: number;
        };
        expect(look.yawDeg).toBeCloseTo(expectedYaw!);
        expect(look.pitchDeg).toBeCloseTo(tuning.player.maxPitchDeg);
        scene.render(0);
        expect(Number.isFinite(camera.rotation.y)).toBe(true);
        expect(camera.rotation.y).toBeCloseTo((expectedYaw! * Math.PI) / 180);
      }
    }
    commands.execute('look 0 -1000000');
    expect(scene.query('playerLook')).toEqual({
      yawDeg: 0,
      pitchDeg: -tuning.player.maxPitchDeg,
    });
  },
);

it.each(['arena', 'room'])(
  '%s: niefinitywny wynik przeliczenia look nie zmienia kamery ani pozycji tp',
  async (kind) => {
    const { scene, commands } = await setup(kind);
    commands.execute('tp 3 4 45 20');
    const position = scene.query('playerPos');
    const look = scene.query('playerLook');
    const settings = loadSettings();
    const original = settings.mouseSensitivity;
    try {
      settings.mouseSensitivity = 0;
      for (const command of ['look 90 20', 'tp 8 9 90 20']) {
        expect.soft(commands.execute(command)).toContain('Uzycie:');
        expect.soft(scene.query('playerPos')).toEqual(position);
        expect.soft(scene.query('playerLook')).toEqual(look);
      }
    } finally {
      settings.mouseSensitivity = original;
    }
  },
);

it.each(['arena', 'room'])(
  '%s: zastąpienie wroga w slocie puli usuwa stare readyId i zeruje fazę znacznika',
  async (kind) => {
    const { scene, commands } = await setup(kind);
    const execute = Reflect.get(scene, 'execute') as ExecuteSystem;
    const manager = Reflect.get(scene, 'manager') as EnemyManager;
    const views = Reflect.get(scene, 'views') as Map<number, EnemyViewLike>;
    const deps = execute['deps'];
    commands.execute('spawn gunner 1');
    commands.execute('weaken 1');
    execute.step(1 / 60);
    const buffer = deps.enemies();
    const slot = buffer[0]!;
    const oldId = slot.id;
    expect(execute.readyIds()).toEqual([oldId]);
    scene.render(0, 0);
    const oldMarker = views.get(oldId)!.root.getObjectByName('executeMarker')!;
    const initialScale = oldMarker.scale.clone();
    expect(oldMarker.visible).toBe(true);
    scene.render(0, 1 / (4 * tuning.melee.executeMarkerPulseHz));
    expect(oldMarker.scale.equals(initialScale)).toBe(false);

    manager.despawnAll();
    commands.execute('spawn gunner 1');
    execute.step(1 / 60);
    expect(deps.enemies()).toBe(buffer);
    expect(buffer[0]).toBe(slot);
    const newId = slot.id;
    expect(newId).not.toBe(oldId);
    expect(execute.readyIds()).not.toContain(oldId);
    expect(execute.readyIds()).not.toContain(newId);
    scene.render(0, 0);
    expect(views.has(oldId)).toBe(false);
    expect(oldMarker.parent).toBeNull();
    const newMarker = views.get(newId)!.root.getObjectByName('executeMarker')!;
    expect(newMarker).not.toBe(oldMarker);
    expect(newMarker.visible).toBe(false);

    commands.execute('weaken 1');
    execute.step(1 / 60);
    expect(execute.readyIds()).toEqual([newId]);
    scene.render(0, 0);
    expect(newMarker.visible).toBe(true);
    expect(newMarker.scale.equals(initialScale)).toBe(true);
  },
);
