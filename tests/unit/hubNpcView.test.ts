import { readFileSync } from 'node:fs';
import {
  AnimationMixer,
  BoxGeometry,
  LoopRepeat,
  Mesh,
  MeshToonMaterial,
  PerspectiveCamera,
  SkinnedMesh,
  Vector3,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { BufferGeometry, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it, vi } from 'vitest';
import { tuning } from '../../src/core/tuning';
import {
  HubNpcs,
  inOutfit,
  npcAnimDue,
  npcOutfit,
} from '../../src/scenes/hubNpcs';
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
    parse('npc_civilian.glb'),
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

it('ubiera NPC wariantami npc_civilian.glb według look: skórowany strój bez brył na tułowiu, wspólny szkielet', async () => {
  const [body, clips] = await Promise.all([
    parse('npc_civilian.glb'),
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
  const hooded = {
    ...bare,
    id: 'hooded',
    look: { ...bare.look, headwear: 'hood', torso: 'hoodie', prop: 'wrench' },
  } as const;
  const all = [...defs, bare, hooded];
  const view = new HubNpcs(
    all.map((def) => new NpcRuntime(def, tuning.hub)),
    tuning,
  );
  const meshes = (root: Object3D, prefix = ''): Mesh[] => {
    const out: Mesh[] = [];
    root.traverse((node) => {
      if (node instanceof Mesh && node.name.startsWith(prefix)) out.push(node);
    });
    return out;
  };
  const outer: Record<string, string | null> = {
    none: null,
    vest: 'over_vest',
    apron: 'over_apron',
    jacket: 'top_jacket',
    hoodie: 'top_hoodie',
    coat: 'top_coat',
  };
  try {
    await view.load();
    const headCounts = {
      none: 0,
      cap: 2,
      cap_stripe: 3,
      beanie: 3,
      goggles: 4,
      glasses: 5,
      headphones: 3,
      bandana: 3,
      hood: 0,
    };
    for (const def of all) {
      const root = view.root.getObjectByName(`npc:${def.id}`)!;
      const parts = npcOutfit(def);
      const garments = meshes(root).filter(
        (mesh) =>
          !mesh.name.startsWith('headwear:') &&
          !mesh.name.startsWith('npcMarker:'),
      );
      // Tylko części stroju NPC, każda obecna; dokładnie jedna góra.
      expect(
        garments.every((mesh) => inOutfit(mesh.name, parts)),
        def.id,
      ).toBe(true);
      for (const part of parts)
        expect(
          garments.some((mesh) => inOutfit(mesh.name, [part])),
          `${def.id}: ${part}`,
        ).toBe(true);
      expect(
        garments.filter((mesh) =>
          /^top_(shirt|jacket|hoodie|coat)$/.test(mesh.name),
        ),
        def.id,
      ).toHaveLength(1);
      expect(
        garments.some((mesh) => mesh.geometry instanceof BoxGeometry),
      ).toBe(false);
      const skins = garments.filter(
        (mesh): mesh is SkinnedMesh => mesh instanceof SkinnedMesh,
      );
      expect(skins.length).toBeGreaterThanOrEqual(4);
      expect(new Set(skins.map((skin) => skin.skeleton)).size).toBe(1);
      const head = meshes(root, 'headwear:');
      const headwear = def.look?.headwear;
      if (headwear) expect(head, def.id).toHaveLength(headCounts[headwear]);
      expect(head.every((mesh) => mesh.parent?.name === 'DEF-head')).toBe(true);
    }
    const legacy = [
      {
        id: 'mira',
        color: '3b4254',
        parts: ['over_vest', 'prop_wrench', 'prop_pouches_'],
      },
      { id: 'wolan', color: '2f3f66', parts: ['top_coat'] },
      { id: 'szron', color: '424856', parts: ['top_jacket', 'role_szron_'] },
      { id: 'bajt', color: '2c3f63', parts: ['over_vest', 'prop_backpack'] },
      { id: 'tomasz', color: '4a4e5a', parts: ['over_vest', 'prop_pouches_'] },
    ];
    for (const npc of legacy) {
      const root = view.root.getObjectByName(`npc:${npc.id}`)!;
      for (const part of npc.parts)
        expect(meshes(root, part).length, `${npc.id}: ${part}`).toBeGreaterThan(
          0,
        );
      const garment = root.getObjectByName(npc.parts[0]!) as Mesh;
      expect(
        (garment.material as MeshToonMaterial).color.getHexString(),
        npc.id,
      ).toBe(npc.color);
    }
    expect(
      meshes(view.root.getObjectByName('npc:hooded')!, 'head_hood').length,
    ).toBe(1);
    const colors = new Map<number, string>();
    for (const def of [...defs.filter((def) => def.look), hooded]) {
      const look = def.look!;
      const name = outer[look.torso ?? 'vest'];
      if (!name) continue;
      const root = view.root.getObjectByName(`npc:${def.id}`)!;
      const material = (root.getObjectByName(name) as Mesh)
        .material as MeshToonMaterial;
      expect(material).toBeInstanceOf(MeshToonMaterial);
      const color = material.color.getHexString();
      if (colors.has(look.shade!)) expect(color).toBe(colors.get(look.shade!));
      colors.set(look.shade!, color);
    }
    expect(colors.size).toBe(10);
    expect(new Set(colors.values()).size).toBe(10);
    const headwear = meshes(view.root, 'headwear:');
    const geometries = new Set<BufferGeometry>(
      headwear.map((mesh) => mesh.geometry),
    );
    expect(geometries.size).toBeLessThan(headwear.length / 2);
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

it('polityka aktualizacji mixera: widoczni bliscy co klatkę, dalecy rzadziej, poza kadrem najrzadziej', () => {
  expect(npcAnimDue(true, true, 0, 3, 20)).toBe(true);
  expect(npcAnimDue(false, true, 2, 3, 20)).toBe(false);
  expect(npcAnimDue(false, true, 3, 3, 20)).toBe(true);
  expect(npcAnimDue(true, false, 2, 3, 20)).toBe(false);
  expect(npcAnimDue(true, false, 3, 3, 20)).toBe(true);
  expect(npcAnimDue(false, false, 19, 3, 20)).toBe(false);
  expect(npcAnimDue(false, false, 20, 3, 20)).toBe(true);
  expect(npcAnimDue(false, false, 0, 0, 0)).toBe(false);
});

it('sfera ograniczająca siatki obejmuje wszystkie wierzchołki w pozach wszystkich klipów', async () => {
  const [body, clips] = await Promise.all([
    parse('npc_civilian.glb'),
    parse('npc_anims.glb'),
  ]);
  const instance = clone(body.scene);
  const skins: SkinnedMesh[] = [];
  instance.traverse((node) => {
    if (node instanceof SkinnedMesh) skins.push(node);
  });
  expect(skins.length).toBeGreaterThan(5);
  const { npcBoundsCenterM, npcBoundsRadiusM } = tuning.hub;
  const center = new Vector3(0, npcBoundsCenterM, 0);
  const mixer = new AnimationMixer(instance);
  const point = new Vector3();
  let worst = 0;
  for (const clip of clips.animations) {
    const action = mixer.clipAction(clip);
    action.play();
    for (let step = 0; step < 6; step++) {
      mixer.setTime((clip.duration * step) / 6);
      instance.updateMatrixWorld(true);
      for (const mesh of skins) {
        mesh.skeleton.update();
        const count = mesh.geometry.getAttribute('position').count;
        for (let i = 0; i < count; i += 3)
          worst = Math.max(
            worst,
            mesh.getVertexPosition(i, point).distanceTo(center),
          );
      }
    }
    action.stop();
  }
  expect(worst).toBeLessThan(npcBoundsRadiusM);
});

it('NPC poza kadrem nie animuje się często, a po powrocie do kadru dostaje zaległy dt od razu', async () => {
  const [body, clips] = await Promise.all([
    parse('npc_civilian.glb'),
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
    npc.step(1, { x: -100, y: 0, z: -100 }, false);
    view.render(1, 0, npc.position, null);
    const camera = new PerspectiveCamera(60, 1, 0.1, 100);
    const place = (x: number, z: number, yaw: number): void => {
      camera.position.set(x, 1.6, z);
      camera.rotation.set(0, yaw, 0);
      camera.updateMatrixWorld();
    };
    const root = view.root.children[0]!;
    // Kamera obok NPC, patrzy w przeciwną stronę.
    place(root.position.x, root.position.z + 3, Math.PI);
    view.cull(camera);
    expect(view.visibleCount).toBe(0);
    const update = vi.spyOn(AnimationMixer.prototype, 'update');
    const far = { x: 100, y: 0, z: 100 };
    const framesToUpdate = (): number => {
      update.mockClear();
      let frames = 0;
      while (update.mock.calls.length === 0 && frames < 100) {
        view.render(1, 0.01, far, null);
        frames++;
      }
      return frames;
    };
    framesToUpdate();
    expect(framesToUpdate()).toBe(t.hub.npcAnimHiddenFrames);
    update.mockClear();
    view.render(1, 0.01, far, null);
    view.render(1, 0.01, far, null);
    expect(update).not.toHaveBeenCalled();
    place(root.position.x, root.position.z + 3, 0);
    view.cull(camera);
    expect(view.visibleCount).toBe(1);
    expect(update).toHaveBeenCalledExactlyOnceWith(0.02);
  } finally {
    view.dispose();
    load.mockRestore();
    vi.restoreAllMocks();
  }
});
