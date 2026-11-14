# Zadania fazy F3 — Pętla runu

Architektura: `docs/adr/0005-petla-runu-f3.md` (**propozycja, do akceptacji po bramce F2**). Kontrakty trafią do `docs/api.md`, sekcja „Kontrakty F3”, w zadaniu 01 — dopiero po akceptacji ADR. Wspólne wymagania i definicja ukończenia: `AGENTS.md`. Szacunek: S ≈ 0,5–1 dnia sesji, M ≈ 1–2 dni, L ≈ 2–4 dni.

**Bramka fazy:** pełny run 15–25 min z bossem (jeden sektor Kurogane Arms); śmierć wraca do menu z podsumowaniem. Kryteria testowalne: (1) bot e2e na stałym seedzie przechodzi całą mapę z cheatami w < 2 min i kończy podsumowaniem zwycięstwa; (2) test deterministyczności: ten sam seed daje identyczną mapę, te same oferty nagród i te same fale. Długość 15–25 min ocenia człowiek w playteście (czas w podsumowaniu runu).

## Stan (2026-11-14)

Nie rozpoczęte, czeka na bramkę F2 (bramka F2 otwarta — patrz `docs/issues/F2/README.md`) i akceptację ADR 0005 przez człowieka. Zadania spoza tej listy trafiają do `docs/backlog.md`.

## Decyzje wspólne

- **Run:** jeden sektor Kurogane Arms, 8 warstw po 2–4 węzły (boss: jeden węzeł), typy `combat | elite | shop | rest | puzzle | boss`. Warstwa 7 to odpoczynek, warstwa 8 boss. Mapa z `Rng.fork('map')`, wagi i gwarancje w `src/data/sectors/*.json`.
- **Dane:** pokoje `src/data/rooms/*.json`, implanty `src/data/implants/*.json`, sektory `src/data/sectors/*.json`, `threatCost` w `src/data/enemies/*.json`. Nowy pokój, implant czy sektor = nowy plik danych, nie nowy kod.
- **Pokój = nowa scena i nowy świat Rapier.** Stan przenosi serializowalny `RunState`. `RunScene` (`?scene=run`) jest meta-sceną; „nowy run”, „kontynuuj” i „menu” to przejścia przez URL (`?scene=run&seed=…&loadout=…`, `?scene=run&continue=1`, `/`).
- **Zapis:** `RunState` przez `SaveStore` na ekranie mapy, osobno od meta-progresu; podczas walki bez zapisu.
- **Sterowanie:** bez nowych klawiszy. Ekrany UI obsługuje mysz oraz `1`/`2`/`3` i `Enter`; sklep i odpoczynek otwierają się automatycznie po wejściu do pokoju.
- **Zdrowie:** brak pasywnej regeneracji. Leczy tylko sklep i odpoczynek.
- **Statystyki** wyłącznie przez `Stats` + `StatModifier` ze źródłem `implant:<id>`; liczby balansu w danych sektora, liczby „feel” (czas przejść, wygaszenie) w `tuning.run`.
- **Zdarzenia** (propozycje do `docs/api.md`, lista w ADR 0005 pkt 10): `node_selected`, `room_entered`, `room_cleared`, `reward_offered`, `implant_acquired`, `currency_changed`, `shop_purchase`, `rest_used`, `boss_spawned`, `boss_phase`, `run_ended`.
- **Cheaty debug** (`window.__neoryder.command`, konsola): `run node <id>`, `run clear`, `run state`, `run end win|lose`, `hurt <n>`, `credits <n>`, `implant <id>`, plus istniejące `god`, `kill all`, `hit <dmg>`, `spawn <id> [n]`. Z nich korzysta bot e2e (zadanie 20).
- **Arena F1/F2 zostaje poligonem** (`?scene=arena`), bez zmian zachowania; jej testy przechodzą bez zmiany asercji.
- **Każde zadanie:** dane w `src/data/`, liczby feel w `tuning.ts`, scena testowa `?scene=<id>` (tam, gdzie zadanie ma coś do obejrzenia), dokument w `docs/systems/`, brak nazw chronionych z `AGENTS.md`.

## Tabela zadań

| Nr  | Tytuł                                                                  | Agent                | Zależy od  | Szac. | Stan |
| --- | ---------------------------------------------------------------------- | -------------------- | ---------- | ----- | ---- |
| 01  | Kontrakty F3: typy, zdarzenia, schematy                                | Architekt            | —          | M     | —    |
| 02  | Generator mapy sektora i dane `kurogane.json`                          | Świat                | 01         | M     | —    |
| 03  | Format pokoi, loader i walidacja układów                               | Świat                | 01         | M     | —    |
| 04  | `RoomScene`: pokój jako nowy świat ze stanem z `RunState`              | Architekt            | 01, 03     | L     | —    |
| 05  | `RunState` i `RunManager`                                              | Świat                | 01         | M     | —    |
| 06  | Zapis runu: `RunSave` v2 i migracja                                    | Architekt            | 01, 05     | S     | —    |
| 07  | `RunScene`: przepływ mapa → pokój → nagroda, cheaty `run`              | Architekt            | 04, 05     | L     | —    |
| 08  | Budżet zagrożenia: `threatCost` i planowanie fal pokoju                | Świat + AI wrogów    | 01, 03     | M     | —    |
| 09  | Implanty: dane, schemat, nakładanie przez `Stats`                      | Progresja            | 01, 05     | M     | —    |
| 10  | Tagi implantów w `SynergySystem`: progi i wyzwalacze                   | Progresja            | 09         | M     | —    |
| 11  | Nagrody, Kredyty, sklep i odpoczynek (logika)                          | Progresja            | 05, 09, 10 | L     | —    |
| 12  | Zawartość pokoi sektora Kurogane Arms                                  | Świat                | 04, 08     | L     | —    |
| 13  | Menu główne i ekran mapy                                               | UI/UX + Architekt    | 02, 06, 07 | M     | —    |
| 14  | Ekrany nagrody, sklepu i odpoczynku                                    | UI/UX                | 11, 13     | M     | —    |
| 15  | HUD runu: Kredyty, implanty, pasek HP bossa                            | UI/UX                | 01, 09     | S     | —    |
| 16  | Boss: rdzeń, fazy z danych, uderzenie obszarowe i wachlarz             | AI wrogów            | 01         | L     | —    |
| 17  | Boss: wezwanie Tarczowników, faza tarczy, pokój bossa                  | AI wrogów + Świat    | 12, 15, 16 | L     | —    |
| 18  | Podsumowanie runu i śmierć                                             | UI/UX + Świat        | 05, 07, 13 | M     | —    |
| 19  | Zagadka z Chwytem (niski priorytet, może do backlogu)                  | Świat                | 07, 11, 12 | M     | —    |
| 20  | Bot e2e, test deterministyczności, dokumentacja i szablon playtestu    | QA                   | 14, 17, 18 | L     | —    |

Graf jest acykliczny (zależności tylko od niższych numerów). Ścieżki krytyczne: 01 → 03 → 04 → 07 → 13 → 14 → 20 oraz 01 → 03 → 08 → 12 → 17 → 20. Po 01 równolegle mogą ruszyć 02, 03, 05 i 16 (rozłączne foldery); 09 po 05, 15 po 09. Zadanie 19 nie blokuje bramki: może przejść do `docs/backlog.md`, wtedy `typeWeights.puzzle` w danych sektora zostaje 0.

## Zadania

### 01 Kontrakty F3

Dopisanie do kodu typów z ADR 0005 i do `docs/api.md` sekcji „Kontrakty F3”: `NodeType`, `MapNode`, `SectorMap`, `Rarity`, `RunState`, `RunSummary` (wspólne typy w `src/core/runTypes.ts`), nowe zdarzenia w `GameEvents` (`src/core/events.ts`), `Health.set(n)` w `src/combat/damage/health.ts`, opcjonalne `threatCost` w `enemySchema`, opcjonalne `requiresCount` w schemacie synergii, szkielety schematów zod `SectorDefinition`, `RoomDefinition`, `ImplantDefinition`, blok `tuning.run`, interfejs `RoomPlanner`. Bez zachowania — tylko typy, schematy i szkielety.
**Gotowe:** `npm run check` zielone; testy: nowe zdarzenia emitują się i odbierają przez `EventBus` (rozszerzenie `tests/unit/events.test.ts`), `Health.set` obcina do `[0, max]`, schematy zod odrzucają błędne przykłady (nieznana rzadkość, nieznany `stat`, warstwa bez węzłów, pokój bez `entry`), istniejące testy bez zmian asercji. Dokument: `docs/api.md`.

### 02 Generator mapy sektora

`src/world/sectorMap.ts`: `generateSectorMap(def, seed)` według ADR pkt 1 z `new Rng(seed).fork('map')`; dane `src/data/sectors/kurogane.json` (warstwy, `nodesPerLayer`, `extraEdgeChance`, `typeWeights`, `guarantees`, `limits`, `expectedDurationS`; sekcje `threat`, `rewardWeights`, `economy`, `roomPools` uzupełniają zadania 08, 11, 12). Scena `?scene=map-test&seed=<tekst>` wypisuje mapę tekstem (debug, bez docelowego UI z zadania 13), komenda `map`.
**Gotowe:** testy na 200 seedach: ten sam seed daje identyczną mapę (`toEqual`), różne seedy dają ≥ 50 różnych map; niezmienniki: 8 warstw, 2–4 węzły (boss: 1), krawędzie tylko do następnej warstwy i bez przecięć, każdy węzeł osiągalny od warstwy 1 i prowadzący do bossa, warstwa 1 tylko `combat`, warstwa 7 tylko `rest`, boss tylko w warstwie 8, gwarancje i limity z danych spełnione; szacunek długości 15–25 min dla ≥ 95% ścieżek; `generateSectorMap` nie używa `Math.random`. Dokument: `docs/systems/sectorMap.md`.

### 03 Format pokoi i loader

`src/world/roomSchema.ts` i `src/world/rooms.ts`: schemat `RoomDefinition` (układ jak `arena.json` plus `spawnPoints`, `doors`, `maxAlive`, `minSpawnDistance`, `props`, `puzzle`), loader `roomDefinitions` z `src/data/rooms/*.json` (zod, `import.meta.glob` jak `synergies.ts`), walidacja układu (punkty spawnu poza blokami i w granicach, osiągalność od `playerSpawn` flood fillem siatki 1 m, para drzwi `entry`/`exit`). Dwa pokoje startowe do testów: `combatYard` i `combatPillars`.
**Gotowe:** testy: poprawne pokoje przechodzą, błędne (spawn w bloku, brak drzwi, punkt nieosiągalny, powtórzone id) są odrzucane z czytelnym komunikatem; `arena.json` nadal ładuje się starym schematem. Dokument: `docs/systems/rooms.md`.

### 04 RoomScene

`src/scenes/roomScene.ts`: scena pokoju na wzór `Arena` — nowy `World` Rapier, `EntityRegistry`, systemy walki, gracz i ekwipunek z `Loadout`; bez `playerHealth` z układu. Przyjmuje `RunState` (zdrowie przez `Health.set`, energia przez `PlayerEnergy.set`, implanty na obu instancjach `Stats`), `WavesDefinition` (dostarcza zadanie 08) i emituje `room_entered` / `room_cleared` (po ostatniej fali `WaveDirector`). Drzwi: `entry` zamyka się po wejściu, `exit` otwiera po `room_cleared`. `RoomScene.exportState()` zwraca zdrowie i energię na koniec pokoju. Cache modeli `.glb` między pokojami. Wspólny rdzeń z `Arena` wolno wyodrębnić tylko, jeśli testy areny przechodzą bez zmiany asercji. Scena `?scene=room-test&room=<id>&loadout=<id>` (syntetyczny `RunState`, stałe fale testowe), komenda `run clear`.
**Gotowe:** testy (bez przeglądarki, `loadModels = false` jak w testach areny): stan zdrowia 37 przechodzi przez pokój i wraca z odjętymi obrażeniami; dwa kolejne pokoje na tym samym `EventBus` nie zostawiają subskrypcji po `dispose` (liczba handlerów jak przed pokojem) i wołają `world.free()`; `exit` zamknięte do `room_cleared`; kolejność `room_entered` → `room_cleared`; `arena*.test.ts` i `tests/e2e/arena*.spec.ts` bez zmian. E2E: `room-test` startuje, pierwsza fala się pojawia.

### 05 RunState i RunManager

`src/world/run.ts`: `RunManager` bez Three.js i DOM. `newRun(seed, loadoutId)` (generuje mapę z zadania 02), `selectNode(id)` (tylko węzły z `next` bieżącego), `completeRoom`, `creditKill(threatCost)`, `addCredits` / `spendCredits` (`currency_changed`), `finish('victory' | 'death')` (`run_ended` z `RunSummary`), `step(dt)` (czas runu w czasie symulacji), maszyna ekranów `map | room | reward | shop | rest | summary`, `serialize()` / `restore()`. Zbiera statystyki ze zdarzeń: zabójstwa gracza (`enemy_killed`), obrażenia według ścieżki (`damage_dealt` z tagami `#melee`, `#power`, `#gun`, reszta jako `other`).
**Gotowe:** testy: niedozwolone przejścia odrzucone (wybór węzła spoza `next`, wydanie Kredytów ponad stan), serializacja → `restore` daje identyczny stan (`toEqual`), podsumowanie liczy czas, zabójstwa i obrażenia ze strumienia zdarzeń, `player_died` kończy run (`death`), brak pasywnego leczenia (zdrowie w stanie rośnie tylko przez jawne API). Dokument: `docs/systems/run.md`.

### 06 Zapis runu

`src/core/save.ts`: `RunSave` rozszerzone o `run: RunState` (schemat zod `runStateSchema`), `SAVE_VERSION = 2`, migracja 1→2 (zapis v1 runu = brak runu, neutralna dla `meta`), `saveRun` / `loadRun` / `clearRun` bez zmiany sygnatur. Obie implementacje (`createMemorySaveStore`, `createIndexedDbSaveStore`).
**Gotowe:** testy w `tests/unit/save.test.ts`: round-trip `RunState` w magazynie pamięciowym, v1 → `null`, zapis z nowszej wersji nietknięty, uszkodzony zapis → `null` z ostrzeżeniem, `meta` migruje bez zmian; dotychczasowe testy zapisu zielone. Ręcznie (e2e w zadaniu 13): odświeżenie strony na mapie i „Kontynuuj”.

### 07 RunScene

`src/scenes/run.ts` (rejestr: `run: () => new RunScene()`): scena implementująca `Scene`; tworzy i niszcza `RoomScene` (z `ctx` z `rng.fork('room:<nodeId>')` i tym samym `bus`), prowadzi `RunManager`, woła `saveRun` na ekranie mapy i `clearRun` przy `run_ended`, pokazuje ekrany przez interfejs `RunScreens` (do wstrzyknięcia; w testach atrapy). Odczyt `?seed`, `?loadout`, `?continue=1`. `main.ts`: `run_started` nie jest emitowane dla `run` przy starcie sceny (emituje `RunManager`). Komendy `run node <id>`, `run clear`, `run state`, `run end win|lose`, `hurt <n>`; `query`: `screen`, `runState`, `map`, `room`, `runLog` (lista węzłów, nagród i wyników). Do czasu zadania 08 `RoomPlanner` zwraca stałą ofertę testową.
**Gotowe:** testy z atrapami ekranów i `RoomScene`: przepływ mapa → pokój → (czyszczenie) → nagroda → mapa, zapis na każdym wejściu na mapę (magazyn pamięciowy), wznowienie z zapisu wraca do tego samego węzła, trzy pokoje z rzędu bez wycieku subskrypcji i z `world.free()`, `player_died` → `run_ended` i `clearRun`. Ręcznie: `?scene=run&seed=test&debug=1`, komendy `run node` i `run clear` przechodzą pierwszy pokój.

### 08 Budżet zagrożenia

`threatCost` w `src/data/enemies/*.json` (assaulter 1, drone 1, gunner 1,5, shielder 2,5, sniper 2,5, executor 6 — wartości startowe, dopisek w `docs/balance.md` o przeliczeniu), `src/world/threat.ts`: `planWaves(room, sector, node, rng)` zwraca `WavesDefinition` zgodną z `wavesSchema` (ADR pkt 3: budżet z typu i warstwy, podział na fale, pula z wagami, odblokowanie wrogów od warstwy, Egzekutor w elicie, `Rng.fork('room:<nodeId>')`). Implementacja `RoomPlanner` wpięta w `RunScene` przez interfejs z zadania 07 (jedna linia rejestracji, review Architekta). Sekcja `threat` w `kurogane.json`. Podgląd: `?scene=room-test&room=<id>&type=elite&layer=<n>&seed=<s>`, `query('spawnPlan')`.
**Gotowe:** testy: suma `threatCost` w pokoju ≤ budżet i > budżet − najmniejszy koszt, budżet rośnie z warstwą, ten sam (seed, węzeł) daje ten sam plan, wrogowie nieodblokowani na danej warstwie nie występują, elita zawiera Egzekutora, wynik przechodzi `wavesSchema` i nie przekracza `tuning.arena.maxEnemies` na falę, wszyscy wrogowie poza bossem mają `threatCost` (test po plikach danych), `WaveDirector` przechodzi plan do `done`. Dokument: `docs/systems/rooms.md`, `docs/balance.md`.

### 09 Implanty

`src/progression/implants.ts` (schemat zod, loader `implantDefinitions`, `ImplantSystem`) i ≥ 16 plików `src/data/implants/*.json`: rzadkości common/rare/epic/legendary, tagi, `modifiers`, `upgradesTo` (łańcuchy ulepszeń). `ImplantSystem.add/remove/set(ids)` nakłada modyfikatory na `Stats` ze źródłem `implant:<id>` (na obu instancjach `Stats` pokoju), zwraca tagi implantów, wzrost `maxHealth` dodaje różnicę do bieżącego zdrowia, emituje `implant_acquired`. Komenda `implant <id>`.
**Gotowe:** testy: modyfikatory założone i zdjęte po źródle, dwa implanty kumulują się według `computeStat`, duplikat odrzucony, schemat odrzuca nieznany `stat`, tag bez `#` i `upgradesTo` o złej rzadkości, wszystkie pliki z `src/data/implants/` są poprawne, każdy implant ma polską nazwę. Ręcznie: `?scene=room-test`, `implant <id>` zmienia statystykę (np. `maxHealth` w `query('playerHp')`). Dokument: `docs/systems/implants.md`.

### 10 Tagi implantów w SynergySystem

`src/progression/synergies.ts`: liczenie wystąpień tagów z `Loadout.tags` i implantów, opcjonalne `requiresCount: Record<tag, liczba>` (próg liczby tagów), wyzwalacze implantów (`triggers`) jako dodatkowe definicje wykonywane tymi samymi efektami (`add_energy`, `cool_weapon`, `stat_modifier_timed`, `chain_on_hit`), z zachowaniem `SYNERGY_TAG` (brak pętli) i odnowień. Dwie–trzy nowe synergie progowe w `src/data/synergies/` (np. próg `#melee`, `#power`). Dotychczasowe `requires` bez zmian.
**Gotowe:** testy: próg 2 tagów włącza synergię dopiero przy drugim źródle tagu, `requires` działa jak dziś, wyzwalacz implantu działa i respektuje odnowienie, brak pętli dla obrażeń z tagiem `#synergy`; `tests/unit/synergies.test.ts` i `arenaBuild.test.ts` bez zmian asercji. Ręcznie: `?scene=room-test`, komendy `implant`, `query('synergies')`. Dokument: `docs/systems/synergies.md`.

### 11 Nagrody, Kredyty, sklep i odpoczynek

`src/progression/rewards.ts`, `shop.ts`, `rest.ts` (logika bez UI): `offerReward(state, nodeType, rng)` — 3 różne implanty, wagi z `rewardWeights[typ]`, `Rng.fork('reward:<nodeId>')`, `reward_offered`; `stockShop` (3 implanty z cenami wg rzadkości + leczenie, `Rng.fork('shop:<nodeId>')`), `buy` (`shop_purchase`); `rest` (leczenie o `economy.restHealFraction` albo ulepszenie implantu o jedną rzadkość, `rest_used`); Kredyty za zabójstwa z `economy.creditsPerThreat`; sekcje `rewardWeights` i `economy` w `kurogane.json`. Komendy `credits <n>`, `implant <id>`.
**Gotowe:** testy: rozkład rzadkości z 10 000 losowań mieści się w tolerancji dla `combat` i `elite` (elita lepsza), brak duplikatów i implantów już posiadanych, ta sama oferta dla tego samego seeda i węzła, zakup bez Kredytów odrzucony, leczenie nie przekracza maksimum, ulepszenie tylko gdy jest `upgradesTo`, pusta pula daje bezpieczny fallback (Kredyty). Ręcznie: `?scene=run&debug=1`, `credits 500`. Dokument: `docs/systems/run.md`.

### 12 Zawartość pokoi sektora Kurogane Arms

`src/data/rooms/*.json`: 6 pokoi `combat`, 2 `elite`, 1 `shop`, 1 `rest` (czarne bloki i skrzynie jak w arenie, modele z `public/assets/models`), `roomPools` w `kurogane.json` z wyborem bez powtórzeń na ścieżce (`Rng.fork('roomPick:<nodeId>')`). Pokoje różnią się układem: otwarty dziedziniec, korytarz, filary na kilku wysokościach, osłony, wąskie gardło dla Snajpera. Pokój bossa i zagadki w zadaniach 17 i 19.
**Gotowe:** testy: każdy pokój przechodzi walidację z zadania 03 (spawn, osiągalność, drzwi), każdy typ w `roomPools` ma ≥ 1 pokój, wybór deterministyczny i bez powtórzeń; test wydajności pokoju z 30 wrogami (jak `arenaPerf.test.ts`). E2E: pętla po wszystkich pokojach `?scene=room-test&room=<id>` — scena startuje bez błędów konsoli i pojawia się pierwsza fala. Dokument: `docs/systems/rooms.md`.

### 13 Menu główne i ekran mapy

`src/ui/mainMenu.ts`: **Nowy run** (wybór buildu istniejącym `BuildSelect`, opcjonalny seed → `?scene=run&seed=…&loadout=…`), **Kontynuuj** (aktywne tylko gdy `loadRun()` zwraca zapis; pokazuje warstwę i zdrowie), **Arena / poligon** (`?scene=arena`). `src/ui/mapScreen.ts`: węzły i krawędzie (SVG), ikony typów, dostępne węzły podświetlone i klikalne, odwiedzone oznaczone, klawiatura. Teksty w `src/data/ui/run.pl.json`. `main.ts`: bez `?scene=` pokazuje menu główne; lista scen debug zostaje w trybie debug.
**Gotowe:** testy jsdom: Kontynuuj nieaktywne bez zapisu i aktywne z zapisem, mapa pozwala kliknąć tylko węzły z `next`; e2e: menu → Nowy run → ekran mapy; odświeżenie na mapie i „Kontynuuj” wraca do tego samego węzła, Kredytów i implantów. Istniejące e2e z `?scene=` bez zmian. Dokument: `docs/systems/hud.md` (sekcja menu i mapa).

### 14 Ekrany nagrody, sklepu i odpoczynku

`src/ui/rewardScreen.ts` (3 karty: nazwa, rzadkość, tagi, podgląd aktywowanych synergii; wybór myszą lub `1`/`2`/`3`), `shopScreen.ts` (Kredyty, trzy implanty z cenami, leczenie, wyszarzone pozycje bez środków, „Wyjdź”), `restScreen.ts` (leczenie albo ulepszenie wybranego implantu). Podpięcie do `RunScreens` z zadania 07; sklep i odpoczynek otwierają się po wejściu do pokoju. Rzadkość oznaczana ramką i etykietą (kolor wrogów zarezerwowany dla wrogów).
**Gotowe:** testy jsdom: karty z `reward_offered`, wybór emituje `implant_acquired` i wraca na mapę, sklep blokuje zakup bez Kredytów, odpoczynek bez implantów z `upgradesTo` nie oferuje ulepszenia; e2e: `credits 500`, zakup w sklepie zmniejsza Kredyty i dodaje implant. Dokument: `docs/systems/hud.md`.

### 15 HUD runu

`src/ui/runHud.ts` nad istniejącym HUD: Kredyty (`currency_changed`), warstwa i typ pokoju (`room_entered`), lista implantów (`implant_acquired`, skrót i podpowiedź z nazwą), pasek HP bossa z kreskami progów faz (`boss_spawned`, `health_changed`, `boss_phase`). Teksty w `src/data/ui/hud.pl.json`.
**Gotowe:** testy jsdom: każde zdarzenie aktualizuje właściwy element, pasek bossa pojawia się po `boss_spawned` i znika po śmierci bossa, kreski faz zgodne z liczbą faz. Ręcznie: `?scene=room-test`, `credits`, `implant <id>`. Pasek bossa na żywo sprawdza zadanie 17. Dokument: `docs/systems/hud.md`.

### 16 Boss: rdzeń

`src/enemies/boss.ts`, rejestr `kind: 'boss'` w `src/enemies/registry.ts`, blok `boss` w `enemySchema`, dane `src/data/enemies/securityChief.json` (Dyrektor Ochrony Kurogane Arms): fazy z progami HP i listą wzorców, wzorce **uderzenie obszarowe** (`enemy_telegraph` `kind: 'slam'`, promień, obrażenia po telegrafie) i **wachlarz pocisków** (`ProjectileSystem`, tag `#gun`, parowalne i odbijalne). Obrażenia ucinane na progu fazy, przejście z nietykalnością `phaseShiftS`, zdarzenia `boss_spawned` i `boss_phase`. Wybór wzorców z `Rng`. Podgląd: `?scene=ai-test`, komenda `spawn securityChief`.
**Gotowe:** testy: maszyna stanów faz (jeden cios nie przeskakuje progu), telegraf poprzedza obrażenia, uderzenie zadaje obrażenia tylko w promieniu, pociski wachlarza da się sparować i odbić, ten sam seed daje tę samą kolejność wzorców, dane przechodzą schemat. Dokument: `docs/systems/enemies.md`.

### 17 Boss: wezwanie, faza tarczy, pokój bossa

Wzorzec **wezwanie Tarczowników** (`EnemyManager.spawn('shielder', …)`, limit `maxMinions`, telegraf), **faza tarczy łamanej** (`DamageTargetOptions.guard` zeruje obrażenia; tarcza traci wytrzymałość od obrażeń z `#power` i od odbitych pocisków; po złamaniu ogłuszenie i okno obrażeń). `src/data/rooms/bossRoom.json` (`type: 'boss'`, bez `WaveDirector`, tylko drzwi `entry`); `RoomScene` w trybie boss: boss pojawia się po wejściu, `room_cleared` po jego śmierci, `RunManager.finish('victory')`. Pasek HP z zadania 15 na żywo. Podgląd: `?scene=room-test&room=bossRoom`, `kill all` powtarzany (po jednym progu fazy).
**Gotowe:** testy: limit wezwań, w fazie tarczy obrażenia z `#gun` są zerowe, a z `#power` i odbitych pocisków zmniejszają tarczę, złamanie daje ogłuszenie, liczba `boss_phase` = liczba faz − 1, pokój bossa przechodzi walidację, zwycięstwo kończy run. E2E: boss pokonany cheatami → ekran zwycięstwa. Dokument: `docs/systems/enemies.md`.

### 18 Podsumowanie runu i śmierć

`src/ui/summaryScreen.ts`: czas (mm:ss), zabójstwa, pokoje, osiągnięta warstwa, lista implantów, obrażenia według ścieżki (Ostrze, Moc, Strzelec, słupki z `RunSummary.damage`), tytuł zwycięstwa lub porażki, przycisk „Powrót do menu” (`/`). Śmierć w pokoju: `player_died` → `finish('death')` → `clearRun` → podsumowanie (ekran „Jeszcze raz” z areny nie jest używany w runie). Komenda `run end win|lose`.
**Gotowe:** testy: liczby w podsumowaniu zgodne ze strumieniem zdarzeń, śmierć czyści zapis (`loadRun()` → `null`), po powrocie do menu „Kontynuuj” nieaktywne; e2e: `hurt 9999` w pokoju → podsumowanie porażki → menu. Dokument: `docs/systems/run.md`.

### 19 Zagadka z Chwytem

Priorytet niski: nie blokuje bramki, może przejść do backlogu (wtedy wpis w `docs/backlog.md`, `typeWeights.puzzle = 0`). Pole `puzzle` w `RoomDefinition` (skrzynie, terminal, `reachZone`), 2 pokoje `type: 'puzzle'` w `src/data/rooms/`: skrzynie rejestrowane przez `GrabPhysics.registerObject`, gracz układa je tak, by dosięgnąć terminala; rozwiązanie otwiera drzwi `exit` i daje Kredyty (`economy.puzzleCredits`), wpięcie w `RunScene`. Podgląd: `?scene=room-test&room=puzzleCrates`.
**Gotowe:** testy: warunek rozwiązania spełniony przy skrzyniach ułożonych w `reachZone` i niespełniony bez nich, drzwi `exit` zamknięte do rozwiązania, pokój przechodzi walidację, `typeWeights.puzzle > 0` daje zagadki na mapie z zachowaniem testów mapy. Dokument: `docs/systems/rooms.md`.

### 20 Bot e2e, determinizm i dokumentacja

`tests/e2e/run.spec.ts`: bot na seedzie `bot-1` (`?scene=run&seed=bot-1&debug=1`) przechodzi całą mapę z cheatami (`god`, `kill all`, `run node`, wybór nagrody, wyjście ze sklepu i odpoczynku) w < 2 min i kończy podsumowaniem zwycięstwa; dwa przebiegi na tym samym seedzie dają identyczne `query('runLog')`. Drugi test: śmierć (`hurt`) → podsumowanie → menu → „Kontynuuj” nieaktywne. Trzeci: odświeżenie na mapie i `?continue=1` zachowują węzeł, Kredyty i implanty. `tests/unit/runDeterminism.test.ts`: 200 seedów — identyczna `SectorMap`, oferty nagród i plany fal; test przeszukujący dane i teksty pod kątem nazw chronionych z `AGENTS.md`. `docs/systems/run.md` jako dokument zbiorczy F3, `docs/playtest-F3.md` (szablon bramki: czas runu, uwagi o tempie, nagrodach, bossie).
**Gotowe:** `npm run check` i `npm run e2e` zielone, e2e bota mieści się w 120 s, test deterministyczności zielony, dokumenty zaktualizowane; człowiek wypełnia `docs/playtest-F3.md` na bramce.
