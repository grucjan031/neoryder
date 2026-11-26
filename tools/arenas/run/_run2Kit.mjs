// Wspólne stałe i pomocniki mapy run2 (galeria „Atrium Nova”). Plik z `_` nie jest generatorem.
import { readFileSync } from 'node:fs';
import { COLOR, R, vec } from './_runKit.mjs';

export { COLOR, R, vec };
export const Q = Math.PI / 2;
/** Posadzki kondygnacji L0, L1, L2. */
export const LEVELS = [0, 5.2, 10.4];
/** Wysokość kondygnacji w świetle (od posadzki do spodu stropu). */
export const STORY = 4.8;
/** Grubość płyty stropowej (L0: fundament 1 m). */
export const SLAB = 0.4;
/** Spód płyty dachu nad L2. */
export const ROOF = 15.6;
/** Linia pasażu: lico sklepów po bokach (|x|) i na północy (|z|). */
export const FRONT = 18;
export const NORTH = 25;
/** Wysokość w świetle kondygnacji: L2 sięga stropu dachu (5,2 m), niższe 4,8 m. */
export const storyH = (level) => (level === 2 ? ROOF - LEVELS[2] : STORY);

const measured = JSON.parse(
  readFileSync(
    new URL('../../../src/data/render/mapModelBounds.json', import.meta.url),
    'utf8',
  ),
);

/** Wymiary AABB modelu i przesunięcie środka względem punktu zaczepienia. */
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

/** Blok-prostopadłościan o podanym środku. */
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

/** Płyta chodzenia z wierzchem na y (domyślnie grubość SLAB). */
export function deck(k, rect, y, material, thickness = SLAB, opts = {}) {
  return k.solid(rect, y - thickness, y, material, { walkable: true, ...opts });
}

/**
 * Rekwizyt z kolizją i modelem (instancja). Środek AABB modelu = środek bloku, więc dla modeli
 * niewycentrowanych w Z (ściana obuwnicza, szafka) używaj dekoracji.
 * `turn`: obrót o 90° (rotation.y = turn * π/2). Przód modelu +Z obraca się w (sin, cos).
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
export function deco(k, model, x, y, z, yaw = 0) {
  return k.deco(model, x, y, z, yaw);
}

/**
 * Szklana balustrada na odcinku [a, b] wzdłuż osi (`x`: z = at; `z`: x = at).
 * Pełne moduły 4 m to model `mall_glass_rail`; reszta to tafla `glass_clear` z poręczą i cokołem.
 */
export function glassRail(k, axis, at, a, b, y) {
  const length = b - a;
  if (length < 0.2) return;
  const modules = Math.floor(length / 4 + 1e-6);
  const place = (from, to) => {
    const c = (from + to) / 2,
      l = to - from;
    const x = axis === 'x' ? c : at,
      z = axis === 'x' ? at : c;
    if (Math.abs(l - 4) < 1e-6) {
      prop(k, 'mall_glass_rail', x, z, y, axis === 'x' ? 0 : 1);
      return;
    }
    const sx = axis === 'x' ? l : 0.14,
      sz = axis === 'x' ? 0.14 : l;
    box(k, x, y + 0.06, z, sx, 0.12, sz, 'trim');
    box(
      k,
      x,
      y + 0.58,
      z,
      axis === 'x' ? l : 0.05,
      0.92,
      axis === 'x' ? 0.05 : l,
      'glass_clear',
    );
    box(
      k,
      x,
      y + 1.06,
      z,
      axis === 'x' ? l : 0.1,
      0.08,
      axis === 'x' ? 0.1 : l,
      'metal',
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

/** Odcinki [a, b] bez przerw `gaps` (lista [od, do]). */
export function spans(a, b, gaps) {
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
 * Układ lokalny sklepu. `u` = głębokość od linii pasażu w głąb sklepu, `v` = położenie wzdłuż
 * fasady względem środka `c`. Bok W/E: fasada przy |x| = 18, N: fasada przy z = -25.
 */
export function makeFrame(side, level, c) {
  const y0 = LEVELS[level];
  const front = { W: Q, E: -Q, N: 0 }[side];
  const at = (u, v) => {
    if (side === 'W') return { x: -FRONT - u, z: c + v };
    if (side === 'E') return { x: FRONT + u, z: c + v };
    return { x: c + v, z: -NORTH - u };
  };
  const rect = (u0, u1, v0, v1) => {
    const a = at(u0, v0),
      b = at(u1, v1);
    return R(
      Math.min(a.x, b.x),
      Math.max(a.x, b.x),
      Math.min(a.z, b.z),
      Math.max(a.z, b.z),
    );
  };
  return { side, level, c, y0, front, at, rect };
}

/** Tint nieczerwonych barw w danych: kolory z COLOR plus ciepłe odcienie. */
export const PALETTE = [
  COLOR.amber,
  COLOR.green,
  COLOR.violet,
  COLOR.blue,
  COLOR.warm,
];

/** Rejestr zajętych rzutów: zabrania nakładania się rekwizytów na tym samym poziomie. */
export function createPlacer(k) {
  const taken = [];
  const hit = (rect, level) =>
    taken.find(
      (t) =>
        t.level === level &&
        rect.minX < t.maxX &&
        rect.maxX > t.minX &&
        rect.minZ < t.maxZ &&
        rect.maxZ > t.minZ,
    );
  return {
    taken,
    reserve(rect, y = 0) {
      taken.push({ ...rect, level: Math.round(y * 10) });
    },
    /** Rekwizyt z kolizją; błąd, jeśli nachodzi na zarezerwowany rzut. */
    prop(model, x, z, y = 0, turn = 0, opts = {}) {
      const d = dims(model);
      const odd = Math.abs(turn) % 2 === 1;
      const sx = (odd ? d.d : d.w) / 2,
        sz = (odd ? d.w : d.d) / 2;
      const rect = R(x - sx, x + sx, z - sz, z + sz);
      const other = hit(rect, Math.round(y * 10));
      if (other)
        throw new Error(
          `${model} (${x}, ${z}, y=${y}) nachodzi na (${other.minX}…${other.maxX}, ${other.minZ}…${other.maxZ}).`,
        );
      taken.push({ ...rect, level: Math.round(y * 10) });
      return prop(k, model, x, z, y, turn, opts);
    },
    free(x, z, y = 0, pad = 0.8) {
      return !hit(R(x - pad, x + pad, z - pad, z + pad), Math.round(y * 10));
    },
  };
}
