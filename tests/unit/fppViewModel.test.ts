import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group, Matrix4, Vector3 } from 'three';
import { EventBus } from '../../src/core/events';
import type { HeldItemView } from '../../src/combat/heldItem';
import type { BladeView } from '../../src/combat/melee/plasmaBlade';
import { twinBladesDefinition } from '../../src/combat/melee/bladeSchema';
import { FppViewModel } from '../../src/render/fppViewModel';
import { FppBlade } from '../../src/render/fppBlade';
import { FppBlaster } from '../../src/render/fppBlaster';
import { FppOffhand } from '../../src/render/fppOffhand';
import { FppMotion, shownHeld } from '../../src/render/fppMotion';

const idle: BladeView = {
  state: 'idle',
  stage: 0,
  phase: null,
  phaseT: 0,
  charge: 0,
  blockAgeS: 0,
  guardBrokenS: 0,
  flight: null,
};
const active: { dispose(): void }[] = [];
function keep<T extends { dispose(): void }>(item: T): T {
  active.push(item);
  return item;
}
afterEach(() => {
  for (const item of active.splice(0)) item.dispose();
  vi.restoreAllMocks();
});

describe('FppViewModel', () => {
  it.each([
    ['blade', 'gun', false, 1, 'blade'],
    ['gun', 'blade', false, 1, 'gun'],
    ['blade', 'gun', true, 0.49, 'blade'],
    ['blade', 'gun', true, 0.5, 'gun'],
    ['gun', 'blade', true, 0.49, 'gun'],
    ['gun', 'blade', true, 0.5, 'blade'],
  ] as const)(
    'shows %s toward %s, swapping=%s at %s',
    async (held, target, swapping, swapT, shown) => {
      const view = keep(new FppViewModel(new EventBus(), 1));
      await view.load(false);
      view.place(new Matrix4(), 1 / 60, {
        blade: idle,
        held: { held, target, swapping, swapT },
        horizontalSpeed: 0,
      });
      const [blade, gun, offhand] = view.root.children;
      expect(blade?.visible).toBe(shown === 'blade');
      expect(gun?.visible).toBe(shown === 'gun');
      expect(offhand?.visible).toBe(false);
    },
  );

  it('hides all hands outside playing and restores them in fixed blade/gun modes', async () => {
    const view = keep(new FppViewModel(new EventBus(), 1));
    await view.load(false);
    for (const held of ['blade', 'gun'] as const) {
      view.place(new Matrix4(), 0, {
        blade: idle,
        held,
        horizontalSpeed: 0,
        visible: false,
      });
      expect(view.root.children.every((child) => !child.visible)).toBe(true);
      view.place(new Matrix4(), 0, { blade: idle, held, horizontalSpeed: 0 });
      expect(view.root.children[held === 'blade' ? 0 : 1]?.visible).toBe(true);
    }
  });

  it('disables the free offhand for twin blades, including power gestures', async () => {
    const bus = new EventBus();
    const view = keep(new FppViewModel(bus, 1));
    await view.load(false);
    view.place(new Matrix4(), 0, {
      blade: idle,
      held: 'blade',
      horizontalSpeed: 0,
    });
    expect(view.root.children[2]?.visible).toBe(false);
    bus.emit('power_used', { user: 1, power: 'push' });
    view.place(new Matrix4(), 0, {
      blade: idle,
      held: 'blade',
      horizontalSpeed: 0,
    });
    expect(view.root.children[2]?.visible).toBe(true);
    await view.setBladeDefinition(twinBladesDefinition);
    view.place(new Matrix4(), 0, {
      blade: idle,
      held: 'blade',
      horizontalSpeed: 0,
    });
    bus.emit('power_used', { user: 1, power: 'push' });
    view.place(new Matrix4(), 0, {
      blade: idle,
      held: 'blade',
      horizontalSpeed: 0,
    });
    expect(view.root.children[2]?.visible).toBe(false);
  });

  it('keeps the Arena composition transforms and beam origin across moving/swapping frames', async () => {
    const bus = new EventBus();
    const view = keep(new FppViewModel(bus, 1));
    const blade = keep(new FppBlade());
    const gun = keep(new FppBlaster(bus, 1));
    const offhand = keep(new FppOffhand(bus, 1));
    const motion = new FppMotion();
    await Promise.all([
      view.load(false),
      blade.load(false),
      gun.load(false),
      offhand.load(false),
    ]);
    for (const swapT of [0, 0.25, 0.49, 0.5, 0.75, 1]) {
      const camera = new Matrix4().makeRotationY(swapT).setPosition(2, 3, 4);
      const hands: HeldItemView = {
        held: 'blade',
        target: 'gun',
        swapping: true,
        swapT,
      };
      const handMatrix = motion.place(camera, 1 / 60, 4, hands);
      blade.place(handMatrix, idle);
      const shown = shownHeld(hands);
      blade.root.visible &&= shown === 'blade';
      gun.root.visible = shown === 'gun';
      gun.place(handMatrix, 1 / 60);
      offhand.place(handMatrix, 1 / 60, shown, false, gun.supportMatrix());
      view.place(camera, 1 / 60, {
        blade: idle,
        held: hands,
        horizontalSpeed: 4,
      });
      [blade.root, gun.root, offhand.root].forEach((expected, i) => {
        const actual = view.root.children[i]!;
        expect(actual.visible).toBe(expected.visible);
        expect(actual.matrix.elements).toEqual(expected.matrix.elements);
      });
      expect(view.beamOrigin.toArray()).toEqual(
        gun.root.getWorldPosition(new Vector3()).toArray(),
      );
    }
  });

  it('unsubscribes every owned event listener and detaches its root on dispose', async () => {
    const bus = new EventBus();
    const on = bus.on.bind(bus);
    const unsubscribes: ReturnType<typeof vi.fn>[] = [];
    vi.spyOn(bus, 'on').mockImplementation((type, handler) => {
      const off = vi.fn(on(type, handler));
      unsubscribes.push(off);
      return off;
    });
    const view = new FppViewModel(bus, 1);
    await view.load(false);
    const parent = new Group();
    parent.add(view.root);
    expect(unsubscribes).toHaveLength(4);
    view.dispose();
    expect(unsubscribes.every((off) => off.mock.calls.length === 1)).toBe(true);
    expect(parent.children).toHaveLength(0);
  });
});
