import { z } from 'zod';
import type { Vec3 } from '../core/math';
import type { HubNpcDef } from './hubSchema';
import type { HubFocusBox } from './hubStations';

/** Teksty rozmów (`src/data/hub/npcs.pl.json`). */
export const npcTextsSchema = z.object({
  talkPrompt: z.string().min(1),
  npcs: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      role: z.string().min(1),
      lines: z.array(z.string().min(1)).min(1),
    }),
  ),
});
export type NpcTexts = z.infer<typeof npcTextsSchema>;
export type NpcText = NpcTexts['npcs'][number];

export function loadNpcTexts(data: unknown): NpcTexts {
  return npcTextsSchema.parse(data);
}

/** Wymiary kolidera NPC (cylinder pionowy) i bryły `focus` do wyboru promieniem. */
export const NPC_RADIUS_M = 0.4;
export const NPC_STANDING_HEIGHT_M = 1.8;
export const NPC_SEATED_HEIGHT_M = 1.35;

export const isSeated = (npc: Pick<HubNpcDef, 'animation'>): boolean =>
  npc.animation?.startsWith('Sitting') ?? false;

export function npcHeight(npc: Pick<HubNpcDef, 'animation'>): number {
  return isSeated(npc) ? NPC_SEATED_HEIGHT_M : NPC_STANDING_HEIGHT_M;
}

/** Bryła `focus` NPC wyliczona z kolidera: pion od podłogi do czubka głowy. */
export function npcFocusBox(npc: HubNpcDef): HubFocusBox {
  const height = npcHeight(npc);
  const base = npc.position.y ?? 0;
  return {
    position: { x: npc.position.x, y: base + height / 2, z: npc.position.z },
    size: { x: NPC_RADIUS_M * 2, y: height, z: NPC_RADIUS_M * 2 },
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
