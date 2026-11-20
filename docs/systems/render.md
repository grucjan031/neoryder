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

## Wywołania rysowania dużych aren (budżet ADR 0011 D8)

Cel: ≤ 800 wywołań rysowania (`renderer.info.render.calls` z całej klatki, wszystkie przebiegi
potoku) w najgorszym widoku przy jakości `medium`, bez zmiany wyglądu. Pomiar sprzed zmiany
pokazał 2,5–5,9 tys. w najgorszym widoku (Terminal kontenerowy, Zalane Doki, Rail Yard).

### Diagnoza (Terminal kontenerowy, widok ze startu, jakość medium)

Rozbiór zrobiono jednorazowym opakowaniem `renderer.renderBufferDirect` i `renderer.render`
(liczenie po przebiegu i po nazwie węzła; narzędzia nie zostawiono w repozytorium). Klatka =
**ten sam zestaw obiektów rysowany w kilku przebiegach**: kolor (1387 + 24 viewmodel), normalne
dla konturu (1317 + 20), maska bloomu (99 + 24), reszta to pełnoekranowe przebiegi po 1 wywołaniu
(razem 2877). Dlatego każde wywołanie statyki kosztuje ok. 2,5 razy, a budżet 800 to ok. 320 na przebieg.

| Kategoria (przebieg koloru, bez viewmodelu)                                                         |    Przed | Po (budżet 60 tys. + scalanie rzadkich modeli) |
| --------------------------------------------------------------------------------------------------- | -------: | ---------------------------------------------: |
| Scalone komórki statyki (`static:*`)                                                                |      294 |                                             58 |
| `InstancedMesh` kontenerów 20 i 40 stóp (komórka × materiał)                                        |      426 |                                             35 |
| Pozostałe `InstancedMesh` (modele, efekty)                                                          |       35 |                                              7 |
| Pojedynczy `Mesh` z modelu instancjonowanego (jedna sztuka w komórce: kosze, generatory, platformy) |      329 |                         0 (scalone do statyki) |
| Statyka niescalona: węzły GLB samotne w parze komórka × materiał (podkłady, balast, okna, lampy)    |      233 |                                              0 |
| Przezroczyste: światła, stożki, plamy, napisy (`CityDressing`), tylko kolor (bez konturu)           |       57 |                                             61 |
| Panorama, niebo, woda, grunt, wróg, broń                                                            |      ~13 |                                            ~14 |
| **Razem**                                                                                           | **1387** |                                        **175** |

Przyczyna: stała siatka `batchCellM` (20 m) dzieli każdą grupę materiału na dziesiątki komórek,
a modele instancjonowane (`blocks[].instance`) dostawały osobny `InstancedMesh` na komórkę ×
kształt × węzeł × materiał. Rzadkie modele (kosze, generatory, kioski) lądowały po jednej sztuce
w komórce, czyli jako pojedyncze wywołanie, a samotne węzły GLB nie miały z czym się scalić.
Samych materiałów w arenie jest ok. 60 rodzajów (rejestr `getMaterial` współdzieli instancje;
klony tylko dla wariantów farby kontenerów i nadruków), więc materiały nie były przyczyną.
Cała arena to ok. 2,0 mln trójkątów (z tego 1,77 mln w instancjach kontenerów), ale pojedynczy
przebieg w widoku rysuje ok. 0,5–0,7 mln. Przezroczyste światła i stożki (osobny materiał na
źródło, 50–110 wywołań, tylko w przebiegu koloru) zostają: scalenie wymaga jednego materiału z
atrybutem na źródło i zmiany shaderów (poza zakresem; dalej ok. 20–30% wywołań na arenach z wieloma światłami).

### Zmiana

Statyka i instancje areny (wyłącznie ścieżka `RoomScene` z `staticWorld`, czyli areny `exclusive`
i `spawnRing`) są dzielone **budżetem trójkątów zamiast stałą siatką**:

- `partitionByTriangles` (`src/render/staticBatch.ts`) dzieli grupę o tym samym materiale/modelu
  rekurencyjnie wzdłuż dłuższej osi XZ (mediana ważona trójkątami) tak długo, aż suma trójkątów
  grupy mieści się w `tuning.arena.batchTriangleBudget` (60 000) albo rozrzut środków nie
  przekracza `batchCellM` (nie dzieli drobniej niż dotychczasowa komórka; areny z `batchCellM`
  180–240 m zachowują ten dolny próg). Wynik deterministyczny.
- `batchStaticGeometry(root, owned, { cellSize, triangleBudget })`: z budżetem klucz grupy nie
  zawiera komórki; liście podziału scala jak dotąd (te same materiały, warstwy, `noOutline`,
  `bloom`, cienie, metadane). Bez budżetu zachowanie bez zmian (hub, pokoje, `arena.ts`).
- `RoomScene.buildLayout`: instancje modeli grupowane po (kształt, węzeł, materiały) w całej
  arenie i dzielone tym samym podziałem; liść z jedną sztuką jest zwykłym `Mesh`, który dalej
  scala się ze statyką.
- Grupa instancji (węzeł × materiał) o łącznej liczbie trójkątów ≤ `tuning.arena.instanceMergeTriangles`
  (30 000) nie jest `InstancedMesh`: każda kopia to osobny `Mesh`, który scala się ze statyką
  (jedno wywołanie na materiał zamiast na model × materiał). Kosztem są skopiowane wierzchołki
  (do ok. 3 MB na grupę). `InstancedMesh` zostają przy dużej liczbie kopii: kontenery, tory, wagony.
- Dane aren, kolizje Rapier i hurtboxy nie są zmieniane. `tuning.arena.batchTriangleBudget` = 0
  przywraca dawną stałą siatkę `batchCellM`; większy budżet = mniej wywołań, gorszy culling (więcej
  trójkątów na GPU), mniejszy odwrotnie. Klucze leżą w `tuning.arena`, nie w `tuning.render`
  (`tuning.render` jest w całości sterowane motywami).

Zachowane bez zmian: instancje i scalone siatki trafiają do tych samych korzeni (`static-world`),
a więc do tych samych przebiegów (kolor, kontur przez `noOutline`, maska bloomu przez `userData.bloom`
i `bloomMaterial`, maska odbić); materiały są tymi samymi obiektami (animacja neonów, tekstury,
uniformy mokrości), niszczalne obiekty i migoczące światła nie należą do `static-world`. Test
`arenaDrawBudget.test.ts` buduje arenę ze starą siatką i z budżetem i porównuje sumy trójkątów,
obwiednie, warstwy i flagi (`noOutline`, `bloom`, cienie) per materiał oraz liczbę instancji kontenerów.

### Wyniki: liczba wywołań (scena Przejęcia z wrogami, 24 widoki)

Widoki: 4 kierunki (0°, 90°, 180°, 270°) z każdego punktu przejęcia i ze startu (`tools/perf/viewSweep.mjs`,
komendy `tp`/`look`, jakość medium, 1920×1080). `calls` = `renderer.info.render.calls` całej klatki
(suma przebiegów, z wrogami, światłami i panoramą); trójkąty = suma po przebiegach.

| Arena                 | calls max przed → po | calls średnio przed → po | trójkąty średnio przed → po |
| --------------------- | -------------------: | -----------------------: | --------------------------: |
| arenaContainerPort    |           5539 → 667 |               2248 → 382 |         1,47 mln → 2,71 mln |
| arenaFloodedDocks     |           3217 → 643 |               1622 → 356 |         209 tys. → 438 tys. |
| arenaRailYard         |           5930 → 665 |               2182 → 345 |         280 tys. → 690 tys. |
| arenaPowerPlant       |           2531 → 474 |               1150 → 288 |         217 tys. → 455 tys. |
| arenaOverpass         |           2039 → 713 |               1155 → 387 |         651 tys. → 976 tys. |
| arenaRooftops         |            943 → 661 |                521 → 369 |         955 tys. → 1,19 mln |
| arenaConstructionSite |            897 → 597 |                520 → 358 |         1,02 mln → 1,28 mln |

Najgorszy widok po zmianie: 713 (Overpass), wszystkie areny ≤ 800. Widoki są próbą (kamera na
poziomie gruntu), nie dowodem dla każdej pozycji; wysoko położone punkty widokowe mogą dać więcej.

Koszt: więcej trójkątów na GPU, bo grubsze liście słabiej się odrzucają (Terminal kontenerowy ×1,8,
reszta ×1,2–2,5). Zależność od budżetu (Terminal kontenerowy, scena Przejęcia, calls max / trójkąty
średnio): 20 tys. = 829 / 2,15 mln, 30 tys. = 757 / 2,32 mln, 60 tys. = 667 / 2,71 mln. 60 tys. mieści
wszystkie areny w 800 z zapasem ≥ 87 wywołań; mniejsza wartość przekracza budżet na Terminalu.
Budowa areny (scalanie przy wczytaniu) trwa w tej samej skali co wcześniej (patrz pomiar niżej).

### Wyniki: pomiar benchmarkiem i parą naprzemienną

Sprzęt: RTX 4070 (Chromium ANGLE D3D11; **nie** docelowy laptop z D5), jakość medium, 1920×1080,
bez vsync. Konfiguracje: `npm run perf:bench -- --scenario arenas,heaviest,hub,combat --runs 2 --uncapped
--no-wait-idle` (średnia z 2 przebiegów; scena Przejęcia z wrogami, `god`) oraz `--cpu-throttle 4`
(1 przebieg). Wersja „przed” = główna gałąź bez zmian. Inne procesy na maszynie obciążały CPU
(pierwsza połowa pomiaru „przed” przy 30–100%, „po” przy 2–29%), więc FPS i ms mają szum rzędu
±15–30%; `calls` i trójkąty są deterministyczne. Scenariusze, których zmiana nie dotyczy (assault,
heist, mission, hub, combat), służą jako kontrola: `calls` bez zmian, różnice ms to szum.
Scenariusz `heaviest` wybiera inny pokój przed i po (przed: arenaFloodedDocks, po: arenaRooftops),
więc pominięto go w tabelach. Etapy to średnie CPU ms (`pipeline` zawiera `color`, `normals`, `bloomMask`).

Bez vsync, CPU bez ograniczenia:

| Przypadek               | max klatka 3 s (ms) przed |      po | gotowa (ms) przed |          po | płynna (ms) przed |          po |
| ----------------------- | ------------------------: | ------: | ----------------: | ----------: | ----------------: | ----------: |
| transition/hub->mission |               2444 / 1923 | 80 / 86 |       2332 / 1369 | 1513 / 1615 |       4983 / 3447 | 1658 / 1768 |
| arenaContainerPort      |                      2243 | 74 / 68 |              1576 | 2200 / 2251 |              4018 | 2334 / 2481 |
| arenaOverpass           |                      2878 | 52 / 64 |              1556 | 2030 / 2220 |              4433 | 2082 / 2338 |
| arenaRooftops           |                1310 / 913 | 48 / 53 |       2118 / 1617 | 2062 / 2176 |       3861 / 2770 | 2062 / 2281 |
| arenaPowerPlant         |                 244 / 200 | 49 / 46 |       1735 / 1270 | 1730 / 1729 |       1979 / 1470 | 1730 / 1729 |
| arenaConstructionSite   |                 707 / 677 | 64 / 89 |       1881 / 1688 | 1988 / 1958 |       2862 / 2593 | 2176 / 2096 |
| arenaRailYard           |               1141 / 1005 | 68 / 67 |       1389 / 1372 | 1953 / 1850 |       2865 / 2623 | 2151 / 2053 |
| arenaFloodedDocks       |                 652 / 608 | 94 / 98 |       1503 / 1376 | 1900 / 1721 |       2392 / 2236 | 2053 / 1870 |
| assault                 |                 312 / 317 | 70 / 53 |       1219 / 1218 | 1471 / 1386 |       1531 / 1534 | 1596 / 1481 |
| heist                   |               2724 / 2331 | 84 / 76 |       1437 / 1325 | 1830 / 1671 |       4322 / 3848 | 2037 / 1866 |
| mission:m01-maszty      |                 454 / 454 | 77 / 71 |       1271 / 1287 | 1565 / 1433 |       1885 / 1740 | 1696 / 1551 |

CPU spowolnione 4× (GPU czeka na CPU, wiarygodne są kolumny CPU; jeden przebieg, wiersze kontrolne
hub/combat/mission odbiegają o szum, nie o zmianę):

| Scenariusz                            | calls przed → po | trójkąty (tys.) przed → po | pipeline CPU ms przed → po | color / normals / bloomMask CPU ms przed → po | avg FPS przed → po | 1% low przed → po |
| ------------------------------------- | ---------------- | -------------------------- | -------------------------- | --------------------------------------------- | ------------------ | ----------------- |
| arenas/conquest:arenaContainerPort    | 2861 → 388       | 1993 → 3793                | 94.3 → 26.4                | 42.7 / 32.2 / 17.7 → 14.4 / 6.1 / 4.8         | 8.0 → 21.5         | 6.1 → 8.9         |
| arenas/conquest:arenaOverpass         | 1933 → 639       | 1015 → 1057                | 71.9 → 29.1                | 35.6 / 21.7 / 13.2 → 15.6 / 6.5 / 5.9         | 10.1 → 20.8        | 7.4 → 14.0        |
| arenas/conquest:arenaRooftops         | 727 → 446        | 1311 → 1315                | 48.7 → 37.5                | 24.9 / 11.4 / 10.9 → 19.7 / 7.9 / 8.8         | 12.7 → 17.0        | 8.2 → 10.9        |
| arenas/conquest:arenaPowerPlant       | 117 → 135        | 72 → 349                   | 26.1 → 11.9                | 10.3 / 6.9 / 7.7 → 5.0 / 2.9 / 3.1            | 20.4 → 42.1        | 14.2 → 19.3       |
| arenas/conquest:arenaConstructionSite | 885 → 602        | 1415 → 1435                | 60.6 → 44.2                | 30.3 / 15.6 / 13.2 → 22.0 / 10.3 / 10.6       | 11.5 → 14.8        | 8.8 → 9.9         |
| arenas/conquest:arenaRailYard         | 1808 → 304       | 235 → 697                  | 81.4 → 23.1                | 34.8 / 25.7 / 19.4 → 11.6 / 5.4 / 4.9         | 9.0 → 23.2         | 6.3 → 13.0        |
| arenas/conquest:arenaFloodedDocks     | 3091 → 541       | 351 → 468                  | 100.6 → 28.1               | 47.5 / 34.4 / 17.1 → 15.2 / 6.2 / 5.5         | 7.7 → 19.7         | 6.1 → 9.1         |
| arenas/assault                        | 576 → 573        | 111 → 110                  | 27.1 → 24.9                | 14.5 / 5.8 / 5.6 → 13.4 / 5.3 / 5.2           | 22.0 → 23.1        | 10.5 → 11.3       |
| arenas/heist                          | 485 → 478        | 115 → 114                  | 24.5 → 19.7                | 13.3 / 4.9 / 5.3 → 10.3 / 4.1 / 4.5           | 23.4 → 29.8        | 13.5 → 15.4       |
| arenas/mission:m01-maszty             | 1151 → 1151      | 115 → 115                  | 28.6 → 45.3                | 15.4 / 7.2 / 5.1 → 22.0 / 12.4 / 9.5          | 23.1 → 13.5        | 8.8 → 6.2         |
| hub/hub                               | 641 → 641        | 183 → 183                  | 53.3 → 60.2                | 25.6 / 11.7 / 14.4 → 26.3 / 14.5 / 17.8       | 15.3 → 15.6        | 10.0 → 7.3        |
| combat/combatYard                     | 699 → 715        | 166 → 166                  | 33.8 → 50.0                | 17.8 / 7.5 / 7.2 → 22.0 / 13.0 / 13.5         | 22.0 → 15.0        | 14.2 → 6.6        |

Pomiar parami naprzemiennie (wersja przed i po w tym samym oknie czasu, kolejność zmieniana co przebieg,
2 przebiegi × 5 s po 3 s rozgrzewki; wczytanie = czas do stanu `room`) jest najuczciwszym porównaniem
w obecności obciążenia z zewnątrz:

| Arena              | calls      | trójkąty (tys.) | pipeline CPU ms | color CPU | normals CPU | bloomMask CPU | pipeline GPU ms | avg FPS      | wczytanie ms | sterta JS MB |
| ------------------ | ---------- | --------------- | --------------- | --------- | ----------- | ------------- | --------------- | ------------ | ------------ | ------------ |
| arenaContainerPort | 2861 → 358 | 1993 → 3789     | 10.3 → 2.9      | 4.8 → 1.6 | 3.4 → 0.7   | 1.9 → 0.6     | 11.6 → 4.1      | 73.0 → 204.1 | 1422 → 1468  | 89 → 96      |
| arenaFloodedDocks  | 3113 → 510 | 354 → 463       | 12.5 → 3.4      | 6.1 → 1.9 | 4.2 → 0.7   | 2.1 → 0.7     | 13.8 → 4.8      | 60.4 → 177.6 | 1352 → 1495  | 99 → 85      |
| arenaOverpass      | 1918 → 590 | 1013 → 1050     | 9.2 → 3.5       | 4.6 → 1.9 | 2.7 → 0.8   | 1.8 → 0.8     | 10.4 → 4.6      | 83.8 → 183.4 | 1391 → 1496  | 101 → 118    |
| arenaRailYard      | 1818 → 313 | 237 → 698       | 9.3 → 2.6       | 4.1 → 1.3 | 2.8 → 0.6   | 2.2 → 0.6     | 10.1 → 3.6      | 83.7 → 239.5 | 1326 → 1398  | 81 → 102     |

Wnioski: wywołania spadają 3,2–8× (Terminal kontenerowy 2861 → 358, Zalane Doki 3113 → 510, Rail Yard
1818 → 313, Overpass 1918 → 590); CPU `pipeline` jest ok. 3× niższy (przy CPU 4× 94–101 ms → 26–28 ms na
Terminalu i Dokach); czas GPU etapu też spada mimo większej liczby trójkątów. Czas wczytania i sterta JS bez
istotnej zmiany. Areny Dachów i Budowy zyskują mniej (dużo przezroczystych świateł, duże `batchCellM`).
Zostaje 60–110 wywołań przezroczystych świateł i stożków w przebiegu koloru oraz wrogowie (ok. 10–17
wywołań na wroga w każdym przebiegu). Zrzuty przed/po z tych samych pozycji kamery (start areny; Terminal,
Zalane Doki, Rail Yard, Dachy) nie różnią się wyglądem.

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
1 / 8 / 11 przebiegów (przy domyślnym stylu komiksowym `inkWidth > 0` dochodzi jeden przebieg maski
krawędzi: 9 / 12). Są to koszty strukturalne, nie wyniki pomiaru FPS.

Wszystkie zmiany działają na żywo, także podczas pauzy; deszcz zachowuje bazową
gęstość motywu, a ograniczenie stosuje tylko na czas aktualizacji oprawy.
Notka w ustawieniach pochodzi z `settings.pl.json`:
„Zmiany jakości są stosowane na bieżąco.” Zmiana rozdzielczości bloomu działa także
przy niezmienionym DPR. Bufory nieaktywnych efektów pozostają do ponownego użycia
i są zwalniane w `dispose()` pipeline. Zmiana liczby widocznych świateł może
spowodować jednorazową kompilację wariantu shadera.

Brak zapisu ustawień oznacza `medium` (`defaults()` w `save.ts`); aktywny profil w module `quality.ts`
przed pierwszym `applyQuality` to `high`. Istniejące `high` oraz starszy zapis bez
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

| Nazwa w glTF        | MaterialKind  | Domyślny kolor                            | Materiał          |
| ------------------- | ------------- | ----------------------------------------- | ----------------- |
| `mat_world`         | `world`       | `#ffffff`                                 | MeshToonMaterial  |
| `mat_enemy`         | `enemy`       | `#e0262b`                                 | MeshToonMaterial  |
| `mat_enemy_dark`    | `enemyDark`   | `enemy × tuning.vfx.enemyDarkShade` (0,3) | MeshToonMaterial  |
| `mat_interactive`   | `interactive` | `#080808`                                 | MeshToonMaterial  |
| `mat_enemy_glow`    | `enemyGlow`   | `#ff5050`                                 | MeshBasicMaterial |
| `mat_player_cyan`   | `player`      | `#00e5ff`                                 | MeshBasicMaterial |
| `mat_power_magenta` | `power`       | `#ff2bd6`                                 | MeshBasicMaterial |

`getMaterial(kind)` zwraca współdzieloną instancję z cache; nieznany rodzaj rzuca
`Error`. Trzy materiały toon współdzielą `DataTexture` 3×1 z progami 150, 200, 255,
filtrem `NearestFilter` i bez mipmap. Płaskie normalne pochodzą z modeli low-poly.
Domyślne kolory w tabeli to `tuning.render` (motyw `white`); motyw `neonStreet` nadpisuje je
(`world` `#394457`, `interactive` `#d9dde3` — jasne obiekty interaktywne; `enemy`, `enemyGlow`, `player`,
`power` bez zmian). Neony (`mat_neon_amber|green|violet|blue|white` `#ffae1a`/`#6dff4a`/`#8a5cff`/`#3d7bff`/`#fff1d6`,
`mat_light_white` `#fff1d6`) są unlit (`MeshBasicMaterial`) i mają `toneMapped = false`; ich kolor jest mnożony przez
globalny `powerLevel` 0..1 (`powerLevel.ts`; kryjówka obniża go przy spadku napięcia — także światła i napisy z sieci;
gracz, Rezonans i wrogowie oraz płomienie go ignorują). Materiały `enemyGlow`, `player`, `power` i wszystkie neony
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
Klucz: `DirectionalLight` w pozycji (6, 10, 4) względem celu w początku układu, bez cieni;
kolory `hemiSky`/`hemiGround`/`keyColor` z `tuning.render`. Domyślnie (white) półkula 0,6, klucz 2,4,
wszystko `#ffffff`; neonStreet: `hemiSky` `#7184b0`, `hemiGround` `#2b1f3d`, `keyColor` `#adc3ed`,
`hemiIntensity` 1,35, `keyIntensity` 1,9; hideout: `#6a7898`/`#41385c`/`#d8c6a8`, 1,4/1,1.
Górne powierzchnie są prawie białe, boczne jaśniejszym odcieniem szarości. Materiały toon
(`world`, `enemy`, `interactive`) cieniują 3 progami (150/200/255 z 255) — wynik to płaskie pasma bez gradientu.

Motyw `neonStreet` (poprawka oświetlenia): `hemiIntensity` 1,35 (ciemne partie czytelne, bryły i przejścia widoczne), `bloomStrength` 0,65 i `bloomRadius` 1,2 (neony świecą bez mlecznej mgiełki na całym kadrze). Światło dynamiczne i poświata neonów, hologramów i latarni: `docs/systems/city.md`, sekcja „Ocena świateł”; parametry w `tuning.city` (widoczne w lil-gui).
Domyślny renderer używa `NoToneMapping`; zachowaj to ustawienie, aby oba tryby
obrysu dawały tę samą paletę. Dynamiczne cienie pozostają wyłączone.

## Pipeline stylu

`StylePipeline` / `createRenderPipeline(renderer)` z `src/render/outline.ts`
nie wymagają EffectComposer. Renderer: `WebGLRenderer({ antialias: true })`
(wyłączone tylko w trybie lite), `NoToneMapping`, domyślna przestrzeń wyjściowa sRGB;
cele pośrednie są liniowe (HalfFloat), konwersja do sRGB następuje w ostatnim shaderze
(kompozycja albo pass impulsów). Pełny przebieg w tej kolejności (każdy pass pomijany, gdy wyłączony):

1. **Kolor** do celu liniowego HalfFloat z teksturą głębi 24 bit (rozmiar bufora rysowania,
   czyli CSS × DPR). Do sceny dodawany jest na ten przebieg quad **tła nieba**
   (`sky_background`: pełny ekran na dalekiej płaszczyźnie, bez zapisu głębi, `renderOrder`
   −1e9, więc rysuje się przed obiektami przezroczystymi; alfa = `skyGradient`). Kolor nieba:
   `mix(skyHorizon, skyTop, smoothstep(0, skyGradientHeight, up))`, gdzie `up` to składowa Y
   (świat) znormalizowanego promienia widzenia. `skyGradient = 0` zostawia kolor tła sceny.
   Tło sceny to `tuning.render.world`; gdy aktywny jest rozszerzony horyzont (patrz niżej) — `fogColor`.
2. **Normalne/głębia**: `scene.overrideMaterial = MeshNormalMaterial`, tło wyłączone, wyczyszczone na
   (0,0,0,0), cel `NearestFilter` z własną teksturą głębi. Obiekty ukryte w tym przebiegu:
   `userData.noOutline === true` oraz automatycznie przezroczyste materiały addytywne albo bez zapisu
   głębi (`noOutline.ts`) — bloom i odbicia nadal je rysują. Gdy odbicia są aktywne
   (`reflectionStrength × quality.reflections > 0`), zamiast `MeshNormalMaterial` działa wariant
   `WetNormals`: te same normalne, a kanał **A koduje `userData.wetness` materiału**.
3. **Odbicia** (`reflections.ts`, jeśli aktywne; patrz „Motywy Neon Noir”).
4. **Bloom selektywny** (`quality.bloom > 0`, `tuning.render.bloom > 0` i `bloomStrength > 0`; `bloom.ts`):
   maska w 1/2 rozdzielczości bufora (× `quality.bloomResolution`), w której kolor mają tylko
   materiały emisyjne: `userData.bloom === true`, albo (bez flagi) nasycony materiał unlit
   (Basic/Line/Sprite/Points, `max(r,g,b) − min(r,g,b) > 0.5`); `userData.bloom = false` wyłącza;
   `userData.bloomMaterial` to materiał zastępczy rysowany do maski (np. słaba emisja okien).
   Nieemisyjne materiały są pomijane bez wywołań rysowania; zasłanianie zapewnia tekstura głębi
   koloru (Z20 poniżej). Przezroczyste lub niezapisujące głębi, a nieemisyjne obiekty są w masce
   ukryte. Viewmodel i odbicia zachowują poprzednią maskę z czarnymi zasłonami.
   Potem **4 przebiegi rozmycia** w 1/4 rozdzielczości (× `bloomResolution`): Gauss 9-próbkowy
   (5 odczytów liniowych: waga 0,2270 w środku, 0,3162 przy ±1,3846 i 0,0703 przy ±3,2308 odstępu),
   kolejno X, Y z odstępem `bloomRadius`/rozmiar celu, potem X, Y z odstępem `2,5 × bloomRadius`
   (kaskada na wyniku pierwszej pary, nie równolegle). Wynik: RGB premultiplikowane, A = pokrycie.
5. **Maska krawędzi tuszu** (tylko gdy `inkWidth > 0`; osobny przebieg pełnoekranowy, cel HalfFloat
   `NearestFilter`): R = obrys sylwetki (głębia) × krycie z odległością, G = detal (normalne) ×
   krycie, B = dawny tusz FPP (`max` obu linii bez wygaszania), A = metryczna głębia źródła
   (najbliższa próbka w oknie 3×3). Sobel jak w kompozycji, ale bez grubości (zawsze 1 px).
6. **Kompozycja** (pełny ekran, jeden shader): kolejność operacji opisuje sekcja „Kolejność w shaderze
   kompozycji”. Rysuje wprost na ekran (lub do celu pośredniego passu impulsów).
7. **Pass impulsów** (`postFx = 1` i aktywny impuls; `postFx.ts`): aberracja
   chromatyczna, czerwone krawędzie, odcień i desaturacja Skupienia. Pomijany, gdy
   `damage` i `focus` wynoszą 0, więc w stanie spoczynku kosztu nie ma (kompozycja
   rysuje wtedy prosto na ekran).

Na początku każdej klatki `render()` woła `syncMaterials()` i `postFxState.update(min(frameDt, 0,25))`.
Tryb **lite** (`?debug=1&fx=lite`): jakość `low` z `pixelRatio` 0,25, bez deszczu i cząsteczek, bez antialiasingu,
limit 60 kroków symulacji na klatkę (`LITE_MAX_STEPS_PER_FRAME`); tylko do testów na programowym renderze.

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

Głębia jest linearyzowana według typu kamery (perspektywiczna lub ortograficzna) do metrycznej
głębi widokowej (wzdłuż osi patrzenia, nie odległość euklidesowa); piksele viewmodelu (surowa głębia
< `viewmodelDepth`) są przeliczane z powrotem na pełny zakres (`depth / viewmodelDepth`).
Sobel 3×3 na normalnych (RGB zakodowane `n*0,5+0,5`) i głębi, wagi `x·(y==0 ? 2 : 1)` oraz
`y·(x==0 ? 2 : 1)`; różnica głębi liczona względnie: `(głębia_próbki − głębia_środka) / głębia_środka`.
`depthEdge = |(dx,dy)| / 8`, `normalEdge = |(nx,ny)| / 8`. Gradienty Sobela są dzielone przez 8.
Grubość (`outlineThickness`) mnoży odstęp próbek w pikselach bufora GPU (nie CSS); kolor linii
to `outlineColor`. `outlineDepthThreshold` i `outlineNormalThreshold` to progi `step` (wyższy próg
usuwa drobniejsze krawędzie); `outlineThickness = 0` ukrywa linię.
Kontur zależy od odległości piksela od kamery (czytelność dalekich wrogów, ADR 0006 pkt 3):
`far = smoothstep(outlineFadeNear, outlineFadeFar, głębia)`. Linie wewnątrz bryły
(krawędzie normalnych) mnoży `1 − far·(1 − outlineFarNormal)`; obrys sylwetki (krawędź głębi)
jest mieszany `mix(1, behind, far·outlineFarOuter)`, gdzie `behind` = piksel jest dalszy od najbliższej
próbki sąsiedztwa o więcej niż `outlineDepthThreshold` (obrys ląduje na tle, nie na obiekcie).
Bliżej niż `outlineFadeNear` kontur jest taki jak wcześniej; dalecy wrogowie zostają
czerwonymi bryłami z cienkim obrysem zamiast ciemnych plam z linii na kończynach.
`outlineFarNormal = 1` i `outlineFarOuter = 0` przywracają kontur niezależny od odległości.
Z `inkWidth > 0` (domyślny styl komiksowy) kontur liczy tusz z maski krawędzi (sekcja niżej);
`outlineFade*` nadal działają w masce. Świecące piksele (kolor źródłowy: `smoothstep(0,7; 0,95; max(rgb))`
× `smoothstep(0,25; 0,5; nasycenie)`) wygaszają krawędź — neony i efekty nie dostają tuszu.
**`outline = 0` (lub `quality.outline = 0`) omija cały pipeline stylu** (zwykły `renderWithViewmodel`,
bez nieba z gradientu, mgły, bloomu, odbić i postFx; materiały nadal się synchronizują, a siatka
podłogi działa).

### Atmosfera i głębia

Gradient nieba jest rysowany w przebiegu koloru (patrz pkt 1 pipeline'u), a mgła w kompozycji
na podstawie bufora głębi (nie `scene.fog`):

- **Niebo**: piksele bez geometrii w głębi koloru (głębia ≥ 1) w kompozycji dostają tylko błysk
  burzy `+ skyFlashColor × skyFlash` (bez mgły). Błysk: kolor z `tuning.weather.skyFlashColor`
  (domyślnie `#9eadef` → stare składowe liniowe 0,62/0,68/0,95); `skyFlash` jest zerowany, gdy
  ustawienie `flashes` jest wyłączone.
- **Mgła odległości** (tylko piksele z geometrią): `smoothstep(fogNear, fogFar, głębia_metryczna) * fogStrength`
  ku `fogColor + skyFlashColor × skyFlash`; ta sama wartość rozjaśnia też kolor konturu, więc dalekie
  linie bledną. `fogStrength = 0` wyłącza (ale mgła wysokościowa działa niezależnie). Przy rozszerzonym
  horyzoncie (`scene.userData.horizon`) `fogStrength = 1`, a `fogNear/fogFar` pochodzą z `horizonParameters`.
- **Mgła wysokościowa** (`heightFogDensity × quality.heightFog`, spadek `heightFogFalloff`; piksele spoza
  viewmodelu): `1 − exp(−gęstość · długość_promienia · całka)`, gdzie całka to średnia `exp(−falloff·h)`
  wzdłuż promienia od oka do punktu (h = wysokość nad `floorY`, wariant graniczny przy poziomym promieniu).
  Łączenie z mgłą odległości: `fog = 1 − (1 − fogDist)(1 − fogWys)`.
- **Siatka podłogi** (`materials.ts`, `onBeforeCompile` materiału `world`): linie co
  `gridSize` m w przestrzeni świata, tylko na powierzchniach poziomych (normalna z
  pochodnych pozycji, `smoothstep(0,85; 0,95; |n.y|)`, działa z `InstancedMesh`), `kolor *= 1 − gridContrast · linia`,
  grubość `gridLineWidth` px, zanik `1 − smoothstep(0,15; 0,4; szerokość_komórki_w_px)` (moiré).

### Kolejność w shaderze kompozycji

Dla każdego piksela (kolejność ma znaczenie dla odtworzenia 1:1):

1. Obrys (Sobel + ewentualny tusz z maski), wygaszanie z odległością.
2. Odbicie neonów (jeśli `reflectionStrength > 0`, piksel z geometrią spoza viewmodelu): do `rgb`
   dodawane `reflectionMap × reflectionStrength × wet(A normalnych) × floorMask × puddle × fresnel × inside`.
   `floorMask` = normalna zwrócona w górę (`n.y > 0,9`) i `|y − floorY|` w tolerancji `reflectionFloorTolerance`
   (miękko od połowy tolerancji); UV odbicia z projekcji odbitej kamery plus falowanie
   `sin(z·19 + t·2,3)`, `sin(x·23 − t·1,7)` × `reflectionDistortion · 0,35`; kałuże: tekstura `asphalt_puddles`
   w XZ (skala 0,25), a bez niej szum proceduralny; `puddle = mix(1, 0,18 + 0,82·kałuża, reflectionPuddles)`;
   `fresnel = 0,25 + 0,75·(1 − |kierunek.y|)³`.
3. Styl komiksowy (jeśli `celStrength`, `hatchStrength` lub `paintStrength` > 0; tylko geometria spoza viewmodelu):
   `plain = (1 − smoothstep(0,45; 0,7; nasycenie)) × (1 − smoothstep(0,75; 0,95; jasność))` — neony, wrogowie
   i efekty zostają czyste. Cel: tylko cienie (`1 − smoothstep(0,38; 0,55; jasność)`), pasma
   `floor(L·celBands) + smoothstep(0,78; 1; fract)`, dół pasma nie niżej niż 0,6·L,
   mnożnik `mix(1, min(pasmo/L, 1), celStrength·plain·cienie)`. Farba: `rgb *= 1 + (szum − 0,5)·paintStrength·plain`
   (szum wartości 3D w przestrzeni świata: 0,6 × skala 1,7 + 0,4 × skala 6). Kreski: ukośne linie co `hatchSpacing` px
   (`fract(px.x·0,7 + px.y)`), tylko w półcieniach wokół `hatchThreshold`, przerywane szumem, kolor `outlineColor`.
4. Niebo/mgła (wyżej).
5. `rgb = mix(rgb, kolor_linii, krawędź)`.
6. Bloom „over”: `rgb·(1 − clamp(a·bloomStrength, 0, 1)) + bloom.rgb·bloomStrength`.
7. Winieta: `rgb *= 1 − vignetteStrength · smoothstep(vignetteRadius, vignetteRadius + vignetteSoftness, r)`,
   `r = |(uv − 0,5)·(aspect, 1)| / |(aspect, 1)| · 2`. `postFx = 0` zeruje siłę winiety.
8. Konwersja do przestrzeni wyjściowej (sRGB).

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

Gdy ustawienie `flashes` jest wyłączone, impuls obrażeń jest zerowany (`hit()` nic nie robi); Skupienie
działa nadal. Kompozycja zapisuje wtedy do celu pośredniego (HalfFloat, bez głębi), a pass impulsów rysuje
na ekran. Kolejność w shaderze impulsów (`r` = odległość od środka znormalizowana do 0..1 po przekątnej
z uwzględnieniem proporcji):

1. Aberracja: kanał R z `uv + (uv−0,5)·damage·damageAberration·(0,4 + r)`, B z `uv − …`, G bez przesunięcia.
2. Desaturacja Skupienia: `mix(rgb, luma, focus·focusDesaturate)`, luma `0,2126/0,7152/0,0722`.
3. Odcień Skupienia: **mnożenie** koloru przez `mix(1, focusTintColor, focus·focusTint)`.
4. Czerwone krawędzie: `mix(rgb, damageTintColor, damage·damageTint·smoothstep(0,35; 1; r))`.
5. Konwersja do sRGB.

Winieta (`vignetteStrength`, `vignetteRadius`, `vignetteSoftness`) działa w kompozycji, więc
nie dodaje passu. `postFx = 0` wyłącza winietę i impulsy.

`bindEvents(bus)` podpina zdarzenia (wywołane w `main.ts` zaraz po utworzeniu busa;
odpina je `dispose()`). `fxState` daje bezpośredni dostęp do stanu; komenda konsoli
debug `fx <damage|focus|off>` uruchamia impulsy do oceny wizualnej.

### Parametry `tuning.render`

| Pole                                                                       | Domyślnie                    | Znaczenie                                                                                               |
| -------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `outline`, `outlineThickness`, `outlineColor`                              | 1, 1, `#30343b`              | kontur (0 = cały pipeline stylu pominięty), mnożnik odstępu próbek, kolor linii (preset `b`: `#050507`) |
| `outlineDepthThreshold`, `outlineNormalThreshold`                          | 0,025, 0,2                   | progi krawędzi (preset `b`: 0,02, 0,24)                                                                 |
| `outlineFadeNear`, `outlineFadeFar`, `outlineFarNormal`, `outlineFarOuter` | 6, 16, 0, 1                  | kontur z odległością (preset `b`: `outlineFarNormal` 0,5)                                               |
| `bloom`, `postFx`                                                          | 1, 1                         | przełączniki jakości (0 pomija pass)                                                                    |
| `bloomStrength`, `bloomRadius`                                             | 0,6, 1,2                     | siła halo, mnożnik odstępu próbek rozmycia                                                              |
| `skyGradient`, `skyTop`, `skyHorizon`, `skyGradientHeight`                 | 1, `#ffffff`, `#e3e7ea`, 0,5 | gradient nieba                                                                                          |
| `fogStrength`, `fogColor`, `fogNear`, `fogFar`                             | 0,85, `#eef1f3`, 14, 80      | mgła odległości (m)                                                                                     |
| `skyFlash`                                                                 | 0                            | błysk burzy: dodatek do nieba i mgły (0..1), ustawia scena                                              |
| `viewmodelDepth`                                                           | 0,01                         | ułamek zakresu głębi dla rąk i przedmiotu                                                               |
| `gridSize`, `gridContrast`, `gridLineWidth`                                | 2, 0,1, 1                    | siatka podłogi (m, 0..1, px)                                                                            |
| `vignetteStrength`, `vignetteRadius`, `vignetteSoftness`                   | 0,2, 0,55, 0,6               | winieta                                                                                                 |
| `damagePulseS`, `damagePulseMin`, `damagePulseHpGain`                      | 0,4, 0,35, 2                 | czas i siła impulsu obrażeń                                                                             |
| `damageAberration`, `damageTint`, `damageTintColor`                        | 0,018, 0,5, `#ff1a2a`        | aberracja i czerwień krawędzi                                                                           |
| `focusTint`, `focusTintColor`, `focusDesaturate`                           | 0,14, `#ff2bd6`, 0,3         | Skupienie                                                                                               |
| `focusFadeInS`, `focusFadeOutS`                                            | 0,15, 0,35                   | narastanie i zanik Skupienia                                                                            |

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

## Integracja w main.ts

`main.ts` tworzy jedną instancję `createRenderPipeline(renderer)`, wywołuje `pipeline.bindEvents(bus)`, w `render` każdej
klatki `pipeline.render(three, camera, frameDt)` (po `scene.render(alpha, frameDt)`), w `resize` `pipeline.setSize(w, h)`
(rozmiar CSS), a przy zamykaniu `pipeline.dispose()`. Pipeline nie dodaje świateł do scen automatycznie: sceny używają
`createStyleLights()`. Scena `style-test` jest zarejestrowana.

## Rozgrzewka renderu (wczytywanie sceny)

Pomiar S1-04 (RTX 4070, build produkcyjny, 20 XI 2026) wykazał jedną długą klatkę (0,2–2,9 s) tuż po zdjęciu ekranu ładowania:
m01 z kryjówki 1,6–1,9 s, arena Przejęcia „Container Port” 2,2–2,9 s, napad na magazyn 2,3–2,7 s. Przyczyna: Three.js kompiluje i
linkuje shadery synchronicznie przy pierwszym rysowaniu (`WebGLProgram.getUniforms` → `onFirstUse` czeka na `LINK_STATUS`), a
programów jest ok. 155 (ok. 66 koloru i ok. 90 wariantów przebiegów stylu: normalne, wilgotne normalne, maska bloomu z głębią
koloru, maska odbić, kompozycja), każdy kompilowany po kolei.

### Diagnoza

Profil CPU V8 przez CDP (build bez minifikacji, próbkowanie 250 µs; czasy zawyżone ok. 1,5–2× przez profiler):

| Krok                                                                                                           | m01 (misja)                     | Container Port (Przejęcie)      | Kiedy                           |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| Walidacja zod pokoi i trybów (`loadRoomDefinitions`: `validateLayout`, `walkable`, nawigacja w `validateMode`) | ok. 450 ms                      | ok. 550 ms                      | import modułów, ekran ładowania |
| `ArenaNavigation` w init sceny (poza walidacją)                                                                | w sumie init ok. 120 ms         | ok. 220 ms                      | init, ekran ładowania           |
| `batchStaticGeometry` + `buildLayout` + `loadDecor`                                                            | ok. 50 ms                       | ok. 130 ms                      | init, ekran ładowania           |
| Rapier (`initPhysics`, collidery)                                                                              | ok. 50 ms                       | ok. 50 ms                       | init, ekran ładowania           |
| Kompilacja i link shaderów przy pierwszym `render`                                                             | **2,7 s** (1,6 s bez profilera) | **4,4 s** (2,9 s bez profilera) | **pierwsza klatka gry**         |
| Wysłanie tekstur (`texSubImage2D`) w pierwszych klatkach                                                       | ok. 100 ms                      | -                               | pierwsze klatki gry             |

Ciężkie kroki init (nawigacja, scalanie statyki, collidery, równoległe wczytywanie GLB przez `Promise.all` w `buildLayout`) już
były w `init()` za ekranem ładowania; nie było czego przenosić ani zrównoleglać. Jedyny długi krok w trakcie gry to kompilacja
shaderów, więc naprawą jest rozgrzewka renderu.

### Mechanizm

`StylePipeline.warmUp(scene, camera, cancelled?)` (`src/render/outline.ts`, nowa publiczna metoda; logika `render`, `bloom.ts`,
`reflections.ts`, `viewmodelLayer.ts` bez zmian):

1. **Faza 1, kompilacja równoległa.** Pełny przebieg pipeline'u (`this.render(scene, camera, 0)`) przy podmienionym
   `renderer.render`: zamiast rysować, każde wywołanie woła `renderer.compileAsync(scene, camera)` z dokładnie tym samym
   stanem co prawdziwy przebieg (cel renderu, maska warstw kamery z `renderWithViewmodel`, materiały zastępcze maski bloomu i
   odbić). Przebieg normalnych używa `scene.overrideMaterial`, którego `compile` nie widzi, więc `compileForPass` podmienia na ten
   czas materiały widocznych obiektów. Wszystkie programy kompilują się naraz (`KHR_parallel_shader_compile`) i trafiają do cache
   pod kluczami identycznymi z późniejszymi. Samo `compileAsync(scene)` na starcie nie wystarcza: kompiluje programy dla celu
   `null` (ekran), a gra rysuje do buforów HalfFloat (inny `outputColorSpace`, więc inny klucz) i zostawiłoby ok. 90 programów
   na pierwszą klatkę.
2. **Faza 2, prawdziwy przebieg.** Jeden `render` bez odrzucania poza kadrem (`frustumCulled = false` na czas wywołania, flagi
   przywracane w `finally`): wysyła tekstury i bufory obiektów spoza kadru i alokuje cele pipeline'u w docelowym rozmiarze.
   Programy są już gotowe, więc trwa ok. 0,3 s.

`src/render/renderWarmUp.ts`: `setRenderWarmUp` (tylko `main.ts`) i `warmUpRender(timeoutMs?)`. Limit
`tuning.ui.renderWarmUpTimeoutMs` = 10 s; po nim `cancelled()` zwraca true i faza 2 nie rusza. Błąd rozgrzewki tylko loguje
(patrz [reliability.md](reliability.md#rozgrzewka-renderu-przy-wczytywaniu-sceny)).

Gdzie jest wołana:

- `main.ts`: `resize()` przed `scene.init()` (cele w docelowym rozmiarze; wcześniej `resize` był po init), po init
  `await warmUpRender()`, dopiero potem `window.__neoryder` (debug), `scene_loaded` (zdjęcie ekranu startowego) i `loop.start()`.
  Dotyczy `hub`, `mission`, `room-test` i pozostałych scen. Pomijana w `fx=lite`.
- `RunScene.openRoom`: po `room.init()`, przed `roomReady` (ekran ładowania pokoju zasłania obraz; dotyczy Przejęcia, napadu,
  kradzieży i rund runu). Po `await` sprawdzana jest flaga `disposed`.

Zachowane: kolejność i determinizm symulacji (rozgrzewka nie woła `step`, `Rng` ani `scene.render`; `pipeline.render` z `dt = 0`)
oraz wygląd (żadnych zmian materiałów ani shaderów).

### Wyniki

RTX 4070, build produkcyjny, jakość medium, 1920×1080, `npm run perf:bench -- --scenario transition,arenas --runs 2`. Maszyna była
współdzielona z innymi pomiarami, więc czasy bezwzględne szumią o ok. ±20%; efekt (kilkanaście do kilkudziesięciu razy) jest dużo
większy. „Max klatka 3 s” to najdłuższa klatka w pierwszych 3 s po zdjęciu ekranu ładowania (próg zadania: < 100 ms); „gotowa” to czas
od początku nawigacji do chwili, gdy scena jest gotowa i ekran znika; „płynna” to koniec ostatniej klatki > 50 ms w tym oknie (od tej
chwili brak zacięć). Wartości: przebieg 1 / przebieg 2.

| Przypadek               | max klatka 3 s (ms) przed |      po | gotowa (ms) przed |          po | płynna (ms) przed |          po |
| ----------------------- | ------------------------: | ------: | ----------------: | ----------: | ----------------: | ----------: |
| transition/hub->mission |               2444 / 1923 | 80 / 86 |       2332 / 1369 | 1513 / 1615 |       4983 / 3447 | 1658 / 1768 |
| arenaContainerPort      |                      2243 | 74 / 68 |              1576 | 2200 / 2251 |              4018 | 2334 / 2481 |
| arenaOverpass           |                      2878 | 52 / 64 |              1556 | 2030 / 2220 |              4433 | 2082 / 2338 |
| arenaRooftops           |                1310 / 913 | 48 / 53 |       2118 / 1617 | 2062 / 2176 |       3861 / 2770 | 2062 / 2281 |
| arenaPowerPlant         |                 244 / 200 | 49 / 46 |       1735 / 1270 | 1730 / 1729 |       1979 / 1470 | 1730 / 1729 |
| arenaConstructionSite   |                 707 / 677 | 64 / 89 |       1881 / 1688 | 1988 / 1958 |       2862 / 2593 | 2176 / 2096 |
| arenaRailYard           |               1141 / 1005 | 68 / 67 |       1389 / 1372 | 1953 / 1850 |       2865 / 2623 | 2151 / 2053 |
| arenaFloodedDocks       |                 652 / 608 | 94 / 98 |       1503 / 1376 | 1900 / 1721 |       2392 / 2236 | 2053 / 1870 |
| assault                 |                 312 / 317 | 70 / 53 |       1219 / 1218 | 1471 / 1386 |       1531 / 1534 | 1596 / 1481 |
| heist                   |               2724 / 2331 | 84 / 76 |       1437 / 1325 | 1830 / 1671 |       4322 / 3848 | 2037 / 1866 |
| mission:m01-maszty      |                 454 / 454 | 77 / 71 |       1271 / 1287 | 1565 / 1433 |       1885 / 1740 | 1696 / 1551 |

Wniosek: najdłuższa klatka w pierwszych 3 s spadła z 0,2–2,9 s do 46–98 ms we wszystkich przypadkach (kryterium < 100 ms spełnione; najbliżej progu FloodedDocks 94 / 98 ms). Czas „gotowa” rośnie o 0,2–0,6 s (kompilacja przeniesiona za ekran ładowania, równolegle), ale czas do płynnej gry maleje o ok. 50–60% w przejściu do misji i napadzie na magazyn (kradzież), o ok. 40–50% w Container Port i Overpass, a w pozostałych przypadkach jest porównywalny lub krótszy. Jeden pomiar sprzed rozgrzewki (przebiegi sprzed poprawki: `base3`) i jeden po (`fix5`); kryterium „ładowanie nie dłuższe niż o 10%” spełnia czas do płynnej gry, nie czas „gotowa” (patrz uwaga w raporcie zadania).

Z `--cpu-throttle 4` (jeden przebieg, wartości w ms; po rozgrzewce najdłuższa klatka spada z 0,7–2,9 s do 0,25–0,43 s; kompilacja i faza 2 trwają przy 4× wolniejszym CPU dłużej, więc „gotowa” rośnie o 1–3 s, a w ciężkich arenach także „płynna”, bo koszt samej klatki areny przy tym throttlingu przekracza 50 ms):

| Przypadek               | max klatka 3 s (ms) przed |  po | gotowa (ms) przed |   po | płynna (ms) przed |    po |
| ----------------------- | ------------------------: | --: | ----------------: | ---: | ----------------: | ----: |
| transition/hub->mission |                      2470 | 247 |              5347 | 6357 |              8244 |  7109 |
| arenaContainerPort      |                      2856 | 397 |              6231 | 9342 |              9086 | 12307 |
| arenaOverpass           |                         - | 369 |                 - | 8406 |                 - | 11377 |
| arenaRooftops           |                      1932 | 337 |              7779 | 9571 |             10741 | 12258 |
| arenaPowerPlant         |                       685 | 325 |              6147 | 8168 |              7386 |  9022 |
| arenaConstructionSite   |                      1680 | 347 |              7684 | 9542 |             10641 | 12542 |
| arenaRailYard           |                      1782 | 368 |              6199 | 8918 |              9193 | 11884 |
| arenaFloodedDocks       |                      1536 | 429 |              6155 | 8425 |              9155 | 11392 |
| assault                 |                       991 | 317 |              5484 | 6424 |              7091 |  7253 |
| heist                   |                      2780 | 312 |              5546 | 6569 |              8502 |  7444 |
| mission:m01-maszty      |                      1376 | 349 |              5590 | 6781 |              7614 |  7724 |

### Ograniczenia

- Rozgrzewka obejmuje obiekty obecne w scenie po `init()` (także poza kadrem). Materiały tworzone później (nowy typ wroga z fali,
  nowe efekty VFX, dodatkowe światła) nadal kompilują się przy pierwszym użyciu.
- Wariant shadera zależy od liczby świateł w scenie (`quality.maxLights`): zmiana liczby aktywnych świateł w trakcie gry kompiluje
  wariant jednorazowo, tak jak wcześniej.
- Ukryte obiekty (pule efektów, ręce przy wyłączonym viewmodelu) są pomijane w przebiegach maski, bo kompilacja bierze tylko
  obiekty widoczne; pokazywanie ich na czas rozgrzewki nie dało mierzalnego zysku, a niosło ryzyko (`onBeforeRender` nieaktywnych
  widoków), więc go nie zastosowano.
- Faza 2 renderuje scenę z `frustumCulled = false` (jedna klatka za ekranem), więc przy bardzo dużych arenach trwa nieco dłużej.

### Pomiar i debug

`tools/perf/benchmark.mjs` zapisuje dla każdego przypadku `first3s` (`maxMs`, `top5Ms`, `over50`, `over100`, `timeToReadyMs`,
`timeToSmoothMs`): klatki liczone od momentu „scena gotowa” wykrywanego w samej stronie (pętla rAF, czas z `performance.now()`, bo
po długim zadaniu znacznik rAF podaje starszy czas vsync), bez klatek wczytywania. Opcja `--dist <katalog>` porównuje gotowe buildy
(przed/po) bez przebudowy. Ponieważ `window.__neoryder` powstaje dopiero po rozgrzewce, osobny hak `query('sceneReady')` nie był
potrzebny. Weryfikacja: `tests/unit/renderWarmUp.test.ts` (kolejność kompilacji i rysowania, materiał zastępczy, flagi, limit czasu,
ciężkie kroki areny w `init()`), `tests/unit/runScene.test.ts` (wywołanie po init pokoju, błąd i dispose podczas rozgrzewki). Ręcznie:
`?scene=mission&mission=m01-maszty&debug=1`, w profilerze Chrome pierwsze klatki po zniknięciu ekranu nie mają `getUniforms` /
`onFirstUse` rzędu setek ms.

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

`tests/e2e/style.spec.ts` porównuje canvas z wzorcem (`maxDiffPixelRatio: 0.02`; wzorzec odświeża
`npm run e2e -- tests/e2e/style.spec.ts --update-snapshots`). Jednostkowe testy renderu obejmują
mapowanie, cache, gradient, synchronizację, przebiegi i przywracanie stanu,
przełączniki bloom/postFx, maskę emisyjną, impulsy obrażeń i Skupienia, siatkę
podłogi i zwalnianie zasobów (`renderPostFx.test.ts`);
test sceny obejmuje fallback, GLB, instancje i zwalnianie zasobów.

## Motywy Neon Noir

`src/data/themes/{white,neonStreet,hideout}.json` zawierają pełne zestawy parametrów
`render` oraz dane `rain` dla modułu deszczu. Schemat zod znajduje się w
`themeSchema.ts`, eager loader i wybór URL w `themes.ts`. Motyw `white` zachowuje
wszystkie wcześniejsze wartości `tuning.render`; nowe efekty są wyłączone.
`applyTheme()` zapisuje poprzedni stan i zwraca idempotentne przywrócenie.
Motyw `hideout` (kryjówka) to neonStreet z cieplejszą, ciaśniejszą atmosferą, bez deszczu i panoramy:
`hemiSky` `#6a7898`, `hemiGround` `#41385c`, `keyColor` `#d8c6a8`, `hemiIntensity` 1,4, `keyIntensity` 1,1,
`reflectionStrength` 0,6, `reflectionPuddles` 0,45, `heightFogDensity` 0,012, `bloomStrength` 0,8, `bloomRadius` 1,4,
`skyTop` `#05070d`, `skyHorizon` `#1c1612`, `fogStrength` 0,85, `fogColor` `#241a16`, `fogNear` 6, `fogFar` 60,
`vignetteStrength` 0,28; `rain.enabled = false`. Motyw `neonStreet` (rdzeń wyglądu): `outlineThickness` 0,7,
`outlineColor` `#0c1220`, `skyTop` `#070b16`, `skyHorizon` `#3a2a2a`, `skyGradientHeight` 0,65, `fogStrength` 0,72,
`fogColor` `#2b1f3d`, `fogNear` 18, `fogFar` 135, `heightFogDensity` 0,025, `heightFogFalloff` 0,48, `reflectionStrength` 0,95,
`enemyRimStrength` 0,85, `gridContrast` 0, deszcz: gęstość 0,65, prędkość 18, `windX` 1, kolor `#8294b0`, krycie 0,26, burza włączona;
materiały: concrete `#56627a`, asphalt `#2a3344`, metal `#435169`, facade `#46516a`, trim `#8894a8`, glass `#18243a`,
cable `#171d2a`, paint `#3e5a48`, lacquer `#2c3766`, rust `#a39a90`, corrugated `#7a8599`, plastic `#4a5d7a`, hivis `#d08a1c`,
rubber `#3a3d44`, wood `#9c8a76`, fabric `#5a4c86`, machine `#66718a`, paving `#6d7890`, plaster `#6a7080`, hazard `#e09a1a`.
Motyw `white` ma wszystkie materiały `#ffffff` (cable i rubber `#080808`), `outlineThickness` 1, `outlineColor` `#30343b`,
efekty miejskie wyłączone. Pola `inkWidth`, `celBands` itd. są w motywie opcjonalne (brak = styl wyłączony); stały motyw nadpisuje
tylko to, co zdefiniuje, a `reapplyLook()` nakłada próbkę stylu po motywie.
Pokoje i arena posiadają `SceneAtmosphere`, która stosuje motyw i sprząta go
przy opuszczaniu sceny. `?theme=<id>` nadpisuje dane układu. Nieznany identyfikator
ostrzega raz i wybiera white. Deszcz nie jest tu renderowany. `SceneAtmosphere` ustawia też tło sceny (`world`, przy rozszerzonym horyzoncie
`fogColor`), `scene.userData.reflectionFloorY`, kamerę (`near`/`far` z horyzontu) i ciemny grunt zewnętrzny
(`tuning.horizon.groundColor` `#151923`, `groundOffsetM` 0,12 pod bryłami).

Materiały miejskie (`src/render/urbanMaterials.ts`, lista `urbanKinds`) są
materiałami Standard i przyjmują kolorowe PointLight (limit 8 obsługuje integrator
świateł). Rozpoznawane po nazwie glTF `mat_<rodzaj>`; kolor bazowy to
`tuning.render[rodzaj]` (nadpisywany przez motyw), a wygląd definiuje tabela
`urbanLooks`: tekstura, `scale` (powtórzenia na metr), roughness, metalness,
`bump` (mnożnik reliefu) i `wetness`. Rzut tekstur jest trójplanarny w przestrzeni
świata.

Rodzaje z danych (`src/data/render/{portMaterials,arenaMaterials,portRailMaterials,overpassMaterials}.json`,
walidowane zod; 39 wpisów, nazwy unikalne) uzupełniają tabelę poniżej o materiały aren, portu, estakady i torów
(`container_navy|olive|ochre|graphite`, `crane_paint`, `quay_concrete`, `quay_lines`, `rubber_fender`, `steel_grating`,
`overpass_concrete`, `smog_soot_wall`, `roof_tar`, `roof_hvac_metal`, `market_tarp`, `formwork_plywood`, `concrete_raw_cast`,
`slag_heap`, `cooling_tower_concrete`, `power_quay_floor`, `turbine_hall_floor`, `gas_station_tiles`, `highway_asphalt_worn`,
`flood_brick_algae`, `boardwalk_planks`, `canal_stone_wall`, `canal_water`, `hazard_stripes_worn`, `excavation_dirt`,
`scaffold_planks`, `ship_hull_paint`, `ship_deck_steel`, `rail_ballast`, `rail_sleeper_concrete`, `maglev_body_panel`,
`snow`, `snow_asphalt`, `snow_concrete`, `overpass_street`, `overpass_forecourt`). Wpis ma pola: `texture`
(plik w `surfaces/`), `themeTint` (nazwa koloru motywu, np. `concrete`) albo `tint` (hex), `scale`, `roughness`,
`metalness`, `bump`, `wetness`, opcjonalnie `flat`. Powtórzona nazwa w dwóch plikach rzuca błąd przy ładowaniu (z nazwą klucza i obu plików);
`scaffold_planks` i `hazard_stripes_worn` pochodzą tylko z `overpassMaterials.json`.
`"flat": true` daje zwykły `MeshStandardMaterial` w barwie `tint` (także w motywie `white`), bez tekstury, reliefu
i shadera miasta — dziś używa go tylko `canal_water` (`#24324a`, rough. 0,24). Poza tym `tint` jest stosowany tylko gdy
`citySurfaceDetail > 0` (wyjątki: `turbine_hall_floor`, `power_quay_floor`, `overpass_street`, `overpass_forecourt`
zachowują `tint` zawsze). Wszystkie tekstury z tej listy istnieją w `public/assets/textures/surfaces/` (`.webp`).

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

Odbicia (`reflections.ts`) używają kamery odbitej względem płaszczyzny podłogi (`scene.userData.reflectionFloorY`, ustawiane przez `SceneAtmosphere`, zwykle `playerSpawn.y`),
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

## Kamera i renderer

`PerspectiveCamera(fov, aspect, near 0,1, far 220)`; `fov` startuje z `tuning.camera.fov` (90), po wczytaniu ustawień
jest nadpisany przez `settings.fov` (zakres 60–110, domyślnie 90) i odświeżany na żywo. `near/far` ustawia `SceneAtmosphere`
z `horizonParameters` (patrz niżej). Jakość `high` ma `pixelRatio = devicePixelRatio`, `medium` 1, `low` 0,75.
Kołysanie, wstrząs i kick FOV liczy `src/player/fpsCamera.ts` (czas rzeczywisty klatki, `dt ≤ 0,1 s`), strojenie `tuning.camera`:
FOV docelowy = `fov + sprintFovKick` (6) przy sprincie `+ dashFovKick` (12) w dashu, wygładzany `1 − exp(−fovLerpRate·dt)` (9);
wysokość oczu wygładzana `eyeLerpRate` 16; kołysanie (`bobEnabled`) tylko na ziemi poza ślizgiem przy prędkości > 0,5 m/s:
`bobY = |sin(faza)|·bobAmount (0,03)·waga`, `bobX = cos(faza)·bobAmount·0,5·waga`, faza rośnie o `2π·droga/bobStride (2,4 m)`,
waga dąży do `min(1, prędkość/walkSpeed)` z tempem 10/s; lądowanie (`speed ≥ 3`) ugina kamerę o `min(landingDipMax 0,16, speed·landingDipPerSpeed 0,012)` m,
powrót `exp(−landingRecoverRate 9·dt)`. Wstrząs: trauma 0..1 (`camera_shake`, trafienia: gracz dostaje `min(1, obrażenia/shakeDamageRef 40)` na 0,35 s,
trafienie wroga przez gracza ×`shakeOnHitScale` 0,3 na 0,2 s), wygasa liniowo; amplituda = `trauma² · shakeMax (0,4) · settings.screenShake`;
pochylenie/odchylenie/przechył = amplituda · `shakeMaxAngleDeg` (5°) · szum gładki (suma sinusów 1, 2,17, 4,33 rad/s · `shakeFrequency` 22),
przesunięcie `shakeMaxOffset` 0,06 m. Celowanie mnoży FOV przez `lerp(1, aimFovScale, aim)`. Rotacja kamery w kolejności YXZ.

## Horyzont i zasięg widzenia

Wartości z `horizonParameters`: rozszerzenie włącza się, gdy promień XZ lub wysokość obwiedni > `legacyRadiusM` (50 m);
pierścienie `66, 92, 124, 162 m + offset` (offset = `max(0, promień + ringClearanceM 20 − 66)`), kopuła
`hypot(pierścień4 + domeClearanceM 40, wysokość) + promień` (małe układy: `legacyDomeM` 100), `far = max(220, kopuła + clipClearanceM 32)`,
`near = max(0,1, far / nearRatio 2200)`, mgła: `fogNear/fogFar × min(far/220, (far − 32)/fogFar)`. Poza wspólną obwiednią
nic nie dodaje collidera.

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
- Preset `b` nadpisuje w `tuning.render`: `outlineThickness` 1, `outlineColor` `#050507`, `outlineNormalThreshold` 0,24,
  `outlineDepthThreshold` 0,02, `outlineFarNormal` 0,5, `celBands` 3, `celStrength` 1 (oraz parametry tuszu z tabeli niżej);
  `a` = to samo bez cel. Preset `c`: `outlineColor` `#050507`, progi 0,22 / 0,018, `outlineFarNormal` 0,6, `celBands` 3, `celStrength` 1,
  `hatchStrength` 0,95, `hatchThreshold` 0,45, `hatchSpacing` 7, `paintStrength` 0,3. Bez parametru `?look=` aktywny jest `b`;
  `?look=off` nie nakłada niczego (obowiązują wartości motywu: `inkWidth` 0).
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
