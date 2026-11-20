import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Rng } from '../core/rng';
import { tuning } from '../core/tuning';
import { arenaSpawnPoints, selectArenaSpawn } from './arenaSpawns';
import { freeModePosition, type HeistDefinition } from './modeSchema';
import type { RoomDefinition } from './roomSchema';

export interface HeistEnemy {
  id: EntityId;
  position: Vec3;
}
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
/** Strefa to koło na płaszczyźnie z tolerancją wysokości (areny mają kilka poziomów). */
const within = (a: Vec3, b: Vec3, radius: number) =>
  distance(a, b) <= radius &&
  Math.abs(a.y - b.y) <= tuning.modes.heist.zoneHeightM;

export class Heist {
  state: 'base' | 'player' | 'dropped' | 'enemy' = 'base';
  position: Vec3;
  carrierId: EntityId | null = null;
  lives: number;
  respawnRemainingS = 0;
  extractElapsedS = 0;
  elapsedS = 0;
  outcome: 'victory' | 'death' | null = null;
  private spawnS = 0;
  private pickupBlocked = false;

  constructor(readonly definition: HeistDefinition) {
    this.position = { ...definition.base };
    this.lives = definition.lives;
  }

  grab(): boolean {
    if (this.outcome || this.respawnRemainingS > 0 || this.state === 'player')
      return false;
    this.state = 'player';
    this.carrierId = null;
    this.extractElapsedS = 0;
    return true;
  }

  drop(position: Vec3): boolean {
    if (this.outcome || this.state !== 'player') return false;
    this.leaveCore(position);
    // Debug drop nie podnosi rdzenia ponownie, dopóki gracz nie odejdzie.
    this.pickupBlocked = true;
    return true;
  }

  private leaveCore(position: Vec3): void {
    this.state = 'dropped';
    // Mały pokój ma jedną płaską podłogę; arena zachowuje poziom podłogi pod nosicielem.
    this.position = {
      ...position,
      y: this.definition.playerSpawn
        ? position.y - tuning.modes.heist.carryFootOffsetM
        : this.definition.base.y,
    };
    this.carrierId = null;
    this.extractElapsedS = 0;
  }

  killed(id: EntityId, position: Vec3): void {
    if (!this.outcome && this.state === 'enemy' && this.carrierId === id)
      this.leaveCore(position);
  }

  extract(): boolean {
    if (this.outcome || this.respawnRemainingS > 0 || this.state !== 'player')
      return false;
    this.extractElapsedS = this.definition.extractS;
    this.outcome = 'victory';
    return true;
  }

  setLives(n: number): boolean {
    if (this.outcome || !Number.isSafeInteger(n) || n < 0) return false;
    this.lives = n;
    if (n === 0) this.outcome = 'death';
    return true;
  }

  died(position: Vec3): void {
    if (this.outcome || this.respawnRemainingS > 0) return;
    if (this.state === 'player') this.leaveCore(position);
    this.pickupBlocked = false;
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

  step(dt: number, player: Vec3, enemies: readonly HeistEnemy[]): void {
    if (
      this.outcome ||
      this.respawnRemainingS > 0 ||
      !Number.isFinite(dt) ||
      dt <= 0
    )
      return;
    const cfg = this.definition;
    this.elapsedS += dt;
    this.spawnS = Math.max(0, this.spawnS - dt);
    if (cfg.timeLimitS > 0 && this.elapsedS >= cfg.timeLimitS) {
      this.outcome = 'death';
      return;
    }
    if (this.state === 'enemy') {
      const carrier = enemies.find((e) => e.id === this.carrierId);
      if (!carrier) this.leaveCore(this.position);
      else {
        this.position = { ...carrier.position };
        if (within(this.position, cfg.base, cfg.pickupRadiusM)) {
          this.state = 'base';
          this.carrierId = null;
          this.position = { ...cfg.base };
        }
      }
    }
    if (!within(player, this.position, cfg.pickupRadiusM))
      this.pickupBlocked = false;
    if (
      (this.state === 'base' || this.state === 'dropped') &&
      !this.pickupBlocked &&
      within(player, this.position, cfg.pickupRadiusM)
    )
      this.grab();
    if (this.state === 'dropped') {
      const carrier = enemies.find((e) =>
        within(e.position, this.position, cfg.pickupRadiusM),
      );
      if (carrier) {
        this.state = 'enemy';
        this.carrierId = carrier.id;
        this.position = { ...carrier.position };
      }
    }
    if (this.state === 'player') {
      this.position = { ...player };
      this.extractElapsedS = within(player, cfg.extraction, cfg.extractRadiusM)
        ? this.extractElapsedS + dt
        : 0;
      if (this.extractElapsedS + 1e-9 >= cfg.extractS) this.extract();
    }
  }

  moveGoal(id: EntityId, player: Vec3): Vec3 {
    return {
      ...(this.state === 'enemy' && this.carrierId === id
        ? this.definition.base
        : this.state === 'player'
          ? player
          : this.position),
    };
  }

  spawnPosition(
    room: RoomDefinition,
    player: Vec3,
    enemies: readonly Vec3[],
    rng: Rng,
    occluded?: (position: Vec3) => boolean,
  ): Vec3 | null {
    const cfg = this.definition;
    if (
      this.outcome ||
      this.respawnRemainingS > 0 ||
      this.spawnS > 0 ||
      enemies.length >= cfg.maxAlive
    )
      return null;
    const safe = (p: Vec3) =>
      freeModePosition(room, p, cfg.spawnClearanceM) &&
      distance(p, player) >= cfg.minSpawnDistanceM &&
      enemies.every((e) => distance(e, p) >= cfg.spawnClearanceM * 2);
    const ring = room.arena?.heist ? room.arena.spawnRing : undefined;
    if (ring) {
      // Duża arena: pierścień wokół gracza, najbliżej rdzenia (nosiciela, bazy albo upuszczonego).
      const pool = [...cfg.spawnPoints, ...arenaSpawnPoints(room)];
      const unique = new Map(pool.map((p) => [JSON.stringify(p), p]));
      return selectArenaSpawn(
        ring,
        [...unique.values()].filter(safe),
        player,
        [this.position],
        rng,
        occluded,
      );
    }
    const candidates = cfg.spawnPoints.filter(safe);
    return candidates.length ? { ...rng.pick(candidates) } : null;
  }

  spawned(): void {
    this.spawnS = this.definition.spawnIntervalS;
  }

  snapshot() {
    return {
      state: this.state,
      position: { ...this.position },
      carrierId: this.carrierId,
      lives: this.lives,
      respawnRemainingS: this.respawnRemainingS,
      extractProgress: this.extractElapsedS / this.definition.extractS,
      elapsedS: this.elapsedS,
      outcome: this.outcome,
    };
  }
}
