import type { Vec3 } from '../core/math';
import type { RunState } from '../core/runTypes';
import type { MissionDefinition, MissionObjective } from './missionSchema';

export interface ObjectiveHooks {
  signal(trigger: string): void;
  explode(objective: Extract<MissionObjective, { kind: 'sabotage' }>): void;
}

/** Czysta symulacja celów; host obsługuje obrażenia, fale i prezentację. */
export class MissionObjectives {
  readonly objectives: NonNullable<RunState['objectives']>;
  readonly progress: Record<string, number>;
  readonly fuses: Record<string, number> = {};
  private readonly started = new Set<string>();
  constructor(
    readonly mission: MissionDefinition,
    readonly ids: readonly string[],
    state: Pick<RunState, 'objectives' | 'objectiveProgress'>,
    private readonly hooks: ObjectiveHooks,
    private readonly radiusM: number,
    private readonly pickupRadiusM: number,
  ) {
    this.objectives = { ...state.objectives };
    this.progress = { ...state.objectiveProgress };
    for (const id of ids) {
      this.objectives[id] ??= 'active';
      const objective = mission.objectives.find((o) => o.id === id);
      if (
        objective?.kind === 'sabotage' &&
        this.objectives[id] !== 'done' &&
        this.progress[id] === 1
      )
        this.fuses[id] = objective.fuseS;
    }
  }
  position(objective: MissionObjective): Vec3 | null {
    if ('position' in objective) return objective.position;
    if (objective.kind !== 'pickup') return null;
    const parent = this.mission.objectives.find(
      (o) => o.id === objective.spawnAfter,
    );
    if (!parent || !('position' in parent)) return null;
    return {
      x: parent.position.x + objective.offset.x,
      y: parent.position.y + objective.offset.y,
      z: parent.position.z + objective.offset.z,
    };
  }
  unlocked(objective: MissionObjective): boolean {
    return objective.kind === 'pickup'
      ? this.objectives[objective.spawnAfter] === 'done'
      : objective.kind === 'exit'
        ? objective.unlockAfter.every((id) => this.objectives[id] === 'done')
        : true;
  }
  get complete(): boolean {
    return this.ids.every((id) => this.objectives[id] === 'done');
  }
  done(id: string): boolean {
    const objective = this.mission.objectives.find((o) => o.id === id);
    if (
      !objective ||
      !this.ids.includes(id) ||
      this.objectives[id] === 'done' ||
      !this.unlocked(objective)
    )
      return false;
    this.objectives[id] = 'done';
    this.progress[id] = 1;
    delete this.fuses[id];
    if (objective.kind === 'sabotage') this.hooks.explode(objective);
    this.hooks.signal(`objective:${id}:done`);
    if (this.mission.objectives.every((o) => this.objectives[o.id] === 'done'))
      this.hooks.signal('objectivesDone');
    return true;
  }
  step(dt: number, player: Vec3): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (const objective of this.mission.objectives) {
      const { id } = objective;
      if (
        !this.ids.includes(id) ||
        this.objectives[id] === 'done' ||
        !this.unlocked(objective)
      )
        continue;
      const fuse = this.fuses[id];
      if (fuse !== undefined) {
        this.fuses[id] = Math.max(0, fuse - dt);
        if (this.fuses[id]! <= 1e-9) this.done(id);
        continue;
      }
      const position = this.position(objective);
      const radius =
        objective.kind === 'pickup'
          ? this.pickupRadiusM
          : objective.kind === 'defend'
            ? objective.radiusM
            : this.radiusM;
      if (
        !position ||
        Math.hypot(player.x - position.x, player.z - position.z) > radius ||
        Math.abs(player.y - position.y) > radius
      )
        continue;
      if (!this.started.has(id)) {
        this.started.add(id);
        this.hooks.signal(`objective:${id}:started`);
      }
      if (objective.kind === 'pickup') {
        this.done(id);
        continue;
      }
      if (objective.kind === 'killBoss') continue;
      const duration =
        objective.kind === 'defend' ? objective.durationS : objective.holdS;
      this.progress[id] = Math.min(1, (this.progress[id] ?? 0) + dt / duration);
      if (this.progress[id]! < 1 - 1e-9) continue;
      this.progress[id] = 1;
      if (objective.kind === 'sabotage') this.fuses[id] = objective.fuseS;
      else this.done(id);
    }
  }
}
