import { afterEach, describe, expect, it, vi } from 'vitest';
import { DamageSystem } from '../../src/combat/damage';
import { PlayerEnergy } from '../../src/combat/powers/energy';
import { FocusPower } from '../../src/combat/powers/focus';
import type { PowerInput } from '../../src/combat/powers/power';
import { createPower, loadPower } from '../../src/combat/powers/registry';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { FeelSystem } from '../../src/core/feel';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import data from '../../src/data/powers/focus.json';

const idle: PowerInput = { pressed: false, held: false, released: false };
const press: PowerInput = { ...idle, pressed: true, held: true };
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()));

function setup() {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const owner = entities.create('player', 'player');
  const energy = new PlayerEnergy(
    owner,
    new Stats({ maxEnergy: 100, energyRegen: 0 }),
    bus,
    tuning,
  );
  const loop = { timeScale: 1, paused: false, hitstop() {} };
  const feel = new FeelSystem(bus, loop, tuning);
  const power = createPower('focus', {
    owner,
    bus,
    energy,
    tuning,
    damage: new DamageSystem(bus, entities),
    aim: () => ({ origin: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 } }),
    targets: () => [],
    castWall: () => null,
  }) as FocusPower;
  const focus = vi.fn();
  const denied = vi.fn();
  const used = vi.fn();
  bus.on('focus', focus);
  bus.on('power_denied', denied);
  bus.on('power_used', used);
  cleanup.push(() => {
    power.reset();
    energy.dispose();
    feel.dispose();
  });
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / SIM_DT); i++)
      power.step(SIM_DT, idle);
  };
  return { bus, owner, energy, feel, loop, power, focus, denied, used, run };
}

describe('Skupienie', () => {
  it('waliduje dane, startuje przez rejestr i pobiera koszt tylko raz', () => {
    const c = setup();
    expect(c.power).toBeInstanceOf(FocusPower);
    expect(c.power.def).toEqual(data);
    for (const patch of [
      { durationS: 0 },
      { worldScale: 0 },
      { worldScale: 1.1 },
      { drainPerS: -1 },
    ])
      expect(() => loadPower({ ...data, ...patch })).toThrow();
    c.power.step(SIM_DT, press);
    expect(c.power.active).toBe(true);
    expect(c.energy.current).toBe(100 - data.cost);
    expect(c.focus).toHaveBeenCalledExactlyOnceWith({
      worldScale: data.worldScale,
      durationS: data.durationS,
    });
    expect(c.used).toHaveBeenCalledExactlyOnceWith({
      power: data.id,
      user: c.owner,
    });
    expect(c.power.cooldownRemaining).toBe(0);
  });

  it('drenuje energię według playerDt, nie zwolnionego czasu świata; hitstop nie drenuje', () => {
    const c = setup();
    c.power.step(SIM_DT, press);
    for (let frame = 0; frame < 60; frame++) {
      c.power.step(c.feel.playerDt(SIM_DT * c.loop.timeScale), idle);
      c.feel.update(SIM_DT);
    }
    expect(c.energy.current).toBeCloseTo(100 - data.cost - data.drainPerS);
    c.power.step(0, idle);
    expect(c.energy.current).toBeCloseTo(100 - data.cost - data.drainPerS);
    expect(c.power.active).toBe(true);
  });

  it('kończy się po durationS i dopiero wtedy zaczyna pełne odnowienie', () => {
    const c = setup();
    c.power.step(SIM_DT, press);
    c.run(data.durationS - SIM_DT);
    expect(c.power.active).toBe(true);
    expect(c.power.cooldownRemaining).toBe(0);
    c.power.step(SIM_DT, idle);
    expect(c.power.active).toBe(false);
    expect(c.focus).toHaveBeenLastCalledWith({
      worldScale: data.worldScale,
      durationS: 0,
    });
    expect(c.energy.current).toBeCloseTo(
      100 - data.cost - data.durationS * data.drainPerS,
    );
    expect(c.power.cooldownRemaining).toBe(data.cooldownS);
    c.power.step(SIM_DT, press);
    expect(c.denied).toHaveBeenLastCalledWith({
      power: data.id,
      user: c.owner,
      reason: 'cooldown',
    });
    c.run(data.cooldownS);
    c.power.step(SIM_DT, press);
    expect(c.power.active).toBe(true);
  });

  it.each([false, true])(
    'wciśnięcie w ostatnim kroku nie odmawia ani nie włącza ponownie (kolejka: %s)',
    (queued) => {
      const c = setup();
      c.power.step(SIM_DT, press);
      c.run(data.durationS - SIM_DT);
      if (queued) c.power.step(0, press);
      c.power.step(SIM_DT, queued ? idle : press);
      expect(c.power.active).toBe(false);
      expect(c.used).toHaveBeenCalledTimes(1);
      expect(c.denied).not.toHaveBeenCalled();
      expect(c.power.cooldownRemaining).toBe(data.cooldownS);
      expect(
        c.focus.mock.calls.filter(([event]) => event.durationS === 0),
      ).toHaveLength(1);
    },
  );

  it('dokładnie zerowa energia po opłaconym kroku pozwala działać do następnego kroku', () => {
    const c = setup();
    c.energy.set(data.cost + data.drainPerS * SIM_DT);
    c.power.step(SIM_DT, press);
    c.power.step(SIM_DT, idle);
    expect(c.energy.current).toBe(0);
    expect(c.power.active).toBe(true);
    expect(c.focus).toHaveBeenCalledTimes(1);
    c.power.step(SIM_DT, idle);
    expect(c.power.active).toBe(false);
    expect(c.focus).toHaveBeenLastCalledWith({
      worldScale: data.worldScale,
      durationS: 0,
    });
  });

  it('1 s hitstopu nie skraca Skupienia: pełne durationS czasu gracza, potem powrót świata', () => {
    const c = setup();
    let playerS = 0;
    const loop = new GameLoop({
      step(dt) {
        const playerDt = feel.playerDt(dt);
        playerS += playerDt;
        c.power.step(playerDt, idle);
      },
      render(_alpha, frameDt) {
        feel.update(frameDt);
      },
    });
    const feel = new FeelSystem(c.bus, loop, tuning);
    cleanup.push(() => feel.dispose());
    c.power.step(SIM_DT, press);
    const frames = (n: number) => {
      for (let i = 0; i < n; i++) loop.advance(SIM_DT * 1000);
    };
    frames(60);
    c.bus.emit('hitstop', { ms: 1000 });
    frames(60);
    expect(playerS).toBeCloseTo(1);
    expect(c.power.active).toBe(true);
    expect(loop.timeScale).toBe(data.worldScale);
    frames(119);
    expect(c.power.active).toBe(true);
    expect(loop.timeScale).toBe(data.worldScale);
    frames(1);
    expect(playerS).toBeCloseTo(data.durationS);
    expect(c.power.active).toBe(false);
    expect(c.focus).toHaveBeenLastCalledWith({
      worldScale: data.worldScale,
      durationS: 0,
    });
    frames(Math.ceil(tuning.time.slowmoRecoverS / SIM_DT) + 1);
    expect(loop.timeScale).toBe(1);
    expect(feel.focusActive).toBe(false);
  });

  it('ponowne wciśnięcie kończy wcześniej bez nowego kosztu i wysyła durationS: 0', () => {
    const c = setup();
    c.power.step(SIM_DT, press);
    c.run(0.5);
    c.power.step(SIM_DT, press);
    expect(c.power.active).toBe(false);
    expect(c.focus).toHaveBeenLastCalledWith({
      worldScale: data.worldScale,
      durationS: 0,
    });
    expect(c.power.cooldownRemaining).toBe(data.cooldownS);
    expect(c.energy.current).toBeCloseTo(
      100 - data.cost - data.drainPerS * (0.5 + SIM_DT),
    );
    expect(c.used).toHaveBeenCalledTimes(1);
  });

  it('brak energii w trakcie kończy moc i wysyła durationS: 0', () => {
    const c = setup();
    c.energy.set(data.cost + (data.drainPerS * SIM_DT) / 2);
    c.power.step(SIM_DT, press);
    c.power.step(SIM_DT, idle);
    expect(c.energy.current).toBe(0);
    expect(c.power.active).toBe(false);
    expect(c.focus).toHaveBeenLastCalledWith({
      worldScale: data.worldScale,
      durationS: 0,
    });
    expect(c.power.cooldownRemaining).toBe(data.cooldownS);
  });

  it('odmawia bez energii; buforuje start i wyłączenie w hitstopie; reset usuwa kolejkę', () => {
    const c = setup();
    c.energy.set(data.cost - 1);
    c.power.step(SIM_DT, press);
    expect(c.denied).toHaveBeenCalledExactlyOnceWith({
      power: data.id,
      user: c.owner,
      reason: 'no_energy',
    });
    expect(c.focus).not.toHaveBeenCalled();
    expect(c.power.cooldownRemaining).toBe(0);
    c.energy.set(100);
    c.power.step(0, press);
    expect(c.power.active).toBe(false);
    c.power.step(SIM_DT, idle);
    expect(c.power.active).toBe(true);
    c.power.step(0, press);
    expect(c.power.active).toBe(true);
    c.power.step(SIM_DT, idle);
    expect(c.power.active).toBe(false);
    c.power.reset();
    c.power.step(0, press);
    c.power.reset();
    c.power.step(SIM_DT, idle);
    expect(c.power.active).toBe(false);
    expect(c.power.cooldownRemaining).toBe(0);
    c.power.step(SIM_DT, press);
    c.power.reset();
    expect(c.focus).toHaveBeenLastCalledWith({
      worldScale: data.worldScale,
      durationS: 0,
    });
  });
});
