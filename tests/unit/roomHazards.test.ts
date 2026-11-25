import { expect, it, vi } from 'vitest';
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
import type { HazardState } from '../../src/world/hazards';
import { CommandRegistry } from '../../src/ui/debugCommands';
import wavesData from '../../src/data/waves/roomTest.json';
import { HitSparks } from '../../src/vfx/hitSparks';

it('combatWarehouse: ładuje beczki, detonuje obok wroga, nie liczy beczki jako zabójstwa i sprząta', async () => {
  const room = roomDefinitions.get('combatWarehouse')!;
  const run: RunState = {
    seed: 'hazard-unit',
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
  };
  // Istniejący wolny punkt (0,-4) leży obok beczki warehouse-north (1.5,-6).
  const waves = loadWaves({
    ...wavesData,
    spawnPoints: [{ x: 0, z: -4 }],
    waves: [{ spawnIntervalS: 1, groups: [{ enemy: 'assaulter', count: 1 }] }],
  });
  const bus = new EventBus();
  const hits: GameEvents['damage_dealt'][] = [];
  const spawned: GameEvents['entity_spawned'][] = [];
  const offHit = bus.on('damage_dealt', (e) => hits.push(e));
  const offSpawn = bus.on('entity_spawned', (e) => spawned.push(e));
  const commands = new CommandRegistry();
  const three = new Scene();
  const scene = new RoomScene(room, run, waves, { loadModels: false });
  const sparks = vi.spyOn(HitSparks.prototype, 'burst');
  try {
    await scene.init(
      {
        bus,
        commands,
        rng: new Rng(run.seed),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: structuredClone(tuning),
        debug: false,
      },
      three,
    );
    commands.execute('god');
    commands.execute('tp 0 -12');
    const hazards = scene.query('hazards') as HazardState[];
    expect(hazards).toHaveLength(4);
    expect(hazards.every((h) => h.kind === 'explosive_barrel' && h.alive)).toBe(
      true,
    );
    expect(JSON.parse(commands.execute('hazard list'))).toEqual(hazards);
    for (let i = 0; i < 180 && scene.query('enemies') === 0; i++)
      scene.step(SIM_DT, {
        held: new Set(),
        pressed: new Set(),
        released: new Set(),
        lookDelta: { x: 0, y: 0 },
      });
    expect(scene.query('enemies')).toBe(1);
    const enemy = spawned.find((e) => e.kind === 'assaulter');
    expect(enemy).toBeDefined();
    expect(commands.execute('hazard detonate warehouse-north')).toBe(
      'Beczka zdetonowana.',
    );
    expect(sparks).toHaveBeenCalledWith(
      expect.any(Object),
      null,
      0xffb84d,
      tuning.vfx.explosionSparkCount,
    );
    expect(three.getObjectByName('explosion-core')?.visible).toBe(true);
    expect(three.getObjectByName('explosion-ring')?.visible).toBe(true);
    expect(
      hits.some(
        (e) =>
          e.target === enemy!.id && e.amount > 0 && e.tags.includes('#hazard'),
      ),
    ).toBe(true);
    expect(
      (scene.query('hazards') as HazardState[]).find(
        (h) => h.id === 'warehouse-north',
      )?.alive,
    ).toBe(false);
    expect(scene.query('kills')).toBe(
      hits.filter((e) => e.target === enemy!.id && e.killed).length,
    );
    scene.render(0.5);
    scene.dispose();
    expect(three.children).toHaveLength(0);
    expect(commands.execute('hazard list')).toContain('Nieznana komenda');
  } finally {
    sparks.mockRestore();
    scene.dispose();
    offHit();
    offSpawn();
  }
});
