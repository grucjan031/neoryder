import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { BossTest } from '../../src/scenes/bossTest';
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
let active: BossTest | undefined;
afterEach(() => {
  active?.dispose();
  active = undefined;
});

it('registers boss-test, starts with only the boss, changes phases, resets and cleans up commands/world', async () => {
  expect(scenes['boss-test']?.().id).toBe('boss-test');
  const scene = new BossTest(false);
  const commands = new CommandRegistry(),
    bus = new EventBus(),
    three = new ThreeScene();
  const spawned = vi.fn(),
    phase = vi.fn();
  bus.on('boss_spawned', spawned);
  bus.on('boss_phase', phase);
  await scene.init(
    {
      bus,
      rng: new Rng('boss-test'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera: new PerspectiveCamera(),
      commands,
    },
    three,
  );
  active = scene;
  expect(scene.query('enemies')).toBe(1);
  expect(scene.query('bosses')).toEqual([
    { id: expect.any(Number), phase: 1, hp: 900 },
  ]);
  expect(spawned).toHaveBeenCalledOnce();
  expect(phase).not.toHaveBeenCalled();
  for (const bad of [
    'boss phase',
    'boss phase 0',
    'boss phase 4',
    'boss phase 1.5',
    'boss phase 2 extra',
  ])
    expect(commands.execute(bad)).toMatch(/Podaj/);
  expect(commands.execute('boss phase 2')).toBe('Faza bossa: 2');
  expect(scene.query('bosses')).toEqual([
    { id: expect.any(Number), phase: 2, hp: 585 },
  ]);
  commands.execute('hit 9999');
  expect(scene.query('enemies')).toBe(1);
  commands.execute('god');
  for (let i = 0; i < 80; i++) scene.step(SIM_DT, input);
  commands.execute('kill all');
  expect(scene.query('bosses')).toEqual([
    { id: expect.any(Number), phase: 3, hp: 270 },
  ]);
  scene.render(0.5);
  scene.reset();
  expect(scene.query('bosses')).toEqual([
    { id: expect.any(Number), phase: 1, hp: 900 },
  ]);
  expect(spawned).toHaveBeenCalledTimes(2);
  scene.dispose();
  active = undefined;
  expect(three.children).toHaveLength(0);
  expect(commands.help()).toBe('');
});

it('boss pattern summon|shield wymusza wzorce: wezwanie tworzy Tarczowników wokół bossa', async () => {
  const scene = new BossTest(false);
  const commands = new CommandRegistry();
  await scene.init(
    {
      bus: new EventBus(),
      rng: new Rng('boss-pattern'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera: new PerspectiveCamera(),
      commands,
    },
    new ThreeScene(),
  );
  active = scene;
  for (const bad of [
    'boss pattern',
    'boss pattern slam',
    'boss pattern summon x',
  ])
    expect(commands.execute(bad)).toMatch(/Podaj/);
  commands.execute('god');
  expect(commands.execute('boss pattern summon')).toBe('Wzorzec bossa: summon');
  for (let i = 0; i < 80; i++) scene.step(SIM_DT, input);
  expect(scene.query('enemies')).toBe(3);
  expect(commands.execute('boss pattern shield')).toBe('Wzorzec bossa: shield');
  commands.execute('kill all');
  for (let i = 0; i < 5; i++) scene.step(SIM_DT, input);
  // kill all zabija sługi; boss ginie dopiero po trzech progach faz.
  expect(scene.query('enemies')).toBe(1);
});
