import { assertRect, vec } from './arena.mjs';
import { EPS, contains, rotate } from './geometry.mjs';

// Kopia limitów kontrolera na potrzeby czystego Node; test pilnuje zgodności z tuning.ts.
export const CONTROLLER_LIMITS = {
  maxSlopeDeg: 45,
  stepHeight: 0.35,
  stepMinWidth: 0.2,
};
const positive = (value, label) => {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${label} musi być dodatnie.`);
};

function segment(from, to) {
  const dx = to.x - from.x,
    dz = to.z - from.z;
  const run = Math.hypot(dx, dz);
  positive(run, 'Długość');
  return { run, dx: dx / run, dz: dz / run, yaw: Math.atan2(-dz, dx) };
}

export function floor(arena, rect, y = 0, material = 'concrete', opts = {}) {
  assertRect(rect);
  const { thickness = 0.4, walkable = true, ...rest } = opts;
  positive(thickness, 'Grubość podłogi');
  const block = arena.block({
    size: vec(rect.maxX - rect.minX, thickness, rect.maxZ - rect.minZ),
    position: vec(
      (rect.minX + rect.maxX) / 2,
      y - thickness / 2,
      (rect.minZ + rect.maxZ) / 2,
    ),
    material,
    walkable,
    ...rest,
  });
  return { rect: { ...rect }, y, blocks: [block] };
}

export function wall(
  arena,
  from,
  to,
  height,
  thickness = 0.4,
  material = 'concrete',
  opts = {},
) {
  positive(height, 'Wysokość ściany');
  positive(thickness, 'Grubość ściany');
  const direction = segment(from, to);
  if (Math.abs((from.y ?? 0) - (to.y ?? 0)) > EPS)
    throw new Error('Podstawa ściany musi być pozioma.');
  const { openings = [], ...rest } = opts;
  const cuts = openings.map(({ at, width, height: h, bottom = 0 }) => {
    positive(width, 'Szerokość otworu');
    positive(h, 'Wysokość otworu');
    if (
      !Number.isFinite(at) ||
      !Number.isFinite(bottom) ||
      bottom < 0 ||
      at - width / 2 < -EPS ||
      at + width / 2 > direction.run + EPS ||
      bottom + h > height + EPS
    )
      throw new Error('Otwór nie mieści się w ścianie.');
    return {
      start: Math.max(0, at - width / 2),
      end: Math.min(direction.run, at + width / 2),
      bottom,
      top: bottom + h,
    };
  });
  const edges = [
    ...new Set([0, direction.run, ...cuts.flatMap((o) => [o.start, o.end])]),
  ].sort((a, b) => a - b);
  const blocks = [];
  const add = (start, end, bottom, top) => {
    if (end - start < EPS || top - bottom < EPS) return;
    const at = (start + end) / 2;
    const alongZ = Math.abs(direction.dx) < EPS;
    const diagonal =
      Math.abs(direction.dx) > EPS && Math.abs(direction.dz) > EPS;
    blocks.push(
      arena.block({
        size: alongZ
          ? vec(thickness, top - bottom, end - start)
          : vec(end - start, top - bottom, thickness),
        position: vec(
          from.x + direction.dx * at,
          (from.y ?? 0) + (bottom + top) / 2,
          from.z + direction.dz * at,
        ),
        material,
        ...(diagonal ? { rotation: vec(0, direction.yaw, 0) } : {}),
        ...rest,
        walkable: false,
      }),
    );
  };
  for (let i = 1; i < edges.length; i++) {
    const start = edges[i - 1],
      end = edges[i],
      mid = (start + end) / 2;
    const intervals = cuts
      .filter((o) => o.start < mid && o.end > mid)
      .sort((a, b) => a.bottom - b.bottom);
    let bottom = 0;
    for (const o of intervals) {
      add(start, end, bottom, o.bottom);
      bottom = Math.max(bottom, o.top);
    }
    add(start, end, bottom, height);
  }
  return {
    from,
    to,
    height,
    thickness,
    openings: structuredClone(openings),
    blocks,
  };
}

export function ramp(
  arena,
  { from, to, width, material = 'concrete', thickness = 0.4 },
) {
  positive(width, 'Szerokość rampy');
  positive(thickness, 'Grubość rampy');
  const direction = segment(from, to),
    rise = to.y - from.y;
  const angle = Math.atan2(rise, direction.run);
  // Rampa wzdłuż ujemnego X również może mieć sam obrót Z.
  const reverseX = Math.abs(direction.dz) < EPS && direction.dx < 0;
  const alongZ = Math.abs(direction.dx) < EPS;
  const rotation = vec(
    alongZ ? -Math.sign(direction.dz) * angle : 0,
    reverseX || alongZ ? 0 : direction.yaw,
    alongZ ? 0 : reverseX ? -angle : angle,
  );
  const normal = rotate(vec(0, 1, 0), rotation);
  const block = arena.block({
    size: alongZ
      ? vec(width, thickness, Math.hypot(direction.run, rise))
      : vec(Math.hypot(direction.run, rise), thickness, width),
    position: vec(
      (from.x + to.x) / 2 - (normal.x * thickness) / 2,
      (from.y + to.y) / 2 - (normal.y * thickness) / 2,
      (from.z + to.z) / 2 - (normal.z * thickness) / 2,
    ),
    rotation,
    material,
    walkable: true,
  });
  const config = arena.toRoom().arena;
  if ((Math.abs(angle) * 180) / Math.PI > CONTROLLER_LIMITS.maxSlopeDeg + EPS)
    arena.warn(
      'ramp-controller-slope',
      `Rampa ${JSON.stringify(from)}: nachylenie przekracza ${CONTROLLER_LIMITS.maxSlopeDeg}° kontrolera.`,
    );
  if (
    Math.abs(rise / direction.run) * config.navigationCellM >
    config.navigationMaxRiseM + EPS
  )
    arena.warn(
      'ramp-navigation-slope',
      `Rampa ${JSON.stringify(from)}: wznios na komórkę przekracza navigationMaxRiseM.`,
    );
  if (Math.abs(rotation.y) > EPS)
    arena.warn(
      'navigation-rotation',
      'ArenaSurfaceNavigation obsługuje rampy w osi X lub Z; rampa ukośna jest trasą dla gracza.',
    );
  return {
    from: { ...from },
    to: { ...to },
    width,
    run: direction.run,
    rise,
    angle,
    blocks: [block],
  };
}

export function stairs(
  arena,
  { from, to, width, stepRise = 0.2, stepDepth = 0.4, material = 'concrete' },
) {
  positive(width, 'Szerokość schodów');
  positive(stepRise, 'Wznios stopnia');
  positive(stepDepth, 'Głębokość stopnia');
  const direction = segment(from, to),
    rise = to.y - from.y;
  if (Math.abs(rise) < EPS)
    throw new Error('Schody wymagają różnicy wysokości.');
  const count = Math.ceil(Math.abs(rise) / stepRise);
  const actualRise = Math.abs(rise) / count,
    actualDepth = direction.run / count;
  if (actualDepth < stepDepth - EPS)
    throw new Error(
      'Bieg jest zbyt krótki dla stepRise i minimalnego stepDepth.',
    );
  const start = rise > 0 ? from : to,
    end = rise > 0 ? to : from;
  const dir = segment(start, end);
  const blocks = [];
  for (let i = 0; i < count; i++) {
    const h = (i + 1) * actualRise;
    // Osobne bryły stopni bez szczelin; ostatni wierzch dokładnie na to.y.
    const alongZ = Math.abs(dir.dx) < EPS;
    const yaw = alongZ || Math.abs(dir.dz) < EPS ? 0 : dir.yaw;
    blocks.push(
      arena.block({
        size: alongZ
          ? vec(width, actualRise, actualDepth)
          : vec(actualDepth, actualRise, width),
        position: vec(
          start.x + dir.dx * (i + 0.5) * actualDepth,
          start.y + h - actualRise / 2,
          start.z + dir.dz * (i + 0.5) * actualDepth,
        ),
        ...(yaw ? { rotation: vec(0, yaw, 0) } : {}),
        material,
        walkable: true,
      }),
    );
  }
  if (
    actualRise >
      Math.min(
        CONTROLLER_LIMITS.stepHeight,
        arena.toRoom().arena.navigationMaxRiseM,
      ) +
        EPS ||
    actualDepth < CONTROLLER_LIMITS.stepMinWidth
  )
    arena.warn(
      'stairs-step',
      'Stopnie przekraczają limit autostep kontrolera lub wzniosu nawigacji.',
    );
  if (
    Math.ceil(arena.toRoom().arena.navigationCellM / actualDepth) * actualRise >
    arena.toRoom().arena.navigationMaxRiseM + EPS
  )
    arena.warn(
      'stairs-navigation-slope',
      'Schody mogą przekraczać wznios na komórkę nawigacji; zwiększ stepDepth lub sprawdź trasę w ArenaNavigation.',
    );
  if (blocks.some((b) => b.rotation?.y))
    arena.warn(
      'navigation-rotation',
      'Obrócone wokół Y schody nie są obsługiwane przez ArenaSurfaceNavigation.',
    );
  return {
    from: { ...from },
    to: { ...to },
    width,
    rise,
    run: direction.run,
    angle: Math.atan2(rise, direction.run),
    count,
    stepRise: actualRise,
    stepDepth: actualDepth,
    blocks,
  };
}

function sides(rect, y) {
  return {
    north: [vec(rect.minX, y, rect.minZ), vec(rect.maxX, y, rect.minZ)],
    south: [vec(rect.minX, y, rect.maxZ), vec(rect.maxX, y, rect.maxZ)],
    west: [vec(rect.minX, y, rect.minZ), vec(rect.minX, y, rect.maxZ)],
    east: [vec(rect.maxX, y, rect.minZ), vec(rect.maxX, y, rect.maxZ)],
  };
}

function slabWithHole(arena, rect, y, material, hole, opts) {
  if (!hole) return floor(arena, rect, y, material, opts);
  const pieces = [
    { ...rect, maxX: hole.minX },
    { ...rect, minX: hole.maxX },
    { minX: hole.minX, maxX: hole.maxX, minZ: rect.minZ, maxZ: hole.minZ },
    { minX: hole.minX, maxX: hole.maxX, minZ: hole.maxZ, maxZ: rect.maxZ },
  ].filter((r) => r.maxX - r.minX > EPS && r.maxZ - r.minZ > EPS);
  return {
    rect,
    y,
    blocks: pieces.flatMap((r) => floor(arena, r, y, material, opts).blocks),
  };
}

export function building(
  arena,
  {
    rect,
    height,
    floors = 1,
    wallMaterial = 'facade',
    roofMaterial = 'roof_tar',
    doors = [],
    windows = [],
    interior = false,
    stairs: stairOptions = false,
    y = 0,
    roofAccessible = false,
    thickness = 0.4,
  },
) {
  assertRect(rect);
  positive(height, 'Wysokość budynku');
  if (!Number.isInteger(floors) || floors < 1)
    throw new Error('floors musi być dodatnią liczbą całkowitą.');
  if (stairOptions && !interior)
    throw new Error('Schody wymagają interior: true.');
  for (const opening of [...doors, ...windows])
    if (!(opening.side in sides(rect, y)))
      throw new Error(`Nieznany bok: ${opening.side}.`);
  const blocks = [],
    surfaces = [],
    flights = [];
  const levelHeight = height / floors;
  const options = stairOptions === true ? {} : stairOptions || {};
  const stairWidth = options.width ?? 3;
  const run =
    Math.ceil(levelHeight / (options.stepRise ?? 0.2)) *
    (options.stepDepth ?? 0.4);
  const hole = stairOptions
    ? {
        minX: rect.minX + 2,
        maxX: rect.minX + 2 + run,
        minZ: rect.minZ + 2,
        maxZ: rect.minZ + 2 + stairWidth,
      }
    : undefined;
  if (
    hole &&
    (!contains(rect, { x: hole.maxX + 2, z: hole.maxZ + 1 }) ||
      hole.minX <= rect.minX + thickness)
  )
    throw new Error('Klatka schodowa i spocznik nie mieszczą się w budynku.');
  for (const [side, [from, to]] of Object.entries(sides(rect, y))) {
    const openings = [
      ...doors
        .filter((d) => d.side === side)
        .map((d) => ({ at: d.at, width: d.width, height: d.height ?? 3 })),
      ...windows.filter((w) => w.side === side),
    ];
    blocks.push(
      ...wall(arena, from, to, height, thickness, wallMaterial, { openings })
        .blocks,
    );
  }
  if (interior) {
    for (let i = 0; i < floors; i++) {
      const slab = slabWithHole(
        arena,
        rect,
        y + i * levelHeight,
        'concrete',
        i ? hole : undefined,
        { thickness },
      );
      surfaces.push(slab);
      blocks.push(...slab.blocks);
    }
  }
  const roof = slabWithHole(
    arena,
    rect,
    y + height,
    roofMaterial,
    roofAccessible ? hole : undefined,
    { thickness, walkable: roofAccessible },
  );
  surfaces.push(roof);
  blocks.push(...roof.blocks);
  if (stairOptions)
    for (let i = 0; i < floors - (roofAccessible ? 0 : 1); i++) {
      const flight = stairs(arena, {
        ...options,
        from: vec(hole.minX, y + i * levelHeight, (hole.minZ + hole.maxZ) / 2),
        to: vec(
          hole.maxX,
          y + (i + 1) * levelHeight,
          (hole.minZ + hole.maxZ) / 2,
        ),
        width: stairWidth,
        material: options.material ?? 'concrete',
      });
      flights.push(flight);
      blocks.push(...flight.blocks);
    }
  arena.roomMeta({
    rainShelters: [
      ...(arena.toRoom().rainShelters ?? []),
      {
        position: vec(
          (rect.minX + rect.maxX) / 2,
          y + height / 2,
          (rect.minZ + rect.maxZ) / 2,
        ),
        size: vec(rect.maxX - rect.minX, height, rect.maxZ - rect.minZ),
      },
    ],
  });
  return { rect, y, height, surfaces, flights, blocks, stairwell: hole };
}

export function hall(
  arena,
  {
    rect,
    height,
    mezzanine,
    doors = [],
    roofTrussModel,
    y = 0,
    wallMaterial = 'corrugated',
  },
) {
  const shell = building(arena, {
    rect,
    height,
    doors,
    y,
    wallMaterial,
    interior: true,
  });
  const blocks = [...shell.blocks],
    surfaces = [...shell.surfaces];
  let flight;
  if (mezzanine) {
    const { side, depth, y: top } = mezzanine;
    if (!['north', 'south', 'east', 'west'].includes(side))
      throw new Error('Nieznany bok antresoli.');
    positive(depth, 'Głębokość antresoli');
    if (top <= y || top >= y + height - 2)
      throw new Error('Antresola wymaga miejsca pod dachem.');
    const deck = { ...rect };
    if (side === 'north') deck.maxZ = rect.minZ + depth;
    if (side === 'south') deck.minZ = rect.maxZ - depth;
    if (side === 'west') deck.maxX = rect.minX + depth;
    if (side === 'east') deck.minX = rect.maxX - depth;
    if (
      deck.minX < rect.minX ||
      deck.maxX > rect.maxX ||
      deck.minZ < rect.minZ ||
      deck.maxZ > rect.maxZ
    )
      throw new Error('Antresola nie mieści się w hali.');
    const run = Math.ceil((top - y) / 0.2);
    let from, to, hole;
    if (side === 'west' || side === 'east') {
      const x = side === 'west' ? deck.maxX : deck.minX;
      to = vec(x, top, rect.minZ + 4);
      from = vec(x + (side === 'west' ? run : -run), y, to.z);
    } else {
      const z = (deck.minZ + deck.maxZ) / 2;
      to = vec(rect.minX + 2 + run, top, z);
      from = vec(rect.minX + 2, y, z);
      // Schody przechodzą przez otwór, bez stropu nad głową.
      hole = { minX: from.x, maxX: to.x, minZ: z - 1.5, maxZ: z + 1.5 };
      if (
        !contains(deck, { x: hole.minX, z: hole.minZ }) ||
        !contains(deck, { x: hole.maxX + 1, z: hole.maxZ })
      )
        throw new Error('Schody nie mieszczą się w antresoli.');
    }
    if (!contains(rect, from, 1.5) || !contains(rect, to, 1.5))
      throw new Error('Bieg schodów nie mieści się w hali.');
    const slab = slabWithHole(arena, deck, top, 'steel_grating', hole);
    surfaces.push(slab);
    blocks.push(...slab.blocks);
    flight = stairs(arena, {
      from,
      to,
      width: 3,
      stepDepth: 1,
      material: 'steel_grating',
    });
    blocks.push(...flight.blocks);
  }
  if (roofTrussModel)
    for (let x = rect.minX + 4; x < rect.maxX; x += 8)
      arena.decor(
        roofTrussModel,
        vec(x, y + height - 1, (rect.minZ + rect.maxZ) / 2),
      );
  return { ...shell, blocks, surfaces, flight };
}

export function bridge(
  arena,
  {
    from,
    to,
    width,
    y,
    railings = true,
    material = 'steel_grating',
    thickness = 0.3,
  },
) {
  const direction = segment(from, to),
    top = y ?? from.y ?? 0;
  const deck = ramp(arena, {
    from: { ...from, y: top },
    to: { ...to, y: top },
    width,
    material,
    thickness,
  });
  const blocks = [...deck.blocks];
  if (railings)
    for (const side of [-1, 1]) {
      const offset = (width / 2 + 0.06) * side;
      blocks.push(
        ...wall(
          arena,
          vec(
            from.x - direction.dz * offset,
            top,
            from.z + direction.dx * offset,
          ),
          vec(to.x - direction.dz * offset, top, to.z + direction.dx * offset),
          1.1,
          0.12,
          'metal',
        ).blocks,
      );
    }
  return { ...deck, blocks };
}

export function containerStack(
  arena,
  {
    position,
    rotationY = 0,
    layers = 1,
    length = 40,
    palette = ['navy', 'olive', 'ochre', 'graphite'],
  },
) {
  if (
    ![20, 40].includes(length) ||
    !Number.isInteger(layers) ||
    layers < 1 ||
    !palette.length ||
    palette.some((p) => !['navy', 'olive', 'ochre', 'graphite'].includes(p))
  )
    throw new Error(
      'Niepoprawny rozmiar, liczba warstw lub paleta kontenerów.',
    );
  const blocks = [];
  for (let i = 0; i < layers; i++) {
    const color = palette[i % palette.length];
    blocks.push(
      arena.block({
        position: vec(
          position.x,
          (position.y ?? 0) + (i + 0.5) * 2.591,
          position.z,
        ),
        size: vec(length === 20 ? 6.058 : 12.192, 2.591, 2.438),
        ...(rotationY ? { rotation: vec(0, rotationY, 0) } : {}),
        material: `container_${color}`,
        model: `port_container_${length}_${color}`,
        instance: true,
        walkable: false,
      }),
    );
  }
  return { blocks, roofY: (position.y ?? 0) + layers * 2.591 };
}

export function fence(
  arena,
  { from, to, height = 3, model, thickness = 0.15 },
) {
  const direction = segment(from, to);
  const result = wall(
    arena,
    from,
    to,
    height,
    thickness,
    'metal',
    model ? { visible: false } : {},
  );
  if (model)
    for (let at = 0; at < direction.run; at += 4)
      arena.decor(
        model,
        vec(
          from.x + direction.dx * (at + Math.min(4, direction.run - at) / 2),
          from.y ?? 0,
          from.z + direction.dz * (at + Math.min(4, direction.run - at) / 2),
        ),
        direction.yaw,
      );
  return result;
}

export function pit(
  arena,
  { rect, depth, ramps = [], wallMaterial = 'concrete', y = 0 },
) {
  assertRect(rect);
  positive(depth, 'Głębokość wykopu');
  const bottom = floor(arena, rect, y - depth, wallMaterial),
    blocks = [...bottom.blocks];
  // Przerwy na rampy muszą być jawne, aby obwód nie zamykał wyjścia.
  for (const [side, [from, to]] of Object.entries(sides(rect, y - depth))) {
    const openings = ramps
      .filter((r) => r.side === side)
      .map((r) => ({ at: r.at, width: r.width, height: depth }));
    blocks.push(
      ...wall(arena, from, to, depth, 0.4, wallMaterial, { openings }).blocks,
    );
  }
  const connections = ramps.map(({ side, at, ...options }) => {
    if (!sides(rect, y)[side] || !Number.isFinite(at))
      throw new Error('Rampa wykopu wymaga side i at na krawędzi.');
    return ramp(arena, options);
  });
  blocks.push(...connections.flatMap((r) => r.blocks));
  return { rect, bottomY: y - depth, blocks, connections };
}

export function quay(
  arena,
  {
    edge,
    waterSide,
    length,
    height = 2,
    width = 6,
    material = 'quay_concrete',
  },
) {
  positive(length, 'Długość nabrzeża');
  positive(height, 'Wysokość nabrzeża');
  positive(width, 'Szerokość nabrzeża');
  if (!['north', 'south', 'east', 'west'].includes(waterSide))
    throw new Error('Nieznana strona wody.');
  const alongX = waterSide === 'north' || waterSide === 'south';
  const center = { ...edge };
  center[alongX ? 'z' : 'x'] +=
    ((waterSide === 'north' || waterSide === 'west' ? 1 : -1) * width) / 2;
  const rect = {
    minX: center.x - (alongX ? length : width) / 2,
    maxX: center.x + (alongX ? length : width) / 2,
    minZ: center.z - (alongX ? width : length) / 2,
    maxZ: center.z + (alongX ? width : length) / 2,
  };
  return floor(arena, rect, edge.y ?? 0, material, { thickness: height });
}

export function safetyBoundary(arena, polygon, height = 8) {
  if (polygon.length < 3)
    throw new Error('Granica wymaga co najmniej trzech wierzchołków.');
  arena.warn(
    'safety-boundary',
    'Niewidoczna granica wymaga ręcznego sprawdzenia naturalnej osłony przed nią.',
  );
  const blocks = polygon.flatMap(
    (from, i) =>
      wall(
        arena,
        from,
        polygon[(i + 1) % polygon.length],
        height,
        0.3,
        'concrete',
        { visible: false },
      ).blocks,
  );
  return { polygon: structuredClone(polygon), blocks };
}

export function scatter(
  arena,
  { rect, models, count, minSpacing = 2, rng = arena.rng, avoid = [], y = 0 },
) {
  assertRect(rect);
  positive(minSpacing, 'Odstęp');
  if (!models.length || !Number.isInteger(count) || count < 0)
    throw new Error(
      'scatter wymaga modeli i nieujemnej całkowitej liczby instancji.',
    );
  avoid.forEach(assertRect);
  const placements = [];
  const random = () => {
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw new Error('rng musi zwracać [0, 1).');
    return value;
  };
  for (
    let attempt = 0;
    placements.length < count && attempt < Math.max(100, count * 100);
    attempt++
  ) {
    const position = vec(
      rect.minX + random() * (rect.maxX - rect.minX),
      y,
      rect.minZ + random() * (rect.maxZ - rect.minZ),
    );
    if (
      avoid.some((r) => contains(r, position, -minSpacing / 2)) ||
      placements.some(
        (p) =>
          Math.hypot(p.position.x - position.x, p.position.z - position.z) <
          minSpacing,
      )
    )
      continue;
    placements.push(
      arena.decor(
        models[Math.floor(random() * models.length)],
        position,
        random() * Math.PI * 2,
      ),
    );
  }
  if (placements.length < count)
    arena.warn(
      'scatter-capacity',
      `scatter: rozmieszczono ${placements.length}/${count}; zwiększ teren lub zmniejsz odstęp.`,
    );
  return { placements };
}

export function createPrimitives(arena) {
  return Object.fromEntries(
    Object.entries({
      floor,
      wall,
      building,
      hall,
      ramp,
      stairs,
      bridge,
      containerStack,
      fence,
      pit,
      quay,
      safetyBoundary,
      scatter,
    }).map(([name, fn]) => [name, (...args) => fn(arena, ...args)]),
  );
}
