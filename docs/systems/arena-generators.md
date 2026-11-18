# Generatory aren — ADR 0011 / D5

`tools/arenas/` to narzędzie autorów map: czysty Node ESM, bez nowych zależności.
Nie jest częścią pętli gry. Generator eksportuje `default function generate()`,
która zwraca budowniczego. Zapisany JSON wykorzystuje istniejący `roomSchema`.
Deklaracje `.d.mts` umożliwiają użycie biblioteki w testach TypeScript.

## Budowniczy

```js
import { createArena, vec } from './lib/arena.mjs';
import { createPrimitives } from './lib/prims.mjs';

export default function generate() {
  const arena = createArena({
    id: 'arenaExample',
    name: 'Przykładowa arena',
    theme: 'neonStreet',
    weather: 'storm',
    seed: 'example-v1',
    bounds: { minX: 0, maxX: 340, minZ: 0, maxZ: 220 },
  });
  const p = createPrimitives(arena);
  // Podziel grunt na połączone prostokąty; pozostaw wcięcia i otwory wykopów.
  p.floor({ minX: 0, maxX: 340, minZ: 0, maxZ: 160 }, 0, 'asphalt');
  p.floor({ minX: 0, maxX: 220, minZ: 160, maxZ: 220 }, 0, 'paving');
  arena.roomMeta({ playerSpawn: vec(5, 0, 5), maxAlive: 12 });
  arena.point('A', vec(50, 0, 50), 4);
  arena.point('B', vec(180, 0, 80), 4);
  arena.point('C', vec(300, 0, 100), 4);
  // Dodaj ≥16 spawnów, 4–6 różnych stref i połączenia ≥3 poziomów.
  // Ten skrót nie stanowi kompletnej areny i celowo nie przejdzie check.
  return arena;
}
```

Jednostki: metry i radiany. `vec(x, y = 0, z = 0)` tworzy pozycję XYZ.
`Rect` zawsze ma `{ minX, maxX, minZ, maxZ }`, nie środek i wymiary.
`bounds` opisuje teren gry, nie całą oprawę za granicą.

| Metoda / pole                                                                           | Znaczenie                                                                                                                              |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `block({size, position, material?, rotation?, model?, instance?, walkable?, visible?})` | Dodaje collider i bryłę w formacie pokoju; pełne wymiary, środek bryły. Zwraca dodany blok.                                            |
| `decor(model, position, rotationY = 0, {scale?})`                                       | Model bez kolizji, zapisywany z polem `yaw`; pozycja przy podstawie modelu.                                                            |
| `light(position, color?, intensity?, range?, {flicker?})`                               | Światło; domyślnie ciepła biel, intensywność 30, zasięg 15 m.                                                                          |
| `spawn(position)`                                                                       | Dodaje zwykły spawn XZ. Inna wysokość niż start gracza powoduje błąd.                                                                  |
| `point(id, position, radiusM = 4)`                                                      | Dodaje unikalny punkt A–E, zgodnie z aktualnym schematem silnika dużych map.                                                           |
| `zone(name, rect, kind)`                                                                | Metadane raportu i SVG; `open`, `dense`, `interior`, `high`, `low`.                                                                    |
| `arenaMeta(obj)`                                                                        | Scala pola `arena`, np. parametry nawigacji i osobną pulę `spawnPoints`.                                                               |
| `roomMeta(obj)`                                                                         | Ustawia np. `playerSpawn`, `doors`, `hazards`, `rainShelters`, `maxAlive`, oprawę. Nie nadpisuje id, geometrii, arena ani spawnPoints. |
| `rng()`                                                                                 | Deterministyczny PRNG [0,1), FNV-1a + mulberry32, zależny od seeda i kolejności wywołań.                                               |
| `metadata`                                                                              | `{seed, bounds, zones, warnings}`; nie trafia do JSON-u gry.                                                                           |
| `warn(code, message)`                                                                   | Dodaje ostrzeżenie narzędzia.                                                                                                          |
| `toRoom()`                                                                              | Zwraca niezależną kopię danych, z posortowanymi kluczami; nie wykonuje walidacji zod.                                                  |
| `write(path)`                                                                           | Tworzy katalogi i zapisuje UTF-8, 2 spacje, LF, końcowy LF, stabilną kolejność kluczy.                                                 |

Domyślne metadane areny: `exclusive: true`, `batchCellM: 20`,
`navigationCellM: 1`, `navigationMaxRiseM: 0.35`, `navigationHeadroomM: 2`,
`navigationClearanceM: 0.8`. Start domyślnie 4 m od minimum X/Z, y=0.
Domyślne drzwi entry/exit są wpisami kontraktu pokoju przy rogach granic;
autor musi ustawić ich rzeczywiste pozycje przez `roomMeta({doors: [...]})`.
Budowniczy nie tworzy automatycznej podłogi ani granic.

## Prymitywy

Można używać `const p = createPrimitives(arena); p.floor(...)` albo nazwanych
eksportów `floor(arena, ...)`. Każdy wynik zawiera `blocks` lub `placements`;
podłogi dodatkowo `rect/y`, rampy `from/to/run/rise/angle`, schody
`count/stepRise/stepDepth`. Wymiary opisują geometrię, nie gabaryty kapsuły.

| Wywołanie                                                                                                                                            | Zachowanie                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `floor(rect, y, material, {thickness = 0.4, walkable = true, visible?})`                                                                             | Górna płaszczyzna dokładnie na y. Duże podłogi warto dzielić na komórki.                                                                                                                                                                                                 |
| `wall(from, to, height, thickness, material, {openings})`                                                                                            | Podstawa pozioma. `openings: [{at, width, height, bottom = 0}]`; `at` w metrach od from, środek otworu. Zachowuje nadproże i pasy pod oknami. Otwory mogą na siebie nachodzić. Ściany osiowe nie mają zbędnego obrotu.                                                   |
| `building({rect, height, floors = 1, wallMaterial, roofMaterial, doors, windows, interior, stairs, y = 0, roofAccessible = false, thickness = 0.4})` | Skorupa z płaskim dachem. `interior: true` dodaje podłogę i stropy co `height/floors`. Dach jest chodzony wyłącznie przy `roofAccessible`.                                                                                                                               |
| `hall({rect, height, mezzanine: {side, depth, y}, doors, roofTrussModel?, y?, wallMaterial?})`                                                       | Hala z otwartym wnętrzem, antresolą i schodami. Antresola przy dowolnej z czterech ścian; północ/południe mają otwór w płycie. Kratownice dekoracyjne co 8 m, bez colliderów.                                                                                            |
| `ramp({from, to, width, material, thickness = 0.4})`                                                                                                 | from/to leżą na górnej powierzchni, nie osi bryły. Długość i obrót z różnicy XYZ; uwzględnia odsunięcie środka o pół grubości wzdłuż normalnej.                                                                                                                          |
| `stairs({from, to, width, stepRise = 0.2, stepDepth = 0.4, material})`                                                                               | Działa w obu kierunkach i przy opadaniu. Liczba stopni = ceil(wznios/stepRise), rzeczywisty wznios dzielony równo; stepDepth to minimalna głębokość. Zbyt krótki bieg jest błędem. Pierwszy stopień wystaje o jeden wznios nad from, ostatni kończy się dokładnie na to. |
| `bridge({from, to, width, y, railings = true, material, thickness = 0.3})`                                                                           | Pozioma płyta i osobne balustrady poza szerokością przejścia; otwarte końce. y określa górę płyty.                                                                                                                                                                       |
| `containerStack({position, rotationY, layers, length: 20\|40, palette})`                                                                             | ISO: 6,058 / 12,192 × 2,591 × 2,438 m. `position` to podstawa stosu; modele i collidery, `instance: true`. Paleta: navy/olive/ochre/graphite, cykliczna według warstw. Zwraca `roofY`; wierzchy nie są automatycznie powierzchniami AI.                                  |
| `fence({from, to, height, model?, thickness?})`                                                                                                      | Collider ściany; opcjonalne modele bez kolizji co 4 m, wtedy collider niewidoczny. Model musi pasować wymiarami do modułu.                                                                                                                                               |
| `pit({rect, depth, ramps, wallMaterial, y = 0})`                                                                                                     | Dno na y−depth i ściany z przerwami ramp. Grunt wokół musi mieć wycięty cały rect wykopu. Każda rampa ma `side`, `at` oraz zwykłe `from/to/width`; at oznacza środek przejścia w danej ścianie.                                                                          |
| `quay({edge, waterSide, length, height, width = 6, material})`                                                                                       | edge to środek górnej krawędzi od strony wody; płyta rozwija się w głąb lądu, height w dół. north/south: długość X; east/west: długość Z. Nie tworzy wody ani modeli.                                                                                                    |
| `safetyBoundary(polygon, height)`                                                                                                                    | Zamknięty obwód niewidocznych ścian, podstawy z XYZ wierzchołków. Zawsze ostrzega o ręcznej ocenie naturalnej granicy przed zabezpieczeniem.                                                                                                                             |
| `scatter({rect, models, count, minSpacing, rng, avoid, y = 0})`                                                                                      | Losuje pozycje i yaw, odstęp między środkami instancji w tym wywołaniu. `avoid` to prostokąty poszerzone o połowę minSpacing. Ograniczona liczba prób, ostrzeżenie gdy nie mieści count. Modele nie mają colliderów ani sprawdzanych gabarytów.                          |

Boki: `north = minZ`, `south = maxZ`, `west = minX`, `east = maxX`.
Dla north/south `at` biegnie od minX, dla west/east od minZ.
Drzwi budynku/hali: `[{side, at, width, height = 3}]`.
Okna budynku: `[{side, at, width, height, bottom}]`, jako otwory bez szyb.
`windows` jest listą otworów, nie flagą generującą wzór elewacji.

`building.stairs: true | {width, stepRise, stepDepth, material}` wymaga wnętrza.
Klatka leży przy narożniku minX/minZ z odstępem 2 m od ścian; bieg wzdłuż +X,
powtarzany na piętrach. Generator wycina stropy nad całym biegiem, zachowuje
spocznik i kończy schody na ostatnim piętrze albo dostępnym dachu. Stopnie
tworzą cienką płytę schodkową, dzięki czemu kolejny bieg nie zatyka prześwitu.
Dla AI na siatce 1 m zalecane `stepDepth: 1` i szerokość ≥3 m; typowe krótsze
stopnie są trasą gracza i mogą nie przejść limitu wzniosu nawigacji.
Hala domyślnie używa szerokości 3 m, wzniosu ≤0,2 m i głębokości ≥1 m.

```js
p.building({
  rect: { minX: 12, maxX: 48, minZ: 12, maxZ: 40 },
  height: 8,
  floors: 2,
  interior: true,
  doors: [{ side: 'south', at: 18, width: 5 }],
  stairs: { width: 3, stepDepth: 1 },
  roofAccessible: true,
});
p.ramp({ from: vec(0, 0, 70), to: vec(30, 6, 70), width: 5 });
```

## Walidacja i ograniczenia kontraktu

`checkArena(builder)` albo `checkArena(room, metadata)` zwraca
`{metrics, issues, errors, warnings}`. Każdy wpis ma severity/code/message
i opcjonalne details z pozycjami słupów. Błędy zatrzymują zapis JSON-u przez CLI.
Raport obejmuje:

- wymiary obwiedni (240–450 m w najdłuższej osi), powierzchnię ≥40 000 m²;
- obrys: wypełnienie rzutu ≤90% lub wydłużenie ≥1,3; 4–6 stref, ≥4 rodzaje;
- ≥3 płaskie poziomy odległe o ≥1 m; stopnie i rampy nie udają pięter;
- wysokie, wąskie bryły (≥3 m wysokości, szerokość i głębokość ≤3 m,
  smukłość ≥2), bez bryły opartej na ich wierzchu; lista pozycji;
- udział najczęstszego modelu ≤15% wśród instancji blocks.model + decor;
- 3–5 różnych punktów A–E, granice kół punktów/startu/spawnów/stref i ≥16 spawnów.

Powierzchnia jest **szacunkiem próbkowanym co 1 m**, z prześwitem nawigacji;
nakładające się płyty na tej samej wysokości liczy raz, przeszkody odejmuje,
piętra sumuje, nachylenie ramp uwzględnia. `sampleM` pozwala zagęścić pomiar.
Wypełnienie obrysu także opiera się na próbkach; małe szczeliny mogą zniknąć.
Raport nie dowodzi osiągalności wszystkich powierzchni: tę trzeba sprawdzić
przez `ArenaNavigation` i test przejścia kapsuły. Landmarki, osie widokowe,
tożsamość kolorystyczna, naturalność granic i budżety GPU wymagają review gry.
Wykrywanie słupów jest heurystyczne i może wskazać cienki komin lub maszt;
nie ma automatycznego ignorowania takich zgłoszeń.

Ograniczenia zastanego schematu/silnika, pozostawione do pracy integratora:

- `arena.points` zawiera 3–5 punktów A–E; budowniczy odrzuca powtórzone id,
  a schemat pokoju wymaga kolejnych liter od A.
- Spawny są XZ; brak wysokości i wskazania warstwy. Domyślna pula trafia do
  `room.spawnPoints`; osobną pulę trybu można podać przez `arenaMeta`.
- `validateLayout` w roomSchema używa płaskich, nieobróconych obwiedni na
  wysokości gracza. Nie potwierdza pięter; bryły obrócone mogą powodować
  konserwatywne odrzucenie poprawnej geometrii. Osiowe ściany generatora
  zapisują właściwe size XZ bez obrotu, co zachowuje tę walidację.
- `ArenaSurfaceNavigation` przyjmuje wyłącznie obrót Z powierzchni. Rampa X
  działa w obu kierunkach; rampa Z/ukośna i obrócone schody są poprawnymi
  colliderami/renderem, ale generują ostrzeżenie i wymagają rozszerzenia AI.
- Nachylenie kontrolera to 45°, autostep 0,35 m / minimalna szerokość 0,2 m
  (kopię tych limitów w narzędziu chroni test zgodności z tuning.ts).
  Rampa ostrzega również o wzniosie >navigationMaxRiseM na komórkę.
- Materiały są zamkniętym enumem `blockMaterialSchema`, nie dowolnym nowym
  id tekstury. Modele/dekoracje muszą istnieć w aktualnym katalogu assetów.
  Dekoracje mają tylko yaw i jednolitą skalę; nie mogą być colliderami.
- Seed, bounds i strefy nie mają pól w roomSchema; pozostają w generatorze
  i `metadata`, są konsumowane przy check/SVG, bez nowych pól kontraktu gry.
- CLI nie importuje TypeScript ani zod. Każdą nową arenę trzeba osobno
  objąć testem `roomSchema.parse` i nawigacji, tak jak demonstrację.

## Jak dodać arenę

1. Dodaj `tools/arenas/<id>.mjs` z default generate i stałym seedem. Zbuduj
   naturalny obrys, strefy, landmarki i drogi między poziomami.
2. Uruchom `node tools/arenas/build.mjs <id>`. Bez błędów zapisze
   `src/data/rooms/<id>.json` i `docs/arenas/<id>.svg`. Przy błędach zapisuje
   tylko SVG do analizy, pozostawiając wcześniejszy JSON nietknięty.
3. Sprawdź rzut, test zod, ścieżki do punktów i test kapsuły. Zmiany seeda
   i kolejności wywołań rng zmieniają rozrzut, więc wymagają ponownego review.
4. Uruchom `npm run check` i `npm run e2e`. Dołącz JSON/SVG do PR oraz opis
   ręcznego przejścia i obserwacji feel. Podpięcie do trybu pozostaje zadaniem
   autora areny zgodnie z kontraktem i etapem roadmapy.

`node tools/arenas/build.mjs --all` uruchamia alfabetycznie wyłącznie
generatory `.mjs` z głównego katalogu tools/arenas (bez lib i build).
Kod wyjścia !=0 oznacza błędy dowolnego generatora; pozostałe są sprawdzane.
Komenda działa również spoza katalogu repozytorium, jeśli wskazać ścieżkę CLI.

`arenaLibDemo` ma sztywno wyznaczony wyjątek: wynik JSON i SVG trafiają
**wyłącznie do tests/fixtures/**. Nie rejestruje pokoju ani sceny gry.
W trybie demo tylko wymagania skali/powierzchni są ostrzeżeniami;
wszystkie pozostałe reguły pozostają błędami. Bez `{demo: true}` check
odrzuci tę małą mapę zgodnie z ADR. Nie należy używać demo do aren gry.

## Jak czytać SVG i sprawdzić w 30 sekund

```powershell
node tools/arenas/build.mjs arenaLibDemo
npx vitest run tests/unit/arenaLib.test.ts
```

Otwórz `tests/fixtures/arenaLibDemo.svg` w przeglądarce. W pierwszych sekundach
sprawdź wcięcie L w prawym dolnym rogu, wykop po prawej, dwa wnętrza,
pomost ze schodami, strefy i rozproszone spawny. Każdy prymityw występuje
w tym generatorze; dojście na piętra budynku oraz cztery warianty antresoli
mają test `ArenaNavigation`.

Północ jest u góry (−Z), +X w prawo. Siatka ma 10 m, skala 50 m.
Bryły są rysowane od niskich do wysokich: granat → zieleń → bursztyn.
Zielony obrys oznacza `walkable`, cienki szary pozostałe collidery,
przerywany obrys niewidoczne zabezpieczenia. Podpowiedź po najechaniu
podaje materiał/model i wysokość. Strefy mają podpisy nazwa/rodzaj;
okręgi A–E pokazują promień punktu, × to spawny, △ START to gracz,
małe kropki to dekoracje. Dach może zasłaniać wnętrze w rzucie z góry;
SVG nie jest przekrojem i nie zastępuje testu kolizji ani wizyty w grze.
Kolory mapy są legendą analityczną, a nie paletą materiałów świata.
