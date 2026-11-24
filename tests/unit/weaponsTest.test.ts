// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Group, Mesh, PerspectiveCamera, Scene as ThreeScene } from 'three';
import { WeaponsTest } from '../../src/scenes/weaponsTest';
import { scenes } from '../../src/scenes';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import type { InputSnapshot } from '../../src/core/input';
import { getMaterial } from '../../src/render/materials';
import data from '../../src/data/scenes/weaponsTest.json';

const input: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const firing: InputSnapshot = { ...input, held: new Set(['attack']) };
const active: WeaponsTest[] = [];

afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
  vi.restoreAllMocks();
});

async function setup(debug = false) {
  const scene = new WeaponsTest();
  const three = new ThreeScene();
  const camera = new PerspectiveCamera();
  const cameraParent = new Group();
  cameraParent.add(camera);
  const cameraChild = new Group();
  camera.add(cameraChild);
  const commands = new CommandRegistry();
  const bus = new EventBus();
  const settings = structuredClone(tuning);
  await scene.init(
    {
      bus,
      rng: new Rng('weapons-scene'),
      loop: new GameLoop({ step: () => {}, render: () => {} }),
      tuning: settings,
      debug,
      camera,
      commands,
    },
    three,
  );
  active.push(scene);
  return {
    scene,
    three,
    camera,
    cameraParent,
    cameraChild,
    commands,
    bus,
    settings,
  };
}

it('test ADS optyki używa czasu wejścia, FOV lunety i płynnego wyjścia', async () => {
  const { scene, camera, commands, settings } = await setup(true);
  expect(commands.execute('ads optic scope')).toBe('Optyka: scope');
  expect(commands.execute('ads guide on')).toBe('Krzyż włączony.');
  const aiming: InputSnapshot = { ...input, held: new Set(['aim']) };
  scene.step(SIM_DT, aiming);
  scene.render(1);
  expect(camera.fov).toBeLessThan(settings.camera.fov);
  expect(camera.fov).toBeGreaterThan(settings.camera.fov * 0.5);
  for (let t = SIM_DT; t < settings.player.aim.inS * 1.6; t += SIM_DT)
    scene.step(SIM_DT, aiming);
  scene.render(1);
  expect(camera.fov).toBeCloseTo(settings.camera.fov * 0.5, 6);
  scene.step(SIM_DT, input);
  scene.render(1);
  expect(camera.fov).toBeGreaterThan(settings.camera.fov * 0.5);
  expect(camera.fov).toBeLessThan(settings.camera.fov);
});

it('registers, loads scene data, switches on weapon1..3 pressed and retains heat per weapon', async () => {
  expect((await scenes['weapons-test']?.())?.().id).toBe('weapons-test');
  const { scene, commands } = await setup();
  expect(scene.query('slots')).toEqual(data.slots);
  expect(scene.query('weapon')).toBe('pistol');
  expect(scene.query('dummyHp')).toEqual(
    data.dummyPositions.map(() => data.dummy.maxHealth),
  );
  scene.step(0, firing);
  expect(scene.query('shots')).toBe(0);
  scene.step(SIM_DT, firing);
  expect(scene.query('heat')).toBe(9);
  scene.step(SIM_DT, { ...input, held: new Set(['weapon2']) });
  expect(scene.query('weapon')).toBe('pistol');
  scene.step(SIM_DT, { ...input, pressed: new Set(['weapon2']) });
  expect(scene.query('slot')).toBe(1);
  expect(scene.query('weapon')).toBe('rifle');
  expect(scene.query('heat')).toBe(0);
  scene.step(SIM_DT, firing);
  expect(scene.query('heat')).toBe(10);
  scene.step(SIM_DT, { ...input, pressed: new Set(['weapon3']) });
  expect(scene.query('weapon')).toBe('scatter');
  scene.step(SIM_DT, firing);
  expect(scene.query('heat')).toBe(28);
  expect(scene.query('activeProjectiles')).toBeGreaterThanOrEqual(8);
  scene.step(SIM_DT, { ...input, pressed: new Set(['weapon1']) });
  expect(scene.query('heat')).toBe(9);
  expect(scene.query('weaponHeat')).toEqual({
    beam: 0,
    blaster: 0,
    crossbow: 0,
    emp: 0,
    revolver: 0,
    smg: 0,
    pistol: 9,
    rifle: 10,
    scatter: 28,
    sniper: 0,
  });
  expect(commands.execute('heat')).toContain('9');
  commands.execute('overheat');
  expect(scene.query('overheated')).toBe(true);
  scene.step(SIM_DT, { ...input, pressed: new Set(['weapon2']) });
  expect(scene.query('overheated')).toBe(false);
  for (let i = 0; i < 120; i++) scene.step(SIM_DT, input);
  scene.step(SIM_DT, { ...input, pressed: new Set(['weapon1']) });
  expect(scene.query('overheated')).toBe(false);
  expect(scene.query('heat')).toBeLessThan(100);
});

it('weapon command replaces only the active slot, validates ids and reuses weapon heat', async () => {
  const { scene, commands } = await setup();
  for (const invalid of ['weapon', 'weapon missing', 'weapon sniper extra']) {
    expect(commands.execute(invalid)).toContain('Dostępne bronie:');
    expect(scene.query('slots')).toEqual(data.slots);
  }
  expect(commands.execute('weapon sniper')).toContain('Snajperka');
  expect(scene.query('slots')).toEqual(['sniper', 'rifle', 'scatter']);
  scene.step(SIM_DT, firing);
  expect(scene.query('heat')).toBe(45);
  commands.execute('weapon pistol');
  scene.step(SIM_DT, input);
  scene.step(SIM_DT, firing);
  expect(scene.query('heat')).toBe(9);
  commands.execute('weapon sniper');
  expect(scene.query('heat')).toBe(45);
  scene.render(0.5);
  const hud = document.querySelector('[aria-label="Broń i ciepło"]');
  expect(hud?.textContent).toContain('Snajperka');
  expect(hud?.textContent).toContain('45 / 100');
  expect(hud?.textContent).toContain(data.controls);
});

it('fires a piercing round through the row, leaves the dummy behind the wall unharmed, respawns and cleans up', async () => {
  const { scene, three, camera, cameraParent, cameraChild, commands, bus } =
    await setup();
  commands.execute('weapon sniper');
  scene.step(SIM_DT, firing);
  for (let i = 0; i < 15; i++) scene.step(SIM_DT, firing);
  expect(scene.query('shots')).toBe(1);
  expect(scene.query('dummyHp')).toEqual([20, 40, 55, 100]);
  expect(scene.query('activeProjectiles')).toBe(0);
  for (let i = 0; i < 60; i++) scene.step(SIM_DT, input);
  scene.step(SIM_DT, firing);
  for (let i = 0; i < 15; i++) scene.step(SIM_DT, input);
  expect(scene.query('dummyHp')).toEqual([0, 0, 10, 100]);
  for (let i = 0; i < 120; i++) scene.step(SIM_DT, input);
  expect(scene.query('dummyHp')).toEqual([100, 100, 10, 100]);
  expect(scene.query('missing')).toBeUndefined();
  scene.render(0.5);
  const sharedDispose = vi.spyOn(getMaterial('interactive'), 'dispose');
  const geometries = new Set<Mesh['geometry']>();
  three.traverse((object) => {
    if (object instanceof Mesh) geometries.add(object.geometry);
  });
  const disposedGeometry = [...geometries].map((geometry) =>
    vi.spyOn(geometry, 'dispose'),
  );
  const despawn = vi.fn();
  bus.on('entity_despawned', despawn);
  commands.execute('weapon rifle');
  scene.step(SIM_DT, firing);
  expect(scene.query('activeProjectiles')).toBeGreaterThan(0);
  scene.dispose();
  active.splice(active.indexOf(scene), 1);
  expect(sharedDispose).not.toHaveBeenCalled();
  for (const spy of disposedGeometry) expect(spy).toHaveBeenCalledOnce();
  expect(three.children).toHaveLength(0);
  expect(camera.parent).toBe(cameraParent);
  expect(camera.children).toEqual([cameraChild]);
  expect(commands.help()).toBe('');
  expect(document.querySelector('[aria-label="Broń i ciepło"]')).toBeNull();
  expect(despawn).toHaveBeenCalledTimes(6);
});

it('exposes beam and EMP through commands, ticks laser damage and shows overload from the grenade', async () => {
  const { scene, commands, bus } = await setup();
  expect(commands.execute('weapon beam')).toContain('Laser ciągły');
  for (let i = 0; i < 60; i++) scene.step(SIM_DT, firing);
  expect(scene.query('dummyHp')).toEqual([60, 100, 100, 100]);
  expect(scene.query('beam')).toMatchObject({ active: true });
  scene.step(0, firing);
  expect(scene.query('dummyHp')).toEqual([60, 100, 100, 100]);
  commands.execute('weapon emp');
  const explosion = vi.fn();
  bus.on('explosion', explosion);
  scene.step(SIM_DT, firing);
  for (let i = 0; i < 120; i++) scene.step(SIM_DT, input);
  expect(explosion).toHaveBeenCalledTimes(1);
  const statuses = scene.query('dummyStatuses') as {
    id: string;
    stacks: number;
  }[][];
  expect(statuses.flat()).toContainEqual(
    expect.objectContaining({ id: 'overload', stacks: 2 }),
  );
  scene.render(1, 0.15);
  expect(
    document.querySelector('[aria-label="Broń i ciepło"]')?.textContent,
  ).toContain('overload');
});

it('beam range and the first wall collider protect the dummy behind the wall', async () => {
  const { scene, commands, bus, settings } = await setup();
  settings.damage.respawnS = 100;
  // Remove the three foreground hurtboxes until their normal respawn.
  commands.execute('weapon sniper');
  scene.step(SIM_DT, firing);
  for (let i = 0; i < 76; i++) scene.step(SIM_DT, input);
  scene.step(SIM_DT, firing);
  for (let i = 0; i < 76; i++) scene.step(SIM_DT, input);
  scene.step(SIM_DT, firing);
  for (let i = 0; i < 10; i++) scene.step(SIM_DT, input);
  commands.execute('weapon beam');
  scene.step(SIM_DT, firing);
  const beam = scene.query('beam') as {
    from: { z: number };
    to: { z: number };
  };
  expect(beam.from.z - beam.to.z).toBeCloseTo(12);
  const dealt = vi.fn();
  bus.on('damage_dealt', dealt);
  const moving: InputSnapshot = {
    ...input,
    held: new Set(['moveForward', 'attack']),
  };
  for (let i = 0; i < 30; i++) scene.step(SIM_DT, moving);
  const closeBeam = scene.query('beam') as {
    from: { z: number };
    to: { z: number };
  };
  expect(closeBeam.to.z).toBeCloseTo(-10.75);
  expect(closeBeam.from.z - closeBeam.to.z).toBeLessThan(12);
  expect(scene.query('dummyHp')).toEqual([0, 0, 0, 100]);
  expect(dealt).not.toHaveBeenCalled();
});
