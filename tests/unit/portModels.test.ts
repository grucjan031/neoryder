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
import { PORT_RAIL_PROP_MODELS } from '../../src/scenes/cityPropsTest';

const folder = join(__dirname, '../../public/assets/models/city');
const textures = join(__dirname, '../../public/assets/textures');
const paints = ['navy', 'olive', 'ochre', 'graphite'] as const;
const lengths = { 20: 6.058, 40: 12.192 } as const;

interface Spec {
  /** Wymiary AABB X × Y × Z [m] (±1 mm) albo zakresy [min, max]. */
  size: readonly (number | readonly [number, number])[];
  budget: number;
  landmarks: string[];
  /** Płaski wierzch do chodzenia: wysokość i obszar XZ (półwymiary) sprawdzany promieniami z góry. */
  walk?: { y: number; halfX: number; halfZ: number };
  /** Środek AABB w x = z = 0 (inaczej punkt odniesienia sprawdza osobny test). */
  centered: boolean;
}

const specs: Record<string, Spec> = {};
for (const [size, length] of Object.entries(lengths))
  for (const paint of paints)
    specs[`port_container_${size}_${paint}`] = {
      size: [length, 2.591, 2.438],
      budget: 1500,
      landmarks: ['shell', 'hardware', 'stencil'],
      walk: { y: 2.591, halfX: length / 2 - 0.25, halfZ: 0.97 },
      centered: true,
    };
Object.assign(specs, {
  port_gantry_crane: {
    size: [26.22, [17.5, 18.5], [8.5, 9.2]],
    budget: 3000,
    landmarks: ['frame', 'trolley', 'spreader', 'cabin', 'girder_light'],
    centered: true,
  },
  port_light_tower: {
    size: [
      [2.8, 4],
      [19.5, 20.5],
      [2.8, 4],
    ],
    budget: 1500,
    landmarks: ['mast', 'headframe', 'flood_lens', 'beacon'],
    centered: true,
  },
  port_bollard: {
    size: [0.62, 0.6, 0.62],
    budget: 400,
    landmarks: ['bollard', 'head_cap'],
    centered: true,
  },
  port_bollard_rope: {
    size: [
      [1, 1.2],
      [0.59, 0.61],
      [2, 2.2],
    ],
    budget: 800,
    landmarks: ['bollard', 'rope'],
    centered: false,
  },
  port_reach_stacker: {
    size: [6.06, [5, 6.5], [10.5, 11.5]],
    budget: 2000,
    landmarks: ['body', 'spreader', 'cab', 'wheel', 'amber_light'],
    centered: true,
  },
  port_quay_edge: {
    size: [4, 2, 1.6],
    budget: 800,
    landmarks: ['coping', 'hazard_edge', 'fender'],
    walk: { y: 2, halfX: 1.9, halfZ: 0.7 },
    centered: true,
  },
  port_lashing_platform: {
    size: [6, [1.15, 1.3], [1.3, 1.45]],
    budget: 1500,
    landmarks: ['deck', 'railing', 'toe_board'],
    walk: { y: 0.1, halfX: 2.9, halfZ: 0.55 },
    centered: true,
  },
} satisfies Record<string, Spec>);
const names = Object.keys(specs);

/** Materiały miasta rozpoznawane przez grę i nowe materiały portu (podpinane później, docs/assets.md). */
const materials = new Set([
  'mat_concrete',
  'mat_metal',
  'mat_trim',
  'mat_glass',
  'mat_cable',
  'mat_paint',
  'mat_lacquer',
  'mat_rubber',
  'mat_machine',
  'mat_hivis',
  'mat_hazard',
  'mat_neon_amber',
  'mat_neon_green',
  'mat_light_white',
  ...paints.map((paint) => `mat_container_${paint}`),
  'mat_crane_paint',
  'mat_quay_concrete',
  'mat_rubber_fender',
  'mat_steel_grating',
]);
const glowColors: Record<string, number> = {
  mat_neon_amber: 0xffae1a,
  mat_neon_green: 0x6dff4a,
  mat_light_white: 0xfff1d6,
};
const printName = /^mat_label_([a-z0-9_]+)$/;

async function load(name: string): Promise<Object3D> {
  const file = readFileSync(join(folder, `${name}.glb`));
  const gltf = await new GLTFLoader().parseAsync(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

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

it('folder miasta zawiera komplet modeli portu', () => {
  // Zestaw „port i zajezdnia” (statek, suwnica STS, wagony, hala) sprawdza cityModels.test.ts.
  const set: readonly string[] = PORT_RAIL_PROP_MODELS;
  const port = readdirSync(folder).filter(
    (file) =>
      file.startsWith('port_') && !set.includes(file.replace('.glb', '')),
  );
  expect(port.sort()).toEqual(names.map((n) => `${n}.glb`).sort());
});

it.each(names)(
  '%s: materiały, budżet, wymiary i punkt odniesienia',
  async (name) => {
    const spec = specs[name]!;
    const scene = await load(name);
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
        const print = printName.exec(mat.name);
        if (print) {
          expect(
            existsSync(join(textures, 'labels', `label_${print[1]}.webp`)),
            mat.name,
          ).toBe(true);
          expect(node.geometry.getAttribute('uv'), mat.name).toBeDefined();
        } else expect(materials.has(mat.name), mat.name).toBe(true);
        expect(mat.map).toBeNull();
        expect(reserved(mat.color), `${mat.name} kolor`).toBe(false);
        const glow = glowColors[mat.name];
        if (glow === undefined) expect(mat.emissive.getHex(), mat.name).toBe(0);
        else {
          expect(mat.emissive.getHex()).toBe(glow);
          expect(mat.emissiveIntensity).toBeGreaterThan(0);
        }
      }
    });
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThanOrEqual(spec.budget);
    for (const landmark of spec.landmarks)
      expect(scene.getObjectByName(landmark), landmark).toBeDefined();

    const box = new Box3().setFromObject(scene, true);
    const size = box.getSize(new Vector3()).toArray();
    expect(box.min.y).toBeCloseTo(0, 4);
    spec.size.forEach((expected, axis) => {
      const actual = size[axis]!;
      if (typeof expected === 'number')
        expect(actual, `oś ${axis}`).toBeCloseTo(expected, 2);
      else {
        expect(actual, `oś ${axis}`).toBeGreaterThanOrEqual(expected[0]);
        expect(actual, `oś ${axis}`).toBeLessThanOrEqual(expected[1]);
      }
    });
    if (spec.centered) {
      expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 2);
      expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 2);
    }

    if (spec.walk) {
      // Kolizja areny to prostopadłościan: wierzch modelu musi być jedną płaską powierzchnią.
      const { y, halfX, halfZ } = spec.walk;
      const ray = new Raycaster();
      for (let i = 0; i <= 8; i++)
        for (let j = 0; j <= 4; j++) {
          const x = -halfX + (2 * halfX * i) / 8;
          const z = -halfZ + (2 * halfZ * j) / 4;
          ray.set(new Vector3(x, y + 5, z), new Vector3(0, -1, 0));
          const hit = ray.intersectObject(scene, true)[0];
          expect(hit, `${x.toFixed(2)}, ${z.toFixed(2)}`).toBeDefined();
          expect(hit!.point.y).toBeLessThanOrEqual(y + 1e-4);
          expect(hit!.point.y).toBeGreaterThanOrEqual(y - 0.01);
        }
    }
  },
);

it('suwnica stoi na kołach w x = ±12 m, pachołek z liną ma oś w początku układu', async () => {
  const crane = await load('port_gantry_crane');
  const wheels = new Box3().setFromObject(
    crane.getObjectByName('wheel')!,
    true,
  );
  expect(wheels.min.y).toBeCloseTo(0, 4);
  expect(wheels.max.x).toBeCloseTo(12.31, 1);
  expect(wheels.min.x).toBeCloseTo(-12.31, 1);
  const bollard = await load('port_bollard_rope');
  const body = new Box3().setFromObject(
    bollard.getObjectByName('bollard')!,
    true,
  );
  expect((body.min.x + body.max.x) / 2).toBeCloseTo(0, 3);
  expect((body.min.z + body.max.z) / 2).toBeCloseTo(0, 3);
});
