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
