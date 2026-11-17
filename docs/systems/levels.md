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
Walidacja płaska nie dowodzi przechodniości bram; pełny test M01 przechodzi
fizycznie przez całą trasę środkiem ulicy, kończąc cele przez obecność w strefach.

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

## Sprawdzenie w 30 sekund

1. Otwórz `?scene=mission&mission=m01-maszty&debug=1`, w konsoli wpisz `god`.
2. `tp 98 0 -90`: idź naprzód; brama x=100 blokuje. `objective done mast-2`
   jest odrzucane; `objective done mast-1` otwiera przejście.
3. `checkpoint po-maszcie-1`: teleportuje za bramę i zapisuje punkt kontrolny.
4. `god`, `hurt 9999`: przy wyłączonej nieśmiertelności odrodzenie następuje
   w checkpoincie, bez utraty ukończonych celów. `query('mission')` pokazuje stan.
5. `objective done mast-2`, `objective done helix`, `objective done mast-3`,
   `checkpoint ewakuacja`, `objective done exit`: podsumowanie i powrót do kryjówki.

Pełny playtest: zacznij od wejścia, bez teleportacji. Sprawdź czytelność kierunku
i bram, różnicę ciasnego tunelu i szerokiego placu, linie ostrzału wieżyczek,
osłony po bokach, czas ucieczki po podłożeniu ładunku i tempo siedmiu starć.
Sprawdź checkpoint po Helixie oraz kontynuację z tablicy po przeładowaniu gry.
Równocześnie zwróć uwagę na FPS podczas deszczu i spojrzenia wzdłuż całej ulicy.

Testy: `level.test.ts`, `missionCheckpoint.test.ts`, `missionLinear.test.ts`,
`missionsPanel.test.ts`; `tests/e2e/missionLinear.spec.ts` przygotowany do uruchomienia
przez prowadzącego. Stary E2E `missionMaszty.spec.ts` został zastąpiony.
