// Dodatki do _runKit.mjs dla partii C (podstacja, magazyn, złomowisko, elity): rozmiary modeli,
// zapis bloków (kontrola wolnego gruntu), rozsiewanie rekwizytów, spawny z korektą i okładziny ścian.
// Plik z prefiksem `_` nie jest generatorem; `build.mjs --run` go pomija.
import { COLOR, SIZE, vec } from './_runKit.mjs';

Object.assign(SIZE, {
  port_container_20_navy: vec(6.058, 2.591, 2.438),
  port_container_20_olive: vec(6.058, 2.591, 2.438),
  port_container_20_ochre: vec(6.058, 2.591, 2.438),
  port_container_20_graphite: vec(6.058, 2.591, 2.438),
  port_container_40_navy: vec(12.192, 2.591, 2.438),
  port_container_40_graphite: vec(12.192, 2.591, 2.438),
  port_light_tower: vec(3.391, 20.12, 3.391),
  power_transformer: vec(6, 5, 4),
  power_hv_pylon: vec(16.5, 30, 7.2),
  power_turbine_housing: vec(20, 7.1, 6),
  build_pipe_stack: vec(3.02, 2.793, 3),
  build_precast_stack: vec(6, 1.6, 2.406),
  build_rebar_bundle: vec(6, 0.59, 1.02),
  build_site_office: vec(6.058, 2.591, 2.438),
  build_mixer_truck: vec(2.51, 3.55, 9.02),
  build_hoarding_fence: vec(4, 2.4, 1.1),
  hw_fire_barrel: vec(0.622, 1.42, 0.614),
  hw_camp_shack: vec(3.1, 2.4, 2.617),
  hw_gas_pump: vec(1.2, 2, 0.604),
  rail_track_buffer: vec(4, 3, 4.6),
  port_reach_stacker: vec(6.06, 5.756, 11.105),
  port_flatcar: vec(14, 3.791, 3),
  power_pipe_rack: vec(12, 7.3, 4.02),
  power_cooling_tower: vec(50, 70, 50),
});

const QUARTER = Math.PI / 2;
const EPS = 1e-6;

/** Zapisuje bloki dodawane do areny; potrzebne do sprawdzania wolnego gruntu. */
export function track(k) {
  const blocks = [];
  const original = k.arena.block.bind(k.arena);
  k.arena.block = (box) => {
    blocks.push(box);
    return original(box);
  };
  k.blocks = blocks;
  const ramp = k.ramp;
  k.ramp = (from, to, width, material) => {
    const half = width / 2;
    const x0 = Math.min(from.x, to.x) - (from.x === to.x ? half : 0);
    const x1 = Math.max(from.x, to.x) + (from.x === to.x ? half : 0);
    const z0 = Math.min(from.z, to.z) - (from.z === to.z ? half : 0);
    const z1 = Math.max(from.z, to.z) + (from.z === to.z ? half : 0);
    blocks.push({
      position: vec((x0 + x1) / 2, 1, (z0 + z1) / 2),
      size: vec(x1 - x0, 2, z1 - z0),
      walkable: false,
      footprint: true,
    });
    return ramp(from, to, width, material);
  };
  return k;
}

/** Czy bryła stojąca na gruncie (poziom `level`) leży bliżej niż `margin` od punktu. */
export function blockedAt(k, x, z, margin = 0.8, level = 0) {
  return k.blocks.some(
    (b) =>
      b.position.y - b.size.y / 2 <= level + 0.3 &&
      b.position.y + b.size.y / 2 > level + 0.5 &&
      Math.abs(x - b.position.x) < b.size.x / 2 + margin &&
      Math.abs(z - b.position.z) < b.size.z / 2 + margin,
  );
}

/** Czy podłoga walkable (poziom 0 lub `level`) leży pod punktem; sprawdza grunt z `ground`. */
export function onFloor(k, x, z, level = 0) {
  return k.blocks.some(
    (b) =>
      b.walkable !== false &&
      Math.abs(b.position.y + b.size.y / 2 - level) < 0.06 &&
      Math.abs(x - b.position.x) <= b.size.x / 2 &&
      Math.abs(z - b.position.z) <= b.size.z / 2,
  );
}

/**
 * Rozsiewa rekwizyty z kolizją w prostokącie: losowe miejsca (rng areny), odstęp `clear` od
 * innych brył na gruncie, `avoid` = prostokąty do ominięcia. Model, obrót i poziom z listy.
 */
export function scatter(
  k,
  models,
  rect,
  { count, clear = 2.4, avoid: extra = [], level = 0, quarters = [0, 1, 2, 3] },
) {
  const avoid = [
    ...extra,
    {
      minX: k.exit.x - 4,
      maxX: k.exit.x + 4,
      minZ: k.bounds.minZ,
      maxZ: k.bounds.minZ + 9,
    },
    {
      minX: k.start.x - 4,
      maxX: k.start.x + 4,
      minZ: k.bounds.maxZ - 9,
      maxZ: k.bounds.maxZ,
    },
  ];
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 60; tries++) {
    const model = models[Math.floor(k.arena.rng() * models.length)];
    const size = SIZE[model];
    const quarter = quarters[Math.floor(k.arena.rng() * quarters.length)];
    const x = Math.round(rect.minX + k.arena.rng() * (rect.maxX - rect.minX));
    const z = Math.round(rect.minZ + k.arena.rng() * (rect.maxZ - rect.minZ));
    const sx = quarter % 2 ? size.z : size.x;
    const sz = quarter % 2 ? size.x : size.z;
    if (
      x - sx / 2 < rect.minX ||
      x + sx / 2 > rect.maxX ||
      z - sz / 2 < rect.minZ ||
      z + sz / 2 > rect.maxZ
    )
      continue;
    if (
      avoid.some(
        (a) =>
          x + sx / 2 > a.minX - clear / 2 &&
          x - sx / 2 < a.maxX + clear / 2 &&
          z + sz / 2 > a.minZ - clear / 2 &&
          z - sz / 2 < a.maxZ + clear / 2,
      )
    )
      continue;
    // Odstęp od innych brył (sprawdzamy narożniki i środek powiększonego prostokąta).
    const probe = [
      [x, z],
      [x - sx / 2, z - sz / 2],
      [x + sx / 2, z - sz / 2],
      [x - sx / 2, z + sz / 2],
      [x + sx / 2, z + sz / 2],
      [x - sx / 2, z],
      [x + sx / 2, z],
      [x, z - sz / 2],
      [x, z + sz / 2],
    ];
    if (probe.some(([px, pz]) => blockedAt(k, px, pz, clear / 2, level)))
      continue;
    if (!onFloor(k, x, z, level)) continue;
    const before = k.arena.metadata.warnings.length;
    const result = k.prop(model, x, z, { y: level, quarter });
    if (result === null) k.arena.metadata.warnings.length = before;
    else placed++;
  }
  return placed;
}

/** Czy punkt leży w polu lub bramce zagrożenia (margines 1,4 m, wymóg roomSchema to 1 m). */
function nearHazard(k, x, z, margin = 1.4) {
  return k.hazards.some((h) => {
    if (h.kind === 'electric_field')
      return (
        Math.abs(x - h.position.x) < h.size.x / 2 + margin &&
        Math.abs(z - h.position.z) < h.size.z / 2 + margin
      );
    if (h.kind === 'laser_gate') {
      const dx = h.to.x - h.from.x,
        dz = h.to.z - h.from.z;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((x - h.from.x) * dx + (z - h.from.z) * dz) / (dx * dx + dz * dz),
        ),
      );
      return (
        Math.hypot(x - (h.from.x + dx * t), z - (h.from.z + dz * t)) < margin
      );
    }
    return false;
  });
}

/** Spawny na gruncie: przy kolizji z bryłą szuka najbliższego wolnego punktu (siatka 1 m). */
export function spawns(k, points, margin = 1.4) {
  for (const [x0, z0] of points) {
    let done = false;
    for (let r = 0; r <= 6 && !done; r++)
      for (let dx = -r; dx <= r && !done; dx++)
        for (let dz = -r; dz <= r && !done; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = x0 + dx,
            z = z0 + dz;
          if (
            blockedAt(k, x, z, margin) ||
            !onFloor(k, x, z) ||
            nearHazard(k, x, z)
          )
            continue;
          k.spawn(x, z);
          done = true;
        }
    if (!done)
      throw new Error(`Brak wolnego miejsca na spawn przy (${x0}, ${z0}).`);
  }
}

function decalFits(def, block, tolerance = 0.1) {
  const normal = { x: Math.sin(def.yaw), z: Math.cos(def.yaw) };
  const axis = Math.abs(normal.x) > Math.abs(normal.z) ? 'x' : 'z';
  const along = axis === 'x' ? 'z' : 'x';
  if (Math.abs(normal[along]) > 1e-4) return false;
  const face =
    block.position[axis] + (Math.sign(normal[axis]) * block.size[axis]) / 2;
  return (
    Math.abs(def.position[axis] - face) <= tolerance + EPS &&
    Math.abs(def.position[along] - block.position[along]) + def.w / 2 <=
      block.size[along] / 2 + EPS &&
    Math.abs(def.position.y - block.position.y) + def.h / 2 <=
      block.size.y / 2 + EPS
  );
}

/**
 * Naklejka ścienna na elewacji prostokąta; pomija, gdy nie mieści się na jednym bloku
 * (test cityDecalBounds wymaga, by naklejka leżała w całości na jednym bloku).
 */
export function wallDecal(
  k,
  rect,
  _height,
  side,
  along,
  y,
  texture,
  w,
  h,
  opacity = 0.75,
) {
  const f = k.facePoint(rect, side, along, 0.04);
  const def = { position: { x: f.x, y, z: f.z }, yaw: f.yaw, w, h };
  if (!k.blocks.some((b) => decalFits(def, b))) return false;
  k.decal(texture, f.x, y, f.z, w, h, f.yaw, 'wall', opacity);
  return true;
}

/**
 * Okładzina ściany: co `step` m kolejny „komplet” z listy (każdy to lista części):
 *   { face: model, y, off, scale }, { neon: tekstura, y, w, h, c, fl }, { decal: tekstura, y, w, h }.
 * `avoid` to zakresy współrzędnej wzdłuż ściany (bezwzględne X dla N/S, Z dla W/E), np. drzwi.
 */
export function dressFace(
  k,
  rect,
  height,
  side,
  sets,
  { step = 6, margin = 3, from, to, avoid = [], offsetStart = 0 } = {},
) {
  const horizontal = side === 'N' || side === 'S';
  const origin = horizontal ? rect.minX : rect.minZ;
  const length = horizontal ? rect.maxX - rect.minX : rect.maxZ - rect.minZ;
  const start = from ?? margin;
  const end = to ?? length - margin;
  let i = offsetStart;
  for (let along = start; along <= end + EPS; along += step, i++) {
    const abs = origin + along;
    if (avoid.some(([a, b]) => abs > a && abs < b)) continue;
    for (const part of sets[i % sets.length]) {
      if (part.face)
        k.face(
          rect,
          side,
          along + (part.dx ?? 0),
          part.y ?? 0,
          part.face,
          part.off ?? 0.3,
          part.scale,
        );
      else if (part.neon)
        k.faceNeon(
          rect,
          side,
          along + (part.dx ?? 0),
          part.y,
          part.neon,
          part.w,
          part.h,
          part.c ?? COLOR.amber,
          part.fl ?? 0.25,
        );
      else if (part.decal)
        wallDecal(
          k,
          rect,
          height,
          side,
          along + (part.dx ?? 0),
          part.y,
          part.decal,
          part.w,
          part.h,
          part.o,
        );
    }
  }
}

/**
 * Okładzina czterech murów obwodu (wewnętrzne lico przy granicy podłogi). `sets` jak w dressFace;
 * osobne listy dla N, S, W, E w `perSide`. Drzwi (startX, exitX) są omijane o ±5 m.
 */
export function dressPerimeter(
  k,
  { startX, exitX, sets, perSide = {}, step = 7, height = 14, thickness = 3 },
) {
  const { minX, maxX, minZ, maxZ } = k.bounds;
  const walls = {
    N: [
      {
        minX: minX - thickness,
        maxX: maxX + thickness,
        minZ: minZ - thickness,
        maxZ: minZ,
      },
      'S',
    ],
    S: [
      {
        minX: minX - thickness,
        maxX: maxX + thickness,
        minZ: maxZ,
        maxZ: maxZ + thickness,
      },
      'N',
    ],
    W: [{ minX: minX - thickness, maxX: minX, minZ, maxZ }, 'E'],
    E: [{ minX: maxX, maxX: maxX + thickness, minZ, maxZ }, 'W'],
  };
  for (const [key, [rect, side]] of Object.entries(walls)) {
    const doors =
      key === 'N'
        ? [[exitX - 5, exitX + 5]]
        : key === 'S'
          ? [[startX - 5, startX + 5]]
          : [];
    dressFace(k, rect, height, side, perSide[key] ?? sets, {
      step,
      margin: 4,
      avoid: doors,
      offsetStart: key.charCodeAt(0) % 3,
    });
  }
}

export { QUARTER };

/** Budynek: bryła od ziemi do `height` z okładziną każdej z podanych stron (`sets` jak w dressFace). */
export function tower(
  k,
  rect,
  height,
  sets,
  { sides = ['N', 'S', 'E', 'W'], material, step = 6, margin = 3 } = {},
) {
  k.mass(rect, height, material);
  sides.forEach((side, i) =>
    dressFace(k, rect, height, side, sets, { step, margin, offsetStart: i }),
  );
}

/** Szyld/ekran z neonem i światłem w jednym wywołaniu (landmark). */
export function glow(k, x, y, z, color, intensity = 50, range = 30) {
  k.light(x, y, z, color, intensity, range);
}

/**
 * Pięć kompletów okładziny ścian (żaluzje, rury, drzwi, ekrany, klimatyzatory, neony, naklejki).
 * `neons` i `colors` (po 3), `decals` (po 3) nadają motyw; `top` = wysokość największych elementów.
 */
export function wallSets({ neons, colors, decals, top = 6 }) {
  return [
    [
      { face: 'city_shutter', y: 0, off: 0.2 },
      { neon: neons[0], y: top - 0.6, w: 2.8, h: 1.4, c: colors[0], fl: 0.25 },
    ],
    [
      { face: 'city_pipe_run', y: 0, off: 0.3 },
      { face: 'city_ac_unit', y: top + 0.8, off: 0.35, dx: 1.5 },
      { decal: decals[0], y: 2.8, w: 3, h: 2, dx: 3 },
    ],
    [
      { face: 'city_door', y: 0, off: 0.15 },
      { face: 'city_ad_screen', y: 1.2, off: 0.2, dx: 2.4 },
      { neon: neons[1], y: top - 1.6, w: 2.2, h: 1.1, c: colors[1], fl: 0.2 },
    ],
    [
      { face: 'city_sign_box', y: top - 1, off: 0.15 },
      { face: 'city_pipe_run', y: 0, off: 0.3, dx: -2.2 },
      { decal: decals[1], y: 2.4, w: 1.8, h: 2.4, dx: 2 },
    ],
    [
      { face: 'city_shutter', y: 0, off: 0.2 },
      { face: 'city_ac_unit', y: top - 1, off: 0.35, dx: 3.6 },
      { neon: neons[2], y: top, w: 2.4, h: 1.2, c: colors[2], fl: 0.3 },
      { decal: decals[2], y: 3, w: 1.6, h: 1.6, dx: -3 },
    ],
  ];
}
