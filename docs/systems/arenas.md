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
Testy traversal/enemies/staticBatch obejmują wszystkie cztery duże areny;
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

| Pomiar | Wynik | Budżet lub zakres |
| --- | ---: | --- |
| Budowa siatki i pięciu pól | 133,60 ms | ≤ 500 ms |
| Krok `RoomScene`, 12 wrogów, 600 kroków po rozgrzewce | 0,796 ms | ≤ 2 ms |
| Rzeczywiste GLB, statyczne siatki przed → po scaleniu | 3780 → 1270 | 90 partii instancji po scaleniu |

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
