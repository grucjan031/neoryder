import { afterEach, expect, it } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { AiTest } from '../../src/scenes/aiTest';
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
const active: AiTest[] = [];
afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
});
async function setup() {
  const scene = new AiTest(false);
  const commands = new CommandRegistry();
  const bus = new EventBus();
  const three = new ThreeScene();
  await scene.init(
    {
      bus,
      rng: new Rng('ai-scene'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera: new PerspectiveCamera(),
      commands,
    },
    three,
  );
  active.push(scene);
  return { scene, commands, bus, three };
}

it('registers ai-test, handles commands/queries and disposes all owned resources', async () => {
  expect(scenes['ai-test']?.().id).toBe('ai-test');
  const { scene, commands, three } = await setup();
  expect(scene.query('enemies')).toBe(2);
  expect(scene.query('playerHp')).toBe(100);
  expect(scene.query('enemyStates')).toHaveLength(2);
  commands.execute('spawn assaulter 2');
  expect(scene.query('enemies')).toBe(4);
  for (const command of [
    'spawn missing',
    'spawn assaulter -1',
    'spawn assaulter 1.5',
    'spawn assaulter Infinity',
    'spawn assaulter 2 extra',
    'hit -1',
    'hit Infinity',
    'hit 3 extra',
  ])
    commands.execute(command);
  expect(scene.query('enemies')).toBe(4);
  commands.execute('hit 1000');
  for (let i = 0; i < 35; i++) scene.step(SIM_DT, input);
  scene.render(0.5);
  expect(scene.query('enemies')).toBe(0);
  scene.reset();
  expect(scene.query('enemies')).toBe(2);
  commands.execute('kill all');
  expect(scene.query('enemies')).toBe(0);
  expect(scene.query('missing')).toBeUndefined();
  scene.dispose();
  active.splice(active.indexOf(scene), 1);
  expect(three.children).toHaveLength(0);
  expect(commands.help()).toBe('');
});

it('god prevents damage immediately and player death resets the arena after one simulation second', async () => {
  const { scene, commands, bus } = await setup();
  commands.execute('god');
  for (let i = 0; i < 600; i++) scene.step(SIM_DT, input);
  expect(scene.query('playerHp')).toBe(100);
  commands.execute('god');
  let died: number | undefined;
  bus.on('player_died', ({ id }) => {
    died = id;
  });
  for (let i = 0; i < 2400 && died === undefined; i++)
    scene.step(SIM_DT, input);
  expect(died).toBeDefined();
  expect(scene.query('playerHp')).toBe(0);
  scene.step(0, input);
  expect(scene.query('playerHp')).toBe(0);
  for (let i = 0; i < 59; i++) scene.step(SIM_DT, input);
  expect(scene.query('playerHp')).toBe(0);
  scene.step(SIM_DT, input);
  expect(scene.query('playerHp')).toBe(100);
  expect(scene.query('enemies')).toBe(2);
});
