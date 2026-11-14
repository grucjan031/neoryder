import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  type MeshBasicMaterial,
} from 'three';
import type { Power } from '../combat/powers/power';
import type { Vec3 } from '../core/math';
import { getMaterial } from './materials';

export interface LightningArc {
  readonly points: readonly Vec3[];
  readonly ageS: number;
}

export interface LightningVfx {
  readonly arcLifeS: number;
  readonly jitterM: number;
  readonly segments: number;
}

export interface LightningSource {
  readonly arcs: readonly LightningArc[];
  readonly def: { readonly vfx: LightningVfx };
}

type PowerOrSource = Power | LightningSource | null | undefined;

interface ArcSlot {
  readonly line: Line<BufferGeometry, MeshBasicMaterial>;
  readonly geometry: BufferGeometry;
  readonly material: MeshBasicMaterial;
  positions: Float32Array;
}

const DEFAULT_VFX: LightningVfx = {
  arcLifeS: 0.2,
  jitterM: 0.12,
  segments: 6,
};

function isArc(item: unknown): item is LightningArc {
  return (
    typeof item === 'object' &&
    item !== null &&
    'points' in item &&
    'ageS' in item
  );
}

function isSource(item: unknown): item is LightningSource {
  return (
    typeof item === 'object' &&
    item !== null &&
    'arcs' in item &&
    'def' in item &&
    typeof (item as { def: unknown }).def === 'object' &&
    (item as { def: unknown }).def !== null &&
    'vfx' in (item as { def: object }).def
  );
}

/** Wizualizacja łuków Błyskawicy (F2-07): zygzak między punktami, materiał 'power', zanikanie i pooling geometrii. */
export class LightningRenderer {
  readonly root = new Group();
  private readonly pool: ArcSlot[] = [];

  render(
    input:
      | LightningSource
      | readonly PowerOrSource[]
      | readonly LightningArc[]
      | null
      | undefined,
    vfx: LightningVfx = DEFAULT_VFX,
  ): void {
    let used = 0;

    if (input) {
      if (isSource(input)) {
        used = this.renderArcs(input.arcs, input.def.vfx, used);
      } else if (Array.isArray(input)) {
        for (const item of input) {
          if (isSource(item)) {
            used = this.renderArcs(item.arcs, item.def.vfx, used);
          } else if (isArc(item)) {
            used = this.renderArc(item, vfx, used);
          }
        }
      }
    }

    for (let i = used; i < this.pool.length; i++) {
      this.pool[i]!.line.visible = false;
    }
  }

  private renderArcs(
    arcs: readonly LightningArc[],
    vfx: LightningVfx,
    used: number,
  ): number {
    let index = used;
    for (const arc of arcs) {
      index = this.renderArc(arc, vfx, index);
    }
    return index;
  }

  private renderArc(
    arc: LightningArc,
    vfx: LightningVfx,
    slotIndex: number,
  ): number {
    if (
      arc.points.length < 2 ||
      !(vfx.arcLifeS > 0) ||
      arc.ageS >= vfx.arcLifeS
    ) {
      return slotIndex;
    }

    const segments = Math.max(1, Math.floor(vfx.segments));
    const vertexCount = (arc.points.length - 1) * segments + 1;
    const slot = this.acquireSlot(slotIndex, vertexCount);

    const progress = Math.max(0, Math.min(1, arc.ageS / vfx.arcLifeS));
    const baseMaterial = getMaterial('power');
    slot.material.color.copy(baseMaterial.color);
    slot.material.opacity = 1 - progress;
    slot.line.visible = slot.material.opacity > 0;

    const pos = slot.positions;
    const first = arc.points[0]!;
    pos[0] = first.x;
    pos[1] = first.y;
    pos[2] = first.z;

    let offset = 3;
    for (let p = 0; p < arc.points.length - 1; p++) {
      const from = arc.points[p]!;
      const to = arc.points[p + 1]!;
      for (let s = 1; s <= segments; s++) {
        if (s === segments) {
          pos[offset] = to.x;
          pos[offset + 1] = to.y;
          pos[offset + 2] = to.z;
        } else {
          const t = s / segments;
          pos[offset] =
            from.x +
            (to.x - from.x) * t +
            (Math.random() * 2 - 1) * vfx.jitterM;
          pos[offset + 1] =
            from.y +
            (to.y - from.y) * t +
            (Math.random() * 2 - 1) * vfx.jitterM;
          pos[offset + 2] =
            from.z +
            (to.z - from.z) * t +
            (Math.random() * 2 - 1) * vfx.jitterM;
        }
        offset += 3;
      }
    }

    const attribute = slot.geometry.getAttribute('position') as BufferAttribute;
    attribute.needsUpdate = true;
    slot.geometry.setDrawRange(0, vertexCount);

    return slotIndex + 1;
  }

  private acquireSlot(index: number, vertexCount: number): ArcSlot {
    let slot = this.pool[index];
    const neededFloats = vertexCount * 3;
    if (!slot) {
      const geometry = new BufferGeometry();
      const positions = new Float32Array(Math.max(64 * 3, neededFloats));
      geometry.setAttribute('position', new BufferAttribute(positions, 3));
      const material = getMaterial('power').clone() as MeshBasicMaterial;
      material.transparent = true;
      material.depthWrite = false;
      const line = new Line(geometry, material);
      line.frustumCulled = false;
      this.root.add(line);
      slot = { line, geometry, material, positions };
      this.pool.push(slot);
      return slot;
    }

    if (slot.positions.length < neededFloats) {
      slot.positions = new Float32Array(neededFloats);
      slot.geometry.setAttribute(
        'position',
        new BufferAttribute(slot.positions, 3),
      );
    }
    return slot;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
    for (const slot of this.pool) {
      slot.geometry.dispose();
      slot.material.dispose();
    }
    this.pool.length = 0;
  }
}
