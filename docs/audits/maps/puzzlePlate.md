# Audyt level designu i plan przebudowy pokoju zagadki `puzzlePlate` (*Płyta sekcji załadunku*)

- **Plik danych:** `src/data/rooms/puzzlePlate.json`
- **Rola w grze:** Pokój zagadki (`type: "puzzle"`, `puzzle.kind: "plate"`) w puli sektora **Kurogane Arms** (`src/data/sectors/kurogane.json`, warstwy L3–L6, `puzzleCredits: 60` + nagroda modułu/implantu, `0` punktów spawnu wrogów, brak fal). Gracz musi przemieścić dynamiczną skrzynię balastową (`24 kg`, `0,85 × 0,9 × 0,85 m`) z punktu `(0, 0.45, 1.35)` w obręb pierścienia płyty naciskowej `(0, 0, -2.1)` (`radiusM: 1.1 m`) — za pomocą mocy **Chwyt** (`grab`) albo pchając ją ciałem podczas chodu (`enableDynamicPush`, `pushMassKg: 75 kg`) — i utrzymać na płycie przez `confirmS = 0,2 s`, co odblokowuje północne drzwi `exit` `(0, 1.5, -6.5)`.
- **Materiał dowodowy:** `src/data/rooms/puzzlePlate.json`, zrzuty `artifacts/maps/puzzlePlate/before/01-spawn.png`..`10-top.png`, raport `docs/audits/mapAudit-report.md` (`0 error / 3 warn`), kod mechaniki i widoku zagadki (`src/world/grabPuzzle.ts`, `src/render/grabPuzzleView.ts`, `src/scenes/roomScene.ts`, `src/world/roomSchema.ts`), testy `tests/unit/grabPuzzle.test.ts` i `tests/unit/rooms.test.ts`, małe pokoje referencyjne (`shopRoom.json`, `restRoom.json`, `noodleShop.json`, `puzzleLaser.json`), wzorce wdrożeniowe (`docs/audits/maps/bossRoom.md`, `docs/audits/maps/arena.md`), wymiary GLB `src/data/render/mapModelBounds.json` oraz zasady `AGENTS.md` i `docs/adr/0006-neon-noir.md`.

---

## 1. Ocena obecnego stanu

### Klimat (1,5 / 5)
Pokój ma ustawione pole `"theme": "neonStreet"`, dzięki czemu na zrzutach widać nocne niebo z deszczem, daleką panoramę wieżowców (`city-panorama`) oraz bazowe materiały `asphalt` (`blocks[0]`) i `concrete` (`blocks[1..6]`). Na tym jednak kończy się cała oprawa wizualna:
- W pliku `src/data/rooms/puzzlePlate.json` **brakuje tablic `lights`, `signs`, `decor`, `decals`, `ambientFx` oraz `rainShelters`**. Automatyczny audyt `node tools/levels/mapAudit.mjs puzzlePlate` zgłasza z tego powodu trzy ostrzeżenia `emptyRoom` (`Brak świateł w danych mapy`, `Brak dekoracji w danych mapy`, `Brak szyldów w danych mapy`).
- Wewnątrz pokoju znajduje się wyłącznie **7 surowych prostopadłościanów** (`1` płyta asfaltu i `6` gładkich ścian `wall`). Brakuje jakiejkolwiek architektury drugiego planu: za 4-metrowymi ścianami obwodowymi (`x = ±6 m`, `z = ±7 m`) nie ma ani jednego budynku `facade` z oświetlonymi oknami. Na ujęciach z góry i pod kątem (`08-high-west.png`, `09-high-east.png`, `10-top.png`) pokój wygląda jak samotne, otwarte od góry betonowe koryto rzucone pośrodku brązowo-fioletowej pustki, kilkadziesiąt metrów od pierwszego pierścienia panoramy (`firstRingM: 66 m`).
- W pokoju nie ma żadnego światła punktowego (`CityLights`), żadnej kałuży (`puddle1`/`puddle2`) ani zadaszenia chroniącego przed deszczem, przez co mokry asfalt nie odbija żadnych kolorowych neonów (jedynym refleksem na `03-east.png`, `08-high-west.png` i `10-top.png` jest blada, bezkształtna biała plama kierunkowego światła bazowego `createStyleLights()`).

### Sensowność miejsca w świecie gry (1,0 / 5)
Według nazwy w danych (`"name": "Płyta sekcji załadunku"`) pokój powinien przedstawiać przemysłowy dok lub śluzę przeładunkową w sektorze zbrojeniowym Kurogane Arms. Obecna geometria w żaden sposób tego nie komunikuje:
- W „sekcji załadunku” nie ma **ani jednej palety towarowej, regału, suwnicy, rolety załadunkowej, wagi, terminala kontrolnego czy agregatu** — na zrzutach bocznych `03-east.png` i `05-west.png` cały kadr od brzegu do brzegu wypełnia pusta, gładka ściana betonu.
- Świecący na pomarańczowo pierścień `puzzle-plate` (`RingGeometry` w `(0, 0.01, -2.1)`) leży bezpośrednio na gołym asfalcie (`02-north.png`, `06-corner-nw.png`) bez żadnej obudowy pomostu wagowego, czujnika, kabli czy powiązanego z nim terminala.
- Północne drzwi wyjściowe `exit` (`(0, 1.5, -6.5)`, `size: 2 × 3 × 0.35 m`, materiał `paint` `#3e5a48`) i południowe drzwi `entry` (`(0, 1.5, 6.5)`) stoją w 4-metrowym murze bez nadproża (między `y = 3 m` a `y = 4 m` zieje pusta wyrwa w murze), bez ościeżnicy i bez żadnego oznaczenia, że mamy do czynienia z ryglowaną śluzą towarową.

### Czytelność zagadki (2,0 / 5)
Mechanika `GrabPuzzle` (`src/world/grabPuzzle.ts`) i jej kolory w `GrabPuzzleView` (`src/render/grabPuzzleView.ts`) są zgodne z `ADR 0006`: skrzynia ma jasny korpus `interactive` (`#d9dde3`) z poświatą `neon_amber` (`#ffae1a`), płyta świeci w kolorze `neon_amber` (`#ffae1a`), a po aktywacji oba obiekty przechodzą w `neon_green` (`#6dff4a`). Mimo to czytelność przestrzenna zagadki na zrzutach ma trzy istotne błędy:
1. **Zasłonięcie płyty naciskowej przez skrzynię w kadrze startowym (`01-spawn.png`, `07-corner-se.png`):** gracz spawnuje się w `(0, 0, 4)` z kamerą na wysokości `y = 1,65 m`, patrząc na północ wzdłuż osi `x = 0`. Skrzynia (`0,85 × 0,9 × 0,85 m`) stoi dokładnie na tej samej osi `x = 0` w odległości `2,65 m` przed graczem (`z = 1,35`), a płaski pierścień płyty leży na podłodze dalej na tej samej osi (`z = -2,1`). W efekcie na `01-spawn.png` bryła skrzyni **zasłania ok. 80% pierścienia płyty** (zza górnej krawędzi sześcianu wystaje tylko wąski pomarańczowy łuk), a na `07-corner-se.png` po bokach skrzyni wystają jedynie dwa drobne „uszy” pierścienia. Nad płytą `z = -2,1` nie ma żadnego pionowego elementu (bramownicy, światła, strzałek), który sygnalizowałby położenie celu w przestrzeni 3D.
2. **Niewidoczne drzwi wyjściowe `exit` i brak wizualnego związku „płyta $\rightarrow$ otwarcie drzwi”:** na `01-spawn.png` i `02-north.png` drzwi wyjściowe `exit` w `(0, 1.5, -6.5)` są ciemną, nieoświetloną plamą `#3e5a48`, niemal nieodróżnialną od nocnego tła i betonowych ścian `blocks[3..4]`. Nic w otoczeniu nie pokazuje, że ustawienie ładunku na płycie `z = -2,1` zasila i odryglowuje właśnie tę bramę.
3. **Brak podpowiedzi kierunkowej na posadzce i ścianach:** pomiędzy skrzynią (`z = 1,35`) a płytą (`z = -2,1`) nie ma żadnej prowadnicy, pasów ostrzegawczych ani strzałki wskazującej kierunek przesunięcia ładunku (przez co bez komunikatu HUD `PuzzleHud` gracz widzi jedynie sześcian na pustym placu).

### Skala i proporcje przestrzeni (3,5 / 5)
Zewnętrzny obrys podłogi `blocks[0]` wynosi **`12 × 14 m`** (`x ∈ [-6, 6]`, `z ∈ [-7, 7]`), co po odjęciu 1-metrowych murów obwodowych daje **`10 × 12 m` (`120 m²`)** powierzchni użytecznej.
- **Porównanie z małymi pokojami referencyjnymi:** skala `10 × 12 m` jest w pełni spójna z pozostałymi niebojowymi pokojami-przerywnikami sektora Kurogane Arms: `shopRoom.json` (`12 × 12 m`, wnętrze `10 × 10 m`), `restRoom.json` (`12 × 12 m`, wnętrze `10 × 10 m`), `noodleShop.json` (`10 × 16 m`, wnętrze `10 × 14 m`) oraz bliźniaczym pokojem zagadki `puzzleLaser.json` (`12 × 14 m`, wnętrze `10 × 12 m`).
- **Ocena pod kątem rozgrywki i testów:** dla zagadki z jedną skrzynią (`massKg: 24`), gdzie dystans transportu od `z = 1,35` do `z = -2,1` wynosi `3,45 m` (ok. 2–4 s pchania kapsułą lub prowadzenia wiązką Chwytu), rozmiar `12 × 14 m` jest optymalny. Powiększenie podłogi wydłużyłoby jedynie jałowe pchanie skrzyni przez pustą przestrzeń, a zmiana pozycji spawnu `(0, 0, 4)` lub obiektu zagadki złamałaby testy jednostkowe `tests/unit/grabPuzzle.test.ts` (które teleportują gracza komendą `tp 0 4 0 0` oraz `tp 0 4 0 -23` i idą prosto na północ `moveForward`).
- **Wniosek projektowy:** **nie należy powiększać rzutu podłogi `12 × 14 m`**, natomiast należy radykalnie rozbudować **skalę pionową i podział strefowy**: otoczyć mur 15–20-metrowymi budynkami `facade` (jak w `shopRoom`, `restRoom` i `noodleShop`), domknąć portale drzwi nadprożami, wydzielić zadaszone doki boczne (`x ∈ [±2,8..±5,0]`) i postawić nad płytą `z = -2,1` pełnowymiarową bramownicę wagową.

---

## 2. Koncepcja przebudowy

### Czym jest to miejsce w świecie gry: *Automatyczna Śluza Wagowa Kurogane Arms („Płyta sekcji załadunku”)*
To wąski, nocny dziedziniec logistyczny (`10 × 12 m` w świetle murów) na zapleczu zakładów Kurogane Arms, pełniący funkcję **automatycznej śluzy taryfikacji ładunków** między podsektorami magazynowymi.
W procedurach bezpieczeństwa korporacji północna brama towarowa (`exit` na `z = -6,5`) jest zablokowana ryglem elektromagnetycznym sprzężonym z **pomostową wagą tensometryczną** wpuszczoną w asfalt na `z = -2,1`. System otwiera przegrodę tylko wtedy, gdy na pomoście pod bramownicą pomiarową spocznie kontener o masie tarującej (`24 kg`). Podczas ewakuacji personelu podajnik z zachodniej komory magazynowej (`city_shutter`) zostawił jasną skrzynię balastową pośrodku toru rozładunkowego (`(0, 0.45, 1.35)`), `3,45 m` przed pomostem wagi.

### Jak dekoracja, architektura i światło tłumaczą zagadkę bez tekstu
Projekt przestrzeni prowadzi wzrok gracza od pierwszej sekundy po spawnie w `(0, 0, 4)` za pomocą czterech warstw niewerbalnych podpowiedzi:

1. **Bezsłowny diagram instruktażowy na posadzce (Oś transportu `x = 0`):**
   - Pod skrzynią startową w `(0, 0.01, 1.35)` leży kwadratowe oznaczenie stanowiska podjęcia ładunku (`floor_hazard`, `1,5 × 1,5 m`).
   - Dokładnie pomiędzy skrzynią (`z = 1,35`) a płytą naciskową (`z = -2,1`) w punkcie `(0, 0.01, -0.35)` namalowana jest wyraźna **strzałka jezdniowa `floor_arrow` (`yaw: 0`, skierowana prosto na północ `-Z`)**, pokazująca kierunek pchania/przenoszenia skrzyni.
   - Pod samym pierścieniem płyty naciskowej `(0, 0.01, -2.1)` znajduje się duża płyta fundamentowa wagi (`floor_hazard`, `2,6 × 2,6 m`), która zamienia abstrakcyjny okrąg `RingGeometry` (`średnica 2,2 m`) w czytelne gniazdo dokujące dla skrzyni.
2. **Trójwymiarowa bramownica wagowa nad płytą (`z = -2,1`) — widoczność celu ponad skrzynią:**
   - Aby rozwiązać problem zasłaniania płyty przez skrzynię w `01-spawn.png`, dokładnie w płaszczyźnie płyty (`z = -2,1`) stoją przy ścianach dwa betonowe filary (`pillar`, `x = ±4,55, z = -2,1`, zostawiające `8,2 m` wolnego środka) podtrzymujące **stalową belkę portalu pomiarowego (`y = 4,225 m`)** oraz zawieszony pod nią **sznur bursztynowych lampionów ostrzegawczych (`city_lantern_string`)**. Dzięki temu gracz już ze spawnu widzi nad skrzynią świecącą bramkę celownika wskazującą dokładną głębokość `z = -2,1`.
3. **Kierunkowe neony prowadzące (`arrow` $\rightarrow$ `OPEN`):**
   - Na ścianie zachodniej obok toru ruchu (`(-4.95, 2.3, -0.35)`, `yaw: 1.5708`) świeci bursztynowy neon **`arrow`** wskazujący poziomo na północ (`-Z`) — od skrzyni prosto na bramownicę wagi.
   - Na ścianie północno-zachodniej (`(-3.1, 2.5, -5.95)`, `yaw: 0`) druga bursztynowa strzałka **`arrow`** wskazuje w prawo (`+X`) na bramę wyjściową `exit`.
   - Bezpośrednio nad drzwiami wyjściowymi `exit`, na nowym stalowym nadprożu śluzy (`(0, 3.5, -5.95)`), świeci zielony neon **`OPEN`** (`#6dff4a`), a powyżej wisi korporacyjny hologram **`holo_kurogane`** (`#3d7bff`) wyświetlany z projektora na koronie nadproża.
4. **Kodowanie barwne światła zgodne ze stanami zagadki (`#fff1d6` $\rightarrow$ `#ffae1a` $\rightarrow$ `#6dff4a`):**
   - **Strefa podjęcia ładunku (`z = 1,35`):** oświetlona od góry ciepłą bielą (`#fff1d6`), wydobywającą jasny korpus skrzyni (`#d9dde3`).
   - **Strefa wagi (`z = -2,1`):** skąpana w **bursztynowym świetle (`#ffae1a`)** z reflektora i sznura lampionów — w tym samym kolorze (`neon_amber`), jakim świeci nieaktywna płyta i krawędzie skrzyni.
   - **Strefa rygla wyjścia (`z = -5,3..-6,5`) i sterowni wagi (`x = 3,5..3,9`):** oświetlona **zielenią akceptacji (`#6dff4a`)** (neon `OPEN`, reflektor nad progiem `exit`, neon `repair` oraz zielone ekrany statusu terminala `city_kiosk` i agregatu `city_generator`) — dokładnie tym samym kolorem (`neon_green`), na który zmieniają się płyta i skrzynia w chwili zaliczenia zagadki.
   - **Kontekst środowiskowy w bocznych dokach:** pod zachodnim zadaszeniem (`x = -4,1`) przed stalową roletą `city_shutter` stoją dwie nieruchome palety skrzyń `city_crates` (jedna dokładnie na linii `z = 1,35`), pokazujące, skąd wyjechał ładunek, a pod wschodnim zadaszeniem (`x = 3,5..3,9`) stoją połączone z wagą maszyny sterujące (`city_kiosk` + `city_generator`).

### Różnica wobec `bossRoom` i `arena`

| Cecha | `bossRoom` (*Sala zarządu Kurogane Arms*) | `arena` (*Nielegalny Ring Walk „Klatka”*) | `puzzlePlate` (*Płyta sekcji załadunku*) |
| --- | --- | --- | --- |
| **Rola i tempo rozgrywki** | Finałowy pojedynek z bossem (`securityChief`) i posiłkami Tarczowników; wysokie napięcie, uniki przed obszarowym `slam` (`5,5 m`). | Długa walka falowa `360°` (Arena 12 fal / Endless / Mutatory) dla maks. 10–30 wrogów z 8 kierunków. | Krótki, bezwalkowy przerywnik logiczno-fizyczny (`0` wrogów, ~15–30 s) wykorzystujący moc Chwytu lub pchanie kapsułą. |
| **Skala i geometria układu** | `30 × 30 m` (`28 × 28 m` wnętrza), szeroki dziedziniec z pustym środkiem, wnęką serwerową i dwiema długimi galeriami bocznymi. | `40 × 40 m` (`38 × 38 m` wnętrza), koncentryczny układ 3 pętli ruchu wokół 4-filarowego ringu centralnego i 4 podestów skokowych. | `12 × 14 m` (`10 × 12 m` wnętrza), kameralny, osiowy kanał przeładunkowy (`+Z → -Z`) podzielony bramownicą wagi na strefę podjęcia i strefę śluzy. |
| **Tożsamość i narracja miejsca** | Elitarny taras dowodzenia na szczycie fortecy korporacyjnej Kurogane Arms. | Podziemny ring gladiatorski półświatka i ruchu oporu Iskra w Dolnym Mieście. | Przemysłowy dok logistyczny i automatyczna śluza wagowa na zapleczu magazynów Kurogane Arms. |
| **Funkcja światła i dekoracji** | Budowanie kontrastu dla czerwonej sylwetki bossa i wskazanie celów M06 (serwer, winda). | Kodowanie 4 stron świata i 8 bram zrzutowych wrogów (orientacja po obrocie i podczas mutatora `darkness`). | Bezsłowna instrukcja zagadki: wizualny wektor od skrzyni (`#fff1d6`) przez bramownicę wagi (`#ffae1a`) do rygla śluzy wyjściowej (`#6dff4a`). |

---

## 3. Plan zmian dla programisty

Plan obejmuje **22 zmiany w danych JSON** w pliku `src/data/rooms/puzzlePlate.json`, uporządkowane od najważniejszych (architektura bramownicy wagi i portali drzwi $\rightarrow$ kolizyjne modele doku i fasady tła $\rightarrow$ kalkomanie instruktażowe $\rightarrow$ światła i neony tłumaczące zagadkę $\rightarrow$ kable, lampiony i efekty `ambientFx`).

- **Elementy zachowane bez zmian (100% kompatybilności z mechaniką i testami):**
  - `id: "puzzlePlate"`, `name: "Płyta sekcji załadunku"`, `type: "puzzle"`, `theme: "neonStreet"`,
  - `playerSpawn: { "x": 0, "y": 0, "z": 4 }`, `spawnPoints: []`,
  - `doors[0]` (`entry` w `(0, 1.5, 6.5)`) oraz `doors[1]` (`exit` w `(0, 1.5, -6.5)`),
  - `puzzle` (`kind: "plate"`, `object.position: (0, 0.45, 1.35)`, `object.size: (0.85, 0.9, 0.85)`, `object.massKg: 24`, `position: (0, 0, -2.1)`, `radiusM: 1.1`),
  - `blocks[0..6]` (podłoga `12 × 1 × 14 m` `asphalt` oraz 6 betonowych ścian obwodowych `wall`).
- **Zgodność z walidatorami:** cały docelowy układ został przeliczony względem `roomSchema` (`validatePuzzle`, `validateLayout` na siatce `1 × 1 m`), `wallDecalFitsBlock` oraz `mapAudit.ts` (**`0 error, 0 warn`** — znikają wszystkie 3 ostrzeżenia `emptyRoom`). Korytarz centralny `x ∈ [-2.8, +2.8]` jest w 100% wolny od przeszkód na całej długości `z ∈ [-6, +6]`.

### Priorytet 1 — Architektura bramownicy wagowej, portali śluz i bocznych zadaszeń (`blocks[7..13]` + `rainShelters`)

1. **Pole główne `"weather"` — jawne przypisanie deszczowego profilu pogody `"rain"`:**
   - **Ścieżka JSON:** główny obiekt `src/data/rooms/puzzlePlate.json` (obok `"theme": "neonStreet"`).
   - **Co zrobić:** Dodaj `"weather": "rain"`.
   - **Uzasadnienie:** Ujednolica konfigurację z przebudowanymi mapami `neonStreet`, gwarantując aktywację połysku mokrej nawierzchni (`weatherGloss`), odbić w kałużach oraz tła akustycznego deszczu w `CityDressing`.

2. **Nowe bloki `blocks[7..9]` (2 betonowe filary `pillar` i stalowa belka bramownicy pomiarowej nad płytą naciskową `z = -2.1`):**
   - **Ścieżki JSON:** `blocks[7]`, `blocks[8]`, `blocks[9]`.
   - **Co zrobić:** Dodaj po `blocks[6]` trzy bloki tworzące portal wagowy dokładnie w płaszczyźnie płyty naciskowej (`z = -2.1`):
     - `blocks[7]` (filar zachodni wagi):
       `{ "size": { "x": 0.9, "y": 4, "z": 0.9 }, "position": { "x": -4.55, "y": 2, "z": -2.1 }, "model": "pillar", "material": "concrete" }`
     - `blocks[8]` (filar wschodni wagi):
       `{ "size": { "x": 0.9, "y": 4, "z": 0.9 }, "position": { "x": 4.55, "y": 2, "z": -2.1 }, "model": "pillar", "material": "concrete" }`
     - `blocks[9]` (górna belka suwnicy pomiarowej nad płytą):
       `{ "size": { "x": 10, "y": 0.45, "z": 0.9 }, "position": { "x": 0, "y": 4.225, "z": -2.1 }, "material": "metal" }`
   - **Uzasadnienie:** Tworzy wyraźną, trójwymiarową ramę celownika bezpośrednio nad płytą naciskową (`z = -2.1`), widoczną ze spawnu `(0, 0, 4)` ponad bryłą skrzyni, zostawiając jednocześnie `8,2 m` czystego przejścia pośrodku (`x ∈ [-4.1, 4.1]`) i dając konstrukcyjne oparcie dla sznura lampionów `decor[0]`.

3. **Nowe bloki `blocks[10..11]` (stalowe nadproża zamykające wyrwy w murze nad drzwiami `exit` i `entry`):**
   - **Ścieżki JSON:** `blocks[10]`, `blocks[11]`.
   - **Co zrobić:** Dodaj dwie stalowe belki nadprożowe (`y ∈ [3.0, 4.0]`) ponad 3-metrowymi drzwiami `doors[0..1]` (`x ∈ [-1, 1], y ∈ [0, 3]`):
     - `blocks[10]` (nadproże północnej śluzy wyjściowej `exit`):
       `{ "size": { "x": 2.8, "y": 1, "z": 1 }, "position": { "x": 0, "y": 3.5, "z": -6.5 }, "material": "metal" }`
     - `blocks[11]` (nadproże południowej śluzy wejściowej `entry`):
       `{ "size": { "x": 2.8, "y": 1, "z": 1 }, "position": { "x": 0, "y": 3.5, "z": 6.5 }, "material": "metal" }`
   - **Uzasadnienie:** Likwiduje nienaturalną, pustą szparę między górną krawędzią drzwi (`y = 3,0 m`) a koroną muru (`y = 4,0 m`) widoczną na `01-spawn.png`, `02-north.png` i `04-south.png`, oraz tworzy pionową płaszczyznę montażową (`z = -6.0, y = 3.5`) bezpośrednio nad drzwiami `exit` dla zielonego neonu `OPEN` (`signs[0]`) i podstawę (`y = 4.0`) pod projektor hologramu `decor[3]`.

4. **Nowe bloki `blocks[12..13]` (2 boczne okapy z blachy falistej `corrugated` nad dokami) + tablica `rainShelters[0..1]`:**
   - **Ścieżki JSON:** `blocks[12]`, `blocks[13]` oraz pole główne `rainShelters`.
   - **Co zrobić:** Dodaj dwa boczne zadaszenia wzdłuż ścian zachodniej i wschodniej (`y ∈ [3.6, 3.84]`, `z ∈ [-5.2, 2.8]`):
     - `blocks[12]` (okap zachodniego doku składowania):
       `{ "size": { "x": 2.2, "y": 0.24, "z": 8 }, "position": { "x": -3.9, "y": 3.72, "z": -1.2 }, "material": "corrugated" }`
     - `blocks[13]` (okap wschodniego doku sterowania wagą):
       `{ "size": { "x": 2.2, "y": 0.24, "z": 8 }, "position": { "x": 3.9, "y": 3.72, "z": -1.2 }, "material": "corrugated" }`
     oraz dodaj tablicę `rainShelters`:
     ```json
     "rainShelters": [
       { "position": { "x": -3.9, "y": 1.8, "z": -1.2 }, "size": { "x": 2.2, "y": 3.6, "z": 8 } },
       { "position": { "x": 3.9, "y": 1.8, "z": -1.2 }, "size": { "x": 2.2, "y": 3.6, "z": 8 } }
     ]
     ```
   - **Uzasadnienie:** Dzieli przekrój pokoju na dwie suche, zadaszone nawy boczne (`szerokość 2,2 m` każda, bez deszczu pod okapami) i otwarty na nocne niebo centralny tor wagowy (`szerokość 5,6 m`, `x ∈ [-2.8, 2.8]`), na który pada deszcz.

### Priorytet 2 — Kolizyjne modele `city_*` tłumaczące funkcję doku i wagi (`blocks[14..18]`) oraz fasady tła (`blocks[19..24]`)

5. **Nowe bloki `blocks[14..15]` (terminal kontrolny wagi `city_kiosk` i agregat rygla `city_generator` we wschodnim doku sterowania):**
   - **Ścieżki JSON:** `blocks[14]`, `blocks[15]`.
   - **Co zrobić:** Dodaj dwa kolizyjne modele o dokładnych wymiarach AABB z `mapModelBounds.json`:
     - `blocks[14]` (terminal wagowy po prawej stronie za płytą, ekranem zwrócony w `+Z` ku graczowi):
       `{ "size": { "x": 0.8, "y": 2.235, "z": 0.6238 }, "position": { "x": 3.5, "y": 1.1175, "z": -3.6 }, "model": "city_kiosk", "material": "metal" }`
     - `blocks[15]` (agregat zasilający zamek śluzy z zielonym ekranem statusu `mat_screen_status`):
       `{ "size": { "x": 1.6, "y": 1.4, "z": 1.005 }, "position": { "x": 3.9, "y": 0.7, "z": 0.6 }, "model": "city_generator", "material": "metal" }`
   - **Uzasadnienie:** Wypełnia pustą prawą ścianę (`03-east.png`, `01-spawn.png`) urządzeniami z zielonymi ekranami diagnostycznymi, które wizualnie łączą płytę naciskową `z = -2.1` z mechanizmem otwierania drzwi `exit` `z = -6.5`. Pozycja `x = 3.5, z = -3.6` dla `city_kiosk` gwarantuje, że ze spawnu `(0, 1.65, 4)` terminal nie jest zasłonięty przez wschodni filar `blocks[8]` (`x ∈ [4.1, 5.0]`).

6. **Nowe bloki `blocks[16..18]` (2 palety skrzyń magazynowych `city_crates` i kontener `city_dumpster` w zachodnim doku składowania):**
   - **Ścieżki JSON:** `blocks[16]`, `blocks[17]`, `blocks[18]`.
   - **Co zrobić:** Dodaj trzy kolizyjne modele po lewej stronie pokoju (dokładne wymiary z `mapModelBounds.json`):
     - `blocks[16]` (paleta skrzyń w osi `z = 1.35` — na wysokości startowej skrzyni zagadki):
       `{ "size": { "x": 1.212, "y": 1.59, "z": 1.256 }, "position": { "x": -4.1, "y": 0.795, "z": 1.35 }, "model": "city_crates", "material": "metal" }`
     - `blocks[17]` (druga paleta skrzyń za bramownicą wagi):
       `{ "size": { "x": 1.212, "y": 1.59, "z": 1.256 }, "position": { "x": -4.1, "y": 0.795, "z": -3.8 }, "model": "city_crates", "material": "metal" }`
     - `blocks[18]` (kontener przemysłowy w narożniku południowo-zachodnim):
       `{ "size": { "x": 1.97, "y": 1.33, "z": 1.08 }, "position": { "x": -3.8, "y": 0.665, "z": 4.8 }, "model": "city_dumpster", "material": "metal" }`
   - **Uzasadnienie:** Nadaje sens nazwie *„Płyta sekcji załadunku”* i wypełnia zachodnią ścianę (`05-west.png`, `06-corner-nw.png`). Ustawienie nieruchomej palety `city_crates` (`blocks[16]`) pod zachodnią ścianą na tym samym `z = 1.35` co pojedyncza, jasna skrzynia interaktywna `(0, 0.45, 1.35)` natychmiast tłumaczy kontekst: ładunki ze składowiska pod ścianą są kolejno przetaczane na wagę w środku pokoju.

7. **Nowe bloki `blocks[19..24]` (6 wysokich budynków `material: "facade"` otaczających dziedziniec):**
   - **Ścieżki JSON:** `blocks[19]`, `blocks[20]`, `blocks[21]`, `blocks[22]`, `blocks[23]`, `blocks[24]`.
   - **Co zrobić:** Dodaj 6 brył `facade` (`wysokość 15–20 m`) przylegających zewnętrznymi licami do murów `blocks[1..6]` na `x = ±6,0 m` oraz `z = ±7,0 m` (wzorem `shopRoom.json` i `restRoom.json`):
     - `blocks[19]` (zachód): `{ "size": { "x": 6, "y": 16, "z": 14 }, "position": { "x": -9, "y": 8, "z": 0 }, "material": "facade" }`
     - `blocks[20]` (wschód): `{ "size": { "x": 6, "y": 18, "z": 14 }, "position": { "x": 9, "y": 9, "z": 0 }, "material": "facade" }`
     - `blocks[21]` (północ-zachód): `{ "size": { "x": 7, "y": 20, "z": 6 }, "position": { "x": -5.5, "y": 10, "z": -10 }, "material": "facade" }`
     - `blocks[22]` (północ-wschód): `{ "size": { "x": 7, "y": 17, "z": 6 }, "position": { "x": 5.5, "y": 8.5, "z": -10 }, "material": "facade" }`
     - `blocks[23]` (południe-zachód): `{ "size": { "x": 7, "y": 15, "z": 6 }, "position": { "x": -5.5, "y": 7.5, "z": 10 }, "material": "facade" }`
     - `blocks[24]` (południe-wschód): `{ "size": { "x": 7, "y": 16, "z": 6 }, "position": { "x": 5.5, "y": 8, "z": 10 }, "material": "facade" }`
   - **Uzasadnienie:** Zamyka pokój w pionowym szybie architektury Neon Noir z oświetlonymi oknami z atlasu, likwiduje pustkę wokół murów na `08-high-west.png`, `09-high-east.png` i `10-top.png`, daje ściany nośne na `x = ±6,0 m` do zaczepienia kabli `city_cable_span` oraz zostawia 4-metrowy prześwit (`x ∈ [-2, +2]`) nad drzwiami `exit` i `entry`, przez który na `01-spawn.png` i `02-north.png` nadal widać wieżowiec panoramy.

### Priorytet 3 — Kalkomanie tłumaczące zagadkę na posadzce i detale ścian (`decals[0..7]`)

8. **Nowe wpisy `decals[0..2]` — wizualna instrukcja zagadki na asfalcie (gniazdo wagi `floor_hazard`, stanowisko startowe skrzyni `floor_hazard` i strzałka prowadząca `floor_arrow`):**
   - **Ścieżki JSON:** `decals[0]`, `decals[1]`, `decals[2]`.
   - **Co zrobić:** Utwórz tablicę `decals` i dodaj trzy oznaczenia poziome wzdłuż osi `x = 0`:
     - `decals[0]` (platforma wagi pod pierścieniem płyty `(0, 0, -2.1)`):
       `{ "texture": "floor_hazard", "position": { "x": 0, "y": 0.01, "z": -2.1 }, "size": { "w": 2.6, "h": 2.6 }, "yaw": 0, "surface": "floor", "opacity": 0.7 }`
     - `decals[1]` (pole startowe pod skrzynią `(0, 0.45, 1.35)`):
       `{ "texture": "floor_hazard", "position": { "x": 0, "y": 0.01, "z": 1.35 }, "size": { "w": 1.5, "h": 1.5 }, "yaw": 0, "surface": "floor", "opacity": 0.6 }`
     - `decals[2]` (strzałka kierunkowa między skrzynią a płytą, skierowana na północ `-Z` przy `yaw: 0`):
       `{ "texture": "floor_arrow", "position": { "x": 0, "y": 0.01, "z": -0.35 }, "size": { "w": 1.3, "h": 1.6 }, "yaw": 0, "surface": "floor", "opacity": 0.65 }`
   - **Uzasadnienie:** Tworzy na podłodze jednoznaczny schemat „SKRZYNIA $\rightarrow$ STRZAŁKA $\rightarrow$ PŁYTA WAGOWA”. Przy `yaw: 0` w `DecalRenderer` (`rotation.set(-Math.PI / 2, 0, 0)`) grot `floor_arrow.webp` celuje dokładnie na północ (`-Z`) w środek pierścienia płyty `(0, 0, -2.1)`.

9. **Nowe wpisy `decals[3..4]` — 2 kałuże refleksyjne (`puddle1` / `puddle2`) odbijające neony, lampiony i pierścień płyty:**
   - **Ścieżki JSON:** `decals[3]`, `decals[4]`.
   - **Co zrobić:** Dodaj:
     - `decals[3]` (przed bramą wyjściową `exit`):
       `{ "texture": "puddle1", "position": { "x": -0.8, "y": 0.01, "z": -4.3 }, "size": { "w": 2.8, "h": 2.4 }, "yaw": 0.4, "surface": "floor", "opacity": 0.8 }`
     - `decals[4]` (w strefie wejściowej):
       `{ "texture": "puddle2", "position": { "x": 1.4, "y": 0.01, "z": 3.1 }, "size": { "w": 2.6, "h": 2.2 }, "yaw": 1.1, "surface": "floor", "opacity": 0.75 }`
   - **Uzasadnienie:** Wzmacnia odbicia mokrego asfaltu (`reflectionPuddles: 1`) w odkrytym pasie centralnym, odbijając zielony neon `OPEN`, błękitny hologram `holo_kurogane` i bursztynowe światło wagi.

10. **Nowe wpisy `decals[5..7]` — zacieki deszczowe `leak_streak` i plakat na murach bocznych (zgodne z `wallDecalFitsBlock`):**
    - **Ścieżki JSON:** `decals[5]`, `decals[6]`, `decals[7]`.
    - **Co zrobić:** Dodaj:
      - `decals[5]` (ściana zachodnia `blocks[1]` przy południowym końcu okapu):
        `{ "texture": "leak_streak", "position": { "x": -5, "y": 2.1, "z": 3.8 }, "size": { "w": 1.4, "h": 2.2 }, "yaw": 1.5708, "surface": "wall", "opacity": 0.65 }`
      - `decals[6]` (ściana wschodnia `blocks[2]` przy południowym końcu okapu):
        `{ "texture": "leak_streak", "position": { "x": 5, "y": 2.1, "z": 3.8 }, "size": { "w": 1.4, "h": 2.2 }, "yaw": -1.5708, "surface": "wall", "opacity": 0.65 }`
      - `decals[7]` (ściana wschodnia `blocks[2]` przy sterowni):
        `{ "texture": "poster_torn2", "position": { "x": 5, "y": 1.6, "z": -4.6 }, "size": { "w": 1.1, "h": 1.1 }, "yaw": -1.5708, "surface": "wall", "opacity": 0.8 }`
    - **Uzasadnienie:** Przełamuje monotonię betonowych ścian `blocks[1..2]` i mieści się z zapasem w obrysie AABB murów wg `wallDecalFitsBlock`.

### Priorytet 4 — Oświetlenie punktowe (`lights[0..5]`) i szyldy/hologramy (`signs[0..4]`)

11. **Nowe wpisy `lights[0..2]` — trzy główne światła osi zagadki (skrzynia `#fff1d6` $\rightarrow$ płyta `#ffae1a` $\rightarrow$ wyjście `#6dff4a`):**
    - **Ścieżki JSON:** `lights[0]`, `lights[1]`, `lights[2]`.
    - **Co zrobić:** Utwórz tablicę `lights` i dodaj trzy reflektory wzdłuż osi `x = 0`:
      - `lights[0]` (ciepła biel nad skrzynią startową `z = 1.35`):
        `{ "position": { "x": 0, "y": 3.8, "z": 1.35 }, "color": "#fff1d6", "intensity": 14, "range": 10 }`
      - `lights[1]` (bursztyn pod bramownicą wagi nad płytą `z = -2.1`):
        `{ "position": { "x": 0, "y": 3.4, "z": -2.1 }, "color": "#ffae1a", "intensity": 16, "range": 11 }`
      - `lights[2]` (zieleń akceptacji przed śluzą wyjściową `exit` `z = -5.3`):
        `{ "position": { "x": 0, "y": 2.8, "z": -5.3 }, "color": "#6dff4a", "intensity": 15, "range": 10 }`
    - **Uzasadnienie:** Buduje czytelny gradient świetlny odpowiadający mechanice `GrabPuzzleView`: jasna skrzynia w ciepłej bieli (`#fff1d6`) ma trafić do bursztynowej strefy wagi (`#ffae1a`), która po aktywacji przyjmuje barwę zielonej śluzy wyjściowej (`#6dff4a`). Dodatkowo `lights[2]` wydobywa z cienia drzwi `exit`, które na zrzutach `before` były niemal czarne.

12. **Nowe wpisy `lights[3..5]` — doświetlenie bocznych doków pod okapami oraz śluzy wejściowej `entry`:**
    - **Ścieżki JSON:** `lights[3]`, `lights[4]`, `lights[5]`.
    - **Co zrobić:** Dodaj trzy światła dopełniające (łącznie 6 świateł punktowych w pokoju — bezpiecznie poniżej limitu 8 źródeł z `ADR 0006` pkt 7):
      - `lights[3]` (dok zachodni — nad paletami `city_crates` i roletą `city_shutter`):
        `{ "position": { "x": -3.6, "y": 3.2, "z": 0.2 }, "color": "#ffae1a", "intensity": 12, "range": 9 }`
      - `lights[4]` (dok wschodni — nad terminalem `city_kiosk` i agregatem `city_generator`):
        `{ "position": { "x": 3.6, "y": 3.2, "z": -1.2 }, "color": "#3d7bff", "intensity": 12, "range": 9 }`
      - `lights[5]` (południowa strefa wejścia `entry`):
        `{ "position": { "x": 0, "y": 3.2, "z": 5.2 }, "color": "#8a5cff", "intensity": 12, "range": 9 }`
    - **Uzasadnienie:** Oświetla boczne ściany na ujęciach `03-east.png` i `05-west.png` oraz bramę wejściową na `04-south.png`, używając wyłącznie dozwolonych barw neonowych ADR 0006 (`#ffae1a`, `#3d7bff`, `#8a5cff`).

13. **Nowy wpis `signs[0]` — zielony neon `OPEN` na nadprożu `blocks[10]` bezpośrednio nad drzwiami wyjściowymi `exit`:**
    - **Ścieżka JSON:** `signs[0]`.
    - **Co zrobić:** Utwórz tablicę `signs` i dodaj:
      `{ "kind": "neon", "texture": "open", "position": { "x": 0, "y": 3.5, "z": -5.95 }, "size": { "w": 1.8, "h": 0.8 }, "yaw": 0, "tint": "#6dff4a", "flicker": 0.1 }`
    - **Uzasadnienie:** Zamocowany na południowym licu nadproża `blocks[10]` (`z = -6.0, y ∈ [3.0, 4.0]`) bezpośrednio nad drzwiami `exit`. Zielony napis `OPEN` (`#6dff4a`) w osi wzroku gracza na `01-spawn.png` i `02-north.png` jednoznacznie wskazuje cel pokoju (odblokowanie wyjścia).

14. **Nowe wpisy `signs[1..2]` — dwie bursztynowe strzałki neonowe `arrow` prowadzące wzrok od skrzyni na płytę i do wyjścia:**
    - **Ścieżki JSON:** `signs[1]`, `signs[2]`.
    - **Co zrobić:** Dodaj dwa neony `arrow` (`#ffae1a`):
      - `signs[1]` (na ścianie zachodniej `blocks[1]` pod okapem, `yaw: 1.5708` — grot skierowany na północ `-Z` od skrzyni ku bramownicy wagi):
        `{ "kind": "neon", "texture": "arrow", "position": { "x": -4.95, "y": 2.3, "z": -0.35 }, "size": { "w": 2.2, "h": 0.9 }, "yaw": 1.5708, "tint": "#ffae1a", "flicker": 0.08 }`
      - `signs[2]` (na ścianie północno-zachodniej `blocks[3]`, `yaw: 0` — grot skierowany w prawo `+X` ku śluzie wyjściowej `exit`):
        `{ "kind": "neon", "texture": "arrow", "position": { "x": -3.1, "y": 2.5, "z": -5.95 }, "size": { "w": 1.8, "h": 0.8 }, "yaw": 0, "tint": "#ffae1a", "flicker": 0.08 }`
    - **Uzasadnienie:** W `arrow.webp` grot strzałki wskazuje lokalną oś `+X`. Przy `yaw = 1.5708` na ścianie zachodniej strzałka celuje dokładnie w `-Z` (od skrzyni `z = 1.35` na wagę `z = -2.1`), a przy `yaw = 0` na ścianie północno-zachodniej wskazuje oś `x = 0` (bramę `exit`).

15. **Nowe wpisy `signs[3..4]` — neon `repair` („SERWIS”) we wschodnim doku sterowania oraz hologram `holo_kurogane` nad północnym portalem:**
    - **Ścieżki JSON:** `signs[3]`, `signs[4]`.
    - **Co zrobić:** Dodaj:
      - `signs[3]` (na ścianie wschodniej `blocks[2]` pod okapem, nad agregatem i terminalem wagi):
        `{ "kind": "neon", "texture": "repair", "position": { "x": 4.95, "y": 2.3, "z": -0.35 }, "size": { "w": 2.2, "h": 0.9 }, "yaw": -1.5708, "tint": "#6dff4a", "flicker": 0.12 }`
      - `signs[4]` (hologram korporacji Kurogane Arms nad nadprożem `blocks[10]`):
        `{ "kind": "holo", "texture": "holo_kurogane", "position": { "x": 0, "y": 6.8, "z": -6.5 }, "size": { "w": 5, "h": 2.5 }, "yaw": 0, "tint": "#3d7bff", "flicker": 0.12 }`
    - **Uzasadnienie:** Neon `repair` („SERWIS” z kluczem) opisuje funkcję wschodniej nawy technicznej na `03-east.png`, a błękitny hologram `holo_kurogane` (`#3d7bff`) buduje wysoki plan kompozycyjny nad wyjściem w `01-spawn.png` i `02-north.png` i osadza pokój w tożsamości sektora Kurogane Arms.

### Priorytet 5 — Lampiony, kable i dekoracje (`decor[0..12]`) z dokładnymi współrzędnymi zaczepienia oraz efekty `ambientFx[0..4]`

16. **Nowy wpis `decor[0]` (sznur lampionów `city_lantern_string` pod belką bramownicy wagowej na `z = -2.1`) — oba końce zaczepione w filarach `blocks[7..8]` i ścianach `blocks[1..2]`:**
    - **Ścieżka JSON:** `decor[0]`.
    - **Co zrobić:** Utwórz tablicę `decor` i dodaj:
      `{ "model": "city_lantern_string", "position": { "x": 0, "y": 3.85, "z": -2.1 }, "yaw": 0, "scale": 1 }`
    - **Współrzędne zaczepienia obu końców** (lokalne końce z `mapModelBounds.json`: `[-5, -0.14, 0.08]` i `[5, -0.14, 0.08]` przy `scale: 1, yaw: 0`):
      - koniec zachodni: **`(-5.00, 3.71, -2.02)`** — styka się z wewnętrznym licem muru zachodniego `blocks[1]` (`x = -5.0, y ∈ [0, 4], z ∈ [-7, 7]`) i spoczywa wewnątrz zachodniego filara bramownicy `blocks[7]` (`x ∈ [-5.0, -4.1], y ∈ [0, 4], z ∈ [-2.55, -1.65]`),
      - koniec wschodni: **`(5.00, 3.71, -2.02)`** — styka się z wewnętrznym licem muru wschodniego `blocks[2]` (`x = 5.0, y ∈ [0, 4], z ∈ [-7, 7]`) i spoczywa wewnątrz wschodniego filara bramownicy `blocks[8]` (`x ∈ [4.1, 5.0], y ∈ [0, 4], z ∈ [-2.55, -1.65]`).
    - **Uzasadnienie:** Tworzy rząd świecących bursztynowych punktów i stożków światła (`LampCones`) dokładnie nad płytą naciskową `z = -2.1`, nie dodając żadnych nadmiarowych `PointLight` do puli 8 świateł.

17. **Nowe wpisy `decor[1..2]` (2 przewody `city_cable_span` rozpięte wysoko między fasadami `blocks[19]` i `blocks[20]`) — oba końce zaczepione na licach `x = ±6,0 m`:**
    - **Ścieżki JSON:** `decor[1]`, `decor[2]`.
    - **Co zrobić:** Dodaj dwie wiązki kabli w skali `scale: 1.2` (`yaw: 0`, lokalne końce z `mapModelBounds.json`: `[-5, -0.06, -0.19]` i `[5, 0, -0.205]`):
      - `decor[1]` (kabel północny):
        `{ "model": "city_cable_span", "position": { "x": 0, "y": 9.5, "z": -3.5 }, "yaw": 0, "scale": 1.2 }`
        - koniec zachodni: **`(-6.00, 9.428, -3.728)`** — dokładnie na wschodnim licu zachodniej fasady `blocks[19]` (`x = -6.0, y ∈ [0, 16], z ∈ [-7, 7]`),
        - koniec wschodni: **`(6.00, 9.500, -3.746)`** — dokładnie na zachodnim licu wschodniej fasady `blocks[20]` (`x = 6.0, y ∈ [0, 18], z ∈ [-7, 7]`).
      - `decor[2]` (kabel południowy):
        `{ "model": "city_cable_span", "position": { "x": 0, "y": 10.2, "z": 2.5 }, "yaw": 0, "scale": 1.2 }`
        - koniec zachodni: **`(-6.00, 10.128, 2.272)`** — dokładnie na wschodnim licu zachodniej fasady `blocks[19]` (`x = -6.0, y ∈ [0, 16], z ∈ [-7, 7]`),
        - koniec wschodni: **`(6.00, 10.200, 2.254)`** — dokładnie na zachodnim licu wschodniej fasady `blocks[20]` (`x = 6.0, y ∈ [0, 18], z ∈ [-7, 7]`).
    - **Uzasadnienie:** Wszystkie 4 końce przewodów mają pełny styk z fasadami (`0` ostrzeżeń `floatingObject`). Wysokość `y = 9,5 m` dla `decor[1]` (`z = -3,5`, najniższy punkt zwisu `y = 8,18 m`) sprawia, że w kadrze ze spawnu `(0, 1.65, 4)` przewód rzutuje się na płaszczyznę `z = -6,5` na wysokości `y = 10,79 m` — aż `2,74 m` powyżej górnej krawędzi hologramu `signs[4]` (`y_max = 8,05 m`), więc nigdy nie przecina hologramu.

18. **Nowy wpis `decor[3]` (projektor hologramu `city_holo_projector` na koronie nadproża `blocks[10]`):**
    - **Ścieżka JSON:** `decor[3]`.
    - **Co zrobić:** Dodaj:
      `{ "model": "city_holo_projector", "position": { "x": 0, "y": 4, "z": -6.5 }, "yaw": 0, "scale": 1.5 }`
    - **Uzasadnienie:** Spoczywa na górnej powierzchni nadproża `blocks[10]` (`y = 4,0 m`). Przy `scale: 1.5` soczewka projektora znajduje się na `y = 4,3 m`, dokładnie w wierzchołku stożka projekcyjnego hologramu `signs[4]` (`y - size.h = 6,8 - 2,5 = 4,3 m`).

19. **Nowe wpisy `decor[4..5]` (stalowa roleta podajnika ładunków `city_shutter` w doku zachodnim i drzwi sterowni `city_door` w doku północno-wschodnim):**
    - **Ścieżki JSON:** `decor[4]`, `decor[5]`.
    - **Co zrobić:** Dodaj dwa modele z grupy `WALL_FIXTURES` przylegające do wewnętrznych lic murów:
      - `decor[4]` (roleta załadunkowa na ścianie zachodniej `blocks[1]` między paletami skrzyń):
        `{ "model": "city_shutter", "position": { "x": -5, "y": 0, "z": -0.4 }, "yaw": 1.5708, "scale": 1 }`
      - `decor[5]` (drzwi techniczne sterowni na ścianie północno-wschodniej `blocks[4]` za kioskiem wagi):
        `{ "model": "city_door", "position": { "x": 3.5, "y": 0, "z": -6 }, "yaw": 0, "scale": 1 }`
    - **Uzasadnienie:** Modele ścienne o głębokości `0,24–0,25 m` nie ograniczają przestrzeni ruchu, a wizualnie tłumaczą, skąd na dziedziniec trafiają skrzynie (`city_shutter` z pasami ostrzegawczymi) i gdzie znajduje się wejście dla obsługi wagi (`city_door` z zieloną kontrolką).

20. **Nowe wpisy `decor[6..7]` i `decor[12]` (2 kratki wentylacyjne `city_vent_grate` w posadzce oraz interaktywny pachołek `city_traffic_cone` przy strefie podjęcia skrzyni):**
    - **Ścieżki JSON:** `decor[6]`, `decor[7]`, `decor[12]`.
    - **Co zrobić:** Dodaj:
      - `decor[6]`: `{ "model": "city_vent_grate", "position": { "x": -2.4, "y": 0, "z": -4.5 }, "yaw": 0, "scale": 1 }`
      - `decor[7]`: `{ "model": "city_vent_grate", "position": { "x": 2.4, "y": 0, "z": 2.8 }, "yaw": 0, "scale": 1 }`
      - `decor[12]`: `{ "model": "city_traffic_cone", "position": { "x": -2.2, "y": 0, "z": 2.2 }, "yaw": 0.4, "scale": 1 }`
    - **Uzasadnienie:** Kratki wentylacyjne (`wys. 0,05 m`) dają fizyczne źródło dla emiterów pary `ambientFx[0..1]`, a pachołek ostrzegawczy `city_traffic_cone` przy stanowisku rozładunku korzysta z fizyki `ScatterProps` (gracz może go potrącić bez blokowania ruchu).

21. **Nowe wpisy `decor[8..11]` (2 piony rur `city_pipe_run` i 2 klimatyzatory `city_ac_unit` na bocznych fasadach `blocks[19..20]`):**
    - **Ścieżki JSON:** `decor[8]`, `decor[9]`, `decor[10]`, `decor[11]`.
    - **Co zrobić:** Dodaj na licach fasad `x = ±6,0 m` powyżej korony muru (`y ≥ 4,0 m`):
      - `decor[8]`: `{ "model": "city_pipe_run", "position": { "x": -6, "y": 4, "z": -4.5 }, "yaw": 1.5708, "scale": 1.1 }`
      - `decor[9]`: `{ "model": "city_pipe_run", "position": { "x": 6, "y": 4, "z": 3.5 }, "yaw": -1.5708, "scale": 1.1 }`
      - `decor[10]`: `{ "model": "city_ac_unit", "position": { "x": -6, "y": 6.2, "z": 1.5 }, "yaw": 1.5708, "scale": 1.2 }`
      - `decor[11]`: `{ "model": "city_ac_unit", "position": { "x": 6, "y": 6.5, "z": -2.1 }, "yaw": -1.5708, "scale": 1.2 }`
    - **Uzasadnienie:** Podstawy rur spoczywają dokładnie na koronie 4-metrowych ścian (`y = 4,0 m`) i przylegają do fasad `blocks[19..20]`, wzbogacając górną część kadru w `01-spawn.png`, `03-east.png` i `05-west.png`.

22. **Nowa tablica `ambientFx[0..4]` — para z kratek wentylacyjnych, iskry przy rolecie załadunkowej i kapanie wody z krawędzi obu okapów:**
    - **Ścieżka JSON:** `ambientFx[0..4]`.
    - **Co zrobić:** Dodaj 5 emiterów cząsteczkowych:
      ```json
      "ambientFx": [
        { "kind": "steam", "position": { "x": -2.4, "y": 0.05, "z": -4.5 }, "rate": 4 },
        { "kind": "steam", "position": { "x": 2.4, "y": 0.05, "z": 2.8 }, "rate": 4 },
        { "kind": "sparks", "position": { "x": -4.75, "y": 2.8, "z": -0.4 }, "rate": 0.55 },
        { "kind": "drip", "position": { "x": -2.8, "y": 3.6, "z": 0 }, "rate": 1.8 },
        { "kind": "drip", "position": { "x": 2.8, "y": 3.6, "z": -1.5 }, "rate": 1.8 }
      ]
      ```
    - **Uzasadnienie:** Dodaje ruchome życie środowisku Neon Noir: para unosi się z kratek `decor[6..7]`, iskry sypią się z prowadnicy rolety `decor[4]`, a krople wody kapią dokładnie ze spodu wewnętrznych krawędzi okapów `blocks[12..13]` (`x = ±2,8 m, y = 3,6 m`).

---

### Wymagane zmiany kodu (analiza `RoomScene`, `GrabPuzzleView` i dokumentacji)

1. **Brak wymaganych zmian w kodzie wykonawczym (`src/`) do wdrożenia planu JSON:**
   - Weryfikacja `src/scenes/roomScene.ts` (`init()` w liniach 446–505 oraz `buildLayout()` w liniach 1098–1385) potwierdza, że `RoomScene` **już w pełni obsługuje** wszystkie użyte w planie elementy: `SceneAtmosphere` (`theme`), `CityDressing` (`weather`, `lights`, `signs`, `decals`, `ambientFx`, `rainShelters`, stożki `LampCones` dla `city_lantern_string`), modele `pillar` i `city_*` w `blocks[]` (przez `placeBlockModel` i `cloneCityModel`), wywracalne dekoracje `ScatterProps` (`city_traffic_cone`) oraz automatyczne scalanie siatek `static-blocks`, `static-models` i `static-decor` przez `batchStaticGeometry`.
   - Wszystkie testy jednostkowe zagadki (`tests/unit/grabPuzzle.test.ts` — pchanie kapsułą z `tp 0 4 0 0` oraz prowadzenie wiązką Chwytu z `tp 0 4 0 -23`, pominięcie klawiszem `M`, reset) oraz testy schematu pokoi (`tests/unit/rooms.test.ts`) działają bez zmian w kodzie, ponieważ pozycje `playerSpawn`, `doors` i `puzzle` oraz drożność pasa centralnego `x = 0` pozostają nienaruszone.

2. **Zalecana korekta nieaktualnego zdania w dokumentacji `docs/systems/rooms.md` (linie 29–30):**
   - W `docs/systems/rooms.md:29-30` widnieje zdezaktualizowany zapis z wczesnej fazy F3: *„`signs/lights/decals/ambientFx` są zachowywane w danych dla integratora; RoomScene i Arena jeszcze ich nie renderują.”* — podczas gdy zarówno `RoomScene`, jak i `Arena` renderują pełną oprawę przez `CityDressing`. Przy wdrażaniu PR z przebudową `puzzlePlate.json` warto zaktualizować to zdanie w `docs/systems/rooms.md`.

---

## 4. Kryteria odbioru na zrzutach

Po wdrożeniu planu w `src/data/rooms/puzzlePlate.json`, uruchomieniu audytu danych `node tools/levels/mapAudit.mjs puzzlePlate` oraz wygenerowaniu serii 10 zrzutów `node tools/screens/mapAudit.mjs puzzlePlate --tag after` w `artifacts/maps/puzzlePlate/after/`:

1. **Walidacja automatyczna i testy (`mapAudit` + Vitest + Playwright):**
   - `node tools/levels/mapAudit.mjs puzzlePlate` zwraca **`0 error` i `0 warn`** (znikają wszystkie 3 ostrzeżenia `emptyRoom` dla `lights`, `decor` i `signs`; brak zgłoszeń `floatingObject`, `noCollisionLargeProp`, `overlap`, `outOfBounds` i `forbiddenColor`).
   - `npm run check` (w tym `tests/unit/grabPuzzle.test.ts`, `tests/unit/rooms.test.ts`, `tests/unit/mapAudit.test.ts`) oraz `npx playwright test tests/e2e/mapAudit.spec.ts` przechodzą na zielono.

2. **Widok ze spawnu (`01-spawn.png`) i widok na północ (`02-north.png`):**
   - **Czytelność zagadki ponad skrzynią:** mimo że skrzynia stoi na pierwszym planie w `(0, 0.45, 1.35)`, lokalizacja płyty naciskowej na `z = -2.1` jest natychmiast czytelna dzięki **bramownicy wagowej** (dwa betonowe filary `pillar` na `x = ±4,55`, stalowa belka suwnicy na `y = 4,225 m` i sznur bursztynowych lampionów `city_lantern_string` ze stożkami światła bezpośrednio nad pierścieniem płyty).
   - **Bezsłowna instrukcja na posadzce i ścianach:** pod skrzynią widać kwadratowe pole startowe `floor_hazard`, przed skrzynią (`z = -0,35`) białą strzałkę `floor_arrow` wskazującą na północ prosto w pierścień płyty osadzony na dużej tarczy `floor_hazard` (`2,6 × 2,6 m`), a na ścianie po lewej bursztynową strzałkę neonową `arrow` wskazującą kierunek ruchu ku wadze i kolejną strzałkę `arrow` na ścianie północno-zachodniej wskazującą wyjście.
   - **Czytelne wyjście `exit`:** północne drzwi wyjściowe `(0, 1.5, -6.5)` są domknięte od góry stalowym nadprożem `blocks[10]`, oświetlone zielonym reflektorem `lights[2]` (`#6dff4a`) i oznaczone zielonym neonem **`OPEN`** bezpośrednio nad otworem drzwiowym oraz błękitnym hologramem **`holo_kurogane`** (`#3d7bff`) z projektorem na koronie nadproża.
   - **Wysoki plan i kable:** nad murem po bokach wznoszą się oświetlone okna fasad `blocks[19..22]`, w centralnym prześwicie `x ∈ [-2, +2]` widać iglicę wieżowca panoramy, a przewód `decor[1]` (`y = 9,5 m`) przebiega czysto ponad górną krawędzią hologramu `holo_kurogane`.

3. **Widoki boczne na wschód (`03-east.png`) i zachód (`05-west.png`):**
   - Zamiast pustych betonowych ścian z wersji `before`, ujęcie wschodnie (`03-east.png`) pokazuje **zadaszony dok sterowania wagą** pod okapem z blachy falistej `blocks[13]`: terminal `city_kiosk`, agregat `city_generator` z zielonym ekranem statusu, zielony neon **`SERWIS`** (`repair`), błękitne światło techniczne `#3d7bff` i zacieki `leak_streak`.
   - Ujęcie zachodnie (`05-west.png`) pokazuje **zadaszony dok składowania ładunków** pod okapem `blocks[12]`: stalową roletę podajnika `city_shutter` z iskrami `sparks`, dwie palety skrzyń `city_crates`, bursztynowy neon strzałki `arrow` i kontener `city_dumpster` w głębi.

4. **Widok na południe (`04-south.png`) oraz ujęcia narożne (`06-corner-nw.png`, `07-corner-se.png`):**
   - Na `04-south.png` za oświetloną ciepłą bielą skrzynią widać południową śluzę wejściową `entry` domkniętą stalowym nadprożem `blocks[11]` i podświetloną fioletowym światłem `lights[5]` (`#8a5cff`), pachołek ostrzegawczy `city_traffic_cone`, kałużę `puddle2` i kontener `city_dumpster` po prawej.
   - Na `06-corner-nw.png` (kamera z północy patrząca na południe przez wagę i skrzynię) widać pełną oś logistyczną pokoju: pierścień płyty na pasach `floor_hazard` pod sznurem lampionów bramownicy, strzałkę `floor_arrow` między płytą a skrzynią oraz obie zadaszone nawy boczne.

5. **Widoki pod kątem 35° i z góry (`08-high-west.png`, `09-high-east.png`, `10-top.png`):**
   - Pokój nie jest już samotnym pudełkiem w pustce: ze wszystkich czterech stron otaczają go wysokie bryły `facade` (`15–20 m`) z oknami i instalacjami (`city_pipe_run`, `city_ac_unit`).
   - Obie wiązki kabli `decor[1..2]` (`city_cable_span`, `scale: 1.2`) mają oba końce osadzone dokładnie w licach bocznych fasad `x = ±6,0 m`, a sznur lampionów `decor[0]` (`city_lantern_string`, `scale: 1.0`) jest zaczepiony w obu filarach bramownicy `blocks[7..8]` na `x = ±5,0 m`.
   - Z góry (`10-top.png`) wyraźnie widać podział na dwie zadaszone nawy boczne (`blocks[12..13]`, pod którymi `rainShelters` zatrzymują smugi deszczu) oraz odkryty pas centralny z czytelną sekwencją: stanowisko skrzyni `(0, 1.35)` $\rightarrow$ strzałka `(0, -0.35)` $\rightarrow$ bramownica i pierścień płyty `(0, -2.1)` $\rightarrow$ śluza wyjściowa `(0, -6.5)`.

## 5. Wdrożenie

Pokój zachował podłogę 12 × 14 m, skrzynię 24 kg i dystans transportu 3,45 m. Gracz zaczyna 2,1 m na zachód od dawnej osi widzenia. Z tej pozycji jasny ładunek stoi na pierwszym planie obok pierścienia. Za pierścieniem druga strzałka prowadzi do północnej bramy. Zieleń skrzyni i pierścienia sygnalizuje przyjęcie ładunku.

| Punkt planu | Decyzja | Wynik i uzasadnienie |
| --- | --- | --- |
| 1. Pogoda | Wdrożony | Profil `rain` nadaje odkrytemu torowi mokrą nawierzchnię i deszcz pomiędzy okapami. |
| 2. Bramownica | Zmieniony | Betonowe filary stoją na X = ±4,55 m przy wadze. Stalowy dwuteownik na wysokości 4–4,45 m daje belce czytelny przekrój od dołu. Między podporami pozostaje 8,2 m. |
| 3. Nadproża | Zmieniony | Oba nadproża mają szerokość otworu 2 m. Ich spód na Y = 3 m styka się z górną krawędzią drzwi, a boki przylegają do murów. |
| 4. Zadaszenia | Zmieniony | Oba doki mają dachy z blachy falistej 2,2 × 8 m i prześwit 3,6 m. Każda strefa ochrony przed deszczem obejmuje rzut dachu aż do wierzchu blachy na Y = 3,84 m. Centralne 5,6 m pozostaje odkryte. |
| 5. Sterownia | Zmieniony | Kiosk i generator stoją przy wschodnim murze. Ich kolidery mają wymiary modeli, odpowiednio 0,8 × 2,235 × 0,6238 m i 1,6 × 1,4 × 1,005 m. Przesunięcie urządzeń do ściany usuwa szczeliny za obudowami i zostawia miejsce do obejścia ładunku. |
| 6. Dok dostaw | Zmieniony | Dwie palety mają kolidery 1,212 × 1,59 × 1,256 m i przylegają do zachodniego muru po obu stronach bramownicy. Kontener 1,97 × 1,33 × 1,08 m przylega do obu ścian południowo-zachodniego narożnika. |
| 7. Zabudowa zewnętrzna | Zmieniony | Sześć hal o wysokości 15–20 m otacza dziedziniec. Nad przejazdami ich skrzydła łączą się za nadprożami. Ta zabudowa zamyka drogę górą z palety lub okapu za opuszczoną bramę. |
| 8. Oznaczenia toru | Zmieniony | Pole podajnika otacza skrzynię. Główna strzałka jest przesunięta o 0,48 m na zachód i obrócona ku środkowi wagi. Dwa pasy flankują pierścień, ponieważ kalkomania nałożona na tarczę mogłaby zasłonić zmianę jej koloru. Krótkie kreski i narożniki oznaczają granice powrotu ładunku. |
| 9. Kałuże | Zmieniony | Dwa mniejsze ślady leżą z boku głównych strzałek na odkrytej nawierzchni. Odbicia świateł zapewnia materiał mokrego asfaltu. |
| 10. Ściany | Zmieniony | Zacieki znajdują się poza południowymi końcami okapów. Plakat zajmuje pełny fragment wschodniej ściany za sterownią. |
| 11. Światła osi | Zmieniony | Ciepła biel wydobywa skrzynię i drzwi, a bursztyn podkreśla wagę. Stała zieleń nad zamkniętą bramą sugerowałaby przedwczesną zgodę na przejazd. Dodatkowe plamy światła na posadzce wyłączono dla czytelności strzałek i pierścienia. |
| 12. Światła doków | Zmieniony | Słabszy bursztyn oświetla roletę, królewski błękit podkreśla terminal, a fiolet wyróżnia wejście przy spojrzeniu wstecz. Łącznie mapa definiuje sześć źródeł punktowych przy limicie ośmiu. |
| 13. Napis nad wyjściem | Odrzucony | Statyczny `OPEN` świeciłby także przy zamkniętych drzwiach. Dwie bursztynowe kreski na nadprożu oznaczają bramę przez cały cykl. Po zważeniu skrzyni skrzydło znika i otwiera przejście. |
| 14. Drogowskazy | Zmieniony | Błękitne groty w teksturze `arrow` dostały zgodny odcień, ponieważ shader mnoży kolory. Zachodni drogowskaz nad paletą wskazuje północ, a północny kieruje w prawo ku wyjściu. Oba mają własne miejsce na murze. |
| 15. Oznaczenia zakładu | Zmieniony | Szyld serwisowy znajduje się nad agregatem. Logo Kurogane ma 4 × 2 m i wisi nad napędem północnej śluzy. Oznaczenia toru działają również bez czytania napisów. |
| 16. Lampiony | Zmieniony | Skala 0,9 i niższe zawieszenie prowadzą sznur pod dachami. Końce w (−4,5, 3,424, −2,028) i (4,5, 3,424, −2,028) tkwią w podporach. Cztery klosze dodają stożki światła. |
| 17. Kable | Wdrożony | Obie wiązki w skali 1,2 dochodzą do fasad na X = ±6 m. Północne zaczepy wypadają na Z = −3,728 i −3,746 m, południowe na Z = 2,272 i 2,254 m. |
| 18. Projektor | Zmieniony | Obudowa napędu podnosi podstawę do Y = 5,6 m. Soczewka w skali 1,2 i wierzchołek stożka spotykają się na Y = 5,84 m. Wyższe położenie odsłania logo ponad belką pomiarową. |
| 19. Roleta i drzwi serwisowe | Zmieniony | Roletę w skali 0,84 umieszczono między paletą i filarem. Drzwi obsługi przylegają do północnego muru obok sterowni. Oba modele mają oparcie na licu muru. |
| 20. Kratki i pachołek | Zmieniony | Dwie kratki 0,78 × 0,78 m wyznaczają wyloty pary poza oznakowaniem toru. Pachołek odrzucono, żeby gracz widział tylko jeden ruchomy ładunek przy podajniku. |
| 21. Instalacje na fasadach | Wdrożony | Piony spoczywają na koronach bocznych murów na Y = 4 m. Rury i oba klimatyzatory przylegają plecami do fasad na X = ±6 m. Zachodni pion wypada na Z = −4,6 m. |
| 22. Efekty | Zmieniony | Para zaczyna się nad kratkami. Źródło iskier leży 1,8 cm nad obudową rolki zachodniej rolety. Krople odrywają się od dolnych krawędzi okapów na X = ±2,8 m. Rozsunięcie emiterów pozostawia linię widzenia przez środek wagi. |

**Odzyskanie skrzyni.** Samo odsunięcie dekoracji pozostawiałoby możliwość dociśnięcia skrzyni do muru albo rzucenia jej na dach. Śluza korzysta z opcjonalnego pola `puzzle.workArea`. Środek swobodnego ładunku może poruszać się od X = −2,2 do +2,2 m, od Z = −4,6 do +4,6 m i od Y = −1 do +3 m. Poza tym obszarem wolne pole podajnika przyjmuje skrzynię ponownie. Powrót zachowuje zamknięcie wyjścia, czeka na puszczenie Chwytu oraz na zejście gracza z pola. Zaliczenie nadal wymaga utrzymania ładunku na płycie. Istniejące pominięcie klawiszem M pozostaje osobnym wynikiem.

**Weryfikacja.** Audyt przeszedł z 0 błędów i 3 ostrzeżeń do 0 błędów i 0 ostrzeżeń. Zweryfikowano 13 plików GLB i 9 tekstur, obwiednie miejskich modeli oraz sześć zaczepów. Test przesłonięcia z wysokości oka 1,65 m dał 360/360 widocznych próbek środka obręczy ze startu na X = −2,1 m. Na dawnej osi widocznych było 183/360. Z nowego spawnu geometria odsłania również 120/121 próbek płaszczyzny pierwszej strzałki i 121/121 próbek logo. To pomiar geometrii. Kontrast przy działającym świetle i deszczu wymaga oceny na obrazie.

W symulacji `RoomScene` z Rapierem gracz doszedł z nowego spawnu za ładunek i dopchnął go do celu. Druga próba potwierdziła zaliczenie Chwytem. Zamknięte drzwi zatrzymały kapsułę gracza, a po zważeniu ładunku to samo podejście pozwoliło przekroczyć próg. Wypchnięcie skrzyni do doku przywróciło ją na pole startowe. Podczas rzutu powrót zaczekał, aż gracz zwolni to pole. Dodatkowo na siatce 3D co 0,1 m, od podłogi do wysokości 12 m, zamknięta brama odcięła oba sprawdzane punkty za progiem (Z = −7,2 i −10 m) również od strony okapów. Otwarcie bramy udostępniło oba punkty.

Pełne `npm run check` zakończyło się kodem 0. Przeszły typecheck, lint i 3780 testów w 313 plikach, w tym 11 testów zagadek z Rapierem.

**Odbiór w grze i na zrzutach.** W `?scene=puzzle-test&room=puzzlePlate` sprawdzić zmianę bursztynu na zieleń i otwarcie północnych drzwi. Na `01-spawn` i `02-north` porównać czytelność skrzyni, obu strzałek i pierścienia na mokrym asfalcie. Na ujęciach bocznych ocenić roletę, ekran sterowni oraz to, czy para pozostawia czytelne dojście. Na ujęciach wysokich sprawdzić sześć zaczepów, krawędzie suchych doków i sylwetkę bramownicy.

