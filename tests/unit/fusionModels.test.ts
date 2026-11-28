import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  Box3,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { Color } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import registeredBounds from '../../src/data/render/mapModelBounds.json';

const root = join(__dirname, '../..');
const folder = join(root, 'public/assets/models/city');
const document = readFileSync(join(root, 'docs/maps/run8.md'), 'utf8');
// Kontrakt niezależny od generatora i manifestu eksportu.
const specs = [
  ...document.matchAll(
    /\| (\d+) \| `(fus_\w+)` \| `([\d.]+) × ([\d.]+) × ([\d.]+)`[^\n]+?≤ (\d+) \|/g,
  ),
].map((m) => ({
  model: m[2]!,
  size: m.slice(3, 6).map(Number),
  budget: Number(m[6]),
}));
const bounds: Record<
  string,
  { min: number[]; max: number[]; materials: string[] }
> = registeredBounds;

function reserved(color: Color): boolean {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl, SRGBColorSpace);
  const h = hsl.h * 360;
  return (
    hsl.s >= 0.35 &&
    hsl.l >= 0.08 &&
    (h < 15 || h >= 345 || (h >= 170 && h <= 200) || (h >= 285 && h <= 335))
  );
}

describe('Kurogane Fusion — katalog §6.1 run8', () => {
  it('zawiera dokładnie 30 modeli z tabel 1 i 2', () => {
    expect(specs).toHaveLength(30);
    expect(
      readdirSync(folder)
        .filter((f) => /^fus_.*\.glb$/.test(f))
        .sort(),
    ).toEqual(specs.map((s) => s.model + '.glb').sort());
    expect(
      Object.keys(bounds)
        .filter((id) => id.startsWith('fus_'))
        .sort(),
    ).toEqual(specs.map((s) => s.model).sort());
  });

  it.each(specs)(
    '$model: wymiary, budżet, UV, materiały, batching i podgląd',
    async ({ model, size, budget }) => {
      const file = readFileSync(join(folder, model + '.glb'));
      expect(file.readUInt32LE(0)).toBe(0x46546c67);
      expect(file.readUInt32LE(4)).toBe(2);
      expect(file.readUInt32LE(8)).toBe(file.length);
      const metadata = JSON.parse(
        file.subarray(20, 20 + file.readUInt32LE(12)).toString(),
      ) as {
        images?: unknown[];
        textures?: unknown[];
        cameras?: unknown[];
        animations?: unknown[];
        extensions?: { KHR_lights_punctual?: { lights?: unknown[] } };
      };
      for (const items of [
        metadata.images,
        metadata.textures,
        metadata.cameras,
        metadata.animations,
        metadata.extensions?.KHR_lights_punctual?.lights,
      ])
        expect(items ?? []).toHaveLength(0);
      const { scene } = await new GLTFLoader().parseAsync(
        file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        '',
      );
      expect(scene.getObjectByName(model)).toBeDefined();
      scene.updateMatrixWorld(true);
      const aabb = new Box3().setFromObject(scene, true);
      const [x, y, z] = size as [number, number, number];
      const expected = [-x / 2, 0, -z / 2, x / 2, y, z / 2];
      const registered = bounds[model]!;
      [...aabb.min.toArray(), ...aabb.max.toArray()].forEach((n, i) => {
        expect(n).toBeCloseTo(expected[i]!, 4);
        expect(n).toBeCloseTo([...registered.min, ...registered.max][i]!, 4);
      });
      let triangles = 0;
      const materials = new Set<string>();
      const meshes: Mesh[] = [];
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        meshes.push(object);
        const geometry = object.geometry;
        const positions = geometry.getAttribute('position');
        expect([...positions.array].every(Number.isFinite)).toBe(true);
        triangles += (geometry.index?.count ?? positions.count) / 3;
        for (const material of [object.material].flat()) {
          expect(material).toBeInstanceOf(MeshStandardMaterial);
          const mat = material as MeshStandardMaterial;
          expect(materials.has(mat.name), 'jedna siatka na materiał').toBe(
            false,
          );
          materials.add(mat.name);
          expect(mat.map).toBeNull();
          expect(reserved(mat.color), mat.name).toBe(false);
          expect(reserved(mat.emissive), mat.name).toBe(false);
          if (mat.emissive.getHex() !== 0) {
            expect(mat.name).toMatch(
              /^mat_(neon_(amber|green|blue|violet)|light_panel)$/,
            );
          }
          if (mat.name === 'mat_glass_clear') {
            expect(mat.opacity).toBeCloseTo(0.22, 5);
            expect(mat.transparent).toBe(true);
            expect(mat.side).toBe(DoubleSide);
          }
          if (/^mat_(screen|label)_/.test(mat.name)) {
            const uv = geometry.getAttribute('uv');
            expect(uv).toBeDefined();
            expect(
              [...uv.array].every(
                (v) => Number.isFinite(v) && v >= 0 && v <= 1,
              ),
            ).toBe(true);
            expect(new Set(uv.array).size).toBeGreaterThan(1);
          }
        }
      });
      expect(triangles).toBeGreaterThan(0);
      expect(triangles).toBeLessThanOrEqual(budget);
      expect([...materials].sort()).toEqual(registered.materials);
      if (['fus_diagnostic_console', 'fus_main_control_desk'].includes(model)) {
        // Ekrany nie mogą być schowane w geometrii pulpitu.
        for (const mesh of meshes) {
          const material = mesh.material;
          if (
            Array.isArray(material) ||
            !material.name.startsWith('mat_screen_')
          )
            continue;
          const positions = mesh.geometry.getAttribute('position');
          const index = mesh.geometry.index!;
          for (let i = 0; i < index.count; i += 6) {
            const target = new Vector3();
            for (let j = 0; j < 3; j++) {
              target.add(
                new Vector3().fromBufferAttribute(positions, index.getX(i + j)),
              );
            }
            target.divideScalar(3).applyMatrix4(mesh.matrixWorld);
            const origin = target.clone().add(new Vector3(0, 0, 0.4));
            const [hit] = new Raycaster(
              origin,
              new Vector3(0, 0, -1),
              0,
              0.401,
            ).intersectObjects(meshes, false);
            expect(hit?.object, 'widoczna powierzchnia monitora').toBe(mesh);
          }
        }
      }
      const preview = readFileSync(
        join(root, 'artifacts/models/fusion', model + '.png'),
      );
      expect(preview.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(preview.readUInt32BE(16)).toBe(720);
      expect(preview.readUInt32BE(20)).toBe(720);
      // Wolne przejścia w osi portali i pod łukiem chłodziwa, w obu kierunkach.
      if (
        [
          'fus_blast_door_frame',
          'fus_decon_shower_arch',
          'fus_coolant_pipe_arch',
        ].includes(model)
      ) {
        const coolant = model === 'fus_coolant_pipe_arch';
        for (const across of [-1, 0, 1]) {
          for (const height of [0.2, 1.1, 2.2]) {
            for (const sign of [-1, 1]) {
              const origin = coolant
                ? new Vector3(sign * 3, height, across)
                : new Vector3(across, height, sign * 3);
              const direction = coolant
                ? new Vector3(-sign, 0, 0)
                : new Vector3(0, 0, -sign);
              expect(
                new Raycaster(origin, direction, 0, 6).intersectObjects(
                  meshes,
                  false,
                ),
              ).toHaveLength(0);
            }
          }
        }
      }
      for (const mesh of meshes) mesh.geometry.dispose();
    },
  );
});
