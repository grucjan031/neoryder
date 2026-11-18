import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import generate from '../../tools/arenas/arenaOverpass.mjs';
import { checkArena } from '../../tools/arenas/lib/check.mjs';
import { roomSchema } from '../../src/world/roomSchema';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import {
  conquestSchema,
  freeModePosition,
  modeForArena,
  validateMode,
} from '../../src/world/modeSchema';
import conquestData from '../../src/data/modes/conquest.json';
import { urbanLooks } from '../../src/render/urbanMaterials';

it('Estakada: deterministyczny generator, ADR 0011, materiały, GLB i tryb A–E', () => {
  const builder = generate();
  const room = roomSchema.parse(builder.toRoom());
  expect(builder.toRoom()).toEqual(generate().toRoom());
  expect(
    JSON.parse(readFileSync('src/data/rooms/arenaOverpass.json', 'utf8')),
  ).toEqual(builder.toRoom());
  const report = checkArena(builder);
  expect(report.errors).toEqual([]);
  expect(report.metrics.areaM2).toBeGreaterThan(40000);
  expect(room.arena!.spawnPoints!.length).toBeGreaterThanOrEqual(24);
  for (const model of new Set([
    ...room.blocks.flatMap((b) => (b.model ? [b.model] : [])),
    ...room.decor!.map((d) => d.model),
  ]))
    expect(existsSync(`public/assets/models/city/${model}.glb`), model).toBe(
      true,
    );
  const blocked = [];
  for (const spawn of [room.playerSpawn, ...room.arena!.spawnPoints!]) {
    const position = { ...spawn, y: spawn.y ?? 0 };
    if (!freeModePosition(room, position, 0.8)) blocked.push(position);
  }
  expect(blocked).toEqual([]);
  const mode = modeForArena(conquestSchema.parse(conquestData), room);
  validateMode(mode, room, mode.enemies);
  expect(mode.points.map((p) => p.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  expect(mode.enemyTickets).toBe(200);
  for (const kind of [
    'gas_station_tiles',
    'highway_asphalt_worn',
    'scaffold_planks',
    'hazard_stripes_worn',
  ] as const) {
    expect(urbanLooks[kind].texture).toBe(kind);
    expect(existsSync(`public/assets/textures/surfaces/${kind}.webp`)).toBe(
      true,
    );
  }
});

it.each(['southwest', 'northeast', 'scaffold', 'upperRamps'] as const)(
  'Estakada: po zamknięciu %s pozostaje druga trasa między A–E',
  (closed) => {
    const room = roomSchema.parse(generate().toRoom());
    room.blocks = room.blocks.filter((block) => {
      if (!block.walkable || !block.rotation?.z) return true;
      if (closed === 'southwest')
        return ![62, 134, -48].includes(block.position.z);
      if (closed === 'northeast')
        return ![-156, -60, -48].includes(block.position.z);
      if (closed === 'scaffold') return block.material !== 'scaffold_planks';
      return ![-64, 28].includes(block.position.z);
    });
    const nav = new ArenaNavigation(room);
    for (const from of room.arena!.points)
      for (const to of room.arena!.points)
        expect(
          nav.path(from.position, to.position).at(-1),
          `${from.id} → ${to.id}`,
        ).toEqual(to.position);
  },
);

it('Estakada: budowa siatki i pięciu pól ≤500 ms; każdy spawn dociera do A–E', () => {
  const room = roomSchema.parse(generate().toRoom());
  const start = performance.now();
  const navigation = new ArenaNavigation(room);
  for (const point of room.arena!.points)
    expect(
      navigation.path(room.playerSpawn, point.position).at(-1),
      point.id,
    ).toEqual(point.position);
  const ms = performance.now() - start;
  console.info(`[perf] arenaOverpass nawigacja + 5 pól: ${ms.toFixed(2)} ms`);
  expect(ms).toBeLessThanOrEqual(500);
  for (const spawn of room.arena!.spawnPoints!)
    for (const point of room.arena!.points)
      expect(
        navigation.path({ ...spawn, y: spawn.y ?? 0 }, point.position).at(-1),
        `${JSON.stringify(spawn)} → ${point.id}`,
      ).toEqual(point.position);
});
