# Assety 3D — konwencje i katalog

Modele są generowane proceduralnie skryptem `tools/blender/build_assets.py` (Blender 5.2, tryb wsadowy). Nie edytuj `.glb` ręcznie: zmień skrypt i zbuduj ponownie.

```bash
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py            # wszystko
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- --only crate,blaster --no-preview
```

Wynik: `public/assets/models/<nazwa>.glb` oraz podglądy `tools/blender/previews/<nazwa>.png` (Workbench — sprawdź je po każdej zmianie).

## Konwencje (obowiązkowe dla nowych modeli)

| Zasada               | Wartość                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Jednostki            | metry, glTF Y-up                                                                             |
| Postacie i rekwizyty | patrzą w **+Z** (zgodnie z `Object3D.lookAt`), spód / stopy na `y = 0`, środek w `x = z = 0` |
| Broń gracza          | celuje w **-Z** (kierunek kamery), początek układu w punkcie chwytu                          |
| Ręce gracza (FPP)    | początek = węzeł `grip` (punkt chwytu broni), przedramię biegnie do kamery (+Z)              |
| Strona prawa postaci | **-X** (postać patrzy w +Z)                                                                  |
| Cieniowanie          | płaskie (flat), low-poly, bez tekstur                                                        |
| Budżet               | wróg ≤ 1500 trójkątów, rekwizyt ≤ 500, broń ≤ 400                                            |

### Materiały (rozpoznawane po nazwie — shader stylu może je podmienić)

| Materiał            | Kolor                     | Użycie                                                            |
| ------------------- | ------------------------- | ----------------------------------------------------------------- |
| `mat_world`         | biel `#ebebeb`            | otoczenie, ściany, osłony                                         |
| `mat_interactive`   | czerń `#080808`           | obiekty interaktywne (skrzynie do chwytu Rezonansem), broń gracza |
| `mat_enemy`         | czerwień `#e0262b`        | wrogowie                                                          |
| `mat_enemy_glow`    | jasna czerwień, emisja    | wizjery, końcówki broni wroga, pociski wroga                      |
| `mat_player_cyan`   | cyan `#00e5ff`, emisja    | ostrze, otwory chłodzenia blastera, akcenty gracza                |
| `mat_power_magenta` | magenta `#ff2bd6`, emisja | efekty mocy (zarezerwowany)                                       |

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
| `player_arm_R.glb`, `player_arm_L.glb` | przedramię + dłoń gracza do FPP                                                                                                                                                     | `grip` (tu podpinasz broń), `hand`, `forearm`, `cuff`                                                                                                                             |
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
