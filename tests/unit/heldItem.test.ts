import { describe, expect, it, vi } from 'vitest';
import { HeldItem } from '../../src/combat/heldItem';
import type { HeldKind } from '../../src/combat/heldItem';
import { EventBus } from '../../src/core/events';
import type { Action, InputSnapshot } from '../../src/core/input';
import { SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import { loadLoadout, loadoutDefinitions } from '../../src/progression/loadout';

function input(
  held: Action[] = [],
  pressed: Action[] = [],
  released: Action[] = [],
): InputSnapshot {
  return {
    held: new Set(held),
    pressed: new Set(pressed),
    released: new Set(released),
    lookDelta: { x: 2, y: 3 },
  };
}

function setup(start: HeldKind = 'blade') {
  const bus = new EventBus();
  const t = structuredClone(tuning);
  const hands = new HeldItem(bus, 1, t, start);
  const changed = vi.fn();
  bus.on('held_item_changed', changed);
  bus.emit('weapon_switched', { owner: 1, weapon: 'rifle', slot: 0 });
  return { bus, t, hands, changed };
}

const ready = { bladeBusy: false };
const busy = { bladeBusy: true };

describe('HeldItem', () => {
  it.each(['blade', 'gun'] as const)(
    'swaps from %s for swapS and blocks both attacks until completion',
    (start) => {
      const { hands, t, changed } = setup(start);
      const target = start === 'blade' ? 'gun' : 'blade';
      hands.requestToggle();
      const attack = input(
        ['attack', 'power'],
        ['attack', 'power2'],
        ['attack'],
      );
      let routed = hands.step(t.hands.swapS / 2, attack, ready);
      expect(hands.view()).toEqual({
        held: start,
        target,
        swapping: true,
        swapT: 0.5,
      });
      expect(routed.triggerHeld).toBe(false);
      for (const actions of [
        routed.bladeInput.held,
        routed.bladeInput.pressed,
        routed.bladeInput.released,
      ])
        expect(actions.has('attack')).toBe(false);
      expect(routed.bladeInput.held.has('power')).toBe(true);
      expect(routed.bladeInput.pressed.has('power2')).toBe(true);
      expect(routed.bladeInput.lookDelta).toEqual(attack.lookDelta);
      expect(attack.held.has('attack')).toBe(true);
      expect(changed).not.toHaveBeenCalled();
      routed = hands.step(t.hands.swapS / 2, attack, ready);
      expect(routed.triggerHeld).toBe(false);
      expect(routed.bladeInput.pressed.has('attack')).toBe(false);
      expect(hands.view()).toEqual({
        held: target,
        target,
        swapping: false,
        swapT: 1,
      });
      expect(changed).toHaveBeenCalledExactlyOnceWith({
        owner: 1,
        held: target,
        weapon: target === 'gun' ? 'rifle' : null,
      });
    },
  );

  it('routes LPM to the blade or gun and strips blade actions from every input set for the gun', () => {
    const { hands } = setup();
    const attack = input(
      ['attack'],
      ['attack'],
      ['block', 'bladeThrow', 'attack'],
    );
    expect(hands.step(SIM_DT, attack, ready)).toEqual({
      bladeInput: attack,
      triggerHeld: false,
    });
    hands.reset('gun');
    const routed = hands.step(SIM_DT, attack, ready);
    expect(routed.triggerHeld).toBe(true);
    expect([...routed.bladeInput.held]).toEqual([]);
    expect([...routed.bladeInput.pressed]).toEqual([]);
    expect([...routed.bladeInput.released]).toEqual([]);
    expect(hands.step(SIM_DT, input(), ready).triggerHeld).toBe(false);
  });

  it.each(['block', 'bladeThrow'] as const)(
    '%s immediately restores the blade and passes the action in the same step',
    (action) => {
      const { hands, changed } = setup('gun');
      const emergency = input([action], [action]);
      expect(hands.step(SIM_DT, emergency, ready)).toEqual({
        bladeInput: emergency,
        triggerHeld: false,
      });
      expect(hands.held).toBe('blade');
      expect(changed).toHaveBeenCalledExactlyOnceWith({
        owner: 1,
        held: 'blade',
        weapon: null,
      });
    },
  );

  it.each(['blade', 'gun'] as const)(
    'block interrupts an ongoing swap from %s',
    (start) => {
      const { hands, t } = setup(start);
      hands.requestToggle();
      hands.step(t.hands.swapS / 2, input(), ready);
      const block = input(['block'], ['block']);
      expect(hands.step(SIM_DT, block, ready).bladeInput).toBe(block);
      expect(hands.view()).toEqual({
        held: 'blade',
        target: 'blade',
        swapping: false,
        swapT: 1,
      });
      hands.step(1, input(), ready);
      expect(hands.held).toBe('blade');
    },
  );

  it('buffers a gun request during a blade attack and starts when the blade becomes idle', () => {
    const { hands, t } = setup();
    hands.requestGun();
    hands.step(t.hands.swapBufferS / 2, input(), busy);
    expect(hands.view().swapping).toBe(false);
    hands.step(SIM_DT, input(), ready);
    expect(hands.view().swapping).toBe(true);
    hands.step(t.hands.swapS, input(), ready);
    expect(hands.held).toBe('gun');
  });

  it('expires the request after swapBufferS, including fixed-step rounding', () => {
    const { hands, t, changed } = setup();
    hands.requestGun();
    for (let i = 0; i < Math.ceil(t.hands.swapBufferS / SIM_DT); i++)
      hands.step(SIM_DT, input(), busy);
    hands.step(t.hands.swapS, input(), ready);
    expect(hands.held).toBe('blade');
    expect(hands.view().swapping).toBe(false);
    expect(changed).not.toHaveBeenCalled();
  });

  it('captures R during hitstop without advancing swap or buffer timers', () => {
    const { hands, t } = setup();
    hands.step(0, input([], ['swap']), busy);
    for (let i = 0; i < 100; i++) hands.step(0, input(), busy);
    hands.step(t.hands.swapS, input(), ready);
    expect(hands.held).toBe('gun');
  });

  it('reset and forceBlade cancel pending and ongoing swaps', () => {
    const { hands, t } = setup();
    hands.requestGun();
    hands.step(SIM_DT, input(), busy);
    hands.reset('blade');
    hands.step(t.hands.swapS, input(), ready);
    expect(hands.held).toBe('blade');
    hands.requestGun();
    hands.step(SIM_DT, input(), ready);
    hands.reset('gun');
    expect(hands.view()).toEqual({
      held: 'gun',
      target: 'gun',
      swapping: false,
      swapT: 1,
    });
    hands.requestToggle();
    hands.step(SIM_DT, input(), ready);
    hands.forceBlade();
    hands.step(1, input(), ready);
    expect(hands.view()).toEqual({
      held: 'blade',
      target: 'blade',
      swapping: false,
      swapT: 1,
    });
  });

  it('uses the owner weapon id and releases the EventBus subscription', () => {
    const { hands, bus, changed } = setup();
    bus.emit('weapon_switched', { owner: 2, weapon: 'sniper', slot: 2 });
    hands.reset('gun');
    expect(changed).toHaveBeenLastCalledWith({
      owner: 1,
      held: 'gun',
      weapon: 'rifle',
    });
    hands.dispose();
    bus.emit('weapon_switched', { owner: 1, weapon: 'scatter', slot: 1 });
    hands.reset('gun');
    expect(changed).toHaveBeenLastCalledWith({
      owner: 1,
      held: 'gun',
      weapon: 'rifle',
    });
  });

  it('defaults loadouts to blade and starts the three gun builds with a gun', () => {
    const classic = { ...loadoutDefinitions.get('classic')! };
    expect(loadLoadout({ ...classic, startHeld: undefined }).startHeld).toBe(
      'blade',
    );
    expect(() => loadLoadout({ ...classic, startHeld: 'missing' })).toThrow();
    for (const id of ['gunner', 'stormGunner', 'resonancePistolero']) {
      const { hands } = setup(loadoutDefinitions.get(id)!.startHeld);
      expect(hands.held).toBe('gun');
    }
  });
});
