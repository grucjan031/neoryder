import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AnimationAction,
  AnimationMixer,
  Box3,
  Mesh,
  Matrix4,
  SkinnedMesh,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EnemyView } from '../../src/enemies/enemyView';
import { enemySchema } from '../../src/enemies/enemySchema';
import { selectEnemyAnimation } from '../../src/enemies/enemyAnimation';
import type { Enemy, EnemySnapshot, EnemyState } from '../../src/enemies/types';
import { getMaterial } from '../../src/render/materials';
import { tuning } from '../../src/core/tuning';
import trooper from '../../src/data/enemies/assaulter.json';
import gunner from '../../src/data/enemies/gunner.json';
import sniper from '../../src/data/enemies/sniper.json';
import shielder from '../../src/data/enemies/shielder.json';
import executor from '../../src/data/enemies/executor.json';

async function load(name: string) {
  const file = readFileSync(
    join(__dirname, '../../public/assets/models', `${name}.glb`),
  );
  return new GLTFLoader().parseAsync(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    '',
  );
}
const snapshot = (): EnemySnapshot => ({
  state: 'idle',
  stateTimeS: 0,
  speed: 0,
  distance: 0,
  yaw: 0,
  position: { x: 0, y: 0, z: 0 },
});
const views: EnemyView[] = [];
afterEach(() => {
  for (const view of views.splice(0)) view.dispose();
  vi.restoreAllMocks();
});

it.each([
  [trooper, ['hand_R', 'baton', 'baton_tip', 'visor']],
  [gunner, ['hand_R', 'rifle', 'muzzle', 'visor']],
  [sniper, ['hand_R', 'rifle', 'muzzle', 'visor', 'eye']],
  [shielder, ['hand_R', 'baton', 'baton_tip', 'shield', 'visor']],
  [executor, ['hand_R', 'blade_hilt', 'visor', 'chest_core']],
] as const)(
  '$model: skin, klipy, mocowanie wyposażenia i budżet',
  async (raw, nodes) => {
    const definition = enemySchema.parse(raw);
    const gltf = await load(raw.model);
    let triangles = 0;
    let skin: SkinnedMesh | undefined;
    gltf.scene.traverse((node) => {
      if (node instanceof Mesh) {
        triangles +=
          (node.geometry.index?.count ??
            node.geometry.getAttribute('position').count) / 3;
        const materials = Array.isArray(node.material)
          ? node.material
          : [node.material];
        expect(
          materials.every((m) =>
            ['mat_enemy', 'mat_enemy_glow'].includes(m.name),
          ),
        ).toBe(true);
      }
      if (node instanceof SkinnedMesh) skin = node;
    });
    expect(skin).toBeDefined();
    expect(skin!.skeleton.bones).toHaveLength(53);
    expect(skin!.geometry.index!.count / 3).toBeGreaterThan(3900);
    expect(skin!.geometry.index!.count / 3).toBeLessThanOrEqual(4100);
    expect(skin!.geometry.getAttribute('skinWeight').count).toBe(
      skin!.geometry.getAttribute('position').count,
    );
    expect(triangles).toBeLessThanOrEqual(6000);
    expect(gltf.animations).toHaveLength(7);
    expect(gltf.animations.some((clip) => clip.name === 'Death01')).toBe(false);
    const names = new Set(gltf.animations.map((clip) => clip.name));
    for (const state of [
      'idle',
      'chase',
      'telegraph',
      'swing',
      'recovery',
      'reposition',
      'aim',
      'burst',
      'cooldown',
      'stunned',
      'dead',
    ] as EnemyState[]) {
      for (const speed of [0, definition.moveSpeed / 2, definition.moveSpeed])
        expect(
          names.has(
            selectEnemyAnimation(definition, { ...snapshot(), state, speed })
              .clip,
          ),
        ).toBe(true);
    }
    for (const name of nodes) {
      const node = gltf.scene.getObjectByName(name);
      expect(node, name).toBeDefined();
      let parent = node?.parent;
      while (parent && parent.type !== 'Bone') parent = parent.parent;
      expect(parent, `${name}: bone parent`).toBeTruthy();
    }
    gltf.scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(gltf.scene, true);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(new Box3().setFromObject(skin!, true).max.y).toBeCloseTo(
      raw.model === 'enemy_executor' ? 2.208 : 1.84,
      1,
    );
    if (names.has('Pistol_Aim_Neutral')) {
      const mixer = new AnimationMixer(gltf.scene);
      mixer
        .clipAction(
          gltf.animations.find((c) => c.name === 'Pistol_Aim_Neutral')!,
        )
        .play();
      mixer.update(0);
      gltf.scene.updateMatrixWorld(true);
      const muzzle = gltf.scene
        .getObjectByName('muzzle')!
        .getWorldPosition(new Vector3());
      const grip = gltf.scene
        .getObjectByName('rifle')!
        .getWorldPosition(new Vector3());
      expect(muzzle.sub(grip).normalize().z).toBeGreaterThan(0.95);
    }
  },
);

describe('AnimationMixer bez WebGL', () => {
  it('klonuje 30 szkieletów, współdzieli klipy, stylizuje skiny i aktualizuje tylko rysowane widoki w czasie świata', async () => {
    const source = await load('enemy_trooper');
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(source);
    const enemies: Enemy[] = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      definition: enemySchema.parse({ ...trooper, model: 'test-skinned' }),
      previous: snapshot(),
      current: snapshot(),
      removed: false,
      step() {},
      dispose() {},
    }));
    const action = vi.spyOn(AnimationMixer.prototype, 'clipAction');
    for (const enemy of enemies) views.push(new EnemyView(enemy));
    await vi.waitFor(() =>
      expect(views[0]!.root.getObjectByName('armored_body')).toBeDefined(),
    );
    const skins = views.map(
      (v) => v.root.getObjectByName('armored_body') as SkinnedMesh,
    );
    expect(new Set(skins.map((s) => s.skeleton))).toHaveProperty('size', 30);
    expect(skins[0]!.skeleton.bones[0]).not.toBe(skins[1]!.skeleton.bones[0]);
    expect(skins[0]!.geometry).toBe(skins[1]!.geometry);
    expect(skins[0]!.material).toBe(getMaterial('enemy'));
    const update = vi.spyOn(AnimationMixer.prototype, 'update');
    expect(action).toHaveBeenCalledTimes(30 * source.animations.length);
    for (const [clip] of action.mock.calls)
      expect(source.animations).toContain(clip);
    action.mockClear();
    const draw = (index: number) =>
      Reflect.apply(skins[index]!.onBeforeRender, skins[index], []);
    for (const view of views) view.render(1);
    expect(update).not.toHaveBeenCalled();
    draw(0);
    draw(0); // normal + bloom / outline
    expect(update).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled(); // akcje przygotowane raz, z oryginalnych klipów
    const firstBone = skins[0]!.skeleton.bones.find(
      (b) => b.name === 'DEFupper_armR' || b.name === 'DEF-upper_armR',
    )!;
    const rest = firstBone.quaternion.clone();
    enemies[0]!.current.stateTimeS = 0.2;
    views[0]!.render(1);
    draw(0);
    expect(update).toHaveBeenLastCalledWith(0.2);
    expect(firstBone.quaternion.equals(rest)).toBe(false);
    views[0]!.render(1);
    draw(0);
    expect(update).toHaveBeenLastCalledWith(0); // hitstop / pauza
    enemies[0]!.previous.stateTimeS = 0.2;
    enemies[0]!.current.stateTimeS = 0.205;
    views[0]!.render(0.5);
    draw(0);
    expect(update.mock.calls.at(-1)![0]).toBeCloseTo(0.0025); // interpolowany czas Skupienia
    const crossFade = vi.spyOn(AnimationAction.prototype, 'crossFadeFrom');
    enemies[0]!.current.state = 'telegraph';
    enemies[0]!.current.stateTimeS = 0;
    views[0]!.render(1);
    draw(0);
    expect(crossFade).toHaveBeenLastCalledWith(
      expect.anything(),
      tuning.enemies.animationFadeS,
      false,
    );
    enemies[0]!.current.state = 'dead';
    views[0]!.render(1);
    const before = update.mock.calls.length;
    draw(0);
    expect(update).toHaveBeenCalledTimes(before);
    const skeletonDispose = vi.spyOn(skins[0]!.skeleton, 'dispose');
    const geometryDispose = vi.spyOn(skins[0]!.geometry, 'dispose');
    views[0]!.dispose();
    expect(skeletonDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).not.toHaveBeenCalled();
  });
});

it('ponawia klip każdego strzału i skaluje tempo biegu prędkością ze snapshotu', async () => {
  const source = await load('enemy_gunner');
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(source);
  const actions = vi.spyOn(AnimationMixer.prototype, 'clipAction');
  const enemy: Enemy = {
    id: 100,
    definition: enemySchema.parse({ ...gunner, model: 'test-skinned-gunner' }),
    previous: snapshot(),
    current: snapshot(),
    removed: false,
    step() {},
    dispose() {},
  };
  const view = new EnemyView(enemy);
  views.push(view);
  await vi.waitFor(() =>
    expect(view.root.getObjectByName('armored_body')).toBeDefined(),
  );
  const shoot = actions.mock.results
    .map((r) => r.value as AnimationAction)
    .find((a) => a.getClip().name === 'Pistol_Shoot')!;
  const reset = vi.spyOn(shoot, 'reset');
  enemy.current.state = 'burst';
  enemy.current.shotTimeS = 0;
  view.render(1);
  enemy.current.shotTimeS = 0.1;
  view.render(1);
  expect(reset).toHaveBeenCalledOnce();
  enemy.current.shotTimeS = 0;
  view.render(1);
  expect(reset).toHaveBeenCalledTimes(2);
  enemy.current.state = 'reposition';
  enemy.current.speed = gunner.moveSpeed;
  view.render(1);
  const jog = actions.mock.results
    .map((r) => r.value as AnimationAction)
    .find((a) => a.getClip().name === 'Jog_Fwd_Loop')!;
  expect(jog.getEffectiveTimeScale()).toBeCloseTo(
    (jog.getClip().duration * gunner.moveSpeed) /
      gunner.animation.clipStrideM.Jog_Fwd_Loop,
  );
});

it('tarcza Tarczownika podąża za klatką piersiową i osłania lewą stronę bez przenikania ręki', async () => {
  const gltf = await load('enemy_shielder');
  const shield = gltf.scene.getObjectByName('shield') as Mesh;
  const body = gltf.scene.getObjectByName('armored_body') as SkinnedMesh;
  const forearm = gltf.scene.getObjectByName('forearm_plate_L') as Mesh;
  expect(shield.parent!.name).toBe('DEF-spine003');
  const attachment = shield.matrix.clone();
  shield.geometry.computeBoundingBox();
  const bounds = shield.geometry.boundingBox!;
  const indices = body.geometry.getAttribute('skinIndex');
  const weights = body.geometry.getAttribute('skinWeight');
  const armVertices: number[] = [];
  for (let i = 0; i < indices.count; i++) {
    let armWeight = 0;
    for (let component = 0; component < 4; component++) {
      const bone =
        body.skeleton.bones[indices.getComponent(i, component)]!.name;
      if (
        bone === 'DEF-forearmL' ||
        bone === 'DEF-handL' ||
        (bone.endsWith('L') &&
          (bone.startsWith('DEF-f_') || bone.startsWith('DEF-thumb')))
      )
        armWeight += weights.getComponent(i, component);
    }
    if (armWeight > 0.5) armVertices.push(i);
  }
  expect(armVertices.length).toBeGreaterThan(0);
  const mixer = new AnimationMixer(gltf.scene);
  const point = new Vector3();
  const inverse = new Matrix4();
  for (const name of [
    'Idle_Loop',
    'Walk_Loop',
    'Jog_Fwd_Loop',
    'Punch_Enter',
    'Punch_Cross',
  ]) {
    mixer.stopAllAction();
    const clip = gltf.animations.find((c) => c.name === name)!;
    mixer.clipAction(clip).reset().play();
    for (let frame = 0; frame <= 24; frame++) {
      mixer.setTime((clip.duration * frame) / 24);
      gltf.scene.updateMatrixWorld(true);
      expect(shield.matrix.equals(attachment)).toBe(true);
      inverse.copy(shield.matrixWorld).invert();
      const behindShield = (p: Vector3) => {
        if (
          p.x >= bounds.min.x &&
          p.x <= bounds.max.x &&
          p.y >= bounds.min.y &&
          p.y <= bounds.max.y
        )
          expect(
            p.z,
            `${name}, próbka ${frame}: ręka za tyłem tarczy`,
          ).toBeLessThan(bounds.min.z);
      };
      for (const vertex of armVertices)
        behindShield(
          body
            .getVertexPosition(vertex, point)
            .applyMatrix4(body.matrixWorld)
            .applyMatrix4(inverse),
        );
      for (
        let vertex = 0;
        vertex < forearm.geometry.getAttribute('position').count;
        vertex++
      )
        behindShield(
          point
            .fromBufferAttribute(
              forearm.geometry.getAttribute('position'),
              vertex,
            )
            .applyMatrix4(forearm.matrixWorld)
            .applyMatrix4(inverse),
        );
      if (name === 'Idle_Loop' && frame === 0) {
        const up = new Vector3(0, 1, 0).transformDirection(shield.matrixWorld);
        expect(up.y).toBeGreaterThan(0.999);
        expect(
          new Vector3(0, 0, 1).transformDirection(shield.matrixWorld).x,
        ).toBeGreaterThan(0);
        const box = new Box3().setFromObject(shield, true);
        expect(box.min.y).toBeGreaterThan(0.35);
        expect(box.min.y).toBeLessThan(0.5);
        expect(box.max.y).toBeGreaterThan(1.55);
        expect(box.max.y).toBeLessThan(
          gltf.scene.getObjectByName('visor')!.getWorldPosition(new Vector3())
            .y,
        );
        expect(box.getCenter(new Vector3()).x).toBeGreaterThan(0);
      }
    }
  }
});
