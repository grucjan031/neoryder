// Wspólne stałe i pomocniki mapy run8 (Elektrownia Fuzyjna Kurogane Arms — Kompleks Helios-IV).
// Plik z prefiksem `_` nie jest generatorem; `build.mjs --run` go pomija.
import { readFileSync } from 'node:fs';
import { COLOR, R, vec } from './_runKit.mjs';

export { COLOR, R, vec };
export const Q = Math.PI / 2;
export const PI = Math.PI;

/** Poziomy posadzek 3 kondygnacji elektrowni fuzyjnej (§3.2 docs/maps/run8.md). */
export const Y_L0 = 0.0; // Poziom Główny L0 (R1, główna płyta R2, R4, R5, R6, R7)
export const Y_G1 = 4.8; // Poziom Galerii 1 G1 (Galerie G1 w R2, R3 Sterownia Główna, R8 Biuro Kierownika)
export const Y_G2 = 9.6; // Poziom Galerii 2 G2 (Górne pomosty inspekcyjne i bojowe w R2)

/** Wysokości spodów stropów poszczególnych stref (`ceiling: true`). */
export const Y_R1_CEIL = 4.8; // R1 Szatnia i Śluza Dekontaminacyjna (H = 4.80 m)
export const Y_R4_CEIL = 5.6; // R4 Laboratorium Fizyki Plazmy (H = 5.60 m)
export const Y_R5_CEIL = 7.2; // R5 Magazyn Paliwa Fuzyjnego (H = 7.20 m)
export const Y_R6_CEIL = 8.0; // R6 Hala Turbin i Wymienników Ciepła (H = 8.00 m)
export const Y_R7_CEIL = 5.6; // R7 Serwerownia Diagnostyczna (H = 5.60 m)
export const Y_G1_CEIL = 9.6; // R3 Sterownia Główna i R8 Biuro Kierownika (y = 4.80..9.60 m, H = 4.80 m)
export const Y_HALL_CEIL = 19.2; // R2 Główna Hala Reaktora Fuzyjnego (H = 19.20 m)

/** Grubości płyt stropowych i ścian działowych. */
export const SLAB = 0.4;
export const WALL_T = 0.4;

export const MAT_FLOOR = 'fus_reactor_floor';
export const MAT_CONCRETE = 'fus_reactor_concrete';
export const MAT_SHIELD = 'fus_shield_panel';
export const MAT_TILE = 'fus_control_tile';
export const MAT_GLASS = 'glass_clear';
export const MAT_GRATING = 'steel_grating';
export const MAT_CEIL = MAT_CONCRETE;

/** Prostokąty wszystkich 8 pomieszczeń (`R1..R8`) oraz segmentów galerii `G1` i `G2` (§3.2 docs/maps/run8.md). */
export const ROOMS = {
  R1: R(-12, 12, 22, 36), // Szatnia i Śluza Dekontaminacyjna (L0 S)
  R2: R(-22, 22, -22, 22), // Główna Hala Reaktora Fuzyjnego „Komora Tokamaka Helios-IV” (L0 + G1 + G2)
  R3: R(-22, 6, -36, -22), // Sterownia Główna Reaktora „Mostek Helios-IV” (G1 N-W)
  R4: R(-38, -22, -22, 0), // Laboratorium Fizyki Plazmy i Wiązek (L0 NW)
  R5: R(-38, -22, 0, 22), // Magazyn Paliwa Fuzyjnego Deuter / Tryt (L0 SW)
  R6: R(22, 38, -4, 22), // Hala Turbin i Wymienników Ciepła (L0 SE)
  R7: R(22, 38, -22, -4), // Serwerownia Diagnostyczna i Kwantowa Kontrola Cewki (L0 NE)
  R8: R(6, 22, -36, -22), // Biuro Kierownika Naukowego Projektu „Helios” — Dr Haruto Mori (G1 N-E)
  // Segmenty Galerii Poziomu 1 (G1, y = +4.80 m, szer. 4.0 m)
  G1_N: R(-18, 18, -22, -18),
  G1_NW: R(-22, -18, -22, -18),
  G1_NE: R(18, 22, -22, -18),
  G1_W: R(-22, -18, -18, 6),
  G1_E: R(18, 22, -18, 6),
  G1_SW: R(-22, -16, 16, 22),
  G1_SE: R(16, 22, 16, 22),
  // Segmenty Galerii Poziomu 2 (G2, y = +9.60 m, szer. 3.2 m)
  G2_N: R(-22, 22, -22, -18.8),
  G2_W: R(-22, -18.8, -18.8, 6),
  G2_E: R(18.8, 22, -18.8, 6),
};

const measured = JSON.parse(
  readFileSync(
    new URL('../../../src/data/render/mapModelBounds.json', import.meta.url),
    'utf8',
  ),
);

/** Wymiary AABB modelu z mapModelBounds.json oraz środek względem originu. */
export function dims(model) {
  const m = measured[model];
  if (!m) throw new Error(`Brak pomiaru modelu ${model}.`);
  const [x0, y0, z0] = m.min,
    [x1, y1, z1] = m.max;
  return {
    w: x1 - x0,
    h: y1 - y0,
    d: z1 - z0,
    cx: (x0 + x1) / 2,
    cz: (z0 + z1) / 2,
    y0,
  };
}

/** Blok-prostopadłościan o podanym środku (x, y, z) i wymiarach (w, h, d). */
export function box(k, x, y, z, w, h, d, material, opts = {}) {
  return k.arena.block({
    position: vec(x, y, z),
    size: vec(w, h, d),
    material,
    ...opts,
  });
}

/** Bryła w prostokącie rzutu od `y0` do `y1`. */
export function solid(k, rect, y0, y1, material, opts = {}) {
  return k.solid(rect, y0, y1, material, opts);
}

/**
 * Monolityczna płyta posadzki z wierzchem na `y` (nauczka #1 z run7:
 * dokładnie jeden blok posadzki na pomieszczenie, bez szwów i dziur).
 */
export function deck(k, rect, y, material, thickness = SLAB, opts = {}) {
  return k.solid(rect, y - thickness, y, material, {
    walkable: true,
    ...opts,
  });
}

/** Dodaje objętość chronioną przed opadami (`rainShelters`) od `y0` do `y1`. */
export function addRainShelter(k, rect, y0, y1) {
  k.rainShelters.push({
    position: vec(
      (rect.minX + rect.maxX) / 2,
      (y0 + y1) / 2,
      (rect.minZ + rect.maxZ) / 2,
    ),
    size: vec(rect.maxX - rect.minX, y1 - y0, rect.maxZ - rect.minZ),
  });
}

/**
 * Trójwymiarowa struktura kasetonowa pod stropem (nauczka #2 z run7):
 * żebra podciągów, obwodowy gzyms i pasy `light_panel` z `ceiling: true`,
 * dzięki którym sufit w kadrach FPP nie wychodzi czarny, a w kamerach `top` / `high-*` znika.
 */
export function ceilingCoffers(k, rect, yBottom, material = MAT_CONCRETE) {
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  if (w < 4 || d < 4) return;
  const depth = 0.36;
  const y = yBottom - depth / 2;
  const opts = { ceiling: true, walkable: false };
  const pitch = Math.max(w, d) >= 36 ? 8.8 : 4.4;
  const beams = (lo, span) => {
    const n = Math.max(1, Math.round(span / pitch));
    return Array.from({ length: n - 1 }, (_, i) => lo + ((i + 1) * span) / n);
  };
  const xs = beams(rect.minX, w);
  const zs = beams(rect.minZ, d);
  for (const x of xs)
    box(
      k,
      x,
      y,
      (rect.minZ + rect.maxZ) / 2,
      0.26,
      depth,
      d - 0.4,
      material,
      opts,
    );
  for (const z of zs)
    box(
      k,
      (rect.minX + rect.maxX) / 2,
      y,
      z,
      w - 0.4,
      depth,
      0.26,
      'metal',
      opts,
    );
  for (const side of [-1, 1]) {
    box(
      k,
      (rect.minX + rect.maxX) / 2,
      y,
      side < 0 ? rect.minZ + 0.2 : rect.maxZ - 0.2,
      w,
      depth,
      0.4,
      material,
      opts,
    );
    box(
      k,
      side < 0 ? rect.minX + 0.2 : rect.maxX - 0.2,
      y,
      (rect.minZ + rect.maxZ) / 2,
      0.4,
      depth,
      d - 0.8,
      material,
      opts,
    );
    // Ciepłe pasy obwodowe `light_panel` na wszystkich 4 bokach rozświetlające strop i górne partie ścian bez smug bloomu.
    box(
      k,
      (rect.minX + rect.maxX) / 2,
      yBottom - 0.03,
      side < 0 ? rect.minZ + 0.65 : rect.maxZ - 0.65,
      w - 1.6,
      0.05,
      0.26,
      'light_panel',
      opts,
    );
    box(
      k,
      side < 0 ? rect.minX + 0.65 : rect.maxX - 0.65,
      yBottom - 0.03,
      (rect.minZ + rect.maxZ) / 2,
      0.26,
      0.05,
      d - 1.6,
      'light_panel',
      opts,
    );
  }
}

/**
 * Płyta stropowa ukrywana w ujęciach z góry (`ceiling: true`) + kasetony konstrukcyjne
 * + moduły `fus_ceiling_coffer_bay` (`6.0 × 0.65 × 6.0 m`) + dopasowana bryła `rainShelters`.
 */
export function cofferedCeilingSlab(
  k,
  rect,
  yBottom,
  material = MAT_CEIL,
  thickness = SLAB,
  shelterBottom = Y_L0 - 0.5,
  cofferGrid = true,
) {
  addRainShelter(k, rect, shelterBottom, yBottom + thickness + 0.2);
  const slab = k.solid(rect, yBottom, yBottom + thickness, material, {
    ceiling: true,
    walkable: false,
  });
  ceilingCoffers(k, rect, yBottom, material);
  if (cofferGrid) {
    const w = rect.maxX - rect.minX;
    const d = rect.maxZ - rect.minZ;
    const stepX = w >= 36 ? 12 : 8;
    const stepZ = d >= 36 ? 12 : 8;
    for (let x = rect.minX + 4.5; x <= rect.maxX - 4.5; x += stepX) {
      for (let z = rect.minZ + 4.5; z <= rect.maxZ - 4.5; z += stepZ) {
        deco(k, 'fus_ceiling_coffer_bay', x, yBottom - 0.65, z, 0);
      }
    }
  }
  return slab;
}

/**
 * Rekwizyt z kolizją i modelem (instancja). Środek AABB modelu = środek bloku.
 * `turn`: wielokrotność 90° (rotation.y = turn * π/2).
 */
export function prop(k, model, x, z, y = 0, turn = 0, opts = {}) {
  const d = dims(model);
  return k.arena.block({
    model,
    size: vec(d.w, d.h, d.d),
    position: vec(x, y + d.h / 2, z),
    material: 'metal',
    instance: true,
    ...(turn ? { rotation: vec(0, turn * Q, 0) } : {}),
    ...opts,
  });
}

/** Dekoracja bez kolizji z punktem zaczepienia (x, y, z). */
export function deco(k, model, x, y, z, yaw = 0, scale) {
  return k.deco(model, x, y, z, yaw, scale);
}

/**
 * Przemysłowa oprawa LED wysokiego składowania `fus_highbay_light_strip` (`4.0 × 0.35 × 0.65 m`):
 * montowana 0.35 m poniżej spodu stropu `ceilingY` (`mat_light_panel`).
 */
export function highbayLightStrip(k, x, ceilingY, z, yaw = 0) {
  return deco(k, 'fus_highbay_light_strip', x, ceilingY - 0.35, z, yaw);
}

/**
 * Podwieszane koryto kablowe `fus_overhead_cable_tray` (`6.0 × 0.85 × 1.20 m`):
 * montowane 0.85 m poniżej spodu konstrukcji `supportBottomY`.
 */
export function overheadCableTray(k, x, supportBottomY, z, yaw = 0) {
  return deco(k, 'fus_overhead_cable_tray', x, supportBottomY - 0.85, z, yaw);
}

/**
 * Ciepły panel świetlny `light_panel` wbudowany pod stropem (`ceilingY`).
 */
export function ceilingCovePanel(k, x, ceilingY, z, w, d) {
  return box(k, x, ceilingY - 0.02, z, w, 0.04, d, 'light_panel', {
    ceiling: true,
    walkable: false,
  });
}

/**
 * Pancerny portal grodziowy elektrowni `fus_blast_door_frame` (`4.0 × 3.8 × 0.36 m`):
 * dekoracja + 2 boczne niewidoczne kolidery ościeży (`0.45 × 3.8 × 0.36 m` na ±1.775 m)
 * oraz nadproże (`4.0 × 0.4 × 0.36 m` na y + 3.60 m). Wolne światło przejścia: 3.10 × 3.40 m.
 */
export function blastDoorFrame(k, placer, x, y, z, turn = 0) {
  const odd = Math.abs(turn) % 2 === 1;
  deco(k, 'fus_blast_door_frame', x, y, z, turn * Q);
  for (const side of [-1, 1]) {
    const px = odd ? x : x + side * 1.775;
    const pz = odd ? z + side * 1.775 : z;
    const sx = odd ? 0.36 : 0.45;
    const sz = odd ? 0.45 : 0.36;
    placer.reserve(R(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2), y);
    box(k, px, y + 1.9, pz, sx, 3.8, sz, 'metal', {
      visible: false,
      walkable: false,
    });
  }
  box(k, x, y + 3.6, z, odd ? 0.36 : 4.0, 0.4, odd ? 4.0 : 0.36, 'metal', {
    visible: false,
    walkable: false,
  });
}

/**
 * Komora natrysku dekontaminacyjnego i bramka dozymetryczna `fus_decon_shower_arch` (`3.4 × 2.8 × 1.6 m`):
 * dekoracja + 2 boczne niewidoczne kolidery ścianek (`0.45 × 2.8 × 1.6 m` na ±1.475 m)
 * oraz górny łuk (`3.4 × 0.35 × 1.6 m` na y + 2.625 m). Wolne przejście w środku: 2.50 × 2.45 m.
 */
export function deconShowerArch(k, placer, x, y, z, turn = 0) {
  const odd = Math.abs(turn) % 2 === 1;
  deco(k, 'fus_decon_shower_arch', x, y, z, turn * Q);
  for (const side of [-1, 1]) {
    const px = odd ? x : x + side * 1.475;
    const pz = odd ? z + side * 1.475 : z;
    const sx = odd ? 1.6 : 0.45;
    const sz = odd ? 0.45 : 1.6;
    placer.reserve(R(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2), y);
    box(k, px, y + 1.4, pz, sx, 2.8, sz, 'metal', {
      visible: false,
      walkable: false,
    });
  }
  box(k, x, y + 2.625, z, odd ? 1.6 : 3.4, 0.35, odd ? 3.4 : 1.6, 'metal', {
    visible: false,
    walkable: false,
  });
}

/**
 * Wysoki łuk rurociągu ciekłego helu `fus_coolant_pipe_arch` (`1.6 × 4.4 × 4.8 m`):
 * dekoracja + 2 boczne kolidery kolumn (`1.6 × 3.4 × 0.7 m` na ±2.05 m wzdłuż rozpiętości 4.8 m)
 * oraz górny łącznik (`1.6 × 1.0 × 4.8 m` na y = 3.4..4.4 m).
 * Prześwit pod łukiem: 3.40 m szerokości × 3.40 m wysokości (>= 2.20 m!).
 */
export function coolantPipeArch(k, placer, x, y, z, turn = 0) {
  const odd = Math.abs(turn) % 2 === 1;
  deco(k, 'fus_coolant_pipe_arch', x, y, z, turn * Q);
  for (const side of [-1, 1]) {
    const px = odd ? x + side * 2.05 : x;
    const pz = odd ? z : z + side * 2.05;
    const sx = odd ? 0.7 : 1.6;
    const sz = odd ? 1.6 : 0.7;
    placer.reserve(R(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2), y);
    box(k, px, y + 1.7, pz, sx, 3.4, sz, 'metal', {
      visible: false,
      walkable: false,
    });
  }
  box(k, x, y + 3.9, z, odd ? 4.8 : 1.6, 1.0, odd ? 1.6 : 4.8, 'metal', {
    visible: false,
    walkable: false,
  });
}

/**
 * Pancerna witryna obserwacyjna sterowni/laboratorium `fus_control_window_wall` (`5.0 × 4.4 × 0.4 m`):
 * dekoracja + niewidoczny kolider dolnego parapetu (`5.0 × 1.05 × 0.36 m`) oraz górnej szyby (`mat_glass_clear`).
 */
export function controlWindowWall(k, placer, x, y, z, turn = 0) {
  const odd = Math.abs(turn) % 2 === 1;
  deco(k, 'fus_control_window_wall', x, y, z, turn * Q);
  const sx = odd ? 0.36 : 5.0;
  const sz = odd ? 5.0 : 0.36;
  placer.reserve(R(x - sx / 2, x + sx / 2, z - sz / 2, z + sz / 2), y);
  box(k, x, y + 0.525, z, sx, 1.05, sz, MAT_SHIELD, {
    visible: false,
    walkable: false,
  });
  box(
    k,
    x,
    y + 2.725,
    z,
    odd ? 0.16 : 5.0,
    3.35,
    odd ? 5.0 : 0.16,
    MAT_GLASS,
    {
      visible: false,
      walkable: false,
    },
  );
}

/** Odcinki [a, b] z wyciętymi przerwami `gaps` (lista [od, do]). */
export function spans(a, b, gaps = []) {
  let out = [[a, b]];
  for (const [g0, g1] of gaps) {
    out = out.flatMap(([s0, s1]) => {
      if (g1 <= s0 || g0 >= s1) return [[s0, s1]];
      const parts = [];
      if (g0 > s0) parts.push([s0, g0]);
      if (g1 < s1) parts.push([g1, s1]);
      return parts;
    });
  }
  return out.filter(([s0, s1]) => s1 - s0 > 0.2);
}

/**
 * Ściana osiowa z otworami drzwiowymi lub okiennymi.
 * `axis = 'x'`: ściana biegnie wzdłuż X na `z = at`, od `start` do `end`.
 * `axis = 'z'`: ściana biegnie wzdłuż Z na `x = at`, od `start` do `end`.
 * Każdy otwór w `openings`: `[a, b, bottomY, topY]`.
 */
export function segmentedWall(
  k,
  axis,
  at,
  start,
  end,
  yBottom,
  yTop,
  material,
  openings = [],
  thickness = WALL_T,
) {
  const cuts = [...openings].sort((u, v) => u[0] - v[0]);
  const edges = [
    ...new Set([start, end, ...cuts.flatMap(([a, b]) => [a, b])]),
  ].sort((u, v) => u - v);
  const addSeg = (a, b, lo, hi, mat = material) => {
    if (b - a <= 1e-5 || hi - lo <= 1e-5) return;
    const rect =
      axis === 'x'
        ? R(a, b, at - thickness / 2, at + thickness / 2)
        : R(at - thickness / 2, at + thickness / 2, a, b);
    solid(k, rect, lo, hi, mat, { walkable: false });
  };
  for (let i = 1; i < edges.length; i++) {
    const a = edges[i - 1],
      b = edges[i],
      mid = (a + b) / 2;
    const active = cuts
      .filter(([o0, o1]) => o0 < mid && o1 > mid)
      .sort((u, v) => u[2] - v[2]);
    let curY = yBottom;
    for (const [, , lo, hi] of active) {
      if (lo > curY) addSeg(a, b, curY, lo);
      curY = Math.max(curY, hi);
    }
    if (curY < yTop) addSeg(a, b, curY, yTop);
  }
}

/**
 * Przemysłowa barierka galerii z listwą LED `fus_catwalk_railing` (`4.0 × 1.10 × 0.18 m`) na odcinku [a, b].
 * Pełne moduły 4 m używają modelu `fus_catwalk_railing`, krótsze odcinki domyka stalowo-szklana balustrada.
 */
export function catwalkRailing(k, axis, at, a, b, y) {
  const length = b - a;
  if (length < 0.2) return;
  const modules = Math.floor(length / 4 + 1e-6);
  const place = (from, to) => {
    const c = (from + to) / 2,
      l = to - from;
    const x = axis === 'x' ? c : at,
      z = axis === 'x' ? at : c;
    if (Math.abs(l - 4) < 1e-6) {
      prop(k, 'fus_catwalk_railing', x, z, y, axis === 'x' ? 0 : 1);
      return;
    }
    const sx = axis === 'x' ? l : 0.18,
      sz = axis === 'x' ? 0.18 : l;
    box(k, x, y + 0.08, z, sx, 0.16, sz, 'hivis', { walkable: false });
    box(
      k,
      x,
      y + 0.56,
      z,
      axis === 'x' ? l : 0.06,
      0.8,
      axis === 'x' ? 0.06 : l,
      MAT_GLASS,
      { walkable: false },
    );
    box(
      k,
      x,
      y + 1.04,
      z,
      axis === 'x' ? l : 0.1,
      0.08,
      axis === 'x' ? 0.1 : l,
      'neon_amber',
      { walkable: false },
    );
  };
  const rest = length - modules * 4;
  let cursor = a;
  for (let i = 0; i < modules; i++) {
    place(cursor, cursor + 4);
    cursor += 4;
  }
  if (rest > 0.2) place(cursor, b);
}

/**
 * Stalowy bieg rampy w osi Z (`rotation.x`) lub w osi X (`rotation.z`) o kącie nachylenia 25.64° <= 26.6°
 * z bocznymi policzkami, świecącymi listwami LED i poręczami odsuniętymi na zewnątrz szerokości biegu.
 */
export function rampFlightWithRails(
  k,
  axis,
  centerOrtho,
  width,
  yFrom,
  alongFrom,
  yTo,
  alongTo,
  ledMat = 'neon_amber',
  railSides = [-1, 1],
) {
  const from =
    axis === 'z'
      ? vec(centerOrtho, yFrom, alongFrom)
      : vec(alongFrom, yFrom, centerOrtho);
  const to =
    axis === 'z'
      ? vec(centerOrtho, yTo, alongTo)
      : vec(alongTo, yTo, centerOrtho);
  k.p.ramp({
    from,
    to,
    width,
    material: 'tread_plate',
  });
  const a0 = Math.min(alongFrom, alongTo) + 0.45;
  const a1 = Math.max(alongFrom, alongTo) - 0.45;
  const run = a1 - a0;
  if (run <= 0.5) return;
  const totalRun = Math.abs(alongTo - alongFrom);
  const rise = ((yTo - yFrom) * run) / totalRun;
  const dir = Math.sign(alongTo - alongFrom);
  const angle = Math.atan2(yTo - yFrom, totalRun);
  const len = Math.hypot(run, rise);
  const midY = (yFrom + yTo) / 2;
  const midAlong = (alongFrom + alongTo) / 2;
  if (axis === 'z') {
    const rx = -dir * angle;
    const ny = Math.cos(rx);
    const nz = Math.sin(rx);
    for (const side of railSides) {
      const x = centerOrtho + side * (width / 2 + 0.1);
      box(k, x, midY + ny * 0.1, midAlong + nz * 0.1, 0.14, 0.22, len, 'trim', {
        rotation: vec(rx, 0, 0),
        walkable: false,
      });
      box(
        k,
        x - side * 0.015,
        midY + ny * 0.22,
        midAlong + nz * 0.22,
        0.08,
        0.03,
        len,
        ledMat,
        {
          rotation: vec(rx, 0, 0),
          walkable: false,
        },
      );
      box(
        k,
        x,
        midY + ny * 0.94,
        midAlong + nz * 0.94,
        0.08,
        0.08,
        len,
        'metal',
        {
          rotation: vec(rx, 0, 0),
          walkable: false,
        },
      );
    }
  } else {
    const rz = dir * angle;
    const ny = Math.cos(angle);
    const nx = -dir * Math.sin(angle);
    for (const side of railSides) {
      const z = centerOrtho + side * (width / 2 + 0.1);
      box(k, midAlong + nx * 0.1, midY + ny * 0.1, z, len, 0.22, 0.14, 'trim', {
        rotation: vec(0, 0, rz),
        walkable: false,
      });
      box(
        k,
        midAlong + nx * 0.22,
        midY + ny * 0.22,
        z - side * 0.015,
        len,
        0.03,
        0.08,
        ledMat,
        {
          rotation: vec(0, 0, rz),
          walkable: false,
        },
      );
      box(
        k,
        midAlong + nx * 0.94,
        midY + ny * 0.94,
        z,
        len,
        0.08,
        0.08,
        'metal',
        {
          rotation: vec(0, 0, rz),
          walkable: false,
        },
      );
    }
  }
}

/** Rejestr zajętych rzutów na poszczególnych wysokościach kondygnacji. */
export function createPlacer(k) {
  const taken = [];
  const levelKey = (y) => Math.round(y * 10);
  const hit = (rect, lvl) =>
    taken.find(
      (t) =>
        t.level === lvl &&
        rect.minX < t.maxX &&
        rect.maxX > t.minX &&
        rect.minZ < t.maxZ &&
        rect.maxZ > t.minZ,
    );
  return {
    taken,
    reserve(rect, y = 0) {
      taken.push({ ...rect, level: levelKey(y) });
    },
    /** Rekwizyt z kolizją; zgłasza błąd w razie nałożenia na inną bryłę na tej samej wysokości. */
    prop(model, x, z, y = 0, turn = 0, opts = {}) {
      const d = dims(model);
      const odd = Math.abs(turn) % 2 === 1;
      const sx = (odd ? d.d : d.w) / 2,
        sz = (odd ? d.w : d.d) / 2;
      const rect = R(x - sx, x + sx, z - sz, z + sz);
      const lvl = levelKey(y);
      const other = hit(rect, lvl);
      if (other)
        throw new Error(
          `${model} (${x}, ${z}, y=${y}) nachodzi na (${other.minX}…${other.maxX}, ${other.minZ}…${other.maxZ}).`,
        );
      taken.push({ ...rect, level: lvl });
      return prop(k, model, x, z, y, turn, opts);
    },
    free(x, z, y = 0, pad = 0.8) {
      return !hit(R(x - pad, x + pad, z - pad, z + pad), levelKey(y));
    },
  };
}
