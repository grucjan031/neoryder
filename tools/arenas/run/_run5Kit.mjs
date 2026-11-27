import {
  R,
  vec,
  box,
  deck,
  ceilingSlab,
  segmentedWall,
  dims,
  Q,
  COLOR,
  spans,
} from './_run3Kit.mjs';
export const rooms = [
  ['Rejestracja', 'rejestracja', R(-10, 10, 20, 34), 4.8, 'warm'],
  ['Apteka i chłodnia', 'apteka', R(-28, -10, 20, 34), 4.8, 'green'],
  ['Gabinety zabiegowe', 'zabiegowe', R(10, 28, 6, 34), 4.8, 'warm'],
  ['Diagnostyka obrazowa', 'diagnostyka', R(-28, -10, 6, 20), 4.8, 'blue'],
  ['Blok operacyjny', 'blok_operacyjny', R(-10, 10, -8, 20), 6.4, 'warm'],
  ['Zakład Kalibracji Akordu', 'kalibracja', R(-28, -10, -8, 6), 4.8, 'violet'],
  ['Oddział regeneracji', 'regeneracja', R(10, 28, -8, 6), 4.8, 'green'],
  ['Ogród Helixy', 'atrium', R(-28, 28, -38, -8), 10, 'blue'],
];
const panel = 'med_wall_panel';
const floor = 'med_resin_floor';
const stone = 'med_atrium_terrazzo';
export function detail(k, x, y, z, w, h, d, material, opts = {}) {
  return box(k, x, y, z, w, h, d, material, opts);
}
export function monitor(k, x, y, z, w, h, t, texture, stand = false) {
  const bx = x - Math.sin(t * Q) * 0.067,
    bz = z - Math.cos(t * Q) * 0.067;
  detail(
    k,
    bx,
    y,
    bz,
    t % 2 ? 0.12 : w + 0.1,
    h + 0.1,
    t % 2 ? w + 0.1 : 0.12,
    'rubber',
  );
  if (stand) detail(k, bx, y / 2, bz, 0.12, y, 0.12, 'trim');
  k.decal(texture, x, y, z, w, h, t * Q, 'wall', 1);
}
export function outline(k, x, z, w, d, material) {
  for (const s of [-1, 1]) {
    detail(k, x, 0.006, z + (s * d) / 2, w, 0.01, 0.04, material, {
      walkable: true,
    });
    detail(k, x + (s * w) / 2, 0.006, z, 0.04, 0.01, d, material, {
      walkable: true,
    });
  }
}
// Osie pól o module 4 m; niepełne pola rozkładamy symetrycznie na obrzeżach.
function centers(a, b) {
  const n = Math.floor((b - a) / 4);
  return Array.from(
    { length: n },
    (_, i) => (a + b) / 2 + (i - (n - 1) / 2) * 4,
  );
}
// Wymiary spodu i położenie wieszaków z bw_ceiling_panel (bulwar_clinic.py).
// Cztery małe pierścienie i toczone wieszaki pochłaniają większość trójkątów GLB.
function ceilingPanel(k, x, ceilingY, z) {
  const bottom = ceilingY - 0.3;
  const part = (dx, dy, dz, w, h, d, material) =>
    box(k, x + dx, bottom + dy, z + dz, w, h, d, material, {
      walkable: false,
    });
  part(0, 0.074, 0, 2.4, 0.12, 1.2, 'plaster');
  part(0, 0.017, 0, 2.29, 0.022, 1.09, 'trim');
  for (const dx of [-0.56, 0.56])
    part(dx, 0.0075, 0, 1.09, 0.015, 1.04, 'light_panel');
  for (const dx of [-0.92, 0.92])
    for (const dz of [-0.38, 0.38])
      part(dx, 0.217, dz, 0.056, 0.166, 0.056, 'metal');
}
export function interiors(k, p) {
  const glass = k.arena
    .toRoom()
    .blocks.filter((b) => b.material === 'glass_clear');
  for (const [i, [, , r, h]] of rooms.slice(0, 7).entries()) {
    const accent = [
      'amber',
      'green',
      'green',
      'blue',
      'green',
      'violet',
      'green',
    ][i];
    for (const [across, at, side, a, b] of [
      [true, r.minZ, 1, r.minX, r.maxX],
      [true, r.maxZ, -1, r.minX, r.maxX],
      [false, r.minX, 1, r.minZ, r.maxZ],
      [false, r.maxX, -1, r.minZ, r.maxZ],
    ]) {
      const cuts = portals
        .filter(([x, z, t]) =>
          across ? t === 0 && z === at : t === 1 && x === at,
        )
        .map(([x, z]) => (across ? x : z))
        .map((c) => [c - 2.34, c + 2.34]);
      const gaps = [...cuts];
      for (const d of [...k.decals, ...k.signs]) {
        if (
          d.surface === 'floor' ||
          Math.abs((across ? d.position.z : d.position.x) - at) > 0.5
        )
          continue;
        const c = across ? d.position.x : d.position.z;
        gaps.push([c - d.size.w / 2 - 0.1, c + d.size.w / 2 + 0.1]);
      }
      for (const f of p.taken) {
        const edge = across
          ? side > 0
            ? f.minZ
            : f.maxZ
          : side > 0
            ? f.minX
            : f.maxX;
        if (Math.abs(edge - at) < 0.5)
          gaps.push(across ? [f.minX, f.maxX] : [f.minZ, f.maxZ]);
      }
      const strip = (c, y, len, height, depth, mat, offset = 0) => {
        const face = at + side * (0.2 + offset + depth / 2);
        detail(
          k,
          across ? c : face,
          y,
          across ? face : c,
          across ? len : depth,
          height,
          across ? depth : len,
          mat,
        );
      };
      for (const [lo, hi] of spans(a + 0.27, b - 0.27, gaps)) {
        const c = (lo + hi) / 2;
        strip(c, 0.05, hi - lo, 0.1, 0.06, 'rubber');
        strip(c, 0.6, hi - lo, 1, 0.04, 'plaster');
        strip(c, 1.14, hi - lo, 0.08, 0.08, 'trim');
        for (const pc of centers(a, b).filter(
          (v) => v > lo + 0.125 && v < hi - 0.125,
        )) {
          strip(pc, (h + 1.18) / 2, 0.25, h - 1.18, 0.06, 'trim');
          strip(pc, 2.4, 0.03, 0.6, 0.016, 'neon_' + accent, 0.06);
        }
      }
      const middle = (a + b) / 2;
      const corniceLength = b - a - 0.54;
      strip(middle, h - 0.11, corniceLength, 0.2, 0.08, 'trim');
      strip(
        middle,
        h - 0.235,
        corniceLength,
        0.05,
        0.055,
        [3, 5, 6].includes(i) ? 'neon_' + accent : 'light_panel',
      );
    }
    const xs = centers(r.minX, r.maxX),
      zs = centers(r.minZ, r.maxZ);
    for (const x of xs.slice(1))
      detail(
        k,
        x - 2,
        h - 0.075,
        (r.minZ + r.maxZ) / 2,
        0.2,
        0.15,
        r.maxZ - r.minZ - 0.4,
        'trim',
        { ceiling: true },
      );
    for (const z of zs.slice(1))
      detail(
        k,
        (r.minX + r.maxX) / 2,
        h - 0.075,
        z - 2,
        r.maxX - r.minX - 0.4,
        0.15,
        0.2,
        'trim',
        { ceiling: true },
      );
    const candidates = [];
    for (const [ix, x] of xs.entries())
      for (const [iz, z] of zs.entries()) {
        if ((ix + iz) % 2) continue;
        ceilingPanel(k, x, h, z);
        if (
          glass.every(
            (b) =>
              Math.hypot(
                Math.max(0, Math.abs(x - b.position.x) - b.size.x / 2),
                Math.max(0, Math.abs(z - b.position.z) - b.size.z / 2),
              ) >= 1.6,
          )
        )
          candidates.push([x, z]);
      }
    // Rozstaw czynnych opraw tak, by każda następna oświetlała najdalsze wolne pole.
    const lit = [];
    const distance = ([x, z]) =>
      Math.min(...lit.map(([lx, lz]) => Math.hypot(x - lx, z - lz)));
    for (let n = 0; n < [4, 3, 4, 3, 6, 3, 3][i] && candidates.length; n++) {
      if (lit.length) candidates.sort((a, b) => distance(b) - distance(a));
      const spot = candidates.shift();
      lit.push(spot);
      k.light(
        spot[0],
        h - 0.8,
        spot[1],
        COLOR.warm,
        [27, 24, 29, 17, 47, 25, 25][i],
        16,
        { floorY: 0, groundGlow: false },
      );
    }
  }
}
// Cele widziane od strony dodatniej i ujemnej normalnej (Z lub X).
export const portals = [
  [0, 34, 0, 1, 1],
  [-10, 27, 1, 2, 1],
  [10, 27, 1, 1, 3],
  [0, 20, 0, 5, 1],
  [-19, 20, 0, 4, 2],
  [-10, 13, 1, 4, 5],
  [-19, 6, 0, 6, 4],
  [10, 13, 1, 5, 3],
  [19, 6, 0, 7, 3],
  [-10, -1, 1, 6, 5],
  [10, -1, 1, 5, 7],
  [-19, -8, 0, 8, 6],
  [0, -8, 0, 8, 5],
  [19, -8, 0, 8, 7],
];
function frame(k, model, x, z, turn, opening, head) {
  const { w, h, d } = dims(model);
  k.deco(model, x, 0, z, turn * Q);
  const part = (along, y, width, height) =>
    box(
      k,
      x + (turn ? 0 : along),
      y,
      z + (turn ? along : 0),
      turn ? d : width,
      height,
      turn ? width : d,
      'metal',
      { visible: false, walkable: false },
    );
  for (const side of [-1, 1])
    part((side * (w + opening)) / 4, head / 2, (w - opening) / 2, head);
  part(0, (h + head) / 2, w, h - head);
}
function direction(k, x, z, turn, side, id, y = 4.12) {
  const [, name, , , color] = rooms[id - 1] ?? [
    '',
    'winda',
    null,
    null,
    'warm',
  ];
  const yaw = turn * Q + (side < 0 ? Math.PI : 0);
  const dx = Math.sin(yaw),
    dz = Math.cos(yaw);
  // Pod południową galerią między nadprożem a płytą dostępne jest tylko 0,4 m.
  const underGallery = z === -8 && side < 0;
  const height = underGallery ? 0.36 : 0.8;
  const width = underGallery ? 0.72 : 1.6;
  const centerY = underGallery ? 3.9 : y;
  // SignRenderer dodaje własne halo 1,6×. Grafitowy nośnik obejmuje cały
  // jego rzut; pod galerią górną część nośnika zasłania krawędź płyty.
  const boardWidth = width * 1.6;
  detail(
    k,
    x + dx * 0.24,
    centerY,
    z + dz * 0.24,
    turn ? 0.1 : boardWidth,
    height * 1.6,
    turn ? boardWidth : 0.1,
    'rubber',
  );
  k.neon(
    'med_sign_' + name,
    x + dx * 0.296,
    centerY,
    z + dz * 0.296,
    width,
    height,
    yaw,
    { warm: '#c6bcab', green: '#80bc60', blue: '#6588cc', violet: '#a088ce' }[
      color
    ],
    0,
  );
}
export function shell(k) {
  for (const [, , r, h] of rooms) {
    deck(k, r, 0, h === 10 ? stone : floor, 1);
    ceilingSlab(k, r, h, panel);
    k.rainShelters.push({
      position: vec(
        (r.minX + r.maxX) / 2,
        (h - 0.2) / 2,
        (r.minZ + r.maxZ) / 2,
      ),
      size: vec(r.maxX - r.minX, h + 0.2, r.maxZ - r.minZ),
    });
  }
  function wall(axis, at, a, b, h) {
    const cuts = portals
      .filter(([x, z, t]) =>
        axis === 'x' ? t === 0 && z === at : t === 1 && x === at,
      )
      .map(([x, z]) => (axis === 'x' ? x : z))
      .filter((c) => c > a && c < b)
      .map((c) => [c - 2.3, c + 2.3, 0, 3.7]);
    segmentedWall(k, axis, at, a, b, 0, h, panel, cuts);
  }
  wall('x', 34, -28, 28, 4.8);
  for (const side of [-1, 1]) {
    wall('z', 28 * side, -10, -8, 10);
    wall('z', 28 * side, -8, 34, 4.8);
    wall('z', 10 * side, -8, 20, 6.4);
    wall('z', 10 * side, 20, 34, 4.8);
    wall('x', 6, side < 0 ? -28 : 10, side < 0 ? -10 : 28, 4.8);
  }
  wall('x', 20, -28, -10, 4.8);
  wall('x', 20, -10, 10, 6.4);
  wall('x', -8, -28, 28, 10);
  for (const [x, z, t, a, b] of portals) {
    frame(k, 'bw_door_portal', x, z, t, 4, 3.4);
    direction(k, x, z, t, 1, a);
    direction(k, x, z, t, -1, b);
  }
  frame(k, 'bw_entry_scanner', 0, 32, 0, 3, 3);
  for (const side of [-1, 1]) box(k, side * 3, 5, -36.5, 2, 10, 3, panel);
  frame(k, 'bw_freight_lift_frame', 0, -38, 0, 4, 3);
  box(k, 0, 7.1, -38, 4, 5.8, 0.4, panel);
  direction(k, 0, -38, 0, 1, 9, 4.7);
  direction(k, 0, -38, 0, -1, 8, 4.7);
  for (const [z, mat] of [
    [34.5, floor],
    [-38.5, stone],
  ]) {
    deck(k, R(-2, 2, z - 0.5, z + 0.5), 0, mat, 1);
    const s = Math.sign(z);
    box(k, 0, 1.8, z + s * 0.65, 4.5, 3.6, 0.3, panel);
    for (const side of [-1, 1])
      box(k, side * 2.13, 1.8, z, 0.26, 3.6, 1, panel);
    k.rainShelters.push({ position: vec(0, 1.75, z), size: vec(4, 3.9, 1) });
  }
}
function glass(k, axis, at, a, b) {
  for (const [lo, hi, m] of [
    [0, 0.5, panel],
    [0.5, 10, 'glass_clear'],
  ])
    segmentedWall(k, axis, at, a, b, lo, hi, m, [], 0.18);
  for (let c = a + 2; c < b; c += 4)
    for (const y of [0, 5])
      k.deco(
        'bw_curtain_wall_frame',
        axis === 'x' ? c : at,
        y,
        axis === 'x' ? at : c,
        axis === 'x' ? 0 : Q,
      );
}
function rail(k, p, axis, at, a, b) {
  for (let c = a; c < b - 0.001; c += 4) {
    const len = Math.min(4, b - c),
      mid = c + len / 2;
    const x = axis === 'x' ? mid : at,
      z = axis === 'x' ? at : mid;
    if (len === 4)
      p.prop('bw_glass_balustrade', x, z, 4.4, axis === 'x' ? 0 : 1);
    else
      for (const [y, h, d, m] of [
        [4.9, 1, 0.08, 'glass_clear'],
        [5.45, 0.1, 0.12, 'trim'],
      ])
        box(k, x, y, z, axis === 'x' ? len : d, h, axis === 'x' ? d : len, m);
  }
}
export function atrium(k, p) {
  for (const s of [-1, 1]) {
    glass(k, 'x', -38, s < 0 ? -28 : 4, s < 0 ? -4 : 28);
    glass(k, 'z', s * 28, -38, -10);
    k.p.ramp({
      from: vec(s * 26, 0, -22),
      to: vec(s * 26, 4.4, -12),
      width: 3,
      material: 'tread_plate',
    });
    k.p.ramp({
      from: vec(s * 22, 0, -33),
      to: vec(s * 12, 4.4, -33),
      width: 3,
      material: 'tread_plate',
    });
    rail(k, p, 'z', s * 1.93, -30.92, -12.08);
    rail(k, p, 'x', -11.93, s < 0 ? -24.5 : 2, s < 0 ? -2 : 24.5);
    rail(k, p, 'x', -11.93, s < 0 ? -27.8 : 27.5, s < 0 ? -27.5 : 27.8);
    rail(k, p, 'x', -31.07, s < 0 ? -12 : 2, s < 0 ? -2 : 12);
    for (const [a, b] of [
      [-34.88, -34.5],
      [-31.5, -31.16],
    ])
      rail(k, p, 'z', s * 11.93, a, b);
    for (const z of [-14, -28, -33])
      box(k, s * (z === -33 ? 9 : 1.5), 2.05, z, 0.4, 4.1, 0.4, 'metal');
  }
  rail(k, p, 'x', -34.94, -12, 12);
  for (const r of [
    R(-28, 28, -12, -8),
    R(-2, 2, -31, -12),
    R(-12, 12, -35, -31),
  ])
    deck(k, r, 4.4, stone, 0.3);
  for (const z of [-11, -18, -24, -32])
    box(k, 0, 9.8, z, 55.8, 0.4, 1.4, 'metal', { ceiling: true });
}
