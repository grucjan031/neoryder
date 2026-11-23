import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';
import type {
  PropKind,
  PropPhysicsSystem,
  PropView,
} from '../world/propPhysics';
import { getMaterial } from './materials';

/** Jedna siatka modelu skrzyni: geometria, materiał i macierz względem początku modelu (środek podstawy). */
export interface PropTemplate {
  geometry: BufferGeometry;
  material: Material | Material[];
  matrix: Matrix4;
}

/** Wyciąga siatki z sklonowanego modelu (początek modelu = środek podstawy bryły). */
export function propTemplatesFromModel(model: Object3D): PropTemplate[] {
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld(true);
  const templates: PropTemplate[] = [];
  model.traverse((node) => {
    if (node instanceof Mesh)
      templates.push({
        geometry: node.geometry,
        material: node.material,
        matrix: node.matrixWorld.clone(),
      });
  });
  return templates;
}

interface Layer {
  mesh: InstancedMesh;
  template: PropTemplate;
  /** Czy macierz jest skalowana do rozmiaru bloku (siatka zastępcza jednostkowego boxa). */
  scaled: boolean;
}

/**
 * Rysuje zniszczalne skrzynie jako `InstancedMesh` (jedna siatka na część modelu i rodzaj),
 * z interpolacją między krokami symulacji. Uśpione skrzynie nie odświeżają macierzy.
 */
export class PropRenderer {
  readonly root = new Group();
  private readonly layers = new Map<PropKind, Layer[]>();
  private readonly fallbackGeometry = new BoxGeometry(1, 1, 1);
  private readonly center = new Vector3();
  private readonly quat = new Quaternion();
  private readonly scale = new Vector3();
  private readonly instance = new Matrix4();
  private readonly local = new Matrix4();
  private lastRevision = -1;
  private wasAwake = false;
  private readonly next = new Quaternion();

  /**
   * `capacity`: liczba rekwizytów danego rodzaju w chwili budowy (pojemność instancji).
   * `templates`: siatki modelu per rodzaj; brak = jednostkowy box w materiale `interactive`.
   */
  constructor(
    private readonly system: PropPhysicsSystem,
    capacity: Partial<Record<PropKind, number>>,
    templates: Partial<Record<PropKind, readonly PropTemplate[]>> = {},
  ) {
    this.root.name = 'destructible-props';
    for (const kind of ['crate', 'crate_small'] as const) {
      const count = capacity[kind] ?? 0;
      if (count <= 0) continue;
      const own = templates[kind];
      const list: PropTemplate[] = own?.length
        ? [...own]
        : [
            {
              geometry: this.fallbackGeometry,
              material: getMaterial('interactive'),
              matrix: new Matrix4(),
            },
          ];
      const layers = list.map((template): Layer => {
        const mesh = new InstancedMesh(
          template.geometry,
          template.material,
          count,
        );
        mesh.name = `props:${kind}`;
        mesh.frustumCulled = false;
        mesh.count = 0;
        this.root.add(mesh);
        return { mesh, template, scaled: !own?.length };
      });
      this.layers.set(kind, layers);
    }
  }

  render(alpha: number): void {
    const awake = this.system.awakeCount > 0;
    // Jeszcze jedna klatka po uśpieniu ostatniej skrzyni, żeby osiadła w pozycji końcowej.
    if (this.system.revision === this.lastRevision && !awake && !this.wasAwake)
      return;
    this.wasAwake = awake;
    this.lastRevision = this.system.revision;
    const counts = new Map<PropKind, number>();
    this.system.forEach((view) => {
      const layers = this.layers.get(view.kind);
      if (!layers) return;
      const index = counts.get(view.kind) ?? 0;
      counts.set(view.kind, index + 1);
      this.compose(view, alpha);
      for (const layer of layers) {
        if (index >= layer.mesh.instanceMatrix.count) continue;
        if (layer.scaled) {
          this.local.makeScale(view.size.x, view.size.y, view.size.z);
          layer.mesh.setMatrixAt(index, this.local.premultiply(this.instance));
        } else {
          // Początek modelu leży w środku podstawy bryły.
          this.local
            .makeTranslation(0, -view.size.y / 2, 0)
            .multiply(layer.template.matrix)
            .premultiply(this.instance);
          layer.mesh.setMatrixAt(index, this.local);
        }
      }
    });
    for (const [kind, layers] of this.layers)
      for (const layer of layers) {
        layer.mesh.count = counts.get(kind) ?? 0;
        layer.mesh.instanceMatrix.needsUpdate = true;
      }
  }

  private compose(view: PropView, alpha: number): void {
    const a = Math.max(0, Math.min(1, alpha));
    const p = view.previousPosition;
    const c = view.position;
    this.center.set(
      p.x + (c.x - p.x) * a,
      p.y + (c.y - p.y) * a,
      p.z + (c.z - p.z) * a,
    );
    this.quat
      .set(
        view.previousQuat.x,
        view.previousQuat.y,
        view.previousQuat.z,
        view.previousQuat.w,
      )
      .slerp(
        this.next.set(view.quat.x, view.quat.y, view.quat.z, view.quat.w),
        a,
      );
    this.scale.set(1, 1, 1);
    this.instance.compose(this.center, this.quat, this.scale);
  }

  dispose(): void {
    for (const layers of this.layers.values())
      for (const layer of layers) {
        layer.mesh.removeFromParent();
        layer.mesh.dispose();
      }
    this.layers.clear();
    this.fallbackGeometry.dispose();
    this.root.removeFromParent();
  }
}
