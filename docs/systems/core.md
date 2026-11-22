# Fundamenty F0

`GameLoop` akumuluje czas rzeczywisty w sekundach (ujemny lub nieskończony czas klatki = 0)
i wykonuje kroki `SIM_DT=1/60`, wołając `step(dt, tick)` (tick rośnie o 1 przy każdym kroku, także
w hitstopie) i raz na klatkę `render(alpha, frameDt)`, gdzie `alpha = akumulator / SIM_DT` (0..1),
a `frameDt` to nieobcięty czas klatki w s. Limit `MAX_STEPS_PER_FRAME = 5` kroków na klatkę: po jego
osiągnięciu akumulator jest redukowany do reszty `% SIM_DT` (zaległości przepadają, zostaje ułamek
do interpolacji). Konstruktor przyjmuje nadpisanie limitu (tryb lite: 60). `step(dt)` dostaje
`SIM_DT × timeScale`; hitstop przyjmuje maksimum pozostałych czasów (`hitstop(ms)` ignoruje
wartości nieskończone) i przekazuje dt=0 (tick nadal rośnie), nadal odbierając wejście; zegar hitstopu
zużywa czas rzeczywisty (także czas odrzucony limitem kroków). `paused = true` nie krokuje, a przy
każdej zmianie flagi znacznik czasu jest resetowany do „teraz”, żeby ukryta karta nie wywołała lawiny kroków. Pauza zatrzymuje akumulowanie czasu;
render pozostaje aktywny. Zegar i scheduler można wstrzyknąć, `advance(ms)` działa
bez przeglądarki. Sandbox nie krokuje Rapier przy dt<=0.

`GameContext` = `{ bus, rng, loop, tuning, debug, commands?, camera?, audio?, resume?, feel? }`.
`EventBus` jest instancją w `GameContext`, bez singletonu. Emisja synchroniczna
iteruje po kopii subskrypcji w kolejności rejestracji; odpięty w jej trakcie zwykły
handler bierze udział jeszcze w tej emisji. Wyjątki trafiają do `console.error`.
`once` jest zdejmowane przed wywołaniem, również przy zagnieżdżonej emisji. `on` zwraca funkcję
odpinającą, `off(type, handler)` odpina po oryginalnym uchwycie (także dla `once`), `clear()` czyści wszystko.
Pełny katalog zdarzeń (nazwa: ładunek) znajduje się niżej w sekcji „Katalog zdarzeń”.

`Stats` liczy `(base + suma flat) × (1 + suma percent) × iloczyn mult`, z dolną
granicą zero (kolejność: najpierw `flat` do bazy, potem `percent` addytywnie, na końcu `mult`
multiplikatywnie). Brak bazy = 0. Identyfikatory statystyk (`STAT_IDS`): `maxHealth`, `moveSpeed`, `damage`,
`attackSpeed`, `maxEnergy`, `energyRegen`, `maxStamina`, `staminaRegen`, `extraJumps`, `heatCapacity`,
`coolingRate`, `damageTaken` (mnożnik otrzymywanych obrażeń, baza 1, blok = `mult` 0,3), `dashCooldown`
(s, baza z `tuning.player.dashCooldownS`, `mult` < 1 skraca). `StatModifier = { stat, type: 'flat'|'percent'|'mult',
value, source }`; `removeBySource(source)` usuwa wszystkie modyfikatory źródła i zwraca ich liczbę.
Cache unieważnia zmiana bazy oraz dodanie/usunięcie modyfikatorów.
Modyfikatory są kopiowane i zamrażane, a lista zwracana jako kopia.

`Rng` (`src/core/rng.ts`) to **mulberry32** na jednym 32-bitowym stanie: `state = (state + 0x6D2B79F5) >>> 0;
t = imul(state ^ (state >>> 15), state | 1); t ^= t + imul(t ^ (t >>> 7), t | 61); wynik = ((t ^ (t >>> 14)) >>> 0) / 2^32`
(zakres [0, 1)). Seed tekstowy jest haszowany jednorazowym wynikiem **xmur3** (`h = 1779033703 ^ długość`; dla każdego
znaku `h = imul(h ^ kod, 3432918353); h = (h << 13) | (h >>> 19)`; potem `h = imul(h ^ (h >>> 16), 2246822507);
h = imul(h ^ (h >>> 13), 3266489909); wynik = (h ^ (h >>> 16)) >>> 0`; `kod` = UTF-16 code unit, bez normalizacji);
seed liczbowy jest sprowadzany do uint32. API: `next()`, `float(min,max)` = `min + next·(max−min)`,
`int(min,max)` włącznie z oboma końcami = `floor(float(min, max+1))`, `chance(p)` = `next() < p`, `pick(lista)`
(pusta lista = błąd), `shuffle(lista)` = Fisher–Yates w miejscu od końca (`j = int(0, i)`), `fork(etykieta)` = nowy `Rng`
z seedem `xmur3("<seedUint32>:<etykieta>")` (niezależny od bieżącego stanu rodzica, nie przesuwa go),
`getState()/setState()` (uint32). Szczegóły i odtwarzanie strumieni: ADR 0002.

`ResourcePool` (`src/core/resource.ts`) to wspólny zasób z limitem (energia Rezonansu, ciepło broni):
`max()` i `regenPerS()` (dodatnie = regeneracja, ujemne = chłodzenie) czytane na żywo z `Stats`, opcjonalne
`regenDelayS()`; `spend(n)` zwraca `false` i nic nie zmienia, gdy brakuje; udane zużycie zeruje licznik opóźnienia;
`add(n, { resetDelay })` obcina do [0, max]; `step(dt)` regeneruje tylko za część kroku po upływie opóźnienia
(licznik startuje jako „dawno”, więc świeży zasób regeneruje się od razu). Wartość ponad zmniejszone `max` jest obcinana przy odczycie.
`EntityRegistry` przydziela rosnące identyfikatory od 1, trzyma `kind` i drużynę (`player|enemy|neutral`, `setTeam`
przy odbiciu pocisku) oraz mapę uchwytów colliderów fizyki na encje; emituje `entity_spawned`/`entity_despawned`.

`SaveStore` rozdziela klucze `meta`, `run` i `mission` (punkt kontrolny misji liniowej, opcjonalne metody
`loadMission/saveMission/clearMission`) w IndexedDB `neoryder` (wersja bazy 1), magazyn `saves`; zapis to
surowy obiekt pod kluczem tekstowym. `loadMetaStrict` (opcjonalne) odróżnia brak zapisu (`null`) od zapisu
nieczytelnego (wyjątek) i służy rozliczaniu nagród, żeby nie nadpisać meta stanem startowym.
Implementacja pamięciowa zachowuje te same zasady kopiowania (`structuredClone`). Schematy zod walidują dane
(`SAVE_VERSION = 6`; `MetaSave = { saveVersion, createdAt, updatedAt, meta: MetaState }`,
`RunSave = { saveVersion, seed, startedAt, run: RunState, ended?: { runId, summary } }`, gdzie `ended` oznacza
zakończony, a jeszcze nierozliczony run — zapis znika dopiero po udanym zapisie meta; brak pola = run w toku;
`MissionSave = checkpoint + saveVersion`).

Migracje (tablica indeksowana wersją źródłową, każda podnosi `saveVersion` o 1; brak migracji = błąd):

- meta: 0→1 i 1→2 neutralne; 2→3 dopisuje `meta` startowe z danych, gdy go brak (gracz z F3 nie miał meta);
  3→4 dopisuje `meta.campaign = { completed: [], pendingDebrief: null }`; 4→5 dopisuje `meta.achievements`
  wyliczone z `xp`, `unlocks` i `stats` (`seedAchievementsFromMeta`), o ile pola brak; 5→6 neutralna
  (v6 tylko dodaje osobny rekord misji).
- run: 0→1 neutralna; 1→2 szkielet v1 (bez pola `run`) staje się `run: null` i `loadRun()` zwraca `null` bez
  ostrzeżenia; 2→3 dopisuje `loadout` skopiowany z presetu `loadoutId`, `talents: []`, `threatLevel: 0`
  (nieznany preset = zapis nieczytelny); 3→4, 4→5, 5→6 neutralne.
- mission: bez migracji (schemat wymaga dokładnie `saveVersion = 6`).

Brakujące lub uszkodzone pola są odrzucane (`null`) z komunikatem w popoverze `#save-warning` (`role=alert`,
przycisk „Zamknij komunikat”) i `console.warn`. Nowszy zapis (`saveVersion > 6`) zwraca `null` z osobnym
komunikatem; nie można go nadpisać ani skasować (`saveX`/`clearX` rzucają). Przy każdym odczycie i zapisie
nieczytelny oryginał jest kopiowany pod kluczem tablicowym `['corrupt', klucz, Date.now(), uuid]` w tym samym
magazynie, a oryginał zostaje nietknięty. Odczyt migruje w pamięci, bez automatycznego zapisu.

Ustawienia (`neoryder.settings` w localStorage, `Settings`) są walidowane polami niezależnie (błędne pole =
wartość domyślna): `difficulty?` (id trudności; brak = normal), `mouseSensitivity` 0,1–5 (domyślnie 1), `fov` 60–110
(domyślnie `tuning.camera.fov` = 90), `masterVolume` 0–1 (1), `sfxVolume` 0–1 (1), `musicVolume` 0–1 (0,7),
`invertY` (false), `screenShake` 0–1 (1), `flashes` (true), `quality` `low|medium|high`, `bindings` (nadpisania
klawiszy; odrzucane nieznane akcje i kody). Brak zapisu = `medium`; zapis bez pola `quality` = `high`. `mouseSensitivity` i `fov` spoza zakresu są przycinane,
głośności i `screenShake` spoza 0–1 wracają do wartości domyślnej. Przy niedostępnej pamięci, błędnym JSON lub błędnych danych zwracane są
wartości domyślne; w oknie ustawienia są współdzielone w pamięci.

`tuning` jest mutowalne i czytane na bieżąco. Rekurencyjny panel lil-gui obejmuje
wszystkie pola liczbowe; fov, grawitacja, limit ciał i wysokość nowej kostki działają
na żywo. Zmiana wysokości nie teleportuje istniejących ciał. Liczby geometrii,
mgły i statycznego kadru sandboxu określają wyłącznie prezentację sceny F0.
Grupy najwyższego poziomu `tuning`: `horizon`, `level`, `modes`, `mission`, `ui`, `quality` (profile low/medium/high),
`weather`, `city`, `hands`, `time` (`hitstopLightMs` 40, `hitstopHeavyMs` 80, `lastKillSlowmoS` 0,3,
`lastKillTimeScale` 0,2, `slowmoRecoverS` 0,15), `camera`, `render`, `player`, `melee`, `powers`, `arena`, `audio`,
`physics` (`gravity` −20, `maxDynamicBodies` 300), `damage` (`playerInvulnMs` 250, `respawnS` 1,5), `hazards`, `weapons`,
`enemies`, `vfx`, `run`, `hub`, `sandbox` (`cubeSpawnHeight` 6). Panel lil-gui buduje się rekurencyjnie: liczba → suwak,
tekst zaczynający się od `#` → wybór koloru, obiekt → folder. Wartości `render.*` są nadpisywane przez motyw sceny i
próbkę stylu `?look=` (patrz render.md), a `camera.fov` przez ustawienie gracza.

`Input` ładuje mapowanie z `src/data/inputBindings.json` i waliduje je przez zod.
Snapshot (`held`, `pressed`, `released`, `lookDelta {x,y}` w pikselach) zwraca kopie zbiorów, po czym zeruje
krawędzie i deltę myszy. Wiele klawiszy tej samej akcji jest liczone niezależnie (akcja puszczona dopiero po
zwolnieniu ostatniego). Fokus okna (`blur`), ukrycie dokumentu i utrata pointer lock czyszczą wejście (wszystkie
trzymane akcje trafiają do `released`) i wywołują subskrybentów pauzy (`onFocusLost`). Kliknięcie canvasu
wznawia pętlę i prosi o pointer lock; przy odmowie pojawia się przycisk ponowienia (`pointer-lock-hint`).
Pierwsze zdarzenie ruchu myszy po przechwyceniu kursora jest pomijane, a pojedynczy ruch > 400 px jest odrzucany
(artefakty przeglądarki). Ruch myszy liczy się tylko przy pointer lock. Klawisze są ignorowane, gdy fokus jest
w polu formularza, przycisku, linku, dialogu lub otwartym ekranie UI (`.run-screen`, `.hub-screen`, `.sector-map`,
`.build-select`); `contextmenu` na canvasie jest blokowane, środkowy przycisk (`mousedown`, `auxclick`)
ma zablokowane akcje domyślne (autoscroll).

Akcje (`actionSchema`): `moveForward`, `moveBack`, `moveLeft`, `moveRight`, `jump`, `sprint`, `dash`, `crouch`, `attack`,
`block`, `aim` (celowanie PPM z bronią palną w ręce; domyślnie bez klawisza), `swap`, `power`, `power2`, `weapon1`–`weapon3`,
`bladeThrow`, `map`, `inventory`. Domyślne mapowanie (`inputBindings.json`): `KeyW/S/A/D` ruch, `Space` skok,
`ShiftLeft|ShiftRight` sprint, `KeyQ` dash, `ControlLeft|ControlRight` kucanie, `KeyR` swap, `KeyF` power, `KeyE` power2,
`Digit1`–`Digit3` bronie, `KeyM` mapa, `Tab` ekwipunek; mysz: przycisk 0 = `attack`, 1 (środkowy) = `bladeThrow`,
2 (prawy) = `block`. Gracz może przemapować klawiatury (`bindings` w ustawieniach; dozwolone kody: litery, cyfry,
Numpad, F1–F24, strzałki, Space, Tab, Enter, Backspace, Delete, Insert, Home, End, PageUp/Down, Shift/Control/Alt, CapsLock,
znaki interpunkcyjne; pusty kod = akcja bez klawisza). Przypisanie klawisza wypiera poprzedniego właściciela,
który wraca na swój domyślny klawisz, jeśli ten jest wolny; przyciski myszy nie są przemapowywalne.

## Dodanie sceny debug

Zaimplementuj `Scene` z `src/scenes/index.ts` w osobnym pliku i dodaj do `scenes` wpis leniwy:
`'moja-scena': () => import('./mojaScena').then((m) => () => new m.MojaScena())` (bez importu statycznego — każda scena to
osobny chunk, a menu nie pobiera jej kodu; w testach `(await scenes['moja-scena']!())()`). Otwórz
`?scene=<id>&debug=1&seed=test`. Buduj obiekty w `init`, aktualizuj stan wyłącznie
w `step`, interpoluj pozycję i rotację w `render(alpha)`, a w `dispose` zwolnij
WASM, geometrie i materiały. Nowy wspólny kontrakt najpierw uzgodnij w `docs/api.md`.
Statyczna kamera F0 jest ustawiana w main; kontrakt kamery FPP należy do F1.

Backquote otwiera konsolę. `CommandRegistry` z `src/ui/debugCommands.ts` wykonuje
komendy zarówno konsoli, jak i `window.__neoryder.command`. Rejestr dopasowuje
najpierw nazwę dwuwyrazową, potem jednowyrazową; ignoruje wielkość liter nazwy,
zachowuje wielkość liter argumentów. Nieznana komenda zwraca komunikat z sugestią
`help`, a wyjątek handlera staje się komunikatem błędu. Duplikat nadpisuje komendę
z ostrzeżeniem `console.warn`. `help()` zbiera opisy bieżących rejestracji.

Scena rejestruje komendy w `init` przez opcjonalne
`ctx.commands?.register(name, help, run)` i zachowuje zwrócone funkcje unsubscribe,
które wywołuje w `dispose`. Odpięcie starej rejestracji nie usuwa jej zastępcy.
Sandbox rejestruje `spawn cube`, player-test — `tp <x> <y> <z>`, damage-test —
`hit`, `heal`, `block`, `slash`. Eksport `registerCommand` obsługuje domyślną
instancję używaną w main; testy mogą przekazać własny rejestr przez `GameContext`.

Main rejestruje `help`, `reset`, `seed`, `fx <damage|focus|off>` (impulsy kompozycji), `music <calm|combat|boss|off|auto>`,
`timescale <n>` i `hitstop <ms>` oraz (poza scenami `run` i `mission`) `mission start <id>`, a w debug `profile <on|off>`.
Rejestr ma też wbudowane `difficulty <easy|normal|hard|nightmare>` (nadpisanie trudności następnego runu).
Nazwa komendy ma jedno lub dwa słowa.
Wartości czasu muszą być skończone i nieujemne. `reset` deleguje do opcjonalnej
metody `scene.reset()`, a zapytania do `scene.query(name)`. Main nie rozpoznaje
konkretnych klas scen. Debug handle `window.__neoryder` jest zamrożony i wystawiany tylko w debug: `tick()`, `sceneId()`,
`command(linia)`, `query(nazwa)` (`frameProfile`, `renderInfo`, `audioState`, `lastSound`, `recentSounds`, `music`,
pozostałe nazwy trafiają do `scene.query`); e2e używają `?debug=1`. W sandboxie `cubeY` pochodzi z bieżącego
stanu pierwszej kostki, a `bodies` obejmuje podłogę i dynamiczne kostki. Poza `run` każda scena emituje `run_started`
(seed z `?seed=` lub losowy z `crypto`), a po inicjalizacji `scene_loaded`.
Kolejność startu: `resize()` (cele pipeline'u w docelowym rozmiarze) → `scene.init()` → rozgrzewka renderu
(`warmUpRender()`, poza `fx=lite`; patrz [render.md](render.md#rozgrzewka-renderu-wczytywanie-sceny)) → `window.__neoryder`
(debug) → `scene_loaded` (zdjęcie ekranu startowego) → `loop.start()`. Debug handle i `scene_loaded` pojawiają się
więc dopiero po rozgrzewce.

## Weryfikacja

`npm run check` uruchamia typy, ESLint i Vitest (Node, pula worker threads).
`npx playwright install chromium` instaluje przeglądarkę. `npm run e2e` buduje
grę i uruchamia `npm run preview` na stałym porcie 4173; testy używają SwiftShader.
Ręcznie: sprawdź spadek kostki, reset/spawn, zmianę grawitacji, fov i wysokości,
hitstop, historię komend oraz pauzę po Escape/utracie fokusu i wznowienie kliknięciem.

## FeelSystem — czas gry (F1 #13)

`src/core/feel.ts` jest jedynym właścicielem czasu (ADR 0003 pkt 5). Systemy walki tylko emitują zdarzenia:

- `hitstop { ms }` → `loop.hitstop(ms)` (kumulacja jako max w pętli; ignorowane w pauzie).
- `slowmo { timeScale, durationS }` i `wave_last_kill` (→ `tuning.time.lastKillTimeScale` 0,2 przez `lastKillSlowmoS` 0,3 s) → spowolnienie liczone w **czasie rzeczywistym** (`update(frameDt)` z `main.ts`), potem płynny powrót w `slowmoRecoverS` (0,15 s). Kumulacja: mocniejsze spowolnienie wygrywa, czas jako max.
- `baseTimeScale` — cel powrotu; komenda debug `timescale <n>` zmienia bazę, nie nadpisuje efektów. `reset()` przy zmianie sceny.

## Skupienie: czas gracza — F2-06

`FeelSystem` obsługuje zdarzenie `focus { worldScale, durationS }` jak `slowmo`
(kumulacja: mocniejsze spowolnienie wygrywa, czas jako max), ale dodatkowo
wyjmuje gracza spod spowolnienia: `playerDt(dtSim)` zwraca w Skupieniu
`dtSim / loop.timeScale × playerTimeScale` (najwyżej `SIM_DT × 2`), poza nim
`dtSim`; hitstop (0) zostaje 0. `focusActive` trwa przez `durationS` czasu
rzeczywistego z wyłączeniem hitstopu i przez płynny powrót świata (`time.slowmoRecoverS`), żeby gracz
nie zwalniał przy wychodzeniu ze Skupienia. `durationS: 0` kończy je przed
czasem (np. brak energii). `main.ts` ustawia `ctx.feel`; sceny krokują gracza,
ostrze, moce, broń i energię z `ctx.feel?.playerDt(dt) ?? dt`, a wrogów,
pociski, statusy, obrażenia i fizykę zwykłym `dt` (arena, ai-test). Ostatnie
zabójstwo fali i inne `slowmo` nadal spowalniają także gracza.

Testy: `feel.test.ts` (dystans gracza w 1 s czasu rzeczywistego jak bez
Skupienia, świat 0,3; hitstop, limit, powrót, wcześniejsze zakończenie,
kumulacja) i `arenaFocus.test.ts` (prawdziwa arena). Moc `kind: 'focus'`
jest w rejestrze mocy; `focusPower.test.ts` sprawdza synchronizację mocy i świata
z sekundą hitstopu oraz naturalne zakończenie przez `focus { durationS: 0 }`.
`FeelSystem` śledzi hitstop z tych samych zdarzeń co `GameLoop` (pętla nie
udostępnia pozostałego czasu); samodzielne slowmo F1 odlicza czas jak dotąd.

`computeStat` obcina każdy czynnik do zera i zwraca 0 dla NaN/Infinity; `saveSettings` odświeża współdzieloną kopię z `loadSettings`.

## Katalog zdarzeń (`GameEvents`)

Typowany słownik `nazwa: ładunek`. `Vec3 = {x, y, z}`; `EntityId` = liczba.

- Walka i encje: `entity_spawned {id, kind}`, `entity_despawned {id}`, `damage_dealt {source|null, target, amount, tags[],
point|null, dir|null, knockback, killed, statuses?}`, `enemy_killed {id, killer|null, tags[]}`, `explosion {point, radiusM, owner, tags[]}`,
  `parry_success {defender, projectile|null, attacker|null}`, `melee_swing {attacker, stage 1|2|3|4|'heavy'}`,
  `melee_parried {defender, attacker, point}`, `melee_blocked {defender, attacker|null, amount}`, `execute_performed
{attacker, target, point}`, `enemy_executable {id, ready}`, `enemy_telegraph {id, kind, durationS}`, `enemy_stunned {id, durationS}`,
  `status_applied {target, status, stacks, durationS, source|null}`, `status_expired {target, status}`,
  `projectile_spawned {id, owner, team}`, `projectile_reflected {id, newOwner}`, `weapon_fired {weapon, owner}`,
  `weapon_switched {owner, weapon, slot}`, `held_item_changed {owner, held, weapon|null}`, `heat_changed {id, current, max, overheated}`,
  `blade_thrown {owner}`, `blade_returned {owner}`, `synergy_triggered {synergy, user}`.
- Gracz: `health_changed {id, current, max}`, `player_died {id, cause?}`, `player_jumped {id, double}`, `player_landed {id, speed}`,
  `stamina_changed {id, current, max}`, `stamina_denied {user, action 'dash'|'doubleJump'}`, `dash_used {user, dir}`,
  `slide_started {user}`, `slide_ended {user}`, `energy_changed {id, current, max}`, `power_used {power, user}`,
  `power_cooldown {power, user, cooldownS}`, `power_released {power, user}`, `power_denied {power, user, reason
'no_energy'|'cooldown'|'too_heavy'|'out_of_range'|'jammed'}`.
- Czas i kamera: `hitstop {ms}`, `slowmo {timeScale, durationS}`, `focus {worldScale, durationS}`, `camera_shake {intensity, durationS, dir|null}`.
- Fale i tryby: `wave_started {wave, count}`, `wave_cleared {wave}`, `wave_last_kill {wave, id}`, `conquest_captured {id 'A'..'E',
owner, owners}`, `boss_spawned {id, name, maxHealth, phaseThresholds[]}`, `boss_phase {id, phase, phases}`, `boss_shield {id, current, max}`.
- Run: `run_started {seed}`, `scene_loaded {sceneId}`, `node_selected {nodeId, type}`, `room_entered {nodeId, roomId, type, layer}`,
  `room_cleared {nodeId, type, timeS}`, `reward_offered {nodeId, options[]}`, `implant_acquired {id, rarity, source 'reward'|'shop'|'upgrade'}`,
  `currency_changed {currency 'credits', amount, delta}`, `shop_purchase {item, kind 'implant'|'heal', price}`, `rest_used {choice
'heal'|'upgrade', implant|null}`, `run_ended {outcome 'victory'|'death', summary, cause?}`.
- Meta i kryjówka: `meta_rewards {runId, rewards, levelBefore, levelAfter}`, `level_up {level}`, `talents_changed {talents[]}`,
  `unlock_purchased {id}`, `loadout_changed {loadout}`, `threat_selected {level}`, `achievement_earned {id}` (tracker w runie),
  `achievement_unlocked {id}` (zapis w meta), `hub_prop_used {prop, kind 'jukebox'|'noodles'|'radio'|'bag'}`,
  `hub_station_opened {station}`, `hub_chatter_line {conversation, npc, text}`, `hub_fauna_sound {kind 'meow'|'rat', point}`,
  `hub_train_passed {durationS}`, `hub_power_dip {durationS}`.
