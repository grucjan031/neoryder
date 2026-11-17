import {
  EPS,
  contains,
  corners,
  footprint,
  topAt,
  verticalRange,
} from './geometry.mjs';

const unionBounds = (rects) => ({
  minX: Math.min(...rects.map((r) => r.minX)),
  maxX: Math.max(...rects.map((r) => r.maxX)),
  minZ: Math.min(...rects.map((r) => r.minZ)),
  maxZ: Math.max(...rects.map((r) => r.maxZ)),
});

function spatialIndex(blocks, cell = 10) {
  const buckets = new Map();
  for (const block of blocks) {
    const r = footprint(block);
    for (let x = Math.floor(r.minX / cell); x <= Math.floor(r.maxX / cell); x++)
      for (
        let z = Math.floor(r.minZ / cell);
        z <= Math.floor(r.maxZ / cell);
        z++
      ) {
        const key = `${x},${z}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(block);
      }
  }
  return (x, z) =>
    buckets.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? [];
}

/** Próbkowanie wolnych powierzchni w siatce 1 m; piętra liczone osobno, nakładanie tylko raz. */
export function measureWalkable(room, sampleM = 1) {
  if (!Number.isFinite(sampleM) || sampleM <= 0)
    throw new Error('sampleM musi być dodatnie.');
  const surfaces = room.blocks.filter((b) => b.walkable);
  if (!surfaces.length)
    return { areaM2: 0, footprintM2: 0, bounds: null, levels: [], sampleM };
  const bounds = unionBounds(surfaces.map(footprint));
  const lookup = spatialIndex(room.blocks);
  let areaM2 = 0,
    footprintM2 = 0;
  const heights = new Set();
  for (
    let x = Math.floor(bounds.minX / sampleM) * sampleM + sampleM / 2;
    x < bounds.maxX;
    x += sampleM
  )
    for (
      let z = Math.floor(bounds.minZ / sampleM) * sampleM + sampleM / 2;
      z < bounds.maxZ;
      z += sampleM
    ) {
      const nearby = lookup(x, z),
        localHeights = [];
      for (const surface of nearby.filter((b) => b.walkable)) {
        const y = topAt(surface, x, z);
        if (y === undefined || localHeights.some((h) => Math.abs(h - y) < EPS))
          continue;
        if (
          nearby.some((obstacle) => {
            if (obstacle === surface) return false;
            const range = verticalRange(obstacle, x, z);
            return (
              range &&
              range.max > y + EPS &&
              range.min < y + (room.arena?.navigationHeadroomM ?? 2) - EPS
            );
          })
        )
          continue;
        localHeights.push(y);
        // Rampy i stopnie nie udają osobnych kondygnacji.
        if (
          !surface.rotation?.x &&
          !surface.rotation?.z &&
          Math.min(surface.size.x, surface.size.z) >= 2 &&
          surface.size.x * surface.size.z >= 9
        )
          heights.add(Math.round(y * 10) / 10);
        const normalCos =
          Math.cos(surface.rotation?.x ?? 0) *
          Math.cos(surface.rotation?.z ?? 0);
        areaM2 += (sampleM * sampleM) / Math.max(EPS, Math.abs(normalCos));
      }
      if (localHeights.length) footprintM2 += sampleM * sampleM;
    }
  const levels = [];
  for (const height of [...heights].sort((a, b) => a - b))
    if (!levels.length || height - levels.at(-1) >= 1) levels.push(height);
  return { areaM2: Math.round(areaM2), footprintM2, bounds, levels, sampleM };
}

export function checkArena(
  input,
  metadata = input.metadata ?? {},
  options = {},
) {
  const room = typeof input.toRoom === 'function' ? input.toRoom() : input;
  const issues = [];
  const issue = (severity, code, message, details) =>
    issues.push({ severity, code, message, ...(details ? { details } : {}) });
  const sizeSeverity = options.demo ? 'warning' : 'error';
  const measure = measureWalkable(room, options.sampleM ?? 1);
  const bounds = metadata.bounds ?? measure.bounds;
  const width = bounds ? bounds.maxX - bounds.minX : 0,
    depth = bounds ? bounds.maxZ - bounds.minZ : 0;
  if (Math.max(width, depth) < 240 || Math.max(width, depth) > 450)
    issue(
      sizeSeverity,
      'dimensions',
      `Najdłuższy wymiar ${Math.max(width, depth)} m; ADR wymaga 240–450 m.`,
    );
  if (measure.areaM2 < 40000)
    issue(
      sizeSeverity,
      'walkable-area',
      `Powierzchnia chodzenia ≈${measure.areaM2} m²; ADR wymaga 40000 m².`,
    );
  const actual = measure.bounds;
  const fillRatio = actual
    ? measure.footprintM2 /
      ((actual.maxX - actual.minX) * (actual.maxZ - actual.minZ))
    : 0;
  const aspect = actual
    ? Math.max(actual.maxX - actual.minX, actual.maxZ - actual.minZ) /
      Math.min(actual.maxX - actual.minX, actual.maxZ - actual.minZ)
    : 1;
  if (fillRatio > 0.9 && aspect < 1.3)
    issue(
      'error',
      'square-outline',
      'Obrys jest niemal kwadratowym, pełnym prostokątem (wypełnienie >90%, proporcja <1,3).',
    );
  const zones = metadata.zones ?? [],
    kinds = [...new Set(zones.map((z) => z.kind))];
  if (zones.length < 4 || kinds.length < 4)
    issue(
      'error',
      'zones',
      `Strefy: ${zones.length}, rodzaje: ${kinds.join(', ')}; wymagane ≥4 strefy i ≥4 rodzaje.`,
    );
  if (zones.length > 6)
    issue('warning', 'zone-count', `Strefy: ${zones.length}; ADR zaleca 4–6.`);
  if (measure.levels.length < 3)
    issue(
      'error',
      'height-levels',
      `Wykryte poziomy: ${measure.levels.join(', ')} m; wymagane ≥3.`,
    );
  const lookup = spatialIndex(room.blocks);
  const pillars = room.blocks.flatMap((b, index) => {
    if (
      b.visible === false ||
      b.size.y < 3 ||
      Math.max(b.size.x, b.size.z) > 3 ||
      b.size.y < Math.max(b.size.x, b.size.z) * 2 ||
      b.rotation?.x ||
      b.rotation?.z
    )
      return [];
    const top = b.position.y + b.size.y / 2;
    const face = corners(b, true);
    const samples = [b.position, ...face];
    const supported = samples.some((p) =>
      lookup(p.x, p.z).some((other) => {
        if (other === b) return false;
        const range = verticalRange(other, p.x, p.z);
        return range && Math.abs(range.min - top) < 0.25;
      }),
    );
    return supported ? [] : [{ index, position: b.position }];
  });
  if (pillars.length)
    issue(
      'error',
      'unsupported-pillars',
      `Wolnostojące słupy bez podparcia: ${pillars.length}.`,
      pillars,
    );
  const counts = new Map();
  for (const prop of [
    ...room.blocks.filter((b) => b.model),
    ...(room.decor ?? []),
  ])
    counts.set(prop.model, (counts.get(prop.model) ?? 0) + 1);
  const propTotal = [...counts.values()].reduce((a, b) => a + b, 0);
  const mostCommon = [...counts].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  )[0];
  if (mostCommon && mostCommon[1] / propTotal > 0.15 + EPS)
    issue(
      'error',
      'prop-share',
      `${mostCommon[0]}: ${mostCommon[1]}/${propTotal} (${((mostCommon[1] / propTotal) * 100).toFixed(1)}%); limit 15%.`,
    );
  const points = room.arena?.points ?? [];
  if (
    points.length < 3 ||
    points.length > 5 ||
    new Set(points.map((p) => p.id)).size !== points.length ||
    points.some((p) => !['A', 'B', 'C', 'D', 'E'].includes(p.id))
  )
    issue('error', 'capture-points', 'Wymagane 3–5 różnych punktów A–E.');
  const spawns = room.arena?.spawnPoints ?? room.spawnPoints;
  for (const [label, position, radius] of [
    ['playerSpawn', room.playerSpawn, 0],
    ...room.spawnPoints.map((p, i) => [`spawnPoints[${i}]`, p, 0]),
    ...(room.arena?.spawnPoints ?? []).map((p, i) => [
      `arena.spawnPoints[${i}]`,
      p,
      0,
    ]),
    ...points.map((p) => [`punkt ${p.id}`, p.position, p.radiusM]),
  ])
    if (!bounds || !contains(bounds, position, radius))
      issue(
        'error',
        'out-of-bounds',
        `${label} poza granicami areny (łącznie z promieniem punktu).`,
        position,
      );
  if (spawns.length < 16)
    issue('error', 'spawn-count', `Spawny: ${spawns.length}; ADR wymaga ≥16.`);
  for (const zone of zones)
    if (
      bounds &&
      (!contains(bounds, { x: zone.rect.minX, z: zone.rect.minZ }) ||
        !contains(bounds, { x: zone.rect.maxX, z: zone.rect.maxZ }))
    )
      issue('error', 'zone-bounds', `Strefa ${zone.name} poza obwiednią.`);
  for (const warning of metadata.warnings ?? [])
    issue('warning', warning.code, warning.message);
  return {
    metrics: {
      ...measure,
      bounds,
      widthM: width,
      depthM: depth,
      outlineFillRatio: Number(fillRatio.toFixed(3)),
      aspectRatio: Number(aspect.toFixed(3)),
      zones: zones.length,
      zoneKinds: kinds,
      spawnCount: spawns.length,
      propCount: propTotal,
      mostCommonProp: mostCommon
        ? {
            model: mostCommon[0],
            count: mostCommon[1],
            share: mostCommon[1] / propTotal,
          }
        : null,
    },
    issues,
    errors: issues.filter((i) => i.severity === 'error'),
    warnings: issues.filter((i) => i.severity === 'warning'),
  };
}
