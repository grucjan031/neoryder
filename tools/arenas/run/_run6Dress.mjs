import { box, Q, COLOR, vec } from './_run3Kit.mjs';
import { monitor } from './_run5Kit.mjs';
import { rooms } from './_run6Kit.mjs';
import { topAt } from '../lib/geometry.mjs';
export const eggs = [
  ['zupa', -25.16, 1.6, 8.55, 1.2, 1.8, 1],
  ['pokaz', 4.08, 1.6, -11.9, 1.2, 1.8, 1],
  ['list_gonczy', 3.41, 1.6, 33.42, 1.2, 1.8, 2],
  ['nadia', 14, 0.72, 25.38, 0.45, 0.45, 2],
  ['cennik', -23.21, 1.6, -10, 1.2, 1.8, 1],
  ['origami', -17.34, 0.72, -20.2, 0.45, 0.45, null],
  ['herbata', -17, 1.6, -31.42, 0.96, 0.48, 0],
  ['kamienna', 17.65, 1.6, -37.7, 1.1, 0.55, 0],
  ['dyplom', 29.69, 1.6, -4, 1.2, 1.2, -1],
  ['ulotka', -7.65, 1.6, 17.5, 1.2, 1.8, 2],
  ['kot', -7.8, 1.6, 23.53, 0.94, 0.47, 0],
  ['parasolki', 2, 1.6, -23.74, 1.16, 0.58, 0],
];
function look(name, x, z, floorY, tx, ty, tz) {
  return {
    name,
    x,
    z,
    floorY,
    yaw: (Math.atan2(x - tx, z - tz) * 180) / Math.PI,
    pitch:
      (Math.atan2(ty - floorY - 1.65, Math.hypot(x - tx, z - tz)) * 180) /
      Math.PI,
  };
}
export const shots = [
  ...[
    [
      [0, 24, 0, 0, 3.2, 34],
      [2, 31, 0, -7, 1.5, 24],
    ],
    [
      [-20, 32, 0, -25, 1.6, 12],
      [-20, 8, 0, -14, 1.4, 24],
    ],
    [
      [22.8, 9, 0, 20, 0.82, 22],
      [24, 32, 0, 14, 1.5, 15],
    ],
    [
      [-20, 4, 0, -26, 1.8, -10],
      [-21, -12, 0, -15, 1.7, 2],
    ],
    [
      [20, 4, 0, 15, 1.6, -8],
      [22, -12, 0, 25, 1.5, 2],
    ],
    [
      [0, 19, 0, 0, 2.5, -11],
      [-4, -5, 0, 5, 3, 15],
    ],
    [
      [-9.3, -16.7, 0, -17, 0.52, -27.6],
      [-26.5, -31.7, 4.2, -13, 4.9, -35],
    ],
    [
      [12, -27.6, 0, 25.5, 1.7, -31.1],
      [14, -35, 0, 2, 2, -24],
    ],
  ].flatMap((pair, i) =>
    pair.map((a, j) => look('t' + (i + 1) + (j ? 'b' : 'a'), ...a)),
  ),
  look('t1c', 2.4, 32, 0, -5.05, 1.42, 26.85),
  look('t6c', -1.5, 16, 0, -3.8, 1.25, 1.5),
  look('plac-szczelina', -2.65, 10.1, 0, -1.96, 3.1, 19.4),
  look('plac-scena', 0, 0, 0, 0, 2.8, -11),
  look('dok-miasto', 16, -16.5, 4.2, 59, 8, -31),
  look('gora-kladka', 0, 6.6, 4.2, 2.33, 1.4, -10.5),
  look('gora-antresola', -20, -31.1, 4.2, -11, 1.25, -23.5),
  ...eggs.map(([, x, y, z, , , t], i) =>
    look(
      'ee' + String(i + 1).padStart(2, '0'),
      x + (t === null ? 0 : 2 * Math.sin(t * Q)),
      z + (t === null ? 0.035 : 2 * Math.cos(t * Q)),
      y - 1.65 + (t === null ? 2 : 0),
      x,
      y,
      z,
    ),
  ),
];
export function dress(k, p) {
  // Zapasy pozostawione na trasach dostaw oraz pod galeriami.
  for (const [x, z] of [
    [2.25, 3],
    [-2.25, 13.4],
    [-2.25, 7.8],
    [2.05, 10.8],
    [-24, -32],
    [-10, -32],
    [-2.25, -7.3],
    [-1.4, 27.2],
    [18.3, -24.7],
    [18.4, -19.6],
    [-20.3, 10.8],
    [-19.7, 16],
    [-20.3, 21],
    [-19.7, 26],
    [0.8, -32],
    [0.8, -19.5],
    [6, -19.5],
    [11, -19.5],
  ])
    chest(k, x, z);
  for (const [x, z] of [
    [-8.7, 25],
    [-5.2, 23.7],
    [-5.2, 32.6],
    [-8.7, 31],
    [8.7, 24],
    [8.7, 26],
    [6.4, 23.8],
    [8.7, 32],
    [21, -9],
    [28, -8],
    [28, -4],
    [28, 0],
    [12, -11],
    [12, -6],
    [12, 1],
    [20, 1],
  ])
    chest(k, x, z);
  for (const [id, x, y, z, w, h, t] of eggs) {
    if (t === null) {
      box(k, x, y - 0.03, z, w + 0.04, 0.05, h + 0.04, 'wood');
      k.decal('targ_ee_' + id, x, y, z, w, h, 0, 'floor', 1);
      for (const [dx, dy, sx, sy, tilt] of [
        [0.42, 0.05, 0.28, 0.1, -0.14],
        [0.53, 0.16, 0.12, 0.16, -0.4],
        [0.61, 0.25, 0.04, 0.14, -0.5],
      ])
        box(k, x + dx, y + dy, z, sx, sy, 0.1, 'light_panel', {
          rotation: vec(0, 0, tilt),
        });
    } else
      monitor(
        k,
        x,
        y,
        z,
        w,
        h,
        t,
        'targ_ee_' + id,
        ['zupa', 'pokaz', 'kamienna'].includes(id),
      );
  }
  box(k, 0, 4.96, -12.03, 3.4, 0.62, 0.12, 'rubber');
  k.neon('targ_sign_scena', 0, 4.96, -11.96, 3.2, 0.56, 0, COLOR.violet, 0);
  const surfaces = k.arena.toRoom().blocks.filter((b) => b.walkable);
  const lightPower = [54, 70, 80, 90, 55, 100, 78, 100];
  for (const [i, [, , r, h]] of rooms.entries()) {
    const warmHall = [0, 1, 6].includes(i);
    const xs = i === 6 ? 8 : i === 0 ? 2 : warmHall ? 4 : 3,
      zs = i === 6 ? 8 : i === 0 ? 10 : 4;
    for (let a = 0; a < xs; a++)
      for (let b = 0; b < zs; b++) {
        const x =
            i === 6
              ? -27.5 + a * 3
              : r.minX + ((a + 0.5) * (r.maxX - r.minX)) / xs,
          z = r.minZ + ((b + 0.5) * (r.maxZ - r.minZ)) / zs;
        if (
          (i === 5 && Math.abs(x) > 1 && Math.abs(x) < 3) ||
          (i === 7 && x > 24)
        )
          continue;
        const powered =
          i === 6
            ? [2, 4, 6].includes(a) && [2, 5].includes(b)
            : i === 0
              ? [2, 5, 7].includes(b)
              : (a + b) % 2 === 0;
        const amber = !powered && (a + 2 * b) % 7 === 0;
        const suspension = [0.9, 3.45, 1.15, 1.15, 1.15, 2.6, 0.55, 2.6][i];
        const mount = h - suspension;
        if (suspension)
          box(k, x, h - suspension / 2, z, 0.055, suspension, 0.055, 'metal', {
            ceiling: true,
          });
        const y = mount - (warmHall ? 0.9 : 0.13);
        if (warmHall) {
          box(k, x, mount - 0.055, z, 0.12, 0.11, 0.12, 'trim', {
            ceiling: true,
          });
          k.deco(
            'bw_targ_paper_lantern' + (amber ? '_amber' : ''),
            x,
            y - 0.1,
            z,
          );
        } else {
          box(k, x, mount - 0.05, z, 1.52, 0.1, 0.36, 'metal', {
            ceiling: true,
          });
          box(k, x, y, z, 1.44, 0.07, 0.28, 'light_panel', { ceiling: true });
        }
        if (powered)
          k.light(
            x,
            y - (warmHall ? 0.16 : 0.36),
            z,
            COLOR.warm,
            lightPower[i],
            16,
            {
              groundGlow: false,
              floorY: Math.max(
                0,
                ...surfaces
                  .map((b) => topAt(b, x, z) ?? 0)
                  .filter((top) => top < y),
              ),
            },
          );
      }
    // Niskie skrzynie kupieckie z listwami i pokrywą, wzdłuż tylnych ścian.
    const outer = i === 7 ? r.minZ + 0.95 : r.maxZ - 0.95;
    for (let x = r.minX + 1.1; x < r.maxX - 0.7; x += 1.58) {
      if (
        (i === 6 && x < -25.5) ||
        !p.free(x, outer, 0, 0.72) ||
        [
          [0, 34],
          [0, 22],
          [-20, 6],
          [20, 6],
          [-20, -14],
          [-7, -14],
          [5, -14],
          [22, -14],
          [14, -38],
        ].some(([gx, gz]) => Math.abs(x - gx) < 2.9 && Math.abs(outer - gz) < 2)
      )
        continue;
      chest(k, x, outer);
    }
    for (let z = r.minZ + 2.1; z < r.maxZ - 1; z += 5.4) {
      k.decal(
        'targ_floor_stall_marks',
        (r.minX + r.maxX) / 2 + 0.7,
        0.016,
        z,
        2.5,
        0.59,
      );
      k.deco('city_vent_grate', r.minX + 1.3, 0, z);
    }
    if (i !== 7)
      monitor(
        k,
        r.minX + 0.34,
        2.05,
        r.minZ + 2,
        2.5,
        1.22,
        1,
        'targ_poster_wall',
      );
  }
  for (const [x, z] of [
    [-26, 16.5],
    [-14, 23.5],
    [14, 18],
    [20, 22],
    [-16, -3],
    [-24, 3],
    [-17, -32],
  ])
    monitor(k, x, 1, z + 0.89, 1, 0.4, 0, 'targ_price_tags', true);
  for (const z of [9.5, 16.5, 23.5, 30.5])
    monitor(k, -22.65, 3.28, z + 1.52, 1.55, 0.48, 0, 'targ_tarp_pattern');
  for (const x of [-2, 2])
    for (const z of [-6, 2, 10, 18]) {
      k.decal(z > 5 ? 'puddle1' : 'puddle2', x, 0.013, z, 1.8, 3.4);
      k.fx('drip', x + Math.sign(x) * 0.96, 9.93, z, 0.8);
    }
  for (const z of [-21, -30, -35]) {
    k.fx('drip', 23.97, 9.95, z, 0.65);
    k.decal('puddle2', 26, 0.016, z, 3, 2);
  }
  // Linia opraw poniżej kładki rozświetla mokry bruk, dwie listwy oświetlają witryny części.
  for (const [x, y, z, color] of [
    [-4.8, 2.65, 5.5, 'warm'],
    [-20.5, 2.65, -33, 'warm'],
    [4.8, 2.65, 5.5, 'warm'],
    [-6, 2.2, 30.6, 'amber'],
    [-25.2, 2, 16.5, 'amber'],
    [-14.8, 2, 23.5, 'amber'],
    [27.9, 2.15, 14, 'blue'],
    [27.9, 2.15, 23, 'blue'],
    [27.8, 1.85, -10.4, 'green'],
    [-24, 2.68, -3, 'violet'],
    [-16, 2.68, 3, 'violet'],
    [-17, 2.52, -32, 'amber'],
  ]) {
    box(k, x, y + 0.06, z, 1.35, 0.12, 0.23, 'metal');
    if (color === 'warm') box(k, x, 3.32, z, 0.06, 1.2, 0.06, 'trim');
    else box(k, x - 0.63, (y + 0.06) / 2, z, 0.07, y + 0.06, 0.09, 'trim');
    box(
      k,
      x,
      y - 0.025,
      z,
      1.25,
      0.055,
      0.19,
      color === 'warm' ? 'light_panel' : 'neon_' + color,
    );
    k.light(
      x,
      y - 0.12,
      z,
      COLOR[color],
      color === 'warm' ? 54 : 24,
      color === 'warm' ? 12 : 6,
      {
        groundGlow: false,
        floorY: 0,
      },
    );
  }
  for (const x of [-2.33, 2.33])
    k.light(x, 3.1, -11.94, COLOR.violet, 16, 12, {
      floorY: 1.2,
      groundGlow: false,
    });
  for (const z of [-21, -34]) {
    box(k, 24, 0.84, z, 0.36, 1.68, 0.36, 'metal');
    box(k, 24, 1.76, z, 0.38, 0.16, 0.38, 'neon_amber');
    k.light(24, 1.85, z, COLOR.amber, 14, 11, { floorY: 0, groundGlow: false });
  }
}
export function chest(k, x, z) {
  box(k, x, 0.48, z, 1.06, 0.96, 0.77, 'wood');
  box(k, x, 0.98, z, 1.1, 0.05, 0.81, 'metal');
  for (const dx of [-0.36, 0.36])
    box(k, x + dx, 0.49, z, 0.08, 0.97, 0.8, 'trim');
}
export function city(k) {
  for (const [i, [x, z, h, w]] of [
    [55, -53, 32, 9],
    [68, -39, 45, 11],
    [52, -26, 23, 8],
    [75, -16, 39, 12],
    [56, -7, 28, 8],
    [47, 5, 14, 7],
  ].entries()) {
    box(k, x, h / 2 - 9, z, w, h, 8, 'facade');
    const texture = [
      'hotel',
      'holo_helixa',
      'implants',
      'holo_drink',
      'iskra',
      'holo_koi',
    ][i];
    k.signs.push({
      kind: i % 2 ? 'holo' : 'neon',
      texture,
      position: vec(x - w / 2 - 0.02, h - 12, z),
      yaw: -Q,
      size: { w: 5.2, h: 3 },
      tint: [COLOR.amber, COLOR.blue, COLOR.violet][i % 3],
      flicker: { pattern: i % 2 ? 'buzz' : 'pulse', periodS: 2 + i * 0.3 },
    });
  }
  box(k, 42, -3.55, -27, 5.4, 1.1, 66, 'metal');
  for (const z of [-50, -28, -5]) box(k, 42, -14, z, 2.4, 20, 2, 'metal');
  k.deco('rail_maglev_car', 42, -3, -26, Q);
}
