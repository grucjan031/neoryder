// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { Arena } from '../../src/scenes/arena';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import type { InputSnapshot } from '../../src/core/input';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { loadLoadout, loadoutDefinitions } from '../../src/progression/loadout';
import { BeamRenderer } from '../../src/render/beamRenderer';
import { ExplosionRenderer } from '../../src/render/explosionRenderer';
import { weaponDefinitions } from '../../src/combat/weapons/weaponSchema';
import type { Weapon } from '../../src/combat/weapons/weapon';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const firing: InputSnapshot = { ...idle, held: new Set(['shoot']) };
const press = (
  action: 'power' | 'power2' | 'weapon1' | 'weapon2' | 'weapon3',
): InputSnapshot => ({
  ...idle,
  pressed: new Set([action]),
});
const active: Arena[] = [];

afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

async function setup(loadout?: string, debug = false) {
  window.history.replaceState(
    null,
    '',
    `/?scene=arena${loadout === undefined ? '' : `&loadout=${loadout}`}`,
  );
  const bus = new EventBus();
  const switched = vi.fn();
  bus.on('weapon_switched', switched);
  const scene = new Arena(false);
  const commands = new CommandRegistry();
  const three = new ThreeScene();
  await scene.init(
    {
      bus,
      rng: new Rng('arena-loadout'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug,
      camera: new PerspectiveCamera(),
      commands,
    },
    three,
  );
  active.push(scene);
  commands.execute('god');
  return { scene, commands, bus, switched, three };
}

it('keeps the F1 loadout without a parameter and ignores empty weapon and power slots', async () => {
  const { scene, bus, switched } = await setup();
  expect(scene.query('loadout')).toBe('classic');
  expect(scene.query('weapon')).toBe('blaster');
  expect(scene.query('powerSlots')).toEqual(['push']);
  expect(document.querySelector('.hud__weapon-name')?.textContent).toBe(
    'Blaster',
  );
  expect(switched).toHaveBeenCalledExactlyOnceWith({
    owner: 1,
    weapon: 'blaster',
    slot: 0,
  });
  const used = vi.fn();
  bus.on('power_used', used);
  scene.step(SIM_DT, press('power2'));
  scene.step(SIM_DT, press('weapon2'));
  scene.step(SIM_DT, press('weapon3'));
  scene.step(SIM_DT, press('weapon1'));
  expect(switched).toHaveBeenCalledOnce();
  expect(used).not.toHaveBeenCalled();
  expect(scene.query('energy')).toBe(100);
  scene.step(0, firing);
  expect(scene.query('heat')).toBe(0);
  scene.step(SIM_DT, firing);
  expect(scene.query('heat')).toBe(14);
  scene.step(SIM_DT, press('power'));
  expect(used).toHaveBeenCalledExactlyOnceWith({ user: 1, power: 'push' });
  expect(scene.query('energy')).toBe(90);
});

it('falls back from unknown URL ids to classic and warns only in debug', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { scene } = await setup('missing', true);
  expect(scene.query('loadout')).toBe('classic');
  expect(warn).toHaveBeenCalledWith(
    'Nieznany ekwipunek: missing. Wybrano classic.',
  );
  warn.mockClear();
  await setup('missing', false);
  expect(warn).not.toHaveBeenCalled();
});

it('switches only on presses, emits the new heat immediately and keeps heat per weapon', async () => {
  const { scene, bus, switched } = await setup('gunner');
  const events: unknown[] = [];
  bus.on('weapon_switched', (event) => events.push(event));
  bus.on('heat_changed', (event) => events.push(event));
  scene.step(SIM_DT, firing);
  expect(scene.query('heat')).toBe(10);
  events.length = 0;
  scene.step(SIM_DT, { ...idle, held: new Set(['weapon2']) });
  expect(scene.query('weapon')).toBe('rifle');
  scene.step(SIM_DT, press('weapon2'));
  expect(events).toEqual([
    { owner: 1, weapon: 'scatter', slot: 1 },
    { id: 1, current: 0, max: 100, overheated: false },
  ]);
  expect(document.querySelector('.hud__weapon-name')?.textContent).toBe(
    'Rozpraszacz',
  );
  scene.step(SIM_DT, firing);
  expect(scene.query('heat')).toBe(28);
  expect(
    document.querySelector('.hud__meter--heat .hud__value')?.textContent,
  ).toBe('28 / 100');
  scene.step(SIM_DT, press('weapon3'));
  scene.step(SIM_DT, firing);
  expect(scene.query('heat')).toBe(45);
  scene.step(SIM_DT, press('weapon1'));
  expect(scene.query('heat')).toBe(10);
  expect(scene.query('weaponHeat')).toEqual({
    rifle: 10,
    scatter: 28,
    sniper: 45,
  });
  scene.step(SIM_DT, press('weapon2'));
  events.length = 0;
  for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
  expect(scene.query('weaponHeat')).toEqual({
    rifle: 0,
    scatter: 0,
    sniper: 0,
  });
  // Tylko aktywny rozpraszacz może publikować ciepło; ukryta snajperka nie nadpisuje HUD.
  const heatValues = events.map(
    (event) => (event as { current: number }).current,
  );
  expect(heatValues.every((value) => value <= 28)).toBe(true);
  expect(
    document.querySelector('.hud__meter--heat .hud__value')?.textContent,
  ).toBe('0 / 100');
  expect(switched).toHaveBeenLastCalledWith({
    owner: 1,
    weapon: 'scatter',
    slot: 1,
  });
});

it('routes F/E to independent data powers, queues E in hitstop and resets equipment through debug', async () => {
  const { scene, commands, bus } = await setup('bladeDancer');
  const used = vi.fn();
  const denied = vi.fn();
  bus.on('power_used', used);
  bus.on('power_denied', denied);
  expect(scene.query('powerSlots')).toEqual(['push', 'shockwave']);
  scene.step(SIM_DT, press('power'));
  scene.step(0, press('power2'));
  expect(used).toHaveBeenCalledTimes(1);
  scene.step(SIM_DT, idle);
  expect(used.mock.calls.map(([event]) => event.power)).toEqual([
    'push',
    'shockwave',
  ]);
  expect(scene.query('energy')).toBe(50);
  expect(scene.query('powerCooldowns')).toEqual([0.6 - SIM_DT, 1.5]);
  expect(
    document.querySelectorAll('.hud__power-cooldown')[1]?.textContent,
  ).toBe('1.5 s');
  scene.step(SIM_DT, press('power2'));
  expect(denied).toHaveBeenCalledExactlyOnceWith({
    user: 1,
    power: 'shockwave',
    reason: 'cooldown',
  });
  expect(commands.execute('loadout missing')).toContain('Dostępne ekwipunki:');
  expect(scene.query('loadout')).toBe('bladeDancer');
  scene.step(SIM_DT, firing);
  commands.execute('spawn assaulter 2');
  expect(commands.execute('loadout gunner')).toBe('Ekwipunek: Strzelec');
  expect(scene.query('loadout')).toBe('gunner');
  expect(scene.query('weapon')).toBe('rifle');
  expect(scene.query('weaponHeat')).toEqual({
    rifle: 0,
    scatter: 0,
    sniper: 0,
  });
  expect(scene.query('powerSlots')).toEqual(['push']);
  expect(scene.query('powerCooldowns')).toEqual([0]);
  expect(scene.query('energy')).toBe(100);
  expect(scene.query('enemies')).toBe(0);
  expect(scene.query('wave')).toBe(0);
  for (let i = 0; i < 121; i++) scene.step(SIM_DT, idle);
  expect(scene.query('wave')).toBe(1);
  expect(document.querySelectorAll('.hud__power-name')[1]?.textContent).toBe(
    '—',
  );
  expect(
    document.querySelectorAll('.hud__power-cooldown')[0]?.textContent,
  ).toBe('');
  scene.step(SIM_DT, press('weapon3'));
  scene.reset();
  expect(scene.query('weapon')).toBe('rifle');
  expect(scene.query('loadout')).toBe('gunner');
});

it('supports a data loadout with beam and EMP, renders effects and stops the beam on switching', async () => {
  const get = loadoutDefinitions.get.bind(loadoutDefinitions);
  const loadout = loadLoadout({ ...get('classic')!, weapons: ['beam', 'emp'] });
  vi.spyOn(loadoutDefinitions, 'get').mockImplementation((id) =>
    id === 'classic' ? loadout : get(id),
  );
  const beamRender = vi.spyOn(BeamRenderer.prototype, 'render');
  const explosionRender = vi.spyOn(ExplosionRenderer.prototype, 'render');
  const { scene, bus } = await setup();
  const explosions = vi.fn();
  bus.on('explosion', explosions);
  scene.step(SIM_DT, firing);
  const beam = scene.query('beam') as Weapon['beam'];
  expect(beam).toMatchObject({ active: true, to: { z: -8 } });
  expect(beam?.to.x).toBeCloseTo(0);
  scene.render(1, SIM_DT);
  expect(beamRender).toHaveBeenLastCalledWith(beam, expect.anything());
  expect(explosionRender).toHaveBeenLastCalledWith(SIM_DT);
  scene.step(SIM_DT, press('weapon2'));
  expect(beam).toMatchObject({ active: false });
  scene.step(SIM_DT, firing);
  for (let i = 0; i < 130; i++) scene.step(SIM_DT, idle);
  expect(explosions).toHaveBeenCalledOnce();
  expect(explosions.mock.calls[0]?.[0]).toMatchObject({
    owner: 1,
    radiusM: 3.5,
  });
});

it('casts arena beams against the first world collider or enemy hurtbox, excluding the player', async () => {
  const getLoadout = loadoutDefinitions.get.bind(loadoutDefinitions);
  const loadout = loadLoadout({ ...getLoadout('classic')!, weapons: ['beam'] });
  vi.spyOn(loadoutDefinitions, 'get').mockImplementation((id) =>
    id === 'classic' ? loadout : getLoadout(id),
  );
  const getWeapon = weaponDefinitions.get.bind(weaponDefinitions);
  vi.spyOn(weaponDefinitions, 'get').mockImplementation((id) =>
    id === 'beam' ? { ...getWeapon(id)!, rangeM: 40 } : getWeapon(id),
  );
  const { scene, commands, bus } = await setup();
  scene.step(SIM_DT, firing);
  expect((scene.query('beam') as Weapon['beam'])?.to.z).toBeCloseTo(-19);
  commands.execute('spawn assaulter 1');
  scene.step(SIM_DT, idle);
  const damage = vi.fn();
  bus.on('damage_dealt', damage);
  for (let i = 0; i < 6; i++) scene.step(SIM_DT, firing);
  const hits = damage.mock.calls.map(([event]) => event);
  expect(hits).toContainEqual(
    expect.objectContaining({ source: 1, amount: 4, tags: ['#gun', '#laser'] }),
  );
  expect(hits.every((hit) => hit.target !== 1)).toBe(true);
  expect((scene.query('beam') as Weapon['beam'])!.to.z).toBeGreaterThan(-5);
});

it('removes HUD, effect listeners and loadout command on dispose', async () => {
  const { scene, commands, bus, three } = await setup('gunner');
  active.splice(active.indexOf(scene), 1);
  scene.dispose();
  expect(document.querySelector('.hud')).toBeNull();
  expect(three.children).toHaveLength(0);
  expect(commands.execute('loadout classic')).toContain('Nieznana komenda');
  expect(() =>
    bus.emit('explosion', {
      owner: 1,
      point: { x: 0, y: 0, z: 0 },
      radiusM: 1,
      tags: [],
    }),
  ).not.toThrow();
});

it('arena dodaje root Błyskawicy, rysuje łuk po użyciu mocy i odpina root w dispose', async () => {
  const { scene, commands, three } = await setup('resonance');
  expect(scene.query('powerSlots')).toEqual(['chain', 'push']);
  expect(three.getObjectByName('lightning')).toBeDefined();
  commands.execute('spawn assaulter 1');
  scene.step(SIM_DT, press('power'));
  scene.render(1, SIM_DT);
  const glow = three.getObjectByName('lightning-glow');
  expect(glow?.visible).toBe(true);
  active.splice(active.indexOf(scene), 1);
  scene.dispose();
  expect(three.getObjectByName('lightning')).toBeUndefined();
});
