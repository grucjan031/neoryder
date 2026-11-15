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

# F3-11: nagrody i ekonomia

Po `room_cleared` w pokojach `combat` i `elite` scena `RunScene` czeka
`tuning.run.rewardDelayS` (domyślnie 1 s, dostępne w lil-gui), zanim kończy
pokój i pokazuje wybór implantu. Odliczanie korzysta z czasu symulacji w `step`;
w tym czasie pokój nadal jest krokowany i renderowany, gracz może się poruszać,
a efekty śmierci wrogów dogrywają się. Ponowne `room_cleared` nie resetuje
odliczania, a koniec runu je anuluje. Komenda `run clear` korzysta z tego samego
opóźnienia. Sklep, odpoczynek i podsumowanie zachowują dotychczasowe przejścia.
`tests/unit/runScene.test.ts` sprawdza zdarzenie i komendę, brak nagrody przed
upływem sekundy oraz dalsze kroki pokoju.

Logika bez DOM: `src/progression/rewards.ts`, `shop.ts`, `rest.ts` oraz
`runEconomy.ts`. `RunEconomy` używa jawnego API `RunManager` i `ImplantSystem`;
obliczanie maksimum zdrowia i zmiany implantów przechodzą przez `Stats`.

Po combat/elite gracz wybiera jeden z trzech różnych implantów. Posiadane id są
wykluczone. Najpierw losowana jest rzadkość według `rewardWeights[type]`, następnie
implant z tej rzadkości. Puste rzadkości są pomijane i wagi pozostałych normalizowane.
Pula mniejsza niż trzy daje mniej ofert; całkowicie pusta daje Kredyty w wysokości
`economy.puzzleCredits`. Losowanie używa `Rng.fork('reward:<nodeId>')`, a zdarzenie
`reward_offered` jest emitowane raz dla danego ekranu nagrody.

Sklep losuje trzy implanty przez `fork('shop:<nodeId>')` i `rewardWeights.shop`.
Ceny według rzadkości, cena i ułamek leczenia są w `kurogane.json`. Zakup bez
środków jest odrzucany; kupiony implant znika bez ponownego losowania towaru.
Leczenie do maksimum nie pobiera opłaty przy pełnym zdrowiu. Zakup emituje
`shop_purchase`. Zero ceny jest obsługiwane jako darmowy zakup.

Odpoczynek pozwala raz wybrać leczenie `restHealFraction` maksimum albo zastąpienie
implantu jego `upgradesTo`. Cel musi mieć dokładnie następną rzadkość i nie może
być już posiadany. `rest_used.implant` wskazuje zastępowany implant. Nie ma leczenia
pasywnego; zwiększenie maksimum przez implant zachowuje regułę dodania różnicy HP.

RunScene korzysta z istniejącego `creditKill(threatCost)` oraz bonusu za wyczyszczenie
elity i Kredytów za zagadkę w RunManager. Wszystkie wartości startowe są w sekcji
`economy` sektora. Tymczasowe ekrany pokazują rzeczywiste oferty i ceny, obsługują
mysz, 1/2/3, Enter oraz Tab dla dalszych opcji. Docelowy styl pozostaje dla F3-14.

Sprawdzenie ręczne: `?scene=run&debug=1&seed=economy`, `run clear`, wybór nagrody,
`credits 500`, wejście do sklepu, zakup i leczenie, następnie odpoczynek i ulepszenie.
`implant <id>` działa na mapie oraz w aktywnym pokoju; `credits <n>` działa w runie.

Podsumowanie runu pokazuje wynik, czas symulacji, zabójstwa, pokoje, warstwę, implanty, seed i obrażenia według czterech ścieżek. Nowy run zachowuje build i losuje nowy seed; menu prowadzi pod `/`. Do kontroli służą `?scene=run` i komendy `run end win|lose`.

## F4-06: start z kryjówki i nagrody meta

`?scene=run&loadout=meta` startuje run z `MetaState` (ekwipunek, talenty, Poziom zagrożenia, `loadoutId: 'custom'`); presety `?loadout=<id>` działają jak w F3. Przy `run_ended` `RunScene` robi `applyRun` → zapis meta → `clearRun` (każdy run), a podsumowanie pokazuje nagrody i przycisk „Wróć do kryjówki”. Tagi i nazwę ekwipunku w ekranach bierze z `RunState.loadout`, nie z presetu. Szczegóły: `docs/systems/meta.md` („Zapis i integracja z runem”).
