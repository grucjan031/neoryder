import { createArena, vec } from './lib/arena.mjs';
import { createPrimitives } from './lib/prims.mjs';

export const fixtureOnly = true;

export default function generate() {
  const arena = createArena({
    id: 'arenaLibDemo',
    name: 'Laboratorium generatorów aren',
    theme: 'neonStreet',
    weather: 'rain',
    seed: 'arena-library-demo-v1',
    bounds: { minX: 0, maxX: 160, minZ: 0, maxZ: 120 },
  });
  const p = createPrimitives(arena);
  const rect = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });
  arena.roomMeta({ playerSpawn: vec(5, 0, 60), maxAlive: 12 });
  // Obrys L i otwór w gruncie wykopu; pod nim nie ma pełnej płyty y=0.
  for (const r of [
    rect(0, 100, 0, 80),
    rect(130, 160, 0, 80),
    rect(100, 130, 0, 30),
    rect(100, 130, 55, 80),
    rect(0, 100, 80, 120),
  ])
    p.floor(r, 0, 'asphalt');
  p.building({
    rect: rect(12, 48, 12, 40),
    height: 8,
    floors: 2,
    wallMaterial: 'facade',
    roofMaterial: 'roof_tar',
    doors: [{ side: 'south', at: 18, width: 5 }],
    windows: [{ side: 'east', at: 14, width: 6, height: 2, bottom: 4.5 }],
    interior: true,
    stairs: { width: 3, stepDepth: 1 },
    roofAccessible: true,
  });
  p.hall({
    rect: rect(55, 92, 12, 45),
    height: 10,
    mezzanine: { side: 'east', depth: 7, y: 3 },
    doors: [{ side: 'south', at: 16, width: 6 }],
  });
  p.wall(vec(8, 0, 49), vec(40, 0, 49), 3, 0.5, 'plaster', {
    openings: [{ at: 15, width: 5, height: 2.5 }],
  });
  p.floor(rect(30, 45, 66, 80), 2, 'steel_grating');
  p.floor(rect(65, 78, 66, 80), 2, 'steel_grating');
  p.ramp({ from: vec(10, 0, 73), to: vec(30, 2, 73), width: 5 });
  p.bridge({
    from: vec(45, 2, 73),
    to: vec(65, 2, 73),
    width: 4,
    railings: true,
  });
  p.stairs({
    from: vec(98, 0, 73),
    to: vec(78, 2, 73),
    width: 4,
    stepRise: 0.2,
    stepDepth: 1,
    material: 'steel_grating',
  });
  for (let i = 0; i < 3; i++)
    p.containerStack({
      position: vec(15 + i * 15, 0, 102),
      layers: i + 1,
      length: i === 2 ? 40 : 20,
      palette: ['navy', 'olive', 'ochre', 'graphite'],
    });
  p.pit({
    rect: rect(100, 130, 30, 55),
    depth: 3,
    wallMaterial: 'quay_concrete',
    ramps: [
      {
        side: 'west',
        at: 12.5,
        from: vec(100, 0, 42.5),
        to: vec(120, -3, 42.5),
        width: 5,
      },
    ],
  });
  p.quay({ edge: vec(45, 0, 120), waterSide: 'south', length: 40, height: 2 });
  const outline = [
    vec(0, 0, 0),
    vec(160, 0, 0),
    vec(160, 0, 80),
    vec(100, 0, 80),
    vec(100, 0, 120),
    vec(0, 0, 120),
  ];
  for (let i = 0; i < outline.length; i++)
    p.fence({
      from: outline[i],
      to: outline[(i + 1) % outline.length],
      height: 4,
    });
  p.safetyBoundary(
    [
      vec(-1, 0, -1),
      vec(161, 0, -1),
      vec(161, 0, 81),
      vec(101, 0, 81),
      vec(101, 0, 121),
      vec(-1, 0, 121),
    ],
    8,
  );
  p.scatter({
    rect: rect(53, 95, 88, 115),
    models: [
      'city_ac_unit',
      'city_generator',
      'city_stall',
      'city_street_lamp',
      'city_pipe_run',
      'city_holo_projector',
      'city_fire_escape',
      'city_lantern_string',
      'city_car',
      'city_barrier',
      'city_antenna',
      'city_awning',
    ],
    count: 64,
    minSpacing: 3,
    rng: arena.rng,
    avoid: [rect(72, 80, 98, 105)],
  });
  for (const [name, r, kind] of [
    ['Plac', rect(0, 100, 45, 85), 'open'],
    ['Kontenery', rect(0, 100, 85, 120), 'dense'],
    ['Wnętrza', rect(8, 95, 8, 45), 'interior'],
    ['Kładki', rect(8, 98, 65, 82), 'high'],
    ['Wykop', rect(100, 130, 30, 55), 'low'],
  ])
    arena.zone(name, r, kind);
  for (const [id, position] of [
    ['A', vec(5, 0, 80)],
    ['B', vec(145, 0, 65)],
    ['C', vec(84, 0, 55)],
  ])
    arena.point(id, position, 4);
  for (const position of [
    vec(5, 0, 5),
    vec(50, 0, 5),
    vec(95, 0, 5),
    vec(130, 0, 5),
    vec(150, 0, 5),
    vec(5, 0, 45),
    vec(50, 0, 55),
    vec(95, 0, 55),
    vec(145, 0, 25),
    vec(145, 0, 50),
    vec(155, 0, 75),
    vec(5, 0, 110),
    vec(30, 0, 115),
    vec(50, 0, 115),
    vec(90, 0, 115),
    vec(95, 0, 85),
  ])
    arena.spawn(position);
  arena.light(vec(30, 6, 43), '#ffae1a', 40, 20);
  arena.light(vec(75, 8, 30), '#fff1d6', 40, 20);
  return arena;
}
