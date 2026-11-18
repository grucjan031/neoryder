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

## Targ na dachach

`arenaRooftops`: 90×90 m, `drizzleWind`. Ciągły niski dach na y = 0,
tarasy wschodnie na 2 i 6 m. Szerokie rampy X mają 24 m biegu i 8 m
szerokości; łączą dolny dach z tarasami przy z = −24 i 24. Dachy pokrywa
`roof_tar`, parapety i schody `roof_hvac_metal`, zadaszenia `market_tarp`.
Stragany obu kolorów, zbiorniki, HVAC, anteny i szyldy używają oryginalnych
materiałów GLB (wszystkie nazwy były już zarejestrowane). Wymiary colliderów
rekwizytów odpowiadają AABB w `docs/assets.md`.

| Punkt | X/Y/Z (m)    | Miejsce                       |
| ----- | ------------ | ----------------------------- |
| A     | −28 / 0 / 0  | Niski zachodni dach targowy   |
| B     | 28 / 2 / −24 | Północny dach z wieżą ciśnień |
| C     | 28 / 6 / 24  | Wysoki południowy dach        |

Promienie 4 m, odległości XZ około 61 / 48 / 61 m. Gracz (−35, 0, 32),
sześć spawnów na niskim dachu poza punktami. Dwie kładki `city_roof_bridge`
przy x = 34 i 38 łączą tarasy na y = 6, nad niższym kanałem serwisowym.
Z północnego dachu prowadzą dwa biegi po 20 stopni, 0,2 m wzniosu i 0,4 m
głębokości. Płyta kładki ma 1,6×0,2×8 m, osobne poręcze do wysokości
modelu 1,39 m. Parapety mają przerwy przy rampach i kładkach. Granice areny
mają dodatkową niewidoczną kolizję do 8 m; kapsuła nie wypada poza arenę.

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

| Arena    | Siatki przed | Siatki po | Partie InstancedMesh |
| -------- | -----------: | --------: | -------------------: |
| Estakada |          630 |       216 |                   75 |
| Targ     |          877 |       198 |                   40 |

`arenaPerf.test.ts` obejmuje także prawdziwy host Przejęcia obu nowych aren,
30 wrogów (20 szturmowców, 10 strzelców), nawigację i Rapiera. Lokalny pomiar
po optymalizacji wyboru waypointu: estakada 0,803 ms/krok, targ 0,792 ms/krok; limit nadal
6 ms/krok. Test przeciążeniowy omija wyłącznie limit liczby posiłków 8.

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
bez skoków, potem drugą rampę estakady i schody/kładki targu. Sprawdź `room`,
`weather` i `conquest` przez query; profil powinien wynosić odpowiednio
`smog` i `drizzleWind`. Oceń czytelność wrogów w pyle i mżawce, drogi posiłków
na B/C, osłony, śliską wizualnie papę i zabezpieczenie zewnętrznych krawędzi.
Galeria: `?scene=city-props-test&view=4` (estakada), `&view=5` (targ).
Testy traversal/enemies/staticBatch obejmują wszystkie trzy duże areny;
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

## Elektrownia

`arenaPowerPlant` ma obwiednię 380 × 300 m (X −190…190, Z −150…150).
Woda od Z 115 oddziela nabrzeże od obrysu hałd. Północ zamyka ogrodzenie z zatoką rozładunkową 46 × 22 m (X −118…−72).
Od wschodu teren zamyka nasyp bocznicy, a od zachodu mur serwisowy. Za granicami są niekolizyjne
słupy WN, przewody, zwałowiska i wieża ujęcia. Silnik domyka tło gruntem
zewnętrznym i panoramą. Pogoda `ashfall` daje bursztynową łunę. Reflektory
ciepłej bieli oświetlają przejścia, zielone lampy wskazują sprawne urządzenia,
a bursztynowe światło podkreśla chłodnie, komin i węzły rurociągów.
79 źródeł współdzieli istniejącą pulę aktywnych świateł.

| Punkt | X / Y / Z (m) | Strefa i drogi |
| --- | --- | --- |
| A | −120 / 0 / 15 | Wnętrze chłodni. Wyrwa prowadzi na wschód, między gruzem i wiązkami rur. Rampa przez kołnierz 0,8 m prowadzi do płytkiej niecki na poziomie posadzki. |
| B | 25 / 0 / −25 | Hala 90 × 40 × 18 m, z bramami N/S i drzwiami E/W. Trzy turbiny mają połączone pomosty na 6 m. Schody na obu końcach prowadzą na antresolę sterowni na 8 m. |
| C | 130 / 0 / −65 | Rozdzielnia. Siatka transformatorów, bramownice i niskie ogrodzenia z przerwami. Dwa pola elektryczne można obejść od północy lub południa. |
| D | 120 / 0 / 80 | Skład między pięcioma hałdami na 7 m i zasiekami. Pod przenośnikiem biegnie droga na wschód, do wagonów przy dwóch torach. |
| E | −60 / −3 / 100 | Nabrzeże ujęcia. Wejście szeroką rampą lub schodami od wschodu i rampą od zachodu. Przepompownia ma dwa wejścia. Kładka do wieży w kanale jest częścią oprawy. |

Kotłownia na północy ma dostępny parter, zewnętrzną wieżę schodową i dach
na 14 m. Komin na (45, 0, −135) ma 120 m, obie chłodnie mają po 70 m.
Podstawę chłodni przybliża w Rapierze 32-segmentowy pierścień z niewidocznych
brył o grubości 0,95 m, wysokości 9 m i promieniu osi 24,55 m. W chłodni A
pominięto trzy wschodnie segmenty. Pierścień zamyka pozostałe szczeliny
między podporami w podstawie modelu. Kolizję każdej hałdy przybliżają
równoległe pasy skierowane wzdłuż X. Na osi głównej każdy stok ma 13 m biegu
i 7 m wzniosu. Na skraju rozbieżność z obrysem 32 trójkątnych ścian
modelu jest większa. Najczytelniejsze wejścia prowadzą od wschodu i zachodu.

A–B i B–C prowadzą zarówno placem, jak i wąskim pomostem rurociągu
na 6,2 m. Wejścia do hali pozwalają zejść z pomostu osobnymi schodami.
Gracz może przejść C–D pod estakadą serwisową albo wejść na jej pomost
schodami na obu końcach. Z D do E można zejść z przenośnika przy
wschodniej rampie nabrzeża lub przejść niżej między zasiekami. Z A do E
prowadzi zachodnia rampa przy ścianie kanału albo pomost serwisowy ze
schodami na poziomy 0 i −3 m. AI korzysta z parteru i szerokich ramp.

Pomiędzy strefami drogi serwisowe mają kierunkowe oznakowanie i przerywane
krawężniki. Od startu do kotłowni stoją wartownia, magazyn i farma trzech
zbiorników z pomostem na 3 m. Na południe od hali są warsztat i laboratorium.
W przejściu do hałd i rozdzielni stoi mały budynek serwisowy. Bramki
w ogrodzeniach, podwozia pojazdów, stosy kontenerów, kioski, naziemne
rurociągi i doposażone maszty dzielą długie osie między strefami.
Schody mają kolizje i są jawnie przeznaczone dla gracza. Drogi AI do
wszystkich punktów używają parteru i szerokiej rampy nabrzeża. Generator
raportuje zero ostrzeżeń `stairs-navigation-slope`.

Punkty mają promień 5 m. Gracz zaczyna na (−180, 0, −140). Jest 30 spawnów,
w tym cztery na nabrzeżu (−3 m). Pierścień posiłków 25–100 m, maksymalnie
12 żywych wrogów i 200 biletów. Nawigacja używa komórek 2 m, statyka
partii 20 m. Lista trybu i SVG są w
[`conquest.json`](../../src/data/modes/conquest.json) i
[rzucie areny](../arenas/arenaPowerPlant.svg).

Podstawowe powierzchnie to `cooling_tower_concrete`, `turbine_hall_floor`,
`concrete_raw_cast`, `steel_grating`, `slag_heap`, `rail_ballast` i
`canal_stone_wall`. Pasy `hazard_stripes_worn` oznaczają obejścia w
rozdzielni. Wagony mają stalowe podwozia i boki z blachy falistej; część
platform przewozi kontenery `port_container_20_*`.
Otwarte: po dostarczeniu GLB podmienić bryły w `railYard()` w generatorze
na `port_freight_boxcar` i `port_flatcar`. Zachować obrys kolizji wagonów i
posadowienie kontenerów.

Pomiar generatora z próbkowaniem co 1 m: około 95 665 m² powierzchni
chodzenia. Po zagęszczeniu 984 → 1246 bloków, 131 → 197 rekwizytów i
52 → 79 świateł. Najczęstszy model to rura `city_pipe_run`
(19 z 197, 9,6%). Największy kwadrat bez osłon poza rozdzielnią ma około
43 × 43 m (X 89–132, Z 62–105). Szacunek używa rastra 1 m na poziomach
0 i −3 m, rzutów colliderów osłon o wysokości co najmniej 1 m oraz
największego kwadratu wspartego na płaskim gruncie. Właściwy odstęp osłon
wzdłuż trasy zależy od kierunku ruchu i skarp.
Pomiar w Node na docelowej geometrii:

| Pomiar | Wynik | Budżet lub zakres |
| --- | ---: | --- |
| Budowa siatki i pięciu pól | 69,27 ms | ≤ 500 ms |
| Krok `RoomScene`, 12 wrogów, 600 kroków po rozgrzewce | 0,399 ms | ≤ 2 ms |
| Rzeczywiste GLB, statyczne siatki przed → po scaleniu | 3719 → 1237 | 90 partii instancji po scaleniu |

Nawigacja zawęża test prześwitu i podparcia do pobliskich brył według
indeksu przestrzennego. Używa tej samej obwiedni i tych samych reguł
łączenia komórek. Test kapsuły sprawdza A–E ze startu oraz ze spawnów
rozdzielni i nabrzeża. Pokrywa także estakady na 6,2 m, dach kotłowni i
stok hałdy. Test posiłków prowadzi oba archetypy fizycznie po Rapierze
z sześciu spawnów do wszystkich pięciu punktów.

Sprawdzenie w 30 sekund: `?scene=conquest&arena=arenaPowerPlant&debug=1`.
Wpisz `god`, a potem w konsoli debug użyj po kolei:

| Polecenie | Widok |
| --- | --- |
| `tp -120 15 -90` | Wnętrze A i wyrwa na wschód |
| `tp 25 -25 180` | Turbiny B i pomosty |
| `tp 33 -108 0` | Parter kotłowni; schody po wschodniej stronie |
| `tp 130 -65 0` | Rozdzielnia C |
| `tp 120 80 -90` | Hałdy D, przenośnik i bocznica |
| `tp -60 100 180` | Spadek na nabrzeże E i widok kanału |

Przy `tp` wysokość pozostaje bieżąca do następnego kroku fizyki. Na E
gracz opadnie z poziomu placu. Na wyższe podesty wejdź schodami. Z E
na plac wróć rampą przy (40, 96).

Do oceny w grze: rytm osłon w przejściach między strefami, czytelność
czerwonych wrogów w popiele, sygnał pól elektrycznych, tempo pierwszych
posiłków oraz wygoda wymijania na wąskich trasach. Sprawdź sylwetkę komina
i widok poza ogrodzeniem z dachu kotłowni. GPU i czas wczytania wymagają
pomiaru w przeglądarce w trybie medium, szczególnie przy spojrzeniu z dachu
w stronę pozostałych stref.
