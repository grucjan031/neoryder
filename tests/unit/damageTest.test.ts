import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { DamageTest } from '../../src/scenes/damageTest';
import { scenes } from '../../src/scenes';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import type { InputSnapshot } from '../../src/core/input';

const input: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const active: DamageTest[] = [];
afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
});
async function setup() {
  const scene = new DamageTest(false);
  const three = new ThreeScene();
  const commands = new CommandRegistry();
  const bus = new EventBus();
  const settings = structuredClone(tuning);
  await scene.init(
    {
      bus,
      rng: new Rng('damage-test'),
      loop: new GameLoop({ step: () => {}, render: () => {} }),
      tuning: settings,
      debug: false,
      camera: new PerspectiveCamera(),
      commands,
    },
    three,
  );
  active.push(scene);
  return { scene, three, commands, bus, settings };
}

it('registers the scene and applies hit, block and heal through damage events', async () => {
  expect(scenes['damage-test']?.().id).toBe('damage-test');
  const { scene, commands, bus } = await setup();
  const health = vi.fn();
  bus.on('health_changed', health);
  commands.execute('hit 30');
  expect(scene.query('dummyHp')).toBe(70);
  expect(scene.query('lastDamage')).toMatchObject({
    amount: 30,
    tags: ['#debug'],
    point: { x: 0, y: 1.2, z: 0 },
    dir: { x: 0, y: 0, z: -1 },
    killed: false,
  });
  commands.execute('block on');
  commands.execute('block on');
  commands.execute('hit 40');
  expect(scene.query('dummyHp')).toBe(58);
  commands.execute('block off');
  commands.execute('hit 8');
  expect(scene.query('dummyHp')).toBe(50);
  for (const command of [
    'hit -1',
    'hit NaN',
    'hit Infinity',
    'hit',
    'hit 5 extra',
    'block invalid',
  ])
    commands.execute(command);
  expect(scene.query('dummyHp')).toBe(50);
  commands.execute('heal');
  expect(scene.query('dummyHp')).toBe(100);
  expect(health).toHaveBeenLastCalledWith(
    expect.objectContaining({ current: 100, max: 100 }),
  );
});

it('queries both hurtboxes with real Rapier, strikes once per hitbox and allows a new slash', async () => {
  const { scene, commands, bus } = await setup();
  const dealt = vi.fn();
  bus.on('damage_dealt', dealt);
  commands.execute('slash');
  expect(scene.query('dummyHp')).toBe(62.5);
  for (let i = 0; i < 8; i++) scene.step(SIM_DT, input);
  expect(scene.query('dummyHp')).toBe(62.5);
  expect(dealt).toHaveBeenCalledTimes(1);
  commands.execute('slash');
  expect(scene.query('dummyHp')).toBe(25);
  expect(dealt).toHaveBeenCalledTimes(2);
});

it('hides the dummy on death, respawns in simulation time and disposes subscriptions and assets', async () => {
  const { scene, three, commands, bus, settings } = await setup();
  const killed = vi.fn();
  bus.on('enemy_killed', killed);
  commands.execute('hit 1000');
  expect(scene.query('dummyAlive')).toBe(false);
  expect(scene.query('dummyHp')).toBe(0);
  expect(scene.query('lastDamage')).toMatchObject({
    amount: 100,
    killed: true,
  });
  commands.execute('hit 1000');
  expect(killed).toHaveBeenCalledOnce();
  scene.step(0, input);
  expect(scene.query('dummyAlive')).toBe(false);
  for (let i = 1; i < Math.round(settings.damage.respawnS / SIM_DT); i++)
    scene.step(SIM_DT, input);
  expect(scene.query('dummyAlive')).toBe(false);
  scene.step(SIM_DT, input);
  expect(scene.query('dummyAlive')).toBe(true);
  expect(scene.query('dummyHp')).toBe(100);
  commands.execute('slash');
  expect(scene.query('dummyHp')).toBe(62.5);
  expect(scene.query('missing')).toBeUndefined();
  scene.dispose();
  active.splice(active.indexOf(scene), 1);
  expect(three.children).toHaveLength(0);
  expect(commands.help()).toBe('');
});
