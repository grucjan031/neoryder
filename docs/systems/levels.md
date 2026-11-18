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
masztu; fala musi odpowiadać `reinforcements` celu. Po odrodzeniu niewykonane
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
Wrogowie powstają tylko dla aktywnych spotkań; wspólny limit to minimum limitu
poziomu i `tuning.level.maxAlive`. Po checkpointowym odrodzeniu host usuwa
pozostałych wrogów, statusy i pociski, a następnie odtwarza stan bram.

Statyka korzysta z `batchStaticGeometry` i `tuning.level.staticCellSizeM` (24 m),
co zachowuje odrzucanie dalekich komórek z kadru. Collider każdego bloku Rapiera
jest statyczny. Bramy pozostają osobno, ponieważ zmieniają widoczność i kolizję.
Liczby spotkań i geometrii są w danych. Limit wrogów, komórka statyki i opóźnienie
odrodzenia są widoczne w folderze `level` panelu lil-gui.

M01 generuje `node tools/levels/buildM01.mjs`; wynik JSON i sześć definicji fal
trafiają do repo. Siedem odcinków ma łącznie 320 m; szerokości zmieniają się od
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
