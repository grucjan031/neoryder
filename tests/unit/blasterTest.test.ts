import { afterEach, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene as ThreeScene,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { BlasterTest } from '../../src/scenes/blasterTest';
import { scenes } from '../../src/scenes';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import type { InputSnapshot } from '../../src/core/input';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { getMaterial } from '../../src/render/materials';

const input: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const active: BlasterTest[] = [];
afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
  vi.restoreAllMocks();
});

it('registers the scene, shoots queued rounds at dummies, respawns and disposes', async () => {
  expect((await scenes['blaster-test']?.())?.().id).toBe('blaster-test');
  const scene = new BlasterTest(false);
  const three = new ThreeScene();
  const camera = new PerspectiveCamera();
  const commands = new CommandRegistry();
  const bus = new EventBus();
  await scene.init(
    {
      bus,
      rng: new Rng('blaster-scene'),
      loop: new GameLoop({ step: () => {}, render: () => {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera,
      commands,
    },
    three,
  );
  active.push(scene);
  for (const invalid of [
    'fire',
    'fire -1',
    'fire NaN',
    'fire 1.5',
    'fire 3 extra',
  ])
    commands.execute(invalid);
  scene.step(SIM_DT, input);
  expect(scene.query('shots')).toBe(0);
  expect(scene.query('dummyHp')).toEqual([100, 100, 100]);
  commands.execute('fire 3');
  for (let i = 0; i < 40; i++) scene.step(SIM_DT, input);
  scene.render(0.5);
  expect(scene.query('shots')).toBe(3);
  const hp = scene.query('dummyHp') as number[];
  expect(hp[1]).toBeLessThan(100);
  expect(hp[0]).toBe(100);
  expect(hp[2]).toBe(100);
  commands.execute('overheat');
  expect(scene.query('overheated')).toBe(true);
  expect(scene.query('heat')).toBe(100);
  scene.step(0, input);
  expect(scene.query('heat')).toBe(100);
  expect(commands.execute('heat')).toContain('100');
  for (let i = 0; i < 90; i++) scene.step(SIM_DT, input);
  expect(scene.query('overheated')).toBe(false);
  commands.execute('fire 2');
  for (let i = 0; i < 40; i++) scene.step(SIM_DT, input);
  expect(scene.query('dummyHp')).toEqual([100, 0, 100]);
  for (let i = 0; i < 90; i++) scene.step(SIM_DT, input);
  expect(scene.query('dummyHp')).toEqual([100, 100, 100]);
  expect(scene.query('activeProjectiles')).toBe(0);
  expect(scene.query('missing')).toBeUndefined();
  const shared = getMaterial('player');
  let disposed = false;
  const listener = () => {
    disposed = true;
  };
  shared.addEventListener('dispose', listener);
  scene.dispose();
  active.splice(active.indexOf(scene), 1);
  shared.removeEventListener('dispose', listener);
  expect(disposed).toBe(false);
  expect(three.children).toHaveLength(0);
  expect(camera.children).toHaveLength(0);
  expect(commands.help()).toBe('');
});

it('uses the mapped left mouse attack action for held fire', async () => {
  const scene = new BlasterTest(false);
  await scene.init(
    {
      bus: new EventBus(),
      rng: new Rng('held'),
      loop: new GameLoop({ step: () => {}, render: () => {} }),
      tuning: structuredClone(tuning),
      debug: false,
    },
    new ThreeScene(),
  );
  active.push(scene);
  for (let i = 0; i < 60; i++)
    scene.step(SIM_DT, { ...input, held: new Set(['attack']) });
  expect(scene.query('shots')).toBe(6);
  for (let i = 0; i < 60 && !scene.query('overheated'); i++)
    scene.step(SIM_DT, { ...input, held: new Set(['attack', 'coolWeapon']) });
  expect(scene.query('coolingPhase')).toBe('waiting');
  for (
    let i = 0;
    i < Math.round(tuning.weapons.activeCooling.windowStartS / SIM_DT);
    i++
  )
    scene.step(SIM_DT, { ...input, held: new Set(['coolWeapon']) });
  expect(scene.query('coolingPhase')).toBe('window');
  scene.step(SIM_DT, { ...input, pressed: new Set(['coolWeapon']) });
  expect(scene.query('coolingPhase')).toBe('success');
});

it('styles loaded models, changes local heat neons and disposes source and local materials', async () => {
  const sources: MeshBasicMaterial[] = [];
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(
    async (url) => {
      const model = new Group();
      const names = String(url).includes('blaster')
        ? ['frame', 'heat_vents', 'heat_cell']
        : ['torso'];
      for (const name of names) {
        const material = new MeshBasicMaterial();
        material.name = name.startsWith('heat_')
          ? 'mat_player_cyan'
          : 'mat_interactive';
        vi.spyOn(material, 'dispose');
        sources.push(material);
        const mesh = new Mesh(new BoxGeometry(), material);
        mesh.name = name;
        model.add(mesh);
      }
      return { scene: model } as GLTF;
    },
  );
  const scene = new BlasterTest();
  const three = new ThreeScene();
  const camera = new PerspectiveCamera();
  const commands = new CommandRegistry();
  await scene.init(
    {
      bus: new EventBus(),
      rng: new Rng('models'),
      loop: new GameLoop({ step: () => {}, render: () => {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera,
      commands,
    },
    three,
  );
  active.push(scene);
  const vents = camera.getObjectByName('heat_vents') as Mesh<
    BoxGeometry,
    MeshBasicMaterial
  >;
  const cell = camera.getObjectByName('heat_cell') as Mesh<
    BoxGeometry,
    MeshBasicMaterial
  >;
  expect(vents.material.color).toEqual(new Color(tuning.render.player));
  expect(vents.material).not.toBe(getMaterial('player'));
  commands.execute('overheat');
  scene.render(1);
  expect(vents.material.color.getHexString()).toBe(
    new Color(tuning.render.enemy).getHexString(),
  );
  expect(cell.material.color).toEqual(vents.material.color);
  expect(getMaterial('player').color).toEqual(new Color(tuning.render.player));
  const dispose = vi.spyOn(vents.material, 'dispose');
  const instances: InstancedMesh[] = [];
  three.traverse((object) => {
    if (object instanceof InstancedMesh) instances.push(object);
  });
  expect(instances).toHaveLength(2);
  expect(instances.map((mesh) => mesh.instanceMatrix.count)).toEqual([
    256, 256,
  ]);
  scene.dispose();
  active.splice(active.indexOf(scene), 1);
  expect(dispose).toHaveBeenCalledOnce();
  for (const material of sources)
    expect(material.dispose).toHaveBeenCalledOnce();
});
