# ADR 0006 — Neon Noir (kierunek artystyczny)

Status: **Przyjęta (2026-11-14)** — decyzja właściciela gry. Kontrakt oprawy pokoju: `src/world/dressingSchema.ts`.
Data: 2026-11-14

Właściciel gry poprosił, żeby gra nie była cała biało-szara: mapy mają przypominać cyberpunkowe uliczki lekko futurystycznego miasta, a grafika i efekty mają robić wrażenie. Zasady nadrzędne z `AGENTS.md` bez zmian (symulacja oddzielona od renderu, dane zamiast kodu, liczby „feel” w `tuning.ts`).

## Kontekst

Dotychczasowy kierunek („biały płaski świat”, czerwoni wrogowie, czarne obiekty interaktywne) jest czytelny, ale monotonny i nie daje efektu „wow”. Nowy motyw: nocne, deszczowe uliczki bliskiej przyszłości — beton, blacha, rolety, wiązki kabli nad ulicą, klimatyzatory, schody przeciwpożarowe, neony i hologramy reklam, mokry asfalt z odbiciami neonów, para z kratek, mgła z poświatą miasta, w tle sylwetki wieżowców z oświetlonymi oknami. Styl stylizowany (czytelne bryły, kontur zostaje), nie fotorealizm.

## Decyzja

1. **Paleta.** Otoczenie ciemne i chłodne (granat, grafit, stalowy błękit; powierzchnie oświetlone ok. #2a3344–#56627a). Niebo granat #070b16, przy horyzoncie fioletowo-bursztynowa łuna (#2b1f3d / #3a2a2a). Neony otoczenia **tylko**: bursztyn #ffae1a, zieleń #6dff4a, fiolet #8a5cff, błękit królewski #3d7bff, ciepła biel #fff1d6.
2. **Kolory zarezerwowane** (nie używać w otoczeniu): czerwień (wrogowie, #e0262b i pokrewne), cyan #00e5ff (gracz), magenta #ff2bd6 (Rezonans). Obiekty interaktywne (skrzynie do Chwytu) są w motywie neon jasne (#d9dde3), żeby odcinały się od ciemnego świata.
3. **Czytelność walki ponad efekty.** Wrogowie dostają czerwoną poświatę krawędzi na ciemnym tle; kontur zostaje.
4. **Motywy to dane** (`src/data/themes/<id>.json`). Motyw `white` zachowuje dotychczasowy wygląd (sceny testowe, klasyczna arena); motyw `neonStreet` to nocna ulica. Pokój wybiera motyw polem `theme`.
5. **Oprawa pokoju** (napisy neonowe, hologramy, kolorowe światła punktowe, naklejki, para/iskry/kapanie, dekoracje bez kolizji) jest opisana w `src/world/dressingSchema.ts` i jest czysto kosmetyczna: nie wpływa na symulację, kolizje ani walidację osiągalności. Przeszkody to nadal bloki układu (bloki dostają pole `material`).
6. **Zasoby.** Tekstury generuje Codex (wbudowane narzędzie obrazów) lub ComfyUI; to zasoby własne projektu. Modele miejskie: Blender, skrypt `tools/blender/build_assets.py`, wyniki w `public/assets/models/city/`.
7. **Wydajność.** Do 8 aktywnych świateł punktowych; odbicia mokrej nawierzchni jako render samych obiektów emisyjnych z odbitej kamery w 1/2 rozdzielczości; deszcz jako `InstancedMesh` do ok. 4000 smug. Cel F7 bez zmian: 60 FPS na średnim laptopie.
8. **Filar 4** zmienia się z „białe, płaskie otoczenie…” na czytelny styl Neon Noir. Superhot zostaje inspiracją w czytelności ról obiektów, nie w kolorze świata.

## Konsekwencje

- **Koszt renderu:** dodatkowy przebieg odbić, deszcz, mgła i światła punktowe; kontrolowany limitami z pkt 7 i sprawdzany względem celu F7.
- **Nowe zasoby:** tekstury (Codex / ComfyUI) i modele miejskie z Blendera; wszystkie własne.
- **Stare pokoje** zostają na motywie `white` do czasu przestylizowania.
- **Testy:** e2e style-test dalej działa na motywie `white`.
- **Dokumentacja:** zaktualizowane `AGENTS.md`, `docs/roadmap.md` (pitch, filar 4) i `docs/gdd.md` (styl wizualny). Historia fazy F1 w roadmapie bez zmian.

## Rozważone alternatywy

| Decyzja | Alternatywa | Dlaczego nie |
| --- | --- | --- |
| Neon Noir (stylizowany) | Zostać przy białym, płaskim świecie | Sprzeczne z prośbą właściciela; brak efektu „wow” |
| Neon Noir (stylizowany) | Fotorealizm | Koszt renderu i zasobów oraz gorsza czytelność walki |
