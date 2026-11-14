// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import * as powers from '../../src/combat/powers/registry';
import { Scene as ThreeScene } from 'three';
import { EventBus } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { MeleeTest, ParryTest, PushTest } from '../../src/scenes/meleeTest';
import { CommandRegistry } from '../../src/ui/debugCommands';
import data from '../../src/data/scenes/pushTest.json';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const first: InputSnapshot = { ...idle, pressed: new Set(['power']) };
const second: InputSnapshot = { ...idle, pressed: new Set(['power2']) };
const active: MeleeTest[] = [];

afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
});

async function setup(scene: MeleeTest = new PushTest(false)) {
  const bus = new EventBus();
  const commands = new CommandRegistry();
  const three = new ThreeScene();
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('push-scene'),
      debug: false,
      loop: new GameLoop({ step: () => {}, render: () => {} }),
      tuning: structuredClone(tuning),
    },
    three,
  );
  active.push(scene);
  return { scene, commands, bus, three };
}

it('wczytuje sloty i manekiny z danych, F zachowuje odrzut i 40 obrażeń na ścianie', async () => {
  const { scene } = await setup();
  expect(scene.query('powerSlots')).toEqual(data.slots);
  expect(scene.query('dummyPos')).toEqual(data.dummyPositions);
  scene.step(SIM_DT, first);
  expect(scene.query('energy')).toBe(75);
  expect(scene.query('dummyHp')).toEqual([100, 90, 100, 100, 100]);
  for (let i = 0; i < 15; i++) scene.step(SIM_DT, idle);
  expect(scene.query('dummyHp')).toEqual([100, 60, 100, 100, 100]);
  const positions = scene.query('dummyPos') as { z: number }[];
  expect(positions[1]?.z).toBeLessThan(data.dummyPositions[1]!.z - 1);
  expect(document.querySelector('.hint')?.textContent).toContain(data.controls);
});

it('E kolejkuje Falę w hitstopie i trafia także manekiny za graczem', async () => {
  const { scene } = await setup();
  scene.step(0, second);
  scene.step(0, idle);
  expect(scene.query('dummyHp')).toEqual([100, 100, 100, 100, 100]);
  expect(scene.query('energy')).toBe(100);
  scene.step(SIM_DT, idle);
  expect(scene.query('dummyHp')).toEqual([90, 90, 90, 90, 90]);
  expect(scene.query('energy')).toBe(60);
  expect(scene.query('powerCooldowns')).toEqual([0, 1.5]);
  scene.reset();
  expect(scene.query('powerCooldowns')).toEqual([0, 0]);
  expect(scene.query('dummyPos')).toEqual(data.dummyPositions);
  scene.step(0, second);
  scene.reset();
  scene.step(SIM_DT, idle);
  expect(scene.query('dummyHp')).toEqual([100, 100, 100, 100, 100]);
});

it('komenda power wymienia wybrany slot, sprawdza argumenty i sprząta się z końcem sceny', async () => {
  const { scene, commands, three } = await setup();
  for (const invalid of [
    'power',
    'power 0 push',
    'power 3 push',
    'power 1 missing',
    'power 2 shockwave extra',
  ]) {
    expect(commands.execute(invalid)).toContain('Dostępne moce:');
    expect(scene.query('powerSlots')).toEqual(data.slots);
  }
  expect(commands.execute('power 1 shockwave')).toContain('Fala uderzeniowa');
  expect(scene.query('powerSlots')).toEqual(['shockwave', 'shockwave']);
  scene.step(SIM_DT, first);
  expect(scene.query('dummyHp')).toEqual([90, 90, 90, 90, 90]);
  expect(commands.execute('power 2 push')).toContain('Pchnięcie');
  expect(scene.query('powerSlots')).toEqual(['shockwave', 'push']);
  expect(scene.query('powerCooldowns')).toEqual([1.5, 0]);
  scene.step(0, first);
  commands.execute('power 1 push');
  scene.step(SIM_DT, idle);
  expect(scene.query('energy')).toBe(60);
  scene.dispose();
  active.splice(active.indexOf(scene), 1);
  expect(commands.help()).toBe('');
  expect(document.querySelector('.hint')).toBeNull();
  expect(three.children).toHaveLength(0);
});

it.each([MeleeTest, ParryTest])(
  'sceny F1 zachowują trzy manekiny i samo Pchnięcie',
  async (SceneType) => {
    const { scene, commands } = await setup(new SceneType(false));
    expect(scene.query('dummyHp')).toEqual([100, 100, 100]);
    expect(commands.help()).not.toContain('power <');
    scene.step(SIM_DT, second);
    expect(scene.query('energy')).toBe(100);
    scene.step(SIM_DT, first);
    expect(scene.query('dummyHp')).toEqual([100, 90, 100]);
    expect(scene.query('energy')).toBe(75);
  },
);

it('komenda power obsługuje Barierę i zwraca komunikat po błędzie fabryki bez wymiany slotu', async () => {
  const { scene, commands } = await setup();
  expect(commands.execute('power 1 barrier')).toContain('Bariera');
  expect(scene.query('powerSlots')).toEqual(['barrier', 'shockwave']);
  scene.step(SIM_DT, first);
  expect(scene.query('energy')).toBe(80);
  const factory = vi.spyOn(powers, 'createPower').mockImplementationOnce(() => {
    throw new Error('Brak zależności sceny.');
  });
  try {
    expect(commands.execute('power 1 focus')).toContain(
      'Scena nie obsługuje mocy focus: Brak zależności sceny.',
    );
    expect(scene.query('powerSlots')).toEqual(['barrier', 'shockwave']);
  } finally {
    factory.mockRestore();
  }
});
