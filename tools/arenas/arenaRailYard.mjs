import { createArena, vec } from './lib/arena.mjs';
import { createPrimitives } from './lib/prims.mjs';

const rect = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });

export default function generate() {
  const arena = createArena({
    id: 'arenaRailYard',
    name: 'Zajezdnia Maglev',
    weather: 'snow',
    seed: 'maglev-winter-1',
    bounds: rect(-210, 210, -90, 90),
  });
  const p = createPrimitives(arena);
  const box = (x, y, z, sx, sy, sz, material = 'metal', extra = {}) =>
    arena.block({
      position: vec(x, y, z),
      size: vec(sx, sy, sz),
      material,
      ...extra,
    });
  const prop = (model, x, z, sx, sy, sz, y = 0) =>
    box(x, y + sy / 2, z, sx, sy, sz, 'metal', { model, instance: true });
  const warm = (x, y, z, intensity, range) =>
    arena.light(vec(x, y, z), '#fff1d6', intensity, range, {
      groundGlow: false,
    });
  const workshopLighting = (x, z, halfDepth) => {
    warm(x, 3.35, z, 135, 16);
    box(x, 3.65, z, 2.8, 0.14, 0.34, 'light_white');
    for (const dx of [-3, 3])
      box(x + dx, 2.85, z - halfDepth - 0.22, 1.9, 0.75, 0.07, 'light_white');
  };
  const flight = (from, to, width = 4) => {
    const result = p.stairs({
      from,
      to,
      width,
      stepRise: 0.2,
      stepDepth: 1,
      material: 'steel_grating',
      walkable: false,
    });
    return result;
  };

  arena.roomMeta({
    playerSpawn: vec(-200, 0, 70),
    maxAlive: 12,
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: vec(-200, 0, 70),
        size: vec(3, 3, 1),
      },
      {
        id: 'exit',
        role: 'exit',
        position: vec(200, 0, -80),
        size: vec(3, 3, 1),
      },
    ],
  });
  arena.arenaMeta({
    maxAlive: 12,
    enemyTickets: 200,
    spawnRing: { minM: 25, maxM: 100 },
    navigationCellM: 2,
    navigationClearanceM: 1.1,
  });
  arena.zone('Pole torów', rect(-110, 210, -55, 42), 'open');
  arena.zone('Hala serwisowa', rect(-200, -110, -70, -10), 'interior');
  arena.zone('Kładka i wieże schodowe', rect(-36, 26, -84, 64), 'high');
  arena.zone('Peron wyspowy', rect(-40, 80, 45, 55), 'dense');
  arena.zone('Nastawnia i zaplecze', rect(95, 145, -85, -28), 'dense');
  arena.zone('Obrotnica i parowozownia', rect(148, 208, 20, 89), 'low');

  // Grunt z otworami: kanały hali oraz prostokąt zagłębienia obrotnicy.
  for (const r of [
    rect(-210, 148, -90, -70),
    rect(-210, -200, -70, -10),
    rect(-110, 148, -70, -10),
    rect(-210, 148, -10, 90),
    rect(148, 210, -90, 26),
    rect(148, 156, 26, 54),
    rect(184, 210, 26, 54),
    rect(148, 210, 54, 90),
    rect(-200, -110, -70, -57),
    rect(-200, -110, -53, -27),
    rect(-200, -110, -23, -10),
    rect(-200, -190, -57, -53),
    rect(-140, -110, -57, -53),
    rect(-200, -190, -27, -23),
    rect(-140, -110, -27, -23),
  ])
    p.floor(r, 0, 'snow_asphalt');

  // Przejazdy przerywają prowadnice; przez pary torów nie trzeba skakać.
  const crossings = [-96, -56, 20, 90, 146, 200];
  const tracks = [-45, -35, -10, 0, 25, 35];
  for (const z of tracks) {
    for (const [left, right] of [
      [-207, 155],
      [185, 207],
    ]) {
      for (const side of [-1, 1])
        box(
          (left + right) / 2,
          -0.045,
          z + side * 1.35,
          right - left,
          0.09,
          0.25,
          'rail_sleeper_concrete',
        );
    }
    for (let x = -204; x < 210; x += 12) {
      if (
        crossings.some((c) => Math.abs(c - x) < 12) ||
        (z < -20 && x < -140) ||
        (z < -20 && Math.abs(x - 120) < 18) ||
        (z > 20 && Math.abs(x - 170) < 24)
      )
        continue;
      // Moduły szczegółowe na końcach odcinków; dłuższe prowadnice z tych samych materiałów.
      if ((x + 204) % 36 === 0)
        prop('rail_track_straight', x, z, 12, 1, 4.6, -0.65);
      else {
        box(x, -0.2, z, 12, 0.9, 0.6, 'rail_sleeper_concrete');
        box(x, 0.25, z, 12, 0.2, 1.6, 'metal');
      }
    }
  }

  // Składy przerywane przejazdami. Otwarte wagony mają rzeczywiste drzwi i sufit.
  const consists = [
    { z: -45, cars: [-76, -24, 3, 36, 62, 91, 146], open: [-24, 36] },
    { z: -35, cars: [-94, -68, -8, 18, 51, 77, 150], open: [-68, 18, 77] },
    { z: -10, cars: [-80, -54, -21, 5, 40, 66, 140, 168], open: [-54, 5, 66] },
    { z: 0, cars: [54], open: [] },
    {
      z: 25,
      cars: [-192, -165, -132, -106, -24, 54, 80, 112, 138],
      open: [-165, -24, 80],
    },
    { z: 35, cars: [], open: [] },
    { z: -51, cars: [-167, -141], open: [] },
    { z: -25, cars: [-181, -155], open: [] },
  ];
  for (const { z, cars, open } of consists)
    cars.forEach((x, i) => {
      if (!open.includes(x)) {
        const head = i === 0 && cars.length > 2;
        prop(
          head ? 'rail_maglev_head' : 'rail_maglev_car',
          x,
          z,
          head ? 27 : 25,
          4.1,
          4,
        );
        p.floor(
          rect(
            x - (head ? 13.2 : 12.2),
            x + (head ? 5.5 : 12.2),
            z - 1.5,
            z + 1.5,
          ),
          4.1,
          'maglev_body_panel',
          {
            visible: false,
          },
        );
      } else {
        arena.decor('rail_maglev_car_open', vec(x, 0, z));
        box(x, 0.55, z, 25, 1.1, 4, 'maglev_body_panel');
        p.floor(
          rect(x - 12, x + 12, z - 1.9, z + 1.9),
          1.1,
          'maglev_body_panel',
          { visible: false },
        );
        p.floor(
          rect(x - 12.2, x + 12.2, z - 1.55, z + 1.55),
          4.1,
          'maglev_body_panel',
          { thickness: 0.7, visible: false },
        );
        for (const side of [-1, 1]) {
          p.wall(
            vec(x - 12.5, 1.1, z + side * 1.9),
            vec(x + 12.5, 1.1, z + side * 1.9),
            2.3,
            0.2,
            'maglev_body_panel',
            {
              visible: false,
              openings: [
                { at: 6.25, width: 1.5, height: 2.2 },
                { at: 18.75, width: 1.5, height: 2.2 },
              ],
            },
          );
          // Krótkie schodki w osi Z są trasą kapsuły, nie siatki AI.
          for (const dx of [-6.25, 6.25]) {
            p.stairs({
              from: vec(x + dx, 0, z + side * 5.5),
              to: vec(x + dx, 1.1, z + side * 2),
              width: 1.5,
              stepRise: 0.22,
              stepDepth: 0.4,
              material: 'steel_grating',
              walkable: false,
            });
          }
        }
        for (const side of [-1, 1])
          box(x + side * 12.3, 2.25, z, 0.4, 2.3, 4, 'maglev_body_panel', {
            visible: false,
          });
      }
    });
  // Schody na dachy dwóch składów: alternatywa A–B i B–C.
  for (const [x, z] of [
    [54, 0],
    [-24, 25],
  ]) {
    flight(vec(x - 38, 0, z), vec(x - 12, 4.1, z), 3);
    flight(vec(x + 38, 0, z), vec(x + 12, 4.1, z), 3);
  }

  for (const [x, z] of [
    [62, -45],
    [112, 25],
  ]) {
    p.stairs({
      from: vec(x, 0, z - 8.5),
      to: vec(x, 4.1, z - 1.5),
      width: 1.6,
      stepRise: 0.24,
      stepDepth: 0.35,
      material: 'steel_grating',
      walkable: false,
    });
  }

  // Hala: bramy wschodnie, antresola 5 m, tory i dwa prawdziwe kanały -1,5 m.
  p.wall(vec(-200, 0, -70), vec(-110, 0, -70), 14, 0.5, 'corrugated');
  p.wall(vec(-200, 0, -70), vec(-200, 0, -10), 14, 0.5, 'corrugated', {
    openings: [{ at: 48, width: 8, height: 5 }],
  });
  p.wall(vec(-200, 0, -10), vec(-110, 0, -10), 14, 0.5, 'corrugated', {
    openings: [
      { at: 30, width: 10, height: 5 },
      { at: 72, width: 8, height: 5 },
    ],
  });
  p.wall(vec(-110, 0, -70), vec(-110, 0, -10), 14, 0.5, 'corrugated', {
    openings: [
      { at: 15, width: 9, height: 6 },
      { at: 30, width: 8, height: 6 },
      { at: 45, width: 9, height: 6 },
    ],
  });
  p.floor(rect(-200, -110, -70, -10), 14, 'roof_hvac_metal', {
    walkable: false,
  });
  for (const z of [-55, -25]) {
    p.floor(rect(-190, -140, z - 2, z + 2), -1.5, 'snow_concrete');
    flight(vec(-190, 0, z), vec(-180, -1.5, z), 3);
    flight(vec(-150, -1.5, z), vec(-140, 0, z), 3);
    for (const side of [-1, 1])
      p.wall(
        vec(-190, -1.5, z + side * 2),
        vec(-140, -1.5, z + side * 2),
        1.5,
        0.2,
        'rail_sleeper_concrete',
      );
    for (let x = -184; x <= -148; x += 12)
      arena.decor('rail_track_straight', vec(x, -0.65, z));
  }
  for (const x of [-190, -126])
    prop('rail_track_straight', x, -40, 12, 1, 4.6, -0.65);
  p.floor(rect(-198, -112, -68, -60), 5, 'steel_grating');
  flight(vec(-192, 0, -56), vec(-160, 5, -56));
  flight(vec(-150, 5, -56), vec(-118, 0, -56));
  p.floor(rect(-162, -148, -60, -54), 5, 'steel_grating');
  // Usunięcie płyt nad biegami zachowuje prześwit.
  for (let x = -194; x < -110; x += 12)
    arena.decor('port_warehouse_roof_truss', vec(x, 12, -40));
  // Suwnica na przyściennych torach jezdnych, podparta halą.
  for (const z of [-67, -13]) box(-155, 10.8, z, 88, 0.6, 0.6, 'metal');
  box(-152, 11.6, -40, 3, 1, 55, 'crane_paint');
  prop('city_generator', -188, -17, 1.6, 1.4, 1.005);
  prop('build_pipe_stack', -182, -40, 3.02, 2.793, 3);

  // Kładka poprzeczna 8 m z trzema niezależnymi wejściami.
  p.floor(rect(17, 23, -80, 60), 8, 'steel_grating');
  for (const z of [-80, 60]) {
    flight(vec(-34, 0, z), vec(18, 8, z), 5);
    p.floor(rect(16, 25, z - 4, z + 4), 8, 'steel_grating');
    // Wsporniki są wyłącznie pod spocznikami.
    for (const x of [17, 24]) box(x, 3.85, z, 1, 7.7, 1, 'concrete');
  }
  flight(vec(-30, 1.1, 57), vec(18, 8, 57), 4);
  p.floor(rect(-34, -28, 50, 59), 1.1, 'steel_grating');
  for (const x of [16.8, 23.2]) {
    p.wall(vec(x, 8, -80), vec(x, 8, 60), 1.1, 0.15, 'metal', {
      openings: [{ at: 130, width: 7, height: 1.1 }],
    });
  }

  // Wyspa: dwa łagodne wejścia naziemne, ławki i automaty poza kołem C.
  p.floor(rect(-40, 80, 45, 55), 1.1, 'rail_sleeper_concrete', {
    thickness: 1.1,
  });
  p.ramp({
    from: vec(-50, 0, 50),
    to: vec(-40, 1.1, 50),
    width: 8,
    material: 'snow_concrete',
  });
  p.ramp({
    from: vec(90, 0, 50),
    to: vec(80, 1.1, 50),
    width: 8,
    material: 'snow_concrete',
  });
  for (const x of [-34, -10, 38, 62, 74]) {
    arena.decor('rail_platform_canopy', vec(x, 1.1, 50));
    warm(x, 4.25, 50, 175, 19);
    for (const dx of [-3, 3])
      box(x + dx, 2.85, 50, 0.2, 3.5, 0.2, 'metal', { visible: false });
    box(x, 4.85, 50, 12, 0.3, 6.16, 'metal', { visible: false });
  }
  for (const x of [-30, 48, 72]) {
    prop('city_vending', x, 46, 1.014, 2, 0.816, 1.1);
    box(x + 4, 1.65, 46, 3.5, 0.25, 1, 'metal');
    for (const dx of [-1.2, 1.2])
      box(x + 4 + dx, 1.35, 46, 0.2, 0.5, 0.7, 'metal');
  }
  // Wyposażenie peronu przy północnej krawędzi, z wolnym torem dojścia do C.
  for (const x of [-20, 12, 56]) {
    arena.decor('city_street_lamp', vec(x, 1.1, 45.5));
    warm(x, 5.45, 46.15, 210, 23);
    prop('city_barrier', x - 4, 45.7, 2, 0.929, 0.51, 1.1);
  }
  for (const x of [-18, 44, 68]) {
    prop('city_kiosk', x, 46.35, 0.8, 2.235, 0.624, 1.1);
    prop('city_crates', x + 2, 46.3, 1.212, 1.59, 1.256, 1.1);
    box(x - 2, 1.42, 46.3, 1.2, 0.64, 0.7, 'metal');
  }
  prop('city_vending', 1, 46, 1.014, 2, 0.816, 1.1);
  for (const [x, z] of [
    [-20, 66],
    [33, 66],
    [64, 58],
  ]) {
    prop('city_stall', x, z, 3, 2.622, 2.043);
    prop('city_crates', x + 2.7, z, 1.212, 1.59, 1.256);
    warm(x, 2.35, z + 0.8, 105, 15);
  }

  // Nastawnia: oryginalne wąskie schody mają osobne collidery i galerię.
  arena.decor('rail_control_tower', vec(120, 0, -60));
  warm(120, 11.9, -56.7, 200, 24);
  for (const dx of [-1.45, 1.45]) {
    box(120 + dx, 11.9, -56.93, 1.5, 0.82, 0.06, 'light_white');
    box(123.07, 11.9, -60 + dx, 0.06, 0.82, 1.5, 'light_white');
  }
  box(120, 5, -60, 6, 10, 6, 'concrete', { visible: false });
  for (const z of [-63.6, -56.4])
    p.floor(rect(115.8, 124.2, z - 0.6, z + 0.6), 10, 'steel_grating', {
      visible: false,
    });
  for (const x of [116.4, 123.6])
    p.floor(rect(x - 0.6, x + 0.6, -63, -57), 10, 'steel_grating', {
      visible: false,
    });
  for (let level = 0; level < 5; level++) {
    const x = level % 2 === 0 ? 114.15 : 115.25;
    const dir = level % 2 === 0 ? 1 : -1;
    const stair = p.stairs({
      from: vec(x, level * 2, -60 - dir * 1.35),
      to: vec(x, (level + 1) * 2, -60 + dir * 1.35),
      width: 1.1,
      stepRise: 0.2,
      stepDepth: 0.27,
      material: 'steel_grating',
      walkable: false,
    });
    stair.blocks.forEach((b) => {
      b.walkable = false;
      b.visible = false;
    });
    p.floor(
      rect(
        113.6,
        115.8,
        -60 + dir * 1.35 - (dir < 0 ? 1.1 : 0),
        -60 + dir * 1.35 + (dir > 0 ? 1.1 : 0),
      ),
      (level + 1) * 2,
      'steel_grating',
      { visible: false, walkable: false },
    );
  }
  // Szeroka zewnętrzna trasa na galerię służy również AI.
  flight(vec(48, 0, -76), vec(112, 10, -76));
  p.floor(rect(110, 117, -78, -56), 10, 'steel_grating');
  p.building({
    rect: rect(133, 145, -80, -64),
    height: 5,
    interior: true,
    wallMaterial: 'snow_concrete',
    doors: [
      { side: 'south', at: 6, width: 5 },
      { side: 'west', at: 6, width: 4 },
    ],
  });
  prop('city_kiosk', 133, -49, 0.8, 2.235, 0.624);
  workshopLighting(139, -72, 8);

  // Zagłębiona obrotnica z szerokim, tymczasowym mostem nad prowadnicą.
  p.floor(rect(156, 184, 26, 54), -1.5, 'rail_sleeper_concrete');
  arena.decor('rail_turntable', vec(170, -2.5, 40));
  p.floor(rect(156, 184, 34, 46), 0, 'steel_grating');
  p.ramp({
    from: vec(156, 0, 30),
    to: vec(168, -1.5, 30),
    width: 6,
    material: 'snow_concrete',
  });
  p.ramp({
    from: vec(184, 0, 50),
    to: vec(172, -1.5, 50),
    width: 6,
    material: 'snow_concrete',
  });
  // Parowozownia ma dwa wejścia i zachowane tylko boczne połacie dachu.
  p.wall(vec(150, 0, 55), vec(150, 0, 88), 8, 0.6, 'rust');
  p.wall(vec(205, 0, 55), vec(205, 0, 88), 8, 0.6, 'corrugated');
  p.wall(vec(150, 0, 88), vec(205, 0, 88), 8, 0.6, 'snow_concrete');
  p.wall(vec(150, 0, 55), vec(205, 0, 55), 8, 0.6, 'corrugated', {
    openings: [
      { at: 12, width: 12, height: 6 },
      { at: 37, width: 12, height: 6 },
    ],
  });
  p.floor(rect(150, 162, 55, 88), 8, 'roof_hvac_metal', { walkable: false });
  p.floor(rect(193, 205, 55, 88), 8, 'roof_hvac_metal', { walkable: false });
  for (const yaw of [-0.6, 0, 0.6]) {
    arena.decor('rail_track_straight', vec(184, 0, 63), yaw);
  }
  prop('build_pipe_stack', 193, 77, 3.02, 2.793, 3);
  box(176, 1, 80, 8, 2, 3, 'snow_concrete');
  for (const [x, z] of [
    [155, 69],
    [178, 83],
    [198, 67],
  ]) {
    warm(x, 5.4, z, 260, 29);
    box(x, 5.7, z, 2.6, 0.18, 0.48, 'light_white');
  }
  // Zatoki napraw na obrzeżu placu obrotnicy. Rampy i most E mają wolne wloty.
  for (const [x, z] of [
    [150, 21],
    [178, 18],
    [200, 41],
  ]) {
    box(x, 0.62, z, 3.4, 0.22, 1.65, 'metal');
    box(x - 0.35, 1.08, z, 2.05, 0.7, 1.25, 'corrugated');
    box(x + 1.55, 1.02, z, 0.15, 0.62, 1.45, 'metal');
    for (const dx of [-1.15, 1.15])
      for (const dz of [-0.66, 0.66])
        box(x + dx, 0.28, z + dz, 0.54, 0.56, 0.37, 'rubber');
    prop('build_pipe_stack', x - 3.8, z - 2.5, 3.02, 2.793, 3);
    box(x + 3.5, 0.64, z + 2.6, 4.2, 1.28, 1.5, 'rail_sleeper_concrete');
    arena.decor('rail_snow_drift_patch', vec(x, 0, z + 4));
    warm(x, 4, z, 165, 22);
  }
  prop('port_container_20_ochre', 142, 45, 6.058, 2.591, 2.438);

  // Tkanka łącząca: droga techniczna, warsztaty, bramy i duże osłony co 24–32 m.
  p.floor(rect(-209, 209, 62, 76), 0, 'snow_asphalt', { walkable: false });
  for (let x = -180; x <= 130; x += 28) {
    box(x, 0.12, 61, 19, 0.24, 0.35, 'rail_sleeper_concrete');
    box(x, 0.12, 77, 19, 0.24, 0.35, 'rail_sleeper_concrete');
    prop('city_car', x, 69, 4.42, 1.46, 1.94);
    prop('city_barrier', x + 8, 59, 2, 0.929, 0.51);
    prop('city_generator', x + 5, 80, 1.6, 1.4, 1.005);
    arena.decor('rail_snow_drift_patch', vec(x - 8, 0, 79));
  }
  for (const [x, z] of [
    [-176, 8],
    [-116, 7],
    [-48, 12],
    [38, 12],
    [104, 12],
    [184, 8],
    [-76, -72],
    [-16, -72],
    [76, -60],
  ]) {
    p.building({
      rect: rect(x - 6, x + 6, z - 5, z + 5),
      height: 4.5,
      interior: true,
      wallMaterial: 'snow_concrete',
      roofMaterial: 'corrugated',
      doors: [
        { side: 'west', at: 5, width: 4 },
        { side: 'east', at: 5, width: 4 },
      ],
    });
    arena.decor('city_ac_unit', vec(x, 2, z + 5.3));
    workshopLighting(x, z, 5);
    prop('city_crates', x + 9, z + 6, 1.212, 1.59, 1.256);
  }
  for (const z of [-19, 16, 57])
    for (let x = -188; x <= 196; x += 32) {
      if (
        (x > 148 && z > 20) ||
        (x < -110 && z < -10) ||
        (Math.abs(x - 20) < 10 && z > 40)
      )
        continue;
      const palette = [
        'port_container_20_graphite',
        'port_container_20_olive',
        'port_container_20_navy',
      ];
      prop(palette[Math.floor((x + 188) / 32) % 3], x, z, 6.058, 2.591, 2.438);
      prop('city_dumpster', x + 9, z, 1.97, 1.33, 1.08);
    }

  // Wyspy oslon na miedzytorzach: przejazdy pozostaja szerokie.
  for (const z of [-62, -28, 9, 43]) {
    for (let x = -198; x <= 198; x += 28) {
      if (
        (x < -108 && z < 0) ||
        (x > 145 && z === 43) ||
        (z === -28 && Math.abs(x + 40) < 12) ||
        (z === -28 && Math.abs(x - 120) < 12) ||
        (z === -62 && x > 104 && x < 147) ||
        Math.abs(x - 20) < 8
      )
        continue;
      const kind = ((x + 198) / 28 + (z === 9 ? 1 : 0)) % 3;
      if (kind === 0) {
        box(x, 0.75, z, 4.5, 1.5, 1.8, 'metal');
        box(x + 2.8, 0.95, z, 0.9, 1.9, 1.2, 'corrugated');
        arena.decor('rail_snow_drift', vec(x - 3.5, 0, z));
      } else if (kind === 1) {
        for (const dz of [-0.6, 0.6])
          box(x, 0.55, z + dz, 4.8, 1.1, 0.85, 'rail_sleeper_concrete');
      } else {
        prop('city_car', x, z, 4.42, 1.46, 1.94);
      }
    }
  }
  for (const [x, z] of [
    [-188, 42],
    [-150, 53],
    [-118, 43],
    [-74, 48],
    [106, 49],
    [137, 54],
    [-177, -19],
  ]) {
    p.building({
      rect: rect(x - 6, x + 6, z - 4, z + 4),
      height: 4,
      interior: true,
      wallMaterial: 'snow_concrete',
      roofMaterial: 'corrugated',
      doors: [
        { side: 'south', at: 6, width: 4 },
        { side: 'east', at: 4, width: 3 },
      ],
    });
    workshopLighting(x, z, 4);
  }
  for (const [x, z] of [
    [-174, 53],
    [-102, 52],
    [102, 58],
    [-167, -15],
  ]) {
    p.wall(vec(x - 9, 0, z), vec(x + 9, 0, z), 2.1, 0.25, 'metal', {
      openings: [{ at: 9, width: 5, height: 2.1 }],
    });
    prop('city_barrier', x - 6, z + 4, 2, 0.929, 0.51);
  }
  // Szafy na obrzeżach kładki zostawiają poprzeczne przejazdy pod pomostem.
  for (const [x, z] of [
    [17, -68],
    [24, -42],
    [16, -16],
    [23, 13],
    [16, 41],
  ]) {
    box(x, 0.85, z, 1.55, 1.7, 2.2, 'corrugated');
    box(x + 0.8, 1.45, z, 0.08, 0.18, 0.26, 'neon_amber');
    prop('city_crates', x + 2.6, z - 1.6, 1.212, 1.59, 1.256);
    warm(20, 7.3, z, 220, 24);
    box(20, 7.63, z, 1.8, 0.16, 0.4, 'light_white');
  }
  for (const x of [-190, -184, -178, -172, -166]) {
    box(x, 0.055, 73, 0.12, 0.07, 5, 'rail_sleeper_concrete');
    if (x % 12 === -10) prop('city_car', x + 2, 74, 4.42, 1.46, 1.94);
  }
  for (const x of [-187, -169, -139, -121]) {
    box(x, 1, -48, 6, 2, 1.25, 'corrugated');
    box(x, 0.8, -34, 5, 1.6, 1.1, 'metal');
    warm(x, 8, -48, 360, 36);
    warm(x, 6.7, -29, 205, 27);
    box(x, 8.35, -48, 2.4, 0.16, 0.4, 'light_white');
    box(x, 7.05, -29, 2.4, 0.16, 0.4, 'light_white');
  }
  for (const x of [-183, -154, -126]) warm(x, 4.4, -64, 125, 18);
  for (const x of [-122, -2, 90, 146]) {
    arena.decor('rail_track_straight', vec(x, -0.8, -7), 0.16);
    arena.decor('rail_track_straight', vec(x, -0.8, 22), -0.16);
  }

  // Tor Z=35 zostaje bez skladu. Niskie oslonki nie przecinaja jego osi.
  for (const x of [-172, -138, -104, -70, -36, -2, 32, 66, 100, 134]) {
    box(x, 0.64, 39, 4.6, 1.28, 1.5, 'rail_sleeper_concrete');
    box(x + 2.7, 0.8, 39, 0.8, 1.6, 0.9, 'metal');
    box(x + 10, 0.68, 31, 5, 1.36, 1.8, 'corrugated');
  }
  // Skrajne zatoki rozbijaja pas pomiedzy nastawnia i murem oporowym.
  for (const x of [162, 194]) {
    box(x, 1.1, -73, 9, 2.2, 3, 'snow_concrete');
    prop('city_generator', x + 5, -72, 1.6, 1.4, 1.005);
  }

  // Maszty podtrzymują przewody, bramownice obejmują pary torów.
  for (const z of [-50, 5, 40])
    for (let x = -90; x <= 190; x += 36) {
      arena.decor('rail_catenary_mast', vec(x, 0, z));
      box(x, 4, z, 0.4, 8, 0.4, 'metal', { visible: false });
      warm(x, 7.1, z + 3, 420, 52);
    }
  for (const x of [-102, -54, 92, 198])
    for (const z of [-40, 30]) {
      arena.decor('rail_signal_gantry', vec(x, 0, z));
      for (const side of [-1, 1])
        box(x, 3.1, z + side * 11, 1, 6.2, 0.5, 'metal', { visible: false });
      box(x, 6.6, z, 1.4, 0.8, 23.2, 'metal', { visible: false });
      arena.light(vec(x, 5.05, z - 5), '#6dff4a', 68, 16);
      arena.light(vec(x, 5.05, z + 5), '#ffae1a', 72, 16);
    }
  for (const [x, z] of [
    [-89, -29],
    [-34, -17],
    [30, -32],
    [82, -17],
    [124, 15],
    [183, -28],
  ]) {
    box(x, 0.55, z, 0.3, 1.1, 0.3, 'metal');
    const green = x < 0 || x === 82;
    box(x, 1.24, z, 0.42, 0.28, 0.42, green ? 'neon_green' : 'neon_amber');
    arena.light(vec(x, 1.27, z), green ? '#6dff4a' : '#ffae1a', 42, 11);
  }
  for (const { z, cars } of consists.slice(0, 6))
    for (const [i, x] of cars.entries())
      if (i % 2 === 0) arena.light(vec(x, 2.5, z + 2.45), '#3d7bff', 66, 13);
  // Mur oporowy, nasyp, clôture południowa i zamknięcia końców torów.
  p.wall(vec(-210, 0, -87), vec(210, 0, -87), 5, 2, 'snow_concrete');
  p.fence({ from: vec(-210, 0, 87), to: vec(210, 0, 87), height: 3.5 });
  for (const x of [-208, 208]) {
    p.wall(vec(x, 0, -87), vec(x, 0, 87), 5, 0.5, 'metal');
    for (const z of tracks)
      arena.decor(
        'rail_track_buffer',
        vec(x > 0 ? 204 : -204, 0, z),
        x > 0 ? 0 : Math.PI,
      );
  }
  p.safetyBoundary(
    [
      vec(-210, -2, -90),
      vec(210, -2, -90),
      vec(210, -2, 90),
      vec(-210, -2, 90),
    ],
    22,
  );
  for (let x = -200; x <= 200; x += 16) {
    arena.decor('rail_snow_drift_long', vec(x, 0, -85));
    arena.decor('rail_snow_drift', vec(x + 5, 0, -81));
    arena.decor('rail_snow_drift_long', vec(x, -1, -97), 0, { scale: 6 });
  }
  // Oprawa bez colliderów; grunt pod nią zapewnia istniejący silnik horyzontu.
  for (let x = -240; x <= 240; x += 40) {
    arena.decor('build_hoarding_fence', vec(x, 0, 98));
    arena.decor('roof_stairwell_hut', vec(x, -1, -106), 0, { scale: 4 });
    arena.decor('city_car', vec(x + 12, 0, 105));
    arena.decor('city_street_lamp', vec(x, 0, 110));
  }
  for (const x of [-240, 240])
    for (const z of [-40, 30]) {
      arena.decor('city_overpass_deck', vec(x, 4, z), Math.PI / 2, {
        scale: 3,
      });
      arena.decor('rail_signal_gantry', vec(x, 0, z));
    }
  for (const [x, z, y] of [
    [-180, -40, 8],
    [-130, -40, 8],
    [20, 50, 5],
    [120, -60, 12],
    [170, 40, 5],
    [-150, 10, 4],
    [-80, 65, 5],
    [-15, 15, 5],
    [65, 65, 5],
    [130, 70, 5],
    [180, 75, 5],
  ])
    arena.light(vec(x, y, z), '#fff1d6', 85, 34);
  for (const [x, z] of [
    [-110, -40],
    [20, -80],
    [20, 60],
    [120, -40],
    [170, 60],
  ])
    arena.light(vec(x, 4, z), '#ffae1a', 45, 25);
  for (const [x, z] of [
    [-40, -22],
    [20, 50],
    [120, -60],
  ])
    arena.light(vec(x, 5, z), '#3d7bff', 35, 25);

  for (const [id, x, y, z] of [
    ['A', -155, 0, -40],
    ['B', -40, 0, -22],
    ['C', 20, 1.1, 50],
    ['D', 120, 0, -40],
    ['E', 170, 0, 40],
  ])
    arena.point(id, vec(x, y, z), 5);
  for (const [x, z] of [
    [-180, -62],
    [-122, -18],
    [-176, -32],
    [-124, -64],
    [-88, -80],
    [-44, -80],
    [36, -80],
    [88, -82],
    [136, -84],
    [180, -68],
    [190, -18],
    [152, -20],
    [100, -24],
    [38, -24],
    [-56, -24],
    [-108, 18],
    [-162, 46],
    [-100, 80],
    [-44, 80],
    [12, 80],
    [68, 80],
    [124, 80],
    [196, 68],
    [156, 80],
    [190, 28],
    [190, 52],
    [8, 64],
    [20, -22],
  ])
    arena.spawn(vec(x, 0, z));
  arena.arenaMeta({
    spawnPoints: [
      ...arena.toRoom().spawnPoints.map((position) => ({ ...position, y: 0 })),
      vec(-2, 1.1, 53),
    ],
  });
  // Układ Szturmu (ADR 0011 D4): front przesuwa się przez trzy sektory.
  arena.arenaMeta({
    assault: {
      sectors: [
        {
          playerSpawn: { x: -162, y: 0, z: 46 },
          stations: [
            { x: -100, y: 0, z: 80 },
            { x: -44, y: 0, z: 80 },
          ],
          spawnPoints: [
            { x: -2, y: 1.1, z: 53 },
            { x: 8, y: 0, z: 64 },
            { x: 12, y: 0, z: 80 },
            { x: -108, y: 0, z: 18 },
          ],
        },
        {
          playerSpawn: { x: 12, y: 0, z: 80 },
          stations: [
            { x: 20, y: 1.1, z: 50 },
            { x: 38, y: 0, z: -24 },
          ],
          spawnPoints: [
            { x: 36, y: 0, z: -80 },
            { x: 68, y: 0, z: 80 },
            { x: 100, y: 0, z: -24 },
            { x: -44, y: 0, z: 80 },
            { x: 88, y: 0, z: -82 },
          ],
        },
        {
          playerSpawn: { x: 68, y: 0, z: 80 },
          stations: [
            { x: 120, y: 0, z: -40 },
            { x: 170, y: 0, z: 40 },
          ],
          spawnPoints: [
            { x: 100, y: 0, z: -24 },
            { x: 152, y: 0, z: -20 },
            { x: 196, y: 0, z: 68 },
            { x: 156, y: 0, z: 80 },
            { x: 136, y: 0, z: -84 },
            { x: 88, y: 0, z: -82 },
          ],
        },
      ],
    },
  });
  return arena;
}
