# Render — styl F1 #05

## Migotanie świateł i neonów

`src/render/city/flicker.ts`: czysta, bezalokacyjna funkcja
`flickerIntensity(pattern, t, seed, strength?, periodS?) → 0..1`. Statyczne
mieszanie bitów daje deterministyczny szum indeksowany czasem; źródła otrzymują
osobne ziarna przez `Rng.fork` z ziarna oprawy sceny. Czas jest sumą dodatnich
`dtRealS` z renderu, bez zegara systemowego i bez wpływu na symulację.

Format danych: `flicker: { pattern: 'buzz' | 'fail' | 'pulse', strength?: 0..1,
periodS?: liczba dodatnia }` w światłach, napisach i znakach stacji kryjówki.
Domyślne parametry w `tuning.city.flicker*` są dostępne w lil-gui.
Szczegóły wzorów i zgodność starszego formatu liczbowego: [city.md](city.md#wzory-migotania).

`CityLights` oddziela bazowe wygładzanie puli od mnożnika migotania, dzięki czemu
krótkie zaniki nie są wygładzane. Selekcja pozostaje oparta na jasności bazowej,
a czas źródła biegnie również poza pulą. `SignRenderer` mnoży emisję shadera,
halo i projektor. `HubDecor` mnoży kolor emisyjnego materiału napisu stacji.
Każdy napis ma własny materiał i zwalnia go ze swoim rendererem; materiały
współdzielone przez pozostałą oprawę nie są zmieniane.

`loadSettings().flashes` jest sprawdzane przy aktualizacji renderu: wyłącza
`buzz` i `fail` (stała jasność), pozostawia `pulse`. Debug:
`?scene=city-fx-test&seed=migotanie`; bursztyn/zieleń/fiolet pokazują kolejno
buzz/fail/pulse, widoczne w ciągu 30 s. Weryfikacja automatyczna:
`tests/unit/flicker.test.ts` (wzory, schematy, powrót lampy do puli, niezależne
materiały, podział czasu na klatki i przełączenie ustawień).

## Statyczna geometria pokoju (Z19)

`RoomScene` grupuje bloki, modele bloków GLB i dekoracje w osobnych korzeniach
`static-blocks`, `static-models`, `static-decor`. `batchStaticGeometry` scala je
jednorazowo przez `BufferGeometryUtils.mergeGeometries`, przed dodaniem oprawy
animowanej, hazardów i widoków walki. Drzwi pozostają poza tymi korzeniami.
Collidery Rapier nie są zmieniane.

Klucz grupy obejmuje tożsamość materiału, układ atrybutów i indeksowanie,
warstwę, kolejność renderowania, cienie, frustumCulled oraz metadane (bez nazwy
węzła GLB). Flagi `noOutline` i `bloom` rodziców są przenoszone na wynik.
Materiały pozostają tymi samymi obiektami, razem z `bloomMaterial`, wetness,
uniformami i późno ładowanymi teksturami. Pozycje i normalne są przekształcane
do przestrzeni korzenia; UV pozostają bez zmian. Rzuty miejskie i okna używają
pozycji świata, więc nie wymagają zmian shaderów. Różne układy atrybutów zostają
w osobnych partiach (alleyMarket: dwa zestawy geometrii modeli przy jednym materiale).

Nie są scalane przezroczystości (sortowanie), istniejące instancje, BatchedMesh, skinned/morph
meshe, obiekty ukryte, odbite transformacje, niestandardowe callbacki renderu,
customDepth/DistanceMaterial ani częściowe drawRange. Funkcja przyjmuje wyłącznie
statyczne poddrzewo; nie wolno jej wywoływać na całej aktywnej scenie.
InstancedMesh, SkinnedMesh i BatchedMesh są rozpoznawane po flagach `is*`,
nie po `type` (InstancedMesh w Three 0.187 ma `type === 'Mesh'`). Points i Line
odpadają przez warunek `instanceof Mesh`. Tablice materiałów pozostają osobno.
Test każdego wykluczenia używa pary zgodnych obiektów; dla instancji sprawdza
także światowe AABB, macierze, liczbę instancji i kolory.
Nowe geometrie należą do istniejącego zbioru zasobów pokoju i są zwalniane przy
dispose; geometrie i materiały szablonów GLB pozostają własnością cache.

Pomiar headless z prawdziwymi plikami GLB po `RoomScene.init()`, bez frustum i
renderera GPU (wlicza również niewidoczne pule, viewmodel i InstancedMesh jako
jeden obiekt):

| Pokój           | Mesh przed | Mesh po | Redukcja | Unikalne materiały przed/po |
| --------------- | ---------: | ------: | -------: | --------------------------: |
| alleyMarket     |       1683 |     156 |   10,79× |                   120 / 120 |
| combatWarehouse |        529 |     145 |    3,65× |                   101 / 101 |
| eliteFoundry    |        600 |     162 |    3,70× |                   109 / 109 |

`tests/unit/roomStaticBatch.test.ts` zawiera zapisane wartości bazowe i próg
co najmniej 3×, porównuje liczbę trójkątów, AABB i materiały przed/po scaleniu,
sprawdza też drzwi. `tests/unit/staticBatch.test.ts` sprawdza transformacje,
UV, flagi konturu/bloomu, warstwy, wykluczenia i własność zasobów.
Istniejących asercji wyglądu ani liczby meshy nie zmieniono.

Ograniczenia: to redukcja obiektów, nie pomiar GPU ani wszystkich wywołań potoku.
Scalone geometrie mają większe AABB, więc culling jest mniej dokładny; kopie
wierzchołków zużywają dodatkową pamięć względem współdzielonych szablonów.
Scalanie po materiale daje w tych pokojach mniej partii niż instancje według
każdej odrębnej geometrii GLB. Istniejące instancje panoramy i VFX pozostają.
Kontrola integratora: `?scene=room-test&room=alleyMarket` oraz dwa pozostałe
pokoje, jakość high; sprawdzić kontury, UV nadruków, okna, odbicia i zasłanianie
neonów po obu stronach ścian. W Z19 nie uruchamiano przeglądarki, buildu ani
profilera; identyczność obrazu i zysk GPU wymagają tej kontroli.

Kryjówka pozostaje bez zmian. Korzysta z tych samych loaderów GLB, więc podobne
scalanie jej statycznych brył/dekoracji powinno pomóc, po oddzieleniu terminali
i innych interakcji; nie zmierzono jej w tym zleceniu.

## Profile jakości (Z9)

`tuning.quality` zawiera komplet identycznych kluczy dla `low`, `medium`, `high`.
`applyQuality(profile, targets?)` w `src/render/quality.ts` wybiera ograniczenia
oprawy; z rendererem i pipeline aktualizuje też DPR, cienie i rozmiary celów.
`main.ts` stosuje zapis przed utworzeniem sceny oraz po zmianie ustawień.
Ekran ustawień wybiera profil również bez aktywnego renderera (menu główne).
Motyw i jego przywracanie nie nadpisują jakości: pipeline odczytuje ograniczenia
oddzielnie, nie zmieniając wartości `tuning.render`.

| Klucz `quality`   | low              | medium | high               | Koszt / decyzja                                                                                                                                                           |
| ----------------- | ---------------- | ------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pixelRatio`      | 0,75             | 1      | 0 = DPR urządzenia | Koszt pikseli rośnie kwadratowo; high zachowuje wcześniejsze pełne DPR, bez nowego limitu 2                                                                               |
| `outline`         | 0                | 1      | 1                  | Kolor + normalne/głębia + kompozycja: 3 przebiegi; low korzysta ze zwykłego renderu                                                                                       |
| `bloom`           | 0                | 1      | 1                  | Maska sceny i 4 rozmycia; low pomija wszystkie                                                                                                                            |
| `bloomResolution` | 0,5 (nieaktywny) | 0,5    | 1                  | Mnożnik rozdzielczości: medium maska 1/4 bufora, rozmycia 1/8; high jak wcześniej 1/2 i 1/4                                                                               |
| `reflections`     | 0                | 0      | 1                  | Odbita scena emisyjna + 2 rozmycia w 1/2; medium usuwa 3 przebiegi                                                                                                        |
| `maxLights`       | 2                | 4      | 8                  | Limit dodatkowy dla `city.maxLights`; nieaktywne światła są niewidoczne, a nie tylko wyzerowane (mniej świateł w shaderach Standard)                                      |
| `rainDensity`     | 0,25             | 0,5    | 1                  | Mnożnik gęstości motywu w `CityDressing.render`; mniej smug i rozbryzgów, pula deszczu nadal ma do 4000 miejsc                                                            |
| `particleDensity` | 0,25             | 0,5    | 1                  | Rysowany ułamek aktywnych cząsteczek `CityParticleBatch`: para, iskry, kapanie i rozbryzgi; mniejszy overdraw i mniej aktualizacji macierzy, pule CPU pozostają bez zmian |
| `heightFog`       | 0                | 1      | 1                  | Mnożnik gęstości mgły wysokościowej; obliczenia wykładnicze w kompozycji, bez dodatkowego przebiegu                                                                       |
| `shadows`         | 0                | 0      | 0                  | Dynamiczne cienie były i pozostają wyłączone                                                                                                                              |

W `low` wyłączenie `outline` zgodnie z dotychczasową semantyką omija cały
pipeline stylu, także gradient nieba, mgłę odległości, winietę i impulsy postFx.
Materiały, oświetlenie, geometria i viewmodel nadal są rysowane. W `medium`
zostają kontury, atmosfera i impulsy, a koszt maleje dzięki DPR, bloomowi,
światłom i wyłączeniu odbić. Bez viewmodelu i impulsu neonStreet ma odpowiednio
1 / 8 / 11 przebiegów. Są to koszty strukturalne, nie wyniki pomiaru FPS.

Wszystkie zmiany działają na żywo, także podczas pauzy; deszcz zachowuje bazową
gęstość motywu, a ograniczenie stosuje tylko na czas aktualizacji oprawy.
Notka w ustawieniach pochodzi z `settings.pl.json`:
„Zmiany jakości są stosowane na bieżąco.” Zmiana rozdzielczości bloomu działa także
przy niezmienionym DPR. Bufory nieaktywnych efektów pozostają do ponownego użycia
i są zwalniane w `dispose()` pipeline. Zmiana liczby widocznych świateł może
spowodować jednorazową kompilację wariantu shadera.

Brak zapisu ustawień oznacza `medium`. Istniejące `high` oraz starszy zapis bez
pola jakości zachowują `high`. `tests/unit/quality.test.ts` sprawdza profile na
atrapie WebGLRenderer, przebiegi i rozdzielczości, powrót low → high, motywy,
oprawę miasta i zachowanie zapisu.

Pomiar architekta: `PERF_QUALITY=low|medium|high` dla `tests/e2e/perf.spec.ts`
(domyślnie `high`). Test ustawia localStorage przed nawigacją, odrzuca nieznany
profil i dopisuje `quality` do `perf-report/arena.json` oraz załącznika testu.
Cel 60 FPS na średnim laptopie dla `medium` wymaga pomiaru na docelowym GPU.
Kontrola ręczna: w `?scene=neon-test` zmienić jakość w ustawieniach pauzy,
porównać kontury, bloom, odbicia, światła i gęstość deszczu.
Powrót do `high` powinien przywrócić wygląd sprzed Z9.

Warstwa `src/render/` nie uczestniczy w symulacji. Materiały i obrys służą szybkiej
identyfikacji roli obiektu: białe otoczenie, czerwone zagrożenia, czarne rekwizyty,
cyan dla gracza i magenta dla Rezonansu.

## Profilowanie

Profiler Z14 (`src/render/frameProfiler.ts`) istnieje tylko w trybie debug
(`?debug=1` lub serwer dev) i domyślnie jest wyłączony. W konsoli gry:
`profile on` / `profile off`. Odczyt w konsoli przeglądarki:
`window.__neoryder.query('frameProfile')`. Ponowne `on` po `off` zeruje okno;
`off` zachowuje ostatnie średnie. Odczyt zwraca współdzielony bufor raportu;
do zachowania stanu użyć `structuredClone(...)`.

`query('renderInfo')` (`src/render/renderInfo.ts`, tylko debug) zwraca
`{ calls, triangles, geometries, textures }` z `renderer.info` za całą ostatnią klatkę (wszystkie
przebiegi pipeline'u). Sonda wyłącza `info.autoReset` i zeruje liczniki przed pipeline'em, więc nie
pokazuje tylko ostatniego przebiegu; profiler odczytuje liczniki po niej.

### Rozbiór wywołań rysowania kryjówki (hala, `hub tp 0 2 0 -5`)

Domyślny preset to `medium` (kontur + bloom, bez odbić); headless SwiftShader używa zapisu jakości z
localStorage (`neoryder.settings.quality`), więc preset wymusza się zapisem tego klucza przed
załadowaniem strony. Rozbiór zrobiono jednorazowym opakowaniem `renderer.renderBufferDirect`
(liczenie po przebiegu i korzeniu sceny; narzędzia nie zostawiono w repozytorium).

| Przebieg (hala)                          | low | medium | high |
| ---------------------------------------- | --: | -----: | ---: |
| kolor (+ viewmodel 15)                   | 421 |    426 |  426 |
| normalne/kontur (+ viewmodel 12)         |   — |    282 |  282 |
| maska bloomu (+ viewmodel 15)            |   — |    104 |  104 |
| maska odbić (kamera lustrzana, wszystko) |   — |      — |  357 |
| razem (`renderInfo.calls`)               | 421 |    815 | 1173 |

Źródła w przebiegu koloru medium (ok. 412 bez rąk): NPC i akcesoria na kościach 149 (nie da się scalić
statycznie; po ~8–17 wywołań na NPC, każdy z własnymi materiałami kurtki/stroju/akcentu), scalone statyczne
bryły/modele/dekoracje 162, rekwizyty i plakaty HubDecor 37, światła/stożki/plamy CityDressing ok. 50
(osobny materiał na źródło, przezroczyste, `noOutline`: tylko kolor), ręce i ostrze 15. Kontur rysuje
statyczne komórki i NPC (pomija `noOutline`), bloom tylko emisję (akcenty NPC, neony).

Zmiana (bez zmiany wyglądu, zrzuty identyczne): (1) bryły, modele i dekoracje kryjówki scala jedno wywołanie
`batchStaticGeometry` na wspólnym korzeniu `static-world` (ten sam materiał z różnych korzeni daje jedną
siatkę na komórkę); (2) `HUB_BATCH_CELL_M` 10 → 20 m (dotyczy też okładzin HubDecor). Koszt: mniej dokładny
culling, więcej trójkątów (hala +9%, peron B +26%).

| Miejsce (medium) | calls przed | calls po | trójkąty przed → po |
| ---------------- | ----------: | -------: | ------------------: |
| hala             |         815 |      656 |         171k → 187k |
| peron B          |         304 |      279 |           75k → 95k |
| jadłodajnia      |         236 |      222 |          92k → 100k |

Większe przebudowy (nie wykonane): scalanie akcesoriów NPC per kość i materiał (ok. −40% wywołań akcesoriów, w hali rzędu −100 we wszystkich przebiegach, wymaga zmiany testów liczących akcesoria i własnej geometrii do zwolnienia); udostępnienie
materiału stroju między NPC (bez scalania nic nie daje); instancje/atlas dla plakatów HubDecor (ok. −30);
jeden materiał z atrybutem na światła/stożki CityDressing (ok. −40, zmiana shaderów); maska odbić w high
rysuje całą scenę ponownie (357): ograniczenie do obiektów w zasięgu odbić dałoby do −250 w high.

Pomiar architekta na działającym serwerze (osobny skrypt Node + Playwright,
bez uruchamiania testów ani budowania aplikacji):

```powershell
node tools/perf/profile.mjs --url http://127.0.0.1:5173 --scene room-test --room alleyMarket --quality medium --seconds 10
```

Wszystkie argumenty są opcjonalne; powyżej pokazano domyślne wartości.
Chromium używa `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`,
widoku 1280×720 i DPR 1. Skrypt ustawia `neoryder.settings.quality` przed
załadowaniem aplikacji, zachowuje pozostałe parametry podanego URL (domyślny
`loadout=gunner`, `seed=frame-profile`), próbuje włączyć `god`, czeka 3 s na
rozgrzewkę, a następnie włącza profiler na zadany czas. Zapisuje
`perf-report/profile-<scena>-<jakosc>.json` i tabelę etap → CPU ms / GPU ms.
Kolejny pomiar tej samej sceny i jakości nadpisuje plik, także przy innym pokoju.
JSON zawiera pokój, jakość, URL, GPU/sterownik, FPS z całego okresu, tick przed/po,
liczbę wrogów, wynik `god`, błędy strony i ostatnie średnie profilera.

| Etap                                                                    | Miejsce pomiaru / zakres                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `step`                                                                  | `main.ts`: suma wszystkich `scene.step()` wraz z pobraniem wejścia w jednej klatce; podczas pauzy 0    |
| `sceneRender`                                                           | `main.ts`: aktualizacja stanu wizualnego `scene.render(alpha, frameDt)`                                |
| `city`                                                                  | `city/dressing.ts`: napisy, światła, stożki, naklejki, cząsteczki i pogoda/deszcz; część `sceneRender` |
| `pipeline`                                                              | `main.ts`: całe `pipeline.render()`, łącznie z przygotowaniem i przywróceniem stanu                    |
| `color`                                                                 | `outline.ts`: kolor świata i viewmodelu; w low zwykły render                                           |
| `normals`                                                               | `outline.ts`: normalne/głębia (również wariant mokrych materiałów) i viewmodel                         |
| `reflections`                                                           | `reflections.ts`: przygotowanie odbitej kamery, maska emisji i rozmycia                                |
| `reflectionMask`, `reflectionBlurX`, `reflectionBlurY`                  | `bloom.ts` / `fullscreen.ts`: maska odbicia i dwa rozmycia                                             |
| `bloom`                                                                 | `bloom.ts`: cały bloom selektywny                                                                      |
| `bloomMask`, `bloomBlurX1`, `bloomBlurY1`, `bloomBlurX2`, `bloomBlurY2` | `bloom.ts` / `fullscreen.ts`: maska i cztery osobne rozmycia                                           |
| `composite`                                                             | `outline.ts` / `fullscreen.ts`: kontur, atmosfera, mgła, odbicia, bloom i winieta w jednym shaderze    |
| `postFx`                                                                | `postFx.ts` / `fullscreen.ts`: dodatkowy przebieg aktywnego impulsu                                    |

`stages.<etap>.cpuMs` to czas wywołań na CPU (`performance.now()`), a `gpuMs`
to czas GPU z `EXT_disjoint_timer_query_webgl2`, w ms. GPU nie jest czasem
obliczeń JS: `step`, `sceneRender` i `city` zwykle nie wysyłają rysowania,
więc ich GPU będzie bliskie zeru; koszt rysowania deszczu jest w przebiegach
geometrii. CPU zawiera wysyłanie poleceń do sterownika i może zawierać jego
oczekiwanie. CPU i GPU działają częściowo równolegle — nie sumować ich do FPS.
Etapy nadrzędne obejmują dzieci: nie dodawać `pipeline` do przebiegów ani `city`
do `sceneRender`. Mgła, światła i przezroczystości nie mają osobnych przebiegów;
ich wpływ porównuje się przez zmianę parametrów i pomiar właściwych etapów.

Raport obejmuje ostatnie maksymalnie **120 klatek**, także zera dla pominiętych
efektów. `window` = 120, `frames` = bieżąca liczba klatek w oknie, `totalFrames`
= liczba od włączenia; `frameMs` jest średnią odstępów klatek (obejmuje vsync
i czas poza mierzonymi zakresami). `gpuAvailable` oznacza dostępność rozszerzenia;
`gpuFrames` to liczba kompletnych, poprawnych klatek GPU w tym samym oknie.
GPU odczytywane jest dopiero po `QUERY_RESULT_AVAILABLE`, bez `finish()` i
blokowania CPU. `null` oznacza brak rozszerzenia albo brak kompletnych, poprawnych
wyników; nie oznacza zera. `disjoint` lub utrata kontekstu unieważnia wyniki GPU.
Zagnieżdżone zakresy dzielą zapytania na rozłączne odcinki i przypisują ich sumy
także rodzicom, bez zagnieżdżania `TIME_ELAPSED_EXT`. Pula ma limit 2048 zapytań;
jej wyczerpanie pomija GPU danej klatki, a CPU nadal jest raportowane.

`counters` zawiera średnie na klatkę: `calls` i `triangles` z **całego** potoku
(wliczając przebiegi pomocnicze i fullscreen), `lights` = widoczne światła w drzewie
sceny, `programs` = liczba programów shaderów w cache renderera, `transparent` =
widoczne obiekty mające co najmniej jeden widoczny materiał z `transparent=true`
(tablica materiałów nie mnoży obiektów, `InstancedMesh` liczy się jako jeden).
Widoczność oznacza `visible` obiektu i rodziców, bez testu frustum czy okluzji.
Profiler tymczasowo wyłącza `renderer.info.autoReset`, zeruje liczniki po klatce
i przywraca poprzednią wartość po wyłączeniu. Gdy wyłączony, pomiary kończą się
na sprawdzeniu flagi: bez odczytów zegara, GL, przechodzenia po scenie i alokacji
na ścieżce profilera. Włączony profiler ma własny narzut pomiaru i raportowania.

## Paleta i materiały

Źródłem bieżących kolorów jest `tuning.render`. `palette.ts` pozostaje paletą
bazową starszych scen i tła. Panel lil-gui pokazuje liczby oraz pola hex przez
`addColor`.

| Nazwa w glTF        | MaterialKind  | Domyślny kolor | Materiał          |
| ------------------- | ------------- | -------------- | ----------------- |
| `mat_world`         | `world`       | `#ffffff`      | MeshToonMaterial  |
| `mat_enemy`         | `enemy`       | `#e0262b`      | MeshToonMaterial  |
| `mat_interactive`   | `interactive` | `#080808`      | MeshToonMaterial  |
| `mat_enemy_glow`    | `enemyGlow`   | `#ff5050`      | MeshBasicMaterial |
| `mat_player_cyan`   | `player`      | `#00e5ff`      | MeshBasicMaterial |
| `mat_power_magenta` | `power`       | `#ff2bd6`      | MeshBasicMaterial |

`getMaterial(kind)` zwraca współdzieloną instancję z cache; nieznany rodzaj rzuca
`Error`. Trzy materiały toon współdzielą `DataTexture` 3×1 z progami 150, 200, 255,
filtrem `NearestFilter` i bez mipmap. Płaskie normalne pochodzą z modeli low-poly.
Neony są unlit i mają `toneMapped = false`. Materiały `enemyGlow`, `player` i `power`
mają `userData.bloom = true` (klony też), dzięki czemu świecą w bloomie selektywnym.
Materiał `world` ma w `onBeforeCompile` siatkę płytek podłogi (patrz niżej).

`applyStyle(root)` przechodzi po wszystkich `Mesh` (także `InstancedMesh`), obsługuje
tablice materiałów i zachowuje geometrię. Nieznana nazwa dostaje `world` oraz
`console.warn` raz na nazwę w czasie życia aplikacji. Kolejne wywołanie jest
bezpieczne: materiały rejestru zachowują nazwy `mat_*`. Funkcja nie niszczy
materiałów źródłowych, ponieważ mogą należeć do innych użytkowników modelu.
Właściciel załadowanego modelu zwalnia je po podmianie, jeśli nie są już potrzebne.
Sceny nie zwalniają współdzielonych materiałów ani ich mapy gradientowej.

`syncMaterials()` czyta kolory z `tuning.render` co klatkę i aktualizuje istniejące
instancje. Wywołuje ją pipeline (również z wyłączonym obrysem), a scena testowa
robi to dodatkowo, aby paleta działała przed integracją pipeline. Wybrano odczyt
co klatkę zamiast `onChange`: reaguje również na zmiany programowe bez zależności
od panelu debug.

## Oświetlenie

`createStyleLights()` z `src/render/lights.ts` zwraca grupę z `HemisphereLight`
i ukośnym `DirectionalLight` z góry. Dodaj ją do sceny i wywołuj `lights.sync()`
w jej `render()`. Intensywności czytane są z `hemiIntensity` i `keyIntensity`.
Górne powierzchnie są prawie białe, boczne jaśniejszym odcieniem szarości.

Motyw `neonStreet` (poprawka oświetlenia): `hemiIntensity` 1,35 (ciemne partie czytelne, bryły i przejścia widoczne), `bloomStrength` 0,65 i `bloomRadius` 1,2 (neony świecą bez mlecznej mgiełki na całym kadrze). Światło dynamiczne i poświata neonów, hologramów i latarni: `docs/systems/city.md`, sekcja „Ocena świateł”; parametry w `tuning.city` (widoczne w lil-gui).
Domyślny renderer używa `NoToneMapping`; zachowaj to ustawienie, aby oba tryby
obrysu dawały tę samą paletę. Dynamiczne cienie pozostają wyłączone.

## Pipeline stylu

`StylePipeline` / `createRenderPipeline(renderer)` z `src/render/outline.ts`
nie wymagają EffectComposer. Pełny przebieg (każdy pass pomijany, gdy wyłączony):

1. Render koloru do celu liniowego HalfFloat z teksturą głębi (pełna rozdzielczość bufora).
2. Render geometrii z `scene.overrideMaterial = MeshNormalMaterial` i teksturą
   głębi. Tło jest pomijane w tym przebiegu.
   Obiekty z `userData.noOutline = true` (efekty, przezroczyste quady oprawy) są w tym
   przebiegu ukryte, więc nie dostają obrysu; bloom i odbicia nadal je rysują.
3. **Bloom selektywny** (`bloom = 1` i `bloomStrength > 0`; `bloom.ts`): maska w 1/2
   rozdzielczości, w której kolor mają tylko materiały emisyjne (flaga
   `userData.bloom`, albo nasycony materiał unlit bez flagi; `userData.bloom = false`
   wyłącza), oraz `userData.bloomMaterial`. Nieemisyjne materiały świata są pomijane
   bez wywołań rysowania; zasłanianie zapewnia tekstura głębi koloru (Z20 poniżej).
   Dotyczy to także nieemisyjnego deszczu, pary, poświat, linii, punktów i sprite'ów.
   Viewmodel oraz odbicia zachowują poprzednią maskę z własnymi zasłonami.
   Potem 4 przebiegi rozmycia Gaussa w 1/4 rozdzielczości
   (dwa o promieniu `bloomRadius`, dwa 2,5 raza szersze).
4. **Kompozycja** (pełny ekran, jeden shader): Sobel 3×3 na normalnych i głębi, niebo,
   mgła, kontur, bloom, winieta, konwersja do przestrzeni wyjściowej.
5. **Pass impulsów** (`postFx = 1` i aktywny impuls; `postFx.ts`): aberracja
   chromatyczna, czerwone krawędzie, odcień i desaturacja Skupienia. Pomijany, gdy
   `damage` i `focus` wynoszą 0, więc w stanie spoczynku kosztu nie ma (kompozycja
   rysuje wtedy prosto na ekran).

Biały świat się nie rozmywa: bloom nie jest progiem jasności, lecz maską emisyjną
nakładaną metodą "over" (`kolor * (1 - pokrycie) + halo`), co daje widoczne halo także na bieli.

### Z20 — selektywna maska z głębią koloru

`StylePipeline` przekazuje cel koloru do `BloomPass.render`. Maska świata zachowuje
swoją rozdzielczość (high: 1/2 bufora, medium: 1/4). Materiały emisyjne mają
`depthTest=true`, `depthWrite=false`, a ich shader odrzuca fragment za głębią
koloru. Nie współdzielimy bufora głębi o innym rozmiarze: porównanie korzysta z
tekstury `DepthTexture` koloru, nie z uproszczonego przebiegu normalnych.
Porównanie obejmuje cztery próbki w środkach ćwiartek teksela maski
(przesunięcia ±0,25 teksela w obu osiach), zaokrąglone do środków tekseli koloru.
Fragment pozostaje widoczny, jeśli choć jedna próbka przejdzie porównanie.
Próbki nie wychodzą poza pokrycie teksela maski; nie zwiększamy tolerancji,
więc pełna zasłona o szerokości co najmniej jednego teksela nadal blokuje emisję.
Pochodne głębi przeliczają powierzchnię do każdej próbki osobno. Tolerancja to dwa
kroki kwantyzacji 24-bitowej głębi, niezależnie od odległości kamery.
`bloomDepthVisible` to czysty model TS z atrapą odczytu głębi. Wspólne pozycje
próbek i tolerancja generują GLSL; test shadera pilnuje czterech odczytów,
przeliczenia głębi i alternatywy porównań. Testy obejmują każdą ćwiartkę,
pełną zasłonę, rozdzielczości 2×/4× i nieparzyste oraz nachylone powierzchnie.

Selekcja odczytuje materiały co klatkę na CPU, więc reaguje na przełączanie
`userData.bloom` (np. zagrożenia), kolory unlit, wymianę materiału i dodawanie lub
usuwanie obiektów. Używa ponownie tablic roboczych i tablic grup materiałów;
wariant shadera powstaje przy pierwszym użyciu materiału. Nie trzeba zmieniać
warstw w oprawie miasta. Niewidoczny materiał zastępczy pomija wywołanie rysowania
bez ukrywania emisyjnych dzieci nieemisyjnego rodzica. Instancje i grupy materiałów
zachowują dotychczasową geometrię. Wariant zachowuje mapy, alphaTest, blending,
uniformy i `onBeforeCompile` emisji (w tym proceduralne okna fasad). Warianty
zwalnia zarówno `dispose()` źródła, jak i pipeline; teksturę głębi koloru zwalnia
pipeline. Materiały źródłowe pozostają własnością sceny.

Warstwa viewmodelu nadal używa oryginalnych materiałów emisji, czarnych zasłon,
własnego zapisu głębi i `renderWithViewmodel` ze ściśniętą projekcją. Odbicia nadal
rysują emisję i nieprzezroczyste zasłony z odbitej kamery; głębia gracza nie jest
tam poprawna. Wywołanie `BloomPass` bez celu koloru zachowuje starszy tryb z
zasłonami. Profile jakości i etapy profilera (`bloomMask`, `reflectionMask`) są
bez zmian. Nie deklarujemy przyspieszenia odbić w tym zleceniu.

Testy atrap: `bloomDepth.test.ts`, `renderPostFx.test.ts`; regresje dotychczasowych
masek i jakości: `cityGlowOcclusion.test.ts`, `renderFixes.test.ts`, `quality.test.ts`.
Nie zastępują kompilacji shaderów ani porównania obrazu na GPU.

Do porównania przez architekta w `room-test` / `alleyMarket` (high i medium):

- neony za ścianą i przy jej krawędzi, cienkie przewody oraz ukośne powierzchnie:
  rozdzielczość próbkowania głębi jest teraz większa od rozdzielczości maski;
- napisy i wycięcia alfa, proceduralne okna, powierzchnie z polygon offset:
  zgodność pokrycia i głębi źródłowego shadera z maską;
- hologramy, nakładające się neony i przezroczystości: kolor respektuje rzeczywiste
  `depthWrite` i alphaTest. Dawne czarne zasłony upraszczały te własności. Szczególnie
  przezroczysty, nieemisyjny materiał z `depthWrite=true` może teraz zasłonić bloom;
- ręce i broń na tle neonów: kolor zawiera ich ściśniętą głębię, a maska nadal
  rysuje viewmodel osobno;
- migające zagrożenia i przełączenia jakości oraz rozmiaru okna.

Pomiar i zrzuty wykonuje architekt. Próg kosztu bloomu: `bloomMask <= 2,35 ms`
w warunkach pomiaru bazowego 4,7 ms. Odbicia pozostają do pomiaru razem ze zmianą
scalania geometrii: ta zmiana nie gwarantuje spadku `reflectionMask` o połowę.

Głębia jest linearyzowana według typu kamery (perspektywiczna lub ortograficzna).
Próg głębi dotyczy różnicy względem odległości środka próbki, co ogranicza zależność
od odległości kamery. Gradienty Sobela są dzielone przez 8. Grubość jest odstępem
próbek w pikselach bufora GPU (nie CSS), a kolor pochodzi z `outlineColor`.
`outlineDepthThreshold` i `outlineNormalThreshold` regulują wykrywanie krawędzi;
wyższy próg usuwa drobniejsze krawędzie. `outlineThickness = 0` ukrywa linię.
Kontur zależy od odległości piksela od kamery (czytelność dalekich wrogów, ADR 0006 pkt 3):
między `outlineFadeNear` a `outlineFadeFar` (m) linie wewnątrz bryły (krawędzie normalnych)
słabną do `outlineFarNormal` (0 = znikają), a obrys sylwetki (krawędź głębi) w ułamku
`outlineFarOuter` rysuje się tylko na pikselach tła (dalszych od sąsiada o próg głębi).
Bliżej niż `outlineFadeNear` kontur jest taki jak wcześniej; dalecy wrogowie zostają
czerwonymi bryłami z cienkim obrysem zamiast ciemnych plam z linii na kończynach.
`outlineFarNormal = 1` i `outlineFarOuter = 0` przywracają kontur niezależny od odległości.
**`outline = 0` omija cały pipeline stylu** (zwykły `renderer.render`, bez mgły, gradientu,
bloomu i postFx; materiały nadal się synchronizują, a siatka podłogi działa).

### Atmosfera i głębia

Liczone w shaderze kompozycji na podstawie bufora głębi (nie `scene.fog`):

- **Niebo**: piksele bez geometrii (głębia 1) dostają pionowy gradient od `skyHorizon`
  (przy horyzoncie) do `skyTop` (według kierunku patrzenia kamery; wysokość przejścia
  `skyGradientHeight`, w jednostkach składowej Y kierunku). `skyGradient = 0` zostawia
  tło sceny.
- **Mgła odległości**: `smoothstep(fogNear, fogFar, głębia) * fogStrength` ku `fogColor`;
  ta sama wartość rozjaśnia też kolor konturu, więc dalekie linie bledną.
  `fogStrength = 0` wyłącza.
- **Siatka podłogi** (`materials.ts`, `onBeforeCompile` materiału `world`): linie co
  `gridSize` m w przestrzeni świata, tylko na powierzchniach poziomych (normalna z
  pochodnych pozycji, działa z `InstancedMesh`), kontrast `gridContrast` (0 = brak),
  grubość `gridLineWidth` px, zanik przy zbyt gęstych płytkach (moiré).

### Kompozycja końcowa i impulsy

Stan (`PostFxState`, bez GPU, czas rzeczywisty klatki, więc hitstop i slowmo go nie
rozciągają):

- `damage` 0..1: spadek HP gracza (`health_changed` encji z `entity_spawned` kind
  `player`) ustawia `max(damage, damagePulseMin + udział_utraconego_HP * damagePulseHpGain)`,
  zbity do 1; potem liniowo maleje do 0 w `damagePulseS`. Leczenie i pierwszy odczyt
  HP nie wywołują impulsu.
- `focus` 0..1: zdarzenie `focus` z `durationS > 0` włącza (narastanie `focusFadeInS`),
  `durationS = 0` wyłącza (zanik `focusFadeOutS`); koniec naturalny i reset emitują
  `focus { durationS: 0 }` (patrz `api.md`), więc timer po stronie renderu nie jest potrzebny.

Efekt: aberracja `damageAberration` (rośnie od środka ku krawędziom), czerwony odcień
krawędzi `damageTint` w kolorze `damageTintColor`, dla Skupienia mieszanie z
`focusTintColor` siłą `focusTint` i desaturacja `focusDesaturate`. Winieta
(`vignetteStrength`, `vignetteRadius`, `vignetteSoftness`) działa w kompozycji, więc
nie dodaje passu. `postFx = 0` wyłącza winietę i impulsy.

`bindEvents(bus)` podpina zdarzenia (wywołane w `main.ts` zaraz po utworzeniu busa;
odpina je `dispose()`). `fxState` daje bezpośredni dostęp do stanu; komenda konsoli
debug `fx <damage|focus|off>` uruchamia impulsy do oceny wizualnej.

### Parametry `tuning.render`

| Pole                                                       | Domyślnie                    | Znaczenie                                                  |
| ---------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| `bloom`, `postFx`                                          | 1, 1                         | przełączniki jakości (0 pomija pass)                       |
| `bloomStrength`, `bloomRadius`                             | 0,6, 1,2                     | siła halo, mnożnik odstępu próbek rozmycia                 |
| `skyGradient`, `skyTop`, `skyHorizon`, `skyGradientHeight` | 1, `#ffffff`, `#e3e7ea`, 0,5 | gradient nieba                                             |
| `fogStrength`, `fogColor`, `fogNear`, `fogFar`             | 0,85, `#eef1f3`, 14, 80      | mgła odległości (m)                                        |
| `skyFlash`                                                 | 0                            | błysk burzy: dodatek do nieba i mgły (0..1), ustawia scena |
| `viewmodelDepth`                                           | 0,01                         | ułamek zakresu głębi dla rąk i przedmiotu                  |
| `gridSize`, `gridContrast`, `gridLineWidth`                | 2, 0,1, 1                    | siatka podłogi (m, 0..1, px)                               |
| `vignetteStrength`, `vignetteRadius`, `vignetteSoftness`   | 0,2, 0,55, 0,6               | winieta                                                    |
| `damagePulseS`, `damagePulseMin`, `damagePulseHpGain`      | 0,4, 0,35, 2                 | czas i siła impulsu obrażeń                                |
| `damageAberration`, `damageTint`, `damageTintColor`        | 0,018, 0,5, `#ff1a2a`        | aberracja i czerwień krawędzi                              |
| `focusTint`, `focusTintColor`, `focusDesaturate`           | 0,14, `#ff2bd6`, 0,3         | Skupienie                                                  |
| `focusFadeInS`, `focusFadeOutS`                            | 0,15, 0,35                   | narastanie i zanik Skupienia                               |

### Viewmodel zawsze na wierzchu

Ręce i trzymany przedmiot (`FppViewModel`) leżą na warstwie `VIEWMODEL_LAYER` (1)
Three.js (`src/render/viewmodelLayer.ts`). `renderWithViewmodel` rysuje świat (warstwa 0),
a potem, tylko gdy istnieje jakiś viewmodel, drugi przebieg warstwy 1 tym samym celem bez
czyszczenia, z macierzą projekcji kamery ściskającą głębię do pierwszych
`viewmodelDepth` zakresu bufora. Dzięki temu viewmodel nie przenika ścian, osłon ani wrogów,
a między swoimi elementami zachowuje poprawną głębię. Przebieg jest używany w trzech
miejscach: kolor, normalne/głębia (obrys) i maska bloomu, więc obrys i bloom rąk działają.
Shader obrysu przywraca pełny zakres głębi pikseli viewmodelu (`depth / viewmodelDepth`).
Światła dostają warstwę 1 w tym przebiegu (Three zbiera światła wg maski warstw kamery).

### Koszt

Pomiar w Chromium z SwiftShader (render programowy na CPU, `?scene=arena&loadout=classic`,
1280×720, kolejne konfiguracje w jednej sesji; środowisko zaszumione, ±10 ms): zwykły render
(`outline = 0`) ok. 18 ms; obrys bez dodatków (odpowiednik poprzedniego pipeline'u) ok.
52-65 ms; atmosfera (niebo + mgła) +3-8 ms; bloom +10-15 ms (maska to druga scena, ale w
1/4 pikseli); winieta w kompozycji praktycznie bez kosztu; pass impulsów działa tylko
podczas impulsu (jeden pełnoekranowy pass HalfFloat); wszystko razem ok. 65-85 ms. Wartości
absolutne na CPU nie przekładają się na GPU, ale proporcje pokazują, że bloom jest
najdroższym dodatkiem: na słabym sprzęcie ustaw `bloom = 0`, potem `postFx = 0`.
Cele pośrednie bloomu i passu impulsów są tworzone przy pierwszym użyciu i zmieniają
rozmiar razem z oknem.

`setSize(w, h)` przyjmuje rozmiar CSS i uwzględnia aktualne DPR renderera.
Pipeline wykrywa też zmianę rozmiaru bufora przy renderowaniu. Stan tła,
overrideMaterial, celu, autoClear i koloru czyszczenia jest przywracany także
przy błędzie. `dispose()` zwalnia cele (także bloomu i impulsów), teksturę głębi,
materiały shaderów, geometrię pełnoekranową i subskrypcje zdarzeń.
Wydajność na słabym GPU i czytelność w 0,2 s wymagają oceny człowieka.

## Integracja w main.ts (po stronie Architekta)

1. Importuj `createRenderPipeline` z `./render/outline`.
2. Po skonfigurowaniu renderera utwórz jedną instancję:
   `const pipeline = createRenderPipeline(renderer);`.
3. W callbacku renderowania zachowaj `scene.render(alpha)`, a następnie zamiast
   `renderer.render(three, camera)` wywołaj `pipeline.render(three, camera, frameDt)`
   (`frameDt` to czas rzeczywisty klatki w s). Po utworzeniu `EventBus` wywołaj
   `pipeline.bindEvents(bus)`.
4. W `resize`, po `renderer.setSize(window.innerWidth, window.innerHeight)`, wywołaj
   `pipeline.setSize(window.innerWidth, window.innerHeight)`.
5. W zamykaniu aplikacji wywołaj `pipeline.dispose()` przed `renderer.dispose()`.
6. W `src/scenes/index.ts` importuj `StyleTest` z `./styleTest` i dopisz
   `'style-test': () => new StyleTest()`.

Pliki `main.ts` i rejestr scen pozostają do integracji przez Architekta.
Pipeline nie dodaje świateł do scen automatycznie: nowe sceny powinny używać
`createStyleLights()`; `StyleTest` już to robi.

## Dodawanie obiektu

W Blenderze przypisz materiał `mat_*` z tabeli (katalog: `docs/assets.md`), załaduj
GLB i wywołaj `applyStyle(gltf.scene)` przed dodaniem do sceny. Bryłom proceduralnym
przypisz `getMaterial(kind)`. Nie twórz lokalnych wariantów kolorystycznych dla
istniejących ról. Powtarzalne nieruchome obiekty rysuj przez `InstancedMesh`,
współdzieląc geometrię i materiał; ich macierze muszą zawierać transformację
węzła modelu. Symulacja nie importuje `src/render`.

## Weryfikacja

`StyleTest` buduje statyczny pokaz: podłoga, ściany, filary, osłony, dwie skrzynie,
dwaj wrogowie, broń na stojaku, pocisk oraz próbka magenty. Ładuje modele z
`public/assets/models/`; przy błędzie zostają proste bryły. Powtarzalne ściany,
filary i osłony używają instancji. Konstruktor `new StyleTest(false)` pozwala
testować bez DOM i sieci.

Po rejestracji otwórz `?scene=style-test&debug=1`. W ciągu 30 sekund porównaj
obrys 0/1, jasne boki i górę filarów, sylwetki czerwonych wrogów na tle ściany,
czarne skrzynie oraz cyan/magentę. Zmień kolor w panelu i sprawdź wszystkie
współdzielone obiekty. Oceń, czy role widać w 0,2 s i czy obrys nie zasłania broni.

`tests/e2e/style.spec.ts` jest oznaczony `test.fixme` do rejestracji sceny.
Po integracji usuń fixme, utwórz i przejrzyj wzorzec przez
`npm run e2e -- tests/e2e/style.spec.ts --update-snapshots`; następne uruchomienia
porównują canvas z `maxDiffPixelRatio: 0.02`. Jednostkowe testy renderu obejmują
mapowanie, cache, gradient, synchronizację, przebiegi i przywracanie stanu,
przełączniki bloom/postFx, maskę emisyjną, impulsy obrażeń i Skupienia, siatkę
podłogi i zwalnianie zasobów (`renderPostFx.test.ts`);
test sceny obejmuje fallback, GLB, instancje i zwalnianie zasobów.

## Motywy Neon Noir

`src/data/themes/{white,neonStreet}.json` zawierają pełne zestawy parametrów
`render` oraz dane `rain` dla modułu deszczu. Schemat zod znajduje się w
`themeSchema.ts`, eager loader i wybór URL w `themes.ts`. Motyw `white` zachowuje
wszystkie wcześniejsze wartości `tuning.render`; nowe efekty są wyłączone.
`applyTheme()` zapisuje poprzedni stan i zwraca idempotentne przywrócenie.
Pokoje i arena posiadają `SceneAtmosphere`, która stosuje motyw i sprząta go
przy opuszczaniu sceny. `?theme=<id>` nadpisuje dane układu. Nieznany identyfikator
ostrzega raz i wybiera white. Deszcz nie jest tu renderowany.

Materiały miejskie (`src/render/urbanMaterials.ts`, lista `urbanKinds`) są
materiałami Standard i przyjmują kolorowe PointLight (limit 8 obsługuje integrator
świateł). Rozpoznawane po nazwie glTF `mat_<rodzaj>`; kolor bazowy to
`tuning.render[rodzaj]` (nadpisywany przez motyw), a wygląd definiuje tabela
`urbanLooks`: tekstura, `scale` (powtórzenia na metr), roughness, metalness,
`bump` (mnożnik reliefu) i `wetness`. Rzut tekstur jest trójplanarny w przestrzeni
świata.

Rodzaje z danych (`src/data/render/portMaterials.json`, `arenaMaterials.json`, walidowane zod) mogą
mieć `"flat": true`: materiał jest wtedy zwykłym `MeshStandardMaterial` w barwie `tint` (także
w motywie `white`), bez tekstury, reliefu i shadera miasta. Służy jako ciemna barwa zastępcza dla
materiałów, których tekstura jeszcze nie istnieje (zestaw „estakada, dachy, doki”:
`gas_station_tiles`, `highway_asphalt_worn`, `flood_brick_algae`, `boardwalk_planks`,
`canal_stone_wall`); po dodaniu pliku `surfaces/<id>.webp` wystarczy usunąć `flat`.

| Rodzaj       | Tekstura (`surfaces/`) | Skala | Rough. | Metal. | Bump | Przeznaczenie                           |
| ------------ | ---------------------- | ----: | -----: | -----: | ---: | --------------------------------------- |
| `concrete`   | `concrete`             |  0,25 |    0,8 |      0 |  0,5 | beton, bariery, chodniki (wetness 0,22) |
| `asphalt`    | `asphalt`              |  0,25 |    0,3 |      0 | 0,25 | jezdnia, mokra (wetness 1)              |
| `metal`      | `metal_panel`          |  0,25 |    0,8 |   0,35 |  0,5 | blacha, konstrukcje                     |
| `facade`     | `brick`                |  0,25 |    0,8 |      0 |  0,9 | ściany budynków, okna, rolety           |
| `trim`       | `metal_panel`          |  0,25 |    0,8 |   0,35 |  0,3 | listwy, obramowania                     |
| `glass`      | `grime`                |  0,25 |    0,8 |      0 |    0 | szkło (proceduralna łuna)               |
| `cable`      | `grime`                |  0,25 |    0,8 |      0 |    0 | kable, czarne detale                    |
| `paint`      | `painted_metal`        |   0,7 |   0,55 |   0,25 |  0,7 | malowana blacha: kontenery, drzwi       |
| `lacquer`    | `painted_metal`        |   0,5 |    0,3 |    0,3 | 0,25 | lakier: karoseria, automaty             |
| `rust`       | `rust_metal`           |   0,8 |   0,85 |    0,3 |    1 | skorodowany metal: schody, rury         |
| `corrugated` | `corrugated`           |   0,5 |   0,55 |   0,35 |  1,4 | blacha falista: daszki, rolety          |
| `plastic`    | `plastic`              |     1 |    0,6 |      0 |  0,5 | plastik: skrzynki, pokrywy              |
| `hivis`      | `plastic`              |     1 |    0,5 |      0 |  0,5 | odzież ostrzegawcza, pachołki           |
| `rubber`     | `rubber`               |   1,2 |    0,9 |      0 |  0,7 | guma: koła, worki, uszczelki            |
| `wood`       | `wood_planks`          |   0,8 |   0,85 |      0 |  1,1 | drewno: palety, lady                    |
| `fabric`     | `tarp`                 |   0,9 |   0,95 |      0 |  0,8 | tkanina: markizy, noren, lampiony       |
| `machine`    | `tech_panel`           |   0,6 |    0,5 |   0,35 |    1 | urządzenia: panele, klawiatury          |
| `paving`     | `paving`               |   0,5 |   0,55 |      0 |    1 | kostka brukowa, chodnik (wetness 0,45)  |
| `plaster`    | `plaster`              |   0,3 |    0,9 |      0 |  0,8 | tynk (wetness 0,1)                      |
| `hazard`     | `plastic`              |     1 |   0,55 |      0 |  0,4 | pasy ostrzegawcze (patrz niżej)         |

Relief: z jasności tekstury powierzchni (`cityHeight`) różniczkowanej w przestrzeni
ekranu liczone jest zaburzenie normalnej (bez UV), skalowane przez
`tuning.render.cityBumpStrength` × `bump` rodzaju. Gaśnie z odległością, gdy piksel
obejmuje kilka tekseli (`smoothstep(1, 4, texeli na piksel)`), co ogranicza
migotanie. Wartość 0 daje powierzchnie płaskie (motyw `white`); neonStreet używa 1.
Strażnik w `cityPerturbNormal`: gdy pochodne ekranowe pozycji są zerowe albo NaN
(zdarzało się na podłodze kilka metrów przed kamerą przy patrzeniu wzdłuż ulicy) lub
wektor przed `normalize` jest zerowy, shader zwraca niezaburzoną normalną — bez tego
NaN dawał czarny pas na dole kadru (test `urbanBumpGuard.test.ts`).
Roughness jest dodatkowo modulowany jasnością tekstury. Całość wyłącza
`citySurfaceDetail` = 0.

Materiał `hazard` rysuje w shaderze bursztynowo-czarne ukośne pasy w przestrzeni
świata; okres pasów w metrach to `tuning.render.cityHazardPeriod` (domyślnie 0,3).

Nadruki UV (`src/render/propPrints.ts`): `mat_label_<x>` i `mat_screen_<x>`
(rozpoznawane przez `isPrintMaterialName`, tworzone przez `printMaterial(name)`
i podpinane w `applyStyle`) mapują teksturę po UV modelu zamiast rzutu świata.
Naklejka (`/assets/textures/labels/label_<x>.webp`) to oświetlany
`MeshStandardMaterial` z odcięciem alfy 0,5; ekran
(`/assets/textures/screens/screen_<x>.webp`) to `MeshBasicMaterial` bez tone
mappingu z `userData.bloom = true` (świeci w bloomie). Oba mają polygon offset,
żeby nie walczyć z podłożem. Do załadowania tekstury materiał jest niewidoczny.
Bez detalu miasta (`citySurfaceDetail` 0, motyw `white`) naklejka jest biała, a
ekran ciemny. Tekstury ładuje wspólny `assetTexture(folder, id)` z
`src/render/surfaceTextures.ts` (foldery `surfaces`, `labels`, `screens`);
`surfaceTexture(name)` to jego skrót dla `surfaces`. Konwencja UV i lista nadruków:
`docs/assets.md`.

Nowe pola motywu `render`: `cityBumpStrength` (≥ 0, siła reliefu) i
`cityHazardPeriod` (> 0, okres pasów w m) obok `citySurfaceDetail`; kolory
nowych rodzajów (`paint`, `lacquer`, `rust`, `corrugated`, `plastic`, `hivis`,
`rubber`, `wood`, `fabric`, `machine`, `paving`, `plaster`, `hazard`) są polami
`render` w motywach i domyślnie w `tuning.ts`.

Tekstury concrete/asphalt/metal_panel/brick/grime (oraz nowe z tabeli)
są próbkowane triplanarnie z pozycji świata; maska asphalt_puddles w XZ.
Pliki `/assets/textures/surfaces/*.webp` są ładowane leniwie i współdzielone.
Manifest glob pozwala pominąć żądanie brakującego pliku. Brak lub niepoprawny plik
daje jeden warning i proceduralny szum, bez przerwania renderu.
Po dodaniu nowych plików w trakcie sesji należy odświeżyć stronę.
Fasady mają siatkę okien, ramy, rolety, gzymsy oraz ciepłą/zimną emisję z hasha
komórki. Ich `userData.bloomMaterial` rysuje tylko słabą emisję okien w maskach.
Szkło odbija kolor łuny proceduralnie. `mat_neon_amber|green|violet|blue|white`
i `mat_light_white` są unlit z jawnym bloomem. Czerwień, cyan i magenta pozostają
rolami walki. W neonStreet skrzynie są jasne, a wróg ma czerwony rim Fresnela.

Odbicia (`reflections.ts`) używają odbitej względem `playerSpawn.y` kamery,
globalnej płaszczyzny odcinającej geometrię poniżej podłogi i selekcji emisji
z bloomu. Kamera odbić pomija viewmodel. Maska i dwa rozmycia Gaussa mają 1/2
szerokości i wysokości bufora. Kanał A istniejącego przebiegu normalnych koduje
`userData.wetness`: asphalt 1, paving 0.45, concrete 0.22, plaster 0.1, pozostałe 0. Kompozycja rekonstruuje
pozycję świata, sprawdza normalną w górę i tolerancję wysokości podłogi,
projektuje odbicie, dodaje Fresnel, maskę kałuż i animowane zniekształcenie.
W white nie powstają cele odbić i nie ma dodatkowych przebiegów.

Mgła wysokościowa w kompozycji używa całki gęstości wzdłuż promienia widzenia,
ze spadkiem wykładniczym względem wysokości nad podłogą. Nie obejmuje viewmodelu.
Panorama to trzy warstwy InstancedMesh, proceduralne okna, bursztynowo-białe
światła dachowe oraz trzy odległe panele z gradientem i szumem. Osobny `Rng`
z identyfikatora pokoju zapewnia powtarzalność, bez dotykania RNG symulacji.
Nie ma colliderów. `panoramaDensity` i `panoramaHeight` przebudowują instancje
tylko po zmianie wartości; reszta aktualizuje uniformy.

Wszystkie nowe pola `tuning.render` widoczne są automatycznie w lil-gui:
`reflectionStrength/Distortion/Puddles/FloorTolerance`,
`heightFogDensity/Falloff`, `panoramaEnabled/Density/Height/WindowWarm/WindowCool`,
`enemyRimStrength/Power`, kolory świateł i materiałów, `citySurfaceDetail`,
`cityBumpStrength`, `cityHazardPeriod`.

### Koszt i kontrola

Przy włączonym bloomie, bez impulsu i viewmodelu: white = **8 przebiegów**,
neonStreet = **11 przebiegów**. W obu: kolor i normalne/głębia w pełnej
rozdzielczości, maska bloomu w 1/2, cztery rozmycia w 1/4, kompozycja w pełnej.
Neon dodaje maskę odbicia i dwa rozmycia w 1/2. Panorama uczestniczy w istniejących
przebiegach geometrii. Viewmodel dodaje po jednym wywołaniu renderu w kolorze,
normalnych i bloomie: odpowiednio 11/14; aktywny impuls dodaje jeden pełny pass.
Przy `outline=0` nadal omijany jest cały pipeline stylu.

`?scene=neon-test`: uliczka 8 × 30 m, fasady, asfalt, beton, metal, szkło,
jasna skrzynia i trzy czerwone manekiny, pięć neonów z kolorowymi światłami.
Porównaj z `?scene=neon-test&theme=white`. Sprawdź odbicia poniżej neonów,
brak odbić na ścianach i skrzyni, daleką panoramę i czytelność wroga.
Jednostkowo sprawdzane są dane, przywracanie motywu, deterministyczność panoramy,
liczba i rozdzielczość passów, mokra maska oraz przywracanie stanu po błędzie.
W sandboxie wykonawcy Chromium/SwiftShader zwrócił `spawn EPERM`; zrzuty i
kompilacja shaderów na GPU wymagają weryfikacji przez integratora.

## Dłonie FPP — animacja

`HandRig` animuje przegubowe modele R/L pozami Euler XYZ z walidowanych danych
`src/data/hands/handPoses.json`, względem orientacji spoczynkowych. Przypięcie
jest oparte na odwrotności macierzy gniazda dłoni. `FppBlade` / `FppBlaster`
rysują prawy chwyt oraz drugi chwyt bliźniaczych; `FppOffhand` obsługuje wolną
lewą dłoń, podparcie na `support` broni i gest mocy z własnym magentowym materiałem.
`FppMotion` dodaje opad zamiany, sway i bob wyłącznie w renderze. Strojenie:
`tuning.hands` w lil-gui oraz stałe pozycji/kątów na górze plików FPP.
Szczegóły i kontrola ręczna: [hands.md](hands.md#render-przegubowych-dłoni).

Klinga ostrza (`FppBladeFx`) to komiksowa plazma na quadzie zwróconym do kamery: dwa stałe programy
(`fppPlasmaBlade:solid` — biały rdzeń i jasny cyjan, nieprzezroczyste z zapisem głębi; `:halo` —
półprzezroczysta otoczka), strefy z twardą granicą zamiast gradientu i płaskie pasma energii płynące
od emitera (uniformy z `tuning.vfx.blade*`, w cięciu szybciej). Przy wyłączonych „Błyskach ekranu”
pasma dryfują powoli, a szerokość nie pulsuje. Oba quady mają `noOutline` (bez tuszu), bloom: tak.

## Render pogody i portu

Opcjonalny profil `weather` w pokoju steruje istniejącą mgłą wysokościową,
odbiciami neonów, maską kałuż i uniformem połysku materiałów miejskich.
Kompozycja błysku ma kolor z profilu (ciepła biel); bez profilu zachowuje
poprzednie składowe liniowe. Port scala jeden wspólny korzeń statyczny w
komórkach 20 m według wzorca kryjówki z `0ade40c`; kontenery i bolardy są
instancjami w komórkach. Zwalnianie obejmuje bufory InstancedMesh.
Kontrakty i ograniczenia: [weather.md](weather.md), [arenas.md](arenas.md).
Pomiar strukturalny portu: 286 → 123 siatek. Pomiar wywołań GPU pozostaje
zablokowany przez sandbox i nie jest zastępowany liczbą siatek.

## Horyzont i zasięg widzenia

Pokój, arena, poziom misji i kryjówka liczą jedną obwiednię z brył
statycznych, z uwzględnieniem obrotu. Promień XZ to połowa przekątnej
obwiedni. Dla małych układów pozostają płaszczyzny 0,1 i 220 m
oraz pierścienie 66, 92, 124 i 162 m. Na większych mapach środek
panoramy przesuwa się do środka obwiedni, a pierwsza warstwa
zaczyna się z zapasem. Daleki zasięg kamery liczy także odległość od
przeciwległej krawędzi areny do tła. Ciemny grunt bez collidera
ciągnie się pod pierścieniami i poza zasięg kamery.

Parametry są w `tuning.horizon` i w lil-gui. Na dużych mapach mgła
skaluje zasięgi profilu względem zasięgu kamery, ogranicza `fogFar`
przed płaszczyzną odcięcia i w pełni kryje geometrię od `fogFar`.
`clearNight` zachowuje dłuższą widoczność niż smog. Małe układy
zachowują także siłę mgły z motywu lub profilu. Obrys korzysta z
metrycznej głębi odtworzonej z aktualnych płaszczyzn, a jego próg
jest względny wobec odległości. Przy `horizonTest` i 24 bitach
kwantyzacja głębi to ok. 1,1 cm przy 300 m, czyli ok. 0,004% tej
odległości (bazowy próg obrysu to 2,5%). Stosunek `far/near` jest
ograniczony do 2200. Warstwa FPP zachowuje bliską płaszczyznę
0,1 m. Logarytmiczny bufor nie jest potrzebny do realizacji tego zakresu.

Sprawdzenie w 30 sekund

1. Otwórz `?scene=horizonTest&debug=1`. Spójrz na wysokie bryły
   na 50, 150 i 300 m oraz na dalszą panoramę.
2. Przełącz `clearNight` na smog przyciskami u góry. W konsoli
   przeglądarki sprawdź `window.__neoryder.query('horizon')`.
   Pierścienie mają być za obwiednią, a `domeRadiusM` i `fogFar`
   mniejsze od `far`.
3. Użyj `window.__neoryder.command('fly')` i przechwyć mysz.
   `WASD`, skok i kucanie poruszają kamerą. Unieś się nad
   krawędzią i obejrzyj podłoże oraz mgłę. Sprawdź migotanie
   stykających się powierzchni oraz kontury odległych brył.
   Ponowne `fly` wraca do kamery gracza.

## Styl komiksowy Neon Noir (domyślny od 18 XI 2026)

Decyzja właściciela: gra przechodzi na styl inspirowany Borderlands z elementami Neon Noir.
Domyślnie działa wariant `b` z `src/render/lookPresets.ts` (nakładany po motywie przez
`reapplyLook()`, bo motywy nadpisują kontur):

- **Tusz:** ostra maska krawędzi 1 px (osobny przebieg) pogrubiona perspektywicznie w kompozycji.
  Kontur sylwetki (głębia) i detale (normalne) mają osobne kanały maski, promienie oraz krycie.
  Broń i ręce zachowują dotychczasowy cieńszy tusz; na neonach i jasnych efektach tusz zanika;
  przy gęstym detalu (kratki, siatki) zostaje sama linia 1 px.
- **Płaskie cienie:** `celBands`/`celStrength` przyciemniają tylko cienie i półcienie
  (jasność < ~0,5), z krótkim miękkim przejściem między pasmami — światła lamp zostają miękkie.
  Nasycone i jasne piksele (neony, wrogowie, efekty) są nietknięte.
- **Bez konturu:** obiekty z `userData.noOutline` oraz automatycznie przezroczyste materiały
  addytywne albo bez zapisu głębi (poświaty, stożki światła) — `src/render/noOutline.ts`.
- Porównania: `?look=a` (sam tusz), `?look=c` (z kreskowaniem i plamami farby), `?look=off`
  (dawny wygląd, bez nowych formuł tuszu).
- Pakiet tekstur „komiks” (`public/assets/textures/komiks/`) czeka na podpięcie w arenach.

### Grubość i zanik tuszu z odległością

Promień dylatacji w pikselach bufora renderera:

```text
radius = inkWidth × clamp(inkRefDistanceM / depth, inkMinScale, inkNearScale)
normalRadius = radius × inkNormalScale
opacity = 1 − smoothstep(inkFadeNearM, inkFadeFarM, depth)
normalOpacity = opacity × (1 − smoothstep(inkNormalFadeNearM, inkNormalFadeFarM, depth))
```

`depth` to metryczna głębia widokowa odtworzona z bufora, nie odległość euklidesowa.
Przy sylwetce po stronie tła używana jest głębia najbliższej bryły, żeby odległa ściana
lub niebo nie wygaszały konturu bliskiej postaci. Próbki dylatacji są dodatkowo ograniczane
promieniem wynikającym z głębi źródła maski. Normalne mają osobny mniejszy promień i gasną
wcześniej; zachowują też dotychczasowe wygaszanie `outlineFadeNear/Far` i `outlineFarNormal`.
Przesuwanie dalekiego konturu na stronę tła (`outlineFarOuter`) nadal działa.

Parametry w `tuning.render`, widoczne na żywo w lil-gui i ustawiane przez presety a/b/c:

| Parametr                                   | a / b     | c         | Znaczenie                                            |
| ------------------------------------------ | --------- | --------- | ---------------------------------------------------- |
| `inkWidth`                                 | 1,9 px    | 2,05 px   | Promień przy 4 m, zmniejszony z 2,2 / 2,4 px         |
| `inkRefDistanceM`                          | 4 m       | 4 m       | Głębia, przy której promień równa się `inkWidth`     |
| `inkNearScale`                             | 1,35      | 1,4       | Górny limit skali blisko kamery (bez zmiany)         |
| `inkMinScale`                              | 0,25      | 0,25      | Dolny limit skali daleko od kamery                   |
| `inkDilationMinPx`                         | 0,5 px    | 0,5 px    | Poniżej progu dylatacja znika, zostaje maska 1 px    |
| `inkFadeNearM` / `inkFadeFarM`             | 45 / 80 m | 45 / 80 m | Zanik krycia także samej maski sylwetki 1 px do zera |
| `inkNormalScale`                           | 0,55      | 0,55      | Promień detali względem sylwetki                     |
| `inkNormalFadeNearM` / `inkNormalFadeFarM` | 8 / 24 m  | 8 / 24 m  | Wcześniejszy zanik krycia detali do zera             |
| `inkViewmodelWidth`                        | 2,2 px    | 2,4 px    | Dotychczasowy promień tuszu FPP przed ograniczeniem  |
| `inkViewmodelMaxRadiusPx`                  | 1,2 px    | 1,2 px    | Dotychczasowe ograniczenie tuszu na broni i rękach   |

Dla b: przy 4 m promień wynosi 1,9 px, przy 10 m 0,76 px, od 16 m 0,475 px
(sama maska 1 px), przy 62,5 m maska ma połowę krycia, od 80 m znika. Viewmodel
korzysta z osobnej dawnej maski i dawnego wzoru promienia, również po stronie tła:
nowe skalowanie świata i wygaszanie detali nie usuwają konturów dłoni ani broni.

Maska RGBA przechowuje kontur głębi, detal normalnych, dawną linię FPP i głębię źródła;
ma format HalfFloat dla metrycznej głębi. Nie dochodzi nowy przebieg renderowania.
Kompozycja osobno próbkuje obie szerokości i głębię otoczenia konturu; koszt GPU oraz
ostateczny wygląd wymagają porównania w przeglądarce przez integratora.
`inkAt()` w `outline.ts` jest odpowiednikiem formuł w TS; `renderOutline.test.ts` sprawdza
limity, zanik dylatacji i krycia, cieńsze detale, uniformy obu przebiegów oraz `look=off`.

Sprawdzenie w 30 s (domyślny b):

1. `?scene=hub&debug=1`: podejdź do NPC, po czym odejdź około 10–15 m. Z bliska kreska
   ma być delikatnie cieńsza; z daleka twarz, ręce i nogi mają zachować kolor oraz kształt.
   Patrz także na dłonie i broń FPP: kontur powinien wyglądać jak przed zmianą.
2. `?scene=conquest&arena=arenaRooftops&debug=1`: porównaj bliskich i dalekich wrogów,
   szczególnie cienkie kończyny na tle nieba; odległe detale nie powinny tworzyć czarnych plam.
   Dla kontroli dawnego renderu dopisz `&look=off`.

### Czytelność wrogów z daleka — poświata krawędzi (`src/render/enemyRim.ts`)

Ciemne kombinezony wrogów na ciemnych, zamglonych arenach zlewały się z tłem (widać było
tylko świecące akcenty). `mat_enemy` i `mat_enemy_dark` mają w `onBeforeCompile` poświatę
krawędzi (fresnel) w czerwieni wroga, rosnącą z odległością od kamery:

- z bliska siła i wykładnik z motywu (`tuning.render.enemyRimStrength`/`enemyRimPower`,
  motyw biały = 0, więc bez poświaty); na kombinezonie mnożnik 0,6 (płyty odcinają się od niego);
- od `tuning.vfx.enemyRimNearM` do `enemyRimFarM` siła rośnie do `× enemyRimFarGain`, wykładnik
  spada do `enemyRimFarPower` (szersza krawędź), a bryłę wypełnia płaska czerwień
  `enemyRimFarFill` — z 20–30 m wróg jest czerwoną sylwetką z tuszem, z 5 m wygląda jak dotąd;
- mgła jest w kompozycji (`outline.ts`, po materiale), więc emisja jest z góry dzielona przez
  `1 − mgła` (ta sama krzywa `fogNear/fogFar/fogStrength` + przybliżona mgła wysokościowa na
  wysokości oka 1,6 m), z dolną granicą 0,25; `enemyRimFogCompensation` (0..1) to wyłącza;
- `tuning.vfx.enemyDarkShade` (0,3, wcześniej stałe 0,16) rozjaśnia kombinezon, nadal jako
  nasycona czerwień, więc pasy cienia stylu go nie spłaszczają.

Wszystko na wspólnych uniformach (`syncEnemyRim()` w `syncMaterials()`), klucze programu
stałe: `enemyRim1.00` i `enemyRim0.60`. Poświata jest częścią materiału, więc działa też przy
`?look=off`. Zapowiedź ciosu nie do zablokowania (bursztyn) klonuje tylko materiały
`mat_enemy_glow` (wizjer, końcówka pałki, rdzeń, ostrze), które poświaty nie mają.
`enemyRimAt()` to odpowiednik shadera w TS do testów (`tests/unit/enemyRim.test.ts`).

## Pomiar referencyjny (S1-04)

Powtarzalny pomiar wydajności na prawdziwym GPU: build produkcyjny, `vite preview` na porcie 4174
(skrypt sam go startuje i zamyka), Chromium z Playwrighta (`--use-angle=d3d11`), viewport 1920×1080,
DPR 1, profil jakości `medium` (decyzja D5). Skrypt: `tools/perf/benchmark.mjs`.

```
npm run perf:bench -- --runs 2                       # build + wszystkie scenariusze, vsync
npm run perf:bench -- --uncapped --seconds 6          # zapas ponad 60 FPS (bez vsync i limitu klatek)
npm run perf:bench -- --gpu low --uncapped            # wymusza słabe, zintegrowane GPU
npm run perf:bench -- --cpu-throttle 4 --uncapped     # CPU spowolnione 4x (CDP)
npm run perf:bench -- --scenario hub,boss --quality high
```

Opcje: `--quality low|medium|high`, `--seconds N` (pomiar, domyślnie 10), `--scenario <lista>`
(`hub,combat,heaviest,boss,shatter,transition,arenas`), `--runs N` (domyślnie 2), `--gpu high|low`
(`low` = `--force_low_power_gpu`), `--cpu-throttle N`, `--uncapped`, `--port`, `--load-timeout <s>`
(limit wczytania sceny, domyślnie 45), `--idle-threshold <%>` i `--idle-timeout-min` (czekanie na
spokojny CPU przed każdym przypadkiem), `--no-wait-idle`. Wynik: `perf-report/bench-<konfiguracja>-<data>.json`
(katalog w `.gitignore`) i tabele w konsoli. JSON zawiera użyty GPU (`gpuInfo`, flaga
`softwareRenderer` przy SwiftShaderze), obciążenie CPU przed każdym przypadkiem (`idleChecks`)
i wszystkie `pageerror`/`console.error`/`console.warn` z nazwą sceny.

### Scenariusze

Każdy przypadek: wczytanie, rozgrzewka 3 s, pomiar `--seconds` (god włączony). Profiler klatki
jest włączony w oknie pomiaru, więc wartości mają jego niewielki narzut.

| Scenariusz   | Co mierzy                                                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hub`        | kryjówka `?scene=hub` w miejscu startu                                                                                                                                                                                                          |
| `combat`     | `room-test`, pokój `combatYard`, 6 wrogów (`spawn`) plus fale                                                                                                                                                                                   |
| `heaviest`   | przegląd pokoi z `src/data/rooms` (`room-test`, 1 s rozgrzewki + 2 s), wybór pokoju o największej sumie kosztów etapów (GPU, a bez zapytań CPU), potem pełny pomiar; ranking w `surveyRanking` (tylko 1. przebieg, 2. używa tego samego pokoju) |
| `boss`       | `bossRoom`, czeka na pojawienie się bossa                                                                                                                                                                                                       |
| `shatter`    | `combatYard`, 20 wrogów i `kill all` po 2 s pomiaru; osobne statystyki `afterKill`                                                                                                                                                              |
| `transition` | kryjówka → `mission start m01-maszty` (przeładowanie strony): czas do pierwszej klatki i do stanu `playing` zegarem ściennym, najdłuższe klatki podczas wczytywania, statystyki 5 s po starcie                                                  |
| `arenas`     | 7 aren Przejęcia (`?scene=conquest&arena=`), Szturm, Kradzież rdzenia i poziom misji M01                                                                                                                                                        |

Pokoje bez punktów spawnu (`noodleShop`, `restRoom`, `rooftopRest`, `shopRoom`) nie wczytują się w
`room-test` (walidacja fal), więc przegląd je pomija (`skippedRooms` w JSON). Pomiary z 20 XI
powstały przed dodaniem tego pominięcia i zawierają 4 wpisy `survey` z błędem wczytania.

### Metryki

Średni FPS, 1% low (średnia z najgorszego 1% czasów klatek rAF, przeliczona na FPS), p99 czasu
klatki, liczba klatek > 33,3 ms i > 50 ms, najdłuższa klatka, średnie CPU/GPU ms na etap
(`frameProfile`, próbkowane co 500 ms), średnie `renderInfo` (calls, triangles), sterta JS przed
i po (`--enable-precise-memory-info`), liczniki wrogów, ciał fizycznych i odłamków (szczyt).
Etap `pipeline` obejmuje etapy zagnieżdżone (`color`, `normals`, `bloom`...), więc ich nie sumuj;
`step` to cała symulacja (fizyka i AI razem, bez podziału). Zapytania GPU przy `--cpu-throttle`
mierzą też czekanie na spowolniony CPU, więc tam wiarygodne są kolumny CPU.

### Wyniki z tego komputera (20 XI 2026)

Sprzęt: Ryzen 7 7700, RTX 4070 i zintegrowane AMD Radeon (Windows 10), HeadlessChrome 159
(Playwright). **To nie jest docelowy laptop z D5**: pomiar na nim robi właściciel. W trakcie
pomiaru inny agent uruchamiał testy na tej maszynie; skrypt czekał na CPU < 15% przed każdym
przypadkiem (obciążenie przed przebiegami 1–15%, limit czekania nigdzie nie przekroczony).
Konfiguracje: (a) vsync, RTX 4070; (b) bez vsync, RTX 4070 (pomiar 6 s); (c) bez vsync, wymuszone
AMD Radeon (potwierdzone w `gpuInfo`); (d) bez vsync, RTX 4070 z CPU spowolnionym 4x. Wszędzie
`softwareRenderer = false`. Wartości to przebiegi 1/2.

| Scenariusz           | a: FPS                         | a: 1% low | b: FPS    | c: FPS                        | c: 1% low | d: FPS                      | d: 1% low |
| -------------------- | ------------------------------ | --------- | --------- | ----------------------------- | --------- | --------------------------- | --------- |
| hub                  | 60,0/59,6                      | 59,5/35,9 | 160/162   | 29/29                         | 6,2/6,6   | 19,6/16,0                   | 5,4/4,9   |
| combat (combatYard)  | 60,0/60,0                      | 59,5/59,5 | 209/212   | 30/30                         | 6,0/5,4   | 28,6/28,6                   | 19,9/19,6 |
| heaviest             | 60,0/58,9 (arenaContainerPort) | 59,5/30,0 | 64,5/63,6 | brak, przegląd zniekształcony | -         | 9,7/9,2 (arenaFloodedDocks) | 7,0/7,6   |
| boss                 | 60,0/60,0                      | 59,5/59,5 | 352/264   | 30/30                         | 3,7/2,6   | 48,7/43,1                   | 34,1/23,8 |
| shatter              | 59,9/59,8                      | 51,2/44,7 | 285/285   | 31/30                         | 3,7/2,5   | 38,7/37,5                   | 13,9/14,1 |
| arena Container Port | 59,9/59,5                      | 51,2/32,7 | 73/66     | 25/25                         | 7,7/8,4   | 10,5/11,0                   | 7,6/7,8   |
| arena Flooded Docks  | 53,4/59,9                      | 29,9/51,2 | 66/65     | brak (utrata kontekstu)       | -         | 10,9/10,8                   | 7,8/8,5   |
| M01 Maszty           | 60,0/60,0                      | 59,5/59,5 | 178/171   | 30/31                         | 6,0/6,4   | 25,8/22,9                   | 16,9/15,1 |

p99 czasu klatki w (a): 16,8 ms (jedyne wyjątki: heaviest przebieg 2 i Flooded Docks przebieg 1: 33,3 ms).
Pozostałe areny Przejęcia w (a) trzymają 60 FPS. W (b) najniższe: Container Port 66–73, Flooded Docks
65–66, Rail Yard 83–85, Overpass 87–89 FPS. Pełne dane (p99, klatki > 33/50 ms, etapy) są w JSON.

Przejście kryjówka → M01 (przeładowanie strony): pierwsza klatka nowej strony po ok. 50 ms (a/b),
stan `playing` po ok. 1,03–1,07 s; jedna klatka ok. 710–717 ms podczas wczytywania. Po starcie w oknie
5 s jest jeszcze klatka 450–550 ms. Na (c) `playing` po 1,5–1,7 s; na (d) po 4,8–5,1 s, najdłuższa
klatka wczytywania 3,7–3,95 s.

Rozpad grupy (`shatter`): po `kill all` jedna klatka 33–58 ms w (a/b), 90–94 ms w (d).

Różnica między przebiegami (średni FPS): w (a) do 1,8% w 14 z 16 scenariuszy; wyjątek Flooded Docks
10,8% (przycięcia w przebiegu 1, 44 klatki > 33 ms) i hub 0,7%. W (b) bez vsync rozrzut bywa większy (do 25%
przy 260–350 FPS: boss, Power Plant), więc kryterium < 5% dotyczy pomiaru z vsync (a).

Błędy i ostrzeżenia konsoli: w (a), (b), (d) brak `pageerror`, `console.error` i `console.warn` poza
4 pokojami bez fal (błąd walidacji `Nieprawidłowe dane fal ... spawnPoints`, artefakt przeglądu).
W (c) (słabe iGPU): `WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost` (arenaPowerPlant, arenaRailYard) i
`THREE.WebGLRenderer: Error creating WebGL context` / `A WebGL context could not be created. Reason:
Web page caused context loss and was blocked` (arenaConstructionSite, arenaRailYard, arenaFloodedDocks):
przeciążenie GPU kończy się utratą kontekstu i blokadą kolejnych kontekstów przez Chromium.

### Wnioski z liczb (cele do decyzji, bez wdrożeń)

Przy CPU 4x (d) klatka dużej areny trwa 82–95 ms; CPU ms na etap (Container Port): `pipeline` 68
(`color` 33, `normals` 22, `bloom` 13 w tym maska 12), `step` 9,3, `sceneRender` 3,7, `city` 1,2, `composite` 0,3.
Dominuje więc JS renderu (przygotowanie wywołań rysowania, ok. 70–75% klatki), nie symulacja
(`step` 7–10%, w hubie i walce 3–4 ms).

1. Etap `color` (przebieg koloru kreskowanego): CPU 33–35 ms na arenach przy 2–3,3 tys. wywołań
   (Container Port, Flooded Docks), 24 ms w hubie (640 wywołań); na RTX GPU 5–7 ms. Największy cel
   (scalanie/instancjonowanie geometrii areny, mniej materiałów).
2. Etap `normals` (kontur): CPU 22 ms na dużych arenach, 9 ms w hubie; to drugi przebieg po całej
   geometrii. Kandydat: wspólny przebieg z `color` lub pomijanie obiektów dalekich.
3. Maska bloom `bloomMask`: CPU 11–14 ms na arenach i w hubie (11,9), przy GPU 5–7 ms. Kandydat:
   osobna lista obiektów emisyjnych zamiast ponownego przejścia całej sceny.
4. Słabe GPU (c): `composite` ok. 17–23 ms GPU w każdej scenie (na RTX 0–2 ms) i `color` 10–13 ms;
   wszystkie sceny ok. 25–30 FPS, a duże areny kończą się utratą kontekstu WebGL. Kandydat: tańsza
   kompozycja końcowa i niższa rozdzielczość renderu w profilu `low`.
5. Przejście do M01: jednorazowa klatka ok. 710 ms (a/b) i 3,7–3,95 s przy CPU 4x (wczytywanie
   poziomu w jednym kawałku), plus klatka 450–550 ms tuż po starcie.
