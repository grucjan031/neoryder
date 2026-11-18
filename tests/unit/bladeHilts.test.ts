import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Mesh, Vector3 } from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

async function load(model: string): Promise<Object3D> {
  const bytes = readFileSync(
    join('public', 'assets', 'models', `${model}.glb`),
  );
  const gltf = await new GLTFLoader().parseAsync(
    new Uint8Array(bytes).buffer,
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

function triangles(root: Object3D): number {
  let count = 0;
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const geometry = node.geometry;
    count +=
      (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  });
  return count;
}

/** Pozycje gniazd klingi (glTF, m): kontrakt kolizji i efektów, nie zmienia ich szlif rękojeści. */
const SOCKETS: Record<string, Record<string, [number, number, number]>> = {
  plasma_blade: { blade: [0, 0, -0.135], blade_tip: [0, 0, -1.135] },
  blade_twin: { blade: [0, 0, -0.106], blade_tip: [0, 0, -1.106] },
  blade_staff: {
    blade: [0, 0, -0.412],
    blade_tip: [0, 0, -1.412],
    blade_back: [0, 0, 0.412],
    blade_back_tip: [0, 0, 1.412],
  },
};

/** Promień i długość chwytu (część trzymana dłonią) sprzed szlifu FPP. */
const GRIP: Record<string, { radius: number; halfLength: number }> = {
  plasma_blade: { radius: 0.0235, halfLength: 0.05 },
  blade_twin: { radius: 0.0257, halfLength: 0.035 },
  blade_staff: { radius: 0.024, halfLength: 0.06 },
};

describe('rękojeści ostrzy: szlif FPP', () => {
  it.each(Object.keys(SOCKETS))(
    '%s: gniazda, chwyt i budżet bez zmian kontraktu',
    async (model) => {
      const root = await load(model);
      const at = new Vector3();
      for (const [name, expected] of Object.entries(SOCKETS[model]!)) {
        const node = root.getObjectByName(name);
        expect(node, `${model}: ${name}`).toBeDefined();
        node!.getWorldPosition(at);
        expect(at.distanceTo(new Vector3(...expected))).toBeLessThan(1e-4);
      }
      const grip = root.getObjectByName('grip') as Mesh;
      grip.geometry.computeBoundingBox();
      const box = grip.geometry.boundingBox!;
      const spec = GRIP[model]!;
      expect(box.max.x).toBeCloseTo(spec.radius, 3);
      expect(box.max.y).toBeCloseTo(spec.radius, 3);
      expect(box.max.z).toBeCloseTo(spec.halfLength, 3);
      expect(box.min.z).toBeCloseTo(-spec.halfLength, 3);
      // Rękojeść (bez rdzeni klingi) mieści się w budżecie FPP 1000 trójkątów.
      let cores = 0;
      for (const name of ['blade_core', 'blade_back_core']) {
        const core = root.getObjectByName(name);
        if (core) cores += triangles(core);
      }
      expect(triangles(root) - cores).toBeLessThanOrEqual(1000);
      // Szczelina mocy: cyjanowe ogniwa dołączone do węzła emitera (mat_player_cyan).
      const emitter = root.getObjectByName('emitter_ring') as Mesh;
      expect(emitter.material).toHaveProperty('name', 'mat_player_cyan');
      expect(triangles(emitter)).toBeGreaterThan(
        model === 'blade_staff' ? 56 : 28,
      );
    },
  );
});
