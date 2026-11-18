import { expect, it } from 'vitest';
import { HeldItem } from '../../src/combat/heldItem';
import { EventBus } from '../../src/core/events';
import type { Action, InputSnapshot } from '../../src/core/input';
import { tuning } from '../../src/core/tuning';

const input = (action?: Action): InputSnapshot => ({
  held: new Set(),
  pressed: new Set(action ? [action] : []),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});

it.each([0, 1, 2])(
  'ponowny numer slotu %i chowa broń; inny slot jej nie chowa',
  (slot) => {
    const bus = new EventBus();
    const hands = new HeldItem(bus, 1, tuning, 'blade');
    const action = (['weapon1', 'weapon2', 'weapon3'] as const)[slot]!;
    try {
      bus.emit('weapon_switched', { owner: 1, weapon: 'pistol', slot });
      hands.step(1 / 60, input(), { bladeBusy: false });
      hands.requestGun(); // Tak wołają arena i roomScene przed HeldItem.step.
      hands.step(tuning.hands.swapS, input(action), { bladeBusy: false });
      expect(hands.held).toBe('gun');
      hands.requestGun();
      hands.step(0, input(action), { bladeBusy: false });
      hands.step(tuning.hands.swapS, input(), { bladeBusy: false });
      expect(hands.held).toBe('blade');
      hands.requestGun();
      hands.step(tuning.hands.swapS, input(action), { bladeBusy: false });
      expect(hands.held).toBe('gun');
      const other = (slot + 1) % 3;
      bus.emit('weapon_switched', { owner: 1, weapon: 'rifle', slot: other });
      hands.requestGun();
      hands.step(
        tuning.hands.swapS,
        input((['weapon1', 'weapon2', 'weapon3'] as const)[other]),
        { bladeBusy: false },
      );
      expect(hands.held).toBe('gun');
    } finally {
      hands.dispose();
    }
  },
);
