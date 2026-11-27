// Wspólne stałe i pomocniki mapy run4 (Wieżowiec Korporacyjny Kurogane Arms — Piętra 60–62).
// Plik z prefiksem `_` nie jest generatorem; `build.mjs --run` go pomija.
import { readFileSync } from 'node:fs';
import { COLOR, R, vec } from './_runKit.mjs';

export { COLOR, R, vec };
export const Q = Math.PI / 2;
export const PI = Math.PI;

/** Poziomy posadzek 3 pięter biurowca oraz spoczników pośrednich klatek schodowych. */
export const Y_L0 = 0; // Piętro 60 (Lobby, Openspace, Korytarz Panoramowy, dół Atrium)
export const Y_M01 = 2.4; // Spoczniki pośrednie L0 <-> L1
export const Y_L1 = 4.8; // Piętro 61 (Sale Konferencyjne Aegis/Vanguard, Kuchnia, Serwerownia, Galerie L1)
export const Y_M12 = 7.2; // Spoczniki pośrednie L1 <-> L2
export const Y_L2 = 9.6; // Piętro 62 (Szklane Gabinety Kierownictwa, Foyer Zarządu, Gabinet Zarządu)

/** Wysokości spodów stropów poszczególnych stref (`ceiling: true`). */
export const Y_L0_CEIL = 4.8; // Strop nad południowym tarasem Piętra 60 (Z ∈ [8, 30])
export const Y_L1_CEIL = 9.6; // Strop nad Piętrem 61 (R4, R5 oraz zewnętrzne skrzydła R6, R7)
export const Y_L2_CEIL = 14.4; // Strop nad Szklanymi Gabinetami i Foyer (R8, R9: H = 4.8 m)
export const Y_R10_CEIL = 14.8; // Strop nad Gabinetem Zarządu (R10 Penthouse: H = 5.2 m)
export const Y_ATRIUM_CEIL = 15.2; // Świetlik / strop Centralnego Trzykondygnacyjnego Atrium A0

/** Grubości płyt stropowych i ścian działowych. */
export const SLAB = 0.4;
export const WALL_T = 0.4;

/** Materiały wykończeniowe biurowca korporacyjnego Kurogane Arms (F-04). */
export const MAT_CARPET = 'off_carpet_tile';
export const MAT_GRANITE = 'off_polished_granite';
export const MAT_WOOD_SLAT = 'off_wood_slat_wall';
export const MAT_GLASS = 'glass_clear';
export const MAT_CLEAN = 'lab_cleanroom_wall';
export const MAT_CEIL = 'mall_acoustic_ceiling';
export const MAT_INLAY = 'mall_terrazzo_inlay';
export const MAT_GRATING = 'steel_grating';

/** Prostokąty 10 pomieszczeń i Atrium zgodnie z tabelą §3.2 docs/maps/run4.md. */
export const ROOMS = {
  R1: R(-10, 10, 10, 30), // Recepcja i Lobby Główne (L0)
  R2: R(-30, -10, -2, 30), // Wielki Openspace Operacyjny (L0)
  R3: R(10, 30, -2, 30), // Korytarz Panoramowy i Strefa Analityków (L0)
  A0: R(-10, 10, -16, 10), // Centralne Trzykondygnacyjne Atrium (L0-L2)
  R4: R(-30, -10, -12, 8), // Wielka Sala Konferencyjna „Aegis” (L1 W)
  R5: R(10, 30, -12, 8), // Wielka Sala Konferencyjna „Vanguard” (L1 E)
  R6: R(-30, -10, -24, -12), // Kuchnia Korporacyjna i Strefa Socjalna „Sky Lounge” (L1 NW)
  R7: R(10, 30, -24, -12), // Serwerownia Biurowa i Centrum Reprografii (L1 NE)
  R8: R(-24, -10, -28, -16), // Szklane Gabinety Kierownictwa — Zachód (L2 W)
  R9: R(-10, 24, -28, -16), // Foyer Zarządu (-10..10) + Szklane Gabinety Kierownictwa — Wschód (10..24) (L2)
  R9_FOYER: R(-10, 10, -28, -16),
  R9_EAST: R(10, 24, -28, -16),
  R10: R(-24, 24, -42, -28), // Gabinet Zarządu Kurogane Arms „Penthouse Prezesa” (L2 N)
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

/** Dodaje objętość chronioną przed opadami deszczu (`rainShelters`) od `y0` do `y1`. */
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
 * Płyta stropowa ukrywana w ujęciach z góry (`ceiling: true`) + dopasowana bryła `rainShelters`.
 */
export function ceilingSlab(
  k,
  rect,
  yBottom,
  material = MAT_CEIL,
  thickness = SLAB,
  shelterBottom = Y_L0 - 0.5,
) {
  addRainShelter(k, rect, shelterBottom, yBottom + thickness + 0.2);
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
 * Kaseton sufitowy LED `off_ceiling_light_panel` (`2.4 × 0.30 × 1.2 m`, `CEILING_FIXTURES`):
 * montowany 0.30 m poniżej spodu stropu `ceilingY` (`mat_light_panel`, zero bloomu).
 */
export function ceilingLightPanel(k, x, ceilingY, z, yaw = 0) {
  return deco(k, 'off_ceiling_light_panel', x, ceilingY - 0.3, z, yaw);
}

/**
 * Reprezentacyjna oprawa lamelowa `off_linear_baffle_light` (`3.6 × 0.35 × 0.8 m`, `CEILING_FIXTURES`):
 * montowana 0.35 m poniżej spodu stropu `ceilingY`.
 */
export function linearBaffleLight(k, x, ceilingY, z, yaw = 0) {
  return deco(k, 'off_linear_baffle_light', x, ceilingY - 0.35, z, yaw);
}

/**
 * Ciepły panel świetlny `light_panel` wbudowany w sufit lub narożnik pod stropem (`ceilingY`),
 * rozjaśniający narożniki pomieszczeń bocznych i spody galerii bez stożków i bez bloomu.
 */
export function ceilingCovePanel(k, x, ceilingY, z, w, d) {
  return box(k, x, ceilingY - 0.02, z, w, 0.04, d, 'light_panel', {
    ceiling: true,
    walkable: false,
  });
}

/**
 * Niski stolik kawowy VIP z czarnego granitu, orzecha i ciepłej listwy `light_panel` (`wys. 0.48 m`).
 */
export function coffeeTable(k, placer, x, y, z, w = 2.0, d = 1.0) {
  placer.reserve(R(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y);
  box(k, x, y + 0.18, z, w - 0.24, 0.36, d - 0.24, MAT_WOOD_SLAT, {
    walkable: false,
  });
  box(k, x, y + 0.38, z, w - 0.08, 0.03, d - 0.08, 'light_panel', {
    walkable: false,
  });
  return box(k, x, y + 0.43, z, w, 0.08, d, MAT_GRANITE, {
    walkable: false,
  });
}

/**
 * Wolnostojąca ścianka akustyczna / osłona do walki na wysokości pasa (`wys. 1.15 m`).
 */
export function waistDivider(k, placer, x, y, z, w = 2.6, d = 0.32) {
  placer.reserve(R(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y);
  box(k, x, y + 0.08, z, w + 0.06, 0.16, d + 0.06, 'trim', {
    walkable: false,
  });
  box(k, x, y + 0.58, z, w, 0.86, d, MAT_WOOD_SLAT, {
    walkable: false,
  });
  box(k, x, y + 1.04, z, w + 0.04, 0.04, d + 0.02, 'light_panel', {
    walkable: false,
  });
  return box(k, x, y + 1.1, z, w + 0.08, 0.08, d + 0.06, MAT_GRANITE, {
    walkable: false,
  });
}

/**
 * Przycinane drzewko architektoniczne w donicy (pień + 3 piętra korony, wzorem Atrium Nova run2).
 */
export function planterTree(k, x, y, z) {
  box(k, x, y + 1.65, z, 0.16, 1.7, 0.16, 'wood', { walkable: false });
  for (const [cy, w, d] of [
    [y + 2.15, 1.65, 1.15],
    [y + 2.65, 1.3, 0.95],
    [y + 3.1, 0.85, 0.7],
  ]) {
    box(k, x, cy, z, w, 0.62, d, 'container_olive', { walkable: false });
  }
}

/**
 * Bramki optyczne kontroli dostępu VIP `off_security_turnstile` (`3.2 × 1.15 × 1.4 m`, `PASSAGE_FIXTURES`):
 * dekoracja + 2 boczne niewidoczne kolidery postumentów (`0.45 × 1.15 × 1.4 m` na ±1.35 m),
 * zostawiające pośrodku wolne przejście 2.25 m.
 */
export function securityTurnstile(k, placer, x, y, z, turn = 0) {
  const odd = Math.abs(turn) % 2 === 1;
  deco(k, 'off_security_turnstile', x, y, z, turn * Q);
  for (const side of [-1, 1]) {
    const px = odd ? x : x + side * 1.35;
    const pz = odd ? z + side * 1.35 : z;
    const sx = odd ? 1.4 : 0.45;
    const sz = odd ? 0.45 : 1.4;
    placer.reserve(R(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2), y);
    box(k, px, y + 0.575, pz, sx, 1.15, sz, 'metal', {
      visible: false,
      walkable: false,
    });
  }
}

/**
 * Portal wewnętrznej ścianki szklanej z rozsuniętymi drzwiami `off_glass_partition_door`
 * (`4.0 × 3.6 × 0.24 m`, `WALL_FIXTURES` / `PASSAGE_FIXTURES`):
 * dekoracja + 2 boczne niewidoczne kolidery skrzydeł stałych (`0.8 × 3.6 × 0.24 m` na ±1.60 m)
 * oraz nadproże (`4.0 × 0.4 × 0.24 m` na y + 3.40 m). Wolne przejście w środku: 2.40 × 3.20 m.
 */
export function glassPartitionDoor(k, placer, x, y, z, turn = 0) {
  const odd = Math.abs(turn) % 2 === 1;
  deco(k, 'off_glass_partition_door', x, y, z, turn * Q);
  for (const side of [-1, 1]) {
    const px = odd ? x : x + side * 1.6;
    const pz = odd ? z + side * 1.6 : z;
    const sx = odd ? 0.24 : 0.8;
    const sz = odd ? 0.8 : 0.24;
    placer.reserve(R(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2), y);
    box(k, px, y + 1.8, pz, sx, 3.6, sz, MAT_GLASS, {
      visible: false,
      walkable: false,
    });
  }
  box(
    k,
    x,
    y + 3.4,
    z,
    odd ? 0.24 : 4.0,
    0.4,
    odd ? 4.0 : 0.24,
    'metal',
    { visible: false, walkable: false },
  );
}

/**
 * Wewnętrzna szklana ścianka działowa `off_glass_partition_wall` (`4.0 × 3.6 × 0.18 m`).
 */
export function glassPartitionWall(k, placer, x, y, z, turn = 0) {
  return placer.prop('off_glass_partition_wall', x, z, y, turn);
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
 * Zewnętrzna szklana fasada kurtynowa 360° (`mat_glass_clear` + moduły `off_facade_mullion` co 4.0 m).
 * `outwardSign`: `-1` dla fasady północnej (-Z) lub zachodniej (-X); `+1` dla południowej (+Z) lub wschodniej (+X).
 */
export function glassFacade(
  k,
  axis,
  at,
  start,
  end,
  yBottom,
  yTop,
  outwardSign,
  openings = [],
) {
  // Tafla szkła `glass_clear` o grubości 0.16 m zapewnia przezierność na miasto, kolizję i oparcie dla mapAudit.
  segmentedWall(k, axis, at, start, end, yBottom, yTop, MAT_GLASS, openings, 0.16);
  const yaw =
    axis === 'x'
      ? outwardSign < 0
        ? 0
        : PI
      : outwardSign < 0
        ? Q
        : -Q;
  const gaps = openings.map(([a, b]) => [a, b]);
  for (const [s0, s1] of spans(start, end, gaps)) {
    const len = s1 - s0;
    const count = Math.floor(len / 4 + 1e-6);
    for (let y = yBottom; y + 4.8 <= yTop + 1e-5; y += 4.8) {
      for (let i = 0; i < count; i++) {
        const c = s0 + i * 4 + 2;
        const x = axis === 'x' ? c : at;
        const z = axis === 'x' ? at : c;
        deco(k, 'off_facade_mullion', x, y, z, yaw);
      }
    }
  }
}

/**
 * Szklana balustrada atrium `off_atrium_glass_rail` (`4.0 × 1.1 × 0.14 m`) na odcinku [a, b].
 * Pełne moduły 4 m używają modelu `off_atrium_glass_rail`, krótsze odcinki domyka tafla `glass_clear` z poręczą.
 */
export function atriumGlassRail(k, axis, at, a, b, y) {
  const length = b - a;
  if (length < 0.2) return;
  const modules = Math.floor(length / 4 + 1e-6);
  const place = (from, to) => {
    const c = (from + to) / 2,
      l = to - from;
    const x = axis === 'x' ? c : at,
      z = axis === 'x' ? at : c;
    if (Math.abs(l - 4) < 1e-6) {
      prop(k, 'off_atrium_glass_rail', x, z, y, axis === 'x' ? 0 : 1);
      return;
    }
    const sx = axis === 'x' ? l : 0.14,
      sz = axis === 'x' ? 0.14 : l;
    box(k, x, y + 0.08, z, sx, 0.16, sz, 'metal', { walkable: false });
    box(
      k,
      x,
      y + 0.58,
      z,
      axis === 'x' ? l : 0.05,
      0.86,
      axis === 'x' ? 0.05 : l,
      MAT_GLASS,
      { walkable: false },
    );
    box(
      k,
      x,
      y + 1.05,
      z,
      axis === 'x' ? l : 0.1,
      0.08,
      axis === 'x' ? 0.1 : l,
      'wood',
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
 * Reprezentacyjny bieg schodów w osi Z (`rotation.x`, nachylenie 25.64° <= 26.6°)
 * z bocznymi policzkami ze stali, listwami świetlnymi i poręczami z orzecha.
 * Poręcze są odsunięte na zewnątrz szerokości biegu i cofnięte o 0.45 m od progów.
 */
export function stairFlightWithRails(
  k,
  xCenter,
  width,
  yFrom,
  zFrom,
  yTo,
  zTo,
  ledMat = 'neon_amber',
) {
  k.p.ramp({
    from: vec(xCenter, yFrom, zFrom),
    to: vec(xCenter, yTo, zTo),
    width,
    material: 'tread_plate',
  });
  const z0 = Math.min(zFrom, zTo) + 0.45;
  const z1 = Math.max(zFrom, zTo) - 0.45;
  const run = z1 - z0;
  if (run <= 0.5) return;
  const totalRun = Math.abs(zTo - zFrom);
  const rise = ((yTo - yFrom) * run) / totalRun;
  const dz = Math.sign(zTo - zFrom);
  const angle = Math.atan2(yTo - yFrom, totalRun);
  const rx = -dz * angle;
  const len = Math.hypot(run, rise);
  const midY = (yFrom + yTo) / 2;
  const midZ = (zFrom + zTo) / 2;
  const ny = Math.cos(rx);
  const nz = Math.sin(rx);
  for (const side of [-1, 1]) {
    const x = xCenter + side * (width / 2 + 0.1);
    box(k, x, midY + ny * 0.1, midZ + nz * 0.1, 0.14, 0.22, len, 'trim', {
      rotation: vec(rx, 0, 0),
      walkable: false,
    });
    box(
      k,
      x - side * 0.02,
      midY + ny * 0.23,
      midZ + nz * 0.23,
      0.16,
      0.05,
      len,
      ledMat,
      {
        rotation: vec(rx, 0, 0),
        walkable: false,
      },
    );
    box(k, x, midY + ny * 0.94, midZ + nz * 0.94, 0.08, 0.08, len, 'wood', {
      rotation: vec(rx, 0, 0),
      walkable: false,
    });
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
