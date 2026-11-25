// Galeria handlowa „Atrium Nova” (run2): trzy kondygnacje wokół atrium, 15 sklepów za kratami.
// Projekt: docs/maps/run2.md (sekcja 5 ma pierwszeństwo). Generator jest deterministyczny.
// Układ: X na wschód, Z na południe. Start przy wejściu głównym (południe), wyjście ewakuacyjne na północy.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRunRoom } from './_runKit.mjs';
import { buildShops } from './_run2Shops.mjs';
import { SPAWNS, dress } from './_run2Dress.mjs';
import {
  COLOR,
  LEVELS,
  Q,
  R,
  ROOF,
  SLAB,
  STORY,
  box,
  createPlacer,
  deck,
  deco,
  glassRail,
  solid,
  spans,
  storyH,
  vec,
} from './_run2Kit.mjs';

const STONE = 'mall_stone_floor';
const INLAY = 'mall_terrazzo_inlay';
const CEIL = 'mall_acoustic_ceiling';
const SLOPE = Math.atan2(5.2, 10.4);

export const shots = [];

// --- Konstrukcja: posadzki, stropy, mury, masy zaplecza ---------------------------------------

function structure(k) {
  // Parter: ciągła posadzka pasażu; pierścień terrazzo wokół atrium.
  const f0 = (rect, m) => deck(k, rect, 0, m, 1);
  for (const s of [-1, 1]) {
    const strip = (a, b, material) =>
      f0(R(Math.min(s * a, s * b), Math.max(s * a, s * b), -25, 25), material);
    strip(12, 12.8, INLAY);
    strip(12.8, 16.6, STONE);
    strip(16.6, 18, INLAY);
  }
  f0(R(-12, 12, -25, -18), STONE);
  f0(R(-12, 12, 18, 25), STONE);
  f0(R(-10, 10, -16, 16), STONE);
  f0(R(-12, 12, -18, -16), INLAY);
  f0(R(-12, 12, 16, 18), INLAY);
  f0(R(-12, -10, -16, 16), INLAY);
  f0(R(10, 12, -16, 16), INLAY);
  // L1 i L2: pasaże wokół otworu atrium. Narożne otwory 4 × 7 m to klatki schodowe.
  for (const level of [1, 2]) {
    const y = LEVELS[level];
    const d = (rect, m) => deck(k, rect, y, m);
    for (const s of [-1, 1]) {
      const mirror = (x0, x1, z0, z1) =>
        R(Math.min(s * x0, s * x1), Math.max(s * x0, s * x1), z0, z1);
      d(mirror(18, 13, -18, 25), STONE);
      d(mirror(13, 12, 18, 25), STONE);
      d(mirror(14, 12, -25, -18), STONE);
      d(mirror(13, 12, -18, 18), INLAY);
      const soffit = (rect) =>
        solid(k, rect, y - SLAB - 0.06, y - SLAB, CEIL, { walkable: false });
      soffit(mirror(18, 12, -18, 25));
      soffit(mirror(14, 12, -25, -18));
    }
    d(R(-12, 12, -25, -19), STONE);
    d(R(-12, 12, 19, 25), STONE);
    d(R(-12, 12, -19, -18), INLAY);
    d(R(-12, 12, 18, 19), INLAY);
    for (const rect of [R(-12, 12, -25, -18), R(-12, 12, 18, 25)])
      solid(k, rect, y - SLAB - 0.06, y - SLAB, CEIL, { walkable: false });
  }
  // Strop nad L2 (ukrywany w ujęciach z góry). Atrium zamyka świetlik.
  for (const rect of [
    R(-25.5, -12, -26, 26),
    R(12, 25.5, -26, 26),
    R(-12, 12, -32.5, -18),
    R(-12, 12, 18, 26),
  ])
    solid(k, rect, ROOF, ROOF + SLAB, CEIL, { ceiling: true });
  // Płyty podłóg sklepów (niegrywalne): na każdej kondygnacji pod blokiem W i E.
  for (const level of [0, 1, 2]) {
    const y = LEVELS[level];
    for (const rect of [R(-24.5, -18, -18, 18), R(18, 24.5, -18, 18)])
      solid(k, rect, y - (level ? SLAB : 1), y, INLAY, { walkable: false });
    if (level)
      solid(k, R(-12, 12, -31.5, -25), y - SLAB, y, INLAY, { walkable: false });
  }
  // Mury zewnętrzne i masy zaplecza.
  solid(k, R(-25.5, -24.5, -26, 26), -1, ROOF, 'plaster');
  solid(k, R(24.5, 25.5, -26, 26), -1, ROOF, 'plaster');
  for (const s of [-1, 1]) {
    const m = (x0, x1, z0, z1) =>
      R(Math.min(s * x0, s * x1), Math.max(s * x0, s * x1), z0, z1);
    solid(k, m(24.5, 18, -26, -18), -1, ROOF, 'tiles_wall');
    solid(k, m(24.5, 18, 18, 26), -1, ROOF, 'tiles_wall');
    solid(k, m(18, 12, -26, -25), -1, ROOF, 'tiles_wall');
  }
  // Wejście główne (południe): mury z otworem 4,8 m na przeszklone drzwi i przedsionek ulicy.
  solid(k, R(-18, -2.4, 25, 26), -1, ROOF, 'tiles_wall');
  solid(k, R(2.4, 18, 25, 26), -1, ROOF, 'tiles_wall');
  solid(k, R(-2.4, 2.4, 25, 26), 3.4, ROOF, 'trim');
  // Północ: parter ma mur z otworem i przedsionek wyjścia, L1 i L2 sklepy N i zaplecza.
  solid(k, R(-12, -2.4, -31.5, -25), -1, STORY, 'tiles_wall');
  solid(k, R(2.4, 12, -31.5, -25), -1, STORY, 'tiles_wall');
  solid(k, R(-2.4, 2.4, -31.5, -25), 3.4, STORY, 'trim');
  solid(k, R(-2.4, 2.4, -31.5, -30.5), -1, 3.4, 'tiles_wall');
  deck(k, R(-2.4, 2.4, -30.5, -25), 0, INLAY, 1);
  solid(k, R(-12.5, 12.5, -32.5, -31.5), STORY, ROOF, 'plaster');
  solid(k, R(-12.5, -12, -31.5, -25), STORY, ROOF, 'plaster');
  solid(k, R(12, 12.5, -31.5, -25), STORY, ROOF, 'plaster');
  // Przedsionek wejścia: ciemna wnęka ze szkłem, neonami ulicy i zamkniętym skrzydłem drzwi gry.
  solid(k, R(-3.4, -2.4, 26, 30.5), -1, 3.6, 'tiles_wall');
  solid(k, R(2.4, 3.4, 26, 30.5), -1, 3.6, 'tiles_wall');
  solid(k, R(-3.4, 3.4, 26, 30.5), 3.6, 4.2, 'trim');
  solid(k, R(-2.4, 2.4, 26, 30.5), -1, 0, 'paving', { walkable: false });
  // Zaplecza (drzwi serwisowe) na bokach W i E oraz na północy L1 i L2.
  for (const level of [0, 1, 2]) {
    const y = LEVELS[level];
    const side = (rect) => solid(k, rect, y, y + storyH(level), 'tiles_wall');
    if (level !== 0) side(R(-24.5, -18, -6, 6));
    side(R(18, 24.5, -6, 6));
  }
  solid(k, R(0, 12, -31.5, -25), LEVELS[1], LEVELS[1] + STORY, 'tiles_wall');
  solid(k, R(-12, 0, -31.5, -25), LEVELS[2], ROOF, 'tiles_wall');
  // Przegrody między sąsiednimi sklepami parteru (zachód).
  for (const z of [-6, 6])
    solid(k, R(-24.5, -18.9, z - 0.15, z + 0.15), 0, STORY, 'plaster');
}

// --- Komunikacja pionowa: ruchome schody, klatki, mostki, winda, słupy, balustrady --------------

function escalator(k, x, yLow, zLow, zHigh) {
  const from = vec(x, yLow, zLow),
    to = vec(x, yLow + 5.2, zHigh);
  const run = k.p.ramp({
    from,
    to,
    width: 2,
    material: 'tread_plate',
    visible: false,
  });
  const ramp = run.blocks[0];
  const rx = ramp.rotation.x;
  const normal = { y: Math.cos(rx), z: Math.sin(rx) };
  const centre = {
    y: (from.y + to.y) / 2,
    z: (from.z + to.z) / 2,
  };
  for (const side of [-1, 1])
    k.arena.block({
      size: vec(0.2, 1.05, ramp.size.z),
      position: vec(
        x + side * 1.1,
        centre.y + normal.y * 0.525,
        centre.z + normal.z * 0.525,
      ),
      rotation: { ...ramp.rotation },
      material: 'metal',
      visible: false,
    });
  deco(
    k,
    'mall_escalator',
    x,
    yLow,
    (zLow + zHigh) / 2,
    zHigh < zLow ? 0 : Math.PI,
  );
}

function stairwell(k, s) {
  const lane = (n) => s * (n === 1 ? 17 : 15);
  const flight = (n, y0, y1, z0, z1) =>
    k.p.ramp({
      from: vec(lane(n), y0, z0),
      to: vec(lane(n), y1, z1),
      width: 2,
      material: 'tread_plate',
    });
  flight(1, 0, 2.6, -18, -23.2);
  flight(2, 2.6, 5.2, -23.2, -18);
  flight(1, 5.2, 7.8, -18, -23.2);
  flight(2, 7.8, 10.4, -23.2, -18);
  for (const y of [2.6, 7.8])
    deck(
      k,
      R(Math.min(s * 14, s * 18), Math.max(s * 14, s * 18), -25, -23.2),
      y,
      STONE,
    );
}

function circulation(k, placer) {
  // Cztery biegi ruchomych schodów (zatrzymane): na krzyż, w obrębie otworu atrium.
  escalator(k, 4.8, 0, 16.4, 6);
  escalator(k, -4.8, 0, -7.6, -18);
  escalator(k, -4.8, 5.2, 6, 16.4);
  escalator(k, 4.8, 5.2, -18, -7.6);
  placer.reserve(R(3.6, 6, 5.4, 17), 0);
  placer.reserve(R(-6, -3.6, -18.6, -7), 0);
  stairwell(k, -1);
  stairwell(k, 1);
  // Mostki nad atrium i podesty wyjść ze schodów.
  deck(k, R(-12, 12, 3, 6), LEVELS[1], STONE);
  solid(k, R(-12, 12, 3, 6), LEVELS[1] - SLAB - 0.06, LEVELS[1] - SLAB, CEIL, {
    walkable: false,
  });
  deck(k, R(-12, 12, -6, -3), LEVELS[2], STONE);
  solid(
    k,
    R(-12, 12, -6, -3),
    LEVELS[2] - SLAB - 0.06,
    LEVELS[2] - SLAB,
    CEIL,
    {
      walkable: false,
    },
  );
  deck(k, R(3.6, 6, -7.6, -6), LEVELS[2], STONE);
  deck(k, R(-6, -3.6, 16.4, 18), LEVELS[2], STONE);
  // Słupy konstrukcyjne atrium.
  for (const s of [-1, 1])
    for (const z of [-18, -9, 0, 9, 18]) {
      box(k, s * 12, ROOF / 2, z, 1, ROOF, 1, 'concrete');
      placer.reserve(R(s * 12 - 0.5, s * 12 + 0.5, z - 0.5, z + 0.5), 0);
    }
  // Oś wejście → fontanna zostaje otwarta; podparcie stoi z boku atrium.
  box(k, -8, ROOF / 2, 18, 1, ROOF, 1, 'concrete');
  placer.reserve(R(-8.5, -7.5, 17.5, 18.5), 0);
  // Winda panoramiczna przy północnym brzegu atrium (kabina zatrzymana między L1 a L2).
  deco(k, 'mall_elevator', 0, 0, -16);
  k.arena.block({
    size: vec(3.6, 15.8, 3.6),
    position: vec(0, 7.9, -16),
    material: 'metal',
    visible: false,
  });
  placer.reserve(R(-1.8, 1.8, -17.8, -14.2), 0);
  // Świetlik: sześć modułów z belką kalenicową (podparcie widocznej oprawy stropowej).
  for (const z of [-15, -9, -3, 3, 9, 15]) {
    deco(k, 'mall_skylight', 0, ROOF, z);
    solid(k, R(-12, 12, z - 0.1, z + 0.1), ROOF + 1.6, ROOF + 1.8, 'metal', {
      ceiling: true,
    });
  }
}

/** Balustrady szklane na krawędziach atrium, mostków i podestów, z przerwami na schody. */
function rails(k) {
  const colZ = [-18, -9, 0, 9, 18];
  for (const level of [1, 2]) {
    const y = LEVELS[level];
    const bridge = level === 1 ? [3, 6] : [-6, -3];
    const between = colZ
      .slice(0, -1)
      .map((z, i) => [z + 0.5, colZ[i + 1] - 0.5]);
    for (const [a, b] of between)
      for (const [s0, s1] of spans(a, b, [bridge]))
        for (const s of [-1, 1]) glassRail(k, 'z', s * 12.1, s0, s1, y);
    const north =
      level === 1
        ? [
            [-1.8, 1.8],
            [-6, -3.6],
            [3.6, 6],
          ]
        : [[-1.8, 1.8]];
    for (const [s0, s1] of spans(-11.5, 11.5, north))
      glassRail(k, 'x', -18.1, s0, s1, y);
    // Tylko podest ESC-3 podpiera przejście przez południową krawędź atrium.
    const south = level === 2 ? [[-6, -3.6]] : [];
    for (const [s0, s1] of spans(-11.5, 11.5, south))
      glassRail(k, 'x', 18.1, s0, s1, y);
    // Otwory klatek schodowych (wschodnia krawędź, wzdłuż biegów).
    for (const s of [-1, 1]) glassRail(k, 'z', s * 13.93, -24.8, -18.4, y);
  }
  // Mostek L1: boki z przerwami na wejścia ruchomych schodów (ESC-1 i ESC-3).
  for (const [s0, s1] of spans(-11.9, 11.9, []))
    glassRail(k, 'x', 3.07, s0, s1, LEVELS[1]);
  for (const [s0, s1] of spans(-11.9, 11.9, [
    [-6, -3.6],
    [3.6, 6],
  ]))
    glassRail(k, 'x', 5.93, s0, s1, LEVELS[1]);
  // Mostek L2: północny bok ma przerwę na podest ESC-4.
  for (const [s0, s1] of spans(-11.9, 11.9, [[3.6, 6]]))
    glassRail(k, 'x', -5.93, s0, s1, LEVELS[2]);
  glassRail(k, 'x', -3.07, -11.9, 11.9, LEVELS[2]);
  // Podesty L2 przy wejściach ruchomych schodów.
  glassRail(k, 'z', 3.67, -7.6, -5.93, LEVELS[2]);
  glassRail(k, 'z', 5.93, -7.6, -5.93, LEVELS[2]);
  glassRail(k, 'z', -5.93, 16.4, 18.1, LEVELS[2]);
  glassRail(k, 'z', -3.67, 16.4, 18.1, LEVELS[2]);
}

export default function generate() {
  const k = createRunRoom({
    id: 'run2',
    name: 'Galeria handlowa Atrium Nova',
    weather: 'mallAfterHours',
    bounds: R(-25.5, 25.5, -32.5, 30),
    startX: 0,
    exitX: 0,
  });
  k.arena.arenaMeta({
    navigationCellM: 0.5,
    navigationClearanceM: 0.4,
    navigationHeadroomM: 2.2,
  });
  const placer = createPlacer(k);
  structure(k);
  circulation(k, placer);
  rails(k);
  buildShops(k, placer);
  dress(k, placer);
  k.arena.roomMeta({
    playerSpawn: vec(0, 0, 22),
    doors: [
      ['entry', 29.5],
      ['exit', -30],
    ].map(([role, z]) => ({
      id: role,
      role,
      position: vec(0, 1.5, z),
      size: vec(4, 3, 1),
    })),
  });
  for (const [x, y, z] of SPAWNS) {
    if (!placer.free(x, z, y, 0.9))
      throw new Error(`Spawn (${x}, ${y}, ${z}) leży przy rekwizycie.`);
    k.arena.floorSpawn(vec(x, y, z));
  }
  k.finish({
    points: [
      ['A', -9, 0, 12],
      ['B', 0, 0, 0],
      ['C', 9, 0, -12],
    ],
    zones: [
      ['Parter i atrium', R(-18, 18, -25, 25), 'open'],
      ['Piętro L1', R(-18, 18, -25, 25), 'interior'],
      ['Piętro L2', R(-18, 18, -25, 25), 'high'],
    ],
    maxAlive: 10,
    minSpawnDistance: 10,
    spawnRing: { minM: 10, maxM: 26 },
  });
  k.arena.arenaMeta({ navigationCellM: 0.5 });
  void COLOR;
  void Q;
  void SLOPE;
  return k.arena;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  generate().write(
    fileURLToPath(
      new URL('../../../src/data/rooms/run2.json', import.meta.url),
    ),
  );
