import type { EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Rng } from '../core/rng';
import type { Tuning } from '../core/tuning';
import type { HubLayout } from './hubSchema';
import type { HubFocusBox } from './hubStations';
import { FaunaGround } from './hubFaunaGround';

export type CatState = 'walk' | 'sit' | 'lie' | 'groom' | 'flee' | 'return';
export interface FaunaPose {
  position: Vec3;
  previous: Vec3;
  yaw: number;
  previousYaw: number;
  distance: number;
  previousDistance: number;
}
export interface CatRuntime extends FaunaPose {
  state: CatState;
  point: number;
  restLeftS: number;
  restDurationS: number;
  moving: boolean;
  ageS: number;
  previousAgeS: number;
  fleeCooldownS: number;
  groomLeftS: number;
  meowCooldownS: number;
  detour: Vec3;
  anchor: Vec3;
}
export interface RatRuntime extends FaunaPose {
  active: boolean;
  lane: number;
  progressM: number;
  speedMS: number;
  ageS: number;
}

const pose = (x: number, y: number, z: number): FaunaPose => ({
  position: { x, y, z },
  previous: { x, y, z },
  yaw: 0,
  previousYaw: 0,
  distance: 0,
  previousDistance: 0,
});
function remember(p: FaunaPose): void {
  Object.assign(p.previous, p.position);
  p.previousYaw = p.yaw;
  p.previousDistance = p.distance;
}

/** Kosmetyczna symulacja 60 Hz. Wszystkie obiekty ruchu i pula powstają w konstruktorze. */
export class HubFaunaRuntime {
  readonly cat: CatRuntime | null;
  readonly rats: RatRuntime[];
  readonly ground: FaunaGround;
  ratWaitS: number;
  /** Pozostały czas głaskania (s) i jego wartość z poprzedniego kroku (interpolacja widoku). */
  petLeftS = 0;
  previousPetLeftS = 0;

  constructor(
    private readonly layout: HubLayout,
    private readonly rng: Rng,
    private readonly t: Tuning['hub'],
    private readonly bus?: EventBus,
  ) {
    const start = layout.fauna?.cat?.route[0];
    this.cat = start
      ? {
          ...pose(start.x, layout.playerSpawn.y, start.z),
          state: 'sit',
          point: 0,
          restLeftS: 0,
          restDurationS: 0,
          moving: false,
          ageS: 0,
          previousAgeS: 0,
          fleeCooldownS: 0,
          groomLeftS: 0,
          meowCooldownS: t.catMeowCooldownS,
          detour: { x: 0, y: layout.playerSpawn.y, z: 0 },
          anchor: { x: start.x, y: layout.playerSpawn.y, z: start.z },
        }
      : null;
    this.ground = new FaunaGround(layout, t, layout.playerSpawn.y);
    this.rats = Array.from(
      { length: Math.min(2, Math.max(0, Math.floor(t.ratMaxActive))) },
      () => ({
        ...pose(0, 0, 0),
        active: false,
        lane: 0,
        progressM: 0,
        speedMS: 0,
        ageS: 0,
      }),
    );
    this.ratWaitS = this.nextRatInterval();
    if (this.cat) this.rest();
  }

  private nextRatInterval(): number {
    const range = this.layout.fauna?.rats?.intervalS;
    return range ? this.rng.float(range[0], range[1]) : Infinity;
  }

  private nextGroomInterval(): number {
    return this.rng.float(
      this.t.catGroomIntervalMinS,
      this.t.catGroomIntervalMaxS,
    );
  }

  private rest(): void {
    const c = this.cat!,
      def = this.layout.fauna!.cat!;
    c.restDurationS = c.restLeftS = this.rng.float(def.restS[0], def.restS[1]);
    c.state = this.rng.chance(this.t.catGroomChance)
      ? 'groom'
      : this.rng.chance(this.t.catLieChance)
        ? 'lie'
        : 'sit';
    c.groomLeftS = this.nextGroomInterval();
    c.moving = false;
    if (c.meowCooldownS <= 0 && this.rng.chance(this.t.catMeowChance)) {
      this.sound('meow', c.position);
      c.meowCooldownS = this.t.catMeowCooldownS;
    }
  }

  private sound(kind: 'meow' | 'rat', point: Vec3): void {
    this.bus?.emit('hub_fauna_sound', { kind, point: { ...point } });
  }

  step(dt: number, player: Vec3, velocity: Vec3): void {
    this.previousPetLeftS = this.petLeftS;
    this.petLeftS = Math.max(0, this.petLeftS - dt);
    if (!(dt > 0)) return;
    if (this.cat) this.stepCat(dt, player, velocity);
    for (const r of this.rats) {
      remember(r);
      if (!r.active) continue;
      const lane = this.layout.fauna!.rats!.lanes[r.lane]!;
      r.ageS += dt;
      const length = Math.hypot(
        lane.to.x - lane.from.x,
        lane.to.z - lane.from.z,
      );
      const speed = Math.max(
        this.t.ratSpeedMinMS,
        Math.min(
          this.t.ratSpeedMaxMS,
          r.speedMS *
            (1 +
              this.t.ratBurstFraction * Math.sin(r.ageS * this.t.ratBurstHz)),
        ),
      );
      r.progressM = Math.min(length, r.progressM + speed * dt);
      r.distance = r.progressM;
      const f = r.progressM / length;
      r.position.x = lane.from.x + (lane.to.x - lane.from.x) * f;
      r.position.z = lane.from.z + (lane.to.z - lane.from.z) * f;
      if (r.progressM >= length) r.active = false;
    }
    this.ratWaitS -= dt;
    if (this.ratWaitS <= 0) {
      this.ratWaitS = this.spawnRat(player, false)
        ? this.nextRatInterval()
        : this.t.ratRetryS;
    }
  }

  private stepCat(dt: number, player: Vec3, velocity: Vec3): void {
    const c = this.cat!,
      t = this.t,
      route = this.layout.fauna!.cat!.route;
    remember(c);
    c.previousAgeS = c.ageS;
    c.ageS += dt;
    c.moving = false;
    c.fleeCooldownS = Math.max(0, c.fleeCooldownS - dt);
    c.meowCooldownS = Math.max(0, c.meowCooldownS - dt);
    const px = c.position.x - player.x,
      pz = c.position.z - player.z;
    const d = Math.hypot(px, pz),
      speed = Math.hypot(velocity.x, velocity.z);
    if (
      c.state !== 'flee' &&
      c.state !== 'return' &&
      c.fleeCooldownS <= 0 &&
      d < t.catFleeM &&
      Math.abs(player.y - c.position.y) <= t.catFleeM &&
      speed >= t.catRunThresholdMS &&
      d > 0 &&
      (px * velocity.x + pz * velocity.z) / (d * speed) >= t.catApproachConeCos
    ) {
      const first = this.rng.chance(0.5) ? 1 : -1;
      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? first : -first;
        const x = c.position.x - (velocity.z / speed) * t.catFleeSideM * sign;
        const z = c.position.z + (velocity.x / speed) * t.catFleeSideM * sign;
        if (!this.ground.segment(c.position.x, c.position.z, x, z)) continue;
        Object.assign(c.anchor, c.position);
        c.detour.x = x;
        c.detour.z = z;
        c.state = 'flee';
        c.restLeftS = 0;
        c.fleeCooldownS = t.catFleeCooldownS;
        break;
      }
    }
    if (c.restLeftS > 0) {
      c.restLeftS = Math.max(0, c.restLeftS - dt);
      if (c.restLeftS === 0) c.state = 'walk';
      return;
    }
    if (c.state === 'walk') {
      c.groomLeftS -= dt;
      if (c.groomLeftS <= 0) {
        c.groomLeftS = this.nextGroomInterval();
        if (this.rng.chance(t.catGroomChance)) {
          c.state = 'groom';
          c.restLeftS = this.rng.float(t.catGroomMinS, t.catGroomMaxS);
          return;
        }
      }
    }
    const next = (c.point + 1) % route.length;
    const target =
      c.state === 'flee'
        ? c.detour
        : c.state === 'return'
          ? c.anchor
          : route[next]!;
    const dx = target.x - c.position.x,
      dz = target.z - c.position.z,
      distance = Math.hypot(dx, dz);
    const toPlayerX = -px,
      toPlayerZ = -pz;
    if (
      c.state !== 'flee' &&
      d < t.catYieldM &&
      Math.abs(player.y - c.position.y) <= t.catFleeM &&
      (d === 0 ||
        distance === 0 ||
        (toPlayerX * dx + toPlayerZ * dz) / (d * distance) >= t.catYieldConeCos)
    )
      return;
    const travel = Math.min(
      distance,
      dt *
        (c.state === 'flee' || c.state === 'return'
          ? t.catFleeSpeedMS
          : (this.layout.fauna!.cat!.speedMS ?? t.catSpeedMS)),
    );
    if (distance > 0) {
      const x = c.position.x + (dx * travel) / distance,
        z = c.position.z + (dz * travel) / distance;
      if (!this.ground.segment(c.position.x, c.position.z, x, z)) return;
      c.position.x = x;
      c.position.z = z;
      c.distance += travel;
      c.yaw = Math.atan2(dx, dz);
      c.moving = travel > 0;
    }
    if (travel < distance) return;
    if (c.state === 'flee') c.state = 'return';
    else if (c.state === 'return') {
      c.state = 'walk';
      c.fleeCooldownS = t.catFleeCooldownS;
    } else {
      c.point = next;
      this.rest();
    }
  }

  /** Bryła celowania w kota, gdy można go pogłaskać: zasięg liczony poziomo (XZ) od oka gracza. */
  petFocus(eye: Vec3): HubFocusBox | null {
    const cat = this.cat;
    if (
      !cat ||
      cat.state === 'flee' ||
      cat.state === 'return' ||
      this.petLeftS > 0
    )
      return null;
    const { catHeightM, catRadiusM, catPetRangeM } = this.t;
    if (
      Math.hypot(cat.position.x - eye.x, cat.position.z - eye.z) > catPetRangeM
    )
      return null;
    return {
      position: { ...cat.position, y: cat.position.y + catHeightM / 2 },
      size: { x: catRadiusM * 2, y: catHeightM, z: catRadiusM * 2 },
    };
  }

  /** Głaskanie: kot kładzie się na czas gestu, nie ucieka i miauczy. */
  pet(): void {
    const cat = this.cat;
    if (!cat) return;
    const duration = this.t.catPetDurationS;
    this.previousPetLeftS = this.petLeftS = duration;
    cat.state = 'lie';
    cat.moving = false;
    cat.restLeftS = Math.max(cat.restLeftS, duration);
    cat.fleeCooldownS = Math.max(cat.fleeCooldownS, duration);
    cat.meowCooldownS = this.t.catMeowCooldownS;
    this.sound('meow', cat.position);
  }

  /** Debug zachowuje bezpieczny odcinek powrotny do bieżącej trasy. */
  placeCat(player: Vec3, yaw: number): boolean {
    return this.placeCatAt(
      player.x - Math.sin(yaw) * this.t.catDebugDistanceM,
      player.z - Math.cos(yaw) * this.t.catDebugDistanceM,
    );
  }

  /** Jak `placeCat`, ale w podanym punkcie; `minRestS` wydłuża odpoczynek (debug spotkań). */
  placeCatAt(x: number, z: number, minRestS = 0): boolean {
    const c = this.cat;
    if (!c) return false;
    if (!this.ground.safe(x, z)) return false;
    const route = this.layout.fauna!.cat!.route;
    let best = -1,
      distance = Infinity;
    for (let i = 0; i < route.length; i++) {
      const p = route[i]!,
        d = Math.hypot(x - p.x, z - p.z);
      if (d < distance && this.ground.segment(x, z, p.x, p.z)) {
        best = i;
        distance = d;
      }
    }
    if (best < 0) return false;
    c.position.x = x;
    c.position.z = z;
    c.point = (best - 1 + route.length) % route.length;
    c.fleeCooldownS = this.t.catFleeCooldownS;
    this.rest();
    if (minRestS > 0) c.restLeftS = Math.max(c.restLeftS, minRestS);
    remember(c);
    return true;
  }

  forceRat(player: Vec3): boolean {
    return this.spawnRat(player, true);
  }

  private spawnRat(player: Vec3, nearest: boolean): boolean {
    const lanes = this.layout.fauna?.rats?.lanes;
    if (!lanes) return false;
    const r = this.rats.find((r) => !r.active);
    if (!r) return false;
    const start = nearest ? 0 : this.rng.int(0, lanes.length - 1);
    let selected = -1,
      distance = Infinity;
    for (let j = 0; j < lanes.length; j++) {
      const i = (start + j) % lanes.length,
        lane = lanes[i]!;
      const d = Math.hypot(
        player.x - lane.from.x,
        player.y - lane.from.y,
        player.z - lane.from.z,
      );
      if (d < this.t.ratStartClearanceM) continue;
      if (!nearest) {
        selected = i;
        break;
      }
      const dx = lane.to.x - lane.from.x,
        dz = lane.to.z - lane.from.z;
      const f = Math.max(
        0,
        Math.min(
          1,
          ((player.x - lane.from.x) * dx + (player.z - lane.from.z) * dz) /
            (dx * dx + dz * dz),
        ),
      );
      const laneDistance = Math.hypot(
        player.x - lane.from.x - dx * f,
        player.z - lane.from.z - dz * f,
      );
      if (laneDistance < distance) {
        distance = laneDistance;
        selected = i;
      }
    }
    if (selected < 0) return false;
    const lane = lanes[selected]!;
    r.active = true;
    r.lane = selected;
    r.progressM = r.ageS = r.distance = 0;
    r.speedMS = this.rng.float(this.t.ratSpeedMinMS, this.t.ratSpeedMaxMS);
    Object.assign(r.position, lane.from);
    r.yaw = Math.atan2(lane.to.x - lane.from.x, lane.to.z - lane.from.z);
    remember(r);
    this.sound('rat', r.position);
    return true;
  }

  query(): {
    cat: { x: number; z: number; state: CatState } | null;
    rats: number;
  } {
    return {
      cat: this.cat
        ? {
            x: this.cat.position.x,
            z: this.cat.position.z,
            state: this.cat.state,
          }
        : null,
      rats: this.rats.reduce((n, r) => n + Number(r.active), 0),
    };
  }
}
