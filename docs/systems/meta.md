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

`setLoadout({ blade, weapons, powers })`: ostrze, bronie i moce muszą być odblokowane; 1..`weaponSlots` unikalnych broni i 1..`powerSlots` unikalnych mocy. `loadout()` zwraca pełny `Loadout` (`id: 'custom'`, `name: 'Własny'`, `startHeld: 'blade'`, `tags: []`).

## Zdarzenia

`meta_rewards` (po `applyRun`, potem `level_up` dla każdego zdobytego poziomu), `unlock_purchased`, `loadout_changed`, `threat_selected`. Brak magistrali = brak emisji.

## Komendy debug (metody)

`debugAddXp`, `debugAddData`, `debugAddCores`, `debugUnlockAll`, `debugReset`. Podpięcie do konsoli: zadanie F4-06.

## Łatki definicji

(zadanie F4-03)

## Talenty

Pełny opis (drzewka, progi, lista węzłów, działanie w pokoju): `docs/systems/talents.md`.

- `buyTalent(id)`: węzeł istnieje i nie jest kupiony, `freePoints >= cost`, wszystkie `requires` kupione, punkty wydane w drzewku węzła (`spentInTree`) ≥ `tierThresholds[tier - 1]`, każde `requiresTreePoints[drzewko]` spełnione. Błąd to `Error` z polskim komunikatem; sukces emituje `talents_changed`.
- `resetTalents()`: darmowy, pełny; czyści listę (punkty wracają do puli) i emituje `talents_changed`.
- `spentInTree(drzewko)`: suma `cost` kupionych węzłów drzewka. `spentPoints` to suma po wszystkich drzewkach (łącznie z hybrydami).
- `debugGrantTalent(id)`: bez kosztu i bez progów (konsola debug).
- Talenty zamraża `RunManager.newRun` w `RunState.talents`; w pokoju działają przez `TalentSystem` (`src/progression/talents.ts`).
