// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { Scene } from 'three';
import { Arena } from '../../src/scenes/arena';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import type { Action, InputSnapshot } from '../../src/core/input';

afterEach(() => window.history.replaceState(null, '', '/'));

it.each(['classic', 'gunner'])(
  'arena %s: numer aktywnej broni przełącza na ostrze, R nadal działa',
  async (loadout) => {
    window.history.replaceState(null, '', `/?scene=arena&loadout=${loadout}`);
    const scene = new Arena(false);
    const bus = new EventBus();
    await scene.init(
      {
        bus,
        rng: new Rng('weapon-toggle'),
        tuning: structuredClone(tuning),
        loop: new GameLoop({ step() {}, render() {} }),
        debug: false,
      },
      new Scene(),
    );
    const step = (action?: Action): void => {
      const input: InputSnapshot = {
        held: new Set(),
        pressed: new Set(action ? [action] : []),
        released: new Set(),
        lookDelta: { x: 0, y: 0 },
      };
      scene.step(SIM_DT, input);
    };
    const finish = () => {
      for (let i = 0; i <= Math.ceil(tuning.hands.swapS / SIM_DT); i++) step();
    };
    try {
      if (scene.heldView().held === 'gun') {
        step('swap');
        finish();
      }
      expect(scene.heldView().held).toBe('blade');
      step('weapon1');
      finish();
      expect(scene.heldView().held).toBe('gun');
      step('weapon1');
      finish();
      expect(scene.heldView().held).toBe('blade');
      step('weapon1');
      finish();
      expect(scene.heldView().held).toBe('gun');
      step('swap');
      finish();
      expect(scene.heldView().held).toBe('blade');
      if (loadout === 'gunner') {
        step('weapon2');
        finish();
        expect(scene.heldView().held).toBe('gun');
        expect(scene.query('weapon')).toBe('scatter');
        step('weapon1');
        finish();
        expect(scene.heldView().held).toBe('gun');
        expect(scene.query('weapon')).toBe('rifle');
        step('weapon1');
        finish();
        expect(scene.heldView().held).toBe('blade');
      }
    } finally {
      scene.dispose();
    }
  },
);
