import { readFileSync } from 'node:fs';
import {
  AnimationMixer,
  BoxGeometry,
  LoopRepeat,
  Mesh,
  MeshToonMaterial,
  Vector3,
} from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it, vi } from 'vitest';
import { tuning } from '../../src/core/tuning';
import { HubNpcs } from '../../src/scenes/hubNpcs';
import { NpcRuntime } from '../../src/world/hubNpcs';
import { lifeLayout } from '../fixtures/hubLife';
import hideoutData from '../../src/data/hub/hideout.json';
import { loadHubLayout } from '../../src/world/hubSchema';

const parse = (file: string) => {
  const bytes = readFileSync(`public/assets/models/${file}`);
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
};

it('interpoluje model i yaw, zapętla klipy, robi crossfade oraz sumuje dt odległych mixerów', async () => {
  const [body, clips] = await Promise.all([
    parse('enemy_trooper.glb'),
    parse('npc_anims.glb'),
  ]);
  const load = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockImplementation(async (url) =>
      url.includes('npc_anims') ? clips : body,
    );
  const t = structuredClone(tuning);
  const npc = new NpcRuntime(lifeLayout().npcs![0]!, t.hub);
  const view = new HubNpcs([npc], t);
  try {
    await view.load();
    const root = view.root.children[0]!;
    expect(root.scale.x).toBe(0.68);
    const far = { x: -100, y: 0, z: -100 };
    npc.step(1, far, false);
    view.render(0.5, 0, npc.position, null);
    expect(root.position.x).toBeCloseTo(0.5);
    // Przejście przez granicę ±pi idzie krótszym łukiem.
    npc.previousBodyYaw = Math.PI - 0.1;
    npc.look.bodyYaw = -Math.PI + 0.1;
    view.render(0.5, 0, npc.position, null);
    expect(root.rotation.y).toBeCloseTo(Math.PI);
    const update = vi.spyOn(AnimationMixer.prototype, 'update');
    view.render(1, 0.01, far, null);
    view.render(1, 0.02, far, null);
    expect(update).not.toHaveBeenCalled();
    view.render(1, 0.03, far, null);
    expect(update).toHaveBeenCalledExactlyOnceWith(0.06);
    update.mockClear();
    view.render(1, 0.01, npc.position, null);
    expect(update).toHaveBeenCalledExactlyOnceWith(0.01);
    const actual = update.mock.contexts[0] as AnimationMixer;
    for (const name of ['PickUp_Table', 'Punch_Jab', 'Punch_Cross']) {
      const action = actual.clipAction(
        clips.animations.find((clip) => clip.name === name)!,
      );
      expect(action.loop).toBe(LoopRepeat);
      expect(action.repetitions).toBe(Infinity);
    }
    const walk = actual.clipAction(
      clips.animations.find((clip) => clip.name === 'Walk_Loop')!,
    );
    const fade = vi.spyOn(walk, 'crossFadeTo');
    npc.route.moving = false;
    view.render(1, 0.01, npc.position, 'kid');
    const talking = actual.clipAction(
      clips.animations.find((clip) => clip.name === 'Idle_Talking_Loop')!,
    );
    expect(fade).toHaveBeenCalledWith(talking, t.hub.npcAnimFadeS, false);
    expect(talking.isRunning()).toBe(true);
    const back = vi.spyOn(talking, 'crossFadeTo');
    view.render(1, 0.01, npc.position, null);
    expect(back).toHaveBeenCalledWith(
      actual.clipAction(
        clips.animations.find((clip) => clip.name === 'Idle_Loop')!,
      ),
      t.hub.npcAnimFadeS,
      false,
    );
  } finally {
    view.dispose();
    load.mockRestore();
    vi.restoreAllMocks();
  }
});

it('ubiera mieszkańców z look na prawdziwych kościach, zachowuje kluczowych NPC i współdzieli geometrie bez WebGL', async () => {
  const [body, clips] = await Promise.all([
    parse('enemy_trooper.glb'),
    parse('npc_anims.glb'),
  ]);
  const load = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockImplementation(async (url) =>
      url.includes('npc_anims') ? clips : body,
    );
  const defs = loadHubLayout(hideoutData).npcs!;
  const base = defs[0]!;
  const bare = {
    ...base,
    id: 'bare',
    look: { shade: 0, headwear: 'none', torso: 'none', prop: 'none' },
  } as const;
  const wrench = {
    ...bare,
    id: 'wrench',
    look: { ...bare.look, prop: 'wrench' },
  } as const;
  const view = new HubNpcs(
    [...defs, bare, wrench].map((def) => new NpcRuntime(def, tuning.hub)),
    tuning,
  );
  const accessories = (root: Object3D, prefix: string): Mesh[] => {
    const meshes: Mesh[] = [];
    root.traverse((node) => {
      if (node instanceof Mesh && node.name.startsWith(prefix))
        meshes.push(node);
    });
    return meshes;
  };
  try {
    await view.load();
    const headCounts = {
      none: 0,
      cap: 2,
      cap_stripe: 3,
      beanie: 3,
      goggles: 3,
      glasses: 5,
      headphones: 3,
      bandana: 3,
      hood: 3,
    };
    const torsoCounts = { none: 0, vest: 5, jacket: 9, coat: 8, apron: 7 };
    const propCounts = {
      none: 0,
      pouches: 2,
      backpack: 2,
      satchel: 3,
      toolbelt: 7,
      wrench: 3,
    };
    const old = [
      { id: 'mira', color: '3b4254', head: 2, prop: 3 },
      { id: 'wolan', color: '2f3f66', head: 3, prop: 3 },
      { id: 'szron', color: '424856', head: 3, prop: 3 },
      { id: 'bajt', color: '2c3f63', head: 3, prop: 2 },
      { id: 'tomasz', color: '4a4e5a', head: 3, prop: 4 },
    ];
    for (const legacy of old) {
      const root = view.root.getObjectByName(`npc:${legacy.id}`)!;
      const material = (root.getObjectByName('armored_body') as Mesh)
        .material as MeshToonMaterial;
      expect(material.color.getHexString(), legacy.id).toBe(legacy.color);
      expect(accessories(root, 'headwear:')).toHaveLength(legacy.head);
      expect(accessories(root, 'torso:')).toHaveLength(5);
      expect(accessories(root, 'prop:')).toHaveLength(legacy.prop);
    }
    const colors = new Map<number, string>();
    for (const def of [...defs.filter((def) => def.look), bare, wrench]) {
      const root = view.root.getObjectByName(`npc:${def.id}`)!;
      const look = def.look!;
      const head = accessories(root, 'headwear:');
      const torso = accessories(root, 'torso:');
      const props = accessories(root, 'prop:');
      expect(head, def.id).toHaveLength(headCounts[look.headwear!]);
      expect(torso, def.id).toHaveLength(torsoCounts[look.torso!]);
      expect(props, def.id).toHaveLength(propCounts[look.prop!]);
      expect(head.every((mesh) => mesh.parent?.name === 'DEF-head')).toBe(true);
      expect(
        [...torso, ...props].every((mesh) =>
          ['DEF-spine003', 'DEF-hips'].includes(mesh.parent!.name),
        ),
      ).toBe(true);
      const material = (root.getObjectByName('armored_body') as Mesh)
        .material as MeshToonMaterial;
      expect(material).toBeInstanceOf(MeshToonMaterial);
      const color = material.color.getHexString();
      if (colors.has(look.shade!)) expect(color).toBe(colors.get(look.shade!));
      colors.set(look.shade!, color);
      if (look.torso === 'apron') {
        const skirt = torso.find(
          (mesh) =>
            mesh.geometry instanceof BoxGeometry &&
            mesh.geometry.parameters.height === 0.53,
        )!;
        expect(skirt, def.id).toBeDefined();
        root.updateWorldMatrix(true, true);
        const point = root.children
          .find((child) => child.type !== 'Mesh')!
          .worldToLocal(skirt.getWorldPosition(new Vector3()));
        expect(point.y).toBeCloseTo(0.72);
        expect(point.z).toBeCloseTo(0.15);
      }
    }
    expect(colors.size).toBe(10);
    expect(new Set(colors.values()).size).toBe(10);
    const meshes = accessories(view.root, 'torso:');
    const geometries = new Set<BufferGeometry>(
      meshes.map((mesh) => mesh.geometry),
    );
    expect(geometries.size).toBeLessThan(meshes.length / 2);
    const disposals = [...geometries].map((geometry) =>
      vi.spyOn(geometry, 'dispose'),
    );
    view.dispose();
    view.dispose();
    for (const disposal of disposals) expect(disposal).toHaveBeenCalledOnce();
  } finally {
    view.dispose();
    load.mockRestore();
    vi.restoreAllMocks();
  }
});
