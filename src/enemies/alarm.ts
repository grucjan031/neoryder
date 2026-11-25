import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Perception } from './perception';

export class AlarmGroup {
  readonly members = new Map<EntityId, Perception>();
  private readonly pending = new Map<EntityId, number>();
  reportedAt?: Vec3;
  constructor(
    readonly id: string,
    private readonly report: (id: string) => void,
  ) {}
  remove(id: EntityId) {
    this.members.delete(id);
    this.pending.delete(id);
  }
  raise(point: Vec3) {
    const firstReport = !this.reportedAt;
    this.reportedAt = { ...point };
    for (const observer of this.members.values()) observer.alert(point);
    this.pending.clear();
    if (firstReport) this.report(this.id);
  }
  step(dt: number, delay: number) {
    if (this.reportedAt || dt <= 0) return;
    for (const [id, member] of this.members) {
      if (member.state !== 'alerted' || !member.lastKnown) {
        this.pending.delete(id);
        continue;
      }
      const elapsed = (this.pending.get(id) ?? 0) + dt;
      if (elapsed >= delay) {
        this.raise(member.lastKnown);
        return;
      }
      this.pending.set(id, elapsed);
    }
  }
}
