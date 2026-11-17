# Narzędzia i prompty tekstur NEORYDER

Wszystkie 121 obrazów (33 z pierwszego pakietu, 17 z drugiego, 24 z trzeciego, 12 dla kryjówki Iskra, 2 atlasy okien, 13 powierzchni dużych aren i 20 powierzchni drugiego pakietu dużych aren) utworzono osobnymi wywołaniami wbudowanego narzędzia imagegen. Pierwszy pakiet: 2026-11-14; drugi i trzeci pakiet: 2026-11-15. Licencja: wygenerowane na potrzeby projektu — własne. Bez zewnętrznych obrazów i prawdziwych marek. Skrypt obrabia bitmapy, nie rysuje ich treści.

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

Dla pojedynczych źródeł: `python tools/textures/process.py build --ids concrete hotel`. Manifest odbudowuje się ze wszystkich istniejących wyników; pełna walidacja zawsze wymaga wszystkich 121 plików WebP, bez źródeł raw.

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


## Window atlases (`atlas`)

Each atlas was generated in a separate imagegen call; source files are `tools/textures/raw/windows_lit.png` and `windows_dark.png`. Processing uses centered cropping without stretching to 1024?1024, then writes opaque RGB WebP without keying or tiling. The contact sheet includes both atlases.

### windows_lit ? atlas, 1024?1024

Final prompt sent to imagegen:

```text
Use case: stylized-concept. Asset type: game texture atlas, exterior building windows at night. Generate a square 1024x1024 image, perfectly aligned 4 by 4 grid, exactly sixteen distinct separate square windows, each cell filled edge-to-edge with one complete window seen straight-on from outside; thin dark frame at each cell edge clearly separates cells. Neon Noir rainy near-future city, dark cool facade around window frames, subtle delicate rain droplets on glass. Interiors vary across all sixteen cells: warm white #fff1d6 and amber #ffae1a rooms with varied shades and brightness; closed blinds with stripes of light, drawn translucent curtains, a human silhouette by a window, plant on sill, royal-blue #3d7bff TV glow, desk lamp, kitchen, empty fluorescent office, window reflecting a violet #8a5cff neon advertisement, green #6dff4a monitor glow, plus other varied plausible lit interiors. Each cell has a distinct window composition but occupies its exact 256x256 square with no gutters or grid overlay. Flat orthographic facade, stylized painterly game texture, readable at game distance. RGB opaque. Absolutely no text, letters, logos, brands, watermark. No red, cyan, magenta, pink. No perspective.
```

### windows_dark ? atlas, 1024?1024

```text
Use case: stylized-concept. Asset type: game texture atlas, exterior building windows at night. Generate a square 1024x1024 image, perfectly aligned 4 by 4 grid, exactly sixteen distinct separate square dark or dim windows, each cell filled edge-to-edge with one complete window seen straight-on from outside; thin dark frame at each cell edge clearly separates cells. Neon Noir rainy near-future city, cool navy and violet city glow reflected on dark glass, subtle delicate rain droplets, varied subdued dark rooms; include some barely visible light through slightly open blinds, other empty unlit rooms, and varied reflections so all sixteen cells feel distinct but low-light. Each cell has its own complete window composition occupying its exact 256x256 square, no gutters, no visible grid overlay. Flat orthographic facade, stylized painterly game texture, readable at game distance. RGB opaque. Absolutely no text, letters, logos, brands, watermark. No red, cyan, magenta, pink. No perspective.
```


## Pakiet dużych aren — 2026-11-17

Odtworzenie pakietu (walidacja i podglądy w obecnym skrypcie obejmują cały katalog; `--ids` filtruje tylko build):

```powershell
python tools/textures/process.py build --ids container_corrugated_navy container_corrugated_olive container_corrugated_ochre container_corrugated_graphite quay_concrete quay_lines steel_grating rubber_fender crane_paint overpass_concrete smog_soot_wall market_tarp roof_hvac_metal
python tools/textures/process.py validate
python tools/textures/process.py previews
```

Kontrola: obejrzano wszystkie 13 wyników i ich podglądy 2×2 oraz contact sheet. Nie stwierdzono napisów, marek, perspektywy ani zarezerwowanych kolorów. Regularność oczek `steel_grating` pozostaje do decyzji po osiągnięciu limitu ponowień. Podgląd zbiorczy: `%TEMP%/neoryder-textures/contact-sheet.png`.

Port kontenerowy, estakada w smogu i nocny targ na dachach: 13 nowych powierzchni RGB 1024×1024. Każdy obraz wygenerowano osobnym wywołaniem imagegen z `transparent_background=false` i skopiowano do `tools/textures/raw/<id>.png`. Istniejący `roof_tar` pozostaje bez zmian; nowe źródło o tej nazwie pominięto i usunięto. `steel_grating` używa jasności zamiast alfy, ponieważ surfaces obsługuje tylko RGB. `rubber_fender` ponowiono raz z powodu niezamówionych żółtych pasów. Po kontroli 2×2 ponowiono także: container_corrugated_navy, container_corrugated_ochre, container_corrugated_graphite (pas zużycia na poziomym łączeniu), quay_lines (niedopasowane końce linii), steel_grating (nierówne oczka na łączeniu), crane_paint (nity i smugi przy krawędzi). Każdy z tych obrazów ponowiono raz; pozostałe zero razy. steel_grating ponowiono następnie drugi raz z powodu pozostałych smug na łączeniach (łącznie 8 ponowień w pakiecie). Osiągnięto limit 2 ponowień dla steel_grating; ostatni rząd oczek nadal jest niższy — ograniczenie do review, nie pełna akceptacja wizualna.

### container_corrugated_navy — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/container_corrugated_navy.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: dark navy corrugated shipping container steel, broad vertical ribs, rain streaks, small chipped paint, subtle dark brown rust only. Cool Neon Noir surface, flat orthographic head-on, evenly lit, stylized readable painted shapes, no photorealism, no perspective, no text, no brands, no borders, no glow. Opposite edges must match seamlessly. No red, cyan, magenta, pink. Fill entire square.
```

### container_corrugated_olive — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/container_corrugated_olive.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: olive green corrugated shipping container steel, broad vertical ribs, rain streaks, small chipped paint, subtle dark brown rust. Muted olive #555b3b and deep charcoal. Flat orthographic head-on, evenly lit, stylized painted shapes, no photorealism, no perspective, no text, brands, borders or glow. Edges tile seamlessly. No red, cyan, magenta, pink. Fill entire square.
```

### container_corrugated_ochre — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/container_corrugated_ochre.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: ochre amber painted corrugated shipping container steel, broad vertical ribs, rain streaks, chipped paint, subtle dark brown rust, muted ochre #9a7136 against charcoal. Flat orthographic head-on, evenly lit, stylized painted shapes, no photorealism, no perspective, no text, no brands, borders or glow. Opposite edges must match seamlessly. No red, cyan, magenta, pink. Fill entire square.
```

### container_corrugated_graphite — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/container_corrugated_graphite.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: graphite painted corrugated shipping container steel, broad vertical ribs, rain streaks, chipped paint, subtle dark brown rust, dark graphite #343a44. Flat orthographic head-on, evenly lit, stylized painted shapes, no photorealism, no perspective, no text, no brands, borders or glow. Opposite edges must match seamlessly. No red, cyan, magenta, pink. Fill entire square.
```

### quay_concrete — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/quay_concrete.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: cool gray quay concrete albedo: broad worn slab surface with oil stains, fine cracks, subtle damp mottling, palette cold blue gray #394554 to #68727b. Flat orthographic top-down, evenly lit, stylized painted readable shapes, not photorealistic, no perspective, no objects, text, brands, border, glow, red, cyan, magenta or pink. Opposite edges must match seamlessly. Fill entire square.
```

### quay_lines — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/quay_lines.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: wet terminal asphalt albedo with restrained yellow amber maneuvering yard lane lines, only a few broad geometric painted line segments designed to tile, dark charcoal blue gray asphalt, no text. Flat orthographic top-down, evenly lit, stylized painted readable shapes, not photorealistic, no perspective, no objects, text, brands, border, glow, red, cyan, magenta or pink. Opposite edges must match seamlessly. Fill entire square.
```

### steel_grating — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/steel_grating.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: dark steel walkway grating seen top down, repeating square lattice with bright open holes represented by light cool gray background patches within the pattern, no alpha, clean regular mesh, subtle worn edges. Flat orthographic head-on/top-down, evenly lit, stylized readable painted shapes, not photorealistic, no perspective, no text, brands, border, glow, red, cyan, magenta or pink. Opaque RGB albedo only, no transparency. Opposite edges must match seamlessly. Fill entire square.
```

### rubber_fender — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/rubber_fender.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: close-up flat orthographic texture of plain dark black graphite quay rubber fender material, repeating rounded vertical rubber ribs with fine scuffs, worn matte surface and subtle cool gray highlights. Entire image only dark rubber, no safety paint, NO stripes, NO yellow, no markings, no bolts, no text, no perspective, no objects, no brands, no glow. Stylized painted game surface, even lighting, opaque RGB. Opposite edges tile seamlessly. No red, cyan, magenta or pink. Fill entire square.
```

### crane_paint — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/crane_paint.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: worn painted steel from an industrial container crane, warm dirty yellow and amber paint #a87a2f with small evenly spaced rivets, scratches, dark graphite metal showing through. Flat orthographic head-on, evenly lit, stylized painted shapes, not photorealistic, no perspective, no text, brands, borders or glow. Opposite edges must match seamlessly. No red, cyan, magenta, pink. Fill entire square.
```

### overpass_concrete — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/overpass_concrete.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: cool gray concrete underside of an urban overpass, seamless stains, downward rain streaks, subtle smog marks, fine cracks, blue gray #394454 to #626b75. Flat orthographic head-on, evenly lit, stylized painted shapes, not photorealistic, no perspective, no text, brands, borders or glow. Opposite edges must match seamlessly. No red, cyan, magenta, pink. Fill entire square.
```

### smog_soot_wall — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/smog_soot_wall.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: cold gray wall surface covered with soot, charcoal dark streaks and soft uneven deposits, blue gray concrete underlayer, restrained low contrast. Flat orthographic head-on, evenly lit, stylized painted shapes, not photorealistic, no perspective, no text, brands, borders or glow. Opposite edges must match seamlessly. No red, cyan, magenta, pink. Fill entire square.
```

### market_tarp — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/market_tarp.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: faded navy violet market stall canopy tarp fabric, woven texture, broad loose folds and seam lines, muted dark blue and dusty purple, subtle rain stains. Flat orthographic head-on/top-down, evenly lit, stylized painted shapes, not photorealistic, no perspective, no text, brands, borders or glow. Opposite edges must match seamlessly. No red, cyan, magenta, pink. Fill entire square.
```

### roof_hvac_metal — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/roof_hvac_metal.webp`.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: roof HVAC equipment sheet metal albedo, cool dark steel with repeating ventilation grilles, narrow louvers, small fasteners and weathered edges, flat orthographic detail. Flat orthographic head-on/top-down, evenly lit, stylized painted shapes, not photorealistic, no perspective, no text, brands, borders or glow. Opposite edges must match seamlessly. No red, cyan, magenta, pink. Fill entire square.
```


### Korekty po kontroli podglądów 2×2

Powyższe prompty tych sześciu tekstur opisują odrzucone pierwsze wersje. Poniżej pełne prompty zaakceptowanych wersji końcowych.

#### quay_lines — końcowy prompt (1 ponowienie)

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture 1024x1024 of wet terminal asphalt, dark cool charcoal blue gray, fine aggregate and subtle damp patches. Exactly TWO straight horizontal parallel yellow amber maneuvering yard lines at 25 percent and 75 percent image height, extending continuously from left edge to right edge at identical heights and widths. No vertical lines, no curves, no intersections, no line ends. Top and bottom edges only uniform asphalt. Flat orthographic top-down, evenly lit, stylized painted readable shapes, no photorealism, no perspective, no objects, text, brands, borders or glow. No red, cyan, magenta, pink. Opposite edges match seamlessly. Fill entire square.
```

#### container_corrugated_navy — końcowy prompt (1 ponowienie)

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture 1024x1024: navy painted corrugated container steel with exactly eight uniformly spaced straight vertical ribs running continuously through top and bottom edges. Restrained fine rain streaks, tiny paint chips and sparse dark brown weathering spread uniformly across the image. CRITICAL no horizontal seam, no horizontal row of wear along top or bottom, no border, no framing, no large blotches at edges; uninterrupted vertical corrugation. Top and bottom must match without a horizontal line when tiled. Dark cool navy #26334a. Flat orthographic head-on, even lighting, stylized painted shapes, not photorealistic. No perspective, text, brands, glow, red, cyan, magenta or pink. Opposite edges match seamlessly. Fill entire square.
```

#### container_corrugated_ochre — końcowy prompt (1 ponowienie)

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture 1024x1024: ochre amber painted corrugated container steel with exactly eight uniformly spaced straight vertical ribs running continuously through top and bottom edges. Restrained fine rain streaks, tiny paint chips and sparse dark brown weathering spread uniformly across the image. CRITICAL no horizontal seam, no horizontal row of wear along top or bottom, no border, no framing, no large blotches at edges; uninterrupted vertical corrugation. Top and bottom must match without a horizontal line when tiled. Muted ochre amber #9a7136. Flat orthographic head-on, even lighting, stylized painted shapes, not photorealistic. No perspective, text, brands, glow, red, cyan, magenta or pink. Opposite edges match seamlessly. Fill entire square.
```

#### container_corrugated_graphite — końcowy prompt (1 ponowienie)

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture 1024x1024: graphite painted corrugated container steel with exactly eight uniformly spaced straight vertical ribs running continuously through top and bottom edges. Restrained fine rain streaks, tiny paint chips and sparse dark brown weathering spread uniformly across the image. CRITICAL no horizontal seam, no horizontal row of wear along top or bottom, no border, no framing, no large blotches at edges; uninterrupted vertical corrugation. Top and bottom must match without a horizontal line when tiled. Dark cool graphite #343a44. Flat orthographic head-on, even lighting, stylized painted shapes, not photorealistic. No perspective, text, brands, glow, red, cyan, magenta or pink. Opposite edges match seamlessly. Fill entire square.
```

#### steel_grating — końcowy prompt (1 ponowienie)

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture 1024x1024 of a dark steel walkway grating. Exactly 8 by 8 identical square openings in a perfectly regular orthographic square lattice, equal spacing everywhere. Light cool gray solid fills inside openings represent the open area in opaque RGB, no alpha. Place the image boundary exactly along the center of the outermost dark steel bars, so half-width bars on opposite edges join into full-width bars when repeated. No partial extra cells, no doubled bars, no variation in cell size, no perspective. Small subtle worn edges, flat even illumination, stylized painted shapes. No text, brands, border, glow, red, cyan, magenta, pink. Fill entire square, opposite edges must match seamlessly.
```

#### crane_paint — końcowy prompt (1 ponowienie)

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture 1024x1024: warm dirty yellow amber painted steel of a container crane, restrained scratches and chips exposing dark graphite steel, sparse subtle dirt. Exactly four by four small round rivet heads arranged on a regular grid at cell centers, with generous equal spacing so none touch the image boundaries. Uniform paint tone and weathering density everywhere, no dark border, no panel frame, no edge wear band, no directional lighting gradient. Flat orthographic head-on, evenly lit, stylized painted shapes, not photorealistic. Opposite edges tile seamlessly. No text, brands, perspective, glow, red, cyan, magenta or pink. Fill entire square.
```

#### rubber_fender — odrzucony pierwszy prompt

Powód odrzucenia: niezamówione żółte pasy bezpieczeństwa.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture, 1024x1024: dark black graphite quay rubber fender surface, thick ribbed rubber texture, scuffed and worn, subtle gray highlights, restrained oil grime. Flat orthographic head-on/top-down, evenly lit, stylized readable painted shapes, not photorealistic, no perspective, no text, brands, border, glow, red, cyan, magenta or pink. Opaque RGB albedo only, no transparency. Opposite edges must match seamlessly. Fill entire square.
```


#### steel_grating — ostatni prompt (2 ponowienia)

Poprzedni prompt korekty został odrzucony z powodu smug przy krawędziach.

```text
Use case: stylized-concept. Generate ONE seamless square tileable game albedo texture 1024x1024: dark steel industrial walkway grating with light cool gray openings represented as opaque color, no alpha. Flat graphic 8 by 8 perfectly regular grid of identical square openings. The dark steel bars have a uniform flat graphite color, with NO bevel shading, NO shadows, NO highlights, NO edge wear anywhere in the outer 80 pixels of the image. Image boundaries run through uniform dark steel bars. The entire outer 16 pixels on all four sides must be exactly the same flat graphite #343a44, allowing smooth repeat; openings never reach the boundary. Subtle small scratches only in the central area. Stylized painted game material, absolutely flat orthographic, uniform illumination, no perspective, no text, brands, glow, red, cyan, magenta or pink. Opposite edges match seamlessly. Fill entire square.
```

## Pakiet dużych aren — 2026-11-18

20 nowych powierzchni (surfaces, RGB, 1024×1024) dla aren: port/statek, zajezdnia, budowa, elektrownia, doki, estakada. Obrazy wygenerował Codex imagegen 2026-11-18; licencja: własne. Źródła w `tools/textures/raw/<id>.png`. Każdy obraz powstał jednym wywołaniem; bez ponowień.

```powershell
python tools/textures/process.py build --ids ship_hull_paint ship_deck_steel rail_ballast rail_sleeper_concrete maglev_body_panel snow_asphalt snow_concrete formwork_plywood concrete_raw_cast excavation_dirt slag_heap cooling_tower_concrete turbine_hall_floor flood_brick_algae boardwalk_planks canal_stone_wall gas_station_tiles highway_asphalt_worn scaffold_planks hazard_stripes_worn
python tools/textures/process.py validate
python tools/textures/process.py previews
```

Korekta tonów: `excavation_dirt` wyszła zbyt nasyconą pomarańczową gliną (gra zakazuje czerwieni w otoczeniu; brief: ciemny brąz #3a2f28–#5e4c3e). Potok dostał opcjonalne pola katalogu `saturation` i `brightness` (mnożniki PIL ImageEnhance, tylko surfaces, przed mieszaniem łączeń; brak pola = bez zmian, więc istniejące tekstury są nietknięte). Dla `excavation_dirt` ustawiono `saturation: 0.45`.

Prompt każdego obrazu miał postać: „Use case: stylized-concept. Generate ONE square seamless tileable game texture, <id>. <subject> Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.” Pełne prompty:

### ship_hull_paint — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/ship_hull_paint.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, ship_hull_paint. Steel ship hull plates, dark navy paint #1d2a40 to #34466a, horizontal welded plate seams, rust streaks running down in muted brown #5a4636, small chips, slight grime. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### ship_deck_steel — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/ship_deck_steel.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, ship_deck_steel. Steel ship deck, gray anti-slip paint #3a4250 to #5b6575, worn walking paths showing darker steel, weld lines in a grid, small scuffs. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### rail_ballast — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/rail_ballast.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, rail_ballast. Railway ballast of crushed dark gray stone #2b2f36 to #565c66 with concrete sleepers crossing horizontally at regular spacing (sleepers pale gray #6b707a), top-down, tiles seamlessly along both axes. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### rail_sleeper_concrete — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/rail_sleeper_concrete.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, rail_sleeper_concrete. Worn concrete slab of a railway platform, cool gray #3a414c to #66707e, oil stains, hairline cracks, small chips. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### maglev_body_panel — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/maglev_body_panel.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, maglev_body_panel. Train body panels, dark graphite #22262e to #3e4450, thin panel seams in a rectangular grid, flush rivets, fine scratches, subtle satin sheen painted flat. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### snow_asphalt — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/snow_asphalt.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, snow_asphalt. Dark asphalt #23262d partially covered by thin compacted snow #b9c4d4 to #dfe6ef, tire ruts exposing dark asphalt strips, slushy edges. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### snow_concrete — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/snow_concrete.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, snow_concrete. Cool concrete #3b424d with frozen snow #c3cdda filling cracks and low hollows, frost speckles, patchy coverage about 40 percent. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### formwork_plywood — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/formwork_plywood.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, formwork_plywood. Wet formwork plywood sheets, muted ochre-brown #6b5a43 to #8a7556, rectangular sheet joints, gray concrete splashes and stains, nail holes. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### concrete_raw_cast — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/concrete_raw_cast.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, concrete_raw_cast. Freshly cast raw concrete wall, gray #4a505a to #747b86, imprint of formwork board lines, regular round tie holes in a grid, small air pores. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### excavation_dirt — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/excavation_dirt.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, excavation_dirt. Muddy clay earth of a construction pit, dark brown #3a2f28 to #5e4c3e, tire tracks, scattered small stones, wet patches darker. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### slag_heap — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/slag_heap.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, slag_heap. Industrial slag and ash, dark gray #24262b to #4a4c52 granular clumps, occasional warm amber-gray glints #7a6a55, rough texture. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### cooling_tower_concrete — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/cooling_tower_concrete.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, cooling_tower_concrete. Cooling tower concrete, light cool gray #5a616c to #7d8592, vertical water stains and dark streaks, faint horizontal formwork bands. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### turbine_hall_floor — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/turbine_hall_floor.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, turbine_hall_floor. Industrial epoxy floor, muted gray-green #3a453f to #56625a, worn amber safety lane lines #b88a2e, scuffs and oil stains. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### flood_brick_algae — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/flood_brick_algae.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, flood_brick_algae. Old brick wall, dark brown-gray bricks #3d3330 to #5a4a42, a horizontal flood line across the middle, below it dark green algae #2f3f2c and silt deposits. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### boardwalk_planks — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/boardwalk_planks.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, boardwalk_planks. Wet wooden boardwalk planks running horizontally, dark weathered wood #3a3028 to #5c4b3b, gaps between planks, metal brackets and bolts. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### canal_stone_wall — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/canal_stone_wall.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, canal_stone_wall. Wet stone blocks of a canal wall, dark slate #2e333b to #4d545e, uneven ashlar blocks, damp streaks, small moss in joints. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### gas_station_tiles — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/gas_station_tiles.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, gas_station_tiles. Square floor tiles of a gas station forecourt, cool gray #4a505a to #6e7480, dark grout lines, oil stains and tire marks. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### highway_asphalt_worn — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/highway_asphalt_worn.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, highway_asphalt_worn. Worn highway asphalt, charcoal #24272d to #43474f, crack network, darker sealed crack lines, rectangular patch repairs, no lane markings. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### scaffold_planks — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/scaffold_planks.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, scaffold_planks. Scaffolding walk boards, weathered wood #5a4a38 to #7d6a50 with galvanized steel edge strips #6a717c at both ends of each plank, planks running horizontally. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```

### hazard_stripes_worn — surfaces, 1024×1024

Plik: `public/assets/textures/surfaces/hazard_stripes_worn.webp`.

```text
Use case: stylized-concept. Generate ONE square seamless tileable game texture, hazard_stripes_worn. Worn diagonal hazard stripes, alternating amber #c8902a and graphite #24272d, chipped paint, scratches, grime. Flat orthographic head-on, evenly lit, stylized painted readable shapes, not photorealistic. Fill entire image. Opposite edges must match seamlessly. No text, perspective, border, red, cyan, magenta, neon, objects or watermark.
```
