import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshToonMaterial,
  Vector2,
  MathUtils,
} from 'three';
import type { BufferGeometry } from 'three';
import { getMaterial, gradientMap } from '../render/materials';
import { soup } from '../data/hub/interactions.json';
import type { Vec3 } from '../core/math';
import type { HubProps } from '../world/hubProps';
import type { Tuning } from '../core/tuning';

/** Widoki rekwizytów bez własnych colliderów. */
export class HubPropView {
  readonly root = new Group();
  private readonly pivots = new Map<string, Group>();
  private readonly geometries: BufferGeometry[] = [];
  private readonly bowls: { root: Group; restZ: number }[] = [];
  private readonly bowlMaterials: MeshToonMaterial[] = [];

  constructor(
    private readonly props: HubProps,
    t: Tuning['hub'],
  ) {
    for (const def of props.defs) {
      if (def.kind === 'noodles') this.addBowl(def.id, def.focus.position);
      if (def.kind !== 'bag') continue;
      const pivot = new Group();
      pivot.name = `hub:bag:${def.id}`;
      pivot.position.set(
        def.focus.position.x,
        t.bagCeilingM,
        def.focus.position.z,
      );
      const length = t.bagCeilingM - def.focus.position.y;
      const size = def.focus.size;
      const add = (
        geometry: BufferGeometry,
        material: 'fabric' | 'rubber',
        y: number,
      ): void => {
        this.geometries.push(geometry);
        const mesh = new Mesh(geometry, getMaterial(material));
        mesh.position.y = y;
        pivot.add(mesh);
      };
      add(new BoxGeometry(size.x, size.y, size.z), 'fabric', -length);
      add(
        new BoxGeometry(
          size.x + t.bagRimExtraM,
          t.bagRimHeightM,
          size.z + t.bagRimExtraM,
        ),
        'rubber',
        -length - size.y / 2 + t.bagRimHeightM / 2,
      );
      const rope = length - size.y / 2;
      add(
        new CylinderGeometry(
          t.bagRopeRadiusM,
          t.bagRopeRadiusM,
          rope,
          t.bagRopeSegments,
        ),
        'rubber',
        -rope / 2,
      );
      this.pivots.set(def.id, pivot);
      this.root.add(pivot);
    }
  }

  private addBowl(id: string, position: Vec3): void {
    const bowl = new Group();
    bowl.name = `hub:soup:${id}`;
    bowl.position.copy(position).add(soup.bowlOffset);
    const r = soup.bowlRadiusM;
    const h = soup.bowlHeightM;
    const shell = new LatheGeometry(
      [
        new Vector2(0, 0),
        new Vector2(r * 0.55, 0),
        new Vector2(r * 0.85, h * 0.4),
        new Vector2(r, h),
        new Vector2(r * 0.9, h),
        new Vector2(r * 0.65, h * 0.3),
        new Vector2(0, h * 0.3),
      ],
      24,
    );
    const broth = new CylinderGeometry(r * 0.84, r * 0.79, h * 0.12, 24);
    const ceramic = new MeshToonMaterial({
      color: soup.bowlColor,
      gradientMap,
    });
    const liquid = new MeshToonMaterial({
      color: soup.brothColor,
      gradientMap,
    });
    const surface = new Mesh(broth, liquid);
    surface.position.y = h * 0.76;
    bowl.add(new Mesh(shell, ceramic), surface);
    this.geometries.push(shell, broth);
    this.bowlMaterials.push(ceramic, liquid);
    this.bowls.push({ root: bowl, restZ: bowl.position.z });
    this.root.add(bowl);
  }

  render(alpha: number, soupProgress = 0): void {
    const slide =
      MathUtils.smoothstep(soupProgress, soup.slideStart, soup.slideEnd) -
      MathUtils.smoothstep(soupProgress, soup.returnStart, soup.returnEnd);
    for (const { root, restZ } of this.bowls)
      root.position.z = restZ + soup.slideM * slide;
    for (const bag of this.props.bags) {
      const pivot = this.pivots.get(bag.id)!;
      pivot.rotation.z = -(
        bag.previous.x +
        (bag.angle.x - bag.previous.x) * alpha
      );
      pivot.rotation.x =
        bag.previous.z + (bag.angle.z - bag.previous.z) * alpha;
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.bowlMaterials) material.dispose();
  }
}
