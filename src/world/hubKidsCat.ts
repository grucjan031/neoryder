import type { Tuning } from '../core/tuning';
import type { FaunaGround } from './hubFaunaGround';
import type { CatRuntime } from './hubFauna';
import { wrapAngle } from './hubNpcs';
import type { NpcRuntime } from './hubNpcs';

/** Dzieci kryjówki zatrzymujące się przy odpoczywającym kocie stacji. */
export const KIDS_CAT_IDS = ['ola', 'stas'] as const;
export const KIDS_CAT_CONVERSATION = 'ola_stas_cat';

type KidPhase = 'approach' | 'pet' | 'return' | 'hold';
interface Kid {
  npc: NpcRuntime;
  active: boolean;
  phase: KidPhase;
  originX: number;
  originZ: number;
  standX: number;
  standZ: number;
  petLeftS: number;
}

/**
 * Deterministyczne spotkanie dzieci z kotem. Nie losuje i nie dotyka DOM; przejmuje
 * `NpcRuntime.controlled` na czas spotkania i oddaje trasę po powrocie w punkt zejścia.
 * Wywoływać po `NpcRuntime.step`, żeby `previousPosition` zostało zapamiętane przed ruchem.
 */
export class KidsCatEncounter {
  private readonly kids: Kid[];
  private cooldownS = 0;
  private chatDone = false;
  active = false;

  constructor(
    npcs: readonly NpcRuntime[],
    private readonly cat: CatRuntime | null,
    private readonly ground: FaunaGround,
    private readonly t: Tuning['hub'],
  ) {
    this.kids = KIDS_CAT_IDS.flatMap((id) => {
      const npc = npcs.find((n) => n.def.id === id);
      return npc && npc.def.route
        ? [
            {
              npc,
              active: false,
              phase: 'approach' as KidPhase,
              originX: 0,
              originZ: 0,
              standX: 0,
              standZ: 0,
              petLeftS: 0,
            },
          ]
        : [];
    });
  }

  get cooldownLeft(): number {
    return this.cooldownS;
  }

  /** Dzieci przy kocie (głaszczą lub stoją), a rozmowa jeszcze nie padła w tym spotkaniu. */
  get chatPending(): boolean {
    return (
      this.active &&
      !this.chatDone &&
      this.kids.some(
        (k) => k.active && (k.phase === 'pet' || k.phase === 'hold'),
      )
    );
  }

  markChatted(): void {
    this.chatDone = true;
  }

  /** Debug: zdejmuje odnowienie; spotkanie ruszy w najbliższym kroku, jeśli warunki są spełnione. */
  force(): void {
    this.cooldownS = 0;
  }

  activeIds(): string[] {
    return this.kids.filter((k) => k.active).map((k) => k.npc.def.id);
  }

  query(): { active: boolean; kids: string[]; cooldownLeft: number } {
    return {
      active: this.active,
      kids: this.activeIds(),
      cooldownLeft: this.cooldownS,
    };
  }

  private resting(): boolean {
    const c = this.cat;
    return (
      c !== null &&
      (c.state === 'sit' || c.state === 'lie' || c.state === 'groom') &&
      c.restLeftS > 0
    );
  }

  step(dt: number, talkingId: string | null): void {
    if (!(dt > 0) || !this.cat) return;
    this.cooldownS = Math.max(0, this.cooldownS - dt);
    const resting = this.resting();
    if (!this.active) {
      if (this.cooldownS > 0 || !resting) return;
      this.tryStart(talkingId);
      if (!this.active) return;
    }
    let any = false;
    for (const kid of this.kids) {
      if (!kid.active) continue;
      if (kid.npc.def.id !== talkingId) this.stepKid(kid, dt, resting);
      any ||= kid.active;
    }
    if (!any) {
      this.active = false;
      this.chatDone = false;
      this.cooldownS = this.t.kidsCatCooldownS;
    }
  }

  private tryStart(talkingId: string | null): void {
    const cat = this.cat!;
    const range = this.t.kidsCatRangeM;
    const first = this.kids.find(
      (k) =>
        k.npc.def.id !== talkingId &&
        Math.hypot(
          k.npc.position.x - cat.position.x,
          k.npc.position.z - cat.position.z,
        ) <= range,
    );
    if (!first) return;
    let dx = first.npc.position.x - cat.position.x,
      dz = first.npc.position.z - cat.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-6) {
      dx /= d;
      dz /= d;
    } else {
      dx = 1;
      dz = 0;
    }
    const stand = this.t.kidsCatStandM;
    this.begin(first, cat.position.x + dx * stand, cat.position.z + dz * stand);
    this.chatDone = false;
    this.active = true;
    for (const kid of this.kids) {
      if (kid === first || kid.npc.def.id === talkingId) continue;
      const p = kid.npc.position;
      if (
        Math.hypot(p.x - cat.position.x, p.z - cat.position.z) >
        this.t.kidsCatJoinM
      )
        continue;
      this.begin(kid, cat.position.x - dx * stand, cat.position.z - dz * stand);
    }
  }

  private begin(kid: Kid, sx: number, sz: number): void {
    const p = kid.npc.position;
    kid.active = true;
    kid.originX = p.x;
    kid.originZ = p.z;
    kid.petLeftS = this.t.kidsCatPetS;
    kid.npc.controlled = true;
    kid.npc.pose = null;
    if (this.ground.segment(p.x, p.z, sx, sz)) {
      kid.phase = 'approach';
      kid.standX = sx;
      kid.standZ = sz;
    } else {
      kid.phase = 'hold';
      kid.standX = p.x;
      kid.standZ = p.z;
    }
    kid.npc.route.moving = false;
  }

  private release(kid: Kid): void {
    kid.active = false;
    kid.npc.controlled = false;
    kid.npc.pose = null;
    kid.npc.route.moving = false;
  }

  private turnTo(kid: Kid, dx: number, dz: number, dt: number): void {
    if (Math.abs(dx) + Math.abs(dz) < 1e-6) return;
    const route = kid.npc.route;
    const turn = this.t.npcWalkTurnRadS * dt;
    const delta = wrapAngle(Math.atan2(dx, dz) - route.yaw);
    route.yaw += Math.max(-turn, Math.min(turn, delta));
  }

  /** Zwraca true po dojściu do punktu. */
  private moveTo(kid: Kid, tx: number, tz: number, dt: number): boolean {
    const route = kid.npc.route;
    const p = route.position;
    const dx = tx - p.x,
      dz = tz - p.z;
    const dist = Math.hypot(dx, dz);
    const speed = kid.npc.def.route?.speedMS ?? this.t.npcWalkSpeedMS;
    if (dist <= Number.EPSILON || !(speed > 0)) {
      route.moving = false;
      return true;
    }
    const amount = Math.min(1, (speed * dt) / dist);
    p.x += dx * amount;
    p.z += dz * amount;
    this.turnTo(kid, dx, dz, dt);
    route.moving = true;
    if (amount < 1) return false;
    p.x = tx;
    p.z = tz;
    route.moving = false;
    return true;
  }

  private stepKid(kid: Kid, dt: number, resting: boolean): void {
    const cat = this.cat!;
    if (!resting && kid.phase !== 'return') {
      if (kid.phase === 'hold') {
        this.release(kid);
        return;
      }
      kid.phase = 'return';
      kid.npc.pose = null;
    }
    const p = kid.npc.route.position;
    switch (kid.phase) {
      case 'approach':
        if (this.moveTo(kid, kid.standX, kid.standZ, dt)) {
          kid.phase = 'pet';
          kid.npc.pose = 'Crouch_Idle_Loop';
        }
        break;
      case 'pet':
      case 'hold':
        this.turnTo(kid, cat.position.x - p.x, cat.position.z - p.z, dt);
        kid.petLeftS -= dt;
        if (kid.petLeftS > 0) break;
        if (kid.phase === 'hold') this.release(kid);
        else {
          kid.phase = 'return';
          kid.npc.pose = null;
        }
        break;
      case 'return':
        if (this.moveTo(kid, kid.originX, kid.originZ, dt)) this.release(kid);
        break;
    }
  }
}
