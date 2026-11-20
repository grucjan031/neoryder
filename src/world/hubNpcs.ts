import { z } from 'zod';
import type { Vec3 } from '../core/math';
import { Rng } from '../core/rng';
import type { Tuning } from '../core/tuning';
import type { HubNpcDef, NpcRoute, NpcAnimation } from './hubSchema';
import type { HubFocusBox } from './hubStations';

const missionIdSchema = z.string().regex(/^[a-z0-9_-]+$/);

export const npcConversationSchema = z
  .object({
    id: z.string().min(1),
    npcs: z.array(z.string().min(1)).min(1).max(3),
    radiusM: z.number().finite().positive().optional(),
    /** Rozmowa pojawia się po ukończeniu `after` i znika po ukończeniu `until` (id misji). */
    after: missionIdSchema.optional(),
    until: missionIdSchema.optional(),
    lines: z
      .array(z.object({ npc: z.string().min(1), text: z.string().min(1) }))
      .min(1),
  })
  .superRefine((conversation, ctx) => {
    if (new Set(conversation.npcs).size !== conversation.npcs.length)
      ctx.addIssue({
        code: 'custom',
        path: ['npcs'],
        message: 'Uczestnicy rozmowy muszą być różni.',
      });
    conversation.lines.forEach((line, index) => {
      if (!conversation.npcs.includes(line.npc))
        ctx.addIssue({
          code: 'custom',
          path: ['lines', index, 'npc'],
          message: 'Mówiący NPC musi należeć do uczestników rozmowy.',
        });
    });
  });
export type NpcConversation = z.infer<typeof npcConversationSchema>;

const reactionLinesSchema = z
  .array(
    z
      .string()
      .min(1)
      .refine((text) => text.trim().length > 0),
  )
  .min(1);

/** Teksty rozmów (`src/data/hub/npcs.pl.json`). */
export const npcTextsSchema = z.object({
  talkPrompt: z.string().min(1),
  conversations: z.array(npcConversationSchema).optional(),
  npcs: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      role: z.string().min(1),
      lines: z.array(z.string().min(1)).min(1),
      reactions: z
        .object({
          firstVisit: reactionLinesSchema.optional(),
          victory: reactionLinesSchema.optional(),
          death: reactionLinesSchema.optional(),
          /** Zamiast `victory` przy powrocie z tej misji (klucz: id misji). */
          afterMission: z
            .record(missionIdSchema, reactionLinesSchema)
            .optional(),
        })
        .optional(),
      /** Stałe kwestie dołączane do puli rozmowy po ukończeniu misji `after`. */
      campaignLines: z
        .array(z.object({ after: missionIdSchema, lines: reactionLinesSchema }))
        .optional(),
    }),
  ),
});
export type NpcTexts = z.infer<typeof npcTextsSchema>;
export type NpcText = NpcTexts['npcs'][number];

export function loadNpcTexts(
  data: unknown,
  npcs?: readonly HubNpcDef[],
): NpcTexts {
  const texts = npcTextsSchema.parse(data);
  const ids = new Set<string>();
  for (const conversation of texts.conversations ?? []) {
    if (ids.has(conversation.id))
      throw new Error(`Powtórzona rozmowa: ${conversation.id}.`);
    ids.add(conversation.id);
    for (const id of conversation.npcs)
      if (npcs && !npcs.some((npc) => npc.id === id))
        throw new Error(`Nieznany NPC w rozmowie ${conversation.id}: ${id}.`);
  }
  return texts;
}

/** Wymiary kolidera NPC (cylinder pionowy) i bryły `focus` do wyboru promieniem. */
export const NPC_RADIUS_M = 0.4;
export const NPC_STANDING_HEIGHT_M = 1.8;
export const NPC_SEATED_HEIGHT_M = 1.35;

export const isSeated = (npc: Pick<HubNpcDef, 'animation'>): boolean =>
  npc.animation?.startsWith('Sitting') ?? false;

/** Kotwiczy miednicę nad siedziskiem również podczas obrotu tułowia. Offset w osiach modelu. */
export function npcRootPosition(
  npc: HubNpcDef,
  yaw = (npc.rotationDeg * Math.PI) / 180,
  position: Vec3 = { ...npc.position, y: npc.position.y ?? 0 },
  out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
  const base = position;
  out.x = base.x;
  out.y = base.y;
  out.z = base.z;
  if (!isSeated(npc) || !npc.seat) return out;
  const { heightM, offset } = npc.seat;
  const scale = npc.scale ?? 1;
  out.x += (Math.cos(yaw) * offset.x + Math.sin(yaw) * offset.z) * scale;
  out.y += heightM + offset.y * scale;
  out.z += (-Math.sin(yaw) * offset.x + Math.cos(yaw) * offset.z) * scale;
  return out;
}

export function npcHeight(npc: Pick<HubNpcDef, 'animation' | 'scale'>): number {
  return (
    (isSeated(npc) ? NPC_SEATED_HEIGHT_M : NPC_STANDING_HEIGHT_M) *
    (npc.scale ?? 1)
  );
}
export function npcRadius(npc: Pick<HubNpcDef, 'scale'>): number {
  return NPC_RADIUS_M * (npc.scale ?? 1);
}

/** Bryła `focus` NPC wyliczona z kolidera: pion od podłogi do czubka głowy. */
export function npcFocusBox(
  npc: HubNpcDef,
  position = npc.position,
): HubFocusBox {
  const height = npcHeight(npc);
  const base = position.y ?? 0;
  return {
    position: { x: position.x, y: base + height / 2, z: position.z },
    size: { x: npcRadius(npc) * 2, y: height, z: npcRadius(npc) * 2 },
  };
}

export interface NpcLine {
  id: string;
  name: string;
  role: string;
  line: string;
}

/** Kolejność kwestii: każdy NPC ma własny licznik; kolejne `talk` daje kolejne kwestie w pętli. */
export class NpcDialogue {
  private readonly cursor = new Map<string, number>();

  constructor(private readonly texts: readonly NpcText[]) {}

  has(id: string): boolean {
    return this.texts.some((npc) => npc.id === id);
  }

  talk(id: string): NpcLine | null {
    const npc = this.texts.find((entry) => entry.id === id);
    if (!npc) return null;
    const index = this.cursor.get(id) ?? 0;
    this.cursor.set(id, (index + 1) % npc.lines.length);
    return {
      id,
      name: npc.name,
      role: npc.role,
      line: npc.lines[index]!,
    };
  }
}

export interface NpcLookParams {
  /** Zasięg, w którym NPC zwraca się do gracza (m). */
  rangeM: number;
  /** Prędkość obrotu tułowia (rad/s). */
  turnSpeedRadS: number;
  /** Maksymalne odchylenie głowy względem tułowia (rad). */
  headMaxRad: number;
  /** Maksymalne odchylenie tułowia od kierunku bazowego (rad). */
  bodyMaxRad: number;
}

export interface NpcLookState {
  bodyYaw: number;
  headYaw: number;
}

const TAU = Math.PI * 2;
export const wrapAngle = (angle: number): number =>
  angle - TAU * Math.round(angle / TAU);

/**
 * Obrót NPC do gracza: głowa podąża szybciej (w zakresie `headMaxRad`), tułów powoli i tylko
 * tyle, ile trzeba, by głowa wróciła w zakres; poza zasięgiem wszystko wraca do pozy bazowej.
 * Kąty to yaw kierunku patrzenia (0 = +Z, patrz `hubNpcSchema`).
 */
export function updateNpcLook(
  state: NpcLookState,
  baseYaw: number,
  npc: Vec3,
  /** Cel spojrzenia: domyślnie gracz, w rozmowach podsłuchanych mówiący uczestnik. */
  player: Vec3,
  dt: number,
  params: NpcLookParams,
): NpcLookState {
  const dx = player.x - npc.x;
  const dz = player.z - npc.z;
  const near = Math.hypot(dx, dz) <= params.rangeM;
  const targetYaw = near ? Math.atan2(dx, dz) : baseYaw;
  const step = params.turnSpeedRadS * dt;
  const toward = (from: number, to: number, limit: number): number => {
    const delta = wrapAngle(to - from);
    return from + Math.max(-limit, Math.min(limit, delta));
  };
  // Tułów: cel w obrębie zakresu wokół bazy.
  const bodyGoal =
    baseYaw +
    Math.max(
      -params.bodyMaxRad,
      Math.min(params.bodyMaxRad, wrapAngle(targetYaw - baseYaw)),
    );
  const bodyYaw = toward(state.bodyYaw, bodyGoal, step);
  const headGoal = Math.max(
    -params.headMaxRad,
    Math.min(params.headMaxRad, wrapAngle(targetYaw - bodyYaw)),
  );
  const headYaw =
    state.headYaw +
    Math.max(-step * 2.5, Math.min(step * 2.5, headGoal - state.headYaw));
  return { bodyYaw, headYaw };
}

export interface NpcRouteState {
  position: Vec3;
  segment: number;
  direction: 1 | -1;
  pauseLeft: number;
  yaw: number;
  moving: boolean;
}
export function createNpcRouteState(npc: HubNpcDef): NpcRouteState {
  return {
    position: { ...npc.position, y: npc.position.y ?? 0 },
    segment: 0,
    direction: 1,
    pauseLeft: npc.route?.pauseS ?? 0,
    yaw: (npc.rotationDeg * Math.PI) / 180,
    moving: false,
  };
}
/** Gracz dalej za NPC niż tyle (m) wzdłuż kierunku ruchu nie blokuje trasy. */
const NPC_CONTACT_BEHIND_M = 0.2;

export interface NpcRouteContext {
  player: Vec3;
  talking: boolean;
  tuning: Tuning['hub'];
  /** Suma promieni kolidera NPC i kapsuły gracza (bez zapasu); brak = bez strefy kontaktu. */
  contactRadiusM?: number;
}

function arriveAtRoutePoint(
  state: NpcRouteState,
  route: NpcRoute,
  next: number,
): void {
  state.segment = next;
  if (
    route.mode === 'pingpong' &&
    (next === 0 || next === route.points.length - 1)
  )
    state.direction = state.direction === 1 ? -1 : 1;
  state.pauseLeft = route.pauseS ?? 0;
  if (state.pauseLeft > 0) state.moving = false;
}

/** Mutuje serializowalny stan; żadnych obiektów renderu, zegara ani losowości. */
export function stepNpcRoute(
  state: NpcRouteState,
  route: NpcRoute,
  dt: number,
  ctx: NpcRouteContext,
): void {
  state.moving = false;
  if (!(dt > 0) || ctx.talking) return;
  let left = dt;
  let emptySegments = 0;
  while (left > 0) {
    if (state.pauseLeft > 0) {
      const wait = Math.min(left, state.pauseLeft);
      state.pauseLeft -= wait;
      left -= wait;
      emptySegments = 0;
      if (left <= 0) return;
    }
    const next =
      (state.segment + state.direction + route.points.length) %
      route.points.length;
    const target = route.points[next]!;
    const dx = target.x - state.position.x,
      dz = target.z - state.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= Number.EPSILON) {
      arriveAtRoutePoint(state, route, next);
      if (++emptySegments >= route.points.length * 2) return;
      continue;
    }
    emptySegments = 0;
    const px = ctx.player.x - state.position.x,
      pz = ctx.player.z - state.position.z;
    const playerDistance = Math.hypot(px, pz);
    if (
      playerDistance < ctx.tuning.npcYieldRadiusM &&
      (playerDistance === 0 ||
        (px * dx + pz * dz) / (playerDistance * distance) >=
          ctx.tuning.npcYieldConeCos)
    )
      return;
    const speed = route.speedMS ?? ctx.tuning.npcWalkSpeedMS;
    if (!(speed > 0)) return;
    if (ctx.contactRadiusM !== undefined) {
      const reach = Math.min(speed * left, distance) / distance;
      const along = (px * dx + pz * dz) / distance;
      if (
        along >= -NPC_CONTACT_BEHIND_M &&
        Math.hypot(px - dx * reach, pz - dz * reach) <
          ctx.contactRadiusM + ctx.tuning.npcContactMarginM
      )
        return;
    }
    const travelS = Math.min(left, distance / speed);
    const amount = Math.min(1, (travelS * speed) / distance);
    state.position.x += dx * amount;
    state.position.z += dz * amount;
    const turn = ctx.tuning.npcWalkTurnRadS * travelS;
    const delta = wrapAngle(Math.atan2(dx, dz) - state.yaw);
    state.yaw += Math.max(-turn, Math.min(turn, delta));
    state.moving = true;
    left -= travelS;
    if (amount < 1) return;
    state.position.x = target.x;
    state.position.z = target.z;
    arriveAtRoutePoint(state, route, next);
  }
}

/** Pule wstawek animacji wg animacji bazowej; bazowe spoza mapy nie mają wstawek. */
export const NPC_IDLE_VARIETY: Readonly<
  Partial<Record<NpcAnimation, readonly NpcAnimation[]>>
> = {
  Idle_Loop: ['Idle_Talking_Loop', 'Interact', 'PickUp_Table'],
  Idle_Talking_Loop: ['Idle_Loop', 'Interact'],
  Sitting_Idle_Loop: ['Sitting_Talking_Loop'],
  Sitting_Talking_Loop: ['Sitting_Idle_Loop'],
};

/** Wspólny stan symulacji dla kolidera, fokusowania, rozmów i widoku. */
export class NpcRuntime {
  readonly route: NpcRouteState;
  readonly position: Vec3;
  readonly previousPosition: Vec3;
  readonly focus: HubFocusBox;
  look: NpcLookState;
  previousBodyYaw: number;
  previousHeadYaw = 0;
  readonly baseYaw: number;
  /** Bieżąca wstawka animacji (null = bazowa) i czas do jej końca lub do następnej. */
  idleClip: NpcAnimation | null = null;
  idleLeftS: number;
  /** Zewnętrzne sterowanie (spotkanie z kotem): trasa i patrzenie wstrzymane, pozycję i yaw ustawia sterujący. */
  controlled = false;
  /** Wymuszona poza animacji w czasie sterowania (null = bazowa). */
  pose: NpcAnimation | null = null;
  private readonly idleRng: Rng;
  constructor(
    readonly def: HubNpcDef,
    private readonly tuning: Tuning['hub'],
    rng: Rng = new Rng(def.id),
  ) {
    this.idleRng = rng;
    this.idleLeftS = this.idleRng.float(0, this.tuning.npcIdleVarietyS[1] ?? 0);
    this.route = createNpcRouteState(def);
    this.position = this.route.position;
    this.previousPosition = { ...this.position };
    this.baseYaw = this.route.yaw;
    this.look = { bodyYaw: this.baseYaw, headYaw: 0 };
    this.previousBodyYaw = this.baseYaw;
    this.focus = npcFocusBox(def, this.position);
  }
  step(
    dt: number,
    player: Vec3,
    talking: boolean,
    playerRadiusM?: number,
    speaking = false,
    lookAt?: Vec3 | null,
  ): void {
    this.stepIdleVariety(dt, talking || speaking);
    Object.assign(this.previousPosition, this.position);
    this.previousBodyYaw = this.look.bodyYaw;
    this.previousHeadYaw = this.look.headYaw;
    const t = this.tuning;
    if (this.controlled) {
      this.look.bodyYaw = this.route.yaw;
      this.look.headYaw = 0;
    } else if (this.def.route) {
      stepNpcRoute(this.route, this.def.route, dt, {
        player,
        talking,
        tuning: t,
        contactRadiusM:
          playerRadiusM === undefined
            ? undefined
            : npcRadius(this.def) + playerRadiusM,
      });
      if (!talking) {
        this.look.bodyYaw = this.route.yaw;
        this.look.headYaw = 0;
      }
    }
    if (!this.controlled && (!this.def.route || talking)) {
      this.look = updateNpcLook(
        this.look,
        this.def.route ? this.route.yaw : this.baseYaw,
        this.position,
        lookAt ?? player,
        dt,
        {
          rangeM:
            lookAt || (this.def.route && talking) ? Infinity : t.npcTurnRangeM,
          turnSpeedRadS: t.npcTurnSpeedRadS,
          headMaxRad: t.npcHeadMaxRad,
          bodyMaxRad: this.def.route
            ? Math.PI
            : isSeated(this.def)
              ? t.npcSeatedBodyMaxRad
              : t.npcStandBodyMaxRad,
        },
      );
      if (this.def.route) this.route.yaw = this.look.bodyYaw;
    }
    this.focus.position.x = this.position.x;
    this.focus.position.z = this.position.z;
  }
  private stepIdleVariety(dt: number, busy: boolean): void {
    if (this.def.route || !(dt > 0)) return;
    const pool = NPC_IDLE_VARIETY[this.def.animation ?? 'Idle_Loop'];
    if (!pool) return;
    if (busy) {
      this.idleClip = null;
      return;
    }
    this.idleLeftS -= dt;
    if (this.idleLeftS > 0) return;
    const t = this.tuning;
    if (this.idleClip) {
      this.idleClip = null;
      this.idleLeftS = this.idleRng.float(
        t.npcIdleVarietyS[0] ?? 0,
        t.npcIdleVarietyS[1] ?? 0,
      );
    } else {
      this.idleClip = this.idleRng.pick(pool);
      this.idleLeftS = this.idleRng.float(
        t.npcIdleVarietyLenS[0] ?? 0,
        t.npcIdleVarietyLenS[1] ?? 0,
      );
    }
  }

  animation(speaking: boolean): NpcAnimation {
    const base = this.def.route
      ? this.route.moving
        ? (this.def.route.moveAnimation ?? 'Walk_Loop')
        : (this.def.route.pauseAnimation ?? this.def.animation ?? 'Idle_Loop')
      : (this.def.animation ?? 'Idle_Loop');
    if (this.controlled && this.pose) return this.pose;
    if (!speaking) return this.idleClip ?? base;
    return base === 'Idle_Loop'
      ? 'Idle_Talking_Loop'
      : base === 'Sitting_Idle_Loop'
        ? 'Sitting_Talking_Loop'
        : base;
  }
}
