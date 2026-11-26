# Dokument projektowy mapy `run3` — TAJNE LABORATORIUM KUROGANE ARMS („SEKTOR X-51”)

Status: **Projekt referencyjny jakości (wzorzec 8+/10) + specyfikacja modeli, tekstur i generatora**  
Docelowy plik danych mapy: `src/data/rooms/run3.json` (generator: `tools/arenas/run/run3.mjs` + moduły pomocnicze `_run3Kit.mjs`, `_run3Rooms.mjs`, `_run3Dress.mjs`)  
Kierunek artystyczny: **Neon Noir** (`AGENTS.md`, `docs/adr/0006-neon-noir.md`)

---

## 1. Analiza silnika i nauczki z `run1` oraz `run2`

### 1.1. Co już działa w silniku i jak `run3` z tego korzysta

Po wdrożeniu magazynu `run1` ([docs/maps/run1.md](run1.md)) oraz galerii handlowej `run2` ([docs/maps/run2.md](run2.md)) silnik posiada kompletny zestaw mechanik dla wielokondygnacyjnych aren wewnętrznych:

| Obszar silnika | Stan obecny w kodzie | Jak wykorzystuje to `run3` | Odwołania do plików |
|---|---|---|---|
| **Format pokoju i katalogi testowe** | Pokój `src/data/rooms/run3.json` (`type: "combat"`, z blokiem `arena` i `spawnRing`) ładuje się automatycznie przez `import.meta.glob` do `roomDefinitions`, menu „Testy map” (`?maps=1` → `?scene=map-walk&map=run3`), sceny walki `?scene=room-test&room=run3&debug=1` oraz audytu CLI `node tools/levels/mapAudit.mjs run3` i `node tools/screens/mapAudit.mjs run3`. | `run3` jest pokojem runu (`rooms`), bez sztucznej misji kampanii. Do czasu uzyskania oceny `≥ 7/10` nie jest dopisywany do `roomPools` w `kurogane.json`. | `src/world/rooms.ts`, `src/world/mapCatalog.ts`, `tools/levels/mapAuditCatalog.ts`, `tools/arenas/run/_runKit.mjs` |
| **Nawigacja 3D (`ArenaSurfaceNavigation`)** | `RoomScene.init()` buduje graf komórek `0.5 × 0.5 m` na wszystkich blokach `walkable: true` połączonych pochyłymi rampami osiowymi (`rotation.x` lub `rotation.z`), z kontrolą prześwitu `navigationHeadroomM = 2.2 m` i promienia kapsuły `navigationClearanceM = 0.4 m`. | Spina **Parter (`y = 0.00 m`)**, **Pomosty Obserwacyjne Piwnicy (`y = -1.60 m`)** oraz **Posadzkę Piwnicy (`y = -5.20 m`)** czterema biegami ramp o czystym obrocie `rotation.x`, nachyleniu `23.96°–24.23° ≤ 26.6°` i szerokości `3.0–3.6 m ≥ 2.0 m`. | `src/world/arenaNavigation.ts`, `src/world/arenaSurfaceNavigation.ts:119–274` |
| **Spawny wrogów na wielu wysokościach (`spawnPoints[].y`)** | `roomSpawnPointSchema` i `wavesSchema` obsługują opcjonalne `y`. Dla `y !== playerSpawn.y` `validateLayout` sprawdza podparcie na poziomym bloku `walkable: true` (`top ≈ y`) i wolny korpus `(y, y + 1.8 m]`. | **16 punktów spawnu** rozłożonych na obu kondygnacjach: **7 na Parterze (`y = 0.0 m`)**, **3 na Pomostach Piwnicy (`y = -1.6 m`)** i **6 na Posadzce Piwnicy (`y = -5.2 m`)**. | `src/world/roomSchema.ts:141, 495–537`, `src/scenes/roomScene.ts:610, 1612` |
| **Przezroczyste szkło (`mat_glass_clear`) i panele świetlne bez smug (`mat_light_panel`)** | `glass_clear` (`opacity: 0.22, depthWrite: false` + Fresnel) zapewnia przezierność szyb architektonicznych. `light_panel` (`#fff1d6`, `flat: true`) świeci ciepłą bielą bez selektywnego bloomu. | `mat_glass_clear` tworzy cylindryczne płaszcze **16 wielkich kokonów humanoidalnych** w piwnicy oraz pancerne okna obserwacyjne. `mat_light_panel` oświetla kasetony, dyfuzory i podświetlane tablice bez generowania pionowych smug bloomu. | `src/render/urbanMaterials.ts`, `src/data/render/arenaMaterials.json:183–202` |
| **Ukrywanie stropów w ujęciach audytu z góry (`ceiling: true`)** | Bloki z `ceiling: true` trafiają do grupy `room-ceilings`, ukrywanej w `MapAuditScene.render()` dla kamer `top`, `high-west` i `high-east`. | Wszystkie płyty stropowe Parteru (`y = 4.80..5.20 m` i `6.40..6.80 m`) oraz strop Piwnicy (`y = 4.40..4.80 m` i `-0.80..-0.40 m`) mają `ceiling: true`. | `src/scenes/roomScene.ts:1129`, `src/scenes/mapAuditScene.ts:140, 163` |
| **Decale z `tint` i batchingiem (`DecalRenderer`)** | `decalSchema` wspiera `tint`, `opacity` i `surface: 'floor' \| 'wall'`, łącząc statyczne naklejki w jeden `Mesh` na teksturę. | Pozwala gęsto rozmieścić ściśle tajne notatki, zaczernione dokumenty, plakaty „ZAKAZ WSTĘPU”, linie korytarzy bio-hazard, ślady butów i easter eggi bez kosztu draw calls. | `src/world/dressingSchema.ts:136–145`, `src/render/city/decals.ts` |

### 1.2. Kluczowe nauczki z audytów `run1` i `run2` zastosowane w `run3`

1. **Zero wolumetrycznych smug światła (`0` stożków, nauczka z `run2` E1–E3):**
   - W `lights[]` nie wolno używać `cone: true` (0 stożków na całej mapie).
   - W `decor[]` zakazane są modele `city_street_lamp` oraz `city_lantern_string`, ponieważ `lampFixtures()` i `lanternFixtures()` w `src/render/city/lamps.ts:51` automatycznie generują pod nimi stożki `LampCones` nawet bez wpisu w `lights[]`.
   - W `signs[]` unikamy otwartych stożków projektorów `kind: "holo"` w głównych osiach widoku (w `SignRenderer` każdy hologram tworzy geometryczny stożek projekcji); ekrany taktyczne, tablice i plakaty realizujemy jako `kind: "neon"`, `mat_screen_*` lub `decals` ścienne.
   - Duże białe powierzchnie świecące (oprawy sufitowe `lab_ceiling_strip`, podświetlenia stołów i gablot) w modelach Blendera i blokach pokoju używają wyłącznie **`mat_light_panel` (`light_panel`)**, a nie `mat_light_white` — eliminuje to szerokie smugi z `BloomPass`.
   - W profilu pogody wnętrza `kuroganeSecretLab.json` ustawiamy `fog.density: 0`, `fog.strength: 0` oraz `dust.density: 0` (mgła wysokościowa przy ujemnych rzędnych piwnicy `y = -5.2 m` zagęszczałaby się na dole i tworzyła poświatę wokół lamp).
2. **Układ Parter + Piwnica a czytelność ujęć `10-top.png`, `08-high-west.png` i `09-high-east.png`:**
   - W `MapAuditScene` kamery zewnętrzne ukrywają wyłącznie bloki z `ceiling: true`. Gdyby Piwnica (`y = -5.20 m`) leżała w tym samym rzucie `(X, Z)` bezpośrednio pod płytami podłogowymi Parteru (`y = 0.00 m`, które mają `walkable: true` i nie mogą mieć `ceiling: true`), podłoga Parteru zasłoniłaby 100% Piwnicy na zrzutach `08-high-west`, `09-high-east` i `10-top` oraz ograniczyłaby wysokość Wielkiej Sali Testów Humanoidalnych do zaledwie ~4 m!
   - **Rozwiązanie architektoniczne w `run3`:** Parter (**5 pomieszczeń: `P1..P5`**, `y = 0.00 m`) zajmuje południową część kompleksu (`Z ∈ [0, +28]`), natomiast Piwnica (**3 pomieszczenia: `B1..B3`**, `y = -5.20 m`) jest wykuta w głąb podziemnego bunkra po stronie północnej (`Z ∈ [-44, 0]`). Zejście z Centralnego Holu (`P5`) prowadzi na północ (`-Z`) dwoma szerokimi biegami ramp wokół szybu windy towarowej wprost do Wielkiej Sali Testów Humanoidalnych (`B1`).
   - Dzięki temu:
     1. Wielka Sala Testów Humanoidalnych (`B1`) ma **pełne `9.60 m` wysokości w świetle** (`y = -5.20 m .. +4.40 m`), mieszcząc 4.4-metrowe szklane kokony, kolektory podstropowe oraz antresole/pomosty obserwacyjne na `y = -1.60 m`,
     2. Z północnej ściany Parteru (`P5 Centralny Hol`, `P2 Czarne Archiwum`, `P4 Zbrojownia Prototypów` na `Z = 0, y = 0.00 m`) gracz patrzy przez pancerne okna obserwacyjne **z góry w dół** na całą salę z kokonami w piwnicy (`y = -5.20 m`),
     3. Na zrzucie `10-top.png` po ukryciu grupy `room-ceilings` widoczne są jednocześnie **wszystkie 8 pomieszczeń** (5 na Parterze i 3 w Piwnicy), a kamery `corner-nw` i `corner-se` w `MapAuditScene` automatycznie próbkują zarówno wnętrze Piwnicy, jak i Parteru!
3. **Walidacja `hazards` na kondygnacji piwnicznej (`y = -5.20 m`) w `validateLayout` (`src/world/roomSchema.ts:458`):**
   - Walidacja korzysta z wysokości podparcia hazardu zdefiniowanej w F-01. Dzięki temu środek pola w piwnicy może leżeć na `y = -4.20 m`, gdy jego spód dotyka posadzki na `y = -5.20 m`.

4. **Czerwona nitka na tablicy śledczej a reguła `forbiddenColor` w `mapAudit.ts`:**
   - Klasyczna tablica korkowa z nitkami („Strefa 51” / teoria spiskowa) w realnym świecie ma czerwoną włóczkę, ale w NEORYDER barwa czerwona (`hue 358.4° ± 13°, S >= 0.55, V >= 0.5`) jest bezwzględnie zarezerwowana dla wrogów i wywołuje `error · forbiddenColor` w `mapAudit.ts`.
   - Dlatego w modelu `lab_corkboard_evidence` oraz na teksturach tablic śledczych nitki łączące zdjęcia i wycinki mają kolor **bursztynowo-złoty (`mat_hivis` `#d08a1c` / `mat_neon_amber` `#ffae1a`)** oraz **zielony (`mat_neon_green` `#6dff4a`)**!

---

## 2. Lista braków („fundamenty”) z priorytetem P0 / P1

### 2.1. Priorytet P0 — MUSI BYĆ PRZED `run3`

#### A. Zmiany w kodzie silnika (Etap A — ok. 30 linii TS)

| ID | Co trzeba dopisać w kodzie i dlaczego | Pliki w repozytorium | Zakres zmian |
|---|---|---|---|
| **F-01** | **Obsługa `hazards` na kondygnacjach innych niż `playerSpawn.y` (np. w piwnicy `y = -5.20 m`) w `validateLayout`:** dla pola `hy = position.y - size.y/2`, dla beczki `hy = position.y`. Dla lasera wybierz najwyższą podłogę parteru lub poziomy blok `walkable` obejmujący rzut całej wiązki, z górną powierzchnią w przedziale `[from.y - 2.0, from.y]`. Brak podparcia jest błędem. Na poziomie `groundY` stosuj `floors`, poza nim poziome `upperFloors` z `top ≈ hy` (tolerancja `FLOOR_EPSILON_M`). Margines 1 m pola i lasera dotyczy spawnów oddalonych od `hy` w pionie o najwyżej 2 m. | `src/world/roomSchema.ts`, `tests/unit/spawnElevation.test.ts` | ~15 linii TS + test jednostkowy hazardu w piwnicy |
| **F-02** | **Rejestracja prefiksu `'lab_'` oraz opraw ściennych i sufitowych laboratorium w `cityModels.ts` i `mapAudit.ts`:**<br>1. W `CITY_MODEL_PREFIXES` (`src/render/cityModels.ts:8`) dopisać `'lab_'`, aby loader zachowywał wielomateriałowość glTF modeli `/assets/models/city/lab_*.glb`.<br>2. W `src/world/mapAudit.ts:24–47` dopisać modele ścienne (`lab_blast_door_frame`, `lab_observation_window`, `lab_corkboard_evidence`, `lab_decon_shower`, `lab_hazmat_suit_rack`) do `WALL_FIXTURES` oraz modele sufitowe (`lab_ceiling_strip`, `lab_ceiling_manifold`) do `CEILING_FIXTURES`. | `src/render/cityModels.ts`, `src/world/mapAudit.ts` | ~15 linii TS |

#### B. Nowe materiały powierzchniowe, profil pogody i tekstury (Etap A/C — dane + zasoby)

| ID | Co trzeba dodać | Gdzie w zasobach / danych | Szczegóły |
|---|---|---|---|
| **F-03** | **3 materiały wykończeniowe tajnego laboratorium w `arenaMaterials.json` i tekstury `surfaces/`:**<br>1. `lab_epoxy_floor` — gładka, bezspoinowa posadzka epoksydowa w chłodnym odcieniu stalowo-grafitowym z delikatną siatką dylatacyjną i wysokim połyskiem odbić (`scale: 0.4, roughness: 0.22, metalness: 0.12, bump: 0.25, wetness: 0.65, tint: "#465466"`) — posadzka laboratoriów parteru i szatni;<br>2. `lab_bunker_concrete` — ciężki, szalowany żelbet podziemnego bunkra z gniazdami ściągów i pionowymi boniami (`scale: 0.25, roughness: 0.78, metalness: 0.05, bump: 0.55, wetness: 0.2, tint: "#3e4858"`) — mury piwnicy `B1`, szybu windy i korytarzy;<br>3. `lab_cleanroom_wall` — modułowe, sterylne panele ścienne ze stali lakierowanej i szczotkowanego aluminium z poziomą listwą techniczną (`scale: 0.5, roughness: 0.35, metalness: 0.25, bump: 0.3, wetness: 0.1, tint: "#58657a"`). | `src/data/render/arenaMaterials.json`, `src/render/urbanMaterials.ts`, `src/render/surfaceTextures.ts`, `src/world/dressingSchema.ts`, `public/assets/textures/surfaces/lab_*.webp` (+ wersje `komiks_lab_*.webp`) | 3 tekstury `.webp` (`1024×1024`) + 3 odpowiedniki komiksowe + wpisy w `BLOCK_MATERIALS` |
| **F-04** | **Profil pogody `src/data/weather/kuroganeSecretLab.json` („Tajny podziemny ośrodek badawczy”):**<br>- `precipitation`: `{ kind: "none" }`, `lightning`: `{ enabled: false }`;<br>- `lighting`: `{ hemiIntensity: 4.2, keyIntensity: 1.5, panoramaEnabled: false }` — gwarancja braku przebijania zewnętrznego miasta `Panorama` i pełnej czytelności brył w ciemnych narożnikach piwnicy (`#2a3344–#56627a`);<br>- `fog`: `{ color: "#0d1320", density: 0, heightM: 10, strength: 0, nearM: 30, farM: 140 }` — **wyzerowana mgła i kurz (`dust.density: 0`)**, co całkowicie zapobiega powstawaniu smug światła i przyciemnianiu piwnicy na `y = -5.20 m`;<br>- `surface`: `{ gloss: 0.68, reflections: 0.82, puddles: 0.18 }` — wyraziste odbicia zielonych i błękitnych kokonów w posadzce epoksydowej;<br>- `ambience`: `[{ kind: "generator", gain: 0.12, radiusM: 95 }]` (niskie buczenie aparatury podtrzymywania życia i serwerów). | `src/data/weather/kuroganeSecretLab.json` | 1 plik JSON |
| **F-05** | **Nowe tekstury szyldów, plakatów „Strefy 51”, zaczernionych dokumentów i easter eggów (`signs/`, `screens/`, `decals/`, `labels/`):** pełna specyfikacja tekstur znajduje się w **sekcji 4.2**. | `public/assets/textures/{signs,screens,decals,labels}/`, `tools/textures/catalog.json` | 8 `signs`, 10 `decals`, 1 `screens`, 1 `labels` (+ 6 `surfaces` w F-03) |

### 2.2. Priorytet P1 — Szlif po pierwszym odbiorze wizualnym

| ID | Co można dodać w kolejnym kroku | Gdzie w kodzie / zasobach | Efekt |
|---|---|---|---|
| **F-06** | **Subtelny ruch bąbelków / pulsowanie bioluminescencji w kokonach (`lab_cocoon_tall`):** powolna modulacja jasności rdzenia `mat_neon_green` / `mat_neon_blue` wewnątrz zbiorników hodowlanych. | `src/render/urbanMaterials.ts` | Efekt żywego inkubatora w piwnicy `B1`. |
| **F-07** | **Zniszczalne szyby w wybranych małych inkubatorach (`lab_cocoon_incubator`):** rozbicie klosza strzałem lub ostrzem wypuszcza chmurę pary `steam`. | `src/world/propPhysics.ts` | Dodatkowa reaktywność otoczenia w walce. |

---

## 3. Projekt architektoniczny mapy `run3` — 8 pomieszczeń (Parter + Piwnica)

### 3.1. Idea, narracja miejsca i klimat „Strefy 51” Kurogane Arms

- **Co to za miejsce:** Utajniony Ośrodek Badawczo-Rozwojowy **Kurogane Arms — Sektor X-51 („Czarne Archiwum / Projekt Chimera”)** ukryty pod przemysłową fasadą korporacji. Na parterze działa ściśle strzeżony kompleks analityczno-laboratoryjny: śluza biometryczna, archiwum utajnionych incydentów z tablicami śledczymi, laboratorium ksenobiologii oraz zbrojownia prototypów badająca przejęte artefakty Rezonansu. Z wysokiego Centralnego Holu wokół szybu windy towarowej szeroka dwubiegowa rampa prowadzi **5,20 m w dół do podziemnego bunkra (Piwnicy)** — gigantycznej Sali Testów Humanoidalnych, w której w szesnastu oświetlonych na zielono i błękitnie szklanych kokonach Kurogane hoduje syntetycznych żołnierzy i bada anomalie humanoidalne, wspieranej przez szatnię dekontaminacyjną oraz podziemną serwerownię.
- **Dlaczego gracz tu jest i co tu się dzieje:** Gracz (Rezonant) przenika przez południową śluzę „Kordon Zero”, by ujawnić dokumentację Projektu Chimera i przebić się do podziemnej śluzy ewakuacyjnej w głębi Sali Testów Humanoidalnych. W ośrodku ogłoszono alarm stopnia OMEGA: wirówki i komory anomalii pracują na przeciążeniu, z pękniętego zbiornika nr 04 na posadzkę piwnicy wylał się parujący płyn elektrolityczny pod napięciem, a na biurkach i tablicach korkowych wciąż leżą porozrzucane teczki `ŚCIŚLE TAJNE` z zaczernionymi akapitami.

### 3.2. Tabela wszystkich 8 pomieszczeń — wymiary, współrzędne, wysokości i palety neonów

Układ współrzędnych świata:
- `+X` = Wschód (prawo), `-X` = Zachód (lewo)
- `+Z` = Południe (dół, strona wejścia `entry` na Parterze), `-Z` = Północ (góra, strona zejścia do Piwnicy i wyjścia `exit`)
- `+Y` = Góra:
  - **PARTER (`L0`):** posadzka `y = 0.000 m` (płyta `y = -1.00..0.00 m`, `walkable: true`),
  - **POMOSTY OBSERWACYJNE PIWNICY (`B1-M`):** `y = -1.600 m` (płyta `y = -2.00..-1.60 m`, `walkable: true`),
  - **PIWNICA (`B1..B3`):** posadzka `y = -5.200 m` (płyta `y = -5.60..-5.20 m`, `walkable: true`).
- Wszystkie granice płyt podłogowych i otworów drzwiowych leżą na **liczbach całkowitych** (pełna zgodność z siatką 1×1 m `validateLayout` w `src/world/roomSchema.ts`).

| Nr | ID | Kondygnacja | Nazwa i temat pomieszczenia | Prostokąt `X` [m] | Prostokąt `Z` [m] | Wymiary i pole | Poziom podłogi `y` | Strop `y` (wys. w świetle `H`) | Dominująca paleta neonów (ADR 0006) |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | **P1** | **PARTER** (`L0`) | **Punkt Kontrolny i Śluza „Kordon Zero”**<br>*(recepcja bezpieczeństwa, bramki biometryczne, dyżurka, skaner)* | `-26 .. -10` | `+14 .. +28` | `16 × 14 m`<br>(`224 m²`) | `0.00 m` | `+4.80 m`<br>(`H = 4.80 m`) | **Bursztyn** `#ffae1a` + **Ciepła biel** `#fff1d6` |
| 2 | **P2** | **PARTER** (`L0`) | **Czarne Archiwum i Sala Odpraw „Strefa 51”**<br>*(sejfy akt, tablice korkowe z nitkami, zaczernione raporty, holo-stół)* | `-26 .. -10` | `0 .. +14` | `16 × 14 m`<br>(`224 m²`) | `0.00 m` | `+4.80 m`<br>(`H = 4.80 m`) | **Ciepła biel** `#fff1d6` + **Bursztyn** `#ffae1a` + akcent **Zieleń** `#6dff4a` (plakat UFO) |
| 3 | **P3** | **PARTER** (`L0`) | **Laboratorium Biochemii i Ksenobiologii**<br>*(dygestoria, wirówki, próbki tkanek, komory laminarnego przepływu)* | `+10 .. +26` | `+14 .. +28` | `16 × 14 m`<br>(`224 m²`) | `0.00 m` | `+4.80 m`<br>(`H = 4.80 m`) | **Zieleń** `#6dff4a` + **Błękit królewski** `#3d7bff` |
| 4 | **P4** | **PARTER** (`L0`) | **Zbrojownia Prototypów i Komora Anomalii**<br>*(stojaki prototypów broni, klatka Faradaya, emiter testowy)* | `+10 .. +26` | `0 .. +14` | `16 × 14 m`<br>(`224 m²`) | `0.00 m` | `+4.80 m`<br>(`H = 4.80 m`) | **Fiolet** `#8a5cff` + **Bursztyn** `#ffae1a` |
| 5 | **P5** | **PARTER** (`L0`) | **Centralny Hol Badawczy i Szyb Windy Towarowej**<br>*(główny węzeł komunikacyjny, szyb windy, zejście rampami do piwnicy)* | `-10 .. +10` | `0 .. +28` | `20 × 28 m`<br>(`560 m²`) | `0.00 m` | `+6.40 m`<br>(`H = 6.40 m`) | **Błękit królewski** `#3d7bff` + **Ciepła biel** `#fff1d6` + **Bursztyn** `#ffae1a` (szyb windy) |
| 6 | **B1** | **PIWNICA** (`B1`) | **Wielka Sala Testów Humanoidalnych („Inkubator Chimera”)**<br>*(16 wielkich szklanych kokonów z humanoidami, rury, kable, pomosty)* | `-20 .. +20` | `-44 .. 0` | `40 × 44 m`<br>(`1 760 m²`) | `-5.20 m`<br>*(pomosty: `-1.60 m`)* | `+4.40 m`<br>(`H = 9.60 m`) | **Zieleń** `#6dff4a` (kokony bio) + **Błękit** `#3d7bff` (kokony krio) + **Bursztyn** `#ffae1a` (pomosty) |
| 7 | **B2** | **PIWNICA** (`B1`) | **Szatnia Dekontaminacyjna i Śluza Personelu**<br>*(szafki, ławki, prysznice odkażające, stojaki z kombinezonami HAZMAT)* | `-32 .. -20` | `-26 .. -10` | `12 × 16 m`<br>(`192 m²`) | `-5.20 m` | `-0.80 m`<br>(`H = 4.40 m`) | **Ciepła biel** `#fff1d6` + **Bursztyn** `#ffae1a` (kombinezony) + **Zieleń** `#6dff4a` (śluza pryszniców) |
| 8 | **B3** | **PIWNICA** (`B1`) | **Podziemne Zaplecze Serwerowe („Krypta Danych”)**<br>*(szafy rack chłodzone cieczą, mainframe, agregaty chłodnicze, kable)* | `+20 .. +32` | `-26 .. -10` | `12 × 16 m`<br>(`192 m²`) | `-5.20 m` | `-0.80 m`<br>(`H = 4.40 m`) | **Błękit królewski** `#3d7bff` + **Fiolet** `#8a5cff` |

**Podsumowanie budżetu powierzchni (zgodność z profilem dużych aren runu):**
- Obrys całkowity mapy: `X ∈ [-32, +32]` (**`64.0 m` szerokości**), `Z ∈ [-44, +28]` (**`72.0 m` długości** — spełnia próg `≥ 70 m`).
- Powierzchnia chodzenia: Parter `1 456 m²` + Piwnica `2 144 m²` + Pomosty obserwacyjne i spoczniki ramp w `B1` (`~410 m²`) = **`~4 010 m²`** (spełnia próg `≥ 3 500 m²`).

### 3.3. Rzuty kondygnacji i przekrój pionowy (ASCII)

#### A. Przekrój podłużny Północ–Południe (`X = ±4.5 m`, widok na Zachód `-X`)

```text
          PÓŁNOC (-Z, PIWNICA B1)                                      POŁUDNIE (+Z, PARTER P5)
Z=-44                   Z=-22                 Z=-14.6     Z=-6.6  Z=-3.6  Z=0                  Z=+28
y=+6.4m                                                                   +====================+ <-- Strop Holu P5 (ceiling: true)
y=+4.4m  +================================================================+   P5 CENTRALNY HOL |
         |   B1 WIELKA SALA TESTÓW HUMANOIDALNYCH (H = 9.60 m)            #   I SZYB TOWAROWY  |
         |   [Kolektory rur i wiązki kabli pod stropem y=+3.8m]           #   [Winda Towarowa] |
y=0.0m   |                                    [Okna obserwacyjne z P2/P4] +--------------------+ <-- Posadzka Parteru L0 (y=0.00m)
         |                [Mostek B1]                 \ Rampa Górna (23.96°)\
y=-1.6m  |==[Pomost N]====(Z=-23..-20)=================[Spocznik y=-1.60m]==+
         |     \            |      |                   / Rampa Dolna (24.23°)
         |      \  [KOKONY] |      | [KOKONY]         /
         |       \ (wys.4.4m)      | (wys.4.4m)      /
y=-5.2m  +[EXIT]==+=========+======+================+==========================================+ <-- Posadzka Piwnicy B1 (y=-5.20m)
       Z=-44.5  Z=-34     Z=-22  Z=-16            Z=-14.6                Z=0
```

#### B. Rzut Kondygnacji 0 — PARTER (`L0`, `y = 0.00 m`, `Z ∈ [0, +28]`)

```text
                                PÓŁNOC (-Z) — WIDOK I ZEJŚCIE DO PIWNICY B1 (y = -5.20 m)
       X=-26                 X=-10         X=-6.4  X=-2.4  X=+2.4  X=+6.4         X=+10                 X=+26
Z=0     +=======[Okno B1]=====+-------------+-------+=======+-------+-------------+=====[Okno B1]=======+  Z=0
        |                     |             ||Rampa|| SZYB  ||Rampa||             |                     |
        |         P2          |             ||Zach.|| WINDY ||Wsch.||             |         P4          |
        |   CZARNE ARCHIWUM   |             ||0 -> || TOWAR.||0 -> ||             |     ZBROJOWNIA      |
        |   I SALA ODPRAW     |             ||-1.6m|| (dekor||-1.6m||             |  PROTOTYPÓW BRONI   |
        |    (16 x 14 m)      |             |       +=======+       |             |   I KOMORA ANOMALII |
        |  [Tablica z nitkami]#  Brama P2/P5|                       |Brama P4/P5  #    (16 x 14 m)      |
        |  [Plakat UFO (EE1)] |  (Z=+5..+9, |    [Konsola Główna]   |(Z=+5..+9,   | [Klatka Anomalii]   |
        |  [Sejfy Akt]        |   szer. 4m) |     (Kubek EE-4)      | szer. 4m)   | [Hazard: LaserGate] |
        |      [Holo-Stół]    |             |                       |             | [Stojaki Prototypów]|
Z=+14   +------+       +------+             |          P5           |             +------+       +------+  Z=+14
        |      Brama P1/P2    #             |     CENTRALNY HOL     |             #   Brama P3/P4       |
        |     (X=-20..-16,    |             |       BADAWCZY        |             |  (X=+16..+20,       |
        |      szer. 4.0m)    |             |     (20 x 28 m)       |             |   szer. 4.0m)       |
        |                     |             |      H = 6.40 m       |             |                     |
        |         P1          #  Brama P1/P5|  [Filary]   [Filary]  |Brama P3/P5  #         P3          |
        |  PUNKT KONTROLNY    | (Z=+19..+23,|                       |(Z=+19..+23, |    LABORATORIUM     |
        |  „KORDON ZERO”      |  szer. 4.0m)|  [Bramka Biometr.]    | szer. 4.0m) |     BIOCHEMII I     |
        |    (16 x 14 m)      |             |   lab_bio_scanner     |             |   KSENOBIOLOGII     |
        | [Dyżurka] [Skaner]  |             |                       |             | [Wirówki] [Dygest.] |
        | [Bariery] [Kamery]  |             |    (START GRACZA)     |             | [Raport Nr 7 (EE3)] |
        |                     |             |    (X=0, Y=0, Z=25)   |             | [Komory Prób]       |
Z=+28   +=====================+=============+========[ENTRY]========+=============+=====================+  Z=+28
       X=-26                 X=-10                  X=0 (Z=28.5)                 X=+10                 X=+26
                                             POŁUDNIE (+Z) — WEJŚCIE
```

#### C. Rzut Kondygnacji -1 — PIWNICA (`B1..B3`, posadzka `y = -5.20 m`, pomosty `y = -1.60 m`, `Z ∈ [-44, 0]`)

```text
                                      PÓŁNOC (-Z) — ŚLUZA EWAKUACYJNA (EXIT)
       X=-32         X=-20     X=-17              X=0              X=+17     X=+20         X=+32
Z=-44                 +=========+==================[EXIT]==================+=========+                 Z=-44
                      |         |         (X=0, Y=-3.7, Z=-44.5)           |         |
                      | [Rampa] |    STREFA EWAKUACJI I DOK KRIOGENICZNY   | [Rampa] |
                      | Pn-Zach.|     [Bariery]            [Beczka Wyb.]   | Pn-Wsch.|
                      | -1.6 -> |                                          | -1.6 -> |
Z=-34                 | -5.2m   +------------------------------------------+ -5.2m   |                 Z=-34
                      |         |  GNIAZDO KOKONÓW NW  |  GNIAZDO KOKONÓW NE         |
                      | POMOST  |  [K-09]   [K-10]     |  [K-13]   [K-14]  | POMOST  |
                      | ZACH.   |  [K-11]   [K-12]     |  [K-15]   [K-16]  | WSCH.   |
Z=-26   +-------------+ (y=-1.6)|                      |                   | (y=-1.6)+-------------+   Z=-26
        |     B2      |  sz.3m  |                      |                   |  sz.3m  |     B3      |
        |  SZATNIA    +---------#======================+===================#---------+  ZAPLECZE   |
        | DEKONTAMI-  |  Brama  |     MOSTEK POMOSTOWY B1 (y=-1.60m, Z=-23.5..-20.5) |  SERWEROWE  |
        |  NACYJNA    | B2->B1 N|         [Konsola Sterowania Inkubatorami]          | („KRYPTA”)  |
        | (12 x 16 m) |(Z=-24.. |                                                    | (12 x 16 m) |
        |  y = -5.2m  |  -20)   |          [HAZARD: Electric Field]                  |  y = -5.2m  |
        |             |         |     (Rozlany elektrolit przy Kokonie 04)           |             |
        | [Prysznice] #         |                                                    # [Szafy Rack]|
        | [Szafki 13] |  Brama  |  GNIAZDO KOKONÓW SW  |  GNIAZDO KOKONÓW SE         | [Mainframe] |
        | [Ławki]     | B2->B1 S|  [K-01]   [K-02]     |  [K-05]   [K-06]  |  Brama  | [Chillery]  |
        | [Kombinezon]|(Z=-16.. |  [K-03] [K-04 PĘKN.!] |  [K-07]   [K-08]  | B3->B1 S| [Tabliczka  |
Z=-10   +-------------+  -12)   |          (EE-8)      |                   |(Z=-16.. |  EVIL CORP] |   Z=-10
                      |         +----------------------+-------------------+  -12)   +-------------+
                      |         |       ||Rampa||            ||Rampa||     |         |
                      |         |       ||Dolna||            ||Dolna||     |         |
                      |         |       ||Zach.||            ||Wsch.||     |         |
Z=-6.6                |         +=======++ -1.6++============++-1.6 ++=====+         |                 Z=-6.6
                      |         |   SPOCZNIK POŚREDNI I GALERIA (y = -1.60 m)        |
Z=-3.6                |         +=======++Rampa++===[SZYB]===++Rampa++=====+         |                 Z=-3.6
                      |                 ||Górna||  [WINDY]   ||Górna||               |
                      |                 ||0->-1.6  [TOWAR.]  ||0->-1.6               |
Z=0                   +=================++=====++============++=====++===============+                 Z=0
                     X=-20            X=-6.4  X=-2.8        X=+2.8  X=+6.4          X=+20
                                    POŁUDNIE (+Z) — STYK Z PARTEREM (P5, P2, P4)
```

### 3.4. Drzwi, przejścia i zejście do piwnicy — weryfikacja ograniczeń nawigacji

Wszystkie przejścia między pomieszczeniami są otwartymi, obramowanymi portalami śluzowymi (`lab_blast_door_frame` z rozsuniętymi pancernymi skrzydłami w ścianie i nadprożem na `y >= 3.20 m`), o świetle przejścia **`3.00–4.00 m` szerokości** (wymóg briefu: `≥ 2.0 m`) i granicach na pełnych metrach:

| Połączenie | Położenie otworu `[X, Z]` | Poziom `y` | Szerokość × Wysokość | Rola w przepływie walki |
|---|---|---|---|---|
| **Wejście `doors[entry]` → P5** | `X ∈ [-2, +2], Z = +28.5` | `y = 0.00 m` | `4.0 × 3.0 m` | Punkt wejścia gracza (`playerSpawn: (0, 0, 25)` w południowej strefie `P5`) |
| **P5 (Hol) ↔ P1 (Kordon Zero)** | `X = -10, Z ∈ [+19, +23]` | `y = 0.00 m` | `4.0 × 3.4 m` | Główne wejście z Holu do zachodnio-południowej śluzy ochrony |
| **P1 (Kordon Zero) ↔ P2 (Czarne Archiwum)** | `X ∈ [-20, -16], Z = +14` | `y = 0.00 m` | `4.0 × 3.4 m` | Przejście wzdłuż skrzydła zachodniego (flanka zachodnia Parteru) |
| **P2 (Czarne Archiwum) ↔ P5 (Hol)** | `X = -10, Z ∈ [+5, +9]` | `y = 0.00 m` | `4.0 × 3.4 m` | Wyjście z Archiwum wprost przed zejście rampami do Piwnicy |
| **P5 (Hol) ↔ P3 (Lab. Biochemii)** | `X = +10, Z ∈ [+19, +23]` | `y = 0.00 m` | `4.0 × 3.4 m` | Główne wejście z Holu do wschodnio-południowego laboratorium |
| **P3 (Lab. Biochemii) ↔ P4 (Zbrojownia)** | `X ∈ [+16, +20], Z = +14` | `y = 0.00 m` | `4.0 × 3.4 m` | Przejście wzdłuż skrzydła wschodniego (flanka wschodnia Parteru) |
| **P4 (Zbrojownia) ↔ P5 (Hol)** | `X = +10, Z ∈ [+5, +9]` | `y = 0.00 m` | `4.0 × 3.4 m` | Wyjście ze Zbrojowni przed zejście rampami do Piwnicy |
| **Rampa Górna Zachodnia (P5 → Spocznik B1)** | `X ∈ [-6.4, -2.8], Z ∈ [-3.6, 0.0]` | `0.00 → -1.60 m` | Szer. `3.6 m`, dł. `3.6 m`, kąt **`23.96°`** (`≤ 26.6°`) | Czysty obrót `rotation.x`; lewy bieg zejścia wokół Szybu Windy Towarowej |
| **Rampa Górna Wschodnia (P5 → Spocznik B1)** | `X ∈ [+2.8, +6.4], Z ∈ [-3.6, 0.0]` | `0.00 → -1.60 m` | Szer. `3.6 m`, dł. `3.6 m`, kąt **`23.96°`** (`≤ 26.6°`) | Czysty obrót `rotation.x`; prawy bieg zejścia wokół Szybu Windy Towarowej |
| **Rampa Dolna Zachodnia (Spocznik → B1)** | `X ∈ [-6.4, -2.8], Z ∈ [-14.6, -6.6]` | `-1.60 → -5.20 m` | Szer. `3.6 m`, dł. `8.0 m`, kąt **`24.23°`** (`≤ 26.6°`) | Czysty obrót `rotation.x`; zejście ze spocznika `-1.60 m` na posadzkę Piwnicy `-5.20 m` |
| **Rampa Dolna Wschodnia (Spocznik → B1)** | `X ∈ [+2.8, +6.4], Z ∈ [-14.6, -6.6]` | `-1.60 → -5.20 m` | Szer. `3.6 m`, dł. `8.0 m`, kąt **`24.23°`** (`≤ 26.6°`) | Czysty obrót `rotation.x`; drugi równoległy bieg na posadzkę Piwnicy `-5.20 m` |
| **2 Rampy Pomostowe Północne (Pomosty → B1)** | `X ∈ [-20, -17]` i `X ∈ [+17, +20]`, `Z ∈ [-42, -34]` | `-1.60 → -5.20 m` | Szer. `3.0 m`, dł. `8.0 m`, kąt **`24.23°`** (`≤ 26.6°`) | Czysty obrót `rotation.x`; pozwalają okrążyć salę `B1` górnymi pomostami i zejść przy wyjściu `exit` |
| **B1 (Sala Kokonów) ↔ B2 (Szatnia — 2 bramy)** | `X = -20, Z ∈ [-16, -12]` oraz `Z ∈ [-24, -20]` | `y = -5.20 m` | `4.0 × 3.2 m` (×2) | Dwa przejścia dające przelotową pętlę przez Szatnię Dekontaminacyjną |
| **B1 (Sala Kokonów) ↔ B3 (Serwerownia — 2 bramy)** | `X = +20, Z ∈ [-16, -12]` oraz `Z ∈ [-24, -20]` | `y = -5.20 m` | `4.0 × 3.2 m` (×2) | Dwa przejścia dające przelotową pętlę przez Zaplecze Serwerowe |
| **Wyjście `doors[exit]` (północ B1)** | `X ∈ [-2, +2], Z = -44.5` | `y = -5.20 m` (`pos.y = -3.70`) | `4.0 × 3.0 m` | Pancerna śluza ewakuacyjna na północnym krańcu Wielkiej Sali Testów Humanoidalnych |

### 3.5. Szczegółowy opis 8 pomieszczeń — wyposażenie, osłony, linie strzału i klimat

#### 1. `P1` — Punkt Kontrolny i Śluza Bezpieczeństwa „Kordon Zero” (`X ∈ [-26, -10], Z ∈ [+14, +28], y = 0.00 m`)
- **Klimat i funkcja:** Pierwsza linia wewnętrznej kontroli dostępu ośrodka. Ciemne, grafitowo-stalowe ściany (`lab_cleanroom_wall`), polerowana posadzka `lab_epoxy_floor` z pasami ostrzegawczymi `hazard_stripes_worn` oraz bursztynowe światło alarmowe `#ffae1a`.
- **Unikalne rekwizyty i osłony:**
  - Centralna bramka skanera biometrycznego `lab_bio_scanner_gate` (`3.2 × 2.6 × 1.4 m`) na `(-18, 0, +21)` z wyświetlaczem sylwetki skanowanego personelu.
  - Pancerna lada dyżurki ochrony `lab_security_desk` (`3.4 × 1.25 × 1.4 m`) na `(-22.5, 0, +24)` z trzema monitorami CCTV (`mat_screen_status`), kubkiem kawy i cokołem dającym twardą osłonę w kucnięciu.
  - 2 szafki depozytowe na broń i karty magnetyczne `lab_classified_cabinet` przy ścianie zachodniej `(-25.2, 0, +18)` oraz automat `city_vending` w narożniku `(-25.0, 0, +26.5)`.
  - 2 zapory `city_barrier` tworzące szykanę przed bramą do `P2` oraz 2 skrzynie `crate` + 2 `crate_small` do Chwytu Rezonansem.
  - Na ścianach: plakat `sign_lab_restricted` („STREFA UTAJNIONA — POZIOM DOSTĘPU OMEGA”), kamery i szafka BHP `mall_security_fixture`.

#### 2. `P2` — Czarne Archiwum i Sala Odpraw „Strefa 51” (`X ∈ [-26, -10], Z ∈ [0, +14], y = 0.00 m`)
- **Klimat i funkcja:** Serce tajemnicy korporacyjnej w duchu „Strefy 51” — pokój analityków badających niewyjaśnione zjawiska Rezonansu i tajne eksperymenty genetyczne. Oświetlony kontrastowym światłem ciepłej bieli `#fff1d6` nad stołem odpraw i bursztynowymi lampkami biurkowymi `#ffae1a`.
- **Unikalne rekwizyty i osłony:**
  - W centrum (`-18, 0, +7`): **Stół Odpraw Taktycznych `lab_briefing_holotable`** (`3.2 × 1.1 × 2.0 m`) z rozłożonymi mapami sektorów, teczkami `ŚCIŚLE TAJNE` i podświetlanym blatem taktycznym (`mat_neon_amber` / `mat_screen_map`) — główna wyspa osłon w środku pokoju.
  - Na ścianie zachodniej (`X = -25.8, Z = +7, Y = 1.1`): wielka **Tablica Korkowa Śledcza z Nitkami `lab_corkboard_evidence`** (`2.8 × 1.6 × 0.18 m`) — przypięte pinezkami zdjęcia sylwetek w kokonach, wycinki prasowe, zaczernione raporty i łączące je **bursztynowo-złote oraz zielone nitki** (zero czerwieni!), a tuż obok przy biurku analityka (`X = -25.8, Z = +11, Y = 1.5`) kultowy plakat **Easter Egg #1: `„WE ARE NOT ALONE”`** (styl klasycznego plakatu z latającym spodkiem UFO nad wieżowcem Kurogane w odcieniach zieleni `#6dff4a` i granatu) oraz na sąsiedniej tablicy suchościeralnej (`X = -25.8, Z = +3`) **Easter Egg #5: schemat `„SKĄD SIĘ BIORĄ REZONANCI? → ??? → ZYSK KWARTALNY”`**.
  - Dwa rzędy pancernych szaf kartotekowych `lab_classified_cabinet` (`1.6 × 2.2 × 0.85 m`) ustawionych prostopadle do ścian (`(-22, 0, +3.5)` i `(-14, 0, +10.5)`), tworzących osłony do walki na krótkim dystansie, z porozrzucanymi na blatach i podłodze zaczernionymi dokumentami (`decal` `lab_redacted_papers`).
  - W ścianie północnej (`Z = 0, X ∈ [-21, -13], Y ∈ [1.0, 3.6]`): szerokie **pancerne okno obserwacyjne `lab_observation_window`** (`8.0 × 2.6 × 0.4 m`, `mat_glass_clear`), przez które z Archiwum widać z wysokości `+5.2 m` wnętrze Wielkiej Sali Testów Humanoidalnych `B1` i zielone kokony w dole!

#### 3. `P3` — Laboratorium Biochemii i Analiz Ksenobiologicznych (`X ∈ [+10, +26], Z ∈ [+14, +28], y = 0.00 m`)
- **Klimat i funkcja:** Sterylne laboratorium mokrej chemii i inżynierii komórkowej, w którym syntetyzuje się płyn odżywczy tłoczony rurami do kokonów w piwnicy. Ściany z białych płytek `tiles_wall` i paneli `lab_cleanroom_wall`, zdominowane przez toksyczną **zieleń** `#6dff4a` i chłodny **błękit** `#3d7bff`.
- **Unikalne rekwizyty i osłony:**
  - 2 wyspowe **Stoły Laboratoryjne z Wirówkami i Mikroskopami `lab_centrifuge_bench`** (`3.2 × 1.45 × 1.1 m`) na `(+15.5, 0, +21)` i `(+20.5, 0, +21)` z rzędami świecących na zielono probówek (`mat_neon_green`) i ekranami chromatografu. Na pierwszym stole leży **Easter Egg #3: zaczerniony raport `„OBIEKT NR 7 — NIE KAWIĆ PO PÓŁNOCY”`**.
  - 2 przeszklone **Komory Dygestoriów / Przepływu Laminarnego `lab_chem_fume_hood`** (`2.4 × 2.4 × 1.1 m`) przy ścianie wschodniej `(+24.8, 0, +18)` i `(+24.8, 0, +24)` z rękawicami manipulacyjnymi i zielono-błękitnym oświetleniem wnętrza (`mat_light_panel`, `mat_neon_green`).
  - 2 małe inkubatory próbek tkankowych `lab_cocoon_incubator` (`1.1 × 2.1 × 1.1 m`) przy ścianie południowej `(+14, 0, +26.5)` i `(+22, 0, +26.5)` — zapowiedź gigantycznych kokonów czekających w piwnicy!
  - Rury `city_pipe_run` ze zielonymi opaskami biegnące od dygestoriów pod strop i schodzące przez podłogę w stronę piwnicy `B1`.

#### 4. `P4` — Zbrojownia Prototypów i Komora Testów Anomalii (`X ∈ [+10, +26], Z ∈ [0, +14], y = 0.00 m`)
- **Klimat i funkcja:** Sekcja inżynierii odwrotnej Kurogane Arms, gdzie testuje się broń plazmową i próbuje ujarzmić energię Rezonansu w klatkach Faradaya. Ciemne, metaliczne wnętrze (`metal`, `tread_plate`) rozświetlone elektrycznym **fioletem** `#8a5cff` oraz ostrzegawczym **bursztynem** `#ffae1a`. Przy terminalu wejściowym (`X = +10.2, Z = +9.4, Y = 1.35`) przyklejona jest żółta karteczka **Easter Egg #6: `„KOD DO ZBROJOWNI: 0451 (NIE ZMIENIAĆ NA 1234!)”`**.
- **Unikalne rekwizyty, osłony i hazard:**
  - W centrum (`+18, 0, +7`): **Komora Przechowywania Anomalii `lab_anomaly_containment_pod`** (`2.8 × 3.2 × 2.8 m`) — ośmiokątna klatka z pierścieniami cewek magnetycznych, pancernym szkłem `mat_glass_clear` i lewitującym w środku fioletowo-bursztynowym rdzeniem anomalii (`mat_neon_violet`, `mat_neon_amber`).
  - **Hazard #1 (`laser_gate`, `id: "prototype-test-beam"`):** przecina zachodni korytarz komory testowej od `(X = +12.5, Y = 0.85, Z = +7.0)` do `(X = +16.2, Y = 0.85, Z = +7.0)` w cyklu `onS: 2.5, offS: 1.8` + **Hazard #2 (`explosive_barrel`, `id: "armory-plasma-cell"`):** przeciążone ogniwo plazmowe na `(+23.5, 0, +3.0)`.
  - 3 pancerne **Stojaki z Prototypami Broni `lab_prototype_weapon_rack`** (`2.4 × 2.2 × 0.8 m`) przy ścianie wschodniej `(+25.0, 0, +5)` i `(+25.0, 0, +10)` oraz przy ścianie południowej `(+14.0, 0, +13.0)`, uzupełnione stołem rusznikarskim `wh_workbench_weapons` i skrzyniami `wh_weapon_case_stack`.
  - W ścianie północnej (`Z = 0, X ∈ [+13, +21], Y ∈ [1.0, 3.6]`): drugie szerokie **pancerne okno obserwacyjne `lab_observation_window`** (`8.0 × 2.6 × 0.4 m`) z widokiem z góry na wschodnią część Sali Testów Humanoidalnych `B1`!

#### 5. `P5` — Centralny Hol Badawczy i Szyb Windy Towarowej (`X ∈ [-10, +10], Z ∈ [0, +28], y = 0.00 m`)
- **Klimat i funkcja:** Monumentalny, wysoki na `6.40 m` węzeł centralny ośrodka, łączący wszystkie 4 pomieszczenia parteru ze zejściem do piwnicy. Posadzka `lab_epoxy_floor` z pasami prowadzącymi z czarnego lastryko `mall_terrazzo_inlay` i żółto-czarnymi strefami ostrzegawczymi `hazard_stripes_worn` wokół szybu windy.
- **Unikalne rekwizyty, osłony i kompozycja kadru startowego (`01-spawn.png`):**
  - **Oś startu (`playerSpawn: (0, 0, +25)`):** całkowicie czysta na wysokości oczu, tak aby w `01-spawn.png` gracz widział w głąb cały Hol, bramkę skanera, szyb windy towarowej na północy oraz otwierającą się za nim wysoką przestrzeń piwnicy `B1`!
  - Na `Z = +18.5, X = 0`: szeroka bramka kontrolna `lab_bio_scanner_gate` (`3.2 × 2.6 × 1.4 m`, światło przejścia `2.6 m` w środku), a po jej bokach na `(±5.5, 0, +18.5)` niskie osłony `lab_security_desk` i filary konstrukcyjne `(±6.5, 3.2, +14.0)` (`1.0 × 6.4 × 1.0 m`).
  - W centrum Holu (`X = 0, Z = +9.5`): **Główna Konsola Nadzoru Ośrodka `lab_mainframe_console`** (`3.0 × 1.35 × 1.4 m`) z zakrzywionymi ekranami statusu kokonów i stojącym na blacie kubkiem **Easter Egg #4: `„NAJLEPSZY LABORANT ROKU (POZOSTALI ZAGINĘLI)”`**.
  - Na północnej krawędzi Holu (`X = 0, Z = -1.6, Y = -5.2..+6.4 m`): potężny, ażurowo-stalowy **Szyb Windy Towarowej `lab_freight_elevator`** (`4.8 × 11.6 × 4.0 m`, dekoracja architektoniczna + blok kolizji szybu), z platformą towarową zatrzymaną między kondygnacjami, pulsującymi bursztynowymi kogutami i napisem ostrzegawczym `WINDA TOWAROWA — UDŹWIG 8 TON // SEKTOR B1`. Po obu bokach szybu (`X ∈ [-6.4, -2.8]` oraz `X ∈ [+2.8, +6.4]`) schodzą w dół dwie szerokie rampy do Piwnicy.

#### 6. `B1` — Wielka Sala Testów Humanoidalnych „Inkubator Chimera” (`X ∈ [-20, +20], Z ∈ [-44, 0], y = -5.20 m` + pomosty `y = -1.60 m`)
- **Klimat i funkcja:** Spektakularna kulminacja mapy `run3` (`1 760 m²`, wysokość `9.60 m` od `y = -5.20 m` do `+4.40 m`). Podziemna hala bunkra z żelbetowymi ścianami `lab_bunker_concrete`, posadzką `turbine_hall_floor` / `lab_epoxy_floor` z kanałami odwadniającymi `steel_grating` i gęstą siecią rur podstropowych `lab_ceiling_manifold`.
- **16 wielkich szklanych kokonów humanoidalnych (`lab_cocoon_tall` i `lab_cocoon_breached`):**
  - Zgrupowane w **4 gniazda badawcze po 4 kokony** (każdy kokon ma wymiary `2.20 × 4.40 × 2.20 m`, stalowy cokół i koronę z kolektorem rur, przezroczysty cylinder `mat_glass_clear`, świecący rdzeń płynu `mat_neon_green` lub `mat_neon_blue` oraz zawieszoną wewnątrz w płynie **humanoidalną sylwetkę obiektu badawczego** z podpiętymi przewodami!):
    1. **Gniazdo Południowo-Zachodnie (Bio-Inkubacja Alfa, zieleń `#6dff4a`):**
       - `K-01`: `(-12.5, -5.2, -14.0)`, `K-02`: `(-7.5, -5.2, -14.0)`, `K-03`: `(-12.5, -5.2, -18.5)`,
       - **`K-04` (`(-7.5, -5.2, -18.5)`): model `lab_cocoon_breached` (PĘKNIĘTY KOKON — Easter Egg #8!)** — roztrzaskana od środka tafla szkła, wygięte pręty, brak sylwetki w środku, ślady stóp prowadzące ku szybowi wentylacyjnemu, odcisk sześcio-palczastej dłoni na szkle i tabliczka `„ZBIORNIK 04 — STAN: PUSTY (SPRAWDZIĆ WENTYLACJĘ)”`!
    2. **Gniazdo Południowo-Wschodnie (Krio-Staza Beta, błękit `#3d7bff`):**
       - `K-05`: `(+7.5, -5.2, -14.0)`, `K-06`: `(+12.5, -5.2, -14.0)`, `K-07`: `(+7.5, -5.2, -18.5)`, `K-08`: `(+12.5, -5.2, -18.5)`.
    3. **Gniazdo Północno-Zachodnie (Bio-Inkubacja Gamma, zieleń `#6dff4a`):**
       - `K-09`: `(-12.5, -5.2, -26.0)`, `K-10`: `(-7.5, -5.2, -26.0)`, `K-11`: `(-12.5, -5.2, -30.5)`, `K-12`: `(-7.5, -5.2, -30.5)`.
    4. **Gniazdo Północno-Wschodnie (Synteza Rezonansu Delta, błękit `#3d7bff` + fiolet `#8a5cff`):**
       - `K-13`: `(+7.5, -5.2, -26.0)`, `K-14`: `(+12.5, -5.2, -26.0)`, `K-15`: `(+7.5, -5.2, -30.5)`, `K-16`: `(+12.5, -5.2, -30.5)`.
  - Nad każdym z 4 gniazd na wysokości `y = -0.80 m .. +4.40 m` zwisa ze stropu rozgałęziony **Kolektor Rur i Koryto Kablowe `lab_ceiling_manifold`** (`6.0 × 5.2 × 5.5 m`), łączący korony czterech kokonów ze stropem hali, dzięki czemu rury i kable mają pełną ciągłość fizyczną od podłogi do sufitu (`0 floatingObject`)!
- **Wielopoziomowość w `B1` — Pomosty Obserwacyjne (`y = -1.60 m`, `3.60 m` nad posadzką piwnicy):**
  - *Pomost Zachodni:* `X ∈ [-20.0, -17.0], Z ∈ [-34.0, -6.6]` (szer. `3.0 m`, `material: "steel_grating"`, `walkable: true`), biegnący nad bramami do Szatni `B2` (prześwit pod pomostem `3.20 m >= 2.20 m`).
  - *Pomost Wschodni:* `X ∈ [+17.0, +20.0], Z ∈ [-34.0, -6.6]` (szer. `3.0 m`, `material: "steel_grating"`, `walkable: true`), biegnący nad bramami do Serwerowni `B3`.
  - *Mostek Centralny B1:* `X ∈ [-17.0, +17.0], Z ∈ [-23.5, -20.5]` (szer. `3.0 m`, `y = -1.60 m`, `walkable: true`), spinający Pomost Zachodni i Wschodni dokładnie w poprzek sali między południowymi a północnymi gniazdami kokonów! Na środku mostka `(0, -1.6, -22.0)` stoi dwustronna konsola nadzoru `lab_mainframe_console` jako twarda osłona na górnym poziomie.
  - Barierki pomostów: moduły `lab_catwalk_rail` (`4.0 × 1.1 × 0.14 m`) z przerwami na wejścia z ramp.
- **Osłony w alejach posadzki `B1` i hazardy:**
  - Główna aleja środkowa (`X ∈ [-5.5, +5.5]`) oraz aleja północna przed `exit` (`Z ∈ [-44, -34]`) nie są puste: stoją w nich konsole pomiarowe `lab_mainframe_console`, stoły z wirówkami `lab_centrifuge_bench`, pancerne skrzynie `wh_weapon_case_stack`, zapory `city_barrier`, 6 zniszczalnych `crate` i 6 dynamicznych `crate_small` (do rzucania Rezonansem w strzelców na pomostach!).
  - **Hazard #3 (`electric_field`, `id: "breached-cocoon-electrolyte"`):** na `(X = -4.5, Y = -5.2, Z = -18.5)`, `size: (3.0, 2.0, 3.6)`, `cycle: { onS: 3.0, offS: 2.2 }` — kałuża przewodzącego elektrolitu rozlana z pękniętego Kokonu nr 04, w którą gracz może wpychać wrogów Pchnięciem Rezonansu lub zrzucać ich z Mostka Centralnego!
  - **Hazard #4 (`explosive_barrel`, `id: "cryo-tank-north"`):** zbiornik ciśnieniowy przy północnym doku ewakuacyjnym na `(+4.5, -5.2, -37.5)`.

#### 7. `B2` — Szatnia Dekontaminacyjna i Śluza Personelu (`X ∈ [-32, -20], Z ∈ [-26, -10], y = -5.20 m`)
- **Klimat i funkcja:** Małe pomieszczenie zaplecza sanitarnego po zachodniej stronie sali kokonów, przez które naukowcy przechodzą przed wejściem do strefy bio-hazard. Posadzka `lab_epoxy_floor` z kratkami odpływowymi `city_vent_grate`, ściany z jasnych płytek `tiles_wall`, oświetlenie `light_panel` `#fff1d6` z zielonym podświetleniem komór prysznicowych `#6dff4a`.
- **Unikalne rekwizyty i osłony:**
  - 4 moduły **Szafek Pracowniczych `lab_locker_bank`** (`2.4 × 2.1 × 0.65 m`) wzdłuż ściany zachodniej (`X = -31.3`) oraz jako środkowa przegroda (`X = -26.0, Z = -18.0`), z których jedna (Szafka nr 13) ma uchylone drzwiczki z **Easter Eggiem #7 (dziennik stażysty Kowalskiego o szeptach z kokonu nr 9)**.
  - 3 **Ławki Szatniowe `lab_locker_bench`** (`2.2 × 0.5 × 0.8 m`) między szafkami — niskie przeszkody do przeskoku/ślizgu.
  - 2 **Stojaki z Kombinezonami Ochronnymi HAZMAT `lab_hazmat_suit_rack`** (`2.2 × 2.1 × 0.75 m`) przy ścianie południowej `(-26, -5.2, -10.8)` — wiszące żółto-bursztynowe kombinezony (`mat_hivis`) z maskami i butlami tlenowymi (natychmiastowa czytelność funkcji pokoju!).
  - 2 przeszklone **Kabiny Pryszniców Dekontaminacyjnych `lab_decon_shower`** (`1.8 × 2.4 × 1.6 m`) przy ścianie północnej `(-28.5, -5.2, -24.8)` i `(-23.5, -5.2, -24.8)` z efektem pary `ambientFx: { kind: "steam" }`.

#### 8. `B3` — Podziemne Zaplecze Serwerowe i Chłodzenie Rdzenia „Krypta Danych” (`X ∈ [+20, +32], Z ∈ [-26, -10], y = -5.20 m`)
- **Klimat i funkcja:** Małe, chłodne pomieszczenie techniczne po wschodniej stronie sali kokonów, przechowujące nagrania z eksperymentów i pompujące chłodziwo do zbiorników. Ciemna posadzka techniczna `power_quay_floor`, ściany `metal`, intensywne światło **błękitu królewskiego** `#3d7bff` i **fioletu** `#8a5cff`.
- **Unikalne rekwizyty i osłony:**
  - 6 szaf serwerowych: 4 nowe **Szafy Serwerowe Chłodzone Cieczą `lab_cryo_server_rack`** (`1.4 × 2.4 × 1.0 m`, ze świecącymi błękitnymi rurkami chłodziwa `mat_neon_blue` za szybą `mat_glass_clear`) ustawione w dwie wyspy na środku `(+25.5, -5.2, -14.5)` i `(+25.5, -5.2, -21.5)` oraz 2 szafy `wh_server_rack` przy ścianie wschodniej.
  - 2 przemysłowe **Agregaty Chłodnicze (Chillery) `lab_chiller_unit`** (`2.6 × 2.2 × 1.3 m`) przy ścianie północnej `(+26.0, -5.2, -24.8)` i południowej `(+26.0, -5.2, -11.2)` z rurami `city_pipe_run` i korytami kablowymi `city_cable_span` pod stropem (`y = -0.90 m`).
  - Konsola diagnostyczna `lab_mainframe_console` przy ścianie wschodniej `(+30.2, -5.2, -18.0)`.
  - **Easter Egg #2:** w północno-wschodnim narożniku za szafą serwerową i agregatem (`X = +31.1, Y = -5.2, Z = -24.6`), częściowo zastawiona skrzynią, stoi oparta ukośnie o ścianę zakurzona, stara tabliczka korporacyjna z napisem **`„HEADQUARTERS OF EVIL CORP”`** (`decal` / panel `sign_evil_corp` w przydymionym bursztynie i mosiądzu).

---

## 4. Katalog zasobów: nowe modele `lab_*`, nowe tekstury, zasoby istniejące i zakazane

### 4.1. Nowe modele 3D (`tools/blender/sets/kurogane_lab.py` → `public/assets/models/city/lab_*.glb`)

Zestaw obejmuje **25 własnych modeli proceduralnych** w Blenderze. Wszystkie modele stosują konwencje projektu (`docs/assets.md`):
- Jednostki: metry, układ glTF Y-up, przód w `+Z`, spód na `Y = 0` (dla modeli sufitowych uchwyty sięgają górnego AABB do styku `ceilingContact` w `mapAudit.ts`).
- Cieniowanie płaskie (flat low-poly) z fazowanymi krawędziami głównych brył, jedna scalona siatka na materiał (`_city_merge_details`), zero wbudowanych tekstur w GLB (`material.map` puste — nadruki UV przez `mat_label_*` i `mat_screen_*`).
- **Rygor materiałów (nauczka z `run2` E3):** wszystkie duże powierzchnie świecące na biało (dyfuzory lamp, podświetlane blaty, wnętrza dygestoriów) używają wyłącznie **`mat_light_panel`** (ciepła biel bez selektywnego bloomu). Kolorowe akcenty emisyjne używają wyłącznie `mat_neon_amber`, `mat_neon_green`, `mat_neon_blue`, `mat_neon_violet`. **Zero `mat_enemy`, `mat_player_cyan`, `mat_power_magenta` i zero czerwonych nitek!**

#### Tabela 1: Modele Wielkiej Sali Testów Humanoidalnych (`B1`), komunikacji, śluz i szatni (`B2`) — 15 modeli

| Lp. | Model (`.glb`) | Wymiary AABB `X × Y × Z` [m] | Punkt zaczepienia (Origin) | Montaż i kolizja w grze | Opis geometrii, sylwetki i materiałów (`mat_*`) | Budżet tri |
|---:|---|---|---|---|---|---:|
| 1 | `lab_cocoon_tall` | `2.20 × 4.40 × 2.20` | Środek spodu cokołu (`x=0, y=0, z=0`), przód panelu w `+Z` | `blok` (`size: 2.2 × 4.4 × 2.2 m`, `instance: true`, twarda kolumna osłony w piwnicy `B1`) | **Wielki szklany kokon / zbiornik hodowlany z humanoidem:** ciężki ośmioboczny cokół ze stali i betonu (`wys. 0.75 m`, `mat_machine`, `mat_metal`, pas `mat_hazard`, terminal kontrolny `mat_screen_status` od `+Z`), wysoki przezroczysty cylinder (`y = 0.75..3.75 m`, `mat_glass_clear` obustronny), wewnątrz świecący rdzeń kolumny płynu (`mat_neon_green`) oraz **wyraźna, ciemna sylwetka humanoidalnej istoty** (`wys. 1.85 m` na `y = 1.35..3.20 m`, `mat_lacquer` / `mat_trim`) w pozie embrionalnej/lewitującej z podpiętymi do pleców i klatki 6 przewodami (`mat_cable`) oraz maską tlenową; u góry głowica kolektora (`y = 3.75..4.40 m`, `mat_machine`, zawory `mat_hivis`, pierścień `mat_light_panel`). | ≤ 1480 |
| 2 | `lab_cocoon_tall_cryo` | `2.20 × 4.40 × 2.20` | Środek spodu cokołu (`x=0, y=0, z=0`), przód w `+Z` | `blok` (`size: 2.2 × 4.4 × 2.2 m`, `instance: true`) | **Wariant krio-stazy wielkiego kokonu (błękitno-fioletowy):** geometria cokołu, klosza `mat_glass_clear` i zawieszonej wewnątrz sylwetki humanoida jak w `lab_cocoon_tall`, lecz z rdzeniem płynu w barwie błękitu królewskiego (`mat_neon_blue`), pierścieniami cewek stabilizacyjnych (`mat_neon_violet`) i oszronionymi kołnierzami zaworów (`mat_light_panel`). Pozwala odróżnić gniazda wschodnie od zachodnich w `B1`. | ≤ 1480 |
| 3 | `lab_cocoon_breached` | `2.40 × 4.40 × 2.40` | Środek spodu cokołu (`x=0, y=0, z=0`), wyrwa w `+Z` | `blok` (`size: 2.4 × 4.4 × 2.4 m`) — unikalny zbiornik nr 04 (Easter Egg #8) | **Rozbity, pusty kokon po ucieczce obiektu:** cokół z pogiętą obudową i migającym bursztynowym alarmem (`mat_neon_amber`), roztrzaskany od wewnątrz płaszcz szklany (`mat_glass_clear` — sterczące trójkątne odłamki szkła u dołu i góry, wielka wyrwa z przodu), zerwane, zwisające na zewnątrz kable i węże (`mat_cable`), **brak sylwetki w środku**, na ocalałej tafli szkła nadruk `mat_label_warning`. | ≤ 1360 |
| 4 | `lab_cocoon_incubator` | `1.10 × 2.10 × 1.10` | Środek spodu (`x=0, y=0, z=0`), przód w `+Z` | `blok` (`size: 1.1 × 2.1 × 1.1 m`, `instance: true`) | **Mniejszy inkubator laboratoryjny (próbki i zarodki):** podstawa na kółkach blokowanych (`mat_machine`, `mat_rubber`), szklany cylinder `mat_glass_clear` (`y = 0.85..1.85 m`) z mniejszą formą organiczną/rdzeniem `mat_neon_green` w środku, klawiatura i ekranik `mat_screen_status`. Używany w `P3` (Biochemia) i przy konsolach w `B1`. | ≤ 760 |
| 5 | `lab_ceiling_manifold` | `6.00 × 5.20 × 5.50` | Środek spodu (`x=0, y=0, z=0` na poziomie koron kokonów `y = -0.80 m`), uchwyty górne na `y = +5.20 m` (styk ze stropem `B1` na `y = +4.40 m`) | `decor` (`CEILING_FIXTURES`) — spina 4 kokony jednego gniazda ze stropem hali `B1` | **Podstropowy kolektor rur odżywczych i wiązek kabli nad gniazdem 4 kokonów:** 4 pionowe kolumny rur (`mat_metal`, `mat_cable`, opaski `mat_hivis`) trafiające dokładnie w środki 4 kokonów (`x = ±2.5 m, z = ±2.25 m`), połączone u góry poziomą kratownicą z zaworami, puszkami rozgałęźnymi i podświetlonymi przepływomierzami (`mat_neon_green`, `mat_neon_blue`). | ≤ 1120 |
| 6 | `lab_freight_elevator` | `4.80 × 11.60 × 4.00` | Środek podstawy w piwnicy (`x=0, y=0, z=0`, montowany na `y = -5.20 m`, sięga stropu Holu `P5` na `y = +6.40 m`) | `decor` + blok kolizji szybu `4.8 × 11.6 × 4.0 m` (`visible: false`) między dwiema rampami zejścia | **Szyb ciężkiej windy towarowej Kurogane:** 4 stalowe słupy kratownicowe z prowadnicami zębatymi (`mat_metal`, `mat_machine`), poprzeczne belki z pasami `mat_hazard` na poziomie Parteru (`y = 5.20 m` lokalnie) i Piwnicy (`y = 0`), ciężka platforma towarowa z żółto-czarnymi barierkami zatrzymana w połowie szybu (`y = 2.80 m` lokalnie) ze skrzynią ładunkową, grubymi linami stalowymi (`mat_cable`) i kogutami `mat_neon_amber`. | ≤ 1460 |
| 7 | `lab_bio_scanner_gate` | `3.20 × 2.60 × 1.40` | Środek podstawy (`x=0, y=0, z=0`); wolny prześwit przejścia w środku `2.20 × 2.30 m` wzdłuż osi `Z` | `decor` + **2 boczne bloki kolizji** (`0.5 × 2.6 × 1.4 m` na `x = ±1.35 m`, `visible: false`) — gracz i AI przechodzą swobodnie środkiem! | **Bramka skanera biometrycznego i detekcji Rezonansu:** dwa masywne pylony boczne (`mat_machine`, `mat_trim`) połączone górnym nadprożem z wyświetlaczem `mat_screen_status`, wewnętrzne pierścienie skanujące (`mat_neon_amber` i `mat_neon_green`), boczne osłony ze szkła `mat_glass_clear` i tabliczki ostrzegawcze `mat_label_warning`. | ≤ 780 |
| 8 | `lab_blast_door_frame` | `4.80 × 3.80 × 0.60` | Środek spodu (`x=0, y=0, z=0`); światło otwartego przejścia w środku `4.00 × 3.40 m` | `decor` (`WALL_FIXTURES`) — montowany w ościeżach ścian działowych o szerokości `4.0 m` | **Portal pancernej grodzi laboratoryjnej (otwarty):** fazowana stalowa ościeżnica bunkrowa (`mat_metal`, `mat_trim`), wsunięte częściowo w boczne kieszenie zębate skrzydła grodzi z pasami `mat_hazard`, górny panel sygnalizacyjny z zieloną diodą odblokowania (`mat_neon_green`) i numerem sektora (`mat_label_stencil`). | ≤ 580 |
| 9 | `lab_observation_window` | `8.00 × 2.60 × 0.45` | Środek spodu ramy (`x=0, y=0, z=0`); długość w `X`, przód w `+Z` | `decor` (`WALL_FIXTURES`) + blok kolizji `8.0 × 2.6 × 0.4 m` (`material: "glass_clear"`, `visible: false`) w ścianie `Z = 0` między `P2`/`P4` a `B1` | **Pancerne okno obserwacyjne z widokiem na salę kokonów:** stalowa rama ze śrubami dociskowymi (`mat_metal`, `mat_trim`), trzy szerokie tafle przezroczystego szkła zbrojonego (`mat_glass_clear`), dolny parapet z pulpitem mikrofonu interkomu i podświetloną listwą `mat_light_panel`. | ≤ 440 |
| 10 | `lab_security_desk` | `3.40 × 1.25 × 1.40` | Środek podstawy (`x=0, y=0, z=0`), front w `+Z` | `blok` (`size: 3.4 × 1.25 × 1.4 m`, `instance: true`, twarda osłona) | **Pancerna lada punktu kontrolnego i ochrony:** pochylony front z płyt stalowych (`mat_metal`, `mat_lacquer`, pas `mat_hivis`), blat roboczy na `y = 0.95 m` z trzema monitorami CCTV (`mat_screen_status`), czytnikiem kart, mikrofonem i niską nadstawką kuloodporną (`y = 1.25 m`). | ≤ 680 |
| 11 | `lab_catwalk_rail` | `4.00 × 1.10 × 0.14` | Środek spodu (`x=0, y=0, z=0`); długość w `X` | `blok` (`size: 4.0 × 1.1 × 0.14 m`, `instance: true`) — barierka pomostów `y = -1.60 m` w `B1` i spoczników ramp | **Przemysłowa balustrada pomostu laboratoryjnego:** dolny krawężnik ochronny (`wys. 0.15 m`, `mat_hazard`), trzy słupki stalowe (`mat_metal`), poprzeczka pośrednia, górna poręcz rurowa (`mat_hivis`) z podświetleniem dolnym `mat_light_panel` i siatka zabezpieczająca. | ≤ 260 |
| 12 | `lab_ceiling_strip` | `2.40 × 0.35 × 0.60` | Środek spodu klosza (`x=0, y=0, z=0`); wieszaki sięgają `y = +0.35 m` | `decor` (`CEILING_FIXTURES`, montowany `0.35 m` pod stropem na Parterze i w Piwnicy) | **Sterylna oprawa oświetleniowa cleanroomu / bunkra:** obudowa ze stali nierdzewnej (`mat_metal`, `mat_trim`), podwójny mleczny dyfuzor w materiale **`mat_light_panel`** (ciepła biel bez smug bloomu!) i dwa wieszaki stropowe. | ≤ 220 |
| 13 | `lab_locker_bank` | `2.40 × 2.10 × 0.65` | Środek podstawy (`x=0, y=0, z=0`), drzwiczki w `+Z` | `blok` (`size: 2.4 × 2.1 × 0.65 m`, `instance: true`) — Szatnia `B2` | **Zespół 6 stalowych szafek pracowniczych:** korpus (`mat_metal`, `mat_lacquer`), żaluzje wentylacyjne na drzwiczkach, tabliczki imienne (`mat_label_barcode`), jedna szafka (nr 13) z lekko uchylonymi drzwiczkami i przyklejoną wewnątrz notatką (`mat_light_panel`). | ≤ 640 |
| 14 | `lab_locker_bench` | `2.20 × 0.50 × 0.80` | Środek podstawy (`x=0, y=0, z=0`) | `blok` (`size: 2.2 × 0.5 × 0.8 m`, `instance: true`) — Szatnia `B2` | **Ławka szatniowa:** stalowy stelaż z czarnych profili (`mat_trim`), siedzisko z impregnowanych listew (`mat_wood` / `mat_plastic`) oraz stojak na buty ochronne pod spodem. | ≤ 240 |
| 15 | `lab_decon_shower` | `1.80 × 2.40 × 1.60` | Środek podstawy (`x=0, y=0, z=0`), tył na `z = -0.80 m`, wejście w `+Z` | `decor` (`WALL_FIXTURES`) + 2 boczne kolidery ścianek (`0.12 × 2.4 × 1.6 m`, `visible: false`) — Szatnia `B2` | **Kabina prysznica dekontaminacyjnego:** brodzik z kratownicą `mat_steel_grating`, boczne ścianki z przezroczystego szkła `mat_glass_clear` z żółto-czarnymi pasami ostrzegawczymi, górna deszczownica i boczne dysze odkażające (`mat_metal`, `mat_hivis`) oraz zielona lampa stanu `mat_neon_green`. | ≤ 620 |

#### Tabela 2: Modele wyposażenia tematycznego (`P2`, `P3`, `P4`, `B2`, `B3`) i Easter Eggów — 10 modeli

| Lp. | Model (`.glb`) | Wymiary AABB `X × Y × Z` [m] | Punkt zaczepienia (Origin) | Montaż i kolizja w grze | Opis geometrii, sylwetki i materiałów (`mat_*`) | Budżet tri |
|---:|---|---|---|---|---|---:|
| 16 | `lab_hazmat_suit_rack` | `2.20 × 2.10 × 0.75` | Środek spodu (`x=0, y=0, z=0`), tył przy ścianie, przód w `+Z` | `blok` (`size: 2.2 × 2.1 × 0.75 m`, `instance: true`, również w `WALL_FIXTURES`) — Szatnia `B2` i Śluza `P1` | **Stojak z 3 kombinezonami ochronnymi HAZMAT:** stalowa rama z górną belką (`mat_metal`), trzy zawieszone na wieszakach pełne sylwetki żółto-bursztynowych kombinezonów przeciwchemicznych (`mat_hivis`) z czarnymi rękawicami i butami (`mat_rubber`), hełmami z szybką (`mat_glass_clear`) oraz żółtymi butlami tlenowymi na półce. | ≤ 1180 |
| 17 | `lab_corkboard_evidence` | `2.80 × 1.60 × 0.18` | Środek spodu ramy (`x=0, y=0, z=0`), tył na `z = 0`, wystaje w `+Z` | `decor` (`WALL_FIXTURES`, montowany na ścianie na `y = 1.05 m`) — Czarne Archiwum `P2` i Biochemia `P3` | **Tablica korkowa śledcza z nitkami („Strefa 51”):** aluminiowa rama (`mat_metal`) z górną listwą oświetleniową (`mat_light_panel`), podkład korkowy (`mat_wood`), 14 przypiętych kartek, zdjęć kokonów, map i zaczernionych dokumentów (`mat_light_panel`, `mat_plaster`, `mat_label_warning`, `mat_screen_map`) połączonych siecią **bursztynowych (`mat_neon_amber`) i zielonych (`mat_neon_green`) nitek** (zero czerwieni!). | ≤ 580 |
| 18 | `lab_classified_cabinet` | `1.60 × 2.20 × 0.85` | Środek podstawy (`x=0, y=0, z=0`), front szuflad w `+Z` | `blok` (`size: 1.6 × 2.2 × 0.85 m`, `instance: true`) — Czarne Archiwum `P2` i Śluza `P1` | **Pancerna szafa kartotekowa na ściśle tajne akta:** dwa pionowe słupki po 5 szuflad z szyfrowymi zamkami (`mat_container_graphite`, `mat_metal`), jedna środkowa szuflada wysunięta na `0.25 m` z widocznymi teczkami z bursztynową pieczęcią `mat_hivis`, na wierzchu szafy stos segregatorów i pudeł archiwalnych. | ≤ 560 |
| 19 | `lab_briefing_holotable` | `3.20 × 1.10 × 2.00` | Środek podstawy (`x=0, y=0, z=0`) | `blok` (`size: 3.2 × 1.1 × 2.0 m`, `instance: true`, główna osłona w `P2`) | **Stół odpraw taktycznych i analizy anomalii:** masywny cokół (`mat_machine`, `mat_trim`), wpuszczony w blat poziomy ekran taktyczny (`mat_screen_map`, obrys `mat_neon_amber`), na brzegach blatu rozrzucone teczki z zaczernionymi stronami, laptop polowy i niska trójwymiarowa makieta kompleksu. | ≤ 720 |
| 20 | `lab_chem_fume_hood` | `2.40 × 2.40 × 1.10` | Środek podstawy (`x=0, y=0, z=0`), okno robocze w `+Z` | `blok` (`size: 2.4 × 2.4 × 1.1 m`, `instance: true`) — Lab. Biochemii `P3` | **Komora dygestorium / boks rękawicowy bio-hazard:** szafka dolna z zaworami gazów (`mat_cleanroom_wall` / `mat_metal`, naklejka `mat_label_warning`), przeszklona komora robocza (`mat_glass_clear`) z dwiema czarnymi rękawicami w portach (`mat_rubber`), wewnątrz kolby i zlewki ze świecącym zielonym roztworem (`mat_neon_green`), u góry sufit `mat_light_panel` i króciec wyciągu. | ≤ 860 |
| 21 | `lab_centrifuge_bench` | `3.20 × 1.45 × 1.10` | Środek podstawy (`x=0, y=0, z=0`) | `blok` (`size: 3.2 × 1.45 × 1.1 m`, `instance: true`, osłona w `P3` i `B1`) | **Wyspowy stół laboratoryjny z wirówkami i aparaturą:** stalowo-epoksydowy stół (`wys. blatu 0.92 m`, `mat_metal`, `mat_lacquer`), nadstawka instalacyjna z gniazdami i lampą `mat_light_panel` (`y = 1.45 m`), na blacie dwie cylindryczne wirówki z przezroczystymi pokrywami, statywy z probówkami (`mat_neon_green`, `mat_neon_blue`), mikroskop i monitor analizatora (`mat_screen_status`). | ≤ 940 |
| 22 | `lab_prototype_weapon_rack` | `2.40 × 2.20 × 0.80` | Środek podstawy (`x=0, y=0, z=0`), ekspozycja w `+Z` | `blok` (`size: 2.4 × 2.2 × 0.8 m`, `instance: true`) — Zbrojownia Prototypów `P4` | **Pancerna gablota testowa prototypów uzbrojenia:** grafitowy korpus (`mat_container_graphite`, `mat_metal`), przesuwne drzwi z przezroczystego szkła `mat_glass_clear`, perforowana ścianka tylna podświetlona fioletem (`mat_neon_violet`) i ciepłą bielą (`mat_light_panel`), na uchwytach makiety eksperymentalnych korpusów karabinów, cewek plazmowych i rękojeści oraz podpięte kable pomiarowe. | ≤ 880 |
| 23 | `lab_anomaly_containment_pod` | `2.80 × 3.20 × 2.80` | Środek podstawy (`x=0, y=0, z=0`) | `blok` (`size: 2.8 × 3.2 × 2.8 m`, centralna osłona w `P4`) | **Klatka Faradaya i komora badania anomalii Rezonansu:** ośmioboczna podstawa i głowica z czterema łukowymi cewkami magnetycznymi (`mat_machine`, `mat_metal`, pasy `mat_hazard`), osłony z grubego szkła `mat_glass_clear`, a w geometrycznym środku zawieszony między emiterami wielościenny kryształ/rdzeń anomalii świecący fioletem (`mat_neon_violet`) i bursztynem (`mat_neon_amber`). | ≤ 1160 |
| 24 | `lab_cryo_server_rack` | `1.40 × 2.40 × 1.00` | Środek podstawy (`x=0, y=0, z=0`), drzwi w `+Z` | `blok` (`size: 1.4 × 2.4 × 1.0 m`, `instance: true`) — Serwerownia `B3` i Archiwum `P2` | **Szafa superkomputera chłodzona cieczą:** czarno-grafitowa obudowa (`mat_lacquer`, `mat_trim`), przeszklone drzwi frontowe (`mat_glass_clear`), za którymi widać kasety procesorów oraz cztery pionowe rurki ze świecącym błękitnym chłodziwem (`mat_neon_blue`) i fioletowymi diodami (`mat_neon_violet`), u góry kolektor rurowy. | ≤ 820 |
| 25 | `lab_mainframe_console` | `3.00 × 1.35 × 1.40` | Środek podstawy (`x=0, y=0, z=0`), operator od `+Z` | `blok` (`size: 3.0 × 1.35 × 1.4 m`, `instance: true`, osłona w `P5`, `B1`, `B3`) | **Główny pulpit sterowniczy ośrodka (z kubkiem EE-4):** półokrągły stół operatorski (`mat_machine`, `mat_trim`), trzy pochylone ekrany panoramiczne (`mat_screen_status`, `mat_screen_lab_biomonitor`), podświetlana klawiatura (`mat_light_panel`, `mat_neon_blue`), panel z bursztynowym grzybkiem wyłącznika awaryjnego (`mat_neon_amber`) oraz stojący po prawej stronie blatu kubek termiczny z nadrukiem `mat_label_lab_mug`. | ≤ 840 |

*(Uwaga: agregaty chłodnicze w `B3` mogą korzystać z istniejącego modelu `city_smog_scrubber` / `city_roof_hvac_unit` lub opcjonalnego 26. modelu pomocniczego `lab_chiller_unit` `2.6 × 2.2 × 1.3 m`, ≤ 780 tri).*

### 4.2. Lista nowych tekstur (szyldy, plakaty, notatki/decale, ekrany, powierzchnie)

Wszystkie nowe tekstury muszą przestrzegać palety Neon Noir (zero pikseli w paśmie czerwieni `358.4° ± 13°`, cyanu `186.1° ± 13°` i magenty `311.6° ± 13°` przy `S >= 0.55, V >= 0.5`). Wszystkie napisy są po polsku, z wyjątkiem dwóch wymaganych przez użytkownika angielskich haseł easter eggów (`WE ARE NOT ALONE` oraz `HEADQUARTERS OF EVIL CORP`):

| Kategoria / Folder | Identyfikator tekstury | Rozmiar i format | Treść, kolorystyka i zastosowanie na mapie `run3` |
|---|---|---|---|
| **Szyldy i tablice (`public/assets/textures/signs/`)** | `lab_restricted_omega` | RGB `512×256` `.webp` | **`ZAKAZ WSTĘPU // POZIOM DOSTĘPU: OMEGA`** — bursztynowo-biała tablica ostrzegawcza z piktogramem bio-hazardu i kłódki nad śluzami w `P1`, `P5` i `B1`. |
| `signs/` | `lab_sector_x51` | RGB `512×256` `.webp` | **`SEKTOR X-51 // OŚRODEK BADAŃ SPECJALNYCH`** — błękitno-biały szyld identyfikacyjny w Centralnym Holu `P5` i nad zejściem do piwnicy. |
| `signs/` | `lab_chimera_incubator` | RGB `512×256` `.webp` | **`PROJEKT CHIMERA // KOMORA INKUBACJI B1`** — zielono-błękitny neon nad głównym portalem Wielkiej Sali Testów Humanoidalnych `B1`. |
| `signs/` | `lab_black_archive` | RGB `512×256` `.webp` | **`CZARNE ARCHIWUM // AKTA UTAJNIONE`** — bursztynowy szyld nad wejściem do `P2`. |
| `signs/` | `lab_xenobio_lab` | RGB `512×256` `.webp` | **`LABORATORIUM BIOCHEMII // STREFA SKAŻENIA`** — zielony szyld nad wejściem do `P3`. |
| `signs/` | `lab_prototype_armory` | RGB `512×256` `.webp` | **`ZBROJOWNIA PROTOTYPÓW // TESTY ANOMALII`** — fioletowo-bursztynowy szyld nad wejściem do `P4`. |
| `signs/` | `lab_decon_lockers` | RGB `512×256` `.webp` | **`SZATNIA DEKONTAMINACYJNA // OBOWIĄZEK ODKAŻANIA`** — szyld nad wejściami do `B2`. |
| `signs/` | `lab_data_vault` | RGB `512×256` `.webp` | **`KRYPTA DANYCH // SERWEROWNIA RDZENIA`** — błękitny szyld nad wejściami do `B3`. |
| **Easter Eggi i plakaty (`public/assets/textures/decals/` lub `signs/`)** | `poster_we_are_not_alone` | RGBA `512×768` `.webp` | **Easter Egg #1:** klasyczny plakat z sylwetką latającego spodka (UFO) rzucającego zielony snop światła nad nocnym wieżowcem i dużym napisem **`WE ARE NOT ALONE`** (zieleń `#6dff4a`, błękit `#3d7bff`, ciepła biel `#fff1d6` na ciemnogranatowym tle). Montowany w `P2` przy tablicy śledczej. |
| `decals/` (lub `signs/`) | `plaque_evil_corp` | RGBA `512×256` `.webp` | **Easter Egg #2:** mosiężno-grafitowa, porysowana i zakurzona tabliczka korporacyjna z wygrawerowanym napisem **`HEADQUARTERS OF EVIL CORP`** (złocisty mosiądz `#c8963e`, patyna `#3a4454`). Ukryta w kącie za szafą serwerową w `B3`. |
| `decals/` | `note_object_07` | RGBA `512×512` `.webp` | **Easter Egg #3:** formularz raportu Kurogane Arms z czarnymi pasami cenzury (`[ZACZERNIONO]`) i odręcznym dopiskiem w bursztynie: **`OBIEKT NR 7 — NIE KAWIĆ PO PÓŁNOCY (+400% TELEKINEZY)`** (na stole w `P3`). |
| `decals/` | `board_resonance_profit` | RGBA `768×512` `.webp` | **Easter Egg #5:** rysunek na tablicy suchościeralnej: **`SKĄD SIĘ BIORĄ REZONANCI? → [ANOMALIA] → [???] → ZYSK KWARTALNY`** z dopiskiem *„Nie wspominać Zarządowi o zbiorniku 04!”* (`P2`). |
| `decals/` | `sticky_code_0451` | RGBA `256×256` `.webp` | **Easter Egg #6:** żółta karteczka samoprzylepna przy klawiaturze śluzy `P4`: **`KOD: 0451 (NIE ZMIENIAĆ NA 1234!)`**. |
| `decals/` | `note_intern_locker13` | RGBA `512×512` `.webp` | **Easter Egg #7:** kartka w szafce nr 13 w `B2`: **`STAŻYSTA KOWALSKI // DZIEŃ 5: KOKON NR 9 PYTAŁ, KTÓRA GODZINA`**. |
| `decals/` | `cocoon_04_empty_hand` | RGBA `512×512` `.webp` | **Easter Egg #8:** zielonkawo-bursztynowy odcisk sześcio-palczastej dłoni na szkle i tabliczka **`ZBIORNIK 04 — STAN: PUSTY (SPRAWDZIĆ WENTYLACJĘ)`** przy `lab_cocoon_breached` w `B1`. |
| **Notatki i oznakowanie BHP (`public/assets/textures/decals/`)** | `lab_redacted_papers` | RGBA `512×512` `.webp` | Rozsypane kartki A4 i teczki z pieczęcią **`ŚCIŚLE TAJNE`** oraz czarnymi paskami cenzury (na biurkach i podłodze w `P2`, `P3`, `P5`). |
| `decals/` | `lab_biohazard_warning` | RGBA `512×512` `.webp` | Szablon podłogowy i ścienny **`STREFA BIO-HAZARD // POZIOM 4`** w bursztynie i zieleni (przed kokonami w `B1`, w `P3` i `B2`). |
| `decals/` | `lab_clearance_line` | RGBA `512×256` `.webp` | Linie korytarzy komunikacyjnych z napisem **`STREFA AUTORYZOWANA — SEKTOR X-51`** prowadzące z `P5` po rampach do `B1`. |
| **Ekrany i etykiety UV (`screens/`, `labels/`)** | `screen_lab_biomonitor` | RGB `512×512` `.webp` | Ekran parametrów życiowych obiektu w kokonie: zielono-błękitny wykres EKG, skan sylwetki humanoida i napis **`INKUBACJA: STABILNA // SYNTEZA 87%`**. |
| `labels/` | `label_lab_mug` | RGBA `256×256` `.webp` | **Easter Egg #4 (UV na kubku w `lab_mainframe_console`):** napis **`NAJLEPSZY LABORANT ROKU (POZOSTALI ZAGINĘLI)`**. |
| **Powierzchnie (`surfaces/` + `komiks/surfaces/`)** | `lab_epoxy_floor`, `lab_bunker_concrete`, `lab_cleanroom_wall` | RGB `1024×1024` `.webp` (×6 z wersjami komiksowymi) | 3 tekstury kafelkowalne opisane w **F-03** (`§2.1.B`). |

### 4.3. Zasoby istniejące do ponownego użycia oraz zasoby zakazane na mapie `run3`

#### A. Dozwolone istniejące modele i tekstury (pasujące do tajnego ośrodka Kurogane Arms)
- **Z zestawu magazynu Kurogane (`wh_*`):**
  - `wh_server_rack` (`1.2 × 2.4 × 1.0 m`) — dodatkowe szafy serwerowe w `B3` i `P2`,
  - `wh_workbench_weapons` (`2.4 × 1.5 × 0.9 m`) — stół rusznikarski w Zbrojowni Prototypów `P4`,
  - `wh_weapon_case_stack` (`1.6 × 1.1 × 1.2 m`) — pancerne skrzynie na broń Kurogane w `P4`, `P1` i przy doku `B1`,
  - `wh_wall_terminal` (`1.42 × 0.93 × 0.2105 m`, `WALL_FIXTURES`) — terminale dostępowe przy grodziach śluzowych.
- **Z zestawu technicznego i bezpieczeństwa (`city_*`, `mall_*`, bazowe):**
  - `mall_security_fixture` (`0.9 × 1.3 × 0.35 m`, `WALL_FIXTURES`) — szafka BHP, przycisk alarmowy i kamera CCTV (w barwie bursztynowo-grafitowej, zero czerwieni) — montowane gęsto na słupach i przy śluzach („Strefa 51” pełna kamer!),
  - `city_pipe_run` (`0.78 × 6.06 × 0.374 m`, `WALL_FIXTURES`) — piony rur odżywczych i chłodniczych w `B1`, `B3`, `P3`,
  - `city_cable_span` (`10.0 × 1.104 × 0.429 m`, `ends`) — przewieszenia kabli pod stropem `B3` i `B1` (oba końce zakotwiczone w ścianach/słupach `< 0.32 m`),
  - `city_vent_grate` (`1.0 × 0.05 × 1.0 m`) — kratki wentylacyjne i odpływowe w `B1`, `B2`, `P3`,
  - `city_ac_unit` (`0.907 × 0.604 × 0.518 m`, `WALL_FIXTURES`) — wymienniki chłodzenia w serwerowni `B3`,
  - `city_door` (`1.505 × 2.465 × 0.238 m`, `WALL_FIXTURES`) — zaryglowane drzwi bocznych komór technicznych,
  - `city_barrier` (`2.0 × 0.929 × 0.51 m`) — zapory ochronne w śluzie `P1` i doku ewakuacyjnym `B1`,
  - `city_vending` (`1.014 × 2.0 × 0.816 m`) — automat z napojami dla nocnej zmiany w `P1` i `B2`,
  - `crate` (`1.0 × 1.0 × 1.0 m`, zniszczalna) oraz `crate_small` (`0.5 × 0.5 × 0.5 m`, dynamiczna do Chwytu Rezonansem), rozciągliwe `pillar`, `cover_low`, `wall_segment`.
- **Istniejące materiały i decale:** `tiles_wall`, `tread_plate`, `steel_grating`, `power_quay_floor`, `turbine_hall_floor`, `glass_clear`, `light_panel`, `hazard_stripes_worn`, `container_graphite`, `lacquer`, `metal`, `trim`, `floor_arrow`, `floor_hazard`, `floor_stop`, `puddle1`, `puddle2`, `oil_stain`, `leak_streak`.

#### B. Zasoby ZAKAZANE w `run3` (ochrona spójności stylistycznej oraz brak smug wolumetrycznych)
1. **Zakaz modeli handlowo-sklepowych z galerii (`mall_*` poza `mall_security_fixture`):** zakaz używania `mall_mannequin` (humanoidy są wewnątrz `lab_cocoon_tall`, nie w płaszczach sklepowych!), `mall_shoe_wall`, `mall_clothes_rack*`, `mall_cafe_set`, `mall_kiosk`, `mall_fountain`, `mall_showcar`, `mall_escalator`, `mall_storefront`, `mall_shutter_grille`, `mall_planter`.
2. **Zakaz modeli ulicznych, drogowych, portowych i obozowych:** zakaz `city_car`, `city_wrecked_car`, `city_dumpster`, `city_trash_bags`, `city_stall`, `city_market_stall_canopy*`, `port_container_*`, `port_gantry_crane`, `port_ship_*`, `rail_*`, `dock_*`, `hw_camp_*`, `hw_gas_*`.
3. **Zakaz modeli generujących automatyczne stożki wolumetryczne (smugi):** bezwzględny zakaz `city_street_lamp` oraz `city_lantern_string` (`src/render/city/lamps.ts`).

---

## 5. Konfiguracja walki, spawny, hazardy i oświetlenie (bez smug)

### 5.1. Blok `arena`, dyrektor walki i 16 punktów spawnu wrogów (`spawnPoints` z `y`)

Pokój `run3.json` ma `"type": "combat"` oraz blok `arena`:
- `"navigationCellM": 0.5`, `"navigationClearanceM": 0.4`, `"navigationMaxRiseM": 0.55`, `"navigationHeadroomM": 2.2`, `"batchCellM": 24`,
- `"spawnRing": { "minM": 10, "maxM": 28 }`, `"maxAlive": 10`, `"minSpawnDistance": 10`,
- Punkty kontrolne wymagane przez `capturePointsSchema`: `A: (0, 0, +14)` (Centralny Hol `P5`), `B: (0, -1.6, -22)` (Mostek Centralny `B1`), `C: (0, -5.2, -36)` (Północna część Sali Kokonów `B1`).

**Tabela 16 punktów spawnu wrogów (`spawnPoints`) — rozłożonych na Parterze (`y = 0.0 m`) i w Piwnicy (`y = -1.6 m` oraz `y = -5.2 m`):**

| Nr | Współrzędne `{ x, y, z }` | Kondygnacja | Pomieszczenie | Rola taktyczna w starciu |
|---:|---|---|---|---|
| **1** | `{ "x": -18, "y": 0, "z": 17 }` | **Parter** (`0.0 m`) | **P1** (Punkt Kontrolny „Kordon Zero”) | Strażnik za bramką biometryczną flankujący gracza z zachodu po starcie |
| **2** | `{ "x": -15, "y": 0, "z": 10 }` | **Parter** (`0.0 m`) | **P2** (Czarne Archiwum — południe) | Szturmowiec przy szafach kartotekowych nacierający z Archiwum na Hol |
| **3** | `{ "x": -21, "y": 0, "z": 4 }` | **Parter** (`0.0 m`) | **P2** (Czarne Archiwum — przy oknie `B1`) | Strzelec za stołem odpraw `lab_briefing_holotable` |
| **4** | `{ "x": 18, "y": 0, "z": 17 }` | **Parter** (`0.0 m`) | **P3** (Laboratorium Biochemii) | Flanka wschodnia za stołami z wirówkami `lab_centrifuge_bench` |
| **5** | `{ "x": 21, "y": 0, "z": 10 }` | **Parter** (`0.0 m`) | **P4** (Zbrojownia Prototypów — wschód) | Tarczownik przy stojakach prototypów broni |
| **6** | `{ "x": 15, "y": 0, "z": 3 }` | **Parter** (`0.0 m`) | **P4** (Zbrojownia Prototypów — północ) | Strzelec za komorą anomalii, poza marginesem `1 m` od `prototype-test-beam` |
| **7** | `{ "x": 0, "y": 0, "z": 5 }` | **Parter** (`0.0 m`) | **P5** (Centralny Hol — przed szybem windy) | Odwód centralny broniący dostępu do górnych biegów ramp zejściowych |
| **8** | `{ "x": -18.5, "y": -1.6, "z": -16 }` | **Pomost B1** (`-1.6 m`) | **B1** (Pomost Obserwacyjny Zachodni) | Strzelec górujący nad południowo-zachodnim gniazdem kokonów |
| **9** | `{ "x": 18.5, "y": -1.6, "z": -16 }` | **Pomost B1** (`-1.6 m`) | **B1** (Pomost Obserwacyjny Wschodni) | Strzelec górujący nad południowo-wschodnim gniazdem kokonów |
| **10** | `{ "x": 0, "y": -1.6, "z": -22 }` | **Pomost B1** (`-1.6 m`) | **B1** (Mostek Centralny nad salą kokonów) | Dominująca pozycja na kładce poprzecznej — idealny cel do zrzucenia Rezonansem! |
| **11** | `{ "x": 0, "y": -5.2, "z": -15 }` | **Piwnica** (`-5.2 m`) | **B1** (Aleja środkowa między kokonami S) | Szturmowcy przyjmujący gracza u podnóża dolnych biegów ramp |
| **12** | `{ "x": -26, "y": -5.2, "z": -18 }` | **Piwnica** (`-5.2 m`) | **B2** (Szatnia Dekontaminacyjna) | Flanka wybiegająca zza szafek pracowniczych przez dwie bramy zachodnie |
| **13** | `{ "x": 26, "y": -5.2, "z": -18 }` | **Piwnica** (`-5.2 m`) | **B3** (Zaplecze Serwerowe „Krypta”) | Flanka wybiegająca zza szaf chłodzonych cieczą przez dwie bramy wschodnie |
| **14** | `{ "x": -10, "y": -5.2, "z": -28 }` | **Piwnica** (`-5.2 m`) | **B1** (Gniazdo Kokonów NW) | Walka w zwarciu między cylindrami kokonów `K-09..K-12` |
| **15** | `{ "x": 10, "y": -5.2, "z": -28 }` | **Piwnica** (`-5.2 m`) | **B1** (Gniazdo Kokonów NE) | Strzelec/tarczownik między cylindrami kokonów `K-13..K-16` |
| **16** | `{ "x": 0, "y": -5.2, "z": -39 }` | **Piwnica** (`-5.2 m`) | **B1** (Strefa Ewakuacji przed `exit`) | Ostatnia linia obrony przed północną śluzą wyjściową `exit` |

### 5.2. Zestawienie zagrożeń środowiskowych (`hazards[]` — 4 hazardy na obu poziomach)

| Nr | `kind` i `id` | Kondygnacja i pomieszczenie | Położenie i parametry | Zastosowanie w walce (Ostrze / Rezonans / Strzelec) |
|---:|---|---|---|---|
| **1** | `laser_gate`<br>`id: "prototype-test-beam"` | **Parter (`y = 0.0 m`)**<br>`P4` Zbrojownia Prototypów | `from: (12.5, 0.85, 7.0)`, `to: (16.2, 0.85, 7.0)`, `cycle: { onS: 2.5, offS: 1.8 }` | Wiązka testowa kalibratora przecinająca przejście obok komory anomalii; pchnięcie wrogów na laser lub ślizg w oknie `offS`. |
| **2** | `explosive_barrel`<br>`id: "armory-plasma-cell"` | **Parter (`y = 0.0 m`)**<br>`P4` Zbrojownia Prototypów | `position: (23.5, 0.0, 3.0)` | Przeciążone ogniwo plazmowe przy stojakach prototypów broni. |
| **3** | `electric_field`<br>`id: "breached-cocoon-electrolyte"` | **Piwnica (`y = -5.2 m`)**<br>`B1` Sala Testów Humanoidalnych | `position: (-4.5, -4.2, -18.5)`, `size: (3.0, 2.0, 3.6)`, `cycle: { onS: 3.0, offS: 2.2 }` | Rozlany pod napięciem elektrolit z pękniętego Kokonu nr 04 (`K-04`) na skrzyżowaniu pod Mostkiem Centralnym — zrzucanie wrogów z mostka prosto w łuk elektryczny! |
| **4** | `explosive_barrel`<br>`id: "cryo-tank-north"` | **Piwnica (`y = -5.2 m`)**<br>`B1` Strefa Ewakuacji Północ | `position: (4.5, -5.2, -37.5)` | Zbiornik ciekłego chłodziwa osłaniający podejście do północnej bramy `exit`. |

### 5.3. Oświetlenie bez smug wolumetrycznych i budżet `CityLights`

Zgodnie z limitem puli `CityLights` (`8` aktywnych `PointLight` w kadrze na profilu `high`, `4` na `medium`) oraz wnioskami z `run2` E3:
1. **Główne oświetlenie budują materiały emisyjne bez smug (`mat_light_panel` + kolorowe neony `mat_neon_*`):**
   - W każdym z 8 pomieszczeń pod stropem wiszą oprawy `lab_ceiling_strip` (`CEILING_FIXTURES`) z dyfuzorami `mat_light_panel`, wsparte przez długie, ciągłe listwy krawędziowe `light_panel` pod pomostami `y = -1.60 m` oraz podświetlone od wewnątrz kokony `lab_cocoon_tall` (`mat_neon_green`) i `lab_cocoon_tall_cryo` (`mat_neon_blue`). Dzięki temu nawet poza pulą 8 najbliższych `PointLight` każdy kokon i każde pomieszczenie świeci własnym, wyrazistym kolorem!
2. **Rozmieszczenie 22 źródeł `lights[]` (100% z fizyczną oprawą, `0` z `cone: true`, każde z jawnym `floorY`):**
   - **Parter (`10` źródeł, `floorY: 0`):**
     - `P5 Centralny Hol (3)`: nad bramką skanera `(0, 5.95, +18.5, "#fff1d6", intensity: 30, range: 14)`, nad konsolą główną `(0, 5.95, +9.5, "#3d7bff", intensity: 28, range: 14)` i bursztynowy sygnał na szybie windy towarowej `(0, 4.2, -1.2, "#ffae1a", intensity: 26, range: 13, flicker: { pattern: "pulse", periodS: 2.2 })`.
     - `P1 Kordon Zero (2)`: `(-18, 4.35, +21, "#ffae1a", intensity: 26, range: 12)` oraz nad dyżurką `(-22, 4.35, +24, "#fff1d6", intensity: 22, range: 10)`.
     - `P2 Czarne Archiwum (2)`: nad stołem odpraw `(-18, 4.35, +7, "#fff1d6", intensity: 28, range: 12)` i przy tablicy śledczej `(-24.5, 3.2, +7, "#ffae1a", intensity: 18, range: 8, groundGlow: false)`.
     - `P3 Lab. Biochemii (2)`: nad wirówkami `(+18, 4.35, +21, "#6dff4a", intensity: 26, range: 12)` i przy dygestoriach `(+23.5, 4.35, +21, "#3d7bff", intensity: 22, range: 10)`.
     - `P4 Zbrojownia Prototypów (1)`: nad klatką anomalii `(+18, 4.35, +7, "#8a5cff", intensity: 32, range: 13, flicker: { pattern: "buzz", strength: 0.25 })`.
   - **Piwnica (`12` źródeł, `floorY: -5.2` lub `-1.6`):**
     - `B1 Sala Testów Humanoidalnych (8)`:
       - 4 główne źródła w centrach 4 gniazd kokonów pod kolektorami `lab_ceiling_manifold`: `(-10, -0.9, -16.2, "#6dff4a", intensity: 38, range: 16, floorY: -5.2)`, `(+10, -0.9, -16.2, "#3d7bff", intensity: 38, range: 16, floorY: -5.2)`, `(-10, -0.9, -28.2, "#6dff4a", intensity: 38, range: 16, floorY: -5.2)`, `(+10, -0.9, -28.2, "#3d7bff", intensity: 38, range: 16, floorY: -5.2)`,
       - 1 źródło nad Mostkiem Centralnym `(0, +3.95, -22.0, "#ffae1a", intensity: 26, range: 14, floorY: -1.6)`,
       - 1 źródło nad spocznikiem pośrednim ramp `(0, +3.95, -5.0, "#fff1d6", intensity: 24, range: 13, floorY: -1.6)`,
       - 1 źródło fioletowe przy rozlanym elektrolicie Kokonu 04 `(-4.5, -3.5, -18.5, "#8a5cff", intensity: 20, range: 9, groundGlow: false, flicker: { pattern: "buzz", strength: 0.35 })`,
       - 1 zielony portal nad śluzą wyjściową `exit` `(0, -1.6, -43.5, "#6dff4a", intensity: 34, range: 15, floorY: -5.2)`.
     - `B2 Szatnia Dekontaminacyjna (2)`: `(-26, -1.25, -18, "#fff1d6", intensity: 24, range: 11, floorY: -5.2)` oraz nad prysznicami `(-26, -1.25, -24.2, "#6dff4a", intensity: 18, range: 9, floorY: -5.2)`.
     - `B3 Zaplecze Serwerowe (2)`: `(+26, -1.25, -14.5, "#3d7bff", intensity: 24, range: 11, floorY: -5.2)` oraz `(+26, -1.25, -21.5, "#8a5cff", intensity: 24, range: 11, floorY: -5.2)`.

---

## 6. Kryteria akceptacji i etapy prac (A–E)

### 6.1. Kryteria akceptacji (automatyczne CLI i wizualne)

#### A. Kryteria automatyczne (CLI i testy jednostkowe)
1. **Zero błędów i zero ostrzeżeń w `mapAudit`:**
   - Polecenie `node tools/levels/mapAudit.mjs run3` zwraca wynik: **`run3: 0 error, 0 warn`** (`"run3": 0` w `tests/unit/mapAudit.baseline.json`).
   - Szczegółowo: `0` `noCollisionLargeProp`, `0` `floatingObject`, `0` `outOfBounds`, `0` `overlap`, `0` `forbiddenColor`, `0` `emptyRoom`.
   - `node tools/levels/mapAudit.mjs --all` przechodzi bez regresji na wszystkich mapach.
2. **Testy nawigacji 3D (`tests/unit/run3Navigation.test.ts`):**
   - Test jednostkowy na wzór `run1Navigation.test.ts` i `run2Navigation.test.ts` weryfikuje w `ArenaNavigation(room)`:
     1. Pełną osiągalność ścieżki od `playerSpawn (0, 0, 25)` na Parterze do drzwi `exit (0, -5.2, -44.5)` w Piwnicy,
     2. Dojście do wszystkich **16 punktów spawnu** na 3 poziomach wysokości (`y = 0.0 m`, `y = -1.6 m`, `y = -5.2 m`),
     3. Dojście do wnętrza wszystkich **8 pomieszczeń** (`P1..P5` oraz `B1..B3`) i na Mostek Centralny `B1` (`y = -1.60 m`),
     4. Ciągłą trasę między Pomostem Zachodnim a Pomostem Wschodnim przez Mostek Centralny `B1` bez schodzenia na posadzkę piwnicy (`min(path.y) >= -1.7`),
     5. Gęstość osłon: brak pustego kwadratu podłogi bez osłony (`wys. >= 0.8 m`) większego niż `8 × 8 m` w pomieszczeniach parteru i w głównej części Sali Testów Humanoidalnych `B1`.
3. **Pełny zestaw testów projektu (`npm run check`):**
   - `tsc --noEmit`, `eslint` i `vitest` przechodzą bez błędów, w tym `tests/unit/rooms.test.ts`, `tests/unit/roomBlockModelFit.test.ts` (zgodność wymiarów bloków z AABB nowych modeli `lab_*.glb` w tolerancji `±5%`) oraz test palety i budżetu trójkątów modeli `lab_*`.
4. **Deterministyczna generacja i budżet wydajności:**
   - Dwukrotne uruchomienie `node tools/arenas/run/run3.mjs` generuje identyczny plik `src/data/rooms/run3.json` (stały SHA-256).
   - Na profilu `medium` liczba wywołań rysowania w każdym z 10 widoków audytu spełnia `renderInfo.calls <= 800`.

#### B. Kryteria wizualne (zrzuty `node tools/screens/mapAudit.mjs run3` i spacer `?scene=map-walk&map=run3`)
1. **Komplet 10 zrzutów audytu (`01-spawn.png` .. `10-top.png`):**
   - `01-spawn.png` pokazuje czystą oś startu w Centralnym Holu `P5` z bramką skanera, konsolą główną, szybem windy towarowej i widocznym w głębi zejściem do oświetlonej na zielono-błękitno Sali Testów Humanoidalnych `B1`.
   - `10-top.png` (po automatycznym ukryciu stropów z `ceiling: true`) pokazuje pełny, czytelny rzut wszystkich **8 pomieszczeń** (5 na Parterze `Z ∈ [0, +28]` i 3 w Piwnicy `Z ∈ [-44, 0]`), 16 kokonów w 4 gniazdach oraz pomosty i rampy.
2. **Brak wolumetrycznych smug światła:**
   - Na żadnym z 10 kadrów nie występują pionowe ani poziome smugi bloomu/stożków pod oprawami sufitowymi (`0` `cone: true`, użycie `mat_light_panel` zamiast `mat_light_white`, wyzerowana mgła w `kuroganeSecretLab.json`).
3. **Czytelność tematu każdego z 8 pomieszczeń i easter eggów:**
   - W 1 sekundę można odróżnić Śluzę `P1` (bursztyn, bramka skanera, lada ochrony), Czarne Archiwum `P2` (tablica korkowa z bursztynowo-zielonymi nitkami, plakat UFO `WE ARE NOT ALONE`, sejfy, holo-stół), Biochemię `P3` (zieleń, wirówki, dygestoria), Zbrojownię `P4` (fiolet, klatka anomalii, stojaki prototypów), Hol `P5` (szyb windy towarowej, rampy), Wielką Salę `B1` (16 wielkich szklanych kokonów z sylwetkami humanoidów w płynie, pęknięty kokon nr 04, pomosty i kolektory rur), Szatnię `B2` (szafki, ławki, prysznice, żółte kombinezony HAZMAT) oraz Serwerownię `B3` (chłodzone cieczą szafy rack i ukryta w kącie tabliczka `HEADQUARTERS OF EVIL CORP`).
4. **Zero barw zakazanych i zero nazw chronionych:**
   - W otoczeniu nie występuje czerwień, cyan ani magenta, a w kodzie, teksturach i dokumentacji nie występują żadne nazwy chronione (`AGENTS.md`).

### 6.2. Etapy prac (A–E)

| Etap | Zakres prac | Artefakty wyjściowe | Weryfikacja etapu |
|---|---|---|---|
| **Etap A — Fundamenty kodu i materiałów** | 1. Rozszerzenie walidacji `hazards` w `src/world/roomSchema.ts` o kondygnacje `y !== playerSpawn.y` (**F-01**).<br>2. Dopisanie prefiksu `'lab_'` w `src/render/cityModels.ts` oraz list `WALL_FIXTURES` i `CEILING_FIXTURES` w `src/world/mapAudit.ts` (**F-02**).<br>3. Rejestracja 3 materiałów powierzchni `lab_epoxy_floor`, `lab_bunker_concrete`, `lab_cleanroom_wall` w `arenaMaterials.json`, `urbanMaterials.ts`, `surfaceTextures.ts`, `dressingSchema.ts` (**F-03**).<br>4. Utworzenie profilu pogody `src/data/weather/kuroganeSecretLab.json` (**F-04**). | Zmiany w `src/world/`, `src/render/`, `src/data/render/arenaMaterials.json`, `src/data/weather/kuroganeSecretLab.json` + test w `tests/unit/spawnElevation.test.ts` | `npm run check` zielone |
| **Etap B — Modele 3D w Blenderze (`lab_*.glb`)** | 1. Napisanie generatora `tools/blender/sets/kurogane_lab.py` budującego 25 modeli `lab_*.glb` z Tabel 1 i 2 (`§4.1`), z użyciem `mat_light_panel` na białych dyfuzorach i `mat_glass_clear` na kloszach kokonów.<br>2. Eksport plików `.glb` do `public/assets/models/city/` i render podglądów PNG do `artifacts/models/lab/`.<br>3. Aktualizacja `src/data/render/mapModelBounds.json` skryptem `node tools/levels/mapModelBounds.mjs` oraz dokumentacji w `docs/assets.md`. | 25 plików `public/assets/models/city/lab_*.glb`, podglądy `artifacts/models/lab/*.png`, zaktualizowany `mapModelBounds.json` | Ogląd każdego podglądu PNG + test jednostkowy modeli (AABB, materiały, budżet trójkątów, brak zakazanych barw) |
| **Etap C — Tekstury szyldów, plakatów, notatek i powierzchni** | 1. Wygenerowanie i walidacja 3 tekstur powierzchni `lab_*` (+ 3 wersji `komiks_lab_*`).<br>2. Wygenerowanie 8 szyldów `signs/lab_*`, ekranu `screen_lab_biomonitor`, etykiety `label_lab_mug` oraz 10 decali/plakatów (w tym `poster_we_are_not_alone`, `plaque_evil_corp` i 6 polskich easter eggów z `§4.2`).<br>3. Rejestracja w `tools/textures/catalog.json`, `tools/textures/komiks/catalog.json` i manifestach w `public/assets/textures/`. | Pliki `.webp` w `public/assets/textures/{surfaces,komiks/surfaces,signs,screens,decals,labels}/` | Walidator tekstur (wymiary, bezszwowość powierzchni, 0 pikseli w zakazanych pasmach HSV czerwieni/cyanu/magenty) |
| **Etap D — Generator mapy `run3`** | 1. Implementacja `tools/arenas/run/run3.mjs` oraz modułów `_run3Kit.mjs`, `_run3Rooms.mjs`, `_run3Dress.mjs` według współrzędnych z `§3` i `§5`.<br>2. Wygenerowanie `src/data/rooms/run3.json` i dopisanie `"run3": 0` w `tests/unit/mapAudit.baseline.json`.<br>3. Napisanie testu `tests/unit/run3Navigation.test.ts` (osiągalność 16 spawnów, 8 pomieszczeń, pomostów, wyjścia i gęstości osłon). | `tools/arenas/run/run3.mjs`, `_run3*.mjs`, `src/data/rooms/run3.json`, `tests/unit/run3Navigation.test.ts` | `node tools/levels/mapAudit.mjs run3` → `0 error, 0 warn`; `npx vitest run tests/unit/run3Navigation.test.ts`; `npm run check` |
| **Etap E — Zrzuty ekranu, audyt wizualny i szlif** | 1. Wygenerowanie 10 zrzutów `node tools/screens/mapAudit.mjs run3 --out artifacts/maps/run3/r1 --tag after` oraz dodatkowych kadrów z wnętrza 8 pomieszczeń i kokonów piwnicy.<br>2. Przegląd wizualny (czytelność sylwetek w kokonach, brak smug światła, ekspozycja easter eggów, jasność `#2a3344–#56627a`) i korekty do oceny Opusa `≥ 7/10`. | Zrzuty `artifacts/maps/run3/r1/*.png`, raport oceny wizualnej | Ocena Opusa `≥ 7/10`, `mapAudit` `0/0`, `npm run check` zielone |
