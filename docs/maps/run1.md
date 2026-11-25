# Dokument projektowy mapy `run1` — MAGAZYN KUROGANE ARMS

Status: **Projekt referencyjny jakości (wzorzec 8+/10) + specyfikacja braków silnika („fundamenty”)**  
Docelowy plik danych mapy: `src/data/rooms/run1.json` (generator: `tools/arenas/run/run1.mjs`)  
Kierunek artystyczny: **Neon Noir** (`AGENTS.md`, `docs/adr/0006-neon-noir.md`)

---

## 1. Analiza silnika

### 1.1. Jak dziś działają mapy runów (`rooms`) i poziomy misji (`levels`)

W silniku istnieją dwa pokrewne formaty map oparte na wspólnej bazie geometrycznej `roomSchema`:

| Cecha | Pokój runu (`rooms`) | Poziom liniowy (`levels`) |
|---|---|---|
| **Pliki danych** | `src/data/rooms/<id>.json` | `src/data/levels/<id>.json` (+ wymagana misja w `src/data/missions/<mId>.json` i fale w `src/data/waves/*.json`) |
| **Schemat i loader** | `src/world/roomSchema.ts` (`roomSchema`, `loadRoom`), rejestr `src/world/rooms.ts` (`roomDefinitions` przez `import.meta.glob`) | `src/world/levelSchema.ts` (`levelSchema`, `loadLevel`), rejestr `src/world/levels.ts` (`levelDefinitions`) |
| **Host sceny** | `RunScene` (`src/scenes/run.ts`) w pętli runu lub `RoomTest` (`src/scenes/roomTest.ts`, `?scene=room-test&room=<id>`); bezpośrednio tworzy `RoomScene` (`src/scenes/roomScene.ts`) | `MissionScene` (`src/scenes/mission.ts`, `?scene=mission&mission=<mId>`) z `LevelRuntime` (`src/world/levelRuntime.ts`), który opakowuje `RoomScene` (`manualEncounter: true`, `linearMission`) |
| **Przejścia i bramy** | Pole `doors` (`roomDoorSchema`): dokładnie 1 `entry` i 1 `exit` (`0` dla `type: "boss"`). `entry` jest zawsze zamknięte; `exit` otwiera się (znika mesh i collider) po `wave_cleared` ostatniej fali | Brak `doors` (`omit({ doors: true })`). Zamiast nich pole `gates`: `[{ id, block, after, closedDuring? }]` sterowane co krok przez `LevelRuntime.openGates()` i `RoomScene.setLevelGate()` |
| **Spawny i walka** | Jedna tablica `spawnPoints: [{ x, z }]` (min. 4 dla `combat`/`elite`). Jeden `WaveDirector` dla całego pokoju; fale planuje `planWaves` (`src/world/threat.ts`) | Tablica `encounters`: każde spotkanie ma własną strefę wyzwalania `zone` (`box` lub `sphere`), falę `wave`, własne `spawnPoints`, opcjonalne `spawnHeightM`, warunek `after` (`objective` lub `encounter`), `reinforcementFor` i `bossFor` |
| **Pion i nawigacja AI** | Opcjonalne pole `arena` (`arenaSchema` w `roomSchema.ts:111`). Gdy obecne jest `arena.spawnRing`, `RoomScene` włącza `stepClimbing: true` w `EnemyManager`, ale `this.navigation` (`ArenaNavigation` / `ArenaSurfaceNavigation`) tworzy dziś **tylko wtedy, gdy `run.modeId` to `conquest`/`assault`/`heist`** (`roomScene.ts:915–938`) | Brak `this.navigation` dla wrogów (chyba że skonfigurowano `arena`); sojusznicy używają `allyNavigation()` (`ArenaNavigation` lub `buildFloorNavigation` na poziomie `playerSpawn.y`) |
| **Walidacja układu** | `validateLayout` (`roomSchema.ts:357`): podłogą jest każdy blok z `position.y + size.y / 2 === playerSpawn.y` (porównanie bitowe `===`). Przeszkodą jest blok z `bottom <= groundY && top > groundY`. Flood-fill po siatce 1×1 m (`floor(x), floor(z)`) sprawdza osiągalność wszystkich `spawnPoints` od `playerSpawn` | `loadLevel` (`levelSchema.ts:327`) wywołuje `roomSchema.parse`, wrzucając do `spawnPoints` wszystkie spawny spotkań, `objectivePositions`, `checkpoints`, `allies` i `objectiveNpcs` (wszystkie muszą leżeć na poziomie `playerSpawn.y` i być osiągalne na siatce 1 m!) |

### 1.2. Decyzja architektoniczna: `run1` jako pokój (`rooms`) czy poziom (`levels`)?

**Rekomendacja:** `run1` należy zrealizować jako **pokój runu w `src/data/rooms/run1.json`** (`type: "combat"`, z wypełnionym blokiem `arena` jak w generatorach `tools/arenas/run/*.mjs`), a nie jako poziom liniowy `src/data/levels/`.

**Uzasadnienie wynikające z kodu:**
1. **Brak sztucznej misji kampanii:** `src/world/levels.ts` oraz `src/scenes/mapSceneLoader.ts:61–64` wymagają, aby każdy poziom z `src/data/levels/<id>.json` był przypięty polem `level: "<id>"` do misji fabularnej w `src/data/missions/*.json` (z briefingiem, debriefem, radiem i celami). Poziom bez misji powoduje wyjątek przy starcie i nie ładuje się w `map-walk` ani `map-audit`.
2. **Natywne działanie w pętli runu:** `RunScene.chooseRoom` (`src/scenes/run.ts`) losuje układy węzłów wyłącznie z `roomDefinitions` (`src/data/rooms/*.json`) oraz pul `roomPools` w `src/data/sectors/kurogane.json`. Poziomy z `src/data/levels/` nigdy nie biorą udziału w runie (`?scene=run`).
3. **Automatyczne wpięcie do podglądu i audytu:**
   - **Podgląd „Testy map” (`?maps=1` → `?scene=map-walk&map=run1`):** `src/world/mapCatalog.ts` ładuje automatycznie wszystkie `src/data/rooms/*.json` przez `import.meta.glob`. Każdy pokój o `type: "combat"` i `id` niezaczynającym się od `arena` trafia automatycznie do grupy **„Pokoje: walka”**. `MapWalkScene` (`src/scenes/mapWalk.ts`) uruchamia go przez `loadMapScene('run1', params, store, true)` z flagą `peaceful = true` (`manualEncounter: true`, puste fale — swobodny spacer FPP z fizyką Rapiera, bez wrogów).
   - **Audyt CLI i zrzuty (`mapAudit`):** `tools/levels/mapAuditCatalog.ts` ładuje `src/data/rooms/*.json` automatycznie przez glob. Komendy `node tools/levels/mapAudit.mjs run1` oraz `node tools/screens/mapAudit.mjs run1 --tag after` zadziałają od razu po utworzeniu pliku `src/data/rooms/run1.json` (wymagane jest tylko dopisanie `"run1": 0` w `tests/unit/mapAudit.baseline.json`).
   - **Wpięcie do runu i sceny testowej walki:**
     - Test bezpośredni z walką: `?scene=room-test&room=run1&debug=1` (`src/scenes/roomTest.ts` ładuje pokój z 2 falami testowymi z `src/data/waves/roomTest.json`).
     - Wpięcie do losowania w runie Kurogane Arms: dopisanie `"run1"` do tablicy `roomPools.combat` w `src/data/sectors/kurogane.json:119`.
4. **Co trzeba uzupełnić w `RoomScene`, by 4-pomieszczeniowy pokój działał bezbłędnie w walce:**
   - W `src/scenes/roomScene.ts:915` `this.navigation = new ArenaNavigation(this.layout)` jest obecnie wywoływane wyłącznie wewnątrz bloków `if (this.run.modeId === 'conquest' | 'assault' | 'heist')`. W zwykłym pokoju runu `this.navigation` pozostaje `undefined`, przez co wrogowie idą w linii prostej do gracza i blokują się na ścianach działowych między 4 pomieszczeniami. Włączenie `ArenaNavigation` dla każdego pokoju posiadającego pole `arena` (lub automatyczne budowanie `ArenaSurfaceNavigation` z bloków `walkable: true`) rozwiązuje nawigację między pomieszczeniami i piętrami (szczegóły w sekcji 2, fundament **F-01**).

### 1.3. Wnętrza, materiały, oświetlenie, pogoda i instancing — stan obecny w kodzie

1. **Sufit / dach i ściany wewnętrzne:**
   - **Fizyka i walidacja:** bloki sufitowe (`position.y - size.y / 2 > playerSpawn.y`) oraz nadproża nad otworami drzwiowymi (`bottom >= 3.0 m`) mają pełne collidery Rapiera w `RoomScene.buildLayout` i nie blokują flood-fillu 1×1 m w `validateLayout` (`src/world/roomSchema.ts:370–376`), ponieważ przeszkodami dla `validateLayout` są wyłącznie bloki przecinające płaszczyznę `groundY = playerSpawn.y`.
   - **Problem z kamerami z góry w `mapAuditScene.ts`:** `viewpoints()` w `src/scenes/mapAuditScene.ts:96–114` ustawia kamery `high-west`, `high-east` (pod kątem 35° z zewnątrz) oraz `top` (pionowo w dół z wysokości ponad `max(box.max.y)`). Pełny, dwustronnie nieprzezroczysty blok sufitu zasłania całkowicie wnętrze na 3 z 10 zrzutów audytu (`08-high-west.png`, `09-high-east.png`, `10-top.png`).
   - **Problem z `behindWall` w `mapAudit.ts`:** funkcja `behindWall` (`src/world/mapAudit.ts:284–307`) sprawdza tylko bloki z `def.model === 'wall' && def.size.y >= 2`. Ściany wewnętrzne (działowe) mają podłogę po obu stronach, ale by uniknąć fałszywych alarmów `outOfBounds` przy narożnikach, ścianom działowym nie należy przypisywać `model: "wall"` (wystarczy sam `material`).
   - **Problem z `Panorama` we wnętrzach (`roomScene.ts:452`):** `RoomScene` przekazuje `panoramaExclusion` (`envelope.bounds`) do `SceneAtmosphere` **tylko wtedy, gdy `this.options.linearMission` jest prawdziwe**. W zwykłym pokoju runu `panoramaExclusion` wynosi `undefined`, a `neonStreet.json` ma `panoramaEnabled: 1`. Ponadto w zamkniętym wnętrzu z sufitem niepotrzebnie renderuje się 7 obiektów `Panorama` (wieżowce, kopuła nieba, ruch uliczny).
2. **Drzwi i przejścia wewnętrzne:**
   - `roomSchema` wymusza dokładnie 1 drzwi `entry` i 1 `exit` (`src/world/roomSchema.ts:211–224`), które `RoomScene` buduje jako prostopadłościany z materiałem `paint` (`src/scenes/roomScene.ts:1370–1384`).
   - Brak wsparcia dla drzwi wewnętrznych otwieranych między pomieszczeniami w `roomSchema`. Przejścia między 4 pomieszczeniami muszą być otwartymi ościeżami (szerokość min. `3.0–5.0 m`, wysokość `3.2–4.5 m`) z nadprożem, opcjonalnie udekorowanymi częściowo podniesioną roletą `city_shutter` na wysokości `y >= 2.8 m` lub ramą bramy.
3. **Oświetlenie wewnętrzne i cień:**
   - **Brak cieni dynamicznych i okluzji sufitu:** `createStyleLights()` (`src/render/lights.ts`) dodaje `HemisphereLight` i `DirectionalLight` (bez cieni — `shadows: 0` w `src/render/quality.ts`). W motywie `neonStreet` (`hemiIntensity: 1.35`, `keyIntensity: 1.9`) sufit **nie rzuca cienia do wnętrza** — wszystkie pomieszczenia są z góry równomiernie oświetlone mocnym światłem dziennym/ulicznym, co spłaszcza kontrast lokalnych lamp warsztatowych i awaryjnych.
   - **Limit świateł punktowych (`CityLights`, `src/render/city/lights.ts`):** pula `PointLight` wynosi maks. **8** na profilu `high`, **4** na `medium` i **2** na `low`. `selectCityLights` wybiera aktywne źródła wg `distanceSq / (power^importance * keep)` w granicach frustum kamery. Każde źródło z `lights[]` rysuje jednak zawsze okrągłą plamę światła na podłodze (`spot`, `radialFragment`).
   - **Pułapka `lightSpotFloors` (`src/render/city/dressing.ts:53–75`):** funkcja automatycznie szuka podłoża pod światłem **tylko wtedy, gdy `p.y < floorY`** (w wykopie). Dla wszystkich świateł powyżej `floorY` (np. nad antresolą `y = 3.6 m`) bez jawnego pola `"floorY": 3.6` w JSON plama światła rysuje się na `y = 0`!
   - **Stożki wolumetryczne (`LampCones`, `src/render/city/lamps.ts`):** działają jako jeden wydajny `InstancedMesh`, ale są tworzone **wyłącznie** dla dekoracji `city_street_lamp` i `city_lantern_string`. Zwykłe wpisy `lights[]` nie mogą włączyć stożka światła (`cone: true`).
4. **Materiały i tekstury podłóg oraz ścian:**
   - Projekcja tekstur powierzchni w `src/render/urbanMaterials.ts` jest **triplanarna w przestrzeni świata** (`vCityWorld`), z proceduralnym brudem (`grime.webp`) i reliefem normalnych w przestrzeni ekranu (`cityPerturbNormal`).
   - `BLOCK_MATERIALS` w `src/world/dressingSchema.ts:20–80` liczy 54 unikalne identyfikatory (m.in. `concrete`, `concrete_raw_cast`, `quay_concrete`, `quay_lines`, `turbine_hall_floor`, `power_quay_floor`, `steel_grating`, `metal`, `corrugated`, `plaster`, `smog_soot_wall`, `glass`, `trim`, `hazard`, `hazard_stripes_worn`, `container_navy|olive|ochre|graphite`, `crane_paint`, `formwork_plywood`, `scaffold_planks`, `gas_station_tiles`, `light_white`, `neon_amber`, `neon_green`).
   - **Rozjazd schematów `dressingSchema.ts` vs `hubSchema.ts`:** materiały `machine`, `paint`, `lacquer`, `plastic`, `rubber`, `wood`, `fabric`, `hivis`, `neon_blue`, `neon_violet`, `neon_white` istnieją w rendererze (`src/render/materials.ts` i `urbanMaterials.ts`) oraz w `HUB_BLOCK_MATERIALS` (`src/world/hubSchema.ts:34–47`), ale **brakuje ich w `BLOCK_MATERIALS` w `src/world/dressingSchema.ts`** — użycie ich na bloku w pokoju runu powoduje błąd walidacji zod!
   - **Niepodpięte tekstury z `public/assets/textures/surfaces/`:** na dysku istnieją gotowe tekstury `tiles_wall.webp` (oraz `komiks_tiles_wall.webp`) i `tread_plate.webp` (blacha ryflowana, oraz `komiks_tread_plate.webp`), ale nie mają odpowiadających wpisów w `urbanMaterials.ts` ani `BLOCK_MATERIALS`!
5. **Decale (`decals`):**
   - `DecalRenderer` (`src/render/city/decals.ts`) tworzy dla każdego wpisu osobny `Mesh` z `MeshBasicMaterial` (unlit, `polygonOffset`, odsunięcie `0.012 m`).
   - Dostępne w `public/assets/textures/decals/`: `floor_arrow`, `floor_hazard`, `floor_stop`, `oil_stain`, `tire_marks`, `manhole`, `crack_floor`, `puddle1`, `puddle2`, `leak_streak`, `poster_torn1..3`, `sticker_cluster`, `graffiti_*`.
   - Brakuje pola `tint` w `decalSchema` (nie da się zabarwić strzałki/linii na bursztyn/zieleń) oraz brakuje tekstur linii komunikacyjnych BHP (pasy wózków, koperty paletowe, oznaczenia sektorów).
6. **Deszcz i pogoda we wnętrzu:**
   - `rainShelters` (`[{ position, size }]`) wycina smugi deszczu i rozbryzgi w AABB (`src/vfx/weather.ts:104–108`), ale w motywie `neonStreet` zostawia błyski burzy (`skyFlash`) na mgle oraz dźwięk ulewy.
   - Z kolei wybór `"weather": "smog"` lub `"clearNight"` wyłącza opad i błyski, lecz zmienia mgłę i włącza dźwięk wiatru (`ambience: [{ kind: 'wind' }]`). Brakuje profilu pogody dedykowanego zamkniętym halom (`indoorIndustrial`).
7. **Instancing i batching (`InstancedMesh` i `batchStaticGeometry`):**
   - W `RoomScene.buildLayout` (`src/scenes/roomScene.ts:459, 1155`) obsługa `blocks[].instance: true` (`InstancedMesh`) oraz podział statyki budżetem trójkątów (`tuning.arena.batchTriangleBudget = 60 000`) włączają się **wyłącznie wtedy, gdy pokój ma `arena.exclusive` lub `arena.spawnRing`** (wtedy powstaje `this.staticWorld`). Dlatego `run1.json` musi mieć blok `arena` z `spawnRing`.

### 1.4. Dostępne modele 3D (`public/assets/models/` i `src/data/render/mapModelBounds.json`)

Modele dzielą się na:
1. **Modele bazowe pokoju (`public/assets/models/*.glb`, ładowane przez `cloneRoomModel`):**
   - Rozciągliwe do `block.size` (`STRETCH_MODELS` w `roomScene.ts:227`): `pillar` (`1.2 × 4 × 1.2 m`), `cover_low` (`2 × 1 × 0.5 m`). *(Uwaga: `wall_segment` jest w `STRETCH_MODELS`, ale brakuje go w słowniku `MODEL_FILES` w `roomScene.ts:216`, więc nie jest nigdy ładowany).*
   - Zniszczalne fizyczne (`PropPhysicsSystem` w `src/world/propPhysics.ts`): `crate` (`1 × 1 × 1 m`, statyczna zniszczalna, materiał `interactive` `#d9dde3`), `crate_small` (`0.5 × 0.5 × 0.5 m`, dynamiczne ciało Rapiera, popychane i chwytane Rezonansem). Ustawienie `destructible: false` zamienia je w zwykłe statyczne bryły.
2. **Modele miejskie i przemysłowe (`public/assets/models/city/*.glb`, 89 modeli w `mapModelBounds.json`, ładowane przez `cloneCityModel`):**
   - **Montaż jako blok z kolizją (`blocks[]`):** podajemy `model: "<id>"` oraz `size` równe AABB modelu (±5%, test `roomBlockModelFit.test.ts`), `position.y = y_podłoża + size.y / 2`. Dla modeli obróconych o 90° (`yaw = ±π/2`), których X ≠ Z, ze względu na nieobrócony `footprint` w `validateLayout`, stosuje się wpis w `decor[]` (z `yaw`) + niewidoczny blok kolizji (`visible: false`) o zamienionych wymiarach `size.x` i `size.z`.
   - **Montaż jako dekoracja (`decor[]`):** `position.y` to spód modelu (`min.y = 0`), a dla rozpięć (`city_cable_span`, `city_lantern_string`) góra (`max.y = 0`).
   - **Wybrane modele gotowe do użycia w `run1` (z wymiarami AABB z `mapModelBounds.json`):**
     - *Konstrukcja i pion:* `port_warehouse_shell_panel` (`6.0 × 10.0 × 0.73 m`), `port_warehouse_roof_truss` (`30.0 × 3.3 × 6.0 m`), `city_overpass_pillar` (`2.5 × 10.0 × 2.513 m`), `build_unfinished_column` (`0.605 × 4.8 × 0.605 m`), `build_site_office` (`6.058 × 2.591 × 2.438 m`, dach `walkable` na `2.591 m`), `build_site_office_stairs` (`5.871 × 3.691 × 1.68 m`, spocznik na `2.591 m`), `build_scaffold_bay` (`2.5 × 3.1 × 1.2 m`, podest na `2.0 m`), `port_lashing_platform` (`6.0 × 1.24 × 1.37 m`), `city_roof_bridge` (`1.6 × 1.39 × 8.0 m`).
     - *Skład i ładunki:* `port_container_20_navy|olive|ochre|graphite` (`6.058 × 2.591 × 2.438 m`), `port_container_40_navy|olive|ochre|graphite` (`12.192 × 2.591 × 2.438 m`), `city_crates` (`1.212 × 1.59 × 1.256 m`), `build_precast_stack` (`6.0 × 1.6 × 2.406 m`), `build_pipe_stack` (`3.02 × 2.793 × 3.0 m`), `build_rebar_bundle` (`6.0 × 0.59 × 1.02 m`), `city_dumpster` (`1.97 × 1.33 × 1.08 m`), `city_barrier` (`2.0 × 0.929 × 0.51 m`), `city_highway_barrier` (`4.0 × 1.093 × 0.808 m`).
     - *Technika i instalacje:* `power_transformer` (`6.0 × 5.0 × 4.0 m`), `power_pipe_rack` (`12.0 × 7.3 × 4.02 m`, pomost na `6.2 m`), `city_generator` (`1.6 × 1.4 × 1.005 m`), `city_smog_scrubber` (`3.0 × 4.0 × 3.0 m`), `city_roof_hvac_unit` (`4.0 × 1.998 × 2.052 m`), `city_pipe_run` (`0.78 × 6.06 × 0.374 m`, ścienny), `city_ac_unit` (`0.907 × 0.604 × 0.518 m`, ścienny), `city_cable_span` (`10.0 × 1.104 × 0.429 m`, `ends: [[-5,-0.06,-0.19],[5,0,-0.205]]`), `city_vent_grate` (`1.0 × 0.05 × 1.0 m`), `city_door` (`1.505 × 2.465 × 0.238 m`, ścienny), `city_shutter` (`3.0 × 3.0 × 0.251 m`, ścienny), `city_ad_screen` (`1.1 × 2.294 × 0.182 m`, ścienny), `city_sign_box` (`2.0 × 1.0 × 0.25 m`, ścienny), `city_holo_projector` (`0.6 × 0.2 × 0.6 m`), `port_bollard` (`0.62 × 0.6 × 0.62 m`), `city_traffic_cone` (`0.46 × 0.7 × 0.46 m`, scatter), `city_trash_bags` (`1.113 × 0.644 × 0.922 m`, scatter).

### 1.5. Reguły `src/world/mapAudit.ts` (`tools/levels/mapAudit.mjs`)

Każdy obiekt w `run1` jest projektowany pod zerową liczbę błędów i ostrzeżeń dla 6 reguł audytu:
1. **`noCollisionLargeProp` (`error`):** każdy model `decor` na grywalnej podłodze o wysokości `> 0.6 m` i obu wymiarach podstawy `> 0.5 m` (poza `ends` i `SCATTER_MODELS`) musi mieć blok kolizji (widoczny lub `visible: false`) pokrywający środek na wysokości `feet.y + min(0.6, halfY)` z tolerancją `CONTACT = 0.18 m`.
2. **`floatingObject` (`warn`):**
   - `WALL_FIXTURES` (`city_ac_unit`, `city_awning`, `city_fire_escape`, `city_pipe_run`, `city_door`, `city_shutter`, `city_ad_screen`, `city_sign_box`, `city_neon_sign_frame`) muszą przecinać zakotwiczoną bryłę w promieniu `WALL_MOUNT = 0.65 m` ze wspólnym zakresem Y (`> 0.18 m`).
   - Modele z `ends` (`city_cable_span`, `city_lantern_string`) muszą mieć oba końce wewnątrz zakotwiczonych brył z marginesem `ANCHOR = 0.32 m`.
   - Szyldy (`signs`, `kind !== 'holo'`) muszą stykać się z zakotwiczoną bryłą w promieniu `ANCHOR = 0.32 m`.
   - Pozostałe modele muszą stać na bloku (`|surfaceY - feet.y| <= 0.18 m`), mieć `proxy` (`visible: false`) lub stykać się z zakotwiczoną bryłą (`<= 0.32 m`).
3. **`outOfBounds` (`warn`):** żaden obiekt nie może leżeć poza połączonymi płatami podłogi bez kontaktu z zakotwiczoną zabudową ani za zewnętrzną ścianą `model: "wall"`.
4. **`overlap` (`error`/`warn`):** brak zduplikowanych bloków/dekoracji (`< 0.015 m`) oraz brak wnikania obwiedni głębszego niż `PENETRATION = 0.22 m` (gdy środek jednej bryły wnika w drugą głębiej niż `0.18 m`).
5. **`forbiddenColor` (`error`):** zakaz barw o `V >= 0.5`, `S >= 0.55` w odległości `<= 13°` od czerwieni (`358.4°`), cyanu (`186.1°`) i magenty (`311.6°`).
6. **`emptyRoom` (`warn`):** mapa musi zawierać niepuste tablice `lights`, `decor` oraz `signs`.

---

## 2. Lista braków („fundamenty”) z priorytetem

Poniższa lista dzieli braki silnika, danych i modeli 3D na **P0 (musi być przed `run1` — bez tego mapa nie osiągnie jakości 8/10 lub AI/render zawiedzie we wnętrzu)** oraz **P1 (może później — dalszy szlif wizualny i wydajnościowy)**.

### 2.1. Priorytet P0 — MUSI BYĆ PRZED `run1`

| ID | Co trzeba dodać / zmienić | Gdzie w kodzie / zasobach | Przybliżony zakres | Kto |
|---|---|---|---|---|
| **F-01** | **Nawigacja wielopoziomowa AI (`ArenaNavigation`) i strefy spawnu w zwykłych pokojach runu:** obecnie w `RoomScene.init()` `this.navigation = new ArenaNavigation(this.layout)` tworzy się tylko dla `modeId === 'conquest' \| 'assault' \| 'heist'`. W pokoju z 4 pomieszczeniami i antresolami wrogowie bez `this.navigation` idą na wprost w ściany działowe. Należy: (1) tworzyć `this.navigation = new ArenaNavigation(this.layout)` zawsze, gdy `this.layout.arena` jest zdefiniowane, i przekazywać `enemy.moveGoal = player.position`; (2) w `WaveDirector` / `RoomScene.spawnEnemy` wybierać punkty spawnu z tego samego lub sąsiedniego pomieszczenia (wg odległości ścieżki `ArenaNavigation` lub promienia `maxSpawnDistance`), by wrogowie nie spawnowali się 50 m dalej za dwiema ścianami. | `src/scenes/roomScene.ts` (ok. linie 910–940, 1553, 1977), `src/world/waves.ts` | ~45 linii TS + test jednostkowy w `tests/unit/roomScene.test.ts` | **Codex** (kod) |
| **F-02** | **Pełna lista materiałów bloków we wnętrzach (`BLOCK_MATERIALS`) i podpięcie tekstur `tiles_wall` oraz `tread_plate`:** (1) dopisać do `BLOCK_MATERIALS` w `dressingSchema.ts` materiały obecne już w `materials.ts` i `hubSchema.ts`: `machine`, `paint`, `lacquer`, `plastic`, `rubber`, `wood`, `fabric`, `hivis`, `neon_blue`, `neon_violet`, `neon_white`; (2) zarejestrować w `src/data/render/arenaMaterials.json` i `src/render/urbanMaterials.ts` dwa nowe materiały podłóg/ścian z istniejących już na dysku tekstur `public/assets/textures/surfaces/{tiles_wall,tread_plate}.webp` (oraz ich odpowiedników `komiks_tiles_wall`, `komiks_tread_plate` w `src/render/comicSurfaces.ts`): `tiles_wall` (płytki techniczne ścian warsztatu/śluzy) i `tread_plate` (stalowa blacha ryflowana na podesty, schody i rampy). | `src/world/dressingSchema.ts`, `src/data/render/arenaMaterials.json`, `src/render/urbanMaterials.ts`, `src/render/comicSurfaces.ts` | ~50 linii TS/JSON | **Codex** (kod) |
| **F-03** | **Tryb wnętrza (`indoor` / profil pogody `indoorIndustrial`) i wykluczenie `Panorama`:** (1) dodać profil pogody `src/data/weather/indoorIndustrial.json` (`precipitation.kind: "none"`, `lightning.enabled: false`, `fog: { color: "#141a26", density: 0.014, heightM: 6, strength: 0.55, nearM: 12, farM: 95 }`, `surface: { gloss: 0.25, reflections: 0.45, puddles: 0.2 }`, `dust: { density: 0.35, sizeM: 0.08, opacity: 0.08, color: "#9aa8c0", lifeS: 10 }`, `ambience: [{ kind: "generator", gain: 0.14, radiusM: 80 }]`) oraz przyciemnić w nim lub przez opcjonalne pole `indoor: true` w `dressingFields` światło globalne (`hemiIntensity: 0.55`, `keyIntensity: 0.45`, `panoramaEnabled: 0`), by sufit nie był przebijany ostrym słońcem/księżycem `DirectionalLight`, a lokalne `PointLight` budowały klimat; (2) w `RoomScene.init()` (`src/scenes/roomScene.ts:452`) przekazywać `envelope.bounds` jako `panoramaExclusion` zawsze, a nie tylko dla `linearMission`. | `src/data/weather/indoorIndustrial.json`, `src/render/city/dressing.ts`, `src/scenes/roomScene.ts`, `src/world/dressingSchema.ts` | ~60 linii TS/JSON | **Codex** (kod) |
| **F-04** | **Przezroczystość sufitu dla kamery audytu z góry (`mapAuditScene.ts`):** w `MapAuditScene` ujęcia `top`, `high-west` i `high-east` patrzą z zewnątrz z góry. Gdy mapa ma zamknięty sufit (`blocks` z `position.y - size.y / 2 >= 4.0`), zrzut `10-top.png` pokazuje wyłącznie czarny dach. Należy w `MapAuditScene.render()` ukrywać na czas ujęć `top`, `high-west`, `high-east` bloki/modele sufitowe (np. oznaczone lub leżące powyżej `y >= 4.2 m` i będące poziomymi płytami dachu) albo dodać w `roomBlockSchema` opcjonalną flagę `ceiling: z.boolean().optional()`, którą `MapAuditScene` ukrywa dla kamer zewnętrznych. | `src/scenes/mapAuditScene.ts`, opcjonalnie `src/world/roomSchema.ts` | ~25 linii TS | **Codex** (kod) |
| **F-05** | **Stożki wolumetryczne (`LampCones`) i automatyczne `floorY` na podestach dla świateł wewnętrznych:** (1) w `cityLightSchema` (`src/world/dressingSchema.ts:110`) dodać opcjonalne pole `cone: z.boolean().optional()` (lub rozpoznawać nowe modele opraw `wh_industrial_lamp` w `lampFixtures` w `src/render/city/lamps.ts`), aby lampy sufitowe w hali i warsztacie miały delikatny stożek wolumetryczny bez konieczności stawiania latarni ulicznej `city_street_lamp`; (2) w `lightSpotFloors` (`src/render/city/dressing.ts:53`) szukać najwyższego bloku pod światłem dla każdego `p.y > floorY` (a nie tylko `p.y < floorY`), żeby światło nad antresolą kładło plamę na antresoli, a nie pod nią. | `src/world/dressingSchema.ts`, `src/render/city/lamps.ts`, `src/render/city/dressing.ts` | ~35 linii TS | **Codex** (kod) |
| **F-06** | **Zestaw 8 modeli 3D magazynu zbrojeniowego Kurogane (`wh_*.glb`):** obecny katalog ma tylko modele uliczne, portowe i budowlane, przez co wnętrza składano z szarych prostopadłościanów i kiosków. Należy dodać skrypt `tools/blender/sets/warehouse_kurogane.py` (oraz dopisać prefiks `'wh_'` do `CITY_MODEL_PREFIXES` w `src/render/cityModels.ts:8` i zaktualizować `mapModelBounds.json` przez `node tools/levels/mapModelBounds.mjs`):<br>1. `wh_pallet_rack` (`4.0 × 6.0 × 1.4 m`, kolizja, blok) — dwuprzęsłowy regał wysokiego składowania: stalowe słupy `mat_metal` ze stężeniami, 3 poziomy trawersów `mat_hivis` (`y = 1.8, 3.8, 5.8 m`), kratownice i zróżnicowane palety ze skrzyniami zbrojeniowymi;<br>2. `wh_forklift` (`2.8 × 2.1 × 1.2 m`, kolizja, blok) — kompaktowy wózek widłowy/AGV Kurogane (maszt z widłami w `+Z`, klatka operatora, kogut `mat_neon_amber`, reflektory `mat_light_white`);<br>3. `wh_overhead_crane` (`16.0 × 2.4 × 3.2 m`, dekoracja sufitowa) — dwudźwigarowa suwnica pomostowa z wózkiem wciągnika (`mat_crane_paint`, `mat_hazard`, `mat_light_white`, `mat_neon_amber`);<br>4. `wh_server_rack` (`1.2 × 2.4 × 1.0 m`, kolizja, blok) — podwójna szafa serwerowa/rozdzielnica z przeszklonymi drzwiami `mat_glass`, ekranem `mat_screen_status` i diodami `mat_neon_blue` / `mat_neon_violet`;<br>5. `wh_workbench_weapons` (`2.4 × 1.5 × 0.9 m`, kolizja, blok) — stół rusznikarski/kalibracyjny: blat `mat_steel_grating`/`mat_metal`, imadło, ramię kalibratora laserowego, nadstawka z narzędziami i lampą warsztatową `mat_light_white`;<br>6. `wh_weapon_case_stack` (`1.6 × 1.1 × 1.2 m`, kolizja, blok) — paleta z płaskimi pancernymi skrzyniami na broń Kurogane (`mat_container_graphite`, okucia `mat_metal`, zamki `mat_hivis`, etykiety `mat_label_barcode` i `mat_label_warning`) — zastępuje powtarzaną zieloną skrzynkę;<br>7. `wh_conveyor_scanner` (`3.6 × 2.2 × 1.4 m`, kolizja, blok) — rolkowy taśmociąg z bramką skanera kontroli jakości/odprawy (`mat_machine`, `mat_hazard`, `mat_neon_green`, `mat_screen_status`);<br>8. `wh_ceiling_lamp` (`1.8 × 0.45 × 0.6 m`, dekoracja sufitowa) — przemysłowa oprawa oświetleniowa (podwójna świetlówka/high-bay z uchwytami do stropu/kratownicy i kloszem `mat_light_white`), dodana też do `WALL_FIXTURES` / sufitowych w `mapAudit.ts`. | `tools/blender/sets/warehouse_kurogane.py`, `src/render/cityModels.ts`, `src/world/mapAudit.ts`, `public/assets/models/city/wh_*.glb`, `src/data/render/mapModelBounds.json` | 8 modeli proceduralnych w Blenderze (≤ 1200 tri każdy) + 2 linie w TS | **Blender przez Codexa/Opusa** (modele) + **Codex** (`cityModels.ts`) |

### 2.2. Priorytet P1 — MOŻE PÓŹNIEJ (po pierwszym wdrożeniu `run1`)

| ID | Co trzeba dodać / zmienić | Gdzie w kodzie / zasobach | Przybliżony zakres | Kto |
|---|---|---|---|---|
| **F-07** | **Kolorowanie (`tint`) i batching decali (`DecalRenderer`) + nowe decale BHP:** (1) dodać opcjonalne pole `tint: hexColor.optional()` do `decalSchema` (`src/world/dressingSchema.ts:122`) i przekazać `color: new Color(def.tint ?? '#ffffff')` do `MeshBasicMaterial` w `src/render/city/decals.ts:22`; (2) wygenerować 3 tekstury BHP w `public/assets/textures/decals/`: `floor_lane_line.webp` (linia korytarza transportowego), `floor_pallet_bay.webp` (koperta odkładcza palety), `floor_sector_k09.webp` (szablon strefy); (3) scalać statyczne decale o tej samej teksturze przez `batchStaticGeometry`. | `src/world/dressingSchema.ts`, `src/render/city/decals.ts`, `tools/textures/` | ~30 linii TS + 3 tekstury `.webp` | **Codex** |
| **F-08** | **Naprawa brakującego wpisu `wall_segment` w `MODEL_FILES`:** `STRETCH_MODELS` w `src/scenes/roomScene.ts:227` zawiera `'wall_segment'`, a `public/assets/models/wall_segment.glb` istnieje na dysku, ale w `MODEL_FILES` (`roomScene.ts:216`) go pominięto. Dopisanie `wall_segment: 'wall_segment'` pozwoli używać profilowanych segmentów ścian z cokołem i gzymsem zamiast gołych prostopadłościanów. | `src/scenes/roomScene.ts:216` | 1 linia TS | **Codex** |
| **F-09** | **Sekwencyjne bramy wewnętrzne (`roomGates`) w pokojach runu:** opcjonalna możliwość zdefiniowania w `roomSchema` 1–2 grodzi wewnętrznych otwieranych po wyczyszczeniu pierwszej fali (`afterWave: 1`), co pozwoliłoby w przyszłości dzielić duże pokoje runu na fazy bez konieczności tworzenia osobnej misji liniowej w `levels`. | `src/world/roomSchema.ts`, `src/scenes/roomScene.ts` | ~60 linii TS | **Codex** |
| **F-10** | **Automatyczny instancing powtarzalnych modeli w `decor[]`:** obecnie `loadDecor` (`src/render/cityModels.ts:55`) klonuje każdy model jako osobny `Mesh`, a `batchStaticGeometry` kopiuje jego wierzchołki. Przepuszczenie powtarzalnych dekoracji (np. ≥ 8 kopii `wh_ceiling_lamp` czy `city_crates` na wyższych półkach) przez `InstancedMesh` zmniejszy zużycie pamięci geometrii. | `src/scenes/roomScene.ts`, `src/render/cityModels.ts` | ~50 linii TS | **Codex** |

---

## 3. Projekt mapy `run1` — MAGAZYN KUROGANE ARMS

### 3.1. Idea i narracja miejsca

- **Co to za miejsce:** Regionalny Węzeł Dystrybucyjny i Kalibracyjny **Kurogane Arms — Sektor K-09** na pograniczu strefy portowej. To tutaj korporacja zbrojeniowa przyjmuje z nocnych pociągów towarowych kontenery z surowymi korpusami broni palnej i ostrzy plazmowych, kalibruje ich elektronarzędzia w przyzakładowym warsztacie, zasila automatyczny system magazynowy z lokalnej podstacji i składuje gotowe partie na wysokich regałach przed wysyłką do oddziałów pacyfikacyjnych.
- **Dlaczego gracz tu jest i co tu się dzieje:** Nocna zmiana została przerwana przez wtargnięcie Rezonanta (gracza) podczas rajdu w głąb sektora Kurogane Arms. Alarm wewnętrzny zablokował główne wrota dokowe, suwnica pomostowa w Hali Wysokiego Składowania zatrzymała się w trybie awaryjnym z podwieszonym kontenerem nad środkową aleją, a w Rozdzielni przeciążona sekcja zasilania bije łukiem elektrycznym. Oddziały ochrony Kurogane bronią dostępu do północnej śluzy wyjściowej (`exit`).
- **Zasada sensu przestrzennego („każdy obiekt ma powód”):**
  - Żadnych losowych śmietników, wraków aut czy straganów z makaronem wewnątrz magazynu.
  - Droga ładunku w budynku opowiada spójną historię: **P1 (Śluza Odpraw i Ochrony)** przyjmuje towar na taśmociągu skanera → **P2 (Rozdzielnia i Serwerownia)** zasila kompleks i przechowuje rejestry logistyczne → **P3 (Warsztat Kalibracji Broni)** testuje i kalibruje partie broni na stołach oraz w kanale laserowym → **P4 (Hala Wysokiego Składowania)** składuje spakowane skrzynie na 6-metrowych regałach i ładuje kontenery suwnicą do północnego doku wysyłkowego.

### 3.2. Układ 4 pomieszczeń — wymiary, współrzędne i rzut z góry (ASCII)

Układ współrzędnych świata:
- `+X` = Wschód (prawo), `-X` = Zachód (lewo)
- `+Z` = Południe (dół), `-Z` = Północ (góra)
- `+Y` = Góra (poziom posadzki głównej: górna powierzchnia bloków podłogi na `y = 0.000`, grubość płyty `1.0 m`, `position.y = -0.5`).
- Całkowity obrys zewnętrzny budynku: `X ∈ [-24, +28]` (`52 m` szerokości), `Z ∈ [-24, +30]` (`54 m` długości). Zewnętrzne ściany obwodowe mają grubość `1.0 m` i leżą tuż za krawędzią podłogi (aby nie zabierać komórek 1×1 m flood-fillu).

| ID strefy | Nazwa pomieszczenia | Zakres X [m] | Zakres Z [m] | Wymiary (szer. × dł.) | Wysokość stropu `H` | Poziomy grywalne (`walkable`) |
|---|---|---|---|---|---|---|
| **P1** | **Śluza Odpraw i Kordon Ochrony** | `-24 .. -6` | `+14 .. +30` | `18 × 16 m` (`288 m²`) | `4.8 m` | Posadzka `y = 0.0 m`; Antresola wartownicza `y = 2.591 m` |
| **P2** | **Rozdzielnia Mocy i Serwerownia** | `-6 .. +12` | `+14 .. +30` | `18 × 16 m` (`288 m²`) | `5.4 m` | Posadzka `y = 0.0 m`; Podest transformatora `y = 1.6 m`; Galeria kablowa `y = 3.2 m` |
| **P3** | **Warsztat Kalibracji i Testów Broni** | `-24 .. -8` | `-8 .. +14` | `16 × 22 m` (`352 m²`) | `5.4 m` | Posadzka `y = 0.0 m`; Pomost obserwacyjno-testowy `y = 3.0 m` (rampa na `y = 3.6 m`) |
| **P4** | **Hala Wysokiego Składowania (Sektor K-09)** | `-8 .. +28` | `-24 .. +14` | `36 × 38 m` (`1 368 m²`) | `12.5 m` (dźwigary `10.0–13.3 m`) | Posadzka `y = 0.0 m`; Doki i podesty regałów `y = 1.8 m`; Antresola Zachodnia i Wschodnia + Most z kontenera suwnicy `y = 3.6 m` |

```text
                       PÓŁNOC (-Z)
      X=-24          X=-8         X=+10              X=+28
Z=-24  +--------------+===========[EXIT]===============+  Z=-24
       | (obrys zew.) #   DOK WYSYŁKOWY (y=0 / +0.4)   #
       |              #  [K40-Navy]      [Wózek AGV]   #
       |              #--------------------------------#
       |              #  A   [Regał R1-N] [Regał R2-N] #  A
       |              #  L   (wys. 6.0m)  (wys. 6.0m)  #  N
       |              #  E                             #  T
       |              #  J ==== MOST SUWNICY (y=3.6) ===  R
       |              #  A    [Kontener 40' zawieszony]#  E
       |              #  |        pod suwnicą y=9.2m   #  S
Z=-8   +------#=======#  Z                             #  O
       |  P3  |Pomost #  A   [Regał R1-S] [Regał R2-S] #  L
       | WAR- |y=3.0m >  C   (wys. 6.0m)  (wys. 6.0m)  #  A
       | SZTAT| (okno)#  H                             #
       | KALI-|       #  .      STREFA KOMISJONOWANIA  #  W
       | BRA- | [Las] #        [Skrzynie]   [Wózek AGV]#  S
       | CJI  |       |  Brama                         #  C
       |      | [Stół]|  P3->P4          P4            #  H
       | (16x | [Stół]| (X=-8,     HALA WYSOKIEGO      # (y=3.6)
       |  22m)|       #  Z=2..7)    SKŁADOWANIA        #
       | H=5.4|       #             (36 x 38 m)        #
Z=+14  +---+  +---#===#========+     +====+   +====#===+  Z=+14
       |   Brama  |Antresola   |Brama|    |Pom|        |
       |   P1->P3 |wartownicza |P2>P4|    |y=3.2       |
       |  (Z=14)  |  y=2.59m   |(y=0)|    +---+--------+
       |          +------------+     |   [Transformator]
       |     P1                #     |    Podest y=1.6m|
       |  ŚLUZA ODPRAW         |Brama|        P2       |
       |  I OCHRONY            |P1>P2|  ROZDZIELNIA    |
       |  (18 x 16 m, H=4.8m)  |(Z=20|  I SERWEROWNIA  |
       | [Skaner]   [Bariery]  |..24)|  [Szafy R1..R4] |
       |       (START)         #     |  [Pole elektr.] |
Z=+30  +========[ENTRY]========+=====+=================+  Z=+30
      X=-24     X=-15         X=-6   X=+1             X=+12
                       POŁUDNIE (+Z)
```

### 3.3. Połączenia, przepływ walki i linie wzroku

1. **Start gracza (`playerSpawn` i `doors[entry]`):**
   - `doors[0]`: `{ id: "entry", role: "entry", position: { x: -15, y: 1.5, z: 30.5 }, size: { x: 4, y: 3, z: 1 } }`.
   - `playerSpawn`: `{ x: -15, y: 0, z: 27 }` — w P1 (Śluza Odpraw), 3 m przed zamkniętą bramą wejściową, za niską osłoną bramki skanera i taśmociągu (`wh_conveyor_scanner` / `city_barrier`), dzięki czemu gracz w pierwszej sekundzie ma osłonę i czytelny kadr na dwa wyjścia:
     - **Na północ (`-Z`):** rozświetlone ciepłą bielą ościeże do **P3 (Warsztatu Kalibracji)** na `X ∈ [-18, -14], Z = 14` (szerokość `4.0 m`, wys. `3.4 m`), ze strzałką `floor_arrow` na posadzce i neonem `warsztat` nad nadprożem.
     - **Na wschód (`+X`):** chłodne, błękitno-fioletowe ościeże do **P2 (Rozdzielni i Serwerowni)** na `X = -6, Z ∈ [20, 24]` (szerokość `4.0 m`, wys. `3.4 m`), z neonem `repair` i wiązkami kabli prowadzącymi pod stropem.
2. **Dwie równorzędne ścieżki natarcia (pętla taktyczna 8-kształtna):**
   - **Ścieżka Zachodnia (przez P3 — dla Ostrza i bliskiego zasięgu / flankowania górą):** P1 → P3 (starcie między stołami rusznikarskimi i bramką laserową `laser_gate`) → wybór: wyjście dolną bramą wózka widłowego (`X = -8, Z ∈ [2, 7]`) wprost między regały Hali P4 **albo** wbiegnięcie po rampie w P3 na pomost testowy (`y = 3.0 m`) i wyjście górnym przejściem (`X = -8, Z ∈ [-6, -3], y = 3.6 m`) na Zachodnią Antresolę Hali P4.
   - **Ścieżka Wschodnia (przez P2 — dla Strzelca i Rezonansu / kontrola linii wzroku):** P1 → P2 (walka w alejkach szaf serwerowych wokół pulsującego `electric_field` i transformatora) → wybór: wyjście dolną bramą (`Z = 14, X ∈ [1, 5]`) do strefy komisjonowania Hali P4 **albo** wejście po rampie na podest transformatora (`y = 1.6 m`) → galerię kablową (`y = 3.2 m`) i wyjście górnym łącznikiem (`Z = 14, X ∈ [8, 11], y = 3.6 m`) na Wschodnią Antresolę Hali P4.
3. **Kulminacja i wyjście (`doors[exit]` w P4):**
   - W Hali P4 obie antresole (Zachodnia na `X ∈ [-8, -5]` i Wschodnia na `X ∈ [+24, +28]`, obie na `y = 3.6 m`) są spięte w poprzek hali **Mostem Suwnicy** (`Z ∈ [-6, -3], X ∈ [-5, +24], y = 3.6 m`) utworzonym przez otwarty kontener/pomost serwisowy podwieszony pod suwnicą pomostową oraz kładki `port_lashing_platform`.
   - Linie wzroku w Hali P4 są złamane w osi Z przez dwie wyspy wysokich regałów (`X ∈ [-1, +3]` oraz `X ∈ [+9, +13]`, sięgające `y = 6.0 m`), dzielące dół hali na 3 równoległe alejki: Zachodnią (`X ∈ [-5, -1]`), Środkową (`X ∈ [+3, +9]`, szeroka na `6 m` pod suwnicą) i Wschodnią (`X ∈ [+13, +24]`), przecięte poprzeczną aleją środkową (`Z ∈ [-7, -2]`). Snajper na antresoli nie widzi jednocześnie całej podłogi, bo zasłaniają go korony regałów (`y = 6.0 m`) oraz zawieszony kontener suwnicy.
   - Wyjście `doors[1]`: `{ id: "exit", role: "exit", position: { x: 10, y: 1.5, z: -24.5 }, size: { x: 4, y: 3, z: 1 } }` w północnym doku wysyłkowym P4, wyraźnie oznaczone zielonym światłem (`#6dff4a`) i cyfrą doku `9` z bloków `neon_green`.

### 3.4. Pion (wielopoziomowość) w każdym pomieszczeniu

Każda powierzchnia podwyższona i każda rampa ma w JSON ustawione `"walkable": true`, a rampy są zorientowane czysto w osi X lub Z (wymóg `ArenaSurfaceNavigation` w `src/world/arenaSurfaceNavigation.ts:186`: zakaz jednoczesnego `rotation.x` i `rotation.z` oraz zakaz `rotation.y` na blokach `walkable`), o nachyleniu `≤ 26°` i szerokości `≥ 2.4 m`:

1. **P1 (Śluza Odpraw, strop `y = 4.8 m`):**
   - **Poziom 0 (`y = 0.0 m`):** główna posadzka śluzy i strefa bramek.
   - **Poziom +1 (`y = 2.591 m`, prześwit pod stropem `2.21 m`):** Antresola Wartownicza zbudowana na dachu kontenera dyżurki ochrony `build_site_office` (`X ∈ [-13, -7], Z ∈ [14.5, 17.0]`, wys. `2.591 m`), z wejściem po stalowych schodach `build_site_office_stairs` od zachodu (`X ∈ [-18.8, -13.0], Z ∈ [14.8, 16.5]`). Z dachu dyżurki gracz ma widok przez okno w ścianie działowej na strefę komisjonowania P4 oraz kontroluje oba przejścia z P1.
2. **P2 (Rozdzielnia i Serwerownia, strop `y = 5.4 m`):**
   - **Poziom 0 (`y = 0.0 m`):** posadzka techniczna z rzędami szaf serwerowych (`X ∈ [-4, +6], Z ∈ [17, 28]`).
   - **Poziom +1 (`y = 1.6 m`):** Podest Transformatorowy przy wschodniej ścianie (`X ∈ [6.5, 11.5], Z ∈ [18, 28]`, materiał `tread_plate` / `steel_grating`), na który prowadzi rampa od południa (`X ∈ [3.0, 6.5], Z ∈ [26.5, 29.0]`, wznios `0 → 1.6 m` na `3.5 m` = `24.6°`).
   - **Poziom +2 (`y = 3.2 m`, prześwit pod stropem `2.2 m`):** Galeria Kablowa wzdłuż ściany wschodniej i północnej (`X ∈ [7.5, 11.5], Z ∈ [14.0, 20.0]`), połączona krótką rampą (`Z ∈ [20.0, 23.5], X ∈ [8.5, 11.5]`, wznios `1.6 → 3.2 m`) z podestem transformatora i wychodząca przez górne ościeże (`Z = 14, X ∈ [8, 11]`) na Wschodnią Antresolę Hali P4 (`y = 3.6 m`).
3. **P3 (Warsztat Kalibracji, strop `y = 5.4 m`):**
   - **Poziom 0 (`y = 0.0 m`):** posadzka warsztatu ze stanowiskami rusznikarskimi i torem kalibracji lasera (`Z ∈ [-7, +13]`).
   - **Poziom +1 (`y = 3.0 m`, prześwit pod stropem `2.4 m`):** Pomost Kalibracyjny i Galeria Obserwacyjna w północno-wschodniej części P3 (`X ∈ [-13, -8], Z ∈ [-8, +4]`, materiał `steel_grating`, barierka `1.1 m`). Wejście po rampie wzdłuż ściany północnej P3 (`X ∈ [-22, -13], Z ∈ [-8.0, -5.2]`, wznios `0 → 3.0 m` na `9.0 m` = `18.4°`). Z pomostu przy `Z ∈ [-6, -3], X = -8` krótka rampa w ościeżu (`wznios 3.0 → 3.6 m`) wyprowadza gracza bezpośrednio na Zachodnią Antresolę Hali P4.
4. **P4 (Hala Wysokiego Składowania, strop `y = 12.5 m`):**
   - **Poziom 0 (`y = 0.0 m`):** główna posadzka hali z 3 alejkami wzdłużnymi, strefą komisjonowania (`Z ∈ [6, 14]`) i dokiem północnym (`Z ∈ [-24, -18]`).
   - **Poziom +0.5 (`y = 1.6 – 1.8 m`):** stosy prefabrykatów/skrzyń (`build_precast_stack` na `y = 1.6 m`) oraz dolne półki regałów (`y = 1.8 m`) i dachy kontenerów 20 ft (`y = 2.591 m`) w doku północnym, służące jako pośrednie stopnie do skoku/dasha.
   - **Poziom +1 (`y = 3.6 m`):** pełny układ pomostów górnych z kratownicy `steel_grating` (`walkable: true`) z barierkami `1.1 m` (z przerwami `3.0 m` na zeskoki i rampy):
     - *Antresola Zachodnia:* `X ∈ [-8, -5], Z ∈ [-18, +6]` (szer. `3.0 m`), z rampą zejściową na północnym końcu (`X ∈ [-8, -5], Z ∈ [-23.5, -18]`, wznios `3.6 → 0.0 m` na `5.5 m`, oraz bezpieczną dwubiegową rampą dla AI `0 → 1.8 → 3.6 m`).
     - *Antresola Wschodnia:* `X ∈ [24, 28], Z ∈ [-18, +14]` (szer. `4.0 m`), połączona od południa z Galerią Kablową P2 i wyposażona w rampę na północy (`X ∈ [24, 28], Z ∈ [-23.5, -18]`).
     - *Most Suwnicy (łącznik poprzeczny na `y = 3.6 m`):* `X ∈ [-5, +24], Z ∈ [-6, -3]` — złożony z dwóch kładek `port_lashing_platform` po bokach oraz zawieszonego na linach suwnicy otwartego kontenera/platformy w środku (`X ∈ [1, 11], y = 3.6 m`), po którym można przebiec nad środkową aleją lub zeskoczyć na korony regałów (`y = 3.8 m`).
   - **Poziom +2 (`y = 9.2 – 11.0 m`, wizualny pion architektoniczny):** szyny podsuwnicowe na słupach hali (`y = 8.8 m`), most suwnicy `wh_overhead_crane` (`y = 9.2 m`), wiązki kabli `city_cable_span` (`y = 8.6 m`) i dźwigary dachowe `port_warehouse_roof_truss` (`y = 10.0 – 13.3 m`).

### 3.5. Rozmieszczenie osłon, zagrożeń (`hazards`) i stref walki (pod Ostrze, Rezonans i Strzelca)

Każde z 4 pomieszczeń wspiera wszystkie trzy ścieżki walki:
- **P1 (Śluza Odpraw — walka na otwarcie):**
  - *Środek pomieszczenia (zero pustej podłogi):* na osi `X = -15, Z = 22` stoi wyspa kontroli ładunków (`wh_conveyor_scanner` lub zestaw `city_kiosk` + `city_crates` + `city_barrier`), a na `X = -11, Z = 24` pancerne skrzynie `wh_weapon_case_stack`.
  - *Dla Ostrza:* wąskie zakosy między taśmociągiem a filarami podtrzymującymi antresolę (`X = -13, Z = 17` i `X = -7, Z = 17`) pozwalają błyskawicznie doskoczyć (`dash`) od osłony do strzelców na antresoli po schodach `build_site_office_stairs`.
  - *Dla Rezonansu:* 3 dynamiczne skrzynie `crate_small` (`0.5 m`, jasny materiał `interactive` `#d9dde3`) na taśmociągu i przy palecie `(X = -17, Z = 23)` gotowe do Chwytu i rzutu, oraz 2 duże zniszczalne skrzynie `crate` (`1.0 m`) jako tymczasowa osłona.
  - *Dla Strzelca:* podwyższona Antresola Wartownicza (`y = 2.591 m`) z parapetami `cover_low` daje czystą linię ostrzału na oba wejścia (do P2 i P3).
- **P2 (Rozdzielnia i Serwerownia — walka pozycyjna z hazardem elektrycznym):**
  - *Środek pomieszczenia:* dwa równoległe rzędy szaf serwerowych `wh_server_rack` (`X = -2, Z ∈ [18, 25]` i `X = +2, Z ∈ [18, 25]`, wys. `2.4 m`) dzielące salę na trzy korytarze o szerokości `2.5–3.0 m`, z poprzecznym przejściem pośrodku (`Z = 21.5`).
  - *Hazard:* `electric_field` (`id: "substation-arc"`, `position: { x: 4.5, y: 0, z: 21.5 }`, `size: { x: 2.4, y: 2.0, z: 3.0 }`, `cycle: { onS: 3.0, offS: 2.5 }`) między wschodnim rzędem serwerów a podestem transformatora (`power_transformer` na `X = 9.0, Y = 1.6, Z = 23.0`).
  - *Dla Rezonansu:* Pchnięcie (`resonance_push`) lub Chwyt pozwala wrzucać szturmowców i tarczowników prosto w aktywne pole elektryczne `substation-arc` albo zrzucać strzelców z Galerii Kablowej (`y = 3.2 m`).
  - *Dla Ostrza:* gęsta siatka szaf serwerowych całkowicie odcina linie strzału snajperów/strzelców, wymuszając walkę w zwarciu na dystansie `< 4 m` i odbijanie pocisków w wąskim przesmyku.
- **P3 (Warsztat Kalibracji — walka wokół wiązki laserowej i wybuchowych ogniw):**
  - *Środek pomieszczenia:* dwa stoły rusznikarskie `wh_workbench_weapons` ustawione w jodełkę (`X = -19, Z = 7` i `X = -13, Z = 5`) oraz centralny kanał testowy broni (`X ∈ [-18, -14], Z ∈ [-3, +1]`) osłonięty po bokach niskimi pancernymi barierami `cover_low` (`wys. 1.1 m`).
  - *Hazardy:*
    1. `laser_gate` (`id: "calibration-beam"`, `from: { x: -18.5, y: 0.8, z: -1.0 }`, `to: { x: -13.5, y: 0.8, z: -1.0 }`, `cycle: { onS: 2.8, offS: 1.8 }`) — przecina poprzecznie środkowy kanał testowy.
    2. `explosive_barrel` (`id: "workshop-cell-1"`, `position: { x: -21.5, y: 0, z: 1.5 }`) przy stanowisku ładowania ogniw plazmowych.
  - *Dla Strzelca i Rezonansu:* strzał w beczkę lub pchnięcie wrogów na wiązkę `calibration-beam`; górny Pomost Kalibracyjny (`y = 3.0 m`) pozwala razić wrogów z góry ponad osłonami `cover_low`.
  - *Dla Ostrza:* przeskakiwanie nad wiązką lasera lub ślizg/dash w oknie `offS: 1.8 s`, wykorzystanie 2 dużych `crate` i 3 `crate_small` przy stołach.
- **P4 (Hala Wysokiego Składowania — wielopoziomowa arena główna):**
  - *Środek pomieszczenia (gęsta zabudowa zamiast pustego placu):*
    - **4 bloki wysokich regałów `wh_pallet_rack`** (wysokość `6.0 m`, szerokość `2.0 m`, długość `12.0 m` każdy):
      - `Regał R1-S`: `X ∈ [-1, +1], Z ∈ [-1, +11]`
      - `Regał R1-N`: `X ∈ [-1, +1], Z ∈ [-19, -7]`
      - `Regał R2-S`: `X ∈ [+11, +13], Z ∈ [-1, +11]`
      - `Regał R2-N`: `X ∈ [+11, +13], Z ∈ [-19, -7]`
    - **Środkowa Aleja Suwnicy (`X ∈ [+1, +11], Z ∈ [-19, +11]`, szerokość `10 m`):** nie jest pustym korytarzem! Na osi stoją naprzemiennie: wózek widłowy `wh_forklift` (`X = 4.5, Z = 7.5`), paleta ze skrzyniami broni `wh_weapon_case_stack` (`X = 7.5, Z = 2.0`), zrzut kontenera `port_container_20_graphite` ustawiony pod kątem / na podeście pod suwnicą (`X = 6.0, Z = -11.5`) oraz betonowe odbojnice `city_barrier` chroniące słupy regałów.
    - **Strefa Komisjonowania (południe P4, `Z ∈ [+11, +14]`):** niskie osłony `cover_low`, `city_crates`, 4 zniszczalne skrzynie `crate` i 4 dynamiczne `crate_small` oraz beczka `explosive_barrel` (`id: "hall-fuel-south"`, `position: { x: 6.0, y: 0, z: 9.5 }`).
    - **Dok Wysyłkowy (północ P4, `Z ∈ [-24, -19]`):** kontener `port_container_40_navy` przy zachodniej części doku (`X = -1.5, Z = -21.5`), wózek `wh_forklift` przy rampie załadunkowej (`X = 16.5, Z = -21.0`), beczka `explosive_barrel` (`id: "hall-fuel-north"`, `position: { x: 14.5, y: 0, z: -18.5 }`) i bariery `city_highway_barrier` osłaniające podejście do drzwi `exit` (`X = 10, Z = -24`).

### 3.6. Oświetlenie i paleta per pomieszczenie (zgodnie z ADR 0006)

**Zasady żelazne:**
- Zero kolorów zarezerwowanych w otoczeniu: brak czerwieni (`#e0262b`, hue `358.4° ± 13°`), cyanu (`#00e5ff`, hue `186.1° ± 13°`) i magenty (`#ff2bd6`, hue `311.6° ± 13°`).
- Wyłącznie dozwolone barwy neonów/świateł z ADR 0006 pkt 1:
  - **Ciepła biel** `#fff1d6` (lampy robocze, świetlówki warsztatowe, reflektory wózków)
  - **Bursztyn** `#ffae1a` (światła ostrzegawcze suwnicy, koguty BHP, strefy zagrożenia, śluza)
  - **Zieleń** `#6dff4a` (oznaczenie aktywnych przejść, skaner QC, dok wyjściowy `exit`)
  - **Błękit królewski** `#3d7bff` (chłodne światło serwerowni, ekrany statusu, strefa ochrony)
  - **Fiolet** `#8a5cff` (rdzeń energetyczny transformatora i rozdzielnicy WN w P2, hologram Kurogane)
- **Zasada montażu:** każde źródło w `lights[]` posiada odpowiadający model oprawy w `decor[]` (`wh_ceiling_lamp` pod stropem/antresolą, `city_sign_box` / `city_ad_screen` na ścianie lub latarnię suwnicy), zaczepiony o strop, ścianę lub słup w tolerancji `mapAudit` (`CONTACT = 0.18 m` / `WALL_MOUNT = 0.65 m`). Każde światło nad podestem ma jawnie wpisane pole `"floorY"`.
- **Budżet i selekcja puli (`maxLights = 8` na `high`, `4` na `medium`):** światła są rozmieszczone tak, że w każdym pomieszczeniu gracz ma w polu widzenia 3–5 głównych źródeł o wysokim `intensity * range`, a ściany działowe naturalnie odcinają frustum kamery od pozostałych pomieszczeń.

| Pomieszczenie | Dominująca paleta powierzchni | Główne źródła światła (`lights[]`) + oprawy (`decor[]`) | Uzasadnienie i klimat |
|---|---|---|---|
| **P1: Śluza Odpraw i Ochrony** | Chłodny beton `quay_concrete` (`#4a5568`), ściany `metal` / `tiles_wall`, granatowy kontener dyżurki `container_navy` (`#283a62`) | 1. Nad taśmociągiem skanera `(-15, 4.35, 22)`: `#fff1d6`, `intensity: 28, range: 13`, oprawa `wh_ceiling_lamp` na stropie `y = 4.8 m`<br>2. Przy bramie wejściowej `(-15, 3.8, 29)`: `#ffae1a` (bursztynowe światło awaryjne śluzy), `intensity: 22, range: 11, flicker: { pattern: "pulse", periodS: 2.0 }`<br>3. Nad antresolą dyżurki `(-10, 4.4, 15.8)`: `#3d7bff`, `intensity: 18, range: 10, floorY: 2.591`, oprawa `wh_ceiling_lamp`<br>4. Przy przejściu do P3 `(-16, 3.6, 14.5)`: `#6dff4a`, `intensity: 16, range: 9` (zielony sygnał otwartego korytarza) | Kontrast bursztynowego alarmu blokady przy wejściu z zimnym błękitem dyżurki ochrony i zielonym światłem prowadzącym wzrok gracza do otwartych przejść. |
| **P2: Rozdzielnia i Serwerownia** | Ciemna posadzka techniczna `power_quay_floor`, ściany `smog_soot_wall` i `metal`, podest `tread_plate` | 1. Dwie lampy w alejkach serwerów `(0, 4.95, 25)` i `(0, 4.95, 18)`: `#3d7bff` (błękit serwerowy), `intensity: 24, range: 12`, oprawy `wh_ceiling_lamp` pod stropem `y = 5.4 m`<br>2. Nad transformatorem i polem elektrycznym `(7.5, 4.8, 22)`: `#8a5cff` (fiolet wyładowań WN), `intensity: 30, range: 13, floorY: 1.6, flicker: { pattern: "buzz", strength: 0.35 }`<br>3. Nad Galerią Kablową `(9.5, 5.0, 15.5)`: `#ffae1a`, `intensity: 20, range: 10, floorY: 3.2`, oprawa `wh_ceiling_lamp` | Najciemniejsze, najbardziej nasycone neonowo wnętrze: błękitne korytarze szaf serwerowych i drżący fiolet przeciążonego transformatora. |
| **P3: Warsztat Kalibracji** | Posadzka `turbine_hall_floor`, ściany z pasem płytek `tiles_wall` i górą `corrugated`, pomost `steel_grating` | 1. Dwie mocne lampy warsztatowe nad stołami rusznikarskimi `(-16, 4.95, 7)` i `(-16, 4.95, -4)`: `#fff1d6` (ciepła biel robocza), `intensity: 34, range: 14`, oprawy `wh_ceiling_lamp`<br>2. Nad bramką lasera kalibracyjnego `(-16, 3.8, -1)`: `#ffae1a` (bursztyn ostrzegawczy), `intensity: 22, range: 10, flicker: { pattern: "pulse", periodS: 1.8 }`<br>3. Nad Pomostem Kalibracyjnym `(-10.5, 5.0, -2)`: `#3d7bff`, `intensity: 18, range: 10, floorY: 3.0`, oprawa `wh_ceiling_lamp` | Kontrast jasnych, ciepłych plam światła roboczego bezpośrednio nad stołami z bronią z ciemnymi narożnikami i bursztynową poświatą komory testowej lasera. |
| **P4: Hala Wysokiego Składowania** | Posadzka `turbine_hall_floor` + `quay_concrete` w doku, ściany `port_warehouse_shell_panel` (`corrugated`), antresole `steel_grating`, regały `metal` + `hivis` | 1. 4 lampy high-bay pod kratownicami dachu wzdłuż alejek: `(-3, 9.8, 4)`, `(-3, 9.8, -13)`, `(18, 9.8, 4)`, `(18, 9.8, -13)`: `#fff1d6`, `intensity: 45, range: 22`, oprawy `wh_ceiling_lamp` przymocowane do spodu `port_warehouse_roof_truss` (`y = 10.0 m`)<br>2. 2 lampy bursztynowe na moście suwnicy `(6, 8.8, -4.5)` i pod zawieszonym kontenerem `(6, 3.4, -4.5)`: `#ffae1a`, `intensity: 32, range: 18`<br>3. 2 lampy pod antresolami `(-6.5, 3.3, -6)` i `(26, 3.3, -6)`: `#fff1d6`, `intensity: 16, range: 10`<br>4. 2 lampy na antresolach `(-6.5, 6.2, -6)` i `(26, 6.2, -6)`: `#3d7bff`, `intensity: 18, range: 11, floorY: 3.6`<br>5. Brama wyjściowa doku `(10, 5.0, -23)`: `#6dff4a` (zieleń ewakuacji/doku 9), `intensity: 30, range: 16` | Wysokie, industrialne światło high-bay wydobywające bryły 6-metrowych regałów, bursztynowy akcent suwnicy w centrum kadru i wyraźny zielony cel wyjścia na północy. |

### 3.7. Lista obiektów per pomieszczenie (modele istniejące i nowe z F-06)

#### Pomieszczenie 1 — Śluza Odpraw i Kordon Ochrony (`18 × 16 m`)
- **Konstrukcja i pion (`blocks[]`):**
  - Płyta podłogi (`18 × 1 × 16 m`, `position: (-15, -0.5, 22)`, `material: "quay_concrete"`).
  - Strop śluzy (`18 × 0.4 × 16 m`, `position: (-15, 5.0, 22)`, `material: "overpass_concrete"`, `ceiling: true`).
  - 2 filary nośne `model: "pillar"` (`1.0 × 4.8 × 1.0 m`, `material: "concrete"`) w `(-13, 2.4, 17.5)` i `(-7, 2.4, 17.5)`.
  - Dyżurka ochrony na antresoli: `model: "build_site_office"` (`6.058 × 2.591 × 2.438 m`, `position: (-10, 1.2955, 15.8)`, `walkable: true` — grywalny dach na `y = 2.591 m`) + schody `model: "build_site_office_stairs"` (`5.871 × 3.691 × 1.68 m`, `position: (-15.9, 1.8455, 15.8)`).
  - Barierki antresoli: `cover_low` (`size: (6.0, 1.0, 0.3)`, `position: (-10, 3.09, 17.1)`, `material: "metal"`).
- **Osłony i wyposażenie (`blocks[]` + `decor[]`):**
  - `wh_conveyor_scanner` (nowy F-06; `3.6 × 2.2 × 1.4 m`) w `(-15, 0, 22.5)` — centralna bramka skanera ładunków przed spawnem gracza.
  - 2× `wh_weapon_case_stack` (nowy F-06; `1.6 × 1.1 × 1.2 m`) w `(-10.5, 0, 24.5)` i `(-19.5, 0, 20.5)`.
  - 2× `city_barrier` (`2.0 × 0.929 × 0.51 m`) jako szykana przed przejściem do P2 w `(-9.5, 0, 21.0)` i `(-9.5, 0, 23.2)`.
  - `city_kiosk` (`0.8 × 2.235 × 0.624 m`) przy ścianie dyżurki `(-12.2, 0, 17.4)` — terminal odprawy celnej.
  - 2× `crate` (`1.0 m`, zniszczalne) w `(-17.5, 0.5, 24.0)` i `(-12.5, 0.5, 20.0)`; 3× `crate_small` (`0.5 m`, dynamiczne) na i obok podajnika.
  - Ścienne (`decor[]`): `city_shutter` nad bramą `entry` `(-15, 0, 29.85, yaw: π)`, 2× `city_ad_screen` z listami przewozowymi na ścianie zachodniej `(-23.85, 1.2, 20, yaw: π/2)` i `(-23.85, 1.2, 25, yaw: π/2)`, 2× `city_pipe_run` w narożnikach, 2× `wh_ceiling_lamp` pod stropem, 2× `city_traffic_cone` (scatter).
  - Szyldy (`signs[]`): neon `warsztat` (`tint: "#6dff4a"`) nad przejściem północnym do P3 `(-16, 3.8, 14.15)`; neon `arrow` (`tint: "#3d7bff"`) nad przejściem wschodnim do P2 `(-6.15, 3.8, 22, yaw: -π/2)`.

#### Pomieszczenie 2 — Rozdzielnia Mocy i Serwerownia Logistyki (`18 × 16 m`)
- **Konstrukcja i pion (`blocks[]`):**
  - Płyta podłogi (`18 × 1 × 16 m`, `position: (3, -0.5, 22)`, `material: "power_quay_floor"`).
  - Strop rozdzielni (`18 × 0.4 × 16 m`, `position: (3, 5.6, 22)`, `material: "overpass_concrete"`, `ceiling: true`).
  - Podest Transformatorowy (`5.0 × 1.6 × 10.0 m`, `position: (9.2, 0.8, 23.0)`, `material: "tread_plate"`, `walkable: true`) + rampa od południa (`3.5 × 0.4 × 2.5 m`, `wznios 0 → 1.6 m`, `material: "tread_plate"`, `walkable: true`).
  - Galeria Kablowa (`4.0 × 0.4 × 6.0 m`, `position: (9.5, 3.0, 17.0)`, `material: "steel_grating"`, `walkable: true`) + rampa z podestu (`1.6 → 3.2 m`) + barierka `metal` (`wys. 1.05 m`).
- **Osłony, maszyny i hazard (`blocks[]` + `decor[]` + `hazards[]`):**
  - `power_transformer` (`6.0 × 5.0 × 4.0 m`, obrócony o 90° wzdłuż Z na podeście `y = 1.6 m` w `(9.2, 1.6, 23.5)` — `decor` + niewidoczny collider `4.0 × 3.8 × 6.0 m` mieszczący się pod stropem `5.4 m`).
  - 6× `wh_server_rack` (nowy F-06; `1.2 × 2.4 × 1.0 m`, `instance: true`) w dwóch rzędach: zachodni `X = -2.0` (`Z = 18.5, 20.0, 24.0`) i środkowy `X = +2.0` (`Z = 18.5, 20.0, 24.0`).
  - 2× `city_generator` (`1.6 × 1.4 × 1.005 m`) jako agregaty UPS przy ścianie południowej `(-1.5, 0, 28.5)` i `(3.5, 0, 28.5)`.
  - Hazard `electric_field` (`id: "substation-arc"`, `position: (4.8, 0, 21.5)`, `size: (2.2, 2.0, 3.0)`, `cycle: { onS: 3.0, offS: 2.5 }`).
  - Ścienne i sufitowe (`decor[]`): 3× `city_cable_span` pod stropem (`y = 5.3 m`) łączące szafy serwerowe ze ścianą zachodnią i transformatorem (oba końce `ends` w blokach ścian/transformatora w tolerancji `< 0.32 m`), 3× `city_pipe_run`, 2× `city_ac_unit` (chłodzenie serwerowni), 2× `city_vent_grate` na posadzce z efektami `ambientFx: [{ kind: "steam" }]` i `sparks` przy łuku elektrycznym, 3× `wh_ceiling_lamp`.
  - Szyldy (`signs[]`): hologram `holo_kurogane` (`kind: "holo"`, `tint: "#8a5cff"`, `size: { w: 2.2, h: 2.2 }`) nad projektorem `city_holo_projector` w `(0, 0, 21.5)` + neon `open` (`tint: "#6dff4a"`) nad przejściem północnym do Hali P4 `(3, 3.8, 14.15)`.

#### Pomieszczenie 3 — Warsztat Kalibracji i Testów Broni (`16 × 22 m`)
- **Konstrukcja i pion (`blocks[]`):**
  - Płyta podłogi (`16 × 1 × 22 m`, `position: (-16, -0.5, 3)`, `material: "turbine_hall_floor"`).
  - Strop warsztatu (`16 × 0.4 × 22 m`, `position: (-16, 5.6, 3)`, `material: "overpass_concrete"`, `ceiling: true`).
  - Pomost Kalibracyjny (`5.0 × 0.4 × 12.0 m`, `position: (-10.5, 2.8, -2.0)`, `material: "steel_grating"`, `walkable: true`, góra na `y = 3.0 m`) wsparty na 3 słupach `build_unfinished_column` (`0.605 × 3.0 × 0.605 m`) + rampa wzdłuż ściany północnej (`X ∈ [-21.5, -13.0], Z ∈ [-7.8, -5.2]`, `wznios 0 → 3.0 m`, `material: "tread_plate"`, `walkable: true`) + rampa w ościeżu wschodnim (`X ∈ [-9.5, -8.0], Z ∈ [-6.0, -3.2]`, `wznios 3.0 → 3.6 m` na Antresolę Zachodnią P4).
  - Pancerne okno obserwacyjne w ścianie działowej między P3 a P4 (`X = -8.0, Z ∈ [-2.0, +2.0], Y ∈ [3.2, 5.0]`, `size: (0.25, 1.8, 4.0)`, `material: "glass"`).
- **Osłony, stanowiska i hazardy (`blocks[]` + `decor[]` + `hazards[]`):**
  - 3× `wh_workbench_weapons` (nowy F-06; `2.4 × 1.5 × 0.9 m`) w `(-19.5, 0, 8.5)`, `(-12.5, 0, 8.5)` oraz na pomoście górnym `(-10.5, 3.0, 1.5)`.
  - 2× `wh_weapon_case_stack` (`1.6 × 1.1 × 1.2 m`) przy ścianie zachodniej `(-22.2, 0, 4.5)` i `(-22.2, 0, -2.5)`.
  - Komora kalibracji wiązki w środku sali (`Z ∈ [-3.0, +1.5]`): 2 boczne osłony `cover_low` (`size: (0.6, 1.1, 4.0)`, `material: "metal"`) w `(-18.8, 0.55, -1.0)` i `(-13.2, 0.55, -1.0)` + hazard `laser_gate` (`id: "calibration-beam"`, `from: (-18.5, 0.8, -1.0)`, `to: (-13.5, 0.8, -1.0)`, `cycle: { onS: 2.8, offS: 1.8 }`) + 2 słupki emiterów `material: "hazard"` (`0.4 × 1.4 × 0.4 m`).
  - Hazard `explosive_barrel` (`id: "workshop-cell-1"`, `position: (-21.5, 0, 1.5)`).
  - `city_smog_scrubber` (`3.0 × 4.0 × 3.0 m`) w południowo-zachodnim narożniku `(-22.0, 0, 12.0)` — odciąg oparów plazmowych z rurami `city_pipe_run`.
  - 2× `crate` (`1.0 m`) i 3× `crate_small` (`0.5 m`) przy stołach rusznikarskich.
  - Ścienne i sufitowe (`decor[]`): 3× `wh_ceiling_lamp`, `city_ad_screen` (schematy kalibracji ostrzy), `city_shutter` podniesiona nad bramą towarową do P4 (`X = -8.0, Y = 3.6, Z = 4.5`), `ambientFx` (`sparks` przy głowicy lasera, `steam` przy odciągu).

#### Pomieszczenie 4 — Hala Wysokiego Składowania (`36 × 38 m`, wysokość `12.5 m`)
- **Konstrukcja hali i pion (`blocks[]` + `decor[]`):**
  - Płyta podłogi hali (`36 × 1 × 30 m`, `Z ∈ [-16, +14]`, `material: "turbine_hall_floor"`) oraz płyta doku wysyłkowego (`36 × 1 × 8 m`, `Z ∈ [-24, -16]`, `material: "quay_concrete"`).
  - Obudowa ścian zewnętrznych wschodniej (`X = 28`) i północnej (`Z = -24`): moduły `port_warehouse_shell_panel` co `6.0 m` (`decor[]` + kolidery ścian `corrugated` do `y = 10.0 m` i pas górny `10.0–13.3 m`).
  - Konstrukcja dachu: 6 dźwigarów kratownicowych `port_warehouse_roof_truss` (`30.0 × 3.3 × 6.0 m`) rozpiętych na `y = 10.0 m` co `6.0 m` (`Z = -21, -15, -9, -3, +3, +9`) wspartych na słupach `city_overpass_pillar` (`2.5 × 10.0 × 2.513 m`) przy ścianach bocznych + płyta dachu `material: "roof_tar"` na `y = 13.3–13.8 m` (`ceiling: true`).
  - **Antresola Zachodnia (`y = 3.6 m`):** płyta `3.0 × 0.4 × 24.0 m` (`X ∈ [-8, -5], Z ∈ [-18, +6]`, `material: "steel_grating"`, `walkable: true`) z rampą północną (`Z ∈ [-23.5, -18]`) i połączeniem z P3.
  - **Antresola Wschodnia (`y = 3.6 m`):** płyta `4.0 × 0.4 × 32.0 m` (`X ∈ [24, 28], Z ∈ [-18, +14]`, `material: "steel_grating"`, `walkable: true`) z rampą północną (`Z ∈ [-23.5, -18]`) i połączeniem z Galerią Kablową P2 (`Z = 14`).
  - **Suwnica Pomostowa i Most Powietrzny (`y = 9.2 m` oraz `y = 3.6 m`):**
    - Pod stropem na `y = 9.2 m`: model `wh_overhead_crane` (nowy F-06; `16.0 × 2.4 × 3.2 m`) oparty na belkach podsuwnicowych wzdłuż osi Z.
    - Zawieszony na 4 stalowych linach (`blocks` o `size: (0.15, 5.6, 0.15)`, `material: "metal"`) nad środkiem hali na wysokości `y = 3.6 m`: pomost kontenerowy (`X ∈ [1, 11], Z ∈ [-6.0, -3.0]`, `walkable: true`) połączony z Antresolą Zachodnią i Wschodnią dwiema kładkami `port_lashing_platform` (`6.0 × 1.24 × 1.37 m`, `walkable: true`).
- **Regały wysokiego składowania i wyposażenie hali (`blocks[]` + `decor[]`):**
  - 12 modułów `wh_pallet_rack` (nowy F-06; `4.0 × 6.0 × 1.4 m`, `instance: true`) zgrupowanych w 4 wysokie bloki regałowe (`R1-S`, `R1-N`, `R2-S`, `R2-N`), każdy z pełnym koliderem oraz dodatkowymi paletami `wh_weapon_case_stack` i `city_crates` na półkach `y = 1.8 m` i `y = 3.8 m`.
  - 3× `wh_forklift` (nowy F-06; `2.8 × 2.1 × 1.2 m`) — wózki widłowe w alejkach: `(4.5, 0, 7.5, yaw: 0)`, `(18.0, 0, -2.0, yaw: π/2)` oraz przy doku północnym `(16.5, 0, -21.0, yaw: -π/4)`.
  - Stosy kontenerów Kurogane Arms (z `instance: true`):
    - Wschodnia zatoka składowa (`X ∈ [18, 23]`): `port_container_20_graphite` (`y = 0`) + `port_container_20_ochre` (`y = 2.591 m`) w `(20.5, 0, 7.5)` oraz `port_container_20_navy` w `(20.5, 0, -13.0)`.
    - Dok północny (`Z ∈ [-23, -19]`): `port_container_40_navy` w `(-1.5, 0, -21.5)`.
    - Środkowa aleja pod suwnicą: `port_container_20_olive` w `(6.0, 0, -12.5)` (gotowy do podniesienia).
  - Osłony niskie i średnie w alejkach: 4× `wh_weapon_case_stack`, 4× `city_crates`, 4× `city_barrier`, 2× `city_highway_barrier`, `build_precast_stack` (`6.0 × 1.6 × 2.406 m`, `walkable: true` w `(18.5, 0, -6.5)` — stopień pozwalający wskoczyć na Antresolę Wschodnią z poziomu posadzki!), 6× `crate` (`1.0 m`, zniszczalne) i 5× `crate_small` (`0.5 m`, dynamiczne).
  - Hazardy w P4: 2× `explosive_barrel` (`hall-fuel-south` w `(6.0, 0, 9.5)` i `hall-fuel-north` w `(14.5, 0, -18.5)`).
  - Oznakowanie i oprawa (`signs[]`, `decor[]`, `ambientFx[]`):
    - Wielka cyfra `9` nad wrotami `exit` (`(10, 5.2, -23.8)`, złożona z bloków `neon_green`), neony `arrow` wskazujące alejki `A-01` i `A-02` na szczytach regałów (`y = 4.2 m`, `tint: "#ffae1a"` i `"#6dff4a"`).
    - 8× `wh_ceiling_lamp` pod kratownicami dachu i antresolami, 4× `port_bollard` przy bramach dokowych, 4× `city_traffic_cone` i 2× `city_trash_bags` (scatter).

### 3.8. Detale podłogi (`decals` i podziały materiałowe)

Aby wyeliminować problem „pustej, jednolitej podłogi bez skali”:
1. **Podział architektoniczny płyt podłogi (szwy na liczbach całkowitych, górna powierzchnia dokładnie na `y = 0`):**
   - P1: `quay_concrete` z poprzecznym pasem `hazard` (`szer. 0.5 m` w płaszczyźnie posadzki `y = -0.5..0.0`) przy progu bramy `entry` oraz wokół skanera.
   - P2: `power_quay_floor` w strefie szaf serwerowych + obramowanie `hazard_stripes_worn` wokół strefy `electric_field`.
   - P3: `turbine_hall_floor` + wpuszczone w posadzkę szyny kanału kalibracyjnego (`material: "steel_grating"`, `X ∈ [-18.5, -13.5], Z ∈ [-1.5, -0.5], Y ∈ [-0.5, 0.0]`).
   - P4: `turbine_hall_floor` pod regałami, pasy `concrete` wyznaczające główną aleję transportową pod suwnicą (`X ∈ [2, 10]`) oraz `quay_concrete` z `quay_lines` w północnym doku załadunkowym (`Z ∈ [-24, -16]`).
2. **Rozmieszczenie 26 naklejek podłogowych i ściennych (`decals[]`):**
   - *Ścieżki wózków i kierunki ruchu:* 6× `floor_arrow` (`size: { w: 2.4, h: 2.4 }`) na osiach bram między P1→P3, P1→P2, P3→P4, P2→P4 oraz wzdłuż Środkowej Alei Suwnicy ku dokowi `exit`.
   - *Strefy ostrzegawcze BHP:* 6× `floor_hazard` (`size: { w: 4.0, h: 0.6 }`) przed bramką lasera w P3, wokół pola elektrycznego w P2, pod strefą zrzutu suwnicy w P4 `(6, -4.5)` oraz przy progu doku północnego `(10, -19)`.
   - *Linie zatrzymania wózków:* 3× `floor_stop` (`size: { w: 3.0, h: 1.0 }`) przed wyjazdem z P3 do Hali P4 `(-9.5, 4.5)` oraz przed wrotami `exit` `(10, -21.5)`.
   - *Ślady eksploatacji przemysłowej:* 4× `tire_marks` (ślady opon wózków widłowych na zakrętach z P3 do P4 i przy doku), 4× `oil_stain` (pod wózkami `wh_forklift`, przy prasie/stole w P3 i pod transformatorem w P2), 2× `manhole` (studzienki odwadniające w P1 i P4), 2× `crack_floor` i 2× `leak_streak` na ścianach pod rurami `city_pipe_run`.

### 3.9. Dźwięk i atmosfera (`weather` i `ambientFx`)

- **Profil pogody i atmosfery:** `"weather": "indoorIndustrial"` (z fundamentu **F-03**; do czasu jego wdrożenia tymczasowo `"weather": "clearNight"` + pełny `rainShelters` obejmujący cały budynek `position: (2, 7, 3), size: (56, 16, 58)`).
- **Brak deszczu wewnątrz:** 100% kubatury 4 pomieszczeń jest objęte `rainShelters`, zero smug deszczu i zero rozbryzgów na posadzce.
- **Cząsteczki środowiskowe (`ambientFx[]`):**
  - `steam` (para z zaworów i kratek wentylacyjnych): 2× w P2 przy chłodzeniu transformatora `(6.5, 0.1, 20)` i `(6.5, 0.1, 26)`, 1× w P3 przy płuczce `city_smog_scrubber` `(-20.5, 0.1, 11.5)`, 3× w P4 przy kratkach odwadniających doku `(-4, 0.1, -20)`, `(18, 0.1, -20)` i `(6, 0.1, 2)`.
  - `sparks` (iskry): 1× w P2 nad uszkodzoną rozdzielnicą `(4.8, 2.2, 21.5, rate: 1.2)`, 1× w P3 przy głowicy lasera `(-18.5, 1.4, -1.0, rate: 0.8)`, 1× w P4 przy szynie suwnicy `(1, 8.8, -4.5, rate: 0.7)`.
  - `drip` (skraplanie z rur chłodniczych pod stropem): 1× w P2 `(1.5, 5.2, 27)` i 2× w P4 `(-6, 8.5, -12)`, `(22, 8.5, 4)`.
- **Pejzaż dźwiękowy (`ambience`):** niskie, ciągłe buczenie transformatora i wentylacji hali (`kind: "generator"`, `gain: 0.14`), bez szumu ulewy i bez wycia wiatru.

### 3.10. Punkty spawnu wrogów (`spawnPoints`) i konfiguracja `director`

Mapa zawiera **14 punktów spawnu (`spawnPoints`)** rozmieszczonych we wszystkich 4 pomieszczeniach. Każdy punkt leży na podłodze `y = 0`, ma wokół siebie pełną wolną komórkę `1 × 1 m` (`floor(x), floor(z)`), znajduje się w odległości `> 1.5 m` od każdego `hazard` (`roomSchema.ts:413–443`) i jest w 100% osiągalny flood-fillem od `playerSpawn (-15, 0, 27)`:

| Nr | Współrzędne `{ x, z }` | Pomieszczenie | Rola taktyczna przy spawnie |
|---:|---|---|---|
| 1 | `{ "x": -19, "z": 18 }` | **P1** (Śluza — lewa flanka przed schodami) | Szturmowiec/strzelec broniący wejścia na schody antresoli dyżurki |
| 2 | `{ "x": -9, "z": 19 }` | **P1** (Śluza — przed przejściem do P2) | Strażnik blokujący szykanę do Rozdzielni |
| 3 | `{ "x": 0, "z": 26 }` | **P2** (Rozdzielnia — alejka południowa) | Strzelec między rzędami szaf serwerowych |
| 4 | `{ "x": 0, "z": 17 }` | **P2** (Rozdzielnia — przy bramie do P4) | Tarczownik/haker kontrolujący wyjście z serwerowni do Hali |
| 5 | `{ "x": -20, "z": 10 }` | **P3** (Warsztat — za pierwszym stołem) | Szturmowiec nacierający przez północne ościeże z P3 na P1 |
| 6 | `{ "x": -15, "z": 3 }` | **P3** (Warsztat — przed kanałem lasera) | Strzelec za osłoną `cover_low` przed wiązką kalibracyjną |
| 7 | `{ "x": -16, "z": -5 }` | **P3** (Warsztat — północ, przy rampie) | Wróg wbiegający po rampie na Pomost Kalibracyjny (`y = 3.0 m`) |
| 8 | `{ "x": -3, "z": 9 }` | **P4** (Hala — Aleja Zachodnia, południe) | Flanka przy bramie towarowej P3→P4 |
| 9 | `{ "x": 6, "z": 6 }` | **P4** (Hala — Strefa Komisjonowania) | Główna grupa w centrum południowym przed Środkową Aleją |
| 10 | `{ "x": 16, "z": 8 }` | **P4** (Hala — Aleja Wschodnia, południe) | Strzelec/tarczownik naprzeciw wyjścia z P2 |
| 11 | `{ "x": -3, "z": -5 }` | **P4** (Hala — skrzyżowanie pod Mostem Suwnicy) | Zwarcie w cieniu zawieszonego kontenera |
| 12 | `{ "x": 17, "z": -5 }` | **P4** (Hala — Aleja Wschodnia, środek) | Wsparcie obok stopnia `build_precast_stack` |
| 13 | `{ "x": 5, "z": -16 }` | **P4** (Hala — wyjście ze Środkowej Alei na dok) | Druga fala broniąca podejścia do doku północnego |
| 14 | `{ "x": 19, "z": -20 }` | **P4** (Hala — Dok Wysyłkowy, wschód) | Odwód przy wózku widłowym i drzwiach `exit` |

Parametry walki pokoju: `"maxAlive": 10`, `"minSpawnDistance": 10`, `"director"`: `{ "attackTokens": 3, "shotTokens": 2, "maxHoldS": 4, "reassignS": 1, "probeHeightM": 0.5, "slots": { "melee": { "count": 8, "offsetDeg": 0 }, "shot": { "count": 6, "offsetDeg": 30 } } }`.

### 3.11. Pułapki na typowe bugi i jak ich uniknąć

1. **Pułapka 1 — Bitowa równość wysokości podłogi (`validateLayout` w `roomSchema.ts:368`):**
   - *Bug:* `block.position.y + block.size.y / 2 === groundY` używa operatora `===` bez tolerancji zmiennoprzecinkowej. Jeśli płyta ma `position.y: -0.3, size.y: 0.6`, w IEEE-754 `-0.3 + 0.6 / 2` może dać `0`, ale przy innych ułamkach (`-0.35 + 0.7 / 2`) powstaje błąd zaokrąglenia i płyta przestaje być podłogą!
   - *Jak uniknąć:* wszystkie płyty podłogi na poziomie `y = 0` muszą mieć całkowite lub połówkowe wymiary Y: `size.y = 1, position.y = -0.5`.
2. **Pułapka 2 — Krawędzie komórek 1×1 m na szwach płyt podłogi (`roomSchema.ts:469–471`):**
   - *Bug:* funkcja `walkable(x, z)` w `validateLayout` wymaga, by **cała** komórka `[x, x+1] × [z, z+1]` mieściła się wewnątrz **jednego** bloku podłogi (`floors.some(floor => contains(floor, x, z) && contains(floor, x + 1, z + 1))`). Jeśli krawędź między płytą P1 i P3 wypadnie na ułamku (np. `Z = 14.5`), cały rząd komórek `[14, 15]` stanie się nieprzejezdny dla flood-fillu i rzuci błąd `Punkt spawnu nieosiągalny od playerSpawn na siatce 1 m`!
   - *Jak uniknąć:* wszystkie granice płyt podłogi (`minX, maxX, minZ, maxZ`) muszą leżeć wyłącznie na **liczbach całkowitych** (`X = -24, -8, -6, +12, +28`, `Z = -24, -16, -8, +14, +30`), a przejścia w ścianach działowych muszą obejmować co najmniej dwie pełne komórki całkowite (np. `X ∈ [-18, -14]`, `Z ∈ [20, 24]`).
3. **Pułapka 3 — Obrócone o 90° modele niesymetryczne (`roomSchema.ts:258` vs `roomBlockModelFit.test.ts`):**
   - *Bug:* `footprint(block)` w `roomSchema.ts:258` ignoruje `block.rotation` i liczy AABB z niezrotowanego `size.x` i `size.z`, podczas gdy `roomBlockModelFit.test.ts` wymaga, by blok z `model: "port_container_20_*"` miał `size` w osiach modelu (`6.058 × 2.591 × 2.438`).
   - *Jak uniknąć:* każdy model o `size.x ≠ size.z` obrócony o 90° (`yaw = ±π/2`) wstawiamy jako `decor` (z `yaw`) + osobny blok kolizji z `visible: false` (bez pola `model`) o zamienionych wymiarach `size.x` i `size.z` (dokładnie tak jak robi `_runKit.mjs:204–210`).
4. **Pułapka 4 — Prześwit pod stropem i suwnicą dla `ArenaSurfaceNavigation` (`arenaSurfaceNavigation.ts:158–171`):**
   - *Bug:* jeśli nad pomostem `walkable: true` (`y = 3.6 m`) wisi dekoracja z koliderem lub blok stropu niżej niż `y + navigationHeadroomM` (`3.6 + 2.0 = 5.6 m`), `ArenaSurfaceNavigation` wytnie komórki pomostu jako zablokowane (`obstructed`).
   - *Jak uniknąć:* nad każdym podestem `walkable: true` zachowujemy wolny prześwit koliderów `≥ 2.2 m` (w P1: `4.8 - 2.591 = 2.209 m`; w P2: `5.4 - 3.2 = 2.2 m`; w P3: `5.4 - 3.0 = 2.4 m`; w P4: `10.0 - 3.6 = 6.4 m`).
5. **Pułapka 5 — Wiszące kable i oprawy ścienne w `mapAudit.ts` (`floatingObject`):**
   - *Bug:* `city_cable_span` ma końce w lokalnych punktach `[-5, -0.06, -0.19]` i `[+5, 0, -0.205]` (skalowanych przez `scale`). Jeśli środek kabla zostanie ustawiony tak, że po przeskalowaniu koniec wypada `> 0.32 m` (`ANCHOR`) od lica ściany/słupa, `mapAudit` zgłasza `floatingObject: bez zaczepienia 1/2 końców`.
   - *Jak uniknąć:* dla każdego `city_cable_span` o rozpiętości `L` ustawiamy `scale = L / 10` tak, by punkty `position ± (L/2)` wchodziły na `0.05–0.15 m` w głąb bryły ściany lub słupa.
6. **Pułapka 6 — Wnikanie obwiedni (`overlap` w `mapAudit.ts:521–535`):**
   - *Bug:* postawienie dekoracji (np. `city_street_lamp` lub `wh_weapon_case_stack`) tak, że jej środek znajduje się wewnątrz AABB innego bloku (np. półki regału o dużej grubości), wywołuje `warn · overlap`.
   - *Jak uniknąć:* półki regałów mają cienkie płyty kolizji (`0.2 m`), a ładunki na półkach stoją z podstawą dokładnie na górnej powierzchni płyty (`y = top_półki`), tak że ich środek leży powyżej `peer.box.max.y`.

---

## 4. Kryteria akceptacji (sprawdzalne w `mapAudit` i na zrzutach)

Mapa `run1` zostaje uznana za ukończoną wyłącznie wtedy, gdy spełnia wszystkie poniższe mierzalne kryteria:

### 4.1. Kryteria automatyczne (CLI i testy)

1. **Zero błędów i zero ostrzeżeń w `mapAudit`:**
   - Polecenie `node tools/levels/mapAudit.mjs run1` zwraca dokładny wynik: **`run1: 0 error, 0 warn`** (w `tests/unit/mapAudit.baseline.json` wpis `"run1": 0`).
   - Szczegółowo: `0` zgłoszeń `noCollisionLargeProp`, `0` `floatingObject`, `0` `outOfBounds`, `0` `overlap`, `0` `forbiddenColor`, `0` `emptyRoom`.
2. **Walidacja schematu, dopasowania modeli i osiągalności:**
   - `npm run check` (`tsc --noEmit`, `eslint`, `vitest`) przechodzi na zielono, w tym:
     - `tests/unit/rooms.test.ts` (walidacja `roomSchema`, flood-fill 1×1 m od `playerSpawn` do wszystkich 14 `spawnPoints`, unikalność `id`, obecność w `kurogane.json`),
     - `tests/unit/roomBlockModelFit.test.ts` (każdy blok z polem `model` ma wymiary zgodne z AABB pliku `.glb` w tolerancji `±5%`),
     - `tests/unit/mapAudit.test.ts`.
3. **Generacja 10 zrzutów audytu bez błędów renderu:**
   - Polecenie `node tools/screens/mapAudit.mjs run1 --tag after` generuje komplet 10 plików PNG (`01-spawn.png` .. `10-top.png`, `1280 × 720`) bez żadnego `pageerror`, `console.error` ani błędu HTTP 404 dla `.glb`/`.webp`.
4. **Wydajność renderu (budżet ADR 0011 D8):**
   - W każdym z widoków kontrolnych na jakości `medium` (`1920 × 1080`) `window.__neoryder.query('renderInfo').calls <= 800` (dzięki `arena.spawnRing`, `batchStaticGeometry` z budżetem `60 000` trójkątów i `instance: true` na regałach, szafach serwerowych i kontenerach).

### 4.2. Kryteria wizualne i kompozycyjne (sprawdzalne na zrzutach PNG i w `?scene=map-walk&map=run1`)

1. **Pokrycie podłogi i wypełnienie środka pomieszczeń:**
   - Na żadnym z 7 poziomych ujęć kamery audytu (`01-spawn`, `02-north`, `03-east`, `04-south`, `05-west`, `06-corner-nw`, `07-corner-se`) pusta, nieprzełamana płaszczyzna podłogi (bez obiektów, osłon, zmian materiału lub decali BHP) **nie może zajmować więcej niż 25% powierzchni kadru**.
   - W każdym z 4 pomieszczeń w promieniu `4 m` od geometrycznego środka pomieszczenia znajduje się co najmniej jedna wyspa osłon lub struktura pionowa (P1: bramka skanera z podajnikiem; P2: dwa rzędy szaf serwerowych i pole elektryczne; P3: komora kalibracji lasera i stoły rusznikarskie; P4: 4 bloki wysokich regałów, wózki widłowe i zawieszony kontener pod suwnicą).
2. **Pion i wielopoziomowość:**
   - Każde z 4 pomieszczeń posiada **co najmniej 2 grywalne poziomy wysokości (`walkable: true`)** dostępne dla gracza bez użycia cheatów (P1: `0.0 m` i `2.591 m`; P2: `0.0 m`, `1.6 m` i `3.2 m`; P3: `0.0 m` i `3.0 m`; P4: `0.0 m`, `1.6–2.59 m` i `3.6 m`), a w Hali P4 dodatkowo 3. warstwę wizualną pod stropem (`suwnica 9.2 m` i `dźwigary 10.0–13.3 m`).
   - Górne pomosty łączą ze sobą co najmniej 3 pomieszczenia (P2 ↔ P4 ↔ P3 przez Most Suwnicy na `y = 3.6 m`), tworząc pełną pętlę ruchu nad posadzką.
3. **Tożsamość i zróżnicowanie 4 pomieszczeń (test „rozpoznania w 1 sekundę”):**
   - Każde z 4 pomieszczeń ma inną wysokość stropu (`4.8 m`, `5.4 m`, `5.4 m`, `12.5 m`), inny główny materiał posadzki (`quay_concrete`, `power_quay_floor`, `turbine_hall_floor` z kanałem `steel_grating`, `turbine_hall_floor` + dok), inną dominującą barwę oświetlenia (`bursztyn + błękit` w P1, `błękit + fiolet` w P2, `ciepła biel + bursztyn` w P3, `ciepła biel high-bay + bursztyn suwnicy + zieleń doku` w P4) oraz unikalny zestaw modeli specjalistycznych (`wh_conveyor_scanner`, `wh_server_rack` + `power_transformer`, `wh_workbench_weapons` + `laser_gate`, `wh_pallet_rack` + `wh_overhead_crane` + `wh_forklift`).
4. **Fizyczne zakotwiczenie oświetlenia i instalacji:**
   - **100% punktów w `lights[]`** pokrywa się z widoczną oprawą (`wh_ceiling_lamp`, ekranem, sygnalizatorem suwnicy lub neonem) zamocowaną do stropu, dźwigara, ściany lub słupa. Żadne światło nie świeci z pustego powietrza.
   - **100% plam światła (`groundGlow`)** nad podestami leży na powierzchni właściwego podestu (`floorY`), a nie pod nim.
5. **Szczelność wnętrza i czytelność ujęcia `10-top.png`:**
   - W widoku FPP (`01-spawn` .. `07-corner-se`) nad każdym pomieszczeniem widoczny jest zamknięty strop/konstrukcja dachu, wewnątrz nie pada deszcz i nie przebijają budynki `Panorama`.
   - Na ujęciu `10-top.png` (dzięki fundamentowi **F-04**) płyty sufitowe są ukryte dla kamery zewnętrznej, odsłaniając pełny rzut wszystkich 4 pomieszczeń, ścian działowych, regałów i pomostów.

---

## 5. Poprawki Opusa (przegląd 24 XI) — WIĄŻĄ, mają pierwszeństwo przed sekcjami 1–4

Twierdzenia o silniku z sekcji 1 zweryfikowane w kodzie (nawigacja tylko w conquest/assault/heist, brak `wall_segment` w `MODEL_FILES`, niepodpięte `tread_plate`/`tiles_wall`, `lightSpotFloors` tylko dla `p.y < floorY`, brak profilu pogody dla wnętrz). Wykonawca nadal sprawdza każdy punkt w kodzie przed zmianą. Poprawki projektu:

1. **Galeria P2 → hala.** Galeria kablowa P2 wychodzi na `Z = 14, X ∈ [8, 11]`, a Antresola Wschodnia leży na `X ∈ [24, 28]` — w projekcie nic ich nie łączy. Poprawka: Antresola Wschodnia ma kształt L: odcinek południowy `X ∈ [8, 28], Z ∈ [10, 14], y = 3.6` (nad Strefą Komisjonowania, która dzięki temu dostaje niski „sufit” i cień) + odcinek wschodni `X ∈ [24, 28], Z ∈ [-18, 10]`. Przejście P2→hala górą: rampa/stopień `3.2 → 3.6 m` w ościeżu.
2. **Korony regałów nie są grywalne.** Regały mają 6.0 m; zdanie o zeskoku na korony `y = 3.8` usunąć. Most w poprzek hali biegnie wyłącznie wolną aleją poprzeczną `Z ∈ [-7, -2]`.
3. **Most w poprzek hali = stały pomost serwisowy** (`steel_grating`, barierki, wsporniki/podwieszenie do kratownic dachu widoczne), nie chodzenie po wiszącym kontenerze. Kontener w trybie awaryjnym wisi na linach wciągnika nad Środkową Aleją na wys. spodu ~5.5 m (na północ od mostu, np. `Z ≈ -12`), z kolizją — wizualny punkt orientacyjny i zasłona linii wzroku snajpera, oświetlony bursztynem. Liny zaczepione o wózek suwnicy.
4. **Transformator a strop P2.** `power_transformer` ma 5.0 m wysokości; na podeście 1.6 m przebija strop 5.4 m. Poprawka: transformator stoi na posadzce `y = 0` za siatką/barierą w zachodniej części podestu albo strop P2 = 7.0 m (wtedy P2 ma najwyższy strop z małych pomieszczeń — też dobre dla tożsamości). Twarda reguła: **żaden model nie przebija stropu ani ściany**.
5. **Prześwit P1.** Strop P1 podnieść do 5.2 m (antresola 2.591 m ⇒ prześwit 2.6 m; 2.21 m to za mało dla kapsuły gracza i skoku).
6. **Wymiary regałów.** Moduł `wh_pallet_rack` ma głębokość 1.2 m; blok regałowy = dwa moduły plecami (`2.4 m`), więc wyspy regałów `X ∈ [-1.2, 1.2]` i `[10.8, 13.2]`. Dane kolizji muszą się zgadzać z AABB modeli (test `roomBlockModelFit`).
7. **Okno z antresoli P1** patrzy na P3 (P1 graniczy z P4 tylko na `X ∈ [-8, -6]`) — przenieść logikę: okno w ścianie P1/P3 albo zrezygnować.
8. **Bez rekwizytów ulicznych w środku.** Usunąć `city_kiosk`, `city_trash_bags`, `city_dumpster`, `city_ad_screen` (zamiast reklam: ekrany statusu/listy przewozowe jako nowy model `wh_wall_terminal`). Hologram `holo_kurogane` najwyżej 1 raz na całą mapę (recepcja/śluza P1), nie w serwerowni. `city_traffic_cone` dozwolone tylko w doku. Szyldy z tekstem pasującym do miejsca (nie „repair”/„open” przypadkowo) — jeśli brakuje tekstur, dopisać do F-07.
9. **Konstrukcja hali ze stali, nie z wiaduktu.** Zamiast `city_overpass_pillar` — nowe modele `wh_hall_column` (słup dwuteowy z konsolą podsuwnicową) i `wh_crane_rail` (belka podsuwnicowa). Ściany małych pomieszczeń: `wall_segment` (cokół, gzyms) z materiałami wnętrz, nie gołe prostopadłościany.
10. **Ościeża przejść** mają widoczną ramę/nadproże (`trim`/`hazard` na krawędziach, częściowo podniesiona roleta `city_shutter` tam, gdzie to brama towarowa), żeby gracz widział, że to przejście, a nie dziura w ścianie.
11. **Priorytety:** F-07 (decale BHP + `tint`) i F-08 (`wall_segment`) przechodzą do **P0** — pusta podłoga to problem nr 1 z poprzedniego audytu. F-09 (bramy wewnętrzne) i F-10 zostają w P1.
12. **Spawny a pomieszczenia (F-01).** Fale nie mogą pojawiać się za dwiema ścianami 40 m od gracza ani w polu widzenia gracza. Wybór spawnu: odległość ścieżki z `ArenaNavigation` w przedziale (`minSpawnDistance`, ~22 m), preferowane to samo lub sąsiednie pomieszczenie. Test jednostkowy.
13. **Mapa poza pulą runu do akceptacji.** `run1` widoczna w „Testy map” i `?scene=room-test&room=run1`; do `roomPools` w `kurogane.json` trafia dopiero po ocenie ≥ 7/10.

### 5.1. Etapy wdrożenia
- **A — fundamenty kodu (Codex):** F-01, F-02, F-03, F-04, F-05, F-07, F-08 + testy + aktualizacja `docs/systems/*.md`.
- **B — modele (Codex, Blender, równolegle z A):** F-06 + `wh_hall_column`, `wh_crane_rail`, `wh_wall_terminal`, `wh_catwalk` (moduł pomostu z barierkami, `4.0 × 1.2 × 1.5 m`?) — każdy z podglądem PNG z 3 stron.
- **C — mapa run1 (Codex):** generator `tools/arenas/run/run1.mjs` → `src/data/rooms/run1.json`; mapAudit 0/0.
- **D — ocena:** zrzuty, przegląd Gemini, ocena Opusa ≥ 7/10, poprawki, dopiero wtedy commit „gotowe”.

## 6. Wdrożenie

Generator `node tools/arenas/run/run1.mjs` zapisuje pokój `src/data/rooms/run1.json`. Ze śluzy przy `(-15, 0, 27)` można dotrzeć do doku 9 przez warsztat albo rozdzielnię. Obie drogi łączą się także nad posadzką. Wyjście leży przy `(10, 1.5, -24.5)`. Współrzędne wszystkich 14 spawnów odpowiadają tabeli w §3.10.

| Pomieszczenie | Bloki | Dekoracje GLB | Światła | Decale | Co widać z trasy gracza |
| --- | ---: | ---: | ---: | ---: | --- |
| P1 · Śluza ochrony | 70 | 6 | 5 | 8 | Przed skanerem stoją zapora i projektor znaku Kurogane. Ze startu widać front dyżurki, nad jej dachem okno warsztatu. |
| P2 · Rozdzielnia | 57 | 12 | 4 | 4 | Ekrany szaf są zwrócone do przejścia serwisowego i podestu transformatora. Dwa emitery wyznaczają pole na posadzce. |
| P3 · Warsztat | 46 | 5 | 4 | 9 | Od wejścia ze śluzy droga biegnie obok wyspy odbioru i trzech stołów na posadzce. Czwarty stół stoi nad kanałem kalibracji. |
| P4 · Hala składowania | 489 | 31 | 21 | 34 | Ażurowy most nad czterema wyspami regałów, trzy wózki, suwnica z ładunkiem i sześcioczęściowy znak doku 9. |
| **Razem** | **662** | **54** | **34** | **55** | **5 hazardów** |

Liczby obejmują kolidery i elementy konstrukcyjne. Ściany wspólne policzono raz, w pomieszczeniu, którego część generatora je stawia. Modele z własnym blokiem, m.in. skaner, wózki i regały, są ujęte w kolumnie bloków.

Obrys 52 × 54 m wynika z projektu wnętrza. Osobny profil dużych aren walki używany przez `tools/arenas/build.mjs --run` wymaga co najmniej 70 m długości, 3500 m² powierzchni chodzenia i 8 m przesłonięcia prostej start–wyjście. W magazynie wartości te wynoszą 54 m, około 2472 m² i 6,5 m.

### Geometria i odstępstwa od szkicu

- **P1.** Trzymetrowa rampa biegnie wzdłuż wschodniej ściany do dachu dyżurki na wysokości 2,591 m. Pochyła poręcz i pas BHP pokazują przebieg wejścia. Cienki spocznik nad przejściem do P2 zostawia wolną posadzkę. Chłodny beton stropu na 5,2 m przecinają trzy stalowe belki. W śluzie światło dają oprawy i terminal przy zachodniej ścianie.
- **P2.** Transformator na podeście 1,6 m kończy się na 6,6 m pod siedmiometrowym stropem. Dwie belki na wieszakach niosą lampy na 4,83 m. Ich końce omijają transformator i skrajnię galerii. Poręcz prowadzi wzdłuż pochyłego biegu. Pole elektryczne ma wpuszczoną w posadzkę ramę BHP, dwa emitery i miejscowe fioletowe światło. Na poprzednim kadrze `09-high-east` czerwono wyglądające kreski pokrywały się z pozycjami dwóch bursztynowych naklejek na brzegach pola. Obie zastąpiła rama. Laser w P3 używa wspólnego bursztynowego efektu.
- **P3.** Strop ma 5,4 m. Rampa po północnej stronie osiąga 3 m przed spocznikiem. Skrócenie biegu zapewnia prześwit przy spawnie pod jego krawędzią. Łącznik pokonuje pozostałe 0,6 m już po stronie wysokiej hali, dzięki czemu w ościeżu zostaje miejsce nad głową. Górne stanowisko oświetla ekran przy galerii.
- **P4.** Hala ma 12,5 m wysokości. Dwanaście słupów podpiera dziesięć sześciometrowych belek podsuwnicowych. Główki szyn leżą na 8,84 m, koła suwnicy stykają się z nimi przy początku modelu na 8,50 m. Pod hakiem pracuje trawersa z czterema linami narożnymi. Spód kontenera znajduje się na 5,5 m przy `Z = −12`. Płytsze kratownice pod dachem zapewniają prześwit nad wciągnikiem.
- **Most.** Pojedynczy moduł `wh_catwalk` ma szerokość 1,5 m, a powiększenie go wraz z dolną kratownicą zasłaniało ładunek. Nowy pokład ma szerokość 3 m, prześwity między stalowymi prętami, ciągłą kolizję i poręcze na 1,1 m. Z antresol na 3,6 m dwa sześciometrowe wjazdy prowadzą na środkowe przęsło na 5,8 m. Spód wjazdów jest powyżej 3,4 m. Pod mostem widać cyfrę 9 z trzema poziomymi segmentami na wysokościach 3,4, 4,1 i 4,8 m. Północne zejścia obu antresol mają po 9 m biegu, barierki zgodne ze spadkiem i 3,5 m szerokości. Rury przy zachodnim zejściu wskazują ścianę hali.
- **Składowanie.** Każda wyspa ma sześć załadowanych modułów ustawionych parami plecami, łącznie 24 regały o wysokości 6 m. Południowe wyspy kończą się przy `Z = 10`, na krawędzi antresoli. Wózki stoją widłami do ładunków i alejek, a linie ruchu, koperty odkładcze i ślady opon wskazują drogę do wysyłki.
- **Oznakowanie i osłony.** Cztery neony na czołach regałów wskazują alejki. Wózek i wyspa skrzyń osłaniają przejście. Środek wyspy przesunięto na `X = 5,2`, żeby zostawić miejsce obok wózka i zachować widok na dok. Na mapie są dwa oznaczenia K09 i cztery koperty paletowe. W hali mniejsze strzałki mają zgaszoną, ciepłą barwę. Krycie strzałek podłogowych wynosi 52%. W P3 przewód i króciec łączą odpylacz ze ścianą przy wyspie odbioru.
- **Światło.** 27 źródeł ma oprawę `wh_ceiling_lamp`. Pozostałe przypadają na cztery oprawy na frontach regałów, dwa terminale i emiter pola. Dodatkowe oprawy są nad centralną aleją, pod mostem, na wspornikach doku i na ładunku. Profil `kuroganeWarehouse` dziedziczy parametry wnętrza z projektu `indoorIndustrial` przez ich kopię w danych. Silniejsze światło półkuliste (3,6) i kierunkowe (1,8) poprawia widoczność stali także poza zasięgiem lamp. Budżet renderera to odpowiednio 2, 4 i 8 aktywnych świateł punktowych na ustawieniach niskich, średnich i wysokich.
- **Ujęcia audytowe.** Wszystkie sześć kratownic dachowych ma `ceiling: true`, więc można je ukryć razem z dachem w widoku z góry. W całym pokoju pozostały dwa krótkie stożki, nad dachem dyżurki (2,16 m) i galerią P2 (2,44 m). Ich krawędź i pasma wynikają ze wspólnego efektu. Proponowana poprawka renderera to wygaszenie przy brzegu i dithering gradientu. Scena audytu przekazuje do puli lamp zerowy czas klatki, przez co nowo przydzielone źródła zachowują zerowe natężenie. Przy kolejnej zmianie audytu warto ustalić jasność puli dla danej kamery przed odczytem obrazu.

### Sprawdzenie

W menu „Testy map” wybierz „Pokoje: walka” → „Magazyn Kurogane Arms”. Fale uruchamia `?scene=room-test&room=run1`. Test `run1Navigation.test.ts` sprawdza dojście od startu do 14 spawnów, progu wyjścia i wszystkich podestów oraz przejście z P2 do P3 przez przęsło na 5,8 m bez zejścia poniżej 3 m. Drugi test sprawdza linie widzenia przez bryły hali z pozycji `02-north` do ładunku, suwnicy i każdego z sześciu segmentów cyfry. Na nowych kadrach do oceny pozostają jasność oświetlonych frontów regałów względem zakresu ADR 0006 (`#2a3344–#56627a`), czytelność oznakowania i ogólny próg 7/10.
