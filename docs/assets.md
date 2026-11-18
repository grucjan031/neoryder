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
mają konturu w grze. Wspólne: kask z wizjerem i ciemną osłoną szczęki, kołnierz,
pas z klamrą. Sylwetki ról: Szturmowiec — grzebień na kasku ze światłem i akumulator
na plecach, Strzelec — daszek, gogle, radio z anteną, Snajper — szpiczasty kaptur,
monokular, płaszcz na plecach i poły, Tarczownik — osłona twarzy i tarcza z ciemnym
licem, wizjerem, szewronem i szynami światła, Egzekutor — rogi, kolce naramienników,
rdzeń w ramie i świecący kręgosłup. Wysokość ciała w pozycji wiązania to 1,84 m; Egzekutor
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
| `enemy_trooper.glb`                    | Szturmowiec (5215 tri): hełm z grzebieniem i wizjerem, naramienniki z liniami światła, ładownice, akumulator na plecach, pałka z cewkami                                         | `hand_R`, `baton`, `baton_tip`, `baton_hit`, `visor`                                                                             |
| `enemy_gunner.glb`                     | Strzelec (5315 tri): hełm z daszkiem i goglami, ładownice, radio z anteną, karabin z liniami światła                                                                             | `hand_R`, `rifle`, `muzzle`, `visor`                                                                                             |
| `enemy_sniper.glb`                     | Snajper (5458 tri): szpiczasty kaptur z monokularem, płaszcz i poły z lamówką, długi karabin ze świecącą lunetą                                                                  | `hand_R`, `rifle`, `muzzle`, `visor`, `eye` (soczewka lunety)                                                                    |
| `enemy_shielder.glb`                   | Tarczownik (5307 tri): ciężkie płyty, osłona twarzy, pałka i tarcza (ciemne lico, wizjer, szewron, szyny światła — dzieci `shield`)                                              | `hand_R`, `shield` (widoczność wg `shieldUp`), `baton`, `baton_tip`, `baton_hit`, `visor`                                        |
| `enemy_executor.glb`                   | Egzekutor (5251 tri): manekin 1,2×, rogi, kolce naramienników, egzoszkielet ze świecącym kręgosłupem, rdzeń w ramie                                                              | `hand_R`, `blade_hilt`, `chest_core`, `visor`; kod dodaje `executor_blade` wg `bladeSizeM`                                       |
| `enemy_drone.glb`                      | Dron (948 tri): kadłub z kopułą czujnika, ciemne ramiona ze światłami pod silnikami, boczne i tylne światła, lufa pod okiem; początek układu w środku kadłuba, oko z przodu (+Z) | `eye` (pulsuje przy celowaniu), `rotor_LF/RF/LB/RB` (pivot w środku, obrót wokół Y), `muzzle`                                    |
| `enemy_projectile.glb`                 | wolny, dobrze widoczny pocisk wroga, wydłużony wzdłuż Z                                                                                                                          | — (do `InstancedMesh`)                                                                                                           |
| `plasma_blade.glb`                     | ostrze plazmowe (284 tri): rękojeść z gumowym chwytem, pierścieniami i pazurami emitera                                                                                          | `hilt`, `grip`, `trim`, `emitter_ring`, `blade` (pivot u emitera — skaluj po Z do wysuwania), `blade_core`, `blade_tip`          |
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

## Uwagi do F1

- Modele to placeholdery w docelowym stylu. Dopracowanie (więcej archetypów, warianty frakcji) w kolejnych fazach.
- Węzeł `blade` ma rozmiar 1 m przy skali 1; długość ostrza ustawiaj w `tuning.ts`, nie w modelu.
- Rozpad na odłamki (zadanie F1 #12) może ciąć części proceduralnie lub podmieniać je na gotowe fragmenty — decyzja w zadaniu.

## Bronie i ostrza F2

Bronie celują w -Z, początek w punkcie chwytu. Bryła `frame` to `mat_interactive`; `heat_vents` i
`heat_cell` (`mat_player_cyan`) kod koloruje ciepłem; `muzzle` to pusty węzeł wylotu (tu rysowany
jest błysk). Budowa: `--only plasma_blade,blaster,pistol,rifle,scatter,sniper_rifle,beam,emp_launcher,blade_twin,blade_staff`.

Szlif FPP: każda broń i rękojeść ma też siatki `trim` (szyny, pierścienie, płytki, spust — jasna
stal) i `grip` (chwyt, kolba, pompa — guma). W GLB to nadal `mat_interactive`; gra nadaje
materiały widoku FPP po nazwie węzła (`src/render/fppMaterials.ts`: `frame`/`hilt` grafitowy
pancerz z chłodną krawędzią, `trim` stal, `grip` guma), niezależnie od motywu — w motywie neon
`mat_interactive` jest jasny i broń wyglądała jak biała zabawka. `blade_core` dostaje w grze
jasny cyjanowy rdzeń, poświatę zwróconą do kamery i smugę cięcia (`src/render/fppBladeFx.ts`).
Ciepło broni przechodzi z cyanu w biel rozgrzanego metalu (nie w czerwień — zarezerwowana dla wrogów).

| Plik               | Sylwetka                                                    | Węzły dla kodu                                                                                                          | Trójkąty |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| `blaster.glb`      | średni pistolet energetyczny, kołpak lufy                   | `frame`, `trim`, `grip`, `heat_vents`, `heat_cell`, `muzzle`                                                            | 368      |
| `pistol.glb`       | zwarty, krótki zamek, trzy cyjanowe nacięcia                | `frame`, `trim`, `grip`, `heat_vents`, `heat_cell`, `muzzle`                                                            | 260      |
| `rifle.glb`        | długi, kolba, ogniwo ciepła jak magazynek                   | `frame`, `trim`, `grip`, `heat_vents`, `heat_cell`, `muzzle`                                                            | 324      |
| `scatter.glb`      | szeroki, dwie grube lufy, pompa                             | `frame`, `trim`, `grip`, `heat_vents`, `heat_cell`, `muzzle`                                                            | 352      |
| `sniper_rifle.glb` | bardzo długi, luneta z cyjanową soczewką, ogniwo pod komorą | `frame`, `trim`, `grip`, `heat_vents`, `heat_cell`, `scope_lens`, `muzzle`                                              | 396      |
| `beam.glb`         | gruby emiter z cewkami w klatce prętów i soczewką (`lens`)  | `frame`, `trim`, `grip`, `heat_vents` (cewki), `heat_cell`, `lens`, `muzzle`                                            | 376      |
| `emp_launcher.glb` | gruba tuba z bębnem i rozszerzonym wylotem                  | `frame`, `trim`, `grip`, `heat_vents` (pierścienie), `heat_cell`, `muzzle`                                              | 324      |
| `blade_twin.glb`   | krótsza rękojeść z poprzeczną osłoną                        | jak `plasma_blade`: `hilt`, `grip`, `trim`, `emitter_ring`, `blade`, `blade_core`, `blade_tip`                          | 284      |
| `blade_staff.glb`  | długa rękojeść (0,8 m), emitery z pazurami na obu końcach   | `hilt`, `grip`, `trim`; przód `blade`, `blade_core`, `blade_tip`; tył `blade_back`, `blade_back_core`, `blade_back_tip` | 380      |

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
`supportSniper`, `supportBeam`, `supportEmp`. Wybór pozy i położenie dłoni względem broni
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
  (`pistol`, `blaster`, `rifle`, `scatter`, `sniper_rifle`, `beam`, `emp_launcher`):
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
