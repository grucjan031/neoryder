# [F1][Grafika, VFX i audio] Shader: biały świat, czerwoni wrogowie

Agent: Grafika, VFX i audio
Folder: /src/render
Zależy od: — (tylko F0: scena Three.js)
Filar: Czytelny styl wizualny

## Cel

Spójny, płaski styl: biały świat, czerwoni wrogowie, czarne obiekty interaktywne, cyan/magenta dla gracza i mocy — czytelny w 0,2 s.

## Wymagania

- Materiały z rejestru palet: `world` (biały, płaski, lekki cieniowany obrys), `enemy` (czerwony), `interactive` (czarny), `player` (cyan), `power` (magenta).
- Płaski shading (unlit lub toon z 2 progami) i obrys/krawędzie dla czytelności brył; opcjonalny postprocess (np. obrys, winieta) z przełącznikiem w lil-gui.
- Paleta (kolory, grubość obrysu) w `tuning.render`; nowe obiekty dostają materiał po tagu semantycznym, nie po ręcznym kolorze.
- Kod symulacji nie importuje materiałów; `render/` tylko rysuje stan.
- Wydajność: `InstancedMesh` tam, gdzie obiekty się powtarzają; test na wolnym GPU (cel 60 FPS).
- Assety CC0 lub procedurala; bez modeli zewnętrznych na tym etapie.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

Brak nowych zdarzeń. API render: `getMaterial(kind: 'world' | 'enemy' | 'interactive' | 'player' | 'power'): THREE.Material` — zgłosić do `docs/api.md` jako kontrakt modułu.

## Kryteria akceptacji

- [ ] Vitest: rejestr palet zwraca materiał dla każdego `kind`, nieznany rzuca błąd
- [ ] Vitest: zmiana koloru w `tuning.render` aktualizuje materiał
- [ ] Scena `?scene=style-test` z podłogą, ścianami, manekinami, czarnymi rekwizytami i neonowym ostrzem
- [ ] Zrzut ekranu Playwright (`tests/e2e`) sceny stylu jako test regresji wizualnej (tolerancja ustalona z QA)
- [ ] Aktualizacja /docs/systems/render.md

## Poza zakresem

Odłamki i rozpad wrogów (#12), cząsteczki, bloom i inne efekty postprocess poza obrysem, modele 3D.
