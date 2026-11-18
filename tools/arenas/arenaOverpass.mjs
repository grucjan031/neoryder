import { createArena, vec } from './lib/arena.mjs';
import { createPrimitives } from './lib/prims.mjs';
import { footprint, verticalRange } from './lib/geometry.mjs';
import { largestGroundGap } from './lib/groundCover.mjs';

const rect = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });
const inside = (r, x, z, margin = 0) =>
  x >= r.minX - margin &&
  x <= r.maxX + margin &&
  z >= r.minZ - margin &&
  z <= r.maxZ + margin;

export default function generate() {
  const arena = createArena({
    id: 'arenaOverpass',
    name: 'Węzeł Estakada',
    weather: 'smog',
    seed: 'overpass-adr0011-v1',
    bounds: rect(-180, 180, -180, 180),
  });
  const p = createPrimitives(arena);
  const points = [
    ['A', vec(0, 0, 40)],
    ['B', vec(-70, 11.6, -3)],
    ['C', vec(95, 0, -100)],
    ['D', vec(-120, -4, 60)],
    ['E', vec(27, 23.2, -110)],
  ];
  arena.roomMeta({
    playerSpawn: vec(-170, 0, 170),
    maxAlive: 12,
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: vec(-170, 0, 176),
        size: vec(4, 3, 1),
      },
      {
        id: 'exit',
        role: 'exit',
        position: vec(172, 0, 88),
        size: vec(4, 3, 1),
      },
    ],
  });
  arena.arenaMeta({
    maxAlive: 12,
    enemyTickets: 200,
    spawnRing: { minM: 25, maxM: 100 },
    batchCellM: 180,
    navigationCellM: 2,
    navigationMaxRiseM: 0.52,
  });
  for (const [id, position] of points) arena.point(id, position, 5);
  arena.zone('Obozowisko i ulice serwisowe', rect(-100, 90, 10, 155), 'dense');
  arena.zone('Stacja paliw i sklep', rect(60, 130, -130, -70), 'interior');
  arena.zone('Plac bramek', rect(120, 175, -28, 35), 'open');
  arena.zone('Kanał burzowy', rect(-138, -104, -150, 150), 'low');
  arena.zone('Jezdnie i urwany wiadukt', rect(-175, 175, -160, 168), 'high');
  arena.zone('Wentylatornia i portal', rect(-90, -20, 70, 118), 'low');

  const exclusions = [
    rect(-180, -140, -180, -20),
    rect(100, 180, 100, 180),
    rect(-130, -110, -150, 150),
    rect(-136, -130, 86, 94),
    rect(-136, -130, -94, -86),
    rect(-66, -30, 100, 108),
    rect(-66, -54, 94, 100),
    rect(60, 130, -130, -70),
    rect(120, 175, -28, 35),
  ];
  // Podział po krawędziach otworów zamiast nakładania gruntu na kanał i wnętrza.
  const xs = [
    ...new Set([-180, 180, ...exclusions.flatMap((r) => [r.minX, r.maxX])]),
  ].sort((a, b) => a - b);
  const zs = [
    ...new Set([-180, 180, ...exclusions.flatMap((r) => [r.minZ, r.maxZ])]),
  ].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < zs.length; j++) {
      const x = (xs[i - 1] + xs[i]) / 2,
        z = (zs[j - 1] + zs[j]) / 2;
      if (!exclusions.some((r) => inside(r, x, z)))
        p.floor(rect(xs[i - 1], xs[i], zs[j - 1], zs[j]), 0, 'overpass_street');
    }
  const box = (
    x,
    y,
    z,
    sx,
    sy,
    sz,
    material = 'overpass_concrete',
    opts = {},
  ) =>
    arena.block({
      position: vec(x, y, z),
      size: vec(sx, sy, sz),
      material,
      ...opts,
    });
  const prop = (model, x, y, z, sx, sy, sz, yaw = 0) =>
    box(x, y + sy / 2, z, sx, sy, sz, 'metal', {
      model,
      instance: true,
      rotation: vec(0, yaw, 0),
    });
  const road = (r, y, material = 'highway_asphalt_worn', thickness = 0.4) =>
    p.floor(r, y, material, { thickness });
  const streetLamp = (x, z) => {
    arena.decor('city_street_lamp', vec(x, 0, z));
    arena.light(vec(x, 4.16, z + 0.34), '#fff1d6', 72, 17);
  };
  const ramp = (
    x1,
    y1,
    x2,
    y2,
    z,
    width = 10,
    material = 'highway_asphalt_worn',
  ) => {
    const result = p.ramp({
      from: vec(x1, y1, z),
      to: vec(x2, y2, z),
      width,
      material,
    });
    const lowX = y1 < y2 ? x1 : x2,
      lowY = Math.min(y1, y2);
    const uphill = Math.sign(y1 < y2 ? x2 - x1 : x1 - x2);
    if (lowY < 0) return result;
    for (const side of [-1, 1])
      box(
        lowX - uphill * 3,
        lowY + 0.6,
        z + side * (width / 2 + 0.2),
        6,
        1.2,
        0.4,
        'overpass_concrete',
      );
    return result;
  };
  const rail = (x1, z1, x2, z2, y) =>
    p.wall(vec(x1, y, z1), vec(x2, y, z2), 1.1, 0.45, 'overpass_concrete');

  // Kanał: koryto, trzy zjazdy od wschodu, dwa od zachodu, dwa mosty.
  road(rect(-130, -110, -150, 150), -4, 'overpass_concrete');
  for (const x of [-130, -110])
    p.wall(vec(x, -4, -150), vec(x, -4, 150), 4, 0.5, 'overpass_concrete', {
      openings: (x === -110 ? [-110, 0, 80, 110] : [-90, -60, 90, 140]).map(
        (z) => ({ at: z + 150, width: 10, height: 4 }),
      ),
    });
  for (const z of [-150, 150])
    p.wall(vec(-130, -4, z), vec(-110, -4, z), 4, 0.5);
  for (const z of [-110, 0, 110]) ramp(-110, 0, -126, -4, z, 8);
  for (const z of [-60, 140]) ramp(-130, 0, -114, -4, z, 8);
  for (const z of [-30, 30])
    p.bridge({ from: vec(-136, 0, z), to: vec(-104, 0, z), width: 10, y: 0 });
  // Schody serwisowe: dodatkowe dojście piesze, niezależne od zjazdów.
  for (const block of p.stairs({
    from: vec(-126, -4, 80),
    to: vec(-110, 0, 80),
    width: 4,
    stepRise: 0.25,
    stepDepth: 1,
    material: 'overpass_concrete',
  }).blocks)
    block.walkable = false;
  for (const z of [-90, 90]) {
    arena.decor('hw_storm_culvert', vec(-130, -4.2, z), Math.PI / 2);
    road(rect(-136, -128, z - 3, z + 3), -4, 'overpass_concrete');
    p.wall(vec(-136, -4, z - 3), vec(-130, -4, z - 3), 4.2, 0.4);
    p.wall(vec(-136, -4, z + 3), vec(-130, -4, z + 3), 4.2, 0.4);
    p.wall(vec(-136, -4, z - 3), vec(-136, -4, z + 3), 4.2, 0.4);
    road(rect(-136, -130, z - 3, z + 3), 0.2, 'overpass_concrete');
    arena.light(vec(-133, -0.4, z + 1), '#6dff4a', 9, 6, {
      groundGlow: false,
    });
  }

  // Poziom 1: segmenty obrócone wzdłuż X; collidery zachowują rzeczywistą płytę.
  road(rect(-180, 180, -10, 4), 11.6, 'highway_asphalt_worn', 1.6);
  const junctions1 = [-164, -70, -8, 164];
  for (let x = -174; x < 180; x += 12) {
    if (!junctions1.some((j) => Math.abs(j - x) < 12))
      arena.decor('city_overpass_deck', vec(x, 10, -3), Math.PI / 2);
    else {
      // Bez bariery poprzecznej na wjeździe z rampy.
      for (const z of [-9.6, 3.6])
        if (!junctions1.some((j) => Math.abs(j - x) < 8))
          rail(x - 6, z, x + 6, z, 11.6);
    }
    if (Math.abs(x + 120) > 8)
      prop('city_overpass_pillar', x, 0, -3, 2.5, 10, 2.513);
  }
  // Bariery mają własną kolizję; przerwy wyłącznie przy łącznikach.
  for (let x = -178; x < 180; x += 4)
    for (const z of [-9.6, 3.6])
      if (!junctions1.some((j) => Math.abs(j - x) < 8))
        rail(x - 2, z, x + 2, z, 11.6);

  // Pętle SW i NE: dwa łagodne biegi X i łącznik Z na spoczniku.
  for (const [x0, x1, z0, z1] of [
    [-164, -80, 134, 62],
    [164, 72, -156, -60],
  ]) {
    ramp(x0, 0, x1, 5.8, z0, 12);
    const east = x1 > x0;
    road(
      rect(
        east ? x1 : x1 - 14,
        east ? x1 + 14 : x1,
        Math.min(z0, z1) - 6,
        Math.max(z0, z1) + 6,
      ),
      5.8,
    );
    ramp(x1, 5.8, x0, 11.6, z1, 12);
    road(
      rect(
        east ? x0 - 14 : x0,
        east ? x0 : x0 + 14,
        Math.min(z1, -3) - 7,
        Math.max(z1, -3) + 7,
      ),
      11.6,
    );
    for (const x of east ? [x0 - 13.5] : [x0 + 13.5])
      rail(x, Math.min(z1, -3) + 8, x, Math.max(z1, -3) - 8, 11.6);
    for (const x of east ? [x1 + 13.5] : [x1 - 13.5])
      rail(x, Math.min(z0, z1) + 8, x, Math.max(z0, z1) - 8, 5.8);
    // Podpory pod spocznikami, nigdy w pustym polu.
    for (const z of [z0, z1]) box(x1 + (east ? 7 : -7), 2.7, z, 4, 5.4, 5);
    box(x0 + (east ? -7 : 7), 5.6, z1, 4, 11.2, 5);
  }
  // Krótsze schodzenie pod centrum i obsługa dwóch ramp poziomu 2.
  ramp(-80, 0, -8, 11.6, -48, 10);
  road(rect(-8, 4, -54, 4), 11.6);
  road(rect(-76, -64, -72, 36), 11.6);
  for (const z of [-64, 28]) {
    ramp(-64, 11.6, 8, 23.2, z, 10);
    road(rect(8, 34, z - 5, z + 5), 23.2);
    box(-70, 5.6, z, 4, 11.2, 4);
  }

  // Poziom 2: północny urwany koniec skierowany na północ, jezdnia 20…34.
  road(rect(20, 34, -148, 170), 23.2, 'highway_asphalt_worn', 1.6);
  for (let z = -136; z < 170; z += 12) {
    if ([-96, -64, 28].some((j) => Math.abs(j - z) < 10)) continue;
    arena.decor('city_overpass_deck', vec(27, 21.6, z));
  }
  arena.decor('hw_broken_deck_end', vec(27, 21.6, -152), Math.PI);
  road(rect(20, 34, -156, -148), 23.2, 'highway_asphalt_worn', 1.6);
  // Złamany odcinek jest landmarkiem, koniec zabezpiecza niski mur przy pęknięciu.
  rail(20, -156, 34, -156, 23.2);
  for (const x of [20.4, 33.6])
    for (let z = -152; z < 170; z += 4)
      if (!(x < 27 && [-96, -64, 28].some((j) => Math.abs(j - z) < 7)))
        rail(x, z, x, z + 4, 23.2);
  rail(20, 170, 34, 170, 23.2);
  for (let z = -140; z <= 160; z += 36) {
    const base = Math.abs(z + 3) < 10 ? 11.6 : 0;
    box(27, (base + 21.6) / 2, z, 4, 21.6 - base, 4);
  }

  // Rusztowanie: cztery szerokie biegi z półpiętrami i osobną kładką do E.
  for (const [i, z] of [-158, -142, -126, -110].entries()) {
    const from = i % 2 === 0 ? -60 : -4,
      to = i % 2 === 0 ? -4 : -60;
    ramp(from, i * 5.8, to, (i + 1) * 5.8, z, 6, 'scaffold_planks');
    const nextZ = i < 3 ? z + 16 : -96;
    road(
      rect(
        i % 2 === 0 ? to : to - 8,
        i % 2 === 0 ? to + 8 : to,
        z - 3,
        nextZ + 3,
      ),
      (i + 1) * 5.8,
      'scaffold_planks',
    );
    for (let deckZ = z + 2; deckZ < nextZ - 2; deckZ += 2.5)
      arena.decor(
        'build_scaffold_bay',
        vec(to + (i % 2 === 0 ? 4 : -4), (i + 1) * 5.8 - 2, deckZ),
        Math.PI / 2,
      );
    box(
      to + (i % 2 === 0 ? 4 : -4),
      ((i + 1) * 5.8 - 0.4) / 2,
      z,
      3.5,
      (i + 1) * 5.8 - 0.4,
      3.5,
      'metal',
    );
  }
  road(rect(-64, 34, -100, -92), 23.2, 'scaffold_planks');
  rail(-64, -100, 19, -100, 23.2);
  rail(-64, -92, 19, -92, 23.2);

  // Stacja: otwarty plac, sześć niezależnych słupów pod wiatą i sklep przechodni.
  for (const r of [
    rect(60, 130, -130, -128),
    rect(60, 95, -128, -116),
    rect(126, 130, -128, -116),
    rect(60, 130, -116, -70),
  ])
    road(r, 0, 'overpass_forecourt');
  arena.decor('hw_gas_canopy', vec(110, 0, -100));
  box(110, 6, -100, 24, 1, 12, 'gas_station_tiles');
  for (const x of [101, 110, 119])
    for (const z of [-103, -97]) box(x, 2.75, z, 0.9, 5.5, 0.9);
  for (const x of [85, 115])
    for (const z of [-108, -92]) prop('hw_gas_pump', x, 0, z, 1.2, 2, 0.604);
  p.building({
    rect: rect(95, 126, -128, -116),
    height: 5,
    interior: true,
    wallMaterial: 'smog_soot_wall',
    roofMaterial: 'roof_tar',
    doors: [
      { side: 'south', at: 8, width: 5 },
      { side: 'east', at: 6, width: 4 },
    ],
  });
  prop('city_vending', 120, 0, -123, 1.014, 2, 0.816);
  prop('city_crates', 99, 0, -123, 1.212, 1.59, 1.256);

  // Wschodni plac poboru opłat, wysepki i osłony z otwartymi pasami ruchu.
  road(rect(120, 175, -28, 35), 0, 'overpass_street');
  for (const x of [126, 137, 148, 159, 170]) {
    arena.decor('hw_toll_booth', vec(x, 0, 14));
    box(x, 1.3, 14, 2.2, 2.6, 3.4, 'smog_soot_wall');
    box(x, 0.1, 14, 2.8, 0.2, 9, 'hazard_stripes_worn');
    box(x + 3.3, 1, 16.65, 3.64, 0.1, 0.15, 'hazard_stripes_worn');
    arena.light(vec(x, 2.9, 15.8), '#ffae1a', 48, 13, { groundGlow: false });
  }

  // Landmark wentylatorni oraz krótki tunel na poziomie −4 m.
  prop('hw_vent_tower', -60, 0, 90, 8, 25, 8);
  arena.decor('hw_storm_culvert', vec(-60, -4.2, 100));
  road(rect(-66, -50, 100, 108), -4, 'overpass_concrete');
  road(rect(-63, -57, 94, 100), -4, 'overpass_concrete');
  ramp(-30, 0, -50, -4, 104, 8);
  p.wall(vec(-66, -4, 108), vec(-50, -4, 108), 4, 0.5);
  p.wall(vec(-66, -4, 100), vec(-66, -4, 108), 4, 0.5);
  p.wall(vec(-63, -4, 94), vec(-57, -4, 94), 4, 0.5);
  road(rect(-63, -57, 94, 100), 0.2, 'overpass_concrete');
  arena.light(vec(-60, -0.5, 97), '#6dff4a', 12, 8, { groundGlow: false });

  // Gęste obozowisko: alejki zostawiają wolne koło A i przejście północ–południe.
  for (const x of [-60, -36, -12, 12, 36, 60]) {
    prop('hw_camp_tent_dome', x, 0, -3, 3.28, 1.281, 2.87);
    prop('hw_fire_barrel', x + 5, 0, -1, 0.622, 1.42, 0.614);
  }
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 7; col++) {
      const x = -52 + col * 17,
        z = 14 + row * 16;
      if (Math.hypot(x, z - 40) < 12 || Math.abs(x - 27) < 12) continue;
      const model = [
        'hw_camp_tent_dome',
        'hw_camp_tent_ridge',
        'hw_camp_shack',
      ][(row + col) % 3];
      const dims =
        model === 'hw_camp_tent_dome'
          ? [3.28, 1.281, 2.87]
          : model === 'hw_camp_shack'
            ? [3.1, 2.4, 2.617]
            : [2.202, 1.739, 3.95];
      prop(model, x, 0, z, ...dims, (row % 2) * Math.PI);
      prop('hw_fire_barrel', x + 4, 0, z + 3, 0.622, 1.42, 0.614);
      if (col % 2 === 0)
        prop(
          'city_wrecked_car',
          x + 7,
          0,
          z - 4,
          2.15,
          1.58,
          3.95,
          Math.PI / 2,
        );
    }

  // Tkanka między strefami: krótkie kwartały z bramami, małe wnętrza i pobocza.
  const reserved = [
    rect(-180, -140, -180, -20),
    rect(100, 180, 100, 180),
    rect(-140, -102, -160, 155),
    rect(-174, -152, -12, 145),
    rect(-90, -70, 54, 142),
    rect(-174, -70, 54, 72),
    rect(-174, -70, 126, 142),
    rect(62, 174, -164, -148),
    rect(62, 82, -164, -52),
    rect(62, 174, -68, -52),
    rect(154, 174, -68, 8),
    rect(-84, 0, -56, -40),
    rect(-76, 42, -168, -88),
    rect(60, 134, -134, -66),
    rect(-90, 78, 8, 84),
    rect(-92, -18, 76, 114),
    rect(116, 178, -32, 38),
  ];
  const spawns = [
    [-156, 30],
    [-152, 102],
    [-128, 164],
    [-96, 168],
    [-56, 154],
    [-16, 134],
    [34, 154],
    [78, 132],
    [88, 90],
    [144, 70],
    [170, 48],
    [150, -42],
    [170, -106],
    [142, -144],
    [112, -166],
    [46, -168],
    [6, -178],
    [-90, -172],
    [-104, -126],
    [-96, -76],
    [-100, -22],
    [-46, 96],
    [-16, 6],
    [62, 56],
  ].map(([x, z]) => vec(x, 0, z));
  const raisedSpawns = [
    vec(-120, -4, -132),
    vec(-120, -4, 18),
    vec(-120, -4, 126),
    vec(-148, 11.6, -3),
    vec(-42, 11.6, -3),
    vec(100, 11.6, -3),
    vec(27, 23.2, -132),
    vec(27, 23.2, -32),
    vec(27, 23.2, 92),
  ];
  const avoid = (x, z, margin = 8) =>
    points.some(([, q]) => Math.hypot(q.x - x, q.z - z) < margin + 5) ||
    spawns.some((q) => Math.hypot(q.x - x, q.z - z) < margin) ||
    Math.hypot(x + 170, z - 170) < 22;
  const fillers = [
    ['city_wrecked_car', 2.15, 1.58, 3.95],
    ['city_generator', 1.6, 1.4, 1.005],
    ['city_kiosk', 0.8, 2.235, 0.624],
    ['city_barrier', 2, 0.929, 0.51],
    ['city_dumpster', 1.97, 1.33, 1.08],
    ['city_crates', 1.212, 1.59, 1.256],
    ['city_smog_scrubber', 3, 4, 3],
    ['city_market_stall_canopy', 3.024, 2.612, 2],
    ['city_market_stall_canopy_violet', 3.024, 2.612, 2],
  ];
  let cell = 0;
  for (let x = -164; x < 174; x += 26)
    for (let z = -166; z < 174; z += 26) {
      if (reserved.some((r) => inside(r, x, z, 5)) || avoid(x, z)) continue;
      const index = cell++;
      if (index % 4 === 0) {
        p.building({
          rect: rect(x - 6, x + 6, z - 5, z + 5),
          height: 5 + (index % 3) * 2,
          interior: index % 8 === 0,
          wallMaterial: index % 8 === 0 ? 'corrugated' : 'smog_soot_wall',
          roofMaterial: 'roof_tar',
          doors: [
            { side: 'north', at: 6, width: 4 },
            { side: 'south', at: 6, width: 4 },
          ],
        });
        arena.decor('city_roof_hvac_unit', vec(x, 5 + (index % 3) * 2, z));
      } else {
        const [model, sx, sy, sz] = fillers[index % fillers.length];
        prop(model, x, 0, z, sx, sy, sz, ((index % 2) * Math.PI) / 2);
        p.wall(
          vec(x - 7, 0, z - 7),
          vec(x + 7, 0, z - 7),
          1.25,
          0.45,
          'smog_soot_wall',
          { openings: [{ at: 7, width: 4, height: 1.25 }] },
        );
      }
      for (const [dx, dz, k] of [
        [8, 4, 1],
        [-6, 8, 3],
        [4, -9, 5],
      ]) {
        if (avoid(x + dx, z + dz, 4)) continue;
        const [model, sx, sy, sz] = fillers[(index + k) % fillers.length];
        prop(model, x + dx, 0, z + dz, sx, sy, sz);
      }
    }
  const tollPlaza = rect(120, 175, -28, 35);
  const groundBlocks = arena.toRoom().blocks;
  const overlaps = (a, b) =>
    a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
  const clearLot = (x, z, width, depth, height) => {
    const lot = rect(
      x - width / 2,
      x + width / 2,
      z - depth / 2,
      z + depth / 2,
    );
    if (
      avoid(x, z, Math.hypot(width, depth) / 2 + 3) ||
      overlaps(lot, tollPlaza) ||
      exclusions.slice(0, 7).some((r) => overlaps(r, lot))
    )
      return false;
    if (
      !inside(rect(-177, 177, -177, 177), lot.minX, lot.minZ) ||
      !inside(rect(-177, 177, -177, 177), lot.maxX, lot.maxZ)
    )
      return false;
    if (
      groundBlocks.some((block) => {
        if (!overlaps(footprint(block), lot)) return false;
        if (!block.rotation?.z)
          return (
            block.position.y + block.size.y / 2 > 0.08 &&
            block.position.y - block.size.y / 2 < height + 0.25
          );
        const r = footprint(block);
        return [
          Math.max(r.minX, lot.minX) + 0.001,
          Math.min(r.maxX, lot.maxX) - 0.001,
        ].some((px) =>
          [
            Math.max(r.minZ, lot.minZ) + 0.001,
            Math.min(r.maxZ, lot.maxZ) - 0.001,
          ].some((pz) => {
            const span = verticalRange(block, px, pz);
            return span && span.max >= -0.25 && span.min < height + 2;
          }),
        );
      })
    )
      return false;
    return true;
  };
  const addStreetProp = (spec, x, z) => {
    const [model, w, h, d] = spec;
    if (!clearLot(x, z, w + 2, d + 2, h)) return false;
    groundBlocks.push(prop(model, x, 0, z, w, h, d));
    return true;
  };
  const parked = ['city_car', 4.42, 1.46, 1.94];
  const container = ['port_container_20_graphite', 6.058, 2.591, 2.438];
  const stall = ['city_stall', 3, 2.622, 2.043];
  const shack = ['hw_camp_shack', 3.1, 2.4, 2.617];
  const signs = [];
  const shops = [
    ['repair', 'corrugated', ['city_generator', 1.6, 1.4, 1.005]],
    ['bar_24h', 'smog_soot_wall', stall],
    ['open', 'overpass_concrete', fillers[5]],
  ];
  for (const [row, z, xs] of [
    [0, 120, [-105, -68, -36, 0, 44, 76]],
    [1, 148, [-144, -108, -74, -36, 4, 44, 82]],
    [2, 48, [94, 114, 146, 166]],
    [3, 82, [90, 112, 132, 154, 172]],
    [4, -82, [135, 151, 169]],
    [5, -132, [46, 77, 137, 158, 170]],
    [6, -164, [-126, -98, -77, 14, 36, 94, 145, 168]],
    [7, 91, [-168, -148, -94, -35, -14, 16, 47, 73]],
  ]) {
    for (const [index, x] of xs.entries()) {
      if (!clearLot(x, z, 15, 11, 5)) continue;
      const [texture, material, furnishing] =
        shops[(row + index) % shops.length];
      const lot = rect(x - 6, x + 6, z - 4, z + 4);
      const shop = p.building({
        rect: lot,
        height: 4.6,
        interior: true,
        wallMaterial: material,
        roofMaterial: 'roof_tar',
        doors: [
          { side: 'north', at: 6, width: 4 },
          { side: 'south', at: 6, width: 4 },
        ],
      });
      groundBlocks.push(...shop.blocks);
      const [model, w, h, d] = furnishing;
      groundBlocks.push(prop(model, x + 3.6, 0, z, w, h, d));
      signs.push({
        kind: 'neon',
        texture,
        position: vec(x, 3.5, z + 4.21),
        size: { w: 3.2, h: 0.9 },
        yaw: 0,
      });
      signs.at(-1).tint = ['#ffae1a', '#b999ff', '#77a6ff'][(row + index) % 3];
      for (const offset of [-4, 4]) {
        box(x + offset, 2.55, z + 4.2, 1.65, 0.85, 0.045, 'light_white');
      }
      arena.light(vec(x - 3.5, 2.75, z + 4.8), '#fff1d6', 39, 10, {
        groundGlow: false,
      });
      arena.light(vec(x, 3.55, z + 0.5), '#fff1d6', 32, 9, {
        groundGlow: false,
      });
      if (index % 2 === 0) streetLamp(x - 5, z + 6);
      addStreetProp(parked, x + 5, z + 8);
      addStreetProp(fillers[4], x - 5, z - 7);
    }
  }
  for (const [texture, x, y, z, tint] of [
    ['open', 110, 6, -93.98, '#fff1d6'],
    ['arrow', 148, 2.55, 15.72, '#ffae1a'],
    ['metro', -58, 3.8, 94.1, '#6dff4a'],
  ])
    signs.push({
      kind: 'neon',
      texture,
      position: vec(x, y, z),
      size: { w: 3.2, h: 0.95 },
      yaw: 0,
      tint,
    });
  arena.roomMeta({ signs });
  for (const z of [-6, -1, 16, 42, 66, 88, 112, 136, 160]) {
    const xs =
      z < 0
        ? [-170, -149, -104, -81, -56, -32, -8, 16, 42, 66, 90, 114, 138, 162]
        : [-153, -97, -72, -43, -21, 6, 24, 54, 82, 106, 132, 156];
    for (const [i, x] of xs.entries()) {
      const camp = z >= -6 && z <= 88 && x >= -78 && x <= 60;
      const choices = camp
        ? [stall, shack, parked, fillers[0]]
        : [parked, container, fillers[2], fillers[4], stall];
      if (
        addStreetProp(choices[i % choices.length], x, z) &&
        camp &&
        i % 2 === 0
      )
        arena.decor('city_cable_span', vec(x, 3.2, z + 2));
    }
  }
  for (const [x, z] of [
    [-155, 114],
    [-52, 124],
    [48, 114],
    [104, 61],
    [154, 54],
    [154, -103],
    [142, -157],
  ]) {
    if (!clearLot(x, z, 15, 2, 2)) continue;
    groundBlocks.push(
      ...p.wall(vec(x - 7, 0, z), vec(x + 7, 0, z), 1.8, 0.35, 'metal', {
        openings: [{ at: 7, width: 4, height: 1.8 }],
      }).blocks,
    );
  }
  // Dogęść pozostałe luki bez zastawiania skrzyżowań.
  for (let i = 0; i < 24; i++) {
    const gap = largestGroundGap(groundBlocks, arena.metadata.bounds, [
      tollPlaza,
    ]);
    if (gap.sideM <= 40) break;
    const x = gap.minX + gap.sideM / 2,
      z = gap.minZ + gap.sideM / 2;
    if (
      ![
        [0, 0],
        [-6, 0],
        [6, 0],
        [0, -6],
        [0, 6],
        [-9, -9],
        [9, 9],
        [-9, 9],
        [9, -9],
      ].some(([dx, dz]) =>
        addStreetProp(
          [container, stall, parked, fillers[0]][i % 4],
          x + dx,
          z + dz,
        ),
      )
    )
      throw new Error(
        `Brak miejsca na osłonę w pustym polu ${JSON.stringify(gap)}`,
      );
  }
  const remainingGap = largestGroundGap(groundBlocks, arena.metadata.bounds, [
    tollPlaza,
  ]);
  if (remainingGap.sideM > 40)
    throw new Error(
      `Puste pole przekracza 40 m: ${JSON.stringify(remainingGap)}`,
    );
  // Osłony w długich korytarzach: rozstaw 24–30 m, bez zwężania środka punktów.
  for (let z = -138; z < 150; z += 24) {
    if (Math.abs(z - 60) > 14)
      prop('city_barrier', -125, -4, z, 2, 0.929, 0.51, Math.PI / 2);
    if (Math.hypot(5, z + 8 - 60) > 8)
      prop('city_generator', -115, -4, z + 8, 1.6, 1.4, 1.005);
  }
  for (let x = -148; x < 170; x += 28) {
    if (Math.abs(x + 70) > 15)
      prop('city_wrecked_car', x, 11.6, -6.3, 2.15, 1.58, 3.95, Math.PI / 2);
    if (Math.abs(x - 27) > 12)
      prop('city_smog_scrubber', x + 9, 11.6, 1, 3, 4, 3);
  }
  for (const x of [-154, -112, -28, 48, 104, 146])
    for (const z of [-9.6, 3.6])
      prop('city_highway_barrier', x, 11.6, z, 4, 1.093, 0.808);
  for (let z = -130; z < 166; z += 28) {
    if (Math.abs(z + 110) < 18) continue;
    prop('city_wrecked_car', 30, 23.2, z, 2.15, 1.58, 3.95);
  }
  const decals = [];
  for (const x of [45, 135])
    for (let z = -164; z < 90; z += 26) {
      if (
        inside(rect(60, 134, -134, -66), x, z, 8) ||
        inside(rect(116, 178, -32, 38), x, z, 8) ||
        avoid(x, z, 7)
      )
        continue;
      for (const dx of [-6, 6])
        p.wall(
          vec(x + dx, 0, z - 6),
          vec(x + dx, 0, z + 6),
          0.18,
          0.3,
          'paving',
        );
      decals.push({
        texture: 'floor_arrow',
        position: vec(x, 0.015, z),
        size: { w: 2, h: 4 },
        yaw: 0,
        surface: 'floor',
        opacity: 0.55,
      });
    }
  for (const x of [132, 148, 164])
    decals.push({
      texture: 'floor_stop',
      position: vec(x, 0.015, -4),
      size: { w: 4, h: 2 },
      yaw: 0,
      surface: 'floor',
      opacity: 0.6,
    });
  arena.roomMeta({ decals });
  // Bramownice: nogi pod poprzeczką, kolizja nie zamyka przejazdu.
  for (const x of [-140, 60, 136]) {
    arena.decor('city_highway_sign_gantry', vec(x, 11.6, -3), Math.PI / 2);
    for (const z of [-9.5, 3.5])
      box(x, 14.6, z, 0.6, 6, 0.6, 'metal', { visible: false });
    box(x, 18, -3, 1.4, 1.2, 14, 'metal', { visible: false });
  }
  // Lampy i zielone punkty odniesienia korzystają z istniejącej puli najbliższych świateł.
  for (const [x, z] of [
    [-152, 22],
    [-142, 158],
    [-92, 122],
    [-10, 100],
    [66, 126],
    [142, 70],
    [160, -100],
    [120, -150],
    [44, -162],
    [-102, -164],
    [-96, -74],
    [48, 70],
  ]) {
    streetLamp(x, z);
  }
  for (const [x, z] of [
    [-164, 66],
    [-148, 133],
    [-105, 152],
    [-65, 143],
    [-32, 115],
    [18, 125],
    [53, 155],
    [81, 114],
    [111, 72],
    [152, 48],
    [168, 86],
    [145, -73],
    [151, -120],
    [168, -151],
    [90, -156],
    [44, -94],
    [-93, -119],
    [-68, 104],
    [-32, 82],
    [51, 55],
  ])
    streetLamp(x, z);
  for (const x of [
    -159, -135, -104, -80, -56, -32, -8, 16, 40, 64, 88, 112, 136, 160,
  ]) {
    box(x, 9.97, -5, 2.5, 0.1, 0.3, 'light_white');
    arena.light(vec(x, 8.8, -5), '#fff1d6', 95, 17, { groundGlow: false });
  }
  for (const [x, z] of [
    [101, -103],
    [110, -97],
    [119, -103],
    [94, -91],
    [123, -116],
  ])
    arena.light(vec(x, 4.8, z), '#fff1d6', 72, 16, { groundGlow: false });
  for (const [index, block] of arena
    .toRoom()
    .blocks.filter((b) => b.model === 'hw_fire_barrel')
    .entries()) {
    if (index % 2 !== 0) continue;
    const { x, z } = block.position;
    arena.light(vec(x, 1.28, z), '#ffae1a', 18, 6, {
      groundGlow: false,
      flicker: { pattern: 'pulse', strength: 0.22, periodS: 0.84 },
    });
  }
  for (const z of [-122, -74, -26, 26, 58, 82, 122]) {
    box(-129.7, -0.55, z, 0.18, 0.32, 1.3, 'light_white');
    arena.light(vec(-128.7, -0.75, z), '#fff1d6', 26, 13, {
      groundGlow: false,
    });
  }
  for (const z of [-114, 112])
    arena.light(vec(-109, 1.6, z), '#6dff4a', 8, 6, { groundGlow: false });
  for (const [x, y, z] of [
    [0, 3, 40],
    [100, 4, -100],
    [-70, 15, -3],
    [27, 27, -110],
    [-60, 12, 90],
    [-164, 15, 62],
    [164, 15, -60],
    [-80, 9, 134],
    [72, 9, -156],
  ])
    arena.light(vec(x, y, z), x === -60 ? '#6dff4a' : '#fff1d6', 55, 34);

  // Naturalny obrys: ekrany, ściany kwartałów i nasypy we wcięciach.
  const polygon = [
    [-140, -180],
    [180, -180],
    [180, 100],
    [100, 100],
    [100, 180],
    [-180, 180],
    [-180, -20],
    [-140, -20],
  ];
  for (let i = 0; i < polygon.length; i++) {
    const [x, z] = polygon[i],
      [nx, nz] = polygon[(i + 1) % polygon.length];
    p.wall(
      vec(x, 0, z),
      vec(nx, 0, nz),
      8,
      2,
      i % 2 ? 'smog_soot_wall' : 'overpass_concrete',
    );
  }
  p.safetyBoundary(
    polygon.map(([x, z]) => vec(x, 0, z)),
    40,
  );
  for (const [x, z, s] of [
    [-163, -120, 1.6],
    [-160, -45, 1.4],
    [142, 142, 2.4],
  ])
    arena.decor('power_slag_heap', vec(x, -1, z), 0, { scale: s });
  // Oprawa wyłącznie bez kolizji, przed pierwszym pierścieniem horyzontu.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2,
      r = 285 + (i % 3) * 16;
    arena.decor(
      ['build_site_office', 'rail_control_tower', 'build_site_office'][i % 3],
      vec(Math.cos(a) * r, 0, Math.sin(a) * r),
      a,
      { scale: 2 + (i % 4) },
    );
  }
  for (const q of spawns) arena.spawn(q);
  arena.arenaMeta({ spawnPoints: [...spawns, ...raisedSpawns] });
  return arena;
}
