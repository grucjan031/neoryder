# Windy pokojowe

Winda pionowa łącząca kondygnacje pokoju: kinematyczna kabina w świecie Rapiera, drzwi szybowe i kabinowe blokujące pusty szyb, panele wezwania oraz wyboru kierunku obsługiwane z widoku FPP, a także integracja z siatką nawigacji powierzchni i AI wrogów.

Kontrakt: `docs/api.md`, sekcja „Windy pokojowe”. Kod: `src/world/elevatorSchema.ts`, `src/world/elevator.ts`, `src/world/elevatorCabin.ts`, `src/world/elevatorRoutes.ts`, `src/world/elevatorPassengers.ts`, `src/physics/platformMotion.ts`, `src/render/elevatorView.ts`, integracja w `src/scenes/roomScene.ts`.

## Jak sprawdzić w 30 sekund

`?scene=elevator-test&debug=1` — trzykondygnacyjny pokój biurowca (`0 m`, `4,8 m`, `9,6 m`) z szybem windy na środku i bocznym ciągiem ramp/schodów (`src/data/scenes/elevatorTest.json`).

1. Na starcie stoisz na parterze przed szybem, a fala wrogów pojawia się na piętrze `4,8 m`. Wrogowie podchodzą do drzwi, wzywają kabinę, wsiadają (maksymalnie dwóch naraz) i zjeżdżają na parter.
2. Podejdź do bursztynowego przycisku przy drzwiach (`≤ 1,6 m`), wyceluj w niego — przycisk rozjaśni się, a HUD pokaże `[{power2}] Wezwij windę`. Naciśnij klawisz interakcji (`E`), aby otworzyć drzwi lub wezwać kabinę.
3. Wejdź do kabiny, spójrz na wewnętrzny panel w narożniku (`Winda · GÓRA` / `Winda · DÓŁ`) i wybierz `GÓRA` — drzwi zamkną się po zwolnieniu progu, a kabina płynnie wjedzie piętro wyżej.
4. W konsoli debug (`~`) wywołaj `elevator call biuro 2` — kabina przyjmie żądanie jazdy na najwyższą kondygnację (`9,6 m`).

| Komenda / zapytanie                 | Efekt                                                                 |
| ----------------------------------- | --------------------------------------------------------------------- |
| `elevator call <id> <piętro od 0>`  | dodaje przystanek do kolejki wskazanej windy                          |
| `query('elevators')`                | zwraca tablicę serializowalnych stanów kabin (`id`, `phase`, `y`, …)  |

## Format danych — `RoomDefinition.elevators`

Opcjonalne pole `elevators` w danych pokoju (`src/world/roomSchema.ts`, schemat `elevatorSchema` w `src/world/elevatorSchema.ts`):

```json
"elevators": [
  {
    "id": "biuro",
    "x": 0,
    "z": 0,
    "width": 2.4,
    "depth": 2.4,
    "startStop": 0,
    "model": "city_elevator_car",
    "stops": [
      { "y": 0, "doorSide": "s" },
      { "y": 4.8, "doorSide": "s" },
      { "y": 9.6, "doorSide": "s" }
    ]
  }
]
```

| Pole                 | Znaczenie                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `id`                 | unikalny identyfikator windy w pokoju                                                                                 |
| `x`, `z`             | środek szybu w płaszczyźnie XZ (metry)                                                                                |
| `width`, `depth`     | wymiary zewnętrzne kabiny i szybu w osiach X i Z (`> 0`)                                                              |
| `stops`              | lista przystanków (co najmniej 2), uporządkowana ściśle rosnąco po wysokości stóp `y`                                 |
| `stops[i].doorSide`  | strona otwarcia drzwi na danym przystanku: `'n' \| 's' \| 'e' \| 'w'` (akceptowane także `'N' \| 'S' \| 'E' \| 'W'`)   |
| `startStop`          | indeks przystanku początkowego (`0 .. stops.length - 1`)                                                              |
| `model`              | opcjonalny identyfikator modelu glTF kabiny (`^[a-z0-9_]+$`)                                                          |

**Walidacja układu (`validateElevators` wywoływane z `validateLayout`):**

- identyfikatory `id` w tablicy `elevators` nie mogą się powtarzać;
- pełna objętość szybu od spodu płyty podłogowej najniższego przystanku (`stops[0].y - slab`) do wierzchu stropu na najwyższym przystanku (`stops.at(-1).y + cabinHeight + slab`) nie może przecinać żadnego bloku pokoju ani innego szybu;
- tuż za progiem każdego przystanku (`facePoint`) musi znajdować się poziomy blok z `walkable: true`, którego górna powierzchnia leży na wysokości `stop.y`.

## Maszyna stanów i fizyka — `src/world/elevator.ts`, `src/world/elevatorCabin.ts`

Klasa `Elevator` implementuje czystą, w pełni serializowalną maszynę stanów bez referencji do Three.js ani DOM:

```
idle ──żądanie na innym piętrze──▶ moving ──dojazd do przystanku──▶ doorsOpening
 │                                                                      │
 └──żądanie na bieżącym piętrze─────────────────────────────────────────┤
                                                                        ▼
idle ◀──drzwi zamknięte (door = 0)── doorsClosing ◀──koniec postoju── open
                                         │                              ▲
                                         └──próg zajęty / wezwanie──────┘
```

- **Kolejka i wybór celu:** `request(stop)` odrzuca nieistniejące indeksy i duplikaty. Gdy kabina stoi z zamkniętymi drzwiami na żądanym piętrze, od razu otwiera drzwi. W ruchu (`moving`) kabina utrzymuje bieżący kierunek (`direction`), obsługuje przystanki po drodze, jeśli pozostały dystans pozwala wyhamować z przyspieszeniem `elevatorAccelMps2`, a po wyczerpaniu żądań w danym kierunku odwraca zwrot.
- **Kinematyka:** prędkość rośnie z przyspieszeniem `elevatorAccelMps2` do `elevatorSpeedMps` i maleje przed przystankiem docelowym zgodnie z analityczną krzywą hamowania.
- **Drzwi i blokada szybu (`ElevatorCabin`):** kabina jest kinematycznym ciałem pozycyjnym Rapiera (`RigidBodyDesc.kinematicPositionBased()`) z podłogą, sufitem i ścianami. Szyb otaczają stałe kolidery ścian oraz drzwi szybowych na każdym przystanku. Kolider drzwi kabiny i drzwi szybowych danego przystanku jest wyłączany, gdy rozsunięcie drzwi na tym przystanku osiągnie `elevatorDoorPassFraction` — przejście jest wolne wtedy, gdy na oko już widać prześwit, a do pustego szybu nadal nie da się wpaść (drzwi otwierają się tylko przy stojącej kabinie).
- **Pasażer w kabinie (`holdOpen`):** dopóki gracz stoi w obrysie kabiny i kolejka wezwań jest pusta, drzwi nie zamykają się po postoju, a zamknięte drzwi stojącej kabiny same się otwierają. Wezwanie z panelu lub z innego piętra zamyka drzwi i rusza kabinę. Dzięki temu gracza nie da się zamknąć w kabinie bez przycisku otwierania.
- **Pauza i hitstop:** przy kroku z `dt = 0` scena woła `cabin.hold()`, więc interpolacja widoku kabiny i drzwi stoi w miejscu razem z graczem.
- **Fotokomórka:** gdy gracz lub żywy wróg stoi w progu (`inDoorway`) albo wróg jest w fazie wsiadania (`boardingAt`), stan `open` nie przechodzi do zamykania, a stan `doorsClosing` cofa się do `doorsOpening`.
- **Przenoszenie pasażerów (`src/physics/platformMotion.ts`):** w stałym kroku `step()` scena najpierw aktualizuje kabiny (`previousY` → `state.y`), a następnie `PlayerController` i `EnemyBody` wykrywają podparcie na podłodze kabiny (`supportingPlatform`), wykluczają jej kolider z pionowego zapytania KCC i ustawiają wysokość stóp dokładnie na nowej pozycji podłogi z marginesem `platformSkinM`. Zapobiega to drganiom, odrywaniu stóp przy zjeździe i podwójnemu dodaniu prędkości kinematycznej przez Rapiera. Kontroler zapisuje w `PlayerState.platformDy` pionowe przesunięcie z jazdy, a filtr schodów kamery (`FpsCamera.updateSteps`) odejmuje je od skoku stóp — bez tego każdy krok jazdy był traktowany jak stopień i obraz skakał.
- **Zdarzenia `EventBus`:**
  - `elevatorCalled: { id, stop }` — przyjęcie nowego żądania;
  - `elevatorDeparted: { id, from, to }` — start jazdy między przystankami (`sfx.json` → `elevatorMotor`);
  - `elevatorArrived: { id, stop }` — zatrzymanie na przystanku (`sfx.json` → `elevatorBell`);
  - `elevatorDoors: { id, stop, opening }` — rozpoczęcie otwierania lub zamykania drzwi.

## Panele, HUD i render — `src/render/elevatorView.ts`, `src/ui/hud.ts`

- Na każdym przystanku obok ościeżnicy znajduje się zewnętrzny przycisk wezwania (`action: 'call'`), a wewnątrz kabiny w narożniku — dwa przyciski kierunku (`action: 'up'` oraz `action: 'down'`, zmieniające piętro o `+1` / `-1`).
- Wezwanie z podestu ma powiększone pole trafienia (`ElevatorButton.reach`): cały portal drzwi i pas po bokach, więc działa także panel ustawiony przez mapę obok ościeżnicy. Podpowiedź znika, gdy kabina stoi na tym piętrze z otwartymi drzwiami.
- **Zestaw modeli:** dla `model: "<prefiks>_elevator_cab"` widok sam wstawia na każdym przystanku portal `<prefiks>_elevator_shaft_door` z ruchomymi skrzydłami `door_left` / `door_right` oraz panel `<prefiks>_elevator_call_panel` (chyba że mapa ma już własny panel obok). Statyczny portal o tej nazwie wpisany w `decor` mapy na przystanku jest pomijany przy ładowaniu (`isElevatorPortalDecor`), bo jego zamknięte skrzydła zasłaniały otwarte przejście.
- W `RoomScene.focusElevator` promień z kamery gracza ograniczony do `elevatorPanelReachM` (i zasłonięć ścianami) testuje trafienie w AABB przycisków (`hitButton`). Zewnętrzne przyciski działają tylko spoza obrysu kabiny, a wewnętrzne — tylko z jej wnętrza, gdy kabina nie jest w ruchu i istnieje sąsiedni przystanek w danym kierunku.
- Naciśnięcie klawisza interakcji (`power2`, domyślnie `E`) podczas celowania w aktywny przycisk wywołuje `request(target)` i przechwytuje klawisz przed użyciem mocy.
- HUD wyświetla podpowiedź z `src/data/ui/hud.pl.json`: `Wezwij windę`, `Winda · GÓRA` lub `Winda · DÓŁ`.
- `ElevatorView` interpoluje w `render(alpha)` wysokość kabiny (`previousY` → `state.y`) oraz rozsunięcie teleskopowych skrzydeł drzwi (`previousDoor` → `state.door`). Zgodnie z paletą Neon Noir (ADR 0006) używane są wyłącznie chłodne szarości konstrukcji i szkła (`#444853`, `#7d8caa`, `#737788`) oraz bursztynowe/ciepłobiałe podświetlenie przycisków (`#ffb548`, `#fff1d1`, `#57514a`) — bez zarezerwowanej czerwieni, cyanu i magenty.

## Tuning — `tuning.elevator`

Wszystkie parametry są w `src/core/tuning.ts` i można je stroić na żywo w panelu `lil-gui`:

| Parametr              | Domyślnie | Znaczenie                                                                 |
| --------------------- | --------- | ------------------------------------------------------------------------- |
| `elevatorSpeedMps`    | `2.5`     | maksymalna prędkość pionowa kabiny (m/s)                                  |
| `elevatorAccelMps2`   | `3.5`     | przyspieszenie i opóźnienie hamowania kabiny (m/s²)                       |
| `elevatorDoorOpenS`   | `0.55`    | czas pełnego otwarcia i zamknięcia drzwi (s)                              |
| `elevatorDoorDwellS`  | `2.5`     | czas postoju otwartych drzwi przed zamknięciem (s)                        |
| `elevatorDoorPassFraction` | `0.7` | rozsunięcie drzwi (0..1), od którego przestają blokować przejście         |
| `elevatorPanelReachM` | `1.6`     | maksymalny zasięg interakcji gracza z przyciskiem panelu (m)              |
| `maxEnemies`          | `2`       | maksymalna liczba wrogów mogących jednocześnie zajmować sloty w kabinie   |
| `waitTimeoutS`        | `12`      | limit oczekiwania wroga na wejście lub wyjście przed odejściem na schody  |
| `landingOffsetM`      | `0.85`    | odległość punktu oczekiwania/wyjścia na podeście od płaszczyzny drzwi (m) |
| `boardingToleranceM`  | `0.24`    | tolerancja osiągnięcia punktu wejścia, slotu w kabinie i wyjścia (m)      |
| `navCellM`            | `0.5`     | rozmiar komórki siatki nawigacji powierzchni w pokojach z windą (m)       |
| `navWalkMps`          | `3`       | prędkość marszu przy szacowaniu kosztu trasy i ruchu po punktach windy    |

## Nawigacja i AI wrogów — `src/world/elevatorRoutes.ts`, `src/world/elevatorPassengers.ts`

1. **Graf połączeń (`ElevatorRoutes`):** `ArenaSurfaceNavigation` wyznacza komórki siatki dla podestów wszystkich przystanków (`facePoint` w odległości `landingOffsetM`). Metoda `rides(start, goal)` uruchamia algorytm Dijkstry na grafie podestów, porównując czas dojścia pieszego (`walkSeconds` z pola odległości siatki) z kosztem przejazdu windą (`elevatorDoorDwellS + 2 * elevatorDoorOpenS + |Δy| / elevatorSpeedMps`). Jeśli trasa przez windę jest szybsza niż schody, zwraca listę krawędzi `ElevatorEdge` (`kind: 'elevator'`, `id`, `from`, `to`, `entry`, `exit`, `seconds`).
2. **Obsługa pasażerów (`ElevatorPassengers`):** dla każdego wroga podążającego między piętrami utrzymywany jest przebieg podróży:
   - `approach` — marsz po siatce nawigacji do punktu podestu `entry`;
   - `wait` — oczekiwanie przed drzwiami i wezwanie windy (`cabin.request(from)`), dopóki w kabinie jest wolny slot (`< maxEnemies`) i drzwi nie otworzą się na przystanku wejścia;
   - `board` — zajęcie przydzielonego slotu wewnątrz kabiny (rozstawionego wzdłuż szerokości/głębokości kabiny z dala od progu) i zgłoszenie przystanku docelowego `cabin.request(to)`;
   - `ride` — jazda w slocie do otwarcia drzwi na przystanku `to`;
   - `exit` — wyjście na podest docelowy i powrót do zwykłej nawigacji;
   - `retreat` / `stairs` — po przekroczeniu `waitTimeoutS` podczas czekania, wsiadania lub wysiadania wróg zwalnia slot, wycofuje się na podest i przechodzi na trasę pieszą po schodach/rampach aż do osiągnięcia wysokości celu.

## Testy

- `tests/unit/elevator.test.ts` — kolejka i zbieranie wezwań po drodze, fotokomórka i zamykanie drzwi przed odjazdem, walidacja schematu `zod` i układu (`validateLayout`, w tym wielkie litery `doorSide`), porównanie kosztu jazdy windą ze schodami w `ArenaNavigation`, przenoszenie kapsuły gracza w Rapierze, zjazd wrogów z piętra w `ElevatorTest`, blokada szybu przez kolidery drzwi, celowanie w przyciski panelu oraz limit `maxEnemies` i timeout na schody w `ElevatorPassengers`.
- `tests/unit/elevatorExit.test.ts` — gracz w pełnej scenie pokoju (`run4`, `run7`) dojeżdża na każdy przystanek i wychodzi przez otwarte drzwi na podest.
- `tests/unit/fpsCamera.test.ts` — jazda windą nie uruchamia filtra schodów kamery.
- `tests/e2e/elevator.spec.ts` — uruchomienie `?scene=elevator-test&debug=1`, sprawdzenie komendy `elevator call` i zapytania `query('elevators')` bez błędów konsoli.
