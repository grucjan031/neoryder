import { afterEach, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { EnemyView } from '../../src/enemies/enemyView';
import { enemySchema } from '../../src/enemies/enemySchema';
import type { Enemy, EnemySnapshot } from '../../src/enemies/types';
import raw from '../../src/data/enemies/assaulter.json';
import { getMaterial } from '../../src/render/materials';

const views: EnemyView[] = [];
afterEach(() => {
  for (const view of views.splice(0)) view.dispose();
  vi.restoreAllMocks();
});
function enemy(): Enemy {
  const snapshot = (): EnemySnapshot => ({
    position: { x: 0, y: 0, z: 0 },
    yaw: 0,
    speed: 0,
    distance: 0,
    state: 'idle',
    stateTimeS: 0,
  });
  return {
    id: 1,
    definition: enemySchema.parse(raw),
    previous: snapshot(),
    current: snapshot(),
    removed: false,
    step() {},
    dispose() {},
  };
}
function view(e: Enemy, models = false) {
  const v = new EnemyView(e, models);
  views.push(v);
  return v;
}

it('interpolates position and shortest yaw, animates fallback joints and hides killed enemies', () => {
  const e = enemy();
  const v = view(e);
  e.previous.yaw = Math.PI - 0.1;
  e.current.yaw = -Math.PI + 0.1;
  e.current.position = { x: 2, y: 4, z: 6 };
  v.render(0.5);
  expect(v.root.position.toArray()).toEqual([1, 2, 3]);
  expect(v.root.rotation.y).toBeCloseTo(Math.PI);
  e.current.state = 'chase';
  e.current.speed = raw.moveSpeed;
  e.current.distance = raw.animation.strideM / 4;
  v.render(1);
  expect(v.root.getObjectByName('leg_upper_L')?.rotation.x).toBeCloseTo(
    raw.animation.walkAngle,
  );
  expect(v.root.getObjectByName('leg_upper_R')?.rotation.x).toBeCloseTo(
    -raw.animation.walkAngle,
  );
  e.current.speed = 0;
  e.current.state = 'telegraph';
  e.current.stateTimeS = raw.telegraphS;
  v.render(1);
  expect(v.root.getObjectByName('arm_upper_R')?.rotation.x).toBeCloseTo(
    raw.animation.telegraphAngle,
  );
  expect(v.root.getObjectByName('baton_tip')?.scale.x).toBeGreaterThan(1);
  e.current.state = 'swing';
  e.current.stateTimeS = raw.swingActiveS;
  v.render(1);
  expect(v.root.getObjectByName('arm_upper_R')?.rotation.x).toBeCloseTo(
    raw.animation.swingAngle,
  );
  e.current.state = 'stunned';
  v.render(1);
  expect(v.root.getObjectByName('pelvis')?.rotation.z).toBeCloseTo(
    raw.animation.stunAngle,
  );
  e.current.state = 'dead';
  v.render(1);
  expect(v.root.visible).toBe(false);
});

it('loads GLB once, clones joints independently, preserves tip scale and keeps shared geometry/materials alive', async () => {
  const source = new Group();
  source.name = 'test-rig';
  const pelvis = new Group();
  pelvis.name = 'pelvis';
  source.add(pelvis);
  const arm = new Group();
  arm.name = 'arm_upper_R';
  arm.rotation.x = 0.1;
  pelvis.add(arm);
  const tip = new Group();
  tip.name = 'baton_tip';
  tip.scale.set(2, 3, 4);
  arm.add(tip);
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial();
  material.name = 'mat_enemy';
  source.add(new Mesh(geometry, material));
  const disposeGeometry = vi.spyOn(geometry, 'dispose');
  const disposeStyle = vi.spyOn(getMaterial('enemy'), 'dispose');
  const load = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockResolvedValue({ scene: source } as GLTF);
  const a = enemy();
  const b = enemy();
  const va = view(a, true);
  const vb = view(b, true);
  await vi.waitFor(() =>
    expect(va.root.getObjectByName('test-rig')).toBeDefined(),
  );
  expect(load).toHaveBeenCalledOnce();
  expect(va.root.getObjectByName('arm_upper_R')).not.toBe(
    vb.root.getObjectByName('arm_upper_R'),
  );
  a.current.state = 'telegraph';
  a.current.stateTimeS = raw.telegraphS;
  va.render(1);
  vb.render(1);
  expect(va.root.getObjectByName('arm_upper_R')?.rotation.x).toBeCloseTo(
    0.1 + raw.animation.telegraphAngle,
  );
  expect(vb.root.getObjectByName('arm_upper_R')?.rotation.x).toBeCloseTo(0.1);
  expect(source.getObjectByName('arm_upper_R')?.rotation.x).toBeCloseTo(0.1);
  expect(va.root.getObjectByName('baton_tip')?.scale.x).toBeGreaterThan(2);
  expect(vb.root.getObjectByName('baton_tip')?.scale.toArray()).toEqual([
    2, 3, 4,
  ]);
  a.current.state = 'idle';
  va.render(1);
  expect(va.root.getObjectByName('baton_tip')?.scale.toArray()).toEqual([
    2, 3, 4,
  ]);
  const late = view(enemy(), true);
  late.dispose();
  await Promise.resolve();
  expect(late.root.children).toHaveLength(0);
  va.dispose();
  vb.dispose();
  expect(disposeGeometry).not.toHaveBeenCalled();
  expect(disposeStyle).not.toHaveBeenCalled();
});
