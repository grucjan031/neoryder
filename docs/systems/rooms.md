# Pokoje runu — F3-03

`src/world/roomSchema.ts` rozszerza istniejący schemat F3-01 o walidację
przestrzenną. `loadRoom(data)` sprawdza strukturę i układ przez zod; błędy
zawierają polski komunikat oraz ścieżkę pola (np. `spawnPoints.0`).
`src/world/rooms.ts` eksportuje `loadRoomDefinitions(data)` i mapę
`roomDefinitions`, ładowaną eager przez `import.meta.glob` z
`src/data/rooms/*.json`. Powtórzone id pokoju powoduje błąd zamiast nadpisania.
Dodanie pokoju wymaga wyłącznie nowego pliku JSON.

## Format i granice

Pokoje i arena przyjmują pola oprawy z `dressingSchema.ts`: `theme`, `signs`,
`lights`, `decals`, `ambientFx`, `decor`. Brak `theme` oznacza `white`, a URL
`?theme=neonStreet` nadpisuje wybór. Wyłącznie identyfikator motywu dopuszcza
camelCase (konieczne dla `neonStreet`); identyfikatory tekstur i modeli nadal
używają małych liter, cyfr i podkreślenia. Błędne kolory i nieznane materiały
są odrzucane. Pozostałe reguły walidacji przestrzennej nie zmieniły się.

Blok może podać `material`: world/concrete/asphalt/metal/facade/trim/glass.
Jawny materiał obowiązuje bryłę zastępczą oraz siatki modelu; bez niego nazwy
materiałów glTF pozostają źródłem stylu. Model `city_*` jest ładowany z
`/assets/models/city/<model>.glb` ze stopami na spodzie bloku. Brak pliku
zostawia bryłę i istniejący collider. `decor` ładuje modele z tej samej bazy,
stosuje `position`, `yaw` w radianach i jednolity `scale`, bez colliderów;
brak pliku pomija dekorację. Ostrzeżenie i nieudany request występują raz na plik.
Szablony GLB i ich geometrie są własnością cache renderu, nie sceny.
`loadModels=false` pomija również dekoracje i modele miejskie, więc RoomScene
działa nadal bez DOM i sieci. `signs/lights/decals/ambientFx` są zachowywane
w danych dla integratora; RoomScene i Arena jeszcze ich nie renderują.

`SceneAtmosphere` przywraca poprzedni motyw i tło przy dispose; parametry deszczu
są dostępne przez `theme.rain` dla modułu VFX. Oprawa nie zmienia symulacji,
osiągalności, spawnu ani przebiegu fal. Scena kontroli: `?scene=neon-test`.

Pola układu `playerSpawn`, `blocks`, `director` odpowiadają arenie. Pokój
dodaje `id`, `name`, `type`, `spawnPoints`, `doors` oraz opcjonalne `maxAlive`,
`minSpawnDistance`, `threatMultiplier`, `props`, `puzzle` oraz `bossEnemy` (tylko
typ boss: id wroga-bossa, włącza tryb bossa w `RoomScene`). Zdrowie dostarcza
stan runu. Dla combat/elite wymagane są co najmniej cztery punkty spawnu.
Każdy pokój ma dokładnie jedne drzwi entry i exit; boss ma tylko entry.
Id drzwi muszą być unikalne w pokoju. Drzwi zajmują przerwy w ścianach;
ich zamykanie i otwieranie realizuje F3-04.

Pole `hazards` (opcjonalne): `electric_field` (`position`, `size`, opcjonalny
`cycle {onS, offS, offsetS?}`), `explosive_barrel` (`position`), `laser_gate`
(`from`, `to`, wymagany `cycle`). Id zagrożeń unikalne. Wszystkie punkty obrysu
zagrożenia (rogi pola, końce lasera, ±0,4 m dla beczki) muszą leżeć na podłodze.
Punkty gracza i spawnów nie mogą leżeć w polu elektrycznym ani w odległości
≤ 1 m od odcinka lasera (dla pola: połowa rozmiaru + 1 m); beczek to nie dotyczy.
Zachowanie zagrożeń: [hazards.md](hazards.md).

## Zagadka z Chwytem (F3-19)

Każdy pokój typu `puzzle` definiuje jeden ruchomy obiekt z pozycją środka,
rozmiarem i masą. `puzzlePlate` zalicza ustawienie skrzyni przy podłodze
w obrębie pierścienia płyty. `puzzleLaser` zalicza przecięcie odcinka
wiązki przez collider osłony. Id bramki wskazuje hazard w tym samym pokoju.
Obiekt jest celem Chwytu. Można go również popchnąć kapsułą gracza podczas
chodzenia, także bez mocy w ekwipunku. Oba cele trzeba utrzymać przez
`tuning.puzzle.confirmS`. Tolerancja wysokości płyty (`plateClearanceM`),
masa pchania (`pushMassKg`) i tłumienie obiektu (`objectDamping`) są w lil-gui
w sekcji `puzzle` i działają na żywo (odczyt co krok symulacji). Czas pokazania
wyniku w runie to `resultHoldS`. Kolory obiektu i płyty pochodzą z materiałów
motywu (`neon_amber` / `neon_green`), bez czerwieni. Walidacja danych odrzuca
obiekt nachodzący na blok układu lub zbyt blisko punktu startu.

Sprawdzenie w 30 sekund:

1. Otwórz `?scene=puzzle-test&debug=1`. Przytrzymaj F na skrzyni, patrz lekko
   w dół i dojdź tak, by skrzynia przez chwilę pozostała nad pierścieniem.
2. Otwórz `?scene=puzzle-test&room=puzzleLaser&loadout=classic&debug=1`.
   Podejdź do osłony od strony wejścia i popchnij ją w poprzek wiązki.
   Sprawdź, czy obiekt reaguje płynnie, a laser gaśnie w chwili przecięcia.
3. W świeżym pokoju naciśnij M (akcja `map`), by pominąć zagadkę.
   Komenda `puzzle status` pokazuje pozycję obiektu, aktywację celu i wynik.

Schemat `arena` (opcjonalny): `points` 3–5 punktów z kolejnymi
id od `A`, `radiusM > 0`; `batchCellM`, `navigationCellM`, `navigationClearanceM`
wymagane; `navigationMaxRiseM`, `navigationHeadroomM` opcjonalne (wymagane przez
nawigację warstwową, gdy są bloki `walkable`); `maxAlive` całkowite
≤ `tuning.modes.conquest.maxAlive` (12); `enemyTickets` całkowite > 0;
`spawnRing {minM, maxM}` z `maxM > minM`; `spawnPoints` ≥ 4 pozycji `{x, y?, z}`;
`water {shoreZ, y, color #rrggbb}`; `exclusive`. Bloki mają też `walkable`
(powierzchnia nawigacji) i `visible` (false = tylko collider).

Podłogą jest blok, którego górna powierzchnia leży na `playerSpawn.y`
(porównanie dokładne, bez tolerancji — wartości liczbowe w JSON muszą się zgadzać bitowo).
Obrysy takich bloków wyznaczają dozwolony obszar XZ bez nowego pola kontraktu.
Bloki wystające ponad tę płaszczyznę i przecinające ją są przeszkodami;
sama podłoga nie blokuje spawnów. Punkty gracza i wrogów muszą leżeć
na podłodze i poza zamkniętymi obrysami przeszkód. Walidacja dotyczy płaskich
układów F3, bez nawigacji wielopiętrowej, skoków ani promienia kapsuły.

## Osiągalność

Flood fill używa komórek 1 × 1 m na globalnej siatce XZ (indeks punktu to
`floor(x), floor(z)`) i czterech sąsiadów, bez przechodzenia po skosie.
Cała komórka musi mieścić się w obrysie jednego bloku podłogi.
Przecięcie wnętrza komórki z przeszkodą blokuje komórkę, również dla cienkich
ścian. Jest to konserwatywny test układu: przejścia i miejsca spawnu należy
projektować z wolną komórką 1 m. Wszystkie punkty spawnu muszą znajdować się
w obszarze osiągalnym od komórki gracza. Drzwi i props nie są przeszkodami
tego testu: drzwi zmieniają stan, props nie określają rozmiaru kolizji.
Walidacja nie używa Three.js, DOM ani losowości.

## Pokoje sektora Kurogane Arms (F3-12)

Pule `roomPools` w `src/data/sectors/kurogane.json`:

| Typ    | Pokoje                                                                                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| combat | `combatCorridor`, `combatPillars`, `combatPlatforms`, `combatRing`, `combatWarehouse`, `combatYard`, `alleyMarket`, `alleyBackstreet`, `alleyCrossing`, `combatSubstation`, `combatLaserYard`, `combatFloodedTunnel` |
| elite  | `alleyUnderpass`, `eliteCourtyard`, `eliteFoundry`, `eliteHall`, `plazaHolo`                                                                                                                                         |
| shop   | `noodleShop`, `shopRoom` (bez spawnów, bez fal)                                                                                                                                                                      |
| rest   | `restRoom`, `rooftopRest` (bez spawnów, bez fal)                                                                                                                                                                     |
| puzzle | `puzzlePlate`, `puzzleLaser` (bez spawnów i fal)                                                                                                                                                                     |
| boss   | `bossRoom` (tylko drzwi entry, 6 spawnów, `bossEnemy: securityChief`, bez fal — F3-17)                                                                                                                               |

Pokoje `combatSubstation`,
`combatLaserYard`, `combatFloodedTunnel` i `eliteChemPlant` mają `hazards`
([hazards.md](hazards.md)). `alleyUnderpassMission` (combat, 8 spawnów,
`electric_field`) nie jest w żadnej puli sektora: id kończące się na `Mission`
wchodzi do losowania tylko w misji (jej `roomPools`) albo jako pokój stały.

### Losowanie pokoju dla węzła (`RunScene.chooseRoom`)

Kolejność reguł (determinizm: wynik zależy tylko od seeda runu i id węzła):

1. Węzeł z `fixed` (mapa misji) bierze pokój `fixed.roomId`; nieznany id to błąd.
2. Pula: `roomPools` misji z `type` zgodnym z węzłem i `fromLayer ≤ warstwa ≤
toLayer` (pierwszy pasujący wpis), inaczej `roomPools[typ]` sektora, inaczej
   wszystkie pokoje tego typu z `roomDefinitions`. Id spoza `roomDefinitions` w puli to błąd.
3. Filtr: odpada `arena.exclusive` oraz (poza misją) id kończące się na `Mission`.
   Jeśli nic nie zostaje, kandydaci to wszystkie pokoje `combat` po tym samym
   filtrze. Węzeł `puzzle` wymaga układu z definicją zagadki.
4. Kandydaci sortowani po `id` (`localeCompare`), potem
   `new Rng(seed runu).fork('room-layout:<nodeId>').pick(kandydaci)` — jedno
   losowanie z osobnego strumienia, więc nie przesuwa innych strumieni.

## Mapy Neon Noir

Pokoje w motywie `neonStreet` (uliczki miasta nocą) dopisane do pul sektora Kurogane Arms.
Podłoga to bloki z górą na y = 0, budynki to wysokie bloki `facade` za krawędzią podłogi,
oprawa (napisy, hologramy, światła, naklejki, efekty, dekoracje) w polach z `dressingSchema.ts`.

| id               | Typ   | Wymiary (użyteczne) | Idea                                                                                                                                                                                          |
| ---------------- | ----- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alleyUnderpass` | elite | 68 × 120 m          | zalana stacja metra: plac z wieżą zegarową, perony i tory w wodzie (−1,4 m), wagon, kładka, hala północna z antresolą (4,5 m); kałuże pod napięciem; rain |
| `eliteChemPlant` | elite | 80 × 110 m          | zakład chemiczny: zbiorniki, estakady rurociągów, kładki serwisowe (3,6 i 7,2 m), toksyczne kałuże i beczki (hazardy); landmark: płuczka smogu 24 m; smog |
| `eliteCourtyard` | elite | 84 × 104 m          | dziedziniec korporacji: kolumnada, holograficzna fontanna, ogrody z żywopłotów, tarasy biurowe (3,6 i 7,2 m); landmark: wieża z ekranem 40 m; clearNight |
| `eliteFoundry`   | elite | 90 × 100 m          | odlewnia: piece z żarem, hałda żużla, kominy, kładki (4,2 i 8,4 m), bramki laserowe i beczki; landmark: kadź z ciepłą poświatą; ashfall |
| `eliteHall`      | elite | 84 × 112 m          | hala dworca zimą: hala kas pod dźwigarami, antresola (4,8 m), perony i tory w rowach (−1,2 m) z wagonami maglev; landmark: wieża zegarowa; snow |
| `plazaHolo`      | elite | 84 × 100 m          | plac reklam: projektory holo, trybuny amfiteatru (2,4 i 4,8 m) z rampami, pawilony, ściana ekranów; landmark: ściana ekranów 24 m; clearNight |
| `noodleShop`     | shop  | 10 × 14 m           | spokojna uliczka z budką `city_stall` (terminal sklepu), ciepłe światła i lampiony, napisy ramen/noodles/bar_mleczny, hologram makaronu; bez spawnów i fal                                    |
| `rooftopRest`    | rest  | 14 × 14 m           | dach z murkami 0,8 m i szklanymi osłonami, antena, generator, widok na panoramę miasta i hologramy na sąsiednich budynkach; bez spawnów i fal                                                 |

Scena kontroli: `?scene=room-test&room=<id>` (pokoje shop/rest nie mają spawnów, więc
`room-test` wymaga do nich tymczasowej kopii z jednym spawnem).

## Dane i sprawdzenie

`combatYard` i `combatPillars` (pierwsze pokoje F3; `combatYard` jest dziś areną runu, a testy loadera używają jego dawnej wersji z `tests/unit/fixtures/legacyYard.json`) miały podłogi 24 × 24 m, pięć punktów spawnu,
wejście od południa i wyjście na północ. Dziedziniec ma asymetryczne osłony
i dwa filary, hala cztery filary i osłony przy bocznych trasach.
Liczby limitów i odległości spawnu oraz geometria są w JSON.

`tests/unit/rooms.test.ts` sprawdza dane, glob, granice, kolizje, cienkie ściany,
narożniki, przesunięte układy, drzwi i duplikaty id oraz że glob ładuje
wszystkie pliki katalogu, a pule sektora wskazują istniejące pokoje właściwego
typu i pokrywają typy węzłów mapy. Istniejące testy areny
sprawdzają jej niezmieniony stary schemat. Scena `?scene=room-test&room=<id>`
jest zakresem F3-04; ten moduł dostarcza jej zwalidowane dane.
Do późniejszego playtestu: wejście i wyjście mają być widoczne, osłony powinny
zostawiać czytelne trasy boczne, a wszystkie spawny znajdować się poza geometrią.

## Mapy w motywie neonStreet

| id                | typ    | wymiary                       | idea                                                                                                  |
| ----------------- | ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `alleyMarket`     | combat | 84 × 76 m                     | nocny targ pod estakadą (pokład na 10 m, filary), stragany jako niskie osłony, pasarela na 4 m z rampami, lampiony; rain |
| `alleyBackstreet` | combat | 68 × 88 m                     | zaplecza knajp: zaułki, garaże z dachami (3,2 m) i taras (6,4 m) połączone rampami, wieża z szyldem makaronu; rain |
| `alleyCrossing`   | combat | 88 × 80 m                     | skrzyżowanie: plac z kioskami i wrakami, hologram na maszcie, zejście do przejścia podziemnego (−3,2 m), taras kawiarni (3,4 m); drizzleWind |
| `combatSubstation` | combat | 80 × 88 m                    | podstacja: pola transformatorów, łuki elektryczne (hazard), estakada kablowa i dachy rozdzielni (4 m); landmark: pylon HV 30 m; rain |
| `combatWarehouse` | combat | 80 × 90 m                     | automatyczny magazyn: regały z alejkami, ładownia pod suwnicą (cele M03 w (0, 0) i (0, −10)), stosy kontenerów, antresola (4 m); smog |
| `combatYard`      | combat | 90 × 80 m                     | złomowisko: hałdy wraków, prasa, dwie hałdy-szczyty (3,2 i 4,8 m), dźwig złomowy; cele M01 w (0, 0) i (10, 0); ashfall |

Pokoje `alleyBackstreet`, `alleyCrossing`, `alleyMarket`, `alleyUnderpass` oraz (partia C) `combatSubstation`, `combatWarehouse`, `combatYard`, `eliteChemPlant`, `eliteCourtyard`, `eliteFoundry`, `eliteHall` i `plazaHolo` (tabele wyżej)
zostały przebudowane na większe areny runu (70–130 m, ≥ 3 500 m², 3–5 stref, ≥ 2 poziomy
połączone rampami, ≥ 10 spawnów, odrębna pogoda i landmark); id, typ, drzwi i dyrektor
są bez zmian, `maxAlive` combat 9–10 / elite 11–12. Powstają z generatorów
`tools/arenas/run/<id>.mjs` i profilu `run` ([arena-generators.md](arena-generators.md)).
Pozostałe pokoje runu (partia B) są przebudowywane według `briefs/areny.md`.

## Opcjonalna pogoda i metadane areny

Pokój może wskazać `weather: <id>`; brak zachowuje pogodę motywu. `arena` zawiera
punkty przejęcia, opcjonalne odrębne spawny trybu, wielkość komórek scalania
i nawigacji oraz margines przejścia. `arena.exclusive` rezerwuje port dla trybów
areny, wykluczając go ze zwykłych pul. CombatRing nie jest wyłączany ze zwykłego
runu, a jego zwykłe spawny, geometria i oprawa nie zostały zmienione.
Opcjonalne `blocks[].rotation` (radiany XYZ) obraca render i statyczny collider;
`blocks[].instance` pozwala grupować powtarzalne bryły portu.
Szczegóły: [arenas.md](arenas.md), [weather.md](weather.md).

## Audyt danych i oględziny

`node tools/levels/mapAudit.mjs` podaje liczbę znalezisk dla każdej mapy. Po podaniu id wypisuje ścieżki JSON i współrzędne. Opcja `--json` zwraca pełne wyniki, a `--report` odświeża tabele i listy w raporcie. Test jednostkowy sprawdza osobny limit błędów dla każdej mapy w `tests/unit/mapAudit.baseline.json`. Po usunięciu błędów należy obniżyć odpowiedni limit.

`node tools/screens/mapAudit.mjs bossRoom --tag before` uruchamia serwer i zapisuje dziesięć ujęć PNG. Użycie `--tag after` zapisuje drugą serię w sąsiednim katalogu. Scena audytu korzysta z renderu gry, zatrzymanej symulacji i osobnego zapisu w pamięci. Metodę pomiaru modeli, progi i ręcznie sprawdzone przykłady opisuje [raport audytu](../audits/mapAudit-report.md).
