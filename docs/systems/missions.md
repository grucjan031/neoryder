# Misje fabularne

Pole `summary` zawiera krótki opis wyświetlany na tablicy po wyborze misji.

Odprawa, przerywnik i debrief pokazują po jednej kwestii z imieniem i ikoną mówiącego. Kliknięcie karty, „Dalej” lub spacja w widoku odsłania resztę tekstu, a po odsłonięciu przechodzi do kolejnej strony. Dłuższe kwestie są dzielone na strony. Opcja „Automatyczne przewijanie” jest domyślnie wyłączona i czeka po odsłonięciu strony przez czas zależny od długości tekstu. Ostatnia strona pozostaje widoczna. Ustawienie ograniczonego ruchu w systemie odsłania tekst od razu. „Zakończ rozmowę” zapisuje zamknięcie debriefu, także przed ostatnią kwestią.

Radio pojawia się w prawym górnym obszarze HUD-u, poniżej wskaźników przy górnej krawędzi. Kolejka odtwarza jedną wstawkę naraz i znika po zakończeniu. Opcjonalne `shortText` pozwala podać krótszą wersję na potrzeby radia. Bez tego pola radio korzysta z `text`. Radio mieści tekst na maksymalnie dwóch liniach przy stałym rozmiarze pisma. Dłuższy tekst przechodzi na kolejne strony, w miarę możliwości z podziałem na zdania lub wyrazy.

Aby sprawdzić dialogi w 30 sekund, otwórz `?scene=hub&debug=1&fx=lite`, wywołaj `hub open missions` i wybierz „Maszty”. Naciśnij spację i kliknij „Dalej”, następnie włącz automatyczne przewijanie. Kliknij „Rozpocznij misję” lub otwórz `?scene=mission&mission=m01-maszty&debug=1&fx=lite`. Po wczytaniu w prawym górnym obszarze pojawi się radio `runStart`. Można je powtórzyć komendą `mission radio runStart`. Zwiń panel strojenia, jeśli zasłania radio.

Misja bez pola `level` jest runem sektora z mapą i celami opisanymi w `src/data/missions`. M01 ma `level: "m01-maszty"` i używa osobnej sceny liniowej opisanej niżej. Kontrakt: ADR 0008 wraz z uzupełnieniem 2a. Rejestr `missions.ts` waliduje schemat, przypisania celów, zależności oraz typy pokojów. `generateMissionMap` zachowuje jedno przejście przez każdą warstwę stałą; nie dokłada bossa ani gwarancji elit zwykłego sektora.

## M01 — jedna mapa liniowa

Start: `?scene=mission&mission=m01-maszty`, tablica misji w kryjówce lub komenda
`mission start m01-maszty`. Scena nie tworzy `RunState` ani mapy sektora, nie ma
sklepu, odpoczynku, nagród za pokoje i ulepszeń podczas misji. Używa wspólnego
składu walki `RoomScene` przez `RoomCombatState` i jawne API hosta.

Mapa ma 320 m i siedem odcinków: śluza → targ → zalane przejście → dziedziniec
→ zaplecze rusztowań → plac → kanał. Siedem spotkań na trasie narasta od dwóch
szturmowców do grupy z dwiema wieżyczkami. Trzy dodatkowe spotkania to oryginalne
posiłki `missionPatrol` wyzwalane wybuchami. Każde ma lokalne punkty spawnu.
Bramy spotkań i celów mają collider oraz widok; oba znikają przy spełnieniu warunku.

Cele: `mast-1` → `mast-2` → `helix` → `mast-3` → `exit`. `MissionObjectives`
pozostaje wspólną, czystą symulacją; opcjonalna kolejność zamyka przyszłe cele.
Pozycje pochodzą z poziomu, czasy i skutki z misji: 2,5 s podkładania, 6 s lontu,
4 m wybuchu i 60 obrażeń ze źródłem null, oryginalna fala posiłków, 2 s włazu.
HUD pokazuje bieżący cel i obracany względem kamery znacznik kierunku z dystansem.
Radio, odprawa i debrief pochodzą z istniejących danych i `missionUi.ts`.

Checkpointy: `start`, `po-maszcie-1`, `po-helixie`, `ewakuacja`. Wejście w strefę
zapisuje osobny rekord `mission` SaveStore (wersja zapisu 6): `attemptId`, `missionId`, `levelId`, `seed`, `checkpointId`, cele, ukończone spotkania, `elapsedS`, `completed`, wyposażenie, talenty, implanty (zawsze pusta lista) i `threatLevel`. Punkt zapisuje się, gdy gracz jest w jego strefie, a jego warunek `after` jest spełniony (kolejne punkty po bieżącym; sprawdzane co krok). Każdy ukończony cel jest dodatkowo
zapisywany od razu, więc pozostaje także po śmierci przed następnym punktem.
Śmierć po `tuning.level.respawnDelayS` (1,2 s) odradza w zapisanej pozycji i kierunku, z pełnymi zasobami, zeruje
częściowe interakcje i odtwarza spotkania za checkpointem. Brak nakładki śmierci
runu. Rzeczywista utrata fokusu nadal pauzuje symulację. `tuning.level` jest w GUI.

Kryjówka czyta rekord i na tablicy oferuje „Kontynuuj misję”. Start zamraża
wyposażenie warsztatu i talenty meta; obecny metazapis nie ma slotów implantów,
więc początkowa lista implantów jest pusta, tak jak na starcie zwykłego runu.
M03/M06 mają nieaktywne karty „Wkrótce”; ich dane i warianty runowe pozostają,
dostępne przez bezpośrednie URL debug. Zwykły run i Przejęcie zachowują przepływ.

Migracja 5→6 zachowuje meta i aktywny run bez zmian; rekord misji jest początkowo
nieobecny. Zapis ukończenia poprzedza `applyRun`, zapis meta i usunięcie rekordu.
Nieudane rozliczenie pozostawia ukończoną próbę do ponowienia. `appliedRunIds`
chroni tę samą próbę, `campaign.completed` chroni firstClear między próbami.
Misja liniowa daje wyłącznie firstClear (60 Danych dla M01), bez zwykłych nagród
runu ani odblokowania kolejnego Poziomu zagrożenia. Podsumowanie prowadzi do kryjówki
z jednorazowym debriefem. Błąd zapisu jest widoczny w HUD; „Ponów zapis” i komenda
`mission retry` ponawiają zapis lub rozliczenie.

### Scena liniowa: start, ziarno i stany

- `?scene=mission&mission=<id>` (domyślnie `m01-maszty`; misja musi mieć `level`, a jej `requires` muszą być w `campaign.completed`). Wymaga `SaveStore` z obsługą rekordu misji. `seed` z URL albo `String(ctx.rng.getState())`; `attemptId` = `mission:<seed>:<czas ms>`.
- Bez `continue=1`: jeśli istnieje już rekord z `completed: true`, scena przekierowuje na `continue=1` i tylko kończy rozliczenie. Z `continue=1` rekord musi dotyczyć tej misji i poziomu, inaczej błąd. Nowa próba zaczyna od pierwszego punktu kontrolnego poziomu, wszystkie cele `pending`.
- Walidacja rekordu: znany punkt kontrolny, zestaw celów równy `level.objectiveOrder`, ukończone cele tworzą prefiks kolejności, `completed` wymaga wszystkich `done`.
- Losowość: pokój dostaje `new Rng(seed)` (bez forka), każde spotkanie własny `new Rng(seed).fork('encounter:<id>')`. Spotkanie startuje, gdy gracz jest w jego strefie, a warunek `after` (cel `done` albo spotkanie ukończone) jest spełniony; liczba żywych to `min(maxAlive fali, tuning.level.maxAlive = 12)`, punkty spawnu z poziomu. Spotkanie kończy się, gdy `WaveDirector` osiągnie `done`. Posiłki celu (`sabotage.reinforcements`) startują spotkanie z `reinforcementFor` równym kluczowi (id celu).
- Stany sceny: `loading → playing ↔ respawning`, `settling → summary` lub `error` (błąd zapisu; `mission retry` ponawia). `elapsedS` rośnie tylko w `playing`. Śmierć gracza w `playing` uruchamia `respawning` na `tuning.level.respawnDelayS`; odrodzenie niszczy aktywne spotkania, przywraca `completedEncounters` z punktu kontrolnego, teleportuje gracza (pozycja i kierunek punktu), zeruje postęp nieukończonych celów i lonty.
- Finał: sygnał `objective:exit:done` ustawia flagę, a w następnym kroku `finish()`: `completed = true`, zapis rekordu, `applyRun` z podsumowaniem (`missionId`, `missionCompleted: true`, `outcome: 'victory'`, `kills`, `roomsCleared`, `elitesCleared`, `layerReached` = 0, obrażenia 0, `elapsedS`, `loadoutId`, `threatLevel`) i `attemptId` jako `runId`, zapis meta, `clearMission`.
- Komendy: `mission start`, `checkpoint <id>` (teleport i zapis), `objective done <id>`, `encounter clear`, `mission radio <wyzwalacz>`, `mission retry`; `query('mission')` zwraca `{ id, level, state, checkpointId, objectives, completedEncounters, activeEncounters, openGates, elapsedS, saveError }`.

Format mapy i sprawdzenie w 30 sekund: [levels.md](levels.md).

## Misje-runy: mapa, pokoje, cele (reguły do odtworzenia)

**Schemat misji** (`missionSchema`): `id`, `number`, `title`, `summary`, `act` (1-3), `sectorId`, `level?`, `requires[]`, `layers`, `typeWeights?` (nadpisują wagi sektora), `roomPools?` (typ, zakres warstw, lista pokoi), `enemies?` (lista dozwolonych wrogów), `fixedNodes[]` (`layer`, `type`, `roomId`, `objectives[]`, `final?`, `guards?`), `objectives[]`, `interlude?`, `briefing[]`, `debrief[]`, `radio[]`, `rewards.firstClear { data, cores? }`, `splashAct?` (1-4). Walidacja: unikalne id celów, dokładnie jeden węzeł `final`, warstwy stałe unikalne i w zakresie, każdy cel przypisany do dokładnie jednego węzła, brak cykli zależności, pule bez nakładania się dla tego samego typu, osłona ma dokładnie jedno z `nearObjective` (cel tego węzła) i `position`, wróg osłony z listy `enemies`. Rejestr (`loadMission`) sprawdza, że `fixedNodes[].roomId` i pokoje z pul istnieją i mają typ zgodny z węzłem lub pulą; `requires` wskazuje znane misje.

**Mapa (`generateMissionMap`, ziarno `new Rng(seed).fork('mission-map')`):** dla każdej warstwy 1..`layers`: węzeł stały (`fixedNodes[].layer`) daje jeden węzeł o typie i `fixed {roomId, objectives, final?}`; inaczej `rng.int(nodesPerLayer.min, nodesPerLayer.max)` węzłów sektora, każdy z typem losowanym (`rng.float(0, suma)` po wagach typów w kolejności `NODE_TYPES`, tylko wagi > 0) według wag warstwy z `typeWeights` misji (albo sektora; warstwa niestała musi mieć dokładnie jeden zestaw wag). Id węzłów `L<warstwa>N<numer od 1>`. Na końcu `connectLayers` dla kolejnych par warstw z `extraEdgeChance` sektora (szczegóły w `sectorMap.md`). Kolejność losowań: dla każdej warstwy najpierw liczba węzłów, potem typy kolejnych węzłów (wszystkie warstwy), dopiero potem krawędzie. Brak bossa i brak gwarancji elit zwykłego sektora.

**Pokoje:** węzeł stały bierze `fixed.roomId`. Pozostałe: pula z `roomPools` misji pasująca do typu i warstwy (inaczej pula sektora), `rng.fork('room-layout:<nodeId>').pick` po kandydatach posortowanych po id (patrz `runScene.md`); w misji dozwolone są pokoje o id kończącym się na `Mission`. Fale pokoju: `planWaves` z sektorem zawężonym do `mission.enemies` (bez `unlockLayer`). **Osłony (`guards`):** przy wejściu do węzła stałego host tworzy `count` wrogów `enemy` na okręgu o promieniu `radiusM` wokół celu (`nearObjective`) lub `position`, w kolejnych kątach `π/2 + i·2π/count` (bez losowania).

**Przebieg w runie:** `RunManager.selectNode` zmienia cele węzła z `pending` na `active`; `completeRoom` jest odrzucane, dopóki cele węzła nie są `done`; po węźle `final` run kończy się zwycięstwem (`missionCompleted`), a `boss` bez `final` prowadzi do zwykłej nagrody; `finish('victory')` poza finałem rzuca błąd. Śmierć kończy run porażką (`missionCompleted: false`). Pokój zgłasza stan celów (`missionState`) co klatkę i przed `completeRoom`.

**Symulacja celów (`MissionObjectives`, wspólna dla misji, Szturmu i scen liniowych):** promień strefy to `tuning.mission.zoneRadiusM` (1,6 m) dla `sabotage`, `exit`, `interact`; `tuning.mission.pickupRadiusM` (1 m) dla `pickup`; `radiusM` celu dla `defend`. Gracz jest „w strefie”, gdy odległość w XZ i różnica wysokości nie przekraczają promienia. Cel jest odblokowany, gdy: (opcjonalna kolejność sceny liniowej) wszystkie wcześniejsze w kolejności są `done`; `pickup` po `spawnAfter` (pozycja = pozycja rodzica + `offset`); `exit` i `interact` po wszystkich `unlockAfter`. Reguły: `pickup` kończy się dotknięciem strefy; `sabotage`, `exit`, `interact` zwiększają postęp o `dt / holdS` tylko w strefie (postęp zostaje po wyjściu); `sabotage` po pełnym postępie uruchamia lont `fuseS`, który odlicza niezależnie od obecności i po zerze kończy cel (wybuch + fala `reinforcements`); `killBoss` kończy się wyłącznie zabiciem bossa pokoju. Sygnały radia: `runStart`, `enterNode:<warstwa>`, `objective:<id>:started` (pierwsze wejście w strefę), `objective:<id>:done`, `objective:<id>:paused`, `objective:<id>:progress:<0-100>`, `objectivesDone` (wszystkie cele misji `done`), `boss:phase:2|3`, `boss:defeated`.

Wybuch (`sabotage`): zdarzenie `explosion` w punkcie celu (+0,5 m w górę) i obrażenia `blastDamage` ze źródłem `null` (tagi `#hazard`, `#explosion`, `#friendly_fire`) dla gracza i wszystkich żywych wrogów w `blastRadiusM`. Fale `defend.waves` i `sabotage.reinforcements` to pliki `src/data/waves/<nazwa>.json`; w runie tworzą `WaveDirector` z punktami spawnu pokoju i strumieniem `ctx.rng.fork('reinforcement:<klucz>')` (klucz: id celu albo `<id>:<indeks wpisu>`); w scenie liniowej uruchamia je host jako spotkania.

**Tuning:** `tuning.mission`: `zoneRadiusM` 1,6, `pickupRadiusM` 1, `radioMinS` 3, `radioCharsPerS` 16 (tempo czytania dla radia i auto), `radioPageChars` 90, `dialoguePageChars` 150, `dialogueCharsPerS` 60, `dialogueAutoMinS` 2, `mastPulseHz` 0,5, `mastFusePulseHz` 2, `mastEmissionMin` 1,5, `mastEmissionMax` 4. `tuning.level`: `maxAlive` 12, `staticCellSizeM` 24, `respawnDelayS` 1,2.

**Dane misji:** `m01-maszty` (nr 1, akt 1, `level: m01-maszty`, bez `requires`, firstClear 60 Danych; wrogowie `assaulter`, `gunner`, `turret`), `m03-list-przewozowy` (nr 3, wymaga M01, firstClear 95 Danych + 1 Rdzeń, `splashAct` 1; dodatkowo `shielder`, `drone`), `m06-odlewnia` (nr 6, wymaga M03, 150 Danych + 3 Rdzenie, `splashAct` 2; dodatkowo `sniper`, `executor`). Wszystkie mają 7 warstw.

## Warianty misji-runów (zgodność)

Poniższy opis dotyczy misji bez `level`. Zachowane dane warstw M01 nie są używane
przez scenę `mission`. Zwykły run nadal wyklucza pokoje z sufiksem `Mission`.

`MissionObjectives` jest czystą symulacją. Obecność w strefie zwiększa postęp, wyjście go zatrzymuje. Sabotaż uruchamia lont, następnie obrażenia dla wszystkich ze źródłem `null` i falę wskazaną w danych. Moduł czeka na zniszczenie masztu; właz na spełnienie zależności. Host pokoju kończy węzeł z celami dopiero po ich wykonaniu, niezależnie od żywej osłony. Finał uruchamia zwycięstwo. Nowy run resetuje cele.

Metazapis v4 dodaje kampanię; migracja v3 zachowuje dotychczasowy postęp i dopisuje pustą listę ukończeń oraz pusty debrief. Rozliczenie stosuje `appliedRunIds` i `campaign.completed`: bonus firstClear tylko raz. Debrief znika po zakończeniu rozmowy i zapisie meta. Splash korzysta z kampanii; przy pustej kampanii zachowano wcześniejszy próg zwycięstw.

Nową misję dodaje się jako JSON: unikalne id, sektor, warstwy, pokoje stałe i dokładnie jeden finał, cele z zależnościami, pule oraz dialogi i nagrody. Fale posiłków są plikami `src/data/waves`, wskazywanymi przez `reinforcements`. Liczby interakcji są w danych misji, wspólne promienie stref i tempo napisów w `tuning.mission` (panel debug).

Sprawdzenie M01: `?scene=mission&mission=m01-maszty&debug=1`. Komendy `mission start m01-maszty`, `objective done <id>`, `query('mission')`; cele: `mast-1`, `mast-2`, `helix`, `mast-3`, `exit`. Aktywne spotkania: `encounter clear`. Ręcznie sprawdzić zatrzymywanie paska po odejściu, sześć sekund na ucieczkę przed wybuchem, obrażenia i radio, jasny moduł oraz właz przy murze.

M03 „List przewozowy” odblokowuje ukończenie M01 (M02 poza demem). Warstwy stałe: 3 — plac laserowy, 6 i 7 — magazyn. Osłona bez celu może wskazywać `position` zamiast `nearObjective`; pozycje nie zmieniają warunków ukończenia walki.

`defend` ma opcjonalne `holdS` (domyślnie 0) na podłączenie dekodera oraz `durationS` samego transferu. Obie fazy postępują tylko w promieniu `radiusM`; wrogowie nie blokują transferu. Wyjście zatrzymuje, ale nie zeruje czasu. `objectiveProgress[id]` oznacza transfer, a klucz `id:connection` zachowuje ułamek podłączenia (bez zmiany formatu zapisu). `MissionObjectives.paused` opisuje bieżącą obecność poza strefą. Hook `reinforce(wave, key)` zleca hostowi uruchomienie fali z danych.

Opcjonalne `defend.waves: { atProgress: number; wave: string }[]` uruchamia posiłki dokładnie raz przy przekroczeniu progu (0 < próg ≤ 1). Radio obsługuje `objective:<id>:progress:<0-100>` (całkowity procent), `started` po podłączeniu, `paused` przy pierwszym wyjściu po podłączeniu i `done` przy końcu transferu. Progi już osiągnięte nie powtarzają się po odtworzeniu postępu. HUD rozróżnia podłączanie, procent transferu i „TRANSFER WSTRZYMANY — wróć do strefy”. Dopiero osobny cel `exit` odblokowany przez terminal kończy misję.

M03: podłączenie 2 s, transfer 90 s, promień 6 m, fale przy 25/55/85%, radio w połowie i przy 90%. Brama po przeciwnej stronie od wejścia wymaga 2 s. Pierwsze ukończenie: 95 Danych i 1 Rdzeń. `campaign complete <id>` jest komendą debug: oznacza ukończenie bez nagród i debriefu, zapisuje kampanię. Sprawdzenie: `?scene=run&mission=m03-list-przewozowy&debug=1` po odblokowaniu M01, `objective done terminal`, następnie `objective done exit`. `run clear` nie omija terminala ani bramy.

M06 „Odlewnia” wymaga M03. Siedem warstw, stałe pokoje: 1 — combatCorridor, 3 — eliteFoundry, 6 — eliteHall (executor, shielder, sniper), 7 — bossRoom. Pierwsze ukończenie: 150 Danych i 3 Rdzenie, splashAct 2. Dialogi odprawy zachowują tekst źródłowy, także odniesienia do pominiętych misji i opcjonalnych celów.

Opcjonalne `interlude: { title, lines: DialogueLine[] }` wyświetla się przed odprawą M03 i M06: przerywnik zastępuje wydarzenia misji, których nie ma w grze; usuwamy go, gdy brakująca misja powstanie.

`interact` ma `position`, `holdS` oraz `unlockAfter`, tak jak `exit`. Zwiększa postęp tylko w strefie, zachowuje go po odejściu i nie kończy pokoju, gdy pozostają inne cele. Serwer (`server`, 3 s) odblokowuje się po celu `brandt` (`killBoss`), winda (`exit`, 2 s) po serwerze. Stan używa istniejących pól zapisu. Czerwony mówca `brandt` jest dostępny także w radiu.

Host przekazuje istniejące zdarzenia `boss_phase` do `boss:phase:2` i `boss:phase:3`, a śmierć swojego bossa do `boss:defeated`. Te wyzwalacze przerywają zaległe radio, żeby komunikaty faz i ostatnie słowa odpowiadały aktualnej walce. W misji host oznacza wtedy `killBoss` jako done i wywołuje wspólny rozpad pozostałych wrogów (DamageSystem, source null), bez naliczania zabójstw gracza i bez uruchamiania ciszy po zwycięstwie. `completeRoom` pozostaje zablokowane do wykonania wszystkich celów; dopiero winda kończy finał i uruchamia zwykłe rozliczenie oraz ciszę. Zwykły run i Przejęcie zachowują dotychczasową ścieżkę.

Sprawdzenie M06: `?scene=run&mission=m06-odlewnia&debug=1` po ukończeniu M03; `god`, `boss phase 2`, `boss phase 3`, po zakończeniu zmiany fazy `kill all`, następnie `objective done server`, `objective done exit`. `run clear` nie usuwa żywego bossa misji bez zdarzenia śmierci. Serwer znajduje się przy tylnej ścianie (0, 0, -12), winda po lewej (-11, 0, -11). Cele opcjonalne i zegar dostrojenia pozostają poza zakresem. Geometria bazowych pokojów i balans bossa są niezmienione; podest serwera oraz winda są oprawą celu, bez nowych kolizji.
