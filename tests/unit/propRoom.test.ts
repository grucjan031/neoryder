import { expect, it } from 'vitest';
import { Scene } from 'three';
import { RoomScene } from '../../src/scenes/roomScene';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import type { RunState } from '../../src/core/runTypes';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { roomDefinitions } from '../../src/world/rooms';
import { loadWaves } from '../../src/world/waves';
import { CommandRegistry } from '../../src/ui/debugCommands';
import wavesData from '../../src/data/waves/roomTest.json';

it('combatWarehouse: skrzynie są zniszczalne, mała ma ciało w limicie, beczka je rozbija, stan Rng runu nietknięty', async () => {
  const room = roomDefinitions.get('combatWarehouse')!;
  const run = {
    seed: 'props-unit',
    sectorId: 'test',
    loadoutId: 'gunner',
    loadout: loadoutDefinitions.get('gunner')!,
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
    implants: [],
    stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
  } as unknown as RunState;
  const waves = loadWaves({
    ...wavesData,
    waves: [{ spawnIntervalS: 1, groups: [{ enemy: 'assaulter', count: 1 }] }],
  });
  const bus = new EventBus();
  const destroyed: GameEvents['prop_destroyed'][] = [];
  bus.on('prop_destroyed', (e) => destroyed.push(e));
  const commands = new CommandRegistry();
  const rng = new Rng(run.seed);
  const t = structuredClone(tuning);
  const scene = new RoomScene(room, run, waves, { loadModels: false });
  try {
    await scene.init(
      {
        bus,
        commands,
        rng,
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: t,
        debug: false,
      },
      new Scene(),
    );
    const stateBefore = rng.getState();
    const first = scene.query('props') as { alive: number; bodies: number };
    expect(first.alive).toBe(7);
    expect(first.bodies).toBe(3);
    expect(first.bodies).toBeLessThanOrEqual(t.physics.maxPropBodies);
    // Beczka south (-3.5, 6) leży ~2.5 m od małej skrzyni (-1.2, 5).
    commands.execute('hazard detonate warehouse-south');
    for (let i = 0; i < 30; i++)
      scene.step(SIM_DT, {
        held: new Set(),
        pressed: new Set(),
        released: new Set(),
        lookDelta: { x: 0, y: 0 },
      });
    const after = scene.query('props') as { alive: number; bodies: number };
    expect(destroyed.length).toBeGreaterThan(0);
    expect(after.alive).toBe(first.alive - destroyed.length);
    expect(after.bodies).toBeLessThan(first.bodies);
    expect(rng.getState()).toBe(stateBefore);
    scene.render(1);
  } finally {
    scene.dispose();
  }
});
