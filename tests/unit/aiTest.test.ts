import { afterEach, expect, it } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { AiTest, createStatusTest } from '../../src/scenes/aiTest';
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
async function setup(scene: AiTest = new AiTest(false)) {
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
  expect(scene.query('enemies')).toBe(3);
  expect(scene.query('playerHp')).toBe(100);
  expect(scene.query('enemyStates')).toHaveLength(3);
  commands.execute('spawn assaulter 2');
  expect(scene.query('enemies')).toBe(5);
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
  expect(scene.query('enemies')).toBe(5);
  commands.execute('hit 1000');
  for (let i = 0; i < 35; i++) scene.step(SIM_DT, input);
  scene.render(0.5);
  expect(scene.query('enemies')).toBe(0);
  scene.reset();
  expect(scene.query('enemies')).toBe(3);
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
  expect(scene.query('enemies')).toBe(3);
});

it('shares projectiles with spawned gunners, applies ranged damage and clears shots on reset', async () => {
  const { scene, commands, bus } = await setup();
  commands.execute('kill all');
  commands.execute('spawn gunner 1');
  expect(scene.query('enemies')).toBe(1);
  const shots = new Set<number>();
  bus.on('projectile_spawned', ({ id, team }) => {
    expect(team).toBe('enemy');
    shots.add(id);
  });
  bus.on('entity_despawned', ({ id }) => shots.delete(id));
  for (let i = 0; i < 300 && scene.query('playerHp') === 100; i++)
    scene.step(SIM_DT, input);
  expect(scene.query('playerHp')).toBe(88);
  expect(shots.size).toBeGreaterThan(0);
  scene.reset();
  expect(shots.size).toBe(0);
  expect(scene.query('enemies')).toBe(3);
  expect(scene.query('playerHp')).toBe(100);
});

it('coordinates enemies through the EnemyDirector from scene data (F2-12)', async () => {
  const { scene, commands } = await setup();
  commands.execute('god');
  commands.execute('spawn assaulter 4');
  for (let i = 0; i < 3 / SIM_DT; i++) scene.step(SIM_DT, input);
  const snapshot = scene.query('director') as {
    tokens: { melee: number[]; shot: number[] };
    slots: { melee: (number | null)[] };
  };
  expect(snapshot.tokens.melee.length).toBeLessThanOrEqual(2);
  expect(snapshot.tokens.shot.length).toBeLessThanOrEqual(1);
  expect(snapshot.slots.melee.some((id) => id !== null)).toBe(true);
  expect(commands.execute('director')).toMatch(/^Tokeny wręcz: /);
  const states = scene.query('enemyStates') as { state: string }[];
  expect(
    states.filter((e) => e.state === 'telegraph' || e.state === 'swing').length,
  ).toBeLessThanOrEqual(2);
});

it('status-test applies statuses with the debug command; stunned enemies stop attacking (F2-02)', async () => {
  expect(scenes['status-test']?.().id).toBe('status-test');
  const { scene, commands, bus } = await setup(createStatusTest(false));
  expect(scene.id).toBe('status-test');
  for (const bad of [
    'status',
    'status missing',
    'status burning 0',
    'status burning x',
    'status burning 1 2',
  ])
    expect(commands.execute(bad)).toMatch(/Podaj/);
  commands.execute('god');
  // Wrogowie podchodzą i zaczynają atakować.
  for (let i = 0; i < 2 / SIM_DT; i++) scene.step(SIM_DT, input);
  const telegraphs: number[] = [];
  bus.on('enemy_telegraph', ({ id }) => telegraphs.push(id));
  expect(commands.execute('status stunned 2')).toMatch(/wrogów: 4/);
  scene.step(SIM_DT, input);
  const states = () => scene.query('enemyStates') as { state: string }[];
  expect(states().every((e) => e.state === 'stunned')).toBe(true);
  for (let i = 0; i < 1.5 / SIM_DT; i++) scene.step(SIM_DT, input);
  expect(states().every((e) => e.state === 'stunned')).toBe(true);
  expect(telegraphs).toEqual([]);
  for (let i = 0; i < 1 / SIM_DT; i++) scene.step(SIM_DT, input);
  expect(states().some((e) => e.state !== 'stunned')).toBe(true);

  const discharged: number[] = [];
  bus.on('damage_dealt', ({ target, tags }) => {
    if (tags.includes('#status')) discharged.push(target);
  });
  for (let i = 0; i < 3; i++) commands.execute('status overload 5');
  expect(discharged.length).toBeGreaterThan(0);
  scene.reset();
  expect(scene.query('enemies')).toBe(4);
  commands.execute('status burning 1');
  const before = discharged.length;
  scene.reset();
  for (let i = 0; i < 1 / SIM_DT; i++) scene.step(SIM_DT, input);
  // Reset zdejmuje podpalenie — żadnych tików po nowym starcie.
  expect(discharged.length).toBe(before);
});
