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

`arenaOverpass`, „Węzeł Estakada”, przebudowa według ADR 0011.
Generator: `tools/arenas/arenaOverpass.mjs`, seed `overpass-adr0011-v1`.
Granice X/Z −180…180 m (360×360 m); wcięcia nasypów NW
(X −180…−140, Z −180…−20) i SE (X 100…180, Z 100…180).
Szacowana powierzchnia chodzenia: **135 261 m²**, rzut wypełniony w 87,4%.
Ekrany akustyczne i ściany kwartałów zasłaniają zabezpieczenie kolizyjne.
Za nimi stoją bezkolizyjne bryły zaplecza i wież w promieniu 285–317 m;
ulica zewnętrzna, dalsze wieżowce i niebo pochodzą z silnika horyzontu.
Pogoda `smog`. Tożsamość: zieleń oczyszczaczy i tuneli, bursztyn bramek,
ciepła biel latarni; chłodny asfalt, beton i ściany pokryte sadzą.

| Punkt | X/Y/Z (m)         | Strefa i charakter |
| ----- | ----------------- | ------------------ |
| A | 0 / 0 / 40 | Gęste obozowisko: namioty kopułowe i dwuspadowe, szopy, beczki, wraki; przejścia między osłonami |
| B | −70 / 11,6 / −3 | Jezdnia poziomu 1 w osi X, wraki i zielone oczyszczacze; łącznik obsługi po zachodniej stronie |
| C | 95 / 0 / −100 | Stacja paliw NE: wiata, cztery dystrybutory, sklep z dwoma wejściami i wyposażeniem |
| D | −120 / −4 / 60 | Betonowy kanał burzowy w osi Z, niskie osłony i boczne wnętrza przepustów |
| E | 27 / 23,2 / −110 | Jezdnia poziomu 2 przy urwanym północnym końcu; landmark `hw_broken_deck_end` przy Z −152 |

Promienie wszystkich punktów: **5 m**. Szósta strefa to wentylatornia:
`hw_vent_tower` przy (−60, 0, 90), krótki portal tunelu i dojście na −4 m.
Start gracza: (−170, 0, 170). Pula 33 spawnów: 24 na ulicach, trzy w kanale,
trzy na poziomie 1 i trzy na poziomie 2. `spawnRing` 25–100 m,
`arena.maxAlive` i `room.maxAlive` 12, `arena.enemyTickets` 200.
Arena pozostaje na istniejącej liście Przejęcia.

### Poziomy i trasy

- Ulice na 0 m tworzą połączone kwartały. Budynki serwisowe (część przechodnia),
  murki z bramami, kioski, skrzynie, generatory, wraki i krawężniki przeplatają
  się w siatce 26 m. Strzałki i linie zatrzymania oznaczają trasy do bramek.
  Pierzeje na południu, wschodzie i północnym wschodzie mieszczą przechodnie
  bary, warsztaty i magazyny. Auta, kontenery, kioski, śmietniki i ogrodzenia
  z bramami dzielą pobocza. Pod płytami między filarami stoją stragany, budy
  i auta, a przewody nad alejkami obozowiska wyznaczają sznury do suszenia.
  Poza placem bramek największy kwadrat bez osłon zmalał z 66×66 do 40×40 m
  (X 128…168, Z −180…−140). Pomiar sprawdza kwadraty równoległe do osi
  na siatce 2 m i uwzględnia osłony sięgające co najmniej 0,85 m nad ulicą.
- Główna jezdnia 11,6 m biegnie przez całe X, Z −10…4; filary GLB są wyłącznie
  pod płytą. Pętla SW (X; Y; Z): (−164; 0; 134) → (−80; 5,8; 134) →
  (−80; 5,8; 62) → (−164; 11,6; 62) → poziom 1. Pętla NE:
  (164; 0; −156) → (72; 5,8; −156) → (72; 5,8; −60) →
  (164; 11,6; −60) → poziom 1. Szerokości 12–14 m, spoczniki w zakrętach.
  Krótsza rampa serwisowa: (−80; 0; −48) → (−8; 11,6; −48).
- Jezdnia 23,2 m biegnie w osi Z, X 20…34. Dwie rampy z poziomu 1,
  przy Z −64 i 28, mają bieg X −64…8 i szerokość 10 m.
  Alternatywą jest rusztowanie: cztery biegi 56 m, po 5,8 m wzniosu,
  przy Z −158 / −142 / −126 / −110, spoczniki i kładka przy Z −96 do E.
  `build_scaffold_bay` stoi na spocznikach, deski pokrywają rampy i pomost.
- Kanał ma szerokość 20 m i długość 300 m. Zjazdy od wschodu przy
  Z −110 / 0 / 110, od zachodu przy Z −60 / 140; schody przy Z 80
  są dodatkową trasą gracza. Dwa mosty przy Z ±30 pozwalają przejść nad
  kanałem. Dwa `hw_storm_culvert` przy (−130,−4,±90) prowadzą 6 m w głąb.
- Wentylatornia ma rampę od (−30,0,104) do (−50,−4,104) i krótki tunel
  pod portalem przy (−60,−4,100). Zielone światła wskazują niski poziom.

Między A–B można przejść rampą serwisową albo pętlą SW; B–C przez NE
albo zejście centralne i ulice; C–E przez pętlę i rampy górne albo rusztowanie;
A–D po gruncie i zjazdach kanału albo przez poziom 1 i mosty.
Test odcina kolejno pętle, rusztowanie lub obie rampy górne i sprawdza,
że każda para punktów nadal ma połączenie. Osłony na jezdniach co 28 m,
w kanale co 24 m, w obozowisku co 16–17 m. Celowo otwarty jest plac bramek.

### Materiały, statyka i pomiary

Nawierzchnie: `highway_asphalt_worn`, `gas_station_tiles`, `scaffold_planks`,
`overpass_concrete`; oznaczenia wysepek: `hazard_stripes_worn`;
ściany: `smog_soot_wall`, `corrugated`; dachy: `roof_tar`.
Nowe id bloków są połączone z istniejącymi teksturami, bez nadpisania materiałów
używanych na innych mapach. Nie zmieniono GLB, tekstur ani profilu smogu.

1489 bloków (483 z modelem), 144 dekoracje: łącznie **627 rekwizytów**,
37 źródeł świateł wybieranych przez istniejącą pulę. Najczęstszy model:
66 wraków, 10,5% instancji. Komórki statyki 180 m (cztery ćwiartki);
nawigacja 2 m, margines 0,8 m, prześwit 2 m, dopuszczalny wznios 0,52 m.
Większe partie statyki ograniczają liczbę siatek kosztem dokładności cullingu;
do oceny na GPU pozostają widoki przez całą mapę.

Niezbędne poprawki wydajności: lokalny indeks brył nawigacji zamiast pełnego
skanu na każdą komórkę oraz scalenie zgodnych części klonu GLB przed
instancingiem. Źródłowy cache modeli i transformacje pozostają zachowane.
Kontrola GLB porównuje teraz obrócone obwiednie, zachowując tolerancję 5%.

Pomiar lokalny: nawigacja i pięć pól 68 ms (budżet 500 ms); symulacja
12 wrogów 0,371 ms/krok (budżet 2 ms); statyka rzeczywistych GLB
3497 → **787 siatek**, w tym 504 partie instancji. To pomiar strukturalny,
nie liczba wywołań całej klatki. GPU ≤800 wywołań i pełne wczytanie ≤5 s
w przeglądarce wymagają sprawdzenia przez managera poza sandboxem.

### Sprawdzenie Estakady w 30 sekund

`npm run dev`, URL: `http://localhost:5173/?scene=conquest&arena=arenaOverpass&debug=1`.
Wpisz `god`. Na gruncie: `tp 0 40` (A), `tp 95 -100` (C), `tp 148 -12`
(bramki), `tp -120 60` (D, poczekaj na opadnięcie), `tp -29 104`
(zejście do tunelu), `tp -62 -158` (rusztowanie i urwany wiadukt).
`tp` zachowuje aktualne Y: po obejrzeniu kanału przeładuj scenę przed
teleportem na ulice. Aby obejrzeć górę: od startu `tp -82 -48`, przejdź
prosto w +X po rampie, potem `tp -70 -3` (B); `tp -66 -64`, przejdź
po drugiej rampie w +X, następnie `tp 27 -110` (E).

Rzut: [SVG](../arenas/arenaOverpass.svg), [PNG 1300 px](../arenas/arenaOverpass.png).
PNG obejrzano pod kątem gęstości; Chromium z Playwrighta zwrócił `spawn EPERM`,
więc rasteryzację wykonano przez resvg. E2E nie uruchamiano zgodnie z briefem;
`arenaWeather.spec.ts` obejmuje id areny, smog i wszystkie A–E.
Ręcznie oceń tempo przemieszczania się między poziomami, odległość od osłon,
czytelność czerwonych wrogów w smogu, jasność pod wiaduktem i w tunelu,
widoczność obu landmarków oraz napływ posiłków w pierścieniu.

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

Ten sam pomiar aren (rzeczywiste GLB, komórki z danych: Estakada 180 m,
targ 20 m; jedno końcowe scalanie świata):

| Arena    | Siatki przed | Siatki po | Partie InstancedMesh |
| -------- | -----------: | --------: | -------------------: |
| Estakada |         3497 |       787 |                  504 |
| Targ     |          877 |       198 |                   40 |

`arenaPerf.test.ts` obejmuje prawdziwy host Przejęcia, nawigację i Rapiera.
Estakada sprawdza 12 wrogów (8 szturmowców, 4 strzelców), limit 2 ms/krok.
Targ zachowuje test przeciążeniowy 30 wrogów, limit 6 ms/krok.

To liczba siatek, **nie zmierzona liczba wywołań rysowania całej klatki**:
frustum culling i przebiegi koloru, normalnych, odbić oraz bloom zmieniają wynik.
Pomiar GPU i e2e pominięto zgodnie z briefem (sandbox). Manager powinien
uzupełnić pomiar GPU i ocenę wizualną przed akceptacją areny. Test nadal
wymaga redukcji poniżej połowy siatek; Estakada dodatkowo mniej niż 800
siatek statycznych. Obowiązuje osobny limit symulacji każdej areny.

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

Estakadę i komendy do jej poziomów opisano w sekcji „Estakada w smogu”.
Targ: `?scene=conquest&arena=arenaRooftops&debug=1`. Wpisz `god`, przejdź A–B–C
bez skoków, potem schody/kładki targu. Sprawdź `room`,
`weather` i `conquest` przez query; profil powinien wynosić odpowiednio
`smog` i `drizzleWind`. Oceń czytelność wrogów w pyle i mżawce, drogi posiłków
na B/C, osłony, śliską wizualnie papę i zabezpieczenie zewnętrznych krawędzi.
Galeria: `?scene=city-props-test&view=4` (estakada), `&view=5` (targ).
Testy traversal/enemies/staticBatch obejmują wszystkie trzy areny;
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
