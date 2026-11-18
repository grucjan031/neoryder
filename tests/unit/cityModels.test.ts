import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  Box3,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { Color, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { applyStyle } from '../../src/render/materials';
import {
  CITY_PROP_MODELS,
  OVERPASS_ROOFS_DOCKS_PROP_MODELS,
} from '../../src/scenes/cityPropsTest';

const folder = join(__dirname, '../../public/assets/models/city');
const colliders = {
  city_dumpster: [2, 1.3, 1.1],
  city_vending: [1, 2, 0.8],
  city_barrier: [2, 0.9, 0.5],
  city_car: [4.4, 1.4, 2],
  city_stall: [3, 2.6, 2],
  city_crates: [1.2, 1.6, 1.2],
  city_generator: [1.6, 1.4, 1],
  city_kiosk: [0.8, 2.2, 0.6],
} as const;
const wallModels = [
  'city_ac_unit',
  'city_pipe_run',
  'city_fire_escape',
  'city_shutter',
  'city_awning',
  'city_door',
  'city_sign_box',
  'city_ad_screen',
];
const spans = ['city_cable_span', 'city_lantern_string'];
const floorModels = [
  'city_street_lamp',
  'city_vent_grate',
  'city_trash_bags',
  'city_traffic_cone',
  'city_holo_projector',
  'city_antenna',
];
const arenaModels: Record<string, { size: readonly number[]; budget: number }> =
  {
    city_overpass_pillar: { size: [2.5, 10, 2.513], budget: 1500 },
    city_overpass_deck: { size: [14, 2.6, 12], budget: 1500 },
    city_highway_barrier: { size: [4, 1.093, 0.808], budget: 1500 },
    city_highway_sign_gantry: { size: [14, 7, 1.4], budget: 1500 },
    city_wrecked_car: { size: [2.15, 1.58, 3.95], budget: 1500 },
    city_smog_scrubber: { size: [3, 4, 3], budget: 1500 },
    city_roof_water_tank: { size: [3, 5, 3], budget: 1500 },
    city_roof_hvac_unit: { size: [4, 1.998, 2.052], budget: 1500 },
    city_market_stall_canopy: { size: [3.024, 2.612, 2], budget: 1500 },
    city_market_stall_canopy_violet: { size: [3.024, 2.612, 2], budget: 1500 },
    city_roof_bridge: { size: [1.6, 1.39, 8], budget: 1500 },
    city_neon_sign_frame: { size: [6, 3, 1.8], budget: 800 },
    city_satellite_cluster: { size: [3, 3.4, 2], budget: 800 },
  };
const walkableSlabs: Record<string, readonly number[]> = {
  city_overpass_deck: [14, 1.6, 12],
  city_roof_bridge: [1.6, 0.2, 8],
};
const names = [
  ...Object.keys(colliders),
  ...wallModels,
  ...floorModels,
  ...spans,
  ...Object.keys(arenaModels),
];
const materials = [
  'mat_concrete',
  'mat_asphalt',
  'mat_metal',
  'mat_trim',
  'mat_glass',
  'mat_cable',
  'mat_paint',
  'mat_lacquer',
  'mat_rust',
  'mat_corrugated',
  'mat_plastic',
  'mat_hivis',
  'mat_rubber',
  'mat_wood',
  'mat_fabric',
  'mat_machine',
  'mat_paving',
  'mat_plaster',
  'mat_hazard',
  'mat_neon_amber',
  'mat_neon_green',
  'mat_neon_violet',
  'mat_neon_blue',
  'mat_neon_white',
  'mat_light_white',
];
/** Nadruki mapowane UV: tekstura musi istnieć w public/assets/textures. */
const printName = /^mat_((label|screen)_[a-z0-9_]+)$/;
const textures = join(__dirname, '../../public/assets/textures');
const glowColors: Record<string, number> = {
  mat_neon_amber: 0xffae1a,
  mat_neon_green: 0x6dff4a,
  mat_neon_violet: 0x8a5cff,
  mat_neon_blue: 0x3d7bff,
  mat_neon_white: 0xfff1d6,
  mat_light_white: 0xfff1d6,
};
const landmarks: Record<string, string[]> = {
  city_dumpster: ['lid', 'wheel', 'handle'],
  city_vending: ['header', 'display', 'pickup'],
  city_barrier: ['concrete_body', 'stripe'],
  city_car: ['body', 'canopy', 'headlight', 'tail_light'],
  city_stall: ['counter', 'canopy', 'bulb', 'menu'],
  city_crates: ['crate_shell', 'rim', 'handle_recess'],
  city_generator: ['louvre', 'power_cable', 'socket'],
  city_ac_unit: ['fan_guard', 'wall_bracket'],
  city_pipe_run: ['pipe', 'pipe_clamp'],
  city_fire_escape: ['balcony', 'ladder_rail', 'rung'],
  city_shutter: ['slat', 'guide', 'roller_box'],
  city_awning: ['canopy', 'brace'],
  city_door: ['door_leaf', 'handle', 'keypad', 'status_dot'],
  city_sign_box: ['housing', 'sign_face'],
  city_street_lamp: ['pole', 'arm', 'lamp'],
  city_vent_grate: ['grate_bar', 'crossbar'],
  city_trash_bags: ['bag_0', 'tie'],
  city_traffic_cone: ['cone', 'reflector_band'],
  city_holo_projector: ['disc_base', 'emitter_ring'],
  city_antenna: ['mast', 'dish', 'receiver'],
  city_cable_span: ['cable_0', 'cable_1', 'cable_2'],
  city_lantern_string: ['wire', 'lantern', 'hanger'],
  city_ad_screen: ['housing', 'screen'],
  city_kiosk: ['body', 'map', 'news', 'ad'],
  city_overpass_pillar: ['shaft', 'capital', 'runoff_facet', 'drainpipe'],
  city_overpass_deck: ['walk_slab', 'side_barrier', 'reflector'],
  city_highway_barrier: ['concrete_body', 'reflector', 'lifting_loop'],
  city_highway_sign_gantry: ['truss_chord', 'truss_diagonal', 'blank_panel'],
  city_wrecked_car: [
    'crumpled_body',
    'buckled_hood',
    'glass_shard',
    'flat_tire',
  ],
  city_smog_scrubber: ['fan_blade', 'fan_guard', 'exhaust_cowl', 'status'],
  city_roof_water_tank: ['wood_tank', 'steel_hoop', 'leg', 'cross_brace'],
  city_roof_hvac_unit: ['fan_blade', 'fan_collar', 'louvre'],
  city_market_stall_canopy: ['canopy', 'valance', 'counter', 'crate'],
  city_market_stall_canopy_violet: ['canopy', 'valance', 'counter', 'crate'],
  city_roof_bridge: ['walk_slab', 'handrail', 'rail_post'],
  city_neon_sign_frame: ['blank_panel', 'rear_brace', 'amber_edge'],
  city_satellite_cluster: ['common_base', 'dish', 'receiver', 'mast'],
};

it('zawiera cały zestaw 37 modeli miasta i udostępnia go w galerii', () => {
  // Modele portu (port_*) leżą w tym samym folderze; sprawdza je portModels.test.ts.
  const city = readdirSync(folder).filter((file) => file.startsWith('city_'));
  expect(city.sort()).toEqual(names.map((n) => `${n}.glb`).sort());
  expect([...CITY_PROP_MODELS].sort()).toEqual([...names].sort());
});

it.each(names)('%s: geometria, paleta, budżet i montaż GLB', async (name) => {
  const file = readFileSync(join(folder, `${name}.glb`));
  expect(file.readUInt32LE(0)).toBe(0x46546c67);
  expect(file.readUInt32LE(4)).toBe(2);
  expect(file.readUInt32LE(8)).toBe(file.byteLength);
  const gltf = await new GLTFLoader().parseAsync(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    '',
  );
  let triangles = 0;
  gltf.scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const position = node.geometry.getAttribute('position');
    expect(position.count).toBeGreaterThan(0);
    for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(position.getX(i))).toBe(true);
      expect(Number.isFinite(position.getY(i))).toBe(true);
      expect(Number.isFinite(position.getZ(i))).toBe(true);
    }
    triangles += (node.geometry.index?.count ?? position.count) / 3;
    const used = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of used) {
      const print = printName.exec(mat.name);
      if (print) {
        const folder = print[2] === 'label' ? 'labels' : 'screens';
        expect(
          existsSync(join(textures, folder, `${print[1]}.webp`)),
          mat.name,
        ).toBe(true);
        expect(node.geometry.getAttribute('uv'), mat.name).toBeDefined();
      } else expect(materials).toContain(mat.name);
      expect(mat).toBeInstanceOf(MeshStandardMaterial);
      if (!(mat instanceof MeshStandardMaterial)) continue;
      expect(mat.map).toBeNull();
      const glow = glowColors[mat.name];
      if (glow !== undefined) {
        expect(mat.emissive.getHex()).toBe(glow);
        expect(mat.emissiveIntensity).toBeGreaterThan(0);
      } else {
        expect(mat.emissive.getHex()).toBe(0);
      }
    }
  });
  const collision = Object.prototype.hasOwnProperty.call(colliders, name);
  expect(triangles).toBeGreaterThan(0);
  expect(triangles).toBeLessThanOrEqual(
    arenaModels[name]?.budget ?? (collision ? 1500 : 800),
  );
  for (const landmark of landmarks[name] ?? []) {
    expect(gltf.scene.getObjectByName(landmark), landmark).toBeDefined();
  }
  const box = new Box3().setFromObject(gltf.scene, true);
  const size = box.getSize(new Vector3());
  const arena = arenaModels[name];
  if (arena) {
    for (const [axis, actual] of size.toArray().entries())
      expect(actual).toBeCloseTo(arena.size[axis]!, 2);
    expect(gltf.scene.getObjectByName(name)).toBeDefined();
    expect(
      existsSync(
        join(__dirname, `../../tools/blender/previews/city/${name}.png`),
      ),
    ).toBe(true);
  }
  if (spans.includes(name)) {
    expect(box.min.x).toBeCloseTo(-5, 5);
    expect(box.max.x).toBeCloseTo(5, 5);
    expect(box.max.y).toBeCloseTo(0, 5);
    expect(box.min.y).toBeLessThan(-0.8);
    const lanterns: Mesh[] = [];
    gltf.scene.traverse((node) => {
      if (node instanceof Mesh && /^lantern(?:[._]?\d+)?$/.test(node.name))
        lanterns.push(node);
    });
    if (name === 'city_lantern_string') expect(lanterns).toHaveLength(8);
  } else {
    expect(box.min.y).toBeCloseTo(0, 5);
    if (wallModels.includes(name)) {
      expect(box.min.z).toBeCloseTo(0, 5);
    } else {
      expect((box.max.x + box.min.x) / 2).toBeCloseTo(0, 5);
      expect((box.max.z + box.min.z) / 2).toBeCloseTo(0, 5);
    }
  }
  if (collision) {
    const expected = colliders[name as keyof typeof colliders];
    for (const [axis, actual] of [size.x, size.y, size.z].entries()) {
      expect(Math.abs(actual / expected[axis]! - 1)).toBeLessThanOrEqual(0.05);
    }
  }
  if (name === 'city_sign_box') {
    const face = gltf.scene.getObjectByName('sign_face')!;
    const faceBox = new Box3().setFromObject(face, true);
    expect(faceBox.max.z).toBeCloseTo(0.25, 5);
    expect(size.x).toBeCloseTo(2, 5);
    expect(size.y).toBeCloseTo(1, 5);
    expect(size.z).toBeCloseTo(0.25, 5);
  }
  if (name === 'city_car') {
    const headlight = gltf.scene.getObjectByName('headlight')!;
    const tail = gltf.scene.getObjectByName('tail_light')!;
    // Auto stoi wzdłuż X (długość bloku 4,4 m), przód w +X, bok do gracza w +Z.
    expect(headlight.getWorldPosition(new Vector3()).x).toBeGreaterThan(2);
    expect(tail.getWorldPosition(new Vector3()).x).toBeLessThan(-2);
  }
  if (name.startsWith('city_market_stall_canopy')) {
    const canopy = gltf.scene.getObjectByName('canopy') as Mesh;
    const mat = canopy.material as MeshStandardMaterial;
    expect(mat.name).toBe(
      name.endsWith('_violet') ? 'mat_fabric' : 'mat_lacquer',
    );
  }
  const walkable = walkableSlabs[name];
  if (walkable) {
    const slab = gltf.scene.getObjectByName('walk_slab')!;
    const slabMeshes = new Set<Mesh>();
    slab.traverse((node) => {
      if (node instanceof Mesh) slabMeshes.add(node);
    });
    expect(slabMeshes.size).toBeGreaterThan(0);
    const slabBox = new Box3().setFromObject(slab, true);
    slabBox
      .getSize(new Vector3())
      .toArray()
      .forEach((dimension, axis) => {
        expect(dimension).toBeCloseTo(walkable[axis]!, 5);
      });
    expect(slabBox.min.y).toBeCloseTo(0, 5);
    let topArea = 0;
    const a = new Vector3(),
      b = new Vector3(),
      c = new Vector3();
    for (const mesh of slabMeshes) {
      const geometry = mesh.geometry.toNonIndexed();
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i += 3) {
        a.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(positions, i + 1).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(positions, i + 2).applyMatrix4(mesh.matrixWorld);
        const normal = b.clone().sub(a).cross(c.clone().sub(a));
        if (normal.y <= 0) continue;
        for (const vertex of [a, b, c])
          expect(vertex.y).toBeCloseTo(walkable[1]!, 5);
        topArea += normal.length() / 2;
      }
      geometry.dispose();
    }
    // Pełna powierzchnia płyty bez dziur, nachyleń ani podwójnych warstw.
    expect(topArea).toBeCloseTo(walkable[0]! * walkable[2]!, 4);
    gltf.scene.traverse((node) => {
      if (!(node instanceof Mesh) || slabMeshes.has(node)) return;
      const obstruction = new Box3().setFromObject(node, true);
      if (obstruction.max.y <= walkable[1]! + 0.00001) return;
      const clearHalfWidth = name === 'city_overpass_deck' ? 6.2 : 0.689;
      expect(
        obstruction.max.x <= -clearHalfWidth + 0.00001 ||
          obstruction.min.x >= clearHalfWidth - 0.00001,
        `Przeszkoda na płaskim przejściu: ${node.name}`,
      ).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Zestaw „estakada, dachy, doki” (tools/blender/sets/overpass_roofs_docks.py, docs/assets.md).

type Range = readonly [number, number];
interface SetSpec {
  /** AABB X × Y × Z [m], ±5 mm. */
  size: readonly [number, number, number];
  /** Minimum AABB (punkt odniesienia) modeli niewyśrodkowanych w XZ. */
  min?: readonly [number, number, number];
  budget: number;
  landmarks: readonly string[];
  /** Zamknięta płyta `walk_slab`: jeden płaski wierzch na wysokości y nad prostokątem XZ. */
  slab?: { y: number; x: Range; z: Range };
  /** Powierzchnie chodzenia: promienie w dół z wysokości y + `from` (domyślnie 5 m) trafiają w y. */
  walk?: readonly { y: number; x: Range; z: Range; from?: number }[];
  /** Spód zadaszenia: promienie w górę z y = 1 m trafiają najniżej na wysokości y. */
  ceiling?: { y: number; x: Range; z: Range };
  /** Przejścia wolne od geometrii: promienie wzdłuż `axis` przez cały prostopadłościan. */
  clear?: readonly { x: Range; y: Range; z: Range; axis: 'x' | 'y' | 'z' }[];
}

const overpassRoofsDocks: Record<string, SetSpec> = {
  hw_gas_canopy: {
    size: [24, 6.7, 12],
    budget: 2000,
    landmarks: ['canopy_body', 'fascia', 'soffit_light', 'column_tiles'],
    ceiling: { y: 5.5, x: [-7.5, -1.5], z: [-2, 2] },
    clear: [
      { x: [-11.9, 11.9], y: [0.3, 5.499], z: [-2.4, 2.4], axis: 'x' },
      { x: [-5.5, -3.5], y: [0.3, 5.499], z: [-5.9, 5.9], axis: 'z' },
    ],
  },
  hw_gas_pump: {
    size: [1.2, 2, 0.604],
    budget: 1500,
    landmarks: ['body', 'display', 'hose', 'nozzle'],
  },
  hw_toll_booth: {
    size: [6.53, 3, 9],
    min: [-1.42, 0, -4.5],
    budget: 1500,
    landmarks: ['booth_glass', 'island', 'arm', 'signal_go'],
  },
  hw_broken_deck_end: {
    size: [14, 2.6, 12],
    min: [-7, 0, -6],
    budget: 2000,
    landmarks: ['walk_slab', 'torn_end', 'rebar', 'hanging_cable'],
    slab: { y: 1.6, x: [-7, 7], z: [-6, 4] },
    walk: [{ y: 1.6, x: [-6, 6], z: [-5.8, 3.9] }],
    clear: [{ x: [-6.1, 6.1], y: [1.65, 3.5], z: [-5.9, 3.9], axis: 'x' }],
  },
  hw_vent_tower: {
    size: [8, 25, 8],
    budget: 3000,
    landmarks: ['shaft', 'louvres', 'green_lamp', 'door'],
  },
  hw_camp_tent_dome: {
    size: [3.28, 1.281, 2.87],
    budget: 800,
    landmarks: ['fly', 'pole', 'door'],
  },
  hw_camp_tent_ridge: {
    size: [2.202, 1.739, 3.95],
    budget: 800,
    landmarks: ['tarp', 'frame', 'back_panel'],
  },
  hw_camp_shack: {
    size: [3.1, 2.4, 2.617],
    budget: 1500,
    landmarks: ['sheet', 'timber', 'tarp', 'lamp'],
    clear: [{ x: [-0.4, 0.38], y: [0.5, 1.95], z: [0.5, 1.4], axis: 'z' }],
  },
  hw_fire_barrel: {
    size: [0.622, 1.42, 0.614],
    budget: 800,
    landmarks: ['drum', 'fire', 'fire_core'],
  },
  hw_storm_culvert: {
    size: [9.7, 5.8, 8],
    min: [-4.85, 0, -6],
    budget: 2000,
    landmarks: ['walk_slab', 'culvert', 'grate', 'lamp'],
    slab: { y: 0.2, x: [-3, 3], z: [-6, 1.5] },
    walk: [{ y: 0.2, x: [-2.9, 2.9], z: [-5.9, 1.4], from: 1 }],
    clear: [
      { x: [-2.9, 2.9], y: [0.3, 4.1], z: [-5.9, -0.2], axis: 'z' },
      { x: [-0.2, 2.6], y: [0.3, 2.5], z: [-6, 1.5], axis: 'z' },
    ],
  },
  roof_clock_tower: {
    size: [8, 35, 8],
    min: [-4, 0, -4],
    budget: 3000,
    landmarks: ['tower', 'dial', 'dial_marks', 'helmet', 'bell'],
  },
  roof_giant_sign: {
    size: [20, 12.667, 5.511],
    budget: 2000,
    landmarks: ['panel_violet', 'panel_amber', 'scaffold', 'catwalk'],
  },
  roof_stairwell_hut: {
    size: [3.2, 3, 4.5],
    budget: 1500,
    landmarks: ['wall', 'door_frame', 'door_leaf', 'roof'],
    walk: [{ y: 3, x: [-1.45, 1.45], z: [-2.2, 1.5] }],
    clear: [
      { x: [-0.59, 0.59], y: [0.05, 2.18], z: [-1.95, 2.24], axis: 'z' },
      { x: [-1.33, 1.33], y: [0.05, 2.7], z: [-1.98, 0.1], axis: 'x' },
    ],
  },
  roof_skylight: {
    size: [3, 0.8, 2],
    budget: 800,
    landmarks: ['walk_slab'],
    slab: { y: 0.8, x: [-1.5, 1.5], z: [-1, 1] },
    walk: [{ y: 0.8, x: [-1.45, 1.45], z: [-0.95, 0.95] }],
  },
  roof_chimney_stack: {
    size: [2, 3, 1],
    budget: 800,
    landmarks: ['stack', 'pot', 'cowl'],
  },
  dock_pontoon: {
    size: [6, 0.8, 2.4],
    budget: 1500,
    landmarks: ['walk_slab', 'float', 'fender', 'marker_lamp'],
    slab: { y: 0.5, x: [-3, 3], z: [-1.2, 1.2] },
    walk: [{ y: 0.5, x: [-2.45, 2.45], z: [-0.85, 0.85] }],
  },
  dock_skiff: {
    size: [6.2, 1.72, 2.04],
    budget: 800,
    landmarks: ['hull', 'motor', 'rub_rail'],
  },
  dock_pump_house: {
    size: [16, 12.4, 16.683],
    min: [-8, 0, -5],
    budget: 3000,
    landmarks: ['walk_slab', 'brick', 'pipe', 'window', 'amber_light'],
    slab: { y: 0.1, x: [-7.9, 7.9], z: [-4.3, 4.3] },
    walk: [
      { y: 0.1, x: [-7.3, 7.3], z: [-4.2, 1.3], from: 1 },
      { y: 0.1, x: [-7.85, 7.85], z: [-2.95, -0.05], from: 1 },
    ],
    clear: [{ x: [-8, 8], y: [0.15, 3.05], z: [-2.95, -0.05], axis: 'x' }],
  },
  dock_lock_gate: {
    size: [12, 7.45, 2.4],
    budget: 2000,
    landmarks: ['walk_slab', 'leaf', 'abutment', 'steelwork', 'signal_go'],
    slab: { y: 6, x: [-5, 5], z: [-0.7, 0.7] },
    walk: [{ y: 6, x: [-5.95, 5.95], z: [-0.65, 0.65] }],
    clear: [{ x: [-5.95, 5.95], y: [6.05, 7], z: [-0.6, 0.6], axis: 'x' }],
  },
  dock_barge: {
    size: [30, 6.72, 8],
    budget: 2000,
    landmarks: ['walk_slab', 'hull', 'fender', 'tyre', 'wheelhouse_glass'],
    slab: { y: 2.6, x: [-15, 15], z: [-4, 4] },
    walk: [{ y: 2.6, x: [-13.6, 10.8], z: [-3.6, 3.6] }],
    clear: [{ x: [-13.6, 10.8], y: [2.65, 4.5], z: [-3.6, 3.6], axis: 'x' }],
  },
  dock_mooring_post: {
    size: [1.039, 4.2, 1.035],
    min: [-0.505, 0, -0.505],
    budget: 800,
    landmarks: ['pile', 'band', 'rope', 'marker_lamp'],
  },
  dock_half_sunken_car: {
    size: [2.123, 2.489, 4.215],
    budget: 800,
    landmarks: ['body', 'cabin_glass', 'wheel', 'tail_lamp'],
  },
};
const setNames = Object.keys(overpassRoofsDocks);
const setMaterials = new Set([
  ...materials,
  'mat_steel_grating',
  'mat_quay_concrete',
  'mat_rubber_fender',
  'mat_crane_paint',
  'mat_overpass_concrete',
  'mat_smog_soot_wall',
  'mat_roof_tar',
  'mat_roof_hvac_metal',
  'mat_market_tarp',
  'mat_gas_station_tiles',
  'mat_highway_asphalt_worn',
  'mat_flood_brick_algae',
  'mat_boardwalk_planks',
  'mat_canal_stone_wall',
]);

/** Barwy zarezerwowane (ADR 0006): czerwień wrogów, cyan gracza, magenta Rezonansu. */
function reserved(color: Color): boolean {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl, SRGBColorSpace);
  const hue = hsl.h * 360;
  if (hsl.s < 0.35 || hsl.l < 0.08) return false;
  return (
    hue < 15 ||
    hue >= 345 ||
    (hue >= 170 && hue <= 200) ||
    (hue >= 285 && hue <= 335)
  );
}

function grid(range: Range, steps: number): number[] {
  return Array.from(
    { length: steps + 1 },
    (_, i) => range[0] + ((range[1] - range[0]) * i) / steps,
  );
}

async function loadSetModel(name: string): Promise<Object3D> {
  const file = readFileSync(join(folder, `${name}.glb`));
  const gltf = await new GLTFLoader().parseAsync(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

it('zestaw estakada, dachy, doki: komplet plików, podglądów i galerii', () => {
  const files = readdirSync(folder).filter((file) =>
    /^(hw|roof|dock)_.*\.glb$/.test(file),
  );
  expect(files.sort()).toEqual(setNames.map((n) => `${n}.glb`).sort());
  expect([...OVERPASS_ROOFS_DOCKS_PROP_MODELS].sort()).toEqual(
    [...setNames].sort(),
  );
  for (const name of setNames)
    expect(
      existsSync(
        join(__dirname, `../../tools/blender/previews/city/${name}.png`),
      ),
      name,
    ).toBe(true);
});

it.each(setNames)(
  '%s: AABB, budżet, materiały gry, paleta i powierzchnie chodzenia',
  async (name) => {
    const spec = overpassRoofsDocks[name]!;
    const scene = await loadSetModel(name);
    expect(scene.getObjectByName(name)).toBeDefined();
    let triangles = 0;
    const originalNames = new Map<Mesh, string[]>();
    scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const position = node.geometry.getAttribute('position');
      triangles += (node.geometry.index?.count ?? position.count) / 3;
      const used = Array.isArray(node.material)
        ? node.material
        : [node.material];
      originalNames.set(
        node,
        used.map((mat) => mat.name),
      );
      for (const mat of used) {
        expect(setMaterials.has(mat.name), mat.name).toBe(true);
        expect(mat).toBeInstanceOf(MeshStandardMaterial);
        if (!(mat instanceof MeshStandardMaterial)) continue;
        expect(mat.map).toBeNull();
        expect(reserved(mat.color), `${mat.name} kolor`).toBe(false);
        const glow = glowColors[mat.name];
        if (glow === undefined) expect(mat.emissive.getHex(), mat.name).toBe(0);
        else {
          expect(mat.emissive.getHex(), mat.name).toBe(glow);
          expect(mat.emissiveIntensity).toBeGreaterThan(0);
        }
      }
    });
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThanOrEqual(spec.budget);
    for (const landmark of spec.landmarks)
      expect(scene.getObjectByName(landmark), landmark).toBeDefined();

    const box = new Box3().setFromObject(scene, true);
    box
      .getSize(new Vector3())
      .toArray()
      .forEach((actual, axis) =>
        expect(actual, `oś ${axis}`).toBeCloseTo(spec.size[axis]!, 2),
      );
    expect(box.min.y).toBeCloseTo(0, 4);
    const min = spec.min;
    if (min)
      box.min
        .toArray()
        .forEach((actual, axis) =>
          expect(actual, `min ${axis}`).toBeCloseTo(min[axis]!, 2),
        );
    else {
      expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 3);
      expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 3);
    }

    const meshes = [...originalNames.keys()];
    const ray = new Raycaster();
    if (spec.slab) {
      const { y, x, z } = spec.slab;
      const slab = scene.getObjectByName('walk_slab')!;
      const slabBox = new Box3().setFromObject(slab, true);
      expect(slabBox.min.x).toBeCloseTo(x[0], 5);
      expect(slabBox.max.x).toBeCloseTo(x[1], 5);
      expect(slabBox.min.z).toBeCloseTo(z[0], 5);
      expect(slabBox.max.z).toBeCloseTo(z[1], 5);
      expect(slabBox.max.y).toBeCloseTo(y, 5);
      let topArea = 0;
      const a = new Vector3(),
        b = new Vector3(),
        c = new Vector3();
      slab.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const geometry = node.geometry.toNonIndexed();
        const positions = geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i += 3) {
          a.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
          b.fromBufferAttribute(positions, i + 1).applyMatrix4(
            node.matrixWorld,
          );
          c.fromBufferAttribute(positions, i + 2).applyMatrix4(
            node.matrixWorld,
          );
          const normal = b.clone().sub(a).cross(c.clone().sub(a));
          if (normal.y <= 0) continue;
          for (const vertex of [a, b, c]) expect(vertex.y).toBeCloseTo(y, 5);
          topArea += normal.length() / 2;
        }
        geometry.dispose();
      });
      // Jeden płaski wierzch bez dziur, nachyleń i podwójnych warstw.
      expect(topArea).toBeCloseTo((x[1] - x[0]) * (z[1] - z[0]), 3);
    }
    for (const { y, x, z, from = 5 } of spec.walk ?? [])
      for (const px of grid(x, 8))
        for (const pz of grid(z, 4)) {
          ray.set(new Vector3(px, y + from, pz), new Vector3(0, -1, 0));
          const hit = ray.intersectObjects(meshes, false)[0];
          expect(
            hit,
            `chodzenie ${px.toFixed(2)}, ${pz.toFixed(2)}`,
          ).toBeDefined();
          expect(hit!.point.y).toBeCloseTo(y, 4);
        }
    if (spec.ceiling) {
      const { y, x, z } = spec.ceiling;
      for (const px of grid(x, 4))
        for (const pz of grid(z, 4)) {
          ray.set(new Vector3(px, 1, pz), new Vector3(0, 1, 0));
          const hit = ray.intersectObjects(meshes, false)[0];
          expect(hit, `spód ${px}, ${pz}`).toBeDefined();
          expect(hit!.point.y).toBeGreaterThanOrEqual(y - 1e-4);
          expect(hit!.point.y).toBeLessThan(y + 0.1);
        }
    }
    const axes = ['x', 'y', 'z'] as const;
    for (const passage of spec.clear ?? []) {
      const along = axes.indexOf(passage.axis);
      const [u, v] = axes.filter((axis) => axis !== passage.axis);
      if (!u || !v) throw new Error('oś przejścia');
      const range = passage[passage.axis];
      for (const pu of grid(passage[u], 2))
        for (const pv of grid(passage[v], 2)) {
          const origin = new Vector3();
          origin.setComponent(along, range[0]);
          origin.setComponent(axes.indexOf(u), pu);
          origin.setComponent(axes.indexOf(v), pv);
          ray.set(origin, new Vector3().setComponent(along, 1));
          ray.far = range[1] - range[0];
          const hits = ray.intersectObjects(meshes, false);
          expect(
            hits.map((hit) => hit.object.name),
            `przejście ${passage.axis} ${pu.toFixed(2)}, ${pv.toFixed(2)}`,
          ).toEqual([]);
        }
      ray.far = Infinity;
    }

    // Gra rozpoznaje każdy materiał po nazwie (bez zastępczego mat_world).
    applyStyle(scene);
    for (const [node, names] of originalNames) {
      const used = Array.isArray(node.material)
        ? node.material
        : [node.material];
      expect(used.map((mat) => mat.name)).toEqual(names);
    }
  },
);
