import { expect, it } from 'vitest';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { ArenaSurfaceNavigation } from '../../src/world/arenaSurfaceNavigation';
import { facePoint } from '../../src/world/elevatorSchema';
import { roomDefinitions } from '../../src/world/rooms';
import sector from '../../src/data/sectors/kurogane.json';
import { tuning } from '../../src/core/tuning';

const room = roomDefinitions.get('run6')!;
const nav = new ArenaNavigation(room);
const surfaceNav = new ArenaSurfaceNavigation(room);
const stairsNav = new ArenaNavigation({ ...room, elevators: [] });
interface Goal {
  x: number;
  y: number;
  z: number;
}

function reach(from: Goal, goal: Goal, navigator = stairsNav): Goal[] {
  const path = navigator.path(from, goal);
  const arrived = path.at(-2);
  expect(arrived, JSON.stringify({ from, goal })).toBeDefined();
  expect(arrived!.y, JSON.stringify(goal)).toBeCloseTo(goal.y, 1);
  expect(
    Math.hypot(arrived!.x - goal.x, arrived!.z - goal.z),
    JSON.stringify(goal),
  ).toBeLessThan(1);
  return path;
}

const targets = [
  { id: 'R1 Hol', x: -4, y: 0, z: 10 },
  { id: 'R2 Salon', x: 8, y: 0, z: -5 },
  { id: 'R3 Jadalnia', x: -23, y: 0, z: -1 },
  { id: 'R4 Kuchnia', x: -23, y: 0, z: -14 },
  { id: 'R5 Basen', x: 23, y: 0, z: 1 },
  { id: 'R6 Garaż', x: -20, y: 0, z: 13 },
  { id: 'R7 Ochrona', x: 18, y: 0, z: 10 },
  { id: 'R8 Biuro', x: 0, y: 4.8, z: -22 },
  { id: 'R9 Biblioteka', x: -21, y: 4.8, z: -24 },
  { id: 'R10 Trofea', x: 21, y: 4.8, z: -27 },
  { id: 'R11 Sypialnia', x: -14, y: 4.8, z: -39 },
  { id: 'R12 Spa', x: 14, y: 4.8, z: -33 },
  { id: 'R13 Przesłuchania', x: -22, y: -4.8, z: 24 },
  { id: 'R14 Winiarnia', x: 0, y: -4.8, z: 21 },
  { id: 'R15 Bunkier', x: 16, y: -4.8, z: 21 },
  { id: 'Antresola W', x: -14.4, y: 4.8, z: -1 },
  { id: 'Antresola E', x: 14.4, y: 4.8, z: -1 },
  { id: 'Tablica Iskry FPP', x: 0, y: 4.8, z: -28 },
];

it.each(targets)(
  'run6: $id jest osiągalne ze startu i z powrotem bez windy',
  (goal) => {
    reach(room.playerSpawn, goal);
    reach(goal, room.playerSpawn);
  },
);

const stairEnds = [
  ...[-6.8, 6.8].flatMap((x) => [
    { x, y: 0, aisle: 15, ramp: 17, rise: -0.48 },
    { x, y: -2.4, aisle: 22, ramp: 20, rise: 0.48 },
    { x, y: -2.4, aisle: 23, ramp: 25, rise: -0.48 },
    { x, y: -4.8, aisle: 30, ramp: 28, rise: 0.48 },
  ]),
  ...[-13.6, 13.6].flatMap((x) => [
    { x, y: 0, aisle: -0.8, ramp: -2.8, rise: 0.48 },
    { x, y: 2.4, aisle: -7.8, ramp: -5.8, rise: -0.48 },
    { x, y: 2.4, aisle: -8.8, ramp: -10.8, rise: 0.48 },
    { x, y: 4.8, aisle: -15.8, ramp: -13.8, rise: -0.48 },
  ]),
];

it.each(stairEnds)(
  'run6: próg schodów x=$x y=$y z=$aisle łączy się ze spocznikiem',
  (end) => {
    const aisle = { x: end.x, y: end.y, z: end.aisle };
    const ramp = { x: end.x, y: end.y + end.rise, z: end.ramp };
    for (const [from, to] of [
      [aisle, ramp],
      [ramp, aisle],
    ] as const) {
      const path = surfaceNav.path(from, to);
      expect(path.length).toBeGreaterThan(2);
      const arrived = path.at(-2)!;
      expect(Math.abs(arrived.y - to.y)).toBeLessThan(0.35);
      expect(Math.hypot(arrived.x - to.x, arrived.z - to.z)).toBeLessThan(0.6);
      for (const p of path) {
        expect(Math.abs(p.x - end.x)).toBeLessThan(1.2);
        expect(p.z).toBeGreaterThanOrEqual(Math.min(end.aisle, end.ramp) - 0.6);
        expect(p.z).toBeLessThanOrEqual(Math.max(end.aisle, end.ramp) + 0.6);
      }
    }
  },
);

it('run6: winda piwniczna ma podparte progi i trasy w obie strony, schody pozostają alternatywą', () => {
  expect(room.elevators).toHaveLength(1);
  const lift = room.elevators![0]!;
  expect(lift).toMatchObject({
    id: 'cellar-interrogation-lift',
    model: 'res_elevator_cab',
    stops: [
      { y: -4.8, doorSide: 's' },
      { y: 0, doorSide: 'n' },
    ],
  });
  const stops = lift.stops.map((stop) =>
    facePoint(lift, stop.doorSide, stop.y, 0.5),
  );
  for (const stop of lift.stops) {
    const p = facePoint(lift, stop.doorSide, stop.y, 0.05);
    expect(
      room.blocks.some(
        (b) =>
          b.walkable === true &&
          !b.rotation?.x &&
          !b.rotation?.z &&
          Math.abs(b.position.y + b.size.y / 2 - stop.y) < 1e-4 &&
          Math.abs(p.x - b.position.x) <= b.size.x / 2 &&
          Math.abs(p.z - b.position.z) <= b.size.z / 2,
      ),
    ).toBe(true);
  }
  for (const [from, to, a, b] of [
    [stops[0]!, stops[1]!, 0, 1],
    [stops[1]!, stops[0]!, 1, 0],
  ] as const) {
    expect(nav.elevatorRoute(from, to)).toMatchObject([
      { id: lift.id, kind: 'elevator', from: a, to: b },
    ]);
    reach(from, to, nav);
    reach(from, to);
  }
});

it('run6: wszystkie 20 spawnów i wyjście są osiągalne po schodach', () => {
  expect(room.spawnPoints).toHaveLength(20);
  for (const p of room.spawnPoints)
    reach(room.playerSpawn, { ...p, y: p.y ?? 0 });
  const exit = room.doors.find((d) => d.role === 'exit')!;
  reach(room.playerSpawn, { ...exit.position, y: -4.8 });
});

it('run6: kapsuła mieści się na starcie i we wszystkich 20 punktach spawnu', () => {
  const { capsuleHeight, capsuleRadius } = tuning.player;
  for (const p of [room.playerSpawn, ...room.spawnPoints]) {
    const y = p.y ?? 0;
    const hits = room.blocks.filter((b) => {
      const bottom = b.position.y - b.size.y / 2;
      const top = b.position.y + b.size.y / 2;
      if (top <= y + 0.05 || bottom >= y + capsuleHeight) return false;
      const quarter = Math.abs(Math.cos(b.rotation?.y ?? 0)) < 1e-5;
      const hx = (quarter ? b.size.z : b.size.x) / 2;
      const hz = (quarter ? b.size.x : b.size.z) / 2;
      return (
        Math.hypot(
          Math.max(Math.abs(p.x - b.position.x) - hx, 0),
          Math.max(Math.abs(p.z - b.position.z) - hz, 0),
        ) < capsuleRadius
      );
    });
    expect(
      hits.map((b) => b.model ?? b.material),
      JSON.stringify(p),
    ).toEqual([]);
  }
});

it('run6: osłony w salonie nie zostawiają pustego kwadratu większego niż 8 m', () => {
  const covers = room.blocks.filter(
    (b) =>
      b.visible !== false &&
      !b.walkable &&
      !b.ceiling &&
      b.size.y >= 0.8 &&
      b.position.y - b.size.y / 2 >= -0.5 &&
      b.position.y - b.size.y / 2 <= 1.2,
  );
  const step = 0.5;
  const cells = Array.from({ length: 64 }, () => Array<number>(44).fill(0));
  let largest = 0;
  for (let i = 0; i < cells.length; i++) {
    for (let j = 0; j < cells[i]!.length; j++) {
      const x = -16 + (i + 0.5) * step;
      const z = -18 + (j + 0.5) * step;
      const blocked = covers.some((b) => {
        const quarter = Math.abs(Math.cos(b.rotation?.y ?? 0)) < 1e-5;
        return (
          Math.abs(x - b.position.x) <=
            (quarter ? b.size.z : b.size.x) / 2 + 0.2 &&
          Math.abs(z - b.position.z) <=
            (quarter ? b.size.x : b.size.z) / 2 + 0.2
        );
      });
      if (blocked) continue;
      cells[i]![j] =
        1 +
        Math.min(
          i && j ? cells[i - 1]![j - 1]! : 0,
          i ? cells[i - 1]![j]! : 0,
          j ? cells[i]![j - 1]! : 0,
        );
      largest = Math.max(largest, cells[i]![j]!);
    }
  }
  expect(largest * step).toBeLessThanOrEqual(8);
});

it('run6: mapa jest w puli walk i elit sektora Kurogane', () => {
  expect(sector.roomPools.combat).toEqual([
    'run1',
    'run2',
    'run3',
    'run4',
    'run6',
  ]);
  expect(sector.roomPools.elite).toEqual(sector.roomPools.combat);
});
