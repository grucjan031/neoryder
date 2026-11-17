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
  'Walk_Loop',
  'Jog_Fwd_Loop',
  'Dance_Loop',
  'PickUp_Table',
  'Punch_Jab',
  'Punch_Cross',
  'Sword_Idle',
  'Spell_Simple_Idle_Loop',
  'Push_Loop',
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
const copyAccessor = (index, inPlace = false) => {
  const key = `${index}:${inPlace}`;
  if (remap.has(key)) return remap.get(key);
  const accessor = json.accessors[index];
  const view = json.bufferViews[accessor.bufferView];
  const size =
    COMPONENT_BYTES[accessor.componentType] *
    TYPE_COUNT[accessor.type] *
    accessor.count;
  if (view.byteStride) throw new Error('Nieobsługiwany byteStride');
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const data = Buffer.from(bin.subarray(start, start + size));
  if (inPlace) {
    if (accessor.componentType !== 5126 || accessor.type !== 'VEC3')
      throw new Error('Ruch korzenia wymaga VEC3 float');
    for (let frame = 0; frame < accessor.count; frame++) {
      data.writeFloatLE(0, frame * 12);
      data.writeFloatLE(0, frame * 12 + 8);
    }
  }
  const padded = Buffer.concat([data, Buffer.alloc((4 - (size % 4)) % 4)]);
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: size });
  chunks.push(padded);
  offset += padded.length;
  const copy = {
    ...accessor,
    bufferView: bufferViews.length - 1,
    byteOffset: 0,
  };
  if (inPlace) {
    if (copy.min) copy.min = [0, copy.min[1], 0];
    if (copy.max) copy.max = [0, copy.max[1], 0];
  }
  accessors.push(copy);
  remap.set(key, accessors.length - 1);
  return accessors.length - 1;
};
const outAnimations = animations.map((clip) => ({
  name: clip.name,
  channels: clip.channels,
  samplers: clip.samplers.map((sampler, index) => ({
    ...sampler,
    input: copyAccessor(sampler.input),
    output: copyAccessor(
      sampler.output,
      ['Walk_Loop', 'Jog_Fwd_Loop'].includes(clip.name) &&
        clip.channels.some(
          (channel) =>
            channel.sampler === index &&
            channel.target.path === 'translation' &&
            json.nodes[channel.target.node].name === 'root',
        ),
    ),
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
