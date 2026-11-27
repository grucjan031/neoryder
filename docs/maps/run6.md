# Dokument projektowy mapy `run6` — REZYDENCJA PUŁKOWNIKA KUROGANE ARMS („WILLA KUROYAMA // ENKLAWA LEŚNA”)

Status: **Projekt referencyjny jakości (wzorzec 8+/10) + specyfikacja modułu tła leśnego, 15 pomieszczeń na 3 kondygnacjach, tablicy śledczej „Iskra”, modeli `res_*`, tekstur i generatora**  
Docelowy plik danych mapy: `src/data/rooms/run6.json` (generator: `tools/arenas/run/run6.mjs` + moduły pomocnicze `_run6Kit.mjs`, `_run6Rooms.mjs`, `_run6Dress.mjs`)  
Kierunek artystyczny: **Neon Noir** (`AGENTS.md`, `docs/adr/0006-neon-noir.md`)

**Wersja r2.** Rezydencja należy do puli walk i elit Kurogane. Sufity części
mieszkalnej mają beton architektoniczny, a oba biegi schodów salonowych —
bursztynowe listwy LED. W scenie
`?scene=map-walk&map=run6` spod wejścia do salonu widać korony przez górne
przeszklenia. Oba biegi schodów prowadzą na antresolę, a za biurkiem w R8
można podejść do podświetlonej tablicy Iskry. Od strony holu winda zjeżdża
do winiarni. Ocena wizualna r2 wymaga sprawdzenia tych kadrów w grze.

| Pomieszczenie | Zmiana widoczna w r2 |
| --- | --- |
| R1 Hol | Cieplejszy beton i marmur Nero, orzechowa konsola, bonsai i obraz lasu zamiast heksagonalnych paneli. |
| R2 Salon i antresola | Dwa żyrandole nad strefą wypoczynku, dywan nad posadzką, barek z regałem na wino i jedna warstwa szkła w pełnych modułach fasady. |
| R3 Jadalnia | Przy stole pozostało dziesięć krzeseł z modelu rezydencji. Nad nim wisi pojedynczy żyrandol, za nim stoi orzechowy kredens z kamiennym blatem. |
| R4 Kuchnia | Szafki z orzecha z marmurowymi blatami zastąpiły aneksy biurowe. Światło wpada również przez przeszklenie przy zielniku. |
| R5 Basen | Ciemny marmur wokół niecki, wąskie oprawy nad leżankami i pojedyncze szyby od strony lasu. |
| R6 Garaż | Wpuszczone światło nad limuzyną. Skrzynie przy stanowisku serwisowym zachowują funkcję osłon i chwytanych przedmiotów. |
| R7 Ochrona | Wąskie lampy nad konsolami monitoringu odsłaniają wyposażenie z góry. Jedna mała skrzynia pozostaje w strefie zbrojowni. |
| R8 Biuro | Tekstura Iskry leży przed licem tablicy, na wysokości oczu. Ciepłe światło, pojedynczy żyrandol, dywan i szafy z orzecha wydzielają gabinet. |
| R9 Biblioteka | Dywan wyznacza kącik czytelniczy. Orzechowa zabudowa i donice rezydencji zastąpiły część wyposażenia biurowego. |
| R10 Sala trofeów | Dwie gabloty rezydencji zastąpiły laboratoryjne stojaki na wschodniej ścianie. Marmur i dyskretne lampy obramowują ekspozycję. |
| R11 Sypialnia | Orzechowa ława w garderobie, widoczny dywan pod łóżkiem oraz obraz na licu tryptyku od strony sypialni. |
| R12 Spa | Marmur Nero przy wannie i umywalkach, szyld nad lustrem i czystszy widok przez północne okno. |
| R13 Sala przesłuchań | Wpuszczone lampy obwodowe zostawiają wiszącą oprawę nad fotelem jako główne światło. |
| R14 Winiarnia | Podświetlony szyld między regałami i skrócona zabudowa pod schodami odsłaniają przejście od stołu do windy. |
| R15 Bunkier | Dyskretne oświetlenie sufitu i mniej skrzyń przed śluzą ułatwiają odczyt stref CCTV, UPS i wyjścia. |

**Las r2:** sosny i świerki mają siedem postrzępionych pięter z osobnych
opadających gałęzi, odsłonięte pnie i zróżnicowane sylwetki. Liściaste korony
składają się z siedmiu nieregularnych brył, a podszyt z rozłożystych paproci.
Ciemna ściółka z plamami mchu odwzorowuje pagórki i drobny relief; teren
pozostaje poniżej piwnicy wewnątrz obrysu budynku. Mgła jest rzadsza,
księżyc podkreśla krawędzie koron, a pełne moduły okien mają jedną szybę.
Panorama lasu wyłącza płaskie podłoże panoramy miejskiej.

Testy `run6Navigation.test.ts` obejmują także prześwit kapsuły na 20 spawnach
i gęstość osłon salonu. `forestLayout.test.ts` sprawdza relief, odsłonięcie
piwnicy i zmianę podłoża przy przełączaniu panoramy. Odbiór wizualny r2
i pomiar wywołań renderu pozostają do wykonania na nowych zrzutach.

---

## 1. Analiza silnika i nauczki z `run1`–`run4` oraz `bulwar1`

### 1.1. Co już działa w silniku i jak `run6` z tego korzysta

Po wdrożeniu magazynu `run1` ([docs/maps/run1.md](run1.md)), galerii handlowej `run2` ([docs/maps/run2.md](run2.md)), tajnego laboratorium `run3` ([docs/maps/run3.md](run3.md)), biurowca `run4` ([docs/maps/run4.md](run4.md)) oraz przychodni `bulwar1` ([docs/maps/bulwar1.md](bulwar1.md)) silnik posiada kompletny zestaw mechanik do budowy trzykondygnacyjnej, luksusowej rezydencji otoczonej nocnym lasem:

| Obszar silnika | Stan obecny w kodzie | Jak wykorzystuje to `run6` | Odwołania do plików |
|---|---|---|---|
| **Format pokoju i katalogi testowe** | Pokój `src/data/rooms/run6.json` (`type: "combat"`, z blokiem `arena` i `spawnRing`) ładuje się automatycznie przez `import.meta.glob` do `roomDefinitions`, menu „Testy map” (`?maps=1` → `?scene=map-walk&map=run6`), sceny walki `?scene=room-test&room=run6&debug=1` oraz audytu CLI `node tools/levels/mapAudit.mjs run6` i `node tools/screens/mapAudit.mjs run6`. | `run6` jest pokojem runu (`rooms`), bez sztucznej misji kampanii. Po odbiorze wizualnym (ocena Opusa `≥ 7/10`) zostaje dopisany do `roomPools.combat` i `roomPools.elite` w `src/data/sectors/kurogane.json` obok `run1`–`run4`. | `src/world/rooms.ts`, `src/world/mapCatalog.ts`, `tools/levels/mapAuditCatalog.ts`, `tools/arenas/run/_runKit.mjs` |
| **Nawigacja 3D (`ArenaSurfaceNavigation`)** | `RoomScene.init()` buduje graf komórek `0.5 × 0.5 m` na blokach `walkable: true` połączonych rampami osiowymi (`rotation.x` lub `rotation.z`), z kontrolą prześwitu `navigationHeadroomM = 2.2 m` i promienia kapsuły `navigationClearanceM = 0.4 m`. | Spina trzy kondygnacje rezydencji: **Piwnicę (`B`, `y = -4.80 m`)**, **Parter (`L0`, `y = 0.00 m`)** oraz **Piętro (`L1`, `y = +4.80 m`)** przez spoczniki pośrednie (`y = -2.40 m` i `y = +2.40 m`) czterema dwubiegowymi klatkami schodowymi o czystym obrocie `rotation.x`, kącie **`25.64° ≤ 26.6°`** i szerokości **`3.20 m ≥ 2.0 m`**, a równolegle przez **działającą prywatną windę pancerną** (`elevators[0]`) łączącą Parter z Piwnicą. | `src/world/arenaNavigation.ts`, `src/world/arenaSurfaceNavigation.ts:119–274` |
| **Działająca winda pokojowa (`elevators[]`)** | Moduł `Elevator` (`src/world/elevator.ts`, `docs/systems/elevator.md`) obsługuje kinematyczną kabinę Rapiera, drzwi szybowe i kabinowe, przyciski wezwania/kierunku (`E`) oraz pełną integrację z grafem tras AI (`ElevatorRoutes`, `ElevatorPassengers`). | W osi między Holem Wejściowym `R1` (`y = 0.00 m`) a Winiarnią `R14` i Salą Tortur `R13` w Piwnicy (`y = -4.80 m`) kursuje **Prywatna Winda Piwniczna Pułkownika** (`id: "cellar-interrogation-lift"`, `width: 2.6, depth: 2.6`, `model: "res_elevator_cab"`), którą zarówno gracz, jak i Egzekutorzy mogą zjeżdżać do podziemnego kompleksu przesłuchań. | `docs/systems/elevator.md`, `src/world/elevatorSchema.ts`, `src/world/elevator.ts`, `src/render/elevatorView.ts` |
| **Spawny i hazardy na wielu kondygnacjach (`spawnPoints[].y`, `hazards[]`)** | `roomSpawnPointSchema` i `wavesSchema` obsługują współrzędną `y`, a `validateLayout` weryfikuje podparcie spawnów oraz zagrożeń (`electric_field`, `laser_gate`, `explosive_barrel`) na poziomych blokach `walkable: true` dowolnej kondygnacji (`y = -4.80, 0.00, +4.80 m`). | **20 punktów spawnu** rozłożonych na trzech kondygnacjach: **4 w Piwnicy (`y = -4.80 m`)**, **10 na Parterze (`y = 0.00 m`)** i **6 na Piętrze oraz Antresoli Salonu (`y = +4.80 m`)** oraz **5 zagrożeń środowiskowych** na poziomach `-4.80 m`, `0.00 m` i `+4.80 m`. | `src/world/roomSchema.ts:146–151, 406–588`, `src/scenes/roomScene.ts:610, 1612` |
| **Przezroczyste szkło (`mat_glass_clear`) i panele świetlne bez smug (`mat_light_panel`)** | `glass_clear` (`opacity: 0.22, depthWrite: false` + Fresnel) zapewnia obustronną przezierność tafli szklanych. `light_panel` (`#fff1d6`, `flat: true`) świeci ciepłą bielą bez selektywnego bloomu. | `mat_glass_clear` tworzy **22-metrową dwukondygnacyjną szklaną fasadę Wielkiego Salonu `R2` z widokiem na las**, przeszklenia Ogrodu Zimowego/Basenu `R5`, Sypialni `R11`, Biura `R8`, szklane balustrady antresoli oraz gabloty Sali Trofeów `R10`. `mat_light_panel` oświetla ukryte listwy LED w betonie, kasetony i lampę w Sali Tortur `R13` bez generowania smug bloomu. | `src/render/urbanMaterials.ts`, `src/data/render/arenaMaterials.json:183–202` |
| **Strefy bez opadu (`rainShelters`) przy ulewnym deszczu w lesie** | `Weather` (`src/vfx/weather.ts:104–108`) wycina w shaderze smugi deszczu wewnątrz każdego AABB z tablicy `rainShelters`, zostawiając pełny opad poza obrysem budynków (`run4`, `bulwar1`). | Całe wnętrze trzech kondygnacji willi pokrywają szczelne bryły `rainShelters` (wewnątrz `0` kropli i `0` rozbryzgów), natomiast tuż za wielkimi taflami `mat_glass_clear` Salonu, Basenu, Jadalni, Biura i Sypialni zacina nocny deszcz pomiędzy pniami sosen i świerków. | `src/world/dressingSchema.ts:200–205`, `src/render/city/dressing.ts:168–177` |
| **Ukrywanie stropów w ujęciach audytu z góry (`ceiling: true`)** | Bloki z `ceiling: true` trafiają do grupy `room-ceilings`, ukrywanej w `MapAuditScene.render()` dla kamer `top`, `high-west` i `high-east`. | Wszystkie niegrywalne dachy i stropy nad Piwnicą (`y = 0.00..0.40 m` w strefie tarasu południowego), Parterem (`y = 4.80..5.20 m`), Dwukondygnacyjnym Salonem (`y = 9.60..10.00 m`) oraz Piętrem (`y = 9.60..10.00 m`) mają `ceiling: true`. | `src/scenes/roomScene.ts:1129`, `src/scenes/mapAuditScene.ts:140, 163–166` |

### 1.2. Kluczowe nauczki z `run1`–`run4` zastosowane w `run6`

1. **Widoczność wszystkich 3 kondygnacji (w tym Piwnicy `y = -4.80 m`) na zrzutach `10-top.png`, `08-high-west.png` i `09-high-east.png` (nauczka z `run3` i `run4`):**
   - W `src/scenes/mapAuditScene.ts:163–166` kamery zewnętrzne `top`, `high-west` i `high-east` ukrywają wyłącznie grupę `room-ceilings` (bloki z `ceiling: true`). Płyty podłogowe Parteru (`L0: y = 0.00 m`) oraz Piętra (`L1: y = +4.80 m`) muszą mieć `walkable: true` i **nie mogą** mieć `ceiling: true`. Gdyby Piwnica (`y = -4.80 m`) leżała bezpośrednio pod posadzką Parteru, a Piętro (`y = +4.80 m`) bezpośrednio nad całym Parterem, górne posadzki zasłoniłyby niższe kondygnacje na zrzutach audytu.
   - **Rozwiązanie architektoniczne w `run6` (kaskadowa willa na leśnej skarpie z 3 strefami rzutów XZ i dwukondygnacyjnym Salonem):**
     1. **Południowe Skrzydło Piwniczne w skarpie (`Z ∈ [+16, +32], X ∈ [-28, +28]`, posadzka `y = -4.80 m`):** mieści **Salę Tortur i Przesłuchań (`R13`)**, **Prywatną Winiarnię (`R14`)** oraz **Podziemny Bunkier Ochrony i Serwerownię (`R15`)**. Nad całym tym pasem (`Z ∈ [+16, +32]`) nie ma grywalnych pokoi Parteru ani Piętra — przykrywa go wyłącznie betonowo-szklana płyta tarasu dziedziniec-świetlik na `y = 0.00..0.40 m` oznaczona `ceiling: true`. W grze FPP piwnica jest zamkniętym, mrocznym podziemiem z pancernymi świetlikami sufitowymi, natomiast w ujęciach `10-top`, `08-high-west` i `09-high-east` płyta `ceiling: true` znika, odsłaniając **100% wnętrza wszystkich 3 pomieszczeń Piwnicy (`R13`, `R14`, `R15`), oba biegi schodów `L0 ↔ B` oraz dolny przystanek windy**!
     2. **Środkowy Korpus Parteru z Dwukondygnacyjnym Salonem (`Z ∈ [-18, +16], X ∈ [-30, +30]`, posadzka `y = 0.00 m`):** w geometrycznym sercu willi leży jedyne duże pomieszczenie mapy — **Wielki Dwukondygnacyjny Salon (`R2`, `X ∈ [-16, +16], Z ∈ [-18, +4]`, `32 × 22 m = 704 m²`, wysokość `H = 9.60 m`)** z pustką przez dwie kondygnacje i obwodową **Antresolą/Galerią (`R2-M`, szer. `3.2 m` na `y = +4.80 m`)**. Otaczające Salon pomieszczenia Parteru — **Hol Wejściowy (`R1`)**, **Jadalnia (`R3`)**, **Kuchnia (`R4`)**, **Kryty Basen i Ogród Zimowy (`R5`)**, **Garaż Pancerny (`R6`)** oraz **Pokój Ochrony (`R7`)** — są przykryte wyłącznie własnymi stropami na `y = +4.80..5.20 m` z `ceiling: true` (brak nad nimi pokoi Piętra `L1`), dzięki czemu na zrzutach z góry widać kompletnie cały Parter!
     3. **Północna Korona Piętra nad leśnym zboczem (`Z ∈ [-42, -18], X ∈ [-30, +30]`, posadzka `y = +4.80 m`):** wysunięta na północ nad opadający stok lasu kondygnacja `L1` mieści **Biuro Pułkownika (`R8`)**, **Bibliotekę (`R9`)**, **Salę Trofeów (`R10`)**, **Sypialnię Pułkownika z Garderobą (`R11`)** oraz **Prywatne Spa i Łazienkę (`R12`)**, przykryte dachem `y = +9.60..10.00 m` z `ceiling: true`.

2. **Pogodzenie `fog: 0` we wnętrzu rezydencji z gęstą mgłą między pniami drzew za oknem (nauczka z `run3` i `run4`):**
   - W `src/render/outline.ts:426–445` globalna mgła post-procesu (`fogStrength`, `heightFogDensity`) działa na bufor głębi wszystkich nieprzezroczystych brył, w tym wnętrza budynku. Przy ujemnych rzędnych Piwnicy (`y = -4.80 m`) i wysokim na `9.60 m` Salonie włączenie globalnej mgły zamuliłoby cienie i stworzyło mleczną poświatę wokół opraw LED.
   - **Rozwiązanie w `kuroganeForestResidence.json` i `forestMaterials.ts`:**
     - W profilu pogody `kuroganeForestResidence.json` ustawiamy **`fog.density: 0`**, **`fog.strength: 0`** oraz **`dust.density: 0`** — wnętrze willi na wszystkich 3 kondygnacjach zachowuje krystalicznie czysty kontrast Neon Noir.
     - Natomiast **mgła leśna między pniami drzew** jest renderowana bezpośrednio w module `ForestPanorama` (**F-01**): (a) w fragment shaderze drzew i pagórków (`forestFragment`) jako warstwowa mgła odległościowo-wysokościowa (`smoothstep(28.0, 145.0, dist)` zagęszczona w dolinie `vWorld.y < 6.0 m`), oraz (b) jako 1 `InstancedMesh` półprzezroczystych, powoli dryfujących pasm przyziemnej mgły (`forest-mist`, `AdditiveBlending`, `depthWrite: false`) rozmieszczonych wyłącznie poza `panoramaExclusion` (między pniami w odległości `18..85 m` od okien).

3. **Zero wolumetrycznych smug światła (`0` stożków) i zero zakazanych barw (nauczka z `run2` i `run3`):**
   - `0` świateł z `cone: true` w `lights[]`, całkowity zakaz `city_street_lamp` oraz `city_lantern_string`.
   - Wszystkie białe powierzchnie świecące (ukryte listwy sufitowe, żyrandole liniowe, podświetlenia stopni, lampa zabiegowa w Sali Tortur `R13`) używają wyłącznie **`mat_light_panel`** (`#fff1d6`, `flat: true`), a nie `mat_light_white`.
   - Na tablicy śledczej w Biurze Pułkownika (`R8`), w laserach zabezpieczeń i w światłach drona/lądowiska w lesie obowiązuje **bezwzględny zakaz czerwieni, cyanu i magenty** (nitki na tablicy śledczej są **bursztynowe `#ffae1a`** oraz **ciepłobiałe `#fff1d6`**).

---

## 2. Lista braków („fundamenty”) z priorytetem P0 / P1

### 2.1. Priorytet P0 — MUSI BYĆ PRZED `run6`

#### A. Uogólnienie modułu tła (`SceneAtmosphere` / `Panorama`) na tło leśne i rejestracja `res_*` (Etap A)

Analiza istniejącego kodu „żywego miasta za oknem” z `run4` w `src/render/sceneAtmosphere.ts`, `src/render/panorama.ts`, `src/render/skyline.ts` oraz `src/render/skyMaterials.ts` pokazuje, że cały system tła jest już czysto odseparowany od fizyki i symulacji:
- `SceneAtmosphere.sync()` (`src/render/sceneAtmosphere.ts:118–127`) tworzy pojedynczy obiekt grupy tła `this.panorama = new Panorama(this.seed, this.floorY - this.panoramaDropM, this.panoramaExclusion, this.panoramaDropM)` i przekazuje mu w każdej klatce `dt` oraz `horizon` z `horizonParameters()`.
- `Panorama` (`src/render/panorama.ts:36–353`) zarządza kopułą nieba `sky-dome`, wywołuje deterministyczny generator układu (`buildSkyline` w `src/render/skyline.ts`) z wykluczeniem AABB budynku (`this.exclusion`, czyli `envelope.bounds` pokoju!) i buduje kilka zbatchowanych obiektów `InstancedMesh` rysowanych niestandardowymi shaderami z `src/render/skyMaterials.ts`.

Aby zastąpić miasto za oknami **prawdziwym, żywym, deszczowym lasem nocą**, uogólniamy ten mechanizm w fundamencie **F-01**:

| ID | Co trzeba dopisać w kodzie i dlaczego | Pliki w repozytorium | Zakres zmian |
|---|---|---|---|
| **F-01** | **Moduł tła leśnego (`ForestPanorama` / `panoramaKind: "forest"`) — uogólnienie `SceneAtmosphere` i `Panorama`:**<br>1. **Kontrakt w profilu pogody (`src/render/weatherSchema.ts` i `src/render/themes.ts`):** w bloku `lighting` profilu pogody dodać opcjonalne pole `panoramaKind: z.enum(['city', 'forest']).optional()` (domyślnie `'city'`), przepisywane do `tuning.render.panoramaKind` (lub przekazywane z `RoomScene` do `SceneAtmosphere`).<br>2. **Przełącznik w `SceneAtmosphere.sync()` (`src/render/sceneAtmosphere.ts:118`):** gdy `panoramaKind === 'forest'`, zamiast miejskiego `Panorama` tworzyć `new ForestPanorama(this.seed, this.floorY, this.panoramaExclusion)` (lub wywoływać gałąź `buildForestBackdrop()` wewnątrz uogólnionego `Panorama`).<br>3. **Deterministyczny generator układu lasu (`buildForestLayout(seed, options)` w `src/render/forestLayout.ts`, czysty TS bez Three.js, wzorowany na `buildSkyline` z `src/render/skyline.ts`):** generuje na bazie `Rng(seed).fork('forest')` z zachowaniem pełnego wykluczenia `panoramaExclusion` (obrysu willi powiększonego o `3.0 m`):<br>- **Pagórki terenu (`hills[]`, 28 brył):** pierścieniowe wzniesienia wokół polany rezydencji (`promień 44..210 m`, `baseY = floorY - 6.0 m`, wysokości `5..28 m`),<br>- **3 warstwy drzew iglastych (`conifers[]`, ~480 instancji: świerki i sosny Kuroyama):**<br>  • *Warstwa bliska (skraj polany i wzdłuż ogrodzenia, `promień 34..54 m`):* wysokie, detaliczne sylwetki sosen i świerków (`wys. 14..24 m`, szer. `4.5..7.5 m`), widoczne z bliska przez 22-metrowe okno Salonu `R2`, Basenu `R5`, Biura `R8` i Sypialni `R11`,<br>  • *Warstwa średnia (gęsty bór na stokach, `promień 54..110 m`):* `wys. 16..30 m`, stojące na stokach pagórków (`baseY` dopasowane do wysokości terenu),<br>  • *Warstwa daleka (ściana czarnego lasu na horyzoncie, `promień 110..195 m`):* `wys. 22..38 m`, zamykająca horyzont 360°,<br>- **Warstwa drzew liściastych i podszytu (`deciduous[]`, ~200 instancji, `promień 32..88 m`):** rozłożyste korony buków/klonów japońskich oraz gęste kępy paproci i krzewów między pniami (`wys. 2.5..14 m`),<br>- **Ogrodzenie posesji i latarnie ścieżki leśnej (`perimeterPosts[]` + `beacons[]`):** pierścień pancernych słupów ogrodzenia Kurogane w odległości `10..16 m` od fasad willi z bursztynowymi światłami obwodowymi (`#ffae1a`, `color: 0`) oraz kręta aleja dojazdowa na południu i wschodzie z niskimi słupkami świetlnymi (`#fff1d6`, `color: 1`),<br>- **Lądowisko drona/AV i wieża przekaźnikowa w lesie (`helipad` + `watchtower`):** na polanie północno-zachodniej (`X = -46 m, Z = -58 m, Y = +1.5 m`) oświetlony okrąg lądowiska `H-06` z pierścieniem 12 świateł nawigacyjnych w bursztynie (`#ffae1a`) i zieleni (`#6dff4a`), a na wzgórzu północno-wschodnim (`X = +72 m, Z = -84 m`) leśny maszt komunikacyjny Kurogane z migającymi bursztynowymi światłami przeszkodowymi,<br>- **Patrolujące drony ochrony, bliski przelot szperacza i oczy leśnej fauny (`drones[]`, `flybys[]`, `faunaEyes[]`):** 6 dalekich dronów patrolowych krążących nad koronami drzew (`y = +4..+18 m`), **2 tory bliskiego przelotu (`close fly-by`)** ciężkiego drona strażniczego w odległości `9..13 m` za północną szybą Salonu `R2` (`Z = -28 m, y = +3.8 m`) i wschodnią szybą Basenu `R5` (`X = +41 m, y = +2.6 m`) z reflektorami `#fff1d6` i smugą `#ffae1a`, oraz 8 par bursztynowych oczu leśnych zwierząt (jeleni/cyber-wilków) połyskujących w cieniu między pniami na skraju lasu (`promień 35..48 m`, `y = +0.9..+1.3 m`, powolne mruganie w shaderze).<br>4. **Shadery i materiały lasu (`src/render/forestMaterials.ts`):**<br>- Vertex shader drzew z animacją ugięcia koron na wietrze (`windOffset = sin(time * 1.7 + seed * 6.28) * pow(max(vLocal.y, 0.0) / treeH, 1.8) * 0.35`),<br>- Fragment shader drzew i pagórków z obrysem poświaty księżycowej od góry (`moonRim` w barwie `#c9dcff` / `#fff1d6`), dolnym podświetleniem od bursztynowych latarni ogrodzenia (`uplight` `#ffae1a`) oraz **lokalną mgłą leśną między pniami** (`forestMistFactor = smoothstep(26.0, 140.0, dist) * (0.45 + 0.55 * exp(-max(vWorld.y - floorY, 0.0) / 7.5))`),<br>- `InstancedMesh` `forest-mist` (24 niskie, szerokie wstęgi mgły `AdditiveBlending, depthWrite: false` snujące się między pniami na `y = -1.5..+4.5 m` poza `panoramaExclusion`),<br>- Rozszerzenie `sky-dome` o wyraźną **tarczę księżyca z halo w chmurach** na kierunku północno-zachodnim (`azymut = 2.55 rad, elewacja = 0.42 rad`, barwa `#fff1d6` z chłodną poświatą `#3d7bff`). | `src/render/weatherSchema.ts`, `src/render/sceneAtmosphere.ts`, `src/render/forestPanorama.ts`, `src/render/forestLayout.ts`, `src/render/forestMaterials.ts`, `tests/unit/forestLayout.test.ts` | ~180 linii TS/GLSL + test jednostkowy układu lasu |
| **F-02** | **Rejestracja prefiksu `'res_'` oraz modeli ściennych, sufitowych i przejściowych rezydencji w `cityModels.ts` i `mapAudit.ts`:**<br>1. W `CITY_MODEL_PREFIXES` (`src/render/cityModels.ts:8`) dopisać `'res_'`, aby loader zachowywał wielomateriałowość glTF modeli `/assets/models/city/res_*.glb`.<br>2. W `src/world/mapAudit.ts:24–59` dopisać:<br>- do `WALL_FIXTURES`: `res_forest_glass_facade`, `res_interior_door_frame`, `res_elevator_shaft_door`, `res_elevator_call_panel`, `res_investigation_board_iskra`, `res_cctv_monitor_wall`, `res_wine_rack_wall`, `res_bookshelf_wall`, `res_garage_tool_wall`, `res_wall_art_triptych`, `res_oneway_mirror`, `res_holding_cage_bars`;<br>- do `PASSAGE_FIXTURES`: `res_interior_door_frame`, `res_elevator_shaft_door`, `res_holding_cage_bars`, `res_biometric_arch`;<br>- do `CEILING_FIXTURES`: `res_chandelier_linear`, `res_interrogation_lamp`, `res_recessed_led_strip`. | `src/render/cityModels.ts`, `src/world/mapAudit.ts` | ~25 linii TS |

#### B. Nowe materiały powierzchniowe, profil pogody `kuroganeForestResidence` i tekstury (Etap A/C)

| ID | Co trzeba dodać | Gdzie w zasobach / danych | Szczegóły |
|---|---|---|---|
| **F-03** | **4 materiały wykończeniowe luksusowej rezydencji w `arenaMaterials.json` i tekstury `surfaces/`:**<br>1. `res_arch_concrete` — gładki beton architektoniczny z subtelnym rysunkiem szalunku, otworami po ściągach i satynową impregnacją odbijającą listwy LED (`scale: 0.35, roughness: 0.42, metalness: 0.08, bump: 0.38, wetness: 0.25, tint: "#77766c"`) — monolityczne ściany Salonu `R2`, Holu `R1`, Biura `R8`, Sali Trofeów `R10` i Piwnicy `R13`/`R15`;<br>2. `res_dark_walnut` — wielkoformatowe fornirowane panele i parkiet z ciemnego, wędzonego orzecha amerykańskiego z czarnymi mikroszczelinami (`scale: 0.45, roughness: 0.36, metalness: 0.10, bump: 0.40, wetness: 0.35, tint: "#493425"`) — ciepła, luksusowa posadzka Salonu `R2`, Jadalni `R3`, Biura `R8`, Biblioteki `R9` i Sypialni `R11`;<br>3. `res_nero_marble` — polerowany czarny marmur Nero Marquina ze złoto-bursztynowym i białym żyłkowaniem o wysokim połysku odbić (`scale: 0.38, roughness: 0.16, metalness: 0.18, bump: 0.22, wetness: 0.78, tint: "#242520"`) — posadzka Holu `R1`, Kuchni `R4`, Ogrodu Zimowego/Basenu `R5`, Sali Trofeów `R10` i Łazienki/Spa `R12`;<br>4. `res_plush_carpet` — gęsty, miękki dywan wełniano-jedwabny w odcieniu głębokiego grafitu z geometrycznym tkanym obrysem (`scale: 0.55, roughness: 0.86, metalness: 0.03, bump: 0.45, wetness: 0.04, tint: "#38372f"`) — strefa wypoczynkowa Salonu `R2`, Biblioteka `R9` i Sypialnia Pułkownika `R11`. | `src/data/render/arenaMaterials.json`, `src/render/urbanMaterials.ts`, `src/render/surfaceTextures.ts`, `src/world/dressingSchema.ts`, `public/assets/textures/surfaces/res_*.webp` (+ wersje `komiks_res_*.webp`) | 4 tekstury `.webp` (`1024×1024`) + 4 odpowiedniki komiksowe + wpisy w `BLOCK_MATERIALS` |
| **F-04** | **Profil pogody `src/data/weather/kuroganeForestResidence.json` („Rezydencja Pułkownika Kurogane w Nocnym Lesie”):**<br>- `precipitation`: `{ kind: "rain", density: 0.52, speed: 18.5, color: "#8ca0be", opacity: 0.32, exposureS: 0.026, widthM: 0.014 }` — w połączeniu z `rainShelters` obejmującymi całe wnętrze willi deszcz zacina gęsto w lesie za szybami i nad świetlikiem tarasu, podczas gdy we wnętrzu jest 100% sucho;<br>- `wind`: `{ direction: { x: 0.85, z: -0.52 }, strength: 0.90, gustStrength: 0.32, gustPeriodS: 6.5 }` — kołysze koronami sosen i świerków za oknami Salonu;<br>- `lighting`: `{ hemiIntensity: 4.3, keyIntensity: 1.5, panoramaEnabled: true, panoramaKind: "forest" }` — włącza moduł tła leśnego `ForestPanorama` i zapewnia czytelność ciemnych mebli oraz osłon (`#2a3344–#56627a`);<br>- `fog`: `{ color: "#0b111c", density: 0, heightM: 16, strength: 0, nearM: 80, farM: 220 }` — **mgła post-procesu we wnętrzu wyzerowana (`density: 0, strength: 0`)**, zero zamglenia szyb i zero smug pod lampami (mgła między pniami drzew liczona wyłącznie w shaderach `ForestPanorama` poza obrysem willi!);<br>- `dust`: `{ density: 0, sizeM: 0.08, opacity: 0, color: "#9aa8c0", lifeS: 10 }`;<br>- `surface`: `{ gloss: 0.68, reflections: 0.84, puddles: 0.14 }` — głębokie odbicia kominka, listew LED i księżycowego lasu w czarnym marmurze `res_nero_marble` oraz wodzie basenu `R5`;<br>- `sky`: `{ horizonColor: "#1d2238" }`, `lightning`: `{ enabled: false, minIntervalS: 30, maxIntervalS: 60, brightness: 0, color: "#fff1d6", decayS: 0.2 }`;<br>- `ambience`: `[{ kind: "rain", gain: 0.11, radiusM: 110 }, { kind: "wind", gain: 0.10, radiusM: 120 }, { kind: "generator", gain: 0.06, radiusM: 90 }]` (szum nocnej ulewy i wiatru w koronach drzew za oknami + cichy pomruk klimatyzacji i filtracji basenu). | `src/data/weather/kuroganeForestResidence.json` | 1 plik JSON |
| **F-05** | **Zestaw 32 tekstur rezydencji (`signs/`, `screens/`, `decals/`, `labels/`, `surfaces/`):** tablica śledcza „Iskra”, 12 easter eggów, obrazy na ścianach, szyldy stref, ekrany monitoringu i powierzchnie — pełna specyfikacja w **sekcji 4.2**. | `public/assets/textures/{signs,screens,decals,labels,surfaces}/`, `tools/textures/catalog.json` | 10 `signs`, 14 `decals`, 3 `screens`, 1 `labels`, 4+4 `surfaces` |

### 2.2. Priorytet P1 — Szlif po pierwszym odbiorze wizualnym

| ID | Co można dodać w kolejnym kroku | Gdzie w kodzie / zasobach | Efekt |
|---|---|---|---|
| **F-06** | **Subtelny ruch tafli wody i kaustyka w Krytym Basenie (`R5`, `res_indoor_pool_basin`):** animacja normal-mapy/fresnela na płytkiej tafli wody basenu (`głębokość 0.15 m` nad chodnikiem `walkable: true`). | `src/render/urbanMaterials.ts` | Jeszcze bardziej sugestywny efekt luksusowego pawilonu basenowego w deszczową noc. |
| **F-07** | **Zniszczalne butelki w Winiarni (`R14`) i monitory w Biurze/Bunkrze (`PropPhysicsSystem`):** rozbłysk iskier i odłamków szkła przy trafieniu w wybrane ekspozytory. | `src/world/propPhysics.ts` | Dodatkowa reaktywność otoczenia w walce. |

---

## 3. Projekt architektoniczny mapy `run6` — 15 pomieszczeń na 3 kondygnacjach (`Piwnica B`, `Parter L0`, `Piętro L1`)

### 3.1. Lore miejsca: Pułkownik Kenji Vane i jego leśna forteca „Willa Kuroyama”

- **Kim jest właściciel rezydencji:** **Pułkownik Kenji Vane** (kryptonim operacyjny *„Żelazny Szpon”*) — Szef Bezpieczeństwa Wewnętrznego i Dowódca Korpusu Egzekutorów **Kurogane Arms**. Były oficer sił pacyfikacyjnych Koalicji, który osobiście nadzorował budowę Kordonu Zero w tajnym laboratorium Sektora X-51 (`run3`), podpisywał kontrakty na dostawy „obiektów Klasy K” do wspólnego z **Helixa Dynamics** projektu „Akord” (`bulwar1`, `m06-odlewnia`), a po kompromitującym dla korporacji rajdzie Rezonanta na 62. piętro Kurogane Tower (`run4`) przejął bezpośrednie dowodzenie nad obławą na komórkę ruchu oporu **„Iskra”**.
- **Dlaczego wybudował rezydencję w lesie:** Vane gardzi przeludnioną Dolną Niecką i nawet w szklanym penthouse'ie wieżowca czuł się zbyt widoczny. Jego prywatna rezydencja — **Willa Kuroyama** — została wzniesiona w ściśle strzeżonej enklawie leśnej na zboczu górskim poza pierścieniem przemysłowym Neo-Ryd. Z zewnątrz i na poziomie parteru/piętra willa jest arcydziełem nowoczesnego, minimalistycznego luksusu: surowy beton architektoniczny, wędzony orzech, czarny marmur Nero Marquina, ukryte listwy LED w bursztynie i ciepłej bieli, hologramowy fortepian, kryty basen z ogrodem zimowym i 22-metrowe dwukondygnacyjne przeszklenie otwierające Salon na dziki, skąpany w nocnym deszczu las.
- **Mroczny sekret pod ziemią (Piwnica `y = -4.80 m`):** Pod tą wyrafinowaną fasadą kolekcjonera sztuki i starych roczników wina kryje się prawdziwe oblicze Egzekutora. Zjazd prywatną windą lub zejście betonowymi schodami do wykutej w skarpie piwnicy prowadzi obok klimatyzowanej **Winiarni (`R14`)** wprost do wyciszonej akustycznie **Sali Tortur i Przesłuchań (`R13`)**, gdzie Vane osobiście przesłuchuje schwytanych kurierów i informatorów „Iskry”, oraz do **Podziemnego Bunkra Ochrony (`R15`)** spiętego z siecią **Orbis Grid**.
- **Cel gracza (`Kuriera`):** Na biurku i tablicy śledczej w **Biurze Pułkownika (`R8`)** na piętrze willi znajdują się kompletne akta obławy na kryjówkę „Iskry” w nieczynnej **stacji metra Kamienna** oraz list gończy za samym graczem. Gracz przenika przez pancerną bramę **Holu Wejściowego (`R1`)** na parterze (`y = 0.00 m`), przebija się przez **Wielki Dwukondygnacyjny Salon (`R2`)** i prywatne apartamenty Piętra (`y = +4.80 m`), by ostatecznie zejść do Piwnicy (`y = -4.80 m`), rozbić sztab ochrony i wydostać się podziemnym tunelem ewakuacyjnym w **Bunkrze Ochrony (`R15`, `doors[exit]`)**.

### 3.2. Tabela wszystkich 15 pomieszczeń — wymiary, współrzędne, wysokości i palety neonów

Układ współrzędnych świata:
- `+X` = Wschód (prawo), `-X` = Zachód (lewo)
- `+Z` = Południe (dół, strona skarpy piwnicznej i podjazdu wejściowego), `-Z` = Północ (góra, strona głównej panoramy lasu, wielkiego przeszklenia Salonu i lądowiska drona)
- `+Y` = Góra (moduł kondygnacji wynosi **`4.80 m`**: płyta stropowa `0.40 m` + wysokość pomieszczeń w świetle `4.40 m`, natomiast Wielki Salon `R2` ma wysokość dwóch pełnych kondygnacji **`H = 9.60 m`**):
  - **PIWNICA (`B`):** posadzka **`y = -4.800 m`** (płyta `y = -5.40..-4.80 m`, `walkable: true`),
  - **SPOCZNIKI POŚREDNIE `B↔L0` (`MB0`):** **`y = -2.400 m`** (płyta `y = -2.80..-2.40 m`, `walkable: true`),
  - **PARTER (`L0`):** posadzka **`y = 0.000 m`** (płyta `y = -0.60..0.00 m`, `walkable: true`),
  - **SPOCZNIKI POŚREDNIE `L0↔L1` (`M01`):** **`y = +2.400 m`** (płyta `y = +2.00..+2.40 m`, `walkable: true`),
  - **PIĘTRO I ANTRESOLA SALONU (`L1`):** posadzka **`y = +4.800 m`** (płyta `y = +4.40..+4.80 m`, `walkable: true`).
- Wszystkie granice płyt podłogowych i otworów drzwiowych leżą na **liczbach całkowitych** (`validateLayout` 1×1 m w `src/world/roomSchema.ts`). Żadne dwa pomieszczenia na tej samej kondygnacji nie nakładają się na siebie.

| Nr | ID | Kondygnacja | Nazwa, tożsamość i rola w walce | Prostokąt `X` [m] | Prostokąt `Z` [m] | Wymiary i pole | Poziom podłogi `y` | Strop `y` (wys. w świetle `H`) | Dominująca paleta neonów (ADR 0006) |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | **R1** | **PARTER** (`L0`) | **Hol Wejściowy i Foyer z Szatnią**<br>*(start gracza, bramka biometryczna, bonsai, przystanek windy L0, wgląd w Salon)* | `-10 .. +10` | `+4 .. +16` | `20 × 12 m`<br>(`240 m²`) | `0.00 m` | `+4.80 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Bursztyn** `#ffae1a` + **Ciepła biel** `#fff1d6` |
| 2 | **R2** | **PARTER + ANTRESOLA** (`L0/L1`) | **WIELKI DWUKONDYGNACYJNY SALON Z ANTRESOLĄ I PANORAMĄ LASU**<br>*(JEDYNE DUŻE POMIESZCZENIE — centrum walki: wys. 9.6 m, przeszklenie 32 m na las, kominek, sofy, fortepian holo, antresola L1 i 2 klatki schodowe)* | `-16 .. +16` | `-18 .. +4` | `32 × 22 m`<br>(`704 m²` L0 + `168 m²` antresoli L1) | `0.00 m`<br>*(antresola: `+4.80 m`)* | `+9.60 m`<br>(`H = 9.60 m`, `ceiling: true`) | **Bursztyn** `#ffae1a` (kominek) + **Ciepła biel** `#fff1d6` + **Błękit** `#3d7bff` (poświata lasu) |
| 3 | **R3** | **PARTER** (`L0`) | **Jadalnia Reprezentacyjna („Stół Koalicji”)**<br>*(średni pokój: 12-osobowy stół marmurowy, kredens, żyrandol liniowy, okno W na las)* | `-30 .. -16` | `-6 .. +4` | `14 × 10 m`<br>(`140 m²`) | `0.00 m` | `+4.80 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Ciepła biel** `#fff1d6` + **Bursztyn** `#ffae1a` |
| 4 | **R4** | **PARTER** (`L0`) | **Nowoczesna Kuchnia i Spiżarnia Szefa Kuchni**<br>*(średni pokój CQB: monolityczna wyspa kuchenna, smart-lodówka z EE-08, okno NW na las)* | `-30 .. -16` | `-18 .. -6` | `14 × 12 m`<br>(`168 m²`) | `0.00 m` | `+4.80 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Ciepła biel** `#fff1d6` + **Zieleń** `#6dff4a` (zielnik hydroponiczny) |
| 5 | **R5** | **PARTER** (`L0`) | **Kryty Basen i Ogród Zimowy („Pawilon Deszczu”)**<br>*(średni pokój wschodni: podświetlona niecka basenu, leżanki, bambusy, 22 m szyb na las)* | `+16 .. +30` | `-18 .. +4` | `14 × 22 m`<br>(`308 m²`) | `0.00 m` | `+4.80 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Błękit królewski** `#3d7bff` (woda basenu) + **Zieleń** `#6dff4a` (ogród zimowy) |
| 6 | **R6** | **PARTER** (`L0`) | **Garaż Pancerny i Warsztat Pojazdowy**<br>*(średni pokój SW: pancerna cyber-limuzyna Pułkownika jako główna osłona, ładowarka EV, EE-01)* | `-30 .. -10` | `+4 .. +16` | `20 × 12 m`<br>(`240 m²`) | `0.00 m` | `+4.80 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Bursztyn** `#ffae1a` + **Błękit królewski** `#3d7bff` (stacja EV) |
| 7 | **R7** | **PARTER** (`L0`) | **Pokój Ochrony Parteru i Zbrojownia Straży**<br>*(średni pokój SE: konsole monitoringu lasu, szafy na broń, laser zabezpieczający zejście)* | `+10 .. +30` | `+4 .. +16` | `20 × 12 m`<br>(`240 m²`) | `0.00 m` | `+4.80 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Bursztyn** `#ffae1a` + **Zieleń** `#6dff4a` (ekrany taktyczne) |
| 8 | **R8** | **PIĘTRO** (`L1`) | **Biuro Pułkownika Vane'a („Gabinet Egzekutora”)**<br>*(średni pokój centralny L1: biurko Pułkownika, **Tablica Śledcza „Iskra” i list gończy**, wgląd na Salon i las)* | `-12 .. +12` | `-30 .. -18` | `24 × 12 m`<br>(`288 m²`) | `+4.80 m` | `+9.60 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Bursztyn** `#ffae1a` (nitki tablicy) + **Ciepła biel** `#fff1d6` |
| 9 | **R9** | **PIĘTRO** (`L1`) | **Biblioteka i Archiwum Prywatne**<br>*(średni pokój W na L1: podświetlane regały z książkami jako labirynt osłon, fotele, holo-globus, EE-09)* | `-30 .. -12` | `-30 .. -18` | `18 × 12 m`<br>(`216 m²`) | `+4.80 m` | `+9.60 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Ciepła biel** `#fff1d6` + **Bursztyn** `#ffae1a` + **Fiolet** `#8a5cff` |
| 10 | **R10** | **PIĘTRO** (`L1`) | **Sala Trofeów i Kolekcja Ostrzy („Sanktuarium Kurogane”)**<br>*(średni pokój E na L1: pancerne gabloty z prototypami i ostrzem z warsztatu Miry EE-10, stojak pancerza, bramka laserowa)* | `+12 .. +30` | `-30 .. -18` | `18 × 12 m`<br>(`216 m²`) | `+4.80 m` | `+9.60 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Fiolet** `#8a5cff` + **Bursztyn** `#ffae1a` |
| 11 | **R11** | **PIĘTRO** (`L1`) | **Sypialnia Pułkownika i Garderoba („Apartament Główny”)**<br>*(średni pokój NW na L1: łoże king-size, przeszklona garderoba z mundurami, okno 270° na las i lądowisko drona)* | `-24 .. +4` | `-42 .. -30` | `28 × 12 m`<br>(`336 m²`) | `+4.80 m` | `+9.60 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Fiolet** `#8a5cff` + **Ciepła biel** `#fff1d6` + **Bursztyn** `#ffae1a` |
| 12 | **R12** | **PIĘTRO** (`L1`) | **Prywatne Spa, Sauna i Łazienka Marmurowa**<br>*(średni pokój NE na L1: wolnostojąca wanna z kamienia, przeszklona sauna cedrowa, lustra LED, okno na las)* | `+4 .. +24` | `-42 .. -30` | `20 × 12 m`<br>(`240 m²`) | `+4.80 m` | `+9.60 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Błękit królewski** `#3d7bff` + **Ciepła biel** `#fff1d6` |
| 13 | **R13** | **PIWNICA** (`B`) | **SALA TORTUR I PRZESŁUCHAŃ („Komora Wydobywania Danych”)**<br>*(średni pokój SW w piwnicy: fotel z pasami, stolik z narzędziami, niska lampa nad fotelem, krata celi, odpływ w posadzce, lustro weneckie, konsole nagrań — groza bez makabry)* | `-28 .. -10` | `+16 .. +32` | `18 × 16 m`<br>(`288 m²`) | `-4.80 m` | `0.00 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Ciepła biel** `#fff1d6` (zimna lampa nad fotelem) + **Zieleń** `#6dff4a` + **Bursztyn** `#ffae1a` |
| 14 | **R14** | **PIWNICA** (`B`) | **Prywatna Winiarnia i Degustatornia („Krypta Roczników”)**<br>*(średni pokój centralny w piwnicy: podświetlane regały na 600 butelek, dębowe beczki, kamienny stół degustacyjny, przystanek windy B)* | `-10 .. +10` | `+16 .. +32` | `20 × 16 m`<br>(`320 m²`) | `-4.80 m` | `0.00 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Bursztyn** `#ffae1a` (podświetlenie butelek) + **Fiolet** `#8a5cff` |
| 15 | **R15** | **PIWNICA** (`B`) | **Podziemny Bunkier Ochrony, Serwerownia i Śluza Ewakuacyjna**<br>*(średni pokój SE w piwnicy: ściana monitorów CCTV, serwery Orbis Grid, przeciążony UPS `electric_field`, pancerne wyjście `doors[exit]`)* | `+10 .. +28` | `+16 .. +32` | `18 × 16 m`<br>(`288 m²`) | `-4.80 m` | `0.00 m`<br>(`H = 4.80 m`, `ceiling: true`) | **Błękit królewski** `#3d7bff` + **Zieleń** `#6dff4a` (portal `exit`) |

**Podsumowanie budżetu powierzchni i gwarancja widoczności na kamerach audytu (`10-top.png`, `08-high-west.png`, `09-high-east.png`):**
- **Dokładnie 15 pomieszczeń (`R1`..`R15`):** 1 duże centrum walki (`R2 Wielki Salon`, `704 m²` parteru + `168 m²` antresoli) oraz 14 małych i średnich pokoi (`140–336 m²`), każdy o unikalnej tożsamości wizualnej i taktycznej.
- **Obrys całkowity mapy:** `X ∈ [-30, +30]` (**`60.0 m` szerokości**), `Z ∈ [-42, +32]` (**`74.0 m` długości** — spełnia próg dużych aren `≥ 70 m`).
- **Łączna powierzchnia chodzenia (`walkable: true`):** Piwnica (`896 m²`) + Parter (`2 040 m²`) + Piętro z Antresolą Salonu (`1 464 m²`) + 4 dwubiegowe klatki schodowe ze spocznikami (`~160 m²`) = **`~4 560 m²`**.
- **Jak kamery `top`, `high-west` i `high-east` widzą jednocześnie wszystkie 3 kondygnacje (w tym Piwnicę):**
  - **Strefa `Z ∈ [+16, +32]` (`56 × 16 m`):** mieści Piwnicę (`y = -4.80 m`: `R13 Sala Tortur`, `R14 Winiarnia`, `R15 Bunkier Ochrony`). Nad nią nie ma płyt `walkable: true` Parteru ani Piętra — jedynie płyta stropowo-tarasowa ze świetlikami na `y = 0.00..0.40 m` z flagą `ceiling: true`, która jest automatycznie ukrywana przez `MapAuditScene.render()` dla kamer `top`, `high-west` i `high-east`!
  - **Strefa `Z ∈ [-18, +16]` (`60 × 34 m`):** mieści wszystkie 7 pomieszczeń Parteru (`y = 0.00 m`: `R1`..`R7`) oraz obwodową Antresolę Salonu (`R2-M` na `y = +4.80 m`, szer. `3.2 m`, która zostawia środek Salonu `X ∈ [-12.8, +12.8], Z ∈ [-14.8, +4.0]` całkowicie odsłonięty z góry). Stropy Parteru (`y = +4.80 m`) i wysoki dach Salonu (`y = +9.60 m`) mają `ceiling: true`, więc znikają w ujęciach z góry.
  - **Strefa `Z ∈ [-42, -18]` (`60 × 24 m`):** mieści wszystkie 5 pomieszczeń Piętra (`y = +4.80 m`: `R8`..`R12`). Ich dach na `y = +9.60 m` ma `ceiling: true`, co odsłania 100% Piętra wraz z Tablicą Śledczą „Iskra” w `R8`!

### 3.3. Rzuty wszystkich 3 kondygnacji i przekrój pionowy (ASCII)

#### A. Przekrój podłużny Północ–Południe (`X = 0 .. -6 m`, widok na Zachód `-X`) — kaskada 3 kondygnacji i las za oknami

```text
      PÓŁNOC (-Z, GĘSTY LAS, DESZCZ, LĄDOWISKO DRONA)                         POŁUDNIE (+Z, SKARPA LEŚNA)
Z=-42            Z=-30            Z=-18                  Z=0    Z=+4             Z=+16                 Z=+32
y=+9.6m +================+=============================================+ <-- Wysoki Dach Salonu R2 i Piętra L1 (ceiling:true)
        |  R11 SYPIALNIA |   R8 BIURO     # Antresola |                |
        |   PUŁKOWNIKA   |  PUŁKOWNIKA    # Salonu L1 |   R2 WIELKI    |
        |   I GARDEROBA  | [Tablica Iskra]| (y=+4.8m) |   SALON (H=9.6)|
y=+4.8m +================+================+===========+   / Schody     +=================+ <-- Strop Parteru L0 (ceiling:true)
        : [Podpory i     : [Wielka Dwukondygnacyjna   |  /  L0->L1     |  R1 HOL WEJŚC.  |
        :  skarpa leśna  :  Szklana Fasada Salonu     | +-[Spocznik]   |  (START GRACZA) |
y=+2.4m :  pod piętrem]  :  mat_glass_clear -> LAS!]  |/   (y=+2.4m)   |  [Winda Stop 1] |
        :                :                            |  [Kominek]     |  (doorSide:"N") |
y=0.0m  :                +============================+================+=====[ENTRY]=====+=================+ <-- Strop/Taras Piwnicy (ceiling:true)
                                                                       |  \ Schody L0->B | R13 SALA TORTUR |
y=-2.4m                                                                |   +-[Spocznik]  | R14 WINIARNIA   |
                                                                       |  /  (y=-2.4m)   | R15 BUNKIER     |
y=-4.8m                                                                +==[Winda Stop 0]=+======[EXIT]=====+ <-- Posadzka Piwnicy B (y=-4.80m)
       Z=-42            Z=-30            Z=-18                        Z=+4              Z=+16             Z=+32
```

#### B. Rzut Kondygnacji -1 — PIWNICA (`B`, `y = -4.80 m`, spoczniki `y = -2.40 m`, `X ∈ [-28, +28], Z ∈ [+16, +32]`)

```text
                         PÓŁNOC (-Z) — STYK ZE ŚCIANĄ OPOROWĄ PARTERU (Z = +16)
        X=-28                   X=-10     X=-8.4  X=-5.2  X=-1.3 X=+1.3  X=+5.2  X=+8.4     X=+10                   X=+28
Z=+16   +=======================+---------+-------+-------+==[=]==+-------+-------+---------+=======================+   Z=+16
        |                       |         ||Schody||      | WINDA |      ||Schody||         |                       |
        |          R13          |  Krata  ||Zach. ||      | Stop 0|      ||Wsch. ||         |          R15          |
        |     SALA TORTUR I     |  Celi   ||L0 -> ||      |y=-4.8m|      ||L0 -> ||         |   PODZIEMNY BUNKIER   |
        |      PRZESŁUCHAŃ      |         || -2.4m||      |door:S |      || -2.4m||         | OCHRONY I SERWEROWNIA |
        |     (18 x 16 m)       # Brama   +-------+       +-------+       +-------+  Brama  #     (18 x 16 m)       |
        |                       | R13/R14 |Spoczn.|   [Panel Windy B ▲]   |Spoczn.| R14/R15 |                       |
        |  [Lustro Weneckie]    |(Z=+20.. |y=-2.4m|                       |y=-2.4m|(Z=+20.. | [Ściana Monitorów     |
        |  [Konsole Nagrań]     |  +24)   +-------+          R14          +-------+  +24)   |  CCTV Lasu]           |
        |                       |         ||Bieg  ||  PRYWATNA WINIARNIA  ||Bieg  ||        |                       |
        |    [Lampa + Fotel     |         ||Dolny ||   I DEGUSTATORNIA    ||Dolny ||        | [Serwery Orbis EE-06] |
        |     z Pasami]         |         ||-4.8m ||     (20 x 16 m)      ||-4.8m ||        | [HAZARD: UPS Electric]|
        |    [Odpływ w Posadzce]|                         [Stół Degust.]                    |                       |
        |  [Stolik z Narzędz.   # Brama   [Regały Wina]   (Rocznik EE-07) [Beczki]   Brama  # [Stojaki Broni]       |
        |   i Dossier EE-05]    | R13/R14 S                                         R14/R15 S|                       |
        |  [Klatka Przetrzym.]  |(Z=+27..+30)         [Regały Wina Ściana S]      (Z=+27..+30)     [Śluza Tunelem]  |
Z=+32   +=======================+===========================================================+========[EXIT]=========+   Z=+32
        X=-28                   X=-10                        X=0                            X=+10    (X=+19, Z=+32.5)   X=+28
                     POŁUDNIE (+Z) — PODZIEMNY MUR OPOROWY I ŚLUZA EWAKUACYJNA (EXIT na y = -4.80 m)
```

#### C. Rzut Kondygnacji 0 — PARTER (`L0`, `y = 0.00 m`, `X ∈ [-30, +30], Z ∈ [-18, +16]`)

```text
                    PÓŁNOC (-Z) — WIELKIE DWUKONDYGNACYJNE PRZESZKLENIE SALONU NA LAS (mat_glass_clear)
        X=-30              X=-16     X=-15.2 X=-12.0              X=0              X=+12.0 X=+15.2     X=+16              X=+30
Z=-18   +==================+=========+=======+====================+====================+=======+=========+==================+   Z=-18
        |                  |         |                [Przeszklenie Północne 32 m na Las]                |                  |
        |        R4        # Brama   |  [Fortepian Holo]            [Kominek Kolumnowy]                  #        R5        |
        |    NOWOCZESNA    | R4<->R2 |                               res_fireplace_column                |   KRYTY BASEN    |
        |     KUCHNIA I    |(Z=-14.. |                                                                   |     I OGRÓD      |
        |    SPIŻARNIA     |  -10)   |                         R2                                        |     ZIMOWY       |
        |   (14 x 12 m)    |         |            WIELKI DWUKONDYGNACYJNY SALON                          |  (14 x 22 m)     |
        | [Wyspa Kuchenna] |         |         (CENTRUM WALKI: 32 x 22 m, H = 9.60 m)                    |                  |
        | [Lodówka EE-08]  |         |       +-------+                                 +-------+         | [Niecka Basenu   |
Z=-6    +-----+      +-----+         |       ||Schody||   [Strefa Wypoczynkowa:       ||Schody||         |  Podświetlona    |   Z=-6
        |    Brama R3/R4   |         |       ||Salon ||    Sofy L-Shape + Stoliki     ||Salon ||         |  #3d7bff]        |
        |   (X=-25..-21)   |         |       ||Zach. ||    Marmurowe + Dywan]         ||Wsch. ||         |                  |
        |        R3        # Brama   |       ||L0->L1||                               ||L0->L1||   Brama # [Leżanki Basen.] |
        |     JADALNIA     | R3<->R2 |       ||25.6° ||   [Tryptyk Ścienny EE-11]     ||25.6° || R2<->R5 | [Bambusy i Para] |
        | REPREZENTACYJNA  |(Z=-3..  |       +-------+                                 +-------+ (Z=-3.. | [Szklana Fasada E|
        |   (14 x 10 m)    |  +1)    |                                                           +1)     |  22 m na Las!]   |
        | [Stół 12-os.]    |         |                                                                   |                  |
Z=+4    +-----+      +-----+=========+======+             +===============+             +======+=========+-----+      +-----+   Z=+4
        |    Brama R3/R6   |                | Portal      | Portal Główny | Portal      |                |    Brama R5/R7   |
        |   (X=-25..-21)   |                | R6->R2      |   R1 <-> R2   | R7->R2      |                |   (X=+21..+25)   |
        |        R6        # Brama          | (X=-14..-10)|  (X=-5..+5,   | (X=+10..+14)|          Brama #        R7        |
        |  GARAŻ PANCERNY  | R6<->R1        |             |   szer. 10 m) |             |        R1<->R7 |  POKÓJ OCHRONY   |
        |    I WARSZTAT    |(Z=+8..+12)     |             |               |             |    (Z=+8..+12) |    PARTERU I     |
        |   (20 x 12 m)    |                |             |      R1       |             |                |   ZBROJOWNIA     |
        | [Pancerna Cyber- |                |  [Bonsai]   | HOL WEJŚCIOWY |  [Szatnia]  |                |   (20 x 12 m)    |
        |  Limuzyna Vane'a]|                |             |   I FOYER     |             |                | [Konsole Straży] |
        | [Ładowarka EV]   |                |             | (START 0,0,12)|             |                | [Szafy na Broń]  |
        | [Memo Run1 EE-01]|                | [Schody B-W]| [Winda Stop 1]| [Schody B-E]|                | [Laser Bramki]   |
Z=+16   +==================+================+===[ENTRY]===+=====[=]=======+=============+================+==================+   Z=+16
        X=-30              X=-16            X=-8.4  (X=-4,Z=16.5) X=0     X=+5.2        X=+16              X=+30
                     POŁUDNIE (+Z) — ZEJŚCIE SCHODAMI I WINDĄ DO PIWNICY (Z ∈ [+16, +32], y = -4.80 m)
```

#### D. Rzut Kondygnacji +1 — PIĘTRO I ANTRESOLA SALONU (`L1`, `y = +4.80 m`, `X ∈ [-30, +30], Z ∈ [-42, +4]`)

```text
                    PÓŁNOC (-Z) — PANORAMA KORON DRZEW, KSIĘŻYC I LĄDOWISKO DRONA H-06 ZA OKNAMI
               X=-30         X=-24                     X=+4                      X=+24         X=+30
Z=-42                         +=========================+=========================+                         Z=-42
                              |                         |                         |
                              |           R11           |           R12           |
                              |  SYPIALNIA PUŁKOWNIKA   |   PRYWATNE SPA, SAUNA   |
                              |      I GARDEROBA        #  I ŁAZIENKA MARMUROWA   |
                              |     (28 x 12 m)         |      (20 x 12 m)        |
                              | [Łoże King] [Garderoba  | [Wanna Kamienna] [Sauna |
                              |  Szklana + EE-02]       |  Cedrowa] [Umywalki LED]|
Z=-30   +=====================+-----+      +------+-----+-----+      +------+-----+=====================+   Z=-30
        |                           |Brama R9/R11 |           |Brama R8/R11 |     |Brama R10/R12        |
        |            R9             |(X=-18..-14) |           |(X=-4..0)    |     |(X=+14..+18)         |
        |   BIBLIOTEKA I ARCHIWUM   #             |    R8     |             #     |         R10         |
        |        PRYWATNE           |  Brama      |   BIURO   |             |Brama|   SALA TROFEÓW I    |
        |       (18 x 12 m)         |  R9<->R8    |PUŁKOWNIKA |             |R8/10|   KOLEKCJA OSTRZY   |
        | [Regały Książek EE-09]    |(Z=-26..-22) |(24 x 12 m)|             |(-26.|    (18 x 12 m)      |
        | [Holo-Globus] [Fotele]    |             |[Biurko EE4] [TABLICA    |.-22)| [Gablota Miry EE-10]|
        |                           |             |             ŚLEDCZA     |     | [Słoik X-51 EE-03]  |
        |                           |             |             „ISKRA”!]   |     | [Laser Zabezpieczeń]|
Z=-18   +==============+      +=====+===+      +==+===========+==+      +===+=====+      +==============+   Z=-18
                       |Brama R9->R2M   |  Brama R8 <-> R2-M     |   Brama R10->R2M      |
                       |(X=-15..-12)    |  (Przeszklona ścianka  |   (X=+12..+15)        |
                       |                |   z widokiem na Salon) |                       |
                       |   Galeria      +------------------------+      Galeria          |
                       |   Północna Antresoli Salonu R2-M (y = +4.80 m, Z ∈ [-18, -14.8])|
                       |   +-------+.........................................+-------+   |
                       |   ||Schody:                                         :Schody||   |
                       |   ||Zach. :        OTWARTA PUSTKA SALONU R2         :Wsch. ||   |
                       |   ||L0->L1:       (WIDOK W DÓŁ NA PARTER y=0.0m     :L0->L1||   |
                       |   +-------+        I PRZESZKLENIE NA LAS!)          +-------+   |
                       |   Galeria  :      (X ∈ [-12.8, +12.8],             : Galeria    |
                       |   Zach. L1 :       Z ∈ [-14.8, +4.0])              : Wsch. L1   |
                       |   (sz.3.2m):                                       : (sz.3.2m)  |
Z=+4                   +------------+.......................................+------------+                  Z=+4
                      X=-16       X=-12.8                                 X=+12.8      X=+16
                     POŁUDNIE (+Z) — WIDOK Z GÓRY NA CAŁY PARTER L0 (R1..R7) I PIWNICĘ B (R13..R15)!
```

### 3.4. Winda (`elevators[]`), schody między 3 kondygnacjami i przejścia — weryfikacja nawigacji 3D

#### A. Specyfikacja działającej windy piwnicznej (`elevators[0]`)

Winda znajduje się na styku Holu Wejściowego `R1` (`y = 0.00 m`) i Winiarni `R14` w Piwnicy (`y = -4.80 m`) w punkcie `(X = 0.0, Z = +15.0)`. Ponieważ na poziomie Parteru drzwi otwierają się na północ (`doorSide: "n"`, `Z = +13.7` — wprost na posadzkę Holu `R1`), a na poziomie Piwnicy otwierają się na południe (`doorSide: "s"`, `Z = +16.3` — wprost na posadzkę Winiarni `R14`), płyta Parteru (`Z ≤ +16`) nie zachodzi nad płytę Piwnicy (`Z ≥ +16`).

Konfiguracja obiektu w polu `elevators` w `src/data/rooms/run6.json` (zgodnie z `docs/systems/elevator.md` i `src/world/elevatorSchema.ts`):

```json
"elevators": [
  {
    "id": "cellar-interrogation-lift",
    "x": 0,
    "z": 15,
    "width": 2.6,
    "depth": 2.6,
    "startStop": 1,
    "model": "res_elevator_cab",
    "stops": [
      { "y": -4.8, "doorSide": "s" },
      { "y": 0.0, "doorSide": "n" }
    ]
  }
]
```

| Przystanek | Poziom `y` | Strona drzwi (`doorSide`) | Pozycja portalu `res_elevator_shaft_door` | Pozycja panelu wezwania `res_elevator_call_panel` | Dokąd wychodzi gracz i AI z kabiny |
|---|---|---|---|---|---|
| **Stop 0 — Piwnica (`B`)** | `y = -4.80 m` | `"s"` (`+Z`, `Z = +16.3 m`) | `(0.0, -4.8, +16.3)`, `yaw = 0` | `(+1.65, -4.8, +16.42)`, `yaw = 0` (przycisk **GÓRA `▲`** `#6dff4a`) | Centralna aleja Winiarni `R14` (`y = -4.80 m`), skąd na zachód prowadzi brama do Sali Tortur `R13`, a na wschód do Bunkra Ochrony `R15` i wyjścia `exit` |
| **Stop 1 — Parter (`L0`)** | `y = 0.00 m` | `"n"` (`-Z`, `Z = +13.7 m`) | `(0.0, 0.0, +13.7)`, `yaw = π` | `(-1.65, 0.0, +13.58)`, `yaw = π` (przycisk **DÓŁ `▼`** `#ffae1a`) | Hol Wejściowy `R1` (`y = 0.00 m`), na wprost 10-metrowego portalu do Wielkiego Salonu `R2` |

#### B. Tabela wszystkich 4 dwubiegowych klatek schodowych (`walkable: true`) i portali między 15 pokojami

Wszystkie 4 klatki schodowe mają czysty obrót `rotation.x`, kąt nachylenia **`25.64° ≤ 26.6°`**, szerokość **`3.20 m ≥ 2.0 m`** i prześwit nad każdym punktem biegu **`≥ 3.80 m`**:

| Połączenie / Klatka schodowa | Położenie w rzucie `[X, Z]` | Rzędne `y` | Wymiary i kąt nachylenia | Rola w przepływie walki i nawigacji AI |
|---|---|---|---|---|
| **Wejście `doors[entry]` → R1 (Hol Wejściowy)** | `X ∈ [-6, -2], Z = +16.5` | `y = 0.00 m` | `4.0 × 3.0 m` | Punkt wejścia gracza (`playerSpawn: (-4, 0, +12)` w Holu `R1`, na osi widoku przez portal do Salonu `R2` i lasu!) |
| **Klatka #1: Schody Piwniczne Zachodnie (`L0 ↔ B`)** | Bieg górny: `X ∈ [-8.4, -5.2], Z: +16.0 → +21.0`<br>Spocznik `MB0-W`: `X ∈ [-8.4, -5.2], Z ∈ [+21.0, +24.0]`<br>Bieg dolny: `X ∈ [-8.4, -5.2], Z: +24.0 → +29.0` | `0.00 → -2.40 → -4.80 m` | Szer. `3.2 m`, 2 biegi po `5.0 m`, kąt **`25.64°`** (`≤ 26.6°`) | Główne zachodnie zejście z Parteru (`R1`/`R6`) do Piwnicy (`R14`) tuż obok bramy do Sali Tortur `R13` |
| **Klatka #2: Schody Piwniczne Wschodnie (`L0 ↔ B`)** | Bieg górny: `X ∈ [+5.2, +8.4], Z: +16.0 → +21.0`<br>Spocznik `MB0-E`: `X ∈ [+5.2, +8.4], Z ∈ [+21.0, +24.0]`<br>Bieg dolny: `X ∈ [+5.2, +8.4], Z: +24.0 → +29.0` | `0.00 → -2.40 → -4.80 m` | Szer. `3.2 m`, 2 biegi po `5.0 m`, kąt **`25.64°`** (`≤ 26.6°`) | Symetryczne wschodnie zejście z Parteru (`R1`/`R7`) do Piwnicy (`R14`) tuż obok bramy do Bunkra `R15` |
| **Klatka #3: Schody Salonowe Zachodnie (`L0 ↔ L1`)** | Bieg dolny: `X ∈ [-15.2, -12.0], Z: -1.8 → -6.8`<br>Spocznik `M01-W`: `X ∈ [-15.2, -12.0], Z ∈ [-9.8, -6.8]`<br>Bieg górny: `X ∈ [-15.2, -12.0], Z: -9.8 → -14.8` | `0.00 → +2.40 → +4.80 m` | Szer. `3.2 m`, 2 biegi po `5.0 m`, kąt **`25.64°`** (`≤ 26.6°`) | Reprezentacyjne schody po zachodniej stronie Dwukondygnacyjnego Salonu `R2` prowadzące na Antresolę `R2-M`, skąd wchodzi się do Biblioteki `R9` i Biura `R8` |
| **Klatka #4: Schody Salonowe Wschodnie (`L0 ↔ L1`)** | Bieg dolny: `X ∈ [+12.0, +15.2], Z: -1.8 → -6.8`<br>Spocznik `M01-E`: `X ∈ [+12.0, +15.2], Z ∈ [-9.8, -6.8]`<br>Bieg górny: `X ∈ [+12.0, +15.2], Z: -9.8 → -14.8` | `0.00 → +2.40 → +4.80 m` | Szer. `3.2 m`, 2 biegi po `5.0 m`, kąt **`25.64°`** (`≤ 26.6°`) | Symetryczne reprezentacyjne schody po wschodniej stronie Salonu `R2` prowadzące na Antresolę `R2-M`, skąd wchodzi się do Sali Trofeów `R10` i Biura `R8` |
| **Portury drzwiowe między 15 pokojami (`res_interior_door_frame`)** | Wszystkie przejścia wewnętrzne na `B`, `L0` i `L1`:<br>• `L0`: `R1↔R2` (`10 m`), `R1↔R6`, `R1↔R7`, `R6↔R2`, `R7↔R2`, `R2↔R3`, `R2↔R4`, `R3↔R4`, `R3↔R6`, `R2↔R5`, `R5↔R7`<br>• `L1`: `R2-M↔R8`, `R2-M↔R9`, `R2-M↔R10`, `R8↔R9`, `R8↔R10`, `R8↔R11`, `R9↔R11`, `R8↔R12`, `R10↔R12`, `R11↔R12`<br>• `B`: `R14↔R13` (×2), `R14↔R15` (×2) | `-4.80 / 0.00 / +4.80 m` | Szerokość w świetle **`3.0–4.0 m`** (`≥ 2.0 m`), wys. `3.2 m` | Pełna drożność siatki `0.5 m` i pętlowe drogi flankowania między wszystkimi 15 pomieszczeniami |
| **Wyjście `doors[exit]` (południe `R15` w Piwnicy)** | `X ∈ [+17, +21], Z = +32.5` | `y = -4.80 m` (`pos.y = -3.30`) | `4.0 × 3.0 m` | Pancerna śluza podziemnego tunelu ewakuacyjnego w Bunkrze Ochrony `R15` |

### 3.5. Szczegółowy opis wszystkich 15 pomieszczeń — wyposażenie, osłony, linie strzału i rola w walce

#### 1. `R1` — Hol Wejściowy i Foyer z Szatnią (`L0`, `X ∈ [-10, +10], Z ∈ [+4, +16], y = 0.00 m`)
- **Tożsamość i klimat:** Monumentalny przedsionek rezydencji wyłożony polerowanym czarnym marmurem `res_nero_marble` i betonem architektonicznym `res_arch_concrete` z ukrytymi listwami LED w bursztynie (`#ffae1a`) i ciepłej bieli (`#fff1d6`).
- **Kadr startowy (`01-spawn.png` z `playerSpawn: (-4, 0, +12)`):**
  - Patrząc na północ (`-Z`), gracz widzi bramkę biometryczną `res_biometric_arch`, podświetlone drzewo bonsai na postumencie `res_bonsai_pedestal`, a przez szeroki na `10.0 m` portal (`X ∈ [-5, +5], Z = +4`) — pełne wnętrze **Wielkiego Dwukondygnacyjnego Salonu `R2`**, zawieszony kominek kolumnowy, antresolę na `y = +4.80 m`, przeszkloną ścianę Biura Pułkownika `R8` na piętrze oraz ścianę deszczowego lasu za północną fasadą!
- **Wyposażenie, osłony i komunikacja:**
  - W osi południowej `(X = 0, Z = +15.0)` znajduje się szyb działającej **Prywatnej Windy Piwnicznej `elevators[0]`** (`res_elevator_shaft_door`, `res_elevator_call_panel`), a po jego bokach (`X = -6.8` oraz `X = +6.8`) otwierają się górne biegi dwóch klatek schodowych do Piwnicy (**Klatka #1** i **Klatka #2**).
  - Przy ścianach bocznych stoją podświetlane szafy garderobiane `res_coat_closet`, konsola wejściowa `res_foyer_console` oraz 2 skrzynie `crate_small` do Chwytu Rezonansem.

#### 2. `R2` — Wielki Dwukondygnacyjny Salon z Antresolą i Panoramą Lasu (`L0 + L1`, `X ∈ [-16, +16], Z ∈ [-18, +4], y = 0.00..9.60 m`)
- **Tożsamość i rola jako CENTRUM WALKI (`704 m²` parteru + `168 m²` antresoli):** Jedyne duże pomieszczenie w całej rezydencji, wysokie na pełne dwie kondygnacje (`H = 9.60 m`). Posadzka z ciemnego orzecha `res_dark_walnut` z centralną wyspą dywanową `res_plush_carpet`, ściany z betonu `res_arch_concrete` i drewna.
- **Wielkie przeszklenie na las (`Z = -18, X ∈ [-16, +16], Y ∈ [0.0, 9.6]`):** Cała 32-metrowa ściana północna jest złożona z 8 dwukondygnacyjnych modułów szklanej fasady `res_forest_glass_facade` (`mat_glass_clear`). Tuż za szybą szumi w deszczu gęsty bór iglasto-liściasty, między pniami snuje się księżycowa mgła, świecą bursztynowe latarnie ogrodzenia, a co `12 s` przelatuje dron patrolowy ze szperaczem!
- **Wyposażenie, osłony i wertykalność:**
  - W północno-wschodniej strefie Salonu (`X = +4.5, Z = -11.5`): monumentalny, sięgający stropu `9.60 m` **Kominek Kolumnowy `res_fireplace_column`** (`2.8 × 9.6 × 1.8 m`) z trzaskającym bursztynowym płomieniem plazmowo-gazowym (`mat_neon_amber`) — niezniszczalny filar osłony blokujący linie strzału w poprzek sali.
  - W centrum (`X ∈ [-6, +2], Z ∈ [-9, -1]`): rozległa strefa wypoczynkowa z dwiema narożnymi sofami `res_luxury_sofa_l` (`3.8 × 0.95 × 2.4 m`), niskimi stolikami z czarnego marmuru `res_coffee_table_marble`, fotelami `res_lounge_armchair` i barkiem `res_whisky_bar_counter` — idealny układ średnich osłon do wymiany ognia, ślizgów (`slide`) i przeskoków (`dash`).
  - W narożniku północno-zachodnim (`X = -9.5, Z = -13.0`): **Fortepian Holograficzny `res_grand_piano_holo`** (`2.2 × 1.45 × 2.6 m`) z klawiaturą i strunami ze światła `#fff1d6` / `#ffae1a`.
  - Na ścianie południowej (`Z = +3.85, X = -8.5`): wielkoformatowy podświetlany obraz **Easter Egg #11 (`res_wall_art_triptych` + `res_ee_art_plaque`)**.
  - **Antresola/Galeria Salonu (`R2-M`, `y = +4.80 m`):** obiega Salon od zachodu (`X ∈ [-16.0, -12.8]`), północy (`Z ∈ [-18.0, -14.8]`) i wschodu (`X ∈ [+12.8, +16.0]`), zabezpieczona przezroczystą balustradą `res_glass_balustrade`. Na Antresolę prowadzą z posadzki Salonu dwie reprezentacyjne klatki schodowe (**Klatka #3** na zachodzie i **Klatka #4** na wschodzie). Strzelcy i snajperzy na Antresoli górują nad parterem Salonu, a gracz może zrzucać ich Pchnięciem Rezonansu przez szklane barierki!

#### 3. `R3` — Jadalnia Reprezentacyjna „Stół Koalicji” (`L0`, `X ∈ [-30, -16], Z ∈ [-6, +4], y = 0.00 m`)
- **Tożsamość i rola w walce (`140 m²`):** Elegancka sala bankietowa po zachodniej stronie Salonu, z zachodnim oknem panoramicznym (`X = -30`) wychodzącym na las.
- **Wyposażenie i osłony:**
  - W centrum (`X = -23.0, Z = -1.0`): długi na `5.2 m` **Stół Jadalniany z Marmuru i Orzecha `res_dining_table_long`** (`2.0 × 1.05 × 5.2 m`) otoczony 10 krzesłami `res_dining_chair`, nad którym wisi liniowy żyrandol `res_chandelier_linear` (`mat_light_panel`).
  - Przy ścianie wschodniej (`X = -16.8`): długi kredens `res_dining_credenza` z karafkami i zastawą. Walka toczy się wokół centralnej wyspy stołu, z przelotowymi bramami do Salonu `R2`, Kuchni `R4` i Garażu `R6`.

#### 4. `R4` — Nowoczesna Kuchnia i Spiżarnia Szefa Kuchni (`L0`, `X ∈ [-30, -16], Z ∈ [-18, -6], y = 0.00 m`)
- **Tożsamość i rola w walce (`168 m²`):** Ultranowoczesna kuchnia gastronomiczna w czarnym marmurze `res_nero_marble` i szczotkowanej stali `metal`, z narożnym przeszkleniem północno-zachodnim (`Z = -18, X = -30`) na mokre sosny.
- **Wyposażenie i osłony (CQB):**
  - Na środku (`X = -23.0, Z = -12.0`): masywna **Wyspa Kuchenna z Płytą Teppanyaki i Okapem `res_kitchen_island`** (`3.8 × 1.15 × 1.6 m`) — twarda osłona w centrum pokoju.
  - Przy ścianie wschodniej i południowej: zabudowa szafek i piekarników `res_kitchen_cabinet_bank`, regał z ziołami hydroponicznymi (`mat_neon_green`) oraz dwudrzwiowa **Inteligentna Lodówka `res_smart_fridge`** (`1.6 × 2.2 × 0.95 m`) z przyklejoną na drzwiach notatką **Easter Egg #8 (`res_ee_kitchen_notes.webp` — kod `0451` i synt-kofeina z 61. piętra)**.

#### 5. `R5` — Kryty Basen i Ogród Zimowy „Pawilon Deszczu” (`L0`, `X ∈ [+16, +30], Z ∈ [-18, +4], y = 0.00 m`)
- **Tożsamość i rola w walce (`308 m²`):** Przeszklony pawilon rekreacyjny po wschodniej stronie Salonu. Zarówno ściana północna (`Z = -18`), jak i cała 22-metrowa ściana wschodnia (`X = +30`) to okna `res_forest_glass_facade` wychodzące bezpośrednio na las i ogrodzenie posesji.
- **Wyposażenie i osłony:**
  - W centrum (`X ∈ [+20, +26], Z ∈ [-14, 0]`): podświetlona błękitem królewskim (`#3d7bff`) **Niecka Krytego Basenu `res_indoor_pool_basin`** (`6.0 × 0.45 × 14.0 m`, przykryta hartowanymi płytami szklanymi i płytką warstwą wody z `walkable: true`, dzięki czemu gracz i AI mogą przebiegać przez lustro wody, wzbijając parę `ambientFx: steam`!).
  - Wokół basenu rozstawione są profilowane **Leżanki Basenowe `res_pool_lounger`**, wysokie donice z bambusem i paprociami `res_winter_garden_planter` (dające twardą osłonę wzdłuż okien) oraz rzeźbiona fontanna kaskadowa `res_zen_water_wall` przy ścianie zachodniej.

#### 6. `R6` — Garaż Pancerny i Warsztat Pojazdowy (`L0`, `X ∈ [-30, -10], Z ∈ [+4, +16], y = 0.00 m`)
- **Tożsamość i rola w walce (`240 m²`):** Południowo-zachodnie skrzydło parteru z posadzką epoksydowo-betonową i pancerną bramą wjazdową od zachodu.
- **Wyposażenie, osłony i hazard:**
  - W centrum garażu (`X = -20.0, Z = +10.0`): zaparkowana **Pancerna Cyber-Limuzyna Pułkownika `res_armored_limo`** (`5.4 × 1.65 × 2.3 m`) w czarnym matowym lakierze z bursztynowymi listwami DRL — dominująca bryła osłony w środku pomieszczenia.
  - Obok samochodu stoi kolumna szybkiego ładowania `res_ev_charger_pillar` (`(-23.5, 0, +13.5)`), wzdłuż ściany północnej tablica narzędziowa `res_garage_tool_wall` z oprawionym raportem **Easter Egg #1 (`res_ee_run1_forklift_memo.webp` — wspomnienie magazynu `run1`)**, a w narożniku `(-27.5, 0, +6.5)` **Hazard #1 (`explosive_barrel`, `id: "garage-fuel-cell"`)** — ogniwo paliwowe do wysadzenia strzałem.

#### 7. `R7` — Pokój Ochrony Parteru i Zbrojownia Straży (`L0`, `X ∈ [+10, +30], Z ∈ [+4, +16], y = 0.00 m`)
- **Tożsamość i rola w walce (`240 m²`):** Taktyczna dyżurka garnizonu Kurogane strzegącego rezydencji, położona między Holem `R1`, Basenem `R5` i wschodnim zejściem do Piwnicy.
- **Wyposażenie, osłony i hazard:**
  - W centrum (`X = +20.0, Z = +10.0`): półokrągły **Pulpit Monitoringu Obwodowego `res_security_console`** (`3.2 × 1.35 × 1.4 m`) z mapą radarową lasu (`mat_screen_res_radar`) i kubkiem **Easter Egg #12 (`label_residence_mug`)**.
  - Przy ścianie południowej i wschodniej: 3 pancerne **Szafy Zbrojowni Taktycznej `res_tactical_gun_cabinet`** (`2.2 × 2.2 × 0.8 m`) oraz stojak ładujący drony patrolowe `res_drone_charging_dock`.
  - **Hazard #2 (`laser_gate`, `id: "guardroom-armory-laser"`):** bramka laserowa zabezpieczająca wschodni przedział zbrojowni na `X = +24.0` (`from: (24.0, 0.85, 6.0), to: (24.0, 0.85, 14.0)`, `cycle: { onS: 2.5, offS: 1.8 }`).

#### 8. `R8` — Biuro Pułkownika Vane'a „Gabinet Egzekutora” (`L1`, `X ∈ [-12, +12], Z ∈ [-30, -18], y = +4.80 m`)
- **Tożsamość i rola fabularno-taktyczna (`288 m²`):** Centralne pomieszczenie Piętra `L1`, połączone bezpośrednio z Północną Antresolą Salonu (`R2-M`) przeszkloną ścianą działową (`Z = -18`) z szerokim portalem. Z Biura widać z góry cały Dwukondygnacyjny Salon `R2` oraz północny las za szybami!
- **TABLICA ŚLEDCZA „OPERACJA ISKRA” (`res_investigation_board_iskra`):**
  - Zamontowana na centralnym filarze/ścianie gabinetu (`X = 0.0, Y = 5.85, Z = -29.8`, oświetlona dedykowaną listwą `mat_light_panel` i punktowym światłem `#ffae1a`):
  - Szeroka na `3.20 m` tablica śledcza z teksturą `decals/res_iskra_investigation_board.webp` (`1024×512`), na której przypięto:
    1. **Plan nieczynnej stacji metra „Kamienna”** (kryjówki ruchu oporu **„Iskra”** z `docs/gdd.md` i `npcs.pl.json`) z zaznaczonymi tunelami technicznymi i znakami zapytania przy wejściach,
    2. **List gończy i zdjęcia operacyjne głównego bohatera („CEL PRIORYTETOWY: KURIER // REZONANT”)** — kadr z kamery bezpieczeństwa ukazujący sylwetkę gracza w ślizgu z ostrzem plazmowym, wykres sygnatury kory ruchowej i adnotację Pułkownika Vane'a: *„Przeżył Kordon Zero (X-51) i Piętro 62. Złapać przed ewakuacją Kamiennej!”*,
    3. **Fotografie i powiązania członków „Iskry”:** *Doktor Wolan* (powiązana z listą projektu „Akord”), *Mira* (warsztat broni), *Szron* (taktyka), *Bajt* (włamania Orbis Grid),
    4. **Nitki śledcze:** rozpięte w geometrii 3D i na teksturze wyłącznie w kolorach **bursztynowo-złotym (`#ffae1a` / `mat_neon_amber`)**, **ciepłej bieli (`#fff1d6` / `mat_light_panel`)** i **zieleni (`#6dff4a`)** — **ZERO CZERWIENI!**
- **Pozostałe wyposażenie i osłony:**
  - Przed tablicą (`X = 0.0, Z = -24.5`): monumentalne **Biurko Pułkownika Vane'a `res_colonel_desk`** (`3.0 × 1.15 × 1.35 m`) z betonu, czarnego marmuru i orzecha, na którym leży faktura z 62. piętra **Easter Egg #4 (`res_ee_run4_penthouse_invoice.webp`)** oraz kubek **EE-12**.
  - Po bokach gabinetu: skórzano-grafitowe fotele `res_lounge_armchair`, pancerne sejfy akt `lab_classified_cabinet` i hologram taktyczny sektora leśnego.

#### 9. `R9` — Biblioteka i Archiwum Prywatne (`L1`, `X ∈ [-30, -12], Z ∈ [-30, -18], y = +4.80 m`)
- **Tożsamość i rola w walce (`216 m²`):** Zachodnie skrzydło piętra z oknem na las (`X = -30`), utrzymane w ciemnym orzechu `res_dark_walnut` i dywanie `res_plush_carpet`.
- **Wyposażenie i osłony:**
  - 4 wysokie, podświetlane ciepłą bielą i bursztynem **Regały Biblioteczne `res_bookshelf_wall`** (`3.2 × 2.8 × 0.75 m`) ustawione zarówno przy ścianach, jak i w formie dwóch wolnostojących przegród na środku pokoju (`X = -21.0, Z = -21.5` oraz `Z = -26.5`) — tworzą labirynt do walki na krótkim dystansie i parowania ostrzem.
  - W centrum (`X = -25.0, Z = -24.0`): podświetlany **Holo-Globus Neo-Ryd `res_holo_globe_stand`** (`1.4 × 1.6 × 1.4 m`), stolik czytelniczy z otwartymi księgami **Easter Egg #9 (`res_ee_colonel_book_titles.webp`)** oraz fotele `res_lounge_armchair`.

#### 10. `R10` — Sala Trofeów i Kolekcja Ostrzy „Sanktuarium Kurogane” (`L1`, `X ∈ [+12, +30], Z ∈ [-30, -18], y = +4.80 m`)
- **Tożsamość i rola w walce (`216 m²`):** Prywatne muzeum zbrojeniowe Pułkownika Vane'a we wschodnim skrzydle piętra, wyłożone czarnym marmurem `res_nero_marble` i rozświetlone fioletem (`#8a5cff`) oraz bursztynem (`#ffae1a`).
- **Wyposażenie, easter eggi i hazard:**
  - Wzdłuż ścian i w osi środkowej stoją 4 wysokie **Gabloty Trofeów `res_trophy_case_tall`** (`2.4 × 2.4 × 0.85 m`), 2 postumenty z pamiątkowymi ostrzami `res_blade_display_pedestal` (`1.2 × 1.45 × 1.2 m`) oraz centralny **Stojak Pancerza Egzekutora `res_armor_display_stand`** (`1.6 × 2.35 × 1.2 m`).
  - W gablocie zachodniej (`X = +16.5, Z = -24.0`) spoczywa **Easter Egg #10 (`res_ee_mira_blade_trophy.webp` — skonfiskowana rękojeść z warsztatu Miry na stacji Kamienna)**, a w gablocie wschodniej (`X = +25.5, Z = -24.0`) **Easter Egg #3 (`res_ee_x51_specimen_jar.glb` + `res_ee_run3_cocoon04_alert.webp` — próbka ze Zbiornika nr 04 z Sektora X-51)**.
  - **Hazard #3 (`laser_gate`, `id: "trophy-room-security-laser"`):** bramka laserowa chroniąca centralny stojak pancerza na `Z = -24.0` (`from: (18.5, 5.65, -24.0), to: (23.5, 5.65, -24.0)`, `cycle: { onS: 2.2, offS: 1.6 }`).

#### 11. `R11` — Sypialnia Pułkownika i Garderoba „Apartament Główny” (`L1`, `X ∈ [-24, +4], Z ∈ [-42, -30], y = +4.80 m`)
- **Tożsamość i rola w walce (`336 m²`):** Północno-zachodni narożnik Piętra `L1` z pełnym przeszkleniem 180° (`Z = -42` oraz `X = -24`) wychodzącym na korony sosen i oświetlone w oddali **Lądowisko Drona `H-06`**.
- **Wyposażenie i osłony:**
  - W części zachodniej (`X = -14.0, Z = -36.0`): szerokie **Łoże Platformowe King-Size `res_master_bed_king`** (`2.8 × 1.25 × 2.6 m`) z tapicerowanym zagłówkiem akustycznym, szafkami nocnymi i dolną listwą `mat_light_panel` — duża niska/średnia osłona w centrum sypialni.
  - W części wschodniej (`X ∈ [-4, +3], Z ∈ [-41, -31]`): wydzielona przeszklonymi ściankami **Garderoba Walk-In `res_wardrobe_glass`** (`3.2 × 2.4 × 0.85 m` ×2) z mundurami Pułkownika oraz gablotą zegarków **Easter Egg #2 (`res_luxury_watch_case.glb` + `res_ee_run2_atrium_vip.webp` — zakupy z galerii Atrium Nova `run2`)**.

#### 12. `R12` — Prywatne Spa, Sauna i Łazienka Marmurowa (`L1`, `X ∈ [+4, +24], Z ∈ [-42, -30], y = +4.80 m`)
- **Tożsamość i rola w walce (`240 m²`):** Północno-wschodni apartament kąpielowy z czarnym marmurem `res_nero_marble`, podświetleniem w błękicie królewskim (`#3d7bff`) i ciepłej bieli (`#fff1d6`) oraz północnym oknem na las (`Z = -42`).
- **Wyposażenie i osłony:**
  - Przed panoramicznym oknem północnym (`X = +14.0, Z = -39.0`): monolityczna **Wolnostojąca Wanna Kamienna `res_freestanding_tub`** (`2.2 × 0.85 × 1.2 m`) z parującą wodą (`ambientFx: steam`).
  - Przy ścianie południowej (`Z = -31.0`): podwójna konsola umywalkowa z lustrem LED `res_marble_vanity` (`2.8 × 2.1 × 0.75 m`), a w narożniku południowo-wschodnim (`X = +21.0, Z = -33.5`): przeszklona **Kabina Sauny Cedrowej `res_sauna_cabin`** (`2.8 × 2.4 × 2.2 m`) z ciepłym bursztynowym podświetleniem ław (`mat_neon_amber`).

#### 13. `R13` — Sala Tortur i Przesłuchań „Komora Wydobywania Danych” (`Piwnica B`, `X ∈ [-28, -10], Z ∈ [+16, +32], y = -4.80 m`)
- **Tożsamość i klimat grozy (bez dosłownej makabry, `288 m²`):** Surowy, dźwiękoszczelny bunkier w południowo-zachodniej części piwnicy (`lab_bunker_concrete` / `res_arch_concrete`, zimna posadzka z kanałami odwadniającymi). Kontrastuje z luksusem górnych pięter — to tutaj Pułkownik Vane łamie opór zatrzymanych członków podziemia.
- **Kluczowe rekwizyty budujące klimat grozy:**
  - W geometrycznym centrum pod pojedynczą, nisko zawieszoną **Lampą Przesłuchań `res_interrogation_lamp`** (`(-19.0, -1.6, +24.0)`, zimno-biały dyfuzor `mat_light_panel` bez stożka bloomu): ciężki, stalowo-skórzany **Fotel Przesłuchań z Pasami i Zaciskami `res_interrogation_chair`** (`1.25 × 1.45 × 1.35 m`, na `(-19.0, -4.8, +24.0)`), lekko skręcony pod kątem, z rozpiętymi klamrami na podłokietnikach i zagłówku.
  - Bezpośrednio pod fotelem w betonowej posadzce: **Krata Odpływowa `res_floor_drain_grate`** (`1.4 × 0.06 × 1.4 m`) oraz ciemne, zmyte ślady wody na betonie (`decal` `puddle2` / `res_drain_stain` — czysta sugestia psychologiczna, zero krwi i zero czerwieni!).
  - Obok fotela (`(-16.2, -4.8, +24.0)`): stalowy **Stolik z Narzędziami Ekstrakcji i Neuro-Sondami `res_instrument_trolley`** (`1.4 × 1.05 × 0.75 m`), na którym obok zacisków, strzykawek i kamertonu neuralnego leży teczka **Easter Egg #5 (`res_ee_helixa_akord_dossier.webp` — dostawa z przychodni Helixa na Bulwarze)**.
  - Wzdłuż ściany południowej (`Z = +29.5, X ∈ [-26, -14]`): wydzielona stalowymi prętami **Klatka Przetrzymywania `res_holding_cage_bars`** (`4.0 × 3.4 × 0.22 m` ×3) z pryczą i zgaszonym terminalem.
  - Na ścianie zachodniej (`X = -27.8, Z = +24.0`): **Lustro Weneckie `res_oneway_mirror`** (`3.2 × 2.0 × 0.18 m`) oraz **Konsola Nagrań Przesłuchań `res_recording_console`** (`2.4 × 1.25 × 0.9 m`) z obracającymi się szpulami taśm magnetycznych, oscyloskopem głosu (`mat_screen_res_audio_wave`) i katalogiem kaset podpisanych kryptonimami agentów „Iskry”.

#### 14. `R14` — Prywatna Winiarnia i Degustatornia „Krypta Roczników” (`Piwnica B`, `X ∈ [-10, +10], Z ∈ [+16, +32], y = -4.80 m`)
- **Tożsamość i rola w walce (`320 m²`):** Centralny węzeł Piwnicy łączący dolny przystanek **Windy `elevators[0]`** (`X = 0, Z = +16.3`) oraz oba dolne biegi schodów (**Klatka #1** i **Klatka #2**) z Salą Tortur `R13` na zachodzie i Bunkrem Ochrony `R15` na wschodzie.
- **Wyposażenie i osłony:**
  - W centrum (`X = 0.0, Z = +24.5`): kamienno-dębowy **Stół Degustacyjny `res_tasting_island`** (`3.4 × 1.10 × 1.6 m`) z kieliszkami, dekanterem i butelką **Easter Egg #7 (`res_ee_vintage_2048_wine.webp` — „Château Kurogane 2048”)**.
  - Wzdłuż ścian i w niszach między schodami: podświetlone bursztynowym światłem (`#ffae1a`) **Ścienne Regały na Wino `res_wine_rack_wall`** (`3.2 × 2.8 × 0.65 m` ×4) oraz **Leżnie Dębowych Beczek `res_wine_barrel_rack`** (`2.4 × 1.65 × 1.1 m` ×4) dające gęste osłony przed ostrzałem z obu skrzydeł piwnicy.

#### 15. `R15` — Podziemny Bunkier Ochrony, Serwerownia i Śluza Ewakuacyjna (`Piwnica B`, `X ∈ [+10, +28], Z ∈ [+16, +32], y = -4.80 m`)
- **Tożsamość i finałowe starcie (`288 m²`):** Pancerny węzeł dowodzenia obroną rezydencji we wschodniej części piwnicy, gdzie znajduje się śluza wyjściowa `doors[exit]` (`X = +19.0, Y = -3.30, Z = +32.5`).
- **Wyposażenie, osłony i hazardy:**
  - Na ścianie wschodniej (`X = +27.8, Z = +22.0`): wielka **Ściana Monitorów CCTV `res_cctv_monitor_wall`** (`4.0 × 2.4 × 0.25 m`) pokazująca podgląd na żywo z kamer w lesie, Sali Tortur i Salonie, a obok niej szafy serwerowe z komunikatem **Easter Egg #6 (`res_ee_orbis_grid_firewall.webp` — alarm o włamaniu Bajta do sieci Orbis Grid)**.
  - W centrum pokoju dwa rzędy konsol `res_security_console` i szaf serwerowych tworzących szykanę przed wyjściem `exit`.
  - **Hazard #4 (`electric_field`, `id: "bunker-ups-discharge"`):** przeciążony transformator UPS w serwerowni na `(X = +23.5, Y = -3.80, Z = +25.0)` (`spód na y = -4.80 m`, `size: (2.8, 2.0, 3.0)`, `cycle: { onS: 3.0, offS: 2.2 }`) + **Hazard #5 (`explosive_barrel`, `id: "bunker-coolant-cell"`):** zbiornik chłodziwa na `(+14.0, -4.80, +29.5)`.

---

## 4. Katalog zasobów: 38 nowych modeli `res_*`, 32 tekstury, tablica „Iskry” i 12 Easter Eggów

### 4.1. Nowe modele 3D (`tools/blender/sets/kurogane_residence.py` → `public/assets/models/city/res_*.glb`)

Zestaw obejmuje **38 własnych modeli proceduralnych** w Blenderze z prefiksem **`res_`** (wymóg briefu: `≥ 35` modeli). Wszystkie modele stosują konwencje z `docs/assets.md`:
- Jednostki: metry, układ glTF Y-up, przód w `+Z`, spód na `Y = 0` (dla modeli sufitowych wieszaki sięgają górnego AABB do styku `ceilingContact` w `mapAudit.ts`).
- Cieniowanie płaskie (flat low-poly) z fazowanymi krawędziami, jedna scalona siatka na materiał (`_city_merge_details`), brak wbudowanych obrazów w GLB (`material.map` puste — nadruki UV przez `mat_label_*` i `mat_screen_*`).
- **Rygor materiałów:** duże białe powierzchnie świecące używają wyłącznie **`mat_light_panel`** (`#fff1d6` bez selektywnego bloomu). Szyby fasadowe, balustrady i gabloty używają **`mat_glass_clear`** (`opacity: 0.22`, dwustronny). Zero kolorów zakazanych (`czerwień`, `cyan`, `magenta`).

#### Tabela 1: Modele architektury willi, przeszkleń na las, windy, oświetlenia i ogrodu zimowego — 12 modeli (`res_01`..`res_12`)

| Lp. | Model (`.glb`) | Wymiary AABB `X × Y × Z` [m] | Gdzie stoi (pomieszczenia) | Czy jest osłoną / kolizja | Opis geometrii, sylwetki i materiałów (`mat_*`) | Budżet tri |
|---:|---|---|---|---|---|---:|
| 1 | `res_forest_glass_facade` | `4.00 × 4.80 × 0.36` | `R2` (Salon — 2 piętra), `R3` (Jadalnia), `R4` (Kuchnia), `R5` (Basen), `R8` (Biuro), `R9` (Biblioteka), `R11` (Sypialnia), `R12` (Spa) | **Ściana zewnętrzna** (`decor` `WALL_FIXTURES` + blok kolizji `4.0 × 4.8 × 0.32 m`, `material: "glass_clear"`, `visible: false`) | **Moduł panoramicznej fasady szklanej willi z widokiem na las:** czarne, anodowane słupki stalowe (`mat_lacquer`, `mat_metal`), dolny konwektor podłogowy z drewnianą kratką (`mat_wood`, listwa `mat_light_panel`), górna belka z ukrytym podświetleniem `mat_neon_amber` oraz wielka, bezszwowa tafla przezroczystego szkła `mat_glass_clear`. | ≤ 380 |
| 2 | `res_interior_door_frame` | `4.00 × 3.60 × 0.28` | Wszystkie przejścia wewnętrzne między `R1`..`R15` | **Portal przejściowy** (`decor` `WALL_FIXTURES`, `PASSAGE_FIXTURES` + 2 boczne kolidery ościeży `0.5 × 3.6 × 0.28 m` poza światłem `3.0 m`) | **Nowoczesny portal drzwiowy rezydencji (otwarty):** ościeżnica z ciemnego orzecha i czarnego metalu (`mat_wood`, `mat_lacquer`), wsunięte w kieszenie boczne skrzydła ze szkła i drewna (`mat_glass_clear`, `mat_metal`) oraz górna listwa statusu strefy (`mat_light_panel`). | ≤ 420 |
| 3 | `res_glass_balustrade` | `4.00 × 1.10 × 0.16` | `R2-M` (Antresola Salonu), spoczniki Klatek #1–#4 | **Niska osłona krawędzi (`wys. 1.10 m`)** — `blok` (`size: 4.0 × 1.1 × 0.16 m`, `instance: true`) | **Szklana balustrada antresoli i schodów:** dolna szyna z czarnej stali z wpuszczonym paskiem LED (`mat_lacquer`, `mat_light_panel`), przezroczyste tafle `mat_glass_clear` i profilowana poręcz z ciemnego orzecha (`mat_wood`). | ≤ 260 |
| 4 | `res_elevator_cab` | `2.60 × 3.00 × 2.60` | Szyb windy `elevators[0]` między `R1` (`y = 0.0 m`) a `R14` (`y = -4.8 m`) | **Kabina windy** przypięta do kinematycznej platformy `elevators[0]` | **Prywatna kabina windy rezydencji:** wykończenie z czarnego marmuru, szczotkowanego mosiądzu i ciemnego orzecha (`mat_lacquer`, `mat_wood`, `mat_metal`), sufit `mat_light_panel`, przeszklone boki `mat_glass_clear` oraz panel z przyciskami **GÓRA `▲` (`mat_neon_green`) / DÓŁ `▼` (`mat_neon_amber`)**. | ≤ 860 |
| 5 | `res_elevator_shaft_door` | `3.20 × 3.20 × 0.34` | `R1` (Hol `y = 0.0 m`), `R14` (Winiarnia `y = -4.8 m`) | **Portal szybu windy** (`decor` `WALL_FIXTURES`, `PASSAGE_FIXTURES` + boczne kolidery ościeży) | **Portal drzwi szybowych windy piwnicznej:** portal z betonu architektonicznego i czarnej stali (`mat_metal`, `mat_lacquer`), przeszklone skrzydła `mat_glass_clear` i wyświetlacz kondygnacji `L0 / B1` (`mat_neon_amber`). | ≤ 480 |
| 6 | `res_elevator_call_panel` | `0.42 × 1.40 × 0.20` | `R1` (`y = 0.0 m`), `R14` (`y = -4.8 m`) | **Panel interakcji** (`decor` `WALL_FIXTURES`, brak blokowania ruchu) | **Pylon wezwania windy rezydencji:** smukły panel z czarnego szkła i mosiądzu (`mat_lacquer`, `mat_metal`) z ekranem `mat_screen_status` i podświetlonymi przyciskami `▲` (`mat_neon_green`) oraz `▼` (`mat_neon_amber`). | ≤ 320 |
| 7 | `res_fireplace_column` | `2.80 × 9.60 × 1.80` | `R2` (Wielki Salon — północny wschód) | **Pełna wysoka osłona (filar)** — `blok` (`size: 2.8 × 9.6 × 1.8 m`) | **Monumentalny dwukondygnacyjny kominek kolumnowy:** monolityczny komin z ryflowanego betonu i czarnej stali (`mat_concrete`, `mat_lacquer`, `mat_metal`) sięgający od posadzki `0.0 m` do stropu `9.6 m`, przeszklone z trzech stron palenisko (`y = 0.55..1.65 m`, `mat_glass_clear`) z geometrycznymi szczapami i płomieniami w barwie bursztynu (`mat_neon_amber`, `mat_light_panel`). | ≤ 940 |
| 8 | `res_chandelier_linear` | `3.60 × 0.45 × 0.90` | `R2` (Salon), `R3` (Jadalnia), `R8` (Biuro), `R10` (Sala Trofeów) | **Oprawa sufitowa** (`decor` `CEILING_FIXTURES`, brak kolizji) | **Nowoczesny żyrandol liniowy z pierścieniami LED:** zawieszona na cienkich linkach kompozycja z czarnego metalu i mosiądzu (`mat_lacquer`, `mat_metal`) z dyfuzorami **`mat_light_panel`** oraz akcentem `mat_neon_amber` (zero smug bloomu!). | ≤ 380 |
| 9 | `res_recessed_led_strip` | `3.00 × 0.25 × 0.40` | Wszystkie 15 pomieszczeń (`R1`..`R15`) | **Oprawa sufitowa** (`decor` `CEILING_FIXTURES`, brak kolizji) | **Wpuszczana oprawa sufitowa LED:** grafitowy profil architektoniczny (`mat_trim`) z mlecznym dyfuzorem **`mat_light_panel`**. | ≤ 180 |
| 10 | `res_indoor_pool_basin` | `6.00 × 0.45 × 14.00` | `R5` (Kryty Basen i Ogród Zimowy) | **Niski podest / lustro wody (`walkable: true`)** — `blok` (`size: 6.0 × 0.45 × 14.0 m`, `walkable: true`) | **Podświetlona niecka krytego basenu:** niska kamienna cembrowina z czarnego marmuru (`mat_lacquer`, `mat_trim`) z szerokimi stopniami zejściowymi, wewnątrz tafla przezroczystego szkła i wody (`mat_glass_clear`, `mat_neon_blue` `#3d7bff`) z liniami torów pływackich `mat_light_panel`. | ≤ 680 |
| 11 | `res_pool_lounger` | `0.95 × 0.85 × 2.10` | `R5` (Kryty Basen — wzdłuż wschodniego okna na las) | **Niska osłona w kucnięciu (`wys. 0.85 m`)** — `blok` (`size: 0.95 × 0.85 × 2.1 m`, `instance: true`) | **Designerska leżanka basenowa:** profilowany stelaż z ciemnego drewna tekowego i stali (`mat_wood`, `mat_metal`), grafitowy materac z zagłówkiem (`mat_fabric`) i stolik boczny na ręcznik. | ≤ 420 |
| 12 | `res_winter_garden_planter` | `2.60 × 1.65 × 1.00` | `R5` (Ogród Zimowy), `R2` (Salon), `R1` (Hol) | **Twarda średnia osłona (`wys. 1.65 m`)** — `blok` (`size: 2.6 × 1.65 × 1.0 m`, `instance: true`) | **Donica ogrodu zimowego z bambusem i paprociami:** betonowo-marmurowa skrzynia (`wys. 0.85 m`, `mat_lacquer`, listwa `mat_light_panel`), białe otoczaki i wysokie pędy czarnego bambusa oraz liści monstery (`mat_paint` `#385846` do `y = 1.65 m`). | ≤ 760 |

#### Tabela 2: Modele mebli Salonu (`R2`), Holu (`R1`), Jadalni (`R3`), Kuchni (`R4`), Garażu (`R6`) i Ochrony (`R7`) — 11 modeli (`res_13`..`res_23`)

| Lp. | Model (`.glb`) | Wymiary AABB `X × Y × Z` [m] | Gdzie stoi (pomieszczenia) | Czy jest osłoną / kolizja | Opis geometrii, sylwetki i materiałów (`mat_*`) | Budżet tri |
|---:|---|---|---|---|---|---:|
| 13 | `res_biometric_arch` | `3.40 × 2.70 × 1.20` | `R1` (Hol Wejściowy), `R8` (wejście do Biura Pułkownika) | **Portal kontrolny** (`decor` `PASSAGE_FIXTURES` + 2 boczne kolidery pylonów `0.45 × 2.7 × 1.2 m` poza prześwitem `2.5 m`) | **Bramka biometryczna rezydencji VIP:** dwa smukłe pylony z czarnego marmuru i mosiądzu (`mat_lacquer`, `mat_metal`), górna belka skanera Rezonansu z zielono-bursztynowym wskaźnikiem (`mat_neon_green`, `mat_neon_amber`). | ≤ 520 |
| 14 | `res_bonsai_pedestal` | `1.60 × 1.75 × 1.60` | `R1` (Hol Wejściowy), `R2` (Salon) | **Twarda osłona kolumnowa (`wys. 1.75 m`)** — `blok` (`size: 1.6 × 1.75 × 1.6 m`, `instance: true`) | **Postument z podświetlonym drzewem Bonsai:** monolityczny cokół z betonu i orzecha (`wys. 1.0 m`, `mat_wood`, `mat_lacquer`, pierścień `mat_neon_amber`), na nim stylizowane, rozłożyste drzewo bonsai z pokręconym pniem i geometryczną koroną igieł (`mat_paint` `#3c5c48`). | ≤ 820 |
| 15 | `res_luxury_sofa_l` | `3.80 × 0.95 × 2.40` | `R2` (Wielki Salon — 2 szt. w centrum), `R11` (Sypialnia) | **Średnia osłona (`wys. 0.95 m`, do kucnięcia i przeskoku)** — `blok` (`size: 3.8 × 0.95 × 2.4 m`, `instance: true`) | **Narożna sofa modułowa L-Shape:** niska podstawa z wędzonego orzecha z ukrytym podświetleniem `mat_light_panel`, głębokie pikowane siedziska i oparcia w ciemnym grafitowo-granatowym welurze (`mat_fabric` `#323c50`) z poduszkami i zintegrowaną półką boczną. | ≤ 780 |
| 16 | `res_coffee_table_marble` | `2.20 × 0.55 × 1.20` | `R2` (Wielki Salon), `R8` (Biuro), `R9` (Biblioteka) | **Niska przeszkoda (`wys. 0.55 m`)** — `blok` (`size: 2.2 × 0.55 × 1.2 m`, `instance: true`) | **Niski stolik kawowy z czarnego marmuru:** blok polerowanego kamienia (`mat_lacquer`, `mat_metal`) ze szczeliną świetlną `mat_neon_amber`, na blacie albumy o sztuce, karafka i taca. | ≤ 360 |
| 17 | `res_grand_piano_holo` | `2.20 × 1.45 × 2.60` | `R2` (Wielki Salon — narożnik NW przy szybie na las) | **Twarda osłona (`wys. 1.45 m`)** — `blok` (`size: 2.2 × 1.45 × 2.6 m`) | **Futurystyczny fortepian koncertowy z hologramem nut:** wygięty korpus z czarnego lakieru i szczotkowanego mosiądzu (`mat_lacquer`, `mat_metal`), uniesiona pokrywa z przezroczystego szkła `mat_glass_clear`, podświetlone struny i pulpit nutowy (`mat_neon_amber`, `mat_light_panel`) + ława pianisty. | ≤ 980 |
| 18 | `res_wall_art_triptych` | `3.60 × 1.80 × 0.16` | `R2` (Salon — EE-11), `R3` (Jadalnia), `R11` (Sypialnia) | **Obraz ścienny** (`decor` `WALL_FIXTURES`, montowany na `y = levelY + 1.2 m`) | **Podświetlany tryptyk malarski Neon Noir:** trzy geometryczne ramy z czarnego metalu (`mat_metal`, tylna poświata `mat_light_panel` / `mat_neon_amber`) przedstawiające abstrakcyjny nocny las i sylwetkę korporacyjnej wieży. | ≤ 340 |
| 19 | `res_dining_table_long` | `2.00 × 1.05 × 5.20` | `R3` (Jadalnia Reprezentacyjna) | **Duża centralna osłona (`wys. 1.05 m`)** — `blok` (`size: 2.0 × 1.05 × 5.2 m`) | **Długi 12-osobowy stół bankietowy z krzesłami:** dwie pełne kolumny cokołowe (`mat_lacquer`, `mat_metal`), blat z orzecha i czarnego marmuru z wpuszczonym pasem świetlnym `mat_light_panel`, zastawa stołowa oraz 10 wsuniętych krzeseł jadalnianych. | ≤ 1120 |
| 20 | `res_kitchen_island` | `3.80 × 1.15 × 1.60` | `R4` (Nowoczesna Kuchnia — centrum) | **Twarda osłona (`wys. 1.15 m`)** — `blok` (`size: 3.8 × 1.15 × 1.6 m`) | **Monolityczna wyspa kuchenna z płytą Teppanyaki:** korpus z czarnego marmuru i stali nierdzewnej (`mat_lacquer`, `mat_metal`), płyta indukcyjna z bursztynowymi polami grzewczymi (`mat_neon_amber`), zlew, stojak z nożami szefa kuchni i 3 hokery barowe. | ≤ 860 |
| 21 | `res_smart_fridge` | `1.60 × 2.20 × 0.95` | `R4` (Kuchnia — z notatką EE-08) | **Wysoka osłona (`wys. 2.20 m`)** — `blok` (`size: 1.6 × 2.2 × 0.95 m`) | **Dwudrzwiowa inteligentna chłodziarka rezydencji:** front ze szczotkowanej ciemnej stali (`mat_metal`, `mat_lacquer`), przeszklona komora wina `mat_glass_clear` (`mat_neon_amber`), wbudowany pionowy ekran dotykowy (`mat_screen_menu`) i dystrybutor lodu (`mat_neon_blue`). | ≤ 620 |
| 22 | `res_armored_limo` | `5.40 × 1.65 × 2.30` | `R6` (Garaż Pancerny — centrum) | **Główna twarda osłona w garażu (`wys. 1.65 m`)** — `blok` (`size: 5.4 × 1.65 × 2.3 m`) | **Pancerna cyber-limuzyna Pułkownika Vane'a:** niska, ostro fazowana sylwetka coupe/limuzyny Kurogane w grafitowo-czarnym pancerzu (`mat_lacquer`, `mat_metal`), przyciemniane szyby pancerne `mat_glass_clear`, przednie pasy świetlne `mat_light_panel` i tylna listwa w bursztynie `mat_neon_amber` (zero czerwieni!). | ≤ 1240 |
| 23 | `res_garage_tool_wall` | `3.40 × 2.20 × 0.45` | `R6` (Garaż Pancerny — z raportem EE-01) | **Zabudowa ścienna** (`decor` `WALL_FIXTURES` + blok stołu `3.4 × 1.0 × 0.5 m`) | **Warsztatowa ściana narzędziowa i stacja ładowania:** stalowy stół diagnostyczny, perforowana tablica z kluczami i częściami dronów (`mat_metal`, `mat_hivis`, `mat_neon_blue`) oraz terminal serwisowy `mat_screen_status`. | ≤ 680 |

#### Tabela 3: Modele Piętra (`R8` Biuro z Tablicą „Iskra”, `R9` Biblioteka, `R10` Sala Trofeów, `R11` Sypialnia, `R12` Spa) — 9 modeli (`res_24`..`res_32`)

| Lp. | Model (`.glb`) | Wymiary AABB `X × Y × Z` [m] | Gdzie stoi (pomieszczenia) | Czy jest osłoną / kolizja | Opis geometrii, sylwetki i materiałów (`mat_*`) | Budżet tri |
|---:|---|---|---|---|---|---:|
| 24 | `res_investigation_board_iskra` | `3.20 × 1.80 × 0.22` | `R8` (Biuro Pułkownika — główna ściana `Z = -29.8`) | **Tablica ścienna** (`decor` `WALL_FIXTURES`, montowana na `y = 5.85 m`) | **TABLICA ŚLEDCZA „OPERACJA ISKRA” I LIST GOŃCZY:** pancerna rama ze stali i orzecha (`mat_metal`, `mat_wood`) z górną listwą oświetleniową `mat_light_panel`, centralna mapa stacji metra **„Kamienna”** (`mat_screen_map`), przypięty list gończy ze zdjęciem sylwetki gracza (**„KURIER”**), fotografie członków „Iskry” (Wolan, Mira, Szron, Bajt), pinezki i **trójwymiarowe nitki łączące tropy w kolorach bursztynu (`mat_neon_amber`), ciepłej bieli (`mat_light_panel`) i zieleni (`mat_neon_green`) — ZERO CZERWIENI!** | ≤ 740 |
| 25 | `res_colonel_desk` | `3.00 × 1.15 × 1.35` | `R8` (Biuro Pułkownika — centrum przed tablicą) | **Twarda osłona (`wys. 1.15 m`)** — `blok` (`size: 3.0 × 1.15 × 1.35 m`) | **Biurko Pułkownika Kurogane Arms (z EE-04 i EE-12):** monolityczny wspornikowy korpus z betonu architektonicznego, ciemnego orzecha i mosiądzu (`mat_wood`, `mat_lacquer`, listwa `mat_neon_amber`), potrójny zakrzywiony monitor taktyczny (`mat_screen_res_radar`), stojak na pamiątkowy sztylet, teczki `ŚCIŚLE TAJNE` i kubek Pułkownika (`mat_label_residence_mug`). | ≤ 880 |
| 26 | `res_bookshelf_wall` | `3.20 × 2.80 × 0.75` | `R9` (Biblioteka — 4 szt.), `R8` (Biuro) | **Pełna wysoka osłona (`wys. 2.80 m`)** — `blok` (`size: 3.2 × 2.8 × 0.75 m`, `instance: true`, również w `WALL_FIXTURES`) | **Dwustronny podświetlany regał biblioteczny:** konstrukcja z ciemnego orzecha i czarnej stali (`mat_wood`, `mat_lacquer`), rzędy oprawionych w skórę woluminów, segregatorów archiwalnych i artefaktów podświetlone od tyłu ciepłą bielą `mat_light_panel` i bursztynem `mat_neon_amber`. | ≤ 760 |
| 27 | `res_holo_globe_stand` | `1.40 × 1.60 × 1.40` | `R9` (Biblioteka), `R8` (Biuro) | **Średnia osłona (`wys. 1.60 m`)** — `blok` (`size: 1.4 × 1.6 × 1.4 m`, `instance: true`) | **Postument z projekcją holo-globusa Neo-Ryd:** ośmiokątny cokół z czarnego marmuru (`mat_lacquer`, `mat_metal`) i zawieszona nad nim ażurowa sfera sektorów miasta (`mat_neon_amber`, `mat_neon_blue`, bez stożka projektora!). | ≤ 640 |
| 28 | `res_trophy_case_tall` | `2.40 × 2.40 × 0.85` | `R10` (Sala Trofeów — 4 szt.), `R8` (Biuro) | **Wysoka osłona (`wys. 2.40 m`)** — `blok` (`size: 2.4 × 2.4 × 0.85 m`, `instance: true`) | **Pancerna gablota muzealna z trofeami i bronią:** grafitowo-mosiężna podstawa (`mat_lacquer`, `mat_metal`), klosz z grubego szkła `mat_glass_clear`, wewnątrz na aksamitnych stojakach podświetlone fioletem (`mat_neon_violet`) i bursztynem (`mat_neon_amber`) historyczne karabiny, hełmy i odznaczenia Koalicji. | ≤ 840 |
| 29 | `res_armor_display_stand` | `1.60 × 2.35 × 1.20` | `R10` (Sala Trofeów — centrum) | **Wysoka osłona (`wys. 2.35 m`)** — `blok` (`size: 1.6 × 2.35 × 1.2 m`) | **Postument z paradnym pancerzem Egzekutora Kurogane:** podświetlony cokół (`mat_lacquer`, `mat_neon_amber`), na stalowym stelażu kompletny czarno-złoty napierśnik, naramienniki i bezwizjerowy hełm paradny Pułkownika (`mat_metal`, `mat_lacquer`, `mat_hivis` — zero czerwieni, by gracz nie pomylił ekspozycji z żywym wrogiem!). | ≤ 960 |
| 30 | `res_master_bed_king` | `2.80 × 1.25 × 2.60` | `R11` (Sypialnia Pułkownika) | **Twarda osłona (`wys. 1.25 m`)** — `blok` (`size: 2.8 × 1.25 × 2.6 m`) | **Łoże platformowe King-Size z zagłówkiem:** lewitująca wizualnie rama z ciemnego orzecha z dolnym podświetleniem `mat_light_panel`, wysoki pikowany zagłówek (`y = 1.25 m`, `mat_fabric`, `mat_wood`), grafitowa pościel i dwie zintegrowane szafki nocne z lampkami `mat_neon_amber`. | ≤ 680 |
| 31 | `res_wardrobe_glass` | `3.20 × 2.40 × 0.85` | `R11` (Garderoba Sypialni — 2 szt. + EE-02) | **Wysoka osłona (`wys. 2.40 m`)** — `blok` (`size: 3.2 × 2.4 × 0.85 m`, `instance: true`) | **Przeszklona szafa garderobiana Walk-In:** korpus z ciemnego drewna (`mat_wood`, `mat_lacquer`), drzwi ze szkła `mat_glass_clear`, wewnątrz podświetlone listwami `mat_light_panel` rzędy płaszczy i mundurów Pułkownika, półki na buty oraz gablota na zegarki. | ≤ 740 |
| 32 | `res_sauna_cabin` | `2.80 × 2.40 × 2.20` | `R12` (Prywatne Spa i Łazienka) | **Duża narożna osłona (`wys. 2.40 m`)** — `blok` (`size: 2.8 × 2.4 × 2.2 m`) | **Przeszklona kabina sauny cedrowej i wanna spa:** front z tafli `mat_glass_clear`, wnętrze wyłożone jasnym drewnem cedrowym (`mat_wood`) z dwupoziomowymi ławami podświetlonymi od spodu ciepłym bursztynem (`mat_neon_amber`) oraz piecem z kamieniami bazaltowymi. | ≤ 820 |

#### Tabela 4: Modele Piwnicy — Sala Tortur i Przesłuchań (`R13`), Winiarnia (`R14`) oraz Bunkier Ochrony (`R15`) — 6 modeli (`res_33`..`res_38`)

| Lp. | Model (`.glb`) | Wymiary AABB `X × Y × Z` [m] | Gdzie stoi (pomieszczenia) | Czy jest osłoną / kolizja | Opis geometrii, sylwetki i materiałów (`mat_*`) | Budżet tri |
|---:|---|---|---|---|---|---:|
| 33 | `res_interrogation_chair` | `1.25 × 1.45 × 1.35` | `R13` (Sala Tortur i Przesłuchań — centrum pod lampą) | **Twarda osłona w centrum Sali Tortur (`wys. 1.45 m`)** — `blok` (`size: 1.25 × 1.45 × 1.35 m`) | **Fotel przesłuchań z pasami i aparaturą neuralną (klimat grozy bez makabry):** ciężka, przyśrubowana do betonu podstawa żeliwna (`mat_machine`, `mat_metal`), pochylone siedzisko i oparcie z czarnej wytartej skóry (`mat_rubber`, `mat_lacquer`), masywne skórzane pasy z mosiężnymi klamrami na nadgarstki i kostki (`mat_wood`, `mat_hivis`), regulowany zacisk skroniowy z przewodami (`mat_cable`) i bocznym monitorem tętna (`mat_screen_status` w zieleni `#6dff4a`). | ≤ 960 |
| 34 | `res_instrument_trolley` | `1.40 × 1.05 × 0.75` | `R13` (Sala Tortur — obok fotela, z teczką EE-05) | **Średnia osłona (`wys. 1.05 m`)** — `blok` (`size: 1.4 × 1.05 × 0.75 m`, `instance: true`) | **Stalowy wózek z narzędziami przesłuchań i lampa zabiegowa:** dwupółkowy stelaż ze stali chirurgicznej (`mat_metal`), na górnej tacy ułożone równolegle szczypce, sondy neuralne, kamerton „Akord”, strzykawki z zielonym serum (`mat_neon_green`), ręcznik i teczka dokumentów; z boku wysięgnik z zimną lampą **`mat_light_panel`**. | ≤ 720 |
| 35 | `res_holding_cage_bars` | `4.00 × 3.40 × 0.22` | `R13` (Sala Tortur — krata celi i przegroda) | **Przezierna krata więzienna** (`decor` `WALL_FIXTURES`, `PASSAGE_FIXTURES` + kolidery boczne poza otwartymi drzwiami celi) | **Stalowa krata celi przetrzymywania więźniów:** ciężka rama z kątowników (`mat_metal`, `mat_machine`), pionowe pręty stalowe co `0.18 m` (pełna przezierność 80% bez problemów z alpha-sortingiem!), otwarte na oścież skrzydło drzwi kratowych z ciężkim zamkiem elektromagnetycznym (`mat_neon_amber`). | ≤ 540 |
| 36 | `res_recording_console` | `2.40 × 1.25 × 0.90` | `R13` (Sala Tortur — przy lustrze weneckim), `R7` (Ochrona), `R15` (Bunkier) | **Twarda osłona (`wys. 1.25 m`)** — `blok` (`size: 2.4 × 1.25 × 0.9 m`, `instance: true`) | **Konsola nagrań przesłuchań i podsłuchu:** pancerny stół ze szpulowym rejestratorem magnetycznym, ekranem oscyloskopu dźwięku (`mat_screen_res_audio_wave`), mikrofonem na gęsiej szyi, stosem opisanych kaset z przesłuchań i zielono-bursztynowymi wskaźnikami wysterowania (`mat_neon_green`, `mat_neon_amber`). | ≤ 780 |
| 37 | `res_wine_rack_wall` | `3.20 × 2.80 × 0.65` | `R14` (Winiarnia — 4 szt. + stół degustacyjny) | **Pełna wysoka osłona (`wys. 2.80 m`)** — `blok` (`size: 3.2 × 2.8 × 0.65 m`, `instance: true`, również w `WALL_FIXTURES`) | **Podświetlany regał winiarni z butelkami i beczkami:** kratownica z ciemnego dębu i czarnej stali (`mat_wood`, `mat_metal`), ponad 120 poziomych butelek z ciemnego szkła podświetlonych od tyłu ciepłym bursztynem (`mat_neon_amber`, `mat_light_panel`) oraz dolna wnęka na dębowe beczki. | ≤ 880 |
| 38 | `res_cctv_monitor_wall` | `4.00 × 2.40 × 0.25` | `R15` (Podziemny Bunkier Ochrony), `R7` (Pokój Ochrony Parteru) | **Ściana wideo** (`decor` `WALL_FIXTURES`, montowana na `y = levelY + 0.9 m`) | **Ściana 9 monitorów CCTV ochrony rezydencji:** stelaż z czarnej stali (`mat_lacquer`, `mat_metal`) mieszczący matrycę ekranów nadzoru (`mat_screen_res_radar`, `mat_screen_status`) z siatką kamer noktowizyjnych lasu, obrysem willi i bursztynowymi alertami ruchu. | ≤ 440 |

*(Uwaga: mniejsze rekwizyty wymienione w opisie pomieszczeń — takie jak krata odpływowa `res_floor_drain_grate`, lustro weneckie `res_oneway_mirror`, lampa sufitowa `res_interrogation_lamp`, stół degustacyjny `res_tasting_island`, beczki `res_wine_barrel_rack`, wanna `res_freestanding_tub`, umywalka `res_marble_vanity`, fotel `res_lounge_armchair`, szafa na broń `res_tactical_gun_cabinet`, postument ostrza `res_blade_display_pedestal`, słoik `res_ee_x51_specimen_jar`, gablota zegarków `res_luxury_watch_case` oraz ładowarka `res_ev_charger_pillar` — są zintegrowane jako pod-zespoły powyższych 38 modeli `.glb` lub korzystają z kompozycji bloków z materiałami `res_*`, tak by katalog `res_*.glb` liczył dokładnie 38 zoptymalizowanych modeli!)*

### 4.2. Katalog 32 tekstur (`signs/`, `screens/`, `decals/`, `labels/`, `surfaces/`) oraz zestawienie Tablicy „Iskry” i 12 Easter Eggów

Wszystkie 32 tekstury są w języku polskim i przechodzą automatyczny walidator palety HSV (zero pikseli w paśmie czerwieni `358.4° ± 13°`, cyanu `186.1° ± 13°` i magenty `311.6° ± 13°` przy `S >= 0.55, V >= 0.5`):

| Nr | Kategoria / Plik (`.webp`) | Rozmiar | Gdzie występuje | Opis treści, kolorystyki i roli (Szyld / Obraz / Tablica Śledcza / Easter Egg) |
|---:|---|---|---|---|
| 1 | `decals/res_iskra_investigation_board.webp` | `1024×512` RGBA | `R8` Biuro Pułkownika (`res_investigation_board_iskra`) | **GŁÓWNA TABLICA ŚLEDCZA „OPERACJA ISKRA”:** mapa nieczynnej stacji metra **„Kamienna”**, list gończy **`POSZUKIWANY: KURIER (REZONANT)`** z sylwetką bohatera, zdjęcia i notatki o **Doktor Wolan, Mirze, Szronie i Bajcie**, połączone **bursztynowymi (`#ffae1a`) i białymi (`#fff1d6`) nitkami** (zero czerwieni!). |
| 2 | `decals/res_ee_run1_forklift_memo.webp` | `512×512` RGBA | `R6` Garaż Pancerny (`X = -18, Z = +4.2`) | **Easter Egg #1 (`run1` Magazyn):** oprawiony raport powypadkowy: **`MAGAZYN K-09 (RUN-1): KTO POZWOLIŁ INTRUZOWI RZUCAĆ SKRZYNIAMI W WÓZKI WIDŁOWE AGV?! KOSZT NAPRAWY SUWNICY: 420 000 KR`**. |
| 3 | `decals/res_ee_run2_atrium_vip.webp` | `512×512` RGBA | `R11` Garderoba Sypialni (`X = +1.5, Z = -36.0`) | **Easter Egg #2 (`run2` Galeria Atrium Nova):** certyfikat VIP i plakat butiku **`ATRIUM NOVA // SALON AUREA & VERVE — ZEGAREK PUŁKOWNIKA ODEBRANY 15 MIN PRZED NOCNĄ MASAKRĄ MANEKINÓW`**. |
| 4 | `decals/res_ee_run3_cocoon04_alert.webp` | `512×512` RGBA | `R10` Sala Trofeów (`X = +25.5, Z = -24.0`) | **Easter Egg #3 (`run3` Tajne Laboratorium X-51):** tabliczka przy eksponacie: **`SEKTOR X-51 // PROJEKT CHIMERA — ODŁAMEK SZKŁA ZE ZBIORNIKA NR 04. UWAGA: SZEŚCIO-PALCZASTY OBIEKT NADAL W WENTYLACJI!`**. |
| 5 | `decals/res_ee_run4_penthouse_invoice.webp` | `512×512` RGBA | `R8` Biuro Pułkownika (`na biurku res_colonel_desk`) | **Easter Egg #4 (`run4` Wieżowiec Piętra 60–62):** faktura i notatka Prezesa: **`PIĘTRO 62 // KOSZT WYMIANY SZYBY PANORAMICZNEJ I DRUKARKI NR 4. DOPISEK: VANE, UKRYJ AKTA W LEŚNEJ WILLI, TAM NAS NIE ZNAJDZIE!`**. |
| 6 | `decals/res_ee_helixa_akord_dossier.webp` | `512×512` RGBA | `R13` Sala Tortur (`na stoliku res_instrument_trolley`) | **Easter Egg #5 (`bulwar1` / Helixa Dynamics):** teczka medyczna: **`HELIXA DYNAMICS // PRZYCHODNIA BULWAR — DOSTAWA KAMERTONÓW ‘AKORD’ DO PRZESŁUCHAŃ. ROZLICZENIE: DARMOWE SZCZEPIENIA W NIECCE`**. |
| 7 | `decals/res_ee_orbis_grid_firewall.webp` | `512×512` RGBA | `R15` Bunkier Ochrony (`X = +27.8, Z = +26.5`) | **Easter Egg #6 (Orbis Grid & Bajt):** wydruk alertu IT: **`ORBIS GRID // ALARM SIECI: HAKER ‘BAJT’ ZNÓW PODMIENIŁ MUZYKĘ W WINDACH KOALICJI NA SYNTHWAVE. NIE DOTYKAĆ ROUTERA!`**. |
| 8 | `decals/res_ee_vintage_2048_wine.webp` | `512×512` RGBA | `R14` Winiarnia (`na stole res_tasting_island`) | **Easter Egg #7 (Winiarnia Koalicji):** karta degustacyjna: **`CHÂTEAU KUROGANE 2048 — SMAK CZYSTEGO MONOPOLU (ZAWIERA ŚLADOWE ILOŚCI SYNT-SIARKI Z ODLEWNI I ŁEZ AKCJONARIUSZY)`**. |
| 9 | `decals/res_ee_kitchen_notes.webp` | `512×512` RGBA | `R4` Kuchnia (`na drzwiach res_smart_fridge`) | **Easter Egg #8 (Kod `0451` i synt-kofeina):** żółto-bursztynowa lista na lodówce: **`1. SYNT-KOFEINA Z 61. PIĘTRA; 2. NAKARMIĆ KARPIE KOI; 3. KOD DO WINIARNI: 0451 (PRZESTAŃCIE NAKLEJAĆ GO NA LODÓWCE!)`**. |
| 10 | `decals/res_ee_colonel_book_titles.webp` | `512×512` RGBA | `R9` Biblioteka (`na stoliku przy res_bookshelf_wall`) | **Easter Egg #9 (Biblioteka Egzekutora):** okładki książek: **`„101 SPOSOBÓW NA PAROWANIE OSTRZA PLAZMOWEGO (ROZDZ. 1: DLACZEGO NASI SZTURMOWCY ZAWSZE PUDŁUJĄ)”` oraz `„ETYKA KORPORACYJNA (1 STRONA, PUSTA)”`**. |
| 11 | `decals/res_ee_mira_blade_trophy.webp` | `512×256` RGBA | `R10` Sala Trofeów (`X = +16.5, Z = -24.0`) | **Easter Egg #10 (Ostrze od Miry):** tabliczka w gablocie: **`TROFEUM #09: RĘKOJEŚĆ OSTRZA Z WARSZTATU NA STACJI KAMIENNA — GRAWER: ‘JAK ZARYSUJESZ NA TARCZY, SAM BĘDZIESZ POLEROWAŁ — M.’`**. |
| 12 | `decals/res_ee_art_plaque.webp` | `512×256` RGBA | `R2` Wielki Salon (`pod obrazem res_wall_art_triptych`) | **Easter Egg #11 (Sztuka Korporacyjna):** mosiężna tabliczka: **`„CISZA PO PACYFIKACJI SEKTORA 4” — DAR ZARZĄDU KUROGANE DLA PUŁKOWNIKA VANE'A ZA 99,8% SKUTECZNOŚCI PRZESŁUCHAŃ`**. |
| 13 | `labels/label_residence_mug.webp` | `256×256` RGBA | `R8` Biuro i `R7` Ochrona (UV na kubkach) | **Easter Egg #12 (Kubek Pułkownika):** nadruk UV: **`SZEF BEZPIECZEŃSTWA ROKU // NAJPIERW STRZELAM, POTEM SPRAWDZAM PRZEPUSTKĘ`**. |
| 14 | `decals/res_kurogane_villa_crest.webp` | `512×512` RGBA | `R1` Hol Wejściowy, `R2` Salon, `R8` Biuro | Mosiężno-bursztynowy monogram podłogowy **`WILLA KUROYAMA // REZYDENCJA PUŁKOWNIKA KUROGANE ARMS`**. |
| 15 | `decals/res_drain_stain.webp` | `512×512` RGBA | `R13` Sala Tortur (pod fotelem przesłuchań) | Ciemna, mokra plama i rysy wokół kraty odpływowej pod fotelem przesłuchań (chłodny grafit/bursztyn, zero czerwieni). |
| 16 | `signs/res_villa_kuroyama.webp` | `512×256` RGB | `R1` Hol Wejściowy (nad portalem do Salonu) | Szyld **`WILLA KUROYAMA // ENKLAWA LEŚNA KUROGANE`** w bursztynie `#ffae1a` i ciepłej bieli `#fff1d6`. |
| 17 | `signs/res_art_neon_forest.webp` | `512×256` RGB | `R2` Wielki Salon, `R3` Jadalnia (obrazy ścienne) | Podświetlany obraz przedstawiający złoto-błękitny las nocą (`#ffae1a`, `#3d7bff`, `#fff1d6`). |
| 18 | `signs/res_winter_pool.webp` | `512×256` RGB | `R5` Kryty Basen i Ogród Zimowy | Szyld **`PAWILON DESZCZU // BASEN & OGRÓD ZIMOWY`** (`#3d7bff` / `#6dff4a`). |
| 19 | `signs/res_armored_garage.webp` | `512×256` RGB | `R6` Garaż Pancerny | Szyld **`GARAŻ PANCERNY // FLOTA SPECJALNA`** (`#ffae1a` / `#3d7bff`). |
| 20 | `signs/res_guard_post.webp` | `512×256` RGB | `R7` Pokój Ochrony Parteru | Szyld **`DYŻURKA STRAŻY // MONITORING OBWODOWY`** (`#ffae1a` / `#6dff4a`). |
| 21 | `signs/res_colonel_office.webp` | `512×256` RGB | `R8` Biuro Pułkownika | Szyld **`GABINET PUŁKOWNIKA // DOSTĘP WYŁĄCZNIE: K. VANE`** (`#ffae1a` / `#fff1d6`). |
| 22 | `signs/res_trophy_sanctuary.webp` | `512×256` RGB | `R10` Sala Trofeów | Szyld **`SANKTUARIUM KUROGANE // KOLEKCJA BRONI & TROFEÓW`** (`#8a5cff` / `#ffae1a`). |
| 23 | `signs/res_wine_cellar.webp` | `512×256` RGB | `R14` Winiarnia w Piwnicy | Szyld **`KRYPTA ROCZNIKÓW // WINIARNIA PRYWATNA`** (`#ffae1a` / `#8a5cff`). |
| 24 | `signs/res_interrogation_zone.webp` | `512×256` RGB | `R13` Sala Tortur i Przesłuchań | Tablica ostrzegawcza nad kratą: **`SEKCJA PRZESŁUCHAŃ // STREFA WYCISZONA AKUSTYCZNIE`** (`#ffae1a` / `#fff1d6`). |
| 25 | `signs/res_bunker_exit.webp` | `512×256` RGB | `R15` Podziemny Bunkier Ochrony | Szyld **`BUNKIER BASTION // TUNEL EWAKUACYJNY`** (`#6dff4a` / `#3d7bff`). |
| 26 | `screens/screen_res_radar.webp` | `512×512` RGB | `R7`, `R8`, `R15` (monitory ochrony i biurko Pułkownika) | Zielono-bursztynowy ekran radaru leśnego: **`PERYMETR LEŚNY: SEKTOR CZYSTY // DRON H-06 W POWIETRZU`**. |
| 27 | `screens/screen_res_audio_wave.webp` | `512×512` RGB | `R13` Sala Tortur (`res_recording_console`) | Oscyloskop zapisu przesłuchania: **`ZAPIS AUDIO #44 — ANALIZA STRESU GŁOSU (STACJA KAMIENNA)`** w zieleni `#6dff4a` i bursztynie `#ffae1a`. |
| 28 | `screens/screen_iskra_board.webp` | `512×512` RGB | `R8` Biuro Pułkownika (UV w `res_investigation_board_iskra`) | Cyfrowy podkład mapy stacji metra **Kamienna** i schematu komórki **„Iskra”**. |
| 29–32 | `surfaces/res_arch_concrete.webp`, `res_dark_walnut.webp`, `res_nero_marble.webp`, `res_plush_carpet.webp` (+ 4 `komiks_res_*.webp`) | `1024×1024` RGB (×8 plików) | Podłogi, ściany i dywany całej rezydencji | 4 tekstury kafelkowalne opisane w **F-03** (`§2.1.B`). |

### 4.3. Zasoby istniejące do ponownego użycia oraz zasoby zakazane na mapie `run6`

#### A. Dozwolone istniejące modele i materiały (spójne z rezydencją Pułkownika Kurogane Arms)
- **Z zestawów `off_*`, `lab_*`, `mall_*`, `wh_*`, `city_*`:**
  - `off_lounge_sofa`, `off_office_planter`, `off_coffee_machine`, `off_executive_desk` — uzupełniające meble w pokojach bocznych,
  - `lab_classified_cabinet`, `lab_prototype_weapon_rack` — sejfy z tajnymi aktami w Biurze `R8` i gabloty w Sali Trofeów `R10`,
  - `mall_kurogane_display`, `mall_security_fixture` — gabloty kolekcjonerskie i kamery bezpieczeństwa (bursztynowo-grafitowe, zero czerwieni),
  - `wh_weapon_case_stack`, `wh_wall_terminal` — pancerne skrzynie ze sprzętem w Garażu `R6`, Pokoju Ochrony `R7` i Bunkrze `R15`,
  - `city_vent_grate`, `city_pipe_run`, `city_ac_unit`, `city_door` — wyłącznie w Piwnicy (`R13`, `R15`) i Garażu (`R6`),
  - `crate` (`1.0 × 1.0 × 1.0 m`, zniszczalna) oraz `crate_small` (`0.5 × 0.5 × 0.5 m`, dynamiczna do Chwytu Rezonansem).
- **Istniejące materiały powierzchniowe:** `glass_clear`, `light_panel`, `off_polished_granite`, `off_wood_slat_wall`, `off_carpet_tile`, `mall_stone_floor`, `mall_terrazzo_inlay`, `lab_bunker_concrete`, `steel_grating`, `tread_plate`, `lacquer`, `metal`, `trim`, `wood`, `fabric`.

#### B. Zasoby ZAKAZANE w `run6`
1. **Zakaz modeli przemysłowo-portowych, ulicznych i sklepowych:** zakaz `wh_pallet_rack`, `wh_forklift`, `wh_overhead_crane`, `port_container_*`, `city_dumpster`, `city_trash_bags`, `city_stall`, `mall_mannequin`, `mall_shoe_wall`, `mall_escalator`, `lab_cocoon_*`.
2. **Zakaz modeli generujących automatyczne stożki wolumetryczne:** bezwzględny zakaz `city_street_lamp` oraz `city_lantern_string` (`src/render/city/lamps.ts`).

---

## 5. Konfiguracja walki, spawny, hazardy, oświetlenie i plan generatora `run6.mjs`

### 5.1. Blok `arena`, dyrektor walki i 20 punktów spawnu wrogów (`spawnPoints` na 3 kondygnacjach)

Pokój `run6.json` ma `"type": "combat"`, `"weather": "kuroganeForestResidence"` oraz blok `arena`:
- `"navigationCellM": 0.5`, `"navigationClearanceM": 0.4`, `"navigationMaxRiseM": 0.55`, `"navigationHeadroomM": 2.2`, `"batchCellM": 24`,
- `"spawnRing": { "minM": 10, "maxM": 28 }`, `"maxAlive": 10`, `"minSpawnDistance": 10`,
- Punkty kontrolne wymagane przez `capturePointsSchema`: `A: (0, 0.0, -6.0)` (Wielki Salon `R2` na Parterze), `B: (0, 4.8, -24.0)` (Biuro Pułkownika `R8` przy Tablicy Śledczej „Iskra” na Piętrze), `C: (0, -4.8, +24.0)` (Winiarnia `R14` przed Salą Tortur i Bunkrem w Piwnicy).

**Tabela 20 punktów spawnu wrogów (`spawnPoints`) — pokrywających wszystkie 15 pomieszczeń i 3 kondygnacje (`y = -4.80 m`, `y = 0.00 m`, `y = +4.80 m`):**

| Nr | Współrzędne `{ x, y, z }` | Kondygnacja | Pomieszczenie | Rola taktyczna w starciu |
|---:|---|---|---|---|
| **1** | `{ "x": -9, "y": 0.0, "z": -4 }` | **Parter** (`0.0 m`) | **R2** (Wielki Salon — zachód) | Szturmowiec za narożną sofą `res_luxury_sofa_l` przyjmujący gracza po wejściu z Holu `R1` |
| **2** | `{ "x": 8, "y": 0.0, "z": -5 }` | **Parter** (`0.0 m`) | **R2** (Wielki Salon — wschód) | Strzelec za kominkiem kolumnowym `res_fireplace_column` |
| **3** | `{ "x": -10, "y": 0.0, "z": -15 }` | **Parter** (`0.0 m`) | **R2** (Wielki Salon — przy szybie N) | Strzelec przy fortepianie holo na tle deszczowego lasu |
| **4** | `{ "x": 9, "y": 0.0, "z": -14 }` | **Parter** (`0.0 m`) | **R2** (Wielki Salon — północny wschód) | Tarczownik osłaniający podejście pod wschodnie schody na Antresolę |
| **5** | `{ "x": -23, "y": 0.0, "z": -1 }` | **Parter** (`0.0 m`) | **R3** (Jadalnia Reprezentacyjna) | Flanka zachodnia za 12-osobowym stołem jadalnianym |
| **6** | `{ "x": -23, "y": 0.0, "z": -14 }` | **Parter** (`0.0 m`) | **R4** (Nowoczesna Kuchnia) | Szturmowiec wybiegający zza wyspy kuchennej `res_kitchen_island` |
| **7** | `{ "x": 23, "y": 0.0, "z": -12 }` | **Parter** (`0.0 m`) | **R5** (Kryty Basen i Ogród Zimowy — N) | Strzelec za donicami bambusowymi po drugiej stronie niecki basenu |
| **8** | `{ "x": 23, "y": 0.0, "z": 1 }` | **Parter** (`0.0 m`) | **R5** (Kryty Basen i Ogród Zimowy — S) | Flanka wschodnia przebiegająca przez płytką wodę basenu do Salonu |
| **9** | `{ "x": -20, "y": 0.0, "z": 13 }` | **Parter** (`0.0 m`) | **R6** (Garaż Pancerny) | Strażnik za pancerną cyber-limuzyną Pułkownika |
| **10** | `{ "x": 18, "y": 0.0, "z": 10 }` | **Parter** (`0.0 m`) | **R7** (Pokój Ochrony Parteru) | Operator przy konsoli monitoringu, poza marginesem `1 m` od lasera `guardroom-armory-laser` |
| **11** | `{ "x": -14.4, "y": 4.8, "z": -1 }` | **Antresola L1** (`+4.8 m`) | **R2-M** (Antresola Salonu — zachód) | Snajper/strzelec na zachodniej galerii Salonu — idealny cel do zrzucenia Rezonansem na parter! |
| **12** | `{ "x": 14.4, "y": 4.8, "z": -1 }` | **Antresola L1** (`+4.8 m`) | **R2-M** (Antresola Salonu — wschód) | Snajper/strzelec na wschodniej galerii Salonu |
| **13** | `{ "x": 0, "y": 4.8, "z": -22 }` | **Piętro L1** (`+4.8 m`) | **R8** (Biuro Pułkownika Vane'a) | Egzekutor broniący biurka Pułkownika i Tablicy Śledczej „Iskra” |
| **14** | `{ "x": -21, "y": 4.8, "z": -24 }` | **Piętro L1** (`+4.8 m`) | **R9** (Biblioteka i Archiwum) | Flanka między podświetlanymi regałami z książkami |
| **15** | `{ "x": 21, "y": 4.8, "z": -27 }` | **Piętro L1** (`+4.8 m`) | **R10** (Sala Trofeów) | Strażnik za gablotami z ostrzami, poza marginesem `1 m` od `trophy-room-security-laser` |
| **16** | `{ "x": -14, "y": 4.8, "z": -39 }` | **Piętro L1** (`+4.8 m`) | **R11 / R12** (Sypialnia i Prywatne Spa) | Odwód północny wybiegający z apartamentu głównego i łazienki |
| **17** | `{ "x": -22, "y": -4.8, "z": 24 }` | **Piwnica B** (`-4.8 m`) | **R13** (Sala Tortur i Przesłuchań) | Przesłuchujący Egzekutor przy fotelu z pasami i konsoli nagrań |
| **18** | `{ "x": 0, "y": -4.8, "z": 21 }` | **Piwnica B** (`-4.8 m`) | **R14** (Prywatna Winiarnia) | Strażnik przed przystankiem #0 windy — może wjechać windą na Parter po gracza! |
| **19** | `{ "x": 16, "y": -4.8, "z": 21 }` | **Piwnica B** (`-4.8 m`) | **R15** (Podziemny Bunkier Ochrony — N) | Tarczownik przy ścianie monitorów CCTV |
| **20** | `{ "x": 19, "y": -4.8, "z": 29 }` | **Piwnica B** (`-4.8 m`) | **R15** (Podziemny Bunkier — przed `exit`) | Ostatnia linia obrony przed podziemną śluzą ewakuacyjną `exit` |

### 5.2. Zestawienie zagrożeń środowiskowych (`hazards[]` — 5 hazardów na 3 kondygnacjach)

| Nr | `kind` i `id` | Kondygnacja i pomieszczenie | Położenie i parametry | Zastosowanie w walce (Ostrze / Rezonans / Strzelec) |
|---:|---|---|---|---|
| **1** | `explosive_barrel`<br>`id: "garage-fuel-cell"` | **Parter (`y = 0.0 m`)**<br>`R6` Garaż Pancerny | `position: (-27.5, 0.0, 6.5)` | Ogniwo paliwowe przy stole warsztatowym; detonacja razi wrogów kryjących się za limuzyną. |
| **2** | `laser_gate`<br>`id: "guardroom-armory-laser"` | **Parter (`y = 0.0 m`)**<br>`R7` Pokój Ochrony Parteru | `from: (24.0, 0.85, 6.0)`, `to: (24.0, 0.85, 14.0)`, `cycle: { onS: 2.5, offS: 1.8 }` | Wiązka laserowa przed szafami z bronią; pchnięcie wrogów Rezonansem na wiązkę. |
| **3** | `laser_gate`<br>`id: "trophy-room-security-laser"` | **Piętro (`y = +4.8 m`)**<br>`R10` Sala Trofeów | `from: (18.5, 5.65, -24.0)`, `to: (23.5, 5.65, -24.0)`, `cycle: { onS: 2.2, offS: 1.6 }` | Laser chroniący stojak pancerza i gablotę z ostrzem Miry (`wys. 0.85 m` nad posadzką `y = 4.80 m`). |
| **4** | `electric_field`<br>`id: "bunker-ups-discharge"` | **Piwnica (`y = -4.8 m`)**<br>`R15` Bunkier Ochrony | `position: (23.5, -3.8, 25.0)`, `size: (2.8, 2.0, 3.0)`, `cycle: { onS: 3.0, offS: 2.2 }` | Przeciążona sekcja zasilania UPS serwerowni (`spód na y = -4.80 m`); idealna pułapka na Pchnięcie Rezonansu w finałowej fali. |
| **5** | `explosive_barrel`<br>`id: "bunker-coolant-cell"` | **Piwnica (`y = -4.8 m`)**<br>`R15` Bunkier Ochrony | `position: (14.0, -4.8, 29.5)` | Zbiornik ciekłego chłodziwa osłaniający podejście do śluzy ewakuacyjnej `exit`. |

### 5.3. Oświetlenie bez smug wolumetrycznych i budżet `CityLights`

Zgodnie z limitem `CityLights` (`8` aktywnych `PointLight` na `high`, `4` na `medium`) oraz zasadą z `run3` i `run4`:
1. **100% opraw sufitowych (`res_chandelier_linear`, `res_recessed_led_strip`, `res_interrogation_lamp`) używa materiału `mat_light_panel`** (`#fff1d6`, `flat: true`), dzięki czemu sufit każdego z 15 pomieszczeń świeci czysto bez generowania pionowych smug bloomu.
2. **Rozmieszczenie 26 źródeł `lights[]` (`0` z `cone: true`, każde z jawnym `floorY` odpowiadającym kondygnacji `-4.8`, `0.0` lub `+4.8 m`):**
   - **Parter (`L0`, 12 źródeł, `floorY: 0.0`):**
     - `R1 Hol Wejściowy (2)`: nad bramką biometryczną `(-4, 4.35, +11.0, "#fff1d6", intensity: 26, range: 12)` oraz przed szybem windy `(0, 4.35, +13.0, "#ffae1a", intensity: 24, range: 11)`.
     - `R2 Wielki Salon (4)`: nad kominkiem kolumnowym `(+4.5, 4.2, -11.5, "#ffae1a", intensity: 34, range: 16)`, nad strefą sof `(-2, 6.2, -5.0, "#fff1d6", intensity: 30, range: 16)`, nad fortepianem holo `(-9.5, 4.5, -13.0, "#ffae1a", intensity: 24, range: 12)` oraz błękitna poświata lasu przy północnym przeszkleniu `(0, 4.5, -16.5, "#3d7bff", intensity: 24, range: 14)`.
     - `R3 Jadalnia (1)`: nad stołem 12-osobowym `(-23, 4.35, -1.0, "#fff1d6", intensity: 26, range: 12)`.
     - `R4 Kuchnia (1)`: nad wyspą kuchenną `(-23, 4.35, -12.0, "#fff1d6", intensity: 26, range: 12)`.
     - `R5 Kryty Basen i Ogród Zimowy (2)`: nad niecką basenu `(+23, 4.35, -7.0, "#3d7bff", intensity: 30, range: 15)` oraz nad ogrodem zimowym `(+23, 4.35, -15.0, "#6dff4a", intensity: 22, range: 12)`.
     - `R6 Garaż Pancerny (1)`: nad cyber-limuzyną `(-20, 4.35, +10.0, "#ffae1a", intensity: 26, range: 13)`.
     - `R7 Pokój Ochrony Parteru (1)`: nad konsolą monitoringu `(+20, 4.35, +10.0, "#6dff4a", intensity: 24, range: 12)`.
   - **Piętro (`L1`, 8 źródeł, `floorY: 4.8`):**
     - `R8 Biuro Pułkownika (2)`: nad biurkiem Pułkownika `(0, 9.15, -23.5, "#fff1d6", intensity: 28, range: 13)` oraz reflektor oświetlający **Tablicę Śledczą „Iskra”** `(0, 8.8, -28.5, "#ffae1a", intensity: 26, range: 11)`.
     - `R9 Biblioteka (1)`: nad holo-globusem i regałami `(-21, 9.15, -24.0, "#ffae1a", intensity: 26, range: 13)`.
     - `R10 Sala Trofeów (2)`: nad stojakiem pancerza `(+21, 9.15, -24.0, "#8a5cff", intensity: 28, range: 13)` oraz przy gablocie z ostrzem Miry `(+16.5, 8.8, -24.0, "#ffae1a", intensity: 20, range: 10)`.
     - `R11 Sypialnia i Garderoba (2)`: nad łożem king-size `(-14, 9.15, -36.0, "#8a5cff", intensity: 24, range: 13)` oraz w garderobie `(0, 9.15, -36.0, "#fff1d6", intensity: 22, range: 11)`.
     - `R12 Prywatne Spa i Sauna (1)`: nad wanną kamienną i sauną `(+14, 9.15, -36.0, "#3d7bff", intensity: 26, range: 13)`.
   - **Piwnica (`B`, 6 źródeł, `floorY: -4.8`):**
     - `R13 Sala Tortur i Przesłuchań (2)`: zimno-biała lampa bezpośrednio nad fotelem z pasami `(-19, -1.6, +24.0, "#fff1d6", intensity: 30, range: 12)` oraz przy konsoli nagrań i kracie celi `(-23, -0.5, +28.0, "#6dff4a", intensity: 18, range: 10, flicker: { pattern: "buzz", strength: 0.2 })`.
     - `R14 Prywatna Winiarnia (2)`: nad stołem degustacyjnym `(0, -0.45, +24.5, "#ffae1a", intensity: 28, range: 13)` oraz przed przystankiem #0 windy `(0, -0.45, +18.0, "#fff1d6", intensity: 22, range: 11)`.
     - `R15 Podziemny Bunkier Ochrony (2)`: przy ścianie monitorów CCTV `(+20, -0.45, +22.0, "#3d7bff", intensity: 26, range: 12)` oraz zielony portal nad śluzą ewakuacyjną `exit` `(+19, -1.2, +31.0, "#6dff4a", intensity: 32, range: 13)`.

### 5.4. Plan generatora `tools/arenas/run/run6.mjs` i modułów pomocniczych `_run6*.mjs`

Wzorem `run4.mjs` kod generatora zostanie podzielony na 4 czyste, deterministyczne moduły ES w `tools/arenas/run/`:

| Plik | Odpowiedzialność i zawartość |
|---|---|
| `tools/arenas/run/_run6Kit.mjs` | - Stałe rzędnych wysokości: `Y_B = -4.8`, `Y_MB0 = -2.4`, `Y_L0 = 0`, `Y_M01 = 2.4`, `Y_L1 = 4.8` oraz wysokości stropów `Y_B_CEIL = 0.0`, `Y_L0_CEIL = 4.8`, `Y_L1_CEIL = 9.6`, `Y_SALON_CEIL = 9.6`;<br>- Słownik prostokątów wszystkich 15 pomieszczeń `ROOMS` (`R1..R15` oraz `R2_MEZZ`) i materiałów (`MAT_CONCRETE = 'res_arch_concrete'`, `MAT_WALNUT = 'res_dark_walnut'`, `MAT_MARBLE = 'res_nero_marble'`, `MAT_CARPET = 'res_plush_carpet'`, `MAT_GLASS = 'glass_clear'`);<br>- Pomocniki konstrukcyjne: `deck()`, `ceilingSlab()` (automatycznie dodaje płytę `ceiling: true` oraz dopasowaną bryłę `rainShelters`), `segmentedWall()`, `forestGlassFacade()` (stawia moduły `res_forest_glass_facade` co `4.0 m` + kolider `glass_clear`), `interiorDoorFrame()`, `glassBalustrade()`, `stairFlightWithRails()` oraz `createPlacer()` pilnujący braku kolizji rekwizytów na każdym poziomie wysokości. |
| `tools/arenas/run/_run6Rooms.mjs` | - 15 dedykowanych funkcji wyposażenia tematycznego: `buildRoomR1()` (Hol Wejściowy i Winda L0), `buildRoomR2()` (Wielki Dwukondygnacyjny Salon, kominek, sofy, fortepian holo, antresola), `buildRoomR3()` (Jadalnia), `buildRoomR4()` (Kuchnia z EE-08), `buildRoomR5()` (Kryty Basen i Ogród Zimowy), `buildRoomR6()` (Garaż Pancerny z cyber-limuzyną i EE-01), `buildRoomR7()` (Pokój Ochrony Parteru), `buildRoomR8()` (Biuro Pułkownika z Tablicą Śledczą „Iskra”, EE-04 i EE-12), `buildRoomR9()` (Biblioteka z EE-09), `buildRoomR10()` (Sala Trofeów z EE-03 i EE-10), `buildRoomR11()` (Sypialnia i Garderoba z EE-02), `buildRoomR12()` (Prywatne Spa i Sauna), `buildRoomR13()` (Sala Tortur i Przesłuchań z fotelem, lampą, odpływem, kratą, nagraniami i EE-05), `buildRoomR14()` (Winiarnia z EE-07 i przystankiem windy B), `buildRoomR15()` (Podziemny Bunkier Ochrony z EE-06 i śluzą `exit`). |
| `tools/arenas/run/_run6Dress.mjs` | - Słownik 32 tekstur `RESIDENCE_TEXTURES` (`signs`, `decals`), tablica 20 punktów `SPAWNS` na 3 kondygnacjach, rozmieszczenie skrzyń `crate` i `crate_small`, 5 zagrożeń `hazards()`, ekspozycja Tablicy Śledczej „Iskra” i 12 easter eggów `decalsAndEasterEggs()`, szyldy neonowe i obrazy `signage()` oraz 26 źródeł `lights()` bez `cone: true`. |
| `tools/arenas/run/run6.mjs` | - Punkt wejścia generatora: inicjalizuje `createRunRoom({ id: 'run6', name: 'Rezydencja Pułkownika Kurogane Arms — Willa Kuroyama', weather: 'kuroganeForestResidence', bounds: R(-30, 30, -43, 33), startX: -4, exitX: 19 })`;<br>- Buduje płyty 3 kondygnacji (`y = -4.8, 0.0, +4.8 m`), stropy `ceiling: true` z `rainShelters`, szklane fasady na las, 4 dwubiegowe klatki schodowe (`25.64°`), balustrady `res_glass_balustrade`, wpisuje definicję działającej windy `elevators: [{ id: 'cellar-interrogation-lift', ... }]`, `playerSpawn: (-4, 0, 12)` i drzwi `entry` `(-4, 1.5, 16.5)` / `exit` `(19, -3.3, 32.5)` oraz zapisuje wynik do `src/data/rooms/run6.json`. |

---

## 6. Kryteria akceptacji i etapy prac (A–E)

### 6.1. Kryteria akceptacji (automatyczne CLI i wizualne na zrzutach audytu)

#### A. Kryteria automatyczne (CLI i testy jednostkowe)
1. **Zero błędów i zero ostrzeżeń w `mapAudit`:**
   - Polecenie `node tools/levels/mapAudit.mjs run6` zwraca wynik: **`run6: 0 error, 0 warn`** (`"run6": 0` w `tests/unit/mapAudit.baseline.json`).
   - Szczegółowo: `0` `noCollisionLargeProp`, `0` `floatingObject`, `0` `outOfBounds`, `0` `overlap`, `0` `forbiddenColor`, `0` `emptyRoom`.
   - `node tools/levels/mapAudit.mjs --all` przechodzi bez regresji na wszystkich mapach.
2. **Testy nawigacji 3D, 15 pomieszczeń i windy (`tests/unit/run6Navigation.test.ts`):**
   - Test jednostkowy weryfikuje w `ArenaNavigation(room)`:
     1. Pełną osiągalność ścieżki od `playerSpawn (-4, 0, 12)` w Holu `R1` na Parterze (`y = 0.00 m`) przez Piętro `L1` (`y = +4.80 m`, Biuro Pułkownika `R8`) oraz zejście schodami i przejazd windą `elevators[0]` do Piwnicy (`y = -4.80 m`) aż do drzwi `exit (19, -4.8, 32.5)` w Bunkrze Ochrony `R15`,
     2. Dojście do wszystkich **20 punktów spawnu** na 3 kondygnacjach (`y = -4.8 m`, `y = 0.0 m`, `y = +4.8 m`),
     3. Dojście do wnętrza każdego z **15 pomieszczeń (`R1..R15`)**, na Antresolę Salonu (`R2-M`) oraz do obu przystanków windy (`(0, 0, 12.85)` i `(0, -4.8, 17.15)`),
     4. Brak nakładania się prostokątów pomieszczeń na tej samej kondygnacji oraz gęstość osłon (brak pustego kwadratu podłogi bez osłony `wys. >= 0.8 m` większego niż `8 × 8 m` w Wielkim Salonie `R2`).
3. **Pełny zestaw testów projektu (`npm run check`):**
   - `tsc --noEmit`, `eslint` i `vitest` przechodzą bez błędów, w tym `tests/unit/rooms.test.ts`, `tests/unit/roomBlockModelFit.test.ts` (zgodność wymiarów bloków z AABB 38 modeli `res_*.glb` w tolerancji `±5%`), `tests/unit/forestLayout.test.ts` (testy warstw drzew, pagórków, wykluczenia `panoramaExclusion`, lądowiska i przelotów dronów) oraz test budżetu trójkątów i palety modeli `res_*`.
4. **Deterministyczna generacja i budżet wydajności:**
   - Dwukrotne uruchomienie `node tools/arenas/run/run6.mjs` generuje identyczny plik `src/data/rooms/run6.json` (stały SHA-256).
   - Na profilu `medium` (1920×1080) liczba wywołań rysowania w każdym z 10 widoków audytu (włącznie z włączonym modułem lasu `ForestPanorama`, 3 kondygnacjami i przeszklonymi ścianami!) spełnia **`renderInfo.calls <= 800`**.

#### B. Kryteria wizualne na zrzutach audytu (`node tools/screens/mapAudit.mjs run6`) i w spacerze `?scene=map-walk&map=run6`
1. **Ocena Opusa `≥ 7/10` na komplecie zrzutów `node tools/screens/mapAudit.mjs run6`.**
2. **Czytelność wszystkich 3 kondygnacji (w tym Piwnicy!) na `10-top.png`, `08-high-west.png` i `09-high-east.png`:**
   - Dzięki tarasowo-kaskadowemu rozłożeniu strefy Piwnicy (`Z ∈ [+16, +32]`), strefy Parteru z Dwukondygnacyjnym Salonem (`Z ∈ [-18, +16]`) oraz strefy Piętra (`Z ∈ [-42, -18]`) i automatycznemu ukryciu grupy `room-ceilings` (`ceiling: true`), zrzuty `10-top.png`, `08-high-west.png` i `09-high-east.png` pokazują jednocześnie wszystkie **15 pomieszczeń (`R1`..`R15`)**: Salę Tortur `R13`, Winiarnię `R14` i Bunkier `R15` w Piwnicy (`y = -4.80 m`), 7 pokoi Parteru z Wielkim Salonem `R2` (`y = 0.00 m`) oraz 5 pokoi Piętra z Biurem Pułkownika `R8` (`y = +4.80 m`).
3. **Kadr startowy `01-spawn.png` i monumentalny Salon `R2`:**
   - `01-spawn.png` pokazuje luksusowy Hol Wejściowy `R1` z drzewem bonsai i bramką biometryczną, otwierający się przez 10-metrowy portal na wysoki na `9.60 m` Wielki Salon `R2` z kominkiem kolumnowym, antresolą, schodami i ścianą deszczowego lasu za północnym przeszkleniem.
4. **Prawdziwy las za oknami (`02-north.png`, `03-east.png`, `05-west.png`, `06-corner-nw.png`):**
   - Za taflami `mat_glass_clear` Salonu `R2`, Basenu/Ogrodu Zimowego `R5`, Jadalni `R3`, Kuchni `R4`, Biura `R8` i Sypialni `R11` widać wielowarstwowy las iglasto-liściasty na pagórkach, snującą się między pniami mgłę, zacinający deszcz, tarczę księżyca na niebie, ogrodzenie posesji z bursztynowymi światłami, lądowisko `H-06` oraz przelatujące drony ochrony.
5. **Klimat Sali Tortur (`R13`) oraz czytelność Tablicy Śledczej „Iskra” (`R8`) i 12 Easter Eggów:**
   - W Sali Tortur `R13` natychmiast czytelny jest fotel z pasami pod zimną lampą, krata odpływowa w posadzce, wózek z narzędziami, krata celi, lustro weneckie i konsola nagrań.
   - W Biurze Pułkownika `R8` wyraźnie widać Tablicę Śledczą „Operacja Iskra” z mapą stacji metra Kamienna, listem gończym za graczem („Kurier”) oraz bursztynowo-białymi nitkami (zero czerwieni!).
6. **Brak wolumetrycznych smug światła, brak barw zakazanych i brak nazw chronionych:**
   - Na żadnym kadrze nie występują pionowe smugi pod lampami (`0` `cone: true`, użycie `mat_light_panel`, `fog.density: 0` we wnętrzu), w otoczeniu nie ma czerwieni, cyanu ani magenty, a w całym projekcie nie występują żadne nazwy chronione (`AGENTS.md`).

### 6.2. Etapy prac (A–E)

| Etap | Zakres prac | Artefakty wyjściowe | Weryfikacja etapu |
|---|---|---|---|
| **Etap A — Fundamenty kodu: moduł tła leśnego `ForestPanorama`, materiały `res_*` i profil pogody** | 1. Uogólnienie `SceneAtmosphere` i `weatherSchema` o `panoramaKind: 'city' \| 'forest'` oraz implementacja `forestPanorama.ts`, `forestLayout.ts` i `forestMaterials.ts` (warstwy drzew iglastych i liściastych na `InstancedMesh`, pagórki, mgła między pniami, księżyc, ogrodzenie z bursztynowymi światłami, lądowisko `H-06`, drony i oczy fauny — **F-01**).<br>2. Dopisanie prefiksu `'res_'` w `cityModels.ts` oraz list `WALL_FIXTURES`, `PASSAGE_FIXTURES` i `CEILING_FIXTURES` w `mapAudit.ts` (**F-02**).<br>3. Rejestracja 4 materiałów `res_arch_concrete`, `res_dark_walnut`, `res_nero_marble`, `res_plush_carpet` (**F-03**) i utworzenie profilu pogody `src/data/weather/kuroganeForestResidence.json` (**F-04**). | Zmiany w `src/render/`, `src/world/`, `src/data/render/arenaMaterials.json`, `src/data/weather/kuroganeForestResidence.json` + testy w `tests/unit/forestLayout.test.ts` | `npm run check` zielone |
| **Etap B — Modele 3D w Blenderze (`38` modeli `res_*.glb`)** | 1. Napisanie generatora `tools/blender/sets/kurogane_residence.py` budującego 38 modeli `res_*.glb` z Tabel 1–4 (`§4.1`), z użyciem `mat_light_panel` na oprawach i `mat_glass_clear` na fasadach, balustradach i gablotach.<br>2. Eksport plików `.glb` do `public/assets/models/city/` i render podglądów PNG do `artifacts/models/res/`.<br>3. Aktualizacja `src/data/render/mapModelBounds.json` skryptem `node tools/levels/mapModelBounds.mjs` oraz dopisanie sekcji w `docs/assets.md`. | 38 plików `public/assets/models/city/res_*.glb`, podglądy `artifacts/models/res/*.png`, zaktualizowany `mapModelBounds.json` | Ogląd podglądów PNG + test jednostkowy modeli (AABB, materiały, budżet trójkątów, brak zakazanych barw) |
| **Etap C — Tekstury (`32` tekstury: tablica „Iskry”, 12 easter eggów, obrazy, szyldy, ekrany i powierzchnie)** | 1. Wygenerowanie i walidacja 4 tekstur powierzchni `res_*` (+ 4 wersji `komiks_res_*`).<br>2. Wygenerowanie Tablicy Śledczej `res_iskra_investigation_board.webp`, 12 tekstur easter eggów (`EE-01`..`EE-12`), 10 szyldów/obrazów `signs/res_*` oraz 3 ekranów `screens/screen_res_*` z `§4.2`.<br>3. Rejestracja w `tools/textures/catalog.json`, `tools/textures/komiks/catalog.json` i manifestach w `public/assets/textures/`. | Pliki `.webp` w `public/assets/textures/{surfaces,komiks/surfaces,signs,screens,decals,labels}/` | Walidator tekstur (wymiary, bezszwowość powierzchni, 0 pikseli w zakazanych pasmach HSV czerwieni/cyanu/magenty) |
| **Etap D — Generator mapy `run6` (15 pomieszczeń na 3 kondygnacjach)** | 1. Implementacja `tools/arenas/run/run6.mjs` oraz modułów `_run6Kit.mjs`, `_run6Rooms.mjs`, `_run6Dress.mjs` według współrzędnych z `§3` i `§5`.<br>2. Wygenerowanie `src/data/rooms/run6.json` i dopisanie `"run6": 0` w `tests/unit/mapAudit.baseline.json`.<br>3. Napisanie testu `tests/unit/run6Navigation.test.ts` (osiągalność 20 spawnów, 15 pomieszczeń, 2 przystanków windy, wyjścia w piwnicy i gęstości osłon). | `tools/arenas/run/run6.mjs`, `_run6*.mjs`, `src/data/rooms/run6.json`, `tests/unit/run6Navigation.test.ts` | `node tools/levels/mapAudit.mjs run6` → `0 error, 0 warn`; `npx vitest run tests/unit/run6Navigation.test.ts`; `npm run check` |
| **Etap E — Zrzuty ekranu, audyt wizualny i szlif do oceny Opusa `≥ 7/10`** | 1. Wygenerowanie 10 zrzutów `node tools/screens/mapAudit.mjs run6 --out artifacts/maps/run6/r1 --tag after` oraz kadrów FPP z Wielkiego Salonu (widok na las), Sali Tortur w Piwnicy, Biura Pułkownika (Tablica „Iskra”), Krytego Basenu, Winiarni i Sali Trofeów.<br>2. Przegląd wizualny (widoczność wszystkich 3 kondygnacji wraz z Piwnicą na `10-top`, `08-high-west`, `09-high-east`, prawdziwy las za szybą, brak smug światła, jasność `#2a3344–#56627a`, `renderInfo.calls <= 800`) i korekty do oceny Opusa `≥ 7/10`. | Zrzuty `artifacts/maps/run6/r1/*.png`, raport oceny wizualnej | Ocena Opusa `≥ 7/10`, `mapAudit` `0/0`, `npm run check` zielone |
