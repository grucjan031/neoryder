# Zadania fazy F4 — Meta-progres i kryjówka

Architektura: `docs/adr/0007-meta-progres-f4.md` (**przyjęta do realizacji 2026-11-15**). Kontrakty: `docs/api.md`, sekcja „Kontrakty F4” (zadanie 01). Wspólne wymagania i definicja ukończenia: `AGENTS.md`. Szacunek: S ≈ 0,5–1 dnia sesji, M ≈ 1–2 dni, L ≈ 2–4 dni.

**Bramka fazy:** po 5 runach czuć progres, ale gra nadal stawia opór. Kryteria testowalne: (1) symulacja 5 typowych runów daje poziom 5–8 i 2–4 zakupy w warsztacie (`tests/unit/metaBalance.test.ts`, raport w `docs/balance.md`); (2) bot e2e: menu → kryjówka → tablica misji → run (cheaty) → podsumowanie z nagrodami → kryjówka pokazuje nowy poziom i walutę; odświeżenie strony zachowuje meta-progres. Odczucie progresu ocenia człowiek w `docs/playtest-F4.md`.

## Stan (2026-11-15)

Bramka F3 zaakceptowana przez człowieka 2026-11-15. Start F4.

## Decyzje wspólne

- **Stan meta** to `MetaState` (`src/core/metaTypes.ts`); zmienia go wyłącznie `MetaManager` (`src/progression/meta.ts`). Zapis `MetaSave` v3 przez `SaveStore` po każdym runie i każdej zmianie w kryjówce.
- **Dane:** `src/data/meta/progression.json` (stan startowy, krzywa poziomów, nagrody), `src/data/meta/unlocks.json`, `src/data/meta/threat.json`, `src/data/talents/{blade,resonance,gunner,hybrid}.json`, `src/data/hub/hideout.json`. Nowy talent, odblokowanie czy poziom zagrożenia = zmiana danych, nie kodu.
- **Run zamraża meta:** `RunState` dostaje `loadout` (pełny `Loadout`), `talents` i `threatLevel` z chwili startu. Run z kryjówki: `?scene=run&loadout=meta`. Presety `?loadout=<id>` zostają dla debug, areny i bota.
- **Poziom zagrożenia 0 = F3 bez zmian:** test deterministyczności i bot e2e F3 przechodzą bez zmiany asercji.
- **Statystyki** wyłącznie przez `Stats` + `StatModifier`; źródła `talent:<id>` i `threat:<poziom>`.
- **Zmiana działania przez dane:** łatki definicji (`DefinitionPatch`, ADR pkt 5) stosowane w `resolveLoadout`; wynik przechodzi ponownie przez schemat zod.
- **Kryjówka:** scena `?scene=hub`; stacje to strefy, wejście otwiera nakładkę UI (bez nowego klawisza). Teksty UI w `src/data/ui/meta.pl.json`.
- **Cheaty debug:** `meta state|xp <n>|data <n>|cores <n>|unlock all|reset`, `talent <id>|reset`, `threat <n>`, `hub open <stacja>`; `query`: `meta`, `level`, `hubStation`.
- **Każde zadanie:** dane w `src/data/`, liczby feel w `tuning.ts`, scena testowa `?scene=<id>` (tam, gdzie zadanie ma coś do obejrzenia), dokument w `docs/systems/`, brak nazw chronionych z `AGENTS.md`, `npm run check` zielone, e2e dotkniętych scen zielone.

## Tabela zadań

| Nr  | Tytuł                                                         | Agent               | Zależy od  | Szac. | Stan |
| --- | ------------------------------------------------------------- | ------------------- | ---------- | ----- | ---- |
| 01  | Kontrakty F4: typy, zdarzenia, schematy, zapis v3             | Architekt           | —          | M     | do zrobienia |
| 02  | `MetaManager`: poziom, nagrody za run, odblokowania, ekwipunek | Progresja           | 01         | M     | do zrobienia |
| 03  | Łatki definicji i `ResolvedLoadout` w pokoju i arenie         | Architekt           | 01         | L     | do zrobienia |
| 04  | Drzewka talentów: dane, zakup, `TalentSystem` w pokoju        | Progresja           | 02, 03     | L     | do zrobienia |
| 05  | Poziom zagrożenia: dane, budżet fal, modyfikatory wrogów      | Świat + AI wrogów   | 01, 03     | M     | do zrobienia |
| 06  | Integracja runu z meta: start z kryjówki, nagrody, podsumowanie | Architekt + UI/UX | 02, 05     | M     | do zrobienia |
| 07  | Scena kryjówki: układ, stacje, nakładki, menu główne          | Świat + Grafika     | 01         | L     | do zrobienia |
| 08  | Terminal drzewek (UI)                                         | UI/UX               | 04, 07     | M     | do zrobienia |
| 09  | Warsztat: odblokowania i ekwipunek (UI)                       | UI/UX               | 02, 07     | M     | do zrobienia |
| 10  | Tablica misji i pasek meta (UI)                               | UI/UX               | 05, 06, 07 | S     | do zrobienia |
| 11  | Symulacja balansu meta i strojenie danych                     | QA i balans         | 02, 04, 05 | M     | do zrobienia |
| 12  | Bot e2e F4, dokumentacja, szablon playtestu                   | QA                  | 08–11      | M     | do zrobienia |

Graf jest acykliczny. Po 01 równolegle: 02, 03, 07 (rozłączne pliki). Po 03: 05; po 02 i 03: 04; po 02 i 05: 06. UI (08–10) po kryjówce i logice.

## Zadania

### 01 Kontrakty F4

`src/core/metaTypes.ts` (typy z ADR pkt 1, 4, 5: `MetaState`, `LoadoutChoice`, `RunRewards`, `MetaRunRecord`, `TreeId`, `DefinitionPatch`), nowe zdarzenia w `GameEvents` (ADR pkt 9), `RunState` + `loadout: Loadout`, `talents: string[]`, `threatLevel: number`, `RunSummary` + `elitesCleared: number` i `threatLevel: number`, `SAVE_VERSION = 3` z migracjami meta 2→3 (stan startowy z `progression.json`) i runu 2→3 (`loadout` z presetu, `talents: []`, `threatLevel: 0`). Schematy zod: `progressionSchema`, `unlocksSchema`, `threatSchema`, `talentTreeSchema`, `definitionPatchSchema` (bez logiki zakupów). Pliki danych z zawartością startową: `progression.json` (stan startowy, krzywa 20 poziomów, nagrody), `unlocks.json` (wszystkie bronie, moce, ostrza i sloty z cenami), `threat.json` (poziomy 0–10; poziom 0 = mnożniki 1). `RunManager.newRun` wypełnia nowe pola (preset, `[]`, `0`), `RoomScene` czyta ekwipunek z `run.loadout`. Sekcja „Kontrakty F4” w `docs/api.md`.
**Gotowe:** `npm run check` zielone; testy: migracja meta v2→v3 daje stan startowy, migracja runu v2→v3 uzupełnia pola, round-trip `MetaSave` v3 w magazynie pamięciowym, schematy odrzucają błędne przykłady (nieznany id w `unlocks`, ujemny koszt, poziom zagrożenia bez poziomu 0, węzeł z nieznanym `tier`, łatka z nieznanym `op`), wszystkie pliki `src/data/meta/` przechodzą schematy; dotychczasowe testy bez zmian asercji (poza wersją zapisu). E2E run i room-test zielone.

### 02 MetaManager

`src/progression/meta.ts`: `levelFromXp`, `talentPoints`, `computeRunRewards(summary, threatLevel, rules)`, `MetaManager` (`applyRun` z idempotencją po `runId`, aktualizacja `stats` i `lastRuns`, odblokowanie `threat.max` po zwycięstwie na najwyższym poziomie, `buyUnlock` z kontrolą kosztu i `minLevel`, `setLoadout` z walidacją slotów i odblokowań, `selectThreat`, `serialize` / `restore`, zdarzenia). `RunManager` liczy `elitesCleared` do `RunSummary`.
**Gotowe:** testy: krzywa poziomów (progi, limit), nagrody dla zwycięstwa i śmierci zgodne z danymi i `rewardMult`, ten sam `runId` drugi raz nic nie zmienia, zakup bez waluty lub poniżej `minLevel` odrzucony, ekwipunek z nieodblokowaną bronią albo ponad limit slotów odrzucony, `threat.max` rośnie tylko po zwycięstwie na `max`, `restore(serialize())` daje identyczny stan. Dokument: `docs/systems/meta.md` (nowy).

### 03 Łatki definicji i ResolvedLoadout

`src/progression/patches.ts`: `applyPatches(definition, schema, patches)` i `resolveLoadout(loadout, patches)` (ADR pkt 5); `createPower` z definicji (rejestr mocy), broń i ostrze z definicji. `RoomScene` i `Arena` budują ekwipunek z `ResolvedLoadout` zamiast z globalnych map. `RoomScene` przyjmuje łatki z opcji (na razie puste; zadanie 04 poda łatki talentów).
**Gotowe:** testy: `set`/`add`/`mul` zmieniają kopię i nie ruszają definicji globalnej, wynik przechodzi schemat, nieistniejąca ścieżka i `add` na nieliczbie dają czytelny błąd, łatka na przedmiot spoza ekwipunku pominięta, kolejność stosowania deterministyczna; pokój z łatką `power:chain` `add jumps 1` przeskakuje na 1 cel więcej (test bez przeglądarki); `arena*.test.ts`, `roomScene*.test.ts` i e2e areny bez zmiany asercji. Dokument: `docs/systems/meta.md` (sekcja łatek), `docs/api.md`.

### 04 Drzewka talentów

Dane `src/data/talents/*.json` (ADR pkt 4: 8 + 8 + 8 węzłów i 5 hybrydowych, korzeń drzewka daje `#build_<ścieżka>`, ≤ 1/3 węzłów czysto liczbowych, limity statystyk). `MetaManager.buyTalent` (wolne punkty, `requires`, `tierThresholds`, `requiresTreePoints`), `resetTalents`. `src/progression/talents.ts`: loader, `resolveTalents(ids)` → modyfikatory, wyzwalacze, tagi, łatki, `runStart`; `TalentSystem` w `RoomScene` (źródło `talent:<id>`, obie instancje `Stats`, tagi i wyzwalacze w `SynergySystem` obok implantów, łatki do `resolveLoadout`); `runStart.credits` w `RunManager.newRun`. Komendy `talent <id>`, `talent reset`.
**Gotowe:** testy: zakup bez punktów, bez wymaganego węzła albo poniżej progu odrzucony, reset zwraca wszystkie punkty, każdy węzeł z danych ma łatki poprawne względem celu (łatki przechodzą `resolveLoadout` na ekwipunku z celem), korzenie dają tagi `#build_*`, synergia `bladeDancer` włącza się po kupieniu korzeni Ostrza i Mocy, modyfikatory zdejmowane po źródle, limity statystyk drzewka spełnione (test po danych), polskie nazwy i opisy. Ręcznie: `?scene=room-test`, `talent <id>`, `query('synergies')`. Dokument: `docs/systems/talents.md` (nowy).

### 05 Poziom zagrożenia

Zawartość `src/data/meta/threat.json` (poziomy 0–10, nazwy po polsku), `planWaves` mnoży budżet przez `budgetMult` z `RunState.threatLevel`, wrogowie i boss dostają przy spawnie modyfikatory `threat:<poziom>` (`maxHealth`, `damage`), komenda `threat <n>` (room-test). Scena: `?scene=room-test&threat=<n>`.
**Gotowe:** testy: poziom 0 daje plan i statystyki identyczne jak dziś (test deterministyczności bez zmian), budżet i HP wroga rosną monotonicznie z poziomem, wróg na poziomie 3 zadaje więcej obrażeń niż na 0, boss też dostaje modyfikatory. Dokument: `docs/systems/threat.md`, `docs/balance.md`.

### 06 Integracja runu z meta

`RunScene`: `?loadout=meta` czyta `MetaState` (ekwipunek, talenty, `threat.selected`) i zamraża je w `RunState`; przy `run_ended`: `MetaManager.applyRun` → `saveMeta` → `clearRun`; ekran podsumowania pokazuje Doświadczenie, Dane, Rdzenie, awans poziomu i odblokowany Poziom zagrożenia, przycisk „Wróć do kryjówki” (`?scene=hub`). Komendy `meta *` w runie. Teksty w `src/data/ui/meta.pl.json`.
**Gotowe:** testy z atrapami: run z `loadout=meta` ma ekwipunek, talenty i poziom z meta; po śmierci i zwycięstwie meta zapisane przed `clearRun`, ponowne wywołanie dla tego samego runu nie podwaja nagród; podsumowanie pokazuje nagrody. E2E: run z cheatami → podsumowanie z nagrodami. Dokument: `docs/systems/run.md`, `docs/systems/meta.md`.

### 07 Scena kryjówki

`src/scenes/hub.ts` (`?scene=hub`) i `src/data/hub/hideout.json`: stacja metra w stylu Neon Noir (motyw `neonStreet` albo nowy `hideout`, oprawa z `dressingSchema`), kontroler FPP bez wrogów, stacje jako strefy (`talents`, `workshop`, `missions`, `arena`) z jasnym obiektem i neonowym napisem; wejście w strefę emituje `hub_station_opened` i otwiera nakładkę przez wstrzykiwany interfejs `HubScreens` (na razie nakładki-zaślepki z tytułem i „Zamknij”); ponowne otwarcie dopiero po wyjściu ze strefy; `arena` przechodzi na `?scene=arena`. Menu główne: „Kryjówka” (główny), „Kontynuuj run”, „Poligon”; `BuildSelect` tylko w trybie debug. Komenda `hub open <stacja>`, `query('hubStation')`.
**Gotowe:** testy: walidacja układu kryjówki (stacje osiągalne od `playerSpawn`, strefy nie nachodzą na siebie), histereza strefy (wejście otwiera, zamknięcie bez wyjścia nie otwiera ponownie), `dispose` nie zostawia subskrypcji; e2e: menu → Kryjówka → scena startuje bez błędów konsoli, `hub open missions` pokazuje nakładkę. Dokument: `docs/systems/hub.md` (nowy).

### 08 Terminal drzewek (UI)

Nakładka `talents` w `src/ui/`: trzy kolumny drzewek i rząd hybrydowy, progi, stany węzła (zablokowany, dostępny, kupiony), opis i koszt, wolne punkty, zakup, „Resetuj talenty” z potwierdzeniem; mysz i klawiatura.
**Gotowe:** testy jsdom: niedostępny węzeł nie da się kupić, zakup zmniejsza wolne punkty i zapisuje meta, reset przywraca punkty; e2e: `hub open talents`, zakup korzenia po `meta xp`. Dokument: `docs/systems/hud.md` (sekcja kryjówki).

### 09 Warsztat (UI)

Nakładka `workshop`: lista odblokowań (ikona typu, nazwa, cena w Danych/Rdzeniach, `minLevel`, stan), zakup; edytor ekwipunku (ostrze, bronie i moce w limicie slotów, tylko odblokowane), zapis przez `MetaManager.setLoadout`.
**Gotowe:** testy jsdom: zakup bez waluty nieaktywny, kupiona broń pojawia się w edytorze, ekwipunek ponad limit slotów niemożliwy; e2e: `meta data 500` → zakup broni → wybór w ekwipunku → run startuje z tą bronią (`query('loadout')`). Dokument: `docs/systems/hud.md`.

### 10 Tablica misji i pasek meta (UI)

Nakładka `missions`: karta sektora Kurogane Arms, wybór Poziomu zagrożenia (0..`max`, opis modyfikatorów i premii), opcjonalny seed, „Rozpocznij run” (`?scene=run&loadout=meta&seed=…`). Pasek meta na górze kryjówki: poziom, pasek doświadczenia, Dane, Rdzenie, wolne punkty.
**Gotowe:** testy jsdom: poziom powyżej `max` nieaktywny, wybór zapisuje `threat.selected`; e2e: tablica misji → run startuje z wybranym poziomem (`query('runState')`). Dokument: `docs/systems/hud.md`.

### 11 Symulacja balansu meta

`tests/unit/metaBalance.test.ts` i rozszerzenie `npm run balance`: 5 typowych runów (3 śmierci w warstwach 3–6, 2 zwycięstwa) przez `computeRunRewards` i `MetaManager` daje poziom 5–8 i 2–4 zakupy w warsztacie; tabela nagród na poziomach zagrożenia 0–3; strojenie `progression.json`, `unlocks.json`, `threat.json`.
**Gotowe:** test zielony, raport w `docs/balance.md` (sekcja F4).

### 12 Bot e2e F4 i playtest

`tests/e2e/metaBot.spec.ts`: menu → Kryjówka → tablica misji → run (cheaty `run clear`, `run end win`) → podsumowanie z nagrodami → kryjówka pokazuje nowy poziom i walutę → odświeżenie zachowuje meta. `docs/playtest-F4.md` (szablon: 5 runów, poziom, zakupy, odczucie progresu i oporu), aktualizacja stanu w tym pliku.
**Gotowe:** `npm run e2e` zielone, w tym bot F3 bez zmian.
