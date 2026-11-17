# ADR 0011: Duże, zróżnicowane areny

Status: przyjęty (2026-11-18, właściciel + manager)
Zastępuje skalę opisaną w `docs/systems/arenas.md` (areny ~100×100 m).

## Kontekst

Właściciel ocenił obecne areny Przejęcia (port, estakada, targ, ok. 100×100 m)
jako „kupę filarów na kwadracie”: za małe, płaskie w obrysie, powtarzalne.
Areny mają być naprawdę duże i bardzo zróżnicowane, z różną pogodą, modelami
z Blendera i teksturami z Codexa. Silnik ma przy tym stałe ograniczenia
pod mapy ~100 m: kamera ucina geometrię na 220 m (`src/main.ts`),
a panorama miasta (`src/render/skyline.ts`) stawia pierścienie budynków
w promieniu 66–162 m od środka świata, więc na większej mapie wchodzi
w teren gry, a horyzont się urywa.

## Decyzje

### D1. Skala i obrys
- Duża arena ma 240–450 m w najdłuższym wymiarze i co najmniej 40 000 m²
  powierzchni, po której da się chodzić (łącznie z poziomami).
- Obrys nie jest kwadratem: kształt L, wydłużony, nieregularny, z wcięciami.
- Granice są naturalne: ściany budynków, woda, nasyp, ogrodzenie, krawędź dachu.
  Niewidoczna kolizja jest tylko zabezpieczeniem za naturalną granicą.
- Za granicą stoi oprawa (zewnętrzne budynki, woda, ulice) bez kolizji,
  która przechodzi w panoramę bez widocznej krawędzi świata.

### D2. Zróżnicowanie (każda duża arena)
- 4–6 stref o wyraźnie różnym charakterze: otwarta, gęsta (zaułki, labirynt),
  wnętrze (hala, parter budynku), wysoka (dachy, pomosty), niska (wykop, kanał,
  przejście pod ziemią). Każda strefa ma własny zestaw rekwizytów i materiałów.
- Co najmniej 3 poziomy wysokości połączone rampami, schodami i kładkami,
  także trasy do flankowania.
- Co najmniej 2 punkty orientacyjne (landmarki) widoczne z większości mapy.
- Osłony to architektura i rekwizyty, nie wolnostojące słupy. Filar stoi
  tylko tam, gdzie coś podpiera. Żaden pojedynczy rekwizyt nie przekracza
  ok. 15% wszystkich ustawionych instancji.
- Linie widoku w strefach walki przerywane co ok. 40–80 m; długie osie
  widokowe tylko w strefach otwartych.
- Każda arena ma własną tożsamość kolorystyczną w palecie Neon Noir
  (ADR 0006): bursztyn, zieleń, fiolet, błękit, ciepła biel. Czerwień, cyan
  i magenta są nadal zakazane w otoczeniu.

### D3. Horyzont i zasięg widzenia
- Płaszczyzna odcięcia kamery, mgła, panorama i kopuła nieba są liczone
  z obwiedni bieżącej areny (środek i promień), nie ze stałych liczb.
  Parametry w `tuning.ts` (sekcja widoczna w lil-gui).
- Pierścienie panoramy zaczynają się za obwiedną areny z zapasem; kopuła
  nieba i najdalszy pierścień mieszczą się przed płaszczyzną odcięcia.
- Mgła profilu pogody zasłania geometrię, zanim utnie ją płaszczyzna odcięcia.
  Profil może mieć dalszy zasięg widzenia (clearNight), ale nie może odsłonić
  końca świata.
- Grunt zewnętrzny (woda, ulica, dachy) sięga do pierwszego pierścienia
  panoramy. Z żadnego miejsca areny nie widać krawędzi płyty ani pustki.
- Sprawdzenie: scena `?scene=horizonTest` z płaską areną 600×600 m
  i przełączaniem pogody.

### D4. Tryby na dużych arenach
- Przejęcie: 3–5 punktów (A–E) z danych areny. `maxAlive` z danych areny
  (do 12). Zwycięstwo i ubytek biletów skalują się z liczbą punktów.
- Posiłki: pula co najmniej 16 punktów pojawiania się rozsianych po mapie.
  Wybór w pierścieniu odległości od gracza (min–max z danych areny),
  z pierwszeństwem dla punktów bliskich spornej strefie i poza linią wzroku
  gracza, jeśli taki istnieje. Wróg nie pojawia się na drugim końcu mapy.
- `combatRing` wypada z listy aren Przejęcia; zostaje w zwykłym runie.
- Kradzież rdzenia i Szturm przechodzą na duże areny w kolejnej fazie
  (układy trybu w danych areny); do tego czasu korzystają z obecnych pokojów.

### D5. Autorstwo
- Każda duża arena ma generator `tools/arenas/<id>.mjs` na wspólnej
  bibliotece `tools/arenas/lib/` (prymitywy: ulica, budynek z wnętrzem, hala,
  rampa, schody, kładka, stos kontenerów, ogrodzenie, nabrzeże, wykop).
  Wynik to JSON w `src/data/rooms/<id>.json`, commitowany i walidowany zod.
  Generator jest deterministyczny (stały seed).
- Pliki aren pozostają w formacie pokoju (`roomSchema`), żeby działały
  istniejące loadery, kolizje, scalanie statyki i nawigacja.

### D6. Pogoda
- Do pięciu profili dochodzą `snow` (śnieg nocą, wolne płatki, przyprószone
  powierzchnie) i `ashfall` (opad popiołu, ciepła łuna przemysłowa).
  Rodzaje opadu `snow` i `ash` w `weatherSchema`.

### D7. Modele i tekstury
- Modele: Blender, proceduralnie, tylko podagent Opus albo gpt-6-astra high.
  Nowe zestawy w osobnych skryptach `tools/blender/sets/<zestaw>.py`
  (importują pomocnicze funkcje z `build_assets.py`), żeby równoległe zestawy
  nie kolidowały w jednym pliku.
- Tekstury: Codex (imagegen) w istniejącym potoku `tools/textures`.
  Materiały mają nazwy semantyczne (np. `ship_hull_paint`), żeby pakiet
  „komiks” z gałęzi `tekstury-komiks` dało się później podmienić mapą nazw.

### D8. Wydajność
- Statyka scalana w komórkach (`batchCellM`), powtarzalne rekwizyty jako
  `InstancedMesh`, statyczne collidery Rapier.
- Budżety: symulacja ≤ 2 ms/krok z 12 wrogami; budowa nawigacji ≤ 500 ms;
  wywołania rysowania ≤ 800 w najgorszym widoku przy jakości medium;
  wczytanie areny ≤ 5 s na komputerze deweloperskim.

### D9. Współistnienie z otwartymi gałęziami
- `styl-borderlands`: nie zmieniamy `outline.ts`, `themes.ts`,
  `themeSchema.ts`, `lookPresets.ts` poza niezbędnym ustawianiem uniformów.
- `warsztat-broni`: zmiany w `src/scenes/roomScene.ts` minimalne,
  logika aren w osobnych modułach.
- `tekstury-komiks`: nie podpinamy pakietu; zachowujemy mapowalne nazwy.

## Lista aren

| Id | Nazwa | Wymiar (m) | Pogoda | Strefy i landmarki |
|---|---|---|---|---|
| `arenaContainerPort` | Terminal kontenerowy (przebudowa) | 340×220 | storm | labirynt stosów 1–4 warstwy; nabrzeże z zacumowanym kontenerowcem (pokład ~12 m, nadbudówka, ładownie jako wnętrza, trapy); hala przeładunkowa z antresolą; bocznica z wagonami; brama terminalu. Landmarki: kontenerowiec, suwnice nabrzeżowe ~50 m |
| `arenaOverpass` | Węzeł Estakada (przebudowa) | 360×360 | smog | trzy poziomy jezdni (0 / 11,6 / 23,2 m) i łukowe zjazdy; stacja paliw; bramki poboru opłat; obozowisko pod estakadą; urwany, niedokończony wiadukt; kanał burzowy −4 m. Landmarki: urwany wiadukt, wieża wentylacyjna tunelu |
| `arenaRooftops` | Dachy Starego Miasta (przebudowa) | 300×260 | drizzleWind | ulica na dnie (−14 m) z zaułkami i targiem; kamienice o dachach na kilku wysokościach; klatki schodowe i schody pożarowe; kładki; nocny targ na największym dachu. Landmarki: wieża zegarowa, gigantyczny szyld |
| `arenaFloodedDocks` | Zalane Doki (nowa) | 300×280 | rain | kanały i płycizny do brodzenia; pomosty i mosty; pół-zatopione kamienice z dostępnym parterem; barka-targ; śluza. Landmark: przepompownia z rurami |
| `arenaRailYard` | Zajezdnia Maglev (nowa) | 420×180 | snow | wiele torów ze składami (przejście przez otwarte wagony, dachy wagonów); hala serwisowa z kanałami rewizyjnymi; kładka nad torami; peron z wiatą; obrotnica. Landmarki: nastawnia, suwnica torowa |
| `arenaConstructionSite` | Budowa wieżowca (nowa) | 240×240, do 30 m w górę | clearNight | wykop −8 m z rampą; szkielet wieżowca (stropy co 4 m, trzony schodowe, rusztowania); plac składowy; zaplecze z kontenerów biurowych. Landmark: żuraw wieżowy ~60 m |
| `arenaPowerPlant` | Elektrownia (nowa) | 380×300 | ashfall | dwie chłodnie kominowe (wnętrze jednej dostępne przez wyrwę); hala turbin z suwnicą; rozdzielnia z transformatorami; estakady rurociągów na 6 m; hałdy żużlu. Landmark: komin ~120 m |

Kolejność: silnik dużych map, potem port, budowa i zajezdnia, potem
estakada, dachy, doki i elektrownia.

## Konsekwencje

- Duże areny wymagają ręcznej oceny widoku i „feel” (odległości, tempo
  posiłków, czytelność wrogów w pogodzie). Każda arena ma zrzuty przeglądowe
  i sprawdzenie w 30 sekund w `docs/systems/arenas.md`.
- Testy jednostkowe walidacji trybu, przejścia kapsuły i dojścia wrogów
  obejmują wszystkie duże areny.
- Zwykły run i misje liniowe zachowują dotychczasowe pokoje i poziomy;
  zmiany horyzontu działają też tam, bo liczą się z obwiedni sceny.
