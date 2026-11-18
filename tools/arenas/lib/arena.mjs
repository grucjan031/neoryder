import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const vec = (x, y = 0, z = 0) => ({ x, y, z });

export function createRng(seed) {
  let state = 2166136261;
  for (const character of String(seed)) {
    state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function canonical(value) {
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new Error('JSON areny zawiera liczbę nieskończoną lub NaN.');
  if (Object.is(value, -0)) return 0;
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

export const stableJson = (value) =>
  JSON.stringify(canonical(value), null, 2) + '\n';

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stableJson(value), 'utf8');
}

export function assertRect(rect) {
  if (
    !['minX', 'maxX', 'minZ', 'maxZ'].every((key) =>
      Number.isFinite(rect[key]),
    ) ||
    rect.maxX <= rect.minX ||
    rect.maxZ <= rect.minZ
  )
    throw new Error('Prostokąt wymaga skończonych minX < maxX i minZ < maxZ.');
  return rect;
}

export function createArena({
  id,
  name,
  theme = 'neonStreet',
  weather = 'rain',
  seed = id,
  bounds,
}) {
  assertRect(bounds);
  const playerSpawn = vec(bounds.minX + 4, 0, bounds.minZ + 4);
  const room = {
    id,
    name,
    type: 'combat',
    theme,
    weather,
    playerSpawn,
    blocks: [],
    decor: [],
    lights: [],
    spawnPoints: [],
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: { ...playerSpawn },
        size: vec(3, 3, 1),
      },
      {
        id: 'exit',
        role: 'exit',
        position: vec(bounds.maxX - 4, 0, bounds.maxZ - 4),
        size: vec(3, 3, 1),
      },
    ],
    arena: {
      exclusive: true,
      points: [],
      batchCellM: 20,
      navigationCellM: 1,
      navigationMaxRiseM: 0.35,
      navigationHeadroomM: 2,
      navigationClearanceM: 0.8,
    },
  };
  const metadata = {
    seed,
    bounds: structuredClone(bounds),
    zones: [],
    warnings: [],
  };
  const builder = {
    rng: createRng(seed),
    metadata,
    block(box) {
      if (
        !['x', 'y', 'z'].every(
          (key) => Number.isFinite(box.size[key]) && box.size[key] > 0,
        )
      )
        throw new Error('Blok wymaga dodatnich wymiarów.');
      const copy = structuredClone(box);
      room.blocks.push(copy);
      return copy;
    },
    decor(model, position, rotationY = 0, opts = {}) {
      const item = {
        model,
        position: { ...position },
        yaw: rotationY,
        ...opts,
      };
      room.decor.push(structuredClone(item));
      return item;
    },
    light(position, color = '#fff1d6', intensity = 30, range = 15, opts = {}) {
      const item = {
        position: { ...position },
        color,
        intensity,
        range,
        ...opts,
      };
      room.lights.push(structuredClone(item));
      return item;
    },
    spawn(position) {
      if (position.y !== undefined && position.y !== room.playerSpawn.y)
        throw new Error(
          'roomSchema zapisuje spawny w XZ; nie obsługuje osobnej wysokości.',
        );
      room.spawnPoints.push({ x: position.x, z: position.z });
      return builder;
    },
    point(pointId, position, radiusM = 4) {
      if (!['A', 'B', 'C', 'D', 'E'].includes(pointId))
        throw new Error('Punkt przejęcia musi mieć identyfikator A–E.');
      if (room.arena.points.some((point) => point.id === pointId))
        throw new Error(`Powtórzony punkt ${pointId}.`);
      room.arena.points.push({
        id: pointId,
        position: { ...position },
        radiusM,
      });
      return builder;
    },
    zone(zoneName, rect, kind) {
      assertRect(rect);
      if (!['open', 'dense', 'interior', 'high', 'low'].includes(kind))
        throw new Error(`Nieznany rodzaj strefy: ${kind}.`);
      metadata.zones.push({ name: zoneName, rect: { ...rect }, kind });
      return builder;
    },
    arenaMeta(fields) {
      Object.assign(room.arena, structuredClone(fields));
      return builder;
    },
    roomMeta(fields) {
      if (['id', 'blocks', 'arena', 'spawnPoints'].some((key) => key in fields))
        throw new Error(
          'Użyj metod budowniczego do id, blocks, arena i spawnPoints.',
        );
      Object.assign(room, structuredClone(fields));
      return builder;
    },
    warn(code, message) {
      metadata.warnings.push({ code, message });
    },
    toRoom() {
      return canonical(structuredClone(room));
    },
    write(path) {
      writeJson(path, builder.toRoom());
    },
  };
  return builder;
}
