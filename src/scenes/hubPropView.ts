import { BoxGeometry, CylinderGeometry, Group, Mesh } from 'three';
import type { BufferGeometry } from 'three';
import { getMaterial } from '../render/materials';
import type { HubProps } from '../world/hubProps';
import type { Tuning } from '../core/tuning';

/** Worek bez collidera: żadna pozycja wahadła nie może zakleszczyć gracza. */
export class HubPropView {
  readonly root = new Group();
  private readonly pivots = new Map<string, Group>();
  private readonly geometries: BufferGeometry[] = [];

  constructor(
    private readonly props: HubProps,
    t: Tuning['hub'],
  ) {
    for (const def of props.defs) {
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

  render(alpha: number): void {
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
  }
}
