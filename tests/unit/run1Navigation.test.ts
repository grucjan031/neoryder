import { expect, it } from 'vitest';
import { Euler, Matrix3, Matrix4, Ray, Vector3 } from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { roomDefinitions } from '../../src/world/rooms';

it('run1: ze śluzy można dojść do wyjścia, spawnów i wszystkich podestów', () => {
  const room = roomDefinitions.get('run1')!;
  const nav = new ArenaNavigation(room);
  const exit = room.doors.find((door) => door.role === 'exit')!;
  const platforms = [
    [-10.75, 2.591, 16.25], // dach dyżurki
    [-8.25, 2.591, 21.25], // spocznik przy wejściu do rozdzielni
    [7.25, 1.6, 23.75], // dojście do transformatora
    [9.75, 3.2, 16.75], // galeria kablowa
    [-14.25, 3, -6.25], // spocznik rampy w warsztacie
    [-10.25, 3, -2.25], // obserwacja kanału kalibracji
    [-6.25, 3.6, -12.25], // antresola zachodnia
    [-5.25, 3.6, 5.25],
    [-3.25, 3.875, -3.75], // wjazd od zachodu
    [2.25, 5.8, -3.75],
    [10.25, 5.8, -3.75], // środek ażurowego pokładu
    [18.25, 5.8 - (0.25 * 2.2) / 6, -3.75],
    [23.25, 3.875, -3.75], // wjazd od wschodu
    [26.25, 3.6, -12.25], // oba ramiona antresoli wschodniej
    [18.25, 3.6, 12.25],
    [19.25, 1.6, -8.25], // stopień załadunkowy i dach kontenera
    [20.25, 2.591, -13.75],
    [-5.75, 3.6, -33.75], // rampa sterowni: ląd. u szczytu
    [-3.75, 3.6, -36.75], // pomost obok sterowni
    [-6.25, 3.6, -35.25], // wnętrze sterowni, przez drzwi
    [15.75, 1.6, -28.25], // pomost podnośnika nożycowego
    [26.25, 1.2, -30.25], // wnętrze naczepy przez tylną rampę
  ] as const;
  const goals = [
    { ...exit.position, y: 0 },
    ...platforms.map(([x, y, z]) => ({ x, y, z })),
    ...room.spawnPoints.map((p) => ({ ...p, y: 0 })),
  ];
  expect(room.spawnPoints).toHaveLength(17);
  for (const goal of goals) {
    const path = nav.path(room.playerSpawn, goal);
    // Ostatni punkt path() to argument wywołania. Przedostatni należy do siatki.
    const arrived = path.at(-2);
    const label = JSON.stringify(goal);
    expect(arrived, label).toBeDefined();
    expect(arrived!.y, label).toBeCloseTo(goal.y);
    expect(
      Math.hypot(arrived!.x - goal.x, arrived!.z - goal.z),
      label,
    ).toBeLessThan(1);
  }

  const upperRoute = nav.path(
    { x: 9.75, y: 3.2, z: 16.75 },
    { x: -10.25, y: 3, z: -2.25 },
  );
  expect(upperRoute.length).toBeGreaterThan(2);
  expect(Math.min(...upperRoute.map((p) => p.y))).toBeGreaterThanOrEqual(3);
  expect(Math.max(...upperRoute.map((p) => p.y))).toBeCloseTo(5.8);
});

it('run1: z posadzki alei widać ładunek, suwnicę i każdy segment dziewiątki', () => {
  const room = roomDefinitions.get('run1')!;
  const eye = new Vector3(2.8, 1.65, -1); // pozycja 02-north
  const hulls = room.blocks
    .filter((b) => b.visible !== false)
    .map((block) => {
      const r = block.rotation;
      const axes = new Matrix4().makeRotationFromEuler(
        new Euler(r?.x, r?.y, r?.z),
      );
      return {
        block,
        hull: new OBB(
          new Vector3().copy(block.position),
          new Vector3().copy(block.size).multiplyScalar(0.5),
          new Matrix3().setFromMatrix4(axes),
        ),
      };
    });
  const glyph = hulls.filter(
    ({ block }) => block.material === 'neon_green' && block.position.z < -23,
  );
  expect(glyph).toHaveLength(6);
  const cargo = hulls.find(
    ({ block }) =>
      block.model === 'port_container_20_graphite' && block.position.y > 5,
  )!;
  const crane = hulls.find(({ block }) => block.model === 'wh_overhead_crane')!;
  for (const target of [...glyph, cargo, crane]) {
    const ray = new Ray(eye, target.hull.center.clone().sub(eye).normalize());
    const hit = target.hull.intersectRay(ray, new Vector3())!;
    for (const other of hulls) {
      if (other === target) continue;
      const obstruction = other.hull.intersectRay(ray, new Vector3());
      if (obstruction)
        expect(
          eye.distanceTo(obstruction),
          target.block.model ?? target.block.material,
        ).toBeGreaterThanOrEqual(eye.distanceTo(hit) - 0.01);
    }
  }
});
