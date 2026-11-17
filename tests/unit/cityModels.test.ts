import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  Box3,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Triangle,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { applyStyle } from '../../src/render/materials';
import {
  CITY_PROP_MODELS,
  CONSTRUCTION_POWER_PROP_MODELS,
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

const constructionPowerModels: Record<
  string,
  { size: readonly [number, number, number]; budget: number }
> = {
  build_hoarding_fence: { size: [4, 2.4, 1.1], budget: 400 },
  build_mixer_truck: { size: [2.51, 3.55, 9.02], budget: 1600 },
  build_pipe_stack: { size: [3.02, 2.79321, 3], budget: 650 },
  build_precast_stack: { size: [6, 1.6, 2.406], budget: 500 },
  build_rebar_bundle: { size: [6, 0.58963, 1.01986], budget: 700 },
  build_scaffold_bay: { size: [2.5, 3.1, 1.2], budget: 600 },
  build_site_office: { size: [6.058, 2.591, 2.438], budget: 750 },
  build_site_office_stairs: { size: [5.87091, 3.691, 1.68], budget: 750 },
  build_tower_crane: { size: [6.325, 65.25, 64.0962], budget: 4000 },
  build_unfinished_column: { size: [0.605, 4.8, 0.605], budget: 350 },
  power_chimney: { size: [10, 120, 10], budget: 2700 },
  power_cooling_tower: { size: [50, 70, 50], budget: 3600 },
  power_cooling_tower_breach: { size: [50, 70, 49.55186], budget: 3700 },
  power_hv_pylon: { size: [16.5, 30, 7.2], budget: 2700 },
  power_pipe_rack: { size: [12, 7.3, 4.02], budget: 1800 },
  power_slag_heap: { size: [26, 7, 26], budget: 300 },
  power_transformer: { size: [6, 5, 4], budget: 1550 },
  power_turbine_housing: { size: [20, 7.1, 6], budget: 2000 },
};

// Prostokąty wolne od poręczy; dane do osadzenia colliderów w przyszłych arenach.
const constructionPowerDecks: Record<
  string,
  { y: number; x: [number, number]; z: [number, number] }
> = {
  build_scaffold_bay: { y: 2, x: [-1.25, 1.25], z: [-0.49, 0.49] },
  build_precast_stack: { y: 1.6, x: [-2.975, 2.975], z: [-1.175, 1.175] },
  build_site_office: { y: 2.591, x: [-3.029, 3.029], z: [-1.219, 1.219] },
  build_site_office_stairs: { y: 2.591, x: [2, 3], z: [-0.7, 0.7] },
  power_cooling_tower: { y: 0, x: [-16, 16], z: [-16, 16] },
  power_cooling_tower_breach: { y: 0, x: [-16, 16], z: [-16, 16] },
  power_turbine_housing: { y: 6, x: [-9.8, 9.8], z: [-2.8, 2.8] },
  power_pipe_rack: { y: 6.2, x: [-6, 6], z: [0.55, 1.95] },
};

function expectWalkableDeck(
  meshes: Mesh[],
  { y, x, z }: (typeof constructionPowerDecks)[string],
): void {
  const down = new Vector3(0, -1, 0);
  const inset = 0.001;
  for (const px of [x[0] + inset, (x[0] + x[1]) / 2, x[1] - inset]) {
    for (const pz of [z[0] + inset, (z[0] + z[1]) / 2, z[1] - inset]) {
      const ray = new Raycaster(new Vector3(px, y + 0.05, pz), down, 0, 0.1);
      const [hit] = ray.intersectObjects(meshes, false);
      expect(hit, `Brak podestu w (${px}, ${y}, ${pz})`).toBeDefined();
      expect(hit!.point.y).toBeCloseTo(y, 5);
    }
  }
}

function expectWalkableSlagSlopes(meshes: Mesh[]): void {
  const triangle = new Triangle();
  const normal = new Vector3();
  let slopeFaces = 0;
  for (const mesh of meshes) {
    const positions = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.index;
    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
      [triangle.a, triangle.b, triangle.c].forEach((point, offset) => {
        const vertex = index?.getX(i + offset) ?? i + offset;
        point
          .set(
            positions.getX(vertex),
            positions.getY(vertex),
            positions.getZ(vertex),
          )
          .applyMatrix4(mesh.matrixWorld);
      });
      if (Math.max(triangle.a.y, triangle.b.y, triangle.c.y) < 0.00001)
        continue;
      triangle.getNormal(normal);
      expect(normal.y).toBeGreaterThanOrEqual(Math.cos(Math.PI / 6) - 0.00001);
      slopeFaces++;
    }
  }
  expect(slopeFaces).toBeGreaterThan(0);
}

function expectCoolingTowerBreach(meshes: Mesh[]): void {
  const inward = new Vector3(0, 0, -1);
  for (const y of [0.1, 3.9, 4.1, 7, 9.9]) {
    for (const x of [-4, -2, 0, 2, 4]) {
      const ray = new Raycaster(new Vector3(x, y, 27), inward, 0, 9);
      expect(
        ray.intersectObjects(meshes, false),
        `Przejście w (${x}, ${y})`,
      ).toHaveLength(0);
    }
  }
  const above = new Raycaster(new Vector3(0, 10.1, 27), inward, 0, 9);
  expect(above.intersectObjects(meshes, false).length).toBeGreaterThan(0);
}

it('udostępnia w galerii wszystkie modele budowy i elektrowni', () => {
  const expected = Object.keys(constructionPowerModels).sort();
  const files = readdirSync(folder).filter((file) =>
    /^(build|power)_/.test(file),
  );
  expect(files.sort()).toEqual(expected.map((id) => `${id}.glb`));
  expect([...CONSTRUCTION_POWER_PROP_MODELS].sort()).toEqual(expected);
});

it.each(Object.entries(constructionPowerModels))(
  '%s: AABB, budżet i materiały budowy i elektrowni',
  async (name, spec) => {
    const file = readFileSync(join(folder, `${name}.glb`));
    const { scene } = await new GLTFLoader().parseAsync(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
      '',
    );
    expect(scene.getObjectByName(name)).toBeDefined();
    expect(
      existsSync(
        join(__dirname, `../../tools/blender/previews/city/${name}.png`),
      ),
    ).toBe(true);
    const bounds = new Box3().setFromObject(scene, true);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    for (const [axis, size] of bounds
      .getSize(new Vector3())
      .toArray()
      .entries())
      expect(size).toBeCloseTo(spec.size[axis]!, 2);

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
        used.map((material) => material.name),
      );
      for (const material of used) {
        expect(material).toBeInstanceOf(MeshStandardMaterial);
        if (!(material instanceof MeshStandardMaterial)) continue;
        expect(material.map).toBeNull();
        expect(material.name).not.toBe('mat_world');
        expect(material.emissive.getHex(), material.name).toBe(
          glowColors[material.name] ?? 0,
        );
        if (glowColors[material.name] !== undefined)
          expect(material.emissiveIntensity).toBeGreaterThan(0);
      }
    });
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThanOrEqual(spec.budget);
    const meshes = [...originalNames.keys()];
    const walkable = constructionPowerDecks[name];
    if (walkable) expectWalkableDeck(meshes, walkable);
    if (name === 'power_slag_heap') expectWalkableSlagSlopes(meshes);
    if (name === 'power_cooling_tower_breach') expectCoolingTowerBreach(meshes);
    applyStyle(scene);
    for (const [node, names] of originalNames) {
      const used = Array.isArray(node.material)
        ? node.material
        : [node.material];
      expect(used.map((material) => material.name)).toEqual(names);
      for (const material of used)
        expect(Boolean(material.userData.bloom), material.name).toBe(
          glowColors[material.name] !== undefined,
        );
    }
  },
);
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
