import { readFileSync } from 'node:fs';
import { AnimationMixer, Group, SkinnedMesh, Vector3 } from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import hideout from '../../src/data/hub/hideout.json';
import { catClip, HubFauna } from '../../src/scenes/hubFauna';
import { loadHubLayout } from '../../src/world/hubSchema';

const load = () => {
  const bytes = readFileSync('public/assets/models/hub_cat.glb');
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
};

const lowest = (root: Object3D, skins: SkinnedMesh[]): number => {
  root.updateMatrixWorld(true);
  const point = new Vector3();
  let low = Infinity;
  for (const skin of skins) {
    skin.skeleton.update();
    const count = skin.geometry.getAttribute('position').count;
    for (let i = 0; i < count; i++)
      low = Math.min(
        low,
        skin.getVertexPosition(i, point).applyMatrix4(skin.matrixWorld).y,
      );
  }
  return low;
};

it('hub_cat.glb: skórowany czarny kot ze szkieletem (głowa, 4 łapy, ogon w 4 członach) i zapętlonymi klipami', async () => {
  const gltf = await load();
  const body = gltf.scene.getObjectByName('cat_body');
  expect(body).toBeInstanceOf(SkinnedMesh);
  expect(gltf.scene.getObjectByName('cat_eyes')).toBeInstanceOf(SkinnedMesh);
  const bones = (body as SkinnedMesh).skeleton.bones.map((bone) => bone.name);
  for (const name of [
    'hips',
    'spine',
    'chest',
    'neck',
    'head',
    'tail1',
    'tail2',
    'tail3',
    'tail4',
    'upperarmL',
    'forearmL',
    'thighR',
    'toeR',
  ])
    expect(bones).toContain(name);
  const names = gltf.animations.map((clip) => clip.name).sort();
  expect(names).toEqual(['groom', 'idle', 'lie', 'sit', 'walk']);
  for (const clip of gltf.animations) {
    expect(clip.duration).toBeGreaterThan(0.5);
    for (const track of clip.tracks) {
      const size = track.getValueSize();
      const first = track.values.slice(0, size);
      const last = track.values.slice(track.values.length - size);
      for (let i = 0; i < size; i++)
        expect(
          Math.abs(Math.abs(first[i]!) - Math.abs(last[i]!)),
          `${clip.name}: ${track.name}`,
        ).toBeLessThan(1e-3);
    }
  }
});

it('każdy klip kota trzyma łapy i tułów przy podłodze: bez lewitowania i zapadania się', async () => {
  const gltf = await load();
  const skins: SkinnedMesh[] = [];
  gltf.scene.traverse((node) => {
    if (node instanceof SkinnedMesh) skins.push(node);
  });
  const mixer = new AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) {
    const action = mixer.clipAction(clip);
    action.play();
    for (let step = 0; step < 8; step++) {
      mixer.setTime((clip.duration * step) / 8);
      const low = lowest(gltf.scene, skins);
      expect(low, `${clip.name} ${step}`).toBeGreaterThan(-0.015);
      expect(low, `${clip.name} ${step}`).toBeLessThan(0.02);
    }
    action.stop();
  }
});

it('klip walk przesuwa łapę w podporze z prędkością catWalkClipSpeedMS (bez poślizgu przy timeScale = v / prędkość klipu)', async () => {
  const gltf = await load();
  const walk = gltf.animations.find((clip) => clip.name === 'walk')!;
  const mixer = new AnimationMixer(gltf.scene);
  mixer.clipAction(walk).play();
  const toe = gltf.scene.getObjectByName('toeL')!;
  const samples: { y: number; z: number; t: number }[] = [];
  const point = new Vector3();
  for (let i = 0; i <= 120; i++) {
    const t = (walk.duration * i) / 120;
    mixer.setTime(t);
    gltf.scene.updateMatrixWorld(true);
    toe.getWorldPosition(point);
    samples.push({ y: point.y, z: point.z, t });
  }
  const ground = Math.min(...samples.map((s) => s.y));
  const stance = samples.filter((s) => s.y < ground + 0.002);
  expect(stance.length).toBeGreaterThan(30);
  const a = stance[2]!;
  const b = stance[stance.length - 3]!;
  const speed = Math.abs((b.z - a.z) / (b.t - a.t));
  expect(speed).toBeGreaterThan(tuning.hub.catWalkClipSpeedMS * 0.85);
  expect(speed).toBeLessThan(tuning.hub.catWalkClipSpeedMS * 1.15);
});

it('stan kota wybiera klip: odpoczynek, chód z tempem z prędkości, bezruch na trasie to idle', () => {
  const t = tuning.hub;
  expect(catClip({ state: 'sit', moving: false }, t).clip).toBe('sit');
  expect(catClip({ state: 'lie', moving: false }, t).clip).toBe('lie');
  expect(catClip({ state: 'groom', moving: false }, t).clip).toBe('groom');
  expect(catClip({ state: 'walk', moving: false }, t)).toEqual({
    clip: 'idle',
    timeScale: 1,
  });
  const walk = catClip({ state: 'walk', moving: true }, t, 0.6);
  expect(walk.clip).toBe('walk');
  expect(walk.timeScale).toBeCloseTo(0.6 / t.catWalkClipSpeedMS);
  const flee = catClip({ state: 'flee', moving: true }, t);
  expect(flee.timeScale).toBe(
    Math.min(t.catWalkMaxTimeScale, t.catFleeSpeedMS / t.catWalkClipSpeedMS),
  );
  expect(catClip({ state: 'return', moving: true }, t).clip).toBe('walk');
});

it('Węgielek reaguje ruchem głowy i nie pogłębia przechyłu, gdy czas stoi', async () => {
  const gltf = await load();
  const models = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockImplementation(async (url) => {
      if (!url.endsWith('hub_cat.glb')) throw new Error(url);
      return gltf;
    });
  const root = new Group();
  const layout = loadHubLayout(hideout);
  const idlePlayer = {
    position: { x: 0, y: 1, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
  } as Parameters<HubFauna['step']>[1];
  const fauna = new HubFauna(
    {
      bus: new EventBus(),
      rng: new Rng('hub-pet'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning,
      debug: false,
    },
    root,
    layout,
    () => idlePlayer,
  );
  try {
    await fauna.load();
    const head = root.getObjectByName('head')!;
    fauna.pet();
    fauna.render(1);
    const initial = head.quaternion.clone();
    for (let i = 0; i < 40; i++) fauna.step(SIM_DT, idlePlayer);
    fauna.render(1);
    const reaction = head.quaternion.clone();
    expect(reaction.angleTo(initial)).toBeGreaterThan(0.05);
    fauna.render(1);
    fauna.render(1);
    expect(reaction.angleTo(head.quaternion)).toBeLessThan(1e-5);
  } finally {
    fauna.dispose();
    models.mockRestore();
  }
});
