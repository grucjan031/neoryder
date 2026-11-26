// Wspólne stałe i pomocniki mapy run3 (Tajne Laboratorium Kurogane Arms — Sektor X-51).
// Plik z prefiksem `_` nie jest generatorem; `build.mjs --run` go pomija.
import { readFileSync } from 'node:fs';
import { COLOR, R, vec } from './_runKit.mjs';

export { COLOR, R, vec };
export const Q = Math.PI / 2;
export const PI = Math.PI;

/** Poziomy posadzek: Parter (0.0 m), Pomosty Obserwacyjne B1 (-1.6 m), Piwnica (-5.2 m). */
export const Y_PARTER = 0;
export const Y_CATWALK = -1.6;
export const Y_BASEMENT = -5.2;

/** Wysokości stropów poszczególnych stref. */
export const H_WING = 4.8; // P1..P4: y = 0.0 -> +4.8 m
export const H_HALL = 6.4; // P5 Centralny Hol: y = 0.0 -> +6.4 m
export const Y_B1_CEIL = 4.4; // B1 Wielka Sala: y = -5.2 -> +4.4 m (H = 9.6 m)
export const Y_B23_CEIL = -0.8; // B2, B3: y = -5.2 -> -0.8 m (H = 4.4 m)

/** Grubości płyt stropowych i ścian działowych. */
export const SLAB = 0.4;
export const WALL_T = 0.4;

/** Materiały powierzchniowe laboratorium (F-03). */
export const MAT_EPOXY = 'lab_epoxy_floor';
export const MAT_BUNKER = 'lab_bunker_concrete';
export const MAT_CLEAN = 'lab_cleanroom_wall';
export const MAT_INLAY = 'mall_terrazzo_inlay';
export const MAT_HAZARD = 'hazard_stripes_worn';
export const MAT_GRATING = 'steel_grating';
export const MAT_TURBINE = 'turbine_hall_floor';
export const MAT_SERVER = 'power_quay_floor';

/** Prostokąty 8 pomieszczeń zgodnie z tabelą §3.2 docs/maps/run3.md. */
export const ROOMS = {
  P1: R(-26, -10, 14, 28),
  P2: R(-26, -10, 0, 14),
  P3: R(10, 26, 14, 28),
  P4: R(10, 26, 0, 14),
  P5: R(-10, 10, 0, 28),
  B1: R(-20, 20, -44, 0),
  B2: R(-32, -20, -26, -10),
  B3: R(20, 32, -26, -10),
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

/** Płyta chodzenia z wierzchem na `y` (domyślnie grubość SLAB = 0.4 m). */
export function deck(k, rect, y, material, thickness = SLAB, opts = {}) {
  return k.solid(rect, y - thickness, y, material, { walkable: true, ...opts });
}

/** Płyta stropowa ukrywana w ujęciach z góry (`ceiling: true`). */
export function ceilingSlab(
  k,
  rect,
  yBottom,
  material = MAT_CLEAN,
  thickness = SLAB,
) {
  return k.solid(rect, yBottom, yBottom + thickness, material, {
    ceiling: true,
    walkable: false,
  });
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
 * Oprawa sufitowa `lab_ceiling_strip` (`2.4 × 0.35 × 0.6 m`, `CEILING_FIXTURES`):
 * montowana 0.35 m poniżej spodu stropu `ceilingY`, tak by uchwyty miały styk ze stropem.
 */
export function ceilingStrip(k, x, ceilingY, z, yaw = 0) {
  return deco(k, 'lab_ceiling_strip', x, ceilingY - 0.35, z, yaw);
}

/**
 * Bramka skanera biometrycznego `lab_bio_scanner_gate` (`3.2 × 2.6 × 1.4 m`):
 * dekoracja + 2 boczne niewidoczne kolidery pylonów (`0.5 × 2.6 × 1.4 m` na ±1.35 m)
 * oraz kolider nadproża (`3.2 × 0.3 × 1.4 m` na y + 2.45 m),
 * zostawiające w środku wolne przejście 2.20 × 2.30 m dla gracza i nawigacji.
 */
export function bioScannerGate(k, placer, x, y, z, turn = 0) {
  const odd = Math.abs(turn) % 2 === 1;
  deco(k, 'lab_bio_scanner_gate', x, y, z, turn * Q);
  for (const side of [-1, 1]) {
    const px = odd ? x : x + side * 1.35;
    const pz = odd ? z + side * 1.35 : z;
    const sx = odd ? 1.4 : 0.5;
    const sz = odd ? 0.5 : 1.4;
    placer.reserve(R(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2), y);
    box(k, px, y + 1.3, pz, sx, 2.6, sz, 'metal', {
      visible: false,
      walkable: false,
    });
  }
  box(
    k,
    x,
    y + 2.45,
    z,
    odd ? 1.4 : 3.2,
    0.3,
    odd ? 3.2 : 1.4,
    'metal',
    { visible: false, walkable: false },
  );
}

/**
 * Portal pancernej grodzi `lab_blast_door_frame` (`4.8 × 3.8 × 0.6 m`, `WALL_FIXTURES` / `PASSAGE_FIXTURES`):
 * dekoracja + niewidoczne kolidery bocznych ościeży (`0.4 × 3.4 × 0.6 m` na ±2.20 m)
 * oraz górnego nadproża (`4.8 × 0.4 × 0.6 m` na y + 3.60 m).
 * Światło przejścia w środku ma pełne 4.00 × 3.40 m (>= 2.0 m).
 */
export function blastDoorFrame(k, x, y, z, turn = 0) {
  const odd = Math.abs(turn) % 2 === 1;
  deco(k, 'lab_blast_door_frame', x, y, z, turn * Q);
  for (const side of [-1, 1]) {
    const px = odd ? x : x + side * 2.2;
    const pz = odd ? z + side * 2.2 : z;
    const sx = odd ? 0.6 : 0.4;
    const sz = odd ? 0.4 : 0.6;
    box(k, px, y + 1.7, pz, sx, 3.4, sz, 'metal', {
      visible: false,
      walkable: false,
    });
  }
  box(
    k,
    x,
    y + 3.6,
    z,
    odd ? 0.6 : 4.8,
    0.4,
    odd ? 4.8 : 0.6,
    'metal',
    { visible: false, walkable: false },
  );
}

/**
 * Kabina prysznica dekontaminacyjnego `lab_decon_shower` (`1.8 × 2.4 × 1.6 m`, `WALL_FIXTURES`):
 * dekoracja + 2 boczne niewidoczne kolidery ścianek (`0.12 × 2.4 × 1.6 m`).
 */
export function deconShower(k, placer, x, y, z, turn = 0) {
  const odd = Math.abs(turn) % 2 === 1;
  deco(k, 'lab_decon_shower', x, y, z, turn * Q);
  for (const side of [-1, 1]) {
    const px = odd ? x : x + side * 0.84;
    const pz = odd ? z + side * 0.84 : z;
    const sx = odd ? 1.6 : 0.12;
    const sz = odd ? 0.12 : 1.6;
    placer.reserve(R(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2), y);
    box(k, px, y + 1.2, pz, sx, 2.4, sz, 'glass_clear', {
      visible: false,
      walkable: false,
    });
  }
}

/**
 * Pancerne okno obserwacyjne `lab_observation_window` (`8.0 × 2.6 × 0.45 m`, `WALL_FIXTURES`):
 * dekoracja + niewidoczny blok kolizji `8.0 × 2.6 × 0.4 m` w otworze ściany.
 */
export function observationWindow(k, x, yBottom, z, yaw = 0) {
  deco(k, 'lab_observation_window', x, yBottom, z, yaw);
  box(k, x, yBottom + 1.3, z, 8, 2.6, 0.4, 'glass_clear', {
    visible: false,
    walkable: false,
  });
}

/**
 * Przemysłowa balustrada pomostu `lab_catwalk_rail` (`4.0 × 1.1 × 0.14 m`) na odcinku [a, b].
 * Pełne moduły 4 m używają modelu `lab_catwalk_rail`, krótsze odcinki domyka stalowa barierka.
 */
export function catwalkRail(k, axis, at, a, b, y) {
  const length = b - a;
  if (length < 0.2) return;
  const modules = Math.floor(length / 4 + 1e-6);
  const place = (from, to) => {
    const c = (from + to) / 2,
      l = to - from;
    const x = axis === 'x' ? c : at,
      z = axis === 'x' ? at : c;
    if (Math.abs(l - 4) < 1e-6) {
      prop(k, 'lab_catwalk_rail', x, z, y, axis === 'x' ? 0 : 1);
      return;
    }
    const sx = axis === 'x' ? l : 0.14,
      sz = axis === 'x' ? 0.14 : l;
    box(k, x, y + 0.075, z, sx, 0.15, sz, 'hazard', { walkable: false });
    box(
      k,
      x,
      y + 0.55,
      z,
      axis === 'x' ? l : 0.06,
      0.8,
      axis === 'x' ? 0.06 : l,
      'metal',
      { walkable: false },
    );
    box(
      k,
      x,
      y + 1.05,
      z,
      axis === 'x' ? l : 0.1,
      0.1,
      axis === 'x' ? 0.1 : l,
      'hivis',
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
 * Granice otworów drzwiowych leżą na pełnych metrach, bez zwężających słupków w świetle przejścia.
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
