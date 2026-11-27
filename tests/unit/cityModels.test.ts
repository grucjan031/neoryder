import lantern from '../../src/data/render/lanternString.json';
import modelBounds from '../../src/data/render/mapModelBounds.json';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  Box3,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  SRGBColorSpace,
  Triangle,
  Vector3,
} from 'three';
import type { Color, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { applyStyle } from '../../src/render/materials';
import { isCityModelFile } from '../../src/render/cityModels';
import { urbanKinds } from '../../src/render/urbanMaterials';
import {
  CITY_PROP_MODELS,
  CONSTRUCTION_POWER_PROP_MODELS,
  OVERPASS_ROOFS_DOCKS_PROP_MODELS,
  PORT_PROP_MODELS,
  PORT_RAIL_PROP_MODELS,
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
  city_lantern_string: [
    'wire',
    'lantern',
    'hanger',
    'housing',
    'bezel',
    'ceiling_clip',
  ],
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
    if (name === 'city_lantern_string') {
      expect(lanterns).toHaveLength(lantern.mounts.length);
      lanterns
        .sort((a, b) => a.position.x - b.position.x)
        .forEach((lens, i) => {
          const bounds = new Box3().setFromObject(lens, true);
          expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(
            lantern.mounts[i]!.x,
          );
          expect(bounds.min.y).toBeCloseTo(
            lantern.mounts[i]!.y - lantern.diffuserDropM,
          );
          expect(
            (lens.material as MeshStandardMaterial).emissiveIntensity,
          ).toBeGreaterThan(0);
        });
    }
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

// --------------------------------------------------------------------------- zestaw „port i zajezdnia”

/** Płaska powierzchnia chodzenia: wysokość i prostokąt XZ sprawdzany promieniami z góry. */
interface Walk {
  y: number;
  x: readonly [number, number];
  z: readonly [number, number];
}
interface SetSpec {
  /** AABB X × Y × Z [m], ±5 mm. */
  size: readonly [number, number, number];
  budget: number;
  landmarks: string[];
  /** Środek AABB w x = z = 0 (inaczej punkt odniesienia opisuje docs/assets.md). */
  centered: boolean;
  walk?: readonly Walk[];
  /** Odcinek, który ma przejść przez model bez trafienia (przejście, prześwit). */
  clear?: readonly {
    from: [number, number, number];
    to: [number, number, number];
  }[];
}
const d = (y: number, x: [number, number], z: [number, number]): Walk => ({
  y,
  x,
  z,
});
const setSpecs: Record<string, SetSpec> = {
  port_ship_bow: {
    size: [28, 23.2, 32],
    budget: 3500,
    landmarks: ['hull', 'deck', 'railing', 'stairs', 'amber_light'],
    centered: true,
    walk: [d(12, [-13.9, -11.1], [-13.4, 13.4]), d(13, [-7, 2.5], [-9.5, 9.5])],
  },
  port_ship_mid: {
    size: [30, 13.76, 32],
    budget: 3500,
    landmarks: ['hull', 'deck', 'railing', 'deck_light'],
    centered: true,
    walk: [
      d(12.8, [-13.9, -0.9], [-12.9, 12.9]),
      d(12.8, [0.9, 13.9], [-12.9, 12.9]),
      d(12, [-14.9, 14.9], [13.15, 15.4]),
      d(12, [-14.9, 14.9], [-15.4, -13.15]),
      d(12, [-0.7, 0.7], [-12.9, 12.9]),
      d(12, [14.05, 14.95], [-12.9, 12.9]),
    ],
    // Luka w relingu na trap (x −1,2…1,2) po obu burtach.
    clear: [
      { from: [0, 12.6, 17], to: [0, 12.6, 14] },
      { from: [0, 12.6, -17], to: [0, 12.6, -14] },
    ],
  },
  port_ship_mid_hold: {
    size: [30, 13.76, 32],
    budget: 3500,
    landmarks: ['hull', 'deck', 'hold_lining', 'stairs', 'railing'],
    centered: true,
    walk: [
      d(3, [-13.3, 13.3], [-10.9, 12.1]),
      d(12, [-14.9, 14.9], [13.15, 15.4]),
      d(12, [-14.9, 14.9], [-15.4, -13.15]),
      d(12, [14.05, 14.95], [-12.5, 12.5]),
      d(12, [5.45, 6.75], [-15.4, -11.25]),
    ],
  },
  port_ship_stern: {
    size: [30, 34.252, 32],
    budget: 4000,
    landmarks: [
      'hull',
      'railing',
      'stairs',
      'bridge_windows',
      'lifeboat',
      'deck_light',
    ],
    centered: true,
    walk: [
      d(12.8, [4.5, 13.9], [-12.9, 12.9]),
      d(12, [-5.4, 3.1], [-15.4, -10.3]),
      d(12, [-5.4, 3.1], [11.5, 15.4]),
      ...[15, 18, 21].flatMap((y) => [
        d(y, [2.1, 3.05], [-10, 10]),
        d(y, [-5.4, 1.9], [9.1, 10.05]),
        d(y, [-5.4, 1.9], [-10.05, -9.1]),
      ]),
      d(24, [-0.4, 2.3], [-14.5, -10.1]),
      d(24, [-0.4, 2.3], [10.1, 14.5]),
      d(27, [-2.5, 2.3], [-9.8, 9.8]),
    ],
  },
  port_sts_crane: {
    size: [96, 59.35, 24.8],
    budget: 4000,
    landmarks: [
      'frame',
      'machinery_house',
      'cabin',
      'spreader',
      'floodlight',
      'warning_light',
    ],
    centered: false,
  },
  port_gangway: {
    size: [28, 13.15, 2.3],
    budget: 1500,
    landmarks: ['frame', 'railing', 'landing_lamp'],
    centered: true,
    walk: [d(12, [12.05, 13.8], [-0.9, 0.9])],
  },
  port_freight_boxcar: {
    size: [14, 4.2, 3],
    budget: 1500,
    landmarks: ['body', 'underframe', 'roof', 'ladder'],
    centered: true,
    walk: [d(4.2, [-6.5, 6.5], [-1.4, 1.4])],
  },
  port_freight_boxcar_open: {
    size: [14, 4.2, 3],
    budget: 1500,
    landmarks: ['body', 'underframe', 'roof', 'floor', 'ceiling_lamp'],
    centered: true,
    walk: [
      d(4.2, [-6.5, 6.5], [-1.4, 1.4]),
      d(1.2, [-6.3, 4.2], [-1.25, 1.25]),
    ],
    clear: [{ from: [0, 2.2, 3], to: [0, 2.2, -3] }],
  },
  port_flatcar: {
    size: [14, 3.791, 3],
    budget: 2000,
    landmarks: ['deck', 'underframe', 'container_navy', 'container_ochre'],
    centered: true,
    walk: [
      d(3.791, [-5.9, -0.35], [-1.15, 1.15]),
      d(3.791, [0.35, 5.9], [-1.15, 1.15]),
    ],
  },
  port_warehouse_shell_panel: {
    size: [6, 10, 0.73],
    budget: 800,
    landmarks: ['cladding', 'window', 'column', 'plinth', 'wall_light'],
    centered: false,
  },
  port_warehouse_roof_truss: {
    size: [30, 3.3, 6],
    budget: 1500,
    landmarks: ['truss', 'purlin', 'lamp_lens'],
    centered: true,
  },
  rail_track_straight: {
    size: [12, 1, 4.6],
    budget: 800,
    landmarks: ['ballast', 'sleeper', 'guide_strip'],
    centered: true,
    walk: [d(1, [-5.9, 5.9], [-0.75, 0.75])],
  },
  rail_track_buffer: {
    size: [4, 3, 4.6],
    budget: 800,
    landmarks: ['ballast', 'frame', 'buffer', 'warning_lamp'],
    centered: true,
  },
  rail_maglev_car: {
    size: [25, 4.1, 4],
    budget: 1500,
    landmarks: ['body', 'windows', 'led_stripe', 'skids', 'door_light'],
    centered: true,
    walk: [d(4.1, [-12, 12], [-1.5, 1.5])],
  },
  rail_maglev_car_open: {
    size: [25, 4.1, 4],
    budget: 1500,
    landmarks: ['body', 'windows', 'seats', 'lights', 'skids'],
    centered: true,
    walk: [d(4.1, [-12, 12], [-1.5, 1.5]), d(1.1, [-11.9, 11.9], [-1.3, 1.3])],
    clear: [
      { from: [6.25, 2.2, 3], to: [6.25, 2.2, -3] },
      { from: [-6.25, 2.2, 3], to: [-6.25, 2.2, -3] },
    ],
  },
  rail_maglev_head: {
    size: [27, 4.1, 4],
    budget: 1500,
    landmarks: ['body', 'windows', 'led_stripe', 'lights', 'skids'],
    centered: true,
    walk: [d(4.1, [-13, 5.3], [-1.5, 1.5])],
  },
  rail_catenary_mast: {
    size: [0.7, 8, 3.954],
    budget: 400,
    landmarks: ['mast', 'foundation', 'lamp_lens'],
    centered: false,
  },
  rail_signal_gantry: {
    size: [1.4, 7, 23.2],
    budget: 1500,
    landmarks: [
      'truss',
      'signal_head',
      'lamp_green',
      'lamp_amber',
      'lamp_white',
    ],
    centered: true,
    // Prześwit nad czterema torami (z = ±2,5 i ±7,5, pas ±1,6 m) do wysokości 4,9 m.
    clear: [-7.5, -2.5, 2.5, 7.5].flatMap((z) =>
      [-1.6, 1.6].map((dz) => ({
        from: [-3, 4.9, z + dz] as [number, number, number],
        to: [3, 4.9, z + dz] as [number, number, number],
      })),
    ),
  },
  rail_control_tower: {
    size: [10.6, 14, 8.4],
    budget: 2500,
    landmarks: ['shaft', 'cab_glass', 'gallery', 'railing', 'beacon'],
    centered: false,
    walk: [
      d(10, [-4, 4], [3.05, 4.05]),
      d(10, [-4, 4], [-4.05, -3.05]),
      d(10, [3.05, 4.05], [-2.9, 2.9]),
      d(10, [-4.1, -3.05], [-2.9, 2.9]),
      d(10, [-6.3, -4.25], [1.4, 2.35]),
    ],
  },
  rail_platform_canopy: {
    size: [12, 3.99, 6.16],
    budget: 1000,
    landmarks: ['column', 'roof', 'bench', 'board_screen', 'led_line'],
    centered: true,
  },
  rail_turntable: {
    size: [24, 4.32, 24],
    budget: 2000,
    landmarks: ['rim', 'bridge', 'guide_beam', 'cabin', 'amber_light'],
    centered: true,
    walk: [
      d(1.5, [-11.3, 11.3], [11.4, 11.9]),
      d(1.5, [-10.6, 10.6], [0.9, 2]),
      d(1.5, [-10.6, 10.6], [-2, -0.9]),
      d(2.5, [-10.7, 10.7], [-0.75, 0.75]),
      d(0, [-7, -3], [3, 7]),
    ],
  },
  rail_snow_drift: {
    size: [3, 0.45, 2.694],
    budget: 300,
    landmarks: ['snow'],
    centered: true,
  },
  rail_snow_drift_long: {
    size: [8, 0.35, 1.796],
    budget: 300,
    landmarks: ['snow'],
    centered: true,
  },
  rail_snow_drift_patch: {
    size: [2.6, 0.18, 1.944],
    budget: 300,
    landmarks: ['snow'],
    centered: true,
  },
};
const setNames = Object.keys(setSpecs);
/** Materiały rozpoznawane przez rejestr gry (src/render/materials.ts). */
const known = new Set([
  ...urbanKinds.map((kind) => `mat_${kind}`),
  ...Object.keys(glowColors),
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

async function loadSet(name: string): Promise<Object3D> {
  const file = readFileSync(join(folder, `${name}.glb`));
  const gltf = await new GLTFLoader().parseAsync(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

describe('przychodnia Helixy w run5', () => {
  const budgets = {
    bw_door_portal: 6000,
    bw_curtain_wall_frame: 6000,
    bw_glass_balustrade: 6000,
    bw_ceiling_panel: 6000,
    bw_operating_table: 6000,
    bw_surgical_robot: 12000,
    bw_resonance_scanner: 12000,
    bw_regen_pod: 6000,
    bw_regen_pod_open: 6000,
    bw_calibration_chair: 6000,
    bw_kamerton_cradle: 12000,
    bw_pharmacy_dispenser: 6000,
    bw_implant_showcase: 6000,
    bw_lab_analyzer_bench: 6000,
    bw_med_cart: 6000,
    bw_info_totem: 6000,
    bw_planter_bio: 6000,
    bw_helix_sculpture: 12000,
  };

  it.each(Object.entries(budgets))(
    '%s zachowuje budżet geometrii i paletę kliniki',
    async (id, budget) => {
      const scene = await loadSet(id);
      let triangles = 0;
      scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const geometry = node.geometry;
        triangles +=
          (geometry.index?.count ?? geometry.getAttribute('position').count) /
          3;
        for (const mat of [node.material].flat()) {
          expect(reserved(mat.color)).toBe(false);
          if (mat.emissive.getHex() === 0) continue;
          expect(mat.name).toMatch(
            /^mat_(light_panel|neon_(green|blue|violet|amber))$/,
          );
          expect(reserved(mat.emissive)).toBe(false);
        }
      });
      expect(triangles).toBeGreaterThan(0);
      expect(triangles).toBeLessThanOrEqual(budget);
    },
  );
});

describe('magazyn Kurogane', () => {
  const sizes = {
    wh_pallet_rack: [4, 6, 1.2],
    wh_forklift: [2.8, 2.1, 1.2],
    wh_overhead_crane: [16, 2.4, 3.2],
    wh_server_rack: [1.2, 2.4, 1],
    wh_workbench_weapons: [2.4, 1.5, 0.9],
    wh_weapon_case_stack: [1.6, 1.1, 1.2],
    wh_conveyor_scanner: [3.6, 2.2, 1.4],
    wh_ceiling_lamp: [1.8, 0.45, 0.6],
    wh_hall_column: [1.4, 10, 0.83],
    wh_crane_rail: [0.44, 0.64, 6],
    wh_wall_terminal: [1.42, 0.93, 0.2105],
    wh_catwalk: [4, 1.2, 1.5],
  } as const;

  it.each(Object.entries(sizes))(
    '%s zachowuje obrys, montaż i budżet',
    async (id, size) => {
      const scene = await loadSet(id);
      const box = new Box3().setFromObject(scene, true);
      box
        .getSize(new Vector3())
        .toArray()
        .forEach((v, i) => expect(v).toBeCloseTo(size[i]!, 4));
      expect(box.min.y).toBeCloseTo(0, 4);
      expect(box.min.x).toBeCloseTo(-size[0] / 2, 4);
      expect(box.min.z).toBeCloseTo(
        id === 'wh_wall_terminal' ? 0 : -size[2] / 2,
        4,
      );
      let triangles = 0;
      scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const geometry = node.geometry;
        triangles +=
          (geometry.index?.count ?? geometry.getAttribute('position').count) /
          3;
        for (const mat of [node.material].flat()) {
          expect(mat.name).toMatch(/^mat_/);
          expect(reserved(mat.color)).toBe(false);
          if (mat.emissive.getHex() !== 0) {
            expect(mat.name).toMatch(/^mat_(neon_|light_white)/);
            expect(reserved(mat.emissive)).toBe(false);
          }
        }
      });
      const budget = ['wh_pallet_rack', 'wh_overhead_crane'].includes(id)
        ? 3000
        : 1500;
      expect(triangles).toBeGreaterThan(0);
      expect(triangles).toBeLessThanOrEqual(budget);
    },
  );

  it('dwa zęby wideł wystają przed kabinę w kierunku +X', async () => {
    const scene = await loadSet('wh_forklift');
    const cast = (z: number) =>
      new Raycaster(new Vector3(1.2, 2.1, z), new Vector3(0, -1, 0))
        .intersectObject(scene, true)[0];
    for (const z of [-0.3, 0.3]) {
      const tip = cast(z);
      expect(tip).toBeDefined();
      expect(tip!.point.y).toBeGreaterThan(0.1);
      expect(tip!.point.y).toBeLessThan(0.2);
    }
    expect(cast(0)).toBeUndefined();
  });

  it('wierzch kraty wypada 20 cm nad spodem modułu', async () => {
    const scene = await loadSet('wh_catwalk');
    const deck = scene.getObjectByName('deck');
    expect(deck).toBeInstanceOf(Mesh);
    expect(new Box3().setFromObject(deck!, true).max.y).toBeCloseTo(0.2, 5);
  });
});

describe('tajne laboratorium Kurogane Arms', () => {
  const specs = {
    lab_cocoon_tall: [2.2, 4.4, 2.2, 12000],
    lab_cocoon_tall_cryo: [2.2, 4.4, 2.2, 12000],
    lab_cocoon_breached: [2.4, 4.4, 2.4, 3000],
    lab_cocoon_incubator: [1.1, 2.1, 1.1, 7000],
    lab_ceiling_manifold: [6, 5.2, 5.5, 1120],
    lab_freight_elevator: [4.8, 11.6, 4, 1460],
    lab_bio_scanner_gate: [3.2, 2.6, 1.4, 780],
    lab_blast_door_frame: [4.8, 3.8, 0.6, 580],
    lab_observation_window: [8, 2.6, 0.45, 440],
    lab_security_desk: [3.4, 1.25, 1.4, 680],
    lab_catwalk_rail: [4, 1.1, 0.14, 260],
    lab_ceiling_strip: [2.4, 0.35, 0.6, 220],
    lab_locker_bank: [2.4, 2.1, 0.65, 640],
    lab_locker_bench: [2.2, 0.5, 0.8, 240],
    lab_decon_shower: [1.8, 2.4, 1.6, 620],
    lab_hazmat_suit_rack: [2.2, 2.1, 0.75, 4500],
    lab_corkboard_evidence: [2.8, 1.6, 0.18, 580],
    lab_classified_cabinet: [1.6, 2.2, 0.85, 560],
    lab_briefing_holotable: [3.2, 1.1, 2, 720],
    lab_chem_fume_hood: [2.4, 2.4, 1.1, 860],
    lab_centrifuge_bench: [3.2, 1.45, 1.1, 940],
    lab_prototype_weapon_rack: [2.4, 2.2, 0.8, 880],
    lab_anomaly_containment_pod: [2.8, 3.2, 2.8, 1160],
    lab_cryo_server_rack: [1.4, 2.4, 1, 820],
    lab_mainframe_console: [3, 1.35, 1.4, 840],
  } as const;
  const ids = Object.keys(specs) as (keyof typeof specs)[];

  const required: Partial<Record<keyof typeof specs, string[]>> = {
    lab_cocoon_tall: [
      'glass_clear',
      'snow',
      'cable',
      'screen_status',
      'light_panel',
      'neon_green',
    ],
    lab_cocoon_tall_cryo: [
      'glass_clear',
      'snow',
      'cable',
      'light_panel',
      'neon_blue',
      'neon_violet',
    ],
    lab_cocoon_breached: [
      'glass_clear',
      'cable',
      'neon_amber',
      'label_warning',
    ],
    lab_ceiling_strip: ['light_panel'],
    lab_corkboard_evidence: ['wood', 'screen_map', 'neon_green', 'neon_amber'],
    lab_mainframe_console: ['screen_lab_biomonitor', 'label_lab_mug'],
  };
  it.each(ids)('%s odpowiada tabeli §4.1 i ma podgląd', async (id) => {
    expect(isCityModelFile(id)).toBe(true);
    const [width, height, depth, budget] = specs[id];
    const scene = await loadSet(id);
    expect(scene.getObjectByName(id)).toBeDefined();
    const box = new Box3().setFromObject(scene, true);
    const back = id === 'lab_corkboard_evidence' ? 0 : -depth / 2;
    const expected = [-width / 2, 0, back, width / 2, height, back + depth];
    const bounds = [...box.min.toArray(), ...box.max.toArray()];
    const registered = [...modelBounds[id].min, ...modelBounds[id].max];
    bounds.forEach((value, i) => {
      expect(value).toBeCloseTo(expected[i]!, 3);
      expect(value).toBeCloseTo(registered[i]!, 3);
    });

    expect(
      existsSync(join(__dirname, '../../artifacts/models/lab', id + '.png')),
    ).toBe(true);
    let triangles = 0;
    const materials = new Set<string>();
    scene.traverse((mesh) => {
      if (!(mesh instanceof Mesh)) return;
      triangles +=
        (mesh.geometry.index?.count ??
          mesh.geometry.getAttribute('position').count) / 3;
      for (const mat of [mesh.material].flat()) {
        expect(materials.has(mat.name)).toBe(false);
        materials.add(mat.name);
        expect(mat.map).toBeNull();
        expect(reserved(mat.color)).toBe(false);
        expect(reserved(mat.emissive)).toBe(false);
        if (mat.emissive.getHex() !== 0)
          expect(mat.name).toMatch(
            /^mat_(neon_(green|blue|violet|amber)|light_panel)$/,
          );
        if (mat.name === 'mat_glass_clear') {
          expect(mat.transparent).toBe(true);
          expect(mat.opacity).toBeCloseTo(0.22);
        }
        if (
          !/^mat_(neon_(green|blue|violet|amber)$|label_|screen_)/.test(
            mat.name,
          )
        )
          expect(urbanKinds).toContain(mat.name.slice(4));
      }
    });
    for (const kind of required[id] ?? [])
      expect(materials.has(`mat_${kind}`)).toBe(true);
    expect([...materials].sort()).toEqual(modelBounds[id].materials);
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThanOrEqual(budget);
  });
});

describe('galeria handlowa Atrium Nova', () => {
  // X × Y × Z w metrach oraz maksymalna liczba trójkątów całego GLB.
  const specs = {
    mall_shutter_grille: [4, 3.6, 0.18, 620],
    mall_storefront: [6, 4.6, 0.5, 680],
    mall_escalator: [2.4, 6.25, 11.6, 1480],
    mall_glass_rail: [4, 1.1, 0.14, 280],
    mall_elevator: [3.6, 15.8, 3.6, 1450],
    mall_skylight: [24, 1.6, 6, 760],
    mall_kiosk: [3.6, 2.4, 2.6, 980],
    mall_planter: [3.2, 1.35, 1.4, 740],
    mall_bench: [2.6, 0.85, 0.9, 340],
    mall_fountain: [6.4, 3.8, 6.4, 1380],
    mall_directory: [1.2, 2.4, 0.45, 380],
    mall_ceiling_panel: [2.4, 0.45, 1.2, 260],
    mall_security_fixture: [0.9, 1.3, 0.35, 420],
    mall_mannequin: [1.8, 2.15, 0.9, 780],
    mall_shoe_wall: [3.4, 2.6, 0.55, 820],
    mall_electronics_shelf: [3.4, 2.5, 0.85, 860],
    mall_cafe_set: [3.2, 1.75, 2.2, 940],
    mall_pharmacy_counter: [3.4, 2.5, 1.1, 760],
    mall_kurogane_display: [3.4, 2.5, 0.95, 840],
    mall_clothes_rack: [2.12, 1.819, 0.78, 800],
    mall_clothes_rack_amber: [2.12, 1.819, 0.78, 800],
    mall_checkout_counter: [2.6, 1.475, 0.95, 800],
    mall_security_gates: [1.64, 1.5267, 0.61, 800],
    mall_display_table: [2.12, 0.907, 1.04, 800],
    mall_promo_stand: [0.8, 1.354, 0.8, 800],
    mall_trash_bin: [1.36, 0.94, 0.606, 800],
    mall_entrance_doors: [4.8, 3, 0.32, 800],
  } as const;
  const wallBack = new Set([
    'mall_storefront',
    'mall_security_fixture',
    'mall_shoe_wall',
  ]);
  const ids = Object.keys(specs) as (keyof typeof specs)[];

  it.each(ids)(
    '%s ma właściwe AABB, punkt montażu, budżet i materiały',
    async (id) => {
      const [width, height, depth, budget] = specs[id];
      const scene = await loadSet(id);
      expect(scene.getObjectByName(id)).toBeDefined();
      const box = new Box3().setFromObject(scene, true);
      const back = wallBack.has(id) ? 0 : -depth / 2;
      const measured = [...box.min.toArray(), ...box.max.toArray()];
      const expected = [-width / 2, 0, back, width / 2, height, back + depth];
      const registered = [...modelBounds[id].min, ...modelBounds[id].max];
      measured.forEach((v, i) => {
        expect(v).toBeCloseTo(expected[i]!, 3);
        expect(v).toBeCloseTo(registered[i]!, 3);
      });
      expect(
        existsSync(join(__dirname, '../../artifacts/models/mall', id + '.png')),
      ).toBe(true);
      let triangles = 0;
      const materials = new Set<string>();
      scene.traverse((mesh) => {
        if (!(mesh instanceof Mesh)) return;
        triangles +=
          (mesh.geometry.index?.count ??
            mesh.geometry.getAttribute('position').count) / 3;
        for (const mat of [mesh.material].flat()) {
          materials.add(mat.name);
          expect(reserved(mat.color)).toBe(false);
          if (mat.name === 'mat_glass_clear') {
            expect(mat.transparent).toBe(true);
            expect(mat.opacity).toBeCloseTo(0.22);
          }
          if (mat.emissive.getHex() !== 0) {
            expect(mat.name).toMatch(/^mat_(neon_|light_white|light_panel)/);
            expect(reserved(mat.emissive)).toBe(false);
          }
          if (
            !/^mat_(neon_|light_white|light_panel|label_|screen_)/.test(
              mat.name,
            )
          )
            expect(urbanKinds).toContain(mat.name.slice(4));
        }
      });
      expect([...materials].sort()).toEqual(modelBounds[id].materials);
      expect(triangles).toBeGreaterThan(0);
      expect(triangles).toBeLessThanOrEqual(budget);
    },
  );

  it('otwór portalu przepuszcza widok, a prześwit pola roboczego kraty przekracza 80%', async () => {
    const [portal, grille] = await Promise.all([
      loadSet('mall_storefront'),
      loadSet('mall_shutter_grille'),
    ]);
    const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
    let open = 0;
    const cols = 67,
      rows = 71;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ray.ray.origin.set(
          -1.9 + (3.8 * (i + 0.5)) / cols,
          0.18 + (3.12 * (j + 0.5)) / rows,
          8,
        );
        if (ray.intersectObject(portal, true).length)
          throw new Error('Zasłonięty otwór witryny');
        if (!ray.intersectObject(grille, true).length) open++;
      }
    }
    expect(open / (cols * rows)).toBeGreaterThan(0.8);
    expect(open / (cols * rows)).toBeLessThan(0.95);
  });

  it('26 stopnic prowadzi z dolnego spocznika +Z na górny −Z', async () => {
    const scene = await loadSet('mall_escalator');
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
    for (let step = 0; step < 26; step++) {
      ray.ray.origin.set(0, 7, 5 - step * 0.4);
      expect(ray.intersectObject(scene, true)[0]?.point.y).toBeCloseTo(
        (step + 1) * 0.2,
        3,
      );
    }
  });
});

describe('zestaw „port i zajezdnia”', () => {
  it('folder i galeria zawierają komplet 24 modeli zestawu', () => {
    expect([...PORT_RAIL_PROP_MODELS].sort()).toEqual([...setNames].sort());
    const oldPort: readonly string[] = PORT_PROP_MODELS;
    const files = readdirSync(folder).filter(
      (file) =>
        file.startsWith('rail_') ||
        (file.startsWith('port_') &&
          !oldPort.includes(file.replace('.glb', ''))),
    );
    expect(files.sort()).toEqual(setNames.map((n) => `${n}.glb`).sort());
  });

  it.each(setNames)(
    '%s: materiały, emisja, budżet, AABB i powierzchnie chodzenia',
    async (name) => {
      const spec = setSpecs[name]!;
      const scene = await loadSet(name);
      let triangles = 0;
      scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        triangles +=
          (node.geometry.index?.count ??
            node.geometry.getAttribute('position').count) / 3;
        const used = Array.isArray(node.material)
          ? node.material
          : [node.material];
        for (const mat of used) {
          expect(mat).toBeInstanceOf(MeshStandardMaterial);
          if (!(mat instanceof MeshStandardMaterial)) continue;
          expect(known.has(mat.name), mat.name).toBe(true);
          expect(mat.map).toBeNull();
          expect(reserved(mat.color), `${mat.name} kolor`).toBe(false);
          const glow = glowColors[mat.name];
          if (glow === undefined)
            expect(mat.emissive.getHex(), mat.name).toBe(0);
          else {
            expect(mat.emissive.getHex(), mat.name).toBe(glow);
            expect(reserved(mat.emissive), `${mat.name} emisja`).toBe(false);
          }
        }
      });
      expect(triangles).toBeGreaterThan(0);
      expect(triangles).toBeLessThanOrEqual(spec.budget);
      expect(scene.getObjectByName(name)).toBeDefined();
      for (const landmark of spec.landmarks)
        expect(scene.getObjectByName(landmark), landmark).toBeDefined();
      expect(
        existsSync(
          join(__dirname, `../../tools/blender/previews/city/${name}.png`),
        ),
      ).toBe(true);

      const box = new Box3().setFromObject(scene, true);
      const size = box.getSize(new Vector3()).toArray();
      expect(box.min.y).toBeCloseTo(0, 3);
      spec.size.forEach((expected, axis) =>
        expect(size[axis], `oś ${axis}`).toBeCloseTo(expected, 2),
      );
      if (spec.centered) {
        expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 2);
        expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 2);
      }
      if (name.startsWith('rail_snow_drift'))
        expect(size[1]).toBeLessThanOrEqual(0.6);

      const ray = new Raycaster();
      for (const { y, x, z } of spec.walk ?? []) {
        // Promień z 1,9 m nad powierzchnią (wzrost gracza): wyżej mogą być stropy galerii.
        for (let i = 0; i <= 6; i++)
          for (let j = 0; j <= 4; j++) {
            const px = x[0] + ((x[1] - x[0]) * i) / 6;
            const pz = z[0] + ((z[1] - z[0]) * j) / 4;
            ray.set(new Vector3(px, y + 1.9, pz), new Vector3(0, -1, 0));
            ray.far = 10;
            const hit = ray.intersectObject(scene, true)[0];
            const at = `${name} y=${y} (${px.toFixed(2)}, ${pz.toFixed(2)})`;
            expect(hit, at).toBeDefined();
            expect(hit!.point.y, at).toBeCloseTo(y, 3);
          }
      }
      for (const { from, to } of spec.clear ?? []) {
        const a = new Vector3(...from);
        const dir = new Vector3(...to).sub(a);
        ray.set(a, dir.clone().normalize());
        ray.far = dir.length();
        const hit = ray.intersectObject(scene, true)[0];
        expect(
          hit,
          `${name}: przeszkoda ${from.join()} → ${to.join()}`,
        ).toBeUndefined();
      }
    },
  );

  it('trap: płaska rampa 26 m biegu i 12 m wzniosu (24,78°) do podestu', async () => {
    const scene = await loadSet('port_gangway');
    const ray = new Raycaster();
    for (let i = 0; i <= 10; i++) {
      const x = -13.4 + (24.8 * i) / 10;
      for (const z of [-0.9, 0, 0.9]) {
        const expected = ((x + 14) * 12) / 26;
        ray.set(new Vector3(x, expected + 1.5, z), new Vector3(0, -1, 0));
        const hit = ray.intersectObject(scene, true)[0];
        expect(hit, `x=${x}`).toBeDefined();
        expect(hit!.point.y).toBeCloseTo(expected, 3);
      }
    }
  });

  it('suwnica STS: wolny przejazd 27,6 × 15,6 m między stopami nóg do 17 m', async () => {
    const scene = await loadSet('port_sts_crane');
    const ray = new Raycaster();
    for (let i = 0; i <= 8; i++)
      for (let j = 0; j <= 4; j++) {
        const x = -13.8 + (27.6 * i) / 8;
        const z = -7.8 + (15.6 * j) / 4;
        ray.set(new Vector3(x, 16.9, z), new Vector3(0, -1, 0));
        expect(ray.intersectObject(scene, true)[0]).toBeUndefined();
      }
  });
});

describe('zestaw „estakada, dachy, doki”', () => {
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
          if (glow === undefined)
            expect(mat.emissive.getHex(), mat.name).toBe(0);
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
});
