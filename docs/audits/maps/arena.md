# Audyt level designu i plan przebudowy mapy `arena` (_Nielegalny Ring Walk „Klatka”_)

- **Plik danych układu:** `src/data/scenes/arena.json` (fale i punkty spawnu: `src/data/waves/arena.json`)
- **Kod sceny:** `src/scenes/arena.ts` (`Arena`, schemat `arenaLayoutSchema`)
- **Rola w grze:** Klasyczna arena falowa wystawiona bezpośrednio w Menu Głównym i w Kryjówce jako trzy samodzielne tryby rozgrywki: **Arena** (`?scene=arena`, 12 fal), **Nieskończona strefa / Endless** (`?scene=endless`, nieskończone fale z wyborem implantów co 3 fale i losowaniem mutatora) oraz **Arena wyzwań** (`?scene=arena-mutators`, codzienny mutator z seeda daty).
- **Materiał dowodowy:** `src/data/scenes/arena.json`, `src/data/waves/arena.json`, `src/scenes/arena.ts`, zrzuty `artifacts/maps/arena/before/01-spawn.png`..`10-top.png`, raport `docs/audits/mapAudit-report.md` (`0 error / 3 warn`), pomiary GLB `src/data/render/mapModelBounds.json`, testy `tests/unit/arenaTurretSpawns.test.ts` i `tests/unit/roomStaticBatch.test.ts` oraz kontrakty `docs/adr/0006-neon-noir.md`, `docs/systems/arena.md`, `docs/systems/modes.md` i `docs/systems/city.md`.

---

## 1. Ocena obecnego stanu

### Klimat (1,0 / 5)

Mapa `arena` zatrzymała się na etapie prototypu F1 sprzed wdrożenia kierunku artystycznego **Neon Noir** (`docs/adr/0006-neon-noir.md`):

- W pliku `src/data/scenes/arena.json` **brakuje pola `"theme"`**, przez co `SceneAtmosphere` ładuje domyślny motyw testowy `white` (`src/data/themes/white.json`). Wszystkie 10 zrzutów (`01-spawn.png`..`10-top.png`) przedstawia sterylną, oślepiająco białą przestrzeń z szarą siatką testową na podłodze (`#ffffff`), pozbawioną nocnego nieba, panoramy wieżowców, deszczu, mgły wysokościowej i odbić mokrej nawierzchni.
- Żaden z 16 bloków (`blocks[0..15]`) nie ma przypisanego pola `"material"` — podłoga, 4 ściany obwodowe, 4 filary i 4 niskie osłony korzystają z domyślnego materiału `world` (płaska biel), a 3 skrzynie `crate`/`crate_small` z materiału `interactive` (czarne sylwetki na `01-spawn.png`, `06-corner-nw.png`, `07-corner-se.png`).
- W danych mapy nie ma ani jednego światła punktowego (`lights`: brak), ani jednego neonu czy hologramu (`signs`: brak), ani jednej dekoracji (`decor`: brak), naklejki (`decals`: brak) czy efektu cząsteczkowego (`ambientFx`: brak). Z tego powodu raport `docs/audits/mapAudit-report.md` zgłasza dla `arena` trzy ostrzeżenia `emptyRoom` (`Brak świateł w danych mapy`, `Brak dekoracji w danych mapy`, `Brak szyldów w danych mapy`).
- Za 4-metrowymi ścianami obwodowymi (`blocks[1..4]`, `x, z = ±19,5 m`) nie ma żadnej zabudowy `facade` — na ujęciach `08-high-west.png`, `09-high-east.png` i `10-top.png` arena wygląda jak otwarte białe pudełko zawieszone w szarej próżni.

### Sensowność i narracja miejsca (1,0 / 5)

Obecny układ nie reprezentuje żadnego miejsca w świecie gry — to abstrakcyjny „whitebox” testowy:

- Cztery cienkie filary `blocks[5..8]` (`1 × 4 × 1 m` w `(±6, 2, ±6)`) stoją pośrodku placu i **niczego nie podpierają** (urywają się na wysokości `y = 4,0 m` pod pustym niebem — klasyczny problem „kupy filarów na kwadracie”).
- Wrogowie w falach 1–12 i w trybie Endless spawnują się na 8 punktach pod gołymi ścianami (`(0, ±16)`, `(±16, 0)`, `(±15, ±15)`), materializując się w pustej przestrzeni przed gładkim murem bez żadnych bram, rolet zrzutowych, drzwi śluz czy stref ostrzegawczych.
- Trzy czarne skrzynie (`blocks[13]` w `(-12, 0.5, -12)` oraz `blocks[14..15]` w `(12, 0.5, 12)` i `(12.8, 0.25, 12.2)`) zostały rzucone asymetrycznie tylko w dwóch narożnikach na płaskiej siatce, bez żadnego kontekstu architektonicznego.

### Gameplay — analiza pod kątem długiej walki falowej (2,0 / 5)

Płyta areny ma wymiary zewnętrzne **`40 × 40 m`** (`blocks[0]`) i wnętrze między ścianami **`38 × 38 m`** (`1 444 m²`, `x, z ∈ [-19, 19]`). W trzech trybach falowych (Arena 12 fal, Endless, Arena z mutatorami) gracz spędza na tej jednej mapie od kilku do kilkudziesięciu minut, walcząc z maksymalnie `maxAlive: 10` (do 30 w testach obciążeniowych) wrogami ośmiu archetypów (`assaulter`, `gunner`, `drone`, `sniper`, `hacker`, `shielder`, `turret`, `executor`). Obecna geometria ma pięć poważnych wad rozgrywkowych:

1. **Błąd orientacji bocznych osłon `blocks[10]` i `blocks[11]`:** wszystkie cztery niskie osłony `cover_low` (`blocks[9..12]`) mają w JSON wpisany ten sam wymiar `{ "x": 2, "y": 1, "z": 0.6 }` (dłuższy bok wzdłuż osi X). O ile osłony północna `(0, 0.5, -10)` i południowa `(0, 0.5, 10)` stoją szerokim frontem (`2,0 m`) do środka areny i spawnów `(0, ±16)`, o tyle osłony zachodnia `(-10, 0.5, 0)` i wschodnia `(10, 0.5, 0)` stoją **kantem (`0,6 m` szerokości!)** zarówno do środka areny, jak i do bocznych punktów spawnu `(±16, 0)`. Na zrzutach `03-east.png` i `05-west.png` widać, że na osi wschód–zachód osłona ma szerokość wąskiego słupka i nie chroni gracza przed ostrzałem ze skrzydeł.
2. **Pusta patelnia na obwodzie i przekątnych (`38 m` nieprzerwanego LoS):** między kręgiem filarów `(±6, ±6)` a ścianami `(±19 m)` rozciąga się pas o szerokości **`13 m`** niemal całkowicie pozbawiony osłon. Od fali 4 (gdy dochodzą Snajperzy `sniper`, a potem Hakerzy `hacker` i Wieżyczki `turret` spawnowane na obwodzie `±15..16 m`) gracz znajdujący się na zewnętrznym pierścieniu jest wystawiony na krzyżowy ogień przez całą szerokość mapy (`36–50 m` po przekątnej) bez możliwości szybkiego zerwania linii widoku.
3. **Brak zróżnicowania wysokości osłon i brak punktów wysokich („high ground”):** poza 4 cienkimi filarami (`1 × 4 × 1 m`) wszystkie przeszkody na mapie mają wysokość `0,5–1,0 m`. Brakuje osłon średnich (`1,3–1,6 m`), które całkowicie kryją sylwetkę gracza w pozycji stojącej lub pozwalają wskoczyć na ich wierzch (`jump`), by zyskać przewagę wysokości nad falą Szturmowców (`assaulter`) i Egzekutorów (`executor`), a także wyższych brył obwodowych (`2,0–2,6 m`) dzielących zewnętrzny tor ruchu na czytelne kieszenie taktyczne.
4. **Niewykorzystany potencjał mocy Rezonansu (Chwyt / Pchnięcie):** zniszczalne skrzynie `crate`/`crate_small` znajdują się tylko w dwóch narożnikach (`NW` i `SE`), podczas gdy ćwiartki `NE` i `SW` są całkowicie puste.
5. **Płaska, monotonna pętla ruchu:** przy długich sesjach w trybie Endless krążenie wokół czterech identycznych słupów `1 × 1 m` na jednolitej, płaskiej podłodze szybko staje się nużące, bo żadna z czterech ćwiartek areny nie różni się taktycznie ani wizualnie od pozostałych.

### Czytelność (2,5 / 5)

- W motywie `white` czerwone sylwetki wrogów są wprawdzie widoczne na białym tle (cel z F1), ale **brakuje głębi i orientacji przestrzennej**: wszystkie cztery ściany (`02-north.png`, `03-east.png`, `04-south.png`, `05-west.png`) wyglądają identycznie. Po szybkim dashu, obrocie kamery o 180° lub wykończeniu (`execute`) gracz nie jest w stanie w ułamku sekundy rozpoznać, w którą stronę świata patrzy i z którego spawnu nadciąga kolejna grupa.
- W trybie **Arena wyzwań** oraz **Endless** występuje mutator **`darkness`** (`arenaLightScale: 0.2`, przyciemniający światła globalne `createStyleLights()` do 20%). Ponieważ `arena.json` ma obecnie `0` wpisów w `lights` i `0` w `signs`, po wylosowaniu mutatora `darkness` na arenie nie działają żadne neony ani kolorowe reflektory punktowe, które zgodnie z opisem w `docs/systems/arena.md` („kolory otoczenia bez zmian, neony pozostają”) miały prowadzić gracza w ciemności.

---

## 2. Koncepcja miejsca w świecie gry i różnica wobec `bossRoom`

### Czym jest to miejsce: _Nielegalny Ring Walk „Klatka” (Podziemny Krąg Iskry w Dolnym Mieście)_

Mapa `arena` to ukryty między wysokimi czynszówkami i magazynami Dolnego Miasta **nielegalny, nocny ring walk gladiatorskich („Klatka pod Bramownicą”)** — dawny kwadratowy dziedziniec przeładunkowy (`38 × 38 m` w świetle murów), przejęty przez podziemnych bukmacherów i komórkę ruchu oporu **Iskra**. W nocy, w strugach deszczu, odbywają się tu brutalne próby ogniowe: najemnicy i Rezonanci wchodzą na płytę ringu, by testować eksperymentalne buildy, broń oraz implanty przeciwko kolejnym falom bojowych dronów, najemników i jednostek egzekucyjnych wypuszczanych z ośmiu bram obwodowych.

### Dlaczego ta koncepcja idealnie pasuje do falowej areny (Arena / Endless / Mutatory)

1. **Naturalne uzasadnienie fal i 8 punktów spawnu (`360°`):**
   - Cztery osiowe punkty spawnu (`(0, -16)`, `(0, 16)`, `(-16, 0)`, `(16, 0)`) to **cztery stalowe bramy zrzutowe (`city_shutter`)** w murach obwodowych, oznaczone na asfalcie pasami ostrzegawczymi `floor_hazard`, iskrzącymi prowadnicami (`sparks`) i reflektorami w czterech różnych barwach ADR 0006.
   - Cztery narożne punkty spawnu (`(-15, -15)`, `(15, -15)`, `(-15, 15)`, `(15, 15)`) to **cztery pancerne śluzy serwisowe (`city_door`)** w narożnikach muru. Gracz od pierwszej sekundy widzi dokładnie, skąd mogą wybiec wrogowie.
2. **Natychmiastowa orientacja kierunkowa (4 strony świata = 4 barwy i punkty orientacyjne):**
   - **Północ (`-Z`, przed graczem na starcie):** strefa organizatora walk z bursztynowym neonem **`ISKRA`** (`#ffae1a`) nad główną roletą zrzutową, zadaszonym punktem bukmachersko-gastronomicznym (`city_stall` po lewej), zadaszonym terminalem wyników i diagnostyki (`city_kiosk` po prawej) oraz dwoma wielkimi hologramami nad murem (`holo_koi` i `holo_jellyfish`).
   - **Południe (`+Z`, za plecami spawnu gracza):** strefa startowa zawodnika z fioletowym neonem **`ARCADE`** (`#8a5cff`), zadaszonym dokiem przygotowawczym z automatem (`city_vending`) i betonową barierą ochronną (`city_barrier`).
   - **Zachód (`-X`, lewa flanka):** strefa nocnego baru i zaopatrzenia z fioletowo-bursztynowymi neonami **`BAR 24H`** / **`RAMEN`**, zielonym hologramem **`holo_implant`**, kontenerem `city_dumpster`, agregatem `city_generator` i graffiti **`ISKRA`**.
   - **Wschód (`+X`, prawa flanka):** strefa rusznikarni i serwisu z zielono-błękitnymi neonami **`IMPLANTY`** / **`WARSZTAT`**, błękitnym hologramem **`holo_cat`**, paletą skrzyń `city_crates` i agregatem `city_generator`.
3. **Konstrukcyjne uzasadnienie 4 centralnych filarów `(±6, ±6)` bez zasłaniania nieba:**
   - Cztery wzmocnione filary `blocks[5..8]` (`1,5 × 4 × 1,5 m`, `pillar`, `concrete`) podtrzymują **dwie wzdłużne stalowe belki bramownicy technicznej** (`blocks[16..17]`, `1,6 × 0,5 × 13,6 m` na `(±6, 4.25, 0)`, `material: "metal"`), a między filarami po wszystkich czterech bokach wewnętrznego ringu `12 × 12 m` rozpięte są **cztery sznury bursztynowych lampionów (`city_lantern_string`)**, które rzucają stożki światła na środek „Klatki”, zostawiając jednocześnie otwarty widok na nocne niebo, deszcz i hologramy.
4. **Trzy pętle ruchu i punkty wysokie („high ground”) bez blokowania AI:**
   - **Wewnętrzny Ring (`r = 0..6 m`)** — zwrotna walka wręcz wokół 4 filarów bramownicy i dwóch lamp ciepłej bieli (`#fff1d6`).
   - **Środkowy Pierścień Taktyczny (`r = 7..12 m`)** — 4 odwrócone frontem do akcji niskie osłony `cover_low` (`1,0 m`) na osiach oraz **4 średnie bryły techniczne w ćwiartkach (`(±11, ±5)`, wys. `1,33–1,59 m`: dwa agregaty `city_generator`, paleta `city_crates`, kontener `city_dumpster`)**, które służą zarówno jako pełna osłona przed Snajperem/Strzelcem, jak i jako **4 punkty wysokie (podesty skokowe)**, na które gracz może wskoczyć zwykłym skokiem (`jump`), nie psując płaskiej siatki nawigacji wrogów i sojuszników (`y = 0`).
   - **Zewnętrzny Tor Obwodowy (`r = 13..18,5 m`)** — nieprzerwana pętla sprinterska wokół całej areny z osłonami przyściennymi (`city_stall`, `city_kiosk`, `city_vending`, `city_barrier`) i skrzyniami do Chwytu/Pchnięcia (`crate` + `crate_small`) w narożnikach.

### Różnica wobec `bossRoom` (_Sala zarządu Kurogane Arms_)

| Cecha                             | `bossRoom` (_Sala zarządu Kurogane Arms_)                                                                                                                           | `arena` (_Nielegalny Ring Walk „Klatka”_)                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tożsamość i miejsce w świecie** | Elitarny, strzeżony dziedziniec dowodzenia na szczycie korporacyjnej fortecy zbrojeniowej Kurogane Arms.                                                            | Podziemny, nielegalny ring gladiatorski w cieniu czynszówek Dolnego Miasta, prowadzony przez czarny rynek i ruch oporu Iskra.                                                                            |
| **Skala i układ przestrzeni**     | `30 × 30 m` (`28 × 28 m` wnętrza), układ **kierunkowy (Północ–Południe)**: gracz wchodzi od południa `(0, 11)` naprzeciw bossa `(0, -8)` i serwerowni `(0, -13,3)`. | `40 × 40 m` (`38 × 38 m` wnętrza), układ **dookolny / koncentryczny (`360°`)**: gracz startuje wewnątrz ringu `(0, 4)`, a fale nacierają ze wszystkich 8 bram na obwodzie.                               |
| **Architektura zadaszeń**         | Dwie głębokie, kryte galerie boczne (`6 × 14 m`) wzdłuż ścian zachodniej i wschodniej; środek całkowicie pusty pod obszarowy atak `slam` (`5,5 m`).                 | Dwie stalowe belki bramownicy (`1,6 × 13,6 m`) nad 4 centralnymi filarami `(±6, ±6)` spięte 4 sznurami lampionów + 3 krótkie okapy doków przy ścianach północnej i południowej.                          |
| **Paleta i klimat oświetlenia**   | Chłodna, korporacyjna dominanta królewskiego błękitu (`#3d7bff`) i ciepłej bieli (`#fff1d6`) z symetrycznym logo `holo_kurogane` i androidami `holo_android`.       | Wielobarwny, surowy kontrast uliczny: bursztynowe lampiony ringu (`#ffae1a`), zielony dok implantów (`#6dff4a`), fioletowy bar (`#8a5cff`), błękitny warsztat (`#3d7bff`) i ciepła biel na płycie ringu. |
| **Detale narracyjne**             | Czyste środowisko korporacyjne: serwerownia za ciemnym szkłem, winda ewakuacyjna M06, brak straganów, reklam ulicznych i graffiti.                                  | Żywy półświatek: stragan bukmacherski `city_stall`, automat `city_vending`, terminal walk `city_kiosk`, 4 bramy `city_shutter`, 4 śluzy `city_door`, murale `graffiti_iskra` / `graffiti_resist`.        |

---

## 3. Plan zmian gotowy dla programisty

Plan obejmuje **24 zmiany danych** w `src/data/scenes/arena.json` (uporządkowane od najważniejszych) oraz **osobną sekcję wymaganych zmian kodu** w `src/scenes/arena.ts` i `tests/unit/roomStaticBatch.test.ts`.

- **Zachowane bez zmian:** zewnętrzny wymiar podłogi `40 × 40 m` (`blocks[0]`), położenie 4 ścian obwodowych (`blocks[1..4]` na `±19,5 m`), `playerSpawn: { "x": 0, "y": 0, "z": 4 }`, konfiguracja `director` i statystyki gracza oraz wszystkie 8 punktów `spawnPoints` w `src/data/waves/arena.json`.
- **Zgodność z testami i audytem:** cały docelowy układ został zweryfikowany matematycznie pod kątem `arenaLayoutSchema`, `mapAudit` (**`0 error, 0 warn`**), `wallDecalFitsBlock`, osiągalności `validateLayout` / `buildFloorNavigation` oraz wszystkich 8 linii strzału wieżyczek z `tests/unit/arenaTurretSpawns.test.ts` (**`0` przecięć promieni wieżyczek z blokami osłon**).

### Priorytet 1 — Motyw Neon Noir, materiały istniejących bloków i naprawa geometrii `blocks[0..15]`

1. **Pole główne `"theme"` — przełączenie areny z testowego motywu `white` na `"neonStreet"`:**
   - **Ścieżka JSON:** główny obiekt `src/data/scenes/arena.json` (dodaj pole `"theme"` obok `"playerHealth"`).
   - **Co zrobić:** Dodaj `"theme": "neonStreet"`.
   - **Uzasadnienie:** Włącza nocne niebo, panoramę wieżowców, deszcz z burzą, mgłę wysokościową, tekstury powierzchni miejskich (`citySurfaceDetail: 1`), okna z atlasu na budynkach `facade` oraz odbicia neonów na mokrym asfalcie i w kałużach.

2. **`blocks[0]` (podłoga `40 × 1 × 40 m` w `(0, -0.5, 0)`) i `blocks[1..4]` (4 mury obwodowe na `±19,5 m`) — nadanie materiałów miejskich:**
   - **Ścieżki JSON:** `blocks[0]`, `blocks[1]`, `blocks[2]`, `blocks[3]`, `blocks[4]`.
   - **Co zrobić:**
     - W `blocks[0]` dodaj `"material": "asphalt"` (`size: { "x": 40, "y": 1, "z": 40 }`, `position: { "x": 0, "y": -0.5, "z": 0 }`).
     - W `blocks[1]`, `blocks[2]`, `blocks[3]`, `blocks[4]` dodaj `"material": "concrete"` (zachowując `"model": "wall"`, pozycje i wymiary).
   - **Uzasadnienie:** Zastępuje płaską białą siatkę `world` mokrym asfaltem odbijającym neony oraz teksturowanym betonem murów obwodowych.

3. **`blocks[5]`, `blocks[6]`, `blocks[7]`, `blocks[8]` (4 filary centralnego ringu w `(±6, 2, ±6)`) — pogrubienie przekroju i dodanie materiału `"concrete"`:**
   - **Ścieżki JSON:** `blocks[5]` `(-6, 2, -6)`, `blocks[6]` `(6, 2, -6)`, `blocks[7]` `(-6, 2, 6)`, `blocks[8]` `(6, 2, 6)`.
   - **Co zrobić:** W każdym z czterech bloków zmień `"size"` z `{ "x": 1, "y": 4, "z": 1 }` na **`{ "x": 1.5, "y": 4, "z": 1.5 }`** oraz dodaj `"material": "concrete"` (zachowując `"model": "pillar"` i pozycje `(±6, 2, ±6)`).
   - **Uzasadnienie:** Dotychczasowe słupki `1 × 1 m` były zbyt wąskie, by skutecznie osłonić gracza przed serią `gunner` lub celownikiem `sniper`. Przekrój `1,5 × 1,5 m` daje pewną osłonę w narożnikach wewnętrznego ringu, nie wchodząc w żadną z 8 linii testowych `arenaTurretSpawns.test.ts` (minimalny odstęp od promieni testowych to `2,4 m`).

4. **`blocks[9]`, `blocks[10]`, `blocks[11]`, `blocks[12]` (4 niskie osłony osiowe `cover_low` na `(0, 0.5, ±10)` i `(±10, 0.5, 0)`) — naprawa orientacji osłon wschodniej i zachodniej oraz poszerzenie:**
   - **Ścieżki JSON:** `blocks[9]`, `blocks[10]`, `blocks[11]`, `blocks[12]`.
   - **Co zrobić:** Dodaj we wszystkich czterech blokach `"material": "metal"` i zaktualizuj ich `"size"`:
     - `blocks[9]` (północ, `position: { "x": 0, "y": 0.5, "z": -10 }`): `"size": { "x": 2.6, "y": 1, "z": 0.8 }`, `"model": "cover_low"`, `"material": "metal"`
     - `blocks[10]` (zachód, `position: { "x": -10, "y": 0.5, "z": 0 }`): **`"size": { "x": 0.8, "y": 1, "z": 2.6 }`**, `"model": "cover_low"`, `"material": "metal"`
     - `blocks[11]` (wschód, `position: { "x": 10, "y": 0.5, "z": 0 }`): **`"size": { "x": 0.8, "y": 1, "z": 2.6 }`**, `"model": "cover_low"`, `"material": "metal"`
     - `blocks[12]` (południe, `position: { "x": 0, "y": 0.5, "z": 10 }`): `"size": { "x": 2.6, "y": 1, "z": 0.8 }`, `"model": "cover_low"`, `"material": "metal"`
   - **Uzasadnienie:** Naprawia błąd z `03-east.png` i `05-west.png`, gdzie `blocks[10]` i `blocks[11]` stały kantem (`0,6 m`) do środka areny i bocznych spawnów `(±16, 0)`. Ponieważ `cover_low` należy do `STRETCH_MODELS`, zamiana wymiarów na `0,8 × 1,0 × 2,6 m` (`size.z > size.x`) powoduje, że `placeBlockModel` automatycznie obraca model `cover_low.glb` o 90° wokół osi Y. Wysokość `1,0 m` i szerokość `2,6 m` (`±1,3 m` od osi) zachowują pełną drożność promieni wieżyczek z `(0, ±16) → (4, 0)` oraz `(±16, 0) → (0, 4)`, które w odległości `10 m` od środka przechodzą na współrzędnej `1,5 m > 1,3 m`.

### Priorytet 2 — Rozbudowa geometrii `blocks` (bramownica ringu, zadaszenia doków, średnie podesty skokowe, wysokie osłony obwodowe i fasady tła)

5. **Nowe bloki `blocks[16..17]` (2 stalowe belki bramownicy technicznej nad centralnym ringiem) — powiązanie konstrukcyjne 4 filarów `blocks[5..8]`:**
   - **Co zrobić:** Dodaj po `blocks[15]` dwie wzdłużne belki nośne spoczywające na głowicach filarów `(±6, 2, ±6)` (`y ∈ [4.0, 4.5]`):
     - `blocks[16]` (belka zachodnia): `{ "size": { "x": 1.6, "y": 0.5, "z": 13.6 }, "position": { "x": -6, "y": 4.25, "z": 0 }, "material": "metal" }`
     - `blocks[17]` (belka wschodnia): `{ "size": { "x": 1.6, "y": 0.5, "z": 13.6 }, "position": { "x": 6, "y": 4.25, "z": 0 }, "material": "metal" }`
   - **Uzasadnienie:** Kończy z wrażeniem „czterech wolnostojących słupów w pustym pokoju”, tworząc nad środkowym ringiem otwartą ramę suwnicową, która nie zasłania nieba ani hologramów w ujęciach `01-spawn.png`..`05-west.png` i nie zakrywa środka planszy w rzucie z góry `10-top.png`.

6. **Nowe bloki `blocks[18..20]` (3 zadaszenia doków obwodowych) + tablica `rainShelters`:**
   - **Co zrobić:** Dodaj 3 metalowe okapy osłaniające stanowiska obwodowe przy ścianie północnej (`z = -19.0`) i południowej (`z = 19.0`):
     - `blocks[18]` (okap północno-zachodni nad punktem bukmacherskim): `{ "size": { "x": 8, "y": 0.4, "z": 3.2 }, "position": { "x": -8, "y": 3.8, "z": -17.4 }, "material": "metal" }`
     - `blocks[19]` (okap północno-wschodni nad terminalem diagnostycznym): `{ "size": { "x": 8, "y": 0.4, "z": 3.2 }, "position": { "x": 8, "y": 3.8, "z": -17.4 }, "material": "metal" }`
     - `blocks[20]` (okap południowo-wschodni nad dokiem zawodnika): `{ "size": { "x": 8, "y": 0.4, "z": 3.2 }, "position": { "x": 8, "y": 3.8, "z": 17.4 }, "material": "metal" }`
       oraz dodaj na poziomie głównego obiektu JSON tablicę `rainShelters`:
     ```json
     "rainShelters": [
       { "position": { "x": -8, "y": 1.9, "z": -17.4 }, "size": { "x": 8, "y": 3.8, "z": 3.2 } },
       { "position": { "x": 8, "y": 1.9, "z": -17.4 }, "size": { "x": 8, "y": 3.8, "z": 3.2 } },
       { "position": { "x": 8, "y": 1.9, "z": 17.4 }, "size": { "x": 8, "y": 3.8, "z": 3.2 } }
     ]
     ```
   - **Uzasadnienie:** Tworzy suche, podświetlone kieszenie przyścienne o zupełnie innym układzie niż boczne galerie w `bossRoom`, zatrzymując smugi deszczu pod wszystkimi trzema okapami.

7. **Nowe bloki `blocks[21..24]` (4 średnie osłony z modelami `city_*` i punkty wysokie `y = 1,33–1,59 m` w czterech ćwiartkach środkowego pierścienia):**
   - **Co zrobić:** Dodaj 4 kolizyjne bloki o dokładnych wymiarach AABB z `mapModelBounds.json` (w natywnej orientacji `yaw = 0`):
     - `blocks[21]` (ćwiartka NW — agregat prądotwórczy): `{ "size": { "x": 1.6, "y": 1.4, "z": 1.005 }, "position": { "x": -11, "y": 0.7, "z": -5 }, "model": "city_generator", "material": "metal" }`
     - `blocks[22]` (ćwiartka SE — agregat prądotwórczy): `{ "size": { "x": 1.6, "y": 1.4, "z": 1.005 }, "position": { "x": 11, "y": 0.7, "z": 5 }, "model": "city_generator", "material": "metal" }`
     - `blocks[23]` (ćwiartka NE — paleta skrzyń przemysłowych): `{ "size": { "x": 1.212, "y": 1.59, "z": 1.256 }, "position": { "x": 11, "y": 0.795, "z": -5 }, "model": "city_crates", "material": "metal" }`
     - `blocks[24]` (ćwiartka SW — kontener stalowy): `{ "size": { "x": 1.97, "y": 1.33, "z": 1.08 }, "position": { "x": -11, "y": 0.665, "z": 5 }, "model": "city_dumpster", "material": "metal" }`
   - **Uzasadnienie:**
     - Przełamuje pustą przestrzeń między filarami `(±6, ±6)` a ścianami `(±19 m)`, dając pełną osłonę przed Snajperami i Strzelcami oraz rozdzielając środkowy pierścień na czytelne korytarze flankowania Tarczowników.
     - Wszystkie 4 bryły mają wysokość `1,33–1,59 m`, na którą gracz może **wskoczyć zwykłym skokiem (`jump`)**, zyskując 4 punkty wysokie („high ground”) ponad falami Szturmowców bez blokowania naziemnej nawigacji AI.

8. **Nowe bloki `blocks[25..28]` (4 osłony obwodowe o zróżnicowanej wysokości `0,93–2,62 m` przy ścianach północnej i południowej):**
   - **Co zrobić:** Dodaj 4 kolizyjne modele miejskie pod okapami doków i przy torze obwodowym (dokładne wymiary z `mapModelBounds.json`):
     - `blocks[25]` (północny zachód — stragan bukmacherski / bar pod okapem NW): `{ "size": { "x": 3, "y": 2.622, "z": 2.043 }, "position": { "x": -8, "y": 1.311, "z": -17.8 }, "model": "city_stall", "material": "metal" }`
     - `blocks[26]` (północny wschód — terminal diagnostyczny pod okapem NE): `{ "size": { "x": 0.8, "y": 2.235, "z": 0.6238 }, "position": { "x": 8, "y": 1.1175, "z": -18.3 }, "model": "city_kiosk", "material": "metal" }`
     - `blocks[27]` (południowy wschód — automat ze stymulantami pod okapem SE): `{ "size": { "x": 1.014, "y": 2, "z": 0.816 }, "position": { "x": 8, "y": 1, "z": 18.4 }, "model": "city_vending", "material": "metal" }`
     - `blocks[28]` (południowy zachód — betonowa zapora z lampą ostrzegawczą): `{ "size": { "x": 2, "y": 0.9288, "z": 0.51 }, "position": { "x": -8, "y": 0.4644, "z": 15.5 }, "model": "city_barrier", "material": "concrete" }`
   - **Uzasadnienie:** Buduje wiarygodną narrację podziemnego ringu walk, odcina skrajnie długie linie strzału wzdłuż ścian północnej i południowej (między spawnami narożnymi `(±15, ±15)` a osiowymi `(0, ±16)`), a jednocześnie zostawia minimum `4,5 m` szerokiego przelotu na zewnętrznej pętli biegowej (zero martwych zaułków).

9. **Nowe bloki `blocks[29..30]` (uzupełnienie zniszczalnych i dynamicznych skrzyń `crate` / `crate_small` w ćwiartkach NE i NW):**
   - **Co zrobić:** Dodaj dwie skrzynie dopełniające istniejące `blocks[13..15]`:
     - `blocks[29]` (skrzynia `crate` w ćwiartce NE): `{ "size": { "x": 1, "y": 1, "z": 1 }, "position": { "x": 12, "y": 0.5, "z": -12 }, "model": "crate" }`
     - `blocks[30]` (dynamiczna skrzynka `crate_small` obok `blocks[13]` w ćwiartce NW): `{ "size": { "x": 0.5, "y": 0.5, "z": 0.5 }, "position": { "x": -12.8, "y": 0.25, "z": -12.2 }, "model": "crate_small" }`
   - **Uzasadnienie:** Zapewnia symetryczną dostępność obiektów fizycznych (`PropPhysicsSystem`) po obu stronach areny dla graczy korzystających z Pchnięcia Rezonansu i wybuchów.

10. **Nowe bloki `blocks[31..38]` (8 wysokich budynków tła `material: "facade"` wokół murów `±20 m`):**
    - **Co zrobić:** Dodaj 8 brył otaczających czynszówek i magazynów (`wysokość 18–24 m`), których wewnętrzne lica stykają się dokładnie z zewnętrznymi licami murów `blocks[1..4]` na `x = ±20,0 m` oraz `z = ±20,0 m`:
      - `blocks[31]` (zachód-północ): `{ "size": { "x": 6, "y": 22, "z": 16 }, "position": { "x": -23, "y": 11, "z": -10 }, "material": "facade" }`
      - `blocks[32]` (zachód-południe): `{ "size": { "x": 6, "y": 20, "z": 16 }, "position": { "x": -23, "y": 10, "z": 10 }, "material": "facade" }`
      - `blocks[33]` (wschód-północ): `{ "size": { "x": 6, "y": 20, "z": 16 }, "position": { "x": 23, "y": 10, "z": -10 }, "material": "facade" }`
      - `blocks[34]` (wschód-południe): `{ "size": { "x": 6, "y": 22, "z": 16 }, "position": { "x": 23, "y": 11, "z": 10 }, "material": "facade" }`
      - `blocks[35]` (północ-zachód): `{ "size": { "x": 16, "y": 24, "z": 6 }, "position": { "x": -10, "y": 12, "z": -23 }, "material": "facade" }`
      - `blocks[36]` (północ-wschód): `{ "size": { "x": 16, "y": 20, "z": 6 }, "position": { "x": 10, "y": 10, "z": -23 }, "material": "facade" }`
      - `blocks[37]` (południe-zachód): `{ "size": { "x": 16, "y": 18, "z": 6 }, "position": { "x": -10, "y": 9, "z": 23 }, "material": "facade" }`
      - `blocks[38]` (południe-wschód): `{ "size": { "x": 16, "y": 22, "z": 6 }, "position": { "x": 10, "y": 11, "z": 23 }, "material": "facade" }`
    - **Uzasadnienie:** Zamyka dziedziniec w kanionie miejskim Neon Noir z proceduralnymi oknami z atlasu (`windows_lit.webp` / `windows_dark.webp`), daje pionowe ściany nośne na `x = ±20,0 m` pod mocowanie przewodów `city_cable_span` i instalacji elewacyjnych oraz zostawia4-metrowe prześwity w osiach `x = 0` i `z = 0` otwierające widok na daleką panoramę wieżowców.

### Priorytet 3 — Oświetlenie punktowe (`lights[0..7]`, dokładnie 8 źródeł w limicie ADR 0006 pkt 7)

11. **Nowa tablica `lights[0..1]` — oświetlenie centralnego ringu pod bramownicą ciepłą bielą (`#fff1d6`):**
    - **Co zrobić:** Dodaj dwa główne światła robocze ringu zawieszone przy wewnętrznych krawędziach belek bramownicy:
      - `lights[0]` (środek-zachód): `{ "position": { "x": -4.5, "y": 3.8, "z": 0 }, "color": "#fff1d6", "intensity": 20, "range": 15 }`
      - `lights[1]` (środek-wschód): `{ "position": { "x": 4.5, "y": 3.8, "z": 0 }, "color": "#fff1d6", "intensity": 20, "range": 15 }`
    - **Uzasadnienie:** Gwarantuje wzorową czytelność walki wręcz, parowania i telegrafów ataków w centrum mapy oraz odbicia w czterech kałużach wokół filarów.

12. **Nowe wpisy `lights[2..5]` — kodowanie barwne czterech osiowych bram zrzutowych wrogów (4 kierunki świata = 4 kolory ADR 0006):**
    - **Co zrobić:** Dodaj 4 światła nad osiowymi punktami spawnu `(0, ±16)` i `(±16, 0)`:
      - `lights[2]` (brama północna — bursztyn): `{ "position": { "x": 0, "y": 3.6, "z": -15 }, "color": "#ffae1a", "intensity": 16, "range": 14 }`
      - `lights[3]` (brama południowa — błękit królewski): `{ "position": { "x": 0, "y": 3.6, "z": 15 }, "color": "#3d7bff", "intensity": 16, "range": 14 }`
      - `lights[4]` (brama zachodnia — fiolet): `{ "position": { "x": -15, "y": 3.6, "z": 0 }, "color": "#8a5cff", "intensity": 16, "range": 14 }`
      - `lights[5]` (brama wschodnia — zieleń): `{ "position": { "x": 15, "y": 3.6, "z": 0 }, "color": "#6dff4a", "intensity": 16, "range": 14 }`
    - **Uzasadnienie:** Każda z czterech ścian areny ma własną dominantę barwną z dozwolonej palety ADR 0006, dzięki czemu gracz po obrocie kamery natychmiast orientuje się w przestrzeni, a sylwetki nadbiegających ze spawnów wrogów są podświetlone od góry i od tyłu.

13. **Nowe wpisy `lights[6..7]` — doświetlenie zadaszonych doków północnych (straganu `city_stall` i terminala `city_kiosk`):**
    - **Co zrobić:** Dodaj 2 światła pod okapami `blocks[18]` i `blocks[19]` (`y = 3.3 < 3.6`):
      - `lights[6]` (pod okapem NW): `{ "position": { "x": -8, "y": 3.3, "z": -17.2 }, "color": "#ffae1a", "intensity": 14, "range": 11 }`
      - `lights[7]` (pod okapem NE): `{ "position": { "x": 8, "y": 3.3, "z": -17.2 }, "color": "#6dff4a", "intensity": 14, "range": 11 }`
    - **Uzasadnienie:** Wydobywa z cienia bryły straganu i kiosku na pierwszym planie ujęć `01-spawn.png` i `02-north.png`. Łączna liczba świateł punktowych w scenie wynosi dokładnie **8** (w `decor` nie używamy `city_street_lamp`, a `city_lantern_string` generuje wyłącznie stożki `LampCones` bez dodatkowych `PointLight`), więc żadne źródło nie gaśnie przy ruchu kamery.

### Priorytet 4 — Szyldy neonowe i hologramy (`signs[0..9]`)

14. **Nowe wpisy `signs[0..1]` — główne neony osi północ–południe (`ISKRA` i `ARCADE`) nad bramami zrzutowymi:**
    - **Co zrobić:** Dodaj dwa neony zamocowane na wewnętrznych licach murów `blocks[1..2]` (`z = ∓18.95`) na wysokości `y = 3.45 m` (ponad 3-metrowymi roletami `city_shutter`):
      - `signs[0]` (północ): `{ "kind": "neon", "texture": "iskra", "position": { "x": 0, "y": 3.45, "z": -18.95 }, "size": { "w": 2.8, "h": 0.9 }, "yaw": 0, "tint": "#ffae1a", "flicker": 0.1 }`
      - `signs[1]` (południe): `{ "kind": "neon", "texture": "arcade", "position": { "x": 0, "y": 3.45, "z": 18.95 }, "size": { "w": 2.8, "h": 0.9 }, "yaw": 3.1416, "tint": "#8a5cff", "flicker": 0.1 }`
    - **Uzasadnienie:** Tworzy wyraźne punkty centralne na osi Północ (`01-spawn.png`, `02-north.png`) i Południe (`04-south.png`) bez kolizji z okapami `blocks[18..20]`.

15. **Nowe wpisy `signs[2..5]` — 4 neony lokalnych punktów usługowych wokół ringu na ścianach zachodniej i wschodniej:**
    - **Co zrobić:** Dodaj 4 neony na wewnętrznych licach ścian `blocks[3..4]` (`x = ∓18.95, y = 3.1`):
      - `signs[2]` (zachód-północ): `{ "kind": "neon", "texture": "bar_24h", "position": { "x": -18.95, "y": 3.1, "z": -8 }, "size": { "w": 2.8, "h": 1.0 }, "yaw": 1.5708, "tint": "#8a5cff", "flicker": 0.12 }`
      - `signs[3]` (zachód-południe): `{ "kind": "neon", "texture": "ramen", "position": { "x": -18.95, "y": 3.1, "z": 8 }, "size": { "w": 2.6, "h": 1.0 }, "yaw": 1.5708, "tint": "#ffae1a", "flicker": 0.15 }`
      - `signs[4]` (wschód-północ): `{ "kind": "neon", "texture": "implants", "position": { "x": 18.95, "y": 3.1, "z": -8 }, "size": { "w": 2.8, "h": 1.0 }, "yaw": -1.5708, "tint": "#6dff4a", "flicker": 0.15 }`
      - `signs[5]` (wschód-południe): `{ "kind": "neon", "texture": "warsztat", "position": { "x": 18.95, "y": 3.1, "z": 8 }, "size": { "w": 3.0, "h": 1.0 }, "yaw": -1.5708, "tint": "#3d7bff", "flicker": 0.12 }`
    - **Uzasadnienie:** Wszystkie 4 szyldy mają pełne podparcie na murach `blocks[3..4]`, nie są przysłonięte żadnym zadaszeniem i wzmacniają kodowanie kolorystyczne flanki zachodniej (fiolet/bursztyn) oraz wschodniej (zieleń/błękit).

16. **Nowe wpisy `signs[6..9]` — 4 wielkie hologramy nad koronami murów współpracujące z projektorami `city_holo_projector`:**
    - **Co zrobić:** Dodaj 4 hologramy na wysokości `y = 8.74 m` (przy `size.h = 4.5 m` wierzchołek stożka projektora `y - h` wypada dokładnie na `y = 4.24 m`, czyli na soczewce projektora `city_holo_projector` stojącego na koronie muru `y = 4.0 m` przy `scale = 1.2`):
      - `signs[6]` (północ-zachód): `{ "kind": "holo", "texture": "holo_koi", "position": { "x": -10, "y": 8.74, "z": -19.5 }, "size": { "w": 6, "h": 4.5 }, "yaw": 0, "tint": "#ffae1a", "flicker": 0.15 }`
      - `signs[7]` (północ-wschód): `{ "kind": "holo", "texture": "holo_jellyfish", "position": { "x": 10, "y": 8.74, "z": -19.5 }, "size": { "w": 5, "h": 4.5 }, "yaw": 0, "tint": "#8a5cff", "flicker": 0.18 }`
      - `signs[8]` (zachód): `{ "kind": "holo", "texture": "holo_implant", "position": { "x": -19.5, "y": 8.74, "z": 0 }, "size": { "w": 6, "h": 4.5 }, "yaw": 1.5708, "tint": "#6dff4a", "flicker": 0.15 }`
      - `signs[9]` (wschód): `{ "kind": "holo", "texture": "holo_cat", "position": { "x": 19.5, "y": 8.74, "z": 0 }, "size": { "w": 5, "h": 4.5 }, "yaw": -1.5708, "tint": "#3d7bff", "flicker": 0.15 }`
    - **Uzasadnienie:** Buduje drugi, wysoki plan świetlny nad murami i daje wyraziste odbicia w kałużach na obwodzie areny (w tym podczas mutatora `darkness`).

### Priorytet 5 — Dekoracje bez kolizji (`decor[0..23]`) z dokładnymi współrzędnymi zaczepienia kabli i lampionów

17. **Nowe wpisy `decor[0..3]` (4 sznury lampionów `city_lantern_string` wokół centralnego ringu) — oba końce zaczepione w filarach `blocks[5..8]`:**
    - **Co zrobić:** Dodaj 4 sznury lampionów (`scale: 1.2`, `y = 3.9`, lokalne końce z `mapModelBounds.json`: `[-5, -0.14, 0.08]` i `[5, -0.14, 0.08]`):
      - `decor[0]` (północny, między `blocks[5]` a `blocks[6]`):
        `{ "model": "city_lantern_string", "position": { "x": 0, "y": 3.9, "z": -6 }, "yaw": 0, "scale": 1.2 }`
        - koniec zachodni: **`(-6.00, 3.732, -5.904)`** — wewnątrz filara NW `blocks[5]` (`x ∈ [-6.75, -5.25], y ∈ [0, 4.0], z ∈ [-6.75, -5.25]`),
        - koniec wschodni: **`(6.00, 3.732, -5.904)`** — wewnątrz filara NE `blocks[6]` (`x ∈ [5.25, 6.75], y ∈ [0, 4.0], z ∈ [-6.75, -5.25]`).
      - `decor[1]` (południowy, między `blocks[7]` a `blocks[8]`):
        `{ "model": "city_lantern_string", "position": { "x": 0, "y": 3.9, "z": 6 }, "yaw": 0, "scale": 1.2 }`
        - koniec zachodni: **`(-6.00, 3.732, 6.096)`** — wewnątrz filara SW `blocks[7]` (`x ∈ [-6.75, -5.25], y ∈ [0, 4.0], z ∈ [5.25, 6.75]`),
        - koniec wschodni: **`(6.00, 3.732, 6.096)`** — wewnątrz filara SE `blocks[8]` (`x ∈ [5.25, 6.75], y ∈ [0, 4.0], z ∈ [5.25, 6.75]`).
      - `decor[2]` (zachodni, pod belką `blocks[16]` między `blocks[5]` a `blocks[7]`):
        `{ "model": "city_lantern_string", "position": { "x": -6, "y": 3.9, "z": 0 }, "yaw": 1.5708, "scale": 1.2 }`
        - koniec południowy: **`(-5.904, 3.732, 6.00)`** — wewnątrz filara SW `blocks[7]`,
        - koniec północny: **`(-5.904, 3.732, -6.00)`** — wewnątrz filara NW `blocks[5]`.
      - `decor[3]` (wschodni, pod belką `blocks[17]` między `blocks[6]` a `blocks[8]`):
        `{ "model": "city_lantern_string", "position": { "x": 6, "y": 3.9, "z": 0 }, "yaw": -1.5708, "scale": 1.2 }`
        - koniec północny: **`(5.904, 3.732, -6.00)`** — wewnątrz filara NE `blocks[6]`,
        - koniec południowy: **`(5.904, 3.732, 6.00)`** — wewnątrz filara SE `blocks[8]`.

18. **Nowe wpisy `decor[4..5]` (2 przewody `city_cable_span` rozpięte wysoko nad areną) — oba końce zaczepione w licach fasad `blocks[31..34]` na `x = ±20,0 m`:**
    - **Co zrobić:** Dodaj 2 wiązki kabli (`scale: 4.0`, `yaw: 0`, lokalne końce z `mapModelBounds.json`: `[-5, -0.06, -0.19]` i `[5, 0, -0.205]`):
      - `decor[4]` (kabel północny):
        `{ "model": "city_cable_span", "position": { "x": 0, "y": 14.5, "z": -10 }, "yaw": 0, "scale": 4.0 }`
        - koniec zachodni: **`(-20.00, 14.26, -10.76)`** — dokładnie na wschodnim licu fasady `blocks[31]` (`x = -20.0, y ∈ [0, 22], z ∈ [-18, -2]`),
        - koniec wschodni: **`(20.00, 14.50, -10.82)`** — dokładnie na zachodnim licu fasady `blocks[33]` (`x = 20.0, y ∈ [0, 20], z ∈ [-18, -2]`).
      - `decor[5]` (kabel południowy):
        `{ "model": "city_cable_span", "position": { "x": 0, "y": 15.0, "z": 10 }, "yaw": 0, "scale": 4.0 }`
        - koniec zachodni: **`(-20.00, 14.76, 9.24)`** — dokładnie na wschodnim licu fasady `blocks[32]` (`x = -20.0, y ∈ [0, 20], z ∈ [2, 18]`),
        - koniec wschodni: **`(20.00, 15.00, 9.18)`** — dokładnie na zachodnim licu fasady `blocks[34]` (`x = 20.0, y ∈ [0, 22], z ∈ [2, 18]`).
    - **Uzasadnienie:** Zawieszenie na `y = 14,5–15,0 m` sprawia, że najniższy punkt zwisu kabla (`y ≈ 10,08 m` przy `z = -10`) w widoku ze spawnu `(0, 1.6, 4)` rzutuje się na północną płaszczyznę hologramów na wysokości `y = 15,84 m` — ponad `4,8 m` powyżej górnej krawędzi hologramów `signs[6..7]` (`y_max = 10,99 m`), więc kable nigdy nie przecinają hologramów w kadrze.

19. **Nowe wpisy `decor[6..13]` — 4 stalowe rolety `city_shutter` i 4 drzwi śluz `city_door` oznaczające wszystkie 8 punktów spawnu wrogów:**
    - **Co zrobić:** Dodaj na wewnętrznych licach murów `blocks[1..4]` (`±19,0 m`):
      - 4 rolety osiowe naprzeciw spawnów `(0, -16)`, `(0, 16)`, `(-16, 0)`, `(16, 0)`:
        - `decor[6]`: `{ "model": "city_shutter", "position": { "x": 0, "y": 0, "z": -19 }, "yaw": 0, "scale": 1 }`
        - `decor[7]`: `{ "model": "city_shutter", "position": { "x": 0, "y": 0, "z": 19 }, "yaw": 3.1416, "scale": 1 }`
        - `decor[8]`: `{ "model": "city_shutter", "position": { "x": -19, "y": 0, "z": 0 }, "yaw": 1.5708, "scale": 1 }`
        - `decor[9]`: `{ "model": "city_shutter", "position": { "x": 19, "y": 0, "z": 0 }, "yaw": -1.5708, "scale": 1 }`
      - 4 drzwi śluz narożnych naprzeciw spawnów `(-15, -15)`, `(15, -15)`, `(-15, 15)`, `(15, 15)`:
        - `decor[10]`: `{ "model": "city_door", "position": { "x": -15, "y": 0, "z": -19 }, "yaw": 0, "scale": 1.1 }`
        - `decor[11]`: `{ "model": "city_door", "position": { "x": 15, "y": 0, "z": -19 }, "yaw": 0, "scale": 1.1 }`
        - `decor[12]`: `{ "model": "city_door", "position": { "x": -15, "y": 0, "z": 19 }, "yaw": 3.1416, "scale": 1.1 }`
        - `decor[13]`: `{ "model": "city_door", "position": { "x": 15, "y": 0, "z": 19 }, "yaw": 3.1416, "scale": 1.1 }`
    - **Uzasadnienie:** Modele `city_shutter` (głębokość `0,25 m < 0,5 m`) i `city_door` (głębokość `0,238 m < 0,5 m`) należą do `WALL_FIXTURES` przylegających do murów obwodowych (nie wywołują `noCollisionLargeProp`) i czytelnie wskazują graczowi 8 wejść fal.

20. **Nowe wpisy `decor[14..23]` — 4 projektory hologramów na koronach murów, 2 kratki wentylacyjne i 6 detali instalacji na fasadach:**
    - **Co zrobić:** Dodaj:
      - 4 projektory `city_holo_projector` na wierzchu murów `y = 4,0 m` dokładnie pod hologramami `signs[6..9]`:
        - `decor[14]`: `{ "model": "city_holo_projector", "position": { "x": -10, "y": 4, "z": -19.5 }, "yaw": 0, "scale": 1.2 }`
        - `decor[15]`: `{ "model": "city_holo_projector", "position": { "x": 10, "y": 4, "z": -19.5 }, "yaw": 0, "scale": 1.2 }`
        - `decor[16]`: `{ "model": "city_holo_projector", "position": { "x": -19.5, "y": 4, "z": 0 }, "yaw": 1.5708, "scale": 1.2 }`
        - `decor[17]`: `{ "model": "city_holo_projector", "position": { "x": 19.5, "y": 4, "z": 0 }, "yaw": -1.5708, "scale": 1.2 }`
      - 2 płaskie kratki wentylacyjne `city_vent_grate` (`wys. 0,05 m`) na podłodze pod emiterami pary:
        - `decor[18]`: `{ "model": "city_vent_grate", "position": { "x": -14, "y": 0, "z": -8 }, "yaw": 0, "scale": 1 }`
        - `decor[19]`: `{ "model": "city_vent_grate", "position": { "x": 14, "y": 0, "z": 8 }, "yaw": 0, "scale": 1 }`
      - 2 klimatyzatory `city_ac_unit`, 2 piony rur `city_pipe_run` (podstawy na `y = 3,5 m` schowane za murem `4,0 m`) i 2 anteny dachowe `city_antenna` na fasadach `blocks[31..35]`:
        - `decor[20]`: `{ "model": "city_ac_unit", "position": { "x": -20, "y": 6.5, "z": -10 }, "yaw": 1.5708, "scale": 1.3 }`
        - `decor[21]`: `{ "model": "city_ac_unit", "position": { "x": 20, "y": 6.5, "z": 10 }, "yaw": -1.5708, "scale": 1.3 }`
        - `decor[22]`: `{ "model": "city_pipe_run", "position": { "x": -20, "y": 3.5, "z": 8 }, "yaw": 1.5708, "scale": 1.1 }`
        - `decor[23]`: `{ "model": "city_pipe_run", "position": { "x": 20, "y": 3.5, "z": -8 }, "yaw": -1.5708, "scale": 1.1 }`
        - `decor[24]`: `{ "model": "city_antenna", "position": { "x": -10, "y": 24, "z": -23 }, "yaw": 0.2, "scale": 1.6 }`
        - `decor[25]`: `{ "model": "city_antenna", "position": { "x": 23, "y": 22, "z": 10 }, "yaw": -0.3, "scale": 1.6 }`

### Priorytet 6 — Kalkomanie (`decals[0..11]`) i efekty otoczenia (`ambientFx[0..5]`)

21. **Nowe wpisy `decals[0..3]` — 4 kałuże refleksyjne (`puddle1` / `puddle2`) w narożnikach środkowego pierścienia:**
    - **Co zrobić:** Dodaj 4 kałuże na asfalcie w punktach `(±9, 0.01, ±9)`:
      - `decals[0]`: `{ "texture": "puddle1", "position": { "x": -9, "y": 0.01, "z": -9 }, "size": { "w": 4.2, "h": 3.6 }, "yaw": 0.4, "surface": "floor", "opacity": 0.8 }`
      - `decals[1]`: `{ "texture": "puddle2", "position": { "x": 9, "y": 0.01, "z": 9 }, "size": { "w": 4.2, "h": 3.4 }, "yaw": 1.2, "surface": "floor", "opacity": 0.8 }`
      - `decals[2]`: `{ "texture": "puddle1", "position": { "x": -9, "y": 0.01, "z": 9 }, "size": { "w": 3.8, "h": 3.2 }, "yaw": 2.1, "surface": "floor", "opacity": 0.75 }`
      - `decals[3]`: `{ "texture": "puddle2", "position": { "x": 9, "y": 0.01, "z": -9 }, "size": { "w": 3.8, "h": 3.2 }, "yaw": -0.6, "surface": "floor", "opacity": 0.75 }`
    - **Uzasadnienie:** Rozmieszczenie kałuż po przekątnych między filarami `(±6, ±6)` a skrzyniami `(±12, ±12)` daje mocne odbicia lampionów, neonów i hologramów zarówno ze spawnu (`01-spawn.png`), jak i z ujęć narożnych (`06-corner-nw.png`, `07-corner-se.png`).

22. **Nowe wpisy `decals[4..7]` — 4 oznaczenia stref zrzutu wrogów (`floor_hazard`) na osiowych punktach spawnu `(0, ±16)` i `(±16, 0)`:**
    - **Co zrobić:** Dodaj:
      - `decals[4]`: `{ "texture": "floor_hazard", "position": { "x": 0, "y": 0.01, "z": -16 }, "size": { "w": 3.2, "h": 2.4 }, "yaw": 0, "surface": "floor", "opacity": 0.65 }`
      - `decals[5]`: `{ "texture": "floor_hazard", "position": { "x": 0, "y": 0.01, "z": 16 }, "size": { "w": 3.2, "h": 2.4 }, "yaw": 0, "surface": "floor", "opacity": 0.65 }`
      - `decals[6]`: `{ "texture": "floor_hazard", "position": { "x": -16, "y": 0.01, "z": 0 }, "size": { "w": 2.4, "h": 3.2 }, "yaw": 0, "surface": "floor", "opacity": 0.65 }`
      - `decals[7]`: `{ "texture": "floor_hazard", "position": { "x": 16, "y": 0.01, "z": 0 }, "size": { "w": 2.4, "h": 3.2 }, "yaw": 0, "surface": "floor", "opacity": 0.65 }`
    - **Uzasadnienie:** Wizualnie ostrzega gracza na podłodze o strefach pojawiania się wrogów (w tym stacjonarnych Wieżyczek `turret`) przed czterema roletami `city_shutter`.

23. **Nowe wpisy `decals[8..11]` — 4 kalkomanie ścienne (`graffiti_iskra`, `graffiti_resist`, `leak_streak`) na murach `blocks[3..4]`:**
    - **Co zrobić:** Dodaj 4 naklejki ścienne (wszystkie mieszczą się w obrysie ścian `blocks[3..4]` wg `wallDecalFitsBlock`):
      - `decals[8]` (ściana zachodnia): `{ "texture": "graffiti_iskra", "position": { "x": -19, "y": 2, "z": -8 }, "size": { "w": 2.8, "h": 2 }, "yaw": 1.5708, "surface": "wall", "opacity": 0.75 }`
      - `decals[9]` (ściana wschodnia): `{ "texture": "graffiti_resist", "position": { "x": 19, "y": 2, "z": -8 }, "size": { "w": 2.8, "h": 1.8 }, "yaw": -1.5708, "surface": "wall", "opacity": 0.7 }`
      - `decals[10]` (ściana zachodnia — zaciek): `{ "texture": "leak_streak", "position": { "x": -19, "y": 2.2, "z": 10 }, "size": { "w": 1.6, "h": 2.4 }, "yaw": 1.5708, "surface": "wall", "opacity": 0.65 }`
      - `decals[11]` (ściana wschodnia — zaciek): `{ "texture": "leak_streak", "position": { "x": 19, "y": 2.2, "z": 10 }, "size": { "w": 1.6, "h": 2.4 }, "yaw": -1.5708, "surface": "wall", "opacity": 0.65 }`
    - **Uzasadnienie:** W przeciwieństwie do korporacyjnego `bossRoom`, w podziemnym ringu walk Dolnego Miasta murale ruchu oporu Iskra (`graffiti_iskra`, `graffiti_resist`) są w pełni uzasadnione narracyjnie i przełamują długie betonowe płaszczyzny ścian bocznych.

24. **Nowa tablica `ambientFx[0..5]` — para z kratek wentylacyjnych, iskry przy roletach zrzutowych i kapanie z okapów:**
    - **Co zrobić:** Dodaj 6 emiterów cząsteczkowych:
      ```json
      "ambientFx": [
        { "kind": "steam", "position": { "x": -14, "y": 0.05, "z": -8 }, "rate": 5 },
        { "kind": "steam", "position": { "x": 14, "y": 0.05, "z": 8 }, "rate": 5 },
        { "kind": "sparks", "position": { "x": 0, "y": 2.9, "z": -18.75 }, "rate": 0.6 },
        { "kind": "sparks", "position": { "x": -18.75, "y": 2.9, "z": 0 }, "rate": 0.6 },
        { "kind": "drip", "position": { "x": -8, "y": 3.8, "z": -15.8 }, "rate": 2 },
        { "kind": "drip", "position": { "x": 8, "y": 3.8, "z": -15.8 }, "rate": 2 }
      ]
      ```

---

### Wymagane zmiany kodu (analiza obsługi pól w `src/scenes/arena.ts` względem `src/scenes/roomScene.ts`)

Weryfikacja kodu `src/scenes/arena.ts` wykazała, że schemat `arenaLayoutSchema` (`src/scenes/arena.ts:135-149`) rozszerza `...dressingFields` (`src/world/dressingSchema.ts:192-210`), a `Arena.init()` tworzy zarówno `SceneAtmosphere` (linia 340), jak i `loadDecor` (linia 362) oraz `CityDressing` (linia 364). Oznacza to, że **`theme`, `weather`, `lights`, `signs`, `decor`, `decals`, `ambientFx`, `rainShelters` oraz `blocks[].material` i `blocks[].model` (w tym modele `city_*` przez `isCityModelFile` i `placeBlockModel`) są już obsługiwane przez `src/scenes/arena.ts`**.

Istnieją jednak **trzy konkretne różnice w kodzie `src/scenes/arena.ts` (oraz w teście budżetu siatek)** względem `RoomScene`, które programista wdrażający przebudowę powinien zaktualizować:

1. **WYMAGANE — Scalanie (`batchStaticGeometry`) dla `layout.decor` w `src/scenes/arena.ts:362` oraz aktualizacja `ARENA_SCENE_MESH_BUDGET` w `tests/unit/roomStaticBatch.test.ts:249`:**
   - **Stan obecny w kodzie:** W `RoomScene.init()` (`src/scenes/roomScene.ts:476-494`) modele `layout.decor` są ładowane do osobnej grupy `const decor = new Group(); decor.name = 'static-decor';` i scalane po materiałach przez `batchStaticGeometry(decor, this.geometries)`. Natomiast w `Arena.init()` (`src/scenes/arena.ts:362`) wywoływane jest `await loadDecor(this.root, layout.decor, this.loadModels);` bezpośrednio do `this.root` **bez** scalania `batchStaticGeometry`!
   - **Dlaczego to wymagana zmiana kodu:** Każdy model `city_*` w `decor` składa się z kilku–kilkunastu osobnych obiektów `Mesh`. Obecna pusta arena (0 `decor`, 0 `signs`, 0 `lights`, motyw `white` bez panoramy i deszczu) tworzy już `217` siatek `Mesh`, a test `tests/unit/roomStaticBatch.test.ts:249` ma sztywny budżet `const ARENA_SCENE_MESH_BUDGET = 260`. Po włączeniu `theme: "neonStreet"` (panorama miasta `+7` meshy, deszcz `+3` meshe), dodaniu `10` szyldów/hologramów, `8` plam świateł, `12` kalkomanii, `3` efektów `ambientFx`, stożków lampionów i `26` dekoracji `decor`, scena bez scalania `static-decor` przekroczy `260` meshy i nie przejdzie `tests/unit/roomStaticBatch.test.ts`.
   - **Co zmienić w kodzie:**
     - W `src/scenes/arena.ts` (linie 360–363): utworzyć grupę `const decor = new Group(); decor.name = 'static-decor'; this.root.add(decor);`, wywołać `await loadDecor(decor, layout.decor, this.loadModels);` i po załadowaniu wywołać `batchStaticGeometry(decor, this.geometries);` (dokładnie jak w `RoomScene`).
     - W `tests/unit/roomStaticBatch.test.ts` (linie 249–308): dopisać `'static-decor'` obok `'static-blocks'` i `'static-models'` oraz zaktualizować `ARENA_SCENE_MESH_BUDGET` z komentarzem pomiarowym dla pełnej oprawy `neonStreet` (ok. `340–380`, analogicznie do dawnego budżetu małych pokoi `340 + 15%`).

2. **ZALECANE — Przekazanie `ctx.audio` do `CityDressing` w `src/scenes/arena.ts:364-370`:**
   - **Stan obecny w kodzie:** `RoomScene` (`src/scenes/roomScene.ts:496-505`) przekazuje `ctx.audio` jako szósty argument konstruktora `new CityDressing(..., ctx.audio)`, podczas gdy `Arena` (`src/scenes/arena.ts:364-370`) wywołuje `new CityDressing(this.root, layout, this.atmosphere.theme, layout.playerSpawn.y, 'arena')` bez `ctx.audio`. Dopisanie `ctx.audio` ujednolica obsługę dźwięku pogody z pokojami runu.

3. **INFORMACYJNE (niewymagane dla powyższego planu JSON, ale ważne przy dalszej rozbudowie) — brak `block.rotation` w `arenaLayoutSchema` (`src/scenes/arena.ts:140-147`) i `Arena.buildLayout()` (`src/scenes/arena.ts:787-821`):**
   - `arenaLayoutSchema` nie posiada pola `rotation: vec3.optional()` w `blocks[]`, a `Arena.buildLayout()` nie obraca koliderów ani modeli `city_*` o kwaternion obrotu (w przeciwieństwie do `RoomScene.buildLayout()` w `src/scenes/roomScene.ts:1143-1210`).
   - W powyższym planie JSON **wszystkie modele `city_*` w `blocks[21..28]` zostały dobrane i ustawione w swojej natywnej orientacji `yaw = 0`**, a boczne osłony `blocks[10..11]` (`cover_low`, `0,8 × 1,0 × 2,6 m`) obracają się automatycznie o 90° wewnątrz `placeBlockModel` (dzięki przynależności `cover_low` do `STRETCH_MODELS`), więc powyższy plan działa bez dodawania `rotation` do `arena.ts`.

---

## 4. Kryteria odbioru dla zrzutów po zmianach

Po wdrożeniu zmian w `src/data/scenes/arena.json` (oraz scalenia `static-decor` w `src/scenes/arena.ts`), uruchomieniu `node tools/levels/mapAudit.mjs arena` i wygenerowaniu zrzutów `node tools/screens/mapAudit.mjs arena --tag after` w `artifacts/maps/arena/after/`:

1. **Walidacja automatyczna i testy:**
   - `node tools/levels/mapAudit.mjs arena` zwraca **`0 error` i `0 warn`** (znikają wszystkie 3 ostrzeżenia `emptyRoom` dla `lights`, `decor` i `signs`, brak błędów `floatingObject`, `noCollisionLargeProp`, `overlap`, `outOfBounds` i `forbiddenColor`).
   - Testy jednostkowe i e2e (`npm run check`, w tym `tests/unit/arenaTurretSpawns.test.ts`, `tests/unit/roomStaticBatch.test.ts`, `tests/unit/mapAudit.test.ts`, `tests/unit/themes.test.ts`, `tests/unit/director.test.ts`, `tests/e2e/arena.spec.ts`) przechodzą na zielono.
2. **Ujęcia ze spawnu i na północ (`01-spawn.png`, `02-north.png`):**
   - Zamiast białej pustki motyw `neonStreet` renderuje ciemne, deszczowe niebo z panoramą wieżowców, mokry asfalt z odbiciami w kałużach `puddle1`/`puddle2` i betonowe mury otoczone 20–24-metrowymi fasadami z oświetlonymi oknami.
   - Na pierwszym planie dwa betonowe filary `blocks[5..6]` (`1,5 × 4 × 1,5 m` na `(±6, 2, -6)`) podtrzymują stalowe belki bramownicy `blocks[16..17]`, a między nimi wisi sznur bursztynowych lampionów `city_lantern_string` ze stożkami ciepłego światła.
   - Na osi północnej za niską metalową osłoną `blocks[9]` (`(0, 0.5, -10)`) widać stalową roletę zrzutową `city_shutter` z pasami `floor_hazard` na asfalcie, iskrami `sparks` i bursztynowym neonem **`ISKRA`** (`#ffae1a`) nad roletą.
   - Po lewej stronie pod północno-zachodnim okapem stoi oświetlony na bursztynowo stragan `city_stall` (`(-8, -17.8)`), po prawej pod północno-wschodnim okapem terminal `city_kiosk` (`(8, -18.3)`) w zielonym świetle, a w narożnikach muru widoczne są drzwi śluz `city_door` (`(±15, 0, -19)`).
   - Nad północnym murem świecą dwa hologramy: bursztynowy **`holo_koi`** po lewej i fioletowy **`holo_jellyfish`** po prawej, z projektorami `city_holo_projector` na koronie muru (`y = 4,0 m`) i przewodem `city_cable_span` (`y = 14,5 m`) przebiegającym czysto powyżej górnej krawędzi hologramów.
3. **Ujęcia boczne na wschód i zachód (`03-east.png`, `05-west.png`):**
   - **Naprawiona orientacja bocznych osłon:** `blocks[10]` `(-10, 0.5, 0)` i `blocks[11]` `(10, 0.5, 0)` stoją teraz **szerokim na `2,6 m` frontem ku środkowi ringu** (zamiast wąskiego kantu `0,6 m` widocznego na zrzutach `before`).
   - Na wschodzie (`03-east.png`) widać zielone oświetlenie bramy zrzutowej `city_shutter` (`#6dff4a`), neony **`IMPLANTY`** i **`WARSZTAT`**, hologram **`holo_cat`** (`#3d7bff`), graffiti `graffiti_resist`, paletę skrzyń `city_crates` `(11, -5)` oraz agregat `city_generator` `(11, 5)`.
   - Na zachodzie (`05-west.png`) widać fioletowe oświetlenie bramy zrzutowej `city_shutter` (`#8a5cff`), neony **`BAR 24H`** i **`RAMEN`**, hologram **`holo_implant`** (`#6dff4a`), mural `graffiti_iskra`, parę z kratki `city_vent_grate`, agregat `city_generator` `(-11, -5)` oraz kontener `city_dumpster` `(-11, 5)`.
4. **Ujęcie na południe (`04-south.png`) oraz ujęcia narożne (`06-corner-nw.png`, `07-corner-se.png`):**
   - Na południu (`04-south.png`) za południową osłoną `blocks[12]` `(0, 0.5, 10)` widać południową roletę `city_shutter` w królewskim błękicie (`#3d7bff`) z fioletowym neonem **`ARCADE`** powyżej, zadaszony dok z automatem `city_vending` po lewej `(8, 18.4)` i zaporę `city_barrier` po prawej `(-8, 15.5)`.
   - Na ujęciach narożnych (`06-corner-nw.png`, `07-corner-se.png`) jasne, zniszczalne skrzynie `crate` i `crate_small` w `(±12, ±12)` wyraźnie odcinają się od ciemnego, mokrego asfaltu zgodnie z ADR 0006 (`#d9dde3`), a za nimi widać kałuże, podesty techniczne w ćwiartkach i centralny ring z lampionami.
5. **Ujęcia pod kątem 35° i z góry (`08-high-west.png`, `09-high-east.png`, `10-top.png`):**
   - Oba wysoko rozpięte kable `decor[4..5]` (`city_cable_span`, `scale: 4.0`) sięgają na pełną szerokość `40 m` i mają oba końce osadzone w licach zachodnich i wschodnich fasad `blocks[31..34]` (`x = ±20,0 m`).
   - Wszystkie 4 sznury lampionów `decor[0..3]` (`city_lantern_string`, `scale: 1.2`) tworzą zamknięty kwadrat `12 × 12 m` zaczepiony w 4 filarach `blocks[5..8]` pod dwiema belkami bramownicy `blocks[16..17]`, a środek ringu pozostaje w pełni widoczny z góry.

## 5. Wdrożenie

Klatka zajmuje plac o wymiarach 38 × 38 m w świetle murów. Numery odpowiadają propozycjom z sekcji 3. Ten sam układ obsługuje Arenę, Endless i Arenę wyzwań.

| Punkt | Decyzja | Wynik i powód |
| --- | --- | --- |
| 1. Motyw | Wdrożony | `neonStreet` i profil `rain` dają nocne niebo, mokrą nawierzchnię i tło dźwiękowe. |
| 2. Płyta i mury | Wdrożony | Asfalt leży na dotychczasowej płycie, a betonowe mury wyznaczają granicę ruchu przy X i Z równych ±19 m. |
| 3. Filary | Wdrożony | Cztery betonowe podpory o przekroju 1,5 × 1,5 m dochodzą do belek na wysokości 4 m. |
| 4. Osłony osiowe | Wdrożony | Cztery bariery mają wysokość 1 m i szerokość 2,6 m od strony bramy. Na wschodzie i zachodzie szerokość biegnie wzdłuż osi Z. |
| 5. Bramownica | Wdrożony | Dwie belki długości 13,6 m spoczywają na parach filarów. Nad środkiem ringu widać niebo. |
| 6. Okapy | Zmieniony | Trzy daszki dochodzą do murów. Każda sucha strefa ma rzut 8 × 3,2 m i kończy się na spodzie swojego daszka, na wysokości 3,6 m. |
| 7. Podesty | Wdrożony | Dwa agregaty, paleta i kontener mają kolidery o wymiarach zmierzonych w GLB. W symulacji gracz zwykłym skokiem wylądował i zatrzymał się na każdym z czterech podestów. |
| 8. Stanowiska przy murach | Zmieniony | Automat stoi przy północnym straganie. Jego ekran i klawiatura kiosku są skierowane na plac. Południowy okap osłania paletę ładunkową. Zapora na południowym zachodzie ma obejście z obu stron. |
| 9. Skrzynie do walki | Zmieniony | Duża skrzynia trafiła na NE, mała na SW. W ten sposób każda ćwiartka ma zniszczalny obiekt. Małe skrzynie obsługuje fizyka rekwizytów. |
| 10. Fasady | Wdrożony | Osiem budynków o wysokości 18–24 m otacza ring. Ich lica na X = ±20 m stanowią oparcie kabli. |
| 11. Światło ringu | Zmieniony | Dwa ciepłobiałe światła przeniesiono pod belki na X = ±6 m, gdzie mają fizyczne podparcie nad głową. |
| 12. Bramy | Zmieniony | Światła znajdują się 0,5 m przed murami. Bursztyn oznacza północ, królewski błękit południe, fiolet zachód i zieleń wschód. |
| 13. Stanowiska północne | Wdrożony | Dwa światła pod okapami wydobywają stragan i kiosk z cienia. Mapa definiuje osiem źródeł punktowych. Liczbę aktywnych ustala renderer według jakości i położenia kamery. |
| 14. Szyldy nad roletami | Zmieniony | Bursztynowa Iskra i niebieskie Arcade mieszczą się między roletą a koroną muru. Błękit odpowiada teksturze Arcade i barwie południowej bramy. |
| 15. Szyldy boczne | Zmieniony | Pozostało po jednym drogowskazie na flankę. Fioletowa tekstura baru i zielona warsztatu pasują do oświetlenia bram. Podczas obrotu gracz ma do rozpoznania cztery główne szyldy. |
| 16. Hologramy | Zmieniony | Dwie projekcje wyróżniają stronę organizatorów. Koi świeci błękitem zgodnym z teksturą, meduza fioletem. Na bocznych murach pierwszeństwo mają wejścia fal. |
| 17. Lampiony | Wdrożony | Cztery sznury w skali 1,2 obiegają ring. Osiem końców wypada wewnątrz filarów na wysokości 3,732 m. Lampiony dodają stożki światła. |
| 18. Kable | Wdrożony | Obie wiązki w skali 4 sięgają od X = −20 do +20 m. Końce północne trafiają w fasady przy Z = −10,76 i −10,82 m, południowe przy 9,24 i 9,18 m. |
| 19. Wejścia fal | Wdrożony | Cztery rolety i cztery drzwi przylegają do wewnętrznych lic murów. Przed każdym wejściem stoi odpowiadający mu punkt spawnu. |
| 20. Osprzęt | Zmieniony | Oba hologramy mają projektory na koronie muru. Stożki zaczynają się na soczewkach na wysokości 4,24 m. Dwie kratki zasilają emitery pary, instalacje i anteny mają podparcie na fasadach. |
| 21. Kałuże | Wdrożony | Cztery naklejki obu wariantów leżą między podporami a zewnętrzną trasą. Odbicia zapewnia mokra nawierzchnia motywu. |
| 22. Pasy ostrzegawcze | Wdrożony | Cztery pola na asfalcie wskazują osiowe spawny. Szeroki bok każdego pola biegnie równolegle do rolety. |
| 23. Murale i zacieki | Zmieniony | Graffiti na bocznych murach przesunięto na Z = −5,6 m, żeby oddzielić je od szyldu baru. Zacieki zajmują południowe odcinki ścian. |
| 24. Efekty | Zmieniony | Para wychodzi z kratek, iskry z prowadnic dwóch rolet. Krople zaczynają się na spodzie obu północnych okapów przy ich przedniej krawędzi. |

**Obsługa sceny.** Arena używa wspólnych `SceneAtmosphere`, `CityDressing`, `loadDecor` i `placeBlockModel`. Dekoracje mają teraz własną grupę scalaną przez `batchStaticGeometry`, a profil pogody korzysta z `ctx.audio`. Przy ładowaniu rzeczywistych GLB liczba siatek dekoracji spada z 532 do 18. Cała scena po inicjalizacji ma 351 siatek przy budżecie testowym 380. Modele bloków stoją w natywnej orientacji, a boczne bariery obraca istniejący mechanizm dopasowania do kolidera.

**Drożność.** Na siatce co 0,25 m wszystkie 20 744 wolne pozycje należą do jednego obszaru przy promieniu 0,45 m i wysokości 2,7 m. Kwadratowe trasy na ±4, ±8 i ±14 m mają odpowiednio co najmniej 1,77, 1,25 i 0,95 m odstępu od przeszkód do osi trasy (pierwsza wartość po zaokrągleniu). W symulacji sceny z Rapierem szturmowiec z każdego z ośmiu spawnów doszedł do zasięgu ataku przy nieruchomym graczu na starcie, w środku oraz przy (14, 8) i (−14, −8). Każda wieżyczka ostrzelała dostępną pozycję przy centrum.

**Audyt i testy.** Audyt przeszedł z 0 błędów i 3 ostrzeżeń do 0 błędów i 0 ostrzeżeń. Próg błędów dla areny wynosił już 0. Pełne `npm run check` przeszło, w tym 3777 testów w 313 plikach.

**Do oceny na zrzutach.** Ze spawnu warto ocenić czytelność czerwonej sylwetki na tle rolety Iskry i wysokość obu projekcji w kadrze. Z boków sprawdzić profile osłon oraz rozpoznawalność baru i warsztatu przy `darkness`. Z góry obejrzeć styki kabli z fasadami, naroża lampionów i krawędzie deszczu pod okapami.

### Korekta po przeglądzie zrzutów „after”

| Uwaga | Decyzja i weryfikacja |
| --- | --- |
| 1. Czarne płyty | Na obu ujęciach narożnych dominuje ciemny spód okapu. Pierwsza wersja miała już materiał `metal`, ale bryły miały płaski profil. Każda belka ma teraz przekrój dwuteowy ze stalowymi półkami i węższym środnikiem. Okapy mają poszycie z blachy falistej `corrugated`, dwa żebra widoczne od spodu i profil przy krawędzi spływu. Belki nadal spoczywają na czterech filarach, a najniższa krawędź okapów wypada na 3,6 m. |
| 2. Kontrast pod Iskrą | Na ujęciu ze spawnu widać bursztynową roletę i szyld. Reflektor ma teraz ciepłą biel `#fff1d6`, intensywność 11 i zasięg 10 m. Przesunięto go nad podejście i wyłączono dodatkową plamę na asfalcie. Rozpoznawalność czerwonej sylwetki podczas fali wymaga oceny w grze. |
| 3. Białe refleksy na belkach | Światła leżały na osiach sznurów w rzucie z góry, 0,2 m pod stalą. Zachodnie źródło przesunięto na Z = +3 m, wschodnie na Z = −3 m, oba o 0,55 m w stronę środka ringu. Teraz od spodu belki dzieli je 0,6 m, a od najbliższego klosza 1,67 m. Intensywność spadła z 20 do 7, zasięg z 15 do 11 m. |
| 4. Piony rur | Obie podstawy przesunięto z Y = 3,5 na 4 m. Sprawdzenie narożników obwiedni GLB po obrocie i skalowaniu potwierdziło, że podstawy mieszczą się na koronach murów i przylegają do fasad. |
| 5. Południowo-wschodni dok | Paletę zastąpił kolizyjny, dwustronny kiosk. Od ringu widać ekran reklamowy i świecące krawędzie. Od strony klawiatury jest 1,59 m przejścia do muru. Krople spadają z przedniej krawędzi nad stanowiskiem. Mapa nadal definiuje osiem świateł punktowych. |
| 6. Deszcz | Wszystkie trzy strefy obejmują pełną wysokość od podłogi do górnej powierzchni blachy na 4 m. Rzut każdej strefy pokrywa się z jej dachem. Odrzucono rozszerzenie suchej strefy przed okapem. Smugi między kamerą a krawędzią dachu padają na odkryty asfalt. |
| 7. Oznaczenia bram | Pasy mają 2,2 × 1,4 m. Leżą na podejściach na ±14 m, z boku osi ostrzału. W punktach startu i środka ringu sprawdzono po 81 promieni do każdej naklejki, z wysokości oka 1,65 m. Wszystkie 648 odcinków omija kolidery osłon. |
| 8. Mural Iskry | Przeniesiono go na zachodni mur przy Z = +5,4 m. Mural mieści się między roletą a zaciekiem na Z = +10 m. Szyld baru wyróżnia teraz północną połowę tej ściany. |

Po korekcie `node tools/levels/mapAudit.mjs arena` zwraca 0 błędów i 0 ostrzeżeń. Pełne `npm run check` przeszło wraz z 3777 testami. Cały ring i osiem spawnów tworzą jeden obszar 20 749 dostępnych pól na siatce 0,25 m. Minimalne odstępy od przeszkód na trzech pętlach biegu są takie jak przed korektą. Pomiar z rzeczywistymi GLB daje 353 siatki przy budżecie 380. Przy kolejnym odbiorze wizualnym warto porównać spód daszków na ujęciach narożnych, refleksy pod belkami na ujęciu ze spawnu i kontrast wroga przed roletą Iskry.
