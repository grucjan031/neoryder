import { distance, vec3, type Vec3 } from '../core/math';
import measured from '../data/render/mapModelBounds.json';
import arenaMaterials from '../data/render/arenaMaterials.json';
import overpass from '../data/render/overpassMaterials.json';
import port from '../data/render/portMaterials.json';
import rail from '../data/render/portRailMaterials.json';
import white from '../data/themes/white.json';
import street from '../data/themes/neonStreet.json';
import hideout from '../data/themes/hideout.json';
import {
  contains,
  intersects,
  modelPoint,
  orientedBox,
  surfaceY,
  type Box,
} from './mapAuditGeometry';

// Metry świata. Montaż ścienny często zostawia szczelinę na ramę lub okap.
const CONTACT = 0.18;
const ANCHOR = 0.32;
// Odsunięcia instalacji na elewacjach z _runKit.face() sięgają 0,6 m.
const WALL_MOUNT = 0.65;
const WALL_FIXTURES = new Set([
  'city_ac_unit',
  'city_awning',
  'city_fire_escape',
  'city_pipe_run',
  'city_door',
  'city_shutter',
  'city_ad_screen',
  'city_sign_box',
  'city_neon_sign_frame',
  'wh_wall_terminal',
  'mall_storefront',
  'mall_shutter_grille',
  'mall_shoe_wall',
  'mall_security_fixture',
  'mall_floor_sign',
  'mall_entrance_doors',
  'lab_blast_door_frame',
  'lab_observation_window',
  'lab_corkboard_evidence',
  'lab_decon_shower',
  'lab_hazmat_suit_rack',
  'off_facade_mullion',
  'off_glass_partition_wall',
  'off_glass_partition_door',
  'off_elevator_shaft_door',
  'off_elevator_call_panel',
  'off_conf_screen_wall',
  'off_whiteboard_wall',
  'off_acoustic_wall_panel',
]);
// Ramy grodzi i bramki skanerów stoją na podłodze, ale w środku podstawy mają celowy otwór przejścia.
const PASSAGE_FIXTURES = new Set([
  'lab_blast_door_frame',
  'lab_bio_scanner_gate',
  'off_glass_partition_door',
  'off_elevator_shaft_door',
  'off_security_turnstile',
]);
const CEILING_FIXTURES = new Set([
  'wh_ceiling_lamp',
  'mall_ceiling_panel',
  'mall_skylight',
  'mall_hanging_banner',
  'lab_ceiling_strip',
  'lab_ceiling_manifold',
  'off_ceiling_light_panel',
  'off_linear_baffle_light',
]);
const EDGE = 0.35;
const LARGE_HEIGHT = 0.6;
const LARGE_BASE = 0.5;
const PENETRATION = 0.22;
const DUPLICATE = 0.015;
const OUTER_WALL_MARGIN = 2;
const MIN_SATURATION = 0.55;
const MIN_VALUE = 0.5;
const HUE_DISTANCE = 13;
const RESERVED = [
  { hue: 358.4, name: 'czerwień' },
  { hue: 186.1, name: 'cyan' },
  { hue: 311.6, name: 'magenta' },
];

interface Placed {
  position: Vec3;
  color?: string;
  tint?: string;
  emissive?: string;
}
interface Block extends Placed {
  size: Vec3;
  material?: string;
  model?: string;
  rotation?: Vec3;
  walkable?: boolean;
  visible?: boolean;
}
interface Decor extends Placed {
  model: string;
  yaw?: number;
  scale?: number;
}
interface Panel extends Placed {
  size: { w: number; h: number };
  yaw: number;
  kind?: string;
}
export interface AuditMapData {
  id?: string;
  theme?: string;
  playerSpawn: Vec3;
  blocks: readonly Block[];
  lights?: readonly (Placed & {
    model?: string;
    yaw?: number;
    scale?: number;
  })[];
  decor?: readonly Decor[];
  signs?: readonly Panel[];
  decals?: readonly Panel[];
  panels?: readonly Panel[];
  neonTexts?: readonly Panel[];
  props?: readonly { kind: string; position?: Vec3 }[];
  stations?: readonly { sign?: Panel }[];
  gates?: readonly { block: Block }[];
  doors?: readonly Block[];
  arena?: { water?: { color: string; y: number } };
}
type Rule =
  | 'noCollisionLargeProp'
  | 'floatingObject'
  | 'outOfBounds'
  | 'overlap'
  | 'forbiddenColor'
  | 'emptyRoom';
export interface AuditFinding {
  mapId: string;
  rule: Rule;
  severity: 'error' | 'warn';
  path: string;
  message: string;
  position: Vec3;
}
interface Model {
  min: readonly number[];
  max: readonly number[];
  ends?: readonly number[][];
  materials: readonly string[];
}
const models: Readonly<Record<string, Model>> = measured;
const themes: Record<string, Record<string, string | number>> = {
  white: white.render,
  neonStreet: street.render,
  hideout: hideout.render,
};
const surfaces: Record<
  string,
  { texture: string; tint?: string; themeTint?: string; flat?: boolean }
> = { ...port, ...arenaMaterials, ...rail, ...overpass };
const slots: Record<string, string> = {
  player_cyan: 'player',
  power_magenta: 'power',
  enemy_glow: 'enemyGlow',
};
function reservedColor(hex: string) {
  if (!/^#[\da-f]{6}$/i.test(hex)) return;
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  ) as [number, number, number];
  const max = Math.max(r, g, b),
    delta = max - Math.min(r, g, b);
  if (max < MIN_VALUE || delta / max < MIN_SATURATION) return;
  const hue =
    (360 +
      60 *
        (max === r
          ? (g - b) / delta
          : max === g
            ? (b - r) / delta + 2
            : (r - g) / delta + 4)) %
    360;
  return RESERVED.find(
    ({ hue: h }) =>
      Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue)) <= HUE_DISTANCE,
  )?.name;
}

function decorBox(def: Decor, model: Model): Box {
  const factor = def.scale ?? 1,
    yaw = def.yaw ?? 0;
  const size = model.max.map((max, i) => (max - model.min[i]!) * factor);
  const center = modelPoint(
    def.position,
    yaw,
    factor,
    model.max.map((max, i) => (max + model.min[i]!) / 2),
  );
  return orientedBox(
    center,
    vec3(size[0]!, size[1]!, size[2]!),
    vec3(0, yaw, 0),
  );
}

function ceilingContact(fixture: Box, support: Box): boolean {
  return (
    Math.abs(fixture.max.y - support.min.y) <= CONTACT &&
    intersects(fixture, support, CONTACT)
  );
}

export function auditMap(
  map: AuditMapData,
  opts: { mapId?: string } = {},
): AuditFinding[] {
  const mapId = opts.mapId ?? map.id ?? 'arena';
  const findings: AuditFinding[] = [];
  const add = (
    rule: Rule,
    severity: AuditFinding['severity'],
    path: string,
    message: string,
    position: Vec3,
  ) =>
    findings.push({
      mapId,
      rule,
      severity,
      path,
      message,
      position: { ...position },
    });
  const palette: Record<string, string | number> =
    themes[map.theme ?? 'white'] ?? white.render;
  function color(
    value: string | undefined,
    path: string,
    position: Vec3,
    source = '',
  ) {
    if (!value) return;
    const reserved = reservedColor(value);
    if (reserved)
      add(
        'forbiddenColor',
        'error',
        path,
        `${source}${value} wpada w pasmo „${reserved}”.`,
        position,
      );
  }
  function material(key: string, path: string, position: Vec3) {
    if (key.startsWith('#')) return color(key, path, position);
    const cfg = surfaces[key];
    const resolved = cfg?.themeTint
      ? palette[cfg.themeTint]
      : cfg?.tint &&
          (cfg.flat ||
            Number(palette.citySurfaceDetail) > 0 ||
            [
              'turbine_hall_floor',
              'power_quay_floor',
              'overpass_street',
              'overpass_forecourt',
            ].includes(key))
        ? cfg.tint
        : palette[slots[key] ?? key];
    if (typeof resolved === 'string')
      color(resolved, path, position, key + ' ');
  }
  function colors(def: Placed, path: string) {
    for (const key of ['color', 'tint', 'emissive'] as const)
      color(def[key], path + '.' + key, def.position);
  }
  const makeBlock = (def: Block, path: string) => ({
    def,
    path,
    box: orientedBox(def.position, def.size, def.rotation),
  });
  const blocks = map.blocks.map((b, i) => makeBlock(b, `blocks[${i}]`));
  const fixed = [
    ...blocks,
    ...(map.doors ?? []).map((b, i) => makeBlock(b, `doors[${i}]`)),
    ...(map.gates ?? []).map((g, i) => makeBlock(g.block, `gates[${i}].block`)),
  ];
  const floorCandidates = blocks.filter(
    ({ def, box }) =>
      def.walkable === true ||
      (def.walkable !== false &&
        !def.model &&
        def.material !== 'facade' &&
        Math.abs(box.max.y - map.playerSpawn.y) < CONTACT &&
        def.size.y <= Math.max(def.size.x, def.size.z)),
  );
  // Osobne płaty tła też bywają oznaczone walkable. Do granic zaliczamy płaty
  // połączone w rzucie XZ z podłogą spawnu (również przez rampę lub pomost).
  const floors = floorCandidates.filter(
    ({ box }) =>
      Math.abs(
        (surfaceY(box, map.playerSpawn, EDGE) ?? Infinity) - map.playerSpawn.y,
      ) <= CONTACT,
  );
  const connected = new Set(floors);
  for (const floor of floors) {
    const a = floor.box;
    for (const candidate of floorCandidates) {
      if (connected.has(candidate)) continue;
      const b = candidate.box;
      if (
        a.min.x > b.max.x + EDGE ||
        b.min.x > a.max.x + EDGE ||
        a.min.z > b.max.z + EDGE ||
        b.min.z > a.max.z + EDGE
      )
        continue;
      connected.add(candidate);
      floors.push(candidate);
    }
  }
  const aboveFloor = (p: Vec3) =>
    floors.some(
      ({ box }) => (surfaceY(box, p, EDGE) ?? Infinity) <= p.y + CONTACT,
    );
  const explicitSurfaces = blocks.some((b) => b.def.walkable === true);
  const outerWalls = blocks.filter(
    ({ def }) => def.model === 'wall' && def.size.y >= 2,
  );
  function behindWall(p: Vec3) {
    return outerWalls.some(({ def, box }) => {
      const axis = def.size.x < def.size.z ? 'x' : 'z';
      const along = axis === 'x' ? 'z' : 'x';
      const side = Math.sign(def.position[axis] - map.playerSpawn[axis]);
      if (
        (p[axis] - def.position[axis]) * side <= def.size[axis] / 2 ||
        Math.abs(p[along] - def.position[along]) > def.size[along] / 2
      )
        return false;
      // Tylko ściana przy zewnętrznej krawędzi podłogi. Przegroda wewnętrzna ma podłogę dalej.
      const edge = side > 0 ? box.max[axis] : box.min[axis];
      return !floors.some(
        (f) =>
          p[along] >= f.box.min[along] &&
          p[along] <= f.box.max[along] &&
          (side > 0 ? f.box.max[axis] - edge : edge - f.box.min[axis]) >
            OUTER_WALL_MARGIN,
      );
    });
  }
  const placed = [
    ...(map.decor ?? []).map((def, i) => ({ def, path: `decor[${i}]` })),
    ...(map.lights ?? []).flatMap((def, i) =>
      def.model
        ? [{ def: { ...def, model: def.model }, path: `lights[${i}]` }]
        : [],
    ),
  ].map(({ def, path }) => {
    const model = models[def.model];
    if (!model)
      throw new Error(
        `${mapId} ${path}: brak pomiaru GLB ${def.model}. Uruchom tools/levels/mapModelBounds.mjs.`,
      );
    return { def, path, model, box: decorBox(def, model) };
  });
  const supports = [...fixed.filter((b) => b.def.visible !== false), ...placed];
  // Dwie dekoracje wiszące obok siebie nie tworzą konstrukcji. Propaguj styk od bloków.
  const anchored = new Set(
    fixed.filter((b) => b.def.visible !== false).map((b) => b.box),
  );
  let previousSize: number;
  do {
    previousSize = anchored.size;
    for (const item of placed) {
      if (item.model.ends || anchored.has(item.box)) continue;
      const margin = WALL_FIXTURES.has(item.def.model) ? WALL_MOUNT : CONTACT;
      if (
        supports.some(
          (s) =>
            anchored.has(s.box) &&
            (CEILING_FIXTURES.has(item.def.model)
              ? ceilingContact(item.box, s.box)
              : intersects(item.box, s.box, margin)),
        )
      )
        anchored.add(item.box);
    }
  } while (anchored.size !== previousSize);
  const offFloor = (p: Vec3) => !aboveFloor(p) || behindWall(p);
  function outside(path: string, p: Vec3, attached: boolean) {
    if (floors.length && offFloor(p) && !attached)
      add(
        'outOfBounds',
        'warn',
        path,
        'Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.',
        p,
      );
  }
  const floorBoxes = new Set(floorCandidates.map((f) => f.box));
  const duplicateBlocks = new Map<string, string>();
  for (const entry of fixed) {
    const { def, path, box } = entry;
    colors(def, path);
    if (def.visible === false) continue;
    if (def.model && models[def.model]) {
      for (const name of models[def.model]!.materials)
        material(name.replace(/^mat_/, ''), path + '.model', def.position);
    } else
      material(
        def.material ??
          (def.model?.startsWith('crate') ? 'interactive' : 'world'),
        path + (def.material ? '.material' : ''),
        def.position,
      );
    const key = JSON.stringify([
      def.position.x,
      def.position.y,
      def.position.z,
      def.size.x,
      def.size.y,
      def.size.z,
      def.rotation?.x ?? 0,
      def.rotation?.y ?? 0,
      def.rotation?.z ?? 0,
    ]);
    const previous = duplicateBlocks.get(key);
    if (previous)
      add(
        'overlap',
        'error',
        path,
        `Identyczna bryła jak ${previous}.`,
        def.position,
      );
    duplicateBlocks.set(key, path);
    if (
      def.model !== 'wall' &&
      def.material !== 'facade' &&
      !connected.has(entry) &&
      offFloor(def.position)
    )
      outside(
        path,
        def.position,
        fixed.some((b) => b !== entry && intersects(box, b.box, CONTACT)),
      );
  }
  for (const [i, p] of (map.props ?? []).entries()) {
    if (!p.position) continue; // focus w kryjówce jest strefą interakcji.
    const at = p.position;
    const twin = blocks.find(
      (b) => b.def.model === p.kind && distance(at, b.def.position) < DUPLICATE,
    );
    if (twin)
      add(
        'overlap',
        'warn',
        `props[${i}]`,
        `Wpis ${p.kind} powtarza ${twin.path}. Fizykę tworzy blok.`,
        at,
      );
    outside(
      `props[${i}]`,
      at,
      fixed.some((b) => contains(b.box, at, CONTACT)),
    );
  }
  for (const [i, item] of placed.entries()) {
    const { def, model, path, box } = item;
    const p = def.position;
    colors(def, path);
    for (const name of model.materials)
      material(name.replace(/^mat_/, ''), path + '.model', p);
    const wallFixture = WALL_FIXTURES.has(def.model);
    const neighbors = supports.filter(
      (s) =>
        s !== item &&
        anchored.has(s.box) &&
        intersects(box, s.box, wallFixture ? WALL_MOUNT : ANCHOR),
    );
    const feet = { ...box.center, y: box.min.y };
    const ground = fixed.find(
      ({ box: b }) =>
        Math.abs((surfaceY(b, feet, CONTACT) ?? Infinity) - feet.y) <= CONTACT,
    );
    const proxy = fixed.some(
      (b) => b.def.visible === false && intersects(box, b.box, CONTACT),
    );
    if (model.ends) {
      const missing = model.ends
        .map((end) => modelPoint(p, def.yaw ?? 0, def.scale ?? 1, end))
        .filter((end) => !neighbors.some((n) => contains(n.box, end, ANCHOR)));
      if (missing.length)
        add(
          'floatingObject',
          'warn',
          path,
          `${def.model}: bez zaczepienia ${missing.length}/2 końców.`,
          missing[0]!,
        );
    } else if (CEILING_FIXTURES.has(def.model)) {
      if (!neighbors.some((n) => ceilingContact(box, n.box)))
        add(
          'floatingObject',
          'warn',
          path,
          `${def.model}: brak styku uchwytów z konstrukcją nad oprawą.`,
          p,
        );
    } else if (
      wallFixture
        ? !neighbors.some(
            (n) =>
              n.box.max.y > box.min.y + CONTACT &&
              n.box.min.y < box.max.y - CONTACT,
          )
        : !ground && !proxy && !neighbors.length
    ) {
      add(
        'floatingObject',
        'warn',
        path,
        `${def.model}: brak styku z podłożem lub konstrukcją.`,
        p,
      );
    }
    outside(
      path,
      p,
      proxy ||
        neighbors.some(
          (n) =>
            !floorBoxes.has(n.box) &&
            ('size' in n.def || !offFloor(n.box.center)),
        ),
    );
    const covered = fixed.some((b) =>
      contains(
        b.box,
        { ...feet, y: feet.y + Math.min(LARGE_HEIGHT, box.half[1]!) },
        CONTACT,
      ),
    );
    if (
      ground &&
      !proxy &&
      (explicitSurfaces
        ? ground.def.walkable === true
        : ground.def.walkable !== false) &&
      !offFloor(feet) &&
      ground.def.material !== 'facade' &&
      box.half[1]! * 2 > LARGE_HEIGHT &&
      Math.min(box.half[0]!, box.half[2]!) * 2 > LARGE_BASE &&
      !covered &&
      !model.ends &&
      !PASSAGE_FIXTURES.has(def.model) &&
      !['city_traffic_cone', 'city_trash_bags'].includes(def.model)
    ) {
      add(
        'noCollisionLargeProp',
        'error',
        path,
        `${def.model}: duży model na powierzchni ${ground.path}, bez kolidera przy podstawie.`,
        p,
      );
    }
    const peers = [
      ...fixed.filter((b) => b.def.visible !== false),
      ...placed.slice(0, i),
    ];
    for (const peer of peers) {
      const exact =
        distance(box.center, peer.box.center) < DUPLICATE &&
        box.half.every((h, k) => Math.abs(h - peer.box.half[k]!) < DUPLICATE) &&
        box.axes.every((a, k) => distance(a, peer.box.axes[k]!) < DUPLICATE);
      if (!exact) {
        if (!intersects(box, peer.box, -PENETRATION)) continue;
        // Obudowa pomostu, podpora pod dachem i lico okładziny często dzielą obwiednię.
        const buried =
          contains(peer.box, box.center, -CONTACT) &&
          box.max.y < peer.box.max.y - CONTACT;
        const mutual =
          contains(box, peer.box.center, -CONTACT) &&
          contains(peer.box, box.center, -CONTACT);
        // Łączenia modułów (np. kolejne piętra rusztowań) dzielą wystające poręcze.
        const repeatedCore =
          peer.def.model === def.model &&
          contains(box, peer.box.center, CONTACT) &&
          contains(peer.box, box.center, CONTACT);
        if (!buried && !mutual && !repeatedCore) continue;
      }
      add(
        'overlap',
        exact ? 'error' : 'warn',
        path,
        `${def.model}: ${exact ? 'powtórzona bryła' : 'wnikanie obwiedni'} z ${peer.path}.`,
        p,
      );
    }
  }
  function panel(def: Panel, path: string, needsMount: boolean) {
    colors(def, path);
    const box = orientedBox(
      def.position,
      vec3(def.size.w, def.size.h, 0.02),
      vec3(0, def.yaw, 0),
    );
    const mounted = supports.some(
      (s) => anchored.has(s.box) && intersects(box, s.box, ANCHOR),
    );
    if (needsMount && !mounted)
      add(
        'floatingObject',
        'warn',
        path,
        'Brak konstrukcji przy płaszczyźnie szyldu.',
        def.position,
      );
    outside(path, def.position, mounted);
  }
  for (const key of ['signs', 'panels', 'neonTexts'] as const)
    (map[key] ?? []).forEach((def, i) =>
      panel(def, `${key}[${i}]`, def.kind !== 'holo'),
    );
  (map.stations ?? []).forEach((s, i) => {
    if (s.sign) panel(s.sign, `stations[${i}].sign`, true);
  });
  (map.lights ?? []).forEach((def, i) => {
    if (def.model) return;
    const path = `lights[${i}]`;
    colors(def, path);
    outside(
      path,
      def.position,
      supports.some((s) => contains(s.box, def.position, ANCHOR)),
    );
  });
  (map.decals ?? []).forEach((def, i) => {
    colors(def, `decals[${i}]`);
    outside(
      `decals[${i}]`,
      def.position,
      supports.some((s) => contains(s.box, def.position, ANCHOR)),
    );
  });
  if (map.arena?.water)
    color(map.arena.water.color, 'arena.water.color', {
      ...map.playerSpawn,
      y: map.arena.water.y,
    });
  for (const [key, name] of [
    ['lights', 'świateł'],
    ['decor', 'dekoracji'],
    ['signs', 'szyldów'],
  ] as const)
    if (
      !map[key]?.length &&
      !(
        key === 'signs' &&
        (map.neonTexts?.length || map.stations?.some((s) => s.sign))
      )
    )
      add(
        'emptyRoom',
        'warn',
        key,
        `Brak ${name} w danych mapy.`,
        map.playerSpawn,
      );
  return findings;
}
