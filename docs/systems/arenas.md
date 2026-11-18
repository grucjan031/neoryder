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

## Terminal kontenerowy

`arenaContainerPort` ma obwiednię projektową 340 × 220 m. Ląd zajmuje
X −170…170 i Z −110…70, z basenem manewrowym wciętym od wschodu
między X 126–146 i Z 57–70. Generator szacuje 53 099 m² powierzchni
chodzenia, wliczając poziomy. Pogoda `storm`, granatowe
poszycie i mokry plac, bursztynowe akcenty oraz reflektory w ciepłej bieli.

| Punkt | X / Y / Z (m) | Strefa |
| --- | --- | --- |
| A | −148 / 0 / −25 | Wnętrze hali |
| B | 0 / 0 / −5 | Skrzyżowanie alei placu |
| C | −65 / 12,8 / 88 | Wyrównane pokrywy luków sekcji środkowej statku |
| D | 60 / 0 / −90 | Wolny odcinek bocznicy |
| E | 140 / 0 / 0 | Wjazd przed biurem |

Promienie punktów wynoszą 5 m. Gracz zaczyna na zachodniej kei (−150, 0, 55).
Przejęcie ma 200 biletów i limit 12 żywych przeciwników. 32 pozycje posiłków,
w tym trzy na pokładzie, korzystają z pierścienia 25–95 m.

- **Hala** ma trzy bramy od placu, drzwi ku kei i wyjście ku bocznicy.
  Panele `port_warehouse_shell_panel` i kratownice `port_warehouse_roof_truss`
  tworzą obudowę. Regały i skrzynie dzielą parter. Schody z obu końców
  prowadzą na antresolę 5 m przy zachodniej ścianie.
- **Plac** dzielą dwie aleje wschód–zachód i trzy północ–południe o nominalnej
  szerokości 10–12 m. Rzędy długości ok. 43–55 m tworzą zwarte bloki
  stosów liczących 1–4 warstwy. Między blokami biegną ok. 3-metrowe zaułki.
  Przy B są szersze narożniki, a obrócone otwarte kontenery tworzą dwa
  poprzeczne przejścia. Pomosty `port_lashing_platform` i rampy łączą
  dachy trzech bloków na 5,182 i 7,773 m. Stosy zajmują ok. 50,8% rzutu placu.
- **Keja** korzysta z `quay_concrete`, `quay_lines`, krawędzi
  `port_quay_edge`, pachołków z linami, budek, masztów i wózków. Kontenery
  oczekujące na załadunek i bariery tworzą osłony na podejściach.
  Dwie suwnice STS przy X −70 i −10 górują nad nabrzeżem. Tafla wypełnia
  basen i sięga do panoramy.
- **Statek** składa się z rufy z nadbudówką, środkowego pokładu, otwartej
  ładowni i dziobu. Dwa trapy prowadzą na y = 12 m. Najazdy po obu stronach
  wspólnej płyty pokryw podnoszą gracza na 12,8 m. Suwnica ma cztery biegi
  schodów na 12 m i kładkę na płytę. Łagodna rampa serwisowa daje AI
  drogę do tej samej kładki. Dno ładowni na 3 m łączy się z uzbrojonym
  pokładem przez trzy biegi przechodzące przez lukę w zrębnicy.
- **Bocznica** zawiera szyny, podsypkę, otwarte i zamknięte wagony,
  platformy z ładunkiem i kozioł oporowy. Otwarte wagony mają przejście
  ze stopniami po obu stronach. Nasyp z torami poza północnym ogrodzeniem
  służy oprawie.
- **Brama i biuro** skupiają budki, szlabany i parking z wrakami. Parter
  biura ma dwa wejścia, a na dach prowadzą dwa biegi zewnętrzne.
  Wschodnia keja przechodzi w skład pustych kontenerów.

A–B można przejść środkiem przez bramy i aleję albo wyjść ku kei i wejść
na dachy stosów. B–C prowadzi przez nabrzeże do trapów albo na kładkę
suwnicy. B–D ma dojście wzdłuż przejazdów i bocznicy lub obejście dachami
w stronę wschodniego przejazdu. D–E można przejść placem albo po dachu
biura. Zachodnia i wschodnia droga między placem i keją mają odcinki
osłonięte barierami, agregatami i składem. Oznakowane dojazdy między halą,
bramą i bocznicą prowadzą obok kontenerów, platform kolejowych i odcinków
ogrodzenia z przerwami. Niewidoczne collidery zabezpieczają
ogrodzenia i krawędzie nad wodą. Materiały pokładu i poszycia korzystają z
`ship_deck_steel` i `ship_hull_paint`, a torowisko z `rail_ballast`
i `rail_sleeper_concrete`.

[Rzut SVG](../arenas/arenaContainerPort.svg). Generator zapisuje 2079 bloków,
1718 instancji modeli i 46 źródeł światła. Najczęstszy wariant stanowi 13,0%
instancji.
Na siatce 0,25 m największy pusty kwadrat na placu ma bok 18,75 m,
a na całym lądzie 28,5 m. Największy pusty prostokąt na placu to fragment
długiej alei 230 × 11,5 m, a na lądzie pas bocznicy 334,5 × 13 m.
Port używa komórek
statyki 20 m i nawigacji 2 m. Krótkie strome biegi i trapy są trasami
gracza. Test kapsuły obejmuje punkty, oba trapy, schody suwnicy, ładownię
i dachy stosów. Oba archetypy mają fizyczne testy dojścia do A–E z ośmiu
spawnów, a walidator trybu sprawdza drogi ze wszystkich 32 pozycji.

Otwórz `?scene=conquest&arena=arenaContainerPort&debug=1` i wpisz `god`.
Konsola `tp <x> <z>` zachowuje wysokość. Na poziomie kei:

| Miejsce | Komenda |
| --- | --- |
| Nabrzeże | `tp -150 55` |
| Hala / A | `tp -148 -25` |
| Plac / B | `tp 0 -5` |
| Bocznica / D | `tp 60 -90` |
| Brama / E | `tp 140 0` |
| Statek / C | `tp -124 69`; podejdź do początku trapu, wejdź na pokład i skręć na pokrywy luków |

W grze sprawdź czytelność sylwetek w ulewie przy zmianie stref, tempo dojścia
posiłków, możliwość zerwania kontaktu ogniowego w alejach oraz przejścia
między gruntem, dachami i pokładem. Z pokładu obejrzyj widok w stronę wody
i porównaj wysokości suwnic z halą. Progi GPU i wczytania sprawdza profil
przeglądarkowy opisany poniżej.

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

AI wybiera szerokie rampy: wąskie kładki o przejściu 1,378 m nie mieszczą
pełnego marginesu nawigacji 0,8 m i służą graczowi. Wszystkie punkty są
osiągalne bez nich. Walidacja trybu wymaga wolnego koła na wysokości punktu
oraz drogi od gracza i każdego spawnu do wszystkich punktów. Posiłki zachowują wspólny
minimalny odstęp 15 m, który pierścień areny może zwiększyć, i odstęp od innych wrogów.

## Wydajność i pomiar

Port wykorzystuje wzorzec commita `0ade40c`: jeden `static-world` dla brył,
modeli i dekoracji oraz jedno scalanie według materiału w komórkach 20 m.
Powtarzane siatki kontenerów są `InstancedMesh`, grupowane w komórkach
dla cullingu. Okucia i nadruki wariantów farby współdzielą partie. Pojedyncze
siatki oraz moduły kei i pozostałe rekwizyty trafiają do scalania statyki.
Pozostałe pokoje zachowują swój dotychczasowy sposób scalania. Collider każdego
bloku jest statyczny. Smugi i rozbryzgi mają istniejące pule, bez tworzenia
obiektów na każdą kroplę. Bufory instancji i scalone geometrie są zwalniane.

Pomiar Terminalu kontenerowego w Vitest:

| Pomiar | Wynik |
| --- | ---: |
| Statyczne siatki przed i po scalaniu, rzeczywiste GLB | 6 681 → 2 929 |
| Partie instancji | 1090 |
| Nawigacja z pięcioma polami | 47,77 ms |
| 12 wrogów w hoście Przejęcia, średnia z 600 kroków | 0,418 ms/krok |

Sortowanie przeszkód nawigacji według komórek ogranicza przygotowanie
siatki do sprawdzania brył w sąsiedztwie próbki.

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

Komendy dla Terminalu kontenerowego są w sekcji tej areny.

Nowe areny: `?scene=conquest&arena=arenaOverpass&debug=1` oraz
`?scene=conquest&arena=arenaRooftops&debug=1`. Wpisz `god`, przejdź A–B–C
bez skoków, potem drugą rampę estakady i schody/kładki targu. Sprawdź `room`,
`weather` i `conquest` przez query; profil powinien wynosić odpowiednio
`smog` i `drizzleWind`. Oceń czytelność wrogów w pyle i mżawce, drogi posiłków
na B/C, osłony, śliską wizualnie papę i zabezpieczenie zewnętrznych krawędzi.
Galeria: `?scene=city-props-test&view=4` (estakada), `&view=5` (targ).
Testy traversal/enemies/staticBatch obejmują wszystkie trzy duże areny;
e2e startu nowych aren jest napisany, bez uruchamiania w sandboxie.

Galeria `?scene=city-props-test&view=3` pokazuje materiały portu.
`arenaStaticBatch.test.ts` porównuje obwiednie samodzielnych kontenerów
z colliderami i sprawdza ładowanie modeli bez nierozpoznanych materiałów.
