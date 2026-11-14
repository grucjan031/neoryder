// @vitest-environment jsdom
import { expect, it } from 'vitest';
import {
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene as ThreeScene,
} from 'three';
import { EventBus } from '../../src/core/events';
import { FeelSystem } from '../../src/core/feel';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import type { Action, InputSnapshot } from '../../src/core/input';
import {
  AiTest,
  aiTestSchema,
  createBarrierTest,
} from '../../src/scenes/aiTest';
import data from '../../src/data/scenes/barrierTest.json';
import { scenes } from '../../src/scenes';
import { CommandRegistry } from '../../src/ui/debugCommands';

const input = (pressed: Action[] = []): InputSnapshot => ({
  held: new Set(pressed),
  pressed: new Set(pressed),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});

it.each([false, true])(
  'barrier-test: moce w obu slotach, reset czasu i sprzątanie (zamiana: %s)',
  async (swapped) => {
    expect(scenes['barrier-test']?.().id).toBe('barrier-test');
    const slots = swapped ? ['barrier', 'focus'] : ['focus', 'barrier'];
    const scene = swapped
      ? new AiTest(false, {
          id: 'barrier-test',
          data: aiTestSchema.parse({
            ...data,
            powers: { ...data.powers, slots },
          }),
        })
      : createBarrierTest(false);
    const bus = new EventBus();
    const loop = new GameLoop({ step() {}, render() {} });
    const feel = new FeelSystem(bus, loop, tuning);
    const commands = new CommandRegistry();
    const three = new ThreeScene();
    await scene.init(
      {
        bus,
        loop,
        feel,
        commands,
        tuning,
        debug: false,
        rng: new Rng('barrier-test'),
        camera: new PerspectiveCamera(),
      },
      three,
    );
    try {
      expect(scene.query('enemies')).toBe(3);
      expect(scene.query('powerSlots')).toEqual(slots);
      scene.step(SIM_DT, input([swapped ? 'power2' : 'power']));
      expect(loop.timeScale).toBe(0.3);
      expect(scene.query('energy')).toBe(80);
      scene.step(
        SIM_DT * loop.timeScale,
        input([swapped ? 'power' : 'power2']),
      );
      expect(scene.query('powerActive')).toEqual([true, true]);
      scene.render(1);
      expect(document.body.textContent).toContain(
        `${swapped ? 'E' : 'F'} — Skupienie: aktywna`,
      );
      expect(document.body.textContent).toContain(
        `${swapped ? 'F' : 'E'} — Bariera: aktywna`,
      );
      const shields: Mesh[] = [];
      three.traverse((node) => {
        if (
          node instanceof Mesh &&
          node.geometry.type === 'CylinderGeometry' &&
          node.material instanceof MeshBasicMaterial &&
          node.material.transparent &&
          node.material.color.getHexString() === '00e5ff'
        )
          shields.push(node);
      });
      expect(shields).toHaveLength(1);
      expect(shields[0]?.parent?.visible).toBe(true);
      commands.execute('energy 100');
      expect(scene.query('energy')).toBe(100);
      scene.reset();
      expect(scene.query('powerActive')).toEqual([false, false]);
      expect(scene.query('energy')).toBe(100);
      expect(scene.query('enemies')).toBe(3);
      for (
        let i = 0;
        i < Math.ceil(tuning.time.slowmoRecoverS / SIM_DT) + 1;
        i++
      )
        feel.update(SIM_DT);
      expect(loop.timeScale).toBe(1);
      expect(feel.focusActive).toBe(false);
      scene.render(1);
      expect(shields[0]?.parent?.visible).toBe(false);
    } finally {
      scene.dispose();
      feel.dispose();
    }
    expect(three.children).toHaveLength(0);
    expect(commands.help()).toBe('');
    expect(document.body.textContent).toBe('');
  },
);
