# ADR 0007 — Meta-progres i kryjówka (F4)

Status: **Przyjęta do realizacji (2026-11-15)** — człowiek zaakceptował bramkę F3 i polecił start F4. Kontrakty trafią do `docs/api.md` („Kontrakty F4”, zadanie F4-01 w `docs/issues/F4/README.md`).
Data: 2026-11-15

F4 dodaje to, co zostaje po runie: **poziom postaci i punkty talentów, trzy drzewka z węzłami hybrydowymi, waluty Dane i Rdzenie, odblokowania broni, mocy i ostrzy, Poziom zagrożenia** oraz **kryjówkę** jako grywalny hub. Zasady nadrzędne z `AGENTS.md` bez zmian (symulacja oddzielona od renderu, dane zamiast kodu, `Stats` + `StatModifier`, `EventBus`, `Rng`, `SaveStore`). Zasada projektu z GDD: **trwały progres daje głównie nowe opcje**, a w mniejszym stopniu surową siłę.

Nazewnictwo: identyfikatory po angielsku (`xp`, `data`, `cores`, `talents`, `unlocks`, `threat`), teksty UI po polsku (Doświadczenie, Dane, Rdzenie, Talenty, Warsztat, Tablica misji, Poziom zagrożenia) w `src/data/ui/`.

## 1. Stan meta-progresu

Nowy serializowalny typ w `src/core/metaTypes.ts`, zapisywany w `MetaSave` (pkt 8):

```ts
type TreeId = 'blade' | 'resonance' | 'gunner' | 'hybrid';
interface LoadoutChoice { blade: string; weapons: string[]; powers: string[] }
interface RunRewards { xp: number; data: number; cores: number }
interface MetaRunRecord {
  runId: string; // `${seed}:${startedAtMs}`
  outcome: RunOutcome;
  elapsedS: number;
  layerReached: number;
  threatLevel: number;
  rewards: RunRewards;
}
interface MetaState {
  xp: number; // łączne doświadczenie; poziom wynika z krzywej w danych
  data: number; // Dane
  cores: number; // Rdzenie
  talents: string[]; // kupione węzły drzewek
  unlocks: string[]; // 'weapon:<id>' | 'power:<id>' | 'blade:<id>' | 'slot:<id>'
  loadout: LoadoutChoice; // ekwipunek wybrany w warsztacie
  threat: { max: number; selected: number };
  stats: { runs: number; victories: number; deaths: number; kills: number; bestVictoryS: number | null };
  lastRuns: MetaRunRecord[]; // najnowsze pierwsze, najwyżej 10
  appliedRunIds: string[]; // idempotencja nagród, najwyżej 20
}
```

`MetaManager` (`src/progression/meta.ts`, bez Three.js i DOM) jest jedynym miejscem, które zmienia `MetaState`: `applyRun`, `buyTalent`, `resetTalents`, `buyUnlock`, `setLoadout`, `selectThreat`, `serialize` / `restore`. Każda zmiana emituje zdarzenie (pkt 9). Stan startowy (nowy gracz) pochodzi z danych (`src/data/meta/progression.json`, `starter`).

## 2. Nagrody za run

Funkcja czysta `computeRunRewards(summary, threatLevel, rules)`; liczby w `src/data/meta/progression.json` (`rewards`):

- **Doświadczenie** = `roomsCleared × xpPerRoom + elitesCleared × xpPerElite + (zwycięstwo ? xpVictory : 0)`, razy `rewardMult` Poziomu zagrożenia.
- **Dane** = `roomsCleared × dataPerRoom + kills × dataPerKill + (zwycięstwo ? dataVictory : 0)`, razy `rewardMult`.
- **Rdzenie** = `elitesCleared × coresPerElite + (zwycięstwo ? coresVictory + victoryCores(poziom) : 0)`; Rdzenie są rzadkie i nie mnożą się przez `rewardMult`.
- **Śmierć zachowuje 100% zdobytych nagród.** Mniej pokoi oznacza mniej nagród, więc kara jest naturalna, a każdy run daje postęp („każda śmierć czyni cię silniejszym”).
- `RunSummary` dostaje pole `elitesCleared` (liczone z odwiedzonych węzłów `elite` ukończonych przed końcem runu).
- **Idempotencja:** `runId = seed + ':' + startedAtMs`; `applyRun` dla `runId` z `appliedRunIds` nic nie robi. Dzięki temu odświeżenie strony w trakcie zapisu nie podwaja nagród.
- **Zwycięstwo na `threat.selected == threat.max`** podnosi `threat.max` o 1 (do ostatniego poziomu z danych).
- Kolejność w `RunScene` przy `run_ended`: `MetaManager.applyRun` → `saveMeta` → `clearRun` → ekran podsumowania z nagrodami.
- **`clearRun` tylko po udanym `saveMeta`** (zmiana 2026-11-17): przy błędzie zapis runu zostaje z polem `ended` (runId + `RunSummary`), a podsumowanie pokazuje „Ponów zapis”. Ponowienie, odświeżenie i Kontynuuj z menu rozliczają ten run idempotentnie (`appliedRunIds`; meta z pamięci jest zapisywana, nie naliczana drugi raz).

## 3. Poziom postaci

Krzywa w danych (`levels.xpToNext`: tablica progów, ostatni poziom = limit; start: limit 20). `levelFromXp(xp)` jest funkcją czystą. **Punkty talentów = poziom − 1** (nowy gracz: poziom 1, 0 punktów); wolne punkty = punkty − suma kosztów kupionych węzłów. Poziom sam w sobie nie daje statystyk: siła pochodzi z wyboru talentów.

## 4. Drzewka talentów

Dane: `src/data/talents/blade.json`, `resonance.json`, `gunner.json`, `hybrid.json` (schemat zod `talentTreeSchema`):

```ts
interface TalentTree {
  tree: TreeId;
  name: string;
  tierThresholds: number[]; // punkty wydane w tym drzewku wymagane dla progu 1..4, np. [0, 1, 4, 7]
  nodes: TalentNode[];
}
interface TalentNode {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3 | 4;
  cost: number; // 1–3 punkty
  requires: string[]; // wszystkie wymagane węzły (dowolne drzewo)
  requiresTreePoints?: Partial<Record<TreeId, number>>; // dla węzłów hybrydowych
  effects: TalentEffects;
}
interface TalentEffects {
  modifiers?: ImplantModifier[]; // StatModifier ze źródłem `talent:<id>`
  triggers?: ImplantTrigger[]; // te same wyzwalacze co implanty (SynergySystem)
  tags?: string[]; // np. '#build_blade'
  patches?: DefinitionPatch[]; // pkt 5
  runStart?: { credits?: number };
}
```

- **Węzeł korzenia każdego drzewka** (próg 1) daje tag `#build_<ścieżka>` (`#build_blade`, `#build_resonance`, `#build_gunner`). Synergie hybrydowe z danych (`requires: ['#build_blade', '#build_resonance']` itd.) działają więc przez inwestycję w drzewka, bez zmian w `SynergySystem`.
- **Zawartość startowa:** 8 węzłów w każdym z trzech drzewek i 5 hybrydowych (razem 29). Suma kosztów > 2× liczba punktów na limicie poziomu, więc trzeba wybierać. Najwyżej jedna trzecia węzłów to czyste liczby (modyfikatory statystyk, łącznie dla całego drzewka nie więcej niż +15% `damage` i +20 `maxHealth`). Reszta zmienia działanie: łatki definicji, wyzwalacze, statusy.
- **Reset talentów jest darmowy** (terminal w kryjówce, zawsze pełny reset). Eksperymentowanie wspiera filar build-craftingu, a koszt i tak płaci się wyborem.
- **Talenty nie odblokowują przedmiotów** (to robi warsztat, pkt 6): talent zmienia działanie, odblokowanie poszerza wybór.
- **Run zamraża talenty:** `RunState.talents` to kopia z chwili startu runu; zmiany w kryjówce nie wpływają na trwający run.
- W pokoju talenty działają jak implanty: `TalentSystem` nakłada modyfikatory na obie instancje `Stats` (źródło `talent:<id>`), dokłada tagi i wyzwalacze do `SynergySystem`, a `runStart.credits` dolicza `RunManager.newRun`.

## 5. Łatki definicji (zmiana działania przez dane)

Talenty zmieniają parametry broni, mocy i ostrzy przez łatki stosowane do kopii definicji przy starcie pokoju:

```ts
interface DefinitionPatch {
  target: `weapon:${string}` | `power:${string}` | `blade:${string}`;
  op: 'set' | 'add' | 'mul';
  path: string; // ścieżka w definicji, np. 'jumps', 'combo.2.knockback', 'statuses'
  value: unknown; // liczba dla add/mul; dowolna wartość JSON dla set
}
interface ResolvedLoadout {
  loadout: Loadout;
  blade: BladeDefinition;
  weapons: WeaponDefinition[];
  powers: PowerDefinition[];
}
function resolveLoadout(loadout: Loadout, patches: readonly DefinitionPatch[]): ResolvedLoadout;
```

- Kolejność łatek: węzły w kolejności id, w węźle w kolejności tablicy. Wynik każdej definicji **przechodzi ponownie przez jej schemat zod**. Ścieżka musi istnieć po walidacji (zod odrzuca nieznane klucze), a `add` / `mul` działają tylko na liczbach. Błąd łatki to błąd danych wykryty testem, a nie cicha zmiana.
- Łatka celująca w przedmiot spoza ekwipunku jest pomijana.
- `RoomScene` (i `Arena` dla presetów) dostaje `ResolvedLoadout` zamiast szukać definicji w globalnych mapach (`createPower` z definicji, broń z definicji, `resolveBlade` z definicji). Bez łatek zachowanie jest identyczne jak w F3: testy areny i pokoju przechodzą bez zmiany asercji.
- Wartości „feel” z `tuning.ts` (okno parowania, hitstop) nie są łatkowane.

## 6. Odblokowania i ekwipunek z warsztatu

Dane: `src/data/meta/unlocks.json` — lista `{ id, cost: { data?: number; cores?: number }, minLevel?: number }`; `progression.json.starter.unlocks` wskazuje darmowy zestaw startowy.

- **Zestaw startowy:** `blade:plasmaBlade`, `weapon:blaster`, `weapon:pistol`, `power:push`, sloty: 1 broń, 1 moc.
- **Do kupienia za Dane:** pozostałe bronie (karabin, rozpraszacz, snajperka, ciągły laser, granat EMP), moce (Chwyt, Fala uderzeniowa, Błyskawica, Bariera, Skupienie), ostrza (podwójne, dwustronne), `slot:weapon2`. **Za Rdzenie:** `slot:weapon3`, `slot:power2` i najmocniejsze pozycje (np. Skupienie, ostrze dwustronne). Ceny i `minLevel` w danych.
- **Ekwipunek gracza** (`MetaState.loadout`) składa warsztat: 1 ostrze, 1–3 bronie i 1–2 moce w limicie odblokowanych slotów, tylko z odblokowanych pozycji. Walidacja w `MetaManager.setLoadout`; ekwipunek z meta ma `id: 'custom'` i puste `tags` (tagi ścieżek pochodzą z talentów).
- **`RunState.loadout`:** pełna kopia ekwipunku (`Loadout`) z chwili startu runu. `RoomScene` używa jej zamiast `loadoutDefinitions.get(run.loadoutId)`; `loadoutId` zostaje do podsumowania. Run z kryjówki: `?scene=run&loadout=meta`. Presety z `src/data/loadouts/` zostają dla areny, sceny `room-test`, bota e2e i trybu debug (`?loadout=classic` itd.).

## 7. Poziom zagrożenia

Dane: `src/data/meta/threat.json` — poziomy 0–10, każdy z `name`, `enemyHealth`, `enemyDamage` (procent), `budgetMult`, `rewardMult`, `victoryCores`.

- **Wybór ręczny** na tablicy misji, od 0 do `threat.max`; zwycięstwo na najwyższym dostępnym poziomie odblokowuje kolejny. Tablica pokazuje poziom zalecany (`max`), modyfikatory i premię do nagród. Automatycznego podnoszenia trudności razem z poziomem postaci nie ma: progres daje głównie opcje, więc gra stawia opór bez kary za rozwój postaci.
- **Działanie:** `planWaves` mnoży budżet zagrożenia przez `budgetMult`; każdy wróg i boss dostaje przy spawnie modyfikatory `Stats` ze źródłem `threat:<poziom>` (`maxHealth` i `damage`, typ `percent`); nagrody mnoży `rewardMult` (pkt 2).
- `RunState.threatLevel` jest zamrożony na start runu. **Poziom 0 jest identyczny z F3**, więc test deterministyczności i bot e2e działają bez zmian.

## 8. Zapis

`SAVE_VERSION = 3`. `MetaSave` dostaje pole `meta: MetaState`; migracja 2→3 dla meta: stan startowy z danych (gracz z F3 zaczyna od zera, F3 nie miało meta-progresu). Migracja 2→3 dla runu: `RunState` dostaje `loadout` (z presetu `loadoutId`), `talents: []`, `threatLevel: 0`. Zapis meta po każdym runie (pkt 2) i po każdej zmianie w kryjówce (zakup, reset, ekwipunek, wybór poziomu). Obie implementacje `SaveStore` (pamięć, IndexedDB); zapis z nowszej wersji pozostaje nietknięty jak dotąd.

## 9. Zdarzenia (do `GameEvents`)

`meta_rewards { runId, rewards, levelBefore, levelAfter }`, `level_up { level }`, `talents_changed { talents }`, `unlock_purchased { id }`, `loadout_changed { loadout }`, `threat_selected { level }`, `hub_station_opened { station }`.

## 10. Kryjówka (hub)

Grywalna scena `?scene=hub` (`src/scenes/hub.ts`): nieczynna stacja metra (peron, tory, kafle, graffiti komórki Iskra) w stylu Neon Noir. Gracz chodzi kontrolerem FPP bez wrogów i bez walki (ręce pokazują ostrze w spoczynku).

- **Układ w danych:** `src/data/hub/hideout.json` w formacie pokoju (bloki, `theme`, `dressing`, `playerSpawn`) plus `stations: { id: 'talents' | 'workshop' | 'missions' | 'arena'; position; radius; label }[]`. Stacje to jasne obiekty interaktywne z neonowym napisem.
- **Interakcja bez nowego klawisza**, jak w sklepie z F3: wejście w strefę stacji otwiera nakładkę UI (kursor zwolniony, symulacja ruchu zatrzymana). Zamknięcie nakładki wymaga wyjścia ze strefy, zanim otworzy się ponownie.
- **Stacje:** terminal drzewek (`talents`), warsztat (`workshop`: odblokowania i ekwipunek), tablica misji (`missions`: sektor Kurogane Arms, Poziom zagrożenia, opcjonalny seed, „Rozpocznij run”) oraz przejście na poligon (`arena`). Na górze ekranu pasek: poziom, pasek doświadczenia, Dane, Rdzenie, wolne punkty.
- **Menu główne:** „Kryjówka” (główny przycisk), „Kontynuuj run”, „Poligon”. Wybór presetów (`BuildSelect`) zostaje tylko w trybie debug. Podsumowanie runu ma przycisk „Wróć do kryjówki” i pokazuje zdobyte Doświadczenie, Dane, Rdzenie oraz awans poziomu.
- NPC ruchu oporu i dialogi to F5.

## 11. Debug i testy

Komendy konsoli (hub, run, room-test): `meta state`, `meta xp <n>`, `meta data <n>`, `meta cores <n>`, `meta unlock all`, `meta reset`, `talent <id>`, `talent reset`, `threat <n>`, `hub open <stacja>`. `query`: `meta`, `level`, `hubStation`.

**Kryterium bramki F4 (testowalne):** symulacja 5 typowych runów (3 śmierci w warstwach 3–6, 2 zwycięstwa; test `tests/unit/metaBalance.test.ts`, raport w `docs/balance.md`) daje poziom 5–8 oraz 2–4 zakupy w warsztacie, a pełne drzewko statystyk mieści się w limitach z pkt 4. Odczucie „czuć progres, ale gra stawia opór” ocenia człowiek w `docs/playtest-F4.md`.

## Konsekwencje

- `RunState`, `RunSummary` i `MetaSave` się zmieniają: migracja v3 i aktualizacja testów zapisu.
- `RoomScene` przechodzi z globalnych map definicji na `ResolvedLoadout`. To największa zmiana w kodzie walki, więc ma osobne zadanie i pełną regresję areny.
- **Warsztat modułów broni** (rykoszet, przebicie, podpalenie) nie wchodzi do F4: moduły broni nie istnieją jeszcze w kodzie walki. Warsztat w F4 to odblokowania i ekwipunek; moduły trafiają do `docs/backlog.md`.
- Bot e2e F3 dalej startuje run presetem (`?loadout=classic`) na poziomie zagrożenia 0.

## Rozważone alternatywy

| Decyzja | Alternatywa | Dlaczego nie |
| --- | --- | --- |
| Ręczny Poziom zagrożenia z odblokowaniem po zwycięstwie | Automatyczny wzrost z poziomem postaci | Karze za rozwój i zaciera poczucie progresu |
| Śmierć zachowuje 100% nagród | Kara procentowa przy śmierci | Mniej pokoi i tak daje mniej nagród; kara zniechęca do „jeszcze jednego runu” |
| Łatki definicji w danych | Kod wariantów każdej mocy | Nowy wariant byłby nowym kodem, wbrew zasadzie data-driven |
| Darmowy reset talentów | Reset za Dane | Hamuje eksperymenty z buildami (filar 2) |
| Ekwipunek z odblokowań | Tylko presety | Odblokowania nie dawałyby wyboru; presety zostają dla debug i testów |
| Strefy stacji bez klawisza | Nowy klawisz interakcji | Spójność ze sklepem z F3; E i F są zajęte przez moce |
