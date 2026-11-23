import type { Vec3 } from '../core/math';
import type { RunState } from '../core/runTypes';
import type { MissionDefinition, MissionObjective } from './missionSchema';

export interface ObjectiveHooks {
  signal(trigger: string): void;
  explode(objective: Extract<MissionObjective, { kind: 'sabotage' }>): void;
  reinforce?(wave: string, key: string): void;
}

/** Czysta symulacja celów; host obsługuje obrażenia, fale i prezentację. */
export class MissionObjectives {
  readonly objectives: NonNullable<RunState['objectives']>;
  readonly progress: Record<string, number>;
  readonly fuses: Record<string, number> = {};
  readonly paused: Record<string, boolean> = {};
  readonly remainingS: Record<string, number> = {};
  failed: string | null = null;
  /** Host może blokować ukończenie (np. osłoną), zachowując widoczny kierunek celu. */
  canComplete: (objective: MissionObjective) => boolean = () => true;
  private readonly pauseAnnounced = new Set<string>();
  private readonly started = new Set<string>();
  constructor(
    readonly mission: Pick<MissionDefinition, 'objectives'>,
    readonly ids: readonly string[],
    state: Pick<RunState, 'objectives' | 'objectiveProgress'>,
    private readonly hooks: ObjectiveHooks,
    private readonly radiusM: number,
    private readonly pickupRadiusM: number,
    private readonly sequence?: readonly string[],
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
    const origin = parent ? this.position(parent) : null;
    if (!origin) return null;
    return {
      x: origin.x + objective.offset.x,
      y: origin.y + objective.offset.y,
      z: origin.z + objective.offset.z,
    };
  }
  unlocked(objective: MissionObjective): boolean {
    if (this.sequence) {
      const index = this.sequence.indexOf(objective.id);
      if (
        index < 0 ||
        this.sequence
          .slice(0, index)
          .some((id) => this.objectives[id] !== 'done')
      )
        return false;
    }
    return objective.kind === 'pickup'
      ? this.objectives[objective.spawnAfter] === 'done'
      : objective.kind === 'exit' || objective.kind === 'interact'
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
      this.failed !== null ||
      !this.canComplete(objective) ||
      !this.ids.includes(id) ||
      this.objectives[id] === 'done' ||
      !this.unlocked(objective)
    )
      return false;
    this.objectives[id] = 'done';
    this.progress[id] = 1;
    delete this.fuses[id];
    delete this.remainingS[id];
    if (objective.kind === 'sabotage') this.hooks.explode(objective);
    this.hooks.signal(`objective:${id}:done`);
    if (this.mission.objectives.every((o) => this.objectives[o.id] === 'done'))
      this.hooks.signal('objectivesDone');
    return true;
  }
  step(dt: number, player: Vec3): void {
    if (!Number.isFinite(dt) || dt <= 0 || this.failed !== null) return;
    for (const objective of this.mission.objectives) {
      const { id } = objective;
      if (
        !this.ids.includes(id) ||
        this.objectives[id] === 'done' ||
        !this.unlocked(objective)
      )
        continue;
      if (objective.kind === 'reach') {
        const remaining = this.remainingS[id] ?? objective.timeLimitS;
        if (!this.started.has(id)) {
          this.started.add(id);
          this.hooks.signal(`objective:${id}:started`);
        }
        this.remainingS[id] = Math.max(0, remaining - dt);
        // Upływ limitu ma pierwszeństwo przed dotarciem w tym samym kroku.
        if (this.remainingS[id]! <= 1e-9) {
          this.failed = id;
          return;
        }
        if (
          Math.hypot(
            player.x - objective.position.x,
            player.z - objective.position.z,
          ) <= objective.radiusM &&
          Math.abs(player.y - objective.position.y) <= objective.radiusM
        )
          this.done(id);
        // Następny odcinek rozpocznie się w kolejnym kroku symulacji.
        return;
      }
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
      const inside =
        position !== null &&
        Math.hypot(player.x - position.x, player.z - position.z) <= radius &&
        Math.abs(player.y - position.y) <= radius;
      if (objective.kind === 'defend') {
        this.stepDefend(objective, dt, inside);
        continue;
      }
      if (!inside) continue;
      if (!this.started.has(id)) {
        this.started.add(id);
        this.hooks.signal(`objective:${id}:started`);
      }
      if (objective.kind === 'pickup') {
        this.done(id);
        continue;
      }
      if (objective.kind === 'killBoss' || objective.kind === 'escortPayload')
        continue;
      const duration = objective.holdS;
      this.progress[id] = Math.min(1, (this.progress[id] ?? 0) + dt / duration);
      if (this.progress[id]! < 1 - 1e-9) continue;
      this.progress[id] = 1;
      if (objective.kind === 'sabotage') this.fuses[id] = objective.fuseS;
      else this.done(id);
    }
  }

  resetTimers(): void {
    this.failed = null;
    for (const id of Object.keys(this.remainingS)) delete this.remainingS[id];
    for (const objective of this.mission.objectives)
      if (
        objective.kind === 'reach' &&
        this.objectives[objective.id] !== 'done'
      )
        this.started.delete(objective.id);
  }

  private stepDefend(
    objective: Extract<MissionObjective, { kind: 'defend' }>,
    dt: number,
    inside: boolean,
  ): void {
    const { id, holdS, durationS } = objective;
    const connectionKey = `${id}:connection`;
    const connected =
      (this.progress[connectionKey] ?? 0) >= 1 || (this.progress[id] ?? 0) > 0;
    this.paused[id] = !inside && connected;
    if (this.paused[id] && !this.pauseAnnounced.has(id)) {
      this.pauseAnnounced.add(id);
      this.hooks.signal(`objective:${id}:paused`);
    }
    if (!inside) {
      if (connected && objective.checkpoints) {
        const previous = this.progress[id] ?? 0;
        this.progress[id] = objective.checkpoints.reduce(
          (checkpoint, value) => (value <= previous ? value : checkpoint),
          0,
        );
      }
      return;
    }
    let transferDt = dt;
    if (!connected) {
      const remaining = holdS * (1 - (this.progress[connectionKey] ?? 0));
      this.progress[connectionKey] =
        holdS === 0
          ? 1
          : Math.min(1, (this.progress[connectionKey] ?? 0) + dt / holdS);
      if (remaining > dt + 1e-9) return;
      this.progress[connectionKey] = 1;
      transferDt = Math.max(0, dt - remaining);
      this.hooks.signal(`objective:${id}:started`);
      this.hooks.signal(`objective:${id}:progress:0`);
    }
    const previous = this.progress[id] ?? 0;
    const next = Math.min(1, previous + transferDt / durationS);
    this.progress[id] = next >= 1 - 1e-9 ? 1 : next;
    for (const [index, entry] of (objective.waves ?? []).entries()) {
      if (previous < entry.atProgress && this.progress[id]! >= entry.atProgress)
        this.hooks.reinforce?.(entry.wave, `${id}:${index}`);
    }
    for (let percent = 1; percent <= 100; percent++) {
      if (previous < percent / 100 && this.progress[id]! >= percent / 100)
        this.hooks.signal(`objective:${id}:progress:${percent}`);
    }
    if (this.progress[id] === 1) this.done(id);
  }
}
