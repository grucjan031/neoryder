import type { Vec3 } from './math';
import type { StatusApplication } from '../combat/damage/types';

export type EntityId = number;

export type Team = 'player' | 'enemy' | 'neutral';

/** Mapa wszystkich zdarzeń gry. Nowe zdarzenia dopisuje Architekt po zatwierdzeniu w docs/api.md. */
export interface GameEvents {
  // F0
  run_started: { seed: string };
  scene_loaded: { sceneId: string };
  entity_spawned: { id: EntityId; kind: string };
  entity_despawned: { id: EntityId };
  damage_dealt: {
    source: EntityId | null;
    target: EntityId;
    amount: number;
    tags: readonly string[];
    point: Vec3 | null;
    dir: Vec3 | null;
    /** Impuls odrzutu (N·s) z DamageInfo.knockback; 0, gdy brak. */
    knockback: number;
    killed: boolean;
    statuses?: readonly StatusApplication[];
  };
  enemy_killed: {
    id: EntityId;
    killer: EntityId | null;
    tags: readonly string[];
  };
  parry_success: { projectile: EntityId; attacker: EntityId | null };
  power_used: { power: string; user: EntityId };
  hitstop: { ms: number };

  // F1 — zdrowie (#01)
  health_changed: { id: EntityId; current: number; max: number };
  player_died: { id: EntityId };
  // F1 — ruch (#02, #04)
  player_jumped: { id: EntityId; double: boolean };
  player_landed: { id: EntityId; speed: number };
  dash_used: { user: EntityId; dir: Vec3 };
  slide_started: { user: EntityId };
  slide_ended: { user: EntityId };
  // F1 — kamera i czas (#03, #13)
  camera_shake: { intensity: number; durationS: number; dir: Vec3 | null };
  slowmo: { timeScale: number; durationS: number };
  // F1 — bronie i pociski (#06)
  weapon_fired: { weapon: string; owner: EntityId };
  heat_changed: {
    id: EntityId;
    current: number;
    max: number;
    overheated: boolean;
  };
  projectile_spawned: { id: EntityId; owner: EntityId; team: Team };
  projectile_reflected: { id: EntityId; newOwner: EntityId };
  // F1 — wręcz (#07)
  melee_swing: { attacker: EntityId; stage: 1 | 2 | 3 | 'heavy' };
  melee_blocked: {
    defender: EntityId;
    attacker: EntityId | null;
    amount: number;
  };
  // F1 — moce (#11)
  energy_changed: { id: EntityId; current: number; max: number };
  power_denied: {
    power: string;
    user: EntityId;
    reason: 'no_energy' | 'cooldown';
  };
  // F1 — wrogowie (#08)
  enemy_telegraph: { id: EntityId; kind: string; durationS: number };
  enemy_stunned: { id: EntityId; durationS: number };
  // F1 — arena (#16)
  wave_started: { wave: number; count: number };
  wave_cleared: { wave: number };
  wave_last_kill: { wave: number; id: EntityId };
  // F2 — kontrakty (#01)
  status_applied: {
    target: EntityId;
    status: string;
    stacks: number;
    durationS: number;
    source: EntityId | null;
  };
  status_expired: { target: EntityId; status: string };
  focus: { worldScale: number; durationS: number };
  weapon_switched: { owner: EntityId; weapon: string; slot: number };
  blade_thrown: { owner: EntityId };
  blade_returned: { owner: EntityId };
  explosion: {
    point: Vec3;
    radiusM: number;
    owner: EntityId;
    tags: readonly string[];
  };
  synergy_triggered: { synergy: string; user: EntityId };
}

export type EventType = keyof GameEvents;
export type Handler<K extends EventType> = (payload: GameEvents[K]) => void;

interface Subscription {
  original: unknown;
  invoke(payload: unknown): void;
}

export class EventBus {
  private readonly handlers = new Map<EventType, Subscription[]>();

  on<K extends EventType>(type: K, h: Handler<K>): () => void {
    const entry: Subscription = {
      original: h,
      invoke: (payload) => h(payload as GameEvents[K]),
    };
    const list = this.handlers.get(type) ?? [];
    list.push(entry);
    this.handlers.set(type, list);
    return () => this.remove(type, entry);
  }

  once<K extends EventType>(type: K, h: Handler<K>): () => void {
    let active = true;
    const wrapped: Handler<K> = (payload) => {
      if (!active) return;
      active = false;
      unsubscribe();
      h(payload);
    };
    const unsubscribe = this.on(type, wrapped);
    const entry = this.handlers.get(type)?.at(-1);
    if (entry) entry.original = h;
    return unsubscribe;
  }

  off<K extends EventType>(type: K, h: Handler<K>): void {
    const list = this.handlers.get(type);
    if (list)
      this.handlers.set(
        type,
        list.filter((entry) => entry.original !== h),
      );
  }

  emit<K extends EventType>(type: K, payload: GameEvents[K]): void {
    for (const entry of [...(this.handlers.get(type) ?? [])]) {
      try {
        entry.invoke(payload);
      } catch (error) {
        console.error(error);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }

  private remove(type: EventType, entry: Subscription): void {
    const list = this.handlers.get(type);
    if (list)
      this.handlers.set(
        type,
        list.filter((item) => item !== entry),
      );
  }
}
