import { expect, it, vi } from 'vitest';
import { Weapon } from '../../src/combat/weapons/weapon';
import { weaponDefinitions } from '../../src/combat/weapons/weaponSchema';
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
