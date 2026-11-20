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
| boss   | `bossRoom` (tylko drzwi entry, 6 spawnów, `bossEnemy: securityChief`, bez fal — F3-17)                                                                                                                               |

Puzzle nie ma pokoi (`typeWeights.puzzle` = 0). Pokoje `combatSubstation`,
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
   Jeśli nic nie zostaje, kandydaci to wszystkie pokoje `combat` po tym samym filtrze.
4. Kandydaci sortowani po `id` (`localeCompare`), potem
   `new Rng(seed runu).fork('room-layout:<nodeId>').pick(kandydaci)` — jedno
   losowanie z osobnego strumienia, więc nie przesuwa innych strumieni.

## Mapy Neon Noir

Pokoje w motywie `neonStreet` (uliczki miasta nocą) dopisane do pul sektora Kurogane Arms.
Podłoga to bloki z górą na y = 0, budynki to wysokie bloki `facade` za krawędzią podłogi,
oprawa (napisy, hologramy, światła, naklejki, efekty, dekoracje) w polach z `dressingSchema.ts`.

| id               | Typ   | Wymiary (użyteczne) | Idea                                                                                                                                                                                          |
| ---------------- | ----- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alleyUnderpass` | elite | 16 × 34 m           | przejście pod estakadą: 8 filarów betonowych 1,5 × 1,5 m jako osłony, estakada ~7 m nad środkiem, neony na filarach, kapanie z estakady, automaty, barierki i samochód jako osłony            |
| `plazaHolo`      | elite | 26 × 26 m           | plac z centralnym hologramem koi nad cokołem z projektorem; barierki, automaty, samochody i skrzynie wokół, hologramy android/drink na fasadach, wejście i wyjście po przeciwległych stronach |
| `noodleShop`     | shop  | 10 × 14 m           | spokojna uliczka z budką `city_stall` (terminal sklepu), ciepłe światła i lampiony, napisy ramen/noodles/bar_mleczny, hologram makaronu; bez spawnów i fal                                    |
| `rooftopRest`    | rest  | 14 × 14 m           | dach z murkami 0,8 m i szklanymi osłonami, antena, generator, widok na panoramę miasta i hologramy na sąsiednich budynkach; bez spawnów i fal                                                 |

Scena kontroli: `?scene=room-test&room=<id>` (pokoje shop/rest nie mają spawnów, więc
`room-test` wymaga do nich tymczasowej kopii z jednym spawnem).

## Dane i sprawdzenie

`combatYard` i `combatPillars` (pierwsze pokoje F3) mają podłogi 24 × 24 m, pięć punktów spawnu,
wejście od południa i wyjście na północ. Dziedziniec ma asymetryczne osłony
i dwa filary, hala cztery filary i osłony przy bocznych trasach.
Liczby limitów i odległości spawnu oraz geometria są w JSON.

`tests/unit/rooms.test.ts` sprawdza dane, glob, granice, kolizje, cienkie ściany,
narożniki, przesunięte układy, drzwi i duplikaty id oraz że glob ładuje
wszystkie pliki katalogu, a pule sektora wskazują istniejące pokoje właściwego
typu i pokrywają typy węzłów mapy (poza puzzle). Istniejące testy areny
sprawdzają jej niezmieniony stary schemat. Scena `?scene=room-test&room=<id>`
jest zakresem F3-04; ten moduł dostarcza jej zwalidowane dane.
Do późniejszego playtestu: wejście i wyjście mają być widoczne, osłony powinny
zostawiać czytelne trasy boczne, a wszystkie spawny znajdować się poza geometrią.

## Mapy w motywie neonStreet

| id                | typ    | wymiary                       | idea                                                                                                  |
| ----------------- | ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `alleyMarket`     | combat | 14 × 40 m                     | nocny targ: stragany po obu stronach jako osłony, lampiony nad głową, neony ramen/sake, para z kratek |
| `alleyBackstreet` | combat | wąski zaułek 6–9 m, kształt Z | zaplecza: kontenery, generator, skrzynie, schody ppoż., iskry i kapanie, migające neony               |
| `alleyCrossing`   | combat | ok. 36 × 36 m, plus           | skrzyżowanie: zaparkowane auta i barierki, latarnie, hologram Kurogane na narożniku                   |

## Opcjonalna pogoda i metadane areny

Pokój może wskazać `weather: <id>`; brak zachowuje pogodę motywu. `arena` zawiera
punkty przejęcia, opcjonalne odrębne spawny trybu, wielkość komórek scalania
i nawigacji oraz margines przejścia. `arena.exclusive` rezerwuje port dla trybów
areny, wykluczając go ze zwykłych pul. CombatRing nie jest wyłączany ze zwykłego
runu, a jego zwykłe spawny, geometria i oprawa nie zostały zmienione.
Opcjonalne `blocks[].rotation` (radiany XYZ) obraca render i statyczny collider;
`blocks[].instance` pozwala grupować powtarzalne bryły portu.
Szczegóły: [arenas.md](arenas.md), [weather.md](weather.md).
