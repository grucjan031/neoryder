# API między modułami (kontrakty)

Zmiany w tym pliku zatwierdza Architekt. Kod w `src/core/` musi być z nim zgodny. Sygnatury podane w TypeScript.

## Pętla gry — `src/core/loop.ts`

```ts
export const SIM_DT = 1 / 60;          // s, stały krok symulacji
export const MAX_STEPS_PER_FRAME = 5;  // ochrona przed "spiralą śmierci"

export interface LoopCallbacks {
  /** Jeden krok symulacji. dt = SIM_DT * timeScale (0 przy hitstopie). */
  step(dt: number, tick: number): void;
  /** Rysowanie. alpha ∈ [0,1) — postęp między ostatnim a następnym krokiem. */
  render(alpha: number, frameDt: number): void;
}

export interface Clock { now(): number }            // ms; domyślnie performance.now
export interface FrameScheduler {                   // domyślnie requestAnimationFrame
  request(cb: (timeMs: number) => void): number;
  cancel(id: number): void;
}

export class GameLoop {
  constructor(cb: LoopCallbacks, opts?: { clock?: Clock; scheduler?: FrameScheduler });
  start(): void;
  stop(): void;
  /** Ręczne przesunięcie czasu (testy, headless). Zwraca liczbę wykonanych kroków. */
  advance(realMs: number): number;
  readonly tick: number;        // liczba wykonanych kroków symulacji
  paused: boolean;              // pauza: akumulator nie rośnie
  /** Mnożnik czasu symulacji (spowolnienie). 1 = normalnie. */
  timeScale: number;
  /** Zamrożenie symulacji na `ms` czasu rzeczywistego (hitstop). Kumuluje się jako max, nie suma. */
  hitstop(ms: number): void;
}
```

Zasady: krok zawsze ma długość `SIM_DT` w czasie rzeczywistym; `timeScale` i hitstop zmieniają tylko `dt` przekazywane do `step` (podczas hitstopu `step` jest nadal wołany z `dt = 0`, żeby wejście i UI działały, a fizyka jest pomijana, gdy `dt === 0`). Po przekroczeniu `MAX_STEPS_PER_FRAME` nadmiar akumulatora jest odrzucany.

## EventBus — `src/core/events.ts`

```ts
export type EntityId = number;

/** Mapa wszystkich zdarzeń gry. Nowe zdarzenia dopisuje się tutaj (po zatwierdzeniu w api.md). */
export interface GameEvents {
  run_started: { seed: string };
  scene_loaded: { sceneId: string };
  entity_spawned: { id: EntityId; kind: string };
  entity_despawned: { id: EntityId };
  damage_dealt: { source: EntityId | null; target: EntityId; amount: number; tags: readonly string[] };   // F1: rozszerzone o point/dir/killed — patrz „Kontrakty F1”
  enemy_killed: { id: EntityId; killer: EntityId | null; tags: readonly string[] };
  parry_success: { projectile: EntityId; attacker: EntityId | null };
  power_used: { power: string; user: EntityId };
  hitstop: { ms: number };
}

export type EventType = keyof GameEvents;
export type Handler<K extends EventType> = (payload: GameEvents[K]) => void;

export class EventBus {
  on<K extends EventType>(type: K, h: Handler<K>): () => void;   // zwraca unsubscribe
  once<K extends EventType>(type: K, h: Handler<K>): () => void;
  off<K extends EventType>(type: K, h: Handler<K>): void;
  emit<K extends EventType>(type: K, payload: GameEvents[K]): void;
  clear(): void;
}
```

Zasady: emisja synchroniczna, handlery w kolejności rejestracji; wyjątek w handlerze jest logowany (`console.error`) i nie przerywa pozostałych; odpięcie handlera w trakcie emisji jest bezpieczne (emisja iteruje po kopii). Brak globalnego singletonu w kodzie testowalnym — instancja jest przekazywana przez `GameContext`.

## Statystyki — `src/core/stats.ts`

```ts
export const STAT_IDS = [
  'maxHealth', 'moveSpeed', 'damage', 'attackSpeed',
  'maxEnergy', 'energyRegen', 'heatCapacity', 'coolingRate',
  'damageTaken', // F1: mnożnik otrzymywanych obrażeń, baza zawsze 1 (blok = mult 0.3)
  'dashCooldown', // F1: odnowienie dashu (s), baza z tuning.player.dashCooldownS
] as const;
export type StatId = (typeof STAT_IDS)[number];

export type ModifierType = 'flat' | 'percent' | 'mult';

export interface StatModifier {
  stat: StatId;
  type: ModifierType;
  /** flat: wartość dodawana; percent: ułamek (0.3 = +30%), sumowany; mult: mnożnik (1.5), mnożony. */
  value: number;
  /** Identyfikator źródła, np. 'implant:overclock', 'tree:blade:3'. Służy do zdejmowania. */
  source: string;
}

/** wartość = (base + Σflat) × (1 + Σpercent) × Πmult, wynik nie mniejszy niż 0. */
export function computeStat(base: number, mods: readonly StatModifier[]): number;

export class Stats {
  constructor(base: Partial<Record<StatId, number>>);
  get(stat: StatId): number;               // cache, przeliczany po zmianie
  getBase(stat: StatId): number;           // brak bazy = 0
  setBase(stat: StatId, value: number): void;
  add(mod: StatModifier): void;
  removeBySource(source: string): number;  // zwraca liczbę zdjętych
  modifiers(stat?: StatId): readonly StatModifier[];
}
```

Nowe `StatId` dodaje tylko Architekt (lista jest też źródłem dla `z.enum` w schematach danych).

## RNG — `src/core/rng.ts`

```ts
export function hashSeed(seed: string): number;   // 32-bit, deterministyczny (np. xmur3/cyrb53)

export class Rng {
  constructor(seed: string | number);
  next(): number;                          // [0, 1)
  float(min: number, max: number): number; // [min, max)
  int(min: number, max: number): number;   // [min, max] włącznie
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;         // rzuca błąd przy pustej tablicy
  shuffle<T>(items: T[]): T[];             // w miejscu, Fisher–Yates, zwraca tę samą tablicę
  /** Niezależny strumień pochodny, deterministyczny dla (seed, label). Nie zmienia stanu rodzica. */
  fork(label: string): Rng;
  getState(): number;
  setState(state: number): void;
}
```

Algorytm: mulberry32 (lub sfc32) — wybór udokumentowany w `docs/adr/0002-rng.md`. Ten sam seed daje ten sam ciąg na każdej platformie.

## Tuning — `src/core/tuning.ts`

```ts
export const tuning = {
  time:   { hitstopLightMs: 40, hitstopHeavyMs: 80, lastKillSlowmoS: 0.3, lastKillTimeScale: 0.2 },
  camera: { fov: 90, shakeMax: 0.4 },
  physics:{ gravity: -20, maxDynamicBodies: 300 },
  sandbox:{ cubeSpawnHeight: 6 },
};
export type Tuning = typeof tuning;
/** Buduje panel lil-gui ze wszystkich liczbowych pól (rekurencyjnie, folder na grupę). */
export function createTuningGui(t?: Tuning): import('lil-gui').GUI;
```

Obiekt jest mutowalny: kod czyta wartość przy użyciu (`tuning.time.hitstopLightMs`), nie kopiuje jej przy starcie, żeby zmiany z panelu działały na żywo. `createTuningGui` importuje lil-gui dynamicznie lub jest wołane tylko w trybie debug.

## Zapis — `src/core/save.ts`

```ts
export const SAVE_VERSION = 1;

export interface MetaSave { saveVersion: number; createdAt: number; updatedAt: number; /* rozwijane w F4 */ }
export interface RunSave  { saveVersion: number; seed: string; startedAt: number; /* rozwijane w F3 */ }

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
/** migrations[n] migruje z wersji n do n+1. */
export function migrate(data: Record<string, unknown>, migrations: readonly Migration[], target: number): Record<string, unknown>;

export interface SaveStore {
  loadMeta(): Promise<MetaSave | null>;
  saveMeta(data: MetaSave): Promise<void>;
  loadRun(): Promise<RunSave | null>;
  saveRun(data: RunSave): Promise<void>;
  clearRun(): Promise<void>;
}
export function createIndexedDbSaveStore(dbName?: string): SaveStore;   // domyślnie 'neoryder'
export function createMemorySaveStore(): SaveStore;                     // testy

export interface Settings { mouseSensitivity: number; fov: number; masterVolume: number }
export function loadSettings(storage?: Storage): Settings;              // localStorage, wartości domyślne przy braku/błędzie
export function saveSettings(s: Settings, storage?: Storage): void;
```

Wczytany zapis z `saveVersion < SAVE_VERSION` jest migrowany; z `saveVersion > SAVE_VERSION` — odrzucany z ostrzeżeniem (nie nadpisujemy zapisu z nowszej wersji gry).

## Wejście — `src/core/input/`

```ts
export type Action = 'moveForward' | 'moveBack' | 'moveLeft' | 'moveRight'
  | 'jump' | 'sprint' | 'dash' | 'crouch' | 'attack' | 'block' | 'shoot' | 'power';

export interface InputSnapshot {
  held: ReadonlySet<Action>;
  pressed: ReadonlySet<Action>;   // wciśnięte od poprzedniego kroku symulacji
  released: ReadonlySet<Action>;
  lookDelta: { x: number; y: number }; // piksele myszy od poprzedniego kroku
}

export class Input {
  constructor(target: HTMLElement);
  /** Wołane raz na krok symulacji; zwraca stan i zeruje pressed/released/lookDelta. */
  snapshot(): InputSnapshot;
  requestPointerLock(): void;
  readonly pointerLocked: boolean;
  onFocusLost(cb: () => void): () => void;   // utrata fokusu / pointer lock -> pauza
  dispose(): void;
}
```

Mapowanie klawiszy w danych (domyślnie WASD, Space, Shift, Q = dash, Ctrl = crouch, LPM = attack, PPM = block, R/F = shoot/power — do ustalenia w F1).

## Kontekst gry i sceny — `src/core/context.ts`, `src/scenes/`

```ts
export interface GameContext {
  bus: EventBus;
  rng: Rng;
  loop: GameLoop;
  tuning: Tuning;
  debug: boolean;
}

export interface Scene {
  readonly id: string;
  /** Ładowanie zasobów, budowa świata fizyki i obiektów Three.js. */
  init(ctx: GameContext, three: import('three').Scene): Promise<void> | void;
  step(dt: number, input: InputSnapshot): void;
  /** frameDt: czas rzeczywisty klatki w s (efekty kamery działające także w hitstopie). */
  render(alpha: number, frameDt?: number): void;
  query?(name: string): unknown;   // dane do testów i window.__neoryder
  reset?(): void;                  // komenda debug 'reset'
  dispose(): void;
}

export type SceneFactory = () => Scene;
export const scenes: Record<string, SceneFactory>;   // src/scenes/index.ts
```

## Debug — `window.__neoryder`

W trybie debug i w e2e gra wystawia uchwyt (tylko odczyt + komendy):

```ts
interface DebugHandle {
  tick(): number;                        // liczba kroków symulacji
  sceneId(): string;
  query(name: string): unknown;          // dane sceny do testów, np. 'cubeY'
  command(line: string): string;         // konsola debug, np. 'spawn cube', 'reset'
}
```

## Fizyka — `src/physics/`

```ts
export async function initPhysics(): Promise<typeof import('@dimforge/rapier3d-compat')>; // RAPIER.init() raz
export const CollisionGroup = { World: 1, Player: 2, Enemy: 4, PlayerProjectile: 8, EnemyProjectile: 16, Debris: 32 } as const;
export function interactionGroups(member: number, filter: number): number;  // (member << 16) | filter
```

## Kontrakty F1 (zatwierdzone, do implementacji w zadaniach F1)

Uzasadnienie decyzji: `docs/adr/0003-kontrakty-f1.md`. Zdarzenia dopisuje do `GameEvents` w `src/core/events.ts` zadanie, które je pierwsze emituje (zmiana w core przez Architekta).

### Nowe typy

```ts
// src/core/math.ts
export interface Vec3 { x: number; y: number; z: number }

// src/core/entities.ts
export type Team = 'player' | 'enemy' | 'neutral'; // zdefiniowany w events.ts, re-eksport z entities.ts
export class EntityRegistry {
  constructor(bus?: EventBus);
  setTeam(id: EntityId, team: Team): void;              // odbity pocisk
  unbindCollider(colliderHandle: number): void;
  create(kind: string, team: Team): EntityId;          // emituje entity_spawned
  destroy(id: EntityId): void;                         // emituje entity_despawned
  team(id: EntityId): Team | undefined;
  kind(id: EntityId): string | undefined;
  bindCollider(id: EntityId, colliderHandle: number): void;
  byCollider(colliderHandle: number): EntityId | undefined;
  alive(id: EntityId): boolean;
}

// src/core/resource.ts
export class ResourcePool {
  constructor(opts: { max: () => number; regenPerS: () => number; regenDelayS?: () => number; start?: number });
  readonly current: number;
  readonly max: number;
  readonly fraction: number;                           // current / max
  spend(n: number): boolean;                           // false i bez zmian, gdy brakuje
  add(n: number, opts?: { resetDelay?: boolean }): void;                                // obcina do [0, max] // resetDelay: traktuj jak użycie (nagrzanie broni)
  step(dt: number): void;                              // regeneracja po regenDelay od ostatniego spend
}
// Ciepło: ResourcePool, w którym "add" = nagrzewanie, a regeneracja jest ujemna (chłodzenie).
// Logika przegrzania (blokada 1,5 s, aktywne chłodzenie) należy do src/combat/weapons.

// src/combat/damage/ (właściciel: Architekt)
export interface DamageInfo {
  amount: number;
  source: EntityId | null;
  tags: readonly string[];        // '#melee' | '#gun' | '#power' | '#elektrycznosc' | '#heavy' | ...
  point?: Vec3;                   // punkt trafienia (świat)
  dir?: Vec3;                     // kierunek ciosu, znormalizowany
  knockback?: number;             // impuls w N·s, liczony z tuning, nie z kodu
}
export class Health {
  constructor(max: () => number);
  readonly current: number;
  readonly dead: boolean;
  /** Redukcje (blok −70% itp.) stosuje wołający przed apply. Zwraca faktycznie zadane obrażenia. */
  apply(info: DamageInfo): number;
  heal(n: number): void;
}
export class DamageSystem {
  constructor(bus: EventBus, registry: EntityRegistry);
  step(dt: number): void;                              // czas symulacji dla okien nietykalności
  canDamage(source: EntityId | null, target: EntityId, tags?: readonly string[]): boolean;
  health(id: EntityId): Health | undefined;
  /** Jedyna droga zadawania obrażeń. Sprawdza drużyny, emituje damage_dealt / health_changed / enemy_killed / player_died. */
  deal(target: EntityId, info: DamageInfo): number;
  register(id: EntityId, health: Health, opts?: { stats?: Stats; invulnMs?: () => number }): void; // stats: modyfikatory 'damageTaken' (baza zawsze 1)
  unregister(id: EntityId): void;
}

// src/combat/weapons/projectiles.ts
export interface ProjectileSpec { owner: EntityId; team: Team; origin: Vec3; dir: Vec3; speed: number; damage: number; tags: readonly string[] }
export interface ProjectileSystem {
  spawn(spec: ProjectileSpec): EntityId;               // z puli; emituje projectile_spawned
  reflect(id: EntityId, newOwner: EntityId, newTeam: Team, dir: Vec3, opts?: { speedMult?: number; damageMult?: number }): void; // emituje projectile_reflected
  /** Przechwytywanie trafień przed obrażeniami (parowanie #10). true = przejęte. */
  addInterceptor(fn: (hit: ProjectileHit) => boolean): () => void;
  step(dt: number): void;                              // sweep, trafienia przez DamageSystem.deal
  forEachActive(cb: (id: EntityId, pos: Vec3, dir: Vec3, team: Team) => void): void; // dla renderu (InstancedMesh)
}

// src/render/materials.ts
export type MaterialKind = 'world' | 'enemy' | 'enemyGlow' | 'interactive' | 'player' | 'power';
export function getMaterial(kind: MaterialKind): import('three').Material;
/** Podmienia materiały w modelu glTF według nazw mat_* (patrz docs/assets.md). */
export function applyStyle(root: import('three').Object3D): void;

// src/ui/debugConsole.ts
export function registerCommand(name: string, help: string, run: (args: string[]) => string): () => void;
```

### Zdarzenia dopisywane do `GameEvents`

```ts
// zmienione
damage_dealt: { source: EntityId | null; target: EntityId; amount: number; tags: readonly string[];
                point: Vec3 | null; dir: Vec3 | null; knockback: number; killed: boolean };

// walka i zdrowie (#01)
health_changed: { id: EntityId; current: number; max: number };
player_died: { id: EntityId };

// ruch (#02, #04)
player_jumped: { id: EntityId; double: boolean };
player_landed: { id: EntityId; speed: number };          // prędkość pionowa przy lądowaniu, m/s
dash_used: { user: EntityId; dir: Vec3 };
slide_started: { user: EntityId };
slide_ended: { user: EntityId };

// kamera i czas (#03, #13)
camera_shake: { intensity: number; durationS: number; dir: Vec3 | null };  // intensity 0..1
slowmo: { timeScale: number; durationS: number };

// bronie i pociski (#06)
weapon_fired: { weapon: string; owner: EntityId };
heat_changed: { id: EntityId; current: number; max: number; overheated: boolean };
projectile_spawned: { id: EntityId; owner: EntityId; team: Team };
projectile_reflected: { id: EntityId; newOwner: EntityId };

// wręcz (#07)
melee_swing: { attacker: EntityId; stage: 1 | 2 | 3 | 'heavy' };
melee_blocked: { defender: EntityId; attacker: EntityId | null; amount: number };

// moce (#11)
energy_changed: { id: EntityId; current: number; max: number };
power_denied: { power: string; user: EntityId; reason: 'no_energy' | 'cooldown' };

// wrogowie (#08)
enemy_telegraph: { id: EntityId; kind: string; durationS: number };
enemy_stunned: { id: EntityId; durationS: number };

// arena (#16)
wave_started: { wave: number; count: number };
wave_cleared: { wave: number };
wave_last_kill: { wave: number; id: EntityId };
```

Konwencja: czasy w zdarzeniach w sekundach z sufiksem `S` (`durationS`), wyjątek `hitstop.ms` (milisekundy, bo tak się je stroi).
