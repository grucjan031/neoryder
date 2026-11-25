# Assety 3D — konwencje i katalog

Modele są generowane proceduralnie skryptem `tools/blender/build_assets.py` (Blender 5.2, tryb wsadowy). Nie edytuj `.glb` ręcznie: zmień skrypt i zbuduj ponownie.

```bash
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py            # wszystko
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- --only crate,blaster --no-preview
```

Wynik: `public/assets/models/<nazwa>.glb` oraz podglądy `tools/blender/previews/<nazwa>.png` (Workbench — sprawdź je po każdej zmianie).

## Konwencje (obowiązkowe dla nowych modeli)

| Zasada               | Wartość                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Jednostki            | metry, glTF Y-up                                                                                                                     |
| Postacie i rekwizyty | patrzą w **+Z** (zgodnie z `Object3D.lookAt`), spód / stopy na `y = 0`, środek w `x = z = 0`                                         |
| Broń gracza          | celuje w **-Z** (kierunek kamery), początek układu w punkcie chwytu                                                                  |
| Ręce gracza (FPP)    | początek = nadgarstek, palce w spoczynku w **-Z**, wnętrze dłoni w **+Y**, przedramię w **+Z**                                       |
| Strona prawa postaci | **-X** (postać patrzy w +Z)                                                                                                          |
| Cieniowanie          | płaskie (flat), low-poly, bez tekstur                                                                                                |
| Budżet               | humanoid ≤ 6000 trójkątów (ciało ≈ 4000), dron ≤ 1500, rekwizyt ≤ 500, broń ≤ 1000 (szlif komiksowy 18.11: 488–940), ręka FPP ≤ 3000 |

### Materiały (rozpoznawane po nazwie — shader stylu może je podmienić)

| Materiał            | Kolor                             | Użycie                                                                 |
| ------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| `mat_world`         | biel `#ebebeb`                    | otoczenie, ściany, osłony                                              |
| `mat_interactive`   | czerń `#080808`                   | obiekty interaktywne (skrzynie do chwytu Rezonansem), broń gracza      |
| `mat_enemy`         | czerwień `#e0262b`                | wrogowie                                                               |
| `mat_enemy_glow`    | jasna czerwień, emisja            | wizjery, końcówki broni wroga, pociski wroga                           |
| `mat_enemy_dark`    | ciemna czerwień (16% `mat_enemy`) | kombinezon i ciemne części wrogów; poświata krawędzi w czerwieni wroga |
| `mat_player_cyan`   | cyan `#00e5ff`, emisja            | ostrze, otwory chłodzenia blastera, akcenty gracza                     |
| `mat_power_magenta` | magenta `#ff2bd6`, emisja         | efekty mocy, emiter Rezonansu na dłoni                                 |

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
| `city_dumpster.glb`       | 1,970 × 1,330 × 1,080  | tak     | blok      | `bin`, `rust_skirt`, `top_rim`, `lid`, `lid_open`, `wheel`, `caster_fork`, `fork_pocket`, `handle`, `hinge`, `bag_peek`, `stencil`, `sticker`                                                                       |      864 |
| `city_vending.glb`        | 1,014 × 2,000 × 0,816  | tak     | blok      | `cabinet`, `header`, `display`, `status_screen`, `screen_frame`, `pickup`, `pickup_flap`, `selection`, `control_panel`, `key`, `coin_slot`, `card_reader`, `sticker`, `warning`                                     |      640 |
| `city_barrier.glb`        | 2,000 × 0,929 × 0,510  | tak     | blok      | `concrete_body`, `stripe`, `reflector`, `lifting_loop`, `foot_recess`                                                                                                                                               |      172 |
| `city_car.glb`            | 4,420 × 1,460 × 1,940  | tak     | blok      | `body`, `body_crease`, `canopy`, `roof`, `spoiler`, `wheel`, `rim`, `hub`, `headlight`, `light_bar`, `front_plate`, `front_intake`, `tail_light`, `rear_plate`, `underglow`, `mirror`, `door_handle`, `charge_port` |     1500 |
| `city_stall.glb`          | 3,000 × 2,622 × 2,043  | tak     | blok      | `counter`, `counter_base`, `canopy`, `valance`, `noren`, `bulb_string`, `bulb`, `menu`, `menu_frame`, `cooking_pot`, `bowl_stack`, `sticker`                                                                        |     1192 |
| `city_crates.glb`         | 1,212 × 1,590 × 1,256  | tak     | blok      | `crate_shell`, `rim`, `front_rib`, `side_rib`, `handle_recess`, `pallet_board`, `pallet_block`, `stencil`, `sticker`, `warning`                                                                                     |      770 |
| `city_generator.glb`      | 1,600 × 1,400 × 1,005  | tak     | blok      | `housing`, `top_cover`, `louvre`, `control_panel`, `status`, `socket`, `power_cable`, `exhaust`, `skid`, `lifting_eye`, `stencil`, `warning`                                                                        |      782 |
| `city_kiosk.glb`          | 0,800 × 2,235 × 0,624  | tak     | blok      | `plinth`, `body`, `header`, `header_glow`, `news`, `map`, `map_frame`, `shelf`, `key`, `card_reader`, `ad`, `ad_frame`, `sticker`, `warning`                                                                        |      502 |
| `city_ac_unit.glb`        | 0,907 × 0,604 × 0,518  | nie     | ściana    | `housing`, `fan_hub`, `fan_blade`, `fan_guard`, `side_louvre`, `wall_bracket`, `support`, `drain_hose`, `sticker`                                                                                                   |      614 |
| `city_pipe_run.glb`       | 0,780 × 6,060 × 0,374  | nie     | ściana    | `pipe`, `pipe_clamp`, `wall_plate`, `flange`, `valve_wheel`, `gauge`, `bottom_mount`                                                                                                                                |      780 |
| `city_fire_escape.glb`    | 3,000 × 3,527 × 1,167  | nie     | ściana    | `balcony`, `deck_slot`, `top_rail`, `middle_rail`, `front_baluster`, `ladder_rail`, `rung`, `ladder_hook`, `bracket`, `kick_plate`                                                                                  |      624 |
| `city_shutter.glb`        | 3,000 × 3,000 × 0,251  | nie     | ściana    | `slat`, `guide`, `roller_box`, `bottom_rail`, `pull_handle`, `padlock`, `backing`, `stencil`, `warning`                                                                                                             |      688 |
| `city_awning.glb`         | 2,500 × 0,570 × 1,172  | nie     | ściana    | `canopy`, `valance`, `brace`, `roof_seam`, `led_strip`, `wall_flashing`                                                                                                                                             |      136 |
| `city_door.glb`           | 1,505 × 2,465 × 0,238  | nie     | ściana    | `frame`, `door_leaf`, `inset_panel`, `window`, `wire_mesh`, `handle`, `keypad`, `key`, `status_dot`, `door_number`, `lamp`, `lintel`, `kick_plate`, `door_closer`                                                   |      638 |
| `city_sign_box.glb`       | 2,000 × 1,000 × 0,250  | nie     | ściana    | `housing`, `sign_face`, `bolt`                                                                                                                                                                                      |      136 |
| `city_ad_screen.glb`      | 1,100 × 2,294 × 0,182  | nie     | ściana    | `housing`, `bezel`, `screen`, `wall_arm`, `led_edge`, `conduit`, `sticker`                                                                                                                                          |      176 |
| `city_street_lamp.glb`    | 0,440 × 4,500 × 1,280  | nie     | podłoże   | `base`, `pole`, `band`, `arm`, `head`, `lamp`, `service_box`, `warning`                                                                                                                                             |      490 |
| `city_vent_grate.glb`     | 1,000 × 0,050 × 1,000  | nie     | podłoże   | `recess`, `frame`, `grate_bar`, `crossbar`                                                                                                                                                                          |      168 |
| `city_trash_bags.glb`     | 1,113 × 0,644 × 0,922  | nie     | podłoże   | `bag`, `tie`                                                                                                                                                                                                        |      144 |
| `city_traffic_cone.glb`   | 0,460 × 0,700 × 0,460  | nie     | podłoże   | `base`, `cone`, `reflector_band`                                                                                                                                                                                    |      152 |
| `city_holo_projector.glb` | 0,600 × 0,200 × 0,600  | nie     | podłoże   | `disc_base`, `clamp`, `emitter_ring`, `emitter`                                                                                                                                                                     |      204 |
| `city_antenna.glb`        | 1,560 × 2,250 × 1,270  | nie     | podłoże   | `mast`, `frame`, `foot`, `aerial`, `dish`, `dish_mount`, `receiver`, `coax`, `beacon`                                                                                                                               |      636 |
| `city_cable_span.glb`     | 10,000 × 1,104 × 0,429 | nie     | rozpięcie | `cable`, `insulator`, `junction_box`, `junction_hanger`                                                                                                                                                             |      612 |
| `city_lantern_string.glb` | 10,000 × 1,189 × 0,300 | nie     | rozpięcie | `wire`, `hanger`, `lantern`, `lantern_cap`                                                                                                                                                                          |      724 |

Klimatyzator ma rozstawione łopatki, boczny panel z żebrami, okapnik i etykiety
serwisowe. Rury mają opaski identyfikacyjne i wskazówkę manometru. Antena ma
zamkniętą, wklęsłą czaszę, tylne wsporniki, obudowę odbiornika i tuleję
przewodu. Przewieszenie kabli ma przekładki oraz tuleje odciążające, a latarnia
usztywnienie ramienia, kołnierz podstawy, przewód i podział klosza.
Nowe statyczne detale są wbudowane w istniejące siatki według materiału
(`_city_merge_details`); nie dodają węzłów ani obiektów do renderowania.
Punkty montażu i pozycja klosza latarni pozostają bez zmian.

Szlif dużych brył: roleta ma warstwowe panele i bursztynową ramę, generator
obniżoną obudowę z osobnym modułem, kominem i osłonami, skrzynie stopniowaną
sylwetkę, a stragan profilowane metalowe zadaszenie z żebrami i listwami.
Śmietnik ma niższy korpus, uchyloną klapę, wystające worki i świetlny rant.
Detale scalono z istniejącymi siatkami; nazwy i liczba węzłów są zachowane.
Materiały emisyjne korzystają z istniejących `mat_neon_amber` i `mat_neon_green`;
nie dodano świateł punktowych. Wymiary mieszczą się w tolerancji 5%.
Szlif 2 (czytelność z 10 m): auto ma fioletową belkę na dachu, listwy krawędzi
dachu, świecące sześciokątne pierścienie i piasty felg, szerszy biały pas
przodu i bursztynowe pasy tyłu owinięte na narożniki oraz ciemny próg; automat
świecące krawędzie frontu i boków, podświetlone okno produktów i oświetloną
tackę (`pickup_flap` w `mat_neon_white`), tył z panelem, kratką i logo; kiosk
daszek nad nagłówkiem i świecące krawędzie słupka z czterech stron. Dekoracje:
listwa pomostu schodów (`kick_plate`) świeci fioletem, markiza ma bursztynową
krawędź frontu falbany, drzwi świecącą ościeżnicę i nadproże, ekran reklamowy
pełną ramę LED, pasy pachołka świecą ciepłą bielą, worki mają przewężenie pod
supłem i czwarty mały worek scalony z `bag_1`. Liczba siatek i nazwy węzłów
bez zmian; nowe akcenty są scalone z istniejącymi siatkami tego samego materiału
albo wynikają ze zmiany materiału istniejącej części.
Uwaga integracyjna: `RoomScene` zastępuje materiały modeli bloków materiałem
z pola `material` w JSON pokoju. W tych instancjach pozostaje zmiana sylwetki,
ale emisja i kontrast materiałów są widoczne tylko w galerii i dekoracjach.

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

## Magazyn Kurogane Arms (run1)

Zestaw własny projektu. Generator zapisuje GLB w `public/assets/models/city/` i trzy rzuty każdego modelu w `artifacts/models/wh/`. Wymiary pochodzą z pomiaru gotowych GLB w osiach glTF. Wszystkie modele mają spód na Y = 0. Terminal przylega tyłem do ściany, a pozostałe modele są wycentrowane w osiach X i Z.

```bash
"D:/Blender/blender.exe" -b --factory-startup --python-exit-code 1 --python tools/blender/sets/warehouse_kurogane.py
node tools/levels/mapModelBounds.mjs
```

| Model | AABB X × Y × Z [m] | Trójkąty | Montaż | Podglądy |
| --- | --- | ---: | --- | --- |
| `wh_pallet_rack` | 4 × 6 × 1,2 | 2464 | blok, dwa przęsła | [przód](../artifacts/models/wh/wh_pallet_rack-front.png) · [bok](../artifacts/models/wh/wh_pallet_rack-side.png) · [góra](../artifacts/models/wh/wh_pallet_rack-top.png) |
| `wh_forklift` | 2,8 × 2,1 × 1,2 | 1475 | blok, wózek czołowy z widłami w +X i przeciwwagą w −X | [przód](../artifacts/models/wh/wh_forklift-front.png) · [bok](../artifacts/models/wh/wh_forklift-side.png) · [góra](../artifacts/models/wh/wh_forklift-top.png) |
| `wh_overhead_crane` | 16 × 2,4 × 3,2 | 2022 | dekoracja oparta na szynach | [przód](../artifacts/models/wh/wh_overhead_crane-front.png) · [bok](../artifacts/models/wh/wh_overhead_crane-side.png) · [góra](../artifacts/models/wh/wh_overhead_crane-top.png) |
| `wh_server_rack` | 1,2 × 2,4 × 1 | 1134 | blok, serwis od +Z | [przód](../artifacts/models/wh/wh_server_rack-front.png) · [bok](../artifacts/models/wh/wh_server_rack-side.png) · [góra](../artifacts/models/wh/wh_server_rack-top.png) |
| `wh_workbench_weapons` | 2,4 × 1,5 × 0,9 | 1124 | blok, blat na 0,945 m | [przód](../artifacts/models/wh/wh_workbench_weapons-front.png) · [bok](../artifacts/models/wh/wh_workbench_weapons-side.png) · [góra](../artifacts/models/wh/wh_workbench_weapons-top.png) |
| `wh_weapon_case_stack` | 1,6 × 1,1 × 1,2 | 1184 | blok osłony na palecie | [przód](../artifacts/models/wh/wh_weapon_case_stack-front.png) · [bok](../artifacts/models/wh/wh_weapon_case_stack-side.png) · [góra](../artifacts/models/wh/wh_weapon_case_stack-top.png) |
| `wh_conveyor_scanner` | 3,6 × 2,2 × 1,4 | 1194 | blok, oś transportu X | [przód](../artifacts/models/wh/wh_conveyor_scanner-front.png) · [bok](../artifacts/models/wh/wh_conveyor_scanner-side.png) · [góra](../artifacts/models/wh/wh_conveyor_scanner-top.png) |
| `wh_ceiling_lamp` | 1,8 × 0,45 × 0,6 | 724 | dekoracja, uchwyty pod stropem | [przód](../artifacts/models/wh/wh_ceiling_lamp-front.png) · [bok](../artifacts/models/wh/wh_ceiling_lamp-side.png) · [góra](../artifacts/models/wh/wh_ceiling_lamp-top.png) |
| `wh_hall_column` | 1,4 × 10 × 0,83 | 628 | słup, konsola wysunięta w +X | [przód](../artifacts/models/wh/wh_hall_column-front.png) · [bok](../artifacts/models/wh/wh_hall_column-side.png) · [góra](../artifacts/models/wh/wh_hall_column-top.png) |
| `wh_crane_rail` | 0,44 × 0,64 × 6 | 960 | belka, kierunek jazdy Z | [przód](../artifacts/models/wh/wh_crane_rail-front.png) · [bok](../artifacts/models/wh/wh_crane_rail-side.png) · [góra](../artifacts/models/wh/wh_crane_rail-top.png) |
| `wh_wall_terminal` | 1,42 × 0,93 × 0,2105 | 497 | dekoracja, tył na Z = 0 | [przód](../artifacts/models/wh/wh_wall_terminal-front.png) · [bok](../artifacts/models/wh/wh_wall_terminal-side.png) · [góra](../artifacts/models/wh/wh_wall_terminal-top.png) |
| `wh_catwalk` | 4 × 1,2 × 1,5 | 976 | pomost dla gracza, długość w osi X | [przód](../artifacts/models/wh/wh_catwalk-front.png) · [bok](../artifacts/models/wh/wh_catwalk-side.png) · [góra](../artifacts/models/wh/wh_catwalk-top.png) |

**Powierzchnia grywalna.** Pokład `wh_catwalk` (siatka `deck`) kończy się na lokalnym Y = 0,20 m, poręcz na Y = 1,20 m. Dla posadzki pomostu na 3,60 m ustaw dekorację na Y = 3,40 m oraz niewidoczny blok `walkable: true` o rozmiarze 4 × 0,20 × 1,50 m i środku na Y = 3,50 m. Barierki wymagają własnych bocznych koliderów na mapie. Pozostałe modele pełnią funkcję wyposażenia, osłon lub konstrukcji. Regały ustawia się parami plecami do siebie, co daje głębokość 2,40 m. Trawersy mają górne krawędzie na 1,80, 3,80 i 5,80 m.

**Punkty montażu.** Góra konsoli słupa leży na Y = 8,20 m. Postawiona na niej belka ma główkę szyny na Y = 8,84 m. Osie kół suwnicy leżą na X = ±7,68 m, a styk koła z szyną wypada 0,34 m nad spodem haka. Przy tym zestawieniu początek suwnicy umieść na Y = 8,50 m. Zaczep ładunku leży pod wózkiem na osi X = Z = 0. Początek lampy umieść 0,45 m poniżej spodu widocznego stropu lub dźwigara.

## Przychodnia Helixy na Bulwarze (run2)

Siedem modeli własnych `bw_*` ma początek na środku podstawy, przód w +Z i wymiary w metrach. Generator zapisuje GLB w `public/assets/models/city/` i trzy podglądy każdego modelu w `tools/blender/previews/bulwar/<id>-{front,side,top}.png`.

```bash
"C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b --factory-startup --python-exit-code 1 -P tools/blender/sets/bulwar_clinic.py
node tools/levels/mapModelBounds.mjs
```

Opcje po `--` to `--only bw_treatment_screen,bw_sample_fridge` (wybór modeli) i `--no-preview` (sam eksport). Ladę, ławę, panel boksu, leżankę i chłodnię montuj jako pełne bryły według pomiarów w `src/data/render/mapModelBounds.json`. Panel blokuje ruch i strzały na całe 1,55 m, choć powyżej cokołu na 0,85 m widać przez szybę. Skaner i portal windy montuj jako dekoracje z osobnymi koliderami obu słupów i nadproża. Zachowaj otwór 3 × 3 m w skanerze i 4 × 3 m w windzie. Drzwi wyjściowe są osobnym blokiem. Znak rejestracji korzysta z tekstury `holo_helixa` (1024 × 512, przezroczystość z luminancji w shaderze hologramu).

## Port kontenerowy (arena Przejęcie)

Osiem modeli do dużej areny „Port kontenerowy”, w stylu zestawu miasta (proceduralne,
fasetowane, bez tekstur w GLB). Kontenery mają cztery warianty koloru jako osobne pliki,
pachołek wariant z liną, razem 15 plików `port_*.glb` w `public/assets/models/city/`
(ten sam folder i loader co `city_*`), podglądy Workbench w `tools/blender/previews/city/`.

```bash
"D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- --only port_container_20_navy,port_container_20_olive,port_container_20_ochre,port_container_20_graphite,port_container_40_navy,port_container_40_olive,port_container_40_ochre,port_container_40_graphite,port_gantry_crane,port_light_tower,port_bollard,port_bollard_rope,port_reach_stacker,port_quay_edge,port_lashing_platform
node node_modules/vitest/vitest.mjs run tests/unit/portModels.test.ts --configLoader runner
```

Konwencje jak w mieście: metry, glTF Y-up, spód na `y = 0`, przód w +Z, płaskie normalne,
jedna siatka na materiał (`_port_merge`). AABB to rzeczywisty bounding box GLB **X × Y × Z**.
Punkt odniesienia = początek układu modelu (tam gra stawia `position`).

| Plik                                 | AABB X × Y × Z [m]      | Punkt odniesienia                                                                            | Materiały                                                                                                                                                                                                                                               | Trójkąty |
| ------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------: |
| `port_container_20_<kolor>.glb` (×4) | 6,058 × 2,591 × 2,438   | środek spodu AABB; długość w X, drzwi w +X, boki z blachą falistą w ±Z                       | `mat_container_<kolor>`, `mat_metal` (narożniki, rygle, zawiasy), `mat_cable` (wnętrze, szczelina drzwi), `mat_label_stencil`, `mat_label_barcode`, `mat_label_warning`                                                                                 |     1188 |
| `port_container_40_<kolor>.glb` (×4) | 12,192 × 2,591 × 2,438  | jak 20 ft                                                                                    | jak 20 ft                                                                                                                                                                                                                                               |     1476 |
| `port_gantry_crane.glb`              | 26,220 × 18,180 × 8,940 | środek między czterema wózkami kół: koła na liniach x = ±12 m (rozstaw 24 m), jazda wzdłuż Z | `mat_crane_paint` (rama), `mat_machine` (wózek), `mat_hivis` (rama chwytaka), `mat_lacquer`, `mat_glass` (kabina), `mat_hazard`, `mat_rubber`, `mat_trim`, `mat_metal`, `mat_cable`, `mat_paint`, `mat_light_white`, `mat_neon_amber`, `mat_neon_green` |     2140 |
| `port_light_tower.glb`               | 3,391 × 20,120 × 3,391  | oś masztu; drabina z koszem po −Z                                                            | `mat_metal`, `mat_concrete`, `mat_trim`, `mat_machine`, `mat_hivis`, `mat_light_white` (8 reflektorów), `mat_neon_amber` (lampa szczytowa), `mat_label_warning`                                                                                         |     1462 |
| `port_bollard.glb`                   | 0,620 × 0,600 × 0,620   | oś pachołka                                                                                  | `mat_metal`, `mat_trim`, `mat_hivis` (głowica)                                                                                                                                                                                                          |      328 |
| `port_bollard_rope.glb`              | 1,085 × 0,600 × 2,087   | oś pachołka (x = z = 0); lina i zwój leżą w +Z i +X                                          | jak pachołek; lina `mat_hivis`                                                                                                                                                                                                                          |      704 |
| `port_reach_stacker.glb`             | 6,060 × 5,756 × 11,105  | środek spodu AABB; przód (wysięgnik, rama chwytaka w poprzek X) w +Z                         | `mat_machine`, `mat_lacquer`, `mat_glass`, `mat_hivis`, `mat_hazard`, `mat_rubber`, `mat_trim`, `mat_metal`, `mat_light_white`, `mat_neon_amber`                                                                                                        |     1152 |
| `port_quay_edge.glb`                 | 4,000 × 2,000 × 1,600   | środek spodu AABB; woda (odbojnica) w +Z, moduły łączą się w X                               | `mat_quay_concrete`, `mat_hazard` (pas krawędzi), `mat_rubber_fender`, `mat_metal`, `mat_trim`, `mat_cable` (linia wody)                                                                                                                                |      232 |
| `port_lashing_platform.glb`          | 6,000 × 1,240 × 1,370   | środek spodu AABB; kładka w X, wejścia na obu końcach                                        | `mat_steel_grating` (pomost), `mat_metal` (rama), `mat_hivis` (barierki-kratownice), `mat_hazard` (krawężniki), `mat_neon_amber` (znaczniki)                                                                                                            |      396 |

Budżety (pilnuje `tests/unit/portModels.test.ts`): kontenery i kładka ≤ 1500, krawędź
nabrzeża ≤ 800, pachołek ≤ 400 (z liną ≤ 800), maszt ≤ 1500, wózek ≤ 2000, suwnica ≤ 3000
trójkątów — ten sam rząd co `city_*` (136–1500), suwnica jest największym obiektem areny.

**Powierzchnie do chodzenia** (kolizja areny = prostopadłościan o wymiarach AABB):

- **Kontenery:** wierzch na `y = 2,591` (narożniki odlewane; szyny 4 mm, dach 8 mm niżej —
  płasko dla gracza). Kontenery stoją na narożnikach, więc stos to kolejne `y = n · 2,591`.
  Blacha falista (trapez, podziałka ok. 0,33 m, głębokość 4,5 cm) jest tylko na ścianach.
- **Krawędź nabrzeża:** wierzch na `y = 2,0` na całym module (beton + pas `mat_hazard`
  przy wodzie). Odbojnica i płyta siedzą pod okapem, wewnątrz AABB. Żeby wierzch licował
  z placem na `y = 0`, postaw moduł na `y = −2,0`.
- **Kładka:** pomost to jedna płaska płyta z wierzchem na `y = 0,10` na całej szerokości
  przejścia (|z| ≤ 0,6 m); spód `y = 0` kładzie się na dachach dwóch stosów, np. nad
  szczeliną ok. 4 m (po ~1 m oparcia z każdej strony). Barierki (1,15 m) to kratownice po
  bokach; końce są otwarte.

Suwnica, maszt, wózek i pachołki to przeszkody/dekoracje: kolizję warto złożyć z prostych
brył (nogi suwnicy 0,9 × 13,1 × 0,9 m na x = ±12, z = ±3; belki progowe 0,9 × 1 × 8,6 m;
maszt ok. 0,7 m średnicy; wózek — prostopadłościan nadwozia bez wysięgnika). Pod belkami
suwnicy jest 15,8 m prześwitu i 23 m szerokości między progami — mieszczą się 2–3 rzędy
kontenerów z pasem przejazdu.

**Materiały do podpięcia później.** Nowe nazwy portu nie są jeszcze w rejestrze gry
(`src/render/materials.ts`, `urbanMaterials.ts`) — poza galerią spadną na `mat_world`
z ostrzeżeniem. Każda nazwa odpowiada teksturze powierzchni generowanej osobno
(`public/assets/textures/surfaces/`). Kolor podglądu (sRGB) jest w `PORT_PAINTS` /
`PORT_MATERIALS` w `build_assets.py`; tak samo barwi je galeria.

| Materiał                 | Tekstura (surfaces)             | Podgląd   | Wygląd zastępczy w galerii |
| ------------------------ | ------------------------------- | --------- | -------------------------- |
| `mat_container_navy`     | `container_corrugated_navy`     | `#283a62` | `paint` + barwa podglądu   |
| `mat_container_olive`    | `container_corrugated_olive`    | `#4e5638` | `paint` + barwa podglądu   |
| `mat_container_ochre`    | `container_corrugated_ochre`    | `#a97c26` | `paint` + barwa podglądu   |
| `mat_container_graphite` | `container_corrugated_graphite` | `#343a44` | `paint` + barwa podglądu   |
| `mat_crane_paint`        | `crane_paint`                   | `#9c7430` | `paint` + barwa podglądu   |
| `mat_quay_concrete`      | `quay_concrete`                 | `#4a5568` | `concrete`                 |
| `mat_rubber_fender`      | `rubber_fender`                 | `#23262d` | `rubber`                   |
| `mat_steel_grating`      | `steel_grating`                 | `#4b566b` | `metal`                    |

Pozostałe materiały to istniejące nazwy miasta (tabela wyżej). Paleta Neon Noir: bryły
ciemne i chłodne, światła tylko bursztyn (`mat_neon_amber`), ciepła biel
(`mat_light_white`) i jedna zielona lampka stanu w kabinie suwnicy; test odrzuca barwy
z zakresów czerwieni, cyanu i magenty. Brak marek i logotypów: kontenery mają tylko
istniejące nadruki (szablon „07”, tabliczka z kodem kreskowym, znak ostrzegawczy).
Numer kontenera w stylu „NRD-204” wymagałby nowej tekstury `labels/label_<id>.webp`.

Węzły (siatki po materiałach): kontener `shell`, `hardware`, `interior`, `stencil`,
`csc_plate`, `warning`; suwnica `frame`, `trolley`, `spreader`, `cabin`, `cabin_glass`,
`wheel`, `running_gear`, `hazard`, `steelwork`, `hoist_rope`, `power_house`,
`girder_light`, `position_light`, `status_lamp`; maszt `mast`, `plinth`, `fittings`,
`headframe`, `railing`, `flood_lens`, `beacon`, `warning`; pachołek `bollard`,
`anchor_bolt`, `head_cap` / `rope`; wózek `body`, `cab`, `cab_glass`, `spreader`,
`wheel`, `running_gear`, `hazard`, `hydraulics`, `headlight`, `amber_light`; krawędź
`coping`, `hazard_edge`, `fender`, `fender_plate`, `fender_bolt`, `waterline`; kładka
`deck`, `frame`, `railing`, `toe_board`, `marker_light`.

Uwagi integracyjne: `RoomScene`/`Arena` rozpoznają własne materiały modeli po prefiksie
`city_` (`model?.startsWith('city_')`) — modele `port_*` trzeba tam dopisać. Część krawędzi
nabrzeża poniżej placu (`y < 0`) wpada w mgłę wysokościową motywu `neonStreet`.

## Budowa i elektrownia

Zestaw zawiera 18 modeli dla przyszłych aren `arenaConstructionSite` i
`arenaPowerPlant`. Generator zapisuje GLB w `public/assets/models/city/`,
a podglądy PNG w `tools/blender/previews/city/`.

```powershell
& "D:/Blender/blender.exe" -b --factory-startup --python tools/blender/sets/construction_power.py
& "D:/Blender/blender.exe" -b --factory-startup --python tools/blender/sets/construction_power.py -- --only build_scaffold_bay,power_pipe_rack
```

Galeria całego zestawu: `?scene=city-props-test&view=6`. Do oceny detali
wybierz np. `?scene=city-props-test&prop=power_cooling_tower_breach&yaw=0`.
Zestaw jest w metrach, w układzie glTF Y-up, z przodem +Z i spodem na
`y = 0`. Pozycje powierzchni podano względem punktu montażu modelu. AABB
obejmuje też poręcze, dlatego do kolizji używaj wymiarów podestów z tabeli.
Modele nie zawierają colliderów. Dla porównania `port_gantry_crane` ma
2140 trójkątów i budżet 3000.

Kolory zastępcze nowych powierzchni są zapisane w
`src/data/render/arenaMaterials.json`. Identyfikator przyszłej tekstury
jest nazwą materiału bez prefiksu `mat_`. Po dostarczeniu tekstury
integracja może usunąć `flat: true` z wpisu i dostroić parametry powierzchni.

| Model | AABB X × Y × Z [m] | Punkt montażu | Powierzchnie chodzenia [m] | Materiały (`mat_…`) | Trójkąty |
| --- | ---: | --- | --- | --- | ---: |
| `build_tower_crane` | 6,325 × 65,25 × 64,096 | oś masztu na środku podstawy 6 × 6 m | — | `cable`, `concrete`, `concrete_raw_cast`, `crane_paint`, `glass`, `hivis`, `light_white`, `machine`, `metal`, `neon_amber` | 3892 |
| `build_scaffold_bay` | 2,5 × 3,1 × 1,2 | środek podstawy, łączenie w X | Y = 2, X ±1,25 i Z ±0,49 (wolny pas); deski 2,5 × 1,2 m; poręcz w +Z | `formwork_plywood`, `hivis`, `metal` | 468 |
| `build_unfinished_column` | 0,605 × 4,8 × 0,605 | oś słupa | — | `concrete`, `concrete_raw_cast`, `rust` | 212 |
| `build_rebar_bundle` | 6 × 0,59 × 1,02 | środek podstawy | — | `formwork_plywood`, `rust`, `trim` | 508 |
| `build_precast_stack` | 6 × 1,6 × 2,406 | środek podstawy | Y = 1,6; X ±2,975 i Z ±1,175 | `concrete_raw_cast`, `formwork_plywood`, `trim` | 368 |
| `build_pipe_stack` | 3,02 × 2,793 × 3 | środek podstawy, osie rur w Z | — | `concrete_raw_cast`, `formwork_plywood` | 504 |
| `build_mixer_truck` | 2,51 × 3,55 × 9,02 | środek podwozia, długość w Z | — | `container_navy`, `crane_paint`, `glass`, `hivis`, `light_white`, `machine`, `metal`, `rubber`, `steel_grating`, `trim` | 1340 |
| `build_site_office` | 6,058 × 2,591 × 2,438 | środek podstawy, drzwi w +Z | Y = 2,591; X ±3,029 i Z ±1,219 | `container_graphite`, `container_navy`, `corrugated`, `glass`, `hivis`, `metal` | 540 |
| `build_site_office_stairs` | 5,871 × 3,691 × 1,68 | X = 0 na biegu; środek szerokości, wejście od −X | stopnie: 15 × 0,32 m biegu; Z ±0,7; spocznik Y = 2,591, X 2…3 i Z ±0,7 | `hivis`, `metal`, `steel_grating` | 528 |
| `build_hoarding_fence` | 4 × 2,4 × 1,1 | środek rozstawu słupków, wsporniki w −Z | — | `concrete`, `container_graphite`, `hivis`, `metal`, `trim` | 216 |
| `power_cooling_tower` | 50 × 70 × 50 | oś chłodni | Y = 0, posadzka o promieniu 24,3 m; prostokąt pewnego dojścia X/Z ±16 m | `concrete`, `concrete_raw_cast`, `cooling_tower_concrete`, `turbine_hall_floor` | 3458 |
| `power_cooling_tower_breach` | 50 × 70 × 49,552 | oś chłodni, wejście w +Z | jak chłodnia pełna; wolny wlot od +Z, co najmniej X ±4 i Y 0…9,9 m | `concrete`, `concrete_raw_cast`, `cooling_tower_concrete`, `rust`, `turbine_hall_floor` | 3518 |
| `power_turbine_housing` | 20 × 7,1 × 6 | środek podstawy; pomost wzdłuż X | Y = 6; X ±9,8 i Z ±2,8 | `concrete_raw_cast`, `container_graphite`, `hivis`, `machine`, `metal`, `neon_green`, `trim`, `turbine_hall_floor` | 1624 |
| `power_transformer` | 6 × 5 × 4 | środek podstawy | — | `concrete_raw_cast`, `container_graphite`, `glass`, `machine`, `metal`, `neon_green`, `paint` | 1216 |
| `power_hv_pylon` | 16,5 × 30 × 7,2 | oś słupa, ramiona w X | — | `concrete_raw_cast`, `glass`, `metal` | 2516 |
| `power_pipe_rack` | 12 × 7,3 × 4,02 | środek modułu; łączenie w X | Y = 6,2; X ±6 i Z 0,55…1,95 | `concrete_raw_cast`, `hivis`, `machine`, `metal`, `steel_grating`, `trim` | 1668 |
| `power_chimney` | 10 × 120 × 10 | oś komina | — | `concrete`, `concrete_raw_cast`, `hivis`, `metal`, `neon_amber` | 2236 |
| `power_slag_heap` | 26 × 7 × 26 | oś podstawy i położenie szczytu | profil pochyły, patrz niżej | `asphalt`, `slag_heap` | 32 |

Rusztowania można układać co 2,5 m w X i co 2 m w Y. Cienkie spoiny między
deskami przykrywa wspólna kolizja podestu. Biura stoją w warstwach co 2,591 m.
Schody mają wznios stopnia 2,591/15 m i bieg 4,8 m przed spocznikiem.
Przy wejściu do biura obróć bieg tak, żeby otwarty koniec spocznika
dochodził do drzwi. Podesty turbiny i estakady pozostają otwarte na końcach w X.
Na estakadzie ramy są w X = −5,85 / 0 / 5,85 m, dzięki czemu ich stopy
mieszczą się w 12-metrowym module.

Chłodnia ma dolną krawędź powłoki na Y = 4 m i przewężenie o średnicy
30 m na Y = 46,667 m. Wejście przez wyrwę prowadzi od +Z na posadzkę na
poziomie gruntu. Jej okrągły obrys można odwzorować kilkoma prostokątami
lub wykorzystać płaski grunt areny na tej samej wysokości.

**Profil hałdy.** Podstawa mieści się w X/Z ±13 m, szczyt jest w (0; 7; 0).
Krawędź na Y = 0 ma 32 wierzchołki. Dla indeksu `i = 0…31` kąt wynosi
`a = 2πi/32`, promień `r = 13` na osiach, w pozostałych punktach
`r = 12,8 + 0,2·cos(1,7i)`; współrzędne to `X = r·cos(a), Z = r·sin(a)`.
Ściany są płaskimi trójkątami od każdego odcinka obrzeża do szczytu.
Wzdłuż dowolnego promienia wysokość rośnie liniowo od krawędzi do 7 m.
Najstromsza ściana ma 29,057°. Dla colliderów użyj ramp skierowanych ku
szczytowi, z początkiem na Y = 0 i biegiem 12,6–13 m od obrzeża do środka.
Docelowy obrys 26 × 26 m pozwala zachować wysokość 7 m oraz limit 30°.

Żuraw ma wysięgnik 50 m w +Z, przeciwwysięgnik 14 m w −Z i wierzchołek
na 65,25 m z lampą. Dla kolizji przy gruncie użyj podstawy 6 × 6 m.
Do przeglądu sylwetki użyj widoku całego zestawu, a do przeglądu wyrwy,
łączeń podestów i świateł użyj zbliżeń `prop=`. Sprawdzenie przejścia
kapsułą przy odbiorze aren zależy od ich colliderów.

## Estakada, dachy, doki (duże areny, ADR 0011)

22 modele do aren `arenaOverpass` (prefiks `hw_`), `arenaRooftops` (`roof_`) i `arenaFloodedDocks`
(`dock_`). Osobny skrypt zestawu `tools/blender/sets/overpass_roofs_docks.py` importuje pomocnicze
funkcje z `build_assets.py` (`import build_assets as ba`), ma własny rejestr i `--only`; `build_assets.py`
nie został zmieniony. Pliki: `public/assets/models/city/<nazwa>.glb` (ten sam folder i loader
`cloneCityModel` co `city_*`), podglądy `tools/blender/previews/city/<nazwa>.png` — arkusz 2×2: przód 3/4,
tył 3/4, widok z wysokości oczu (1,7 m) i sylwetka nocą z daleka (płaskie barwy na ciemnym niebie).

```powershell
& "D:/Blender/blender.exe" -b --factory-startup --python tools/blender/sets/overpass_roofs_docks.py
& "D:/Blender/blender.exe" -b --factory-startup --python tools/blender/sets/overpass_roofs_docks.py -- --only dock_barge,hw_gas_canopy --no-preview
```

Konwencje jak w porcie: metry, glTF Y-up, spód na `y = 0`, przód +Z, płaskie normalne, jedna siatka na
materiał. **P** = początek w środku podstawy AABB (x = z = 0); inne punkty odniesienia opisano w tabeli.
AABB to rzeczywisty bounding box GLB **X × Y × Z**. W kolumnie materiałów pominięto prefiks `mat_`;
**pogrubione** są nowe materiały zestawu. Każdy model ma pusty korzeń o swojej nazwie, a płaskie
powierzchnie chodzenia to zamknięte płyty `walk_slab` (wierzch to jedna płaszczyzna, pola materiałów
nie zachodzą na siebie). Modele nie zawierają colliderów ani świateł punktowych.

| Nazwa | AABB X × Y × Z [m] | Punkt odniesienia | Powierzchnie chodzenia (wysokość; prostokąt XZ) i przejścia | Materiały (`mat_…`) | Trójkąty / budżet |
| --- | --- | --- | --- | --- | ---: |
| `hw_gas_canopy` | 24,000 × 6,700 × 12,000 | P; słupy x = −9 / 0 / 9, z = ±3 (stopa 0,9 × 0,9) | spód wiaty (najniższy punkt) **y = 5,5** nad całym rzutem; dach płaski y = 6,5 z attyką 6,7 (bez wejścia) | concrete, **gas_station_tiles**, hivis, lacquer, light_white, metal, neon_amber, neon_blue, roof_tar, trim | 1680 / 2000 |
| `hw_gas_pump` | 1,200 × 2,000 × 0,604 | P; wyświetlacze ±Z | blok 1,2 × 2 × 0,6 | concrete, lacquer, light_white, machine, metal, neon_amber, neon_green, plastic, rubber, trim | 608 / 1500 |
| `hw_toll_booth` | 6,530 × 3,000 × 9,000 | oś wysepki (x = z = 0); szlaban w +X | wysepka y = 0,2 (x ±1,4; z ±3,6, nosy do ±4,5); budka x ±1,1, z ±1,7 do y = 2,6, daszek x ±1,4, z ±2 do y = 3; ramię szlabanu x 1,47…5,11, y 0,95…1,05, z 2,6…2,7 | concrete, glass, hazard, hivis, light_white, machine, metal, neon_amber, neon_green, trim | 772 / 1500 |
| `hw_broken_deck_end` | 14,000 × 2,600 × 12,000 | jak `city_overpass_deck`: środek segmentu, spód y = 0, z = −6…6 | `walk_slab` **14 × 1,6 × 10 m: wierzch y = 1,6, x ±7, z −6…4**, środek collidera (0; 0,8; −1); pas wolny między barierami x ±6,2; z = 4…6 poszarpana krawędź (wierzch < 1,6, nie do chodzenia) | asphalt, cable, concrete, glass, **highway_asphalt_worn**, hivis, metal, rubber, rust, trim | 1588 / 2000 |
| `hw_vent_tower` | 8,000 × 25,000 × 8,000 | P | — (cokół 8 × 0,3 × 8, trzon z pilastrami 7,5 × 7,5, głowica 8 × 8 na 19…23,3 m) | cable, concrete, machine, metal, neon_green, **overpass_concrete** (istniejący), trim | 2972 / 3000 |
| `hw_camp_tent_dome` | 3,280 × 1,281 × 2,870 | P; wejście w +Z | — (namiot ok. 2,4 × 1,25 × 2,1, linki i drobiazgi wokół) | cable, fabric, hivis, market_tarp, metal, paint, trim, wood | 678 / 800 |
| `hw_camp_tent_ridge` | 2,202 × 1,739 × 3,950 | P; kalenica w Z, otwarte wejście w +Z | — (plandeka 2,2 × 1,6 × 2,8, linki do z = ±1,95) | cable, fabric, hivis, lacquer, market_tarp, metal, neon_amber, rubber, wood | 420 / 800 |
| `hw_camp_shack` | 3,100 × 2,400 × 2,617 | P; wejście w +Z | otwarte wejście x −0,5…0,55, y 0…2,0 w ścianie z = +1,15; wnętrze na gruncie (y = 0) | cable, concrete, corrugated, fabric, market_tarp, metal, neon_amber, rubber, rust, trim, wood | 1456 / 1500 |
| `hw_fire_barrel` | 0,622 × 1,420 × 0,614 | P (oś beczki) | — (beczka r = 0,29, h = 0,95; płomienie do 1,42) | cable, concrete, metal, neon_amber, neon_white, rust, wood | 752 / 800 |
| `hw_storm_culvert` | 9,700 × 5,800 × 8,000 | x = 0 w osi tunelu, **z = 0 w licu portalu**; tunel w −Z, skrzydła w +Z | `walk_slab` **wierzch y = 0,2, x ±3, z −6…1,5** (+ trójkąty fartucha do skrzydeł); wnętrze wolne 6 × 4 m (y 0,2…4,2) na z −6…0, tył otwarty (przechodnie); w kracie przejście x −0,2…2,6 do y = 2,5 | cable, concrete, light_white, metal, **overpass_concrete** (istniejący), rust, trim | 840 / 2000 |
| `roof_clock_tower` | 8,000 × 35,000 × 8,000 | P (oś wieży); drzwi w +Z | — (cokół 8 × 1,2 × 8, tarcze r = 2,3 na y = 23,35, szczyt 35 m) | concrete, glass, hivis, lacquer, metal, neon_amber, neon_white, paint, plaster, trim, wood | 2952 / 3000 |
| `roof_giant_sign` | 20,000 × 12,667 × 5,511 | P; panele w +Z (lico z = 1,744) | pomost serwisowy y = 4,1, x ±10, z 1,79…2,59 (dekoracyjny, bez testu); rama 20 × 8 m na y 4,2…12,2 | cable, concrete, light_white, machine, metal, neon_amber, neon_violet, steel_grating, trim | 1364 / 2000 |
| `roof_stairwell_hut` | 3,200 × 3,000 × 4,500 | P; drzwi w +Z | przejście **1,2 × 2,2 m** (x ±0,6, z 1,4…1,65); wnętrze wolne x ±1,35, z −2,0…1,4 na podłożu (y = 0); dach płaski y = 3,0 (x ±1,5, z −2,25…1,55) | concrete, lacquer, light_white, machine, metal, neon_amber, plaster, roof_tar, trim | 324 / 1500 |
| `roof_skylight` | 3,000 × 0,800 × 2,000 | P | `walk_slab` **wierzch y = 0,8 na całym 3 × 2** (rama i szyby w jednej płaszczyźnie) | glass, metal, roof_hvac_metal | 188 / 800 |
| `roof_chimney_stack` | 2,000 × 3,000 × 1,000 | P | — (komin 1,8 × 2,3 × 0,8 z gzymsem 2 × 1 do y = 2,53, nasady do 3,0) | cable, concrete, **flood_brick_algae**, metal, roof_tar, rust, trim | 516 / 800 |
| `dock_pontoon` | 6,000 × 0,800 × 2,400 | P | `walk_slab` **wierzch y = 0,5, x ±3, z ±1,2**; pachołki x ±2,65, z ±1,0 (r ≤ 0,17, do y = 0,8); pływaki y 0…0,26 (linia wody ok. y = 0,25) | **boardwalk_planks**, hivis, metal, neon_amber, rubber, rubber_fender, trim | 844 / 1500 |
| `dock_skiff` | 6,200 × 1,720 × 2,040 | P; długość w X, dziób w +X | — (bez kolizji chodzenia; linia wody ok. y = 0,3) | hivis, light_white, machine, market_tarp, metal, neon_amber, paint, rubber, trim, wood | 564 / 800 |
| `dock_pump_house` | 16,000 × 12,400 × 16,683 | środek rzutu budynku (x ±8, z ±5); rury w +Z | `walk_slab` posadzka **y = 0,1, x ±7,9, z ±4,3**; wejścia przechodnie **3 × 3 m** w obu szczytach (x = ±7,4…7,9; z −3…0; y 0,1…3,1); wolna posadzka x ±7,3, z −4,3…1,4 (pompy z 1,4…3,8); rury Ø 1,8 m z y = 5 do wylotów x = ±3, środek y = 1,2, z = 11 (klapy do z = 11,68), siodła z = 9,9 i 10,6 | cable, **canal_stone_wall**, concrete, crane_paint, **flood_brick_algae**, glass, hivis, machine, metal, neon_amber, paint, rust, trim | 2944 / 3000 |
| `dock_lock_gate` | 12,000 × 7,450 × 2,400 | P; skrzydła x ±5, przyczółki x ±5…6, z ±1,2 | kładka **wierzch y = 6,0, x −6…6, z ±0,7** (`walk_slab` x ±5 + korony przyczółków); poręcze z = ±0,76 do y = 7,05 nad x ±0,12…4,9; mechanizmy zasuw z 0,88…1,15, sygnalizatory (±5,6; z −1,0) | **boardwalk_planks**, **canal_stone_wall**, concrete, hivis, lacquer, metal, neon_amber, neon_green, paint, rust, trim | 1572 / 2000 |
| `dock_barge` | 30,000 × 6,720 × 8,000 | P (stępka y = 0); długość w X, sterówka w +X | `walk_slab` pokład **y = 2,6 = 1,6 m nad wodą (linia wody y = 1,0), x ±15, z ±4**; wolny pokład pod stragany x −13,6…10,8, z ±3,6; nadburcia \|z\| ≥ 3,84 z przejściami x ±1,6; sterówka x 11,2…14,4, z ±1,8 | **boardwalk_planks**, glass, hivis, lacquer, light_white, machine, metal, neon_amber, rubber, rubber_fender, rust, trim | 1840 / 2000 |
| `dock_mooring_post` | 1,039 × 4,200 × 1,035 | oś zespołu pali na dnie (x = z = 0) | — (pale do y = 4,0, lampa do 4,2; pas glonów y 0,9…1,45) | hivis, metal, neon_amber, paint, rust, wood | 684 / 800 |
| `dock_half_sunken_car` | 2,123 × 2,489 × 4,215 | P; przód +Z, pochylony 21° nosem w dół, przechył 11° | — (najniższy punkt y = 0 w nosie; woda ok. y = 0,9…1,2) | cable, glass, hivis, lacquer, metal, paint, plastic, rubber, rust, trim | 510 / 800 |

Budżety pilnuje test: punkty orientacyjne (wieża wentylacyjna, wieża zegarowa, przepompownia)
≤ 3000 jak `port_gantry_crane`, duże bryły ≤ 2000, rekwizyty z kolizją ≤ 1500, dekoracje ≤ 800.

**Montaż i wysokości.** Kolizje areny to prostopadłościany z kolumny „powierzchnie chodzenia”, nie AABB
z poręczami. `hw_broken_deck_end` łączy się z `city_overpass_deck` w z = −6 (te same x, wysokość jezdni
i bariery x = ±6,6). Kanał burzowy stawiamy na `y = dno kanału − 0,2`; przepompownię licem wylotów
(z = 11) przy krawędzi nabrzeża; barkę na `y = poziom wody − 1,0`; ponton na `y = poziom wody − 0,25`;
śluzę tak, by korony murów kanału były na `y = 6,0` modelu. Wnętrze budki na dachu (`roof_stairwell_hut`)
jest puste — zejście w dół (otwór, schody) dodaje układ areny.

**Nowe materiały** (nazwy = planowane tekstury powierzchni z `tools/textures/catalog.json`): zarejestrowane
w `src/data/render/arenaMaterials.json`. Pliki tekstur `public/assets/textures/surfaces/<id>.webp`
są już podpięte (wpisy bez `flat`; kolumna „Barwa” to mnożnik `tint`).

| Materiał | Tekstura (surfaces) | Barwa zastępcza / podgląd | Użycie |
| --- | --- | --- | --- |
| `mat_gas_station_tiles` | `gas_station_tiles` | `#5a606b` | okładzina słupów wiaty |
| `mat_highway_asphalt_worn` | `highway_asphalt_worn` | `#33363d` | wierzch urwanej krawędzi wiaduktu |
| `mat_flood_brick_algae` | `flood_brick_algae` | `#4a3f3a` | mury przepompowni; komin dachowy (jedyna cegła na liście tekstur) |
| `mat_boardwalk_planks` | `boardwalk_planks` | `#4a3d31` | pokład pontonu, kładka śluzy, pokład barki |
| `mat_canal_stone_wall` | `canal_stone_wall` | `#3d434c` | cokół i obramienia przepompowni, przyczółki śluzy |

Pozostałe nazwy to istniejące materiały miasta, portu (`steel_grating`, `rubber_fender`, `crane_paint`)
i aren (`overpass_concrete`, `roof_tar`, `roof_hvac_metal`, `market_tarp`). Paleta Neon Noir: emisja tylko
bursztyn, zieleń, fiolet, błękit i ciepła biel (płomienie beczki: bursztyn + ciepła biel, sygnalizatory
zielony/bursztynowy, lampy tylne wraku bursztynowe i bez emisji). Brak marek, logotypów i napisów:
panele szyldów i wiaty są puste, tarcze zegara mają tylko kreski.

**Uwaga integracyjna:** `RoomScene`/`Arena` rozpoznają modele bloków przez `isCityModelFile`
(`src/render/cityModels.ts`), więc `hw_`/`roof_`/`dock_` działają jako `model` bloku.

Kontrola: `tests/unit/cityModels.test.ts` (sekcja zestawu) sprawdza komplet 22 plików, podglądów i galerii,
AABB i punkt odniesienia, budżety, węzły charakterystyczne, rozpoznanie materiałów przez `applyStyle`,
barwy zarezerwowane i emisję, płyty `walk_slab` (jeden wierzch, pole równe prostokątowi), powierzchnie
chodzenia promieniami w dół, spód wiaty (5,5 m) i drożność przejść (drzwi, wnętrza, krata, pokład).
Ręcznie: `?scene=city-props-test&view=9` albo `&prop=<nazwa>` (patrz `docs/systems/city.md`).

Obejrzano wszystkie 22 arkusze. Poprawki po podglądach: wiata dostała pusty błękitny panel i podział
gzymsu (z daleka była jednolitą płytą); urwany wiadukt — gęstsza, piłowata krawędź, poprzeczne pręty
i gruz (pierwsza wersja była falista); komin — usunięte plamy sadzy, które czytały się jak okna; barka —
pokład wysunięty nad burty, wiszące opony, zwoje lin (była pustą skrzynią); wrak — mocniejsze
pochylenie; wieża wentylacyjna, wieża zegarowa i przepompownia — przycięte trójkąty do budżetu 3000;
przepompownia, namioty — wyeliminowane drobne wystawanie pod y = 0, które podnosiło cały model.

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
normalizuje cztery największe wagi każdego wierzchołka. Ciało ma gładkie
cieniowanie z ostrymi krawędziami powyżej 50° (kontur rysuje sylwetkę i płyty,
a nie fasetki po decymacji) i ciemny kombinezon `mat_enemy_dark`; płyty pancerza
(`mat_enemy`) i broń mają płaskie normalne i fazowane krawędzie, akcenty świetlne
(`mat_enemy_glow`: wizjer, linie na piersi, naramiennikach i kolanach, klamra) nie
mają konturu w grze. Wspólne: kask z wizjerem, kołnierz, pas z klamrą. Wyposażenie
to duże, płaskie płyty bez drobnicy (małe ciemne elementy tusz zamieniał w plamy);
role rozróżnia sylwetka czytelna z 20–30 m, a we mgle — kształt świecących akcentów.
Sylwetki ról: Szturmowiec — legionista: poprzeczny grzebień-wachlarz ze świecącym
rdzeniem, okrągłe naramienniki, fartuchy ud, długa pałka z dużą głowicą; Strzelec —
piechur: kanciasty hełm z daszkiem, goglami i nausznikami, płaskie naramienniki, płyty ud,
plecak z radiem i wysoką anteną ze świecącym szczytem, karabin; Snajper — smukły: wysoki
szpiczasty kaptur z monokularem, wąskie barki, płaszcz i poły do łydek ze świecącymi
krawędziami z przodu, długi karabin; Tarczownik — szeroki: piętrowe naramienniki, garb
nad karkiem, hełm prewencyjny z płaską osłoną twarzy, tarcza z ciemnym licem, wizjerem,
szewronem i szynami światła; Egzekutor — masywny: zakręcone rogi z trzech segmentów,
ogromne naramienniki z dwoma kolcami, fartuch kata z przodu i z tyłu, rdzeń w ramie
i świecący kręgosłup. Wysokość ciała w pozycji wiązania to 1,84 m; Egzekutor
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

## Kryjówka — cywil NPC i kot

### `npc_civilian.glb` (mieszkańcy kryjówki)

`build_npc_civilian()` importuje ten sam manekin UAL co wrogowie i robi tę samą decymację, więc skala
(`1.84 / wysokość`), kości `Rig` (53) i stopy na y=0 są identyczne jak w `enemy_trooper.glb` — klipy z
`npc_anims.glb` i pomiary siedzisk działają bez zmian. Z manekina zostają tylko głowa, szyja i dłonie
(`civ_skin`, 1867 tri). Strój to własne, proceduralne siatki skórowane do szkieletu: przekroje tułowia, rękawów
i nogawek są dopasowane do sylwetki manekina (otoczka przekroju + zapas), wagi kości liczone analitycznie
(płynne przejścia w stawach). Bez płyt, ładownic i brył przypiętych do pojedynczej kości. Cieniowanie gładkie
z ostrymi krawędziami powyżej 38–50°, jak ciało wrogów (kontur rysuje sylwetkę, nie fasetki).
Klipów w pliku nie ma (eksport `animations=False`); węzły kości są w pozie T.

| Węzeł (prefiks)                                            | Materiał                          | Co to                                                                       |
| ---------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `civ_skin`                                                 | `mat_npc_skin`                    | głowa, szyja, dłonie manekina                                               |
| `civ_pants`, `civ_boots`                                   | `mat_npc_pants` / `mat_npc_boots` | spodnie (miednica + nogawki), buty z podeszwą na y=0 i cholewką             |
| `top_shirt`                                                | `mat_npc_shirt`                   | koszula z długim rękawem (pod kamizelką i fartuchem)                        |
| `top_jacket` (+ `top_jacket__accent`)                      | `mat_npc_outer`                   | kurtka do bioder ze stójką, zamek w akcencie                                |
| `top_hoodie` (+ `_pocket`, `__accent_L/R`)                 | `mat_npc_outer`                   | bluza z kieszenią, zsuniętym kapturem i trokami w akcencie                  |
| `top_coat`                                                 | `mat_npc_outer`                   | płaszcz z wykładanym kołnierzem, poły do kolan z rozcięciem (przód z udami) |
| `over_vest` (+ `__accent`)                                 | `mat_npc_outer`                   | kamizelka bez rękawów na koszuli, zamek w akcencie                          |
| `over_apron` (+ `_strap`, `_tie`)                          | `mat_npc_outer`                   | fartuch od piersi do kolan, pasek na karku, troki                           |
| `head_hood`                                                | `mat_npc_outer`                   | kaptur na głowie z otworem twarzy, opada na kark                            |
| `prop_pouches_L/R`                                         | `mat_npc_gear`                    | saszetki przy pasie (kość `DEF-hips`)                                       |
| `prop_backpack` (+ `_strap_L/R`, `__accent`)               | `mat_npc_gear`                    | plecak (kość `DEF-spine.003`), skórowane szelki, ekranik w akcencie         |
| `prop_satchel` (+ `_strap`, `__accent`)                    | `mat_npc_gear`                    | torba przy lewym biodrze, skórowany pas na ukos przez prawy bark            |
| `prop_toolbelt` (+ `_pocket_L/R`, `_tool_L/R`, `__accent`) | `mat_npc_gear` / `mat_npc_metal`  | pas z kieszeniami, narzędzia, klamra                                        |
| `prop_wrench`                                              | `mat_npc_metal`                   | klucz przy lewym biodrze                                                    |
| `role_szron_L/R` (+ `__accent`)                            | `mat_npc_outer`                   | pagony (kości `DEF-shoulder.L/R`) i naszywka Kapitana Szrona                |

Gra pokazuje części według `look` (`npcOutfit`, `docs/systems/hub.md`) i podmienia materiały po nazwie; kolory
są w `tuning.hub` (`npcShirtColors`, `npcPantsColors`, `npcBootsColor`, `npcSkinColor`, `npcGearColor`,
`npcMetalColor`) i w odcieniach `look.shade`. Wszystkie warianty razem: ok. 7700 tri; jeden NPC: ok. 3,7–4,3 tys.
Podgląd `tools/blender/previews/npc_civilian.png`: dziewięć ujęć (koszula z torbą, kurtka z plecakiem, bluza,
płaszcz w chodzie, kamizelka z pasem, fartuch z saszetkami, kaptur z pagonami, siedzenie, klęczenie).

### `hub_cat.glb` (kot Węgielek)

`build_hub_cat()` buduje własny szkielet (23 kości: `hips`, `spine`, `chest`, `neck`, `head`, `tail1`–`tail4`,
przednie `upperarm`/`forearm`/`hand`, tylne `thigh`/`shin`/`foot`/`toe`, strony `.L`/`.R`) i siatkę z pierścieni
(950 tri): smukły tułów, głowa z policzkami i małym pyszczkiem, trójkątne uszy, łapy, długi zwężający się ogon.
Materiały: `mat_cat_fur` (`cat_body`), `mat_cat_eye` (migdałowe oczy, `cat_eyes`), `mat_cat_nose` (`cat_nose`).
Przód +Z glTF, łapy na y=0, długość ok. 0,5 m bez ogona, wysokość z uszami ok. 0,46 m.
Klipy (30 kl./s, zapętlone; pozy łap liczone dwuczłonowym IK w płaszczyźnie YZ):

| Klip    | Długość | Co robi                                                                 |
| ------- | ------- | ----------------------------------------------------------------------- |
| `idle`  | 2,4 s   | stoi: oddech, lekki ruch głowy, kołysanie ogona                         |
| `walk`  | 0,67 s  | chód (kolejność LT, LP, PT, PP), ogon w górze; łapa w podporze 0,55 m/s |
| `sit`   | 3 s     | siedzi, ogon owinięty z boku, drganie końca ogona                       |
| `lie`   | 4 s     | leży „bochenkiem”, przednie łapy przed sobą, wolny oddech               |
| `groom` | 1,2 s   | siedzi i myje się: prawa łapa przy pyszczku, ruch głowy                 |

Budowa: `--only npc_civilian,hub_cat` (wrogowie, ręce i bronie zostają nietknięte). Podglądy:
`tools/blender/previews/hub_cat.png` (idle, dwie fazy chodu, sit, lie, groom). Porównanie w grze przed i po:
`tools/blender/previews/npc_*_before.png` / `npc_*_after.png`, `cat_*_before.png` / `cat_*_after.png`.
Testy: `tests/unit/hubNpcView.test.ts`, `hubSeating.test.ts`, `hubCatView.test.ts`.

## Katalog

| Plik                                   | Co to                                                                                                                                                                            | Węzły dla kodu                                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `enemy_trooper.glb`                    | Szturmowiec (5107 tri): grzebień-wachlarz ze świecącym rdzeniem, okrągłe naramienniki, fartuchy ud, akumulator na plecach, długa pałka z cewkami                                 | `hand_R`, `baton`, `baton_tip`, `baton_hit`, `visor`                                                                             |
| `enemy_gunner.glb`                     | Strzelec (5251 tri): kanciasty hełm z daszkiem i goglami, płyty ud, plecak z radiem i anteną ze świecącym szczytem, karabin                                                      | `hand_R`, `rifle`, `muzzle`, `visor`                                                                                             |
| `enemy_sniper.glb`                     | Snajper (5268 tri): wysoki szpiczasty kaptur z monokularem, wąskie barki, płaszcz i poły do łydek ze świecącymi krawędziami, długi karabin                                       | `hand_R`, `rifle`, `muzzle`, `visor`, `eye` (soczewka lunety)                                                                    |
| `enemy_shielder.glb`                   | Tarczownik (5299 tri): piętrowe naramienniki, garb, hełm z osłoną twarzy, pałka i tarcza (ciemne lico, wizjer, szewron, szyny światła — dzieci `shield`)                         | `hand_R`, `shield` (widoczność wg `shieldUp`), `baton`, `baton_tip`, `baton_hit`, `visor`                                        |
| `enemy_executor.glb`                   | Egzekutor (5395 tri): manekin 1,2×, zakręcone rogi, ogromne naramienniki z kolcami, fartuch kata, świecący kręgosłup, rdzeń w ramie                                              | `hand_R`, `blade_hilt`, `chest_core`, `visor`; kod dodaje `executor_blade` wg `bladeSizeM`                                       |
| `enemy_drone.glb`                      | Dron (936 tri): kadłub z kopułą czujnika, ciemne ramiona ze światłami pod silnikami, boczne i tylne światła, duże oko, lufa; początek układu w środku kadłuba, oko z przodu (+Z) | `eye` (pulsuje przy celowaniu), `rotor_LF/RF/LB/RB` (pivot w środku, obrót wokół Y), `muzzle`                                    |
| `enemy_turret.glb`                     | Wieżyczka (1104 tri): ośmiokątny cokół z trzema łapami i siłownikami, kolumna z pierścieniem światła, głowica z osłonami, zasobnikami i radiatorem, podwójne lufy, oko nad lufami; spód na y = 0, przód +Z | `turret_head` (pivot w osi pionowej, obrót wokół Y), `barrels` (odrzut wzdłuż Z), `eye` (pulsuje przy celowaniu), `muzzle` (= dane) |
| `enemy_projectile.glb`                 | wolny, dobrze widoczny pocisk wroga, wydłużony wzdłuż Z                                                                                                                          | — (do `InstancedMesh`)                                                                                                           |
| `plasma_blade.glb`                     | ostrze plazmowe (872 tri): rękojeść z owijką 4 pasów, widełkami emitera, szczeliną mocy i pierścieniem głowicy                                                                   | `hilt`, `grip`, `trim`, `emitter_ring`, `blade` (pivot u emitera — skaluj po Z do wysuwania), `blade_core`, `blade_tip`          |
| `blaster.glb`                          | blaster z przegrzaniem                                                                                                                                                           | `frame`, `heat_vents` i `heat_cell` (kolor/emisja = poziom ciepła), `muzzle`                                                     |
| `player_arm_R.glb`, `player_arm_L.glb` | rękawica taktyczna z rękawem i cybernetycznym karwaszem FPP (10 264 tri na rękę)                                                                                                 | `forearm`, `wrist`, `palm`, 15 przegubów palców, `palm_center`, `resonance_core`, `socket_blade`, `socket_gun`, `socket_support` |
| `crate.glb`, `crate_small.glb`         | skrzynie 1 m i 0,5 m (interaktywne: chwyt i rzut), obręcze, narożniki i ukośne zastrzały na bokach (356 tri)                                                                     | —                                                                                                                                |
| `pillar.glb`                           | filar 4 m z pilastrami, opaską w połowie i stopniowanymi głowicami (360 tri)                                                                                                     | —                                                                                                                                |
| `wall_segment.glb`                     | ściana 4 × 3 m, grubość 0,4 m                                                                                                                                                    | —                                                                                                                                |
| `cover_low.glb`                        | niska osłona 2 × 1 m z koroną, bocznym pasem i cokołem (176 tri)                                                                                                                 | —                                                                                                                                |

Model wroga wybiera pole `model` w `src/data/enemies/<id>.json` (nazwa pliku bez `.glb`). Brak pola: Strzelec i Snajper używają `enemy_gunner`, pozostałe humanoidy `enemy_trooper`; przy błędzie ładowania zostają bryły zastępcze (`EnemyView`, `DroneView`). Test `tests/unit/enemyModels.test.ts` pilnuje, że plik istnieje. Humanoidy używają skinningu i klipów; test `enemySkeleton.test.ts` sprawdza skin, budżet, komplet klipów i węzłów, kierunek lufy oraz niezależność 30 klonów.

Kolizje: wyprowadzaj z prostych brył w kodzie (prostopadłościany, kapsuły), nie z siatek modeli.

### Montaż bloków pokoju (skala do kolizji)

Collider bloku to zawsze prostopadłościan `size` z JSON pokoju; widoczny model musi go wypełniać.

- **Bryły rozciągliwe** — `pillar`, `cover_low`, `wall_segment`: gra skaluje model niejednorodnie tak, by bounding box był równy `size` bloku (spód na spodzie bloku, środek w środku). Wymiary GLB są tylko proporcją bazową. Gdy dłuższy bok podstawy bloku leży w osi Z, a modelu w X, model obraca się o 90° wokół Y (osłona 1 × 1,2 × 4 m dostaje skalę 2 × 1,2 × 1,67 zamiast 0,5 × 1,2 × 6,67). Detale tych modeli muszą znosić skalę ok. 0,6–2× na osi.
- **Rekwizyty o stałych proporcjach** — `city_*`, `crate`, `crate_small`: skala 1, bez rozciągania. Blok w danych pokoju ma mieć wymiary modelu w tolerancji 5% (tabela „Miasto”, docelowe bloki kolizji); większy rozjazd to błąd danych pokoju, nie modelu.

Test: `tests/unit/roomBlockModelFit.test.ts` (wszystkie pokoje, prawdziwe GLB).

### Zestaw aren Przejęcia: estakada i targ na dachach

12 nowych modeli i dodatkowy fioletowy wariant straganu (13 GLB). Własne,
proceduralne geometrie bez tekstur, nadruków, marek i napisów. Prefiks `city_`
zachowuje ścieżki oraz obsługę materiałów miejskich. Pliki:
`public/assets/models/city/<nazwa>.glb`, podglądy:
`tools/blender/previews/city/<nazwa>.png`. Areny, pogoda i collidery będą
integrowane osobno; modele nie zawierają colliderów ani świateł punktowych.

Tabela zawiera **zmierzone AABB GLB (X × Y × Z, metry)** oraz rzeczywiste liczby
trójkątów wszystkich instancji siatek. **P** = początek w środku podstawy AABB,
spód na y = 0, środek x = z = 0; przód +Z. Każdy model ma korzeń o swojej nazwie.
W kolumnie materiałów pominięto wspólny prefiks **`mat_`**.

| Nazwa                             | AABB X × Y × Z [m]      | Punkt odniesienia  | Materiały (`mat_…`)                                              | Trójkąty / budżet |
| --------------------------------- | ----------------------- | ------------------ | ---------------------------------------------------------------- | ----------------: |
| `city_overpass_pillar`            | 2,500 × 10,000 × 2,513  | P                  | concrete, hazard, metal, trim                                    |        412 / 1500 |
| `city_overpass_deck`              | 14,000 × 2,600 × 12,000 | P; jezdnia y = 1,6 | asphalt, concrete, hivis, rubber, trim                           |        436 / 1500 |
| `city_highway_barrier`            | 4,000 × 1,093 × 0,808   | P; długość w X     | concrete, hivis, metal, trim                                     |        228 / 1500 |
| `city_highway_sign_gantry`        | 14,000 × 7,000 × 1,400  | P; rozpiętość w X  | concrete, metal, neon_amber, neon_green, trim                    |        632 / 1500 |
| `city_wrecked_car`                | 2,150 × 1,580 × 3,950   | P; przód +Z        | cable, glass, hivis, lacquer, metal, plastic, rubber, rust, trim |        676 / 1500 |
| `city_smog_scrubber`              | 3,000 × 4,000 × 3,000   | P                  | cable, concrete, machine, metal, neon_green, paint, trim         |        672 / 1500 |
| `city_roof_water_tank`            | 3,000 × 5,000 × 3,000   | P                  | concrete, metal, rust, trim, wood                                |        708 / 1500 |
| `city_roof_hvac_unit`             | 4,000 × 1,998 × 2,052   | P                  | cable, machine, metal, neon_green, trim                          |       1000 / 1500 |
| `city_market_stall_canopy`        | 3,024 × 2,612 × 2,000   | P; lada w +Z       | cable, lacquer, metal, neon_amber, paint, trim, wood             |        596 / 1500 |
| `city_market_stall_canopy_violet` | 3,024 × 2,612 × 2,000   | P; lada w +Z       | cable, fabric, metal, neon_amber, paint, trim, wood              |        596 / 1500 |
| `city_roof_bridge`                | 1,600 × 1,390 × 8,000   | P; pomost y = 0,2  | hivis, metal, neon_amber, trim                                   |        276 / 1500 |
| `city_neon_sign_frame`            | 6,000 × 3,000 × 1,800   | P; panel w +Z      | concrete, machine, metal, neon_amber, neon_violet, trim          |         208 / 800 |
| `city_satellite_cluster`          | 3,000 × 3,400 × 2,000   | P; czasze w +Z     | cable, concrete, machine, metal, trim                            |         492 / 800 |

**Montaż elementów chodzonych:** węzeł `walk_slab` wyznacza zamkniętą płytę.
W GLTFLoader jest grupą prymitywów podzielonych według materiałów.

- Estakada: płyta **14 × 1,6 × 12 m**, środek collidera `(0; 0,8; 0)`,
  górna płaszczyzna y = 1,6, końce segmentu z = ±6. Bariery są wewnątrz
  szerokości 14 m, sięgają y = 2,6; wolny pas między ich podstawami ma 12,4 m.
  Dylatacje i pasy jezdni to rozłączne pola tej samej płaszczyzny, bez uskoku
  i bez nakładających się ścian. Segmenty można łączyć co 12 m w osi Z.
- Kładka: płyta **1,6 × 0,2 × 8 m**, środek collidera `(0; 0,1; 0)`,
  górna płaszczyzna y = 0,2, końce z = ±4. Poręcze do y = 1,39;
  przejście między listwami ma 1,4 m (1,378 m między wystającymi lampami).
  Oznaczenia końców są płaskie.
- Collider płyty musi używać powyższych wymiarów, **nie AABB całego modelu
  z poręczami**. Bariery i poręcze wymagają osobnych prostopadłościanów przy
  przyszłej integracji. Nie dodano kolizji w tym zadaniu.

Granatowy brezent używa istniejącego `mat_lacquer` (powlekana powierzchnia),
fioletowy `mat_fabric`; oba warianty mają tę samą ugiętą geometrię i wymiary.
Nie dodano nazw materiałów ani tekstur. Panele bramownicy są puste, bursztynowy
i zielony; szyld dachowy ma pusty fioletowy panel z bursztynowymi krawędziami.
Wrak to krótki hatchback w osi Z z pogniecioną maską, zapadniętym dachem,
odsłoniętą kabiną, odłamkiem szyby i wyrwanym błotnikiem.

Eksport wyłącznie tego zestawu:

```powershell
& "D:/Blender/blender.exe" -b --factory-startup --python tools/blender/build_assets.py -- --only city_overpass_pillar,city_overpass_deck,city_highway_barrier,city_highway_sign_gantry,city_wrecked_car,city_smog_scrubber,city_roof_water_tank,city_roof_hvac_unit,city_market_stall_canopy,city_market_stall_canopy_violet,city_roof_bridge,city_neon_sign_frame,city_satellite_cluster
```

Obejrzano wszystkie 13 PNG. Po pierwszej ocenie usunięto nakładanie powierzchni
jezdni i oznaczeń kładki, zakotwiono osłony wentylatorów, dodano kołnierze HVAC,
ugięto brezent i odsłonięto lampy straganów oraz mocniej zdeformowano wrak.
W trzeciej, ostatniej iteracji wraku obniżono fotel i słupek, aby nie przebijały
dachu; w kładce ujednolicono metalowy materiał boków płyty. Pozostałe modele
wymagały jednej lub dwóch iteracji. Wszystkie końcowe PNG zostały obejrzane.

Kontrola: `tests/unit/cityModels.test.ts` sprawdza komplet galerii (37 modeli),
wymiary, punkt odniesienia, paletę/emisję, budżety, obecność charakterystycznych
części i podglądów oraz wysokość, pole i drożność płaskich powierzchni pomostów.
Ręcznie: `?scene=city-props-test&prop=city_overpass_deck` lub dowolna nazwa z tabeli;
`yaw=145` pokazuje tył, `view=3` przegląd estakady, `view=4` targu dachowego.
Galeria nie symuluje chodzenia ani kolizji; ocenę ruchu zostawiono integracji aren.

### Zestaw „port i zajezdnia” (ADR 0011)

24 modele do dużych aren `arenaContainerPort` (Terminal kontenerowy) i `arenaRailYard`
(Zajezdnia Maglev): kontenerowiec z segmentów, suwnica nabrzeżowa STS, trap, wagony
towarowe, moduły hali magazynowej oraz tor maglev, wagony, słup sieci, bramownica
sygnałowa, nastawnia, wiata, obrotnica i zaspy. Osobny skrypt zestawu
`tools/blender/sets/port_rail.py` importuje funkcje pomocnicze z `build_assets.py`
(bez zmian w tym pliku), ma własny rejestr nazw i `--only`. Pliki
`public/assets/models/city/<nazwa>.glb`, podglądy `tools/blender/previews/city/<nazwa>.png`
jako arkusz 2 × 2: 3/4 z przodu, 3/4 z tyłu, z daleka na ciemnym tle (landmarki z 150–300 m)
i zbliżenie szczegółu.

```powershell
& "D:/Blender/blender.exe" -b --factory-startup --python tools/blender/sets/port_rail.py
& "D:/Blender/blender.exe" -b --factory-startup --python tools/blender/sets/port_rail.py -- --only port_ship_mid,rail_turntable --no-preview
```

Konwencje jak wyżej: metry, glTF Y-up, spód na y = 0, płaskie normalne, jedna siatka na
materiał (węzły nazwane jak w kolumnie „Węzły” testu). **P** = środek podstawy AABB
(x = z = 0, spód y = 0). AABB to zmierzony bounding box GLB **X × Y × Z** w metrach.
Powierzchnie chodzenia są pojedynczymi płaszczyznami na podanej wysokości (prostokąty
x × z w układzie modelu); test sprawdza je promieniami z 1,9 m nad powierzchnią, więc
przeszkody niższe od gracza w tych prostokątach są błędem. W kolumnie materiałów pominięto
prefiks `mat_`.

| Nazwa | AABB X × Y × Z [m] | Punkt odniesienia | Powierzchnie chodzenia | Materiały | Trójkąty / budżet |
| --- | --- | --- | --- | --- | ---: |
| `port_ship_bow` | 28,000 × 23,200 × 32,000 | P; złącze z segmentem mid na x = −14, zaokrąglony dziób w +X (x = 14) | pokład główny y = 12: x −14…−11, z ±15,6; pokład dziobowy y = 13: od x = −11 do obrysu dziobu (wolny prostokąt x −7…2,5, z ±9,5; falochron w kształcie V na x −8,8…−7,6, h = 3 m, z ±12); schody 12 → 13 przy obu burtach: 5 × 0,2 m, stopień 0,3 m, pierwszy podstopień x = −12,2, z ±(13,6…15,5) | ship_hull_paint, ship_deck_steel, steel_grating, metal, trim, paint, machine, hivis, cable, light_white, neon_amber, neon_green | 1830 / 3500 |
| `port_ship_mid` | 30,000 × 13,760 × 32,000 | P; złącza x = ±15 | pokrywy luków y = 12,8: x −14…−0,8 i 0,8…14, z ±13 (stosy 40 ft wzdłuż X, 10 rzędów, środki z = −10,97 + 2,438·i); pokład y = 12: chodniki burtowe z ±(13…15,6), pasy poprzeczne x −15…−14, −0,8…0,8 i 14…15 (z ±13); reling z = ±15,75 (1,1 m) z luką na trap x −1,2…1,2 po obu burtach | ship_hull_paint, ship_deck_steel, metal, trim, paint, machine, hazard, light_white, neon_amber | 1584 / 3500 |
| `port_ship_mid_hold` | 30,000 × 13,760 × 32,000 | P; złącza x = ±15 | dno ładowni y = 3,0: x ±13,6, z ±12,6; zrębnica 0,4 m (wierzch y = 12,8, zewnętrznie x ±14, z ±13) z przerwą x 5,4…6,8 po −Z; pokład y = 12 jak w mid; schody przy ścianie −Z (z −12,6…−11,2, szer. 1,4 m): 3 biegi × 15 podstopni 0,2 m, stopień 0,3 m, pierwsze podstopnie x = −10,0 / −4,4 / 1,2 na y = 3 / 6 / 9, spoczniki 1,4 m: x −5,8…−4,4 (y 6), −0,2…1,2 (y 9), 5,4…6,8 (y 12, wyjście przez przerwę w zrębnicy); drabiny na ścianie +Z przy x = −6,5 i 8,5 | jak mid + steel_grating, hivis | 2896 / 3500 |
| `port_ship_stern` | 30,000 × 34,252 × 32,000 | P; złącze x = +15, pawęż x = −15 | pokład y = 12 (wolne chodniki przy nadbudówce x −5,5…3,2: z −15,6…−10,3 i 11,4…15,6); pokrywa luku y = 12,8: x 4,4…14, z ±13; galerie y = 15 / 18 / 21: front x 2,0…3,2 (z ±10,2), boki x −5,5…2,0, z ±(9,0…10,2), parapet 1 m; skrzydła mostka y = 24: x −0,5…2,4, z ±(10…15,6); dach sterówki y = 27: x −5,2…2,6, z ±10,2 (maszt radaru x = −3,5); schody zewnętrzne tylko po +Z: 4 biegi 15 × 0,2 m, stopień 0,25 m, z 10,2…11,4, x −4,0…−0,5 (każdy bieg nad poprzednim), podesty górne x −0,5…0,7, dolne x −5,2…−4,0 | ship_hull_paint, ship_deck_steel, steel_grating, metal, trim, paint, machine, hivis, glass, light_white, neon_white, neon_amber | 3242 / 4000 |
| `port_sts_crane` | 96,000 × 59,350 × 24,800 | środek między nogami na poziomie szyn: nogi x = ±15 (rozstaw 30 m), z = ±9 (18 m), jazda wzdłuż Z; wysięgnik nad wodą w +X (koniec x = 65, 50 m za nogami od wody), zaplecze do x = −31 | — (przejazd pod portalem wolny 27,6 × 15,6 m do y = 17) | crane_paint, machine, metal, trim, hazard, hivis, lacquer, glass, cable, steel_grating, light_white, neon_amber, neon_green | 2238 / 4000 |
| `port_gangway` | 28,000 × 13,150 × 2,300 | P; bieg wzdłuż X, statek po +Z | rampa: płaszczyzna od (x −14, y 0) do (x 12, y 12) — bieg 26,0 m, wznios 12,0 m, kąt 24,78° (46,2%), długość 28,64 m, szerokość 2,0 m (z ±1); podest y = 12: x 12…14, z ±1, otwarty od +Z (krawędź z = +1 przykłada się do burty w luce relingu) | steel_grating, metal, hivis, concrete, rubber, neon_amber | 1024 / 1500 |
| `port_freight_boxcar` | 14,000 × 4,200 × 3,000 | P; długość w X (sprzęgi x ±7), koła na y = 0 (szyna), rozstaw 1,435 m | dach y = 4,2: x ±6,62, z ±1,45 | rust, trim, metal, wood, hivis | 1356 / 1500 |
| `port_freight_boxcar_open` | 14,000 × 4,200 × 3,000 | P | dach jw.; podłoga y = 1,2: x ±6,45, z ±1,32 (skrzynie i paleta przy x > 4,35); drzwi 3,0 × 2,55 m (x ±1,5, y 1,2…3,75) otwarte po obu stronach — przejście na wylot | jak boxcar + light_white | 1416 / 1500 |
| `port_flatcar` | 14,000 × 3,791 × 3,000 | P | pokład y = 1,2: x ±6,8, z ±1,38; dachy dwóch kontenerów 20 ft (granat, ochra) y = 3,791: x −6,158…−0,1 i 0,1…6,158, z ±1,219 | wood, trim, metal, hivis, container_navy, container_ochre, cable | 1840 / 2000 |
| `port_warehouse_shell_panel` | 6,000 × 10,000 × 0,730 | x = 0 środek modułu, spód y = 0; tył (wnętrze hali, słupy) z = 0, blacha falista na zewnątrz w +Z (grzbiety z = 0,45, lampa do 0,73); moduły co 6 m w X, połówki słupów na x = ±3 | — (ściana; cokół 0–1 m, świetliki 7,3–9,0 m) | corrugated, concrete, metal, paint, trim, glass, machine, light_white | 572 / 800 |
| `port_warehouse_roof_truss` | 30,000 × 3,300 × 6,000 | P; rozpiętość w X, łożyska x = ±15 na y = 0 (wierzch ściany 10 m) | — (pas dolny y 0,6–0,85, górny 2,85–3,1, płatwie do y = 3,3 = spód płyty dachu; moduł pokrywa z ±3, kolejne co 6 m) | metal, trim, machine, light_white | 652 / 1500 |
| `rail_track_straight` | 12,000 × 1,000 × 4,600 | P; tor wzdłuż X, moduły co 12 m | **wierzch prowadnicy y = 1,000** (półka z ±0,8, stalowe listwy do ±0,83); podsypka do y = 0,3 (wierzch z ±1,7, podstawa ±2,3); podkłady y 0,27–0,42 co 0,75 m (pierwszy x = −5,625); środnik belki z ±0,3, y 0,42–0,8 | rail_ballast, rail_sleeper_concrete, metal, trim | 516 / 800 |
| `rail_track_buffer` | 4,000 × 3,000 × 4,600 | P; strona toru −X (środek kozła = koniec toru + 2 m), belka do x = 0,4, odbojniki y = 2,0, czoło zderzaków x = −0,4 | — | rail_ballast, rail_sleeper_concrete, hivis, hazard, machine, rubber, metal, trim, neon_amber | 504 / 800 |
| `rail_maglev_car` | 25,000 × 4,100 × 4,000 | P; długość w X | dach y = 4,1: x ±12,2, z ±1,55 | maglev_body_panel, trim, glass, metal, rubber, neon_blue, neon_amber | 464 / 1500 |
| `rail_maglev_car_open` | 25,000 × 4,100 × 4,000 | P | dach jw.; podłoga y = 1,1: x ±12,08, z ±1,82, wolny pas z ±1,35 (siedzenia wzdłuż ścian poza drzwiami), sufit y = 3,4; drzwi 1,5 × 2,2 m (x ±(5,5…7,0), y 1,1…3,3) naprzeciw siebie po obu stronach — przejście przez wagon | jak car + fabric, plastic, light_white | 872 / 1500 |
| `rail_maglev_head` | 27,000 × 4,100 × 4,000 | P; nos w +X (x = 13,5), sprzęg w −X (x = −13,5) | dach y = 4,1: x −13,2…5,5, z ±1,55 (dalej opadający nos) | maglev_body_panel, trim, glass, metal, rubber, neon_blue, neon_amber, light_white | 592 / 1500 |
| `rail_catenary_mast` | 0,700 × 8,000 × 3,954 | oś słupa (x = z = 0); wysięgnik w +Z do z = 3,6, przewód jezdny y = 5,5 nad z = 3,0 | — | metal, concrete, trim, machine, light_white | 184 / 400 |
| `rail_signal_gantry` | 1,400 × 7,000 × 23,200 | P; rozpiętość w Z (nogi z = ±11), tory wzdłuż X na z = ±2,5 i ±7,5 (co 5 m); kratownica y 6,2–7,0; głowice dwustronne (±X) na z = −10 / −5 / 0 / 5, spód y = 4,95 | — (prześwit nad torami ±1,6 m do 4,9 m) | metal, concrete, trim, cable, light_white, neon_green, neon_amber | 1128 / 1500 |
| `rail_control_tower` | 10,600 × 14,000 × 8,400 | oś wieży (x = z = 0); trzon 6 × 6 m do 10 m, kabina 10–13,2 m, dach 13,2–13,6 (±3,6); schody po −X | galeria y = 10,0: pierścień 1,2 m (x i z w ±4,2 poza kabiną ±3), balustrada 1,1 m z przerwą po −X na z 1,35…2,45; schody: pasy A x −6,4…−5,3 i B −5,3…−4,2, 5 biegów × 10 podstopni 0,2 m, stopień 0,3 m (bieg 2,7 m między z = −1,35 a 1,35), naprzemiennie A w +Z i B w −Z, spoczniki 1,1 m na z ±(1,35…2,45) na y = 2 / 4 / 6 / 8, górny y = 10 (z 1,35…2,45) przy galerii | concrete, trim, light_white, glass, steel_grating, hivis, metal, neon_amber | 1974 / 2500 |
| `rail_platform_canopy` | 12,000 × 3,990 × 6,160 | P; stoi na wierzchu peronu, moduł co 12 m w X (słupy x = ±3) | — (peron to osobny blok areny; przy wagonie maglev wierzch peronu = podłoga wagonu 1,75 m nad spodem toru) | metal, trim, corrugated, wood, glass, machine, light_white, neon_blue, neon_amber, neon_green | 398 / 1000 |
| `rail_turntable` | 24,000 × 4,320 × 24,000 | P; blok 24 × 24 m, kanał kołowy r = 11 m (śr. 22 m, głębokość 1,5 m) | dno kanału y = 0 (płaskie; szyna jezdna r 10,3–10,5 do y 0,2, filar r 1,2 do 0,3 i czop do 0,55); obrzeże y = 1,5; pomost y = 1,5: x ±10,8, z ±(0,8…2,25); wierzch prowadnicy na moście y = 2,5 (z ±0,8); kabina x 6,5…8,7, z 2,25…4,15 (poza pomostem); postaw model na y = −1,5, wtedy obrzeże i pomost licują z gruntem, a prowadnica z `rail_track_straight` | concrete, hazard, metal, machine, rail_sleeper_concrete, steel_grating, lacquer, trim, glass, neon_amber | 1098 / 2000 |
| `rail_snow_drift` | 3,000 × 0,450 × 2,694 | P | — (bez kolizji) | snow | 96 / 300 |
| `rail_snow_drift_long` | 8,000 × 0,350 × 1,796 | P; zaspa wzdłuż X, grzbiet po +Z | — | snow | 120 / 300 |
| `rail_snow_drift_patch` | 2,600 × 0,180 × 1,944 | P | — | snow | 70 / 300 |

**Składanie.** Kontenerowiec: rufa, dowolna liczba segmentów `port_ship_mid` /
`port_ship_mid_hold` i dziób, wszystkie wzdłuż X ze środkami odległymi o sumę połówek
długości (np. rufa x = −45, mid −15, mid_hold 15, dziób 44). Linia wody to y = 0 modelu;
burta ma 12 m nad nią, więc trap o wzniosie 12 m łączy keję na wysokości linii wody
z pokładem (inna wysokość kei wymaga innego wzniosu). Suwnica STS stoi wysięgnikiem nad
wodą — przy statku wzdłuż X trzeba ją obrócić o 90°. Wagony towarowe stoją kołami na y = 0
(główka szyny), rozstaw 1,435 m. Wagony maglev na torze: y modelu = **0,65 m** nad spodem
toru — wtedy płozy (y 0–0,5, z ±0,55…1,05) obejmują półkę prowadnicy (spód półki 0,8, wierzch
1,0), podłoga wagonu jest na 1,75 m, a dach na 4,75 m. Hala 60 × 30 m: 10 modułów ścian na
dłuższych bokach, 5 na szczytach, kratownice co 6 m na wierzchu ścian (y = 10), płyta dachu
na y = 13,3; antresola i zamknięcie szczytów nad 10 m (pas 30 × 3,3 m) to bloki areny.

**Kolizje (propozycja dla integracji).** Kadłub segmentów jako prostopadłościany do y = 12
(mid 30 × 12 × 32 m) i pokrywy 13,2 × 0,8 × 26 m; w ładowni dno na 3,0, ściany boczne
z ±(12,6…16) i czołowe x ±(13,6…15) do 12, zrębnica 0,4 × 0,8 m; schody i rampy jak
w tabeli. Suwnica: nogi 1,8 × 39,5 × 1,8 m (y 3–42,5) na (±15, ±9), stopy 2,2 × 0,7 × 2,2,
wahacze z wózkami 1,4 × 2,3 × 6,8 m (y 0–2,3), belki 31,8 × 2 × 1,4 m na y 17–19.
Trap: płyta rampy jako obrócony prostopadłościan (24,78°), poręcze osobno, wieża pod
podestem 2 × 11,45 × 1,9 m. Bramownica: nogi 1,0 × 7 × 0,5 m na z = ±11. Zaspy bez kolizji.

Nowe powierzchnie (`mat_<idTekstury>`) są zarejestrowane w grze w
`src/data/render/portRailMaterials.json` (`portRailKinds` w `src/render/urbanMaterials.ts`)
z płaską barwą zastępczą; tekstur `public/assets/textures/surfaces/<id>.webp` jeszcze nie ma
(gra pisze jedno ostrzeżenie „Brak tekstury” na teksturę i używa wzoru zastępczego).

| Materiał | Tekstura (surfaces) | Barwa zastępcza / podgląd |
| --- | --- | --- |
| `mat_ship_hull_paint` | `ship_hull_paint` | `#2f3a4d` |
| `mat_ship_deck_steel` | `ship_deck_steel` | `#434d4c` |
| `mat_rail_ballast` | `rail_ballast` | `#57544f` |
| `mat_rail_sleeper_concrete` | `rail_sleeper_concrete` | `#6b717b` |
| `mat_maglev_body_panel` | `maglev_body_panel` | `#4b586c` |
| `mat_snow` | `snow` (spoza listy planowanych tekstur) | `#c8d2e0` — biel lekko błękitna, matowa (roughness 0,95) |

Pozostałe materiały to istniejące nazwy miasta i portu. Światła tylko ciepła biel
(`light_white`, `neon_white` — okna mostka), bursztyn, zieleń (światło burtowe, lampka
kabiny, sygnały) i błękit (pasy LED wagonów i wiaty); czerwień, cyan i magenta nie występują
(test sprawdza barwy i emisję). Brak napisów, marek i logotypów: tablica na wiacie i burta
są puste.

**Uwagi integracyjne.** `RoomScene` i `Arena` traktują jako modele z własnymi materiałami
tylko bloki z prefiksem `city_` i `port_`; bloki `rail_*` trzeba tam dopisać przy budowie
zajezdni (dekoracje `decor` działają z każdą nazwą). Stopnie 0,2 m mieszczą się w
`stepHeight` 0,35 m, rampa trapu 24,78° w `maxSlopeDeg` 45°.

Kontrola: `tests/unit/cityModels.test.ts` (opis „zestaw port i zajezdnia”) sprawdza komplet
24 plików i wpisów galerii, rozpoznawane materiały, brak zakazanych barw i emisji, budżety,
AABB, punkt odniesienia, węzły, podglądy, płaskie powierzchnie chodzenia z tabeli, rampę trapu,
przejście przez otwarte wagony, prześwit pod bramownicą i wolny przejazd pod suwnicą.
Galeria: `?scene=city-props-test&view=7` (port), `&view=8` (zajezdnia),
`&prop=<nazwa>` kadruje model.

Po obejrzeniu podglądów poprawiono: ostrzejszą linię wodną dziobu i pełniejszy pokład
dziobowy, jaśniejszy pas burtowy i pas wodnicy, jaśniejsze pokrywy luków, łódź ratunkową
zmieszczoną w obrysie rufy, tablicę kozła zwróconą do toru, nieregularne zaspy, szerokość
wagonu krytego (3,0 m), reflektory czoła maglevu wysunięte z poszycia, nienakładające się
wierzchy kontenerów na platformie oraz punkt odniesienia modułu ściany (wnętrze z = 0).

## Uwagi do F1

- Modele to placeholdery w docelowym stylu. Dopracowanie (więcej archetypów, warianty frakcji) w kolejnych fazach.
- Węzeł `blade` ma rozmiar 1 m przy skali 1; długość ostrza ustawiaj w `tuning.ts`, nie w modelu.
- Rozpad na odłamki (zadanie F1 #12) może ciąć części proceduralnie lub podmieniać je na gotowe fragmenty — decyzja w zadaniu.

## Bronie i ostrza F2

Bronie celują w -Z, początek w punkcie chwytu. Bryła `frame` to `mat_interactive`; `heat_vents` i
`heat_cell` (`mat_player_cyan`) kod koloruje ciepłem; `muzzle` to pusty węzeł wylotu (tu rysowany
jest błysk). Budowa: `--only plasma_blade,blaster,pistol,rifle,scatter,sniper_rifle,beam,emp_launcher,revolver,smg,mag_crossbow,blade_twin,blade_staff`.

Szlif FPP: każda broń i rękojeść ma też siatki `trim` (szyny, pierścienie, płytki, spust — jasna
stal) i `grip` (chwyt, kolba, pompa — guma). W GLB to nadal `mat_interactive`; gra nadaje
materiały widoku FPP po nazwie węzła (`src/render/fppMaterials.ts`: `frame`/`hilt` grafitowy
pancerz z chłodną krawędzią, `trim` stal, `grip` guma), niezależnie od motywu — w motywie neon
`mat_interactive` jest jasny i broń wyglądała jak biała zabawka. `blade_core` dostaje w grze
biało-gorący rdzeń, komiksową klingę zwróconą do kamery (płaskie strefy i pasma energii) i smugę
cięcia (`src/render/fppBladeFx.ts`).
Ciepło broni przechodzi z cyanu w biel rozgrzanego metalu (nie w czerwień — zarezerwowana dla wrogów).

Szlif komiksowy (Borderlands + Neon Noir, 18.11.2026): bryły budują pomocnicze `slab` (profil boczny
Y–Z wyciągnięty po X z fazą obrysu), `lathe` / `band` (bryły obrotowe z fazowanymi czołami, płaska
ściana na górze) i `_vent_bars` (skośne cyjanowe nacięcia). Fazy mają co najmniej 3 mm, żeby gruby
tusz rysował czytelne krawędzie zamiast czarnej plamy. Każda broń ma trzy płaskie strefy: grafitowy
`frame`, jasna stal `trim` (wierzchnia zamka lub komory, obręcze, celowniki) i guma `grip` (chwyt,
kolba zwężona ku gumowej stopce, pompa), plus jeden świecący element w cyjanie gracza. Chwyty
pistoletowe, łoża pod lewą dłonią, gniazda (`muzzle`, `support`) i obrys `frame` (od niego zależą
moduły warsztatu) zostały w dawnych położeniach.

Szlif FPP, runda 2 (18.11.2026): kamera gracza widzi broń od tyłu, z góry i z lewego boku (-X),
więc tam trafiły czytelne kształty. Pomocnicze `slab_xz` (profil czołowy X–Z wyciągnięty po Y),
`_u_sight` (szczerbinka U), `_ribbed_rail` (szyna z poprzecznymi żebrami), `_chevron` (żebro V),
`_side_plaque` i `_side_bolts` (płaska ciemna plakietka bez tekstu i 2–3 duże śruby, wypukłe o 3 mm,
bo cieńsze uskoki tusz rysował kropkowaną linią). Nowe świecące elementy (kanały rdzenia na
wierzchu, kropki celowników, szczeliny w tylnych płytach, okular lunety, pierścień bębna) należą
do siatki `heat_vents`, więc też reagują na ciepło; `heat_cell`, `grip`, gniazda i długość modelu
są bez zmian, obrys `frame` zmienił się o najwyżej 10 mm. Kontrola przenikania dłoni: bez zmian.

| Plik               | Sylwetka                                                                              | Węzły dla kodu                                                                                                          | Trójkąty |
| ------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| `blaster.glb`      | tylna tarcza V z żebrami i świecącym V, żebrowana szyna z kanałami, szczerbinka U     | `frame`, `trim`, `grip`, `heat_vents`, `heat_cell`, `muzzle`                                                            | 912      |
| `pistol.glb`       | wysoka szczerbinka U z kropkami, świecąca szczelina na zamku i w tylnej płycie, kurek | `frame`, `trim`, `grip`, `heat_vents`, `heat_cell`, `muzzle`                                                            | 684      |
| `rifle.glb`        | żebrowana szyna, uszy celowników, okno rdzenia na komorze, kanały łoża, dźwignia T    | `frame`, `trim`, `grip`, `heat_vents`, `heat_cell`, `muzzle`                                                            | 912      |
| `scatter.glb`      | rdzeń między żebrami radiatora, duża szczerbinka U, dach osłony z kanałem, pompa      | `frame`, `trim`, `grip`, `heat_vents`, `heat_cell`, `muzzle`                                                            | 740      |
| `sniper_rifle.glb` | świecący okular lunety, wieżyczki, kanały łoża, hamulec z portami, zamek z gałką      | `frame`, `trim`, `grip`, `heat_vents`, `heat_cell`, `scope_lens`, `muzzle`                                              | 940      |
| `beam.glb`         | emiter z czaszą, cewki, moduł z kanałem rdzenia, przeziernikiem i tylną szczeliną     | `frame`, `trim`, `grip`, `heat_vents` (cewki), `heat_cell`, `lens`, `muzzle`                                            | 848      |
| `emp_launcher.glb` | gruba tuba, bęben ze świecącym pierścieniem komór i krzyżem X, żebrowana szyna        | `frame`, `trim`, `grip`, `heat_vents` (pierścienie), `heat_cell`, `muzzle`                                              | 936      |
| `revolver.glb` | Sześciokątna lufa, bęben z sześcioma gniazdami i pierścieniem, kurek i szczelina na żebrze | `frame`, `trim`, `grip`, `heat_vents`, `heat_cell`, `muzzle`, `support` | 712 |
| `smg.glb` | Druciana kolba, osłona lufy z oknami, magazynek z okienkiem i przedni chwyt | jak `revolver` | 548 |
| `mag_crossbow.glb` | Bełt na podwójnej szynie, ramiona z cewkami i kolba szkieletowa | jak `revolver` | 620 |
| `blade_twin.glb`   | krótsza rękojeść, osłona-rogi wygięte ku klindze, cyjanowa listwa, kolec              | jak `plasma_blade`: `hilt`, `grip`, `trim`, `emitter_ring`, `blade`, `blade_core`, `blade_tip`                          | 756      |
| `blade_staff.glb`  | długa rękojeść (0,8 m), dwie szczeliny mocy przy chwycie, widełki emiterów            | `hilt`, `grip`, `trim`; przód `blade`, `blade_core`, `blade_tip`; tył `blade_back`, `blade_back_core`, `blade_back_tip` | 980      |

Budżet broni i rękojeści po szlifie: ≤ 3000 trójkątów (test `tests/unit/weaponModels.test.ts`);
bronie palne mają 684–940 (budżet z tabeli wyżej: ≤ 1000, osobny test), rękojeści 756–980.

Pivoty `blade` i `blade_back` leżą u emiterów, długość ostrza 1 m przy skali 1 (skaluj po Z).

Szlif FPP rękojeści (18.11.2026): z oka gracza widać grzbiet (+X Blendera, strona przycisku) i wierzch
(gardło emitera), więc tam są elementy rozpoznawcze. Owijka chwytu (`_fpp_wrap`) to 3–4 grube pasy
o promieniu dawnego walca chwytu ze skośnymi rowkami (grubość i położenie części chwytanej bez zmian).
Szczelina mocy (`_fpp_power_slot`) to ciemna obudowa w `trim` i cyjanowe ogniwa dołączone do
`emitter_ring` (`mat_player_cyan`, bez nowych węzłów). Widełki emitera (`_fpp_forks`) stoją po bokach
(±Z, lewo/prawo z oka). Warianty: `plasma_blade` — widełki, 3 ogniwa, pierścień głowicy (`_fpp_ring`);
`blade_twin` — rogi osłony i listwa mocy na jej grzbiecie, kolec głowicy, owijka 3 pasów; `blade_staff` —
dwie szczeliny po obu stronach chwytu i widełki na obu emiterach. Budżet rękojeści (bez rdzeni klingi)
≤ 1000 trójkątów; gniazda klingi i chwyt pilnuje `tests/unit/bladeHilts.test.ts`.
Model broni wskazuje pole `model` w `src/data/weapons/<id>.json`.

### Punkt podparcia broni

Wszystkie dziesięć modeli broni palnej ma dodatkowy pusty węzeł `support`, bezpośrednie dziecko
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
| `revolver` | [0, -0.100, 0.032] |
| `smg` | [0, 0.012, -0.18] |
| `mag_crossbow` | [0, 0.012, -0.24] |

## Przegubowe ręce FPP

Ręce FPP są wyjątkiem od ogólnego budżetu i płaskiego cieniowania: każda ma
**11 898 trójkątów** (budżet 6–12 tys.; rękawica `tactical_glove` 7 312, rękaw z karwaszem
i mankietem `plate_bracer` 1 790, reszta to płytki, paski i akcenty), 16 siatek, smooth
shading i skin glTF; GLB ok. 342 kB. `tactical_glove` to jedna zamknięta, ciągła siatka
rękawicy (od wnętrza rękawa po opuszki) — jedyna skinowana. Subdivision Surface
(Catmull–Clark, jeden poziom) jest zastosowany przed eksportem. Dłoń od nadgarstka do
czubka środkowego ma ok. 0,19 m, rękaw ok. 0,27 m.

Palce mają różne długości i paliczki w proporcji ok. 1 : 0,65 : 0,5, spłaszczony przekrój,
kłykcie, bruzdy zgięć, poduszki i opuszki; kciuk wyrasta nisko z kłębu, z osią zgięcia
skręconą ku palcom. Wnętrze dłoni jest wklęsłe, z kłębem małego palca.

Sztywne części (na kościach, gładkie łuki i ostre krawędzie > 40°):
`plate_knuckle_*` (paliczki bliższe), `plate_tip_index`, `plate_tip_thumb`, `plate_hand`
(płyta grzbietu pod `resonance_core`, segment przy nadgarstku i poduszka wnętrza dłoni),
`plate_bracer` (rękaw kurtki z kołnierzem i fałdami, obudowa karwasza, mankiet rękawicy),
`trim_bracer` (panel karwasza, śruby, klamra), `grip_strap` (paski), światło
`mat_player_cyan`: `bracer_light`, `wrist_light`, `dorsal_trace`; `resonance_core`
(`mat_power_magenta`) w `resonance_mount`. Wszystkie czarne części mają `mat_interactive`;
gra nadaje im materiały FPP po nazwie (`src/render/fppMaterials.ts`: `plate_*` pancerz,
`trim_*` stal, `grip_*` guma, `tactical_glove` rękawica). Części o tej samej kości
i materiale są scalone (budżet liczby siatek sceny w `roomStaticBatch.test.ts`).

### Szkielet i skinning

```text
player_arm_R / player_arm_L
└─ hand_skeleton_R / hand_skeleton_L (armatura)
   ├─ tactical_glove               (skin → 18 kości)
   └─ forearm                     (kość)
      ├─ plate_bracer, trim_bracer, grip_strap, bracer_light, wrist_light
      └─ wrist                    (kość, pivot w nadgarstku)
         └─ palm                  (kość, pivot w nadgarstku)
            ├─ index_1  → index_2  → index_3   (plate_knuckle_index, plate_tip_index)
            ├─ middle_1 → middle_2 → middle_3  (plate_knuckle_middle)
            ├─ ring_1   → ring_2   → ring_3    (plate_knuckle_ring)
            ├─ pinky_1  → pinky_2  → pinky_3   (plate_knuckle_pinky)
            ├─ thumb_1  → thumb_2  → thumb_3   (plate_tip_thumb)
            ├─ plate_hand, dorsal_trace, resonance_mount, resonance_core
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
`SkinnedMesh`; `src/render/handRig.ts` klonuje instancję przez `SkeletonUtils.clone`,
więc każda dłoń ma własne kości. Test `player_arm GLB contract` w
`tests/unit/handRig.test.ts` sprawdza 18 kości skina, gniazda i nazwy części.

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

| Gniazdo          | Pozycja [x, y, z], m       | Użycie                                                                               |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `socket_blade`   | [0, 0.039, -0.08544]       | `gripBlade`; rękojeść poprzecznie, emiter po stronie wskazującego (`bladeGrip.json`) |
| `socket_gun`     | [0.040, 0.0425, -0.094]    | chwyty broni palnej; wnętrze dłoni na boku chwytu, palce na przedniej krawędzi       |
| `socket_support` | [0.0042, 0.0215, -0.10321] | dłoń podpierająca; skręt 55° względem spoczynku dłoni                                |

Broń palna nie siedzi w gnieździe jednostkowo: pole `grip` w `src/data/weapons/*.json`
podaje położenie gniazda w układzie modelu broni (`offset`, opcjonalnie `rotation`
Euler XYZ) i pozy palców, osobno dla dłoni podpierającej (`grip.support`, względem macierzy
węzła `support` po stałych dwuręcznych). `M_hand = M_weapon * M_grip * inverse(M_socket)`;
szczegóły w `docs/systems/hands.md`.
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

Plik zawiera pełne pozy po 15 przegubów palców: `relaxed`, `open`, `fist`, `gripBlade`,
`gripGun`/`gripGunFire` (blaster i domyślny chwyt), chwyty dopasowane do modeli broni
(`gripPistol`, `gripRifle`, `gripScatter`, `gripSniper`, `gripBeam`, `gripEmp` z wariantami
`…Fire`) oraz dłoń podpierającą: `support` (domyślna) i `supportRifle`, `supportScatter`,
`supportSniper`, `supportBeam`, `supportEmp`, `supportPistol`. Wybór pozy i położenie dłoni względem broni
podaje pole `grip` w danych broni (`docs/systems/hands.md`).

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
- `hand_grip_blade.png`, `hand_grip_blade_inner.png`: chwyt ostrza;
- `hand_grip_<model>.png`, `hand_grip_<model>_detail.png` dla wszystkich 7 modeli broni
  (`pistol`, `blaster`, `rifle`, `scatter`, `sniper_rifle`, `beam`, `emp_launcher`, `revolver`, `smg`, `mag_crossbow`):
  chwyt z pola `grip`, obie dłonie jak w grze;
- `hand_support_<model>.png`, `hand_support_<model>_below.png`: dłoń podpierająca
  broni dwuręcznych;
- `hand_grip_pistol_inner.png`, `hand_grip_pistol_fire.png`: wskazujący na spuście;
- `hand_fpp_<model>.png`: kadr gry (`POSE` / `TWO_HAND_POSE`, kamera w początku, -Z,
  pionowe FOV 70°, 16:9); `hand_fpp_view.png` i `hand_fpp_view_detail.png` — pistolet.
- `hand_dorsal_detail.png`, `hand_palm_detail.png`, `hand_wrist_detail.png`,
  `hand_fist_side.png`, `hand_fist_front.png`: zbliżenia anatomii i rękawicy.

Kontrola ręczna: opuszki obejmują chwyt, kciuk przeciwstawia się palcom, zgięcia
są gładkie i nie zapadają się, obie dłonie zginają się lustrzanie. Sprawdź nasadę
kciuka, lamówkę i proporcje FPP. Podgląd ostrza kadruje rękojeść i dłoń,
koniec pełnego ostrza jest poza kadrem. Sprawdzono też przecięcia powierzchni
rękawicy z ostrzem, pistoletem, blasterem i karabinem (`gripGun`, `gripGunFire`)
oraz dłoń podpierającą: pomiar dla wszystkich broni jest w `docs/systems/hands.md`.

## Splasharty ekranów ładowania

`public/assets/splash/*.webp` to zoptymalizowane kopie ilustracji Gracjana z `docs/fabula/splash` (oryginały zostają nietknięte; max 1600 px szerokości, WebP jakość ~78, budżet ≤ 180 KB na plik). Wygeneruj je ponownie: `python tools/splash/optimize.py` (wymaga Pillow). Lista tytułów i przypisań do motywów/pokoi: `src/data/ui/splash.json`.
