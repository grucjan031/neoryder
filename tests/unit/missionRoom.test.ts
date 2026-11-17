import { expect, it } from 'vitest';
import { Scene } from 'three';
import { RoomScene } from '../../src/scenes/roomScene';
import { EventBus, type GameEvents } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import { RunManager } from '../../src/world/run';
import { generateMissionMap } from '../../src/world/sectorMap';
import { missionDefinitions } from '../../src/world/missions';
import { kuroganeSector } from '../../src/world/sectors';
import { roomDefinitions } from '../../src/world/rooms';
import { loadWaves } from '../../src/world/waves';
import { CommandRegistry } from '../../src/ui/debugCommands';
import wavesData from '../../src/data/waves/roomTest.json';

it('M03: żywi wrogowie nie blokują transferu, próg tworzy falę raz, brama kończy pokój', async () => {
  const mission = missionDefinitions.get('m03-list-przewozowy')!;
  const bus = new EventBus();
  const run = new RunManager(bus, {
    generateMap: (seed) => generateMissionMap(mission, kuroganeSector, seed),
  });
  const state = run.newRun('dock', 'classic', { mission });
  state.currentNodeId = state.map.layers[6]![0]!.id;
  state.objectiveProgress = { 'terminal:connection': 1, terminal: 0.2499 };
  const layout = roomDefinitions.get('combatWarehouse')!;
  const scene = new RoomScene(
    layout,
    state,
    loadWaves({
      ...wavesData,
      firstBreakS: 100,
      spawnPoints: layout.spawnPoints,
    }),
    { loadModels: false },
  );
  const commands = new CommandRegistry();
  const cleared: string[] = [];
  bus.on('room_cleared', ({ nodeId }) => cleared.push(nodeId));
  const input = {
    held: new Set<never>(),
    pressed: new Set<never>(),
    released: new Set<never>(),
    lookDelta: { x: 0, y: 0 },
  };
  const step = (n: number) => {
    for (let i = 0; i < n; i++) scene.step(1 / 60, input);
  };
  try {
    await scene.init(
      {
        bus,
        commands,
        rng: new Rng('dock'),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: structuredClone(tuning),
        debug: false,
      },
      new Scene(),
    );
    commands.execute('god');
    commands.execute('tp 0 9');
    commands.execute('spawn turret 1');
    commands.execute('tp 0 2');
    step(120);
    expect(scene.missionState().objectiveProgress!.terminal).toBeGreaterThan(
      0.25,
    );
    expect(scene.query('enemies')).toBeGreaterThan(0);
    const snapshot = () =>
      scene.query('missionObjectives') as {
        reinforcements: unknown[][];
        paused: Record<string, boolean>;
      };
    expect(snapshot().reinforcements).toHaveLength(1);
    expect(snapshot().reinforcements[0]).toHaveLength(3);
    commands.execute('tp 0 9');
    const before = scene.missionState().objectiveProgress!.terminal;
    step(60);
    expect(scene.missionState().objectiveProgress!.terminal).toBe(before);
    expect(snapshot().paused.terminal).toBe(true);
    commands.execute('tp 0 2');
    step(30);
    expect(snapshot().reinforcements).toHaveLength(1);
    scene.clear();
    expect(cleared).toEqual([]);
    const exitDoors = () =>
      Object.values(
        scene.query('doors') as Record<string, { role: string; open: boolean }>,
      ).filter((door) => door.role === 'exit');
    expect(exitDoors().every((door) => !door.open)).toBe(true);
    commands.execute('objective done terminal');
    step(1);
    expect(exitDoors().length).toBeGreaterThan(0);
    expect(exitDoors().every((door) => door.open)).toBe(true);
    expect(cleared).toEqual([]);
    commands.execute('tp 0 -10');
    step(125);
    expect(scene.missionState().objectives!.exit).toBe('done');
    expect(cleared).toHaveLength(1);
  } finally {
    scene.dispose();
    run.dispose();
  }
});

it('wybuch masztu rani gracza i osłonę ze źródłem null, po ukończeniu celu nadal spawnuje posiłki', async () => {
  const mission = missionDefinitions.get('m01-maszty')!;
  const bus = new EventBus();
  const run = new RunManager(bus, {
    generateMap: (seed) => generateMissionMap(mission, kuroganeSector, seed),
  });
  const state = run.newRun('blast', 'classic', { mission });
  state.currentNodeId = state.map.layers[2]![0]!.id;
  const layout = roomDefinitions.get('alleyCrossing')!;
  const scene = new RoomScene(
    layout,
    state,
    loadWaves({
      ...wavesData,
      firstBreakS: 100,
      spawnPoints: layout.spawnPoints,
    }),
    { loadModels: false },
  );
  const commands = new CommandRegistry();
  const hits: GameEvents['damage_dealt'][] = [];
  const spawned: string[] = [];
  bus.on('damage_dealt', (event) => hits.push(event));
  bus.on('entity_spawned', ({ kind }) => spawned.push(kind));
  try {
    await scene.init(
      {
        bus,
        commands,
        rng: new Rng('blast'),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: structuredClone(tuning),
        debug: false,
      },
      new Scene(),
    );
    commands.execute('tp 0 0');
    commands.execute('objective done mast-1');
    const blasts = hits.filter((hit) => hit.tags.includes('#explosion'));
    expect(
      blasts.some(
        (hit) => hit.target === scene.playerId && hit.source === null,
      ),
    ).toBe(true);
    expect(
      blasts.some(
        (hit) => hit.target !== scene.playerId && hit.source === null,
      ),
    ).toBe(true);
    expect(scene.missionState().objectives?.['mast-1']).toBe('done');
    for (let i = 0; i < 40; i++)
      scene.step(1 / 60, {
        held: new Set(),
        pressed: new Set(),
        released: new Set(),
        lookDelta: { x: 0, y: 0 },
      });
    expect(
      spawned.filter((kind) => kind === 'assaulter' || kind === 'gunner')
        .length,
    ).toBeGreaterThan(0);
  } finally {
    scene.dispose();
    run.dispose();
  }
});
