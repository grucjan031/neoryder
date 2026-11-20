# Areny Przejęcia, Szturmu i Kradzieży rdzenia

Wspólna biblioteka generatorów dużych aren (ADR 0011 / D5), API prymitywów,
walidacja i rzuty SVG: [arena-generators.md](arena-generators.md).

`src/data/modes/conquest.json` wskazuje listę `arenas`. Arena jest istniejącą
definicją pokoju combat z metadanymi `arena`; nie ma osobnego loadera geometrii.
`arena.exclusive` wyłącza port z puli zwykłego runu. Dotychczasowe dane
combatRing mają dodatkowe punkty/spawny trybu, bez zmiany zwykłego układu
(punkty A, B o promieniu 2,75 m i C o 3,5 m, 4 spawny trybu, bez `exclusive`
i `spawnRing`, więc tryb używa starej ścieżki spawnu poniżej).
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

Dokładny algorytm (`selectArenaSpawn`, `Conquest.spawnPosition`), ważny dla
determinizmu: pula = `arena.spawnPoints` (jeśli są, ze swoim `y`; inaczej
`room.spawnPoints` na wysokości `playerSpawn.y`; `y` z puli areny obowiązuje
tylko przy `spawnRing`), przefiltrowana przez „bezpieczne”: wolne koło
`tuning.modes.conquest.spawnClearanceM` (0,8), odległość XZ od gracza ≥
`minSpawnDistanceM` (15) i ≥ 2 × `spawnClearanceM` od każdego żywego wroga.
Potem: `allowed` = odległość od gracza ≥ `minM` (puste → brak spawnu); `inside` =
`allowed` z odległością ≤ `maxM`; `hidden` = elementy `inside` zasłonięte dla oczu
gracza (raycast do punktu `y + spawnSightHeightM` = 1,5 m po geometrii świata);
kandydaci = `hidden`, a gdy puste `inside`, a gdy puste `allowed`. Wynik punktacji:
gdy `inside` niepuste i są cele — minimalna odległość do celu (sporne punkty
przejęcia, a gdy żaden nie jest sporny — punkty niebędące własnością wroga),
inaczej odległość do gracza; wygrywa najmniejsza, remis rozstrzyga jedno
`rng.pick` na kandydatach o równym wyniku, w kolejności puli. Potem host losuje
`ctx.rng.pick(definition.enemies)` (tylko gdy spawn istnieje; losowanie
zużywane nawet gdy `spawnEnemy` odrzuci wroga z powodu limitu). Strumień to
wspólny `ctx.rng` pokoju (`rng.fork('room:<nodeId>')`), nie osobny fork. Bez
`spawnRing`: pula to punkty wroga (`owner==='enemy'`), a gdy żaden nie jest
bezpieczny, pula spawnów areny/krawędzi podłóg (rogi bloków podłogi cofnięte o
`edgeInsetM` 2 m); `rng.pick`. Spawn wstrzymany, gdy wynik rozstrzygnięty, bilety
wyczerpane, żywych ≥ `maxAlive` lub trwa odstęp `spawnIntervalS`.

Nawigacja warstwowa (`ArenaSurfaceNavigation`, używana gdy jakikolwiek blok ma
`walkable`; w przeciwnym razie `ArenaNavigation` buduje płaską siatkę po podłodze
na wysokości `playerSpawn.y`, z pominięciem komórek przy obróconych blokach)
używa pól `Int32Array` budowanych na żądanie (start lub cel poza siatką — margines przy
przeszkodzie/krawędzi — są zastępowane najbliższą przejezdną komórką w promieniu
`tuning.arena.navFallbackCells`),
a w kroku symulacji przegląda tylko prosty odcinek do zakrętu. Dla
syntetycznej areny 450×300 m test używa komórek 2 m, dwóch ramp,
trzech poziomów i pięciu stref. Sprawdza dojście ze wszystkich
spawnów w walidatorze, a także ruch Szturmowca do każdej strefy
w scenie z Rapierem.

| Pomiar z `arenaPerf.test.ts`                               |         Wynik | Budżet ADR 0011 |
| ---------------------------------------------------------- | ------------: | --------------: |
| `ArenaSurfaceNavigation`, siatka i pięć pól                |      59,76 ms |        ≤ 500 ms |
| `ArenaNavigation`, siatka i pięć pól                       |      66,65 ms |        ≤ 500 ms |
| `RoomScene`, 12 wrogów, średnia z 600 kroków po rozgrzewce | 0,759 ms/krok |     ≤ 2 ms/krok |

Budowa siatki korzysta z indeksu brył w kubełkach 2 m (wynik identyczny
z pełnym przeglądem; budowa 240 × 240 m spadła z 5,4 s do ok. 0,15 s).
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

| Punkt | X / Y / Z (m)   | Strefa                                          |
| ----- | --------------- | ----------------------------------------------- |
| A     | −148 / 0 / −25  | Wnętrze hali                                    |
| B     | 0 / 0 / −5      | Skrzyżowanie alei placu                         |
| C     | −65 / 12,8 / 88 | Wyrównane pokrywy luków sekcji środkowej statku |
| D     | 60 / 0 / −90    | Wolny odcinek bocznicy                          |
| E     | 140 / 0 / 0     | Wjazd przed biurem                              |

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

| Miejsce      | Komenda                                                                           |
| ------------ | --------------------------------------------------------------------------------- |
| Nabrzeże     | `tp -150 55`                                                                      |
| Hala / A     | `tp -148 -25`                                                                     |
| Plac / B     | `tp 0 -5`                                                                         |
| Bocznica / D | `tp 60 -90`                                                                       |
| Brama / E    | `tp 140 0`                                                                        |
| Statek / C   | `tp -124 69`; podejdź do początku trapu, wejdź na pokład i skręć na pokrywy luków |

W grze sprawdź czytelność sylwetek w ulewie przy zmianie stref, tempo dojścia
posiłków, możliwość zerwania kontaktu ogniowego w alejach oraz przejścia
między gruntem, dachami i pokładem. Z pokładu obejrzyj widok w stronę wody
i porównaj wysokości suwnic z halą. Progi GPU i wczytania sprawdza profil
przeglądarkowy opisany poniżej.

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

| Punkt | X/Y/Z (m)        | Strefa i charakter                                                                               |
| ----- | ---------------- | ------------------------------------------------------------------------------------------------ |
| A     | 0 / 0 / 40       | Gęste obozowisko: namioty kopułowe i dwuspadowe, szopy, beczki, wraki; przejścia między osłonami |
| B     | −70 / 11,6 / −3  | Jezdnia poziomu 1 w osi X, wraki i zielone oczyszczacze; łącznik obsługi po zachodniej stronie   |
| C     | 95 / 0 / −100    | Stacja paliw NE: wiata, cztery dystrybutory, sklep z dwoma wejściami i wyposażeniem              |
| D     | −120 / −4 / 60   | Betonowy kanał burzowy w osi Z, niskie osłony i boczne wnętrza przepustów                        |
| E     | 27 / 23,2 / −110 | Jezdnia poziomu 2 przy urwanym północnym końcu; landmark `hw_broken_deck_end` przy Z −152        |

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

1532 bloki (483 z modelem), 164 dekoracje, łącznie **647 rekwizytów**.
Pula wybiera aktywne światła ze 121 źródeł (wcześniej 37). Wzdłuż ulic stoi
39 latarni. Pod płytą świecą oprawy w ciepłej bieli, a 14 szyldów z halo
oznacza pierzeje, stację, bramki i portal. Witryny i wnętrza mają lokalne
światła, a ogień w obozowisku daje krótki bursztynowy akcent. W kanale przy
D świecą ciepłobiałe oprawy na ścianie. Zieleń pozostaje przy wlotach, gdzie
ma mały zasięg i wyłączoną poświatę na podłodze.
Materiały `overpass_street` i `overpass_forecourt` zachowują chłodny grafit
również przy wyłączonym detalu powierzchni.
Najczęstszy model to 66 wraków (10,2% instancji).
Komórki statyki mają 180 m (cztery ćwiartki).
nawigacja 2 m, margines 0,8 m, prześwit 2 m, dopuszczalny wznios 0,52 m.
Większe partie statyki ograniczają liczbę siatek kosztem dokładności cullingu;
do oceny na GPU pozostają widoki przez całą mapę.

Niezbędne poprawki wydajności: lokalny indeks brył nawigacji zamiast pełnego
skanu na każdą komórkę oraz scalenie zgodnych części klonu GLB przed
instancingiem. Źródłowy cache modeli i transformacje pozostają zachowane.
Kontrola GLB porównuje teraz obrócone obwiednie, zachowując tolerancję 5%.

Pomiar lokalny: nawigacja i pięć pól 68 ms (budżet 500 ms); symulacja
12 wrogów 0,371 ms/krok (budżet 2 ms); statyka rzeczywistych GLB
3740 → **796 siatek**, w tym 504 partie instancji. To pomiar strukturalny,
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

## Budowa wieżowca

`arenaConstructionSite` (ADR 0011): 240 × 240 m, do 30 m w górę (stropy do
24 m, maszynownie klatek 27,4 m, żuraw 65 m), pogoda `clearNight`, motyw
`neonStreet`. Generator `tools/arenas/arenaConstructionSite.mjs` — każda
strefa to osobna funkcja (`ground`, `perimeter`, `excavation`, `tower`,
`towerFloors`, `towerCrane`, `storageYard`, `compound`, `plaza`,
`surroundings`, `modeLayout`), wspólny kontekst `createSite` daje rekwizyty
z kolizją (`prop`/`placeModel`), rejestr zajętych rzutów i ostrzeżenia
o kolizjach. Rzut: [docs/arenas/arenaConstructionSite.svg](../arenas/arenaConstructionSite.svg).
X na wschód, Z na południe (północ = −Z).

Obrys: kwadrat bez narożnika NE (x > 60, z < −60 to ulica) i z zatoką bramy
wjazdowej (x 84…120, z 114…120). Granicą jest ogrodzenie `build_hoarding_fence`
(skala 1,5: moduł 6 m, 3,6 m wysokości) z przodem na ulicę; stopy i zastrzały
modelu mają niewidoczny pas kolizji 1 m po stronie budowy. Za nim, 0,8 m na
zewnątrz, niewidoczne zabezpieczenie 14 m. Dalej ulice 20 m z chodnikami
i pierzeje kamienic 12–30 m (fasady z oknami, rolety, markizy, klimatyzatory,
szyldy, dachy z antenami i zbiornikami, 4 hologramy) — bez dostępu gracza;
grunt zewnętrzny i panorama z silnika horyzontu.

| Strefa (rodzaj)               | Obszar X / Z (m)          | Charakter, rekwizyty, materiały                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wykop (low)                   | −100…−20 / −20…60, dno −8 | ściany szalunkowe N i E (`formwork_plywood`, dźwigary `rust`, oczep i kleszcze `metal`), ziemne S i W (`excavation_dirt`); dwie rampy dla ciężarówek wzdłuż X na nasypach (północna z pasa zachodniego przez spocznik −4 m z porzuconą `build_mixer_truck`, nachylenie 0,2; południowa ze wschodniej drogi, 32 m, 0,25); dwie stalowe klatki schodowe (`steel_grating`, stopień 0,29 × 0,3 m); dwie palownice z masztem 12 m, głowice pali, skrzynie ze sklejki, kontenery narzędziowe, kałuże błota, maszt naświetlaczy na dnie                                                                                                                                                                            |
| Szkielet wieżowca (high)      | 10…70 / −60…10            | stropy `concrete_raw_cast` 0/4/8/12/16/20/24 m; szyb 25…33 / −22…−16 przez 4–16 m; niedokończone: 12 m NE (52…70 / −60…−40), 16 m pas W (10…16 / −20…10), 20 m narożnik SW (10…36 / −6…10), 24 m ćwiartka SW (10…44 / −20…10) z deskowaniem na stemplach; słupy 0,6 m w siatce X 12/23/34/46/57/68 × Z −58…8 co 11 m tylko pod stropem (kondygnacja 20→24: `build_unfinished_column` ×0,75); dwa trzony (14…30 / −45…−38 i 50…66 / −12…−5) ze ścianami do 27 m i drzwiami 3 × 2,8 m na każdej kondygnacji; rusztowania `build_scaffold_bay` na licu S (38,5…53,5 / 10…12,6, do 24 m) i W (7,4…10 / −27,5…−12,5, do 12 m); szalunki słupów i tarcze ścian na 24 m; girlandy lamp pod stropami elewacji S i W |
| Plac składowy (dense)         | −100…0 / −110…−40         | utwardzony beton; 21 partii: `build_precast_stack` (1–2 warstwy), `build_pipe_stack`, `build_rebar_bundle` na podkładach, kontenery 1–2 warstwy, palety (`scaffold_planks` + ładunek) i `city_crates`; przejścia 3–8 m łamią linie widoku co 20–40 m; dwie hałdy ziemi (rampa 12 m na 3 m, szczyt 6 × 8 m, zejście); zamknięta brama północna                                                                                                                                                                                                                                                                                                                                                               |
| Zaplecze budowy (interior)    | 70…115 / 40…110           | kostka; rząd 6 biur `build_site_office` w dwóch kondygnacjach z pomostem `steel_grating` na 2,591 m i `build_site_office_stairs` na obu końcach (pod pomostem zadaszone przejście); 4 biura wschodnie, stróżówka przy bramie; magazyn narzędzi 18 × 14 × 4,5 m z wnętrzem (regały, skrzynie, warsztat) i dwoma wejściami; toalety, agregaty, parking 7 aut, śmietniki, automat; zieleń i ciepła biel                                                                                                                                                                                                                                                                                                        |
| Plac manewrowy i wjazd (open) | −20…70 / 64…120           | asfalt; brama SE w zatoce (x 96…108, z 114) z ryglem, rozsuniętym skrzydłem i barierami od ulicy; betonomieszarka w użyciu, kontenery, prefabrykaty, linie barier betonowych co 15–25 m, pachołki, maszty naświetlaczy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Pozostały teren budowy (`excavation_dirt`): narożnik startu (kontenery
socjalne, materiały, latarnia), pas zachodni (kontener 40 ft, wjazd na
rampę), pas północny wzdłuż wykopu, dostawy na północ od szkieletu i teren
wschodni z żurawiem. Krawędzie wykopu mają bariery betonowe z przerwami
(zeskok na dno bez skoku w górę z powrotem). Landmarki: żuraw
`build_tower_crane` przy (80, 0, 30) z wysięgnikiem nad szkieletem
(fundament 6,4 m, niewidoczny collider trzonu 2,4 × 50 m), sam szkielet
z girlandami lamp i maszty naświetlaczy.

| Punkt | X / Y / Z (m) | Promień | Miejsce                                                     |
| ----- | ------------- | ------- | ----------------------------------------------------------- |
| A     | −60 / −8 / 20 | 5       | dno wykopu, bursztyn nad punktem                            |
| B     | 40 / 8 / −25  | 5       | strop 8 m, wolne pole między słupami 34/46 a szybem         |
| C     | −50 / 0 / −75 | 5       | prześwit w środku placu składowego                          |
| D     | 92 / 0 / 72   | 5       | dziedziniec zaplecza między biurami, magazynem i parkingiem |
| E     | 20 / 0 / 90   | 5       | plac manewrowy między wykopem a zapleczem                   |

Poziomy chodzenia: −8 (dno), −4 (spocznik rampy, spoczniki schodów), 0,
2,591 (pomost biur), 3 (szczyty hałd), 4…24 co 4 m (stropy). Trasy między
sąsiednimi punktami, zawsze co najmniej jedna przez inny poziom:

- A–C: rampa północna → pas zachodni → plac; albo schody stalowe N →
  pas północny → przejście x −54…−50.
- A–E: rampa południowa → droga wewnętrzna; albo schody stalowe S →
  narożnik startu → plac.
- E–B: parter → trzon CE/CW; albo rusztowanie S prosto z placu na 4/8 m.
- C–B: pas północny → parter → trzon CW; albo rusztowanie W z drogi
  wewnętrznej na 4/8/12 m.
- B–D: trzon CE → teren wschodni koło żurawia → zaplecze; albo przez plac.
- D–E: plac i droga od bramy; albo pomost biur na 2,591 m.

Biegi trzonów i rusztowań mają 48 stopni 0,25 × 0,083 m na 4 m wzniosu
(12 m biegu): kapsuła wroga bez autostepu wjeżdża po nich jak po pochylni
(kąt styku < 45°), nawigacja ma 0,33 m wzniosu na komórkę, gracz ma autostep.
Schody wykopu i biur są trasą gracza. Niewidoczne zabezpieczenie krawędzi
(2 m) jest tylko na obrysie stropów 20 i 24 m, z przerwami na spoczniki
rusztowania; niższe krawędzie są otwarte (zeskok bez obrażeń).

Tryb: `arena.maxAlive` 12, `arena.enemyTickets` 180, `arena.spawnRing`
25–85 m, pula 24 spawnów z wysokością (`arena.spawnPoints`): wykop 4,
szkielet 6 (parter, 12, 16, 20 i 24 m), plac składowy 4, teren wokół
szkieletu i żurawia 3, zaplecze 2, plac i pas zachodni 5; 16 spawnów na
gruncie także w `spawnPoints` pokoju. Najbliższy spawn jest 67 m od startu
(−100, 0, 100).

Materiały: `excavation_dirt`, `formwork_plywood`, `concrete_raw_cast`,
`scaffold_planks`, `hazard_stripes_worn` (nowe materiały bloków, tekstury
z `public/assets/textures/surfaces`, wpisy w `arenaMaterials.json`;
`formwork_plywood` i `concrete_raw_cast` utraciły `flat` — dotyczą też
modeli budowy/elektrowni, które nie stoją na innych mapach) oraz
`asphalt`, `paving`, `concrete`, `steel_grating`, `metal`, `rust`,
`crane_paint`, `corrugated`, `container_*`, `facade`, `roof_tar`.

Oświetlenie: 40 świateł + 13 latarni. Bursztyn ostrzegawczy (15: wykop,
palownice, klatki, brama, punkty A/C/E), ciepła biel naświetlaczy (16:
maszty 18,5 m, stropy, wnętrza), zieleń zaplecza (5), fiolet i błękit
miasta (4). Światła poniżej poziomu startu (wykop) kładą plamę na dnie
(`lightSpotFloors`), nie w powietrzu nad wykopem.

Pomiary (2026-11-18):

| Pomiar                                                                    |                                                      Wynik |                 Budżet |
| ------------------------------------------------------------------------- | ---------------------------------------------------------: | ---------------------: |
| `checkArena`: wymiar, powierzchnia chodzenia                              |                                    240 × 240 m, ≈74 000 m² | 240–450 m, ≥ 40 000 m² |
| Wypełnienie obrysu                                                        |                                                      88,3% |                  ≤ 90% |
| Najczęstszy rekwizyt (`build_hoarding_fence`)                             |                                         156 / 1252 (12,5%) |                  ≤ 15% |
| Bloki / dekoracje / światła / napisy / naklejki                           |          2246 (383 niewidoczne) / 1235 / 40 + 13 / 26 / 20 |                      — |
| Statyczne siatki przed / po scaleniu (`batchCellM` 240), partie instancji |                                           21 530 / 224, 29 |                      — |
| `ArenaSurfaceNavigation` (≈65 000 komórek 1 m, 5 pól)                     | 120–160 ms (pojedynczo), do ~250 ms przy pełnym `npm test` |               ≤ 500 ms |
| `RoomScene`, 12 wrogów na trzech poziomach                                |                                               0,43 ms/krok |            ≤ 2 ms/krok |
| Wywołania rysowania, medium, 1280 × 720, bez wrogów (SwiftShader)         |                            700–770 w najszerszych widokach |                  ≤ 800 |

Duża komórka scalania (240 m, czyli cztery ćwiartki wokół środka) jest
celowa: na otwartej budowie prawie wszystko jest w kadrze, więc liczba
wywołań zależy od liczby materiałów, nie od cullingu. Modele budowy
i miasta są dekoracjami z niewidocznym colliderem (scalane z resztą statyki);
instancjami zostają wyłącznie kontenery. Każdy żywy wróg dodaje kilka
wywołań (z 12 wrogami ok. 830–990). Wartości wywołań pochodzą z renderera
programowego (SwiftShader); pomiar GPU na komputerze deweloperskim
(`tools/perf/profile.mjs --quality medium`) pozostaje do wykonania.

Sprawdzenie w 30 sekund: `?scene=conquest&arena=arenaConstructionSite&debug=1`,
`god`, potem `tp <x> <z> <yaw> <pitch> <floorY>` (piąty argument stawia
gracza na danej wysokości):

- `tp -100 100 -45 0` — start; żuraw i szkielet nad placem.
- `tp -64 4 160 -5 -8` — dno wykopu przy A; `tp -60 -24 180 -25 0` — krawędź.
- `tp 40 -18 0 0 8` — B na stropie 8 m; `tp 41 6 0 0 0` — wejście na rusztowanie S.
- `tp -50 -66 0 0 0` — C w placu składowym; `tp -83 -54 90 0 3` — szczyt hałdy.
- `tp 92 64 180 0 0` — D; `tp 76 50 90 0 2.591` — pomost biur.
- `tp 20 98 0 0 0` — E i plac manewrowy; `tp 102 108 180 0 0` — brama.
- `tp 12 -40 90 -22 24` — widok z 24 m na wykop i plac składowy;
  `tp 60 8 200 -22 24` — widok na zaplecze.

Do oceny „feel”: tempo posiłków na 240 m (pierścień 25–85 m), czytelność
czerwonych wrogów w ciemnym wykopie i na wysokich stropach, odczucie
drobnych stopni klatek (0,083 m), ilość osłon na otwartym placu E,
widoczność krawędzi bez barierek na 4–16 m.

## Zajezdnia Maglev — `arenaRailYard`

Generator: `tools/arenas/arenaRailYard.mjs`, stały seed `maglev-winter-1`.
[Rzut SVG](../arenas/arenaRailYard.svg). Granice X −210…210, Z −90…90 m:
420×180 m, wydłużenie 2,33. Powierzchnia chodzenia około 72 tys. m²
(próbkowanie check co 1 m, z odejmowaniem przeszkód i sumowaniem pięter).
Pogoda `snow`; grafit, chłodny błękit, ciepła biel lamp, zielone i bursztynowe
sygnały. Początek gracza (−200, 0, 70). Posiłki: 29 pozycji (28 na gruncie
i jedna na peronie), pierścień
25–100 m, `arena.maxAlive = 12`, `arena.enemyTickets = 200`.

| Strefa         | Zakres i charakter                                                                                                                                                                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pole torów     | Sześć osi X (Z −45/−35/−10/0/25/35). Cztery osie zajmują długie rzędy wagonów, z przejściami między grupami i przez otwarte wagony. Z=35 i większość Z=0 zachowują długie osie ostrzału. W międzytorzach stoją szafy, stosy podkładów i pojazdy techniczne. Dwa dodatkowe krótkie biegi schodów prowadzą na dachy 4,1 m.      |
| Hala serwisowa | X −200…−110, Z −70…−10, dach 14 m. Trzy wschodnie bramy, boczne wyjścia, dwa kanały −1,5 m z zejściami, antresola biurowa 5 m z dwoma biegami, suwnica na przyściennych torach. Blacha, kraty, beton, stos rur, generator.                                                                                                    |
| Kładka         | Przy X 20, Z −80…60, poziom 8 m. Dwa szerokie wejścia schodowe na końcach, trzecie przez boczny spocznik peronu. Podpory tylko pod podestami, poręcze i ciepłe lampy.                                                                                                                                                         |
| Peron wyspowy  | X −40…80, Z 45…55, poziom 1,1 m. Dwie rampy na końcach, pięć modułów wiaty, automaty i ławki po północnej stronie, otwarta południowa ścieżka. Beton peronu i stal, błękitne akcenty.                                                                                                                                         |
| Nastawnia      | Model `rail_control_tower` przy (120, 0, −60), galeria 10 m. Oryginalne schody modelu mają osobne collidery; szerokie schody od (48, 0, −76) dochodzą do zachodniego pomostu galerii. Obok otwarte biuro i kiosk. Landmark: jasna kabina ponad składami.                                                                      |
| Obrotnica      | Przy (170, 0, 40), dno zagłębienia −1,5 m. Mechanizm modelu zagłębiony do −2,5 m pod tymczasowym mostem 28×12 m na poziomie 0; centralna prowadnica nie przecina wolnego koła E. Dwie rampy do kanału. Parowozownia X 150…205, Z 55…88: dostępne wnętrze, dwie bramy, zachowane boczne połacie dachu i krótki wachlarz torów. |

| Punkt | X / Y / Z [m]  | Położenie                            |
| ----- | -------------- | ------------------------------------ |
| A     | −155 / 0 / −40 | Wolny środek hali, pomiędzy kanałami |
| B     | −40 / 0 / −22  | Przestrzeń między składami           |
| C     | 20 / 1,1 / 50  | Peron pod kładką                     |
| D     | 120 / 0 / −40  | Przed nastawnią                      |
| E     | 170 / 0 / 40   | Szeroki most serwisowy obrotnicy     |

Wszystkie promienie wynoszą 5 m. Do A–E prowadzą trasy bez skoku.
A–B: bramy wschodnie albo południowe hali, wariant przez antresolę.
B–C: przejazdy i rampy peronu albo dach składu przy (−24, 25), dostępny
z obu końców schodami. C–D: teren między składami albo kładka 8 m i
galeria nastawni 10 m. D–E: zachodni koniec mostu albo wschodni objazd
z zejściem do kanału obrotnicy. Drugi dostępny dach składu: (54, 0).
Otwarte wagony mają osobne ściany z otworami, podłogę, sufit i schodki
przy obu parach drzwi. Wąskie przejścia wagonów i schody są trasami gracza;
AI korzysta z przejazdów oraz ramp. Siatka AI 2 m, margines 1,1 m.

Droga techniczna na południu ma krawężniki, parking, pojazdy i bariery.
Szesnaście małych warsztatów z wnętrzami, bramy i ogrodzenia dzielą zaplecze.
W hali stoją dwa dwuwagonowe zestawy, regały i szafy. Ciepłe lampy
i bursztynowe światła robocze oświetlają ich sąsiedztwo pod suwnicą.
Granice: północny mur oporowy z zaspami i nasypem oprawy; południowe
ogrodzenie; zamknięte końce torów na wschodzie i zachodzie. Niewidoczne
zabezpieczenie jest za tymi granicami. Za nimi stoją dekoracje bez kolizji:
ulica, lampy, samochody, zabudowa, zaspy i fragmenty estakady. Ciągłość
zewnętrznego gruntu i panoramę zapewnia istniejący `SceneAtmosphere`.

Materiały: `snow_asphalt`, `snow_concrete`, `rail_ballast`,
`rail_sleeper_concrete`, `maglev_body_panel`, `steel_grating`, blacha,
rdza i metal. Nowe nazwy bloków oraz dwie nawierzchnie śnieżne są podpięte
do rejestru materiałów; `mat_snow` zasp używa istniejącej tekstury
`snow_concrete` zamiast brakującego pliku `snow`. Pozostałe mapy nie używają
tych zasp i zachowują swój wygląd.
Światła są rozmieszczone w każdej strefie i korzystają z istniejącej puli.

Peron ma ciepłe lampy pod wiatami i przy krawędzi. Kioski, automaty,
bagaże i barierki uzupełniają ławki przy wolnym przejściu do C. Stanowiska
przed obrotnicą mają wózki, podkłady, zaspy i kontener narzędziowy.
Szafy i skrzynie pod kładką dzielą przestrzeń co 25–29 m.
Hala, parowozownia, warsztaty i nastawnia mają lokalne oprawy. Świecące
okna, zielone i bursztynowe sygnały oraz niebieskie światło przy pasach
wagonów dają punkty orientacyjne również przy ograniczonej puli świateł.
Reflektory przy torach mają zasięg 52 m.

Wynik generatora po przejściu światła: 1850 bloków (223 z modelem),
266 dekoracji, łącznie 489 rekwizytów modelowych, 134 źródła świateł
i 29 spawnów trybu. Wcześniej było 458 rekwizytów i 59 świateł.
Wózki z brył są liczone w blokach. Najczęstszy rekwizyt to
52 × `rail_snow_drift_long` (10,6%). Check ma 0 błędów i przypomina
o ręcznym sprawdzeniu naturalnych granic. Powierzchnia to 72 290 m².

Największy kwadrat bez widocznych osłon naziemnych zmalał z 58×58 m do
39×39 m. Największy prostokąt ma 310×9 m i biegnie wzdłuż drogi serwisowej.
Pomiar w rzucie XZ na siatce 1 m uwzględnia widoczne bloki o wysokości
co najmniej 0,75 m, sięgające co najmniej 1 m nad grunt i zaczynające się
najwyżej 0,5 m nad nim.

| Pomiar lokalny w Node przed zagęszczeniem             |         Wynik |     Budżet ADR 0011 |
| ----------------------------------------------------- | ------------: | ------------------: |
| Nawigacja powierzchniowa + pięć pól                   |      46,35 ms |             ≤500 ms |
| `ArenaNavigation` + pięć pól                          |      63,01 ms |             ≤500 ms |
| `RoomScene`, 12 wrogów, 600 kroków po rozgrzewce      | 0,431 ms/krok |          ≤2 ms/krok |
| Rzeczywiste GLB: siatki statyczne przed → po scalaniu |   5444 → 2093 | pomiar strukturalny |
| Partie `InstancedMesh`                                |            28 |                   — |

Niezbędna poprawka wydajności silnika: `ArenaSurfaceNavigation` wybiera
przeszkody z komórek o boku `batchCellM`, następnie wykonuje ten sam dokładny
test co wcześniej. Usuwa pełny skan wszystkich bloków dla każdej próbki.
Test porównuje ścieżki z indeksem 20 m i z komórkami większymi od całej mapy,
również przy obrotach i na granicach komórek. Kontrakty AI bez zmian.

Testy: `arenaRailYard` (check, zod, walidacja trybu, każda para spawn–punkt),
`arenaTraversal` (kapsuła z początku i trzech spawnów, oba końce kładki,
schody hali i nastawni, przejście przez otwarty wagon oraz dach składu),
`arenaEnemies` (oba archetypy, siedem spawnów, w tym peron, do A–E),
`arenaPerf` (12 wrogów i nawigacja),
`arenaStaticBatch` (rzeczywiste GLB, instancje, jedno scalanie w komórkach).
`arenaWeather.spec.ts` obejmuje start areny, profil snow i komplet A–E;
e2e nie uruchamiano zgodnie z briefem. Budżety GPU ≤800 wywołań i wczytania
≤5 s pozostają do pomiaru w przeglądarce przez managera. Liczba siatek
statycznych po scalaniu nie jest pomiarem wywołań całej klatki. Duża liczba
2093 siatek wymaga szczególnej kontroli najcięższego widoku przy medium.
Rzut wyrenderowano do PNG i obejrzano. Chromium z Playwrighta nie startuje
w sandboxie (`spawn EPERM`), więc użyto renderera SVG resvg; brak zrzutów gry.

Sprawdzenie w 30 sekund: `?scene=conquest&arena=arenaRailYard&debug=1&seed=rail-review`,
komenda `god`, odczyty `query('weather')`, `query('conquest')`, `query('horizon')`.
`tp` zachowuje bieżącą wysokość; poniższe miejsca sprawdzaj z poziomu ulicy:
`tp -155 -40` (hala/A), `tp -40 -22` (tory/B), `tp -50 50` (rampa peronu/C),
`tp -34 -80` (północne schody kładki), `tp -34 60` (południowe),
`tp 120 -40` (nastawnia/D), `tp 170 40` (obrotnica/E),
`tp 178 70` (wnętrze parowozowni). Oceń tempo przemieszczania na osi 420 m,
czytelność czerwonych wrogów na śniegu, gęstość osłon i posiłków, przejścia
otwartych wagonów, przydatność dachów oraz widok spod/znad kładki.

## Zalane Doki

`arenaFloodedDocks` to sześć wysp w obrysie 300×280 m (X −150…150, Z
−140…140). Południowy wschód wcina zatoka o trzech załamaniach nabrzeża.
Na pozostałych obrzeżach stoją wysokie kamienice. Niewidoczna granica
zabezpiecza krawędzie, a za nimi oprawa bez kolizji przechodzi w panoramę.
Profil `rain`, bursztynowe nabrzeża, chłodna woda z błękitnymi i zielonymi
akcentami oraz fioletowe szyldy barki.

| Punkt | X / Y / Z (m)  | Strefa i dojścia                                                                                                    |
| ----- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| A     | −110 / 0 / −80 | Plac przepompowni. Podejście przez most przy X −102 albo rampy północnego kanału.                                   |
| B     | 60 / 1,2 / 50  | Targ na barce. Dwa trapy z niezależnymi rampami na północnym i południowym nabrzeżu.                                |
| C     | 0 / −1,2 / 0   | Skrzyżowanie kanału z poprzeczną odnogą cumowniczą. Rampy przy Z 0 oraz przy Z −12 i 12.                            |
| D     | 90 / 0 / −70   | Targ na wyspie północno-wschodniej. Mosty przy X 46 i 110 oraz dojścia po dnie kanału.                              |
| E     | −80 / 0 / 80   | Dziedziniec między kamienicami z zalaną niecką przy zachodnim boku. Mosty przy X −105 i −51, z alternatywą po dnie. |

Centralne kamienice mają przechodnie partery, osłony wewnątrz i alejki między
kwartałami. Południowy wschód łączy warsztaty i targ z górnym przejściem śluzy
na Y 6 przy Z 110. Północno-zachodnią strefę wyróżnia `dock_pump_house`
przy (−110, 0, −100); na południu orientację zapewniają `dock_barge`
i `dock_lock_gate`. Mosty kamienne i kładki dają płaskie przejścia obok
tras schodzących na Y −1,2. Tafla na Y −0,4 korzysta z `arena.water`,
wartości są oddzielone od geometrii dna. Pomosty i `dock_pontoon`
dochodzą do Y 0,5, pokład barki ma Y −0,4 − 1,0 + 2,6 = 1,2.

Materiały `flood_brick_algae`, `canal_stone_wall` i `boardwalk_planks`
odróżniają kamienice, brzegi i pomosty. Przy przepompowni dominują generatory
i skrzynie, na placach targowych stragany i kioski, przy kei łodzie, zatopione
wraki oraz pale cumownicze. Pula świateł wybiera oprawę z 46 źródeł.
24 pozycje posiłków obejmują sześć stref. Pierścień 25–90 m, 12 żywych
wrogów, 190 biletów. Start (−140, 0, 130), wszystkie promienie 5 m.
Generator mierzy ok. 74 098 m² chodzenia przy próbkowaniu co metr.

| Pomiar                                                                        |              Wynik |
| ----------------------------------------------------------------------------- | -----------------: |
| Nawigacja, siatka 1,5 m i pięć pól (ArenaSurfaceNavigation / ArenaNavigation) | 194,57 / 193,54 ms |
| 12 wrogów w RoomScene, średnia z 600 kroków po rozgrzewce                     |      0,747 ms/krok |
| Statyczne siatki z rzeczywistych GLB przed / po scaleniu w komórkach 20 m     |        5643 / 1929 |
| Partie instancji                                                              |                201 |

Pokrycie fizyki obejmuje wejście na barkę z obu brzegów, przejście śluzy
i dojście kapsuły oraz obu archetypów do A–E. Liczba siatek opisuje całą
scenę przed cullingiem. Pomiar wywołań rysowania przy jakości medium
i czasu wczytania pozostaje do sprawdzenia w przeglądarce.

**Sprawdzenie w 30 sekund.** Otwórz
`?scene=conquest&arena=arenaFloodedDocks&debug=1` i wpisz `god`.
Użyj kolejno `tp -110 -80` (przepompownia), `tp 90 -70` (targ na wyspie),
`tp -113 3` (kamienice), `tp 0 0` (brodzenie), `tp -80 80` (dziedziniec),
`tp 76 39` (wejście na barkę) i `tp -43 110` (wejście na śluzę).
`tp` zachowuje Y, dlatego na pokład i śluzę wchodzi się rampami.
Sprawdź tempo obejść pod ostrzałem, czytelność czerwonych wrogów w deszczu,
czy dojścia na barkę widać z obu brzegów i jak odbiera się zmianę poziomu
przy wejściu do wody. [Rzut areny](../arenas/arenaFloodedDocks.svg).

## Nawigacja nowych aren

Wysokich punktów nie przeniesiono na grunt. `blocks[].walkable` oznacza
płyty i rampy; `ArenaSurfaceNavigation` pod istniejącym `ArenaNavigation`
buduje warstwy o boku `navigationCellM`, marginesie `navigationClearanceM`
(0,8; zajezdnia 1,1), prześwicie `navigationHeadroomM` (2) i maksymalnym wzniosie
między sąsiadami `navigationMaxRiseM` (0,35; estakada 0,52); ostatnie dwa pola są
wymagane (brak = wyjątek). Algorytm: środki komórek `(i+0,5)·cell` na każdym bloku
`walkable`; komórka jest wolna, gdy w środku i w czterech punktach oddalonych o
margines w osiach istnieje powierzchnia o wysokości różnej ≤ wznios, i żaden blok
nie zajmuje pasa `(y, y+prześwit)` w promieniu marginesu. Sąsiedzi: 4 kierunki
(−x, +x, −z, +z), różnica wysokości ≤ wznios. Pole odległości to BFS z kosztem 1
od celu; krok to pierwszy sąsiad o polu o 1 mniejszym (kolejność kierunków jak
wyżej), a `next` skraca trasę do najdalszego punktu prostego odcinka, którego
próbki co pół komórki leżą na spójnych komórkach (bez skoków między dachami).
Dozwolone obroty powierzchni: wokół X albo wokół Z (rampa), nigdy oba naraz i
nigdy wokół Y (wyjątek przy budowie siatki); obrót Y wolno mieć tylko na
niechodzonych rekwizytach (obwiednia). Połączenie różnych powierzchni rampy istnieje
wyłącznie na końcach, więc wróg nie próbuje wejść przez boczny próg.
Przeszkody nad ulicą nie blokują przejścia pod estakadą. Skracanie trasy
sprawdza wysokość oraz kolejne połączenia, bez skrótów między dachami.

AI wybiera szerokie rampy: wąskie kładki o przejściu 1,378 m nie mieszczą
pełnego marginesu nawigacji 0,8 m i służą graczowi. Wszystkie punkty są
osiągalne bez nich. Walidacja trybu wymaga wolnego koła na wysokości punktu
oraz drogi od gracza i każdego spawnu do wszystkich punktów. Posiłki zachowują wspólny
minimalny odstęp 15 m, który pierścień areny może zwiększyć, i odstęp od innych wrogów.

## Szturm i Kradzież rdzenia na dużych arenach

ADR 0011 D4: oba tryby mają układ w danych areny (`arena.assault`, `arena.heist`),
obok punktów Przejęcia. Lista aren trybu to `arenas` w `assault.json` / `heist.json`;
`roomId` (`combatCorridor`, `combatRing`) zostaje trybem na małym pokoju.
Wybór areny, kształt danych i API: [modes.md](modes.md#szturm-i-kradzież-rdzenia-na-dużych-arenach).

| Tryb             | Areny                                                         |
| ---------------- | ------------------------------------------------------------- |
| Szturm           | `arenaRailYard`, `arenaConstructionSite`, `arenaFloodedDocks` |
| Kradzież rdzenia | `arenaContainerPort`, `arenaPowerPlant`, `arenaRooftops`      |
| Przejęcie        | wszystkie siedem aren z `conquest.json`                       |

Układy są w generatorach `tools/arenas/<id>.mjs` (`arena.arenaMeta({ assault })` lub
`{ heist }`) i w wygenerowanych JSON-ach; `node tools/arenas/build.mjs <id>`
odtwarza je deterministycznie. Pozycje są wzięte z puli spawnów i punktów areny
(wolne koła, osiągalne nawigacją). Wszystkie trzy areny Szturmu mają po 3 sektory,
żeby HUD „Sektor n/3” i istniejące scenariusze e2e pozostały spójne.

### Szturm

| Arena                   | Sektor | Start gracza (X; Z) | Stacja A        | Stacja B        |
| ----------------------- | ------ | ------------------- | --------------- | --------------- |
| `arenaRailYard`         | 1      | (-162; 46)          | (-100; 80)      | (-44; 80)       |
| `arenaRailYard`         | 2      | (12; 80)            | (20; 50; y 1.1) | (38; -24)       |
| `arenaRailYard`         | 3      | (68; 80)            | (120; -40)      | (170; 40)       |
| `arenaConstructionSite` | 1      | (-100; 100)         | (-34; 112)      | (62; 96)        |
| `arenaConstructionSite` | 2      | (-90; 44; y -8)     | (-60; 20; y -8) | (-28; 48; y -8) |
| `arenaConstructionSite` | 3      | (-4; -66)           | (40; -25; y 8)  | (-50; -75)      |
| `arenaFloodedDocks`     | 1      | (-140; 130)         | (-80; 80)       | (-40; 65)       |
| `arenaFloodedDocks`     | 2      | (-40; 65)           | (0; 0; y -1.2)  | (-63; -14)      |
| `arenaFloodedDocks`     | 3      | (-63; -14)          | (-78; -77)      | (-24; -116)     |

Respawn gracza po śmierci jest na starcie aktywnego sektora. Posiłki trafiają
do pierścienia `arena.spawnRing` wokół gracza, z puli sektora i puli areny,
najbliżej niezniszczonych stacji.

### Kradzież rdzenia

| Arena                | Start i odrodzenie (X; Z) | Baza       | Ewakuacja  | Droga baza → ewakuacja |
| -------------------- | ------------------------- | ---------- | ---------- | ---------------------- |
| `arenaContainerPort` | (41; -31)                 | (113; 59)  | (46; -31)  | ok. 157 m              |
| `arenaPowerPlant`    | (30; -26.5)               | (-120; 15) | (25; -25)  | ok. 184 m              |
| `arenaRooftops`      | (115; -21.5)              | (0; 32)    | (110; -20) | ok. 163 m              |

Gracz startuje i odradza się przy ewakuacji (`playerSpawn`, ok. 5–6 m od strefy).
Baza i ewakuacja leżą 120–200 m drogi od siebie, a po zablokowaniu środka trasy
istnieje droga objazdowa (test `arenaModes.test.ts`). Posiłki idą w pierścieniu
wokół gracza, najbliżej rdzenia (bazy, nosiciela albo miejsca upuszczenia).
Strefy bazy i ewakuacji mają tolerancję wysokości `tuning.modes.heist.zoneHeightM`,
więc rdzenia nie da się podnieść ani ewakuować z piętra pod lub nad strefą.

Sprawdzenie w 30 s: `?scene=run&mode=assault&arena=arenaRailYard&debug=1` (`god`,
`assault destroy A`, `assault destroy B` w każdym sektorze) oraz
`?scene=run&mode=heist&arena=arenaPowerPlant&debug=1` (`god`, `tp -120 15`
podnosi rdzeń, `tp 25 -25` i 3 s w strefie kończą próbę).

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

| Pomiar                                                |         Wynik |
| ----------------------------------------------------- | ------------: |
| Statyczne siatki przed i po scalaniu, rzeczywiste GLB | 6 681 → 2 929 |
| Partie instancji                                      |          1090 |
| Nawigacja z pięcioma polami                           |      47,77 ms |
| 12 wrogów w hoście Przejęcia, średnia z 600 kroków    | 0,418 ms/krok |

Sortowanie przeszkód nawigacji według komórek ogranicza przygotowanie
siatki do sprawdzania brył w sąsiedztwie próbki.

Ten sam pomiar aren (rzeczywiste GLB, komórki z danych: Estakada 180 m,
Dachy 200 m; jedno końcowe scalanie świata):

| Arena                                         | Siatki przed | Siatki po | Partie InstancedMesh |
| --------------------------------------------- | -----------: | --------: | -------------------: |
| Estakada                                      |         3740 |       796 |                  504 |
| Dachy (300×260, komórki 200 m, bez instancji) |        23319 |       194 |                    0 |

`arenaPerf.test.ts` obejmuje prawdziwy host Przejęcia, nawigację i Rapiera.
Estakada sprawdza 12 wrogów (8 szturmowców, 4 strzelców), limit 2 ms/krok.
Dachy mają test przeciążeniowy 30 wrogów, limit 6 ms/krok.
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

Komendy dla Terminalu kontenerowego są w sekcji tej areny.

Estakadę i komendy do jej poziomów opisano w sekcji „Estakada w smogu”.
Dachy (dawny „Targ”): `?scene=conquest&arena=arenaRooftops&debug=1`. Wpisz `god`, przejdź A–B–C
bez skoków, potem schody/kładki targu. Sprawdź `room`,
`weather` i `conquest` przez query; profil powinien wynosić odpowiednio
`smog` i `drizzleWind`. Oceń czytelność wrogów w pyle i mżawce, drogi posiłków
na B/C, osłony, śliską wizualnie papę i zabezpieczenie zewnętrznych krawędzi.
Galeria: `?scene=city-props-test&view=4` (estakada), `&view=5` (targ).

Dachy — `tp <x> <z> <yaw> <pitch> <podłoga>` (piąty argument to wysokość podłogi):
`tp -140 120 -45 0 0` start i obozowisko, `tp 0 -8 90 0 -14` ulica i targ C,
`tp 45 40 120 0 0` nocny targ A, `tp -85 -60 27 5 8` wieża zegarowa i B,
`tp 95 -55 30 0 12` szyld i E, `tp -60 88 0 0 -14` podwórze D,
`tp -41 14 180 0 -14` pasaż, `tp -66 -54 0 10 -14` wejście Klatki Zegarowej,
`tp -48 -2 0 25 -14` schody pożarowe, `tp 20 13 -90 0 -13.85` Schody Targowe,
`tp -32 -16 180 0 0` most z desek nad ulicą. Sprawdź wejście po klatce na dach,
mżawkę na ulicy (pada do dna), plamy świateł na właściwych poziomach,
wroga schodzącego ze schodów i czytelność czerwieni na tle neonów.
Testy traversal/enemies/staticBatch obejmują wszystkie duże areny
(dachy: kapsuła do A–E, Schody Targowe, most, kładka, schody pożarowe i dachowe;
oba archetypy z pięciu spawnów na różnych poziomach do A–E);
e2e startu nowych aren jest napisany, bez uruchamiania w sandboxie.

Galeria `?scene=city-props-test&view=3` pokazuje materiały portu.
`arenaStaticBatch.test.ts` porównuje obwiednie samodzielnych kontenerów
z colliderami i sprawdza ładowanie modeli bez nierozpoznanych materiałów.

## Elektrownia

`arenaPowerPlant` ma obwiednię 380 × 300 m (X −190…190, Z −150…150).
Woda od Z 115 oddziela nabrzeże od obrysu hałd. Północ zamyka ogrodzenie z zatoką rozładunkową 46 × 22 m (X −118…−72).
Od wschodu teren zamyka nasyp bocznicy, a od zachodu mur serwisowy. Za granicami są niekolizyjne
słupy WN, przewody, zwałowiska i wieża ujęcia. Silnik domyka tło gruntem
zewnętrznym i panoramą. Pogoda `ashfall` daje bursztynową łunę. Reflektory
ciepłej bieli oświetlają przejścia, zielone lampy wskazują sprawne urządzenia,
a bursztynowe światło podkreśla chłodnie, komin i węzły rurociągów.
108 źródeł współdzieli istniejącą pulę aktywnych świateł.

| Punkt | X / Y / Z (m)  | Strefa i drogi                                                                                                                                                 |
| ----- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | −120 / 0 / 15  | Wnętrze chłodni. Wyrwa prowadzi na wschód, między gruzem i wiązkami rur. Rampa przez kołnierz 0,8 m prowadzi do płytkiej niecki na poziomie posadzki.          |
| B     | 25 / 0 / −25   | Hala 90 × 40 × 18 m, z bramami N/S i drzwiami E/W. Trzy turbiny mają połączone pomosty na 6 m. Schody na obu końcach prowadzą na antresolę sterowni na 8 m.    |
| C     | 130 / 0 / −65  | Rozdzielnia. Siatka transformatorów, bramownice i niskie ogrodzenia z przerwami. Dwa pola elektryczne można obejść od północy lub południa.                    |
| D     | 120 / 0 / 80   | Skład między pięcioma hałdami na 7 m i zasiekami. Pod przenośnikiem biegnie droga na wschód, do wagonów przy dwóch torach.                                     |
| E     | −60 / −3 / 100 | Nabrzeże ujęcia. Wejście szeroką rampą lub schodami od wschodu i rampą od zachodu. Przepompownia ma dwa wejścia. Kładka do wieży w kanale jest częścią oprawy. |

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

W hali turbin dwa rzędy opraw pod dachem dają ciepłe białe światło.
Trzy turbiny mają osobne białe źródła i zielone lampki stanu. Bursztynowe
oprawy wskazują antresolę. Posadzka `turbine_hall_floor` ma przygaszony
szarozielony odcień. Na nabrzeżu użyto ciemnej odmiany betonu nabrzeżowego,
a przy starcie krawężniki mają fakturę surowego betonu. Przepompownia
i kotłownia korzystają z jednej płyty posadzki zamiast dwóch powierzchni
na tej samej wysokości. Oba wnętrza, pięć budynków serwisowych i dostępna
chłodnia mają lokalne oświetlenie. Elektrownia wyłącza addytywne plamy
przy podłodze, które przy dużej liczbie źródeł nakładały się na posadzkę.
Światła punktowe nadal używają istniejącej puli.

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
52 → 79 świateł. Po korekcie oświetlenia arena ma 1307 bloków i 108 świateł. Najczęstszy model to rura `city_pipe_run`
(19 z 197, 9,6%). Największy kwadrat bez osłon poza rozdzielnią ma około
43 × 43 m (X 89–132, Z 62–105). Szacunek używa rastra 1 m na poziomach
0 i −3 m, rzutów colliderów osłon o wysokości co najmniej 1 m oraz
największego kwadratu wspartego na płaskim gruncie. Właściwy odstęp osłon
wzdłuż trasy zależy od kierunku ruchu i skarp.
Pomiar w Node na docelowej geometrii:

| Pomiar                                                |       Wynik | Budżet lub zakres               |
| ----------------------------------------------------- | ----------: | ------------------------------- |
| Budowa siatki i pięciu pól                            |   133,60 ms | ≤ 500 ms                        |
| Krok `RoomScene`, 12 wrogów, 600 kroków po rozgrzewce |    0,796 ms | ≤ 2 ms                          |
| Rzeczywiste GLB, statyczne siatki przed → po scaleniu | 3780 → 1270 | 90 partii instancji po scaleniu |

Nawigacja zawęża test prześwitu i podparcia do pobliskich brył według
indeksu przestrzennego. Używa tej samej obwiedni i tych samych reguł
łączenia komórek. Test kapsuły sprawdza A–E ze startu oraz ze spawnów
rozdzielni i nabrzeża. Pokrywa także estakady na 6,2 m, dach kotłowni i
stok hałdy. Test posiłków prowadzi oba archetypy fizycznie po Rapierze
z sześciu spawnów do wszystkich pięciu punktów.

Sprawdzenie w 30 sekund: `?scene=conquest&arena=arenaPowerPlant&debug=1`.
Wpisz `god`, a potem w konsoli debug użyj po kolei:

| Polecenie        | Widok                                         |
| ---------------- | --------------------------------------------- |
| `tp -120 15 -90` | Wnętrze A i wyrwa na wschód                   |
| `tp 25 -25 180`  | Turbiny B i pomosty                           |
| `tp 33 -108 0`   | Parter kotłowni; schody po wschodniej stronie |
| `tp 130 -65 0`   | Rozdzielnia C                                 |
| `tp 120 80 -90`  | Hałdy D, przenośnik i bocznica                |
| `tp -60 100 180` | Spadek na nabrzeże E i widok kanału           |

Przy `tp` wysokość pozostaje bieżąca do następnego kroku fizyki. Na E
gracz opadnie z poziomu placu. Na wyższe podesty wejdź schodami. Z E
na plac wróć rampą przy (40, 96).

Do oceny w grze: rytm osłon w przejściach między strefami, czytelność
czerwonych wrogów w popiele, sygnał pól elektrycznych, tempo pierwszych
posiłków oraz wygoda wymijania na wąskich trasach. Sprawdź sylwetkę komina
i widok poza ogrodzeniem z dachu kotłowni. GPU i czas wczytania wymagają
pomiaru w przeglądarce w trybie medium, szczególnie przy spojrzeniu z dachu
w stronę pozostałych stref.
