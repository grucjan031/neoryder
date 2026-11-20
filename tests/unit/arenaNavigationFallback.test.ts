import { describe, expect, it } from 'vitest';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { ArenaSurfaceNavigation } from '../../src/world/arenaSurfaceNavigation';
import { roomDefinitions } from '../../src/world/rooms';
import type { RoomDefinition } from '../../src/world/roomSchema';

function room(walkable: boolean): RoomDefinition {
  const base = roomDefinitions.get('arenaOverpass')!;
  return {
    ...base,
    playerSpawn: { x: -15, y: 0, z: -15 },
    blocks: [
      {
        position: { x: 0, y: -0.5, z: 0 },
        size: { x: 40, y: 1, z: 40 },
        walkable,
      },
      {
        position: { x: 0, y: 1.5, z: 0 },
        size: { x: 4, y: 3, z: 4 },
        walkable: false,
      },
    ],
    arena: {
      ...base.arena!,
      navigationCellM: 1,
      navigationClearanceM: 0.8,
      navigationMaxRiseM: 0.6,
      navigationHeadroomM: 2,
    },
  } as RoomDefinition;
}

// Środek komórki (2, 0) leży w marginesie 0,8 m od ściany (x = 2): komórka odrzucona.
const nearWall = { x: 2.3, y: 0, z: 0.2 };
const start = { x: -15, y: 0, z: -15 };

describe('fallback nawigacji na najbliższą przejezdną komórkę', () => {
  it('ArenaNavigation: cel w marginesie przeszkody ma ścieżkę', () => {
    const nav = new ArenaNavigation(room(false));
    expect(nav.path(start, nearWall).length).toBeGreaterThan(0);
  });
  it('ArenaNavigation: start w marginesie przeszkody ma ścieżkę', () => {
    const nav = new ArenaNavigation(room(false));
    expect(nav.path(nearWall, { x: 15, y: 0, z: 15 }).length).toBeGreaterThan(
      0,
    );
  });
  it('ArenaSurfaceNavigation: cel w marginesie przeszkody ma ścieżkę', () => {
    const nav = new ArenaSurfaceNavigation(room(true));
    expect(nav.path(start, nearWall).length).toBeGreaterThan(0);
    expect(nav.next(start, nearWall)).not.toEqual(start);
  });
  it('ArenaSurfaceNavigation: start w marginesie przeszkody ma ścieżkę', () => {
    const nav = new ArenaSurfaceNavigation(room(true));
    const goal = { x: 15, y: 0, z: 15 };
    expect(nav.path(nearWall, goal).length).toBeGreaterThan(0);
    expect(nav.next(nearWall, goal)).not.toEqual(nearWall);
  });
});
