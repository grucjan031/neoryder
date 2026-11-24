import { describe, expect, it } from 'vitest';
// Mały pokój 24 × 24 m (dawny combatYard) jako stały fixture testów loadera: pokoje runu są większe.
import yard from './fixtures/legacyYard.json';
import pillars from '../../src/data/rooms/combatPillars.json';
import { loadRoom, roomSchema } from '../../src/world/roomSchema';
import { loadRoomDefinitions, roomDefinitions } from '../../src/world/rooms';
import { generateSectorMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';

const roomFiles = Object.keys(
  import.meta.glob('../../src/data/rooms/*.json'),
).map((path) =>
  path
    .split('/')
    .pop()!
    .replace(/.json$/, ''),
);

describe('pokoje F3: format, loader i układ', () => {
  it('ładuje wszystkie pliki JSON z katalogu i zachowuje dane układu', () => {
    expect([...roomDefinitions.keys()].sort()).toEqual([...roomFiles].sort());
    expect(roomDefinitions.size).toBeGreaterThanOrEqual(2);
    expect(loadRoom(yard)).toEqual(yard);
    expect(yard.blocks[0]?.size).toEqual({ x: 24, y: 1, z: 24 });
    for (const id of [yard.id, pillars.id]) {
      const room = roomDefinitions.get(id)!;
      expect(room).toBeDefined();
      expect(loadRoom(room)).toEqual(room);
      expect(room.spawnPoints.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('pule sektora wskazują istniejące pokoje właściwego typu i pokrywają mapę', () => {
    const pools = kuroganeSector.roomPools!;
    for (const [type, ids] of Object.entries(pools))
      for (const id of ids ?? []) {
        const room = roomDefinitions.get(id);
        expect(room, id).toBeDefined();
        expect(room!.type).toBe(type);
      }
    const used = new Set<string>();
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f'])
      for (const layer of generateSectorMap(kuroganeSector, seed).layers)
        for (const node of layer) used.add(node.type);
    for (const type of used)
      expect(pools[type as keyof typeof pools]?.length, type).toBeGreaterThan(
        0,
      );
    expect(used.has('boss')).toBe(true);
    for (const id of pools.boss ?? [])
      expect(roomDefinitions.get(id)!.doors.map((door) => door.role)).toEqual([
        'entry',
      ]);
  });

  it('wymaga poprawnego celu zagadki i spójnego wskazania bramki', () => {
    const plate = roomDefinitions.get('puzzlePlate')!;
    const laser = roomDefinitions.get('puzzleLaser')!;
    expect(plate.puzzle?.kind).toBe('plate');
    expect(laser.puzzle?.kind).toBe('laser');
    expect(() => loadRoom({ ...plate, puzzle: undefined })).toThrow(
      /definicji zagadki/,
    );
    expect(() => loadRoom({ ...plate, type: 'rest' })).toThrow(
      /definicji zagadki/,
    );
    expect(() => loadRoom({ ...laser, hazards: [] })).toThrow(
      /wskazania bramki/,
    );
    const { object, position, radiusM } = plate.puzzle as Extract<
      NonNullable<typeof plate.puzzle>,
      { kind: 'plate' }
    >;
    const off = { x: 500, y: object.position.y, z: 500 };
    expect(() =>
      loadRoom({
        ...plate,
        puzzle: {
          kind: 'plate',
          object: { ...object, position: off },
          position,
          radiusM,
        },
      }),
    ).toThrow(/nad podłogą/);
    expect(() =>
      loadRoom({
        ...plate,
        puzzle: {
          kind: 'plate',
          object,
          position: { ...position, y: position.y + 1 },
          radiusM,
        },
      }),
    ).toThrow(/Płyta naciskowa/);
    expect(() =>
      loadRoom({
        ...plate,
        puzzle: {
          kind: 'plate',
          object: {
            ...object,
            position: {
              ...object.position,
              x: plate.playerSpawn.x,
              z: plate.playerSpawn.z,
            },
          },
          position,
          radiusM,
        },
      }),
    ).toThrow(/punktu startu/);
    const hazard = laser.hazards![0]!;
    if (hazard.kind !== 'laser_gate') throw new Error('oczekiwano lasera');
    expect(() =>
      loadRoom({
        ...laser,
        hazards: [{ ...hazard, to: { ...hazard.from } }],
      }),
    ).toThrow(/różnych końcach/);
  });

  it('strefa osłony obejmuje start i przecina skończony odcinek lasera', () => {
    const room = roomDefinitions.get('puzzleLaser')!;
    const puzzle = room.puzzle!;
    const beam = room.hazards![0]!;
    if (beam.kind !== 'laser_gate') throw new Error('oczekiwano lasera');
    const workArea = {
      kind: 'box',
      position: beam.from,
      size: { x: 1, y: 1, z: 1 },
    };
    expect(() =>
      loadRoom({ ...room, puzzle: { ...puzzle, workArea } }),
    ).toThrow(/na starcie/);
    expect(() =>
      loadRoom({
        ...room,
        hazards: [{ ...beam, from: beam.to, to: { ...beam.to, x: 3.8 } }],
      }),
    ).toThrow(/odcinek wiązki/);
    expect(
      loadRoom({ ...room, puzzle: { ...puzzle, workArea: undefined } }).puzzle
        ?.workArea,
    ).toBeUndefined();
  });

  it('odrzuca punkt w filarze, osłonie i na krawędzi bloku', () => {
    for (const point of [
      { x: -7, z: 3 },
      { x: -4, z: -3 },
      { x: -6, z: 3 },
    ]) {
      expect(() =>
        loadRoom({ ...yard, spawnPoints: [point, ...yard.spawnPoints] }),
      ).toThrow(/w bloku/);
    }
    expect(() =>
      loadRoom({ ...yard, playerSpawn: { x: -7, y: 0, z: 3 } }),
    ).toThrow(/w bloku/);
  });

  it('odrzuca punkty i gracza poza podłogą oraz brak podłogi', () => {
    for (const point of [
      { x: 13, z: 0 },
      { x: 0, z: -13 },
    ]) {
      expect(() =>
        loadRoom({ ...yard, spawnPoints: [point, ...yard.spawnPoints] }),
      ).toThrow(/poza granicami/);
      expect(() =>
        loadRoom({ ...yard, playerSpawn: { ...point, y: 0 } }),
      ).toThrow(/poza granicami/);
    }
    expect(() => loadRoom({ ...yard, blocks: yard.blocks.slice(1) })).toThrow(
      /podłogi/,
    );
  });

  it('odrzuca oddzielony punkt także za cienką ścianą między komórkami', () => {
    for (const thickness of [1, 0.1]) {
      const room = {
        ...yard,
        blocks: [
          ...yard.blocks,
          {
            size: { x: 24, y: 4, z: thickness },
            position: { x: 0, y: 2, z: 0 },
          },
        ],
      };
      expect(() => loadRoom(room)).toThrow(/nieosiągalny/);
      const result = roomSchema.safeParse(room);
      expect(result.success).toBe(false);
      if (!result.success)
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path.join('.') === 'spawnPoints.0' &&
              /nieosiągalny/.test(issue.message),
          ),
        ).toBe(true);
    }
  });

  it('nie przechodzi przez narożniki po skosie', () => {
    const blocks = [
      yard.blocks[0]!,
      ...[
        { x: 1.5, z: 0.5 },
        { x: -0.5, z: 0.5 },
        { x: 0.5, z: 1.5 },
        { x: 0.5, z: -0.5 },
      ].map(({ x, z }) => ({
        size: { x: 1, y: 4, z: 1 },
        position: { x, y: 2, z },
      })),
    ];
    expect(() =>
      loadRoom({
        ...yard,
        blocks,
        playerSpawn: { x: 0.5, y: 0, z: 0.5 },
      }),
    ).toThrow(/nieosiągalny/);
  });

  it('wymaga jednej pary drzwi i unikalnych id; boss ma tylko entry', () => {
    const [entry, exit] = yard.doors;
    expect(() => loadRoom({ ...yard, doors: [] })).toThrow(/entry/);
    expect(() => loadRoom({ ...yard, doors: [entry] })).toThrow(/exit/);
    expect(() => loadRoom({ ...yard, doors: [exit] })).toThrow(/entry/);
    expect(() => loadRoom({ ...yard, doors: [...yard.doors, entry] })).toThrow(
      /entry/,
    );
    expect(() =>
      loadRoom({ ...yard, doors: [entry, { ...exit, id: entry!.id }] }),
    ).toThrow(/Powtórzone id drzwi/);
    expect(
      loadRoom({ ...yard, type: 'boss', doors: [entry] }).doors,
    ).toHaveLength(1);
    expect(() => loadRoom({ ...yard, type: 'boss' })).toThrow(/exit/);
  });

  it('wymaga 4 spawnów w combat/elite, dopuszcza pustą listę w rest', () => {
    for (const type of ['combat', 'elite'])
      expect(() =>
        loadRoom({ ...yard, type, spawnPoints: yard.spawnPoints.slice(0, 3) }),
      ).toThrow(/co najmniej 4/);
    expect(
      loadRoom({ ...yard, type: 'rest', spawnPoints: [] }).spawnPoints,
    ).toEqual([]);
  });

  it('odrzuca powtórzone id pokoi i waliduje każdy wpis loadera', () => {
    expect(() =>
      loadRoomDefinitions([yard, { ...pillars, id: yard.id }]),
    ).toThrow(/Powtórzone id pokoju: combatYard/);
    expect(() =>
      loadRoomDefinitions([yard, { ...pillars, doors: [] }]),
    ).toThrow(/entry/);
    expect(loadRoomDefinitions([]).size).toBe(0);
  });

  it('obsługuje przesuniętą podłogę i ujemne współrzędne siatki', () => {
    const shift = (point: { x: number; z: number }) => ({
      x: point.x - 30,
      z: point.z + 20,
    });
    const shifted = {
      ...yard,
      playerSpawn: { ...yard.playerSpawn, ...shift(yard.playerSpawn) },
      blocks: yard.blocks.map((block) => ({
        ...block,
        position: { ...block.position, ...shift(block.position) },
      })),
      spawnPoints: yard.spawnPoints.map(shift),
      doors: yard.doors.map((door) => ({
        ...door,
        position: { ...door.position, ...shift(door.position) },
      })),
      // combatYard ma tylko zagrożenia z `position` (pole, beczka).
      hazards: yard.hazards.map((hazard) => ({
        ...hazard,
        position: { ...hazard.position, ...shift(hazard.position) },
      })),
    };
    expect(loadRoom(shifted)).toEqual(shifted);
  });
});
