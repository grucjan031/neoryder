// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { Arena } from '../../src/scenes/arena';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';

const active: Arena[] = [];

afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
  window.history.replaceState(null, '', '/');
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function setup(query = '') {
  window.history.replaceState(null, '', `/?scene=arena${query}`);
  const scene = new Arena(false, true);
  await scene.init(
    {
      bus: new EventBus(),
      rng: new Rng('arena-blade'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera: new PerspectiveCamera(),
      resume: vi.fn(),
    },
    new ThreeScene(),
  );
  active.push(scene);
  const click = (selector: string) =>
    document.querySelector<HTMLButtonElement>(selector)!.click();
  return { scene, click };
}

it('domyślnie ostrze ekwipunku (plazmowe)', async () => {
  const { scene, click } = await setup();
  expect(scene.query('blade')).toBe('plasmaBlade');
  click('.build-select__card[data-loadout="blade"]');
  expect(scene.query('blade')).toBe('plasmaBlade');
});

it('wybór wariantu na ekranie buildu nadpisuje ostrze ekwipunku na run', async () => {
  const { scene, click } = await setup();
  click('[data-blade="twinBlades"]');
  click('.build-select__card[data-loadout="gunner"]');
  expect(scene.query('loadout')).toBe('gunner');
  expect(scene.query('blade')).toBe('twinBlades');
  expect(scene.chooseLoadout('resonance', 'staffBlade')).toBe(true);
  expect(scene.query('blade')).toBe('staffBlade');
});

it('?blade= nadpisuje ostrze ekwipunku jak ?loadout=', async () => {
  const { scene } = await setup('&loadout=blade&blade=staffBlade');
  expect(scene.query('loadout')).toBe('blade');
  expect(scene.query('blade')).toBe('staffBlade');
});

it('?blade= z nieznanym id jest ignorowane', async () => {
  const { scene } = await setup('&loadout=blade&blade=nieMa');
  expect(scene.query('blade')).toBe('plasmaBlade');
});
