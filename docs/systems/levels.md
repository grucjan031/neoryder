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
masztu; fala musi odpowiadać `reinforcements` celu. Po odrodzeniu niewykonane
posiłki mogą uruchomić się ponownie po powrocie do ich strefy.

`bossFor` (id celu `killBoss`) oznacza spotkanie z bossem: jego fala zawiera
wroga `kind: "boss"`, a ukończenie spotkania kończy wskazany cel. `closedDuring`
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
`campaign complete m01-maszty` i `campaign complete m03-list-przewozowy` w scenie `run`):

1. `god`; kolejno `tp 14 0`, `tp 44 0`, `tp 92 0`, `tp 113 0`, `tp 143 0`, po każdym
   `encounter clear` — otwierają się bramy kolejnych odcinków.
2. `tp 167 0 -90` (checkpoint `przed-arena`), idź przez wrota x=172: po wejściu
   na płytę (x≥180) wrota zamykają się, po 5 s schodzi Brandt z paskiem zdrowia.
3. Trzy razy `kill all` (po każdym odczekaj zmianę fazy): radio faz, „Ja tylko
   dowożę”, wrota i gabinet otwarte, checkpoint `po-brandcie`.
4. Serwer w gabinecie (3 s w strefie), potem winda po lewej (2 s): podsumowanie.
