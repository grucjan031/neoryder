import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { Scene as ThreeScene } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { World } from '@dimforge/rapier3d-compat';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import type { Vec3 } from '../core/math';
import { loadSettings } from '../core/save';
import { initPhysics, CollisionGroup, interactionGroups } from '../physics';
import { PlayerController } from '../player/playerController';
import type { PlayerState } from '../player/playerController';
import { palette } from '../render/palette';
import type { Scene } from './index';

export class PlayerTest implements Scene {
  readonly id = 'player-test';
  private commandOff?: () => void;
  private ctx!: GameContext;
  private three!: ThreeScene;
  private world!: World;
  private player!: PlayerController;
  private previous!: PlayerState;
  private readonly root = new Group();

  constructor(private readonly loadModels = true) {}

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    this.three = three;
    const rapier = await initPhysics();
    this.world = new rapier.World({
      x: 0,
      y: ctx.tuning.physics.gravity,
      z: 0,
    });
    three.background = new Color(palette.background);
    three.add(this.root);
    this.root.add(new AmbientLight(0xffffff, 2));
    const light = new DirectionalLight(0xffffff, 3);
    light.position.set(5, 10, 5);
    this.root.add(light);

    const box = (
      size: Vec3,
      position: Vec3,
      angle = 0,
      color: string = palette.environment,
    ): Mesh<BoxGeometry, MeshStandardMaterial> => {
      const mesh = new Mesh(
        new BoxGeometry(size.x, size.y, size.z),
        new MeshStandardMaterial({ color, roughness: 1, flatShading: true }),
      );
      mesh.position.copy(position);
      mesh.rotation.x = angle;
      this.root.add(mesh);
      this.world.createCollider(
        rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
          .setTranslation(position.x, position.y, position.z)
          .setRotation({
            x: Math.sin(angle / 2),
            y: 0,
            z: 0,
            w: Math.cos(angle / 2),
          })
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
      return mesh;
    };
    box({ x: 60, y: 1, z: 60 }, { x: 0, y: -0.5, z: 0 });
    for (let i = 0; i < 6; i++) {
      const height = (i + 1) * 0.25;
      box({ x: 3, y: height, z: 1 }, { x: -6, y: height / 2, z: -3 - i });
    }
    for (const [x, degrees] of [
      [0, 30],
      [6, 55],
    ] as const) {
      const angle = (degrees * Math.PI) / 180;
      const length = 6;
      box(
        { x: 3, y: 0.3, z: length },
        {
          x,
          y: (Math.sin(angle) * length) / 2,
          z: -7,
        },
        angle,
      );
    }
    for (const [x, y, z] of [
      [-8, 1.5, 5],
      [-8, 3, 9],
      [-8, 4.5, 13],
    ] as const) {
      box({ x: 3, y: 0.5, z: 3 }, { x, y, z });
    }

    const props = [
      { model: 'crate', size: { x: 1, y: 1, z: 1 }, x: 3, z: 3 },
      { model: 'crate', size: { x: 1, y: 1, z: 1 }, x: 5, z: 4 },
      { model: 'crate', size: { x: 1, y: 1, z: 1 }, x: 3, z: 6 },
      { model: 'pillar', size: { x: 1, y: 4, z: 1 }, x: 10, z: -3 },
      { model: 'wall_segment', size: { x: 4, y: 3, z: 0.4 }, x: 12, z: 2 },
      { model: 'cover_low', size: { x: 2, y: 1, z: 0.6 }, x: -3, z: 3 },
    ];
    const loader = new GLTFLoader();
    await Promise.all(
      props.map(async ({ model, size, x, z }) => {
        const fallback = box(
          size,
          { x, y: size.y / 2, z },
          0,
          model === 'crate' ? palette.interactive : palette.environment,
        );
        if (!this.loadModels) return;
        try {
          const gltf = await loader.loadAsync(`/assets/models/${model}.glb`);
          this.root.remove(fallback);
          fallback.geometry.dispose();
          fallback.material.dispose();
          gltf.scene.position.set(x, 0, z);
          this.root.add(gltf.scene);
        } catch {
          // Prosta bryła pozostaje grywalnym zamiennikiem brakującego modelu.
        }
      }),
    );
    this.player = new PlayerController(
      1,
      this.world,
      ctx,
      this.spawnPosition(),
      loadSettings(),
    );
    this.previous = this.player.getState();
    // Pierwszy krok indeksuje statyczne collidery przed zapytaniami kontrolera.
    this.world.step();
    this.render(1);
    this.commandOff = ctx.commands?.register('tp', 'tp <x> <y> <z>', (args) => {
      const [x, y, z] = args.map(Number);
      if (
        args.length !== 3 ||
        x === undefined ||
        y === undefined ||
        z === undefined ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z)
      )
        return 'Podaj trzy skończone współrzędne.';
      this.teleport({ x, y, z });
      return 'Gracz teleportowany.';
    });
  }

  private spawnPosition(): Vec3 {
    return {
      x: 0,
      y:
        this.ctx.tuning.player.capsuleHeight / 2 +
        this.ctx.tuning.player.controllerOffset,
      z: 0,
    };
  }

  reset(): void {
    this.teleport(this.spawnPosition());
  }

  teleport(position: Vec3): void {
    this.player.teleport(position);
    this.previous = this.player.getState();
  }

  step(dt: number, input: InputSnapshot): void {
    this.previous = this.player.getState();
    this.player.step(dt, input);
    if (dt <= 0) return;
    this.world.gravity.y = this.ctx.tuning.physics.gravity;
    this.world.timestep = dt;
    this.world.step();
  }

  render(alpha: number): void {
    const camera = this.ctx.camera;
    if (!camera) return;
    const current = this.player.getState();
    const p = this.previous;
    camera.position.set(
      p.position.x + (current.position.x - p.position.x) * alpha,
      p.position.y +
        (current.position.y - p.position.y) * alpha -
        this.ctx.tuning.player.capsuleHeight / 2 +
        this.ctx.tuning.player.eyeHeight,
      p.position.z + (current.position.z - p.position.z) * alpha,
    );
    camera.rotation.set(
      p.pitch + (current.pitch - p.pitch) * alpha,
      p.yaw + (current.yaw - p.yaw) * alpha,
      0,
      'YXZ',
    );
  }

  query(name: string): unknown {
    const state = this.player.getState();
    if (name === 'playerPos') return state.position;
    if (name === 'playerVel') return state.velocity;
    if (name === 'grounded') return state.grounded;
    return undefined;
  }

  dispose(): void {
    this.commandOff?.();
    this.player.dispose();
    this.world.free();
    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) material.dispose();
    });
    this.three.remove(this.root);
    this.root.clear();
    this.three.background = null;
  }
}
