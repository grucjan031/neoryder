# Dokument projektowy mapy `run2` — GALERIA HANDLOWA „ATRIUM NOVA”

Status: **Projekt referencyjny jakości (wzorzec 8+/10) + specyfikacja braków silnika („fundamenty”)**  
Docelowy plik danych mapy: `src/data/rooms/run2.json` (generator: `tools/arenas/run/run2.mjs`)  
Kierunek artystyczny: **Neon Noir** (`AGENTS.md`, `docs/adr/0006-neon-noir.md`)

---

## 1. Analiza silnika pod mapę galerii handlowej

### 1.1. Co już działa w silniku po wdrożeniu `run1`

Po wdrożeniu fundamentów dla `run1` ([docs/maps/run1.md](run1.md)) silnik obsługuje natywnie wiele mechanik potrzebnych dla dużej, wielokondygnacyjnej mapy wewnętrznej:

| Obszar silnika | Stan obecny w kodzie | Odwołania do plików |
|---|---|---|
| **Format pokoju i wpięcie w narzędzia** | Pokój `src/data/rooms/run2.json` (`type: "combat"`, z blokiem `arena` i `spawnRing`) ładuje się automatycznie przez `import.meta.glob` do `roomDefinitions`, katalogu „Testy map” (`?maps=1` → `?scene=map-walk&map=run2`), sceny walki `?scene=room-test&room=run2&debug=1` oraz audytu CLI `node tools/levels/mapAudit.mjs run2` i `node tools/screens/mapAudit.mjs run2`. | `src/world/rooms.ts`, `src/world/mapCatalog.ts`, `tools/levels/mapAuditCatalog.ts`, `tools/arenas/run/_runKit.mjs` |
| **Nawigacja wielopoziomowa (`ArenaSurfaceNavigation`)** | `RoomScene.init()` tworzy `this.navigation = new ArenaNavigation(this.layout)` dla każdego pokoju posiadającego blok `arena`. Gdy choć jeden blok ma `walkable: true`, `ArenaNavigation` deleguje szukanie ścieżek i `EnemyBatch` do `ArenaSurfaceNavigation`, budującej graf komórek `0.5 × 0.5 m` na wielu kondygnacjach połączonych pochyłymi rampami osiowymi (`rotation.x` lub `rotation.z`). | `src/scenes/roomScene.ts:895`, `src/world/arenaNavigation.ts:22–25`, `src/world/arenaSurfaceNavigation.ts:119–256` |
| **Selekcja spawnów fal wg odległości ścieżki i okluzji** | `RoomScene.selectWavePoint` przekazuje do `selectWaveSpawn()` funkcję okluzji frustum/raycastu oraz `this.navigation`. Reżyser fal wybiera osłonięte punkty spawnu w odległości ścieżki `minSpawnDistance..waveSpawnMaxDistanceM` (domyślnie `10..22 m`) i losuje krótszą z dwóch tras po siatce 3D. | `src/scenes/roomScene.ts:1591–1635`, `src/world/arenaSpawns.ts:73–109`, `src/world/waves.ts:246–261` |
| **Ukrywanie dachu/sufitu w ujęciach audytu z góry** | `roomBlockSchema` posiada flagę `ceiling: z.boolean().optional()`. Bloki z `ceiling: true` trafiają w `RoomScene.buildLayout()` do grupy `room-ceilings`, którą `MapAuditScene.render()` ukrywa na czas ujęć `top`, `high-west` i `high-east`. | `src/world/roomSchema.ts:66`, `src/scenes/roomScene.ts:1129–1131, 1221`, `src/scenes/mapAuditScene.ts:140, 163–166` |
| **Plamy światła na piętrach (`lightSpotFloors`) i stożki (`LampCones`)** | `lightSpotFloors` szuka najwyższego płaskiego bloku pod źródłem światła (`top <= p.y`), a jawne pole `floorY` w `cityLightSchema` ma pierwszeństwo. Pole `cone: true` tworzy instancjonowany stożek wolumetryczny od `position.y` do `floorY`, a `groundGlow: false` wyłącza plamę na podłodze dla świateł bocznych. | `src/render/city/dressing.ts:53–81, 134–146`, `src/world/dressingSchema.ts:122–132` |
| **Decale z `tint` i batchingiem (`batchStaticDecals`)** | `decalSchema` wspiera `tint`, `opacity` oraz `surface: 'floor' \| 'wall'`. `DecalRenderer` grupuje i scala statyczne naklejki leżące na wspólnej płaszczyźnie w jeden `Mesh` na materiał, co pozwala bogato rysować linie posadzki i oznakowanie pięter bez kosztu draw calls. | `src/world/dressingSchema.ts:136–145`, `src/render/city/decals.ts:20–78` |
| **Oprawy sufitowe i ścienne w `mapAudit.ts`** | `mapAudit.ts` rozpoznaje zbiór `CEILING_FIXTURES` (`wh_ceiling_lamp`, test `ceilingContact`) oraz `WALL_FIXTURES` (m.in. `wh_wall_terminal`, `city_ad_screen`, `city_sign_box`, `city_shutter`, `city_door`, tolerancja `WALL_MOUNT = 0.65 m`). | `src/world/mapAudit.ts:24–36, 173–178, 468–485` |
| **Tryb pogody wnętrza i wyłączenie `Panorama`** | `weatherSchema` posiada opcjonalny blok `lighting: { hemiIntensity, keyIntensity, panoramaEnabled }`. Gdy `panoramaEnabled === false`, `RoomScene` wyłącza 7 obiektów zewnętrznej panoramy miasta (`SceneAtmosphere`), oszczędzając draw calle i zapobiegając przebijaniu wieżowców przez ściany. | `src/render/weatherSchema.ts:57–63`, `src/scenes/roomScene.ts:451–462`, `src/data/weather/kuroganeWarehouse.json` |

### 1.2. Nawigacja po 3 kondygnacjach, ruchome schody jako `walkable` i ograniczenie `spawnPoints` w `roomSchema`

Trzypiętrowa galeria handlowa z otwartym atrium (`Parter L0: y = 0.0 m`, `Piętro L1: y = 5.2 m`, `Piętro L2: y = 10.4 m`) stawia przed nawigacją i systemem fal dwa wymagania techniczne:

1. **Ruchome schody (`mall_escalator`) oraz schody klatek jako rampy dla `ArenaSurfaceNavigation`:**
   - W `src/world/arenaSurfaceNavigation.ts:186` każdy blok z `walkable: true` spełniający rolę rampy **musi być nachylony wyłącznie wokół osi X albo wyłącznie wokół osi Z** (`if (b.rotation?.y || (b.rotation?.x && b.rotation?.z)) throw new Error(...)`).
   - Dodatkowo metoda `connects(a, b)` (`src/world/arenaSurfaceNavigation.ts:258–274`) pozwala przejść z rampy na poziomą płytę podłogi **wyłącznie przez jej dolny lub górny koniec**, nigdy przez boczną krawędź (`Math.abs(other.position[axis] - surface.position[axis]) < half`), a prześwit nad każdym punktem rampy i spocznika musi wynosić co najmniej `navigationHeadroomM` (`≥ 2.2 m`, linia 171).
   - **Konsekwencja dla `mall_escalator`:** wizualny model ruchomych schodów (ze stopniami, gumowymi poręczami i szklanymi bokami) wstawiamy jako `decor` (lub blok z `walkable: false`), natomiast powierzchnię ruchu dla gracza i AI tworzy **niewidoczny pochyły blok kolizji** (`visible: false, walkable: true`) o czystym obrocie `rotation.x` (dla schodów biegnących wzdłuż osi Z) lub `rotation.z` (wzdłuż osi X), nachyleniu `≤ 26.6°` (bieg poziomy `10.4 m` na wznios `5.2 m`, `atan(5.2 / 10.4) = 26.565°`) i szerokości biegu `≥ 2.0 m` (przy `navigationClearanceM = 0.4` daje to `3` równoległe kolumny komórek `0.5 m` wewnątrz biegu), uzupełniony dwoma niewidocznymi blokami bocznych balustrad (`visible: false, walkable: false`).

2. **Krytyczne ograniczenie silnika: `spawnPoints` w `roomSchema` nie obsługują dziś wysokości `y` (wszystkie spawny są wymuszane na `y = 0`):**
   - W `src/world/roomSchema.ts:141` schemat punktu spawnu pokoju to:
     ```ts
     export const roomSpawnPointSchema = z.object({ x: finite, z: finite });
     ```
     (brak pola `y`, w odróżnieniu od `arenaSchema.spawnPoints` w linii 128, które jest używane wyłącznie przez tryb `Conquest`).
   - W `validateLayout` (`src/world/roomSchema.ts:408–565`) walidator wymaga, by **każdy** punkt z `room.spawnPoints` leżał w rzucie XZ na bloku podłogi o górnej powierzchni równej `groundY = room.playerSpawn.y` (`y = 0`), nie pokrywał się z żadnym blokiem przecinającym `groundY` i był osiągalny w 2D flood-fillu na poziomie `y = 0`. Gdybyśmy postawili punkt spawnu `{ x, z }` na balkonie Piętra L1 lub L2 (pod którym na parterze stoi np. filar, sklep lub lada), `validateLayout` odrzuci mapę błędem `Punkt spawnu znajduje się w bloku`!
   - Co gorsza, nawet gdyby pod balkonem L1/L2 na parterze była wolna podłoga `y = 0`, to `RoomScene.ts:610` (`spawnPoints: this.layout.spawnPoints.map(p => ({ x: p.x, y: 0, z: p.z }))`), `RoomScene.ts:1612` (`points.map(p => ({ ...p, y: this.layout.playerSpawn.y }))`) oraz `WaveDirector.ts:260` (`{ x: point.x, y: 0, z: point.z }`) **twardo zerują współrzędną `y = 0`** — wszyscy wrogowie pojawiliby się wyłącznie na parterze!
   - **Wniosek (Fundament P0 w kodzie — F-01):** Aby zrealizować wymaganie briefu (*„14–18 spawnów rozłożonych na kondygnacjach; pion jest głównym atutem tej mapy: walka między piętrami przez atrium”*), należy rozszerzyć `roomSpawnPointSchema` i `wavesSchema` o opcjonalne `y?: number`, zaktualizować `RoomScene` i `WaveDirector`, by zachowywały `p.y ?? playerSpawn.y`, a w `validateLayout` przepuszczać spawny z `y !== groundY` leżące na blokach `walkable: true` o `top ≈ point.y`.

### 1.3. Przezierne kraty sklepowe, szkło balustrad i widoczność towaru za kratą

Główny filar wizualny mapy `run2` to **15 zamkniętych sklepów na 3 piętrach, w których przez opuszczone rolety kratowe (`mall_shutter_grille`) wyraźnie widać podświetlony nocnym światłem towar**: manekiny, ściany z butami, ekrany i półki z elektroniką, kawiarnię z krzesłami na stołach, aptekę czy salon Kurogane. Analiza obecnego renderera (`src/render/materials.ts`, `src/render/urbanMaterials.ts`, `src/render/propPrints.ts`) ujawnia dwa kluczowe fakty:

1. **Obecny materiał `glass` (`mat_glass`) jest w 100% nieprzezroczysty:**
   - W `src/render/urbanMaterials.ts:214, 383–494` `glass` tworzy zwykły `MeshStandardMaterial` bez `transparent: true` i bez `opacity < 1` (kolor `#202c44`, tekstura `grime` i powierzchniowa emisja Fresnel `glassGlow` w linii 491).
   - Użycie obecnego `glass` na balustradach atrium (`mall_glass_rail`), szybie windy panoramicznej (`mall_elevator`), witrynach czy świetliku dachowym (`mall_skylight`) zamieniłoby je w ciemnogranatowe, ślepe murki zasłaniające widok między piętrami oraz wnętrza sklepów.
   - Ponadto obecny model `city_shutter` (`3.0 × 3.0 × 0.251 m`) ma pełny blaszany podkład (`backing`) i gęste lamelki (`slat`) bez prześwitu.

2. **Jak zrealizować przezierne kraty (`mall_shutter_grille`) i szkło (`mat_glass_clear`) bez błędów sortowania przezroczystości (alpha sorting) i przy zachowaniu 60 FPS:**
   - Gdyby zarówno balustrada atrium (`mall_glass_rail`), jak i krata witryny (`mall_shutter_grille`) za nią były półprzezroczystymi płaszczyznami (`transparent: true, depthWrite: false`), w Three.js wystąpiłoby klasyczne migotanie kolejności rysowania (alpha-blending przed alpha-blendingiem oraz z hologramami/stożkami lamp).
   - **Rozwiązanie hybrydowe (optymalne architektonicznie i wizualnie):**
     1. **Krata witryny `mall_shutter_grille` jako prawdziwa, ażurowa geometria 3D (`opaque`)** z fizycznymi prześwitami między poziomymi prętami i pionowymi łącznikami falistymi (`mat_metal` + prowadnice i skrzynka nawojowa `mat_trim`). Przy grubości pręta `0.024 m` i rozstawie co `0.16 m` (oraz pionowych strzemionach co `0.50 m`) krata ma **82% otwartości optycznej**, kosztuje zaledwie `~420` trójkątów na moduł `4.0 × 3.6 m`, rysuje się w standardowym przebiegu nieprzezroczystym z pełnym `depthWrite: true` (współpracuje z `DepthPrepass`, `Outline` i `InstancedMesh`), nie ma żadnych problemów z alpha-sortingiem i wpuszcza światło `PointLight` z wnętrza sklepu na posadzkę pasażu!
     2. **Nowy materiał `glass_clear` (`mat_glass_clear`) dla szkła architektonicznego** (balustrady `mall_glass_rail`, szyba windy `mall_elevator`, tafle świetlika `mall_skylight`, gabloty kiosków `mall_kiosk`): `MeshStandardMaterial` z `transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.12, metalness: 0.15, color: '#283852'` oraz krawędziowym połyskiem Fresnel. Ponieważ krata sklepu za balustradą i manekiny w sklepie są `opaque` (`depthWrite: true`), półprzezroczysta balustrada `glass_clear` zawsze poprawnie komponuje się na tle kraty i wnętrza sklepu!
     3. **Fizyka kraty sklepowej:** Wnęka każdego sklepu (głębokość `3.5–4.0 m` za linią kraty) ma prawdziwą podłogę, sufit, ściany boczne, modele towaru (`mall_mannequin`, `mall_shoe_wall`, `mall_electronics_shelf` itd.) i wewnętrzne nocne źródło światła, natomiast w płaszczyźnie kraty `mall_shutter_grille` stoi blok kolizji (`size: 4.0 × 3.6 × 0.16 m`). Dzięki temu gracz i wrogowie nie mogą wejść do zamkniętego sklepu, ale kamera FPP widzi całe trójwymiarowe wnętrze z paralaksą podczas ruchu po pasażu!

### 1.4. Świetlik dachowy z deszczem, profil pogody wnętrza i budżet świateł

1. **Świetlik dachowy nad atrium (`mall_skylight`, `y = 15.6..17.2 m`) i nocny deszcz:**
   - W silniku `Weather` (`src/vfx/weather.ts:104–108`) smugi deszczu są wycinane wewnątrz brył `rainShelters`. Jeśli cały budynek galerii przykryjemy `rainShelters` do wysokości `y = 15.8 m` (poniżej tafli świetlika), a w profilu pogody `mallAfterHours.json` zostawimy deszcz włączony (`precipitation.kind: "rain"`, `weatherFloorY: 16.0`), to **ponad szklanym świetlikiem (`y = 16.0..24.0 m`) gracz patrzący w górę przez przezroczyste tafle `mat_glass_clear` będzie widział na żywo padający nocny deszcz i rozbryzgi na zewnętrznej stronie szkła świetlika**, podczas gdy wewnątrz hali atrium (`y = 0..15.8 m`) nie spadnie ani jedna kropla!
   - Dodatkowo na dolnej powierzchni tafli świetlika (`y = 16.2 m`) lub w materiale szkła świetlika można umieścić półprzezroczyste naklejki mokrych smug/kropli (`puddle1` / `mall_rain_glass`), a pod nieszczelnym narożnikiem świetlika jeden efekt `ambientFx: { kind: "drip" }` spuszczający pojedyncze krople do podstawionego wiadra/donicy na parterze.

2. **Oświetlenie „noc po zamknięciu” a limit `CityLights` (`8` na `high`, `4` na `medium`):**
   - `CityLights` (`src/render/city/lights.ts`) wybiera w każdej klatce maksymalnie 8 aktywnych `PointLight` w granicach frustum kamery wg wagi `distanceSq / (power^importance * keep)`, natomiast **wszystkie** wpisy `lights[]` z `groundGlow !== false` rysują zawsze bardzo tanie plamy światła na podłodze (`floorY`).
   - W galerii po zamknięciu daje to ogromną przewagę:
     - Główne kasetony sufitowe pasażu (`mall_ceiling_panel`) są w większości **zgaszone** (tryb nocny — świeci tylko co trzeci kaseton ciepłą bielą `#fff1d6` o niskiej intensywności oraz bursztynowe oprawy awaryjne `#ffae1a`).
     - Każda z 15 witryn sklepowych ma wewnątrz za kratą własną lampę nocną (`lights[]` z `floorY` równym posadzce danego piętra `0.0`, `5.2` lub `10.4 m`) oraz świecący szyld neonowy (`signs[]`, `kind: "neon"`) nad witryną w kolorze branży (`#ffae1a`, `#6dff4a`, `#8a5cff`, `#3d7bff`, `#fff1d6`). Dzięki temu nawet gdy `PointLight` odległego sklepu na drugim końcu atrium jest poza pulą 8 najbliższych świateł, jego **szyld neonowy (z halo `SignRenderer`), świecące ekrany `mat_screen_*` / akcenty `mat_neon_*` na modelach wewnątrz sklepu oraz plama światła `groundGlow` na posadzce za kratą są widoczne zawsze z każdego piętra atrium!**

### 1.5. Modele z `mapModelBounds.json` gotowe do użycia i reguły `mapAudit.ts`

Z obecnych 129 modeli w `src/data/render/mapModelBounds.json` w galerii handlowej można bezpośrednio wykorzystać (bez łamania spójności tematycznej miejsca):
- **Automaty i terminale:** `city_vending` (`1.014 × 2.0 × 0.816 m`), `wh_wall_terminal` (`1.42 × 0.93 × 0.2105 m`, `WALL_FIXTURES`), `city_holo_projector` (`0.6 × 0.2 × 0.6 m`), `city_ad_screen` (`1.1 × 2.294 × 0.182 m`, `WALL_FIXTURES`), `city_sign_box` (`2.0 × 1.0 × 0.25 m`, `WALL_FIXTURES`).
- **Drzwi zaplecza i instalacje techniczne:** `city_door` (`1.505 × 2.465 × 0.238 m`, drzwi ewakuacyjne i serwisowe w korytarzach), `city_vent_grate` (`1.0 × 0.05 × 1.0 m`, kratki klimatyzacji), `city_ac_unit` (`0.907 × 0.604 × 0.518 m`, tylko w strefie technicznej pod stropem/szybem).
- **Wyposażenie salonu taktycznego Kurogane (sklep S-05) i zaplecza:** `wh_weapon_case_stack` (`1.6 × 1.1 × 1.2 m`), `wh_workbench_weapons` (`2.4 × 1.5 × 0.9 m`), `wh_server_rack` (`1.2 × 2.4 × 1.0 m`).
- **Obiekty fizyczne do walki i Rezonansu:** `crate` (`1.0 × 1.0 × 1.0 m`, zniszczalna), `crate_small` (`0.5 × 0.5 × 0.5 m`, dynamiczna do Chwytu Rezonansem), rozciągliwe `pillar` i `cover_low`.

**Zakaz użycia w `run2` (nauczka z `run1` §5 pkt 8–9):** Wewnątrz galerii handlowej nie wolno stawiać modeli portowych (`port_container_*`, `port_bollard`), drogowych (`city_car`, `city_wrecked_car`, `city_highway_barrier`, `city_traffic_cone`, `city_overpass_pillar`), śmietników ulicznych (`city_dumpster`, `city_trash_bags`) ani straganów z blachy falistej (`city_stall`, `city_market_stall_canopy`). Wszystkie elementy architektury galerii, meble pasażu i ekspozycje 15 sklepów pochodzą z nowego zestawu `mall_*.glb` (sekcja 2).

---

## 2. Lista braków („fundamenty”) z priorytetem P0 / P1 / P2

Poniższa specyfikacja rozdziela wyraźnie to, **co wymaga dopisania w kodzie TypeScript / shaderach** (nie da się tego zrobić samymi danymi JSON), od **nowych materiałów/tekstur danych** oraz **zestawu modeli 3D z Blendera (`mall_*.glb`)**.

### 2.1. Priorytet P0 — MUSI BYĆ PRZED `run2`

#### A. Zmiany w kodzie silnika (nie da się zrobić samymi danymi JSON)

| ID | Co trzeba dopisać w kodzie i dlaczego nie da się danymi | Pliki w repozytorium | Zakres zmian |
|---|---|---|---|
| **F-01** | **Współrzędna wysokości `y` w `spawnPoints` pokoju (`roomSchema`, `waves`, `RoomScene`):** obecnie `roomSpawnPointSchema` i `wavesSchema` przyjmują tylko `{ x, z }`, `validateLayout` odrzuca każdy punkt spawnu nieleżący bezpośrednio na płycie `y = playerSpawn.y` (lub zasłonięty w rzucie 2D przez blok parteru), a `RoomScene` i `WaveDirector` twardo nadpisują `y: 0`. W 3-piętrowej galerii wrogowie muszą spawnować się także na Piętrze L1 (`y = 5.2 m`) i Piętrze L2 (`y = 10.4 m`).<br>**Zmiana w kodzie:**<br>1. W `roomSpawnPointSchema` (`src/world/roomSchema.ts:141`) i `point` w `src/world/waves.ts:12` dodać `y: z.number().finite().optional()`.<br>2. W `validateLayout` (`src/world/roomSchema.ts:408–565`): dla spawnu z `p.y === undefined \|\| Math.abs(p.y - groundY) <= FLOOR_EPSILON_M` zachować obecny test płyty `groundY` i flood-fill 1×1 m; dla spawnu na wyższej kondygnacji (`p.y > groundY`) wymagać, by pokój miał bloki `walkable: true`, punkt `(p.x, p.z)` leżał wewnątrz obrysu bloku `walkable: true` o `Math.abs(block.position.y + block.size.y / 2 - p.y) <= FLOOR_EPSILON_M` i nie wnikał w żaden blok przeszkody na wysokości `(p.y, p.y + 1.8]`, a pełną osiągalność 3D po rampach/schodach weryfikować przez `ArenaNavigation` (jak w `run1Navigation.test.ts`).<br>3. W `RoomScene.ts:610, 1612` oraz `WaveDirector.ts:84, 178, 260` przekazywać `y: p.y ?? this.layout.playerSpawn.y` zamiast `0`. | `src/world/roomSchema.ts`, `src/world/waves.ts`, `src/scenes/roomScene.ts`, `tests/unit/rooms.test.ts` | ~55 linii TS + test jednostkowy spawnu na piętrze |
| **F-02** | **Materiał przezroczystego szkła architektonicznego `glass_clear` (`mat_glass_clear`) w rendererze:** obecny materiał `glass` (`src/render/urbanMaterials.ts:214`) to nieprzezroczysty `MeshStandardMaterial` (`opacity: 1`). Samymi danymi JSON (`arenaMaterials.json`) nie da się włączyć `transparent: true, opacity: 0.22, depthWrite: false`, bo `portLooks` w `urbanMaterials.ts:111–141` nie ma pól `opacity` ani `transparent`.<br>**Zmiana w kodzie:**<br>1. Dodać rodzaj materiału `'glass_clear'` (`mat_glass_clear`) do `urbanKinds` w `src/render/urbanMaterials.ts`, `BLOCK_MATERIALS` w `src/world/dressingSchema.ts` i `surfaces` w `src/world/mapAudit.ts`.<br>2. W `createUrbanMaterial` (`src/render/urbanMaterials.ts:388`) dla `kind === 'glass_clear'` ustawić `transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.12, metalness: 0.15, color: '#283852'` z zachowaniem poświaty krawędziowej Fresnel (`glassGlow`). | `src/render/urbanMaterials.ts`, `src/world/dressingSchema.ts`, `src/world/mapAudit.ts` | ~30 linii TS |
| **F-03** | **Rejestracja prefiksu `'mall_'` oraz opraw ściennych/sufitowych galerii w `cityModels.ts` i `mapAudit.ts`:**<br>1. W `CITY_MODEL_PREFIXES` (`src/render/cityModels.ts:8`) dopisać `'mall_'`, aby `RoomScene` ładował modele `/assets/models/city/mall_*.glb` z zachowaniem ich wielomateriałowości glTF.<br>2. W `src/world/mapAudit.ts:24–36` dopisać modele ścienne galerii (`mall_storefront`, `mall_shutter_grille`, `mall_shoe_wall`, `mall_security_fixture`, `mall_floor_sign`) do `WALL_FIXTURES` oraz modele sufitowe (`mall_ceiling_panel`, `mall_skylight`, `mall_hanging_banner`) do `CEILING_FIXTURES`. | `src/render/cityModels.ts`, `src/world/mapAudit.ts` | ~15 linii TS |

#### B. Nowe materiały powierzchniowe, profil pogody i tekstury (dane + zasoby)

| ID | Co trzeba dodać | Gdzie w zasobach / danych | Szczegóły |
|---|---|---|---|
| **F-04** | **3 materiały wykończeniowe galerii handlowej w `arenaMaterials.json` i tekstury `surfaces/`:**<br>1. `mall_stone_floor` — polerowane wielkoformatowe płyty kamienne/gresowe `1.2 × 1.2 m` z wyraźną ciemną fugą i wysokim połyskiem (`scale: 0.4, roughness: 0.25, metalness: 0.08, bump: 0.35, wetness: 0.65, tint: "#3b4559"`) — główna posadzka pasażu i atrium;<br>2. `mall_terrazzo_inlay` — ciemniejszy grafitowo-bazaltowy kamień z drobnym kruszywem i mosiężną listwą dylatacyjną (`scale: 0.5, roughness: 0.2, metalness: 0.15, bump: 0.3, wetness: 0.7, tint: "#262e3d"`) — pasy obwodowe wokół atrium, strefy przed ruchomymi schodami i wnętrza witryn;<br>3. `mall_acoustic_ceiling` — modułowy sufit podwieszany z ciemnych płyt akustycznych na ruszcie aluminiowym (`scale: 0.5, roughness: 0.75, metalness: 0.2, bump: 0.45, tint: "#1e2533"`). | `src/data/render/arenaMaterials.json`, `src/render/urbanMaterials.ts`, `src/render/surfaceTextures.ts`, `src/world/dressingSchema.ts`, `public/assets/textures/surfaces/mall_*.webp` (+ odpowiedniki `komiks_*`) | 3 tekstury `.webp` (`1024×1024`) + wpisy w `arenaKinds` i `BLOCK_MATERIALS` |
| **F-05** | **Profil pogody `src/data/weather/mallAfterHours.json` („Galeria po zamknięciu — nocny deszcz na świetliku”):**<br>- `precipitation`: `{ kind: "rain", density: 0.55, speed: 19, color: "#889bb8", opacity: 0.32, exposureS: 0.025, widthM: 0.014 }` — w połączeniu z `rainShelters` obejmującym wnętrze galerii do `y = 15.8 m` i `weatherFloorY: 16.0` deszcz pada wyłącznie na zewnątrz na szklany świetlik dachowy!<br>- `lighting`: `{ hemiIntensity: 2.1, keyIntensity: 0.95, panoramaEnabled: false }` — niższe światło globalne niż w magazynie (`run1` miało `3.6 / 1.8`), aby stworzyć autentyczny półmrok galerii po zamknięciu, w którym świecą neony szyldów i witryny za kratami, ale zacienione filary i balustrady pozostają czytelne (`#2a3344–#4b5870`);<br>- `surface`: `{ gloss: 0.55, reflections: 0.75, puddles: 0.08 }` — wysokie odbicia neonów w polerowanej kamiennej posadzce bez kałuż wewnątrz budynku;<br>- `fog`: `{ color: "#101624", density: 0.01, heightM: 14, strength: 0.42, nearM: 18, farM: 110 }`;<br>- `ambience`: `[{ kind: "generator", gain: 0.09, radiusM: 90 }, { kind: "rain", gain: 0.08, radiusM: 90 }]` (cichy szum klimatyzacji HVAC + stłumiony deszcz na świetliku). | `src/data/weather/mallAfterHours.json` | 1 plik JSON |
| **F-06** | **Szyldy neonowe, ekrany i decale galerii handlowej:**<br>1. **Szyldy (`public/assets/textures/signs/*.webp`):** oprócz istniejących już i pasujących (`pharmacy`, `implants`, `arcade`, `cat_cafe`, `noodles`, `ramen`, `cocktail`, `tattoo`, `repair`, `open`, `arrow`) dodać 7 szyldów branżowych galerii: `mall_fashion` („VERVE // MODA”), `mall_footwear` („STRIDE // OBUWIE”), `mall_electronics` („VOLT-X // AUDIO-HOL”), `mall_optics` („IRIS // OPTYKA”), `mall_jewelry` („AUREA // ZEGARKI”), `mall_books` („KODEKS // MEDIA”), `mall_kurogane` („KUROGANE // TAKTYKA”) oraz 3 oznaczenia kondygnacji: `floor_l0`, `floor_l1`, `floor_l2`.<br>2. **Ekran informatora (`public/assets/textures/screens/screen_mall_directory.webp`):** plan pięter `L0 / L1 / L2` z ikonami „TU JESTEŚ” w dozwolonych barwach (bursztyn/zieleń/błękit/fiolet).<br>3. **Decale (`public/assets/textures/decals/*.webp`):** `mall_tactile_strip` (ścieżka naprowadzająca / listwa dylatacyjna z mosiądzu), `mall_escalator_comb` (żółto-bursztynowy pas ostrzegawczy przed grzebieniem ruchomych schodów), `mall_wet_footprints` (mokre ślady stóp i smugi przy wejściu południowym), `mall_exit_stencil` (zielone oznaczenie drogi ewakuacyjnej na posadzce). | `public/assets/textures/signs/`, `public/assets/textures/screens/`, `public/assets/textures/decals/`, `tools/textures/` | 10 tekstur `signs`, 1 `screens`, 4 `decals` |

#### C. Nowy zestaw modeli 3D galerii handlowej (`tools/blender/sets/mall_atrium.py` → `public/assets/models/city/mall_*.glb`)

Wszystkie modele powstają proceduralnie w Blenderze (metry, glTF Y-up, płaskie cieniowanie low-poly z fazowanymi krawędziami, spód na `Y = 0` lub dla modeli sufitowych góra na `Y = 0.45 m`, przód w `+Z`, wyłącznie dozwolone materiały `mat_*`, zero kolorów zakazanych).

##### Tabela 1: Modele architektoniczne, komunikacji pionowej i wyposażenia pasażu (`P0`)

| Model (`.glb`) | Wymiary AABB `X × Y × Z` [m] | Punkt zaczepienia (Origin) | Przód | Montaż i kolizja w grze | Opis geometrii i materiałów (`mat_*`) | Budżet tri |
|---|---|---|---|---|---|---:|
| `mall_shutter_grille` | `4.00 × 3.60 × 0.18` | Środek spodu (`x=0, y=0, z=0`); lico kraty w `z ∈ [-0.06, +0.06]` | `+Z` (na pasaż) | `decor` (`WALL_FIXTURES`) + cienki blok kolizji `4.0 × 3.6 × 0.16 m` (`visible: false`, blokuje wejście i pociski, ale zostawia pełną widoczność przez prześwity!) | **Przezierna roleta kratowa (otwartość ~82%):** górna kaseta nawojowa (`y = 3.30..3.60 m`, `mat_trim`), dwie boczne prowadnice (`szer. 0.10 m`), dolna listwa ryglowa z zamkiem (`y = 0.0..0.18 m`, `mat_metal` + `mat_hivis`), 18 poziomych prętów (`Ø 0.022 m` co `0.17 m`) spiętych co `0.50 m` pionowymi falistymi ogniwami (`mat_metal`). Brak tylnej ścianki (`backing`) — przez kratę widać całe wnętrze sklepu! | ≤ 620 |
| `mall_storefront` | `6.00 × 4.60 × 0.50` | Środek spodu (`x=0, y=0, z=0`); tył ramy na `z=0`, wysunięcie w `+Z` | `+Z` (na pasaż) | `decor` (`WALL_FIXTURES`); kolizję tworzą boczne filary międzywitrynowe (`1.0 × 4.6 × 0.5 m`) i nadproże (`6.0 × 1.0 × 0.5 m`) w `blocks[]` | **Moduł portalu sklepowego:** dwa boczne pilastry (`szer. 1.0 m`, `mat_lacquer` / `mat_trim`) z podświetlanymi pionowymi szczelinami LED (`mat_light_white`), górny fryz na szyld (`y = 3.60..4.60 m`, `mat_machine` + ciemne tło `sign_face` na `z = 0.48 m` pod neon z `signs[]`), boczne stałe przeszklenia witryny (`mat_glass_clear`) i centralny otwór `4.0 × 3.6 m` na `mall_shutter_grille`. | ≤ 680 |
| `mall_escalator` | `2.40 × 6.25 × 11.60` | Środek rzutu na poziomie dolnego piętra (`x=0, y=0, z=0`); wejście dolne przy `z = +5.20 m (y=0)`, wyjście górne przy `z = -5.20 m (y=5.20 m)` | `+Z` (dolny podest) / `-Z` (górny podest) | `decor` + **3 niewidoczne bloki kolizji** (`visible: false`): (1) pochyła płyta `walkable: true` (`szer. 1.50 m, dł. 11.63 m, wznios 0 → 5.20 m` pod kątem `26.565°`), (2) dwie boczne balustrady `0.35 × 1.05 × 11.63 m` (`walkable: false`) | **Ruchome schody między piętrami (`ΔY = 5.20 m`):** masywna stalowa kratownica nośna od spodu (`mat_machine`, `mat_metal`), 26 profilowanych stopni schodkowych (`mat_tread_plate` z bursztynowym obrysem ostrzegawczym `mat_neon_amber`), płyty grzebieniowe na spocznikach (`z = ±5.2 m`), szklane boczne balustrady (`mat_glass_clear`, wys. `1.05 m`) z czarną gumową poręczą (`mat_rubber`) i dolną listwą LED (`mat_light_white`). | ≤ 1480 |
| `mall_glass_rail` | `4.00 × 1.10 × 0.14` | Środek spodu cokołu (`x=0, y=0, z=0`); długość wzdłuż osi `X` | `+Z` (strona atrium) | `blok` (`size: 4.0 × 1.1 × 0.14 m`, `instance: true`) — trzyma własne materiały glTF dzięki prefiksowi `mall_`! | **Szklana balustrada atrium i mostków:** dolny cokół zaciskowy ze stali szczotkowanej (`wys. 0.14 m`, `mat_metal`), dwa słupki pośrednie (`x = ±1.33 m`, `mat_trim`), dwie przezroczyste tafle szkła hartowanego (`mat_glass_clear`, `y = 0.14..1.02 m`), górna okrągła poręcz (`y = 1.04..1.10 m`, `mat_metal`) z podświetleniem podporęczowym (`mat_light_white`). | ≤ 280 |
| `mall_elevator` | `3.60 × 15.80 × 3.60` | Środek podstawy szybu na parterze (`x=0, y=0, z=0`); drzwi na każdym piętrze od strony `-Z` / `+Z` | `+Z` | `decor` + bloki kolizji: 4 narożne słupy szybu (`0.45 × 15.8 × 0.45 m`), blok zatrzymanej kabiny na `y = 5.20..8.20 m` (z grywalnym dachem serwisowym `walkable: true` na `y = 8.20 m` lub kładką wokół szybu na L1 i L2!) | **Przeszklona winda panoramiczna w atrium:** 4 stalowe kolumny prowadnic (`mat_metal`, `mat_machine`) ze szprosami co `2.6 m`, przeszklone ściany szybu (`mat_glass_clear`), portale drzwi szybowych na `y = 0.0, 5.2, 10.4 m` z wyświetlaczem piętra (`mat_neon_amber`), ośmiokątna przeszklona kabina zatrzymana w trybie awaryjnym między L1 a L2 z oświetlonym wnętrzem (`mat_light_white`, `mat_neon_blue`) i linami nośnymi (`mat_cable`). | ≤ 1450 |
| `mall_skylight` | `24.00 × 1.60 × 6.00` | Środek spodu oparcia na gzymsie (`x=0, y=0, z=0`); rozpiętość łuku/dwuspadu w `X` (`24 m`), moduł `6 m` w `Z` | `+Z` | `decor` (`CEILING_FIXTURES`) stawiany na `y = 15.60 m` (6 modułów wzdłuż `Z = -15..-9..-3..+3..+9..+15` przykrywa całe atrium `24 × 36 m`) + płyta kolizji dachu (`ceiling: true, visible: false`) | **Moduł świetlika dachowego nad atrium:** dwuspadowa stalowa kratownica łukowa (`mat_metal`, `mat_trim`, kalenica na `y = +1.60 m` czyli `17.20 m` nad parterem), szprosy podziałowe i wielkie przezroczyste tafle szklane (`mat_glass_clear`), przez które widać ciemnogranatowe niebo i smugi deszczu, z liniowymi oprawami nocnymi (`mat_neon_blue`) wzdłuż węzłów kratownicy. | ≤ 760 |
| `mall_kiosk` | `3.60 × 2.40 × 2.60` | Środek podstawy (`x=0, y=0, z=0`); lada frontowa w `+Z` i `-Z` | `+Z` | `blok` (`size: 3.6 × 2.4 × 2.6 m`, `instance: true`, twarda osłona na parterze i mostkach) | **Zamknięty kiosk wyspowy na pasażu (kawa / elektronika / zegarki):** zaokrąglona lada o wys. `1.10 m` (`mat_lacquer`, `mat_wood`, `mat_trim`) z przeszklonymi gablotami (`mat_glass_clear`), ekspresami/towarem w środku, opuszczoną do połowy ażurową żaluzją nad ladą i dachem-otokiem na dwóch słupkach (`wys. 2.40 m`) ze świecącym paskiem (`mat_neon_amber` / `mat_light_white`) oraz ekranem menu (`mat_screen_menu`). | ≤ 980 |
| `mall_planter` | `3.20 × 1.35 × 1.40` | Środek podstawy (`x=0, y=0, z=0`); dłuższy bok w `X` | `+Z` | `blok` (`size: 3.2 × 1.35 × 1.4 m`, `instance: true`) — idealna niska/średnia osłona w pasażach! | **Architektoniczna donica z roślinami:** betonowo-stalowa skrzynia donicy (`wys. 0.85 m`, `mat_concrete` + cokół `mat_trim` z ciepłą listwą LED od spodu `mat_light_white`), ziemia/otoczaki i geometryczne kępy egzotycznych krzewów oraz niskich palm/bambusów (`mat_paint` `#3e5a48`, sięgające `y = 1.35 m`). Cokół `0.85 m` daje pewną osłonę w kucnięciu, a liście łamią sylwetkę. | ≤ 740 |
| `mall_bench` | `2.60 × 0.85 × 0.90` | Środek podstawy (`x=0, y=0, z=0`); oparcie po środku (dwustronna ławka pasażowa) | `+Z` | `blok` (`size: 2.6 × 0.85 × 0.9 m`, `instance: true`) | **Nowoczesna ławka galerii:** dwie masywne odlewane podpory (`mat_metal`), siedzisko z listew drewnianych (`mat_wood` na `y = 0.46 m`), niskie profilowane oparcie środkowe (`y = 0.85 m`, `mat_trim`) i podłokietniki. | ≤ 340 |
| `mall_fountain` | `6.40 × 3.80 × 6.40` | Środek podstawy na parterze atrium (`x=0, y=0, z=0`) | `+Z` | `decor` + **2 bloki kolizji** (`visible: false`): (1) zewnętrzna cembrowina basenu `6.4 × 0.95 × 6.4 m` (`walkable: true` na obrzeżu lub niska osłona `0.95 m`), (2) centralny trzon rzeźby `2.2 × 3.8 × 2.2 m` (`walkable: false`, pełna osłona przed strzałami z pięter!) | **Centralna fontanna i rzeźba kinetyczna „Atrium Nova”:** ośmioboczny basen z czarnego bazaltu (`mat_concrete`, `mat_trim`, wys. cembrowiny `0.95 m` do siedzenia/osłony), tafla wody podświetlona od spodu pierścieniami (`mat_neon_blue`, `mat_light_white`) oraz wznosząca się na `3.80 m` futurystyczna instalacja z trzech przeplatających się stalowo-szklanych pierścieni (`mat_metal`, `mat_glass_clear`, `mat_neon_amber`). | ≤ 1380 |
| `mall_directory` | `1.20 × 2.40 × 0.45` | Środek cokołu (`x=0, y=0, z=0`); ekrany dwustronnie w `+Z` i `-Z` | `+Z` | `blok` (`size: 1.2 × 2.4 × 0.45 m`, `instance: true`) | **Wolnostojący pylon informacyjny (mapa galerii):** smukły totem ze szczotkowanego aluminium i ciemnego szkła (`mat_metal`, `mat_lacquer`), duży pionowy ekran mapy pięter (`mat_screen_mall_directory` / `mat_screen_map`), podświetlony nagłówek `INFO // L0-L2` (`mat_neon_blue`) i czytnik zbliżeniowy. | ≤ 380 |
| `mall_ceiling_panel` | `2.40 × 0.45 × 1.20` | Środek spodu kasetonu (`x=0, y=0, z=0`); wieszaki sięgają `y = +0.45 m` (jak `wh_ceiling_lamp`) | `+Z` | `decor` (`CEILING_FIXTURES`, montowany `0.45 m` poniżej stropu danej kondygnacji) | **Podwieszany moduł sufitowy z oprawami liniowymi LED:** rama z ciemnego aluminium (`mat_trim`), płyta akustyczna (`mat_plaster`) i dwa równoległe paski świetlne (`mat_light_white`). | ≤ 260 |
| `mall_security_fixture` | `0.90 × 1.30 × 0.35` | Środek spodu (`x=0, y=0, z=0`), tył płyty montażowej na `z = 0` | `+Z` | `decor` (`WALL_FIXTURES`, montowany na filarach i przy klatkach schodowych na `y = 1.10 m`) | **Zestaw BHP i bezpieczeństwa na filar:** wnękowa szafka hydrantu i gaśnicy (w kolorze grafitowo-bursztynowym `mat_hivis` + `mat_metal` z okienkiem `mat_glass_clear` i naklejką `mat_label_warning` — zero czerwieni!), alarmowy przycisk ewakuacyjny (`mat_neon_amber`) oraz umieszczona wyżej kopułkowa kamera CCTV z zieloną diodą stanu (`mat_neon_green`). | ≤ 420 |

##### Tabela 2: Modele ekspozycji sklepowych za przeziernymi kratami (`P0` — zestaw towaru widocznego w witrynach)

Modele te stoją **wewnątrz wnęk sklepowych za kratą `mall_shutter_grille`** (`0.6–3.2 m` za licem kraty). Ponieważ gracz nie może wejść za kratę, są ładowane w `decor[]` (opierają się stopami na płycie podłogi wnęki na `y = 0.0, 5.2, 10.4 m`, dzięki czemu spełniają regułę `ground` w `mapAudit.ts` bez potrzeby tworzenia osobnych koliderów!).

| Model (`.glb`) | Wymiary AABB `X × Y × Z` [m] | Punkt zaczepienia (Origin) | Przód | Gdzie używany | Opis wizualny i czytelność zza kraty (w 1 sekundę) | Budżet tri |
|---|---|---|---|---|---|---:|
| `mall_mannequin` | `1.80 × 2.15 × 0.90` | Środek podestu (`x=0, y=0, z=0`) | `+Z` | Sklepy odzieżowe, sportowe i krawieckie (`S-01`, `S-06`, `S-11`) | **Podświetlony podest z parą stylizowanych manekinów:** niski biały/grafitowy podest ekspozycyjny (`wys. 0.20 m` z rantem `mat_light_white`) i dwie geometryczne sylwetki manekinów (`wys. 1.90 m`) w długich płaszczach/kurtkach Neon Noir z wysokim kołnierzem (`mat_fabric` `#5a4c86`, `mat_lacquer` `#2c3766`, `mat_hivis` `#d08a1c`, świecące obrysy kołnierza `mat_neon_amber`). | ≤ 780 |
| `mall_shoe_wall` | `3.40 × 2.60 × 0.55` | Środek spodu (`x=0, y=0, z=0`), tył regału na `z = 0` | `+Z` | Salon obuwia (`S-02`) i sklep sportowy (`S-11`) | **Podświetlana ściana z półkami na buty:** 5 poziomów skośnych, podświetlanych od spodu półek (`mat_light_white`, `mat_wood`) z rzędami kontrastowych sylwetek butów/sneakersów (`mat_hivis`, `mat_plastic`, `mat_neon_green`, `mat_neon_blue`) oraz lustrem przymierzalni i pufą u podstawy. | ≤ 820 |
| `mall_electronics_shelf` | `3.40 × 2.50 × 0.85` | Środek spodu (`x=0, y=0, z=0`) | `+Z` | Elektronika, audio, optyka i drony (`S-03`, `S-07`, `S-09`, `S-12`, `S-14`) | **Regał ekspozycyjny z ekranami i sprzętem:** stelaż (`mat_machine`, `mat_metal`), na górze ściana 6 świecących monitorów/telewizorów (`mat_screen_ad`, `mat_screen_news`, `mat_neon_blue`, `mat_neon_violet`), na środkowych półkach pudła sprzętu z kodami (`mat_label_barcode`), kolumny audio i gogle VR na stojakach. | ≤ 860 |
| `mall_cafe_set` | `3.20 × 1.75 × 2.20` | Środek spodu (`x=0, y=0, z=0`) | `+Z` | Kawiarnia (`S-04`) i Matcha & Ramen Bar (`S-15`) | **Zestaw zamkniętej kawiarni (krzesła odwrócone do góry nogami na stołach!):** dwa okrągłe stoliki kawiarniane na pierwszym planie z czterema krzesłami położonymi siedziskami na blatach (natychmiastowy sygnał „po zamknięciu!”), a w głębi kontuar z ekspresem ciśnieniowym (`mat_metal`), witryną ciast (`mat_glass_clear`, `mat_light_white`) i tablicą menu (`mat_screen_menu`). | ≤ 940 |
| `mall_pharmacy_counter` | `3.40 × 2.50 × 1.10` | Środek spodu (`x=0, y=0, z=0`) | `+Z` | Apteka i klinika bio-medyczna (`S-08`), drogeria (`S-13`) | **Lada apteczna i regały medyczne:** przeszklona lada z terminalami (`mat_glass_clear`, `mat_light_white`), za nią wysokie białe regały z rzędami zielono-błękitnych pojemników medycznych (`mat_neon_green`, `mat_neon_blue`, `mat_plastic`) oraz świecący zielony krzyż apteczny (`mat_neon_green`) na tylnej ścianie. | ≤ 760 |
| `mall_kurogane_display` | `3.40 × 2.50 × 0.95` | Środek spodu (`x=0, y=0, z=0`) | `+Z` | Salon firmowy Kurogane Urban Gear (`S-05`) i Jubiler/Zegarki (`S-10`) | **Pancerna ekspozycja zbrojeniowo-taktyczna / gabloty:** dwie pionowe gabloty pancerne (`mat_glass_clear`, `mat_container_graphite`) z podświetlonymi stojakami na korpusy karabinów, pancerze taktyczne i zegarki precyzyjne (`mat_metal`, `mat_neon_amber`, `mat_hivis`) oraz kasetony z logo Kurogane. | ≤ 840 |

### 2.2. Priorytet P1 — Szlif wizualny i interaktywny (po pierwszym uruchomieniu `run2`)

| ID | Co można dodać w kolejnym kroku | Gdzie w kodzie / zasobach | Efekt |
|---|---|---|---|
| **F-07** | **Animowany shader kroków / linii świetlnych na ruchomych schodach (`mall_escalator`) i kropli deszczu na świetliku (`mall_skylight`):** przesuwanie UV pasków ostrzegawczych na stopniach (lub migotanie awaryjne zatrzymanego biegu) oraz proceduralny efekt spływających strug deszczu na nachylonych taflach `mall_skylight`. | `src/render/urbanMaterials.ts` | Jeszcze mocniejszy klimat nocnego deszczu nad świetlikiem i ruchu w atrium. |
| **F-08** | **Zniszczalne tafle szklanych balustrad (`mall_glass_rail`):** po trafieniu serią pocisków, cięciu ostrzem plazmowym lub pchnięciu wroga Rezonansem (`resonance_push`) środkowa tafla szkła `mat_glass_clear` w module `mall_glass_rail` rozpada się w `WorldDebris` (zostaje tylko stalowa poręcz lub otwarta wyrwa pozwalająca łatwiej zrzucić wroga do atrium). | `src/world/propPhysics.ts`, `src/scenes/roomScene.ts` | Widowiskowa interakcja walki wręcz i Rezonansu z architekturą galerii. |
| **F-09** | **Przepuszczalność szyb dla pocisków (`blocksProjectiles: false` na blokach `glass_clear`):** opcjonalna flaga w `roomBlockSchema`, która przypisuje blokom szklanym maskę kolizji zatrzymującą kapsułę gracza i wrogów (`CollisionGroup.World`), ale przepuszczającą promienie `castBeam` i pociski (`CollisionGroup.PlayerProjectile \| EnemyProjectile`) lub tłukącą szybę przy pierwszym strzale. | `src/world/roomSchema.ts`, `src/scenes/roomScene.ts` | Strzelanie bezpośrednio przez dolną część szklanych balustrad i szyb windy. *(Uwaga: już w P0 przy wysokości balustrady `1.10 m` i oku gracza na `1.65 m` strzały ponad poręczą między piętrami działają bez tej zmiany).* |

### 2.3. Priorytet P2 — Rozszerzenia opcjonalne

| ID | Co można dodać w przyszłości | Gdzie w kodzie | Efekt |
|---|---|---|---|
| **F-10** | **Sekwencyjne podnoszenie krat 2 wybranych sklepów podczas ostatniej fali (`roomGates`):** w 2. lub 3. fali alarm otwiera do połowy kratę sklepu Kurogane (`S-05`) i elektroniki (`S-03`), skąd wybiegają posiłki, a gracz zyskuje dostęp do wnęki sklepu jako dodatkowej osłony. | `src/world/roomSchema.ts`, `src/scenes/roomScene.ts` | Dynamiczna zmiana układu osłon w trakcie walki. |
| **F-11** | **Ruchoma kabina windy panoramicznej (`mall_elevator`):** powolny ruch kinematycznego bloku kabiny w górę i w dół między L0 (`y = 0`) a L2 (`y = 10.4 m`) w cyklu 14-sekundowym. | `src/scenes/roomScene.ts` | Ruchoma osłona i winda dla gracza w samym sercu atrium. |

---

## 3. Projekt mapy `run2` — GALERIA HANDLOWA „ATRIUM NOVA”

### 3.1. Idea, narracja miejsca i klimat „noc po zamknięciu”

- **Co to za miejsce:** Trzypiętrowa śródmiejska galeria handlowa **„Atrium Nova” (Pasaż Sektorowy N-04)** w dzielnicy komercyjnej kontrolowanej przez Kurogane Arms. W ciągu dnia tętniące życiem centrum zakupowe z butikami odzieżowymi, salonami elektroniki, kawiarnią, apteką i flagowym salonem taktycznym Kurogane; w nocy po godzinie 23:00 — zamknięta, patrolowana przez oddziały bezpieczeństwa enklawa, przez której szklany dach widać ulewę i łunę miasta.
- **Dlaczego gracz tu jest i co tu się dzieje:** Podczas nocnego przebicia przez kordon sektora gracz wchodzi przez południowy przedsionek ewakuacyjny na parterze. Alarm blokady nocnej opuścił ażurowe rolety kratowe (`mall_shutter_grille`) we wszystkich 15 lokalach na trzech piętrach i zatrzymał windę panoramiczną w połowie szybu. Główne oświetlenie dzienne pasażu zostało wygaszone — świecą jedynie lampy dyżurne, podświetlone od środka witryny za kratami, wielobarwne neony szyldów sklepowych oraz reklamy holograficzne zawieszone w przestrzeni atrium.
- **Dlaczego pion jest głównym atutem tej mapy:**
  - Cała mapa jest zorganizowana wokół **centralnego, trzykondygnacyjnego atrium (`24 × 36 m` otworu, wysokość do świetlika `17.2 m`)**, otoczonego ze wszystkich czterech stron pasażami na **Parterze L0 (`y = 0.0 m`)**, **Piętrze L1 (`y = 5.2 m`)** i **Piętrze L2 (`y = 10.4 m`)** oraz przeciętego dwoma **mostkami pieszymi** na różnych wysokościach i czterema biegami **ruchomych schodów**.
  - W przeciwieństwie do `run1` (gdzie walka toczyła się w 4 oddzielnych pomieszczeniach za ścianami działowymi), w `run2` **gracz i wrogowie widzą się i ostrzeliwują diagonalnie między wszystkimi trzema kondygnacjami przez otwarte atrium**, a Rezonans pozwala zrzucać strzelców z mostków i balkonów L1/L2 przez balustrady prosto na posadzkę parteru!

### 3.2. Wymiary główne i przekrój pionowy galerii

Układ współrzędnych świata (zgodny z `_runKit.mjs` i `run1`):
- `+X` = Wschód (prawo), `-X` = Zachód (lewo)
- `+Z` = Południe (dół, strona wejścia `entry`), `-Z` = Północ (góra, strona wyjścia `exit`)
- `+Y` = Góra (posadzka Parteru L0 na `y = 0.000 m`).

| Parametr architektoniczny | Wymiar / Zakres współrzędnych | Uwagi projektowe i walidacyjne |
|---|---|---|
| **Obrys grywalny pasażu (L0, L1, L2)** | `X ∈ [-18, +18]` (`36.0 m` szerokości)<br>`Z ∈ [-25, +25]` (`50.0 m` długości) | Wszystkie krawędzie płyt podłogi i otworu atrium leżą na **liczbach całkowitych** (`validateLayout` 1×1 m). Powierzchnia rzutu parteru: `1 800 m²`; łączna powierzchnia chodzenia na 3 piętrach z mostkami i schodami: **`~3 650 m²`**. |
| **Wnęki sklepowe za kratami (15 lokali)** | Zachód: `X ∈ [-22, -18]` (głęb. `4.0 m`)<br>Wschód: `X ∈ [+18, +22]` (głęb. `4.0 m`)<br>Północ / Południe: `Z ∈ [-29, -25]` i `Z ∈ [+25, +29]` | Całkowity obrys budynku ze sklepami: `44 × 58 m` (`X ∈ [-22, +22], Z ∈ [-29, +29]`). Lico przeziernych krat `mall_shutter_grille` leży dokładnie na granicy pasażu (`X = ±18.0 m`, `Z = ±25.0 m`). |
| **Otwór centralnego Atrium (na L1 i L2)** | `X ∈ [-12, +12]` (`24.0 m` szerokości)<br>`Z ∈ [-18, +18]` (`36.0 m` długości) | Spełnia wymóg briefu (*atrium ~20–24 m szerokości*). Pasaże boczne W i E wokół atrium mają po **`6.0 m` szerokości** (`X ∈ [-18, -12]` oraz `X ∈ [+12, +18]`), a pasaże czołowe N i S po **`7.0 m` szerokości** (`Z ∈ [-25, -18]` oraz `Z ∈ [+18, +25]`). |
| **Kondygnacja 0 — Parter (L0)** | Posadzka: `y = 0.000 m` (płyta `y = -1.0..0.0 m`)<br>Strop pod pasażem L1: `y = 4.80 m` | Wysokość kondygnacji: **`5.20 m`** (`0.00 → 5.20 m`). Prześwit w pasażu pod płytą L1 (`grubość 0.40 m`): `4.80 m` (pod kasetonami lamp `4.35 m`). Wysokość witryn sklepowych: `3.60 m` (z fryzem szyldu do `4.60 m`). |
| **Kondygnacja 1 — Piętro +1 (L1)** | Posadzka: `y = 5.200 m` (płyta `y = 4.80..5.20 m`)<br>Strop pod pasażem L2: `y = 10.00 m` | Wysokość kondygnacji: **`5.20 m`** (`5.20 → 10.40 m`). Prześwit: `4.80 m`. Zawiera **Mostek Południowy** przez atrium (`Z ∈ [+3, +6], X ∈ [-12, +12], y = 5.20 m`). |
| **Kondygnacja 2 — Piętro +2 (L2)** | Posadzka: `y = 10.400 m` (płyta `y = 10.00..10.40 m`)<br>Strop główny pasażu: `y = 15.60 m` | Wysokość kondygnacji: **`5.20 m`** (`10.40 → 15.60 m`). Prześwit: `5.20 m`. Zawiera **Mostek Północny** przez atrium (`Z ∈ [-9, -6], X ∈ [-12, +12], y = 10.40 m`). |
| **Świetlik dachowy nad Atrium** | Podstawa na gzymsie: `y = 15.60 m`<br>Kalenica świetlika: **`y = 17.20 m`** | 6 modułów `mall_skylight` (`24.0 × 1.6 × 6.0 m`) rozpiętych nad otworem atrium `X ∈ [-12, +12], Z ∈ [-18, +18]`. |

#### Przekrój poprzeczny Wschód–Zachód (`Z = 0`, widok na Północ `-Z`)

```text
y=+17.2m               _.-""""""-._   <-- Świetlik dachowy mall_skylight (szkło glass_clear + deszcz na zewnątrz)
y=+15.6m  +==========='            '===========+  <-- Strop główny L2 (ceiling: true)
          | [S-12] | Pasaż W  |            |  Pasaż E | [S-14] |
          | Wnęka  |  (6.0m)  |   ATRIUM   |  (6.0m)  | Wnęka  |  PIĘTRO L2 (y = 10.4m, H = 5.2m)
          | sklepu # [Krata]  | [Mostek L2]|  [Krata] # sklepu |
y=+10.4m  +========+==========+=[glass_rail]+=========+========+
          | [S-07] | Pasaż W  |    (24m)   |  Pasaż E | [S-09] |
          | Wnęka  |  (6.0m)  |  [Winda]   |  (6.0m)  | Wnęka  |  PIĘTRO L1 (y = 5.2m, H = 5.2m)
          | sklepu # [Krata]  | [Mostek L1]|  [Krata] # sklepu |
y=+5.2m   +========+==========+=[glass_rail]+=========+========+
          | [S-02] | Pasaż W  |            |  Pasaż E | [S-04] |
          | Wnęka  |  (6.0m)  | [Fontanna] |  (6.0m)  | Wnęka  |  PARTER L0 (y = 0.0m, H = 5.2m)
          | sklepu # [Krata]  | [Kioski]   |  [Krata] # sklepu |
y=0.0m    +========+==========+============+==========+========+
        X=-22    X=-18      X=-12        X=+12      X=+18    X=+22
```

### 3.3. Rzuty kondygnacji ze współrzędnymi (L0, L1, L2)

#### A. Rzut Kondygnacji 0 — PARTER (`L0`, `y = 0.0 m`)

Na parterze cała płyta `X ∈ [-18, +18], Z ∈ [-25, +25]` jest ciągłą powierzchnią chodzenia. Obrys atrium `X ∈ [-12, +12], Z ∈ [-18, +18]` jest wyznaczony na posadzce zmianą materiału (`mall_terrazzo_inlay` wokół `mall_stone_floor`) oraz 12 słupami konstrukcyjnymi (`X = ±12, Z = -18, -9, 0, +9, +18` oraz `X = 0, Z = ±18`) podtrzymującymi galerie L1 i L2.

```text
                                  PÓŁNOC (-Z) — WYJŚCIE
        X=-22   X=-18          X=-12          X=0           X=+12          X=+18   X=+22
Z=-29    +-------+--------------+=============+=============+--------------+-------+
         |       |   [S-05 KUROGANE URBAN GEAR]   |    [WINDA]   | [Klatka N-E] |       |
Z=-25    +-------+=======#==============#=====+===[EXIT]====+==============+-------+
         | [S-03]| [Klatka N-W]               |  (X=0,Z=-25)|   Schody L0->L1      |
         | VOLT-X| Schody L0->L1    PASAŻ     |   [Winda]   |   (bieg N-E)   [S-04]|
         | ELEK- | (bieg N-W)      PÓŁNOCNY   |  panoram.   |                KAWIA-|
         | TRO-  |                            | (X=0,Z=-16) |                RNIA  |
Z=-18    | NIKA  #       +--------------------+------+------+              # NOVA  |
         | (W)   |       | [Donica]   ||Schody ruch.||   [Donica]  |       | ROAST |
         +-------+       |            ||ESC-2 L0->L1||             |       +-------+
         |       | PASAŻ |            || (X=-6..-3.6||   [Kiosk K2]| PASAŻ |       |
         | [S-02]| ZACH. | [Ławka]    || Z=-15..-4) ||   (X=+7,    | WSCH. |       |
         | STRIDE| (6m)  |            +-------------+    Z=-9)     | (6m)  | [S-04]|
         | OBUWIE|       |                                         |       | (cd.) |
Z=0      | (W)   # [Fil] |         [FONTANNA ATRIUM NOVA]          | [Fil] #       |
         |       |       |          mall_fountain (6.4x6.4m)       |       |       |
         +-------+       |             (X=0, Y=0, Z=0)             |       +-------+
         |       |       |                                         |       |       |
         | [S-01]|       | [Kiosk K1]      +-------------+ [Ławka] |       | [S-05]|
         | VERVE |       | (X=-7, Z=+9)    ||Schody ruch.||        |       | KURO- |
         | MODA  |       |                 ||ESC-1 L0->L1||        |       | GANE  |
         | (S-W) #       | [Donica]        || (X=+3.6..+6||[Donica]|       # SALON |
Z=+18    |       |       +-----------------++ Z=+4..+15) ++--------+       | (S-E) |
         +-------+                  [Bramka laserowa]                      +-------+
         |       |  [Informator]    PASAŻ POŁUDNIOWY      [Informator]     |       |
         |       |  (X=-8,Z=+20)     (START GRACZA)       (X=+8,Z=+20)     |       |
         |       |                    (X=0, Z=+22)                         |       |
Z=+25    +-------+=====================[ENTRY]=============================+-------+
        X=-22   X=-18                 X=0 (Z=+25.5)                       X=+18   X=+22
                                  POŁUDNIE (+Z) — START
```

#### B. Rzut Kondygnacji 1 — PIĘTRO +1 (`L1`, `y = 5.20 m`)

Na Piętrze L1 środek `X ∈ [-12, +12], Z ∈ [-18, +18]` jest **otwartą pustką atrium** otoczoną szklaną balustradą `mall_glass_rail` (`wys. 1.10 m`), z przerwami wyłącznie na spoczniki ruchomych schodów (`ESC-1..ESC-4`), drzwi windy panoramicznej (`X = 0, Z = -14.2`) oraz **Mostek Południowy** (`Z ∈ [+3, +6], X ∈ [-12, +12]`, szerokość `3.0 m`), który spina zachodni i wschodni pasaż L1 bezpośrednio nad południową częścią atrium.

```text
                                  PÓŁNOC (-Z) — PIĘTRO L1 (y = 5.20 m)
        X=-22   X=-18          X=-12          X=0           X=+12          X=+18   X=+22
Z=-29    +-------+--------------+=============+=============+--------------+-------+
         |       |        [S-08 APTEKA BIO-MED]             | [Klatka N-E] |       |
Z=-25    +-------+=======#============================#=====+==============+-------+
         |       | [Klatka N-W]     PASAŻ PÓŁNOCNY L1       | Schody L1->L2|       |
         | [S-07]| Schody L0/L2     [Ławka]   [Donica]      | (bieg N-E)   | [S-09]|
         | IRIS  |                  +--------------+        |              | ECHO  |
Z=-18    | OPTYKA#======[glass_rail]| WINDA (L1)   |[glass_rail]===========# AUDIO |
         | & CYB.|       |          | (X=0, Z=-16) |               |       | & SYN.|
         +-------+       |          +--------------+               |       +-------+
         |       | PASAŻ |  ||Wyjście ESC-2||  ||Wejście ESC-4||   | PASAŻ |       |
         |       | ZACH. |  ||z L0 (X=-4.8)||  ||na L2 (X=+4.8)||  | WSCH. |       |
         | [S-06]|  L1   |                                         |  L1   | [S-10]|
         | KRAW- | (6m)  |         PUSTKA ATRIUM (24 x 36 m)       | (6m)  | AUREA |
Z=0      | IECTWO# [Don] |       (widok w dół na Fontannę L0       | [Don] # ZEGAR-|
         | NEO-  |       |        i w górę na Mostek L2)           |       | KI &  |
         | TAILOR|       +=========================================+       | BIŻU. |
Z=+3     +-------+       |   MOSTEK POŁUDNIOWY L1 (y=5.2m, sz.3m)  |       +-------+
Z=+6     |       |       +===========[Kiosk K3 (X=0,Z=4.5)]========+       |       |
         |       |       |                                         |       |       |
         |       |       |  ||Wejście ESC-3||  ||Wyjście ESC-1||   |       |       |
         |       |       |  ||na L2 (X=-4.8)|| ||z L0 (X=+4.8)||   |       |       |
Z=+18    |       #       +==============[glass_rail]===============+       #       |
         +-------+        [Donica]    PASAŻ POŁUDNIOWY L1   [Ławka]        +-------+
         |       |        (widok z góry na strefę STARTU L0)               |       |
Z=+25    +-------+=========================================================+-------+
```

#### C. Rzut Kondygnacji 2 — PIĘTRO +2 (`L2`, `y = 10.40 m`)

Na Piętrze L2 pasaże obiegają całe atrium na wysokości `10.40 m` pod świetlikiem dachowym (`y = 15.60..17.20 m`). Zachodni i wschodni pasaż L2 spina **Mostek Północny** (`Z ∈ [-9, -6], X ∈ [-12, +12], y = 10.40 m`, szerokość `3.0 m`). Ponieważ Mostek L2 leży po stronie północnej (`Z = -7.5`), a Mostek L1 po stronie południowej (`Z = +4.5`), **mostki nie zasłaniają się nawzajem w pionie** — z Mostka L2 widać bezpośrednio zarówno Mostek L1, jak i całą Fontannę oraz wejście na Parterze L0!

```text
                                  PÓŁNOC (-Z) — PIĘTRO L2 (y = 10.40 m)
        X=-22   X=-18          X=-12          X=0           X=+12          X=+18   X=+22
Z=-29    +-------+--------------+=============+=============+--------------+-------+
         |       |       [S-13 DROGERIA & SYNTH-PERFUME]    | [Klatka N-E] |       |
Z=-25    +-------+=======#============================#=====+==============+-------+
         |       | [Klatka N-W]     PASAŻ PÓŁNOCNY L2       | Spocznik L2  |       |
         | [S-12]| Spocznik L2      [Donica]  [Informator]  |              | [S-14]|
         | KODEKS|                  +--------------+        |              | DRONY |
Z=-18    | KSIĘ- #======[glass_rail]| WINDA (L2)   |[glass_rail]===========# & HOB-|
         | GARNIA|       |          | (X=0, Z=-16) |               |       | BY    |
         +-------+       |          +--------------+               |       +-------+
         |       | PASAŻ |                  ||Wyjście ESC-4||      | PASAŻ |       |
         |       | ZACH. |                  ||z L1 (X=+4.8)||      | WSCH. |       |
Z=-9     |       |  L2   +=========================================+  L2   |       |
         | [S-11]| (6m)  |   MOSTEK PÓŁNOCNY L2 (y=10.4m, sz.3m)   | (6m)  | [S-15]|
Z=-6     | APEX  #       +=======[Donica / Osłona (X=0,Z=-7.5)]====+       # MATCHA|
         | SPORT |       |                                         |       | & TEA |
Z=0      | & OUT-| [Ław] |         PUSTKA ATRIUM (24 x 36 m)       | [Ław] | LOUNGE|
         | DOOR  |       |    (pełny przestrzał na L1 i L0!)       |       | (E)   |
         +-------+       |                                         |       +-------+
         |       |       |  ||Wyjście ESC-3||                      |       |       |
         |       |       |  ||z L1 (X=-4.8)||                      |       |       |
Z=+18    |       #       +==============[glass_rail]===============+       #       |
         +-------+        [Donica]    PASAŻ POŁUDNIOWY L2   [Donica]       +-------+
         |       |       [S-11B GALANTERIA / BAGAŻ — Witryna S]            |       |
Z=+25    +-------+=======#============================#====================+-------+
```

### 3.4. Lista 15 sklepów (każdy inny branżowo, z nazwą, neonem i ekspozycją widoczną za kratą)

Każdy lokal składa się z:
1. Portalu frontowego `mall_storefront` (`6.0 × 4.6 × 0.5 m`, w szerszych lokalach 2 moduły obok siebie) z opuszczoną ażurową roletą kratową `mall_shutter_grille` (`4.0 × 3.6 × 0.18 m`) w płaszczyźnie ściany pasażu.
2. Świecącego szyldu neonowego (`signs[]`, `kind: "neon"`) na fryzie nad kratą (`wys. środka = y_piętra + 4.10 m`).
3. Fizycznej wnęki sklepowej o głębokości `4.0 m` za kratą (`X ∈ [-22, -18]` na zachodzie, `X ∈ [+18, +22]` na wschodzie, `Z ∈ [-29, -25]` na północy, `Z ∈ [+25, +29]` na południu), wyłożonej posadzką `mall_terrazzo_inlay`, ścianami `tiles_wall` / `lacquer` / `wood`, oświetlonej od wewnątrz ciepłym lub kolorowym światłem nocnym (`lights[]` z `floorY: y_piętra`) i wypełnionej modelami towaru (`decor[]`) oddalonymi o `0.8–3.0 m` za kratą.

| ID | Kondygnacja | Nazwa sklepu i szyld (`signs[].texture`) | Branża | Położenie wnęki `[X, Z]` i orientacja kraty | Barwa neonu i światła nocnego (ADR 0006) | Co dokładnie widać za przezierną kratą `mall_shutter_grille` (modele w `decor[]` + bloki wnętrza) |
|---|---|---|---|---|---|---|
| **S-01** | **L0** (`y=0.0`) | **VERVE // ATELIER**<br>(`mall_fashion`) | Butik mody miejskiej Neon Noir | Zachód-Południe:<br>`X ∈ [-22, -18]`<br>`Z ∈ [+4, +16]`<br>(2 kraty, przód `+X`) | **Bursztyn** `#ffae1a` + ciepła biel `#fff1d6` | 3× `mall_mannequin` ustawione w półkolu na podświetlonych podestach (płaszcze z wysokim kołnierzem), z tyłu chromowany wieszak z ubraniami (`blocks` z `mat_fabric` i `mat_metal`), lustro od podłogi do sufitu i lada kasowa z terminalem `wh_wall_terminal`. |
| **S-02** | **L0** (`y=0.0`) | **STRIDE // FOOTWEAR**<br>(`mall_footwear`) | Salon obuwia i sneakersów | Zachód-Środek:<br>`X ∈ [-22, -18]`<br>`Z ∈ [-10, +2]`<br>(2 kraty, przód `+X`) | **Zieleń** `#6dff4a` + ciepła biel `#fff1d6` | 2× `mall_shoe_wall` (5 podświetlanych półek z rzędami butów na ścianie tylnej i bocznej), na pierwszym planie za kratą centralny stolik ekspozycyjny z pojedynczymi parami butów pod kloszami `mat_glass_clear` oraz dwie tapicerowane pufy do mierzenia (`mat_fabric`). |
| **S-03** | **L0** (`y=0.0`) | **VOLT-X // CYBER-AV**<br>(`mall_electronics`) | Supermarket elektroniki i ekranów | Zachód-Północ:<br>`X ∈ [-22, -18]`<br>`Z ∈ [-24, -12]`<br>(2 kraty, przód `+X`) | **Błękit królewski** `#3d7bff` + fiolet `#8a5cff` | 2× `mall_electronics_shelf` ze ścianą świecących telewizorów (`mat_screen_ad`, `mat_screen_news`), w głębi 2× `wh_server_rack` z migającymi diodami, na środku stoisko demonstracyjne z projektorami `city_holo_projector` i stosami pudeł ze sprzętem (`mat_label_barcode`). |
| **S-04** | **L0** (`y=0.0`) | **NOVA ROAST // CAFE**<br>(`cat_cafe` + `noodles`) | Kawiarnia i cukiernia | Wschód-Północ/Środek:<br>`X ∈ [+18, +22]`<br>`Z ∈ [-16, -2]`<br>(2 kraty, przód `-X`) | **Bursztyn** `#ffae1a` + ciepła biel `#fff1d6` | 2× `mall_cafe_set` — cztery stoliki z **krzesłami odwróconymi do góry nogami na blatach** (czytelny znak zamkniętego lokalu po sprzątaniu), w głębi długi drewniano-stalowy kontuar z ekspresem ciśnieniowym, przeszkloną witryną z ciastami i świecącym ekranem menu (`mat_screen_menu`). |
| **S-05** | **L0** (`y=0.0`) | **KUROGANE // URBAN GEAR**<br>(`mall_kurogane`) | Flagowy salon broni cywilnej, pancerzy i osprzętu Kurogane | Wschód-Południe:<br>`X ∈ [+18, +22]`<br>`Z ∈ [0, +16]`<br>(2 kraty, przód `-X`) | **Bursztyn** `#ffae1a` + błękit `#3d7bff` | 2× `mall_kurogane_display` (pancerne gabloty z korpusami broni i pancerzami), 1× `mall_mannequin` w ciemnym pancerzu taktycznym Kurogane, 2× `wh_weapon_case_stack` (pancerne walizy z bronią na podestach), w głębi stół serwisowy `wh_workbench_weapons` i hologram `holo_kurogane` (`size: 1.5×1.5 m`). |
| **S-06** | **L1** (`y=5.2`) | **NEO-TAILOR // BESPOKE**<br>(`tattoo` / `mall_fashion`) | Krawiectwo syntetyczne i odzież formalna | Zachód-Południe (L1):<br>`X ∈ [-22, -18]`<br>`Z ∈ [+2, +16]`<br>(2 kraty, przód `+X`) | **Fiolet** `#8a5cff` + ciepła biel `#fff1d6` | 2× `mall_mannequin` w garniturach/płaszczach na obrotowych podestach, stół krojczy z belkami tkanin (`blocks` z `mat_fabric` i `mat_wood`), parownica i trzyskrzydłowe lustro przymierzalni podświetlone ciepłymi kinkietami. |
| **S-07** | **L1** (`y=5.2`) | **IRIS // OPTICS & AUG**<br>(`mall_optics` + `implants`) | Salon optyczny, cyber-gogle i implanty wzroku | Zachód-Północ (L1):<br>`X ∈ [-22, -18]`<br>`Z ∈ [-16, -2]`<br>(2 kraty, przód `+X`) | **Błękit królewski** `#3d7bff` + ciepła biel `#fff1d6` | 1× `mall_electronics_shelf` z ekspozycją gogli i soczewek w podświetlanych niszach, fotel badania wzroku z aparaturą optyczną (`blocks` z `mat_machine` i `mat_light_white`), hologram `holo_implant` (`tint: "#3d7bff"`) nad szklaną ladą i tablice testowe ostrości wzroku. |
| **S-08** | **L1** (`y=5.2`) | **HELIX-MED // APTEKA 24H**<br>(`pharmacy`) | Apteka i punkt doraźnej bio-medycyny | Północ-Środek (L1):<br>`X ∈ [-12, -2]`<br>`Z ∈ [-29, -25]`<br>(2 kraty, przód `+Z`) | **Zieleń** `#6dff4a` + ciepła biel `#fff1d6` | 2× `mall_pharmacy_counter` — sterylna, jasno oświetlona lada z szybą ochronną, za nią regały po sufit z zielonymi i błękitnymi opakowaniami leków, automat wydający `city_vending` we wnęce oraz świecący zielony krzyż apteczny widoczny przez całe atrium z południa. |
| **S-09** | **L1** (`y=5.2`) | **ECHO // SYNTH & AUDIO**<br>(`arcade` + `karaoke`) | Salon instrumentów, syntezatorów i hi-fi | Wschód-Północ (L1):<br>`X ∈ [+18, +22]`<br>`Z ∈ [-16, -2]`<br>(2 kraty, przód `-X`) | **Fiolet** `#8a5cff` + bursztyn `#ffae1a` | 1× `mall_electronics_shelf`, rząd wysokich kolumn głośnikowych i statywów z klawiaturami syntezatorów (`blocks` z `mat_machine`, `mat_wood`, `mat_neon_violet`), ściana wygłuszająca z paneli piramidowych i bursztynowy korektor graficzny na ekranie `city_ad_screen`. |
| **S-10** | **L1** (`y=5.2`) | **AUREA // HOROLOGY**<br>(`mall_jewelry`) | Jubiler i salon zegarków precyzyjnych | Wschód-Południe (L1):<br>`X ∈ [+18, +22]`<br>`Z ∈ [+2, +16]`<br>(2 kraty, przód `-X`) | **Ciepła biel** `#fff1d6` + bursztyn `#ffae1a` | 2× `mall_kurogane_display` (w roli pancernych gablot jubilerskich na wyspach ze złotawym podświetleniem `mat_neon_amber`), aksamitne ekspozytory na zegarki pod szkłem `mat_glass_clear`, a w głębi okrągłe drzwi skarbca (`mat_metal`, `mat_trim`) z zieloną diodą blokady. |
| **S-11** | **L2** (`y=10.4`) | **APEX // OUTDOOR & SPORT**<br>(`mall_footwear` + `open`) | Sklep sportowy, wspinaczkowy i survivalowy | Zachód-Południe (L2):<br>`X ∈ [-22, -18]`<br>`Z ∈ [+2, +16]`<br>(2 kraty, przód `+X`) | **Zieleń** `#6dff4a` + bursztyn `#ffae1a` | 1× `mall_mannequin` w kombinezonie wysokogórskim, 1× `mall_shoe_wall` z butami trekkingowymi, w głębi rozstawiony namiot ekspozycyjny `hw_camp_tent_dome` (`3.28 × 1.28 × 2.87 m`) na sztucznej skale oraz stojak z deskami i plecakami. *(Jedyny sklep, w którym namiot jest towarem na wystawie!).* |
| **S-12** | **L2** (`y=10.4`) | **KODEKS // BOOKS & HOLO**<br>(`mall_books`) | Księgarnia, albumy i czytelnia holo-mediów | Zachód-Północ (L2):<br>`X ∈ [-22, -18]`<br>`Z ∈ [-16, -2]`<br>(2 kraty, przód `+X`) | **Ciepła biel** `#fff1d6` + bursztyn `#ffae1a` | 3 rzędy drewnianych regałów bibliotecznych (`mat_wood`) wypełnionych barwnymi grzbietami książek (`mat_paint`, `mat_lacquer`, `mat_hivis`), na pierwszym planie stolik z piramidą bestsellerów, fotel czytelniczy z lampką stojącą i ekran `mall_electronics_shelf` z e-bookami. |
| **S-13** | **L2** (`y=10.4`) | **AURA // SYNTH-PERFUME**<br>(`cocktail`) | Drogeria i laboratorium perfum syntetycznych | Północ-Środek (L2):<br>`X ∈ [-12, -2]`<br>`Z ∈ [-29, -25]`<br>(2 kraty, przód `+Z`) | **Fiolet** `#8a5cff` + ciepła biel `#fff1d6` | 1× `mall_pharmacy_counter` z podświetlanymi na fioletowo i złoto półkami flakonów (`mat_glass_clear`, `mat_neon_violet`, `mat_neon_amber`), okrągła wyspa testerów na środku i wielki plakat reklamowy na tylnej ścianie. |
| **S-14** | **L2** (`y=10.4`) | **AERO-TOY // DRONY & RC**<br>(`repair` + `arcade`) | Sklep z dronami cywilnymi, modelami i serwisem | Wschód-Północ (L2):<br>`X ∈ [+18, +22]`<br>`Z ∈ [-16, -2]`<br>(2 kraty, przód `-X`) | **Błękit królewski** `#3d7bff` + zieleń `#6dff4a` | 1× `mall_electronics_shelf` z pudłami modeli RC, stół montażowy `wh_workbench_weapons` z częściami zamiennymi, a pod sufitem witryny zawieszone na żyłkach 3 nieruchome makiety cywilnych quadkopterów (`blocks` z `mat_plastic` i `mat_neon_green`) oraz hologram `holo_android`. |
| **S-15** | **L2** (`y=10.4`) | **MIDORI // MATCHA & RAMEN**<br>(`ramen` + `bar_mleczny`) | Herbaciarnia matcha i bar japoński na piętrze | Wschód-Południe (L2):<br>`X ∈ [+18, +22]`<br>`Z ∈ [+2, +16]`<br>(2 kraty, przód `-X`) | **Zieleń** `#6dff4a` + bursztyn `#ffae1a` | 2× `mall_cafe_set` (krzesła na stołach), nad kontuarem sznur bursztynowych lampionów `city_lantern_string` (rozpięty między ścianami bocznymi wnęki `Z = +3..+13`), drewniana ścianka działowa ze szczeblami (`mat_wood`) i hologram `holo_noodles` za kratą. |

*(Dodatkowo w południowej ścianie Piętra L2 `X ∈ [-8, +8], Z ∈ [+25, +29]` znajduje się płytka witryna wystawowa **S-11B „VOYAGER // BAGAŻ & GALANTERIA”** z walizkami podróżnymi i manekinem z plecakiem za kratą `mall_shutter_grille`, domykająca wizualnie południową pierzeję atrium).*

### 3.5. Komunikacja pionowa i pozioma: ruchome schody, winda, klatki schodowe, mostki, start i wyjście

Pionowa pętla ruchu została zaprojektowana tak, aby **z każdej kondygnacji istniały co najmniej 3 niezależne drogi wejścia/zejścia**, a wszystkie powierzchnie `walkable: true` spełniały rygory `ArenaSurfaceNavigation` (rampy czyste osiowo w `Z`, nachylenie `26.565°`, prześwit `≥ 3.2 m`):

1. **4 biegi ruchomych schodów w atrium (`mall_escalator` + niewidoczne rampy `walkable: true`):**
   - **`ESC-1` (Parter L0 → Piętro L1, strona południowo-wschodnia atrium):**
     - Rzut: `X ∈ [+3.6, +6.0]` (szer. modelu `2.4 m`, szer. kolidera chodzenia `1.6 m` na `X ∈ [+4.0, +5.6]`), `Z ∈ [+4.0, +14.4]`.
     - Dolny spocznik na L0: `(X = +4.8, Y = 0.0, Z = +15.0)` — tuż przed wzrokiem gracza wchodzącego z `playerSpawn (0, 0, +22)`!
     - Górny spocznik na L1: `(X = +4.8, Y = 5.2, Z = +3.5)` — wychodzi wprost na **Mostek Południowy L1** (`Z ∈ [+3, +6]`) oraz do wschodniego pasażu L1.
   - **`ESC-2` (Parter L0 → Piętro L1, strona północno-zachodnia atrium):**
     - Rzut: `X ∈ [-6.0, -3.6]`, `Z ∈ [-14.4, -4.0]`.
     - Dolny spocznik na L0: `(X = -4.8, Y = 0.0, Z = -3.5)` (obok Fontanny).
     - Górny spocznik na L1: `(X = -4.8, Y = 5.2, Z = -15.0)` — wychodzi na północno-zachodni narożnik balkonu L1 przy Windzie Panoramicznej.
   - **`ESC-3` (Piętro L1 → Piętro L2, strona południowo-zachodnia atrium):**
     - Rzut: `X ∈ [-6.0, -3.6]`, `Z ∈ [+6.0, +16.4]`.
     - Dolny spocznik na L1: `(X = -4.8, Y = 5.2, Z = +5.5)` — wejście bezpośrednio z **Mostka Południowego L1**!
     - Górny spocznik na L2: `(X = -4.8, Y = 10.4, Z = +17.0)` — wychodzi na południowy balkon L2 (`Z ∈ [+18, +25]`).
   - **`ESC-4` (Piętro L1 → Piętro L2, strona północno-wschodnia atrium):**
     - Rzut: `X ∈ [+3.6, +6.0]`, `Z ∈ [-16.4, -6.0]`.
     - Dolny spocznik na L1: `(X = +4.8, Y = 5.2, Z = -17.0)` — wejście z północnego balkonu L1 przy Windzie.
     - Górny spocznik na L2: `(X = +4.8, Y = 10.4, Z = -5.5)` — wychodzi bezpośrednio na **Mostek Północny L2** (`Z ∈ [-9, -6]`)!

2. **2 boczne klatki schodowe / rampy ewakuacyjne w narożnikach północnych (`Klatka N-W` i `Klatka N-E`):**
   - Aby gracz i AI mieli alternatywę dla odsłoniętych ruchomych schodów w atrium, w północno-zachodnim (`X ∈ [-18, -14], Z ∈ [-25, -18]`) i północno-wschodnim (`X ∈ [+14, +18], Z ∈ [-25, -18]`) narożniku pasażu znajdują się szerokie (`3.0 m`), dwubiegowe schody/rampy ze spocznikami pośrednimi na `y = 2.6 m` i `y = 7.8 m` (`material: "tread_plate"`, `walkable: true`), łączące L0 ↔ L1 ↔ L2 za osłoną filarów konstrukcyjnych.

3. **2 mostki piesze nad atrium:**
   - **Mostek Południowy na L1 (`y = 5.20 m`):** `X ∈ [-12, +12], Z ∈ [+3.0, +6.0]` (szerokość `3.0 m`, płyta `0.40 m`, `material: "mall_stone_floor"`, `walkable: true`), z balustradami `mall_glass_rail` po obu bokach (z przerwami `2.4 m` na spoczniki `ESC-1` przy `X = +4.8` i `ESC-3` przy `X = -4.8`) oraz niskim kioskiem wyspowym `mall_kiosk` (`K3`) pośrodku (`X = 0, Y = 5.2, Z = +4.5`, z przejściem `1.5 m` po bokach lub wybrzuszeniem pomostu do `Z ∈ [+2.0, +7.0]` na środku `X ∈ [-3, +3]`, tak by wokół kiosku był swobodny korytarz `1.8 m`!).
   - **Mostek Północny na L2 (`y = 10.40 m`):** `X ∈ [-12, +12], Z ∈ [-9.0, -6.0]` (szerokość `3.0 m`, z wybrzuszeniem `Z ∈ [-10.0, -5.0]` na środku `X ∈ [-3, +3]` mieszczącym donicę `mall_planter` i dwie ławki `mall_bench` jako osłonę na wysokości `10.4 m`), ze spocznikiem `ESC-4` przy `X = +4.8`.

4. **Przeszklona Winda Panoramiczna (`mall_elevator`):**
   - Szyb stoi przy północnej krawędzi otworu atrium: `X ∈ [-1.8, +1.8], Z ∈ [-17.8, -14.2]` (`3.6 × 3.6 m`), przylegając od północy bezpośrednio do balkonów L1 i L2 (`Z = -18`) i przechodząc przez wszystkie trzy kondygnacje od `y = 0.0` do `y = 15.8 m`.
   - Kabina windy jest zatrzymana awaryjnie z podłogą na `y = 5.20 m` (drzwi od strony północnego pasażu L1 `Z = -18` są rozsunięte na `1.6 m` — gracz na L1 może wejść do środka przeszklonej kabiny jako osłoniętego gniazda strzeleckiego z widokiem 270° na atrium!).

5. **Start gracza (`playerSpawn` i `doors[entry]`) oraz wyjście (`doors[exit]`):**
   - **Wejście (`doors[0]`):** `{ id: "entry", role: "entry", position: { x: 0, y: 1.5, z: 25.5 }, size: { x: 4, y: 3, z: 1 } }` w osi południowego pasażu parteru (`L0`).
   - **`playerSpawn`:** `{ x: 0, y: 0, z: 22 }` — 3.5 m przed drzwiami wejściowymi, za dwoma pylonami informacyjnymi `mall_directory` i donicą `mall_planter` (`X = 0, Z = 19.5`), z natychmiastowym, zapierającym dech kadrem na całe 3-piętrowe atrium, Fontannę, Mostek L1, Mostek L2, Windę Panoramiczną i deszczowy świetlik na `y = 17.2 m`.
   - **Wyjście (`doors[1]`):** `{ id: "exit", role: "exit", position: { x: 0, y: 1.5, z: -25.5 }, size: { x: 4, y: 3, z: 1 } }` w północnej ścianie parteru (`L0`), dokładnie na osi za szybem Windy Panoramicznej, oznaczone zielonym portalem ewakuacyjnym `#6dff4a` i wielkim szyldem `EXIT // N-04`.

### 3.6. Walka między piętrami, linie wzroku przez atrium, osłony i hazardy

Mapa wspiera wszystkie trzy ścieżki rozwoju postaci (Ostrze, Rezonans, Strzelec), wykorzystując pion atrium:

1. **Linie wzroku między piętrami (geometria kąta strzału ponad balustradą `1.10 m`):**
   - Balustrady wokół atrium (`mall_glass_rail`) mają wysokość `1.10 m`, a oko stojącego gracza znajduje się na `1.65 m` nad posadzką danego piętra (oczy wrogów na `1.50–1.60 m`).
   - Dzięki temu **strzelec stojący przy balustradzie na Piętrze L1 (`oko y = 6.85 m`) lub L2 (`oko y = 12.05 m`) ma czystą linię strzału ponad górną poręczą wprost na posadzkę Parteru L0, na przeciwległy balkon oraz na oba mostki**, a przez przezroczyste szkło `mat_glass_clear` widzi sylwetki wrogów nawet podczas kucania!
   - Jednocześnie linie wzroku nie są „pustą strzelnicą” — w osi pionowej i poziomej przełamują je:
     - **Centralna rzeźba Fontanny (`mall_fountain`)** na parterze (`X = 0, Z = 0`, wys. `3.80 m`),
     - **Szyb Windy Panoramicznej (`mall_elevator`)** na północy atrium (`X = 0, Z = -16`, wys. `15.8 m`),
     - **Kratownice 4 biegów ruchomych schodów (`mall_escalator`)** zawieszone ukośnie w przestrzeni atrium,
     - **12 słupów konstrukcyjnych** (`1.0 × 15.6 × 1.0 m`, materiał `lacquer` / `concrete` z pionowymi listwami `trim`) stojących na narożnikach i co `9.0 m` wzdłuż krawędzi otworu atrium (`X = ±12, Z = -18, -9, 0, +9, +18`),
     - **3 wielkie pionowe banery holograficzne** zawieszone w przestrzeni atrium między L1 a L2 (`X = -8, Z = -2`, `X = +8, Z = +10`, `X = 0, Z = +13`).

2. **Rozmieszczenie osłon do walki na 3 kondygnacjach (brak pustej podłogi):**
   - **Parter L0 (`y = 0.0 m`):**
     - *Środek atrium:* Fontanna `mall_fountain` (`X = 0, Z = 0`, cembrowina `6.4 × 0.95 × 6.4 m` + trzon `2.2 × 3.8 × 2.2 m`) otoczona 4 ławkami `mall_bench` (`(±5.2, 0, 0)` i `(0, 0, ±5.2)`).
     - *Południowa część atrium i start:* donica `mall_planter` na osi startu `(0, 0, 19.5)`, dwa pylony `mall_directory` `(±6.5, 0, 20.5)`, kiosk wyspowy `mall_kiosk` `K1` w `(-7.5, 0, +9.5)` (kawiarnia wyspowa), donice `(-8.5, 0, +15.0)` i `(+8.5, 0, +15.0)`.
     - *Północna część atrium i wyjście:* kiosk wyspowy `mall_kiosk` `K2` w `(+7.5, 0, -9.5)` (punkt z elektroniką/zegarkami), donice `(±7.5, 0, -15.5)` osłaniające podejście wokół szybu windy do drzwi `exit`, wózek serwisowy / podnośnik konserwatora pod świetlikiem `(-3.5, 0, +6.5)`.
     - *Pasaże boczne L0 (`X ∈ [-18, -12]` i `X ∈ [+12, +18]`):* ławki `mall_bench` i donice `mall_planter` ustawione naprzemiennie co `8–10 m` oraz 2 automaty `city_vending` przy wnękach klatek schodowych.
   - **Piętro L1 (`y = 5.20 m`):**
     - Kiosk `mall_kiosk` `K3` na wybrzuszeniu Mostka Południowego `(0, 5.2, +4.5)`, 6 donic `mall_planter` i 6 ławek `mall_bench` wzdłuż pasaży W, E, N, S, otwarta kabina Windy Panoramicznej `(0, 5.2, -16.0)` oraz 2 pylony `mall_directory` przy wyjściach z ruchomych schodów.
   - **Piętro L2 (`y = 10.40 m`):**
     - Wyspa z donicy `mall_planter` i dwóch ławek `mall_bench` na wybrzuszeniu Mostka Północnego `(0, 10.4, -7.5)`, 6 donic i 4 ławki w pasażach L2, stanowisko serwisowe oświetlenia świetlika z osłonami `cover_low` na południowym balkonie L2 `(0, 10.4, +20.5)`.
   - **Obiekty fizyczne do Chwytu Rezonansem (`crate` i `crate_small`):**
     - **10× `crate` (`1.0 × 1.0 × 1.0 m`, zniszczalne, jasny materiał `interactive` `#d9dde3`)** — skrzynie dostawcze nocnego zaopatrzenia stojące przy opuszczonych kratach sklepów (4 na L0 przy `S-01`, `S-03`, `S-05`, 4 na L1 przy `S-07`, `S-08`, `S-10`, 2 na L2 przy `S-11`, `S-14`).
     - **12× `crate_small` (`0.5 × 0.5 × 0.5 m`, dynamiczne do Chwytu Rezonansem)** — rozłożone na cembrowinie Fontanny L0, przy Kioskach K1–K3 i na obu mostkach, pozwalające graczowi błyskawicznie chwytać pociski fizyczne i ciskać nimi w strzelców na wyższych piętrach!

3. **Zagrożenia środowiskowe (`hazards[]`):**
   - *(Uwaga walidacyjna: ponieważ `validateLayout` w `roomSchema.ts:454` sprawdza, czy obrys każdego `hazard` leży wewnątrz rzutu płyt podłogi `groundY = 0`, wszystkie 4 hazardy umieszczamy na Parterze L0 `y = 0`, gdzie cały rzut `X ∈ [-18, +18], Z ∈ [-25, +25]` jest podłogą `y = 0` i żaden punkt spawnu nie leży bliżej niż `2.5 m` od nich!)*:
   1. **`laser_gate` (`id: "south-security-cordon"`):** `from: { x: -4.5, y: 0.85, z: 16.5 }`, `to: { x: +4.5, y: 0.85, z: 16.5 }`, `cycle: { onS: 2.6, offS: 1.8 }` — bramka laserowa kordonu bezpieczeństwa Kurogane spinająca dwa słupki sensorowe między wejściem południowym a atrium (gracz na starcie może prześlizgnąć się w oknie `offS`, przeskoczyć wiązkę albo od razu obiec ją pasażem zachodnim lub wschodnim!).
   2. **`electric_field` (`id: "fountain-short-circuit"`):** `position: { x: -5.5, y: 0, z: -2.0 }`, `size: { x: 2.6, y: 2.0, z: 3.2 }`, `cycle: { onS: 3.0, offS: 2.4 }` — przebicie z rozbitej skrzynki pompy fontanny i automatu myjącego posadzkę po zachodniej stronie basenu fontanny (idealne miejsce do wpychania wrogów Pchnięciem Rezonansu lub zrzucania ich z Mostka L1!).
   3. **`explosive_barrel` (`id: "atrium-lift-cell"`):** `position: { x: -3.2, y: 0, z: 7.0 }` — ogniwo energetyczne przy podnośniku konserwatora w południowej części atrium pod Mostkiem L1.
   4. **`explosive_barrel` (`id: "elevator-ups-cell"`):** `position: { x: 4.2, y: 0, z: -15.5 }` — przeciążony akumulator awaryjny UPS obok szybu Windy Panoramicznej.

### 3.7. Rozmieszczenie 16 punktów spawnu wrogów (`spawnPoints`) na 3 kondygnacjach

Zgodnie z fundamentem **F-01** mapa definiuje **16 punktów spawnu** rozłożonych równomiernie na wszystkich 3 piętrach (**6 na Parterze L0**, **5 na Piętrze L1**, **5 na Piętrze L2**). Każdy punkt ma wokół siebie pełną wolną przestrzeń bez przeszkód, leży poza marginesem `1.5 m` od hazardów i ma bezpośrednią ścieżkę w `ArenaSurfaceNavigation` do każdego innego piętra:

| Nr | Współrzędne `{ x, y, z }` | Kondygnacja | Strefa w galerii | Rola taktyczna w walce między piętrami |
|---:|---|---|---|---|
| **1** | `{ "x": -15, "y": 0, "z": 12 }` | **L0** (`y = 0.0 m`) | Pasaż Zachodni L0 (przed butikiem `S-01 VERVE`) | Flanka z lewej strony po starcie gracza; natarcie wzdłuż witryn ku centrum |
| **2** | `{ "x": 15, "y": 0, "z": 12 }` | **L0** (`y = 0.0 m`) | Pasaż Wschodni L0 (przed salonem `S-05 KUROGANE`) | Flanka z prawej strony; osłania dolny bieg schodów ruchomych `ESC-1` |
| **3** | `{ "x": -9, "y": 0, "z": 0 }` | **L0** (`y = 0.0 m`) | Atrium L0 — zachód od Fontanny (przed `S-02 STRIDE`) | Zwarcie wokół cembrowiny fontanny i pola elektrycznego `fountain-short-circuit` |
| **4** | `{ "x": 9, "y": 0, "z": -3 }` | **L0** (`y = 0.0 m`) | Atrium L0 — wschód od Fontanny (przed `S-04 NOVA ROAST`) | Kontrola wschodniej części atrium i Kiosku `K2` |
| **5** | `{ "x": -14, "y": 0, "z": -19 }` | **L0** (`y = 0.0 m`) | Pasaż Północno-Zachodni L0 (przed `S-03 VOLT-X` i `Klatką N-W`) | Druga fala nacierająca z północy lub wbiegająca po schodach `Klatki N-W` na L1 |
| **6** | `{ "x": 11, "y": 0, "z": -20 }` | **L0** (`y = 0.0 m`) | Pasaż Północno-Wschodni L0 (obok Windy i drzwi `exit`) | Odwód broniący podejścia do północnego wyjścia `exit` |
| **7** | `{ "x": -15, "y": 5.2, "z": 8 }` | **L1** (`y = 5.2 m`) | Pasaż Zachodni L1 (przed `S-06 NEO-TAILOR`) | Strzelec na balkonie L1 ostrzeliwujący w dół strefę startu i środek atrium |
| **8** | `{ "x": 15, "y": 5.2, "z": 8 }` | **L1** (`y = 5.2 m`) | Pasaż Wschodni L1 (przed `S-10 AUREA`) | Strzelec/szturmowiec przy górnym wyjściu ze schodów `ESC-1` |
| **9** | `{ "x": 0, "y": 5.2, "z": 4.5 }` | **L1** (`y = 5.2 m`) | **Mostek Południowy L1** (obok Kiosku `K3`, `x = -2.2`) | Dominująca pozycja centralna nad atrium; cel do zrzucenia Pchnięciem Rezonansu! |
| **10** | `{ "x": -15, "y": 5.2, "z": -10 }` | **L1** (`y = 5.2 m`) | Pasaż Zachodni L1 (przed `S-07 IRIS OPTICS`) | Kontrola wyjścia ze schodów ruchomych `ESC-2` i północno-zachodniego narożnika atrium |
| **11** | `{ "x": 0, "y": 5.2, "z": -21 }` | **L1** (`y = 5.2 m`) | Pasaż Północny L1 (przed `S-08 APTEKA` i za Windą) | Strzelec wykorzystujący otwartą kabinę Windy Panoramicznej jako gniazdo ogniowe |
| **12** | `{ "x": -15, "y": 10.4, "z": 10 }` | **L2** (`y = 10.4 m`) | Pasaż Zachodni L2 (przed `S-11 APEX SPORT`) | Snajper/strzelec na najwyższej kondygnacji przy wyjściu z `ESC-3` |
| **13** | `{ "x": 15, "y": 10.4, "z": 10 }` | **L2** (`y = 10.4 m`) | Pasaż Wschodni L2 (przed `S-15 MIDORI MATCHA`) | Wysoki ostrzał diagonalny przez atrium na Parter L0 i Mostek L1 |
| **14** | `{ "x": 0, "y": 10.4, "z": -7.5 }` | **L2** (`y = 10.4 m`) | **Mostek Północny L2** (przy donicy centralnej, `x = -2.2`) | Najwyższy punkt widokowy w sercu atrium pod samym świetlikiem dachowym |
| **15** | `{ "x": -15, "y": 10.4, "z": -10 }` | **L2** (`y = 10.4 m`) | Pasaż Zachodni L2 (przed `S-12 KODEKS`) | Wsparcie górnego piętra z dojściem na Mostek Północny L2 |
| **16** | `{ "x": 15, "y": 10.4, "z": -12 }` | **L2** (`y = 10.4 m`) | Pasaż Wschodni L2 (przed `S-14 AERO-TOY` i `ESC-4`) | Kontrola górnego spocznika schodów `ESC-4` i zejścia do `Klatki N-E` |

Parametry `director` i fal pokoju: `"maxAlive": 10`, `"minSpawnDistance": 10`, `"spawnRing": { "minM": 10, "maxM": 26 }`, `"navigationCellM": 0.5`, `"navigationClearanceM": 0.4`, `"navigationMaxRiseM": 0.55`, `"navigationHeadroomM": 2.2`.

### 3.8. Oświetlenie nocne z oprawami, reklamy holograficzne, detale BHP i decale

1. **Hierarchia oświetlenia „noc po zamknięciu” (42 źródła w `lights[]`, 100% z fizyczną oprawą):**
   - **Światła wewnątrz 15 witryn za kratami (15× `lights[]`):** w każdej wnęce sklepowej na wysokości `y_piętra + 3.30 m` (`1.2 m` za kratą `mall_shutter_grille`) wisi oprawa `mall_ceiling_panel`, a pod nią źródło `PointLight` (`intensity: 24..30, range: 11, floorY: y_piętra`). Dzięki temu **wnętrze każdego sklepu jest jaśniejsze niż półmroczny pasaż przed nim**, co gwarantuje stuprocentową czytelność manekinów, półek z butami, telewizorów i stolików kawiarni przez pręty kraty!
   - **Oświetlenie dyżurne pasażu (18× `lights[]`, po 6 na kondygnację L0/L1/L2):** wzdłuż stropów pasaży co `6.0 m` zamontowane są kasetony `mall_ceiling_panel`, ale w trybie nocnym **2/3 z nich jest zgaszonych** (sama geometria oprawy bez `PointLight`), a co trzeci świeci ciepłą bielą `#fff1d6` (`intensity: 20, range: 13, floorY: y_piętra, cone: false`) lub przy klatkach schodowych bursztynem awaryjnym `#ffae1a` (`flicker: { pattern: "pulse", periodS: 2.4 }`).
   - **Akcenty atrium, fontanny, windy i wyjścia (9× `lights[]`):**
     - 2× błękitne światło podwodne w basenie Fontanny `(±1.8, 0.8, 0, color: "#3d7bff", intensity: 28, range: 14, floorY: 0)` + 1× bursztynowy reflektor w rdzeniu rzeźby `(0, 2.8, 0, color: "#ffae1a", intensity: 24, range: 12, groundGlow: false)`.
     - 2× światło w kabinie i szybie Windy Panoramicznej `(0, 6.8, -16, color: "#3d7bff", intensity: 26, range: 14, floorY: 5.2)` oraz `(0, 13.5, -16, color: "#ffae1a", intensity: 20, range: 12, groundGlow: false)`.
     - 2× chłodny błękit nocnego nieba pod kalenicą świetlika dachowego `(0, 16.4, -8)` i `(0, 16.4, +8)` (`color: "#3d7bff", intensity: 36, range: 22, groundGlow: false`, oprawy zintegrowane z kratownicą `mall_skylight`).
     - 1× fioletowy łuk awarii przy fontannie `(-5.5, 1.4, -2.0, color: "#8a5cff", intensity: 20, range: 9, flicker: { pattern: "buzz", strength: 0.3 })`.
     - 1× zielony portal ewakuacyjny nad wyjściem `exit` `(0, 3.8, -24.6, color: "#6dff4a", intensity: 32, range: 15, floorY: 0)`.

2. **Reklamy holograficzne, oznaczenia pięter i detale „serio galerii”:**
   - **3 duże hologramy w atrium (`signs[]`, `kind: "holo"`):**
     1. `holo_koi` (`size: { w: 3.6, h: 3.6 }`, `tint: "#ffae1a"`) unoszący się nad Fontanną na wysokości `y = 6.2 m` `(0, 6.2, 0)` (projektor `city_holo_projector` na szczycie trzonu rzeźby fontanny na `y = 3.8 m`).
     2. `holo_drink` (`size: { w: 2.6, h: 3.2 }`, `tint: "#6dff4a"`) nad Kioskiem `K3` na Mostku Południowym L1 `(0, 9.2, +4.5)`.
     3. `holo_jellyfish` (`size: { w: 3.0, h: 3.4 }`, `tint: "#8a5cff"`) nad Mostkiem Północnym L2 `(0, 13.6, -7.5)`.
   - **Oznakowanie pięter (`L0`, `L1`, `L2`) i drogowskazy ewakuacyjne:**
     - Na czole płyt stropowych atrium (fryz między kondygnacjami na `y = 5.0 m` oraz `y = 10.2 m`, od strony wnętrza atrium) zamontowane są świecące szyldy `floor_l1` (`POZIOM +1 // MODA · OPTYKA · MED`) i `floor_l2` (`POZIOM +2 // SPORT · MEDIA · GASTRO`) w kolorze ciepłej bieli `#fff1d6` i błękitu `#3d7bff`.
     - Nad każdym z 4 wejść do klatek schodowych oraz nad drzwiami `exit` świecą zielone tabliczki ewakuacyjne (`open` / `arrow` z `tint: "#6dff4a"`).
   - **Kamery, gaśnice i szafki hydrantowe (`mall_security_fixture`):**
     - 12 zestawów `mall_security_fixture` (szafka gaśnicy/hydrantu + przycisk alarmowy + kopułkowa kamera CCTV z zieloną diodą) zamontowanych na słupach konstrukcyjnych atrium na wszystkich trzech piętrach (`X = ±12, Z = ±18`).

3. **Podział materiałowy posadzki i 48 naklejek (`decals[]`):**
   - **Architektoniczny rysunek posadzki (inlays w `blocks[]`):**
     - Na Parterze L0 środek atrium (`X ∈ [-10, +10], Z ∈ [-16, +16]`) to jasny polerowany kamień `mall_stone_floor`, otoczony pasem obwodowym `mall_terrazzo_inlay` o szerokości `2.0 m` (`X ∈ [-12, -10]` i `[+10, +12]`, `Z ∈ [-18, -16]` i `[+16, +18]`) pod linią słupów i balustrad wyższych pięter.
     - Na Piętrach L1 i L2 pasaże mają posadzkę `mall_stone_floor` z ciemnym pasem `mall_terrazzo_inlay` (`szer. 1.0 m`) wzdłuż lica witryn sklepowych oraz na obu mostkach.
   - **Naklejki podłogowe i ścienne (`decals[]`):**
     - 16× `mall_tactile_strip` (mosiężne listwy dylatacyjne i ścieżki prowadzące wzdłuż pasaży L0, L1, L2, `tint: "#ffae1a"`, `opacity: 0.65`),
     - 8× `mall_escalator_comb` (pasy ostrzegawcze przed dolnym i górnym grzebieniem każdego z 4 ruchomych schodów `ESC-1..ESC-4`),
     - 6× `floor_arrow` (`tint: "#6dff4a"`, `opacity: 0.55`) wskazujące drogę do wyjścia ewakuacyjnego `exit` i ruchomych schodów,
     - 4× `mall_wet_footprints` i 2× `puddle1` wyłącznie w strefie wiatrołapu przy drzwiach `entry` (`Z ∈ [+20, +25]`, naniesione z deszczowej ulicy) oraz pod miejscem skraplania ze świetlika `(3.5, 0, -4.0)`,
     - 6× `poster_torn1..3` / plakaty promocyjne na słupach technicznych klatek schodowych,
     - 6× `floor_hazard` wokół pola elektrycznego przy fontannie i bramki laserowej na południu.

### 3.9. Pułapki techniczne specyficzne dla `run2` i jak ich uniknąć

1. **Pułapka 1 — Otwór atrium na Piętrze L1 i L2 a `validateLayout` na Parterze L0 (`roomSchema.ts:408`):**
   - *Jak działa:* `validateLayout` szuka podłogi wyłącznie na wysokości `groundY = playerSpawn.y = 0`. Ponieważ na Parterze L0 całe atrium (`X ∈ [-18, +18], Z ∈ [-25, +25]`) ma ciągłą posadzkę na `y = 0`, flood-fill 1×1 m na L0 jest w 100% spójny, a otwór atrium występuje tylko w płytach `walkable: true` na `y = 5.2 m` i `y = 10.4 m` (które składają się z 4 prostokątnych pasów: Zachodniego `X ∈ [-18, -12]`, Wschodniego `X ∈ [+12, +18]`, Północnego `X ∈ [-12, +12], Z ∈ [-25, -18]` i Południowego `X ∈ [-12, +12], Z ∈ [+18, +25]` oraz płyty mostka).
2. **Pułapka 2 — Nachylone ruchome schody pod Mostkiem L1/L2 a prześwit `navigationHeadroomM` (`arenaSurfaceNavigation.ts:171`):**
   - *Bug:* gdyby bieg ruchomych schodów `ESC-1` (`L0 → L1`) przechodził bezpośrednio pod płytą Mostka Północnego L2 lub zbyt blisko spodu płyty balkonu L1 przed spocznikiem, komórki schodów miałyby prześwit `< 2.2 m` i `ArenaSurfaceNavigation` przecięłaby ścieżkę!
   - *Jak uniknięto w projekcie:* wszystkie 4 biegi `ESC-1..ESC-4` leżą w całości wewnątrz otworu atrium `X ∈ [-12, +12], Z ∈ [-18, +18]` (gdzie nad nimi jest otwarta przestrzeń aż do świetlika `y = 15.6 m`!), a `ESC-1` i `ESC-3` łączą się bezpośrednio z krawędzią Mostka Południowego L1 (`Z = +3..+6`), podczas gdy `ESC-4` łączy się z krawędzią Mostka Północnego L2 (`Z = -9..-6`). Żaden bieg nie przechodzi pod niskim stropem!
3. **Pułapka 3 — Towar za kratą sklepu a reguła `noCollisionLargeProp` i `floatingObject` w `mapAudit.ts` (`mapAudit.ts:448–532`):**
   - *Bug:* `mapAudit.ts` zgłasza `error · noCollisionLargeProp` dla każdego modelu w `decor[]` o wysokości `> 0.6 m`, który stoi na bloku oznaczonym jako `walkable: true` (gdy mapa używa `explicitSurfaces`) i nie ma kolidera przy podstawie.
   - *Jak uniknąć:* płyty podłóg **wewnątrz zamkniętych wnęk sklepowych za kratami** (`X ∈ [-22, -18]`, `X ∈ [+18, +22]`, `Z ∈ [-29, -25]`, `Z ∈ [+25, +29]`) mają jawnie ustawione **`walkable: false`** (oraz na L0 delikatnie obniżony spód lub `walkable: false`), ponieważ gracz ani AI nigdy nie wchodzą za opuszczoną kratę! Dzięki temu:
     1. `ArenaSurfaceNavigation` nie buduje niepotrzebnych komórek nawigacji wewnątrz 15 zamkniętych sklepów,
     2. `mapAudit.ts` widzi, że manekiny (`mall_mannequin`), regały (`mall_electronics_shelf`) i stoliki (`mall_cafe_set`) stoją stabilnie na płycie podłogi wnęki (`ground` znaleziony → `0 floatingObject`), ale ponieważ płyta wnęki ma `walkable: false`, nie wymaga dla nich zbędnych koliderów Rapiera (`0 noCollisionLargeProp`)!
4. **Pułapka 4 — Plamy światła (`groundGlow`) uciekające z balkonów L1/L2 na parter atrium:**
   - *Bug:* jeśli lampa na Piętrze L1 (`y = 9.55 m`) lub L2 (`y = 15.15 m`) zostanie przesunięta choćby o `10 cm` za krawędź balkonu nad pustkę atrium (`|X| < 12`), funkcja `lightSpotFloors` nie znajdzie pod nią płyty balkonu i narysuje wielką plamę światła na `y = 0` na parterze atrium.
   - *Jak uniknąć:* wszystkie lampy pasaży L1/L2 i wnętrz sklepów L1/L2 mają środek wewnątrz obrysu swojej płyty oraz **jawnie podane pole `floorY: 5.2` (dla L1) lub `floorY: 10.4` (dla L2)**.

---

## 4. Kryteria akceptacji (sprawdzalne w `mapAudit` i na zrzutach)

Mapa `run2` zostaje uznana za ukończoną wyłącznie wtedy, gdy spełnia wszystkie poniższe mierzalne kryteria:

### 4.1. Kryteria automatyczne (CLI i testy jednostkowe)

1. **Zero błędów i zero ostrzeżeń w `mapAudit`:**
   - Polecenie `node tools/levels/mapAudit.mjs run2` zwraca wynik: **`run2: 0 error, 0 warn`** (w `tests/unit/mapAudit.baseline.json` wpis `"run2": 0`).
   - Szczegółowo: `0` `noCollisionLargeProp`, `0` `floatingObject`, `0` `outOfBounds`, `0` `overlap`, `0` `forbiddenColor`, `0` `emptyRoom`.
2. **Pełna osiągalność 3D w teście `tests/unit/run2Navigation.test.ts`:**
   - Test jednostkowy na wzór `run1Navigation.test.ts` potwierdza w `ArenaNavigation(room)`:
     - dojście z `playerSpawn (0, 0, 22)` do drzwi `exit (0, 0, -25.5)`, do wszystkich **16 punktów spawnu** na kondygnacjach L0 (`y = 0.0`), L1 (`y = 5.2`) i L2 (`y = 10.4`), na oba mostki przez atrium, do wnętrza kabiny Windy Panoramicznej na L1 oraz na każdy spocznik ruchomych schodów `ESC-1..ESC-4` i klatek narożnych,
     - ciągłą trasę po Piętrze L1 i Piętrze L2 przez Mostek Południowy L1 i Mostek Północny L2 bez schodzenia na Parter L0 (`min(path.y) >= 5.2`).
3. **Zgodność schematów i AABB modeli (`npm run check`):**
   - `tsc --noEmit`, `eslint` i `vitest` przechodzą bez błędów, w tym `tests/unit/rooms.test.ts` i `tests/unit/roomBlockModelFit.test.ts` (±5% AABB dla wszystkich modeli `mall_*`).
4. **Komplet 10 zrzutów audytu i budżet wydajności:**
   - `node tools/screens/mapAudit.mjs run2 --tag after` generuje 10 ujęć PNG (`01-spawn.png` .. `10-top.png`) bez błędów konsoli/404.
   - Liczba wywołań rysowania na profilu `medium` w każdym widoku kontrolnym spełnia `renderInfo.calls <= 800`.

### 4.2. Kryteria wizualne i kompozycyjne (sprawdzalne na zrzutach PNG i w `?scene=map-walk&map=run2`)

1. **Pusta podłoga ≤ 25% kadru FPP:**
   - Na żadnym z 7 poziomych zrzutów audytu (`01-spawn` .. `07-corner-se`) pusta, nieprzełamana płaszczyzna posadzki nie zajmuje więcej niż **25% powierzchni kadru**. Posadzka atrium i pasaży jest zagospodarowana przez Fontannę `mall_fountain`, 3 Kioski `mall_kiosk`, 4 biegi ruchomych schodów `mall_escalator`, szyb Windy Panoramicznej `mall_elevator`, donice `mall_planter`, ławki `mall_bench`, informatory `mall_directory`, podziały kamienne `mall_stone_floor` / `mall_terrazzo_inlay` oraz mosiężne listwy `mall_tactile_strip`.
2. **Każdy z 15 sklepów rozpoznawalny branżowo w 1 sekundę za przezierną kratą:**
   - Wszystkie 15 lokali na L0, L1 i L2 są zamknięte ażurowymi kratami `mall_shutter_grille` (otwartość ~82%), przez które dzięki wewnętrznemu oświetleniu nocnemu wnęki od razu widać dedykowany towar: manekiny w płaszczach (`S-01`, `S-06`), podświetlane ściany z butami (`S-02`), ścianę ekranów RTV (`S-03`), stoliki z odwróconymi krzesłami w kawiarni (`S-04`, `S-15`), pancerne gabloty z bronią Kurogane (`S-05`), fotel i gogle optyka (`S-07`), aptekę z zielonym krzyżem (`S-08`), syntezatory i kolumny (`S-09`), gabloty zegarmistrza ze skarbcem (`S-10`), namiot i sprzęt górski (`S-11`), regały z książkami (`S-12`), flakony perfumerii (`S-13`) oraz podwieszone drony hobbystyczne (`S-14`).
3. **Zero kolorów zakazanych (`0` czerwieni, `0` cyanu, `0` magenty):**
   - Żaden blok, materiał modelu `mall_*`, szyld neonowy, hologram, ekran, szafka gaśnicy (`mall_security_fixture` w barwie bursztynowo-grafitowej `mat_hivis`) ani światło nie używa barw zarezerwowanych dla wrogów, gracza i Rezonansu. Wszystkie neony i światła pochodzą wyłącznie z 5 dozwolonych barw ADR 0006 (`#ffae1a`, `#6dff4a`, `#8a5cff`, `#3d7bff`, `#fff1d6`).
4. **Czytelność 3-piętrowego pionu i architektury galerii:**
   - Już z pierwszego kadru `01-spawn.png` widać jednocześnie wszystkie 3 kondygnacje (`L0`, `L1`, `L2`), przezroczyste szklane balustrady `mall_glass_rail` (`mat_glass_clear`), oba mostki zawieszone na różnych wysokościach (`5.2 m` i `10.4 m`), ruchome schody `mall_escalator`, przeszkloną Windę Panoramiczną `mall_elevator` oraz dwuspadowy świetlik dachowy `mall_skylight` na `y = 17.2 m` z nocnym deszczem na zewnątrz szkła.
   - Na ujęciu `10-top.png` (po automatycznym ukryciu grupy `room-ceilings` ze stropem `y = 15.6 m` i świetlikiem) widoczny jest pełny, symetryczno-taktyczny układ 3 pięter, mostków, schodów i atrium.

---

## 5. Poprawki Opusa (przegląd 25 XI) — WIĄŻĄ, mają pierwszeństwo przed sekcjami 1–4

Cel od użytkownika: „zrób tak, jakby to była serio galeria”. Każda poniższa decyzja temu służy.

1. **Sklepy głębsze i kompletne.** Wnęka sklepu ma głębokość 6–7 m, nie 4 m (poszerz obrys pasażu odpowiednio). Każdy sklep ma towar na trzech planach: przy kracie (manekin, stojak promocyjny), w środku (wieszaki, stoły, gondole) i przy tylnej ścianie (regał ścienny, ekran, logo). Każdy sklep ma ladę kasową z terminalem, a odzież i obuwie mają przymierzalnię. Przy wejściu za kratą stoją bramki antykradzieżowe. W witrynach są plakaty i naklejki („NOWA KOLEKCJA”, „-30%”, „OTWARCIE 9:00”) w bursztynie i ciepłej bieli, bez czerwieni.
2. **Dodatkowe modele P0** (obok tabel 1 i 2): `mall_clothes_rack` (wieszak stojący z ubraniami, 2 warianty kolorów), `mall_checkout_counter` (lada kasowa z terminalem), `mall_security_gates` (para bramek), `mall_display_table` (niski stół ekspozycyjny ze złożonymi rzeczami lub pudełkami), `mall_promo_stand` (stojak A z plakatem), `mall_trash_bin` (kosz z segregacją), `mall_entrance_doors` (przeszklone drzwi rozsuwane z ramą, zamknięte, do ściany południowej za startem). Model towaru może wystąpić w najwyżej 2 sklepach. Warianty zapewniają tinty, obrót, skala i kompozycja z drobnych modeli.
3. **Parter atrium (≈ 860 m²) nie może być pustym placem.** Strefy wymagane na L0:
   - fontanna centralna;
   - 3 kioski;
   - 2 wyspy wypoczynkowe (donice z ławkami);
   - podstawy 4 ruchomych schodów;
   - ekspozycja promocyjna samochodu: `city_car` na okrągłym podeście z neonowym obrysem i słupkami z taśmą (klasyka galerii, twarda osłona);
   - informatory.

   Żadna otwarta połać parteru bez osłony nie może przekraczać 8 × 8 m. Na L1 i L2 pasaże też mają osłony co 6–10 m: donice, ławki, kosze, informatory, kioski na mostkach.
4. **Światła: renderer pokazuje najwyżej 8 świateł naraz** (`maxLights` 2/4/8 w `tuning.ts`). Wnętrza 15 sklepów oświetlają więc głównie materiały emisyjne: paski LED `mat_light_white` pod półkami, ekrany, neony i podświetlane kasetony. Prawdziwe `lights[]` dostają tylko atrium (świetlik, fontanna), mostki i 3–4 sklepy kluczowe dla kompozycji kadru. Stożki (`cone`): najwyżej 2 na całą mapę. Każde światło ma widoczną oprawę.
5. **Noc po zamknięciu, ale czytelnie.** Pasaże są w półmroku, a witryny i neony szyldów stanowią główne źródło koloru. Fronty filarów, balustrady i podłoga muszą być czytelne (tło `#2a3344–#56627a`, jak w run1). Hala magazynu po pierwszej wersji była za ciemna, więc tutaj od razu planujemy jaśniejsze `hemiIntensity` niż 2.1. Wartość dobiera się na zrzutach.
6. **Ruchome schody zatrzymane** (noc), bez animacji. F-07 przesuwamy do backlogu. Na grzebieniach schodów stoją taśmy lub słupki „NIECZYNNE” w bursztynie, ale przejście zostaje wolne.
7. **Wejście główne za startem:** przeszklone drzwi rozsuwane (`mall_entrance_doors`), zamknięte. Za szybą widać mokrą ulicę i neony (tło lub dekoracje za szybą, bez kolizji dostępnej dla gracza). **Wyjście:** drzwi ewakuacyjne na północy, jak w §3.5, z zielonym oznaczeniem.
8. **Szkło:** `glass_clear` blokuje ruch i pociski (pełna kolizja). Oko na 1,65 m jest ponad poręczą 1,1 m, więc wymiana ognia między piętrami działa. F-09 przesuwamy do backlogu. Dopuszczalne artefakty sortowania przezroczystości: najwyżej 2 warstwy szkła na typowej linii wzroku.
9. **Nazwy i teksty:** fikcyjne marki bez nawiązań do realnych firm i nazw chronionych. Teksty po polsku z futurystycznym akcentem. Szyldy w paletach dozwolonych.
10. **Kraty:** wszystkie sklepy zamknięte przezierną kratą (`mall_shutter_grille`). Najwyżej 2 sklepy mogą mieć dodatkowo pełną roletę opuszczoną do połowy, dla różnorodności. Towar ma się czytać przez kratę z 6–10 m.
11. **Kolejność prac:** etap A to kod F-01–F-05 i testy. Etap B to modele (tabele 1, 2 i pkt 2) przez Blender według wzorca `tools/blender/sets/` z podglądami PNG. Etap C to tekstury szyldów i decali F-06 (imagegen). Etap D to generator `tools/arenas/run/run2.mjs`. Etap E to zrzuty, przegląd i ocena Opusa ≥ 7/10. Mapa NIE trafia do `roomPools`, dopóki użytkownik jej nie zaakceptuje.

---

## 6. Wdrożenie

### Etap A — fundamenty kodu (F-01–F-05)

- **F-01:** `y` opcjonalne w `roomSpawnPointSchema` i punkcie `wavesSchema`. `validateLayout` dla `y` różnego od `playerSpawn.y` wymaga bloku `walkable: true` (bez obrotu X/Z) z górną powierzchnią na `y` i braku bloków w `(y, y + 1,8 m]`; flood-fill 1 m dotyczy tylko punktów parterowych, osiągalność pięter sprawdza `ArenaNavigation`. `RoomScene` (spawny menedżera wrogów i `selectWavePoint`), `WaveDirector.pickSpawnPoint` i `arenaSpawnPoints` zachowują `y`. Pokoje bez `y` działają bit w bit jak dotąd (menedżer dalej dostaje `y = 0`, fale `y = 0`/`playerSpawn.y`). Testy: `tests/unit/spawnElevation.test.ts`.
- **F-02:** rodzaj `glass_clear` w `urbanKinds` (`mallKinds`), `BLOCK_MATERIALS` i (przez `arenaMaterials.json`) `surfaces` w `mapAudit`. Dane (`tint #283852`, `roughness 0,12`, `metalness 0,15`) wraz z nowym opcjonalnym polem `opacity: 0,22` w `arenaMaterials.json`; `createUrbanMaterial` ustawia wtedy `transparent` i `depthWrite: false`; poświata Fresnela jak w `glass`. Nazwa glTF: `mat_glass_clear`.
- **F-03:** prefiks `mall_` w `CITY_MODEL_PREFIXES`; `WALL_FIXTURES`: `mall_storefront`, `mall_shutter_grille`, `mall_shoe_wall`, `mall_security_fixture`, `mall_floor_sign`, `mall_entrance_doors`; `CEILING_FIXTURES`: `mall_ceiling_panel`, `mall_skylight`, `mall_hanging_banner`. Brak pliku .glb nie przewraca renderu (`cloneCityModel` ostrzega i używa oprawy zastępczej, jak przy `wh_`); `mapAudit` natomiast wymaga wpisu w `mapModelBounds.json`, więc po powstaniu modeli trzeba uruchomić `tools/levels/mapModelBounds.mjs`.
- **F-04 / etap C:** gotowe i podpięte docelowe tekstury `mall_stone_floor`, `mall_terrazzo_inlay`, `mall_acoustic_ceiling` (RGB 1024×1024 WebP) oraz trzy odpowiedniki `komiks_*`. Uzupełnione `SurfaceTexture`, `mallTextures`, `COMIC_SURFACES`, katalogi i manifesty. Kamień: 2×2 płyty po 1,2 m na kafel, skala 1/2,4 m. W E1 rozjaśniono tinty obu posadzek i stropu. `glass_clear` nadal używa maski `grime`.
- **F-05:** `src/data/weather/mallAfterHours.json` (deszcz 0,55, gloss 0,55, reflections 0,75, puddles 0,08, ambience generator i deszcz). Po E1 `hemiIntensity = 4,6`, `keyIntensity = 1,6`, mgła density 0,004 i strength 0,18. Osłonę deszczu oraz `weatherFloorY = 17,3` ustawia generator run2. Ocena jasności na nowych zrzutach pozostaje otwarta z powodu `spawn EPERM`.
- Dokumentacja: `docs/api.md`, `docs/systems/rooms.md`.

### Etap D — generator mapy `run2`

Generator `node tools/arenas/run/run2.mjs` (pliki pomocnicze `_run2Kit.mjs`, `_run2Shops.mjs`, `_run2Dress.mjs`) zapisuje deterministycznie `src/data/rooms/run2.json` (`id: "run2"`, `type: "combat"`, z blokiem `arena`). Mapa nie trafiła do `roomPools`. Podgląd: `?scene=map-walk&map=run2` albo `?scene=room-test&room=run2&debug=1`. Do `tools/arenas/lib/arena.mjs` doszła metoda `floorSpawn()` (spawn pokoju z `y`; dotychczasowe `spawn()` nadal odrzuca wysokość).

**Wymiary.** Pasaże: `X ∈ [−18, 18]`, `Z ∈ [−25, 25]`, otwór atrium `24 × 36 m` (`X ∈ [−12, 12]`, `Z ∈ [−18, 18]`). Posadzki L0/L1/L2 na `y = 0 / 5,2 / 10,4`, strop dachu `y = 15,6…16`, świetlik z 6 modułów `mall_skylight` sięga `y = 17,2`. Sklepy: wnęka 6,5 m od linii pasażu (5,6 m w świetle za ścianą frontową), obrys budynku `X ∈ [−25,5; 25,5]`, `Z ∈ [−32,5; 26]` plus przedsionki wejścia (południe) i wyjścia (północ). Wysokość kondygnacji w świetle: 4,8 m na L0 i L1, 5,2 m na L2.

**Układ.**

- **Parter.** Fontanna `(0, 0)` z czterema ławkami, trzy kioski (`(−7,5; 9,5)`, `(8,5; −10,5)`, `(8,5; 2)`), `city_car` na podeście `6,4 × 3,8 m` z neonowym obrysem i słupkami z taśmą, trzy wyspy wypoczynkowe (donica i dwie ławki), informatory, ławki, donice i kosze w pasażach. Największy pusty kwadrat bez osłony ma 8 m (test w `run2Navigation.test.ts` liczy widoczne bryły o wysokości co najmniej 0,8 m, bez ruchomych schodów i windy). Zagrożenia: bramka laserowa na południu (`z = 16,5`), pole elektryczne przy fontannie, dwie beczki wybuchowe.
- **Komunikacja pionowa.** Cztery ruchome schody (zatrzymane) na krzyż w otworze atrium: ESC-1 `L0 → L1` (`x = 4,8`, `z 16,4 → 6`), ESC-2 `L0 → L1` (`x = −4,8`, `z −7,6 → −18`), ESC-3 `L1 → L2` (`x = −4,8`, `z 6 → 16,4`), ESC-4 `L1 → L2` (`x = 4,8`, `z −18 → −7,6`). Każde ma model `mall_escalator` oraz niewidoczną rampę `walkable` o czystym obrocie `rotation.x`, nachyleniu 26,565° i szerokości 2 m, z niewidocznymi barierkami po bokach (`0,2 × 1,05 m`). ESC-1 kończy się na Moście Południowym L1 (`Z ∈ [3, 6]`), ESC-3 zaczyna się na jego południowej krawędzi i kończy podestem `2,4 × 1,6 m` przy południowym pasażu L2, ESC-4 kończy się podestem przy Moście Północnym L2 (`Z ∈ [−6, −3]`), ESC-2 przy północnym pasażu L1. Dwie klatki narożne (północny zachód i północny wschód) to dwubiegowe schody z biegami 5,2 m i spocznikami na `y = 2,6` i `7,8`. Winda panoramiczna `mall_elevator` stoi przy północnej krawędzi atrium (`(0, −16)`), z niewidocznym blokiem całego szybu. Szklane balustrady (`mall_glass_rail` i panele `glass_clear` na resztę odcinka) obiegają atrium, oba mostki i podesty; przerwy są tylko na schody. Dwanaście słupów `1 × 15,6 × 1 m`, na nich `mall_security_fixture`.
- **Sklepy** (każdy zamknięty dwiema kratami `mall_shutter_grille` z kolizją, fryz `mall_storefront` ze szyldem neonowym, bramki `mall_security_gates`, lada `mall_checkout_counter`, kasetony `mall_ceiling_panel`, listwy LED i ekrany emisyjne, plakaty, logo na tylnej ścianie):

| Id | Kondygnacja | Nazwa (szyld) | Towar |
|---|---|---|---|
| S-01 | L0 zachód | VERVE // ATELIER (`mall_fashion`) | manekiny, wieszaki, stół z odzieżą, regały ścienne, przymierzalnia |
| S-02 | L0 zachód | STRIDE // FOOTWEAR (`mall_footwear`) | dwie ściany obuwnicze, stoły z kloszami, pufy, stojaki promocyjne |
| S-03 | L0 zachód | VOLT-X // CYBER-AV (`mall_electronics`) | regały z ekranami, szafy serwerowe, projektor holo, ściana ekranów |
| S-04 | L0 wschód | NOVA ROAST // CAFE (`cat_cafe`) | dwa zestawy kawiarni z odwróconymi krzesłami, kontuar, witryna ciast |
| S-05 | L0 wschód | KUROGANE // URBAN GEAR (`mall_kurogane`) | gabloty pancerne, skrzynie broni, stół rusznikarza, torsy w pancerzach |
| S-06 | L1 zachód | NEO-TAILOR // BESPOKE (`mall_fashion`, fiolet) | manekiny, wieszaki, stół krawiecki, lustro |
| S-07 | L1 zachód | IRIS // OPTICS & AUG (`mall_optics`) | nisze ze szkłem i goglami, fotel badania, szafa serwerowa |
| S-08 | L1 północ | HELIX-MED // APTEKA 24H (`pharmacy`) | dwie lady apteczne, automat, regały leków, zielony krzyż |
| S-09 | L1 wschód | ECHO // SYNTH & AUDIO (`karaoke`) | regał z ekranami, kolumny, klawiatury, ekran reklamowy |
| S-10 | L1 wschód | AUREA // HOROLOGY (`mall_jewelry`) | gabloty pancerne, drzwi skarbca, wyspy ze szkłem |
| S-11 | L2 zachód | APEX // OUTDOOR & SPORT (`warsztat`) | ściana obuwnicza, namiot, ścianka wspinaczkowa, wieszak, stół |
| S-12 | L2 zachód | KODEKS // BOOKS & HOLO (`mall_books`) | regały z książkami, piramida bestsellerów, fotel, ekran |
| S-13 | L2 północ | AURA // SYNTH-PERFUME (`cocktail`) | dwie lady flakonów, wyspa testerów, regały ze szkła |
| S-14 | L2 wschód | AERO-TOY // DRONY & RC (`repair`) | trzy podwieszone drony, stół montażowy, gondole, projektor holo |
| S-15 | L2 wschód | MIDORI // MATCHA & RAMEN (`ramen`) | dwa zestawy kawiarni, kontuar, sznur lampionów, holo |

  Fasady mają 12 m (dwa moduły po 6 m). Pola fasady bez sklepu (L0 wschód środek, L1 i L2 zachód i wschód środek, połowy północnych ścian L1 i L2) to zaplecza z drzwiami serwisowymi `city_door`, szafką `mall_security_fixture` i dwoma automatami. Żaden model towaru nie występuje w więcej niż dwóch sklepach (powtarzają się tylko elementy wspólne: portal, krata, bramki, lada i kasetony).
- **Wejście i wyjście.** Wejście główne za startem `(0, 0, 22)`: zamknięte przeszklone drzwi rozsuwane `mall_entrance_doors` z kolizją, za nimi ciemny przedsionek z neonami ulicy i kałużami (zamknięte skrzydło `entry` gry stoi w głębi). Wyjście ewakuacyjne na północy: przedsionek `4,8 × 5,5 m` z drzwiami `exit` `(0, 1,5, −30)`, zielony neon i światło.
- **Światła** (24 wpisy `lights[]`, 0 stożków lamp): 3 w fontannie, 2 w świetliku, 2 w windzie, 2 na mostkach, 4 w sklepach S-01, S-02, S-04, S-05 (ciepła biel, intensywność 85, zasięg 10 m), 8 w pasażach (intensywność 32), po 1 w przedsionkach wejścia i wyjścia oraz 1 przy polu elektrycznym. Każde ma oprawę. Resztę oświetlenia dają dyfuzory, LED, ekrany i szyldy. Deszcz osłonięty do 16,6 m, dolna granica opadu 17,3 m (ponad świetlikiem 17,2 m); usunięty wewnętrzny efekt `drip`.
- **Spawny** (16, z `y`): 6 na parterze, 5 na L1 (w tym środek mostka), 5 na L2 (w tym środek mostka). Dyrektor: `maxAlive 10`, `minSpawnDistance 10`, `spawnRing 10…26 m`, siatka nawigacji 0,5 m, prześwit 2,2 m.

**Liczby po E1.** 1592 bloki (196 z modelem, 54 `walkable`, 48 niewidocznych), 288 dekoracji, 24 światła, 126 szyldów, 57 decali, 4 zagrożenia i 16 spawnów. Bez zmian `roomPools`.

**Zamienniki zasobów nadal obecne.** Dedykowanych marek nie mają S-04 (`cat_cafe`), S-06 (`mall_fashion` dla NEO-TAILOR), S-08 (`pharmacy`), S-09 (`karaoke`), S-11 (`warsztat`), S-13 (`cocktail`), S-14 (`repair`), S-15 (`ramen`). To pozostały zakres przyszłych szyldów poza wymaganym zestawem etapu C. Oznaczenia `floor_l0…l2`, ekran `screen_mall_directory`, cztery decale galerii, trzy powierzchnie i ich wersje komiksowe oraz plakaty „NOWA KOLEKCJA”, „-30%”, „OTWARCIE 9:00” są już docelowe. Kałuże `puddle1/2`, strzałki `floor_arrow` i pasy `floor_hazard` pozostają przy rzeczywistych kałużach, drogach i hazardach.

**Odstępstwa od projektu.**

- Fasady sklepów mają 12 m, więc L0 zachód ma trzy sklepy (S-01…S-03), a L0 wschód dwa i zaplecze; lokal S-08 stoi w zachodniej połowie północnej ściany L1, a S-13 we wschodniej połowie L2.
- Ruchome schody ułożono na krzyż (ESC-1 i ESC-2 na L0 → L1, ESC-3 i ESC-4 na L1 → L2). Wyjścia kończą się na krawędzi pasaży, mostków albo podestów `2,4 × 1,6 m`. Mostki mają 3 m szerokości bez wybrzuszeń, a osłony na nich to ławki przy przeciwległych balustradach; kiosk K3 stoi na parterze.
- Klatki schodowe to dwa dwubiegowe zwroty w otworze `4 × 7 m` płyt L1 i L2. Winda ma pełną kolizję szybu, dach kabiny nie jest grywalny.
- `mall_promo_stand` na parterze to dekoracja z niewidocznym kolidrem `0,8 × 1,354 × 0,8 m`, bo GLB ma 0,888 m w osi Z, a `mapModelBounds.json` 0,8 m (test `roomBlockModelFit` pilnuje 5%). Różnicę usunie ponowny pomiar po zatwierdzeniu zmian Codexa w modelach.
- Profil `tools/arenas/build.mjs --run` dla pokoi walki wymaga 70–100 m długości i 3500 m² chodzenia, a mapa ma 62,5 m i około 3365 m². Pozostałe progi profilu (strefy, poziomy, rampy, słupy, udział rekwizytu, trasa start → wyjście) są spełnione. Profil nie wchodzi w `npm run check`.

**Sprawdzenie.** `node tools/levels/mapAudit.mjs run2` daje 0 error i 0 warn (`"run2": 0` w `tests/unit/mapAudit.baseline.json`). `tests/unit/run2Navigation.test.ts` sprawdza dojście ze startu do wyjścia, do 16 spawnów na trzech kondygnacjach i do spoczników wszystkich ruchomych schodów i klatek, przejście po obu mostkach bez zejścia na niższą kondygnację, miejsce na kapsułę gracza przy starcie i spawnach oraz gęstość osłon (parter najwyżej 8 m, piętra najwyżej 10 m bez osłony).


### Etap C — domknięcie i runda E1 (25 XI 2026)

1. **Towar za kratami:** pełne emisyjne dyfuzory w 15 sklepach, listwy nad ekspozycją i pod półkami, większe tylne logotypy, dwa stale świecące szyldy fryzu na sklep. Cztery prawdziwe lampy przeniesiono do witryn L0 widocznych w głównych kadrach: VERVE, STRIDE, kawiarnia, KUROGANE. Plakaty zachowują własną ciepłą paletę.
2. **Pasaże i stropy:** kasetony co 6 m na wszystkich kondygnacjach, większe dyfuzory, LED pod balkonami, jaśniejsze tinty docelowych powierzchni. `mallAfterHours`: hemi 3,0 → 4,6, key 1,2 → 1,6, mgła density 0,01 → 0,004 i strength 0,42 → 0,18. Wartości wymagają kontroli wizualnej.
3. **Smugi:** w danych nie było lamp `cone: true`, deszcz miał już osłonę wnętrza. Podniesiono osłonę i granicę opadu ponad świetlik, usunięto `drip`, ograniczono mgłę. Bez nowych zrzutów nie potwierdzono usunięcia wszystkich smug r1 ani ich ostatecznej przyczyny.
4. **Pomarańczowy trójkąt:** każdy hologram tworzy otwarty stożek w `SignRenderer`. Usunięto trzy hologramy w atrium, w tym bursztynowe `holo_koi`; zastąpiły je dwa wiszące, dwustronne banery z linkami. Fontanna zachowana.
5. **Środek parteru:** dwie nowe donice z drzewkami, ławka, dwa kosze i dwa stojaki z plakatami; banery nad atrium i na balustradach. Test pustki nadal pilnuje 8×8 m na L0 i 10×10 m na piętrach; zachowano dojścia i spawny.
6. **Docelowe tekstury:** sprawdzono czytelność siedmiu zastanych szyldów i uzupełniono ich rejestr. Dodano `floor_l0…l2`, plan trzech poziomów „TU JESTEŚ”, cztery decale, trzy powierzchnie z wersjami komiksowymi oraz trzy plakaty. Obrazy generowano sekwencyjnie wbudowanym imagegen i oglądano przed konwersją. Ekran korzysta z istniejącego `mat_screen_mall_directory` w GLB. Katalogi i manifesty kompletne dla zestawu galerii.

**Ograniczenie przeglądu E1:** `node tools/screens/mapAudit.mjs run2 --out artifacts/maps/run2/r2 --tag after` nie uruchomił Chromium (`browserType.launch: spawn EPERM`). Zgodnie z briefem zrzuty pominięto. Runda r2 i ocena ≥7/10 wymagają przeglądu menedżera w środowisku z działającą przeglądarką. Nie potwierdzono jasności towaru z 6–10 m ani budżetu draw calls.


**Weryfikacja końcowa E1:** `mapAudit run2` 0 error / 0 warn; `mapAudit --all` 47 map bez regresji względem `tests/unit/mapAudit.baseline.json`; `run2Navigation.test.ts` 5/5; `npm run check` exit 0 (328 plików, 4111 testów). Ponowna generacja daje identyczny SHA-256 JSON. Kontrola 24 tekstur galerii: 0 błędów palety/wymiarów/alfy/szwów, cały pakiet 10 894 136 B / 12 000 000 B; walidator komiksowy 20 plików, 0 błędów. Globalny `tools/textures/process.py validate` nadal zgłasza trzy zastane pliki spoza katalogu: `floor_lane_line`, `floor_sector_k09`, `floor_pallet_bay` (poza zakresem tego zadania). Pełne e2e pominięte zgodnie z briefem; próba zrzutów opisana wyżej.

### Runda E2 — kompozycja wejścia i ekspozycje (25 XI 2026)

Obejrzano wszystkie 10 zastanych zrzutów `artifacts/maps/run2/r2/*.png` po E1 (ocena Opusa 6/10). Zmieniono wyłącznie generator run2, jego dane wynikowe i profil `mallAfterHours`; poniższe wyniki wizualne wymagają nowych zrzutów Opusa.

1. **Smugi — diagnoza i granica poprawki danymi.** Jawnych `lights[].cone` nie było. Znaleziono dodatkowe, automatyczne źródło wolumenu: `lanternFixtures()` w `src/render/city/lamps.ts:51` rozpoznaje `city_lantern_string`, a `src/render/city/dressing.ts:147–153` tworzy pod nim `LampCones` bez sprawdzania `lights[].cone`. Sznur w S-15 zastąpiono pięcioma kloszami z brył, bez tego efektu. Mapa ma teraz 0 jawnych stożków oraz 0 dekoracji uruchamiających automatyczne stożki. Wyzerowano też `fog.density`, `fog.strength`, `dust.density` i `dust.opacity` profilu wnętrza. Deszcz nad świetlikiem, osłony i `weatherFloorY = 17,3` zachowano.

   **Nie potwierdzono, że automatyczne stożki odpowiadały za wszystkie szerokie pasma r2.** Ich lokalny zasięg w S-15 nie tłumaczy smug przy każdej oprawie. Pozostały kandydat to rozmycie emisji opraw i długich LED: `src/render/bloom.ts:62–72, 295–333`, składane w `src/render/outline.ts:456–460`. Mgła nie tworzy osobnych snopów, a model fontanny nie ma kurtyny wody sięgającej stropu. `weatherSchema.lighting` nie udostępnia ustawień bloomu. Jeżeli nowe zrzuty nadal pokażą szerokie smugi, proponowana zmiana silnika to opcjonalne ustawienie bloomu w profilu pogody, zastosowane i przywracane przez `CityDressing.setWeather()`, z osobnym strojeniem dla wnętrza. W E2 nie zmieniano `src/render/` ani `src/core/`; całkowite usunięcie pasm pozostaje do potwierdzenia.

2. **Spawn.** Start zachowano w `(0, 0, 22)`. Słup na osi `(0, 18)` przesunięto do `(-8, 18)`, a donicę `(0, 19,5)` do `(-3,5, 19,5)`. Oś na fontannę, mostki i kondygnacje jest wolna od tych dwóch przeszkód. Nowe miejsce donicy zachowuje osłony przy wejściu: próba odsunięcia jej na wschód tworzyła pustkę 9×9 m, więc została odrzucona.

3. **Towar.** W każdym sklepie dodano pierwszy plan ekspozycji: dwa manekiny na podestach z jasnym tłem (S-01/S-06) albo dwie podświetlane gabloty z dużymi sylwetkami obuwia, flakonów, torsów lub urządzeń. Towar stoi na głębokości około 2 m od linii pasażu; manekiny przeniesiono z 2,6 do 2,15 m. Trzeci element to pionowy ekran z treścią marki przy kracie. Za logo każdego sklepu doszedł szeroki emisyjny panel tylnej ściany. Nie zwiększono puli ani liczby prawdziwych świateł; ekspozycje świecą również poza pulą PointLight.

4. **Posadzka.** Pasy `mall_terrazzo_inlay` na L0 biegną wzdłuż krawędzi atrium i witryn, uzupełniając istniejącą obwódkę. Wokół fontanny doszła ośmioboczna rozeta. Pod świetlikiem są cztery grupy kałuż i mokrych śladów; przy ośmiu spocznikach ruchomych schodów i wejściach klatek — `mall_tactile_strip`. Profil powierzchni: gloss 0,55 → 0,70, reflections 0,75 → 0,85, puddles 0,08 → 0,32.

5. **Stropy.** Pod balkonami L1/L2 oraz oboma mostkami dodano regularne kasetony `mall_acoustic_ceiling`, rozdzielone szczelinami i krótkimi emisyjnymi wkładami. Spody mostków mają dwie linie LED; zachowano istniejące listwy krawędzi balkonów. Nie zakryto otworów klatek schodowych.

6. **Banery.** Oba największe plakaty w atrium zmniejszono z 1,8×2,7 do 1,2×1,8 m; podkłady i linki dopasowano. Tint `#867d6c` zastępuje `#fff1d6`, ograniczając emisję bez globalnego przyciemniania szyldów.

**Dane po E2:** 2328 bloków (196 z modelem, 58 `walkable`, 48 niewidocznych), 287 dekoracji, 24 światła, 141 szyldów, 79 decali, 4 zagrożenia i 16 spawnów. Bez zmian puli pokoi. Podgląd do odbioru: `?scene=map-walk&map=run2`; sprawdzić oś startu, sylwetki z 6–10 m, czytelność dwóch banerów, spody balkonów i pozostałe pasma światła. Zrzutów ani Playwrighta nie uruchamiano zgodnie z briefem E2.

**Weryfikacja końcowa E2:** `node tools/levels/mapAudit.mjs run2` — 0 error / 0 warn; `--all` — 47 map, bez regresji (potwierdzone także przez 59/59 testów `mapAudit.test.ts`); `run2Navigation.test.ts` — 5/5 po korekcie miejsca donicy; `npm run check` — exit 0, 328 plików / 4111 testów. Testy wypisują ostrzeżenia jsdom o niedostępnym `HTMLCanvasElement.getContext`, lecz przechodzą. Prettier dla trzech zmienionych generatorów i dwóch JSON — poprawnie; `git diff --check` — bez błędów. Ponowna generacja zachowuje SHA-256 `C47A4B7FDD82F6316B7913F30719EF3F8171C3883477E9BFCD21A9FCBE146F10`. Oceny ≥7/10, budżetu renderu i usunięcia wszystkich smug nie potwierdzono bez nowych zrzutów. Narzędzie `graphify query` nie było dostępne w PATH; zależności potwierdzano w kodzie po przeczytaniu raportu grafu.

### Runda E3 — bloom kasetonów, stropy i sylwetki towaru (25 XI 2026)

Podstawa: kadry r3, zwłaszcza `05-west` i `06-corner-nw`, oraz potwierdzony
przez menedżera test A/B `diag-nolightwhite` względem r3. Ocena wejściowa 6,5/10,
próg odbioru 7/10.

1. **Smugi światła.** Dodano `light_panel` / `mat_light_panel`: emisyjną ciepłą
   biel jak `light_white`, bez selektywnego bloomu. Rejestracja obejmuje
   `mallKinds`/`urbanKinds`, `BLOCK_MATERIALS`, `arenaMaterials.json` i przez ten
   wpis powierzchnie `mapAudit`. Emisja reaguje na zasilanie. Dotychczasowy
   `light_white`, `BloomPass` i kolorowe neony nie zmieniają zachowania.
   Przebudowano 13 modeli galerii i ponownie zmierzono ich materiały przez
   `mapModelBounds.mjs`. Dyfuzory, LED, balustrady, schody, winda, gabloty,
   pierścienie fontanny i podświetlenia podstaw używają nowego materiału.
   `light_white` pozostał tylko na drobnym skanerze informatora. Wszystkie
   418 emisyjnych białych bloków generatora run2 używają `light_panel`.

2. **Spody balkonów.** Usunięto 192 krótkie wkłady LED z poszczególnych
   kasetonów. Szesnaście segmentów wzdłuż balkonów W/E zastąpiono czterema ciągłymi
   listwami (po jednej na krawędź i kondygnację); północne i południowe krawędzie
   zachowują po jednej linii. Mostki mają po dwie linie krawędziowe oraz dwa
   oddzielne szersze dyfuzory. Brak promienistej siatki emisyjnych kresek.

3. **Narożniki i przedsionki.** Kasetony `mall_acoustic_ceiling` z oprawami
   `mall_ceiling_panel` dodano w wąskich pasach przy obu narożnych klatkach,
   pod spocznikami, nad klatkami pod dachem oraz w obu przedsionkach. Otwory
   między kondygnacjami pozostają wolne. Nie dodawano prawdziwych świateł.

4. **Sklepy.** W 13 sklepach gabloty z jasnymi sylwetkami przesunięto o 0,65 m
   ku kracie i wycentrowano w otworach portali (`v = ±3` zamiast `±2,15`).
   Towar leży około 1,2–1,6 m od linii pasażu, zamiast około 2 m, i świeci
   bez rozmywania konturu przez bloom. W S-01 i S-06 po jednym manekinie na
   każdym z dwóch podestów ma emisyjny płaszcz; pozostały manekin zachowuje
   granat. Ekrany, tylne plany i wyposażenie sklepów zachowano.

**Dane po E3:** 2156 bloków (196 z modelem, 58 `walkable`, 48 niewidocznych),
301 dekoracji, 24 światła, 141 szyldów, 79 decali, 4 zagrożenia i 16 spawnów.
Bez zmian `src/core/`, puli pokoi i danych innych map. Dokumentacja materiału:
`docs/api.md`, `docs/systems/render.md`, `docs/assets.md`.

**Odbiór wizualny:** zrzuty wykona Opus; w tej rundzie nie uruchamiano ich
generowania ani podglądów Blendera. W `?scene=map-walk&map=run2` sprawdzić
smugi pod kasetonami przy zachowanym bloomie szyldów, jedną linię LED na
krawędź balkonu, strop nad `06-corner-nw` i sylwetki we wszystkich sklepach
z odległości 6–10 m. Ocena ≥7/10 i ostateczny efekt wizualny pozostają do
potwierdzenia przez Opusa.

**Weryfikacja końcowa E3:** `node tools/levels/mapAudit.mjs run2` — 0 error /
0 warn; `--all` — 47 map, bez regresji progów (`mapAudit.test.ts` 59/59).
`run2Navigation.test.ts` — 5/5; testy celowane materiałów, modeli, fundamentów,
nawigacji i audytu — 252/252. `npm run check` — exit 0: typecheck, lint,
328 plików / 4112 testów (4073 + 39). Ostrzeżenia jsdom o
`HTMLCanvasElement.getContext` nie powodują niepowodzeń. Ponowna generacja
zachowuje SHA-256 `00C4AA4046B061B771AC2B7C77C4145F5CD086977ED31DE7EC3A57F055007F51`.
Prettier dla zmienionych rejestrów, generatorów i testu materiałów oraz
`git diff --check` — poprawnie. `graphify query/explain/affected` niedostępne
w PATH; raport grafu przeczytano, zależności potwierdzono w wskazanych plikach.
Pełnego e2e nie uruchamiano (poza kontrolami wymaganymi w briefie). Logi:
`artifacts/maps/run2/e3-blender.log`, `e3-targeted.log`, `e3-check.log`.
