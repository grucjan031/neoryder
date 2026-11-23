# Poziomy liniowe

Poziom w `src/data/levels/<id>.json` to jedna mapa ładowana w całości, bez przejść
między pokojami. `levelSchema.ts` reużywa pola `roomSchema` i jego walidację
osiągalności: `blocks`, `playerSpawn`, `spawnPoints`, `theme`, `signs`, `lights`,
`hazards`, `rainShelters`, `decor`, `ambientFx`, `decals`. Bramy zastępują drzwi.
Bloki mają ten sam format kolizji i materiałów co pokój. GLB i dressing miasta
są istniejącymi zasobami; nie wprowadzono nowych modeli.

Nowe pola:

| Pole                 | Format i znaczenie                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `objectiveOrder`     | Id celów misji w kolejności wykonania, każdy dokładnie raz.                                     |
| `objectivePositions` | Słownik id → `{x,y,z}`; także jawna pozycja modułu Helixa.                                      |
| `sections`           | `{id,name,zone,radio?}`; radio jest istniejącym wyzwalaczem z danych misji.                     |
| `encounters`         | `{id,zone,wave,spawnPoints,after?,reinforcementFor?,bossFor?}`; fala wskazuje `src/data/waves`. |
| `checkpoints`        | `{id,position,yawDeg,zone,after?}`; pierwszy jest punktem startowym.                            |
| `gates`              | `{id,block,after,closedDuring?}`; collider i siatka bloku znikają razem.                        |

`zone` to `{kind:"box",position,size}` (pełne wymiary) lub
`{kind:"sphere",position,radiusM}`. Strefy uwzględniają wysokość. `after` ma
`{kind:"objective"|"encounter",id}`. `reinforcementFor` wiąże spotkanie z wybuchem
masztu (id celu `sabotage`; fala musi odpowiadać `reinforcements` celu) albo z progiem
celu `defend`: klucz `<id celu>:<indeks>` wskazuje `waves[indeks]` celu i wymaga tej
samej fali. Spotkanie z kluczem `defend` nie startuje od strefy ani `after` — uruchamia
je wyłącznie próg postępu (`atProgress`) zgłoszony przez `MissionObjectives`. Po odrodzeniu niewykonane
posiłki mogą uruchomić się ponownie po powrocie do ich strefy.

`bossFor` (id celu `killBoss`) oznacza spotkanie dowódcy: ukończenie całej fali
kończy wskazany cel. M06 używa wroga `kind: "boss"`, M02 elity `executor`
z obstawą (bez paska i faz bossa). `closedDuring`
(id spotkania) zamyka bramę ponownie na czas, gdy to spotkanie jest aktywne —
brama areny otwiera się po `after`, zatrzaskuje za graczem i otwiera po walce.
`loadLevel` odrzuca `bossFor` wskazujące cel inny niż `killBoss` oraz nieznane
`closedDuring`.

`loadLevel(data, mission, waves)` sprawdza strukturę zod, unikalność id, referencje,
cykle spotkań, wszystkie cele misji i ich pozycje. Cele, checkpointy oraz lokalne
spawny przechodzą wspólną walidację podłóg, przeszkód i osiągalności pokoju.
Test M01 sprawdza ciągły prześwit 3 m wzdłuż trasy po asfalcie przy otwartych
bramach. Osobno przechodzi tę trasę kapsułą gracza, otwierając bramy i kończąc
cele przez obecność w strefach. Test przechodzi również obie kładki od rampy
wejściowej do rampy zejściowej.

`LevelRuntime` nie importuje renderu ani DOM. Wyzwala spotkanie raz, sprawdza
zależności i wyznacza otwarte bramy. Host tworzy WaveDirector ze strumieniem
`Rng(seed).fork('encounter:<id>')`; każde spotkanie ma własne punkty spawnu.
Wrogowie powstają tylko dla aktywnych spotkań; limit żywych każdego spotkania
to `min(maxAlive fali, tuning.level.maxAlive)` (12), liczony per `WaveDirector`
(niezależnie dla każdego aktywnego spotkania), a `RoomScene` dodatkowo odrzuca
spawn ponad `min(maxAlive fali pokoju (u hosta = tuning.level.maxAlive), layout.maxAlive)`
i ponad limit ciał Rapiera (`tuning.physics.maxDynamicBodies`). `spawnPoints` fali są zastępowane punktami spotkania. Po checkpointowym odrodzeniu host usuwa
pozostałych wrogów, statusy i pociski, a następnie odtwarza stan bram.

Reguły hosta (`src/scenes/mission.ts`), potrzebne do odtworzenia przebiegu:

- Wyzwolenie: co krok symulacji `LevelRuntime.step` startuje każde spotkanie, które
  nie jest ukończone ani aktywne, ma spełnione `after` (cel `done` lub spotkanie
  ukończone) i którego strefa zawiera pozycję gracza (`insideLevelZone`: sfera
  `|d| ≤ radiusM`, skrzynia `|dx|,|dy|,|dz| ≤ size/2`, uwzględnia Y).
- Spotkanie jest ukończone, gdy jego `WaveDirector` osiągnie fazę `done`
  (po `wave_cleared` ostatniej fali); wtedy trafia do `completed`.
- Posiłki: zakończenie celu `sabotage` z `reinforcements` zgłasza klucz (id celu);
  w następnym kroku startuje spotkanie z `reinforcementFor == klucz`.
- Odrodzenie: po `player_died` licznik `tuning.level.respawnDelayS` (1,2 s); potem
  usunięcie wszystkich dyrektorów, `LevelRuntime` odtworzony z zapisanych
  `completedEncounters`, teleport do bieżącego checkpointu (`yawDeg`), reset
  postępu niedokończonych celów i zapalników, pełne zdrowie i energia.
  `completedEncounters` jest zapisywane **tylko przy zmianie checkpointu**, więc
  spotkania ukończone po ostatnim checkpoincie po śmierci startują od nowa.
- Checkpointy: aktywowane tylko „do przodu” (kolejne na liście po bieżącym), gdy
  `after` spełnione i gracz w `zone`. Pierwszy checkpoint to start.
- Sekcje: pierwsze wejście w `zone` sekcji wysyła jej `radio` (raz).
- Bramy (`gates`): blok z colliderem; otwarty (niewidoczny, collider wyłączony),
  gdy `after` spełnione i nie trwa spotkanie `closedDuring`; stan przeliczany co krok.
- Boss (`bossFor`): boss powstaje jak każdy wróg spotkania, więc pasek zdrowia
  (`boss_spawned`), fazy i wezwania działają bez zmian w `src/enemies`. Wezwania
  z `placement: "spawnPoints"` używają `spawnPoints` poziomu (w M06: boczne śluzy
  areny). `WaveDirector` tego spotkania ma stały mnożnik liczebności `normal`,
  żeby boss był jeden na każdym poziomie trudności. Host przekazuje `boss_phase`
  do radia (`boss:phase:2|3`), a po ukończeniu spotkania wysyła `boss:defeated`
  i kończy cel `killBoss`. Spotkanie z `bossFor` nie startuje, gdy cel jest już
  `done` (wznowienie zapisu, `objective done`). Po śmierci gracza boss znika
  razem z resztą wrogów i walka zaczyna się od pełnego zdrowia. `encounter clear`
  nie zabija bossa (limit obrażeń na fazę) — w debug użyj trzykrotnie `kill all`.
  Oprawa `BossArenaFx` pokoju bossa nie jest podłączona do poziomu liniowego.
- Kierunek celu: `killBoss` nie ma pozycji w danych misji, więc znacznik
  kierunku prowadzi do `objectivePositions[<id>]` poziomu (środek areny).
- Seed runu misji: parametr URL `seed`, inaczej `String(ctx.rng.getState())`;
  spotkanie `X` używa `new Rng(seed zapisu).fork('encounter:X')`, posiłki
  w `RoomScene` (gdy host nie przejmuje) `ctx.rng.fork('reinforcement:<klucz>')`.
  Zapis (`snapshot`) trzyma `checkpointId`, `completedEncounters`, stan celów,
  `elapsedS` i flagę `completed`; zapis z niewykonanym celem przed wykonanym
  (kolejność `objectiveOrder`) jest odrzucany.

Statyka korzysta z `batchStaticGeometry` i `tuning.level.staticCellSizeM` (24 m),
co zachowuje odrzucanie dalekich komórek z kadru. Collider każdego bloku Rapiera
jest statyczny. Bramy pozostają osobno, ponieważ zmieniają widoczność i kolizję.
Liczby spotkań i geometrii są w danych. Limit wrogów, komórka statyki i opóźnienie
odrodzenia są widoczne w folderze `level` panelu lil-gui.

M01 generuje `node tools/levels/buildM01.mjs`; wynik JSON i sześć definicji fal
trafiają do repo. Siedem odcinków (`sluza`, `targ`, `tunel`, `dziedziniec`, `zaplecze`, `plac`, `kanal`)
ma łącznie 320 m; w danych jest 7 spotkań patrolowych/osłonowych (`patrol-*`,
`oslona-*`) i 3 spotkania posiłków (`reinforce-mast-1..3`, fala `missionPatrol`, po 2 punkty); szerokości zmieniają się od
10 m w tunelu do 28 m na placu. Neon Noir: ciemne fasady, mokry asfalt, dach
przejścia, stragany, rusztowania, istniejące neony z dozwolonej palety i deszcz.

Każdy odcinek ma ręcznie rozmieszczone osłony i rekwizyty. Śluza ma bariery
i skrzynie, targ wyspy straganów, tunel rury i kratki, dziedziniec wrak oraz
przegrody z blachy, zaplecze sprzęt budowlany i kładki, plac kontener i kiosk,
a kanał kontener odpadów i barierę drogową. Osłony przecinają oś na targu,
dziedzińcu, zapleczu i placu. Droga po asfalcie omija je zakosami, a na zapleczu
można też przejść nad patrolem dwiema kładkami na wysokości 4,25 m. Ich rampy
zaczynają się przy x=189 i kończą przy x=223,4. W szerszych odcinkach spotkania
korzystają z bocznych punktów spawnu. Naklejki na asfalcie, różne wysokości
fasad i neonów oraz strzałki przy przejściach odróżniają kolejne odcinki.

Zadaszenia M01 mają lokalne, niemigające światła w ciepłej bieli `#fff1d6`:
pod stropami x=0–44 i x=92–136 co 8 m, na y=5,8, z=0 (intensywność 40,
zasięg 14 m), a pod bocznymi podestami rusztowań x=194–218 przy z=±5,5
na x=198/206/214, y=3,3 (intensywność 16, zasięg 9 m). Istniejący renderer
tworzy też plamy światła na podłodze i zachowuje limit puli aktywnych świateł.
Wcześniejsze źródła przy środkach odcinków nie pokrywały całej długości
zadaszonej podłogi; `rainShelters` wycina wyłącznie deszcz, nie odbicia ani światła.
Generator zachowuje to oświetlenie przy ponownym zbudowaniu danych poziomu.

Panorama jest generowana wokół początku świata, a jej budynki nie mają kolizji.
W poziomie liniowym render pomija bryły panoramy przecinające obwiednię bloków
poziomu: w M01 mogły one wcześniej nachodzić na trasę m.in. przy x=87–95,
x=120–127 i x=146–170. Pozostała panorama i niebo zostają dostępne w tle.
Test `missionLinear.test.ts` sprawdza całą asfaltową podłogę względem brył panoramy.

## M03 „List przewozowy”

`src/data/levels/m03-list-przewozowy.json` (ok. 250 m trasy na wschód, motyw `neonStreet`),
pięć sekcji:

| Sekcja       | x (m)   | Szer. | Treść                                                                                                                                           |
| ------------ | ------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `nabrzeze`   | 0–84    | 8/28  | Kanał kablowy pod pirsem (zadaszony, x 0–28), potem nabrzeże: suwnica bramowa, kontenery w zakosach, wózek kontenerowy, kontenerowiec przy kei. |
| `plac-celny` | 84–132  | 24    | Wyspa kontenerów z przesmykiem (x 106–110) i dwie zapory laserowe: południowa x=100, północna x=116. Biura dyspozytorskie (błękit, fiolet).     |
| `przedpole`  | 132–176 | 30    | Posterunek przed wrotami Magazynu 9: kontenery w poprzek, wagon, bariery przy wrotach, zielona dziewiątka nad wejściem.                         |
| `magazyn`    | 176–226 | 30    | Hala z terminalem na środku (201, 0, 0), krąg 6 m, galerie boczne na 4,25 m z rampami, kontenery poza kręgiem, dwie skrzynki w kręgu.           |
| `dok`        | 226–262 | 20    | Dok załadunkowy i barka przy południowej krawędzi; cel `exit` w przejściu przez nadburcie (244, 0, −12,6).                                      |

Spotkania (8): `patrol-nabrzeze` (`m03Quay`: 2 szturmowców, strzelec), `oslona-celna`
(`m03Customs`: tarczownik, 2 drony, wieżyczka), `posterunek-magazynu` (`m03Forecourt`:
2 tarczowników, 2 strzelców, 2 wieżyczki), `pierwsza-zmiana` (`missionPatrol`, strefa
9 m wokół terminala), `transfer-1..3` (`reinforcementFor: terminal:0..2`; fale celu przy
25/55/85%: `missionPatrol`, `missionDockShields`, `missionPatrol`) i `poscig`
(`m03Pursuit`, po ukończeniu terminala, od strony wejścia). Bramy: `gate-patrol-nabrzeze`
(x=84), `gate-oslona-celna` (x=132), `gate-magazyn` (x=176,5) po spotkaniach oraz
`gate-dok` (x=225,5) po celu `terminal`. Checkpointy: `start`, `plac-celny`, `przedpole`,
`magazyn`, `dok`. Radio sekcji: `enterNode:3`, `enterNode:6`, `enterNode:7`.

Po odrodzeniu w trakcie transferu postęp wraca do 0 (wpięcie zostaje), a progi ponownie
uruchamiają fale. Przeszkody obrócone o 90° (kontenery w poprzek, bariery) to dekor GLB
z niewidocznym blokiem kolizji, bo walidacja układu liczy nieobrócony obrys. Krawędzie
wody i burty barki mają niewidoczne bloki; pokład barki to niewidoczna podłoga na y=0.
Cyfry doków 7, 8 i 9 są złożone z bloków `neon_green`. Nie dodano nowych modeli.

Sprawdzenie M03 w 30 s: ukończ M01 i M02 (`?scene=run&debug=1`, kolejno
`campaign complete m01-maszty`, `campaign complete m02-punkt-kontrolny`),
otwórz `?scene=mission&mission=m03-list-przewozowy&debug=1`, `god`. `tp 40 0 -90` startuje
patrol, `encounter clear` otwiera bramę celną. `checkpoint magazyn`, podejdź do terminala
i zostań w kręgu: przy 25/55/85% wchodzą fale; wyjście z kręgu zatrzymuje pasek.
`objective done terminal` otwiera bramę dokową, `checkpoint dok`, wejdź w ramę na trapie
barki (2 s) albo `objective done exit`. Testy: `missionM03Level.test.ts`,
`tests/e2e/missionList.spec.ts`.

## Sprawdzenie w 30 sekund

1. Otwórz `?scene=mission&mission=m01-maszty&debug=1`, w konsoli wpisz `god`.
2. `tp 98 0 -90`: idź naprzód; brama x=100 blokuje. `objective done mast-2`
   jest odrzucane; `objective done mast-1` otwiera przejście.
3. `checkpoint po-maszcie-1`: teleportuje za bramę i zapisuje punkt kontrolny.
4. `god`, `hurt 9999`: przy wyłączonej nieśmiertelności odrodzenie następuje
   w checkpoincie, bez utraty ukończonych celów. `query('mission')` pokazuje stan.
5. `objective done mast-2`, `objective done helix`, `objective done mast-3`,
   `checkpoint ewakuacja`, `objective done exit`: podsumowanie i powrót do kryjówki.

Szybka kontrola osłon i kładek w tej samej scenie:

- `god`, `tp 54 0 -90`: pierwsza wyspa targu zasłania oś ulicy. Omiń ją od
  strony dodatniego z, a następną od strony ujemnego z.
- `objective done mast-1`, `objective done mast-2`, `objective done helix`,
  `tp 188.8 5.5 -90`: idź naprzód po rampie, obejrzyj ulicę z góry i zejdź
  po drugiej stronie. Powtórz przy z=−5,5. `encounter clear` usuwa aktywny patrol.

Pełny playtest: zacznij od wejścia, bez teleportacji. Sprawdź czytelność kierunku
i bram, różnicę ciasnego tunelu i szerokiego placu, linie ostrzału wieżyczek,
zakosy między osłonami, czas ucieczki po podłożeniu ładunku i tempo siedmiu starć.
Sprawdź checkpoint po Helixie oraz kontynuację z tablicy po przeładowaniu gry.
Równocześnie zwróć uwagę na FPS podczas deszczu i spojrzenia wzdłuż całej ulicy.

Kontrola oświetlenia w scenie `mission` (włącz `god`):

- `checkpoint start`: x=5, z=0; obejrzyj podłogę i boczne osłony aż do x=44.
- `checkpoint po-maszcie-1`: x=104, z=0; sprawdź asfalt, boki i wyjście
  spod stropu x=92–136, także patrząc z powrotem w stronę wejścia.
- `checkpoint po-helixie`: x=192, z=0; podejdź pod oba podesty
  x=194–218, z=±5,5. Sprawdź podłogę i słupy przy x=196/216.

Test danych `level.test.ts` sprawdza lokalne światło z zapasem zasięgu na siatce
podłogi pod wszystkimi czterema zadaszeniami; ocenę kontrastu i jasności wykonaj w grze.

Testy: `level.test.ts`, `missionCheckpoint.test.ts`, `missionLinear.test.ts`,
`missionsPanel.test.ts`; `tests/e2e/missionLinear.spec.ts` przygotowany do uruchomienia
przez prowadzącego. Stary E2E `missionMaszty.spec.ts` został zastąpiony.

## M06 — Odlewnia

`src/data/levels/m06-odlewnia.json` zastępuje dawny wariant runowy misji. Poziom
biegnie wzdłuż +X, 212 m do ściany gabinetu plus 16 m gabinetu; między odcinkami
stoją przegrody z przejściem 5 × 4 m, które wypełnia brama w pasy ostrzegawcze.

| Odcinek (`sections`) | X       | Szer. | Charakter                                                                                     |
| -------------------- | ------- | ----- | --------------------------------------------------------------------------------------------- |
| `sluza`              | 0–36    | 10 m  | Chłodna śluza serwisowa pod stropem 5 m: błękit, ciepła biel, para z kratek.                  |
| `piece`              | 36–84   | 24 m  | Plac pod gołym niebem: sześć pieców z żarem za rusztami, suwnica z kadzią, formy jako osłony. |
| `formowanie`         | 84–136  | 28 m  | Hala 11 m: trzy kadzie na osi, dwie kładki 4,25 m z rampami przy x=89 i x=131 (flanki).       |
| `przedpokoj`         | 136–172 | 14 m  | Korytarz sztabu 6 m: dyżurka, słupy, błękit i fiolet.                                         |
| `centrum`            | 172–212 | 32 m  | Arena 13 m: stalowa płyta, kanały odlewnicze po bokach, cztery osłony, boczne śluzy.          |

Za areną leży gabinet Brandta (x=212–228, serwer przy ścianie −Z w `(224, 0, −7,05)`)
i szyb windy towarowej (`(216, 0, −11,5)`), na lewo od wejścia do gabinetu.

Spotkania (fale `m06*` w `src/data/waves`) tworzą łańcuch `after`:
`patrol-sluza` (2 assaulter, 1 gunner) → `piece` (3 assaulter, 2 gunner, 1 drone)
→ `formowanie-front` (2 shielder, 2 gunner, 1 turret) → `formowanie-tyl`
(2 drone, 3 assaulter, 1 gunner) → `straz` (executor, shielder, sniper, gunner)
→ `brandt` (`bossFor: brandt`, `securityChief`, `firstBreakS` 5 s na zapowiedź
radiową). Bramy: `gate-sluza` x=36, `gate-piece` x=84, `gate-formowanie` x=136
(po `formowanie-tyl`), `gate-sztab` x=172 (po `straz`, `closedDuring: brandt`),
`gate-gabinet` x=212 (po celu `brandt`), `gate-winda` (po celu `server`).
Punkty kontrolne: `start`, `piece`, `formowanie`, `przedpokoj`, `przed-arena`
(x=167, tu wraca gracz po śmierci w walce z bossem) i `po-brandcie` (x=204).
`spawnPoints` poziomu to cztery boczne śluzy areny `(177|207, ±12)`: stamtąd
wchodzą wezwania Brandta. Radio odcinków: `enterNode:3` (hala formowania),
`enterNode:6` (przedpokój), `enterNode:7` (arena).

Oświetlenie trzyma paletę ADR 0006: bursztyn pieców, kadzi i kanałów, ciepła biel
lamp roboczych, zieleń paneli zaworów, błękit i fiolet sztabu. Dekor to istniejące
modele (`rail_signal_gantry`, `port_warehouse_roof_truss`, `city_*`, `power_slag_heap`).
Dane generuje skrypt wzorowany na `tools/levels/buildM01.mjs`; test
`missionM06Linear.test.ts` sprawdza walidację, prześwit 3 m trasy, obie kładki,
pełne przejście kapsułą z walką z bossem, odrodzenie przed areną i wznowienie.

Sprawdzenie w 30 sekund (`?scene=mission&mission=m06-odlewnia&debug=1`, po
`campaign complete m01-maszty`, `campaign complete m03-list-przewozowy`
i `campaign complete m04-ladunek-klasy-k` w scenie `run`):

1. `god`; kolejno `tp 14 0`, `tp 44 0`, `tp 92 0`, `tp 113 0`, `tp 143 0`, po każdym
   `encounter clear` — otwierają się bramy kolejnych odcinków.
2. `tp 167 0 -90` (checkpoint `przed-arena`), idź przez wrota x=172: po wejściu
   na płytę (x≥180) wrota zamykają się, po 5 s schodzi Brandt z paskiem zdrowia.
3. Trzy razy `kill all` (po każdym odczekaj zmianę fazy): radio faz, „Ja tylko
   dowożę”, wrota i gabinet otwarte, checkpoint `po-brandcie`.
4. Serwer w gabinecie (3 s w strefie), potem winda po lewej (2 s): podsumowanie.

## M04 — Ładunek klasy K

Generator `node tools/levels/buildM04.mjs` zapisuje poziom i cztery fale `m04*`.
Tor biegnie w osi +X: wagon od x=12 do x=240, wyjście przy x=249. Sekcje:
nastawnia (0–56 m), rogatka (56–104), rozjazd wschodni (104–164), rozjazd
Egzekutora (164–220), tunel (220–260). Szerokość 14–28 m, drogi serwisowe i osłony
po obu stronach toru, istniejące bramownice, podkłady i para. Oświetlenie:
bursztynowe semafory, zielone zwrotnice, błękit i ciepła biel. Szron dołącza na starcie.

Spotkania: patrol (2 szturmowców, strzelec), rogatka (tarczownik, 2 strzelców,
wieżyczka), wschodni rozjazd (2 szturmowców, tarczownik, 2 drony), Egzekutor
(Egzekutor, 2 strzelców, dron). Ostatnie ma `bossFor: executor`; istniejący
Egzekutor jest elitą, a cel kończy pokonanie całego oddziału.

Kontrakt poziomu: opcjonalne `payload: { objective, route, stops }`. `objective`
wskazuje `escortPayload`, `route` to punkty `{x,y,z}`. Postój
`{id,name,atM,unlockAfter}` zatrzymuje środek wagonu na dystansie `atM`, aż wcześniejszy
cel `unlockAfter` będzie `done`. Walidacja sprawdza referencje, kolejność postojów,
trasę i dystanse checkpointów. Każdy checkpoint eskorty ma `payloadDistanceM`;
normalna aktywacja wymaga dotarcia gracza i wagonu. Wznowienie/odrodzenie odtwarza
wagon na tym dystansie z pełnym HP, bez zmiany formatu `MissionSave`.

Lokalny `PayloadMissionRoom` w `mission.ts` reużywa `RailPayload`, `PayloadView`,
interpolacji i `PrototypeHud`. Ruch/HP/bryła to `tuning.prototypes.payload`:
3,5 m/s, 400 HP, gracz w promieniu 9 m, postój przy wrogach w promieniu 22 m.
`RailPayload.canDepart(stopId)` to opcjonalny hook blokady, `restore(distanceM)`
odtwarza checkpoint bez ponownego wyzwalania wcześniejszych fal. Wagon jest neutralnym
celem `Health`/`DamageSystem`; hurtbox przyjmuje pociski wrogów, odrzuca obrażenia
gracza i Szrona. Przy 0 HP próba znika z zapisu i następuje powrót bez nagród do
kryjówki. Błąd usunięcia można ponowić przez `mission retry`, cele pozostają zablokowane.

Sprawdzenie: po `campaign complete m03-list-przewozowy` otwórz
`?scene=mission&mission=m04-ladunek-klasy-k&debug=1`. `payload status` pokazuje stan,
`payload skip` skraca trasę w debug, `payload hp 0` sprawdza porażkę. Cele:
`barricade`, `laser`, `switch-1`, `carts`, `switch-2`, `executor`, `payload`, `exit`.
Interakcje trwają 2 s. `missionM04Level.test.ts` przechodzi trasę kapsułą bez
teleportacji, `missionM04.spec.ts` sprawdza tablicę, cele, powrót i odblokowanie M05.

Do oceny Architekta: czytelność toru, tempo eskorty, HUD drużyny i balans ostrzału.
Celowanie pozostaje takie jak w prototypie: wrogowie wybierają gracza lub sojusznika,
a wagon obrywa pociskami na linii ostrzału. Świadome wybieranie wagonu wymaga
osobno uzgodnionego hooka w chronionym `roomScene.ts`.
Odkrycie K-112 przekazuje radio; widok wagonu pozostaje modelem prototypu bez
animacji wyrwania drzwi i odsłonięcia Idy.

## Sojusznicy na poziomie

Opcjonalne pole `allies: [{ id, spawn, joinAfter? }]` dodaje sojuszników z `src/data/allies`
(opis: `docs/systems/allies.md`, sekcja „Misje liniowe”). Poziomy bez tego pola działają jak dotąd.

## M02 — Punkt kontrolny

Generator `node tools/levels/buildM02.mjs` zapisuje poziom i pięć fal `m02*`.
Jedna mapa ma 220 m długości i biegnie na zachód (malejące X), od x=215 do x=8:
kordon pod nasypem (220–170), bocznica z rampą selekcji (170–130), plac dwóch
kontenerów i skaner Helixa (130–80), punkt dowodzenia pod suwnicą z trzecią celą
(80–30), zachodnia brama i kanał ewakuacyjny (30–0). Szerokości 16–28 m;
przepusty mają stropy, wagony i kontenery osłaniają boki, środkiem wiedzie trasa.
Modele pochodzą z istniejących zasobów `city_*` i `port_*`; światła używają palety
ADR 0006. Rygiel wskazuje jasne światło, dodatkowa przesłona znika po interakcji;
sam korpus kontenera pozostaje statyczny, bez animacji wychodzących cywilów.

Osiem spotkań: `patrol-kordon`, `rampa`, `straz-cel`, pościgi `poscig-1..3`
po otwarciu odpowiadających im cel, `oslona-suwnicy` i `egzekutor` po trzeciej
celi. Egzekutor ma dwóch strzelców; wieżyczki stoją na rampie i przy suwnicy.
Nie ma dronów ani tarczowników. Bramy x=170 i x=130 wymagają pokonania patrolu
i rampy; x=80 otwarcia drugiej celi; x=30 ukończenia spotkania Egzekutora.
Checkpointy: `start`, `bocznica`, `plac`, `zbiorka`, `ewakuacja`.

Nadia (`allies`, `joinAfter: objective/cell-2`) dołącza przy drugiej celi,
walczy i podąża za graczem do wyjścia; pozostali zatrzymani są tłem fabularnym.
Wznowienie zapisu po uwolnieniu odtwarza Nadię. Obowiązuje wspólny model
powalenia/podnoszenia sojuszników, bez trwałej śmierci i osobnego warunku porażki.

Sprawdzenie w 30 s: po `campaign complete m01-maszty` w scenie `run` otwórz
`?scene=mission&mission=m02-punkt-kontrolny&debug=1&fx=lite`, `god`.
`tp 116 -7 90` (2 s), `tp 94 7 90` (2 s) uwalniają dwie cele i Nadię.
`tp 61 -7 90` otwiera trzecią celę; po 3 s pojawia się Egzekutor z obstawą.
`kill all` po zakończeniu spawnu otwiera zachodnią bramę; `tp 8 0 90` kończy misję.
Pełne przejście kapsułą, kolizje bram, dołączenie i wznowienie Nadii sprawdza
`missionM02Level.test.ts`; start z tablicy, walkę, powrót i zapis kampanii —
`tests/e2e/missionM02.spec.ts`.

## M05 — Adiutant

Generator `node tools/levels/buildM05.mjs` zapisuje poziom i cztery fale `m05*`.
Trasa ma 254 m, motyw `neonStreet`, pięć sekcji:

| Sekcja        | x (m)   | Trasa i starcia                                                                                                               |
| ------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `dachy`       | 0–40    | Szyb techniczny, dach walcowni, wentylatory, para i bursztynowe światła narożne.                                              |
| `estakada`    | 40–96   | Tylna straż: szturmowcy, strzelec, wieżyczka. Gródź po walce, boczna roleta (prześwit 1,15 m) i górne obejście po wentylacji. |
| `maszynownia` | 96–120  | Osłonięty łącznik z instalacjami, ciepła biel i wyjście na suwnice.                                                           |
| `suwnice`     | 120–184 | Dolna kładka: tarczownicy i drony; górne belki na 3,2 m, luki 9 i 8 m do podwójnego skoku/dasha.                              |
| `ladowisko`   | 184–254 | Kominy jako osłony, snajperzy na gzymsach 4 m, potem eskorta. Wirska przy relingu, karta i szyb wyjściowy.                    |

Cele: `estakada` → `suwnice` → `ladowisko` (reach, 95/110/90 s) →
`karta` (pickup) → `exit` (2 s). Checkpointy: `start`, `maszynownia`,
`podejscie`, `ladowisko`, `karta`; środkowe zapisują się przy końcach
odcinków. Bramy odcinków wymagają celów, grodzie wymagają spotkań i mają fizyczne
obejścia. `allies: []`: pościg solo, rozmowy z kryjówką tylko w radiu.
Wirska używa istniejącego neutralnego widoku NPC bez broni, obrażeń i AI drużyny.
Brak animowanego konwoju i śmigłowca; ruch przekazuje radio. Opcjonalna walizka
i premie za skróty pozostają poza tym wariantem.

Rozszerzenia formatu: `objectiveAfter` wiąże cel ze spotkaniem (karta po
`oslona-ladowiska`); warunek blokuje ukończenie również przez debug, ale zachowuje
widoczny kierunek celu. Host ustawia czysty predykat `MissionObjectives.canComplete`.
`objectiveNpcs: [{objective,spawn,yawDeg}]` ustawia neutralny istniejący model.
`encounters[].spawnHeightM` określa wysokość fali (snajperzy: 4 m), bez pola y=0.

Sprawdzenie w 30 s po M04: `?scene=mission&mission=m05-adiutant&debug=1`,
`god`, `tp 50 0 -90`, `encounter clear`, `tp 92 0`, `tp 134 0`,
`encounter clear`, `tp 180 0`, `tp 206 0`, `encounter clear`, `tp 218 0`,
`encounter clear`, `tp 240 0`, `tp 248 -7`. Poczekaj na start spotkania
między teleportacją a czyszczeniem. Testy: `missionChase.test.ts`,
`missionM05Level.test.ts` (pełna dolna trasa kapsułą, limit i wznowienie),
`missionM05.spec.ts` (tablica, cele, debrief, odblokowanie M06).

## M07 — Nocny dyżur

Generator `node tools/levels/buildM07.mjs` zapisuje poziom i siedem fal `m07*`.
Trasa biegnie w osi +X (0–332 m), Nadia dołącza na starcie. Sekcje: `bulwar`
(Bulwar nocą, kuchnia budki z makaronem, krata w zapleczu), `estakada` (pomost za
przychodnią), `przychodnia` (hala z boksami zabiegowymi i magazyn z chłodziarką),
`serwerownia` (korytarz z szafami i szklane biuro administratora), `targ` (nocny targ
pod estakadą i winda towarowa). Neony w palecie ADR 0006: bursztyn, zieleń,
fiolet, błękit i ciepła biel; czerwień, cyan i magenta zostają dla wrogów, gracza
i Rezonansu.

Cele: `krata` (`interact`, 1,5 s), `kapsula` (`pickup` po kracie), `serwer`
(`defend`, 1 s podpięcia i 8 s transferu, fala `m07Serwer` przy 60%), `exit`
(winda, 3 s). Bramy: `gate-krata`, `gate-serwerownia` (po kapsule), `gate-targ`
(po serwerze), `gate-winda` (po spotkaniu `blokada-windy`) i `gate-rolety`.

Zakradanie bez systemu wykrywania: układ hali. Korytarz środkowy (x 128–164,
|z| < 3,2) jest oświetlony, ma bursztynowe wiązki (`laser_gate`) i strefę spotkania
`alarm-hala`; pasy boczne za szklanymi przegrodami (boksy zabiegowe) mają osłony i nie
mają spotkań. Wejście w korytarz startuje alarm: fala `m07Hala` i opuszczone rolety
(`gate-rolety` z `closedDuring: alarm-hala`) odcinają odwrót do końca walki. Kolejne
spotkania `wieza-magazynu` (wieżyczka i dron) są małe. Alarm po serwerze to spotkania
z `after: objective(serwer)`: `alarm-serwerownia` (za plecami gracza) i trzy fale na
targu (`poscig-targ-1`, `poscig-targ-2`, `blokada-windy`, łańcuch `after`). Ucieczka
jest bez limitu czasu (cel czasowy to osobne zadanie). Wrogowie: istniejące
archetypy (`shielder` jako ochroniarz Helixy, `hacker` jako sanitariusz, `drone`,
`turret`, `assaulter`, `gunner`); dedykowane warianty Helixy są w backlogu scenariusza.

Radio ma wyzwalacze `runStart`, `checkpoint:<id>` (ulica, kuchnia, magazyn, winda),
`enterSection`, `objective:*` i `encounter:*`. Pominięte względem scenariusza: cele
opcjonalne (ciche przejście, harmonogram transportów) i panel wyłączania wieżyczki.
Testy: `missionM07Level.test.ts` (walidacja, alarm w strefie, przejście trasy
kapsułą po cichym pasie), `missionM07.spec.ts` (tablica po M06, cele, alarm, pościg, debrief).

## M08 — Kwarantanna

`node tools/levels/buildM08.mjs` odtwarza misję, poziom, cztery fale `m08*`
i wariant danych wroga `rozstrojony` (szybszy, mniej wytrzymały `assaulter`,
bez broni palnej). Trasa 252 m w osi +X ma pięć sekcji:
kordon (0–40), Skrzydło A z pralnią (40–100), Skrzydło B ze studnią i galeriami
(100–160), dziedziniec rozładunkowy (160–212), winda (212–252).
Galerie są scenografią; trasa ewakuacji biegnie po ciągłej podłodze.
Motyw `neonStreet`, istniejące modele, ciepła biel lamp co 8 m i zielone
oznaczenia szybów; bursztyn kordonu, błękit/fiolet komunikatów. Ocena jasności
i kompozycji w grze pozostaje do wykonania przez Architekta.

Spotkania: `kordon`, `oslona-a/b/c`, następnie `ewakuacja-1/2` przy 20/60%
obrony windy. Osłony blokują otwarcie śluz przez `objectiveAfter`.
Bramy wymagają kolejno patrolu, otwarcia każdej śluzy, przeprowadzenia każdej
grupy i ukończenia obrony. Pięć checkpointów rozpoczyna kolejne sekcje.
Szron dołącza przez `allies` od startu. Dziesięciu neutralnych NPC (3+3+4)
czeka przy śluzach; bez hurtboxów, broni i nowego AI. Po zaliczeniu powiązanego
celu `reach` host przekazuje widokowi stan `evacuated`, ukrywając grupę.
Pozostali NPC celów (np. M05) zachowują dotychczasowe zachowanie.

Ewakuacja jest uproszczona: po otwarciu śluzy gracz dochodzi do oznaczonego
wejścia do bezpiecznego szybu, a grupa jest uznawana za wyprowadzoną.
Nie ma animacji przejścia cywilów ani ich trwałej śmierci. Wrogowie Helixy
i Rozstrojeni walczą z graczem i Szronem, nie między sobą.

Sprawdzenie w 30 s: po `campaign complete m07-nocny-dyzur` w scenie `run`
otwórz `?scene=mission&mission=m08-kwarantanna&debug=1&fx=lite`, `god`.
`tp 16 0`, poczekaj na patrol, `encounter clear`; powtórz dla x=48, 108, 168.
W odpowiedniej kolejności: śluzy x=62/122/182 (2 s), strefy x=82/142/202,
obrona x=222 (2 s uruchomienia + 25 s), wyjście x=244 (2 s).
Testy: `missionM08Level.test.ts`, `missionM08.spec.ts` (port 4261).
