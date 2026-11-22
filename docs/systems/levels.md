# Poziomy liniowe

Poziom w `src/data/levels/<id>.json` to jedna mapa ładowana w całości, bez przejść
między pokojami. `levelSchema.ts` reużywa pola `roomSchema` i jego walidację
osiągalności: `blocks`, `playerSpawn`, `spawnPoints`, `theme`, `signs`, `lights`,
`hazards`, `rainShelters`, `decor`, `ambientFx`, `decals`. Bramy zastępują drzwi.
Bloki mają ten sam format kolizji i materiałów co pokój. GLB i dressing miasta
są istniejącymi zasobami; nie wprowadzono nowych modeli.

Nowe pola:

| Pole                 | Format i znaczenie                                                                     |
| -------------------- | -------------------------------------------------------------------------------------- |
| `objectiveOrder`     | Id celów misji w kolejności wykonania, każdy dokładnie raz.                            |
| `objectivePositions` | Słownik id → `{x,y,z}`; także jawna pozycja modułu Helixa.                             |
| `sections`           | `{id,name,zone,radio?}`; radio jest istniejącym wyzwalaczem z danych misji.            |
| `encounters`         | `{id,zone,wave,spawnPoints,after?,reinforcementFor?}`; fala wskazuje `src/data/waves`. |
| `checkpoints`        | `{id,position,yawDeg,zone,after?}`; pierwszy jest punktem startowym.                   |
| `gates`              | `{id,block,after}`; collider i siatka bloku znikają razem.                             |

`zone` to `{kind:"box",position,size}` (pełne wymiary) lub
`{kind:"sphere",position,radiusM}`. Strefy uwzględniają wysokość. `after` ma
`{kind:"objective"|"encounter",id}`. `reinforcementFor` wiąże spotkanie z wybuchem
masztu (id celu `sabotage`; fala musi odpowiadać `reinforcements` celu) albo z progiem
celu `defend`: klucz `<id celu>:<indeks>` wskazuje `waves[indeks]` celu i wymaga tej
samej fali. Spotkanie z kluczem `defend` nie startuje od strefy ani `after` — uruchamia
je wyłącznie próg postępu (`atProgress`) zgłoszony przez `MissionObjectives`. Po odrodzeniu niewykonane
posiłki mogą uruchomić się ponownie po powrocie do ich strefy.

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
  gdy `after` spełnione; stan przeliczany co krok.
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

Sprawdzenie M03 w 30 s: ukończ M01 (`?scene=run&debug=1`, `campaign complete m01-maszty`),
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
