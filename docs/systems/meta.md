# System: Meta-progres (MetaManager)

Źródła: `docs/adr/0007-meta-progres-f4.md`, `docs/api.md` (Kontrakty F4). Kod: `src/progression/meta.ts` (czysta logika, bez Three.js, DOM i UI). Dane: `src/data/meta/{progression,unlocks,threat}.json`. Zapis i podpięcie do gry robią inne zadania F4; ten dokument opisuje wyłącznie logikę.

## Stan

`MetaState` (`src/core/metaTypes.ts`): `xp`, `data` (Dane), `cores` (Rdzenie), `talents`, `unlocks`, `loadout`, `threat { max, selected }`, `stats`, `lastRuns` (najnowsze pierwsze, do `MAX_LAST_RUNS` = 10), `appliedRunIds` (do `MAX_APPLIED_RUN_IDS` = 20, najstarsze wypadają). `MetaManager` trzyma kopię stanu; `state` i `serialize()` zwracają `structuredClone`. `MetaManager.restore(data)` waliduje `metaStateSchema`. Błędy zmian to wyjątki `Error` z polskim komunikatem (jak w `shop.ts`).

## Poziom i punkty talentów

`levelFromXp(xp, xpToNext)` → `{ level, xpIntoLevel, xpForNext }`. Poziom 1 przy 0 XP; `xpToNext[n - 1]` to XP z poziomu n na n + 1; limit poziomu = `xpToNext.length + 1`. Na limicie `xpForNext` = `null`, a XP nadal się sumuje. `talentPoints(level) = level - 1`; `freePoints = talentPoints - spentPoints`, gdzie `spentPoints` to suma `cost` kupionych węzłów wg drzewek (nieznany id = 0).

## Nagrody za run

`computeRunRewards(summary, threatLevel, rules)`, `m` = `rewardMult` poziomu zagrożenia runu:

- `xp = round((roomsCleared·xpPerRoom + elitesCleared·xpPerElite + (zwycięstwo ? xpVictory : 0)) · m)`
- `data = round((roomsCleared·dataPerRoom + kills·dataPerKill + (zwycięstwo ? dataVictory : 0)) · m)`
- `cores = elitesCleared·coresPerElite + (zwycięstwo ? coresVictory + victoryCores(poziomu) : 0)`

Śmierć daje 100% nagród (bez składników zwycięstwa). Liczby w `progression.json` i `threat.json`.

## applyRun i idempotencja

`applyRun(summary, runId)`; `runIdOf({ seed, startedAtMs })` = `${seed}:${startedAtMs}`. Jeśli `runId` jest w `appliedRunIds`, nic się nie zmienia i wynik ma `applied: false`. W przeciwnym razie: dodaje nagrody, aktualizuje `stats` (runs, victories/deaths, kills, `bestVictoryS` = najkrótszy czas zwycięstwa), `lastRuns`, `appliedRunIds`. Wynik: `{ applied, rewards, levelBefore, levelAfter, threatUnlocked }`.

## Poziom zagrożenia w meta

`threat.max` rośnie o 1 tylko po zwycięstwie na poziomie równym `threat.max`, najwyżej do ostatniego poziomu z `threat.json`. `selectThreat(level)` przyjmuje 0..`threat.max`.

## Odblokowania i sloty

`buyUnlock(id)`: id musi istnieć w `unlocks.json`, nie być posiadane, spełniać `minLevel` i mieścić się w `cost.data` i `cost.cores`; odejmuje walutę. `weaponSlots` = 1 + liczba posiadanych `slot:weapon2`/`slot:weapon3`; `powerSlots` = 1 + `slot:power2`.

## Ekwipunek

`setLoadout({ blade, weapons, powers, modules })`: ostrze, bronie i moce muszą być odblokowane; 1..`weaponSlots` unikalnych broni i 1..`powerSlots` unikalnych mocy. `modules: Record<string, string[]>` przypisuje moduły wybranym broniom. Wymagane są odblokowania `module:<id>`, zgodny `weaponKinds`, brak duplikatów w broni oraz limit `progression.json.moduleSlotsPerWeapon` (2). Jeden moduł może być użyty w kilku broniach. Walidacja jest atomowa.

`loadout()` zwraca pełny `Loadout` (`id: 'custom'`, `name: 'Własny'`, `startHeld: 'blade'`, `tags: []`) z głęboką kopią modułów. Brak `modules` w starych zapisach meta v3 uzupełnia się przez `{}` bez migracji. Moduły zostają zamrożone na start runu wraz z ekwipunkiem. Dane, ceny, UI i wykonanie łatek opisuje `docs/systems/weaponModules.md`.

## Zdarzenia

`meta_rewards` (po `applyRun`, potem `level_up` dla każdego zdobytego poziomu), `unlock_purchased`, `loadout_changed`, `threat_selected`. Brak magistrali = brak emisji.

## Komendy debug (metody)

`debugAddXp`, `debugAddData`, `debugAddCores`, `debugUnlockAll`, `debugReset`. Podpięcie do konsoli: `registerMetaCommands` (sekcja „Zapis i integracja z runem”).

## Łatki definicji

(zadanie F4-03)

## Talenty

Pełny opis (drzewka, progi, lista węzłów, działanie w pokoju): `docs/systems/talents.md`.

- `buyTalent(id)`: węzeł istnieje i nie jest kupiony, `freePoints >= cost`, wszystkie `requires` kupione, punkty wydane w drzewku węzła (`spentInTree`) ≥ `tierThresholds[tier - 1]`, każde `requiresTreePoints[drzewko]` spełnione. Błąd to `Error` z polskim komunikatem; sukces emituje `talents_changed`.
- `resetTalents()`: darmowy, pełny; czyści listę (punkty wracają do puli) i emituje `talents_changed`.
- `spentInTree(drzewko)`: suma `cost` kupionych węzłów drzewka. `spentPoints` to suma po wszystkich drzewkach (łącznie z hybrydami).
- `debugGrantTalent(id)`: bez kosztu i bez progów (konsola debug).
- Talenty zamraża `RunManager.newRun` w `RunState.talents`; w pokoju działają przez `TalentSystem` (`src/progression/talents.ts`).

## Zapis i integracja z runem (F4-06)

Kod: `src/progression/metaSave.ts`, `src/ui/metaCommands.ts`, `src/scenes/run.ts`, `src/ui/runScreens.ts`. Kontrakt: `docs/api.md` („Integracja runu z meta”).

- `loadMetaManager(store, bus?)`: brak zapisu daje stan startowy z danych; zapis nieczytelny (też nowszej wersji albo błąd bazy) daje stan startowy z ostrzeżeniem w konsoli i **nie nadpisuje** zapisu. Dopiero pierwszy `saveMetaManager` go zastępuje (poza zapisem z nowszej wersji, który `SaveStore` odrzuca).
- `saveMetaManager(store, manager)`: `MetaSave` v3, `createdAt` zachowany, `updatedAt` ustawiony. Zapisy do jednego `SaveStore` są kolejkowane, a migawka stanu powstaje przy wywołaniu. Z tej pary korzystają `RunScene`, komendy debug i kryjówka (zadania 08–10).
- `RunScene` wczytuje meta przy starcie (każdy run). `?loadout=meta` zamraża w `RunState` ekwipunek (`loadout()`, `loadoutId: 'custom'`), talenty, `threat.selected` i bazowe `maxHealth` gracza (`roomPlayer.json`). Presety nie czytają talentów ani poziomu zagrożenia.
- Przy `run_ended` (śmierć i zwycięstwo, także presety): `applyRun(summary, runIdOf(state))` → `saveMetaManager` → `clearRun`. Błąd zapisu meta jest logowany i nie blokuje `clearRun` ani podsumowania. Powtórne zakończenie tego samego runu (`runId` w `appliedRunIds`) nie zmienia meta i nie pokazuje nagród.
- Podsumowanie runu pokazuje Doświadczenie, Dane, Rdzenie, awans („Awans: Poziom 3 → 4”, tylko gdy nastąpił) i „Odblokowano Poziom zagrożenia N”; przycisk „Wróć do kryjówki” (`?scene=hub`, zachowuje `debug=1`) jest pierwszy.
- Komendy debug (`registerMetaCommands`, w scenach `run` i `hub`): `meta state`, `meta xp <n>`, `meta data <n>`, `meta cores <n>`, `meta threat <n>` (ustawia `threat.max`, `MetaManager.debugSetThreatMax`), `meta unlock all`, `meta reset`; każda zmiana zapisuje meta. `query('meta')` i `query('level')` w `RunScene` i `HubScene`.
- Ręcznie: `?scene=run&loadout=meta&seed=x&debug=1`, `meta xp 40`, `run end win` → podsumowanie z nagrodami; po ponownym wejściu `query('meta')` pokazuje zapisany stan.
