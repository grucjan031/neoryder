// Uruchom z katalogu projektu po zmianie miejskich GLB.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const directory = 'public/assets/models/city';
const models = {};
const xyz = (v) => v.toArray().map((x) => Number(x.toFixed(4)));
for (const file of (await readdir(directory))
  .filter((f) => f.endsWith('.glb'))
  .sort()) {
  const bytes = await readFile(`${directory}/${file}`);
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(scene, true);
  if (box.isEmpty()) throw new Error(`Pusty model: ${file}`);
  const materials = new Set();
  const ends = [];
  scene.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (const mat of [mesh.material].flat()) materials.add(mat.name);
    if (!/^city_(lantern_(chain|string)|cable(_span)?)\.glb$/.test(file))
      return;
    const points = mesh.geometry.getAttribute('position');
    const vertex = new Vector3();
    for (let i = 0; i < points.count; i++) {
      vertex.fromBufferAttribute(points, i).applyMatrix4(mesh.matrixWorld);
      if (!ends[0] || vertex.x < ends[0].x) ends[0] = vertex.clone();
      if (!ends[1] || vertex.x > ends[1].x) ends[1] = vertex.clone();
    }
  });
  models[file.slice(0, -4)] = {
    min: xyz(box.min),
    max: xyz(box.max),
    materials: [...materials].sort(),
    ...(ends.length ? { ends: ends.map(xyz) } : {}),
  };
}
await writeFile(
  'src/data/render/mapModelBounds.json',
  '{\n' +
    Object.entries(models)
      .map(([id, model]) => `  "${id}": ${JSON.stringify(model)}`)
      .join(',\n') +
    '\n}\n',
);
console.log(`Zmierzono ${Object.keys(models).length} modeli.`);
