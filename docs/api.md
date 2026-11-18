# API między modułami (kontrakty)

## Rekwizyty kryjówki

`HubLayout.props?`: `{ id: string, kind: 'jukebox' | 'noodles' | 'radio' | 'bag',
label: string, focus: { position: Vec3, size: Vec3 } }[]`. Id są unikalne,
wymiary focus dodatnie. `label` pochodzi z walidowanego `hub/props.pl.json`.
`selectHubTarget(..., focusPaddingM, props = [])` wybiera najbliższe trafienie
spośród stacji, NPC i rekwizytów; cel rekwizytu ma `{ kind: 'prop', id }`.

`HubProps` jest stanem symulacji bez DOM/Three.js: `step(dt)`,
`use(id, yaw, interruptRadio = false): boolean`, `snapshot` oraz `bags` (kąt X/Z, poprzedni kąt,
prędkość). Przy zaakceptowanym użyciu emituje
`hub_prop_used: { prop: string; kind: 'jukebox' | 'noodles' | 'radio' | 'bag' }`.
Cooldown jest osobny dla każdego id; radio może zostać przerwane również w
czasie cooldownu. `HubChatter.activeId` identyfikuje rozmowę także w przerwach
między kwestiami. `interrupt(true)` nakłada cooldown przerwanej rozmowy;
domyślne `interrupt()` zachowuje możliwość natychmiastowego powrotu.
Scena kieruje jukebox do `HubSoundscape.setJukeboxTrack(track)` i pokazuje
kwestię `say`; makaron do Heli i kosmetycznej nakładki; radio przełącza
`force('lena_radio_broadcast')` / `interrupt()`. Audio filtruje regułę
`hub_prop_used` przez `when.kind` (np. `bag` → `bagHit`).

`AmbienceSource.track?: number` (całkowite 0..2) wybiera frazę jukebox;
brak oznacza 0. `AmbienceSynth.create(kind, out, hub?, track = 0)` uwzględnia
utwór w kluczu bufora. `query('hubProps')` zwraca
`[{ id, kind, cooldownLeft, track?, angle? }]`; `hub use <id>` używa tego samego
cooldownu i efektów co E, bez wymogu bliskości. Atak działa tylko na worek
wybrany promieniem w zasięgu. Ruch worka nie ma collidera.

`neonTexts[].flicker` używa `FlickerDef`, identycznie jak napisy stacji.

## Migotanie oprawy

`FlickerDef` (`src/world/dressingSchema.ts`): `{ pattern: 'buzz' | 'fail' |
'pulse', strength?: number (0..1), periodS?: number (>0) }`. Opcjonalne
`lights[].flicker`, `signs[].flicker` i `stations[].sign.flicker` korzystają z tego
formatu. Napisy zachowują także starszy format liczbowy 0..1.
`flickerIntensity(pattern, t, seed, strength?, periodS?)` w
`src/render/city/flicker.ts` zwraca mnożnik 0..1 bez Three.js, DOM, stanu i alokacji.
Czas w sekundach pochodzi z renderu; seed źródła z osobnego `Rng` sceny.
`CityLights(defs, floorY?, seed?)` przyjmuje kosmetyczne ziarno sceny.
`HubDecor(panels, stations, fires?, hubTuning?, neonTexts?, seed?)` przyjmuje je dla napisów.
Wyłączenie `Settings.flashes` daje stałą jasność dla buzz/fail; pulse pozostaje.

## Reakcje mieszkańców na przybycie do kryjówki

`HubSceneOptions.greetings?: { last(): string | null; mark(key: string): void }`
wstrzykuje pamięć ostatniego powitania. Domyślny adapter UI
`createHubGreetings()` (`src/ui/hub/greetings.ts`) czyta i zapisuje localStorage
pod kluczem `neoryder.hub.greeted`, przechwytując błędy dostępu. Symulacja nie
korzysta z localStorage; przy jego braku powitanie nadal występuje raz na wizytę.

`hubArrivalContext(meta, greeted)` (`src/world/hubArrival.ts`) jest czystą funkcją:
zwraca `{ kind: 'firstVisit' | 'victory' | 'death', key: string }` albo `null`.
Zero runów oznacza `firstVisit` / `first-visit`; w przeciwnym razie kontekst
pochodzi z `lastRuns[0].outcome` / `runId`. Brak ostatniego runu lub klucz równy
`greeted` daje `null`.

`NpcText.reactions?` zawiera opcjonalne listy `firstVisit`, `victory`, `death`
(każda niepusta, z niepustymi tekstami). `HubArrival` przechowuje kontekst wizyty,
wybiera NPC z reakcją najbliższego pozycji startowej i losuje jego kwestię przez
`Rng` z seeda `${key}:${npcId}`. `greet()` zwraca jedną kwestię; `react(id)`
zwraca reakcję tylko przy pierwszej rozmowie z danym NPC, inną od powitania,
jeśli lista ma więcej niż jeden tekst. Zwykły licznik `NpcDialogue` pozostaje
niezależny. `HubChatter.say(line)` pokazuje pojedynczą wymuszoną kwestię bez
ograniczenia odległości, emituje `hub_chatter_line` i używa istniejących czasów
napisów; powitanie ma `conversation: 'arrival'`.

Scena po `tuning.hub.arrivalDelayS` (domyślnie 2,5 s) odtwarza powitanie i woła
`greetings.mark(key)`. Otwarta stacja lub rozmowa E odracza powitanie.
`hub arrive <firstVisit|victory|death>` resetuje stan reakcji i planuje ponownie
powitanie (klucz debug `debug:<kind>`). `query('hubArrival')` zwraca
`{ kind, key, greetedNpc: string | null, reacted: string[] } | null`.

## Otoczenie kryjówki i przejazd pociągu

`AudioSystem.setAmbience(sources | null)` przyjmuje źródła `{ kind, position: Vec3,
radiusM, gain? }` (fire, generator, drip, steam, screens, crowd, radio, jukebox,
cooking). `updateAmbience(paused = false)` aktualizuje panoramę i głośność względem
istniejącego listenera; pauza zatrzymuje grafy. `activeAmbience` zwraca aktywne
`{ kind, gain }`. `setTrainPass(progress | null, hubTuning)` steruje kosmetycznym
dudnieniem (postęp 0..1, kierunek świata zachód → wschód). Wszystkie grafy należą
do AudioSystem, korzystają ze wspólnego kontekstu i szyny ambience → master/SFX.
`setAmbience(null)` sprząta również graf pociągu; `dispose` zwalnia całość.

`hubAmbienceSources(layout, extra, audioTuning?)` jest czystą funkcją ekstrakcji;
ekrany w promieniu `ambienceScreenClusterM` są łączone w skupiska. `loadAmbience`
waliduje jawne źródła z `src/data/hub/ambience.json` schematem zod.

`HubTrain` (bez Three.js/DOM) przyjmuje Rng i tuning kryjówki. `step(dt)` odmierza
czas symulacji; `force()` rozpoczyna przejazd natychmiast i losuje kolejny odstęp.
Na początku emituje `hub_train_passed: { durationS: number }` przez EventBus;
w szczycie emituje istniejące `camera_shake` (ustawienie screenShake respektuje
FpsCamera). `progress` udostępnia postęp lub null. Moduł sceny `HubSoundscape`
łączy harmonogram, audio i pulę pyłu, rejestruje `hub train`, udostępnia query
`hubAmbience` i sprząta przy opuszczeniu sceny. Render interpoluje stan pyłu;
harmonogram i ruch cząstek działają wyłącznie w step.

### Spadek napięcia w kryjówce

`HubPowerDip` (`src/world/hubPowerDip.ts`, bez Three.js/DOM) przyjmuje Rng, tuning
kryjówki i EventBus. `step(dt)` odmierza czas symulacji i zwraca true w kroku powrotu
prądu; `force()` zaczyna spadek natychmiast i losuje kolejny odstęp. Na początku emituje
`hub_power_dip: { durationS: number }`. `level(flashes)` zwraca poziom zasilania 0–1
(`powerLevel(ageS, tuning, flashes)` to czysta krzywa), `active`, `nextInS`.
`loadHubEvents(data, npcIds)` waliduje `src/data/hub/events.pl.json` (zod, `npc` musi istnieć
w `npcs.pl.json`); `pickDipComment(...)` wybiera najbliższego NPC z wpisem.

Mnożnik jasności: `setPowerLevel(level)` / `getPowerLevel()` w `src/render/powerLevel.ts`
(0–1, domyślnie 1). Mnożą go z migotaniem: `CityLights` (światła i plamy), `SignRenderer`,
`LampCones`, napisy `HubDecor`, wspólne materiały `neon_*`/`light_white` (przez
`syncMaterials`) i ekrany `mat_screen_*`. Audio: `AudioSystem.setPowerLevel(level)` ścisza
źródła `generator`, `screens`, `jukebox`, `radio` proporcjonalnie. Scena ustawia oba w `render`
i zeruje do 1 w `dispose`.

## Napisy oprawy kryjówki

`HubLayout.neonTexts?` zawiera `{ text, position, size, yaw, color }[]` (kolory hex z palety Neon Noir).
`HubDecor` przyjmuje tę tablicę jako piąty argument, po `hubTuning`; napisy są kosmetyczne,
bez colliderów i korzystają z tego samego rysowania co etykiety stacji.

## Z16 — Wieżyczka, Dron-haker i zagłuszenie

`PowerDeps.statuses?: StatusQuery` udostępnia statusy właściciela mocy.
`PowerBase.use()` sprawdza `has(owner, 'jammed')` przed kosztem i odnowieniem;
odmowa emituje `power_denied.reason: 'jammed'`, nie zużywa energii ani odnowienia.
Sceny przekazują istniejący `StatusSystem` w `createPowerFromDefinition`.
Blokada dotyczy nowych aktywacji, nie kończy już działających efektów.

Opcjonalne pola wroga: `stationary`, `hack { hackCooldownS, hackTelegraphS,
durationS }`, `drone.antenna`. `turret` wymaga `stationary: true`,
`grabbable: false`, `knockbackResist: 1`, danych strzeleckich i `body`;
`hacker` wymaga `hack`, `drone` i danych strzeleckich.
Haker nakłada `jammed` przez `DamageInfo.statuses` po trafieniu wiązką
(raycast do hurtboxa gracza, osłony blokują). Obrażenia przerywają telegraf
i uruchamiają pełne odnowienie; śmierć i Chwyt również przerywają atak.
HUD reaguje na `status_applied`/`status_expired` gracza.

## Warsztat modułów broni

`moduleSchema` / `loadModuleDefinitions(data[])` / `moduleDefinitions` w
`src/progression/moduleSchema.ts` walidują `src/data/modules/*.json`:
`{ id, name, description, tags: string[], weaponKinds?: string[], patches }`.
`weaponKinds` ogranicza `WeaponDefinition.fireMode`; brak ograniczenia dopuszcza każdy tryb.
Łatki modułu mają `{ op, path, value }` bez `target`. `modulePatches(loadout)`
nadaje im `target: weapon:<id>` w kolejności broni i slotów, bez mutacji danych.
`RoomScene` przekazuje do `resolveLoadout` kolejno talenty, moduły i `options.patches`.

`append` wymaga tablicy `value` i dopisuje jej elementy do tablicy pod `path`;
nieobecne pole opcjonalne zaczyna od `[]`. Wynik musi przejść schemat i zachować
całą zapisaną tablicę (nieznane pola i ścieżki są błędem).

`LoadoutChoice.modules: Record<string, string[]>` mapuje id broni na uporządkowane id
modułów. `loadoutChoiceSchema` uzupełnia brakujące pole przez `{}` w zapisach v3,
bez zmiany wersji. Pełny `Loadout` ma opcjonalne `modules`; `MetaManager.loadout()`
zwraca ich głęboką kopię, a `RunManager.newRun` zamraża ją razem z ekwipunkiem.
`MetaManager.setLoadout` wymaga odblokowanych `module:<id>`, broni obecnej w zestawie,
zgodnego `weaponKinds`, braku duplikatów i limitu `progression.moduleSlotsPerWeapon`
(startowo 2). Ten sam moduł może być zamontowany w kilku broniach.
`unlockIdSchema` weryfikuje prefiks `module:` przeciw `moduleDefinitions`.

Bronie pociskowe mają opcjonalne `ricochets` (licznik odbić od świata).
`pierceCount` (liczba trafionych celów, domyślnie 1) i `pierceFalloff` (domyślnie 0)
są dostępne także poza trybem `pierce`. `fireProjectile` przenosi je do
`ProjectileSpec.pierce`, a `ricochets` do `ProjectileSpec.ricochets`.
Pocisk odbija kierunek i prędkość zgodnie z normalną ściany, zużywa jedno odbicie
i kontynuuje pozostały dystans kroku. Bez odbić kolizja świata kończy lot jak dotąd.
Odbicie nie zmienia właściciela, obrażeń ani pozostałego czasu życia.

Nadprzewodnik używa wariantu +20% `projectileSpeed`, −15% `heatPerShot`:
istniejące efekty synergii nie dają bonusu do obrażeń tego samego celu z `overload`.
Warsztat pokazuje grupę Moduły i selektory slotów przy wybranych broniach;
zmiana wywołuje `setLoadout` i zapis meta. Usunięcie broni usuwa jej przypisania.

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
  'maxStamina', 'staminaRegen', 'extraJumps', // bazy sceny: 100, 30/s, 0
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

Wytrzymałość: `PlayerController` przyjmuje opcjonalny szósty argument z bazami
`Stats` (domyślnie `maxStamina: 100`, `staminaRegen: 30`, `extraJumps: 0`).
`stats` kontrolera zasila `stamina: PlayerStamina` (`current`, `max`, `spend(n)`,
`set(n)`, `step(dt)`). Kontroler wykonuje krok zasobu w czasie gracza i publikuje
`stamina_changed` po zmianie wartości lub maksimum oraz na pierwszym dodatnim
kroku (dla HUD scen debug utworzonego po kontrolerze); `set()` publikuje również
stan początkowy po utworzeniu HUD. `stamina_denied` sygnalizuje brak pełnego kosztu
dashu/skoku w powietrzu. `PlayerState.airJumpsUsed` zastępuje `doubleJumpUsed`;
limit to `floor(stats.get('extraJumps'))`. Zużycie sprintu następuje tylko przy
faktycznym przesunięciu poziomym poza dashem i slide. Po zejściu do zera sprint
wraca dopiero powyżej `tuning.player.sprintMinStamina`. Wytrzymałość nie należy
do `RunState` ani `exportState()` pokoju; każdy pokój zaczyna z pełną pulą.

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
export const SAVE_VERSION = 5;

export interface MetaSave { saveVersion: number; createdAt: number; updatedAt: number; meta: MetaState }
export interface RunSave  { saveVersion: number; seed: string; startedAt: number; run: RunState }

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

export interface Settings {
  mouseSensitivity: number; fov: number; masterVolume: number;
  sfxVolume: number; musicVolume: number; invertY: boolean;
  screenShake: number; flashes: boolean; quality: 'low' | 'medium' | 'high';
  bindings: Partial<Record<Action, string>>;
}
export function loadSettings(storage?: Storage): Settings;              // localStorage, wartości domyślne przy braku/błędzie
export function saveSettings(s: Settings, storage?: Storage): void;
```

Ustawienia Z6: czułość 0,1–5 (domyślnie 1), FOV 60–110 (90), głośności
0–1 (master 1, SFX 1, muzyka 0,7), `invertY=false`, `screenShake=1` (0–1),
`flashes=true`, `quality='high'`, `bindings={}`. Każde błędne lub brakujące pole
otrzymuje własną wartość domyślną. Nieznane akcje i zarezerwowane kody są pomijane.
Bez argumentu `Storage` w przeglądarce `loadSettings()` zwraca wspólny, mutowalny
obiekt sesji. Ekrany zapisują go przy każdej zmianie; istniejące kontrolery
odczytują zmiany bez przeładowania. Wywołanie z `Storage` zawsze dekoduje osobny obiekt.
Nie dodano zdarzenia do `GameEvents`. `main.ts` ustawia bazowy FOV w `tuning.camera.fov`
przy starcie i po zmianie ustawień. `FpsCamera` mnoży amplitudę traumy przez
`screenShake`, a `PlayerController` odwraca znak pionowego ruchu dla `invertY`.
`AudioSystemOptions.sfxVolume?: () => number` (domyślnie 1) mnoży głośność główną;
`AudioSystem.updateVolume()` aktualizuje gain także dla trwających dźwięków.
`quality` i `musicVolume` są obecnie wyłącznie zapisywane.

Meta i run mają osobne tablice migracji (`metaMigrations`, `runMigrations`); szczegóły v3 w sekcji „Kontrakty F4”.

Wczytany zapis z `saveVersion < SAVE_VERSION` jest migrowany; z `saveVersion > SAVE_VERSION` — odrzucany z ostrzeżeniem (nie nadpisujemy zapisu z nowszej wersji gry).

## Wejście — `src/core/input/`

```ts
export type Action = 'moveForward' | 'moveBack' | 'moveLeft' | 'moveRight'
  | 'jump' | 'sprint' | 'dash' | 'crouch' | 'attack' | 'block' | 'swap' | 'power'
  | 'power2' | 'weapon1' | 'weapon2' | 'weapon3' | 'bladeThrow';
export type BindingOverrides = Partial<Record<Action, string>>;
export function resolveBindings(overrides?: BindingOverrides): Record<string, Action>;
export function assignBinding(overrides: BindingOverrides, action: Action, code: string): BindingOverrides;
export function isBindingCode(code: string): boolean;

export interface InputSnapshot {
  held: ReadonlySet<Action>;
  pressed: ReadonlySet<Action>;   // wciśnięte od poprzedniego kroku symulacji
  released: ReadonlySet<Action>;
  lookDelta: { x: number; y: number }; // piksele myszy od poprzedniego kroku
}

export class Input {
  constructor(target: HTMLElement, getBindings?: () => BindingOverrides);
  clear(): void; // zeruje przytrzymane akcje i ruch myszy przy pauzie/rebindzie
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
  register(id: EntityId, health: Health, opts?: { stats?: Stats; invulnMs?: () => number; outgoing?: () => number }): void; // outgoing źródła przed guard/damageTaken celu, poza #hazard i #status; domyślnie 1
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
stamina_changed: { id: EntityId; current: number; max: number };
stamina_denied: { user: EntityId; action: 'dash' | 'doubleJump' };
power_denied: { power: string; user: EntityId; reason: 'no_energy' | 'cooldown' | 'too_heavy' | 'out_of_range' | 'jammed' };
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
  apply(target: EntityId, app: StatusApplication, source: EntityId | null): boolean; // czy nałożono status
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
  statuses?: StatusQuery;                         // blokada aktywacji przez jammed (Z16)
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

Z5: `BladeDeps.attackSpeed?: () => number` i `WeaponDeps.attackSpeed?: () => number`
odczytują mnożnik szybkości (brak = 1), ograniczony przez `tuning.melee.attackSpeedMin/Max`.
`SynergyContext.stats: Stats | readonly Stats[]` — czasowe modyfikatory trafiają do wszystkich instancji.

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
// efekty: add_energy | cool_weapon | stat_modifier_timed | chain_on_hit | heal | explode | apply_status_area (ADR 0004 pkt 5)
```

Z4: `SynergyContext` dodaje opcjonalne `heal(amount: number): void`, `userPosition(): Vec3 | null` i `applyStatus(target: EntityId, app: StatusApplication): boolean` (czy nałożono status); brak wymaganej funkcji pomija efekt bez wyzwolenia i odnowienia. `heal` wymaga dodatniego `amount`; `explode` przyjmuje `at: 'target' | 'user'`, dodatni `radiusM`, nieujemne `damage`, opcjonalny nieujemny `knockback` i `tags`, zadaje obrażenia w promieniu ze źródłem użytkownika i tagiem `#synergy`, emituje `explosion`. `apply_status_area` przyjmuje takie samo `at`, nieujemny `radiusM` (0 = wyłącznie cel zdarzenia), istniejący `status`, dodatni `durationS` i opcjonalne całkowite `stacks >= 1`. `at: 'target'` jest dozwolone tylko przy `enemy_killed` i `damage_dealt`. `when.targetIsUser?: boolean` jest dozwolone tylko przy `damage_dealt`: `true` wybiera obrażenia otrzymane przez użytkownika, `false` lub brak zachowuje filtr `source === user`. Wyzwalacze implantów z nowymi efektami wymagają `cooldownS`. Scena przekazuje źródło użytkownika do `StatusSystem.apply` i emituje `health_changed` po leczeniu.

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
// tuning.hands: swapS / swapBufferS — czas gracza; parametry renderu opisane w systems/hands.md.
// Arena.heldView(): HeldItemView; query('heldItem') zwraca ten sam stan.
// Komenda areny: hold blade|gun — natychmiastowy reset samego stanu ręki.
```

Arena rozdziela wejście przed PlasmaBlade.step i Weapon.step. W zamianie blokuje
atak, blok i rzut ostrzem oraz spust; PPM (w zamianie) i środkowy przycisk przerywają zamianę,
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

### Boss (F3-16) — `src/enemies/boss.ts`

`Boss` implementuje `Enemy`; `EnemyManager.spawn('securityChief', position)` korzysta
z istniejących `EnemyDependencies` (wymagane `projectiles`). `boss_spawned` emituje
po rejestracji zdrowia; `boss_phase` tylko przy zmianie fazy, numerowanej od 1.
`phase` zwraca numer fazy; `setPhase(n): boolean` to debug: ustawia fazę i jej HP,
przerywa atak, uruchamia `tuning.enemies.phaseShiftS` i emituje `health_changed`.
`enemySchema.boss` zawiera nazwę, skalę modelu, wylot pocisków i fazy
`{ hpThreshold, patterns }`; progi to malejące ułamki maksymalnego HP, pierwszy 1.
Wzorce `slam` i `fan` mają własne czasy zapowiedzi, regeneracji i odnowienia.
`slam` emituje `enemy_telegraph.kind: 'slam'`, `fan` — `'aim'`; faza przerywa zapowiedź.
Obrażenia przechodzą przez `DamageSystem`, limit progu działa po modyfikatorach.
Scena `boss-test` oraz `ai-test` obsługują komendę `boss phase <n>`.

**F3-17.** Wzorce `summon` (`enemyId`, `count`, `maxMinions`, `placement`, `radiusM`) i `shield`
(`durability`, `durationS`, `stunS`, `vulnerableS`, `vulnerableMult`); telegrafy
`enemy_telegraph.kind` = `'summon'` / `'shield'`. Nowe opcjonalne pola
`EnemyDependencies`: `spawnEnemy(id, position): Enemy` i `spawnPoints: Vec3[]` — wypełnia je
`EnemyManager` (`EnemyManagerOptions.spawnPoints`). `Boss`: `shield` (wytrzymałość),
`minionCount`, `forcePattern(kind): boolean` (debug). Brak nowych zdarzeń: złamanie tarczy
emituje `enemy_stunned`, `hitstop` i `camera_shake`. `RoomScene` w trybie bossa (`layout.bossEnemy`)
emituje `room_cleared` po `enemy_killed` bossa; `query('boss')`. Opis: `docs/systems/enemies.md`.

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
| `boss_spawned`     | `{ id: EntityId; name: string; maxHealth: number; phaseThresholds: number[] }`                       | `Boss`          |
| `boss_phase`       | `{ id: EntityId; phase: number; phases: number }`                         | `Boss`          |
| `boss_shield`      | `{ id: EntityId; current: number; max: number }` (0 = brak tarczy)        | `Boss`          |
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
boss_spawned: { id: EntityId; name: string; maxHealth: number; phaseThresholds: number[] };
boss_phase: { id: EntityId; phase: number; phases: number };
boss_shield: { id: EntityId; current: number; max: number };
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
// threatMultiplier?, bossEnemy? (F3-17, tylko type 'boss'), props? ({ kind, position }[]), puzzle? (Record<string, unknown>).
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

### Zapis runu (F3-06) — `src/core/save.ts`

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



`SAVE_VERSION = 2`. `RunSave` rozszerzone o `run: RunState` (walidowane przez `runStateSchema` z `src/world/run.ts`).
Migracja 1→2 jest neutralna dla `MetaSave`, natomiast szkielet `RunSave` v1 (bez pola `run`) traktuje jako brak aktywnego runu (`loadRun()` zwraca `null`). Zapisy z `saveVersion > SAVE_VERSION` pozostają nietknięte (`isFuture`), a uszkodzone zapisy zwracają `null` z ostrzeżeniem.

### Render dłoni FPP

`HandRig(side: 'R' | 'L')` (`src/render/handRig.ts`) udostępnia `root: Group`,
`load(loadModels?: boolean): Promise<void>`, `setPose(from, to, t)` (nazwy póz
z walidowanych danych), `socketMatrix(name): Matrix4` względem root oraz `dispose()`.
`placeAt(itemMatrix, socket)` ustawia root jako itemMatrix × inverse(socketMatrix).
Modele i ich geometrie należą do cache; rig zwalnia tylko własne materiały i bryłę zastępczą.
`FppBlade` zawiera rig prawej dłoni i rig lewego ostrza bliźniaczego;
`FppBlaster` zawiera prawą dłoń i udostępnia `supportMatrix(): Matrix4 | null`
w przestrzeni świata dla lewej dłoni (null przy braku węzła support).
`FppOffhand(bus, owner, tuning)` obsługuje lewą dłoń wolną/podpierającą,
`place(cameraMatrix, frameDt, shown, twin, supportMatrix)` odczytuje wyłącznie
stan renderu i zdarzenie `power_used` właściciela. Bliźniacze blokują gest mocy.
`FppMotion.place(cameraMatrix, frameDt, horizontalSpeed, heldView?)` zwraca
macierz kamery z opadem zamiany i kołysaniem; nie zmienia kamery ani symulacji.
Sceny wywołują go raz na render, przekazując tę samą macierz przedmiotom i dłoniom.

### Host runu (F3-07)

`src/scenes/run.ts`: `RunScene` implementuje `Scene`, rejestr `?scene=run`.
Opcje konstruktora: `params?: URLSearchParams`, `screens?: RunScreens`,
`save?: RunSavePort`, `planner?: RoomPlanner`, `sector?: SectorDefinition`,
`rooms?: ReadonlyMap<string, RoomDefinition>`, `createRoom?: RunRoomFactory`,
`implantDefinitions?: ReadonlyMap<string, ImplantDefinition>`.
`RunRoom` to `Scene` z `clear()` i `exportState(): Pick<RunState, 'hp' | 'energy'>`.
Fabryka dostaje definicję pokoju, kopię RunState i WavesDefinition.
`RunScreens` (`src/ui/runScreens.ts`) udostępnia `show(view, actions)`, `hide()`,
`dispose()`; view zawiera ekran, kopię stanu, dostępne węzły, podsumowanie i stan ładowania.
Akcje: `selectNode(id)`, `next()`, `menu()`. `RunSavePort` udostępnia asynchroniczne
`loadRun(): Promise<RunState | null>`, `saveRun(state, ended?): Promise<void>`, `clearRun(): Promise<void>`
oraz opcjonalne `loadEnded(): Promise<RunEnded | null>`. `RunSave.ended?: RunEnded` (`{ runId, summary }`,
`src/core/save.ts`) oznacza zakończony, nierozliczony run; pole jest opcjonalne, więc zapisy bez niego
wczytują się jak dotąd (bez zmiany `SAVE_VERSION`). `continue=1` z `ended` pokazuje podsumowanie i rozlicza
run zamiast go wznawiać; `RunManager.restoreEnded(state, summary)` odtwarza ekran `summary` bez `run_ended`.
Podsumowanie: `RunScreenView.rewardError?: 'save' | 'apply' | null`, `rewardPending?`, `rewardAlreadySaved?`,
`leaving?`; akcje `retrySave?()` (błąd zapisu) i `abandonReward?()` (błąd naliczenia, z potwierdzeniem).
Rozliczenie czyta meta przez `loadMetaManagerStrict(store)` (`src/progression/metaSave.ts`): brak zapisu = stan
startowy, zapis nieczytelny = wyjątek (opcjonalne `SaveStore.loadMetaStrict()`); `loadMetaManager` bez zmian.
Nowy run z nierozliczonym runem w zapisie najpierw go rozlicza, a przy błędzie zostaje na jego podsumowaniu.
`RunSceneOptions.navigate?(url)`: wyjście z podsumowania czeka na kolejkę zapisów; `continue=1` bez zapisu
wraca do menu. `tuning.run.rewardSaveTimeoutS`: po tym czasie wiszące rozliczenie można ponowić.
Domyślny port opakowuje IndexedDB SaveStore v2 przez `createRunSavePort(store?)` z `src/ui/runSave.ts`. Operacje zapisu są kolejkowane.
`RunScene.whenReady()` czeka na ładowanie pokoju i kolejkę zapisu (przydatne w testach).
Query: `screen`, `runState`, `map`, `room` (id układu lub null), `runLog`,
`loading`, `runError`, `saveError`, `savePending`; pozostałe zapytania są delegowane do pokoju.
Przejścia po `room_cleared` / `run_ended` następują po zakończeniu stosu zdarzenia,
bez zwalniania świata podczas kroku symulacji.

## Wspólny widok FPP

`FppViewModel` (`src/render/fppViewModel.ts`) posiada ostrze, broń, wolną dłoń
i ruch rąk. Konstruktor przyjmuje bus, właściciela i opcje definicji ostrza,
modeli broni oraz tuningu. `load(loadModels)`, `root`,
`setBladeDefinition(def)` i `dispose()` obsługują cykl życia.
`place(cameraMatrix, frameDt, { blade?, held, horizontalSpeed, visible? })`
jest wywoływane raz na klatkę; `held` przyjmuje `HeldItemView` albo stałe
`blade`/`gun` dla scen testowych. `blade` to `BladeView` wymagany przy ostrzu.
Getter `beamOrigin` zwraca pozycję świata root broni, jak dotychczas w Arenie.
Moduł zachowuje kolejność: ruch, ostrze, widoczność, broń, wolna dłoń.

### Nagrody i ekonomia (F3-10/11)

`SynergySystem.setImplantTriggers(ImplantSystem.triggers())` aktualizuje wyzwalacze
wykonywane wspólnym mechanizmem efektów i odnowień. `setTags` zachowuje krotność.
`offerReward(state, type, rng, sector, definitions, bus?)` zwraca id ofert;
`stockShop` zwraca implanty z cenami. `RunEconomy` łączy te moduły z RunManager:
`offerReward`, `stockShop`, `chooseReward`, `buy`, `rest`, `upgradeOptions`, `maxHealth`.
Oferty są przechowywane do opuszczenia węzła; zakup i odpoczynek weryfikują ekran.

### Menu i mapa (F3-13)

`src/ui/mainMenu.ts`: `MainMenu({ root, save?, navigate?, params? })`,
`ready: Promise<void>` (odczyt dostępności kontynuacji), `dispose()`.
Menu używa SaveStore; przejścia prowadzą przez URL.
`src/ui/mapScreen.ts`: `MapScreen(parent)`, `show(state, onSelect)`, `hide()`,
`dispose()`. Dostępność wynika wyłącznie z `currentNodeId.next` (na starcie
pierwsza warstwa). UI przekazuje id do istniejącej akcji RunScene; nie zmienia stanu.
`createRunSavePort(store?: SaveStore): RunSavePort` opakowuje pełny RunState
w `{ saveVersion: SAVE_VERSION, seed, startedAt: startedAtMs, run }`.
Po udanym zapisie mapy RunScene zastępuje URL przez `continue=1`, aby
odświeżenie strony wznawiało zapis; seed/loadout zostają usunięte z URL.


## Motywy i miejska oprawa renderu (Neon Noir)

- `Theme` / `themeSchema` (`src/render/themeSchema.ts`): `{ id, render, rain }`.
  `render` zawiera walidowany komplet parametrów oprawy `tuning.render`;
  `rain: { enabled, density, speed, windX, color, opacity }` jest wyłącznie danymi.
- `themeDefinitions`, `loadThemeDefinitions(data)`, `resolveTheme(id?, search?)`
  (`src/render/themes.ts`): eager JSON, domyślnie `white`, URL `theme` ma pierwszeństwo.
  Nieznany id zgłasza ostrzeżenie i wybiera `white`.
- `applyTheme(theme): () => void` ustawia `tuning.render`; zwrócone idempotentne
  zamknięcie przywraca poprzednie wartości. Scena posiada to zamknięcie do dispose.
- Pokoje i arena przepuszczają `dressingFields`; `block.material` jest opcjonalnym
  `blockMaterialSchema`. `theme` dopuszcza camelCase, wymagany przez `neonStreet`.
  `city_*` wskazuje `/assets/models/city/<model>.glb`; `decor` używa tej samej bazy,
  bez kolizji. Brak modelu zostawia blok lub pomija dekorację z ostrzeżeniem raz na plik.
- Rejestr materiałów obsługuje `concrete`, `asphalt`, `metal`, `facade`, `trim`,
  `glass`, `cable`, `paint`, `lacquer`, `rust`, `corrugated`, `plastic`, `hivis`,
  `rubber`, `wood`, `fabric`, `machine`, `paving`, `plaster`, `hazard`
  (`urbanKinds` w `src/render/urbanMaterials.ts`, wygląd w `urbanLooks`),
  `neon_amber|green|violet|blue|white`, `light_white`.
  Nazwa glTF to `mat_<kind>`. Nadruki UV `mat_label_<x>` / `mat_screen_<x>`
  zwraca `printMaterial(name)` (`src/render/propPrints.ts`; `isPrintMaterialName`
  sprawdza nazwę), tekstury ładuje `assetTexture(folder, id)`
  (`src/render/surfaceTextures.ts`; foldery `surfaces`, `labels`, `screens`).
  `BLOCK_MATERIALS` (`src/world/dressingSchema.ts`, pole `block.material`)
  dopuszcza: `world`, `concrete`, `asphalt`, `metal`, `facade`, `trim`, `glass`,
  `paving`, `plaster`, `corrugated`, `rust`, `hazard`. Parametry motywu:
  `cityBumpStrength`, `cityHazardPeriod` (patrz `docs/systems/render.md`).
  `userData.wetness` materiału oznacza odbicia
  (asphalt 1, paving 0.45, concrete 0.22, plaster 0.1), `userData.bloomMaterial` opcjonalnie dostarcza
  materiał samej emisji dla maski bloomu i odbić (okna fasad).
- `SceneAtmosphere(three, themeId, seed, floorY, panoramaExclusion?)` nakłada motyw, ustawia
  `three.userData.reflectionFloorY`, posiada panoramę i przywraca stan w dispose.
  Opcjonalny `panoramaExclusion` (`Box3` w przestrzeni świata) wyklucza bryły
  panoramy przecinające obszar poziomu liniowego.
  `sync(dt)` odświeża oprawę; wyłącznie render, bez zmian symulacji.
- Pola `signs/lights/decals/ambientFx` pozostają danymi dla integratora.

## Kontrakty F4 (zatwierdzone 2026-11-15, ADR 0007)

Architektura i decyzje: `docs/adr/0007-meta-progres-f4.md`. Zadania: `docs/issues/F4/README.md`. Zadanie 01 dostarcza wyłącznie typy, zdarzenia, schematy, dane startowe i zapis v3; logikę zakupów, nagród i talentów dopisują zadania 02–05.

### Typy meta — `src/core/metaTypes.ts`

```ts
export const TREE_IDS = ['blade', 'resonance', 'gunner', 'hybrid'] as const;
export type TreeId = (typeof TREE_IDS)[number];
export const HUB_STATION_IDS = ['talents', 'workshop', 'missions', 'arena'] as const;
export type HubStationId = (typeof HUB_STATION_IDS)[number];

interface LoadoutChoice { blade: string; weapons: string[]; powers: string[]; modules: Record<string, string[]> }
interface RunRewards { xp: number; data: number; cores: number }
interface MetaRunRecord {
  runId: string;          // `${seed}:${startedAtMs}`
  outcome: RunOutcome;
  elapsedS: number;
  layerReached: number;
  threatLevel: number;
  rewards: RunRewards;
}
interface MetaState {
  xp: number; data: number; cores: number;
  talents: string[];      // kupione węzły drzewek
  unlocks: string[];      // 'weapon:<id>' | 'power:<id>' | 'blade:<id>' | 'slot:<weapon2|weapon3|power2>'
  loadout: LoadoutChoice;
  threat: { max: number; selected: number };
  stats: { runs: number; victories: number; deaths: number; kills: number; bestVictoryS: number | null };
  lastRuns: MetaRunRecord[];   // najnowsze pierwsze, najwyżej MAX_LAST_RUNS = 10
  appliedRunIds: string[];     // idempotencja nagród, najwyżej MAX_APPLIED_RUN_IDS = 20
}
interface DefinitionPatch {
  target: `weapon:${string}` | `power:${string}` | `blade:${string}`;
  op: 'set' | 'add' | 'mul' | 'append';
  path: string;          // np. 'jumps', 'combo.2.knockback', 'statuses'
  value: unknown;        // liczba skończona dla add/mul; dowolny JSON dla set
}
// TalentTree, TalentNode, TalentEffects: typy inferowane ze schematu zod (src/progression/talentSchema.ts),
// re-eksportowane z metaTypes.ts.
```

### Schematy zod i dane — `src/progression/`, `src/data/meta/`

| Plik | Eksport | Dane |
| --- | --- | --- |
| `progressionSchema.ts` | `progressionSchema`, `loadProgression(data)`, `progression`, `createStarterMetaState(starter?)`, `rewardRulesSchema`, `RewardRules` | `src/data/meta/progression.json`: `starter` (bez historii: xp 0, data, cores, talents, unlocks, loadout, threat), `levels.xpToNext` (długość = limit poziomu − 1; start: 19 progów dla limitu 20), `rewards` (`xpPerRoom`, `xpPerElite`, `xpVictory`, `dataPerRoom`, `dataPerKill`, `dataVictory`, `coresPerElite`, `coresVictory`) |
| `unlocksSchema.ts` | `unlocksSchema`, `unlockIdSchema`, `loadUnlockDefinitions(data)`, `unlockDefinitions` (`Map` po id) | `src/data/meta/unlocks.json`: tablica `{ id, cost: { data?, cores? }, minLevel? }` |
| `threatSchema.ts` | `threatSchema`, `loadThreatLevels(data)`, `threatLevels` | `src/data/meta/threat.json`: tablica poziomów 0–10 `{ level, name, enemyHealth, enemyDamage, budgetMult, rewardMult, victoryCores }` |
| `talentSchema.ts` | `talentTreeSchema`, `talentNodeSchema`, `loadTalentTrees(data[])`, `talentTrees` (z `src/data/talents/*.json`, na razie puste) | `src/data/talents/*.json` (zadanie 04) |
| `patchSchema.ts` | `definitionPatchSchema`, `loadDefinitionPatch` | — |
| `metaStateSchema.ts` | `metaStateSchema` (strukturalna walidacja zapisu) | — |

- `unlockIdSchema` wymaga formatu `weapon:<id>`, `power:<id>`, `blade:<id>` (id istnieje w `weaponDefinitions` / `powerDefinitions` / `bladeDefinitions`) albo `slot:weapon2|weapon3|power2`; `unlocksSchema` odrzuca duplikaty, koszt bez Danych i Rdzeni oraz wartości ujemne.
- `threatSchema`: poziomy kolejne od 0 bez luk; poziom 0 jest neutralny (`enemyHealth` 0, `enemyDamage` 0, `budgetMult` 1, `rewardMult` 1). `enemyHealth` i `enemyDamage` to ułamki (0.1 = +10%).
- `talentTreeSchema`: `tier` 1–4, `cost` 1–3, `tierThresholds` długości 4 i niemalejące, id węzłów unikalne; `effects.modifiers` i `effects.triggers` reużywają `implantModifierSchema` i `implantTriggerSchema`, `effects.patches` to `definitionPatchSchema`. `loadTalentTrees` sprawdza unikalność id w całym komplecie i istnienie węzłów z `requires`; działa na pustym zbiorze.
- `definitionPatchSchema`: `op` ∈ `set | add | mul`, `target` z prefiksem `weapon:` / `power:` / `blade:`, `add` i `mul` tylko z liczbą skończoną.
- `starter` w `progression.json` zawiera wyłącznie istniejące odblokowania, a ekwipunek startowy tylko z nich. `createStarterMetaState()` składa pełny `MetaState` (zerowe `stats`, puste `lastRuns` i `appliedRunIds`).

### `RunState` i `RunSummary` (rozszerzenie `src/core/runTypes.ts`)

```ts
interface RunState {
  // ...pola F3...
  loadout: Loadout;      // pełna kopia ekwipunku z chwili startu runu (typ z src/progression/loadout.ts)
  talents: string[];     // id talentów zamrożone na start, bez duplikatów
  threatLevel: number;   // zamrożony na start; 0 = F3
}
interface RunSummary {
  // ...pola F3...
  elitesCleared: number; // ukończone węzły typu elite
  threatLevel: number;
}
```

`RunManager.newRun(seed, loadoutId = 'classic', options?: NewRunOptions)` (`NewRunOptions`: `loadout?`, `talents?`, `threatLevel?`) bez opcji wypełnia `loadout` kopią presetu `loadoutDefinitions.get(loadoutId)` (nieznany preset = błąd), `talents: []`, `threatLevel: 0`. `RoomScene` czyta ekwipunek z `run.loadout` (i sprawdza istnienie ostrza, broni i mocy); `loadoutId` zostaje etykietą do podsumowania. `elitesCleared` liczy ukończone węzły `elite` ze zbioru węzłów ukończonych (spójnie z `roomsCleared`).

### Zdarzenia dopisywane do `GameEvents` (F4-01) — `src/core/events.ts`

```ts
meta_rewards: { runId: string; rewards: RunRewards; levelBefore: number; levelAfter: number };
level_up: { level: number };
talents_changed: { talents: readonly string[] };
unlock_purchased: { id: string };
loadout_changed: { loadout: LoadoutChoice };
threat_selected: { level: number };
hub_station_opened: { station: HubStationId };
hub_chatter_line: { conversation: string; npc: string; text: string };
```

Emitują: `MetaManager` (zdarzenia meta), scena kryjówki (`hub_station_opened`) i `HubChatter` (`hub_chatter_line`).

### Naszywki Iskry — osiągnięcia (S4b-01)

Opis systemu: `docs/systems/achievements.md`.

```ts
// src/core/metaTypes.ts
interface AchievementsState { unlocked: string[]; counters: Record<string, number> }
interface MetaState { /* ...pola F4... */ achievements: AchievementsState }

// src/core/runTypes.ts
interface RunAchievementProgress { counters: Record<string, number>; flags: string[] }
interface RunSummary { /* ... */ achievements?: RunAchievementProgress }

// src/progression/achievementsSchema.ts
achievementDefinitions: ReadonlyMap<string, AchievementDefinition>;  // z src/data/meta/achievements.json
loadAchievements(data: unknown): AchievementDefinition[];

// src/progression/achievementTracker.ts
class AchievementTracker {
  constructor(bus: EventBus, options: { base: AchievementsState; clock: () => number; active?: () => boolean });
  get tracked(): RunAchievementProgress;                 // przyrosty ze zdarzeń (do RunSummary.achievements)
  restore(progress?: RunAchievementProgress): void;      // z RunState.achievementProgress przy continue=1
  setBase(base: AchievementsState): void;                // po rozliczeniu zostawionego runu
  dispose(): void;
}

// src/progression/meta.ts
interface ApplyRunResult { /* ... */ achievements: { id: string; reward: { data: number; cores: number } }[] }
MetaManager.hasAchievement(id: string): boolean;
MetaManager.debugGrantAchievement(id: string): void;     // bez nagrody, konsola debug
// UnlockDefinition.requiresAchievement?: string — buyUnlock rzuca „Wymagana naszywka: <tytuł>.”
```

`RunState.achievementProgress?` (opcjonalne) trzyma przyrosty trackera w zapisie runu. `conquest_captured` ma teraz `owner: 'player' | 'enemy' | 'neutral'` i `owners` (migawka A/B/C); `conquestUi` ignoruje `neutral`. Zdarzenia: `achievement_earned: { id: string }` (tracker w trakcie runu, komunikat w HUD) i `achievement_unlocked: { id: string }` (`MetaManager`: rozliczenie runu, zakup, debug). Komenda debug `achievement grant <id>`, zapytania `query('achievements' | 'runAchievements')`. Zapis: `SAVE_VERSION = 5` (migracja meta 4→5: puste osiągnięcia).

### Kryjówka — `src/ui/hubScreens.ts`, `src/world/hubSchema.ts`, `src/world/hubStations.ts` (F4-07)

Szczegóły: `docs/systems/hub.md`.

NPC: `HubNpcDef.scale?` (0,55–1,15, domyślnie 1) oraz `route?`:
`{ points: {x,z}[]; mode?: 'loop'|'pingpong'; speedMS?; pauseS?; moveAnimation?; pauseAnimation? }`.
Początek trasy musi równać się `position`; trasy nie dotyczą siedzących NPC.
`src/world/hubNpcs.ts`: `createNpcRouteState(npc)` i `stepNpcRoute(state, route, dt, ctx)`
mutują wyłącznie serializowalny stan; kontekst zawiera gracza, aktywność rozmowy i `tuning.hub`.
`NpcRuntime` przechowuje bieżącą/poprzednią pozycję i kierunek; `step(dt, player, talking)`
jest jedynym miejscem ruchu. `HubNpcs.render(alpha, dt, camera, speaker)` interpoluje widok,
przełącza klipy z crossfade i ogranicza aktualizacje odległych mixerów.
`npcRadius`, `npcHeight`, `npcFocusBox` i `npcRootPosition` uwzględniają skalę;
`npcFocusBox` przyjmuje opcjonalnie bieżącą pozycję NPC.

`NpcTexts.conversations?`: `{ id; npcs: string[]; radiusM?; lines: {npc; text}[] }[]`.
`loadNpcTexts(data, npcs?)` sprawdza schemat i przy przekazanym układzie także id uczestników.
`src/world/hubChatter.ts`: `HubChatter.step(dt, player, blocked)` wybiera najbliższą rozmowę
w promieniu od środka bieżących pozycji uczestników, obsługuje kwestie, przerwy i odnowienie.
`interrupt()` przerywa bez odnowienia; `force(id)` pomija odległość i odnowienie do końca rozmowy.
`line` to `{ conversation, npc, text } | null`; nowe kwestie emitują `hub_chatter_line`.
`HubChatterUi.update(line)` aktualizuje DOM tylko przy zmianie kwestii, wyłącznie z renderu sceny.
Komenda `hub chatter <id>` wymusza rozmowę; `query('hubChatter')` zwraca `line`,
`query('npcs')` zawiera bieżące pozycje i yaw także chodzących postaci.

```ts
interface HubScreenActions {
  close(): void;
  openArena?(): void;  // tylko 'arena'
}
interface HubScreens {  // wstrzykiwane do HubScene (opcja `screens`)
  show(station: HubStationId, actions: HubScreenActions): void;
  hide(): void;
  refresh?(): void;  // odświeża otwarty panel po zdarzeniu meta
  dispose(): void;
}
// HtmlHubScreens(parent, { panels?: Partial<Record<HubStationId, HubPanelFactory>>, host?: { manager, save, navigate } })
// montuje panel (src/ui/hub/hubPanel.ts) stacji z rejestru; HubScene opcje: metaStore?, panels?, metaBar?.
// Pasek meta: createMetaBar(manager, bus) w src/ui/hub/metaBar.ts. Tablica misji: createMissionsPanel w src/ui/hub/missionsPanel.ts.
class HubStations {  // czysta logika stref, bez DOM
  constructor(zones: readonly HubZone[], bus: EventBus, exitMarginM: number);
  readonly opened: HubStationId | null;
  update(x: number, z: number): HubStationId | null;  // wejście w promień otwiera (hub_station_opened)
  open(id: HubStationId): boolean;
  close(): HubStationId | null;  // blokuje ponowne otwarcie do wyjścia poza promień + margines
}
```

`loadHubLayout(data): HubLayout` — układ w formacie pokoju (`playerSpawn`, `blocks` z polem `interactive`, pola oprawy z `dressingSchema`) plus `stations`, `panels` (`tiles` | `screen` | `poster`), `npcs` (`{ id, position, rotationDeg, animation?, accent }`) i `fires`. `HubScene` rejestruje komendy debug `hub open <stacja>`, `hub close`, `hub look <stacja|npc>`, `hub talk <npc>`, `hub tp <x> <z> [yawDeg] [pitchDeg]` i zapytania `query('hubStation' | 'hubFocus' | 'hubNpc' | 'hubTalk' | 'playerPos' | 'stations' | 'npcs')`. Teksty rozmów NPC: `src/data/hub/npcs.pl.json` (`loadNpcTexts`, `src/world/hubNpcs.ts`); `selectHubTarget` (`src/world/hubStations.ts`) wybiera stację albo NPC promieniem z oka; liczby NPC w `tuning.hub` (`npcLineS`, `npcTurnRangeM`, `npcTurnSpeedRadS`, `npcHeadMaxRad`, `npcStandBodyMaxRad`, `npcSeatedBodyMaxRad`).

### Zapis v3 — `src/core/save.ts`

`SAVE_VERSION = 3`. `MetaSave` dostaje pole `meta: MetaState` (walidowane `metaStateSchema`). Meta i run mają osobne tablice migracji:

- **Meta 2→3:** brak `meta` → `createStarterMetaState()` (gracz z F3 zaczyna od stanu startowego z danych).
- **Run 2→3:** `run.loadout` = kopia presetu `loadoutDefinitions.get(run.loadoutId)`, `talents: []`, `threatLevel: 0`. Nieznany preset = zapis runu nieczytelny (`loadRun()` zwraca `null` z ostrzeżeniem). `run: null` z migracji 1→2 nadal oznacza brak runu (bez ostrzeżenia).
- Zapis z nowszej wersji pozostaje nietknięty, uszkodzony daje `null` z ostrzeżeniem (jak dotąd, obie implementacje: pamięć i IndexedDB).

### Łatki definicji i ResolvedLoadout (F4-03) — `src/progression/patches.ts`

Format łatki, ścieżki i reguły: `docs/systems/patches.md`. Talenty (zadanie 04) podają łatki posortowane po id węzła.

```ts
interface ResolvedLoadout {
  loadout: Loadout;
  blade: BladeDefinition;
  weapons: WeaponDefinition[]; // w kolejności loadout.weapons
  powers: PowerDefinition[];   // w kolejności loadout.powers
}

// Działa na structuredClone definicji, nigdy nie mutuje wejścia; bez łatek zwraca tę samą definicję.
// Po każdej łatce wynik przechodzi przez `schema`. Błąd: `${label}: łatka ${target} ${op} ${path}: ...`.
function applyPatches<T extends object>(
  definition: T,
  schema: z.ZodType<T>,
  patches: readonly DefinitionPatch[],
  label: string,
): T;

// Definicje z globalnych map + łatki w kolejności tablicy; łatki na przedmioty spoza
// ekwipunku są pomijane; nieznany prefiks celu (inny niż weapon:/power:/blade:) = błąd.
function resolveLoadout(loadout: Loadout, patches: readonly DefinitionPatch[]): ResolvedLoadout;
```

Powiązane zmiany:

- `src/combat/powers/registry.ts`: `createPowerFromDefinition(def: PowerDefinition, deps: PowerDeps): Power`; `createPower(id, deps)` zostaje i deleguje.
- `src/combat/melee/bladeSchema.ts`: `withBladeOverride(base: BladeDefinition, override?: string | null): BladeDefinition` (nadpisanie `?blade=` wygrywa z ostrzem już rozwiązanym); `resolveBlade` bez zmian.
- `RoomSceneOptions.patches?: readonly DefinitionPatch[]` (domyślnie `[]`); `RoomScene.query('resolvedLoadout')` zwraca kopię `ResolvedLoadout`. `Arena` używa `resolveLoadout(preset, [])`.
- Wartości z `tuning.ts` nie są łatkowane. `Hud` i `FppViewModel` nadal czytają nazwy i modele z globalnych map (łatki ich nie zmieniają); model broni z `ResolvedLoadout` ma pierwszeństwo w `RoomScene`.

### Poziom zagrożenia (F4-05) — `src/world/threat.ts`, `src/enemies/manager.ts`

```ts
threatLevelDef(level: number): ThreatLevel;            // z threat.json; nieznany poziom = błąd
threatModifiers(level: number): StatModifier[];        // źródło `threat:<poziom>`; poziom 0 = []
// RoomPlanner (kompatybilnie, opcjonalny parametr):
planWaves(room, sector, node, rng, threatLevel?: number): WavesDefinition; // domyślnie 0
// EnemyManager:
setSpawnModifiers(mods: readonly StatModifier[]): void; // dla każdego NOWO spawnowanego wroga i bossa
// EnemyDependencies:
spawnModifiers?: readonly StatModifier[];               // dodawane do Stats w konstruktorze wroga, przed Health
```

`maxHealth` (`percent` = `enemyHealth`) i `damage` (`percent` = `enemyDamage`). Wróg startuje z pełnym, powiększonym HP. `RunScene` przekazuje `RunState.threatLevel` do planera; `RoomScene` wywołuje `manager.setSpawnModifiers(threatModifiers(run.threatLevel))` po utworzeniu `EnemyManager`. Opis: `docs/systems/threat.md`.

### Talenty (F4-04) — `src/progression/talents.ts`, `src/progression/meta.ts`

Opis: `docs/systems/talents.md`.

```ts
// MetaManager (meta.ts)
buyTalent(id: string): void;        // wolne punkty, requires, próg drzewka, requiresTreePoints; błąd = Error (pl); emituje talents_changed
resetTalents(): void;               // darmowy, pełny; emituje talents_changed
spentInTree(tree: TreeId): number;  // suma cost kupionych węzłów drzewka
debugGrantTalent(id: string): void; // bez kosztu i progów

// talents.ts
interface ResolvedTalents {
  modifiers: StatModifier[];                              // źródło `talent:<id>`
  triggers: { talentId: string; trigger: ImplantTrigger }[];
  tags: string[];
  patches: DefinitionPatch[];                             // posortowane po id węzła, w węźle wg tablicy
  runStartCredits: number;
}
resolveTalents(ids: readonly string[], trees = talentTrees): ResolvedTalents; // posortowane id, duplikaty raz, nieznany id = błąd
class TalentSystem {                                      // jak ImplantSystem: nakłada/zdejmuje po źródle na podanych Stats
  constructor(options: { stats?: Stats | Stats[]; health?: ImplantHealthTarget; trees?; onChange?: () => void });
  add(id, { adjustHealth? }): boolean; set(ids, { adjustHealth? }): void; clear(): void;
  has(id): boolean; ids(): string[]; tags(): string[]; triggers(): TalentTrigger[]; patches(): DefinitionPatch[];
}

// NewRunOptions (world/run.ts)
baseMaxHealth?: number; // bazowe maxHealth gracza (domyślnie initialHp); hp startowe += przyrost maxHealth z talentów
```

`RunManager.newRun` dolicza `runStartCredits` do Kredytów startowych. `RoomScene` czyta `run.talents`: modyfikatory na obu instancjach `Stats`, tagi w `SynergySystem.setTags`, wyzwalacze (jako `implant:talent:<id>:<n>`) razem z wyzwalaczami implantów w `setImplantTriggers`, łatki (najpierw talenty, potem `options.patches`) do `resolveLoadout`. Komendy pokoju: `talent <id>`, `talent reset`; `query('talents')`.

### Integracja runu z meta (F4-06) — `src/progression/metaSave.ts`, `src/ui/metaCommands.ts`, `src/scenes/run.ts`

Opis: `docs/systems/meta.md` (zapis i integracja), `docs/systems/run.md`.

```ts
// src/progression/metaSave.ts — jedyna droga odczytu i zapisu meta (RunScene, kryjówka, komendy debug)
loadMetaManager(store: SaveStore, bus?: EventBus, rules?: MetaRules): Promise<MetaManager>;
// Brak zapisu → stan startowy z danych. Zapis nieczytelny (uszkodzony, nowszej wersji, błąd bazy)
// → stan startowy + console.warn, bez nadpisywania zapisu do pierwszego saveMetaManager.
saveMetaManager(store: SaveStore, manager: MetaManager, now?: () => number): Promise<void>;
// MetaSave v3: zachowuje createdAt istniejącego zapisu, ustawia updatedAt. Migawka stanu powstaje w chwili
// wywołania, a zapisy do jednego SaveStore idą kolejno (starszy stan nie nadpisze nowszego). Błąd odrzuca obietnicę.

// src/ui/metaCommands.ts — komendy debug meta dla dowolnej sceny
registerMetaCommands(host: { register(name, help, run): () => void } | undefined, manager: MetaManager, store: SaveStore):
  { dispose(): void; settled(): Promise<void> };
// host = ctx.commands. Komendy: `meta state`, `meta xp <n>`, `meta data <n>`, `meta cores <n>`, `meta threat <n>`, `meta unlock all`,
// `meta reset`; każda zmiana zapisuje meta (settled() czeka na zapisy).

// RunScene (src/scenes/run.ts)
RunSceneOptions.metaStore?: SaveStore;   // domyślnie IndexedDB
// ?loadout=meta → newRun(seed, 'custom', { loadout: meta.loadout(), talents: state.talents,
//                 threatLevel: state.threat.selected, baseMaxHealth: roomPlayer.maxHealth })
// presety (?loadout=<id>): talenty [], Poziom zagrożenia 0. `continue=1` przyjmuje loadoutId 'custom'.
// run_ended (każdy run): MetaManager.applyRun(summary, runIdOf(state)) → saveMetaManager → clearRun;
// błąd zapisu meta = console.warn, nie blokuje clearRun ani podsumowania.
query('meta'): MetaState;                 // kopia
query('level'): LevelInfo & { talentPoints: number; freePoints: number };

// src/ui/runScreens.ts
RunScreenView.meta?: Pick<ApplyRunResult, 'rewards' | 'levelBefore' | 'levelAfter' | 'threatUnlocked'>;
RunScreenActions.hub?(): void;            // przycisk „Wróć do kryjówki” (pierwszy na podsumowaniu), ?scene=hub (+debug=1)
```

`RunScreenView.meta` jest ustawiane tylko, gdy `applyRun` naliczył nagrody (`applied: true`). Teksty: `src/data/ui/meta.pl.json`, sekcja `summary`. Nowy run z podsumowania runu z ekwipunkiem własnym wraca pod `?loadout=meta`.

## Zagrożenia w pokojach

`src/world/roomSchema.ts`: `Hazard` to unia `electric_field` (id, position, size,
opcjonalny cycle), `explosive_barrel` (id, position), `laser_gate` (id, from, to,
cycle). `HazardCycle = { onS: number; offS: number; offsetS?: number }`.
`RoomDefinition.hazards?: Hazard[]`; identyfikatory są unikalne w pokoju.

`src/world/hazards.ts`: `HazardState = { id: string; kind: Hazard['kind'];
phase: 'off' | 'warn' | 'on'; alive: boolean; phaseT: number }`.
`HazardSystem` przyjmuje bus, damage, entities, hurtboxes, world, playerId,
hazards, tuning oraz `targets(): HazardTarget[]` (id, środek position, radius,
halfHeight osi pionowej kapsuły). Metody: `step(dt)`, `state(): HazardState[]`,
`targetIds(): EntityId[]`, `detonate(id: string): boolean`, `dispose()`.
Zdarzenia pozostają bez zmian; śmierć beczki wykrywa `damage_dealt.killed`.
Render `HazardView(hazards)` udostępnia `root`, `update(states, alpha)`, `dispose()`.
Pokój: `query('hazards')`, komendy `hazard list`, `hazard detonate <id>`.
Szczegóły: `docs/systems/hazards.md`.
## Z3: wykończenia ostrzem

- `enemy_executable: { id: EntityId; ready: boolean }` — wyłącznie zmiana gotowości.
- `execute_performed: { attacker: EntityId; target: EntityId; point: Vec3 }` — udane wykończenie; dla synergii zdarzenie bez celu.
- `DamageSystem.isInvulnerable(id): boolean` — odczyt okna po trafieniu i callbacku nietykalności, bez zmiany stanu.
- `BladeDeps.tryExecute?: () => boolean` — przed startem lekkiego combo; true konsumuje atak i resetuje combo. Rzut, ciężki i dash-cięcie nie wołają haka.
- `ExecuteSystem` (`combat/melee/execute.ts`): konstruktor przyjmuje bus, damage, tuning, owner, statuses (`StatusQuery`), `enemies()` (id, kind, position), `aim()` (origin, dir), `addEnergy`, `heal`; opcjonalny `castWall` odrzuca zasłonięte cele.
- `step(dt)`, `tryExecute(): boolean`, `readyIds(): readonly EntityId[]`, `targetId(): EntityId | null` (odczyt celu dla HUD), `invulnerable(): boolean` (odczyt dla rejestracji gracza), `dispose()`.
- HP/maxHP pochodzą z DamageSystem. `kind === 'boss'` wyklucza cel, `kind === 'executor'` wybiera próg elity. Pozycja celu to środek korpusu, nie stopy.
- Sceny krokują system zaraz po statusach w czasie świata; callback nietykalności gracza łączy dash i wykończenie. Render przekazuje gotowość do widoku i korzysta z celu HUD zapisanego na końcu kroku.


### Z8: widoki i kamera debug

`readyIds()` zwraca stały widok `readonly EntityId[]`, aktualizowany w miejscu,
nie snapshot. Sceny wykorzystują pulę `ExecuteEnemy` i jedną tablicę.
Render czyta gotowość i cel zapisany po ostatnim kroku symulacji.

Komendy `RoomScene` i `Arena`: `tp <x> <z> [yawDeg] [pitchDeg]` teleportuje
na aktualnej wysokości i ustawia obrót (domyślnie 0, 0);
`look <yawDeg> [pitchDeg]` ustawia sam obrót (pitch domyślnie 0).
Yaw 0 = -Z; pitch ograniczony przez `tuning.player.maxPitchDeg`.
Zmiana stanu i interpolacji jest natychmiastowa, także w pauzie.
Query `playerPos` zwraca pozycję, `playerLook` → `{ yawDeg, pitchDeg }`.


### Ekrany ładowania: splasharty i porady

`SplashHint.scene?: string` ma priorytet przed `room` i `theme`; `menu` oznacza
ekran bez parametru sceny (pozostałe wartości z rejestru scen).
`loadingTips.ts`: `loadTips(unknown)` zwraca walidowane porady z etykietami
lub pustą listę, `getTips()` waliduje dane leniwie, `pickTip(key)` wybiera
deterministycznie przez `hashSeed`. Wspólny dekoracyjny widok porad rotuje
co `tuning.ui.loadingTipS`, a jego `dispose()` usuwa timer. Klucz startowy:
scena + seed; klucz pokoju: run + seed + currentNodeId.
`pickSplash(key, hint?, maxAct = 1, list?)` losuje tylko spośród `act <= maxAct`;
`unlockedSplashAct(victories)` zwraca akt 1–4 z `tuning.ui.splashActVictories`,
a `readSplashAct(store?)` z `bootSplash.ts` czyta go z meta-zapisu (błąd = 1).

## Fauna kryjówki

- `HubLayout.fauna?`: `cat?: { route: {x,z}[]; restS: [min,max]; speedMS? }` (pętla, minimum 3 punkty) i `rats?: { lanes: {from: Vec3; to: Vec3}[]; intervalS: [min,max] }`.
- `HubFaunaRuntime(layout, rng, tuning.hub, bus?)`: czysta symulacja; `step(dt, playerPosition, playerVelocity)`, `placeCat(playerPosition, yaw)`, `forceRat(playerPosition)`. Stan pozycji poprzednich/bieżących oraz dystans chodu służą interpolacji widoku. Bez koliderów i interakcji.
- `hub_fauna_sound: { kind: 'meow' | 'rat'; point: Vec3 }`: kosmetyczne zdarzenie przestrzennego SFX. Mruczenie jest ruchomym źródłem ambience `purr`, aktywnym podczas odpoczynku kota.
- `AudioSystem.updateAmbienceSource(index, position, gain)`: aktualizuje istniejące źródło skopiowane przez `setAmbience`, bez restartu grafów. `HubSoundscape` przyjmuje opcjonalne dodatkowe źródła na końcu listy.
- Debug: `hub cat`, `hub rat`; `query('hubFauna')` zwraca `{ cat: {x,z,state} | null, rats: number }`. Teleport kota wymaga bezpiecznej drogi do trasy; przy przeszkodzie komenda zgłasza brak miejsca.

## Tryby areny S2b-01

`ModeId` pochodzi ze schematu danych trybów (`conquest` | `assault` | `heist`). Opcjonalne `RunState.modeId`
i `RunSummary.modeId` są zachowywane przez zapis v4. Tryb i misja wykluczają się.
`Conquest` prowadzi punkty, pulę, wybór spawnu i celów ruchu; host pokoju dostarcza
żywych wrogów i pozycję gracza. `conquest_captured: { id: 'A' | 'B' | 'C';
owner: 'player' | 'enemy' }` informuje HUD o pełnym przejęciu.
`Enemy.moveGoal?: Vec3` kieruje marszem poza zasięgiem wykrycia z tuningu trybu;
brak celu zachowuje zwykłą walkę. `RunManager` kończy arenę istniejącym `finish()`.
Przy zwycięstwie `roomsCleared = rewardRooms`, przy porażce 0; bez bonusu kampanii.
Wznowienie niezakończonej areny rozpoczyna jej pojedynczy pokój od początku,
jak wznowienie pokoju zwykłego runu; zakończona arena zachowuje podsumowanie.

### Szturm S2b-02

`Assault` zarządza trzema sektorami, parą stacji A/B, pulą żyć i zegarem
odrodzenia. `stations: MissionObjectives` używa tych samych reguł sabotażu co
misje; `MissionView` rysuje aktualną parę. Konstruktor celów wymaga jedynie
`Pick<MissionDefinition, 'objectives'>`. Host przekazuje istniejący hook wybuchu.
`step(dt, player)` przesuwa front dopiero po obu stacjach; `died()` odejmuje
życie raz, `stepRespawn(dt)` zgłasza gotowość po czasie z danych. Podczas
odrodzenia symulacja pokoju czeka. Host resetuje zdrowie, energię, statusy,
moce, ostrze i broń oraz teleportuje gracza na początek aktywnego sektora.
`spawnPosition(room, player, enemies, rng)` wybiera bezpieczne miejsce spośród
punktów posiłków aktywnego sektora; `moveGoal` kieruje obroną stacji.
`RunManager` pozostawia obsługę śmierci w Szturmie hostowi; host runu wywołuje
istniejące `finish('death')` wyłącznie dla `query('assault').outcome === 'death'`.
Zapis pozostaje v4, rozliczenie nagród i pozostałe tryby nie zmieniają reguł.
Debug: `assault destroy <A|B>`, `assault lives <n>`, `query('assault')` zwraca
sektor, liczbę sektorów, stacje z postępem i lontem, życia, czas odrodzenia i wynik.

### Kradzież rdzenia S2b-03

`Heist` jest modelem bez renderu: `step(dt, player, enemies)` otrzymuje pozycję
gracza i żywych wrogów (`id`, `position`). Stan rdzenia: `base`, `player`,
`dropped`, `enemy`; `carrierId` wskazuje nosiciela. `killed(id, position)` upuszcza
rdzeń natychmiast przy śmierci nosiciela. `died(position)` upuszcza rdzeń gracza
i odejmuje życie raz; `stepRespawn(dt)` zgłasza odrodzenie przy ewakuacji.
`grab`, `drop`, `extract`, `setLives` służą debugowaniu; `extract` wymaga rdzenia.
`snapshot()` przekazuje HUD-owi pozycję, stan, nosiciela, postęp ewakuacji,
życia, czas odrodzenia, czas gry i wynik. Spawny wybiera `spawnPosition` jak
w Szturmie. `PlayerController.setCarry(speed | null)` nakłada modyfikator
`heistCarry` na `moveSpeed`, przerywa dash/slide i blokuje sprint/dash nosiciela.
Host kończy run dopiero po wyniku modelu; zapis v4 i kolejność nagród pozostają.

`Enemy.setCarry?(carry: EnemyCarry | null)` otrzymuje `speedMultiplier` oraz
`defendRangeM`. Host heist ustawia je wyłącznie aktualnemu nosicielowi, a po
utracie rdzenia przekazuje `null`. Assaulter/Gunner nakładają odwracalny
StatModifier `heistCarry` i używają `defendRangeM` zamiast zwykłego zasięgu
reakcji przy `moveGoal`. Marsz przerywa atak poza tym promieniem, lecz nie
ogłuszenie ani kontrolę Rezonansem. Bez carry zachowanie pozostaje dotychczasowe.

## Misje (ADR 0008)

`loadMission` waliduje dane i zgodność pokojów. `generateMissionMap(mission, sector, seed)` generuje stałe węzły. `MapNode.fixed` przechowuje pokój, cele i finał. Opcjonalne `RunState.missionId`, `objectives`, `objectiveProgress` zachowują zgodność dawnych runów. `RunManager` blokuje ukończenie pokoju do wykonania jego celów. `RunSummary.missionCompleted` oznacza ukończony finał. Kampania w meta przechowuje ukończone misje i jednorazowy debrief; firstClear jest rozliczany przez applyRun.

`RoomScene.missionState()` eksportuje migawkę celów do hosta; `RunManager.updateObjectives()` aktualizuje ją wyłącznie w aktywnej misji. `RoomSceneOptions.missionSignal(trigger)` przekazuje wyzwalacze radia do kolejki `MissionRadio` hostowanej przez run (kolejka przeżywa zmianę pokoju). Obrażenia i efekty eksplozji korzystają z istniejącego DamageSystem i EventBus.

## Pogoda i areny Przejęcia

- `RoomDefinition.weather?: string`: id profilu z `src/data/weather`; brak zachowuje
  pogodę motywu bez zmiany parametrów. `CityDressing.setWeather(id)` przełącza
  oprawę i tło audio bez wpływu na symulację. `dispose()` przywraca ustawienia.
- `RoomDefinition.arena?`: punkty A/B/C oraz parametry scalania i nawigacji areny;
  opcjonalne `spawnPoints` nadpisuje spawny tylko dla trybu, `exclusive` wyłącza
  pokój ze zwykłych pul. Spawny gracza pozostają w danych pokoju. `blocks[].instance?`
  oznacza powtarzalną bryłę do InstancedMesh; `blocks[].rotation?` opisuje obrót
  identycznej bryły renderu i statycznego collidera (radiany XYZ).
- `ModeDefinition.arenas`: uporządkowana lista id pokoi; odczyt starego `roomId`
  i `points` pozostaje obsługiwany. `selectArena(mode, seed?, override?, debug?)`
  wybiera pierwszy pokój bez seeda, a z seedem deterministycznie przez `Rng`.
  Debug dopuszcza override wyłącznie z listy. `modeForArena` wiąże punkty z pokojem.
- `NewRunOptions.arenaId?`: wybrana arena, utrwalana jako istniejące
  `MapNode.fixed.roomId`; brak nowej wersji zapisu. Stare zapisy combatRing działają.
- `ArenaNavigation`: czysta siatka przechodniości i pola odległości A/B/C;
  host RoomScene przekazuje następny widoczny waypoint przez istniejące
  `Enemy.moveGoal`. Zwykłe AI i zwykłe runy nie korzystają z tej nawigacji.
- `AudioSystem.setAmbience` obsługuje także syntetyczne warstwy `rain` i `wind`.
  Pogoda podąża źródłami za kamerą, wykorzystując istniejące odblokowanie i pauzę.

## Integracja modeli portu

`city_*` i `port_*` bloków używają wspólnego cache `cloneCityModel`
(`/assets/models/city/`) i zachowują materiały nazwane w GLB.
`blocks[].instance` w arenie grupuje siatki modelu w komórkach `batchCellM`.
Okucia i nadruki wariantów koloru tego samego kontenera współdzielą partie;
pojedyncze sztuki trafiają do zwykłego scalania statyki. Bez modelu pozostaje
instancjonowana bryła. Obrót stosuje się wokół środka collidera w `RoomScene`.
`RoomDefinition.blocks[].visible?: boolean` (domyślnie true) pozwala opisać
wyłącznie collider rekwizytu z `decor` (nogi suwnicy, nadwozie wózka,
maszt, płyta i balustrady pomostu), bez dodatkowej widocznej bryły.
Modele `port_lashing_platform` mają osobne collidery płyty i balustrad.
Materiały `container_navy/olive/ochre/graphite`, `crane_paint`,
`quay_concrete`, `quay_lines`, `rubber_fender`, `steel_grating` korzystają
z miejskiego shadera i uniformu mokrości; parametry są w walidowanym
`src/data/render/portMaterials.json`. Światła masztów są definicjami
`lights[]` pokoju i konkurują o istniejącą pulę `CityLights`.
Rodzaje `gas_station_tiles`, `highway_asphalt_worn`, `flood_brick_algae`,
`boardwalk_planks`, `canal_stone_wall` (modele `hw_*`, `roof_*`, `dock_*`,
`overpassRoofsDocksKinds`) są w `src/data/render/arenaMaterials.json` z opcjonalnym
polem `flat: true`: płaska barwa `tint` bez tekstury i shadera miasta do czasu
dodania tekstury `surfaces/<id>.webp`.

## Wielopoziomowe areny Przejęcia

`RoomDefinition.blocks[].walkable?: boolean` jawnie oznacza powierzchnie
chodzone nowych aren. Płyty są poziome lub obrócone wyłącznie wokół Z
(rampy w osi X). `arena.navigationMaxRiseM?` ogranicza różnicę wysokości
sąsiednich komórek, `arena.navigationHeadroomM?` określa wolną wysokość.
Oba parametry są wymagane przy blokach walkable. ArenaNavigation zachowuje
naziemną ścieżkę portu; dla walkable buduje warstwy wysokości i łączy je
wyłącznie przez ciągłe płyty/rampy. path/next zwracają Vec3 powierzchni,
Enemy.moveGoal nadal steruje ruchem XZ, a wysokość rozwiązuje Rapier.
Walidacja trybu sprawdza pełne koła punktów i drogę od gracza oraz spawnów
do każdego punktu; nie rzutuje wysokich punktów na grunt. Zwykłe spawny
posiłków pozostają na playerSpawn.y; dotychczasowa preferencja punktów wroga
zachowuje wysokość danego punktu. Brak zmian kontraktu walki i zapisu.

# Misja liniowa M01 (kontrakt D1–D8)

`MissionDefinition.level?: string` wybiera scenę `mission`; brak pola zachowuje misję-run.
`LevelDefinition` (`world/levelSchema.ts`) reużywa pola schematu pokoju i dodaje
`objectiveOrder`, `objectivePositions`, `encounters`, `checkpoints`, `gates`, `sections`.
Zależność ma postać `{ kind: 'objective' | 'encounter', id }`; strefa to box (pełne
`size`) albo sphere (`radiusM`). `loadLevel(data, mission, waves)` waliduje referencje.
`LevelRuntime` jest czystą symulacją wyzwalaczy i bram; nie zna renderu ani RunState.

`RoomCombatState` to minimalny stan wyposażenia i zasobów bez mapy runu.
`RoomSceneOptions.linearMission` przekazuje definicję, kolejność i zapisane stany
celów; `reinforce(wave, key)` deleguje posiłki do hosta. `manualEncounter` wyłącza
automatyczne kończenie pokoju tylko przy `linearMission`.
`objectiveModel()`, `setLevelGate(id, block, open)`, `teleportPlayer(position, yawDeg)`,
`resetLevelCombat(position, yawDeg)` i `removeEncounterEnemies(ids)` są API hosta
misji; spawn przez istniejące `spawnEncounterEnemy` respektuje wspólny limit.
`staticCellSize` w opcjach włącza scalanie statyki w komórkach.
`HudOptions.deathScreen=false` pozwala hostowi misji odradzać bez nakładki śmierci;
`showWaves=false` ukrywa etykiety i banery fal, gdy HUD pokazuje bieżący cel.
Scena nie zwalnia pointer lock przy automatycznym odrodzeniu; rzeczywista utrata fokusu nadal pauzuje grę w core/input.

SaveStore v6 dodaje osobny rekord `mission`: `loadMission`, `saveMission`,
`clearMission` (opcjonalne w portach starszych testów; wymagane przez scenę mission).
Migracja meta/run 5→6 jest tożsamościowa: nowy rekord nie istniał w v5 (v5 = naszywki Iskry).
`MissionSave` zawiera id próby, misji i poziomu, seed, checkpoint, stany celów,
spotkania zakończone przed checkpointem, czas, zamrożony ekwipunek i flagę ukończenia.
Zapisy są szeregowane. Cel done jest zapisywany od razu; śmierć zachowuje cele done,
zeruje częściowe interakcje i spotkania po checkpoincie. Ukończony rekord pozostaje
do udanego rozliczenia meta, potem jest usuwany. `MetaManager.applyRun` dla misji z
`level` nalicza wyłącznie firstClear, chroniony przez appliedRunIds i campaign.completed.

Scena: `?scene=mission&mission=m01-maszty[&continue=1]`. Debug: `mission start <id>`,
`checkpoint <id>`, `objective done <id>`, `encounter clear`; `query('mission')`
zwraca cele, checkpoint, aktywne/zakończone spotkania, otwarte bramy i stan hosta.
Tablica udostępnia misje z poziomem; pozostałe pokazuje jako „Wkrótce”. Opcjonalny
`HubPanelContext.missionSave` udostępnia checkpoint dla przycisku kontynuacji.

### Profile śniegu i popiołu (ADR 0011 D6)
`WeatherProfile.precipitation.kind` obejmuje `snow` i `ash`. Te rodzaje wymagają
`flakes: { sizeM, swayM, swayPeriodS, windScatter, secondaryColor }`; `speed`
pozostaje prędkością opadania w m/s. Pozostałe rodzaje ignorują `flakes`.
`surface.snowCoverage` (0..1, domyślnie 0) i `snowColor` sterują matowym,
rozjaśnionym wierzchem przez wspólne uniformy urbanMaterials. Opcjonalny
`sky.horizonColor` ustawia istniejącą łunę nieba; brak przywraca kolor motywu.
Ambience profilu dopuszcza istniejącą warstwę `generator` z miksem `gain`.
Zmiany pozostają kosmetyczne; CityDressing przy wyjściu przywraca uniformy i łunę.

## Duże areny (ADR 0011)

`conquest_captured` zawiera identyfikator A–E. Mapa `owners` obejmuje tylko
punkty używane przez arenę. `Conquest.spawnPosition` przyjmuje opcjonalny
predykat zasłonięcia posiłków przez geometrię Rapiera.

`worldEnvelope(blocks, origin)` zwraca obwiednię obracanych brył, jej środek,
promień XZ i wysokość. `SceneAtmosphere` przyjmuje obwiednię oraz kamerę
perspektywiczną i przywraca projekcję kamery przy zwalnianiu sceny.
`query('horizon')` zwraca bieżące parametry projekcji, panoramy i mgły.
`RoomScene.render` może otrzymać pozycję i obrót wolnej kamery debug.

### Tafla wody dużej areny

Opcjonalne `arena.water: { shoreZ, y, color }` przekazuje do `SceneAtmosphere`
poziom i kolor płaszczyzny od `shoreZ` w stronę dodatniego Z aż do panoramy.
Tafla jest kosmetyczna. Dno, nabrzeża i zejścia opisują bloki pokoju.
