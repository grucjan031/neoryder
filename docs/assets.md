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

| Plik                                   | Co to                                                                           | Węzły dla kodu                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `enemy_trooper.glb`                    | Szturmowiec: masywny, naramienniki, hełm z poziomym wizjerem, pałka elektryczna | `baton` (pivot w dłoni), `baton_tip` (świecąca końcówka), `baton_hit` (punkt trafienia)                 |
| `enemy_gunner.glb`                     | Strzelec: smuklejszy, hełm z osłoną karku, plecak, karabin                      | `rifle` (pivot w dłoni), `muzzle` (wylot pocisku)                                                       |
| `enemy_projectile.glb`                 | wolny, dobrze widoczny pocisk wroga, wydłużony wzdłuż Z                         | — (do `InstancedMesh`)                                                                                  |
| `plasma_blade.glb`                     | ostrze plazmowe                                                                 | `hilt`, `emitter_ring`, `blade` (pivot u emitera — skaluj po Z do wysuwania), `blade_core`, `blade_tip` |
| `blaster.glb`                          | blaster z przegrzaniem                                                          | `frame`, `heat_vents` i `heat_cell` (kolor/emisja = poziom ciepła), `muzzle`                            |
| `player_arm_R.glb`, `player_arm_L.glb` | przedramię + dłoń gracza do FPP                                                 | `grip` (tu podpinasz broń), `hand`, `forearm`, `cuff`                                                   |
| `crate.glb`, `crate_small.glb`         | skrzynie 1 m i 0,5 m (interaktywne: chwyt i rzut)                               | —                                                                                                       |
| `pillar.glb`                           | filar 4 m                                                                       | —                                                                                                       |
| `wall_segment.glb`                     | ściana 4 × 3 m, grubość 0,4 m                                                   | —                                                                                                       |
| `cover_low.glb`                        | niska osłona 2 × 1 m                                                            | —                                                                                                       |

Kolizje: wyprowadzaj z prostych brył w kodzie (prostopadłościany, kapsuły), nie z siatek modeli.

## Uwagi do F1

- Modele to placeholdery w docelowym stylu. Dopracowanie (więcej archetypów, warianty frakcji) w kolejnych fazach.
- Węzeł `blade` ma rozmiar 1 m przy skali 1; długość ostrza ustawiaj w `tuning.ts`, nie w modelu.
- Rozpad na odłamki (zadanie F1 #12) może ciąć części proceduralnie lub podmieniać je na gotowe fragmenty — decyzja w zadaniu.
