# API między modułami (kontrakty)

## Chwyt i rzut (F2-09)

Uzupełnienia po przeglądzie F2-09:

- `Power.step(playerDt, input, worldDt = playerDt)` i
  `PowerSlots.step(playerDt, input, worldDt = playerDt)` są wstecznie zgodne.
  Chwyt krokuje loty po obsłudze wejścia (także nowy rzut) czasem świata;
  koszt trzymania, limit i odnowienie nadal używają czasu gracza.
- `GrabTarget.controlled?: boolean` wyklucza przejętego wroga z kandydatów.
  `GrabContact.normal: Vec3` jest normalną od przeszkody do lecącego ciała.
  `GrabPhysics.sweep(target, velocity, worldDt, accept?)` sprawdza także
  początkowe nakładanie, pomija odrzucone kontakty i przy tym samym czasie
  trafienia wybiera wroga przed światem. `accept` nie ma skutków ubocznych.
- `holdPosition(target, origin, desired, { owner, playerRadiusM, clearanceM })`
  wykonuje przelot od oka; zwraca `Vec3 | null` (brak bezpiecznego miejsca).
  Sprawdza odstęp od kapsuły właściciela; bez collidera używa kuli przy oku.
  `placeForRelease(target)` zatwierdza punkt kinematyczny przed rzutem,
  także dla chwytu i puszczenia zakolejkowanych w jednym hitstopie.
- Świat zadaje obrażenia przy normalnej prędkości uderzenia ≥ minImpactSpeed;
  kontakt z podłogą i lądowanie wymagają małej całkowitej prędkości ciała.
  Puszczenie ma pierwszeństwo przed wyczerpaniem energii i maxHoldS.
- Dron po przejęciu odzyskuje odstęp `skinM` od świata. `drone.massKg` w danych
  określa masę dla Chwytu i dynamicznego ciała, niezależnie od sensora.
  Przejęte AI ignoruje reakcje ruchu/stanu na damage_dealt, ale obrażenia
  i statusy nadal przechodzą zwykłą drogą. Zwolnienie zachowuje aktywne
  ogłuszenie ze StatusSystem; parowanie nie działa podczas controlled.
- `PowerBase.activationQueued` (chroniony getter) pozwala buforować puszczenie
  tylko dla istniejącego lub zakolejkowanego chwytu. Hitstop wyrównuje snapshoty
  wiązki, wrogów i skrzyń bez kroku fizyki; HUD zeruje stary licznik przy chwycie.

- `PowerInput` już zawiera `pressed`, `held`, `released`; F/E łapie po wciśnięciu,
  trzyma do puszczenia i rzuca po puszczeniu (również po hitstopie).
- `PowerDeps.grab?: GrabPhysics` jest opcjonalne; pozostałe moce go nie używają.
  `GrabPhysics(world, entities, enemies)` dostaje funkcję zwracającą `GrabTarget[]`.
  `registerObject(id, body, massKg)` rejestruje dynamiczny obiekt interaktywny
  i zwraca funkcję wyrejestrowania. `targets()` łączy obiekty i żywych wrogów.
  `contacts(target)` odczytuje rzeczywiste kontakty, `sweep(target, velocity, dt)`
  sprawdza przelot kształtu przez świat i hurtboxy wrogów (także sensory Drona).
  Kontakt ma `enemy: EntityId | null`, `point`, `normalY` (podparcie od dołu)
  i `impact: boolean` (świat lub wróg). Podparcie na obiekcie też kończy lot,
  ale samo uderzenie w obiekt nie zadaje obrażeń Chwytu.
- `GrabTarget`: `{ id, body: RigidBody, enemy: boolean, grabbable: boolean,
  massKg: number, setControlled?(controlled: boolean): void }`.
  Obiekty rejestruje scena, bez wyszukiwania po kolorze materiału.
- Opcjonalne `Enemy.grabTarget?(): GrabTarget` udostępnia ciało i przejęcie ruchu
  (zaimplementowane przez wszystkie wbudowane archetypy);
  `EnemyManager.grabTargets()` zwraca żywych wrogów. Brak `grabbable` oznacza
  `false`; dane pięciu lekkich archetypów mają `true`, Egzekutor ma `false`.
  Przejęcie natychmiast przerywa atak i oddaje token dyrektora (także kolejkę),
  ustawia snapshot `controlled?: boolean` i wstrzymuje AI. Snapshoty nadal
  odczytują ciało fizyczne. Zwolnienie przywraca `idle` lub nadal aktywne
  ogłuszenie żywemu wrogowi.
  Przejęcie obejmuje trzymanie i lot do lądowania; nie jest statusem bojowym.
  Scena po `world.step()` woła `EnemyManager.captureControlled()`, które przez
  opcjonalne `Enemy.syncControlled()` aktualizuje bieżącą pozycję przejętego
  wroga z ciała (poprzednia zostaje z początku kroku). Zapobiega to opóźnieniu
  modelu względem wiązki i zachowuje interpolację podczas dynamicznego lotu.
- `PowerBase` ma chronione `cooldownOnActivation` (domyślnie `true`) i
  `startCooldown()`. Chwyt ustawia `false` i zaczyna odnowienie po puszczeniu.
  `power_used` pozostaje zdarzeniem pobrania kosztu; nowe `power_released:
  { power: string; user: EntityId }` zaczyna odnowienie Chwytu w HUD.
- `power_denied.reason` rozszerza się o `'too_heavy' | 'out_of_range'`;
  odmowy wyboru celu nie pobierają energii ani nie zaczynają odnowienia.
- `GrabPower.heldTarget` to `EntityId | null`; `beam` to tylko odczytywany przez
  render stan `{ previous: { from, to }, current: { from, to } } | null`.
  Reset zwalnia trzymany cel i wszystkie loty oraz subskrypcje. Śmierć właściciela
  opuszcza cel bez obrażeń, śmierć/despawn celu odłącza jego przejęcie.
- Scena krokuje trzymanie czasem gracza, loty czasem świata przed fizyką.
  Rzut włącza dynamiczne ciało i CCD; pierwsze kwalifikujące zderzenie przy
  prędkości ≥ `minImpactSpeed` zadaje obrażenia raz na cel
  przez `DamageSystem.deal`, źródło gracza, tagi `#power`, `#grab`.
  Upuszczenie bez rzutu nie zadaje obrażeń. Przy lądowaniu żywy wróg wraca do AI.
  `grab.json` zawiera też `landingNormalY` i `landingSpeedMps` (próg podparcia
  i całkowitej prędkości kończących lot). Obiekt po pierwszym trafieniu wraca
  do zwykłej fizyki dynamicznej (bez dalszych obrażeń od tego rzutu).
  Render nie modyfikuje ciał ani mocy.

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
  | 'jump' | 'sprint' | 'dash' | 'crouch' | 'attack' | 'block' | 'swap' | 'power';

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

Mapowanie klawiszy w danych (domyślnie WASD, Space, Shift, Q = dash, Ctrl = crouch, LPM = attack, PPM = block, R/F = swap/power).

## Kontekst gry i sceny — `src/core/context.ts`, `src/scenes/`

```ts
export interface GameContext {
  bus: EventBus;
  rng: Rng;
  loop: GameLoop;
  tuning: Tuning;
  debug: boolean;
  commands?: CommandRegistry;                  // rejestr komend debug
  camera?: import('three').PerspectiveCamera;   // kamera główna (sceny FPP)
  audio?: AudioSystem;                          // dźwięki (#14), jeden na aplikację
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
melee_swing: { attacker: EntityId; stage: 1 | 2 | 3 | 4 | 'heavy' };  // F2-11: etap 4 = bliźniacze ostrza
melee_blocked: { defender: EntityId; attacker: EntityId | null; amount: number };

// moce (#11)
power_cooldown: { power: string; user: EntityId; cooldownS: number };
energy_changed: { id: EntityId; current: number; max: number };
power_denied: { power: string; user: EntityId; reason: 'no_energy' | 'cooldown' | 'too_heavy' | 'out_of_range' };
power_released: { power: string; user: EntityId }; // F2-09: odnowienie od puszczenia

// wrogowie (#08)
enemy_telegraph: { id: EntityId; kind: string; durationS: number };
enemy_stunned: { id: EntityId; durationS: number };

// arena (#16)
wave_started: { wave: number; count: number };
wave_cleared: { wave: number };
wave_last_kill: { wave: number; id: EntityId };
```

Konwencja: czasy w zdarzeniach w sekundach z sufiksem `S` (`durationS`), wyjątek `hitstop.ms` (milisekundy, bo tak się je stroi).

## Kontrakty F2 (zatwierdzone 2026-11-14, ADR 0004)

Zadania: `docs/issues/F2/README.md`. Zdarzenia i akcje wejścia dopisuje do kodu zadanie F2-01 (Architekt) z góry, żeby zadania równoległe nie zmieniały `src/core/`.

### Statusy (F2-01, F2-02)

```ts
// src/combat/damage/types.ts
export interface StatusApplication { id: string; durationS: number; stacks?: number } // stacks domyślnie 1
export interface DamageInfo { /* …jak w F1… */ statuses?: readonly StatusApplication[] }

// src/combat/damage/damageSystem.ts
class DamageSystem {
  /** Statystyki celu przekazane w register (StatusSystem nakłada na nie modyfikatory). */
  stats(id: EntityId): Stats | undefined;
}

// src/combat/status/statusSystem.ts (definicje: src/data/statuses/*.json, zod)
export interface StatusQuery {
  has(target: EntityId, status: string): boolean;
  stacks(target: EntityId, status: string): number;
  remaining(target: EntityId, status: string): number; // s, 0 gdy brak
}
export class StatusSystem implements StatusQuery {
  constructor(bus: EventBus, damage: DamageSystem, deps: {
    position(id: EntityId): Vec3 | null;          // dla wyładowań w promieniu
    targets(): readonly EntityId[];               // potencjalne cele wyładowań
  }, defs?: ReadonlyMap<string, StatusDefinition>);
  step(dt: number): void;                         // czas symulacji (dt = 0 w hitstopie)
  /** Tylko StatusSystem (z damage_dealt), testy i komendy debug. Zaimplementowane w F2-02. */
  apply(target: EntityId, app: StatusApplication, source: EntityId | null): void;
  list(target: EntityId): ActiveStatus[];         // { id, stacks, remainingS, source } — HUD, debug
  clear(target: EntityId): void;                  // śmierć, despawn
  reset(): void;                                  // nowy run
  dispose(): void;
}
export const STATUS_TAG = '#status'; export const STUNNED = 'stunned';
// Nakładanie wyłącznie z damage_dealt.statuses (tylko gdy amount > 0 i killed = false).
// Obrażenia statusów: DamageSystem.deal, source = nakładający, tagi statusu + '#status', bez statuses.
```

### Bronie (F2-03, F2-04)

```ts
// src/combat/weapons/weaponSchema.ts — unia po fireMode (zod discriminatedUnion)
interface WeaponBase {
  id: string; name: string;                       // name: tekst UI (pl)
  tags: string[]; statuses?: StatusApplication[];
}
interface ShotWeaponBase extends WeaponBase {
  fireMode: 'projectile' | 'spread' | 'pierce' | 'lob';
  damage: number; fireRateHz: number;
  automatic: boolean;                             // false = jeden strzał na wciśnięcie
  heatPerShot: number;
}
interface BeamWeaponDefinition extends WeaponBase {
  fireMode: 'beam'; automatic: true;
  dps: number; heatPerS: number; rangeM: number; tickHz: number;
}
// projectile: projectileSpeed, projectileLifetimeS, spreadDeg
// spread:     + pellets (≥ 2)
// pierce:     + pierceCount (≥ 1), pierceFalloff (0..1)
// beam:       osobny wariant BeamWeaponDefinition; bez damage/fireRateHz/heatPerShot i pól pocisku
// lob:        projectileSpeed, projectileLifetimeS, spreadDeg, gravity, radiusM, explosionDamage
// damage = obrażenia bezpośrednie; explosionDamage = obrażenia obszarowe; statuses przekazywane do wybuchu

// src/combat/weapons/weapon.ts
export interface WeaponInput { triggerHeld: boolean; origin: Vec3; dir: Vec3 } // zbocze wciśnięcia liczy Weapon
export interface WeaponDeps {
  projectiles: Pick<ProjectileSystem, 'spawn'>;
  /** F2-04: promień lasera — pierwszy trafiony collider (wróg albo ściana). */
  castBeam?(origin: Vec3, dir: Vec3, rangeM: number): { target: EntityId | null; distance: number; point: Vec3 };
  damage?: DamageSystem;
}
export class Weapon {
  constructor(owner: EntityId, ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>, stats: Stats,
              deps: WeaponDeps, definition: WeaponDefinition, team?: Team);
  readonly definition: WeaponDefinition;
  readonly heat: ResourcePool; readonly overheated: boolean; readonly shots: number;
  readonly beam: { active: boolean; from: Vec3; to: Vec3 } | null;
  step(dt: number, input: WeaponInput): void;
  cool(dt: number): void;                       // nieaktywna broń: chłodzenie i zegary bez zdarzeń; zwalnia spust/promień
  vent(amount: number | 'full'): void;          // F2-17: natychmiastowe schłodzenie (synergia cool_weapon); przy zerze zdejmuje blokadę, emituje heat_changed
  reset(): void;
}
export class Blaster extends Weapon {} // zgodność z F1: dane blastera, to samo zachowanie
export const weaponDefinitions: ReadonlyMap<string, WeaponDefinition>; // src/data/weapons/*.json (bez plasmaBlade)

// src/combat/weapons/projectiles.ts — rozszerzenie ProjectileSpec
interface ProjectileSpec { /* …F1… */
  statuses?: readonly StatusApplication[];
  pierce?: { count: number; falloff: number };    // F2-03
  gravity?: number;                               // F2-04, m/s² w dół
  explode?: { radiusM: number; damage: number; tags: readonly string[]; statuses?: readonly StatusApplication[] }; // F2-04
}
```

### Moce (F2-05 … F2-09)

```ts
// src/combat/powers/power.ts
export interface PowerInput { pressed: boolean; held: boolean; released: boolean }
export interface Power {
  readonly def: PowerDefinition;
  readonly cooldownRemaining: number;
  readonly active: boolean;                       // trwa działanie (Bariera, Skupienie, trzymanie Chwytu)
  step(dt: number, input: PowerInput): void;
  reset(): void;
}
export interface PowerDeps {
  owner: EntityId; bus: EventBus; tuning: Tuning;
  damage: DamageSystem; energy: PlayerEnergy;
  aim(): { origin: Vec3; dir: Vec3 };
  targets(): readonly PushTarget[];               // { id, position }
  castWall(origin: Vec3, dir: Vec3, maxDistance: number): number | null;
  projectiles?: ProjectileSystem;                 // Bariera
  grab?: GrabPhysics;                             // Chwyt (F2-09)
  feel?: FocusControl;                            // Skupienie (F2-06)
}
export type PowerFactory = (def: PowerDefinition, deps: PowerDeps) => Power;

// src/combat/powers/registry.ts — definicje z src/data/powers/*.json, unia po `kind`
// kind: 'cone' (Pchnięcie, Fala uderzeniowa) | 'chain' | 'barrier' | 'grab' | 'focus'
export const powerDefinitions: ReadonlyMap<string, PowerDefinition>;
export function registerPowerKind(kind: string, factory: PowerFactory): void;
export function createPower(id: string, deps: PowerDeps): Power;

// src/combat/powers/slots.ts
export class PowerSlots {
  constructor(slots: readonly (Power | null)[]);  // [0] = akcja 'power' (F), [1] = 'power2' (E)
  get(slot: number): Power | null;
  step(dt: number, input: InputSnapshot): void;
  reset(): void;
}
// ResonancePush zostaje jako eksport (kind 'cone' z danymi push.json) — sceny F1 bez zmian.
// Wspólna baza: koszt (PlayerEnergy.spend), odnowienie, power_denied, power_used, kolejka wciśnięcia w hitstopie.
```

Definicje `kind: 'focus'` i `kind: 'barrier'` mają wspólne pola
`id`, `name`, `cost`, `cooldownS`, `tags` oraz dodatnie `durationS`.
Skupienie dodaje `worldScale` (0 < wartość ≤ 1) i `drainPerS` (≥ 0).
Bariera dodaje `arcDeg` (0 < wartość ≤ 360, pełny kąt) i `costPerReflect` (≥ 0).
`step(dt, input)` obu mocy dostaje czas gracza (`ctx.feel.playerDt(dtSim)`).
Skupienie pobiera koszt startowy, potem `drainPerS × dt`, a odnowienie zaczyna
przy zakończeniu. Ponowne wciśnięcie lub brak energii kończy je zdarzeniem
`focus { worldScale, durationS: 0 }`. Reset także kończy aktywne Skupienie.
Bariera ignoruje ponowne wciśnięcie, a odnowienie zaczyna przy aktywacji.
Interceptor przyjmuje tylko trafienia w `owner` od drużyny `enemy`; kierunek
do pocisku to `-hit.dir`, porównywany z kierunkiem patrzenia w pełnym 3D.
Odbija przez `reflect` do pozycji strzelca z `targets()` (gdy strzelca już
nie ma, w kierunku przeciwnym do lotu), z właścicielem `owner` i drużyną
`player`. Brak energii odczepia interceptor i przepuszcza bieżące trafienie.
Promienie i obrażenia obszarowe omijają interceptor pocisków.
`BarrierPower.reflectionFlashS` to pozostały czas błysku (tylko odczyt dla
renderu, odliczany w symulacji); `BarrierRenderer.render(power, pose)` czyta
`active` i ten czas. Reset i koniec działania usuwają interceptor.
`PowerBase` udostępnia podklasom `cooldownOnActivation` oraz `startCooldown()`
do wspólnego naliczania odnowienia od końca mocy podtrzymywanej.

`startCooldown()` emituje `power_cooldown: { power: string; user: EntityId;
cooldownS: number }`. HUD zaczyna odliczanie wyłącznie od tego zdarzenia;
`power_used` nadal oznacza udaną aktywację, bez rozpoczęcia odnowienia Skupienia.
Naturalny koniec Skupienia również emituje `focus { worldScale, durationS: 0 }`.
Wciśnięcie odebrane podczas działania zachowuje swoje znaczenie po hitstopie
i na granicy wygaśnięcia: Skupienie wyłącza, Bariera ignoruje (bez odmowy i kosztu).
Opłacenie kroku do dokładnie zerowej energii nie kończy Skupienia przed czasem;
kończy je dopiero brak środków na kolejny krok lub upływ czasu.

`GameLoop` nie udostępnia stanu hitstopu. `FeelSystem` śledzi maksymalny
pozostały czas z tych samych zdarzeń `hitstop`, aby odliczanie aktywnego
Skupienia i jego spowolnienia nie zużywało czasu hitstopu. Slowmo bez
Skupienia nadal odlicza czas rzeczywisty jak w F1.

`ProjectileSystem.reflect` czyści historię trafionych celów i odnawia czas
życia do `lifetimeS` zapisanej przy spawnie (także dla wartości domyślnej).

### Skupienie — skala czasu gracza (F2-06)

```ts
// src/core/feel.ts
export interface FocusControl { readonly focusActive: boolean }
class FeelSystem implements FocusControl {
  playerTimeScale: number;                        // domyślnie 1
  /** dt dla gracza (ruch, ostrze, broń, moce): dtSim / worldScale × playerTimeScale, max SIM_DT × 2; 0 w hitstopie. */
  playerDt(dtSim: number): number;
}
// GameContext.feel?: Pick<FeelSystem, 'playerDt' | 'focusActive'>   (zaimplementowane w F2-06; main.ts ustawia ctx.feel)
// focus { durationS: 0 } kończy Skupienie przed czasem; po Skupieniu powrót świata też nie spowalnia gracza.
// Zdarzenie focus { worldScale, durationS } — kumulacja ze slowmo jak w F1 (mocniejsze wygrywa).
```

### Wręcz (F2-10, F2-11)

F2-10: opcjonalne zależności `BladeDeps` (brak = nowe akcje wyłączone):
`querySegment(from: Vec3, to: Vec3, radius: number, dashCut: boolean, fallbackDir?: Vec3): Hurtbox[]`,
`castWall(origin: Vec3, dir: Vec3, max: number): number | null`,
`hurtboxPosition(box: Hurtbox): Vec3 | null` (środek trafionego collidera;
fallback: istniejące `positionOf(entity)`, bez obu punkt trafienia jest pomijany),
`dashActive(): boolean`. `querySegment` zwraca hurtboxy wroga przecinające kapsułę
rzutu albo pas dash-cięcia (szerokość = 2 × radius, wysokość = dashCutHeightM).
Start dashu ostrze zapisuje z `dash_used` (punkt oczu przed ruchem).
Aktywność dashu jest czytana po kroku gracza przez `getState().dashS`;
kontroler nie wymaga zmian. Tor kończy się w ostatnim kroku dashu.
`BladeView.state` rozszerzone o `throwing` i `dashCut`.
`BladeView.flight` = null albo `{ previous: Vec3, position: Vec3,
previousAgeS: number, ageS: number, returning: boolean }` — do interpolacji renderu.
Jedno dash-cięcie na dash; `dashCutGraceS` odliczane w czasie gracza.
`fallbackDir` zachowuje kierunek dashu/celowania przy zerowym odcinku.
Bufory rzutu i ataku używają `tuning.melee.attackBufferMs`, zamrożone w hitstopie.
Nowe akcje mogą zacząć się w idle, bloku lub recovery lekkiego ciosu;
nie przerywają ładowania ani całego ciężkiego ciosu (włącznie z recovery).
Rzut czeka na zakończenie dash-cięcia. Warunki dash-cięcia są ponownie
sprawdzane przy wykonaniu buforowanego ataku. Cios i nowa akcja nie zadają
obrażeń w tym samym kroku przejścia między stanami.

```ts
// src/combat/melee/bladeSchema.ts — rozszerzenie BladeDefinition (pola opcjonalne, F1 bez zmian)
throw?: { damage: number; speed: number; rangeM: number; radiusM: number; returnSpeed: number };
dashCut?: { damage: number; widthM: number; knockback: number };
heavyShape: 'arc' | 'spin';                       // F2-11: domyślnie 'arc'; dwustronne = 'spin' (kula o promieniu heavy.reach wokół oczu)
timeScale: number;                                // F2-11: mnożnik czasu faz ciosu (domyślnie 1; bliźniacze 0.7, dwustronne 1.2)
parryArcDeg?: number;                             // F2-11: kąt odbijania pocisków (brak = tuning.melee.parryArcDeg)
model?: string;                                   // F2-11: /assets/models/<model>.glb (fallback plasma_blade.glb, potem bryła)
offhand: boolean; doubleEnded: boolean; lengthScale: number;  // F2-11: wskazówki widoku FPP (druga dłoń, ostrze z obu stron, długość)
// Warianty: src/data/blades/*.json (plasmaBlade, twinBlades, staffBlade), `bladeDefinitions: ReadonlyMap<string, BladeDefinition>`,
// `resolveBlade(loadoutBlade, override?)` — nadpisanie (?blade= / ekran buildu) wygrywa z Loadout.blade; nieznane id nadpisania ignorowane.
// BladeDeps.queryArc(reach, width, shape?: 'arc' | 'spin') — spin = obrót 360° (odrzut od gracza, nie w kierunku patrzenia).
// PlasmaBlade.definition (odczyt) i setDefinition(def) (zmiana wariantu: reset stanu).
```

### Wrogowie (F2-02, F2-12, F2-14)

F2-14: `DamageTargetOptions.guard?: (info: DamageInfo) => number` zwraca
mnożnik 0–1. `DamageSystem.deal` woła go po filtrze drużyn i nietykalności,
przed `damageTaken`. Wynik ≤ 0 blokuje trafienie: zwrot 0, bez `damage_dealt`
i pozostałych zdarzeń obrażeń. Bez `guard` mnożnik wynosi 1.

`kind: 'shielder' | 'executor'` używa klasy `Assaulter`. Opcjonalne dane:
`shield: { arcDeg, downS, blocksTags }`, `parry: { cooldownS }`,
`attackTags` (domyślnie `['#melee']`). `EnemySnapshot.shieldUp?: boolean`
informuje widok o podniesionej tarczy. `#heavy` w `attackTags` wybiera
`enemy_telegraph.kind: 'heavy'` i przechodzi do tagów ciosu.

Tarcza blokuje wskazane tagi z przedniego łuku (kąt między `-info.dir`
a kierunkiem patrzenia ≤ `arcDeg/2`); bez `dir` przepuszcza trafienie.
Ciężki cios z przodu przepuszcza i opuszcza tarczę na `downS`.
Ogłuszenie i `statuses.has(id, 'overload')` wyłączają tarczę.
Parowanie blokuje lekki `#melee` tylko w `idle/chase`, bez ogłuszenia,
raz na `cooldownS`. W zasięgu celu rozpoczyna kontrę, jeśli otrzyma token
`melee` dyrektora (bez dyrektora zawsze). Obie obrony emitują
`melee_blocked { defender, attacker: info.source, amount: info.amount }`.
Proporcje tarczy (`animation.shieldSizeM`) i ostrza
(`animation.bladeSizeM`) są wektorami `{ x, y, z }` w danych.

```ts
// src/enemies/types.ts — rozszerzenie EnemyDependencies
statuses?: StatusQuery;                           // ogłuszony (status 'stunned') nie atakuje
director?: EnemyDirectorApi;

// src/enemies/director.ts (zaimplementowane w F2-12)
export type TokenKind = 'melee' | 'shot';
export interface EnemyDirectorApi {
  requestToken(id: EntityId, kind: TokenKind): boolean; // true = może atakować teraz; kolejka FIFO, wołać co krok
  releaseToken(id: EntityId): void;               // koniec ataku, śmierć, ogłuszenie
  slot(id: EntityId, kind: TokenKind, radiusM: number): Vec3 | null; // kąt od dyrektora, promień wroga; wołać co krok
}
export const directorConfigSchema; // zod: attackTokens, shotTokens, maxHoldS, reassignS, probeHeightM,
                                   // slots: { melee: { count, offsetDeg }, shot: { count, offsetDeg } }
export class EnemyDirector implements EnemyDirectorApi {
  constructor(bus: EventBus, config: DirectorConfig, deps: {
    target(): { id: EntityId; position: Vec3 } | null;
    position(id: EntityId): Vec3 | null;
    clear?(from: Vec3, to: Vec3): boolean;        // false = świat zasłania slot
  });
  step(dt: number): void;                         // po krokach wrogów; dt = 0 nic nie zmienia
  forget(id: EntityId): void; snapshot(): DirectorSnapshot; reset(): void; dispose(): void;
}
// Zwalnia sam przy enemy_killed, entity_despawned, enemy_stunned i status_applied 'stunned'.

// src/enemies/manager.ts
new EnemyManager(ctx, deps, { director?: DirectorConfig }); // manager tworzy dyrektora, wstrzykuje
                                                            // deps.director i krokuje go po wrogach
readonly director: EnemyDirector | null;
// Dane: `director` w src/data/scenes/*.json; `flankDistanceM` w danych Szturmowca.

// F2-13: archetypy 'sniper' (klasa Gunner z danymi: aimLockS, laserSight, projectileTags)
// i 'drone' (klasa Drone, blok `drone` w danych). EnemySnapshot.aim?: Vec3 — punkt celowania.
// src/enemies/views.ts
export interface EnemyViewLike { readonly root: Object3D; render(alpha: number, frameDt?: number): void; dispose(): void }
export function createEnemyView(enemy: Enemy, loadModels?: boolean): EnemyViewLike; // DroneView albo EnemyView
```

### Ekwipunek i synergie (F2-15, F2-16)

```ts
// src/progression/loadout.ts — src/data/loadouts/*.json
export interface Loadout { id: string; name: string; blade: string; weapons: string[]; powers: string[]; tags: string[]; startHeld: HeldKind }
// weapons: 1–3 id broni; powers: 1–2 id mocy; tags: np. '#build_blade' (wymagania synergii)
// Walidacja znanych id (ostrze: dowolne id z bladeDefinitions), bez powtórzeń broni, mocy i id ekwipunków.
export const loadoutSchema: z.ZodType<Loadout>;
export function loadLoadout(data: unknown): Loadout;
export function loadLoadoutDefinitions(data: readonly unknown[]): ReadonlyMap<string, Loadout>;
export const loadoutDefinitions: ReadonlyMap<string, Loadout>;
// Arena: ?loadout=<id>, domyślnie classic; nieznane id → classic i console.warn w debug.
// ?blade=<id> (arena, melee-test i jego warianty) nadpisuje ostrze ekwipunku (F2-11).
// weapon_switched.slot: indeks 0–2; po zdarzeniu scena emituje heat_changed wybranej broni.
// Hud: opcja loadout (weapons, powers), setLoadout(loadout) przy resecie;
// step(dt) odlicza odnowienia wyłącznie ze zdarzeń power_cooldown { power, user, cooldownS }, w czasie gracza.

// src/progression/synergies.ts — src/data/synergies/*.json
export class SynergySystem {
  constructor(bus: EventBus, ctx: SynergyContext, defs?: readonly SynergyDefinition[]);
  setTags(tags: readonly string[]): void;         // tagi ekwipunku (później implantów F3)
  reset(): void; dispose(): void;
}
// efekty: add_energy | cool_weapon | stat_modifier_timed | chain_on_hit (ADR 0004 pkt 5)
```

### Ekran wyboru buildu i fale F2 (F2-17)

```ts
// src/scenes/arena.ts
class Arena {
  constructor(loadModels?: boolean, selectBuild?: boolean);  // rejestr scen: new Arena(true, true); testy: domyślnie bez ekranu
  chooseLoadout(id: string, bladeId?: string): boolean;  // nowy run od fali 1 z ekwipunkiem + ctx.resume(); bladeId (F2-11) nadpisuje ostrze na cały run; false dla nieznanego id
}
// Stany: 'select' (ekran wyboru, fale stoją, gracz nie krokuje) | 'playing' | 'dead'.
// selectBuild i brak ?loadout= → start w 'select'; ?loadout=<id> pomija ekran.
// Komenda debug `build` (tylko z selectBuild): reset i powrót do ekranu.
// query: 'state', 'synergies' (SynergySystem.active()), 'buildSelect' (czy ekran widoczny), 'blade' (id ostrza runu).
// SynergySystem w arenie: tagi z Loadout.tags przy każdym resecie; stats = PlayerController.stats
// (tam żyją dashCooldown i moveSpeed), addEnergy → PlayerEnergy.add, coolWeapon → aktywna broń vent().

// src/ui/buildSelect.ts — teksty i lista kart w src/data/ui/buildSelect.pl.json
// F2-11: rząd „Ostrze:” (blade.options w JSON); onSelect(loadoutId, bladeId?) — bladeId tylko, gdy gracz wybrał wariant.
export function buildOptions(data: unknown, loadouts?, synergies?): { text: BuildSelectText; options: BuildOption[] };
// BuildOption: id, name, description, hybrid, weapons/powers (nazwy), synergies (nazwy aktywnych synergii)
export class BuildSelect {
  constructor(opts: { onSelect(loadoutId: string): void; root?: HTMLElement; data?: unknown });
  readonly visible: boolean; show(): void; hide(): void; dispose(): void;
}
// HudOptions.onChangeBuild?: () => void — przycisk „Zmień build” na ekranie śmierci.
```

### Wejście (F2-01)

Nowe akcje: `power2` (`KeyE`), `weapon1`, `weapon2`, `weapon3` (`Digit1`–`Digit3`), `bladeThrow` (środkowy przycisk myszy, `mouse: "1"`).

### Zdarzenia dopisywane do `GameEvents` (F2-01)

```ts
damage_dealt: { /* …F1… */ statuses?: readonly StatusApplication[] };  // tylko gdy DamageInfo.statuses
status_applied: { target: EntityId; status: string; stacks: number; durationS: number; source: EntityId | null };
explosion: { point: Vec3; radiusM: number; owner: EntityId; tags: readonly string[] }; // F2-04
status_expired: { target: EntityId; status: string };
focus: { worldScale: number; durationS: number };
weapon_switched: { owner: EntityId; weapon: string; slot: number };
blade_thrown: { owner: EntityId };
blade_returned: { owner: EntityId };
synergy_triggered: { synergy: string; user: EntityId };
```

### Przedmiot w ręku (arena)

```ts
// src/combat/heldItem.ts — symulacja bez Three.js i DOM
export type HeldKind = 'blade' | 'gun';
export interface HeldItemView { held: HeldKind; target: HeldKind; swapping: boolean; swapT: number }
export class HeldItem {
  constructor(bus: EventBus, owner: EntityId, tuning: Tuning, start: HeldKind);
  get held(): HeldKind;
  view(): HeldItemView; // swapT 0..1, 1 = bez zamiany
  requestGun(): void;
  requestToggle(): void;
  forceBlade(): void; // natychmiast, kasuje zamianę i bufor
  reset(start: HeldKind): void; // natychmiast, publikuje stan, kasuje zamianę i bufor
  step(dt: number, input: InputSnapshot, ctx: { bladeBusy: boolean }): {
    bladeInput: InputSnapshot; triggerHeld: boolean;
  };
  dispose(): void; // odpina nasłuch weapon_switched
}
// GameEvents:
held_item_changed: { owner: EntityId; held: HeldKind; weapon: string | null };
// Id broni HeldItem zapamiętuje z weapon_switched dla owner; arena publikuje je przed reset().
// Przy ostrzu weapon = null; przy broni = id wybranego slotu.
// Nowa akcja Action: swap (KeyR), usuwa shoot. attack (LPM) = atak/spust.
// Loadout: startHeld opcjonalne w JSON, domyślnie 'blade' po walidacji.
// tuning.hands: { swapS: 0.24, swapBufferS: 0.4 } — czas gracza, lil-gui.
// Arena.heldView(): HeldItemView; query('heldItem') zwraca ten sam stan.
// Komenda areny: hold blade|gun — natychmiastowy reset samego stanu ręki.
```

Arena rozdziela wejście przed PlasmaBlade.step i Weapon.step. W zamianie blokuje
atak, blok i rzut ostrzem oraz spust; PPM i środkowy przycisk przerywają zamianę,
przywracają ostrze i przekazują wejście w tym samym kroku. `bladeBusy` oznacza stan
inny niż idle, z wyjątkiem throwing (lot nie blokuje zamiany). Bufor żądania
ostrze → broń trwa najwyżej swapBufferS. Klawisze 1/2/3 wybierają istniejący slot
przed żądaniem broni; zmiana broń → broń nie uruchamia zamiany. Nietrzymane bronie
wyłącznie stygną. HUD słucha held_item_changed i przygasza blok broni przy ostrzu.

## Kontrakty F3 (zatwierdzone 2026-11-14, ADR 0005)

F3-08: `src/world/threat.ts` eksportuje `planWaves: RoomPlanner['planWaves']`
oraz `roomPlanner: RoomPlanner`. Planer przyjmuje główny RNG runu i sam tworzy
`fork('room:<nodeId>')`. Obsługuje combat/elite; błędna konfiguracja powoduje błąd.
Sekcja threat dodaje opcjonalne `waveWeights` (domyślnie [1, 1.3, 1.6]) oraz
`pacing[type]` (domyślnie firstBreakS=2, breakS=4, spawnIntervalS=0.8).
Szczegóły: `docs/systems/threat.md`.

Architektura i decyzje: `docs/adr/0005-petla-runu-f3.md`. Zadania: `docs/issues/F3/README.md`.

### Wspólne typy runu — `src/core/runTypes.ts`

```ts
export const NODE_TYPES = ['combat', 'elite', 'shop', 'rest', 'puzzle', 'boss'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export interface MapNode {
  id: string;
  layer: number;
  index: number;
  type: NodeType;
  next: string[];
}

export interface SectorMap {
  sectorId: string;
  layers: MapNode[][];
}

export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export type RunOutcome = 'victory' | 'death';

export interface RunDamageStats {
  melee: number;
  power: number;
  gun: number;
  other: number;
}

export interface RunState {
  seed: string;
  sectorId: string;
  loadoutId: string;
  startedAtMs: number;
  elapsedS: number;                // czas symulacji w s (nie zegar ściany)
  map: SectorMap;
  currentNodeId: string | null;
  visited: string[];
  hp: number;
  energy: number;                  // ciepło broni nie jest przenoszone (broń startuje zimna)
  credits: number;
  implants: string[];              // id posiadanych implantów, bez duplikatów
  stats: {
    kills: number;
    damage: RunDamageStats;
  };
}

export interface RunSummary {
  outcome: RunOutcome;
  seed: string;
  loadoutId: string;
  elapsedS: number;
  kills: number;
  roomsCleared: number;
  layerReached: number;
  implants: string[];
  damage: RunDamageStats;
}

export interface RoomPlanner {
  planWaves(room: RoomDefinition, sector: SectorDefinition, node: MapNode, rng: Rng): WavesDefinition;
}
```

### Generator mapy (F3-02) — `src/world/sectorMap.ts`

`generateSectorMap(def: SectorDefinition, seed: string): SectorMap` waliduje dane przez zod,
używa wyłącznie `new Rng(seed).fork('map')` i zwraca serializowalny graf z id `L1N1` itd.
Nie zmienia definicji wejściowej. Gwarancje liczą węzły w domkniętym przedziale warstw;
limit elit dotyczy każdej ścieżki. Sprzeczne reguły zgłaszają błąd zamiast zwracać niepoprawną mapę.
`kuroganeSector` z `src/world/sectors.ts` to zwalidowana definicja sektora Kurogane Arms.
Scena `map-test` udostępnia tekst mapy przez komendę `map` i graf przez `query('map')`.

### Zdarzenia dopisywane do `GameEvents` (F3-01) — `src/core/events.ts`

| Zdarzenie          | Payload                                                                   | Emituje         |
| ------------------ | ------------------------------------------------------------------------- | --------------- |
| `node_selected`    | `{ nodeId: string; type: NodeType }`                                      | `RunManager`    |
| `room_entered`     | `{ nodeId: string; roomId: string; type: NodeType; layer: number }`       | `RoomScene`     |
| `room_cleared`     | `{ nodeId: string; type: NodeType; timeS: number }`                       | `RoomScene`     |
| `reward_offered`   | `{ nodeId: string; options: readonly string[] }`                          | rewards         |
| `implant_acquired` | `{ id: string; rarity: Rarity; source: 'reward' \| 'shop' \| 'upgrade' }` | `ImplantSystem` |
| `currency_changed` | `{ currency: 'credits'; amount: number; delta: number }`                  | `RunManager`    |
| `shop_purchase`    | `{ item: string; kind: 'implant' \| 'heal'; price: number }`              | shop            |
| `rest_used`        | `{ choice: 'heal' \| 'upgrade'; implant: string \| null }`                | rest            |
| `boss_spawned`     | `{ id: EntityId; name: string; maxHealth: number }`                       | `Boss`          |
| `boss_phase`       | `{ id: EntityId; phase: number; phases: number }`                         | `Boss`          |
| `run_ended`        | `{ outcome: 'victory' \| 'death'; summary: RunSummary }`                  | `RunManager`    |

```ts
// src/core/events.ts
node_selected: { nodeId: string; type: NodeType };
room_entered: { nodeId: string; roomId: string; type: NodeType; layer: number };
room_cleared: { nodeId: string; type: NodeType; timeS: number };
reward_offered: { nodeId: string; options: readonly string[] };
implant_acquired: { id: string; rarity: Rarity; source: 'reward' | 'shop' | 'upgrade' };
currency_changed: { currency: 'credits'; amount: number; delta: number };
shop_purchase: { item: string; kind: 'implant' | 'heal'; price: number };
rest_used: { choice: 'heal' | 'upgrade'; implant: string | null };
boss_spawned: { id: EntityId; name: string; maxHealth: number };
boss_phase: { id: EntityId; phase: number; phases: number };
run_ended: { outcome: 'victory' | 'death'; summary: RunSummary };
```

### Zdrowie, wrogowie i synergie (rozszerzenia F3-01)

```ts
// src/combat/damage/health.ts
class Health {
  /** Ustawia bieżące zdrowie obcięte do [0, max] (jak heal/reset nie emituje zdarzeń; sceny emitują health_changed). */
  set(n: number): void;
}

// src/enemies/enemySchema.ts
// Opcjonalny koszt wroga w budżecie zagrożenia pokoju (liczba skończona > 0):
threatCost?: number;

// src/progression/synergies.ts
export const effectSchema: z.ZodType<SynergyEffect>;
export const whenSchema: z.ZodType<SynergyWhen>;
export type SynergyWhen = z.infer<typeof whenSchema>;
// W synergySchema opcjonalny próg liczby wystąpień tagów (liczba całkowita ≥ 1):
requiresCount?: Record<string, number>;
```

### Schematy zod danych F3 (F3-01)

```ts
// src/world/sectorSchema.ts
export const sectorSchema: z.ZodType<SectorDefinition>;
export type SectorDefinition = z.infer<typeof sectorSchema>;
export function loadSector(data: unknown): SectorDefinition;
// Pola wymagane: id, layers (≥ 2), nodesPerLayer { min ≥ 1, max ≥ min }, extraEdgeChance (0..1),
// typeWeights (przedziały warstw { fromLayer, toLayer, weights }), guarantees ({ type, min, fromLayer, toLayer }[]),
// limits ({ maxPerLayer, maxElitesPerPath }), expectedDurationS (Record<NodeType, number>).
// Opcjonalne sekcje: threat, rewardWeights, economy, roomPools.

// src/world/roomSchema.ts
export const roomSchema: z.ZodType<RoomDefinition>;
export type RoomDefinition = z.infer<typeof roomSchema>;
export function loadRoom(data: unknown): RoomDefinition;
// Pola: id, name, type (NodeType), playerSpawn, blocks (jak arena.json), spawnPoints ({ x, z }[]),
// doors ({ id, role: 'entry' | 'exit', position, size }[]), director?, maxAlive?, minSpawnDistance?,
// threatMultiplier?, props? ({ kind, position }[]), puzzle? (Record<string, unknown>).
// Wymaga drzwi 'entry'; pokoje o type !== 'boss' wymagają też drzwi 'exit'.

// src/progression/implantSchema.ts
export const implantSchema: z.ZodType<ImplantDefinition>;
export type ImplantDefinition = z.infer<typeof implantSchema>;
export function loadImplant(data: unknown): ImplantDefinition;
// Pola: id, name, rarity (Rarity), tags ('#...'), modifiers (stat z STAT_IDS, type, value — bez source),
// triggers? ({ when: SynergyWhen, effects: SynergyEffect[], cooldownS? }[] — reużywa whenSchema/effectSchema),
// upgradesTo?.
```

### Strojenie i komendy debug runu (F3-01, zapowiedź F3-07/09/11)

F3-03: `src/world/rooms.ts` eksportuje `loadRoomDefinitions(data: readonly unknown[]): ReadonlyMap<string, RoomDefinition>`
oraz `roomDefinitions` (eager `import.meta.glob` z `src/data/rooms/*.json`). Loader odrzuca powtórzone id pokoi.
`loadRoom` / `roomSchema` sprawdzają także układ: podłogę na wysokości `playerSpawn.y`, granice,
kolizje punktów i osiągalność na siatce 1 m. Szczegóły: `docs/systems/rooms.md`.

```ts
// src/core/tuning.ts
tuning.run = { transitionS: 0.6, fadeS: 0.35 };
```

Komendy konsoli debug (`window.__neoryder.command`, zadania F3-07, F3-09, F3-11):
- `run node <id>` — wybór węzła mapy
- `run clear` — natychmiastowe wyczyszczenie bieżącego pokoju
- `run state` — zrzut stanu `RunState`
- `run end win|lose` — zakończenie runu zwycięstwem lub porażką
- `hurt <n>` — zadanie obrażeń graczowi
- `credits <n>` — dodanie Kredytów
- `implant <id>` — nałożenie implantu

### RoomScene (F3-04)

`src/scenes/roomScene.ts`: `new RoomScene(room: RoomDefinition, run: RunState,
waves: WavesDefinition, options?: RoomSceneOptions)` implementuje `Scene`.
Bieżący węzeł pochodzi z `run.currentNodeId` i `run.map`, ekwipunek z `run.loadoutId`.
`options.loadModels` (domyślnie true) wyłącza modele w testach;
`options.implantDefinitions?: ReadonlyMap<string, ImplantDefinition>` dostarcza definicje
implantów z F3-09. Brak definicji posiadanego implantu jest błędem przed inicjalizacją.
Modyfikatory ze źródłem `implant:<id>` trafiają na statystyki walki i ruchu.
`exportState(): Pick<RunState, 'hp' | 'energy'>` zwraca zasoby bez modyfikowania wejściowego runu.
`clear(): void` jest idempotentnym API dla komendy `run clear` hosta F3-07:
usuwa wrogów i pociski, otwiera exit i emituje `room_cleared`.
Pokój nie rejestruje komend `run`; scena `room-test` rejestruje własne `run clear`.
`room_entered` jest emitowane po gotowości świata, przed uruchomieniem fal;
`room_cleared` po ostatniej fali, najwyżej raz, z czasem symulacji pokoju.
Kontekst pokoju dostarcza host (`rng.fork('room:<nodeId>')`, wspólny EventBus).

### Zarządca stanu runu (F3-05) — `src/world/run.ts`

```ts
export const RUN_SCREENS = ['map', 'room', 'reward', 'shop', 'rest', 'summary'] as const;
export type RunScreen = (typeof RUN_SCREENS)[number];
export type MapGenerator = (seed: string) => SectorMap;

export interface RunManagerOptions {
  generateMap?: MapGenerator;
  sector?: Pick<SectorDefinition, 'id' | 'economy'>;
  creditsPerThreat?: number;
  eliteBonusCredits?: number;
  puzzleCredits?: number;
  initialHp?: number;
  initialEnergy?: number;
  now?: () => number;
}

export const runStateSchema: z.ZodType<RunState>;

export class RunManager {
  constructor(
    bus: EventBus,
    optionsOrGenerateMap?: MapGenerator | RunManagerOptions,
    extraOptions?: RunManagerOptions,
  );
  readonly screen: RunScreen;
  readonly active: boolean;
  readonly state: Readonly<RunState>;
  readonly summary: RunSummary | null;
  readonly currentNode: MapNode | null;
  newRun(seed: string, loadoutId?: string): RunState;
  availableNodes(): readonly MapNode[];
  canSelectNode(id: string): boolean;
  selectNode(id: string): boolean;
  completeRoom(roomState?: { hp?: number; energy?: number }): boolean;
  returnToMap(): boolean;
  completeReward(): boolean;
  leaveShop(): boolean;
  leaveRest(): boolean;
  creditKill(threatCost: number): number;
  addCredits(amount: number): boolean;
  spendCredits(amount: number): boolean;
  setHp(hp: number, maxHp?: number): boolean;
  heal(amount: number, maxHp?: number): number;
  setEnergy(energy: number, maxEnergy?: number): boolean;
  addImplant(id: string): boolean;
  upgradeImplant(fromId: string, toId: string): boolean;
  step(dt: number): void;
  finish(outcome: RunOutcome): RunSummary;
  serialize(): RunState;
  restore(state: RunState): RunState;
  dispose(): void;
}
```

### Implanty (F3-09) — `src/progression/implants.ts`

```ts
export const IMPLANT_SOURCE_PREFIX = 'implant:';
export function implantSource(id: string): string;
export function nextRarity(rarity: Rarity): Rarity | null;
export function loadImplantDefinitions(data: readonly unknown[]): ReadonlyMap<string, ImplantDefinition>;
export const implantDefinitions: ReadonlyMap<string, ImplantDefinition>;

export class ImplantSystem {
  constructor(
    statsOrOptions: Stats | readonly Stats[] | ImplantSystemOptions,
    optionsOrHealth?: Omit<ImplantSystemOptions, 'stats'> | ImplantHealthTarget,
    bus?: EventBus,
    definitions?: ReadonlyMap<string, ImplantDefinition> | readonly ImplantDefinition[],
  );
  has(id: string): boolean;
  get(id: string): ImplantDefinition | undefined;
  ids(): string[];
  list(): ImplantDefinition[];
  tags(): string[];
  triggers(): { implantId: string; trigger: ImplantTrigger }[];
  add(id: string, source?: 'reward' | 'shop' | 'upgrade'): boolean;
  remove(id: string): boolean;
  set(ids: readonly string[], options?: ImplantSetOptions): string[];
  canUpgrade(id: string): boolean;
  upgradeTarget(id: string): ImplantDefinition | null;
  upgrade(id: string): boolean;
  clear(): void;
  reset(): void;
}
```



