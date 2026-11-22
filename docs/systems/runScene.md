# Host runu — F3-07

`src/scenes/run.ts`, scena `?scene=run&seed=test1&loadout=classic&debug=1`.
Host składa `RunManager`, pokoje i ekrany; logika stanu pozostaje w
`src/world/run.ts`. Kontrakty rozszerzeń są w `docs/api.md`.

## Parametry startu

- `seed` (domyślnie `String(ctx.rng.getState())`), `loadout` (preset, domyślnie `classic`, albo `meta` = ekwipunek, talenty i Poziom zagrożenia z kryjówki, `loadoutId: 'custom'`), `continue=1` (wznowienie), `mission=<id>`, `mode=<conquest|assault|heist>`, `arena=<id>` (tylko debug).
- Tryb areny wybiera także `scene=conquest` i `scene=weatherTest` (oba → `conquest`). `mode` i `mission` razem to błąd; misja z niespełnionym `requires` (nieukończone w `campaign.completed`) to błąd „Misja jest zablokowana".
- Arena Przejęcia: `selectArena(conquestMode, ?seed, ?arena, debug)`. Bez `seed` w URL pierwsza arena listy, z `seed` `new Rng(seed).fork('conquest-arena').pick(arenas)`, z `arena` w debug wymuszona (id spoza listy = błąd). Wynik trafia do `MapNode.fixed.roomId`. Wywołanie wykonuje się też dla `assault` i `heist`, ale tylko `conquest` używa wyniku (a `?arena=` poza listą Przejęcia w debug rzuci błąd także dla nich).
- Tryb areny (`modeId` w stanie): host sam wybiera jedyny węzeł mapy zaraz po starcie i czeka na załadowanie pokoju.
- Nowy run przy zostawionym, nierozliczonym zapisie (`ended`) najpierw rozlicza tamten (jego podsumowanie); jeśli odczyt zapisu się nie uda, nowy run jest wstrzymany (błąd), żeby nie nadpisać nagrody.

## Przepływ

- Start generuje mapę sektora Kurogane Arms (dla `mission` `generateMissionMap`, dla trybu mapę jednowęzłową). `run_started` emituje wyłącznie
  `RunManager`; `main.ts` pomija własną emisję dla sceny `run`.
- Wybór dostępnego węzła (mysz, 1/2/3, Enter; Tab pozwala wybrać czwarty)
  tworzy nowy `RoomScene` i świat Rapier. Host przekazuje kopię `RunState`,
  ten sam EventBus i `new Rng(seed).fork('room:<nodeId>')` (to jest `ctx.rng` pokoju:
  z niego pokój losuje m.in. spawny trybów i typ wroga).
- **Wybór układu pokoju (`chooseRoom`), deterministycznie:** węzeł `fixed` bierze pokój
  `fixed.roomId` bez losowania. Inaczej pula kandydatów to: wpis `roomPools` misji pasujący
  do typu i zakresu warstw, a bez niego `sector.roomPools[typ]`, a bez niej wszystkie pokoje tego typu.
  Odrzucane są pokoje z `arena.exclusive` oraz (poza misją) o id kończącym się na `Mission`;
  jeśli nic nie zostanie, zapasem są pokoje `combat` po tych samych filtrach. Kandydaci są
  sortowani rosnąco po id, wybór to `new Rng(seed).fork('room-layout:<nodeId>').pick(...)`.
- **Fale:** `planWaves(layout, sektor, węzeł, new Rng(seed), threatLevel)` (osobny `Rng(seed)`, planner sam robi swój fork pokoju; patrz `threat.md`). Boss bez `bossEnemy` jest planowany jak `combat`. W misji z polem `enemies` host klonuje sektor, zeruje `threat.unlockLayer` i zawęża pule wrogów `combat`/`elite` do `mission.enemies`.
- `combat` i `elite`: `room_cleared` → odliczanie `tuning.run.rewardDelayS` → eksport HP/energii
  → zniszczenie pokoju → nagroda → Dalej → mapa. Brak pasywnego leczenia. Na ekranie nagrody „Dalej"
  jest zablokowane, dopóki są oferty; przy pustej puli daje Kredyty (`economy.puzzleCredits`).
- `shop` i `rest`: gracz wchodzi do małego pokoju fizycznego (`shopRoom`,
  `restRoom`, bez punktów spawnu). Pokój nie ma fal (host przekazuje puste
  `WavesDefinition`), po inicjalizacji jest czyszczony bez kroku walki, co
  otwiera exit i od razu otwiera nakładkę sklepu/odpoczynku. Wyjdź zamyka
  nakładkę, niszczy pokój i wraca na mapę.
- `puzzle`: po wczytaniu gracz przejmuje sterowanie w pokoju bez fal.
  `room_cleared` albo `puzzle_skipped` pokazuje przez `tuning.puzzle.resultHoldS`
  stan w HUD zagadki (otwarte drzwi), potem pokój jest niszczony: po rozwiązaniu
  następuje ekran wyboru implantu, po pominięciu powrót na mapę bez nagrody.
  Oba przejścia eksportują HP i energię.
- Puste `WavesDefinition` (`firstBreakS = breakS = 0`, `minSpawnDistance = 0`, bez fal) dostają też pokoje trybów i boss z `bossEnemy`. Wartość `maxAlive` to limit trybu, `layout.maxAlive ?? 1` dla bossa i 1 dla sklepu, odpoczynku lub zagadki.
- `boss`: układ z `bossEnemy` (`bossRoom`) dostaje puste `WavesDefinition` jak sklep
  (host nie woła `planWaves`), `RoomScene` w trybie bossa pomija `WaveDirector` i
  tuż po wejściu tworzy bossa w punkcie `props[kind=bossSpawn]` (domyślnie środek).
  `room_cleared` pada wyłącznie po śmierci bossa (sługi giną razem z nim i nie
  liczą się), potem `RunManager.completeRoom` kończy run zwycięstwem, bez nagrody
  (w misji boss prowadzi do ekranu nagrody, a zwycięstwo daje dopiero węzeł `final`).
  Po zwycięstwie (poza `fx=lite`) host trzyma pokój na ekranie `tuning.vfx.bossVictoryHoldS`
  (1,8 s): pokój krokuje dalej z pustym wejściem, `query('screen')` wciąż zwraca `room`,
  potem pokazuje podsumowanie. Przy porażce podsumowanie jest od razu.
  Układ boss bez `bossEnemy` zachowuje dawne zachowanie (fale combat).
  Śmierć gracza działa jak w innych pokojach. Komendy `boss phase` i
  `boss pattern` są przekazywane do pokoju; `query('boss')` zwraca
  `{ id, phase, hp, shield, minions }` lub `null`. Podgląd bez przechodzenia mapy:
  `?scene=room-test&room=bossRoom`, `kill all` powtarzany co ok. 1,1 s.
- `player_died` kończy run przez `RunManager` (wyjątek: `assault` i `heist`, patrz niżej);
  host rozlicza run (zapis z `ended`, meta, usunięcie zapisu), niszczy pokój
  i pokazuje podsumowanie z przyciskami (nowy run, kryjówka, menu `/`).
- **Tryby `assault` i `heist`:** `RunManager` ignoruje ich `player_died` (życia prowadzi tryb w pokoju).
  Co klatkę host pyta `room.query(modeId)`; gdy `outcome === 'death'`, ustawia `hp = 0` i woła
  `finish('death')` (bez `cause`). Zwycięstwo pochodzi z `room_cleared` → `completeRoom` → `finish('victory')`.
  Przejęcie (`conquest`) kończy się zwykłym `player_died` → `finish('death', cause)`.

Obsługa zakończenia pokoju/runu jest odroczona do końca kroku lub mikrozadania.
Świat nie jest zwalniany w środku `RoomScene.step`, `clear` ani strumienia
zdarzeń obrażeń. Zakończenie runu ma pierwszeństwo przed czyszczeniem pokoju.
`dispose()` podczas ładowania odpina hosta od razu, a pokój zwalnia po
zakończeniu jego inicjalizacji. Render i symulacja nie dotykają niegotowego pokoju.

## Integracje i elementy tymczasowe

`RunScreens` jest wstrzykiwany. Domyślne `HtmlRunScreens` w `src/ui/` używa
tekstów walidowanych przez zod z `src/data/ui/run.pl.json`. Nakładki zwalniają
kursor, wybór węzła wznawia grę przez `ctx.resume`. Ekran nagrody pokazuje
rzeczywiste oferty z `RunEconomy` (`reward_offered` z listą id), sklep ceny, odpoczynek
możliwe ulepszenia (patrz `run.md`, „F3-11"). Docelowy styl pozostaje dla F3-14.

`RunSavePort`: `loadRun`, `saveRun(state, ended?)`, `clearRun`, opcjonalnie `loadEnded`.
Domyślnie (`createRunSavePort`, `src/ui/runSave.ts`) pisze `RunSave` do IndexedDB
(`SaveStore`, wersja 6). Zapisy (operacje szeregowane, żeby zaległy zapis nie odtworzył
zakończonego runu):

- przy każdym wejściu na ekran mapy (pełny `serialize()` z postępem osiągnięć); URL dostaje wtedy `continue=1`, a `seed` i `loadout` są usuwane;
- w trakcie pokoju: po `implant_acquired` i `shop_purchase` natychmiast (mikrozadanie) i po `currency_changed` z opóźnieniem 2 s (`REWARD_SAVE_INTERVAL_MS`), zawsze stanem `RunManager.checkpoint()` (stan sprzed wejścia do pokoju + nagrody);
- po `run_ended`: zapis stanu z `ended { runId, summary }`, `applyRun` + zapis meta, dopiero potem `clearRun` (patrz `run.md`, „F4-06").

`?continue=1` odtwarza mapę i bieżący węzeł z portu; brak zapisu loguje ostrzeżenie i
przekierowuje na `/`. Zapis z `ended` wznawia się od razu na podsumowaniu i ponawia rozliczenie.
Błędy zapisu są widoczne w `query('saveError')` i konsoli.

Kredyty za zabójstwa gracza są przekazywane do `RunManager.creditKill`:
host śledzi `entity_spawned`/`entity_despawned` i `enemy_killed` (tylko gdy zabójcą jest
gracz i znany jest rodzaj wroga), odczytuje `threatCost` z istniejących definicji wrogów. Pokój ma osobny rejestr komend,
a host przekazuje do niego komendy walki; po zniszczeniu pokoju cheaty hosta
pozostają dostępne i nie występuje nadpisywanie `hurt`.

Misja w runie: host synchronizuje stan celów pokoju z `RunState` (`updateObjectives`)
co klatkę i przed `completeRoom`; `MissionRadio` dostaje sygnał `runStart` tylko na początku runu bez odwiedzonych węzłów.

## Debug i test ręczny

- `run node <id>` wybiera wyłącznie dostępny węzeł, bez teleportacji po mapie.
- `run clear` czyści gotowy pokój (nie usuwa żywego bossa misji z celem `killBoss`); `run state` zwraca JSON stanu.
- `run end win|lose` (zwycięstwo w misji poza finałem rzuca błąd), `hurt <n>` (poza pokojem odejmuje od `hp` runu i przy 0 kończy run), `credits <n>`, `god` (poza pokojem przełącza nieśmiertelność na każdy kolejny pokój) działają w scenie run.
- `mission start <id>` (przejście na `?scene=mission` dla misji z `level`, inaczej `?scene=run`, `loadout=meta`), `campaign complete <id>`, `mission radio <wyzwalacz>`, `objective done <id>`.
- Komendy przekazywane do aktywnego pokoju: `conquest capture|tickets`, `assault destroy|lives`, `heist grab|drop|extract|lives`, `weather`, `tp`, `hold`, `status`, `spawn`, `hit`, `kill all`, `boss phase|pattern`, `wave`.
- Opcjonalny `implant <id>` jest rejestrowany po wstrzyknięciu niepustego
  rejestru definicji; dodaje implant na mapie, a następny pokój nakłada go
  przez istniejące API RoomScene. Zmiana implantów podczas walki wymaga F3-09.
- `query`: `screen`, `runState`, `map`, `room` (id układu), `runLog`,
  `loading`, `runError`, `saveError`, `savePending` (zapis w toku), `rewardError`, `mission`, `victoryHold`, `meta`, `achievements`, `runAchievements`, `level`. Pozostałe nazwy trafiają do pokoju.

Weryfikacja w 30 sekund: otwórz powyższy URL, wybierz pierwszy węzeł,
wykonaj `run clear`, po sekundzie wybierz nagrodę, naciśnij Enter. Sprawdź dostępne
węzły kolejnej warstwy i brak zmiany HP. W walce zwróć uwagę na zachowanie
kamery i brak przypadkowego ataku po powrocie z nakładki.

`tests/unit/runScene.test.ts`: przepływ z atrapami, zapis mapy, wznowienie,
śmierć, trzy rzeczywiste pokoje (`loadModels: false`) bez wycieku handlerów
i z trzema `world.free()`, automatyczne nakładki, zastępczy boss, cheaty,
koniec podczas ładowania oraz kolejność save/clear.
`tests/unit/runScreens.test.ts`: mysz, klawiatura, czwarty węzeł i konsola.
`tests/e2e/runScene.spec.ts`: pierwszy pokój, clear, nagroda, mapa i drugi
pokój z klawiatury. Uruchomienie e2e pozostaje po stronie zlecającego.
