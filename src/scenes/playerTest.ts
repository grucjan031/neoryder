import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  GridHelper,
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
import { FppLegs } from '../render/fppLegs';
import { PlayerController } from '../player/playerController';
import playerData from '../data/scenes/playerTest.json';
import type { PlayerState } from '../player/playerController';
import { FpsCamera } from '../player/fpsCamera';
import { palette } from '../render/palette';
import type { Scene } from './index';

export class PlayerTest implements Scene {
  private readonly commandOffs: (() => void)[] = [];
  private fpsCamera!: FpsCamera;
  private ctx!: GameContext;
  private three!: ThreeScene;
  private world!: World;
  private player!: PlayerController;
  private legs?: FppLegs;
  private previous!: PlayerState;
  private readonly root = new Group();
  private grid?: GridHelper;
  private spawnX = 0;

  constructor(
    private readonly loadModels = true,
    readonly id: 'player-test' | 'legsTest' = 'player-test',
  ) {}

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
    const floor = box({ x: 60, y: 1, z: 60 }, { x: 0, y: -0.5, z: 0 });
    if (this.id === 'legsTest') {
      const size = floor.geometry.parameters.width;
      this.grid = new GridHelper(
        size,
        size,
        palette.interactive,
        palette.interactive,
      );
      floor.material.polygonOffset = true;
      floor.material.polygonOffsetFactor =
        floor.material.polygonOffsetUnits = 1;
      this.root.add(this.grid);
    }
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

    // Tor dashu i slide: niski tunel (prześwit 1,25 m — tylko w ślizgu) i ściana do dashu.
    for (const x of [14.6, 17.4])
      box({ x: 0.4, y: 1.25, z: 8 }, { x, y: 0.625, z: -6 });
    const tunnel = box({ x: 3.2, y: 0.4, z: 8 }, { x: 16, y: 1.45, z: -6 });
    if (this.id === 'legsTest') this.spawnX = tunnel.position.x;
    box({ x: 6, y: 3, z: 0.4 }, { x: -14, y: 1.5, z: -8 });

    // Długa rampa zjazdowa 25° (14 m) kończąca się niskim tunelem: napęd ślizgu stokiem, slide-jump z pędem,
    // bufor ślizgu przy lądowaniu. Wejdź na górę (+z), zawróć, sprint w dół (-z) i Ctrl.
    {
      const angle = (25 * Math.PI) / 180;
      const length = 14;
      box(
        { x: 4, y: 0.3, z: length },
        { x: 24, y: (Math.sin(angle) * length) / 2, z: 0 },
        -angle,
      );
      const foot = (Math.cos(angle) * length) / 2;
      for (const x of [22.2, 25.8])
        box({ x: 0.4, y: 1.25, z: 6 }, { x, y: 0.625, z: -(foot + 4.5) });
      box({ x: 4, y: 0.4, z: 6 }, { x: 24, y: 1.45, z: -(foot + 4.5) });
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
      playerData,
    );
    this.previous = this.player.getState();
    this.fpsCamera = new FpsCamera(ctx.tuning, this.player.id, ctx.bus);
    if (ctx.camera && this.loadModels)
      this.legs = new FppLegs(three, ctx.tuning);
    // Pierwszy krok indeksuje statyczne collidery przed zapytaniami kontrolera.
    this.world.step();
    this.render(1);
    const tpOff = ctx.commands?.register('tp', 'tp <x> <y> <z>', (args) => {
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
    const shakeOff = ctx.commands?.register(
      'shake',
      'shake <0..1> [s] — wstrząs kamery',
      (args) => {
        const intensity = Number(args[0]);
        const durationS = args[1] === undefined ? 0.5 : Number(args[1]);
        if (!Number.isFinite(intensity) || !Number.isFinite(durationS))
          return 'Podaj intensywność 0..1 i opcjonalnie czas w s.';
        ctx.bus.emit('camera_shake', { intensity, durationS, dir: null });
        return `Wstrząs ${intensity} przez ${durationS} s.`;
      },
    );
    for (const off of [tpOff, shakeOff]) if (off) this.commandOffs.push(off);
  }

  private spawnPosition(): Vec3 {
    return {
      x: this.spawnX,
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

  render(alpha: number, frameDt = 1 / 60): void {
    const camera = this.ctx.camera;
    if (!camera) return;
    const playerState = this.player.getState();
    this.legs?.update(this.previous, playerState, alpha, frameDt);
    const pose = this.fpsCamera.update(
      frameDt,
      this.previous,
      playerState,
      alpha,
    );
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
    if (Math.abs(camera.fov - pose.fov) > 1e-3) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
  }

  query(name: string): unknown {
    const state = this.player.getState();
    if (name === 'playerPos') return state.position;
    if (name === 'playerVel') return state.velocity;
    if (name === 'grounded') return state.grounded;
    if (name === 'sliding') return state.sliding;
    if (name === 'crouched') return state.crouched;
    if (name === 'height') return state.height;
    if (name === 'dashCooldown') return state.dashCooldownS;
    if (name === 'trauma') return this.fpsCamera.currentTrauma;
    if (name === 'fov') return this.fpsCamera.currentFov;
    return undefined;
  }

  dispose(): void {
    for (const off of this.commandOffs.splice(0)) off();
    this.grid?.dispose();
    this.legs?.dispose();
    this.fpsCamera.dispose();
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
