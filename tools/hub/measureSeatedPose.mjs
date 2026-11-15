// UĹĽycie: node tools/hub/measureSeatedPose.mjs (bez przeglÄ…darki).
import { readFileSync } from 'node:fs';
import { AnimationMixer, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const load = (path) => {
  const bytes = readFileSync(path);
  return loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
};
const library = await load('public/assets/models/npc_anims.glb');
for (const clip of library.animations.filter((c) =>
  c.name.startsWith('Sitting'),
)) {
  const { scene } = await load('public/assets/models/enemy_trooper.glb');
  const mixer = new AnimationMixer(scene);
  mixer.clipAction(clip).play();
  const names = ['DEF-hips', 'DEF-footL', 'DEF-footR', 'DEF-toeL', 'DEF-toeR'];
  const ranges = Object.fromEntries(
    names.map((name) => [
      name,
      {
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
      },
    ]),
  );
  const point = new Vector3();
  let soleY = Infinity;
  for (let frame = 0; frame <= 120; frame++) {
    mixer.setTime((clip.duration * frame) / 121);
    scene.updateMatrixWorld(true);
    for (const name of names) {
      scene.getObjectByName(name).getWorldPosition(point);
      point.toArray().forEach((value, axis) => {
        ranges[name].min[axis] = Math.min(ranges[name].min[axis], value);
        ranges[name].max[axis] = Math.max(ranges[name].max[axis], value);
      });
    }
    scene.traverse((node) => {
      if (!(node instanceof SkinnedMesh) || node.name !== 'armored_body')
        return;
      node.skeleton.update();
      for (
        let vertex = 0;
        vertex < node.geometry.attributes.position.count;
        vertex++
      ) {
        node.getVertexPosition(vertex, point).applyMatrix4(node.matrixWorld);
        soleY = Math.min(soleY, point.y);
      }
    });
  }
  console.log(JSON.stringify({ clip: clip.name, ranges, soleY }, null, 2));
  mixer.stopAllAction();
  mixer.uncacheRoot(scene);
}
