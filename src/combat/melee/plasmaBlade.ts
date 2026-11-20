import type { EntityId, EventBus, GameEvents, Team } from '../../core/events';
import type { InputSnapshot } from '../../core/input';
import type { Vec3 } from '../../core/math';
import type { ResourcePool } from '../../core/resource';
import type { Stats } from '../../core/stats';
import type { Tuning } from '../../core/tuning';
import { BLOCK_SOURCE, Hitbox, PIERCE_BLOCK_TAG } from '../damage';
import type { DamageInfo, DamageSystem, Hurtbox } from '../damage';
import type { ProjectileHit, ProjectileSystem } from '../weapons/projectiles';
import type {
  BladeDefinition,
  HitShape,
  StrikeDefinition,
} from './bladeSchema';

export type BladeState =
  'idle' | 'light' | 'charging' | 'heavy' | 'blocking' | 'throwing' | 'dashCut';
export type SwingPhase = 'windup' | 'active' | 'recovery';

export interface BladeDeps {
  tryExecute?(): boolean;
  attackSpeed?(): number;
  querySegment?(
    from: Vec3,
    to: Vec3,
    radius: number,
    dashCut: boolean,
    fallbackDir?: Vec3,
  ): Hurtbox[];
  hurtboxPosition?(box: Hurtbox): Vec3 | null;
  castWall?(origin: Vec3, dir: Vec3, max: number): number | null;
  dashActive?(): boolean;
  owner: EntityId;
  team: Team;
  damage: DamageSystem;
  /** Statystyki właściciela — blok nakłada na nie modyfikator damageTaken. */
  stats: Stats;
  /** Energia Rezonansu (blok ją zużywa). */
  energy: ResourcePool;
  /**
   * Hurtboxy w obszarze cięcia: `arc` — łuk przed atakującym (zasięg i szerokość w m),
   * `spin` — obrót 360° (kula o promieniu `reach` wokół oczu).
   */
  queryArc(reach: number, width: number, shape?: HitShape): Hurtbox[];
  /** Punkt oczu i kierunek patrzenia (do punktu trafienia i kierunku odrzutu). */
  aim(): { origin: Vec3; dir: Vec3 };
  /** Parowanie (#10): system pocisków do odbicia i pozycje strzelców (cel odbicia). */
  projectiles?: Pick<ProjectileSystem, 'reflect'>;
  positionOf?(id: EntityId): Vec3 | null;
}

/** Stan do animacji ostrza (render) i do testów. */
export interface BladeView {
  /** Zegar gracza: efekty FPP starzeją się razem z ostrzem, także w slowmo/hitstopie. */
  animationTimeS?: number;
  /** Czysto wizualne cięcie wykończenia; nie otwiera hitboxa ani combo. */
  execution?: { phase: SwingPhase; phaseT: number } | null;
  flight: {
    previous: Vec3;
    position: Vec3;
    previousAgeS: number;
    ageS: number;
    returning: boolean;
  } | null;
  state: BladeState;
  /** Etap combo 1..n (light) albo 0. */
  stage: number;
  phase: SwingPhase | null;
  /** Postęp bieżącej fazy 0..1. */
  phaseT: number;
  /** Naładowanie ciężkiego ataku 0..1. */
  charge: number;
  /** Czas trwania bieżącego bloku (s) — okno parowania (#10). */
  blockAgeS: number;
  /** Blokada bloku po rozbiciu gardy (s). */
  guardBrokenS: number;
}

/**
 * Ostrze plazmowe: combo lekkie (z danych), ciężki atak po przytrzymaniu, blok zużywający energię.
 * Lekki cios startuje od razu po wciśnięciu (zero opóźnienia); przytrzymanie `attack` dłużej niż
 * heavyHoldS przechodzi w ładowanie, a puszczenie po naładowaniu (heavyChargeS od wciśnięcia)
 * zadaje ciężki cios przebijający blok.
 */
export class PlasmaBlade {
  private animationTimeS = 0;
  private executionS: number | null = null;
  private flight: NonNullable<BladeView['flight']> | null = null;
  private flightDir: Vec3 = { x: 0, y: 0, z: -1 };
  private flightDistance = 0;
  private throwBufferS = 0;
  private specialHitstop: 'none' | 'light' | 'heavy' = 'none';
  private dashDir: Vec3 = { x: 0, y: 0, z: -1 };
  private readonly specialHits = new Set<EntityId>();
  private dashStart: Vec3 | null = null;
  private dashEnd: Vec3 | null = null;
  private dashGraceS = 0;
  private dashWasActive = false;
  private dashUsed = false;
  private readonly offDash: () => void;
  private readonly offGuard: () => void;
  private state: BladeState = 'idle';
  private stage = 0;
  private phase: SwingPhase | null = null;
  private phaseS = 0;
  private phaseAttackSpeed = 1;
  private sinceSwingS = Number.POSITIVE_INFINITY;
  private attackBufferS = 0;
  private holding = false;
  private holdS = 0;
  private blockAgeS = 0;
  private guardBrokenS = 0;
  private hitbox: Hitbox | null = null;
  private hitstopSent = false;
  private readonly off: () => void;

  constructor(
    private def: BladeDefinition,
    private readonly deps: BladeDeps,
    private readonly bus: EventBus,
    private readonly tuning: Tuning,
  ) {
    this.offGuard =
      deps.damage.addGuard?.(deps.owner, this.meleeParryGuard) ?? (() => {});
    this.offDash = bus.on('dash_used', ({ user, dir }) => {
      if (user !== deps.owner || !deps.dashActive) return;
      this.dashDir = normalizeVec(dir);
      this.dashStart = { ...deps.aim().origin };
      this.dashEnd = { ...this.dashStart };
      this.dashWasActive = true;
      this.dashUsed = false;
      this.dashGraceS = tuning.melee.dashCutGraceS;
    });
    this.off = bus.on('damage_dealt', (event) => this.onDamage(event));
  }

  get definition(): BladeDefinition {
    return this.def;
  }

  /** Zmiana wariantu ostrza (nowy run): czyści stan zamachu, bloku i rzutu. */
  setDefinition(def: BladeDefinition): void {
    this.reset();
    this.def = def;
  }

  view(): BladeView {
    const activeS = this.tuning.melee.lightActiveS * this.def.timeScale;
    const recoveryS = this.tuning.melee.lightRecoveryS * this.def.timeScale;
    return {
      animationTimeS: this.animationTimeS,
      execution:
        this.executionS === null
          ? null
          : this.executionS < activeS
            ? { phase: 'active', phaseT: this.executionS / activeS }
            : {
                phase: 'recovery',
                phaseT: (this.executionS - activeS) / recoveryS,
              },
      flight: this.flight
        ? {
            ...this.flight,
            previous: { ...this.flight.previous },
            position: { ...this.flight.position },
          }
        : null,
      state: this.state,
      stage: this.state === 'light' ? this.stage : 0,
      phase: this.phase,
      phaseT: this.phase ? Math.min(1, this.phaseS / this.phaseDuration()) : 0,
      charge:
        this.state === 'charging'
          ? Math.min(1, this.holdS / this.tuning.melee.heavyChargeS)
          : 0,
      blockAgeS: this.state === 'blocking' ? this.blockAgeS : 0,
      guardBrokenS: this.guardBrokenS,
    };
  }

  /**
   * Przechwytywanie trafień pocisków (ProjectileSystem.addInterceptor). Pocisk wroga, który
   * trafia właściciela w oknie parowania (blok rozpoczęty ≤ parryWindowMs temu) i nadlatuje
   * z przodu, zostaje odbity w strzelca — szybszy i silniejszy. Poza oknem działa zwykły blok.
   */
  readonly interceptProjectile = (hit: ProjectileHit): boolean => {
    const m = this.tuning.melee;
    const projectiles = this.deps.projectiles;
    if (!projectiles || hit.target !== this.deps.owner) return false;
    if (this.state !== 'blocking' || hit.team === this.deps.team) return false;
    if (this.blockAgeS * 1000 > m.parryWindowMs) return false;
    const { dir } = this.deps.aim();
    // Pocisk musi nadlatywać z przodu: kąt między -kierunkiem lotu a patrzeniem ≤ parryArcDeg/2.
    const facing = -(hit.dir.x * dir.x + hit.dir.y * dir.y + hit.dir.z * dir.z);
    const arcDeg = this.def.parryArcDeg ?? m.parryArcDeg;
    if (facing < Math.cos(((arcDeg / 2) * Math.PI) / 180)) return false;
    const shooter = this.deps.positionOf?.(hit.owner) ?? null;
    const back = shooter
      ? normalizeVec({
          x: shooter.x - hit.point.x,
          y: shooter.y + 1.2 - hit.point.y,
          z: shooter.z - hit.point.z,
        })
      : { x: -hit.dir.x, y: -hit.dir.y, z: -hit.dir.z };
    projectiles.reflect(hit.projectile, this.deps.owner, this.deps.team, back, {
      speedMult: m.parrySpeedMult,
      damageMult: m.parryDamageMult,
    });
    this.bus.emit('parry_success', {
      defender: this.deps.owner,
      projectile: hit.projectile,
      attacker: hit.owner,
    });
    this.bus.emit('hitstop', { ms: m.parryHitstopMs });
    this.bus.emit('camera_shake', {
      intensity: m.parryShake,
      durationS: m.parryShakeS,
      dir: null,
    });
    return true;
  };

  /**
   * Parowanie ciosów wręcz: blok wciśnięty ≤ `meleeParryWindowMs` przed trafieniem neguje
   * cios `#melee` z przodu (nie `#heavy`) i ogłusza atakującego (obsługa w AI wroga).
   */
  private readonly meleeParryGuard = (info: DamageInfo): number => {
    const m = this.tuning.melee;
    if (this.state !== 'blocking' || info.source === null) return 1;
    if (
      !info.tags.includes('#melee') ||
      info.tags.includes(PIERCE_BLOCK_TAG) ||
      this.blockAgeS * 1000 > m.meleeParryWindowMs
    )
      return 1;
    // Bez znanej pozycji atakującego nie da się sprawdzić łuku — brak parowania.
    const from = this.deps.positionOf?.(info.source);
    if (!from) return 1;
    const { origin, dir } = this.deps.aim();
    const dx = from.x - origin.x;
    const dz = from.z - origin.z;
    const len = Math.hypot(dx, dz);
    const arcDeg = this.def.parryArcDeg ?? m.parryArcDeg;
    const flat = Math.hypot(dir.x, dir.z);
    if (
      len > 1e-6 &&
      flat > 1e-6 &&
      (dx * dir.x + dz * dir.z) / (len * flat) <
        Math.cos(((arcDeg / 2) * Math.PI) / 180)
    )
      return 1;
    // Iskra w stronę atakującego; gdy stoi w osi oczu, w kierunku patrzenia.
    const toX = len > 1e-6 ? dx / len : flat > 1e-6 ? dir.x / flat : 0;
    const toZ = len > 1e-6 ? dz / len : flat > 1e-6 ? dir.z / flat : 0;
    const reach = Math.min(len > 1e-6 ? len : Infinity, m.meleeParrySparkM);
    this.bus.emit('melee_parried', {
      defender: this.deps.owner,
      attacker: info.source,
      point: {
        x: origin.x + toX * reach,
        y: origin.y + m.meleeParrySparkOffsetYM,
        z: origin.z + toZ * reach,
      },
    });
    // Parowanie wręcz liczy się jak każde parowanie (implanty, synergie, naszywki, energia).
    this.bus.emit('parry_success', {
      defender: this.deps.owner,
      projectile: null,
      attacker: info.source,
    });
    this.bus.emit('hitstop', { ms: m.parryHitstopMs });
    this.bus.emit('camera_shake', {
      intensity: m.parryShake,
      durationS: m.parryShakeS,
      dir: null,
    });
    return 0;
  };

  get blocking(): boolean {
    return this.state === 'blocking';
  }

  step(dt: number, input: InputSnapshot): void {
    if (dt > 0) {
      this.animationTimeS += dt;
      if (this.executionS !== null) {
        this.executionS += dt;
        if (
          this.executionS >=
          (this.tuning.melee.lightActiveS + this.tuning.melee.lightRecoveryS) *
            this.def.timeScale
        )
          this.executionS = null;
      }
    }
    const m = this.tuning.melee;
    const dashReadyAtStepStart = this.canDashCut();
    if (dt > 0) {
      this.updateDash(dt);
      this.guardBrokenS = Math.max(0, this.guardBrokenS - dt);
    }
    if (this.flight) {
      if (dt > 0) this.stepFlight(dt);
      else {
        this.flight.previous = { ...this.flight.position };
        this.flight.previousAgeS = this.flight.ageS;
      }
      return;
    }
    if (
      input.pressed.has('bladeThrow') &&
      this.def.throw &&
      this.deps.querySegment &&
      this.deps.castWall
    )
      this.throwBufferS = m.attackBufferMs / 1000;

    if (this.state === 'dashCut') {
      if (dt > 0) {
        this.throwBufferS = Math.max(0, this.throwBufferS - dt);
        this.applyDashCut();
        if (!this.dashWasActive) this.state = 'idle';
      }
      return;
    }
    if (input.pressed.has('attack')) {
      this.attackBufferS = m.attackBufferMs / 1000;
      this.holding = true;
      this.holdS = 0;
    }
    if (input.released.has('attack') || !input.held.has('attack')) {
      if (this.holding && this.state === 'charging') this.releaseCharge();
      this.holding = false;
    }
    if (dt <= 0) return;
    const dashReady = dashReadyAtStepStart || this.canDashCut();

    if (this.holding) this.holdS += dt;
    this.attackBufferS = Math.max(0, this.attackBufferS - dt);
    this.throwBufferS = Math.max(0, this.throwBufferS - dt);
    this.sinceSwingS += dt;

    if (this.canStartSpecial()) {
      if (this.throwBufferS > 0) {
        this.startThrow();
        this.stepFlight(dt);
        return;
      }
      if (this.attackBufferS > 0 && dashReady) {
        this.exitBlock();
        this.endSwing();
        this.clearAttack();
        this.specialHits.clear();
        this.dashUsed = true;
        this.state = 'dashCut';
        this.bus.emit('melee_swing', { attacker: this.deps.owner, stage: 1 });
        this.applyDashCut();
        if (!this.dashWasActive) this.state = 'idle';
        return;
      }
    }

    // Blok: tylko gdy nie trwa faza aktywna ciosu.
    const wantsBlock = input.held.has('block') && this.guardBrokenS <= 0;
    if (this.state === 'blocking') {
      if (!wantsBlock || this.attackBufferS > 0) this.exitBlock();
      else this.blockAgeS += dt;
    } else if (
      wantsBlock &&
      this.attackBufferS <= 0 &&
      (this.state === 'idle' ||
        (this.state === 'light' && this.phase !== 'active'))
    ) {
      this.enterBlock();
      return;
    }

    if (this.state === 'light' || this.state === 'heavy') this.stepSwing(dt);

    // Nowa akcja dopiero w kolejnym kroku po przejściu ciosu do recovery/idle.
    if (
      this.canStartSpecial() &&
      (this.throwBufferS > 0 || (this.attackBufferS > 0 && dashReady))
    )
      return;

    if (
      this.holding &&
      this.holdS >= m.heavyHoldS &&
      (this.state === 'idle' ||
        (this.state === 'light' && this.phase !== 'active'))
    ) {
      this.endSwing();
      this.state = 'charging';
      this.attackBufferS = 0;
    }

    if (this.attackBufferS > 0 && this.canStartLight()) {
      this.attackBufferS = 0;
      this.startLight();
    }

    if (this.state === 'idle' && this.sinceSwingS > m.comboWindowS)
      this.stage = 0;
  }

  private canStartSpecial(): boolean {
    return (
      this.state === 'idle' ||
      this.state === 'blocking' ||
      (this.state === 'light' && this.phase === 'recovery')
    );
  }

  private canDashCut(): boolean {
    return !!(
      this.def.dashCut &&
      this.deps.querySegment &&
      this.dashStart &&
      !this.dashUsed &&
      (this.dashWasActive || this.dashGraceS > 0)
    );
  }

  private startThrow(): void {
    this.exitBlock();
    this.endSwing();
    this.clearAttack();
    const { origin, dir } = this.deps.aim();
    this.flightDir = normalizeVec(dir);
    this.flight = {
      position: { ...origin },
      previous: { ...origin },
      ageS: 0,
      previousAgeS: 0,
      returning: false,
    };
    this.flightDistance = 0;
    this.specialHits.clear();
    this.state = 'throwing';
    this.bus.emit('blade_thrown', { owner: this.deps.owner });
  }

  /** Stan początkowy (nowy run): bez zamachu, bloku, buforów i blokady gardy. */
  reset(): void {
    this.executionS = null;
    this.exitBlock();
    this.flight = null;
    this.dashStart = null;
    this.dashEnd = null;
    this.dashWasActive = false;
    this.dashUsed = false;
    this.dashGraceS = 0;
    this.specialHits.clear();
    this.state = 'idle';
    this.stage = 0;
    this.phase = null;
    this.phaseS = 0;
    this.sinceSwingS = Number.POSITIVE_INFINITY;
    this.attackBufferS = 0;
    this.throwBufferS = 0;
    this.specialHitstop = 'none';
    this.holding = false;
    this.holdS = 0;
    this.blockAgeS = 0;
    this.guardBrokenS = 0;
    this.hitbox = null;
    this.hitstopSent = false;
  }

  dispose(): void {
    this.off();
    this.offDash();
    this.offGuard();
    this.exitBlock();
  }

  private clearAttack(): void {
    this.attackBufferS = 0;
    this.throwBufferS = 0;
    this.specialHitstop = 'none';
    this.holding = false;
    this.holdS = 0;
    this.stage = 0;
    this.sinceSwingS = Number.POSITIVE_INFINITY;
    this.hitstopSent = false;
  }

  private updateDash(dt: number): void {
    const active = this.deps.dashActive?.() ?? false;
    if (active || this.dashWasActive)
      this.dashEnd = { ...this.deps.aim().origin };
    if (active || this.dashWasActive)
      this.dashGraceS = this.tuning.melee.dashCutGraceS;
    else this.dashGraceS = Math.max(0, this.dashGraceS - dt);
    this.dashWasActive = active;
  }

  private applyDashCut(): void {
    const def = this.def.dashCut;
    if (!def || !this.dashStart || !this.dashEnd) return;
    this.segmentHits(
      this.dashStart,
      this.dashEnd,
      def.widthM / 2,
      def.damage,
      def.knockback,
      true,
    );
  }

  private stepFlight(dt: number): void {
    const flight = this.flight;
    const def = this.def.throw;
    if (!flight || !def) return;
    flight.previous = { ...flight.position };
    flight.previousAgeS = flight.ageS;
    flight.ageS += dt;
    const from = flight.position;
    const target = this.deps.aim().origin;
    const distance = flight.returning
      ? Math.hypot(target.x - from.x, target.y - from.y, target.z - from.z)
      : Math.max(0, def.rangeM - this.flightDistance);
    const dir = flight.returning
      ? normalizeVec({
          x: target.x - from.x,
          y: target.y - from.y,
          z: target.z - from.z,
        })
      : this.flightDir;
    const travel = Math.min(
      distance,
      (flight.returning ? def.returnSpeed : def.speed) * dt,
    );
    const wall = flight.returning
      ? null
      : (this.deps.castWall?.(from, dir, travel + def.radiusM) ?? null);
    const advance =
      wall === null
        ? travel
        : Math.max(0, Math.min(travel, wall - def.radiusM));
    const to = {
      x: from.x + dir.x * advance,
      y: from.y + dir.y * advance,
      z: from.z + dir.z * advance,
    };
    this.segmentHits(from, to, def.radiusM, def.damage, 0, false);
    flight.position = to;
    if (flight.returning) {
      if (travel >= distance) {
        this.flight = null;
        this.state = 'idle';
        this.clearAttack();
        this.bus.emit('blade_returned', { owner: this.deps.owner });
      }
    } else {
      this.flightDistance += advance;
      if (wall !== null || travel >= distance) flight.returning = true;
    }
  }

  private segmentHits(
    from: Vec3,
    to: Vec3,
    radius: number,
    amount: number,
    knockback: number,
    dash: boolean,
  ): void {
    const dir = normalizeVec(
      {
        x: to.x - from.x,
        y: to.y - from.y,
        z: to.z - from.z,
      },
      dash ? this.dashDir : this.flightDir,
    );
    let dealtAny = false;
    let killed = false;
    for (const box of this.deps.querySegment?.(from, to, radius, dash, dir) ??
      []) {
      if (
        this.specialHits.has(box.entity) ||
        !this.deps.damage.canDamage(this.deps.owner, box.entity, this.def.tags)
      )
        continue;
      const point =
        this.deps.hurtboxPosition?.(box) ??
        this.deps.positionOf?.(box.entity) ??
        null;
      if (!dash && point) {
        const toward = {
          x: point.x - from.x,
          y: point.y - from.y,
          z: point.z - from.z,
        };
        const distance = Math.hypot(toward.x, toward.y, toward.z);
        if (
          distance > 0 &&
          this.deps.castWall?.(from, normalizeVec(toward, dir), distance) !=
            null
        )
          continue;
      }
      this.specialHits.add(box.entity);
      const dealt = this.deps.damage.deal(box.entity, {
        amount,
        source: this.deps.owner,
        tags: this.def.tags,
        ...(point ? { point: { ...point } } : {}),
        dir,
        knockback,
      });
      if (dealt > 0) {
        dealtAny = true;
        killed ||= this.deps.damage.health(box.entity)?.dead ?? false;
      }
    }
    if (
      dealtAny &&
      (this.specialHitstop === 'none' ||
        (killed && this.specialHitstop !== 'heavy'))
    ) {
      this.specialHitstop = killed ? 'heavy' : 'light';
      this.bus.emit('hitstop', {
        ms: killed
          ? this.tuning.time.hitstopHeavyMs
          : this.tuning.time.hitstopLightMs,
      });
    }
  }

  // ------------------------------------------------------------------ ciosy

  private canStartLight(): boolean {
    if (this.state === 'idle') return true;
    // Kontynuacja combo w fazie odnowienia poprzedniego ciosu.
    return (
      this.state === 'light' &&
      this.phase === 'recovery' &&
      this.stage < this.def.combo.length
    );
  }

  private startLight(): void {
    this.executionS = null;
    if (this.deps.tryExecute?.()) {
      this.endSwing();
      this.clearAttack();
      this.executionS = 0;
      return;
    }
    const withinCombo =
      (this.state === 'light' && this.phase === 'recovery') ||
      this.sinceSwingS <= this.tuning.melee.comboWindowS;
    this.stage =
      withinCombo && this.stage < this.def.combo.length ? this.stage + 1 : 1;
    this.state = 'light';
    this.beginPhase('windup');
    this.bus.emit('melee_swing', {
      attacker: this.deps.owner,
      stage: this.stage as 1 | 2 | 3 | 4,
    });
  }

  private releaseCharge(): void {
    if (this.holdS >= this.tuning.melee.heavyChargeS) {
      this.state = 'heavy';
      this.stage = 0;
      this.beginPhase('windup');
      this.bus.emit('melee_swing', {
        attacker: this.deps.owner,
        stage: 'heavy',
      });
    } else {
      this.state = 'idle';
      this.phase = null;
    }
  }

  private beginPhase(phase: SwingPhase): void {
    this.phase = phase;
    this.phaseS = 0;
    this.phaseAttackSpeed = Math.max(
      this.tuning.melee.attackSpeedMin,
      Math.min(
        this.tuning.melee.attackSpeedMax,
        this.deps.attackSpeed?.() ?? 1,
      ),
    );
    if (phase === 'active') {
      const strike = this.strike();
      this.hitbox = new Hitbox({
        owner: this.deps.owner,
        team: this.deps.team,
        damage: strike.damage,
        tags:
          this.state === 'heavy'
            ? [...this.def.tags, PIERCE_BLOCK_TAG]
            : this.def.tags,
        lifetimeS: this.phaseDuration(),
      });
      this.hitstopSent = false;
    }
  }

  private stepSwing(dt: number): void {
    this.phaseS += dt;
    if (this.phase === 'active') this.applyHits(dt);
    if (this.phaseS < this.phaseDuration()) return;
    if (this.phase === 'windup') this.beginPhase('active');
    else if (this.phase === 'active') {
      this.hitbox = null;
      this.beginPhase('recovery');
    } else this.endSwing();
  }

  private endSwing(): void {
    if (this.state === 'light' || this.state === 'heavy') this.sinceSwingS = 0;
    if (this.state === 'heavy') this.stage = 0;
    this.state = 'idle';
    this.phase = null;
    this.hitbox = null;
  }

  private applyHits(dt: number): void {
    const hitbox = this.hitbox;
    if (!hitbox) return;
    const strike = this.strike();
    const { origin, dir } = this.deps.aim();
    const point = {
      x: origin.x + dir.x * strike.reach * 0.6,
      y: origin.y + dir.y * strike.reach * 0.6,
      z: origin.z + dir.z * strike.reach * 0.6,
    };
    let dealtAny = false;
    let killed = false;
    const spin = this.state === 'heavy' && this.def.heavyShape === 'spin';
    for (const box of this.deps.queryArc(
      strike.reach,
      strike.width,
      spin ? 'spin' : 'arc',
    )) {
      const hitDir = spin ? this.radialDir(box, origin, dir) : dir;
      const dealt = hitbox.strike(box.entity, this.deps.damage, {
        multiplier: box.multiplier,
        point: spin ? (this.deps.hurtboxPosition?.(box) ?? point) : point,
        dir: hitDir,
        knockback: strike.knockback,
      });
      if (dealt > 0) {
        dealtAny = true;
        if (this.deps.damage.health(box.entity)?.dead) killed = true;
      }
    }
    hitbox.step(dt);
    if (dealtAny && !this.hitstopSent) {
      this.hitstopSent = true;
      const t = this.tuning.time;
      const heavy = this.state === 'heavy' || killed;
      this.bus.emit('hitstop', {
        ms: heavy ? t.hitstopHeavyMs : t.hitstopLightMs,
      });
    }
  }

  /** Obrót: odrzut od gracza na zewnątrz (poziomo), gdy znana pozycja trafionego. */
  private radialDir(box: Hurtbox, origin: Vec3, fallback: Vec3): Vec3 {
    const at =
      this.deps.hurtboxPosition?.(box) ??
      this.deps.positionOf?.(box.entity) ??
      null;
    if (!at) return fallback;
    return normalizeVec(
      { x: at.x - origin.x, y: 0, z: at.z - origin.z },
      fallback,
    );
  }

  private strike(): StrikeDefinition {
    if (this.state === 'heavy') return this.def.heavy;
    const index = Math.min(this.def.combo.length, Math.max(1, this.stage)) - 1;
    return this.def.combo[index] as StrikeDefinition;
  }

  private phaseDuration(): number {
    const m = this.tuning.melee;
    const heavy = this.state === 'heavy';
    const scale = this.def.timeScale / this.phaseAttackSpeed;
    switch (this.phase) {
      case 'windup':
        return (heavy ? m.heavyWindupS : m.lightWindupS) * scale;
      case 'active':
        return (heavy ? m.heavyActiveS : m.lightActiveS) * scale;
      case 'recovery':
        return (heavy ? m.heavyRecoveryS : m.lightRecoveryS) * scale;
      default:
        return 1;
    }
  }

  // ------------------------------------------------------------------ blok

  private enterBlock(): void {
    this.endSwing();
    this.state = 'blocking';
    this.blockAgeS = 0;
    this.deps.stats.removeBySource(BLOCK_SOURCE);
    this.deps.stats.add({
      stat: 'damageTaken',
      type: 'mult',
      value: this.def.blockDamageMult,
      source: BLOCK_SOURCE,
    });
  }

  private exitBlock(): void {
    this.deps.stats.removeBySource(BLOCK_SOURCE);
    if (this.state === 'blocking') {
      this.state = 'idle';
      this.blockAgeS = 0;
    }
  }

  private onDamage(event: GameEvents['damage_dealt']): void {
    if (event.target !== this.deps.owner || this.state !== 'blocking') return;
    // Blok nie działał (ciężki cios, status, zagrożenie) — bez kosztu energii i bez melee_blocked.
    const blocked = event.blocked ?? 0;
    if (blocked <= 0) return;
    const original = event.amount + blocked;
    const cost =
      this.def.blockEnergyPerHit + original * this.def.blockEnergyPerDamage;
    this.bus.emit('melee_blocked', {
      defender: this.deps.owner,
      attacker: event.source,
      amount: blocked,
    });
    if (!this.deps.energy.spend(cost)) {
      // Rozbicie gardy: energia na zero, blok wyłączony na chwilę.
      this.deps.energy.set(0);
      this.exitBlock();
      this.guardBrokenS = this.tuning.melee.guardBreakLockS;
      this.bus.emit('camera_shake', {
        intensity: this.tuning.melee.guardBreakShake,
        durationS: this.tuning.melee.guardBreakShakeS,
        dir: null,
      });
    }
  }
}

function normalizeVec(v: Vec3, fallback: Vec3 = { x: 0, y: 0, z: -1 }): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  return len > 1e-9
    ? { x: v.x / len, y: v.y / len, z: v.z / len }
    : { ...fallback };
}
