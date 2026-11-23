// Automatyczny magazyn (combat): hala regałów z alejkami, środkowa ładownia pod suwnicą (cel misji M03:
// terminal w (0, 0), brama dokowa w (0, −10)), stosy kontenerów 20' na placu i antresola biur na 4 m.
// Landmark: suwnica bramowa nad halą (18 m) z bursztynowymi światłami. Pogoda: smog.
import { COLOR, R, createRunRoom, vec } from './_runKit.mjs';
import { dressPerimeter, scatter, spawns, track } from './_runKitC.mjs';

export default function generate() {
  const bounds = R(-40, 40, -45, 45);
  const k = createRunRoom({
    id: 'combatWarehouse',
    name: 'Magazyn',
    weather: 'smog',
    seed: 'run-warehouse-v1',
    bounds,
    startX: -22,
    exitX: 24,
    wallMaterial: 'corrugated',
    wallHeights: [14, 17, 15, 19],
  });
  track(k);
  const { arena, p } = k;

  // Grunt: plac kontenerów, hala, ładownia (beton), doki północne. Szwy na liczbach całkowitych.
  k.ground(R(-40, 40, 22, 45), 0, 'quay_concrete');
  k.ground(R(-40, -10, -14, 22), 0, 'turbine_hall_floor');
  k.ground(R(10, 40, -14, 22), 0, 'turbine_hall_floor');
  k.ground(R(-10, 10, -14, 22), 0, 'concrete');
  k.ground(R(-40, 40, -45, -14), 0, 'asphalt');
  k.perimeter();

  // Antresola biur (4 m) w północno-zachodnim narożniku, rampa do ładowni.
  const MEZ = R(-40, -20, -45, -30);
  k.deck(MEZ, 4, 'metal');
  k.ramp(vec(-20, 4, -37), vec(-8, 0, -37), 3, 'metal');
  const rail = (a, b, openings) =>
    p.wall(a, b, 1.1, 0.12, 'metal', openings ? { openings } : {});
  rail(vec(-40, 4, -30), vec(-20, 4, -30));
  rail(vec(-20, 4, -45), vec(-20, 4, -30), [
    { at: 8, width: 3.4, height: 1.1 },
  ]);
  rail(vec(-40, 4, -45), vec(-40, 4, -30));
  k.prop('build_site_office', -34, -42, { y: 4, quarter: 0 });
  k.prop('build_site_office', -26, -42, { y: 4, quarter: 0 });
  k.prop('city_crates', -37, -34, { y: 4 });
  k.prop('city_generator', -23, -33, { y: 4, quarter: 1 });
  k.prop('city_vending', -22, -41, { y: 4, quarter: 3 });
  k.faceNeon(MEZ, 'S', 10, 7.5, 'repair', 3.2, 1.6, COLOR.green, 0.25);

  // Landmark: suwnica bramowa nad ładownią; cztery wózki kół w narożnikach rozstawu 24 m.
  const CZ = 6;
  arena.decor('port_gantry_crane', vec(0, 0, CZ), 0);
  for (const sx of [-12, 12])
    for (const dz of [-3.6, 3.6]) {
      k.solid(
        R(sx - 0.8, sx + 0.8, CZ + dz - 0.8, CZ + dz + 0.8),
        0,
        6,
        'metal',
        {
          visible: false,
        },
      );
      k.reserve(R(sx - 0.8, sx + 0.8, CZ + dz - 0.8, CZ + dz + 0.8));
    }
  for (const [x, y, z, c] of [
    [0, 17, CZ, COLOR.amber],
    [-10, 15, CZ, COLOR.warm],
    [10, 15, CZ, COLOR.warm],
    [0, 8, CZ + 4, COLOR.amber],
    [0, 8, CZ - 4, COLOR.warm],
  ])
    k.light(x, y, z, c, 60, 34);

  // Regały: półki na posadzce i na 1,8 / 3,6 / 5,4 m; słupy co 4 m pod górną płytą.
  const loads = [
    'city_crates',
    'city_generator',
    'city_trash_bags',
    'city_dumpster',
    'build_rebar_bundle',
  ];
  let n = 0;
  const rack = (x, z0, z1) => {
    k.reserve(R(x - 1, x + 1, z0, z1));
    for (const bottom of [0, 1.8, 3.6, 5.4])
      k.solid(R(x - 1, x + 1, z0, z1), bottom, bottom + 0.2, 'metal');
    for (
      let z = z0 + 0.15;
      z <= z1 - 0.1;
      z += (z1 - z0 - 0.3) / Math.round((z1 - z0) / 4)
    )
      for (const dx of [-0.85, 0.85])
        k.solid(
          R(x + dx - 0.15, x + dx + 0.15, z - 0.15, z + 0.15),
          0.2,
          5.4,
          'metal',
        );
    // Towar na półkach: skrzynie i worki co kilka metrów.
    for (const top of [0.2, 2.0, 3.8])
      for (let z = z0 + 1.6; z < z1 - 1; z += 3.2) {
        const model = loads[n++ % loads.length];
        k.deco(model, x + ((n % 3) - 1) * 0.2, top, z, ((n % 4) * Math.PI) / 2);
      }
  };
  for (const x of [-36, -30, -24, -18]) {
    rack(x, -12, -2);
    rack(x, 2, 16);
  }
  for (const x of [18, 24, 30, 36]) {
    rack(x, -12, -2);
    rack(x, 2, 16);
  }
  // Numery alejek i znaki na końcach regałów.
  for (const [x, z, tex, c] of [
    [-27, 17.5, 'arrow', COLOR.amber],
    [27, 17.5, 'arrow', COLOR.green],
    [-27, -13.5, 'warsztat', COLOR.blue],
    [27, -13.5, 'repair', COLOR.violet],
  ])
    k.neon(tex, x, 3.2, z, 2.6, 1.3, 0, c, 0.25);

  // Ładownia (środek): osłony niskie, automaty ładujące, stacje; środek (0,0) i (0,−10) zostają wolne.
  for (const [model, x, z, quarter] of [
    ['city_barrier', -7, 11, 0],
    ['city_barrier', 7, 11, 0],
    ['city_generator', -9, -11, 1],
    ['city_generator', 9, -11, 1],
    ['city_vending', 12, 5, 3],
    ['city_vending', -12, -2, 1],
    ['city_crates', -9, 8, 0],
    ['city_crates', 9, 8, 0],
    ['city_kiosk', -12, -3, 0],
    ['city_kiosk', 12, -4, 0],
    ['port_reach_stacker', 14, -24, 0],
    ['port_reach_stacker', -14, -20, 2],
  ])
    k.prop(model, x, z, { quarter });

  // Plac kontenerów (południe): stosy 20' w trzech rzędach; pas wejścia x = −22 zostaje wolny.
  const colours = ['navy', 'olive', 'ochre', 'graphite'];
  let c = 0;
  const stack = (x, z, quarter, high = false) => {
    const model = `port_container_20_${colours[c++ % 4]}`;
    k.prop(model, x, z, { quarter });
    if (high)
      k.prop(`port_container_20_${colours[c++ % 4]}`, x, z, {
        y: 2.591,
        quarter,
      });
  };
  for (const [x, z, q, h] of [
    [-35, 39, 0, true],
    [-6, 39, 1, false],
    [14, 40, 0, true],
    [33, 39, 0, false],
    [-33, 31, 1, false],
    [-10, 31, 0, true],
    [6, 32, 0, false],
    [26, 31, 1, true],
    [-35, 25, 0, false],
    [-13, 25, 1, false],
    [3, 25, 0, true],
    [18, 25, 0, false],
    [35, 25, 1, true],
  ])
    stack(x, z, q, h);
  for (const [model, x, z, quarter] of [
    ['port_container_40_graphite', -2, 18, 0],
  ])
    k.prop(model, x, z, { quarter });
  scatter(
    k,
    [
      'city_barrier',
      'city_crates',
      'city_generator',
      'city_dumpster',
      'city_car',
    ],
    R(-38, 38, 24, 42),
    { count: 10, clear: 3.4 },
  );
  k.prop('build_site_office', 34, -40, { quarter: 0 });
  k.prop('port_container_20_ochre', 8, -40, { quarter: 1 });
  k.prop('port_container_20_navy', -2, -41, { quarter: 1 });
  // Doki północne: pojazdy i palety przy bramach, kontenery biurowe.
  scatter(
    k,
    [
      'city_crates',
      'city_generator',
      'city_vending',
      'city_barrier',
      'city_wrecked_car',
      'city_dumpster',
      'build_pipe_stack',
      'build_precast_stack',
    ],
    R(-18, 38, -44, -16),
    {
      count: 20,
      clear: 3.2,
      avoid: [R(18, 30, -45, -34), R(-10, 10, -18, -4)],
    },
  );

  // Ściany: bramy dokowe, instalacje, tablice, naklejki; dokładne drzwi 4 × 3 m zostawia perimeter.
  dressPerimeter(k, {
    startX: -22,
    exitX: 24,
    step: 6,
    height: 14,
    sets: [
      [
        { face: 'city_shutter', y: 0, off: 0.2 },
        { neon: 'warsztat', y: 5.4, w: 2.8, h: 1.4, c: COLOR.amber, fl: 0.25 },
      ],
      [
        { face: 'city_pipe_run', y: 0, off: 0.3 },
        { face: 'city_ac_unit', y: 7, off: 0.35, dx: 1.5 },
        { decal: 'graffiti_tag2', y: 2.8, w: 3, h: 2 },
      ],
      [
        { face: 'city_door', y: 0, off: 0.15 },
        { face: 'city_ad_screen', y: 1.2, off: 0.2, dx: 2.4 },
        { neon: 'arrow', y: 4.4, w: 2.2, h: 1.1, c: COLOR.green, fl: 0.2 },
      ],
      [
        { face: 'city_sign_box', y: 5, off: 0.15 },
        { face: 'city_pipe_run', y: 0, off: 0.3, dx: -2 },
        { decal: 'poster_torn1', y: 2.4, w: 1.8, h: 2.4, dx: 2 },
      ],
      [
        { face: 'city_shutter', y: 0, off: 0.2 },
        { face: 'city_ac_unit', y: 4.8, off: 0.35, dx: 3.4 },
        { neon: 'repair', y: 6, w: 2.4, h: 1.2, c: COLOR.blue, fl: 0.3 },
      ],
    ],
  });
  // Krokwie dachu hali nad regałami i ładownią (dekoracja, bez kolizji).
  for (const x of [-15, 15])
    for (let z = -36; z <= 18; z += 6)
      arena.decor(
        'port_warehouse_roof_truss',
        vec(x, 11, z),
        (Math.PI / 2) * 0,
      );
  // Lampy hali: zimne białe nad alejkami, bursztyn przy bramach, zieleń przy wyjściu.
  for (const x of [-33, -21, 21, 33])
    for (const z of [-8, 9]) k.light(x, 7, z, COLOR.warm, 20, 14);
  for (const [x, z, col] of [
    [-6, -2, COLOR.amber],
    [6, 12, COLOR.green],
    [-6, 14, COLOR.warm],
    [6, -8, COLOR.warm],
    [-28, 35, COLOR.amber],
    [-4, 36, COLOR.blue],
    [20, 36, COLOR.green],
    [34, 30, COLOR.warm],
    [-12, 28, COLOR.violet],
    [8, 28, COLOR.amber],
    [-30, -22, COLOR.warm],
    [-4, -28, COLOR.amber],
    [10, -36, COLOR.green],
    [24, -38, COLOR.warm],
    [34, -24, COLOR.blue],
    [0, -20, COLOR.violet],
  ])
    k.light(x, 6, z, col, 18, 13);
  for (const [x, z] of [
    [-16, 42, COLOR.amber],
    [14, 22, COLOR.warm],
    [38, 18, COLOR.green],
    [-38, 18, COLOR.blue],
  ])
    k.prop('port_light_tower', x, z, {});

  for (const [x, z] of [
    [-12, 20],
    [12, 18],
    [-30, 28],
    [30, -30],
    [-8, -36],
  ])
    k.fx('steam', x, 0.1, z, 1.1);
  for (const [x, y, z] of [
    [-27, 8, 6],
    [27, 8, 6],
    [0, 8, -26],
  ])
    k.fx('drip', x, y, z);
  for (const [x, y, z] of [
    [-12, 3, -20],
    [12, 3, 20],
  ])
    k.fx('sparks', x, y, z);

  // Beczki z paliwem w ładowni (dawne ids, układ jak w misji M03).
  for (const [id, x, z] of [
    ['warehouse-west', -5.5, 0],
    ['warehouse-east', 5.5, 0],
    ['warehouse-north', 1.5, -6],
    ['warehouse-south', -3.5, 6],
  ])
    k.hazards.push({ kind: 'explosive_barrel', id, position: vec(x, 0, z) });
  for (const [tex, x, z, w] of [
    ['floor_hazard', 0, -14, 10],
    ['floor_hazard', 0, 12, 10],
    ['floor_arrow', -22, 20, 2],
    ['floor_arrow', 24, -20, 2],
    ['floor_stop', -22, 34, 3],
    ['oil_stain', -3, 4, 3],
    ['oil_stain', 20, 10, 3],
    ['oil_stain', -28, -10, 3],
    ['crack_floor', 8, 20, 3],
    ['puddle1', -8, 30, 5],
    ['puddle2', 26, 28, 5],
    ['puddle1', 14, -30, 5],
    ['puddle2', -6, -26, 5],
    ['manhole', 0, 16, 1.6],
    ['tire_marks', 8, 36, 5],
    ['manhole', 6, -22, 1.6],
  ])
    k.decal(
      tex,
      x,
      0.012,
      z,
      w,
      tex === 'floor_hazard' ? w * 0.12 : w * 0.6,
      tex === 'floor_hazard' ? 0 : 0,
    );

  k.finish({
    points: [
      ['A', 0, 0, 0],
      ['B', -22, 0, 34],
      ['C', 24, 0, -36],
    ],
    zones: [
      ['Plac kontenerów', R(-40, 40, 22, 45), 'open'],
      ['Hala regałów', R(-40, 40, -14, 22), 'dense'],
      ['Antresola', MEZ, 'high'],
      ['Doki północne', R(-40, 40, -45, -14), 'low'],
    ],
    maxAlive: 10,
    minSpawnDistance: 12,
  });
  spawns(k, [
    [-30, 33],
    [-6, 35],
    [10, 36],
    [32, 33],
    [-14, 22],
    [28, 22],
    [-27, 14],
    [-21, 0],
    [27, -6],
    [21, 8],
    [-8, 14],
    [10, -12],
    [-4, -22],
    [22, -28],
    [12, -42],
    [-16, -40],
  ]);
  return arena;
}

export const shots = [
  { name: 'start', x: -22, z: 42, yaw: 0, pitch: 10 },
  { name: 'containers', x: -8, z: 36, yaw: 20, pitch: 8 },
  { name: 'racks', x: -27, z: 18, yaw: 0, pitch: 6 },
  { name: 'crane', x: 0, z: 14, yaw: 0, pitch: 18 },
  { name: 'docks', x: 0, z: -20, yaw: 180, pitch: 6 },
  { name: 'mezzanine', x: -36, z: -36, floorY: 4, yaw: 270, pitch: -4 },
];
