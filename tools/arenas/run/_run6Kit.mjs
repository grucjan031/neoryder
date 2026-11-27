import {
  R,
  vec,
  box,
  deck,
  ceilingSlab,
  segmentedWall,
  spans,
  Q,
  COLOR,
} from './_run3Kit.mjs';
export const rooms = [
  [
    'Brama targu',
    'brama',
    R(-10, 10, 22, 34),
    5.5,
    'amber',
    'facade',
    'interior',
  ],
  [
    'Aleja garkuchni',
    'garkuchnie',
    R(-30, -10, 6, 34),
    9,
    'amber',
    'targ_wood_planks',
    'dense',
  ],
  ['Hala rybna', 'ryby', R(10, 30, 6, 34), 5.2, 'blue', 'metal', 'interior'],
  [
    'Pasaż części',
    'czesci',
    R(-30, -10, -14, 6),
    4.8,
    'violet',
    'facade',
    'dense',
  ],
  [
    'Gabinet bez pytań',
    'gabinet',
    R(10, 30, -14, 6),
    4.2,
    'green',
    'med_wall_panel',
    'interior',
  ],
  [
    'Plac pod estakadą',
    'scena',
    R(-10, 10, -14, 22),
    10,
    'warm',
    'concrete',
    'open',
  ],
  [
    'Herbaciarnia z antresolą',
    'herbaciarnia',
    R(-30, -4, -38, -14),
    7.6,
    'warm',
    'formwork_plywood',
    'high',
  ],
  ['Dok maglevu', 'dostawy', R(-4, 30, -38, -14), 10, 'blue', 'metal', 'open'],
];
// Środek, ćwierćobrót, szerokość w świetle i cel widziany od strony + / −.
export const portals = [
  [0, 34, 0, 4, 1, 1],
  [-10, 28, 1, 4, 2, 1],
  [10, 28, 1, 4, 1, 3],
  [0, 22, 0, 10, 6, 1],
  [-10, 14, 1, 4, 2, 6],
  [10, 14, 1, 4, 6, 3],
  [-20, 6, 0, 4, 4, 2],
  [20, 6, 0, 4, 5, 3],
  [-10, -4, 1, 4, 4, 6],
  [10, -4, 1, 4, 6, 5],
  [-20, -14, 0, 4, 7, 4],
  [5, -14, 0, 6, 8, 6],
  [-7, -14, 0, 4, 7, 6],
  [22, -14, 0, 4, 8, 5],
  [-4, -26, 1, 4, 7, 8],
  [14, -38, 0, 4, 9, 8],
];
export function roof(k, r, h, mat) {
  ceilingSlab(k, r, h, mat);
  k.rainShelters.push({
    position: vec((r.minX + r.maxX) / 2, h / 2, (r.minZ + r.maxZ) / 2),
    size: vec(r.maxX - r.minX, h, r.maxZ - r.minZ),
  });
  for (let z = r.minZ + 2; z < r.maxZ; z += 5)
    box(
      k,
      (r.minX + r.maxX) / 2,
      h - 0.09,
      z,
      r.maxX - r.minX,
      0.18,
      0.18,
      mat === 'roof_tar' ? 'wood' : 'metal',
      { ceiling: true },
    );
}
export function shell(k) {
  for (const [i, [, , r, h, , mat]] of rooms.entries()) {
    deck(
      k,
      r,
      0,
      i === 6
        ? 'targ_wood_planks'
        : [2, 4].includes(i)
          ? 'targ_fish_tiles'
          : 'targ_wet_pavers',
      1,
    );
    if (i === 5)
      for (const [a, b] of [
        [-10, -3],
        [-1, 1],
        [3, 10],
      ])
        roof(k, R(a, b, -14, 22), 10, 'concrete');
    else if (i === 7) roof(k, R(-4, 24, -38, -14), 10, 'concrete');
    else roof(k, r, h, i === 6 ? 'roof_tar' : i === 1 ? 'concrete' : 'metal');
    for (const [axis, at, a, b, side] of [
      ['x', r.minZ, r.minX, r.maxX, 1],
      ['x', r.maxZ, r.minX, r.maxX, -1],
      ['z', r.minX, r.minZ, r.maxZ, 1],
      ['z', r.maxX, r.minZ, r.maxZ, -1],
    ]) {
      if (i === 7 && at === 30) continue;
      const holes = portals
        .filter(([x, z, t]) =>
          axis === 'x' ? t === 0 && z === at : t === 1 && x === at,
        )
        .map(([x, z, , w]) => [axis === 'x' ? x : z, w])
        .filter(([c]) => c > a && c < b)
        .map(([c, w]) => [c - w / 2 - 0.16, c + w / 2 + 0.16, 0, 3.85]);
      if (axis === 'x' && at === -14)
        for (const [lo, hi] of [
          [-9.6, -5.1],
          [5.8, 9.6],
        ])
          if (lo >= a && hi <= b) holes.push([lo, hi, 3.85, 7.5]);
      if (axis === 'z' && at === -4) holes.push([-18.2, -14, 4.15, 7.5]);
      // Każda strefa ma własne lico mieszczące się po jej stronie granicy.
      const facing = [1, 6].includes(i) && axis === 'x' ? 'metal' : mat;
      segmentedWall(k, axis, at + side * 0.09, a, b, 0, h, facing, holes, 0.18);
      const strip = (c, y, len, height, d, m) =>
        box(
          k,
          axis === 'x' ? c : at + side * (0.18 + d / 2),
          y,
          axis === 'x' ? at + side * (0.18 + d / 2) : c,
          axis === 'x' ? len : d,
          height,
          axis === 'x' ? d : len,
          m,
        );
      for (const [lo, hi] of spans(
        a + 0.21,
        b - 0.21,
        holes.map((o) => o.slice(0, 2)),
      )) {
        strip((lo + hi) / 2, 0.1, hi - lo, 0.2, 0.06, 'metal');
        strip((lo + hi) / 2, 1.07, hi - lo, 0.17, 0.05, 'wood');
        for (let c = lo + 0.45; c < hi - 0.15; c += 3.3)
          strip(c, h / 2, 0.14, h, 0.07, 'trim');
      }
    }
  }
  for (const [x, z, t, w, a, b] of portals) {
    const part = (off, y, len, h, d, mat) =>
      box(
        k,
        x + (t ? 0 : off),
        y,
        z + (t ? off : 0),
        t ? d : len,
        h,
        t ? len : d,
        mat,
      );
    for (const s of [-1, 1])
      part(s * (w / 2 + 0.08), 1.7, 0.16, 3.4, 0.48, 'wood');
    part(0, 3.61, w + 0.32, 0.42, 0.52, 'metal');
    for (const [side, id] of [
      [1, a],
      [-1, b],
    ]) {
      const gate = z === 34,
        lift = z === -38;
      const yaw = (t + (side < 0 ? 2 : 0)) * Q,
        offset = gate ? 0.55 : lift ? 0.57 : 0.27;
      const y = gate ? 4.88 : lift ? 3.77 : 3.61,
        width = gate ? 4.9 : 1.56,
        height = gate ? 0.92 : 0.36;
      const px = x + Math.sin(yaw) * offset,
        pz = z + Math.cos(yaw) * offset;
      box(
        k,
        px,
        y,
        pz,
        t ? 0.09 : width + 0.14,
        height + 0.08,
        t ? width + 0.14 : 0.09,
        'rubber',
      );
      k.neon(
        'targ_sign_' + (rooms[id - 1]?.[1] ?? 'winda'),
        px + 0.052 * Math.sin(yaw),
        y,
        pz + 0.052 * Math.cos(yaw),
        width,
        height,
        yaw,
        COLOR[rooms[id - 1]?.[4] ?? 'amber'],
        0,
      );
    }
  }
  for (const [x, z, model] of [
    [0, 34, 'bw_targ_gate'],
    [14, -38, 'bw_freight_lift_frame'],
  ]) {
    k.deco(model, x, 0, z);
    const s = Math.sign(z);
    deck(
      k,
      R(x - 2.4, x + 2.4, Math.min(z, z + s), Math.max(z, z + s)),
      0,
      'targ_wet_pavers',
      1,
    );
    box(k, x, 1.7, z + s * 1.14, 4.8, 3.4, 0.28, 'metal');
    for (const sign of [-1, 1])
      box(k, x + sign * 2.25, 1.7, z + s * 0.5, 0.3, 3.4, 1, 'metal');
  }
}
export function upper(k) {
  const decks = [
    [-30, -4, -38, -30],
    [-30, -26, -30, -26],
    [-7.6, -4, -30, -18],
    [-9.6, 17.5, -18, -14],
    [-9.6, -5.8, -14, 16],
    [5.8, 9.6, -14, 16],
    [-5.8, 5.8, 4, 7],
  ];
  for (const [i, r] of decks.entries())
    deck(k, R(...r), 4.2, i < 3 ? 'targ_wood_planks' : 'steel_grating', 0.28);
  for (const [a, b, w] of [
    [[-28, 0, -16], [-28, 4.2, -26], 3.5],
    [[27.5, 0, -16], [17.5, 4.2, -16], 3.5],
    [[4.2, 0, 17], [4.2, 4.2, 7], 3.2],
  ])
    k.p.ramp({
      from: vec(...a),
      to: vec(...b),
      width: w,
      material: 'targ_wood_planks',
    });
  // Krawędzie zewnętrzne pokładów; rozcięcia przy skrzyżowaniach i rampach.
  for (const [axis, at, a, b] of [
    ['x', -30, -26, -7.6],
    ['z', -26, -30, -26],
    ['z', -7.6, -30, -18],
    ['x', -18, -9.6, -7.6],
    ['x', -18, -4, 17.5],
    ['x', -14, -5.8, 5.8],
    ['x', -14, 9.6, 17.5],
    ['z', -9.6, -14, 16],
    ['z', -5.8, -14, 4],
    ['z', -5.8, 7, 16],
    ['x', 16, -9.6, -5.8],
    ['z', 9.6, -14, 16],
    ['z', 5.8, -14, 4],
    ['z', 5.8, 7, 16],
    ['x', 16, 5.8, 9.6],
    ['x', 4, -5.8, 5.8],
    ['x', 7, -5.8, 2.6],
  ]) {
    const beam = (c, y, len, h, d, mat, opts) =>
      box(
        k,
        axis === 'x' ? c : at,
        y,
        axis === 'x' ? at : c,
        axis === 'x' ? len : d,
        h,
        axis === 'x' ? d : len,
        mat,
        opts,
      );
    beam((a + b) / 2, 4.69, b - a, 0.74, 0.09, 'wood', { visible: false });
    beam((a + b) / 2, 5.24, b - a, 0.1, 0.12, 'targ_wood_planks');
    for (const y of [4.52, 4.86])
      beam((a + b) / 2, y, b - a, 0.06, 0.08, 'metal');
    for (let c = a + 0.15; c < b; c += 2) beam(c, 4.7, 0.11, 1, 0.14, 'trim');
  }
  for (const x of [-9.25, 9.25])
    for (const z of [-12, 2, 11]) box(k, x, 1.96, z, 0.28, 3.92, 0.28, 'metal');
}
