# NEORYDER — audyt danych map

Audyt obejmuje 33 pokoje z `src/data/rooms`, klasyczną arenę, 10 poziomów liniowych i kryjówkę. Każdy wiersz szczegółowy wskazuje ścieżkę w źródłowym JSON i punkt w metrach świata (X, Y, Z). Dla rozpiętego przewodu jest to pierwszy koniec bez mocowania. Jednemu obiektowi może odpowiadać kilka znalezisk.

## Od czego zacząć oględziny

| Mapa | Ustalenie sprawdzone w danych | Co obejrzeć |
| --- | --- | --- |
| `bossRoom` | Wszystkie sześć końców kabli styka się z fasadami na X = ±16 m. Pod galeriami stoją dwie zniszczalne skrzynie. Prosta od bossa do wejścia jest wolna. | Ze spawnu sprawdzić sylwetkę bossa na tle logo. Po walce podejść do terminala na północy i bursztynowej wnęki windy po lewej. |
| `arena` | Podłoga w `blocks[0]` ma **40 × 40 m**. Układ korzysta z domyślnego motywu `white`. Brak wpisów `lights`, `decor` i `signs` daje trzy ostrzeżenia. | Ze spawnu sprawdzić czytelność filarów i niskich osłon w świetle bazowym motywu. |
| `puzzlePlate` | Pokój ma motyw `neonStreet` i trzy puste warstwy oprawy. Płyta i obiekt Chwytu należą do osobnej definicji zagadki. | Ze spawnu ocenić widoczność płyty, przedmiotu i drzwi wyjściowych. |
| `puzzleLaser` | Ten sam zestaw trzech braków oprawy. Bramka laserowa pochodzi z `hazards`, a obiekt zagadki z `puzzle`. | Zestawić ze spawnem `puzzlePlate`. Sprawdzić widoczność bramki na tle ścian. |
| `combatRing` | Oba kable `decor[0..1]` kończą się przy X bliskim ±13,5 m na wysokości ok. 8 m. Pod nimi stoją ściany wysokie na 4 m. | Sprawdzić oba prześwity między końcówkami a fasadami. |
| `combatFloodedTunnel` | Na dnie kanału `blocks[4]` (−1,2 m) stoją **dwa wraki i trzy łodzie** w `decor[2..6]`. Modele są duże, a w ich podstawach brakuje koliderów. Pompownia i śluza mają osobne bryły z `visible: false`. | Obejrzeć dojście po rampie i przejście przy burcie. Na zdjęciach można ocenić skalę, a przechodzenie przez model wymaga sprawdzenia podczas gry. |
| `alleyCrossing` | Generator umieszcza klimatyzatory 0,35 m od elewacji, a część schodów i markiz 0,6 m od lica. Tolerancja montażu eliminuje te powtarzalne alarmy. | Sprawdzić latarnie `decor[51..52]` nad obniżeniem oraz szyldy `signs[10..11]` przy tarasie. |

## Jak czytać wynik

- **Pewne w danych** są puste kolekcje, współrzędne powtórzonych wpisów i wynik obliczenia odcienia. `emptyRoom` liczy osobno każdy brak. Motyw może nadal zapewniać światło ogólne. W kryjówce neonowy tekst oraz szyld stacji liczą się jako oznakowanie.
- **Kolizja** opiera się na bryłach Rapiera z `blocks`, drzwi i zamkniętych bram. Rekwizyty zniszczalne zachowują bryłę. `props` pokoju mogą być markerami, a `focus` rekwizytu kryjówki jest strefą interakcji. Typowe `decor`, szyldy, naklejki i światła punktowe należą do renderu. Wywracalne worki i pachołki mają specjalną obsługę fizyki odłamków.
- **Brak kolizji dużego modelu** jest sygnałem do testu ruchu. Szukamy modelu wyższego niż 0,6 m, z oboma wymiarami podstawy ponad 0,5 m, na podłodze lub platformie. Uwzględniamy osobne kolidery, również niewidoczne. Na arenach z oznaczonymi powierzchniami korzystamy z `walkable`. W starszych układach dostępność szacujemy z położenia podłóg, ścian i bloków. Zasięg skoku i osiągalność całej trasy wymagają próby w grze.
- **Montaż, granice i przenikanie** są heurystyczne. Obrócone obwiednie uwzględniają lokalny początek GLB, skalę i yaw. Test zaczepienia dopuszcza 0,18 m przy podłożu, 0,32 m przy końcu przewodu i 0,65 m dla instalacji elewacyjnych. Obwiednia może obejmować powietrze pod dźwigiem lub w otworze drzwiowym. Głębokie przenikanie jest kandydatem do oględzin. Obiekty podparte przez fasadę mogą należeć do zamierzonego tła.
- **Kolor** sprawdzamy w zapisach światła, szyldu, wody, emisji i materiału oraz w palecie materiałów użytych przez modele. Porównujemy odcień HSV z barwami ADR 0006 z tolerancją 13°, przy nasyceniu co najmniej 55% i jasności co najmniej 50%. Barwę widoczną po teksturowaniu, mgle i bloomie należy ocenić na zrzucie. Rozrzut drobnych obiektów pozostaje oceną kompozycji podczas oględzin.

Obrys podłogi obejmuje płaty połączone ze spawnem w rzucie XZ. Fizyczne ramy szyldów neonowych podlegają kontroli mocowania. Hologram ma w rendererze własny stożek projekcji i podlega kontroli położenia oraz koloru.

## Odtworzenie

`node tools/levels/mapModelBounds.mjs` odtwarza `src/data/render/mapModelBounds.json` z miejskich GLB. Skrypt mierzy wierzchołki po transformacjach węzłów, zapisuje lokalne minimum i maksimum, skrajne punkty przewodów oraz nazwy materiałów odczytywane przez renderer. Rozmiar kolidera bloku pochodzi z JSON mapy.

`node tools/levels/mapAudit.mjs bossRoom combatRing` wypisuje zgłoszenia wybranych map. `--json` pozwala pobrać pełny zbiór programowo. `node tools/levels/mapAudit.mjs --report` odświeża poniższe wyniki. Limit testu dotyczy liczby `error` każdej mapy z osobna.

**Zrzuty dla osoby weryfikującej** powstają poleceniem `node tools/screens/mapAudit.mjs bossRoom --tag before`. Po zmianach uruchomić `node tools/screens/mapAudit.mjs bossRoom --tag after`. Katalog docelowy można wskazać przez `--out`. Porównać odpowiadające sobie PNG w `artifacts/maps/bossRoom/before` i `after`. Powinno być po 10 obrazów 1280 × 720, bez HUD i rąk gracza, ze spawnem, czterema kierunkami, dwoma narożnikami, dwoma ujęciami pod kątem 35° i rzutem z góry. Dla areny, zagadek, misji i kryjówki podać ich id w tym samym poleceniu. Vite uruchamia się i kończy razem ze skryptem. Zrzuty i test e2e wymagają działającego Chromium.

## Zmienione pliki narzędzi, testów i dokumentacji

| Część | Pliki |
| --- | --- |
| Reguły i dane pomiarowe | `src/world/mapAudit.ts`, `src/world/mapAuditGeometry.ts`, `src/data/render/mapModelBounds.json`, `tools/levels/mapModelBounds.mjs` |
| Katalog, CLI i baza | `tools/levels/mapAuditCatalog.ts`, `tools/levels/mapAudit.mjs`, `tests/unit/mapAudit.test.ts`, `tests/unit/mapAudit.baseline.json` |
| Kamera i zrzuty | `src/scenes/mapAuditScene.ts`, `src/scenes/index.ts`, `src/scenes/arena.ts`, `src/scenes/hub.ts`, `src/scenes/mission.ts`, `tools/screens/mapAudit.mjs`, `tests/e2e/mapAudit.spec.ts` |
| Seed z tablicy misji | `src/ui/hub/missionsPanel.ts`, `tests/unit/missionsPanel.test.ts`, `tests/e2e/conquest.spec.ts` |
| Dokumentacja | `docs/api.md`, `docs/systems/rooms.md`, `docs/systems/modes.md`, `docs/audits/mapAudit-report.md` |

<!-- mapAudit:generated -->

## Wyniki według mapy

| Mapa | error | warn |
| --- | ---: | ---: |
| alleyBackstreet | 3 | 1 |
| alleyCrossing | 0 | 5 |
| alleyMarket | 0 | 18 |
| alleyUnderpass | 1 | 3 |
| alleyUnderpassMission | 0 | 2 |
| arena | 0 | 0 |
| arenaConstructionSite | 1 | 60 |
| arenaContainerPort | 39 | 90 |
| arenaFloodedDocks | 4 | 19 |
| arenaOverpass | 6 | 67 |
| arenaPowerPlant | 16 | 45 |
| arenaRailYard | 14 | 209 |
| arenaRooftops | 9 | 51 |
| bossRoom | 0 | 0 |
| combatCorridor | 15 | 10 |
| combatFloodedTunnel | 12 | 10 |
| combatLaserYard | 4 | 10 |
| combatPillars | 0 | 9 |
| combatPlatforms | 13 | 0 |
| combatRing | 0 | 2 |
| combatSubstation | 3 | 25 |
| combatWarehouse | 0 | 10 |
| combatYard | 0 | 6 |
| eliteChemPlant | 0 | 23 |
| eliteCourtyard | 0 | 27 |
| eliteFoundry | 0 | 37 |
| eliteHall | 7 | 29 |
| hideout | 3 | 0 |
| m01-maszty | 1 | 4 |
| m02-punkt-kontrolny | 3 | 0 |
| m03-list-przewozowy | 0 | 10 |
| m04-ladunek-klasy-k | 34 | 11 |
| m05-adiutant | 0 | 17 |
| m06-odlewnia | 0 | 2 |
| m07-nocny-dyzur | 4 | 9 |
| m08-kwarantanna | 0 | 6 |
| m09-brat | 13 | 3 |
| m10-archiwum | 3 | 28 |
| noodleShop | 0 | 1 |
| plazaHolo | 0 | 84 |
| puzzleLaser | 0 | 3 |
| puzzlePlate | 0 | 3 |
| restRoom | 0 | 0 |
| rooftopRest | 2 | 6 |
| shopRoom | 0 | 1 |

### alleyBackstreet

- error · noCollisionLargeProp · `decor[51]` · (32, 6.4, 14) · city_roof_hvac_unit: duży model na powierzchni blocks[24], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[52]` · (20, 6.4, 18) · city_antenna: duży model na powierzchni blocks[24], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[53]` · (-13, 3.2, -12) · city_antenna: duży model na powierzchni blocks[26], bez kolidera przy podstawie.
- warn · overlap · `decor[57]` · (30, 0, 34) · city_street_lamp: wnikanie obwiedni z blocks[34].

### alleyCrossing

- warn · floatingObject · `decor[51]` · (-12, 0, -3) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[52]` · (12, 0, 3) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · overlap · `decor[54]` · (0, 0, -14) · city_street_lamp: wnikanie obwiedni z blocks[55].
- warn · floatingObject · `signs[10]` · (25.85, 4.6, 13) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[11]` · (38, 4.6, 5.85) · Brak konstrukcji przy płaszczyźnie szyldu.

### alleyMarket

- warn · floatingObject · `decor[31]` · (-46, 4.46, 0.08) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · overlap · `decor[31]` · (-41, 4.6, 0) · city_lantern_string: wnikanie obwiedni z blocks[36].
- warn · floatingObject · `decor[32]` · (-26, 4.46, 0.08) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · floatingObject · `decor[33]` · (-26, 4.46, 0.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[34]` · (-16, 4.46, 0.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[35]` · (-6, 4.46, 0.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[36]` · (4, 4.46, 0.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[37]` · (14, 4.46, 0.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[38]` · (24, 4.46, 0.08) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · floatingObject · `decor[39]` · (-33, 4.06, -3.92) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · overlap · `decor[39]` · (-38, 4.2, -4) · city_lantern_string: wnikanie obwiedni z blocks[36].
- warn · floatingObject · `decor[40]` · (-10, 4.06, -3.92) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[41]` · (23, 4.06, -3.92) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[42]` · (-33, 4.06, 4.08) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · overlap · `decor[42]` · (-38, 4.2, 4) · city_lantern_string: wnikanie obwiedni z blocks[36].
- warn · floatingObject · `decor[43]` · (-10, 4.06, 4.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[44]` · (23, 4.06, 4.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · overlap · `decor[52]` · (-30, 0, -28) · city_street_lamp: wnikanie obwiedni z blocks[38].

### alleyUnderpass

- error · overlap · `decor[34]` · (-33.7, 0, 0) · city_pipe_run: powtórzona bryła z decor[18].
- warn · overlap · `decor[61]` · (-1.5, 0, -59.8) · city_shutter: wnikanie obwiedni z decor[25].
- warn · floatingObject · `decor[90]` · (-6, 0, -17) · city_vent_grate: brak styku z podłożem lub konstrukcją.
- warn · overlap · `decor[94]` · (26, 0, 40) · city_street_lamp: wnikanie obwiedni z blocks[72].

### alleyUnderpassMission

- warn · floatingObject · `decor[3]` · (-4, 5.55, -9.35) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[6]` · (-7.5, 6.29, -13.88) · city_lantern_string: bez zaczepienia 2/2 końców.

### arena

Brak zgłoszeń.

### arenaConstructionSite

- warn · overlap · `decor[41]` · (120, 0, 99) · build_hoarding_fence: wnikanie obwiedni z doors[1].
- error · noCollisionLargeProp · `decor[159]` · (99.5, 0, 112.6) · city_barrier: duży model na powierzchni blocks[3], bez kolidera przy podstawie.
- warn · floatingObject · `decor[348]` · (10, 7.26, 9.78) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[349]` · (20, 7.26, 9.78) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[350]` · (30, 7.26, 9.78) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[351]` · (40, 7.26, 9.78) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · floatingObject · `decor[352]` · (60, 7.26, 9.78) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · floatingObject · `decor[353]` · (60, 7.26, 9.78) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[354]` · (10, 15.26, 9.78) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[355]` · (20, 15.26, 9.78) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[356]` · (30, 15.26, 9.78) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[357]` · (40, 15.26, 9.78) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · floatingObject · `decor[358]` · (60, 15.26, 9.78) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · floatingObject · `decor[359]` · (60, 15.26, 9.78) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[360]` · (40, 23.26, 9.78) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · floatingObject · `decor[361]` · (60, 23.26, 9.78) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · floatingObject · `decor[362]` · (60, 23.26, 9.78) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[363]` · (10.38, 7.26, -50) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[364]` · (10.38, 7.26, -40) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[365]` · (10.38, 7.26, -30) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[366]` · (10.38, 7.26, -20) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[367]` · (10.38, 7.26, -10) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[368]` · (10.38, 7.26, 0) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[369]` · (10.38, 7.26, 10) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[370]` · (10.38, 15.26, -50) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[371]` · (10.38, 15.26, -40) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[372]` · (10.38, 15.26, -30) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[373]` · (10.38, 15.26, -20) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[538]` · (76.81, 2.54, 61) · city_cable_span: bez zaczepienia 1/2 końców.
- warn · floatingObject · `decor[539]` · (96, 2.54, 60.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · overlap · `decor[897]` · (-145.87, 0, -162.75) · city_shutter: wnikanie obwiedni z blocks[2134].
- warn · overlap · `decor[898]` · (-145.4, 3.2, -152.25) · city_awning: wnikanie obwiedni z blocks[2134].
- warn · overlap · `decor[899]` · (-145.88, 0, -152.25) · city_door: wnikanie obwiedni z blocks[2134].
- warn · overlap · `decor[901]` · (-145.74, 11, -154) · city_ac_unit: wnikanie obwiedni z blocks[2134].
- warn · overlap · `decor[1036]` · (-145.4, 3.2, 153) · city_awning: wnikanie obwiedni z blocks[2100].
- warn · overlap · `decor[1037]` · (-145.88, 0, 153) · city_door: wnikanie obwiedni z blocks[2100].
- warn · overlap · `decor[1039]` · (-145.74, 5, 151.5) · city_ac_unit: wnikanie obwiedni z blocks[2100].
- warn · overlap · `decor[1040]` · (-145.87, 4.2, 146.25) · city_sign_box: wnikanie obwiedni z blocks[2100].
- warn · overlap · `decor[1041]` · (-145.4, 4, 148.5) · city_fire_escape: wnikanie obwiedni z blocks[2100].
- warn · overlap · `decor[1043]` · (-145.87, 0, 160.35) · city_shutter: wnikanie obwiedni z blocks[2100].
- warn · overlap · `decor[1046]` · (-145.74, 8, 159.5) · city_ac_unit: wnikanie obwiedni z blocks[2100].
- warn · overlap · `decor[1048]` · (-145.87, 4.2, 161.63) · city_sign_box: wnikanie obwiedni z blocks[2100].
- warn · overlap · `decor[1052]` · (145.4, 3.2, -156.75) · city_awning: wnikanie obwiedni z blocks[2166].
- warn · overlap · `decor[1055]` · (145.74, 5, -158) · city_ac_unit: wnikanie obwiedni z blocks[2166].
- warn · overlap · `decor[1062]` · (145.74, 8, -149.2) · city_ac_unit: wnikanie obwiedni z blocks[2166].
- warn · overlap · `decor[1175]` · (159.79, 18.6, 116.14) · city_satellite_cluster: wnikanie obwiedni z decor[1174].
- warn · floatingObject · `decor[1230]` · (-45, 8.94, 130.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · outOfBounds · `decor[1230]` · (-40, 9, 131) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[1231]` · (65, 8.94, 130.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · outOfBounds · `decor[1231]` · (70, 9, 131) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[1232]` · (-131.19, 8.94, -55) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · outOfBounds · `decor[1232]` · (-131, 9, -60) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[1233]` · (130.81, 8.94, 55) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · outOfBounds · `decor[1233]` · (131, 9, 50) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[1234]` · (15, 8.94, -131.19) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · outOfBounds · `decor[1234]` · (20, 9, -131) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `signs[23]` · (-145.6, 20, -40) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `signs[25]` · (-60, 17, -145.6) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `lights[37]` · (-40, 6, 132) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `lights[38]` · (132, 6, 60) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `lights[39]` · (90, 6, -95) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.

### arenaContainerPort

- error · noCollisionLargeProp · `decor[122]` · (15, 0.32, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[123]` · (11, 0.96, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[124]` · (7, 1.6, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[125]` · (3, 2.24, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[126]` · (-1, 2.88, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- warn · overlap · `decor[126]` · (-1, 2.88, 59.4) · city_barrier: wnikanie obwiedni z decor[121].
- error · noCollisionLargeProp · `decor[127]` · (-5, 3.52, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- warn · overlap · `decor[127]` · (-5, 3.52, 59.4) · city_barrier: wnikanie obwiedni z decor[121].
- error · noCollisionLargeProp · `decor[128]` · (-9, 4.16, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- warn · overlap · `decor[128]` · (-9, 4.16, 59.4) · city_barrier: wnikanie obwiedni z decor[121].
- error · noCollisionLargeProp · `decor[129]` · (-13, 4.8, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- warn · overlap · `decor[129]` · (-13, 4.8, 59.4) · city_barrier: wnikanie obwiedni z decor[121].
- error · noCollisionLargeProp · `decor[130]` · (-17, 5.44, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- warn · overlap · `decor[130]` · (-17, 5.44, 59.4) · city_barrier: wnikanie obwiedni z decor[121].
- error · noCollisionLargeProp · `decor[131]` · (-21, 6.08, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- warn · overlap · `decor[131]` · (-21, 6.08, 59.4) · city_barrier: wnikanie obwiedni z decor[121].
- error · noCollisionLargeProp · `decor[132]` · (-25, 6.72, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[133]` · (-29, 7.36, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[134]` · (-33, 8, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[135]` · (-37, 8.64, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[136]` · (-41, 9.28, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[137]` · (-45, 9.92, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[138]` · (-49, 10.56, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[139]` · (-53, 11.2, 59.4) · city_barrier: duży model na powierzchni blocks[186], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[140]` · (-61.69, 5.08, 17.82) · port_lashing_platform: duży model na powierzchni blocks[1692], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[141]` · (-55.69, 5.08, 17.82) · port_lashing_platform: duży model na powierzchni blocks[1692], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[144]` · (-161, 0, 10.2) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[145]` · (-161, 0, -60.2) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[146]` · (-155, 0, 10.2) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[147]` · (-155, 0, -60.2) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[148]` · (-137, 0, 10.2) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[149]` · (-137, 0, -60.2) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[150]` · (-131, 0, 10.2) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[151]` · (-131, 0, -60.2) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[152]` · (-124.8, 0, -57) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[154]` · (-124.8, 0, -39) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[156]` · (-124.8, 0, -33) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[158]` · (-124.8, 0, -21) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[160]` · (-124.8, 0, -15) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[162]` · (-124.8, 0, 6) · port_warehouse_shell_panel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- warn · overlap · `decor[214]` · (166, -1, -90) · rail_track_buffer: wnikanie obwiedni z blocks[1833].
- error · noCollisionLargeProp · `decor[219]` · (-128, 0, -93) · rail_signal_gantry: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[220]` · (-59, 0, -93) · rail_signal_gantry: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[221]` · (1, 0, -93) · rail_signal_gantry: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[222]` · (70, 0, -93) · rail_signal_gantry: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[223]` · (129, 0, -93) · rail_signal_gantry: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- warn · floatingObject · `decor[238]` · (-164, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[238]` · (-164, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[239]` · (-152, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[239]` · (-152, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[240]` · (-140, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[240]` · (-140, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[241]` · (-128, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[241]` · (-128, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[242]` · (-116, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[242]` · (-116, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[243]` · (-104, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[243]` · (-104, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[244]` · (-92, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[244]` · (-92, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[245]` · (-80, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[245]` · (-80, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[246]` · (-68, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[246]` · (-68, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[247]` · (-56, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[247]` · (-56, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[248]` · (-44, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[248]` · (-44, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[249]` · (-32, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[249]` · (-32, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[250]` · (-20, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[250]` · (-20, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[251]` · (-8, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[251]` · (-8, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[252]` · (4, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[252]` · (4, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[253]` · (16, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[253]` · (16, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[254]` · (16, 0, -124) · rail_catenary_mast: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[254]` · (16, 0, -124) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[255]` · (28, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[255]` · (28, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[256]` · (40, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[256]` · (40, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[257]` · (52, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[257]` · (52, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[258]` · (64, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[258]` · (64, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[259]` · (76, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[259]` · (76, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[260]` · (76, 0, -124) · rail_catenary_mast: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[260]` · (76, 0, -124) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[261]` · (88, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[261]` · (88, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[262]` · (100, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[262]` · (100, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[263]` · (112, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[263]` · (112, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[264]` · (124, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[264]` · (124, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[265]` · (136, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[265]` · (136, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[266]` · (136, 0, -124) · rail_catenary_mast: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[266]` · (136, 0, -124) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[267]` · (148, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[267]` · (148, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[268]` · (160, -0.4, -118) · rail_track_straight: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[268]` · (160, -0.4, -118) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[269]` · (-195, 0, -100) · port_warehouse_shell_panel: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[269]` · (-195, 0, -100) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[270]` · (-195, 0, -65) · port_warehouse_shell_panel: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[270]` · (-195, 0, -65) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[271]` · (-195, 0, -29) · port_warehouse_shell_panel: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[271]` · (-195, 0, -29) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[272]` · (-195, 0, 7) · port_warehouse_shell_panel: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[272]` · (-195, 0, 7) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[273]` · (-195, 0, 42) · port_warehouse_shell_panel: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[273]` · (-195, 0, 42) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[274]` · (192, 0, -100) · port_warehouse_shell_panel: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[274]` · (192, 0, -100) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[275]` · (192, 0, -65) · port_warehouse_shell_panel: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[275]` · (192, 0, -65) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[276]` · (192, 0, -29) · port_warehouse_shell_panel: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[276]` · (192, 0, -29) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[277]` · (192, 0, 7) · port_warehouse_shell_panel: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[277]` · (192, 0, 7) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[278]` · (192, 0, 42) · port_warehouse_shell_panel: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[278]` · (192, 0, 42) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · emptyRoom · `signs` · (-150, 0, 55) · Brak szyldów w danych mapy.

### arenaFloodedDocks

- error · noCollisionLargeProp · `decor[2]` · (-141, -1.2, -66) · dock_mooring_post: duży model na powierzchni blocks[52], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[5]` · (-117, -1.2, 45) · dock_mooring_post: duży model na powierzchni blocks[54], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[8]` · (32, -1.2, 55) · dock_mooring_post: duży model na powierzchni blocks[55], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[9]` · (40, -1.2, 55) · dock_mooring_post: duży model na powierzchni blocks[55], bez kolidera przy podstawie.
- warn · floatingObject · `decor[163]` · (-120, 5.94, -20.19) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[164]` · (-40, 5.94, -12.19) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[165]` · (43, 5.94, -14.19) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[166]` · (114, 5.94, 17.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[167]` · (-91, 5.94, 102.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[168]` · (-13, 6, 82.8) · city_cable_span: bez zaczepienia 1/2 końców.
- warn · floatingObject · `decor[170]` · (-177, -1, -74) · dock_pump_house: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[170]` · (-177, -1, -74) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[172]` · (-176, -1, 78) · dock_pump_house: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[172]` · (-176, -1, 78) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `decor[173]` · (-132, -1, -166) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[174]` · (-56, -1, -172) · dock_pump_house: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[174]` · (-56, -1, -172) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[175]` · (32, -1, -171) · dock_pump_house: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[175]` · (32, -1, -171) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[176]` · (114, -1, -170) · dock_pump_house: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[176]` · (114, -1, -170) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[177]` · (174, -1, -95) · dock_pump_house: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[177]` · (174, -1, -95) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.

### arenaOverpass

- warn · outOfBounds · `blocks[1136]` · (116, 1.12, 102) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `blocks[1161]` · (142, 0.8, 102) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[33]` · (27, 21.6, 8) · city_overpass_deck: wnikanie obwiedni z blocks[411].
- warn · overlap · `decor[45]` · (27, 21.6, -152) · hw_broken_deck_end: wnikanie obwiedni z blocks[412].
- error · noCollisionLargeProp · `decor[65]` · (110, 0, -100) · hw_gas_canopy: duży model na powierzchni blocks[603], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[66]` · (126, 0, 14) · hw_toll_booth: duży model na powierzchni blocks[627], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[67]` · (137, 0, 14) · hw_toll_booth: duży model na powierzchni blocks[627], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[68]` · (148, 0, 14) · hw_toll_booth: duży model na powierzchni blocks[627], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[69]` · (159, 0, 14) · hw_toll_booth: duży model na powierzchni blocks[627], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[70]` · (170, 0, 14) · hw_toll_booth: duży model na powierzchni blocks[627], bez kolidera przy podstawie.
- warn · floatingObject · `decor[94]` · (-77, 3.14, 17.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[95]` · (19, 3.14, 17.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[96]` · (-77, 3.14, 43.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[97]` · (-26, 3.14, 43.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[98]` · (-26, 3.14, 67.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[99]` · (19, 3.14, 67.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[100]` · (-77, 3.14, 89.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[101]` · (-26, 3.14, 89.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · overlap · `decor[126]` · (152, 0, 48) · city_street_lamp: wnikanie obwiedni z blocks[1199].
- warn · floatingObject · `decor[137]` · (-163, -1, -120) · power_slag_heap: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[137]` · (-163, -1, -120) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[138]` · (-160, -1, -45) · power_slag_heap: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[138]` · (-160, -1, -45) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[139]` · (142, -1, 142) · power_slag_heap: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[139]` · (142, -1, 142) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[140]` · (285, 0, 0) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[140]` · (285, 0, 0) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[141]` · (290.74, 0, 77.9) · rail_control_tower: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[141]` · (290.74, 0, 77.9) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[142]` · (274.53, 0, 158.5) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[142]` · (274.53, 0, 158.5) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[143]` · (201.53, 0, 201.53) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[143]` · (201.53, 0, 201.53) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[144]` · (150.5, 0, 260.67) · rail_control_tower: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[144]` · (150.5, 0, 260.67) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[145]` · (82.05, 0, 306.2) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[145]` · (82.05, 0, 306.2) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[146]` · (0, 0, 285) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[146]` · (0, 0, 285) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[147]` · (-77.9, 0, 290.74) · rail_control_tower: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[147]` · (-77.9, 0, 290.74) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[148]` · (-158.5, 0, 274.53) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[148]` · (-158.5, 0, 274.53) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[149]` · (-201.53, 0, 201.53) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[149]` · (-201.53, 0, 201.53) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[150]` · (-260.67, 0, 150.5) · rail_control_tower: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[150]` · (-260.67, 0, 150.5) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[151]` · (-306.2, 0, 82.05) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[151]` · (-306.2, 0, 82.05) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[152]` · (-285, 0, 0) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[152]` · (-285, 0, 0) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[153]` · (-290.74, 0, -77.9) · rail_control_tower: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[153]` · (-290.74, 0, -77.9) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[154]` · (-274.53, 0, -158.5) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[154]` · (-274.53, 0, -158.5) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[155]` · (-201.53, 0, -201.53) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[155]` · (-201.53, 0, -201.53) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[156]` · (-150.5, 0, -260.67) · rail_control_tower: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[156]` · (-150.5, 0, -260.67) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[157]` · (-82.05, 0, -306.2) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[157]` · (-82.05, 0, -306.2) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[158]` · (0, 0, -285) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[158]` · (0, 0, -285) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[159]` · (77.9, 0, -290.74) · rail_control_tower: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[159]` · (77.9, 0, -290.74) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[160]` · (158.5, 0, -274.53) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[160]` · (158.5, 0, -274.53) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[161]` · (201.53, 0, -201.53) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[161]` · (201.53, 0, -201.53) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[162]` · (260.67, 0, -150.5) · rail_control_tower: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[162]` · (260.67, 0, -150.5) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[163]` · (306.2, 0, -82.05) · build_site_office: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[163]` · (306.2, 0, -82.05) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.

### arenaPowerPlant

- warn · outOfBounds · `blocks[38]` · (0, -6.4, 132.5) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[0]` · (-108, 0, -138) · port_container_20_navy: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[0]` · (-108, 0, -138) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[1]` · (-97, 0, -138) · port_container_20_olive: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[1]` · (-97, 0, -138) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[2]` · (-85, 0, -138) · port_container_20_graphite: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[2]` · (-85, 0, -138) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[3]` · (-155, 0, -164) · power_hv_pylon: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[3]` · (-155, 0, -164) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[4]` · (-155.47, 23.66, -166.23) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · outOfBounds · `decor[4]` · (-127, 24, -168) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[5]` · (-98, 0, -169) · power_hv_pylon: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[5]` · (-98, 0, -169) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[6]` · (-98.47, 23.66, -171.23) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · outOfBounds · `decor[6]` · (-70, 24, -173) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[7]` · (-38, 0, -176) · power_hv_pylon: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[7]` · (-38, 0, -176) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[8]` · (-38.47, 23.66, -178.23) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · outOfBounds · `decor[8]` · (-10, 24, -180) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[9]` · (23, 0, -181) · power_hv_pylon: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[9]` · (23, 0, -181) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[10]` · (22.53, 23.66, -183.23) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · outOfBounds · `decor[10]` · (51, 24, -185) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[11]` · (83, 0, -187) · power_hv_pylon: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[11]` · (83, 0, -187) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[12]` · (82.53, 23.66, -189.23) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · outOfBounds · `decor[12]` · (111, 24, -191) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[13]` · (142, 0, -198) · power_hv_pylon: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[13]` · (142, 0, -198) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[14]` · (141.53, 23.66, -200.23) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · outOfBounds · `decor[14]` · (170, 24, -202) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[15]` · (199, 0, -214) · power_hv_pylon: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[15]` · (199, 0, -214) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `decor[23]` · (167, -1, 164) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[27]` · (-130, 0, 24) · build_pipe_stack: wnikanie obwiedni z decor[26].
- warn · overlap · `decor[28]` · (-136, 0, 12) · build_pipe_stack: wnikanie obwiedni z decor[26].
- warn · overlap · `decor[29]` · (-113, 0, 29) · build_pipe_stack: wnikanie obwiedni z decor[26].
- warn · overlap · `decor[30]` · (-142, 0, 22) · build_pipe_stack: wnikanie obwiedni z decor[26].
- warn · outOfBounds · `decor[93]` · (-99, -2.5, 127) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `decor[94]` · (-99, -2.5, 135) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- error · noCollisionLargeProp · `decor[102]` · (-168, 0, 59) · city_generator: duży model na powierzchni blocks[6], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[103]` · (-140, 0, 69) · city_generator: duży model na powierzchni blocks[6], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[104]` · (-107, 0, 66) · city_generator: duży model na powierzchni blocks[7], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[105]` · (-75, 0, 70) · city_generator: duży model na powierzchni blocks[7], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[106]` · (-46, 0, 61) · city_generator: duży model na powierzchni blocks[7], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[107]` · (-16, 0, 71) · city_generator: duży model na powierzchni blocks[7], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[108]` · (16, 0, 67) · city_generator: duży model na powierzchni blocks[7], bez kolidera przy podstawie.
- warn · overlap · `decor[109]` · (-154, 0, -107) · city_crates: wnikanie obwiedni z blocks[1031].
- error · noCollisionLargeProp · `decor[110]` · (-127, 0, -116) · city_crates: duży model na powierzchni blocks[2], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[111]` · (-89, 0, -109) · city_crates: duży model na powierzchni blocks[2], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[112]` · (-62, 0, -96) · city_crates: duży model na powierzchni blocks[2], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[113]` · (-31, 0, -109) · city_crates: duży model na powierzchni blocks[2], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[114]` · (-4, 0, -82) · city_crates: duży model na powierzchni blocks[2], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[115]` · (78, 0, -75) · city_crates: duży model na powierzchni blocks[2], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[116]` · (98, 0, 7) · city_generator: duży model na powierzchni blocks[8], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[117]` · (121, 0, 9) · city_generator: duży model na powierzchni blocks[8], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[118]` · (155, 0, -12) · city_crates: duży model na powierzchni blocks[5], bez kolidera przy podstawie.
- warn · overlap · `decor[132]` · (101, 0, 24.26) · city_pipe_run: wnikanie obwiedni z decor[57].
- warn · overlap · `decor[156]` · (84.6, 0, -25.28) · city_pipe_run: wnikanie obwiedni z decor[51].
- warn · overlap · `decor[157]` · (109.6, 0, 31.72) · city_pipe_run: wnikanie obwiedni z decor[57].
- warn · emptyRoom · `signs` · (-180, 0, -140) · Brak szyldów w danych mapy.

### arenaRailYard

- warn · overlap · `decor[20]` · (-182, 12, -40) · port_warehouse_roof_truss: wnikanie obwiedni z decor[19].
- warn · overlap · `decor[21]` · (-170, 12, -40) · port_warehouse_roof_truss: wnikanie obwiedni z decor[20].
- warn · overlap · `decor[22]` · (-158, 12, -40) · port_warehouse_roof_truss: wnikanie obwiedni z decor[21].
- warn · overlap · `decor[23]` · (-146, 12, -40) · port_warehouse_roof_truss: wnikanie obwiedni z decor[22].
- warn · overlap · `decor[24]` · (-134, 12, -40) · port_warehouse_roof_truss: wnikanie obwiedni z decor[23].
- warn · overlap · `decor[25]` · (-122, 12, -40) · port_warehouse_roof_truss: wnikanie obwiedni z decor[24].
- error · noCollisionLargeProp · `decor[36]` · (184, 0, 63) · rail_track_straight: duży model na powierzchni blocks[7], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[37]` · (184, 0, 63) · rail_track_straight: duży model na powierzchni blocks[7], bez kolidera przy podstawie.
- warn · overlap · `decor[37]` · (184, 0, 63) · rail_track_straight: wnikanie obwiedni z decor[36].
- error · noCollisionLargeProp · `decor[38]` · (184, 0, 63) · rail_track_straight: duży model na powierzchni blocks[7], bez kolidera przy podstawie.
- warn · overlap · `decor[38]` · (184, 0, 63) · rail_track_straight: wnikanie obwiedni z decor[36].
- warn · overlap · `decor[38]` · (184, 0, 63) · rail_track_straight: wnikanie obwiedni z decor[37].
- warn · outOfBounds · `decor[80]` · (90, -0.8, -7) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- error · noCollisionLargeProp · `decor[116]` · (-204, 0, -45) · rail_track_buffer: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[117]` · (-204, 0, -35) · rail_track_buffer: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[118]` · (-204, 0, -10) · rail_track_buffer: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[119]` · (-204, 0, 0) · rail_track_buffer: duży model na powierzchni blocks[3], bez kolidera przy podstawie.
- warn · overlap · `decor[120]` · (-204, 0, 25) · rail_track_buffer: wnikanie obwiedni z blocks[563].
- error · noCollisionLargeProp · `decor[121]` · (-204, 0, 35) · rail_track_buffer: duży model na powierzchni blocks[3], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[122]` · (204, 0, -45) · rail_track_buffer: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[123]` · (204, 0, -35) · rail_track_buffer: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[124]` · (204, 0, -10) · rail_track_buffer: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[125]` · (204, 0, 0) · rail_track_buffer: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[126]` · (204, 0, 25) · rail_track_buffer: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[127]` · (204, 0, 35) · rail_track_buffer: duży model na powierzchni blocks[6], bez kolidera przy podstawie.
- warn · floatingObject · `decor[130]` · (-200, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[130]` · (-200, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[133]` · (-184, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[133]` · (-184, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[133]` · (-184, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[130].
- warn · floatingObject · `decor[136]` · (-168, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[136]` · (-168, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[136]` · (-168, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[133].
- warn · floatingObject · `decor[139]` · (-152, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[139]` · (-152, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[139]` · (-152, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[136].
- warn · floatingObject · `decor[142]` · (-136, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[142]` · (-136, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[142]` · (-136, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[139].
- warn · floatingObject · `decor[145]` · (-120, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[145]` · (-120, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[145]` · (-120, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[142].
- warn · floatingObject · `decor[148]` · (-104, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[148]` · (-104, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[148]` · (-104, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[145].
- warn · floatingObject · `decor[151]` · (-88, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[151]` · (-88, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[151]` · (-88, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[148].
- warn · floatingObject · `decor[154]` · (-72, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[154]` · (-72, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[154]` · (-72, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[151].
- warn · floatingObject · `decor[157]` · (-56, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[157]` · (-56, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[157]` · (-56, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[154].
- warn · floatingObject · `decor[160]` · (-40, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[160]` · (-40, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[160]` · (-40, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[157].
- warn · floatingObject · `decor[163]` · (-24, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[163]` · (-24, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[163]` · (-24, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[160].
- warn · floatingObject · `decor[166]` · (-8, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[166]` · (-8, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[166]` · (-8, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[163].
- warn · floatingObject · `decor[169]` · (8, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[169]` · (8, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[169]` · (8, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[166].
- warn · floatingObject · `decor[172]` · (24, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[172]` · (24, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[172]` · (24, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[169].
- warn · floatingObject · `decor[175]` · (40, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[175]` · (40, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[175]` · (40, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[172].
- warn · floatingObject · `decor[178]` · (56, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[178]` · (56, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[178]` · (56, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[175].
- warn · floatingObject · `decor[181]` · (72, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[181]` · (72, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[181]` · (72, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[178].
- warn · floatingObject · `decor[184]` · (88, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[184]` · (88, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[184]` · (88, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[181].
- warn · floatingObject · `decor[187]` · (104, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[187]` · (104, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[187]` · (104, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[184].
- warn · floatingObject · `decor[190]` · (120, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[190]` · (120, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[190]` · (120, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[187].
- warn · floatingObject · `decor[193]` · (136, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[193]` · (136, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[193]` · (136, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[190].
- warn · floatingObject · `decor[196]` · (152, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[196]` · (152, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[196]` · (152, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[193].
- warn · floatingObject · `decor[199]` · (168, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[199]` · (168, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[199]` · (168, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[196].
- warn · floatingObject · `decor[202]` · (184, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[202]` · (184, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[202]` · (184, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[199].
- warn · floatingObject · `decor[205]` · (200, -1, -97) · rail_snow_drift_long: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[205]` · (200, -1, -97) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[205]` · (200, -1, -97) · rail_snow_drift_long: wnikanie obwiedni z decor[202].
- warn · floatingObject · `decor[206]` · (-240, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[206]` · (-240, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[207]` · (-240, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[207]` · (-240, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[208]` · (-228, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[208]` · (-228, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[209]` · (-240, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[209]` · (-240, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[210]` · (-200, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[210]` · (-200, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[211]` · (-200, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[211]` · (-200, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[212]` · (-188, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[212]` · (-188, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[213]` · (-200, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[213]` · (-200, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[214]` · (-160, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[214]` · (-160, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[215]` · (-160, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[215]` · (-160, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[216]` · (-148, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[216]` · (-148, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[217]` · (-160, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[217]` · (-160, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[218]` · (-120, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[218]` · (-120, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[219]` · (-120, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[219]` · (-120, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[220]` · (-108, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[220]` · (-108, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[221]` · (-120, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[221]` · (-120, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[222]` · (-80, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[222]` · (-80, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[223]` · (-80, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[223]` · (-80, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[224]` · (-68, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[224]` · (-68, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[225]` · (-80, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[225]` · (-80, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[226]` · (-40, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[226]` · (-40, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[227]` · (-40, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[227]` · (-40, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[228]` · (-28, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[228]` · (-28, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[229]` · (-40, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[229]` · (-40, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[230]` · (0, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[230]` · (0, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[231]` · (0, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[231]` · (0, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[232]` · (12, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[232]` · (12, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[233]` · (0, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[233]` · (0, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[234]` · (40, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[234]` · (40, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[235]` · (40, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[235]` · (40, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[236]` · (52, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[236]` · (52, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[237]` · (40, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[237]` · (40, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[238]` · (80, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[238]` · (80, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[239]` · (80, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[239]` · (80, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[240]` · (92, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[240]` · (92, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[241]` · (80, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[241]` · (80, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[242]` · (120, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[242]` · (120, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[243]` · (120, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[243]` · (120, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[244]` · (132, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[244]` · (132, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[245]` · (120, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[245]` · (120, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[246]` · (160, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[246]` · (160, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[247]` · (160, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[247]` · (160, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[248]` · (172, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[248]` · (172, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[249]` · (160, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[249]` · (160, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[250]` · (200, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[250]` · (200, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[251]` · (200, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[251]` · (200, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[252]` · (212, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[252]` · (212, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[253]` · (200, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[253]` · (200, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[254]` · (240, 0, 98) · build_hoarding_fence: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[254]` · (240, 0, 98) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[255]` · (240, -1, -106) · roof_stairwell_hut: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[255]` · (240, -1, -106) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[256]` · (252, 0, 105) · city_car: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[256]` · (252, 0, 105) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[257]` · (240, 0, 110) · city_street_lamp: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[257]` · (240, 0, 110) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[258]` · (-240, 4, -40) · city_overpass_deck: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[258]` · (-240, 4, -40) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[259]` · (-240, 0, -40) · rail_signal_gantry: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[259]` · (-240, 0, -40) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[260]` · (-240, 4, 30) · city_overpass_deck: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[260]` · (-240, 4, 30) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[261]` · (-240, 0, 30) · rail_signal_gantry: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[261]` · (-240, 0, 30) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[262]` · (240, 4, -40) · city_overpass_deck: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[262]` · (240, 4, -40) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[263]` · (240, 0, -40) · rail_signal_gantry: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[263]` · (240, 0, -40) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[264]` · (240, 4, 30) · city_overpass_deck: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[264]` · (240, 4, 30) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[265]` · (240, 0, 30) · rail_signal_gantry: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[265]` · (240, 0, 30) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · emptyRoom · `signs` · (-200, 0, 70) · Brak szyldów w danych mapy.

### arenaRooftops

- warn · floatingObject · `decor[7]` · (-31.92, 3.26, 5) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[8]` · (100.08, 3.26, 5) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[9]` · (-65, 3.26, 32.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[10]` · (-65, 7.26, -43.92) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[11]` · (42, 7.26, -21.92) · city_lantern_string: bez zaczepienia 2/2 końców.
- error · noCollisionLargeProp · `decor[63]` · (-140, 12, -80) · city_antenna: duży model na powierzchni blocks[967], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[64]` · (-118, 8, -100) · city_antenna: duży model na powierzchni blocks[972], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[65]` · (-90, 4, -44) · city_antenna: duży model na powierzchni blocks[987], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[66]` · (-128, 0, -14) · city_antenna: duży model na powierzchni blocks[991], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[67]` · (-72, 4, -80) · city_antenna: duży model na powierzchni blocks[980], bez kolidera przy podstawie.
- warn · floatingObject · `decor[86]` · (106.5, 12, -66) · city_neon_sign_frame: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[105]` · (137.5, 8, -26.5) · city_neon_sign_frame: brak styku z podłożem lub konstrukcją.
- error · noCollisionLargeProp · `decor[106]` · (52, 4, -60) · city_antenna: duży model na powierzchni blocks[1025], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[107]` · (100, 8, -112) · city_antenna: duży model na powierzchni blocks[1029], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[108]` · (140, 8, -60) · city_antenna: duży model na powierzchni blocks[1045], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[109]` · (116, 0, -16) · city_antenna: duży model na powierzchni blocks[1062], bez kolidera przy podstawie.
- warn · floatingObject · `decor[123]` · (26, 4.06, 31.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[124]` · (34, 4.06, 31.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[125]` · (76, 4.06, 31.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[126]` · (84, 4.06, 31.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[127]` · (26, 4.06, 40.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[128]` · (34, 4.06, 40.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[129]` · (76, 4.06, 40.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[130]` · (84, 4.06, 40.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[131]` · (26, 4.06, 79.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[132]` · (34, 4.06, 79.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[133]` · (76, 4.06, 79.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[134]` · (84, 4.06, 79.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[135]` · (26, 4.06, 88.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[136]` · (34, 4.06, 88.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[137]` · (76, 4.06, 88.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[138]` · (84, 4.06, 88.58) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[139]` · (55, 4.46, 50.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[140]` · (55, 4.46, 70.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[164]` · (-29.92, -6.34, 5) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[165]` · (-19.92, -6.34, 5) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[166]` · (-9.92, -6.34, 5) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[167]` · (10.08, -6.34, 5) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[168]` · (20.08, -6.34, 5) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[169]` · (30.08, -6.34, 5) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[170]` · (-120.19, -4.56, 5) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[171]` · (-90.19, -4.56, 5) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[172]` · (69.81, -4.56, 5) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[173]` · (129.81, -4.56, 5) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[201]` · (-67, -4.08, 61.73) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[202]` · (-67, -4.08, 71.73) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[203]` · (-67, -4.08, 83.73) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[254]` · (-40.17, 6.35, -55.5) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[255]` · (-10.17, 10.35, -91.5) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[256]` · (15.5, 6.35, -24.17) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[257]` · (-34.17, 2.35, -13.5) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[313]` · (-128.13, 2.16, 111.5) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[314]` · (-96.13, 2.16, 103.5) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[315]` · (-63.5, 2.16, 115.87) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[316]` · (-84.13, 2.16, 33.5) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · overlap · `decor[709]` · (59.34, -13.85, 16) · city_pipe_run: wnikanie obwiedni z blocks[267].
- warn · overlap · `decor[710]` · (68.76, -13.85, 16) · city_pipe_run: wnikanie obwiedni z blocks[276].
- warn · overlap · `decor[714]` · (76, -7.71, 12.63) · city_ac_unit: wnikanie obwiedni z blocks[283].
- warn · floatingObject · `signs[21]` · (164.15, -6, -4) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · outOfBounds · `signs[21]` · (164.15, -6, -4) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.

### bossRoom

Brak zgłoszeń.

### combatCorridor

- error · noCollisionLargeProp · `decor[0]` · (-15, 0, -37) · rail_track_straight: duży model na powierzchni blocks[3], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[4]` · (-15, 0, 11) · rail_track_straight: duży model na powierzchni blocks[3], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[8]` · (-5, 0, -1) · rail_track_straight: duży model na powierzchni blocks[3], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[9]` · (-5, 0, 11) · rail_track_straight: duży model na powierzchni blocks[3], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[13]` · (5, 0, -1) · rail_track_straight: duży model na powierzchni blocks[3], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[14]` · (5, 0, 11) · rail_track_straight: duży model na powierzchni blocks[3], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[20]` · (-15, 0, 19) · rail_track_buffer: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[21]` · (-15, 0, -45) · rail_track_buffer: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[22]` · (-5, 0, 19) · rail_track_buffer: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[23]` · (-5, 0, -45) · rail_track_buffer: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[24]` · (5, 0, 19) · rail_track_buffer: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[25]` · (5, 0, -45) · rail_track_buffer: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[26]` · (15, 0, 19) · rail_track_buffer: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[27]` · (15, 0, -45) · rail_track_buffer: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[41]` · (-26, 1.4, -26) · rail_platform_canopy: duży model na powierzchni blocks[25], bez kolidera przy podstawie.
- warn · overlap · `decor[61]` · (-39.85, 3.4, -43) · city_sign_box: wnikanie obwiedni z blocks[77].
- warn · overlap · `decor[62]` · (-39.7, 0, -37) · city_pipe_run: wnikanie obwiedni z blocks[77].
- warn · overlap · `decor[69]` · (39.7, 0, -43.5) · city_pipe_run: wnikanie obwiedni z blocks[78].
- warn · overlap · `decor[75]` · (-12.5, 0, 45.85) · city_door: wnikanie obwiedni z doors[0].
- warn · overlap · `decor[86]` · (-37.5, 1.8, -45.8) · city_ad_screen: wnikanie obwiedni z blocks[77].
- warn · overlap · `decor[87]` · (-32.5, 0, -45.85) · city_door: wnikanie obwiedni z blocks[77].
- warn · overlap · `decor[100]` · (32.5, 1.8, -45.8) · city_ad_screen: wnikanie obwiedni z blocks[78].
- warn · overlap · `decor[101]` · (37.5, 0, -45.85) · city_door: wnikanie obwiedni z blocks[78].
- warn · overlap · `decor[123]` · (-34, 0, 30) · city_traffic_cone: wnikanie obwiedni z blocks[75].
- warn · overlap · `decor[128]` · (-33, 0, -42) · city_street_lamp: wnikanie obwiedni z blocks[77].

### combatFloodedTunnel

- error · noCollisionLargeProp · `decor[2]` · (-6, -1.2, -10) · dock_half_sunken_car: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[3]` · (7, -1.2, 8) · dock_half_sunken_car: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- warn · overlap · `decor[3]` · (7, -1.2, 8) · dock_half_sunken_car: wnikanie obwiedni z decor[0].
- error · noCollisionLargeProp · `decor[4]` · (-7, -1.2, 16) · dock_skiff: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[5]` · (6, -1.2, -28) · dock_skiff: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[6]` · (-3, -1.2, -14) · dock_skiff: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[7]` · (-10, -1.2, 6) · dock_mooring_post: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[8]` · (10, -1.2, -8) · dock_mooring_post: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[9]` · (9, -1.2, 20) · dock_mooring_post: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- warn · overlap · `decor[22]` · (-35.65, 4.4, -33) · city_ac_unit: wnikanie obwiedni z blocks[64].
- warn · overlap · `decor[23]` · (-35.8, 1.8, -27) · city_ad_screen: wnikanie obwiedni z blocks[64].
- warn · overlap · `decor[48]` · (35.7, 0, 27) · city_pipe_run: wnikanie obwiedni z blocks[66].
- warn · overlap · `decor[80]` · (-35.4, 0, -14) · hw_storm_culvert: wnikanie obwiedni z blocks[16].
- warn · overlap · `decor[81]` · (-35.4, 0, 8) · hw_storm_culvert: wnikanie obwiedni z blocks[17].
- warn · overlap · `decor[82]` · (35.4, 0, -26) · hw_storm_culvert: wnikanie obwiedni z blocks[21].
- warn · overlap · `decor[83]` · (35.4, 0, 14) · hw_storm_culvert: wnikanie obwiedni z blocks[23].
- warn · overlap · `decor[92]` · (34, 0, -24) · city_barrier: wnikanie obwiedni z decor[82].
- error · noCollisionLargeProp · `decor[101]` · (-12, 0, 40) · hw_fire_barrel: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[102]` · (20, 0, 36) · hw_fire_barrel: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[103]` · (-26, 0, 4) · hw_fire_barrel: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[104]` · (32, 0, -6) · hw_fire_barrel: duży model na powierzchni blocks[2], bez kolidera przy podstawie.
- warn · overlap · `decor[111]` · (30, 0, 6) · city_street_lamp: wnikanie obwiedni z decor[89].

### combatLaserYard

- warn · overlap · `decor[24]` · (-33.7, 0, -27.5) · city_pipe_run: wnikanie obwiedni z blocks[61].
- warn · overlap · `decor[29]` · (-33.8, 0, -2.5) · city_shutter: wnikanie obwiedni z blocks[23].
- warn · overlap · `decor[30]` · (33.8, 1.6, -31.5) · city_ad_screen: wnikanie obwiedni z blocks[62].
- error · noCollisionLargeProp · `decor[36]` · (33.65, 3.2, -1.5) · city_ac_unit: duży model na powierzchni blocks[24], bez kolidera przy podstawie.
- warn · overlap · `decor[37]` · (33.8, 1.8, -43) · city_ad_screen: wnikanie obwiedni z blocks[62].
- warn · overlap · `decor[38]` · (33.85, 0, -37) · city_door: wnikanie obwiedni z blocks[62].
- warn · overlap · `decor[76]` · (17, 0, 11) · city_highway_barrier: wnikanie obwiedni z decor[13].
- warn · overlap · `decor[77]` · (25, 0, 8) · city_vending: wnikanie obwiedni z decor[14].
- warn · overlap · `decor[83]` · (-14, 0, -18) · city_crates: wnikanie obwiedni z decor[15].
- error · noCollisionLargeProp · `decor[91]` · (-12, 0, 22) · hw_fire_barrel: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[92]` · (10, 0, 22) · hw_fire_barrel: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- warn · overlap · `decor[93]` · (-4, 0, 36) · hw_fire_barrel: wnikanie obwiedni z blocks[65].
- error · noCollisionLargeProp · `decor[94]` · (22, 0, 36) · hw_fire_barrel: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- warn · overlap · `decor[102]` · (30, 0, -34) · city_street_lamp: wnikanie obwiedni z blocks[62].

### combatPillars

- warn · overlap · `decor[33]` · (35.65, 3.2, -43.5) · city_ac_unit: wnikanie obwiedni z blocks[197].
- warn · overlap · `decor[34]` · (35.65, 6.2, -38.5) · city_ac_unit: wnikanie obwiedni z blocks[197].
- warn · overlap · `decor[35]` · (35.8, 1.6, -33.5) · city_ad_screen: wnikanie obwiedni z blocks[197].
- warn · overlap · `decor[73]` · (35.5, 8, 30) · city_cable_span: wnikanie obwiedni z blocks[198].
- warn · floatingObject · `signs[0]` · (-21, 3, 19.7) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[1]` · (21, 3, -25.7) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[2]` · (0, 3, 19.7) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[7]` · (-26, 7, 0) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[8]` · (26, 7, -6) · Brak konstrukcji przy płaszczyźnie szyldu.

### combatPlatforms

- error · noCollisionLargeProp · `decor[8]` · (-10, 3.4, 9.5) · city_antenna: duży model na powierzchni blocks[21], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[9]` · (-29, 3.4, 22) · city_satellite_cluster: duży model na powierzchni blocks[21], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[10]` · (32, 6.8, 10) · city_antenna: duży model na powierzchni blocks[22], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[11]` · (10, 6.8, 22) · city_satellite_cluster: duży model na powierzchni blocks[22], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[12]` · (32, 10.2, -6) · city_antenna: duży model na powierzchni blocks[23], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[13]` · (-10, 3.4, -6) · city_satellite_cluster: duży model na powierzchni blocks[24], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[14]` · (-30, 3.4, -24) · city_antenna: duży model na powierzchni blocks[24], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[33]` · (20.5, 0, 30.6) · city_fire_escape: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[43]` · (25.5, 0, 7.4) · city_fire_escape: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[45]` · (34.6, 0, 10.5) · city_fire_escape: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[57]` · (7.4, 0, -12.5) · city_fire_escape: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[59]` · (10.5, 0, -30.6) · city_fire_escape: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[68]` · (34.6, 0, -7.5) · city_fire_escape: duży model na powierzchni blocks[0], bez kolidera przy podstawie.

### combatRing

- warn · floatingObject · `decor[0]` · (-13.5, 8.04, -5.51) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[1]` · (-13.5, 8.34, 4.49) · city_cable_span: bez zaczepienia 2/2 końców.

### combatSubstation

- warn · floatingObject · `decor[1]` · (-48, 0, -10) · power_hv_pylon: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[1]` · (-48, 0, -10) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[2]` · (48, 0, 22) · power_hv_pylon: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[2]` · (48, 0, 22) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · overlap · `decor[24]` · (-33, 3.2, -43.65) · city_ac_unit: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[26]` · (-27, 0, -43.8) · city_shutter: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[29]` · (-15, 0, -43.85) · city_door: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[30]` · (-12, 1.2, -43.8) · city_ad_screen: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[41]` · (33, 0, -43.8) · city_shutter: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[43]` · (41.4, 0, -43.7) · city_pipe_run: wnikanie obwiedni z blocks[22].
- warn · overlap · `decor[66]` · (-39.65, 3.2, -34) · city_ac_unit: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[68]` · (-39.8, 0, -28) · city_shutter: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[88]` · (39.65, 3.2, -34) · city_ac_unit: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[90]` · (39.8, 0, -28) · city_shutter: wnikanie obwiedni z blocks[28].
- warn · floatingObject · `decor[115]` · (-29, 5.34, -8.19) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[116]` · (-9, 5.34, -8.19) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[117]` · (13, 5.34, -8.19) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[118]` · (-31, 5.74, 3.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[119]` · (-11, 5.74, 3.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[120]` · (9, 5.74, 3.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[121]` · (27, 5.74, 3.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[122]` · (-29, 4.94, 15.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[123]` · (-5, 4.94, 15.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[124]` · (21, 4.94, 15.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · overlap · `decor[125]` · (-28, 0, -29) · city_antenna: wnikanie obwiedni z blocks[27].
- error · noCollisionLargeProp · `decor[126]` · (8, 0, -42) · city_antenna: duży model na powierzchni blocks[6], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[127]` · (-30, 0, 20) · city_antenna: duży model na powierzchni blocks[1], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[128]` · (36, 0, 34) · city_antenna: duży model na powierzchni blocks[0], bez kolidera przy podstawie.

### combatWarehouse

- warn · overlap · `decor[173]` · (12, 0, 5) · city_vending: wnikanie obwiedni z decor[2].
- warn · overlap · `decor[199]` · (-39, 0, -44.8) · city_shutter: wnikanie obwiedni z blocks[26].
- warn · overlap · `decor[202]` · (-27, 0, -44.85) · city_door: wnikanie obwiedni z blocks[26].
- warn · overlap · `decor[203]` · (-24.6, 1.2, -44.8) · city_ad_screen: wnikanie obwiedni z blocks[26].
- warn · overlap · `decor[245]` · (-39.8, 0, -41) · city_shutter: wnikanie obwiedni z blocks[26].
- warn · floatingObject · `signs[0]` · (-30, 7.5, -29.85) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[1]` · (-27, 3.2, 17.5) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[2]` · (27, 3.2, 17.5) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[3]` · (-27, 3.2, -13.5) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[4]` · (27, 3.2, -13.5) · Brak konstrukcji przy płaszczyźnie szyldu.

### combatYard

- warn · overlap · `decor[48]` · (-30, 3.2, -14) · city_wrecked_car: wnikanie obwiedni z decor[0].
- warn · overlap · `decor[49]` · (-28, 3.2, -26) · city_dumpster: wnikanie obwiedni z decor[0].
- warn · overlap · `decor[50]` · (30, 4.8, 0) · city_wrecked_car: wnikanie obwiedni z decor[1].
- warn · overlap · `decor[51]` · (40, 4.8, 2) · city_generator: wnikanie obwiedni z decor[1].
- warn · overlap · `decor[51]` · (40, 4.8, 2) · city_generator: wnikanie obwiedni z decor[2].
- warn · overlap · `decor[71]` · (40, 0, -39.8) · city_shutter: wnikanie obwiedni z decor[2].

### eliteChemPlant

- warn · overlap · `decor[13]` · (40.4, 1.2, 35.8) · city_ad_screen: wnikanie obwiedni z blocks[26].
- warn · overlap · `decor[132]` · (-39.8, 0, -51) · city_shutter: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[133]` · (-39.7, 0, -45) · city_pipe_run: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[134]` · (-39.65, 6.8, -43.5) · city_ac_unit: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[135]` · (-39.85, 0, -39) · city_door: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[136]` · (-39.8, 1.2, -36.6) · city_ad_screen: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[137]` · (-39.85, 5, -33) · city_sign_box: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[138]` · (-39.7, 0, -35.2) · city_pipe_run: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[158]` · (-39.65, 5, 36.6) · city_ac_unit: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[159]` · (-39.8, 0, 39) · city_shutter: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[160]` · (-39.7, 0, 45) · city_pipe_run: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[161]` · (-39.65, 6.8, 46.5) · city_ac_unit: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[164]` · (39.8, 0, -51) · city_shutter: wnikanie obwiedni z blocks[31].
- warn · overlap · `decor[165]` · (39.7, 0, -45) · city_pipe_run: wnikanie obwiedni z blocks[31].
- warn · overlap · `decor[166]` · (39.65, 6.8, -43.5) · city_ac_unit: wnikanie obwiedni z blocks[31].
- warn · overlap · `decor[167]` · (39.85, 0, -39) · city_door: wnikanie obwiedni z blocks[31].
- warn · overlap · `decor[168]` · (39.8, 1.2, -36.6) · city_ad_screen: wnikanie obwiedni z blocks[31].
- warn · overlap · `decor[169]` · (39.85, 5, -33) · city_sign_box: wnikanie obwiedni z blocks[31].
- warn · overlap · `decor[170]` · (39.7, 0, -35.2) · city_pipe_run: wnikanie obwiedni z blocks[31].
- warn · overlap · `decor[190]` · (39.65, 5, 36.6) · city_ac_unit: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[191]` · (39.8, 0, 39) · city_shutter: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[192]` · (39.7, 0, 45) · city_pipe_run: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[193]` · (39.65, 6.8, 46.5) · city_ac_unit: wnikanie obwiedni z blocks[29].

### eliteCourtyard

- warn · floatingObject · `decor[14]` · (-10.5, 6.8, 29.65) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[18]` · (-14.5, 6.8, 36.35) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[29]` · (3.5, 6.8, -6.35) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[33]` · (-0.5, 6.8, -1.65) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · overlap · `decor[58]` · (-41, 0, -51.8) · city_shutter: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[59]` · (-35, 0, -51.7) · city_pipe_run: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[61]` · (-29, 0, -51.85) · city_door: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[62]` · (-26.6, 1.2, -51.8) · city_ad_screen: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[63]` · (-23, 5, -51.85) · city_sign_box: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[64]` · (-25.2, 0, -51.7) · city_pipe_run: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[65]` · (-17, 0, -51.8) · city_shutter: wnikanie obwiedni z blocks[38].
- warn · overlap · `decor[66]` · (-13.4, 5, -51.65) · city_ac_unit: wnikanie obwiedni z blocks[38].
- warn · overlap · `decor[67]` · (-11, 0, -51.8) · city_shutter: wnikanie obwiedni z blocks[38].
- warn · overlap · `decor[76]` · (31, 0, -51.85) · city_door: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[77]` · (33.4, 1.2, -51.8) · city_ad_screen: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[78]` · (37, 5, -51.85) · city_sign_box: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[79]` · (34.8, 0, -51.7) · city_pipe_run: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[104]` · (-41.8, 0, -48) · city_shutter: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[105]` · (-41.7, 0, -42) · city_pipe_run: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[107]` · (-41.85, 0, -36) · city_door: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[134]` · (41.8, 0, -48) · city_shutter: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[135]` · (41.7, 0, -42) · city_pipe_run: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[136]` · (41.65, 6.8, -40.5) · city_ac_unit: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[137]` · (41.85, 0, -36) · city_door: wnikanie obwiedni z blocks[27].
- warn · floatingObject · `decor[177]` · (-38, 4.86, 24.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[178]` · (18, 4.86, 24.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[179]` · (-10, 4.86, 24.08) · city_lantern_string: bez zaczepienia 2/2 końców.

### eliteFoundry

- warn · overlap · `decor[85]` · (-44, 0, -49.8) · city_shutter: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[86]` · (-38, 0, -49.7) · city_pipe_run: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[87]` · (-36.5, 6.8, -49.65) · city_ac_unit: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[106]` · (40, 0, -49.8) · city_shutter: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[107]` · (43.6, 5, -49.65) · city_ac_unit: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[108]` · (-44, 0, 49.85) · city_door: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[109]` · (-41.6, 1.2, 49.8) · city_ad_screen: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[110]` · (-38, 5, 49.85) · city_sign_box: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[111]` · (-40.2, 0, 49.7) · city_pipe_run: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[132]` · (40, 0, 49.7) · city_pipe_run: wnikanie obwiedni z blocks[31].
- warn · overlap · `decor[133]` · (41.5, 6.8, 49.65) · city_ac_unit: wnikanie obwiedni z blocks[31].
- warn · overlap · `decor[134]` · (-44.8, 0, -46) · city_shutter: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[135]` · (-44.7, 0, -40) · city_pipe_run: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[136]` · (-44.65, 6.8, -38.5) · city_ac_unit: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[137]` · (-44.85, 0, -34) · city_door: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[138]` · (-44.8, 1.2, -31.6) · city_ad_screen: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[139]` · (-44.85, 5, -28) · city_sign_box: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[140]` · (-44.7, 0, -30.2) · city_pipe_run: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[141]` · (-44.8, 0, -22) · city_shutter: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[142]` · (-44.65, 5, -18.4) · city_ac_unit: wnikanie obwiedni z blocks[28].
- warn · overlap · `decor[159]` · (-44.8, 0, 38) · city_shutter: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[160]` · (-44.65, 5, 41.6) · city_ac_unit: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[161]` · (-44.8, 0, 44) · city_shutter: wnikanie obwiedni z blocks[30].
- warn · overlap · `decor[162]` · (44.8, 0, -46) · city_shutter: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[163]` · (44.7, 0, -40) · city_pipe_run: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[164]` · (44.65, 6.8, -38.5) · city_ac_unit: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[165]` · (44.85, 0, -34) · city_door: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[166]` · (44.8, 1.2, -31.6) · city_ad_screen: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[167]` · (44.85, 5, -28) · city_sign_box: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[168]` · (44.7, 0, -30.2) · city_pipe_run: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[169]` · (44.8, 0, -22) · city_shutter: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[170]` · (44.65, 5, -18.4) · city_ac_unit: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[171]` · (44.8, 0, -16) · city_shutter: wnikanie obwiedni z blocks[29].
- warn · overlap · `decor[187]` · (44.8, 0, 38) · city_shutter: wnikanie obwiedni z blocks[31].
- warn · overlap · `decor[188]` · (44.65, 5, 41.6) · city_ac_unit: wnikanie obwiedni z blocks[31].
- warn · overlap · `decor[189]` · (44.8, 0, 44) · city_shutter: wnikanie obwiedni z blocks[31].
- warn · overlap · `decor[190]` · (-38, 0, 46) · city_street_lamp: wnikanie obwiedni z blocks[30].

### eliteHall

- warn · overlap · `decor[5]` · (-12.8, -1.5, -50) · rail_track_straight: wnikanie obwiedni z decor[0].
- warn · overlap · `decor[6]` · (-12.8, -1.5, -38) · rail_track_straight: wnikanie obwiedni z decor[1].
- warn · overlap · `decor[7]` · (-12.8, -1.5, -26) · rail_track_straight: wnikanie obwiedni z decor[2].
- warn · overlap · `decor[8]` · (-12.8, -1.5, -14) · rail_track_straight: wnikanie obwiedni z decor[3].
- warn · overlap · `decor[9]` · (-12.8, -1.5, -2) · rail_track_straight: wnikanie obwiedni z decor[4].
- warn · overlap · `decor[15]` · (15.2, -1.5, -50) · rail_track_straight: wnikanie obwiedni z decor[10].
- warn · overlap · `decor[16]` · (15.2, -1.5, -38) · rail_track_straight: wnikanie obwiedni z decor[11].
- warn · overlap · `decor[17]` · (15.2, -1.5, -26) · rail_track_straight: wnikanie obwiedni z decor[12].
- warn · overlap · `decor[18]` · (15.2, -1.5, -14) · rail_track_straight: wnikanie obwiedni z decor[13].
- warn · overlap · `decor[19]` · (15.2, -1.5, -2) · rail_track_straight: wnikanie obwiedni z decor[14].
- error · noCollisionLargeProp · `decor[36]` · (0, 0, -48) · rail_platform_canopy: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[37]` · (0, 0, -36) · rail_platform_canopy: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[38]` · (0, 0, -24) · rail_platform_canopy: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[39]` · (0, 0, -12) · rail_platform_canopy: duży model na powierzchni blocks[4], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[40]` · (27, 0, -48) · rail_platform_canopy: duży model na powierzchni blocks[6], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[42]` · (27, 0, -24) · rail_platform_canopy: duży model na powierzchni blocks[6], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[43]` · (27, 0, -12) · rail_platform_canopy: duży model na powierzchni blocks[6], bez kolidera przy podstawie.
- warn · overlap · `decor[44]` · (-40, 0, 29.8) · city_shutter: wnikanie obwiedni z blocks[40].
- warn · overlap · `decor[105]` · (-26, 0, -13) · city_dumpster: wnikanie obwiedni z decor[35].
- warn · overlap · `decor[121]` · (36, 0, 40) · rail_snow_drift: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[145]` · (-41, 0, -55.8) · city_shutter: wnikanie obwiedni z blocks[60].
- warn · overlap · `decor[146]` · (-35, 0, -55.7) · city_pipe_run: wnikanie obwiedni z blocks[60].
- warn · overlap · `decor[165]` · (37, 5, -55.85) · city_sign_box: wnikanie obwiedni z blocks[61].
- warn · overlap · `decor[166]` · (34.8, 0, -55.7) · city_pipe_run: wnikanie obwiedni z blocks[61].
- warn · overlap · `decor[191]` · (-41.8, 0, -52) · city_shutter: wnikanie obwiedni z blocks[60].
- warn · overlap · `decor[212]` · (-41.85, 0, 20) · city_door: wnikanie obwiedni z blocks[40].
- warn · overlap · `decor[213]` · (-41.8, 1.2, 22.4) · city_ad_screen: wnikanie obwiedni z blocks[40].
- warn · overlap · `decor[216]` · (-41.8, 0, 32) · city_shutter: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[217]` · (-41.65, 5, 35.6) · city_ac_unit: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[218]` · (-41.8, 0, 38) · city_shutter: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[223]` · (41.8, 0, -52) · city_shutter: wnikanie obwiedni z blocks[61].
- warn · overlap · `decor[249]` · (41.65, 5, 35.6) · city_ac_unit: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[250]` · (41.8, 0, 38) · city_shutter: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[251]` · (41.7, 0, 44) · city_pipe_run: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[252]` · (41.65, 6.8, 45.5) · city_ac_unit: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[259]` · (-36, 0, 34) · city_street_lamp: wnikanie obwiedni z blocks[58].

### hideout

- error · noCollisionLargeProp · `decor[25]` · (18.8, 0, 1.3) · city_antenna: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[30]` · (-3.9, 0, 6.1) · city_antenna: duży model na powierzchni blocks[73], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[37]` · (6.9, 0, -18) · city_antenna: duży model na powierzchni blocks[165], bez kolidera przy podstawie.

### m01-maszty

- warn · floatingObject · `decor[0]` · (3, 5.44, -0.19) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[3]` · (51, 4.86, 0.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[4]` · (71, 5.56, 0.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · overlap · `decor[6]` · (85, 3.5, 10.7) · city_awning: wnikanie obwiedni z blocks[34].
- error · noCollisionLargeProp · `decor[17]` · (209, 4.25, -6.3) · build_scaffold_bay: duży model na powierzchni blocks[94], bez kolidera przy podstawie.

### m02-punkt-kontrolny

- error · noCollisionLargeProp · `decor[0]` · (193, 0, 5) · city_wrecked_car: duży model na powierzchni blocks[5], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[6]` · (54, 0, 0) · port_gantry_crane: duży model na powierzchni blocks[47], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[7]` · (35, 0, -10) · city_generator: duży model na powierzchni blocks[43], bez kolidera przy podstawie.

### m03-list-przewozowy

- warn · outOfBounds · `blocks[62]` · (90, -2.1, -38) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[33]` · (46, 0, 19.5) · port_light_tower: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[33]` · (46, 0, 19.5) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[46]` · (124, 0, 18.5) · port_light_tower: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[46]` · (124, 0, 18.5) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[60]` · (158, 0, -20.5) · port_light_tower: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[60]` · (158, 0, -20.5) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `decor[97]` · (273, 0, 3) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[114]` · (240, 0, 15.5) · port_light_tower: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[114]` · (240, 0, 15.5) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.

### m04-ladunek-klasy-k

- error · noCollisionLargeProp · `decor[1]` · (15, 0, -8) · city_crates: duży model na powierzchni blocks[3], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[3]` · (31, 0, -8) · city_crates: duży model na powierzchni blocks[7], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[5]` · (47, 0, -8) · city_crates: duży model na powierzchni blocks[11], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[7]` · (15, 0, 8) · city_crates: duży model na powierzchni blocks[3], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[9]` · (31, 0, 8) · city_crates: duży model na powierzchni blocks[7], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[11]` · (47, 0, 8) · city_crates: duży model na powierzchni blocks[11], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[13]` · (71, 0, -8) · city_crates: duży model na powierzchni blocks[26], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[15]` · (87, 0, -8) · city_crates: duży model na powierzchni blocks[30], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[17]` · (103, 0, -8) · city_crates: duży model na powierzchni blocks[34], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[19]` · (71, 0, 8) · city_crates: duży model na powierzchni blocks[26], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[21]` · (87, 0, 8) · city_crates: duży model na powierzchni blocks[30], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[23]` · (103, 0, 8) · city_crates: duży model na powierzchni blocks[34], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[25]` · (119, 0, -8) · city_crates: duży model na powierzchni blocks[46], bez kolidera przy podstawie.
- warn · overlap · `decor[26]` · (130, 0, -13.7) · city_pipe_run: wnikanie obwiedni z blocks[308].
- error · noCollisionLargeProp · `decor[27]` · (135, 0, -8) · city_crates: duży model na powierzchni blocks[50], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[29]` · (151, 0, -8) · city_crates: duży model na powierzchni blocks[54], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[31]` · (119, 0, 8) · city_crates: duży model na powierzchni blocks[46], bez kolidera przy podstawie.
- warn · overlap · `decor[32]` · (130, 0, 13.7) · city_pipe_run: wnikanie obwiedni z blocks[309].
- error · noCollisionLargeProp · `decor[33]` · (135, 0, 8) · city_crates: duży model na powierzchni blocks[50], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[35]` · (151, 0, 8) · city_crates: duży model na powierzchni blocks[54], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[37]` · (179, 0, -8) · city_crates: duży model na powierzchni blocks[69], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[39]` · (195, 0, -8) · city_crates: duży model na powierzchni blocks[73], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[41]` · (211, 0, -8) · city_crates: duży model na powierzchni blocks[77], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[43]` · (179, 0, 8) · city_crates: duży model na powierzchni blocks[69], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[45]` · (195, 0, 8) · city_crates: duży model na powierzchni blocks[73], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[47]` · (211, 0, 8) · city_crates: duży model na powierzchni blocks[77], bez kolidera przy podstawie.
- warn · overlap · `decor[49]` · (246, 0, -6.7) · city_pipe_run: wnikanie obwiedni z blocks[314].
- warn · overlap · `decor[51]` · (246, 0, 6.7) · city_pipe_run: wnikanie obwiedni z blocks[315].
- error · noCollisionLargeProp · `decor[52]` · (36, 0, 0) · rail_signal_gantry: duży model na powierzchni blocks[8], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[53]` · (62, 0, 0) · rail_signal_gantry: duży model na powierzchni blocks[24], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[54]` · (104, 0, 0) · rail_signal_gantry: duży model na powierzchni blocks[34], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[55]` · (156, 0, 0) · rail_signal_gantry: duży model na powierzchni blocks[55], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[56]` · (178, 0, 0) · rail_signal_gantry: duży model na powierzchni blocks[69], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[57]` · (220, 0, 0) · rail_signal_gantry: duży model na powierzchni blocks[79], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[58]` · (88, 0, -7) · city_generator: duży model na powierzchni blocks[30], bez kolidera przy podstawie.
- warn · overlap · `decor[59]` · (146, 0, -7) · city_generator: wnikanie obwiedni z blocks[61].
- warn · overlap · `decor[66]` · (36, 0, -5.8) · city_street_lamp: wnikanie obwiedni z decor[52].
- warn · overlap · `decor[67]` · (50, 0, 5.8) · city_street_lamp: wnikanie obwiedni z gates[0].block.
- warn · overlap · `decor[70]` · (92, 0, -5.8) · city_street_lamp: wnikanie obwiedni z gates[2].block.
- warn · overlap · `decor[78]` · (204, 0, -5.8) · city_street_lamp: wnikanie obwiedni z gates[5].block.
- warn · overlap · `decor[81]` · (246, 0, 5.8) · city_street_lamp: wnikanie obwiedni z gates[6].block.
- error · noCollisionLargeProp · `decor[90]` · (73, 0, 10) · port_container_20_ochre: duży model na powierzchni blocks[27], bez kolidera przy podstawie.
- warn · overlap · `decor[93]` · (130, 5, -13.8) · city_cable_span: wnikanie obwiedni z blocks[308].
- error · noCollisionLargeProp · `decor[95]` · (127, 0, 12) · port_container_20_ochre: duży model na powierzchni blocks[48], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[100]` · (185, 0, 12) · port_container_20_ochre: duży model na powierzchni blocks[71], bez kolidera przy podstawie.

### m05-adiutant

- warn · floatingObject · `decor[0]` · (22, 2, -5) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[2]` · (30, 2, 5) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[7]` · (124, -4, 10) · city_pipe_run: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[7]` · (124, -4, 10) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[8]` · (145, -4, 10) · city_pipe_run: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[8]` · (145, -4, 10) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[9]` · (164, -4, 10) · city_pipe_run: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[9]` · (164, -4, 10) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[10]` · (180, -4, 10) · city_pipe_run: brak styku z podłożem lub konstrukcją.
- warn · outOfBounds · `decor[10]` · (180, -4, 10) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · floatingObject · `decor[15]` · (252.8, 0, -7) · city_shutter: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `signs[0]` · (36, 3, -4) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[1]` · (67, 2, -6.5) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[2]` · (116, 3, -4) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[3]` · (127, 4.5, -5.5) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[4]` · (175, 3, 2) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[6]` · (245, 2.8, -5) · Brak konstrukcji przy płaszczyźnie szyldu.

### m06-odlewnia

- warn · overlap · `decor[11]` · (80, 0, 9) · power_slag_heap: wnikanie obwiedni z decor[10].
- warn · overlap · `decor[12]` · (39.5, 0, -9.5) · power_slag_heap: wnikanie obwiedni z decor[9].

### m07-nocny-dyzur

- error · noCollisionLargeProp · `decor[21]` · (9.6, 0, 8.3) · city_vending: duży model na powierzchni blocks[24], bez kolidera przy podstawie.
- warn · floatingObject · `decor[26]` · (19, 7.14, -8.59) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[27]` · (28, 7.74, 8.21) · city_cable_span: bez zaczepienia 2/2 końców.
- error · noCollisionLargeProp · `decor[42]` · (120.6, 0, -4.6) · city_vending: duży model na powierzchni blocks[128], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[69]` · (254.6, 0, 13.3) · city_vending: duży model na powierzchni blocks[357], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[70]` · (281.5, 0, -12.8) · city_kiosk: duży model na powierzchni blocks[347], bez kolidera przy podstawie.
- warn · floatingObject · `decor[75]` · (258, 5.86, 0.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[76]` · (274, 5.86, 0.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[77]` · (290, 5.86, 0.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[78]` · (306, 5.86, 0.08) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · floatingObject · `decor[79]` · (265, 7.94, 11.81) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[80]` · (295, 7.94, -12.19) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `signs[0]` · (1.2, 4.6, -4) · Brak konstrukcji przy płaszczyźnie szyldu.

### m08-kwarantanna

- warn · overlap · `decor[120]` · (24, 0, 4) · city_wrecked_car: wnikanie obwiedni z blocks[192].
- warn · overlap · `decor[121]` · (86, 0, 8) · city_generator: wnikanie obwiedni z blocks[202].
- warn · overlap · `decor[122]` · (146, 0, 10) · city_generator: wnikanie obwiedni z blocks[212].
- warn · overlap · `decor[123]` · (206, 0, 12) · city_generator: wnikanie obwiedni z blocks[222].
- warn · floatingObject · `decor[124]` · (123, 7.94, -10.19) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[125]` · (123, 7.94, 9.81) · city_cable_span: bez zaczepienia 2/2 końców.

### m09-brat

- warn · floatingObject · `decor[62]` · (7.81, -1.46, 5) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[64]` · (23.81, -1.46, 5) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[66]` · (39.81, -1.46, 5) · city_cable_span: bez zaczepienia 2/2 końców.
- error · noCollisionLargeProp · `decor[68]` · (28, 0, 3) · city_crates: duży model na powierzchni blocks[6], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[69]` · (70, 0, -5) · city_crates: duży model na powierzchni blocks[21], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[70]` · (84, 0, 5) · city_crates: duży model na powierzchni blocks[24], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[71]` · (114, 0, -7) · city_crates: duży model na powierzchni blocks[34], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[72]` · (130, 0, 7) · city_crates: duży model na powierzchni blocks[38], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[73]` · (157, 0, -7) · city_crates: duży model na powierzchni blocks[47], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[74]` · (181, 0, 7) · city_crates: duży model na powierzchni blocks[53], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[75]` · (211, 0, -8) · city_crates: duży model na powierzchni blocks[62], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[76]` · (232, 0, 8) · city_crates: duży model na powierzchni blocks[67], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[77]` · (88, 3, -7) · city_ac_unit: duży model na powierzchni blocks[108], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[78]` · (88, 3, 7) · city_ac_unit: duży model na powierzchni blocks[109], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[81]` · (220, 0, -10) · city_generator: duży model na powierzchni blocks[64], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[82]` · (235, 0, 4) · city_barrier: duży model na powierzchni blocks[68], bez kolidera przy podstawie.

### m10-archiwum

- warn · floatingObject · `decor[16]` · (40, 0, -11) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · overlap · `decor[24]` · (40, 0, -5.5) · city_barrier: wnikanie obwiedni z blocks[97].
- warn · overlap · `decor[25]` · (46, 0, 4.5) · city_barrier: wnikanie obwiedni z blocks[98].
- warn · floatingObject · `decor[26]` · (58, 0, -11) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · overlap · `decor[34]` · (58, 0, -5.5) · city_barrier: wnikanie obwiedni z blocks[115].
- warn · overlap · `decor[35]` · (64, 0, 4.5) · city_barrier: wnikanie obwiedni z blocks[116].
- warn · floatingObject · `decor[36]` · (76, 0, -11) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · overlap · `decor[44]` · (76, 0, -5.5) · city_barrier: wnikanie obwiedni z blocks[133].
- warn · overlap · `decor[45]` · (82, 0, 4.5) · city_barrier: wnikanie obwiedni z blocks[134].
- error · noCollisionLargeProp · `decor[66]` · (116, 4, -9) · city_barrier: duży model na powierzchni blocks[423], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[72]` · (134, 4, -9) · city_kiosk: duży model na powierzchni blocks[428], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[73]` · (143, 4, 9) · city_barrier: duży model na powierzchni blocks[430], bez kolidera przy podstawie.
- warn · floatingObject · `decor[107]` · (111, 9.94, -11.79) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[111]` · (111, 9.94, 11.41) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[115]` · (127, 9.94, -11.79) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[119]` · (127, 9.94, 11.41) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[123]` · (143, 9.94, -11.79) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[127]` · (143, 9.94, 11.41) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · overlap · `decor[129]` · (124, 4, -4.5) · city_barrier: wnikanie obwiedni z blocks[458].
- warn · overlap · `decor[130]` · (138, 4, 4.5) · city_barrier: wnikanie obwiedni z blocks[459].
- warn · floatingObject · `decor[136]` · (159, 9.44, 13.41) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[142]` · (167, 9.44, 13.41) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[148]` · (179, 9.44, 13.41) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[154]` · (191, 9.44, 13.41) · city_cable_span: bez zaczepienia 2/2 końców.
- warn · overlap · `decor[155]` · (170, 4, -4.5) · city_barrier: wnikanie obwiedni z blocks[473].
- warn · overlap · `decor[156]` · (182, 4, 5) · city_barrier: wnikanie obwiedni z blocks[474].
- warn · overlap · `decor[157]` · (194, 4, -4.5) · city_barrier: wnikanie obwiedni z blocks[475].
- warn · floatingObject · `decor[159]` · (230, 0, -6.5) · city_pipe_run: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[160]` · (230, 0, 6.5) · city_pipe_run: brak styku z podłożem lub konstrukcją.
- warn · overlap · `decor[161]` · (228, 0, -4) · city_barrier: wnikanie obwiedni z blocks[480].
- warn · overlap · `decor[162]` · (234, 0, 4) · city_barrier: wnikanie obwiedni z blocks[481].

### noodleShop

- warn · floatingObject · `decor[2]` · (0.07, 3.67, 1) · city_lantern_string: bez zaczepienia 2/2 końców.

### plazaHolo

- warn · overlap · `decor[26]` · (-21.8, 0, -48) · city_shutter: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[27]` · (-21.7, 0, -43) · city_pipe_run: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[28]` · (-21.65, 6.8, -41.5) · city_ac_unit: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[39]` · (13.8, 0, -48) · city_shutter: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[40]` · (13.7, 0, -43) · city_pipe_run: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[41]` · (13.65, 6.8, -41.5) · city_ac_unit: wnikanie obwiedni z blocks[58].
- warn · floatingObject · `decor[67]` · (-6.5, 6.8, 11.65) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[71]` · (-10.5, 6.8, 20.35) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[74]` · (-4, 5, 20.15) · city_sign_box: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[78]` · (-1.85, 5, 18) · city_sign_box: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[80]` · (-14.15, 5, 14) · city_sign_box: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[83]` · (-14.35, 5, 21.6) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[86]` · (7.5, 6.8, -14.35) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[90]` · (3.5, 6.8, -5.65) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[93]` · (10, 5, -5.85) · city_sign_box: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[97]` · (12.15, 5, -8) · city_sign_box: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[99]` · (-0.15, 5, -12) · city_sign_box: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[102]` · (-0.35, 5, -4.4) · city_ac_unit: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[103]` · (-8, 0.4, -4) · city_holo_projector: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[104]` · (8, 0.4, -4) · city_holo_projector: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[105]` · (-8, 0.4, 6) · city_holo_projector: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[106]` · (8, 0.4, 6) · city_holo_projector: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[107]` · (0, 0.4, 0) · city_holo_projector: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[108]` · (-16, 0.4, 0) · city_holo_projector: brak styku z podłożem lub konstrukcją.
- warn · floatingObject · `decor[109]` · (16, 0.4, 0) · city_holo_projector: brak styku z podłożem lub konstrukcją.
- warn · overlap · `decor[132]` · (-41, 0, -49.8) · city_shutter: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[133]` · (-35, 0, -49.7) · city_pipe_run: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[134]` · (-33.5, 6.8, -49.65) · city_ac_unit: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[135]` · (-29, 0, -49.85) · city_door: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[136]` · (-26.6, 1.2, -49.8) · city_ad_screen: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[137]` · (-23, 5, -49.85) · city_sign_box: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[138]` · (-25.2, 0, -49.7) · city_pipe_run: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[139]` · (-17, 0, -49.8) · city_shutter: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[140]` · (-13.4, 5, -49.65) · city_ac_unit: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[141]` · (-11, 0, -49.8) · city_shutter: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[142]` · (-5, 0, -49.7) · city_pipe_run: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[143]` · (-3.5, 6.8, -49.65) · city_ac_unit: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[144]` · (1, 0, -49.85) · city_door: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[145]` · (3.4, 1.2, -49.8) · city_ad_screen: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[146]` · (7, 5, -49.85) · city_sign_box: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[147]` · (4.8, 0, -49.7) · city_pipe_run: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[148]` · (13, 0, -49.8) · city_shutter: wnikanie obwiedni z blocks[58].
- warn · overlap · `decor[149]` · (16.6, 5, -49.65) · city_ac_unit: wnikanie obwiedni z blocks[60].
- warn · overlap · `decor[150]` · (19, 0, -49.8) · city_shutter: wnikanie obwiedni z blocks[60].
- warn · overlap · `decor[151]` · (37, 5, -49.85) · city_sign_box: wnikanie obwiedni z blocks[61].
- warn · overlap · `decor[152]` · (34.8, 0, -49.7) · city_pipe_run: wnikanie obwiedni z blocks[61].
- warn · overlap · `decor[153]` · (-41, 0, 49.85) · city_door: wnikanie obwiedni z blocks[62].
- warn · overlap · `decor[154]` · (-38.6, 1.2, 49.8) · city_ad_screen: wnikanie obwiedni z blocks[62].
- warn · overlap · `decor[155]` · (-35, 5, 49.85) · city_sign_box: wnikanie obwiedni z blocks[62].
- warn · overlap · `decor[156]` · (-37.2, 0, 49.7) · city_pipe_run: wnikanie obwiedni z blocks[62].
- warn · overlap · `decor[175]` · (34.6, 5, 49.65) · city_ac_unit: wnikanie obwiedni z blocks[63].
- warn · overlap · `decor[176]` · (37, 0, 49.8) · city_shutter: wnikanie obwiedni z blocks[63].
- warn · overlap · `decor[177]` · (-41.8, 0, -46) · city_shutter: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[178]` · (-41.7, 0, -40) · city_pipe_run: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[179]` · (-41.65, 6.8, -38.5) · city_ac_unit: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[180]` · (-41.85, 0, -34) · city_door: wnikanie obwiedni z blocks[59].
- warn · overlap · `decor[184]` · (-41.8, 0, -22) · city_shutter: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[186]` · (-41.8, 0, -16) · city_shutter: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[189]` · (-41.85, 0, -4) · city_door: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[190]` · (-41.8, 1.2, -1.6) · city_ad_screen: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[193]` · (-41.8, 0, 8) · city_shutter: wnikanie obwiedni z blocks[27].
- warn · overlap · `decor[203]` · (-41.65, 5, 41.6) · city_ac_unit: wnikanie obwiedni z blocks[62].
- warn · overlap · `decor[204]` · (-41.8, 0, 44) · city_shutter: wnikanie obwiedni z blocks[62].
- warn · overlap · `decor[205]` · (41.8, 0, -46) · city_shutter: wnikanie obwiedni z blocks[61].
- warn · overlap · `decor[206]` · (41.7, 0, -40) · city_pipe_run: wnikanie obwiedni z blocks[61].
- warn · overlap · `decor[207]` · (41.65, 6.8, -38.5) · city_ac_unit: wnikanie obwiedni z blocks[61].
- warn · overlap · `decor[208]` · (41.85, 0, -34) · city_door: wnikanie obwiedni z blocks[61].
- warn · overlap · `decor[212]` · (41.8, 0, -22) · city_shutter: wnikanie obwiedni z blocks[43].
- warn · overlap · `decor[214]` · (41.8, 0, -16) · city_shutter: wnikanie obwiedni z blocks[43].
- warn · overlap · `decor[217]` · (41.85, 0, -4) · city_door: wnikanie obwiedni z blocks[43].
- warn · overlap · `decor[218]` · (41.8, 1.2, -1.6) · city_ad_screen: wnikanie obwiedni z blocks[43].
- warn · overlap · `decor[221]` · (41.8, 0, 8) · city_shutter: wnikanie obwiedni z blocks[43].
- warn · overlap · `decor[231]` · (41.65, 5, 41.6) · city_ac_unit: wnikanie obwiedni z blocks[63].
- warn · overlap · `decor[232]` · (41.8, 0, 44) · city_shutter: wnikanie obwiedni z blocks[63].
- warn · overlap · `decor[233]` · (-34, 0, 44) · city_street_lamp: wnikanie obwiedni z blocks[62].
- warn · overlap · `decor[236]` · (34, 0, 44) · city_street_lamp: wnikanie obwiedni z blocks[63].
- warn · overlap · `decor[244]` · (-30, 0, -34) · city_street_lamp: wnikanie obwiedni z blocks[59].
- warn · floatingObject · `decor[246]` · (-30, 4.86, 30.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[247]` · (-10, 4.86, 30.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[248]` · (10, 4.86, 30.08) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[249]` · (-30, 4.86, -13.92) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[250]` · (10, 4.86, -19.92) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `signs[24]` · (-14.15, 6, 18) · Brak konstrukcji przy płaszczyźnie szyldu.
- warn · floatingObject · `signs[29]` · (-0.15, 6, -8) · Brak konstrukcji przy płaszczyźnie szyldu.

### puzzleLaser

- warn · emptyRoom · `lights` · (0, 0, 4) · Brak świateł w danych mapy.
- warn · emptyRoom · `decor` · (0, 0, 4) · Brak dekoracji w danych mapy.
- warn · emptyRoom · `signs` · (0, 0, 4) · Brak szyldów w danych mapy.

### puzzlePlate

- warn · emptyRoom · `lights` · (0, 0, 4) · Brak świateł w danych mapy.
- warn · emptyRoom · `decor` · (0, 0, 4) · Brak dekoracji w danych mapy.
- warn · emptyRoom · `signs` · (0, 0, 4) · Brak szyldów w danych mapy.

### restRoom

Brak zgłoszeń.

### rooftopRest

- error · noCollisionLargeProp · `decor[0]` · (-5.5, 0, -4.5) · city_antenna: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- error · noCollisionLargeProp · `decor[1]` · (5.5, 0, -5.8) · city_antenna: duży model na powierzchni blocks[0], bez kolidera przy podstawie.
- warn · floatingObject · `decor[4]` · (-7, 4, 0.61) · city_lantern_string: bez zaczepienia 2/2 końców.
- warn · floatingObject · `decor[5]` · (-7, 3.8, -3.69) · city_lantern_string: bez zaczepienia 1/2 końców.
- warn · outOfBounds · `lights[0]` · (-4, 5, -14) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `lights[1]` · (9, 5, -14) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `lights[2]` · (-15, 5, -3) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.
- warn · outOfBounds · `lights[3]` · (15, 5, 2) · Poza obrysem grywalnej podłogi, bez kontaktu z zabudową.

### shopRoom

- warn · floatingObject · `decor[4]` · (-5.5, 4.93, -0.21) · city_cable_span: bez zaczepienia 2/2 końców.
