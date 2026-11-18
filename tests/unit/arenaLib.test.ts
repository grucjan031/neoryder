import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Euler, Quaternion, Vector3 } from 'three';
import { roomSchema } from '../../src/world/roomSchema';
import type { RoomDefinition } from '../../src/world/roomSchema';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { tuning } from '../../src/core/tuning';
import generate from '../../tools/arenas/arenaLibDemo.mjs';
import {
  createArena,
  createRng,
  stableJson,
  vec,
} from '../../tools/arenas/lib/arena.mjs';
import type { Block } from '../../tools/arenas/lib/arena.mjs';
import {
  CONTROLLER_LIMITS,
  createPrimitives,
} from '../../tools/arenas/lib/prims.mjs';
import { checkArena, measureWalkable } from '../../tools/arenas/lib/check.mjs';
import { arenaSvg } from '../../tools/arenas/lib/map.mjs';

const rect = (minX: number, maxX: number, minZ: number, maxZ: number) => ({
  minX,
  maxX,
  minZ,
  maxZ,
});
const blank = () =>
  createArena({
    id: 'test',
    name: 'Test',
    seed: 'test',
    bounds: rect(0, 60, 0, 50),
  });
const worldPoint = (b: Block, x: number, y: number, z: number) =>
  new Vector3(x, y, z)
    .applyEuler(
      new Euler(b.rotation?.x ?? 0, b.rotation?.y ?? 0, b.rotation?.z ?? 0),
    )
    .add(new Vector3(b.position.x, b.position.y, b.position.z));

describe('biblioteka generatorów aren', () => {
  it('demo i zapisany fixture przechodzą pełny roomSchema z osiągalnością spawnów', () => {
    const room = generate().toRoom();
    expect(roomSchema.safeParse(room).error).toBeUndefined();
    const fixture: unknown = JSON.parse(
      readFileSync('tests/fixtures/arenaLibDemo.json', 'utf8'),
    );
    expect(roomSchema.parse(fixture)).toEqual(roomSchema.parse(room));
    const report = checkArena(generate(), undefined, { demo: true });
    expect(report.errors).toEqual([]);
    expect(report.metrics.zoneKinds).toHaveLength(5);
    expect(report.metrics.spawnCount).toBe(16);
    expect(report.metrics.levels).toEqual([-3, 0, 2, 3, 4, 8]);
    expect(report.metrics.outlineFillRatio).toBeLessThan(0.9);
    const strict = checkArena(generate());
    expect(strict.errors.map((e) => e.code)).toContain('dimensions');
    expect(strict.errors.map((e) => e.code)).toContain('walkable-area');
  });

  it('dwa generowania dają identyczny JSON i SVG; seed zmienia rozrzut', () => {
    const a = generate(),
      b = generate();
    expect(stableJson(a.toRoom())).toBe(stableJson(b.toRoom()));
    expect(arenaSvg(a)).toBe(arenaSvg(b));
    const random = createRng('one'),
      same = createRng('one'),
      other = createRng('two');
    const sequence = Array.from({ length: 16 }, random);
    expect(sequence).toEqual(Array.from({ length: 16 }, same));
    expect(sequence).not.toEqual(Array.from({ length: 16 }, other));
    expect(sequence.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('write używa stabilnych kluczy, LF i końcowego nowego wiersza', () => {
    const directory = mkdtempSync(join(tmpdir(), 'arena-lib-'));
    try {
      const arena = generate(),
        path = join(directory, 'nested', 'demo.json');
      arena.write(path);
      const json = readFileSync(path, 'utf8');
      expect(json).toBe(stableJson(arena.toRoom()));
      expect(json).not.toContain('\r');
      expect(json.endsWith('\n')).toBe(true);
      expect(stableJson({ b: 2, a: 1 })).toBe(stableJson({ a: 1, b: 2 }));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('limity generatora zgadzają się z kontrolerem gry', () => {
    expect(CONTROLLER_LIMITS).toEqual({
      maxSlopeDeg: tuning.player.maxSlopeDeg,
      stepHeight: tuning.player.stepHeight,
      stepMinWidth: tuning.player.stepMinWidth,
    });
  });

  it.each([vec(20, 4, 0), vec(-20, 4, 0), vec(0, 4, 20), vec(12, -3, 16)])(
    'rampa od (0,0,0) do %o ma oba końce górnej płaszczyzny dokładnie na podłodze',
    (to) => {
      const arena = blank(),
        p = createPrimitives(arena),
        from = vec(0, 0, 0);
      const result = p.ramp({ from, to, width: 4 });
      const block = result.blocks[0]!;
      const ends = [-1, 1].map((sign) =>
        worldPoint(block, (sign * block.size.x) / 2, block.size.y / 2, 0),
      );
      for (const endpoint of [from, to])
        expect(
          Math.min(
            ...ends.map((v) =>
              v.distanceTo(new Vector3(endpoint.x, endpoint.y, endpoint.z)),
            ),
          ),
        ).toBeLessThan(1e-8);
      expect(result.rise).toBe(to.y);
      expect(Math.abs(result.angle)).toBeCloseTo(
        Math.atan2(Math.abs(to.y), Math.hypot(to.x, to.z)),
      );
      if (to.z)
        expect(arena.metadata.warnings.map((w) => w.code)).toContain(
          'navigation-rotation',
        );
    },
  );

  it('rampa ostrzega osobno o limicie nawigacji i kontrolera', () => {
    const arena = blank(),
      p = createPrimitives(arena);
    p.ramp({ from: vec(0, 0, 0), to: vec(10, 12, 0), width: 4 });
    expect(arena.metadata.warnings.map((w) => w.code)).toEqual([
      'ramp-controller-slope',
      'ramp-navigation-slope',
    ]);
  });

  it.each([1, -1])(
    'schody w kierunku %i mają ciągły bieg bez szczelin i kończą się na podłodze',
    (direction) => {
      const arena = blank(),
        p = createPrimitives(arena);
      const result = p.stairs({
        from: vec(0, 0, 0),
        to: vec(20 * direction, 4, 0),
        width: 4,
        stepRise: 0.2,
        stepDepth: 1,
      });
      expect(result.count).toBe(20);
      expect(result.stepRise).toBeCloseTo(0.2);
      expect(result.angle).toBeCloseTo(Math.atan2(4, 20));
      const first = result.blocks[0]!,
        last = result.blocks.at(-1)!;
      expect(first.position.y - first.size.y / 2).toBeCloseTo(0);
      expect(first.position.y + first.size.y / 2).toBeLessThanOrEqual(
        tuning.player.stepHeight,
      );
      expect(last.position.y + last.size.y / 2).toBeCloseTo(4);
      expect(last.position.x + (direction * last.size.x) / 2).toBeCloseTo(
        20 * direction,
      );
      for (let i = 1; i < result.blocks.length; i++) {
        const a = result.blocks[i - 1]!,
          b = result.blocks[i]!;
        expect(a.position.x + (direction * a.size.x) / 2).toBeCloseTo(
          b.position.x - (direction * b.size.x) / 2,
        );
        expect(
          b.position.y + b.size.y / 2 - a.position.y - a.size.y / 2,
        ).toBeCloseTo(result.stepRise);
      }
      expect(() =>
        p.stairs({ from: vec(0, 0, 0), to: vec(2, 4, 0), width: 3 }),
      ).toThrow('zbyt krótki');
    },
  );

  it.each([vec(30, 0, 0), vec(0, 0, 30), vec(18, 0, 24)])(
    'ściana do %o pozostawia pełną szerokość i wysokość drzwi',
    (to) => {
      const arena = blank(),
        p = createPrimitives(arena);
      const result = p.wall(vec(0, 0, 0), to, 6, 0.4, 'concrete', {
        openings: [{ at: 15, width: 5, height: 3 }],
      });
      const dir = new Vector3(to.x, 0, to.z).normalize();
      // Wnętrze każdego otworu badamy w układzie lokalnym rzeczywistych obróconych colliderów.
      for (const at of [12.51, 13, 15, 17, 17.49])
        for (const height of [0.1, 1.8, 2.99]) {
          const point = dir.clone().multiplyScalar(at).setY(height);
          for (const b of result.blocks) {
            const local = point
              .clone()
              .sub(new Vector3(b.position.x, b.position.y, b.position.z))
              .applyQuaternion(
                new Quaternion()
                  .setFromEuler(
                    new Euler(
                      b.rotation?.x ?? 0,
                      b.rotation?.y ?? 0,
                      b.rotation?.z ?? 0,
                    ),
                  )
                  .invert(),
              );
            expect(
              Math.abs(local.x) < b.size.x / 2 &&
                Math.abs(local.y) < b.size.y / 2 &&
                Math.abs(local.z) < b.size.z / 2,
            ).toBe(false);
          }
        }
    },
  );

  it('budynek z wnętrzem ma dojście przez drzwi i otwarte stropy nad schodami aż na dach', () => {
    const arena = blank(),
      p = createPrimitives(arena);
    p.floor(rect(0, 60, 0, 50));
    arena.roomMeta({ playerSpawn: vec(5, 0, 30) });
    const building = p.building({
      rect: rect(12, 45, 10, 35),
      height: 6,
      floors: 2,
      interior: true,
      stairs: { stepDepth: 1 },
      roofAccessible: true,
      doors: [{ side: 'south', at: 16, width: 5 }],
    });
    for (const position of [
      vec(35, 0, 25),
      vec(5, 0, 5),
      vec(55, 0, 5),
      vec(55, 0, 45),
    ])
      arena.spawn(position);
    for (const id of ['A', 'B', 'C'] as const) arena.point(id, vec(5, 0, 5));
    const room = roomSchema.parse(arena.toRoom());
    const nav = new ArenaNavigation(room);
    for (const goal of [vec(35, 0, 25), vec(40, 3, 25), vec(40, 6, 25)]) {
      const path = nav.path(room.playerSpawn, goal);
      expect(
        path.length,
        `brak ścieżki do ${JSON.stringify(goal)}`,
      ).toBeGreaterThan(0);
      expect(path.at(-1)).toEqual(goal);
    }
    expect(building.flights).toHaveLength(2);
  });

  it.each(['north', 'south', 'east', 'west'] as const)(
    'hala ma osiągalną antresolę %s',
    (side) => {
      const arena = blank(),
        p = createPrimitives(arena);
      p.floor(rect(0, 60, 0, 50));
      arena.roomMeta({ playerSpawn: vec(5, 0, 45) });
      const hall = p.hall({
        rect: rect(10, 50, 5, 40),
        height: 10,
        doors: [{ side: 'south', at: 20, width: 5 }],
        mezzanine: { side, depth: 8, y: 3 },
      });
      const room = arena.toRoom();
      const goal = { ...hall.flight!.to };
      goal.x += side === 'east' ? 2 : side === 'west' ? -2 : 2;
      expect(
        new ArenaNavigation(room).path(room.playerSpawn, goal).length,
      ).toBeGreaterThan(0);
    },
  );

  it('check odróżnia podparty filar od wolnostojącego i wykrywa udział modelu >15%', () => {
    const arena = generate();
    arena.block({ position: vec(140, 4, 10), size: vec(1, 8, 1) });
    arena.block({ position: vec(140, 4, 20), size: vec(1, 8, 1) });
    arena.block({ position: vec(140, 8.5, 20), size: vec(8, 1, 8) });
    for (let i = 0; i < 20; i++)
      arena.decor('city_crates', vec(135 + i, 0, 70));
    const report = checkArena(arena, undefined, { demo: true });
    const pillars = report.errors.find((e) => e.code === 'unsupported-pillars');
    expect(pillars?.details).toEqual([
      { index: arena.toRoom().blocks.length - 3, position: vec(140, 4, 10) },
    ]);
    expect(report.errors.map((e) => e.code)).toContain('prop-share');
  });

  it('powierzchnia nie liczy nakładających się płyt dwukrotnie i odejmuje przeszkody', () => {
    const arena = blank(),
      p = createPrimitives(arena);
    p.floor(rect(0, 10, 0, 10));
    p.floor(rect(0, 10, 0, 10));
    p.floor(rect(0, 10, 0, 10), 4);
    arena.block({ position: vec(5, 1, 5), size: vec(2, 2, 2) });
    expect(measureWalkable(arena.toRoom()).areaM2).toBe(196);
    expect(measureWalkable(arena.toRoom()).levels).toEqual([0, 4]);
  });

  it('check wykrywa kwadrat, brak zróżnicowania, spawny i koła punktów poza granicami', () => {
    const arena = createArena({
      id: 'square',
      name: 'Kwadrat',
      bounds: rect(0, 250, 0, 250),
    });
    createPrimitives(arena).floor(rect(0, 250, 0, 250));
    arena.spawn(vec(251, 0, 5));
    arena.point('A', vec(2, 0, 5), 4);
    const codes = checkArena(arena).errors.map((e) => e.code);
    for (const code of [
      'square-outline',
      'zones',
      'height-levels',
      'out-of-bounds',
      'capture-points',
      'spawn-count',
    ])
      expect(codes).toContain(code);
  });

  it('scatter zachowuje odstępy i margines wokół avoid; informuje o braku miejsca', () => {
    const arena = blank(),
      p = createPrimitives(arena),
      avoid = rect(8, 12, 8, 12);
    const result = p.scatter({
      rect: rect(0, 20, 0, 20),
      models: ['city_crates'],
      count: 20,
      minSpacing: 3,
      avoid: [avoid],
    });
    expect(result.placements).toHaveLength(20);
    result.placements.forEach((a, i) => {
      const pos = a.position;
      expect(pos.x < 6.5 || pos.x > 13.5 || pos.z < 6.5 || pos.z > 13.5).toBe(
        true,
      );
      result.placements
        .slice(i + 1)
        .forEach((b) =>
          expect(
            Math.hypot(pos.x - b.position.x, pos.z - b.position.z),
          ).toBeGreaterThanOrEqual(3),
        );
    });
    p.scatter({
      rect: rect(0, 1, 0, 1),
      models: ['city_crates'],
      count: 2,
      minSpacing: 3,
    });
    expect(arena.metadata.warnings.map((w) => w.code)).toContain(
      'scatter-capacity',
    );
  });

  it('SVG ma wymagane warstwy, skalę i bezpiecznie koduje opisy', () => {
    const arena = generate();
    arena.roomMeta({ name: 'Mapa <test> & "opis"' });
    const svg = arenaSvg(arena);
    for (const id of [
      'blocks',
      'grid',
      'zones',
      'props',
      'spawns',
      'points',
      'player',
    ])
      expect(svg).toContain(`id="${id}"`);
    expect(svg).toContain('50 m');
    expect(svg).toContain('Mapa &lt;test&gt; &amp; &quot;opis&quot;');
    const room: RoomDefinition = arena.toRoom();
    const extended = {
      ...room,
      arena: {
        ...room.arena!,
        points: [
          ...room.arena!.points,
          { id: 'D', position: vec(10, 0, 10), radiusM: 4 },
          { id: 'E', position: vec(20, 0, 10), radiusM: 4 },
        ],
      },
    };
    // Sam rzut potrafi wyświetlić przyszłe punkty D/E, bez rozszerzania kontraktu gry.
    expect(arenaSvg(extended as RoomDefinition)).toContain('>E<title>');
  });

  it('ograniczenia schematu są jawne', () => {
    const arena = blank();
    arena.point('D', vec(10, 0, 10));
    arena.point('E', vec(20, 0, 10));
    expect(arena.toRoom().arena?.points.map((point) => point.id)).toEqual([
      'D',
      'E',
    ]);
    expect(() => arena.spawn(vec(10, 4, 10))).toThrow('wysokości');
  });
});
