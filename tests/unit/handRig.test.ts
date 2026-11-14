import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Euler,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { HandRig } from '../../src/render/handRig';
import {
  handNodes,
  handPoses,
  handPosesSchema,
} from '../../src/render/handPoses';
import { FppBlade } from '../../src/render/fppBlade';
import { FppBlaster } from '../../src/render/fppBlaster';
import { FppOffhand } from '../../src/render/fppOffhand';
import { FppMotion, shownHeld } from '../../src/render/fppMotion';
import { getMaterial } from '../../src/render/materials';
import {
  staffBladeDefinition,
  twinBladesDefinition,
} from '../../src/combat/melee/bladeSchema';
import type { BladeView } from '../../src/combat/melee/plasmaBlade';

const active: { dispose(): void }[] = [];
function keep<T extends { dispose(): void }>(value: T): T {
  active.push(value);
  return value;
}
const identity = new Matrix4();
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
function closeMatrix(actual: Matrix4, expected: Matrix4): void {
  actual.elements.forEach((value, i) =>
    expect(Math.abs(value - expected.elements[i]!)).toBeLessThan(1e-5),
  );
}
function worldVisible(node: Object3D): boolean {
  for (let current: Object3D | null = node; current; current = current.parent)
    if (!current.visible) return false;
  return true;
}
afterEach(() => {
  for (const item of active.splice(0)) item.dispose();
  vi.restoreAllMocks();
});

describe('hand data and joints', () => {
  it('validates all required poses and rejects unknown nodes and missing poses', () => {
    expect(handPosesSchema.safeParse({ poses: handPoses }).success).toBe(true);
    expect(
      handPosesSchema.safeParse({
        poses: { ...handPoses, open: { unknownJoint: [0, 0, 0] } },
      }).success,
    ).toBe(false);
    const missing = { ...handPoses, open: undefined };
    expect(handPosesSchema.safeParse({ poses: missing }).success).toBe(false);
    expect(
      handPosesSchema.safeParse({
        poses: { ...handPoses, open: { wrist: [Infinity, 0, 0] } },
      }).success,
    ).toBe(false);
  });

  it.each(['R', 'L'] as const)(
    'has every pose node and socket in the %s fallback',
    async (side) => {
      const rig = keep(new HandRig(side));
      await rig.load(false);
      for (const name of handNodes)
        expect(rig.root.getObjectByName(name), name).toBeDefined();
      for (const pose of Object.values(handPoses))
        for (const name of Object.keys(pose))
          expect(rig.root.getObjectByName(name)).toBeDefined();
      expect(rig.socketMatrix('socket_blade').determinant()).toBeCloseTo(1);
    },
  );

  it('slerps from rest × Euler XYZ without accumulating, including exact endpoints', () => {
    const rig = keep(new HandRig('R'));
    rig.setPose('open', 'open', 0);
    const node = rig.root.getObjectByName('thumb_1')!;
    const rest = node.quaternion.clone();
    const a = rest
      .clone()
      .multiply(
        new Quaternion().setFromEuler(
          new Euler(...handPoses.gripBlade.thumb_1!, 'XYZ'),
        ),
      );
    const b = rest
      .clone()
      .multiply(
        new Quaternion().setFromEuler(
          new Euler(...handPoses.gripGun.thumb_1!, 'XYZ'),
        ),
      );
    rig.setPose('gripBlade', 'gripGun', 0);
    expect(node.quaternion.equals(a)).toBe(true);
    rig.setPose('gripBlade', 'gripGun', 1);
    expect(node.quaternion.equals(b)).toBe(true);
    rig.setPose('gripBlade', 'gripGun', 0.5);
    expect(node.quaternion.angleTo(a.clone().slerp(b, 0.5))).toBeLessThan(1e-7);
    rig.setPose('gripBlade', 'gripGun', 0);
    expect(node.quaternion.equals(a)).toBe(true);
    // Pominięte stawy wracają do spoczynku.
    const wrist = rig.root.getObjectByName('wrist')!;
    wrist.rotation.x = 1;
    rig.setPose('relaxed', 'open', 1);
    expect(wrist.quaternion.equals(new Quaternion())).toBe(true);
  });

  it.each(['R', 'L'] as const)(
    'aligns %s blade and gun sockets in a nontrivial parent transform',
    (side) => {
      const rig = keep(new HandRig(side));
      const item = new Matrix4().compose(
        new Vector3(2, -0.4, -3),
        new Quaternion().setFromEuler(new Euler(0.7, -0.3, 1.2)),
        new Vector3(1, 1, 1),
      );
      for (const socket of [
        'socket_blade',
        'socket_gun',
        'socket_support',
      ] as const) {
        rig.setPose('gripBlade', 'gripGun', 0.4);
        rig.placeAt(item, socket);
        closeMatrix(
          rig.root.matrix.clone().multiply(rig.socketMatrix(socket)),
          item,
        );
      }
    },
  );
});

describe('FPP items and offhand', () => {
  it('attaches blade hands without mirroring the left rig', async () => {
    const blade = keep(new FppBlade(twinBladesDefinition));
    await blade.load(false);
    blade.place(identity, idle);
    const items = blade.root.children.filter(
      (node) => node.name !== 'hand_R' && node.name !== 'hand_L',
    );
    closeMatrix(
      blade.mainHand.root.matrix
        .clone()
        .multiply(blade.mainHand.socketMatrix('socket_blade')),
      items[0]!.matrix,
    );
    const unmirrored = items[1]!.matrix.clone().scale(new Vector3(-1, 1, 1));
    closeMatrix(
      blade.offHand.root.matrix
        .clone()
        .multiply(blade.offHand.socketMatrix('socket_blade')),
      unmirrored,
    );
    expect(blade.offHand.root.matrix.determinant()).toBeCloseTo(1);
    expect(blade.offHand.root.visible).toBe(true);
  });

  it('keeps an open right hand on throw and hides hands throughout an active staff spin', () => {
    const blade = keep(new FppBlade());
    blade.place(identity, idle);
    const rest = blade.mainHand.root.matrix.clone();
    blade.place(identity, {
      ...idle,
      state: 'throwing',
      flight: {
        previous: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: -1 },
        previousAgeS: 0,
        ageS: 1,
        returning: false,
      },
    });
    expect(worldVisible(blade.mainHand.root)).toBe(true);
    expect(blade.root.children[0]!.visible).toBe(false);
    closeMatrix(blade.mainHand.root.matrix, rest);
    const expected = keep(new HandRig('R'));
    expected.setPose('open', 'open', 0);
    expect(
      blade.mainHand.root
        .getObjectByName('index_2')!
        .quaternion.equals(
          expected.root.getObjectByName('index_2')!.quaternion,
        ),
    ).toBe(true);
    const staff = keep(new FppBlade(staffBladeDefinition));
    for (const phaseT of [0, 0.5, 1]) {
      staff.place(identity, {
        ...idle,
        state: 'heavy',
        phase: 'active',
        phaseT,
      });
      expect(staff.mainHand.root.visible).toBe(false);
    }
    staff.place(identity, idle);
    expect(staff.mainHand.root.visible).toBe(true);
  });

  it('attaches the gun to the right hand and squeezes its finger only for the owner shot', async () => {
    const bus = new EventBus();
    const gun = keep(new FppBlaster(bus, 1));
    await gun.load(false);
    gun.place(identity, 0);
    gun.root.updateMatrixWorld(true);
    closeMatrix(
      gun.hand.root.matrixWorld
        .clone()
        .multiply(gun.hand.socketMatrix('socket_gun')),
      gun.root.matrixWorld,
    );
    expect(gun.root.matrix.elements[12]).toBeGreaterThan(0);
    const finger = gun.hand.root.getObjectByName('index_2')!;
    const rest = finger.quaternion.clone();
    bus.emit('weapon_fired', { owner: 2, weapon: 'blaster' });
    gun.place(identity, 0);
    expect(finger.quaternion.equals(rest)).toBe(true);
    bus.emit('weapon_fired', { owner: 1, weapon: 'blaster' });
    gun.place(identity, 0);
    expect(finger.quaternion.angleTo(rest)).toBeGreaterThan(0.1);
    for (let i = 0; i < 120; i++) gun.place(identity, 1 / 60);
    expect(finger.quaternion.angleTo(rest)).toBeLessThan(1e-5);
    expect(gun.supportMatrix()).toBeNull();
  });

  it('shows a free left hand only with a single blade, supports guns and returns after casting', () => {
    const bus = new EventBus();
    const left = keep(new FppOffhand(bus, 1));
    left.place(identity, 0, 'blade', false);
    expect(left.root.visible).toBe(true);
    const rest = left.root.matrix.clone();
    bus.emit('power_used', { user: 2, power: 'push' });
    left.place(
      identity,
      tuning.hands.castS * tuning.hands.castOutFraction,
      'blade',
      false,
    );
    closeMatrix(left.root.matrix, rest);
    bus.emit('power_used', { user: 1, power: 'push' });
    left.place(
      identity,
      tuning.hands.castS * tuning.hands.castOutFraction,
      'blade',
      false,
    );
    expect(left.root.matrix.elements[14]).toBeLessThan(rest.elements[14]!);
    left.place(identity, tuning.hands.castS, 'blade', false);
    closeMatrix(left.root.matrix, rest);
    left.place(identity, 0, 'blade', true);
    expect(left.root.visible).toBe(false);
    bus.emit('power_used', { user: 1, power: 'push' });
    left.place(identity, tuning.hands.castS / 2, 'blade', true);
    expect(left.root.visible).toBe(false);
    left.place(identity, 0, 'blade', false);
    closeMatrix(left.root.matrix, rest);

    const support = new Matrix4().makeTranslation(-0.08, -0.23, -0.7);
    left.place(identity, 0, 'gun', false, support);
    closeMatrix(
      left.root.matrix
        .clone()
        .multiply(left.rig.socketMatrix('socket_support')),
      support,
    );
    const supported = left.root.matrix.clone();
    bus.emit('power_used', { user: 1, power: 'push' });
    left.place(identity, 0, 'gun', false, support);
    closeMatrix(left.root.matrix, supported);
    left.place(
      identity,
      tuning.hands.castS * tuning.hands.castOutFraction,
      'gun',
      false,
      support,
    );
    expect(left.root.matrix.equals(supported)).toBe(false);
    left.place(
      identity,
      tuning.hands.castS * (1 - tuning.hands.castOutFraction),
      'gun',
      false,
      support,
    );
    closeMatrix(left.root.matrix, supported);
    left.place(identity, 0, 'gun', false);
    expect(left.root.visible).toBe(false);
    bus.emit('power_used', { user: 1, power: 'push' });
    left.place(identity, tuning.hands.castS / 2, 'gun', false);
    expect(left.root.visible).toBe(true);
    left.place(identity, tuning.hands.castS, 'gun', false);
    expect(left.root.visible).toBe(false);
  });

  it('brightens only the casting instance and restores its material', () => {
    const bus = new EventBus();
    const left = keep(new FppOffhand(bus, 1));
    const other = keep(new HandRig('L'));
    const original = getMaterial('power').color.clone();
    const core = left.root.getObjectByName('resonance_core') as Mesh;
    const material = core.material;
    expect(material).not.toBe(getMaterial('power'));
    expect(material).not.toBe(
      (other.root.getObjectByName('resonance_core') as Mesh).material,
    );
    left.place(identity, 0, 'blade', false);
    bus.emit('power_used', { user: 1, power: 'push' });
    left.place(
      identity,
      tuning.hands.castS * tuning.hands.castOutFraction,
      'blade',
      false,
    );
    expect(getMaterial('power').color.equals(original)).toBe(true);
    expect(
      material instanceof MeshBasicMaterial && material.color.equals(original),
    ).toBe(false);
    left.place(identity, tuning.hands.castS, 'blade', false);
    expect(
      material instanceof MeshBasicMaterial && material.color.equals(original),
    ).toBe(true);
  });
});

describe('frame-only hand motion', () => {
  it('lowers the old item then raises the target continuously across the midpoint', () => {
    const motion = new FppMotion();
    const view = {
      held: 'blade',
      target: 'gun',
      swapping: true,
      swapT: 0,
    } as const;
    closeMatrix(motion.place(identity, 0, 0, view), identity);
    const middle = motion
      .place(identity, 0, 0, { ...view, swapT: 0.5 })
      .clone();
    expect(middle.elements[13]).toBeCloseTo(-tuning.hands.swapDropM);
    for (const swapT of [0.5 - 1e-8, 0.5 + 1e-8])
      closeMatrix(motion.place(identity, 0, 0, { ...view, swapT }), middle);
    closeMatrix(motion.place(identity, 0, 0, { ...view, swapT: 1 }), identity);
    expect(shownHeld({ ...view, swapT: 0.49 })).toBe('blade');
    expect(shownHeld({ ...view, swapT: 0.5 })).toBe('gun');
  });

  it('lags behind camera rotation, clamps, recovers, and bobs only when moving', () => {
    const motion = new FppMotion();
    closeMatrix(motion.place(identity, 1 / 60, 0), identity);
    const camera = new Matrix4().makeRotationY(1);
    const result = motion.place(camera, 1 / 60, 0).clone();
    const lag = camera.clone().invert().multiply(result);
    const angle = new Euler().setFromRotationMatrix(lag).y;
    expect(angle).toBeLessThan(0);
    expect(Math.abs(angle)).toBeLessThanOrEqual(tuning.hands.swayMax);
    for (let i = 0; i < 240; i++) motion.place(camera, 1 / 60, 0);
    closeMatrix(motion.place(camera, 1 / 60, 0), camera);
    expect(motion.place(camera, 1 / 60, 7).equals(camera)).toBe(false);
    for (let i = 0; i < 240; i++) motion.place(camera, 1 / 60, 0);
    closeMatrix(motion.place(camera, 1 / 60, 0), camera);
  });
});

it('loads and caches both actual GLBs with independent joints and support transforms', async () => {
  const loader = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockImplementation(async (url) => {
      const bytes = readFileSync(`public${url}`);
      return new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '');
    });
  for (const side of ['R', 'L'] as const) {
    const a = keep(new HandRig(side));
    const b = keep(new HandRig(side));
    await Promise.all([a.load(), b.load()]);
    expect(a.root.getObjectByName('resonance_mount')).toBeDefined();
    for (const name of handNodes)
      expect(a.root.getObjectByName(name)).toBeDefined();
    const rest = b.root.getObjectByName('thumb_1')!.quaternion.clone();
    a.setPose('gripBlade', 'gripBlade', 0);
    expect(b.root.getObjectByName('thumb_1')!.quaternion.equals(rest)).toBe(
      true,
    );
    for (const socket of [
      'socket_blade',
      'socket_gun',
      'socket_support',
    ] as const) {
      const item = new Matrix4()
        .makeRotationX(0.6)
        .setPosition(0.2, -0.24, -0.45);
      a.placeAt(item, socket);
      closeMatrix(a.root.matrix.clone().multiply(a.socketMatrix(socket)), item);
    }
    await a.load(false);
    expect(a.root.getObjectByName('resonance_mount')).toBeUndefined();
    await a.load();
    expect(a.root.getObjectByName('resonance_mount')).toBeDefined();
  }
  expect(loader).toHaveBeenCalledTimes(2);

  const bus = new EventBus();
  const gun = keep(new FppBlaster(bus, 1, { modelOf: (id) => id }));
  bus.emit('weapon_switched', { owner: 1, weapon: 'rifle', slot: 0 });
  await gun.load();
  gun.place(new Matrix4().makeRotationY(0.3).setPosition(2, 1, -3), 0);
  const support = gun.supportMatrix();
  expect(support).not.toBeNull();
  const left = keep(new FppOffhand(bus, 1));
  await left.load();
  left.place(identity, 0, 'gun', false, support);
  expect(left.root.visible).toBe(true);
  closeMatrix(
    left.root.matrix.clone().multiply(left.rig.socketMatrix('socket_support')),
    support!,
  );
  expect(loader).toHaveBeenCalledTimes(3);
});

it('keeps the primitive hierarchy when a model file cannot load', async () => {
  vi.resetModules();
  const { HandRig: UncachedHandRig } = await import('../../src/render/handRig');
  const loader = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockRejectedValue(new Error('Brak modelu'));
  const rig = keep(new UncachedHandRig('R'));
  await rig.load(false);
  expect(loader).not.toHaveBeenCalled();
  await rig.load();
  for (const name of handNodes)
    expect(rig.root.getObjectByName(name)).toBeDefined();
  expect(rig.root.getObjectByName('armor')).toBeDefined();
  expect(loader).toHaveBeenCalledOnce();
});
