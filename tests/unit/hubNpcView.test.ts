import { readFileSync } from 'node:fs';
import { AnimationMixer, LoopRepeat } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it, vi } from 'vitest';
import { tuning } from '../../src/core/tuning';
import { HubNpcs } from '../../src/scenes/hubNpcs';
import { NpcRuntime } from '../../src/world/hubNpcs';
import { lifeLayout } from '../fixtures/hubLife';

it('interpoluje model i yaw, zapętla klipy, robi crossfade oraz sumuje dt odległych mixerów', async () => {
  const loader = new GLTFLoader();
  const parse = (file: string) => {
    const bytes = readFileSync(`public/assets/models/${file}`);
    return loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
  };
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
