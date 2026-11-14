# Pokoje runu — F3-03

`src/world/roomSchema.ts` rozszerza istniejący schemat F3-01 o walidację
przestrzenną. `loadRoom(data)` sprawdza strukturę i układ przez zod; błędy
zawierają polski komunikat oraz ścieżkę pola (np. `spawnPoints.0`).
`src/world/rooms.ts` eksportuje `loadRoomDefinitions(data)` i mapę
`roomDefinitions`, ładowaną eager przez `import.meta.glob` z
`src/data/rooms/*.json`. Powtórzone id pokoju powoduje błąd zamiast nadpisania.
Dodanie pokoju wymaga wyłącznie nowego pliku JSON.

## Format i granice

Pola układu `playerSpawn`, `blocks`, `director` odpowiadają arenie. Pokój
dodaje `id`, `name`, `type`, `spawnPoints`, `doors` oraz opcjonalne `maxAlive`,
`minSpawnDistance`, `threatMultiplier`, `props` i `puzzle`. Zdrowie dostarcza
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

## Dane i sprawdzenie

`combatYard` i `combatPillars` mają podłogi 24 × 24 m, pięć punktów spawnu,
wejście od południa i wyjście na północ. Dziedziniec ma asymetryczne osłony
i dwa filary, hala cztery filary i osłony przy bocznych trasach.
Liczby limitów i odległości spawnu oraz geometria są w JSON.

`tests/unit/rooms.test.ts` sprawdza dane, glob, granice, kolizje, cienkie ściany,
narożniki, przesunięte układy, drzwi i duplikaty id. Istniejące testy areny
sprawdzają jej niezmieniony stary schemat. Scena `?scene=room-test&room=<id>`
jest zakresem F3-04; ten moduł dostarcza jej zwalidowane dane.
Do późniejszego playtestu: wejście i wyjście mają być widoczne, osłony powinny
zostawiać czytelne trasy boczne, a wszystkie spawny znajdować się poza geometrią.
