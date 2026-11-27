// Niezależny pomiar wyeksportowanych GLB względem docs/maps/run6.md §4.1.
// node artifacts/models/residence/validate.mjs [--write-bounds]
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { Box3, Vector3, Raycaster, SRGBColorSpace } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const directory = 'public/assets/models/city';
const output = 'artifacts/models/residence';
const source = await readFile('docs/maps/run6.md', 'utf8');
const specs = [...source.matchAll(/\| \d+ \| `(res_\w+)` \| `([\d.]+) × ([\d.]+) × ([\d.]+)`[^\n]+?≤ (\d+) \|/g)]
  .map((match) => ({ model: match[1], size: match.slice(2, 5).map(Number), budget: Number(match[5]) }));
assert.equal(specs.length, 38);
assert.deepEqual((await readdir(directory)).filter((file) => /^res_.*\.glb$/.test(file)).sort(), specs.map((spec) => spec.model + '.glb').sort());
const boundsPath = 'src/data/render/mapModelBounds.json';
const boundsSource = await readFile(boundsPath, 'utf8');
const bounds = JSON.parse(boundsSource);
const measured = {};
const report = [];
const xyz = (v) => v.toArray().map((n) => Number(n.toFixed(4)));

function reserved(color) {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl, SRGBColorSpace);
  const h = hsl.h * 360;
  return hsl.s >= .35 && hsl.l >= .08 && (h < 15 || h >= 345 || (h >= 170 && h <= 200) || (h >= 285 && h <= 335));
}

for (const spec of specs) {
  const { model, size, budget } = spec;
  const file = await readFile(`${directory}/${model}.glb`);
  assert.equal(file.readUInt32LE(0), 0x46546c67);
  assert.equal(file.readUInt32LE(4), 2);
  assert.equal(file.readUInt32LE(8), file.length);
  const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString());
  assert.equal(json.images?.length ?? 0, 0, model + ': embedded images');
  assert.equal(json.animations?.length ?? 0, 0, model + ': animations');
  const { scene } = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  assert(scene.getObjectByName(model), model + ': root');
  scene.updateMatrixWorld(true);
  const aabb = new Box3().setFromObject(scene, true);
  aabb.getSize(new Vector3()).toArray().forEach((n, axis) => assert(Math.abs(n - size[axis]) < 0.0001, `${model}: size ${axis}: ${n} != ${size[axis]}`));
  assert(Math.abs(aabb.min.y) < 0.0001, model + ': floor');
  assert(Math.abs(aabb.min.x + size[0] / 2) < 0.0001, model + ': centered X');
  assert(Math.abs(aabb.min.z + size[2] / 2) < 0.0001, model + ': centered Z');
  let triangles = 0;
  const materials = new Set();
  const meshes = [];
  const batches = new Set();
  scene.traverse((mesh) => {
    if (!mesh.isMesh) return;
    meshes.push(mesh);
    const position = mesh.geometry.getAttribute('position');
    assert([...position.array].every(Number.isFinite), model + ': finite positions');
    triangles += (mesh.geometry.index?.count ?? position.count) / 3;
    for (const mat of [mesh.material].flat()) {
      materials.add(mat.name);
      assert.equal(mat.map, null, model + ': material.map');
      assert(!reserved(mat.color), model + ': reserved base ' + mat.name);
      assert(!reserved(mat.emissive), model + ': reserved glow ' + mat.name);
      if (mat.emissiveIntensity > 0 && mat.emissive.getHex() !== 0)
        assert(/^mat_(neon_(amber|green|blue|violet)|light_panel)$/.test(mat.name), model + ': glow ' + mat.name);
      if (mat.name === 'mat_glass_clear') {
        assert(mat.transparent && Math.abs(mat.opacity - .22) < .00001, model + ': glass alpha');
        assert.equal(json.materials.find((m) => m.name === mat.name).doubleSided, true);
      }
      if (/^mat_(screen|label)_/.test(mat.name)) assert(mesh.geometry.getAttribute('uv'), model + ': print UV');
      const key = mesh.parent.uuid + '/' + mat.name;
      assert(!batches.has(key), model + ': unmerged material ' + mat.name);
      batches.add(key);
    }
  });
  assert(triangles > 0 && triangles <= budget, `${model}: ${triangles}/${budget} triangles`);
  if (model === 'res_elevator_shaft_door') {
    for (const [name, x] of [['door_left', -.55], ['door_right', .55]]) {
      const group = scene.getObjectByName(name);
      assert(group && Math.abs(group.position.x - x) < .00001, model + ': movable ' + name);
    }
  }
  const passage = { res_interior_door_frame: 0, res_biometric_arch: 0, res_elevator_cab: 0, res_holding_cage_bars: 1.2 }[model];
  if (passage !== undefined) {
    for (const y of [.3, 1.0, 2.1]) {
      assert.equal(new Raycaster(new Vector3(passage, y, 3), new Vector3(0, 0, -1), 0, 6).intersectObjects(meshes, false).length, 0, model + ': blocked passage');
    }
  }
  const png = await readFile(`${output}/${model}.png`);
  assert.equal(png.readUInt32BE(16), 720, model + ': preview width');
  assert.equal(png.readUInt32BE(20), 720, model + ': preview height');
  measured[model] = { min: xyz(aabb.min), max: xyz(aabb.max), materials: [...materials].sort() };
  if (!process.argv.includes('--write-bounds')) assert.deepEqual(bounds[model], measured[model], model + ': bounds registry');
  report.push({ ...spec, triangles, bytes: file.length, meshes: meshes.length });
}
if (process.argv.includes('--write-bounds')) {
  // Zachowaj wszystkie istniejące wpisy innych zestawów, także równoległe zmiany.
  const lines = boundsSource.trimEnd().split(/\r?\n/).filter((line) => !/^\s*"res_/.test(line));
  lines.pop();
  lines[lines.length - 1] = lines.at(-1).replace(/,?\s*$/, ',');
  lines.push(...Object.entries(measured).sort(([a], [b]) => a.localeCompare(b)).map(([id, data]) => `  "${id}": ${JSON.stringify(data)},`));
  lines[lines.length - 1] = lines.at(-1).slice(0, -1);
  lines.push('}');
  await writeFile(boundsPath, lines.join('\n') + '\n');
}
await writeFile(`${output}/manifest.json`, JSON.stringify(report, null, 2) + '\n');
console.log(`PASS: ${report.length} GLB + PNG; AABB, budżety, paleta, materiały, UV, batching, drzwi i przejścia.`);
console.log(`Razem: ${report.reduce((n, m) => n + m.triangles, 0)} tri, ${report.reduce((n, m) => n + m.bytes, 0)} bytes.`);
