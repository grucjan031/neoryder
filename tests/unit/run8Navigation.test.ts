import { expect, it } from 'vitest';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { ArenaSurfaceNavigation } from '../../src/world/arenaSurfaceNavigation';
import { wallDecalFitsBlock } from '../../src/world/dressingSchema';
import { roomDefinitions } from '../../src/world/rooms';
import { tuning } from '../../src/core/tuning';
import measuredBounds from '../../src/data/render/mapModelBounds.json';
import { Box3, Euler, Matrix4, Ray, Vector3 } from 'three';

const room = roomDefinitions.get('run8')!;
const nav = new ArenaNavigation(room);
const surfaceNav = new ArenaSurfaceNavigation(room);

interface Goal {
  x: number;
  y: number;
  z: number;
}

function reach(from: Goal, goal: Goal, navigator = nav): Goal[] {
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
  { id: 'R1 Szatnia i Śluza Dekontaminacyjna', x: 0, y: 0, z: 29 },
  { id: 'R2 Hala Reaktora — Południe', x: 0, y: 0, z: 14 },
  { id: 'R2 Hala Reaktora — Północ', x: 0, y: 0, z: -14 },
  { id: 'R3 Sterownia Główna', x: -8, y: 4.8, z: -29 },
  { id: 'R4 Laboratorium Fizyki Plazmy', x: -28, y: 0, z: -11 },
  { id: 'R5 Magazyn Paliwa Deuter/Tryt', x: -28, y: 0, z: 16 },
  { id: 'R6 Hala Turbin i Wymienników Ciepła', x: 26, y: 0, z: 15 },
  { id: 'R7 Serwerownia Diagnostyczna', x: 26, y: 0, z: -18 },
  { id: 'R8 Biuro Kierownika Naukowego', x: 11, y: 4.8, z: -26 },
  { id: 'Galeria G1-W', x: -20, y: 4.8, z: 0 },
  { id: 'Galeria G1-E', x: 20, y: 4.8, z: 0 },
  { id: 'Galeria G1-N', x: 0, y: 4.8, z: -20 },
  { id: 'Galeria G1-SW', x: -18, y: 4.8, z: 19 },
  { id: 'Galeria G1-SE', x: 18, y: 4.8, z: 19 },
  { id: 'Galeria Górna G2-W', x: -20.4, y: 9.6, z: -6 },
  { id: 'Galeria Górna G2-N', x: 0, y: 9.6, z: -20.4 },
  { id: 'Galeria Górna G2-E', x: 20.4, y: 9.6, z: -6 },
  { id: 'Tablica Rezonansu Dr. Moriego FPP', x: 19.5, y: 4.8, z: -29.5 },
];

it.each(targets)(
  'run8: $id jest osiągalne ze startu i z powrotem',
  (goal) => {
    reach(room.playerSpawn, goal);
    reach(goal, room.playerSpawn);
  },
);

const rampEnds = [
  // Rampa #1 (SW L0 <-> G1-SW, wzdłuż X na Z = 20.0)
  { axis: 'x', z: 20.0, y: 0, aisle: -5.0, ramp: -7.0, rise: 0.48 },
  { axis: 'x', z: 20.0, y: 4.8, aisle: -17.0, ramp: -15.0, rise: -0.48 },
  // Rampa #2 (SE L0 <-> G1-SE, wzdłuż X na Z = 20.0)
  { axis: 'x', z: 20.0, y: 0, aisle: 5.0, ramp: 7.0, rise: 0.48 },
  { axis: 'x', z: 20.0, y: 4.8, aisle: 17.0, ramp: 15.0, rise: -0.48 },
  // Rampa #3 i #4 (NW/NE L0 <-> G1-N, wzdłuż Z na X = ±16.2)
  ...[-16.2, 16.2].flatMap((x) => [
    { axis: 'z' as const, x, y: 0, aisle: -7.0, ramp: -9.0, rise: 0.48 },
    { axis: 'z' as const, x, y: 4.8, aisle: -19.0, ramp: -17.0, rise: -0.48 },
  ]),
  // Rampa #5 i #6 (G1-SW/SE <-> G2-W/E, wzdłuż Z na X = ±20.4)
  ...[-20.4, 20.4].flatMap((x) => [
    { axis: 'z' as const, x, y: 4.8, aisle: 17.0, ramp: 15.0, rise: 0.48 },
    { axis: 'z' as const, x, y: 9.6, aisle: 5.0, ramp: 7.0, rise: -0.48 },
  ]),
] as const;

it.each(rampEnds)(
  'run8: próg rampy ($axis, y=$y, aisle=$aisle) łączy się ze spocznikiem',
  (end) => {
    const aisle =
      end.axis === 'z'
        ? { x: end.x, y: end.y, z: end.aisle }
        : { x: end.aisle, y: end.y, z: end.z };
    const ramp =
      end.axis === 'z'
        ? { x: end.x, y: end.y + end.rise, z: end.ramp }
        : { x: end.ramp, y: end.y + end.rise, z: end.z };
    for (const [from, to] of [
      [aisle, ramp],
      [ramp, aisle],
    ] as const) {
      const path = surfaceNav.path(from, to);
      expect(path.length).toBeGreaterThan(2);
      const arrived = path.at(-2)!;
      expect(Math.abs(arrived.y - to.y)).toBeLessThan(0.35);
      expect(Math.hypot(arrived.x - to.x, arrived.z - to.z)).toBeLessThan(0.6);
    }
  },
);

it('run8: wszystkie 18 spawnów i wyjście w Sterowni Głównej R3 są osiągalne', () => {
  expect(room.spawnPoints).toHaveLength(18);
  for (const p of room.spawnPoints)
    reach(room.playerSpawn, { ...p, y: p.y ?? 0 });
  const exit = room.doors.find((d) => d.role === 'exit')!;
  reach(room.playerSpawn, { ...exit.position, y: 4.8 });
});

it('run8: Tokamak setPiece, 8 naukowców i 20 kryjówek są obecne i osiągalne', () => {
  expect(room.setPieces).toEqual([
    {
      kind: 'fusionReactor',
      position: { x: 0, y: 0, z: 0 },
      yaw: 0,
      scale: 1,
    },
  ]);
  expect(room.civilians).toHaveLength(8);
  expect(room.hideSpots).toHaveLength(20);
  for (const c of room.civilians!) {
    expect(c.id).toBe('scientist');
    reach(room.playerSpawn, c.position);
    // Naukowiec ma osiągalne kryjówki na tej samej kondygnacji.
    const sameLevelSpots = room.hideSpots!.filter(
      (h) => Math.abs(h.y - c.position.y) < 0.1,
    );
    expect(sameLevelSpots.length).toBeGreaterThanOrEqual(4);
    for (const spot of sameLevelSpots) reach(c.position, spot);
  }
});

it('run8: kapsuła mieści się na starcie, 18 spawnach, 8 naukowcach i 20 kryjówkach', () => {
  const { capsuleHeight, capsuleRadius } = tuning.player;
  const points = [
    room.playerSpawn,
    ...room.spawnPoints.map((p) => ({ x: p.x, y: p.y ?? 0, z: p.z })),
    ...(room.civilians ?? []).map((c) => c.position),
    ...(room.hideSpots ?? []),
  ];
  for (const p of points) {
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

it('run8: każde z 8 pomieszczeń R1..R8 ma jednolitą posadzkę jednym blokiem, a dekale ścienne leżą <= 0.1 m od ściany', () => {
  const expectedFloors = [
    { id: 'R1', x: 0, z: 29, w: 24, d: 14, y: 0 },
    { id: 'R2', x: 0, z: 0, w: 44, d: 44, y: 0 },
    { id: 'R3', x: -8, z: -29, w: 28, d: 14, y: 4.8 },
    { id: 'R4', x: -30, z: -11, w: 16, d: 22, y: 0 },
    { id: 'R5', x: -30, z: 11, w: 16, d: 22, y: 0 },
    { id: 'R6', x: 30, z: 9, w: 16, d: 26, y: 0 },
    { id: 'R7', x: 30, z: -13, w: 16, d: 18, y: 0 },
    { id: 'R8', x: 14, z: -29, w: 16, d: 14, y: 4.8 },
  ];
  for (const f of expectedFloors) {
    const match = room.blocks.filter(
      (b) =>
        b.walkable === true &&
        !b.rotation &&
        Math.abs(b.position.x - f.x) < 1e-4 &&
        Math.abs(b.position.z - f.z) < 1e-4 &&
        Math.abs(b.size.x - f.w) < 1e-4 &&
        Math.abs(b.size.z - f.d) < 1e-4 &&
        Math.abs(b.position.y + b.size.y / 2 - f.y) < 1e-4,
    );
    expect(match, f.id).toHaveLength(1);
  }
  const wallDecals = (room.decals ?? []).filter((d) => d.surface === 'wall');
  expect(wallDecals.length).toBeGreaterThanOrEqual(8);
  for (const decal of wallDecals) {
    expect(
      room.blocks.some((b) => wallDecalFitsBlock(decal, b, 0.1)),
      JSON.stringify(decal),
    ).toBe(true);
  }
});

it('run8: wszystkie 30 modeli fus_* są użyte na mapie', () => {
  const models = new Set([
    ...room.blocks.map((b) => b.model),
    ...(room.decor ?? []).map((d) => d.model),
  ]);
  for (const suffix of [
    'catwalk_deck',
    'catwalk_railing',
    'ceiling_coffer_bay',
    'blast_door_frame',
    'shield_wall_panel',
    'coolant_pipe_arch',
    'wall_pipe_manifold',
    'wall_power_busbar',
    'overhead_cable_tray',
    'highbay_light_strip',
    'cryopump_unit',
    'capacitor_bank',
    'pulse_transformer',
    'diagnostic_console',
    'junction_box',
    'control_window_wall',
    'main_control_desk',
    'telemetry_screen_wall',
    'neutral_beam_injector',
    'plasma_test_chamber',
    'whiteboard_equations',
    'tritium_cask_pallet',
    'deuterium_cryo_tank',
    'fuel_gantry_crane',
    'steam_turbine_generator',
    'heat_exchanger_tower',
    'quantum_server_rack',
    'decon_shower_arch',
    'suit_locker_bank',
    'director_desk',
  ])
    expect(models.has(`fus_${suffix}`), suffix).toBe(true);
});

const bounds: Record<string, { min: number[]; max: number[] }> = measuredBounds;
const transparentModels = new Set([
  'fus_control_window_wall',
  'fus_catwalk_railing',
  'fus_decon_shower_arch',
]);
const transform = (
  position: Goal,
  rotation = { x: 0, y: 0, z: 0 },
  scale = 1,
) =>
  new Matrix4()
    .makeRotationFromEuler(new Euler(rotation.x, rotation.y, rotation.z))
    .scale(new Vector3(scale, scale, scale))
    .setPosition(position.x, position.y, position.z);
const occluders = [
  ...room.blocks
    .filter(
      (b) =>
        b.visible !== false &&
        b.material !== 'glass_clear' &&
        !transparentModels.has(b.model ?? ''),
    )
    .map((b) => ({
      name: b.model ?? b.material,
      box: new Box3()
        .setFromCenterAndSize(
          new Vector3(),
          new Vector3(b.size.x, b.size.y, b.size.z),
        )
        .applyMatrix4(transform(b.position, b.rotation)),
    })),
  ...(room.decor ?? [])
    .filter((d) => !transparentModels.has(d.model))
    .map((d) => {
      const m = bounds[d.model]!;
      return {
        name: d.model,
        box: new Box3(
          new Vector3().fromArray(m.min),
          new Vector3().fromArray(m.max),
        ).applyMatrix4(
          transform(d.position, { x: 0, y: d.yaw ?? 0, z: 0 }, d.scale ?? 1),
        ),
      };
    }),
];

it.each([
  {
    id: 'Start R1 przez Portal Główny na Tokamak',
    eye: [0, 1.65, 31],
    end: [0, 3.5, 6.5],
  },
  {
    id: 'Sterownia Główna R3 przez 15-metrową szybę na Tokamak',
    eye: [-7.5, 6.45, -26],
    end: [0, 5.2, -6.5],
  },
  {
    id: 'Biuro Kierownika R8 przez okno na Tokamak',
    eye: [10.5, 6.45, -26],
    end: [3.0, 5.2, -6.5],
  },
  {
    id: 'Laboratorium Plazmy R4 przez okno badawcze do Hali Reaktora',
    eye: [-24, 1.65, -7.2],
    end: [-10, 1.65, -7.2],
  },
])('run8: $id ma czysty widok na wysokości oczu', ({ eye, end }) => {
  const origin = new Vector3().fromArray(eye);
  const destination = new Vector3().fromArray(end);
  const distance = origin.distanceTo(destination);
  const ray = new Ray(origin, destination.clone().sub(origin).normalize());
  const crossed = (box: Box3) => {
    const hit = ray.intersectBox(box, new Vector3());
    return hit !== null && origin.distanceTo(hit) < distance;
  };
  expect(occluders.filter((o) => crossed(o.box)).map((o) => o.name)).toEqual(
    [],
  );
});
