# Oprawa miasta — Neon Noir

## Koszt struktury pokoju po scalaniu Z19

Poniżej `meshe przed → po (unikalne materiały przed = po)`, zmierzone na
prawdziwych GLB przez `tests/unit/roomStaticBatch.test.ts`. Materiały w różnych
wierszach mogą być współdzielone, więc ich liczby nie są addytywne.

| Źródło                                        |    alleyMarket | combatWarehouse |  eliteFoundry |
| --------------------------------------------- | -------------: | --------------: | ------------: |
| Bloki proceduralne, w tym fasady wokół pokoju |     22 → 4 (4) |      20 → 3 (3) |    20 → 3 (3) |
| Modele GLB bloków                             |    419 → 2 (1) |       7 → 2 (2) |    12 → 3 (3) |
| Dekoracje GLB, także bryły latarni            | 1113 → 21 (21) |   379 → 17 (17) | 429 → 17 (17) |
| Napisy i hologramy                            |   27 → 27 (27) |    18 → 18 (18) |  21 → 21 (21) |
| Plamy świateł                                 |   16 → 16 (16) |    10 → 10 (10) |  11 → 11 (11) |
| Stożki latarni (InstancedMesh)                |      1 → 1 (1) |       1 → 1 (1) |     1 → 1 (1) |
| Naklejki                                      |   11 → 11 (11) |       8 → 8 (8) |  10 → 10 (10) |
| Efekty otoczenia                              |      4 → 4 (4) |       4 → 4 (4) |     4 → 4 (4) |
| Pogoda                                        |      3 → 3 (3) |       3 → 3 (3) |     3 → 3 (3) |
| Panorama                                      |      7 → 7 (3) |       7 → 7 (3) |     7 → 7 (3) |

Okna atlasowe nie tworzą osobnych meshy: są częścią shadera fasady. PointLight
także nie jest meshem; pula świateł pozostaje bez zmian. Statyczne naklejki
pozostawiono osobno ze względu na przezroczyste materiały i sortowanie.
Animowane napisy, plamy, stożki, pogoda i efekty zachowują swoich właścicieli
i dotychczasowe aktualizacje. Nie zmieniono `CityDressing` ani loaderów, więc
arena, kryjówka i galeria modeli zachowują dotychczasową strukturę.
Opis własności geometrii, wykluczeń i ograniczeń pomiaru: [render.md](render.md#statyczna-geometria-pokoju-z19).

Samodzielne moduły renderu korzystające z `SignDef`, `CityLightDef`, `DecalDef`
i `AmbientFxDef` z `src/world/dressingSchema.ts`. Nie tworzą colliderów, nie
zmieniają symulacji i nie konsumują RNG runu. RoomScene i Arena tworzą je z pól
układu przez `CityDressing` (`src/render/city/dressing.ts`): napisy, światła
(`floorY = playerSpawn.y`), naklejki i efekty otoczenia z danych układu oraz deszcz,
gdy motyw ma `rain.enabled` (parametry z motywu). `step(dt)` zbiera czas świata,
`render(frameDt, camera)` woła `update(dtWorld, dtReal, camera)`; `dispose()` zwalnia
wszystko. Błysk burzy `Weather.flash` trafia do `tuning.render.skyFlash`
(skalowany `tuning.city.stormFlash`); burza włącza się polem `rain.storm`
motywu (`neonStreet`: tak, średnio jeden błysk na ok. 40 s, `tuning.city.stormRate`);
w `city-fx-test` przełącza ją komenda `storm <0|1>`. Jasność neonów: `tuning.city.signBrightness` (3,2).

## Kontrakt integracji

Każdy moduł udostępnia `root: Group`, `update(dtWorldS, dtRealS, camera)` oraz
idempotentne `dispose()`. Pozycje definicji są współrzędnymi świata; dodaj `root`
do sceny bez dodatkowej transformacji. Wywołuj `update` raz na klatkę renderu.
`dtWorldS` to suma kroków symulacji od poprzedniej klatki (z uwzględnieniem
Skupienia, hitstopu i pauzy), `dtRealS` to czas rzeczywisty klatki. Zaktualizuj
kamerę (pozycja, rotacja i `updateMatrixWorld()`) przed `render`/`update` efektów. Nie przeliczaj czasu świata ponownie przez timeScale.

```ts
const signs = new SignRenderer(room.signs ?? [], cosmeticSeed);
const decals = new DecalRenderer(room.decals ?? []);
const lights = new CityLights(room.lights ?? [], floorY);
const rain = new Weather({ density: 0.7 }, floorY, cosmeticSeed);
const ambient = new AmbientFx(room.ambientFx ?? [], floorY, cosmeticSeed);
const effects = [signs, decals, lights, rain, ambient];
for (const effect of effects) three.add(effect.root);
// W renderze, po interpolacji kamery:
for (const effect of effects) effect.update(dtWorldS, dtRealS, camera);
// Przy opuszczaniu pokoju:
for (const effect of effects) effect.dispose();
```

Importy: `src/render/city/{signs,decals,lights}.ts` i
`src/vfx/{weather,ambientFx}.ts`. Seed jest stringiem lub liczbą. Ten sam seed,
definicje i sekwencja dt dają te same cząsteczki i migotanie. Domyślne seedy są
stałe; integrator powinien podać osobne seedy kosmetyczne pokoju. Nie używamy
`Math.random()`.

## Napisy i hologramy

`SignRenderer(defs, seed?, textureLoad?)` ładuje tekstury z
`/assets/textures/signs/<texture>.webp` lub `/assets/textures/holo/<texture>.webp`.
Płaszczyzna patrzy w +Z przy yaw=0. `tint` mnoży kolor tekstury. Czarne tło jest
niewidoczne przy addytywnym mieszaniu; kanał alfa pozostaje respektowany. W shaderze
alfa jest dodatkowo skalowana luminancją (rgb·a bez zmian), więc czarne tło bez kanału
alfa nie przyciemnia bloomu.
Materiały mają `toneMapped=false`, `depthTest=true`, `depthWrite=false`, `userData.bloom=true`.
Płaszczyzny napisów i halo są jednostronne, odsunięte o `surfaceOffsetM` (0,012 m).

Kontur: pass normalnych/głębi w `outline.ts` używa globalnego `overrideMaterial`, więc
przezroczyste quady dostałyby obrys. Obiekty z `userData.noOutline = true` są na czas
tego passu (normalne, wet normals) ukrywane (`src/render/noOutline.ts`); bloom i
odbicia nadal je widzą. Flagę mają: deszcz, rozbryzgi, para, iskry, kapanie, plamy
światła, naklejki, płaszczyzny napisów i hologramów oraz stożek projektora. Ramy
neonów (pełne bryły) są obrysowane.

Neon ma ciemną płytę za tekstem. `flicker=0` daje stałą jasność; wyższe wartości
włączają krótkie zaniki, buczenie jasności i częściowe wygaszenie komórek UV.
Hologram dodatkowo ma linie skanowania, okresowe przesunięcia pasów i kanałów
RGB, zanik przy dolnej krawędzi oraz słaby stożek projektora z wierzchołkiem
na dole. Animacja napisów i płynność świateł używają `dtRealS`.

Do czasu załadowania obrazu widoczny jest canvas z identyfikatorem `texture`:
biały tekst i obramowanie mnożone przez tint materiału. Brak pliku pozostawia
fallback i wywołuje jedno ostrzeżenie na identyfikator w całej sesji. Nie ma
odrzuconej obietnicy ani wyjątku. Przeglądarka może osobno pokazać HTTP 404
dla brakujących zasobów. W środowisku bez DOM używany jest 1×1 DataTexture.
Tekstury są własnością instancji, także fallbacki i odpowiedzi przychodzące
po `dispose()`; nie należy ich współdzielić z innymi właścicielami.

## Naklejki i światła

`DecalRenderer(defs, textureLoad?)` używa `/assets/textures/decals/…`, kanału alfa,
`opacity` oraz niewielkiego odsunięcia wzdłuż normalnej powierzchni i polygonOffset.
Naklejki nie zapisują głębi i mają jawne `userData.bloom=false`. Dla podłogi
normalna wskazuje +Y; yaw obraca obraz w jej płaszczyźnie. Naklejki są statyczne.

`wallDecalFitsBlock(decal, block, surfaceToleranceM=0.1)` z
`src/world/dressingSchema.ts` jest czystym, eksportowanym sprawdzeniem nośnika.
Przyjmuje blok AABB `{ position: {x,y,z}, size: {x,y,z} }`, rozpoznaje jego pionową
ścianę po pozycji i normalnej naklejki (`yaw`) i sprawdza szerokość oraz wysokość
całego prostokąta względem jednej ściany. Tolerancja 0,1 m uwzględnia istniejące
odsunięcia danych od płaszczyzny; nie rozszerza granic ściany. Zaokrąglone kąty
np. 1,5708 są obsługiwane, naklejki podłogowe zwracają `false`.
Bez dodawania pól lub ograniczeń do schematu; można użyć tej samej funkcji dla
bloków kryjówki. `tests/unit/cityDecalBounds.test.ts` sprawdza wszystkie JSON-y
pokoi i wymaga, by każda naklejka ścienna mieściła się na co najmniej jednym bloku.

`CityLights(defs, floorY=0)` tworzy dokładnie `tuning.city.maxLights` obiektów
PointLight (domyślnie 8), również gdy definicji jest mniej. Nie usuwa świateł
ani nie przełącza ich widoczności w trakcie aktualizacji. Intensywność 0
zachowuje liczbę świateł w shaderach. Wybór: rosnąca odległość od kamery spośród
świateł, których kula zasięgu przecina frustum; remis rozstrzyga indeks definicji.
Światło poza kadrem może zatem nadal oświetlać widoczny fragment ulicy.

Przy zmianie zestawu stare światło wygasa, dopiero przy progu bliskim zeru
zmienia pozycję/kolor i płynnie narasta. Nie interpolujemy położenia światła
przez ulicę. Każda definicja ma własną addytywną, radialną plamę na `floorY`,
także gdy nie ma przypisanego PointLight. Plamy nie uruchamiają bloomu. Mają być delikatną poświatą: promień plamy to
`range * 2 * lightSpotScale` (0,6), siła `lightSpotOpacity` (0,08).
To stylizowana poświata na mokrej nawierzchni, bez odbicia geometrii ani SSR.

### Ocena świateł (poprawka oświetlenia)

- **Wybór do puli 8 świateł:** nadal frustum + odległość od kamery, ale odległość² jest dzielona przez `(intensity*range/40)^lightImportance` (jasne, dalekie źródła wygrywają z bliskimi słabymi), a światła już przydzielone dostają premię `lightKeepBonus` (histereza: bez przełączania przy remisie). `lightImportance=0` przywraca czystą odległość (`lightScore`, `selectCityLights(..., priority)`). Wygaszanie przed przestawieniem bez zmian.
- **Siła i spadek:** intensywność każdego światła mnożona przez `lightIntensityScale`, wykładnik spadku `lightDecay` (mniejszy = łagodniej). Neony i hologramy oświetlają więc kolorem ściany i mokrą nawierzchnię bez twardej granicy.
- **Plamy pod światłem:** profil `(1 - smoothstep(0,1,r))^lightSpotPower` (miękki środek i brzeg), siła `lightSpotOpacity`.
- **Poświata napisów:** każdy neon i hologram ma addytywny, miękki halo-quad w płaszczyźnie napisu (rozmiar `min(signGlowScale, signGlowMaxScale)` × rozmiar napisu, domyślnie maks. 1,6× zamiast 2,3×; siła `signGlowOpacity`, hologramy × `signGlowHoloFactor`). Definicja napisu nie zawiera wymiarów nośnika, dlatego stosowany jest ten limit oraz dodatkowe wygaszenie do zera na całym obwodzie (`signGlowEdgeFade`, pas UV 0,2). Kolor: `tint` napisu, w razie braku kolor najbliższego światła w `signGlowLightRangeM` (`signGlowColor`), w ostateczności ciepła biel. Jasność podąża za migotaniem napisu (zaniki i buczenie zostają). Bez bloomu, bez konturu.
- **Latarnie** (`src/render/city/lamps.ts`): dla dekoracji `city_street_lamp` (z `layout.decor`, przekazywanych przez `CityDressing`) powstaje światło punktowe (`lampLight*`, `lampColor`) dołączone do puli i plama pod lampą oraz subtelny stożek: jeden `InstancedMesh`, addytywny, bez cieni, gaśnie ku ziemi i na brzegach sylwetki (`lampCone*`). Położenie głowicy: `lampHeadHeightM`, `lampHeadForwardM`.
- **Zasłanianie poświat:** napisy, halo, plamy, stożki i addytywne cząsteczki mają jawne `depthTest=true`, `depthWrite=false` i `renderOrder=glowRenderOrder` (1), po geometrii nieprzezroczystej. Halo nie używa polygonOffset; odsunięcie nie przekracza `surfaceOffsetM`. Jednostronne są quady oraz billboardy cząsteczek; otwarte stożki pozostają dwustronne, bo kamera może wejść do środka.
- **Maska bloomu i odbić:** `BloomPass` renderuje geometrię z własnym buforem głębi i zachowuje test głębi materiałów emisyjnych. Nieemisyjne halo/plamy/stożki lamp są ukrywane w obu maskach. Zasłony zapisują teraz także zerowe RGBA (`NoBlending`, opacity 0, bez mgły), usuwając kolor źródła narysowanego wcześniej; samo `colorWrite=false` zostawiało daleką emisję pod bliższą ścianą/filarem. `NoBlending` zapobiega wymuszeniu alfy 1 przez wariant `OPAQUE` Three.js. Wyłączony test głębi w pełnoekranowych przebiegach rozmycia dotyczy wyłącznie gotowej tekstury, nie geometrii sceny. Testy: `tests/unit/cityGlowOcclusion.test.ts`; wizualną ocenę rozmycia i GLSL wykonuje się w przeglądarce.

### Okna budynków (atlasy)

- Okna fasad (materiał `facade`: budynki wokół pokoi i panorama w tle) pochodzą z atlasów `atlas/windows_lit.webp` i `atlas/windows_dark.webp` (siatka 4×4, komórki 256 px). Shader (`src/render/urbanMaterials.ts`, `windowCode`) wybiera okno deterministycznie z indeksu okna na ścianie (rzut świata, bez migotania między wczytaniami); wersja referencyjna w TS: `src/render/city/windowAtlas.ts` (`windowChoice`, `windowCellUv`, testy `tests/unit/windowAtlas.test.ts`).
- Siatka okien: rozstaw `windowPitchXM × windowPitchYM` (2,4 × 3,2 m), wymiary okna losowane z `windowMin/MaxWidthM` (1,2–1,6 m) i `windowMin/MaxHeightM` (1,6–2,2 m) — okna pionowe, mniejsze niż dawne płachty.
- `windowLitFraction` (0,4) = udział okien z atlasu oświetlonego, reszta z ciemnego. Emisja: `windowLitEmission` (0,5) i `windowDarkEmission` (0,02); siła w bloomie `windowBloom` (0,35). Mipmapy próbkowane `textureGrad` po ciągłych UV okna (bez szwów na krawędziach komórek). Do załadowania atlasu okna są wyłączone.
- Bez nowych świateł; ten sam materiał i atlas w panoramie (dalekie okna uśredniają się mipmapami). Wolne gaśnięcie/zapalanie okien nie zostało wdrożone.

## Panorama miasta i niebo

Motywy z `panoramaEnabled` (`neonStreet`) dostają tło z `src/render/panorama.ts`:
deterministyczny układ z `src/render/skyline.ts` (osobny strumień RNG, brak ciał i świateł
punktowych) i nieoświetlone shadery z `src/render/skyMaterials.ts`. Razem 7 meshy:

- **Wieżowce** — jeden `InstancedMesh` (ok. 200 brył): 4 pierścienie (r ≈ 66/92/124/162 m),
  wyższe z odległością, nieregularne przerwy, uskoki (węższe nadbudowy), podstawy 24 m pod
  ulicą. Okna w shaderze: rytm pięter i ciągów 2–5 okien (całe piętra zgaszone), daleko
  uśrednione pokrycie zamiast migotania; ciepła biel / bursztyn, pojedyncze błękitne okna;
  wybrane wieże z neonowym wieńcem. Głębię daje mgła kompozycji. Do maski bloomu idzie osobny
  materiał (`userData.bloomMaterial`) z samym światłem okien.
- **Punkty orientacyjne** — 3 smukłe wieże z uskokami i masztem (główna na −Z, widoczna ze
  spawnu większości pokojów) i **bursztynowe** światła ostrzegawcze (szczyt i połowa masztu,
  narożniki uskoków, część dachów): addytywne billboardy z minimalnym rozmiarem kątowym.
- **Hologramy reklam** — 3 panele w górnej części fasad (pas znaków, baner, znak), kolory tylko
  z palety otoczenia (fiolet, bursztyn, zieleń).
- **Pojazdy** — pary świateł (ciepła biel z przodu, bursztyn z tyłu) na łukach między warstwami;
  ruch liczony w shaderze wierzchołków (zero pracy CPU).
- **Niebo** — kopuła (podgrupa `city-sky`): łuna miasta tuż nad horyzontem (bursztyn → fiolet,
  nierówna w azymucie) i pokład chmur/smogu podświetlony od dołu, dryfujący w czasie.

Wszystko, co nie zapisuje głębi, jest addytywne z `premultipliedAlpha` i alfą równą
luminancji (inaczej poświata bloomu „over” zastępowała ostry punkt rozmytą wersją).
Strojenie: `tuning.render.panoramaDensity/panoramaHeight` (motyw) oraz `tuning.city.panorama*`
i `tuning.city.sky*` (ruch, jasność okien i świateł, kolor ścian, łuna, chmury). Testy:
`tests/unit/skyline.test.ts`.

### Gradient nieba w przebiegu koloru

`StylePipeline` (`outline.ts`) na czas przebiegu koloru dodaje do sceny pełnoekranowy quad
`sky-background` (głębia NDC 1, bez zapisu głębi, `renderOrder` najniższy, alfa =
`skyGradient`). Rysuje się tylko tam, gdzie nie ma geometrii nieprzezroczystej, i przed
wszystkimi obiektami przezroczystymi, więc hologramy, deszcz i viewmodel mieszają się z
gradientem, a nie z płaskim kolorem tła. Kompozycja na pikselach nieba (głębia koloru = 1) już
nie podmienia koloru, tylko dodaje błysk burzy; mgła na niebie nadal nie działa. Quad nie
trafia do przebiegów normalnych, bloomu ani odbić. Test: `tests/unit/renderOutline.test.ts`.

## Deszcz i efekty otoczenia

`Weather(params?, floorY=0, seed?)` ma publiczne, mutowalne `params: RainParams`:
`enabled`, `density` (0..1), `speed` (m/s), `windX` (m/s), `color`, `opacity`.
Domyślne wartości pochodzą z `tuning.city`. Deszcz to stała pula 4000 instancji;
gęstość zmienia tylko liczbę rysowanych instancji. Objętość 28×14×28 m podąża
za kamerą; modulo zawija pozycje również po teleportacji i dużym dt. Smugi
mają kierunek wiatru i długość zależną od szybkości oraz `rainExposureS`.
Poniżej `floorY` są ukryte. Przecięcie podłogi emituje pierścień i kroplę,
łącznie do 300 instancji w dwóch stałych pulach. Emisja ma osobny limit na sekundę.

`stormEnabled=false` domyślnie; po włączeniu rzadki błysk ustawia publiczne
`flash` w zakresie 0..1. Kompozycję błysku podpina integrator. Ruch deszczu,
rozbryzgi i błysk używają czasu świata.

`AmbientFx(defs, floorY=0, seed?)` ma osobne pule: para 100, iskry 180, krople
100 i rozbryzgi 80. Para to miękkie billboardy, które unoszą się, rosną i gasną.
Iskry są emitowane seriami, podlegają grawitacji i odbijają się od podłogi;
tylko ich materiał ma flagę bloom. Krople spadają i tworzą pierścień przy
podłodze. `rate` oznacza emisje/s, dla `sparks` serie/s; 0 wyłącza emiter.
Efekty używają czasu świata i stałych pul z zastępowaniem starszych cząsteczek.
Nie ma kolizji z dachami i przeszkodami: integrator wybiera miejsca emisji,
obszar deszczu oraz wysokość płaskiej podłogi.

### Strefy bez deszczu (Z21)

Opcjonalne `rainShelters: [{ position, size }]` w danych oprawy to AABB:
`position` oznacza środek świata, `size` pełne dodatnie wymiary XYZ.
Granice należą do strefy. CityDressing przekazuje definicje jako czwarty
argument `Weather(params, floorY, seed, shelters?)`. Brak pola zachowuje
dotychczasowy deszcz. Strefy są kosmetyczne i nie tworzą colliderów.

Deszcz już wcześniej przesuwał i zawijał instancje na CPU w Weather.
W tej samej pętli przecięcie strefy przez obwiednię smugi zeruje skalę instancji;
pozycja i ruch pozostają zachowane. Nie dodano przebiegu ani shadera.
`isRainSheltered(point, shelters, halfSize?)` to czyste sprawdzenie bez alokacji:
opcjonalne półwymiary rozszerzają test o obwiednię całej smugi. Dzięki temu
koniec smugi nie wystaje pod strop, gdy środek kropli jest jeszcze nad nim.
Przecięcie podłogi w strefie nie emituje rozbryzgów; jawne emitery kapania
(`ambientFx: drip`) nadal działają. Deszcz nad stropem i poza obrysem dachu
pozostaje widoczny. Pauza nadal pomija aktualizacje niezmienionych macierzy.

Strefy od podłogi do spodu stropu:

| Pokój                 | Środek       | Pełne wymiary   |
| --------------------- | ------------ | --------------- |
| `combatFloodedTunnel` | (0; 2; 0)    | 12 × 4 × 24 m   |
| `alleyUnderpass`      | (0; 3,25; 0) | 16 × 6,5 × 22 m |

Testy `rainShelters.test.ts`: schemat, granice, dane stropów, macierze
rzeczywistych instancji Three.js, rozbryzgi, pauza i przekazanie przez
CityDressing. Ocena architekta w `?scene=room-test&room=<id>` powinna
uwzględnić krawędzie stropu przy wietrze: ukrywana jest cała smuga,
której obwiednia przecina strefę. Może to dawać wąski pas bez smug tuż
poza dachem; shader nie przycina części smugi na samej granicy.

## Strojenie i zasoby

Wszystkie parametry animacji oraz limity są w `tuning.city`, automatycznie
widoczne w lil-gui. Limity ustalają rozmiar buforów przy konstrukcji; aby je
zwiększyć, odtwórz moduł. Obniżenie `maxLights` ogranicza wybór w istniejącej
puli, jej rozmiar pozostaje stały. Parametry wymiarów i czasów powinny być
dodatnie, limity całkowite dodatnie, gęstość/opacity w 0..1.
Zmiana `RainParams` działa od następnej klatki. Scena testowa na bieżąco
kopiuje speed/windX/color/opacity z GUI do `RainParams`.

Każda instancja zwalnia geometrie, materiały, tekstury i bufory InstancedMesh.
Nie ma globalnego cache GPU. `dispose()` odłącza root, czyści pule i ignoruje
dalsze aktualizacje. Wspólna geometria plam światła jest zwalniana raz.

Kolory otoczenia: bursztyn `#ffae1a`, zieleń `#6dff4a`, fiolet `#8a5cff`, błękit
królewski `#3d7bff`, ciepła biel `#fff1d6`. Dodatkowo chłodne, słabo nasycone
barwy deszczu, betonu i pary. Barwy gracza, Rezonansu i wrogów nie są używane.

## Scena i kontrola ręczna

Otwórz `?scene=city-fx-test&seed=city-review` (opcjonalnie `&debug=1`). Widać
6 neonów, 2 hologramy, 6 świateł, naklejki, deszcz, parę, iskry i kapanie,
jasną skrzynię oraz sylwetki wieżowców z oknami. Proste bryły są lokalnym
stanowiskiem testowym, bez zależności od nowych modeli i motywów.
WASD + mysz: lot, Spacja/Ctrl: pion, Shift: szybciej. Brak kolizji kamery jest
celowy. Tło, gradient horyzontu i mgła są lokalne. Scena czasowo wyłącza globalny
gradient i mgłę kompozycji, a przy dispose przywraca wcześniejsze ustawienia,
tło, mgłę i rejestrację komendy.

- `rain 0`, `rain 1`: porównaj ulicę bez deszczu i z pełną gęstością.
- `timescale 0.15`: deszcz/para/iskry zwalniają; neony i światła nadal animują się.
- Odwróć kamerę i wróć: światła powinny płynnie zmienić zestaw bez skoków koloru.
- Podejdź do napisów: oceń skanowanie, częściowe zaniki i czytelność znaków.
- Oceń, czy efekty nie zasłaniają centralnej osi walki i jasnej skrzyni.
- Sprawdź napisy i lampy zza filara oraz z obu stron ściany: źródło zasłonięte bryłą nie może zostawiać prostokąta w masce bloom ani odbić. Przy krawędzi wąskiego napisu halo powinno miękko zanikać w granicach 1,6×; porównaj też z wyłączonym bloomem i odbiciami.

Testy `tests/unit/cityFx.test.ts`: najbliższe światła/frustum/stała pula,
zawijanie deszczu, gęstość i pauza, deterministyczny seed, limity i kapanie,
fallback canvas, późne ładowanie, naklejki i jednokrotne zwalnianie zasobów.
Ocena wizualna wymaga Chromium/WebGL; testy jednostkowe nie kompilują GLSL.

## Galeria modeli: `?scene=city-props-test`

W pokojach modele `city_*` zachowują własne materiały również przy ustawionym `material` bloku; materiał bloku nadal dotyczy bryły zastępczej i modeli spoza `city_*`.

Uliczka ok. 10 × 44 m z wszystkimi 24 modelami `city_*.glb` (bloki i podłoże na chodnikach, modele ścienne na fasadach, rozpięcia w poprzek ulicy); lista modeli w `src/scenes/cityPropsTest.ts`. Parametry: `prop=<nazwa>` (np. `city_car`, kamera 3/4 z bliska), `yaw=<stopnie>` (obrót kamery wokół modelu, domyślnie 35), `view=0|1|2` (przegląd: wzdłuż ulicy, odwrotnie, z góry). Po załadowaniu modeli `document.body.dataset.cityPropsReady = '1'`.
