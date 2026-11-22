# System: Meta-progres (MetaManager)

Źródła: `docs/adr/0007-meta-progres-f4.md`, `docs/api.md` (Kontrakty F4). Kod: `src/progression/meta.ts` (czysta logika, bez Three.js, DOM i UI). Dane: `src/data/meta/{progression,unlocks,threat}.json`. Zapis i podpięcie do gry robią inne zadania F4; ten dokument opisuje wyłącznie logikę.

## Stan

`MetaState` (`src/core/metaTypes.ts`): `campaign { completed: string[], pendingDebrief: string | null }` (ukończone misje liniowe i misja czekająca na odprawę), `xp`, `data` (Dane), `cores` (Rdzenie), `talents`, `unlocks`, `loadout { blade, weapons, powers, modules }`, `threat { max, selected }`, `stats { runs, victories, deaths, kills, bestVictoryS | null }`, `lastRuns` (najnowsze pierwsze, do `MAX_LAST_RUNS` = 10; rekord: `runId`, `outcome`, `elapsedS`, `layerReached`, `threatLevel`, `rewards`, opcjonalnie `achievements` = id naszywek zdobytych w runie), `appliedRunIds` (do `MAX_APPLIED_RUN_IDS` = 20, najstarsze wypadają), `achievements { unlocked, counters }` (opis w `achievements.md`). `MetaManager` trzyma kopię stanu; `state` i `serialize()` zwracają `structuredClone`. `MetaManager.restore(data)` waliduje `metaStateSchema` (m.in. `loadout.weapons` 1..3, `loadout.powers` 1..2, `threat.selected <= threat.max`, liczby całkowite >= 0; uszkodzone `achievements` zamieniane na puste). Błędy zmian to wyjątki `Error` z polskim komunikatem (jak w `shop.ts`).

Stan startowy (`createStarterMetaState`, dane `progression.json.starter`): 0 XP, 0 Danych, 0 Rdzeni, brak talentów, odblokowania `blade:plasmaBlade`, `weapon:blaster`, `weapon:pistol`, `power:push`; ekwipunek: ostrze `plasmaBlade`, broń `blaster`, moc `push`, brak modułów; zagrożenie `max 0`, `selected 0`; puste statystyki, historia i naszywki. Walidacja startu: `xp` = 0, ekwipunek startowy musi być odblokowany i znany.

## Poziom i punkty talentów

`levelFromXp(xp, xpToNext)` → `{ level, xpIntoLevel, xpForNext }`. Poziom 1 przy 0 XP; `xpToNext[n - 1]` to XP z poziomu n na n + 1; limit poziomu = `xpToNext.length + 1` = 20. Krzywa (`progression.json.levels.xpToNext`, niemalejąca): 50, 115, 130, 150, 175, 200, 230, 265, 305, 350, 405, 465, 535, 615, 710, 815, 935, 1075, 1240. Na limicie `xpForNext` = `null`, a XP nadal się sumuje. `talentPoints(level) = level - 1`; `freePoints = talentPoints - spentPoints`, gdzie `spentPoints` to suma `cost` kupionych węzłów wg drzewek (nieznany id = 0).

## Nagrody za run

`computeRunRewards(summary, threatLevel, rules)`, `m` = `rewardMult` poziomu zagrożenia runu:

- `xp = round((roomsCleared·xpPerRoom + elitesCleared·xpPerElite + (zwycięstwo ? xpVictory : 0)) · m)`
- `data = round((roomsCleared·dataPerRoom + kills·dataPerKill + (zwycięstwo ? dataVictory : 0)) · m)`
- `cores = elitesCleared·coresPerElite + (zwycięstwo ? coresVictory + victoryCores(poziomu) : 0)`

Śmierć daje 100% nagród (bez składników zwycięstwa). Rdzenie za elity i zwycięstwo nie są mnożone przez `rewardMult` (dodaje się tylko `victoryCores`). Liczby w `progression.json.rewards`: `xpPerRoom` 25, `xpPerElite` 40, `xpVictory` 50, `dataPerRoom` 5, `dataPerKill` 1, `dataVictory` 30, `coresPerElite` 1, `coresVictory` 3. `rewardMult` i `victoryCores` poziomów zagrożenia: patrz „Poziom zagrożenia w meta”.

**Misje liniowe** (misja z polem `level`): pierwsze ukończenie misji liniowej daje zwykłe nagrody runu z `computeRunRewards` oraz jednorazowy bonus `firstClear`, każde kolejne ukończenie daje same zwykłe nagrody runu, a próba nieukończona daje 0 nagród. Gdy `outcome = victory`, `missionCompleted` i `missionId` są ustawione, a misja nie jest jeszcze w `campaign.completed`, dolicza się jednorazowo `mission.rewards.firstClear` (`data`, opcjonalnie `cores`) do `rewards` i dopisuje misję do `campaign.completed`; każde takie zwycięstwo ustawia `campaign.pendingDebrief` na id misji (`clearDebrief()` zeruje). Nieznana misja przy takim zwycięstwie to błąd.

## applyRun i idempotencja

`applyRun(summary, runId)`; `runIdOf({ seed, startedAtMs })` = `${seed}:${startedAtMs}`. Jeśli `runId` jest w `appliedRunIds`, nic się nie zmienia i wynik ma `applied: false` (zerowe nagrody, `achievements: []`). `summary.threatLevel` spoza `threat.json` to błąd. W przeciwnym razie: dodaje nagrody, aktualizuje `stats` (`runs`, `victories` albo `deaths`, `kills` += `summary.kills`, `bestVictoryS` = najkrótszy czas zwycięstwa), `lastRuns` (nowy rekord na początku, maks. 10), `appliedRunIds` (maks. 20), przyznaje postęp osiągnięć (opis w `achievements.md`; id zdobytych naszywek trafiają do rekordu `lastRuns`) i emituje zdarzenia. Wynik: `{ applied, rewards, levelBefore, levelAfter, threatUnlocked, achievements }` (`achievements`: nowe naszywki z jednorazową nagrodą, doliczoną do `data`/`cores` poza `rewards`).

## Poziom zagrożenia w meta

`threat.max` rośnie o 1 tylko po zwycięstwie runu (nie misji liniowej) na poziomie równym `threat.max`, najwyżej do ostatniego poziomu z `threat.json` (10). `selectThreat(level)` przyjmuje liczbę całkowitą 0..`threat.max`, inaczej błąd.

`threat.json` (poziomy kolejne od 0, poziom 0 neutralny: `enemyHealth` 0, `enemyDamage` 0, `budgetMult` 1, `rewardMult` 1): `enemyHealth` = poziom × 0,1; `enemyDamage` = poziom × 0,05; `budgetMult` = 1 + poziom × 0,1; `rewardMult` = 1 + poziom × 0,15 (poziomy 0–10: 1, 1,15, 1,3, 1,45, 1,6, 1,75, 1,9, 2,05, 2,2, 2,35, 2,5); `victoryCores`: 0 (poz. 0), 1 (1–3), 2 (4–6), 3 (7–9), 4 (10). Nazwy: Rutyna, Podwyższona czujność, Alarm, Wzmocniony patrol, Obława, Stan wyjątkowy, Blokada dzielnicy, Pełna mobilizacja, Nocna czystka, Zero tolerancji, Totalna blokada. Działanie poziomów w grze: `docs/systems/threat.md`.

## Odblokowania i sloty

`buyUnlock(id)`: kolejność kontroli: id istnieje w `unlocks.json` („Nieznane odblokowanie”), nie jest posiadane („Już odblokowane.”), naszywka z `requiresAchievement` zdobyta („Wymagana naszywka: <tytuł>.”), `minLevel` („Wymagany poziom N.”), `cost.data` i `cost.cores` („Za mało Danych.” / „Za mało Rdzeni.”); odejmuje walutę, dopisuje id, emituje `unlock_purchased` i przyznaje naszywkę `pierwszy-zakup`. Cennik (`unlocks.json`, id: koszt, `minLevel`; D = Dane, R = Rdzenie): `module:collimator` 140 D, 2; `module:scope` 220 D, 5; `module:ricochet` 160 D, 3; `module:pierce` 180 D, 4; `module:incendiary` 200 D, 4; `module:superconductor` 6 R, 5 (naszywka `reka-strzelca`); `weapon:rifle` 80 D, 1; `weapon:scatter` 100 D, 2; `weapon:emp` 120 D, 3; `weapon:sniper` 140 D, 3; `weapon:beam` 180 D, 4; `power:grab` 80 D, 1; `power:shockwave` 100 D, 2; `power:chain` 140 D, 3; `power:barrier` 160 D, 4; `power:focus` 12 R, 5 (`glos-rezonansu`); `blade:twinBlades` 200 D, 4; `blade:staffBlade` 14 R, 6 (`taniec-ostrza`); `slot:weapon2` 100 D, 2; `slot:power2` 8 R, 3; `slot:weapon3` 10 R, 4 (`weteran-hut`). `weaponSlots` = 1 + liczba posiadanych `slot:weapon2`/`slot:weapon3`; `powerSlots` = 1 + `slot:power2`.

## Ekwipunek

`setLoadout` zapisuje tylko moduły, które przeszły walidację: nieznane i niezgodne z bronią są pomijane, a zgodny moduł bez odblokowania odrzuca całą zmianę.

`setLoadout({ blade, weapons, powers, modules })`: ostrze, bronie i moce muszą być odblokowane; 1..`weaponSlots` unikalnych broni i 1..`powerSlots` unikalnych mocy. `modules: Record<string, string[]>` przypisuje moduły wybranym broniom. Wymagane są odblokowania `module:<id>`, brak duplikatów w broni oraz limit `progression.json.moduleSlotsPerWeapon` (3), po jednym module na Wylot, Ogniwo i Optykę; klucze `modules` muszą być bronią z ekwipunku. Moduł nieznany lub niezgodny z `weaponKinds` (rodzaj `fireMode` broni) jest przy walidacji pomijany (nie powoduje błędu), a przy budowie `loadout()` odrzucany (`sanitizeModules`: zachowuje pierwszy moduł każdego slotu, najwyżej 3). Jeden moduł może być użyty w kilku broniach. Walidacja jest atomowa (przy błędzie ekwipunek się nie zmienia).

`loadout()` zwraca pełny `Loadout` (`id: 'custom'`, `name: 'Własny'`, `startHeld: 'blade'`, `tags: []`) z głęboką kopią modułów. Brak `modules` w starych zapisach meta v3 uzupełnia się przez `{}` bez migracji. Moduły zostają zamrożone na start runu wraz z ekwipunkiem. Dane, ceny, UI i wykonanie łatek opisuje `docs/systems/weaponModules.md`.

## Wydobycie modułów (zapis v7)

`MetaState.pendingExtractions: { runId, moduleIds }[]` (migracja meta v6→v7 dopisuje `[]`). `applyRun` zapisuje ofertę z `RunSummary.foundModules` (znane, jeszcze nieodblokowane, bez duplikatów): po zwycięstwie wszystkie, po śmierci losowo (`Rng` z seeda runu) najwyżej `tuning.run.deathModulePoolSize`. `extractModule(runId, moduleId)` zużywa ofertę runu i dodaje odblokowanie `module:<id>`; moduł montuje się w warsztacie jak każdy odblokowany. Łup powstaje jako dodatkowa opcja na ekranie nagrody po elicie (`tuning.run.eliteModuleOfferSize`). Kontrakt: `docs/api.md`.

## Zdarzenia

`meta_rewards` (po `applyRun`, potem `level_up` dla każdego zdobytego poziomu, potem `achievement_unlocked` dla każdej nowej naszywki), `unlock_purchased`, `loadout_changed`, `threat_selected`, `talents_changed`, `achievement_unlocked` (także przy zakupie, poziomie 10 i komendzie debug). Brak magistrali = brak emisji.

## Komendy debug (metody)

`debugAddXp` (emituje `level_up`, przyznaje `poziom-10`), `debugAddData`, `debugAddCores` (wartość nieskończona, `NaN` lub ujemna: `Error` bez zmiany stanu; część ułamkowa odcinana), `debugSetThreatMax`, `debugUnlockAll` (dodaje wszystkie id z `unlocks.json`), `debugGrantTalent`, `debugGrantAchievement`, `debugReset` (stan startowy). Podpięcie do konsoli: `registerMetaCommands` (sekcja „Zapis i integracja z runem”).

## Łatki definicji

Format, kolejność i błędy łatek: `docs/systems/patches.md`. Łatki pochodzą z talentów (`effects.patches`) i z modułów broni.

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
- `saveMetaManager(store, manager)`: `MetaSave` w bieżącej `SAVE_VERSION` (7), `createdAt` zachowany, `updatedAt` ustawiony. Zapisy do jednego `SaveStore` są kolejkowane, a migawka stanu powstaje przy wywołaniu. Z tej pary korzystają `RunScene`, komendy debug i kryjówka (zadania 08–10).
- `RunScene` wczytuje meta przy starcie (każdy run). `?loadout=meta` zamraża w `RunState` ekwipunek (`loadout()`, `loadoutId: 'custom'`), talenty, `threat.selected` i bazowe `maxHealth` gracza (`src/data/scenes/roomPlayer.json`, 100). Presety nie czytają talentów ani poziomu zagrożenia.
- Przy `run_ended` (śmierć i zwycięstwo, także presety): zapis runu ze śladem `ended`, świeży odczyt meta (`loadMetaManagerStrict`), `applyRun(summary, runIdOf(state))`, `saveMetaManager`, `clearRun` (szczegóły, błędy i ponawianie: `docs/systems/reliability.md`). Błąd odczytu, naliczenia lub zapisu meta przerywa rozliczenie przed `clearRun`: ślad `ended` zostaje, a podsumowanie oferuje ponowienie albo „Porzuć nagrodę”. Powtórne zakończenie tego samego runu (`runId` w `appliedRunIds`) nie zmienia meta i nie pokazuje nowych nagród.
- Podsumowanie runu pokazuje Doświadczenie, Dane, Rdzenie, awans („Awans: Poziom 3 → 4”, tylko gdy nastąpił) i „Odblokowano Poziom zagrożenia N”; przycisk „Wróć do kryjówki” (`?scene=hub`, zachowuje `debug=1`) jest pierwszy.
- Komendy debug (`registerMetaCommands`, w scenach `run` i `hub`): `meta state`, `meta xp <n>`, `meta data <n>`, `meta cores <n>`, `meta threat <n>` (ustawia `threat.max`, `MetaManager.debugSetThreatMax`), `meta unlock all`, `meta reset`, `achievement grant <id>`; każda zmiana zapisuje meta. Argumenty liczbowe to liczby całkowite >= 0. `query('meta')` i `query('level')` w `RunScene` i `HubScene`.
- Ręcznie: `?scene=run&loadout=meta&seed=x&debug=1`, `meta xp 40`, `run end win` → podsumowanie z nagrodami; po ponownym wejściu `query('meta')` pokazuje zapisany stan.
