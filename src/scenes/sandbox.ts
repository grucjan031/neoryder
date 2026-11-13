import {
  BoxGeometry,
  Color,
  Fog,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
} from 'three';
import type { Scene as ThreeScene } from 'three';
import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import type { Scene } from './index';
import { initPhysics, CollisionGroup, interactionGroups } from '../physics';
import { palette } from '../render/palette';

interface Pose {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
}
interface Cube {
  id: number;
  body: RigidBody;
  mesh: Mesh<BoxGeometry, MeshBasicMaterial>;
  previous: Pose;
  current: Pose;
}
const pose = (body: RigidBody): Pose => ({
  position: { ...body.translation() },
  rotation: { ...body.rotation() },
});

export class Sandbox implements Scene {
  readonly id = 'sandbox';
  private ctx!: GameContext;
  private three!: ThreeScene;
  private world!: World;
  private rapier!: Awaited<ReturnType<typeof initPhysics>>;
  private readonly cubes: Cube[] = [];
  private floor: Mesh<BoxGeometry, MeshBasicMaterial> | undefined;
  private nextId = 1;
  private readonly cubeGeometry = new BoxGeometry(1, 1, 1);
  private readonly cubeMaterial = new MeshBasicMaterial({
    color: palette.interactive,
  });
  private readonly rotation = new Quaternion();

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    this.three = three;
    this.rapier = await initPhysics();
    three.background = new Color(palette.background);
    three.fog = new Fog(palette.background, 18, 55);
    this.floor = new Mesh(
      new BoxGeometry(60, 1, 60),
      new MeshBasicMaterial({ color: palette.environment }),
    );
    this.floor.position.y = -0.5;
    three.add(this.floor);
    this.reset();
  }

  reset(): void {
    for (const cube of this.cubes) {
      this.three.remove(cube.mesh);
      this.ctx.bus.emit('entity_despawned', { id: cube.id });
    }
    this.cubes.length = 0;
    this.world?.free();
    this.world = new this.rapier.World({
      x: 0,
      y: this.ctx.tuning.physics.gravity,
      z: 0,
    });
    const floor = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0),
    );
    this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(30, 0.5, 30).setCollisionGroups(
        interactionGroups(CollisionGroup.World, 0xffff),
      ),
      floor,
    );
    this.spawnCube();
  }

  spawnCube(): boolean {
    if (this.cubes.length >= this.ctx.tuning.physics.maxDynamicBodies)
      return false;
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.dynamic().setTranslation(
        0,
        this.ctx.tuning.sandbox.cubeSpawnHeight,
        0,
      ),
    );
    this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(0.5, 0.5, 0.5).setCollisionGroups(
        interactionGroups(CollisionGroup.Debris, 0xffff),
      ),
      body,
    );
    const mesh = new Mesh(this.cubeGeometry, this.cubeMaterial);
    mesh.position.copy(body.translation());
    this.three.add(mesh);
    const id = this.nextId++;
    this.cubes.push({
      id,
      body,
      mesh,
      previous: pose(body),
      current: pose(body),
    });
    this.ctx.bus.emit('entity_spawned', { id, kind: 'cube' });
    return true;
  }

  step(dt: number, _input: InputSnapshot): void {
    void _input;
    for (const cube of this.cubes) cube.previous = cube.current;
    if (dt <= 0) return;
    this.world.gravity.y = this.ctx.tuning.physics.gravity;
    this.world.timestep = dt;
    this.world.step();
    for (const cube of this.cubes) cube.current = pose(cube.body);
  }

  render(alpha: number): void {
    for (const cube of this.cubes) {
      const { previous, current, mesh } = cube;
      mesh.position.set(
        previous.position.x +
          (current.position.x - previous.position.x) * alpha,
        previous.position.y +
          (current.position.y - previous.position.y) * alpha,
        previous.position.z +
          (current.position.z - previous.position.z) * alpha,
      );
      mesh.quaternion.copy(previous.rotation);
      this.rotation.copy(current.rotation);
      mesh.quaternion.slerp(this.rotation, alpha);
    }
  }

  query(name: string): unknown {
    if (name === 'cubeY') return this.cubes[0]?.current.position.y;
    if (name === 'bodies') return this.world.bodies.len();
    return undefined;
  }

  dispose(): void {
    for (const cube of this.cubes) {
      this.three.remove(cube.mesh);
      this.ctx.bus.emit('entity_despawned', { id: cube.id });
    }
    this.cubes.length = 0;
    if (this.floor) {
      this.three.remove(this.floor);
      this.floor.geometry.dispose();
      this.floor.material.dispose();
    }
    this.cubeGeometry.dispose();
    this.cubeMaterial.dispose();
    this.world?.free();
    this.three.background = null;
    this.three.fog = null;
  }
}
