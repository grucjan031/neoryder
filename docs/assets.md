# Assety 3D — konwencje i katalog

Modele są generowane proceduralnie skryptem `tools/blender/build_assets.py` (Blender 5.2, tryb wsadowy). Nie edytuj `.glb` ręcznie: zmień skrypt i zbuduj ponownie.

```bash
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py            # wszystko
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- --only crate,blaster --no-preview
```

Wynik: `public/assets/models/<nazwa>.glb` oraz podglądy `tools/blender/previews/<nazwa>.png` (Workbench — sprawdź je po każdej zmianie).

## Konwencje (obowiązkowe dla nowych modeli)

| Zasada               | Wartość                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Jednostki            | metry, glTF Y-up                                                                                   |
| Postacie i rekwizyty | patrzą w **+Z** (zgodnie z `Object3D.lookAt`), spód / stopy na `y = 0`, środek w `x = z = 0`       |
| Broń gracza          | celuje w **-Z** (kierunek kamery), początek układu w punkcie chwytu                                |
| Ręce gracza (FPP)    | początek = nadgarstek, palce w spoczynku w **-Z**, wnętrze dłoni w **+Y**, przedramię w **+Z**     |
| Strona prawa postaci | **-X** (postać patrzy w +Z)                                                                        |
| Cieniowanie          | płaskie (flat), low-poly, bez tekstur                                                              |
| Budżet               | humanoid ≤ 6000 trójkątów (ciało ≈ 4000), dron ≤ 1500, rekwizyt ≤ 500, broń ≤ 400, ręka FPP ≤ 3000 |

### Materiały (rozpoznawane po nazwie — shader stylu może je podmienić)

| Materiał            | Kolor                     | Użycie                                                            |
| ------------------- | ------------------------- | ----------------------------------------------------------------- |
| `mat_world`         | biel `#ebebeb`            | otoczenie, ściany, osłony                                         |
| `mat_interactive`   | czerń `#080808`           | obiekty interaktywne (skrzynie do chwytu Rezonansem), broń gracza |
| `mat_enemy`         | czerwień `#e0262b`        | wrogowie                                                          |
| `mat_enemy_glow`    | jasna czerwień, emisja    | wizjery, końcówki broni wroga, pociski wroga                      |
| `mat_player_cyan`   | cyan `#00e5ff`, emisja    | ostrze, otwory chłodzenia blastera, akcenty gracza                |
| `mat_power_magenta` | magenta `#ff2bd6`, emisja | efekty mocy, emiter Rezonansu na dłoni                            |

## Wrogowie — manekin CC0 ze szkieletem

Pięć humanoidów powstaje przez `build_enemy_cc0(archetype)` z manekina
**Quaternius Universal Animation Library, Standard**:
[źródło](https://opengameart.org/content/universal-animation-library),
[licencja CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Oryginał: `tools/blender/sources/ual/AnimationLibrary_Godot_Standard.glb`,
licencja autora: `tools/blender/sources/ual/License.txt`. Skrypt używa wyłącznie
importera glTF Blendera. Wyposażenie jest własne, proceduralne.

Ciało `armored_body` ma 3999 trójkątów po Decimate (źródło: 13 743),
z zachowanymi grupami wag i skinem do armatury `Rig` (53 kości). Eksporter
normalizuje cztery największe wagi każdego wierzchołka. Siatki mają płaskie
normalne, płyty i broń fazowane krawędzie. Materiały: `mat_enemy` oraz
`mat_enemy_glow`. Wysokość ciała w pozycji wiązania to 1,84 m; Egzekutor
ma 2,208 m (1,2×). Dodatkowa skala `boss.modelScale` nadal działa w widoku.
Stopy w pozycji wiązania leżą na y=0, przód to +Z glTF, prawa strona to -X.

```text
enemy_<typ>
└─ Rig
   ├─ armored_body (skin)
   └─ root → DEF-hips → kości tułowia i kończyn
      ├─ DEF-head → helmet / hood, visor
      ├─ DEF-hand.R → hand_R → baton / rifle / blade_hilt
      └─ DEF-spine.003 → shield (Tarczownik)
```

Sztywne wyposażenie jest dzieckiem odpowiedniej kości (bone parent), więc
podąża za klipami. Tarcza Tarczownika jest przypięta do `DEF-spine.003`,
pionowa w `Idle_Loop`, obrócona o 12° na zewnątrz i odsunięta przed rękę.
Jej górna krawędź leży poniżej wizjera, dolna przy kolanach. Panele płaszcza podążają za udami. Chwyt karabinu jest
kalibrowany w `Pistol_Aim_Neutral`, a chwyt pałki/ostrza w `Sword_Idle`.
Podglądy pokazują `Idle_Loop` albo `Pistol_Idle_Loop` w klatce 0.
Każdy GLB zawiera siedem klipów: `Walk_Loop`, `Jog_Fwd_Loop`, `Hit_Chest`,
`Hit_Head` oraz trzy klipy archetypu:

| Archetyp               | Klipy dodatkowe                                          |
| ---------------------- | -------------------------------------------------------- |
| Szturmowiec, Egzekutor | `Idle_Loop`, `Sword_Idle`, `Sword_Attack`                |
| Strzelec, Snajper      | `Pistol_Idle_Loop`, `Pistol_Aim_Neutral`, `Pistol_Shoot` |
| Tarczownik             | `Idle_Loop`, `Punch_Enter`, `Punch_Cross`                |

`EnemyView` klonuje szkielet przez `SkeletonUtils.clone`, współdzieli geometrię,
klipy i materiały, a stan AI mapuje na klipy `AnimationMixer` z przenikaniem.
Śmierć nadal uruchamia niezależny od części modelu rozpad `enemyShatter`;
`Death01` nie jest eksportowany. Dron zachowuje dotychczasową budowę i animację.

## Katalog

| Plik                                   | Co to                                                                                                                                     | Węzły dla kodu                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `enemy_trooper.glb`                    | Szturmowiec (4651 tri): ludzka sylwetka, hełm z wizjerem, fazowane naramienniki, kamizelka z ładownicami, pałka                           | `hand_R`, `baton`, `baton_tip`, `baton_hit`, `visor`                                                                             |
| `enemy_gunner.glb`                     | Strzelec (4787 tri): hełm z goglami, kamizelka z trzema ładownicami, karabin                                                              | `hand_R`, `rifle`, `muzzle`, `visor`                                                                                             |
| `enemy_sniper.glb`                     | Snajper (5092 tri): otwarty kaptur, panele płaszcza, długi karabin ze świecącą lunetą                                                     | `hand_R`, `rifle`, `muzzle`, `visor`, `eye` (soczewka lunety)                                                                    |
| `enemy_shielder.glb`                   | Tarczownik (4827 tri): ciężkie płyty, pałka i pionowa tarcza przed lewą połową tułowia                                                    | `hand_R`, `shield` (widoczność wg `shieldUp`), `baton`, `baton_tip`, `baton_hit`, `visor`                                        |
| `enemy_executor.glb`                   | Egzekutor (4871 tri): manekin 1,2×, egzoszkielet na tułowiu i kończynach, świecący rdzeń                                                  | `hand_R`, `blade_hilt`, `chest_core`, `visor`; kod dodaje `executor_blade` wg `bladeSizeM`                                       |
| `enemy_drone.glb`                      | Dron (≈860 tri): kadłub z kopułą czujnika, cztery ramiona z osłonami, lufa pod okiem; początek układu w środku kadłuba, oko z przodu (+Z) | `eye` (pulsuje przy celowaniu), `rotor_LF/RF/LB/RB` (pivot w środku, obrót wokół Y), `muzzle`                                    |
| `enemy_projectile.glb`                 | wolny, dobrze widoczny pocisk wroga, wydłużony wzdłuż Z                                                                                   | — (do `InstancedMesh`)                                                                                                           |
| `plasma_blade.glb`                     | ostrze plazmowe                                                                                                                           | `hilt`, `emitter_ring`, `blade` (pivot u emitera — skaluj po Z do wysuwania), `blade_core`, `blade_tip`                          |
| `blaster.glb`                          | blaster z przegrzaniem                                                                                                                    | `frame`, `heat_vents` i `heat_cell` (kolor/emisja = poziom ciepła), `muzzle`                                                     |
| `player_arm_R.glb`, `player_arm_L.glb` | gładka rękawica taktyczna z rękawem FPP (10 012 tri na rękę)                                                                              | `forearm`, `wrist`, `palm`, 15 przegubów palców, `palm_center`, `resonance_core`, `socket_blade`, `socket_gun`, `socket_support` |
| `crate.glb`, `crate_small.glb`         | skrzynie 1 m i 0,5 m (interaktywne: chwyt i rzut)                                                                                         | —                                                                                                                                |
| `pillar.glb`                           | filar 4 m                                                                                                                                 | —                                                                                                                                |
| `wall_segment.glb`                     | ściana 4 × 3 m, grubość 0,4 m                                                                                                             | —                                                                                                                                |
| `cover_low.glb`                        | niska osłona 2 × 1 m                                                                                                                      | —                                                                                                                                |

Model wroga wybiera pole `model` w `src/data/enemies/<id>.json` (nazwa pliku bez `.glb`). Brak pola: Strzelec i Snajper używają `enemy_gunner`, pozostałe humanoidy `enemy_trooper`; przy błędzie ładowania zostają bryły zastępcze (`EnemyView`, `DroneView`). Test `tests/unit/enemyModels.test.ts` pilnuje, że plik istnieje. Humanoidy używają skinningu i klipów; test `enemySkeleton.test.ts` sprawdza skin, budżet, komplet klipów i węzłów, kierunek lufy oraz niezależność 30 klonów.

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

Ręce FPP są wyjątkiem od ogólnego budżetu i płaskiego cieniowania: każda ma
**10 012 trójkątów** (budżet 6–12 tys.), smooth shading i skin glTF. `tactical_glove`
to jedna zamknięta, połączona siatka rękawicy, przedramienia i rękawa kurtki.
Subdivision Surface (Catmull–Clark, jeden poziom) jest zastosowany przed eksportem.
Przedramię z rękawem ma ok. 0,34 m, dłoń od nadgarstka do środkowego palca ok. 0,19 m.

Owalne palce mają proporcjonalne paliczki, zaokrąglone opuszki i wspólne błony
międzypalcowe. Poduszki dłoni, łagodna nasada kciuka, kostki i delikatne ścięgna
są częścią powierzchni rękawicy. Nie ma osobnych klocków paliczków ani przegubów.
Rękaw kurtki ma subtelne nierówności materiału i czarny mankiet, bez bieli.

Rękawica i rękaw używają matowego `mat_interactive` (roughness 0,85).
Cienka linia `dorsal_trace` i lamówka `wrist_light` mają `mat_player_cyan`.
Owalny, gładki `resonance_core` z `mat_power_magenta` jest osadzony w niskim
czarnym `resonance_mount`. Dekoracje są małymi osobnymi siatkami, cała rękawica
pozostaje jednym skinowanym obiektem. Materiały należą do `PALETTE`, bez tekstur.

### Szkielet i skinning

```text
player_arm_R / player_arm_L
└─ hand_skeleton_R / hand_skeleton_L (armatura)
   ├─ tactical_glove               (skin → 18 kości)
   └─ forearm                     (kość)
      ├─ wrist_light
      └─ wrist                    (kość, pivot w nadgarstku)
         └─ palm                  (kość, pivot w nadgarstku)
            ├─ index_1  → index_2  → index_3
            ├─ middle_1 → middle_2 → middle_3
            ├─ ring_1   → ring_2   → ring_3
            ├─ pinky_1  → pinky_2  → pinky_3
            ├─ thumb_1  → thumb_2  → thumb_3
            ├─ dorsal_trace, resonance_mount, resonance_core
            ├─ palm_center
            ├─ socket_blade
            ├─ socket_gun
            └─ socket_support
```

Nazwy kości są dokładnie dawnymi nazwami przegubów. Automatic weights inicjuje
grupy kości, następnie generator przypisuje poprawione wagi na pętlach: izoluje
sąsiednie palce, miesza po dwie kości wokół stawów i stabilizuje rękaw.
Subdivision interpoluje wagi i jest stosowany przed modyfikatorem armatury.
Deformacja jest liniowa, bez zależności od blenderowego Preserve Volume,
bez klipów animacji i bez niezastosowanego Subdivision w GLB.

**Wymaganie integracyjne skina:** Three.js odczytuje `tactical_glove` jako
`SkinnedMesh`. Instancję trzeba klonować z przepisaniem referencji kości
(np. `SkeletonUtils.clone`). Obecne `model.clone(true)` w `src/render/handRig.ts`
klonuje węzły, ale zachowuje oryginalny `Skeleton` i jego kości: obroty sklonowanych
przegubów nie deformują siatki instancji. To odrębna konieczna poprawka renderera.
Test `handRig.test.ts` sprawdza hierarchię i gniazda, lecz nie powiązanie kości skina.
Kontrakt nazw, póz i macierzy gniazd pozostaje zgodny.

### Osie i gniazda

GLB eksportuje **spoczynek**; `relaxed` jest stosowany do podglądu z danych.
Root i nadgarstek są w początku, przedramię biegnie w +Z, palce w -Z,
wnętrze dłoni jest po +Y. Kciuk R wyrasta po +X, kciuk L po -X.
Lokalna oś **X kości palców jest zawiasem**, dodatni kąt zgina do wnętrza dłoni.
Kości mają lokalną oś Y wzdłuż paliczka, Z ku wnętrzu dłoni. Ich spoczynkowe
macierze obejmują tę orientację; lokalne osie kości nie są osiami roota.
`thumb_1` obejmuje nasadę śródręcza w ukośnym układzie opozycji, `thumb_2/3`
dalsze człony. Oś -Z `palm_center` wskazuje +Y roota w spoczynku.

Gniazda i `palm_center` są pustymi dziećmi kości `palm`; `resonance_core` jest
siatką również pod `palm`. Nie mają odbicia ani skali, wyznaczniki wynoszą +1.
Pozycje poniżej są **względem roota R**, nie lokalnego układu kości:

| Gniazdo          | Pozycja [x, y, z], m         | Użycie                                                                               |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| `socket_blade`   | [0, 0.0422, -0.08544]        | `gripBlade`; rękojeść poprzecznie, emiter po stronie wskazującego                    |
| `socket_gun`     | [0.06158, 0.04108, -0.11575] | `gripGun` / `gripGunFire`; pochylenie chwytu o 0,05 rad zostawia miejsce przy kolbie |
| `socket_support` | [0.00420, 0.03100, -0.10321] | `support`; skręt 55° względem spoczynku dłoni                                        |

Dołącz przedmiot z jednostkową transformacją w gnieździe. Dla podparcia dopasuj
światową macierz `socket_support` do `support` broni:
`M_hand = M_weapon_support * inverse(M_hand_socket_relative)`.
`socket_gun` ma obrót `Rz(-π/2) * Rx(-0.05)` w układzie roota R.
`socket_blade` zachowuje poprzednią orientację osi przedmiotu.

Geometria L jest odbiciem względem YZ, z poprawnymi normalnymi. Spoczynkowe
układy kości i gniazd: `M_L = S * M_R * S`, `S = diag(-1, 1, 1, 1)`.
W eksporcie wszystkie skale są dodatnie i jednostkowe, także na kościach i gniazdach.
`S * Rx(a) * S = Rx(a)`: identyczne dodatnie kąty X dają lustrzane zgięcie.
Pozy używają tylko X; przyszłe kąty Y/Z wymagają uwzględnienia odbicia.

### Pozy — jedno źródło danych

`src/data/hands/handPoses.json` jest wspólnym źródłem gry i podglądów.
Format nie zmienia się:

```json
{
  "poses": {
    "relaxed": {
      "index_1": [0.18, 0, 0]
    }
  }
}
```

Plik zawiera siedem pełnych póz po 15 przegubów palców: `relaxed`, `open`, `fist`,
`gripBlade`, `gripGun`, `gripGunFire`, `support`. `relaxed` ma stopniowo mocniej
ugięte dalsze palce i kciuk przy wskazującym. `open` otwiera dłoń do mocy bez
przeprostów, `fist` zawija opuszki ku dłoni, chwyty dopasowano do przedmiotów.
`gripGunFire` zmienia wskazujący, pozostałe palce zachowują stabilny chwyt.

Wartości to **radiany Euler XYZ w lokalnych osiach kości glTF**, jak w Three.js
(`Rx * Ry * Rz`). Pominięte węzły wracają do spoczynku. Należy liczyć od
zapamiętanej orientacji, bez kumulowania: `q_pose = q_rest * q_EulerXYZ`.
Generator podglądów ustawia tę samą rotację w lokalnym układzie kości armatury.
Macierze gniazd należy składać względem roota, również przez kości szkieletu.

### Budowanie i kontrola wizualna

```bash
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- --only player_arm_R,player_arm_L
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- --only hand_previews
npx vitest run tests/unit/handRig.test.ts
```

`hand_previews` odtwarza wszystkie PNG `hand_*` i `player_arm_*`, bez eksportowania
GLB i bez przebudowy plików modeli broni. Workbench używa gładkich normalnych,
oświetlenia studyjnego i cavity, aby pokazać przekroje i zgięcia:

- `player_arm_R.png`, `player_arm_L.png`: `relaxed`, całe przedramię i czarny mankiet;
- `hand_relaxed_detail.png`: grzbiet, nasada kciuka i naturalny łuk palców;
- `hand_pose_open.png`, `hand_pose_fist.png`: obie dłonie, wspólne kąty;
- `hand_fist_inner.png`: zbliżenie obu pięści od strony opuszek;
- `hand_grip_blade.png`, `hand_grip_pistol.png`, `hand_grip_blaster.png`,
  `hand_grip_pistol_fire.png`, `hand_grip_rifle.png`: chwyty przedmiotów;
- `hand_grip_blade_inner.png`, `hand_grip_pistol_inner.png`, `hand_support_rifle.png`:
  styki z rękojeścią, chwytem i łożem;
- `hand_fpp_view.png`: kamera gracza w początku, -Z, pionowe FOV 70°, 16:9;
  prawy nadgarstek przy [0.22, -0.24, -0.45] m, ręka w prawym dolnym rogu.

Kontrola ręczna: opuszki obejmują chwyt, kciuk przeciwstawia się palcom, zgięcia
są gładkie i nie zapadają się, obie dłonie zginają się lustrzanie. Sprawdź nasadę
kciuka, lamówkę i proporcje FPP. Podgląd ostrza kadruje rękojeść i dłoń,
koniec pełnego ostrza jest poza kadrem. Sprawdzono też przecięcia powierzchni
rękawicy z ostrzem, pistoletem, blasterem i karabinem (`gripGun`, `gripGunFire`)
oraz z karabinem dla lewej ręki `support`: brak przecięć.
