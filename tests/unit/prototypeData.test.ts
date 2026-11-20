import { describe, it, expect } from 'vitest';
import {
  escortTest,
  loadEscortTest,
  loadPayloadTest,
  payloadTest,
} from '../../src/world/prototypes';
import { roomDefinitions } from '../../src/world/rooms';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { enemyRegistry } from '../../src/enemies/registry';
import { tuning } from '../../src/core/tuning';
import escortData from '../../src/data/prototypes/escortTest.json';
import payloadData from '../../src/data/prototypes/payloadTest.json';

const clone = <T>(value: T): T => structuredClone(value);

describe('dane prototypów S4-03', () => {
  it('ładują się i odwołują do istniejących pokoi i wrogów', () => {
    for (const def of [escortTest, payloadTest]) {
      const room = roomDefinitions.get(def.roomId);
      expect(room?.arena).toBeDefined();
      for (const wave of Object.values(def.waves))
        for (const w of wave.waves)
          for (const g of w.groups)
            expect(enemyRegistry.has(g.enemy), g.enemy).toBe(true);
    }
  });

  it('odrzucają nieznaną falę i niepoprawne postoje', () => {
    const escort = clone(escortData);
    escort.pursuitWave = 'brak';
    expect(() => loadEscortTest(escort)).toThrow();
    const unknown = clone(payloadData);
    unknown.stops[0]!.wave = 'brak';
    expect(() => loadPayloadTest(unknown)).toThrow();
    const unordered = clone(payloadData);
    unordered.stops[1]!.atM = 10;
    expect(() => loadPayloadTest(unordered)).toThrow();
    const beyond = clone(payloadData);
    beyond.stops[2]!.atM = 99999;
    expect(() => loadPayloadTest(beyond)).toThrow();
    const duplicate = clone(payloadData);
    duplicate.stops[1]!.id = duplicate.stops[0]!.id;
    expect(() => loadPayloadTest(duplicate)).toThrow();
    const short = clone(payloadData);
    short.route = short.route.slice(0, 1);
    expect(() => loadPayloadTest(short)).toThrow();
  });

  it('więzień ma drogę do ewakuacji, a punkty spawnu leżą w siatce nawigacji', () => {
    const room = roomDefinitions.get(escortTest.roomId)!;
    const nav = new ArenaNavigation(room);
    const path = nav.path(escortTest.prisoner, escortTest.evacuation);
    expect(path.length).toBeGreaterThan(10);
    const walkable = (p: { x: number; z: number }): boolean =>
      nav.path({ ...p, y: 0 }, { ...p, y: 0 }).length > 0;
    for (const wave of Object.values(escortTest.waves))
      for (const point of wave.spawnPoints)
        expect(walkable(point), JSON.stringify(point)).toBe(true);
    expect(tuning.prototypes.escort.evacRadiusM).toBeGreaterThan(0);
  });

  it('spawn wagonowych fal jest osiągalny i trasa mieści się w pokoju', () => {
    const room = roomDefinitions.get(payloadTest.roomId)!;
    const nav = new ArenaNavigation(room);
    const walkable = (p: { x: number; z: number }): boolean =>
      nav.path({ ...p, y: 0 }, { ...p, y: 0 }).length > 0;
    for (const wave of Object.values(payloadTest.waves))
      for (const point of wave.spawnPoints)
        expect(walkable(point), JSON.stringify(point)).toBe(true);
    const xs = room.blocks.map((b) => b.position.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    for (const point of payloadTest.route) {
      expect(point.x).toBeGreaterThan(minX);
      expect(point.x).toBeLessThan(maxX);
    }
  });
});
