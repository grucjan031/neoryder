# Dokument projektowy mapy `run8` — ELEKTROWNIA FUZYJNA KUROGANE ARMS („KOMPLEKS TOKAMAKA HELIOS-IV”)

Status: **Projekt referencyjny jakości (wzorzec 8+/10) + specyfikacja proceduralnego Reaktora Fuzyjnego (`fusionReactor.ts`), systemu NPC-naukowców (`civilians`), 8 pomieszczeń z 2-poziomową galerią hali głównej, 30 modeli `fus_*`, 22 tekstur i generatora**  
Docelowy plik danych mapy: `src/data/rooms/run8.json` (generator: `tools/arenas/run/run8.mjs` + moduły pomocnicze `_run8Kit.mjs`, `_run8Rooms.mjs`, `_run8Dress.mjs`)  
Zestaw modeli Blender: `tools/blender/sets/kurogane_fusion.py` → `public/assets/models/city/fus_*.glb`  
Motyw i pogoda: `src/data/themes/kuroganeFusion.json`, `src/data/weather/kuroganeFusionPlant.json`  
Kierunek artystyczny: **Neon Noir** (`AGENTS.md`, `docs/adr/0006-neon-noir.md`)

---

## 1. Analiza silnika i nauczki z `run1`–`run7`

### 1.1. Co już działa w silniku i jak `run8` z tego korzysta

Po wdrożeniu magazynu `run1` ([docs/maps/run1.md](run1.md)), galerii handlowej `run2` ([docs/maps/run2.md](run2.md)), tajnego laboratorium `run3` ([docs/maps/run3.md](run3.md)), biurowca `run4` ([docs/maps/run4.md](run4.md)), przychodni `run5` ([docs/maps/run5.md](run5.md)), nocnego targu `run6` ([docs/maps/run6.md](run6.md)) oraz leśnej rezydencji `run7` ([docs/maps/run7.md](run7.md)) silnik dysponuje pełnym zapleczem do budowy monumentalnej, wielopoziomowej elektrowni fuzyjnej Kurogane Arms:

| Obszar silnika | Stan obecny w kodzie | Jak wykorzystuje to `run8` | Odwołania do plików |
|---|---|---|---|
| **Format pokoju i katalogi testowe** | Pokój `src/data/rooms/run8.json` (`type: "combat"`, z blokiem `arena` i `spawnRing`) ładuje się automatycznie przez `import.meta.glob` do `roomDefinitions`, menu „Testy map” (`?maps=1` → `?scene=map-walk&map=run8`), sceny walki `?scene=room-test&room=run8&debug=1` oraz audytu CLI `node tools/levels/mapAudit.mjs run8` i `node tools/screens/mapAudit.mjs run8`. | `run8` jest pokojem runu (`rooms`), bez sztucznej misji kampanii. Po odbiorze wizualnym (ocena Opusa `≥ 7/10`) zostaje dopisany do `roomPools.combat` i `roomPools.elite` w `src/data/sectors/kurogane.json` obok `run1`, `run3`, `run4` i `run7`. | `src/world/rooms.ts`, `src/world/mapCatalog.ts`, `tools/levels/mapAuditCatalog.ts`, `tools/arenas/run/_runKit.mjs` |
| **Nawigacja 3D (`ArenaSurfaceNavigation`)** | `RoomScene.init()` buduje graf komórek `0.5 × 0.5 m` na blokach `walkable: true` połączonych pochyłymi rampami osiowymi (`rotation.x` lub `rotation.z`), z kontrolą prześwitu `navigationHeadroomM = 2.2 m` i promienia kapsuły `navigationClearanceM = 0.4 m`. | Spina **Poziom Główny Hali i Skrzydeł Technicznych (`L0`, `y = 0.00 m`)**, **Poziom 1 — Galerię Techniczną oraz Sterownię i Biuro Kierownika (`G1`, `y = +4.80 m`)** oraz **Poziom 2 — Galerię Górną Inżektorów i Suwnicy (`G2`, `y = +9.60 m`)** sześcioma szerokimi biegami ramp/schodów stalowych o czystym obrocie `rotation.x` lub `rotation.z`, kącie **`25.64° ≤ 26.6°`** i szerokości **`2.80–3.20 m ≥ 2.0 m`**. | `src/world/arenaNavigation.ts`, `src/world/arenaSurfaceNavigation.ts:119–274` |
| **Proceduralny Set Piece Reaktora (`setPieces[]` / `fusionReactor.ts`)** | Rozszerzenie danych pokoju o pole `setPieces: [{ kind: 'fusionReactor', position, yaw, scale }]` przekazywane do modułu `src/render/fusionReactor.ts` (realizowanego równolegle). | W geometrycznym sercu Hali Reaktora `R2` (`(0, 0, 0)`) stoi wysoki na `10.2 m` i szeroki na `14.0 m` **Tokamak „Kurogane Helios-IV”** z wirującymi pierścieniami cewek poloidalnych, pulsującym torusem plazmy (`#fff1d6` / `#ffae1a` / `#8a5cff`), łukami wyładowań, parą i migającymi światłami ostrzegawczymi, wsparty na blokach kolizji cokołu z generatora. | `src/render/fusionReactor.ts`, `src/world/dressingSchema.ts`, `src/scenes/roomScene.ts` |
| **System NPC-naukowców (`civilians[]` i `hideSpots[]`)** | Moduł cywilów (`docs/systems/civilians.md`, realizowany równolegle) obsługuje w danych pokoju pola `civilians: [{ id: 'scientist', position, yaw }]` oraz `hideSpots: [{ x, y, z }]`. | **8 naukowców Kurogane Arms** pracuje przy konsolach w Hali Reaktora `R2`, Sterowni Głównej `R3`, Laboratorium Plazmy `R4`, Serwerowni `R7` i Biurze Kierownika `R8`. Widząc gracza, uciekają do **20 punktów `hideSpots`** za osłonami i kucają do końca walki (trafieni giną, a ciało pada i leży). | `docs/systems/civilians.md`, `src/world/roomSchema.ts` |
| **Spawny i hazardy na wielu kondygnacjach (`spawnPoints[].y`, `hazards[]`)** | `roomSpawnPointSchema` i `wavesSchema` obsługują współrzędną `y`, a `validateLayout` weryfikuje podparcie spawnów oraz zagrożeń (`electric_field`, `laser_gate`, `explosive_barrel`) na poziomych blokach `walkable: true` dowolnej kondygnacji (`y = 0.00, +4.80, +9.60 m`). | **18 punktów spawnu wrogów Kurogane** rozłożonych na trzech poziomach wysokości: **10 na Poziomie Głównym (`y = 0.00 m`)**, **5 na Galerii `G1` i w Sterowni/Biurze (`y = +4.80 m`)** oraz **3 na Galerii Górnej `G2` (`y = +9.60 m`)**, wspartych przez **4 zagrożenia środowiskowe**. | `src/world/roomSchema.ts:146–151, 406–588`, `src/scenes/roomScene.ts:610, 1612` |
| **Przezroczyste szkło (`mat_glass_clear`) i panele świetlne bez smug (`mat_light_panel`)** | `glass_clear` (`opacity: 0.22, depthWrite: false` + Fresnel) zapewnia obustronną przezierność szyb. `light_panel` (`#fff1d6`, `flat: true`) świeci ciepłą bielą bez selektywnego bloomu. | `mat_glass_clear` tworzy **15-metrowe pochylone okno obserwacyjne Sterowni Głównej `R3` z widokiem z góry na Tokamak**, narożne przeszklenie Biura Kierownika `R8`, pancerne szyby badawcze Laboratorium Plazmy `R4` i Serwerowni `R7` oraz osłony komór próżniowych. `mat_light_panel` oświetla kasetony stropowe i listwy pomostów bez generowania smug bloomu. | `src/render/urbanMaterials.ts`, `src/data/render/arenaMaterials.json:183–202` |
| **Ukrywanie stropów w ujęciach audytu z góry (`ceiling: true`)** | Bloki z `ceiling: true` trafiają do grupy `room-ceilings`, ukrywanej w `MapAuditScene.render()` dla kamer `top`, `high-west` i `high-east`. | Wszystkie kasetonowe stropy i dachy nad pomieszczeniami bocznymi (`y = 4.80..9.60 m`) oraz monumentalne sklepienie Hali Reaktora `R2` (`y = 19.20..19.80 m`) mają `ceiling: true`, odsłaniając 100% wszystkich 8 pomieszczeń i obu galerii na zrzutach z góry. | `src/scenes/roomScene.ts:1129`, `src/scenes/mapAuditScene.ts:140, 163–166` |

### 1.2. Kluczowe nauczki z `run7` (oraz `run1`–`run6`) zastosowane w `run8`

1. **Posadzka każdego pomieszczenia jednym blokiem — bez szczelin (nauczka #1 z `run7`):**
   - W `run7` dzielenie płyty podłogowej jednego pokoju na kilka mniejszych prostokątów wokół wycięć prowadziło do ryzyka mikro-szczelin, przeskoków siatki UV i błędów ciągłości odbić.
   - **Zasada w `run8`:** Każde z 8 pomieszczeń (`R1`..`R8`) ma **dokładnie jeden monolityczny blok posadzki `deck()` (`walkable: true`)** pokrywający cały obrys `(X, Z)` danego pokoju (np. Hala Reaktora `R2` to jedna płyta `44.0 × 44.0 × 0.6 m` na `y = -0.60..0.00 m`, Sterownia `R3` to jedna płyta `28.0 × 14.0 × 0.4 m` na `y = +4.40..+4.80 m`). Żadnych szwów ani dziur wewnątrz pokoju.

2. **Stropy z kasetonami — inaczej wychodzą czarne w kadrach FPP (nauczka #2 z `run7`):**
   - Płaska, jednolita płyta sufitu bez podziałów architektonicznych i bez wpuszczonych kasetonów wygląda w ujęciach FPP jak czarna dziura, ponieważ główne światło kierunkowe pada od góry.
   - **Zasada w `run8`:** Każdy sufit w `run8` otrzymuje **trójwymiarową strukturę kasetonową** (`ceiling: true` na płycie głównej oraz na żebrach podciągów i kasetonach `fus_ceiling_coffer_bay` z materiałami `fus_reactor_concrete`, `metal` oraz pasami `mat_light_panel`). W kadrach FPP gracz widzi rytmiczne, industrialne sklepienie z ciepłobiałymi i bursztynowymi kasetonami LED, natomiast w kamerach audytu z góry (`10-top.png`, `08-high-west.png`, `09-high-east.png`) cała grupa `ceiling: true` znika, nie zasłaniając wnętrza.

3. **Dekale ścienne `≤ 0,1 m` od ściany (nauczka #3 z `run7` r1/r2):**
   - W pierwszej iteracji `run7` odsunięcie tekstury tablicy śledczej lub plakatów o `> 0.15 m` od ściany powodowało widoczne lewitowanie naklejki w powietrzu pod kątem bocznym.
   - **Zasada w `run8`:** Wszystkie naklejki ścienne (`decals[]` z `surface: "wall"`, w tym tablice schematów fuzji, plakaty BHP i easter eggi w Biurze Kierownika `R8`) są umieszczane w odległości **`0.02–0.05 m` (bezwzględnie `≤ 0.10 m`)** od lica ściany nośnej lub modelu tablicy.

4. **Kolory obić i wyposażenia z motywu mapy `kuroganeFusion.json` (nauczka #4 z `run7`):**
   - Zbyt ciemne wartości `fabric`, `plastic`, `rubber` lub `lacquer` w motywie mapy sprawiają, że fotele w sterowni, obicia konsol i korpusy maszyn zlewają się w czarne sylwetki bez czytelnego konturu.
   - **Zasada w `run8`:** Motyw `src/data/themes/kuroganeFusion.json` definiuje jasne, czytelne odcienie Neon Noir w paśmie `#2a3344–#56627a` dla materiałów obić i aparatury (`fabric: "#4a566e"`, `plastic: "#4c5f7d"`, `rubber: "#3b4354"`, `lacquer: "#2e3c5e"`, `machine: "#64728c"`, `paint: "#3d5968"`), co gwarantuje czytelność detali i czerwonego obrysu wrogów na tle każdej maszyny.

5. **Spawn nie może być w żadnym bloku — nawet w dywanie czy macie podłogowej (nauczka #5 z `run7`):**
   - W `src/world/roomSchema.ts:454–460, 582–590` `validateLayout` odrzuca każdy punkt `playerSpawn` oraz `spawnPoints`, jeśli w jego obrysie `(X, Z)` znajduje się jakikolwiek blok wystający ponad poziom posadzki `y + FLOOR_EPSILON_M` (`0.01 m`) — w tym cienki na `2 cm` dywan w biurze czy mata dielektryczna przed konsolą! Dodatkowo w `run7Navigation.test.ts` sprawdzany jest pełny prześwit kapsuły (`r = 0.4 m, h = 1.8 m`) wokół każdego spawnu.
   - **Zasada w `run8`:** Dywan w Biurze Kierownika `R8` oraz maty dielektryczne w Sterowni `R3` są realizowane jako płaskie `decals` podłogowe (`surface: "floor"`) albo bloki wpuszczone równo z licem posadzki (`top === floorY`), a `playerSpawn` i wszystkie **18 punktów `spawnPoints`** leżą w otwartych strefach komunikacyjnych z wolnym promieniem `≥ 1.2 m` od każdego bloku, osłony i zagrożenia.

6. **Układ niepokrywających się rzutów `(X, Z)` wokół Hali Reaktora i audyt `mapAudit = 0/0` (nauczka #6 z `run7`):**
   - Wszystkie 7 średnich i małych pomieszczeń (`R1`, `R3`..`R8`) otacza centralną Halę Reaktora `R2` (`44 × 44 m`) bez nakładania się w rzucie `(X, Z)`, a dwupoziomowe galerie `G1` (`y = +4.80 m`, szer. `4.0 m`) i `G2` (`y = +9.60 m`, szer. `3.2 m`) biegną wzdłuż obwodu hali, zostawiając otwarte serce `36 × 36 m` wokół Tokamaka. Dzięki temu na `10-top.png`, `08-high-west.png` i `09-high-east.png` widoczne są jednocześnie wszystkie 8 pomieszczeń, oba poziomy galerii i Reaktor Fuzyjny, a `node tools/levels/mapAudit.mjs run8` zwraca **`0 error, 0 warn` (`0/0`)**.

---

## 2. Lista braków („fundamenty”) z priorytetem P0 / P1

### 2.1. Priorytet P0 — MUSI BYĆ PRZED `run8`

#### A. Proceduralny Reaktor Fuzyjny (`setPieces`), NPC-naukowcy (`civilians`) i rejestracja `fus_*` (Etap A)

| ID | Co trzeba dopisać w kodzie i dlaczego | Pliki w repozytorium | Zakres zmian |
|---|---|---|---|
| **F-01** | **Proceduralny Set Piece Reaktora Fuzyjnego (`src/render/fusionReactor.ts`, pole `setPieces` w danych pokoju — realizuje równolegle inny wykonawca):**<br>1. **Kontrakt w danych pokoju (`src/world/dressingSchema.ts` / `roomSchema.ts`):** opcjonalna tablica `setPieces: z.array(z.object({ kind: z.enum(['fusionReactor']), position: vec3Schema, yaw: finite.optional(), scale: positive.optional() })).optional()`.<br>2. **Moduł renderujący `src/render/fusionReactor.ts`:** buduje i animuje w `render(alpha)` (czysto w warstwie Three.js, bez narzutu na `step()` symulacji) wielki tokamak o średnicy toru `~14.0 m` i wysokości `~10.2 m`:<br>- 12 stalowo-grafitowych cewek toroidalnych (TF) z fazowanymi krawędziami i bursztynowymi listwami diagnostycznymi (`#ffae1a`),<br>- 3 wirujące pierścienie cewek poloidalnych (PF) i żyroskopowych stabilizatorów plazmy obracające się płynnie wokół osi pionowej,<br>- Przezierny płaszcz komory próżniowej (`mat_glass_clear`), wewnątrz którego wiruje i pulsuje **torus plazmy fuzyjnej** w dozwolonych barwach **ciepłej bieli (`#fff1d6`), bursztynu (`#ffae1a`) i fioletu (`#8a5cff`)** — zero magenty, zero cyanu, zero czerwieni,<br>- Proceduralne łuki wyładowań wysokiego napięcia między izolatorami (`#fff1d6` / `#8a5cff` / `#3d7bff`), migające światła ostrzegawcze (`#ffae1a`) i mikrowibrację harmoniczną korpusu.<br>3. **Kolizja podstawy:** generator `run8.mjs` wystawia w `blocks[]` twarde bloki kolizji podstawy i centralnej kolumny solenoidu (szczegóły w **sekcji 4**). | `src/render/fusionReactor.ts`, `src/world/dressingSchema.ts`, `src/scenes/roomScene.ts` | Równoległe zadanie innego wykonawcy (opis kontraktu w §4) |
| **F-02** | **System NPC-naukowców Kurogane Arms (`docs/systems/civilians.md`, pola `civilians` i `hideSpots` — realizuje równolegle inny wykonawca):**<br>1. **Kontrakt w `roomSchema.ts`:** opcjonalne pola `civilians: z.array(z.object({ id: z.literal('scientist'), position: vec3Schema, yaw: finite.optional() })).optional()` oraz `hideSpots: z.array(vec3Schema).optional()`.<br>2. **Zachowanie w symulacji i renderze:** naukowcy stoją na starcie przy konsolach/tablicach (`idle` / praca); nie mają broni i nie strzelają. Gdy zobaczą gracza lub usłyszą walkę, biegną do przypisanego/najbliższego punktu `hideSpots` (w rogach i za osłonami), gdzie kucają w panice do końca starcia. Trafieni dowolnym atakiem gracza lub wybuchem giną — ciało pada na posadzkę i pozostaje na ziemi. | `docs/systems/civilians.md`, `src/world/roomSchema.ts`, `src/scenes/roomScene.ts` | Równoległe zadanie innego wykonawcy (rozmieszczenie w §5) |
| **F-03** | **Rejestracja prefiksu `'fus_'` oraz modeli ściennych, sufitowych i przejściowych elektrowni w `cityModels.ts` i `mapAudit.ts`:**<br>1. W `CITY_MODEL_PREFIXES` (`src/render/cityModels.ts:8`) dopisać `'fus_'`, aby loader zachowywał wielomateriałowość glTF modeli `/assets/models/city/fus_*.glb`.<br>2. W `src/world/mapAudit.ts:24–59` dopisać:<br>- do `WALL_FIXTURES`: `fus_blast_door_frame`, `fus_control_window_wall`, `fus_wall_pipe_manifold`, `fus_wall_power_busbar`, `fus_wall_dosimeter_station`, `fus_suit_locker_bank`, `fus_telemetry_screen_wall`, `fus_whiteboard_equations`, `fus_director_bookcase`;<br>- do `PASSAGE_FIXTURES`: `fus_blast_door_frame`, `fus_decon_shower_arch`;<br>- do `CEILING_FIXTURES`: `fus_ceiling_coffer_bay`, `fus_fuel_gantry_crane`, `fus_overhead_cable_tray`, `fus_highbay_light_strip`. | `src/render/cityModels.ts`, `src/world/mapAudit.ts` | ~25 linii TS |

#### B. Nowe materiały powierzchniowe, motyw `kuroganeFusion`, profil pogody `kuroganeFusionPlant` i tekstury (Etap A/C)

| ID | Co trzeba dodać | Gdzie w zasobach / danych | Szczegóły |
|---|---|---|---|
| **F-04** | **4 materiały wykończeniowe elektrowni fuzyjnej w `arenaMaterials.json`, motyw `kuroganeFusion.json` i profil pogody `kuroganeFusionPlant.json`:**<br>1. `fus_reactor_floor` — ciężka, antyelektrostatyczna posadzka epoksydowo-bazaltowa w odcieniu głębokiego stalowego grafitu z mikrosiatką dylatacyjną i wysokim połyskiem odbić plazmy (`scale: 0.40, roughness: 0.22, metalness: 0.24, bump: 0.28, wetness: 0.72, tint: "#2d3748"`) — posadzka Hali Reaktora `R2`, Laboratorium Plazmy `R4` i Magazynu Paliwa `R5`;<br>2. `fus_reactor_concrete` — żebrowany beton radiacyjny o dużej gęstości z ciemnymi szwami płyt osłonowych i satynową impregnacją (`scale: 0.35, roughness: 0.44, metalness: 0.12, bump: 0.42, wetness: 0.20, tint: "#505c72"`) — monumentalne ściany i kasetonowe stropy Hali Reaktora `R2`, Hali Turbin `R6` i Śluzy `R1`;<br>3. `fus_shield_panel` — modularne płyty ekranowania magnetycznego ze szczotkowanego tytanu i ciemnej stali z zagłębionymi śrubami serwisowymi (`scale: 0.45, roughness: 0.30, metalness: 0.62, bump: 0.35, wetness: 0.35, tint: "#43526a"`) — ściany Sterowni Głównej `R3`, Serwerowni `R7` i cokołu reaktora;<br>4. `fus_control_tile` — podniesiona podłoga techniczna z grafitowo-błękitnych płyt kompozytowych z aluminiowymi ramkami dostępowymi (`scale: 0.50, roughness: 0.28, metalness: 0.30, bump: 0.26, wetness: 0.45, tint: "#354258"`) — posadzka Sterowni Głównej `R3`, Serwerowni `R7` i Biura Kierownika `R8`.<br>5. **Motyw `src/data/themes/kuroganeFusion.json`:** chłodny przemysłowy grafit/granat (`concrete: "#526078"`, `metal: "#46556e"`, `machine: "#64728c"`, `fabric: "#4a566e"`, `plastic: "#4c5f7d"`, `lacquer: "#2e3c5e"`, `paint: "#3d5968"`), neony otoczenia wyłącznie `#ffae1a`, `#6dff4a`, `#8a5cff`, `#3d7bff`, `#fff1d6`, silne odbicia podłogowe (`reflectionStrength: 0.92`), zero mgły wewnętrznej.<br>6. **Profil pogody `src/data/weather/kuroganeFusionPlant.json`:** zamknięty podziemno-przemysłowy kompleks reaktora (`precipitation.density: 0`, `fog.density: 0`, `fog.strength: 0`, `dust.density: 0`, `lighting: { hemiIntensity: 4.2, keyIntensity: 1.55, panoramaEnabled: false }`, `surface: { gloss: 0.74, reflections: 0.88, puddles: 0.16 }`, `ambience: [{ kind: "generator", gain: 0.16, radiusM: 120 }, { kind: "vent", gain: 0.09, radiusM: 90 }]`). | `src/data/render/arenaMaterials.json`, `src/render/urbanMaterials.ts`, `src/render/surfaceTextures.ts`, `src/world/dressingSchema.ts`, `src/data/themes/kuroganeFusion.json`, `src/data/weather/kuroganeFusionPlant.json`, `public/assets/textures/surfaces/fus_*.webp` (+ `komiks_fus_*.webp`) | 4+4 tekstury `.webp` (`1024×1024`) + 2 pliki JSON (`theme` i `weather`) |
| **F-05** | **Zestaw 22 tekstur elektrowni fuzyjnej (`signs/`, `screens/`, `decals/`, `labels/`, `surfaces/`):** szyldy stref technologicznych, ekrany telemetrii tokamaka, tablice równań plazmy, etykiety beczek deuteru/trytu, easter eggi `run1`–`run7` + Iskra — pełna specyfikacja w **sekcji 6.2**. | `public/assets/textures/{signs,screens,decals,labels,surfaces}/`, `tools/textures/catalog.json` | 6 `signs`, 4 `screens`, 7 `decals`, 1 `labels`, 4+4 `surfaces` (łącznie 22 unikalne wzory) |

### 2.2. Priorytet P1 — Szlif po pierwszym odbiorze wizualnym

| ID | Co można dodać w kolejnym kroku | Gdzie w kodzie / zasobach | Efekt |
|---|---|---|---|
| **F-06** | **Reaktywne przyspieszenie wirników Tokamaka w ostatniej fali (`WaveDirector` → `fusionReactor.ts`):** zwiększenie prędkości kątowej pierścieni cewek poloidalnych o 35% i częstotliwości łuków wyładowań podczas finałowej fali elitarnej. | `src/render/fusionReactor.ts`, `src/scenes/roomScene.ts` | Wyraźne podbicie dramaturgii i „feel” kulminacji starcia w Hali Reaktora. |
| **F-07** | **Zniszczalne monitory diagnostyczne i kriogeniczne pojemniki na stołach (`PropPhysicsSystem`):** rozbłysk bursztynowych iskier po trafieniu w wybrane terminale pomocnicze. | `src/world/propPhysics.ts` | Dodatkowy mikro-feedback otoczenia podczas wymiany ognia. |

---

## 3. Projekt architektoniczny mapy `run8` — 1 Duża Hala Reaktora (`44 × 44 m`, `H = 19.2 m`, 2 poziomy galerii) + 7 średnich i małych pomieszczeń

### 3.1. Lore miejsca: Elektrownia Fuzyjna Kurogane Arms „Helios-IV” i projekt sztucznego zasilania Rezonansu

- **Czym jest kompleks „Helios-IV”:** Głęboko w przemysłowym rdzeniu Sektora Kurogane, pod pancerną kopułą chronioną przez oddziały Pułkownika Kenjiego Vane'a (`run7`), pracuje eksperymentalna **Elektrownia Fuzyjna Kurogane Arms „Helios-IV”**. Oficjalnie zakład dostarcza czystą energię dla fabryk zbrojeniowych, odlewni (`m06-odlewnia`) i 62-piętrowego wieżowca Kurogane Tower (`run4`).
- **Prawdziwe przeznaczenie Tokamaka (połączenie fabularne z `docs/gdd.md` i `run1`–`run7`):** Kierownik naukowy elektrowni — **dr hab. Haruto Mori** — we współpracy z chirurgami **Helixa Dynamics** (`run5`) i superkomputerami **Orbis Grid** wykorzystuje szczytowe impulsy magnetohydrodynamiczne tokamaka (`14,8 GJ`) do kalibracji i ładowania **sztucznych rdzeni Rezonansu** wydobywanych z obiektów w Sektorze X-51 (`run3`). Bez impulsów z reaktora Helios-IV masowa produkcja implantów Koalicji staje w miejscu.
- **Cel gracza (`Kuriera`):** Gracz przenika przez południową **Szatnię i Śluzę Dekontaminacyjną (`R1`)** wprost do monumentalnej, wysokiej na blisko 20 metrów **Głównej Hali Reaktora (`R2`)**, w której środku huczy rozgrzany do stu milionów stopni **Tokamak Helios-IV**, a zaskoczeni naukowcy Kurogane rzucają się do ucieczki za osłony. Przebijając się przez boczne skrzydła **Magazynu Paliwa (`R5`)**, **Laboratorium Plazmy (`R4`)**, **Hali Turbin (`R6`)** i **Serwerowni Diagnostycznej (`R7`)** oraz wspinając się po dwupoziomowych galeriach (`G1` na `y = +4.80 m` i `G2` na `y = +9.60 m`), gracz szturmuje **Sterownię Główną (`R3`)** i **Biuro Kierownika Naukowego (`R8`)**, by opuścić kompleks północną śluzą ewakuacyjną `doors[exit]`.

### 3.2. Tabela wszystkich 8 pomieszczeń (`R1`..`R8`) oraz 2 poziomów galerii (`G1`, `G2`) — wymiary, współrzędne, wysokości i palety neonów

Układ współrzędnych świata:
- `+X` = Wschód (prawo, skrzydło Turbin `R6` i Serwerowni `R7`), `-X` = Zachód (lewo, skrzydło Magazynu Paliwa `R5` i Laboratorium Plazmy `R4`)
- `+Z` = Południe (dół, wejście gracza `doors[entry]` w Szatni-Dekontaminacji `R1`), `-Z` = Północ (góra, wzniesiona na `y = +4.80 m` Sterownia Główna `R3` z oknem na reaktor, Biuro Kierownika `R8` i wyjście `doors[exit]`)
- `+Y` = Góra:
  - **POZIOM GŁÓWNY (`L0`):** posadzka **`y = 0.000 m`** (pojedynczy blok na pokój, `y = -0.60..0.00 m`, `walkable: true`) — obejmuje `R1`, główną płytę `R2`, `R4`, `R5`, `R6` i `R7`,
  - **POZIOM GALERII 1 (`G1` / `L1`):** posadzka **`y = +4.800 m`** (płyta `y = +4.40..+4.80 m`, `walkable: true`) — obejmuje obwodowe Galerie Techniczne `G1` wokół Hali Reaktora `R2`, **Sterownię Główną (`R3`)** oraz **Biuro Kierownika Naukowego (`R8`)**,
  - **POZIOM GALERII 2 (`G2` / `L2`):** posadzka **`y = +9.600 m`** (płyta `y = +9.20..+9.60 m`, `walkable: true`) — obejmuje górne pomosty inspekcyjne i bojowe `G2` zawieszone w Hali Reaktora `R2` na wysokości korony Tokamaka.
- Wszystkie granice pomieszczeń i otworów portali leżą na **liczbach całkowitych** (`validateLayout` 1×1 m). Żadne dwa pomieszczenia nie nakładają się w rzucie `(X, Z)`.

| Nr | ID | Poziom posadzki `y` | Nazwa, tożsamość i rola w walce | Prostokąt `X` [m] | Prostokąt `Z` [m] | Wymiary i pole | Strop `y` (wys. w świetle `H`) | Dominująca paleta neonów (ADR 0006) |
|---:|---|---|---|---|---|---|---|---|
| 1 | **R1** | **L0** (`0.00 m`) | **Szatnia i Śluza Dekontaminacyjna**<br>*(start gracza, prysznice radiacyjne, szafki z kombinezonami, bramka dozymetryczna, bezpośredni widok przez 8-metrowy portal na Tokamak w `R2`)* | `-12 .. +12` | `+22 .. +36` | `24 × 14 m`<br>(`336 m²`) | `+4.80 m`<br>(`H = 4.80 m`, kasetony `ceiling: true`) | **Bursztyn** `#ffae1a` + **Zieleń** `#6dff4a` (skanery dekontaminacji) |
| 2 | **R2** | **L0 + G1 + G2**<br>(`0.00 / +4.80 / +9.60 m`) | **GŁÓWNA HALA REAKTORA FUZYJNEGO („KOMORA TOKAMAKA HELIOS-IV”)**<br>*(JEDYNA DUŻA HALA — serce mapy: `44 × 44 m`, wys. `19.20 m`, w centrum proceduralny Tokamak Ø 14 m, wokół banki kondensatorów i kriopompy, 2 poziomy galerii `G1` i `G2` z 6 biegami ramp/schodów)* | `-22 .. +22` | `-22 .. +22` | `44 × 44 m`<br>(`1 936 m²` L0 + `576 m²` G1 + `348 m²` G2) | `+19.20 m`<br>(`H = 19.20 m`, kasetony `ceiling: true`) | **Ciepła biel** `#fff1d6` + **Bursztyn** `#ffae1a` + **Fiolet** `#8a5cff` (plazma tokamaka) |
| 3 | **R3** | **G1** (`+4.80 m`) | **Sterownia Główna Reaktora („Mostek Helios-IV”)**<br>*(średnie pomieszczenie na poziomie `G1`: 15-metrowa pochylona szyba pancerna z widokiem z góry na Tokamak, amfiteatralne konsole operatorów, ściana telemetrii, śluza wyjściowa `doors[exit]`)* | `-22 .. +6` | `-36 .. -22` | `28 × 14 m`<br>(`392 m²`) | `+9.60 m`<br>(`H = 4.80 m`, kasetony `ceiling: true`) | **Błękit królewski** `#3d7bff` + **Bursztyn** `#ffae1a` + **Ciepła biel** `#fff1d6` |
| 4 | **R4** | **L0** (`0.00 m`) | **Laboratorium Fizyki Plazmy i Wiązek**<br>*(średnie pomieszczenie NW: ławy inżektorów wiązki neutralnej, komory próżniowe za szkłem, oscyloskopy, tablice równań fuzji, okno badawcze na Halę Reaktora)* | `-38 .. -22` | `-22 .. 0` | `16 × 22 m`<br>(`352 m²`) | `+5.60 m`<br>(`H = 5.60 m`, kasetony `ceiling: true`) | **Fiolet** `#8a5cff` + **Błękit królewski** `#3d7bff` + **Ciepła biel** `#fff1d6` |
| 5 | **R5** | **L0** (`0.00 m`) | **Magazyn Paliwa Fuzyjnego (Deuter / Tryt)**<br>*(średnie pomieszczenie SW: pancerne beczki izotopowe deuteru i trytu, kriogeniczne zbiorniki kuliste, żółto-bursztynowa suwnica sufitowa, bramka laserowa)* | `-38 .. -22` | `0 .. +22` | `16 × 22 m`<br>(`352 m²`) | `+7.20 m`<br>(`H = 7.20 m`, kasetony `ceiling: true`) | **Bursztyn** `#ffae1a` + **Zieleń** `#6dff4a` (znaczniki izotopów trytu) |
| 6 | **R6** | **L0** (`0.00 m`) | **Hala Turbin i Wymienników Ciepła**<br>*(średnie pomieszczenie SE: dwa wysokociśnieniowe turbozespoły parowo-MHD, pionowe wymienniki ciepła, kolektory pary, wybuchowa beczka chłodziwa)* | `+22 .. +38` | `-4 .. +22` | `16 × 26 m`<br>(`416 m²`) | `+8.00 m`<br>(`H = 8.00 m`, kasetony `ceiling: true`) | **Bursztyn** `#ffae1a` + **Ciepła biel** `#fff1d6` |
| 7 | **R7** | **L0** (`0.00 m`) | **Serwerownia Diagnostyczna i Kwantowa Kontrola Cewki**<br>*(średnie pomieszczenie NE: rzędy szaf superkomputerów Orbis Grid sterujących polem magnetycznym, chłodziarki cieczowe, laser zabezpieczający rdzeń danych)* | `+22 .. +38` | `-22 .. -4` | `16 × 18 m`<br>(`288 m²`) | `+5.60 m`<br>(`H = 5.60 m`, kasetony `ceiling: true`) | **Błękit królewski** `#3d7bff` + **Zieleń** `#6dff4a` |
| 8 | **R8** | **G1** (`+4.80 m`) | **Biuro Kierownika Naukowego Projektu „Helios” (Dr Haruto Mori)**<br>*(mniejsze pomieszczenie NE na poziomie `G1`: biurko kierownika, narożne okno na Tokamak, tablica ze schematem ładowania implantów Rezonansu i kolekcja Easter Eggów z `run1`–`run7` oraz „Iskry”)* | `+6 .. +22` | `-36 .. -22` | `16 × 14 m`<br>(`224 m²`) | `+9.60 m`<br>(`H = 4.80 m`, kasetony `ceiling: true`) | **Ciepła biel** `#fff1d6` + **Bursztyn** `#ffae1a` + **Fiolet** `#8a5cff` |

**Podsumowanie budżetu powierzchni i czytelności w kamerach audytu (`10-top.png`, `08-high-west.png`, `09-high-east.png`):**
- **Dokładnie 8 pomieszczeń (`R1`..`R8`):** 1 wielka Hala Reaktora (`R2`, `44 × 44 m = 1 936 m²` posadzki + `924 m²` dwupoziomowych galerii `G1` i `G2`, wysokość `19.20 m`) oraz 7 średnich i małych pomieszczeń (`224–416 m²`) o natychmiast rozpoznawalnej funkcji technologicznej.
- **Obrys całkowity mapy:** `X ∈ [-38, +38]` (**`76.0 m` szerokości**), `Z ∈ [-36, +36]` (**`72.0 m` długości**).
- **Łączna powierzchnia chodzenia (`walkable: true`):** Poziom Główny `L0` (`3 696 m²`) + Poziom `G1` z Galerią Dolną, Sterownią `R3` i Biurem `R8` (`1 192 m²`) + Poziom `G2` z Galerią Górną (`348 m²`) + 6 biegów ramp/schodów (`~170 m²`) = **`~5 406 m²`**.
- **Gwarancja 100% widoczności na zrzutach z góry:** Ponieważ skrzydła `R1`, `R3`, `R4`, `R5`, `R6`, `R7` i `R8` otaczają Halę Reaktora `R2` bez nakładania się w rzucie `(X, Z)`, a galerie `G1` (`szer. 4.0 m`) i `G2` (`szer. 3.2 m`) biegną wzdłuż ścian hali, po automatycznym ukryciu kasetonowych stropów `ceiling: true` kamera `10-top.png` widzi jednocześnie wszystkie 8 pomieszczeń, oba poziomy pomostów oraz cały Tokamak w centrum.

### 3.3. Rzuty kondygnacji i przekrój pionowy (ASCII)

#### A. Przekrój pionowy Północ–Południe (`X = 0 m`, widok na Zachód `-X`) — Hala Reaktora `H = 19.2 m`, Tokamak, 2 poziomy galerii i Sterownia Główna

```text
          PÓŁNOC (-Z, STEROWNIA GŁÓWNA R3 NA y=+4.8m)                          POŁUDNIE (+Z, WEJŚCIE R1 NA y=0.0m)
Z=-36                   Z=-22     Z=-18.8  Z=-18            Z=-7.0      Z=0      Z=+7.0            Z=+18  Z=+22               Z=+36
y=+19.2m                  +==================================================================================+ <-- Strop Kasetonowy R2 (ceiling:true)
                          |        :                                                                         |
                          |        :                  [Suwnica Pierścieniowa i Kasetony LED]                 |
                          |        :                                                                         |
                          |        :                                                                         |
y=+9.6m  +================+========+.......+                .---[Korona Cewki]---.                           |
         |   R3 STEROWNIA | Galeria:Galeria|              /   Wirujące Pierścienie \                         |
         |     GŁÓWNA     | G2-N   : G1-N  |             |  (( TORUS PLAZMY #ffae1a |                        |
         | [Mostek Helios]|(y=+9.6):       |             |     #fff1d6 / #8a5cff )) |                        |
         | [Konsole Oper.]|        # SZYBA |             |    TOKAMAK HELIOS-IV     |                        |
y=+4.8m  +===[EXIT]=======+========+=======+             |    (Ø 14.0 m, H=10.2 m)  |               +========+=================+ <-- Strop R1 (ceiling:true)
         | [Podbudowa i   |        :       |  / Rampa    |   [Cokół i Dywertor]     |    Rampa \    |Galeria |   R1 SZATNIA I  |
         |  kanały kablowe|        :       | /  L0->G1    \  [Kolizja Podstawy]    /     L0->G1 \   | G1-S   |   DEKONTAMINACJA|
         |  pod R3/R8]    |        :       |/   (25.6°)    +======================+     (25.6°)  \  |(y=+4.8)|  (START GRACZA) |
y=0.0m   +----------------+========+=======+===============+======================+===============+==+========+=====[ENTRY]=====+ <-- Posadzka L0 (y=0.00m)
        Z=-36            Z=-22   Z=-18.8 Z=-18           Z=-7.0      Z=0      Z=+7.0            Z=+18       Z=+22             Z=+36
```

#### B. Rzut Poziomu Głównego (`L0`, `y = 0.00 m`, `X ∈ [-38, +38], Z ∈ [-22, +36]`)

```text
                        PÓŁNOC (-Z) — POD GALERIĄ PÓŁNOCNĄ G1-N (NAD TĄ LINIĄ NA y=+4.80m LEŻĄ STEROWNIA R3 I BIURO R8)
         X=-38                X=-22      X=-18                     X=0                     X=+18      X=+22                X=+38
Z=-22    +====================+==========+==========================+==========================+==========+====================+    Z=-22
         |                    |          |   [Kriopompa NW]                    [Kriopompa NE]  |          |                    |
         |         R4         # Portal   |   fus_cryopump_unit                 fus_cryopump    | Portal   #         R7         |
         |    LABORATORIUM    | R4<->R2N |                                                     | R2<->R7  |    SERWEROWNIA     |
         |   FIZYKI PLAZMY    |(Z=-16..  |     ||Rampa #3||                   ||Rampa #4||     |(Z=-16..  |   DIAGNOSTYCZNA    |
         |     I WIĄZEK       |  -12)    |     ||L0 -> G1||                   ||L0 -> G1||     |  -12)    |  I KONTROLA CEWKI  |
         |    (16 x 22 m)     |          |     || 25.64° ||                   || 25.64° ||     |          |    (16 x 18 m)     |
         |                    | [Okno    |     +----------+   .==========.    +----------+     | [Okno    | [Szafy Kwantowe    |
         | [Ława Inżektora    |  Badaw.] |                  /  CEWKI TF   \                    |  Diagn.] |  Orbis Grid]       |
         |  Wiązki Neutralnej]|(Z=-11..-6|  [HAZARD #1:    /  .----------. \   [Kolektory      |(Z=-10..-6| [HAZARD #3:        |
         | [Komora Próżniowa] |          |   Bank Kondens.|  |   PLAZMA   | |   Chłodziwa]     |          |  Laser Serwerów]   |
         | [Naukowiec C3+C4]  # Portal   |   electric_fld]|  |  TOKAMAK   | |                  |          | [Naukowiec C7]     |
         |                    | R4<->R2S |                |  | HELIOS-IV  | |                  |          |                    |
Z=-4     |                    |(Z=-5..-1)|  [Pulpit Diagn.|  | (0, 0, 0)  | |  [Pulpit Diagn.  |          +------+      +------+    Z=-4
         |                    |          |   Zachodni]     \  '----------' /    Wschodni]      |                 |Brama R7<->R6|
Z=0      +------+      +------+          |   [Naukowiec C1] \  Ø 14.0 m   /    [Naukowiec C2]  |                 |(X=+28..+32) |    Z=0
         |Brama R4<->R5       |          |                   '=========='                      | Portal   #         R6         |
         |(X=-32..-28)        # Portal   |                                                     | R2<->R6N |    HALA TURBIN     |
         |         R5         | R5<->R2N |   [Transformator                    [Transformator  |(Z=+1..+5)|   I WYMIENNIKÓW    |
         |   MAGAZYN PALIWA   |(Z=+3..+7)|    Impulsowy SW]                     Impulsowy SE]  |          |      CIEPŁA        |
         |     FUZYJNEGO      |          |                                                     |          |    (16 x 26 m)     |
         |  (DEUTER / TRYT)   |          |                                                     |          | [Turbozespół MHD 1]|
         |    (16 x 22 m)     # Brama    |                                                     | Brama    # [Turbozespół MHD 2]|
         | [Suwnica Paliwowa] | R5<->R2S |    +------------+                 +------------+    | R2<->R6S | [Wymienniki Ciepła]|
         | [Beczki Trytu]     |(Z=+13..  |    |==Rampa #1==|                 |==Rampa #2==|    |(Z=+13..  | [HAZARD #4:        |
         | [HAZARD #2: Laser] |  +17)    |    |  L0 -> G1  |                 |  L0 -> G1  |    |  +17)    |  Beczka Chłodziwa] |
Z=+22    +====================+==========+====+===+        +=================+        +===+====+==========+====================+    Z=+22
                                         |Brama   |       Portal Główny R1 <-> R2     |   Brama|
                                         |Boczna W|      (X ∈ [-4, +4], szer. 8 m     |Boczna E|
                                         |(-10..-7|       WIDOK NA CAŁY TOKAMAK!)     |(+7..+10|
                                         |        |                                   |        |
                                         |        |                R1                 |        |
                                         | [Szafki|  SZATNIA I ŚLUZA DEKONTAMINACYJNA | [Prysz-|
                                         |  Komb.]|           (24 x 14 m)             |  nice] |
                                         |        |      [Bramka Dozymetryczna]       |        |
                                         |        |      (START GRACZA: 0, 0, +31)    |        |
Z=+36                                    +========+==============[ENTRY]==============+========+                                    Z=+36
                                        X=-12                   (0, 1.5, +36.5)               X=+12
```

#### C. Rzut Poziomu Galerii 1 (`G1`, `y = +4.80 m` — Sterownia Główna `R3`, Biuro Kierownika `R8` i Galerie Obwodowe `G1`)

```text
                        PÓŁNOC (-Z) — ŚLUZA EWAKUACYJNA EXIT W STEROWNI GŁÓWNEJ R3 (X=-8, Y=+6.3, Z=-36.5)
                              X=-22                      X=-8            X=+6                      X=+22
Z=-36                         +===========================[EXIT]==========+=========================+                          Z=-36
                              |                                           |                         |
                              |                    R3                     |           R8            |
                              |        STEROWNIA GŁÓWNA REAKTORA          |    BIURO KIEROWNIKA     |
                              |           („MOSTEK HELIOS-IV”)            #  NAUKOWEGO (DR MORI)    |
                              |          (28 x 14 m, y = +4.80 m)         |  (16 x 14 m, y = +4.80) |
                              |  [Ściana Telemetrii Plazmy EE-10]         | Brama R3<->R8           |
                              |  [Amfiteatralne Konsole Sterowania]       | (Z=-31..-27)            |
                              |  [Naukowiec C5 + C6]                      | [Biurko Dr. Moriego]    |
                              |                                           | [Tablica Rezonansu EE11]|
                              |       [PANCERNA SZYBA OBSERWACYJNA 15m]   | [Naukowiec C8 + EE1..9] |
Z=-22                         +==+      +=================================+==+========+      +======+                          Z=-22
                              |  Portal  |       (mat_glass_clear)           | Okno   |Portal |     |
                              |  R3<->G1W|                                   | R8->R2 |R8<->G1|     |
                              |(-20..-16)|   Galeria Północna G1-N (y=+4.80m)|(+7..14)|(+15.. |     |
                              |          |   (X ∈ [-22, +22], Z ∈ [-22, -18])|        |  +19) |     |
Z=-18                         |          +-----------------------------------+--------+-------+     |                          Z=-18
                              |  Galeria |                                            |  Galeria    |
                              |  Zach.   |     +------+                  +------+     |  Wsch.      |
                              |  G1-W    |     |Rampa |                  |Rampa |     |  G1-E       |
                              | (y=+4.8m)|     |#3 L0 |                  |#4 L0 |     | (y=+4.8m)   |
                              | (sz.4.0m)|     |-> G1 |                  |-> G1 |     | (sz.4.0m)   |
                              |          |     +------+  OTWARTA PUSTKA  +------+     |             |
                              |  +-----+ |                HALI REAKTORA               | +-----+     |
                              |  |Rampa| |               (36 x 36 m wokół             | |Rampa|     |
                              |  |#5 G1| |               TOKAMAKA Ø 14 m!)            | |#6 G1|     |
                              |  |-> G2| |                                            | |-> G2|     |
                              |  +-----+ |                                            | +-----+     |
Z=+18                         |          +------------+                  +------------+             |                          Z=+18
                              |  Galeria Południowa   |   (Otwarte nad   |   Galeria Południowa     |
                              |  G1-SW (Rampa #1 z L0)|   wejściem z R1) |   G1-SE (Rampa #2 z L0)  |
Z=+22                         +=======================+..................+==========================+                          Z=+22
                             X=-22                   X=-6               X=+6                       X=+22
```

#### D. Rzut Poziomu Galerii 2 (`G2`, `y = +9.60 m` — Galeria Górna Inżektorów i Suwnicy w Hali Reaktora `R2`)

```text
                              X=-22    X=-18.8                           X=+18.8   X=+22
Z=-22                         +========+=================================+========+                          Z=-22
                              |        |   Galeria Górna Północna G2-N   |        |
Z=-18.8                       |        +---------------------------------+        |                          Z=-18.8
                              | Galeria|                                 |Galeria |
                              | Górna  |         OTWARTA PRZESTRZEŃ      |Górna   |
                              | Zach.  |          NAD TOKAMAKIEM         |Wsch.   |
                              | G2-W   |       (Widok z wysokości        |G2-E    |
                              | (y=9.6)|        korony cewek y=+9.6m     |(y=9.6) |
                              | sz.3.2m|        na plazmę i posadzkę!)   |sz.3.2m |
Z=+6                          +========+                                 +========+                          Z=+6
                                 ^ Rampa #5 z G1-W (Z:+16->+6)              ^ Rampa #6 z G1-E (Z:+16->+6)
```

### 3.4. Portale przejściowe, rampy/schody na 2 poziomy galerii (`G1`, `G2`) i weryfikacja nawigacji 3D

Wszystkie 6 biegów ramp/schodów stalowych w Hali Reaktora ma czysty obrót wokół pojedynczej osi (`rotation.x` albo `rotation.z`), kąt nachylenia **`25.64° ≤ 26.6°`**, szerokość **`2.80–3.20 m ≥ 2.0 m`** oraz prześwit nad każdym punktem biegu **`≥ 4.20 m`**. Dzięki temu `ArenaSurfaceNavigation` buduje pełny, spójny graf komórek `0.5 × 0.5 m` między wszystkimi trzema poziomami wysokości (`0.00 m`, `+4.80 m`, `+9.60 m`):

| Połączenie / Rampa / Portal | Położenie w rzucie `[X, Z]` | Rzędne `y` | Wymiary i kąt nachylenia | Rola w przepływie walki i nawigacji AI |
|---|---|---|---|---|
| **Wejście `doors[entry]` → R1 (Szatnia-Dekontaminacja)** | `X ∈ [-2, +2], Z = +36.5` | `y = 0.00 m` | `4.0 × 3.0 m` | Punkt wejścia gracza (`playerSpawn: (0, 0, +31)` w `R1`, na osi widoku przez portal na Tokamak w `R2`!) |
| **Portal Główny + 2 Śluzy Boczne `R1 ↔ R2`** | Główny: `X ∈ [-4, +4], Z = +22`<br>Boczne: `X ∈ [-10, -7]` i `[+7, +10], Z = +22` | `y = 0.00 m` | Główny: `8.0 × 3.8 m`<br>Boczne: `3.0 × 3.4 m` | Szerokie otwarcie kadru startowego na Tokamak oraz dwie boczne śluzy do flankowania z szatni |
| **2 Portale Zachodnie `R2 ↔ R5` (Magazyn Paliwa)** | Północny: `X = -22, Z ∈ [+3, +7]`<br>Południowy (suwnica): `X = -22, Z ∈ [+13, +17]` | `y = 0.00 m` | `4.0 × 3.8 m` (×2) | Łączą Halę Reaktora z Magazynem Paliwa Deuter/Tryt `R5` |
| **2 Portale Zachodnie `R2 ↔ R4` (Lab Plazmy) + `R4 ↔ R5`** | `R2↔R4`: `X = -22, Z ∈ [-16, -12]` i `Z ∈ [-5, -1]`<br>`R4↔R5`: `X ∈ [-32, -28], Z = 0` | `y = 0.00 m` | `4.0 × 3.6 m` (×3) | Tworzą zachodnią pętlę flankującą przez Magazyn Paliwa `R5` i Laboratorium Plazmy `R4` |
| **2 Portale Wschodnie `R2 ↔ R6` (Hala Turbin)** | Północny: `X = +22, Z ∈ [+1, +5]`<br>Południowy: `X = +22, Z ∈ [+13, +17]` | `y = 0.00 m` | `4.0 × 3.8 m` (×2) | Łączą Halę Reaktora z Halą Turbin i Wymienników Ciepła `R6` |
| **Portale Wschodnie `R2 ↔ R7` (Serwerownia) + `R6 ↔ R7`** | `R2↔R7`: `X = +22, Z ∈ [-16, -12]`<br>`R6↔R7`: `X ∈ [+28, +32], Z = -4` | `y = 0.00 m` | `4.0 × 3.6 m` (×2) | Tworzą wschodnią pętlę flankującą przez Halę Turbin `R6` i Serwerownię Diagnostyczną `R7` |
| **Rampa #1 (SW `L0 ↔ G1-SW`)** | `X: -6.0 → -16.0`, `Z ∈ [+18.4, +21.6]` | `0.00 → +4.80 m` | Szer. `3.2 m`, dł. `10.0 m`, obrót `rotation.z`, kąt **`25.64°`** | Południowo-zachodnie wejście z posadzki Hali Reaktora na Galerię `G1` tuż po wyjściu ze Śluzy `R1` |
| **Rampa #2 (SE `L0 ↔ G1-SE`)** | `X: +6.0 → +16.0`, `Z ∈ [+18.4, +21.6]` | `0.00 → +4.80 m` | Szer. `3.2 m`, dł. `10.0 m`, obrót `rotation.z`, kąt **`25.64°`** | Symetryczne południowo-wschodnie wejście z posadzki Hali Reaktora na Galerię `G1` |
| **Rampa #3 (NW `L0 ↔ G1-N`)** | `X ∈ [-17.6, -14.8]`, `Z: -8.0 → -18.0` | `0.00 → +4.80 m` | Szer. `2.8 m`, dł. `10.0 m`, obrót `rotation.x`, kąt **`25.64°`** | Północno-zachodni bieg prowadzący z posadzki Hali wprost przed zachodni portal Sterowni Głównej `R3` |
| **Rampa #4 (NE `L0 ↔ G1-N`)** | `X ∈ [+14.8, +17.6]`, `Z: -8.0 → -18.0` | `0.00 → +4.80 m` | Szer. `2.8 m`, dł. `10.0 m`, obrót `rotation.x`, kąt **`25.64°`** | Północno-wschodni bieg prowadzący z posadzki Hali wprost przed portal Biura Kierownika `R8` i Sterowni `R3` |
| **Rampa #5 (Zachodnia Górna `G1-W ↔ G2-W`)** | `X ∈ [-21.8, -19.0]`, `Z: +16.0 → +6.0` | `+4.80 → +9.60 m` | Szer. `2.8 m`, dł. `10.0 m`, obrót `rotation.x`, kąt **`25.64°`** | Zachodnie wejście z Galerii `G1` na Galerię Górną `G2` (`y = +9.60 m`) na poziom korony Tokamaka |
| **Rampa #6 (Wschodnia Górna `G1-E ↔ G2-E`)** | `X ∈ [+19.0, +21.8]`, `Z: +16.0 → +6.0` | `+4.80 → +9.60 m` | Szer. `2.8 m`, dł. `10.0 m`, obrót `rotation.x`, kąt **`25.64°`** | Symetryczne wschodnie wejście z Galerii `G1` na Galerię Górną `G2` (`y = +9.60 m`) |
| **Portale Północne `G1-N ↔ R3` (Sterownia) i `G1-N ↔ R8` (Biuro) + `R3 ↔ R8`** | `G1↔R3`: `X ∈ [-20, -16]` i `[+1, +5], Z = -22`<br>`G1↔R8`: `X ∈ [+15, +19], Z = -22`<br>`R3↔R8`: `X = +6, Z ∈ [-31, -27]` | `y = +4.80 m` | `4.0 × 3.6 m` (×4) | Pełne połączenie kołowe między Galerią Północną `G1`, Sterownią Główną `R3` i Biurem Kierownika `R8` |
| **Wyjście `doors[exit]` (północ `R3` Sterownia Główna)** | `X ∈ [-10, -6], Z = -36.5` | `y = +4.80 m` (`pos.y = +6.30`) | `4.0 × 3.0 m` | Pancerna śluza ewakuacyjna na północnej ścianie Sterowni Głównej `R3` |

### 3.5. Szczegółowy opis wszystkich 8 pomieszczeń (`R1`..`R8`) — wyposażenie, osłony, linie strzału i rola w walce

#### 1. `R1` — Szatnia i Śluza Dekontaminacyjna (`L0`, `X ∈ [-12, +12], Z ∈ [+22, +36], y = 0.00 m`)
- **Tożsamość i kadr startowy (`01-spawn.png` z `playerSpawn: (0, 0, +31)`):**
  - Pancerne pomieszczenie wejściowe wyłożone żebrowanym betonem radiacyjnym `fus_reactor_concrete` i płytami `fus_control_tile`, ze stropem kasetonowym na `y = +4.80 m` (`fus_ceiling_coffer_bay`).
  - Patrząc z punktu startu na północ (`-Z`), gracz widzi dwie bramki pryszniców dekontaminacyjnych `fus_decon_shower_arch` z zielono-bursztynowymi skanerami dozymetrycznymi i unoszącą się mgiełką pary (`ambientFx: steam`), a przez szeroki na **`8.0 m` Portal Główny (`X ∈ [-4, +4], Z = +22`)** — monumentalne wnętrze wysokiej na `19.20 m` **Hali Reaktora `R2`**, bijący ciepłobiałym, bursztynowym i fioletowym blaskiem **Tokamak Helios-IV**, dwupoziomowe galerie `G1`/`G2` oraz górujące nad halą pancerne okno **Sterowni Głównej `R3`**!
- **Wyposażenie i osłony:**
  - Wzdłuż ścian zachodniej i wschodniej stoją szafki na żółto-bursztynowe kombinezony radiacyjne `fus_suit_locker_bank`, ławki szatniowe `fus_decon_bench`, stacje dozymetryczne `fus_wall_dosimeter_station` oraz 3 skrzynie `crate_small` gotowe do Chwytu Rezonansem.

#### 2. `R2` — Główna Hala Reaktora Fuzyjnego „Komora Tokamaka Helios-IV” (`L0 + G1 + G2`, `X ∈ [-22, +22], Z ∈ [-22, +22], y = 0.00..19.20 m`)
- **Tożsamość i rola jako CENTRUM WALKI (`1 936 m²` posadzki + `924 m²` galerii na 2 poziomach):**
  - Monumentalna katedra przemysłowa Kurogane Arms o wysokości **`H = 19.20 m`**. Jednolita, lustrzana posadzka `fus_reactor_floor` odbija wirujące pierścienie cewek i plazmę Tokamaka, a kasetonowy strop ze świetlikami technicznymi (`y = +19.20 m`, `ceiling: true`) zamyka przestrzeń od góry.
- **Centralny Set Piece — Tokamak „Kurogane Helios-IV” (`(0, 0, 0)`):**
  - Zajmuje centralny okrąg o średnicy `14.0 m` (`promień 7.0 m`, wysokość `10.2 m`). Dolny cokół dywertora i rdzeń solenoidu tworzą masywną, niezniszczalną osłonę centralną, wokół której biegnie pierścieniowy tor manewrowy (`promień 7.0..18.0 m`).
- **Pierścień osłon na posadzce głównej (`y = 0.00 m`) wokół reaktora:**
  - Aby walka wokół Tokamaka nie była pustą otwartą przestrzenią, w pierścieniu `R = 9.5..16.5 m` rozmieszczono symetrycznie ciężką aparaturę fuzyjną dającą twarde osłony wysokie i średnie:
    - 4 **Jednostki Kriopomp Helowych `fus_cryopump_unit`** (`2.8 × 2.6 × 1.8 m`) w kwadrantach NW, NE, SW, SE (`(±10.5, 0, ±10.5)`), połączone z cokołem reaktora magistralami chłodziwa `fus_coolant_pipe_arch` (prześwit pod łukiem rury `3.4 m ≥ 2.2 m`, dzięki czemu nie blokują ruchu!),
    - 4 **Pulpity Diagnostyki Polowej `fus_diagnostic_console`** (`2.6 × 1.25 × 1.1 m`) na osiach kardynalnych (`(±11.5, 0, 0)` oraz `(0, 0, ±11.5)`), przy których na starcie pracuje 2 naukowców Kurogane,
    - 4 **Banki Kondensatorów Impulsowych `fus_capacitor_bank`** (`3.6 × 2.8 × 1.6 m`) przy filarach podgaleryjnych (`(±15.5, 0, ±6.5)`),
    - **Hazard #1 (`electric_field`, `id: "reactor-west-capacitor-arc"`):** przeciążona sekcja kondensatorów po zachodniej stronie hali (`(-16.0, 1.0, -3.0)`, `size: 2.8 × 2.0 × 3.2 m`), w którą gracz może wpychać wrogów Pchnięciem Rezonansu.
- **Dwa poziomy galerii / pomostów obwodowych (`G1` na `y = +4.80 m` i `G2` na `y = +9.60 m`):**
  - **Poziom 1 (`G1`, `y = +4.80 m`, szer. `4.0 m`):** stalowe pomosty `fus_catwalk_deck` z barierkami `fus_catwalk_railing` (`wys. 1.10 m`, z bursztynową listwą LED) oraz skrzyniami rozdzielczymi `fus_junction_box` jako osłonami na pomostach. Na `G1` prowadzą z posadzki 4 szerokie rampy (**Rampy #1–#4**). Z północnej galerii `G1-N` gracz wchodzi bezpośrednio do **Sterowni Głównej `R3`** i **Biura Kierownika `R8`**.
  - **Poziom 2 (`G2`, `y = +9.60 m`, szer. `3.2 m`):** górna galeria inspekcyjna na wysokości szczytu Tokamaka, dostępna **Rampami #5 i #6** z poziomu `G1`. Rozstawieni tu snajperzy i strzelcy Kurogane mają wgląd na całą halę, a zrzucenie ich Pchnięciem Rezonansu z wysokości `9.60 m` na posadzkę daje ogromną satysfakcję!

#### 3. `R3` — Sterownia Główna Reaktora „Mostek Helios-IV” (`G1`, `X ∈ [-22, +6], Z ∈ [-36, -22], y = +4.80 m`)
- **Tożsamość i widok na Reaktor (`392 m²`):**
  - Główny mostek dowodzenia elektrownią na poziomie `y = +4.80 m`. Cały centralny odcinek ściany południowej (`X ∈ [-15, 0], Z = -22, Y ∈ [+4.80, +9.20]`) zajmuje **15-metrowe Pancerne Okno Obserwacyjne Sterowni `fus_control_window_wall`** (`mat_glass_clear`). Stojąc przy konsolach w `R3`, gracz i operatorzy patrzą przez szybę prosto na wirujący w odległości zaledwie 15 metrów **Tokamak Helios-IV**!
- **Wyposażenie, naukowcy i wyjście `doors[exit]`:**
  - Dwa amfiteatralne rzędy **Konsol Sterowania Reaktorem `fus_main_control_desk`** (`3.8 × 1.25 × 1.4 m` ×4) z potrójnymi ekranami telemetrii (`mat_screen_fus_tokamak`) i fotelami operatorów w kolorze z motywu mapy (`fabric: "#4a566e"`).
  - Na ścianie północnej (`Z = -35.8`): wielka **Ściana Telemetrii i Schematu Cewki `fus_telemetry_screen_wall`** (`4.8 × 2.6 × 0.28 m`) z easter eggiem **EE-10 (alarm Orbis Grid / Bajt)**, a obok niej na `(X = -8.0, Y = +6.30, Z = -36.5)` — pancerna śluza ewakuacyjna **`doors[exit]`** podświetlona zielenią `#6dff4a`.
  - Przy konsolach pracuje **2 naukowców (`C5`, `C6`)**, którzy na widok gracza uciekają do kryjówek `hideSpots` za bocznymi szafami telemetrycznymi i pod murek okna obserwacyjnego.

#### 4. `R4` — Laboratorium Fizyki Plazmy i Wiązek (`L0`, `X ∈ [-38, -22], Z ∈ [-22, 0], y = 0.00 m`)
- **Tożsamość i rola w walce (`352 m²`):**
  - Wysokotechnologiczne laboratorium badawcze po północno-zachodniej stronie Hali Reaktora, utrzymane w fiolecie (`#8a5cff`), błękicie królewskim (`#3d7bff`) i ciepłej bieli (`#fff1d6`). Przez pancerne okno badawcze w ścianie wschodniej (`X = -22, Z ∈ [-11, -6]`) widać z poziomu parteru komorę Tokamaka.
- **Wyposażenie, osłony i naukowcy:**
  - W osi pokoju stoją dwie długie **Ławy Inżektora Wiązki Neutralnej `fus_neutral_beam_injector`** (`4.8 × 1.85 × 1.6 m`) z miedziano-tytanowymi cewkami ogniskującymi i wziernikami plazmowymi (`mat_neon_violet`) — doskonałe twarde osłony dzielące laboratorium na dwie aleje taktyczne.
  - Przy ścianie zachodniej (`X = -37.8`): **Komory Próżniowe Próbników Plazmy `fus_plasma_test_chamber`** (`2.4 × 2.3 × 1.4 m`), stoły laboratoryjne z oscyloskopami `fus_lab_bench_oscilloscope` oraz **Tablica z Równaniami Magnetohydrodynamiki `fus_whiteboard_equations`** (z easter eggiem **EE-03** nawiązującym do Sektora X-51 `run3`).
  - W laboratorium przebywa **2 naukowców (`C3`, `C4`)** z 4 punktami `hideSpots` za komorami próżniowymi i ławami inżektorów.

#### 5. `R5` — Magazyn Paliwa Fuzyjnego: Deuter / Tryt (`L0`, `X ∈ [-38, -22], Z ∈ [0, +22], y = 0.00 m`)
- **Tożsamość i rola w walce (`352 m²`, wysokość `H = 7.20 m`):**
  - Wysoka hala składowania izotopów paliwowych w południowo-zachodnim skrzydle elektrowni. Pod stropem na `y = +5.80..+7.20 m` rozpięta jest żółto-bursztynowa **Suwnica Magazynu Paliwa `fus_fuel_gantry_crane`** (`14.0 × 1.4 × 3.2 m`, `CEILING_FIXTURES`) z chwytnikiem klatkowym.
- **Wyposażenie, osłony i hazard:**
  - Na posadzce w wyznaczonych pasami BHP gniazdach stoją pancerne **Palety Beczek Izotopowych Deuteru/Trytu `fus_tritium_cask_pallet`** (`2.2 × 1.45 × 2.2 m` ×4, z zielonymi znacznikami trytu `#6dff4a` i etykietą `label_tritium_cask`) oraz dwa wysokie **Kriogeniczne Zbiorniki Deuteru `fus_deuterium_cryo_tank`** (`2.8 × 3.6 × 2.8 m`) z parującymi zaworami (`ambientFx: steam`).
  - Na ścianie południowej wisi manifest transportowy **Easter Egg #1 (`fus_ee_run1_warehouse_manifest.webp` — dostawa z Magazynu K-09 `run1`)** oraz **Easter Egg #6 (`fus_ee_run6_market_he3.webp` — zarekwirowane ogniwa z Nocnego Targu `run6`)**.
  - **Hazard #2 (`laser_gate`, `id: "fuel-vault-isotope-laser"`):** bramka laserowa grodząca zachodni sektor składowania trytu (`from: (-36.5, 0.85, 11.0), to: (-29.5, 0.85, 11.0)`, `cycle: { onS: 2.6, offS: 1.8 }`).

#### 6. `R6` — Hala Turbin i Wymienników Ciepła (`L0`, `X ∈ [+22, +38], Z ∈ [-4, +22], y = 0.00 m`)
- **Tożsamość i rola w walce (`416 m²`, wysokość `H = 8.00 m`):**
  - Potężna maszynownia konwersji energii po południowo-wschodniej stronie Hali Reaktora, skąpana w bursztynowym świetle (`#ffae1a`) i kłębach pary technologicznej.
- **Wyposażenie, osłony i hazard:**
  - Wzdłuż osi północ–południe stoją dwa monumentalne **Turbozespoły Parowo-MHD `fus_steam_turbine_generator`** (`3.8 × 2.8 × 7.2 m`) z żebrowanymi korpusami, wałami napędowymi i bursztynowymi wskaźnikami obrotów — dwie ogromne bryły osłon, wokół których toczy się walka w zwarciu.
  - Przy ścianie wschodniej (`X = +35.5`): trzy pionowe **Wymienniki Ciepła Obiegu Pierwotnego `fus_heat_exchanger_tower`** (`2.4 × 4.6 × 2.4 m`) spięte kolektorami rurowymi `fus_wall_pipe_manifold` oraz tablica serwisowa z **Easter Eggiem #2 (`fus_ee_run2_atrium_power_cut.webp` — zrzut mocy z galerii Atrium Nova `run2`)**.
  - **Hazard #4 (`explosive_barrel`, `id: "turbine-hall-coolant-barrel"`):** nadciśnieniowy zbiornik chłodziwa między turbinami na `(+29.5, 0.0, +9.0)` — jeden celny strzał detonuje go w grupie szturmowców.

#### 7. `R7` — Serwerownia Diagnostyczna i Kwantowa Kontrola Cewki (`L0`, `X ∈ [+22, +38], Z ∈ [-22, -4], y = 0.00 m`)
- **Tożsamość i rola w walce (`288 m²`):**
  - Chłodzona cieczą serwerownia czasu rzeczywistego w północno-wschodnim skrzydle parteru, utrzymana w błękicie królewskim (`#3d7bff`) i zieleni (`#6dff4a`). To tutaj algorytmy Orbis Grid korygują co milisekundę kształt pola magnetycznego utrzymującego plazmę w Tokamaku.
- **Wyposażenie, naukowiec i hazard:**
  - Trzy rzędy **Szaf Kwantowych Sterowania Cewką `fus_quantum_server_rack`** (`2.8 × 2.4 × 1.1 m` ×6) tworzące gęsty labirynt CQB do krótkich doskoków (`dash`) i odbijania pocisków ostrzem, uzupełnione agregatami chłodzenia cieczowego `fus_server_cooling_unit`.
  - Przy terminalu diagnostycznym pracuje **1 naukowiec (`C7`)** z 4 kryjówkami `hideSpots` w niszach między szafami serwerowymi.
  - **Hazard #3 (`laser_gate`, `id: "server-coil-control-laser"`):** bramka laserowa zabezpieczająca północny rząd szaf kwantowych (`from: (+24.0, 0.85, -13.0), to: (+30.0, 0.85, -13.0)`, `cycle: { onS: 2.2, offS: 1.6 }`).

#### 8. `R8` — Biuro Kierownika Naukowego Projektu „Helios” (`G1`, `X ∈ [+6, +22], Z ∈ [-36, -22], y = +4.80 m`)
- **Tożsamość i rola fabularna (`224 m²`, skarbnica Easter Eggów):**
  - Prywatny gabinet **dr. hab. Haruto Moriego** na poziomie `y = +4.80 m`, sąsiadujący przez wewnętrzne przeszklenie i portal ze Sterownią Główną `R3` oraz posiadający własne narożne okno obserwacyjne (`Z = -22, X ∈ [+7, +14]`) wychodzące bezpośrednio na Tokamak w Hali Reaktora `R2`.
- **Wyposażenie, naukowiec i Easter Eggi:**
  - W centrum gabinetu (`X = +14.0, Z = -29.0`): szerokie **Biurko Kierownika Naukowego `fus_director_desk`** (`2.8 × 1.15 × 1.3 m`) z makietą holograficzną torusa tokamaka, kubkiem **EE-12 (`label_fusion_director_mug`)** oraz raportami dla Zarządu Kurogane Tower (**EE-04 `run4`**), Kliniki Helixa (**EE-05 `run5`**) i Pułkownika Vane'a z Willi Kuroyama (**EE-07 `run7`**).
  - Na ścianie wschodniej (`X = +21.95`, dekale w odległości `0.03 m ≤ 0.10 m` od ściany!): podświetlana **Tablica Schematu Zasilania Sztucznych Implantów Rezonansu i Obławy na „Iskrę”** (**EE-08, EE-09, EE-11**) oraz regał archiwalny `fus_director_bookcase`.
  - W gabinecie przebywa **1 naukowiec (`C8` — sam dr Mori / starszy fizyk dyżurny)**, który na widok gracza chowa się do jednej z 4 kryjówek `hideSpots` za biurkiem, regałem lub sofą gabinetową.
  - **Uwaga z nauczki `run7`:** Dywan pod strefą wypoczynkową gabinetu jest zrealizowany jako płaski `decal` podłogowy (`surface: "floor"`), dzięki czemu `spawnPoints` w `R8` leżą bezpośrednio na płycie `fus_control_tile` (`y = +4.80 m`) bez żadnego bloku przeszkody!

---

## 4. Reaktor Fuzyjny (Tokamak „Helios-IV”) — specyfikacja wizualna, animacja, audio i kolizja podstawy

### 4.1. Wpis `setPieces` w danych pokoju `src/data/rooms/run8.json`

Reaktor w centrum Hali `R2` (`(0, 0, 0)`) jest deklarowany w pliku `src/data/rooms/run8.json` w polu `setPieces` i renderowany proceduralnie w Three.js przez dedykowany moduł `src/render/fusionReactor.ts` (realizowany równolegle przez innego wykonawcę):

```json
"setPieces": [
  {
    "kind": "fusionReactor",
    "position": { "x": 0, "y": 0, "z": 0 },
    "yaw": 0,
    "scale": 1
  }
]
```

### 4.2. Wygląd, anatomia 3D i warstwy animacji Tokamaka w `src/render/fusionReactor.ts`

Tokamak **„Kurogane Helios-IV”** ma średnicę zewnętrzną toru **`14.0 m`** (`promień 7.0 m`) i wysokość całkowitą **`10.2 m`** (`y = 0.00..10.20 m`). Projekt wizualny łączy brutalistyczną inżynierię ciężkiej stali Kurogane z hipnotyzującym spektaklem zamkniętej w polu magnetycznym gwiazdy:

| Warstwa Tokamaka | Wymiary i rzędne `y` | Materiały i kolorystyka (zgodna z ADR 0006 — ZERO magenty, cyanu i czerwieni!) | Animacja w `render(alpha)` |
|---|---|---|---|
| **1. Cokół Kriostatu i Pierścień Dywertora (Podstawa)** | `Ø 12.4 m` (`R = 6.2 m`), `y = 0.00..2.40 m` | Ciężka stal pancerna i żebrowany beton (`#2a3344`, `#435169`), pasy ostrzegawcze BHP w bursztynie (`#e09a1a`) oraz 12 króćców rur chłodzących. | Statyczna podstawa z subtelnym drganiem i 4 dyszami wydmuchującymi co kilka sekund kłęby białej pary chłodzącej (`ambientFx: steam`). |
| **2. Klatka 12 Cewek Pola Toroidalnego (TF Coils)** | `Ø 14.0 m` (`R = 2.2..7.0 m`), `y = 1.60..9.20 m` | 12 rozmieszczonych co `30°` monumentalnych, D-kształtnych ram ze szczotkowanego tytanu i ciemnego lakieru (`#394457`, `#2e3c5e`) z fazowanymi krawędziami i pionowymi szczelinami świetlnymi w bursztynie (`#ffae1a`). | Delikatna wibracja harmoniczna (`amplitude = 0.008 m`, `freq = 18 Hz`) wywołana naprężeniem pola magnetycznego `16 Tesli`. |
| **3. Komora Próżniowa i Pulsujący Torus Plazmy Fuzyjnej** | Promień główny torusa `R_major = 4.60 m`, promień rury plazmy `r_minor = 1.65 m`, środek na `y = 5.20 m` | Pomiędzy 12 cewkami TF znajdują się pancerne okna kriostatu (`mat_glass_clear`), przez które widać gorący **Torus Plazmy Fuzyjnej**:<br>• **Rdzeń plazmy:** rozżarzona **ciepła biel (`#fff1d6`)**,<br>• **Płaszcz konwekcyjny:** ognisty **bursztyn (`#ffae1a`)**,<br>• **Zewnętrzna otoczka zjonizowana (korona magnetyczna):** głęboki **fiolet (`#8a5cff`)** z refleksami **królewskiego błękitu (`#3d7bff`)**.<br>*(Bezwzględny zakaz magenty `#ff2bd6`, cyanu `#00e5ff` i czerwieni `#e0262b`!)* | Płynna rotacja helikalnych włókien plazmy wokół osi torusa (`ω = 2.4 rad/s`) połączona z niskoczęstotliwościowym pulsowaniem jasności (`0.85..1.20` w cyklu `1.8 s`) i falowaniem powierzchni w vertex/fragment shaderze. |
| **4. Wirujące Pierścienie Cewek Poloidalnych (PF Rings)** | 3 koncentryczne pierścienie na `y = 3.10 m`, `y = 5.20 m` i `y = 7.60 m` (`Ø 11.2..13.8 m`) | Stalowo-mosiężne obręcze z segmentami nadprzewodników podświetlonymi **ciepłą bielą (`#fff1d6`)**, **bursztynem (`#ffae1a`)** i **błękitem (`#3d7bff`)**. | **Przeciwbieżny obrót ciągły wokół osi Y:** pierścień dolny i górny obracają się z prędkością `+0.65 rad/s`, a pierścień środkowy `-0.90 rad/s`, rzucając dynamiczne refleksy w mokrej posadzce hali! |
| **5. Łuki Wyładowań, Korona Solenoidu i Światła Ostrzegawcze** | Szczytowa kopuła `Ø 7.6 m` na `y = 8.40..10.20 m` | Kolektor wysokiego napięcia z izolatorami ceramicznymi, 6 obrotowych bądź migających lamp ostrzegawczych oraz geometryczne wstęgi łuków elektrycznych. | Co `0.4–1.1 s` między sąsiednimi cewkami TF a koroną przeskakują łuki wyładowań w kolorze `#fff1d6` / `#8a5cff` / `#3d7bff`; lampy ostrzegawcze pulsują w rytmie alarmowym wyłącznie w **bursztynie (`#ffae1a`)**. |
| **6. Warstwa Audio i Ambientalna** | Centrum `(0, 5.0, 0)`, promień słyszalności `55 m` | Basowy pomruk pola magnetycznego (`60 Hz`), syk zaworów kriogenicznych i trzask wyładowań koronowych (`ambience: generator` + lokalne `ambientFx: sparks` i `steam`). | Stały, potężny krajobraz dźwiękowy dający poczucie obecności żywej maszyny w centrum areny. |

### 4.3. Kolizja podstawy w generatorze `run8.mjs` (`blocks[]`)

Aby Tokamak miał solidną fizykę Rapiera i działał jako centralna osłona dla gracza oraz wrogów, a jednocześnie **nie kolidował z rozgrywką ponad niezbędny obrys cokołu** (nie blokował skoków na galeriach ani rzutów przez górną strefę hali):
1. **Dolny cokół dywertora (`y = 0.00..2.40 m`, `walkable: false`):** generator `run8.mjs` wstawia w `(0, 0, 0)` układ 3 krzyżujących się bloków ośmiokątnego postumentu wpisanych w okrąg `R = 6.0 m`:
   - blok `12.0 × 2.4 × 5.0 m` (`material: "fus_shield_panel"`),
   - blok `5.0 × 2.4 × 12.0 m` (`material: "fus_shield_panel"`),
   - blok przekątniowy `8.6 × 2.4 × 8.6 m` (`material: "fus_reactor_concrete"`).
2. **Centralna kolumna solenoidu (`y = 2.40..9.60 m`, `walkable: false`):** w samym środku `(0, 6.0, 0)` stoi pojedynczy pionowy blok rdzenia `4.8 × 7.2 × 4.8 m` (`visible: false`), który zatrzymuje pociski strzelane na przestrzał przez środek torusa na wysokości galerii `G1`/`G2`, ale zostawia **cały zewnętrzny torus cewek i wirujących pierścieni (`R = 2.4..7.0 m` na `y > 2.40 m`) wolny od bloków kolizji**, dzięki czemu gracz ma pełną swobodę ruchu wokół podstawy i czyste linie celowania między galeriami!

### 4.4. Decyzja projektowa: Reaktor jako czysta dekoracja i twarda osłona (BEZ hazardu wokół podstawy) — uzasadnienie

**Decyzja:** Sam Reaktor Fuzyjny w centrum Hali `R2` **nie posiada strefy obrażeń (`hazard`) przy podstawie** — pełni rolę monumentalnej dekoracji (`setPiece`) oraz głównej twardej osłony w centrum areny, natomiast zagrożenia środowiskowe (`hazards[]`) są odsunięte do czytelnych wnęk przy ścianach zewnętrznych hali i w pokojach bocznych.

**Uzasadnienie (wspierające Filar 1 — Feel walki i Filar 4 — Czytelność):**
1. **Karuzela ruchu w centrum areny:** Obwód cokołu Tokamaka (`R = 6.2..9.5 m`) to główny pierścień manewrowy Hali `R2`, po którym gracz biega w ślizgu (`slide`), wykonuje doskoki (`dash`), paruje pociski i ściga wrogów Ostrzem Plazmowym. Umieszczenie ciągłego pola elektrycznego przy samym cokole karałoby gracza za dynamiczną walkę wręcz w najbardziej widowiskowym miejscu mapy.
2. **Ochrona czytelności i nawigacji AI / naukowców:** Wokół cokołu poruszają się szturmowcy, tarczownicy oraz uciekający naukowcy (`C1`, `C2`). Brak hazardu na pierścieniu centralnym gwarantuje, że AI nie ginie przypadkowo podczas okrążania reaktora, a gracz może świadomie wykorzystywać Pchnięcie Rezonansu do wrzucania wrogów w dedykowany **Hazard #1 (`reactor-west-capacitor-arc`)** przy zachodnim banku kondensatorów.

---

## 5. NPC-naukowcy Kurogane Arms (`civilians` i `hideSpots`)

### 5.1. Kontrakt danych i zasady zachowania (`docs/systems/civilians.md`)

Zgodnie ze specyfikacją systemu cywilów (`docs/systems/civilians.md`, realizowanego przez osobnego wykonawcę), w `src/data/rooms/run8.json` umieszczamy dwa powiązane pola:
- `civilians: [{ id: "scientist", position: { x, y, z }, yaw }]` — początkowe pozycje i orientacje naukowców Kurogane Arms (w białych/grafitowych fartuchach laboratoryjnych z bursztynowymi identyfikatorami — zero czerwieni, by gracz w `0.2 s` odróżnił niegroźnego naukowca od czerwonego wroga!),
- `hideSpots: [{ x, y, z }]` — punkty docelowe ucieczki ukryte w narożnikach i za twardymi osłonami.

**Zasady zachowania w grze:**
1. **Brak agresji:** Naukowcy nie posiadają broni, nie strzelają i nie blokują ukończenia fali (`wave_cleared` zależy wyłącznie od eliminacji wrogów Koalicji).
2. **Reakcja na gracza i walkę:** Na starcie stoją przy pulpitach, tablicach i oknach pomiarowych. Z chwilą zauważenia gracza lub pierwszego wystrzału/ciosu biegną najkrótszą ścieżką po tej samej kondygnacji do najbliższego wolnego punktu `hideSpots`, gdzie **kucają z rękami osłaniającymi głowę i pozostają tam do końca starcia**.
3. **Śmiertelność:** Naukowca można zastrzelić z blastera, ciąć ostrzem plazmowym lub razić wybuchem/Rezonansem — trafiony naukowiec pada na posadzkę, a jego ciało leży nieruchomo do końca pokoju.

### 5.2. Tabela rozmieszczenia 8 naukowców (`civilians[]`) w Hali Reaktora i pomieszczeniach

Na mapie `run8` rozmieszczamy **8 naukowców** (w wymaganym przedziale `6–9`) w 5 kluczowych pomieszczeniach badawczo-sterowniczych (`R2`, `R3`, `R4`, `R7`, `R8`):

| Nr | ID wpisu | Pomieszczenie i poziom `y` | Pozycja `{ x, y, z }` | `yaw` [rad] | Co robi przed wykryciem gracza i dokąd ucieka |
|---:|---|---|---|---:|---|
| **C1** | `scientist` | **R2** Hala Reaktora — Zachód (`y = 0.00 m`) | `{ "x": -10.5, "y": 0.0, "z": 0.0 }` | `0.00` | Monitoruje zachodni pulpit diagnostyczny `fus_diagnostic_console` przed Tokamakiem; ucieka za zachodni bank kondensatorów (`HS-01`..`HS-02`). |
| **C2** | `scientist` | **R2** Hala Reaktora — Wschód (`y = 0.00 m`) | `{ "x": 10.5, "y": 0.0, "z": 0.0 }` | `3.14` | Odczytuje parametry kriopompy przy wschodnim pulpicie przed Tokamakiem; ucieka w narożnik za wschodnią kriopompę lub pod galerię (`HS-03`..`HS-04`). |
| **C3** | `scientist` | **R4** Laboratorium Plazmy — N (`y = 0.00 m`) | `{ "x": -29.0, "y": 0.0, "z": -15.0 }` | `1.57` | Kalibruje północną ławę inżektora wiązki neutralnej; ucieka za komorę próżniową przy ścianie zachodniej (`HS-09`..`HS-12`). |
| **C4** | `scientist` | **R4** Laboratorium Plazmy — S (`y = 0.00 m`) | `{ "x": -34.0, "y": 0.0, "z": -6.0 }` | `-1.57` | Zapisuje równania na tablicy `fus_whiteboard_equations` i przy oscyloskopie; ucieka w południowo-zachodni narożnik za stół laboratoryjny (`HS-09`..`HS-12`). |
| **C5** | `scientist` | **R3** Sterownia Główna — W (`y = +4.80 m`) | `{ "x": -11.0, "y": 4.8, "z": -26.5 }` | `0.00` | Stoi przy zachodniej konsoli sterowania przed wielką szybą z widokiem na Tokamak; ucieka za zachodnią szafę telemetrii (`HS-05`..`HS-08`). |
| **C6** | `scientist` | **R3** Sterownia Główna — E (`y = +4.80 m`) | `{ "x": -3.0, "y": 4.8, "z": -26.5 }` | `0.00` | Nadzoruje wykresy stabilności plazmy przy wschodniej konsoli Sterowni; ucieka pod murek podokienny lub w narożnik północno-wschodni (`HS-05`..`HS-08`). |
| **C7** | `scientist` | **R7** Serwerownia Diagnostyczna (`y = 0.00 m`) | `{ "x": 31.0, "y": 0.0, "z": -16.5 }` | `3.14` | Diagnozuje szafy kwantowe kontroli cewki; ucieka w osłoniętą wnękę za agregatem chłodzenia cieczowego (`HS-13`..`HS-16`). |
| **C8** | `scientist` | **R8** Biuro Kierownika Naukowego (`y = +4.80 m`) | `{ "x": 14.0, "y": 4.8, "z": -28.0 }` | `0.00` | **Dr Haruto Mori** — analizuje raporty przy biurku `fus_director_desk` i tablicy Rezonansu; ucieka za biurko lub w narożnik za regałem archiwalnym (`HS-17`..`HS-20`). |

### 5.3. Tabela 20 kryjówek (`hideSpots[]` — po 4 kryjówki na każde z 5 pomieszczeń z naukowcami)

Każde pomieszczenie z naukowcami posiada dokładnie **4 punkty `hideSpots`** (w wymaganym przedziale `3–5` na pomieszczenie), położone na tej samej wysokości `y` co przypisani naukowcy, poza liniami głównego ostrzału i z dala od zagrożeń `hazards[]`:

| Pomieszczenie | Poziom `y` | Liczba naukowców | Liczba kryjówek | Współrzędne `hideSpots` `{ x, y, z }` i opis osłony |
|---|---|---:|---:|---|
| **R2 — Główna Hala Reaktora** | `0.00 m` | 2 (`C1`, `C2`) | **4** | • `HS-01`: `{ "x": -19.5, "y": 0.0, "z": -16.5 }` (narożnik NW pod Galerią `G1-W` za bankiem kondensatorów)<br>• `HS-02`: `{ "x": -19.5, "y": 0.0, "z": 10.5 }` (nisza SW pod Galerią `G1-W` za transformatorem impulsowym)<br>• `HS-03`: `{ "x": 19.5, "y": 0.0, "z": -16.5 }` (narożnik NE pod Galerią `G1-E` za kolektorem chłodziwa)<br>• `HS-04`: `{ "x": 19.5, "y": 0.0, "z": 10.5 }` (nisza SE pod Galerią `G1-E` za wschodnim transformatorem) |
| **R3 — Sterownia Główna Reaktora** | `+4.80 m` | 2 (`C5`, `C6`) | **4** | • `HS-05`: `{ "x": -20.5, "y": 4.8, "z": -34.5 }` (narożnik NW za zachodnią szafą telemetrii)<br>• `HS-06`: `{ "x": -13.5, "y": 4.8, "z": -23.2 }` (za pełnym parapetem pod oknem obserwacyjnym Sterowni)<br>• `HS-07`: `{ "x": -2.5, "y": 4.8, "z": -23.2 }` (za wschodnim segmentem konsoli pod oknem obserwacyjnym)<br>• `HS-08`: `{ "x": 4.5, "y": 4.8, "z": -34.5 }` (narożnik NE Sterowni za szafą zasilania awaryjnego) |
| **R4 — Laboratorium Fizyki Plazmy** | `0.00 m` | 2 (`C3`, `C4`) | **4** | • `HS-09`: `{ "x": -36.5, "y": 0.0, "z": -20.5 }` (narożnik NW za północną komorą próżniową)<br>• `HS-10`: `{ "x": -36.5, "y": 0.0, "z": -11.0 }` (za stołem z oscyloskopami przy ścianie zachodniej)<br>• `HS-11`: `{ "x": -36.5, "y": 0.0, "z": -2.0 }` (narożnik SW za południową aparaturą próżniową)<br>• `HS-12`: `{ "x": -23.5, "y": 0.0, "z": -20.5 }` (narożnik NE za szafą sterowników wiązki) |
| **R7 — Serwerownia Diagnostyczna** | `0.00 m` | 1 (`C7`) | **4** | • `HS-13`: `{ "x": 36.5, "y": 0.0, "z": -20.5 }` (narożnik NE za agregatem chłodzenia cieczowego)<br>• `HS-14`: `{ "x": 36.5, "y": 0.0, "z": -11.0 }` (wnęka wschodnia za środkowym rzędem szaf kwantowych)<br>• `HS-15`: `{ "x": 36.5, "y": 0.0, "z": -5.5 }` (narożnik SE przy ścianie działowej z Halą Turbin)<br>• `HS-16`: `{ "x": 23.5, "y": 0.0, "z": -20.5 }` (narożnik NW za konsolą diagnostyczną) |
| **R8 — Biuro Kierownika Naukowego** | `+4.80 m` | 1 (`C8`) | **4** | • `HS-17`: `{ "x": 14.0, "y": 4.8, "z": -31.2 }` (bezpośrednio za masywnym korpusem biurka `fus_director_desk`)<br>• `HS-18`: `{ "x": 20.5, "y": 4.8, "z": -34.5 }` (narożnik NE za regałem archiwalnym `fus_director_bookcase`)<br>• `HS-19`: `{ "x": 8.0, "y": 4.8, "z": -34.5 }` (narożnik NW za szafą pancerną z dokumentami)<br>• `HS-20`: `{ "x": 20.5, "y": 4.8, "z": -23.5 }` (narożnik SE za sofą gabinetową i donicą) |

---

## 6. Katalog zasobów: 30 nowych modeli `fus_*`, 22 tekstury i 12 Easter Eggów

### 6.1. Nowe modele 3D (`tools/blender/sets/kurogane_fusion.py` → `public/assets/models/city/fus_*.glb`)

Zestaw obejmuje **30 własnych modeli proceduralnych** w Blenderze z prefiksem **`fus_`**, z czego **15 modeli buduje i zagęszcza samą Główną Halę Reaktora `R2`** (pomosty, barierki, kasetony stropowe, magistrale kablowe, łuki rur chłodziwa, panele ekranujące, kriopompy, banki kondensatorów, konsole diagnostyczne, transformatory impulsowe, skrzynie rozdzielcze), a kolejne **15 modeli** wyposaża 7 pomieszczeń specjalistycznych (`R1`, `R3`..`R8`). Wszystkie modele stosują rygory z `docs/assets.md`:
- Jednostki: metry, układ glTF Y-up, przód w `+Z`, spód na `Y = 0` (dla modeli sufitowych wieszaki sięgają górnego AABB do styku `ceilingContact` w `mapAudit.ts`).
- Cieniowanie płaskie (flat low-poly) z fazowanymi krawędziami, jedna scalona siatka na materiał (`_city_merge_details`), brak wbudowanych obrazów w GLB.
- **Rygor materiałów:** duże białe powierzchnie świecące używają wyłącznie **`mat_light_panel`** (`#fff1d6` bez selektywnego bloomu). Szyby obserwacyjne i komory próżniowe używają **`mat_glass_clear`** (`opacity: 0.22`, dwustronny). Zero kolorów zakazanych (`czerwień`, `cyan`, `magenta`).

#### Tabela 1: Modele Głównej Hali Reaktora (`R2`) — konstrukcja pomostów, barierki, kasetony, rury, kable i osłony wokół Tokamaka — 15 modeli (`fus_01`..`fus_15`)

| Lp. | Model (`.glb`) | Wymiary AABB `X × Y × Z` [m] | Gdzie stoi (pomieszczenia) | Czy jest osłoną / kolizja | Opis geometrii, sylwetki i materiałów (`mat_*`) | Budżet tri |
|---:|---|---|---|---|---|---:|
| 1 | `fus_catwalk_deck` | `4.00 × 0.40 × 4.00` | `R2` (Galerie `G1` na `y = +4.80 m` i `G2` na `y = +9.60 m`) | **Moduł pomostu (`walkable: true`)** — wizualny detal podestu z kratownicą i belkami wsporczymi | **Stalowy pomost galerii reaktora:** ciężka rama z dwuteowników (`mat_metal`, `mat_lacquer`), ażurowa blacha kratowa na górze, boczny krawężnik BHP w bursztynie (`mat_hazard`) i dolna listwa podświetlająca **`mat_light_panel`**. | ≤ 360 |
| 2 | `fus_catwalk_railing` | `4.00 × 1.10 × 0.18` | `R2` (krawędzie Galerii `G1` i `G2` oraz biegów ramp #1–#6) | **Niska osłona krawędzi (`wys. 1.10 m`)** — `blok` (`size: 4.0 × 1.1 × 0.18 m`, `instance: true`) | **Przemysłowa barierka galerii z listwą LED:** pochyłe słupki ze stali Kurogane (`mat_metal`), dolny odbojnik z taśmą ostrzegawczą (`mat_hivis`), przezroczysty panel dolny `mat_glass_clear` i górna poręcz z wpuszczonym bursztynowym światłem `mat_neon_amber`. | ≤ 280 |
| 3 | `fus_ceiling_coffer_bay` | `6.00 × 0.65 × 6.00` | Wszystkie 8 pomieszczeń (`R1`..`R8`, pod stropami `ceiling: true`) | **Kaseton stropowy** (`decor` `CEILING_FIXTURES`, brak blokowania ruchu) | **Industrialny kaseton sufitowy zapobiegający czarnym stropom w FPP:** głęboko profilowana rama z żebrowanego betonu i stali (`mat_concrete`, `mat_metal`) z kratownicą akustyczną i czterema symetrycznymi panelami świetlnymi **`mat_light_panel`** oraz akcentem `mat_neon_amber`. | ≤ 420 |
| 4 | `fus_blast_door_frame` | `4.00 × 3.80 × 0.36` | Wszystkie portale między `R1`..`R8` | **Portal przejściowy** (`decor` `WALL_FIXTURES`, `PASSAGE_FIXTURES` + 2 boczne kolidery ościeży poza światłem przejścia `3.0–3.2 m`) | **Pancerny portal grodziowy elektrowni fuzyjnej (otwarty):** fazowane ościeża z tytanu i betonu (`mat_metal`, `mat_lacquer`), rozsunięte na boki skrzydła grodzi z żółto-bursztynowymi ryglownicami (`mat_hivis`) i górny wyświetlacz ciśnienia (`mat_neon_green`). | ≤ 480 |
| 5 | `fus_shield_wall_panel` | `4.00 × 4.80 × 0.35` | `R2` (ściany Hali Reaktora), `R4`, `R5`, `R6` | **Moduł okładziny ściennej** (`decor` `WALL_FIXTURES` przy ścianach nośnych) | **Płyta ekranowania magnetycznego hali reaktora:** geometrycznie fazowane płyty stalowo-ołowiowe (`mat_metal`, `mat_machine`) z pionowymi kanałami chłodzącymi i szczelinami kontrolnymi `mat_neon_amber`. | ≤ 320 |
| 6 | `fus_coolant_pipe_arch` | `1.60 × 4.40 × 4.80` | `R2` (4 magistrale łączące kriopompy z cokołem Tokamaka) | **Brama rurowa z pełnym prześwitem** (`2 boczne kolidery kolumn 1.6 × 3.4 × 0.8 m` + górny łącznik na `y = 3.4..4.4 m` — prześwit `3.4 m ≥ 2.2 m`!) | **Wysoki łuk rurociągu ciekłego helu:** dwie izolowane termicznie kolumny rurowe z manometrami i mufami zaciskowymi (`mat_metal`, `mat_lacquer`, obręcze `mat_neon_blue` `#3d7bff`) przechodzące górą nad ścieżką wokół reaktora. | ≤ 640 |
| 7 | `fus_wall_pipe_manifold` | `4.00 × 3.60 × 0.55` | `R2` (ściany Hali Reaktora), `R5` (Magazyn Paliwa), `R6` (Hala Turbin) | **Instalacja ścienna** (`decor` `WALL_FIXTURES` + niski cokół odbojnika) | **Ścienny kolektor rur wysokiego ciśnienia:** potrójna wiązka grubych rur parowych i chłodziwa (`mat_metal`, `mat_paint`), koła zaworów odcinających (`mat_hivis` w bursztynie) i cyfrowe przepływomierze (`mat_neon_green`). | ≤ 580 |
| 8 | `fus_wall_power_busbar` | `4.00 × 4.20 × 0.45` | `R2` (ściany Hali Reaktora), `R7` (Serwerownia) | **Instalacja ścienna** (`decor` `WALL_FIXTURES`) | **Szynoprzewód wielkoprądowy cewek tokamaka:** miedziano-grafitowe szyny prądowe w osłonach z przezroczystego poliwęglanu (`mat_glass_clear`, `mat_cable`, `mat_hivis`) z pulsującymi wskaźnikami obciążenia `mat_neon_amber` i `mat_neon_violet`. | ≤ 520 |
| 9 | `fus_overhead_cable_tray` | `6.00 × 0.85 × 1.20` | `R2` (pod Galerią `G1` i `G2`), `R4`, `R7` | **Koryto kablowe podstropowe** (`decor` `CEILING_FIXTURES`, brak kolizji) | **Podwieszane koryto kablowe ciężkiej energetyki:** stalowa drabinka z grubymi wiązkami przewodów nadprzewodnikowych (`mat_cable`, `mat_metal`) i znacznikami obwodów `mat_neon_blue`. | ≤ 340 |
| 10 | `fus_highbay_light_strip` | `4.00 × 0.35 × 0.65` | `R2`, `R5`, `R6` (oprawy przemysłowe) | **Oprawa sufitowa** (`decor` `CEILING_FIXTURES`, brak kolizji) | **Przemysłowa oprawa LED wysokiego składowania:** pancerna obudowa z radiatorami (`mat_metal`, `mat_lacquer`) i szerokim dyfuzorem **`mat_light_panel`** (zero smug bloomu!). | ≤ 240 |
| 11 | `fus_cryopump_unit` | `2.80 × 2.60 × 1.80` | `R2` (4 szt. w pierścieniu wokół Tokamaka), `R5` | **Twarda wysoka osłona (`wys. 2.60 m`)** — `blok` (`size: 2.8 × 2.6 × 1.8 m`, `instance: true`) | **Agregat kriopompy próżniowej ciekłego helu:** dwa oszronione cylindry kriogeniczne w stalowej ramie ochronnej (`mat_metal`, `mat_machine`, `mat_lacquer`), wzierniki poziomu chłodziwa w błękicie królewskim (`mat_neon_blue` `#3d7bff`) i pulpit lokalny `mat_screen_status`. | ≤ 880 |
| 12 | `fus_capacitor_bank` | `3.60 × 2.80 × 1.60` | `R2` (4 szt. przy ścianach Hali Reaktora, w tym przy Hazardzie #1) | **Pełna wysoka osłona (`wys. 2.80 m`)** — `blok` (`size: 3.6 × 2.8 × 1.6 m`, `instance: true`) | **Bank kondensatorów rozruchu plazmy (`15 GJ`):** stalowa klatka z rzędami wysokonapięciowych cylindrów dielektrycznych i izolatorów ceramicznych (`mat_machine`, `mat_metal`, `mat_hivis`), podświetlona fioletem (`mat_neon_violet`) i bursztynem (`mat_neon_amber`). | ≤ 920 |
| 13 | `fus_pulse_transformer` | `2.40 × 2.20 × 2.00` | `R2` (narożniki SW i SE Hali Reaktora), `R6` | **Twarda wysoka osłona (`wys. 2.20 m`)** — `blok` (`size: 2.4 × 2.2 × 2.0 m`, `instance: true`) | **Transformator impulsowy zasilania cewek:** użebrowany korpus olejowo-gazowy (`mat_machine`, `mat_paint` `#3d5968`), górne przepusty izolatorowe i tablica ostrzegawcza wysokiego napięcia (`mat_hazard`, `mat_neon_amber`). | ≤ 740 |
| 14 | `fus_diagnostic_console` | `2.60 × 1.25 × 1.10` | `R2` (4 pulpity wokół Tokamaka + na Galerii `G1`), `R4`, `R7` | **Średnia osłona (`wys. 1.25 m`, do kucnięcia i przeskoku)** — `blok` (`size: 2.6 × 1.25 × 1.1 m`, `instance: true`) | **Polowy pulpit diagnostyki magnetycznej:** pochylony korpus ze stali i niebiesko-grafitowego kompozytu (`mat_metal`, `mat_plastic` `#4c5f7d`), dwa ekrany telemetrii (`mat_screen_fus_tokamak`), podświetlana klawiatura (`mat_light_panel`, `mat_neon_amber`) i uchwyt na kubek. | ≤ 620 |
| 15 | `fus_junction_box` | `1.60 × 1.15 × 0.85` | `R2` (osłony na pomostach Galerii `G1` i `G2`), `R5`, `R6` | **Średnia osłona na galeriach (`wys. 1.15 m`)** — `blok` (`size: 1.6 × 1.15 × 0.85 m`, `instance: true`) | **Pancerna skrzynia rozdzielcza i szafa zaworów:** grafitowo-bursztynowa obudowa przemysłowa (`mat_machine`, `mat_hivis`) z dźwignią awaryjnego zrzutu pola i lampkami kontrolnymi `mat_neon_green` / `mat_neon_amber`. | ≤ 380 |

#### Tabela 2: Modele 7 pomieszczeń specjalistycznych (`R1` Szatnia-Dekontaminacja, `R3` Sterownia Główna, `R4` Lab Plazmy, `R5` Magazyn Paliwa, `R6` Hala Turbin, `R7` Serwerownia, `R8` Biuro Kierownika) — 15 modeli (`fus_16`..`fus_30`)

| Lp. | Model (`.glb`) | Wymiary AABB `X × Y × Z` [m] | Gdzie stoi (pomieszczenia) | Czy jest osłoną / kolizja | Opis geometrii, sylwetki i materiałów (`mat_*`) | Budżet tri |
|---:|---|---|---|---|---|---:|
| 16 | `fus_control_window_wall` | `5.00 × 4.40 × 0.40` | `R3` (Sterownia Główna — 3 moduły = 15 m okna na Tokamak), `R8` (Biuro Kierownika), `R4`, `R7` | **Ściana z szybą obserwacyjną** (`decor` `WALL_FIXTURES` + dolny kolider murku `5.0 × 1.05 × 0.36 m` i górna tafla `mat_glass_clear`) | **Pancerna witryna obserwacyjna sterowni reaktora:** dolny parapet z płyt ekranujących i czarnego kompozytu (`wys. 1.05 m`, `mat_metal`, `mat_lacquer`, listwa `mat_neon_amber`), lekko pochylone słupki przeciwodblaskowe i wielka tafla przezroczystego szkła ołowiowego `mat_glass_clear`. | ≤ 440 |
| 17 | `fus_main_control_desk` | `3.80 × 1.25 × 1.40` | `R3` (Sterownia Główna — 4 szt. w 2 rzędach przed oknem na reaktor) | **Twarda średnia osłona (`wys. 1.25 m`)** — `blok` (`size: 3.8 × 1.25 × 1.4 m`, `instance: true`) | **Główny stół operatorski mostka „Helios-IV” z fotelami:** zakrzywiony korpus z ciemnej stali i kompozytu (`mat_lacquer`, `mat_metal`), 4 monitory panoramiczne (`mat_screen_fus_tokamak`, `mat_screen_fus_grid`), przepustnice mocy cewek, podświetlenie dolne `mat_light_panel` oraz 2 wsunięte fotele z obiciem w kolorze motywu (`mat_fabric` `#4a566e`). | ≤ 960 |
| 18 | `fus_telemetry_screen_wall` | `4.80 × 2.60 × 0.28` | `R3` (Sterownia Główna — ściana północna), `R7` (Serwerownia) | **Ściana wideo** (`decor` `WALL_FIXTURES`, montowana na `y = levelY + 1.1 m`) | **Wielkoformatowa tablica synoptyczna i ściana monitorów reaktora:** stelaż z 6 ekranami przekroju plazmy, bilansu mocy `14,8 GW` i stanu cewek (`mat_screen_fus_tokamak`, `mat_screen_fus_grid`, obramowanie `mat_neon_blue` i `mat_neon_amber`). | ≤ 460 |
| 19 | `fus_neutral_beam_injector` | `4.80 × 1.85 × 1.60` | `R4` (Laboratorium Fizyki Plazmy — 2 szt. w centrum) | **Główna twarda osłona w laboratorium (`wys. 1.85 m`)** — `blok` (`size: 4.8 × 1.85 × 1.6 m`, `instance: true`) | **Inżektor wiązki neutralnej i akcelerator jonów:** pozioma komora cylindryczna na ciężkiej ławie optycznej (`mat_machine`, `mat_metal`), pierścienie cewek ogniskujących (`mat_hivis`) i okna wziernikowe z fioletowo-białą poświatą wiązki (`mat_glass_clear`, `mat_neon_violet`, `mat_light_panel`). | ≤ 980 |
| 20 | `fus_plasma_test_chamber` | `2.40 × 2.30 × 1.40` | `R4` (Laboratorium Plazmy — 2 szt.), `R8` (Biuro Kierownika — prototyp) | **Wysoka osłona (`wys. 2.30 m`)** — `blok` (`size: 2.4 × 2.3 × 1.4 m`, `instance: true`) | **Stanowisko próżniowej pułapki magnetycznej (Mini-Tokamak):** pionowy klosz z grubego szkła `mat_glass_clear` w stalowej klatce pomiarowej, wewnątrz miniaturowe pierścienie cewek i świecąca w fiolecie oraz bursztynie kula plazmy (`mat_neon_violet`, `mat_neon_amber`). | ≤ 860 |
| 21 | `fus_whiteboard_equations` | `3.20 × 1.75 × 0.18` | `R4` (Laboratorium Plazmy), `R8` (Biuro Kierownika Naukowego — tablica Rezonansu) | **Tablica ścienna** (`decor` `WALL_FIXTURES`, montowana na `y = levelY + 1.05 m`) | **Podświetlana tablica naukowa z wykresami plazmy i notatkami:** aluminiowo-grafitowa rama (`mat_metal`, górna listwa `mat_light_panel`), tafla ze schematami stabilności MHD, równaniami fuzji D-T i przypiętymi raportami w bursztynie i zieleni (zero czerwieni!). | ≤ 340 |
| 22 | `fus_tritium_cask_pallet` | `2.20 × 1.45 × 2.20` | `R5` (Magazyn Paliwa — 4 szt.), `R2` (strefa załadunku SW) | **Twarda osłona (`wys. 1.45 m`)** — `blok` (`size: 2.2 × 1.45 × 2.2 m`, `instance: true`) | **Paleta 4 pancernych beczek izotopowych Deuter / Tryt:** stalowa paleta transportowa do suwnicy (`mat_metal`, `mat_hazard`), na niej cztery żebrowane pojemniki radiacyjne z ołowiowo-tytanowymi pokrywami, zielono-bursztynowymi pierścieniami trytu (`mat_neon_green`, `mat_neon_amber`) i nadrukiem `mat_label_tritium_cask`. | ≤ 840 |
| 23 | `fus_deuterium_cryo_tank` | `2.80 × 3.60 × 2.80` | `R5` (Magazyn Paliwa — 2 szt.) | **Pełna wysoka osłona (`wys. 3.60 m`)** — `blok` (`size: 2.8 × 3.6 × 2.8 m`, `instance: true`) | **Kulisty zbiornik kriogeniczny ciekłego deuteru (`D₂`):** wielka sfera ze szczotkowanej stali i białego lakieru technicznego (`mat_metal`, `mat_paint`) osadzona na czterech podporach z drabiną serwisową, zaworami bezpieczeństwa i błękitnymi wskaźnikami temperatury `20 K` (`mat_neon_blue`). | ≤ 940 |
| 24 | `fus_fuel_gantry_crane` | `14.00 × 1.40 × 3.20` | `R5` (Magazyn Paliwa — pod stropem na `y = +5.80 m`) | **Suwnica podstropowa** (`decor` `CEILING_FIXTURES`, brak kolizji na poziomie podłogi) | **Suwnica bramowa magazynu paliwa fuzyjnego:** dwudźwigarowy most w żółto-bursztynowym malowaniu Kurogane (`mat_hivis`, `mat_metal`, `mat_hazard`) z wciągnikiem łańcuchowym, chwytnikiem do beczek trytu i lampami roboczymi `mat_light_panel`. | ≤ 780 |
| 25 | `fus_steam_turbine_generator` | `3.80 × 2.80 × 7.20` | `R6` (Hala Turbin i Wymienników Ciepła — 2 szt. w centrum) | **Monumentalna osłona główna w Hali Turbin (`wys. 2.80 m`)** — `blok` (`size: 3.8 × 2.8 × 7.2 m`, `instance: true`) | **Wysokociśnieniowy turbozespół parowo-MHD (`7,4 GW`):** stopniowany cylinder turbiny połączony wałem ze stojanem generatora (`mat_machine`, `mat_metal`, `mat_lacquer`), rury obejściowe pary, pomosty boczne i bursztynowe okna wziernikowe wirnika (`mat_neon_amber`, `mat_light_panel`). | ≤ 1180 |
| 26 | `fus_heat_exchanger_tower` | `2.40 × 4.60 × 2.40` | `R6` (Hala Turbin — 3 szt. przy ścianie wschodniej) | **Pełna wysoka osłona (`wys. 4.60 m`)** — `blok` (`size: 2.4 × 4.6 × 2.4 m`, `instance: true`) | **Pionowy wymiennik ciepła obiegu litowo-parowego:** wysoka kolumna ciśnieniowa z kołnierzami śrubowymi (`mat_machine`, `mat_metal`), kolektorami wlotowymi i świecącymi w bursztynie paskami czujników termicznych (`mat_neon_amber`). | ≤ 760 |
| 27 | `fus_quantum_server_rack` | `2.80 × 2.40 × 1.10` | `R7` (Serwerownia Diagnostyczna — 6 szt. w 3 rzędach), `R3` | **Pełna wysoka osłona (`wys. 2.40 m`)** — `blok` (`size: 2.8 × 2.4 × 1.1 m`, `instance: true`) | **Podwójna szafa superkomputera kontroli pola magnetycznego (Orbis Grid × Kurogane):** przeszklone fronty `mat_glass_clear` w grafitowej ramie (`mat_lacquer`, `mat_metal`), wewnątrz rzędy modułów obliczeniowych i rurek chłodzenia cieczowego świecących w błękicie królewskim (`mat_neon_blue`) i zieleni (`mat_neon_green`). | ≤ 720 |
| 28 | `fus_decon_shower_arch` | `3.40 × 2.80 × 1.60` | `R1` (Szatnia i Śluza Dekontaminacyjna — 2 szt. na osi wejścia) | **Portal dekontaminacyjny** (`decor` `PASSAGE_FIXTURES` + 2 boczne kolidery ścianek `0.45 × 2.8 × 1.6 m` poza prześwitem `2.5 m`) | **Komora natrysku dekontaminacyjnego i bramka dozymetryczna:** stalowo-szklany tunel (`mat_metal`, `mat_glass_clear`) z dyszami mgły dekontaminacyjnej, zielonym łukiem statusu `CZYSTY` (`mat_neon_green`) i bursztynowym skanerem izotopów (`mat_neon_amber`). | ≤ 620 |
| 29 | `fus_suit_locker_bank` | `3.20 × 2.30 × 0.80` | `R1` (Szatnia i Śluza Dekontaminacyjna — 4 szt.) | **Wysoka osłona przyścienna (`wys. 2.30 m`)** — `blok` (`size: 3.2 × 2.3 × 0.8 m`, `instance: true`, również w `WALL_FIXTURES`) | **Szafa z kombinezonami radiacyjnymi i aparatami tlenowymi:** cztery przeszklone boksy (`mat_metal`, `mat_glass_clear`) podświetlone od góry `mat_light_panel`, wewnątrz wiszące żółto-bursztynowe kombinezony ochronne (`mat_hivis` `#d08a1c`, `mat_fabric`) i hełmy z wizjerami. | ≤ 760 |
| 30 | `fus_director_desk` | `2.80 × 1.15 × 1.30` | `R8` (Biuro Kierownika Naukowego — centrum) | **Twarda średnia osłona (`wys. 1.15 m`)** — `blok` (`size: 2.8 × 1.15 × 1.3 m`) | **Biurko Kierownika Naukowego dr. Haruto Moriego:** reprezentacyjny stół z ciemnej stali, szczotkowanego tytanu i kompozytu (`mat_lacquer`, `mat_metal`, listwa `mat_neon_amber`), na blacie miniaturowy model pierścieni tokamaka (`mat_neon_violet`), potrójny terminal badawczy (`mat_screen_fus_tokamak`), rozłożone raporty i kubek dyrektora (`mat_label_fusion_director_mug`). | ≤ 880 |

*(Uwaga: mniejsze elementy pomocnicze — takie jak ławki w szatni `fus_decon_bench`, stacje dozymetryczne `fus_wall_dosimeter_station`, stoły z oscyloskopami `fus_lab_bench_oscilloscope`, agregaty chłodzenia serwerów `fus_server_cooling_unit` oraz regały w biurze `fus_director_bookcase` — są zintegrowane jako pod-zespoły powyższych 30 modeli lub złożone z bloków z materiałami `fus_*` oraz reużytych modeli `lab_*` / `off_*`, dzięki czemu zestaw `kurogane_fusion.py` liczy dokładnie **30 modeli `fus_*.glb`**!)*

### 6.2. Katalog 22 tekstur (`signs/`, `screens/`, `decals/`, `labels/`, `surfaces/`)

Wszystkie **22 tekstury** są w języku polskim i przechodzą automatyczny walidator palety HSV (zero pikseli w zakazanych pasmach czerwieni `358.4° ± 13°`, cyanu `186.1° ± 13°` i magenty `311.6° ± 13°` przy `S >= 0.55, V >= 0.5`):

| Nr | Kategoria / Plik (`.webp`) | Rozmiar | Gdzie występuje | Opis treści, kolorystyki i roli (Szyld / Ekran / Dekal / Etykieta / Powierzchnia) |
|---:|---|---|---|---|
| 1 | `signs/fus_helios_reactor_hall.webp` | `512×256` RGB | `R1`/`R2` (nad Portalem Głównym do Hali Reaktora) | Szyld główny: **`TOKAMAK HELIOS-IV // GŁÓWNA KOMORA REAKTORA (POLE 16 T)`** w bursztynie `#ffae1a` i ciepłej bieli `#fff1d6`. |
| 2 | `signs/fus_main_control_room.webp` | `512×256` RGB | `R3` Sterownia Główna (nad portalami z Galerii `G1-N`) | Szyld: **`STEROWNIA GŁÓWNA // MOSTEK KONTROLI PLAZMY`** (`#3d7bff` / `#fff1d6`). |
| 3 | `signs/fus_plasma_lab.webp` | `512×256` RGB | `R4` Laboratorium Fizyki Plazmy | Szyld: **`LABORATORIUM PLAZMY & INŻEKTORÓW WIĄZKI`** (`#8a5cff` / `#3d7bff`). |
| 4 | `signs/fus_fuel_storage_dt.webp` | `512×256` RGB | `R5` Magazyn Paliwa Fuzyjnego | Szyld ostrzegawczy: **`SKŁAD IZOTOPÓW: DEUTER (D₂) / TRYT (T₂) — STREFA SUWNICY`** (`#ffae1a` / `#6dff4a`). |
| 5 | `signs/fus_turbine_exchanger_hall.webp` | `512×256` RGB | `R6` Hala Turbin i Wymienników Ciepła | Szyld: **`HALA TURBIN MHD & WYMIENNIKÓW CIEPŁA (7,4 GW)`** (`#ffae1a` / `#fff1d6`). |
| 6 | `signs/fus_quantum_diagnostics.webp` | `512×256` RGB | `R7` Serwerownia Diagnostyczna i `R8` Biuro Kierownika | Szyld: **`DIAGNOSTYKA KWANTOWA CEWKI // GABINET DR. H. MORI`** (`#3d7bff` / `#6dff4a`). |
| 7 | `screens/screen_fus_tokamak.webp` | `512×512` RGB | `R2`, `R3`, `R8` (konsole diagnostyczne i sterownia) | Przekrój poloidalny torusa plazmy: **`TEMP. RDZENIA: 118 MLN K // STABILNOŚĆ MAGNETYCZNA: 99,4%`** w bursztynie `#ffae1a`, fiolecie `#8a5cff` i bieli `#fff1d6`. |
| 8 | `screens/screen_fus_grid.webp` | `512×512` RGB | `R3`, `R6`, `R7` (ściana telemetrii i serwery) | Bilans sieci energetycznej Neo-Ryd: **`MOC WYJŚCIOWA: 14,8 GW // PRIORYTET: SEKTOR X-51 & KUROGANE TOWER`** (`#6dff4a` / `#3d7bff`). |
| 9 | `screens/screen_fus_tritium.webp` | `512×512` RGB | `R1`, `R5` (skanery dozymetryczne i magazyn paliwa) | Panel izotopowy: **`CIŚNIENIE CRYO D-T: 14,2 BAR // DOZYMETRIA: W NORMIE`** (`#6dff4a` / `#ffae1a`). |
| 10 | `screens/screen_fus_iskra_alert.webp` | `512×512` RGB | `R7` Serwerownia i `R8` Biuro Kierownika | Alarm bezpieczeństwa sieci: **`ALERT ORBIS GRID: NIEAUTORYZOWANY ODCZYT SCHEMATÓW CEWKI Z WĘZŁA ‘METRO KAMIENNA’ (HAKER: BAJT)`** (`#ffae1a` / `#8a5cff`). |
| 11 | `decals/fus_director_resonance_board.webp` | `1024×512` RGBA | `R8` Biuro Kierownika Naukowego (`fus_whiteboard_equations`) | **Główna tablica fabularna dr. Moriego (EE-08, EE-09, EE-11):** schemat przesyłu impulsu `14,8 GJ` z Tokamaka Helios-IV do sztucznych rdzeni **Rezonansu**, mapa poboru mocy wokół **stacji metra Kamienna (kryjówki „Iskry”)**, profil sygnatury **„Kuriera”** i notatki o **Doktor Wolan i Mirze** (bursztynowe i zielone linie, zero czerwieni!). |
| 12 | `decals/fus_ee_run1_run2_logistics.webp` | `512×512` RGBA | `R5` Magazyn Paliwa i `R6` Hala Turbin | **Easter Egg #1 i #2 (`run1` Magazyn + `run2` Atrium Nova):** dokument dostawy cewek z **Magazynu K-09 (`run1`)** z dopiskiem o zniszczonych wózkach widłowych oraz raport o wyłączeniu klimatyzacji w **Galerii Atrium Nova (`run2`)** podczas testu zapłonu plazmy. |
| 13 | `decals/fus_ee_run3_run4_directives.webp` | `512×512` RGBA | `R4` Lab Plazmy i `R8` Biuro Kierownika | **Easter Egg #3 i #4 (`run3` Sektor X-51 + `run4` Wieżowiec Piętro 62):** pismo z **Tajnego Laboratorium X-51 (`run3`)** o poborze mocy dla Komory Kokonów nr 04 oraz ponaglenie z **62. piętra Kurogane Tower (`run4`)** podpisane po wybiciu szyby w gabinecie zarządu. |
| 14 | `decals/fus_ee_run5_run6_coalition.webp` | `512×512` RGBA | `R1` Szatnia-Dekontaminacja i `R5` Magazyn Paliwa | **Easter Egg #5 i #6 (`run5` Klinika Helixa + `run6` Nocny Targ):** skierowanie dla personelu reaktora na kalibrację słuchu w **Przychodni Helixa na 61. piętrze (`run5`, projekt „Akord”)** oraz protokół konfiskaty przemycanego Helu-3 i zupy rybnej z **Nocnego Targu pod estakadą (`run6`)**. |
| 15 | `decals/fus_ee_run7_vane_memo.webp` | `512×512` RGBA | `R8` Biuro Kierownika (`na biurku fus_director_desk`) | **Easter Egg #7 (`run7` Rezydencja Pułkownika Vane'a „Willa Kuroyama”):** osobisty rozkaz **Pułkownika Kenjiego Vane'a** wysłany z leśnej **Willi Kuroyama (`run7`)**: *„Dr Mori! Po tym, jak Kurier wdarł się do mojego biura w lesie i zabrał akta znad winiarni, podwajam ochronę Tokamaka. Jeśli stracicie reaktor, osobiście zaproszę Pana na dolny przystanek mojej windy!”*. |
| 16 | `decals/fus_floor_magnetic_hazard.webp` | `512×512` RGBA | `R2` Hala Reaktora, `R4`, `R5` (oznakowanie posadzki) | Bursztynowo-białe pasy i piktogram: **`STREFA SILNEGO POLA MAGNETYCZNEGO 16 T — ZAKAZ WNOSZENIA NIEZABEZPIECZONYCH IMPLANTÓW`**. |
| 17 | `decals/fus_dielectric_floor_mat.webp` | `512×512` RGBA | `R3` Sterownia Główna, `R8` Biuro Kierownika (płaski `decal` podłogowy!) | Grafitowo-bursztynowa mata dielektryczna / dywan gabinetowy realizowany jako `decal` (`surface: "floor"`), dzięki czemu **żaden spawn nie koliduje z blokiem dywanu**! |
| 18 | `labels/label_tritium_cask.webp` | `256×256` RGBA | `R5` Beczki paliwa `fus_tritium_cask_pallet` oraz `R8` kubek `fus_director_desk` | Nadruk UV: **`KUROGANE FUSION // IZOTOP TRYTU T-3 (CHŁODZIĆ PONIŻEJ 20 K) // KUBEK DR. MORI: FUZYJNA KAWA 100 MLN STOPNI`**. |
| 19–22 | `surfaces/fus_reactor_floor.webp`, `fus_reactor_concrete.webp`, `fus_shield_panel.webp`, `fus_control_tile.webp` (+ 4 `komiks_fus_*.webp`) | `1024×1024` RGB (×8 plików) | Posadzki, ściany i kasetony całej elektrowni | 4 tekstury kafelkowalne opisane w **F-04** (`§2.1.B`). |

### 6.3. Zestawienie 12 Easter Eggów (`EE-01`..`EE-12`) — spójne uniwersum `run1`–`run7`, „Iskry” i `docs/gdd.md`

| Nr | Nazwa Easter Egga | Lokalizacja na mapie `run8` (współrzędne i wysokość) | Tekstura / Model | Nawiązanie fabularne (`run1`–`run7`, Iskra, bohater, GDD) |
|---:|---|---|---|---|
| **EE-01** | **Manifest z Magazynu K-09 (`run1`)** | `R5` Magazyn Paliwa (`X = -30.0, Y = 1.55, Z = +21.95`, `0.05 m` od ściany S) | `decals/fus_ee_run1_run2_logistics.webp` | Odwołanie do **Magazynu Kurogane Arms (`run1`)**: protokół odbioru cewek nadprzewodnikowych z dopiskiem logistyka: *„Opóźnienie 48h — niejaki Kurier porozrzucał Rezonansem skrzynie po całej hali K-09 i uszkodził suwnicę”*. |
| **EE-02** | **Blackout w Galerii „Atrium Nova” (`run2`)** | `R6` Hala Turbin (`X = +37.95, Y = 1.60, Z = +14.0`, `0.05 m` od ściany E) | `decals/fus_ee_run1_run2_logistics.webp` | Odwołanie do **Galerii Handlowej „Atrium Nova” (`run2`)**: wykres zrzutu obciążenia z adnotacją: *„Przekierowano 400 MW z pasaży Atrium Nova na rozruch Tokamaka. Właściciele butików Aurea & Verve skarżą się, że w ciemności ktoś zdemolował im sklepy za kratami”*. |
| **EE-03** | **Zasilanie Komory Kokonów X-51 (`run3`)** | `R4` Laboratorium Plazmy (`X = -37.95, Y = 1.65, Z = -15.0`, `0.05 m` od ściany W) | `decals/fus_ee_run3_run4_directives.webp` | Odwołanie do **Tajnego Laboratorium „Sektor X-51” (`run3`)**: pilny telegram od szefa Projektu Chimera: *„Utrzymać rezerwę 2,4 GW dla podziemnej Sali Testów Humanoidalnych X-51! Obiekt ze Zbiornika nr 04 wybił szybę pancerną i zbiegł szybem wentylacyjnym”*. |
| **EE-04** | **Ponaglenie z 62. Piętra Kurogane Tower (`run4`)** | `R8` Biuro Kierownika Naukowego (`X = +12.5, Y = 5.96, Z = -29.0`, na biurku `fus_director_desk`) | `decals/fus_ee_run3_run4_directives.webp` | Odwołanie do **Wieżowca Korporacyjnego Kurogane Arms — Piętra 60–62 (`run4`)**: okólnik Zarządu: *„Po incydencie na Piętrze 62 i zniszczeniu przeszklonego gabinetu Prezesa wszystkie narady przenosimy pod ziemię do kompleksu Helios-IV”*. |
| **EE-05** | **Kalibracja „Akordu” w Klinice Helixa (`run5`)** | `R1` Szatnia-Dekontaminacja (`X = -11.95, Y = 1.60, Z = +29.0`, `0.05 m` od ściany W) | `decals/fus_ee_run5_run6_coalition.webp` | Odwołanie do **Przychodni Helixa Dynamics na 61. piętrze (`run5`)**: ogłoszenie BHP dla fizyków: *„Pracownicy z szumami usznymi po impulsach 16 Tesli kierowani są na bezpłatną kalibrację w Zakładzie Akordu (Wieża Bulwaru, p. 61). Uwaga: oddział regeneracji chwilowo zamknięty z powodu kwarantanny”*. |
| **EE-06** | **Kontrabanda Helu-3 z Nocnego Targu (`run6`)** | `R5` Magazyn Paliwa (`X = -37.95, Y = 1.55, Z = +6.0`, `0.05 m` od ściany W) | `decals/fus_ee_run5_run6_coalition.webp` | Odwołanie do **Nocnego Targu pod estakadą (`run6`)**: kwit depozytowy straży: *„Zarekwirowano podczas obławy pod estakadą Bulwaru: 3 butle Helu-3 z Pasażu Części, 1 fotel z gabinetu ‘Bez Pytań’ oraz 4 termosy gorącej zupy rybnej z delty (zjedzone przez zmianę nocną)”*. |
| **EE-07** | **Rozkaz Pułkownika Vane'a z Willi Kuroyama (`run7`)** | `R8` Biuro Kierownika Naukowego (`X = +15.2, Y = 5.96, Z = -28.8`, na biurku dr. Moriego) | `decals/fus_ee_run7_vane_memo.webp` | Bezpośrednie odwołanie do **Rezydencji Pułkownika Kurogane Arms „Willa Kuroyama” (`run7`)**: zaszyfrowany komunikat od **Pułkownika Kenjiego Vane'a**, w którym wściekły dowódca Egzekutorów ostrzega dr. Moriego po rajdzie gracza na jego leśną rezydencję, Salę Przesłuchań i Winiarnię. |
| **EE-08** | **Analiza sygnatury „Kuriera” i Ostrza Plazmowego** | `R8` Biuro Kierownika Naukowego (`X = +21.95, Y = 6.20, Z = -28.0`, `0.05 m` od ściany E) | `decals/fus_director_resonance_board.webp` | Na tablicy dr. Moriego widnieje spektrogram cięcia **ostrzem plazmowym (`plasmaBlade`)** oraz dopisek: *„Poszukiwany Kurier odbija nasze pociski w oknie 150 ms i doładowuje tym własny Rezonans! Jakim cudem jego implant kory ruchowej nie przegrzewa się bez chłodziwa z Helios-IV?!”*. |
| **EE-09** | **Anomalia poboru mocy na stacji metra „Kamienna” („Iskra”)** | `R8` Biuro Kierownika Naukowego (`X = +21.95, Y = 6.20, Z = -30.5`, `0.05 m` od ściany E) | `decals/fus_director_resonance_board.webp` | Mapa sieci energetycznej Dolnej Niecki z zaznaczoną nieczynną **stacją metra „Kamienna”** (kryjówką komórki ruchu oporu **„Iskra”** z `docs/gdd.md` §12): *„Nielegalny pobór 180 kW pod peronem stacji Kamienna — zasila prywatny warsztat broni i stację medyczną. Przekazać koordynaty grupie uderzeniowej Vane'a!”*. |
| **EE-10** | **Sabotaż Bajta, Miry, Doktor Wolan i Szrona** | `R3` Sterownia Główna (`X = -15.0, Y = 6.25, Z = -35.95`) i `R7` Serwerownia (`X = +37.95, Y = 1.65, Z = -13.0`) | `screens/screen_fus_iskra_alert.webp` | Logi systemowe na ekranach: *„1) Haker **Bajt** podpiął pętlę synthwave do czujników cewki TF-07; 2) **Doktor Wolan** wykradła dokumentację medyczną pierwszych Rezonantów; 3) Moduły rykoszetu z warsztatu **Miry** przebijają tarcze naszych Tarczowników; 4) Taktyka **Szrona** omija kordony Orbis Grid”*. |
| **EE-11** | **Projekt Sztucznych Implantów Rezonansu (GDD §12)** | `R8` Biuro Kierownika Naukowego (`X = +18.5, Y = 4.80, Z = -34.2`, w komorze `fus_plasma_test_chamber`) | `fus_plasma_test_chamber` + `fus_director_resonance_board.webp` | Główny sekret łuku fabularnego `docs/gdd.md`: w gabinecie dr. Moriego w miniaturowej pułapce magnetycznej spoczywa ładowany plazmą **prototyp sztucznego implantu Rezonansu Koalicji** z tabliczką: **`SERIA AKORD-HELIOS // SZTUCZNY RDZEŃ KORY RUCHOWEJ DLA KORPUSU EGZEKUTORÓW`**. |
| **EE-12** | **Kubek dr. Moriego i kod awaryjny `0451`** | `R8` Biuro Kierownika (`na biurku`) i `R3` Sterownia Główna (`na konsoli`) | `labels/label_tritium_cask.webp` | Kubek termiczny z napisem **`FUZYJNA KAWA 100 000 000 K`** oraz żółta karteczka przy konsoli wygaszania reaktora: **`KOD AWARYJNEGO ZRZUTU PLAZMY: 0451 (NIE ZMIENIAĆ, PUŁKOWNIK VANE MA TEN SAM KOD DO SWOJEJ WINIARNI!)`**. |

---

## 7. Konfiguracja walki, 18 spawnów wrogów, 4 hazardy, oświetlenie `CityLights` i plan generatora `run8.mjs`

### 7.1. Blok `arena`, dyrektor walki i 18 punktów spawnu wrogów Kurogane (`spawnPoints` na 3 poziomach)

Pokój `run8.json` ma `"type": "combat"`, `"theme": "kuroganeFusion"`, `"weather": "kuroganeFusionPlant"` oraz blok `arena`:
- `"navigationCellM": 0.5`, `"navigationClearanceM": 0.4`, `"navigationMaxRiseM": 0.55`, `"navigationHeadroomM": 2.2`, `"batchCellM": 24`,
- `"spawnRing": { "minM": 10, "maxM": 30 }`, `"maxAlive": 10`, `"minSpawnDistance": 10`,
- Punkty kontrolne wymagane przez `capturePointsSchema`: `A: (0, 0.0, 14.0)` (południowe przedpole Tokamaka w Hali Reaktora `R2`), `B: (0, 0.0, -14.0)` (północne przedpole Tokamaka pod oknem Sterowni), `C: (-8, 4.8, -29.0)` (Sterownia Główna `R3` na poziomie `G1`).

**Tabela 18 punktów spawnu wrogów Kurogane (`spawnPoints`) — pokrywających wszystkie pomieszczenia i 3 poziomy wysokości (`y = 0.00 m`, `y = +4.80 m`, `y = +9.60 m`), z pełnym prześwitem kapsuły i `0` kolizji z jakimkolwiek blokiem/dywanem:**

| Nr | Współrzędne `{ x, y, z }` | Poziom wysokości | Pomieszczenie | Rola taktyczna w starciu (archetypy Kurogane Arms) |
|---:|---|---|---|---|
| **1** | `{ "x": -8, "y": 0.0, "z": 14 }` | **Poziom Główny** (`0.0 m`) | **R2** (Hala Reaktora — SW) | Szturmowiec za południowo-zachodnią kriopompą przyjmujący gracza po wejściu ze Śluzy `R1` |
| **2** | `{ "x": 8, "y": 0.0, "z": 14 }` | **Poziom Główny** (`0.0 m`) | **R2** (Hala Reaktora — SE) | Strzelec za południowo-wschodnią kriopompą prowadzący ogień zaporowy wokół cokołu Tokamaka |
| **3** | `{ "x": -13, "y": 0.0, "z": 2 }` | **Poziom Główny** (`0.0 m`) | **R2** (Hala Reaktora — W) | Tarczownik Kurogane blokujący zachodni łuk obejścia Tokamaka przy banku kondensatorów |
| **4** | `{ "x": 13, "y": 0.0, "z": 2 }` | **Poziom Główny** (`0.0 m`) | **R2** (Hala Reaktora — E) | Szturmowiec flankujący prawą stroną cokołu reaktora |
| **5** | `{ "x": -8, "y": 0.0, "z": -13 }` | **Poziom Główny** (`0.0 m`) | **R2** (Hala Reaktora — NW) | Strzelec osłaniający podejście pod północno-zachodnią Rampę #3 (`L0 → G1`) |
| **6** | `{ "x": 8, "y": 0.0, "z": -13 }` | **Poziom Główny** (`0.0 m`) | **R2** (Hala Reaktora — NE) | Egzekutor Kurogane przed północno-wschodnią Rampą #4 pod oknem Biura Kierownika |
| **7** | `{ "x": -28, "y": 0.0, "z": -11 }` | **Poziom Główny** (`0.0 m`) | **R4** (Laboratorium Fizyki Plazmy) | Strzelec między ławami inżektorów wiązki neutralnej |
| **8** | `{ "x": -28, "y": 0.0, "z": 16 }` | **Poziom Główny** (`0.0 m`) | **R5** (Magazyn Paliwa — Deuter/Tryt) | Tarczownik za paletami beczek trytu pod suwnicą (poza marginesem `1 m` od `fuel-vault-isotope-laser`) |
| **9** | `{ "x": 26, "y": 0.0, "z": 15 }` | **Poziom Główny** (`0.0 m`) | **R6** (Hala Turbin i Wymienników Ciepła) | Szturmowiec wybiegający zza południowego turbozespołu parowo-MHD |
| **10** | `{ "x": 26, "y": 0.0, "z": -18 }` | **Poziom Główny** (`0.0 m`) | **R7** (Serwerownia Diagnostyczna) | Strażnik między szafami kwantowymi Orbis Grid (poza marginesem `1 m` od `server-coil-control-laser`) |
| **11** | `{ "x": -20, "y": 4.8, "z": 0 }` | **Galeria G1** (`+4.8 m`) | **R2-G1W** (Galeria Techniczna Zachodnia) | Strzelec na zachodnim pomoście `G1` — idealny cel do zrzucenia Pchnięciem Rezonansu do Hali Reaktora! |
| **12** | `{ "x": 20, "y": 4.8, "z": 0 }` | **Galeria G1** (`+4.8 m`) | **R2-G1E** (Galeria Techniczna Wschodnia) | Strzelec na wschodnim pomoście `G1` górujący nad cokołem Tokamaka |
| **13** | `{ "x": -14, "y": 4.8, "z": -30 }` | **Poziom G1** (`+4.8 m`) | **R3** (Sterownia Główna — zachód) | Tarczownik broniący zachodniego rzędu konsol operatorskich i śluzy `exit` |
| **14** | `{ "x": -2, "y": 4.8, "z": -30 }` | **Poziom G1** (`+4.8 m`) | **R3** (Sterownia Główna — wschód) | Egzekutor Kurogane za głównym stołem dowodzenia przed 15-metrową szybą na reaktor |
| **15** | `{ "x": 11, "y": 4.8, "z": -26 }` | **Poziom G1** (`+4.8 m`) | **R8** (Biuro Kierownika Naukowego) | Strażnik ochrony osobistej dr. Moriego na czystej płycie `fus_control_tile` (zero kolizji z dywanem-dekalem!) |
| **16** | `{ "x": -20.4, "y": 9.6, "z": -6 }` | **Galeria Górna G2** (`+9.6 m`) | **R2-G2W** (Galeria Górna Zachodnia) | Snajper Kurogane na wysokości korony Tokamaka (`+9.60 m`) celujący laserem w dół hali |
| **17** | `{ "x": 0, "y": 9.6, "z": -20.4 }` | **Galeria Górna G2** (`+9.6 m`) | **R2-G2N** (Galeria Górna Północna) | Snajper/dron na najwyższym pomoście północnym bezpośrednio nad oknem Sterowni `R3` |
| **18** | `{ "x": 20.4, "y": 9.6, "z": -6 }` | **Galeria Górna G2** (`+9.6 m`) | **R2-G2E** (Galeria Górna Wschodnia) | Strzelec wyborowy na wschodnim pomoście `G2` (`+9.60 m`) |

### 7.2. Zestawienie zagrożeń środowiskowych (`hazards[]` — 4 hazardy)

| Nr | `kind` i `id` | Poziom i pomieszczenie | Położenie i parametry | Zastosowanie w walce (Ostrze / Rezonans / Strzelec) |
|---:|---|---|---|---|
| **1** | `electric_field`<br>`id: "reactor-west-capacitor-arc"` | **Poziom Główny (`y = 0.0 m`)**<br>`R2` Hala Reaktora (ściana W) | `position: (-16.0, 1.0, -3.0)`, `size: (2.8, 2.0, 3.2)`, `cycle: { onS: 2.8, offS: 2.0 }` | Przeciążony bank kondensatorów rozruchu plazmy (`spód na y = 0.00 m`); pchnięcie Tarczownika lub grupy szturmowców Rezonansem w wyładowanie. |
| **2** | `laser_gate`<br>`id: "fuel-vault-isotope-laser"` | **Poziom Główny (`y = 0.0 m`)**<br>`R5` Magazyn Paliwa (Deuter/Tryt) | `from: (-36.5, 0.85, 11.0)`, `to: (-29.5, 0.85, 11.0)`, `cycle: { onS: 2.6, offS: 1.8 }` | Wiązka zabezpieczająca gniazda beczek trytu pod suwnicą; pozwala przeciąć pościg ślizgiem (`slide`) w oknie `offS` lub zepchnąć wrogów na laser. |
| **3** | `laser_gate`<br>`id: "server-coil-control-laser"` | **Poziom Główny (`y = 0.0 m`)**<br>`R7` Serwerownia Diagnostyczna | `from: (24.0, 0.85, -13.0)`, `to: (30.0, 0.85, -13.0)`, `cycle: { onS: 2.2, offS: 1.6 }` | Bramka laserowa między rzędami szaf kwantowych Orbis Grid w ciasnym korytarzu CQB. |
| **4** | `explosive_barrel`<br>`id: "turbine-hall-coolant-barrel"` | **Poziom Główny (`y = 0.0 m`)**<br>`R6` Hala Turbin i Wymienników | `position: (29.5, 0.0, 9.0)` | Zbiornik ciśnieniowy między dwoma turbozespołami parowo-MHD; natychmiastowa detonacja ostrzałem z blastera lub rzutem skrzynią. |

### 7.3. Oświetlenie bez smug wolumetrycznych i budżet `CityLights`

Zgodnie z limitem `CityLights` (`8` aktywnych `PointLight` na `high`, `4` na `medium`, selekcja wg odległości i `importance` we frustum kamery) oraz rygorem z `run3`–`run7`:
1. **100% opraw sufitowych i kasetonów (`fus_ceiling_coffer_bay`, `fus_highbay_light_strip`) używa materiału `mat_light_panel`** (`#fff1d6`, `flat: true`), dzięki czemu sklepienia wszystkich 8 pomieszczeń są wyraźnie widoczne w FPP (zero czarnych sufitów!) i nie generują pionowych smug bloomu.
2. **Rozmieszczenie 24 źródeł `lights[]` (`0` z `cone: true`, każde z jawnym `floorY` odpowiadającym poziomowi `0.0`, `4.8` lub `9.6 m`):**
   - **Główna Hala Reaktora (`R2`, 10 źródeł):**
     - 4 główne źródła wokół Tokamaka (`floorY: 0.0`): północne `(0, 5.5, -8.5, "#fff1d6", intensity: 36, range: 18)`, południowe `(0, 5.5, +8.5, "#ffae1a", intensity: 36, range: 18)`, zachodnie `(-8.5, 5.5, 0, "#8a5cff", intensity: 32, range: 17)` oraz wschodnie `(+8.5, 5.5, 0, "#ffae1a", intensity: 32, range: 17)` — budują wielobarwne odbicia plazmy na posadzce `fus_reactor_floor`,
     - 2 źródła narożne na poziomie głównym (`floorY: 0.0`): przy zachodnim banku kondensatorów `(-15.5, 4.0, -3.0, "#8a5cff", intensity: 24, range: 13)` oraz przy wschodnich kriopompach `(+15.5, 4.0, +6.0, "#3d7bff", intensity: 24, range: 13)`,
     - 2 źródła na poziomie Galerii `G1` (`floorY: 4.8`): zachodni pomost `(-20.0, 8.5, 0, "#ffae1a", intensity: 24, range: 13, floorY: 4.8)` oraz wschodni pomost `(+20.0, 8.5, 0, "#ffae1a", intensity: 24, range: 13, floorY: 4.8)`,
     - 2 źródła na poziomie Galerii Górnej `G2` (`floorY: 9.6`): północna galeria nad oknem sterowni `(0, 13.8, -20.4, "#fff1d6", intensity: 26, range: 14, floorY: 9.6)` oraz korona suwnicy `(0, 15.0, 0, "#ffae1a", intensity: 30, range: 18, floorY: 0.0)`.
   - **Szatnia i Śluza Dekontaminacyjna (`R1`, 2 źródła, `floorY: 0.0`):**
     - Nad bramkami dekontaminacyjnymi `(0, 4.3, +29.0, "#6dff4a", intensity: 26, range: 13)` oraz przed Portalem Głównym do Hali Reaktora `(0, 4.3, +23.5, "#ffae1a", intensity: 28, range: 13)`.
   - **Sterownia Główna Reaktora (`R3`, 3 źródła, `floorY: 4.8`):**
     - Nad zachodnim stołem operatorskim `(-13.0, 9.1, -28.0, "#3d7bff", intensity: 28, range: 14, floorY: 4.8)`, nad wschodnim stołem przed oknem na reaktor `(-3.0, 9.1, -28.0, "#fff1d6", intensity: 28, range: 14, floorY: 4.8)` oraz zielony portal nad śluzą ewakuacyjną `exit` `(-8.0, 8.5, -35.0, "#6dff4a", intensity: 30, range: 12, floorY: 4.8)`.
   - **Laboratorium Fizyki Plazmy (`R4`, 2 źródła, `floorY: 0.0`):**
     - Nad północnym inżektorem wiązki `(-30.0, 5.1, -15.0, "#8a5cff", intensity: 28, range: 14)` oraz nad południową komorą próżniową `(-30.0, 5.1, -6.0, "#3d7bff", intensity: 26, range: 13)`.
   - **Magazyn Paliwa — Deuter/Tryt (`R5`, 2 źródła, `floorY: 0.0`):**
     - Pod suwnicą nad beczkami trytu `(-30.0, 6.4, +6.0, "#6dff4a", intensity: 26, range: 14)` oraz przy kriozbiornikach deuteru `(-30.0, 6.4, +16.0, "#ffae1a", intensity: 28, range: 14)`.
   - **Hala Turbin i Wymienników Ciepła (`R6`, 2 źródła, `floorY: 0.0`):**
     - Nad północnym turbozespołem MHD `(+30.0, 7.2, +3.0, "#ffae1a", intensity: 30, range: 15)` oraz nad południowym turbozespołem i wymiennikami `(+30.0, 7.2, +15.0, "#fff1d6", intensity: 28, range: 15)`.
   - **Serwerownia Diagnostyczna (`R7`, 1 źródło, `floorY: 0.0`):**
     - Nad rzędami szaf kwantowych Orbis Grid `(+30.0, 5.1, -13.0, "#3d7bff", intensity: 28, range: 14)`.
   - **Biuro Kierownika Naukowego (`R8`, 2 źródła, `floorY: 4.8`):**
     - Nad biurkiem dr. Moriego `(+14.0, 9.1, -29.0, "#fff1d6", intensity: 28, range: 13, floorY: 4.8)` oraz reflektor oświetlający tablicę Rezonansu i komorę prototypu `(+19.5, 8.8, -29.0, "#ffae1a", intensity: 24, range: 11, floorY: 4.8)`.

### 7.4. Plan generatora `tools/arenas/run/run8.mjs` i modułów pomocniczych `_run8*.mjs`

Wzorem `run7.mjs` kod generatora zostanie podzielony na 4 czyste, deterministyczne moduły ES w `tools/arenas/run/`:

| Plik | Odpowiedzialność i zawartość |
|---|---|
| `tools/arenas/run/_run8Kit.mjs` | - Stałe rzędnych wysokości: `Y_L0 = 0.0`, `Y_G1 = 4.8`, `Y_G2 = 9.6` oraz wysokości stropów `Y_R1_CEIL = 4.8`, `Y_R4_CEIL = 5.6`, `Y_R5_CEIL = 7.2`, `Y_R6_CEIL = 8.0`, `Y_R7_CEIL = 5.6`, `Y_G1_CEIL = 9.6`, `Y_HALL_CEIL = 19.2`;<br>- Słownik prostokątów wszystkich 8 pomieszczeń `ROOMS` (`R1..R8`) oraz segmentów galerii `G1` i `G2`, materiały (`MAT_FLOOR = 'fus_reactor_floor'`, `MAT_CONCRETE = 'fus_reactor_concrete'`, `MAT_SHIELD = 'fus_shield_panel'`, `MAT_TILE = 'fus_control_tile'`, `MAT_GLASS = 'glass_clear'`);<br>- Pomocniki konstrukcyjne: `deck()` (gwarantujący **jeden monolityczny blok posadzki na pomieszczenie**), `cofferedCeilingSlab()` (tworzący płytę stropu `ceiling: true`, żebra podciągów z `ceiling: true`, moduły kasetonowe `fus_ceiling_coffer_bay` oraz dopasowaną bryłę `rainShelters`), `segmentedWall()`, `controlWindowWall()`, `blastDoorFrame()`, `catwalkRailing()`, `rampFlightWithRails()` oraz `createPlacer()` pilnujący braku kolizji rekwizytów i czystego promienia wokół 18 spawnów. |
| `tools/arenas/run/_run8Rooms.mjs` | - Funkcja `buildReactorBaseCollider()` stawiająca ośmiokątną kolizję cokołu Tokamaka i centralny trzpień solenoidu w `(0, 0, 0)` oraz 8 dedykowanych funkcji pomieszczeń: `buildRoomR1()` (Szatnia-Dekontaminacja z prysznicami i szafkami), `buildRoomR2()` (Główna Hala Reaktora z pierścieniem kriopomp, bankami kondensatorów, pulpitami, łukami rur i wyposażeniem Galerii `G1`/`G2`), `buildRoomR3()` (Sterownia Główna z 15-metrową szybą na Tokamak i stołami operatorskimi), `buildRoomR4()` (Laboratorium Plazmy z inżektorami wiązki i komorami próżniowymi), `buildRoomR5()` (Magazyn Paliwa Deuter/Tryt z suwnicą, beczkami i kriozbiornikami), `buildRoomR6()` (Hala Turbin i Wymienników Ciepła), `buildRoomR7()` (Serwerownia Diagnostyczna z szafami kwantowymi), `buildRoomR8()` (Biuro Kierownika Naukowego dr. Moriego z tablicą Rezonansu i kolekcją Easter Eggów). |
| `tools/arenas/run/_run8Dress.mjs` | - Słownik 22 tekstur `FUSION_TEXTURES`, tablica 18 punktów `SPAWNS` na poziomach `0.0`, `4.8` i `9.6 m`, wpis `SET_PIECES` (`[{ kind: 'fusionReactor', position: { x: 0, y: 0, z: 0 }, yaw: 0, scale: 1 }]`), tablica 8 naukowców `CIVILIANS` i 20 kryjówek `HIDE_SPOTS`, rozmieszczenie skrzyń `crate` / `crate_small`, 4 zagrożenia `hazards()`, 12 easter eggów `decalsAndEasterEggs()` (wszystkie dekale ścienne `0.03–0.05 m ≤ 0.10 m` od ściany!), szyldy `signage()`, efekty pary i iskier `ambientFx()` oraz 24 źródła `lights()` bez `cone: true`. |
| `tools/arenas/run/run8.mjs` | - Punkt wejścia generatora: inicjalizuje `createRunRoom({ id: 'run8', name: 'Elektrownia Fuzyjna Kurogane Arms — Kompleks Helios-IV', theme: 'kuroganeFusion', weather: 'kuroganeFusionPlant', bounds: R(-38, 38, -37, 37), startX: 0, exitX: -8 })`;<br>- Buduje monolityczne płyty posadzek `R1..R8`, dwupoziomowe galerie `G1` (`+4.80 m`) i `G2` (`+9.60 m`), 6 biegów ramp (`25.64°`), kasetonowe stropy `ceiling: true`, wpisuje `setPieces`, `civilians`, `hideSpots`, `playerSpawn: (0, 0, 31)` oraz drzwi `entry` `(0, 1.5, 36.5)` i `exit` `(-8, 6.3, -36.5)`, zapisując wynik do `src/data/rooms/run8.json`. |

---

## 8. Kryteria akceptacji i etapy prac (A–E)

### 8.1. Kryteria akceptacji (automatyczne CLI i wizualne na zrzutach audytu)

#### A. Kryteria automatyczne (CLI i testy jednostkowe)
1. **Zero błędów i zero ostrzeżeń w `mapAudit` (`0/0`):**
   - Polecenie `node tools/levels/mapAudit.mjs run8` zwraca wynik: **`run8: 0 error, 0 warn`** (`"run8": 0` w `tests/unit/mapAudit.baseline.json`).
   - Szczegółowo: `0` `noCollisionLargeProp`, `0` `floatingObject`, `0` `outOfBounds`, `0` `overlap`, `0` `forbiddenColor`, `0` `emptyRoom`.
   - Wszystkie dekale ścienne znajdują się w odległości `≤ 0.10 m` od lica ściany.
2. **Testy nawigacji 3D, 8 pomieszczeń, 2 galerii i naukowców (`tests/unit/run8Navigation.test.ts`):**
   - Test jednostkowy weryfikuje w `ArenaNavigation(room)`:
     1. Pełną osiągalność ścieżki od `playerSpawn (0, 0, 31)` w Szatni-Dekontaminacji `R1` (`y = 0.00 m`) przez Główną Halę Reaktora `R2`, boczne skrzydła `R4`, `R5`, `R6`, `R7`, wjazd Rampami #1–#4 na Galerię `G1` (`y = +4.80 m`), wejście Rampami #5–#6 na Galerię Górną `G2` (`y = +9.60 m`) oraz dojście przez Sterownię Główną `R3` i Biuro Kierownika `R8` (`y = +4.80 m`) do drzwi `exit (-8, 4.8, -36.5)`,
     2. Dojście i pełny prześwit kapsuły (`r = 0.4 m, h = 1.8 m`, zero bloków/dywanów w punkcie spawnu!) na wszystkich **18 punktach spawnu** (`y = 0.0, 4.8, 9.6 m`),
     3. Osiągalność każdego z **20 punktów `hideSpots`** z pozycji startowej przypisanych **8 naukowców (`civilians`)**,
     4. Jednolitość posadzek (pojedynczy blok podłogi na każde z 8 pomieszczeń, brak szczelin).
3. **Pełny zestaw testów projektu (`npm run check`):**
   - `tsc --noEmit`, `eslint` i `vitest` przechodzą bez błędów, w tym `tests/unit/rooms.test.ts`, `tests/unit/roomBlockModelFit.test.ts` (zgodność wymiarów bloków z AABB 30 modeli `fus_*.glb` w tolerancji `±5%`) oraz test palety modeli i tekstur `fus_*`.
4. **Deterministyczna generacja i budżet wydajności:**
   - Dwukrotne uruchomienie `node tools/arenas/run/run8.mjs` generuje identyczny plik `src/data/rooms/run8.json`.
   - Na profilu `medium` (1920×1080) liczba wywołań rysowania w każdym z 10 widoków audytu (włącznie z proceduralnym Tokamakiem `fusionReactor.ts` i 8 naukowcami!) spełnia **`renderInfo.calls <= 800`**.

#### B. Kryteria wizualne na zrzutach audytu (`node tools/screens/mapAudit.mjs run8`) i w spacerze `?scene=map-walk&map=run8`
1. **Ocena Opusa `≥ 7/10` na komplecie zrzutów `node tools/screens/mapAudit.mjs run8`.**
2. **Kadr startowy `01-spawn.png` i monumentalny Tokamak w Hali `R2`:**
   - Już z kadru `01-spawn.png` w Szatni-Dekontaminacji `R1` przez bramki dozymetryczne i 8-metrowy portal widać w całej okazałości wysoki na `10.2 m` **Reaktor Fuzyjny (Tokamak)** z wirującymi pierścieniami cewek, pulsującą plazmą w ciepłej bieli, bursztynie i fiolecie, dwupoziomowymi galeriami `G1`/`G2`, kasetonowym stropem na `19.20 m` i oknem Sterowni Głównej `R3` w górze.
3. **Widok ze Sterowni Głównej `R3` i Biura Kierownika `R8` przez szybę na Tokamak:**
   - Z poziomu `y = +4.80 m` w Sterowni `R3` i Biurze `R8` przez przezroczyste tafle `mat_glass_clear` widać z góry cały torus Tokamaka, łuki wyładowań, parę oraz walkę toczącą się na posadzce i pomostach.
4. **Czytelność wszystkich 8 pomieszczeń i obu galerii na `10-top.png`, `08-high-west.png` i `09-high-east.png`:**
   - Po automatycznym ukryciu kasetonowych stropów `ceiling: true` zrzuty z góry pokazują kompletnie każde z 8 pomieszczeń (`R1`..`R8`), obwodowe galerie `G1` i `G2` oraz Tokamak w centrum.
5. **Brak czarnych stropów, brak lewitujących dekali, brak smug światła i brak barw zakazanych:**
   - Stropy w FPP mają wyraźny rysunek kasetonów `fus_ceiling_coffer_bay`, obicia mebli i maszyn mają czytelne kolory z `kuroganeFusion.json`, na żadnym kadrze nie ma stożków `cone: true`, a w całym otoczeniu i w plazmie reaktora nie występuje czerwień, cyan ani magenta.

### 8.2. Etapy prac (A–E)

| Etap | Zakres prac | Artefakty wyjściowe | Weryfikacja etapu |
|---|---|---|---|
| **Etap A — Fundamenty kodu: rejestracja `fus_*`, materiały powierzchniowe, motyw `kuroganeFusion` i pogoda `kuroganeFusionPlant`** | 1. Dopisanie prefiksu `'fus_'` w `src/render/cityModels.ts` oraz list `WALL_FIXTURES`, `PASSAGE_FIXTURES` i `CEILING_FIXTURES` w `src/world/mapAudit.ts` (**F-03**).<br>2. Rejestracja 4 materiałów `fus_reactor_floor`, `fus_reactor_concrete`, `fus_shield_panel`, `fus_control_tile` w `arenaMaterials.json`, `urbanMaterials.ts`, `surfaceTextures.ts` i `dressingSchema.ts` (**F-04**).<br>3. Utworzenie motywu `src/data/themes/kuroganeFusion.json` (z dopasowanymi kolorami obić) i profilu pogody `src/data/weather/kuroganeFusionPlant.json` (**F-04**).<br>4. Integracja z równolegle tworzonym modułem `src/render/fusionReactor.ts` (**F-01**) oraz systemem `civilians` / `hideSpots` (**F-02**). | Zmiany w `src/render/`, `src/world/`, `src/data/render/arenaMaterials.json`, `src/data/themes/kuroganeFusion.json`, `src/data/weather/kuroganeFusionPlant.json` | `npm run check` zielone |
| **Etap B — Modele 3D w Blenderze (`30` modeli `fus_*.glb`)** | 1. Napisanie generatora `tools/blender/sets/kurogane_fusion.py` budującego 30 modeli `fus_*.glb` z Tabel 1–2 (`§6.1`), z użyciem `mat_light_panel` na kasetonach i oprawach oraz `mat_glass_clear` na oknach sterowni i komorach próżniowych.<br>2. Eksport plików `.glb` do `public/assets/models/city/` i render podglądów PNG do `artifacts/models/fus/`.<br>3. Aktualizacja `src/data/render/mapModelBounds.json` skryptem `node tools/levels/mapModelBounds.mjs` oraz dopisanie sekcji w `docs/assets.md`. | 30 plików `public/assets/models/city/fus_*.glb`, podglądy `artifacts/models/fus/*.png`, zaktualizowany `mapModelBounds.json` | Ogląd podglądów PNG + test jednostkowy modeli (AABB, materiały, budżet trójkątów, brak zakazanych barw) |
| **Etap C — Tekstury (`22` tekstury: szyldy, ekrany tokamaka, tablica Rezonansu, easter eggi `run1`–`run7`, etykiety i powierzchnie)** | 1. Wygenerowanie i walidacja 4 tekstur powierzchni `fus_*` (+ 4 wersji `komiks_fus_*`).<br>2. Wygenerowanie 6 szyldów `signs/fus_*`, 4 ekranów `screens/screen_fus_*`, 7 tekstur `decals/fus_*` (obejmujących 12 easter eggów i matę podłogową) oraz etykiety `labels/label_tritium_cask.webp` z `§6.2`.<br>3. Rejestracja w `tools/textures/catalog.json`, `tools/textures/komiks/catalog.json` i manifestach w `public/assets/textures/`. | Pliki `.webp` w `public/assets/textures/{surfaces,komiks/surfaces,signs,screens,decals,labels}/` | Walidator tekstur (wymiary, bezszwowość powierzchni, 0 pikseli w zakazanych pasmach HSV czerwieni/cyanu/magenty) |
| **Etap D — Generator mapy `run8` (Hala Reaktora + 7 pomieszczeń, Tokamak, 8 naukowców)** | 1. Implementacja `tools/arenas/run/run8.mjs` oraz modułów `_run8Kit.mjs`, `_run8Rooms.mjs`, `_run8Dress.mjs` według współrzędnych z `§3`–`§7` (posadzki jednym blokiem, stropy z kasetonami, dekale `≤ 0.1 m`, zero bloków na spawnach).<br>2. Wygenerowanie `src/data/rooms/run8.json` i dopisanie `"run8": 0` w `tests/unit/mapAudit.baseline.json`.<br>3. Napisanie testu `tests/unit/run8Navigation.test.ts` (osiągalność 18 spawnów, 8 pomieszczeń, 2 galerii, 20 kryjówek naukowców i prześwitu kapsuły). | `tools/arenas/run/run8.mjs`, `_run8*.mjs`, `src/data/rooms/run8.json`, `tests/unit/run8Navigation.test.ts` | `node tools/levels/mapAudit.mjs run8` → `0 error, 0 warn`; `npx vitest run tests/unit/run8Navigation.test.ts`; `npm run check` |
| **Etap E — Zrzuty ekranu, audyt wizualny i szlif do oceny Opusa `≥ 7/10`** | 1. Wygenerowanie 10 zrzutów `node tools/screens/mapAudit.mjs run8 --out artifacts/maps/run8/r1 --tag after` oraz kadrów FPP z Hali Reaktora (Tokamak i galerie), Sterowni Głównej (widok przez szybę na reaktor), Laboratorium Plazmy, Magazynu Paliwa, Hali Turbin i Biura Kierownika Naukowego.<br>2. Przegląd wizualny (widoczność kasetonowych stropów w FPP, animacja Tokamaka, zachowanie naukowców, czytelność `10-top`, `renderInfo.calls <= 800`) i korekty do oceny Opusa `≥ 7/10`. | Zrzuty `artifacts/maps/run8/r1/*.png`, raport oceny wizualnej | Ocena Opusa `≥ 7/10`, `mapAudit` `0/0`, `npm run check` zielone |
