// Wycina wybrane klipy z Quaternius UAL (CC0) do lekkiego GLB tylko ze szkieletem i animacjami.
// Użycie: node tools/hub/extractNpcAnimations.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'tools/blender/sources/ual/AnimationLibrary_Godot_Standard.glb';
const TARGET = 'public/assets/models/npc_anims.glb';
const CLIPS = [
  'Idle_Loop',
  'Idle_Talking_Loop',
  'Idle_Torch_Loop',
  'Sitting_Idle_Loop',
  'Sitting_Talking_Loop',
  'Fixing_Kneeling',
  'Crouch_Idle_Loop',
  'Interact',
];
const COMPONENT_BYTES = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};
const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

const glb = readFileSync(SOURCE);
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
const binStart = 20 + jsonLength + 8;
const bin = glb.subarray(
  binStart,
  binStart + glb.readUInt32LE(20 + jsonLength),
);

const animations = CLIPS.map((name) => {
  const clip = json.animations.find((a) => a.name === name);
  if (!clip) throw new Error(`Brak klipu ${name}`);
  return clip;
});
const remap = new Map();
const accessors = [];
const bufferViews = [];
const chunks = [];
let offset = 0;
const copyAccessor = (index) => {
  if (remap.has(index)) return remap.get(index);
  const accessor = json.accessors[index];
  const view = json.bufferViews[accessor.bufferView];
  const size =
    COMPONENT_BYTES[accessor.componentType] *
    TYPE_COUNT[accessor.type] *
    accessor.count;
  if (view.byteStride) throw new Error('Nieobsługiwany byteStride');
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const data = Buffer.from(bin.subarray(start, start + size));
  const padded = Buffer.concat([data, Buffer.alloc((4 - (size % 4)) % 4)]);
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: size });
  chunks.push(padded);
  offset += padded.length;
  const copy = {
    ...accessor,
    bufferView: bufferViews.length - 1,
    byteOffset: 0,
  };
  accessors.push(copy);
  remap.set(index, accessors.length - 1);
  return accessors.length - 1;
};
const outAnimations = animations.map((clip) => ({
  name: clip.name,
  channels: clip.channels,
  samplers: clip.samplers.map((sampler) => ({
    ...sampler,
    input: copyAccessor(sampler.input),
    output: copyAccessor(sampler.output),
  })),
}));
const nodes = json.nodes.map((node) => {
  const copy = { ...node };
  delete copy.mesh;
  delete copy.skin;
  return copy;
});
const out = {
  asset: json.asset,
  scene: json.scene ?? 0,
  scenes: json.scenes,
  nodes,
  animations: outAnimations,
  accessors,
  bufferViews,
  buffers: [{ byteLength: offset }],
};
let jsonBytes = Buffer.from(JSON.stringify(out));
jsonBytes = Buffer.concat([
  jsonBytes,
  Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20),
]);
const body = Buffer.concat(chunks);
const header = Buffer.alloc(12);
header.write('glTF', 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBytes.length + 8 + body.length, 8);
const jsonHead = Buffer.alloc(8);
jsonHead.writeUInt32LE(jsonBytes.length, 0);
jsonHead.write('JSON', 4);
const binHead = Buffer.alloc(8);
binHead.writeUInt32LE(body.length, 0);
binHead.write('BIN\0', 4, 'latin1');
writeFileSync(
  TARGET,
  Buffer.concat([header, jsonHead, jsonBytes, binHead, body]),
);
console.log(
  `${TARGET}: ${(12 + 16 + jsonBytes.length + body.length) / 1024} KiB, klipy: ${CLIPS.join(', ')}`,
);
