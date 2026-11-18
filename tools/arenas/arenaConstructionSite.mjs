// Budowa wieżowca (ADR 0011): wykop −8 m, szkielet do 24 m, plac składowy,
// zaplecze z kontenerów, plac manewrowy i żuraw. X na wschód, Z na południe.
import { createArena, vec } from './lib/arena.mjs';
import { createPrimitives } from './lib/prims.mjs';
import { subtractRects } from './lib/geometry.mjs';

const R = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });
const QUARTER = Math.PI / 2;
const COLOR = {
  amber: '#ffae1a',
  green: '#6dff4a',
  violet: '#8a5cff',
  blue: '#3d7bff',
  warm: '#fff1d6',
};

// Projekt właściciela: strefy, poziomy, punkty i landmark.
const BOUNDS = R(-120, 120, -120, 120);
const NOTCH = R(60, 120, -120, -60);
// Zatoka bramy wjazdowej: fragment poza ogrodzeniem, przy ulicy.
const GATE_BAY = R(84, 120, 114, 120);
const PIT = R(-100, -20, -20, 60);
const PIT_Y = -8;
const TOWER = R(10, 70, -60, 10);
const LEVELS = [0, 4, 8, 12, 16, 20, 24];
const YARD = R(-100, 0, -110, -40);
const COMPOUND = R(70, 115, 40, 110);
const PLAZA = R(-20, 70, 64, 120);
const CRANE = vec(80, 0, 30);
const START = vec(-100, 0, 100);
const POINTS = [
  ['A', vec(-60, PIT_Y, 20), 5],
  ['B', vec(40, 8, -25), 5],
  ['C', vec(-50, 0, -75), 5],
  ['D', vec(92, 0, 72), 5],
  ['E', vec(20, 0, 90), 5],
];

// Wymiary modeli z docs/assets.md (pełne AABB, przód +Z; samochód przodem w +X).
const SIZE = {
  precast: vec(6, 1.6, 2.406),
  pipes: vec(3.02, 2.793, 3),
  rebar: vec(6, 0.59, 1.02),
  office: vec(6.058, 2.591, 2.438),
  mixer: vec(2.51, 3.55, 9.02),
  crates: vec(1.212, 1.59, 1.256),
  generator: vec(1.6, 1.4, 1.005),
  dumpster: vec(1.97, 1.33, 1.08),
  barrier: vec(2, 0.929, 0.51),
  jersey: vec(4, 1.093, 0.808),
  car: vec(4.42, 1.46, 1.94),
  vending: vec(1.014, 2, 0.816),
  c20: vec(6.058, 2.591, 2.438),
  c40: vec(12.192, 2.591, 2.438),
};

/** Wspólny kontekst stref: prymitywy, rekwizyty z kolizją i rejestr zajętych miejsc. */
function createSite(arena) {
  const p = createPrimitives(arena);
  const taken = new Map();
  const key = (y) => Math.round(y * 10) / 10;
  const overlaps = (a, b) =>
    a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
  const site = {
    arena,
    p,
    rng: arena.rng,
    /** Rezerwuje rzut na poziomie y; false, gdy koliduje z inną rezerwacją. */
    reserve(y, rect, label = 'obiekt') {
      const list = taken.get(key(y)) ?? [];
      const hit = list.find((r) => overlaps(r, rect));
      if (hit) {
        arena.warn(
          'prop-overlap',
          `${label} (${rect.minX.toFixed(1)}…${rect.maxX.toFixed(1)}, ${rect.minZ.toFixed(1)}…${rect.maxZ.toFixed(1)}, y ${y}) koliduje z ${hit.label}.`,
        );
        return false;
      }
      list.push({ ...rect, label });
      taken.set(key(y), list);
      return true;
    },
    keepOut(y, rect, label) {
      const list = taken.get(key(y)) ?? [];
      list.push({ ...rect, label });
      taken.set(key(y), list);
    },
    /** Bryła stojąca na podłodze y (pozycja podstawy). */
    solid(x, y, z, sx, sy, sz, material, extra = {}) {
      return arena.block({
        position: vec(x, y + sy / 2, z),
        size: vec(sx, sy, sz),
        material,
        ...extra,
      });
    },
    hidden(x, y, z, sx, sy, sz) {
      return site.solid(x, y, z, sx, sy, sz, 'concrete', { visible: false });
    },
    /**
     * Model GLB z kolizją, obrót o wielokrotność 90°; collider zawsze osiowy (tak
     * liczą go walidacja pokoju i nawigacja). Kontenery portowe 0/180° zostają
     * instancjami bloków; pozostałe modele to dekoracje scalane w komórkach
     * batchCellM z niewidocznym colliderem (mniej wywołań rysowania niż instancje).
     */
    placeModel(model, x, y, z, size, quarter = 0, material = 'metal') {
      const q = ((quarter % 4) + 4) % 4;
      if (model.startsWith('port_container_') && q % 2 === 0)
        return site.solid(x, y, z, size.x, size.y, size.z, material, {
          model,
          instance: true,
          ...(q === 2 ? { rotation: vec(0, Math.PI, 0) } : {}),
        });
      arena.decor(model, vec(x, y, z), q * QUARTER);
      return q % 2
        ? site.hidden(x, y, z, size.z, size.y, size.x)
        : site.hidden(x, y, z, size.x, size.y, size.z);
    },
    /** placeModel z rezerwacją rzutu (pad = luz na przejście obok). */
    prop(model, x, y, z, size, quarter = 0, material = 'metal', pad = 0.3) {
      const q = ((quarter % 4) + 4) % 4;
      const sx = q % 2 ? size.z : size.x,
        sz = q % 2 ? size.x : size.z;
      if (
        !site.reserve(
          y,
          R(
            x - sx / 2 - pad,
            x + sx / 2 + pad,
            z - sz / 2 - pad,
            z + sz / 2 + pad,
          ),
          model,
        )
      )
        return null;
      return site.placeModel(model, x, y, z, size, q, material);
    },
    /** Rekwizyt GLB bez kolizji (pachołki, worki, latarnie, elementy elewacji). */
    deco(model, x, y, z, yaw = 0, scale) {
      return arena.decor(model, vec(x, y, z), yaw, scale ? { scale } : {});
    },
    /** Skrzynia/stos z bloków bez modelu (sklejka, palety), z rezerwacją miejsca. */
    crate(
      x,
      y,
      z,
      sx,
      sy,
      sz,
      material = 'formwork_plywood',
      label = 'skrzynia',
    ) {
      if (
        !site.reserve(
          y,
          R(
            x - sx / 2 - 0.3,
            x + sx / 2 + 0.3,
            z - sz / 2 - 0.3,
            z + sz / 2 + 0.3,
          ),
          label,
        )
      )
        return null;
      return site.solid(x, y, z, sx, sy, sz, material);
    },
    /** Maszt oświetleniowy portu: model bez kolizji, niewidoczny collider trzonu, naświetlacze 18,5 m. */
    mast(x, z, color = COLOR.warm, range = 46) {
      if (!site.reserve(0, R(x - 1.8, x + 1.8, z - 1.8, z + 1.8), 'maszt'))
        return;
      arena.decor('port_light_tower', vec(x, 0, z), 0);
      site.hidden(x, 0, z, 1.6, 20, 1.6);
      site.light(x, 18.5, z, color, 40, range);
    },
    light(x, y, z, color, intensity = 30, range = 18, flicker) {
      return arena.light(
        vec(x, y, z),
        color,
        intensity,
        range,
        flicker ? { flicker } : {},
      );
    },
    zone: (name, rect, kind) => arena.zone(name, rect, kind),
    signs: [],
    decals: [],
    ambientFx: [],
    sign(texture, x, y, z, w, h, yaw, tint, kind = 'neon') {
      site.signs.push({
        kind,
        texture,
        position: vec(x, y, z),
        size: { w, h },
        yaw,
        tint,
      });
    },
    decal(texture, x, y, z, w, h, yaw = 0, opacity = 0.7, surface = 'floor') {
      site.decals.push({
        texture,
        position: vec(x, y, z),
        size: { w, h },
        yaw,
        surface,
        opacity,
      });
    },
    fx(kind, x, y, z, rate) {
      site.ambientFx.push({
        kind,
        position: vec(x, y, z),
        ...(rate ? { rate } : {}),
      });
    },
    /** Rampa ziemna: płyta X i schodkowe nasypy pod nią (bez szczelin pod spodem). */
    earthRamp(from, to, width, z, floorY, material = 'excavation_dirt') {
      const ramp = p.ramp({
        from: vec(from.x, from.y, z),
        to: vec(to.x, to.y, z),
        width,
        material,
      });
      const lo = Math.min(from.x, to.x),
        hi = Math.max(from.x, to.x);
      const height = (x) =>
        from.y + ((to.y - from.y) * (x - from.x)) / (to.x - from.x);
      for (let x = lo; x < hi - 1e-6; x += 4) {
        const end = Math.min(hi, x + 4);
        const top = Math.min(height(x), height(end)) - 0.45;
        if (top - floorY > 0.2)
          site.solid(
            (x + end) / 2,
            floorY,
            z,
            end - x,
            top - floorY,
            width,
            material,
          );
      }
      site.keepOut(floorY, R(lo, hi, z - width / 2, z + width / 2), 'rampa');
      return ramp;
    },
  };
  return site;
}

// ---------------------------------------------------------------------------
// Grunt, ogrodzenie, bramy i zabezpieczenie

function ground(site) {
  const claimed = [TOWER, PIT, NOTCH, GATE_BAY];
  const claim = (rect, material) => {
    for (const piece of subtractRects(rect, claimed))
      site.p.floor(piece, 0, material);
    claimed.push(rect);
  };
  claim(R(70, 120, 40, 110), 'paving'); // zaplecze: kostka
  claim(R(-20, 120, 64, 120), 'asphalt'); // plac manewrowy i droga od bramy
  claim(R(-16, 6, -46, 64), 'asphalt'); // droga wewnętrzna wykop–szkielet
  claim(R(-112, -2, -116, -40), 'concrete'); // utwardzony plac składowy
  claim(R(-120, -20, 60, 120), 'excavation_dirt'); // narożnik startu jednym kawałkiem
  claim(BOUNDS, 'excavation_dirt'); // reszta: ubity grunt budowy
}

function perimeter(site) {
  const { p, arena } = site;
  // Ogrodzenie: przód modelu (+Z lokalnie) na ulicę, wsporniki do środka.
  const hoarding = (from, to) => {
    p.fence({
      from,
      to,
      height: 3.6,
      model: 'build_hoarding_fence',
      moduleM: 6,
      scale: 1.5,
    });
    // Stopy i zastrzały modelu sięgają 1,05 m w głąb budowy: niewidoczny pas kolizji.
    const dx = Math.sign(to.x - from.x),
      dz = Math.sign(to.z - from.z);
    const len = Math.hypot(to.x - from.x, to.z - from.z);
    // Wnętrze budowy leży po lewej stronie kierunku obiegu (przód modelu na zewnątrz).
    site.hidden(
      (from.x + to.x) / 2 + dz * 0.5,
      0,
      (from.z + to.z) / 2 - dx * 0.5,
      dx ? len : 1,
      1.4,
      dz ? len : 1,
    );
  };
  // Brama wjazdowa w zatoce (z = 114), żeby ciężarówka mogła zjechać z ulicy.
  hoarding(vec(-120, 0, 120), vec(84, 0, 120));
  hoarding(vec(84, 0, 120), vec(84, 0, 114));
  hoarding(vec(84, 0, 114), vec(96, 0, 114));
  hoarding(vec(108, 0, 114), vec(120, 0, 114));
  hoarding(vec(120, 0, 114), vec(120, 0, -60));
  hoarding(vec(120, 0, -60), vec(60, 0, -60));
  hoarding(vec(60, 0, -60), vec(60, 0, -120));
  hoarding(vec(60, 0, -120), vec(-54, 0, -120));
  hoarding(vec(-66, 0, -120), vec(-120, 0, -120));
  hoarding(vec(-120, 0, -120), vec(-120, 0, 120));
  // Zamknięta brama północna (plac składowy): dwa skrzydła i rama.
  p.wall(vec(-66, 0, -120), vec(-54, 0, -120), 3.4, 0.2, 'container_graphite');
  for (const x of [-66.3, -53.7])
    site.solid(x, 0, -120, 0.5, 3.4, 0.5, 'metal');
  site.solid(-60, 3.4, -120, 13.2, 0.35, 0.6, 'hazard_stripes_worn');
  site.hidden(-60, 0, -119.5, 12, 1.4, 1);
  // Brama wjazdowa SE: słupy z ryglem, rozsunięte skrzydło i bariery od ulicy.
  for (const x of [95.7, 108.3]) site.solid(x, 0, 114, 0.6, 4.6, 0.6, 'metal');
  site.solid(102, 4.6, 114, 13.2, 0.7, 0.8, 'hazard_stripes_worn');
  site.solid(114, 0, 114.9, 11.6, 3.2, 0.2, 'container_graphite');
  for (const x of [98, 102, 106])
    site.deco('city_highway_barrier', x, 0, 117.6);
  site.deco('city_barrier', 99.5, 0, 112.6);
  site.sign('arrow', 102, 5.6, 113.55, 2.4, 0.9, Math.PI, COLOR.amber);
  site.light(102, 5.4, 112, COLOR.amber, 34, 18, {
    pattern: 'pulse',
    strength: 0.35,
    periodS: 1.4,
  });
  // Niewidoczne zabezpieczenie 0,8 m za ogrodzeniem; zamyka też światło bramy.
  p.safetyBoundary(
    [
      vec(-120.8, 0, 120.8),
      vec(84.8, 0, 120.8),
      vec(84.8, 0, 114.8),
      vec(120.8, 0, 114.8),
      vec(120.8, 0, -60.8),
      vec(60.8, 0, -60.8),
      vec(60.8, 0, -120.8),
      vec(-120.8, 0, -120.8),
    ],
    14,
  );
  arena.roomMeta({
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: vec(-108, 1.5, 119.4),
        size: vec(3, 3, 1),
      },
      {
        id: 'exit',
        role: 'exit',
        position: vec(119.4, 1.5, 100),
        size: vec(1, 3, 3),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Wykop (strefa niska, dno −8 m)

function excavation(site) {
  const { p } = site;
  const y = PIT_Y;
  p.floor(PIT, y, 'excavation_dirt');
  // Ściany całkowicie w obrysie wykopu (bez współpłaszczyznowej koliźji z gruntem).
  const north = -19.8,
    south = 59.8,
    west = -99.8,
    east = -20.2;
  // Szalunek od strony szkieletu i placu składowego, ziemia od zachodu i południa.
  p.wall(
    vec(-99.6, y, north),
    vec(-20.4, y, north),
    8,
    0.4,
    'formwork_plywood',
  );
  p.wall(vec(east, y, -20), vec(east, y, 59.6), 8, 0.4, 'formwork_plywood', {
    openings: [{ at: 75.6, width: 8, height: 8 }],
  });
  p.wall(vec(-99.6, y, south), vec(-20.4, y, south), 8, 0.4, 'excavation_dirt');
  p.wall(vec(west, y, -19.6), vec(west, y, 60), 8, 0.4, 'excavation_dirt', {
    openings: [{ at: 4, width: 8, height: 8 }],
  });
  // Ścianka szalunkowa: dźwigary stalowe co 5 m pod oczepem (oczep je podpiera wizualnie i w check).
  site.solid(-20.65, -0.45, 15, 0.5, 0.45, 70, 'metal');
  for (let z = -17.5; z <= 47.5; z += 5)
    site.solid(-20.55, y, z, 0.3, 7.55, 0.3, 'rust');
  site.solid(-20.6, -4.6, 15, 0.3, 0.35, 70, 'metal');
  site.solid(-36, -4.6, -19.45, 24, 0.35, 0.3, 'metal');
  // Rampy dla ciężarówek wzdłuż X (nawigacja), z nasypem pod spodem.
  // Północna: z zachodniego pasa przez spocznik −4 m (porzucona betonomieszarka).
  site.earthRamp(vec(-100, 0), vec(-80, -4), 8, -15.6, y);
  site.solid(-75, y, -15.6, 10, 4, 8, 'excavation_dirt', { walkable: true });
  site.keepOut(y, R(-80, -70, -19.6, -11.6), 'spocznik');
  site.earthRamp(vec(-70, -4), vec(-50, -8), 8, -15.6, y);
  site.deco('build_mixer_truck', -75, -4, -18.3, QUARTER);
  site.hidden(-75, -4, -18.3, SIZE.mixer.z, SIZE.mixer.y, SIZE.mixer.x);
  site.decal('tire_marks', -75, -3.99, -14, 9, 3, Math.PI / 2, 0.5);
  // Południowa: ze wschodniej drogi wprost na dno (32 m, 14°).
  site.earthRamp(vec(-20, 0), vec(-52, -8), 8, 55.6, y);
  // Schody stalowe w dwóch biegach ze spocznikiem (droga gracza, stopień 0,29 × 0,3 m).
  const stairTower = (x0, wallZ, dir) => {
    // dir = +1: ściana północna (bieg w stronę +Z do wnętrza), −1: południowa.
    const lane1 = wallZ + dir * 1.0,
      lane2 = wallZ + dir * 3.0;
    const zr = (a, b) => R(x0 - 10.4, x0, Math.min(a, b), Math.max(a, b));
    p.floor(
      R(
        x0 - 4,
        x0,
        Math.min(wallZ, wallZ + 2 * dir),
        Math.max(wallZ, wallZ + 2 * dir),
      ),
      0,
      'steel_grating',
      { thickness: 0.2 },
    );
    p.stairs({
      from: vec(x0 - 4, 0, lane1),
      to: vec(x0 - 8.2, -4, lane1),
      width: 2,
      stepRise: 0.3,
      stepDepth: 0.3,
      material: 'steel_grating',
    });
    p.floor(
      R(
        x0 - 10.2,
        x0 - 8.2,
        Math.min(wallZ, wallZ + 4 * dir),
        Math.max(wallZ, wallZ + 4 * dir),
      ),
      -4,
      'steel_grating',
      { thickness: 0.2 },
    );
    p.stairs({
      from: vec(x0 - 8.2, -4, lane2),
      to: vec(x0 - 4, y, lane2),
      width: 2,
      stepRise: 0.3,
      stepDepth: 0.3,
      material: 'steel_grating',
    });
    for (const x of [x0 - 0.1, x0 - 3.9])
      site.solid(x, y, wallZ + dir * 1.95, 0.12, 7.8, 0.12, 'metal');
    for (const x of [x0 - 10.1, x0 - 8.3])
      site.solid(x, y, wallZ + dir * 3.95, 0.12, 3.8, 0.12, 'metal');
    site.solid(x0 - 2, 0, wallZ + dir * 2.03, 4, 1.05, 0.05, 'metal');
    site.solid(x0 - 9.2, -4, wallZ + dir * 4.03, 2, 1.05, 0.05, 'metal');
    site.keepOut(y, zr(wallZ, wallZ + 4.4 * dir), 'schody wykopu');
    site.keepOut(
      0,
      R(
        x0 - 4.5,
        x0 + 0.5,
        Math.min(wallZ, wallZ - 3 * dir),
        Math.max(wallZ, wallZ - 3 * dir),
      ),
      'wejście na schody',
    );
  };
  stairTower(-28, -19.6, 1);
  stairTower(-74, 59.6, -1);
  // Palownice: podwozie, kabina, maszt z głowicą na szczycie (maszt podpiera głowicę).
  const rig = (x, z, alongX) => {
    const [bx, bz] = alongX ? [5.2, 3.4] : [3.4, 5.2];
    if (
      !site.reserve(
        y,
        R(
          x - bx / 2 - 1.4,
          x + bx / 2 + 1.4,
          z - bz / 2 - 1.4,
          z + bz / 2 + 1.4,
        ),
        'palownica',
      )
    )
      return;
    site.solid(x, y, z, bx, 1.4, bz, 'crane_paint');
    site.solid(
      x + (alongX ? 1.2 : 0),
      y + 1.4,
      z + (alongX ? 0 : 1.2),
      2.2,
      2.1,
      2.2,
      'crane_paint',
    );
    const mx = x + (alongX ? -bx / 2 - 0.45 : 0),
      mz = z + (alongX ? 0 : -bz / 2 - 0.45);
    site.solid(mx, y, mz, 0.8, 12, 0.8, 'crane_paint');
    site.solid(mx, y + 12, mz, 1.4, 1.1, 1.4, 'metal');
    site.solid(mx, y, mz, 1.1, 0.6, 1.1, 'concrete_raw_cast');
    // Lampa robocza poniżej krawędzi wykopu: plama światła ląduje na dnie.
    site.light(mx + 1.5, -1.5, mz + 1.5, COLOR.amber, 24, 16, {
      pattern: 'pulse',
      strength: 0.5,
      periodS: 1.1,
    });
  };
  rig(-36, 34, false);
  rig(-86, 6, true);
  // Głowice pali w rastrze 5 m — niska osłona przy palownicy.
  for (let x = -52; x <= -40; x += 6)
    for (let z = 42; z <= 50; z += 4)
      site.crate(x, y, z, 1.2, 0.5, 1.2, 'concrete_raw_cast', 'pal');
  // Skrzynie i kontenery narzędziowe wokół A (osłony co 8–15 m).
  site.prop(
    'port_container_20_olive',
    -73,
    y,
    32,
    SIZE.c20,
    0,
    'container_olive',
  );
  site.prop('port_container_20_navy', -44, y, 6, SIZE.c20, 1, 'container_navy');
  site.prop(
    'build_precast_stack',
    -58,
    y,
    6,
    SIZE.precast,
    0,
    'concrete_raw_cast',
  );
  site.prop('build_pipe_stack', -82, y, 40, SIZE.pipes, 0, 'concrete_raw_cast');
  site.prop('build_rebar_bundle', -62, y, 38, SIZE.rebar, 0, 'rust');
  site.prop('build_rebar_bundle', -62, y + 0.59, 38, SIZE.rebar, 0, 'rust');
  site.prop('build_rebar_bundle', -30, y, 20, SIZE.rebar, 1, 'rust');
  site.prop('city_generator', -90, y, 50, SIZE.generator, 0);
  site.prop('city_crates', -88, y, 24, SIZE.crates, 0);
  site.prop('city_crates', -32, y, 44, SIZE.crates, 1);
  for (const [x, z, sx, sz] of [
    [-69, 12, 2.4, 1.2],
    [-50, 28, 1.6, 1.6],
    [-72, 22, 1.2, 2.4],
    [-48, 16, 2.4, 1.2],
    [-66, 2, 1.6, 1.6],
    [-92, 32, 2.4, 1.2],
  ]) {
    if (site.crate(x, y, z, sx, 1.2, sz))
      site.solid(x, y + 1.2, z, sx * 0.5, 1.0, sz * 0.5, 'formwork_plywood');
  }
  for (const [x, z] of [
    [-54, 44],
    [-80, 18],
    [-36, -4],
  ])
    site.deco('city_traffic_cone', x, y, z, x);
  // Kałuże błota na dnie wykopu.
  for (const [x, z, w, r] of [
    [-62, 26, 6, 0.3],
    [-46, 12, 5, 1.2],
    [-80, 30, 7, 2.1],
    [-70, -2, 6, 2.6],
  ])
    site.decal(
      r > 1.5 ? 'puddle2' : 'puddle1',
      x,
      y + 0.01,
      z,
      w,
      w * 0.7,
      r,
      0.75,
    );
  site.decal('tire_marks', -38, -3.9, 55.6, 10, 3, Math.PI / 2, 0.45);
  // Oświetlenie: robocze bursztynowe na ścianie szalunkowej, ciepłe naświetlacze z krawędzi.
  site.light(-21.5, -3.5, 4, COLOR.amber, 28, 20);
  site.light(-21.5, -3.5, 36, COLOR.amber, 28, 20);
  site.light(-42, -2, -17, COLOR.warm, 30, 24);
  site.light(-96, -3, 30, COLOR.warm, 30, 22);
  // Maszt naświetlaczy na dnie wykopu (widoczny znad krawędzi) i bursztyn przy A.
  // Światła poniżej poziomu terenu, żeby plamy padały na dno, nie nad wykop.
  if (site.reserve(y, R(-51.8, -48.2, 34.2, 37.8), 'maszt wykopu')) {
    site.deco('port_light_tower', -50, y, 36);
    site.hidden(-50, y, 36, 1.6, 20, 1.6);
    site.light(-50, -1, 36, COLOR.warm, 36, 30);
  }
  site.light(-60, -5, 20, COLOR.amber, 20, 14);
  site.zone('Wykop', PIT, 'low');
}

// ---------------------------------------------------------------------------
// Szkielet wieżowca (strefa wysoka, stropy co 4 m do 24 m)

const CORES = [
  { rect: R(14, 30, -45, -38), lane: R(16, 28, -41, -38), sideDoor: 'west' },
  { rect: R(50, 66, -12, -5), lane: R(52, 64, -8, -5), sideDoor: 'east' },
];
const ATRIUM = R(25, 33, -22, -16);
const UNFINISHED = {
  12: [R(52, 70, -60, -40)],
  16: [R(10, 16, -20, 10)],
  20: [R(10, 36, -6, 10)],
  24: [R(10, 44, -20, 10)],
};
const COLUMNS_X = [12, 23, 34, 46, 57, 68];
const COLUMNS_Z = [-58, -47, -36, -25, -14, -3, 8];
// Rusztowania: lica południowe (do 24 m) i zachodnie (do 12 m).
const SCAFFOLD_S = { lane: R(38.5, 53.5, 10, 12.6), top: 24 };
const SCAFFOLD_W = { lane: R(7.4, 10, -27.5, -12.5), top: 12 };

function tower(site) {
  const { p, arena } = site;
  const holes = (level) =>
    level === 0
      ? []
      : [
          ...CORES.map((c) => c.lane),
          ...(level <= 16 ? [ATRIUM] : []),
          ...(UNFINISHED[level] ?? []),
        ];
  const slabs = {};
  for (const level of LEVELS)
    slabs[level] = p.slab({
      rect: TOWER,
      y: level,
      holes: holes(level),
      material: 'concrete_raw_cast',
    });
  // Pokrycie liczone dla sumy kawałków stropu (szwy po cięciu otworów nie przeszkadzają).
  const inside = (level, x, z) =>
    slabs[level].pieces.some(
      (r) =>
        x >= r.minX - 1e-6 &&
        x <= r.maxX + 1e-6 &&
        z >= r.minZ - 1e-6 &&
        z <= r.maxZ + 1e-6,
    );
  const grid = [-1, -0.5, 0, 0.5, 1];
  const covered = (level, x, z, m = 0.35) =>
    grid.every((u) => grid.every((v) => inside(level, x + u * m, z + v * m)));
  site.covered = covered;
  for (const level of LEVELS.slice(1))
    for (const hole of holes(level)) site.keepOut(level, hole, 'otwór stropu');
  // Słupy tylko pod stropem (i na stropie poniżej); ostatnia kondygnacja z modelem
  // niedokończonego słupa przeskalowanym do 3,6 m.
  for (let i = 0; i < LEVELS.length - 1; i++) {
    const base = LEVELS[i],
      top = LEVELS[i + 1];
    for (const x of COLUMNS_X)
      for (const z of COLUMNS_Z) {
        if (!covered(base, x, z) || !covered(top, x, z)) continue;
        site.keepOut(base, R(x - 1, x + 1, z - 1, z + 1), 'słup');
        if (top === 24) {
          site.deco('build_unfinished_column', x, base, z, 0, 0.75);
          site.hidden(x, base, z, 0.46, 3.6, 0.46);
        } else site.solid(x, base, z, 0.6, 3.6, 0.6, 'concrete_raw_cast');
      }
  }
  // Dwa trzony klatek: ściany 0–27 m z drzwiami na każdej kondygnacji i dachem
  // maszynowni. Biegi wzdłuż X po 48 stopni 0,25 × 0,083 m: kapsuła wroga (bez
  // autostepu) wjeżdża po nich jak po pochylni, gracz używa autostepu.
  for (const core of CORES) {
    const r = core.rect,
      lane = core.lane,
      height = 27;
    const doors = (at) =>
      LEVELS.map((level) => ({ at, width: 3, height: 2.8, bottom: level }));
    p.wall(
      vec(r.minX, 0, r.minZ),
      vec(r.maxX, 0, r.minZ),
      height,
      0.4,
      'concrete_raw_cast',
      { openings: doors(8) },
    );
    p.wall(
      vec(r.minX, 0, r.maxZ),
      vec(r.maxX, 0, r.maxZ),
      height,
      0.4,
      'concrete_raw_cast',
    );
    p.wall(
      vec(r.minX, 0, r.minZ),
      vec(r.minX, 0, r.maxZ),
      height,
      0.4,
      'concrete_raw_cast',
      {
        openings:
          core.sideDoor === 'west' ? [{ at: 2, width: 3, height: 2.8 }] : [],
      },
    );
    p.wall(
      vec(r.maxX, 0, r.minZ),
      vec(r.maxX, 0, r.maxZ),
      height,
      0.4,
      'concrete_raw_cast',
      {
        openings:
          core.sideDoor === 'east' ? [{ at: 2, width: 3, height: 2.8 }] : [],
      },
    );
    p.floor(
      R(r.minX - 0.2, r.maxX + 0.2, r.minZ - 0.2, r.maxZ + 0.2),
      height + 0.4,
      'concrete_raw_cast',
      { walkable: false },
    );
    const zc = (lane.minZ + lane.maxZ - 0.2) / 2;
    for (let i = 0; i < LEVELS.length - 1; i++)
      p.stairs({
        from: vec(lane.minX, LEVELS[i], zc),
        to: vec(lane.maxX, LEVELS[i + 1], zc),
        width: 2.8,
        stepRise: 0.085,
        stepDepth: 0.25,
        material: 'concrete_raw_cast',
      });
    for (const level of LEVELS)
      site.keepOut(
        level,
        R(r.minX - 0.4, r.maxX + 0.4, r.minZ - 2.4, r.maxZ + 0.4),
        'trzon',
      );
    // Bursztynowa lampa klatki co dwie kondygnacje.
    site.light((r.minX + r.maxX) / 2, 15, r.minZ + 2, COLOR.amber, 22, 12);
  }
  // Rusztowania z biegami wzdłuż lica: drugi pion dostępny dla gracza i AI.
  const scaffold = ({ lane, top }, alongX) => {
    const flights = top / 4;
    for (let i = 0; i < flights; i++) {
      const level = LEVELS[i];
      if (alongX) {
        const zc = (lane.minZ + lane.maxZ) / 2;
        p.stairs({
          from: vec(lane.minX + 1.5, level, zc),
          to: vec(lane.maxX - 1.5, level + 4, zc),
          width: lane.maxZ - lane.minZ,
          stepRise: 0.085,
          stepDepth: 0.25,
          material: 'scaffold_planks',
        });
        if (i > 0)
          p.floor(
            R(lane.minX, lane.minX + 1.5, lane.minZ, lane.maxZ),
            level,
            'scaffold_planks',
            { thickness: 0.15 },
          );
        p.floor(
          R(lane.maxX - 1.5, lane.maxX, lane.minZ, lane.maxZ),
          level + 4,
          'scaffold_planks',
          { thickness: 0.15 },
        );
      } else {
        const xc = (lane.minX + lane.maxX) / 2;
        p.stairs({
          from: vec(xc, level, lane.maxZ - 1.5),
          to: vec(xc, level + 4, lane.minZ + 1.5),
          width: lane.maxX - lane.minX,
          stepRise: 0.085,
          stepDepth: 0.25,
          material: 'scaffold_planks',
        });
        if (i > 0)
          p.floor(
            R(lane.minX, lane.maxX, lane.maxZ - 1.5, lane.maxZ),
            level,
            'scaffold_planks',
            { thickness: 0.15 },
          );
        p.floor(
          R(lane.minX, lane.maxX, lane.minZ, lane.minZ + 1.5),
          level + 4,
          'scaffold_planks',
          { thickness: 0.15 },
        );
      }
    }
    // Ramy build_scaffold_bay od zewnątrz biegu: co 2,5 m wzdłuż lica i co 2 m w górę.
    const bays = Math.round(
      (alongX ? lane.maxX - lane.minX : lane.maxZ - lane.minZ) / 2.5,
    );
    for (let level = 0; level < top; level += 2)
      for (let i = 0; i < bays; i++) {
        if (alongX)
          site.deco(
            'build_scaffold_bay',
            lane.minX + 1.25 + 2.5 * i,
            level,
            lane.maxZ + 0.7,
            0,
          );
        else
          site.deco(
            'build_scaffold_bay',
            lane.minX - 0.7,
            level,
            lane.minZ + 1.25 + 2.5 * i,
            -QUARTER,
          );
      }
    // Niewidoczna poręcz między biegiem a ramami oraz na końcach spoczników.
    // Od 2,2 m: przy gruncie wejście do biegu jest otwarte z każdej strony.
    const b = 2.2,
      h = top + 2 - b;
    if (alongX) {
      site.hidden(
        (lane.minX + lane.maxX) / 2,
        b,
        lane.maxZ + 0.05,
        lane.maxX - lane.minX,
        h,
        0.1,
      );
      for (const x of [lane.minX - 0.05, lane.maxX + 0.05])
        site.hidden(
          x,
          b,
          (lane.minZ + lane.maxZ) / 2,
          0.1,
          h,
          lane.maxZ - lane.minZ,
        );
    } else {
      site.hidden(
        lane.minX - 0.05,
        b,
        (lane.minZ + lane.maxZ) / 2,
        0.1,
        h,
        lane.maxZ - lane.minZ,
      );
      for (const z of [lane.minZ - 0.05, lane.maxZ + 0.05])
        site.hidden(
          (lane.minX + lane.maxX) / 2,
          b,
          z,
          lane.maxX - lane.minX,
          h,
          0.1,
        );
    }
    for (let level = 0; level <= top; level += 4)
      site.keepOut(
        level,
        R(lane.minX - 1.5, lane.maxX + 1.5, lane.minZ - 1.5, lane.maxZ + 1.5),
        'rusztowanie',
      );
  };
  scaffold(SCAFFOLD_S, true);
  scaffold(SCAFFOLD_W, false);
  // Niewidoczne zabezpieczenie krawędzi tylko na 20 i 24 m (bez barierek wizualnych).
  const landingGaps = (level) =>
    [SCAFFOLD_S].flatMap(({ lane, top }) =>
      level > top
        ? []
        : [
            [lane.minX, lane.minX + 1.5],
            [lane.maxX - 1.5, lane.maxX],
          ],
    );
  for (const level of [20, 24]) {
    const edge = (fixed, axis, from, to, outward, gaps = []) => {
      let start;
      for (let s = from; s <= to + 1e-6; s += 0.5) {
        const inside =
          axis === 'x'
            ? covered(level, s, fixed - outward * 0.3, 0.05)
            : covered(level, fixed - outward * 0.3, s, 0.05);
        const open =
          inside && !gaps.some(([a, b]) => s > a - 0.25 && s < b + 0.25);
        if (open && start === undefined) start = s;
        if ((!open || s >= to) && start !== undefined) {
          const end = open ? s : s - 0.5;
          if (end - start > 0.4) {
            if (axis === 'x')
              site.hidden(
                (start + end) / 2,
                level,
                fixed + outward * 0.05,
                end - start + 0.5,
                2,
                0.1,
              );
            else
              site.hidden(
                fixed + outward * 0.05,
                level,
                (start + end) / 2,
                0.1,
                2,
                end - start + 0.5,
              );
          }
          start = undefined;
        }
      }
    };
    edge(TOWER.minZ, 'x', TOWER.minX + 0.25, TOWER.maxX - 0.25, -1);
    edge(
      TOWER.maxZ,
      'x',
      TOWER.minX + 0.25,
      TOWER.maxX - 0.25,
      1,
      landingGaps(level),
    );
    edge(TOWER.minX, 'z', TOWER.minZ + 0.25, TOWER.maxZ - 0.25, -1);
    edge(TOWER.maxX, 'z', TOWER.minZ + 0.25, TOWER.maxZ - 0.25, 1);
  }
  site.slabs = slabs;
  arena.roomMeta({
    rainShelters: [
      ...(arena.toRoom().rainShelters ?? []),
      { position: vec(40, 12, -25), size: vec(60, 24, 70) },
    ],
  });
}

/** Rekwizyty i osłony na kondygnacjach szkieletu. */
function towerFloors(site) {
  const at = (level, list) => {
    for (const [kind, x, z, q = 0] of list) {
      if (!site.covered(level, x, z, 1.5)) {
        site.arena.warn(
          'tower-prop',
          `Rekwizyt ${kind} poza stropem ${level} m (${x}, ${z}).`,
        );
        continue;
      }
      if (kind === 'rebar')
        site.prop('build_rebar_bundle', x, level, z, SIZE.rebar, q, 'rust');
      else if (kind === 'precast')
        site.prop(
          'build_precast_stack',
          x,
          level,
          z,
          SIZE.precast,
          q,
          'concrete_raw_cast',
        );
      else if (kind === 'crates')
        site.prop('city_crates', x, level, z, SIZE.crates, q);
      else if (kind === 'generator')
        site.prop('city_generator', x, level, z, SIZE.generator, q);
      else if (kind === 'c20')
        site.prop(
          'port_container_20_graphite',
          x,
          level,
          z,
          SIZE.c20,
          q,
          'container_graphite',
        );
      else if (kind === 'ply') {
        const [sx, sz] = q % 2 ? [1.25, 2.5] : [2.5, 1.25];
        if (site.crate(x, level, z, sx, 0.9, sz, 'formwork_plywood', 'sklejka'))
          site.solid(
            x,
            level + 0.9,
            z,
            sx * 0.92,
            0.5,
            sz * 0.92,
            'formwork_plywood',
          );
      } else if (kind === 'pallet') {
        if (
          site.crate(x, level, z, 1.2, 0.75, 1.0, 'scaffold_planks', 'paleta')
        )
          site.solid(x, level + 0.75, z, 1.1, 0.7, 0.9, 'concrete');
      } else if (kind === 'cone')
        site.deco('city_traffic_cone', x, level, z, x + z);
    }
  };
  at(0, [
    ['c20', 40, -54],
    ['rebar', 18, -20],
    ['precast', 62, -30],
    ['ply', 40, 2],
    ['ply', 30, -6, 1],
    ['crates', 52, -40],
    ['crates', 54, -40.2],
    ['generator', 63, 2],
    ['pallet', 28, -52],
    ['pallet', 30, -52],
    ['cone', 44, 6],
    ['cone', 36, 6],
  ]);
  at(4, [
    ['ply', 40, -30],
    ['crates', 52, -52],
    ['rebar', 18, -30, 1],
    ['pallet', 60, -20],
    ['pallet', 28, 2],
    ['crates', 44, 2],
  ]);
  at(8, [
    ['ply', 40, -33.5],
    ['crates', 31, -28],
    ['crates', 49, -20],
    ['rebar', 41, -15.5],
    ['precast', 60, -32],
    ['pallet', 30, -4],
    ['ply', 18, -52, 1],
    ['crates', 62, -54],
    ['rebar', 52, 4],
  ]);
  at(12, [
    ['ply', 40, -40],
    ['crates', 28, -28],
    ['pallet', 60, 2],
    ['rebar', 18, -2, 1],
    ['generator', 44, -54],
  ]);
  at(16, [
    ['crates', 40, -10],
    ['ply', 52, -30, 1],
    ['pallet', 22, -54],
    ['rebar', 62, -56],
  ]);
  at(20, [
    ['ply', 50, -40],
    ['crates', 30, -30],
    ['pallet', 62, -2],
    ['rebar', 18, -30, 1],
  ]);
  at(24, [
    ['rebar', 30, -55],
    ['pallet', 62, -16],
    ['crates', 52, -28],
    ['ply', 20, -30, 1],
    ['cone', 46, -18],
    ['precast', 60, 4, 1],
    ['generator', 50, -50],
    ['pallet', 36, -44],
    ['pallet', 38, -44],
    ['ply', 24, -53],
    ['crates', 64, -26],
    ['cone', 30, -22],
    ['cone', 40, -22],
  ]);
  // Drugie warstwy wiązek prętów (na pierwszej, bez osobnej rezerwacji).
  site.placeModel('build_rebar_bundle', 18, 0.59, -20, SIZE.rebar);
  site.placeModel('build_rebar_bundle', 30, 24.59, -55, SIZE.rebar);
  // Szalunki na ostatnim stropie: skrzynie słupów (2,8 m) i tarcze ścian przy krawędziach.
  for (const [x, z] of [
    [46, -58],
    [57, -58],
    [68, -47],
    [68, -36],
    [12, -47],
    [23, -58],
    [57, -25],
    [68, -14],
  ])
    if (site.covered(24, x, z, 0.6))
      site.crate(
        x,
        24,
        z,
        0.95,
        2.8,
        0.95,
        'formwork_plywood',
        'szalunek słupa',
      );
  for (const [x, z, sx, sz] of [
    [31, -59.2, 6, 0.3],
    [38, -59.2, 6, 0.3],
    [69.2, -54, 0.3, 6],
    [11, -26, 0.3, 6],
  ])
    site.crate(x, 24, z, sx, 2.6, sz, 'formwork_plywood', 'tarcza szalunkowa');
  // Deskowanie przyszłego stropu nad 20 m: płyta na stemplach przy krawędzi 24 m.
  for (const x of [37, 40.5])
    for (const z of [-19.5, -16]) site.solid(x, 20, z, 0.1, 3.5, 0.1, 'metal');
  site.solid(38.75, 23.5, -17.75, 5, 0.1, 5, 'formwork_plywood');
  site.fx('sparks', 57, 24.6, -24);
  site.fx('sparks', 23, 20.6, -40);
  site.decal('crack_floor', 46, 8.01, -32, 3, 3, 0.7, 0.5);
  site.decal('floor_hazard', 40, 0.01, 8.4, 6, 1.2, 0, 0.7);
  // Girlandy lamp roboczych pod stropami: świecą na elewacjach z daleka (landmark nocą).
  for (const [level, from] of [
    [4, 15],
    [12, 15],
    [20, 45],
  ])
    for (let x = from; x <= 65; x += 10)
      site.deco('city_lantern_string', x, level + 3.4, TOWER.maxZ - 0.3, 0);
  for (const [level, to] of [
    [4, 5],
    [12, -25],
  ])
    for (let z = -55; z <= to; z += 10)
      site.deco(
        'city_lantern_string',
        TOWER.minX + 0.3,
        level + 3.4,
        z,
        QUARTER,
      );
  // Naświetlacze: ciepła biel na parterze, przy B i na szczycie; bursztyn na krawędzi.
  site.light(40, 3.2, -25, COLOR.warm, 24, 20);
  site.light(44, 11, -29, COLOR.warm, 15, 16);
  site.light(25, 19, -50, COLOR.warm, 28, 20);
  site.light(58, 27, -40, COLOR.warm, 26, 24);
  site.light(46, 26.5, -18, COLOR.amber, 26, 18, {
    pattern: 'pulse',
    strength: 0.4,
    periodS: 1.6,
  });
  site.zone('Szkielet wieżowca', TOWER, 'high');
}

function towerCrane(site) {
  // Landmark: maszt 65 m; wysięgnik nad szkieletem, przeciwwysięgnik nad zapleczem.
  const yaw = Math.atan2(40 - CRANE.x, -25 - CRANE.z);
  site.deco('build_tower_crane', CRANE.x, 0, CRANE.z, yaw);
  site.solid(CRANE.x, 0, CRANE.z, 6.4, 1.2, 6.4, 'concrete_raw_cast');
  site.hidden(CRANE.x, 1.2, CRANE.z, 2.4, 50, 2.4);
  site.keepOut(
    0,
    R(CRANE.x - 5, CRANE.x + 5, CRANE.z - 5, CRANE.z + 5),
    'żuraw',
  );
  for (const [x, z, q] of [
    [74.2, 30, 1],
    [85.8, 30, 1],
    [80, 24.2, 0],
    [80, 35.8, 0],
  ])
    site.prop('city_barrier', x, 0, z, SIZE.barrier, q, 'concrete', 0.1);
  site.decal('floor_hazard', CRANE.x, 1.21, CRANE.z + 2.6, 5, 1, 0, 0.6);
  site.prop(
    'port_container_20_graphite',
    92,
    0,
    22,
    SIZE.c20,
    1,
    'container_graphite',
  );
  site.prop('city_generator', 90, 0, 32, SIZE.generator, 1);
  site.light(CRANE.x + 3, 6, CRANE.z, COLOR.amber, 24, 14, {
    pattern: 'buzz',
    strength: 0.2,
  });
}

// ---------------------------------------------------------------------------
// Plac składowy (strefa gęsta)

function storageYard(site) {
  const precastLot = (r, layers = 1, q = 0) => {
    const [sx, sz] =
      q % 2
        ? [SIZE.precast.z, SIZE.precast.x]
        : [SIZE.precast.x, SIZE.precast.z];
    for (let x = r.minX + sx / 2; x + sx / 2 <= r.maxX + 1e-6; x += sx + 0.8)
      for (
        let z = r.minZ + sz / 2;
        z + sz / 2 <= r.maxZ + 1e-6;
        z += sz + 0.8
      ) {
        if (
          !site.prop(
            'build_precast_stack',
            x,
            0,
            z,
            SIZE.precast,
            q,
            'concrete_raw_cast',
            0.2,
          )
        )
          continue;
        for (let l = 1; l < layers; l++)
          site.placeModel(
            'build_precast_stack',
            x,
            l * 1.6,
            z,
            SIZE.precast,
            q,
          );
      }
  };
  const pipeLot = (r) => {
    for (let x = r.minX + 1.6; x + 1.5 <= r.maxX + 1e-6; x += 3.6)
      for (let z = r.minZ + 1.6; z + 1.5 <= r.maxZ + 1e-6; z += 3.8)
        site.prop(
          'build_pipe_stack',
          x,
          0,
          z,
          SIZE.pipes,
          0,
          'concrete_raw_cast',
          0.2,
        );
  };
  const rebarLot = (r) => {
    let row = 0;
    for (let z = r.minZ + 0.6; z + 0.5 <= r.maxZ; z += 2.2, row++)
      for (let x = r.minX + 3; x + 3 <= r.maxX + 1e-6; x += 6.6) {
        // Podkłady z kantówki pod wiązkami; 1–2 warstwy.
        if (
          !site.prop(
            'build_rebar_bundle',
            x,
            0.12,
            z,
            SIZE.rebar,
            0,
            'rust',
            0.2,
          )
        )
          continue;
        site.solid(x - 2, 0, z, 0.15, 0.12, 1.1, 'formwork_plywood');
        site.solid(x + 2, 0, z, 0.15, 0.12, 1.1, 'formwork_plywood');
        if ((row + Math.round(x)) % 2 === 0)
          site.placeModel('build_rebar_bundle', x, 0.71, z, SIZE.rebar);
      }
  };
  const crateLot = (r) => {
    for (let x = r.minX + 0.8; x + 0.7 <= r.maxX; x += 2.2)
      for (let z = r.minZ + 0.8; z + 0.7 <= r.maxZ; z += 2.4) {
        if (site.rng() < 0.2) continue;
        if (site.rng() < 0.5)
          site.prop(
            'city_crates',
            x,
            0,
            z,
            SIZE.crates,
            Math.floor(site.rng() * 4),
            'metal',
            0.15,
          );
        else if (
          site.crate(x, 0, z, 1.2, 0.75, 1.0, 'scaffold_planks', 'paleta')
        )
          site.solid(
            x,
            0.75,
            z,
            1.1,
            0.75 * Math.ceil(site.rng() * 2),
            0.9,
            'concrete',
          );
      }
  };
  const containerLot = (r, models, layers = 1) => {
    models.forEach((model, i) => {
      const size = model.includes('_40_') ? SIZE.c40 : SIZE.c20;
      const x = r.minX + size.x / 2,
        z = r.minZ + size.z / 2 + i * (size.z + 0.6);
      if (z + size.z / 2 > r.maxZ + 1e-6) return;
      const color = model.split('_').at(-1);
      if (!site.prop(model, x, 0, z, size, 0, `container_${color}`, 0.2))
        return;
      for (let l = 1; l < layers; l++) {
        const next = ['navy', 'olive', 'ochre', 'graphite'][(i + l) % 4];
        site.placeModel(
          model.replace(color, next),
          x,
          l * 2.591,
          z,
          size,
          0,
          `container_${next}`,
        );
      }
    });
  };
  // Hałda: rampa X, płaski szczyt 3 m i zejście (punkt widokowy nad stosami).
  const heap = (x0, z, length = 30) => {
    const top = 3;
    site.earthRamp(vec(x0, 0), vec(x0 + 12, top), 8, z, 0);
    site.solid(x0 + length / 2, 0, z, length - 24, top, 8, 'excavation_dirt', {
      walkable: true,
    });
    site.earthRamp(vec(x0 + length - 12, top), vec(x0 + length, 0), 8, z, 0);
    site.keepOut(0, R(x0 - 1.5, x0 + length + 1.5, z - 5, z + 5), 'hałda');
    site.keepOut(
      top,
      R(x0 + 11, x0 + length - 11, z - 4, z + 4),
      'szczyt hałdy',
    );
  };
  heap(-98, -54);
  heap(-34, -104);
  // Partie składowania rozdzielone przejściami 3–6 m (linia widoku łamana co 20–40 m).
  precastLot(R(-100, -86, -110, -100), 2);
  pipeLot(R(-82, -70, -110, -98));
  containerLot(
    R(-66, -54, -108, -100),
    ['port_container_40_ochre', 'port_container_40_navy'],
    2,
  );
  rebarLot(R(-50, -38, -110, -98));
  crateLot(R(-100, -90, -96, -90));
  precastLot(R(-100, -86, -88, -80), 1);
  pipeLot(R(-100, -90, -76, -64));
  precastLot(R(-84, -62, -86, -82), 2);
  rebarLot(R(-84, -70, -74, -64));
  crateLot(R(-66, -58, -70, -62));
  pipeLot(R(-42, -30, -88, -78));
  precastLot(R(-40, -26, -72, -64), 2);
  containerLot(
    R(-22, -10, -90, -80),
    ['port_container_20_olive', 'port_container_20_graphite'],
    1,
  );
  crateLot(R(-8, -2, -90, -80));
  rebarLot(R(-20, -6, -74, -62));
  precastLot(R(-62, -48, -58, -46), 1);
  pipeLot(R(-44, -32, -56, -44));
  rebarLot(R(-28, -16, -58, -48));
  containerLot(
    R(-12, -2, -56, -44),
    ['port_container_20_navy', 'port_container_20_ochre'],
    2,
  );
  crateLot(R(-34, -24, -94, -90));
  // C: wolna przestrzeń (−50, −75) między stosami; niska osłona z palet przy krawędzi.
  for (const [x, z] of [
    [-57.5, -69],
    [-58, -80],
    [-42, -69.5],
  ])
    site.crate(x, 0, z, 1.2, 0.75, 1.0, 'scaffold_planks', 'paleta');
  site.decal('floor_hazard', -50, 0.01, -82.2, 8, 1, 0, 0.6);
  site.decal('oil_stain', -46, 0.01, -73, 3, 2, 0.6, 0.6);
  // Maszty z naświetlaczami nad przejściami + bursztyn przy C.
  site.mast(-104.5, -78);
  site.mast(-4.5, -96);
  site.light(-50, 4, -75, COLOR.amber, 28, 16);
  site.light(-70, 3, -92, COLOR.amber, 22, 14, {
    pattern: 'buzz',
    strength: 0.3,
  });
  site.zone('Plac składowy', YARD, 'dense');
}

// ---------------------------------------------------------------------------
// Zaplecze budowy (miasteczko kontenerów, strefa mieszana z wnętrzem magazynu)

function compound(site) {
  const { p } = site;
  // Rząd biur w dwóch kondygnacjach z pomostem na 2,591 m i schodami na końcach.
  const officeZ = 47.5,
    x0 = 74;
  for (let i = 0; i < 6; i++) {
    const x = x0 + SIZE.office.x / 2 + i * SIZE.office.x;
    site.prop(
      'build_site_office',
      x,
      0,
      officeZ,
      SIZE.office,
      0,
      'container_graphite',
      0,
    );
    site.placeModel('build_site_office', x, 2.591, officeZ, SIZE.office);
  }
  const x1 = x0 + 6 * SIZE.office.x,
    deckZ = officeZ + SIZE.office.z / 2;
  p.floor(R(x0, x1, deckZ, deckZ + 2), 2.591, 'steel_grating', {
    thickness: 0.15,
  });
  for (let x = x0 + 0.2; x <= x1; x += 6)
    site.solid(x, 0, deckZ + 1.9, 0.15, 2.44, 0.15, 'metal');
  site.solid((x0 + x1) / 2, 2.591, deckZ + 2.03, x1 - x0, 1.0, 0.05, 'metal');
  site.keepOut(0, R(x0 - 6, x1 + 6, officeZ - 2, deckZ + 3), 'biura');
  // Schody biurowe: model + niewidoczne stopnie o tym samym wzniosie (0,173 × 0,32 m).
  const zc = deckZ + 1;
  site.deco('build_site_office_stairs', x0 - 3, 0, zc, 0);
  p.stairs({
    from: vec(x0 - 5.8, 0, zc),
    to: vec(x0 - 1, 2.591, zc),
    width: 1.4,
    stepRise: 0.173,
    stepDepth: 0.3,
    material: 'steel_grating',
    visible: false,
  });
  p.floor(R(x0 - 1, x0, zc - 0.7, zc + 0.7), 2.591, 'steel_grating', {
    thickness: 0.14,
    visible: false,
  });
  site.deco('build_site_office_stairs', x1 + 3, 0, zc, Math.PI);
  p.stairs({
    from: vec(x1 + 5.8, 0, zc),
    to: vec(x1 + 1, 2.591, zc),
    width: 1.4,
    stepRise: 0.173,
    stepDepth: 0.3,
    material: 'steel_grating',
    visible: false,
  });
  p.floor(R(x1, x1 + 1, zc - 0.7, zc + 0.7), 2.591, 'steel_grating', {
    thickness: 0.14,
    visible: false,
  });
  for (const x of [80, 92, 104])
    site.deco(
      'city_ac_unit',
      x,
      3.8,
      officeZ - SIZE.office.z / 2 - 0.26,
      Math.PI,
    );
  site.deco('city_antenna', 86, 5.182, officeZ, 0.4);
  site.deco('city_antenna', 104, 5.182, officeZ, 2.1);
  site.sign('repair', 92, 4.3, deckZ + 0.02, 3, 1.1, 0, COLOR.green);
  site.light(84, 2.2, deckZ + 1, COLOR.green, 26, 14);
  site.light(102, 2.2, deckZ + 1, COLOR.green, 26, 14);
  // Wschodni rząd biur (drzwi na zachód) i stróżówka przy bramie.
  for (let i = 0; i < 4; i++)
    site.prop(
      'build_site_office',
      113.8,
      0,
      60 + i * 6.15,
      SIZE.office,
      3,
      'container_graphite',
      0,
    );
  site.prop(
    'build_site_office',
    88,
    0,
    110.4,
    SIZE.office,
    0,
    'container_navy',
    0.2,
  );
  // Magazyn narzędzi: wnętrze z drzwiami od północy i zachodu.
  const shed = R(94, 112, 90, 104);
  p.building({
    rect: shed,
    height: 4.5,
    wallMaterial: 'corrugated',
    roofMaterial: 'roof_hvac_metal',
    doors: [
      { side: 'north', at: 6, width: 4, height: 3.4 },
      { side: 'west', at: 9, width: 2.4, height: 2.6 },
    ],
    windows: [
      { side: 'north', at: 13, width: 3, height: 1.2, bottom: 1.4 },
      { side: 'east', at: 7, width: 4, height: 1.2, bottom: 1.4 },
    ],
  });
  site.keepOut(
    0,
    R(shed.minX - 0.6, shed.maxX + 0.6, shed.minZ - 0.6, shed.maxZ + 0.6),
    'magazyn',
  );
  for (const x of [98, 103, 108])
    site.solid(x, 0, 102.9, 3.6, 2.2, 0.8, 'metal');
  site.solid(110.5, 0, 95, 1.0, 0.9, 2.4, 'metal');
  site.solid(97, 0, 95.5, 1.2, 1.2, 1.2, 'formwork_plywood');
  site.solid(100.5, 0, 97, 1.6, 0.8, 1.0, 'container_ochre');
  site.light(103, 3.9, 97, COLOR.warm, 26, 12);
  site.sign(
    'warsztat',
    100,
    3.9,
    shed.minZ - 0.22,
    3.2,
    1.0,
    Math.PI,
    COLOR.green,
  );
  site.light(100, 3.6, shed.minZ - 1.5, COLOR.green, 24, 14);
  // Toalety, agregaty, parking i śmietniki.
  for (let i = 0; i < 5; i++) {
    const x = 72.6 + i * 1.3;
    site.solid(x, 0, 107.8, 1.2, 2.3, 1.2, 'container_navy');
    site.solid(x, 2.3, 107.8, 1.25, 0.08, 1.25, 'trim');
  }
  site.keepOut(0, R(71.5, 79.3, 106.6, 109), 'toalety');
  site.prop('city_generator', 72.4, 0, 58, SIZE.generator, 1);
  site.prop('city_generator', 106, 0, 56.5, SIZE.generator, 0);
  site.prop('city_generator', 90, 0, 104.8, SIZE.generator, 0);
  site.deco('city_cable_span', 77, 2.6, 56, QUARTER);
  site.deco('city_cable_span', 101, 2.6, 61, 0);
  for (const [x, z, q] of [
    [80, 90, 0],
    [80, 92.8, 0],
    [80, 95.6, 2],
    [80, 98.4, 0],
    [86.4, 91.4, 2],
    [86.4, 94.2, 2],
    [86.4, 99.8, 0],
  ])
    site.prop('city_car', x, 0, z, SIZE.car, q, 'metal', 0.15);
  site.decal('oil_stain', 83, 0.01, 96, 2, 2, 0.4, 0.6);
  site.prop('city_dumpster', 92.5, 0, 92, SIZE.dumpster, 1);
  site.prop('city_dumpster', 115.5, 0, 88, SIZE.dumpster, 1);
  for (const [x, z] of [
    [114.5, 85.5],
    [113.8, 91],
    [91.6, 95],
  ])
    site.deco('city_trash_bags', x, 0, z, x);
  site.prop('city_vending', 117.2, 0, 52, SIZE.vending, 3);
  // Osłony przy D: skrzynie, bariery, stos sklejki.
  site.prop('city_crates', 84, 0, 68, SIZE.crates, 0);
  site.prop('city_crates', 82.3, 0, 68.3, SIZE.crates, 1, 'metal', 0);
  site.prop('city_highway_barrier', 100, 0, 79, SIZE.jersey, 0, 'concrete', 0);
  site.prop('city_highway_barrier', 104, 0, 79, SIZE.jersey, 0, 'concrete', 0);
  site.crate(98, 0, 64, 2.5, 1.3, 1.25, 'formwork_plywood', 'sklejka');
  site.crate(78, 0, 80, 1.25, 1.3, 2.5, 'formwork_plywood', 'sklejka');
  site.prop('build_pipe_stack', 106, 0, 70, SIZE.pipes, 0, 'concrete_raw_cast');
  // Światła: zieleń zaplecza, ciepła biel masztu i latarni.
  site.mast(117, 43);
  site.light(92, 4.5, 72, COLOR.green, 26, 18);
  site.light(112, 3, 70, COLOR.green, 22, 12);
  site.deco('city_street_lamp', 89, 0, 82, Math.PI);
  site.deco('city_street_lamp', 72, 0, 74, QUARTER);
  site.decal('floor_arrow', 92, 0.01, 62, 2, 4, 0, 0.5);
  site.zone('Zaplecze budowy', COMPOUND, 'interior');
}

// ---------------------------------------------------------------------------
// Plac manewrowy przy wjeździe (strefa otwarta) i pas startowy gracza

function plaza(site) {
  // Rzadkie, ciężkie osłony co 15–25 m: bariery, kontenery, betonomieszarka w użyciu.
  const jersey = (x, z, q = 0) =>
    site.prop('city_highway_barrier', x, 0, z, SIZE.jersey, q, 'concrete', 0);
  for (const x of [30, 34, 38]) jersey(x, 78);
  for (const z of [98, 102]) jersey(2, z, 1);
  for (const x of [48, 52]) jersey(x, 104);
  jersey(8, 72, 1);
  site.prop('build_mixer_truck', 54, 0, 86, SIZE.mixer, 1, 'metal', 0.4);
  site.prop(
    'port_container_20_ochre',
    -6,
    0,
    76,
    SIZE.c20,
    1,
    'container_ochre',
  );
  site.prop('port_container_20_navy', 64, 0, 70, SIZE.c20, 0, 'container_navy');
  site.prop(
    'port_container_20_olive',
    32,
    0,
    112,
    SIZE.c20,
    0,
    'container_olive',
  );
  site.prop(
    'build_precast_stack',
    10,
    0,
    108,
    SIZE.precast,
    0,
    'concrete_raw_cast',
  );
  site.prop(
    'build_precast_stack',
    32,
    0,
    98,
    SIZE.precast,
    1,
    'concrete_raw_cast',
  );
  site.prop('build_rebar_bundle', -8, 0, 98, SIZE.rebar, 1, 'rust');
  site.prop('build_rebar_bundle', 8, 0, 90, SIZE.rebar, 1, 'rust');
  site.prop('build_pipe_stack', 62, 0, 112, SIZE.pipes, 0, 'concrete_raw_cast');
  for (const [x, z] of [
    [20, 80],
    [26, 82],
    [12, 96],
    [28, 100],
    [44, 92],
    [-2, 88],
    [60, 100],
    [70, 116],
    [80, 116],
    [90, 112],
  ])
    site.deco('city_traffic_cone', x, 0, z, x * 0.3);
  for (const [x, z, r] of [
    [22, 104, 0.2],
    [40, 84, 1.9],
  ])
    site.decal('puddle1', x, 0.01, z, 6, 4, r, 0.6);
  site.decal('tire_marks', 80, 0.01, 113, 16, 3, 0, 0.5);
  site.decal('floor_arrow', 60, 0.01, 115, 2, 4, Math.PI / 2, 0.5);
  site.mast(-14, 114);
  site.mast(44, 68);
  site.light(20, 3, 90, COLOR.amber, 24, 16);
  site.zone('Plac manewrowy i wjazd', PLAZA, 'open');
  // Narożnik startu (SW) i pas zachodni: kontenery socjalne, materiały, maszt.
  site.prop(
    'port_container_20_graphite',
    -70,
    0,
    100,
    SIZE.c20,
    1,
    'container_graphite',
  );
  site.solid(
    -70,
    2.591,
    100,
    SIZE.c20.z,
    SIZE.c20.y,
    SIZE.c20.x,
    'container_navy',
    { visible: false },
  );
  site.deco('port_container_20_navy', -70, 2.591, 100, QUARTER);
  site.prop(
    'port_container_20_ochre',
    -60,
    0,
    110,
    SIZE.c20,
    0,
    'container_ochre',
  );
  site.prop(
    'build_precast_stack',
    -88,
    0,
    76,
    SIZE.precast,
    0,
    'concrete_raw_cast',
  );
  site.prop(
    'build_precast_stack',
    -88,
    1.6,
    76,
    SIZE.precast,
    0,
    'concrete_raw_cast',
  );
  site.prop('build_rebar_bundle', -42, 0, 80, SIZE.rebar, 0, 'rust');
  site.prop('build_rebar_bundle', -36, 0, 96, SIZE.rebar, 1, 'rust');
  site.prop('build_pipe_stack', -50, 0, 88, SIZE.pipes, 0, 'concrete_raw_cast');
  site.prop('city_generator', -108, 0, 82, SIZE.generator, 1);
  site.prop('city_crates', -82, 0, 92, SIZE.crates, 0);
  site.prop('city_crates', -80.4, 0, 92.4, SIZE.crates, 1, 'metal', 0);
  for (const [x, z] of [
    [-92, 66],
    [-64, 66],
    [-56, 66],
    [-30, 66],
    [-24, 70],
  ])
    site.deco('city_traffic_cone', x, 0, z, x);
  site.deco('city_street_lamp', -95, 0, 109, Math.PI * 0.75);
  site.crate(-90, 0, 106, 2.4, 1.2, 1.2, 'formwork_plywood', 'skrzynia');
  site.prop('build_rebar_bundle', -94, 0, 88, SIZE.rebar, 0, 'rust');
  site.mast(-112, 66);
  site.light(-70, 3.4, 96, COLOR.blue, 20, 12);
  // Bariery wzdłuż krawędzi wykopu z przerwami (można zeskoczyć na dno).
  // Co trzecie miejsce wolne: przerwa do zeskoku na dno wykopu.
  for (let i = 0; i < 10; i++)
    if (i % 3 !== 0 && i !== 2)
      site.prop(
        'city_highway_barrier',
        -94 + i * 7.6,
        0,
        61.6,
        SIZE.jersey,
        0,
        'concrete',
        0,
      );
  for (let i = 0; i < 8; i++)
    if (i % 3 !== 1)
      site.prop(
        'city_highway_barrier',
        -92 + i * 7.6,
        0,
        -21.6,
        SIZE.jersey,
        0,
        'concrete',
        0,
      );
  for (let i = 0; i < 8; i++)
    if (i % 3 !== 0)
      site.prop(
        'city_highway_barrier',
        -18.4,
        0,
        -14 + i * 7.6,
        SIZE.jersey,
        1,
        'concrete',
        0,
      );
  // Pas zachodni: kontener magazynowy przy ogrodzeniu, maszt nad wjazdem do rampy.
  site.prop(
    'port_container_40_graphite',
    -115,
    0,
    20,
    SIZE.c40,
    1,
    'container_graphite',
  );
  site.mast(-112, -30);
  site.prop('city_generator', -110, 0, 44, SIZE.generator, 1);
  site.decal('tire_marks', -108, 0.01, -15, 12, 3, 0, 0.45);
  // Pas północny i teren wokół szkieletu: dostawy, kontenery, bariery.
  site.prop(
    'port_container_20_olive',
    30,
    0,
    -92,
    SIZE.c20,
    0,
    'container_olive',
  );
  site.prop(
    'port_container_20_graphite',
    30,
    2.591,
    -92,
    SIZE.c20,
    0,
    'container_graphite',
  );
  site.prop(
    'build_precast_stack',
    46,
    0,
    -80,
    SIZE.precast,
    0,
    'concrete_raw_cast',
  );
  site.prop(
    'build_pipe_stack',
    14,
    0,
    -110,
    SIZE.pipes,
    0,
    'concrete_raw_cast',
  );
  site.prop('build_rebar_bundle', 52, 0, -100, SIZE.rebar, 1, 'rust');
  site.prop('city_crates', 20, 0, -70, SIZE.crates, 0);
  for (const x of [8, 12])
    site.prop('city_highway_barrier', x, 0, -66, SIZE.jersey, 0, 'concrete', 0);
  site.mast(4, -112);
  site.prop(
    'port_container_20_navy',
    100,
    0,
    -30,
    SIZE.c20,
    1,
    'container_navy',
  );
  site.prop(
    'build_precast_stack',
    88,
    0,
    -48,
    SIZE.precast,
    1,
    'concrete_raw_cast',
  );
  site.prop('build_pipe_stack', 106, 0, 4, SIZE.pipes, 0, 'concrete_raw_cast');
  site.prop('city_crates', 96, 0, 8, SIZE.crates, 0);
  site.prop(
    'city_highway_barrier',
    80,
    0,
    -10,
    SIZE.jersey,
    1,
    'concrete',
    0.1,
  );
  site.prop(
    'city_highway_barrier',
    80,
    0,
    -20,
    SIZE.jersey,
    1,
    'concrete',
    0.1,
  );
  site.light(100, 3.4, -30, COLOR.amber, 22, 14);
  site.light(-10, 3.4, -30, COLOR.amber, 22, 14);
  site.deco('city_street_lamp', -4, 0, 20, -QUARTER);
  site.deco('city_street_lamp', -4, 0, -10, -QUARTER);
  site.deco('city_street_lamp', 2, 0, 50, -QUARTER);
}

// ---------------------------------------------------------------------------
// Oprawa za ogrodzeniem: ulice, chodniki i kamienice (bez dostępu gracza)

function surroundings(site) {
  const { p } = site;
  const rng = site.rng;
  const outer = 172;
  // Ulice wokół budowy i plac w wyciętym narożniku NE.
  const street = [
    R(-outer, outer, 120.8, 142),
    R(-outer, outer, -142, -120.8),
    R(-142, -120.8, -120.8, 120.8),
    R(120.8, 142, -60.8, 120.8),
    R(60.8, 142, -120.8, -60.8),
  ];
  for (const r of street) p.floor(r, 0, 'asphalt', { walkable: false });
  // Wąski pas pod ogrodzeniem (od granicy do jezdni), żeby nie było szczeliny.
  for (const r of [
    R(-120.8, 84, 120, 120.8),
    R(84, 120.8, 114, 120.8),
    R(-120.8, 60.8, -120.8, -120),
    R(-120.8, -120, -120, 120),
    R(120, 120.8, -60.8, 114),
    R(60, 60.8, -120, -60.8),
    R(60, 120, -60.8, -60),
  ])
    p.floor(r, 0, 'asphalt', { walkable: false, thickness: 0.4 });
  const sidewalks = [
    R(-outer, outer, 142, 146),
    R(-outer, outer, -146, -142),
    R(-146, -142, -142, 142),
    R(142, 146, -142, 142),
  ];
  for (const r of sidewalks)
    p.floor(r, 0.15, 'paving', { walkable: false, thickness: 0.55 });
  // Pierzeje kamienic: różne szerokości, wysokości i bramy przejazdowe.
  const shopSigns = [
    'bar_24h',
    'hotel',
    'ramen',
    'noodles',
    'pharmacy',
    'karaoke',
    'metro',
    'kebab',
    'tattoo',
    'arcade',
    'implants',
    'cat_cafe',
    'sake',
    'bar_mleczny',
  ];
  const tints = [
    COLOR.amber,
    COLOR.violet,
    COLOR.blue,
    COLOR.warm,
    COLOR.green,
  ];
  let signIndex = 0;
  const row = (side) => {
    // side: kierunek frontu (do budowy). Oś "s" biegnie wzdłuż pierzei.
    const [from, to] =
      side === 'south' || side === 'north'
        ? [-146, 146]
        : [-outer + 4, outer - 4];
    let s = from;
    while (s < to - 8) {
      const width = 12 + Math.floor(rng() * 4) * 3;
      const end = Math.min(to, s + width);
      const height = 12 + Math.floor(rng() * 7) * 3;
      const depth = 18;
      const gap = rng() < 0.18 ? 4 : 0.3;
      const mid = (s + end) / 2,
        len = end - s;
      let x, z, sx, sz, faceYaw, fx, fz;
      if (side === 'south')
        [x, z, sx, sz, faceYaw, fx, fz] = [
          mid,
          146 + depth / 2,
          len,
          depth,
          Math.PI,
          0,
          -1,
        ];
      if (side === 'north')
        [x, z, sx, sz, faceYaw, fx, fz] = [
          mid,
          -146 - depth / 2,
          len,
          depth,
          0,
          0,
          1,
        ];
      if (side === 'west')
        [x, z, sx, sz, faceYaw, fx, fz] = [
          -146 - depth / 2,
          mid,
          depth,
          len,
          QUARTER,
          1,
          0,
        ];
      if (side === 'east')
        [x, z, sx, sz, faceYaw, fx, fz] = [
          146 + depth / 2,
          mid,
          depth,
          len,
          -QUARTER,
          -1,
          0,
        ];
      site.solid(x, 0, z, sx, height, sz, 'facade');
      site.solid(x, height, z, sx + 0.4, 0.6, sz + 0.4, 'roof_tar');
      // Front: parter z roletą/markizą, szyld i klimatyzatory.
      const face = (offset, along) => ({
        x: x + fx * (depth / 2 + offset) + (fx ? 0 : along),
        z: z + fz * (depth / 2 + offset) + (fz ? 0 : along),
      });
      const shutter = face(0.13, -len / 4);
      site.deco('city_shutter', shutter.x, 0, shutter.z, faceYaw);
      const awning = face(0.6, len / 4);
      site.deco('city_awning', awning.x, 3.2, awning.z, faceYaw);
      const door = face(0.12, len / 4);
      site.deco('city_door', door.x, 0, door.z, faceYaw);
      for (const along of [-len / 3, len / 6]) {
        const ac = face(0.26, along);
        site.deco(
          'city_ac_unit',
          ac.x,
          5 + Math.floor(rng() * 3) * 3,
          ac.z,
          faceYaw,
        );
      }
      if (rng() < 0.2) {
        const sign = face(0.15, 0);
        site.sign(
          shopSigns[signIndex++ % shopSigns.length],
          sign.x,
          5 + rng() * (height - 9),
          sign.z,
          3.2,
          1.3,
          faceYaw,
          tints[signIndex % tints.length],
        );
      } else {
        const box = face(0.13, -len / 8);
        site.deco('city_sign_box', box.x, 4.2, box.z, faceYaw);
      }
      if (rng() < 0.35) {
        const escape = face(0.6, 0);
        site.deco('city_fire_escape', escape.x, 4, escape.z, faceYaw);
      }
      // Dach: anteny, zbiorniki, klimatyzacja.
      const roofModels = [
        'city_antenna',
        'city_roof_water_tank',
        'city_roof_hvac_unit',
        'city_satellite_cluster',
      ];
      const n = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++)
        site.deco(
          roofModels[Math.floor(rng() * roofModels.length)],
          x + (rng() - 0.5) * (sx - 6),
          height + 0.6,
          z + (rng() - 0.5) * (sz - 6),
          rng() * Math.PI * 2,
        );
      s = end + gap;
    }
  };
  for (const side of ['south', 'north', 'west', 'east']) row(side);
  // Hologramy reklamowe zwrócone do budowy (widoczne nad ogrodzeniem).
  site.sign('holo_koi', 30, 18, 145.6, 6, 6, Math.PI, COLOR.violet, 'holo');
  site.sign(
    'holo_jellyfish',
    -145.6,
    20,
    -40,
    6,
    7,
    QUARTER,
    COLOR.blue,
    'holo',
  );
  site.sign('holo_drink', 145.6, 16, 60, 5, 6, -QUARTER, COLOR.amber, 'holo');
  site.sign('holo_noodles', -60, 17, -145.6, 6, 5, 0, COLOR.warm, 'holo');
  // Ulica: latarnie, parkujące auta, worki, kiosk, rozpięte kable.
  // Latarnie ulic rzadko: każda to światło z puli i plama na jezdni (wywołania rysowania).
  for (const x of [-90, 10, 110])
    site.deco('city_street_lamp', x, 0.15, 143, Math.PI);
  for (const x of [-70, 30]) site.deco('city_street_lamp', x, 0.15, -143, 0);
  site.deco('city_street_lamp', -143, 0.15, 0, QUARTER);
  site.deco('city_street_lamp', 143, 0.15, 20, -QUARTER);
  for (const [x, z, yaw] of [
    [-80, 139.5, 0],
    [-74, 139.5, 0],
    [40, 139.5, Math.PI],
    [124, 139.5, 0],
    [-20, -139.5, Math.PI],
    [70, -139.5, 0],
    [-139.5, 40, QUARTER],
    [139.5, 30, -QUARTER],
    [90, -100, 0.2],
    [104, -74, 1.3],
  ])
    site.deco('city_car', x, 0, z, yaw);
  site.deco('city_wrecked_car', 138, 0, -110, 0.6);
  for (const [x, z] of [
    [-90, 144.5],
    [10, 144.5],
    [-144.5, -60],
    [144.5, 100],
    [100, -144.5],
  ])
    site.deco('city_trash_bags', x, 0.15, z, x);
  site.deco('city_dumpster', -60, 0.15, 144.6, Math.PI);
  site.deco('city_dumpster', 144.6, 0.15, -10, -QUARTER);
  site.deco('city_kiosk', 60, 0.15, 144.2, Math.PI);
  site.deco('city_kiosk', -144.2, 0.15, 20, QUARTER);
  site.deco('city_vending', -20, 0.15, -144.4, 0);
  site.deco('city_vending', 144.4, 0.15, 40, -QUARTER);
  for (const [x, z, yaw] of [
    [-40, 131, 0],
    [70, 131, 0],
    [-131, -60, QUARTER],
    [131, 50, QUARTER],
    [20, -131, 0],
  ])
    site.deco('city_cable_span', x, 9, z, yaw);
  for (const [x, z] of [
    [-100, 130],
    [50, -131],
    [-131, 30],
    [90, -90],
  ])
    site.fx('steam', x, 0.05, z, 0.6);
  site.decal('manhole', -100, 0.01, 130, 1.2, 1.2, 0, 0.9);
  site.decal('manhole', 90, 0.01, -90, 1.2, 1.2, 0, 0.9);
  for (const [x, z, c] of [
    [-40, 132, COLOR.violet],
    [132, 60, COLOR.blue],
    [90, -95, COLOR.violet],
  ])
    site.light(x, 6, z, c, 30, 22);
}

// ---------------------------------------------------------------------------
// Punkty, spawny, start

function modeLayout(site) {
  const { arena } = site;
  for (const [id, position, radius] of POINTS) {
    arena.point(id, position, radius);
    site.keepOut(
      position.y,
      R(
        position.x - radius - 1,
        position.x + radius + 1,
        position.z - radius - 1,
        position.z + radius + 1,
      ),
      `punkt ${id}`,
    );
  }
  // Pula posiłków: wszystkie strefy i piętra szkieletu, poza punktami i z dala od startu.
  const spawns = [
    // wykop
    vec(-30, PIT_Y, 0),
    vec(-90, PIT_Y, 44),
    vec(-28, PIT_Y, 48),
    vec(-86, PIT_Y, -4),
    // szkielet: parter, 12, 16, 20 i 24 m
    vec(51.5, 0, -52.5),
    vec(17.5, 0, 2.5),
    vec(47.5, 12, -19.5),
    vec(36.5, 16, -52.5),
    vec(62.5, 20, -30.5),
    vec(40.5, 24, -41.5),
    // plac składowy
    vec(-92, 0, -113),
    vec(-18, 0, -95),
    vec(-88, 0, -44),
    vec(-4, 0, -66),
    // teren wokół szkieletu i żurawia
    vec(30, 0, -104),
    vec(104, 0, -44),
    vec(108, 0, 18),
    // zaplecze
    vec(116, 0, 99),
    vec(78, 0, 64),
    // plac manewrowy i pas zachodni
    vec(62, 0, 96),
    vec(-12, 0, 116),
    vec(-110, 0, -2),
    vec(-110, 0, -64),
    vec(-34, 0, 112),
  ];
  for (const s of spawns) {
    arena.arenaSpawn(s);
    if (s.y === 0) arena.spawn(s);
  }
  arena.roomMeta({ playerSpawn: { ...START }, maxAlive: 12 });
  arena.arenaMeta({
    maxAlive: 12,
    enemyTickets: 180,
    spawnRing: { minM: 25, maxM: 85 },
    // Cztery ćwiartki scalania: z otwartej budowy prawie wszystko jest w kadrze,
    // więc wywołania rysowania zależą od liczby materiałów, nie od cullingu.
    batchCellM: 240,
  });
}

export default function generate() {
  const arena = createArena({
    id: 'arenaConstructionSite',
    name: 'Budowa wieżowca',
    theme: 'neonStreet',
    weather: 'clearNight',
    seed: 'construction-site-v1',
    bounds: BOUNDS,
  });
  const site = createSite(arena);
  modeLayout(site);
  ground(site);
  perimeter(site);
  excavation(site);
  tower(site);
  towerFloors(site);
  towerCrane(site);
  storageYard(site);
  compound(site);
  plaza(site);
  surroundings(site);
  arena.roomMeta({
    signs: site.signs,
    decals: site.decals,
    ambientFx: site.ambientFx,
  });
  return arena;
}
