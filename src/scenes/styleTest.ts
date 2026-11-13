import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh } from 'three';
import type { BufferGeometry, Material, Scene as ThreeScene } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GameContext } from '../core/context';
import { createStyleLights } from '../render/lights';
import { applyStyle, getMaterial, syncMaterials } from '../render/materials';
import type { MaterialKind } from '../render/materials';
import { palette } from '../render/palette';
import type { Scene } from './index';

type Position = readonly [number, number, number];
interface Exhibit {
  model: string;
  size: Position;
  kind: MaterialKind;
  positions: readonly Position[];
}

const exhibits: readonly Exhibit[] = [
  {
    model: 'wall_segment',
    size: [4, 3, 0.4],
    kind: 'world',
    positions: [
      [-4, 0, -4],
      [0, 0, -4],
      [4, 0, -4],
    ],
  },
  {
    model: 'pillar',
    size: [1, 4, 1],
    kind: 'world',
    positions: [
      [-5, 0, -2],
      [5, 0, -2],
    ],
  },
  {
    model: 'cover_low',
    size: [2, 1, 0.6],
    kind: 'world',
    positions: [
      [-3.5, 0, -0.5],
      [3.5, 0, -0.5],
    ],
  },
  {
    model: 'crate',
    size: [1, 1, 1],
    kind: 'interactive',
    positions: [[-3.5, 0, 1.5]],
  },
  {
    model: 'crate_small',
    size: [0.5, 0.5, 0.5],
    kind: 'interactive',
    positions: [[-2.4, 0, 1.8]],
  },
  {
    model: 'enemy_trooper',
    size: [0.7, 1.84, 0.5],
    kind: 'enemy',
    positions: [[-1.5, 0, -1.8]],
  },
  {
    model: 'enemy_gunner',
    size: [0.55, 1.84, 0.5],
    kind: 'enemy',
    positions: [[1.3, 0, -2]],
  },
  {
    model: 'plasma_blade',
    size: [0.12, 0.12, 1.3],
    kind: 'player',
    positions: [[0.1, 1, 1.7]],
  },
  {
    model: 'blaster',
    size: [0.18, 0.25, 0.65],
    kind: 'interactive',
    positions: [[1.3, 1.05, 1.7]],
  },
  {
    model: 'enemy_projectile',
    size: [0.1, 0.1, 0.5],
    kind: 'enemyGlow',
    positions: [[-0.4, 1.3, 0.2]],
  },
];

export class StyleTest implements Scene {
  readonly id = 'style-test';
  private readonly root = new Group();
  private readonly lights = createStyleLights();
  private three?: ThreeScene;
  private ctx?: GameContext;
  private previousBackground: ThreeScene['background'] = null;

  constructor(private readonly loadModels = true) {}

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    this.three = three;
    this.previousBackground = three.background;
    three.background = new Color(palette.background);
    this.root.name = 'style-test';
    three.add(this.root);
    this.root.add(this.lights);
    this.root.add(this.box([14, 0.2, 12], [0, -0.2, -0.5], 'world'));
    const stand = this.box([2.4, 0.8, 1.8], [0.7, 0, 1.4], 'world');
    stand.name = 'weapon-stand';
    this.root.add(stand);
    const power = this.box([0.25, 0.25, 0.25], [2.2, 1.2, 0.6], 'power');
    power.name = 'resonance-sample';
    power.rotation.set(0.3, 0.5, 0.3);
    this.root.add(power);
    const loader = new GLTFLoader();
    await Promise.all(
      exhibits.map(async (exhibit) => {
        let model: Group;
        if (this.loadModels) {
          try {
            model = (
              await loader.loadAsync(`/assets/models/${exhibit.model}.glb`)
            ).scene;
            const originals = new Set<Material>();
            model.traverse((object) => {
              if (!(object instanceof Mesh)) return;
              const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
              for (const material of materials) originals.add(material);
            });
            applyStyle(model);
            for (const material of originals) material.dispose();
          } catch {
            model = this.fallback(exhibit);
          }
        } else model = this.fallback(exhibit);
        this.addExhibit(model, exhibit);
      }),
    );
    applyStyle(this.root);
    this.render();
  }

  private box(size: Position, position: Position, kind: MaterialKind): Mesh {
    const mesh = new Mesh(new BoxGeometry(...size), getMaterial(kind));
    mesh.position.set(position[0], position[1] + size[1] / 2, position[2]);
    return mesh;
  }

  private fallback(exhibit: Exhibit): Group {
    const model = new Group();
    model.add(this.box(exhibit.size, [0, 0, 0], exhibit.kind));
    if (exhibit.kind === 'enemy') {
      model.add(this.box([0.4, 0.08, 0.04], [0, 1.55, 0.27], 'enemyGlow'));
    }
    if (exhibit.model === 'plasma_blade') {
      model.add(this.box([0.16, 0.16, 0.25], [0, 0, 0.7], 'interactive'));
    }
    if (exhibit.model === 'blaster') {
      model.add(this.box([0.19, 0.04, 0.3], [0, 0.18, 0], 'player'));
    }
    applyStyle(model);
    return model;
  }

  private addExhibit(model: Group, exhibit: Exhibit): void {
    if (exhibit.positions.length === 1) {
      model.name = exhibit.model;
      model.position.set(...exhibit.positions[0]!);
      this.root.add(model);
      return;
    }
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const instances = new InstancedMesh(
        object.geometry,
        object.material,
        exhibit.positions.length,
      );
      instances.name = exhibit.model;
      const matrix = new Matrix4();
      exhibit.positions.forEach((position, index) => {
        matrix.makeTranslation(...position).multiply(object.matrixWorld);
        instances.setMatrixAt(index, matrix);
      });
      instances.instanceMatrix.needsUpdate = true;
      this.root.add(instances);
    });
  }

  step(): void {}

  render(): void {
    syncMaterials();
    this.lights.sync();
    const camera = this.ctx?.camera;
    if (!camera) return;
    camera.position.set(4, 3.4, 5.5);
    camera.lookAt(0, 1.2, -1);
  }

  dispose(): void {
    const geometries = new Set<BufferGeometry>();
    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      geometries.add(object.geometry);
      if (object instanceof InstancedMesh) object.dispose();
    });
    for (const geometry of geometries) geometry.dispose();
    this.root.removeFromParent();
    this.root.clear();
    if (this.three) this.three.background = this.previousBackground;
    this.three = undefined;
    this.ctx = undefined;
  }
}
