// Podstacja (combat): pola transformatorów rozdzielone drogami serwisowymi, łuki elektryczne (hazard),
// estakada kablowa na 4 m z rampami i dachy rozdzielni połączone z estakadą.
// Landmark: pylon wysokiego napięcia (30 m) z lampą ostrzegawczą, widoczny z całej areny. Pogoda: rain.
import { COLOR, R, createRunRoom, vec } from './_runKit.mjs';
import {
  dressFace,
  dressPerimeter,
  scatter,
  spawns,
  track,
} from './_runKitC.mjs';

export default function generate() {
  const bounds = R(-40, 40, -44, 44);
  const k = createRunRoom({
    id: 'combatSubstation',
    name: 'Podstacja',
    weather: 'rain',
    seed: 'run-substation-v1',
    bounds,
    startX: -20,
    exitX: 22,
    wallMaterial: 'concrete',
    wallHeights: [14, 18, 15, 20],
    doorWidth: 4,
  });
  track(k);
  const { arena, p } = k;

  // Grunt: asfalt na placu bramy, beton i drogi serwisowe w polu. Szwy na liczbach całkowitych.
  k.ground(R(-40, 40, 22, 44), 0, 'asphalt');
  k.ground(R(-40, 40, 16, 22), 0, 'concrete');
  k.ground(R(-40, 40, 4, 16), 0, 'asphalt'); // droga serwisowa
  k.ground(R(-40, 40, -8, 4), 0, 'concrete');
  k.ground(R(-40, 40, -14, -8), 0, 'asphalt'); // droga serwisowa
  k.ground(R(-40, 40, -24, -14), 0, 'concrete');
  k.ground(R(-40, 40, -44, -24), 0, 'asphalt');
  k.perimeter();

  // Rozdzielnia zachodnia i budka wschodnia: dachy na 4 m (poziom estakady).
  const SWG = R(-40, -6, -44, -24);
  const HUT = R(30, 40, -44, -24);
  k.deck(SWG, 4, 'concrete');
  k.deck(HUT, 4, 'concrete');
  // Estakada kablowa z kratownicy: z = −24…−19, rampy zejścia po obu końcach.
  const GAL = R(-30, 40, -24, -19);
  p.floor(GAL, 4, 'steel_grating', { thickness: 0.4 });
  for (const x of [-29.4, -20, -10, 0, 10, 20, 29.4])
    for (const z of [-23.6, -19.4])
      k.solid(R(x - 0.3, x + 0.3, z - 0.3, z + 0.3), 0, 3.6, 'metal');
  const rail = (a, b, y, openings) =>
    p.wall(a, b, 1.1, 0.12, 'metal', openings ? { openings } : {});
  rail(vec(-30, 4, -19), vec(40, 4, -19), 4, [
    { at: 3, width: 3.4, height: 1.1 },
    { at: 57, width: 3.4, height: 1.1 },
  ]);
  rail(vec(-6, 4, -24), vec(30, 4, -24), 4);
  k.ramp(vec(-27, 4, -19), vec(-27, 0, -7), 3, 'metal');
  k.ramp(vec(27, 4, -19), vec(27, 0, -7), 3, 'metal');
  // Attyki dachów rozdzielni (poza stykiem z estakadą i wejściem schodowym).
  rail(vec(-40, 4, -24), vec(-30, 4, -24), 4);
  rail(vec(-6, 4, -44), vec(-6, 4, -24), 4);
  rail(vec(-40, 4, -44), vec(-40, 4, -24), 4);
  rail(vec(30, 4, -44), vec(30, 4, -24), 4);
  k.rainShelters.push({ position: vec(0, 1.8, -21.5), size: vec(60, 3.6, 5) });

  // Landmark: pylon HV w polu (kratownica 16,5 × 30 × 7,2 m), kolizja tylko w podstawie.
  arena.decor('power_hv_pylon', vec(18, 0, -2), 0);
  k.solid(R(16, 20, -4, 0), 0, 6, 'metal', { visible: false });
  k.reserve(R(16, 20, -4, 0));
  k.light(18, 27, -2, COLOR.blue, 70, 45);
  k.light(18, 12, 2, COLOR.warm, 40, 28);
  k.light(11, 20, -2, COLOR.blue, 40, 30);
  k.light(25, 20, -2, COLOR.blue, 40, 30);
  // Dwa dalsze pylony za murem wschodnim i zachodnim: sylwetka linii przesyłowej.
  arena.decor('power_hv_pylon', vec(-48, 0, -10), Math.PI / 2);
  arena.decor('power_hv_pylon', vec(48, 0, 22), Math.PI / 2);

  // Transformatory: trzy rzędy z przerwami na przejścia (zwykle 12 m między osiami).
  const trafo = [
    [-34, -17],
    [-18, -17],
    [6, -17],
    [34, -17],
    [-30, -2],
    [-14, -2],
    [0, -2],
    [34, -2],
    [-24, 10],
    [-6, 10],
    [6, 10],
    [20, 10],
    [32, 10],
  ];
  for (const [x, z] of trafo) k.prop('power_transformer', x, z, { quarter: 0 });
  // Ogrodzenie ochronne i betonowe osłony między rzędami.
  for (const [model, x, z, quarter] of [
    ['city_highway_barrier', -18, -8, 0],
    ['city_highway_barrier', 12, -8, 0],
    ['city_highway_barrier', -10, 4, 0],
    ['city_highway_barrier', 26, 4, 0],
    ['city_barrier', 0, -11, 0],
    ['city_barrier', -32, -11, 0],
    ['city_barrier', 36, 14, 0],
    ['city_generator', -36, 1, 1],
    ['city_generator', 12, -14, 0],
    ['city_generator', 36, -8, 1],
    ['city_crates', -4, -14, 0],
    ['city_crates', -16, 14, 0],
    ['city_crates', 14, 2, 1],
    ['city_dumpster', 21, -13, 2],
    ['city_dumpster', -36, 13, 1],
    ['city_vending', 3, 1, 2],
    ['city_kiosk', -22, 1, 0],
  ])
    k.prop(model, x, z, { quarter });
  // Plac bramy i parking serwisowy.
  const gate = R(-40, 40, 24, 42);
  scatter(
    k,
    [
      'city_car',
      'city_wrecked_car',
      'city_barrier',
      'city_generator',
      'city_crates',
      'city_dumpster',
      'city_vending',
    ],
    gate,
    {
      count: 22,
      clear: 3.2,
      avoid: [R(-24, -16, 36, 44), R(-30, 40, 40, 44)],
    },
  );
  k.prop('city_smog_scrubber', 4, -38, {});
  k.prop('city_roof_water_tank', 12, -34, {});
  // Strefa północna: kontenery serwisowe, zapasowe transformatory, zbiorniki.
  scatter(
    k,
    [
      'city_crates',
      'city_generator',
      'city_dumpster',
      'city_barrier',
      'city_highway_barrier',
      'city_roof_hvac_unit',
    ],
    R(-6, 30, -43, -26),
    { count: 12, clear: 3.2, avoid: [R(18, 26, -44, -30)] },
  );
  // Rekwizyty na dachach rozdzielni (osłony dla strzelców; dach 4 m).
  for (const [model, x, z, quarter] of [
    ['city_roof_hvac_unit', -34, -34, 0],
    ['city_roof_hvac_unit', -14, -40, 0],
    ['city_roof_water_tank', -22, -32, 0],
    ['city_generator', 35, -40, 1],
  ])
    k.prop(model, x, z, { y: 4, quarter });

  // Elewacje rozdzielni i budki: rury, klimatyzatory, drzwi, szyldy, naklejki.
  dressFace(k, SWG, 4, 'S', [[{ face: 'city_door', y: 0, off: 0.15 }]], {
    step: 9,
    margin: 6,
    from: 12,
    to: 30,
  });
  // Szyldy ostrzegawcze na murze obwodu i na budynkach (kolory neonów: tylko paleta).
  dressPerimeter(k, {
    startX: -20,
    exitX: 22,
    step: 6,
    sets: [
      [
        { face: 'city_pipe_run', y: 0, off: 0.3 },
        { neon: 'warsztat', y: 6.2, w: 2.6, h: 1.3, c: COLOR.green, fl: 0.3 },
      ],
      [
        { face: 'city_ac_unit', y: 3.2, off: 0.35 },
        { face: 'city_ac_unit', y: 6, off: 0.35, dx: 1.2 },
        { decal: 'graffiti_tag1', y: 3, w: 3, h: 2 },
      ],
      [
        { face: 'city_shutter', y: 0, off: 0.2 },
        { neon: 'arrow', y: 5.2, w: 2.4, h: 1.2, c: COLOR.amber, fl: 0.2 },
      ],
      [
        { face: 'city_sign_box', y: 4.6, off: 0.15 },
        { face: 'city_pipe_run', y: 0, off: 0.3, dx: 2.4 },
        { decal: 'poster_torn2', y: 2.6, w: 1.8, h: 2.4 },
      ],
      [
        { face: 'city_door', y: 0, off: 0.15 },
        { neon: 'repair', y: 4.2, w: 2.4, h: 1.2, c: COLOR.blue, fl: 0.35 },
        { face: 'city_ad_screen', y: 1.2, off: 0.2, dx: 3 },
      ],
    ],
    perSide: {},
  });

  // Światła: błękit ostrzegawczy przy transformatorach, bursztyn na drogach, zimna biel przy bramie.
  for (const [x, z, c] of [
    [-24, -17, COLOR.blue],
    [0, -12, COLOR.warm],
    [24, -12, COLOR.blue],
    [-24, 4, COLOR.green],
    [0, 4, COLOR.blue],
    [24, 4, COLOR.violet],
    [-30, 14, COLOR.amber],
    [0, 14, COLOR.warm],
    [30, 14, COLOR.blue],
    [-30, -2, COLOR.warm],
    [-6, -2, COLOR.green],
    [32, -2, COLOR.amber],
  ])
    k.light(x, 6, z, c, 18, 14);
  for (const [x, z, c] of [
    [-34, 38, COLOR.amber],
    [-4, 33, COLOR.warm],
    [14, 38, COLOR.green],
    [34, 30, COLOR.amber],
    [-12, 26, COLOR.blue],
    [-34, 26, COLOR.violet],
  ])
    k.lamp(x, z, c);
  for (const [x, z, c] of [
    [-34, -36, COLOR.warm],
    [-16, -34, COLOR.green],
    [8, -30, COLOR.amber],
    [22, -36, COLOR.warm],
    [35, -36, COLOR.violet],
    [-10, -22, COLOR.blue],
    [10, -22, COLOR.blue],
  ])
    k.light(x, c === COLOR.warm ? 6 : 5.5, z, c, 20, 13);
  // Maszty oświetleniowe na rogach pola.
  for (const [x, z] of [
    [-38, -12],
    [38, -12],
    [-38, 18],
    [38, 18],
  ])
    k.prop('port_light_tower', x, z, {});

  // Kable i antena: rozpięcia między transformatorami i nad drogami.
  for (const [x, z, y] of [
    [-24, -8, 5.4],
    [-4, -8, 5.4],
    [18, -8, 5.4],
    [-26, 4, 5.8],
    [-6, 4, 5.8],
    [14, 4, 5.8],
    [32, 4, 5.8],
    [-24, 16, 5],
    [0, 16, 5],
    [26, 16, 5],
  ])
    k.deco('city_cable_span', x, y, z, 0);
  for (const [x, z] of [
    [-28, -29],
    [8, -42],
    [-30, 20],
    [36, 34],
  ])
    k.deco('city_antenna', x, 0, z, 0);

  // Efekty: iskry z transformatorów i łuków, para z kratek, kapanie z estakady.
  for (const [x, y, z] of [
    [-30, 3, -17],
    [6, 3, -17],
    [-14, 3, -2],
    [-8, 3, 10],
    [20, 3, 10],
    [30, 3, -17],
    [34, 3, -2],
  ])
    k.fx('sparks', x, y, z, 0.6);
  for (const [x, z] of [
    [-12, 6],
    [14, -10],
    [-30, 28],
    [26, 30],
  ])
    k.fx('steam', x, 0.1, z, 1.1);
  for (const [x, z] of [
    [-12, -21],
    [8, -21],
    [20, -21],
  ])
    k.fx('drip', x, 3.6, z);

  // Hazardy: łuki między transformatorami (cykl on/off) i beczki z olejem.
  k.hazards.push(
    {
      kind: 'electric_field',
      id: 'substation-west',
      position: vec(-24, 0.7, -17),
      size: vec(6, 1.4, 3),
      cycle: { onS: 2.5, offS: 3.5 },
    },
    {
      kind: 'electric_field',
      id: 'substation-east',
      position: vec(18, 0.7, -17),
      size: vec(6, 1.4, 3),
      cycle: { onS: 2.5, offS: 3.5, offsetS: 3 },
    },
    {
      kind: 'electric_field',
      id: 'substation-south-west',
      position: vec(-14, 0.7, 10),
      size: vec(5, 1.4, 3),
      cycle: { onS: 2, offS: 4, offsetS: 1.5 },
    },
    {
      kind: 'electric_field',
      id: 'substation-south-east',
      position: vec(26, 0.7, 10),
      size: vec(5, 1.4, 3),
      cycle: { onS: 2, offS: 4, offsetS: 4 },
    },
    {
      kind: 'explosive_barrel',
      id: 'substation-west-barrel',
      position: vec(-22, 0, -11),
    },
    {
      kind: 'explosive_barrel',
      id: 'substation-east-barrel',
      position: vec(24, 0, -5),
    },
    {
      kind: 'explosive_barrel',
      id: 'substation-yard-barrel',
      position: vec(2, 0, 28),
    },
  );
  for (const [x, z, w, d] of [
    [-24, -17, 6, 3],
    [18, -17, 6, 3],
    [-14, 10, 5, 3],
    [26, 10, 5, 3],
  ])
    k.decal('floor_hazard', x, 0.012, z, w, d, 0);

  for (const [tex, x, z, w] of [
    ['puddle1', -12, 8, 5],
    ['puddle2', 10, -10, 5],
    ['puddle1', 24, 28, 5],
    ['puddle2', -26, 30, 5],
    ['puddle1', 0, -30, 5],
    ['oil_stain', -2, 6, 3],
    ['oil_stain', 12, -4, 3],
    ['oil_stain', -20, -9, 3],
    ['floor_arrow', 22, -34, 2],
    ['floor_stop', -20, 36, 3],
    ['manhole', 8, 0, 1.6],
    ['manhole', -8, -12, 1.6],
    ['crack_floor', 28, -12, 3],
    ['tire_marks', 6, 34, 5],
    ['leak_streak', -4, -6, 3],
  ])
    k.decal(tex, x, 0.012, z, w, w * 0.6);

  k.finish({
    points: [
      ['A', 0, 0, 0],
      ['B', -20, 0, 32],
      ['C', 22, 0, -36],
    ],
    zones: [
      ['Plac bramy', R(-40, 40, 22, 44), 'open'],
      ['Pole transformatorów', R(-40, 40, -14, 22), 'dense'],
      ['Estakada kablowa', R(-40, 40, -24, -14), 'high'],
      ['Rozdzielnia północna', R(-40, 40, -44, -24), 'low'],
    ],
    maxAlive: 9,
    minSpawnDistance: 12,
  });
  spawns(k, [
    [-30, 32],
    [-8, 30],
    [10, 34],
    [30, 30],
    [-34, 8],
    [-18, 2],
    [10, 0],
    [34, 4],
    [-20, -11],
    [2, -11],
    [30, -12],
    [-2, -22],
    [14, -30],
    [24, -38],
    [-10, -34],
  ]);
  return arena;
}

export const shots = [
  { name: 'start', x: -20, z: 40, yaw: 0, pitch: 12 },
  { name: 'field', x: -30, z: 8, yaw: 290, pitch: 8 },
  { name: 'pylon', x: 0, z: 12, yaw: 60, pitch: 25 },
  { name: 'gallery', x: -27, z: -21, floorY: 4, yaw: 270, pitch: -6 },
  { name: 'north', x: 0, z: -30, yaw: 180, pitch: 6 },
  { name: 'exit', x: 22, z: -12, yaw: 0, pitch: 4 },
];
