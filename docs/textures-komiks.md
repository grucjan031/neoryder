# Tekstury komiksowe NEORYDER

Odizolowany pakiet własnych tekstur Neon Noir: gruby czarny tusz, płaskie tony,
kreskowanie i rysowane ślady zużycia. Zawiera 12 powierzchni i 5 nakładek.
**Tekstury nie są jeszcze podpięte do gry.** Są przeznaczone pod wariant stylu
wybierany przez `?look=` na gałęzi `styl-borderlands`. Wartość parametru i integracja
pozostają zadaniem wykonawcy renderera; ten pakiet ich nie definiuje.

## Zawartość i skróty promptów

Wszystkie identyfikatory mają prefiks `komiks_`. Pełne, historyczne prompty
17 obrazów źródłowych są w [catalog.json](../tools/textures/komiks/catalog.json),
w polach `prompt` i `subject`. Tabela opisuje motywy promptów oraz wygląd po
korekcie z rundy 2. Pierwotne prompty przewidywały wspólną granatową paletę;
lokalna obróbka rozdziela teraz materiały kolorystycznie.

| Id bez prefiksu | Wygląd i motyw promptu                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| concrete        | Chłodny grafit, beton lany z pionowymi zaciekami, śladami szalunku i pęknięciami. Ograniczony kontrast dużych jasnych pól. |
| asphalt         | Niemal neutralny ciemny asfalt, jaśniejsze ostre kruszywo, czarne szczeliny; bez oznakowania i kałuż.                      |
| brick           | Przygaszone grafitowo-oliwkowe cegły, przesunięte rzędy, czarna fuga, obtłuczone narożniki; bez czerwieni.                 |
| metal_panel     | Stalowy błękit, prostokątne panele, nity, zadrapania i drobne bursztynowe odpryski.                                        |
| rust_metal      | Grafitowa stal z nieregularnymi bursztynowymi wyspami rdzy, zaciekami i kreskowaniem.                                      |
| corrugated      | Jaśniejsza stalowoniebieska blacha falista, pionowe żebra, czarny tusz w rowkach.                                          |
| plaster         | Prawie neutralny szary tynk, drobniejsze odpryski i jaśniejsza odsłonięta warstwa, niski kontrast rozległych pól.          |
| tiles_wall      | Chłodna stalowoszara ceramika, regularna siatka fug, rysy glazury i wyszczerbienia.                                        |
| wood_planks     | Ciemny brąz w stronę bursztynu, poziome deski, słoje i sęki zaznaczone tuszem.                                             |
| tread_plate     | Ciemniejszy stalowy błękit, ukośne wypukłe ryfle, rysy i kreskowanie w zagłębieniach.                                      |
| roof_tar        | Prawie neutralna czerń grafitowa, pasy papy, prostokątne łaty, zakłady i jaśniejsze kruszywo.                              |
| paving          | Chłodna szara kostka, inkowane fugi i nierówne krawędzie kamieni.                                                          |
| crack           | Rozgałęzione pęknięcie tuszem na przezroczystym tle.                                                                       |
| ink_splatter    | Nieregularny rozbryzg czarnego tuszu.                                                                                      |
| grime_corner    | Brud narożnika i rysowane zacieki.                                                                                         |
| chipped_paint   | Bursztynowe odpryski farby z czarnym konturem.                                                                             |
| hatch_patch     | Krzyżujące się kreski tuszu do nakładania w cieniach.                                                                      |

Wspólne założenia promptów: płaski ortogonalny widok albedo, bez perspektywy,
winiety, tekstu, cyfr, znaków i marek; 2–3 dominujące tony zamiast fotograficznego
cieniowania. Powierzchnie wypełniają kadr i mają ciągłość obu osi. Nakładki
otrzymały zielone tło usuwane przez `green_key`.

## Zasady użycia

- `public/assets/textures/komiks/surfaces/`: WebP RGB, 1024×1024, powtarzanie UV
  w obu osiach. To albedo; tusz i bursztynowe plamy nie są emisją.
- `public/assets/textures/komiks/decals/`: WebP RGBA, 512×512, przezroczyste tło
  i wygładzone brzegi. Szachownica jest wyłącznie elementem podglądu.
- WebP używa jakości 85 i metody 6. Własny [manifest](../public/assets/textures/komiks/manifest.json)
  zawiera `id`, `category`, `path`, `width`, `height`, `dominantColor`, `description`
  oraz `bytes`. Ścieżki są względne wobec katalogu `komiks/`.
- Nie zastępować głównego manifestu tym manifestem. Nie zmieniać istniejącego
  pakietu `surfaces/`. Przy przyszłym podłączeniu używać przestrzeni nazw `komiks_`.
- Czerwień, cyan i magenta są zarezerwowane dla rozgrywki. Chłodne bazy są
  przygaszone; wyjątkiem od chłodnego tonu jest ciemne bursztynowobrązowe drewno.
  Bursztyn rdzy i farby pozostaje akcentem. Zieleń klucza nie może zostać w obrazie.
- Dobór skali UV, mipmap, oświetlenia i czytelności w walce wymaga sprawdzenia po
  integracji wariantu `?look=`. Podgląd bitmap nie zastępuje tej oceny.

## Przebudowa lokalna

Wymagania: Python, Pillow i numpy. Źródła 17 PNG pozostają w
`tools/textures/komiks/raw/`, ignorowanym przez lokalny `.gitignore`. Ich skróty
SHA-256 i historyczne pochodzenie imagegen zapisuje `sources.json`.
Nie są pobierane automatycznie; bez nich nie da się odtworzyć WebP.

```powershell
python -B tools/textures/komiks/build.py build
python -B tools/textures/komiks/build.py validate
python -B tools/textures/komiks/build.py previews
python -B tools/textures/komiks/round2_review.py review
npx prettier --check docs/textures-komiks.md
```

`build` ponownie tworzy WebP, manifest, `sources.json` i `palette-corrections.json`.
Nie wywołuje API. Powierzchnie zszywa po ścieżce najmniejszej różnicy w pasach
nakładania, następnie wyrównuje wąski pas przy przeciwległych krawędziach.
Palety i krzywe jasności per materiał definiuje `SURFACE_PALETTES` w `build.py`.
Beton ma spłaszczony kontrast jasnych pól i pomniejszone fragmenty rysunku.
Tynk składa się z jeszcze drobniejszych wycinków istniejącego PNG, zszytych
z ustalonym seedem; mniejsze ubytki odsłaniają jaśniejszy ton.
Skrypt nie rysuje nowych pęknięć ani detali. Źródłowe PNG pozostają
nietknięte. Nakładki zachowują obróbkę z pierwszej rundy.

Po kompresji skrypt sprawdza zdekodowany WebP i w razie potrzeby neutralizuje
niewielkie sąsiedztwo pikseli o zakazanej barwie, ponownie kodując obraz.
Przekroczenie liczby prób kończy przebudowę błędem; próg palety nie jest obniżany.

`validate` sprawdza dokładnie 17 plików, manifest, wymiary i tryby RGB/RGBA,
bajty i kolory dominujące, przezroczysty pas brzegowy nakładek, ich pełny tusz,
paletę oraz budżet całego publicznego katalogu ≤ 6 000 000 B. Przeciwległe
krawędzie powierzchni mają średnią różnicę kanału `edgeDifference255` ≤ 6
w każdej osi. Reguła zakazanych kolorów: HSV, S ≥ 0.25, V ≥ 0.12,
różnica kanałów ≥ 10/255, alfa ≥ 16; czerwień [0°, 20°) i [345°, 360°),
cyan [165°, 200°], magenta [290°, 345°). Osobno wykrywane są pozostałości zieleni
klucza. Te progi są zachowane z pierwszej rundy.

Raport walidacji: [validation.json](../tools/textures/komiks/validation.json).
Pomiar odcienia i nasycenia przed/po: [round2-report.json](../tools/textures/komiks/round2-report.json).
Średnie S bazy liczone jest z pikseli o V ≥ 0.12, bez bursztynowych akcentów
(drewno jest w całości bazą); raport podaje także średnie S wszystkich pikseli.
Odcień to H średniego RGB bazy. Przy prawie neutralnym szarym ma znaczenie pomocnicze.
`round2_review.py` niezależnie sprawdza limity palet i hashe plików poza zakresem
oraz surowych PNG względem zapisanej kopii początkowej w `versions/`.

`previews` tworzy [arkusz odbioru](../tools/textures/komiks/podglad.png): wszystkie
powierzchnie jako kafle 2×2 i nakładki na szachownicy. W `previews/` są także
pełne kafle 2×2, nakładki na ciemnym tle i `detale-laczen.png` ze środkiem
skrzyżowania czterech kafli. Kontrola wzrokowa powinna objąć oba arkusze:
niska różnica skrajnych pikseli sama nie wyklucza rozpoznawalnych powtórzeń.
