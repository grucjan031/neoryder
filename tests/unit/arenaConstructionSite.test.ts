import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import generate from '../../tools/arenas/arenaConstructionSite.mjs';
import { stableJson } from '../../tools/arenas/lib/arena.mjs';
import { checkArena } from '../../tools/arenas/lib/check.mjs';
import { roomSchema } from '../../src/world/roomSchema';
import { roomDefinitions } from '../../src/world/rooms';
import { modeForArena, validateMode } from '../../src/world/modeSchema';
import { conquestMode } from '../../src/world/modes';
import { arenaSpawnPoints } from '../../src/world/arenaSpawns';
import { lightSpotFloors } from '../../src/render/city/dressing';

const room = roomDefinitions.get('arenaConstructionSite')!;
const inside = (
  r: { minX: number; maxX: number; minZ: number; maxZ: number },
  p: { x: number; z: number },
) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;

describe('arenaConstructionSite (Budowa wieżowca)', () => {
  it('JSON w repozytorium jest wynikiem generatora i przechodzi check ADR 0011', () => {
    const arena = generate();
    expect(
      readFileSync('src/data/rooms/arenaConstructionSite.json', 'utf8'),
    ).toBe(stableJson(arena.toRoom()));
    const report = checkArena(arena);
    expect(report.errors).toEqual([]);
    expect(report.metrics.widthM).toBe(240);
    expect(report.metrics.areaM2).toBeGreaterThanOrEqual(40000);
    expect([...report.metrics.zoneKinds].sort()).toEqual(
      ['dense', 'high', 'interior', 'low', 'open'].sort(),
    );
    for (const level of [-8, 0, 4, 8, 12, 16, 20, 24])
      expect(report.metrics.levels).toContain(level);
    expect(report.metrics.mostCommonProp!.share).toBeLessThanOrEqual(0.15);
    expect(roomSchema.safeParse(arena.toRoom()).error).toBeUndefined();
  });

  it('pięć punktów A–E, pula ≥ 20 spawnów we wszystkich strefach i z dala od startu', () => {
    const mode = modeForArena(conquestMode, room);
    validateMode(mode, room, mode.enemies);
    expect(mode.points.map((p) => [p.id, p.position])).toEqual([
      ['A', { x: -60, y: -8, z: 20 }],
      ['B', { x: 40, y: 8, z: -25 }],
      ['C', { x: -50, y: 0, z: -75 }],
      ['D', { x: 92, y: 0, z: 72 }],
      ['E', { x: 20, y: 0, z: 90 }],
    ]);
    expect(mode.maxAlive).toBe(12);
    expect(mode.enemyTickets).toBe(180);
    expect(room.arena!.spawnRing).toEqual({ minM: 25, maxM: 85 });
    expect(room.weather).toBe('clearNight');
    const spawns = arenaSpawnPoints(room);
    expect(spawns.length).toBeGreaterThanOrEqual(20);
    expect(new Set(spawns.map((s) => s.y))).toEqual(
      new Set([-8, 0, 12, 16, 20, 24]),
    );
    for (const s of spawns)
      expect(
        Math.hypot(s.x - room.playerSpawn.x, s.z - room.playerSpawn.z),
      ).toBeGreaterThan(room.arena!.spawnRing!.minM);
    const zones = {
      pit: { minX: -100, maxX: -20, minZ: -20, maxZ: 60 },
      tower: { minX: 10, maxX: 70, minZ: -60, maxZ: 10 },
      yard: { minX: -120, maxX: 0, minZ: -120, maxZ: -40 },
      compound: { minX: 70, maxX: 120, minZ: 40, maxZ: 120 },
      plaza: { minX: -20, maxX: 70, minZ: 64, maxZ: 120 },
    };
    for (const [name, rect] of Object.entries(zones))
      expect(
        spawns.filter((s) => inside(rect, s)).length,
        name,
      ).toBeGreaterThanOrEqual(2);
  });

  it('plamy świateł z wykopu leżą na dnie, a nie nad nim na poziomie startu', () => {
    const lights = room.lights!;
    const floors = lightSpotFloors(lights, room.playerSpawn.y, room.blocks);
    const pit = lights.flatMap((l, i) =>
      l.position.y < 0 ? [floors[i]!] : [],
    );
    expect(pit.length).toBeGreaterThanOrEqual(4);
    for (const y of pit) expect(y).toBeLessThan(-3.9);
    lights.forEach((l, i) => {
      if (l.position.y >= 0) expect(floors[i]).toBe(room.playerSpawn.y);
    });
  });
});
