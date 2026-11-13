import { describe, expect, it } from 'vitest';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';

describe('physics', () => {
  it('inicjalizuje osadzony WASM tylko raz i koduje grupy kolizji', async () => {
    const [first, second] = await Promise.all([initPhysics(), initPhysics()]);
    expect(first).toBe(second);
    expect(
      interactionGroups(
        CollisionGroup.Player,
        CollisionGroup.World | CollisionGroup.Enemy,
      ),
    ).toBe(0x00020005);
    const world = new first.World({ x: 0, y: -20, z: 0 });
    const body = world.createRigidBody(
      first.RigidBodyDesc.dynamic().setTranslation(0, 6, 0),
    );
    world.createCollider(first.ColliderDesc.cuboid(0.5, 0.5, 0.5), body);
    world.step();
    expect(body.translation().y).toBeLessThan(6);
    world.free();
  });
});
