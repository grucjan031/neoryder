import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Euler, Matrix4 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  loadWeapon,
  weaponDefinitions,
  weaponGripOfModel,
  weaponGripSchema,
} from '../../src/combat/weapons/weaponSchema';
import { isHandPose } from '../../src/render/handPoses';
import { FppBlaster } from '../../src/render/fppBlaster';
import { EventBus } from '../../src/core/events';
import pistol from '../../src/data/weapons/pistol.json';

const grip = {
  offset: [0.001, -0.01, 0.02],
  rotation: [0.1, 0, 0],
  pose: 'gripPistol',
  firePose: 'gripPistolFire',
  support: { offset: [0, 0.01, 0], pose: 'supportRifle' },
};

afterEach(() => vi.restoreAllMocks());

describe('chwyt broni (pole grip)', () => {
  it('waliduje przesunięcie, obrót, pozy i opcjonalną dłoń podpierającą', () => {
    expect(weaponGripSchema.safeParse(grip).success).toBe(true);
    const minimal = {
      offset: grip.offset,
      pose: grip.pose,
      firePose: grip.firePose,
    };
    expect(weaponGripSchema.safeParse(minimal).success).toBe(true);
    expect(
      weaponGripSchema.safeParse({ ...grip, offset: [0, Infinity, 0] }).success,
    ).toBe(false);
    expect(
      weaponGripSchema.safeParse({ ...grip, offset: [0, 0] }).success,
    ).toBe(false);
    expect(weaponGripSchema.safeParse({ ...grip, pose: '' }).success).toBe(
      false,
    );
    expect(
      weaponGripSchema.safeParse({ ...grip, extra: 1 } as unknown).success,
    ).toBe(false);
    expect(
      weaponGripSchema.safeParse({
        ...grip,
        support: { offset: [0, 0, 0] },
      }).success,
    ).toBe(false);
    expect(() =>
      loadWeapon({ ...pistol, grip: { offset: [0, 0, 0] } }),
    ).toThrow();
    expect(loadWeapon({ ...pistol, grip }).grip).toEqual(grip);
  });

  it('każda broń ma chwyt z istniejącymi pozami dłoni', () => {
    expect(weaponDefinitions.size).toBe(10);
    for (const definition of weaponDefinitions.values()) {
      const g = definition.grip;
      expect(g, definition.id).toBeDefined();
      for (const name of [g!.pose, g!.firePose, g!.support?.pose ?? 'support'])
        expect(isHandPose(name), `${definition.id}: ${name}`).toBe(true);
      expect(weaponGripOfModel(definition.model!)).toBe(g);
    }
    expect(weaponGripOfModel('brak_modelu')).toBeUndefined();
  });

  it('FppBlaster stawia dłoń i pozę według chwytu bieżącego modelu', async () => {
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(
      async (url) => {
        const bytes = readFileSync(`public${url}`);
        return new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '');
      },
    );
    const bus = new EventBus();
    const gun = new FppBlaster(bus, 1, {
      modelOf: (id) => weaponDefinitions.get(id)?.model,
    });
    try {
      await gun.load();
      for (const id of ['pistol', 'rifle'] as const) {
        bus.emit('weapon_switched', { owner: 1, weapon: id, slot: 0 });
        await gun.load();
        gun.place(new Matrix4(), 0);
        const g = weaponDefinitions.get(id)!.grip!;
        const [rx = 0, ry = 0, rz = 0] = g.rotation ?? [];
        const expected = new Matrix4()
          .makeRotationFromEuler(new Euler(rx, ry, rz, 'XYZ'))
          .setPosition(...g.offset);
        const actual = gun.hand.root.matrix
          .clone()
          .multiply(gun.hand.socketMatrix('socket_gun'));
        actual.elements.forEach((value, i) =>
          expect(value).toBeCloseTo(expected.elements[i]!, 5),
        );
        expect(gun.supportPose).toBe(g.support?.pose ?? 'support');
      }
    } finally {
      gun.dispose();
    }
  });
});
