// Wspólny zestaw dla aren runu (profil `run`): pokój combat/elite w tools/arenas/run/<id>.mjs.
// Plik z prefiksem `_` nie jest generatorem; `build.mjs --run` go pomija.
// Układ współrzędnych: X na wschód, Z na południe; start przy południowej, wyjście przy północnej ścianie.
import { createArena, vec } from '../lib/arena.mjs';
import { createPrimitives } from '../lib/prims.mjs';

export const R = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });
export { vec };

/** Dozwolone neony Neon Noir (bez czerwieni, cyanu i magenty: ADR 0006). */
export const COLOR = {
  amber: '#ffae1a',
  green: '#6dff4a',
  violet: '#8a5cff',
  blue: '#3d7bff',
  warm: '#fff1d6',
};

/** Konfiguracja dyrektora walki taka jak w dotychczasowych pokojach runu. */
const slots = {
  melee: { count: 8, offsetDeg: 0 },
  shot: { count: 6, offsetDeg: 30 },
};
export const DIRECTOR = {
  combat: {
    attackTokens: 3,
    shotTokens: 2,
    maxHoldS: 4,
    reassignS: 1,
    probeHeightM: 0.5,
    slots,
  },
  elite: {
    attackTokens: 4,
    shotTokens: 3,
    maxHoldS: 4,
    reassignS: 1,
    probeHeightM: 0.5,
    slots,
  },
};

/** Pełne AABB modeli z docs/assets.md (przód +Z). Kolizja = ten sam rozmiar. */
export const SIZE = {
  city_dumpster: vec(1.97, 1.33, 1.08),
  city_vending: vec(1.014, 2, 0.816),
  city_barrier: vec(2, 0.929, 0.51),
  city_car: vec(4.42, 1.46, 1.94),
  city_stall: vec(3, 2.622, 2.043),
  city_crates: vec(1.212, 1.59, 1.256),
  city_generator: vec(1.6, 1.4, 1.005),
  city_kiosk: vec(0.8, 2.235, 0.624),
  city_highway_barrier: vec(4, 1.093, 0.808),
  city_wrecked_car: vec(2.15, 1.58, 3.95),
  city_market_stall_canopy: vec(3.024, 2.612, 2),
  city_market_stall_canopy_violet: vec(3.024, 2.612, 2),
  city_roof_water_tank: vec(3, 5, 3),
  city_roof_hvac_unit: vec(4, 1.998, 2.052),
  city_smog_scrubber: vec(3, 4, 3),
  rail_maglev_car: vec(25, 4.1, 4),
  rail_maglev_car_open: vec(25, 4.1, 4),
};

const QUARTER = Math.PI / 2;
const overlaps = (a, b) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

/**
 * Tworzy arenę runu: pokój nie jest `exclusive` (run losuje tylko takie), ale ma blok `arena`
 * z `spawnRing`, który włącza w RoomScene statyczne batchowanie i wspinanie po stopniach.
 * Punkty A–C wymaga schemat (`capturePointsSchema`); w runie nie mają znaczenia rozgrywkowego.
 */
export function createRunRoom({
  id,
  name,
  type = 'combat',
  weather,
  theme,
  seed = id,
  bounds,
  startX,
  exitX,
  wallMaterial = 'facade',
  wallHeights = [14, 18, 22],
  doorWidth = 4,
}) {
  const arena = createArena({
    id,
    name,
    weather,
    ...(theme ? { theme } : {}),
    seed,
    bounds,
    exclusive: false,
  });
  const p = createPrimitives(arena);
  const start = vec(startX, 0, bounds.maxZ - 3);
  const exit = vec(exitX, 0, bounds.minZ);
  const entryDoor = vec(startX, 1.5, bounds.maxZ);
  const exitDoor = vec(exitX, 1.5, bounds.minZ);
  const isElite = type === 'elite';
  arena.roomMeta({
    type,
    playerSpawn: start,
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: entryDoor,
        size: vec(doorWidth, 3, 1),
      },
      {
        id: 'exit',
        role: 'exit',
        position: exitDoor,
        size: vec(doorWidth, 3, 1),
      },
    ],
    director: DIRECTOR[isElite ? 'elite' : 'combat'],
  });
  const signs = [],
    decals = [],
    ambientFx = [],
    rainShelters = [],
    hazards = [],
    setPieces = [],
    civilians = [],
    hideSpots = [];
  const taken = [];
  const k = {
    arena,
    p,
    bounds,
    start,
    exit,
    signs,
    decals,
    ambientFx,
    rainShelters,
    hazards,
    setPieces,
    civilians,
    hideSpots,
    /** Prostopadłościan od `bottom` do `top` w prostokącie rect. */
    solid(rect, bottom, top, material, opts = {}) {
      return arena.block({
        size: vec(rect.maxX - rect.minX, top - bottom, rect.maxZ - rect.minZ),
        position: vec(
          (rect.minX + rect.maxX) / 2,
          (bottom + top) / 2,
          (rect.minZ + rect.maxZ) / 2,
        ),
        material,
        ...opts,
      });
    },
    /** Rezerwuje rzut (np. filary), żeby rekwizyty i spawny go omijały. */
    reserve(rect, level = 0) {
      taken.push({ ...rect, level });
    },
    /** Podłoga chodzenia (cienka płyta) z wierzchem na y. */
    ground(rect, y, material, opts = {}) {
      return p.floor(rect, y, material, opts);
    },
    /** Pełna bryła z chodzącym dachem na y (garaż, antresola, peron). */
    deck(rect, y, material, bottom = 0) {
      if (bottom === 0) taken.push({ ...rect, level: 0 });
      return k.solid(rect, bottom, y, material, { walkable: true });
    },
    /** Bryła zasłaniająca (elewacja, mur) od ziemi do `height`; rejestruje rzut. */
    mass(rect, height, material = wallMaterial, opts = {}) {
      taken.push({ ...rect, level: 0 });
      return k.solid(rect, 0, height, material, opts);
    },
    ramp(from, to, width, material = 'concrete') {
      const half = width / 2;
      taken.push({
        minX: Math.min(from.x, to.x) - (from.x === to.x ? half : 0),
        maxX: Math.max(from.x, to.x) + (from.x === to.x ? half : 0),
        minZ: Math.min(from.z, to.z) - (from.z === to.z ? half : 0),
        maxZ: Math.max(from.z, to.z) + (from.z === to.z ? half : 0),
        level: 0,
      });
      return p.ramp({ from, to, width, material });
    },
    /** Rekwizyt z modelem GLB i kolizją; `quarter` = obrót o 90° (odwrócony collider). */
    prop(model, x, z, { y = 0, quarter = 0, material = 'metal' } = {}) {
      const size = SIZE[model];
      if (!size) throw new Error(`Brak rozmiaru modelu ${model}.`);
      const q = ((quarter % 4) + 4) % 4;
      const sx = q % 2 ? size.z : size.x,
        sz = q % 2 ? size.x : size.z;
      const rect = R(x - sx / 2, x + sx / 2, z - sz / 2, z + sz / 2);
      const hit = taken.find((t) => t.level === y && overlaps(t, rect));
      if (hit) {
        arena.warn(
          'prop-overlap',
          `${model} (${x}, ${z}) nachodzi na bryłę (${hit.minX}…${hit.maxX}, ${hit.minZ}…${hit.maxZ}).`,
        );
        return null;
      }
      taken.push({ ...rect, level: y });
      if (q % 2 === 0)
        return arena.block({
          model,
          size: { ...size },
          position: vec(x, y + size.y / 2, z),
          material,
          instance: true,
          ...(q === 2 ? { rotation: vec(0, Math.PI, 0) } : {}),
        });
      arena.decor(model, vec(x, y, z), q * QUARTER);
      return arena.block({
        size: vec(sx, size.y, sz),
        position: vec(x, y + size.y / 2, z),
        material,
        visible: false,
      });
    },
    /** Dekoracja bez kolizji (lampy, klimatyzatory, fasadowe dodatki). */
    deco(model, x, y, z, yaw = 0, scale) {
      return arena.decor(model, vec(x, y, z), yaw, scale ? { scale } : {});
    },
    /**
     * Punkt na elewacji prostokąta: strona N (minZ) / S (maxZ) / W (minX) / E (maxX),
     * `along` mierzone od minX (N, S) albo minZ (W, E). Zwraca pozycję i yaw (przód modelu +Z).
     */
    facePoint(rect, side, along, offset = 0.3) {
      if (side === 'S')
        return { x: rect.minX + along, z: rect.maxZ + offset, yaw: 0 };
      if (side === 'N')
        return { x: rect.minX + along, z: rect.minZ - offset, yaw: Math.PI };
      if (side === 'E')
        return { x: rect.maxX + offset, z: rect.minZ + along, yaw: QUARTER };
      return { x: rect.minX - offset, z: rect.minZ + along, yaw: -QUARTER };
    },
    /** Dekoracja ścienna (okno, klimatyzator, schody pożarowe) na elewacji. */
    face(rect, side, along, y, model, offset = 0.3, scale) {
      const f = k.facePoint(rect, side, along, offset);
      return k.deco(model, f.x, y, f.z, f.yaw, scale);
    },
    /** Neon na elewacji; środek napisu na wysokości y. */
    faceNeon(rect, side, along, y, texture, w, h, tint, flicker = 0.2) {
      const f = k.facePoint(rect, side, along, 0.15);
      k.neon(texture, f.x, y, f.z, w, h, f.yaw, tint, flicker);
    },
    light(x, y, z, color, intensity = 20, range = 16, opts = {}) {
      return arena.light(vec(x, y, z), color, intensity, range, opts);
    },
    /** Lampa uliczna z modelem i ciepłym światłem. */
    lamp(x, z, color = COLOR.amber, { y = 0, yaw = 0, intensity = 18 } = {}) {
      arena.decor('city_street_lamp', vec(x, y, z), yaw);
      return arena.light(vec(x, y + 4.3, z), color, intensity, 15);
    },
    neon(texture, x, y, z, w, h, yaw, tint, flicker = 0.2) {
      signs.push({
        kind: 'neon',
        texture,
        position: vec(x, y, z),
        size: { w, h },
        yaw,
        tint,
        flicker,
      });
    },
    holo(texture, x, y, z, w, h, yaw, tint) {
      signs.push({
        kind: 'holo',
        texture,
        position: vec(x, y, z),
        size: { w, h },
        yaw,
        tint,
      });
    },
    decal(texture, x, y, z, w, h, yaw = 0, surface = 'floor', opacity = 0.7) {
      decals.push({
        texture,
        surface,
        position: vec(x, y, z),
        yaw,
        size: { w, h },
        opacity,
      });
    },
    fx(kind, x, y, z, rate) {
      ambientFx.push({
        kind,
        position: vec(x, y, z),
        ...(rate ? { rate } : {}),
      });
    },
    spawn(x, z) {
      const pad = 1;
      const hit = taken.find(
        (t) =>
          t.level === 0 &&
          x > t.minX - pad &&
          x < t.maxX + pad &&
          z > t.minZ - pad &&
          z < t.maxZ + pad,
      );
      if (hit)
        arena.warn(
          'spawn-blocked',
          `Spawn (${x}, ${z}) leży przy bryle (${hit.minX}…${hit.maxX}, ${hit.minZ}…${hit.maxZ}).`,
        );
      arena.spawn(vec(x, 0, z));
    },
    /**
     * Obwód: wysokie ściany tuż za granicą podłogi, otwory na drzwi wejścia i wyjścia.
     * Ściany są poza `bounds`, więc nie zajmują podłogi.
     */
    perimeter({
      heights = wallHeights,
      thickness = 3,
      material = wallMaterial,
    } = {}) {
      const { minX, maxX, minZ, maxZ } = bounds;
      const opening = { width: doorWidth + 0.8, height: 3.4 };
      const run = (from, to, axisOpenings, salt) => {
        const length = Math.hypot(to.x - from.x, to.z - from.z);
        // Dzielimy ścianę na segmenty różnej wysokości (skyline); otwory nie mogą ich przecinać.
        const cuts = axisOpenings
          .map((at) => [at - opening.width / 2, at + opening.width / 2])
          .sort((a, b) => a[0] - b[0]);
        const segments = [];
        let cursor = 0;
        for (const [a, b] of cuts) {
          if (a > cursor) segments.push([cursor, a, null]);
          segments.push([a, b, true]);
          cursor = b;
        }
        if (cursor < length) segments.push([cursor, length, null]);
        const dx = (to.x - from.x) / length,
          dz = (to.z - from.z) / length;
        let index = salt;
        for (const [a, b, kind] of segments) {
          if (kind) {
            // Nadproże nad drzwiami.
            const mid = (a + b) / 2;
            p.wall(
              vec(from.x + dx * a, 0, from.z + dz * a),
              vec(from.x + dx * b, 0, from.z + dz * b),
              heights[0],
              thickness,
              material,
              {
                openings: [
                  { at: mid - a, width: b - a, height: opening.height },
                ],
              },
            );
            continue;
          }
          // Segmenty pocięte na ~18 m z różnymi wysokościami.
          const parts = Math.max(1, Math.round((b - a) / 18));
          for (let i = 0; i < parts; i++) {
            const s = a + ((b - a) * i) / parts,
              e = a + ((b - a) * (i + 1)) / parts;
            p.wall(
              vec(from.x + dx * s, 0, from.z + dz * s),
              vec(from.x + dx * e, 0, from.z + dz * e),
              heights[index++ % heights.length],
              thickness,
              material,
            );
          }
        }
      };
      const t = thickness / 2;
      // Północ i południe sięgają narożników; wschód i zachód mieszczą się pomiędzy.
      run(
        vec(minX - thickness, 0, minZ - t),
        vec(maxX + thickness, 0, minZ - t),
        [exitX - (minX - thickness)],
        0,
      );
      run(
        vec(minX - thickness, 0, maxZ + t),
        vec(maxX + thickness, 0, maxZ + t),
        [startX - (minX - thickness)],
        2,
      );
      run(vec(minX - t, 0, minZ), vec(minX - t, 0, maxZ), [], 1);
      run(vec(maxX + t, 0, minZ), vec(maxX + t, 0, maxZ), [], 3);
    },
    /** Zapisuje dane oprawy zebrane w trakcie budowy; wywołaj raz, na końcu. */
    finish({
      points,
      zones,
      maxAlive,
      minSpawnDistance,
      spawnRing,
      setPieces: finishSetPieces = setPieces,
      civilians: finishCivilians = civilians,
      hideSpots: finishHideSpots = hideSpots,
    }) {
      for (const [zoneName, rect, kind] of zones)
        arena.zone(zoneName, rect, kind);
      points.forEach(([, x, y, z], i) =>
        arena.point('ABCDE'[i], vec(x, y, z), 4),
      );
      arena.arenaMeta({
        spawnRing: spawnRing ?? { minM: 10, maxM: 70 },
        navigationCellM: 1,
      });
      arena.roomMeta({
        maxAlive,
        minSpawnDistance,
        signs,
        decals,
        ambientFx,
        ...(rainShelters.length ? { rainShelters } : {}),
        ...(hazards.length ? { hazards } : {}),
        ...(finishSetPieces.length ? { setPieces: finishSetPieces } : {}),
        ...(finishCivilians.length ? { civilians: finishCivilians } : {}),
        ...(finishHideSpots.length ? { hideSpots: finishHideSpots } : {}),
      });
      return arena;
    },
  };
  return k;
}
