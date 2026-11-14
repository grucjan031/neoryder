import type { EntityId, EventBus, GameEvents, Team } from '../../core/events';
import type { InputSnapshot } from '../../core/input';
import type { Vec3 } from '../../core/math';
import type { ResourcePool } from '../../core/resource';
import type { Stats } from '../../core/stats';
import type { Tuning } from '../../core/tuning';
import { BLOCK_SOURCE, Hitbox, PIERCE_BLOCK_TAG } from '../damage';
import type { DamageSystem, Hurtbox } from '../damage';
import type { ProjectileHit, ProjectileSystem } from '../weapons/projectiles';
import type { BladeDefinition, StrikeDefinition } from './bladeSchema';

export type BladeState = 'idle' | 'light' | 'charging' | 'heavy' | 'blocking';
export type SwingPhase = 'windup' | 'active' | 'recovery';

export interface BladeDeps {
  owner: EntityId;
  team: Team;
  damage: DamageSystem;
  /** Statystyki właściciela — blok nakłada na nie modyfikator damageTaken. */
  stats: Stats;
  /** Energia Rezonansu (blok ją zużywa). */
  energy: ResourcePool;
  /** Hurtboxy w łuku cięcia przed atakującym (zasięg i szerokość w m). */
  queryArc(reach: number, width: number): Hurtbox[];
  /** Punkt oczu i kierunek patrzenia (do punktu trafienia i kierunku odrzutu). */
  aim(): { origin: Vec3; dir: Vec3 };
  /** Parowanie (#10): system pocisków do odbicia i pozycje strzelców (cel odbicia). */
  projectiles?: Pick<ProjectileSystem, 'reflect'>;
  positionOf?(id: EntityId): Vec3 | null;
}

/** Stan do animacji ostrza (render) i do testów. */
export interface BladeView {
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
  private state: BladeState = 'idle';
  private stage = 0;
  private phase: SwingPhase | null = null;
  private phaseS = 0;
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
    private readonly def: BladeDefinition,
    private readonly deps: BladeDeps,
    private readonly bus: EventBus,
    private readonly tuning: Tuning,
  ) {
    this.off = bus.on('damage_dealt', (event) => this.onDamage(event));
  }

  view(): BladeView {
    return {
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
    if (facing < Math.cos(((m.parryArcDeg / 2) * Math.PI) / 180)) return false;
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
      projectile: hit.projectile,
      attacker: hit.owner,
    });
    this.bus.emit('hitstop', { ms: m.parryHitstopMs });
    this.bus.emit('camera_shake', {
      intensity: m.parryShake,
      durationS: 0.2,
      dir: null,
    });
    return true;
  };

  get blocking(): boolean {
    return this.state === 'blocking';
  }

  step(dt: number, input: InputSnapshot): void {
    const m = this.tuning.melee;
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

    if (this.holding) this.holdS += dt;
    this.attackBufferS = Math.max(0, this.attackBufferS - dt);
    this.guardBrokenS = Math.max(0, this.guardBrokenS - dt);
    this.sinceSwingS += dt;

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

    // Przytrzymanie: ładowanie ciężkiego (po zakończeniu fazy aktywnej bieżącego ciosu).
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

  /** Stan początkowy (nowy run): bez zamachu, bloku, buforów i blokady gardy. */
  reset(): void {
    this.exitBlock();
    this.state = 'idle';
    this.stage = 0;
    this.phase = null;
    this.phaseS = 0;
    this.sinceSwingS = Number.POSITIVE_INFINITY;
    this.attackBufferS = 0;
    this.holding = false;
    this.holdS = 0;
    this.blockAgeS = 0;
    this.guardBrokenS = 0;
    this.hitbox = null;
    this.hitstopSent = false;
  }

  dispose(): void {
    this.off();
    this.exitBlock();
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
    const withinCombo =
      (this.state === 'light' && this.phase === 'recovery') ||
      this.sinceSwingS <= this.tuning.melee.comboWindowS;
    this.stage =
      withinCombo && this.stage < this.def.combo.length ? this.stage + 1 : 1;
    this.state = 'light';
    this.beginPhase('windup');
    this.bus.emit('melee_swing', {
      attacker: this.deps.owner,
      stage: this.stage as 1 | 2 | 3,
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
    for (const box of this.deps.queryArc(strike.reach, strike.width)) {
      const dealt = hitbox.strike(box.entity, this.deps.damage, {
        multiplier: box.multiplier,
        point,
        dir,
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

  private strike(): StrikeDefinition {
    if (this.state === 'heavy') return this.def.heavy;
    const index = Math.min(this.def.combo.length, Math.max(1, this.stage)) - 1;
    return this.def.combo[index] as StrikeDefinition;
  }

  private phaseDuration(): number {
    const m = this.tuning.melee;
    const heavy = this.state === 'heavy';
    switch (this.phase) {
      case 'windup':
        return heavy ? m.heavyWindupS : m.lightWindupS;
      case 'active':
        return heavy ? m.heavyActiveS : m.lightActiveS;
      case 'recovery':
        return heavy ? m.heavyRecoveryS : m.lightRecoveryS;
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
    if (event.tags.includes(PIERCE_BLOCK_TAG)) return; // blok nie zadziałał
    const mult = Math.max(1e-6, this.def.blockDamageMult);
    const original = event.amount / mult;
    const cost =
      this.def.blockEnergyPerHit + original * this.def.blockEnergyPerDamage;
    this.bus.emit('melee_blocked', {
      defender: this.deps.owner,
      attacker: event.source,
      amount: original - event.amount,
    });
    if (!this.deps.energy.spend(cost)) {
      // Rozbicie gardy: energia na zero, blok wyłączony na chwilę.
      this.deps.energy.set(0);
      this.exitBlock();
      this.guardBrokenS = this.tuning.melee.guardBreakLockS;
      this.bus.emit('camera_shake', {
        intensity: 0.5,
        durationS: 0.3,
        dir: null,
      });
    }
  }
}

function normalizeVec(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  return len > 1e-9
    ? { x: v.x / len, y: v.y / len, z: v.z / len }
    : { x: 0, y: 0, z: -1 };
}
