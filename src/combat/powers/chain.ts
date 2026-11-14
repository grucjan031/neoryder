import type { EntityId } from '../../core/events';
import type { Vec3 } from '../../core/math';
import { dot, normalize, scale, sub } from '../../core/math';
import { PowerBase } from './power';
import type { ChainPowerDefinition } from './powerSchema';
import type { PushTarget } from './push';

export interface ChainArc {
  readonly points: readonly Vec3[];
  ageS: number;
}

const epsilon = 1e-6;

/** Błyskawica Rezonansu (F2-07): pierwszy cel w stożku celowania, przeskoki po najbliższych w jumpRangeM. */
export class ChainPower extends PowerBase<ChainPowerDefinition> {
  private readonly activeArcs: ChainArc[] = [];

  get arcs(): readonly ChainArc[] {
    return this.activeArcs;
  }

  protected override canActivate(): boolean {
    return this.findFirstTarget() !== null;
  }

  protected override stepEffect(dt: number): void {
    for (let i = this.activeArcs.length - 1; i >= 0; i--) {
      const arc = this.activeArcs[i]!;
      arc.ageS += dt;
      if (arc.ageS + epsilon >= this.def.vfx.arcLifeS) {
        this.activeArcs.splice(i, 1);
      }
    }
  }

  protected override resetEffect(): void {
    this.activeArcs.length = 0;
  }

  protected override activate(): number {
    const first = this.findFirstTarget();
    if (!first) return 0;

    const { origin, dir } = this.deps.aim();
    const forward = normalize(dir);
    const visited = new Set<EntityId>([first.id]);
    const points: Vec3[] = [{ ...origin }, { ...first.position }];

    this.dealHit(origin, first, 0, forward);

    let current = first;
    for (let jump = 1; jump <= this.def.jumps; jump++) {
      const next = this.findNextTarget(current.position, visited);
      if (!next) break;
      visited.add(next.id);
      points.push({ ...next.position });
      this.dealHit(current.position, next, jump, forward);
      current = next;
    }

    this.activeArcs.push({ points, ageS: 0 });
    return visited.size;
  }

  private dealHit(
    from: Vec3,
    target: PushTarget,
    chainIndex: number,
    fallbackDir: Vec3,
  ): void {
    const to = sub(target.position, from);
    const dist = Math.hypot(to.x, to.y, to.z);
    const dir = dist > epsilon ? scale(to, 1 / dist) : fallbackDir;
    const amount = this.def.damage * Math.pow(1 - this.def.falloff, chainIndex);
    this.deps.damage.deal(target.id, {
      amount,
      source: this.deps.owner,
      tags: this.def.tags,
      point: { ...target.position },
      dir,
      ...(this.def.statuses ? { statuses: this.def.statuses } : {}),
    });
  }

  private findFirstTarget(): PushTarget | null {
    const { origin, dir } = this.deps.aim();
    const forward = normalize(dir);
    const cosHalf = Math.cos(((this.def.coneDeg / 2) * Math.PI) / 180);
    let best: PushTarget | null = null;
    let bestAngle = Number.POSITIVE_INFINITY;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const target of this.deps.targets()) {
      if (!this.canTarget(target.id)) continue;
      const to = sub(target.position, origin);
      const dist = Math.hypot(to.x, to.y, to.z);
      if (dist > this.def.rangeM || dist < epsilon) continue;
      const toDir = scale(to, 1 / dist);
      const cos = dot(toDir, forward);
      if (this.def.coneDeg < 360 && cos < cosHalf - epsilon) continue;
      if (this.hasWallBetween(origin, toDir, dist)) continue;
      const angle = Math.acos(Math.min(1, Math.max(-1, cos)));
      if (
        angle < bestAngle - epsilon ||
        (Math.abs(angle - bestAngle) <= epsilon && dist < bestDist)
      ) {
        best = target;
        bestAngle = angle;
        bestDist = dist;
      }
    }
    return best;
  }

  private findNextTarget(
    from: Vec3,
    visited: ReadonlySet<EntityId>,
  ): PushTarget | null {
    let best: PushTarget | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const target of this.deps.targets()) {
      if (visited.has(target.id) || !this.canTarget(target.id)) continue;
      const to = sub(target.position, from);
      const dist = Math.hypot(to.x, to.y, to.z);
      if (dist > this.def.jumpRangeM) continue;
      if (dist > epsilon) {
        const toDir = scale(to, 1 / dist);
        if (this.hasWallBetween(from, toDir, dist)) continue;
      }
      if (dist < bestDist) {
        best = target;
        bestDist = dist;
      }
    }
    return best;
  }

  private hasWallBetween(from: Vec3, dir: Vec3, dist: number): boolean {
    const wall = this.deps.castWall(from, dir, dist);
    return wall !== null && wall < dist;
  }

  private canTarget(id: EntityId): boolean {
    const health = this.deps.damage.health?.(id);
    if (health?.dead) return false;
    return this.deps.damage.canDamage
      ? this.deps.damage.canDamage(this.deps.owner, id, this.def.tags)
      : true;
  }
}
