# Pętla runu (`RunState` i `RunManager`) — F3-05

Moduł `src/world/run.ts` odpowiada za czystą logikę stanu pętli runu (ADR 0005 pkt 4, 7, 9, 10) bez zależności od Three.js ani DOM.

## Odpowiedzialności

- **Stan międzypokojowy (`RunState`):** przechowuje ziarno (`seed`), sektor (`sectorId`), wybrany ekwipunek (`loadoutId`), czas startu (`startedAtMs`), czas symulacji (`elapsedS`), pełną mapę sektora (`SectorMap`), bieżący węzeł (`currentNodeId`), odwiedzone węzły (`visited`), zdrowie (`hp`), energię Rezonansu (`energy`), Kredyty (`credits`), listę posiadanych implantów (`implants`, bez duplikatów) oraz statystyki bojowe (`stats.kills`, `stats.damage`). Ciepło broni nie jest przenoszone między pokojami (każdy pokój zaczyna z zimną bronią).
- **Wstrzykiwanie generatora mapy (`MapGenerator`):** konstruktor `RunManager` przyjmuje funkcję `generateMap: (seed: string) => SectorMap` (jako drugi argument lub w `RunManagerOptions`), co uniezależnia moduł od generatora mapy z zadania F3-02 i ułatwia deterministyczne testy jednostkowe.
- **Maszyna ekranów (`RunScreen`):** `map | room | reward | shop | rest | summary`:
  - `newRun(seed, loadoutId)` oraz `restore(state)` ustawiają ekran `map` i emitują `run_started { seed }`.
  - `selectNode(id)` (dozwolone wyłącznie na ekranie `map`) sprawdza, czy węzeł należy do warstwy 1 (na starcie runu, gdy `currentNodeId === null`) albo do tablicy `next` bieżącego węzła. Przy poprawnym wyborze aktualizuje `currentNodeId`, dopisuje węzeł do `visited`, przechodzi do `room` i emituje `node_selected { nodeId, type }`.
  - `completeRoom(roomState?)` (dozwolone wyłącznie na ekranie `room`) zapisuje opcjonalny stan wyjściowy pokoju (`{ hp, energy }` z `RoomScene.exportState()`), oznacza pokój jako wyczyszczony i przechodzi do:
    - `reward` dla `combat` oraz `elite` (dla `elite` dolicza także `eliteBonusCredits`, jeśli skonfigurowano),
    - `shop` dla `shop`,
    - `rest` dla `rest`,
    - `map` dla `puzzle` (dolicza `puzzleCredits`, jeśli skonfigurowano),
    - `summary` dla `boss` (`finish('victory')`).
  - `returnToMap()` (oraz aliasy `completeReward()`, `leaveShop()`, `leaveRest()`) zamykają ekran po-pokojowy (`reward | shop | rest`) i wracają na `map`.
- **Waluta runu (Kredyty):**
  - `creditKill(threatCost)` nalicza `Math.round(threatCost * creditsPerThreat)` Kredytów i deleguje do `addCredits`.
  - `addCredits(amount)` i `spendCredits(amount)` emitują `currency_changed { currency: 'credits', amount, delta }`. Wydanie kwoty przekraczającej stan Kredytów lub niedodatniej jest odrzucane (`false`) bez zmiany stanu i bez emisji zdarzenia.
- **Brak pasywnego leczenia:** `step(dt)`, `selectNode`, `completeRoom` i `returnToMap` nigdy nie regenerują zdrowia. Zdrowie w `RunState` rośnie wyłącznie przez jawne wywołania `heal(amount, maxHp?)` lub `setHp(hp, maxHp?)` (odpoczynek, sklep, wzrost `maxHealth` z implantu).
- **Zbieranie statystyk ze strumienia `EventBus`:**
  - `entity_spawned` / `entity_despawned` śledzą id encji gracza (`kind === 'player'`) i wrogów, aby odróżnić ciosy gracza od obrażeń otrzymywanych.
  - `enemy_killed` zwiększa `stats.kills`, gdy zabójcą jest gracz (`killer !== null`, nie wróg).
  - `damage_dealt` zadane przez gracza kumuluje obrażenia według tagów: `#melee` → `melee`, `#power` → `power`, `#gun` → `gun`, pozostałe (np. czyste obrażenia statusu `#status`) → `other`.
  - `implant_acquired` dopisuje id implantu do `state.implants` z zachowaniem unikalności (dostępne są też jawne metody `addImplant` i `upgradeImplant`).
  - `player_died` zeruje `hp` w stanie i kończy run porażką (`finish('death')`).
- **Zakończenie i serializacja:**
  - `finish('victory' | 'death')` buduje `RunSummary` (`outcome`, `seed`, `loadoutId`, `elapsedS`, `kills`, `roomsCleared`, `layerReached`, `implants`, `damage`), przechodzi do `summary` i emituje `run_ended` (idempotentnie — kolejne wywołania nie duplikują zdarzenia).
  - `serialize()` zwraca głęboką kopię `RunState`, a `restore(state)` waliduje ją schematem zod `runStateSchema` (sprawdza m.in. unikalność implantów i obecność `currentNodeId` oraz `visited` w mapie).

## Zapis runu (`RunSave` v2 i migracja 1→2) — F3-06

Moduł `src/core/save.ts` rozszerza `RunSave` o pełny stan `run: RunState` (walidowany schematem `runStateSchema` z `src/world/run.ts`) i podnosi `SAVE_VERSION` do `2` (ADR 0005 pkt 5):

- **Struktura `RunSave` v2:** `{ saveVersion: 2, seed: string, startedAt: number, run: RunState }`. Sygnatury `saveRun`, `loadRun` i `clearRun` w `SaveStore` (zarówno `createMemorySaveStore`, jak i `createIndexedDbSaveStore`) pozostają bez zmian.
- **Migracja 1→2:**
  - `MetaSave` (v0 i v1) migruje do wersji `2` neutralnie (pola `createdAt` i `updatedAt` pozostają nietknięte).
  - Szkielet `RunSave` z wersji v1/v0 (posiadający jedynie `seed` i `startedAt`, bez stanu `run`) jest podczas migracji 1→2 traktowany jako brak aktywnego runu (`loadRun()` zwraca `null` bez ostrzeżenia), a miejsce w magazynie można nadpisać nowym zapisem v2.
- **Ochrona danych gracza:**
  - Zapis z przyszłej wersji (`saveVersion > SAVE_VERSION`) zwraca `null` z ostrzeżeniem przy odczycie oraz blokuje nadpisanie (`saveRun`, `saveMeta`) i skasowanie (`clearRun`), pozostawiając dane w magazynie nietknięte.
  - Uszkodzony zapis (np. v2 bez pola `run`, nieznany `currentNodeId`, zduplikowane implanty, błędne typy pól w v1 lub v2) jest odrzucany przez walidację zod, loguje ostrzeżenie `console.warn` i zwraca `null`.

## Weryfikacja

Testy jednostkowe: `tests/unit/run.test.ts`, `tests/unit/save.test.ts` (`npm test`).
