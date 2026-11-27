// Wspólne stałe i pomocniki mapy run6 (Rezydencja Pułkownika Kurogane Arms — Willa Kuroyama).
// Plik z prefiksem `_` nie jest generatorem; `build.mjs --run` go pomija.
import { readFileSync } from 'node:fs';
import { COLOR, R, vec } from './_runKit.mjs';

export { COLOR, R, vec };
export const Q = Math.PI / 2;
export const PI = Math.PI;

/** Poziomy posadzek 3 kondygnacji rezydencji oraz spoczników pośrednich klatek schodowych (§3.2). */
export const Y_B = -4.8; // Piwnica B (R13 Sala Tortur, R14 Winiarnia, R15 Bunkier Ochrony)
export const Y_MB0 = -2.4; // Spoczniki pośrednie B <-> L0 (Klatki #1 i #2)
export const Y_L0 = 0; // Parter L0 (R1 Hol, R2 Wielki Salon, R3 Jadalnia, R4 Kuchnia, R5 Basen, R6 Garaż, R7 Ochrona)
export const Y_M01 = 2.4; // Spoczniki pośrednie L0 <-> L1 (Klatki #3 i #4 w Salonie)
export const Y_L1 = 4.8; // Piętro L1 i Antresola Salonu (R2-M, R8 Biuro, R9 Biblioteka, R10 Trofea, R11 Sypialnia, R12 Spa)

/** Wysokości spodów stropów poszczególnych stref (`ceiling: true`). */
export const Y_B_CEIL = 0; // Strop / taras nad Piwnicą B (Z ∈ [16, 32])
export const Y_L0_CEIL = 4.8; // Strop nad pomieszczeniami bocznymi Parteru L0 (R1, R3, R4, R5, R6, R7)
export const Y_L1_CEIL = 9.6; // Strop nad Piętrem L1 (R8..R12)
export const Y_SALON_CEIL = 9.6; // Wysoki dach Dwukondygnacyjnego Salonu R2 (H = 9.60 m)

/** Grubości płyt stropowych i ścian działowych. */
export const SLAB = 0.4;
export const WALL_T = 0.4;

/** Materiały wykończeniowe luksusowej rezydencji Pułkownika Kurogane Arms (F-03, §4.3.A). */
export const MAT_CONCRETE = 'res_arch_concrete';
export const MAT_WALNUT = 'res_dark_walnut';
export const MAT_MARBLE = 'res_nero_marble';
export const MAT_CARPET = 'res_plush_carpet';
export const MAT_GLASS = 'glass_clear';
export const MAT_BUNKER = 'lab_bunker_concrete';
export const MAT_GRANITE = 'off_polished_granite';
export const MAT_WOOD_SLAT = 'off_wood_slat_wall';
export const MAT_CEIL = MAT_CONCRETE;
export const MAT_INLAY = 'mall_terrazzo_inlay';
export const MAT_GRATING = 'steel_grating';

/** Prostokąty wszystkich 15 pomieszczeń (`R1..R15`) oraz Antresoli Salonu (`R2_MEZZ`) zgodnie z §3.2 docs/maps/run6.md. */
export const ROOMS = {
  R1: R(-10, 10, 4, 16), // Hol Wejściowy i Foyer z Szatnią (L0)
  R2: R(-16, 16, -18, 4), // Wielki Dwukondygnacyjny Salon z Antresolą i Panoramą Lasu (L0 + L1)
  R2_MEZZ_N: R(-16, 16, -18, -15), // Galeria Północna Antresoli Salonu (L1)
  R2_MEZZ_W: R(-16, -12.8, -14.8, 4), // Galeria Zachodnia Antresoli Salonu (L1)
  R2_MEZZ_E: R(12.8, 16, -14.8, 4), // Galeria Wschodnia Antresoli Salonu (L1)
  R3: R(-30, -16, -6, 4), // Jadalnia Reprezentacyjna „Stół Koalicji” (L0 W)
  R4: R(-30, -16, -18, -6), // Nowoczesna Kuchnia i Spiżarnia Szefa Kuchni (L0 NW)
  R5: R(16, 30, -18, 4), // Kryty Basen i Ogród Zimowy „Pawilon Deszczu” (L0 E)
  R6: R(-30, -10, 4, 16), // Garaż Pancerny i Warsztat Pojazdowy (L0 SW)
  R7: R(10, 30, 4, 16), // Pokój Ochrony Parteru i Zbrojownia Straży (L0 SE)
  R8: R(-12, 12, -30, -18), // Biuro Pułkownika Vane'a „Gabinet Egzekutora” (L1 N-Center)
  R9: R(-30, -12, -30, -18), // Biblioteka i Archiwum Prywatne (L1 W)
  R10: R(12, 30, -30, -18), // Sala Trofeów i Kolekcja Ostrzy „Sanktuarium Kurogane” (L1 E)
  R11: R(-24, 4, -42, -30), // Sypialnia Pułkownika i Garderoba „Apartament Główny” (L1 NW)
  R12: R(4, 24, -42, -30), // Prywatne Spa, Sauna i Łazienka Marmurowa (L1 NE)
  R13: R(-28, -10, 16, 32), // Sala Tortur i Przesłuchań „Komora Wydobywania Danych” (Piwnica B SW)
  R14: R(-10, 10, 16, 32), // Prywatna Winiarnia i Degustatornia „Krypta Roczników” (Piwnica B Center)
  R15: R(10, 28, 16, 32), // Podziemny Bunkier Ochrony, Serwerownia i Śluza Ewakuacyjna (Piwnica B SE)
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
  // Jedna płaszczyzna posadzki: słoje i fugi daje tekstura, nie podział na bloki
  // (podział rysował kontur przerywanych czarnych linii).
  return k.solid(rect, y - thickness, y, material, {
    walkable: true,
    ...opts,
  });
}

/** Cienki dywan z orzechową bordiurą, bez stopnia na trasie ruchu. */
export function rug(k, x, z, y, w, d) {
  box(k, x, y - 0.013, z, w, 0.04, d, MAT_CARPET, { walkable: true });
  for (const side of [-1, 1]) {
    box(
      k,
      x + side * (w / 2 - 0.06),
      y + 0.008,
      z,
      0.06,
      0.002,
      d - 0.06,
      MAT_WALNUT,
      { walkable: true },
    );
    box(
      k,
      x,
      y + 0.008,
      z + side * (d / 2 - 0.06),
      w - 0.18,
      0.002,
      0.06,
      MAT_WALNUT,
      { walkable: true },
    );
  }
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
  const slab = k.solid(rect, yBottom, yBottom + thickness, material, {
    ceiling: true,
    walkable: false,
  });
  ceilingCoffers(
    k,
    rect,
    yBottom,
    yBottom > Y_B_CEIL ? MAT_WALNUT : MAT_CONCRETE,
  );
  return slab;
}

/** Kasetony z orzecha pod stropem: belki co ~3.2 m i obwodowy pas, żeby strop nie był czarną płaszczyzną. */
function ceilingCoffers(k, rect, yBottom, material) {
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  if (w < 4 || d < 4) return;
  const depth = 0.32;
  const y = yBottom - depth / 2;
  const opts = { ceiling: true, walkable: false };
  const beams = (lo, span) => {
    const n = Math.max(1, Math.round(span / 3.2));
    return Array.from({ length: n - 1 }, (_, i) => lo + ((i + 1) * span) / n);
  };
  for (const x of beams(rect.minX, w))
    box(
      k,
      x,
      y,
      (rect.minZ + rect.maxZ) / 2,
      0.22,
      depth,
      d - 0.4,
      material,
      opts,
    );
  for (const z of beams(rect.minZ, d))
    box(
      k,
      (rect.minX + rect.maxX) / 2,
      y,
      z,
      w - 0.4,
      depth,
      0.22,
      material,
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
  }
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

/** Zabudowa orzechowa o obrysie zastępowanego mebla, z kamiennym blatem. */
export function residenceCabinet(k, placer, model, x, z, y, turn = 0) {
  const d = dims(model);
  const odd = Math.abs(turn) % 2 === 1;
  const w = odd ? d.d : d.w,
    depth = odd ? d.w : d.d;
  placer.reserve(R(x - w / 2, x + w / 2, z - depth / 2, z + depth / 2), y);
  const body = d.h - 0.12;
  box(k, x, y + 0.035, z, w * 0.9, 0.07, depth * 0.9, 'trim');
  box(k, x, y + 0.07 + body / 2, z, w - 0.04, body, depth - 0.04, MAT_WALNUT);
  box(k, x, y + d.h - 0.025, z, w, 0.05, depth, MAT_MARBLE);
}

/** Dekoracja bez kolizji z punktem zaczepienia (x, y, z). */
export function deco(k, model, x, y, z, yaw = 0, scale) {
  return k.deco(model, x, y, z, yaw, scale);
}

/**
 * Wąska szczelina w suficie. Audyt z góry ukrywa ją razem ze stropem.
 */
export function recessedLedStrip(k, x, ceilingY, z, yaw = 0) {
  return ceilingCovePanel(
    k,
    x,
    ceilingY,
    z,
    yaw ? 0.06 : 1.4,
    yaw ? 1.4 : 0.06,
  );
}

/**
 * Reprezentacyjny żyrandol liniowy `res_chandelier_linear` (`3.6 × 0.45 × 0.9 m`, `CEILING_FIXTURES`):
 * montowany 0.45 m poniżej spodu stropu `ceilingY` (`mat_light_panel`).
 */
export function chandelierLinear(k, x, ceilingY, z, yaw = 0) {
  return deco(k, 'res_chandelier_linear', x, ceilingY - 0.45, z, yaw);
}

/**
 * Ciepły panel świetlny `light_panel` wbudowany w sufit lub narożnik pod stropem (`ceilingY`),
 * rozjaśniający obwód pomieszczeń i spody antresoli bez stożków i bez bloomu.
 */
export function ceilingCovePanel(k, x, ceilingY, z, w, d) {
  return box(k, x, ceilingY - 0.02, z, w, 0.04, d, 'light_panel', {
    ceiling: true,
    walkable: false,
  });
}

/**
 * Wolnostojąca ścianka / komoda osłonowa na wysokości pasa (`wys. 1.12 m`) z orzecha, marmuru i listwy `light_panel`.
 */
export function waistDivider(k, placer, x, y, z, w = 2.6, d = 0.36) {
  placer.reserve(R(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y);
  box(k, x, y + 0.08, z, w + 0.06, 0.16, d + 0.06, 'trim', {
    walkable: false,
  });
  box(k, x, y + 0.56, z, w, 0.82, d, MAT_WALNUT, {
    walkable: false,
  });
  box(k, x, y + 1.0, z, w + 0.04, 0.04, d + 0.02, 'light_panel', {
    walkable: false,
  });
  return box(k, x, y + 1.06, z, w + 0.08, 0.08, d + 0.06, MAT_MARBLE, {
    walkable: false,
  });
}

/**
 * Bramka biometryczna rezydencji VIP `res_biometric_arch` (`3.4 × 2.7 × 1.2 m`, `PASSAGE_FIXTURES`):
 * dekoracja + 2 boczne niewidoczne kolidery pylonów (`0.45 × 2.7 × 1.2 m` na ±1.475 m),
 * zostawiające pośrodku wolne przejście 2.50 m.
 */
export function biometricArch(k, placer, x, y, z, turn = 0) {
  const odd = Math.abs(turn) % 2 === 1;
  deco(k, 'res_biometric_arch', x, y, z, turn * Q);
  for (const side of [-1, 1]) {
    const px = odd ? x : x + side * 1.475;
    const pz = odd ? z + side * 1.475 : z;
    const sx = odd ? 1.2 : 0.45;
    const sz = odd ? 0.45 : 1.2;
    placer.reserve(R(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2), y);
    box(k, px, y + 1.35, pz, sx, 2.7, sz, 'metal', {
      visible: false,
      walkable: false,
    });
  }
}

/**
 * Portal drzwiowy rezydencji `res_interior_door_frame` (`4.0 × 3.6 × 0.28 m`, `WALL_FIXTURES` / `PASSAGE_FIXTURES`):
 * dekoracja + 2 boczne niewidoczne kolidery ościeży (`0.50 × 3.6 × 0.28 m` na ±1.75 m)
 * oraz nadproże (`4.0 × 0.4 × 0.28 m` na y + 3.40 m). Wolne przejście w środku: 3.00 × 3.20 m.
 */
export function interiorDoorFrame(k, placer, x, y, z, turn = 0) {
  const odd = Math.abs(turn) % 2 === 1;
  deco(k, 'res_interior_door_frame', x, y, z, turn * Q);
  for (const side of [-1, 1]) {
    const px = odd ? x : x + side * 1.75;
    const pz = odd ? z + side * 1.75 : z;
    const sx = odd ? 0.28 : 0.5;
    const sz = odd ? 0.5 : 0.28;
    placer.reserve(R(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2), y);
    box(k, px, y + 1.8, pz, sx, 3.6, sz, MAT_WALNUT, {
      visible: false,
      walkable: false,
    });
  }
  box(k, x, y + 3.4, z, odd ? 0.28 : 4.0, 0.4, odd ? 4.0 : 0.28, 'metal', {
    visible: false,
    walkable: false,
  });
}

/**
 * Stalowa krata celi przetrzymywania `res_holding_cage_bars` (`4.0 × 3.4 × 0.22 m`, `WALL_FIXTURES` / `PASSAGE_FIXTURES`):
 * dekoracja + 2 boczne kolidery kraty poza otwartymi drzwiami celi (prześwit w środku 2.00 m).
 */
export function holdingCageBars(k, placer, x, y, z, turn = 0) {
  const odd = Math.abs(turn) % 2 === 1;
  deco(k, 'res_holding_cage_bars', x, y, z, turn * Q);
  for (const side of [-1, 1]) {
    const px = odd ? x : x + side * 1.5;
    const pz = odd ? z + side * 1.5 : z;
    const sx = odd ? 0.22 : 1.0;
    const sz = odd ? 1.0 : 0.22;
    placer.reserve(R(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2), y);
    box(k, px, y + 1.7, pz, sx, 3.4, sz, 'metal', {
      visible: false,
      walkable: false,
    });
  }
  box(k, x, y + 3.25, z, odd ? 0.22 : 4.0, 0.3, odd ? 4.0 : 0.22, 'metal', {
    visible: false,
    walkable: false,
  });
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

/** Okładziny na pełnych odcinkach ścian; otwory i tafle pozostają odsłonięte. */
function wallFinishes(k, axis, at, a, b, y, thickness) {
  const levels = [
    [Y_L0, ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']],
    [Y_L1, ['R2', 'R8', 'R9', 'R10', 'R11', 'R12']],
    [Y_B, ['R13', 'R14', 'R15']],
  ];
  const rooms = levels.find(([floor]) => Math.abs(floor - y) < 0.01)?.[1];
  if (!rooms) return;
  for (const side of [-1, 1]) {
    const normal = at + side * (thickness / 2 + 0.08);
    for (const id of rooms) {
      const r = ROOMS[id];
      const inside =
        axis === 'x'
          ? normal > r.minZ && normal < r.maxZ
          : normal > r.minX && normal < r.maxX;
      if (!inside) continue;
      const lo = Math.max(a, axis === 'x' ? r.minX : r.minZ) + 0.04;
      const hi = Math.min(b, axis === 'x' ? r.maxX : r.maxZ) - 0.04;
      if (hi - lo < 0.3) continue;
      const technical = ['R6', 'R7', 'R13', 'R15'].includes(id);
      const stone = ['R4', 'R5', 'R10', 'R12'].includes(id);
      const face = at + side * (thickness / 2 + 0.025);
      const panel = technical ? MAT_BUNKER : stone ? MAT_MARBLE : MAT_WALNUT;
      const strip = (from, to, height, h, depth, material, offset = 0) =>
        box(
          k,
          axis === 'x' ? (from + to) / 2 : face + side * offset,
          y + height,
          axis === 'x' ? face + side * offset : (from + to) / 2,
          axis === 'x' ? to - from : depth,
          h,
          axis === 'x' ? depth : to - from,
          material,
          { walkable: false },
        );
      strip(lo, hi, 1.72, 2.92, 0.04, panel);
      strip(lo, hi, 0.12, 0.24, 0.06, MAT_MARBLE);
      // Ciemna wnęka i cofnięta ciepła listwa nad panelami na wysokości oczu.
      strip(lo, hi, 3.26, 0.16, 0.06, 'trim');
      strip(lo + 0.06, hi - 0.06, 3.24, 0.035, 0.025, 'light_panel', 0.034);
      const pitch = technical ? 1.8 : stone ? 2.0 : 1.2;
      for (let c = lo + 0.12; c < hi - 0.08; c += pitch)
        strip(
          c - 0.025,
          c + 0.025,
          1.72,
          2.92,
          0.055,
          technical ? 'metal' : 'trim',
          0.03,
        );
      if (!technical && !stone && hi - lo > 1.5) {
        for (const end of [lo, hi - 0.64])
          for (let i = 0; i < 4; i++)
            strip(
              end + i * 0.16,
              end + i * 0.16 + 0.085,
              1.72,
              2.92,
              0.09,
              MAT_WALNUT,
              0.065,
            );
      }
    }
  }
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
    if (mat !== MAT_GLASS && hi - lo >= 3.2)
      wallFinishes(k, axis, at, a, b, lo, thickness);
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
 * Zewnętrzna panoramiczna fasada szklana z widokiem na las (`mat_glass_clear` + moduły `res_forest_glass_facade` co 4.0 m).
 * `outwardSign`: `-1` dla fasady północnej (-Z) lub zachodniej (-X); `+1` dla południowej (+Z) lub wschodniej (+X).
 */
export function forestGlassFacade(
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
  const glassOpenings = [...openings];
  const yaw =
    axis === 'x' ? (outwardSign < 0 ? 0 : PI) : outwardSign < 0 ? Q : -Q;
  const gaps = openings.map(([a, b]) => [a, b]);
  for (const [s0, s1] of spans(start, end, gaps)) {
    const len = s1 - s0;
    const count = Math.floor(len / 4 + 1e-6);
    const coveredTop =
      yBottom + Math.floor((yTop - yBottom) / 4.8 + 1e-6) * 4.8;
    if (count && coveredTop > yBottom) {
      // Model ma własną szybę. Pełne moduły potrzebują tylko niewidocznej kolizji.
      const end = s0 + count * 4;
      glassOpenings.push([s0, end, yBottom, coveredTop]);
      const rect =
        axis === 'x'
          ? R(s0, end, at - 0.08, at + 0.08)
          : R(at - 0.08, at + 0.08, s0, end);
      solid(k, rect, yBottom, coveredTop, MAT_GLASS, {
        visible: false,
        walkable: false,
      });
    }
    for (let y = yBottom; y + 4.8 <= yTop + 1e-5; y += 4.8) {
      for (let i = 0; i < count; i++) {
        const c = s0 + i * 4 + 2;
        const x = axis === 'x' ? c : at;
        const z = axis === 'x' ? at : c;
        deco(k, 'res_forest_glass_facade', x, y, z, yaw);
      }
    }
  }
  segmentedWall(
    k,
    axis,
    at,
    start,
    end,
    yBottom,
    yTop,
    MAT_GLASS,
    glassOpenings,
    0.16,
  );
}

/**
 * Szklana balustrada antresoli i schodów `res_glass_balustrade` (`4.0 × 1.1 × 0.16 m`) na odcinku [a, b].
 * Pełne moduły 4 m używają modelu `res_glass_balustrade`, krótsze odcinki domyka tafla `glass_clear` z poręczą.
 */
export function glassBalustrade(k, axis, at, a, b, y) {
  const length = b - a;
  if (length < 0.2) return;
  const modules = Math.floor(length / 4 + 1e-6);
  const place = (from, to) => {
    const c = (from + to) / 2,
      l = to - from;
    const x = axis === 'x' ? c : at,
      z = axis === 'x' ? at : c;
    if (Math.abs(l - 4) < 1e-6) {
      prop(k, 'res_glass_balustrade', x, z, y, axis === 'x' ? 0 : 1);
      return;
    }
    const sx = axis === 'x' ? l : 0.16,
      sz = axis === 'x' ? 0.16 : l;
    box(k, x, y + 0.08, z, sx, 0.16, sz, 'metal', { walkable: false });
    box(
      k,
      x,
      y + 0.58,
      z,
      axis === 'x' ? l : 0.06,
      0.86,
      axis === 'x' ? 0.06 : l,
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
