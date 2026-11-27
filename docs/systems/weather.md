# Pogoda sterowana danymi

Profile `src/data/weather/<id>.json` waliduje `weatherSchema` (`src/render/weatherSchema.ts`,
zod) w warstwie renderu; wszystkie pliki z katalogu ładuje `weatherDefinitions`
(powtórzone `id` = błąd). Pokój wybiera profil opcjonalnym polem `weather`; brak pola
zachowuje dokładnie dotychczasową ścieżkę motywu: deszcz, mgłę, połysk i częstotliwość
burzy. Nie ma zdarzeń rozgrywki, sił fizycznych ani wpływu pogody na AI lub obrażenia.

| Profil      | Opad / pył                                   | Wiatr            | Widoczność i nawierzchnia           |
| ----------- | -------------------------------------------- | ---------------- | ----------------------------------- |
| rain        | Dotychczasowe smugi neonStreet, gęstość 0,65 | 1 m/s            | Dotychczasowa mgła i odbicia        |
| storm       | Ulewa, pełna pula                            | 7 m/s + porywy   | Mocny połysk, wyładowania co 5–13 s |
| smog        | Bez opadu, miękkie billboardy pyłu           | 0,65 m/s         | Gęsta mgła do wysokości 9 m         |
| drizzleWind | Krótkie, cienkie smugi mżawki                | 10 m/s + porywy  | Umiarkowana mgła i mokrość          |
| clearNight  | Bez opadu i pyłu                             | 0,5 m/s          | Lekka mgiełka i mokre plamy         |
| snow                | Wolne, niebieskawobiałe płatki, gęstość 0,38          | 1,1 m/s + porywy  | Chłodna mgła 24–170 m, matowy śnieg         |
| ashfall             | Szare i ciepłoszare płatki, gęstość 0,28              | 1,6 m/s + porywy  | Ciepła mgła 24–145 m, sucho                 |
| kuroganeOfficeTower | Deszcz za szybą (gęstość 0,42; wnętrze w `rainShelters`) | 0,85 m/s + porywy | Zerowa mgła we wnętrzu, połysk 0,65, panorama |

Przypisanie do aren (pole `weather` w `src/data/rooms/*.json`): `arenaContainerPort`
= storm, `arenaFloodedDocks` = rain, `arenaOverpass` = smog, `arenaRooftops` =
drizzleWind, `arenaConstructionSite` = clearNight, `arenaPowerPlant` = ashfall,
`arenaRailYard` = snow. Pozostałe pokoje nie mają pola i używają `rain` motywu.

## Pełne dane profili

Wspólne dla wszystkich: `lightning.color` = `#fff1d6` (schemat dopuszcza tylko tę
wartość), `ambience[].radiusM` = 100, `dust` poza smogiem: gęstość 0, rozmiar 0,12 m,
alfa 0,12, kolor `#8991a0`, życie 8 s. Pola `precipitation.exposureS` i `widthM`
dla profili bez opadu i dla płatków są wymagane przez schemat, ale nieużywane.

| Profil      | Opad: rodzaj, gęstość, prędkość m/s, kolor, alfa | `exposureS` / `widthM` | Wiatr: kierunek XZ, siła m/s, porywy (0..1), okres porywów s |
| ----------- | ------------------------------------------------ | ---------------------- | ------------------------------------------------------------ |
| rain        | rain, 0,65, 18, `#8294b0`, 0,26                  | 0,025 / 0,013          | (1; 0), 1, 0, 8                                              |
| storm       | rain, 1, 27, `#8294b0`, 0,32                     | 0,032 / 0,015          | (0,8; 0,6), 7, 0,55, 6                                       |
| smog        | none, 0, 18, `#8294b0`, 0,26                     | 0,025 / 0,013          | (1; 0), 0,65, 0,2, 11                                        |
| drizzleWind | drizzle, 0,4, 8, `#8294b0`, 0,19                 | 0,014 / 0,009          | (−0,6; 0,8), 10, 0,7, 4                                      |
| clearNight  | none, 0, 18, `#8294b0`, 0,26                     | 0,025 / 0,013          | (1; 0), 0,5, 0, 8                                            |
| snow        | snow, 0,38, 1,2, `#c8d3eb`, 0,55                 | (nieużywane)           | (1; 0,4), 1,1, 0,3, 9                                        |
| ashfall             | ash, 0,28, 0,55, `#a29e94`, 0,42                 | (nieużywane)           | (1; 0,4), 1,6, 0,3, 9                                        |
| kuroganeOfficeTower | rain, 0,42, 18, `#889bb8`, 0,28                  | 0,025 / 0,013          | (1; −0,35), 0,85, 0,25, 7                                    |

| Profil      | Mgła: kolor, `density`, `heightM`, `strength`, `nearM`, `farM` | Nawierzchnia: `gloss`, `reflections`, `puddles`    |
| ----------- | -------------------------------------------------------------- | -------------------------------------------------- |
| rain        | `#2b1f3d`, 0,025, 2,0833 (= 1/0,48), 0,72, 18, 135             | 0, 0,95, 1                                         |
| storm       | `#2b1f3d`, 0,035, 5, 0,65, 25, 145                             | 0,9, 1, 1                                          |
| smog        | `#2e3040`, 0,035, 9, 0,75, 8, 100                              | 0,1, 0,2, 0,3                                      |
| drizzleWind | `#2b1f3d`, 0,035, 3, 0,6, 15, 130                              | 0,5, 0,65, 0,65                                    |
| clearNight  | `#2b1f3d`, 0,005, 2, 0,25, 45, 200                             | 0,05, 0,25, 0,25                                   |
| snow        | `#303d59`, 0,014, 12, 0,65, 24, 170                            | 0, 0, 0; `snowCoverage` 0,6, `snowColor` `#9aa6bf` |
| ashfall             | `#504535`, 0,022, 12, 0,65, 24, 145                            | 0, 0, 0 (`snowCoverage` 0)                         |
| kuroganeOfficeTower | `#0b101d`, 0, 20, 0, 90, 240                                   | 0,65, 0,82, 0,15 (`lighting`: hemi 4,4, key 1,55, panorama) |

| Profil      | Wyładowania: włączone, odstęp min–max s, jasność, zanik s | Pył: gęstość, rozmiar m, życie s | `sky.horizonColor` | Audio (`kind` gain)      |
| ----------- | --------------------------------------------------------- | -------------------------------- | ------------------ | ------------------------ |
| rain        | tak, 25–55, 1, 0,18                                       | 0                                | —                  | rain 0,5; wind 0,1       |
| storm       | tak, 5–13, 1,4, 0,28                                      | 0                                | —                  | rain 0,85; wind 0,5      |
| smog        | nie                                                       | 0,8, 0,23, 8                     | —                  | wind 0,16                |
| drizzleWind | nie                                                       | 0                                | —                  | rain 0,2; wind 0,7       |
| clearNight  | nie                                                       | 0                                | —                  | wind 0,08                |
| snow        | nie (45–90, 0,15)                                         | 0                                | `#344363`          | wind 0,12                |
| ashfall             | nie (45–90, 0,15)                                         | 0                                | `#715632`          | wind 0,09; generator 0,3 |
| kuroganeOfficeTower | nie (25–55, 0,18, jasność 0)                              | 0                                | `#2b1f3d`          | generator 0,08; wind 0,1 |

Zakresy schematu: gęstość, alfa, `gloss`, `reflections`, `puddles`, `strength` mgły,
`gustStrength` i `gain` to 0..1; prędkość, `exposureS`, `widthM`, `heightM`, okresy
i `farM` są dodatnie; `farM` > `nearM`; `maxIntervalS` ≥ `minIntervalS`; kierunek
wiatru nie może być zerowy; `snowCoverage` domyślnie 0, `snowColor` domyślnie `#ffffff`.

## Parametry i integracja

`precipitation` określa rodzaj, gęstość, prędkość, kolor, przezroczystość,
ekspozycję i szerokość smug. `wind` ma normalizowany kierunek XZ, siłę,
amplitudę i okres porywów. `fog` ma kolor, gęstość, wysokość zaniku oraz
parametry mgły odległościowej. `surface` steruje połyskiem materiałów miejskich,
siłą istniejących odbić neonów i maską kałuż. Nie dodaje SSR ani odbić całej sceny.
`lightning` określa przedział losowania czasu, jasność, czas zaniku i wyłącznie
ciepłą biel `#fff1d6`. `dust` określa gęstość, rozmiar, czas życia, kolor i alfę.
`ambience` definiuje warstwy rain/wind/generator z głośnością i zasięgiem.

Przełączenie profilu (`CityDressing.setWeather`, patrz niżej) kopiuje wartości do
`tuning.render` i uniformów materiałów: `fog.color` → `fogColor`, `fog.density` →
`heightFogDensity`, `1 / fog.heightM` → `heightFogFalloff`, `fog.strength` →
`fogStrength`, `fog.nearM`/`farM` → `fogNear`/`fogFar` (przed skalowaniem horyzontu
areny), `surface.reflections` → `reflectionStrength`, `surface.puddles` →
`reflectionPuddles`, `sky.horizonColor` (albo wartość motywu sprzed profilu) →
`skyHorizon`, `lightning.color` → `tuning.weather.skyFlashColor`. Połysk:
uniform `weatherGloss` = `surface.gloss * tuning.weather.wetRoughnessScale` (0,45);
szorstkość materiałów miejskich mnożona jest przez `1 − weatherGloss` i obcinana do
0,04..1. Pozostałe parametry i kolejność przebiegów kompozycji (mgła, kolor błysku
dodawany do nieba i mgły) opisuje [render.md](render.md).

### Opad smugowy (rain, drizzle)

Jedna pula 4000 instancji (`tuning.city.rainMax`) w objętości 28 × 14 × 28 m
(`rainWidthM/HeightM/DepthM`) wokół kamery; pozycje początkowe losuje kosmetyczny
`Rng` (stała kolejność, przy pierwszej klatce), potem zawijanie modulo względem kamery.
Ruch liczy shader wierzchołków (patrz „Ruch w shaderze”), nie CPU. Rysowanych jest
`floor(4000 * density * quality.rainDensity)` instancji; ruch każdej kropli to
(`windX`, −`speed`, `windZ`) na sekundę. Smuga to płaski quad addytywny
(`opacity`, `color` profilu, `toneMapped=false`, bez zapisu głębi, bez bloomu, bez
konturu): szerokość `widthM` (domyślnie `rainStreakWidthM` 0,013 m), długość
`|(windX, speed, windZ)| * exposureS` (domyślnie `rainExposureS` 0,025 s), oś wzdłuż
wektora (−`windX`, `speed`, −`windZ`), obrót wokół tej osi ku kamerze. Wiatr:
`siła(t) = strength * (1 + gustStrength * sin(2π t / gustPeriodS))`, rozłożona wzdłuż
znormalizowanego kierunku XZ. Smugi poniżej `floorY` i wewnątrz stref bez deszczu
(obwiednia całej smugi) mają skalę zero.

Przecięcie `floorY` przez kroplę (poza strefą; losowana jest kropla, która w tej klatce przecina
podłogę, patrz „Rozbryzgi bez pętli po kroplach”) wydaje parę: pierścień
(`RingGeometry(0,72; 1)` płasko na `floorY + surfaceOffsetM`, promień
`rainSplashRadiusM` 0,22 m, rozmiar × `(1 + splashGrowth * wiek/życie)` przy
`splashGrowth` 2, życie `rainSplashLifeS` 0,28 s, jasność gaśnie liniowo) i kroplę (prędkość pionowa losowa 0..`rainSplashRiseMS`
1,5 m/s, pozioma ±`rainSplashDriftMS` 1 m/s, grawitacja `sparkGravity` −9,
rozmiar `dripSizeM` 0,025). Kolor pary = kolor opadu. Budżet emisji rośnie o
`dt * rainSplashRate (100) * density` na sekundę i jest obcięty do 1; dwie pule po
150 instancji (połowa `rainSplashMax` 300). Płatki nie wydają rozbryzgów.

### Ruch w shaderze

`Weather.rain` to `Mesh` z `InstancedBufferGeometry` (quad 1 × 1) i `MeshBasicMaterial` z
`onBeforeCompile`; nie ma `instanceMatrix`. Stałe atrybuty instancji (zapis raz, przy pierwszej
klatce): `rainStart` (położenie początkowe względem kotwicy = pozycja kamery w pierwszej klatce)
i `rainSeed` (faza `i mod 2π`, `sin(i)`, parzystość `i`). CPU co klatkę ustawia wyłącznie uniformy:

| Uniform                                | Znaczenie                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `rainCenter`                           | pozycja kamery (środek zawijania)                                                                                        |
| `rainShift`                            | (kotwica + przebyta droga − kamera) zawinięte w objętość; droga = suma `windX·dt`, `−speed·dt`, `windZ·dt` (czas świata) |
| `rainSpan`                             | wymiary objętości (`rainWidthM/HeightM/DepthM`)                                                                          |
| `rainScatter`, `rainSway`              | płatki: `windScatter · droga_XZ` oraz (`swayM`, faza kołysania); dla deszczu zera                                        |
| `rainTilt`, `rainSize`                 | pochylenie smugi (wspólne dla klatki) i (szerokość, długość)                                                             |
| `rainFloorY`, `rainNearSq`, `rainHalf` | podłoga, kwadrat promienia ukrywania płatków przy kamerze, połowa obwiedni smugi                                         |
| `rainShelters`, `rainShelterCount`     | tekstura RGBA32F 2 × N (środek, połowa wymiarów strefy), liczba stref                                                    |
| `rainTintMode`, `rainTintA/B`          | płatki: naprzemienny kolor wg parzystości indeksu                                                                        |

Shader (`RAIN_VERTEX_POSITION` w `src/vfx/weather.ts`): `rel = rainStart + rainShift`
(+ rozrzut i kołysanie płatków: `x += swayM·sin(faza)`, `z −= swayM·cos(faza)`, czyli całka z
równań ruchu płatka), zawinięcie `mod` do objętości wokół kamery, ukrycie (zdegenerowany quad)
poniżej `floorY`, bliżej niż `flakeNearM` (płatki) i w strefie bez deszczu rozszerzonej o `rainHalf`,
potem obrót quada wokół Y ku kamerze i pochylenie (`rainTilt`). Droga jest sumowana na CPU w
podwójnej precyzji i zawijana przed wysłaniem, więc dokładność nie spada z czasem. `Weather.dropCenter`
i `Weather.dropMatrix` to referencja CPU tych samych równań (testy, rozbryzgi). Gęstość zmienia
`geometry.instanceCount`; przy zerowej gęstości `rain.visible = false`. Zmiana wobec poprzedniej wersji:
krople poza rysowaną pulą też „przebywają drogę” (poprzednio były zamrożone), a zmiana profilu nie przesuwa
faz kołysania (faza liczona z osobnego licznika, nie z `elapsed`).

#### Rozbryzgi bez pętli po kroplach

Budżet emisji bez zmian. Zamiast przeglądać wszystkie krople, `spawnSplashes` losuje (kosmetyczny
`Rng`) do `tuning.weather.splashProbes` (256) indeksów rysowanych kropli na jeden rozbryzg i
wybiera pierwszą, która w tej klatce przecina `floorY` (`y ≤ floorY < y + speed·dt`) poza strefą
bez deszczu; rozbryzg powstaje w jej XZ. Brak trafienia kończy emisję w tej klatce (budżet
zostaje). Rozkład jest równomierny (poprzednio: krople o najniższych indeksach).

### Płatki (snow, ash)

Rodzaje `snow` i `ash` wymagają `precipitation.flakes`: `sizeM` (średnica),
`swayM` (amplituda kołysania), `swayPeriodS` (okres), `windScatter` (rozrzut
prędkości dryfu) i `secondaryColor` (drugi kolor naprzemiennych instancji).
`precipitation.speed` pozostaje prędkością pionową. Śnieg: 1,2 m/s, płatek
0,075 m, kołysanie 0,22 m / 4,5 s, rozrzut 0,18. Popiół: 0,55 m/s,
0,065 m, kołysanie 0,6 m / 2,4 s, rozrzut 0,65. Dryf korzysta z wiatru
profilu; fazy zależą od indeksu instancji `i`, pozycje początkowe od seeda:
`faza = 2π t / swayPeriodS + i`, `flutter = swayM * 2π / swayPeriodS`,
`rozrzut = 1 + windScatter * sin(i)`; `x += (windX * rozrzut + cos(faza) * flutter) * dt`,
`z += (windZ * rozrzut + sin(faza) * flutter) * dt`.
Oba profile wyłączają rozbryzgi, kałuże, odbicia i wyładowania.
Płatek to kwadrat `sizeM` stale pionowy (bez pochylenia), obracany wokół Y ku
kamerze, mieszanie zwykłe (nie addytywne), kolor materiału biały, kolor instancji
naprzemiennie `precipitation.color` (parzyste `i`) i `secondaryColor` (nieparzyste).
Płatki mają miękką okrągłą maskę alfa: `alfa *= 1 − smoothstep(krawędź − flakeSoftEdge, krawędź, |p|)`,
gdzie `p` = UV·2−1, krawędź = 1. Popiół ma dodatkowo krawędź postrzępioną
szumem: krawędź = `1 − ashEdgeRoughness * szum(p * ashEdgeFrequency)` (szum wartościowy
z haszem `fract(sin(dot(cell, (127,1; 311,7))) * 43758,5453)` i wygładzeniem
smoothstep). Płatki w odległości mniejszej niż 1,5 m od kamery
są ukrywane. Próg i parametry maski są w `tuning.weather`.

`surface.snowCoverage` (0..1, domyślnie 0) miesza kolor wierzchu z
`surface.snowColor`, zwiększa szorstkość do 1 i zmniejsza metaliczność.
Maska korzysta z dodatniej składowej Y normalnej świata: spody i ściany
pozostają bez śniegu. To minimalne przyprószenie bez geometrii i tekstur,
bez testu osłonięcia powierzchni przez dach. Profil snow ma pokrycie 0,6
i kolor `#9aa6bf`. Dwie próbki szumu w światowym XZ tworzą łaty
i wydłużone przetarcia, które odsłaniają ciemną nawierzchnię:
`pokrycie = snowCoverage * max(0, normalnaŚwiata.y) * smoothstep(snowMaskLow, snowMaskHigh, min(łata, przetarcie))`,
`łata = szum(xz * snowPatchFrequency)`,
`przetarcie = szum(xz * (snowWearFrequency * snowWearStretch, snowWearFrequency))`
(szum wartościowy, haszowany jak wyżej). Kolor wyjściowy = `mix(kolor, snowColor, pokrycie)`,
szorstkość = `mix(szorstkość, 1, pokrycie)`, metaliczność × `(1 − pokrycie)`.
Ta sama maska steruje barwą, szorstkością i metalicznością. Dotyczy tylko
standardowych materiałów miejskich (`urbanMaterials`).
Opcjonalny `sky.horizonColor` ustawia istniejącą łunę: snow `#344363`,
ashfall `#715632`. Powrót do starego profilu przywraca łunę motywu.
Śnieg ma cichy wiatr (gain 0,12); popiół wiatr 0,09 i istniejący niski
pomruk `generator` z gain 0,3. Nie dodano nowego syntezatora ani zasobów.

### Wyładowania i pył

Burza (`lightning.enabled`): czas pierwszego i kolejnych błysków losowany z
`[minIntervalS, maxIntervalS]` kosmetycznym `Rng`; w chwili błysku `flash =
brightness` (storm 1,4, czyli powyżej 1), potem liniowy zanik do 0 w `decayS`.
`tuning.render.skyFlash` = `flash` (bez skalowania), kolor
`lightning.color`; błysk działa tylko dla `dt > 0`. Stara ścieżka (bez profilu,
`theme.rain.storm`): błysk co krok z szansą `1 − exp(−dt * stormRate)`
(`stormRate` 0,025, średnio co ok. 40 s), wartość 1, zanik `stormFlashS` 0,35 s,
`skyFlash` = `flash * stormFlash` (0,35), kolor `tuning.weather.skyFlashColor`
(domyślnie `#9eadef`; kompozycja używa dla niego liczbowo (0,62; 0,68; 0,95)).

Pył (`dust`, gdy gęstość > 0, np. smog): osobna pula `tuning.weather.dustMax`
(240) billboardów „chmurki” (miękki radialny profil `pow(1 − r², 3)` z lekką falą
`0,8 + 0,2 sin(24 u + sin(18 v))`, mieszanie addytywne, alfa = `dust.opacity`,
jasność przez życie `sin(π * wiek/życie)`), emisja `dt * dustMax * density / lifeS`
cząstek na sekundę w tej samej objętości 28 × 14 × 28 m wokół kamery, rozmiar
`dust.sizeM`, prędkość pozioma = wiatr profilu (porywy też), bez pionowej; pył nie
zależy od `floorY` ani stref bez deszczu. Pula powstaje przy pierwszym profilu z
pyłem.

Koszt: ta sama pula 4000 instancji i jedno wywołanie rysowania opadu;
snow rysuje do 1520 płatków, ashfall do 1120 (przed mnożnikiem jakości).
Brak dodatkowej puli i alokacji na płatek; kolor naprzemienny wybiera shader z parzystości
indeksu. Kołysanie (sin/cos) i rozrzut płatka liczy shader wierzchołków; CPU nie
aktualizuje bufora kropli co klatkę (tylko uniformy). Shader miejski dodaje jeden interpolowany float,
transformację normalnej na wierzchołek oraz maskę max/mnożenie, dwa mix
(kolor, szorstkość) i mnożenie metaliczności na fragment, bez nowych próbek tekstur
i przebiegów. Maska śniegu dodaje dwie próbki szumu proceduralnego na fragment
z pokryciem. Maska płatka dodaje interpolowane UV i radialne wygładzanie alfa.
Tylko popiół liczy cztery hasze i interpoluje szum krawędzi.

Opad i efekty otoczenia kończą się na `weatherFloorY` pokoju (domyślnie
`playerSpawn.y`). Areny z ulicą pod dachami (`arenaRooftops`: −14 m) podają dno
ulicy, a bryły kamienic są strefami bez deszczu (`rainShelters`, patrz
[city.md](city.md#strefy-bez-deszczu-z21)), więc mżawka pada do ulicy,
a nie przez dachy.

## Mapowanie jakości i tryb lite

`tuning.quality.<low|medium|high>` (ustawienie jakości gracza) wpływa na pogodę
przez: `rainDensity` (0,25 / 0,5 / 1; mnoży `precipitation.density`, czyli liczbę
smug i płatków oraz budżet rozbryzgów), `particleDensity` (0,25 / 0,5 / 1; rzadsze
rysowanie wszystkich cząstek, w tym rozbryzgów i pyłu) i `maxLights` (2 / 4 / 8).
Pozostałe pola jakości (`pixelRatio`, `outline`, `bloom`, `bloomResolution`,
`reflections`, `heightFog`, `shadows`) opisuje [render.md](render.md). Tryb
`?debug=1&fx=lite` używa jakości `low` z `pixelRatio` 0,25, `rainDensity` 0 i
`particleDensity` 0: korzeń pogody jest niewidoczny, nowy `Weather` ani `AmbientFx`
nie powstają, `setWeather` nadal stosuje mgłę, połysk i audio.

## Integracja ze sceną

`CityDressing.setWeather(id)` nakłada profil na istniejący `Weather`, ustawienia
mgły/odbicia i wspólny uniform mokrości w `urbanMaterials`. Zwraca false dla
nieznanego id; nieznane `layout.weather` w konstruktorze rzuca wyjątek.
Pule opadu pozostają stałe; przełączenie czyści rozbryzgi i pył,
bez przebudowy pokoju, colliderów ani obiektów walki. Przy pierwszym wywołaniu
zapamiętywany jest stan do przywrócenia (`skyHorizon`, `fogColor`,
`heightFogDensity`, `heightFogFalloff`, `fogStrength`, `fogNear`, `fogFar`,
`reflectionStrength`, `reflectionPuddles`, `weatherGloss`, `snowCoverage`,
`snowColor`, `skyFlashColor`, audio). Wspólne limity smug i rozbryzgów pozostają
w `tuning.city`; nowe wspólne ustawienia są w `tuning.weather`, widocznym w GUI:
`flakeNearM` 1,5, `flakeSoftEdge` 0,24, `ashEdgeRoughness` 0,16,
`ashEdgeFrequency` 11, `snowPatchFrequency` 0,55, `snowWearFrequency` 1,8,
`snowWearStretch` 0,28, `snowMaskLow` 0,32, `snowMaskHigh` 0,62, `dustMax` 240,
`wetRoughnessScale` 0,45, `skyFlashColor` `#9eadef`.

Czas efektów pochodzi ze skumulowanych kroków świata. Pauza zatrzymuje opad,
porywy i wyładowania. Burza losuje następny odstęp przez kosmetyczny `Rng`,
niezależny od RNG symulacji (seed oprawy pokoju + `:rain`). Ustawienie
dostępności „błyski” nadal odcina błysk w kompozycji (`skyFlash` = 0). Stare sceny
nie otrzymują nowego profilu automatycznie ani nowego koloru błysku.

Warstwy audio wykorzystują `AmbienceSynth`: filtrowany szum i istniejącą
modulację głośności (LFO `ambienceLfoHz` 0,18 Hz razy losowo 0,7–1,3, głębokość
0,25; dobroć filtru 0,7). `rain` = szum, filtr górnoprzepustowy 2400 Hz; `wind` =
szum, dolnoprzepustowy 380 Hz; `generator` = piła 52 Hz, dolnoprzepustowy 190 Hz.
Głośność warstwy bierze się z `ambience[].gain` profilu (aktualizowana co klatkę),
a źródła podążają za kamerą (stała głośność, bez przesuwania panoramy).
Odblokowanie dźwięku po geście, głośność i pauza pozostają w AudioSystem.
Wyjście ze sceny zwalnia pule, czyści audio i przywraca poprzednią mgłę,
odbicia, kolor błysku oraz uniform połysku. Nie zmienia dźwięków kryjówki.
Tryb `fx=lite` nadal wyłącza kosztowne cząsteczki.

## Sprawdzenie w 30 sekund

Otwórz `?scene=weatherTest&debug=1`. To grywalny port z kolizjami i włączoną
nieśmiertelnością. Przyciski u góry kolejno przełączają wszystkie profile.
Po pierwszym kliknięciu powinien działać dźwięk. Porównaj smugi, kierunek wiatru,
pył, mgłę i połysk; `clearNight` nie może pokazywać opadu. Dla burzy poczekaj
do 13 s na ciepły błysk. Konsola: `weather <id>`, odczyt `query('weather')`.
Sprawdź także starą scenę `?scene=city-fx-test`: bez komend pogody jej wygląd
i komendy `rain`/`storm` pozostają takie jak wcześniej.

Dla nowych profili: kliknij „Śnieg” (lub `weather snow`), obejrzyj miękkie
płatki i matowe wierzchy z ciemnymi przetarciami. Podejdź do płatków
i sprawdź, czy znikają przy kamerze. Kliknij „Opad popiołu”
(lub `weather ashfall`): płatki powinny opadać wolniej i bardziej chaotycznie,
pod ciepłą łuną; słychać niski pomruk. W obu profilach brak kałuż i rozbryzgów.
Przełącz na rain: powinny wrócić smugi, kolor łuny i mokre powierzchnie.

Testy: `arenaWeather.test.ts` (schemat, profile, seed wyładowań, przywracanie
stanu), istniejące `cityFx`/`rainShelters` (regresja starego deszczu).
`tests/e2e/arenaWeather.spec.ts` sprawdza start portu i przełączanie siedmiu profili
bez błędów konsoli. GLSL, wygląd i odsłuch wymagają oceny w przeglądarce.
Dla profilu `kuroganeOfficeTower` z wysokim `panoramaDropM` (180 m) otwórz
`?scene=horizonTest&profile=kuroganeOfficeTower&debug=1` (przycisk profilu dostępny
także w pasku `?scene=weatherTest&debug=1` i `?scene=horizonTest&debug=1`).
