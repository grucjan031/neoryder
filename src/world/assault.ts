import type { Vec3 } from '../core/math';
import type { Rng } from '../core/rng';
import type { AssaultDefinition } from './modeSchema';
import { freeModePosition } from './modeSchema';
import { MissionObjectives, type ObjectiveHooks } from './missionObjectives';
import type { RoomDefinition } from './roomSchema';

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

/** Front i posiłki; sabotaż pozostaje wspólny z misjami. */
export class Assault {
  sectorIndex = 0;
  lives: number;
  respawnRemainingS = 0;
  noticeRemainingS = 0;
  outcome: 'victory' | 'death' | null = null;
  stations: MissionObjectives;
  private spawnS = 0;

  constructor(
    readonly definition: AssaultDefinition,
    private readonly hooks: ObjectiveHooks,
  ) {
    this.lives = definition.lives;
    this.stations = this.createStations();
  }

  get sector() {
    return this.definition.sectors[this.sectorIndex]!;
  }

  private createStations(): MissionObjectives {
    return new MissionObjectives(
      {
        objectives: this.sector.stations.map((position, index) => ({
          id: index === 0 ? 'A' : 'B',
          label: index === 0 ? 'A' : 'B',
          kind: 'sabotage' as const,
          position: { ...position },
          holdS: this.definition.holdS,
          fuseS: this.definition.fuseS,
          blastRadiusM: this.definition.blastRadiusM,
          blastDamage: this.definition.blastDamage,
        })),
      },
      ['A', 'B'],
      {},
      this.hooks,
      this.definition.radiusM,
      this.definition.radiusM,
    );
  }

  destroy(id: string): boolean {
    if (this.outcome || this.respawnRemainingS > 0) return false;
    return this.stations.done(id);
  }

  setLives(n: number): boolean {
    if (!Number.isSafeInteger(n) || n < 0 || this.outcome) return false;
    this.lives = n;
    if (n === 0) this.outcome = 'death';
    return true;
  }

  died(): void {
    if (this.outcome || this.respawnRemainingS > 0) return;
    this.lives = Math.max(0, this.lives - 1);
    if (this.lives === 0) this.outcome = 'death';
    else this.respawnRemainingS = this.definition.respawnS;
  }

  stepRespawn(dt: number): boolean {
    if (
      this.outcome ||
      this.respawnRemainingS <= 0 ||
      !Number.isFinite(dt) ||
      dt <= 0
    )
      return false;
    this.respawnRemainingS = Math.max(0, this.respawnRemainingS - dt);
    if (this.respawnRemainingS < 1e-9) this.respawnRemainingS = 0;
    return this.respawnRemainingS === 0;
  }

  step(dt: number, player: Vec3): void {
    if (
      this.outcome ||
      this.respawnRemainingS > 0 ||
      !Number.isFinite(dt) ||
      dt <= 0
    )
      return;
    this.spawnS = Math.max(0, this.spawnS - dt);
    this.noticeRemainingS = Math.max(0, this.noticeRemainingS - dt);
    this.stations.step(dt, player);
    // Wybuch może zabić gracza; ostatnie życie ma pierwszeństwo przed finałem.
    if (this.outcome || this.respawnRemainingS > 0 || !this.stations.complete)
      return;
    if (this.sectorIndex === this.definition.sectors.length - 1)
      this.outcome = 'victory';
    else {
      this.sectorIndex++;
      this.stations = this.createStations();
      this.noticeRemainingS = this.definition.noticeS;
      this.spawnS = 0;
    }
  }

  moveGoal(position: Vec3, player: Vec3): Vec3 | undefined {
    if (distance(position, player) <= this.definition.detectRangeM)
      return undefined;
    const targets = this.stations.mission.objectives.filter(
      (s) => this.stations.objectives[s.id] !== 'done',
    );
    const positions = targets
      .map((s) => this.stations.position(s)!)
      .sort((a, b) => distance(a, position) - distance(b, position));
    return { ...(positions[0] ?? position) };
  }

  spawnPosition(
    room: RoomDefinition,
    player: Vec3,
    enemies: readonly Vec3[],
    rng: Rng,
  ): Vec3 | null {
    const cfg = this.definition;
    if (
      this.outcome ||
      this.respawnRemainingS > 0 ||
      this.spawnS > 0 ||
      enemies.length >= cfg.maxAlive
    )
      return null;
    const candidates = this.sector.spawnPoints.filter(
      (p) =>
        freeModePosition(room, p, cfg.spawnClearanceM) &&
        distance(p, player) >= cfg.minSpawnDistanceM &&
        enemies.every((e) => distance(e, p) >= cfg.spawnClearanceM * 2),
    );
    return candidates.length ? { ...rng.pick(candidates) } : null;
  }

  spawned(): void {
    this.spawnS = this.definition.spawnIntervalS;
  }

  snapshot() {
    return {
      sector: this.sectorIndex + 1,
      sectors: this.definition.sectors.length,
      lives: this.lives,
      respawnRemainingS: this.respawnRemainingS,
      outcome: this.outcome,
      stations: this.stations.mission.objectives.map((s) => ({
        id: s.id,
        position: { ...this.stations.position(s)! },
        state:
          this.stations.objectives[s.id] === 'done'
            ? ('destroyed' as const)
            : this.stations.fuses[s.id] !== undefined
              ? ('fuse' as const)
              : (this.stations.progress[s.id] ?? 0) > 0
                ? ('planting' as const)
                : ('intact' as const),
        progress: this.stations.progress[s.id] ?? 0,
        fuseS: this.stations.fuses[s.id] ?? null,
      })),
    };
  }
}
