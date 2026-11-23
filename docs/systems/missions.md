# Misje fabularne

Pole `summary` zawiera krótki opis wyświetlany na tablicy po wyborze misji.

Odprawa, przerywnik i debrief pokazują po jednej kwestii z imieniem i ikoną mówiącego. Kliknięcie karty, „Dalej” lub spacja w widoku odsłania resztę tekstu, a po odsłonięciu przechodzi do kolejnej strony. Dłuższe kwestie są dzielone na strony. Opcja „Automatyczne przewijanie” jest domyślnie wyłączona i czeka po odsłonięciu strony przez czas zależny od długości tekstu. Ostatnia strona pozostaje widoczna. Ustawienie ograniczonego ruchu w systemie odsłania tekst od razu. „Zakończ rozmowę” zapisuje zamknięcie debriefu, także przed ostatnią kwestią.

Odprawa przed misją ma najwyżej trzy kwestie (kto mówi, gdzie idziemy, główny cel), a debrief najwyżej sześć; obie listy są dosłownym wyborem kwestii ze scenariusza w jego kolejności. Pozostała treść odprawy pada w radiu w trakcie misji, w momencie, którego dotyczy (sekcja „Radio w trakcie misji”). Pilnuje tego `missionBriefing.test.ts`: każda kwestia odprawy i radia ze scenariusza występuje dokładnie raz, w odprawie albo w radiu.

Radio pojawia się w prawym górnym obszarze HUD-u, poniżej wskaźników przy górnej krawędzi. Kolejka odtwarza jedną wstawkę naraz i znika po zakończeniu. Opcjonalne `shortText` pozwala podać krótszą wersję na potrzeby radia. Bez tego pola radio korzysta z `text`. Radio mieści tekst na maksymalnie dwóch liniach przy stałym rozmiarze pisma. Dłuższy tekst przechodzi na kolejne strony, w miarę możliwości z podziałem na zdania lub wyrazy.

Aby sprawdzić dialogi w 30 sekund, otwórz `?scene=hub&debug=1&fx=lite`, wywołaj `hub open missions` i wybierz „Maszty”. Naciśnij spację i kliknij „Dalej”, następnie włącz automatyczne przewijanie. Kliknij „Rozpocznij misję” lub otwórz `?scene=mission&mission=m01-maszty&debug=1&fx=lite`. Po wczytaniu w prawym górnym obszarze pojawi się radio `runStart`; `tp 50 0 -90` (wejście na targ) pokaże kartę `enterSection:targ`. Można je powtórzyć komendą `mission radio runStart`. Zwiń panel strojenia, jeśli zasłania radio.

## Radio w trakcie misji

Wpis `radio[]` ma `trigger`, `lines` i opcjonalne `priority`:

- `tactical` (domyślnie, gdy pola brak): ostrzeżenia i nawigacja. Grają od razu, w kolejności zgłoszeń, także w walce. Zgłoszone w trakcie karty `story` przerywają ją.
- `story`: treść fabularna i przekomarzania przeniesione z odprawy. Czekają na spokój, czyli brak aktywnego spotkania przez `tuning.mission.radioCalmDelayS` (1,5 s). Walka nie urywa już pokazanej karty, ale wstrzymuje następne. Karta przerwana ostrzeżeniem wraca na początek kolejki fabularnej i po walce gra od nowa, chyba że była już widoczna przez `radioStoryReadFraction` (0,6) swojego czasu — wtedy liczy się jako przeczytana. Jeżeli kwestia czeka dłużej niż `radioStoryMaxWaitS` (20 s), gra jedna mimo walki, a licznik rusza od zera: treść nie przepada w długim starciu i nie zalewa ekranu.

Na ekranie jest zawsze najwyżej jedna karta. Czas karty to `max(radioMinS, liczba znaków / radioCharsPerS)`, liczony od tekstu faktycznie pokazanej strony. Karta ma `data-priority` (`tactical` — bursztynowa krawędź, `story` — ciepła biel). Kolejkę bez DOM implementuje `RadioQueue` (`src/ui/missionDialogue.ts`), `MissionRadio` dokłada podział na strony i kartę. Walkę zgłasza host: scena `mission` woła `setCombat(liczba aktywnych spotkań > 0)` co krok; run sektora jej nie zgłasza, więc tam `story` gra od razu po `tactical`. `boss:phase:2|3` i `boss:defeated` czyszczą obie kolejki.

Wyzwalacze dostępne tylko w scenie liniowej (`mission`), sprawdzane z poziomem przy starcie sceny (nieznane id = błąd „Nieznany wyzwalacz radia”):

| Wyzwalacz                  | Kiedy                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `enterSection:<id sekcji>` | pierwsze wejście gracza w strefę sekcji w tej sesji sceny (także sekcji startowej i sekcji punktu kontrolnego po wznowieniu) |
| `encounter:<id>:started`   | start spotkania (strefa albo posiłki celu)                                                                                   |
| `encounter:<id>:done`      | spotkanie ukończone (także komendą `encounter clear`); przy bossie po `boss:defeated` i `objective:<id>:done`                |
| `checkpoint:<id>`          | zapis punktu kontrolnego po dojściu do jego strefy (także komendą `checkpoint <id>`); punkt startowy nie zgłasza             |

Dawne `enterNode:<n>` z pola `radio` sekcji poziomu działa nadal (M03, M06). Wskazówki dla danych: kwestia `story` powinna mieścić się na jednej karcie (`shortText` do `radioPageChars` znaków), na jednym wyzwalaczu najwyżej trzy kwestie, a rzeczy potrzebne przed konkretną walką daj jako `tactical` na `encounter:<poprzednie>:done` albo `enterSection`. Podgląd stanu: `query('missionRadio')` zwraca `{ active, pending: { tactical, story } }`; `mission radio <wyzwalacz>` zgłasza wyzwalacz ręcznie.

Rozkład treści przeniesionej z odpraw:

- **M01** (odprawa 14 → 3): łączność i Tomasz jako przewodnik — `runStart` (`story`); ładunki Miry i 4 m — `encounter:patrol-wejscie:done`; przekomarzanie o zapalnikach i ostrzeżenie Szrona o wieżyczkach i patrolach — `encounter:oslona-pierwszego:done` (cisza przed podłożeniem pierwszego ładunku); „kiedy jeszcze działały pompy” — `checkpoint:po-maszcie-1` (wejście do zalanego przejścia); wiatr od rzeki — `checkpoint:po-helixie`. Dotychczasowe radio dostało dokładniejsze momenty: przypomnienie o 4 m na `objective:mast-1:started`, kładki na `enterSection:zaplecze`, wieżyczki na krzyż na `enterSection:plac`, a kwestie o włazie na `checkpoint:ewakuacja` (wcześniej padały dopiero na włazie, 2 s przed końcem misji).
- **M03** (odprawa 8 → 3): Tomasz o nabrzeżu i drodze ucieczki — `runStart` (`story`); tarcze i drony — `encounter:patrol-nabrzeze:done`, przed placem celnym; dlaczego trzeba stać przy terminalu — `enterSection:magazyn` (`story`). „Dobry refleks” Bajta przeniesiono z wejścia na plac na `encounter:oslona-celna:done`.
- **M06** (odprawa 7 → 3): serwer i dysk Bajta — `encounter:patrol-sluza:done` (`story`); prośba Wolana — `encounter:piece:done` (`story`); pancerz i tarcza Brandta — `encounter:straz:done`, przed areną.

Debriefy skrócono do sześciu kwestii (M01 z 11, M03 z 12, M06 z 14); pominięte kwestie zostają w scenariuszach `docs/fabula/misje/`.

Misja bez pola `level` jest runem sektora z mapą i celami opisanymi w `src/data/missions`. M01 ma `level: "m01-maszty"` i używa osobnej sceny liniowej opisanej niżej. Kontrakt: ADR 0008 wraz z uzupełnieniem 2a. Rejestr `missions.ts` waliduje schemat, przypisania celów, zależności oraz typy pokojów. `generateMissionMap` zachowuje jedno przejście przez każdą warstwę stałą; nie dokłada bossa ani gwarancji elit zwykłego sektora.

## M01 — jedna mapa liniowa

Start: `?scene=mission&mission=m01-maszty`, tablica misji w kryjówce lub komenda
`mission start m01-maszty`. Scena nie tworzy `RunState` ani mapy sektora, nie ma
sklepu, odpoczynku, nagród za pokoje i ulepszeń podczas misji. Używa wspólnego
składu walki `RoomScene` przez `RoomCombatState` i jawne API hosta.

Mapa ma 320 m i siedem odcinków: śluza → targ → zalane przejście → dziedziniec
→ zaplecze rusztowań → plac → kanał. Siedem spotkań na trasie narasta od dwóch
szturmowców do grupy z dwiema wieżyczkami. Trzy dodatkowe spotkania to posiłki
wyzwalane wybuchami: `missionPatrol` po maszcie 1 i 2, cięższa `m01Assault`
(4 szturmowców, 3 strzelców) po maszcie 3. Każde ma lokalne punkty spawnu.
Strefa spotkania zaczyna się za bramą poprzedniego (pierwsze przy x=16), więc
kolejna walka nie startuje w miejscu, w którym gracz dobił poprzednią. Otwarte
place (targ, dziedziniec, plac) mają po dwie plamy ciepłego światła i bursztynowy
reflektor przy maszcie. Właz leży przy wschodnim murze (x=316), za transformatorem
na osi kanału. Audyt misji: [`docs/audits/m01-maszty.md`](../audits/m01-maszty.md).
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
M03 i M06 są poziomami liniowymi (`level`, opis w `levels.md`) i startują z tablicy
w scenie `mission`: M03 po ukończeniu M02, M06 po ukończeniu M05.
Zwykły run i Przejęcie zachowują przepływ.

Migracja 5→6 zachowuje meta i aktywny run bez zmian; rekord misji jest początkowo
nieobecny. Zapis ukończenia poprzedza `applyRun`, zapis meta i usunięcie rekordu.
Nieudane rozliczenie pozostawia ukończoną próbę do ponowienia. `appliedRunIds`
chroni tę samą próbę, `campaign.completed` chroni firstClear między próbami.
Pierwsze ukończenie misji liniowej daje zwykłe nagrody runu z `computeRunRewards` oraz jednorazowy bonus `firstClear`, każde kolejne ukończenie daje same zwykłe nagrody runu, a próba nieukończona daje 0 nagród.
Wzór używa reguł `progression.rewards` i mnożnika Poziomu zagrożenia;
scena przekazuje `roomsCleared` = 0 i `elitesCleared` = 0, więc liczą się zabójstwa
i premia za zwycięstwo. Bonus `firstClear` dla M01 to 60 Danych. Misja
liniowa nigdy nie odblokowuje kolejnego Poziomu zagrożenia. Podsumowanie prowadzi do kryjówki
z jednorazowym debriefem. Błąd zapisu jest widoczny w HUD; „Ponów zapis” i komenda
`mission retry` ponawiają zapis lub rozliczenie.

### Scena liniowa: start, ziarno i stany

- `?scene=mission&mission=<id>` (domyślnie `m01-maszty`; misja musi mieć `level`, a jej `requires` muszą być w `campaign.completed`). Wymaga `SaveStore` z obsługą rekordu misji. `seed` z URL albo `String(ctx.rng.getState())`; `attemptId` = `mission:<seed>:<czas ms>`.
- Bez `continue=1`: jeśli istnieje już rekord z `completed: true`, scena przekierowuje na `continue=1` i tylko kończy rozliczenie. Z `continue=1` rekord musi dotyczyć tej misji i poziomu, inaczej błąd. Nowa próba zaczyna od pierwszego punktu kontrolnego poziomu, wszystkie cele `pending`.
- Walidacja rekordu: znany punkt kontrolny, zestaw celów równy `level.objectiveOrder`, ukończone cele tworzą prefiks kolejności, `completed` wymaga wszystkich `done`.
- Losowość: pokój dostaje `new Rng(seed)` (bez forka), każde spotkanie własny `new Rng(seed).fork('encounter:<id>')`. Spotkanie startuje, gdy gracz jest w jego strefie, a warunek `after` (cel `done` albo spotkanie ukończone) jest spełniony; liczba żywych to `min(maxAlive fali, tuning.level.maxAlive = 12)`, punkty spawnu z poziomu. Spotkanie kończy się, gdy `WaveDirector` osiągnie `done`. Posiłki celu (`sabotage.reinforcements`) startują spotkanie z `reinforcementFor` równym kluczowi (id celu).
- Stany sceny: `loading → playing ↔ respawning`, `settling → summary` lub `error` (błąd zapisu; `mission retry` ponawia). `elapsedS` rośnie tylko w `playing`. Śmierć gracza w `playing` uruchamia `respawning` na `tuning.level.respawnDelayS`; odrodzenie niszczy aktywne spotkania, przywraca `completedEncounters` z punktu kontrolnego, teleportuje gracza (pozycja i kierunek punktu), zeruje postęp nieukończonych celów i lonty.
- Finał: sygnał `objective:exit:done` ustawia flagę, a w następnym kroku `finish()`: `completed = true`, zapis rekordu, `applyRun` z podsumowaniem (`missionId`, `missionCompleted: true`, `outcome: 'victory'`, `kills`, `roomsCleared`, `elitesCleared`, `layerReached` = 0, obrażenia 0, `elapsedS`, `loadoutId`, `threatLevel`) i `attemptId` jako `runId`, zapis meta, `clearMission`.
- Komendy: `mission start`, `checkpoint <id>` (teleport i zapis), `objective done <id>`, `encounter clear`, `mission radio <wyzwalacz>`, `mission retry`; `query('mission')` zwraca `{ id, level, state, checkpointId, objectives, completedEncounters, activeEncounters, openGates, elapsedS, saveError }`, a `query('missionRadio')` stan kolejki radia.

Format mapy i sprawdzenie w 30 sekund: [levels.md](levels.md).

## Misje-runy: mapa, pokoje, cele (reguły do odtworzenia)

**Schemat misji** (`missionSchema`): `id`, `number`, `title`, `summary`, `act` (1-3), `sectorId`, `level?`, `requires[]`, `layers`, `typeWeights?` (nadpisują wagi sektora), `roomPools?` (typ, zakres warstw, lista pokoi), `enemies?` (lista dozwolonych wrogów), `fixedNodes[]` (`layer`, `type`, `roomId`, `objectives[]`, `final?`, `guards?`), `objectives[]`, `interlude?`, `briefing[]`, `debrief[]`, `radio[]`, `rewards.firstClear { data, cores? }`, `splashAct?` (1-4). Walidacja: unikalne id celów, dokładnie jeden węzeł `final`, warstwy stałe unikalne i w zakresie, każdy cel przypisany do dokładnie jednego węzła, brak cykli zależności, pule bez nakładania się dla tego samego typu, osłona ma dokładnie jedno z `nearObjective` (cel tego węzła) i `position`, wróg osłony z listy `enemies`. Rejestr (`loadMission`) sprawdza, że `fixedNodes[].roomId` i pokoje z pul istnieją i mają typ zgodny z węzłem lub pulą; `requires` wskazuje znane misje.

**Mapa (`generateMissionMap`, ziarno `new Rng(seed).fork('mission-map')`):** dla każdej warstwy 1..`layers`: węzeł stały (`fixedNodes[].layer`) daje jeden węzeł o typie i `fixed {roomId, objectives, final?}`; inaczej `rng.int(nodesPerLayer.min, nodesPerLayer.max)` węzłów sektora, każdy z typem losowanym (`rng.float(0, suma)` po wagach typów w kolejności `NODE_TYPES`, tylko wagi > 0) według wag warstwy z `typeWeights` misji (albo sektora; warstwa niestała musi mieć dokładnie jeden zestaw wag). Id węzłów `L<warstwa>N<numer od 1>`. Na końcu `connectLayers` dla kolejnych par warstw z `extraEdgeChance` sektora (szczegóły w `sectorMap.md`). Kolejność losowań: dla każdej warstwy najpierw liczba węzłów, potem typy kolejnych węzłów (wszystkie warstwy), dopiero potem krawędzie. Brak bossa i brak gwarancji elit zwykłego sektora.

**Pokoje:** węzeł stały bierze `fixed.roomId`. Pozostałe: pula z `roomPools` misji pasująca do typu i warstwy (inaczej pula sektora), `rng.fork('room-layout:<nodeId>').pick` po kandydatach posortowanych po id (patrz `runScene.md`); w misji dozwolone są pokoje o id kończącym się na `Mission`. Fale pokoju: `planWaves` z sektorem zawężonym do `mission.enemies` (bez `unlockLayer`). **Osłony (`guards`):** przy wejściu do węzła stałego host tworzy `count` wrogów `enemy` na okręgu o promieniu `radiusM` wokół celu (`nearObjective`) lub `position`, w kolejnych kątach `π/2 + i·2π/count` (bez losowania).

**Przebieg w runie:** `RunManager.selectNode` zmienia cele węzła z `pending` na `active`; `completeRoom` jest odrzucane, dopóki cele węzła nie są `done`; po węźle `final` run kończy się zwycięstwem (`missionCompleted`), a `boss` bez `final` prowadzi do zwykłej nagrody; `finish('victory')` poza finałem rzuca błąd. Śmierć kończy run porażką (`missionCompleted: false`). Pokój zgłasza stan celów (`missionState`) co klatkę i przed `completeRoom`.

**Symulacja celów (`MissionObjectives`, wspólna dla misji, Szturmu i scen liniowych):** promień strefy to `tuning.mission.zoneRadiusM` (1,6 m) dla `sabotage`, `exit`, `interact`; `tuning.mission.pickupRadiusM` (1 m) dla `pickup`; `radiusM` celu dla `defend`. Gracz jest „w strefie”, gdy odległość w XZ i różnica wysokości nie przekraczają promienia. Cel jest odblokowany, gdy: (opcjonalna kolejność sceny liniowej) wszystkie wcześniejsze w kolejności są `done`; `pickup` po `spawnAfter` (pozycja = pozycja rodzica + `offset`); `exit` i `interact` po wszystkich `unlockAfter`. Reguły: `pickup` kończy się dotknięciem strefy; `sabotage`, `exit`, `interact` zwiększają postęp o `dt / holdS` tylko w strefie (postęp zostaje po wyjściu); `sabotage` po pełnym postępie uruchamia lont `fuseS`, który odlicza niezależnie od obecności i po zerze kończy cel (wybuch + fala `reinforcements`); `killBoss` kończy się wyłącznie zabiciem bossa pokoju. Sygnały radia: `runStart`, `enterNode:<warstwa>`, `objective:<id>:started` (pierwsze wejście w strefę), `objective:<id>:done`, `objective:<id>:paused`, `objective:<id>:progress:<0-100>`, `objectivesDone` (wszystkie cele misji `done`), `boss:phase:2|3`, `boss:defeated`; w scenie liniowej dodatkowo `enterSection:<id>`, `encounter:<id>:started|done` i `checkpoint:<id>` (sekcja „Radio w trakcie misji”).

Wybuch (`sabotage`): zdarzenie `explosion` w punkcie celu (+0,5 m w górę) i obrażenia `blastDamage` ze źródłem `null` (tagi `#hazard`, `#explosion`, `#friendly_fire`) dla gracza i wszystkich żywych wrogów w `blastRadiusM`. Fale `defend.waves` i `sabotage.reinforcements` to pliki `src/data/waves/<nazwa>.json`; w runie tworzą `WaveDirector` z punktami spawnu pokoju i strumieniem `ctx.rng.fork('reinforcement:<klucz>')` (klucz: id celu albo `<id>:<indeks wpisu>`); w scenie liniowej uruchamia je host jako spotkania.

**Tuning:** `tuning.mission`: `zoneRadiusM` 1,6, `pickupRadiusM` 1, `radioMinS` 3, `radioCharsPerS` 16 (tempo czytania dla radia i auto), `radioPageChars` 90, `radioCalmDelayS` 1,5, `radioStoryMaxWaitS` 20, `radioStoryReadFraction` 0,6, `dialoguePageChars` 150, `dialogueCharsPerS` 60, `dialogueAutoMinS` 2, `mastPulseHz` 0,5, `mastFusePulseHz` 2, `mastEmissionMin` 1,5, `mastEmissionMax` 4. `tuning.level`: `maxAlive` 12, `staticCellSizeM` 24, `respawnDelayS` 1,2.

**Dane misji:** `m01-maszty` (nr 1, akt 1, `level: m01-maszty`, bez `requires`, firstClear 60 Danych; wrogowie `assaulter`, `gunner`, `turret`), `m02-punkt-kontrolny` (nr 2, wymaga M01, firstClear 80 Danych + 1 Rdzeń; debiut `executor`), `m03-list-przewozowy` (nr 3, wymaga M02, firstClear 95 Danych + 1 Rdzeń, `splashAct` 1; dodatkowo `shielder`, `drone`), `m06-odlewnia` (nr 6, `level: m06-odlewnia`, wymaga M05, 150 Danych + 3 Rdzenie, `splashAct` 2; wrogów określają fale poziomu, w tym `sniper`, `executor` i boss `securityChief`). Wszystkie mają 7 warstw.

## M02 — uwolnienie kurierów

`m02-punkt-kontrolny` startuje z tablicy po M01 jako scena `mission`.
Cele w kolejności: `cell-1` → `cell-2` → `cell-3` (każdy `interact`, 2 s w strefie
rygla) → `executor` (`killBoss`, koniec całego spotkania `bossFor`, elita z obstawą)
→ `exit` (2 s za zachodnią bramą). Nie wymaga zmian silnika. Nadia dołącza po
drugiej celi i korzysta z istniejącego systemu sojuszników; nie ma AI pozostałych
więźniów ani trwałej śmierci Nadii. Opcjonalne cele scenariusza (rejestr skanów,
premia za pełną ewakuację) nie należą do tego wariantu misji.

Odprawa ma trzy kwestie, debrief sześć, bez przerywnika (scenariusz go nie ma).
`shortText` dostosowuje kierunek rampy, otwieranie rygli i kolejność finału do
mapy liniowej oraz pomija zachęty do nieaktywnego opcjonalnego skanera; pełne
`text` pozostaje dosłownym tekstem scenariusza.
Pozostałe kwestie odprawy i wszystkie kwestie radiowe scenariusza rozmieszczono
na starcie, sekcjach, ukończeniu spotkań, celach oraz checkpointach. Radio Nadii
po drugiej celi przekazuje trop Magazynu 9; checkpoint `ewakuacja` potwierdza
otwarcie bramy, zanim gracz dotrze do wyjścia. Test `missionBriefing.test.ts`
sprawdza dosłowność i kompletność treści. M03 wymaga odtąd M02; w tym worktree
integracja M04 i zmiana wymagania M06 pozostają osobnym zadaniem. Istniejący
przerywnik M03 opisujący uwolnienie przez „drugą ekipę” wymaga korekty redakcyjnej
przy integracji kampanii (poza dozwoloną tu zmianą samego `requires` M03).

## Warianty misji-runów (zgodność)

Poniższy opis dotyczy misji bez `level`. Zachowane dane warstw M01 nie są używane
przez scenę `mission`. Zwykły run nadal wyklucza pokoje z sufiksem `Mission`.

`MissionObjectives` jest czystą symulacją. Obecność w strefie zwiększa postęp, wyjście go zatrzymuje. Sabotaż uruchamia lont, następnie obrażenia dla wszystkich ze źródłem `null` i falę wskazaną w danych. Moduł czeka na zniszczenie masztu; właz na spełnienie zależności. Host pokoju kończy węzeł z celami dopiero po ich wykonaniu, niezależnie od żywej osłony. Finał uruchamia zwycięstwo. Nowy run resetuje cele.

Metazapis v4 dodaje kampanię; migracja v3 zachowuje dotychczasowy postęp i dopisuje pustą listę ukończeń oraz pusty debrief. Rozliczenie stosuje `appliedRunIds` i `campaign.completed`: bonus firstClear tylko raz; kolejne ukończenia dają zwykłe nagrody runu (misja liniowa: tylko je, patrz wyżej). Debrief znika po zakończeniu rozmowy i zapisie meta. Splash korzysta z kampanii; przy pustej kampanii zachowano wcześniejszy próg zwycięstw.

Nową misję dodaje się jako JSON: unikalne id, sektor, warstwy, pokoje stałe i dokładnie jeden finał, cele z zależnościami, pule oraz dialogi i nagrody. Fale posiłków są plikami `src/data/waves`, wskazywanymi przez `reinforcements`. Liczby interakcji są w danych misji, wspólne promienie stref i tempo napisów w `tuning.mission` (panel debug).

Sprawdzenie M01: `?scene=mission&mission=m01-maszty&debug=1`. Komendy `mission start m01-maszty`, `objective done <id>`, `query('mission')`; cele: `mast-1`, `mast-2`, `helix`, `mast-3`, `exit`. Aktywne spotkania: `encounter clear`. Ręcznie sprawdzić zatrzymywanie paska po odejściu, sześć sekund na ucieczkę przed wybuchem, obrażenia i radio, jasny moduł oraz właz przy murze.

M03 „List przewozowy” odblokowuje ukończenie M01 (M02 poza demem). W grze jest poziomem liniowym; warstwy stałe (3 — plac laserowy, 6 i 7 — magazyn) zostały w danych tylko dla schematu misji. Osłona bez celu może wskazywać `position` zamiast `nearObjective`; pozycje nie zmieniają warunków ukończenia walki.

`defend` ma opcjonalne `holdS` (domyślnie 0) na podłączenie dekodera oraz `durationS` samego transferu. Obie fazy postępują tylko w promieniu `radiusM`; wrogowie nie blokują transferu. Wyjście zatrzymuje, ale nie zeruje czasu. `objectiveProgress[id]` oznacza transfer, a klucz `id:connection` zachowuje ułamek podłączenia (bez zmiany formatu zapisu). `MissionObjectives.paused` opisuje bieżącą obecność poza strefą. Hook `reinforce(wave, key)` zleca hostowi uruchomienie fali z danych.

Opcjonalne `defend.waves: { atProgress: number; wave: string }[]` uruchamia posiłki dokładnie raz przy przekroczeniu progu (0 < próg ≤ 1). Radio obsługuje `objective:<id>:progress:<0-100>` (całkowity procent), `started` po podłączeniu, `paused` przy pierwszym wyjściu po podłączeniu i `done` przy końcu transferu. Progi już osiągnięte nie powtarzają się po odtworzeniu postępu. HUD rozróżnia podłączanie, procent transferu i „TRANSFER WSTRZYMANY — wróć do strefy”. Dopiero osobny cel `exit` odblokowany przez terminal kończy misję.

M03: podłączenie 2 s, transfer 90 s, promień 6 m, fale przy 25/55/85%, radio w połowie i przy 90%. Brama po przeciwnej stronie od wejścia wymaga 2 s. Pierwsze ukończenie: 95 Danych i 1 Rdzeń. `campaign complete <id>` jest komendą debug: oznacza ukończenie bez nagród i debriefu, zapisuje kampanię. Od wersji liniowej M03 ma `level: m03-list-przewozowy` (mapa i przebieg: `docs/systems/levels.md`, sekcja „M03”); pola `typeWeights` i `roomPools` usunięto, `layers` i `fixedNodes` zostają, bo wymaga ich schemat misji (jak w M01). Fale transferu startują jako spotkania poziomu z `reinforcementFor: terminal:<indeks>`. Sprawdzenie: `?scene=mission&mission=m03-list-przewozowy&debug=1` po ukończeniu M01 i M02 (`campaign complete m01-maszty`, `campaign complete m02-punkt-kontrolny` w `?scene=run&debug=1`), `objective done terminal`, następnie `objective done exit`.

M06 „Odlewnia” wymaga M05 i jest poziomem liniowym (`levels.md`, sekcja „M06 — Odlewnia”); wariant runowy został usunięty. Z pól runu zostały tylko te, których wymaga schemat: `layers: 7` i jeden węzeł finałowy (warstwa 7, `bossRoom`) z celami `brandt`, `server`, `exit`; `typeWeights`, `roomPools`, `enemies` i osłony węzłów zniknęły. Pozycje celów w danych misji są zastępowane przez `objectivePositions` poziomu. Pierwsze ukończenie: 150 Danych i 3 Rdzenie, splashAct 2. Kwestie zachowują tekst źródłowy, także odniesienia do pominiętych misji i opcjonalnych celów; odprawa ma trzy z nich, reszta pada w radiu. Radio `enterNode:3|6|7` wyzwalają odcinki poziomu (hala formowania, przedpokój, arena).

Opcjonalne `interlude: { title, lines: DialogueLine[] }` wyświetla się przed odprawą M03 i M06: przerywnik zastępuje wydarzenia misji, których nie ma w grze; usuwamy go, gdy brakująca misja powstanie.

`interact` ma `position`, `holdS` oraz `unlockAfter`, tak jak `exit`. Zwiększa postęp tylko w strefie, zachowuje go po odejściu i nie kończy pokoju, gdy pozostają inne cele. Serwer (`server`, 3 s) odblokowuje się po celu `brandt` (`killBoss`), winda (`exit`, 2 s) po serwerze. Stan używa istniejących pól zapisu. Czerwony mówca `brandt` jest dostępny także w radiu.

Host przekazuje istniejące zdarzenia `boss_phase` do `boss:phase:2` i `boss:phase:3`, a śmierć swojego bossa do `boss:defeated`. Te wyzwalacze przerywają zaległe radio, żeby komunikaty faz i ostatnie słowa odpowiadały aktualnej walce. W misji host oznacza wtedy `killBoss` jako done i wywołuje wspólny rozpad pozostałych wrogów (DamageSystem, source null), bez naliczania zabójstw gracza i bez uruchamiania ciszy po zwycięstwie. `completeRoom` pozostaje zablokowane do wykonania wszystkich celów; dopiero winda kończy finał i uruchamia zwykłe rozliczenie oraz ciszę. Zwykły run i Przejęcie zachowują dotychczasową ścieżkę.

Powyższy akapit opisuje pokój bossa w runie (`bossRoom`, `layout.bossEnemy`). W poziomie liniowym M06 boss jest wrogiem spotkania `bossFor`: fazy do radia przekazuje `MissionScene`, a `boss:defeated` i ukończenie `killBoss` następują z ukończeniem spotkania (szczegóły w `levels.md`).

Sprawdzenie M06: `?scene=mission&mission=m06-odlewnia&debug=1` po ukończeniu M05 (adres `?scene=run&mission=m06-odlewnia` przekierowuje do sceny `mission`); kroki w `levels.md`, sekcja „M06 — Odlewnia”. Cele opcjonalne i zegar dostrojenia pozostają poza zakresem; balans bossa jest niezmieniony.

M04 „Ładunek klasy K” wymaga M03 i odblokowuje M05. Ma liniowy poziom bocznic Hut,
Szrona od początku, trzy krótkie kwestie odprawy i sześć debriefu. Scenariusz nie ma
osobnego interludium. Radio to wyzwalacze startu, sekcji, interakcji i spotkań;
odkrycie K-112 z pytaniem Idy następuje po pokonaniu oddziału Egzekutora.
Pięć celów `interact` usuwa barykadę, wyłącza laser, przestawia dwie zwrotnice
i usuwa wózki. Potem `killBoss` (Egzekutor), nowy `escortPayload` i osobny `exit`.
`escortPayload` nie postępuje od obecności gracza w strefie: kończy go host dopiero
po statusie `RailPayload.arrived`. Zniszczenie wagonu kończy próbę bez nagród.
Pierwsze ukończenie daje 110 Danych i 1 Rdzeń. Szczegóły checkpointów i trasy:
`levels.md`, sekcja M04. Opcjonalne premie scenariusza, zmiany wystroju kryjówki
pozostają poza zakresem M04. Po dodaniu M05 przerywnik M06 opisuje kartę zdobytą przez Kuriera po rozbiciu eskorty Wirskiej.

## M05 — Adiutant

Kolejność kampanii: M04 → M05 → M06. M05 to pościg solo po dachach i estakadach
Hut; trzy kwestie odprawy, radio na starcie, w sekcjach, spotkaniach i celach,
sześć kwestii debriefu, bez interludium. Pierwsze ukończenie: 115 Danych i 1 Rdzeń.
Karta jest dostępna dopiero po snajperach i eskorcie, Wirska nie jest celem walki.
Jej wypowiedzi są oznaczonymi cytatami przekazywanymi przez Bajta (bez rozszerzania
listy podpisów UI). M06 wymaga M05; jego przerywnik potwierdza zdobycie karty
przez gracza, pozostała treść M06 pozostaje bez zmian.

Nowy cel `reach`: `position`, `radiusM`, `timeLimitS` (dodatnie liczby).
Dozwolony tylko z liniowym `level`. Odlicza od pierwszego kroku po odblokowaniu,
także poza strefą; dotarcie kończy go automatycznie. Limity M05: 95/110/90 s.
Nowy odcinek rusza w kolejnym kroku, limit ma pierwszeństwo przy jednoczesnym
dotarciu i upływie czasu. Pauza gry nie zużywa czasu. HUD pokazuje pozostałe sekundy.
`MissionObjectives.remainingS` i `failed` opisują czas oraz nieudany cel;
`resetTimers()` zeruje porażkę i odliczanie nieukończonych odcinków.
Scena uruchamia istniejące `respawning` i odradza na checkpoincie z pełnym
limitem bieżącego celu. Ukończone cele zostają. Wznowienie zapisu również rozpoczyna
bieżący odcinek od pełnego limitu; nie zmieniono formatu zapisu.
`query('mission')` udostępnia `chaseRemainingS` i `failedObjective`.

Nie wdrożono opcjonalnych premii za skróty i walizkę ani nagrody warsztatowej,
zmian wystroju kryjówki czy animowanego konwoju. Śmierć używa standardowego
checkpointu misji liniowej; różni się to od runowej porażki w scenariuszu.
Mapa i sprawdzenie w 30 sekund: `levels.md`, sekcja M05.
