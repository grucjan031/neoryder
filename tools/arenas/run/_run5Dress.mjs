import { box, vec, Q, COLOR } from './_run3Kit.mjs';
import { detail, monitor, portals } from './_run5Kit.mjs';
const PI = Math.PI;
// Pozycja środka nadruku, format, normalna w ćwierćobrotach i miejsce obserwacji.
const eggs = [
  ['screen_queue_404', -5, 2.55, 22.08, 2.4, 1.2, 0],
  ['poster_akord_free', 9.79, 1.6, 30.2, 1.2, 1.8, -1],
  ['card_tymon', -4, 0.978, 22.57, 0.5, 0.5, 0],
  ['poster_pills', -27.79, 1.6, 32.45, 1.2, 1.8, 1],
  ['note_pin_1234', -20.9, 1.6, 28.716, 0.45, 0.45, 2],
  ['eye_chart', -13, 1.65, 6.21, 1, 1.5, 0],
  ['label_mug_lind', -3.15, 1.14, 18.153, 0.29, 0.24, 2],
  ['plaque_scratch', -9.79, 1.6, 4, 0.9, 0.45, 1],
  ['plaque_k112', -19, 1.6, 0.36, 0.9, 0.45, 0],
  ['scratch_ida', -22.2, 0.9, -7.79, 1.2, 0.6, 0],
  ['nameplate_wolan', 21.8, 1.6, 5.79, 0.9, 0.45, 2],
  ['plaque_donor', -14, 1.6, -21.293, 0.9, 0.45, 0],
];
function look(name, x, z, floorY, tx, ty, tz) {
  return {
    name,
    x,
    z,
    floorY,
    yaw: (Math.atan2(x - tx, z - tz) * 180) / PI,
    pitch:
      (Math.atan2(ty - floorY - 1.65, Math.hypot(x - tx, z - tz)) * 180) / PI,
  };
}
export const shots = [
  look('g1', 0, 30, 0, -5, 1.5, 22),
  look('g2', -16, 26, 0, -27, 1.5, 25),
  look('g3', 19, 30, 0, 17, 1.3, 12),
  look('g4', -14, 15.5, 0, -19, 1.3, 13),
  look('g5', 0, 16, 0, 2.8, 1.6, 9),
  look('g6', -16, 4.7, 0, -19, 1.7, -1),
  look('g7', 19, 4.4, 0, 15, 1.5, -4),
  look('g8-szklo', -15.9, -20, 0, -33, 3.8, -42),
  look('g8-wschod', 19, -26, 0, 53, 5, -19),
  look('g8-kawiarnia', -5, -15, 0, -11, 1.3, -10),
  look('g1b', 1, 22, 0, 6, 1.4, 30),
  look('g3b', 18, 11, 0, 21, 1.6, 31),
  look('g5b', -6, 0, 0, -3, 1.8, 5),
  look('g8-galeria', 9, -10.45, 4.4, 10, 5, -55),
  look('g8-taras', 9, -33.9, 4.4, 10, -7, -62),
  look('g8-helisa', -22, -29.5, 0, -13, 4, -21),
  ...eggs.map(([, x, y, z, , , t], i) => {
    const name = 'ee' + String(i + 1).padStart(2, '0');
    if (i === 2)
      return look(name, x, z + 2 * Math.tan(PI / 180), y + 2 - 1.65, x, y, z);
    return look(
      name,
      x + 2 * Math.sin(t * Q),
      z + 2 * Math.cos(t * Q),
      y - 1.65,
      x,
      y,
      z,
    );
  }),
];
export function dress(k) {
  for (const [i, [id, x, y, z, w, h, t]] of eggs.entries()) {
    if ([0, 8, 11].includes(i)) monitor(k, x, y, z, w, h, t, 'med_' + id, true);
    else
      k.decal('med_' + id, x, y, z, w, h, t * Q, i === 2 ? 'floor' : 'wall', 1);
  }
  for (const z of [11, 13, 15])
    monitor(k, -27.78, 2, z, 1, 2, 1, 'med_screen_scan');
  for (const [x, z, t] of [
    [19, 33.76, 2],
    [-3.7, 2, 0],
    [4, 8.2, 0],
    [26, -7.76, 0],
  ])
    monitor(
      k,
      x,
      2.1,
      z,
      1.12,
      0.56,
      t,
      'med_screen_vitals',
      Math.abs(z) < 10 && z > 0,
    );
  for (const x of [3.8, 7.2])
    k.decal('med_poster_helixa_care', x, 1.6, 20.21, 1.2, 1.8, 0, 'wall', 1);
  k.holo('holo_helixa', -2.85, 2, 20.22, 1.45, 1.45, 0, COLOR.blue);
  // DecalRenderer scala tylko rozłączne prostokąty na tej samej płaszczyźnie.
  // Na łączeniach i skrzyżowaniach zachowaj pełną długość obu nadruków.
  const layers = [];
  function wayline(x, z, length, vertical) {
    const hw = vertical ? 0.25 : length / 2;
    const hd = vertical ? length / 2 : 0.25;
    const bounds = { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd };
    let layer = layers.findIndex((others) =>
      others.every(
        (b) =>
          b.x1 < bounds.x0 ||
          bounds.x1 < b.x0 ||
          b.z1 < bounds.z0 ||
          bounds.z1 < b.z0,
      ),
    );
    if (layer === -1) layer = layers.length;
    (layers[layer] ??= []).push(bounds);
    k.decal(
      'med_floor_wayline',
      x,
      0.0121 + layer * 0.0001,
      z,
      length,
      0.5,
      vertical ? Q : 0,
    );
  }
  // Sieć przejść. Obejścia prowadzą obok lad, skanera i kołyski.
  for (const route of [
    [
      [0, 34.4],
      [0, 20],
      [0, 14],
      [0, 13],
      [0, 10],
      [-3.2, 10],
      [-3.2, 6],
      [0, 6],
      [0, -8],
    ],
    [
      [-10, 27],
      [10, 27],
    ],
    [
      [-10, 27],
      [-17.8, 27],
      [-17.8, 23],
      [-19, 23],
      [-19, 20],
      [-19, 16],
      [-21, 16],
      [-21, 9],
      [-19, 9],
      [-19, 6],
    ],
    [
      [10, 27],
      [11.2, 27],
      [11.2, 25.6],
      [19, 25.6],
      [19, 6],
    ],
    [
      [10, 13],
      [19, 13],
    ],
    [
      [-19, 16],
      [-15, 16],
      [-15, 13],
      [0, 13],
      [10, 13],
    ],
    [
      [-19, 6],
      [-19, 5.25],
      [-21, 5.25],
      [-21, -7],
      [-19, -7],
      [-19, -8],
    ],
    [
      [-10, -1],
      [-12.5, -1],
      [-16.8, -1],
      [-16.8, -3.8],
      [-21, -3.8],
    ],
    [
      [-10, -1],
      [0, -1],
    ],
    [
      [0, 0],
      [8, 0],
      [8, -1],
      [18, -1],
      [18, 5],
      [19, 5],
      [19, 6],
    ],
    [
      [18, -1],
      [18, -7],
      [19, -7],
      [19, -8],
    ],
  ])
    for (let j = 1; j < route.length; j++) {
      const [x, z] = route[j - 1],
        [tx, tz] = route[j],
        length = Math.hypot(tx - x, tz - z),
        parts = Math.ceil(length / 8);
      for (let part = 0; part < parts; part++) {
        const f = (part + 0.5) / parts;
        wayline(x + (tx - x) * f, z + (tz - z) * f, length / parts, x === tx);
      }
    }
  for (const [x, z, t] of portals)
    for (const side of [-1, 1]) {
      const offset = z === 34 && side === 1 ? 0.39 : 1.05;
      const width = 1.2;
      k.decal(
        'med_floor_cross',
        x + (t ? side * offset : 0),
        0.019,
        z + (t ? 0 : side * offset),
        width,
        width,
      );
    }
  for (const x of [-14, 14])
    k.decal('med_floor_helix_logo', x, 0.013, -23, 6, 6);
  for (const z of [-4.3, 0.3])
    k.decal('med_quarantine_tape', 21, 0.018, z, 3.4, 0.42);
  k.decal('med_floor_helix_logo', -19, 0.013, -1, 4.8, 4.8);
  k.decal('med_quarantine_tape', 19, 0.012, 4.6, 5, 0.52);
  // Pas w poprzek wejścia przyklejony do górnej belki między kopułami.
  box(k, 14, 2.39, -3.5, 0.055, 0.3, 3.1, 'trim');
  k.decal('med_quarantine_tape', 14.031, 2.39, -3.5, 3, 0.28, Q, 'wall', 1);
  for (const [id, x, z] of [
    ['scanner', -15.8, 12.4],
    ['kamerton', -19, -3.6],
  ]) {
    k.hazards.push({
      kind: 'electric_field',
      id,
      position: vec(x, 1, z),
      size: vec(3, 2, 2),
      cycle: { onS: 3, offS: 2.5 },
    });
    k.decal('floor_hazard', x, 0.018, z, 3, 2);
  }
  for (const [id, x, z] of [
    ['chlodnia', -22.6, 32.7],
    ['serwis', 26, -24],
  ])
    k.hazards.push({ kind: 'explosive_barrel', id, position: vec(x, 0, z) });
  lights(k);
}
function lights(k) {
  const ceiling = (x, underside, z, floorY = 0) => {
    k.deco('bw_ceiling_panel', x, underside - 0.3, z);
    k.light(x, underside - 0.8, z, COLOR.warm, floorY ? 11 : 13, 14, {
      floorY,
      groundGlow: false,
    });
  };
  for (let x = -22.5; x <= 22.5; x += 4.5) ceiling(x, 4.1, -10);
  for (const z of [-14.5, -19, -23.5, -28]) ceiling(0, 4.1, z);
  for (const x of [-9, -4.5, 0, 4.5, 9]) ceiling(x, 4.1, -32.03);
  for (const x of [-12, 12])
    for (const z of [-18, -32]) ceiling(x, 9.6, z, z === -32 ? 4.4 : 0);
  for (const s of [-1, 1]) {
    for (const [dx, c] of [
      [-1.15, 'blue'],
      [1.15, 'violet'],
    ]) {
      detail(k, 14 * s + dx, 0.59, -22.2, 0.24, 0.1, 0.28, 'neon_' + c);
      k.light(14 * s + dx, 0.72, -22.2, COLOR[c], 10, 10, {
        floorY: 0,
        groundGlow: false,
      });
    }
    for (const [x, z] of [
      [6, -16],
      [7, -27],
    ])
      k.light(s * x, 1.05, z, COLOR.warm, 6, 8, {
        floorY: 0,
        groundGlow: false,
      });
  }
  detail(k, -26.4, 2, 25, 1.1, 0.1, 0.14, 'trim');
  detail(k, -16, 1.9, 32.3, 0.15, 0.12, 0.46, 'trim');
  for (const [x, y, z, c] of [
    [-25.9, 2, 25, 'green'],
    [-16, 1.9, 32.12, 'blue'],
    [-19, 1.86, 12.43, 'blue'],
    [-19, 3.23, -1, 'violet'],
    [14.586, 2.1, -2, 'green'],
    [23.414, 2.1, 1, 'green'],
  ]) {
    detail(k, x, y, z, 0.12, 0.09, 0.12, 'neon_' + c);
    k.light(x, y, z, COLOR[c], 8, 9, { floorY: 0, groundGlow: false });
  }
}
export function city(k) {
  box(k, 0, -2.25, -39, 58, 0.5, 2, 'metal');
  for (const s of [-1, 1]) box(k, s * 29, -2.25, -24, 2, 0.5, 28, 'metal');
  for (let x = -27; x <= 27; x += 3) {
    box(k, x, -1.96, -39.8, 0.36, 0.08, 0.14, 'neon_amber');
    if (x % 9 === 0) k.fx('drip', x, -2.05, -40.04, 0.6);
  }
  for (const s of [-1, 1])
    for (let z = -35; z <= -11; z += 4)
      box(k, s * 29.8, -1.96, z, 0.14, 0.08, 0.36, 'neon_amber');
  const towers = [
    [-28, -59, 8, -5],
    [-9, -78, 8, 15],
    [14, -65, 9, -2],
    [32, -75, 10, 24],
    [-51, -23, 10, 9],
    [53, -19, 9, 17],
  ];
  towers.forEach(([x, z, w, top], i) => {
    box(k, x, (top - 62) / 2, z, w, top + 62, 9, 'facade');
    const side = i < 4 ? 0 : x < 0 ? 1 : -1;
    const px = x + Math.sin(side * Q) * (w / 2 + 0.03),
      pz = z + Math.cos(side * Q) * 4.53;
    const ad = (j, y) => {
      const texture = [
        'holo_helixa',
        'implants',
        'holo_drink',
        'hotel',
        'holo_koi',
        'iskra',
        'holo_android',
      ][j];
      k.signs.push({
        kind: texture.startsWith('holo') ? 'holo' : 'neon',
        texture,
        position: vec(px, y, pz),
        yaw: side * Q,
        size: { w: w * 0.84, h: 3.4 },
        tint: [COLOR.blue, COLOR.amber, COLOR.green, COLOR.violet][j % 4],
        flicker: { pattern: j % 2 ? 'buzz' : 'pulse', periodS: 1.8 + j * 0.47 },
      });
    };
    ad(i, top - 3);
    if (i === 3) ad(6, 4);
    if (i !== 2) ad((i + 3) % 7, [-15, 5, 0, 13, 0.8, 5.5][i]);
  });
  box(k, 0, -12.55, -52, 96, 1.1, 5.4, 'metal');
  for (const x of [-33, -9, 17, 40])
    box(k, x, -36.5, -52, 1.8, 47, 2.5, 'metal');
  for (const x of [-15, 10.6]) k.deco('rail_maglev_car', x, -12, -52);
}
