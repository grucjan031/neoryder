# Audyt level designu i plan przebudowy pokoju walki `combatRing` (*Rotunda kolumnowa*)

- **Plik danych:** [combatRing.json](file:///D:/AgenticProProjects/neoryder-maps/src/data/rooms/combatRing.json)
- **Rola w grze:**
  1. **Run sektora Kurogane Arms (`type: "combat"`):** jedyny zwarty pokój walki (`28 × 28 m`, wnętrze `26 × 26 m` = `676 m²`, `maxAlive: 8`, `minSpawnDistance: 6 m`, `6` punktów spawnu) w puli `roomPools.combat` ([kurogane.json](file:///D:/AgenticProProjects/neoryder-maps/src/data/sectors/kurogane.json#L119-L132)), losowany w warstwach **L1–L6** (2–3 fale wrogów: `assaulter`, `gunner`, `drone`, `shielder`, `hacker`, a od L3/L4 także `sniper` i `turret`).
  2. **Tryb areny *Kradzież rdzenia* (`heist` — fallback małego pokoju):** podstawowy pokój `roomId: "combatRing"` w [heist.json](file:///D:/AgenticProProjects/neoryder-maps/src/data/modes/heist.json#L1-L29) (`?scene=run&mode=heist&arena=combatRing&debug=1`), gdzie gracz startuje w strefie ewakuacji `(0, 0, 10)` (`extractRadiusM: 2,0 m`), przebija się do bazy rdzenia `(0, 0, -11.5)` (`pickupRadiusM: 1,2 m`) bronionej przez posiłki ze spawnów `(±10, 0, -10)` i `(±5, 0, -11)` (`spawnClearanceM: 0,8 m`), po czym wraca z rdzeniem (`carrySpeed: 0.75`, bez dasha, sprintu i ślizgu) i utrzymuje strefę ewakuacji przez `3,0 s`.
  3. **Kompatybilność wsteczna trybu *Przejęcie* (`conquest`) i wzorzec horyzontu małych pokoi:** przechowuje w `arena` układ 3 stref przejęcia `A (-10, 0, -9, r = 2,75 m)`, `B (10, 0, -9, r = 2,75 m)`, `C (0, 0, 0, r = 3,5 m)` oraz 4 narożne `arena.spawnPoints (±12, ±12)` przy `navigationClearanceM: 0,8 m` (weryfikowane w [conquest.test.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/unit/conquest.test.ts#L16-L150) i [arenaWeather.test.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/unit/arenaWeather.test.ts#L33-L347)), a także stanowi kanoniczny wzorzec małego pokoju (`expanded: false`, `far: 220 m`, `ringsM: [66, 92, 124, 162]`) w [horizon.test.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/unit/horizon.test.ts#L17-L34).
- **Materiał dowodowy:** [combatRing.json](file:///D:/AgenticProProjects/neoryder-maps/src/data/rooms/combatRing.json), zrzuty `artifacts/maps/combatRing/before/01-spawn.png`..`10-top.png`, raport [mapAudit-report.md](file:///D:/AgenticProProjects/neoryder-maps/docs/audits/mapAudit-report.md#L13-L70) (`0 error / 2 warn`), specyfikacje [rooms.md](file:///D:/AgenticProProjects/neoryder-maps/docs/systems/rooms.md), [modes.md](file:///D:/AgenticProProjects/neoryder-maps/docs/systems/modes.md), [arenas.md](file:///D:/AgenticProProjects/neoryder-maps/docs/systems/arenas.md), kod [roomScene.ts](file:///D:/AgenticProProjects/neoryder-maps/src/scenes/roomScene.ts), [roomSchema.ts](file:///D:/AgenticProProjects/neoryder-maps/src/world/roomSchema.ts), [modeSchema.ts](file:///D:/AgenticProProjects/neoryder-maps/src/world/modeSchema.ts), [mapAudit.ts](file:///D:/AgenticProProjects/neoryder-maps/src/world/mapAudit.ts), pomiary GLB [mapModelBounds.json](file:///D:/AgenticProProjects/neoryder-maps/src/data/render/mapModelBounds.json), wzorce jakościowe ([bossRoom.md](file:///D:/AgenticProProjects/neoryder-maps/docs/audits/maps/bossRoom.md), [arena.md](file:///D:/AgenticProProjects/neoryder-maps/docs/audits/maps/arena.md), [puzzlePlate.md](file:///D:/AgenticProProjects/neoryder-maps/docs/audits/maps/puzzlePlate.md), [puzzleLaser.md](file:///D:/AgenticProProjects/neoryder-maps/docs/audits/maps/puzzleLaser.md) wraz z sekcjami 5) oraz zasady [AGENTS.md](file:///D:/AgenticProProjects/neoryder-maps/AGENTS.md) i [0006-neon-noir.md](file:///D:/AgenticProProjects/neoryder-maps/docs/adr/0006-neon-noir.md).

---

## 1. Ocena obecnego stanu

### Klimat (2,5 / 5)
Pokój korzysta z motywu `neonStreet`, dzięki czemu na zrzutach widać nocne niebo, deszcz, mokry asfalt z trzema kałużami (`puddle1`/`puddle2`) oraz otaczające mury wysokie budynki `facade` (`14–24 m`) z oświetlonymi oknami z atlasu. Klimat rozpada się jednak z powodu niedokończonego blockoutu i błędów oprawy:
- Po prawej (wschodniej) stronie pokoju stoi **ogromny, nieoteksturowany, czarny prostopadłościan `blocks[13]` (`1,5 × 2,8 × 4,0 m` w `(6, 1.4, -3.5)`, `material: "metal"`, brak pola `model`)**, który na `01-spawn.png`, `02-north.png` i `03-east.png` wygląda jak zepsuty kloc zastępczy z wczesnego prototypu.
- Oba przewody nad dziedzińcem (`decor[0..1]`, `city_cable_span`, `scale: 2.7`) **urywają się w powietrzu (`floatingObject`, 2/2 końców)** w punktach `x = ±13,5 m, y ≈ 8,0–8,5 m` (`4,2–4,5 m` ponad koroną 4-metrowych murów `blocks[1..2]` i `1,5 m` przed licami fasad `blocks[20..23]` na `x = ±15,0 m`), a dodatkowo na `03-east.png` i `05-west.png` przecinają w kadrze hologramy `holo_android` i `holo_koi`.
- W pliku brakuje tablicy `rainShelters` oraz jawnego profilu `weather`, przez co deszcz pada na przestrzał przez belkę `blocks[9]` oraz dach budki `city_stall` (`blocks[10]`).
- Nad drzwiami `entry` `(0, 1.5, 13.5)` i `exit` `(0, 1.5, -13.5)` (`wys. 3 m` w 4-metrowym murze) zieją puste, 1-metrowe wyrwy bez nadproży (`01-spawn.png`, `02-north.png`, `04-south.png`), a pierwszy plan `01-spawn.png` szpeci wielka, pstrokata strzałka jezdniowa `floor_arrow` (`decals[3]` w `(0, 0.01, 7.5)`).

### Sensowność i narracja miejsca (1,5 / 5)
Według nazwy w danych (`"name": "Rotunda kolumnowa"`) pokój powinien być dziedzińcem z kolumnadą obwodową (perystylem) na dnie studni architektonicznej między wieżowcami kwartału usługowo-mieszkalnego. Obecna geometria przeczy własnej nazwie:
- **Brak rotundy i brak symetrii kolumnady:** w pokoju stoją wyłącznie **dwa** filary `blocks[7..8]` po zachodniej stronie (`x = -5,5, z = ±5`) podtrzymujące pojedynczą, zawieszoną w próżni belkę `blocks[9]` (`2,2 × 0,6 × 12 m` na `(-5.5, 4.3, 0)`), która nie łączy się ani ze ścianą zachodnią (`6,4 m` pustki), ani ze stroną wschodnią. Po wschodniej stronie nie ma ani jednego filara — zamiast wschodniej kolumnady stoi surowy kloc `blocks[13]`.
- **Rekwizyty stojące luzem na środku placu bez kontekstu architektonicznego:**
  - Stragan gastronomiczny `city_stall` (`blocks[10]`) został wciśnięty dokładnie między dwa filary na `(-5.5, 1.311, 0)` w orientacji `yaw = 0` (bokiem do osi wschód–zachód), przez co na `05-west.png` widać jego ciemny, pusty profil boczny zamiast lady, a jego szerokość (`3,0 m`) wystaje poza obrys filarów (`1,5 m`) i belki (`2,2 m`).
  - Terminal informacyjny `city_kiosk` (`blocks[16]` w `(9.5, 1.1175, -4)`) oraz śmietnik `city_dumpster` (`blocks[15]` w `(9.5, 0.665, 5.5)`) stoją na środku asfaltu **`3,5 m` od wschodniego muru (`x = 13,0 m`)**, nie podparte żadną ścianą ani zadaszeniem (`01-spawn.png`, `07-corner-se.png`, `09-high-east.png`).
- **Błędy montażowe dekoracji i efektów:**
  - Dwie latarnie uliczne `city_street_lamp` (`decor[9..10]` w `(±12.5, 0, 0)`) stoją `0,5 m` wewnątrz grywalnej podłogi **bez kolizji**, a ich stożki światła wbijają się w betonowe ściany `blocks[1..2]` (`03-east.png`, `06-corner-nw.png`).
  - Hologramy `holo_koi` (`signs[4]`) i `holo_android` (`signs[5]`) wiszą przy ścianach bez projektorów `city_holo_projector` (ich stożki projekcji urywają się w powietrzu lub za murem).
  - Iskry `ambientFx[2]` (`(12.8, 3.8, -1)`) sypią się z gładkiej ściany betonu bez żadnej skrzynki czy rolety, a krople wody `ambientFx[3..4]` (`y = 4,5 m`) kapią z pustego powietrza `0,5 m` powyżej muru.
  - Piony rur `decor[4..5]` (`city_pipe_run` na `(±15, 4, ∓1)`) wiszą na skraju półmetrowej szczeliny `z ∈ [-0.25, 0.25]` między budynkami `blocks[20..21]` i `blocks[22..23]`, a anteny dachowe `decor[15..16]` na `y = 22–24 m` wchodzą w kadr kamery pionowej jako długie czarne igły w dolnych rogach `10-top.png`.

### Gameplay walki z falami wrogów (L1–L6) oraz trybu *Kradzież rdzenia* (2,0 / 5)

#### 1. Osłony i linie strzału (Sightlines)
- **Odsłonięcie gracza na starcie i podczas ewakuacji Heist w `(0, 0, 10)`:** gracz spawnuje się w `(0, 0, 10)` (gdzie w trybie *Kradzież rdzenia* musi też utrzymać pozycję z rdzeniem przez pełne `3,0 s` bez dasha i sprintu w promieniu `2,0 m`). Ponieważ `minSpawnDistance` wynosi `6 m`, już od pierwszej fali aktywne są wszystkie 6 punktów `spawnPoints`: centralny `(0, 0)` (`10 m` prosto przed graczem), dwa południowe narożniki `(-10, 10)` i `(10, 10)` (`10 m` bezpośrednio z lewej i prawej flanki na tej samej linii `z = 10`!), dwa północne narożniki `(±10, -10)` oraz północny środek `(0, -11)`. Między `(0, 10)` a centralnym spawnem `(0, 0)` oraz południowo-wschodnim spawnem `(10, 10)` **nie ma żadnej osłony** — gracz od pierwszej sekundy (oraz przez całe 3 s ewakuacji z rdzeniem) stoi na całkowicie otwartej przestrzeni pod krzyżowym ostrzałem z trzech kierunków.
- **Ślepy mur `blocks[13]` (`1,5 × 2,8 × 4,0 m` w `(6, 1.4, -3.5)`):** w ćwiartce północno-wschodniej 4-metrowy czarny kloc tworzy pełną ścianę wysokości `2,8 m`, za którą chowają się Strzelcy (`gunner`), Hakerzy (`hacker`) i Snajperzy (`sniper`) ze spawnu `(10, -10)`, zmuszając gracza do niebezpiecznego wychylania się zza ślepego narożnika, podczas gdy po stronie zachodniej analogiczną pozycję zajmuje otwarty prześwit między kolumnami.

#### 2. Pętle ruchu (Movement Loops)
- W pokoju `26 × 26 m` o strukturze koncentrycznej („Ring / Rotunda”) walka z maksymalnie `8` wrogami naraz (`attackTokens: 3`, `shotTokens: 2`) wymaga **dwóch płynnych, współśrodkowych pętli ruchu**:
  1. **Pętli wewnętrznej (`r ≈ 4–5,5 m`)** wokół centralnego świetlika do walki wręcz, parowania i szybkiego chowania się za kolumnami przed Snajperem/Wieżyczką.
  2. **Pętli zewnętrznej (`|x|, |z| ≈ 8–10,5 m`)** wzdłuż obwodu ścian do bezpiecznego obiegania fal i przenoszenia rdzenia na trasie `base (0, -11.5) ↔ extraction (0, 10)`.
- Obecnie **pętla zewnętrzna po obu stronach jest poszatkowana chaotycznym slalomem**:
  - Po lewej stronie stragan `city_stall` (`x ∈ [-7.0, -4.0], z ∈ [-1.02, 1.02]`), skrzynie `city_crates` `(-8.5, -4)`, osłona `cover_low` `(-9.5, 0)` i bariera `city_barrier` `(-8.5, 5.5)` są rozstawione szachownicowo w poprzek korytarza `x ∈ [-13, -5.5]`, zostawiając ciasne przewężenia `1,9–2,5 m`, w których gracz łatwo zostaje odcięty przez Szturmowców (`assaulter`) i Tarczowników (`shielder`).
  - Po prawej stronie kloc `blocks[13]` `(6, -3.5)`, wolnostojący kiosk `blocks[16]` `(9.5, -4)`, osłona `blocks[18]` `(9.5, 0)`, agregat `blocks[14]` `(6, 4.5)` i śmietnik `blocks[15]` `(9.5, 5.5)` blokują zarówno oś podłużną, jak i dojście do ściany wschodniej.

#### 3. Wysokości i obiekty interaktywne (Wertykalność i Rezonans)
- W pokoju brakuje jakichkolwiek zniszczalnych lub rzucanych skrzyń (`crate` / `crate_small`), przez co gracz korzystający z mocy **Chwyt** (`GrabPower`) i **Pchnięcie** nie ma w całym pomieszczeniu ani jednego fizycznego pocisku środowiskowego.
- Cztery średnie modele techniczne o wysokości `1,33–1,59 m` (`city_crates` `1,59 m`, `city_generator` `1,40 m`, `city_dumpster` `1,33 m`) mają idealną wysokość pod **mikro-wertykalność (podesty skokowe „high ground” dostępne zwykłym skokiem `jump`)**, ale przez przypadkowe skupienie ich w ćwiartce SE (`generator` obok `dumpster`) brakuje symetrycznych podestów skokowych kontrolujących wszystkie cztery narożne spawny `(±10, ±10)`.

#### 4. Czytelność wrogów i przestrzeni
- **Zbyt ciemne pole walki i przekroczenie limitu 8 świateł (ADR 0006 pkt 7):** wszystkie 8 świateł w `lights[0..7]` ma bardzo niską intensywność (`4,0–5,0` wobec `14–22` w `bossRoom` i `arena`) i jest zepchnięte pod ściany obwodowe (`x = ±11,5`, `z = ±11,5`). Co gorsza, aż 4 z nich (`lights[4..7]`) wiszą wysoko na `y = 5,2–5,8 m` wyłącznie do oświetlenia górnych szyldów, przez co **w całym środkowym polu walki (`x ∈ [-7, 7], z ∈ [-8, 8]`) nie ma ani jednego światła punktowego** (`01-spawn.png`, `02-north.png`, `08-high-west.png`). Razem z 2 automatycznymi światłami z niekolizyjnych latarń `city_street_lamp` (`decor[9..10]`) daje to **10 źródeł** konkurujących o pulę 8 `PointLight`.
- **Zasłanianie szyldów na osi północnej i brak oznaczenia spawnów:** z punktu startu `01-spawn.png` filar `blocks[7]` i belka `blocks[9]` przecinają w połowie neony `IMPLANTY` (`signs[2]`) i `HOTEL` (`signs[6]`), a kloc `blocks[13]` zasłania neon `noodles` (`signs[3]`). Z sześciu punktów spawnu wrogów tylko jeden (`(-10, 10)`) ma obok siebie roletę `city_shutter` (`decor[8]`) — pozostałe 3 narożniki i północna baza rdzenia `(0, -11.5)` nie mają żadnych bram zrzutowych ani oznaczeń na asfalcie.

---

### Ocena skali i rekomendacja: czy `combatRing` powinien zostać mały (`28 × 28 m`), czy zostać powiększony do `~70 × 120 m`?

> [!IMPORTANT]
> **Rekomendacja:** `combatRing` **MUSI pozostać zwartym pokojem `28 × 28 m` (`26 × 26 m` w świetle murów = `676 m²`)** i zostać przebudowany wewnątrz obecnego obrysu podłogi.

#### Uzasadnienie projektowe (Pacing, rytm runu i różnorodność build-craftingu)
1. **Unikalny kontrast rytmu w puli `roomPools.combat` (11 dużych aren vs 1 zwarty dziedziniec szturmowy):**
   W `src/data/sectors/kurogane.json` wszystkie pozostałe 11 pokoi z puli `roomPools.combat` (`combatCorridor`, `combatPillars`, `combatPlatforms`, `combatWarehouse`, `combatYard`, `alleyMarket`, `alleyBackstreet`, `alleyCrossing`, `combatSubstation`, `combatLaserYard`, `combatFloodedTunnel`) to ogromne, wielopoziomowe areny o wymiarach **`68–90 × 76–96 m` (`≥ 3 500 m²`, 15–18 spawnów, `maxAlive: 9–10`)**. Gdyby `combatRing` również został powiększony do `~70 × 120 m`, każdy węzeł `combat` w runie L1–L6 miałby identyczną, długodystansową skalę przestrzenną. Pozostawienie `combatRing` jako jedynej kameralnej areny `28 × 28 m` daje pożądany w roguelicie **zmienny rytm („szybka, gęsta walka w zwarciu” 45–60 s pośród 150-sekundowych bitew na dużych mapach)**.
2. **Premiowanie ścieżki Ostrza Plazmowego i Mocy Rezonansu:**
   Na dużych arenach `70 × 120 m` naturalną przewagę ma ścieżka Strzelca i walka dystansowa. Zwarty dziedziniec `26 × 26 m` (`minSpawnDistance: 6 m`, `maxAlive: 8`) od pierwszej sekundy wymusza i nagradza walkę w bliskim dystansie: parowanie serii w oknie parowania, odbijanie pocisków Ostrzem Plazmowym, szybkie egzekucje (`execute`), rozbijanie grup Pchnięciem Rezonansu o kolumny i ściany oraz rzucanie skrzyniami Chwytem.

#### Uzasadnienie techniczne i kontraktowe (tryby gry oraz testy regresyjne)
3. **Kontrakt trybu *Kradzież rdzenia* (`src/data/modes/heist.json`):**
   `combatRing` jest głównym pokojem `roomId: "combatRing"` w `heist.json` (oraz celem `?scene=run&mode=heist&arena=combatRing`), gdzie dystans **`21,5 m`** między bazą rdzenia `(0, 0, -11.5)` a strefą ewakuacji `(0, 0, 10)` jest ściśle skrojony pod powolny marsz nosiciela z rdzeniem (`carrySpeed: 0.75` przy wyłączonym dashu, sprincie i ślizgu) pod presją posiłków spawnowanych co `3 s` w `(±10, 0, -10)` i `(±5, 0, -11)`. Testują to bezpośrednio [tests/unit/heist.test.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/unit/heist.test.ts#L18-L61) oraz [tests/e2e/heist.spec.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/e2e/heist.spec.ts#L93-L135).
4. **Kontrakt kompatybilności *Przejęcia* (`conquest`) i horyzontu małych pokoi (`horizon.test.ts`):**
   Testy [tests/unit/conquest.test.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/unit/conquest.test.ts#L16-L150) i [tests/unit/arenaWeather.test.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/unit/arenaWeather.test.ts#L33-L347) walidują na `combatRing` układ 3 stref `A (-10, 0, -9, r = 2,75 m)`, `B (10, 0, -9, r = 2,75 m)`, `C (0, 0, 0, r = 3,5 m)` i 4 narożnych spawnów `(±12, ±12)`, natomiast [tests/unit/horizon.test.ts](file:///D:/AgenticProProjects/neoryder-maps/tests/unit/horizon.test.ts#L17-L34) weryfikuje na `combatRing` parametry horyzontu małego pokoju (`expanded: false`, `far: 220`, `ringsM: [66, 92, 124, 162]`), które uległyby zmianie po powiększeniu obwiedni mapy.

---

## 2. Koncepcja miejsca w świecie gry i unikalność wobec innych map

### Czym jest to miejsce: *Dziedziniec Perystylowy Kwartału Nocnego („Rotunda kolumnowa”)*
`combatRing` to wewnętrzny, kwadratowy **dziedziniec-studnia (`26 × 26 m` w świetle murów) z czworobocznym perystylem kolumnowym**, położony na styku nocnego pasażu usługowego Dolnego Miasta (hotel kapsułowy, bar ramen/karaoke) i lokalnego węzła przekaźnikowego sieci Kurogane Arms.
Słowo *Ring / Rotunda* nie oznacza tu ringu walk gladiatorskich (jak w `arena.json`), lecz **architekturę perystylu i okrężny układ komunikacyjny wokół centralnego świetlika deszczowego**:
- **Centralny Perystyl („Rotunda” `11 × 10 m` wokół świetlika `(0, 0)`):** cztery symetryczne, betonowe kolumny `pillar` w `(±5.5, 2, ±5)` podtrzymują **czterostronny stalowy wieniec belkowania (`y = 4,25–4,30 m`)** z dwoma sznurami bursztynowych lampionów (`city_lantern_string`) zawieszonymi wzdłuż zachodniej i wschodniej kolumnady. Środek wieńca jest otwarty na nocne niebo i deszcz, który spada na centralną kałużę refleksyjną w `(0, 0)`. Pomiędzy kolumnami zachodnimi `(-5.5, 0)` i wschodnimi `(5.5, 0)` stoją niskie stalowe balustrady `cover_low` (`wys. 1,2 m`), zostawiające cztery szerokie na `2,75 m` bramy promieniowe łączące wnętrze perystylu z nawami bocznymi.
- **Zachodni Portyk Nocnego Pasażu (`x ∈ [-13, -6.25]`):** pod przyściennym okapem z blachy falistej (`corrugated`, `x ∈ [-13, -9.2], z ∈ [-4.5, 4.5]`, osłoniętym przed deszczem przez `rainShelters`) stoi dosunięty plecami do zachodniego muru i **obrócony frontem ku środkowi dziedzińca (`+X`) podświetlony stragan `city_stall` (`(-11.98, 1.311, 0)`)**, flankowany przez neon `KARAOKE`, hologram `holo_koi`, paletę skrzyń `city_crates` i zniszczalną skrzynię `crate`.
- **Wschodni Portyk Przekaźnikowy Kurogane (`x ∈ [6.25, 13]`):** pod bliźniaczym okapem wschodnim (`x ∈ [9.2, 13], z ∈ [-4.5, 4.5]`) przy murze stoi **obrócony ekranem ku dziedzińcowi (`-X`) terminal diagnostyczny `city_kiosk` (`(12.69, 1.1175, 0)`)**, a na jego skrzydłach pracują dwa agregaty zasilające `city_generator` (`(8.5, 0.7, -4)` oraz `(6.0, 0.7, 8.8)`), neon `BAR 24H`, hologram `holo_android` i druga zniszczalna skrzynia `crate`.
- **Północny Dok Rdzenia i Śluza Wyjściowa (`z ∈ [-9.5, -13.5]`):** przed północnymi drzwiami `exit` `(0, 1.5, -13.5)` (domkniętymi stalowym nadprożem) leży oznaczone pasami `floor_hazard` i oświetlone królewskim błękitem (`#3d7bff`) gniazdo rdzenia energetycznego (`base (0, 0, -11.5)` w trybie *Kradzież rdzenia* oraz północny spawn `(0, -11)`), osłonięte od południa barierą `cover_low` `(0, 0.6, -9.5)`.
- **Południowy Przyczółek Wejścia i Ewakuacji (`z ∈ [6.2, 13.5]`):** punkt startu gracza i ewakuacji z rdzeniem `(0, 0, 10)` przed południową bramą `entry` jest chroniony od frontu (przed centralnym spawnem `(0, 0)`) przez betonową zaporę z pasami ostrzegawczymi `city_barrier` w `(0, 0.4645, 6.2)`, a od bocznych spawnów `(-10, 10)` i `(10, 10)` przez dwa podesty flankujące: kontener `city_dumpster` w `(-6.0, 0.665, 8.8)` oraz agregat `city_generator` w `(6.0, 0.7, 8.8)`.

### Dlaczego ten układ świetnie gra (w runie L1–L6 i w *Kradzieży rdzenia*)
1. **Dwie czyste, koncentryczne pętle ruchu i 4 przejścia promieniowe:**
   - **Pętla wewnętrzna (`r < 4,75 m`)** wokół centralnej kałuży pozwala błyskawicznie krążyć za czterema kolumnami `(±5.5, ±5)` i dwiema balustradami `cover_low` `(±5.5, 0)`, zrywając celownik Snajpera lub Wieżyczki z `(0, 0)` i `(0, -11)`.
   - **Pętla zewnętrzna (`x ≈ ±8,0..10,5 m`, `z ≈ ±7,5..10,5 m`)** dzięki dosunięciu `city_stall` i `city_kiosk` plecami do ścian bocznych (`x = ±13,0 m`) otwiera po obu stronach dziedzińca **szerokie na `4,7–6,1 m` korytarze szturmowe**, idealne do szybkiego flankowania fal oraz do taktycznego powrotu z rdzeniem w trybie *Heist* lewym lub prawym portykiem.
2. **Osłonięty start i uczciwa 3-sekundowa ewakuacja w `(0, 0, 10)`:**
   - Zapora `city_barrier` na `(0, 0.4645, 6.2)` oraz boczne bryły `city_dumpster` `(-6, 8.8)` i `city_generator` `(6, 8.8)` tworzą wokół `(0, 0, 10)` trójstronny przyczółek (z zachowaniem pełnego wolnego koła `extractRadiusM = 2,0 m`), dzięki czemu gracz nie ginie od natychmiastowego ognia krzyżowego po wejściu do pokoju i ma czytelną osłonę podczas 3-sekundowego odliczania ewakuacji z rdzeniem.
3. **Cztery symetryczne podesty skokowe („high ground” `1,33–1,59 m`) i 2 skrzynie do Chwytu (`crate`):**
   - W każdej z czterech ćwiartek poza kolumnadą stoi jeden kolizyjny model o wysokości `1,33–1,59 m` (NW: `city_crates` `(-8.5, -4)` `1,59 m`; NE: `city_generator` `(8.5, -4)` `1,40 m`; SW: `city_dumpster` `(-6, 8.8)` `1,33 m`; SE: `city_generator` `(6, 8.8)` `1,40 m`), na który gracz może wskoczyć jednym skokiem, by razić wrogów z góry ponad osłonami i tarczami `shielder`.
   - Dwie jasne, zniszczalne skrzynie `crate` (`#d9dde3`) pod okapami w `(-11.8, 0.5, -3.2)` i `(11.8, 0.5, 3.2)` dają gotową amunicję dla mocy Chwytu i Pchnięcia.
4. **Czytelne wejścia fal we wszystkich 4 narożnikach:**
   - Wszystkie cztery narożne spawny `(±10, ±10)` mają teraz na przyległych murach (`x = ±13,0, z = ±10,0`) stalowe rolety `city_shutter` lub drzwi śluz `city_door` podświetlone lokalnymi światłami, więc gracz od razu wie, skąd wybiegają kolejne grupy.

### Różnica wobec wzorcowych map (`bossRoom`, `arena`, `puzzlePlate`, `puzzleLaser`)

| Mapa | Tożsamość w świecie i skala | Kluczowa różnica architektoniczna i rozgrywkowa wobec `combatRing` |
| --- | --- | --- |
| **`bossRoom`** (*Sala zarządu Kurogane Arms*) | Elitarny dziedziniec dowodzenia na szczycie korporacyjnej fortecy (`30 × 30 m`, `type: "boss"`). | Oś pojedynku 1v1 z bossem `securityChief` (pusty środek pod atak `slam` `5,5 m`), serwerownia za ciemnym szkłem, winda M06 i pełne `6 × 14 m` galerie od słupów do ścian; zero lokali usługowych i neonów ulicznych. |
| **`arena`** (*Nielegalny Ring Walk „Klatka”*) | Podziemny ring gladiatorski ruchu oporu Iskra do długich trybów falowych (`40 × 40 m`, 12 fal / Endless / Mutatory). | Duża otwarta płyta `38 × 38 m` bez drzwi `entry`/`exit` runu, z 8 bramami zrzutowymi dookoła i dwoma wzdłużnymi belkami suwnicy na środku; `combatRing` nie jest ringiem walk, lecz miejskim dziedzińcem perystylowym (`26 × 26 m`) z zamkniętym wieńcem 4 belek nad świetlikiem, dwoma przyściennymi pasażami pod okapami i osią północ–południe pod *Kradzież rdzenia*. |
| **`puzzlePlate`** (*Śluza wagowa*) i **`puzzleLaser`** (*Blokada fotonowa*) | Wąskie, przemysłowo-laboratoryjne śluzy zagadek z Chwytem (`12 × 14 m`, `type: "puzzle"`, `0` wrogów). | Jednokierunkowe kanały logiczne z poprzeczną bramownicą, szynami na podłodze i pojedynczym obiektem fizycznym (`24–28 kg`), bez fal wrogów i bez okrężnych pętli walki. |
| **`combatRing`** (*Rotunda kolumnowa*) | **Dziedziniec Perystylowy Kwartału Nocnego** (`28 × 28 m`, `type: "combat"` L1–L6 + arena trybu *Kradzież rdzenia*). | Jedyny zwarty pokój szturmowy w puli `combat` Kurogane: 4-kolumnowy perystyl z czterostronnym wieńcem belkowania wokół centralnego świetlika deszczowego, 2 przyścienne portyki pod okapami (`city_stall` vs `city_kiosk`), przyczółek ewakuacji na południu i dok rdzenia na północy. |

---

## 3. Plan zmian dla programisty

Plan obejmuje **22 zmiany w danych JSON** w pliku [src/data/rooms/combatRing.json](file:///D:/AgenticProProjects/neoryder-maps/src/data/rooms/combatRing.json), uporządkowane od najważniejszych (naprawa błędów `mapAudit` i usunięcie niekolizyjnych latarń $\rightarrow$ likwidacja czarnego kloca `blocks[13]` i domknięcie architektury 4-kolumnowej Rotundy, nadproży i okapów z `rainShelters` $\rightarrow$ przebudowa pętli osłon i podestów skokowych $\rightarrow$ oświetlenie w limicie 8 świateł, szyldy, projektory, drzwi spawnów i efekty `ambientFx`).

- **Elementy zachowane bez zmian (100% kompatybilności z runem, *Kradzieżą rdzenia*, *Przejęciem* i testami):**
  - `id: "combatRing"`, `name: "Rotunda kolumnowa"`, `type: "combat"`, `theme: "neonStreet"`,
  - `playerSpawn: { "x": 0, "y": 0, "z": 10 }`, `doors[0..1]` (`entry` `(0, 1.5, 13.5)`, `exit` `(0, 1.5, -13.5)`),
  - wszystkie 6 punktów `spawnPoints`: `(0, 0)`, `(-10, -10)`, `(10, -10)`, `(-10, 10)`, `(10, 10)`, `(0, -11)`,
  - `director`, `maxAlive: 8`, `minSpawnDistance: 6`, `props: []` oraz cały obiekt `arena` (`points` `A, B, C` i `arena.spawnPoints`),
  - `blocks[0..6]` (podłoga `28 × 1 × 28 m` `asphalt` i 6 murów obwodowych `wall` `concrete`), `blocks[11]` (`city_crates` w `(-8.5, 0.795, -4)`), `blocks[19]` (`cover_low` w `(0, 0.6, -9.5)`) oraz `blocks[20..28]` (9 budynków tła `facade`).
- **Weryfikacja matematyczna i automatyczna:** cały docelowy układ został przetestowany względem `loadRoom` (`roomSchema.ts`), `validateMode` dla `heistMode` i `conquestMode` (`modeSchema.ts`), `horizonParameters` (`horizon.test.ts` — `expanded: false`, `far: 220`), `wallDecalFitsBlock` (`dressingSchema.ts`) oraz `auditMap` (`mapAudit.ts`), osiągając wynik **`0 error, 0 warn`**.

### Priorytet 1 — Naprawa ostrzeżeń `mapAudit` (wiszące kable `decor[0..1]`) oraz usunięcie niekolizyjnych latarń z podłogi (`decor[9..10]`)

1. **`decor[0]` i `decor[1]` (2 przewody `city_cable_span`) — zaczepienie obu końców na fasadach `blocks[20..23]` na `x = ±15,0 m` i podniesienie ponad hologramy:**
   - **Ścieżki JSON:** `decor[0]`, `decor[1]`.
   - **Co zrobić:** Zmień `scale` z `2.7` na **`3.0`** oraz podnieś `position.y` z `8.2 / 8.5` na **`11.5` i `12.0`**:
     - `decor[0]` (kabel północny): `{ "model": "city_cable_span", "position": { "x": 0, "y": 11.5, "z": -5 }, "yaw": 0, "scale": 3.0 }`
     - `decor[1]` (kabel południowy): `{ "model": "city_cable_span", "position": { "x": 0, "y": 12.0, "z": 5 }, "yaw": 0, "scale": 3.0 }`
   - **Współrzędne zaczepienia wszystkich 4 końców** (lokalne końce z `mapModelBounds.json`: `[-5, -0.06, -0.19]` i `[5, 0, -0.205]` przy `scale: 3.0, yaw: 0`):
     - `decor[0]` koniec zachodni: **`(-15.00, 11.32, -5.57)`** — dokładnie na wschodnim licu fasady `blocks[20]` (`x = -15.0, y ∈ [0, 18], z ∈ [-13.75, -0.25]`),
     - `decor[0]` koniec wschodni: **`(15.00, 11.50, -5.615)`** — dokładnie na zachodnim licu fasady `blocks[22]` (`x = 15.0, y ∈ [0, 16], z ∈ [-13.75, -0.25]`),
     - `decor[1]` koniec zachodni: **`(-15.00, 11.82, 4.43)`** — dokładnie na wschodnim licu fasady `blocks[21]` (`x = -15.0, y ∈ [0, 22], z ∈ [0.25, 13.75]`),
     - `decor[1]` koniec wschodni: **`(15.00, 12.00, 4.385)`** — dokładnie na zachodnim licu fasady `blocks[23]` (`x = 15.0, y ∈ [0, 24], z ∈ [0.25, 13.75]`).
   - **Uzasadnienie:** Usuwa oba ostrzeżenia `floatingObject` z `mapAudit-report.md` i podnosi najniższy punkt zwisu kabli do `y = 8,19–8,69 m`, dzięki czemu przewody nie przecinają już w kadrze bocznych hologramów `holo_koi` i `holo_android`.

2. **`decor[9]` i `decor[10]` (`city_street_lamp` na `(±12.5, 0, 0)`) — usunięcie niekolizyjnych słupów latarń z wnętrza pokoju:**
   - **Ścieżki JSON:** `decor[9]`, `decor[10]`.
   - **Co zrobić:** **Usuń** oba wpisy `city_street_lamp` (`(-12.5, 0, 0)` oraz `(12.5, 0, 0)`).
   - **Uzasadnienie:** Słupy latarń stały `0,5 m` wewnątrz grywalnej podłogi w warstwie `decor` bez kolizji (gracz i wrogowie przenikali przez modele), ich stożki światła przecinały ściany `blocks[1..2]` (`03-east.png`, `06-corner-nw.png`), a 2 generowane przez nie w `CityDressing` światła punktowe powodowały przekroczenie limitu 8 źródeł `PointLight` z ADR 0006 pkt 7 (`8 + 2 = 10`).

### Priorytet 2 — Likwidacja czarnego kloca `blocks[13]` i budowa architektury 4-kolumnowej Rotundy, okapów i nadproży (`weather`, `blocks`, `rainShelters`)

3. **Pole główne `"weather"` — jawne ustawienie deszczowego profilu pogody `"rain"`:**
   - **Ścieżka JSON:** główny obiekt `src/data/rooms/combatRing.json` (obok `"theme": "neonStreet"`).
   - **Co zrobić:** Dodaj `"weather": "rain"`.
   - **Uzasadnienie:** Ujednolica konfigurację z pozostałymi pokojami `neonStreet`, gwarantując pełny połysk mokrego asfaltu (`weatherGloss`), odbicia w kałużach oraz tło dźwiękowe deszczu.

4. **`blocks[13]` (surowy czarny prostopadłościan `(6, 1.4, -3.5)`) + nowy blok `blocks[29]` — zamiana nieoteksturowanego kloca na dwa wschodnie filary `pillar` i zmiana materiału filarów `blocks[7..8]` na `"concrete"`:**
   - **Ścieżki JSON:** `blocks[7]`, `blocks[8]`, `blocks[13]` oraz nowy `blocks[29]`.
   - **Co zrobić:**
     - W `blocks[7]` (`(-5.5, 2, -5)`) i `blocks[8]` (`(-5.5, 2, 5)`) zmień `"material"` z `"trim"` na **`"concrete"`** (zachowując `"model": "pillar"` i `"size": { "x": 1.5, "y": 4, "z": 1.5 }`).
     - Zastąp surowy blok `blocks[13]` (`1.5 × 2.8 × 4 m` w `(6, 1.4, -3.5)`) **północno-wschodnim filarem kolumnady**:
       `{ "size": { "x": 1.5, "y": 4, "z": 1.5 }, "position": { "x": 5.5, "y": 2, "z": -5 }, "model": "pillar", "material": "concrete" }`
     - Dodaj po `blocks[28]` **południowo-wschodni filar kolumnady (`blocks[29]`)**:
       `{ "size": { "x": 1.5, "y": 4, "z": 1.5 }, "position": { "x": 5.5, "y": 2, "z": 5 }, "model": "pillar", "material": "concrete" }`
   - **Uzasadnienie:** Likwiduje największy błąd wizualny i gameplayowy mapy (ślepy czarny monolit `blocks[13]` z `01-spawn.png`, `02-north.png` i `03-east.png`) i tworzy cztery symetryczne kolumny `(±5.5, 2, ±5)` uzasadniające nazwę *„Rotunda kolumnowa”*. Wszystkie 4 filary leżą w odległości `6,37 m > 3,5 m` od środka strefy `C (0, 0)` oraz `4,96 m > 2,75 m` od stref `A/B (±10, -9)`.

5. **`blocks[9]` oraz nowe bloki `blocks[30..32]` — zamknięcie czterostronnego stalowego wieńca belkowania nad 4 filarami Rotundy:**
   - **Ścieżki JSON:** `blocks[9]` oraz nowe `blocks[30]`, `blocks[31]`, `blocks[32]`.
   - **Co zrobić:**
     - Zaktualizuj zachodnią belkę `blocks[9]` na:
       `{ "size": { "x": 1.8, "y": 0.6, "z": 12 }, "position": { "x": -5.5, "y": 4.3, "z": 0 }, "material": "metal" }`
     - Dodaj wschodnią belkę wzdłużną `blocks[30]`:
       `{ "size": { "x": 1.8, "y": 0.6, "z": 12 }, "position": { "x": 5.5, "y": 4.3, "z": 0 }, "material": "metal" }`
     - Dodaj północną belkę poprzeczną wieńca `blocks[31]`:
       `{ "size": { "x": 9.2, "y": 0.5, "z": 1.5 }, "position": { "x": 0, "y": 4.25, "z": -5 }, "material": "metal" }`
     - Dodaj południową belkę poprzeczną wieńca `blocks[32]`:
       `{ "size": { "x": 9.2, "y": 0.5, "z": 1.5 }, "position": { "x": 0, "y": 4.25, "z": 5 }, "material": "metal" }`
   - **Uzasadnienie:** Tworzy nad czterema kolumnami kompletny, czworoboczny wieniec architektoniczny (`12,8 × 12,0 m` po obrysie zewnętrznym, z otwartym świetlikiem `9,2 × 8,5 m` w środku nad centralną kałużą), widoczny jako charakterystyczna korona Rotundy w `01-spawn.png`, `08-high-west.png`, `09-high-east.png` i `10-top.png`.

6. **Nowe bloki `blocks[33..34]` (2 przyścienne okapy z blachy falistej `corrugated` nad portykami zachodnim i wschodnim) + tablica `rainShelters[0..3]`:**
   - **Ścieżki JSON:** `blocks[33]`, `blocks[34]` oraz pole główne `rainShelters`.
   - **Co zrobić:** Dodaj dwa symetryczne zadaszenia przy ścianach bocznych (`x ∈ [±9.2, ±13.0]`, `z ∈ [-4.5, 4.5]`):
     - `blocks[33]` (okap zachodniego pasażu nad straganem `city_stall`):
       `{ "size": { "x": 3.8, "y": 0.24, "z": 9 }, "position": { "x": -11.1, "y": 3.72, "z": 0 }, "material": "corrugated" }`
     - `blocks[34]` (okap wschodniego pasażu nad terminalem `city_kiosk`):
       `{ "size": { "x": 3.8, "y": 0.24, "z": 9 }, "position": { "x": 11.1, "y": 3.72, "z": 0 }, "material": "corrugated" }`
     oraz dodaj tablicę `rainShelters` dopasowaną dokładnie do wysokości od podłogi do wierzchu zadaszeń i belek:
     ```json
     "rainShelters": [
       { "position": { "x": -11.1, "y": 1.92, "z": 0 }, "size": { "x": 3.8, "y": 3.84, "z": 9 } },
       { "position": { "x": 11.1, "y": 1.92, "z": 0 }, "size": { "x": 3.8, "y": 3.84, "z": 9 } },
       { "position": { "x": -5.5, "y": 2.3, "z": 0 }, "size": { "x": 1.8, "y": 4.6, "z": 12 } },
       { "position": { "x": 5.5, "y": 2.3, "z": 0 }, "size": { "x": 1.8, "y": 4.6, "z": 12 } }
     ]
     ```
   - **Uzasadnienie:** Zatrzymuje deszcz pod obiema nawami przyściennymi i belkami kolumnady, jednocześnie zostawiając otwarty pas komunikacyjny `x ∈ [±6.4, ±9.2]` oraz centralny świetlik `x ∈ [-4.6, 4.6]`, dzięki czemu spód okapów nie zasłania widoku z góry (`10-top.png`) ani z narożników (`06-corner-nw.png`, `07-corner-se.png`).

7. **Nowe bloki `blocks[35..36]` (stalowe nadproża domykające wyrwy w murze nad drzwiami `exit` i `entry`):**
   - **Ścieżki JSON:** `blocks[35]`, `blocks[36]`.
   - **Co zrobić:** Dodaj dwie belki nadprożowe (`y ∈ [3.0, 4.0]`) ponad 3-metrowymi drzwiami `doors[0..1]`:
     - `blocks[35]` (nadproże północnej bramy `exit`):
       `{ "size": { "x": 2, "y": 1, "z": 1 }, "position": { "x": 0, "y": 3.5, "z": -13.5 }, "material": "metal" }`
     - `blocks[36]` (nadproże południowej bramy `entry`):
       `{ "size": { "x": 2, "y": 1, "z": 1 }, "position": { "x": 0, "y": 3.5, "z": 13.5 }, "material": "metal" }`
   - **Uzasadnienie:** Likwiduje 1-metrowe dziury w murach nad drzwiami widoczne na `01-spawn.png`, `02-north.png` i `04-south.png`.

### Priorytet 3 — Przebudowa układu osłon, pętli ruchu, podestów skokowych i skrzyń do Chwytu (`blocks[10..18]` i `blocks[37..39]`)

8. **`blocks[10]` (`city_stall`) i `blocks[16]` (`city_kiosk`) — dosunięcie straganu i kiosku pod boczne okapy plecami do murów `x = ±13,0 m` i obrócenie ich frontem ku środkowi Rotundy:**
   - **Ścieżki JSON:** `blocks[10]`, `blocks[16]`.
   - **Co zrobić:**
     - `blocks[10]` (stragan pod zachodnim okapem, obrócony o `+90°` wokół Y frontem w `+X`):
       `{ "size": { "x": 3, "y": 2.622, "z": 2.043 }, "position": { "x": -11.9785, "y": 1.311, "z": 0 }, "rotation": { "x": 0, "y": 1.5707963267948966, "z": 0 }, "model": "city_stall", "material": "metal" }`
     - `blocks[16]` (terminal pod wschodnim okapem, obrócony o `-90°` wokół Y ekranem w `-X`):
       `{ "size": { "x": 0.8, "y": 2.235, "z": 0.6238 }, "position": { "x": 12.6881, "y": 1.1175, "z": 0 }, "rotation": { "x": 0, "y": -1.5707963267948966, "z": 0 }, "model": "city_kiosk", "material": "metal" }`
   - **Uzasadnienie:** Wyciąga `city_stall` z ciasnego prześwitu między zachodnimi kolumnami, a `city_kiosk` ze środka wschodniego placu, likwidując martwe szczeliny pod ścianami (`x_min = -13,00 m` dla straganu, `x_max = +13,00 m` dla kiosku). W efekcie na `05-west.png` widać podświetloną ladę i menu straganu, na `03-east.png` ekran terminala, a po obu stronach otwierają się szerokie na `4,7–6,1 m` korytarze zewnętrznej pętli ruchu.

9. **`blocks[17]` i `blocks[18]` (`cover_low`, `1 × 1.2 × 3 m`) — ustawienie bocznych balustrad osłonowych w osiach zachodniej i wschodniej kolumnady `(±5.5, 0.6, 0)`:**
   - **Ścieżki JSON:** `blocks[17]`, `blocks[18]`.
   - **Co zrobić:** Przesuń `blocks[17..18]` z `(±9.5, 0.6, 0)` na linie kolumnady `x = ±5.5`:
     - `blocks[17]`: `{ "size": { "x": 1, "y": 1.2, "z": 3 }, "position": { "x": -5.5, "y": 0.6, "z": 0 }, "model": "cover_low", "material": "metal" }`
     - `blocks[18]`: `{ "size": { "x": 1, "y": 1.2, "z": 3 }, "position": { "x": 5.5, "y": 0.6, "z": 0 }, "model": "cover_low", "material": "metal" }`
   - **Uzasadnienie:** Odblokowuje zewnętrzne pasaże `x = ±9.5` i tworzy między filarami `(±5.5, -5)` a `(±5.5, 5)` architektoniczne balustrady perystylu (`wys. 1,2 m`), które dają osłonę między wnętrzem Rotundy a bocznymi portykami, zostawiając po bokach **cztery przejścia promieniowe o szerokości `2,75 m`** (`z ∈ [-4.25, -1.5]` i `z ∈ [1.5, 4.25]`) i pełny wolny promień `3,5 m` dla strefy `C (0, 0)` (`5,0 m > 3,5 m`).

10. **`blocks[12]` (`city_barrier`), `blocks[14]` (`city_generator`) i `blocks[15]` (`city_dumpster`) — budowa południowego przyczółka osłaniającego `playerSpawn` / strefę ewakuacji Heist `(0, 0, 10)`:**
    - **Ścieżki JSON:** `blocks[12]`, `blocks[14]`, `blocks[15]`.
    - **Co zrobić:**
      - `blocks[12]` (frontowa zapora między centralnym spawnem `(0, 0)` a graczem na `(0, 10)`):
        `{ "size": { "x": 2, "y": 0.929, "z": 0.51 }, "position": { "x": 0, "y": 0.4645, "z": 6.2 }, "model": "city_barrier", "material": "metal" }`
      - `blocks[15]` (południowo-zachodni podest skokowy `wys. 1,33 m` i osłona flanki przed spawnem `(-10, 10)`):
        `{ "size": { "x": 1.97, "y": 1.33, "z": 1.08 }, "position": { "x": -6, "y": 0.665, "z": 8.8 }, "model": "city_dumpster", "material": "metal" }`
      - `blocks[14]` (południowo-wschodni podest skokowy `wys. 1,40 m` i osłona flanki przed spawnem `(10, 10)`):
        `{ "size": { "x": 1.6, "y": 1.4, "z": 1.005 }, "position": { "x": 6, "y": 0.7, "z": 8.8 }, "model": "city_generator", "material": "metal" }`
    - **Uzasadnienie:** Chroni gracza na starcie oraz podczas 3-sekundowej ewakuacji z rdzeniem w `(0, 0, 10)` przed bezpośrednim ogniem ze środka `(0, 0)` i obu południowych narożników `(±10, 10)`, zachowując z dużym zapasem wolny promień `extractRadiusM = 2,0 m` wokół `(0, 10)` (odstęp `3,55 m` do `city_barrier` i `4,20 m` do bocznych podestów) oraz promień `3,5 m` wokół `C (0, 0)` (`5,95 m`).

11. **Nowy blok `blocks[37]` (`city_generator` w ćwiartce NE `(8.5, 0.7, -4)`) oraz nowe bloki `blocks[38..39]` (2 zniszczalne skrzynie `crate` pod okapami):**
    - **Ścieżki JSON:** `blocks[37]`, `blocks[38]`, `blocks[39]`.
    - **Co zrobić:** Dodaj:
      - `blocks[37]` (północno-wschodni podest skokowy `wys. 1,40 m`, symetryczny do `blocks[11]` `city_crates` w `(-8.5, 0.795, -4)`):
        `{ "size": { "x": 1.6, "y": 1.4, "z": 1.005 }, "position": { "x": 8.5, "y": 0.7, "z": -4 }, "model": "city_generator", "material": "metal" }`
      - `blocks[38]` (zniszczalna skrzynia `crate` pod zachodnim okapem):
        `{ "size": { "x": 1, "y": 1, "z": 1 }, "position": { "x": -11.8, "y": 0.5, "z": -3.2 }, "model": "crate" }`
      - `blocks[39]` (zniszczalna skrzynia `crate` pod wschodnim okapem):
        `{ "size": { "x": 1, "y": 1, "z": 1 }, "position": { "x": 11.8, "y": 0.5, "z": 3.2 }, "model": "crate" }`
    - **Uzasadnienie:** Domyka układ **4 podestów skokowych (`1,33–1,59 m`)** we wszystkich czterech ćwiartkach (`(±8.5, -4)` oraz `(±6, 8.8)`), zostawiając pełny promień `2,75 m` dla strefy `B (10, -9)` (`odległość 4,55 m > 2,75 m`), oraz wprowadza na mapę 2 jasne obiekty interaktywne (`#d9dde3`) dla mocy Chwytu i Pchnięcia.

### Priorytet 4 — Oświetlenie punktowe (`lights[0..7]`, dokładnie 8 źródeł w limicie ADR 0006) i czytelność szyldów (`signs[0..7]`)

12. **`lights[0]` i `lights[1]` — oświetlenie centralnego świetlika Rotundy ciepłą bielą (`#fff1d6`):**
    - **Ścieżki JSON:** `lights[0]`, `lights[1]`.
    - **Co zrobić:** Zastąp słabe światła obwodowe `lights[0..1]` dwoma głównymi reflektorami roboczymi wewnątrz perystylu (przesuniętymi względem osi lampionów, by uniknąć białych odblasków na belkach):
      - `lights[0]`: `{ "position": { "x": -4.2, "y": 3.6, "z": 2.5 }, "color": "#fff1d6", "intensity": 16, "range": 13 }`
      - `lights[1]`: `{ "position": { "x": 4.2, "y": 3.6, "z": -2.5 }, "color": "#fff1d6", "intensity": 16, "range": 13 }`
    - **Uzasadnienie:** Wreszcie doświetla środek pokoju (`r < 6 m`), wydobywając teksturę mokrego asfaltu, 4 kolumny perystylu i czerwone sylwetki wrogów podczas walki w zwarciu.

13. **`lights[2]` i `lights[3]` — doświetlenie zachodniego i wschodniego portyku pod okapami (`blocks[33..34]`):**
    - **Ścieżki JSON:** `lights[2]`, `lights[3]`.
    - **Co zrobić:** Ustaw pod okapami (`y = 3.3 < 3.6`):
      - `lights[2]` (portyk zachodni nad `city_stall` — bursztyn): `{ "position": { "x": -10.8, "y": 3.3, "z": 0 }, "color": "#ffae1a", "intensity": 14, "range": 11 }`
      - `lights[3]` (portyk wschodni nad `city_kiosk` — błękit królewski): `{ "position": { "x": 10.8, "y": 3.3, "z": 0 }, "color": "#3d7bff", "intensity": 14, "range": 11 }`
    - **Uzasadnienie:** Wyraźnie różnicuje kolorystycznie obie flanki pokoju (ciepły bursztyn pasażu gastronomicznego na zachodzie vs chłodny błękit przekaźnika Kurogane na wschodzie).

14. **`lights[4]`, `lights[5]`, `lights[6]`, `lights[7]` — oświetlenie doku rdzenia na północy, strefy ewakuacji na południu i północnych narożników spawnu:**
    - **Ścieżki JSON:** `lights[4]`, `lights[5]`, `lights[6]`, `lights[7]`.
    - **Co zrobić:** Zastąp zawieszone na `y = 5,2–5,8 m` światła `lights[4..7]` czterema światłami stref bojowych na wysokości `y = 3,6 m`:
      - `lights[4]` (północny dok rdzenia Heist `(0, -11.5)` i brama `exit`): `{ "position": { "x": 0, "y": 3.6, "z": -11 }, "color": "#3d7bff", "intensity": 16, "range": 13 }`
      - `lights[5]` (południowa strefa wejścia / ewakuacji `(0, 10)` i brama `entry`): `{ "position": { "x": 0, "y": 3.6, "z": 10.5 }, "color": "#8a5cff", "intensity": 14, "range": 12 }`
      - `lights[6]` (narożnik spawnu NW `(-10, -10)`): `{ "position": { "x": -10, "y": 3.6, "z": -10 }, "color": "#8a5cff", "intensity": 13, "range": 11 }`
      - `lights[7]` (narożnik spawnu NE `(10, -10)`): `{ "position": { "x": 10, "y": 3.6, "z": -10 }, "color": "#6dff4a", "intensity": 13, "range": 11 }`
    - **Uzasadnienie:** Chłodny błękit `lights[4]` przy północnej bazie `(0, -11.5)` daje maksymalny kontrast dla bursztynowego rdzenia Heist (`#ffae1a`) i czerwonych obrońców (`#e0262b`), a łączna liczba świateł w pokoju wynosi dokładnie **8** (zero wygaszania źródeł przy obrocie kamery).

15. **`signs[2]` (`implants`) i `signs[3]` (`noodles`) na ścianie północnej oraz `signs[0..1]` (`karaoke`, `bar_24h`) i `signs[6..7]` (`hotel`, `ramen`) — odsłonięcie szyldów zza kolumn i belek:**
    - **Ścieżki JSON:** `signs[0]`, `signs[1]`, `signs[2]`, `signs[3]`, `signs[6]`, `signs[7]`.
    - **Co zrobić:**
      - Przesuń `signs[2]` (`implants`) i `signs[3]` (`noodles`) z `x = ∓7.5` (gdzie były zasłonięte przez filary `x = ±5.5`) do centralnego okna prześwitu między kolumnami a drzwiami `exit` (`x = ∓3.2`):
        - `signs[2]`: `{ "kind": "neon", "texture": "implants", "position": { "x": -3.2, "y": 3.1, "z": -12.9 }, "size": { "w": 2.4, "h": 1.2 }, "yaw": 0, "tint": "#3d7bff", "flicker": 0.15 }`
        - `signs[3]`: `{ "kind": "neon", "texture": "noodles", "position": { "x": 3.2, "y": 3, "z": -12.9 }, "size": { "w": 1.8, "h": 1.8 }, "yaw": 0, "tint": "#6dff4a", "flicker": 0.2 }`
      - Przesuń boczne neony `signs[0]` (`karaoke`) na `z = 6.5` i `signs[1]` (`bar_24h`) na `z = -6.5` (poza krawędzie okapów `z = ±4.5`).
      - Podnieś fasadowe neony `signs[6]` (`hotel`) na `{ "x": -6.5, "y": 8.5, "z": -14.9 }` i `signs[7]` (`ramen`) na `{ "x": 6.5, "y": 8.5, "z": 14.9 }` (ponad linię belek wieńca Rotundy w kadrze `01-spawn.png` i `04-south.png`).
    - **Uzasadnienie:** Wszystkie cztery neony północne i południowe są w 100% widoczne bez zasłaniania przez kolumny i belki w `01-spawn.png`, `02-north.png` i `04-south.png`.

16. **`signs[4]` (`holo_koi`) i `signs[5]` (`holo_android`) + nowe projektory w `decor` — wyrównanie hologramów z projektorami `city_holo_projector` na koronach murów `x = ±13,5 m`:**
    - **Ścieżki JSON:** `signs[4]`, `signs[5]` oraz 2 nowe wpisy w `decor`.
    - **Co zrobić:**
      - Ustaw `signs[4]` (`holo_koi`) na `{ "kind": "holo", "texture": "holo_koi", "position": { "x": -13.5, "y": 6.74, "z": -6 }, "size": { "w": 5, "h": 2.5 }, "yaw": 1.5708, "tint": "#3d7bff", "flicker": 0.15 }`
      - Ustaw `signs[5]` (`holo_android`) na `{ "kind": "holo", "texture": "holo_android", "position": { "x": 13.5, "y": 8.24, "z": 6 }, "size": { "w": 2, "h": 4 }, "yaw": -1.5708, "tint": "#8a5cff", "flicker": 0.2 }`
      - Dodaj w `decor` dwa projektory na koronach ścian `blocks[1..2]` (`y = 4.0 m`, `scale: 1.2`, soczewka na `y = 4.24 m`):
        - `{ "model": "city_holo_projector", "position": { "x": -13.5, "y": 4, "z": -6 }, "yaw": 1.5708, "scale": 1.2 }`
        - `{ "model": "city_holo_projector", "position": { "x": 13.5, "y": 4, "z": 6 }, "yaw": -1.5708, "scale": 1.2 }`
    - **Uzasadnienie:** Wierzchołki stożków projekcyjnych obu hologramów (`y - h = 6.74 - 2.5 = 4.24 m` oraz `8.24 - 4.0 = 4.24 m`) trafiają dokładnie w soczewki projektorów na koronie muru.

### Priorytet 5 — Lampiony kolumnady, bramy narożnych spawnów, kalkomanie i korekta `ambientFx`

17. **Nowe wpisy w `decor` (2 sznury lampionów `city_lantern_string` pod belkami kolumnady) — oba końce zaczepione w filarach `blocks[7..8]` i `blocks[13, 29]`:**
    - **Ścieżki JSON:** `decor[2]`, `decor[3]`.
    - **Co zrobić:** Dodaj dwa sznury lampionów wzdłuż zachodniej i wschodniej kolumnady (`scale: 1.0`, lokalne końce z `mapModelBounds.json`: `[-5, -0.14, 0.08]` i `[5, -0.14, 0.08]`):
      - `decor[2]` (zachodni, między `blocks[7]` a `blocks[8]`):
        `{ "model": "city_lantern_string", "position": { "x": -5.5, "y": 3.85, "z": 0 }, "yaw": 1.5708, "scale": 1.0 }`
        - koniec południowy: **`(-5.42, 3.71, 5.00)`** — wewnątrz filara SW `blocks[8]` (`x ∈ [-6.25, -4.75], y ∈ [0, 4], z ∈ [4.25, 5.75]`),
        - koniec północny: **`(-5.42, 3.71, -5.00)`** — wewnątrz filara NW `blocks[7]` (`x ∈ [-6.25, -4.75], y ∈ [0, 4], z ∈ [-5.75, -4.25]`).
      - `decor[3]` (wschodni, między `blocks[13]` a `blocks[29]`):
        `{ "model": "city_lantern_string", "position": { "x": 5.5, "y": 3.85, "z": 0 }, "yaw": -1.5708, "scale": 1.0 }`
        - koniec północny: **`(5.42, 3.71, -5.00)`** — wewnątrz filara NE `blocks[13]` (`x ∈ [4.75, 6.25], y ∈ [0, 4], z ∈ [-5.75, -4.25]`),
        - koniec południowy: **`(5.42, 3.71, 5.00)`** — wewnątrz filara SE `blocks[29]` (`x ∈ [4.75, 6.25], y ∈ [0, 4], z ∈ [4.25, 5.75]`).
    - **Uzasadnienie:** Wszystkie 4 końce sznurów spoczywają wewnątrz betonowych filarów (`0` ostrzeżeń `floatingObject`), a stożki `LampCones` podkreślają obie kolumnady bez dodawania nadmiarowych `PointLight`.

18. **Nowe wpisy w `decor` (`city_shutter` i `city_door` przy narożnych punktach spawnu `(±10, ±10)`):**
    - **Ścieżki JSON:** `decor` (obok istniejącej rolety `city_shutter` na `(-13, 0, 10)`).
    - **Co zrobić:** Dodaj na wewnętrznych licach ścian bocznych `blocks[1..2]` (`x = ±13.0`) brakujące wejścia dla trzech pozostałych narożnych spawnów:
      - przy spawnie NE `(10, -10)`: `{ "model": "city_shutter", "position": { "x": 13, "y": 0, "z": -10 }, "yaw": -1.5708, "scale": 1 }`
      - przy spawnie NW `(-10, -10)`: `{ "model": "city_door", "position": { "x": -13, "y": 0, "z": -10 }, "yaw": 1.5708, "scale": 1 }`
      - przy spawnie SE `(10, 10)`: `{ "model": "city_door", "position": { "x": 13, "y": 0, "z": 10 }, "yaw": -1.5708, "scale": 1 }`
    - **Uzasadnienie:** Każdy z czterech narożnych punktów spawnu fal `(±10, ±10)` otrzymuje czytelne drzwi śluzy lub roletę zrzutową na ścianie (modele należą do `WALL_FIXTURES` o głębokości `0,24–0,25 m`).

19. **Korekta pozycji rur `city_pipe_run` i anten `city_antenna` w `decor`:**
    - **Ścieżki JSON:** wpisy `city_pipe_run` i `city_antenna` w `decor`.
    - **Co zrobić:**
      - Przesuń dwa piony rur `city_pipe_run` z `z = ∓1` (znad szczeliny `z ∈ [-0.25, 0.25]` między budynkami) na środek fasad `blocks[20]` i `blocks[23]` przy `z = ∓3.5`, `scale: 1.2`:
        - `{ "model": "city_pipe_run", "position": { "x": -15, "y": 4, "z": -3.5 }, "yaw": 1.5708, "scale": 1.2 }`
        - `{ "model": "city_pipe_run", "position": { "x": 15, "y": 4, "z": 3.5 }, "yaw": -1.5708, "scale": 1.2 }`
      - Przenieś dwie boczne anteny `city_antenna` z najwyższych południowych dachów `(±18, 22..24, 7)` (gdzie wchodziły w dolne rogi kadru `10-top.png`) na dachy północnych fasad `blocks[20]` i `blocks[22]`:
        - `{ "model": "city_antenna", "position": { "x": -18, "y": 18, "z": -7 }, "yaw": 0.3, "scale": 1.3 }`
        - `{ "model": "city_antenna", "position": { "x": 18, "y": 16, "z": -7 }, "yaw": -0.3, "scale": 1.3 }`
        - trzecia antena na dachu `blocks[26]`: `{ "model": "city_antenna", "position": { "x": 0, "y": 24, "z": -23 }, "yaw": 0, "scale": 1.5 }`.

20. **`decals[3]` (`floor_arrow` na `(0, 0.01, 7.5)`) — zamiana pstrokatej strzałki przed graczem na oznaczenie `floor_hazard` północnego doku rdzenia Heist / spawnu `(0, 0.01, -11.2)`:**
    - **Ścieżka JSON:** `decals[3]`.
    - **Co zrobić:** Zmień `decals[3]` z `floor_arrow` w `(0, 0.01, 7.5)` na:
      `{ "texture": "floor_hazard", "position": { "x": 0, "y": 0.01, "z": -11.2 }, "size": { "w": 2.6, "h": 2.2 }, "yaw": 0, "surface": "floor", "opacity": 0.65 }`
    - **Uzasadnienie:** Usuwa z pierwszego planu `01-spawn.png` i `04-south.png` agresywną strzałkę drogową i oznacza na posadzce za północną osłoną `blocks[19]` gniazdo rdzenia *Kradzieży rdzenia* (`base (0, 0, -11.5)`) oraz północny punkt spawnu `(0, -11)`.

21. **`decals[0..1]` (`graffiti_tag2` i `poster_torn2`) oraz `decals[4..6]` (kałuże `puddle1`/`puddle2`) — odsunięcie kalkomanii ściennych od okapów i dopasowanie kałuż:**
    - **Ścieżki JSON:** `decals[0]`, `decals[1]`, `decals[4]`, `decals[5]`.
    - **Co zrobić:**
      - Przesuń `decals[0]` (`graffiti_tag2` na ścianie zachodniej) z `z = -5` na `z = -6.5` oraz `decals[1]` (`poster_torn2` na ścianie wschodniej) z `z = 5` na `z = 6.5` (poza strefę okapów `z ∈ [-4.5, 4.5]`, pod neony `karaoke` / `bar_24h`).
      - Powiększ centralną kałużę `decals[4]` (`puddle1` w `(0, 0.01, 0)`) do `{ "w": 3.8, "h": 3.8 }` pod świetlikiem Rotundy, a kałużę `decals[5]` (`puddle2`) ustaw w `(-7.5, 0.01, -7)` (w odkrytym korytarzu poza obrysem skrzyń `blocks[11]`).

22. **`ambientFx[2..4]` (`sparks` i `drip`) — powiązanie efektów cząsteczkowych z fizyczną geometrią rolety i okapów:**
    - **Ścieżki JSON:** `ambientFx[2]`, `ambientFx[3]`, `ambientFx[4]`.
    - **Co zrobić:**
      - `ambientFx[2]` (`sparks`): przesuń z pustego muru `(12.8, 3.8, -1)` na obudowę nowej wschodniej rolety zrzutowej `city_shutter`:
        `{ "kind": "sparks", "position": { "x": 12.75, "y": 2.9, "z": -10 }, "rate": 0.55 }`
      - `ambientFx[3]` (`drip`): przesuń z pustego powietrza `(-12.5, 4.5, 2)` na dolną wewnętrzną krawędź zachodniego okapu `blocks[33]`:
        `{ "kind": "drip", "position": { "x": -9.2, "y": 3.6, "z": 2 }, "rate": 2 }`
      - `ambientFx[4]` (`drip`): przesuń z pustego powietrza `(5, 4.5, -12.5)` na dolną wewnętrzną krawędź wschodniego okapu `blocks[34]`:
        `{ "kind": "drip", "position": { "x": 9.2, "y": 3.6, "z": -2 }, "rate": 1.8 }`

---

## 4. Kryteria odbioru na zrzutach

Po wdrożeniu powyższego planu w `src/data/rooms/combatRing.json`, uruchomieniu audytu `node tools/levels/mapAudit.mjs combatRing` oraz wygenerowaniu serii 10 zrzutów `node tools/screens/mapAudit.mjs combatRing --tag after` w `artifacts/maps/combatRing/after/`:

1. **Walidacja automatyczna i testy (`mapAudit` + Vitest + Playwright):**
   - `node tools/levels/mapAudit.mjs combatRing` zwraca **`0 error` i `0 warn`** (znikają oba ostrzeżenia `floatingObject` dla `decor[0..1]`; brak zgłoszeń `noCollisionLargeProp`, `overlap`, `outOfBounds`, `forbiddenColor` i `emptyRoom`).
   - Testy jednostkowe i e2e (`npm test -- tests/unit/rooms.test.ts tests/unit/heist.test.ts tests/unit/conquest.test.ts tests/unit/arenaWeather.test.ts tests/unit/horizon.test.ts tests/unit/mapAudit.test.ts` oraz `npx playwright test tests/e2e/heist.spec.ts`) przechodzą na zielono.

2. **Widok ze spawnu (`01-spawn.png`) i widok ze środka na północ (`02-north.png`):**
   - **Symetryczna architektura Rotundy i brak czarnego kloca `blocks[13]`:** zniknął ogromny, nieoteksturowany czarny prostopadłościan z prawej strony kadru. Zamiast niego na `01-spawn.png` gracz patrzy przez symetryczny, czterokolumnowy perystyl (`blocks[7..8, 13, 29]` w materiale `concrete`) zwieńczony czterostronnym stalowym belkowaniem (`blocks[9, 30..32]`) i dwoma sznurami bursztynowych lampionów `city_lantern_string`.
   - **Osłona startu/ewakuacji i czysty pierwszy plan:** na dole `01-spawn.png` nie ma już pstrokatej strzałki `floor_arrow` — na osi `x = 0, z = 6,2` stoi betonowa zapora `city_barrier` z pasami ostrzegawczymi, a na skrzydłach `(±6, 8,8)` kontener `city_dumpster` i agregat `city_generator` osłaniające strefę `(0, 0, 10)`.
   - **Czytelna północna śluza i dok rdzenia:** na `02-north.png` północne drzwi `exit` `(0, 1.5, -13.5)` są domknięte od góry stalowym nadprożem `blocks[35]`, przed nimi w królewskim błękicie `lights[4]` (`#3d7bff`) widać oznaczenie doku rdzenia `floor_hazard` za niską osłoną `blocks[19]`, a neony **`IMPLANTY`** (`x = -3.2`) i **`noodles`** (`x = 3.2`) są w pełni widoczne w prześwicie między kolumnami (nie są już przecięte filarem ani belką).

3. **Widoki boczne ze środka na wschód (`03-east.png`) i zachód (`05-west.png`):**
   - **Wschodni portyk przekaźnikowy (`03-east.png`):** między dwiema wschodnimi kolumnami `(5.5, ±5)` stoi centralna balustrada `cover_low` `(5.5, 0.6, 0)` z dwoma szerokimi przejściami (`2,75 m`) po bokach. W głębi pod okapem `blocks[34]` w błękitnym świetle `lights[3]` widać zwrócony ekranem do gracza terminal `city_kiosk` dosunięty do ściany, agregat `city_generator`, jasną skrzynię `crate`, roletę `city_shutter` z iskrami `sparks` oraz hologram `holo_android` osadzony na projektorze `city_holo_projector` na koronie muru (bez przecinającego go kabla i bez trójkątnego stożka niekolizyjnej latarni na ścianie).
   - **Zachodni portyk nocnego pasażu (`05-west.png`):** między dwiema zachodnimi kolumnami `(-5.5, ±5)` ponad balustradą `cover_low` `(-5.5, 0.6, 0)` widać pod okapem `blocks[33]` w bursztynowym świetle `lights[2]` **obrócony frontową ladą i ekranem menu ku graczowi stragan `city_stall`** dosunięty plecami do zachodniego muru, paletę `city_crates`, jasną skrzynię `crate` oraz hologram `holo_koi` nad projektorem na koronie muru.

4. **Widok na południe (`04-south.png`) oraz ujęcia narożne (`06-corner-nw.png`, `07-corner-se.png`):**
   - Na `04-south.png` widać południową bramę `entry` domkniętą nadprożem `blocks[36]` w fioletowym świetle `lights[5]`, zaporę `city_barrier` przed strefą ewakuacji `(0, 0, 10)` (bez pstrokatej strzałki `floor_arrow`) oraz podniesiony neon `ramen` (`y = 8,5 m`) czysto ponad belką wieńca.
   - Na `06-corner-nw.png` i `07-corner-se.png` zniknęły niekolizyjne słupy latarń `city_street_lamp` z `(±12.5, 0, 0)`, środek dziedzińca jest wyraźnie oświetlony ciepłą bielą `lights[0..1]` z odbiciami w centralnej kałuży `puddle1`, a wzdłuż ścian bocznych widoczne są szerokie, drożne korytarze zewnętrznej pętli ruchu oraz jasne skrzynie `crate` pod okapami.

5. **Widoki pod kątem 35° i z góry (`08-high-west.png`, `09-high-east.png`, `10-top.png`):**
   - Obie wiązki przewodów `decor[0..1]` (`city_cable_span`, `scale: 3.0`) sięgają na pełną rozpiętość `30 m` między budynkami i mają wszystkie 4 końce zakotwiczone bezpośrednio w licach fasad `blocks[20..23]` na `x = ±15,0 m` (brak urwanych końcówek wiszących nad murami).
   - Z góry (`10-top.png`) układ jest w pełni czytelny i symetryczny: w centrum czterostronny wieniec belkowania na 4 kolumnach otacza odkryty świetlik z kałużą `(0, 0)`, po bokach przy murach biegną dwa okapy `corrugated` (pod którymi `rainShelters` zatrzymują smugi deszczu), pomiędzy nimi a kolumnadą prowadzą czyste korytarze obwodowe, a w dolnych rogach `10-top.png` nie wystają już czarne igły anten dachowych.
