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

Podłogą jest blok, którego górna powierzchnia leży na `playerSpawn.y`.
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

| Typ    | Pokoje                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| combat | `combatCorridor`, `combatPillars`, `combatPlatforms`, `combatRing`, `combatWarehouse`, `combatYard`, `alleyMarket`, `alleyBackstreet`, `alleyCrossing` |
| elite  | `eliteCourtyard`, `eliteFoundry`, `eliteHall`                                                                                                          |
| shop   | `shopRoom` (bez spawnów, bez fal)                                                                                                                      |
| rest   | `restRoom` (bez spawnów, bez fal)                                                                                                                      |
| boss   | `bossRoom` (tylko drzwi entry, 6 spawnów, `bossEnemy: securityChief`, bez fal — F3-17)                                                                 |

Puzzle nie ma pokoi (`typeWeights.puzzle` = 0). Pokój losowany jest z puli
osobnym strumieniem `room-layout:<nodeId>`.

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
