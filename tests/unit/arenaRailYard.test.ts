import { expect, it } from 'vitest';
import generate from '../../tools/arenas/arenaRailYard.mjs';
import { checkArena } from '../../tools/arenas/lib/check.mjs';
import { roomSchema } from '../../src/world/roomSchema';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { arenaSpawnPoints } from '../../src/world/arenaSpawns';
import { conquestMode } from '../../src/world/modes';
import { modeForArena, validateMode } from '../../src/world/modeSchema';

it('Zajezdnia Maglev: ADR 0011, pięć punktów i wszystkie spawny mają dojście', () => {
  const arena = generate();
  const report = checkArena(arena);
  expect(report.errors).toEqual([]);
  const room = roomSchema.parse(arena.toRoom());
  const mode = modeForArena(conquestMode, room);
  expect(mode.maxAlive).toBe(12);
  expect(mode.enemyTickets).toBe(200);
  expect(room.spawnPoints.length).toBeGreaterThanOrEqual(22);
  expect(arenaSpawnPoints(room)).toHaveLength(29);
  validateMode(mode, room, mode.enemies);
  const nav = new ArenaNavigation(room);
  for (const start of [room.playerSpawn, ...arenaSpawnPoints(room)])
    for (const point of room.arena!.points)
      expect(nav.path(start, point.position).at(-1)).toEqual(point.position);
}, 30_000);

it('indeks przeszkód zachowuje ścieżki pełnego skanowania, także przy obrotach i granicach komórek', () => {
  const room = generate().toRoom();
  const indexed = new ArenaNavigation(room);
  // Komórki większe od mapy maskują lokalne granice indeksu przeszkód.
  const reference = new ArenaNavigation({
    ...room,
    arena: { ...room.arena!, batchCellM: 10000 },
  });
  for (const spawn of arenaSpawnPoints(room))
    for (const point of room.arena!.points)
      expect(indexed.path(spawn, point.position)).toEqual(
        reference.path(spawn, point.position),
      );
});
