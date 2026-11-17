import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AnimationMixer, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import hideoutData from '../../src/data/hub/hideout.json';
import { tuning } from '../../src/core/tuning';
import { isSeated, npcRootPosition } from '../../src/world/hubNpcs';
import { hubNpcSchema, loadHubLayout } from '../../src/world/hubSchema';

const layout = loadHubLayout(hideoutData);
const loader = new GLTFLoader();
const load = (name: string) => {
  const bytes = readFileSync(
    resolve(__dirname, '../../public/assets/models', name),
  );
  return loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
};

it('siedzący NPC wymaga dodatniej wysokości siedziska i skończonego offsetu', () => {
  const seated = layout.npcs!.find(isSeated)!;
  expect(hubNpcSchema.safeParse({ ...seated, seat: undefined }).success).toBe(
    false,
  );
  for (const heightM of [0, -1, Infinity])
    expect(
      hubNpcSchema.safeParse({ ...seated, seat: { ...seated.seat, heightM } })
        .success,
    ).toBe(false);
  expect(
    hubNpcSchema.safeParse({
      ...seated,
      seat: { heightM: 0.48, offset: { x: NaN, y: 0, z: 0 } },
    }).success,
  ).toBe(false);
});

it('w całym klipie miednica spoczywa ±0,08 m nad siedziskiem, obie stopy na podłodze, także po obrocie', async () => {
  const library = await load('npc_anims.glb');
  for (const npc of layout.npcs!.filter(isSeated)) {
    const seat = npc.seat!;
    const floorY = npc.position.y ?? 0;
    const seatTop = floorY + seat.heightM;
    const support = layout.blocks.find(
      (block) =>
        Math.abs(block.position.x - npc.position.x) < block.size.x / 2 &&
        Math.abs(block.position.z - npc.position.z) < block.size.z / 2 &&
        Math.abs(block.position.y + block.size.y / 2 - seatTop) < 0.001,
    );
    expect(support, `siedzisko ${npc.id}`).toBeDefined();
    const { scene } = await load('npc_civilian.glb');
    const clip = library.animations.find(({ name }) => name === npc.animation)!;
    const mixer = new AnimationMixer(scene);
    mixer.clipAction(clip).play();
    const hips = scene.getObjectByName('DEF-hips')!;
    const body = scene.getObjectByName('civ_boots') as SkinnedMesh;
    const point = new Vector3();
    for (const turn of [
      -tuning.hub.npcSeatedBodyMaxRad,
      0,
      tuning.hub.npcSeatedBodyMaxRad,
    ]) {
      const yaw = (npc.rotationDeg * Math.PI) / 180 + turn;
      scene.position.copy(npcRootPosition(npc, yaw));
      scene.rotation.y = yaw;
      for (let frame = 0; frame <= 120; frame++) {
        mixer.setTime((clip.duration * frame) / 121);
        scene.updateMatrixWorld(true);
        hips.getWorldPosition(point);
        expect(Math.abs(point.y - seatTop), npc.id).toBeLessThanOrEqual(0.08);
        expect(
          Math.hypot(point.x - npc.position.x, point.z - npc.position.z),
          npc.id,
        ).toBeLessThan(0.01);
        expect(Math.abs(point.x - support!.position.x)).toBeLessThan(
          support!.size.x / 2,
        );
        expect(Math.abs(point.z - support!.position.z)).toBeLessThan(
          support!.size.z / 2,
        );
        for (const name of ['DEF-toeL', 'DEF-toeR']) {
          scene.getObjectByName(name)!.getWorldPosition(point);
          expect(Math.abs(point.y - floorY), `${npc.id}: ${name}`).toBeLessThan(
            0.02,
          );
        }
        body.skeleton.update();
        let soleY = Infinity;
        for (
          let vertex = 0;
          vertex < body.geometry.getAttribute('position').count;
          vertex++
        ) {
          body.getVertexPosition(vertex, point).applyMatrix4(body.matrixWorld);
          soleY = Math.min(soleY, point.y);
        }
        expect(Math.abs(soleY - floorY), `podeszwa ${npc.id}`).toBeLessThan(
          0.01,
        );
      }
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(scene);
  }
});
