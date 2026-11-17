# Areny Przejęcia

`src/data/modes/conquest.json` wskazuje listę `arenas`. Arena jest istniejącą
definicją pokoju combat z metadanymi `arena`; nie ma osobnego loadera geometrii.
`arena.exclusive` wyłącza port z puli zwykłego runu. Dotychczasowe dane
combatRing mają dodatkowe punkty/spawny trybu, bez zmiany zwykłego układu.
Wybór, zgodność `roomId` i zapis: [modes.md](modes.md).

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
