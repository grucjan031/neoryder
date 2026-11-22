import { expect, it, vi } from 'vitest';
import { Weapon } from '../../src/combat/weapons/weapon';
import {
  blasterDefinition,
  loadWeapon,
  weaponDefinitions,
} from '../../src/combat/weapons/weaponSchema';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { SIM_DT } from '../../src/core/loop';

const firing = {
  triggerHeld: true,
  origin: { x: 0, y: 0, z: 0 },
  dir: { x: 0, y: 0, z: -1 },
};

const idle = { ...firing, triggerHeld: false };
const press = { ...idle, coolingPressed: true };
const { overheatLockS, activeCooling } = tuning.weapons;

function makeWeapon(definition = loadWeapon(blasterDefinition)) {
  return new Weapon(
    1,
    { bus: new EventBus(), rng: new Rng('active-cooling'), tuning },
    new Stats({ heatCapacity: 100, coolingRate: 45 }),
    { projectiles: { spawn: vi.fn(() => 1) } },
    definition,
  );
}

it('opens on the first window tick, shortens the lock once and resumes fire', () => {
  const weapon = makeWeapon();
  weapon.overheat();
  weapon.step(0, press);
  expect(weapon.coolingPhase).toBe('waiting');
  for (let i = 0; i < Math.round(activeCooling.windowStartS / SIM_DT); i++) {
    expect(weapon.coolingPhase).toBe('waiting');
    weapon.step(SIM_DT, idle);
  }
  expect(weapon.coolingPhase).toBe('window');
  weapon.step(SIM_DT, press);
  expect(weapon.coolingPhase).toBe('success');
  weapon.step(
    overheatLockS -
      activeCooling.windowStartS -
      activeCooling.bonusS -
      2 * SIM_DT,
    { ...firing, coolingPressed: true },
  );
  expect(weapon.shots).toBe(0);
  weapon.step(SIM_DT, firing);
  expect(weapon.shots).toBe(1);
  expect(weapon.coolingPhase).toBeUndefined();
});

it.each([
  0,
  activeCooling.windowStartS + activeCooling.windowDurationS,
  overheatLockS - SIM_DT,
])(
  'extends an early or late lock at %s, ignores presses during the penalty and reopens a full window',
  (elapsed) => {
    const weapon = makeWeapon();
    weapon.overheat();
    weapon.step(elapsed, idle);
    expect(weapon.coolingPhase).toBe(elapsed === 0 ? 'waiting' : 'late');
    weapon.step(SIM_DT, press);
    expect(weapon.coolingPhase).toBe('penalty');
    weapon.step(activeCooling.penaltyS - SIM_DT, press);
    expect(weapon.coolingPhase).toBe('window');
    weapon.cool(activeCooling.windowDurationS - SIM_DT);
    expect(weapon.coolingPhase).toBe('window');
    weapon.step(SIM_DT, press);
    const expectedLock =
      Math.max(overheatLockS - elapsed, activeCooling.windowDurationS) -
      activeCooling.windowDurationS -
      activeCooling.bonusS;
    if (expectedLock > SIM_DT) {
      expect(weapon.coolingPhase).toBe('success');
      weapon.step(expectedLock - SIM_DT, idle);
      expect(weapon.overheated).toBe(true);
      weapon.step(SIM_DT, idle);
    }
    expect(weapon.overheated).toBe(false);
  },
);

it('uses weapon overrides, starts a fresh window after a vent or reset, and validates timings', () => {
  const overrides = {
    windowStartS: 0,
    windowDurationS: 0.1,
    bonusS: 2,
    penaltyS: 0.2,
  };
  const weapon = makeWeapon(
    loadWeapon({ ...blasterDefinition, activeCooling: overrides }),
  );
  weapon.step(SIM_DT, press);
  expect(weapon.coolingPhase).toBeUndefined();
  weapon.heat.set(weapon.heat.max);
  weapon.step(overrides.windowDurationS, idle);
  expect(weapon.coolingPhase).toBe('late');
  weapon.step(overrides.penaltyS, press);
  expect(weapon.coolingPhase).toBe('window');
  weapon.step(SIM_DT, press);
  expect(weapon.overheated).toBe(false);
  for (const clear of [() => weapon.reset(), () => weapon.vent('full')]) {
    weapon.overheat();
    weapon.step(overrides.windowDurationS, idle);
    weapon.step(SIM_DT, press);
    clear();
    expect(weapon.coolingPhase).toBeUndefined();
    weapon.overheat();
    expect(weapon.coolingPhase).toBe('window');
  }
  for (const field of Object.keys(overrides)) {
    expect(() =>
      loadWeapon({ ...blasterDefinition, activeCooling: { [field]: -1 } }),
    ).toThrow(field);
  }
});

it('preserves passive recovery and ignores cooling presses on weapons without activeCooling', () => {
  for (const def of [blasterDefinition, weaponDefinitions.get('pistol')!]) {
    const weapon = makeWeapon(def);
    weapon.overheat();
    const input = def.activeCooling ? idle : press;
    weapon.step(overheatLockS - SIM_DT, input);
    expect(weapon.overheated).toBe(true);
    weapon.step(SIM_DT, input);
    expect(weapon.overheated).toBe(false);
  }
});

it('cools an inactive weapon and expires overheat without heat or firing events', () => {
  const bus = new EventBus();
  const spawn = vi.fn(() => 1);
  const weapon = new Weapon(
    1,
    { bus, rng: new Rng('cooling'), tuning },
    new Stats({ heatCapacity: 100, coolingRate: 45 }),
    { projectiles: { spawn } },
    weaponDefinitions.get('pistol')!,
  );
  weapon.step(SIM_DT, firing);
  weapon.overheat();
  const heat = vi.fn();
  const fired = vi.fn();
  bus.on('heat_changed', heat);
  bus.on('weapon_fired', fired);
  weapon.cool(0);
  expect(weapon.heat.current).toBe(100);
  expect(weapon.overheated).toBe(true);
  for (let i = 0; i < 180; i++) weapon.cool(SIM_DT);
  expect(weapon.heat.current).toBe(0);
  expect(weapon.overheated).toBe(false);
  expect(heat).not.toHaveBeenCalled();
  expect(fired).not.toHaveBeenCalled();
  expect(spawn).toHaveBeenCalledOnce();
  // Ponowne wybranie półautomatu pozwala na świeże zbocze spustu.
  weapon.step(SIM_DT, firing);
  expect(spawn).toHaveBeenCalledTimes(2);
  expect(heat).toHaveBeenLastCalledWith({
    id: 1,
    current: 9,
    max: 100,
    overheated: false,
  });
});

it('starts an externally heated inactive lock silently and advances the shot cooldown', () => {
  const bus = new EventBus();
  const heat = vi.fn();
  const spawn = vi.fn(() => 1);
  const weapon = new Weapon(
    1,
    { bus, rng: new Rng('cooling'), tuning },
    new Stats({ heatCapacity: 100, coolingRate: 0 }),
    { projectiles: { spawn } },
    weaponDefinitions.get('pistol')!,
  );
  bus.on('heat_changed', heat);
  weapon.heat.set(100);
  weapon.cool(SIM_DT);
  expect(weapon.overheated).toBe(true);
  expect(heat).not.toHaveBeenCalled();
  weapon.reset();
  weapon.step(SIM_DT, firing);
  weapon.cool(1);
  weapon.step(SIM_DT, firing);
  expect(spawn).toHaveBeenCalledTimes(2);
});

it('vent (cool_weapon): częściowe schłodzenie zostawia blokadę, pełne zdejmuje ciepło i blokadę', () => {
  const bus = new EventBus();
  const weapon = new Weapon(
    1,
    { bus, rng: new Rng('vent'), tuning },
    new Stats({ heatCapacity: 100, coolingRate: 45 }),
    { projectiles: { spawn: vi.fn(() => 1) } },
    weaponDefinitions.get('pistol')!,
  );
  const heat = vi.fn();
  bus.on('heat_changed', heat);
  weapon.overheat();
  weapon.vent(30);
  expect(weapon.heat.current).toBe(70);
  expect(weapon.overheated).toBe(true);
  weapon.vent(-5);
  expect(weapon.heat.current).toBe(70);
  weapon.vent('full');
  expect(weapon.heat.current).toBe(0);
  expect(weapon.overheated).toBe(false);
  expect(heat).toHaveBeenLastCalledWith({
    id: 1,
    current: 0,
    max: 100,
    overheated: false,
  });
});
