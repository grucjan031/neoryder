# Tekstury uliczek NEORYDER — Neon Noir

Pakiet 86 bitmap (33 z pierwszego pakietu, 17 z drugiego, 24 z trzeciego i 12 dla kryjówki Iskra) wygenerowanych wbudowanym narzędziem imagegen na potrzeby projektu — własne. Nie użyto zdjęć, zewnętrznych bibliotek obrazów ani prawdziwych marek. Źródła PNG są lokalnie w `tools/textures/raw/` i są ignorowane przez Git. Do repo trafiają WebP, manifest, katalog, skrypt i opis promptów.

Kierunek artystyczny pochodzi z briefu właściciela gry dotyczącego ADR 0006. W chwili wykonania tego zadania plik ADR 0006 nie był obecny w tym worktree. Istniejący kontrakt `src/world/dressingSchema.ts` określa ścieżki oraz sposób użycia signs, holo i decals. Pakiet nie zmienia kodu gry ani tego kontraktu.

## Zasady użycia

- `surfaces/`: RGB, 1024×1024, kafelkowanie w obu osiach. `asphalt_puddles` i `grime` są maskami w skali szarości zapisanymi jako RGB. Dla kałuż biel oznacza mokro, czerń sucho; pokrycie około 25%. Brud jest jaśniejszą częścią maski `grime`.
- `signs/` i `holo/`: RGB, czarne tło, rysowanie addytywne. Czerń nie emituje światła; nie należy traktować jej jako koloru tablicy. Hologramy mają wizualną półprzezroczystość dzięki przerwom i liniom światła, bez kanału alfa.
- `decals/` i `labels/`: RGBA, przezroczyste otoczenie oraz wygładzony brzeg. Alfa powstała przez kluczowanie zielonego tła #00ff00; kolor zieleni został usunięty z częściowo przezroczystych brzegów. `decals` mają 512×512, `labels` 512×512 lub 512×256. Szachownica istnieje tylko w podglądzie.
- `screens/`: RGB z czarnym tłem, obróbka black_key jak signs; czerń oznacza brak emisji. Dostępne wymiary to 512×1024, 1024×512 i 512×256.
- Powierzchnie są chłodne: granat, grafit i stalowy błękit. Dozwolone barwy światła: bursztyn #ffae1a, zieleń #6dff4a, fiolet #8a5cff, błękit królewski #3d7bff, ciepła biel #fff1d6. Czerwień, cyan i magenta pozostają zarezerwowane dla elementów rozgrywki.
- WebP: jakość 85, metoda 6. Manifest podaje `id`, `category`, ścieżkę względem katalogu tekstur, wymiary, `dominantColor`, opis i liczbę bajtów. Kolor dominujący to mediana najczęstszego koszyka RGB po odrzuceniu przezroczystości i ciemnego tła; nie jest tintem wymaganym przez renderer.

- `posters/`: nieprzezroczyste RGB (dopuszczalne RGBA z alfą 255), 512×512 lub 1024×512. Bez kafelkowania i wymogu przezroczystych rogów. Centralne przycięcie i Lanczos. Plakat werbunkowy zachowuje ciemne tło; pozostałe źródła: green_key z czyszczeniem brzegów i spłaszczenie na #12161d (baner: #1a1f28).
- `screen_comms` zachowuje całą grafikę dzięki proporcjonalnemu zmniejszeniu i wycentrowaniu z czarnym marginesem minimum 32 px przed black_key (pole `blackMargin` w katalogu).

## Lista tekstur

| Kategoria | Rozmiar | Id plików WebP |
| --- | --- | --- |
| surfaces | 1024×1024 | concrete, asphalt, asphalt_puddles, metal_panel, brick, grime |
| surfaces | 1024×1024 | painted_metal, rust_metal, corrugated, plastic, rubber, wood_planks, tarp, paving, tech_panel, plaster, tiles_wall, tread_plate, roof_tar |
| signs | 512×256 | ramen, hotel, bar_24h, karaoke, sake, open, arrow, cat_cafe, implants, bar_mleczny, kebab, tattoo, arcade, beer, repair |
| signs | 512×512 | pharmacy, noodles, cocktail |
| holo | 512×1024 | holo_android, holo_drink, holo_implant, holo_cat, holo_jellyfish |
| holo | 1024×512 | holo_koi, holo_kurogane, holo_noodles |
| decals | 512×512 | graffiti_tag1, graffiti_tag2, graffiti_resist, poster_torn1, poster_torn2, floor_arrow, floor_hazard, puddle1, puddle2, oil_stain, crack_floor, manhole, tire_marks, graffiti_tag3, graffiti_piece, sticker_cluster, poster_torn3, leak_streak, floor_stop |
| labels | 512×512 | label_warning, label_stencil |
| labels | 512×256 | label_barcode, label_plate |
| screens | 512×1024 | screen_vending, screen_ad |
| screens | 1024×512 | screen_menu, screen_news |
| screens | 512×256 | screen_status |
| screens | 512×512 | screen_map |
| posters | 512×512 | poster_iskra_recruit, poster_koalicja_defaced, banner_iskra |
| posters | 1024×512 | mural_spark |
| signs | 512×256 | iskra, metro, warsztat, sign_bar |
| screens | 512×512 | screen_talents |
| screens | 1024×512 | screen_missions, screen_comms |
| decals | 512×512 | graffiti_iskra |

Pełne ścieżki, opisy, kolory i wielkości plików: [manifest](../public/assets/textures/manifest.json).

## Prompty i odtwarzanie

Pełne rzeczywiście wysłane prompty, w tym odrzucone wersje i powody ponownego generowania, zawiera [README narzędzi](../tools/textures/README.md). Specyfikacje tematów każdego obrazu zawiera [catalog.json](../tools/textures/catalog.json), pole `subject`. Te same identyfikatory łączą źródłowe PNG, prompty oraz wynikowe WebP.

Każdy obraz wygenerowano osobnym wywołaniem imagegen. Skrypt nie rysuje treści tekstur. Obróbka: dopasowanie proporcji przez centralne przycięcie bez rozciągania, skalowanie Lanczos, konwersja masek do szarości, mieszanie 64-pikselowych pasów przeciwnych krawędzi powierzchni, czyszczenie czarnego tła progiem 20/255 i klucz zieleni naklejek. Odtworzenie obróbki wymaga lokalnych źródeł PNG.

```powershell
python tools/textures/process.py build
python tools/textures/process.py validate
python tools/textures/process.py previews
```

Walidator sprawdza dokładny zestaw 86 plików, WebP, wymiary, RGB/RGBA, zgodność manifestu, czarne rogi signs/holo/screens (średnia z czterech kwadratów 24×24 < 3/255), zerową alfę rogów decals/labels oraz maksymalną alfę ≥ 200, skalę szarości masek, pokrycie kałuż 20–30%, przeciwległe krawędzie surfaces (średnia różnica kanału ≤ 6/255) oraz budżet całego katalogu tekstur ≤ 12 000 000 bajtów. Każda powierzchnia ma dodatkowo podgląd 2×2 do oceny wzoru i łączeń wzrokiem. Posters wymagają pełnej nieprzezroczystości oraz zera pikseli z G > 120 i G − max(R, B) > 85 w skali 0–255; nie wymagają kafelkowania ani przezroczystych rogów. Kontrola napisów, marek i kolorów wymaga obejrzenia planszy.

Podgląd zbiorczy: `%TEMP%/neoryder-textures/contact-sheet.png`. Podglądy kafelkowania: `%TEMP%/neoryder-textures/<id>-2x2.png`. Raport wymiarów, bajtów, rogów i krawędzi: `%TEMP%/neoryder-textures/validation.json`.

Do ręcznego review: obejrzeć podglądy 2×2 pod kątem łączeń i widocznego rytmu powtórzeń, sprawdzić pisownię neonów i reklam, obejrzeć brzegi naklejek na ciemnym podłożu. Ocenę czytelności podczas walki należy wykonać po podłączeniu pakietu przez wykonawcę renderera.
