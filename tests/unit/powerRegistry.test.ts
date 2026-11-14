import { describe, expect, it, vi } from 'vitest';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { SIM_DT } from '../../src/core/loop';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { DamageSystem, Health } from '../../src/combat/damage';
import { PlayerEnergy } from '../../src/combat/powers/energy';
import { PowerBase } from '../../src/combat/powers/power';
import type {
  Power,
  PowerDeps,
  PowerFactory,
  PowerInput,
} from '../../src/combat/powers/power';
import {
  createPower,
  loadPower,
  loadPowerDefinitions,
  powerDefinitions,
  registerPowerKind,
} from '../../src/combat/powers/registry';
import { pushDefinition } from '../../src/combat/powers/push';
import { PowerSlots } from '../../src/combat/powers/slots';
import pushData from '../../src/data/powers/push.json';
import shockwaveData from '../../src/data/powers/shockwave.json';

const idle: PowerInput = { pressed: false, held: false, released: false };
const press: PowerInput = { pressed: true, held: true, released: false };
const snapshot: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};

function setup() {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const owner = entities.create('player', 'player');
  const damage = new DamageSystem(bus, entities);
  const energy = new PlayerEnergy(
    owner,
    new Stats({ maxEnergy: 100, energyRegen: 0 }),
    bus,
    tuning,
  );
  const targets = [-2, 2, -10].map((z) => {
    const id = entities.create('dummy', 'enemy');
    damage.register(id, new Health(() => 100));
    return { id, position: { x: 0, y: 1, z } };
  });
  const deps: PowerDeps = {
    owner,
    bus,
    tuning,
    damage,
    energy,
    aim: () => ({ origin: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 } }),
    targets: () => targets,
    castWall: () => null,
  };
  return {
    deps,
    targets,
    hp: () => targets.map(({ id }) => damage.health(id)?.current),
  };
}

class ProbePower extends PowerBase {
  readonly activate = vi.fn(() => 7);
  readonly stepEffect = vi.fn();
  readonly resetEffect = vi.fn();
}

describe('rejestr mocy', () => {
  it('ładuje i waliduje wszystkie JSON-y, oba warianty mają ten sam mechanizm', () => {
    expect([...powerDefinitions.keys()].sort()).toEqual([
      'barrier',
      'chain',
      'focus',
      'push',
      'shockwave',
    ]);
    expect(powerDefinitions.get('push')).toEqual(pushData);
    expect(powerDefinitions.get('shockwave')).toEqual(shockwaveData);
    const { deps } = setup();
    const push = createPower('push', deps);
    const wave = createPower('shockwave', deps);
    expect(push.constructor).toBe(wave.constructor);
    expect(push.def).toBe(powerDefinitions.get('push'));
    expect(wave.def.name).toBe('Fala uderzeniowa');
    expect(push.active).toBe(false);
    expect(wave.active).toBe(false);
  });

  it('odrzuca powtórzone id, nieznany kind, błędne parametry i nieznane id', () => {
    expect(() => loadPowerDefinitions([pushData, pushData])).toThrow(
      /Powtórzone id/,
    );
    expect(() => loadPower({ ...pushData, kind: 'unknown' })).toThrow(/mocy/);
    expect(() => loadPower({ ...pushData, coneAngleDeg: 361 })).toThrow(/mocy/);
    expect(() => loadPower({ ...pushData, cost: -1 })).toThrow(/mocy/);
    expect(() => createPower('missing', setup().deps)).toThrow(/Nieznane id/);
  });

  it('rejestruje fabrykę raz na kind, chroniąc istniejący mechanizm', () => {
    const factory = vi.fn<PowerFactory>(
      (def, deps) => new ProbePower(def, deps),
    );
    registerPowerKind('registry-test', factory);
    expect(() => registerPowerKind('registry-test', factory)).toThrow(
      /zarejestrowany/,
    );
    expect(() => registerPowerKind('cone', factory)).toThrow(/zarejestrowany/);
    expect(factory).not.toHaveBeenCalled();
  });
});

describe('wspólna baza mocy', () => {
  it('zużywa energię przez spend, emituje power_used, odmawia w odnowieniu', () => {
    const { deps } = setup();
    const power = new ProbePower(pushDefinition, deps);
    const spend = vi.spyOn(deps.energy, 'spend');
    const used = vi.fn();
    const denied = vi.fn();
    deps.bus.on('power_used', used);
    deps.bus.on('power_denied', denied);
    power.step(SIM_DT, press);
    expect(spend).toHaveBeenCalledExactlyOnceWith(pushDefinition.cost);
    expect(deps.energy.current).toBe(100 - pushDefinition.cost);
    expect(used).toHaveBeenCalledExactlyOnceWith({
      power: 'push',
      user: deps.owner,
    });
    expect(power.activate).toHaveBeenCalledOnce();
    expect(power.cooldownRemaining).toBe(pushDefinition.cooldownS);
    power.step(SIM_DT, press);
    expect(denied).toHaveBeenCalledExactlyOnceWith({
      power: 'push',
      user: deps.owner,
      reason: 'cooldown',
    });
    expect(spend).toHaveBeenCalledOnce();
    expect(power.activate).toHaveBeenCalledOnce();
    power.step(pushDefinition.cooldownS, press);
    expect(power.activate).toHaveBeenCalledTimes(2);
    expect(deps.energy.current).toBe(100 - 2 * pushDefinition.cost);
  });

  it('brak energii emituje no_energy bez efektu, kosztu i odnowienia', () => {
    const { deps } = setup();
    deps.energy.set(pushDefinition.cost - 1);
    const power = new ProbePower(pushDefinition, deps);
    const denied = vi.fn();
    const used = vi.fn();
    deps.bus.on('power_denied', denied);
    deps.bus.on('power_used', used);
    power.step(SIM_DT, press);
    expect(denied).toHaveBeenCalledExactlyOnceWith({
      power: 'push',
      user: deps.owner,
      reason: 'no_energy',
    });
    expect(used).not.toHaveBeenCalled();
    expect(power.activate).not.toHaveBeenCalled();
    expect(power.cooldownRemaining).toBe(0);
    expect(deps.energy.current).toBe(pushDefinition.cost - 1);
  });

  it('kolejkuje w hitstopie, zatrzymuje efekt i odnowienie; trzymanie nie powtarza użycia', () => {
    const { deps } = setup();
    const power = new ProbePower(pushDefinition, deps);
    power.step(0, press);
    power.step(0, idle);
    expect(power.activate).not.toHaveBeenCalled();
    expect(power.stepEffect).not.toHaveBeenCalled();
    expect(deps.energy.current).toBe(100);
    power.step(SIM_DT, idle);
    expect(power.activate).toHaveBeenCalledOnce();
    power.step(0, idle);
    expect(power.cooldownRemaining).toBe(pushDefinition.cooldownS);
    power.step(pushDefinition.cooldownS, { ...idle, held: true });
    expect(power.cooldownRemaining).toBe(0);
    expect(power.activate).toHaveBeenCalledOnce();
  });

  it('reset usuwa odnowienie, kolejkę i stan efektu', () => {
    const { deps } = setup();
    const power = new ProbePower(pushDefinition, deps);
    power.step(SIM_DT, press);
    power.step(0, press);
    power.reset();
    expect(power.resetEffect).toHaveBeenCalledOnce();
    expect(power.cooldownRemaining).toBe(0);
    power.step(SIM_DT, idle);
    expect(power.activate).toHaveBeenCalledOnce();
    power.step(SIM_DT, press);
    expect(power.activate).toHaveBeenCalledTimes(2);
  });
});

describe('sloty mocy', () => {
  function mockPower(): Power {
    return {
      def: pushDefinition,
      active: false,
      cooldownRemaining: 0,
      step: vi.fn(),
      reset: vi.fn(),
    };
  }

  it('F/power steruje slotem 0, E/power2 slotem 1 z osobnymi zboczami', () => {
    const first = mockPower();
    const second = mockPower();
    const slots = new PowerSlots([first, second]);
    slots.step(SIM_DT, {
      ...snapshot,
      pressed: new Set(['power']),
      held: new Set(['power']),
      released: new Set(['power2']),
    });
    expect(first.step).toHaveBeenLastCalledWith(SIM_DT, press);
    expect(second.step).toHaveBeenLastCalledWith(SIM_DT, {
      pressed: false,
      held: false,
      released: true,
    });
    slots.step(0, {
      ...snapshot,
      pressed: new Set(['power2']),
      held: new Set(['power2']),
    });
    expect(first.step).toHaveBeenLastCalledWith(0, idle);
    expect(second.step).toHaveBeenLastCalledWith(0, press);
    expect(slots.get(0)).toBe(first);
    expect(slots.get(1)).toBe(second);
    slots.reset();
    expect(first.reset).toHaveBeenCalledOnce();
    expect(second.reset).toHaveBeenCalledOnce();
  });

  it('puste i nieistniejące sloty są bezpieczne', () => {
    const power = mockPower();
    const slots = new PowerSlots([null, power]);
    slots.step(SIM_DT, { ...snapshot, pressed: new Set(['power']) });
    expect(power.step).toHaveBeenLastCalledWith(SIM_DT, idle);
    expect(slots.get(0)).toBeNull();
    expect(slots.get(2)).toBeNull();
    expect(slots.get(-1)).toBeNull();
    expect(() => new PowerSlots([]).step(SIM_DT, snapshot)).not.toThrow();
    expect(() => slots.reset()).not.toThrow();
  });

  it('obie moce dzielą energię, ale mają osobne odnowienia', () => {
    const { deps } = setup();
    const push = createPower('push', deps);
    const wave = createPower('shockwave', deps);
    const slots = new PowerSlots([push, wave]);
    slots.step(SIM_DT, { ...snapshot, pressed: new Set(['power', 'power2']) });
    expect(deps.energy.current).toBe(100 - push.def.cost - wave.def.cost);
    expect(push.cooldownRemaining).toBe(push.def.cooldownS);
    expect(wave.cooldownRemaining).toBe(wave.def.cooldownS);
    slots.step(push.def.cooldownS, snapshot);
    expect(push.cooldownRemaining).toBe(0);
    expect(wave.cooldownRemaining).toBeCloseTo(
      wave.def.cooldownS - push.def.cooldownS,
    );
  });
});

describe('warianty cone', () => {
  it.each(['push', 'shockwave'])(
    '%s: poprawny zasięg, kierunek i koszt z danych',
    (id) => {
      const c = setup();
      const power = createPower(id, c.deps);
      const hits: GameEvents['damage_dealt'][] = [];
      c.deps.bus.on('damage_dealt', (hit) => hits.push(hit));
      power.step(SIM_DT, press);
      expect(c.hp()).toEqual(id === 'push' ? [90, 100, 100] : [90, 90, 100]);
      expect(hits).toHaveLength(id === 'push' ? 1 : 2);
      expect(hits[0]?.dir?.z).toBeLessThan(0);
      if (id === 'shockwave') expect(hits[1]?.dir?.z).toBeGreaterThan(0);
      expect(hits.every((hit) => hit.knockback === power.def.knockback)).toBe(
        true,
      );
      expect(c.deps.energy.current).toBe(100 - power.def.cost);
      expect(power.cooldownRemaining).toBe(power.def.cooldownS);
    },
  );

  it('reset usuwa oczekujące uderzenia w ścianę', () => {
    const c = setup();
    c.deps.castWall = () => 1;
    const power = createPower('push', c.deps);
    power.step(SIM_DT, press);
    power.reset();
    power.step(1, idle);
    expect(c.hp()).toEqual([90, 100, 100]);
  });
});
