# Dokument projektowy mapy `run4` — WIEŻOWIEC KORPORACYJNY KUROGANE ARMS („SEKTOR WYSOKI // PIĘTRA 60–62”)

Status: **Projekt referencyjny jakości (wzorzec 8+/10) + specyfikacja „żywego miasta”, działającej windy, modeli, tekstur i generatora**  
Docelowy plik danych mapy: `src/data/rooms/run4.json` (generator: `tools/arenas/run/run4.mjs` + moduły pomocnicze `_run4Kit.mjs`, `_run4Rooms.mjs`, `_run4Dress.mjs`)  
Kierunek artystyczny: **Neon Noir** (`AGENTS.md`, `docs/adr/0006-neon-noir.md`)

---

## 1. Analiza silnika i nauczki z `run1`–`run3`

### 1.1. Co już działa w silniku i jak `run4` z tego korzysta

Po wdrożeniu magazynu `run1` ([docs/maps/run1.md](run1.md)), galerii handlowej `run2` ([docs/maps/run2.md](run2.md)), tajnego laboratorium `run3` ([docs/maps/run3.md](run3.md)) oraz tarasu widokowego `bulwar1` ([docs/maps/bulwar1.md](bulwar1.md)) silnik posiada fundamenty do budowy wielokondygnacyjnego biurowca z przeszklonymi fasadami i głęboką panoramą:

| Obszar silnika | Stan obecny w kodzie | Jak wykorzystuje to `run4` | Odwołania do plików |
|---|---|---|---|
| **Format pokoju i katalogi testowe** | Pokój `src/data/rooms/run4.json` (`type: "combat"`, z blokiem `arena` i `spawnRing`) ładuje się automatycznie przez `import.meta.glob` do `roomDefinitions`, menu „Testy map” (`?maps=1` → `?scene=map-walk&map=run4`), sceny walki `?scene=room-test&room=run4&debug=1` oraz audytu CLI `node tools/levels/mapAudit.mjs run4` i `node tools/screens/mapAudit.mjs run4`. | `run4` jest pokojem runu (`rooms`), bez sztucznej misji kampanii. Po akceptacji zostanie dopisany do `roomPools.combat` i `roomPools.elite` w `src/data/sectors/kurogane.json`. | `src/world/rooms.ts`, `src/world/mapCatalog.ts`, `tools/levels/mapAuditCatalog.ts`, `tools/arenas/run/_runKit.mjs` |
| **Nawigacja 3D (`ArenaSurfaceNavigation`)** | `RoomScene.init()` buduje graf komórek `0.5 × 0.5 m` na blokach `walkable: true` połączonych rampami osiowymi (`rotation.x` lub `rotation.z`), z kontrolą prześwitu `navigationHeadroomM = 2.2 m` i promienia kapsuły `navigationClearanceM = 0.4 m`. | Spina trzy kondygnacje biurowca: **Piętro 60 (`L0`, `y = 0.00 m`)**, **Piętro 61 (`L1`, `y = 4.80 m`)** oraz **Piętro 62 (`L2`, `y = 9.60 m`)** przez spoczniki pośrednie (`y = 2.40 m` i `y = 7.20 m`) czterema dwubiegowymi klatkami reprezentacyjnych schodów o czystym obrocie `rotation.x`, kącie **`25.64° ≤ 26.6°`** i szerokości **`3.20 m ≥ 2.0 m`**, a równolegle przez **działającą windę w szybie atrium** (`elevators[]`). | `src/world/arenaNavigation.ts`, `src/world/arenaSurfaceNavigation.ts:119–274` |
| **Spawny i hazardy na wielu kondygnacjach (`spawnPoints[].y`, `hazardFloorY`)** | `roomSpawnPointSchema` i `wavesSchema` obsługują współrzędną `y`, a `validateLayout` weryfikuje podparcie spawnów oraz zagrożeń (`electric_field`, `laser_gate`, `explosive_barrel`) na poziomych blokach `walkable: true` dowolnej kondygnacji. | **18 punktów spawnu** rozłożonych na trzech kondygnacjach: **7 na Piętrze 60 (`y = 0.00 m`)**, **6 na Piętrze 61 (`y = 4.80 m`)** i **5 na Piętrze 62 (`y = 9.60 m`)** oraz **4 zagrożenia środowiskowe** na poziomach `0.00 m`, `4.80 m` i `9.60 m`. | `src/world/roomSchema.ts:141, 406–588`, `src/scenes/roomScene.ts:610, 1612` |
| **Przezroczyste szkło (`mat_glass_clear`) i panele świetlne bez smug (`mat_light_panel`)** | `glass_clear` (`opacity: 0.22, depthWrite: false` + Fresnel) zapewnia obustronną przezierność tafli szklanych. `light_panel` (`#fff1d6`, `flat: true`) świeci ciepłą bielą bez selektywnego bloomu. | `mat_glass_clear` tworzy **zewnętrzne szklane fasady kurtynowe 360°** z widokiem na miasto, wewnętrzne przeszklone ściany sal konferencyjnych i gabinetów, balustrady atrium oraz przeszklony szyb i kabinę windy. `mat_light_panel` oświetla kasetony biurowe i liniowe oprawy sufitowe bez generowania smug bloomu. | `src/render/urbanMaterials.ts`, `src/data/render/arenaMaterials.json:183–202` |
| **Obniżona panorama miasta (`panoramaDropM`) i wykluczenie obrysu (`panoramaExclusion`)** | `roomSchema` wspiera pole `panoramaDropM: nonnegative.optional()`. `RoomScene.init()` przekazuje `envelope.bounds` jako `panoramaExclusion` oraz `this.layout.panoramaDropM` do `SceneAtmosphere`, który tworzy `new Panorama(seed, floorY - panoramaDropM, panoramaExclusion)`. | Ustawienie **`panoramaDropM: 180`** (odpowiednik 60. piętra wieżowca, `~180 m` nad poziomem ulicy) opuszcza bazę dalekiego miasta głęboko w dół kanionu ulicznego, a rozbudowa `skyline.ts` / `panorama.ts` (**F-02**) dodaje bliskie sąsiednie cyber-wieżowce i ruch powietrzny na wysokości okien `y = 0..+15 m`. | `src/world/roomSchema.ts:199`, `src/scenes/roomScene.ts:450–463`, `src/render/sceneAtmosphere.ts:28, 102–110` |
| **Strefy bez opadu (`rainShelters`) przy aktywnym deszczu zewnętrznym** | `Weather` (`src/vfx/weather.ts:104–108`) wycina w shaderze smugi deszczu wewnątrz każdego AABB z tablicy `rainShelters`, zostawiając pełny opad poza obrysem budynków (wzorzec sprawdzony na `bulwar1`). | Całe wnętrze trzech kondygnacji biurowca pokrywają szczelne bryły `rainShelters` (wewnątrz `0` kropli i `0` rozbryzgów), natomiast tuż za szklanymi fasadami `mat_glass_clear` gracz widzi zacinający na wysokości 60. piętra nocny deszcz na tle neonów sąsiednich wieżowców. | `src/world/dressingSchema.ts:198–202`, `src/render/city/dressing.ts:168–177`, `tools/arenas/run/bulwar1.mjs:34–43` |
| **Ukrywanie stropów w ujęciach audytu z góry (`ceiling: true`)** | Bloki z `ceiling: true` trafiają do grupy `room-ceilings`, ukrywanej w `MapAuditScene.render()` dla kamer `top`, `high-west` i `high-east`. | Wszystkie niegrywalne stropy nad Piętrem 60 (`y = 4.80..5.20 m`), Piętrem 61 (`y = 9.60..10.00 m`), Piętrem 62 (`y = 14.40..14.80 m`) oraz świetlik/strop Atrium (`y = 15.20..15.60 m`) mają `ceiling: true`. | `src/scenes/roomScene.ts:1129`, `src/scenes/mapAuditScene.ts:140, 163` |

### 1.2. Kluczowe nauczki z `run1`–`run3` oraz `bulwar1` zastosowane w `run4`

1. **Tarasowy (kaskadowy) układ 3 pięter wokół Atrium a czytelność ujęć `10-top.png`, `08-high-west.png` i `09-high-east.png` (nauczka z `run2` i `run3`):**
   - W `MapAuditScene` kamery `top`, `high-west` i `high-east` ukrywają wyłącznie bloki z `ceiling: true`. Płyty podłogowe wyższych kondygnacji (`L1: y = 4.80 m` oraz `L2: y = 9.60 m`) muszą mieć `walkable: true` i **nie mogą** mieć `ceiling: true`. Gdyby piętra `L0`, `L1` i `L2` leżały dokładnie jedno nad drugim w tym samym prostokącie `(X, Z)` jak w klasycznym prostopadłościennym biurowcu, posadzka `L2` zasłoniłaby `L1`, a `L1` zasłoniłoby `L0` na zrzutach `10-top.png`, `08-high-west.png` i `09-high-east.png`!
   - **Rozwiązanie architektoniczne w `run4` (układ kaskadowy wokół 3-kondygnacyjnego Atrium):**
     - W geometrycznym sercu budynku znajduje się **Centralne Trzykondygnacyjne Atrium (`A0`, pustka `y = 0.00..15.20 m`)** z przeszklonym szybem działającej windy (`elevators[0]`) i czterema biegami reprezentacyjnych schodów, niezasłonięte żadnym stropem międzykondygnacyjnym.
     - Trzy kondygnacje są **przesunięte tarasowo z południa na północ oraz schodkowo zwężane w osi `X`**:
       1. **Piętro 60 (`L0`, `y = 0.00 m`)** tworzy szeroki taras południowy i centralny (`X ∈ [-30, +30], Z ∈ [-16, +30]`): *Recepcja i Lobby Główne (`R1`)*, *Wielki Openspace Operacyjny (`R2`)*, *Korytarz Panoramowy i Strefa Analityków (`R3`)* oraz poziom dolny *Atrium (`A0`)*. Cały pas południowy `Z ∈ [+8, +30]` (`60 × 22 m = 1 320 m²`) nie ma nad sobą piętra `L1` ani `L2` — przykrywa go wyłącznie własny strop `ceiling: true` (`y = 4.80 m`), który znika w ujęciach audytu z góry!
       2. **Piętro 61 (`L1`, `y = 4.80 m`)** jest przesunięte ku północy (`X ∈ [-30, +30], Z ∈ [-24, +8]`, z wyciętym w środku otworem Atrium `X ∈ [-6.4, +6.4], Z ∈ [-8, +8]`): mieści *Salę Konferencyjną „Aegis” (`R4`)*, *Salę Konferencyjną „Vanguard” (`R5`)*, *Kuchnię i Strefę Socjalną „Sky Lounge” (`R6`)* oraz *Serwerownię Biurową i Drukarnię (`R7`)*. Cały pas `Z ∈ [-16, +8]` (`60 × 24 m`) oraz boczne skrzydła `X ∈ [-30, -24]` i `[+24, +30]` na `Z ∈ [-24, -16]` nie mają nad sobą piętra `L2` — ich strop (`y = 9.60 m`, `ceiling: true`) znika dla kamer zewnętrznych, odsłaniając w 100% obie sale konferencyjne, kuchnię i serwerownię!
       3. **Piętro 62 (`L2`, `y = 9.60 m`)** tworzy północną koronę zarządu wysuniętą nad przepaść miasta (`X ∈ [-24, +24], Z ∈ [-42, -16]` + mostek komunikacyjny do szybu windy): mieści *Szklane Gabinety Kierownictwa — Zachód (`R8`)*, *Szklane Gabinety Kierownictwa i Foyer Zarządu — Wschód (`R9`)* oraz *Gabinet Zarządu Kurogane Arms (`R10`)* na północnym szczycie (`Z ∈ [-42, -28]`).
   - Dzięki temu na zrzutach `10-top.png`, `08-high-west.png` i `09-high-east.png` widoczne są jednocześnie **wszystkie trzy kondygnacje (`y = 0.00, 4.80, 9.60 m`) i wszystkie 10 pomieszczeń + Atrium**, a z wnętrza każdego piętra gracz patrzy przez szklane ściany zarówno na inne kondygnacje przez atrium, jak i na panoramę miasta przez zewnętrzne szklane fasady!

2. **Pogodzenie `fog: 0` we wnętrzu z głęboką panoramą miasta za szklaną fasadą (analiza `outline.ts` i `skyMaterials.ts`):**
   - W `src/render/outline.ts:426–445` post-procesowa mgła odległościowa (`fogStrength`) i wysokościowa (`heightFogDensity`) działa na wszystkie piksele z zapisaną głębią (`worldSurface`), w tym na wnętrze budynku oraz przezroczyste tafle szkła, jeśli za nimi stoi nieprzezroczysta geometria. Z doświadczeń `run2` i `run3` wiemy, że niezerowa mgła we wnętrzu przy dużych różnicach wysokości zamula cienie i tworzy mleczną poświatę wokół opraw oświetleniowych.
   - Z kolei w `src/render/skyMaterials.ts` obiekty panoramy dzielą się na dwie grupy:
     1. `sky-dome`, `skyline-beacons`, `skyline-traffic` oraz `skyline-ad` są rysowane z `transparent: true, depthWrite: false, blending: AdditiveBlending` (`skyMaterials.ts:285, 336, 430, 509`). Nie zapisują one bufora głębi (`colorDepthMap = 1.0`), więc `outline.ts:426` zawsze traktuje je jako niebo (mgła post-procesu nigdy ich nie przyciemnia).
     2. `skyline-buildings` (`createBuildingMaterial` w `skyMaterials.ts:205`) to nieprzezroczysty `InstancedMesh`, który sam w swoim shaderze (`buildingFragment`, `skyMaterials.ts:168–191`) posiada warstwową gradację jasności fasad (`tone`: `0.62` dla warstwy 0 → `0.50` dla warstwy 1 → `0.40` dla warstwy 2 → `0.32` dla warstwy 3 w `skyline.ts:99–104`) oraz dolną łunę miasta (`uplight * 0.06 * exp(-max(v, 0.0) / 22.0)`).
   - **Rozwiązanie w `kuroganeOfficeTower.json` i `skyMaterials.ts`:**
     - W profilu pogody `kuroganeOfficeTower.json` ustawiamy **`fog.density: 0`**, **`fog.strength: 0`** oraz **`dust.density: 0`** — wnętrze biurowca na wszystkich 3 piętrach ma **dosłownie zerową mgłę** (100% kontrastu Neon Noir i brak smug).
     - Natomiast w `buildingFragment` (`src/render/skyMaterials.ts:180`) dokładamy lekką perspektywę powietrzną liczoną bezpośrednio w shaderze wieżowców tła (`mix(col, skyHazeColor, smoothstep(90.0, 220.0, dist))` oraz łunę głębokiego kanionu dla `vWorld.y < -40.0`). Dzięki temu panorama za oknem ma wieloplanową głębię atmosferyczną bez używania globalnej mgły w `StylePipeline`!

3. **Zero wolumetrycznych smug światła (`0` stożków, nauczka z `run2` E1–E3 i `run3`):**
   - `0` świateł z `cone: true` w `lights[]`, całkowity zakaz `city_street_lamp` i `city_lantern_string`.
   - Wszystkie białe powierzchnie świecące opraw sufitowych (`off_ceiling_light_panel`, `off_linear_baffle_light`), listew przypodłogowych i podświetleń mebli używają wyłącznie **`mat_light_panel`** (`#fff1d6`, `flat: true`), a nie `mat_light_white`.
   - W `signs[]` używamy szyldów `kind: "neon"` zamocowanych na ścianach, nadprożach i belkach stropowych (`ANCHOR <= 0.32 m`), unikając stożków projektorów `kind: "holo"` w głównych osiach widoku.

4. **Ograniczenia `Panorama` i `SceneAtmosphere` przy `panoramaDropM: 180` — diagnoza techniczna kodu:**
   Przegląd `src/render/sceneAtmosphere.ts`, `src/render/panorama.ts` i `src/render/skyline.ts` ujawnił 4 konkretne miejsca w kodzie, które przy wysokości 60. piętra (`panoramaDropM = 180`, czyli `panorama.floorY = -180 m`) wymagają rozszerzenia w fundamencie **F-02**:
   1. **Płaszczyzna `outer-ground` w `SceneAtmosphere.sync()` (`src/render/sceneAtmosphere.ts:71–75`):** przy `horizon.expanded === true` (gdy promień obwiedni mapy `radiusM > 50 m`) `outer-ground` jest dziś umieszczany na `this.envelope!.bounds.min.y - tuning.horizon.groundOffsetM` (czyli `y ≈ -1.12 m`), bez odjęcia `this.panoramaDropM`! Taka nieprzezroczysta płaszczyzna na `y = -1.12 m` zasłoniłaby całe miasto poniżej 60. piętra. Odjęcie `this.panoramaDropM` (`this.envelope!.bounds.min.y - this.panoramaDropM - tuning.horizon.groundOffsetM`) opuszcza dno miasta na `y = -181.12 m`.
   2. **Wysokość wieżowców w `buildSkyline()` (`src/render/skyline.ts:176–180`):** przy `baseHeight = tuning.render.panoramaHeight = 32 m` i `o.floorY = -180 m` zwykłe budynki mają wysokość `30..120 m` nad `o.floorY` (czyli ich dachy kończą się na `y = -150..-60 m`, głęboko w dole), a nawet 3 `LANDMARKS` sięgają tylko `y = -180 + 150 = -30 m`. Aby gracz widział za oknem zarówno **miasto w dole**, jak i **sąsiednie cyber-wieżowce na wysokości 60.–62. piętra**, `buildSkyline()` musi przy dużym obniżeniu `o.floorY < -50 m` generować dodatkowy pierścień 6–8 wysokich megastruktur korporacyjnych (`topY ∈ [+25, +95 m]`) na różnych odległościach (`58..135 m`).
   3. **Wysokość ruchu latających pojazdów (`lanes` w `src/render/skyline.ts:404`):** obecnie wszystkie tory mają `height: o.floorY + rng.float(22, 58)` (czyli przy `o.floorY = -180 m` wszystkie pojazdy latają na `y = -158..-122 m`). Aby miasto żyło na wysokości okien biurowca, tory pojazdów trzeba rozdzielić na **pasy głębokiego kanionu (`y = -130..-40 m`)**, **pasy na wysokości kondygnacji biurowca (`y = -12..+28 m`)** oraz **1–2 tory bliskiego przelotu (`close fly-by`) tuż za szybą (`odległość 8..15 m` od fasady)**.
   4. **Statyczna maska okien w `buildingCommon` (`src/render/skyMaterials.ts:152–165`) i limit 3 reklam (`src/render/panorama.ts:210`):** obecnie `windowLit` zależy wyłącznie od statycznego `hash12(run + seed, cell.y)`, a `layout.ads.slice(0, 3)` tworzy tylko 3 hologramy. Dodanie czasowej zmiany stanu wybranych okien oraz zwiększenie liczby billboardów na sąsiednich wieżowcach do 6–8 na wysokości okien biurowca ożywia panoramę z każdej strony budynku.

---

## 2. Lista braków („fundamenty”) z priorytetem P0 / P1

### 2.1. Priorytet P0 — MUSI BYĆ PRZED `run4`

#### A. Zmiany w kodzie silnika (Etap A)

| ID | Co trzeba dopisać w kodzie i dlaczego | Pliki w repozytorium | Zakres zmian |
|---|---|---|---|
| **F-01** | **Działająca winda międzykondygnacyjna (`elevators[]` dla gracza i AI wrogów — kontrakt z równoległego zadania `docs/systems/elevator.md`):**<br>1. **Schemat danych (`src/world/roomSchema.ts`):** opcjonalne pole pokoju `elevators: z.array(roomElevatorSchema).optional()`, gdzie każdy element ma postać:<br>`{ id: string, x: number, z: number, width: number, depth: number, stops: [{ y: number, doorSide: 'N' \| 'S' \| 'E' \| 'W' }], startStop?: number }`.<br>2. **Symulacja i fizyka (`RoomScene` / moduł windy):** kinematyczny kolider podłogi i kabiny (`width × depth`) poruszający się ze stałą prędkością między przystankami `stops[].y` (`0.00 m`, `4.80 m`, `9.60 m`), z drzwiami szybowymi otwartymi na bieżącym przystanku po stronie `doorSide` i zablokowanymi na pozostałych kondygnacjach.<br>3. **Interakcja gracza:** podejście do panelu wezwania `off_elevator_call_panel` na dowolnym piętrze lub panelu wewnątrz kabiny `off_elevator_cab` pozwala kliknąć / aktywować jazdę **W GÓRĘ (`▲`)** albo **W DÓŁ (`▼`)**.<br>4. **Integracja z AI wrogów (`ArenaSurfaceNavigation` / `EnemyManager`):** wrogowie traktują windę jako legalny łącznik pionowy między `y = 0.00 m`, `4.80 m` i `9.60 m` — mogą wezwać kabinę na swoje piętro, wjechać nią na kondygnację gracza i wyjść po otwarciu drzwi (równorzędnie z biegiem po schodach w atrium). | `src/world/roomSchema.ts`, `src/scenes/roomScene.ts`, `src/world/arenaSurfaceNavigation.ts`, `docs/systems/elevator.md` | Równoległy moduł silnika wg kontraktu `elevators[]` |
| **F-02** | **„Żywe miasto” za oknem na wysokości 60. piętra (rozbudowa `SceneAtmosphere`, `Panorama`, `buildSkyline`, `skyMaterials`):**<br>1. **`SceneAtmosphere.sync()` (`src/render/sceneAtmosphere.ts:71–75`):** uwzględnienie `this.panoramaDropM` w rzędnej płaszczyzny `outer-ground` (`this.envelope!.bounds.min.y - this.panoramaDropM - tuning.horizon.groundOffsetM`), aby przy `horizon.expanded` ziemia nie odcinała widoku w dół.<br>2. **Bliskie cyber-wieżowce sąsiednie (`src/render/skyline.ts`):** gdy `o.floorY < -50` (wysoki biurowiec z `panoramaDropM`), oprócz gęstej zabudowy w dole kanionu (`baseY = o.floorY - 24`) generować **6–8 bliskich wieżowców sąsiednich (megastruktur)** na promieniach `56..115 m` (poza `panoramaExclusion`), których korony sięgają `y = +25..+90 m` ponad poziom `y = 0` biurowca, z uskokami, neonowymi wieńcami (`accent: 0..4`) i masztami.<br>3. **Zapalające się i gasnące okna (`src/render/skyMaterials.ts:152–165`):** w `computeWindows()` dodać powolne przełączanie stanu części ciągów okiennych w czasie (`time * 0.18` z płynnym `smoothstep` i ziarnem piętra), tak by w sąsiednich wieżowcach okna realistycznie zapalały się i gasły.<br>4. **Wielopoziomowy ruch latających pojazdów + okazjonalny bliski przelot tuż za szybą (`src/render/skyline.ts:400–408`, `src/render/skyMaterials.ts:293–326`):** zwiększyć pulę torów (`InstancedMesh`, 1 draw call) i podzielić je na 3 pułapy: (a) dno kanionu (`o.floorY + 25..95 m`), (b) pułap okien 60.–62. piętra (`y = -12..+26 m`, promień `62..135 m`, różne prędkości i kierunki), (c) **2 tory bliskiego przelotu (`close fly-by`)** w odległości `9..15 m` od szklanych fasad biurowca na wysokości `y = +2.2..+11.5 m` (większy rozmiar kątowy świateł przednich `#fff1d6` i tylnych `#ffae1a` + smuga przelotu co `~11 s`).<br>5. **Migające światła ostrzegawcze (`skyline-beacons`):** na szczytach i narożnikach uskoków zarówno niższych wieżowców w dole, jak i wysokich sąsiednich megastruktur na poziomie wzroku — wyłącznie w barwach **bursztynu `#ffae1a` (`color: 0`)** oraz **ciepłej bieli `#fff1d6` (`color: 1`)** (**0 czerwieni!**).<br>6. **Animowane ekrany reklamowe / billboardy na sąsiednich wieżowcach (`src/render/panorama.ts:210`, `src/render/skyline.ts:341–397`):** zwiększyć liczbę paneli `skyline-ad` z 3 do **6** i umieszczać je na fasadach bliskich cyber-wieżowców w przedziale wysokości `y = -15..+24 m` (bezpośrednio naprzeciw przeszklonych ścian Zachodu, Wschodu, Północy i Południa). | `src/render/sceneAtmosphere.ts`, `src/render/panorama.ts`, `src/render/skyline.ts`, `src/render/skyMaterials.ts`, `tests/unit/skyline.test.ts` | ~95 linii TS/GLSL + test jednostkowy |
| **F-03** | **Rejestracja prefiksu `'off_'` oraz modeli ściennych, sufitowych i przejściowych biurowca w `cityModels.ts` i `mapAudit.ts`:**<br>1. W `CITY_MODEL_PREFIXES` (`src/render/cityModels.ts:8`) dopisać `'off_'`, aby loader zachowywał wielomateriałowość glTF modeli `/assets/models/city/off_*.glb`.<br>2. W `src/world/mapAudit.ts:24–59` dopisać:<br>- do `WALL_FIXTURES`: `off_facade_mullion`, `off_glass_partition_wall`, `off_glass_partition_door`, `off_elevator_shaft_door`, `off_elevator_call_panel`, `off_conf_screen_wall`, `off_whiteboard_wall`, `off_acoustic_wall_panel`;<br>- do `PASSAGE_FIXTURES`: `off_glass_partition_door`, `off_elevator_shaft_door`, `off_security_turnstile`;<br>- do `CEILING_FIXTURES`: `off_ceiling_light_panel`, `off_linear_baffle_light`. | `src/render/cityModels.ts`, `src/world/mapAudit.ts` | ~20 linii TS |

#### B. Nowe materiały powierzchniowe, profil pogody i tekstury (Etap A/C — dane + zasoby)

| ID | Co trzeba dodać | Gdzie w zasobach / danych | Szczegóły |
|---|---|---|---|
| **F-04** | **3 materiały wykończeniowe biurowca korporacyjnego w `arenaMaterials.json` i tekstury `surfaces/`:**<br>1. `off_carpet_tile` — modułowa wykładzina dywanowa `0.6 × 0.6 m` w chłodnym odcieniu grafitowo-granatowym z kierunkowym splotem włókien (`scale: 0.6, roughness: 0.82, metalness: 0.04, bump: 0.35, wetness: 0.08, tint: "#353f52"`) — posadzka openspace'u `R2`, sal konferencyjnych `R4`/`R5` i gabinetów `R8`/`R9`;<br>2. `off_polished_granite` — polerowane płyty z ciemnego granitu z żyłkowaniem i stalowymi szwami dylatacyjnymi, o wysokim współczynniku odbić neonów i okien panoramicznych (`scale: 0.35, roughness: 0.18, metalness: 0.16, bump: 0.22, wetness: 0.72, tint: "#2d3646"`) — posadzka Lobby `R1`, Atrium `A0`, Korytarza Panoramowego `R3` i Gabinetu Zarządu `R10`;<br>3. `off_wood_slat_wall` — pionowe lamele architektoniczne z ciemnego orzecha na czarnym filcu akustycznym (`scale: 0.5, roughness: 0.58, metalness: 0.10, bump: 0.50, wetness: 0.05, tint: "#4a3f37"`) — reprezentacyjne ściany trzonu atrium, recepcji, sal konferencyjnych i gabinetu zarządu. | `src/data/render/arenaMaterials.json`, `src/render/urbanMaterials.ts`, `src/render/surfaceTextures.ts`, `src/world/dressingSchema.ts`, `public/assets/textures/surfaces/off_*.webp` (+ wersje `komiks_off_*.webp`) | 3 tekstury `.webp` (`1024×1024`) + 3 odpowiedniki komiksowe + wpisy w `BLOCK_MATERIALS` |
| **F-05** | **Profil pogody `src/data/weather/kuroganeOfficeTower.json` („Biurowiec Kurogane Arms — Piętra 60–62”):**<br>- `precipitation`: `{ kind: "rain", density: 0.42, speed: 18, color: "#889bb8", opacity: 0.28, exposureS: 0.025, widthM: 0.013 }` — w połączeniu z `rainShelters` obejmującymi całe wnętrze 3 pięter biurowca wewnątrz nie spada ani jedna kropla, natomiast tuż za szklanymi fasadami widać zacinający wietrzny deszcz na tle neonów miasta!<br>- `wind`: `{ direction: { x: 1, z: -0.35 }, strength: 0.85, gustStrength: 0.25, gustPeriodS: 7 }`;<br>- `lighting`: `{ hemiIntensity: 4.4, keyIntensity: 1.55, panoramaEnabled: true }` — panorama włączona, wysokie światło półkuliste zapewniające czytelność mebli i ciemnych garniturów/osłon (`#2a3344–#56627a`);<br>- `fog`: `{ color: "#0b101d", density: 0, heightM: 20, strength: 0, nearM: 90, farM: 240 }` — **mgła we wnętrzu wyzerowana (`density: 0, strength: 0`)**, zero zamglenia szyb i zero poświaty wokół lamp;<br>- `dust`: `{ density: 0, sizeM: 0.08, opacity: 0, color: "#9aa8c0", lifeS: 10 }`;<br>- `surface`: `{ gloss: 0.65, reflections: 0.82, puddles: 0.15 }` — ostre odbicia neonów i panoramy w polerowanym granicie `off_polished_granite`;<br>- `sky`: `{ horizonColor: "#2b1f3d" }`, `lightning`: `{ enabled: false, ... }`;<br>- `ambience`: `[{ kind: "generator", gain: 0.08, radiusM: 95 }, { kind: "wind", gain: 0.10, radiusM: 110 }]` (cichy szum klimatyzacji HVAC i wysokiego wiatru za szybami). | `src/data/weather/kuroganeOfficeTower.json` | 1 plik JSON |
| **F-06** | **Nowe tekstury szyldów korporacyjnych, ekranów analitycznych, tablic i decali (`signs/`, `screens/`, `decals/`, `labels/`):** pełna specyfikacja w **sekcji 4.2**. | `public/assets/textures/{signs,screens,decals,labels}/`, `tools/textures/catalog.json` | 10 `signs`, 8 `decals`, 2 `screens`, 1 `labels` (+ 6 `surfaces` w F-04) |

### 2.2. Priorytet P1 — Szlif po pierwszym odbiorze wizualnym

| ID | Co można dodać w kolejnym kroku | Gdzie w kodzie / zasobach | Efekt |
|---|---|---|---|
| **F-07** | **Shader spływających kropli deszczu na zewnętrznych taflach fasady (`mat_glass_clear` / decal `off_rain_streaks_glass`):** delikatne animowane pionowe strużki na zewnętrznych szybach fasadowych bez utraty przezierności widoku na wieżowce. | `src/render/urbanMaterials.ts` | Jeszcze bardziej namacalny kontrast między suchym, luksusowym wnętrzem biura a nocną ulewą na wysokości 60. piętra. |
| **F-08** | **Zniszczalne monitory i przegrody biurek w openspace (`PropPhysicsSystem`):** rozbłysk iskier `sparks` i odłamki przy trafieniu w stanowiska komputerowe podczas wymiany ognia. | `src/world/propPhysics.ts` | Widowiskowa reaktywność przestrzeni biurowej w walce. |

---

## 3. Projekt architektoniczny mapy `run4` — 10 pomieszczeń + Atrium na 3 kondygnacjach (`L0`, `L1`, `L2`)

### 3.1. Idea, narracja miejsca i klimat wysokiego wieżowca Kurogane Arms

- **Co to za miejsce:** Regionalna Kwatera Główna i Piętra Zarządu **Kurogane Arms — Wieża Korporacyjna („Kurogane Tower”, Piętra 60–62)**, wznosząca się **180 metrów nad ulicami miasta** (`panoramaDropM: 180`). To tutaj zapadają decyzje o kontraktach zbrojeniowych, budżetach Sektora X-51 i operacjach pacyfikacyjnych. Budynek łączy chłodny, korporacyjny luksus w stylu Neon Noir (czarny polerowany granit, ciemne lamele orzechowe, szczotkowana stal, przeszklone ściany działowe `mat_glass_clear`) z monumentalnym, **trzykondygnacyjnym Atrium**, w którym kursuje przeszklona winda panoramiczna i wznoszą się reprezentacyjne biegi schodów.
- **Co widać za oknami (360° szklanych fasad kurtynowych):** Wszystkie zewnętrzne ściany biurowca są od podłogi do stropu przeszklone (`mat_glass_clear` w rytmie słupków `off_facade_mullion` co `4.0 m`). Patrząc w dół pod kątem przez tafle szkła, gracz widzi głęboki kanion nocnego miasta (`y = -180 m`) z rzekami świateł pojazdów. Patrząc przed siebie i w górę, widzi kilka **bliskich, potężnych cyber-wieżowców sąsiednich** (`odległość 56–115 m`), na których fasadach pulsują wielkie ekrany reklamowe, zapalają się i gasną okna biur, na szczytach i uskokach migają bursztynowe oraz ciepłobiałe światła ostrzegawcze (zero czerwieni!), w powietrzu na kilku wysokościach suną latające pojazdy, a co kilkanaście sekund tuż za szybą przelatuje bliski ślizgacz korporacyjny.
- **Dlaczego gracz tu jest i co tu się dzieje:** Po odkryciu prawdy o Projekcie Chimera w podziemnym laboratorium (`run3`), Rezonant (gracz) wjeżdża ekspresowym pionem z niższego sektora na **60. piętro (`L0`, `y = 0.00 m`)**, wychodząc w południowym Lobby Głównym Kurogane Arms (`R1`). W biurowcu trwa nocny dyżur analityków i posiedzenie sztabu kryzysowego. Gracz musi przebić się przez trzy kondygnacje — korzystając z reprezentacyjnych schodów w Atrium, bocznych klatek lub **działającej windy (`elevators[0]`)**, której używają także oddziały ochrony Kurogane — aż do zawieszonego nad miastem **Gabinetu Zarządu (`R10`) na 62. piętrze (`L2`, `y = 9.60 m`)**, gdzie znajduje się północna śluza ewakuacyjna (`exit`).

### 3.2. Tabela wszystkich pomieszczeń — wymiary, współrzędne, rzędne wysokości i palety neonów

Układ współrzędnych świata:
- `+X` = Wschód (prawo), `-X` = Zachód (lewo)
- `+Z` = Południe (dół, strona wejścia `entry` na Piętrze 60), `-Z` = Północ (góra, strona Gabinetu Zarządu i wyjścia `exit` na Piętrze 62)
- `+Y` = Góra (moduł wysokości kondygnacji wynosi **`4.80 m`**: płyta stropowa z instalacjami `0.40 m` + wysokość pomieszczeń w świetle `4.40 m`; na najwyższym piętrze i w atrium stropy są wyższe):
  - **PIĘTRO 60 (`L0`):** posadzka **`y = 0.000 m`** (płyta `y = -1.00..0.00 m`, `walkable: true`),
  - **SPOCZNIKI POŚREDNIE `L0↔L1` (`M01`):** **`y = 2.400 m`** (płyta `y = 2.00..2.40 m`, `walkable: true`),
  - **PIĘTRO 61 (`L1`):** posadzka **`y = 4.800 m`** (płyta `y = 4.40..4.80 m`, `walkable: true`),
  - **SPOCZNIKI POŚREDNIE `L1↔L2` (`M12`):** **`y = 7.200 m`** (płyta `y = 6.80..7.20 m`, `walkable: true`),
  - **PIĘTRO 62 (`L2`):** posadzka **`y = 9.600 m`** (płyta `y = 9.20..9.60 m`, `walkable: true`).
- Wszystkie granice płyt podłogowych i otworów drzwiowych leżą na **liczbach całkowitych** (`validateLayout` 1×1 m w `src/world/roomSchema.ts`).

| Nr | ID | Kondygnacja | Nazwa i funkcja pomieszczenia | Prostokąt `X` [m] | Prostokąt `Z` [m] | Wymiary i pole | Poziom podłogi `y` | Strop `y` (wys. w świetle `H`) | Dominująca paleta neonów (ADR 0006) |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | **R1** | **PIĘTRO 60** (`L0`) | **Recepcja i Lobby Główne Kurogane Arms**<br>*(monumentalna lada z logo, bramki VIP, poczekalnia, start gracza)* | `-10 .. +10` | `+10 .. +30` | `20 × 20 m`<br>(`400 m²`) | `0.00 m` | `+4.80 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Bursztyn** `#ffae1a` (logo Kurogane) + **Ciepła biel** `#fff1d6` |
| 2 | **R2** | **PIĘTRO 60** (`L0`) | **Wielki Openspace Operacyjny („Dywizja Kontraktów”)**<br>*(rzędy wysp biurek z monitorami, ścianki akustyczne, drukarki, fasada W i S)* | `-30 .. -10` | `-2 .. +30` | `20 × 32 m`<br>(`640 m²`) | `0.00 m` | `+4.80 m` (`Z>+8`, `ceiling: true`) / `+4.40 m` (`Z≤+8`) | **Błękit królewski** `#3d7bff` + **Ciepła biel** `#fff1d6` + akcent **Zieleń** `#6dff4a` |
| 3 | **R3** | **PIĘTRO 60** (`L0`) | **Korytarz Panoramowy i Strefa Analityków Rynku**<br>*(32-metrowe okno panoramiczne E, boksy analityków, gabloty, schody E)* | `+10 .. +30` | `-2 .. +30` | `20 × 32 m`<br>(`640 m²`) | `0.00 m` | `+4.80 m` (`Z>+8`, `ceiling: true`) / `+4.40 m` (`Z≤+8`) | **Bursztyn** `#ffae1a` + **Błękit królewski** `#3d7bff` + **Ciepła biel** `#fff1d6` |
| 4 | **A0** | **PIĘTRA 60–62** (`L0–L2`) | **Centralne Trzykondygnacyjne Atrium, Szyb Windy i Schody**<br>*(pustka przez 3 piętra, działająca winda, 3 biegi schodów, galerie L1/L2)* | `-10 .. +10` | `-16 .. +10` | `20 × 26 m`<br>(`520 m²` L0 + `310 m²` galerii L1/L2) | `0.00 m`<br>*(galerie: `4.80 m`, `9.60 m`)* | `+15.20 m`<br>(`H = 15.20 m`, `ceiling: true`) | **Ciepła biel** `#fff1d6` + **Bursztyn** `#ffae1a` (szyb windy) + **Błękit** `#3d7bff` |
| 5 | **R4** | **PIĘTRO 61** (`L1`) | **Wielka Sala Konferencyjna „Aegis” (Zachód)**<br>*(przeszklone ściany do atrium, stół 14-os., ściana wideo, fasada szklana W i S)* | `-30 .. -10` | `-12 .. +8` | `20 × 20 m`<br>(`400 m²`) | `4.80 m` | `+9.60 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Błękit królewski** `#3d7bff` + **Bursztyn** `#ffae1a` + **Ciepła biel** `#fff1d6` |
| 6 | **R5** | **PIĘTRO 61** (`L1`) | **Wielka Sala Konferencyjna „Vanguard” (Wschód)**<br>*(przeszklone ściany do atrium, stół taktyczny, ekran holo/neon, fasada E i S)* | `+10 .. +30` | `-12 .. +8` | `20 × 20 m`<br>(`400 m²`) | `4.80 m` | `+9.60 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Fiolet** `#8a5cff` + **Bursztyn** `#ffae1a` + **Ciepła biel** `#fff1d6` |
| 7 | **R6** | **PIĘTRO 61** (`L1`) | **Kuchnia Korporacyjna i Strefa Socjalna („Sky Lounge”)**<br>*(aneks kuchenny, ekspresy do kawy, sofy, stoliki, taras okienny NW)* | `-30 .. -10` | `-24 .. -12` | `20 × 12 m`<br>(`240 m²`) | `4.80 m` | `+9.60 m` (`X<-24`, `ceiling: true`) / `+9.20 m` | **Zieleń** `#6dff4a` + **Bursztyn** `#ffae1a` + **Ciepła biel** `#fff1d6` |
| 8 | **R7** | **PIĘTRO 61** (`L1`) | **Serwerownia Biurowa i Centrum Reprografii („Węzeł IT & Druk”)**<br>*(szafy serwerowe biura, rząd drukarek, archiwum wydruków, hazard UPS)* | `+10 .. +30` | `-24 .. -12` | `20 × 12 m`<br>(`240 m²`) | `4.80 m` | `+9.60 m` (`X>+24`, `ceiling: true`) / `+9.20 m` | **Błękit królewski** `#3d7bff` + **Zieleń** `#6dff4a` + **Fiolet** `#8a5cff` |
| 9 | **R8** | **PIĘTRO 62** (`L2`) | **Szklane Gabinety Kierownictwa — Skrzydło Zachodnie**<br>*(2 przeszklone gabinety dyrektorów, biurka executive, sofy, widok na atrium i W)* | `-24 .. -8` | `-28 .. -16` | `16 × 12 m`<br>(`192 m²`) | `9.60 m` | `+14.40 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Bursztyn** `#ffae1a` + **Ciepła biel** `#fff1d6` |
| 10 | **R9** | **PIĘTRO 62** (`L2`) | **Szklane Gabinety Kierownictwa i Foyer Zarządu — Wschód**<br>*(przystanek windy L2, sekretariat zarządu, 2 przeszklone gabinety wschodnie)* | `-8 .. +24` | `-28 .. -16` | `32 × 12 m`<br>(`384 m²`) | `9.60 m` | `+14.40 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Fiolet** `#8a5cff` + **Błękit królewski** `#3d7bff` + **Ciepła biel** `#fff1d6` |
| 11 | **R10** | **PIĘTRO 62** (`L2`) | **Gabinet Zarządu Kurogane Arms („Penthouse Prezesa”)**<br>*(panoramiczna sala posiedzeń 270°, biurko prezesa, stół zarządu, portal `exit`)* | `-24 .. +24` | `-42 .. -28` | `48 × 14 m`<br>(`672 m²`) | `9.60 m` | `+14.80 m`<br>(`H = 5.20 m`, `ceiling: true`) | **Bursztyn** `#ffae1a` + **Fiolet** `#8a5cff` + **Zieleń** `#6dff4a` (portal `exit`) |

**Podsumowanie budżetu powierzchni i widoczności z góry (`10-top.png`):**
- Obrys całkowity mapy: `X ∈ [-30, +30]` (**`60.0 m` szerokości**), `Z ∈ [-42, +30]` (**`72.0 m` długości** — spełnia próg dużych aren `≥ 70 m`).
- Łączna powierzchnia chodzenia (`walkable: true`): Piętro 60 (`2 200 m²`) + Piętro 61 (`1 490 m²`) + Piętro 62 (`1 248 m²`) + 4 klatki schodowe ze spocznikami (`~170 m²`) = **`~5 108 m²`**.
- **Gwarancja czytelności `10-top.png`, `08-high-west.png` i `09-high-east.png`:**
  - `Z ∈ [+8, +30]` (`60 × 22 m`): brak płyt `L1` i `L2` — z góry w 100% widoczne `R1` (Lobby), `R2` (Openspace) i `R3` (Korytarz Panoramowy) na **`y = 0.00 m`**;
  - `Z ∈ [-16, +8]` (`60 × 24 m`) + pasy `X ∈ [-30, -24]` i `[+24, +30]` na `Z ∈ [-24, -16]`: brak płyt `L2` — z góry w 100% widoczne `R4` (Sala Konferencyjna W), `R5` (Sala Konferencyjna E), zewnętrzne strefy `R6` (Kuchnia) i `R7` (Serwerownia/Drukarnia) na **`y = 4.80 m`** oraz cała pustka **Atrium `A0` (`y = 0.00..15.20 m`)** wraz z szybem windy i wszystkimi biegami schodów;
  - `Z ∈ [-42, -16]` (`48 × 26 m`): w 100% widoczne `R8`, `R9` (Szklane Gabinety i Foyer) oraz `R10` (Gabinet Zarządu) na **`y = 9.60 m`**.

### 3.3. Rzuty 3 kondygnacji i przekrój pionowy (ASCII)

#### A. Przekrój podłużny Północ–Południe (`X = 0 .. -8 m`, widok na Zachód `-X`) — kaskada 3 pięter i Atrium

```text
          PÓŁNOC (-Z, WIDOK NA MIASTO)                                   POŁUDNIE (+Z, WEJŚCIE)
Z=-42             Z=-28         Z=-16  Z=-12        Z=-8          Z=+8   Z=+10                Z=+30
y=+15.2m                            +======================================+ <-- Świetlik/Strop Atrium (ceiling:true)
y=+14.8m +==========================+      A0 CENTRALNE ATRIUM (3 PIĘTRA)  |
         |   R10 GABINET ZARZĄDU    #  R8/R9   |  [Szyb Windy]  |          |
         |  (Penthouse, H = 5.2m)   # Gabinety |  elevators[0]  |          |
y=+9.6m  +[EXIT]=+==================+==========+==[Przyst. L2]==+          | <-- Posadzka Piętra 62 (L2, y=9.60m)
                 |  R6 Kuchnia /    #  Galeria |   | Winda |   / Schody    |
                 |  R7 Serwerownia  #  Atrium  |   | 0->9.6|  /  L1->L2    |
y=+7.2m          |  (Piętro 61)     |          |   |   ^   | +-[Spocznik]  |
                 |                  |          |   |   v   |/              +====================+ <-- Strop L1 (ceiling:true)
y=+4.8m          +==================+==========+==[Przyst. L1]=============+   R4/R5 SALE KONF. | <-- Posadzka Piętra 61 (L1, y=4.80m)
                                    |          |   |       |  \ Schody     #  (Przeszklone)     |
y=+2.4m                             |          |   |       |   +-[Spocznik]|                    +====================+ <-- Strop L0 (ceiling:true)
                                    |          |   |       |  /  L0->L1    |   R2 OPENSPACE /   #   R1 RECEPCJA      |
y=0.0m                              +==========+==[Przyst. L0]=============+   R3 KORYTARZ PAN. #   I LOBBY (START)  +[ENTRY] <-- Piętro 60 (L0, y=0.00m)
        Z=-42                       Z=-16     Z=-12          Z=-8         Z=+8                 Z=+10                Z=+30
         |                                                                                                            |
         v  [SZKLANE FASADY KURTYNOWE 360° (mat_glass_clear) — WIDOK W DÓŁ NA MIASTO: panoramaDropM = 180 m]          v
```

#### B. Rzut Kondygnacji 0 — PIĘTRO 60 (`L0`, `y = 0.00 m`, `X ∈ [-30, +30], Z ∈ [-16, +30]`)

```text
                                PÓŁNOC (-Z) — SZKLANA FASADA PÓŁNOCNA ATRIUM (WIDOK NA MIASTO)
       X=-30                 X=-10      X=-6.4   X=-1.8  X=+1.8   X=+6.4      X=+10                 X=+30
Z=-16                        +==========+========+=======+========+==========+                            Z=-16
                             |          |        | SZYB  |        |          |
                             |  Wnęka   |        | WINDY |        |  Wnęka   |
                             |  Zach.   |        | (3.6x |        |  Wsch.   |
Z=-12                        |  Atrium  |        | 3.6m) |        |  Atrium  |                            Z=-12
                             |          |        +==[=]===+        |          |
                             |          |      [Panel L0 ▲/▼]     |          |
Z=-2    +====================+          |                         |          +====================+       Z=-2
        |                    # Brama    |           A0            | Brama    #                    |
        |                    | R2<->A0 N|   CENTRALNE ATRIUM      | A0<->R3 N|    [Schody Wsch.]  |
        |        R2          |(Z=-1..+3)|    POZIOM DOLNY (L0)    |(Z=-1..+3)|    || L0 -> L1 ||  |
        |  WIELKI OPENSPACE  |          |     (20 x 26 m)         |          |    || (X=+12)  ||  |
        |     OPERACYJNY     |          |                         |          |                    |
        |   (20 x 32 m)      | [Schody] |   [Wyspa Granitowa i    |          |        R3          |
        |                    | ||Zach.||     Donice Atrium]       |          |     KORYTARZ       |
        | [Wyspa]   [Wyspa]  | ||L0-> ||                          |          |   PANORAMOWY I     |
        | [Biurek]  [Biurek] | || L1  ||                          |          | STREFA ANALITYKÓW  |
        |                    | ||25.6°||                          |          |   (20 x 32 m)      |
Z=+10   | [Wyspa]   [Wyspa]  +----------+====+               +====+----------+                    |       Z=+10
        | [Biurek]  [Biurek] |               | Portal R1->A0 |               | [Boksy Analityków] |
        |                    # Brama         | (X=-6..+6,    |         Brama #                    |
        | [Drukarka][Szafy]  | R1<->R2       |  szer. 12 m)  |       R1<->R3 | [Gabloty Kurogane] |
        |                    |(Z=+18..+22)   |               |   (Z=+18..+22)|                    |
        | [Wyspa]   [Wyspa]  |               |      R1       |               | [Ławy Widokowe]    |
        | [Biurek]  [Biurek] |               |  RECEPCJA I   |               |  przy Szybie E     |
        |                    |               | LOBBY GŁÓWNE  |               |                    |
        | [Tablica Wyników]  |               | [Lada + Logo] |               | [Ekran Giełdowy]   |
        |                    |               | [Bramki VIP]  |               |                    |
        |                    |               | (START 0,0,26)|               |                    |
Z=+30   +====================+===============+====[ENTRY]====+===============+====================+       Z=+30
       X=-30                 X=-10                 X=0 (Z=30.5)              X=+10                 X=+30
                     POŁUDNIE (+Z) — SZKLANA FASADA POŁUDNIOWA (WIDOK W DÓŁ NA KANION MIASTA)
```

#### C. Rzut Kondygnacji +1 — PIĘTRO 61 (`L1`, `y = 4.80 m`, `X ∈ [-30, +30], Z ∈ [-24, +8]`)

```text
                             PÓŁNOC (-Z) — SZKLANE FASADY BOCZNE I STYK Z PODPORAMI L2
       X=-30                 X=-10      X=-6.4   X=-1.8  X=+1.8   X=+6.4      X=+10                 X=+30
Z=-24   +====================+==========+========+=======+========+==========+====================+       Z=-24
        |                    |          | [Schody| SZYB  |        |          |                    |
        |        R6          |          |  Zach. | WINDY |        |          |        R7          |
        |  KUCHNIA I STREFA  # Brama    |  L1->  | (3.6m)|        | Brama    #   SERWEROWNIA      |
        |     SOCJALNA       | R6<->A0  |  L2]   +==[=]===+       | A0<->R7  |    BIUROWA I       |
        |   „SKY LOUNGE”     |(Z=-18..  |          Mostek Windy L1|(Z=-18..  |    DRUKARNIA       |
        |   (20 x 12 m)      |  -14)    |         [Panel L1 ▲/▼]  |  -14)    |   (20 x 12 m)      |
        | [Aneks]  [Ekspres] |          |         (Z=-12.2..-8.0) |          | [Szafy]  [Drukarki]|
Z=-12   +------+      +------+          +--------+.......+--------+          +------+      +------+       Z=-12
        |     Brama R4/R6    |          :                         :          |     Brama R5/R7    |
        |    (X=-22..-18)    | Galeria  :      OTWÓR ATRIUM       : Galeria  |    (X=+18..+22)    |
        |                    # Zach. L1 :     (PUSTKA W DÓŁ       : Wsch. L1 #                    |
        |        R4          | (sz.3.6m):      NA PARTER L0)      : (sz.3.6m)|        R5          |
        | SALA KONFERENCYJNA |          :  (X=-6.4..+6.4,         : [Schody  | SALA KONFERENCYJNA |
        |      „AEGIS”       | [Szklana :   Z=-8.0..+5.0)         :  Wsch.   |     „VANGUARD”     |
        |   (20 x 20 m)      |  Ścianka]:                         :  L1->L2] |   (20 x 20 m)      |
        |                    |          :                         :          |                    |
        |  [Wielki Stół      # Brama    +-------------------------+ Brama    #  [Wielki Stół      |
        |   Konferencyjny]   | R4<->A0  |  Południowy Mostek L1   | A0<->R5  |   Konferencyjny]   |
        |  [Ekran Wideo W]   |(Z=-2..+2)|  (Z=+5.0..+8.0, y=4.80) |(Z=-2..+2)|  [Ekran Holo/Neon] |
Z=+8    +====================+==========+=========================+==========+====================+       Z=+8
       X=-30                 X=-10      X=-6.4                    X=+6.4      X=+10                 X=+30
                     POŁUDNIE (+Z) — TARASOWY USKOK NAD PARTEREM L0 (ODSŁANIA R1, R2, R3 W 10-TOP!)
```

#### D. Rzut Kondygnacji +2 — PIĘTRO 62 (`L2`, `y = 9.60 m`, `X ∈ [-24, +24], Z ∈ [-42, -16]`)

```text
                          PÓŁNOC (-Z) — PANORAMICZNA FASADA 270° NAD MIASTEM (180 M W DÓŁ)
              X=-24                 X=-8          X=0          X=+8                 X=+24
Z=-42          +====================+=========[EXIT (y=9.6m)]===+====================+          Z=-42
               |                                                                     |
               |                                R10                                  |
               |                  GABINET ZARZĄDU KUROGANE ARMS                      |
               |               („PENTHOUSE PREZESA”, 48 x 14 m, H=5.2m)              |
               |                                                                     |
               |  [Strefa VIP W]     [Stół Posiedzeń Zarządu]     [Biurko Prezesa]   |
               |  [Sofy + Gabloty]   [Makieta Holo Wieżowca]      [Sejf + Terminale] |
Z=-28          +------+      +------+------+             +------+------+      +------+          Z=-28
               |    Brama R8/R10    |      |   Portal    |      |    Brama R9/R10    |
               |    (X=-18..-14)    |Szkl. |  R9 -> R10  |Szkl. |    (X=+14..+18)    |
               |                    |Ścian.| (X=-3..+3)  |Ścian.|                    |
               |         R8         #Drzwi |             |Drzwi #         R9         |
               |  SZKLANE GABINETY  |R8/R9 |   FOYER     |R9    |  SZKLANE GABINETY  |
               |   KIEROWNICTWA W   |(Z=-22|   ZARZĄDU   |(Z=-22|   KIEROWNICTWA E   |
               |    (16 x 12 m)     |..-19)| [Sekretariat|..-19)|    (16 x 12 m)     |
               | [Gabinet] [Gabinet]|      |  Zarządu]   |      | [Gabinet] [Gabinet]|
               | [Dyr.Fin] [Dyr.B+R]|      | [Panel ▲/▼] |      | [Dyr.Op.] [Dyr.Pr.]|
Z=-16          +====================+==++==+=====[=]=====+==++==+====================+          Z=-16
                                       ||   SZYB WINDY L2   ||
                                    [Schody (Przystanek #2) [Schody
                                     Zach.   doorSide: "N"   Wsch.
                                     L1->L2]                 L1->L2]
                     POŁUDNIE (+Z) — WIDOK Z GÓRY NA CAŁE ATRIUM A0, PIĘTRO 61 I PIĘTRO 60!
```

### 3.4. Winda (`elevators[]`), reprezentacyjne schody i przejścia — weryfikacja nawigacji 3D

#### A. Specyfikacja działającej windy w szybie Atrium (`elevators[0]`)

Winda znajduje się w północno-centralnej osi Trzykondygnacyjnego Atrium (`X = 0.0, Z = -14.0`) w całkowicie przeszklonym szybie konstrukcyjnym (`mat_glass_clear` + 4 narożne słupy stalowe `0.35 × 15.20 × 0.35 m` na `X = ±1.80 m, Z = -14.0 ± 1.80 m`), dzięki czemu ruch kabiny między piętrami jest widoczny z każdego miejsca Atrium, z Recepcji `R1`, z obu Sal Konferencyjnych `R4`/`R5` oraz z Foyer Zarządu `R9`!

Konfiguracja obiektu w polu `elevators` w `src/data/rooms/run4.json` (zgodnie z kontraktem `docs/systems/elevator.md`):

```json
"elevators": [
  {
    "id": "atrium-main-lift",
    "x": 0,
    "z": -14,
    "width": 3.2,
    "depth": 3.2,
    "startStop": 0,
    "stops": [
      { "y": 0.0, "doorSide": "S" },
      { "y": 4.8, "doorSide": "S" },
      { "y": 9.6, "doorSide": "N" }
    ]
  }
]
```

**Rozmieszczenie portali drzwi szybowych (`off_elevator_shaft_door`), kabiny (`off_elevator_cab`) i paneli wezwania (`off_elevator_call_panel`):**

| Przystanek | Poziom `y` | Strona drzwi (`doorSide`) | Pozycja portalu drzwi szybu `off_elevator_shaft_door` | Pozycja panelu wezwania `off_elevator_call_panel` (przyciski GÓRA `▲` / DÓŁ `▼`) | Dokąd wychodzi gracz i AI z kabiny |
|---|---|---|---|---|---|
| **Stop 0 — Piętro 60 (`L0`)** | `y = 0.00 m` | `"S"` (`+Z`, `Z = -12.2 m`) | `(0.0, 0.0, -12.2)`, `yaw = 0` (światło wejścia `2.20 × 2.80 m`) | `(2.15, 0.0, -12.05)`, `yaw = 0` (po prawej stronie drzwi szybu, przycisk **GÓRA `▲`** świeci na zielono `#6dff4a`) | Centralne Atrium `A0` na `y = 0.00 m`, na wprost osi z Recepcji `R1` |
| **Stop 1 — Piętro 61 (`L1`)** | `y = 4.80 m` | `"S"` (`+Z`, `Z = -12.2 m`) | `(0.0, 4.8, -12.2)`, `yaw = 0` | `(2.15, 4.8, -12.05)`, `yaw = 0` (przyciski **GÓRA `▲`** `#6dff4a` oraz **DÓŁ `▼`** `#ffae1a`) | Północny Mostek Galerii Atrium `L1` (`X ∈ [-6.4, +6.4], Z ∈ [-12.2, -8.0], y = 4.80 m`), skąd na boki prowadzą wejścia do `R4`, `R5`, `R6`, `R7` |
| **Stop 2 — Piętro 62 (`L2`)** | `y = 9.60 m` | `"N"` (`-Z`, `Z = -15.8 m`) | `(0.0, 9.6, -15.8)`, `yaw = π` | `(-2.15, 9.6, -15.95)`, `yaw = π` (po prawej stronie drzwi patrząc na szyb z Foyer `R9`, przycisk **DÓŁ `▼`** `#ffae1a`) | Foyer Zarządu w `R9` (`X ∈ [-8, +8], Z ∈ [-28, -16], y = 9.60 m`), bezpośrednio przed wejściem do Gabinetu Zarządu `R10`! |

#### B. Tabela wszystkich klatek schodowych (biegi rampowe `walkable: true`) i portali drzwiowych

Wszystkie 4 klatki schodowe mają czysty obrót `rotation.x`, kąt nachylenia **`25.64° ≤ 26.6°`**, szerokość **`3.20 m ≥ 2.0 m`** i prześwit nad każdym punktem biegu **`≥ 3.80 m`** (brak nakładania się biegów w pionie!):

| Połączenie / Klatka schodowa | Położenie w rzucie `[X, Z]` | Rzędne `y` | Wymiary i kąt nachylenia | Rola w przepływie walki i nawigacji AI |
|---|---|---|---|---|
| **Wejście `doors[entry]` → R1 (Lobby)** | `X ∈ [-2, +2], Z = +30.5` | `y = 0.00 m` | `4.0 × 3.0 m` | Punkt startu gracza `playerSpawn: (0, 0, +26)` w Lobby `R1` |
| **Klatka #1: Schody Główne Atrium Zachód (`L0 ↔ L1`)** | Bieg dolny: `X ∈ [-9.6, -6.4], Z: +8.0 → +3.0`<br>Spocznik `M01-W`: `X ∈ [-9.6, -6.4], Z ∈ [0.0, +3.0]`<br>Bieg górny: `X ∈ [-9.6, -6.4], Z: 0.0 → -5.0` | `0.00 → 2.40 → 4.80 m` | Szer. `3.2 m`, 2 biegi po `5.0 m`, kąt **`25.64°`** (`≤ 26.6°`) | Główny reprezentacyjny bieg w zachodniej części Atrium `A0`, widoczny wprost z Lobby `R1` |
| **Klatka #2: Schody Panoramowe Wschód (`L0 ↔ L1`)** | Bieg dolny: `X ∈ [+10.4, +13.6], Z: +20.0 → +15.0`<br>Spocznik `M01-E`: `X ∈ [+10.4, +13.6], Z ∈ [+12.0, +15.0]`<br>Bieg górny: `X ∈ [+10.4, +13.6], Z: +12.0 → +7.0` | `0.00 → 2.40 → 4.80 m` | Szer. `3.2 m`, 2 biegi po `5.0 m`, kąt **`25.64°`** (`≤ 26.6°`) | Druga niezależna droga z Korytarza Panoramowego `R3` (`L0`) na Południowy Mostek `L1` przed Salę Konferencyjną `R5` |
| **Klatka #3: Schody Główne Atrium Wschód (`L1 ↔ L2`)** | Bieg dolny: `X ∈ [+6.4, +9.6], Z: -3.0 → -8.0`<br>Spocznik `M12-E`: `X ∈ [+6.4, +9.6], Z ∈ [-11.0, -8.0]`<br>Bieg górny: `X ∈ [+6.4, +9.6], Z: -11.0 → -16.0` | `4.80 → 7.20 → 9.60 m` | Szer. `3.2 m`, 2 biegi po `5.0 m`, kąt **`25.64°`** (`≤ 26.6°`) | Reprezentacyjny bieg po wschodniej stronie pustki Atrium prowadzący z Galerii `L1` do Foyer Zarządu `R9` (`L2`) |
| **Klatka #4: Schody Górne Atrium Zachód (`L1 ↔ L2`)** | Bieg dolny: `X ∈ [-6.2, -3.0], Z: -5.0 → -10.0`<br>Spocznik `M12-W`: `X ∈ [-6.2, -3.0], Z ∈ [-13.0, -10.0]`<br>Bieg górny: `X ∈ [-6.2, -3.0], Z: -13.0 → -18.0` | `4.80 → 7.20 → 9.60 m` | Szer. `3.2 m`, 2 biegi po `5.0 m`, kąt **`25.64°`** (`≤ 26.6°`) | Drugi równoległy bieg po zachodniej stronie szybu windy, łączący Mostek `L1` z Foyer Zarządu i Gabinetami `R8` (`L2`) |
| **Portury drzwiowe między pokojami (`off_glass_partition_door`)** | Wszystkie przejścia wewnętrzne między `R1..R10` i `A0` | `0.00 / 4.80 / 9.60 m` | Szerokość w świetle **`3.0–4.0 m`** (`≥ 2.0 m`), wys. `3.2 m` | Pełna drożność siatki `0.5 m` dla AI i ślizgów gracza |
| **Wyjście `doors[exit]` (północ `R10` na Piętrze 62)** | `X ∈ [-2, +2], Z = -42.5` | `y = 9.60 m` (`pos.y = 11.10`) | `4.0 × 3.0 m` | Ekspresowa śluza ewakuacyjna Zarządu na północnym krańcu Piętra 62 |

### 3.5. Szczegółowy opis 10 pomieszczeń i Atrium — wyposażenie, przeszklenia, osłony i walka

#### 1. `R1` — Recepcja i Lobby Główne Kurogane Arms (`L0`, `X ∈ [-10, +10], Z ∈ [+10, +30], y = 0.00 m`)
- **Klimat i funkcja:** Reprezentacyjna wizytówka korporacji na 60. piętrze. Posadzka z czarnego polerowanego granitu `off_polished_granite`, ściany wyłożone ciemnymi lamelami `off_wood_slat_wall`, południowa ściana (`Z = +30`) po bokach śluzy wejściowej przeszklona (`mat_glass_clear` + `off_facade_mullion`) z widokiem w dół na kanion miasta.
- **Kadr startowy (`01-spawn.png` z `playerSpawn: (0, 0, +26)`):**
  - Na osi wzroku `(X = 0, Z = +19.5)` stoi szeroki zespół **Bramki Optycznej VIP `off_security_turnstile`** (z wolnym przejściem `2.20 m` pośrodku), a za nim po zachodniej i wschodniej stronie portalu do Atrium (`X = ±5.2, Z = +13.5`) dwie monumentalne **Lady Recepcyjne `off_reception_desk`** (`4.8 × 1.2 × 1.6 m`) z podświetlonym na bursztynowo emblematem i napisem **`KUROGANE ARMS // PIĘTRO 60`**.
  - Dzięki rozstawieniu lad po obu bokach osi centralnej gracz w `01-spawn.png` widzi jednocześnie reprezentacyjną recepcję z logo, otwierające się za nią 3-piętrowe **Atrium `A0`**, przeszklony szyb działającej windy, biegi schodów na piętra `L1`/`L2` oraz nocną panoramę wieżowców za północną szklaną fasadą!
- **Osłony i obiekty interaktywne:** Po bokach poczekalni (`X = ±7.5, Z = +23.5`) stoją klubowe sofy `off_lounge_sofa`, donice akustyczne `off_office_planter`, stoliki oraz 2 skrzynie kurierskie `crate` + 2 `crate_small` do Chwytu Rezonansem.

#### 2. `R2` — Wielki Openspace Operacyjny „Dywizja Kontraktów” (`L0`, `X ∈ [-30, -10], Z ∈ [-2, +30], y = 0.00 m`)
- **Klimat i funkcja:** Tętniąca światłem monitorów hala biurowa (`640 m²`) z wykładziną dywanową `off_carpet_tile`. Cała ściana zachodnia (`X = -30`, długość `32 m`) oraz południowa (`Z = +30`, długość `20 m`) to **pełnowymiarowa szklana fasada kurtynowa (`mat_glass_clear` + `off_facade_mullion`)**, za którą w dole płynie ruch powietrzny, a naprzeciwko wyrasta sąsiedni cyber-wieżowiec z animowanym billboardem.
- **Układ biurek i walka:**
  - **8 czteroosobowych Wysp Biurek `off_desk_pod`** (`3.6 × 1.35 × 1.8 m`) ustawionych w dwie kolumny (`X = -24.5` oraz `X = -15.5`) na `Z = +3.5, +10.5, +17.5, +24.5`, uzupełnionych fotelami `off_office_chair`. Środkowe ścianki akustyczne wysp (`wys. 1.35 m`) dają idealną osłonę przed ogniem strzelców, pozwalając jednocześnie przeskakiwać nad biurkami (`dash` / `doubleJump`) z ostrzem plazmowym!
  - Między rzędami biurek stoją donice akustyczne `off_office_planter`, kserokopiarki `off_office_printer` (`(-20.0, 0, +14.0)`), punkt kawowy `off_coffee_machine` (`(-20.0, 0, +27.5)`) oraz szafy kartotekowe `off_filing_cabinet` przy ścianie wschodniej.
  - Na filarach i ściance działowej wiszą szklane tablice `off_whiteboard_wall` z wykresami sprzedaży uzbrojenia i zabawnymi notatkami korporacyjnymi (`decals`).

#### 3. `R3` — Korytarz Panoramowy i Strefa Analityków Rynku (`L0`, `X ∈ [+10, +30], Z ∈ [-2, +30], y = 0.00 m`)
- **Klimat i funkcja:** Wschodnie skrzydło Piętra 60 z polerowaną posadzką granitową `off_polished_granite` wzdłuż **32-metrowego panoramicznego okna wschodniego (`X = +30`)**, tuż za którym przebiega **tor bliskiego przelotu pojazdów (`close fly-by`, `X = +40 m`)**!
- **Wyposażenie i osłony:**
  - Wzdłuż szklanej fasady wschodniej (`X = +27.5`) rozstawione są ławy widokowe i sofy `off_lounge_sofa`, donice `off_office_planter` oraz pancerne gabloty ekspozycyjne z makietami produktów korporacji (`mall_kurogane_display`).
  - W części środkowej (`X = +18..+23`) stoją 4 wyspy analityków giełdowych `off_desk_pod` z wielkim ściennym ekranem notowań `off_conf_screen_wall` (`mat_screen_office_analytics`).
  - W północno-zachodniej części pokoju (`X ∈ [+10.4, +13.6], Z = +20.0 → +7.0`) wznosi się **Klatka Schodowa #2 (`L0 → L1`)**, prowadząca na Piętro 61.
  - **Hazard #1 (`laser_gate`, `id: "panorama-security-laser"`):** bramka zabezpieczająca strefę gablot eksportowych na `Z = +14.0` (`from: (15.0, 0.85, 14.0), to: (22.0, 0.85, 14.0)`, `cycle: { onS: 2.6, offS: 1.8 }`).

#### 4. `A0` — Centralne Trzykondygnacyjne Atrium, Szyb Windy i Schody Główne (`L0/L1/L2`, `X ∈ [-10, +10], Z ∈ [-16, +10], y = 0.00..15.20 m`)
- **Klimat i pion walki:** Wysoka na `15.20 m` otwarta przestrzeń spinająca wszystkie trzy piętra:
  - Na posadzce `y = 0.00 m` centralna wyspa z czarnego granitu z dwiema dużymi donicami `off_office_planter`, sofami `off_lounge_sofa` i tablicą informacyjną pięter (`60: LOBBY & OPENSPACE // 61: KONFERENCJE & IT // 62: ZARZĄD`).
  - W części północnej (`X = 0, Z = -14.0`): **Przeszklony Szyb Działającej Windy `elevators[0]`** z kabiną `off_elevator_cab`, portalami `off_elevator_shaft_door` i panelami `off_elevator_call_panel` na `y = 0.00, 4.80, 9.60 m`. Za szybem windy północna ściana Atrium (`Z = -16, Y ∈ [0, 9.6]`) jest w całości przeszklona (`mat_glass_clear`), otwierając widok na północną panoramę miasta.
  - Po bokach pustki Atrium wznoszą się biegi reprezentacyjnych schodów (**Klatka #1 `L0→L1`** po zachodzie `X = -8.0`, **Klatka #3 `L1→L2`** po wschodzie `X = +8.0`, **Klatka #4 `L1→L2`** po zachodniej stronie szybu windy `X = -4.6`), a na poziomie `y = 4.80 m` obiega je Galeria `L1` z przezroczystymi balustradami `off_atrium_glass_rail`.
  - Strzelcy na galeriach `L1 (y = 4.80 m)` i `L2 (y = 9.60 m)` mają diagonalne linie ostrzału przez pustkę Atrium, a gracz może zrzucać ich Pchnięciem Rezonansu przez szklane balustrady na posadzkę parteru!

#### 5. `R4` — Wielka Sala Konferencyjna „Aegis” (`L1` Zachód, `X ∈ [-30, -10], Z ∈ [-12, +8], y = 4.80 m`)
- **Klimat i przeszklenia:** Flagowa sala posiedzeń zachodniego skrzydła na 61. piętrze (`400 m²`). Ściana wschodnia (`X = -10`, od strony Atrium) jest wykonana z modułów przeszklonych ścianek działowych `off_glass_partition_wall` i szerokiego otwartego portalu `off_glass_partition_door` (`Z ∈ [-2, +2]`), dzięki czemu z sali widać całe Atrium, szyb windy i przeciwległą salę `R5`! Ściany zachodnia (`X = -30`) i południowa (`Z = +8`) to zewnętrzne szklane fasady z widokiem z wysokości `184.8 m` na miasto.
- **Wyposażenie i osłony:**
  - W centrum dwa złączone moduły **Wielkiego Stołu Konferencyjnego `off_conference_table`** (`5.6 × 1.05 × 2.0 m` każdy, razem `11.2 m` długości wzdłuż osi `Z` na `X = -20.0`) otoczone 14 fotelami `off_office_chair` — potężna wyspa osłon w centrum sali.
  - Na ścianie północnej (`Z = -11.78, X = -20.0`) wielka **Ściana Wideo `off_conf_screen_wall`** (`4.2 × 2.4 m`) wyświetlająca mapę operacyjną sektora, a po bokach kredensy z dokumentacją `off_filing_cabinet`, tablice `off_whiteboard_wall` i panele akustyczne `off_acoustic_wall_panel`.

#### 6. `R5` — Wielka Sala Konferencyjna „Vanguard” (`L1` Wschód, `X ∈ [+10, +30], Z ∈ [-12, +8], y = 4.80 m`)
- **Klimat i przeszklenia:** Wschodnia sala strategiczna i pokazowa dla kontrahentów Kurogane (`400 m²`), przeszklona od strony Atrium (`X = +10`, `off_glass_partition_wall` + `off_glass_partition_door`) oraz od wschodu (`X = +30`) i południa (`Z = +8`) ku panoramie miasta.
- **Wyposażenie i osłony:**
  - Układ dwóch równoległych stołów konferencyjnych `off_conference_table` (`X = +16.5` oraz `X = +23.5`, `Z = -2.0`) z podświetlonymi na fioletowo i bursztynowo blatami taktycznymi (`mat_screen_map`), rozdzielonych aleją środkową z niskimi donicami `off_office_planter`.
  - Na północnej ścianie (`Z = -11.78, X = +20.0`) ekran prezentacyjny `off_conf_screen_wall`, a przy oknie wschodnim sofy VIP `off_lounge_sofa` do negocjacji nieoficjalnych.

#### 7. `R6` — Kuchnia Korporacyjna i Strefa Socjalna „Sky Lounge” (`L1` Północny-Zachód, `X ∈ [-30, -10], Z ∈ [-24, -12], y = 4.80 m`)
- **Klimat i funkcja:** Nocna kantyna i strefa kawowa dla pracowników na 61. piętrze (`240 m²`), z narożną szklaną fasadą północno-zachodnią (`X = -30, Z ∈ [-24, -12]`).
- **Wyposażenie i osłony:**
  - Przy ścianie wewnętrznej (`X = -14..-22, Z = -23.2`) dwa moduły **Aneksu Kuchennego `off_kitchenette_counter`** (`3.6 × 2.2 × 0.9 m`) oraz wyspowy **Bar Kawowy z Ekspresem `off_coffee_machine`** (`(-18.0, 4.8, -18.0)`), obok których stoją 2 automaty `city_vending`.
  - W zachodniej strefie widokowej (`X ∈ [-28, -21]`) cztery sofy `off_lounge_sofa`, stoliki, donice `off_office_planter` oraz skrzynie zaopatrzeniowe `crate` i `crate_small` do rzucania Rezonansem.

#### 8. `R7` — Serwerownia Biurowa i Centrum Reprografii „Węzeł IT & Druk” (`L1` Północny-Wschód, `X ∈ [+10, +30], Z ∈ [-24, -12], y = 4.80 m`)
- **Klimat i funkcja:** Techniczne serce pięter biurowych (`240 m²`), łączące klimatyzowany węzeł serwerowy z działem druku poufnych kontraktów.
- **Wyposażenie, osłony i hazard:**
  - W części wschodniej (`X ∈ [+20, +28]`) dwa rzędy po 3 **Szafy Serwerowe Biura `off_office_server_rack`** (`1.2 × 2.3 × 1.0 m`) z niebiesko-zielonymi diodami LED oraz wymienniki klimatyzacji `city_ac_unit`.
  - W części zachodniej (`X ∈ [+12, +19]`) centrum reprografii: 3 wysokonakładowe **Drukarki Wielofunkcyjne `off_office_printer`** (`1.6 × 1.3 × 0.85 m`), szafy na akta `off_filing_cabinet` i rozsypane na posadzce arkusze z klauzulą poufności (`decal` `off_scattered_contracts`).
  - **Hazard #2 (`electric_field`, `id: "office-ups-overload"`):** przeciążony moduł zasilania UPS między rzędami szaf serwerowych na `(23.5, 5.8, -18.0)` (`spód na y = 4.80 m`, `size: (2.8, 2.0, 3.0)`, `cycle: { onS: 3.0, offS: 2.2 }`) + **Hazard #3 (`explosive_barrel`, `id: "toner-coolant-cylinder"`):** zbiornik chłodziwa na `(27.5, 4.8, -14.0)`.

#### 9. `R8` i `R9` — Szklane Gabinety Kierownictwa oraz Foyer Zarządu (`L2`, `X ∈ [-24, +24], Z ∈ [-28, -16], y = 9.60 m`)
- **Klimat i funkcja:** Przedpole najwyższej władzy korporacyjnej na 62. piętrze (`576 m²`).
  - **Centralne Foyer Zarządu (`X ∈ [-8, +8], Z ∈ [-28, -16]`):** miejsce, gdzie otwierają się północne drzwi **Przystanku #2 Windy (`y = 9.60 m`, `Z = -15.8`)** oraz dochodzą dwie górne klatki schodowe z Atrium (**Klatka #3** na `X = +8.0` i **Klatka #4** na `X = -4.6`). W centrum Foyer stoi lada sekretariatu Zarządu `off_reception_desk` (`(0, 9.6, -22.0)`), sofy oczekiwania `off_lounge_sofa` i bramka skanera przed wejściem do Gabinetu Zarządu `R10`.
  - **`R8` — Szklane Gabinety Kierownictwa Zachód (`X ∈ [-24, -8], Z ∈ [-28, -16]`):** oddzielone od Foyer przeszkloną ścianą `off_glass_partition_wall` z portalem `off_glass_partition_door`. Mieści gabinet Dyrektora Finansowego (CFO) oraz Dyrektora B+R — w każdym stoi masywne **Biurko Dyrektorskie `off_executive_desk`**, fotel `off_office_chair`, szafa `off_filing_cabinet`, sofa `off_lounge_sofa` i tablica `off_whiteboard_wall`.
  - **`R9` — Szklane Gabinety Kierownictwa Wschód (`X ∈ [+8, +24], Z ∈ [-28, -16]`):** symetryczny zespół dwóch przeszklonych gabinetów (Dyrektora Operacyjnego i Szefa Działu Prawnego) z widokiem przez wschodnią szklaną fasadę (`X = +24`) na dachy sąsiednich wieżowców i billboardy.

#### 10. `R10` — Gabinet Zarządu Kurogane Arms „Penthouse Prezesa” (`L2` Północ, `X ∈ [-24, +24], Z ∈ [-42, -28], y = 9.60 m`)
- **Klimat i kulminacja wizualna mapy:** Monumentalny salon i sala posiedzeń Zarządu (`48 × 14 m = 672 m²`, wysokość do stropu `H = 5.20 m`, `y = 9.60..14.80 m`) na północnym szczycie 62. piętra.
- **Trójstronna szklana fasada panoramiczna 270° (`X = -24`, `Z = -42`, `X = +24`):** całe trzy zewnętrzne ściany Gabinetu Zarządu są ze szkła `mat_glass_clear` z mullionami `off_facade_mullion`. Za północną i bocznymi szybami rozpościera się pełny widok z wysokości **`189.6 m`** na żywe cyber-miasto, migające bursztynowe światła ostrzegawcze na masztach, wielkie hologramy reklamowe i przelatujące tuż za oknem ślizgacze!
- **Wyposażenie, osłony i finałowe starcie:**
  - W centrum (`X = 0, Z = -35.0`): podłużny **Stół Posiedzeń Zarządu** (dwa moduły `off_conference_table` na podwyższonym dywanie z obrysem `mat_neon_amber`), a po jego bokach symetryczne strefy negocjacyjne z sofami `off_lounge_sofa` (`X = ±14.0, Z = -35.0`), donicami `off_office_planter` i pancernymi gablotami prototypów Kurogane (`lab_prototype_weapon_rack` / `mall_kurogane_display`).
  - W zachodnim skrzydle (`X = -18.5, Z = -35.0`): reprezentacyjne **Biurko Prezesa Kurogane Arms `off_executive_desk`** zwrócone przodem do panoramicznego okna północnego, z wielkim ekranem `off_conf_screen_wall` i sejfem `lab_classified_cabinet`.
  - **Hazard #4 (`laser_gate`, `id: "boardroom-vault-laser"`):** bramka laserowa chroniąca wschodnią strefę sejfu zarządu na `X = +16.5` (`from: (16.5, 10.45, -39.0), to: (16.5, 10.45, -32.0)`, `cycle: { onS: 2.4, offS: 1.8 }`).
  - Na północnej osi centralnej (`X = 0, Y = 11.1, Z = -42.5`): **drzwi wyjściowe `doors[exit]`** (prywatna winda ewakuacyjna Zarządu / lądowisko) obramowane zielonym neonem `arrow` i pasem `mat_neon_green`.

---

## 4. Katalog zasobów: nowe modele `off_*`, nowe tekstury, zasoby istniejące i zakazane

### 4.1. Nowe modele 3D (`tools/blender/sets/kurogane_office.py` → `public/assets/models/city/off_*.glb`)

Zestaw obejmuje **25 własnych modeli proceduralnych** w Blenderze z prefiksem **`off_`**. Wszystkie modele stosują konwencje z `docs/assets.md`:
- Jednostki: metry, układ glTF Y-up, przód w `+Z`, spód na `Y = 0` (dla modeli sufitowych wieszaki sięgają górnego AABB do styku `ceilingContact` w `mapAudit.ts`).
- Cieniowanie płaskie (flat low-poly) z fazowanymi krawędziami, jedna scalona siatka na materiał (`_city_merge_details`), brak wbudowanych obrazów w GLB (`material.map` puste — nadruki UV przez `mat_label_*` i `mat_screen_*`).
- **Rygor materiałów:** duże białe powierzchnie świecące (oprawy sufitowe, podświetlenia mebli i cokołów) używają wyłącznie **`mat_light_panel`** (`#fff1d6` bez selektywnego bloomu). Szyby architektoniczne, ścianki działowe i szyb windy używają **`mat_glass_clear`** (`opacity: 0.22`, dwustronny). Zero kolorów zakazanych (`czerwień`, `cyan`, `magenta`).

#### Tabela 1: Modele fasad szklanych, ścianek działowych, działającej windy, komunikacji i oświetlenia — 12 modeli

| Lp. | Model (`.glb`) | Wymiary AABB `X × Y × Z` [m] | Punkt zaczepienia (Origin) | Montaż i kolizja w grze | Opis geometrii, sylwetki i materiałów (`mat_*`) | Budżet tri |
|---:|---|---|---|---|---|---:|
| 1 | `off_facade_mullion` | `4.00 × 4.80 × 0.35` | Środek spodu (`x=0, y=0, z=0`); lico zewnętrzne na `z = -0.15`, wnętrze na `z = +0.20` | `decor` (`WALL_FIXTURES`) + blok kolizji fasady `4.0 × 4.8 × 0.3 m` (`material: "glass_clear"`, `visible: false`) na całym obwodzie zewnętrznym pięter `L0`, `L1`, `L2` | **Moduł zewnętrznej szklanej fasady kurtynowej wieżowca (szer. 4 m × wys. piętra 4.8 m):** dwa pionowe słupki konstrukcyjne (mulliony) i dwa poziome rygle ze szczotkowanego aluminium i grafitu (`mat_metal`, `mat_trim`), dolna kratka konwektora podłogowego (`wys. 0.22 m`, `mat_steel_grating`, listwa `mat_light_panel`), górna maskownica żaluzji (`y = 4.40..4.80 m`, `mat_machine`) oraz dwie wielkie, całkowicie przezroczyste tafle szkła `mat_glass_clear` zapewniające czysty widok na żywe miasto! | ≤ 420 |
| 2 | `off_glass_partition_wall` | `4.00 × 3.60 × 0.18` | Środek spodu (`x=0, y=0, z=0`); długość w `X` | `blok` (`size: 4.0 × 3.6 × 0.18 m`, `instance: true`, również w `WALL_FIXTURES`) — przeszklone ściany sal konferencyjnych `R4`/`R5` i gabinetów `R8`/`R9` | **Wewnętrzna szklana ścianka działowa biura:** dolna i górna szyna zaciskowa (`mat_trim`, `mat_metal`), trzy słupki podziałowe co `1.33 m`, przezroczyste tafle `mat_glass_clear` oraz dwa poziome pasy dekoracyjnego matowego szronienia na wysokości `y = 1.15..1.45 m` (`mat_light_panel`) poprawiające czytelność tafli szkła w walce. | ≤ 320 |
| 3 | `off_glass_partition_door` | `4.00 × 3.60 × 0.24` | Środek spodu (`x=0, y=0, z=0`); otwarte przejście w środku `2.40 × 3.20 m` | `decor` (`WALL_FIXTURES`, `PASSAGE_FIXTURES`) + **2 boczne kolidery tafli stałych** (`0.8 × 3.6 × 0.24 m` na `x = ±1.60 m`, `visible: false`) i nadproża (`4.0 × 0.4 × 0.24 m` na `y = 3.40 m`) | **Portal wewnętrznej ścianki szklanej z rozsuniętymi drzwiami:** boczne skrzydła szklane `mat_glass_clear` z długimi pionowymi pochwytami ze stali (`mat_metal`) rozsunięte na boki, zostawiające pośrodku wolne przejście `2.40 m` (`≥ 2.0 m`) z górnym panelem statusu sali (`mat_neon_green`). | ≤ 460 |
| 4 | `off_elevator_cab` | `3.20 × 3.20 × 3.20` | Środek spodu podłogi kabiny (`x=0, y=0, z=0`); drzwi od `+Z` i `-Z` | Model ruchomej kabiny przypięty do platformy `elevators[0]` (`width: 3.2, depth: 3.2`) | **Przeszklona panoramiczna kabina działającej windy:** stalowo-grafitowa rama nośna (`mat_metal`, `mat_machine`), podłoga z ciemnego granitu z listwą progową (`mat_lacquer`, `mat_neon_amber`), sufit kasetonowy `mat_light_panel`, wschodnia i zachodnia ściana w całości ze szkła `mat_glass_clear` z poręczą, otwory drzwiowe od `+Z` (dla `L0`/`L1`) i `-Z` (dla `L2`), a na słupku wewnętrznym **panel sterowania z ekranem piętra `60 / 61 / 62` (`mat_screen_status`) i przyciskami GÓRA `▲` (`mat_neon_green`) oraz DÓŁ `▼` (`mat_neon_amber`)**. | ≤ 920 |
| 5 | `off_elevator_shaft_door` | `3.60 × 3.40 × 0.35` | Środek spodu progu (`x=0, y=0, z=0`); światło wejścia w środku `2.20 × 2.80 m` | `decor` (`WALL_FIXTURES`, `PASSAGE_FIXTURES`) na 3 przystankach szybu windy (`y = 0.0, 4.8, 9.6 m`) + boczne kolidery ościeży poza światłem drzwi | **Portal drzwi szybowych windy panoramicznej:** fazowana ościeżnica ze szczotkowanej stali i ciemnego kamienia (`mat_metal`, `mat_trim`), przeszklone skrzydła drzwi szybowych (`mat_glass_clear`), górny wyświetlacz LED wskazujący bieżące piętro kabiny i strzałki kierunku (`mat_neon_amber`, `mat_neon_green`). | ≤ 540 |
| 6 | `off_elevator_call_panel` | `0.45 × 1.45 × 0.22` | Środek spodu cokołu (`x=0, y=0, z=0`), front przycisków w `+Z` | `decor` (`WALL_FIXTURES`) — montowany po prawej stronie drzwi szybu na każdym z 3 przystanków (`y = 0.0, 4.8, 9.6 m`) | **Panel przywołania windy z przyciskami GÓRA / DÓŁ:** smukły, pochylony pod kątem ergonomicznym pylon przyścienny ze stali i czarnego szkła (`mat_metal`, `mat_lacquer`), ekranik pozycji windy (`mat_screen_status`) oraz **dwa duże, wyraźnie czytelne z FPP przyciski kierunkowe: górny trójkąt `▲` (`mat_neon_green`) i dolny trójkąt `▼` (`mat_neon_amber`)** z podświetloną ramką `mat_light_panel`. | ≤ 340 |
| 7 | `off_atrium_glass_rail` | `4.00 × 1.10 × 0.14` | Środek spodu (`x=0, y=0, z=0`); długość w `X` | `blok` (`size: 4.0 × 1.1 × 0.14 m`, `instance: true`) — balustrady galerii Atrium `L1`/`L2` i spoczników schodów | **Szklana balustrada atrium biurowca:** masywny dolny cokół zaciskowy (`wys. 0.16 m`, `mat_metal` + listwa `mat_light_panel`), słupki ze stali szczotkowanej, przezroczyste tafle szkła `mat_glass_clear` oraz profilowana poręcz górna z ciemnego orzecha (`mat_wood`, `mat_trim`). | ≤ 260 |
| 8 | `off_reception_desk` | `4.80 × 1.20 × 1.60` | Środek spodu (`x=0, y=0, z=0`), front dla gości w `+Z` | `blok` (`size: 4.8 × 1.2 × 1.6 m`, `instance: true`, twarda osłona w Lobby `R1` i Foyer Zarządu `R9`) | **Monumentalna lada recepcyjna z logo Kurogane Arms:** bryła z czarnego kamienia i pionowych lameli drewnianych (`mat_lacquer`, `mat_wood`, `mat_metal`), na froncie wpuszczony podświetlany kaseton z geometrycznym **emblematem i napisem KUROGANE ARMS** (`mat_neon_amber`, `mat_light_panel`), od strony wewnętrznej blat roboczy z 3 monitorami (`mat_screen_status`), telefonami i czytnikiem przepustek. | ≤ 880 |
| 9 | `off_security_turnstile` | `3.20 × 1.15 × 1.40` | Środek spodu (`x=0, y=0, z=0`); wolne przejście środkiem `2.20 m` wzdłuż osi `Z` | `decor` (`PASSAGE_FIXTURES`) + 2 boczne kolidery bramek (`0.45 × 1.15 × 1.40 m` na `x = ±1.35 m`, `visible: false`) | **Bramki optyczne kontroli dostępu VIP w Lobby `R1`:** zaokrąglone postumenty ze stali nierdzewnej i czarnego szkła (`mat_metal`, `mat_lacquer`), otwarte skrzydełka z przezroczystego szkła `mat_glass_clear`, czytniki zbliżeniowe z zielonymi piktogramami przejścia (`mat_neon_green`). | ≤ 580 |
| 10 | `off_ceiling_light_panel` | `2.40 × 0.30 × 1.20` | Środek spodu oprawy (`x=0, y=0, z=0`); wieszaki sięgają `y = +0.30 m` | `decor` (`CEILING_FIXTURES`, montowany `0.30 m` poniżej stropu w `R1..R3` i `R6..R9`) | **Biurowy kaseton oświetleniowy LED:** cienka grafitowa rama aluminiowa (`mat_trim`), rastrowe podziały przeciwodblaskowe (`mat_metal`) i jednolity dyfuzor w materiale **`mat_light_panel`** (ciepła biel bez selektywnego bloomu i bez smug!). | ≤ 240 |
| 11 | `off_linear_baffle_light` | `3.60 × 0.35 × 0.80` | Środek spodu (`x=0, y=0, z=0`); uchwyty do `y = +0.35 m` | `decor` (`CEILING_FIXTURES`, montowany `0.35 m` pod stropem w `R4`, `R5`, `R10` i nad galeriami `A0`) | **Reprezentacyjna oprawa lamelowa sal konferencyjnych i zarządu:** szereg 8 drewnianych lameli akustycznych (`mat_wood`) przełożonych trzema liniowymi dyfuzorami **`mat_light_panel`** oraz bocznym akcentem `mat_neon_amber`. | ≤ 360 |
| 12 | `off_acoustic_wall_panel` | `2.40 × 2.40 × 0.14` | Środek spodu (`x=0, y=0, z=0`), tył na `z = 0`, wystaje w `+Z` | `decor` (`WALL_FIXTURES`, montowany na ścianach działowych w `R2`, `R4`, `R5`, `R10`) | **Ścienny panel akustyczny z lamelami i heksagonami:** kompozycja dźwiękochłonnych kasetonów z ciemnego filcu (`mat_fabric`), orzechowych lameli (`mat_wood`) i ukośnej listwy świetlnej (`mat_light_panel` / `mat_neon_amber`). | ≤ 420 |

#### Tabela 2: Modele wyposażenia openspace'u (`R2`, `R3`), sal konferencyjnych (`R4`, `R5`), kuchni (`R6`), serwerowni/drukarni (`R7`) i gabinetów (`R8`–`R10`) — 13 modeli

| Lp. | Model (`.glb`) | Wymiary AABB `X × Y × Z` [m] | Punkt zaczepienia (Origin) | Montaż i kolizja w grze | Opis geometrii, sylwetki i materiałów (`mat_*`) | Budżet tri |
|---:|---|---|---|---|---|---:|
| 13 | `off_desk_pod` | `3.60 × 1.35 × 1.80` | Środek spodu (`x=0, y=0, z=0`) | `blok` (`size: 3.6 × 1.35 × 1.8 m`, `instance: true`, główna powtarzalna osłona w `R2` i `R3`) | **Czteroosobowa wyspa biurek openspace z monitorami:** stalowy stelaż (`mat_metal`, `mat_trim`), 4 blaty robocze na `y = 0.76 m` (`mat_wood`, `mat_lacquer`), środkowa ścianka akustyczna (`y = 0.76..1.35 m`, `mat_fabric` z listwą `mat_light_panel`), 8 płaskich monitorów na ramionach (`mat_screen_status`, `mat_screen_office_analytics`), klawiatury, stacje dokujące, lampki biurkowe i kubki z kawą (`mat_label_office_mug`). | ≤ 1180 |
| 14 | `off_executive_desk` | `2.60 × 1.15 × 1.20` | Środek spodu (`x=0, y=0, z=0`), fotel od `-Z`, front w `+Z` | `blok` (`size: 2.6 × 1.15 × 1.2 m`, `instance: true`, osłona w gabinetach `R8`, `R9` i `R10`) | **Masywne biurko dyrektorskie / prezesowskie:** pełny, geometrycznie fazowany korpus z ciemnego orzecha i czarnego lakieru (`mat_wood`, `mat_lacquer`, mosiężno-bursztynowa listwa `mat_neon_amber`), zakrzywiony ultrapanoramiczny monitor (`mat_screen_office_analytics`), terminal komunikacyjny, lampa gabinetowa `mat_light_panel` i teczka z dokumentami. | ≤ 760 |
| 15 | `off_office_chair` | `0.70 × 1.05 × 0.70` | Środek podstawy kółek (`x=0, y=0, z=0`), przód siedziska w `+Z` | `blok` (`size: 0.7 × 1.05 × 0.7 m`, `instance: true`) — przy biurkach openspace'u, stołach konferencyjnych i w gabinetach | **Ergonomiczny fotel biurowy Kurogane:** pięcioramienna baza na kółkach (`mat_metal`, `mat_rubber`), siłownik, profilowane siedzisko i wysokie oparcie z zagłówkiem (`mat_fabric`, `mat_lacquer`) oraz podłokietniki. | ≤ 520 |
| 16 | `off_conference_table` | `5.60 × 1.05 × 2.00` | Środek spodu (`x=0, y=0, z=0`); długość w `X` (`5.6 m`) | `blok` (`size: 5.6 × 1.05 × 2.0 m`, `instance: true`, centralna osłona w `R4`, `R5` i `R10`) | **Wielki stół sali konferencyjnej i zarządu:** dwie masywne kolumny cokołowe (`mat_machine`, `mat_metal` — pełna osłona przed pociskami pod blatem!), gruby fazowany blat z ciemnego drewna i szkła (`mat_wood`, `mat_lacquer`), pośrodku blatu wpuszczony podświetlany pas projekcji taktycznej (`mat_screen_map`, obrys `mat_light_panel` / `mat_neon_amber`), 6 mikrofonów konferencyjnych, otwarte laptopy i karafki z wodą. | ≤ 960 |
| 17 | `off_conf_screen_wall` | `4.20 × 2.40 × 0.22` | Środek spodu (`x=0, y=0, z=0`), tył na `z = 0`, wystaje w `+Z` | `decor` (`WALL_FIXTURES`, montowany na ścianach `R3`, `R4`, `R5`, `R10` na `y = levelY + 0.90 m`) | **Wielkoformatowy ekran prezentacyjny sali konferencyjnej:** bezszwowa ściana wideo w ramie ze szczotkowanego aluminium (`mat_metal`, `mat_trim`), centralny ekran analityczno-strategiczny (`mat_screen_office_analytics`) flankowany dwoma pionowymi panelami telemetrii (`mat_screen_status`), dolna półka na wskaźnik laserowy i tylna poświata `mat_light_panel`. | ≤ 380 |
| 18 | `off_whiteboard_wall` | `2.40 × 1.50 × 0.14` | Środek spodu (`x=0, y=0, z=0`), tył na `z = 0`, wystaje w `+Z` | `decor` (`WALL_FIXTURES`, montowany na ścianach w `R2`, `R4`, `R5`, `R8`, `R9` na `y = levelY + 1.05 m`) | **Biurowa tablica szklana / whiteboard z wykresami:** aluminiowa rama z dolnym korytkiem na markery i gąbkę (`mat_metal`), jasna tafla tablicy (`mat_light_panel`) z narysowanymi schematami organizacyjnymi i przyklejonymi karteczkami kanban w kolorach bursztynu (`mat_hivis`), zieleni (`mat_neon_green`) i błękitu (`mat_neon_blue`) — zero czerwieni! | ≤ 440 |
| 19 | `off_filing_cabinet` | `1.80 × 2.10 × 0.75` | Środek spodu (`x=0, y=0, z=0`), front w `+Z` | `blok` (`size: 1.8 × 2.1 × 0.75 m`, `instance: true`, wysoka osłona przy ścianach i filarach) | **Korporacyjna szafa na akta i segregatory:** dwudzielny korpus (`mat_lacquer`, `mat_trim`), dolne szuflady kartotekowe z uchwytami `mat_metal`, górna witryna za szkłem `mat_glass_clear` wypełniona rzędami segregatorów z grzbietami w barwach grafitu, bursztynu (`mat_hivis`) i błękitu (`mat_plastic`). | ≤ 580 |
| 20 | `off_kitchenette_counter` | `3.60 × 2.20 × 0.90` | Środek spodu (`x=0, y=0, z=0`), front w `+Z` | `blok` (`size: 3.6 × 2.2 × 0.9 m`, `instance: true`) — Kuchnia `R6` | **Zabudowa aneksu kuchennego biura:** dolne szafki (`mat_lacquer`, `mat_wood`), kamienny blat ze stalowym zlewem i baterią (`mat_metal`), wbudowana podblatowa chłodziarka z przeszklonymi drzwiami (`mat_glass_clear`, `mat_neon_blue`), szafki górne z podświetleniem blatu `mat_light_panel`, kuchenka mikrofalowa i stojak na kubki. | ≤ 860 |
| 21 | `off_coffee_machine` | `1.40 × 1.55 × 0.85` | Środek spodu (`x=0, y=0, z=0`), front w `+Z` | `blok` (`size: 1.4 × 1.55 × 0.85 m`, `instance: true`) — Kuchnia `R6`, Openspace `R2` i Foyer `R9` | **Wyspowy bar kawowy z ekspresem ciśnieniowym:** szafka z podajnikiem kubków i koszem (`mat_lacquer`, `mat_wood`), profesjonalny ekspres ze stali chromowanej (`mat_metal`) z ekranem dotykowym (`mat_screen_menu`), bursztynowym podświetleniem dysz (`mat_neon_amber`), tacą ociekową i dystrybutorem filtrowanej wody (`mat_neon_blue`). | ≤ 680 |
| 22 | `off_lounge_sofa` | `2.60 × 0.95 × 1.05` | Środek spodu (`x=0, y=0, z=0`), przód siedziska w `+Z` | `blok` (`size: 2.6 × 0.95 × 1.05 m`, `instance: true`, niska/średnia osłona w `R1`, `R3`, `R5`, `R6`, `R8..R10`) | **Trzyosobowa sofa korporacyjna Neon Noir:** niska rama ze szczotkowanej stali i orzecha (`mat_metal`, `mat_wood`), głębokie siedzisko i pikowane oparcie w ciemnym fioletowo-granatowym suknie (`mat_fabric` `#3b3554` / `mat_lacquer`). Wysokość `0.95 m` daje osłonę w kucnięciu i pozwala przeskoczyć w biegu. | ≤ 540 |
| 23 | `off_office_planter` | `2.40 × 1.45 × 0.90` | Środek spodu (`x=0, y=0, z=0`); długość w `X` | `blok` (`size: 2.4 × 1.45 × 0.9 m`, `instance: true`, osłona dzieląca strefy w `R1`, `R2`, `R3`, `A0`, `R6`, `R10`) | **Wysoka donica biurowa z roślinnością:** grafitowo-drewniana skrzynia donicy (`wys. 0.85 m`, `mat_lacquer`, `mat_wood`, dolny pasek `mat_light_panel`), białe otoczaki i gęste, geometrycznie stylizowane liście roślin doniczkowych oraz pędów bambusa (`mat_paint` `#3e5a48` do `y = 1.45 m`). | ≤ 680 |
| 24 | `off_office_printer` | `1.60 × 1.30 × 0.85` | Środek spodu (`x=0, y=0, z=0`), panel od `+Z` | `blok` (`size: 1.6 × 1.3 × 0.85 m`, `instance: true`) — Drukarnia `R7`, Openspace `R2` i Foyer `R9` | **Korporacyjna kserokopiarka i drukarka sieciowa:** czterokasetowy korpus (`mat_plastic`, `mat_lacquer`, `mat_trim`), boczny finiszer z tacą pełną wydruków (`mat_light_panel`), górny podajnik ADF z zieloną szczeliną światła skanera (`mat_neon_green`) i odchylany ekran `mat_screen_status`. | ≤ 640 |
| 25 | `off_office_server_rack` | `1.20 × 2.30 × 1.00` | Środek spodu (`x=0, y=0, z=0`), front drzwi w `+Z` | `blok` (`size: 1.2 × 2.3 × 1.0 m`, `instance: true`) — Serwerownia Biurowa `R7` | **Wyciszona biurowa szafa serwerowa i patch-panel:** grafitowa obudowa (`mat_lacquer`, `mat_metal`), przeszklone drzwi `mat_glass_clear`, wewnątrz przełączniki światłowodowe z rzędami zielonych i błękitnych diod (`mat_neon_green`, `mat_neon_blue`), ekran diagnostyczny `mat_screen_status` i pionowe wiązki przewodów (`mat_cable`). | ≤ 740 |

### 4.2. Lista nowych tekstur (szyldy korporacyjne, ekrany, notatki/decale, etykiety i powierzchnie)

Wszystkie nowe tekstury są tworzone po polsku i przechodzą automatyczną walidację palety HSV (zero pikseli w paśmie czerwieni `358.4° ± 13°`, cyanu `186.1° ± 13°` i magenty `311.6° ± 13°` przy `S >= 0.55, V >= 0.5`):

| Kategoria / Folder | Identyfikator tekstury | Rozmiar i format | Treść, kolorystyka i zastosowanie na mapie `run4` |
|---|---|---|---|
| **Szyldy neonowe (`public/assets/textures/signs/`)** | `off_kurogane_hq` | RGB `512×256` `.webp` | **`KUROGANE ARMS // CENTRALA SEKTORA`** — złoto-bursztynowy (`#ffae1a`) i ciepłobiały (`#fff1d6`) logotyp korporacji nad recepcją w `R1`, w Atrium `A0` i w Gabinecie Zarządu `R10`. |
| `signs/` | `off_floor_60` | RGB `512×256` `.webp` | **`PIĘTRO 60 // RECEPCJA & DYIWIJA KONTRAKTÓW`** — błękitno-biały (`#3d7bff` / `#fff1d6`) szyld kondygnacji `L0` przy szybie windy i klatkach schodowych. |
| `signs/` | `off_floor_61` | RGB `512×256` `.webp` | **`PIĘTRO 61 // CENTRUM KONFERENCYJNE & WĘZEŁ IT`** — bursztynowo-biały szyld kondygnacji `L1` przy szybie windy i galeriach atrium. |
| `signs/` | `off_floor_62` | RGB `512×256` `.webp` | **`PIĘTRO 62 // ZARZĄD KORPORACJI & GABINETY`** — fioletowo-złoty (`#8a5cff` / `#ffae1a`) szyld kondygnacji `L2` w Foyer Zarządu `R9`. |
| `signs/` | `off_conf_aegis` | RGB `512×256` `.webp` | **`SALA KONFERENCYJNA „AEGIS” // OBRONA & SYSTEMY`** — błękitny szyld nad przeszklonym wejściem do `R4`. |
| `signs/` | `off_conf_vanguard` | RGB `512×256` `.webp` | **`SALA KONFERENCYJNA „VANGUARD” // STRATEGIA`** — fioletowo-bursztynowy szyld nad przeszklonym wejściem do `R5`. |
| `signs/` | `off_sky_lounge` | RGB `512×256` `.webp` | **`STREFA SOCJALNA // SKY LOUNGE 61`** — zielono-ciepłobiały (`#6dff4a` / `#fff1d6`) neon nad wejściem do Kuchni `R6`. |
| `signs/` | `off_it_repro` | RGB `512×256` `.webp` | **`SERWEROWNIA & REPROGRAFIA // DOSTĘP IT`** — błękitno-zielony szyld nad wejściem do `R7`. |
| `signs/` | `off_boardroom` | RGB `512×256` `.webp` | **`GABINET ZARZĄDU // TYLKO CZŁONKOWIE RADY`** — bursztynowo-biały szyld nad głównym portalem do `R10`. |
| `signs/` | `off_elevator_sign` | RGB `512×256` `.webp` | **`WINDA PANORAMICZNA // PIĘTRA 60–62 (▲/▼)`** — bursztynowo-zielony szyld nad szybem windy w Atrium `A0` na wszystkich trzech poziomach. |
| **Decale i humor korporacyjny (`public/assets/textures/decals/`)** | `off_kurogane_floor_crest` | RGBA `512×512` `.webp` | Duży, wpuszczony w granitową posadzkę mosiężno-bursztynowy herb i monogram **`KUROGANE ARMS // EST. 2048`** na środku Lobby `R1`, Atrium `A0` i Gabinetu Zarządu `R10`. |
| `decals/` | `off_elevator_floor_zone` | RGBA `512×256` `.webp` | Oznaczenie progu przed drzwiami szybu windy na `L0`, `L1`, `L2`: **`STREFA WINDY // KLIKNIJ PANEL ▲ GÓRA / ▼ DÓŁ`** w bursztynie i zieleni. |
| `decals/` | `off_scattered_contracts` | RGBA `512×512` `.webp` | Rozrzucone wydruki arkuszy kalkulacyjnych i umów z pieczęcią **`POUFNE // KONTRAKT ZBROJENIOWY`** przy drukarkach w `R7` i biurkach w `R2`. |
| `decals/` | `off_kpi_poster` | RGBA `512×768` `.webp` | Plakat motywacyjny HR w `R2` i `R6`: **`TWÓJ NADGODZINOWY UŚMIECH BUDUJE ZYSK AKCJONARIUSZY (+12% KWARTALNIE)`** w estetyce korporacyjnego retro-futuryzmu (bursztyn/błękit/ciepła biel). |
| `decals/` | `off_printer_error_note` | RGBA `512×512` `.webp` | Kartka przyklejona na drukarce w `R7`: **`DRUKARKA NR 4 ZACINA PAPIER PRZY DRUKU RAPORTÓW Z SEKTORA X-51 — NIE KOPAĆ!`** |
| `decals/` | `off_coffee_rules` | RGBA `512×512` `.webp` | Tabliczka nad ekspresem w Kuchni `R6`: **`KTO WYPuszcza OSTATNIE ESPRESSO, TEN ZAMAWIA NOWY WKŁAD SYNT-KOFEINY`**. |
| `decals/` | `off_glass_frost_stripe` | RGBA `512×256` `.webp` | Poziomy pas ostrzegawczy na szybach fasadowych i działowych z logo Kurogane, zapobiegający wbieganiu w taflę szkła. |
| `decals/` | `off_rain_streaks_glass` | RGBA `512×512` `.webp` | Subtelne krople i pionowe strużki deszczu oświetlone neonami miasta, nakładane po zewnętrznej stronie wybranych tafli szklanej fasady. |
| **Ekrany i etykiety UV (`screens/`, `labels/`)** | `screen_office_analytics` | RGB `512×512` `.webp` | Ekran korporacyjny i giełdowy: wykresy kontraktów Kurogane Arms, mapa wieżowców sektora i zielono-bursztynowe indeksy giełdowe **`KRGN +18.4% // SEKTOR WYSOKI`**. |
| `screens/` | `screen_elevator_panel` | RGB `256×512` `.webp` | Interfejs panelu windy: wskaźnik piętra **`60 / 61 / 62`**, zielona strzałka **`▲ GÓRA`** i bursztynowa **`▼ DÓŁ`**. |
| `labels/` | `label_office_mug` | RGBA `256×256` `.webp` | Nadruk UV na kubkach w `off_desk_pod` i `off_coffee_machine`: **`PRACOWNIK MIESIĄCA // DZIAŁ LIKWIDACJI RYZYKA`**. |
| **Powierzchnie (`surfaces/` + `komiks/surfaces/`)** | `off_carpet_tile`, `off_polished_granite`, `off_wood_slat_wall` | RGB `1024×1024` `.webp` (×6 z wersjami komiksowymi) | 3 tekstury kafelkowalne opisane w **F-04** (`§2.1.B`). |

### 4.3. Zasoby istniejące do ponownego użycia oraz zasoby zakazane na mapie `run4`

#### A. Dozwolone istniejące modele i materiały (spójne z wieżowcem korporacyjnym Kurogane Arms)
- **Z zestawów `mall_*`, `lab_*`, `wh_*`, `city_*`:**
  - `mall_kurogane_display` (`3.4 × 2.5 × 0.95 m`) — pancerne gabloty z makietami uzbrojenia i zegarkami korporacyjnymi w Korytarzu Panoramowym `R3` i Gabinecie Zarządu `R10`,
  - `mall_security_fixture` (`0.9 × 1.3 × 0.35 m`, `WALL_FIXTURES`) — szafki BHP, przyciski alarmowe i kamery CCTV na filarach atrium i korytarzy (bursztynowo-grafitowe, zero czerwieni),
  - `mall_directory` (`1.2 × 2.4 × 0.45 m`) — wolnostojący totem informacyjny planu pięter `60–62` w Atrium `A0`,
  - `mall_trash_bin` (`1.36 × 0.94 × 0.606 m`) — nowoczesne pojemniki do segregacji papieru w openspace `R2` i kuchni `R6`,
  - `lab_classified_cabinet` (`1.6 × 2.2 × 0.85 m`) — pancerne sejfy na tajne kontrakty w Gabinecie Zarządu `R10` i Drukarni `R7`,
  - `lab_prototype_weapon_rack` (`2.4 × 2.2 × 0.8 m`) — ekskluzywna gablota z prototypami Kurogane w Gabinecie Zarządu `R10`,
  - `wh_wall_terminal` (`1.42 × 0.93 × 0.2105 m`, `WALL_FIXTURES`) — terminale kontroli dostępu przy salach konferencyjnych i serwerowni,
  - `city_vending` (`1.014 × 2.0 × 0.816 m`) — automaty z napojami w strefie socjalnej `R6`,
  - `city_ad_screen` (`1.1 × 2.294 × 0.182 m`, `WALL_FIXTURES`) — pionowe ekrany informacyjne w Lobby `R1` i Korytarzu Panoramowym `R3`,
  - `city_ac_unit` (`0.907 × 0.604 × 0.518 m`, `WALL_FIXTURES`) i `city_vent_grate` (`1.0 × 0.05 × 1.0 m`) — wyłącznie w Serwerowni Biurowej `R7`,
  - `city_door` (`1.505 × 2.465 × 0.238 m`, `WALL_FIXTURES`) — drzwi bocznych szachtów instalacyjnych i toalet,
  - `crate` (`1.0 × 1.0 × 1.0 m`, zniszczalna) oraz `crate_small` (`0.5 × 0.5 × 0.5 m`, dynamiczna do Chwytu Rezonansem).
- **Istniejące materiały powierzchniowe:** `glass_clear`, `light_panel`, `mall_stone_floor`, `mall_terrazzo_inlay`, `mall_acoustic_ceiling`, `lab_cleanroom_wall`, `tread_plate`, `steel_grating`, `lacquer`, `metal`, `trim`, `wood`, `fabric`.

#### B. Zasoby ZAKAZANE w `run4` (ochrona spójności stylistycznej i eliminacja smug światła)
1. **Zakaz modeli laboratoryjno-biologicznych z `run3`:** zakaz `lab_cocoon_*`, `lab_ceiling_manifold`, `lab_chem_fume_hood`, `lab_centrifuge_bench`, `lab_decon_shower`, `lab_hazmat_suit_rack`, `lab_freight_elevator` (w biurowcu działa przeszklona winda osobowa `off_elevator_cab`, nie surowa winda towarowa!).
2. **Zakaz modeli sklepowo-odzieżowych z `run2`:** zakaz `mall_mannequin`, `mall_shoe_wall`, `mall_clothes_rack*`, `mall_shutter_grille`, `mall_storefront`, `mall_fountain`, `mall_showcar`, `mall_escalator`.
3. **Zakaz modeli przemysłowych, ulicznych, portowych i budowlanych:** zakaz `wh_pallet_rack`, `wh_forklift`, `wh_overhead_crane`, `port_container_*`, `city_car`, `city_wrecked_car`, `city_dumpster`, `city_trash_bags`, `city_stall`, `build_*`, `power_*`, `dock_*`, `hw_*`.
4. **Zakaz modeli generujących automatyczne stożki wolumetryczne:** bezwzględny zakaz `city_street_lamp` oraz `city_lantern_string` (`src/render/city/lamps.ts`).

---

## 5. Konfiguracja walki, spawny, hazardy, oświetlenie i plan generatora `run4.mjs`

### 5.1. Blok `arena`, dyrektor walki i 18 punktów spawnu wrogów (`spawnPoints` na 3 piętrach)

Pokój `run4.json` ma `"type": "combat"`, `"panoramaDropM": 180` oraz blok `arena`:
- `"navigationCellM": 0.5`, `"navigationClearanceM": 0.4`, `"navigationMaxRiseM": 0.55`, `"navigationHeadroomM": 2.2`, `"batchCellM": 24`,
- `"spawnRing": { "minM": 10, "maxM": 28 }`, `"maxAlive": 10`, `"minSpawnDistance": 10`,
- Punkty kontrolne wymagane przez `capturePointsSchema`: `A: (0, 0.0, 2.0)` (Parter Atrium `A0` na Piętrze 60), `B: (0, 4.8, -10.0)` (Mostek Galerii Atrium przed windą na Piętrze 61), `C: (0, 9.6, -35.0)` (Gabinet Zarządu `R10` na Piętrze 62).

**Tabela 18 punktów spawnu wrogów (`spawnPoints`) — rozłożonych równomiernie na Piętrze 60 (`y = 0.0 m`), Piętrze 61 (`y = 4.8 m`) i Piętrze 62 (`y = 9.6 m`):**

| Nr | Współrzędne `{ x, y, z }` | Kondygnacja | Pomieszczenie | Rola taktyczna w starciu (schody + winda) |
|---:|---|---|---|---|
| **1** | `{ "x": -15, "y": 0.0, "z": 21 }` | **Piętro 60** (`0.0 m`) | **R2** (Openspace — południe) | Strażnik za wyspami biurek flankujący gracza z zachodu po wejściu do Lobby `R1` |
| **2** | `{ "x": -25, "y": 0.0, "z": 14 }` | **Piętro 60** (`0.0 m`) | **R2** (Openspace — przy fasadzie W) | Strzelec na długiej linii wzroku wzdłuż zachodniej szklanej fasady |
| **3** | `{ "x": -18, "y": 0.0, "z": 1 }` | **Piętro 60** (`0.0 m`) | **R2** (Openspace — północ) | Szturmowiec nacierający z północnego końca openspace'u ku schodom Atrium |
| **4** | `{ "x": 16, "y": 0.0, "z": 21 }` | **Piętro 60** (`0.0 m`) | **R3** (Korytarz Panoramowy — południe) | Flanka wschodnia za boksami analityków przy wyjściu z Lobby `R1` |
| **5** | `{ "x": 25, "y": 0.0, "z": 7 }` | **Piętro 60** (`0.0 m`) | **R3** (Korytarz Panoramowy — przy oknie E) | Strzelec przy wschodnim oknie panoramicznym obok bramki laserowej |
| **6** | `{ "x": -4, "y": 0.0, "z": -6 }` | **Piętro 60** (`0.0 m`) | **A0** (Atrium — przed szybem windy L0) | Odwód centralny przy przystanku #0 windy — może bronić parteru lub wjechać windą na `L1`/`L2`! |
| **7** | `{ "x": 4, "y": 0.0, "z": -6 }` | **Piętro 60** (`0.0 m`) | **A0** (Atrium — prawa strona szybu windy) | Drugi strażnik parteru Atrium kontrolujący podejście do panelu wezwania windy |
| **8** | `{ "x": -18, "y": 4.8, "z": 4 }` | **Piętro 61** (`4.8 m`) | **R4** (Sala Konferencyjna „Aegis” — S) | Strzelec za stołem konferencyjnym ostrzeliwujący przez szklaną ścianę dół Atrium |
| **9** | `{ "x": -24, "y": 4.8, "z": -8 }` | **Piętro 61** (`4.8 m`) | **R4** (Sala Konferencyjna „Aegis” — N) | Szturmowiec przy ścianie wideo w `R4` |
| **10** | `{ "x": 18, "y": 4.8, "z": 4 }` | **Piętro 61** (`4.8 m`) | **R5** (Sala Konferencyjna „Vanguard” — S) | Strzelec za stołem taktycznym po wschodniej stronie Atrium |
| **11** | `{ "x": 24, "y": 4.8, "z": -8 }` | **Piętro 61** (`4.8 m`) | **R5** (Sala Konferencyjna „Vanguard” — N) | Tarczownik blokujący przejście z sali konferencyjnej do Serwerowni `R7` |
| **12** | `{ "x": -20, "y": 4.8, "z": -18 }` | **Piętro 61** (`4.8 m`) | **R6** (Kuchnia i Strefa Socjalna) | Flanka wybiegająca zza baru kawowego na Mostek Windy `L1` |
| **13** | `{ "x": 16, "y": 4.8, "z": -18 }` | **Piętro 61** (`4.8 m`) | **R7** (Serwerownia Biurowa i Drukarnia) | Strażnik przy drukarkach, poza marginesem `1 m` od pola `office-ups-overload` |
| **14** | `{ "x": -16, "y": 9.6, "z": -22 }` | **Piętro 62** (`9.6 m`) | **R8** (Szklane Gabinety Kierownictwa W) | Ochrona wyższego szczebla za biurkiem dyrektorskim w zachodnim skrzydle `L2` |
| **15** | `{ "x": 0, "y": 9.6, "z": -20 }` | **Piętro 62** (`9.6 m`) | **R9** (Foyer Zarządu przed windą L2) | Odwód przed przystankiem #2 windy — może zjechać windą w dół po gracza lub bronić wejścia do `R10`! |
| **16** | `{ "x": 16, "y": 9.6, "z": -22 }` | **Piętro 62** (`9.6 m`) | **R9** (Szklane Gabinety Kierownictwa E) | Strzelec w przeszklonym gabinecie wschodnim `L2` |
| **17** | `{ "x": -12, "y": 9.6, "z": -35 }` | **Piętro 62** (`9.6 m`) | **R10** (Gabinet Zarządu — zachód) | Elitarna ochrona przy biurku prezesa i stole posiedzeń Zarządu |
| **18** | `{ "x": 6, "y": 9.6, "z": -38 }` | **Piętro 62** (`9.6 m`) | **R10** (Gabinet Zarządu — przed `exit`) | Ostatnia linia obrony przed północną śluzą ewakuacyjną `exit` na 62. piętrze |

### 5.2. Zestawienie zagrożeń środowiskowych (`hazards[]` — 4 hazardy na 3 kondygnacjach)

| Nr | `kind` i `id` | Kondygnacja i pomieszczenie | Położenie i parametry | Zastosowanie w walce (Ostrze / Rezonans / Strzelec) |
|---:|---|---|---|---|
| **1** | `laser_gate`<br>`id: "panorama-security-laser"` | **Piętro 60 (`y = 0.0 m`)**<br>`R3` Korytarz Panoramowy | `from: (15.0, 0.85, 14.0)`, `to: (22.0, 0.85, 14.0)`, `cycle: { onS: 2.6, offS: 1.8 }` | Wiązka alarmowa przy gablotach Kurogane; pchnięcie wrogów na laser lub ślizg w oknie `offS`. |
| **2** | `electric_field`<br>`id: "office-ups-overload"` | **Piętro 61 (`y = 4.8 m`)**<br>`R7` Serwerownia Biurowa | `position: (23.5, 5.8, -18.0)`, `size: (2.8, 2.0, 3.0)`, `cycle: { onS: 3.0, offS: 2.2 }` | Przeciążona sekcja zasilania UPS między szafami serwerowymi (`spód na y = 4.80 m`); idealna pułapka na Pchnięcie Rezonansu. |
| **3** | `explosive_barrel`<br>`id: "toner-coolant-cylinder"` | **Piętro 61 (`y = 4.8 m`)**<br>`R7` Serwerownia i Drukarnia | `position: (27.5, 4.8, -14.0)` | Zbiornik ciśnieniowy gazu gaśniczego halonu przy szafach serwerowych. |
| **4** | `laser_gate`<br>`id: "boardroom-vault-laser"` | **Piętro 62 (`y = 9.6 m`)**<br>`R10` Gabinet Zarządu | `from: (16.5, 10.45, -39.0)`, `to: (16.5, 10.45, -32.0)`, `cycle: { onS: 2.4, offS: 1.8 }` | Bramka laserowa zabezpieczająca wschodnią strefę sejfu w Gabinecie Zarządu (`wys. 0.85 m` nad posadzką `y = 9.60 m`). |

### 5.3. Oświetlenie bez smug wolumetrycznych i budżet `CityLights`

Zgodnie z limitem `CityLights` (`8` aktywnych `PointLight` na `high`, `4` na `medium`) oraz zasadą z `run3`:
1. **100% opraw sufitowych (`off_ceiling_light_panel` i `off_linear_baffle_light`) używa materiału `mat_light_panel`** (`#fff1d6`, `flat: true`), dzięki czemu sufit każdego z 10 pomieszczeń wygląda realistycznie i jasno z każdego piętra bez generowania pionowych smug bloomu.
2. **Rozmieszczenie 24 źródeł `lights[]` (`0` z `cone: true`, każde z jawnym `floorY` odpowiadającym kondygnacji `0.0`, `4.8` lub `9.6 m`):**
   - **Piętro 60 (`L0`, 9 źródeł, `floorY: 0.0`):**
     - `R1 Lobby Główne (2)`: nad bramką VIP `(0, 4.35, +21.0, "#fff1d6", intensity: 28, range: 13)` oraz nad ladami recepcji `(0, 4.35, +13.5, "#ffae1a", intensity: 26, range: 13)`.
     - `R2 Openspace (3)`: `(-20, 4.35, +23.0, "#fff1d6", intensity: 26, range: 13)`, `(-20, 4.35, +13.0, "#3d7bff", intensity: 26, range: 13)`, `(-20, 4.35, +3.0, "#fff1d6", intensity: 24, range: 12)`.
     - `R3 Korytarz Panoramowy (2)`: `(+20, 4.35, +21.0, "#fff1d6", intensity: 26, range: 13)`, `(+20, 4.35, +7.0, "#3d7bff", intensity: 26, range: 13)`.
     - `A0 Atrium Parter (2)`: nad wyspą centralną `(0, 5.5, +1.0, "#fff1d6", intensity: 30, range: 15)` oraz przed szybem windy `(0, 4.2, -10.5, "#ffae1a", intensity: 26, range: 12)`.
   - **Piętro 61 (`L1`, 9 źródeł, `floorY: 4.8`):**
     - `R4 Sala Konferencyjna „Aegis” (2)`: nad stołem konferencyjnym `(-20, 9.15, -2.0, "#fff1d6", intensity: 28, range: 13)` i przy ścianie wideo `(-20, 8.8, -9.5, "#3d7bff", intensity: 22, range: 11)`.
     - `R5 Sala Konferencyjna „Vanguard” (2)`: nad stołami taktycznymi `(+20, 9.15, -2.0, "#fff1d6", intensity: 28, range: 13)` i przy ekranie `(+20, 8.8, -9.5, "#8a5cff", intensity: 24, range: 11)`.
     - `R6 Kuchnia „Sky Lounge” (2)`: nad barem kawowym `(-18, 9.15, -18.0, "#ffae1a", intensity: 24, range: 11)` i w strefie sof `(-25, 9.15, -18.0, "#6dff4a", intensity: 20, range: 10)`.
     - `R7 Serwerownia i Drukarnia (2)`: nad drukarkami `(+15, 9.15, -18.0, "#fff1d6", intensity: 22, range: 10)` i przy szafach serwerowych `(+24, 8.8, -18.0, "#3d7bff", intensity: 26, range: 11, flicker: { pattern: "buzz", strength: 0.2 })`.
     - `A0 Mostek Windy L1 (1)`: `(0, 9.15, -10.0, "#ffae1a", intensity: 24, range: 12)`.
   - **Piętro 62 (`L2`, 6 źródeł, `floorY: 9.6`):**
     - `R8 Szklane Gabinety W (1)`: `(-16, 13.95, -22.0, "#ffae1a", intensity: 24, range: 11)`.
     - `R9 Foyer Zarządu i Gabinety E (2)`: przed przystankiem windy L2 `(0, 13.95, -20.0, "#fff1d6", intensity: 26, range: 12)` oraz w gabinetach wschodnich `(+16, 13.95, -22.0, "#8a5cff", intensity: 24, range: 11)`.
     - `R10 Gabinet Zarządu (3)`: nad stołem posiedzeń `(0, 14.35, -35.0, "#ffae1a", intensity: 30, range: 15)`, nad biurkiem prezesa `(-16, 14.35, -35.0, "#fff1d6", intensity: 24, range: 12)` oraz zielony portal nad śluzą `exit` `(0, 13.5, -40.8, "#6dff4a", intensity: 32, range: 14)`.

### 5.4. Plan generatora `tools/arenas/run/run4.mjs` i modułów pomocniczych `_run4*.mjs`

Wzorem `run3.mjs` kod generatora zostanie podzielony na 4 czyste, deterministyczne moduły ES w `tools/arenas/run/`:

| Plik | Odpowiedzialność i zawartość |
|---|---|
| `tools/arenas/run/_run4Kit.mjs` | - Stałe rzędnych wysokości: `Y_L0 = 0`, `Y_M01 = 2.4`, `Y_L1 = 4.8`, `Y_M12 = 7.2`, `Y_L2 = 9.6` oraz wysokości stropów `Y_L0_CEIL = 4.8`, `Y_L1_CEIL = 9.6`, `Y_L2_CEIL = 14.4`, `Y_R10_CEIL = 14.8`, `Y_ATRIUM_CEIL = 15.2`;<br>- Słownik prostokątów `ROOMS` (`R1..R10`, `A0`) i materiałów (`MAT_CARPET = 'off_carpet_tile'`, `MAT_GRANITE = 'off_polished_granite'`, `MAT_WOOD_SLAT = 'off_wood_slat_wall'`, `MAT_GLASS = 'glass_clear'`);<br>- Pomocniki konstrukcyjne: `deck()`, `ceilingSlab()` (automatycznie dodaje płytę `ceiling: true` oraz dopasowaną bryłę `rainShelters`), `segmentedWall()`, `glassFacade()` (stawia moduły `off_facade_mullion` co `4.0 m` + kolider `glass_clear`), `glassPartitionWall()`, `glassPartitionDoor()`, `atriumGlassRail()`, `stairFlightWithRails()` oraz `createPlacer()` pilnujący braku kolizji rekwizytów na każdym poziomie wysokości. |
| `tools/arenas/run/_run4Rooms.mjs` | - Funkcje wyposażenia tematycznego dla wszystkich 10 pomieszczeń i Atrium: `buildRoomR1()` (Lobby i Recepcja), `buildRoomR2()` (Openspace), `buildRoomR3()` (Korytarz Panoramowy), `buildAtriumA0()` (Szyb windy, kabina, drzwi szybowe, 3 panele `off_elevator_call_panel`, wyspa parteru), `buildRoomR4()` (Sala Konferencyjna „Aegis”), `buildRoomR5()` (Sala Konferencyjna „Vanguard”), `buildRoomR6()` (Kuchnia „Sky Lounge”), `buildRoomR7()` (Serwerownia i Drukarnia), `buildRoomR8()` (Szklane Gabinety W), `buildRoomR9()` (Foyer Zarządu i Gabinety E), `buildRoomR10()` (Gabinet Zarządu / Penthouse). |
| `tools/arenas/run/_run4Dress.mjs` | - Słownik tekstur `OFFICE_TEXTURES` (`signs`, `decals`), tablica 18 punktów `SPAWNS` na 3 piętrach, rozmieszczenie skrzyń `crate` i `crate_small`, 4 zagrożenia `hazards()`, oznakowanie poziome i korporacyjne easter eggi `decalsAndEasterEggs()`, szyldy neonowe `signage()` (z kotwami do stropów/mullionów) oraz 24 źródła `lights()` bez `cone: true`. |
| `tools/arenas/run/run4.mjs` | - Punkt wejścia generatora: inicjalizuje `createRunRoom({ id: 'run4', name: 'Wieżowiec Korporacyjny Kurogane Arms — Piętra 60–62', weather: 'kuroganeOfficeTower', bounds: R(-30, 30, -43, 31), startX: 0, exitX: 0 })`;<br>- Buduje płyty 3 pięter, stropy `ceiling: true` z `rainShelters`, szklane fasady zewnętrzne 360°, 4 dwubiegowe klatki schodowe (`25.64°`), balustrady `off_atrium_glass_rail`, wpisuje definicję działającej windy `elevators: [{ id: 'atrium-main-lift', ... }]`, `panoramaDropM: 180`, `playerSpawn: (0, 0, 26)` i drzwi `entry` `(0, 1.5, 30.5)` / `exit` `(0, 11.1, -42.5)` oraz zapisuje wynik do `src/data/rooms/run4.json`. |

---

## 6. Kryteria akceptacji i etapy prac (A–E)

### 6.1. Kryteria akceptacji (automatyczne CLI i wizualne na zrzutach audytu)

#### A. Kryteria automatyczne (CLI i testy jednostkowe)
1. **Zero błędów i zero ostrzeżeń w `mapAudit`:**
   - Polecenie `node tools/levels/mapAudit.mjs run4` zwraca wynik: **`run4: 0 error, 0 warn`** (`"run4": 0` w `tests/unit/mapAudit.baseline.json`).
   - Szczegółowo: `0` `noCollisionLargeProp`, `0` `floatingObject`, `0` `outOfBounds`, `0` `overlap`, `0` `forbiddenColor`, `0` `emptyRoom`.
   - `node tools/levels/mapAudit.mjs --all` przechodzi bez regresji na wszystkich mapach.
2. **Testy nawigacji 3D i windy (`tests/unit/run4Navigation.test.ts`):**
   - Test jednostkowy weryfikuje w `ArenaNavigation(room)`:
     1. Pełną osiągalność ścieżki po schodach oraz windą od `playerSpawn (0, 0, 26)` na Piętrze 60 (`L0`) przez Piętro 61 (`L1`, `y = 4.80 m`) do drzwi `exit (0, 9.6, -42.5)` w Gabinecie Zarządu na Piętrze 62 (`L2`, `y = 9.60 m`),
     2. Dojście do wszystkich **18 punktów spawnu** na 3 kondygnacjach (`y = 0.0 m`, `y = 4.8 m`, `y = 9.6 m`),
     3. Dojście do wnętrza wszystkich **10 pomieszczeń (`R1..R10`) i Atrium (`A0`)** oraz do każdego z 3 przystanków windy (`(0, 0, -11.5)`, `(0, 4.8, -10.5)`, `(0, 9.6, -17.0)`),
     4. Poprawną konfigurację `room.elevators[0]` (3 przystanki `y = 0.0, 4.8, 9.6 m`, poprawne `doorSide` i wolne przedpole drzwi szybu na każdym piętrze),
     5. Gęstość osłon: brak pustego kwadratu podłogi bez osłony (`wys. >= 0.8 m`) większego niż `8 × 8 m` w openspace, salach konferencyjnych i gabinecie zarządu.
3. **Pełny zestaw testów projektu (`npm run check`):**
   - `tsc --noEmit`, `eslint` i `vitest` przechodzą bez błędów, w tym `tests/unit/rooms.test.ts`, `tests/unit/roomBlockModelFit.test.ts` (zgodność wymiarów bloków z AABB nowych modeli `off_*.glb` w tolerancji `±5%`), `tests/unit/skyline.test.ts` (testy sąsiednich wieżowców i pasów ruchu na wysokości 60. piętra) oraz test budżetu trójkątów i palety modeli `off_*`.
4. **Deterministyczna generacja i budżet wydajności (draw calls jak w `run3`):**
   - Dwukrotne uruchomienie `node tools/arenas/run/run4.mjs` generuje identyczny plik `src/data/rooms/run4.json` (stały SHA-256).
   - Na profilu `medium` (1920×1080) liczba wywołań rysowania w każdym z 10 widoków audytu (włącznie z włączoną panoramą żywego miasta, sąsiednimi wieżowcami, ruchem pojazdów i przeszklonymi ścianami!) spełnia **`renderInfo.calls <= 800`**.

#### B. Kryteria wizualne na zrzutach audytu (`node tools/screens/mapAudit.mjs run4`) i w spacerze `?scene=map-walk&map=run4`
1. **Czytelność wszystkich 3 kondygnacji na `10-top.png`, `08-high-west.png` i `09-high-east.png`:**
   - Dzięki tarasowemu przesunięciu pięter i automatycznemu ukryciu grupy `room-ceilings` (`ceiling: true`), zrzuty `10-top.png`, `08-high-west.png` i `09-high-east.png` pokazują jednocześnie układ mebli i ścieżek na **Piętrze 60 (`y = 0.00 m`: `R1`, `R2`, `R3`)**, **Piętrze 61 (`y = 4.80 m`: `R4`, `R5`, `R6`, `R7`)**, **Piętrze 62 (`y = 9.60 m`: `R8`, `R9`, `R10`)** oraz pełny pion **Atrium `A0`** z szybem windy i 4 klatkami schodowymi.
2. **Kadr startowy `01-spawn.png` i widoczność między piętrami:**
   - `01-spawn.png` pokazuje reprezentacyjne Lobby `R1` z bramkami VIP, ladami recepcyjnymi z logo Kurogane Arms, a w głębi otwarte na 3 piętra Atrium, przeszklony szyb windy z kabiną, biegi schodów oraz wieżowce za północną szklaną fasadą.
3. **„Żywe miasto” za szklanymi fasadami (`02-north.png`, `03-east.png`, `05-west.png`, `06-corner-nw.png`, `07-corner-se.png`):**
   - Przez zewnętrzne szklane ściany `mat_glass_clear` widać zarówno głęboki kanion miasta w dole (`panoramaDropM: 180`), jak i bliskie sąsiednie cyber-wieżowce z animowanymi billboardami, oknami zmieniającymi stan w czasie, bursztynowo-białymi światłami ostrzegawczymi na szczytach (zero czerwieni!), wielopoziomowym ruchem latających pojazdów, deszczem za szybą oraz okazjonalnym przelotem bliskiego pojazdu tuż za oknem.
4. **Brak wolumetrycznych smug światła i brak mgły we wnętrzu:**
   - Na żadnym z 10 kadrów nie występują pionowe smugi pod lampami (`0` `cone: true`, użycie `mat_light_panel`, `fog.density: 0` i `fog.strength: 0` w `kuroganeOfficeTower.json`), a wewnątrz biur nie spada ani jedna kropla deszczu (`rainShelters`).
5. **Czytelność windy i 10 pomieszczeń:**
   - Na każdym z 3 przystanków przy szybie windy wyraźnie widać drzwi szybowe `off_elevator_shaft_door`, przeszkloną kabinę `off_elevator_cab` oraz panel `off_elevator_call_panel` z podświetlonymi przyciskami **GÓRA (`▲`)** i **DÓŁ (`▼`)**.
   - Każde pomieszczenie można rozpoznać w 1 sekundę po wyposażeniu i palecie: Recepcja z logo (`R1`), Openspace z wyspami biurek (`R2`), Korytarz Panoramowy (`R3`), przeszklone Sale Konferencyjne ze stołami i ścianami wideo (`R4`, `R5`), Kuchnia z ekspresem i sofami (`R6`), Serwerownia/Drukarnia (`R7`), Szklane Gabinety Kierownictwa (`R8`, `R9`) i panoramiczny Gabinet Zarządu (`R10`).
6. **Zero barw zakazanych i zero nazw chronionych:**
   - W otoczeniu i panoramie nie występuje czerwień, cyan ani magenta, a w kodzie, teksturach i dokumentacji nie występują żadne nazwy chronione (`AGENTS.md`).

### 6.2. Etapy prac (A–E)

| Etap | Zakres prac | Artefakty wyjściowe | Weryfikacja etapu |
|---|---|---|---|
| **Etap A — Fundamenty kodu, „żywego miasta”, windy i materiałów** | 1. Implementacja / integracja mechaniki działającej windy `elevators[]` dla gracza i AI (**F-01**, `docs/systems/elevator.md`).<br>2. Rozbudowa `SceneAtmosphere`, `Panorama`, `buildSkyline` i `skyMaterials` o korektę `outer-ground` dla `panoramaDropM`, bliskie cyber-wieżowce, zapalające się/gasnące okna, wielopoziomowe pasy latających pojazdów z bliskim przelotem za szybą i 6 billboardów (**F-02**).<br>3. Dopisanie prefiksu `'off_'` w `cityModels.ts` oraz list `WALL_FIXTURES`, `PASSAGE_FIXTURES` i `CEILING_FIXTURES` w `mapAudit.ts` (**F-03**).<br>4. Rejestracja 3 materiałów `off_carpet_tile`, `off_polished_granite`, `off_wood_slat_wall` (**F-04**) i utworzenie profilu pogody `src/data/weather/kuroganeOfficeTower.json` (**F-05**). | Zmiany w `src/render/`, `src/world/`, `src/scenes/`, `src/data/render/arenaMaterials.json`, `src/data/weather/kuroganeOfficeTower.json` + testy w `tests/unit/skyline.test.ts` | `npm run check` zielone |
| **Etap B — Modele 3D w Blenderze (`off_*.glb`)** | 1. Napisanie generatora `tools/blender/sets/kurogane_office.py` budującego 25 modeli `off_*.glb` z Tabel 1 i 2 (`§4.1`), z użyciem `mat_light_panel` na oprawach i `mat_glass_clear` na fasadach, ściankach i szybie windy.<br>2. Eksport plików `.glb` do `public/assets/models/city/` i render podglądów PNG do `artifacts/models/off/`.<br>3. Aktualizacja `src/data/render/mapModelBounds.json` skryptem `node tools/levels/mapModelBounds.mjs` oraz dopisanie sekcji w `docs/assets.md`. | 25 plików `public/assets/models/city/off_*.glb`, podglądy `artifacts/models/off/*.png`, zaktualizowany `mapModelBounds.json` | Ogląd podglądów PNG + test jednostkowy modeli (AABB, materiały, budżet trójkątów, brak zakazanych barw) |
| **Etap C — Tekstury szyldów, ekranów, decali i powierzchni** | 1. Wygenerowanie i walidacja 3 tekstur powierzchni `off_*` (+ 3 wersji `komiks_off_*`).<br>2. Wygenerowanie 10 szyldów `signs/off_*`, 2 ekranów (`screen_office_analytics`, `screen_elevator_panel`), etykiety `label_office_mug` oraz 8 decali z `§4.2`.<br>3. Rejestracja w `tools/textures/catalog.json`, `tools/textures/komiks/catalog.json` i manifestach w `public/assets/textures/`. | Pliki `.webp` w `public/assets/textures/{surfaces,komiks/surfaces,signs,screens,decals,labels}/` | Walidator tekstur (wymiary, bezszwowość powierzchni, 0 pikseli w zakazanych pasmach HSV czerwieni/cyanu/magenty) |
| **Etap D — Generator mapy `run4`** | 1. Implementacja `tools/arenas/run/run4.mjs` oraz modułów `_run4Kit.mjs`, `_run4Rooms.mjs`, `_run4Dress.mjs` według współrzędnych z `§3` i `§5`.<br>2. Wygenerowanie `src/data/rooms/run4.json` i dopisanie `"run4": 0` w `tests/unit/mapAudit.baseline.json`.<br>3. Napisanie testu `tests/unit/run4Navigation.test.ts` (osiągalność 18 spawnów, 10 pomieszczeń, 3 przystanków windy, wyjścia i gęstości osłon). | `tools/arenas/run/run4.mjs`, `_run4*.mjs`, `src/data/rooms/run4.json`, `tests/unit/run4Navigation.test.ts` | `node tools/levels/mapAudit.mjs run4` → `0 error, 0 warn`; `npx vitest run tests/unit/run4Navigation.test.ts`; `npm run check` |
| **Etap E — Zrzuty ekranu, audyt wizualny i szlif** | 1. Wygenerowanie 10 zrzutów `node tools/screens/mapAudit.mjs run4 --out artifacts/maps/run4/r1 --tag after` oraz kadrów FPP z okien panoramicznych, sal konferencyjnych, windy i gabinetu zarządu.<br>2. Przegląd wizualny (widoczność 3 pięter na `10-top`, `08-high-west`, `09-high-east`, żywe miasto za szybą, brak smug światła, czytelność paneli windy, jasność `#2a3344–#56627a`, `renderInfo.calls <= 800`) i korekty do oceny Opusa `≥ 7/10`. | Zrzuty `artifacts/maps/run4/r1/*.png`, raport oceny wizualnej | Ocena Opusa `≥ 7/10`, `mapAudit` `0/0`, `npm run check` zielone |
