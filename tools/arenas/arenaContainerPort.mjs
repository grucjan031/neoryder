import { createArena, vec } from './lib/arena.mjs';
import { createPrimitives } from './lib/prims.mjs';

const rect = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });
const rightAngle = Math.PI / 2;
const grating = 'steel_grating';
const deck = 'ship_deck_steel';
const palette = ['navy', 'olive', 'ochre', 'graphite'];

export default function generate() {
  const arena = createArena({
    id: 'arenaContainerPort',
    name: 'Terminal kontenerowy',
    weather: 'storm',
    seed: 'terminal-0011',
    bounds: rect(-170, 170, -110, 110),
  });
  const p = createPrimitives(arena);
  const box = (x, y, z, w, h, d, material, visible = true) =>
    arena.block({
      position: vec(x, y + h / 2, z),
      size: vec(w, h, d),
      material,
      visible,
    });
  const hiddenFloor = (area, y, thickness = 0.4) =>
    p.floor(area, y, deck, { thickness, visible: false });
  const rampX = (a, b, z, low, high, width = 4) =>
    p.ramp({
      from: vec(a, low, z),
      to: vec(b, high, z),
      width,
      material: grating,
    });
  const cover = (model, x, z, w, h, d, y = 0, yaw = 0) =>
    arena.block({
      model,
      position: vec(x, y + h / 2, z),
      size: vec(w, h, d),
      material: 'metal',
      instance: true,
      ...(yaw ? { rotation: vec(0, yaw, 0) } : {}),
    });
  const wallX = (a, b, z, y, height, material, thickness = 0.5, opts) =>
    p.wall(vec(a, y, z), vec(b, y, z), height, thickness, material, opts);
  const wallZ = (a, b, x, y, height, material, thickness = 0.5, opts) =>
    p.wall(vec(x, y, a), vec(x, y, b), height, thickness, material, opts);
  const light = (x, y, z, color = '#fff1d6', range = 30) =>
    arena.light(vec(x, y, z), color, 72, range);
  const stack = (
    x,
    z,
    layers,
    length,
    color,
    y = 0,
    rotationY = 0,
    roof = false,
  ) => {
    const s = p.containerStack({
      position: vec(x, y, z),
      layers,
      length,
      rotationY,
      palette: [...palette.slice(color), ...palette.slice(0, color)],
    });
    if (roof) s.blocks.at(-1).walkable = true;
    return s.roofY;
  };

  arena.roomMeta({
    playerSpawn: vec(-150, 0, 55),
    maxAlive: 12,
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: vec(-150, 0, 58),
        size: vec(3, 3, 1),
      },
      {
        id: 'exit',
        role: 'exit',
        position: vec(162, 0, 39),
        size: vec(3, 3, 1),
      },
    ],
  });
  arena.arenaMeta({
    maxAlive: 12,
    enemyTickets: 200,
    spawnRing: { minM: 25, maxM: 95 },
    navigationCellM: 2,
    water: { shoreZ: 57, y: -0.85, color: '#142536' },
  });
  for (const [id, x, y, z] of [
    ['A', -148, 0, -25],
    ['B', 0, 0, -5],
    ['C', -65, 12.8, 88],
    ['D', 60, 0, -90],
    ['E', 140, 0, 0],
  ])
    arena.point(id, vec(x, y, z), 5);

  arena.zone('Nabrzeże', rect(-170, 140, 40, 70), 'open');
  arena.zone('Kontenerowiec', rect(-110, 8, 72, 104), 'high');
  arena.zone('Plac kontenerowy', rect(-120, 110, -60, 35), 'dense');
  arena.zone('Hala przeładunkowa', rect(-170, -125, -60, 10), 'interior');
  arena.zone('Bocznica', rect(-170, 170, -105, -75), 'low');
  arena.zone('Brama i biuro', rect(115, 170, -60, 40), 'interior');

  p.floor(rect(-170, 170, -110, -76), 0, 'rail_ballast');
  p.floor(rect(-170, 170, -76, 40), 0, 'quay_lines');
  p.floor(rect(-170, 170, 40, 57), 0, 'quay_lines');
  // Wcięcie basenu manewrowego, z betonową skarpą i odbojnicami po trzech stronach.
  for (const [a, b] of [
    [-170, 126],
    [146, 170],
  ]) {
    p.floor(rect(a, b, 57, 70), 0, 'quay_concrete', { thickness: 2 });
    for (let x = a + 2; x < b; x += 4)
      arena.decor('port_quay_edge', vec(x, -2, 69.2));
  }
  for (let x = 128; x < 146; x += 4)
    arena.decor('port_quay_edge', vec(x, -2, 56.2));
  for (let z = 59; z <= 67; z += 4) {
    arena.decor('port_quay_edge', vec(125.2, -2, z), rightAngle);
    arena.decor('port_quay_edge', vec(146.8, -2, z), -rightAngle);
  }
  for (const [x, z] of [
    [-157, 68.6],
    [-138, 68.6],
    [-100, 68.6],
    [-81, 68.6],
    [-43, 68.6],
    [-24, 68.6],
    [-5, 68.6],
    [14, 68.6],
    [33, 68.6],
    [52, 68.6],
    [71, 68.6],
    [90, 68.6],
    [109, 68.6],
    [123, 68.6],
    [131, 55.9],
    [142, 55.9],
    [151, 68.6],
    [165, 68.6],
  ]) {
    arena.decor('port_bollard_rope', vec(x, 0, z));
    box(x, 0, z, 0.65, 0.65, 0.65, 'metal', false);
  }
  for (const x of [-152, -126, -100, -66, -34, 0, 36, 70, 98, 130, 154]) {
    cover('city_highway_barrier', x, 43, 4, 1.093, 0.808);
    cover('city_generator', x + 5, 48, 1.6, 1.4, 1.005);
  }
  for (const [x, z] of [
    [-136, 51],
    [-103, 55],
    [28, 57],
    [64, 57],
    [104, 57],
    [155, 55],
  ])
    cover('port_reach_stacker', x, z, 6.06, 5.756, 11.105);
  for (const [row, z] of [51, 65].entries()) {
    for (const x of row
      ? [-151, -138, -107, -91, 22, 38, 51, 69, 83, 98, 116, 158]
      : [38, 51, 77, 88, 117, 138]) {
      const color = Math.abs(x + row) % 4;
      stack(x, z, 1 + (color === 2 ? 1 : 0), row ? 40 : 20, color);
    }
  }
  for (const [x, z] of [
    [-157, 52],
    [-91, 50],
    [37, 54],
    [92, 57],
    [165, 54],
  ]) {
    arena.decor('port_light_tower', vec(x, 0, z));
    box(x, 0, z, 1.5, 18, 1.5, 'metal', false);
    light(x, 18.5, z, '#fff1d6', 42);
  }
  for (const [x, z] of [
    [-78, 57],
    [-54, 51],
    [-22, 60],
    [1, 53],
    [46, 58],
    [81, 59],
    [113, 51],
    [149, 64],
  ]) {
    cover('city_barrier', x, z, 2, 0.929, 0.51);
  }
  for (const [x, z] of [
    [-118, 49],
    [12, 48],
    [119, 47],
    [146, 47],
  ]) {
    p.building({
      rect: rect(x - 2, x + 2, z - 2, z + 2),
      height: 2.8,
      doors: [{ side: 'south', at: 2, width: 1.8, height: 2.4 }],
      wallMaterial: 'corrugated',
    });
    cover('city_kiosk', x + 3, z, 0.8, 2.235, 0.624);
  }

  // Model jest powłoką. Collidery statku nie zamykają luków ani wejść.
  for (const [model, x] of [
    ['stern', -95],
    ['mid', -65],
    ['mid_hold', -35],
    ['bow', -6],
  ])
    arena.decor('port_ship_' + model, vec(x, 0, 88));
  hiddenFloor(rect(-110, -50, 72.4, 103.6), 12, 12);
  hiddenFloor(rect(-50, -20, 72.4, 75.4), 12, 12);
  hiddenFloor(rect(-50, -20, 100.6, 103.6), 12, 12);
  for (const [a, b] of [
    [-50, -48.6],
    [-21.4, -20],
  ])
    hiddenFloor(rect(a, b, 75.4, 100.6), 12, 12);
  hiddenFloor(rect(-48.6, -21.4, 75.4, 100.6), 3, 3);
  hiddenFloor(rect(-20, -16, 72.4, 103.6), 12, 12);
  hiddenFloor(rect(-16, -5, 74, 102), 13, 13);
  hiddenFloor(rect(-5, 3, 77, 99), 13, 13);
  hiddenFloor(rect(3, 7, 83, 93), 13, 13);
  box(-96, 12, 88.5, 9, 15, 20.5, 'metal', false);
  hiddenFloor(rect(-79, -51, 75, 101), 12.8, 0.8);
  p.floor(rect(-65.8, -64.2, 75, 101), 12.8, deck);
  rampX(-84, -78.95, 78, 12, 12.8, 4);
  rampX(-84, -78.95, 98, 12, 12.8, 4);
  // Droga przy burcie od drugiego trapu i od kładki suwnicy.
  rampX(-46, -52, 74.4, 12, 12.8, 4);
  p.floor(rect(-55, -50, 72.6, 78), 12.8, grating);

  for (const [x, z, n, c] of [
    [-85, 83, 1, 0],
    [-76, 85, 2, 2],
    [-75, 95, 1, 1],
    [-54, 92, 2, 0],
    [-54, 97, 1, 3],
    [-8, 82, 1, 2],
    [-38, 94, 1, 3],
  ])
    stack(x, z, n, 20, c, x < -80 ? 12 : x > -20 ? 13 : x > -50 ? 3 : 12.8);
  rampX(-78.1, -60, 95, 15.391, 12.8, 2.4);
  for (const [a, b] of [
    [-110, -97],
    [-93, -69],
    [-63, -37],
    [-33, -22],
  ]) {
    // Reling z przerwami dla trapów i wejścia z kładki.
    wallX(a, b, 72.3, 12, 1.1, 'metal', 0.15, { visible: false });
  }
  wallX(-110, -20, 103.7, 12, 1.1, 'metal', 0.15, { visible: false });
  wallZ(72.4, 103.7, -110, 12, 1.1, 'metal', 0.15, { visible: false });
  for (const [x, a, b] of [
    [7, 83, 93],
    [3, 77, 83],
    [3, 93, 99],
    [-5, 74, 77],
    [-5, 99, 102],
  ])
    wallZ(a, b, x, 13, 1.1, 'metal', 0.15, { visible: false });
  for (const [a, b, z] of [
    [-16, -5, 74],
    [-16, -5, 102],
    [-5, 3, 77],
    [-5, 3, 99],
    [3, 7, 83],
    [3, 7, 93],
  ])
    wallX(a, b, z, 13, 1.1, 'metal', 0.15, { visible: false });

  for (const [x, direction] of [
    [-95, 1],
    [-35, 1],
  ]) {
    const center = x - direction * 13;
    // Wejście od kei jest na osi trapu, a podest otwiera się na burtę.
    arena.decor(
      'port_gangway',
      vec(center, 0, 70.9),
      direction === 1 ? 0 : Math.PI,
    );
    p.floor(
      rect(
        Math.min(center - direction * 18, center - direction * 14),
        Math.max(center - direction * 18, center - direction * 14),
        68.5,
        72.1,
      ),
      0,
      'quay_concrete',
    );
    const ramp = rampX(
      center - direction * 14,
      center + direction * 12,
      70.9,
      0,
      12,
      2,
    ).blocks[0];
    ramp.visible = false;
    ramp.walkable = false;
    p.floor(rect(x - 1.25, x + 1.25, 69.9, 74.4), 12, grating);
    for (const side of [-1, 1]) {
      arena.block({
        ...ramp,
        position: vec(
          ramp.position.x,
          ramp.position.y + 0.75,
          70.9 + side * 1.06,
        ),
        size: vec(ramp.size.x, 1, 0.12),
      });
    }
  }

  for (const x of [-70, -10]) {
    arena.decor('port_sts_crane', vec(x, 0, 53), -rightAngle);
    for (const dx of [-9, 9]) {
      for (const dz of [-15, 15])
        box(x + dx, 0, 53 + dz, 2.2, 42.5, 2.2, 'crane_paint', false);
      box(x + dx, 17, 53, 1.5, 2, 31.8, 'crane_paint', false);
    }
    light(x, 16, 59, '#fff1d6', 44);
    light(x, 20, 89, '#fff1d6', 44);
  }
  // Szeroki bieg serwisowy ma łagodny profil także dla AI na siatce 2 m.
  rampX(17, -63, 62, 0, 12.8, 5);
  p.floor(rect(-69, -63, 59.5, 64.5), 12.8, grating);
  p.floor(rect(-69, -63, 64.5, 75.1), 12.8, grating);
  for (const x of [-69.08, -62.92])
    wallZ(64.5, 74.5, x, 12.8, 1.1, 'metal', 0.15);
  for (let i = 0; i < 18; i++) {
    const x = 15 - 4 * i;
    arena.decor('city_barrier', vec(x, ((17 - x) * 12.8) / 80, 59.4));
  }

  // Schody serwisowe na zachodniej suwnicy: cztery biegi i trzy spoczniki.
  for (let flight = 0; flight < 4; flight++) {
    const west = flight % 2 === 0;
    const fromX = west ? -76 : -65;
    const toX = west ? -65 : -76;
    const z = 41 + flight * 4;
    const stairs = p.stairs({
      from: vec(fromX, flight * 3, z),
      to: vec(toX, (flight + 1) * 3, z),
      width: 2.8,
      stepRise: 0.25,
      material: grating,
    });
    for (const step of stairs.blocks) step.walkable = false;
    if (flight < 3)
      p.floor(
        rect(west ? -65 : -79, west ? -62 : -76, z - 1.4, z + 5.4),
        (flight + 1) * 3,
        grating,
      );
  }
  p.floor(rect(-79, -76, 51.6, 58.6), 12, grating);
  rampX(-76, -70, 57, 12, 12.8, 3);
  p.floor(rect(-70, -63, 55.5, 59.5), 12.8, grating);

  // Kolizja trzech biegów w otwartej ładowni pokrywa się z modelem.
  for (let flight = 0; flight < 3; flight++) {
    const x = -45 + flight * 5.6;
    const steps = p.stairs({
      from: vec(x - 0.3, 3 + flight * 3, 76.1),
      to: vec(x + 4.2, 6 + flight * 3, 76.1),
      width: 1.4,
      stepDepth: 0.3,
      material: grating,
    });
    for (const step of steps.blocks) {
      step.walkable = false;
      step.visible = false;
    }
    hiddenFloor(rect(x + 4.2, x + 5.6, 75.4, 76.8), 6 + flight * 3);
  }
  hiddenFloor(rect(-29.6, -28.2, 74.3, 76.8), 12);
  for (const [a, b] of [
    [-49, -29.6],
    [-28.2, -21],
  ])
    wallX(a, b, 75.5, 12, 0.8, deck, 0.4, { visible: false });
  wallX(-49, -21, 100.5, 12, 0.8, deck, 0.4, { visible: false });
  for (const x of [-49, -21])
    wallZ(75.5, 100.5, x, 12, 0.8, deck, 0.4, { visible: false });
  // Dwa biegi dziobowe nie ingerują w falochron centralny.
  for (const z of [73.1, 102.9])
    p.stairs({
      from: vec(-18.5, 12, z),
      to: vec(-16, 13, z),
      width: 1.4,
      material: grating,
    }).blocks.forEach((block) => {
      block.walkable = false;
      block.visible = false;
    });

  // Dwie aleje E–W (Z −37…−25 i −11…1), trzy N–S.
  // Rzędy liczą po 4–8 kontenerów; po kilka rzędów tworzy zwarty blok.
  const bays = [-119.4, -52.65, 8.1, 67.1];
  const slotsByBay = [9, 8, 8, 7];
  const cell = 6.096;
  const rowWidth = 2.438;
  const roofZ = 16.6 + rowWidth / 2;
  const roof2 = 5.182;
  const roof3 = 7.773;
  const groups = [
    [-59.8, 4],
    [-46.9, 4],
    [-24.75, 5],
    [1.2, 5],
    [16.6, 5],
    [32.2, 1],
  ];
  const openContainer = (x, z, color, across = false) => {
    const shell = (dx, y, dz, w, h, d, material) =>
      across
        ? box(x + dz, y, z + dx, d, h, w, material)
        : box(x + dx, y, z + dz, w, h, d, material);
    const material = 'container_' + palette[color];
    for (const side of [-1, 1]) {
      shell(0, 0, side * 1.15, 6.058, 2.591, 0.12, material);
      // Skrzydła złożone na zewnątrz przy narożnikach otwartego kontenera.
      shell(side * 2.85, 0, -side * 1.25, 0.25, 2.4, 0.22, 'metal');
    }
    shell(0, 2.43, 0, 6.058, 0.161, rowWidth, material);
  };
  // Dwie pary otwartych kontenerów spinają poprzeczne zaułki.
  const shortcuts = [
    [2, 0, 4],
    [4, 3, 3],
  ];
  for (const [group, bay, slot] of shortcuts) {
    const x = bays[bay] + (slot + 0.5) * cell;
    const z = groups[group][0];
    for (const offset of [3.029, 9.099])
      openContainer(x, z + offset, bay, true);
  }
  for (const [group, [startZ, rows]] of groups.entries()) {
    for (let row = 0; row < rows; row++) {
      const z = startZ + (row + 0.5) * rowWidth;
      for (const [bay, west] of bays.entries()) {
        const slots = slotsByBay[bay];
        const shortcut = shortcuts.find(
          ([g, b]) => g === group && b === bay,
        )?.[2];
        const roofRow = group === 4 && row === 0 && bay < 3;
        let slot = 0;
        while (slot < slots) {
          if (slot === shortcut) {
            slot++;
            continue;
          }
          const edge = slot === 0 || slot === slots - 1;
          const atB = (group === 2 && row === 4) || (group === 3 && row === 0);
          const breakForB =
            atB &&
            ((bay === 1 && slot === slots - 1) || (bay === 2 && slot === 0));
          if (breakForB) {
            slot++;
            continue;
          }
          const open = edge && (bay + group + row) % 7 === 2 && !roofRow;
          const paired =
            !edge &&
            !open &&
            slot + 1 < slots - 1 &&
            (slot + row + bay + group) % 3 !== 0 &&
            slot + 1 !== shortcut &&
            !(atB && bay === 1 && slot + 1 === slots - 1);
          const length = paired ? 40 : 20;
          const x = west + (slot + (paired ? 1 : 0.5)) * cell;
          const color = (bay + row + slot + group) % palette.length;
          if (open) {
            openContainer(x, z, color);
          } else {
            const shifted =
              edge && !roofRow && !atB && (bay + group + row) % 4 === 0;
            const layers = roofRow
              ? bay < 2
                ? 2
                : 3
              : 1 + (((slot + row * 2 + group * 3 + bay) % 7) % 4);
            stack(
              x + (shifted ? (slot === 0 ? 0.24 : -0.24) : 0),
              z,
              layers,
              length,
              color,
              0,
              0,
              roofRow,
            );
          }
          slot += paired ? 2 : 1;
        }
      }
    }
  }
  // Wysunięte końcówki rzędów osłaniają wjazdy, pozostawiając 10–12 m przejazdu.
  for (const [x, z] of [
    [-111, -36.8],
    [-39, -36.8],
    [26, -36.8],
    [87, -36.8],
    [-91, -11.5],
    [-26, -11.5],
    [34, -11.5],
    [100, -11.5],
  ]) {
    stack(x, z, 1, 40, Math.abs(x) % 4);
  }
  // Kładki mają oparcie na obu brzegach alei. Druga łączy różne poziomy.
  const roofBridge = (a, b, startY, endY) => {
    rampX(a - 0.08, b + 0.08, roofZ, startY, endY, 2.3);
    if (startY === endY)
      for (let x = a + 3; x <= b - 2.5; x += 6)
        arena.decor('port_lashing_platform', vec(x, startY - 0.1, roofZ));
  };
  roofBridge(
    bays[0] + slotsByBay[0] * cell - 0.15,
    bays[1] + 0.15,
    roof2,
    roof2,
  );
  roofBridge(bays[1] + slotsByBay[1] * cell, bays[2] + 0.03, roof2, roof3);
  rampX(-138, -119.25, roofZ, 0, roof2, 2.3);
  p.floor(rect(29.5, 33, 13.7, roofZ + 1), roof3, grating);
  rampX(33, 56, 15, roof3, 0, 2.5);

  // Oznakowane wloty i małe kieszenie przeładunkowe poza główną osią jazdy.
  const decals = [];
  for (const z of [-31, -5, 38, -66]) {
    for (const x of [-109, -80, -43, -20, 22, 43, 79, 100]) {
      decals.push({
        texture: 'floor_arrow',
        position: vec(x, 0, z),
        size: { w: 2.5, h: 2.5 },
        yaw: x % 2 ? -rightAngle : rightAngle,
        surface: 'floor',
      });
    }
  }
  arena.roomMeta({ decals });
  for (const [x, z] of [
    [-106, -67],
    [-79, -67],
    [-35, -67],
    [-17, -71],
    [16, -68],
    [41, -67],
    [81, -67],
    [104, -68],
    [-133, -49],
    [-132, -3],
    [114, -50],
    [114, -41],
    [115, 32],
  ]) {
    stack(
      x,
      z,
      1,
      20,
      Math.abs(x) % 4,
      0,
      x < -125 || x > 110 ? rightAngle : 0,
    );
  }
  for (const [x, z] of [
    [-73, -70],
    [-22, -68],
    [33, -70],
    [89, -70],
  ]) {
    cover('port_flatcar', x, z, 14, 3.791, 3);
  }
  for (const z of [-64, 36]) {
    for (const x of [-118, -87, -53, -22, 16, 49, 81, 109]) {
      cover('city_highway_barrier', x, z, 4, 1.093, 0.808);
      cover('city_generator', x + 5, z + (z < 0 ? -2 : 2), 1.6, 1.4, 1.005);
    }
  }
  for (const [x, z] of [
    [-97, -26],
    [-22, -26],
    [21, -26],
    [89, -26],
    [-99, 0],
    [-22, 0],
    [23, 0],
    [88, 0],
  ]) {
    light(x, 6, z, '#fff1d6', 27);
  }

  const warehouse = rect(-170, -125, -60, 10);
  const gates = [
    { side: 'east', at: 11, width: 9, height: 5.5 },
    { side: 'east', at: 35, width: 10, height: 5.5 },
    { side: 'east', at: 59, width: 9, height: 5.5 },
    { side: 'south', at: 22, width: 6, height: 4 },
    { side: 'north', at: 27, width: 6, height: 4 },
  ];
  p.building({
    rect: warehouse,
    height: 12,
    doors: gates,
    wallMaterial: 'corrugated',
  });
  arena.roomMeta({
    rainShelters: [{ position: vec(-147.5, 6, -25), size: vec(45, 12, 70) }],
  });
  for (const x of [-167, -161, -155, -143, -137, -131])
    for (const [z, yaw] of [
      [10.2, 0],
      [-60.2, Math.PI],
    ])
      if (x !== -143)
        arena.decor('port_warehouse_shell_panel', vec(x, 0, z), yaw);
  for (const z of [-57, -39, -33, -21, -15, 6]) {
    arena.decor('port_warehouse_shell_panel', vec(-124.8, 0, z), rightAngle);
    arena.decor('port_warehouse_shell_panel', vec(-170.2, 0, z), -rightAngle);
  }
  for (let z = -57; z < 10; z += 6) {
    arena.decor('port_warehouse_roof_truss', vec(-147.5, 7.05, z), 0, {
      scale: 1.5,
    });
    light(-147.5, 8, z, '#fff1d6', 22);
  }
  p.floor(rect(-169.6, -162, -38, -12), 5, grating);
  for (const [bottom, top] of [
    [-58, -38],
    [8, -12],
  ]) {
    const stairs = p.stairs({
      from: vec(-165.5, 0, bottom),
      to: vec(-165.5, 5, top),
      width: 4,
      stepRise: 0.25,
      stepDepth: 1,
      material: grating,
    });
    for (const block of stairs.blocks) block.walkable = false;
  }
  wallZ(-38, -12, -161.9, 5, 1.1, 'metal', 0.15);
  for (const z of [-48, -35, -15, 0]) {
    for (const x of [-157, -141, -132]) {
      cover('city_crates', x, z, 1.212, 1.59, 1.256);
      box(x + 2, 0, z - 2, 1.5, 2.5, 4, 'metal');
      arena.decor('city_crates', vec(x + 2, 2.5, z - 2));
    }
  }

  // Podsypka na poziomie placu, szyny zagłębione przy punkcie D.
  for (const z of [-98, -90, -82]) {
    for (const side of [-0.72, 0.72])
      wallX(-165, 165, z + side, -0.1, 0.1, 'rail_sleeper_concrete', 0.09);
  }
  for (let x = -162; x <= 162; x += 12)
    if (Math.abs(x - 60) > 12)
      arena.decor('rail_track_straight', vec(x, -1, -90));
  arena.decor('rail_track_buffer', vec(166, -1, -90));
  box(166, 0, -90, 2, 1.5, 4, 'hazard');
  for (const [index, x] of [
    -146, -114, -80, -49, -15, 18, 40, 83, 112, 147,
  ].entries()) {
    const z = index % 2 ? -82 : -98;
    const type = [
      'port_freight_boxcar_open',
      'port_freight_boxcar',
      'port_flatcar',
    ][index % 3];
    if (!type.endsWith('_open')) {
      cover(type, x, z, 14, type.endsWith('flatcar') ? 3.791 : 4.2, 3);
      continue;
    }
    arena.decor(type, vec(x, 0, z));
    hiddenFloor(rect(x - 6.45, x + 6.45, z - 1.32, z + 1.32), 1.2, 1.2);
    for (const side of [-1, 1]) {
      box(x + side * 3.95, 1.2, z, 4.9, 3, 3, 'metal', false);
      const flight = p.stairs({
        from: vec(x, 0, z + side * 3.95),
        to: vec(x, 1.2, z + side * 1.31),
        width: 2.5,
        stepRise: 0.24,
        material: grating,
      });
      for (const step of flight.blocks) step.walkable = false;
    }
    box(x, 3.75, z, 3, 0.45, 3, 'metal', false);
  }
  for (const [x, z] of [
    [-161, -102],
    [-121, -100],
    [-89, -105],
    [-53, -105],
    [-22, -105],
    [10, -105],
    [43, -105],
    [75, -102],
    [103, -103],
    [139, -104],
    [160, -103],
  ]) {
    cover('city_dumpster', x, z, 1.97, 1.33, 1.08);
    cover('city_crates', x + 4, z + 1, 1.212, 1.59, 1.256);
  }
  for (const x of [-128, -59, 1, 70, 129]) {
    arena.decor('rail_signal_gantry', vec(x, 0, -93));
    light(x - 1, 5, -91, '#ffae1a', 23);
  }

  p.building({
    rect: rect(123, 156, -46, -17),
    height: 9,
    floors: 2,
    interior: true,
    roofAccessible: true,
    doors: [
      { side: 'south', at: 15, width: 8 },
      { side: 'east', at: 16, width: 4 },
    ],
  });
  p.stairs({
    from: vec(119, 0, -53),
    to: vec(119, 9, -21),
    width: 3,
    stepRise: 0.3,
    material: grating,
  }).blocks.forEach((block) => {
    block.walkable = false;
  });
  p.floor(rect(117.5, 124, -21, -17), 9, grating);
  p.stairs({
    from: vec(159, 0, -57),
    to: vec(159, 9, -25),
    width: 3,
    stepRise: 0.3,
    material: grating,
  }).blocks.forEach((block) => {
    block.walkable = false;
  });
  p.floor(rect(155, 160.5, -25, -20), 9, grating);
  for (const [x, z] of [
    [151, 10],
    [128, 11],
    [154, -58],
    [120, -70],
  ]) {
    p.building({
      rect: rect(x - 3, x + 3, z - 3, z + 3),
      height: 2.9,
      doors: [{ side: 'south', at: 3, width: 2.8, height: 2.5 }],
      wallMaterial: 'corrugated',
    });
    cover('city_kiosk', x + 4, z, 0.8, 2.235, 0.624);
    light(x, 4, z, '#ffae1a', 22);
  }
  for (const x of [130, 153]) {
    box(x, 0, 16, 0.55, 1.4, 0.55, 'metal');
    box(x + 2, 1.1, 16, 4, 0.18, 0.2, 'hazard');
  }
  for (const [x, z] of [
    [119, 22],
    [133, 29],
    [153, 33],
    [160, 21],
    [164, -13],
    [161, -49],
    [139, -66],
  ]) {
    cover('city_wrecked_car', x, z, 2.15, 1.58, 3.95);
    cover('city_barrier', x, z + 2.5, 2, 0.929, 0.51);
  }
  for (const [x, z] of [
    [-154, 25],
    [-132, 29],
    [-155, -70],
    [-106, -72],
    [-31, -70],
    [27, -71],
    [94, -72],
    [117, -33],
  ]) {
    cover('build_pipe_stack', x, z, 3.02, 2.793, 3);
    cover('city_dumpster', x + 4, z - 2, 1.97, 1.33, 1.08);
    light(x, 4, z, '#fff1d6', 24);
  }
  for (const [a, b, z] of [
    [-167, -139, 17],
    [-119, -107, 37],
    [110, 125, 17],
    [151, 167, 17],
    [-122, -94, -74],
    [-63, -39, -74],
    [-10, 11, -74],
    [55, 77, -74],
    [105, 130, -74],
  ])
    wallX(a, b, z, 0, 2, 'corrugated');

  // Ogrodzenia i nasyp zamykają ląd. Zabezpieczenie wodne jest nisko
  // na kei oraz na obwodzie statku, z przerwami przy wejściach.
  wallX(-170, 170, -109.5, 0, 2.4, 'corrugated');
  for (const x of [-169.7, 169.7]) wallZ(-110, 70, x, 0, 2.4, 'corrugated');
  wallX(-170.1, 170.1, -110, -0.2, 8, 'metal', 0.15, { visible: false });
  for (const x of [-170.1, 170.1])
    wallZ(-110, 70, x, -0.2, 8, 'metal', 0.15, { visible: false });
  for (const [a, b] of [
    [-170, -127],
    [-120, -67],
    [-60, 126],
    [146, 170],
  ])
    wallX(a, b, 69.95, 0, 1.1, 'metal', 0.13, { visible: false });
  wallX(126, 146, 56.95, 0, 1.1, 'metal', 0.2, { visible: false });
  for (const x of [126, 146])
    wallZ(57, 70, x, 0, 1.1, 'metal', 0.2, { visible: false });
  for (const [a, b] of [
    [-170, -110],
    [-20, 158],
  ]) {
    for (let x = a + 5; x < b; x += 18)
      arena.decor('build_hoarding_fence', vec(x, 0, -109.6));
  }
  for (let x = -164; x < 170; x += 12) {
    arena.decor('rail_track_straight', vec(x, -0.4, -118));
    if (x % 5 === 1) arena.decor('rail_catenary_mast', vec(x, 0, -124));
  }
  for (const x of [-195, 192]) {
    for (const z of [-100, -65, -29, 7, 42])
      arena.decor('port_warehouse_shell_panel', vec(x, 0, z), rightAngle, {
        scale: 2.8,
      });
  }

  const groundSpawns = [
    [-151, -50],
    [-158, -10],
    [-129, -23],
    [-102, -31],
    [-59, -21],
    [-43, -5],
    [3, -41],
    [7, 23],
    [46, -31],
    [63, -23],
    [110, 10],
    [-153, -92],
    [-97, -93],
    [-35, -89],
    [0, -93],
    [32, -91],
    [100, -91],
    [150, -90],
    [117, -16],
    [158, -32],
    [155, 4],
    [122, 27],
    [-112, 54],
    [-74, 48],
    [-22, 50],
    [17, 58],
    [63, 47],
    [113, 59],
    [162, 60],
  ].map(([x, z]) => vec(x, 0, z));
  groundSpawns.forEach((spawn) => arena.spawn(spawn));
  arena.arenaMeta({
    spawnPoints: [
      ...groundSpawns,
      vec(-77, 12.8, 79),
      vec(-61, 12.8, 96),
      vec(-70, 12.8, 81),
    ],
  });

  return arena;
}
