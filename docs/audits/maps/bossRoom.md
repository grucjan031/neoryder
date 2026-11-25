# Audyt level designu i plan poprawek mapy `bossRoom` (*Sala zarządu Kurogane Arms*)

- **Plik danych:** `src/data/rooms/bossRoom.json`
- **Rola w grze:** Finał każdego runu sektora Kurogane Arms (100% runów, warstwa L8, typ `boss`, `bossEnemy: "securityChief"`) oraz finałowy węzeł fabularny misji 6 (`src/data/missions/m06-odlewnia.json`, L7 — starcie z Dyrektorem Ochrony Oskarem Brandtem, zgranie głównego serwera ochrony w `(0, 0, -12)` i ewakuacja windą towarową w `(-11, 0, -11)`).
- **Materiał dowodowy:** `src/data/rooms/bossRoom.json`, zrzuty `artifacts/maps/bossRoom/before/01-spawn.png`..`10-top.png`, raport `docs/audits/mapAudit-report.md` (`0 error / 5 warn`), `src/data/enemies/securityChief.json`, wzorzec `src/data/rooms/alleyCrossing.json` oraz kontrakty `docs/adr/0006-neon-noir.md` i `docs/systems/rooms.md`.

---

## 1. Ocena ogólna

### Klimat (2,5 / 5)
Mapa korzysta z motywu `neonStreet` (nocny deszcz, mokry asfalt z odbiciami w dwóch kałużach `puddle1`/`puddle2`, wysokie bryły `facade` z proceduralnymi oknami w tle i główny hologram `holo_kurogane` nad północną ścianą). Pierwszy kadr ze spawnu (`01-spawn.png`, `02-north.png`) ma dobrą oś symetrii z czerwoną sylwetką bossa na tle błękitnego logo korporacji. Klimat psuje jednak surowe wykonanie z wczesnej fazy blockoutu: aż **13 bloków w grywalnej przestrzeni (`blocks[6..18]`) nie ma przypisanego modelu 3D** i renderuje się jako płaskie, szare prostopadłościany `BoxGeometry` z czarnym konturem (`04-south.png`, `06-corner-nw.png`, `08-high-west.png`). Ponadto deszcz pada na przestrzał przez oba boczne zadaszenia (`blocks[8]` i `blocks[11]`), ponieważ w pliku brakuje tablicy `rainShelters`.

### Sensowność i narracja miejsca — czym to miejsce jest w świecie (1,5 / 5)
Według nazwy (`"Sala zarządu Kurogane Arms"`) i scenariusza M06 (`m06-odlewnia.json`) jest to wewnętrzny dziedziniec / górny taras dowodzenia siedziby ochrony Kurogane Arms z pancernymi wrotami, bocznymi śluzami dla drużyn przechwytujących, windą towarową po lewej stronie (`(-11, 0, -11)`) oraz głównym serwerem ochrony pod tylną ścianą za szybą (`(0, 0, -12)`).
W obecnych danych JSON tożsamość tego miejsca jest wewnętrznie sprzeczna — wygląda jak przypadkowy zlepek rekwizytów z ulicy:
- Na wewnętrznych ścianach sali zarządu wiszą uliczne szyldy usługowe: fioletowy neon **`HOTEL`** (`signs[8]`, `01-spawn.png`, `03-east.png`) i niebieski neon **`IMPLANTY`** (`signs[7]`, `05-west.png`), a na ścianie północnej bezsensowna bursztynowa strzałka (`signs[9]`) wskazująca w bok prosto w krawędź ciemnej tafli `blocks[12]`.
- Tuż obok logo `KUROGANE ARMS` nad głową finałowego bossa wisi konsumencka reklama **`IMPLANTY NA RATY`** (`signs[2]`, `02-north.png`), a nad zachodnią ścianą reklama napoju (`holo_drink`, `signs[3]`).
- Na wewnętrznej ścianie zamkniętego centrum dowodzenia ktoś wymalował uliczne graffiti **`OPÓR`** (`decals[4]`, `05-west.png`, `07-corner-se.png`), a naprzeciwko wisi naderwany plakat uliczny (`decals[5]`, `03-east.png`).
- Wzdłuż ścian wewnątrz hali stoją 4 wysokie latarnie uliczne (`city_street_lamp`, `decor[14..17]`), a na podłodze przed wejściem leży ogromna pstrokata strzałka drogowa (`floor_arrow`, `decals[1]`, `01-spawn.png`).
- Tylna „serwerownia za szybą” (`blocks[12..15]`) nie działa wizualnie: materiał `glass` w `urbanMaterials.ts` jest **nieprzezroczystą** ciemną bryłą (`#18243a`), przez co dwie szare bryły „serwerów” (`blocks[14..15]` na `z = -13,65`) są całkowicie zasłonięte od frontu przez `blocks[12]` (`z = -13,2`), a w punkcie interakcji M06 `(0, 0, -12)` nie ma żadnego terminala.

### Czytelność (3,0 / 5)
Zasada kolorów zarezerwowanych z `ADR 0006` jest zachowana technicznie (brak czerwieni, cyanu i magenty w danych otoczenia), dzięki czemu czerwony kontur i poświata `securityChief` dobrze odcinają się na osi północnej (`02-north.png`). Czytelność przestrzeni w ruchu cierpi jednak z trzech powodów:
1. **Zbyt ciemny środek areny:** wszystkie 10 świateł w `lights[0..9]` ma bardzo niską intensywność (`4,0–6,0` wobec `18–70` w `alleyCrossing.json`), `8 z 10` używa mdłego stalowoszarego koloru `#8a96b0` spoza pięciu barw neonowych ADR 0006, a w całym pasie środkowym między `z = -11,5` a `z = 8` (`19,5 m` długości!) nie ma ani jednego światła punktowego.
2. **Konkurencja o limit 8 świateł (ADR 0006 pkt 7):** 10 świateł z `lights` i 4 światła generowane automatycznie z `city_street_lamp` (`decor[14..17]`) dają 14 źródeł walczących o pulę 8 aktywnych `PointLight`, co powoduje przełączanie świateł przy obrocie kamery.
3. **Mylna sygnalizacja kolizji:** 4 słupy latarń `decor[14..17]` stoją `0,5 m` wewnątrz grywalnej podłogi (`x = ±13,5`) bez kolizji, a surowe szare bloki `blocks[16..18]` w ciemnym środku zlewają się z asfaltem (`03-east.png`, `04-south.png`).

### Przestrzeń pod walkę z bossem — analiza względem `securityChief.json` (2,5 / 5)
Dyrektor Ochrony (`securityChief`, skala `1,5`, wysokość `2,7 m`, `moveSpeed: 3,8 m/s`, `attackRange: 5 m`) ma trzy fazy:
- **Faza 1 (100–65% HP):** obszarowe uderzenie w ziemię `slam` (`radiusM: 5,5 m`, `telegraphS: 0,9 s`, `damage: 30` — ignoruje osłony, wymaga wyjścia z koła o średnicy `11 m`) oraz wachlarz pocisków `fan` (`5` pocisków w kącie `60°`, `speed: 16 m/s`, `muzzle.y: 1,25 m`).
- **Faza 2 (65–30% HP):** szerszy `fan` (`7` pocisków, `75°`) oraz `summon` — wezwanie `2` Tarczowników (`shielder`, do `3` naraz) na losowe `spawnPoints` (`(±11, -11)`, `(±11, -3)`, `(±6, -12)`).
- **Faza 3 (30–0% HP):** szybszy `slam` (`telegraphS: 0,75 s`, `damage: 36`), gęsty `fan` (`9` pocisków, `90°`), `summon` oraz `shield` (`durability: 120`, `durationS: 8 s`) — tarcza niewrażliwa na zwykłe ostrze i broń, którą trzeba rozbić mocami Rezonansu (`#power`) lub odbitymi ostrzem pociskami samego bossa (co otwiera `2,5 s` ogłuszenia i `5 s` okna `1,5×` obrażeń).

Układ `bossRoom` (`30 × 30 m`) źle współpracuje z tym zestawem mechanik:
1. **Zagracony środek utrudnia unik przed `slam` (`5,5 m`):** centralny szary kloc `blocks[16]` (`4 × 1,2 × 1,4 m` w `(0, 0.6, 1.5)`) tworzy z bocznymi klocami `blocks[17..18]` (`(±5.5, 0.6, -1.5)`) i osłonami `blocks[19..20]` (`(±4.5, 0.6, 5.5)`) ciasną siatkę niskich przeszkód. Gdy boss podejdzie ze swojego spawnu `(0, 0, -8)` w okolice `z = -3..0`, promień `slam` (`5,5 m`) przykrywa cały środek, a gracz wykonujący dash do tyłu lub w bok haczy o `blocks[16]`.
2. **Brak czytelnych osłon i rekwizytów w strefie walki:** wszystkie przeszkody w pasie centralnym `x ∈ [-8,9..8,9]` mają wysokość `1,2 m` (poniżej wzroku gracza i na wysokości `muzzle.y = 1,25 m`), a jedyne 2 zniszczalne skrzynie `crate` (`blocks[23..24]`) są schowane pod bocznymi ścianami na `(±11,5, 0,5, -1,5)` za filarami.
3. **Brak wyodrębnienia strefy bossa i celów M06:** boss stoi na płaskim asfalcie na pojedynczej żółtej naklejce `floor_hazard`, a boczne wiaty `blocks[8]` i `blocks[11]` (`szerokość 3,5 m` na `x = ±9,5`) są odsunięte o `2,75 m` od ścian bocznych (`x = ±14`), tworząc dziwne „stoły” w przestrzeni zamiast bocznych galerii/śluz, z których wychodzą Tarczownicy.

### Rytm wejścia i finału (2,5 / 5)
Wejście przez `doors[0]` (`(0, 1.5, 14.5)`) na `playerSpawn (0, 0, 11)` od razu pokazuje bossa w odległości `19 m` (dobry dystans na `bossIntroS` z `BossArenaFx` — przyciemnienie, rozbłysk wizjera i falę uderzeniową). Efekt psuje jednak pstrokata strzałka `floor_arrow` pod nogami gracza oraz surowy szary blok `blocks[16]` zasłaniający środek kadru. Z kolei po pokonaniu bossa (szczególnie w M06, gdzie następuje „cisza po walce” i zadania `server` w `(0, 0, -12)` oraz `exit` w `(-11, 0, -11)`) gracz podchodzi do głuchej, nieprzezroczystej ściany `blocks[12]` bez żadnego widocznego modelu serwera oraz do pustego narożnika `(-11, 0, -11)` bez wizualnego oznaczenia windy towarowej.

### Różnorodność względem innych pokoi (2,0 / 5)
Na tle przebudowanych map z `docs/systems/rooms.md` (jak wzorcowe `alleyCrossing` z wielopoziomowym przejściem podziemnym `-3,2 m`, tarasem `+3,4 m`, zróżnicowanymi materiałami `paving`/`asphalt`/`plaster` i wyrazistym oświetleniem `intensity 18–70`) `bossRoom` pozostał w starym szablonie płaskiego kwadratu `30 × 30 m` (`y = 0` na całej powierzchni, jeden blok asfaltu `blocks[0]`, 5 betonowych ścian `wall` i wianuszek 11 zewnętrznych brył `facade`). Mimo że zachowujemy skalę `30 × 30 m` i punkty spawnu, sala finałowego bossa sektora musi wyróżniać się architekturą korporacyjnego dziedzińca dowodzenia, dopracowanym stanowiskiem serwerowym na północy, pełnymi bocznymi galeriami (zadaszonymi przed deszczem) oraz elitarną, czystą oprawą wizualną Kurogane Arms.

---

## 2. Lista konkretnych błędów w danych JSON

### A. Obiekty bez zaczepienia (wiszące w powietrzu)
1. **`decor[3]`** (`city_cable_span`, `pos: (0, 8.5, -5)`, `yaw: 0`, `scale: 2.9`) — **oba końce wiszą w powietrzu (`floatingObject`, 2/2 końców)**. Przy `scale: 2.9` końce kabla wypadają w `(-14.5, 8.33, -5.55)` oraz `(14.5, 8.50, -5.59)`: `4,3–4,5 m` ponad koroną 4-metrowych ścian `blocks[1..2]` (`x = ±14,5, y_max = 4,0`) i `1,5 m` przed licem zewnętrznych fasad `blocks[25]` / `blocks[28]` (`x = ±16,0`). Widoczne jako urwane w próżni kable na `08-high-west.png`, `09-high-east.png` i `10-top.png`.
2. **`decor[4]`** (`city_cable_span`, `pos: (0, 8.8, 3)`, `yaw: 0`, `scale: 2.9`) — **oba końce wiszą w powietrzu (`floatingObject`, 2/2 końców)** w punktach `(-14.5, 8.63, 2.45)` oraz `(14.5, 8.80, 2.41)`, `1,5 m` przed fasadami `blocks[26]` / `blocks[29]` (`x = ±16,0`).
3. **`decor[5]`** (`city_cable_span`, `pos: (0, 8.2, 10)`, `yaw: 0`, `scale: 2.9`) — **oba końce wiszą w powietrzu (`floatingObject`, 2/2 końców)** w punktach `(-14.5, 8.03, 9.45)` oraz `(14.5, 8.20, 9.41)`, `1,5 m` przed fasadami `blocks[27]` / `blocks[30]` (`x = ±16,0`).
4. **`decor[6]`..`decor[9]`** (`city_pipe_run`, `pos: (±16, 4.5, -4)` i `(±16, 4.5, 7)`, `scale: 1.4`) — piony rur zaczynają się na wysokości `y = 4,5 m` (`0,5 m` powyżej muru `y = 4,0 m`), przez co ich dolne końce urywają się w powietrzu na elewacji zamiast wychodzić zza muru, a przy `scale: 1.4` biegną prosto przez świecące okna fasad `blocks[26..30]` (`06-corner-nw.png`, `07-corner-se.png`).

### B. Modele bez kolizji w grywalnej przestrzeni i przenikanie
5. **`decor[14]`..`decor[17]`** (`city_street_lamp`, `pos: (-13.5, 0, 10)`, `(13.5, 0, 10)`, `(-13.5, 0, -10)`, `(13.5, 0, -10)`) — **duże modele (`wysokość 4,5 m`, wysięgnik `1,28 m`) ustawione `0,5 m` wewnątrz grywalnej podłogi (`x = ±13,5`, lico muru to `x = ±14,0`) w warstwie `decor` bez kolizji**. Gracz i wrogowie przenikają przez słupy latarń. Audyt automatyczny nie zgłosił `noCollisionLargeProp` tylko dlatego, że węższy wymiar podstawy słupa (`0,44 m`) jest minimalnie poniżej progu `LARGE_BASE = 0,5 m`. Dodatkowo stożki światła latarń przecinają ściany `blocks[1..2]` (`04-south.png`, `06-corner-nw.png`).
6. **`decor[0]`** (`city_holo_projector`, `pos: (0, 0, -13.2)`, `scale: 1.4`) — **przenika bryłę `blocks[12]`** (`pos: (0, 1.8, -13.2)`, `size: 9 × 3.6 × 0.25`). Projektor ma środek w tym samym punkcie `(x = 0, z = -13,2)` co ściana `glass` i jest w połowie zatopiony w jej dolnej krawędzi (`02-north.png`, `06-corner-nw.png`).
7. **`decor[1]` i `decor[2]`** (`city_holo_projector`, `pos: (-10, 0, -13.2)` i `(10, 0, -13.2)`, `scale: 1.1`) — leżą luzem na grywalnej podłodze bez kolizji obok punktów spawnu `(±11, -11)`, podczas gdy hologramy `signs[0..2]`, które rzekomo wyświetlają, wiszą `2,6 m` dalej za północnym murem (`z = -15,8`, `y = 7,5..8,5`) i mają własne stożki projekcji kończące się nad murem na `y = 2,5..3,5 m`.

### C. Duplikaty w danych
8. **`props[1]`** (`kind: "crate"`, `pos: (-11.5, 0.5, -1.5)`) — **duplikat `blocks[23]`** (`overlap` w `mapAudit`). Fizykę i render zniszczalnej skrzyni tworzy wpis w `blocks[23]`; `RoomScene` ignoruje wpisy `crate` w `props`.
9. **`props[2]`** (`kind: "crate"`, `pos: (11.5, 0.5, -1.5)`) — **duplikat `blocks[24]`** (`overlap` w `mapAudit`).

### D. Szare, nieoteksturowane bryły (brak modelu 3D w `blocks`)
10. **`blocks[6]`, `blocks[7]`, `blocks[9]`, `blocks[10]`** (`size: 1.2 × 4 × 1.2`, `pos: (±9.5, 2, -7.2)` i `(±9.5, 2, 5.2)`, `material: "trim"`, **brak pola `model`**) — 4 słupy podtrzymujące boczne zadaszenia renderują się jako surowe, jasnoszare prostopadłościany `BoxGeometry` zamiast korzystać z modelu `pillar` (`01-spawn.png`, `06-corner-nw.png`, `07-corner-se.png`).
11. **`blocks[8]` i `blocks[11]`** (`size: 3.5 × 0.6 × 14`, `pos: (±9.5, 4.3, -1)`, `material: "trim"`, **brak `rainShelters`**) — dwie surowe płyty stropowe zawieszone na słupach `x = ±9,5` kończą się na `x = ±11,25`, zostawiając **`2,75 m` pustej dziury** do ścian bocznych (`x = ±14,0`). Wyglądają jak dwa gigantyczne szare stoły ustawione na dziedzińcu (`08-high-west.png`, `09-high-east.png`), przez które na dodatek pada deszcz.
12. **`blocks[12]`..`blocks[15]`** (`blocks[12]`: `9 × 3.6 × 0.25`, `glass` na `z = -13.2`; `blocks[13]`: `9.4 × 0.4 × 0.5`, `metal`; `blocks[14..15]`: `1.8 × 2.8 × 0.6`, `trim` na `(±2.5, 1.4, -13.65)`, **brak pola `model`**) — `blocks[12]` jest nieprzezroczystą ciemną ścianą, która całkowicie zasłania surowe szare klocki `blocks[14..15]` ustawione za nią w wąskiej szczelinie `z = -13,65`. Od frontu widać tylko martwą czarną tablicę (`02-north.png`), z boku dziwną szparę z szarymi klocami (`06-corner-nw.png`), a w miejscu celu M06 `server (0, 0, -12)` nie ma żadnego obiektu.
13. **`blocks[16]`** (`size: 4 × 1.2 × 1.4`, `pos: (0, 0.6, 1.5)`, `material: "trim"`, **brak pola `model`**) — wielki, jasnoszary prostopadłościan bez modelu 3D na samym środku areny (`01-spawn.png`, `04-south.png`), który blokuje przestrzeń manewru w zasięgu `slam` bossa.
14. **`blocks[17]` i `blocks[18]`** (`size: 2.4 × 1.2 × 1.2`, `pos: (-5.5, 0.6, -1.5)` i `(5.5, 0.6, -1.5)`, `material: "metal"`, **brak pola `model`**) — dwa surowe ciemnoszare prostopadłościany bez modelu 3D w centralnej strefie walki (`03-east.png`, `05-west.png`).

### E. Obiekty bez sensu narracyjnego (niepasujące do sali zarządu Kurogane)
15. **`signs[8]`** (`kind: "neon"`, `texture: "hotel"`, `pos: (13.9, 3.1, -3)`, `tint: "#8a5cff"`) — szyld hotelu na wewnętrznej ścianie sali finałowego bossa.
16. **`signs[7]`** (`kind: "neon"`, `texture: "implants"`, `pos: (-13.9, 3.1, -3)`, `tint: "#3d7bff"`) — uliczny szyld sklepu z implantami na wewnętrznej ścianie sali zarządu.
17. **`signs[9]`** (`kind: "neon"`, `texture: "arrow"`, `pos: (-9, 3.1, -13.9)`, `tint: "#ffae1a"`) — losowa strzałka na ścianie północnej celująca w bok ekranu `blocks[12]`.
18. **`signs[2]`** (`kind: "holo"`, `texture: "holo_implant"`, `pos: (10, 7.5, -15.8)`) i **`signs[3]`** (`kind: "holo"`, `texture: "holo_drink"`, `pos: (-15.8, 7.5, -8)`) — reklama ratalna „Implanty na raty” tuż nad bossem oraz reklama napoju nad salą zarządu.
19. **`decals[1]`** (`texture: "floor_arrow"`, `pos: (0, 0.01, 8.5)`, `size: 2.4 × 2.8`), **`decals[4]`** (`texture: "graffiti_resist"`, `pos: (-14, 1.6, 6)`) oraz **`decals[5]`** (`texture: "poster_torn1"`, `pos: (14, 1.6, 6)`) — wielka strzałka jezdniowa przed graczem, graffiti ruchu oporu wewnątrz strzeżonego gabinetu szefa ochrony i podarty plakat uliczny.

### F. Kolory i oświetlenie (`lights[0..9]`)
20. **`lights[0..2]` i `lights[4, 6..9]`** (`color: "#8a96b0"`, `intensity: 4.0..6.0`) — 8 z 10 świateł ma bardzo niską jasność (`4–6`) i szaroniebieski kolor `#8a96b0` spoza palety neonów ADR 0006 (`#ffae1a`, `#6dff4a`, `#8a5cff`, `#3d7bff`, `#fff1d6`). Światła `lights[3..6]` (`y = 5,5, x = ±12`) wiszą **ponad** zadaszeniami `blocks[8]` i `blocks[11]`, środek areny (`z ∈ [-11,5..8]`) jest całkowicie nieoświetlony, a łączna liczba źródeł (10 w `lights` + 4 z `city_street_lamp` = 14) przekracza limit 8 aktywnych świateł punktowych z ADR 0006 pkt 7.

---

## 3. Plan poprawek gotowy dla programisty

Poniższy plan obejmuje **22 konkretne zmiany** w pliku `src/data/rooms/bossRoom.json`, uporządkowane od najważniejszych (naprawa błędów audytu i kolizji $\rightarrow$ likwidacja szarych brył i budowa serwerowni/galerii $\rightarrow$ oczyszczenie narracji $\rightarrow$ oświetlenie i osłona przed deszczem). Skala mapy (`30 × 30 m`), `playerSpawn (0, 0, 11)`, `props[0]` (`bossSpawn (0, 0, -8)`), `doors[0]` oraz wszystkie 6 punktów `spawnPoints` pozostają bez zmian (pełna kompatybilność z `bossRoom.test.ts` i `missionOdlewnia.test.ts`).

### Priorytet 1 — Naprawa ostrzeżeń `mapAudit` (wiszące kable i duplikaty `props`)

1. **`decor[3]` (kabel północny `city_cable_span`) — zaczepienie obu końców na fasadach `blocks[25]` i `blocks[28]`:**
   - **Co zrobić:** Zmień `position` na `{ "x": 0, "y": 8.5, "z": -8 }` oraz `scale` z `2.9` na **`3.2`** (`yaw: 0`).
   - **Współrzędne zaczepienia:** Przy `scale: 3.2` lokalne końce `[-5, -0.06, -0.19]` i `[5, 0, -0.205]` wypadają dokładnie na licach fasad `x = ±16,0`:
     - koniec zachodni: **`(-16.0, 8.31, -8.61)`** — na wschodnim licu `blocks[25]` (`x = -16.0, y ∈ [0, 20], z ∈ [-14.75, -5.25]`),
     - koniec wschodni: **`(16.0, 8.50, -8.66)`** — na zachodnim licu `blocks[28]` (`x = 16.0, y ∈ [0, 18], z ∈ [-14.75, -5.25]`).

2. **`decor[4]` (kabel środkowy `city_cable_span`) — zaczepienie obu końców na fasadach `blocks[26]` i `blocks[29]`:**
   - **Co zrobić:** Zmień `position` na `{ "x": 0, "y": 8.8, "z": 1 }` oraz `scale` z `2.9` na **`3.2`** (`yaw: 0`).
   - **Współrzędne zaczepienia:**
     - koniec zachodni: **`(-16.0, 8.61, 0.39)`** — na wschodnim licu `blocks[26]` (`x = -16.0, y ∈ [0, 24], z ∈ [-4.75, 4.75]`),
     - koniec wschodni: **`(16.0, 8.80, 0.34)`** — na zachodnim licu `blocks[29]` (`x = 16.0, y ∈ [0, 24], z ∈ [-4.75, 4.75]`).

3. **`decor[5]` (kabel południowy `city_cable_span`) — zaczepienie obu końców na fasadach `blocks[27]` i `blocks[30]`:**
   - **Co zrobić:** Zostaw `position: { "x": 0, "y": 8.2, "z": 10 }`, zmień `scale` z `2.9` na **`3.2`** (`yaw: 0`).
   - **Współrzędne zaczepienia:**
     - koniec zachodni: **`(-16.0, 8.01, 9.39)`** — na wschodnim licu `blocks[27]` (`x = -16.0, y ∈ [0, 18], z ∈ [5.25, 14.75]`),
     - koniec wschodni: **`(16.0, 8.20, 9.34)`** — na zachodnim licu `blocks[30]` (`x = 16.0, y ∈ [0, 20], z ∈ [5.25, 14.75]`).

4. **`props[1]` i `props[2]` (zduplikowane wpisy `crate`) — usunięcie duplikatów:**
   - **Co zrobić:** **Usuń** `props[1]` (`(-11.5, 0.5, -1.5)`) oraz `props[2]` (`(11.5, 0.5, -1.5)`). Zostaw w tablicy `props` wyłącznie `props[0]` (`{ "kind": "bossSpawn", "position": { "x": 0, "y": 0, "z": -8 } }`).
   - **Uzasadnienie:** Zniszczalne skrzynie z fizyką Rapiera są już tworzone przez `blocks[23]` i `blocks[24]`. Usunięcie `props[1..2]` likwiduje oba ostrzeżenia `overlap` w `mapAudit`.

### Priorytet 2 — Usunięcie modeli bez kolizji z podłogi i naprawa przenikania

5. **`decor[14]`, `decor[15]`, `decor[16]`, `decor[17]` (`city_street_lamp` na `(±13.5, 0, ±10)`) — usunięcie ulicznych latarń z wnętrza sali:**
   - **Co zrobić:** **Usuń** wszystkie cztery wpisy `decor[14..17]`.
   - **Uzasadnienie:** Słupy latarń stoją `0,5 m` wewnątrz grywalnej podłogi bez kolizji, nie pasują do wnętrza sali zarządu, ich stożki światła przecinają ściany `blocks[1..2]`, a 4 generowane przez nie światła punktowe przepełniają pulę 8 świateł ADR 0006.

6. **`decor[0]`, `decor[1]`, `decor[2]` (`city_holo_projector` na `y = 0, z = -13.2`) — przeniesienie projektorów na koronę północnego muru pod hologramy:**
   - **Co zrobić:** Przesuń trzy projektory z podłogi (`y = 0, z = -13.2`) na wierzch północnej ściany `blocks[3]` (`y = 4.0, z = -14.5`):
     - `decor[0]`: `"position": { "x": 0, "y": 4, "z": -14.5 }`, `"yaw": 0`, `"scale": 1.4`
     - `decor[1]`: `"position": { "x": -10, "y": 4, "z": -14.5 }`, `"yaw": 0`, `"scale": 1.1`
     - `decor[2]`: `"position": { "x": 10, "y": 4, "z": -14.5 }`, `"yaw": 0`, `"scale": 1.1`
   - **Uzasadnienie:** Likwiduje przenikanie `decor[0]` ze ścianą `blocks[12]`, usuwa niekolizyjne modele z grywalnej podłogi przy spawnach `(±11, -11)` i ustawia projektory bezpośrednio pod stożkami hologramów `signs[0..2]`.

### Priorytet 3 — Zamiana szarych nieoteksturowanych brył na modele 3D i korekta układu pod walkę z bossem

7. **`blocks[12]`, `blocks[13]`, `blocks[14]`, `blocks[15]` (północna wnęka serwerowni za bossem) — odsłonięcie serwerów sprzed nieprzezroczystej tafli `glass` i podmiana szarych klocków na modele `city_kiosk` / `city_generator`:**
   - **Co zrobić:**
     - **`blocks[12]`** (tło szklane): cofnij pod północny mur na `"position": { "x": 0, "y": 1.8, "z": -13.85 }`, `"size": { "x": 9, "y": 3.6, "z": 0.25 }`, `"material": "glass"`.
     - **`blocks[13]`** (górna belka oprawy serwerowni): ustaw na `"position": { "x": 0, "y": 3.8, "z": -13.4 }`, `"size": { "x": 9.4, "y": 0.4, "z": 1.2 }`, `"material": "metal"`.
     - **`blocks[14]`** (lewy moduł zasilania serwera — przed taflą `blocks[12]`): ustaw `"position": { "x": -2.6, "y": 0.7, "z": -13.2 }`, `"size": { "x": 1.6, "y": 1.4, "z": 1 }`, `"model": "city_generator"`, `"material": "metal"`.
     - **`blocks[15]`** (prawy moduł zasilania serwera — przed taflą `blocks[12]`): ustaw `"position": { "x": 2.6, "y": 0.7, "z": -13.2 }`, `"size": { "x": 1.6, "y": 1.4, "z": 1 }`, `"model": "city_generator"`, `"material": "metal"`.
   - **Uzasadnienie:** Wcześniej nieprzezroczysty blok `blocks[12]` na `z = -13,2` całkowicie zasłaniał surowe klocki `blocks[14..15]` na `z = -13,65`. Po cofnięciu tafli `glass` na `z = -13,85` urządzenia stoją przed nią (widoczne z całej sali za plecami bossa) i korzystają z wielomateriałowego modelu `city_generator` (ekrany statusu, zielone diody, detale maszynowe).

8. **Nowy blok w `blocks` (główny terminal serwera ochrony przy celu M06 `(0, 0, -12)`) — dodanie kolizyjnego modelu `city_kiosk`:**
   - **Co zrobić:** Dodaj do `blocks` (np. po `blocks[15]`) wpis:
     `{ "size": { "x": 0.8, "y": 2.24, "z": 0.62 }, "position": { "x": 0, "y": 1.12, "z": -13.3 }, "model": "city_kiosk", "material": "metal" }`.
   - **Uzasadnienie:** W misji M06 (`m06-odlewnia.json`) cel `server` („Zgraj serwer ochrony”) znajduje się w `(0, 0, -12)` (promień `1,6 m`). Model `city_kiosk` (wymiary z `mapModelBounds.json`: `0,8 × 2,235 × 0,624 m`, świecące ekrany `mat_screen_map`/`mat_screen_news` i błękitno-zielone akcenty) daje graczowi czytelny fizyczny terminal dokładnie na osi `(0, 0, -12)` (`z ∈ [-13,61..-12,99]`), zostawiając komórkę `(0, -12)` w pełni wolną dla walidatora `roomSchema`.

9. **`blocks[16]` (centralny szary kloc `(0, 0.6, 1.5)`) — podmiana na model `cover_low` i cofnięcie na `z = 2.5`:**
   - **Co zrobić:** Zmień `blocks[16]` na:
     `{ "size": { "x": 3.6, "y": 1.2, "z": 1 }, "position": { "x": 0, "y": 0.6, "z": 2.5 }, "model": "cover_low", "material": "metal" }`.
   - **Uzasadnienie:** Zastępuje ogromny, nieoteksturowany szary prostopadłościan z pierwszego planu `04-south.png` właściwym modelem niskiej osłony `cover_low`. Przesunięcie z `z = 1,5` na `z = 2,5` powiększa czystą strefę pojedynku przed bossem (`z ∈ [-8..2,5]` = `10,5 m`), dzięki czemu gracz może wyjść z `5,5 m` promienia `slam` bez blokowania się na centralnej bryle.

10. **`blocks[17]` i `blocks[18]` (środkowo-boczne szare kloce `(±5.5, 0.6, -1.5)`) — zamiana na modele `city_generator`:**
    - **Co zrobić:** Zmień `blocks[17]` i `blocks[18]` na dopasowane do wymiarów GLB (`1,6 × 1,4 × 1,0 m`) bloki z modelem `city_generator`:
      - `blocks[17]`: `{ "size": { "x": 1.6, "y": 1.4, "z": 1 }, "position": { "x": -5.5, "y": 0.7, "z": -1.5 }, "model": "city_generator", "material": "metal" }`
      - `blocks[18]`: `{ "size": { "x": 1.6, "y": 1.4, "z": 1 }, "position": { "x": 5.5, "y": 0.7, "z": -1.5 }, "model": "city_generator", "material": "metal" }`
    - **Uzasadnienie:** Likwiduje dwa surowe klocki z `03-east.png` i `05-west.png`, dając wyższą (`1,4 m`) i węższą (`1,6 m`) osłonę techniczną z ekranami i pasami ostrzegawczymi, która ułatwia chowanie się przed wachlarzem pocisków `fan` (7–9 pocisków) oraz otwiera szersze korytarze boczne do flankowania Tarczowników (`shielder`).

11. **`blocks[6]`, `blocks[7]`, `blocks[9]`, `blocks[10]` (4 słupy bocznych galerii `(±9.5, 2, -7.2)` i `(±9.5, 2, 5.2)`) — dodanie modelu `pillar`:**
    - **Co zrobić:** W każdym z czterech bloków `blocks[6]`, `blocks[7]`, `blocks[9]`, `blocks[10]` dodaj `"model": "pillar"` i zmień `"material"` z `"trim"` na `"concrete"` (rozmiar `{ "x": 1.2, "y": 4, "z": 1.2 }` i pozycje bez zmian).
    - **Uzasadnienie:** Zastępuje surowe szare słupy `BoxGeometry` (`06-corner-nw.png`, `07-corner-se.png`) fazowanym modelem kolumny `pillar.glb` (rozciąganym przez `STRETCH_MODELS` dokładnie do kolidera `1,2 × 4 × 1,2 m`).

12. **`blocks[8]` i `blocks[11]` (stropy bocznych zadaszeń `(±9.5, 4.3, -1)`) — dosunięcie stropów do ścian bocznych `x = ±14,0`:**
    - **Co zrobić:** Poszerz oba stropy z `size.x: 3.5` do **`size.x: 6`** i przesuń ich środki z `x = ±9.5` na **`x = ±11`** oraz zmień materiał na `"metal"`:
      - `blocks[8]`: `{ "size": { "x": 6, "y": 0.6, "z": 14 }, "position": { "x": -11, "y": 4.3, "z": -1 }, "material": "metal" }`
      - `blocks[11]`: `{ "size": { "x": 6, "y": 0.6, "z": 14 }, "position": { "x": 11, "y": 4.3, "z": -1 }, "material": "metal" }`
    - **Uzasadnienie:** Obecnie między zadaszeniami (`x = ±11,25`) a ścianami bocznymi (`x = ±14,0`) zieje `2,75 m` pustki, przez co konstrukcje wyglądają jak dwa wolnostojące stoły (`08-high-west.png`, `09-high-east.png`). Po zmianie stropy sięgają od `x = ±8,0` (oparte na kolumnach `x = ±9,5`) aż do lica muru `x = ±14,0`, tworząc prawdziwe zadaszone galerie boczne nad punktami spawnu Tarczowników `(±11, -3)` i skrzyniami `blocks[23..24]`.

13. **Nowe pole `rainShelters` — zatrzymanie deszczu pod obiema bocznymi galeriami i nad wnęką serwerowni:**
    - **Co zrobić:** Dodaj na poziomie głównego obiektu JSON tablicę `rainShelters`:
      ```json
      "rainShelters": [
        { "position": { "x": -11, "y": 2.15, "z": -1 }, "size": { "x": 6, "y": 4.3, "z": 14 } },
        { "position": { "x": 11, "y": 2.15, "z": -1 }, "size": { "x": 6, "y": 4.3, "z": 14 } },
        { "position": { "x": 0, "y": 2, "z": -13.4 }, "size": { "x": 9.4, "y": 4, "z": 1.4 } }
      ]
      ```
    - **Uzasadnienie:** Eliminuje błąd deszczu przenikającego przez pełne dachy `blocks[8]`, `blocks[11]` i `blocks[13]`.

### Priorytet 4 — Spójność narracyjna i wizualna (szyldy, hologramy, naklejki, rury, winda M06)

14. **`signs[7]`, `signs[8]`, `signs[9]` (neony `implants`, `hotel`, `arrow` na wewnętrznych ścianach sali) — usunięcie niepasujących szyldów:**
    - **Co zrobić:** **Usuń** `signs[7]` (`implants` na `(-13.9, 3.1, -3)`), `signs[8]` (`hotel` na `(13.9, 3.1, -3)`) oraz `signs[9]` (`arrow` na `(-9, 3.1, -13.9)`).
    - **Uzasadnienie:** Wewnątrz sali zarządu / centrum dowodzenia ochrony Kurogane Arms nie mogą wisieć szyldy hotelu, sklepu z implantami ani ślepa strzałka wskazująca w krawędź szyby (`01-spawn.png`, `02-north.png`, `03-east.png`).

15. **`signs[2]` (`holo_implant` na `(10, 7.5, -15.8)`) i `signs[3]` (`holo_drink` na `(-15.8, 7.5, -8)`) — podmiana tekstur hologramów na korporacyjne:**
    - **Co zrobić:**
      - W `signs[2]` zmień `"texture"` z `"holo_implant"` („Implanty na raty”) na **`"holo_android"`** (symetrycznie do `signs[1]` na `(-10, 7.5, -15.8)`), `"tint": "#8a5cff"`.
      - W `signs[3]` zmień `"texture"` z `"holo_drink"` na **`"holo_koi"`**, `"tint": "#3d7bff"` (korespondujący z `signs[6]` na wschodniej elewacji).
    - **Uzasadnienie:** Tworzy monumentalną, spójną oprawę korporacji zbrojeniowej Kurogane Arms (centralny logotyp `holo_kurogane` flankowany przez dwa hologramy androidów strażniczych, bez reklam ratalnych i napojów).

16. **`decals[1]` (`floor_arrow` na `(0, 0.01, 8.5)`), `decals[4]` (`graffiti_resist` na `(-14, 1.6, 6)`) i `decals[5]` (`poster_torn1` na `(14, 1.6, 6)`) — wymiana ulicznych kalkomanii na przemysłowe ślady i oznaczenia strefy:**
    - **Co zrobić:**
      - W **`decals[1]`** zmień `"texture"` z `"floor_arrow"` na **`"floor_stop"`**, `"position": { "x": 0, "y": 0.01, "z": 9.5 }`, `"size": { "w": 2.8, "h": 1.4 }`, `"yaw": 0`, `"opacity": 0.5` (oznaczenie strefy bezpieczeństwa przy bramie wejściowej zamiast pstrokatej strzałki).
      - W **`decals[4]`** zmień `"texture"` z `"graffiti_resist"` („OPÓR”) na **`"leak_streak"`**, `"position": { "x": -14, "y": 2.2, "z": 6 }`, `"size": { "w": 1.6, "h": 2.4 }`, `"opacity": 0.65`.
      - W **`decals[5]`** zmień `"texture"` z `"poster_torn1"` na **`"leak_streak"`**, `"position": { "x": 14, "y": 2.2, "z": 6 }`, `"size": { "w": 1.6, "h": 2.4 }`, `"opacity": 0.65`.
    - **Uzasadnienie:** Usuwa z wnętrza sali zarządu uliczne graffiti i plakaty na rzecz realistycznych zacieków deszczowych na betonowym murze.

17. **Nowa kalkomania w `decals` (oznaczenie windy towarowej M06 w `(-11, 0, -11)`) + `decor` bramki:**
    - **Co zrobić:** Dodaj w `decals` wpis:
      `{ "texture": "floor_hazard", "position": { "x": -11, "y": 0.01, "z": -11 }, "size": { "w": 2.6, "h": 2.6 }, "yaw": 0, "surface": "floor", "opacity": 0.65 }`
      oraz dodaj w `decor` model drzwi serwisowych windy na ścianie zachodniej przy narożniku NW:
      `{ "model": "city_door", "position": { "x": -14, "y": 0, "z": -11 }, "yaw": 1.5708, "scale": 1.2 }`.
    - **Uzasadnienie:** W misji M06 punkt ewakuacji `exit` („Opuść Odlewnię windą towarową”) leży dokładnie w `(-11, 0, -11)`, gdzie obecnie jest goły, ciemny kąt. `city_door` na ścianie `x = -14, z = -11` (ma zielono-białe podświetlenie ramy i mieści się w limicie montażowym `WALL_FIXTURES`) oraz pasy `floor_hazard` na posadzce jasno komunikują miejsce windy.

18. **`decor[6]`..`decor[9]` (`city_pipe_run` na `(±16, 4.5, -4)` i `(±16, 4.5, 7)`) — opuszczenie podstaw rur za mur i korekta skali:**
    - **Co zrobić:** Obniż `position.y` z `4.5` na **`3.5`**, zmniejsz `scale` z `1.4` na **`1.1`** i przesuń parę `decor[6..7]` z `z = -4` na **`z = -5.5`** (na skraj fasad `blocks[25]` / `blocks[28]` zamiast przez środek okien `blocks[26]` / `blocks[29]`):
      - `decor[6]`: `"position": { "x": -16, "y": 3.5, "z": -5.5 }`, `"yaw": 1.5708`, `"scale": 1.1`
      - `decor[7]`: `"position": { "x": 16, "y": 3.5, "z": -5.5 }`, `"yaw": -1.5708`, `"scale": 1.1`
      - `decor[8]`: `"position": { "x": -16, "y": 3.5, "z": 5.5 }`, `"yaw": 1.5708`, `"scale": 1.1`
      - `decor[9]`: `"position": { "x": 16, "y": 3.5, "z": 5.5 }`, `"yaw": -1.5708`, `"scale": 1.1`
    - **Uzasadnienie:** Dolne końce rur chowają się za 4-metrowym murem (`y = 3,5 < 4,0`), dzięki czemu rury nie zaczynają się w powietrzu i nie zasłaniają głównych kolumn okien.

### Priorytet 5 — Oświetlenie i czytelność walki (`lights[0..7]`, zgodnie z limitem 8 świateł ADR 0006)

19. **`lights[0]` (główne światło sceny bossa i serwerowni) — wzmocnienie i zmiana barwy na błękit królewski ADR 0006:**
    - **Co zrobić:** Ustaw `lights[0]` na `{ "position": { "x": 0, "y": 5.5, "z": -10.5 }, "color": "#3d7bff", "intensity": 22, "range": 16 }`.
    - **Uzasadnienie:** Chłodny błękit królewski (`#3d7bff`) oświetla wnękę serwerową i tworzy maksymalny kontrast tonalny dla czerwonej sylwetki bossa (`#e0262b` / `#ff5050`) w punkcie `(0, 0, -8)`.

20. **`lights[1]` i `lights[2]` (światła narożników północnych / śluz i windy M06) — podniesienie czytelności głębi sali:**
    - **Co zrobić:**
      - `lights[1]` (narożnik NW — winda towarowa): `{ "position": { "x": -11, "y": 4.2, "z": -11 }, "color": "#ffae1a", "intensity": 16, "range": 12 }`
      - `lights[2]` (narożnik NE): `{ "position": { "x": 11, "y": 4.2, "z": -11 }, "color": "#8a5cff", "intensity": 16, "range": 12 }`
    - **Uzasadnienie:** Bursztynowy reflektor po lewej wyróżnia strefę windy ewakuacyjnej M06 `(-11, 0, -11)`, a fiolet po prawej domyka kompozycję Neon Noir.

21. **`lights[3]` i `lights[4]` (światła pod bocznymi galeriami `blocks[8]` i `blocks[11]`) — opuszczenie pod strop `y = 3.6`:**
    - **Co zrobić:**
      - `lights[3]` (galeria zachodnia przy rolecie `city_shutter`): `{ "position": { "x": -11.5, "y": 3.6, "z": -4 }, "color": "#ffae1a", "intensity": 15, "range": 12 }`
      - `lights[4]` (galeria wschodnia przy rolecie `city_shutter`): `{ "position": { "x": 11.5, "y": 3.6, "z": -4 }, "color": "#ffae1a", "intensity": 15, "range": 12 }`
    - **Uzasadnienie:** Wcześniej światła wisiały na `y = 5,5` (ponad stropem `y = 4,3`), a strona wschodnia miała mdły kolor `#8a96b0`. Opuszczenie ich na `y = 3,6` oświetla wnętrze obu bocznych galerii, skrzynie `blocks[23..24]` oraz boczne spawny Tarczowników `(±11, -3)`.

22. **`lights[5]`, `lights[6]`, `lights[7]` (doświetlenie centralnej płyty walki i wejścia) oraz usunięcie `lights[8..9]`:**
    - **Co zrobić:** Zastąp `lights[5..7]` trzema światłami w palecie ADR 0006 i **usuń `lights[8]` oraz `lights[9]`** (tak aby tablica `lights` miała dokładnie **8 wpisów**):
      - `lights[5]` (środek-zachód, nad kałużą `puddle1` i generatorem `blocks[17]`): `{ "position": { "x": -5.5, "y": 4.8, "z": -1 }, "color": "#fff1d6", "intensity": 18, "range": 14 }`
      - `lights[6]` (środek-wschód, nad kałużą `puddle2` i generatorem `blocks[18]`): `{ "position": { "x": 5.5, "y": 4.8, "z": -1 }, "color": "#fff1d6", "intensity": 18, "range": 14 }`
      - `lights[7]` (strefa wejścia gracza): `{ "position": { "x": 0, "y": 4.8, "z": 8.5 }, "color": "#3d7bff", "intensity": 16, "range": 14 }`
    - **Uzasadnienie:** Dwie lampy ciepłej bieli (`#fff1d6`, `intensity: 18`) wreszcie oświetlają główną strefę pojedynku (`z ∈ [-6..4]`), wydobywając teksturę mokrego asfaltu, modele generatorów i czerwone telegrafy `slam`/`fan` bossa, a redukcja łącznej liczby świateł z 14 do dokładnie 8 gwarantuje brak wygaszania źródeł przy ruchu kamery.

---

## 4. Kryteria odbioru (co musi być widać po poprawkach)

Po wdrożeniu powyższego planu i wygenerowaniu zrzutów (`node tools/screens/mapAudit.mjs bossRoom --tag after`) oraz raportu (`node tools/levels/mapAudit.mjs bossRoom`):

1. **Wynik automatycznego audytu (`mapAudit`):**
   - `bossRoom` ma **`0 error` i `0 warn`** (znikają wszystkie 3 ostrzeżenia `floatingObject` dla `decor[3..5]` oraz oba ostrzeżenia `overlap` dla `props[1..2]`).
   - Testy `npm test -- tests/unit/bossRoom.test.ts tests/unit/missionOdlewnia.test.ts tests/unit/mapAudit.test.ts tests/unit/rooms.test.ts` przechodzą na zielono.
2. **Widok ze spawnu i na północ (`01-spawn.png`, `02-north.png`):**
   - Na podłodze przed graczem nie ma pstrokatej strzałki `floor_arrow` (zastąpiona subtelnym pasem `floor_stop` przy wejściu), a środek kadru nie jest zasłonięty surowym szarym klocem `blocks[16]` (widać fazowany model `cover_low` na `z = 2,5`).
   - Ze ścian bocznych zniknęły szyldy **`IMPLANTY`** i **`HOTEL`**, a ze ściany północnej zniknęła żółta strzałka `arrow`.
   - Nad głową bossa logo `KUROGANE ARMS` jest flankowane symetrycznie przez dwa hologramy androidów (`holo_android`) zamiast reklamy **„IMPLANTY NA RATY”**.
   - Za plecami bossa (`z = -13,2..-13,85`) przed ciemną taflą szkła widać podświetlony na błękitno centralny terminal serwera (`city_kiosk` w `(0, 1.12, -13.3)`) oraz dwa boczne generatory (`city_generator`), a projektor `decor[0]` nie wbija się w podstawę szyby (stoi na koronie muru `y = 4,0`).
3. **Widoki boczne i ukośne (`03-east.png`, `04-south.png`, `05-west.png`, `06-corner-nw.png`, `07-corner-se.png`):**
   - Brak jakichkolwiek surowych, nieoteksturowanych szarych prostopadłościanów w grywalnej przestrzeni: 4 słupy bocznych galerii mają geometrię modelu `pillar`, a środkowo-boczne osłony `blocks[17..18]` są detalami `city_generator` z ekranami i zielonymi kontrolkami.
   - Zniknęły 4 niekolizyjne latarnie uliczne `city_street_lamp` z narożników `(±13.5, 0, ±10)` oraz przecinające mur trójkątne stożki ich światła.
   - Ze ścian bocznych zniknęło graffiti **`OPÓR`** i podarty plakat (zastąpione zaciekami `leak_streak`).
   - W narożniku północno-zachodnim `(-11, 0, -11)` widać drzwi windy towarowej (`city_door` na `(-14, 0, -11)`) i pasy `floor_hazard` w bursztynowym świetle `lights[1]`.
   - Środek areny jest wyraźnie doświetlony ciepłą bielą (`#fff1d6`) z odbiciami w obu kałużach i podświetlonymi galeriami bocznymi (`#ffae1a`), bez smug deszczu pod stropami galerii.
4. **Widoki z góry i pod kątem (`08-high-west.png`, `09-high-east.png`, `10-top.png`):**
   - Wszystkie trzy kable `decor[3..5]` (`scale: 3.2`) sięgają od ściany do ściany i kończą się dokładnie w licach bocznych fasad `x = ±16,0` (brak szczeliny powietrznej między końcami kabli a budynkami).
   - Stropy bocznych galerii `blocks[8]` i `blocks[11]` (`size.x = 6,0` na `x = ±11,0`) przylegają bezpośrednio do ścian bocznych `x = ±14,0` zamiast wisieć w powietrzu jak odizolowane stoły.

## 5. Wdrożenie

Numery odnoszą się do planu z sekcji 3. W runie Kurogane dziedziniec zamyka sektor. W wariancie pokojowym M06 `MissionView` dostawia szafę serwerową przy `(0, 0, −12)` i ruchomą bramę z podestem przy `(−11, 0, −11)`. Kampanijna M06 korzysta z osobnej geometrii w `src/data/levels/m06-odlewnia.json`.

| Punkt planu | Decyzja | Pierwsze wdrożenie, przed przeglądem zrzutów |
| --- | --- | --- |
| 1. Kabel północny | Wdrożony | Skala 3,2 i Z = −8. Końce trafiają w zachodnią i wschodnią fasadę na X = ±16 m, odpowiednio przy Z = −8,608 i −8,656 m. |
| 2. Kabel środkowy | Wdrożony | Skala 3,2 i Z = 1. Oba końce mieszczą się na środkowych fasadach, przy Z = 0,392 i 0,344 m. |
| 3. Kabel południowy | Wdrożony | Skala 3,2 i Z = 10. Zaczepy leżą przy Z = 9,392 i 9,344 m, na licach południowej pary fasad. |
| 4. Skrzynie | Wdrożony | Dwa wpisy `blocks` nadal tworzą zniszczalne skrzynie pod galeriami. Z `props` usunięto ich powtórzenia. |
| 5. Latarnie | Wdrożony | Usunięto cztery słupy z podłogi. Wraz z nimi znikają cztery automatyczne światła i stożki latarń. |
| 6. Projektory | Zmieniony | Trzy podstawy mieszczą się na koronie północnego muru przy Y = 4 i Z = −14,5. Szyldy przesunięto na tę samą oś. Wierzchołek stożka leży o pełną wysokość szyldu poniżej jego środka, więc środki logo i androidów wypadają na Y = 9,28 i 9,22 m. |
| 7. Wnęka serwerowa | Zmieniony | Ciemna tafla przylega tyłem do muru na Z = −14. Daszek sięga do Z = −12,65 i osłania oba generatory. Rozstawiono je na X = ±3, żeby zmieścić także terminal i szafę M06. |
| 8. Terminal | Zmieniony | Kiosk ma kolider 0,8 × 2,235 × 0,6238 m i ekran zwrócony ku arenie. Stoi na X = 1,4 i Z = −13,3. Gracz może podejść do klawiatury w strefie interakcji, a szafa wyświetlana przez M06 ma wolne miejsce na osi. |
| 9. Osłona centralna | Odrzucony | Usunięto środkowy blok. W pościgu `Boss.step` kieruje ruch wprost na gracza. Osłona na proponowanym Z = 2,5 przecięłaby trasę od bossa do spawnu, zanim boss wszedłby w zasięg ataku. Cztery niskie osłony na flankach pozostały dostępne. |
| 10. Generatory w polu walki | Zmieniony | Dwa generatory na X = ±5,5 i Z = −1,5 mają kolidery według GLB, po 1,6 × 1,4 × 1,005 m. Przez środek i po zewnętrznych stronach maszyn prowadzą przejścia. |
| 11. Filary galerii | Wdrożony | Cztery modele `pillar` w betonie wypełniają kolidery 1,2 × 4 × 1,2 m i dochodzą do spodu stropów. |
| 12. Stropy galerii | Wdrożony | Oba metalowe stropy sięgają od filarów do ścian na X = ±14. Każda galeria ma 6 × 14 m rzutu i 4 m prześwitu. |
| 13. Deszcz | Zmieniony | Cztery strefy `rainShelters` odpowiadają dokładnym obrysom obu galerii, daszka serwera i wnęki windy. Dwa emitery kapania przeniesiono na końce okapów przy zaciekach. |
| 14. Szyldy uliczne | Wdrożony | Usunięto hotel, implanty i strzałkę z wewnętrznych ścian dziedzińca. |
| 15. Hologramy | Zmieniony | Logo Kurogane flankują dwa fioletowe androidy. Usunięto cztery boczne projekcje, w tym reklamę napoju. Boczne elewacje eksponują teraz instalacje i zaczepy kabli, a trzy północne hologramy mają własne projektory. |
| 16. Kalkomanie | Wdrożony | Przy wejściu leży jasny napis STOP. Pod końcami galerii na obu murach umieszczono zacieki `leak_streak`. Renderer odsuwa kalkomanie od lica powierzchni. |
| 17. Winda | Zmieniony | Przy punkcie ewakuacji powstała zadaszona wnęka z kolizyjnymi ścianami, pasami na posadzce i drzwiami serwisowymi zamocowanymi do jej zachodniego boku. Wlot o szerokości 2,9 m i prześwicie 3,45 m mieści bramę `MissionView` o szerokości 2,2 m i wysokości 3,35 m. Spawn posiłków pozostaje dostępny od strony areny. |
| 18. Piony rur | Zmieniony | Podstawy opuszczono do Y = 3,5 i przyjęto skalę 1,1. Całe mocowania na Z = ±6 mieszczą się na fasadach. Przy proponowanym Z = ±5,5 część obrysu rury wychodziłaby nad szczelinę między budynkami. |
| 19. Światło bossa | Wdrożony | Królewski błękit nad przedpolem serwera ma intensywność 22 i zasięg 16 m. |
| 20. Północne narożniki | Zmieniony | Bursztynowe źródło windy znajduje się pod jej nowym daszkiem na Y = 3,18. Wschodni narożnik oświetla fiolet. Oba źródła mają intensywność 16 i zasięg 12 m. |
| 21. Światła galerii | Zmieniony | Obie rolety i ich oświetlenie wypadają na Z = −4, pod pełnym stropem. Bursztynowe światła są na Y = 3,6. Iskry przypisano do obudów rolet. |
| 22. Środek i wejście | Wdrożony | Dwa źródła ciepłej bieli oświetlają pole walki, a błękitne źródło przy wejściu wyznacza drogę powrotną. Pokój zgłasza łącznie osiem świateł punktowych. Liczba aktywnych zależy od widoku i poziomu jakości. |

**Weryfikacja.** Audyt pokoju przeszedł z 0 błędów i 5 ostrzeżeń do 0 błędów i 0 ostrzeżeń. Próg `bossRoom` w `tests/unit/mapAudit.baseline.json` już wynosi 0 i obejmuje wyłącznie błędy. Sprawdzono wymiary modeli miejskich z GLB oraz łączność na siatce 0,25 m dla promienia 0,45 m i wysokości 2,7 m. Od startu gracza dostępne są wejście, spawn bossa, wszystkie sześć spawnów posiłków i oba cele pokojowej M06.

W symulacji `RoomScene` z Rapierem boss podszedł do nieruchomego gracza i rozpoczął zapowiedź ataku na Z = 6 m. Po pokonaniu bossa komendą debug gracz przeszedł od wejścia do serwera, a potem do windy. Obie interakcje zakończyło przebywanie w ich strefach.

**Do oceny na zrzutach i w grze.** Ze spawnu sprawdzić kontrast czerwonej sylwetki bossa na tle logo i wolną drogę jego natarcia. Z poziomu posadzki obejrzeć oznaczenie windy i ekran terminala. Z góry sprawdzić sześć mocowań kabli i krawędzie suchych galerii.

### Korekta po przeglądzie zrzutów

| Uwaga | Decyzja i wynik |
| --- | --- |
| 1. Oznaczenie przy wejściu | Usunięto `floor_stop`, który na `01-spawn` wypełniał dół kadru. Pasy `floor_hazard` wskazują teraz tylko start bossa i strefę windy. |
| 2. Winda w narożniku NW | Usunięto obie ścianki. Zachodnia zostawiała przy murze ślepą szczelinę szeroką na 1,35 m, a wschodnia przecinała linię widzenia kamery `06-corner-nw` do bossa. Drzwi przylegają teraz do zachodniego muru na X = −14 i Z = −11. Do tego samego lica dochodzą metalowy daszek i jego strefa ochrony przed deszczem. Prześwit wynosi 3,45 m. Bursztynowe światło pod daszkiem oświetla drzwi i dojście do punktu M06. |
| 3. Kabel przed logo | Północny przewód podniesiono z Y = 8,5 do 14 m. Oba końce nadal dotykają fasad na X = ±16 m. Rzut trójkątów GLB ze spawnu na płaszczyznę szyldu daje co najmniej 1,60 m odstępu nad jego górną krawędzią. Sprawdzono też czysty widok w kierunku północnym ze środka sali. |
| 4. Symetria serwerowni | Dodano drugi kolizyjny `city_kiosk` na X = −1,4 i Z = −13,3. Między kioskami pozostają 2 m na centralną szafę M06 o szerokości 1,6 m. Podejście gracza prowadzi od frontu, a kolidery obu stanowisk stoją za spawnem bossa. |

Po korekcie audyt ponownie wykazał 0 błędów i 0 ostrzeżeń. W symulacji z Rapierem boss doszedł do zasięgu ataku na Z = 6 m. Po jego pokonaniu gracz ukończył oba cele, przechodząc pieszo od wejścia do serwera, a następnie do windy.
