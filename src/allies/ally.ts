import type { Health } from '../combat/damage';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Rng } from '../core/rng';
import type { Stats } from '../core/stats';
import type { Tuning } from '../core/tuning';
import type { AllyBark, AllyDefinition } from './allySchema';
import { selectAllyTarget } from './targeting';

export type AllyState =
  | 'follow'
  | 'engage'
  | 'takeCover'
  | 'reposition'
  | 'hold'
  | 'downed'
  | 'reviving';
export type AllyOrder = 'follow' | 'hold';
export type AllyMotion = 'idle' | 'walk' | 'run';
export type AllyParams = Tuning['allies'];
export type AllyReviveSource = 'player' | 'checkpoint' | 'debug';

/** Wycinek `ArenaNavigation`; bez nawigacji sojusznik idzie prosto do celu, omijając ściany. */
export interface AllyNavigation {
  next(from: Vec3, to: Vec3): Vec3;
  path(from: Vec3, to: Vec3): Vec3[];
}

/** Żywy wróg: stopy, wysokość środka sylwetki i to, czy ostatnio atakował gracza. */
export interface AllyHostile {
  id: EntityId;
  position: Vec3;
  centerM: number;
  attackingPlayer: boolean;
}

/** Gracz: stopy, yaw kamery (przód = −sin, −cos) i to, czy żyje. */
export interface AllyLeader {
  position: Vec3;
  yaw: number;
  alive: boolean;
}

export interface AllyShot {
  origin: Vec3;
  dir: Vec3;
}

export type AllyEvent =
  | { type: 'state'; from: AllyState; to: AllyState }
  | { type: 'downed'; source: EntityId | null }
  | { type: 'revived'; by: AllyReviveSource }
  | { type: 'evacuated' }
  | { type: 'bark'; kind: AllyBark; text: string };

/** Świat widziany przez sojusznika; scena podaje Rapiera, testy proste atrapy. */
export interface AllyEnvironment {
  navigation(): AllyNavigation | null;
  /** Czy odcinek nie przecina geometrii świata (linia wzroku i ruch). */
  clear(from: Vec3, to: Vec3): boolean;
  /** Wysokość podłoża pod punktem (stopy) albo null, gdy podłoża nie ma. */
  ground(point: Vec3): number | null;
  hostiles(): readonly AllyHostile[];
  leader(): AllyLeader;
  /** Stopy pozostałych aktywnych sojuszników. */
  mates(self: Ally): readonly Vec3[];
  fire(self: Ally, shot: AllyShot): void;
  emit(self: Ally, event: AllyEvent): void;
}

export interface AllySnapshot {
  id: string;
  entity: EntityId;
  name: string;
  role: AllyDefinition['role'];
  state: AllyState;
  order: AllyOrder;
  position: Vec3;
  yaw: number;
  hp: number;
  maxHp: number;
  motion: AllyMotion;
  aiming: boolean;
  /** Czas od ostatniego strzału (s); null, gdy jeszcze nie strzelał. */
  shotS: number | null;
  reviveProgress: number;
  /** Powalony nie doczekał pomocy i czeka na checkpoint albo koniec fali. */
  evacuated: boolean;
  target: EntityId | null;
  kills: number;
  shots: number;
  stuckEvents: number;
}

const epsilon = 1e-6;
const horizontal = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.z - b.z);
const AVOID_OFFSETS = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
/** Kolejność miejsc doskoku za plecy gracza (kąt od kierunku „za plecami”). */
const TELEPORT_ANGLES = [
  0,
  Math.PI / 4,
  -Math.PI / 4,
  Math.PI / 2,
  -Math.PI / 2,
];

/**
 * Sojusznik drużyny gracza: czysta logika w stałym kroku, bez fizyki i renderu.
 * `follow`/`hold` (rozkaz) → `engage` (widoczny wróg w zasięgu) → `reposition` albo `takeCover`
 * → `downed` (zdrowie 0) → `reviving` (gracz podnosi) → rozkaz. Pozycje to stopy.
 */
export class Ally {
  kills = 0;
  private _state: AllyState = 'follow';
  private _order: AllyOrder = 'follow';
  private _motion: AllyMotion = 'idle';
  private _yaw = 0;
  private readonly pos: Vec3;
  private holdPoint: Vec3;
  private targetId: EntityId | null = null;
  private retargetS = 0;
  private unseenS = 0;
  private phase: 'aim' | 'burst' | 'cooldown' | 'reload' = 'aim';
  private phaseS = 0;
  private nextShotS = 0;
  private burstShots = 0;
  private bursts = 0;
  private aiming = false;
  private shotS: number | null = null;
  private shots = 0;
  private moving = false;
  private leashed = false;
  private avoidSide = 1;
  private stuckS = 0;
  private anchor: Vec3;
  private _stuckEvents = 0;
  private tacticalGoal: Vec3 | null = null;
  private tacticalS = 0;
  private coverHolding = false;
  private coverRetryS = 0;
  private downedS = 0;
  private reviveS = 0;
  private assisted = false;
  private _evacuated = false;
  private invulnS = 0;
  private barkS = 0;

  constructor(
    readonly entity: EntityId,
    readonly definition: AllyDefinition,
    /** Miejsce w szyku za graczem (0, 1, …). */
    readonly slot: number,
    start: Vec3,
    private readonly health: Health,
    private readonly stats: Stats,
    private readonly env: AllyEnvironment,
    private readonly params: AllyParams,
    private readonly rng: Rng,
  ) {
    this.pos = { ...start };
    this.holdPoint = { ...start };
    this.anchor = { ...start };
    this.avoidSide = slot % 2 === 0 ? 1 : -1;
  }

  get state(): AllyState {
    return this._state;
  }
  get order(): AllyOrder {
    return this._order;
  }
  get position(): Vec3 {
    return this.pos;
  }
  get yaw(): number {
    return this._yaw;
  }
  get down(): boolean {
    return this._state === 'downed' || this._state === 'reviving';
  }
  get evacuated(): boolean {
    return this._evacuated;
  }
  /** Powalony albo świeżo podniesiony: obrażenia nie wchodzą. */
  get invulnerable(): boolean {
    return this.down || this.invulnS > 0;
  }
  /** Środek sylwetki: punkt, w który celują wrogowie. */
  center(): Vec3 {
    return { x: this.pos.x, y: this.pos.y + this.params.chestM, z: this.pos.z };
  }

  setOrder(order: AllyOrder): void {
    this._order = order;
    this.moving = false;
    if (order === 'hold') this.holdPoint = { ...this.pos };
    if (this._state === 'follow' || this._state === 'hold')
      this.setState(order);
  }

  /** Gracz podnosi powalonego w tym kroku (wołać przed `step`). */
  assist(): void {
    if (this.down && !this._evacuated) this.assisted = true;
  }

  /** Powalenie: zdrowie 0, koniec walki; sojusznik czeka na podniesienie. */
  knockDown(source: EntityId | null): void {
    if (this.down) return;
    this.health.set(0);
    this.resetCombat();
    this.targetId = null;
    this.downedS = 0;
    this.reviveS = 0;
    this.assisted = false;
    this._evacuated = false;
    this.moving = false;
    this._motion = 'idle';
    this.setState('downed');
    this.env.emit(this, { type: 'downed', source });
    this.bark('downed', true);
  }

  /** Podniesienie; `at` przestawia sojusznika (checkpoint). Gracz przywraca część zdrowia, reszta pełne. */
  revive(by: AllyReviveSource, at?: Vec3): void {
    if (at) this.place(at);
    if (!this.down) {
      if (by !== 'player') this.health.reset();
      return;
    }
    this.health.reset();
    if (by === 'player')
      this.health.set(this.health.max * this.params.reviveHpFraction);
    this.invulnS = this.params.reviveInvulnS;
    this.reviveS = 0;
    this.downedS = 0;
    this.assisted = false;
    this._evacuated = false;
    if (this._order === 'hold') this.holdPoint = { ...this.pos };
    this.setState(this._order);
    this.env.emit(this, { type: 'revived', by });
    this.bark('revived', true);
  }

  place(feet: Vec3): void {
    this.pos.x = feet.x;
    this.pos.y = feet.y;
    this.pos.z = feet.z;
    this.moving = false;
    this.resetStuck();
  }

  /** Kwestia z danych; `force` pomija odstęp między kwestiami (powalenie, podniesienie). */
  bark(kind: AllyBark, force = false): void {
    if (!force && this.barkS > 0) return;
    this.barkS = this.params.barkCooldownS;
    this.env.emit(this, {
      type: 'bark',
      kind,
      text: this.rng.pick(this.definition.barks[kind]),
    });
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    const p = this.params;
    this._motion = 'idle';
    this.aiming = false;
    if (this.shotS !== null) this.shotS += dt;
    this.invulnS = Math.max(0, this.invulnS - dt);
    this.barkS = Math.max(0, this.barkS - dt);
    this.coverRetryS = Math.max(0, this.coverRetryS - dt);
    if (this.down) {
      this.stepDowned(dt);
      return;
    }
    if (this.health.dead) {
      this.knockDown(null);
      return;
    }
    const leader = this.env.leader();
    let gap = horizontal(this.pos, leader.position);
    if (this._order === 'follow' && leader.alive && gap > p.teleportDistanceM) {
      this.teleportNear(leader);
      gap = horizontal(this.pos, leader.position);
    }
    if (this._order !== 'follow' || !leader.alive) this.leashed = false;
    else if (gap > p.leashM) this.leashed = true;
    else if (gap <= p.leashResumeM) this.leashed = false;
    const target = this.acquire(dt);
    if (this._state === 'takeCover') this.stepCover(dt, target);
    else if (this._state === 'reposition') this.stepReposition(dt, target);
    else if (target && !this.leashed) {
      this.setState('engage');
      this.stepEngage(dt, target);
    } else {
      this.resetCombat();
      this.setState(this._order);
      this.stepAnchor(dt, leader, gap);
    }
    if (this._motion === 'idle') this.separate(dt);
  }

  snapshot(): AllySnapshot {
    return {
      id: this.definition.id,
      entity: this.entity,
      name: this.definition.name,
      role: this.definition.role,
      state: this._state,
      order: this._order,
      position: { ...this.pos },
      yaw: this._yaw,
      hp: this.health.current,
      maxHp: this.health.max,
      motion: this._motion,
      aiming: this.aiming,
      shotS: this.shotS,
      reviveProgress: Math.min(1, this.reviveS / this.definition.reviveS),
      evacuated: this._evacuated,
      target: this.targetId,
      kills: this.kills,
      shots: this.shots,
      stuckEvents: this._stuckEvents,
    };
  }

  // ------------------------------------------------------------------ stany

  private setState(state: AllyState): void {
    if (state === this._state) return;
    const from = this._state;
    this._state = state;
    this.env.emit(this, { type: 'state', from, to: state });
  }

  private resetCombat(): void {
    this.phase = 'aim';
    this.phaseS = 0;
    this.tacticalGoal = null;
    this.coverHolding = false;
  }

  private stepDowned(dt: number): void {
    if (this._evacuated) return;
    this.downedS += dt;
    if (this.assisted) {
      this.assisted = false;
      this.setState('reviving');
      this.reviveS += dt;
      if (this.reviveS + epsilon >= this.definition.reviveS)
        this.revive('player');
      return;
    }
    this.setState('downed');
    this.reviveS = Math.max(0, this.reviveS - this.params.reviveDecayPerS * dt);
    if (this.downedS >= this.params.downedTimeoutS) {
      this._evacuated = true;
      this.env.emit(this, { type: 'evacuated' });
    }
  }

  private muzzle(): Vec3 {
    const p = this.params;
    return {
      x: this.pos.x + Math.sin(this._yaw) * p.muzzleForwardM,
      y: this.pos.y + p.muzzleM,
      z: this.pos.z + Math.cos(this._yaw) * p.muzzleForwardM,
    };
  }

  /** Oko do oceny widoczności: nad stopami, bez wysunięcia wylotu (ten zależy od obrotu). */
  private eye(): Vec3 {
    return {
      x: this.pos.x,
      y: this.pos.y + this.params.muzzleM,
      z: this.pos.z,
    };
  }

  private acquire(dt: number): AllyHostile | null {
    const p = this.params;
    const hostiles = this.env.hostiles();
    const find = (): AllyHostile | null =>
      this.targetId === null
        ? null
        : (hostiles.find((hostile) => hostile.id === this.targetId) ?? null);
    let current = find();
    if (!current) this.targetId = null;
    this.retargetS -= dt;
    if (this.retargetS > 0 && current) return current;
    this.retargetS = p.retargetS;
    const eye = this.eye();
    const picked = selectAllyTarget(
      eye,
      hostiles.map((hostile) => ({
        id: hostile.id,
        position: aimPoint(hostile),
        attackingPlayer: hostile.attackingPlayer,
      })),
      {
        rangeM: this.definition.engageRangeM,
        attackerBias: p.playerAttackerBias,
        stickyBias: p.stickyBias,
        currentId: this.targetId,
      },
      (candidate) => this.env.clear(eye, candidate.position),
    );
    if (picked) {
      if (this.targetId === null) this.bark('contact');
      this.targetId = picked.id;
      this.unseenS = 0;
    } else if (current) {
      // Cel za osłoną: sojusznik pamięta go przez `loseSightS`, ale przez ścianę nie strzela.
      this.unseenS += p.retargetS;
      if (this.unseenS >= p.loseSightS) this.targetId = null;
    }
    current = find();
    return current;
  }

  private stepEngage(dt: number, target: AllyHostile): void {
    const p = this.params;
    const w = this.definition.weapon;
    const aim = aimPoint(target);
    const facing = this.face(aim, dt);
    this.aiming = true;
    this.phaseS += dt;
    if (this.phase === 'aim') {
      if (this.phaseS + epsilon >= p.aimS && facing) {
        this.phase = 'burst';
        this.phaseS = 0;
        this.nextShotS = 0;
        this.burstShots = 0;
      }
    } else if (this.phase === 'burst') {
      if (this.phaseS + epsilon >= this.nextShotS) {
        this.shoot(aim);
        this.burstShots++;
        this.nextShotS += w.burstIntervalS;
        if (this.burstShots >= w.burstCount) {
          this.bursts++;
          this.phaseS = 0;
          if (this.bursts >= w.burstsPerReload) {
            this.bursts = 0;
            this.phase = 'reload';
            this.bark('reload');
          } else this.phase = 'cooldown';
          this.afterBurst(target);
        }
      }
    } else if (
      this.phaseS + epsilon >=
      (this.phase === 'reload' ? w.reloadS : w.cooldownS)
    ) {
      this.phase = 'aim';
      this.phaseS = 0;
    }
  }

  /** Strzał tylko przy czystej linii od wylotu do celu: sojusznik nie strzela przez ściany. */
  private shoot(aim: Vec3): void {
    const origin = this.muzzle();
    if (!this.env.clear(this.eye(), origin) || !this.env.clear(origin, aim))
      return;
    const w = this.definition.weapon;
    const dx = aim.x - origin.x;
    const dy = aim.y - origin.y;
    const dz = aim.z - origin.z;
    const spread =
      (((1 - this.definition.accuracy) * this.params.maxSpreadDeg +
        (w.pellets > 1 ? w.pelletSpreadDeg : 0)) *
        Math.PI) /
      180;
    for (let i = 0; i < w.pellets; i++) {
      const yaw = Math.atan2(dx, dz) + this.rng.float(-spread, spread);
      const pitch =
        Math.atan2(dy, Math.hypot(dx, dz)) + this.rng.float(-spread, spread);
      this.env.fire(this, {
        origin,
        dir: {
          x: Math.sin(yaw) * Math.cos(pitch),
          y: Math.sin(pitch),
          z: Math.cos(yaw) * Math.cos(pitch),
        },
      });
    }
    this.shots++;
    this.shotS = 0;
  }

  private afterBurst(target: AllyHostile): void {
    const p = this.params;
    if (
      this.health.current / this.health.max <= p.coverHpFraction &&
      this.coverRetryS <= 0
    ) {
      this.coverRetryS = p.coverRetryS;
      if (this.seekCover(target)) return;
    }
    if (this.rng.chance(p.repositionChance)) this.seekReposition(target);
  }

  private reachable(goal: Vec3): boolean {
    const p = this.params;
    const ground = this.env.ground(goal);
    return (
      ground !== null &&
      Math.abs(ground - this.pos.y) <= p.maxStepM &&
      this.env.clear(this.center(), { ...goal, y: goal.y + p.chestM })
    );
  }

  /** Punkt w pobliżu, z którego wróg nie widzi sojusznika; false, gdy takiego nie ma. */
  private seekCover(target: AllyHostile): boolean {
    const p = this.params;
    const threat = aimPoint(target);
    const offset = this.rng.float(0, Math.PI * 2);
    for (const radius of [p.coverRadiusM / 2, p.coverRadiusM])
      for (let i = 0; i < p.coverSamples; i++) {
        const angle = offset + (i * Math.PI * 2) / p.coverSamples;
        const goal = {
          x: this.pos.x + Math.sin(angle) * radius,
          y: this.pos.y,
          z: this.pos.z + Math.cos(angle) * radius,
        };
        if (
          this.env.clear({ ...goal, y: goal.y + p.chestM }, threat) ||
          !this.reachable(goal)
        )
          continue;
        this.tacticalGoal = goal;
        this.tacticalS = p.coverTravelS;
        this.coverHolding = false;
        this.setState('takeCover');
        return true;
      }
    return false;
  }

  private seekReposition(target: AllyHostile): void {
    const p = this.params;
    const dx = target.position.x - this.pos.x;
    const dz = target.position.z - this.pos.z;
    const length = Math.hypot(dx, dz);
    if (length <= epsilon) return;
    const first = this.rng.chance(0.5) ? 1 : -1;
    for (const side of [first, -first]) {
      const goal = {
        x: this.pos.x + (dz / length) * side * p.repositionM,
        y: this.pos.y,
        z: this.pos.z - (dx / length) * side * p.repositionM,
      };
      if (!this.reachable(goal)) continue;
      this.tacticalGoal = goal;
      this.tacticalS = p.repositionS;
      this.setState('reposition');
      return;
    }
  }

  private stepCover(dt: number, target: AllyHostile | null): void {
    const p = this.params;
    this.tacticalS -= dt;
    if (!this.tacticalGoal || (!this.coverHolding && this.tacticalS <= 0)) {
      this.leaveTactic(target);
      return;
    }
    if (!this.coverHolding) {
      if (this.moveTo(this.tacticalGoal, this.stats.get('moveSpeed'), dt)) {
        this.coverHolding = true;
        this.tacticalS = p.coverHoldS;
      }
      return;
    }
    // Za osłoną sojusznik łapie oddech; wraca do walki po `coverHoldS` albo gdy wróg zniknie.
    this.health.heal(p.coverRegenPerS * dt);
    if (target) this.face(aimPoint(target), dt);
    if (this.tacticalS <= 0 || !target) this.leaveTactic(target);
  }

  private stepReposition(dt: number, target: AllyHostile | null): void {
    this.tacticalS -= dt;
    if (
      !this.tacticalGoal ||
      !target ||
      this.tacticalS <= 0 ||
      this.moveTo(this.tacticalGoal, this.stats.get('moveSpeed'), dt)
    )
      this.leaveTactic(target);
  }

  private leaveTactic(target: AllyHostile | null): void {
    this.resetCombat();
    this.setState(target && !this.leashed ? 'engage' : this._order);
  }

  // ------------------------------------------------------------------ ruch

  private stepAnchor(dt: number, leader: AllyLeader, gap: number): void {
    const p = this.params;
    const run = this.stats.get('moveSpeed');
    if (leader.alive && gap < p.yieldRadiusM) {
      this.yieldTo(leader, run * p.yieldSpeedScale * dt, dt);
      this.resetStuck();
      return;
    }
    const follow = this._order === 'follow';
    if (follow && !leader.alive) return;
    const goal = follow ? this.slotPoint(leader) : this.holdPoint;
    if (!this.moving)
      this.moving = follow
        ? gap > this.definition.followDistanceM + p.followSlackM
        : horizontal(this.pos, goal) > p.arrivalM * 2;
    if (!this.moving) {
      this.resetStuck();
      return;
    }
    const speed =
      follow && gap > p.catchUpDistanceM ? run : run * p.walkSpeedScale;
    if (this.moveTo(goal, speed, dt)) {
      this.moving = false;
      this.resetStuck();
    } else this.trackStuck(dt, leader);
  }

  /** Miejsce w szyku za plecami gracza; gdy zasłania je ściana, celem jest sam gracz. */
  private slotPoint(leader: AllyLeader): Vec3 {
    const p = this.params;
    const rank = Math.floor(this.slot / 2) + 1;
    const angle =
      leader.yaw +
      (this.slot % 2 === 0 ? 1 : -1) *
        rank *
        ((p.slotSpreadDeg * Math.PI) / 180);
    // Za plecami: przeciwnie do przodu kamery (−sin, −cos).
    const point = {
      x: leader.position.x + Math.sin(angle) * this.definition.followDistanceM,
      y: leader.position.y,
      z: leader.position.z + Math.cos(angle) * this.definition.followDistanceM,
    };
    const ground = this.env.ground(point);
    const chest = (v: Vec3): Vec3 => ({ ...v, y: v.y + p.chestM });
    return ground !== null &&
      Math.abs(ground - leader.position.y) <= p.maxStepM &&
      this.env.clear(chest(leader.position), chest(point))
      ? point
      : leader.position;
  }

  /** Gracz wszedł na sojusznika: zejście w bok, prostopadle do kierunku patrzenia gracza. */
  private yieldTo(leader: AllyLeader, length: number, dt: number): void {
    const fx = -Math.sin(leader.yaw);
    const fz = -Math.cos(leader.yaw);
    let ax = this.pos.x - leader.position.x;
    let az = this.pos.z - leader.position.z;
    const away = Math.hypot(ax, az);
    if (away > epsilon) {
      ax /= away;
      az /= away;
    } else {
      ax = 0;
      az = 0;
    }
    const cross = fx * az - fz * ax;
    const side = Math.abs(cross) > 0.05 ? Math.sign(cross) : this.avoidSide;
    const heading = Math.atan2(ax - fz * side, az + fx * side);
    if (this.advance(heading, length)) {
      this._motion = 'walk';
      this.turn(heading, dt);
    }
    this.moving = false;
  }

  /** Krok w stronę celu po nawigacji albo prosto; true po dotarciu. */
  private moveTo(goal: Vec3, speed: number, dt: number): boolean {
    const p = this.params;
    if (horizontal(this.pos, goal) <= p.arrivalM) return true;
    const nav = this.env.navigation();
    let waypoint = nav ? nav.next(this.pos, goal) : goal;
    if (horizontal(waypoint, this.pos) <= 1e-3) waypoint = goal;
    const dx = waypoint.x - this.pos.x;
    const dz = waypoint.z - this.pos.z;
    const heading = Math.atan2(dx, dz);
    if (this.advance(heading, Math.min(speed * dt, Math.hypot(dx, dz)))) {
      this._motion =
        speed >= this.stats.get('moveSpeed') * 0.9 ? 'run' : 'walk';
      this.turn(heading, dt);
    }
    return false;
  }

  /** Przesunięcie o `length`; przy ścianie albo uskoku próbuje odchyleń 45° i 90°. */
  private advance(heading: number, length: number): boolean {
    const p = this.params;
    if (!(length > 0)) return false;
    for (const offset of AVOID_OFFSETS) {
      const angle = heading + offset * this.avoidSide;
      const sx = Math.sin(angle);
      const sz = Math.cos(angle);
      const reach = length + p.colliderRadiusM;
      let free = true;
      // Dwie wysokości: klatka (ściany) i tuż nad progiem (niskie osłony).
      for (const lift of [p.chestM, p.maxStepM + 0.15]) {
        const from = { x: this.pos.x, y: this.pos.y + lift, z: this.pos.z };
        const to = {
          x: from.x + sx * reach,
          y: from.y,
          z: from.z + sz * reach,
        };
        if (!this.env.clear(from, to)) {
          free = false;
          break;
        }
      }
      if (!free) continue;
      const next = {
        x: this.pos.x + sx * length,
        y: this.pos.y,
        z: this.pos.z + sz * length,
      };
      const ground = this.env.ground(next);
      if (ground === null || Math.abs(ground - this.pos.y) > p.maxStepM)
        continue;
      this.pos.x = next.x;
      this.pos.y = ground;
      this.pos.z = next.z;
      return true;
    }
    return false;
  }

  private turn(heading: number, dt: number): boolean {
    const delta = Math.atan2(
      Math.sin(heading - this._yaw),
      Math.cos(heading - this._yaw),
    );
    const limit = ((this.params.turnRateDegS * Math.PI) / 180) * dt;
    this._yaw += Math.max(-limit, Math.min(limit, delta));
    return Math.abs(delta) <= limit + epsilon;
  }

  private face(point: Vec3, dt: number): boolean {
    return this.turn(
      Math.atan2(point.x - this.pos.x, point.z - this.pos.z),
      dt,
    );
  }

  private separate(dt: number): void {
    const p = this.params;
    for (const mate of this.env.mates(this)) {
      const d = horizontal(this.pos, mate);
      if (d >= p.separationM) continue;
      const heading =
        d > epsilon
          ? Math.atan2(this.pos.x - mate.x, this.pos.z - mate.z)
          : (this.slot * Math.PI * 2) / p.maxSquad;
      const speed = this.stats.get('moveSpeed') * p.walkSpeedScale;
      if (this.advance(heading, Math.min(p.separationM - d, speed * dt)))
        this._motion = 'walk';
      return;
    }
  }

  private resetStuck(): void {
    this.stuckS = 0;
    this.anchor = { ...this.pos };
  }

  private trackStuck(dt: number, leader: AllyLeader): void {
    const p = this.params;
    if (horizontal(this.pos, this.anchor) >= p.stuckEpsM) {
      this.resetStuck();
      return;
    }
    this.stuckS += dt;
    if (this.stuckS < p.stuckS) return;
    this._stuckEvents++;
    this.avoidSide = -this.avoidSide;
    if (this._order === 'follow' && leader.alive) this.teleportNear(leader);
    else {
      const next = this.env
        .navigation()
        ?.path(this.pos, this.holdPoint)
        .find((point) => horizontal(point, this.pos) >= p.stuckEpsM);
      if (next) this.place(next);
    }
    this.resetStuck();
  }

  /** Doskok za plecy gracza (daleko albo po utknięciu); bez wolnego miejsca staje przy graczu. */
  private teleportNear(leader: AllyLeader): void {
    const p = this.params;
    const chest = (v: Vec3): Vec3 => ({ ...v, y: v.y + p.chestM });
    for (const offset of TELEPORT_ANGLES) {
      const angle = leader.yaw + offset * this.avoidSide;
      const point = {
        x: leader.position.x + Math.sin(angle) * p.teleportBehindM,
        y: leader.position.y,
        z: leader.position.z + Math.cos(angle) * p.teleportBehindM,
      };
      const ground = this.env.ground(point);
      if (
        ground === null ||
        Math.abs(ground - leader.position.y) > p.maxStepM ||
        !this.env.clear(chest(leader.position), chest(point))
      )
        continue;
      this.place({ ...point, y: ground });
      return;
    }
    this.place(leader.position);
  }
}

function aimPoint(hostile: AllyHostile): Vec3 {
  return {
    x: hostile.position.x,
    y: hostile.position.y + hostile.centerM,
    z: hostile.position.z,
  };
}
