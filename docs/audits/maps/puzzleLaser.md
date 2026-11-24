# Audyt level designu i plan przebudowy pokoju zagadki `puzzleLaser` (*Blokada fotonowa*)

- **Plik danych:** [puzzleLaser.json](file:///D:/AgenticProProjects/neoryder-maps/src/data/rooms/puzzleLaser.json)
- **Rola w grze:** Pokój zagadki (`type: "puzzle"`, `puzzle.kind: "laser"`) w puli sektora **Kurogane Arms** (`src/data/sectors/kurogane.json`, warstwy L3–L6, `puzzleCredits: 60` + nagroda modułu/implantu, `0` punktów spawnu wrogów, brak fal). Gracz musi przemieścić mobilną osłonę kalibracyjną (`28 kg`, `0,9 × 1,1 × 0,9 m`) z punktu startowego `(-1.5, 0.55, 0.9)` na północ w poprzek wiązki bramki laserowej `inspectionBeam` (`from: (-4.8, 0.65, -1.9)` $\rightarrow$ `to: (4.8, 0.65, -1.9)`, cykl `onS: 12 s`, `offS: 1.5 s`, `offsetS: 1.5 s`) — za pomocą mocy **Chwyt** (`grab`) albo pchając ją ciałem podczas chodu (`enableDynamicPush`, `pushMassKg: 75 kg`). Przecięcie odcinka wiązki przez kolider osłony natychmiast gasi laser (`blocksLaser("inspectionBeam") === true`), a utrzymanie blokady przez `confirmS = 0,2 s` trwale wyłącza barierę fotonową i odblokowuje północne drzwi wyjściowe `exit` `(0, 1.5, -6.5)`.
- **Materiał dowodowy:** [puzzleLaser.json](file:///D:/AgenticProProjects/neoryder-maps/src/data/rooms/puzzleLaser.json), zrzuty `artifacts/maps/puzzleLaser/before/01-spawn.png`..`10-top.png`, wynik `node tools/levels/mapAudit.mjs puzzleLaser` (`0 error / 3 warn`), kod mechaniki i renderu zagadki oraz zagrożeń ([grabPuzzle.ts](file:///D:/AgenticProProjects/neoryder-maps/src/world/grabPuzzle.ts), [grabPuzzleView.ts](file:///D:/AgenticProProjects/neoryder-maps/src/render/grabPuzzleView.ts), [hazards.ts](file:///D:/AgenticProProjects/neoryder-maps/src/world/hazards.ts), [hazardView.ts](file:///D:/AgenticProProjects/neoryder-maps/src/render/hazardView.ts), [roomScene.ts](file:///D:/AgenticProProjects/neoryder-maps/src/scenes/roomScene.ts), [roomSchema.ts](file:///D:/AgenticProProjects/neoryder-maps/src/world/roomSchema.ts)), testy [grabPuzzle.test.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/unit/grabPuzzle.test.ts) i [rooms.test.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/unit/rooms.test.ts), świeżo przebudowany bliźniaczy pokój zagadki [puzzlePlate.json](file:///D:/AgenticProProjects/neoryder-maps/src/data/rooms/puzzlePlate.json) + [puzzlePlate.md](file:///D:/AgenticProProjects/neoryder-maps/docs/audits/maps/puzzlePlate.md) (sekcja 5), wzorce [bossRoom.md](file:///D:/AgenticProProjects/neoryder-maps/docs/audits/maps/bossRoom.md) i [arena.md](file:///D:/AgenticProProjects/neoryder-maps/docs/audits/maps/arena.md), wymiary modeli [mapModelBounds.json](file:///D:/AgenticProProjects/neoryder-maps/src/data/render/mapModelBounds.json) oraz kontrakty [AGENTS.md](file:///D:/AgenticProProjects/neoryder-maps/AGENTS.md) i [0006-neon-noir.md](file:///D:/AgenticProProjects/neoryder-maps/docs/adr/0006-neon-noir.md).

---

## 1. Ocena obecnego stanu

### Klimat (1,5 / 5)
Pokój ma ustawione jedynie `"theme": "neonStreet"`, dzięki czemu na zrzutach (`01-spawn.png`..`07-corner-se.png`) widać nocne niebo z deszczem i sylwetki odległych wieżowców panoramy (`city-panorama`). Sama przestrzeń pokoju jest jednak surowym szablonem geometrycznym z wczesnego blockoutu:
- W pliku [puzzleLaser.json](file:///D:/AgenticProProjects/neoryder-maps/src/data/rooms/puzzleLaser.json) **brakuje tablic `lights`, `signs`, `decor`, `decals`, `ambientFx`, `rainShelters` oraz pola `weather`**. Automatyczny audyt `node tools/levels/mapAudit.mjs puzzleLaser` zwraca z tego powodu trzy ostrzeżenia `emptyRoom` (`Brak świateł w danych mapy`, `Brak dekoracji w danych mapy`, `Brak szyldów w danych mapy`).
- Cała geometria pokoju składa się wyłącznie z **7 płaskich prostopadłościanów**: betonowej płyty podłogi (`blocks[0]`, `material: "concrete"`) oraz 6 gładkich ścian obwodowych (`blocks[1..6]`, `model: "wall"`, `material: "trim"`). Użycie jasnego materiału wykończeniowego `trim` (`#8894a8`) na wszystkich 6 ścianach oraz `concrete` (`#56627a`) na podłodze sprawia, że wnętrze jest monotonne, płaskie i pozbawione głębi materiałowej.
- Za 4-metrowymi ścianami (`x = ±6 m`, `z = ±7 m`) nie ma ani jednego budynku `facade` z oświetlonymi oknami. Na ujęciach wysokich i z góry (`08-high-west.png`, `09-high-east.png`, `10-top.png`) pokój wygląda jak odcięte od miasta pudełko zawieszone w brązowo-fioletowej pustce kilkadziesiąt metrów przed pierwszym pierścieniem panoramy.
- Brak świateł punktowych (`CityLights`), kałuż (`puddle1`/`puddle2`) i zadaszeń (`rainShelters`) sprawia, że poza rozproszoną poświatą samego lasera na podłodze nie ma żadnych odbić neonów ani kontrastu światłocieniowego Neon Noir.

### Sensowność miejsca w świecie gry (1,0 / 5)
Według nazwy (`"name": "Blokada fotonowa"`) oraz id zagrożenia (`"id": "inspectionBeam"`) pokój powinien przedstawiać korytarz inspekcji optoelektronicznej lub śluzę kalibracji wiązek fotonowych w kompleksie badawczo-zbrojeniowym Kurogane Arms. Obecny układ w żaden sposób nie uzasadnia swojej funkcji:
- W całym pomieszczeniu (`10 × 12 m`) nie ma **ani jednego zasilacza lasera, szafy kondensatorów, terminala odbiorczego, stanowiska spoczynkowego osłon, obudowy emiterów ani przewodów zasilających**. Na ujęciach bocznych (`03-east.png`, `05-west.png`) widać wyłącznie puste połacie ścian `trim`, w które niemal bez śladu wtapia się cienka wiązka.
- Dwa emitery lasera tworzone proceduralnie przez `HazardView` (`BoxGeometry(0.2, 0.2, 0.2)` na słupkach `0.1 × 0.65 × 0.1 m` w `(-4.8, 0.65, -1.9)` i `(4.8, 0.65, -1.9)`) stoją `0,2 m` przed gładkim murem (`x = ±5,0 m`) bez żadnego cokołu, osłony termicznej czy pionu kablowego łączącego je ze ścianą i bramą wyjściową.
- Nad drzwiami `entry` `(0, 1.5, 6.5)` i `exit` `(0, 1.5, -6.5)` (`wysokość 3 m` w 4-metrowym murze) zieją puste, 1-metrowe wyrwy bez nadproży (`01-spawn.png`, `02-north.png`, `04-south.png`), a same drzwi nie mają żadnej sygnalizacji rygla optycznego.

### Czytelność zagadki i zagrożenia — analiza koloru wiązki lasera względem ADR 0006 (2,0 / 5)

#### Weryfikacja koloru wiązki lasera ([hazardView.ts](file:///D:/AgenticProProjects/neoryder-maps/src/render/hazardView.ts), [hazards.md](file:///D:/AgenticProProjects/neoryder-maps/docs/systems/hazards.md))
Zgodnie z wymogiem briefu zweryfikowano implementację renderu bramki `laser_gate` w [src/render/hazardView.ts](file:///D:/AgenticProProjects/neoryder-maps/src/render/hazardView.ts#L121-L170) (linie 121–170, 229–291, 442–472) oraz na wszystkich zrzutach `artifacts/maps/puzzleLaser/before/01-spawn.png`..`10-top.png`:
- **Wiązka lasera NIE używa zakazanej czerwieni wrogów (`#e0262b` / `#ff5050`).** `HazardView` definiuje wyłącznie dwie barwy z dozwolonej palety `ADR 0006`: **bursztyn `this.amber = new Color('#ffb84d')`** oraz **ciepłą biel `this.warmWhite = new Color('#fff1d6')`**.
- W fazie aktywnej (`phase === 'on'`) wewnętrzny rdzeń (`CylinderGeometry` o promieniu `0,03 m`) świeci ciepłą bielą `#fff1d6` (`intensity: 1.2`, `bloom: true`), a zewnętrzna otoczka (`CylinderGeometry` o promieniu `0,14 m`, shader `beamFragment`) miesza bursztynowy brzeg `#ffb84d` z gorącym biało-kremowym środkiem `#fff1d6` i animowanym przepływem energii (`sin(along * 7.0 - uTime * 40.0)`). W fazie ostrzeżenia (`phase === 'warn'`, ostatnie `0,6 s` przed włączeniem) shader rysuje maszerujące bursztynowe kreski (`uDash = 1`), a w fazie `off` gasi cylinder wiązki, zostawiając jedynie przygaszone bursztynowe okienka emiterów (`0,14 × 0,14 m`, `intensity: 0.12`).
- Również mobilna osłona w [src/render/grabPuzzleView.ts](file:///D:/AgenticProProjects/neoryder-maps/src/render/grabPuzzleView.ts#L20-L57) jest w pełni zgodna z `ADR 0006`: ma jasny korpus `interactive` (`#d9dde3`) z poświatą `neon_amber` (`#ffae1a`), która po przecięciu wiązki przechodzi w `neon_green` (`#6dff4a`).

#### Cztery problemy czytelności zagrożenia i mechaniki zagadki na obecnych zrzutach
Mimo poprawnych kolorów samego shadera wiązki, czytelność przestrzenna zagrożenia i zadania gracza w `puzzleLaser` ma cztery poważne defekty:
1. **Brak kontrastu tła i zlewanie się poświaty wiązki z szarym betonem (`01-spawn.png`, `02-north.png`, `06-corner-nw.png`):** biało-bursztynowa wiązka (`#fff1d6` / `#ffb84d`) wisi `0,65 m` nad jednolitą, szarą posadzką `concrete` (`#56627a`) na tle jasnoszarych ścian `trim` (`#8894a8`). Ponieważ pod wiązką nie ma ciemnego kanału ostrzegawczego (`floor_hazard`), a za nią brakuje chłodnego oświetlenia kontrastowego (błękitu `#3d7bff` i fioletu `#8a5cff`), bloom wiązki rozlewa się w mdłą, beżową mgłę.
2. **Mylna sugestia „przeskocz laser zamiast go zablokować”:** w pokojach bojowych (`combatLaserYard`, `eliteFoundry`) bramka `laser_gate` na wysokości `y = 0,65 m` z cyklem `onS / offS` służy do przeskakiwania lub przebiegania w oknie `offS`. W `puzzleLaser` przeskoczenie wiązki lub przejście podczas `1,5 s` przerwy **nie otwiera drzwi `exit` `(0, 1.5, -6.5)`** — drzwi otwiera wyłącznie **fizyczne przysłonięcie wiązki osłoną** przez `confirmS = 0,2 s`. W obecnym pokoju nic w otoczeniu nie pokazuje, że laser jest **optycznym ryglem bramy** i że trzeba wsunąć osłonę w konkretny punkt przecięcia `(-1.5, 0, -1.9)`.
3. **Brak toru prowadzącego osłonę (`x = -1,5`, `z: 0,9 → -1,9`) i oznaczenia gniazda przysłony:** osłona stoi po lewej stronie w `(-1.5, 0.55, 0.9)`, `2,8 m` przed wiązką (`z = -1.9`). Na posadzce nie ma ani szyn prowadzących wzdłuż osi `x = -1,5`, ani strzałki `floor_arrow` wskazującej ruch w poprzek wiązki, ani ramki celu w `(-1.5, 0, -1.9)`, ani linii zatrzymania (`floor_stop`) na głównym pasie ruchu.
4. **Niewidoczne emitery i całkowite znikanie linii zagrożenia w fazie `off`:** słupki emiterów (`10 × 10 cm`) na `x = ±4,8, z = -1,9` są niemal niewidoczne na `03-east.png` i `05-west.png`. Gdy wiązka gaśnie na `1,5 s` w cyklu (lub po wsunięciu osłony), w przestrzeni 3D nie zostaje żadna wyraźna oś architektoniczna (obudowy emiterów, most optyczny nad wiązką, pasy na podłodze), która pokazywałaby przebieg bariery.

#### Rozwiązanie zgodne z ADR 0006 (czytelne zagrożenie i mechanika bez czerwieni)
Aby zagrożenie `inspectionBeam` (`#fff1d6` / `#ffb84d`) było natychmiast czytelne jako śmiertelna bariera fotonowa (`25 dmg`) i jednocześnie jako optyczny rygiel północnej śluzy — bez użycia zarezerwowanej czerwieni, cyanu i magenty:
- **Kontrast chromatyczny (Chłodne Tło $\leftrightarrow$ Gorąca Wiązka):** oświetlamy korytarz za laserem i boczne stanowiska aparaturowe chłodnym **błękitem królewskim (`#3d7bff`)** oraz **fioletem (`#8a5cff`)** przy ciemnej posadzce `paving` i ciemnych stalowych ścianach `metal` (`#435169`), celowo **nie umieszczając żadnego bursztynowego ani białego `PointLight` nad samą linią lasera `z = -1,9`** (oraz wyłączając `groundGlow: false` we wszystkich światłach). Dzięki temu gorąca, biało-bursztynowa wiązka lasera jest jedynym źródłem ciepłej emisji na linii `z = -1,9` i odcina się jak brzytwa na chłodnym, niebiesko-fioletowym tle.
- **Architektoniczne osadzenie emiterów i mostu optycznego:** w punktach `x = ±4,91, z = -1,9` osadzamy stalowe obudowy ścienne emiterów (`blocks[7..8]`, z których wystają świecące głowice `HazardView` na `x = ±4,694`), z iskrami `sparks` przy wschodnim emiterze i zasilającym go agregatem `city_generator`, a tuż za linią wiązki (`z = -2,55`) stawiamy **stalowy most czujników optycznych (`blocks[9..13]`)** ze sznurem lampionów ostrzegawczych.
- **Oznaczenie linii ognia i gniazda przysłony na posadzce:** wzdłuż całej wiązki `z = -1,9` malujemy pasy ostrzegawcze `floor_hazard` rozdzielone kwadratowym **gniazdem rygla optycznego w `(-1.5, 0, -1.9)`**, do którego od pozycji startowej osłony `(-1.5, 0, 0.9)` prowadzą dwie równoległe szyny i strzałka `floor_arrow`, natomiast prawy pas pieszy przed wiązką (`(1.1, 0, -1.35)`) blokuje napis ostrzegawczy `floor_stop`.

### Skala i proporcje przestrzeni (3,5 / 5)
Obrys zewnętrzny podłogi `blocks[0]` wynosi **`12 × 14 m`** (`x ∈ [-6, 6]`, `z ∈ [-7, 7]`), co przy 1-metrowych murach obwodowych daje **`10 × 12 m` (`120 m²`)** powierzchni użytecznej:
- **Spójność z pokojami niebojowymi sektora:** wymiar `12 × 14 m` jest identyczny jak w drugim pokoju zagadki `puzzlePlate.json` (`12 × 14 m`) i zbliżony do `shopRoom.json` (`12 × 12 m`), `restRoom.json` (`12 × 12 m`) oraz `noodleShop.json` (`10 × 16 m`).
- **Dopasowanie do mechaniki i testów:** dystans przesunięcia osłony (`28 kg`) od `(-1.5, 0.55, 0.9)` do wiązki `z = -1,9` wynosi `2,8 m` między środkami (`2,35 m` do pierwszego kontaktu czoła kolidera `z = 0,45` z promieniem lasera), co pozwala rozwiązać zagadkę w 2–3 sekundy pchania lub prowadzenia Chwytem. Zmiana wymiarów podłogi, pozycji spawnu `(0, 0, 4)`, pozycji osłony `(-1.5, 0.55, 0.9)` lub bramki `inspectionBeam` złamałaby testy jednostkowe w [tests/unit/grabPuzzle.test.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/unit/grabPuzzle.test.ts#L81-L132) (`tp -1.5 4 0 0` oraz `tp -1.5 4 0 -17`).
- **Wniosek projektowy:** zachowujemy rzut podłogi `12 × 14 m`, `playerSpawn`, `doors`, `hazards` i `puzzle`, natomiast całkowicie przebudowujemy **architekturę pionową, materiały, asymetryczne zadaszenia i wyposażenie optoelektroniczne**, nadając `puzzleLaser` własną tożsamość wyraźnie odmienną od `puzzlePlate`.

---

## 2. Koncepcja przebudowy

### Czym jest to miejsce w świecie gry: *Kanał Kalibracji Optoelektronicznej („Blokada fotonowa”)*
To wąski, wietrzny korytarz testowo-kontrolny (`10 × 12 m` w świetle stalowych ścian) w skrzydle optoelektroniki i cybernetyki Kurogane Arms, przez który przebiega **wysokoenergetyczna wiązka inspekcyjna `inspectionBeam`** (`z = -1,9`, wysokość `0,65 m`) sprzężona z zamkiem północnej grodzi (`exit` na `z = -6,5`).
W przeciwieństwie do zewnętrznego, deszczowego dziedzińca przeładunkowego z wagą towarową w `puzzlePlate`, `puzzleLaser` to **surowe laboratorium poligonowe / kanał fotonowy**:
- Po **wschodniej stronie (`x ∈ [3,4..5,0]`)** znajduje się **sekcja zasilania i odbioru wiązki**: szafa kondensatorów diagnostycznych (`city_vending`), wysokonapięciowy agregat zasilający wschodni emiter lasera (`city_generator` tuż przy `z = -1,9`, z iskrami na przyłączu głowicy) oraz zadaszona budka terminala odbiorczego (`city_kiosk` pod północno-wschodnim okapem `z ∈ [-6,0..-3,0]`), który monitoruje ciągłość wiązki i steruje ryglem północnych drzwi.
- Po **zachodniej stronie (`x ∈ [-5,0..-1,0]`)** znajduje się **tor kalibracyjny osłon balistyczno-optycznych**: pod południowo-zachodnim okapem (`z ∈ [-0,5..4,7]`) przy murze spoczywa zapasowy blok tłumika (`cover_low` w `(-4.45, 0.55, 0.9)`) oraz zapora przeciwodłamkowa (`city_barrier`), a na równoległym torze szynowym `x = -1,5` stoi gotowa do wsunięcia, jasna **osłona pochłaniająca (`puzzle.object` w `(-1.5, 0.55, 0.9)`)**.

### Jak otoczenie, architektura i światło tłumaczą zagadkę bez tekstu
Od pierwszej klatki po spawnie w `(0, 0, 4)` (`01-spawn.png`) układ prowadzi wzrok i ruch gracza bez potrzeby czytania HUD-u:

1. **Asymetryczny trójkąt kompozycyjny w pierwszym kadrze (`01-spawn.png`):**
   - Ponieważ gracz startuje na osi `x = 0, z = 4`, a wysoka, jasna bryła osłony (`0,9 × 1,1 × 0,9 m`, `#d9dde3`) stoi po lewej stronie na `x = -1,5, z = 0,9` pod snopem ciepłego białego reflektora (`lights[0]`, `#fff1d6`), **osłona nie zasłania ani drzwi wyjściowych `exit` `(0, 1.5, -6.5)`, ani prawej i środkowej części wiązki lasera `z = -1,9`**. Gracz widzi jednocześnie narzędzie (osłonę po lewej), przeszkodę (wiązkę fotonową w poprzek pokoju) i cel końcowy (północną śluzę w głębi).
2. **Szyny prowadzące i gniazdo przysłony na posadzce (oś `x = -1,5` $\leftrightarrow$ oś `z = -1,9`):**
   - Pod osłoną w `(-1.5, 0, 0.9)` leży kwadratowe pole startowe (`floor_hazard`, `1,35 × 1,35 m`).
   - Od pola startowego `z = 0,9` prosto na północ do linii lasera `z = -1,9` biegną dwie równoległe **szyny prowadnicy toru osłony** (`floor_hazard` na `x = -2,25` i `x = -0,75`), a pośrodku między nimi w `(-1.5, 0, -0.5)` widnieje strzałka **`floor_arrow` (`yaw: 0`)** celująca prosto w wiązkę.
   - Dokładnie w miejscu, gdzie tor osłony przecina wiązkę lasera — w punkcie **`(-1.5, 0, -1.9)`** — namalowane jest kwadratowe **gniazdo przysłony optycznej (`floor_hazard`, `1,35 × 1,35 m`)**, w które wbiegają z obu stron wzdłuż osi `z = -1,9` podłużne pasy ostrzegawcze pod wiązką (`decals[5..6]`).
   - Jednocześnie na prawym pasie ruchu pieszego przed wiązką (`(1.1, 0, -1.35)`) znajduje się oznaczenie **`floor_stop`**, sygnalizujące zakaz wchodzenia bezpośrednio w aktywny promień, a za gniazdem przysłony druga strzałka **`floor_arrow` (`(-0.65, 0, -4.2)`, `yaw: -0.32`)** kieruje gracza ze ścieżki `x = -1,5` ukośnie w prawo do odblokowanych drzwi `exit` `(0, 1.5, -6.5)`.
3. **Architektoniczna rama mostu optycznego (`z = -2,55`) i obudowy emiterów (`z = -1,9`):**
   - Na obu ścianach bocznych dokładnie w osi wiązki (`x = ±4,91, z = -1,9`) zamontowane są pionowe stalowe koryta emiterów (`blocks[7..8]`), z których wystają świecące głowice `HazardView` (`x = ±4,694`).
   - Tuż za wiązką (`z = -2,55`, dzięki czemu filary nigdy nie zasłaniają emiterów `z = -1,9` z kamery gracza!) stoją dwie stalowe kolumny `pillar` (`blocks[9..10]`) podtrzymujące dwuteową belkę **mostu czujników optycznych (`blocks[11..13]`, `y = 4,06..4,39 m`)** i zawieszony pod nią sznur lampionów (`decor[0]`). Nawet w trakcie `1,5 s` przerwy w cyklu lub po wyłączeniu wiązki gracz widzi dokładną bramkę przestrzeni, którą kontroluje laser.
4. **Kierunkowe neony i wizualne sprzężenie z ryglem wyjścia (`signs[0..3]` + `blocks[14..18]`):**
   - Na zachodniej ścianie nad szynami osłony (`(-4.95, 2.55, -0.5)`) błękitny neon **`arrow`** (`#3d7bff`, `yaw: 1.5708`) wskazuje na północ (`-Z`) prosto w gniazdo przysłony na linii lasera.
   - Na północno-zachodniej ścianie (`(-2.5, 2.4, -5.95)`) drugi błękitny neon **`arrow`** (`#3d7bff`, `yaw: 0`) wskazuje w prawo (`+X`) na bramę `exit`.
   - Zgodnie z wnioskami wdrożeniowymi z `puzzlePlate.md` (sekcja 5 pkt 11 i 13) **nie umieszczamy nad zamkniętymi drzwiami statycznego napisu `OPEN` ani zielonego światła**, które fałszywie sugerowałyby otwarte przejście przed rozwiązaniem zagadki. Zamiast tego północne nadproże `blocks[14]` ma dwie pionowe, jasne kontrolki rygla optycznego (`blocks[17..18]`, `material: "light_white"`), nad napędem śluzy `blocks[16]` unosi się błękitny hologram strażnika **`holo_android`** (`#3d7bff`), a strefę przed wyjściem oświetla chłodny błękit królewski (`lights[1]`, `#3d7bff`). Dopiero przecięcie wiązki osłoną zapala jedyną zieleń w pokoju — `neon_green` (`#6dff4a`) na samej osłonie — gasi wiązkę i otwiera skrzydło drzwi.

### Różnica wobec `puzzlePlate` (*Śluza wagowa Kurogane Arms*)

| Cecha | `puzzlePlate` (*Śluza wagowa Kurogane Arms*) | `puzzleLaser` (*Blokada fotonowa*) |
| --- | --- | --- |
| **Tożsamość i miejsce w świecie** | Zewnętrzny dok przeładunkowy i automatyczna śluza wagowa na zapleczu magazynów towarowych Kurogane Arms. | Kanał kalibracji optoelektronicznej i korytarz bariery fotonowej w skrzydle cybernetyki / czujników Kurogane. |
| **Mechanika zagadki i zagrożenia** | Brak zagrożeń (`hazards: []`). Ustawienie skrzyni (`24 kg`) w płaskim pierścieniu płyty naciskowej `(0, 0, -2.1)` na osi środka pokoju. | Aktywne zagrożenie `laser_gate` (`inspectionBeam`, `25 dmg`, `z = -1.9`). Wsunięcie wysokiej osłony (`28 kg`, `wys. 1,1 m`) po bocznym torze `x = -1.5` w poprzek wiązki, by przerwać obwód optyczny. |
| **Paleta barwna i klimat świetlny** | Dominacja **ciepłego bursztynu (`#ffae1a`) i ciepłej bieli (`#fff1d6`)** na ciemnym asfalcie; zielony szyld `repair`. | Dominacja **chłodnego błękitu królewskiego (`#3d7bff`) i elektrycznego fioletu (`#8a5cff`)** budujących maksymalny kontrast dla gorącej, biało-bursztynowej wiązki lasera (`#fff1d6` / `#ffb84d`). |
| **Pogoda i materiały powierzchni** | `"weather": "rain"` (pionowa ulewa); podłoga `asphalt`, wszystkie ściany `concrete`, dachy `corrugated`. | `"weather": "drizzleWind"` (skośna mżawka z porywistym wiatrem `10 m/s`); podłoga z płyt `paving`, boczne ściany pancerne `metal`, ściany czołowe `overpass_concrete`, dachy techniczne `roof_hvac_metal`. |
| **Układ architektoniczny i dachy** | **Symetryczny:** dwa identyczne, 8-metrowe dachy boczne po obu stronach (`x = ±3.9, z = -1.2`), bramownica w osi `z = -2.1`, gracz przesunięty na `x = -2.1`. | **Asymetryczny (przekątniowy):** okap stanowiska osłon na południowym zachodzie (`z ∈ [-0.5, 4.7]`) i okap budki odbiornika na północnym wschodzie (`z ∈ [-6.0, -3.0]`), z **całkowicie odkrytym kanałem lasera `z = -1.9`** na całej szerokości pokoju. |
| **Rekwizyty (`blocks` z modelami) i hologramy** | Palety skrzyń `city_crates`, kontener na odpady `city_dumpster`, roleta `city_shutter`, korporacyjne logo `holo_kurogane`. | Szafa kondensatorów `city_vending`, generator emiterów `city_generator`, terminal odbiorczy `city_kiosk`, dok osłony `cover_low`, zapora balistyczna `city_barrier`, fioletowy szyld `implants` i hologram strażnika `holo_android`. |

---

## 3. Plan zmian dla programisty

Plan obejmuje **22 zmiany w danych JSON** w pliku [src/data/rooms/puzzleLaser.json](file:///D:/AgenticProProjects/neoryder-maps/src/data/rooms/puzzleLaser.json), uporządkowane od najważniejszych (pogoda i materiały bazowe $\rightarrow$ obudowy emiterów, most optyczny, nadproża i asymetryczne okapy $\rightarrow$ kolizyjne modele aparatury i zabudowa `facade` $\rightarrow$ kalkomanie toru osłony i linii lasera $\rightarrow$ kontrastowe oświetlenie, szyldy, kable/lampiony i efekty `ambientFx`).

- **Elementy zachowane bez zmian (100% kompatybilności z mechaniką i testami):**
  - `id: "puzzleLaser"`, `name: "Blokada fotonowa"`, `type: "puzzle"`, `theme: "neonStreet"`,
  - `playerSpawn: { "x": 0, "y": 0, "z": 4 }`, `spawnPoints: []`,
  - `doors[0]` (`entry` w `(0, 1.5, 6.5)`) oraz `doors[1]` (`exit` w `(0, 1.5, -6.5)`),
  - `hazards[0]` (`kind: "laser_gate"`, `id: "inspectionBeam"`, `from: (-4.8, 0.65, -1.9)`, `to: (4.8, 0.65, -1.9)`, `cycle: { onS: 12, offS: 1.5, offsetS: 1.5 }`),
  - `puzzle` (`kind: "laser"`, `object.position: (-1.5, 0.55, 0.9)`, `object.size: (0.9, 1.1, 0.9)`, `object.massKg: 28`, `laserId: "inspectionBeam"`),
  - wymiary i pozycje `blocks[0..6]` (podłoga `12 × 1 × 14 m` oraz 6 ścian obwodowych `wall`).
- **Zgodność z walidatorami:** cały układ docelowy został zweryfikowany przez `loadRoom` (`roomSchema.ts`), `wallDecalFitsBlock` (`dressingSchema.ts`) oraz `auditMap` (`mapAudit.ts`) — daje wynik **`0 error, 0 warn`** (znikają wszystkie 3 ostrzeżenia `emptyRoom`). Tor przesuwania osłony `x = -1,5` (`z ∈ [-3.5, 4.5]`) oraz centralny korytarz przejścia `x ∈ [-3.3, 3.4]` są całkowicie wolne od przeszkód.

### Priorytet 1 — Profil pogody, materiały bazowe, obudowy emiterów, most optyczny i zadaszenia (`weather`, `blocks[0..20]`, `rainShelters`)

1. **Pole główne `"weather"` oraz materiały bazowe podłogi i ścian `blocks[0..6]` — odróżnienie materiałowe od `puzzlePlate`:**
   - **Ścieżki JSON:** główny obiekt `src/data/rooms/puzzleLaser.json` oraz `blocks[0..6].material`.
   - **Co zrobić:**
     - Dodaj w głównym obiekcie (obok `"theme": "neonStreet"`): `"weather": "drizzleWind"`.
     - W `blocks[0]` (podłoga `12 × 1 × 14 m`) zmień `"material"` z `"concrete"` na **`"paving"`**.
     - W `blocks[1]` i `blocks[2]` (ściany boczne zachód/wschód `1 × 4 × 14 m`) zmień `"material"` z `"trim"` na **`"metal"`**.
     - W `blocks[3]`, `blocks[4]`, `blocks[5]`, `blocks[6]` (ściany czołowe północ/południe `5 × 4 × 1 m`) zmień `"material"` z `"trim"` na **`"overpass_concrete"`**.
   - **Uzasadnienie:** Profil `drizzleWind` wprowadza skośne smugi mżawki gnane porywistym wiatrem (`10 m/s`), szum wiatru (`gain: 0.7`) i umiarkowany połysk mokrej nawierzchni (`reflections: 0.65`), a ciemne stalowe ściany `metal` (`#435169`) i posadzka z płyt `paving` zastępują jasnoszary `trim`, dając ciemne, techniczne tło pod kontrast z wiązką lasera.

2. **Nowe bloki `blocks[7..8]` (pionowe stalowe obudowy ścienne emiterów lasera na `x = ±4.91, z = -1.9`):**
   - **Ścieżki JSON:** `blocks[7]`, `blocks[8]`.
   - **Co zrobić:** Dodaj po `blocks[6]` dwa stalowe piony aparaturowe przylegające do wewnętrznych lic ścian `blocks[1..2]` dokładnie w osi wiązki `z = -1.9`:
     - `blocks[7]` (obudowa zachodniego emitera):
       `{ "size": { "x": 0.18, "y": 4, "z": 0.4 }, "position": { "x": -4.91, "y": 2, "z": -1.9 }, "material": "metal" }`
     - `blocks[8]` (obudowa wschodniego emitera):
       `{ "size": { "x": 0.18, "y": 4, "z": 0.4 }, "position": { "x": 4.91, "y": 2, "z": -1.9 }, "material": "metal" }`
   - **Uzasadnienie:** Głowice emiterów z `HazardView` mają środek w `(±4.8, 0.65, -1.9)` i obrys `x ∈ [±4.7, ±4.9]` ze świecącą soczewką na `x = ±4.694`. Obudowy `x ∈ [±4.82, ±5.0]` osadzają tylną część głowic w stalowym pionie kablowym na ścianie, pozostawiając przednią część głowicy i świecącą soczewkę (`x = ±4.694`) w pełni odsłoniętą.

3. **Nowe bloki `blocks[9..13]` (2 stalowe filary `pillar` i trójczłonowy dwuteownik mostu czujników optycznych na `z = -2.55`):**
   - **Ścieżki JSON:** `blocks[9]`, `blocks[10]`, `blocks[11]`, `blocks[12]`, `blocks[13]`.
   - **Co zrobić:** Dodaj konstrukcję mostu optycznego przesuniętą o `0,65 m` na północ za linię wiązki (`z = -2.55`, stykającą się z obudowami emiterów na `z = -2.1` bez przenikania):
     - `blocks[9]` (filar zachodni):
       `{ "size": { "x": 0.9, "y": 4, "z": 0.9 }, "position": { "x": -4.55, "y": 2, "z": -2.55 }, "material": "metal", "model": "pillar" }`
     - `blocks[10]` (filar wschodni):
       `{ "size": { "x": 0.9, "y": 4, "z": 0.9 }, "position": { "x": 4.55, "y": 2, "z": -2.55 }, "material": "metal", "model": "pillar" }`
     - `blocks[11]` (dolna półka dwuteownika mostu):
       `{ "size": { "x": 10, "y": 0.12, "z": 0.6 }, "position": { "x": 0, "y": 4.06, "z": -2.55 }, "material": "metal" }`
     - `blocks[12]` (środnik dwuteownika mostu):
       `{ "size": { "x": 10, "y": 0.21, "z": 0.24 }, "position": { "x": 0, "y": 4.225, "z": -2.55 }, "material": "metal" }`
     - `blocks[13]` (górna półka dwuteownika mostu):
       `{ "size": { "x": 10, "y": 0.12, "z": 0.6 }, "position": { "x": 0, "y": 4.39, "z": -2.55 }, "material": "metal" }`
   - **Uzasadnienie:** Ponieważ filary stoją na `z = -2.55` (za wiązką `z = -1.9`), z kamery gracza na `(0, 1.65, 4)` oba emitery i cała długość wiązki `x ∈ [-4.8, 4.8]` znajdują się **przed filarami** i nie są przez nie przesłonięte w żadnym promieniu, a na ujęciu z góry (`10-top.png`) belka na `z = -2.55` nie przykrywa wiązki `z = -1.9`.

4. **Nowe bloki `blocks[14..18]` (stalowe nadproża śluz `exit`/`entry`, obudowa napędu rygla i 2 świetlne kontrolki blokady optycznej):**
   - **Ścieżki JSON:** `blocks[14]`, `blocks[15]`, `blocks[16]`, `blocks[17]`, `blocks[18]`.
   - **Co zrobić:** Dodaj:
     - `blocks[14]` (nadproże północnych drzwi `exit`):
       `{ "size": { "x": 2, "y": 1, "z": 1 }, "position": { "x": 0, "y": 3.5, "z": -6.5 }, "material": "metal" }`
     - `blocks[15]` (nadproże południowych drzwi `entry`):
       `{ "size": { "x": 2, "y": 1, "z": 1 }, "position": { "x": 0, "y": 3.5, "z": 6.5 }, "material": "metal" }`
     - `blocks[16]` (obudowa napędu śluzy nad północnym nadprożem — podstawa pod projektor `decor[3]` na `y = 5.6 m`):
       `{ "size": { "x": 1.35, "y": 1.6, "z": 0.85 }, "position": { "x": 0, "y": 4.8, "z": -6.5 }, "material": "metal" }`
     - `blocks[17]` (lewa pionowa kontrolka rygla optycznego na licu północnego nadproża):
       `{ "size": { "x": 0.12, "y": 0.58, "z": 0.06 }, "position": { "x": -0.78, "y": 3.52, "z": -5.98 }, "material": "light_white" }`
     - `blocks[18]` (prawa pionowa kontrolka rygla optycznego na licu północnego nadproża):
       `{ "size": { "x": 0.12, "y": 0.58, "z": 0.06 }, "position": { "x": 0.78, "y": 3.52, "z": -5.98 }, "material": "light_white" }`
   - **Uzasadnienie:** Zamyka 1-metrowe szpary nad drzwiami (`y ∈ [3, 4]`), vynosi projektor hologramu ponad poziom belki mostu optycznego i oznacza portal wyjściowy dwiema jasnymi kontrolkami `light_white` (`#fff1d6`) bez fałszywego zielonego napisu `OPEN` nad zamkniętą grodzią.

5. **Nowe bloki `blocks[19..20]` (2 asymetryczne, przekątniowe okapy `roof_hvac_metal`) + tablica `rainShelters[0..1]`:**
   - **Ścieżki JSON:** `blocks[19]`, `blocks[20]` oraz pole główne `rainShelters`.
   - **Co zrobić:** Dodaj dwa mijające się zadaszenia po przeciwnych stronach linii lasera (`z = -1.9` pozostaje całkowicie odkryte na całej szerokości pokoju!):
     - `blocks[19]` (południowo-zachodni okap stanowiska osłon kalibracyjnych, `z ∈ [-0.5, 4.7]`):
       `{ "size": { "x": 2.1, "y": 0.24, "z": 5.2 }, "position": { "x": -3.95, "y": 3.72, "z": 2.1 }, "material": "roof_hvac_metal" }`
     - `blocks[20]` (północno-wschodni okap budki terminala odbiorczego za mostem optycznym, `z ∈ [-6.0, -3.0]`):
       `{ "size": { "x": 2.2, "y": 0.24, "z": 3.0 }, "position": { "x": 3.9, "y": 3.72, "z": -4.5 }, "material": "roof_hvac_metal" }`
     oraz dodaj tablicę `rainShelters`:
     ```json
     "rainShelters": [
       { "position": { "x": -3.95, "y": 1.92, "z": 2.1 }, "size": { "x": 2.1, "y": 3.84, "z": 5.2 } },
       { "position": { "x": 3.9, "y": 1.92, "z": -4.5 }, "size": { "x": 2.2, "y": 3.84, "z": 3.0 } }
     ]
     ```
   - **Uzasadnienie:** Tworzy wyraźnie odmienną od `puzzlePlate` przekątniową kompozycję dachów (`SW` + `NE`), chroni przed mżawką stanowisko osłon i budkę terminala, a dzięki przerwie `z ∈ [-3.0, -0.5]` **cała 9,6-metrowa wiązka lasera na `z = -1.9` jest w 100% widoczna z góry na `10-top.png`, `08-high-west.png` i `09-high-east.png`**.

### Priorytet 2 — Kolizyjne modele aparatury fotonowej (`blocks[21..25]`) i zabudowa wysokiego planu (`blocks[26..35]`)

6. **Nowe bloki `blocks[21..23]` (terminal odbiorczy `city_kiosk`, zasilacz lasera `city_generator` i szafa kondensatorów `city_vending` przy wschodnim murze):**
   - **Ścieżki JSON:** `blocks[21]`, `blocks[22]`, `blocks[23]`.
   - **Co zrobić:** Dodaj trzy kolizyjne modele o dokładnych wymiarach AABB z `mapModelBounds.json`, dosunięte plecami do wschodniego muru (`x = 5.0`):
     - `blocks[21]` (terminal odbiornika optycznego pod północno-wschodnim okapem):
       `{ "size": { "x": 0.8, "y": 2.235, "z": 0.6238 }, "position": { "x": 4.6, "y": 1.1175, "z": -4.2 }, "material": "metal", "model": "city_kiosk" }`
     - `blocks[22]` (agregat zasilający wschodni emiter lasera, `0,85 m` na południe od emitera `z = -1.9`):
       `{ "size": { "x": 1.6, "y": 1.4, "z": 1.005 }, "position": { "x": 4.2, "y": 0.7, "z": -0.55 }, "material": "metal", "model": "city_generator" }`
     - `blocks[23]` (szafa kondensatorów i chłodzenia z ekranami diagnostycznymi):
       `{ "size": { "x": 1.014, "y": 2, "z": 0.816 }, "position": { "x": 4.493, "y": 1, "z": 2.3 }, "material": "metal", "model": "city_vending" }`
   - **Uzasadnienie:** Buduje na wschodniej ścianie (`03-east.png`, `01-spawn.png`) kompletną linię technologiczną bramki fotonowej: szafa kondensatorów (`z = 2.3`) $\rightarrow$ agregat mocy (`z = -0.55`) $\rightarrow$ wschodni emiter (`z = -1.9`) $\rightarrow$ terminal odbiorczy rygla (`z = -4.2`). Wszystkie trzy modele przylegają do muru `x = 5.0` bez martwych szczelin.

7. **Nowe bloki `blocks[24..25]` (stacjonarny dok osłony `cover_low` w osi `z = 0.9` oraz zapora przeciwodłamkowa `city_barrier` pod południowo-zachodnim okapem):**
   - **Ścieżki JSON:** `blocks[24]`, `blocks[25]`.
   - **Co zrobić:** Dodaj po zachodniej stronie pokoju dwa modele tłumaczące pochodzenie mobilnej osłony (bez powtarzania skrzyń `city_crates` i śmietnika `city_dumpster` z `puzzlePlate`):
     - `blocks[24]` (zapasowy blok tłumika/osłony w doku pod zachodnim murem, dokładnie na wysokości `z = 0.9` mobilnej osłony):
       `{ "size": { "x": 1.1, "y": 1.1, "z": 1.4 }, "position": { "x": -4.45, "y": 0.55, "z": 0.9 }, "material": "trim", "model": "cover_low" }`
     - `blocks[25]` (betonowo-stalowa zapora balistyczna z pasami ostrzegawczymi w narożniku południowo-zachodnim):
       `{ "size": { "x": 2, "y": 0.9288, "z": 0.51 }, "position": { "x": -4, "y": 0.4644, "z": 5.745 }, "material": "metal", "model": "city_barrier" }`
   - **Uzasadnienie:** Zapasowy blok `cover_low` (`wys. 1,1 m`, materiał `trim`) przy ścianie na `z = 0.9` wizualnie odpowiada mobilnej osłonie (`wys. 1,1 m` w `(-1.5, 0.55, 0.9)`), zostawiając między sobą a osłoną `1,95 m` czystego obejścia (`x ∈ [-3.9, -1.95]`).

8. **Nowe bloki `blocks[26..35]` (6 wysokich budynków `facade` wokół murów oraz 4 bryły domykające portale północ/południe):**
   - **Ścieżki JSON:** `blocks[26]`..`blocks[35]`.
   - **Co zrobić:** Dodaj 6 budynków `facade` (`wysokość 15–21 m`) przylegających do zewnętrznych lic murów (`x = ±6,0 m`, `z = ±7,0 m`) oraz osłony nad portalami drzwi `exit` i `entry`:
     - `blocks[26]` (zachód): `{ "size": { "x": 6, "y": 18, "z": 14 }, "position": { "x": -9, "y": 9, "z": 0 }, "material": "facade" }`
     - `blocks[27]` (wschód): `{ "size": { "x": 6, "y": 16, "z": 14 }, "position": { "x": 9, "y": 8, "z": 0 }, "material": "facade" }`
     - `blocks[28]` (północ-zachód): `{ "size": { "x": 7, "y": 19, "z": 6 }, "position": { "x": -5.5, "y": 9.5, "z": -10 }, "material": "facade" }`
     - `blocks[29]` (północ-wschód): `{ "size": { "x": 7, "y": 21, "z": 6 }, "position": { "x": 5.5, "y": 10.5, "z": -10 }, "material": "facade" }`
     - `blocks[30]` (południe-zachód): `{ "size": { "x": 7, "y": 17, "z": 6 }, "position": { "x": -5.5, "y": 8.5, "z": 10 }, "material": "facade" }`
     - `blocks[31]` (południe-wschód): `{ "size": { "x": 7, "y": 15, "z": 6 }, "position": { "x": 5.5, "y": 7.5, "z": 10 }, "material": "facade" }`
     - `blocks[32]` (okap za nadprożem północnym): `{ "size": { "x": 4, "y": 1, "z": 1.6 }, "position": { "x": 0, "y": 3.5, "z": -7.8 }, "material": "corrugated" }`
     - `blocks[33]` (łącznik fasady nad bramą północną): `{ "size": { "x": 4, "y": 12, "z": 0.5 }, "position": { "x": 0, "y": 10, "z": -8.85 }, "material": "facade" }`
     - `blocks[34]` (okap za nadprożem południowym): `{ "size": { "x": 4, "y": 1, "z": 1.6 }, "position": { "x": 0, "y": 3.5, "z": 7.8 }, "material": "corrugated" }`
     - `blocks[35]` (łącznik fasady nad bramą południową): `{ "size": { "x": 4, "y": 12, "z": 0.5 }, "position": { "x": 0, "y": 10, "z": 8.85 }, "material": "facade" }`
   - **Uzasadnienie:** Osadza korytarz w kanionie miejskim Neon Noir na ujęciach `08-high-west.png`, `09-high-east.png` i `10-top.png`, daje ściany nośne `x = ±6,0 m` dla kabli `city_cable_span` oraz uniemożliwia przeskoczenie górą nad zamkniętą bramą `exit`.

### Priorytet 3 — Kalkomanie bezsłownej instrukcji zagadki na posadzce i detale ścian (`decals[0..13]`)

9. **Nowe wpisy `decals[0..4]` — gniazdo przysłony na wiązce `(-1.5, 0, -1.9)`, pole startowe osłony `(-1.5, 0, 0.9)`, dwie strzałki `floor_arrow` i blokada pasa pieszego `floor_stop`:**
   - **Ścieżki JSON:** `decals[0]`..`decals[4]`.
   - **Co zrobić:** Utwórz tablicę `decals` i dodaj pięć głównych oznaczeń instruktażowych:
     - `decals[0]` (gniazdo rygla optycznego dokładnie na przecięciu toru osłony `x = -1.5` z wiązką lasera `z = -1.9`):
       `{ "texture": "floor_hazard", "position": { "x": -1.5, "y": 0, "z": -1.9 }, "size": { "w": 1.35, "h": 1.35 }, "yaw": 0, "surface": "floor", "opacity": 0.78 }`
     - `decals[1]` (pole startowe pod osłoną `(-1.5, 0.55, 0.9)`):
       `{ "texture": "floor_hazard", "position": { "x": -1.5, "y": 0, "z": 0.9 }, "size": { "w": 1.35, "h": 1.35 }, "yaw": 0, "surface": "floor", "opacity": 0.58 }`
     - `decals[2]` (główna strzałka prowadząca osłonę z `z = 0.9` prosto w gniazdo na wiązce `z = -1.9`, `yaw: 0` = północ `-Z`):
       `{ "texture": "floor_arrow", "position": { "x": -1.5, "y": 0, "z": -0.5 }, "size": { "w": 0.95, "h": 1.35 }, "yaw": 0, "surface": "floor", "opacity": 0.85 }`
     - `decals[3]` (druga strzałka za wiązką kierująca z gniazda przysłony do północnej bramy `exit`):
       `{ "texture": "floor_arrow", "position": { "x": -0.65, "y": 0, "z": -4.2 }, "size": { "w": 0.78, "h": 1.25 }, "yaw": -0.32, "surface": "floor", "opacity": 0.72 }`
     - `decals[4]` (linia zatrzymania `floor_stop` na prawym pasie ruchu przed aktywną wiązką):
       `{ "texture": "floor_stop", "position": { "x": 1.1, "y": 0, "z": -1.35 }, "size": { "w": 2.2, "h": 0.65 }, "yaw": 0, "surface": "floor", "opacity": 0.66 }`
   - **Uzasadnienie:** Tłumaczy całą mechanikę bez jednego słowa: prawy pas przed wiązką ma znak zatrzymania `floor_stop`, natomiast lewy pas `x = -1.5` prowadzi strzałką od osłony prosto w kwadratowe gniazdo na linii wiązki `(-1.5, 0, -1.9)` i dalej drugą strzałką do bramy wyjściowej.

10. **Nowe wpisy `decals[5..8]` — pasy ostrzegawcze pod całą wiązką lasera (`z = -1.9`) oraz dwie równoległe szyny toru osłony (`x = -2.25` i `x = -0.75`):**
    - **Ścieżki JSON:** `decals[5]`..`decals[8]`.
    - **Co zrobić:** Dodaj:
      - `decals[5]` (pas pod wschodnią częścią wiązki lasera `x ∈ [-0.65, 3.95], z = -1.9`):
        `{ "texture": "floor_hazard", "position": { "x": 1.65, "y": 0, "z": -1.9 }, "size": { "w": 4.6, "h": 0.14 }, "yaw": 0, "surface": "floor", "opacity": 0.62 }`
      - `decals[6]` (pas pod zachodnią częścią wiązki lasera `x ∈ [-4.5, -2.4], z = -1.9`):
        `{ "texture": "floor_hazard", "position": { "x": -3.45, "y": 0, "z": -1.9 }, "size": { "w": 2.1, "h": 0.14 }, "yaw": 0, "surface": "floor", "opacity": 0.62 }`
      - `decals[7]` (lewa szyna toru osłony `x = -2.25, z ∈ [-2.3, 1.3]`):
        `{ "texture": "floor_hazard", "position": { "x": -2.25, "y": 0, "z": -0.5 }, "size": { "w": 3.6, "h": 0.095 }, "yaw": 1.5707963267948966, "surface": "floor", "opacity": 0.5 }`
      - `decals[8]` (prawa szyna toru osłony `x = -0.75, z ∈ [-2.3, 1.3]`):
        `{ "texture": "floor_hazard", "position": { "x": -0.75, "y": 0, "z": -0.5 }, "size": { "w": 3.6, "h": 0.095 }, "yaw": 1.5707963267948966, "surface": "floor", "opacity": 0.5 }`
    - **Uzasadnienie:** Pasy `decals[5..6]` wyznaczają na podłodze dokładny przebieg promienia `z = -1.9` (dzięki czemu oś zagrożenia pozostaje widoczna również w 1,5-sekundowej fazie `off` oraz po przecięciu wiązki), a szyny `decals[7..8]` obramowują korytarz ruchu osłony `x = -1.5`.

11. **Nowe wpisy `decals[9..13]` — 2 kałuże refleksyjne na odkrytej części posadzki oraz zacieki i plakat na ścianach (zgodne z `wallDecalFitsBlock`):**
    - **Ścieżki JSON:** `decals[9]`..`decals[13]`.
    - **Co zrobić:** Dodaj:
      - `decals[9]` (kałuża za linią lasera odbijająca błękitne światło wyjścia i wiązkę):
        `{ "texture": "puddle1", "position": { "x": 1.3, "y": 0, "z": -3.5 }, "size": { "w": 1.3, "h": 0.95 }, "yaw": 0.35, "surface": "floor", "opacity": 0.68 }`
      - `decals[10]` (kałuża przed linią lasera po prawej stronie):
        `{ "texture": "puddle2", "position": { "x": 1.4, "y": 0, "z": 2.2 }, "size": { "w": 1.45, "h": 1.1 }, "yaw": 0.85, "surface": "floor", "opacity": 0.66 }`
      - `decals[11]` (zaciek na odkrytej północno-zachodniej części muru `blocks[1]`):
        `{ "texture": "leak_streak", "position": { "x": -5, "y": 2.05, "z": -4.3 }, "size": { "w": 1.4, "h": 2.2 }, "yaw": 1.5708, "surface": "wall", "opacity": 0.62 }`
      - `decals[12]` (zaciek na odkrytej południowo-wschodniej części muru `blocks[2]`):
        `{ "texture": "leak_streak", "position": { "x": 5, "y": 2.05, "z": 4.1 }, "size": { "w": 1.4, "h": 2.2 }, "yaw": -1.5708, "surface": "wall", "opacity": 0.62 }`
      - `decals[13]` (plakat techniczny na ścianie północno-wschodniej `blocks[4]` obok terminala odbiorczego):
        `{ "texture": "poster_torn3", "position": { "x": 3.5, "y": 1.65, "z": -6 }, "size": { "w": 0.95, "h": 0.95 }, "yaw": 0, "surface": "wall", "opacity": 0.74 }`
    - **Uzasadnienie:** Kałuże leżą w strefie odkrytej poza szynami osłony, a wszystkie 3 kalkomanie ścienne leżą na nieosłoniętych fragmentach ścian i przechodzą test `wallDecalFitsBlock` (`fits: true`).

### Priorytet 4 — Kontrastowe oświetlenie punktowe (`lights[0..5]`) i szyldy/hologram (`signs[0..3]`)

12. **Nowe wpisy `lights[0..2]` — światła osi zagadki (ciepła biel `#fff1d6` nad osłoną $\rightarrow$ chłodny błękit `#3d7bff` i fiolet `#8a5cff` za wiązką lasera):**
    - **Ścieżki JSON:** `lights[0]`, `lights[1]`, `lights[2]`.
    - **Co zrobić:** Utwórz tablicę `lights` i dodaj trzy źródła główne z `"groundGlow": false`:
      - `lights[0]` (ciepła biel bezpośrednio nad osłoną startową `(-1.5, 0.55, 0.9)`):
        `{ "position": { "x": -1.5, "y": 3.35, "z": 1.1 }, "color": "#fff1d6", "intensity": 11, "range": 7.5, "groundGlow": false }`
      - `lights[1]` (błękit królewski za wiązką lasera, oświetlający północną śluzę `exit`):
        `{ "position": { "x": 0, "y": 3.1, "z": -4.4 }, "color": "#3d7bff", "intensity": 11, "range": 8, "groundGlow": false }`
      - `lights[2]` (fiolet w północno-zachodniej strefie za gniazdem przysłony):
        `{ "position": { "x": -3.4, "y": 3, "z": -3.2 }, "color": "#8a5cff", "intensity": 8, "range": 6.5, "groundGlow": false }`
    - **Uzasadnienie:** `lights[0]` wydobywa jasną bryłę osłony na pierwszym planie po lewej stronie, natomiast `lights[1]` i `lights[2]` tworzą za linią `z = -1.9` chłodne, błękitno-fioletowe tło, na którym gorąca biało-bursztynowa wiązka lasera (`#fff1d6` / `#ffb84d`) uzyskuje maksymalny kontrast i czytelność zagrożenia (oraz wydobywa z cienia drzwi `exit`).

13. **Nowe wpisy `lights[3..5]` — oświetlenie wschodniej sekcji zasilania lasera, budki odbiornika i południowego wejścia:**
    - **Ścieżki JSON:** `lights[3]`, `lights[4]`, `lights[5]`.
    - **Co zrobić:** Dodaj trzy światła dopełniające (łącznie 6 świateł punktowych w pokoju — poniżej limitu 8 źródeł z `ADR 0006` pkt 7):
      - `lights[3]` (fiolet nad agregatem lasera `city_generator` i szafą `city_vending` przy wschodnim murze):
        `{ "position": { "x": 3.8, "y": 3, "z": -0.8 }, "color": "#8a5cff", "intensity": 8, "range": 6.5, "groundGlow": false }`
      - `lights[4]` (błękit pod północno-wschodnim okapem nad terminalem `city_kiosk`):
        `{ "position": { "x": 3.8, "y": 2.95, "z": -4.1 }, "color": "#3d7bff", "intensity": 7, "range": 6, "groundGlow": false }`
      - `lights[5]` (błękit przy południowej bramie wejściowej `entry`):
        `{ "position": { "x": 0.8, "y": 2.95, "z": 5.2 }, "color": "#3d7bff", "intensity": 7, "range": 6.5, "groundGlow": false }`
    - **Uzasadnienie:** Utrzymuje spójną, chłodną paletę optoelektroniczną (`#3d7bff` / `#8a5cff`) wyraźnie inną od ciepło-bursztynowego `puzzlePlate`.

14. **Nowe wpisy `signs[0..1]` — dwa błękitne drogowskazy neonowe `arrow` (`#3d7bff`) prowadzące wzdłuż toru osłony i do wyjścia:**
    - **Ścieżki JSON:** `signs[0]`, `signs[1]`.
    - **Co zrobić:** Utwórz tablicę `signs` i dodaj:
      - `signs[0]` (na ścianie zachodniej `blocks[1]` nad torem osłony, `yaw: 1.5708` — wskazuje na północ `-Z` w gniazdo przysłony na wiązce):
        `{ "kind": "neon", "texture": "arrow", "position": { "x": -4.95, "y": 2.55, "z": -0.5 }, "size": { "w": 1.65, "h": 0.68 }, "yaw": 1.5708, "tint": "#3d7bff", "flicker": 0.04 }`
      - `signs[1]` (na ścianie północno-zachodniej `blocks[3]`, `yaw: 0` — wskazuje w prawo `+X` na bramę `exit`):
        `{ "kind": "neon", "texture": "arrow", "position": { "x": -2.5, "y": 2.4, "z": -5.95 }, "size": { "w": 1.5, "h": 0.64 }, "yaw": 0, "tint": "#3d7bff", "flicker": 0.04 }`
    - **Uzasadnienie:** Tint `#3d7bff` jest zgodny z błękitnymi pikselami tekstury `arrow.webp` (mnożenie kolorów w shaderze `SignRenderer` daje czysty, jasny grot), a obie strzałki dublują na wysokości wzroku instrukcję z posadzki.

15. **Nowe wpisy `signs[2..3]` — fioletowy neon sekcji cybernetycznej `implants` nad zasilaczem lasera oraz hologram strażnika `holo_android` nad północną śluzą:**
    - **Ścieżki JSON:** `signs[2]`, `signs[3]`.
    - **Co zrobić:** Dodaj:
      - `signs[2]` (na ścianie wschodniej `blocks[2]` nad agregatem zasilającym emiter):
        `{ "kind": "neon", "texture": "implants", "position": { "x": 4.95, "y": 2.65, "z": -0.55 }, "size": { "w": 1.7, "h": 0.75 }, "yaw": -1.5708, "tint": "#8a5cff", "flicker": 0.05 }`
      - `signs[3]` (hologram strażnika optycznego wysoko nad napędem śluzy `blocks[16]`):
        `{ "kind": "holo", "texture": "holo_android", "position": { "x": 0, "y": 7.6, "z": -6.5 }, "size": { "w": 3.6, "h": 1.8 }, "yaw": 0, "tint": "#3d7bff", "flicker": 0.04 }`
    - **Uzasadnienie:** Zastępuje magazynowy szyld `repair` i logo `holo_kurogane` z `puzzlePlate` zestawem `implants` (`#8a5cff`) + `holo_android` (`#3d7bff`), podkreślając charakter automatycznej bariery kontrolnej skrzydła cybernetyki.

### Priorytet 5 — Lampiony, kable i dekoracje (`decor[0..11]`) ze współrzędnymi zaczepienia obu końców oraz efekty `ambientFx[0..4]`

16. **Nowy wpis `decor[0]` (sznur lampionów `city_lantern_string` pod mostem optycznym na `z = -2.55`) — oba końce zaczepione w filarach `blocks[9..10]`:**
    - **Ścieżka JSON:** `decor[0]`.
    - **Co zrobić:** Utwórz tablicę `decor` i dodaj:
      `{ "model": "city_lantern_string", "position": { "x": 0, "y": 3.55, "z": -2.55 }, "yaw": 0, "scale": 0.9 }`
    - **Współrzędne zaczepienia obu końców** (lokalne końce z `mapModelBounds.json`: `[-5, -0.14, 0.08]` i `[5, -0.14, 0.08]` przy `scale: 0.9, yaw: 0`):
      - koniec zachodni: **`(-4.50, 3.424, -2.478)`** — osadzony wewnątrz zachodniego filara mostu `blocks[9]` (`x ∈ [-5.0, -4.1], y ∈ [0, 4], z ∈ [-3.0, -2.1]`),
      - koniec wschodni: **`(4.50, 3.424, -2.478)`** — osadzony wewnątrz wschodniego filara mostu `blocks[10]` (`x ∈ [4.1, 5.0], y ∈ [0, 4], z ∈ [-3.0, -2.1]`).
    - **Uzasadnienie:** Zawiesza cztery punkty świetlne ze stożkami `LampCones` pod belką mostu optycznego (`z = -2.55`), wyznaczając w górnej części kadru płaszczyznę bramki bez zasłaniania hologramu `signs[3]`.

17. **Nowe wpisy `decor[1..2]` (2 przewody `city_cable_span` rozpięte między fasadami `blocks[26]` i `blocks[27]`) — oba końce zaczepione na licach `x = ±6,0 m`:**
    - **Ścieżki JSON:** `decor[1]`, `decor[2]`.
    - **Co zrobić:** Dodaj dwie wiązki kabli w skali `scale: 1.2` (`yaw: 0`, lokalne końce z `mapModelBounds.json`: `[-5, -0.06, -0.19]` i `[5, 0, -0.205]`):
      - `decor[1]` (kabel północny):
        `{ "model": "city_cable_span", "position": { "x": 0, "y": 9.6, "z": -3.2 }, "yaw": 0, "scale": 1.2 }`
        - koniec zachodni: **`(-6.00, 9.528, -3.428)`** — dokładnie na wschodnim licu zachodniej fasady `blocks[26]` (`x = -6.0, y ∈ [0, 18], z ∈ [-7, 7]`),
        - koniec wschodni: **`(6.00, 9.600, -3.446)`** — dokładnie na zachodnim licu wschodniej fasady `blocks[27]` (`x = 6.0, y ∈ [0, 16], z ∈ [-7, 7]`).
      - `decor[2]` (kabel południowy):
        `{ "model": "city_cable_span", "position": { "x": 0, "y": 10.4, "z": 2.2 }, "yaw": 0, "scale": 1.2 }`
        - koniec zachodni: **`(-6.00, 10.328, 1.972)`** — dokładnie na wschodnim licu zachodniej fasady `blocks[26]` (`x = -6.0, y ∈ [0, 18], z ∈ [-7, 7]`),
        - koniec wschodni: **`(6.00, 10.400, 1.954)`** — dokładnie na zachodnim licu wschodniej fasady `blocks[27]` (`x = 6.0, y ∈ [0, 16], z ∈ [-7, 7]`).
    - **Uzasadnienie:** Wszystkie 4 końce mają dokładny styk ze ścianami fasad (`0` ostrzeżeń `floatingObject`), a najniższy punkt zwisu `decor[1]` (`y = 8,28 m` na `z = -3,2`) rzutuje się z kamery spawnu `(0, 1.65, 4)` na płaszczyznę `z = -6,5` na wysokości `y = 11,31 m` — aż `2,81 m` powyżej górnej krawędzi hologramu `signs[3]` (`y_max = 8,5 m`).

18. **Nowy wpis `decor[3]` (projektor hologramu `city_holo_projector` na obudowie napędu śluzy `blocks[16]`):**
    - **Ścieżka JSON:** `decor[3]`.
    - **Co zrobić:** Dodaj:
      `{ "model": "city_holo_projector", "position": { "x": 0, "y": 5.6, "z": -6.5 }, "yaw": 0, "scale": 1.1 }`
    - **Uzasadnienie:** Spoczywa na górnej płaszczyźnie bloku `blocks[16]` (`y = 5,6 m`), a jego soczewka (`y = 5,82 m`) pokrywa się z dolnym wierzchołkiem stożka projekcyjnego hologramu `signs[3]` (`7,6 - 1,8 = 5,8 m`).

19. **Nowe wpisy `decor[4..5]` (drzwi techniczne `city_door` pod południowo-zachodnim okapem i roleta serwisowa `city_shutter` na wschodnim murze):**
    - **Ścieżki JSON:** `decor[4]`, `decor[5]`.
    - **Co zrobić:** Dodaj dwa modele ścienne `WALL_FIXTURES` (w odwrotnych rolach stron niż w `puzzlePlate`):
      - `decor[4]` (drzwi serwisowe za stanowiskiem osłon na ścianie zachodniej `blocks[1]`):
        `{ "model": "city_door", "position": { "x": -5, "y": 0, "z": 3.1 }, "yaw": 1.5708, "scale": 1 }`
      - `decor[5]` (roleta komory technicznej w południowo-wschodniej części ściany `blocks[2]`):
        `{ "model": "city_shutter", "position": { "x": 5, "y": 0, "z": 4.35 }, "yaw": -1.5708, "scale": 0.84 }`
    - **Uzasadnienie:** Wzbogaca boczne ściany w ujęciach `03-east.png` i `05-west.png` przy pełnym oparciu na murach `x = ±5,0 m`.

20. **Nowe wpisy `decor[6..7]` (2 kratki wentylacyjne `city_vent_grate` w posadzce poza torem osłony):**
    - **Ścieżki JSON:** `decor[6]`, `decor[7]`.
    - **Co zrobić:** Dodaj:
      - `decor[6]`: `{ "model": "city_vent_grate", "position": { "x": -3.1, "y": 0, "z": -4.2 }, "yaw": 0, "scale": 0.78 }`
      - `decor[7]`: `{ "model": "city_vent_grate", "position": { "x": 2.6, "y": 0, "z": 3.4 }, "yaw": 0, "scale": 0.78 }`
    - **Uzasadnienie:** Tworzy fizyczne wyloty dla emiterów pary `ambientFx[0..1]` z dala od szyn toru osłony `x = -1.5`. (Celowo nie dodajemy luźnych pachołków `city_traffic_cone`, aby osłona zagadki była jedynym ruchomym obiektem na podłodze).

21. **Nowe wpisy `decor[8..11]` (2 piony rur `city_pipe_run` i 2 klimatyzatory `city_ac_unit` na bocznych fasadach `blocks[26..27]`):**
    - **Ścieżki JSON:** `decor[8]`, `decor[9]`, `decor[10]`, `decor[11]`.
    - **Co zrobić:** Dodaj na licach fasad `x = ±6,0 m` powyżej korony murów (`y ≥ 4,0 m`):
      - `decor[8]`: `{ "model": "city_pipe_run", "position": { "x": -6, "y": 4, "z": -4.2 }, "yaw": 1.5708, "scale": 1.1 }`
      - `decor[9]`: `{ "model": "city_pipe_run", "position": { "x": 6, "y": 4, "z": 3.2 }, "yaw": -1.5708, "scale": 1.1 }`
      - `decor[10]`: `{ "model": "city_ac_unit", "position": { "x": -6, "y": 6.4, "z": 1.8 }, "yaw": 1.5708, "scale": 1.2 }`
      - `decor[11]`: `{ "model": "city_ac_unit", "position": { "x": 6, "y": 6.6, "z": -1.9 }, "yaw": -1.5708, "scale": 1.2 }`
    - **Uzasadnienie:** Podstawy rur spoczywają na koronie 4-metrowych ścian (`y = 4,0 m`) i przylegają do fasad `x = ±6,0 m`.

22. **Nowa tablica `ambientFx[0..4]` — para z kratek wentylacyjnych, iskry na obudowie wschodniego emitera lasera i kapanie z krawędzi obu okapów:**
    - **Ścieżka JSON:** `ambientFx[0..4]`.
    - **Co zrobić:** Dodaj 5 emiterów cząsteczkowych:
      ```json
      "ambientFx": [
        { "kind": "steam", "position": { "x": -3.1, "y": 0.039, "z": -4.2 }, "rate": 2.1 },
        { "kind": "steam", "position": { "x": 2.6, "y": 0.039, "z": 3.4 }, "rate": 2.1 },
        { "kind": "sparks", "position": { "x": 4.82, "y": 0.85, "z": -1.9 }, "rate": 0.5 },
        { "kind": "drip", "position": { "x": -2.9, "y": 3.6, "z": 2.1 }, "rate": 1.4 },
        { "kind": "drip", "position": { "x": 2.8, "y": 3.6, "z": -4.5 }, "rate": 1.4 }
      ]
      ```
    - **Uzasadnienie:** Emitery pary są odsunięte na boki (`x = -3.1` i `x = 2.6`), by nie przysłaniać widoku na wiązkę ani wyjście; iskry `sparks` sypią się bezpośrednio znad głowicy wschodniego emitera lasera `(4.82, 0.85, -1.9)` (dodatkowo przyciągając wzrok do źródła wiązki na `01-spawn.png` i `03-east.png`), a krople `drip` odrywają się z wewnętrznych krawędzi obu okapów (`x = -2.9, z = 2.1` oraz `x = 2.8, z = -4.5`).

---

### Wymagane zmiany kodu (analiza `RoomScene`, `HazardView` i opcjonalnego `workArea`)

1. **Brak wymaganych zmian w kodzie wykonawczym (`src/`) do wdrożenia powyższego planu JSON:**
   - `RoomScene`, `CityDressing`, `HazardSystem`, `HazardView`, `GrabPuzzle` i `GrabPuzzleView` **już w 100% obsługują** wszystkie pola i zasoby użyte w planie (`weather: "drizzleWind"`, materiały `paving`, `metal`, `overpass_concrete`, `roof_hvac_metal`, `light_white`, modele `pillar`, `cover_low`, `city_*`, `lights` z `groundGlow: false`, `signs`, `decals`, `decor`, `ambientFx`, `rainShelters`).
   - Kolor wiązki w [src/render/hazardView.ts](file:///D:/AgenticProProjects/neoryder-maps/src/render/hazardView.ts#L144-L145) (`#ffb84d` + `#fff1d6`) jest już zgodny z `ADR 0006` (brak czerwieni) i nie wymaga modyfikacji shadera — jego czytelność w `puzzleLaser` zapewnia zaprojektowany kontrast z chłodnym oświetleniem (`#3d7bff` / `#8a5cff`), ciemną posadzką `paving`, pasami `floor_hazard` pod wiązką i obudowami emiterów `blocks[7..8]`.
   - Wszystkie testy jednostkowe ([tests/unit/grabPuzzle.test.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/unit/grabPuzzle.test.ts) oraz [tests/unit/rooms.test.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/unit/rooms.test.ts)) przechodzą bez zmian w kodzie.

2. **Opcjonalne rozszerzenie kodu (ochrona przed zaklinowaniem osłony poza torem — `puzzle.workArea` dla `kind: "laser"`):**
   - W `puzzlePlate` ([src/world/roomSchema.ts](file:///D:/AgenticProProjects/neoryder-maps/src/world/roomSchema.ts#L161-L180) oraz [src/world/grabPuzzle.ts](file:///D:/AgenticProProjects/neoryder-maps/src/world/grabPuzzle.ts#L99-L120)) wdrożono opcjonalne pole `puzzle.workArea`, które automatycznie przywraca swobodną skrzynię na pole startowe, jeśli gracz rzuci ją Chwytem na dach okapu lub wciśnie głęboko pod ścianę.
   - Obecnie unia `grabPuzzleSchema` w `src/world/roomSchema.ts:175-179` oraz warunek `this.definition.kind === 'plate'` w `src/world/grabPuzzle.ts:100` ograniczają `workArea` wyłącznie do `kind: 'plate'`.
   - Jeśli zespół chce zapewnić w `puzzleLaser` identyczne odzyskiwanie osłony po jej wyrzuceniu poza tor (np. `workArea: { "kind": "box", "position": { "x": -0.6, "y": 1, "z": -0.5 }, "size": { "x": 5.2, "y": 4, "z": 9.2 } }`), wystarczy:
     1. dodać opcjonalne pole `workArea` do wariantu `kind: z.literal('laser')` w `src/world/roomSchema.ts:175-179` (oraz walidację w `validatePuzzle`, że `workArea` obejmuje `puzzle.object.position` i punkt przecięcia z odcinkiem `laser`),
     2. w `src/world/grabPuzzle.ts:100` usunąć zawężenie `this.definition.kind === 'plate' &&`, pozostawiając wspólny warunek `this.definition.workArea && this.body.isDynamic() && !insideLevelZone(this.position, this.definition.workArea)`.

---

## 4. Kryteria odbioru na zrzutach

Po wdrożeniu planu w `src/data/rooms/puzzleLaser.json`, uruchomieniu audytu `node tools/levels/mapAudit.mjs puzzleLaser` oraz wygenerowaniu serii 10 zrzutów `node tools/screens/mapAudit.mjs puzzleLaser --tag after` w `artifacts/maps/puzzleLaser/after/`:

1. **Walidacja automatyczna i testy (`mapAudit` + Vitest + Playwright):**
   - `node tools/levels/mapAudit.mjs puzzleLaser` zwraca **`0 error` i `0 warn`** (znikają wszystkie 3 ostrzeżenia `emptyRoom` dla `lights`, `decor` i `signs`; brak zgłoszeń `floatingObject`, `noCollisionLargeProp`, `overlap`, `outOfBounds` i `forbiddenColor`).
   - `npm run check` (w tym `tests/unit/grabPuzzle.test.ts`, `tests/unit/rooms.test.ts`, `tests/unit/mapAudit.test.ts`) oraz `npx playwright test tests/e2e/mapAudit.spec.ts` przechodzą na zielono.

2. **Widok ze spawnu (`01-spawn.png`) i widok na północ (`02-north.png`):**
   - **Czytelność wiązki lasera i kontrast ADR 0006:** gorąca, biało-bursztynowa wiązka `inspectionBeam` (`#fff1d6` / `#ffb84d` na `z = -1.9`, bez zakazanej czerwieni) ostro odcina się na tle chłodnego błękitu królewskiego (`#3d7bff`) i fioletu (`#8a5cff`) oświetlających północną część pokoju oraz ciemnej posadzki z płyt `paving`.
   - **Osadzenie emiterów i mostu optycznego:** oba końce wiązki na `x = ±4.8, z = -1.9` wychodzą ze stalowych obudów ściennych `blocks[7..8]` (z widocznymi iskrami `sparks` przy wschodnim emiterze), a tuż za wiązką (`z = -2.55`) wznosi się stalowy most czujników optycznych (`blocks[9..13]`) z czterema lampionami `city_lantern_string`, które nie zasłaniają emiterów ani wiązki.
   - **Bezsłowna instrukcja zagadki:** po lewej stronie w `(-1.5, 0.55, 0.9)` stoi wyraźnie doświetlona ciepłą bielą (`#fff1d6`) osłona na kwadratowym polu startowym, od którego dwie szyny `floor_hazard` i biała strzałka `floor_arrow` prowadzą prosto w kwadratowe gniazdo przysłony `(-1.5, 0, -1.9)` na osi wiązki. Po prawej stronie przed wiązką widać ostrzegawczy znak `floor_stop`, a za gniazdem przysłony drugą strzałkę `floor_arrow` wskazującą północne drzwi `exit`.
   - **Czytelne wyjście `exit`:** północne drzwi `(0, 1.5, -6.5)` są domknięte stalowym nadprożem `blocks[14]` z dwiema jasnymi kontrolkami rygla optycznego `light_white` (`blocks[17..18]`), oświetlone błękitnym reflektorem `lights[1]` (`#3d7bff`) i zwieńczone napędem `blocks[16]` z projektorem oraz błękitnym hologramem **`holo_android`** (`signs[3]`).

3. **Widoki boczne na wschód (`03-east.png`) i zachód (`05-west.png`):**
   - **Wyraźna różnica wobec `puzzlePlate`:** zamiast symetrycznych doków ze skrzyniami i roletą magazynową, ujęcie wschodnie (`03-east.png`) ukazuje **sekcję zasilania i odbioru wiązki fotonowej** na tle ciemnych stalowych ścian `metal`: szafę kondensatorów `city_vending` po prawej, agregat `city_generator` i fioletowy neon **`IMPLANTS`** (`#8a5cff`) przy wschodnim emiterze lasera oraz zadaszoną okapem `blocks[20]` budkę terminala odbiorczego `city_kiosk` po lewej.
   - Ujęcie zachodnie (`05-west.png`) ukazuje **zadaszone okapem `blocks[19]` stanowisko osłon kalibracyjnych**: drzwi techniczne `city_door`, zapasowy blok tłumika `cover_low` ustawiony przy ścianie w osi `z = 0.9`, błękitny neon strzałki `arrow` (`#3d7bff`) kierujący na północ ku wiązce oraz odkryty północno-zachodni odcinek ściany z zaciekiem `leak_streak`.

4. **Widok na południe (`04-south.png`) oraz ujęcia narożne (`06-corner-nw.png`, `07-corner-se.png`):**
   - Na `04-south.png` widać południową śluzę wejściową `entry` domkniętą stalowym nadprożem `blocks[15]` w błękitnym świetle `lights[5]` (`#3d7bff`), zaporę balistyczną `city_barrier` w narożniku południowo-zachodnim, roletę `city_shutter` po lewej i kałużę `puddle2`.
   - Na `06-corner-nw.png` i `07-corner-se.png` widać pełną geometryczną zależność między szynami toru osłony `x = -1.5`, linią wiązki `z = -1.9` z pasami `floor_hazard` i gniazdem rygla `(-1.5, 0, -1.9)`.

5. **Widoki pod kątem 35° i z góry (`08-high-west.png`, `09-high-east.png`, `10-top.png`):**
   - Korytarz jest otoczony ze wszystkich czterech stron wysokimi bryłami `facade` (`15–21 m`) z oświetlonymi oknami, rurami `city_pipe_run` i klimatyzatorami `city_ac_unit`, a przejścia nad nadprożami północ/południe są zamknięte bryłami `blocks[32..35]`.
   - Obie wiązki kabli `decor[1..2]` (`city_cable_span`, `scale: 1.2`) mają oba końce osadzone dokładnie na licach fasad `x = ±6,0 m`, a sznur lampionów `decor[0]` (`city_lantern_string`, `scale: 0.9`) ma oba końce zakotwiczone w filarach mostu optycznego `blocks[9..10]` na `x = ±4,50 m`.
   - Na ujęciu pionowym `10-top.png` przekątniowy układ okapów (`SW` `z ∈ [-0.5, 4.7]` oraz `NE` `z ∈ [-6.0, -3.0]`) oraz przesunięcie belki mostu optycznego na `z = -2.55` sprawiają, że **cała wiązka lasera na `z = -1.9` (`x ∈ [-4.8, 4.8]`), gniazdo przysłony `(-1.5, 0, -1.9)` i szyny prowadzące osłonę są w 100% odsłonięte i czytelne z lotu ptaka**.

## 5. Wdrożenie

Od wejścia widać jasną osłonę na polu startowym, otwartą ramkę na linii lasera i rygiel północnej śluzy. Szyny zbiegają się z pasem ostrzegawczym pod wiązką. Po lewej można prześledzić metalowy przewód od obudowy głowicy aż do białej kreski na ryglu. Ta zależność pozostaje widoczna również w przerwie cyklu. Osłona waży 28 kg, odległość między jej środkiem a osią wiązki wynosi 2,8 m.

| Punkt planu | Decyzja i wynik |
| --- | --- |
| 1. Pogoda i materiały | Profil `drizzleWind`, posadzka z płyt `paving`, stalowe ściany boczne i betonowe ściany śluz. Podłoga ma 12 × 14 m, a spawn pozostaje na (0, 0, 4). |
| 2. Obudowy głowic | Dwa piony o grubości 18 cm obejmują tył emiterów przy X = ±4,8 m. Soczewki wystają przed obudowy i są widoczne z wejścia. |
| 3. Most czujników | Dwa filary i stalowy dwuteownik stoją 0,65 m za wiązką. Dolna półka zaczyna się na wysokości 4 m, a jej przednia krawędź pozostawia odkrytą oś lasera. |
| 4. Śluzy i rygiel | Nadproża domykają dwumetrowe otwory dokładnie nad skrzydłami. Zachodnia listwa dochodzi do lewej kontrolki na wysokości 3,52 m. Dwie kreski oznaczają napęd w obu stanach bramy. |
| 5. Okapy | Stanowisko osłon na południowym zachodzie ma dach 2,1 × 5,2 m, a terminal na północnym wschodzie 2,2 × 3 m. Oba prostokąty ochrony przed deszczem pokrywają się z rzutem i wierzchem odpowiedniego dachu. |
| 6. Zasilanie i odbiornik | Kiosk i generator obrócono frontem do przejścia. Ich kolidery mają lokalne wymiary GLB i ten sam obrót o 90°. Agregat na Z = 0,45 m odsłania wschodnią soczewkę. Łączy go z nią izolowany przewód. Automat `city_vending` ma wrzutnik i okno wydawania towaru, więc boczną baterię tworzą trzy ryflowane moduły na cokole. |
| 7. Stanowisko osłon | Ciemny profil zapasowy `cover_low` przylega do zachodniego muru na wysokości ruchomej osłony. Między nimi na starcie jest 1,95 m wolnego miejsca. Zapora narożna ma kolider 2 × 0,9288 × 0,51 m. |
| 8. Fasady | Sześć brył o wysokości 15–21 m obudowuje kanał. Łączniki nad oboma przejazdami stoją na całej głębokości daszków. Od okapów do przestrzeni za zamkniętą śluzą biegnie ciągła przegroda. |
| 9. Pole, gniazdo i kierunek | Pole postoju jest pełne, a cztery kreski gniazda otaczają wolny środek dokładnie pod promieniem. Grot przed osłoną przesunięto o 43 cm w prawo względem osi toru i skierowano ku gniazdu. Drugi grot prowadzi do drzwi. Znak STOP zajmuje tylko prawy pas. |
| 10. Szyny i pas poprzeczny | Dwie podłużne szyny prowadzą osłonę. Poprzeczne pasy o szerokości 30 cm biegną od gniazda w stronę obu słupków. Oznakowanie leży na posadzce i pozwala pchać osłonę także ukośnie. |
| 11. Ślady użytkowania | Dwie kałuże leżą po prawej stronie, poza torem. Zacieki mieszczą się na zachodnim i południowym murze. Drugi przeniesiono z miejsca zajętego przez roletę. Pominięto plakat `poster_torn3`, który reklamuje „NEON FEST”. |
| 12. Światło zadania | Biała listwa pod krawędzią okapu oświetla osłonę. Błękit przy śluzie i fiolet za gniazdem tworzą chłodne tło dla bursztynowo-białej wiązki. |
| 13. Światło boczne | Trzy słabsze źródła wydobywają zasilanie, terminal i wejście. Pokój definiuje łącznie sześć świateł punktowych przy limicie ośmiu. Dodatkowe plamy `groundGlow` są wyłączone. |
| 14. Drogowskazy | Błękitne groty na zachodniej i północnej ścianie prowadzą odpowiednio ku wiązce i do drzwi. |
| 15. Identyfikacja śluzy | Hologram androida ma proporcje pliku 512 × 1024 i wymiary 1,1 × 2,2 m. Fioletowy profil góruje nad bramą. Pominięto handlowy szyld „IMPLANTY”, aby uwagę przy zasilaniu prowadził przewód do emitera. |
| 16. Lampiony | Cztery klosze wiszą pod belką. Końce sznura tkwią w trzonach filarów na X = ±4,5 m, Y = 3,424 m i Z = −2,478 m. Stożki pod kloszami są rysowane jako geometria. |
| 17. Kable | Obie wiązki kończą się na licach fasad przy X = ±6 m. Północne końce na zachodzie i wschodzie wypadają kolejno przy (Y, Z) = (9,528, −3,428) i (9,600, −3,446) m. Południowe przy (10,328, 1,972) i (10,400, 1,954) m. |
| 18. Projektor | Podstawa stoi na napędzie na wysokości 5,6 m. Przy skali 1,1 soczewka kończy się na wysokości 5,82 m. W tym samym punkcie zaczyna się stożek hologramu. |
| 19. Drzwi obsługi i roleta | Drzwi obsługi przylegają do zachodniej ściany pod okapem. Wschodnia roleta mieści się między baterią zasilającą a południowym narożnikiem. |
| 20. Kratki | Dwie kratki 0,78 × 0,78 m wyznaczają boczne wyloty wentylacji. Środek przejścia pozostaje wolny. |
| 21. Instalacje elewacyjne | Rury spoczywają na koronie ścian na wysokości 4 m. Piony i klimatyzatory zwrócono plecami do lic fasad. |
| 22. Efekty | Para zaczyna się nad kratkami, iskry przy wschodnim emiterze, a krople na dolnych krawędziach obu okapów. Pas między osłoną a gniazdem jest wolny od emiterów cząstek. |

**Mechanika i odzyskanie osłony.** Powrót korzysta z opcjonalnego `puzzle.workArea` znanego ze śluzy wagowej. Środek osłony ma obszar od −2,7 do +2,1 m na X, od −4,8 do +4,2 m na Z i od −1 do +3 m na Y. Swobodna osłona poza obszarem wraca na wolne pole startowe. Trzymanie Chwytem i zajęcie pola przez gracza opóźniają powrót. Kontakt z rzeczywistym odcinkiem promienia ma pierwszeństwo również przy bocznym emiterze. Dowolne miejsce na wiązce zalicza zagadkę po 0,2 s ciągłej blokady. Przewidziane w runie pominięcie klawiszem M ma osobny wynik.

**Sprawdzenie w symulacji.** W `RoomScene` z Rapierem gracz doszedł ze spawnu za osłonę i rozwiązał zagadkę pchnięciem oraz Chwytem w osobnych próbach. Przejście przez wygaszoną wiązkę bez obrażeń zakończyło się przed zamkniętymi drzwiami. Po odzyskaniu osłony wypchniętej w stronę aparatury gracz ponownie dopchnął ją do wiązki i przekroczył otwarty próg. Dodatkowe próby objęły rzut w górę przy zajętym polu powrotu oraz zaliczenie poza torem przy końcu wiązki. Na siatce 3D co 0,1 m, do wysokości 12 m, sprawdzono również obejście od strony okapów. Dla kuli o promieniu 0,35 m punkty za progiem na Z = −7,2 i −10 m były odcięte przy zamkniętej bramie i dostępne po otwarciu.

**Sprawdzenie danych i widoku.** Audyt pokoju przeszedł z 0 błędów i 3 ostrzeżeń do 0 błędów i 0 ostrzeżeń. Sprawdzono 13 plików GLB, 8 tekstur szyldów i kalkomanii, obwiednie modeli miejskich, sześć zaczepów i obie strefy deszczu. Z wysokości oka 1,65 m ze spawnu geometria odsłania obie soczewki, środek gniazda, środek drzwi i 156 ze 193 próbek osi wiązki. Osłona zasłania część jej zachodniego odcinka. Widocznych jest 106 ze 121 próbek prostokąta pierwszej strzałki i 121 ze 121 prostokąta strzałki za wiązką.

Pełne `npm run check` zakończyło się kodem 0. Przeszły typecheck, lint i 3786 testów w 313 plikach. Testy e2e i zrzuty po przebudowie pominięto zgodnie z zakresem zadania.

**Odbiór na zrzutach.** Na `01-spawn` i `02-north` sprawdzić, czy w mżawce widać grot przed osłoną, ciemny środek gniazda i obie głowice. W widokach bocznych prześledzić połączenia agregat–emiter i odbiornik–rygiel. W grze porównać kreskowane ostrzeżenie, zapłon wiązki i zmianę osłony z bursztynu na zieleń po blokadzie. W ujęciach wysokich ocenić mocowania przewodów, krawędzie suchych stanowisk i przerwę między mostem a linią lasera.
