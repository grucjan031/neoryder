# Narzędzia i prompty tekstur NEORYDER

Wszystkie 86 obrazów (33 z pierwszego pakietu, 17 z drugiego, 24 z trzeciego i 12 dla kryjówki Iskra) utworzono osobnymi wywołaniami wbudowanego narzędzia imagegen. Pierwszy pakiet: 2026-11-14; drugi i trzeci pakiet: 2026-11-15. Licencja: wygenerowane na potrzeby projektu — własne. Bez zewnętrznych obrazów i prawdziwych marek. Skrypt obrabia bitmapy, nie rysuje ich treści.

## Odtworzenie

Wymagany Python 3, Pillow i numpy (sprawdzone: Pillow 11.1.0, numpy 2.2.2). W razie braku: `python -m pip install --user Pillow numpy`.

1. Wygeneruj każdą bitmapę poniższym promptem wbudowanym narzędziem imagegen, z `transparent_background=false`. Dla decals tło jest celowo zielone do późniejszego kluczowania.
2. Skopiuj odpowiedni plik z `%USERPROFILE%/.codex/generated_images/` do `tools/textures/raw/<id>.png`, pozostawiając oryginał. Katalog raw jest ignorowany przez Git; nie jest częścią dystrybucji.
3. Uruchom poniższe komendy z katalogu repo. Ponowne generowanie obrazu może dać inny wynik; obróbka tych samych PNG jest deterministyczna w podanym środowisku.

```powershell
python tools/textures/process.py build
python tools/textures/process.py validate
python tools/textures/process.py previews
```

Dla pojedynczych źródeł: `python tools/textures/process.py build --ids concrete hotel`. Manifest odbudowuje się ze wszystkich istniejących wyników; pełna walidacja zawsze wymaga wszystkich 86 plików.

Algorytmy i zasady użycia opisuje [docs/textures.md](../../docs/textures.md). Wyniki trafiają do `public/assets/textures/<category>/<id>.webp`. Podglądy i raport trafiają do `%TEMP%/neoryder-textures/`: `contact-sheet.png`, `<id>-2x2.png`, `validation.json`. Font podpisów podglądu: systemowy Arial z `C:/Windows/Fonts/arial.ttf`.

## Kontrola i ponowne generowanie

Kontrola pierwszego pakietu: obejrzano źródła i przetworzone wyniki, sprawdzono napisy, marki i paletę, powierzchnie także w układzie 2×2. Raz ponowiono: `cat_cafe`, `holo_android`, `holo_drink`, `holo_koi`, `holo_implant`, `holo_noodles`, `floor_hazard`. Przyczyna: mieszanie kolorowych poświat tworzyło różowe/czerwonawe obwódki. Wersje końcowe hologramów i CAFE mają jedną dominującą barwę światła; pasy ostrzegawcze ograniczono do bursztynu i czerni. Pozostałe 26 obrazów zaakceptowano po pierwszym generowaniu. Nie przekroczono dwóch ponowień na obraz. Odrzucone wersje nie są eksportowane.

## Pełne prompty wysłane do generatora

### concrete — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/concrete.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture: concrete wall panels, fine pores, subtle vertical rain stains and dirt, neutral cool blue gray #2a3344 to #56627a. Flat orthographic head-on, even lighting, stylized readable painted shapes, no photorealism, no perspective, no objects, no text, no borders, no glow. Edges must tile seamlessly. No red, cyan or magenta. Fill entire square.
```

### asphalt — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/asphalt.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, asphalt. Dark asphalt, fine aggregate, small cracks and repaired patches. Cool charcoal blue gray, no reflections, no markings. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### asphalt_puddles — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/asphalt_puddles.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, asphalt_puddles. Grayscale puddle mask: pure black dry ground, irregular organic WHITE puddle shapes cover approximately 25 percent, softly feathered boundaries. Top down flat mask only, NO reflection, NO shading or objects. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### metal_panel — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/metal_panel.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, metal_panel. Dark cool gray painted sheet metal panels, small rivets, scratches and subtle weathering. Readable stylized forms. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### brick — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/brick.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, brick. Old dark cool blue gray bricks with mortar, slightly damp. Staggered running bond, restrained texture. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### grime — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/grime.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, grime. Grayscale dirt overlay texture, vertical dripping rain streaks, stains and dirt patches. Light gray dirt on dark gray ground. No wall structure. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### ramen — signs, 512×256

Plik: `public/assets/textures/signs/ramen.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE isolated game neon sign texture. Amber #ffae1a neon tubes, exact text ラーメン and a simple bowl icon. No other text. Stylized glowing glass neon tubes with soft restrained halo, no physical signboard or wires. Wide 2:1 composition, centered with generous 12% pure BLACK margin on all sides. Background EXACT pure black #000000 everywhere outside neon and its small halo. Palette only amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, scene, wall, perspective, frame or additional text. Exact spelling is critical.
```

### hotel — signs, 512×256

Plik: `public/assets/textures/signs/hotel.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE isolated game neon sign texture. Violet #8a5cff neon tubes spelling exactly HOTEL. No other text. Stylized glowing glass neon tubes with soft restrained halo, no physical signboard or wires. Wide 2:1 composition, centered with generous 12% pure BLACK margin on all sides. Background EXACT pure black #000000 everywhere outside neon and its small halo. Palette only amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, scene, wall, perspective, frame or additional text. Exact spelling is critical.
```

### bar_24h — signs, 512×256

Plik: `public/assets/textures/signs/bar_24h.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE isolated game neon sign texture. Amber #ffae1a neon tubes spelling exactly BAR 24H. No other text. Stylized glowing glass neon tubes with soft restrained halo, no physical signboard or wires. Wide 2:1 composition, centered with generous 12% pure BLACK margin on all sides. Background EXACT pure black #000000 everywhere outside neon and its small halo. Palette only amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, scene, wall, perspective, frame or additional text. Exact spelling is critical.
```

### pharmacy — signs, 512×512

Plik: `public/assets/textures/signs/pharmacy.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE isolated game neon sign texture. Green #6dff4a neon tubes forming a simple equal arm pharmacy cross icon. No text. Stylized glowing glass neon tubes with soft restrained halo, no physical signboard or wires. Wide 2:1 composition, but square canvas for icon, centered with generous 12% pure BLACK margin on all sides. Background EXACT pure black #000000 everywhere outside neon and its small halo. Palette only amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, scene, wall, perspective, frame or additional text. Exact spelling is critical.
```

### noodles — signs, 512×512

Plik: `public/assets/textures/signs/noodles.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE isolated game neon sign texture. Warm white #fff1d6 and amber #ffae1a neon tubes forming a noodle bowl and chopsticks icon. No text. Stylized glowing glass neon tubes with soft restrained halo, no physical signboard or wires. Wide 2:1 composition, but square canvas for icon, centered with generous 12% pure BLACK margin on all sides. Background EXACT pure black #000000 everywhere outside neon and its small halo. Palette only amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, scene, wall, perspective, frame or additional text. Exact spelling is critical.
```

### karaoke — signs, 512×256

Plik: `public/assets/textures/signs/karaoke.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE isolated game neon sign texture. Violet #8a5cff neon tubes spelling exactly KARAOKE. No other text. Stylized glowing glass neon tubes with soft restrained halo, no physical signboard or wires. Wide 2:1 composition, centered with generous 12% pure BLACK margin on all sides. Background EXACT pure black #000000 everywhere outside neon and its small halo. Palette only amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, scene, wall, perspective, frame or additional text. Exact spelling is critical.
```

### sake — signs, 512×256

Plik: `public/assets/textures/signs/sake.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE isolated game neon sign texture. Amber #ffae1a neon tubes forming exactly one Japanese character 酒. No other text. Stylized glowing glass neon tubes with soft restrained halo, no physical signboard or wires. Wide 2:1 composition, centered with generous 12% pure BLACK margin on all sides. Background EXACT pure black #000000 everywhere outside neon and its small halo. Palette only amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, scene, wall, perspective, frame or additional text. Exact spelling is critical.
```

### open — signs, 512×256

Plik: `public/assets/textures/signs/open.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE isolated game neon sign texture. Green #6dff4a neon tubes spelling exactly OPEN. No other text. Stylized glowing glass neon tubes with soft restrained halo, no physical signboard or wires. Wide 2:1 composition, centered with generous 12% pure BLACK margin on all sides. Background EXACT pure black #000000 everywhere outside neon and its small halo. Palette only amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, scene, wall, perspective, frame or additional text. Exact spelling is critical.
```

### arrow — signs, 512×256

Plik: `public/assets/textures/signs/arrow.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE isolated game neon sign texture. Royal blue #3d7bff neon tubes forming one arrow pointing RIGHT. No text. Stylized glowing glass neon tubes with soft restrained halo, no physical signboard or wires. Wide 2:1 composition, centered with generous 12% pure BLACK margin on all sides. Background EXACT pure black #000000 everywhere outside neon and its small halo. Palette only amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, scene, wall, perspective, frame or additional text. Exact spelling is critical.
```

### cat_cafe — signs, 512×256

Plik: `public/assets/textures/signs/cat_cafe.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE horizontal 2:1 neon sign GAME TEXTURE. Glowing glass neon tubes form a simple cat face icon beside exact text CAFE. No other text. CRITICAL: MONOCHROME LIGHT ONLY warm white #fff1d6, with dimmer versions of exactly the same hue. NO OTHER COLORS, NO rainbow accents or color fringing. Highlights keep same hue or neutral white. Pure black #000000 background with at least 12% pure black empty margin on each side. No panel, environment, projector, wall, perspective, real brands, watermark, additional text. Stylized readable shapes, not photorealistic. Absolutely no red, pink, cyan, turquoise, magenta. Exact spelling critical.
```

Odrzucony prompt pierwszej wersji (Odrzucono kolorowe obwódki i mieszanie poświat wpadające w róż/czerwień; ponowiono z pojedynczą barwą światła.):

```text
Use case: stylized-concept. ONE isolated game neon sign texture. Warm white #fff1d6 neon tubes forming a cat face icon beside exact text CAFE. No other text. Stylized glowing glass neon tubes with soft restrained halo, no physical signboard or wires. Wide 2:1 composition, centered with generous 12% pure BLACK margin on all sides. Background EXACT pure black #000000 everywhere outside neon and its small halo. Palette only amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, scene, wall, perspective, frame or additional text. Exact spelling is critical.
```

### implants — signs, 512×256

Plik: `public/assets/textures/signs/implants.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE isolated game neon sign texture. Royal blue #3d7bff neon tubes spelling exactly IMPLANTY. No other text. Stylized glowing glass neon tubes with soft restrained halo, no physical signboard or wires. Wide 2:1 composition, centered with generous 12% pure BLACK margin on all sides. Background EXACT pure black #000000 everywhere outside neon and its small halo. Palette only amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, scene, wall, perspective, frame or additional text. Exact spelling is critical.
```

### bar_mleczny — signs, 512×256

Plik: `public/assets/textures/signs/bar_mleczny.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE isolated game neon sign texture. Amber #ffae1a neon tubes spelling exactly BAR MLECZNY, one or two lines. No other text. Stylized glowing glass neon tubes with soft restrained halo, no physical signboard or wires. Wide 2:1 composition, centered with generous 12% pure BLACK margin on all sides. Background EXACT pure black #000000 everywhere outside neon and its small halo. Palette only amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, scene, wall, perspective, frame or additional text. Exact spelling is critical.
```

### holo_android — holo, 512×1024

Plik: `public/assets/textures/holo/holo_android.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE vertical 1:2 holographic advertisement, translucent light scanlines, airy black gaps GAME TEXTURE. A luminous fictional android face in profile made of violet #8a5cff light wire contours. No text. CRITICAL: MONOCHROME LIGHT ONLY violet #8a5cff, with dimmer versions of exactly the same hue. NO OTHER COLORS, NO rainbow accents or color fringing. Highlights keep same hue or neutral white. Pure black #000000 background with at least 12% pure black empty margin on each side. No panel, environment, projector, wall, perspective, real brands, watermark, additional text. Stylized readable shapes, not photorealistic. Absolutely no red, pink, cyan, turquoise, magenta. Exact spelling critical.
```

Odrzucony prompt pierwszej wersji (Odrzucono kolorowe obwódki i mieszanie poświat wpadające w róż/czerwień; ponowiono z pojedynczą barwą światła.):

```text
Use case: stylized-concept. ONE vertical 1:2 holographic advertising texture for a near future noir game. Stylized fictional android face in profile, luminous violet and royal blue wire contours, no real person, no text. Semi transparent luminous stylized illustration made from light lines, small scan lines and airy internal black gaps. Beautiful readable graphic, not photorealistic. Centered fully within canvas with 12% pure BLACK safe margin, background exactly #000000, no scene, no projector, no panel rectangle. Palette ONLY amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text. Exact spelling critical.
```

### holo_drink — holo, 512×1024

Plik: `public/assets/textures/holo/holo_drink.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE vertical 1:2 holographic advertisement, translucent light scanlines, airy black gaps GAME TEXTURE. A floating luminous beverage can made of amber #ffae1a light contours, exact text VOLTA. No other text. CRITICAL: MONOCHROME LIGHT ONLY amber #ffae1a, with dimmer versions of exactly the same hue. NO OTHER COLORS, NO rainbow accents or color fringing. Highlights keep same hue or neutral white. Pure black #000000 background with at least 12% pure black empty margin on each side. No panel, environment, projector, wall, perspective, real brands, watermark, additional text. Stylized readable shapes, not photorealistic. Absolutely no red, pink, cyan, turquoise, magenta. Exact spelling critical.
```

Odrzucony prompt pierwszej wersji (Odrzucono kolorowe obwódki i mieszanie poświat wpadające w róż/czerwień; ponowiono z pojedynczą barwą światła.):

```text
Use case: stylized-concept. ONE vertical 1:2 holographic advertising texture for a near future noir game. Floating near future beverage can, amber and warm white luminous contours, exact brand text VOLTA. No other text or real brands. Semi transparent luminous stylized illustration made from light lines, small scan lines and airy internal black gaps. Beautiful readable graphic, not photorealistic. Centered fully within canvas with 12% pure BLACK safe margin, background exactly #000000, no scene, no projector, no panel rectangle. Palette ONLY amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text. Exact spelling critical.
```

### holo_koi — holo, 1024×512

Plik: `public/assets/textures/holo/holo_koi.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE horizontal 2:1 holographic advertisement, translucent light scanlines, airy black gaps GAME TEXTURE. One graceful koi swimming in motion made of royal blue #3d7bff luminous scales, flowing fins and light trails. No text. CRITICAL: MONOCHROME LIGHT ONLY royal blue #3d7bff, with dimmer versions of exactly the same hue. NO OTHER COLORS, NO rainbow accents or color fringing. Highlights keep same hue or neutral white. Pure black #000000 background with at least 12% pure black empty margin on each side. No panel, environment, projector, wall, perspective, real brands, watermark, additional text. Stylized readable shapes, not photorealistic. Absolutely no red, pink, cyan, turquoise, magenta. Exact spelling critical.
```

Odrzucony prompt pierwszej wersji (Odrzucono kolorowe obwódki i mieszanie poświat wpadające w róż/czerwień; ponowiono z pojedynczą barwą światła.):

```text
Use case: stylized-concept. ONE horizontal 2:1 holographic advertising texture for a near future noir game. One graceful koi fish swimming, warm white and amber luminous scales, violet flowing fins and motion trails. No red fish markings. No text. Semi transparent luminous stylized illustration made from light lines, small scan lines and airy internal black gaps. Beautiful readable graphic, not photorealistic. Centered fully within canvas with 12% pure BLACK safe margin, background exactly #000000, no scene, no projector, no panel rectangle. Palette ONLY amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text. Exact spelling critical.
```

### holo_kurogane — holo, 1024×512

Plik: `public/assets/textures/holo/holo_kurogane.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE horizontal 2:1 holographic advertising texture for a near future noir game. Fictional corporation logo: geometric angular emblem beside exact text KUROGANE ARMS. Royal blue and warm white luminous lines. No other text. Semi transparent luminous stylized illustration made from light lines, small scan lines and airy internal black gaps. Beautiful readable graphic, not photorealistic. Centered fully within canvas with 12% pure BLACK safe margin, background exactly #000000, no scene, no projector, no panel rectangle. Palette ONLY amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text. Exact spelling critical.
```

### holo_noodles — holo, 1024×512

Plik: `public/assets/textures/holo/holo_noodles.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE horizontal 2:1 holographic game advertisement on PURE BLACK #000000. A luminous noodle bowl and chopsticks above exact text SYNTH NOODLES. All light exclusively GREEN #6dff4a, neutral white cores allowed; black airy gaps and scanlines. Stylized beautiful near future graphic. Centered fully with 12% pure black margin, no frame, scene, projector or panel. NO red, cyan, magenta, pink, amber, violet or any other hue. NO rainbow or color fringing. Exact spelling, no other text, real brands or watermark.
```

Odrzucony prompt pierwszej wersji (Pomocnicza kontrola HSV wskazała resztkowe różowe/czerwonawe piksele w mieszanych akcentach; ponowiono z ograniczoną paletą.):

```text
Use case: stylized-concept. ONE horizontal 2:1 holographic advertising texture for a near future noir game. Luminous noodle bowl and chopsticks advertisement, exact text SYNTH NOODLES, amber and green with warm white. No other text. Semi transparent luminous stylized illustration made from light lines, small scan lines and airy internal black gaps. Beautiful readable graphic, not photorealistic. Centered fully within canvas with 12% pure BLACK safe margin, background exactly #000000, no scene, no projector, no panel rectangle. Palette ONLY amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text. Exact spelling critical.
```

### holo_implant — holo, 512×1024

Plik: `public/assets/textures/holo/holo_implant.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE vertical 1:2 holographic advertisement, translucent light scanlines, airy black gaps GAME TEXTURE. One cybernetic arm with implant, technical glowing contours, exact text IMPLANTY NA RATY on three readable lines. No other text. CRITICAL: MONOCHROME LIGHT ONLY royal blue #3d7bff, with dimmer versions of exactly the same hue. NO OTHER COLORS, NO rainbow accents or color fringing. Highlights keep same hue or neutral white. Pure black #000000 background with at least 12% pure black empty margin on each side. No panel, environment, projector, wall, perspective, real brands, watermark, additional text. Stylized readable shapes, not photorealistic. Absolutely no red, pink, cyan, turquoise, magenta. Exact spelling critical.
```

Odrzucony prompt pierwszej wersji (Odrzucono kolorowe obwódki i mieszanie poświat wpadające w róż/czerwień; ponowiono z pojedynczą barwą światła.):

```text
Use case: stylized-concept. ONE vertical 1:2 holographic advertising texture for a near future noir game. Stylized cybernetic arm with implant, royal blue and violet glowing technical contours, exact Polish text IMPLANTY NA RATY in three readable lines. No other text. Semi transparent luminous stylized illustration made from light lines, small scan lines and airy internal black gaps. Beautiful readable graphic, not photorealistic. Centered fully within canvas with 12% pure BLACK safe margin, background exactly #000000, no scene, no projector, no panel rectangle. Palette ONLY amber #ffae1a, green #6dff4a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6 as specified. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text. Exact spelling critical.
```

### graffiti_tag1 — decals, 512×512

Plik: `public/assets/textures/decals/graffiti_tag1.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE square game decal bitmap. Fictional graffiti tag spelling VEX, amber spray paint with dark charcoal outline, expressive angular strokes and a few drips. Stylized painted near future noir art, flat orthographic view. Isolated object entirely inside canvas, generous 15% empty margin on all four sides. Background must be UNIFORM PURE CHROMA GREEN #00ff00, completely flat, no texture, no gradient, no lighting or shadow on background. Green is only the removable background, never in the object itself. Object colors allowed: amber #ffae1a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6, navy and charcoal. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text, perspective or environment. Exact spelling critical.
```

### graffiti_tag2 — decals, 512×512

Plik: `public/assets/textures/decals/graffiti_tag2.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE square game decal bitmap. Fictional graffiti tag spelling NURA, violet spray paint with warm white highlights, rounded energetic letters and a few drips. Stylized painted near future noir art, flat orthographic view. Isolated object entirely inside canvas, generous 15% empty margin on all four sides. Background must be UNIFORM PURE CHROMA GREEN #00ff00, completely flat, no texture, no gradient, no lighting or shadow on background. Green is only the removable background, never in the object itself. Object colors allowed: amber #ffae1a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6, navy and charcoal. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text, perspective or environment. Exact spelling critical.
```

### graffiti_resist — decals, 512×512

Plik: `public/assets/textures/decals/graffiti_resist.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE square game decal bitmap. Resistance stencil graffiti: a stylized BROKEN CHAIN LINK above exact Polish text OPÓR (accent on first O), warm white paint, worn edges. No other text. Stylized painted near future noir art, flat orthographic view. Isolated object entirely inside canvas, generous 15% empty margin on all four sides. Background must be UNIFORM PURE CHROMA GREEN #00ff00, completely flat, no texture, no gradient, no lighting or shadow on background. Green is only the removable background, never in the object itself. Object colors allowed: amber #ffae1a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6, navy and charcoal. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text, perspective or environment. Exact spelling critical.
```

### poster_torn1 — decals, 512×512

Plik: `public/assets/textures/decals/poster_torn1.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE square game decal bitmap. Single torn fictional music poster with jagged paper edges, violet and warm white ink, exact text NOCNY RYTM, abstract geometric waveform, worn paper. No other text or real brands. Stylized painted near future noir art, flat orthographic view. Isolated object entirely inside canvas, generous 15% empty margin on all four sides. Background must be UNIFORM PURE CHROMA GREEN #00ff00, completely flat, no texture, no gradient, no lighting or shadow on background. Green is only the removable background, never in the object itself. Object colors allowed: amber #ffae1a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6, navy and charcoal. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text, perspective or environment. Exact spelling critical.
```

### poster_torn2 — decals, 512×512

Plik: `public/assets/textures/decals/poster_torn2.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE square game decal bitmap. Single torn fictional city poster with irregular paper edges, amber and charcoal ink, exact text JUTRO, geometric city skyline, weathered warm white paper. No other text or real brands. Stylized painted near future noir art, flat orthographic view. Isolated object entirely inside canvas, generous 15% empty margin on all four sides. Background must be UNIFORM PURE CHROMA GREEN #00ff00, completely flat, no texture, no gradient, no lighting or shadow on background. Green is only the removable background, never in the object itself. Object colors allowed: amber #ffae1a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6, navy and charcoal. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text, perspective or environment. Exact spelling critical.
```

### floor_arrow — decals, 512×512

Plik: `public/assets/textures/decals/floor_arrow.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE square game decal bitmap. One heavily worn warm white road marking arrow pointing UP, flat top down, chipped paint with missing flecks exposing the green background, no ground, no shadow. Stylized painted near future noir art, flat orthographic view. Isolated object entirely inside canvas, generous 15% empty margin on all four sides. Background must be UNIFORM PURE CHROMA GREEN #00ff00, completely flat, no texture, no gradient, no lighting or shadow on background. Green is only the removable background, never in the object itself. Object colors allowed: amber #ffae1a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6, navy and charcoal. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text, perspective or environment. Exact spelling critical.
```

### floor_hazard — decals, 512×512

Plik: `public/assets/textures/decals/floor_hazard.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE square game decal. Centered rectangular patch of heavily worn diagonal hazard stripes, ONLY amber #ffae1a and pure BLACK alternate bands. Chipped paint, scraped patches and small missing flecks. Flat orthographic top down, no perspective, no ground, no shadow. Uniform PURE CHROMA GREEN #00ff00 background around rectangle and visible through worn holes, 15% empty green margin on all four sides. No other colors whatsoever: NO blue, violet, red, cyan, pink, magenta, white, rainbow accents. No text or brands. Stylized painted texture. Green only background for removal.
```

Odrzucony prompt pierwszej wersji (Pomocnicza kontrola HSV wskazała resztkowe różowe/czerwonawe piksele w mieszanych akcentach; ponowiono z ograniczoną paletą.):

```text
Use case: stylized-concept. ONE square game decal bitmap. A rectangular patch of worn diagonal hazard road stripes, amber #ffae1a and black alternating bands, chipped paint exposing green background, top down, no ground, no shadow. Stylized painted near future noir art, flat orthographic view. Isolated object entirely inside canvas, generous 15% empty margin on all four sides. Background must be UNIFORM PURE CHROMA GREEN #00ff00, completely flat, no texture, no gradient, no lighting or shadow on background. Green is only the removable background, never in the object itself. Object colors allowed: amber #ffae1a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6, navy and charcoal. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text, perspective or environment. Exact spelling critical.
```

### puddle1 — decals, 512×512

Plik: `public/assets/textures/decals/puddle1.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE square game decal bitmap. One irregular organic wide puddle shape, dark glossy navy blue water with subtle steel blue highlights and ripples, top down flat isolated silhouette, no ground, no shadow, no reflection of green. Stylized painted near future noir art, flat orthographic view. Isolated object entirely inside canvas, generous 15% empty margin on all four sides. Background must be UNIFORM PURE CHROMA GREEN #00ff00, completely flat, no texture, no gradient, no lighting or shadow on background. Green is only the removable background, never in the object itself. Object colors allowed: amber #ffae1a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6, navy and charcoal. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text, perspective or environment. Exact spelling critical.
```

### puddle2 — decals, 512×512

Plik: `public/assets/textures/decals/puddle2.webp`.

Prompt wersji końcowej:

```text
Use case: stylized-concept. ONE square game decal bitmap. One elongated asymmetric puddle shape with small lobes, dark glossy charcoal blue water with subtle violet reflected highlights, top down flat isolated silhouette, no ground, no shadow, no reflection of green. Stylized painted near future noir art, flat orthographic view. Isolated object entirely inside canvas, generous 15% empty margin on all four sides. Background must be UNIFORM PURE CHROMA GREEN #00ff00, completely flat, no texture, no gradient, no lighting or shadow on background. Green is only the removable background, never in the object itself. Object colors allowed: amber #ffae1a, violet #8a5cff, royal blue #3d7bff, warm white #fff1d6, navy and charcoal. NO red, cyan, turquoise, magenta, pink, real brands, watermark, extra text, perspective or environment. Exact spelling critical.
```

## Drugi pakiet — 17 tekstur (2026-11-15)

Każdy obraz poniżej wygenerowano osobnym wywołaniem imagegen. Źródła znajdują się lokalnie w `tools/textures/raw/`; build uruchomiono wyłącznie z `--ids` nowych tekstur. W razie odrzucenia jakości wizualnej wolno ponowić generowanie maksymalnie dwa razy na obraz; powód i finalny prompt należy zapisać tutaj.

### surfaces — 1024×1024

```text
### painted_metal - surfaces, 1024x1024

```text
Use case: stylized-concept. Generate ONE square seamless tileable game albedo texture: painted metal wall, neutral low-saturation medium gray tintable surface, dark steel showing through chipped paint, scratches, small dents, subtle vertical rain streaks. Flat orthographic head-on, even lighting, stylized readable painted shapes, not photorealistic, no perspective, no text, no objects, no borders. Fill entire square. Opposite edges must tile seamlessly. No red, cyan, magenta, rust orange, or colored lights.
```
```text
### rust_metal - surfaces, 1024x1024

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture: dark steel with subdued brown-gray corrosion #4a3a2c on dark steel #2b3038, pits and downward drips. Flat orthographic head-on, even lighting, stylized readable painted shapes, not photorealistic, no perspective, no text, no objects. Fill square; edges tile seamlessly. Corrosion is brown-gray, never red or orange. No cyan or magenta.
```
```text
### corrugated - surfaces, 1024x1024

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture: corrugated steel sheet with exactly 16 evenly spaced vertical ribs across the tile, dark dirt in grooves, tiny dents, cool steel gray #3b4454 to #5d6879. Ribs must continue seamlessly at left and right edges. Flat orthographic head-on, even lighting, stylized readable shapes, not photorealistic, no perspective, text, objects. No red, cyan, magenta.
```
```text
### plastic - surfaces, 1024x1024

```text
Use case: stylized-concept. Generate ONE square seamless tileable game albedo texture: matte injection-molded plastic, neutral low-saturation medium gray tintable surface, fine grain, scuffs, scratches and slight grime. Flat orthographic head-on, even lighting, stylized readable shapes, not photorealistic, no perspective, no text, objects, borders. Opposite edges tile seamlessly. No red, cyan, magenta.
```
```text
### rubber - surfaces, 1024x1024

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture: black rubber #1d2027 to #34383f, fine grain, worn smooth patches and dust. Flat orthographic head-on, even lighting, stylized readable shapes, not photorealistic, no perspective, no text, objects. Opposite edges tile seamlessly. No red, cyan, magenta.
```
```text
### wood_planks - surfaces, 1024x1024

```text
Use case: stylized-concept. Generate ONE square seamless tileable game albedo texture: exactly 4 horizontal weathered wood planks across tile height, muted gray-brown low saturation neutral medium gray tintable appearance, visible grain, nail holes, dark gaps. Plank pattern must tile seamlessly on all edges. Flat orthographic head-on, even lighting, stylized readable shapes, not photorealistic, no perspective, no text, objects. No orange/rust, red, cyan, magenta.
```
```text
### tarp - surfaces, 1024x1024

```text
Use case: stylized-concept. Generate ONE square seamless tileable game albedo texture: thick woven tarp, neutral low-saturation medium gray tintable surface, visible weave, soft folds and water streaks. Flat orthographic head-on, even lighting, stylized readable shapes, not photorealistic, no perspective, no text, objects. Opposite edges tile seamlessly. No red, cyan, magenta.
```
```text
### paving - surfaces, 1024x1024

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture: 4 by 4 square sidewalk paving slabs, dark grout, small chips and cracks, darker wet edges, cool dark blue-gray #3a4252 to #59637a. Grid aligns seamlessly at all tile edges. Flat orthographic head-on, even lighting, stylized painted shapes, not photorealistic, no perspective, no text, objects. No red, cyan, magenta.
```
```text
### tech_panel - surfaces, 1024x1024

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture: machine casing, grid of rectangular panels in varied sizes, screws at corners, a few small ventilation slits, scratches, cool gray #3f4859 to #66718a. Flat orthographic head-on, even lighting, stylized readable shapes, not photorealistic, no perspective, no text, objects. Opposite edges tile seamlessly. No red, cyan, magenta.
```
```text
### plaster - surfaces, 1024x1024

```text
Use case: stylized-concept. Generate ONE square seamless tileable game albedo texture: old plaster, peeling paint, hairline cracks, water streaks, neutral low-saturation medium gray tintable surface. Flat orthographic head-on, even lighting, stylized readable shapes, not photorealistic, no perspective, no text, objects. Opposite edges tile seamlessly. No red, cyan, magenta.
```

### labels — chroma green background #00ff00

```text
### label_warning - labels, 512x512

```text
Use case: stylized-concept. ONE isolated worn amber #ffae1a warning sticker: rounded triangle with black lightning bolt, scratched edges, no text. Center on a uniform pure green #00ff00 background for later chroma keying; green must not appear on sticker. Flat orthographic, even light, stylized readable shapes, no perspective, no shadow, no watermark. Square composition.
```
```text
### label_stencil - labels, 512x512

```text
Use case: stylized-concept. ONE isolated spray-painted stencil marking, exact characters “07” in warm white #fff1d6, stencil typeface with bridges, slight overspray. Center on a uniform pure green #00ff00 background for later chroma keying; green must not appear on the marking. Flat orthographic, even light, no other text, no perspective, no shadow, no watermark. Square composition.
```
```text
### label_barcode - labels, 512x256

```text
Use case: stylized-concept. ONE isolated small rectangular inspection sticker, warm off-white, barcode and empty check boxes, no readable words, one peeling corner. Center on uniform pure green #00ff00 background for later chroma keying; green must not appear on sticker. Flat orthographic, even light, no perspective, no shadow, no watermark. Wide 2:1 composition.
```
```text
### label_plate - labels, 512x256

```text
Use case: stylized-concept. ONE isolated futuristic license plate, dark blue-gray plate #2a3344, raised warm white characters exactly “NR 0471”, thin border, screw holes, grime. Center on uniform pure green #00ff00 background for later chroma keying; green must not appear on plate. Flat orthographic, even light, no other text, no perspective, no shadow, no watermark. Wide 2:1 composition.
```

### screens — black background

```text
### screen_vending - screens, 512x1024

```text
Use case: stylized-concept. ONE flat UV texture for a vertical vending machine SCREEN ONLY, not a physical machine. Entire canvas background must be perfectly uniform pure black #000000 in every pixel outside the luminous graphics; NO blue rectangle, NO panel, NO frame, NO machine body. Black background is no emission. On black, draw a tidy 3 column by 4 row grid of small stylized cans and bottles using only royal blue #3d7bff and warm white #fff1d6; thin royal blue grid lines; tiny price dots only. Nothing else. Flat orthographic head-on, even lighting, stylized readable graphic, no perspective, no text or words. No red, cyan, magenta, additional colors, environment or watermark.
```
```text
### screen_menu - screens, 1024x512

```text
Use case: stylized-concept. ONE isolated horizontal noodle stall menu display graphic on pure black #000000 background, black means no emission. Three bowl pictograms with numbers exactly “12”, “15”, “18”, amber #ffae1a and warm white #fff1d6, no other words or numbers. Flat orthographic, even illumination, crisp readable shapes, no perspective, no frame, no other colors, no red/cyan/magenta.
```

Ponowiono `screen_vending` raz: pierwsza wersja zawierała nieczarny nieemisyjny panel tła. Wersję końcową wygenerowano z wymaganiem jednolitej czerni poza świecącą grafiką; kolejne obrazy zaakceptowano po pierwszym generowaniu. Łącznie nie przekroczono limitu dwóch ponowień na obraz.
```text
### screen_status - screens, 512x256

```text
Use case: stylized-concept. ONE isolated machine status display graphic on pure black #000000 background, black means no emission. Green #6dff4a bars, a sine-wave line and fine grid, no text. Flat orthographic, even illumination, crisp readable shapes, no perspective, no frame, no other colors, no red/cyan/magenta.
```

Ponowiono screen_vending raz: pierwsza wersja zawierała nieczarny nieemisyjny panel tła. Wersję końcową wygenerowano z wymaganiem jednolitej czerni poza świecącą grafiką; kolejne obrazy zaakceptowano po pierwszym generowaniu. Łącznie nie przekroczono limitu dwóch ponowień na obraz.


## Trzeci pakiet (2026-11-15) — prompty końcowe

Każdy obraz powstał w osobnym wywołaniu imagegen. Dla decals użyto zielonego tła #00ff00; dla znaków, holo i ekranów czarnego tła. Ponowienia: sticker_cluster (pierwsza wersja zawierała czerwonobrązowe papierki); graffiti_piece (pierwsza wersja miała różowo-magenta odcień zamiast czystego fioletu). Każdy obraz ponowiono raz; końcowe wersje wykorzystują wyłącznie chłodne dozwolone barwy.

### oil_stain — decal, 512×512

```text
Use case: stylized-concept. ONE game texture. Dark irregular asphalt oil stain, subtle violet and royal blue iridescent highlights, top-down. Isolated on pure green #00ff00 chroma key; no green in the motif. No perspective, no watermark, no red/cyan/magenta.
```

### crack_floor — decal, 512×512

```text
Use case: stylized-concept. ONE game texture. Branching dark concrete crack with crumbs, isolated on pure green #00ff00. No perspective, no watermark, no red/cyan/magenta.
```

### manhole — decal, 512×512

```text
Use case: stylized-concept. ONE game texture. Top-down worn circular cast iron manhole cover with grid, no text, isolated on pure green #00ff00. No perspective, no watermark, no red/cyan/magenta.
```

### tire_marks — decal, 512×512

```text
Use case: stylized-concept. ONE game texture. Two parallel faded braking tire marks, isolated on pure green #00ff00. No perspective, no watermark, no red/cyan/magenta.
```

### graffiti_tag3 — decal, 512×512

```text
Use case: stylized-concept. ONE game texture. Amber and warm white spray tag spelling exactly KOT, paint drips, pure green #00ff00 background. No perspective, no watermark, no red/cyan/magenta.
```

### graffiti_piece — decal, 512×512

```text
Use case: stylized-concept. ONE game texture. Wildstyle exactly NEO in violet, royal blue and amber only, pure green #00ff00 background. No perspective, no watermark, no red/cyan/magenta.
```

### sticker_cluster — decal, 512×512

```text
Use case: stylized-concept. ONE game texture. Small torn blank sticker cluster, no readable words or brands, pure green #00ff00 background. No perspective, no watermark, no red/cyan/magenta.
```

### poster_torn3 — decal, 512×512

```text
Use case: stylized-concept. ONE game texture. Torn concert poster spelling exactly NEON FEST in violet and amber, pure green #00ff00 background. No perspective, no watermark, no red/cyan/magenta.
```

### leak_streak — decal, 512×512

```text
Use case: stylized-concept. ONE game texture. Isolated vertical charcoal and muted brown-gray rain/rust streak, pure green #00ff00 background. No perspective, no watermark, no red/cyan/magenta.
```

### floor_stop — decal, 512×512

```text
Use case: stylized-concept. ONE game texture. Worn top-down warm-white road marking spelling exactly STOP, pure green #00ff00 background. No perspective, no watermark, no red/cyan/magenta.
```

### kebab — sign, 512×256

```text
Use case: stylized-concept. ONE game texture. Amber neon exact text KEBAB 24H, black background. No perspective, no watermark, no red/cyan/magenta.
```

### tattoo — sign, 512×256

```text
Use case: stylized-concept. ONE game texture. Violet neon exact text TATTOO and small star, black background. No perspective, no watermark, no red/cyan/magenta.
```

### arcade — sign, 512×256

```text
Use case: stylized-concept. ONE game texture. Royal blue neon exact text ARCADE and joystick icon, black background. No perspective, no watermark, no red/cyan/magenta.
```

### beer — sign, 512×256

```text
Use case: stylized-concept. ONE game texture. Green neon exact text PIWO and beer mug icon, black background. No perspective, no watermark, no red/cyan/magenta.
```

### repair — sign, 512×256

```text
Use case: stylized-concept. ONE game texture. Warm white neon exact text SERWIS and wrench icon, black background. No perspective, no watermark, no red/cyan/magenta.
```

### cocktail — sign, 512×512

```text
Use case: stylized-concept. ONE game texture. Violet cocktail glass neon with amber olive, no text, black background. No perspective, no watermark, no red/cyan/magenta.
```

### holo_cat — holo, 512×1024

```text
Use case: stylized-concept. ONE game texture. Large royal-blue sci-fi maneki-neko waving, scanlines, no text, black background. No perspective, no watermark, no red/cyan/magenta.
```

### holo_jellyfish — holo, 512×1024

```text
Use case: stylized-concept. ONE game texture. Violet holographic jellyfish with long tentacles, scanlines, no text, black background. No perspective, no watermark, no red/cyan/magenta.
```

### screen_ad — screen, 512×1024

```text
Use case: stylized-concept. ONE game texture. Violet implant chip inside rotating rings with abstract interface lines, no words, black background. No perspective, no watermark, no red/cyan/magenta.
```

### screen_news — screen, 1024×512

```text
Use case: stylized-concept. ONE game texture. Royal-blue abstract news charts and map outline; ticker dashes only, no words, black background. No perspective, no watermark, no red/cyan/magenta.
```

### screen_map — screen, 512×512

```text
Use case: stylized-concept. ONE game texture. Green grid map of city blocks with route and location dot, no words, black background. No perspective, no watermark, no red/cyan/magenta.
```

### tiles_wall — surface, 1024×1024

```text
Use case: stylized-concept. ONE game texture. Seamless flat orthographic 12×12 ceramic wall tiles, grout, cracked and missing tiles, grime, neutral gray tint 35–45%. No perspective, no watermark, no red/cyan/magenta.
```

### tread_plate — surface, 1024×1024

```text
Use case: stylized-concept. ONE game texture. Seamless flat orthographic steel diamond tread plate, scratches, grime in grooves, #3f4859–#66718a. No perspective, no watermark, no red/cyan/magenta.
```

### roof_tar — surface, 1024×1024

```text
Use case: stylized-concept. ONE game texture. Seamless flat orthographic graphite roofing membrane with overlaps, patches, pebbles, puddle stains without reflections, #22262e–#3a404c. No perspective, no watermark, no red/cyan/magenta.
```



## Pakiet kryj?wki Iskra ? 2026-11-15

Ka?dy obraz wygenerowano osobnym wywo?aniem imagegen. Pisownia napis?w sprawdzona na wynikach: ISKRA, METRO, WARSZTAT, TALENTY, TABLICA MISJI, ISKRA. Pierwszy wynik `iskra` ponowiono z powodu niedozwolonych barw. Prompt odrzuconej wersji: `Use case: stylized-concept. ONE isolated game neon sign texture. Amber #ffae1a and warm white #fff1d6 neon tubes spelling exactly ISKRA, with a simple spark/lightning bolt emblem. No other text. Restrained soft halo. Wide 2:1 composition, centered with generous pure black margin. Background pure black. Palette only amber, warm white, green #6dff4a, violet #8a5cff, royal blue #3d7bff. No red, cyan, turquoise, magenta, pink, brands, watermark, scene, wall, perspective, frame. Exact spelling ISKRA.` Wynik zawiera? barwy poza zaakceptowanym zestawem dla znaku.

### iskra ? signs, 512?256

```text
ONE isolated game neon sign texture, 2:1 wide. Exact word ISKRA in uppercase neon tubes, with one simple lightning spark symbol above. Use ONLY amber #ffae1a and warm white #fff1d6 for every illuminated pixel. Pure black background. Absolutely no other hues, no multicolor, no border, no frame, no green, violet, blue, red, cyan, magenta, pink. Clean centered readable lettering, restrained glow, generous black margin. No other text, brands, watermark, scene or wall. Spelling exactly ISKRA.
```

### metro ? signs, 512?256

```text
ONE isolated vintage illuminated metro station sign texture, 2:1 wide. Large stylized letter M and exact word METRO, readable uppercase. Neon lines only royal blue #3d7bff and warm white #fff1d6, pure black background, restrained glow, centered, generous black margin. No other hues or colors, no red cyan magenta pink, no brand, watermark, scene, wall, perspective. Exact spelling METRO.
```

### warsztat ? signs, 512?256

```text
ONE isolated game neon sign texture, 2:1 wide. Exact Polish word WARSZTAT in uppercase, with simple wrench and gear pictograms. Neon tubes ONLY green #6dff4a, pure black background, restrained glow, centered and readable, generous black margin. No other colors/hues, no red cyan magenta pink, no brands, watermark, wall, scene, perspective. Exact spelling WARSZTAT.
```

### screen_talents ? screens, 512?512

```text
ONE square game terminal screen texture, pure black background. Sparse clean abstract branching talent tree diagram: one root node branching into exactly three branches, circular nodes connected by thin lines. Violet #8a5cff and warm white #fff1d6 only for all illuminated elements. Header exact Polish word TALENTY at top, small subtle horizontal scan lines. No other text, no other hues, no red cyan magenta green blue, no brand, watermark, frame or scene. Flat frontal graphic, legible diagram, exact spelling TALENTY.
```

### screen_missions ? screens, 1024?512

```text
ONE wide 2:1 game mission board screen texture, pure black background. Minimal schematic district map made of thin block outlines and streets, several clear location pins and route lines connecting them. Amber #ffae1a and warm white #fff1d6 only for all luminous details. Exact Polish header TABLICA MISJI across top. High contrast readable, flat frontal interface graphic. No other text, no other hues, no red cyan magenta violet green blue, no brands, watermark, frame, perspective or scene. Exact spelling TABLICA MISJI.
```

### graffiti_iskra ? decals, 512?512

```text
ONE square stencil resistance graffiti decal artwork on a perfectly flat uniform chroma green #00ff00 background for later keying. Centered amber #ffae1a and warm white #fff1d6 stencil graphic: a spark/lightning symbol enclosed in a simple circle, with exact word ISKRA beneath in bold uppercase stencil lettering. Slightly weathered paint edges, high contrast. Keep every mark inside central 75%, green background completely even, no green paint in artwork. No other hues, no red cyan magenta violet blue, no extra text, logos, watermark, wall, scene or shadows. Exact spelling ISKRA.
```


## Rozbudowa kryjówki Iskra — 2026-11-15

`screen_comms` ma `blackMargin: 32`: cała grafika jest proporcjonalnie zmniejszana i centrowana na czarnym prostokącie przed black_key. Zapewnia to czarne rogi bez przycinania interfejsu. To obróbka źródła, bez regeneracji.

Sześć źródeł wygenerowano osobnymi wywołaniami wbudowanego imagegen. Użyto istniejących PNG bez regeneracji. Napisy sprawdzono na obrazach i planszy. Poniżej pełne prompty źródeł, pierwotnie opisanych jako decals; wynikowe płaszczyzny należą do posters.

Posters są nieprzezroczyste i niekafelkowane. Plakat werbunkowy zachowuje ciemne tło. Pozostałe trzy obrazy przechodzą green_key z czyszczeniem przebarwień brzegów i kompozycję na tle z pola keyBackground: #12161d, dla banera #1a1f28. Następnie centralne przycięcie i Lanczos. Screens i signs używają zwykłego black_key. Walidator posters wymaga pełnej nieprzezroczystości i zera pikseli z G > 120 oraz G − max(R, B) > 85 w skali 0–255.

### poster_iskra_recruit — posters, 512×512

Plik: `public/assets/textures/posters/poster_iskra_recruit.webp`.

```text
Use case: ads-marketing. Asset: square game decal texture, 512x512. Generate a worn underground resistance recruitment poster, stylized raised fist holding a small lightning spark, screen-print ink on dark paper, amber #ffae1a and warm white #fff1d6 only for illuminated/printed elements. Visible folds, tape corners, slight damage. Text verbatim, accurately rendered Polish: “DOŁĄCZ DO ISKRY”. No other words. Palette strictly amber and warm white on near-black paper, no red, cyan, magenta, no logos, no real people, no watermark.
```

### poster_koalicja_defaced — posters, 512×512

Plik: `public/assets/textures/posters/poster_koalicja_defaced.webp`.

```text
Use case: ads-marketing. Asset: square 512x512 decal. Official fictional corporate Coalition propaganda poster, cold royal blue #3d7bff and gray on dark paper, abstract faceless geometry, defaced by resistance: large crossed-out marks and amber spray-painted spark inside a circle, handwritten Polish annotation exactly “KŁAMSTWO”. Main printed text exactly “PORZĄDEK · BEZPIECZEŃSTWO · KOALICJA” with correct Polish spelling. Worn paper and spray paint. Use uniform chroma green #00ff00 background outside poster for alpha keying. No other colors of light, strictly no red/cyan/magenta, no real brands/logos/person faces, no watermark.
```

### banner_iskra — posters, 512×512

Plik: `public/assets/textures/posters/banner_iskra.webp`.

```text
Use case: stylized-concept. Asset: square 512x512 decal of a vertical handmade resistance flag/banner. Large spark inside circle, warm white #fff1d6 and amber #ffae1a printed on graphite cloth. Visible woven textile, folds, frayed edges. Uniform chroma green #00ff00 background outside cloth for alpha keying. No text, no extra colors, strictly no red/cyan/magenta, no logo, no watermark.
```

### mural_spark — posters, 1024×512

Plik: `public/assets/textures/posters/mural_spark.webp`.

```text
Use case: illustration-story. Asset: wide 1024x512 wall decal mural for a disused metro station. Street art mural, silhouettes of several ordinary people with raised hands beneath one enormous spark-shaped lightning bolt; distant city skyline with tall buildings. Bold layered stencil and spray paint, amber #ffae1a, violet #8a5cff, warm white #fff1d6, dark graphite. No text, no faces/details, no red/cyan/magenta, no brands or watermark. Uniform chroma green #00ff00 outside mural shape for alpha keying.
```

### screen_comms — screens, 1024×512

Plik: `public/assets/textures/screens/screen_comms.webp`.

```text
Use case: ui-mockup. Asset: wide 1024x512 hacker communications console screen texture, flat front-facing interface on pure black background, luminous frequency grid, signal waveforms, intercepted channel rows, compact readable hierarchy. Green #6dff4a and warm white #fff1d6 only. Exact Polish header: “ŁĄCZNOŚĆ // KANAŁY KOALICJI”. No other legible words, no red/cyan/magenta, no brand, no watermark, no perspective.
```

### sign_bar — signs, 512×256

Plik: `public/assets/textures/signs/sign_bar.webp`.

```text
Use case: stylized-concept. Asset: wide 512x256 isolated neon sign texture on pure black. Violet #8a5cff and warm white #fff1d6 glass neon tubes spell exactly “BAR POD PERONEM”, Polish spelling, with small simple cup icon. Centered with black margins, gentle restrained glow, no board, no wires. No other colors, strictly no red/cyan/magenta, no additional text, brands or watermark.
```
