# Areny Przejęcia

Wspólna biblioteka generatorów dużych aren (ADR 0011 / D5), API prymitywów,
walidacja i rzuty SVG: [arena-generators.md](arena-generators.md).

`src/data/modes/conquest.json` wskazuje listę `arenas`. Arena jest istniejącą
definicją pokoju combat z metadanymi `arena`; nie ma osobnego loadera geometrii.
`arena.exclusive` wyłącza port z puli zwykłego runu. Dotychczasowe dane
combatRing mają dodatkowe punkty/spawny trybu, bez zmiany zwykłego układu.
Wybór, zgodność `roomId` i zapis: [modes.md](modes.md).

## Silnik dużych map

Arenę definiuje się w formacie pokoju. `arena.points` zawiera 3–5 stref
z kolejnymi literami od A do E. `arena.maxAlive` może zwiększyć domyślny
limit z 8 do 12, a `arena.enemyTickets` może nadpisać domyślną pulę 120.
Wysokie punkty potrzebują płyt i ramp oznaczonych `walkable`, wraz z
`navigationMaxRiseM` i `navigationHeadroomM`.

`arena.spawnRing: { minM, maxM }` włącza wybór z co najmniej 16 różnych
pozycji w `arena.spawnPoints` (lub z puli pokoju). Pozycja w puli areny
może podać `y`. Domyślnie spawn jest na wysokości podłogi gracza.
Silnik odrzuca zajęte miejsca, pozycje bez wolnego marginesu i miejsca
bliższe niż minimum mapy lub wspólne 15 m. W pierścieniu najpierw wybiera
spośród punktów zasłoniętych geometrią w raycaście Rapiera. Z tej puli
bierze miejsce najbliższe spornej strefie lub potencjalnemu celowi wroga.
Jeśli pierścień jest pusty, wybiera najbliższy dozwolony spawn za jego
zewnętrzną krawędzią. Remisy rozstrzyga `Rng`.

Nawigacja warstwowa używa pól `Int32Array` budowanych na żądanie,
a w kroku symulacji przegląda tylko prosty odcinek do zakrętu. Dla
syntetycznej areny 450×300 m test używa komórek 2 m, dwóch ramp,
trzech poziomów i pięciu stref. Sprawdza dojście ze wszystkich
spawnów w walidatorze, a także ruch Szturmowca do każdej strefy
w scenie z Rapierem.

| Pomiar z `arenaPerf.test.ts`                               |         Wynik | Budżet ADR 0011 |
| ---------------------------------------------------------- | ------------: | --------------: |
| `ArenaSurfaceNavigation`, siatka i pięć pól                |     237,60 ms |        ≤ 500 ms |
| `ArenaNavigation`, siatka i pięć pól                       |     245,73 ms |        ≤ 500 ms |
| `RoomScene`, 12 wrogów, średnia z 600 kroków po rozgrzewce | 0,759 ms/krok |     ≤ 2 ms/krok |

Pole odległości zajmuje cztery bajty na węzeł i punkt docelowy. Dane
areny określają `batchCellM` i `navigationCellM`. Budżet 800 wywołań
rysowania przy jakości medium i 5 s wczytywania wymaga pomiaru w
przeglądarce na docelowej arenie. Test widoku i zmiany pogody opisano
w [render.md](render.md#horyzont-i-zasięg-widzenia).

## Port kontenerowy

Główna ciągła podłoga: 100×100 m, granice XZ −50…50 m, zamknięte statycznymi
colliderami. Plac manewrowy używa `quay_lines`, nabrzeże `quay_concrete`.
Dalsza tafla za
południową granicą jest oprawą niedostępną dla gracza. Pogoda: `storm`.

| Strefa | Pozycja X/Y/Z (m) | Charakter i dojścia                                                       |
| ------ | ----------------- | ------------------------------------------------------------------------- |
| A      | −32 / 0 / −28     | Plac przy zachodnich stosach, dojście zachodem i przez środkowe przejazdy |
| B      | 32 / 0 / −23      | Pod suwnicą, cztery słupy, dostęp od północy, zachodu i wschodu           |
| C      | 0 / 0 / 33        | Szerokie nabrzeże, niskie osłony, dostęp z obu boków oraz ze środka       |

Promień każdego punktu: 4 m. Odległości między środkami: ok. 64 / 69 / 65 m.
Gracz zaczyna przy (−38, 0, 39), posiłki mają sześć pozycji na obrzeżach
oddzielonych od stref. Wspólny bezpieczny odstęp od gracza nadal wynosi 15 m.

Kontenery GLB mają rzeczywiste wymiary ISO: 20 ft = 6,058×2,591×2,438 m,
40 ft = 12,192×2,591×2,438 m (X/Y/Z). Kolizje pozostają płaskimi
prostopadłościanami; stosy mają 1–3 warstwy, w granacie, oliwce, ochrze
i graficie. Krótsze, przesunięte i obrócone kontenery tworzą niskie osłony,
zaułki i przerwy między rzędami.

Zachodnia rampa (18 m biegu) prowadzi na dach 5,182 m; druga (12 m biegu)
na 2,591 m. Dwa pomosty `port_lashing_platform`, obrócone wzdłuż Z,
łączą zachodnie stosy przy z = −14 / −7,5 / −1 m. Szczeliny mają 4,062 m,
pomosty 6 m z oparciem na dachach; wierzch płyty jest na 5,282 m.
Płyta i balustrady mają oddzielne collidery, przejście pozostaje otwarte.
Dwa biegi schodów po 15 stopni (wznios 2,591/15 m, głębokość 0,6 m)
prowadzą przez spocznik 2,591 m do podestu serwisowego 5,182 m przy B.
Schody, rampy i podesty serwisowe używają `steel_grating`.
Wymiary i obroty są w JSON-ie; render i Rapier dostają tę samą transformację.
Wszystkie punkty są na gruncie, wyższe poziomy służą flankowaniu.

`ArenaNavigation` buduje naziemną siatkę 1 m z marginesem 0,8 m i pola odległości
do punktów. Wygładza trasę do widocznego waypointu. `RoomScene` przekazuje go
przez istniejące `Enemy.moveGoal`; blisko gracza nadal działa zwykła walka.
Rampy są omijane przez naziemną nawigację, bez zmiany AI innych scen.
Walidacja obejmuje wolne koła stref, ich odległości, granice, dostępność,
wolny margines spawnów i ich położenie poza punktami.

Oprawa wykorzystuje wszystkie 15 dostarczonych wariantów `port_*.glb`:
kontenery, dwie suwnice nad rzędami (32, −23) i (12, 16), cztery maszty,
dwa wózki przeładunkowe, pomosty, 24 moduły nabrzeża i osiem pachołków,
co drugi z liną. Moduły kei stoją na y = −2 m (wierzch na poziomie placu),
odbojnice patrzą na wodę w +Z. Niewidoczna niska granica przy z = 50
zatrzymuje gracza, pozostawiając widok na wodę. Nogi i progi suwnic,
nadwozia wózków oraz maszty mają proste collidery `visible: false`;
nie ma dużych colliderów wypełniających przestrzeń pod wysięgnikami.

Generatory, bariery, latarnie, skrzynie, kiosk, kable i inne `city_*`
uzupełniają plac. Reflektory masztów (ciepła biel, y = 18,5 m) korzystają
z istniejącej puli `CityLights`. Kolory neonów: bursztyn, zieleń, fiolet,
błękit i ciepła biel. Rejestr gry obsługuje materiały modeli portu i nowe
tekstury przez miejski shader z mokrością profilu `storm`.
Nawierzchnie dziedziczą ciemne barwy asfaltu i betonu z motywu `neonStreet`,
a barwy czterech wariantów kontenerów pochodzą z danych materiałowych.
Modele GLB, generator Blendera i system pogody nie zostały zmienione.

## Estakada w smogu

`arenaOverpass`: 100×100 m, `smog`, asfalt ulicy, beton estakady i ściany
`smog_soot_wall`. Jezdnia na 11,6 m biegnie wzdłuż Z przy x = −12.
Sześć filarów 2,5×10×2,513 m podtrzymuje segmenty; wraki, bariery i cztery
oczyszczacze rozbijają szerokie ulice. Dwie rampy mają 36 m biegu, 8 m
szerokości i 11,6 m wzniosu, przy z = ±24. Płyta segmentu GLB ma collider
14×1,6×12 m, osobne bariery; bramownice mają wyłącznie nogi i poprzeczkę.
Przy rampach segmenty GLB zastępują zwykłe płyty i osobne bariery, żeby
wbudowana boczna bariera modelu nie zamykała wjazdu.

| Punkt | X/Y/Z (m)       | Miejsce                                  |
| ----- | --------------- | ---------------------------------------- |
| A     | −12 / 0 / −12   | Ulica pod jezdnią, między filarami       |
| B     | −12 / 11,6 / 12 | Jezdnia, dojście obiema rampami          |
| C     | 32 / 0 / 10     | Plac przy wrakach, poza obrysem wiaduktu |

Promienie 4 m, odległości XZ około 24 / 49 / 44 m. Gracz (−38, 0, 35),
sześć spawnów na obrzeżach. Światła ciepłej bieli na jezdni, zielone
oczyszczacze i bursztyn/błękit/fiolet na ulicy; brak opadu, gęsty pył i smog.

## Dachy Starego Miasta

`arenaRooftops` (przebudowa wg ADR 0011): 300×260 m (x −150…150, z −130…130),
pogoda `drizzleWind`, motyw `neonStreet`. Generator `tools/arenas/arenaRooftops.mjs`
(`node tools/arenas/build.mjs arenaRooftops`), rzut `docs/arenas/arenaRooftops.svg`.
Dzielnica kamienic: ulice na dnie (y = −14, chodniki −13,85), dachy na 0 / 4 / 8 / 12 m.
Generator opisuje działki (prostokąty z wysokością dachu) w funkcjach kwartałów
(`northWestLots`, `northMiddleLots`, `northEastLots`, `southWestLots`, `southMiddleLots`,
`marketLots`, `streetLots`, `edgeLots`), połączenia (`connections`) i oprawę stref
(`…Dress`); bryły, płyty dachów, parapety i ściany ogniowe buduje z mapy wysokości.
Pokrycie rzutu jest sprawdzane (każdy metr to działka albo ulica).
Powierzchnia chodzenia ≈ 65 900 m², wypełnienie obrysu 86,5% (wcięcia narożnymi
wysokimi kamienicami), poziomy −14 / 0 / 4 / 8 / 12 m (+ spoczniki klatek).
2114 bloków (757 chodzonych, 217 niewidocznych), 733 dekoracje, 1057 instancji
41 modeli (najczęstszy `city_sign_box` 11,4%), 57 świateł + 7 latarni,
22 napisy/hologramy, 24 naklejki, 9 efektów, 61 stref bez deszczu.

| Strefa (rodzaj)              | Rzut (x / z)        | Charakter, materiały, rekwizyty                                                                                                                                                                                                        |
| ---------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ulica Targowa, C (low)       | −150…150 / −10…10   | asfalt, chodniki `paving`, cokoły kamienic `facade` z oknami; targ uliczny z budami w dwóch kolorach, wraki i auta, kioski, automaty, latarnie, girlandy lampionów, holo nad ulicą; wyloty zamknięte blaszanym płotem z pasem `hazard` |
| Zaułek i podwórze, D (dense) | −84…−36 / 10…93     | zaułek przy x = −60 (na północ do placyku Klatki Zegarowej), podwórze 48×40 m: `flood_brick_algae`, szopa, wrak, beczki z ogniem, agregat, pranie, graffiti, kapanie z rynien                                                          |
| Nocny targ, A (open)         | 20…110 / 10…100     | największy dach (y = 0) z pokładem `boardwalk_planks`: wyspy straganów `city_market_stall_canopy` (granat i fiolet) w alejkach 5 m, lampiony, plac przy A z osłonami, daszki `market_tarp`, holo koi/meduza                            |
| Kwartał Zegarowy, B (high)   | −150…−56 / −112…−10 | kamień `canal_stone_wall` i cegła z oknami, kominy, świetliki, zbiorniki, budki; wieża `roof_clock_tower` na dachu 8 m przy (−100, 8, −90), dach 12 m na zachodzie                                                                     |
| Kwartał Szyldu, E (high)     | 44…150 / −118…−10   | beton/tynk, papa `roof_hvac_metal`/`corrugated`: HVAC, anteny satelitarne, oczyszczacze, blaszane komórki; `roof_giant_sign` przy (80, 12, −80)                                                                                        |
| Pasaż i klatki (interior)    | −44…−19 / 10…68     | pasaż handlowy pod kamienicą (rolety, ekrany, automaty, neony) i trzy klatki schodowe przez wnętrza                                                                                                                                    |

Pozostałe kwartały: obozowisko na niskich dachach południowego zachodu (start gracza,
namioty, szałasy, beczki), kamienice w remoncie na południu (rusztowania przy ulicy,
agregaty, skrzynie), wschodnie i południowe kamienice 4–8 m. Ściany ogniowe 1,2 m
z przerwami dzielą dachy sąsiednich działek; komórki/nadbudówki z bloków i zbiorniki
przerywają linie widoku na każdym dachu.

| Punkt | X / Y / Z (m)  | Miejsce                       |
| ----- | -------------- | ----------------------------- |
| A     | 60 / 0 / 60    | nocny targ na dachu           |
| B     | −95 / 8 / −75  | dach pod wieżą zegarową       |
| C     | 0 / −14 / 0    | targ na ulicy głównej         |
| D     | −60 / −14 / 70 | podwórze przy zaułku          |
| E     | 80 / 12 / −70  | dach pod gigantycznym szyldem |

Promienie 5 m. Start gracza (−140, 0, 120) na niskim dachu. Przejęcie: `maxAlive` 12,
`arena.enemyTickets` 190, `spawnRing` 25–90 m, 41 spawnów z wysokością w `arena.spawnPoints`
(12 na ulicach, podwórzu, uliczce i w pasażu, 8 na dachach 0 m, 10 na 4 m, 8 na 8 m,
3 na 12 m); 4 spawny pokoju (XZ) na dachu startowym. Scalanie statyki w komórkach
200 m (`batchCellM`), rekwizyty bez `instance`.

**Połączenia (AI i gracz).** Ulica ↔ dachy: trzy klatki schodowe (biegi zabiegowe
po 10 stopni 0,3 × 1 m, spoczniki co 3 m, nadbudówka z drzwiami 3,2 m):
Klatka Zegarowa (placyk na końcu zaułka → dach 4 m przy B), Klatka Podwórzowa
(podwórze D → dach 4 m), Klatka Szyldu (chodnik ulicy → dach 4 m przy E) oraz
Schody Targowe (47 kamiennych stopni wzdłuż fasady, chodnik → targ A).
Dachy ↔ dachy: 23 biegi kamiennych/stalowych schodów po 4 m (14 stopni 0,29 × 1 m),
pięć szerokich mostów z desek (dwa nad ulicą główną na 0 m, nad zaułkiem na 0 m
i 4 m, nad uliczką na 4 m). Gracz ma dodatkowo trzy kładki `city_roof_bridge` (1,4 m),
pięć schodów pożarowych na fasadach (stalowe biegi 0,3 × 0,32 m, balkony
`city_fire_escape`) i zeskoki z dachów. Każda para sąsiednich punktów ma trasę
ulicą i trasę przez dachy (np. C–A: ulica + Schody Targowe albo most W i dachy
0 m; C–D: zaułek, pasaż albo dachy i Klatka Podwórzowa; C–B i C–E: klatki albo
mosty nad ulicą i schody dachowe).

**Granica.** Północ i narożniki zamykają wysokie, niedostępne kamienice (16–20 m);
na pozostałych krawędziach dachy kończą parapety, a ulica główna — blaszany płot.
Niewidoczna ściana stoi na obwiedni (−14…32 m). Za nią ulice i pierścień kamienic
oprawy (x ±164…186, z ±144…168) do panoramy.

**Pogoda i światła.** Mżawka sięga ulicy: `weatherFloorY` = −14, bryły kamienic są
strefami bez deszczu. Plamy świateł leżą na podłodze pod światłem (`lights[].floorY`).
Paleta: bursztyn i fiolet szyldów, ciepła biel lampionów targu, zieleń i błękit
w Kwartale Szyldu; brak czerwieni, cyjanu i magenty w otoczeniu.

## Nawigacja nowych aren

Wysokich punktów nie przeniesiono na grunt. `blocks[].walkable` oznacza
płyty i rampy; `ArenaSurfaceNavigation` pod istniejącym `ArenaNavigation`
buduje warstwy 1 m, margines 0,8 m, prześwit 2 m i maksymalny wznios
między sąsiadami 0,35 m. Połączenie różnych powierzchni rampy istnieje
wyłącznie na końcach, więc wróg nie próbuje wejść przez boczny próg.
Przeszkody nad ulicą nie blokują przejścia pod estakadą. Skracanie trasy
sprawdza wysokość oraz kolejne połączenia, bez skrótów między dachami.
Naziemna ścieżka portu pozostaje zachowana.

AI wybiera szerokie rampy: wąskie kładki o przejściu 1,378 m nie mieszczą
pełnego marginesu nawigacji 0,8 m i służą graczowi. Wszystkie punkty są
osiągalne bez nich. Walidacja trybu wymaga wolnego koła na wysokości punktu
oraz drogi od gracza i każdego spawnu do A/B/C. Posiłki zachowują istniejący
warunek 15 m od gracza i odstępu od innych wrogów.

## Wydajność i pomiar

Port wykorzystuje wzorzec commita `0ade40c`: jeden `static-world` dla brył,
modeli i dekoracji oraz jedno scalanie według materiału w komórkach 20 m.
Powtarzane siatki kontenerów są `InstancedMesh`, grupowane w komórkach
dla cullingu. Okucia i nadruki wariantów farby współdzielą partie. Pojedyncze
siatki oraz moduły kei i pozostałe rekwizyty trafiają do scalania statyki.
Pozostałe pokoje zachowują swój dotychczasowy sposób scalania. Collider każdego
bloku jest statyczny. Smugi i rozbryzgi mają istniejące pule, bez tworzenia
obiektów na każdą kroplę. Bufory instancji i scalone geometrie są zwalniane.

Pomiar strukturalny 2026-11-17, prawdziwe GLB, `arenaStaticBatch.test.ts`:

| Zakres                                         | Przed scalaniem | Po scalaniu |
| ---------------------------------------------- | --------------: | ----------: |
| Statyczne siatki portu (łącznie z instancjami) |             776 |         326 |
| Partie instancji kontenerów                    |              53 |          53 |

Ten sam pomiar nowych aren (rzeczywiste GLB, komórki 20 m, pojedyncza faza
scalania, bez zmiany progów):

| Arena                                         | Siatki przed | Siatki po | Partie InstancedMesh |
| --------------------------------------------- | -----------: | --------: | -------------------: |
| Estakada                                      |          630 |       216 |                   75 |
| Dachy (300×260, komórki 200 m, bez instancji) |       23 319 |       194 |                    0 |

`arenaPerf.test.ts` obejmuje także prawdziwy host Przejęcia obu nowych aren,
30 wrogów (20 szturmowców, 10 strzelców), nawigację i Rapiera. Lokalny pomiar
po optymalizacji wyboru waypointu: estakada 0,803 ms/krok, dachy 0,87–0,94 ms/krok; limit nadal
6 ms/krok. Test przeciążeniowy omija wyłącznie limit liczby posiłków 8.
Dachy mają też test budżetów ADR D8: nawigacja 170–190 ms (siatka 1 m i pięć
pól, ≤ 500 ms), 12 wrogów z puli areny na ulicach i dachach 0,52 ms/krok (≤ 2 ms).

Dachy: wywołania rysowania całej klatki (`query('renderInfo')`, 1280×720, jakość
medium, swiftshader, bez wrogów, 2026-11-18): start (−140, 120) na NE 669, ulica
(−130, 0) na wschód 759, dach 12 m (22, −105) na południe 718, dach 8 m (130, −20)
na zachód 728, targ (60, 40) 311, dach zegarowy 223. Komórki 20 m dawały
3000–7000 wywołań (ok. 1500 partii InstancedMesh); scalenie rekwizytów według
materiału w ćwiartkach mapy, mniej napisów (każdy ≈ 5 wywołań) i świateł (plama
= 1 wywołanie) zeszło poniżej 800. Każdy widoczny wróg dokłada ok. 70–80 wywołań
(koszt silnika, nie areny): z dwoma wrogami w kadrze 895–912.

To liczba siatek, **nie zmierzona liczba wywołań rysowania całej klatki**:
frustum culling i przebiegi koloru, normalnych, odbić oraz bloom zmieniają wynik.
Pomiar GPU i e2e pominięto zgodnie z briefem (sandbox). Manager powinien
uzupełnić pomiar GPU i ocenę wizualną przed akceptacją areny. Test nadal
wymaga redukcji poniżej połowy siatek; limit `arenaPerf.test.ts` pozostaje
6 ms/krok symulacji.

Na działającym serwerze poza sandboxem:

```powershell
node tools/perf/profile.mjs --url 'http://127.0.0.1:5173/?mode=conquest&arena=arenaContainerPort&seed=port-review' --scene run --quality medium --seconds 10
```

1280×720, DPR 1, medium, pogoda storm, startowa kamera. Raport zawiera liczniki
wywołań per przebieg; `window.__neoryder.query('renderInfo')` daje także sumę
wywołań ostatniej pełnej klatki. Pomiar należy podać z pozycją kamery, liczbą
wrogów i jakością. Nie uruchamiać go z `fx=lite` przy ocenie oprawy.

## Sprawdzenie w 30 sekund

Otwórz `?scene=conquest&arena=arenaContainerPort&debug=1`, wpisz `god`, obejrzyj
plac i podesty. Komendy `tp -32 -28`, `tp 32 -23`, `tp 0 33` pozwalają szybko
obejrzeć trzy różne strefy. Sprawdź `query('room')`, `query('weather')` i
`query('conquest')`. `?scene=weatherTest&debug=1` udostępnia pięć przycisków pogody.
`?scene=conquest&arena=combatRing&debug=1` sprawdza mały pierścień.

Nowe areny: `?scene=conquest&arena=arenaOverpass&debug=1` oraz
`?scene=conquest&arena=arenaRooftops&debug=1`. Wpisz `god`, przejdź A–B–C
bez skoków i drugą rampę estakady. Sprawdź `room`, `weather` i `conquest`
przez query; profil powinien wynosić odpowiednio `smog` i `drizzleWind`.
Oceń czytelność wrogów w pyle i mżawce, osłony i zabezpieczenie krawędzi.
Galeria: `?scene=city-props-test&view=4` (estakada), `&view=5` (rekwizyty dachów).

Dachy — `tp <x> <z> <yaw> <pitch> <podłoga>` (piąty argument to wysokość podłogi):
`tp -140 120 -45 0 0` start i obozowisko, `tp 0 -8 90 0 -14` ulica i targ C,
`tp 45 40 120 0 0` nocny targ A, `tp -85 -60 27 5 8` wieża zegarowa i B,
`tp 95 -55 30 0 12` szyld i E, `tp -60 88 0 0 -14` podwórze D,
`tp -41 14 180 0 -14` pasaż, `tp -66 -54 0 10 -14` wejście Klatki Zegarowej,
`tp -48 -2 0 25 -14` schody pożarowe, `tp 20 13 -90 0 -13.85` Schody Targowe,
`tp -32 -16 180 0 0` most z desek nad ulicą. Sprawdź wejście po klatce na dach,
mżawkę na ulicy (pada do dna), plamy świateł na właściwych poziomach,
wroga schodzącego ze schodów i czytelność czerwieni na tle neonów.
Testy traversal/enemies/staticBatch obejmują wszystkie trzy duże areny
(dachy: kapsuła do A–E, Schody Targowe, most, kładka, schody pożarowe i dachowe;
oba archetypy z pięciu spawnów na różnych poziomach do A–E);
e2e startu nowych aren jest napisany, bez uruchamiania w sandboxie.

Dłuższy przegląd feel: przejdź naziemne drogi A–B–C, wejdź obiema rampami,
przejdź po kładce i oboma biegami schodów suwnicy. Sprawdź czytelność czerwonych
wrogów w ulewie, osłony, możliwość flankowania i tempo dochodzenia posiłków.
Przejście kapsuły bez skoków po gruncie, rampach, kładce i schodach pokrywa
`arenaTraversal.test.ts`; obydwa archetypy ze wszystkich sześciu spawnów do A/B/C
sprawdza `arenaEnemies.test.ts` na prawdziwym Rapierze. Ocena widoku i dźwięku
pozostaje ręczna. Test e2e jest napisany, nieuruchomiony zgodnie z briefem.

Galeria `?scene=city-props-test&view=3` pokazuje te same materiały i modele.
Sprawdź żebrowanie oraz kolory kontenerów, mokry plac z liniami, gumowe
odbojnice pod krawędzią kei, liny, skalę suwnic i położenie reflektorów.
`arenaStaticBatch.test.ts` dodatkowo porównuje obwiednie wszystkich powłok
kontenerów z colliderami (także po obrocie), sprawdza ładowanie rekwizytów
i brak nierozpoznanych materiałów GLB.
