import { box, dims, vec } from './_run3Kit.mjs';
import { detail, monitor, outline } from './_run5Kit.mjs';

function table(k, x, z, w, d, h = 0.82) {
  detail(k, x, h - 0.045, z, w, 0.09, d, 'plaster');
  for (const s of [-1, 1])
    detail(
      k,
      x + s * w * 0.36,
      (h - 0.09) / 2,
      z,
      0.09,
      h - 0.09,
      d * 0.76,
      'trim',
    );
}
function seat(k, x, z) {
  detail(k, x, 0.22, z, 0.14, 0.44, 0.14, 'trim');
  detail(k, x, 0.47, z, 0.45, 0.08, 0.42, 'plastic');
}
function shelves(k, x, z) {
  for (const dx of [-1.25, 1.25])
    detail(k, x + dx, 1, z, 0.09, 2, 0.62, 'trim');
  for (const y of [0.18, 0.8, 1.42]) {
    detail(k, x, y, z, 2.5, 0.07, 0.65, 'trim');
    for (const dx of [-0.8, -0.12, 0.7])
      detail(
        k,
        x + dx,
        y + 0.23,
        z,
        0.56,
        0.39,
        0.51,
        dx < 0 ? 'plaster' : 'plastic',
      );
  }
}

function cabinets(k, p) {
  const digits = [
    'bc',
    'abged',
    'abgcd',
    'fgbc',
    'afgcd',
    'afgecd',
    'abc',
    'abcdefg',
  ];
  for (const [row, x] of [14, 24].entries())
    for (const [i, z] of [10, 16.2, 22.4, 28.6].entries()) {
      const side = row ? 1 : -1;
      for (const dz of [-1.55, 1.55]) {
        box(k, x, 0.16, z + dz, 2.8, 0.32, 0.17, 'trim');
        p.prop('bw_treatment_screen', x, z + dz, 0.32);
      }
      box(k, x + side * 1.53, 0.16, z, 0.17, 0.32, 2.8, 'trim');
      p.prop('bw_treatment_screen', x + side * 1.53, z, 0.32, 1);
      // Jak w starej klinice: osobny model z ruchomym oparciem i stały
      // kolider wyznaczony z dokładnej obwiedni wierzchołków GLB.
      const bedX = x + 0.4 * side;
      p.prop('bw_treatment_bed', bedX, z, 0, 0, {
        model: undefined,
        visible: false,
      });
      k.deco('bw_treatment_bed', bedX, 0, z);
      p.prop('bw_med_cart', x - 0.65 * side, z + 0.35);
      seat(k, x - side * 0.78, z - 0.88);
      detail(k, x + side * 0.95, 0.94, z + 1.12, 0.04, 1.88, 0.04, 'trim');
      detail(k, x + side * 0.95, 1.83, z + 1.02, 0.06, 0.045, 0.24, 'trim');
      detail(k, x + side * 0.95, 1.65, z + 0.93, 0.13, 0.32, 0.085, 'plastic');
      detail(k, x + side * 1.29, 1.22, z + 0.86, 0.2, 0.42, 0.23, 'plaster');
      detail(k, x + side * 1.18, 1.15, z + 0.86, 0.035, 0.08, 0.16, 'trim');
      // Tacka przy leżance: opakowania jałowe i pojemnik z pokrywą.
      const shelfX = x + side * 1.21;
      detail(k, shelfX, 1.11, z, 0.42, 0.055, 0.91, 'trim');
      for (const dz of [-0.27, -0.04])
        detail(k, shelfX, 1.16, z + dz, 0.28, 0.045, 0.19, 'plaster');
      detail(k, shelfX, 1.24, z + 0.23, 0.23, 0.2, 0.24, 'plastic');
      detail(k, shelfX, 1.35, z + 0.23, 0.24, 0.025, 0.25, 'trim');
      detail(k, x + side * 0.65, 1.4, z - 1.25, 0.82, 0.08, 0.1, 'trim');
      monitor(
        k,
        x + side * 0.27,
        1.64,
        z - 1.19,
        0.8,
        0.4,
        0,
        'med_screen_vitals',
      );
      detail(k, x + side * 1.42, 1.22, z, 0.05, 1.75, 2.3, 'fabric');
      box(k, x + side * 1.39, 1.72, z, 0.08, 0.09, 0.56, 'light_panel');
      const front = x - side * 1.42;
      box(k, front, 1.43, z + 1.55, 0.08, 0.56, 0.38, 'rubber');
      for (const [seg, dz, y, h] of [
        ['a', 0, 0.18, 1],
        ['b', 0.09, 0.09, 0],
        ['c', 0.09, -0.09, 0],
        ['d', 0, -0.18, 1],
        ['e', -0.09, -0.09, 0],
        ['f', -0.09, 0.09, 0],
        ['g', 0, 0, 1],
      ])
        if (digits[row * 4 + i].includes(seg))
          box(
            k,
            front - side * 0.047,
            1.43 + y,
            z + 1.55 + dz,
            0.014,
            h ? 0.025 : 0.15,
            h ? 0.15 : 0.025,
            'neon_green',
          );
    }
}
export function furnish(k, p) {
  const prop = (name, x, z, turn = 0, y = 0) =>
    p.prop('bw_' + name, x, z, y, turn);
  // Cztery automaty: nadruki i obudowy mogą się scalić z materiałami statyki.
  const vending = (x, z) =>
    p.prop('city_vending', x, z, 0, 2, { instance: false });
  prop('reception_counter', -5, 22.4);
  prop('reception_counter', -7.5, 24, 1);
  k.deco('wh_wall_terminal', -8.75, 1.15, 20.3);
  for (const center of [24, 30]) {
    for (const side of [-1, 1])
      for (const x of [3.2, 7])
        prop('waiting_seats', x, center + side * 0.48, side < 0 ? 2 : 0);
    table(k, 5.1, center, 0.68, 0.92, 0.58);
    for (const dz of [-0.23, 0.13])
      detail(k, 5.1, 0.599, center + dz, 0.32, 0.038, 0.24, 'plastic');
  }
  prop('info_totem', -2.7, 31.8);
  prop('planter_bio', -5, 28.6);
  prop('planter_bio', -4.45, 32.45);
  prop('info_totem', 2.9, 21.3);
  for (const [x, z, screen] of [
    [-3, 25, 'vitals'],
    [7.3, 32.6, 'scan'],
  ]) {
    detail(k, x, 2.4, z, 0.78, 4.8, 0.78, 'plaster');
    monitor(
      k,
      x,
      1.6,
      z - 0.4,
      0.65,
      screen === 'scan' ? 1 : 0.4,
      2,
      'med_screen_' + screen,
    );
  }
  for (const x of [-8.9, 8.9]) {
    detail(k, x, 0.36, 22, 0.44, 0.72, 0.44, 'trim');
    detail(k, x, 0.724, 22, 0.3, 0.008, 0.3, 'rubber');
  }
  detail(k, -2.7, 0.65, 30.8, 0.48, 1.3, 0.22, 'trim');
  for (const y of [0.62, 0.9, 1.18]) {
    detail(k, -2.7, y, 30.96, 0.4, 0.17, 0.12, 'plaster');
    for (const dx of [-0.1, 0.1])
      detail(k, -2.7 + dx, y + 0.09, 30.94, 0.16, 0.12, 0.05, 'plastic');
  }
  for (const x of [-8, -6.5]) vending(x, 33);
  for (const z of [22.2, 25, 27.8, 30.6])
    prop('pharmacy_dispenser', -27.28, z, 1);
  prop('reception_counter', -21.8, 26, 1);
  for (const x of [-19, -16, -13])
    for (const z of [30, 32.8])
      prop('sample_fridge', x + (z === 32.8 ? 0.42 : 0), z, 2);
  box(k, -13.6, 1.5, 28.8, 6.8, 3, 0.12, 'glass_clear');
  box(k, -21.9, 1.5, 31.3, 0.12, 3, 5, 'glass_clear');
  box(k, -20.9, 1.1, 28.8, 1.9, 2.2, 0.15, 'med_wall_panel');
  box(k, -18.475, 0.015, 28.8, 2.95, 0.03, 0.82, 'tread_plate');
  for (const x of [-15.8, -12.5]) prop('lab_analyzer_bench', x, 21);
  p.prop('mall_electronics_shelf', -24.7, 33, 0, 2);
  shelves(k, -23, 21);
  shelves(k, -15.2, 27.95);
  for (const z of [23, 26, 29])
    detail(k, -24.8, 0.48, z, 0.12, 0.96, 0.12, 'trim');
  for (const z of [24.5, 27.5])
    detail(k, -24.8, 0.87, z, 0.045, 0.1, 3, 'plastic');
  detail(k, -13.6, 0.09, 28.72, 6.8, 0.045, 0.04, 'neon_blue');
  cabinets(k, p);
  prop('reception_counter', 19, 32);
  prop('waiting_seats', 26.8, 18.9, 3);
  for (const z of [10.5, 21.8, 29]) prop('waiting_seats', 26.9, z, 3);
  prop('reception_counter', 21.55, 31, 1);
  prop('lab_analyzer_bench', 24.2, 32.8);
  for (const x of [17.7, 20.3])
    monitor(k, x, 1.64, 32.1, 0.84, 0.42, 2, 'med_screen_vitals', true);
  for (const z of [14.5, 24.65]) prop('med_cart', 16.5, z);
  prop('resonance_scanner', -19, 13);
  box(k, -23, 1.55, 14.5, 0.13, 3.1, 6, 'glass_clear');
  prop('lab_analyzer_bench', -25, 13, 1);
  prop('lab_analyzer_bench', -13, 18);
  table(k, -26.8, 13, 0.9, 5.4);
  table(k, -12.3, 15.85, 1.65, 0.84);
  detail(k, -12.3, 1.05, 15.85, 1.1, 0.46, 0.59, 'plaster');
  detail(k, -12.3, 1.34, 15.85, 0.66, 0.12, 0.49, 'glass_clear');
  seat(k, -25.8, 15.6);
  detail(k, -25.55, 0.74, 15.6, 0.08, 0.52, 0.42, 'plastic');
  for (const z of [8, 9.4])
    detail(k, -10.85, 1.08, z, 0.8, 2.16, 1.15, 'plaster');
  detail(k, -25.3, 1, 8.6, 2.6, 2, 0.08, 'plastic');
  detail(k, -26.6, 1, 7.8, 0.08, 2, 1.6, 'fabric');
  outline(k, -19, 13, 3.6, 4.4, 'neon_blue');
  for (const [x, z] of [
    [-3.8, 3.5],
    [3.8, 10],
  ]) {
    prop('operating_table', x, z);
    prop('surgical_robot', x + 1.8, z, 3);
    for (const dz of [-1.9, 1.9]) prop('med_cart', x, z + dz);
    const tx = x - 1.25;
    detail(k, tx, 0.75, z, 0.6, 1.5, 0.6, 'plaster');
    monitor(k, tx, 1.27, z + 0.31, 0.49, 0.25, 0, 'med_screen_vitals');
    table(k, x + 1.55, z + 1.65, 0.95, 0.52);
    detail(k, x + 1.55, 0.84, z + 1.65, 0.81, 0.04, 0.43, 'trim');
    for (const dx of [1.32, 1.49, 1.66]) {
      detail(k, x + dx, 0.873, z + 1.65, 0.04, 0.026, 0.26, 'metal');
      detail(k, x + dx, 0.89, z + 1.74, 0.065, 0.03, 0.1, 'plastic');
    }
    outline(k, x + 0.4, z, 5.1, 5, 'neon_green');
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      detail(
        k,
        x + Math.sin(a) * 1.1,
        3.35,
        z + Math.cos(a) * 1.1,
        0.59,
        0.11,
        0.16,
        'light_panel',
        { rotation: vec(0, a, 0) },
      );
      if (i % 3 === 0)
        detail(
          k,
          x + Math.sin(a) * 1.1,
          4.9,
          z + Math.cos(a) * 1.1,
          0.035,
          3,
          0.035,
          'trim',
        );
    }
  }
  for (const [a, b] of [
    [-9.7, -5],
    [-1.5, 1.5],
    [5, 9.7],
  ]) {
    detail(k, (a + b) / 2, 0.25, 7, b - a, 0.5, 0.2, 'plaster');
    detail(k, (a + b) / 2, 1.65, 7, b - a, 2.3, 0.12, 'glass_clear');
    for (const x of [a + 0.05, b - 0.05])
      detail(k, x, 1.4, 7, 0.1, 2.8, 0.2, 'trim');
  }
  for (const x of [-6, 6]) {
    detail(k, x, 0.25, 15.8, 5, 0.5, 0.2, 'plaster');
    detail(k, x, 1.6, 15.8, 5, 2.2, 0.12, 'glass_clear');
    for (const dx of [-2.45, 2.45])
      detail(k, x + dx, 1.35, 15.8, 0.1, 2.7, 0.2, 'trim');
  }
  for (const z of [-4.8, 2.4, 8.6]) prop('implant_showcase', -8.8, z);
  for (const [x, z, t] of [
    [3, -2, 1],
    [-3, -3, 3],
    [4, 3, 1],
    [-2, 14, 0],
  ])
    prop('lab_analyzer_bench', x, z, t);
  box(k, -4.6, 0.5, 18.7, 4, 1, 1.3, 'med_wall_panel');
  for (const x of [-5.9, -4.6, -3.45]) {
    box(k, x, 1.04, 18.7, 0.95, 0.08, 0.75, 'trim');
    box(k, x, 1.085, 18.7, 0.76, 0.018, 0.53, 'rubber');
    box(k, x, 1.22, 19, 0.07, 0.28, 0.07, 'metal');
  }
  for (const x of [-6, -4.7, -3.5]) {
    detail(k, x, 1.72, 19.64, 0.3, 0.48, 0.27, 'plastic');
    detail(k, x, 2.55, 19.47, 1.17, 0.77, 0.6, 'plaster');
  }
  box(k, -3.15, 1.14, 18.3, 0.32, 0.28, 0.28, 'light_panel');
  prop('kamerton_cradle', -19, -1);
  // Front tabliczki jest cofnięty względem zewnętrznego obrysu cokołu.
  box(k, -19, 1, 0.006, 0.5, 0.25, 0.05, 'trim', { visible: false });
  for (const [x, z, t] of [
    [-23, -3, 1],
    [-23, 1.4, 1],
    [-19, 3.7, 2],
    [-15, 1.4, 3],
    [-15, -3, 3],
    [-19, -5.6, 0],
  ]) {
    prop('calibration_chair', x, z, t);
    for (const offset of [-0.08, 0.08]) {
      const elbow = -19 + Math.sign(x + 19) * 0.45 + offset;
      if (x !== -19)
        detail(
          k,
          (x + elbow) / 2,
          0.031,
          z + offset,
          Math.abs(x - elbow),
          0.06,
          0.075,
          'rubber',
          { walkable: true },
        );
      detail(
        k,
        elbow,
        0.031,
        (z + offset - 1) / 2,
        0.075,
        0.06,
        Math.abs(z + offset + 1),
        'rubber',
        { walkable: true },
      );
    }
  }
  outline(k, -19, -1, 3.1, 3.1, 'neon_violet');
  for (const x of [-13, -15.5]) p.prop('lab_cryo_server_rack', x, -6.8);
  table(k, -12, 2.5, 1.8, 0.7);
  monitor(k, -12, 1.5, 2.5, 0.6, 1.2, 2, 'med_screen_scan', true);
  for (const z of [-4.3, 2.6]) {
    p.prop('lab_cryo_server_rack', -26.85, z, 0, 1);
    box(k, -24.8, 0.045, z, 3.2, 0.09, 0.24, 'rubber');
  }
  for (const x of [14, 24])
    for (const [i, z] of [-5, -2, 1, 4].entries()) {
      prop(
        i === (x === 14 ? 0 : 3) ? 'regen_pod_open' : 'regen_pod',
        x,
        z,
        x === 14 ? 1 : 3,
      );
      const side = x === 14 ? -1 : 1;
      detail(k, x + side * 1.05, 0.52, z, 0.42, 1.04, 0.45, 'plaster');
      monitor(
        k,
        x + side * 1.05,
        1.18,
        z + 0.1,
        0.34,
        0.2,
        0,
        'med_screen_vitals',
        true,
      );
      detail(k, x + side * 0.8, 0.96, z - 0.4, 0.05, 1.92, 0.05, 'trim');
      detail(k, x + side * 0.8, 1.72, z - 0.29, 0.15, 0.28, 0.18, 'plastic');
      detail(k, x - side * 0.96, 0.97, z, 0.05, 1.94, 1.24, 'plastic');
      outline(k, x, z, 1.76, 2.18, 'neon_green');
    }
  for (const z of [-4.3, 0.3, 4.6])
    detail(k, 22.7, 0.45, z, 0.14, 0.9, 0.14, 'hivis');
  table(k, 22, -6.8, 3.1, 0.85);
  monitor(k, 22, 1.46, -6.8, 0.9, 0.45, 0, 'med_screen_vitals', true);
  // Wózek oparty na tylnym uchwycie. Druga orientacja przekątnej
  // zachowuje podstawę obróconej obwiedni na poziomie posadzki.
  const cart = dims('bw_med_cart');
  p.prop('bw_med_cart', 20, 1.5, 0, 0, {
    rotation: vec(-2 * Math.atan2(cart.d, cart.h), 0, 0),
  });
  prop('lab_analyzer_bench', 26, -6.8);
  for (const s of [-1, 1]) {
    box(k, 14 * s, 0.27, -23, 3.4, 0.54, 3.4, 'trim');
    prop('helix_sculpture', 14 * s, -23, 0, 0.54);
    for (const [x, z] of [
      [6, -16],
      [21, -16],
      [7, -27],
      [24, -28],
      [10, -20],
      [20, -29],
    ])
      prop('planter_bio', s * x, z, (x + 3 + (s > 0 ? 1 : 0)) % 4);
    for (const [x, z] of [
      [4.5, -24],
      [4.5, -29.4],
      [4.5, -18.8],
    ])
      prop('implant_showcase', s * x, z);
    prop('info_totem', s * 19, -11.8);
    prop('info_totem', s * 11, -26);
    prop('waiting_seats', s * 9.8, -17.8, 2);
    prop('waiting_seats', s * 18, -27.3, 1);
    prop('planter_bio', s * 19.7, -9.45, 0, 4.4);
    prop('planter_bio', s * 11, -9.45, 1, 4.4);
    for (const [x, z] of [
      [13, -16],
      [20.8, -22.2],
      [15, -30.3],
    ])
      prop('waiting_seats', s * x, z, 2);
    box(k, s * 1.5, 2.05, -20, 0.4, 4.1, 0.4, 'metal');
    for (const x of [7, 16]) prop('waiting_seats', s * x, -9.1, 2, 4.4);
    prop('waiting_seats', s * 6.5, -31.6, 2, 4.4);
  }
  prop('reception_counter', -10, -11);
  vending(-13, -9.2);
  vending(-14.8, -9.2);
  for (const x of [-16, -13])
    for (const z of [-11.7, -14]) {
      table(k, x, z, 0.95, 0.75);
      seat(k, x + 0.85, z);
      seat(k, x - 0.85, z);
      detail(k, x - 0.2, 0.89, z, 0.12, 0.14, 0.12, 'plaster');
    }
  monitor(k, 14, 1.6, -21.293, 0.9, 0.9, 0, 'med_floor_helix_logo', true);
}
