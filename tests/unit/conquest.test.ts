import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { createMemorySaveStore, SAVE_VERSION } from '../../src/core/save';
import { Conquest } from '../../src/world/conquest';
import { conquestDefinition as definition } from '../../src/world/modes';
import { modeSchema, validateMode } from '../../src/world/modeSchema';
import { roomDefinitions } from '../../src/world/rooms';
import { RunManager } from '../../src/world/run';

const room = roomDefinitions.get(definition.roomId)!;
// Wolne miejsce poza wszystkimi strefami (C stoi na środku pierścienia).
const away = { x: 0, y: 0, z: 10 };
const create = () => new Conquest(definition, new EventBus());
const manager = () =>
  new RunManager(new EventBus(), {
    generateMap: () => ({
      sectorId: 'test',
      layers: [
        [{ id: 'normal', layer: 1, index: 0, type: 'combat', next: [] }],
      ],
    }),
  });

describe('Przejęcie', () => {
  it('waliduje punkty, odległości, podłogę i białą listę', () => {
    expect(() =>
      validateMode(definition, room, ['assaulter', 'gunner']),
    ).not.toThrow();
    expect(
      modeSchema.safeParse({
        ...definition,
        points: [
          definition.points[0],
          definition.points[0],
          definition.points[2],
        ],
      }).success,
    ).toBe(false);
    for (const position of [
      { x: -3, y: 0, z: -6 },
      { x: 100, y: 0, z: 0 },
      definition.points[1]!.position,
    ]) {
      const invalid = structuredClone(definition);
      invalid.points[0]!.position = position;
      expect(() => validateMode(invalid, room, definition.enemies)).toThrow();
    }
    expect(() =>
      validateMode({ ...definition, enemies: ['turret'] }, room, ['turret']),
    ).toThrow();
    for (const captureS of [0, -1, Infinity, NaN])
      expect(modeSchema.safeParse({ ...definition, captureS }).success).toBe(
        false,
      );
  });
  it('przejmuje od neutralnego, zatrzymuje sporny i przechodzi przez neutralny', () => {
    const bus = new EventBus(),
      captured = vi.fn();
    bus.on('conquest_captured', captured);
    const model = new Conquest(definition, bus),
      point = model.points[0]!;
    model.step(3, point.position, []);
    expect(point.progress).toBe(0.5);
    model.step(3, point.position, [point.position]);
    expect(point.progress).toBe(0.5);
    expect(point.contested).toBe(true);
    model.step(3, point.position, []);
    expect(point.owner).toBe('player');
    model.step(6, away, [point.position]);
    expect(point.owner).toBe('neutral');
    expect(point.progress).toBe(0);
    model.step(6, away, [point.position]);
    expect(point.owner).toBe('enemy');
    model.step(6, point.position, []);
    expect(point.owner).toBe('neutral');
    model.step(6, point.position, []);
    expect(point.owner).toBe('player');
    expect(captured.mock.calls.map((c) => c[0].owner)).toEqual([
      'player',
      'enemy',
      'player',
    ]);
  });
  it.each([0, 1, 2, 3])('upływ puli przy %i punktach', (held) => {
    const model = create();
    model.points.slice(0, held).forEach((p) => model.capture(p.id));
    model.step(2, away, []);
    expect(model.tickets).toBe(120 - (held === 3 ? 6 : held === 2 ? 2 : 0));
  });
  it('zabójstwo odejmuje jeden, pula zero czeka na żywych, śmierć ma pierwszeństwo', () => {
    const model = create();
    model.killed();
    expect(model.tickets).toBe(119);
    model.setTickets(0);
    model.step(1, away, [away]);
    expect(model.outcome).toBeNull();
    model.step(1, away, []);
    expect(model.outcome).toBe('victory');
    const death = create();
    death.setTickets(0);
    death.step(1, away, [], true);
    expect(death.outcome).toBe('death');
  });
  it('spawn nie narusza 15 m, limitu, odstępu ani wyczerpanej puli', () => {
    const rng = new Rng('spawn');
    for (let x = -12; x <= 12; x += 3)
      for (let z = -12; z <= 12; z += 3) {
        const model = create(),
          player = { x, y: 0, z };
        const spawn = model.spawnPosition(room, player, [], rng);
        if (spawn)
          expect(Math.hypot(spawn.x - x, spawn.z - z)).toBeGreaterThanOrEqual(
            15,
          );
      }
    const model = create(),
      player = room.playerSpawn;
    expect(model.spawnPosition(room, player, [], rng)).not.toBeNull();
    model.spawned();
    expect(model.spawnPosition(room, player, [], rng)).toBeNull();
    model.step(3, player, []);
    expect(
      model.spawnPosition(
        room,
        player,
        Array.from({ length: 8 }, () => away),
        rng,
      ),
    ).toBeNull();
    model.setTickets(0);
    expect(model.spawnPosition(room, player, [], rng)).toBeNull();
  });
  it('cel marszu to najbliższy obcy punkt, wykrycie gracza przywraca walkę', () => {
    const model = create(),
      p = { x: -10, y: 0, z: -10 },
      player = { x: 10, y: 0, z: 10 };
    expect(model.moveGoal(p, player)).toEqual(model.points[0]!.position);
    model.step(6, player, [model.points[0]!.position]);
    expect(model.moveGoal(p, player)).not.toEqual(model.points[0]!.position);
    expect(model.moveGoal(p, p)).toBeUndefined();
  });
  it.each(['victory', 'death'] as const)(
    'podsumowanie %s i zapis v4 zachowują tryb',
    async (outcome) => {
      const run = manager();
      run.newRun('arena', 'classic', { modeId: 'conquest' });
      expect(run.state.map.layers.flat()).toHaveLength(1);
      run.selectNode('conquest');
      const summary = run.finish(outcome);
      expect(summary.modeId).toBe('conquest');
      expect(summary.roomsCleared).toBe(outcome === 'victory' ? 6 : 0);
      expect(summary.missionId).toBeUndefined();
      const store = createMemorySaveStore();
      await store.saveRun({
        saveVersion: SAVE_VERSION,
        seed: 'arena',
        startedAt: 0,
        run: run.serialize(),
        ended: { runId: 'arena', summary },
      });
      const saved = await store.loadRun();
      expect(saved?.ended?.summary).toEqual(summary);
      expect(saved?.run.modeId).toBe('conquest');
      expect(SAVE_VERSION).toBe(4);
    },
  );
  it('stary zapis pozostaje bez modeId, a wznowiona arena ma dostępny pokój', () => {
    const run = manager();
    run.newRun('old');
    expect(run.serialize()).not.toHaveProperty('modeId');
    run.newRun('arena', 'classic', { modeId: 'conquest' });
    run.selectNode('conquest');
    const resumed = manager();
    resumed.restore(run.serialize());
    expect(resumed.availableNodes().map((n) => n.id)).toEqual(['conquest']);
  });
});
