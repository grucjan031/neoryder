import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  SphereGeometry,
} from 'three';
import type { BufferGeometry, Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import { CityDressing } from '../render/city/dressing';
import type { DressingLayout } from '../render/city/dressing';
import { createStyleLights } from '../render/lights';
import { getMaterial, syncMaterials } from '../render/materials';
import type { MaterialKind } from '../render/materials';
import { SceneAtmosphere } from '../render/sceneAtmosphere';
import type { Scene } from './index';

const wall = (x: number, y: number, z: number) => ({
  position: { x, y, z },
  yaw: x < 0 ? Math.PI / 2 : -Math.PI / 2,
});
const dressing: DressingLayout = {
  signs: [
    {
      kind: 'neon',
      texture: 'ramen',
      ...wall(-3.7, 3.2, 6),
      size: { w: 2.4, h: 1.2 },
      flicker: 0.3,
    },
    {
      kind: 'neon',
      texture: 'hotel',
      ...wall(3.7, 4, 1),
      size: { w: 2.4, h: 1.2 },
      flicker: 0.5,
    },
    {
      kind: 'neon',
      texture: 'open',
      ...wall(-3.7, 3, -5),
      size: { w: 2, h: 1 },
      flicker: 0.8,
    },
    {
      kind: 'neon',
      texture: 'arrow',
      ...wall(3.7, 4.5, -10),
      size: { w: 2.4, h: 1.2 },
    },
    {
      kind: 'neon',
      texture: 'bar_24h',
      position: { x: 0, y: 5.2, z: -14 },
      yaw: 0,
      size: { w: 3.2, h: 1.6 },
      flicker: 0.2,
    },
    {
      kind: 'holo',
      texture: 'holo_android',
      position: { x: 2.2, y: 2.4, z: -6.5 },
      yaw: -0.3,
      size: { w: 1.2, h: 2.4 },
      tint: '#8a5cff',
      flicker: 0.3,
    },
  ],
  lights: [
    {
      position: { x: -3.2, y: 3.3, z: 6 },
      color: '#ffae1a',
      intensity: 22,
      range: 9,
    },
    {
      position: { x: 3.2, y: 3.8, z: 1 },
      color: '#8a5cff',
      intensity: 22,
      range: 9,
    },
    {
      position: { x: -3.2, y: 3, z: -5 },
      color: '#6dff4a',
      intensity: 22,
      range: 9,
    },
    {
      position: { x: 3.2, y: 4.2, z: -10 },
      color: '#3d7bff',
      intensity: 22,
      range: 9,
    },
    {
      position: { x: 0, y: 4.8, z: -12 },
      color: '#fff1d6',
      intensity: 22,
      range: 9,
    },
  ],
  decals: [
    {
      texture: 'graffiti_tag1',
      ...wall(-3.7, 1.4, -2),
      size: { w: 1.5, h: 1.5 },
      surface: 'wall',
    },
    {
      texture: 'poster_torn1',
      ...wall(3.7, 1.4, -8),
      size: { w: 1.2, h: 1.2 },
      surface: 'wall',
      opacity: 0.85,
    },
    {
      texture: 'floor_arrow',
      position: { x: 0, y: 0, z: -1 },
      yaw: 0,
      size: { w: 2, h: 2 },
      surface: 'floor',
      opacity: 0.5,
    },
    {
      texture: 'puddle1',
      position: { x: -1, y: 0, z: 4 },
      yaw: 0.4,
      size: { w: 2.2, h: 2.2 },
      surface: 'floor',
    },
    {
      texture: 'puddle2',
      position: { x: 1.2, y: 0, z: -9 },
      yaw: 1,
      size: { w: 2.2, h: 2.2 },
      surface: 'floor',
    },
  ],
  ambientFx: [
    { kind: 'steam', position: { x: -2.2, y: 0.05, z: 2 } },
    { kind: 'steam', position: { x: 2.4, y: 0.05, z: -9 } },
    { kind: 'sparks', position: { x: -3.6, y: 4.3, z: -7 } },
    { kind: 'drip', position: { x: 3.6, y: 4.5, z: -2 } },
  ],
};

/** Statyczna uliczka do oceny oprawy w 30 sekund, bez zależności od modeli. */
export class NeonTest implements Scene {
  readonly id = 'neon-test';
  private readonly root = new Group();
  private readonly lights = createStyleLights();
  private readonly geometries = new Set<BufferGeometry>();
  private atmosphere?: SceneAtmosphere;
  private dressing?: CityDressing;
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
    this.dressing = new CityDressing(
      this.root,
      dressing,
      this.atmosphere.theme,
      0,
      'neon-test',
    );
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
  step(dt = 0): void {
    this.dressing?.step(dt);
  }
  render(_alpha: number, dt = 1 / 60): void {
    syncMaterials();
    this.lights.sync();
    this.atmosphere?.sync(dt);
    this.dressing?.render(dt, this.ctx?.camera);
    const camera = this.ctx?.camera;
    if (camera) {
      camera.position.set(0.7, 1.75, 12.8);
      camera.lookAt(-0.2, 3, -14);
    }
  }
  dispose(): void {
    this.dressing?.dispose();
    this.atmosphere?.dispose();
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.clear();
  }
}
