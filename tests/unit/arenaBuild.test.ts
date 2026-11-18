// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { Arena } from '../../src/scenes/arena';
import { EventBus } from '../../src/core/events';
import type { EntityId } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import type { InputSnapshot } from '../../src/core/input';
import { CommandRegistry } from '../../src/ui/debugCommands';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const firing: InputSnapshot = { ...idle, held: new Set(['attack']) };
const active: Arena[] = [];

afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

async function setup(query = '') {
  window.history.replaceState(null, '', `/?scene=arena${query}`);
  const bus = new EventBus();
  let playerId: EntityId | undefined;
  bus.on('health_changed', ({ id }) => {
    playerId ??= id;
  });
  const resume = vi.fn();
  const scene = new Arena(false, true);
  const commands = new CommandRegistry();
  await scene.init(
    {
      bus,
      rng: new Rng('arena-build'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera: new PerspectiveCamera(),
      commands,
      resume,
    },
    new ThreeScene(),
  );
  active.push(scene);
  const run = (steps: number, input = idle): void => {
    for (let i = 0; i < steps; i++) scene.step(SIM_DT, input);
  };
  const card = (id: string): HTMLButtonElement => {
    const node = document.querySelector<HTMLButtonElement>(
      `.build-select__card[data-loadout="${id}"]`,
    );
    if (!node) throw new Error(`Brak karty ${id}`);
    return node;
  };
  return { scene, bus, commands, resume, run, card, player: () => playerId! };
}

it('bez ?loadout= arena czeka na wybór buildu: fale stoją, gracz bez wrogów', async () => {
  const { scene, run } = await setup();
  expect(scene.query('state')).toBe('select');
  expect(scene.query('buildSelect')).toBe(true);
  expect(document.querySelectorAll('.build-select__card')).toHaveLength(6);
  expect(document.activeElement?.getAttribute('data-loadout')).toBe('blade');
  run(600);
  expect(scene.query('phase')).toBe('stopped');
  expect(scene.query('enemies')).toBe(0);
});

it('kliknięcie karty startuje run od fali 1 z wybranym ekwipunkiem i przechwytuje mysz', async () => {
  const { scene, run, card, resume } = await setup();
  card('gunner').click();
  expect(scene.query('state')).toBe('playing');
  expect(scene.query('buildSelect')).toBe(false);
  expect(scene.query('loadout')).toBe('gunner');
  expect(scene.query('weapon')).toBe('rifle');
  expect(scene.query('synergies')).toEqual([]);
  expect(resume).toHaveBeenCalledOnce();
  run(Math.ceil(3 / SIM_DT));
  expect(scene.query('wave')).toBe(1);
  expect(scene.query('enemies')).toBeGreaterThan(0);
});

it('hybrydy aktywują synergie z tagów ekwipunku, czyste buildy żadnej', async () => {
  const blade = await setup();
  blade.card('blade').click();
  expect(blade.scene.query('synergies')).toEqual([]);
  blade.commands.execute('build');
  blade.card('bladeDancer').click();
  // Z11: para Ostrze+Rezonans ma też Rygiel i Iskrowy rozłam.
  expect(blade.scene.query('synergies')).toEqual([
    'bladeDancer',
    'parryLock',
    'shockFracture',
  ]);
  blade.commands.execute('build');
  blade.card('stormGunner').click();
  expect(blade.scene.query('synergies')).toEqual(
    expect.arrayContaining(['stormGunner', 'resonancePistolero']),
  );
  expect(blade.scene.query('powerSlots')).toEqual(['chain', 'push']);
});

it('Pistolero Rezonansu: zabójstwo mocą w pełni chłodzi broń', async () => {
  const { scene, bus, run, card, commands, player } = await setup();
  card('resonancePistolero').click();
  commands.execute('god');
  run(2, firing);
  const heated = scene.query('heat') as number;
  expect(heated).toBeGreaterThan(0);
  bus.emit('enemy_killed', { id: 9999, killer: player(), tags: ['#gun'] });
  expect(scene.query('heat')).toBe(heated);
  bus.emit('enemy_killed', { id: 9998, killer: player(), tags: ['#power'] });
  expect(scene.query('heat')).toBe(0);
});

it('?loadout= pomija ekran wyboru', async () => {
  const { scene } = await setup('&loadout=blade');
  expect(scene.query('state')).toBe('playing');
  expect(scene.query('buildSelect')).toBe(false);
  expect(scene.query('loadout')).toBe('blade');
  expect(scene.query('phase')).toBe('break');
});

it('„Zmień build” po śmierci i komenda build wracają do ekranu na czystej arenie', async () => {
  const { scene, bus, run, card, commands, player } = await setup();
  card('blade').click();
  run(Math.ceil(4 / SIM_DT));
  expect(scene.query('enemies')).toBeGreaterThan(0);
  bus.emit('player_died', { id: player(), cause: 'executor' });
  expect(scene.query('state')).toBe('dead');
  expect(document.querySelector('.hud__death')?.textContent).toContain(
    'Bursztynowa zapowiedź = cios przebija blok. Uskocz.',
  );
  const change =
    document.querySelector<HTMLButtonElement>('.hud__change-build');
  expect(change?.textContent).toBe('Zmień zestaw');
  change!.click();
  expect(scene.query('state')).toBe('select');
  expect(scene.query('buildSelect')).toBe(true);
  expect(scene.query('enemies')).toBe(0);
  expect(scene.query('dead')).toBe(false);
  card('resonance').click();
  expect(scene.query('loadout')).toBe('resonance');
  run(60);
  expect(commands.execute('build')).toBe('Wybierz build.');
  expect(scene.query('state')).toBe('select');
  expect(scene.query('phase')).toBe('stopped');
});
