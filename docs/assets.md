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

## Miasto

Zestaw „Neon Noir”: własne proceduralne bryły low-poly, płaskie normalne,
fazowane krawędzie głównych obudów, bogate detale geometryczne (śruby, szwy,
uchwyty, kratki, obejmy) i zróżnicowane materiały. GLB nie zawierają obrazów
(`material.map` jest puste); nadruki mają jednak siatkę UV, a gra nakłada
tekstury powierzchni i nadruków wyłącznie po nazwie materiału (patrz niżej
i `docs/systems/render.md`).
Pliki poniżej znajdują się w `public/assets/models/city/`, a podglądy Workbench
w `tools/blender/previews/city/`. Budżet **1500 trójkątów** dla rekwizytu
z kolizją i **800 trójkątów** dla dekoracji dotyczy całego modelu.

Wymiary w tabeli to rzeczywisty bounding box GLB, **X × Y × Z w metrach**,
zaokrąglony do 0,001 m. Docelowe bloki kolizji: dumpster 2 × 1,3 × 1,1;
vending 1 × 2 × 0,8; barrier 2 × 0,9 × 0,5; car 4,4 × 1,4 × 2;
stall 3 × 2,6 × 2; crates 1,2 × 1,6 × 1,2; generator 1,6 × 1,4 × 1;
kiosk 0,8 × 2,2 × 0,6.
Drobne uchwyty, fazy i listwy mieszczą się w tolerancji 5% tych wymiarów.
Samochód stoi wzdłuż osi X (długość 4,4 m bloku), przód w +X (światła
`headlight`, belka `light_bar`, tablica `front_plate`), tył w −X
(`tail_light`, `rear_plate`), bok do gracza w +Z.

Montaż: **blok** = pole `model` bloku układu, collider tworzy gra z wymiarów
bloku; **ściana** = `decor`, tył z = 0, bryła wystaje w +Z, spód y = 0;
**podłoże** = `decor`, spód y = 0, środek bounding boxu w x = z = 0;
**rozpięcie** = `decor`, początek na górze, najwyższy punkt y = 0,
końce x = ±5 m, zwis w -Y (około 1 m). Bloki również mają spód y = 0
i środek x = z = 0, przód +Z (wyjątek: samochód, przód +X). Modele nie zawierają siatek colliderów.
Gra nadaje dekoracjom wysokość i obrót; skala X rozpięcia = długość / 10.
Obecny kontrakt `decor.scale` jest skalarem — nie opisuje osobnej skali X;
obsługa rozpiętości po stronie renderu pozostaje zadaniem integracji.

| Plik                      | Wymiary X × Y × Z [m]  | Kolizja | Montaż    | Węzły                                                                                                                                                                                                               | Trójkąty |
| ------------------------- | ---------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------: |
| `city_dumpster.glb`       | 1,970 × 1,330 × 1,080  | tak     | blok      | `bin`, `rust_skirt`, `top_rim`, `lid`, `lid_open`, `wheel`, `caster_fork`, `fork_pocket`, `handle`, `hinge`, `bag_peek`, `stencil`, `sticker`                                                                       |      684 |
| `city_vending.glb`        | 1,005 × 2,000 × 0,802  | tak     | blok      | `cabinet`, `header`, `display`, `status_screen`, `screen_frame`, `pickup`, `pickup_flap`, `selection`, `control_panel`, `key`, `coin_slot`, `card_reader`, `sticker`, `warning`                                     |      484 |
| `city_barrier.glb`        | 2,000 × 0,929 × 0,510  | tak     | blok      | `concrete_body`, `stripe`, `reflector`, `lifting_loop`, `foot_recess`                                                                                                                                               |      172 |
| `city_car.glb`            | 4,420 × 1,401 × 1,940  | tak     | blok      | `body`, `body_crease`, `canopy`, `roof`, `spoiler`, `wheel`, `rim`, `hub`, `headlight`, `light_bar`, `front_plate`, `front_intake`, `tail_light`, `rear_plate`, `underglow`, `mirror`, `door_handle`, `charge_port` |     1212 |
| `city_stall.glb`          | 3,000 × 2,600 × 2,025  | tak     | blok      | `counter`, `counter_base`, `canopy`, `valance`, `noren`, `bulb_string`, `bulb`, `menu`, `menu_frame`, `cooking_pot`, `bowl_stack`, `sticker`                                                                        |      908 |
| `city_crates.glb`         | 1,212 × 1,590 × 1,212  | tak     | blok      | `crate_shell`, `rim`, `front_rib`, `side_rib`, `handle_recess`, `pallet_board`, `pallet_block`, `stencil`, `sticker`, `warning`                                                                                     |      690 |
| `city_generator.glb`      | 1,600 × 1,406 × 1,005  | tak     | blok      | `housing`, `top_cover`, `louvre`, `control_panel`, `status`, `socket`, `power_cable`, `exhaust`, `skid`, `lifting_eye`, `stencil`, `warning`                                                                        |      582 |
| `city_kiosk.glb`          | 0,800 × 2,200 × 0,620  | tak     | blok      | `plinth`, `body`, `header`, `header_glow`, `news`, `map`, `map_frame`, `shelf`, `key`, `card_reader`, `ad`, `ad_frame`, `sticker`, `warning`                                                                        |      386 |
| `city_ac_unit.glb`        | 0,902 × 0,604 × 0,518  | nie     | ściana    | `housing`, `fan_hub`, `fan_blade`, `fan_guard`, `side_louvre`, `wall_bracket`, `support`, `drain_hose`, `sticker`                                                                                                   |      514 |
| `city_pipe_run.glb`       | 0,780 × 6,060 × 0,374  | nie     | ściana    | `pipe`, `pipe_clamp`, `wall_plate`, `flange`, `valve_wheel`, `gauge`, `bottom_mount`                                                                                                                                |      728 |
| `city_fire_escape.glb`    | 3,000 × 3,527 × 1,167  | nie     | ściana    | `balcony`, `deck_slot`, `top_rail`, `middle_rail`, `front_baluster`, `ladder_rail`, `rung`, `ladder_hook`, `bracket`, `kick_plate`                                                                                  |      624 |
| `city_shutter.glb`        | 3,000 × 3,000 × 0,250  | nie     | ściana    | `slat`, `guide`, `roller_box`, `bottom_rail`, `pull_handle`, `padlock`, `backing`, `stencil`, `warning`                                                                                                             |      476 |
| `city_awning.glb`         | 2,500 × 0,570 × 1,160  | nie     | ściana    | `canopy`, `valance`, `brace`, `roof_seam`, `led_strip`, `wall_flashing`                                                                                                                                             |      124 |
| `city_door.glb`           | 1,505 × 2,465 × 0,238  | nie     | ściana    | `frame`, `door_leaf`, `inset_panel`, `window`, `wire_mesh`, `handle`, `keypad`, `key`, `status_dot`, `door_number`, `lamp`, `lintel`, `kick_plate`, `door_closer`                                                   |      602 |
| `city_sign_box.glb`       | 2,000 × 1,000 × 0,250  | nie     | ściana    | `housing`, `sign_face`, `bolt`                                                                                                                                                                                      |      136 |
| `city_ad_screen.glb`      | 1,100 × 2,294 × 0,181  | nie     | ściana    | `housing`, `bezel`, `screen`, `wall_arm`, `led_edge`, `conduit`, `sticker`                                                                                                                                          |      140 |
| `city_street_lamp.glb`    | 0,440 × 4,500 × 1,280  | nie     | podłoże   | `base`, `pole`, `band`, `arm`, `head`, `lamp`, `service_box`, `warning`                                                                                                                                             |      290 |
| `city_vent_grate.glb`     | 1,000 × 0,050 × 1,000  | nie     | podłoże   | `recess`, `frame`, `grate_bar`, `crossbar`                                                                                                                                                                          |      168 |
| `city_trash_bags.glb`     | 1,076 × 0,640 × 0,867  | nie     | podłoże   | `bag`, `tie`                                                                                                                                                                                                        |      108 |
| `city_traffic_cone.glb`   | 0,460 × 0,700 × 0,460  | nie     | podłoże   | `base`, `cone`, `reflector_band`                                                                                                                                                                                    |      152 |
| `city_holo_projector.glb` | 0,600 × 0,200 × 0,600  | nie     | podłoże   | `disc_base`, `clamp`, `emitter_ring`, `emitter`                                                                                                                                                                     |      204 |
| `city_antenna.glb`        | 1,560 × 2,250 × 1,270  | nie     | podłoże   | `mast`, `frame`, `foot`, `aerial`, `dish`, `dish_mount`, `receiver`, `coax`, `beacon`                                                                                                                               |      460 |
| `city_cable_span.glb`     | 10,000 × 1,104 × 0,429 | nie     | rozpięcie | `cable`, `insulator`, `junction_box`, `junction_hanger`                                                                                                                                                             |      444 |
| `city_lantern_string.glb` | 10,000 × 1,189 × 0,300 | nie     | rozpięcie | `wire`, `hanger`, `lantern`, `lantern_cap`                                                                                                                                                                          |      724 |

Każdy model ma pusty korzeń o nazwie modelu. Powtarzane części mają nazwy
Blendera z sufiksem `.001`, `.002` itd. (w tabeli podano nazwy bazowe);
loader może usuwać kropkę. Balkon jest na wysokości 2,5 m nad końcem drabiny.
`sign_face` jest ciemną, płaską powierzchnią przednią na z = 0,25 m; napis
nakłada gra. Pomocnicze generatory w `build_assets.py`: `_city_box(taper=, spin=)`,
`_city_rod`, `_city_tube(closed=)`, `_city_ring` (zamknięty pierścień wokół osi),
`_city_print` (czworokąt z UV pod nadruk).

Materiały rozpoznawane wyłącznie po nazwie (kolor to tylko podgląd Workbench,
sRGB z `_city_root` w `tools/blender/build_assets.py`; wygląd w grze wynika
z `urbanLooks`, patrz `docs/systems/render.md`):

| Nazwa             | Podgląd sRGB | Emisja                                          |
| ----------------- | ------------ | ----------------------------------------------- |
| `mat_concrete`    | `#424d61`    | nie                                             |
| `mat_asphalt`     | `#2a3344`    | nie                                             |
| `mat_metal`       | `#56627a`    | nie                                             |
| `mat_trim`        | `#313b50`    | nie                                             |
| `mat_glass`       | `#202c44`    | nie                                             |
| `mat_cable`       | `#181f30`    | nie                                             |
| `mat_paint`       | `#3e5a48`    | nie                                             |
| `mat_lacquer`     | `#2c3766`    | nie                                             |
| `mat_rust`        | `#5a4a3e`    | nie                                             |
| `mat_corrugated`  | `#5d6879`    | nie                                             |
| `mat_plastic`     | `#4a5d7a`    | nie                                             |
| `mat_hivis`       | `#d08a1c`    | nie                                             |
| `mat_rubber`      | `#1d2027`    | nie                                             |
| `mat_wood`        | `#5a5047`    | nie                                             |
| `mat_fabric`      | `#5a4c86`    | nie                                             |
| `mat_machine`     | `#5f6a80`    | nie                                             |
| `mat_paving`      | `#59637a`    | nie                                             |
| `mat_plaster`     | `#56606e`    | nie                                             |
| `mat_hazard`      | `#e09a1a`    | nie (pasy bursztynowo-czarne rysuje shader gry) |
| `mat_neon_amber`  | `#ffae1a`    | tak                                             |
| `mat_neon_green`  | `#6dff4a`    | tak                                             |
| `mat_neon_violet` | `#8a5cff`    | tak                                             |
| `mat_neon_blue`   | `#3d7bff`    | tak                                             |
| `mat_neon_white`  | `#fff1d6`    | tak                                             |
| `mat_light_white` | `#fff1d6`    | tak                                             |

Nadruki mapowane UV (poza tabelą, bo nazwa niesie identyfikator obrazu):
`mat_label_<x>` to naklejka z `public/assets/textures/labels/label_<x>.webp`
(RGBA, odcięcie alfy 0,5, oświetlana), `mat_screen_<x>` to ekran z
`public/assets/textures/screens/screen_<x>.webp` (świeci, bloom). Nazwa pliku to
nazwa materiału bez `mat_`. Używane: `label_warning`, `label_stencil` („07”),
`label_barcode`, `label_plate` („NR 0471”), `screen_vending`, `screen_menu`,
`screen_status`, `screen_ad`, `screen_news`, `screen_map`. Nadruk to czworokąt z jedną siatką UV (`_city_print`): obraz
leży prosto, gdy lewy dolny róg czworokąta ma UV (0, 0) w Blenderze, a prawy
górny (1, 1); eksporter glTF odwraca V do konwencji obrazu. Do załadowania
tekstury nadruk jest niewidoczny; w motywie `white` (`citySurfaceDetail` 0)
naklejka jest biała, a ekran ciemny.

Szare skrzynki `city_crates` są dekoracyjną przeszkodą, nie obiektami Chwytu.
Tylne lampy samochodu i lampiony są bursztynowe. Kolory zarezerwowane dla
wrogów, gracza i Rezonansu nie występują w materiałach miasta. Workbench
pokazuje barwę materiału, nie poświatę emisji; poświatę zapewnia renderer gry.

````bash
```bash
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- --only city_dumpster,city_vending,city_barrier,city_car,city_stall,city_crates,city_generator,city_ac_unit,city_pipe_run,city_fire_escape,city_shutter,city_awning,city_door,city_sign_box,city_street_lamp,city_vent_grate,city_trash_bags,city_traffic_cone,city_holo_projector,city_antenna,city_cable_span,city_lantern_string,city_ad_screen,city_kiosk
node node_modules/vitest/vitest.mjs run tests/unit/cityModels.test.ts --configLoader runner
````

Test parsuje komplet GLB i sprawdza: obecność 24 plików, dozwolone materiały
(lista `mat_*` powyżej) i kolory emisji, dla nadruków `mat_label_*` /
`mat_screen_*` istnienie pliku tekstury w `public/assets/textures/` oraz atrybut
UV siatki, brak map (`material.map`), budżet trójkątów, obecność węzłów
charakterystycznych (automat: `header`, `display`, `pickup`), wymiary kolizji ±5%,
poziom podstawy, tył dekoracji ściennych, centrowanie rekwizytów, końce rozpięć
i osiem lampionów. Samochód: `headlight` ma x > 2, `tail_light` ma x < −2.
Kontrola podglądów: sylwetka, fazy, uchwyty, kratki, ekran i otwory automatu,
drabina, zwis kabli; front automatu i menu budki od +Z, bok samochodu od +Z.
Zbiorczy podgląd roboczy: `%TEMP%/neoryder-city-contact-sheet.png` (nie jest
częścią zasobów gry). Galeria w grze: `?scene=city-props-test` (opis w
`docs/systems/city.md`).

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
