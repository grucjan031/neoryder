import { describe, expect, it, vi } from 'vitest';
import { Weapon } from '../../src/combat/weapons/weapon';
import { weaponDefinitions } from '../../src/combat/weapons/weaponSchema';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { SIM_DT } from '../../src/core/loop';

const base = {
  origin: { x: 0, y: 0, z: 0 },
  dir: { x: 0, y: 0, z: -1 },
};
const held = { ...base, triggerHeld: true };
const released = { ...base, triggerHeld: false };

function make(id: string) {
  const spawn = vi.fn(() => 1);
  const weapon = new Weapon(
    1,
    { bus: new EventBus(), rng: new Rng('buffer'), tuning },
    new Stats({ heatCapacity: 1000, coolingRate: 10 }),
    { projectiles: { spawn } },
    weaponDefinitions.get(id)!,
  );
  return { weapon, spawn };
}

/** Kroki symulacji do chwili, gdy do końca odnowienia zostaje najwyżej `leftS`. */
function advance(weapon: Weapon, cooldownS: number, leftS: number): void {
  const steps = Math.floor((cooldownS - leftS) / SIM_DT);
  for (let i = 0; i < steps; i++) weapon.step(SIM_DT, released);
}

describe('bufor spustu broni półautomatycznej', () => {
  const cooldownS = 1 / 4; // pistol.json: fireRateHz 4

  it('klik w oknie przed końcem odnowienia strzela zaraz po nim', () => {
    const { weapon, spawn } = make('pistol');
    weapon.step(SIM_DT, held);
    weapon.step(SIM_DT, released);
    advance(weapon, cooldownS, tuning.weapons.triggerBufferS / 2);
    weapon.step(SIM_DT, held);
    weapon.step(SIM_DT, released);
    expect(spawn).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 20; i++) weapon.step(SIM_DT, released);
    expect(spawn).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 120; i++) weapon.step(SIM_DT, released);
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('klik przed oknem nie strzela', () => {
    const { weapon, spawn } = make('pistol');
    weapon.step(SIM_DT, held);
    weapon.step(SIM_DT, released);
    weapon.step(SIM_DT, held);
    weapon.step(SIM_DT, released);
    for (let i = 0; i < 120; i++) weapon.step(SIM_DT, released);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('zmiana broni (cool) kasuje bufor', () => {
    const { weapon, spawn } = make('pistol');
    weapon.step(SIM_DT, held);
    weapon.step(SIM_DT, released);
    advance(weapon, cooldownS, tuning.weapons.triggerBufferS / 2);
    weapon.step(SIM_DT, held);
    weapon.cool(SIM_DT);
    for (let i = 0; i < 60; i++) weapon.step(SIM_DT, released);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('przegrzanie kasuje bufor', () => {
    const { weapon, spawn } = make('pistol');
    weapon.step(SIM_DT, held);
    weapon.step(SIM_DT, released);
    advance(weapon, cooldownS, tuning.weapons.triggerBufferS / 2);
    weapon.step(SIM_DT, held);
    weapon.overheat();
    for (let i = 0; i < 60; i++) weapon.step(SIM_DT, released);
    for (let i = 0; i < 120; i++) weapon.step(SIM_DT, released);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('broń automatyczna strzela jak dotąd i bez klików', () => {
    const { weapon, spawn } = make('rifle');
    for (let i = 0; i < 60; i++) weapon.step(SIM_DT, held);
    const count = spawn.mock.calls.length;
    expect(count).toBeGreaterThan(2);
    for (let i = 0; i < 60; i++) weapon.step(SIM_DT, released);
    expect(spawn).toHaveBeenCalledTimes(count);
  });
});
