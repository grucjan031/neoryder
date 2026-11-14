# Narzędzia i prompty tekstur NEORYDER

Wszystkie 33 obrazy utworzono osobnymi wywołaniami wbudowanego narzędzia imagegen. Data: 2026-11-14. Licencja: wygenerowane na potrzeby projektu — własne. Bez zewnętrznych obrazów i prawdziwych marek. Skrypt obrabia bitmapy, nie rysuje ich treści.

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

Dla pojedynczych źródeł: `python tools/textures/process.py build --ids concrete hotel`. Manifest odbudowuje się ze wszystkich istniejących wyników; pełna walidacja zawsze wymaga wszystkich 33 plików.

Algorytmy i zasady użycia opisuje [docs/textures.md](../../docs/textures.md). Wyniki trafiają do `public/assets/textures/<category>/<id>.webp`. Podglądy i raport trafiają do `%TEMP%/neoryder-textures/`: `contact-sheet.png`, `<id>-2x2.png`, `validation.json`. Font podpisów podglądu: systemowy Arial z `C:/Windows/Fonts/arial.ttf`.

## Kontrola i ponowne generowanie

Obejrzano źródła i przetworzone wyniki, sprawdzono napisy, marki i paletę, powierzchnie także w układzie 2×2. Raz ponowiono: `cat_cafe`, `holo_android`, `holo_drink`, `holo_koi`, `holo_implant`, `holo_noodles`, `floor_hazard`. Przyczyna: mieszanie kolorowych poświat tworzyło różowe/czerwonawe obwódki. Wersje końcowe hologramów i CAFE mają jedną dominującą barwę światła; pasy ostrzegawcze ograniczono do bursztynu i czerni. Pozostałe 26 obrazów zaakceptowano po pierwszym generowaniu. Nie przekroczono dwóch ponowień na obraz. Odrzucone wersje nie są eksportowane.

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

