import { box, Q, R, deck, vec } from './_run3Kit.mjs';
import { monitor } from './_run5Kit.mjs';
export function furnish(k, p) {
  const prop = (id, x, z, y = 0, t = 0) => p.prop('bw_targ_' + id, x, z, y, t);
  const rack = (x, h, z, t = 0) =>
    k.deco('bw_targ_hanging_rack', x, h - 1.6, z, t * Q);
  for (const x of [-6, 6]) {
    p.prop('city_kiosk', x, 26);
    box(k, x, 2.53, 25.5, 3.2, 0.14, 2.6, 'wood');
    for (const dx of [-1.45, 1.45]) {
      box(k, x + dx, 1.25, 24.5, 0.12, 2.5, 0.14, 'trim');
      box(k, x + dx, 1.25, 26.5, 0.12, 2.5, 0.14, 'trim');
    }
    box(k, x, 0.52, 26.85, 2.9, 1.04, 0.62, 'wood');
    for (const dx of [-0.95, 0, 0.95])
      k.deco('bw_targ_crate_stack', x + dx, 1.04, 26.85, 0, 0.57);
    k.deco('bw_targ_neon_totem', x, 0, 31, 0, 0.86);
    box(k, x, 2.58, 31, 0.86, 5.16, 0.516, 'metal', { visible: false });
  }
  prop('shrine', -7.8, 23.1);
  monitor(k, 9.66, 2.05, 24, 2.5, 1.22, -1, 'targ_poster_wall');
  for (const s of [-1, 1])
    for (const z of [9.5, 16.5, 23.5, 30.5]) {
      const x = -20 + s * 6,
        t = -s;
      prop('noodle_cart', x, z, 0, t);
      monitor(k, x + t * 0.83, 1.42, z, 0.66, 0.93, t, 'targ_menu_board');
      prop('stool_set', -20 + s * 2.65, z);
      k.fx('steam', x, 1.65, z, 0.45);
    }
  for (const z of [12.5, 19.5, 26.5]) {
    prop('wok_station', -28, z, 0, 1);
    for (const x of [-25, -14]) prop('crate_stack', x, z);
  }
  for (const x of [-22.65, -17.35])
    for (const z of [9.5, 16.5, 23.5, 30.5]) {
      k.deco('bw_targ_tarp_canopy', x, 0, z);
      for (const s of [-1, 1])
        for (const t of [-1, 1])
          box(k, x + 1.86 * s, 1.72, z + 1.36 * t, 0.09, 3.44, 0.09, 'metal', {
            visible: false,
          });
      k.rainShelters.push({ position: vec(x, 1.8, z), size: vec(4, 3.6, 3) });
    }
  for (const z of [8, 21, 32]) k.deco('city_trash_bags', -28.5, 0, z);
  for (const [x, zs] of [
    [14, [10, 18, 26, 31]],
    [20, [10, 14, 22, 30]],
    [26, [10, 18, 25, 32]],
  ])
    for (const z of zs) {
      prop('fish_table', x, z);
      const side = x === 26 ? -1 : 1;
      const binX = x + side * 1.8;
      box(k, binX, 0.24, z, 0.88, 0.48, 0.85, 'metal');
      for (const dx of [-0.24, 0.05, 0.24])
        box(k, binX + dx, 0.5, z + dx, 0.3, 0.17, 0.32, 'plaster', {
          rotation: vec(0, dx, dx),
        });
      box(k, binX, 0.23, z + 0.85, 0.42, 0.46, 0.42, 'trim');
      box(k, binX, 0.46, z + 0.85, 0.33, 0.025, 0.33, 'rubber');
    }
  // Kasety na moduły w pasażu oraz zamykane apteczki gabinetu.
  for (const side of [-1, 1])
    for (const z of [-12, -9, -6, -2, 1, 4])
      for (const clinic of [false, true]) {
        const x = (clinic ? 20 : -20) + side * 9.55;
        const y = clinic ? 2.78 : 3.32;
        box(k, x, y, z, 0.46, 0.69, 1.18, 'metal');
        box(
          k,
          x - side * 0.25,
          y,
          z,
          0.055,
          0.6,
          1.06,
          clinic ? 'plaster' : 'wood',
        );
        box(k, x - side * 0.29, y - 0.1, z + 0.34, 0.045, 0.18, 0.055, 'trim');
      }
  for (const x of [-7.6, 7.6])
    for (const z of [-11, -7, -1, 3, 8, 12]) {
      k.deco('bw_targ_paper_lantern_amber', x, 3.92 - 0.9 * 0.54, z, 0, 0.54);
    }
  for (const x of [15, 25]) for (const z of [10, 17, 24, 31]) rack(x, 5.2, z);
  for (const z of [14, 23]) prop('cold_door', 29.58, z, 0, -1);
  box(k, 29.46, 0.76, 30.7, 0.52, 1.52, 1.45, 'metal');
  k.deco('city_ac_unit', 29.19, 0.81, 30.7, -Q);
  box(k, 29.46, 0.76, 9, 0.52, 1.52, 1.45, 'metal');
  k.deco('city_ac_unit', 29.19, 0.81, 9, -Q);
  for (const y of [2.95, 3.16]) box(k, 29.63, y, 20, 0.12, 0.12, 23, 'trim');
  for (const z of [12, 21, 30]) {
    box(k, 27.55, 0.04, z, 3.4, 0.08, 0.09, 'rubber');
    box(k, 25.65, 0.04, z + 0.24, 0.69, 0.08, 0.09, 'rubber', {
      rotation: vec(0, 0.8, 0),
    });
    k.deco('city_vent_grate', 25.3, 0, z + 0.6);
  }
  for (const [x, z] of [
    [16.8, 11],
    [23, 17],
    [17.3, 27.2],
    [26.3, 22.3],
  ]) {
    box(k, x, 0.27, z, 1.3, 0.54, 0.9, 'metal');
    for (const [dx, dz, tilt] of [
      [-0.38, 0.12, -0.12],
      [0.04, -0.1, 0.18],
      [0.39, 0.12, -0.22],
    ])
      box(k, x + dx, 0.57, z + dz, 0.37, 0.16, 0.34, 'plaster', {
        rotation: vec(0, tilt, tilt),
      });
  }
  for (const s of [-1, 1])
    for (const z of [-10, -3, 3]) {
      prop('parts_stall', -20 + s * 4, z, 0, -s);
      prop('drawer_wall', -20 + s * 9.52, z, 0, -s);
    }
  for (const x of [-24, -16]) for (const z of [-9, 2]) rack(x, 4.8, z);
  for (const z of [-7, 0]) p.prop('bw_implant_showcase', -28, z);
  for (const z of [-7.5, 0.7]) {
    for (const x of [-25, -15]) box(k, x, 4.72, z, 0.18, 0.18, 0.45, 'metal');
    k.deco('city_cable_span', -20, 4.71, z);
  }
  for (const x of [15, 24])
    for (const z of [-9, -1]) {
      prop('implant_chair', x, z);
      prop('curtain_screen', x + 1.7, z, 0, 1);
    }
  for (const x of [14.5, 25]) p.prop('bw_waiting_seats', x, 4);
  for (const [x, z] of [
    [17.5, -6],
    [26, -6],
    [17, 1.7],
  ])
    p.prop('bw_med_cart', x, z);
  p.prop('bw_sample_fridge', 28, -11);
  box(k, 20, 0.55, -3, 2.2, 1.1, 0.85, 'wood');
  box(k, 20.6, 1.26, -3, 0.4, 0.32, 0.35, 'metal');
  box(k, 2.5, 0.87, -7.7, 0.72, 1.74, 0.4, 'metal');
  box(k, 2.5, 1.29, -7.475, 0.4, 0.24, 0.05, 'light_panel');
  k.deco('bw_targ_stage', 0, 0, -10.5);
  deck(k, R(-4, 4, -13, -8), 1.2, 'wood', 1.2, { visible: false });
  box(k, 0, 0.56, -8.035, 7.95, 1.12, 0.09, 'wood');
  for (const s of [-1, 1]) {
    box(k, s * 3.72, 3.17, -12.3, 0.44, 3.94, 0.44, 'metal', {
      visible: false,
    });
    monitor(k, s * 2.33, 2.85, -12.2, 2.24, 3.02, 0, 'targ_screen_show');
    k.p.ramp({
      from: vec(s * 4.85, 0, -6.4),
      to: vec(s * 4.85, 1.2, -9.4),
      width: 1.7,
      material: 'wood',
    });
    deck(
      k,
      R(s === 1 ? 4 : -5.7, s === 1 ? 5.7 : -4, -11, -9.4),
      1.2,
      'wood',
      1.2,
    );
    p.prop('city_overpass_pillar', s * 4.7, -2);
    p.prop('city_overpass_pillar', s * 7.65, 18.8);
    for (const [i, z] of [-0.6, 7.7, 12].entries())
      p.prop(
        i % 2 ? 'city_stall' : 'city_market_stall_canopy',
        s * 8,
        z,
        0,
        -s,
      );
    prop('neon_totem', s * 5.8, 20.2);
    for (const z of [-4.85, 1.5]) {
      const x = s * 4.35;
      const canopyX = s * 5.05;
      k.deco('bw_targ_tarp_canopy', canopyX, 0, z);
      for (const dx of [-1.86, 1.86])
        for (const dz of [-1.36, 1.36])
          box(k, canopyX + dx, 1.72, z + dz, 0.09, 3.44, 0.09, 'metal', {
            visible: false,
          });
      box(k, x, 0.49, z, 1.94, 0.98, 0.7, 'wood');
      for (const dx of [-0.55, 0.55]) {
        box(k, x + dx, 1.17, z, 0.82, 0.38, 0.62, 'wood');
        box(
          k,
          x + dx,
          1.38,
          z,
          0.66,
          0.12,
          0.48,
          dx < 0 ? 'container_olive' : 'plaster',
        );
      }
      box(k, x - s * 0.3, 0.07, z + 0.85, 1.8, 0.06, 0.65, 'container_navy', {
        rotation: vec(0, s * 0.18, 0),
      });
      box(k, x - s * 0.3, 0.075, z + 1.23, 2.3, 0.09, 0.09, 'wood', {
        rotation: vec(0, s * 0.18, 0),
      });
    }
    const binX = s * 7.4;
    for (let j = 0; j < 8; j++) {
      const angle = (j * Math.PI) / 4;
      box(
        k,
        binX + 0.32 * Math.sin(angle),
        0.47,
        -6.9 + 0.32 * Math.cos(angle),
        0.28,
        0.94,
        0.04,
        'metal',
        { rotation: vec(0, angle, 0) },
      );
    }
    k.deco('city_trash_bags', binX, 0.26, -6.9, 0, 0.59);
  }
  for (const [id, x, z] of [
    ['stool_set', -3.2, 6.8],
    ['crate_stack', -3.4, 11],
  ]) {
    const b = p.prop('bw_targ_' + id, x, z);
    b.rotation = vec(0, Q, Math.PI);
  }
  for (const x of [-23.6, -17, -10.4])
    for (const z of [-20, -27.6]) {
      prop('tea_table', x, z);
      box(
        k,
        x,
        0.01,
        z,
        3.25,
        0.02,
        2.85,
        z === -20 ? 'container_olive' : 'container_navy',
      );
      box(k, x - 1.55, 3.8, z, 0.18, 7.6, 0.2, 'wood');
    }
  for (let z = -36; z <= -16; z += 4) {
    for (const x of [-29.45, -4.55]) box(k, x, 3.8, z, 0.24, 7.6, 0.24, 'wood');
    box(k, -17, 7.38, z, 25, 0.32, 0.22, 'wood', { ceiling: true });
  }
  // Lakierowane pudełko stoi na blacie; na jego pokrywce leży origami.
  box(k, -17.14, 0.53, -20, 0.91, 0.29, 0.7, 'wood');
  for (const x of [-26, -20.5, -15, -10]) {
    prop('tea_table', x, -35, 4.2);
    if (x !== -10) prop('curtain_screen', x + 2.6, -36.5, 4.2, 1);
  }
  for (const x of [-26, -14]) prop('crate_stack', x, -37.1, 4.2);
  prop('tea_counter', -17, -32);
  // Rezerwowy samowar na niskiej szafce za ladą.
  box(k, -18.5, 0.53, -34.45, 1.3, 1.06, 0.78, 'wood');
  for (const yaw of [0, Math.PI / 4])
    box(k, -18.5, 1.45, -34.45, 0.56, 0.78, 0.56, 'metal', {
      rotation: vec(0, yaw, 0),
    });
  box(k, -18.5, 1.89, -34.45, 0.48, 0.1, 0.48, 'trim');
  box(k, -18.5, 1.3, -34.09, 0.09, 0.09, 0.27, 'trim');
  box(k, -18.5, 1.24, -33.99, 0.09, 0.16, 0.09, 'trim');
  for (const x of [-22, -17, -12]) {
    for (const dx of [-1.75, 1.75])
      box(k, x + dx, 1.5, -36.5, 0.14, 3, 0.7, 'trim');
    for (const y of [0.45, 1.45, 2.45]) {
      box(k, x, y, -36.5, 3.6, 0.1, 0.83, 'wood');
      k.deco('bw_targ_crate_stack', x + 0.7, y + 0.05, -36.5, 0, 0.52);
    }
  }
  for (const [x, z] of [
    [-24.8, -31.5],
    [-9, -23.6],
    [-21, -16.2],
  ]) {
    box(k, x, 0.36, z, 0.82, 0.72, 0.82, 'wood');
    for (const dx of [-0.21, 0, 0.21])
      box(k, x + dx, 0.98, z, 0.16, 0.8, 0.28, 'container_olive', {
        rotation: vec(dx, 0, -dx),
      });
  }
  k.fx('steam', -17.9, 1.5, -32, 0.45);
  for (const x of [-22, -12]) prop('curtain_screen', x, -23.7);
  prop('shrine', -7, -36, 4.2);
  for (const [i, [x, z]] of [
    [2, -25],
    [18, -31],
  ].entries()) {
    p.prop('port_container_20_' + ['navy', 'graphite'][i], x, z);
    p.prop('port_container_20_' + ['olive', 'ochre'][i], x, z, 2.591);
  }
  for (const [x, z] of [
    [4.5, -36],
    [21, -27],
    [-1.8, -23],
  ]) {
    box(k, x, 0.16, z, 1.45, 0.32, 1.1, 'metal');
    box(k, x + 0.56, 0.7, z - 0.4, 0.09, 1.08, 0.1, 'trim');
    box(k, x + 0.56, 1.27, z - 0.4, 0.42, 0.24, 0.15, 'rubber');
  }
  p.prop('wh_forklift', 12, -24.5);
  p.prop('city_crates', 6.5, -32.5);
  // Wagon długości 25 m stoi na torze po miejskiej stronie peronu.
  deck(k, R(30, 35, -39, -13), 0, 'concrete', 1);
  p.prop('rail_maglev_car_open', 32.6, -26, 0, 1);
  for (let z = -36; z <= -16; z += 4)
    p.prop('city_highway_barrier', 29.55, z, 0, 1);
  for (const [id, x, z] of [
    ['scena', 3.4, -5.3],
    ['agregat', 26.1, 30.5],
  ]) {
    k.hazards.push({
      id,
      kind: 'electric_field',
      position: vec(x, 1, z),
      size: vec(3, 2, 2),
      cycle: { onS: 3, offS: 2.5 },
    });
    k.decal('floor_hazard', x, 0.022, z, 3, 2);
  }
  for (const [id, x, z] of [
    ['gaz', -28, 15],
    ['paliwo', 17, -25],
  ])
    k.hazards.push({ id, kind: 'explosive_barrel', position: vec(x, 0, z) });
}
