# Rezydencja run6 — druga partia modeli

Dodano 31 modeli: 21 wymaganych i 10 dodatków. Pierwsze 38 GLB nie zmieniło się
(walidacja SHA-256). Każdy nowy model ma PNG 720 × 720 oraz wpis AABB i materiałów
w `src/data/render/mapModelBounds.json`. Katalog i instrukcje odtwarzania są
w `docs/assets.md`; specyfikacja drugiej partii w `batch2-specs.json`, a pomiary
wszystkich 69 modeli w `manifest.json`.

Obejrzano wszystkie modele na czterech arkuszach `contact-batch2-*.jpg` i pełne
podglądy wanny, fotela, fikusa oraz lampy łukowej. Poprawiono obrys oparcia fotela,
krzywiznę lampy i geometrię liści oraz połączenia gałązek z pniem.
Modele pozostają w dotychczasowym stylu z geometrią płasko cieniowaną.

Zakres nie obejmuje podpięcia modeli do mapy, zmian renderera ani danych pokoi.
Nie zmieniono historii git. Autor mapy powinien sprawdzić dopasowanie nowych AABB
do docelowych pozycji i skal oraz czytelność detali z perspektywy FPP.

## Pomiary nowych GLB

Wymiary: szerokość X × wysokość Y × głębokość Z, metry. Rozmiar pliku w bajtach.

| Model / PNG | X x Y x Z (m) | Tri | Limit tri | Bajty |
|---|---|---:|---:|---:|
| [res_dining_chair](res_dining_chair.png) | 0.62 x 0.96 x 0.66 | 286 | 520 | 18324 |
| [res_lounge_armchair](res_lounge_armchair.png) | 1.12 x 1.02 x 1.08 | 420 | 700 | 25028 |
| [res_freestanding_tub](res_freestanding_tub.png) | 2.20 x 0.85 x 1.20 | 558 | 980 | 32732 |
| [res_whisky_bar_counter](res_whisky_bar_counter.png) | 3.20 x 1.42 x 1.20 | 754 | 1100 | 47468 |
| [res_tactical_gun_cabinet](res_tactical_gun_cabinet.png) | 2.20 x 2.20 x 0.80 | 626 | 1120 | 43572 |
| [res_interrogation_lamp](res_interrogation_lamp.png) | 0.86 x 0.63 x 0.86 | 480 | 620 | 26764 |
| [res_zen_water_wall](res_zen_water_wall.png) | 2.60 x 2.80 x 0.85 | 428 | 760 | 27892 |
| [res_blade_display_pedestal](res_blade_display_pedestal.png) | 1.20 x 1.45 x 1.20 | 368 | 700 | 25244 |
| [res_coat_closet](res_coat_closet.png) | 1.80 x 2.40 x 0.72 | 370 | 760 | 25076 |
| [res_dining_credenza](res_dining_credenza.png) | 3.08 x 1.27 x 0.80 | 768 | 1120 | 45548 |
| [res_drone_charging_dock](res_drone_charging_dock.png) | 1.70 x 1.60 x 1.20 | 520 | 980 | 31312 |
| [res_ev_charger_pillar](res_ev_charger_pillar.png) | 0.90 x 1.60 x 0.57 | 256 | 760 | 20256 |
| [res_floor_drain_grate](res_floor_drain_grate.png) | 1.40 x 0.06 x 1.40 | 344 | 480 | 21256 |
| [res_foyer_console](res_foyer_console.png) | 2.10 x 1.77 x 0.55 | 463 | 760 | 30828 |
| [res_kitchen_cabinet_bank](res_kitchen_cabinet_bank.png) | 3.60 x 2.40 x 0.68 | 622 | 1000 | 39304 |
| [res_luxury_watch_case](res_luxury_watch_case.png) | 1.65 x 1.17 x 0.78 | 668 | 980 | 41352 |
| [res_marble_vanity](res_marble_vanity.png) | 2.80 x 2.10 x 0.75 | 632 | 1100 | 39756 |
| [res_oneway_mirror](res_oneway_mirror.png) | 3.20 x 2.00 x 0.18 | 72 | 240 | 9236 |
| [res_security_console](res_security_console.png) | 3.20 x 1.35 x 1.40 | 548 | 1120 | 36216 |
| [res_tasting_island](res_tasting_island.png) | 3.40 x 1.10 x 1.60 | 956 | 1240 | 54024 |
| [res_wine_barrel_rack](res_wine_barrel_rack.png) | 2.40 x 1.65 x 1.10 | 1058 | 1240 | 50576 |
| [res_side_table](res_side_table.png) | 0.76 x 0.57 x 0.76 | 370 | 700 | 21992 |
| [res_arc_floor_lamp](res_arc_floor_lamp.png) | 1.80 x 2.00 x 0.64 | 724 | 980 | 40252 |
| [res_table_lamp](res_table_lamp.png) | 0.50 x 0.63 x 0.50 | 500 | 760 | 28724 |
| [res_nightstand](res_nightstand.png) | 0.68 x 0.60 x 0.54 | 250 | 480 | 19696 |
| [res_bar_stool](res_bar_stool.png) | 0.56 x 1.04 x 0.58 | 244 | 560 | 16464 |
| [res_tv_acoustic_wall](res_tv_acoustic_wall.png) | 3.60 x 2.70 x 0.55 | 434 | 760 | 29436 |
| [res_ficus_planter](res_ficus_planter.png) | 1.25 x 1.90 x 1.25 | 892 | 1000 | 52672 |
| [res_abstract_sculpture](res_abstract_sculpture.png) | 0.90 x 1.82 x 0.80 | 534 | 1100 | 31604 |
| [res_ottoman](res_ottoman.png) | 0.88 x 0.44 x 0.86 | 308 | 420 | 18864 |
| [res_decor_shelf](res_decor_shelf.png) | 1.90 x 2.22 x 0.50 | 600 | 980 | 37680 |
| **SUMA: 31** | | **16053** | | **989148** |

## Weryfikacja

- `node artifacts/models/residence/validate.mjs --write-bounds` — PASS, 69 GLB i PNG.
- `node artifacts/models/residence/validate.mjs` — PASS: wymiary, położenie podstawy,
  budżety, paleta, materiały, UV, scalanie siatek, brak kamer/świateł/obrazów/animacji,
  istniejące drzwi i przejścia; SHA-256 pierwszych 38 GLB bez zmian.
- `npx vitest run tests/unit/cityModels.test.ts tests/unit/cityModelLoader.test.ts tests/unit/roomModels.test.ts tests/unit/roomBlockModelFit.test.ts`
  — PASS, 4 pliki i 219 testów, także po finalnej aktualizacji obwiedni.
- `npm run typecheck` — PASS, kod wyjścia 0, także po finalnym eksporcie.
- `git diff --check` dla zmienianych plików zakresu — PASS.
- Porównanie `BATCH2` odczytanego przez Python AST z niezależnym
  `batch2-specs.json` — PASS, 31 zgodnych nazw, wymiarów i limitów.
- Odbiór wizualny 31 modeli na arkuszach i powiększenia poprawek — wykonany.
- `graphify query` — narzędzie niedostępne w PATH; przeczytano `GRAPH_REPORT.md`
  i potwierdzono informacje bezpośrednio we wskazanych plikach.
- Pełne `npm run check`, `npm run e2e` oraz odbiór w grze nie były uruchamiane;
  brief wymagał wskazanego zestawu testów, typecheck i walidacji zasobów.
