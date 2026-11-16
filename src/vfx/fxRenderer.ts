import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import type { FxInstance } from './fxPool';
import type { HitSparks } from './hitSparks';
import type { StatusVfx } from './statusVfx';

const Y = new Vector3(0, 1, 0);
const FLAME_TOP = new Color('#ffffff');
const FLAME_RING = new Color('#ff8a1f');
const FLAME_BASE = new Color('#e0262b');

/** Dwustożek z gradientem wierzchołków: czerwona podstawa, pomarańczowy pas, biały rdzeń na czubku. */
function flameGeometry(): BufferGeometry {
  const ring = [
    [0.5, 0, 0.5],
    [-0.5, 0, 0.5],
    [-0.5, 0, -0.5],
    [0.5, 0, -0.5],
  ] as const;
  const positions: number[] = [];
  const colors: number[] = [];
  const push = (v: readonly number[], c: Color): void => {
    positions.push(v[0]!, v[1]!, v[2]!);
    colors.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < 4; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % 4]!;
    push([0, 1, 0], FLAME_TOP);
    push(a, FLAME_RING);
    push(b, FLAME_RING);
    push([0, -1, 0], FLAME_BASE);
    push(b, FLAME_RING);
    push(a, FLAME_RING);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g;
}

/** Płaski trójkąt równoboczny w płaszczyźnie XZ (gwiazdka ogłuszenia). */
function triangleGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute(
    'position',
    new Float32BufferAttribute([0, 0, 1, 0.87, 0, -0.5, -0.87, 0, -0.5], 3),
  );
  return g;
}

/** Jedna InstancedMesh z interpolowanym wypełnianiem z dowolnego źródła FxInstance. */
class InstancedFx {
  readonly mesh: InstancedMesh;
  private readonly transform = new Object3D();
  private readonly quat = new Quaternion();
  private readonly spin = new Quaternion();
  private readonly dir = new Vector3();
  private readonly color = new Color();

  constructor(
    private readonly geometry: BufferGeometry,
    private readonly material: MeshBasicMaterial,
    readonly capacity: number,
    private readonly colored: boolean,
  ) {
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    if (colored) this.mesh.setColorAt(0, this.color.set(0xffffff));
  }

  draw(source: (cb: (i: FxInstance) => void) => void): void {
    let n = 0;
    source((i) => {
      if (n >= this.capacity) return;
      this.dir.set(i.dx, i.dy, i.dz);
      if (this.dir.lengthSq() < 1e-9) this.dir.copy(Y);
      this.dir.normalize();
      this.quat.setFromUnitVectors(Y, this.dir);
      this.spin.setFromAxisAngle(Y, i.roll);
      this.quat.multiply(this.spin);
      this.transform.position.set(i.x, i.y, i.z);
      this.transform.quaternion.copy(this.quat);
      this.transform.scale.set(i.sx, i.sy, i.sz);
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(n, this.transform.matrix);
      if (this.colored) this.mesh.setColorAt(n, this.color.setHex(i.color));
      n++;
    });
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.colored && this.mesh.instanceColor)
      this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

const basic = (vertexColors = false): MeshBasicMaterial =>
  new MeshBasicMaterial({ vertexColors, side: DoubleSide, color: 0xffffff });

/** Trzy InstancedMesh (płomienie, łuki, gwiazdki) napędzane `StatusVfx`. */
export class StatusVfxRenderer {
  readonly root = new Group();
  private readonly flames: InstancedFx;
  private readonly sparks: InstancedFx;
  private readonly stars: InstancedFx;

  constructor(
    private readonly system: StatusVfx,
    caps: {
      flames: number;
      sparks: number;
      stars: number;
    },
  ) {
    this.flames = new InstancedFx(
      flameGeometry(),
      basic(true),
      caps.flames,
      false,
    );
    this.sparks = new InstancedFx(
      new BoxGeometry(1, 1, 1),
      basic(),
      caps.sparks,
      true,
    );
    this.stars = new InstancedFx(
      triangleGeometry(),
      basic(),
      caps.stars,
      false,
    );
    this.root.add(this.flames.mesh, this.sparks.mesh, this.stars.mesh);
  }

  /** Emituje i odświeża cząsteczki; `frameDt` to czas klatki. */
  render(alpha: number, frameDt: number): void {
    this.system.update(frameDt, alpha);
    this.flames.draw((cb) => this.system.forEach('flame', cb));
    this.sparks.draw((cb) => this.system.forEach('spark', cb));
    this.stars.draw((cb) => this.system.forEach('star', cb));
  }

  dispose(): void {
    this.flames.dispose();
    this.sparks.dispose();
    this.stars.dispose();
    this.root.removeFromParent();
  }
}

/** Jedna InstancedMesh iskier trafień z kolorem na instancję. */
export class HitSparksRenderer {
  readonly root: InstancedMesh;
  private readonly fx: InstancedFx;

  constructor(
    private readonly system: HitSparks,
    capacity: number,
  ) {
    const material = basic();
    // Iskry świecą (bloom) i nie mają konturu — czarna obwódka gasiła je na ciemnym tle.
    material.toneMapped = false;
    material.userData.bloom = true;
    this.fx = new InstancedFx(
      new BoxGeometry(1, 1, 1),
      material,
      capacity,
      true,
    );
    this.root = this.fx.mesh;
    this.root.userData.noOutline = true;
  }

  render(frameDt: number): void {
    this.system.update(frameDt);
    this.fx.draw((cb) => this.system.forEach(cb));
  }

  dispose(): void {
    this.fx.dispose();
  }
}
