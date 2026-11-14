import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  PointLight,
  SphereGeometry,
} from 'three';
import type { BufferGeometry, Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import { createStyleLights } from '../render/lights';
import { getMaterial, syncMaterials } from '../render/materials';
import type { MaterialKind } from '../render/materials';
import { SceneAtmosphere } from '../render/sceneAtmosphere';
import type { Scene } from './index';

/** Statyczna uliczka do oceny oprawy w 30 sekund, bez zależności od modeli. */
export class NeonTest implements Scene {
  readonly id = 'neon-test';
  private readonly root = new Group();
  private readonly lights = createStyleLights();
  private readonly geometries = new Set<BufferGeometry>();
  private atmosphere?: SceneAtmosphere;
  private ctx?: GameContext;

  init(ctx: GameContext, three: ThreeScene): void {
    this.ctx = ctx;
    this.atmosphere = new SceneAtmosphere(three, 'neonStreet', 'neon-test', 0);
    this.root.name = this.id;
    three.add(this.root);
    this.root.add(this.lights);
    this.box([5.2, 0.3, 30], [0, -0.15, 0], 'asphalt');
    for (const side of [-1, 1]) {
      this.box([1.4, 0.3, 30], [side * 3.3, -0.15, 0], 'concrete');
      this.box([0.12, 0.15, 30], [side * 2.6, 0.075, 0], 'trim');
      for (let i = 0; i < 5; i++) {
        this.box(
          [4, 10 + (i % 3) * 2, 5.8],
          [side * 6, 5 + (i % 3), i * 6 - 12],
          'facade',
        );
        this.box([0.18, 0.28, 5.6], [side * 3.9, 3.3, i * 6 - 12], 'trim');
        this.box([0.3, 1.8, 1.3], [side * 3.8, 1.1, i * 6 - 12], 'metal');
        this.box([0.18, 1.6, 2], [side * 3.85, 2.1, i * 6 - 10], 'glass');
      }
    }
    const neons: {
      kind: MaterialKind;
      color: string;
      position: [number, number, number];
    }[] = [
      { kind: 'neon_amber', color: '#ffae1a', position: [-3.7, 3.8, 6] },
      { kind: 'neon_violet', color: '#8a5cff', position: [3.7, 4, 1] },
      { kind: 'neon_green', color: '#6dff4a', position: [-3.7, 3.6, -5] },
      { kind: 'neon_blue', color: '#3d7bff', position: [3.7, 4.5, -10] },
      { kind: 'neon_white', color: '#fff1d6', position: [0, 5.5, -14] },
    ];
    for (const { kind, color, position } of neons) {
      this.box([0.35, 1.4, 2.2], position, kind);
      const light = new PointLight(color, 22, 9, 2);
      light.position.set(position[0] * 0.85, position[1] - 0.6, position[2]);
      this.root.add(light);
    }
    this.box([1, 1, 1], [-1.7, 0.5, 6], 'interactive');
    this.box([1.4, 0.8, 1], [2, 0.4, -4], 'metal');
    for (const [x, z] of [
      [0, 1],
      [-1.3, -7],
      [1.4, -11],
    ]) {
      const body = new CapsuleGeometry(0.27, 0.85, 4, 8);
      const head = new SphereGeometry(0.22, 10, 8);
      this.geometries.add(body);
      this.geometries.add(head);
      const mannequin = new Mesh(body, getMaterial('enemy'));
      mannequin.position.set(x!, 0.85, z!);
      const face = new Mesh(head, getMaterial('enemy'));
      face.position.set(x!, 1.65, z!);
      this.root.add(mannequin, face);
    }
    this.render(0);
  }
  private box(
    size: [number, number, number],
    position: [number, number, number],
    kind: MaterialKind,
  ): void {
    const geometry = new BoxGeometry(...size);
    this.geometries.add(geometry);
    const mesh = new Mesh(geometry, getMaterial(kind));
    mesh.position.set(...position);
    this.root.add(mesh);
  }
  step(): void {}
  render(_alpha: number, dt = 1 / 60): void {
    syncMaterials();
    this.lights.sync();
    this.atmosphere?.sync(dt);
    const camera = this.ctx?.camera;
    if (camera) {
      camera.position.set(0.7, 1.75, 12.8);
      camera.lookAt(-0.2, 3, -14);
    }
  }
  dispose(): void {
    this.atmosphere?.dispose();
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.clear();
  }
}
