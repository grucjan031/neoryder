/**
 * Dachy Starego Miasta (arenaRooftops) — ADR 0011, przebudowa 300×260 m.
 *
 * Dzielnica kamienic na kwartałach: ulice na dnie (y = −14), dachy na 0 / 4 / 8 / 12 m.
 * Generator najpierw opisuje działki (prostokąty z wysokością dachu), ulice, punkty
 * i połączenia, a dopiero potem buduje bryły, płyty dachów i parapety z mapy wysokości.
 * Każdy kwartał ma osobną funkcję definicji (`…Lots`) i oprawy (`…Dress`).
 *
 * Osie: X na wschód, Z na południe (północ = −Z). Jednostki: metry.
 */
import { createArena, vec } from './lib/arena.mjs';
import { createPrimitives } from './lib/prims.mjs';

const ID = 'arenaRooftops';
const STREET = -14;
const CURB = -13.85;
const SLAB = 0.4;
const PARAPET = 1.1;
const HOUSE = 3.2;
const BOUNDS = rect(-150, 150, -130, 130);
const LIGHT = {
  amber: '#ffae1a',
  green: '#6dff4a',
  violet: '#8a5cff',
  blue: '#3d7bff',
  white: '#fff1d6',
};
const TURN = Math.PI / 2;

/** Wymiary AABB modeli (docs/assets.md); bloki z modelem muszą im odpowiadać. */
const MODELS = {
  city_dumpster: [1.97, 1.33, 1.08],
  city_vending: [1.014, 2, 0.816],
  city_barrier: [2, 0.929, 0.51],
  city_car: [4.42, 1.46, 1.94],
  city_stall: [3, 2.622, 2.043],
  city_crates: [1.212, 1.59, 1.256],
  city_generator: [1.6, 1.4, 1.005],
  city_kiosk: [0.8, 2.235, 0.624],
  city_wrecked_car: [2.15, 1.58, 3.95],
  city_roof_water_tank: [3, 5, 3],
  city_roof_hvac_unit: [4, 1.998, 2.052],
  city_market_stall_canopy: [3.024, 2.612, 2],
  city_market_stall_canopy_violet: [3.024, 2.612, 2],
  city_neon_sign_frame: [6, 3, 1.8],
  city_satellite_cluster: [3, 3.4, 2],
  city_smog_scrubber: [3, 4, 3],
  roof_chimney_stack: [2, 3, 1],
  roof_skylight: [3, 0.8, 2],
  roof_stairwell_hut: [3.2, 3, 4.5],
  hw_fire_barrel: [0.622, 1.42, 0.614],
  hw_camp_tent_dome: [3.28, 1.281, 2.87],
  hw_camp_tent_ridge: [2.202, 1.739, 3.95],
  hw_camp_shack: [3.1, 2.4, 2.617],
  build_scaffold_bay: [2.5, 3.1, 1.2],
};

// ------------------------------------------------------------------ geometria

function rect(minX, maxX, minZ, maxZ) {
  return { minX, maxX, minZ, maxZ };
}
const inside = (r, x, z, m = 0) =>
  x > r.minX + m && x < r.maxX - m && z > r.minZ + m && z < r.maxZ - m;
const overlap = (a, b, m = 0) =>
  a.minX < b.maxX + m &&
  a.maxX > b.minX - m &&
  a.minZ < b.maxZ + m &&
  a.maxZ > b.minZ - m;
const contains = (outer, r, m = 0) =>
  r.minX >= outer.minX + m &&
  r.maxX <= outer.maxX - m &&
  r.minZ >= outer.minZ + m &&
  r.maxZ <= outer.maxZ - m;
const around = (x, z, sx, sz) =>
  rect(x - sx / 2, x + sx / 2, z - sz / 2, z + sz / 2);
const rectDistance = (r, x, z) =>
  Math.hypot(
    Math.max(r.minX - x, 0, x - r.maxX),
    Math.max(r.minZ - z, 0, z - r.maxZ),
  );

/** Prostokąt minus otwory: rozłączne kawałki (pasy wzdłuż Z, potem reszta). */
function subtract(r, holes) {
  let pieces = [{ ...r }];
  for (const h of holes) {
    const next = [];
    for (const p of pieces) {
      const c = rect(
        Math.max(p.minX, h.minX),
        Math.min(p.maxX, h.maxX),
        Math.max(p.minZ, h.minZ),
        Math.min(p.maxZ, h.maxZ),
      );
      if (c.maxX - c.minX < 1e-6 || c.maxZ - c.minZ < 1e-6) {
        next.push(p);
        continue;
      }
      if (c.minX - p.minX > 1e-6) next.push({ ...p, maxX: c.minX });
      if (p.maxX - c.maxX > 1e-6) next.push({ ...p, minX: c.maxX });
      if (c.minZ - p.minZ > 1e-6)
        next.push({ ...c, minZ: p.minZ, maxZ: c.minZ });
      if (p.maxZ - c.maxZ > 1e-6)
        next.push({ ...c, minZ: c.maxZ, maxZ: p.maxZ });
    }
    pieces = next;
  }
  return pieces;
}

// ------------------------------------------------------------------ świat

function createWorld() {
  const arena = createArena({
    id: ID,
    name: 'Dachy Starego Miasta',
    theme: 'neonStreet',
    weather: 'drizzleWind',
    seed: 'arena-rooftops-v2',
    bounds: BOUNDS,
  });
  return {
    arena,
    p: createPrimitives(arena),
    rng: arena.rng,
    lots: new Map(),
    streets: [],
    openings: [],
    occupied: [],
    protect: [],
    masses: [],
    faces: [],
    signs: [],
    decals: [],
    fx: [],
    shelters: [],
    spawns: [],
  };
}

function checkFinite(value, label) {
  if (!Number.isFinite(value))
    throw new Error(`Nieskończona wartość: ${label}.`);
  return value;
}

function box(w, r, y0, y1, material, opts = {}) {
  for (const v of [r.minX, r.maxX, r.minZ, r.maxZ, y0, y1])
    checkFinite(v, `blok ${JSON.stringify(r)} ${y0}..${y1}`);
  return w.arena.block({
    size: vec(r.maxX - r.minX, y1 - y0, r.maxZ - r.minZ),
    position: vec((r.minX + r.maxX) / 2, (y0 + y1) / 2, (r.minZ + r.maxZ) / 2),
    material,
    ...opts,
  });
}

function slab(
  w,
  r,
  top,
  material,
  { thickness = SLAB, walkable = true, visible } = {},
) {
  return box(w, r, top - thickness, top, material, {
    walkable,
    ...(visible === false ? { visible: false } : {}),
  });
}

/** Linie cięcia płyt co `tile` m, przesunięte poza koła punktów i spawnów. */
function cuts(w, min, max, axis, y, tile) {
  const guards = w.protect
    .filter((g) => Math.abs(g.y - y) < 0.6)
    .map((g) => [g[axis] - g.r - 0.5, g[axis] + g.r + 0.5]);
  const out = [min];
  let t = min + tile;
  while (t < max - 4) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const [lo, hi] of guards)
        if (t > lo && t < hi) {
          t = Math.ceil(hi);
          moved = true;
        }
    }
    if (t >= max - 4) break;
    out.push(t);
    t += tile;
  }
  out.push(max);
  return out;
}

function tiledSlab(w, r, y, material, opts = {}, tile = 26) {
  const xs = cuts(w, r.minX, r.maxX, 'x', y, tile);
  const zs = cuts(w, r.minZ, r.maxZ, 'z', y, tile);
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < zs.length; j++)
      slab(w, rect(xs[i - 1], xs[i], zs[j - 1], zs[j]), y, material, opts);
}

function lot(w, id, rects, o) {
  const value = {
    id,
    rects,
    roof: o.roof,
    tall: o.tall,
    wall: o.wall ?? 'facade',
    roofMat: o.roofMat ?? 'roof_tar',
    parapetMat: o.parapetMat ?? 'concrete',
    zone: o.zone,
    holes: [],
    roofHoles: [],
    extraMass: [],
  };
  w.lots.set(id, value);
  return value;
}

function street(w, r, y, material) {
  w.streets.push({ r, y, material });
}

function heightAt(w, x, z) {
  for (const l of w.lots.values())
    for (const r of l.rects) if (inside(r, x, z)) return l.roof ?? l.tall;
  for (const s of w.streets) if (inside(s.r, x, z)) return s.y;
  return -Infinity;
}

function lotAt(w, x, z) {
  for (const l of w.lots.values())
    for (const r of l.rects) if (inside(r, x, z)) return l;
  return undefined;
}

const occupy = (w, r, y) => w.occupied.push({ r, y });

function isFree(w, r, y, margin = 1.6) {
  return (
    !w.occupied.some(
      (o) => Math.abs(o.y - y) < 2.5 && overlap(o.r, r, margin),
    ) &&
    !w.protect.some(
      (g) =>
        Math.abs(g.y - y) < 2.5 && rectDistance(r, g.x, g.z) < g.r + margin,
    )
  );
}

/** Rekwizyt: blok z modelem (obrót 0/π) albo dekoracja z niewidoczną kolizją (±90°). */
function prop(
  w,
  model,
  x,
  y,
  z,
  turn = 0,
  { collide = true, instance = false } = {},
) {
  const [sx, sy, sz] = MODELS[model];
  const swap = turn % 2 === 1;
  const fx = swap ? sz : sx,
    fz = swap ? sx : sz;
  if (!collide) w.arena.decor(model, vec(x, y, z), turn * TURN);
  else if (!swap)
    w.arena.block({
      size: vec(sx, sy, sz),
      position: vec(x, y + sy / 2, z),
      model,
      ...(turn === 2 ? { rotation: vec(0, Math.PI, 0) } : {}),
      ...(instance ? { instance: true } : {}),
    });
  else {
    w.arena.decor(model, vec(x, y, z), turn * TURN);
    w.arena.block({
      size: vec(fx, sy, fz),
      position: vec(x, y + sy / 2, z),
      visible: false,
    });
  }
  const footprint = around(x, z, fx, fz);
  occupy(w, footprint, y);
  return footprint;
}

/** Rekwizyt na dachu, jeśli mieści się na działce, poza otworami, punktami i zajętymi miejscami. */
function tryProp(w, l, model, x, z, turn, margin = 1.8) {
  const [sx, , sz] = MODELS[model];
  const r = around(x, z, turn % 2 ? sz : sx, turn % 2 ? sx : sz);
  if (!l.rects.some((lr) => contains(lr, r, 1.5))) return false;
  if (l.roofHoles.some((h) => overlap(h, r, 1.5))) return false;
  if (!isFree(w, r, l.roof, margin)) return false;
  prop(w, model, x, l.roof, z, turn);
  return true;
}

const SHED = {
  nw: 'flood_brick_algae',
  nm: 'plaster',
  ne: 'corrugated',
  sw: 'corrugated',
  sm: 'plaster',
  market: 'corrugated',
};

/** Komórka/nadbudówka na dachu z bloków: osłona i przerwa linii widoku, drzwi i klimatyzator. */
function tryShed(w, l, x, z, turn) {
  const sx = 4 + Math.floor(w.rng() * 4),
    sz = 3 + Math.floor(w.rng() * 2),
    h = 2.6 + Math.round(w.rng() * 6) / 10;
  const [fx, fz] = turn % 2 ? [sz, sx] : [sx, sz];
  const r = around(x, z, fx, fz);
  if (!l.rects.some((lr) => contains(lr, r, 1.5))) return false;
  if (l.roofHoles.some((hole) => overlap(hole, r, 1.5))) return false;
  if (!isFree(w, r, l.roof, 1.8)) return false;
  box(w, r, l.roof, l.roof + h, SHED[l.zone] ?? 'plaster');
  box(
    w,
    rect(r.minX - 0.2, r.maxX + 0.2, r.minZ - 0.2, r.maxZ + 0.2),
    l.roof + h,
    l.roof + h + 0.2,
    'roof_tar',
  );
  const side = ['n', 's', 'w', 'e'][Math.floor(w.rng() * 4)];
  const { yaw } = FACE[side];
  const [dx, dz] =
    side === 'n'
      ? [x, r.minZ]
      : side === 's'
        ? [x, r.maxZ]
        : side === 'w'
          ? [r.minX, z]
          : [r.maxX, z];
  decor(w, 'city_door', dx, l.roof, dz, yaw);
  if (w.rng() < 0.5)
    decor(
      w,
      'city_ac_unit',
      side === 'n' || side === 's' ? r.minX + 0.8 : dx,
      l.roof + 1.4,
      side === 'n' || side === 's' ? dz : r.minZ + 0.8,
      yaw,
    );
  occupy(w, r, l.roof);
  return true;
}

function pick(w, set) {
  const total = set.reduce((sum, [, weight]) => sum + weight, 0);
  let t = w.rng() * total;
  for (const [model, weight] of set) if ((t -= weight) <= 0) return model;
  return set.at(-1)[0];
}

/** Rozsiew rekwizytów zestawu strefy w siatce z rozrzutem; ogranicza otwarte połacie. */
function scatterRoof(w, id, set, spacing = 10) {
  const l = w.lots.get(id);
  const sheds = [['shed', 2], ...set];
  for (const r of l.rects)
    for (let gx = r.minX + spacing / 2; gx < r.maxX - 2; gx += spacing)
      for (let gz = r.minZ + spacing / 2; gz < r.maxZ - 2; gz += spacing)
        for (let attempt = 0; attempt < 4; attempt++) {
          const x = Math.round((gx + (w.rng() - 0.5) * spacing * 0.6) * 2) / 2;
          const z = Math.round((gz + (w.rng() - 0.5) * spacing * 0.6) * 2) / 2;
          const model = pick(w, sheds);
          const turn = Math.floor(w.rng() * 4);
          if (
            model === 'shed'
              ? tryShed(w, l, x, z, turn)
              : tryProp(w, l, model, x, z, turn)
          )
            break;
        }
}

/** Niskie ściany ogniowe między działkami tej samej wysokości (przerwy co kilka metrów). */
function buildFireWalls(w) {
  for (const l of w.lots.values()) {
    if (l.roof === undefined) continue;
    for (const r of l.rects)
      for (const side of ['s', 'e']) {
        const horizontal = side === 's';
        const [a, b] = horizontal ? [r.minX, r.maxX] : [r.minZ, r.maxZ];
        const edge = side === 's' ? r.maxZ : r.maxX;
        const runs = [];
        let start = null;
        for (let t = a; t <= b; t += 1) {
          const mid = t + 0.5;
          const [ox, oz] = horizontal ? [mid, edge + 0.3] : [edge + 0.3, mid];
          const other = t < b ? lotAt(w, ox, oz) : undefined;
          const shared = other && other !== l && other.roof === l.roof;
          if (shared && start === null) start = t;
          if (!shared && start !== null) {
            runs.push([start, t]);
            start = null;
          }
        }
        for (const [ra, rb] of runs) {
          if (rb - ra < 14) continue;
          for (let t = ra + 4; t + 6 <= rb - 4; t += 11) {
            const wr = horizontal
              ? rect(t, t + 6, edge - 0.25, edge + 0.25)
              : rect(edge - 0.25, edge + 0.25, t, t + 6);
            if (!isFree(w, wr, l.roof, 1.2)) continue;
            box(
              w,
              wr,
              l.roof,
              l.roof + 1.2,
              l.zone === 'ne' ? 'concrete' : 'flood_brick_algae',
            );
            occupy(w, wr, l.roof);
          }
        }
      }
  }
}

function decor(w, model, x, y, z, yaw = 0, scale) {
  w.arena.decor(model, vec(x, y, z), yaw, scale ? { scale } : {});
}

/** Światło z puli; plama na podłodze pod nim (domyślnie dach lub ulica z mapy wysokości). */
function light(w, x, y, z, color, floorY, intensity = 30, range = 16, flicker) {
  const floor = checkFinite(floorY ?? heightAt(w, x, z), `światło ${x},${z}`);
  // Lampy dachowe wiszą na masztach ok. 4 m nad papą: plama światła nie przepala nawierzchni.
  const height = floorY === undefined ? Math.max(y, floor + 4.2) : y;
  w.arena.light(
    vec(x, height, z),
    color,
    floorY === undefined ? Math.min(intensity, 26) : intensity,
    range,
    {
      floorY: floor,
      ...(flicker ? { flicker } : {}),
    },
  );
}

function sign(w, texture, x, y, z, yaw, width, height, tint, kind = 'neon') {
  w.signs.push({
    kind,
    texture,
    position: vec(x, y, z),
    size: { w: width, h: height },
    yaw,
    ...(tint ? { tint } : {}),
  });
}

const FACE = {
  n: { yaw: Math.PI, out: [0, -1] },
  s: { yaw: 0, out: [0, 1] },
  w: { yaw: -TURN, out: [-1, 0] },
  e: { yaw: TURN, out: [1, 0] },
};

/** Naklejka ścienna tylko na jednej bryle masy kamienicy (test cityDecalBounds). */
function wallDecal(w, texture, x, y, z, side, width, height) {
  const { yaw, out } = FACE[side];
  const decal = {
    texture,
    position: vec(x + out[0] * 0.05, y, z + out[1] * 0.05),
    size: { w: width, h: height },
    yaw,
    surface: 'wall',
  };
  const fits = w.masses.some((m) => {
    const face =
      side === 'n'
        ? m.r.minZ
        : side === 's'
          ? m.r.maxZ
          : side === 'w'
            ? m.r.minX
            : m.r.maxX;
    const along =
      side === 'n' || side === 's'
        ? [m.r.minX, m.r.maxX, x]
        : [m.r.minZ, m.r.maxZ, z];
    const at = side === 'n' || side === 's' ? z : x;
    return (
      Math.abs(at - face) < 0.01 &&
      along[2] - width / 2 >= along[0] &&
      along[2] + width / 2 <= along[1] &&
      y - height / 2 >= m.y0 &&
      y + height / 2 <= m.y1
    );
  });
  if (fits) w.decals.push(decal);
}

// ------------------------------------------------------------------ kwartały: działki

/** Pas brzegowy: wysokie, niedostępne kamienice zamykające północ i narożniki. */
function edgeLots(w) {
  const tall = { wall: 'facade', roofMat: 'roof_tar' };
  lot(w, 'edgeNW', [rect(-150, -56, -130, -112)], { ...tall, tall: 18 });
  lot(w, 'edgeN1', [rect(-56, -20, -130, -118)], { ...tall, tall: 16 });
  lot(w, 'edgeN2', [rect(-20, 60, -130, -112)], { ...tall, tall: 18 });
  lot(w, 'edgeNE', [rect(60, 150, -130, -118)], { ...tall, tall: 20 });
  lot(w, 'edgeNE2', [rect(124, 150, -118, -98)], {
    ...tall,
    tall: 20,
    wall: 'plaster',
  });
  lot(w, 'edgeW', [rect(-150, -132, -112, -92)], { ...tall, tall: 18 });
  lot(w, 'edgeSE', [rect(120, 150, 100, 130)], { ...tall, tall: 16 });
  // Wcięcia obrysu: narożne kamienice przy wylotach ulicy i na południu.
  lot(w, 'edgeS', [rect(-20, 20, 120, 130)], {
    ...tall,
    tall: 16,
    wall: 'plaster',
  });
  lot(w, 'edgeSW', [rect(-150, -138, 10, 34)], { ...tall, tall: 18 });
  lot(w, 'edgeE', [rect(140, 150, 10, 100)], { ...tall, tall: 18 });
  lot(w, 'edgeNE3', [rect(140, 150, -34, -10)], { ...tall, tall: 20 });
  lot(w, 'edgeNW2', [rect(-150, -140, -36, -10)], {
    ...tall,
    tall: 18,
    wall: 'flood_brick_algae',
  });
}

/** Kwartał Zegarowy (NW): kamień i cegła, kominy; wieża zegarowa na dachu 8 m. */
function northWestLots(w) {
  const o = { wall: 'facade', parapetMat: 'canal_stone_wall', zone: 'nw' };
  lot(w, 'nwHigh', [rect(-150, -124, -92, -36), rect(-132, -124, -112, -92)], {
    ...o,
    roof: 12,
  });
  lot(w, 'clock', [rect(-124, -80, -112, -56)], {
    ...o,
    roof: 8,
    wall: 'canal_stone_wall',
  });
  lot(w, 'nwEast', [rect(-80, -56, -112, -56)], { ...o, roof: 4 });
  lot(w, 'nwMid', [rect(-124, -70, -56, -36), rect(-70, -64, -50, -36)], {
    ...o,
    roof: 4,
  });
  lot(w, 'nwStreetW', [rect(-140, -110, -36, -10)], {
    ...o,
    roof: 0,
    wall: 'flood_brick_algae',
  });
  lot(w, 'nwStreetE', [rect(-110, -64, -36, -10)], { ...o, roof: 4 });
}

/** Środek północy: tynk i cegła, pranie na dachach, schodkowe tarasy 0–12 m. */
function northMiddleLots(w) {
  const o = { wall: 'plaster', parapetMat: 'concrete', zone: 'nm' };
  lot(w, 'nmSW', [rect(-56, -14, -36, -10)], { ...o, roof: 0, wall: 'facade' });
  lot(w, 'nmSE', [rect(-14, 44, -36, -10)], { ...o, roof: 4, wall: 'facade' });
  lot(w, 'nmMid', [rect(-56, 0, -76, -36)], { ...o, roof: 4 });
  lot(w, 'nmTall', [rect(0, 44, -90, -36)], { ...o, roof: 8, wall: 'facade' });
  lot(w, 'nmNorth', [rect(-56, -20, -118, -76), rect(-20, 0, -112, -76)], {
    ...o,
    roof: 8,
  });
  lot(w, 'nmHigh', [rect(0, 44, -112, -90)], {
    ...o,
    roof: 12,
    wall: 'facade',
  });
}

/** Kwartał Szyldu (NE): nowsze bloki z betonu, blacha i maszyny; gigantyczny szyld na 12 m. */
function northEastLots(w) {
  const o = {
    wall: 'concrete',
    roofMat: 'roof_hvac_metal',
    parapetMat: 'trim',
    zone: 'ne',
  };
  lot(w, 'neWest', [rect(44, 64, -112, -40)], {
    ...o,
    roof: 4,
    wall: 'facade',
  });
  lot(w, 'neNorth', [rect(60, 124, -118, -112), rect(64, 124, -112, -100)], {
    ...o,
    roof: 8,
    wall: 'plaster',
  });
  lot(w, 'sign', [rect(64, 112, -100, -50)], {
    ...o,
    roof: 12,
    roofMat: 'corrugated',
  });
  lot(w, 'neEast', [rect(112, 150, -98, -34), rect(112, 124, -100, -98)], {
    ...o,
    roof: 8,
    wall: 'facade',
  });
  lot(w, 'neMid', [rect(64, 112, -50, -34)], {
    ...o,
    roof: 8,
    wall: 'plaster',
  });
  lot(w, 'neStreetW', [rect(50, 86, -34, -10), rect(50, 64, -40, -34)], {
    ...o,
    roof: 4,
    wall: 'facade',
  });
  lot(w, 'neStreetM', [rect(86, 122, -34, -10)], {
    ...o,
    roof: 0,
    wall: 'facade',
    roofMat: 'roof_tar',
  });
  lot(w, 'neStreetE', [rect(122, 140, -34, -10)], { ...o, roof: 8 });
}

/** Południowy zachód: zawilgocona cegła, dzikie obozowisko na niskich dachach (start gracza). */
function southWestLots(w) {
  const o = {
    wall: 'flood_brick_algae',
    parapetMat: 'flood_brick_algae',
    zone: 'sw',
  };
  lot(w, 'swCorner', [rect(-138, -100, 10, 46), rect(-150, -138, 34, 46)], {
    ...o,
    roof: 8,
    wall: 'facade',
  });
  lot(w, 'swNorth', [rect(-100, -64, 10, 52)], { ...o, roof: 0 });
  lot(w, 'swWest', [rect(-150, -100, 46, 92), rect(-100, -84, 52, 92)], {
    ...o,
    roof: 4,
    wall: 'facade',
  });
  lot(w, 'swSouth', [rect(-150, -36, 92, 130)], { ...o, roof: 0 });
}

/** Środek południa: kamienice w remoncie (rusztowania, materiały budowlane na dachach). */
function southMiddleLots(w) {
  const o = { wall: 'facade', parapetMat: 'concrete', zone: 'sm' };
  lot(w, 'smA', [rect(-56, 20, 10, 52)], { ...o, roof: 0 });
  lot(w, 'smB', [rect(-36, -10, 52, 100)], { ...o, roof: 4, wall: 'plaster' });
  lot(w, 'smC', [rect(-10, 20, 52, 100)], { ...o, roof: 8 });
  lot(w, 'smD', [rect(-36, -20, 100, 130), rect(-20, 20, 100, 120)], {
    ...o,
    roof: 4,
    wall: 'flood_brick_algae',
  });
}

/** Nocny targ (A) na największym dachu i wschodnie kamienice. */
function marketLots(w) {
  const o = { parapetMat: 'canal_stone_wall', zone: 'market' };
  lot(w, 'market', [rect(20, 110, 16, 100), rect(92, 110, 10, 16)], {
    ...o,
    roof: 0,
    roofMat: 'boardwalk_planks',
  });
  lot(w, 'marketLand', [rect(76, 92, 10, 16)], {
    ...o,
    roof: 0,
    roofMat: 'canal_stone_wall',
  });
  lot(w, 'seA', [rect(110, 140, 10, 60)], {
    ...o,
    roof: 8,
    wall: 'plaster',
    parapetMat: 'concrete',
  });
  lot(w, 'seB', [rect(110, 140, 60, 100)], {
    ...o,
    roof: 4,
    parapetMat: 'concrete',
  });
  lot(w, 'seC', [rect(20, 120, 100, 130)], {
    ...o,
    roof: 4,
    wall: 'flood_brick_algae',
  });
}

/** Ulice na dnie: główna z targiem, zaułek przy x = −60, podwórze, placyk, pasaż, uliczka. */
function streetLots(w) {
  for (const [minX, maxX, material] of [
    [-150, -40, 'asphalt'],
    [-40, 40, 'asphalt'],
    [40, 150, 'asphalt'],
  ])
    street(w, rect(minX, maxX, -6, 6), STREET, material);
  street(w, rect(-150, 150, -10, -6), CURB, 'paving');
  street(w, rect(-150, 150, 6, 10), CURB, 'paving');
  street(w, rect(20, 76, 10, 16), CURB, 'paving'); // podnóże Schodów Targowych
  street(w, rect(-64, -56, -50, -10), STREET, 'paving'); // zaułek północny
  street(w, rect(-70, -56, -56, -50), STREET, 'paving'); // placyk przy Klatce Zegarowej
  street(w, rect(-64, -56, 10, 52), STREET, 'paving'); // zaułek południowy
  street(w, rect(-84, -36, 52, 92), STREET, 'concrete'); // podwórze (D)
  street(w, rect(-44, -38, 10, 52), STREET, 'concrete'); // pasaż pod kamienicą
  street(w, rect(44, 50, -40, -10), STREET, 'asphalt'); // uliczka przy Kwartale Szyldu
}

// ------------------------------------------------------------------ połączenia

/** Klatka schodowa: trzon zabiegowy (biegi po 3 m, 10 stopni 1 m) z ulicy na dach i nadbudówka. */
function stairwell(
  w,
  { lot: lotId, axis, ox, oz, dir, yB, yT, entry, exit, name },
) {
  const l = w.lots.get(lotId);
  const laneW = 3.6,
    mid = 0.4,
    W = 2 * laneW + mid,
    land = 3,
    run = 10,
    L = 2 * land + run,
    T = 0.4;
  const n = Math.round((yT - yB) / 3);
  const hf = (yT - yB) / n,
    r = hf / run;
  const R = (a0, a1, c0, c1) => {
    const A0 = (axis === 'x' ? ox : oz) + dir * a0;
    const A1 = (axis === 'x' ? ox : oz) + dir * a1;
    const lo = Math.min(A0, A1),
      hi = Math.max(A0, A1);
    return axis === 'x'
      ? rect(lo, hi, oz + c0, oz + c1)
      : rect(ox + c0, ox + c1, lo, hi);
  };
  const P = (a, c, y) =>
    axis === 'x' ? vec(ox + dir * a, y, oz + c) : vec(ox + c, y, oz + dir * a);
  const outer = R(-T, L + T, -T, W + T);
  l.holes.push(outer);
  l.roofHoles.push(outer);
  slab(w, outer, yB, 'concrete', { thickness: 0.3 });
  for (let k = 0; k < n; k++) {
    const forward = k % 2 === 0;
    const c0 = forward ? 0 : laneW + mid;
    const y0 = yB + k * hf;
    for (let i = 0; i < run; i++) {
      const a0 = forward ? land + i : land + run - 1 - i;
      const top = y0 + (i + 1) * r;
      box(w, R(a0, a0 + 1, c0, c0 + laneW), top - r, top, 'concrete', {
        walkable: true,
      });
    }
    const [l0, l1] = forward ? [land + run, L] : [0, land];
    slab(w, R(l0, l1, 0, W), y0 + hf, 'concrete', { thickness: 0.3 });
  }
  const height = yT + HOUSE - yB;
  box(w, R(land, land + run, laneW, laneW + mid), yB, yT + HOUSE, 'plaster');
  const walls = {
    start: [P(-T / 2, -T, yB), P(-T / 2, W + T, yB), T],
    end: [P(L + T / 2, -T, yB), P(L + T / 2, W + T, yB), T],
    side0: [P(0, -T / 2, yB), P(L, -T / 2, yB), 0],
    side1: [P(0, W + T / 2, yB), P(L, W + T / 2, yB), 0],
  };
  const doors = { start: [], end: [], side0: [], side1: [] };
  doors[entry.wall].push({
    at: entry.at + walls[entry.wall][2],
    width: 3.2,
    height: 2.8,
    bottom: 0,
  });
  doors[exit.wall].push({
    at: exit.at + walls[exit.wall][2],
    width: 3.2,
    height: 2.6,
    bottom: yT - yB,
  });
  for (const [key, [from, to]] of Object.entries(walls))
    w.p.wall(from, to, height, T, 'plaster', { openings: doors[key] });
  // Próg drzwi wyjścia na dach: chodzona płyta w grubości ściany.
  const exitSpan = exit.wall.startsWith('side')
    ? [exit.at - 1.6, exit.at + 1.6]
    : null;
  const threshold = exitSpan
    ? R(
        exitSpan[0],
        exitSpan[1],
        exit.wall === 'side0' ? -T : W,
        exit.wall === 'side0' ? 0 : W + T,
      )
    : R(-T, 0, exit.at - 1.5, exit.at + 1.5);
  slab(w, threshold, yT, 'concrete', { thickness: 0.3 });
  slab(w, outer, yT + HOUSE + 0.3, 'roof_tar', {
    thickness: 0.3,
    walkable: false,
  });
  w.shelters.push({ r: outer, y0: yT, y1: yT + HOUSE + 0.3 });
  // Światła wnętrza (plama na dnie trzonu) i nad wyjściem.
  const c = P(L / 2, W / 2, yB + (yT - yB) / 2);
  light(w, c.x, c.y, c.z, LIGHT.white, yB, 26, 14, {
    pattern: 'buzz',
    strength: 0.25,
  });
  const top = P(1.5, W / 2, yT + 2.6);
  light(w, top.x, top.y, top.z, LIGHT.white, yT, 20, 8);
  // Rekwizyty nie zastawiają wejść.
  const doorOut = (wall, a, y, depth) => {
    const sideC = wall === 'side0' ? -T - depth : W + T;
    const r0 =
      wall === 'start'
        ? R(-T - depth, -T, a - 2, a + 2)
        : R(a - 2, a + 2, sideC, sideC + depth);
    occupy(w, r0, y);
    return r0;
  };
  doorOut(entry.wall, entry.at, yB, 5);
  const exitArea = doorOut(exit.wall, exit.at, yT, 5);
  occupy(w, outer, yT);
  occupy(w, outer, yB);
  w.stairwells = [...(w.stairwells ?? []), { name, outer, exitArea, yB, yT }];
  return { outer, exitArea };
}

/** Kamienne schody na niższym dachu, dochodzące do krawędzi wyższego (AI: 0,3 × 1 m). */
function roofStairs(
  w,
  { axis, line, at, dir, yL, yH, width = 4, material = 'canal_stone_wall' },
) {
  const n = Math.ceil((yH - yL) / 0.3 - 1e-9),
    r = (yH - yL) / n;
  const span = (s0, s1, half) => {
    const lo = Math.min(s0, s1),
      hi = Math.max(s0, s1);
    return axis === 'x'
      ? rect(lo, hi, at - half, at + half)
      : rect(at - half, at + half, lo, hi);
  };
  for (let k = 0; k < n; k++)
    box(
      w,
      span(line - dir * (n - k), line - dir * (n - k - 1), width / 2),
      yL,
      yL + (k + 1) * r,
      material,
      {
        walkable: true,
      },
    );
  w.openings.push(span(line - 1.2, line + 1.2, width / 2 + 1));
  occupy(w, span(line - dir * (n + 3), line, width / 2 + 0.5), yL);
  occupy(w, span(line, line + dir * 3, width / 2 + 0.5), yH);
}

/** Szeroki most z desek nad ulicą (AI): balustrady, dźwigary, latarnie na końcach. */
function plankBridge(w, { axis, at, from, to, y, width = 4.4 }) {
  const half = width / 2;
  const R = (a0, a1, c0, c1) =>
    axis === 'z'
      ? rect(at + c0, at + c1, a0, a1)
      : rect(a0, a1, at + c0, at + c1);
  slab(w, R(from, to, -half, half), y, 'boardwalk_planks', { thickness: 0.3 });
  for (const s of [-1, 1]) {
    const c = s < 0 ? [-half, -half + 0.15] : [half - 0.15, half];
    box(w, R(from, to, c[0], c[1]), y, y + PARAPET, 'metal');
    const g = s < 0 ? [-half + 0.1, -half + 0.5] : [half - 0.5, half - 0.1];
    box(w, R(from, to, g[0], g[1]), y - 1.1, y - 0.3, 'metal');
  }
  for (const end of [from, to]) {
    w.openings.push(R(end - 1.2, end + 1.2, -half - 0.9, half + 0.9));
  }
  occupy(w, R(from - 4, to + 4, -half - 0.5, half + 0.5), y);
  const midA = (from + to) / 2;
  const p = axis === 'z' ? [at, midA] : [midA, at];
  decor(w, 'city_lantern_string', p[0], y + 3.4, p[1], axis === 'z' ? TURN : 0);
  if (axis === 'z') light(w, p[0], y + 2.6, p[1], LIGHT.amber, y, 22, 12);
}

/** Kładka dachowa city_roof_bridge (8 m, przejście 1,4 m) — trasa gracza. */
function catwalk(w, { axis, at, center, y }) {
  const pos = axis === 'z' ? [at, center] : [center, at];
  decor(
    w,
    'city_roof_bridge',
    pos[0],
    y - 0.2,
    pos[1],
    axis === 'z' ? 0 : TURN,
  );
  const R = (a0, a1, c0, c1) =>
    axis === 'z'
      ? rect(at + c0, at + c1, a0, a1)
      : rect(a0, a1, at + c0, at + c1);
  slab(w, R(center - 4, center + 4, -0.8, 0.8), y, 'steel_grating', {
    thickness: 0.2,
    visible: false,
  });
  for (const c of [
    [-0.8, -0.7],
    [0.7, 0.8],
  ])
    box(w, R(center - 4, center + 4, c[0], c[1]), y, y + 1.19, 'metal', {
      visible: false,
    });
  for (const end of [center - 4, center + 4])
    w.openings.push(R(end - 1.2, end + 1.2, -1.3, 1.3));
  occupy(w, R(center - 6, center + 6, -1.5, 1.5), y);
}

/** Schody pożarowe na fasadzie (gracz): dwa pasy biegów 0,3 × 0,32 m, balkony city_fire_escape. */
function fireEscape(w, { face, line, t0, yB, yT }) {
  const sign = face === 's' || face === 'e' ? 1 : -1;
  const land = 1.4,
    stepD = 0.32,
    lane = 1.2;
  const n = Math.ceil((yT - yB) / 3.6 - 1e-9);
  const hf = (yT - yB) / n;
  const steps = Math.ceil(hf / 0.3 - 1e-9),
    r = hf / steps,
    run = steps * stepD,
    L = 2 * land + run;
  const R = (a0, a1, d0, d1) => {
    const D0 = line + sign * d0,
      D1 = line + sign * d1;
    const lo = Math.min(D0, D1),
      hi = Math.max(D0, D1);
    return face === 'n' || face === 's'
      ? rect(t0 + a0, t0 + a1, lo, hi)
      : rect(lo, hi, t0 + a0, t0 + a1);
  };
  for (let k = 0; k < n; k++) {
    const forward = k % 2 === 0;
    const d0 = forward ? 0 : lane;
    const y0 = yB + k * hf;
    for (let i = 0; i < steps; i++) {
      const a0 = forward ? land + i * stepD : land + run - (i + 1) * stepD;
      const top = y0 + (i + 1) * r;
      box(w, R(a0, a0 + stepD, d0, d0 + lane), top - 0.1, top, 'steel_grating');
    }
    const [l0, l1] = forward ? [land + run, L] : [0, land];
    box(w, R(l0, l1, 0, 2 * lane), y0 + hf - 0.1, y0 + hf, 'steel_grating');
    if (k < n - 1) {
      const c = R((l0 + l1) / 2 - 0.01, (l0 + l1) / 2 + 0.01, 0, 0.01);
      decor(
        w,
        'city_fire_escape',
        (c.minX + c.maxX) / 2,
        y0 + hf - 2.5,
        (c.minZ + c.maxZ) / 2,
        FACE[face].yaw,
      );
    }
    if (k === n - 1) w.openings.push(R(l0 - 0.3, l1 + 0.3, -1.5, 0.6));
  }
  occupy(w, R(-1, L + 1, 0, 2 * lane + 1), yB);
  const topLanding = n % 2 === 1 ? [land + run, L] : [0, land];
  occupy(w, R(topLanding[0] - 1, topLanding[1] + 1, -4, 0), yT);
}

/** Schody Targowe: monumentalny kamienny bieg wzdłuż fasady z ulicy na dach targu (AI). */
function marketStairs(w) {
  const n = 47,
    r = (0 - CURB) / n;
  for (let k = 0; k < n; k++)
    box(
      w,
      rect(29 + k, 30 + k, 10, 16),
      CURB,
      CURB + (k + 1) * r,
      'canal_stone_wall',
      { walkable: true },
    );
  const angle = Math.atan2(-CURB, n);
  w.arena.block({
    size: vec(Math.hypot(n, CURB), 0.12, 0.15),
    position: vec(29 + n / 2, CURB / 2 + 1, 10.1),
    rotation: vec(0, 0, angle),
    material: 'metal',
  });
  w.openings.push(rect(75, 77.2, 10, 16));
  occupy(w, rect(20, 92, 6, 16), CURB);
  occupy(w, rect(70, 96, 10, 22), 0);
  for (const x of [34, 70])
    light(
      w,
      x,
      CURB + ((x - 29) / n) * -CURB + 3.2,
      12,
      LIGHT.amber,
      CURB + ((x - 29) / n) * -CURB,
      24,
      10,
    );
}

/** Pasaż handlowy pod kamienicą smA: z ulicy głównej na zaułek/podwórze, sklepy po bokach. */
function passage(w) {
  const l = w.lots.get('smA');
  const r = rect(-44, -38, 10, 52);
  l.holes.push(r);
  l.extraMass.push({ r, y0: -9.5 });
  // Okładzina ścian pasażu (bez okien elewacji) i witryny sklepów.
  for (const [x0, x1] of [
    [-44, -43.9],
    [-38.1, -38],
  ])
    box(w, rect(x0, x1, 10, 52), STREET, -9.5, 'plaster');
  for (const [z, kind] of [
    [15, 'city_shutter'],
    [26, 'city_ad_screen'],
    [38, 'city_shutter'],
    [49, 'city_sign_box'],
  ])
    decor(w, kind, -43.9, kind === 'city_shutter' ? STREET : -11.6, z, TURN);
  for (const [z, kind] of [
    [17, 'city_ad_screen'],
    [27, 'city_shutter'],
    [41, 'city_shutter'],
  ])
    decor(w, kind, -38.1, kind === 'city_shutter' ? STREET : -11.6, z, -TURN);
  sign(w, 'noodles', -43.75, -10.6, 32, TURN, 2.2, 1.1, LIGHT.amber);
  sign(w, 'bar_24h', -38.25, -10.6, 46, -TURN, 2.2, 1.1, LIGHT.blue);
  for (const [z, c] of [
    [18, LIGHT.amber],
    [31, LIGHT.violet],
    [44, LIGHT.white],
  ])
    light(w, -41, -10.2, z, c, STREET, 16, 9, {
      pattern: 'buzz',
      strength: 0.3,
    });
  occupy(w, rect(-44, -38, 6, 14), STREET);
  occupy(w, rect(-44, -38, 48, 56), STREET);
}

function connections(w) {
  // Ulica ↔ dachy: trzy klatki przez wnętrza kamienic i Schody Targowe.
  stairwell(w, {
    name: 'Klatka Zegarowa',
    lot: 'nwEast',
    axis: 'z',
    ox: -67.6,
    oz: -56.4,
    dir: -1,
    yB: STREET,
    yT: 4,
    entry: { wall: 'start', at: 1.8 },
    exit: { wall: 'side0', at: 1.7 },
  });
  stairwell(w, {
    name: 'Klatka Podwórzowa',
    lot: 'smB',
    axis: 'x',
    ox: -35.6,
    oz: 60,
    dir: 1,
    yB: STREET,
    yT: 4,
    entry: { wall: 'start', at: 1.8 },
    exit: { wall: 'side1', at: 1.7 },
  });
  stairwell(w, {
    name: 'Klatka Szyldu',
    lot: 'neStreetW',
    axis: 'z',
    ox: 62,
    oz: -10.4,
    dir: -1,
    yB: STREET,
    yT: 4,
    entry: { wall: 'start', at: 1.8 },
    exit: { wall: 'side0', at: 1.7 },
  });
  marketStairs(w);
  passage(w);
  // Dachy ↔ dachy: schody 4 m (14 stopni po 1 m) między poziomami.
  const s = (axis, line, at, dir, yL, yH, material) =>
    roofStairs(w, { axis, line, at, dir, yL, yH, material });
  s('x', -110, -22, 1, 0, 4); // nwStreetW → nwStreetE
  s('z', -56, -102, -1, 4, 8); // nwMid → zegar
  s('x', -80, -94, -1, 4, 8); // nwEast → zegar
  s('x', -124, -64, -1, 8, 12); // zegar → nwHigh
  s('x', -14, -22, 1, 0, 4, 'concrete'); // nmSW → nmSE
  s('z', -36, -48, -1, 0, 4, 'concrete'); // nmSW → nmMid
  s('z', -76, -28, -1, 4, 8, 'concrete'); // nmMid → nmNorth
  s('z', -36, 22, -1, 4, 8, 'concrete'); // nmSE → nmTall
  s('z', -90, 32, -1, 8, 12, 'concrete'); // nmTall → nmHigh
  s('x', 44, -68, -1, 4, 8, 'steel_grating'); // neWest → nmTall
  s('z', -34, 76, -1, 4, 8, 'steel_grating'); // neStreetW → neMid
  s('z', -50, 96, -1, 8, 12, 'steel_grating'); // neMid → szyld
  s('x', 86, -28, -1, 0, 4, 'steel_grating'); // neStreetM → neStreetW
  s('x', 112, -78, -1, 8, 12, 'steel_grating'); // neEast → szyld
  s('z', 52, -94, 1, 0, 4); // swNorth → swWest
  s('z', 46, -128, -1, 4, 8); // swWest → swCorner
  s('z', 92, -118, -1, 0, 4); // swSouth → swWest
  s('x', -36, 116, 1, 0, 4); // swSouth → smD
  s('z', 52, -28, 1, 0, 4, 'concrete'); // smA → smB
  s('x', -10, 82, 1, 4, 8, 'concrete'); // smB → smC
  s('z', 100, 102, 1, 0, 4); // targ → seC
  s('x', 110, 64, 1, 0, 4); // targ → seB
  s('z', 60, 132, -1, 4, 8, 'concrete'); // seB → seA
  // Mosty z desek (AI) nad ulicą główną, zaułkami i uliczką.
  plankBridge(w, { axis: 'z', at: -32, from: -10, to: 10, y: 0 });
  plankBridge(w, { axis: 'z', at: 100, from: -10, to: 10, y: 0 });
  plankBridge(w, { axis: 'x', at: 32, from: -64, to: -56, y: 0 });
  plankBridge(w, { axis: 'x', at: -44, from: -64, to: -56, y: 4 });
  plankBridge(w, { axis: 'x', at: -22, from: 44, to: 50, y: 4 });
  // Kładki city_roof_bridge (gracz).
  catwalk(w, { axis: 'x', at: 44.5, center: -60, y: 0 });
  catwalk(w, { axis: 'x', at: -32, center: 47, y: 4 });
  catwalk(w, { axis: 'z', at: -69, center: -53, y: 4 });
  // Schody pożarowe (gracz): ulica ↔ dachy.
  fireEscape(w, { face: 's', line: -10, t0: -52, yB: CURB, yT: 0 });
  fireEscape(w, { face: 'w', line: -56, t0: 18, yB: STREET, yT: 0 });
  fireEscape(w, { face: 'e', line: -84, t0: 68, yB: STREET, yT: 4 });
  fireEscape(w, { face: 'w', line: 50, t0: -19, yB: STREET, yT: 4 });
  fireEscape(w, { face: 'n', line: 10, t0: 6, yB: CURB, yT: 0 });
}

// ------------------------------------------------------------------ punkty i spawny

const POINTS = [
  ['A', 60, 0, 60],
  ['B', -95, 8, -75],
  ['C', 0, STREET, 0],
  ['D', -60, STREET, 70],
  ['E', 80, 12, -70],
];
const PLAYER = vec(-140, 0, 120);

/** Pula posiłków: ulice, podwórze, pasaż i dachy wszystkich wysokości, z dala od startu. */
const SPAWNS = [
  [-128, STREET, 2],
  [-92, STREET, -3],
  [-24, STREET, 0],
  [28, STREET, 0],
  [72, STREET, -2],
  [128, STREET, 2],
  [-60, STREET, 26],
  [-60, STREET, -26],
  [-78, STREET, 86],
  [-46, STREET, 56],
  [47, STREET, -32],
  [-41, STREET, 38],
  [-40, 0, -24],
  [110, 0, -20],
  [0, 0, 32],
  [106, 0, 82],
  [30, 0, 32],
  [-82, 0, 26],
  [-80, 0, 112],
  [-130, 0, -24],
  [-108, 4, -44],
  [-70, 4, -100],
  [-20, 4, -58],
  [51, 4, -84],
  [80, 4, -26],
  [-125, 4, 76],
  [-26, 4, 90],
  [70, 4, 118],
  [128, 4, 86],
  [-10, 4, 112],
  [-112, 8, -70],
  [22, 8, -62],
  [-36, 8, -100],
  [132, 8, -70],
  [132, 8, 32],
  [5, 8, 78],
  [-125, 8, 28],
  [90, 8, -110],
  [-138, 12, -62],
  [22, 12, -102],
  [100, 12, -90],
];
/** Spawny roomSchema (XZ na wysokości startu), połączone płasko z dachem startowym. */
const ROOM_SPAWNS = [
  [-112, 102],
  [-90, 122],
  [-66, 104],
  [-50, 124],
];

function pointsAndSpawns(w) {
  for (const [id, x, y, z] of POINTS) {
    w.arena.point(id, vec(x, y, z), 5);
    w.protect.push({ x, y, z, r: 6.5 });
  }
  for (const [x, y, z] of SPAWNS) {
    w.spawns.push({ x, y, z });
    w.protect.push({ x, y, z, r: 1.6 });
  }
  for (const [x, z] of ROOM_SPAWNS) {
    w.arena.spawn(vec(x, 0, z));
    w.protect.push({ x, y: 0, z, r: 1.6 });
  }
  w.protect.push({ x: PLAYER.x, y: PLAYER.y, z: PLAYER.z, r: 2.5 });
  w.arena.arenaMeta({
    spawnPoints: w.spawns,
    spawnRing: { minM: 25, maxM: 90 },
    maxAlive: 12,
    enemyTickets: 190,
    // Komórki scalania 200 m (ćwiartki mapy razem z oprawą) i rekwizyty bez instancji: tysiąc
    // modeli scala się według materiału zamiast setek partii InstancedMesh (wywołania rysowania, ADR D8).
    batchCellM: 200,
  });
}

// ------------------------------------------------------------------ bryły, dachy, parapety

function buildLots(w) {
  for (const l of w.lots.values()) {
    const top = l.roof ?? l.tall;
    for (const r of l.rects) {
      for (const piece of subtract(r, l.holes)) {
        box(w, piece, STREET, top - SLAB, l.wall);
        w.masses.push({ r: piece, y0: STREET, y1: top - SLAB });
      }
      for (const { r: extra, y0 } of l.extraMass)
        if (overlap(extra, r)) {
          box(w, extra, y0, top - SLAB, l.wall);
          w.masses.push({ r: extra, y0, y1: top - SLAB });
        }
      for (const piece of subtract(r, l.roofHoles))
        tiledSlab(w, piece, top, l.roofMat, { walkable: l.roof !== undefined });
      w.shelters.push({ r, y0: STREET, y1: top });
    }
  }
  for (const s of w.streets)
    tiledSlab(
      w,
      s.r,
      s.y,
      s.material,
      { thickness: s.y === CURB ? 0.15 : SLAB },
      30,
    );
}

/** Parapety tam, gdzie za krawędzią dachu jest niżej; przerwy przy połączeniach. Zapis fasad. */
function buildParapets(w) {
  for (const l of w.lots.values()) {
    const top = l.roof ?? l.tall;
    for (const r of l.rects)
      for (const side of ['n', 's', 'w', 'e']) {
        const horizontal = side === 'n' || side === 's';
        const [a, b] = horizontal ? [r.minX, r.maxX] : [r.minZ, r.maxZ];
        const edge = { n: r.minZ, s: r.maxZ, w: r.minX, e: r.maxX }[side];
        const out = side === 'n' || side === 'w' ? -1 : 1;
        let start = null,
          startFace = null,
          faceLow = null;
        const point = (t, d) =>
          horizontal ? [t, edge + out * d] : [edge + out * d, t];
        const flush = (end) => {
          if (start !== null && l.roof !== undefined) {
            const r0 = horizontal
              ? rect(
                  start,
                  end,
                  out < 0 ? edge : edge - 0.4,
                  out < 0 ? edge + 0.4 : edge,
                )
              : rect(
                  out < 0 ? edge : edge - 0.4,
                  out < 0 ? edge + 0.4 : edge,
                  start,
                  end,
                );
            box(w, r0, top, top + PARAPET, l.parapetMat);
          }
          start = null;
        };
        const flushFace = (end) => {
          // Lica na obwiedni (za nimi nic nie ma) nie dostają oprawy.
          if (
            startFace !== null &&
            end - startFace > 0.9 &&
            Number.isFinite(faceLow)
          )
            w.faces.push({
              lot: l,
              side,
              edge,
              a: startFace,
              b: end,
              low: faceLow,
              high: top,
            });
          startFace = null;
        };
        for (let t = a; t < b - 1e-6; t += 0.5) {
          const mid = Math.min(t + 0.25, b - 0.01);
          const [ox, oz] = point(mid, 0.3);
          const [ix, iz] = point(mid, -0.3);
          const low = heightAt(w, ox, oz);
          const lower = low < top - 0.5;
          if (lower && (startFace === null || low !== faceLow)) {
            flushFace(t);
            startFace = t;
            faceLow = low;
          } else if (!lower) flushFace(t);
          const need =
            lower &&
            !w.openings.some((o) => inside(o, ix, iz) || inside(o, ox, oz)) &&
            !l.roofHoles.some((h) => inside(h, ix, iz, -0.5));
          if (need && start === null) start = t;
          if (!need) flush(t);
        }
        flush(b);
        flushFace(b);
      }
  }
}

function checkCoverage(w) {
  let holes = 0;
  for (let x = BOUNDS.minX + 0.5; x < BOUNDS.maxX; x += 1)
    for (let z = BOUNDS.minZ + 0.5; z < BOUNDS.maxZ; z += 1)
      if (heightAt(w, x, z) === -Infinity) holes++;
  if (holes)
    throw new Error(
      `Rzut ma ${holes} m² bez działki i ulicy (dziura w świecie).`,
    );
}

// ------------------------------------------------------------------ oprawa stref

const NEON = [
  ['ramen', LIGHT.amber],
  ['bar_mleczny', LIGHT.white],
  ['pharmacy', LIGHT.green],
  ['karaoke', LIGHT.violet],
  ['hotel', LIGHT.blue],
  ['noodles', LIGHT.amber],
  ['kebab', LIGHT.amber],
  ['tattoo', LIGHT.violet],
  ['arcade', LIGHT.blue],
  ['sake', LIGHT.white],
  ['beer', LIGHT.amber],
  ['cat_cafe', LIGHT.violet],
  ['repair', LIGHT.green],
  ['warsztat', LIGHT.amber],
  ['open', LIGHT.green],
  ['iskra', LIGHT.violet],
  ['bar_24h', LIGHT.blue],
  ['cocktail', LIGHT.violet],
  ['implants', LIGHT.blue],
  ['metro', LIGHT.white],
];

/** Parter i elewacje: rolety, drzwi, markizy, szyldy, klimatyzatory i rury na fasadach. */
function dressFacades(w) {
  let signIndex = 0;
  for (const f of w.faces) {
    const { side, edge, low, high } = f;
    const { yaw, out } = FACE[side];
    const horizontal = side === 'n' || side === 's';
    const at = (t, d = 0) =>
      horizontal ? [t, edge + out[1] * d] : [edge + out[0] * d, t];
    const length = f.b - f.a;
    const streetLevel = low <= CURB + 0.01;
    if (streetLevel && length >= 6) {
      // Witryny co 7 m: roleta albo drzwi, nad nimi markiza; co trzecia ma neon.
      for (let t = f.a + 3.5; t < f.b - 3; t += 7) {
        const [x, z] = at(t);
        if (
          !isFree(w, around(x + out[0] * 1, z + out[1] * 1, 3.5, 3.5), low, 0)
        )
          continue;
        const roll = w.rng();
        decor(w, roll < 0.55 ? 'city_shutter' : 'city_door', x, low, z, yaw);
        if (roll < 0.35)
          decor(w, 'city_awning', ...[at(t)[0], low + 3.1, at(t)[1]], yaw);
        if (w.rng() < 0.06) {
          const [texture, tint] = NEON[signIndex++ % NEON.length];
          const [sx, sz] = at(t, 0.12);
          sign(w, texture, sx, low + 4.4, sz, yaw, 2.6, 1.3, tint);
        } else if (w.rng() < 0.3)
          decor(w, 'city_sign_box', x, low + 3.6, z, yaw);
      }
    }
    // Wyżej: klimatyzatory, rury spustowe, ekrany reklam, balkony pożarowe.
    const tallFace = high - low;
    if (tallFace < 3.5) continue;
    for (let t = f.a + 2 + w.rng() * 5; t < f.b - 2; t += 8 + w.rng() * 7) {
      const [x, z] = at(t);
      const roll = w.rng();
      const y = low + 3 + w.rng() * Math.max(0.1, tallFace - 5);
      if (roll < 0.3)
        decor(w, 'city_ac_unit', x, Math.min(y, high - 1.6), z, yaw);
      else if (roll < 0.5 && tallFace > 6.5)
        decor(w, 'city_pipe_run', x, low, z, yaw);
      else if (roll < 0.62 && streetLevel)
        decor(w, 'city_ad_screen', x, low + 5, z, yaw);
      else if (roll < 0.72 && tallFace > 9)
        decor(
          w,
          'city_fire_escape',
          x,
          low + 3 + 3.5 * Math.floor(w.rng() * 2),
          z,
          yaw,
        );
      else if (roll < 0.8)
        decor(w, 'city_sign_box', x, Math.min(y, high - 1.4), z, yaw);
    }
  }
}

/** Ulica Targowa (C): targ uliczny z budami, kioski, auta i wraki, latarnie, girlandy. */
function mainStreetDress(w) {
  // Targ wokół C: budy po obu stronach jezdni, lada do środka ulicy.
  const stalls = [
    'city_market_stall_canopy',
    'city_market_stall_canopy_violet',
  ];
  let i = 0;
  for (const x of [-34, -27, -20, -13, 13, 20, 27, 34]) {
    prop(w, stalls[i++ % 2], x, STREET, -4.2, 0);
    prop(w, stalls[(i++ + 1) % 2], x + 1, STREET, 4.2, 2);
  }
  for (const [x, z] of [
    [-8, -2.5],
    [8, 2.5],
    [-9, 3.5],
    [9, -3.5],
  ])
    prop(w, 'city_crates', x, STREET, z, 0);
  // Zachód i wschód: zaparkowane auta, wraki, kontenery na śmieci, bariery.
  const lane = [
    ['city_wrecked_car', -140, 4.4, 1],
    ['city_wrecked_car', -116, -2, 1],
    ['city_dumpster', -104, -5.2, 0],
    ['city_wrecked_car', -84, -3.4, 0],
    ['city_barrier', -74, 1, 0],
    ['city_wrecked_car', -50, 3, 0],
    ['city_generator', -46, -4.5, 0],
    ['city_car', 48, -4.4, 2],
    ['city_wrecked_car', 60, 1.5, 1],
    ['city_dumpster', 82, 5.2, 0],
    ['city_wrecked_car', 92, 4, 1],
    ['city_barrier', 108, -1, 1],
    ['city_wrecked_car', 118, -2.5, 0],
    ['city_car', 138, -4.4, 2],
    ['city_crates', 66, -4.6, 0],
    ['city_crates', -60, 4.5, 0],
  ];
  for (const [model, x, z, turn] of lane) prop(w, model, x, STREET, z, turn);
  // Chodniki: kioski, automaty, worki, latarnie (światło z puli).
  for (const [x, z, yaw] of [
    [-136, -7, 0],
    [-70, -7, 0],
    [-24, 8.5, Math.PI],
    [24, -8.5, 0],
    [46, 7, Math.PI],
    [74, -7, 0],
    [140, -7, 0],
  ])
    decor(w, 'city_street_lamp', x, CURB, z, yaw);
  for (const [model, x, z, turn] of [
    ['city_kiosk', -120, -8.2, 0],
    ['city_kiosk', 38, 8.2, 2],
    ['city_vending', -100, -9.2, 0],
    ['city_vending', 104, 9.2, 2],
    ['city_vending', 130, -9.2, 0],
    ['city_dumpster', 126, 8.6, 2],
    ['city_dumpster', -30, -8.6, 0],
  ])
    prop(w, model, x, CURB, z, turn);
  for (const [x, z] of [
    [-110, 8.5],
    [-58, -8.4],
    [56, -8.6],
    [96, 8.8],
    [-4, 8.8],
  ])
    decor(w, 'city_trash_bags', x, CURB, z, w.rng() * 6);
  for (const [x, z] of [
    [-6, 6.5],
    [6, -6.5],
    [-74, -1.5],
    [108, 1.5],
  ])
    decor(w, 'city_traffic_cone', x, STREET, z);
  // Girlandy i kable nad targiem, hologramy nad ulicą.
  for (const x of [-30, -20, -10, 10, 20, 30])
    decor(w, 'city_lantern_string', x, -6.2, 0, TURN);
  for (const x of [-120, -90, 70, 130])
    decor(w, 'city_cable_span', x, -4.5, 0, TURN);
  sign(w, 'holo_drink', 0, -5.5, -8.6, 0, 3.2, 3.2, null, 'holo');
  sign(w, 'holo_noodles', -60, -6, 8.6, Math.PI, 3, 3, null, 'holo');
  for (const [x, z, c] of [
    [-18, 0, LIGHT.white],
    [18, 0, LIGHT.amber],
    [0, -6, LIGHT.violet],
    [-60, 0, LIGHT.amber],
    [60, 0, LIGHT.blue],
  ])
    light(w, x, STREET + 4.2, z, c, STREET, 34, 16);
  for (const [x, z] of [
    [-14, 2],
    [22, -1],
    [-96, 1],
    [84, -2],
    [130, 2],
  ])
    w.decals.push({
      texture: w.rng() < 0.5 ? 'puddle1' : 'puddle2',
      position: vec(x, STREET, z),
      size: { w: 4, h: 3 },
      yaw: w.rng() * 3,
      surface: 'floor',
    });
  w.decals.push({
    texture: 'manhole',
    position: vec(40, STREET, 2),
    size: { w: 1.2, h: 1.2 },
    yaw: 0,
    surface: 'floor',
  });
  w.fx.push({ kind: 'steam', position: vec(40, STREET, 2), rate: 3 });
  w.fx.push({ kind: 'steam', position: vec(-88, STREET, -1), rate: 2 });
  // Koniec ulicy na granicach: wygrodzenie remontowe zamiast niewidzialnej ściany.
  for (const x of [-147.5, 147.5]) {
    // Blaszany płot z pasem ostrzegawczym zamyka jezdnię i chodniki.
    box(w, rect(x - 0.1, x + 0.1, -10, 10), STREET, STREET + 2.6, 'corrugated');
    box(
      w,
      rect(x - 0.15, x + 0.15, -10, 10),
      STREET + 2.6,
      STREET + 2.9,
      'hazard',
    );
    prop(w, 'city_barrier', x + (x < 0 ? 2.5 : -2.5), STREET, -3, 1);
    prop(w, 'city_barrier', x + (x < 0 ? 2.5 : -2.5), STREET, 3, 1);
    light(
      w,
      x + (x < 0 ? 2 : -2),
      STREET + 2.4,
      0,
      LIGHT.amber,
      STREET,
      26,
      8,
      { pattern: 'pulse', periodS: 1.2 },
    );
  }
}

/** Zaułek, placyk, pasaż i podwórze (D): ciasno, mokra cegła, śmietniki, ogniska w beczkach. */
function alleyCourtDress(w) {
  for (const [model, x, z, turn] of [
    ['city_dumpster', -62.6, -40, 1],
    ['city_crates', -57.6, -32, 0],
    ['city_dumpster', -57.6, -18, 1],
    ['city_crates', -62.4, -47, 0],
    ['city_dumpster', -62.6, 40, 1],
    ['city_crates', -57.6, 14, 0],
    ['city_generator', -62.6, 46, 1],
    ['hw_fire_barrel', -58, 36, 0],
    ['city_crates', -68.4, -54.2, 0],
    // Podwórze: szopa, wrak, skrzynie, beczki, agregat.
    ['hw_camp_shack', -78, 60, 0],
    ['city_wrecked_car', -46, 80, 0],
    ['city_crates', -71, 78, 0],
    ['city_crates', -69.6, 79.2, 1],
    ['hw_fire_barrel', -66, 82, 0],
    ['hw_fire_barrel', -52, 60, 0],
    ['city_dumpster', -82.4, 56, 1],
    ['city_generator', -38.8, 86, 1],
    ['hw_camp_tent_ridge', -50, 88.8, 1],
    ['city_crates', -76, 70, 0],
    ['city_barrier', -48, 66, 1],
    ['city_crates', -72, 58, 0],
    // Uliczka przy Kwartale Szyldu i pasaż.
    ['city_dumpster', 48.6, -36, 1],
    ['city_crates', 45.6, -26, 0],
    ['city_vending', -43.4, 22, 1],
    ['city_vending', -38.6, 34, 3],
    ['city_kiosk', -38.7, 46, 3],
    ['city_crates', -42.6, 28, 0],
  ])
    prop(w, model, x, STREET, z, turn);
  for (const [x, z] of [
    [-57.8, -24],
    [-62, 20],
    [-82.5, 84],
    [-37.5, 76],
    [46, -14],
    [-62.5, 30],
  ])
    decor(w, 'city_trash_bags', x, STREET, z, w.rng() * 6);
  // Pranie i kable nad zaułkiem i podwórzem.
  for (const z of [-40, -22, 20, 42])
    decor(w, 'city_cable_span', -60, -5 - (z % 3), z, 0, 0.8);
  for (const z of [62, 72, 84]) decor(w, 'city_cable_span', -60, -4, z, 0, 1.4);
  for (const [x, z, c, f] of [
    [-60, -30, LIGHT.violet, null],
    [-60, 30, LIGHT.amber, { pattern: 'fail', strength: 0.4 }],
    [-66, 82, LIGHT.amber, { pattern: 'buzz', strength: 0.5 }],
    [-52, 60, LIGHT.amber, { pattern: 'buzz', strength: 0.5 }],
    [-44, 76, LIGHT.blue, null],
    [47, -26, LIGHT.green, null],
  ])
    light(w, x, STREET + 3.4, z, c, STREET, 30, 14, f ?? undefined);
  w.fx.push({ kind: 'drip', position: vec(-60, -2, -16), rate: 4 });
  w.fx.push({ kind: 'drip', position: vec(-60, -2, 24), rate: 4 });
  w.fx.push({ kind: 'drip', position: vec(-82, -1, 76), rate: 3 });
  for (const [x, z] of [
    [-60, -36],
    [-60, 16],
    [-62, 74],
    [-46, 64],
    [47, -20],
  ])
    w.decals.push({
      texture: w.rng() < 0.5 ? 'puddle1' : 'puddle2',
      position: vec(x, STREET, z),
      size: { w: 3, h: 2.5 },
      yaw: w.rng() * 3,
      surface: 'floor',
    });
  w.decals.push({
    texture: 'oil_stain',
    position: vec(-46, STREET, 74),
    size: { w: 3, h: 3 },
    yaw: 0.4,
    surface: 'floor',
  });
  const graffiti = [
    'graffiti_iskra',
    'graffiti_piece',
    'graffiti_resist',
    'graffiti_tag1',
    'graffiti_tag2',
    'graffiti_tag3',
    'poster_torn1',
    'poster_torn2',
    'leak_streak',
  ];
  let g = 0;
  for (const [x, y, z, side] of [
    [-64, -11.5, -30, 'e'],
    [-56, -11.5, -44, 'w'],
    [-64, -11.5, 26, 'e'],
    [-56, -11.5, 38, 'w'],
    [-84, -11, 64, 'e'],
    [-60, -11, 92, 'n'],
    [-36, -11, 84, 'w'],
    [-74, -11, 52, 's'],
    [44, -11.5, -30, 'e'],
  ])
    wallDecal(w, graffiti[g++ % graffiti.length], x, y, z, side, 3, 2.4);
  sign(w, 'bar_mleczny', -45.8, -9.6, 52.15, 0, 2.8, 1.4, LIGHT.white);
  sign(w, 'tattoo', -63.85, -10.5, -24, TURN, 2.4, 1.2, LIGHT.violet);
  sign(w, 'sake', -56.15, -10.5, 30, -TURN, 2.4, 1.2, LIGHT.amber);
  sign(w, 'metro', -41, -8.6, 9.85, Math.PI, 2.4, 1.2, LIGHT.blue);
}

/** Nocny targ (A): wyspy straganów w dwóch kolorach, alejki z lampionami, plac przy A. */
function marketDress(w) {
  const l = w.lots.get('market');
  const variants = [
    'city_market_stall_canopy',
    'city_market_stall_canopy_violet',
  ];
  let v = 0;
  for (const z of [27, 36, 45, 75, 84, 93])
    for (const x of [27, 35, 43, 77, 85, 93]) {
      if (w.rng() < 0.12) {
        tryProp(
          w,
          l,
          w.rng() < 0.5 ? 'hw_camp_tent_ridge' : 'city_crates',
          x,
          z,
          0,
          0.8,
        );
        continue;
      }
      // Wyspa: dwa stragany plecami do siebie, lady w alejki.
      if (!isFree(w, around(x, z, 3.024, 4), 0, 0.4)) continue;
      for (const [dz, turn] of [
        [-1, 2],
        [1, 0],
      ])
        prop(w, variants[v++ % 2], x, 0, z + dz, turn);
    }
  // Plac przy A i luźne osłony między wyspami.
  const fill = [
    ['city_crates', 1],
    ['hw_fire_barrel', 1],
    ['city_vending', 1],
    ['hw_camp_tent_ridge', 1],
    ['hw_camp_tent_dome', 1],
    ['city_generator', 1],
    ['city_kiosk', 1],
  ];
  for (const [x, z] of [
    [31, 54],
    [44, 66],
    [76, 54],
    [90, 66],
    [102, 52],
    [104, 72],
    [30, 70],
    [52, 52],
    [68, 69],
    [60, 31],
    [60, 88],
    [102, 38],
    [103, 30],
    [24, 60],
    [48, 31],
    [72, 88],
    [104, 90],
    [87, 52],
    [38, 60],
  ])
    tryProp(w, l, pick(w, fill), x, z, Math.floor(w.rng() * 4), 1.2);
  // Lampiony nad alejkami i hologramy.
  for (const z of [31.5, 40.5, 79.5, 88.5])
    for (const x of [31, 39, 81, 89])
      decor(w, 'city_lantern_string', x, 4.2, z, 0);
  for (const x of [35, 85])
    decor(w, 'city_lantern_string', 60, 4.6, x === 35 ? 50 : 70, 0, 1);
  for (const [x, z, t] of [
    [60, 50, 'holo_koi'],
    [60, 72, 'holo_jellyfish'],
  ])
    sign(w, t, x, 5.5, z, 0, 3.4, 3.4, null, 'holo');
  for (const [x, z] of [
    [46, 58],
    [74, 62],
  ])
    decor(w, 'city_holo_projector', x, 0, z);
  // Daszki z brezentu nad częścią alejek (cień od mżawki).
  for (const [x, z] of [
    [31, 31.5],
    [85, 88.5],
    [89, 40.5],
  ]) {
    box(w, around(x, z, 7, 3.6), 3.3, 3.4, 'market_tarp');
    w.shelters.push({ r: around(x, z, 7, 3.6), y0: 0, y1: 3.4 });
  }
  for (const [x, z, c] of [
    [31, 31, LIGHT.white],
    [85, 31, LIGHT.amber],
    [31, 88, LIGHT.violet],
    [60, 60, LIGHT.amber],
    [73, 80, LIGHT.amber],
    [104, 60, LIGHT.violet],
  ])
    light(
      w,
      x,
      4,
      z,
      c,
      0,
      24,
      14,
      c === LIGHT.white
        ? { pattern: 'pulse', strength: 0.15, periodS: 3 }
        : undefined,
    );
  for (const [x, z] of [
    [54, 60],
    [96, 46],
    [36, 76],
  ])
    w.decals.push({
      texture: 'puddle2',
      position: vec(x, 0, z),
      size: { w: 3.5, h: 2.5 },
      yaw: w.rng() * 3,
      surface: 'floor',
    });
  sign(w, 'noodles', 109.85, 2.4, 82, -TURN, 3, 1.5, LIGHT.amber);
}

function northWestDress(w) {
  // Wieża zegarowa na najwyższej kamienicy kwartału (dach 8 m).
  w.arena.block({
    size: vec(8, 35, 8),
    position: vec(-100, 8 + 17.5, -90),
    model: 'roof_clock_tower',
  });
  occupy(w, around(-100, -90, 8, 8), 8);
  light(w, -100, 14, -84.5, LIGHT.white, 8, 40, 16);
  light(w, -100, 30, -90, LIGHT.amber, 8, 30, 20);
  const set = [
    ['roof_chimney_stack', 4],
    ['roof_skylight', 2],
    ['city_roof_water_tank', 2],
    ['roof_stairwell_hut', 1],
    ['city_satellite_cluster', 1],
  ];
  for (const id of [
    'nwHigh',
    'clock',
    'nwEast',
    'nwMid',
    'nwStreetW',
    'nwStreetE',
  ])
    scatterRoof(w, id, set, 10);
  for (const [x, y, z] of [
    [-140, 12, -80],
    [-118, 8, -100],
    [-90, 4, -44],
    [-128, 0, -14],
    [-72, 4, -80],
  ])
    decor(w, 'city_antenna', x, y, z, w.rng() * 6);
  for (const [x, y, z, c] of [
    [-136, 14.5, -50, LIGHT.amber],
    [-112, 10.5, -64, LIGHT.white],
    [-88, 6.5, -46, LIGHT.blue],
    [-130, 2.5, -24, LIGHT.violet],
  ])
    light(w, x, y, z, c, undefined, 30, 16);
  sign(w, 'hotel', -110, 6.4, -55.85, 0, 4, 2, LIGHT.blue);
  sign(w, 'iskra', -79.85, 6.5, -84, TURN, 4, 2, LIGHT.violet);
}

function northMiddleDress(w) {
  const set = [
    ['city_roof_water_tank', 2],
    ['city_roof_hvac_unit', 2],
    ['roof_skylight', 2],
    ['roof_chimney_stack', 2],
    ['city_crates', 1],
    ['hw_camp_tent_ridge', 1],
  ];
  for (const id of ['nmSW', 'nmSE', 'nmMid', 'nmTall', 'nmNorth', 'nmHigh'])
    scatterRoof(w, id, set, 10);
  for (const [x, y, z] of [
    [-40, 4, -60],
    [-10, 8, -96],
    [20, 4, -24],
    [-34, 0, -18],
  ])
    decor(w, 'city_cable_span', x, y + 2.4, z, w.rng() < 0.5 ? 0 : TURN, 0.9);
  for (const [x, y, z, c] of [
    [-40, 2.5, -24, LIGHT.amber],
    [20, 10.5, -60, LIGHT.amber],
    [22, 14.5, -100, LIGHT.white],
  ])
    light(w, x, y, z, c, undefined, 30, 16);
  sign(w, 'karaoke', 22, 6.5, -35.85, 0, 4, 2, LIGHT.violet);
}

function northEastDress(w) {
  // Gigantyczny szyld: panele w +Z (na targ i ulicę), kolizja tylko w nogach kratownicy.
  decor(w, 'roof_giant_sign', 80, 12, -80, 0);
  for (const x of [-9, -4.5, 0, 4.5, 9])
    for (const dz of [-1.6, 1.2])
      box(w, around(80 + x, -80 + dz, 0.35, 0.35), 12, 16.1, 'metal', {
        visible: false,
      });
  occupy(w, rect(68, 92, -84, -76), 12);
  light(w, 72, 17, -75, LIGHT.violet, 12, 46, 20);
  light(w, 88, 17, -75, LIGHT.amber, 12, 46, 20);
  w.fx.push({ kind: 'sparks', position: vec(90, 16, -77.5), rate: 2 });
  const set = [
    ['city_roof_hvac_unit', 3],
    ['city_satellite_cluster', 2],
    ['city_smog_scrubber', 2],
    ['city_generator', 1],
    ['roof_skylight', 1],
    ['city_neon_sign_frame', 1],
  ];
  for (const id of [
    'neWest',
    'neNorth',
    'sign',
    'neEast',
    'neMid',
    'neStreetW',
    'neStreetM',
    'neStreetE',
  ])
    scatterRoof(w, id, set, 10);
  for (const [x, y, z] of [
    [52, 4, -60],
    [100, 8, -112],
    [140, 8, -60],
    [116, 0, -16],
    [64, 12, -94],
  ])
    decor(w, 'city_antenna', x, y, z, w.rng() * 6);
  for (const [x, z] of [
    [104, -92],
    [130, -50],
    [70, -46],
  ])
    w.fx.push({
      kind: 'steam',
      position: vec(x, heightAt(w, x, z), z),
      rate: 2,
    });
  for (const [x, y, z, c] of [
    [104, 14.5, -60, LIGHT.green],
    [130, 10.5, -60, LIGHT.blue],
    [136, 10.5, -22, LIGHT.violet],
    [70, 6.5, -20, LIGHT.green],
  ])
    light(w, x, y, z, c, undefined, 32, 16);
  sign(w, 'implants', 112, -4, -9.85, 0, 4, 2, LIGHT.blue);
  sign(w, 'repair', 49.85, -10.5, -30, -TURN, 2.4, 1.2, LIGHT.green);
  sign(w, 'holo_implant', 136, 12, -34.2, 0, 4, 4, null, 'holo');
}

function southWestDress(w) {
  // Dzikie obozowisko na dachach startowych: namioty, szałasy, beczki z ogniem.
  const camp = [
    ['hw_camp_tent_dome', 2],
    ['hw_camp_tent_ridge', 2],
    ['hw_camp_shack', 2],
    ['hw_fire_barrel', 1],
    ['city_crates', 1],
    ['roof_chimney_stack', 1],
    ['city_roof_water_tank', 1],
  ];
  for (const id of ['swSouth', 'swNorth']) scatterRoof(w, id, camp, 9);
  const old = [
    ['roof_chimney_stack', 3],
    ['city_roof_water_tank', 2],
    ['roof_skylight', 2],
    ['city_roof_hvac_unit', 1],
  ];
  for (const id of ['swCorner', 'swWest']) scatterRoof(w, id, old, 10);
  for (const [x, z] of [
    [-128, 108],
    [-96, 100],
    [-60, 116],
    [-84, 30],
  ])
    decor(w, 'city_cable_span', x, 2.2, z, w.rng() < 0.5 ? 0 : TURN, 0.7);
  for (const [x, y, z, c, f] of [
    [-130, 2.4, 110, LIGHT.amber, { pattern: 'buzz', strength: 0.5 }],
    [-96, 2.4, 104, LIGHT.amber, { pattern: 'buzz', strength: 0.5 }],
    [-80, 2.4, 30, LIGHT.amber, null],
    [-126, 10.5, 24, LIGHT.blue, null],
  ])
    light(w, x, y, z, c, undefined, 30, 15, f ?? undefined);
  sign(w, 'kebab', -99.85, 5, 30, TURN, 3, 1.5, LIGHT.amber);
}

function southMiddleDress(w) {
  // Kamienice w remoncie: rusztowania przy ulicy, agregaty, skrzynie i szopy na dachach.
  for (let x = -28.75; x <= -4; x += 2.5) {
    prop(w, 'build_scaffold_bay', x, CURB, 9.4, 2);
    decor(w, 'build_scaffold_bay', x, CURB + 3.1, 9.4, Math.PI);
    if (x < -16) decor(w, 'build_scaffold_bay', x, CURB + 6.2, 9.4, Math.PI);
  }
  const renovation = [
    ['hw_camp_shack', 1],
    ['city_crates', 1],
    ['city_generator', 1],
    ['city_roof_hvac_unit', 1],
    ['roof_skylight', 2],
    ['city_roof_water_tank', 1],
    ['city_crates', 1],
  ];
  for (const id of ['smA', 'smB', 'smC', 'smD'])
    scatterRoof(w, id, renovation, 10);
  for (const [x, y, z, c] of [
    [-10, 2.5, 30, LIGHT.amber],
    [-20, 6.5, 80, LIGHT.white],
    [5, 10.5, 64, LIGHT.amber],
    [0, 6.5, 116, LIGHT.violet],
  ])
    light(w, x, y, z, c, undefined, 30, 15);
  sign(w, 'pharmacy', 20.15, 3.4, 76, TURN, 3, 1.5, LIGHT.green);
}

function southEastDress(w) {
  const set = [
    ['city_roof_water_tank', 2],
    ['city_roof_hvac_unit', 2],
    ['roof_chimney_stack', 2],
    ['city_satellite_cluster', 1],
    ['roof_skylight', 1],
    ['roof_stairwell_hut', 1],
  ];
  for (const id of ['seA', 'seB', 'seC']) scatterRoof(w, id, set, 10);
  for (const [x, y, z, c] of [
    [130, 10.5, 30, LIGHT.white],
    [70, 6.5, 116, LIGHT.violet],
  ])
    light(w, x, y, z, c, undefined, 30, 15);
  sign(w, 'beer', 109.85, 4.6, 36, -TURN, 3, 1.5, LIGHT.amber);
}

// ------------------------------------------------------------------ granica i oprawa za nią

/** Zabezpieczenie na obwiedni i pierścień kamienic za granicą (bez dostępu), aż do panoramy. */
function boundary(w) {
  const h = 46;
  for (const r of [
    rect(BOUNDS.minX - 1, BOUNDS.minX, BOUNDS.minZ, BOUNDS.maxZ),
    rect(BOUNDS.maxX, BOUNDS.maxX + 1, BOUNDS.minZ, BOUNDS.maxZ),
    rect(BOUNDS.minX, BOUNDS.maxX, BOUNDS.minZ - 1, BOUNDS.minZ),
    rect(BOUNDS.minX, BOUNDS.maxX, BOUNDS.maxZ, BOUNDS.maxZ + 1),
  ])
    box(w, r, STREET, STREET + h, 'concrete', { visible: false });
  w.arena.warn(
    'safety-boundary',
    'Niewidoczna ściana na obwiedni stoi za parapetami, wygrodzeniem ulicy i pasem wysokich kamienic; granicę ocenia się w grze.',
  );
  // Ulice za granicą (bez chodzenia) i kamienice oprawy.
  for (const r of [
    rect(-164, -150, -144, 144),
    rect(150, 164, -144, 144),
    rect(-164, 164, -144, -130),
    rect(-164, 164, 130, 144),
    rect(-186, -164, -10, 10),
    rect(164, 186, -10, 10),
  ])
    tiledSlab(w, r, STREET, 'asphalt', { walkable: false }, 40);
  const ring = (axis, fixed0, fixed1, from, to, gap) => {
    let t = from;
    while (t < to - 4) {
      const len = 14 + Math.floor(w.rng() * 16);
      const end = Math.min(to, t + len);
      const skip = gap && gap.some(([a, b]) => end > a && t < b);
      if (!skip) {
        const top = 2 + Math.floor(w.rng() * 6) * 3;
        const r =
          axis === 'z'
            ? rect(fixed0, fixed1, t, end)
            : rect(t, end, fixed0, fixed1);
        box(w, r, STREET, top - 0.3, w.rng() < 0.75 ? 'facade' : 'plaster');
        box(w, r, top - 0.3, top, 'roof_tar');
      }
      t = end + (w.rng() < 0.35 ? 8 : 0);
    }
  };
  ring('z', -186, -164, -166, 166, [[-12, 12]]);
  ring('z', 164, 186, -166, 166, [[-12, 12]]);
  ring('x', -168, -144, -164, 164);
  ring('x', 144, 166, -164, 164);
  // Napis na wylocie ulicy za wygrodzeniem: miasto trwa za granicą areny.
  sign(w, 'hotel', 164.15, -6, -4, -TURN, 5, 2.5, LIGHT.blue);
}

// ------------------------------------------------------------------ generator

export default function generate() {
  const w = createWorld();
  const { arena } = w;
  edgeLots(w);
  northWestLots(w);
  northMiddleLots(w);
  northEastLots(w);
  southWestLots(w);
  southMiddleLots(w);
  marketLots(w);
  streetLots(w);
  checkCoverage(w);
  pointsAndSpawns(w);
  connections(w);
  buildLots(w);
  buildParapets(w);
  buildFireWalls(w);
  northWestDress(w);
  northEastDress(w);
  marketDress(w);
  mainStreetDress(w);
  alleyCourtDress(w);
  northMiddleDress(w);
  southWestDress(w);
  southMiddleDress(w);
  southEastDress(w);
  dressFacades(w);
  boundary(w);

  arena.zone('Ulica Targowa (C)', rect(-150, 150, -10, 10), 'low');
  arena.zone('Zaułek i podwórze (D)', rect(-84, -36, 10, 93), 'dense');
  arena.zone('Nocny targ (A)', rect(20, 110, 10, 100), 'open');
  arena.zone('Kwartał Zegarowy (B)', rect(-150, -56, -112, -10), 'high');
  arena.zone('Kwartał Szyldu (E)', rect(44, 150, -118, -10), 'high');
  arena.zone('Pasaż i klatki', rect(-44, -19, 10, 68), 'interior');

  arena.roomMeta({
    playerSpawn: PLAYER,
    maxAlive: 12,
    minSpawnDistance: 15,
    weatherFloorY: STREET,
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: vec(-149.5, 1.5, 116),
        size: vec(1, 3, 3),
      },
      {
        id: 'exit',
        role: 'exit',
        position: vec(139.5, 9.5, 30),
        size: vec(1, 3, 3),
      },
    ],
    signs: w.signs,
    decals: w.decals,
    ambientFx: w.fx,
    rainShelters: w.shelters.map(({ r, y0, y1 }) => ({
      position: vec(
        (r.minX + r.maxX) / 2,
        (y0 + y1) / 2,
        (r.minZ + r.maxZ) / 2,
      ),
      size: vec(r.maxX - r.minX, y1 - y0, r.maxZ - r.minZ),
    })),
  });
  // Układ Kradzieży rdzenia (ADR 0011 D4): baza i ewakuacja ok. 163 m drogi od siebie.
  arena.arenaMeta({
    heist: {
      playerSpawn: { x: 115, y: 0, z: -21.5 },
      base: { x: 0, y: 0, z: 32 },
      extraction: { x: 110, y: 0, z: -20 },
      spawnPoints: [
        { x: 30, y: 0, z: 32 },
        { x: -24, y: -14, z: 0 },
        { x: -41, y: -14, z: 38 },
        { x: 28, y: -14, z: 0 },
        { x: 5, y: 8, z: 78 },
        { x: -46, y: -14, z: 56 },
      ],
    },
  });
  return arena;
}
