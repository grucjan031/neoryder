import { describe, it, expect } from 'vitest';
import { Scene } from 'three';
import { Heist } from '../../src/world/heist';
import { heistDefinition as definition } from '../../src/world/modes';
import { heistSchema, validateMode } from '../../src/world/modeSchema';
import { roomDefinitions } from '../../src/world/rooms';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { GameLoop } from '../../src/core/loop';
import { RunManager } from '../../src/world/run';
import { RoomScene } from '../../src/scenes/roomScene';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { loadWaves } from '../../src/world/waves';
import wavesData from '../../src/data/waves/roomTest.json';
import type { InputSnapshot } from '../../src/core/input';

const room = roomDefinitions.get(definition.roomId)!;
const far = definition.extraction;
const drop = { x: 8, y: 1, z: 8 };
const create = () => new Heist(definition);

describe('Kradzież rdzenia', () => {
  it('waliduje strefy i dane', () => {
    expect(() =>
      validateMode(definition, room, definition.enemies),
    ).not.toThrow();
    for (const key of [
      'lives',
      'carrySpeed',
      'enemyCarrySpeed',
      'extractS',
      'pickupRadiusM',
    ])
      expect(heistSchema.safeParse({ ...definition, [key]: 0 }).success).toBe(
        false,
      );
    expect(() =>
      validateMode(
        { ...definition, extraction: definition.base },
        room,
        definition.enemies,
      ),
    ).toThrow();
  });
  it('podnosi tylko w promieniu i ewakuuje wyłącznie z rdzeniem przez pełne 3 s', () => {
    const h = create();
    h.step(4, far, []);
    expect(h.outcome).toBeNull();
    expect(h.extract()).toBe(false);
    h.step(1 / 60, definition.base, []);
    expect(h.state).toBe('player');
    h.step(2, far, []);
    expect(h.outcome).toBeNull();
    h.step(1 / 60, drop, []);
    expect(h.extractElapsedS).toBe(0);
    for (let i = 0; i < 179; i++) h.step(1 / 60, far, []);
    expect(h.outcome).toBeNull();
    h.step(1 / 60, far, []);
    expect(h.outcome).toBe('victory');
  });
  it('upuszcza przy śmierci, odlicza życie raz i kończy przy zerze', () => {
    const h = create();
    h.grab();
    h.died(drop);
    h.died(drop);
    expect(h.snapshot()).toMatchObject({
      state: 'dropped',
      lives: 2,
      position: { x: 8, y: 0, z: 8 },
    });
    expect(h.stepRespawn(1)).toBe(false);
    expect(h.stepRespawn(1)).toBe(true);
    h.died(drop);
    h.stepRespawn(2);
    h.died(drop);
    expect(h.outcome).toBe('death');
    expect(h.grab()).toBe(false);
  });
  it('wróg podnosi upuszczony rdzeń, wraca do bazy i odkłada go', () => {
    const h = create();
    h.grab();
    h.drop(drop);
    h.step(1 / 60, far, [{ id: 7, position: drop }]);
    expect(h.state).toBe('enemy');
    expect(h.moveGoal(7, far)).toEqual(definition.base);
    h.step(1 / 60, far, [{ id: 7, position: definition.base }]);
    expect(h.snapshot()).toMatchObject({
      state: 'base',
      carrierId: null,
      position: definition.base,
    });
  });
  it('zabicie nosiciela pozwala przechwycić rdzeń', () => {
    const h = create();
    h.grab();
    h.drop(drop);
    h.step(1 / 60, far, [{ id: 7, position: drop }]);
    h.killed(8, far);
    expect(h.state).toBe('enemy');
    h.killed(7, drop);
    h.step(1 / 60, drop, []);
    expect(h.state).toBe('player');
    expect(h.moveGoal(8, far)).toEqual(far);
  });
  it('debug drop wymaga odejścia przed ponownym podniesieniem', () => {
    const h = create();
    h.grab();
    h.drop(drop);
    h.step(1 / 60, drop, []);
    expect(h.state).toBe('dropped');
    h.step(1 / 60, far, []);
    h.step(1 / 60, drop, []);
    expect(h.state).toBe('player');
  });
  it('limit czasu jest opcjonalny, input debug walidowany, wynik terminalny', () => {
    const h = new Heist({ ...definition, timeLimitS: 1 });
    for (const n of [-1, 1.5, Infinity, NaN]) expect(h.setLives(n)).toBe(false);
    h.step(NaN, far, []);
    expect(h.elapsedS).toBe(0);
    h.step(1, far, []);
    expect(h.outcome).toBe('death');
    expect(h.extract()).toBe(false);
    const unlimited = create();
    unlimited.step(100000, far, []);
    expect(unlimited.outcome).toBeNull();
    expect(unlimited.setLives(0)).toBe(true);
    expect(unlimited.outcome).toBe('death');
  });
  it('pilnuje limitu i interwału bezpiecznych posiłków', () => {
    const h = create(),
      rng = new Rng('heist');
    expect(h.spawnPosition(room, far, [], rng)).not.toBeNull();
    h.spawned();
    expect(h.spawnPosition(room, far, [], rng)).toBeNull();
    h.step(definition.spawnIntervalS, far, []);
    expect(
      h.spawnPosition(
        room,
        far,
        Array.from({ length: definition.maxAlive }, () => far),
        rng,
      ),
    ).toBeNull();
    expect(h.spawnPosition(room, far, [], rng)).not.toBeNull();
  });
  it.each(['assaulter', 'gunner'])(
    'host: ruch, odrodzenie, powrót nosiciela %s i nagrody',
    async (kind) => {
      const bus = new EventBus();
      const run = new RunManager(bus, {
        generateMap: () => ({ sectorId: 'test', layers: [] }),
      });
      const state = run.newRun('heist', 'classic', { modeId: 'heist' });
      run.selectNode('heist');
      state.currentNodeId = 'heist';
      const scene = new RoomScene(
        room,
        state,
        loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
        { loadModels: false },
      );
      const commands = new CommandRegistry();
      const input: InputSnapshot = {
        held: new Set(),
        pressed: new Set(),
        released: new Set(),
        lookDelta: { x: 0, y: 0 },
      };
      const step = (n = 1, snapshot = input) => {
        for (let i = 0; i < n; i++) scene.step(1 / 60, snapshot);
      };
      try {
        await scene.init(
          {
            bus,
            commands,
            rng: new Rng('heist'),
            loop: new GameLoop({ step() {}, render() {} }),
            tuning: structuredClone(tuning),
            debug: false,
          },
          new Scene(),
        );
        step();
        commands.execute('heist grab');
        step(10, {
          ...input,
          held: new Set(['sprint', 'moveForward']),
          pressed: new Set(['dash']),
        });
        expect(scene.query('heist')).toMatchObject({
          state: 'player',
          moveSpeed: tuning.player.walkSpeed * definition.carrySpeed,
          dashS: 0,
          sprinting: false,
        });
        commands.execute('tp 8 8');
        commands.execute('hurt 99999');
        expect(scene.query('heist')).toMatchObject({
          state: 'dropped',
          lives: 2,
        });
        expect(run.active).toBe(true);
        step(120);
        expect(scene.query('dead')).toBe(false);
        expect(scene.query('playerPos')).toMatchObject({ x: far.x, z: far.z });
        expect(scene.query('playerHp')).toBe(scene.query('playerMaxHp'));
        step();
        expect(scene.query('heist')).toMatchObject({
          moveSpeed: tuning.player.walkSpeed,
        });
        commands.execute('god');
        commands.execute('killall');
        commands.execute('tp -10 -2');
        commands.execute(`spawn ${kind} 1`);
        commands.execute('heist grab');
        commands.execute('tp -10 -10');
        commands.execute('heist drop');
        commands.execute('tp 10 10');
        step();
        expect(scene.query('heist')).toMatchObject({ state: 'enemy' });
        step(600);
        expect(scene.query('heist')).toMatchObject({
          state: 'base',
          carrierId: null,
          position: definition.base,
        });
        commands.execute('heist grab');
        commands.execute('heist extract');
        const summary = run.finish('victory');
        expect(summary).toMatchObject({
          modeId: 'heist',
          roomsCleared: definition.rewardRooms,
        });
      } finally {
        scene.dispose();
        run.dispose();
      }
    },
  );
});
