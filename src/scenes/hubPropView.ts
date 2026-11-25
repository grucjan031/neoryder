import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshToonMaterial,
  Vector2,
  MathUtils,
  Vector3,
  CatmullRomCurve3,
  TubeGeometry,
  SphereGeometry,
  TorusGeometry,
  type Object3D,
} from 'three';
import type { BufferGeometry } from 'three';
import { getMaterial, gradientMap } from '../render/materials';
import { hubInteractions } from '../world/hubInteractions';
import type { Vec3 } from '../core/math';
import type { HubProps } from '../world/hubProps';
import type { Tuning } from '../core/tuning';

import { ease, type noodlesState } from './hubCutaway';
const { soup } = hubInteractions;

/** Widoki rekwizytów bez własnych colliderów. */
export class HubPropView {
  readonly root = new Group();
  private readonly pivots = new Map<string, Group>();
  private readonly geometries: BufferGeometry[] = [];
  private readonly bowls: { root: Group; contents: Group; rest: Vector3 }[] =
    [];
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
    const contents = new Group();
    bowl.add(contents);
    const materials = new Map<string, MeshToonMaterial>();
    const mesh = (
      parent: Group,
      geo: BufferGeometry,
      color: string,
      x = 0,
      y = 0,
      z = 0,
    ) => {
      let mat = materials.get(color);
      if (!mat) {
        mat = new MeshToonMaterial({ color, gradientMap });
        materials.set(color, mat);
        this.bowlMaterials.push(mat);
      }
      this.geometries.push(geo);
      const part = new Mesh(geo, mat);
      part.position.set(x, y, z);
      parent.add(part);
      return part;
    };
    mesh(bowl, shell, soup.bowlColor);
    mesh(
      bowl,
      new TorusGeometry(r * 0.95, r * 0.045, 8, 32),
      soup.rimColor,
      0,
      h,
    ).rotation.x = Math.PI / 2;
    mesh(
      bowl,
      new CylinderGeometry(r * 0.64, r * 0.6, h * 0.05, 24),
      soup.brothColor,
      0,
      h * 0.33,
    );
    mesh(
      contents,
      new CylinderGeometry(r * 0.85, r * 0.8, h * 0.09, 24),
      soup.brothColor,
      0,
      h * 0.77,
    );
    for (let i = 0; i < 10; i++) {
      const z = (i - 4.5) * r * 0.14,
        w = Math.sqrt((r * 0.79) ** 2 - z * z);
      const points = Array.from(
        { length: 15 },
        (_, j) =>
          new Vector3(
            (j / 7 - 1) * w,
            h * 0.85 + r * 0.014 * Math.sin(j + i),
            z + r * 0.065 * Math.sin(j + i),
          ),
      );
      mesh(
        contents,
        new TubeGeometry(new CatmullRomCurve3(points), 24, r * 0.022, 5, false),
        soup.noodleColor,
      );
    }
    mesh(
      contents,
      new SphereGeometry(r * 0.32, 14, 10),
      soup.eggColor,
      r * 0.32,
      h * 0.94,
      r * 0.26,
    ).scale.set(0.76, 0.52, 1);
    mesh(
      contents,
      new SphereGeometry(r * 0.15, 12, 8),
      soup.brothColor,
      r * 0.32,
      h * 1.13,
      r * 0.26,
    ).scale.y = 0.65;
    mesh(
      contents,
      new BoxGeometry(r * 0.56, r * 0.55, r * 0.035),
      soup.noriColor,
      -r * 0.31,
      h * 1.14,
      -r * 0.44,
    ).rotation.x = -0.32;
    for (let i = 0; i < 6; i++)
      mesh(
        contents,
        new TorusGeometry(r * 0.068, r * 0.014, 5, 10),
        soup.onionColor,
        r * 0.48 * Math.cos(i * 2),
        h * 0.96,
        r * 0.48 * Math.sin(i * 2),
      ).rotation.x = Math.PI / 2;
    for (const side of [-1, 1])
      mesh(
        bowl,
        new CylinderGeometry(r * 0.023, r * 0.012, r * 2.32, 8),
        soup.woodColor,
        r * (0.43 + side * 0.075),
        h * 1.06,
        0,
      ).rotation.x = Math.PI / 2;
    this.bowls.push({ root: bowl, contents, rest: bowl.position.clone() });
    this.root.add(bowl);
  }

  get bowl() {
    return this.bowls[0]?.root;
  }

  get bowlRest() {
    const rest = this.bowls[0]?.rest;
    return rest && this.root.localToWorld(rest.clone());
  }

  get bowlCenter() {
    return this.bowl?.localToWorld(new Vector3(0, soup.bowlHeightM / 2, 0));
  }

  get bowlFull() {
    const contents = this.bowls[0]?.contents;
    return contents?.visible && contents.scale.y === 1;
  }

  render(
    alpha: number,
    state?: ReturnType<typeof noodlesState>,
    hand?: Object3D,
    push?: Vec3,
    servingHand?: Object3D,
  ): void {
    for (const { root, contents, rest } of this.bowls) {
      root.position.copy(rest);
      root.rotation.set(0, 0, 0);
      root.visible = state?.visible ?? true;
      const fill = state?.fill ?? 1;
      contents.visible = fill > 0;
      contents.scale.setScalar(MathUtils.lerp(0.55, 1, fill));
      contents.position.y = -(1 - fill) * soup.bowlHeightM * 0.1;
      if (!state) continue;
      if (hand && ['pickUp', 'eat', 'putDown'].includes(state.phase)) {
        const grip = hand.localToWorld(new Vector3().copy(soup.handOffset));
        this.root.worldToLocal(grip);
        const weight =
          state.phase === 'pickUp'
            ? ease(state.progress)
            : state.phase === 'putDown'
              ? 1 - ease(state.progress)
              : 1;
        root.position.copy(grip);
        const rot = soup.handRotation;
        root.rotation.set(rot.x * weight, rot.y * weight, rot.z * weight);
      }
      if (push && (state.phase === 'push' || state.phase === 'take'))
        root.position.addScaledVector(
          push,
          state.phase === 'push' ? ease(state.progress) : 1,
        );
      if (servingHand && (state.phase === 'serve' || state.phase === 'take')) {
        const grip = this.root.worldToLocal(
          servingHand.getWorldPosition(new Vector3()),
        );
        const weight =
          state.phase === 'serve'
            ? 1 - ease(state.progress)
            : ease(state.progress);
        root.position.lerp(grip, weight);
      }
    }
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
