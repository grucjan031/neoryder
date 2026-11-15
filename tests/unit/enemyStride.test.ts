import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { enemySchema } from '../../src/enemies/enemySchema';
import assaulter from '../../src/data/enemies/assaulter.json';
import gunner from '../../src/data/enemies/gunner.json';
import sniper from '../../src/data/enemies/sniper.json';
import shielder from '../../src/data/enemies/shielder.json';
import executor from '../../src/data/enemies/executor.json';
import chief from '../../src/data/enemies/securityChief.json';

/** Droga stopy podporowej względem miednicy na cykl klipu (m modelu), z próbek GLB. */
async function measuredStride(model: string, clipName: string) {
  const file = readFileSync(
    join(__dirname, '../../public/assets/models', `${model}.glb`),
  );
  const gltf = await new GLTFLoader().parseAsync(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    '',
  );
  const clip = gltf.animations.find((c) => c.name === clipName)!;
  const mixer = new AnimationMixer(gltf.scene);
  mixer.clipAction(clip).play();
  const foot = gltf.scene.getObjectByName('DEF-footL')!;
  const samples = 60;
  const points: Vector3[] = [];
  for (let i = 0; i <= samples; i++) {
    mixer.setTime((clip.duration * i) / samples);
    gltf.scene.updateMatrixWorld(true);
    points.push(foot.getWorldPosition(new Vector3()));
  }
  const heights = points.map((p) => p.y);
  const limit = [...heights].sort((a, b) => a - b)[Math.floor(samples * 0.3)]!;
  const speeds: number[] = [];
  for (let i = 0; i < samples; i++)
    if (heights[i]! <= limit && heights[i + 1]! <= limit)
      speeds.push(
        -(points[i + 1]!.z - points[i]!.z) / (clip.duration / samples),
      );
  speeds.sort((a, b) => a - b);
  return speeds[Math.floor(speeds.length / 2)]! * clip.duration;
}

describe('długość kroku wrogów na manekinie', () => {
  it.each([
    ['assaulter', assaulter],
    ['gunner', gunner],
    ['sniper', sniper],
    ['shielder', shielder],
    ['executor', executor],
    ['securityChief', chief],
  ] as const)(
    '%s: clipStrideM odpowiada drodze stóp klipów Walk_Loop i Jog_Fwd_Loop (z uwzględnieniem skali)',
    async (_id, raw) => {
      const definition = enemySchema.parse(raw);
      const scale = definition.boss?.modelScale ?? 1;
      const strides = definition.animation!.clipStrideM!;
      for (const clip of ['Walk_Loop', 'Jog_Fwd_Loop'] as const) {
        const measured =
          (await measuredStride(definition.model!, clip)) * scale;
        expect(strides[clip]!, `${definition.id} ${clip}`).toBeGreaterThan(
          measured * 0.94,
        );
        expect(strides[clip]!, `${definition.id} ${clip}`).toBeLessThan(
          measured * 1.06,
        );
      }
    },
  );
});
