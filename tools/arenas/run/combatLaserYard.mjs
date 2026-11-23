// Kontrola celna (combat): parking oczekujących, pasy z budkami poboru i bramkami laserowymi (hazard),
// budynek celny z dachem (4,4 m), wiata kontrolna (3,2 m) i terminal kontenerowy na północy.
// Landmark: brama sygnałowa nad drogą (podwójne światła zielone/bursztynowe). Pogoda: smog.
// Cele misji m03 (strażnicy w (0, −5) i (0, −7)) zostają wolne: wiersze laserów leżą na z = 3 i −10.
import { COLOR, R, SIZE, createRunRoom, vec } from './_runKit.mjs';
import { KITS, dressWall } from './_wallKit.mjs';

Object.assign(SIZE, {
  build_mixer_truck: vec(2.51, 3.55, 9.02),
  port_reach_stacker: vec(6.06, 5.756, 11.105),
  port_container_20_olive: vec(6.058, 2.591, 2.438),
  port_container_20_graphite: vec(6.058, 2.591, 2.438),
  port_container_20_ochre: vec(6.058, 2.591, 2.438),
  port_container_20_navy: vec(6.058, 2.591, 2.438),
  port_bollard: vec(0.62, 0.6, 0.62),
});

export default function generate() {
  const bounds = R(-34, 34, -46, 46);
  const k = createRunRoom({
    id: 'combatLaserYard',
    name: 'Kontrola celna',
    weather: 'smog',
    seed: 'run-customs-v1',
    bounds,
    startX: -14,
    exitX: 20,
    wallMaterial: 'smog_soot_wall',
    wallHeights: [14, 19, 16, 22],
  });
  const { arena } = k;

  k.ground(R(-34, 34, 20, 46), 0, 'asphalt');
  k.ground(R(-34, 34, -6, 20), 0, 'highway_asphalt_worn');
  k.ground(R(-34, 34, -46, -6), 0, 'concrete');
  k.perimeter();

  // Budynek celny (dach 4,4 m, rampa od parkingu) i wiata kontrolna (dach 3,2 m).
  const CUST = R(-34, -22, -4, 16);
  const SHELTER = R(26, 34, -4, 12);
  k.deck(CUST, 4.4, 'concrete');
  k.deck(SHELTER, 3.2, 'concrete');
  k.ramp(vec(-28, 0, 29), vec(-28, 4.4, 16), 3, 'metal');
  k.ramp(vec(30, 0, 26), vec(30, 3.2, 12), 3, 'metal');
  k.faceNeon(CUST, 'E', 6, 2.6, 'open', 3, 1.5, COLOR.green, 0.2);
  k.faceNeon(CUST, 'E', 14, 2.6, 'arrow', 3, 1.5, COLOR.amber, 0.15);
  k.faceNeon(CUST, 'S', 6, 2.6, 'hotel', 3, 1.5, COLOR.violet, 0.3);
  k.face(CUST, 'E', 3, 0, 'city_door', 0.15);
  k.face(CUST, 'E', 10, 0, 'city_shutter', 0.2);
  k.face(CUST, 'E', 18, 0, 'city_pipe_run', 0.3);
  k.face(CUST, 'E', 8, 2.4, 'city_ac_unit', 0.35);
  k.face(CUST, 'S', 10, 0, 'city_shutter', 0.2);
  k.faceNeon(SHELTER, 'W', 4, 1.8, 'repair', 2.6, 1.3, COLOR.blue, 0.3);
  k.faceNeon(SHELTER, 'W', 10, 1.8, 'arrow', 2.6, 1.3, COLOR.amber, 0.2);
  k.face(SHELTER, 'W', 7, 0, 'city_pipe_run', 0.3);
  k.face(SHELTER, 'S', 4, 0, 'city_shutter', 0.2);
  // Zabezpieczenia dachów: poręcze po stronach bez rampy, wyposażenie dachu jako osłony.
  const p = k.p;
  p.wall(vec(-34, 4.4, -4), vec(-22, 4.4, -4), 1.1, 0.12, 'metal');
  p.wall(vec(-22, 4.4, -4), vec(-22, 4.4, 16), 1.1, 0.12, 'metal');
  p.wall(vec(26, 3.2, -4), vec(34, 3.2, -4), 1.1, 0.12, 'metal');
  p.wall(vec(26, 3.2, -4), vec(26, 3.2, 12), 1.1, 0.12, 'metal');
  for (const [model, x, z, quarter] of [
    ['city_roof_hvac_unit', -29, 2, 0],
    ['city_roof_water_tank', -25, 10, 0],
    ['city_roof_hvac_unit', -29, 11, 1],
    ['city_crates', -25, -1, 0],
  ])
    k.prop(model, x, z, { y: 4.4, quarter });
  for (const [model, x, z, quarter] of [
    ['city_crates', 31, 0, 0],
    ['city_generator', 29, 8, 1],
    ['city_roof_hvac_unit', 31, 4.5, 1],
  ])
    k.prop(model, x, z, { y: 3.2, quarter });
  k.light(-28, 7.4, 6, COLOR.amber, 24, 14);
  k.light(30, 6, 4, COLOR.violet, 22, 12);

  // Budki poboru na wyspach; lasery między wyspami (dwa rzędy), słupki bramek z kolizją.
  const ISLANDS = [-11, -3, 5, 13, 21];
  for (const x of ISLANDS) {
    const r = R(x - 1.4, x + 1.4, 7.5, 16.5);
    k.reserve(r);
    k.solid(r, 0, 3, 'concrete', { visible: false });
    k.deco('hw_toll_booth', x, 0, 12, 0);
    k.light(x, 4.2, 12, x % 16 === 5 ? COLOR.green : COLOR.amber, 18, 11);
  }
  const lanes = [
    [-9.6, -4.4],
    [-1.6, 3.6],
    [6.4, 11.6],
    [14.4, 19.6],
  ];
  const rows = [
    { z: 3, offsets: [0, 1.5, 3, 4.5] },
    { z: -10, offsets: [2, 0, 4.5, 1] },
  ];
  rows.forEach((row, rowIndex) =>
    lanes.forEach(([a, b], i) => {
      k.hazards.push({
        kind: 'laser_gate',
        id: `customs-laser-${rowIndex}-${i}`,
        from: vec(a, 0.7, row.z),
        to: vec(b, 0.7, row.z),
        cycle: { onS: 1.5, offS: 2.5, offsetS: row.offsets[i] },
      });
      for (const x of [a, b]) {
        const post = R(x - 0.25, x + 0.25, row.z - 0.25, row.z + 0.25);
        k.reserve(post);
        k.solid(post, 0, 1.5, 'metal');
      }
      k.light((a + b) / 2, 1.8, row.z, COLOR.amber, 12, 8);
    }),
  );
  for (const row of rows)
    k.decal('floor_hazard', 6, 0.012, row.z, 52, 0.7, 0);

  // Brama sygnałowa (landmark): rozpiętość w X, nogi z kolizją, głowice zielone/bursztynowe.
  const GANTRY_SCALE = 1.4;
  k.deco('rail_signal_gantry', 0, 0, -18, Math.PI / 2, GANTRY_SCALE);
  for (const x of [-11 * GANTRY_SCALE, 11 * GANTRY_SCALE]) {
    const r = R(x - 0.7, x + 0.7, -18.7, -17.3);
    k.reserve(r);
    k.solid(r, 0, 9.8, 'metal', { visible: false });
  }
  k.light(0, 9.4, -18, COLOR.green, 60, 30);
  k.light(-8, 9.4, -18, COLOR.amber, 40, 22);
  k.light(8, 9.4, -18, COLOR.amber, 40, 22);
  k.neon('arrow', 0, 8.4, -17.2, 8, 4, 0, COLOR.green, 0.12);

  // Terminal ładunkowy: magazyn, biuro, kontenery, wózek; filtry smogu.
  const WARE = R(-34, -20, -44, -24);
  const OFFICE = R(26, 34, -44, -28);
  k.mass(WARE, 9, 'corrugated');
  k.mass(OFFICE, 7, 'plaster');
  k.faceNeon(WARE, 'E', 6, 5.4, 'warsztat', 3.2, 1.6, COLOR.amber, 0.3);
  k.faceNeon(WARE, 'S', 8, 6, 'arrow', 3, 1.5, COLOR.blue, 0.15);
  k.faceNeon(OFFICE, 'W', 6, 4.6, 'open', 2.6, 1.3, COLOR.green, 0.2);
  k.faceNeon(OFFICE, 'S', 4, 3.8, 'pharmacy', 2.4, 1.2, COLOR.violet, 0.3);
  k.face(WARE, 'E', 12, 0, 'city_shutter', 0.2);
  k.face(WARE, 'E', 16, 0, 'city_shutter', 0.2);
  k.face(WARE, 'E', 3, 0, 'city_door', 0.15);
  k.face(WARE, 'E', 10, 4.6, 'city_ac_unit', 0.35);
  k.face(WARE, 'S', 4, 0, 'city_pipe_run', 0.3);
  k.face(OFFICE, 'W', 11, 0, 'city_door', 0.15);
  k.face(OFFICE, 'W', 13, 3.4, 'city_ac_unit', 0.35);
  k.face(OFFICE, 'S', 7, 3.1, 'city_awning', 0.6);

  // Oprawa ścian.
  const wallW = R(-37, -34, -46, 46),
    wallE = R(34, 37, -46, 46),
    wallS = R(-34, 34, 46, 49),
    wallN = R(-34, 34, -49, -46);
  dressWall(k, wallW, 'E', 16, 46, {
    step: 5,
    kit: KITS.industrial,
    neons: [['beer', 5.4, 2.6, 1.3, COLOR.amber]],
  });
  dressWall(k, wallW, 'E', 0, 2, { kit: [] });
  dressWall(k, wallE, 'W', 12, 46, {
    step: 5,
    kit: KITS.street,
    salt: 3,
    neons: [
      ['sake', 5.4, 2.6, 1.3, COLOR.violet],
      ['bar_24h', 6.4, 2.6, 1.3, COLOR.green],
    ],
  });
  dressWall(k, wallE, 'W', 0, 12 - 0, {
    step: 6,
    kit: KITS.industrial,
    salt: 1,
  });
  dressWall(k, wallS, 'N', 0, 68, {
    step: 5,
    kit: KITS.street,
    salt: 2,
    neons: [
      ['karaoke', 5.4, 2.8, 1.4, COLOR.violet],
      ['noodles', 6.2, 3, 1.5, COLOR.amber],
      ['hotel', 5, 3, 1.5, COLOR.blue],
    ],
  });
  dressWall(k, wallN, 'S', 0, 68, {
    step: 5,
    kit: KITS.industrial,
    salt: 4,
    neons: [
      ['warsztat', 5.6, 3, 1.5, COLOR.amber],
      ['repair', 5.8, 3, 1.5, COLOR.green],
    ],
  });
  k.deco('city_cable_span', -33.5, 8, 30, Math.PI / 2);
  k.deco('city_cable_span', 33.5, 8, -20, -Math.PI / 2);
  k.deco('city_highway_sign_gantry', 0, 0, 38, 0);
  for (const x of [-6.5, 6.5]) {
    const r = R(x - 0.5, x + 0.5, 37.3, 38.7);
    k.reserve(r);
    k.solid(r, 0, 7, 'metal', { visible: false });
  }
  k.neon('arrow', 0, 6, 37.2, 6, 2.4, 0, COLOR.amber, 0.15);

  // Osłony: parking, pasy, terminal.
  const cover = [
    ['build_mixer_truck', -4, 34, 0],
    ['city_car', -26, 40, 0],
    ['city_wrecked_car', 4, 42, 1],
    ['city_car', 24, 38, 1],
    ['build_mixer_truck', 14, 30, 0],
    ['city_vending', -18, 24, 2],
    ['city_barrier', -8, 23, 0],
    ['city_barrier', 8, 24, 0],
    ['city_crates', 18, 44, 1],
    ['city_generator', -32, 36, 1],
    ['city_dumpster', 32, 42, 1],
    ['city_kiosk', -10, 44, 0],
    ['city_highway_barrier', -18, 36, 0],
    ['city_highway_barrier', 22, 24, 0],
    ['city_smog_scrubber', -24, 20, 0],
    ['city_smog_scrubber', 26, 21, 0],
    // pasy kontroli
    ['city_highway_barrier', -16, 11, 1],
    ['city_barrier', -7, 19, 0],
    ['city_barrier', 1, 19, 0],
    ['city_barrier', 9, 19, 0],
    ['city_highway_barrier', 17, 11, 1],
    ['city_crates', -7, 5.5, 0],
    ['city_kiosk', 9, 5.5, 0],
    ['city_vending', 25, 8, 1],
    ['city_dumpster', 17, -3, 0],
    ['city_barrier', -14, -2, 1],
    ['city_generator', -7, -8, 0],
    ['city_crates', 9, -7, 1],
    ['city_highway_barrier', 24, -8, 0],
    ['city_vending', -17, -12, 2],
    ['city_barrier', 14, -13, 0],
    // terminal
    ['port_container_20_olive', 6, -22, 1],
    ['port_container_20_ochre', 9, -22, 1],
    ['port_container_20_navy', 12, -26, 1],
    ['port_container_20_graphite', -8, -28, 0],
    ['port_container_20_ochre', -8, -31, 0],
    ['port_reach_stacker', -15, -38, 0],
    ['city_smog_scrubber', 0, -34, 0],
    ['city_smog_scrubber', 18, -38, 0],
    ['city_generator', 2, -42, 0],
    ['city_crates', -14, -18, 1],
    ['city_dumpster', 24, -20, 0],
    ['city_barrier', 20, -30, 0],
    ['city_vending', 12, -44, 2],
    ['city_kiosk', 30, -22, 0],
    ['city_crates', -28, -18, 0],
    ['city_highway_barrier', -26, -10, 0],
    ['city_wrecked_car', 26, -14, 1],
  ];
  for (const [model, x, z, quarter] of cover) k.prop(model, x, z, { quarter });
  for (const [x, z] of [
    [-22, 30],
    [0, 26],
    [12, 36],
    [-20, -4],
    [6, 1],
    [-30, 24],
  ])
    k.deco('city_traffic_cone', x, 0, z);
  for (const [x, z] of [
    [-12, 22],
    [10, 22],
    [-4, 36],
    [22, 36],
  ])
    k.deco('hw_fire_barrel', x, 0, z);

  for (const [x, z, c] of [
    [-24, 44, COLOR.amber],
    [-4, 40, COLOR.violet],
    [26, 44, COLOR.amber],
    [-16, 22, COLOR.blue],
    [16, 18, COLOR.green],
    [-30, -14, COLOR.amber],
    [6, -14, COLOR.violet],
    [30, -34, COLOR.amber],
    [-4, -40, COLOR.green],
  ])
    k.lamp(x, z, c);
  k.light(0, 7, 28, COLOR.warm, 24, 18);
  k.light(-16, 8, -34, COLOR.amber, 26, 16);
  k.light(14, 8, -22, COLOR.violet, 24, 16);
  for (const [x, z] of [
    [-4, 30],
    [26, -2],
    [-12, -22],
    [10, -38],
  ])
    k.fx('steam', x, 0.1, z, 1.3);
  for (const [x, y, z] of [
    [-24, 3, 20],
    [24, 4, -26],
  ])
    k.fx('sparks', x, y, z);
  for (const [x, y, z] of [
    [-30, 7, 8],
    [30, 6, 6],
    [0, 8, -34],
  ])
    k.fx('drip', x, y, z);

  for (const [tex, x, z, w] of [
    ['floor_stop', -14, 22, 3],
    ['floor_arrow', -3, 26, 3],
    ['floor_arrow', 5, 4, 2.4],
    ['floor_arrow', 21, 25, 3],
    ['tire_marks', 8, 36, 5],
    ['oil_stain', -4, 32, 3],
    ['oil_stain', 22, -16, 3],
    ['puddle1', -14, 40, 5],
    ['puddle2', 12, -4, 5],
    ['puddle1', 2, -30, 5],
    ['manhole', 18, 30, 1.6],
    ['manhole', -6, -18, 1.6],
    ['crack_floor', -24, 30, 3],
  ])
    k.decal(tex, x, 0.012, z, w, w * 0.6);
  for (const x of [-16, 0, 8, 16])
    k.decal('floor_hazard', x, 0.012, 20, 0.8, 7, 0);

  k.finish({
    points: [
      ['A', 0, 0, 0],
      ['B', -14, 0, 40],
      ['C', 20, 0, -40],
    ],
    zones: [
      ['Parking oczekujących', R(-34, 34, 20, 46), 'open'],
      ['Bramki kontroli', R(-22, 34, -6, 20), 'dense'],
      ['Budynek celny', R(-34, -22, -6, 20), 'high'],
      ['Terminal zachodni', R(-34, 0, -46, -6), 'interior'],
      ['Terminal wschodni', R(0, 34, -46, -6), 'low'],
    ],
    maxAlive: 10,
    minSpawnDistance: 14,
    spawnRing: { minM: 12, maxM: 95 },
  });
  for (const [x, z] of [
    [-30, 42],
    [-14, 40],
    [0, 39],
    [14, 42],
    [30, 36],
    [-18, 30],
    [20, 30],
    [-17, 4],
    [16, -1],
    [-6, -2],
    [22, -2],
    [-12, -14],
    [2, -16],
    [-16, -24],
    [8, -36],
    [28, -26],
  ])
    k.spawn(x, z);
  return arena;
}

export const shots = [
  { name: 'start', x: -14, z: 43, yaw: 0, pitch: 8 },
  { name: 'lanes', x: -18, z: 24, yaw: 20, pitch: 6 },
  { name: 'gates', x: 2, z: 22, yaw: 0, pitch: 4 },
  { name: 'roof', x: -26, z: 14, floorY: 4.4, yaw: 0, pitch: -4 },
  { name: 'gantry', x: 0, z: -6, yaw: 0, pitch: 10 },
  { name: 'terminal', x: 18, z: -26, yaw: 200, pitch: 4 },
];
