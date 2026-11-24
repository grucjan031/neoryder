import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Box3, Matrix4, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { weaponDefinitions } from '../../src/combat/weapons/weaponSchema';
import { FppBlaster } from '../../src/render/fppBlaster';
import { HandRig } from '../../src/render/handRig';

afterEach(() => vi.restoreAllMocks());

/**
 * Dłoń podpierająca broni dwuręcznych: przedramię ma wchodzić od dołu kadru
 * (łokieć poza dolną krawędzią albo w lewym dolnym rogu) i nie przecinać kadru w poprzek.
 */
describe('przedramię dłoni podpierającej w kadrze', () => {
  const twoHanded = [
    'rifle',
    'scatter',
    'sniper',
    'beam',
    'emp',
    'smg',
    'crossbow',
  ] as const;

  it.each(twoHanded)(
    '%s: łokieć pod dolną krawędzią, wąski rzut rękawa',
    async (id) => {
      vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(
        async (url) => {
          const bytes = readFileSync(`public${url}`);
          return new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '');
        },
      );
      const bus = new EventBus();
      const gun = new FppBlaster(bus, 1, {
        modelOf: (weapon) => weaponDefinitions.get(weapon)?.model,
      });
      const left = new HandRig('L');
      const camera = new PerspectiveCamera(tuning.camera.fov, 16 / 9, 0.01, 10);
      camera.updateMatrixWorld(true);
      try {
        await gun.load();
        bus.emit('weapon_switched', { owner: 1, weapon: id, slot: 0 });
        await gun.load();
        await left.load();
        for (const aim of [0, 1]) {
          gun.place(new Matrix4(), 0, aim);
          gun.root.updateMatrixWorld(true);
          const support = gun.supportMatrix();
          expect(support).not.toBeNull();
          // Jak FppOffhand: najpierw poza dłoni podpierającej, potem gniazdo w tej pozie.
          left.setPose(gun.supportPose, gun.supportPose, 0);
          left.placeAt(support!, 'socket_support');
          left.root.updateMatrixWorld(true);
          // Rękaw: sztywna siatka plate_bracer na kości forearm (narożniki jej bboxu).
          const sleeve = left.root.getObjectByName('plate_bracer') as Mesh;
          sleeve.geometry.computeBoundingBox();
          const box = sleeve.geometry.boundingBox as Box3;
          const palm = left.root
            .getObjectByName('palm_center')!
            .getWorldPosition(new Vector3());
          const corners: Vector3[] = [];
          for (const x of [box.min.x, box.max.x])
            for (const y of [box.min.y, box.max.y])
              for (const z of [box.min.z, box.max.z])
                corners.push(
                  new Vector3(x, y, z).applyMatrix4(sleeve.matrixWorld),
                );
          const elbow = corners.reduce((a, b) =>
            b.distanceTo(palm) > a.distanceTo(palm) ? b : a,
          );
          const ndc = (p: Vector3) => p.clone().project(camera);
          const end = ndc(elbow);
          const label = `${id} aim=${aim} łokieć NDC ${end.x.toFixed(2)}, ${end.y.toFixed(2)}`;
          expect(end.y < -1 || (end.x < -0.6 && end.y < -0.7), label).toBe(
            true,
          );
          const xs = corners
            .filter((p) => p.z < -0.01)
            .map((p) => Math.max(-1, Math.min(1, ndc(p).x)));
          const width = (Math.max(...xs) - Math.min(...xs)) / 2;
          expect(
            width,
            `${id} aim=${aim} szerokość rękawa`,
          ).toBeLessThanOrEqual(0.25);
        }
      } finally {
        gun.dispose();
        left.dispose();
      }
    },
  );
});
