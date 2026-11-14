# Assety 3D — konwencje i katalog

Modele są generowane proceduralnie skryptem `tools/blender/build_assets.py` (Blender 5.2, tryb wsadowy). Nie edytuj `.glb` ręcznie: zmień skrypt i zbuduj ponownie.

```bash
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py            # wszystko
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- --only crate,blaster --no-preview
```

Wynik: `public/assets/models/<nazwa>.glb` oraz podglądy `tools/blender/previews/<nazwa>.png` (Workbench — sprawdź je po każdej zmianie).

## Konwencje (obowiązkowe dla nowych modeli)

| Zasada               | Wartość                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Jednostki            | metry, glTF Y-up                                                                               |
| Postacie i rekwizyty | patrzą w **+Z** (zgodnie z `Object3D.lookAt`), spód / stopy na `y = 0`, środek w `x = z = 0`   |
| Broń gracza          | celuje w **-Z** (kierunek kamery), początek układu w punkcie chwytu                            |
| Ręce gracza (FPP)    | początek = nadgarstek, palce w spoczynku w **-Z**, wnętrze dłoni w **+Y**, przedramię w **+Z** |
| Strona prawa postaci | **-X** (postać patrzy w +Z)                                                                    |
| Cieniowanie          | płaskie (flat), low-poly, bez tekstur                                                          |
| Budżet               | wróg ≤ 1500 trójkątów, rekwizyt ≤ 500, broń ≤ 400, ręka FPP ≤ 3000                             |

### Materiały (rozpoznawane po nazwie — shader stylu może je podmienić)

| Materiał            | Kolor                     | Użycie                                                            |
| ------------------- | ------------------------- | ----------------------------------------------------------------- |
| `mat_world`         | biel `#ebebeb`            | otoczenie, ściany, osłony                                         |
| `mat_interactive`   | czerń `#080808`           | obiekty interaktywne (skrzynie do chwytu Rezonansem), broń gracza |
| `mat_enemy`         | czerwień `#e0262b`        | wrogowie                                                          |
| `mat_enemy_glow`    | jasna czerwień, emisja    | wizjery, końcówki broni wroga, pociski wroga                      |
| `mat_player_cyan`   | cyan `#00e5ff`, emisja    | ostrze, otwory chłodzenia blastera, akcenty gracza                |
| `mat_power_magenta` | magenta `#ff2bd6`, emisja | efekty mocy, emiter Rezonansu na dłoni                            |

## Wrogowie — sztywne części z pivotami w stawach

Wrogowie nie mają skinningu. Każda część to osobny węzeł z pivotem w stawie, więc:

- animacja = obroty węzłów w kodzie (proceduralnie, z danych), bez klipów;
- rozpad na odłamki może startować od części (każda część osobno do puli odłamków), kierunek zgodny z ciosem.

Hierarchia (identyczna dla wszystkich humanoidów):

```
enemy_<typ>
└─ pelvis
   ├─ torso
   │  ├─ head ─ helmet, visor
   │  ├─ arm_upper_L ─ arm_lower_L ─ hand_L
   │  └─ arm_upper_R ─ arm_lower_R ─ hand_R ─ <broń>
   ├─ leg_upper_L ─ leg_lower_L ─ foot_L
   └─ leg_upper_R ─ leg_lower_R ─ foot_R
```

Wysokość ~1,84 m, staw szyi `head` na 1,52 m. Części dodatkowe są dziećmi części nośnej (np. `shoulder_pad_L` pod `torso`).

## Katalog

| Plik                                   | Co to                                                                                                                                                                               | Węzły dla kodu                                                                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enemy_trooper.glb`                    | Szturmowiec (≈1370 tri): masywny, fazowane naramienniki, kamizelka z ładownicami, nakolanniki i nałokietniki, hełm ze świecącym paskiem wizjera, plecak z anteną, pałka elektryczna | `baton` (pivot w dłoni), `baton_tip` (świecąca końcówka), `baton_hit` (punkt trafienia), `visor`                                                                                  |
| `enemy_gunner.glb`                     | Strzelec (≈1430 tri): smuklejszy, hełm z osłoną karku, kamizelka z magazynkami, plecak z anteną, karabin                                                                            | `rifle` (pivot w dłoni), `muzzle` (wylot pocisku, 0,71 m od chwytu), `visor`                                                                                                      |
| `enemy_sniper.glb`                     | Snajper (≈1490 tri): wysoki i smukły (~1,9 m), poły płaszcza jako panele na udach, hełm z jedną okrągłą soczewką, długi karabin z lunetą                                            | `rifle`, `muzzle` (0,71 m od chwytu, jak u Strzelca — `muzzle` z danych pasuje), `visor` (soczewka), `scope_lens`                                                                 |
| `enemy_shielder.glb`                   | Tarczownik (≈1390 tri): krępy, ciężkie pancerze, krótka pałka, duża tarcza 0,8 × 1,2 × 0,12 m przed lewym bokiem (lewa ręka ułożona za nią)                                         | `shield` (pivot w środku tarczy, dziecko `pelvis`; `EnemyView` używa go zamiast bryły zastępczej i przełącza `visible` wg `shieldUp`), `baton`, `baton_tip`, `baton_hit`, `visor` |
| `enemy_executor.glb`                   | Egzekutor (≈1470 tri): największy (~2,1 m), napierśnik z rdzeniem, kolczaste naramienniki, tassety, hełm z grzebieniem i rogami, plecak                                             | `blade_hilt` (rękojeść w prawej dłoni; samo ostrze dodaje kod wg `bladeSizeM` jako `executor_blade` w `hand_R`), `visor`                                                          |
| `enemy_drone.glb`                      | Dron (≈860 tri): kadłub z kopułą czujnika, cztery ramiona z osłonami, lufa pod okiem; początek układu w środku kadłuba, oko z przodu (+Z)                                           | `eye` (pulsuje przy celowaniu), `rotor_LF/RF/LB/RB` (pivot w środku, obrót wokół Y), `muzzle`                                                                                     |
| `enemy_projectile.glb`                 | wolny, dobrze widoczny pocisk wroga, wydłużony wzdłuż Z                                                                                                                             | — (do `InstancedMesh`)                                                                                                                                                            |
| `plasma_blade.glb`                     | ostrze plazmowe                                                                                                                                                                     | `hilt`, `emitter_ring`, `blade` (pivot u emitera — skaluj po Z do wysuwania), `blade_core`, `blade_tip`                                                                           |
| `blaster.glb`                          | blaster z przegrzaniem                                                                                                                                                              | `frame`, `heat_vents` i `heat_cell` (kolor/emisja = poziom ciepła), `muzzle`                                                                                                      |
| `player_arm_R.glb`, `player_arm_L.glb` | opancerzone przedramię i przegubowa dłoń FPP (2656 tri na rękę)                                                                                                                     | `forearm`, `wrist`, `palm`, 15 przegubów palców, `palm_center`, `resonance_core`, `socket_blade`, `socket_gun`, `socket_support`                                                  |
| `crate.glb`, `crate_small.glb`         | skrzynie 1 m i 0,5 m (interaktywne: chwyt i rzut)                                                                                                                                   | —                                                                                                                                                                                 |
| `pillar.glb`                           | filar 4 m                                                                                                                                                                           | —                                                                                                                                                                                 |
| `wall_segment.glb`                     | ściana 4 × 3 m, grubość 0,4 m                                                                                                                                                       | —                                                                                                                                                                                 |
| `cover_low.glb`                        | niska osłona 2 × 1 m                                                                                                                                                                | —                                                                                                                                                                                 |

Model wroga wybiera pole `model` w `src/data/enemies/<id>.json` (nazwa pliku bez `.glb`). Brak pola: Strzelec i Snajper używają `enemy_gunner`, pozostałe humanoidy `enemy_trooper`; przy błędzie ładowania zostają bryły zastępcze (`EnemyView`, `DroneView`). Test `tests/unit/enemyModels.test.ts` pilnuje, że plik istnieje. Humanoidy mają ręce i nogi z nakładkami (nakolanniki, nałokietniki) jako dzieci stawów, więc animacja kodu je niesie; materiały: pancerz `mat_enemy`, wizjer i końcówki `mat_enemy_glow`.

Kolizje: wyprowadzaj z prostych brył w kodzie (prostopadłościany, kapsuły), nie z siatek modeli.

## Uwagi do F1

- Modele to placeholdery w docelowym stylu. Dopracowanie (więcej archetypów, warianty frakcji) w kolejnych fazach.
- Węzeł `blade` ma rozmiar 1 m przy skali 1; długość ostrza ustawiaj w `tuning.ts`, nie w modelu.
- Rozpad na odłamki (zadanie F1 #12) może ciąć części proceduralnie lub podmieniać je na gotowe fragmenty — decyzja w zadaniu.

## Bronie i ostrza F2

Bronie celują w -Z, początek w punkcie chwytu. Bryła `frame` to `mat_interactive`; `heat_vents` i
`heat_cell` (`mat_player_cyan`) kod koloruje ciepłem; `muzzle` to pusty węzeł wylotu (tu rysowany
jest błysk). Budowa: `--only blaster,pistol,rifle,scatter,sniper_rifle,beam,emp_launcher,blade_twin,blade_staff`.

| Plik               | Sylwetka                                                       | Węzły dla kodu                                                                                  | Trójkąty |
| ------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| `blaster.glb`      | średni pistolet energetyczny, kołpak lufy                      | `frame`, `heat_vents`, `heat_cell`, `muzzle`                                                    | 252      |
| `pistol.glb`       | zwarty, krótki zamek, trzy cyjanowe nacięcia                   | `frame`, `heat_vents`, `heat_cell`, `muzzle`                                                    | 180      |
| `rifle.glb`        | długi, kolba, ogniwo ciepła jak magazynek                      | `frame`, `heat_vents`, `heat_cell`, `muzzle`                                                    | 232      |
| `scatter.glb`      | szeroki, dwie grube lufy, pompa                                | `frame`, `heat_vents`, `heat_cell`, `muzzle`                                                    | 256      |
| `sniper_rifle.glb` | bardzo długi, luneta z cyjanową soczewką (`scope_lens`)        | `frame`, `heat_vents`, `heat_cell`, `scope_lens`, `muzzle`                                      | 316      |
| `beam.glb`         | gruby emiter z cewkami i soczewką (`lens`)                     | `frame`, `heat_vents` (cewki), `heat_cell`, `lens`, `muzzle`                                    | 288      |
| `emp_launcher.glb` | gruba tuba z bębnem i rozszerzonym wylotem                     | `frame`, `heat_vents` (pierścienie), `heat_cell`, `muzzle`                                      | 228      |
| `blade_twin.glb`   | krótsza rękojeść z poprzeczną osłoną                           | jak `plasma_blade`: `hilt`, `emitter_ring`, `blade`, `blade_core`, `blade_tip`                  | 156      |
| `blade_staff.glb`  | długa rękojeść (0,8 m), emitery na obu końcach, chwyt w środku | przód `blade`, `blade_core`, `blade_tip`; tył `blade_back`, `blade_back_core`, `blade_back_tip` | 220      |

Pivoty `blade` i `blade_back` leżą u emiterów, długość ostrza 1 m przy skali 1 (skaluj po Z).
Model broni wskazuje pole `model` w `src/data/weapons/<id>.json`.

### Punkt podparcia broni

Wszystkie siedem modeli broni palnej ma dodatkowy pusty węzeł `support`, bezpośrednie dziecko
roota, z orientacją identyczną jak root i skalą jednostkową. Geometria oraz dotychczasowe
węzły (`frame`, `muzzle`, `heat_vents`, `heat_cell`, opcjonalne soczewki) pozostają bez zmian.
Położenia w metrach, w osiach glTF:

| Model          | `support` [X, Y, Z] |
| -------------- | ------------------- |
| `pistol`       | [0, -0.105, 0.02]   |
| `blaster`      | [0, -0.125, 0.02]   |
| `rifle`        | [0, 0.012, -0.28]   |
| `scatter`      | [0, -0.008, -0.28]  |
| `sniper_rifle` | [0, 0.017, -0.30]   |
| `beam`         | [0, 0.018, -0.22]   |
| `emp_launcher` | [0, 0.014, -0.20]   |

## Przegubowe ręce FPP

Każda ręka ma 2656 trójkątów, przedramię z mankietem ok. 0,35 m i dłoń ok. 0,19 m od
nadgarstka do czubka środkowego palca. Trzy fazowane, nachodzące płyty przedramienia są czarne,
dwie podłużne listwy i pasek nadgarstka cyjanowe, mankiet biały. Grzbiet dłoni ma płytkę
z magentowym emiterem `resonance_core`. Paliczki mają osłony kostek, ośmioboczne osłony
przegubów i opuszki. Wszystkie materiały należą do `PALETTE`, bez tekstur i skinningu.

Hierarchia obu modeli (nazwy przegubów są identyczne wewnątrz R i L):

```text
player_arm_R / player_arm_L
└─ forearm
   ├─ armor_1/2/3, undersleeve, light_rail*, cuff, cuff_seam, wrist_ring, wrist_light
   └─ wrist                         (pusty przegub)
      └─ palm                       (siatka, pivot w nadgarstku)
         ├─ dorsal_plate, dorsal_trace*, resonance_mount, resonance_core
         ├─ thumb_web, palm_pad*
         ├─ index_1  → index_2  → index_3
         ├─ middle_1 → middle_2 → middle_3
         ├─ ring_1   → ring_2   → ring_3
         ├─ pinky_1  → pinky_2  → pinky_3
         ├─ thumb_1  → thumb_2  → thumb_3
         ├─ palm_center
         ├─ socket_blade
         ├─ socket_gun
         └─ socket_support
```

Każdy `<palec>_<n>` jest pustym węzłem umieszczonym w stawie. Ma siatki
`<palec>_phalanx_<n>`, `<palec>_guard_<n>` i `<palec>_bearing_<n>` jako dzieci;
ostatni człon ma także `<palec>_pad`. Obrót przegubu niesie dalsze człony.
Gwiazdka w schemacie oznacza kilka siatek dekoracyjnych, nie dosłowną nazwę węzła.

### Osie i gniazda

GLB eksportuje **spoczynek**, z prostymi, lekko rozstawionymi palcami. `relaxed` jest pozą
z danych stosowaną tylko do podglądu modelu. Root i nadgarstek są w początku układu.
Przedramię biegnie w +Z, palce w -Z, wnętrze dłoni jest po +Y. Kciuk prawej dłoni jest po +X,
lewej po -X. Lokalna oś X każdego przegubu palców to zawias: **dodatni kąt zgina do wnętrza**.
Kciuk ma ukośny układ opozycji; `thumb_1` może obracać się we wszystkich osiach,
`thumb_2/3` zginają się po lokalnym X. Oś -Z węzła `palm_center` wskazuje na zewnątrz
wnętrza dłoni (w spoczynku +Y roota), do zaczepiania efektów mocy.

Gniazda są pustymi dziećmi `palm`, mają skalę [1, 1, 1] i obroty o wyznaczniku +1:

- `socket_blade`: dołącz `plasma_blade.glb` z jednostkową transformacją i zastosuj `gripBlade`.
  Rękojeść leży poprzecznie w tunelu palców; emiter i ostrze wychodzą po stronie wskazującego
  i kciuka, głowica po stronie małego palca. Lokalna -Z broni wskazuje stronę emitera.
- `socket_gun`: dołącz `pistol.glb` lub `blaster.glb` z jednostkową transformacją i zastosuj
  `gripGun`. Wskazujący biegnie przy kabłąku; `gripGunFire` dociska jego dalsze człony.
  Kciuk leży obok zamka. Przedmioty są wymienne — ręka trzyma jedną rzecz naraz.
- `socket_support`: zastosuj `support` i dopasuj światową macierz tego gniazda do
  światowej macierzy `support` broni. Dłoń podpiera łoże od spodu; gniazdo ma skręt o 55°
  względem spoczynku dłoni, żeby przedramię dochodziło ukośnie z boku.
  Dla sceny podglądu: `M_hand = M_weapon_support * inverse(M_hand_socket_relative)`.

Lewa geometria jest odbiciem względem YZ z odwróconą kolejnością wierzchołków ścian
i poprawnymi normalnymi. Dla lokalnych macierzy stosowane jest `M_L = S * M_R * S`,
gdzie `S = diag(-1, 1, 1, 1)`. Nie ma ujemnej skali, także na gniazdach.
`S * Rx(a) * S = Rx(a)`, więc te same dodatnie kąty z danych zginają obie dłonie
w tę samą stronę. Wszystkie dostarczone pozy używają X; przy przyszłych obrotach Y/Z
trzeba uwzględnić lustrzany układ (identyczne kąty Y/Z nie tworzą lustrzanych ruchów).

### Pozy — jedno źródło danych

`src/data/hands/handPoses.json` jest czytany przez generator podglądów i przeznaczony do
odczytu przez grę. Format:

```json
{
  "poses": {
    "relaxed": {
      "index_1": [0.17, 0, 0]
    }
  }
}
```

To przykład formatu, plik zawiera siedem pełnych póz: `relaxed`, `open`, `fist`,
`gripBlade`, `gripGun`, `gripGunFire`, `support`. Wartości to **radiany Euler XYZ
w lokalnych osiach glTF**, tak jak w Three.js (`Rx * Ry * Rz`). Węzły pominięte wracają
do spoczynku. Obrót należy liczyć od zapamiętanej orientacji spoczynkowej, bez kumulowania:
`q_pose = q_rest * q_EulerXYZ`. Nie dodawać kątów do Eulera spoczynkowego.
Skrypt jawnie przelicza lokalne geometrie i macierze glTF do Blendera przed eksportem,
a przy podglądzie sprzęga obrót pozy z tą samą zmianą bazy.

### Budowanie i kontrola wizualna

```bash
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- --only player_arm_R,player_arm_L
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- --only blaster,pistol,rifle,scatter,sniper_rifle,beam,emp_launcher
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- --only hand_previews
```

`hand_previews` tworzy wyłącznie PNG, **nie eksportuje dodatkowych GLB**. Podglądy Workbench:

- `player_arm_R.png`, `player_arm_L.png`: `relaxed`, pełne przedramię i mankiet;
- `hand_pose_open.png`, `hand_pose_fist.png`: obie dłonie obok siebie, wspólne kąty;
- `hand_grip_blade.png`, `hand_grip_pistol.png`, `hand_grip_rifle.png`: przedmioty w gniazdach,
  karabin dodatkowo z lewą ręką na swoim `support`;
- `hand_fpp_view.png`: kamera w początku, patrzy w -Z, pionowe FOV 70°, 16:9;
  prawy nadgarstek przy [0.22, -0.24, -0.45] m, pistolet skierowany w -Z;
- dodatkowe zbliżenia: `hand_grip_blade_inner.png`, `hand_grip_pistol_inner.png`,
  `hand_support_rifle.png`; warianty `hand_grip_pistol_fire.png` i `hand_grip_blaster.png`.

Sprawdź szczególnie styki opuszek z chwytem i kciuk przy zamku, czytelność segmentów
przy zgięciu, lustrzane zgięcie palców oraz proporcje ręki w dolnym prawym rogu widoku FPP.
Podgląd ostrza celowo kadruje rękojeść i dłoń; koniec pełnowymiarowego ostrza wypada poza kadrem.
