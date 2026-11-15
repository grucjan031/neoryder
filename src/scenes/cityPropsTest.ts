import { BoxGeometry, Box3, Group, Mesh, Vector3 } from 'three';
import type { BufferGeometry, Object3D, Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import { CityDressing } from '../render/city/dressing';
import type { DressingLayout } from '../render/city/dressing';
import { cloneCityModel } from '../render/cityModels';
import { createStyleLights } from '../render/lights';
import { getMaterial, syncMaterials } from '../render/materials';
import type { MaterialKind } from '../render/materials';
import { SceneAtmosphere } from '../render/sceneAtmosphere';
import type { Scene } from './index';

type Mount = 'block' | 'ground' | 'wall' | 'span';
interface Slot {
  model: string;
  mount: Mount;
  side: -1 | 1;
  z: number;
  /** Odległość od osi ulicy (x = side * dist); dla rozpięć ignorowana. */
  dist: number;
  y: number;
}

/** Lista modeli galerii; nowe modele dopisz tutaj i w `slots`. */
export const CITY_PROP_MODELS = [
  'city_dumpster',
  'city_vending',
  'city_barrier',
  'city_car',
  'city_stall',
  'city_crates',
  'city_generator',
  'city_ac_unit',
  'city_pipe_run',
  'city_fire_escape',
  'city_shutter',
  'city_awning',
  'city_door',
  'city_sign_box',
  'city_street_lamp',
  'city_vent_grate',
  'city_trash_bags',
  'city_traffic_cone',
  'city_holo_projector',
  'city_antenna',
  'city_cable_span',
  'city_lantern_string',
  'city_ad_screen',
  'city_kiosk',
] as const;

const HALF_WIDTH = 5;
const SIDEWALK = 4;
const SPACING = 6;
const START_Z = -18;
const COUNT = 7;
const slot = (
  model: string,
  mount: Mount,
  side: -1 | 1,
  index: number,
  dist = SIDEWALK,
): Slot => ({ model, mount, side, z: START_Z + index * SPACING, dist, y: 0 });
const wallSlot = (model: string, side: -1 | 1, i: number, y: number): Slot => ({
  model,
  mount: 'wall',
  side,
  z: START_Z + SPACING / 2 + i * SPACING,
  dist: HALF_WIDTH,
  y,
});
const span = (model: string, z: number, y: number): Slot => ({
  model,
  mount: 'span',
  side: 1,
  z,
  dist: 0,
  y,
});
const slots: Slot[] = [
  slot('city_dumpster', 'block', -1, 0),
  slot('city_vending', 'block', -1, 1),
  slot('city_barrier', 'block', -1, 2),
  slot('city_car', 'block', -1, 3, 1.9),
  slot('city_stall', 'block', -1, 4),
  slot('city_crates', 'block', -1, 5),
  slot('city_generator', 'block', -1, 6),
  slot('city_street_lamp', 'ground', 1, 0, 4.6),
  slot('city_vent_grate', 'ground', 1, 1, 2),
  slot('city_trash_bags', 'ground', 1, 2),
  slot('city_traffic_cone', 'ground', 1, 3, 2.4),
  slot('city_holo_projector', 'ground', 1, 4, 3),
  slot('city_antenna', 'ground', 1, 5),
  slot('city_kiosk', 'block', 1, 6),
  wallSlot('city_door', -1, 0, 0),
  wallSlot('city_shutter', -1, 1, 0),
  wallSlot('city_pipe_run', -1, 2, 0),
  wallSlot('city_ac_unit', -1, 3, 3),
  wallSlot('city_fire_escape', -1, 4, 2),
  wallSlot('city_awning', 1, 0, 2.6),
  wallSlot('city_sign_box', 1, 1, 3.5),
  wallSlot('city_ad_screen', 1, 2, 0.6),
  span('city_cable_span', -6, 5.6),
  span('city_lantern_string', 6, 5),
];

const LIGHT_COLORS = ['#ffae1a', '#8a5cff', '#6dff4a', '#3d7bff', '#fff1d6'];
type V3 = [number, number, number];
const REVIEW_VIEWS: readonly { from: V3; to: V3 }[] = [
  { from: [0.7, 1.75, 23], to: [-0.2, 2.6, -14] },
  { from: [-0.7, 1.75, -21], to: [0.2, 2.6, 14] },
  { from: [0, 17, 36], to: [0, 0, 0] },
];
const DEFAULT_YAW_DEG = 35;
const FILL_RATIO = 0.65;
const PROP_ELEVATION = 0.2;

function slotYaw(s: Slot): number {
  if (s.mount === 'span') return 0;
  return s.side < 0 ? Math.PI / 2 : -Math.PI / 2;
}

/** Galeria wszystkich modeli miejskich w uliczce Neon Noir do oceny na zrzutach. */
export class CityPropsTest implements Scene {
  readonly id = 'city-props-test';
  private readonly root = new Group();
  private readonly lights = createStyleLights();
  private readonly geometries = new Set<BufferGeometry>();
  private atmosphere?: SceneAtmosphere;
  private dressing?: CityDressing;
  private ctx?: GameContext;
  private disposed = false;
  private readonly params = new URLSearchParams(
    typeof location === 'undefined' ? '' : location.search,
  );
  private focus?: Slot;
  private view = 0;
  private readonly cameraPos = new Vector3();
  private readonly cameraTarget = new Vector3();
  private hasPropCamera = false;

  init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    this.atmosphere = new SceneAtmosphere(
      three,
      'neonStreet',
      'city-props-test',
      0,
    );
    this.root.name = this.id;
    three.add(this.root);
    this.root.add(this.lights);
    const length = SPACING * COUNT + 4;
    this.box([6, 0.3, length], [0, -0.15, 0], 'asphalt');
    for (const side of [-1, 1]) {
      this.box([2.4, 0.3, length], [side * 4.2, -0.15, 0], 'concrete');
      this.box([0.12, 0.15, length], [side * 3.06, 0.075, 0], 'trim');
      for (let i = 0; i < COUNT; i++) {
        this.box(
          [4, 12 + (i % 3) * 2, 5.8],
          [side * (HALF_WIDTH + 2), 6 + (i % 3), START_Z + i * SPACING],
          'facade',
        );
      }
    }
    const requested = this.params.get('prop');
    if (requested) {
      this.focus = slots.find((s) => s.model === requested);
      if (!this.focus)
        console.warn(`city-props-test: nieznany model "${requested}"`);
    }
    const view = Number(this.params.get('view') ?? 0);
    this.view = Number.isInteger(view) && view >= 0 && view <= 2 ? view : 0;
    this.dressing = new CityDressing(
      this.root,
      this.layout(),
      this.atmosphere.theme,
      0,
      'city-props-test',
    );
    this.render(0);
    return this.loadModels();
  }

  private layout(): DressingLayout {
    const lights = [];
    for (let i = 0; i < 8; i++) {
      lights.push({
        position: { x: (i % 2 ? 1 : -1) * 3.4, y: 4, z: -19 + i * 5.4 },
        color: LIGHT_COLORS[i % LIGHT_COLORS.length] ?? '#fff1d6',
        intensity: 48,
        range: 12,
      });
    }
    const f = this.focus;
    if (f) {
      const x = f.mount === 'span' ? 0 : f.side * 3;
      const y = f.mount === 'span' ? f.y - 1 : 2.4;
      lights.push(
        {
          position: { x, y, z: f.z + 2.5 },
          color: '#fff1d6',
          intensity: 26,
          range: 9,
        },
        {
          position: { x, y, z: f.z - 2.5 },
          color: '#3d7bff',
          intensity: 22,
          range: 9,
        },
      );
    }
    return { lights };
  }

  private async loadModels(): Promise<void> {
    const placed = new Map<Slot, Object3D>();
    await Promise.all(
      slots.map(async (s) => {
        const model = await cloneCityModel(s.model);
        if (!model || this.disposed) return;
        model.name = s.model;
        model.position.set(s.mount === 'span' ? 0 : s.side * s.dist, s.y, s.z);
        model.rotation.y = slotYaw(s);
        this.root.add(model);
        placed.set(s, model);
      }),
    );
    if (this.disposed) return;
    if (this.focus) this.frameProp(placed.get(this.focus), this.focus);
    if (typeof document !== 'undefined')
      document.body.dataset.cityPropsReady = '1';
  }

  private frameProp(model: Object3D | undefined, s: Slot): void {
    const camera = this.ctx?.camera;
    if (!model || !camera) return;
    model.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const parsed = Number(this.params.get('yaw') ?? DEFAULT_YAW_DEG);
    const deg = Number.isFinite(parsed) ? parsed : DEFAULT_YAW_DEG;
    const yaw = slotYaw(s) + deg * (Math.PI / 180);
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const horizontal = Math.max(size.x, size.z);
    const need = Math.max(
      size.y / FILL_RATIO,
      horizontal / (FILL_RATIO * Math.max(camera.aspect, 0.5)),
    );
    const dist = need / (2 * tan) + horizontal / 2;
    const dir = new Vector3(Math.sin(yaw), PROP_ELEVATION, Math.cos(yaw));
    this.cameraTarget.copy(center);
    this.cameraPos.copy(center).addScaledVector(dir.normalize(), dist);
    this.cameraPos.y = Math.max(this.cameraPos.y, 0.4);
    this.hasPropCamera = true;
  }

  private box(size: V3, position: V3, kind: MaterialKind): void {
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
    const camera = this.ctx?.camera;
    if (camera) {
      if (this.hasPropCamera) {
        camera.position.copy(this.cameraPos);
        camera.lookAt(this.cameraTarget);
      } else {
        const v = REVIEW_VIEWS[this.view] ?? REVIEW_VIEWS[0]!;
        camera.position.set(...v.from);
        camera.lookAt(...v.to);
      }
      camera.updateMatrixWorld();
    }
    this.dressing?.render(dt, camera);
  }

  dispose(): void {
    this.disposed = true;
    this.dressing?.dispose();
    this.atmosphere?.dispose();
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.clear();
  }
}
