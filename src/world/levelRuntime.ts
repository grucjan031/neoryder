import type { Vec3 } from '../core/math';
import type {
  LevelDefinition,
  LevelDependency,
  LevelZone,
} from './levelSchema';

export function insideLevelZone(position: Vec3, zone: LevelZone): boolean {
  const dx = position.x - zone.position.x;
  const dy = position.y - zone.position.y;
  const dz = position.z - zone.position.z;
  return zone.kind === 'sphere'
    ? Math.hypot(dx, dy, dz) <= zone.radiusM
    : Math.abs(dx) <= zone.size.x / 2 &&
        Math.abs(dy) <= zone.size.y / 2 &&
        Math.abs(dz) <= zone.size.z / 2;
}

export class LevelRuntime {
  readonly active = new Set<string>();
  readonly completed: Set<string>;
  readonly raisedAlarms: Set<string>;
  readonly bonusStates: Record<string, 'done' | 'failed'>;
  constructor(
    readonly level: LevelDefinition,
    completed: readonly string[] = [],
    raisedAlarms: readonly string[] = [],
    bonusStates: Record<string, 'done' | 'failed'> = {},
  ) {
    this.raisedAlarms = new Set(raisedAlarms);
    this.bonusStates = { ...bonusStates };
    if (
      completed.some((id) => !level.encounters.some((entry) => entry.id === id))
    )
      throw new Error('Nieznane zapisane spotkanie.');
    this.completed = new Set(completed);
  }
  quiet(id: string): boolean {
    const e = this.level.encounters.find((item) => item.id === id);
    return !!e?.stealth && !this.raisedAlarms.has(e.stealth.alarmGroup ?? id);
  }
  get inCombat(): boolean {
    return [...this.active].some((id) => !this.quiet(id));
  }
  satisfied(
    after: LevelDependency | undefined,
    objectives: Readonly<Record<string, string>>,
  ): boolean {
    return (
      !after ||
      (after.kind === 'objective'
        ? objectives[after.id] === 'done'
        : after.kind === 'alarm'
          ? this.raisedAlarms.has(after.id)
          : this.completed.has(after.id) ||
            (this.active.has(after.id) && this.quiet(after.id)))
    );
  }
  step(position: Vec3, objectives: Readonly<Record<string, string>>): string[] {
    const started: string[] = [];
    for (const encounter of this.level.encounters) {
      if (this.completed.has(encounter.id) || this.active.has(encounter.id))
        continue;
      // Fale celu defend (`<cel>:<indeks>`) startuje wyłącznie próg postępu.
      if (encounter.reinforcementFor?.includes(':')) continue;
      // Pokonany boss nie wraca, także gdy zapis nie zdążył objąć spotkania.
      if (encounter.bossFor && objectives[encounter.bossFor] === 'done')
        continue;
      if (
        this.satisfied(encounter.after, objectives) &&
        insideLevelZone(position, encounter.zone)
      ) {
        this.active.add(encounter.id);
        started.push(encounter.id);
      }
    }
    return started;
  }
  clear(id: string): void {
    if (!this.active.delete(id)) return;
    this.completed.add(id);
  }
  openGates(objectives: Readonly<Record<string, string>>): string[] {
    return this.level.gates
      .filter(
        (gate) =>
          this.satisfied(gate.after, objectives) &&
          !(
            gate.closedDuring &&
            this.active.has(gate.closedDuring) &&
            !this.quiet(gate.closedDuring)
          ),
      )
      .map((gate) => gate.id);
  }
}
