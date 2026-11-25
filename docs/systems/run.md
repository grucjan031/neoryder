# Pętla runu (`RunState` i `RunManager`) — F3-05

Moduł `src/world/run.ts` odpowiada za czystą logikę stanu pętli runu (ADR 0005 pkt 4, 7, 9, 10) bez zależności od Three.js ani DOM.

Na tablicy misji w kryjówce zwykły run ma wybór dzielnicy. Domyślnie gracz wyrusza do Kurogane. Ukończenie `m07-nocny-dyzur` w kampanii odblokowuje Bulwar Helixy Dynamics. Obie trasy mają osiem warstw. Ustawienie `lastDistrict` zapamiętuje wybór, a przy kontynuacji źródłem dzielnicy jest `sectorId` checkpointu. Starszy zapis bez identyfikatora wskazuje Kurogane. Misje, areny i wyzwanie dnia zachowują własne reguły startu.

Na Bulwarze ochroniarze i sanitariusze Helixy wchodzą do fal przez jawne pule sektora. Wspólny planer dodaje do ostatniej fali każdej elity jednego Egzekutora. Boss `securityChief` i jego przywołania pochodzą z pokoju i faz bossa.

Podgląd Bulwaru: `?scene=run&sector=bulwar&debug=1`. Pokoje otwiera `?scene=room-test&debug=1&room=` z identyfikatorem `combatClinic`, `combatMarketDeck` lub `eliteTerrace`. Podgląd tablicy: `?scene=hub&debug=1` i komenda `hub open missions`.

## Odpowiedzialności

- **Stan międzypokojowy (`RunState`):** `seed`, `sectorId`, `loadoutId` i pełny `loadout` (kopia ekwipunku zamrożona na starcie), `talents` (id bez duplikatów), `threatLevel` (całkowity, >= 0), `startedAtMs`, `elapsedS` (czas symulacji), `map` (`SectorMap`), `currentNodeId` (`null` przed pierwszym wyborem), `visited`, `hp`, `energy`, `credits`, `implants` (bez duplikatów), `stats.kills`, `stats.damage` (`melee`, `power`, `gun`, `other`). Pola opcjonalne: `difficulty` (pomijane dla `normal`), `modeId`, `missionId`, `objectives` (`pending | active | done` na id celu), `objectiveProgress` (0..1), `roomCredits` (patrz „Waluta runu"), `achievementProgress`. Ciepło broni nie jest przenoszone między pokojami (każdy pokój zaczyna z zimną bronią).
- **Wstrzykiwanie generatora mapy (`MapGenerator`):** konstruktor `RunManager` przyjmuje funkcję `generateMap: (seed: string) => SectorMap` (jako drugi argument lub w `RunManagerOptions`) oraz opcje `sector` (id i `economy`), `creditsPerThreat`, `eliteBonusCredits`, `initialHp`, `initialEnergy`, `now`. Domyślnie `creditsPerThreat` i `eliteBonusCredits` pochodzą z `sector.economy`, a bez niej wynoszą odpowiednio 5 i 0. Domyślne `initialHp` i `initialEnergy` to 100. Host `RunScene` podaje `maxHealth` i `maxEnergy` z `roomPlayer.json`.
- **Start runu (`newRun(seed, loadoutId = 'classic', options)`):** opcje `difficulty`, `arenaId`, `modeId`, `mission`, `loadout`, `talents`, `threatLevel`, `baseMaxHealth`. `modeId` i `mission` wykluczają się (błąd). Z `modeId` mapa jest jednowęzłowa (patrz `modes.md`), inaczej `generateMap(seed)`; mapa przechodzi `sectorMapSchema`. Ekwipunek: `options.loadout` albo preset `loadoutId` (nieznany = błąd). Talenty są deduplikowane; `hp` startowe = pełne `maxHealth`: `baseMaxHealth` (domyślnie `initialHp`) z modyfikatorami talentów; `credits` startowe = `runStartCredits` z talentów; `energy` = `initialEnergy`. `threatLevel` musi być całkowity >= 0 (inaczej błąd). `difficulty` bierze z opcji albo z ustawienia gracza. `sectorId` = id z opcji `sector`, a bez niej `map.sectorId` (tryb areny również dostaje id sektora hosta). Przy misji `objectives` startują jako `pending`. Ekran `map`, `run_started { seed }`, zwraca kopię stanu. Sam start nie losuje niczego; losowość mapy siedzi w generatorze (patrz `sectorMap.md`).
- **Maszyna ekranów (`RunScreen`):** `map | room | reward | shop | rest | summary`:
  - `restore(state)` waliduje stan, ustawia ekran `map`, uznaje wszystkie `visited` za wyczyszczone i emituje `run_started`. `restoreEnded(state, summary)` odtwarza zakończony run od razu na `summary`, bez ponownego `run_ended`.
  - `selectNode(id)` (tylko ekran `map`) dopuszcza węzeł warstwy 1 (gdy `currentNodeId === null`) albo węzeł z `next` bieżącego; w trybie (`modeId`) dopuszczony jest wyłącznie bieżący, jedyny węzeł (można go wybrać ponownie). Zapamiętuje migawkę stanu sprzed wejścia, zeruje licznik zarobku pokoju, dopisuje węzeł do `visited`, przechodzi do `room`, cele misji tego węzła zmieniają `pending` → `active`, emituje `node_selected { nodeId, type }`.
  - `completeRoom(roomState?, puzzleOutcome?)` (tylko ekran `room`) zwraca `false`, gdy w misji któryś cel węzła nie jest `done`. Zapisuje opcjonalne `{ hp, energy }` z `RoomScene.exportState()` (obcięte do >= 0), zalicza przejście przez węzeł (pominięta zagadka nie liczy się do `roomsCleared`; pominięcie jest odrzucane w węźle z celami misji, w finale i w trybach) i wybiera ekran według poniższych reguł.
    - tryb (`modeId`) → `finish('victory')`;
    - misja i węzeł `fixed.final` → `finish('victory')`;
    - `combat` i `elite` przechodzą do `reward`. Elita przyznaje także `eliteBonusCredits`.
    - `shop` przechodzi do `shop`, a `rest` do `rest`.
    - `puzzle` przechodzi do `reward` po rozwiązaniu i do `map` po pominięciu. Nagroda zagadki korzysta z `rewardWeights.puzzle` i ogólnych reguł wyboru implantu.
    - `boss` przechodzi do `reward` w misji bez finału. Poza misją wywołuje `finish('victory')`.
  - `returnToMap()` (aliasy `completeReward()`, `leaveShop()`, `leaveRest()` sprawdzają właściwy ekran) zamyka `reward | shop | rest` i wraca na `map`.
  - `updateObjectives(objectives, progress)` kopiuje stan celów z pokoju do `RunState` (tylko w misji i aktywnym runie).
- **Waluta runu (Kredyty):**
  - `creditKill(threatCost)` nalicza `Math.round(threatCost * creditsPerThreat)` (0 dla kosztu niedodatniego, wyniku 0 lub po końcu runu) i deleguje do `addCredits`.
  - `addCredits(amount)` zaokrągla kwotę do całości i emituje `currency_changed { currency: 'credits', amount (nowy stan), delta }`. Ochrona przed farmieniem: poza ekranem `map` zarobek bieżącego pokoju sumuje się w liczniku, a do stanu trafia tylko nadwyżka ponad `roomCredits[nodeId]` (maksimum dotąd wypłacone za ten węzeł). `roomCredits` jest częścią zapisu, więc ponowna walka w tym samym pokoju po wczytaniu nie daje więcej niż poprzednio.
  - `spendCredits(amount)` zaokrągla i emituje ujemną deltę; kwota niedodatnia lub przekraczająca stan jest odrzucana (`false`) bez zdarzenia.
  - `checkpoint()` (zapis w trakcie pokoju i nagrody): poza ekranem `map` zwraca stan sprzed wejścia do pokoju (pozycja na mapie, hp, energia, statystyki) z aktualnymi `credits`, `implants` i `roomCredits` (oraz `hp` w sklepie). Nagrody zostają, walka i postęp po mapie wracają.
- **Brak pasywnego leczenia:** `step(dt)` tylko dolicza `elapsedS`. Zdrowie rośnie wyłącznie przez `heal(amount, maxHp?)` (zwraca 0 przy `hp <= 0`) lub `setHp(hp, maxHp?)`; `setEnergy` analogicznie.
- **Zbieranie statystyk ze strumienia `EventBus`:**
  - `entity_spawned` / `entity_despawned` śledzą id gracza (`kind === 'player'`) i pozostałych encji.
  - `enemy_killed` zwiększa `stats.kills`, gdy `killer` nie jest `null`, nie jest ofiarą ani znaną encją nie-gracza (a gdy znane jest id gracza, musi się z nim zgadzać).
  - `damage_dealt` (`amount > 0`, źródło = gracz, cel inny niż gracz) kumuluje obrażenia według pierwszego pasującego tagu: `#melee` → `melee`, `#power` → `power`, `#gun` → `gun`, reszta → `other`.
  - `implant_acquired` dopisuje id do `implants` bez duplikatów (są też jawne `addImplant` i `upgradeImplant(from, to)` - podmiana w tym samym miejscu listy, odrzucana, gdy `to` jest już posiadany).
  - `room_entered` i `room_cleared` podnoszą maksymalną osiągniętą warstwę.
  - `player_died` (id musi odpowiadać graczowi, jeśli znany) zeruje `hp` i kończy run `finish('death', cause)`, **z wyjątkiem** trybów `assault` i `heist`: tam śmierć odejmuje życie, a porażkę ogłasza host (patrz `runScene.md`).
- **Zakończenie i serializacja:**
  - `finish('victory' | 'death', cause?)` buduje `RunSummary`: `outcome`, `seed`, `loadoutId`, `elapsedS`, `kills`, `roomsCleared`, `elitesCleared`, `threatLevel`, `layerReached`, `implants`, `damage`, a warunkowo `modeId` oraz `missionId` + `missionCompleted` (= zwycięstwo). `roomsCleared` to liczba wyczyszczonych węzłów (przy zwycięstwie także bieżący); w trybie to `rewardRooms` trybu (6) przy zwycięstwie i 0 przy porażce. `layerReached` to maksimum z warstw: odwiedzonych, bieżącej, wyczyszczonych i wejść do pokoi. Następnie ekran `summary` i `run_ended { outcome, summary, cause? }` (`cause` tylko przy śmierci). Wywołanie powtórne jest idempotentne (zwraca zapamiętane podsumowanie, bez zdarzenia). Zwycięstwo w misji rzuca błąd, jeśli bieżący węzeł nie jest `final` albo jego cele nie są `done`.
  - Po przejściu na `summary` run jest nieaktywny: statystyki, Kredyty i implanty ignorują zdarzenia.
  - `serialize()` zwraca głęboką kopię `RunState` (z `roomCredits`, jeśli niepuste), a `restore(state)` waliduje ją schematem zod `runStateSchema` (m.in. unikalność implantów i talentów, obecność `currentNodeId` i `visited` w mapie).

## Zapis runu (`RunSave`, wersja zapisu 6) — F3-06

Moduł `src/core/save.ts` przechowuje `RunSave` z pełnym `run: RunState` (walidowany `runStateSchema` z `src/world/run.ts`); `SAVE_VERSION = 6` jest wspólna dla meta, runu i rekordu misji (ADR 0005 pkt 5):

- **Struktura:** `{ saveVersion: 6, seed, startedAt (= startedAtMs), run: RunState, ended?: { runId, summary } }`. `runId` = `"<seed>:<startedAtMs>"`. Pole `ended` oznacza run zakończony, ale nierozliczony z meta; brak pola = run w toku. `SaveStore` (pamięć i IndexedDB): `saveRun`, `loadRun`, `clearRun`, a osobno rekord misji liniowej (`loadMission`, `saveMission`, `clearMission`; patrz `missions.md`).
- **Migracje runu:** 1→2 szkielet v1 (tylko `seed` i `startedAt`) staje się brakiem runu (`loadRun()` zwraca `null` bez ostrzeżenia); 2→3 dopisuje `loadout` (kopia presetu z `loadoutId`, nieznany preset = zapis nieczytelny), `talents: []`, `threatLevel: 0`; 3→6 bez zmian danych. Migracje meta: 2→3 stan startowy meta, 3→4 `campaign { completed: [], pendingDebrief: null }`, 4→5 `achievements`, 5→6 bez zmian.
- **Ochrona danych gracza:**
  - Zapis z przyszłej wersji (`saveVersion > SAVE_VERSION`) zwraca `null` z ostrzeżeniem i blokuje nadpisanie oraz skasowanie, pozostawiając dane nietknięte.
  - Uszkodzony zapis (np. brak `run`, nieznany `currentNodeId`, zduplikowane implanty, błędne typy) jest odrzucany przez walidację zod, loguje `console.warn` i zwraca `null`.

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
wykluczone. Algorytm losowania (`drawImplants`), deterministyczny dla seeda:
pula (implanty nieposiadane) jest sortowana rosnąco po id; dla każdej z (do) trzech
pozycji: z rzadkości `common, rare, epic, legendary`, które mają jeszcze implant w puli
i wagę > 0 w `rewardWeights[typ węzła]`, losowana jest rzadkość (`rng.next() * suma wag`,
odejmowanie kolejnych wag w tej kolejności), następnie `rng.pick` z implantów tej
rzadkości (w kolejności id), a wylosowany wypada z puli. Gdy żadna rzadkość nie jest
dostępna, losowanie się kończy (mniej niż trzy oferty). Całkowicie pusta oferta daje
Kredyty w wysokości `economy.puzzleCredits` zamiast implantu. Strumień:
`new Rng(seed).fork('reward:<nodeId>')`. Oferta jest losowana raz na węzeł i
pamiętana w pamięci (po wczytaniu zapisu losowana ponownie z tym samym strumieniem, ale
już względem aktualnie posiadanych implantów). Zdarzenie `reward_offered` jest emitowane
raz dla danego ekranu nagrody.

Sklep losuje trzy implanty tym samym algorytmem przez `new Rng(seed).fork('shop:<nodeId>')`
i `rewardWeights.shop`. Ceny według rzadkości (`economy.shopPrices`), cena leczenia
(`shopHealPrice`) i ułamek leczenia (`shopHealFraction` maksimum zdrowia) są w
`kurogane.json` (35 Kredytów, 0,3). Zakup bez środków jest odrzucany; kupiony implant
znika bez ponownego losowania towaru. Leczenie przy pełnym zdrowiu jest odrzucane i nie
pobiera opłaty. Zakup emituje `shop_purchase { item, kind, price }`. Zero ceny jest
obsługiwane jako darmowy zakup.

Odpoczynek pozwala raz wybrać leczenie `restHealFraction` (0,4) maksimum albo zastąpienie
implantu jego `upgradesTo`. Cel musi mieć dokładnie następną rzadkość i nie może
być już posiadany. `rest_used.implant` wskazuje zastępowany implant (`null` przy
leczeniu). Ulepszenie emituje `implant_acquired` z `source: 'upgrade'`. Nie ma leczenia
pasywnego; zwiększenie maksimum przez implant zachowuje regułę dodania różnicy HP.

RunScene korzysta z istniejącego `creditKill(threatCost)` (stawka `creditsPerThreat` = 5)
oraz bonusu za wyczyszczenie elity (`eliteBonusCredits` = 30).
Pusta pula implantów daje `puzzleCredits` = 60. Wszystkie wartości są w sekcji `economy`
sektora. Tymczasowe ekrany pokazują rzeczywiste oferty i ceny, obsługują
mysz, 1/2/3, Enter oraz Tab dla dalszych opcji. Docelowy styl pozostaje dla F3-14.

Sprawdzenie ręczne: `?scene=run&debug=1&seed=economy`, `run clear`, wybór nagrody,
`credits 500`, wejście do sklepu, zakup i leczenie, następnie odpoczynek i ulepszenie.
`implant <id>` działa na mapie oraz w aktywnym pokoju; `credits <n>` działa w runie.

Podsumowanie runu pokazuje wynik, czas symulacji, zabójstwa, pokoje, warstwę, implanty, seed i obrażenia według czterech ścieżek. „Nowy run" zachowuje build i losuje nowy seed (cztery losowe liczby 32-bitowe zapisane szesnastkowo i połączone `-`, z `crypto.getRandomValues`); w trybie areny zachowuje też `mode`, a ekwipunek z kryjówki wraca jako `loadout=meta`. Menu prowadzi pod `/`. Do kontroli służą `?scene=run` i komendy `run end win|lose`.

## F4-06: start z kryjówki i nagrody meta

`?scene=run&loadout=meta` startuje run z `MetaState` (ekwipunek, talenty, Poziom zagrożenia, `loadoutId: 'custom'`); presety `?loadout=<id>` działają jak w F3. Przy `run_ended` `RunScene` zapisuje ślad `ended` w zapisie runu, a następnie `applyRun` → zapis meta → `clearRun` (każdy run; `applyRun` jest idempotentne po `runId`), a podsumowanie pokazuje nagrody i przycisk „Wróć do kryjówki”. Tagi i nazwę ekwipunku w ekranach bierze z `RunState.loadout`, nie z presetu. Rozliczenie, które nie skończy się w `tuning.run.rewardSaveTimeoutS` (10 s), pokazuje błąd i pozwala ponowić; błąd walidacji (`apply`) pozwala tylko „Porzucić nagrodę”. Szczegóły: `docs/systems/meta.md` („Zapis i integracja z runem”).
