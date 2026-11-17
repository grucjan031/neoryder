import { describe, it, expect, vi } from 'vitest';
import { Assault } from '../../src/world/assault';
import { assaultDefinition as definition } from '../../src/world/modes';
import { assaultSchema, validateMode } from '../../src/world/modeSchema';
import { roomDefinitions } from '../../src/world/rooms';
import { Rng } from '../../src/core/rng';
import { EventBus } from '../../src/core/events';
import { RunManager } from '../../src/world/run';
import { createMemorySaveStore, SAVE_VERSION } from '../../src/core/save';
import { Scene } from 'three';
import { RoomScene } from '../../src/scenes/roomScene';
import { GameLoop } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import { loadWaves } from '../../src/world/waves';
import { CommandRegistry } from '../../src/ui/debugCommands';
import wavesData from '../../src/data/waves/roomTest.json';

const room = roomDefinitions.get(definition.roomId)!;
const create = () =>
  new Assault(definition, { signal: vi.fn(), explode: vi.fn() });
const advance = (model: Assault) => {
  model.destroy('A');
  model.destroy('B');
  model.step(1 / 60, room.playerSpawn);
};

describe('Szturm', () => {
  it('host odradza nad podłogą aktywnego sektora, resetuje broń i pozwala ponownie umrzeć', async () => {
    const bus = new EventBus();
    const run = new RunManager(bus, {
      generateMap: () => ({ sectorId: 'test', layers: [] }),
    });
    const state = run.newRun('respawn', 'classic', { modeId: 'assault' });
    run.selectNode('assault');
    state.currentNodeId = 'assault';
    const scene = new RoomScene(
      room,
      state,
      loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
      { loadModels: false },
    );
    const commands = new CommandRegistry();
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
          rng: new Rng('respawn'),
          loop: new GameLoop({ step() {}, render() {} }),
          tuning: structuredClone(tuning),
          debug: false,
        },
        new Scene(),
      );
      const weapon = scene.query('weapon');
      commands.execute('assault destroy A');
      commands.execute('assault destroy B');
      step(1);
      commands.execute('hurt 99999');
      expect(scene.query('assault')).toMatchObject({
        sector: 2,
        lives: 2,
        respawnRemainingS: 2,
      });
      expect(run.active).toBe(true);
      step(119);
      expect(scene.query('dead')).toBe(true);
      step(1);
      expect(scene.query('dead')).toBe(false);
      expect(scene.query('playerHp')).toBe(scene.query('playerMaxHp'));
      expect(scene.query('weapon')).toBe(weapon);
      expect(scene.query('heat')).toBe(0);
      const position = scene.query('playerPos') as {
        x: number;
        y: number;
        z: number;
      };
      expect(position.x).toBe(0);
      expect(position.z).toBe(4);
      expect(position.y).toBeGreaterThan(0.5);
      commands.execute('hurt 99999');
      step(120);
      commands.execute('hurt 99999');
      expect(scene.query('assault')).toMatchObject({
        lives: 0,
        outcome: 'death',
      });
    } finally {
      scene.dispose();
      run.dispose();
    }
  });
  it('waliduje wolne strefy i kolejne sektory frontu', () => {
    expect(() =>
      validateMode(definition, room, definition.enemies),
    ).not.toThrow();
    for (const key of [
      'lives',
      'respawnS',
      'holdS',
      'fuseS',
      'spawnIntervalS',
    ] as const)
      expect(assaultSchema.safeParse({ ...definition, [key]: 0 }).success).toBe(
        false,
      );
    expect(
      assaultSchema.safeParse({
        ...definition,
        sectors: definition.sectors.slice(1),
      }).success,
    ).toBe(false);
    const invalid = structuredClone(definition);
    invalid.sectors[0]!.spawnPoints[0]!.z = 14;
    expect(() => validateMode(invalid, room, definition.enemies)).toThrow();
  });
  it('jedna stacja nie przesuwa frontu, druga aktywuje nową parę', () => {
    const model = create();
    expect(model.destroy('C')).toBe(false);
    model.destroy('A');
    model.step(1, room.playerSpawn);
    expect(model.sectorIndex).toBe(0);
    expect(model.snapshot().stations[0]!.state).toBe('destroyed');
    expect(model.destroy('A')).toBe(false);
    model.destroy('B');
    model.step(1, room.playerSpawn);
    expect(model.sectorIndex).toBe(1);
    expect(model.snapshot().stations.map((s) => s.state)).toEqual([
      'intact',
      'intact',
    ]);
    expect(model.noticeRemainingS).toBe(definition.noticeS);
    model.step(definition.noticeS, room.playerSpawn);
    expect(model.noticeRemainingS).toBe(0);
  });
  it('sabotaż podkłada ładunek, zachowuje postęp poza strefą i odpala jeden wybuch', () => {
    const explode = vi.fn();
    const model = new Assault(definition, { signal: vi.fn(), explode });
    const position = model.sector.stations[0];
    model.step(definition.holdS / 2, position);
    expect(model.snapshot().stations[0]!.state).toBe('planting');
    model.step(1, room.playerSpawn);
    expect(model.snapshot().stations[0]!.progress).toBe(0.5);
    model.step(definition.holdS / 2, position);
    expect(model.snapshot().stations[0]!.state).toBe('fuse');
    model.step(definition.fuseS, room.playerSpawn);
    expect(explode).toHaveBeenCalledTimes(1);
    expect(model.snapshot().stations[0]!.state).toBe('destroyed');
    model.step(10, room.playerSpawn);
    expect(explode).toHaveBeenCalledTimes(1);
  });
  it('śmierć odejmuje jedno życie, zatrzymuje front i odradza po 2 sekundach', () => {
    const model = create();
    advance(model);
    model.died();
    model.died();
    expect(model.lives).toBe(2);
    expect(model.respawnRemainingS).toBe(2);
    expect(model.destroy('A')).toBe(false);
    model.step(20, model.sector.stations[0]);
    expect(model.snapshot().stations[0]!.progress).toBe(0);
    expect(model.stepRespawn(1)).toBe(false);
    expect(model.stepRespawn(1)).toBe(true);
    expect(model.stepRespawn(1)).toBe(false);
    expect(model.sector.playerSpawn).toEqual(
      definition.sectors[1]!.playerSpawn,
    );
    model.died();
    model.stepRespawn(2);
    model.died();
    expect(model.lives).toBe(0);
    expect(model.outcome).toBe('death');
    expect(model.stepRespawn(20)).toBe(false);
  });
  it('pula 0 przegrywa, nie przyjmuje NaN, ułamków ani liczb ujemnych', () => {
    const model = create();
    for (const n of [NaN, Infinity, -1, 1.5])
      expect(model.setLives(n)).toBe(false);
    expect(model.setLives(0)).toBe(true);
    expect(model.outcome).toBe('death');
    expect(model.setLives(3)).toBe(false);
  });
  it('wygrywa dopiero po trzeciej parze, wynik jest niezmienny', () => {
    const model = create();
    advance(model);
    advance(model);
    expect(model.outcome).toBeNull();
    advance(model);
    expect(model.outcome).toBe('victory');
    model.died();
    expect(model.lives).toBe(3);
    expect(model.destroy('A')).toBe(false);
  });
  it('śmierć od ostatniego wybuchu przy zerze żyć ma pierwszeństwo', () => {
    const model = new Assault(definition, {
      signal: () => {},
      explode: () => model.died(),
    });
    model.setLives(1);
    model.destroy('A');
    model.step(1, room.playerSpawn);
    expect(model.outcome).toBe('death');
    expect(model.sectorIndex).toBe(0);
  });
  it('spawn jest za stacjami aktywnego sektora, respektuje dystans, limit i interwał', () => {
    const model = create(),
      rng = new Rng('assault');
    for (let sector = 0; sector < 3; sector++) {
      const player = model.sector.playerSpawn;
      const spawn = model.spawnPosition(room, player, [], rng)!;
      expect(spawn).not.toBeNull();
      expect(spawn.z).toBeLessThan(
        Math.min(...model.sector.stations.map((s) => s.z)),
      );
      expect(
        Math.hypot(spawn.x - player.x, spawn.z - player.z),
      ).toBeGreaterThanOrEqual(definition.minSpawnDistanceM);
      expect(
        model.spawnPosition(
          room,
          player,
          Array.from({ length: definition.maxAlive }, () => spawn),
          rng,
        ),
      ).toBeNull();
      model.spawned();
      expect(model.spawnPosition(room, player, [], rng)).toBeNull();
      model.step(definition.spawnIntervalS, player);
      expect(
        model.spawnPosition(room, player, model.sector.spawnPoints, rng),
      ).toBeNull();
      expect(model.spawnPosition(room, player, [], rng)).not.toBeNull();
      advance(model);
    }
  });
  it('obrona wybiera najbliższą niezniszczoną stację, bliski gracz przywraca walkę', () => {
    const model = create(),
      position = { x: -4, y: 0, z: 5 },
      player = { x: 0, y: 0, z: -14 };
    expect(model.moveGoal(position, player)).toEqual(model.sector.stations[0]);
    model.destroy('A');
    expect(model.moveGoal(position, player)).toEqual(model.sector.stations[1]);
    expect(model.moveGoal(position, position)).toBeUndefined();
  });
  it.each(['victory', 'death'] as const)(
    'run %s zachowuje id trybu, nagrody i zapis bieżącej wersji',
    async (outcome) => {
      const bus = new EventBus();
      const run = new RunManager(bus, {
        generateMap: () => ({ sectorId: 'test', layers: [] }),
      });
      run.newRun('szturm', 'classic', { modeId: 'assault' });
      expect(run.state.map.layers.flat()).toHaveLength(1);
      expect(run.selectNode('assault')).toBe(true);
      bus.emit('player_died', { id: 999 });
      expect(run.active).toBe(true);
      const summary = run.finish(outcome);
      expect(summary.modeId).toBe('assault');
      expect(summary.roomsCleared).toBe(
        outcome === 'victory' ? definition.rewardRooms : 0,
      );
      expect(summary.missionId).toBeUndefined();
      const store = createMemorySaveStore();
      await store.saveRun({
        saveVersion: SAVE_VERSION,
        seed: 'szturm',
        startedAt: 0,
        run: run.serialize(),
        ended: { runId: 'szturm', summary },
      });
      expect((await store.loadRun())?.ended?.summary).toEqual(summary);
    },
  );
});
