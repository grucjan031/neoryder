# Pakiet grafik HUD

Pakiet zawiera 18 wygenerowanych osobno grafik do interfejsu NEORYDER. WebP z alfą trafiają do `public/assets/ui/hud/`; `manifest.json` opisuje identyfikator, plik, rozmiar, przeznaczenie i sugerowany `border-image-slice` w pikselach. Ramki przeznaczone są do `border-image` albo tła, ikony do `<img>` z tintowaniem CSS, a `bar_segments` do maski lub blendowania.

Styl to ostry, wektorowy Neon Noir: cienkie linie, ścięte narożniki, wsporniki, segmenty, techniczne znaczniki i ograniczona poświata. Cyan oznacza elementy gracza, magenta Rezonans, bursztyn akcenty, a czerwień wyłącznie zagrożenie. Grafiki generowano na jednolitym zielonym tle #00ff00 i wycinano, czyszcząc kolor klucza z półprzezroczystych krawędzi. Nie należy umieszczać tekstu w bitmapach; tekst UI nakłada aplikacja.

## Odtworzenie

Zależności: Python 3, Pillow, NumPy. Zachowaj oryginalne wygenerowane PNG poza repozytorium i umieść kopie jako `tools/hud/raw/<id>.png`. Pełne skróty promptów i wymagane rozmiary są w `tools/hud/catalog.json`.

```powershell
python tools/hud/process.py build
python tools/hud/process.py validate
python tools/hud/process.py previews
```

Obróbka: kluczowanie zieleni z odbarwieniem krawędzi, skalowanie Lanczos do wymiarów docelowych i WebP z alfą. Walidator sprawdza kompletność manifestu, dokładne rozmiary, przezroczyste narożniki, resztki dominującej zieleni i łączny limit 3 000 000 bajtów. Plansza kontrolna ma ciemne tło i trafia do `%TEMP%/neoryder-hud/contact-sheet.png`.

## Kontrola ręczna

Otwórz planszę kontaktową i sprawdź czytelność oraz spójność zestawu, ostrość konturów, brak liter/cyfr i resztek zieleni. Każdy obraz można wygenerować ponownie maksymalnie dwa razy; prompt końcowy zapisany jest w katalogu. `frame_panel` ma proste środkowe odcinki krawędzi do 9-slice. Wartości slice są sugestią i mogą wymagać drobnej korekty po wdrożeniu w CSS.
