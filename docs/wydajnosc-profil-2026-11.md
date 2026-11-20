# Profil wydajności — czy przenosić moduły do Rusta (20 XI 2026)

**Wniosek:** nie teraz. Gra jest ograniczona renderem (Three.js + przebiegi postprocessu), a nie symulacją. Symulacja zajmuje 0,3–2,4 ms klatki, fizyka Rapier (już Rust/WASM) ok. 3% CPU. Przeniesienie logiki gry do Rusta oszczędziłoby najwyżej ~2 ms na najcięższej arenie, gdzie klatka trwa ~34 ms. Największe zyski leżą w liczbie przejść po scenie i przebiegach masek renderu.

## Metoda

- `tools/perf/profile.mjs` (etapy klatki: CPU i GPU przez zapytania czasu) + profil CPU V8 przez CDP (czas własny funkcji), 10 s na scenariusz, `quality=high`, 1280×720, `npm run dev`.
- Sprzęt: RTX 3060 Laptop, Chromium ANGLE D3D11 (prawdziwe GPU, nie SwiftShader).
- Scenariusze: `room-test` alleyMarket z 8 wrogami, `room-test` arenaRooftops z 12 wrogami (limit `maxAlive`), `boss-test`, `hub`.
- Pomiar jest zaszumiony (laptop, limit GPU): FPS skacze o ±10% między przebiegami; czasy etapów CPU są stabilniejsze.

## Wyniki (przed poprawką)

| Scenariusz       | FPS        | Symulacja `step` | Render CPU (`pipeline`) | Render GPU   | Draw calls | Trójkąty |
| ---------------- | ---------- | ---------------- | ----------------------- | ------------ | ---------- | -------- |
| Pokój, 8 wrogów  | 53,6       | 1,09 ms          | 12,4 ms                 | 14,7 ms      | 879        | 0,32 mln |
| Dachy, 12 wrogów | 27,9–29,3  | 2,2–2,4 ms       | 26,2–26,7 ms            | 27,5–28,5 ms | 1382       | 2,08 mln |
| Boss             | 60 (limit) | 0,24 ms          | 1,8 ms                  | 3,7 ms       | —          | —        |
| Kryjówka         | 47,5–51,5  | 0,44–0,49 ms     | 15,5–17,8 ms            | 17–19 ms     | 896        | 0,25 mln |

Rozbicie renderu na Dachach (CPU / GPU ms): kolor 10,3 / 11,2 · normalne 5,5 / 6,1 · maska odbić 4,1 / 3,8 · maska bloomu 5,8 / 4,8 · kompozycja 0,1 / 1,2.

Najdroższe funkcje (czas własny, Dachy): `updateMatrixWorld` 15,7%, `projectObject` 9%, `multiplyMatrices` 5,2%, `traverseVisible` 4,2%, `getParameters` 4% (Three.js); WASM Rapier 3,2%; `src/vfx/weather.ts` 2,1%; `src/render/bloom.ts` 2,4%.

**Przyczyna:** każdy przebieg (kolor, normalne, maska odbić, maska bloomu) rysuje całą scenę, a `renderWithViewmodel` robi to dwa razy (świat + ręce/broń). To ~8 pełnych `renderer.render` na klatkę, a każdy liczy od nowa macierze całego drzewa, przechodzi drzewo przy odrzucaniu poza kadrem i podmienia materiały (maski), co uruchamia wyszukiwanie programów shaderów.

## Wykonane

1. `viewmodelLayer.ts`: drugi render (ręce) nie przelicza macierzy świata — policzył je pierwszy render tego przebiegu. Render CPU na Dachach 26,2–26,7 → 21,7–22,2 ms (−4,5 ms); FPS 27,9–29,3 → 29,6–33,9. Obraz bez zmian (e2e `style`, testy renderu).

## Rekomendacje (kolejność wg zysku do kosztu)

| #   | Zmiana                                                                                                                                                                                 | Szacowany zysk (Dachy) | Pliki                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------- |
| 1   | Przebiegi masek (normalne, maska odbić, maska bloomu) w jednym przejściu z wieloma celami renderu (WebGL2 MRT) albo rysowanie masek tylko dla obiektów z warstwy emisyjnej/odbijającej | 8–12 ms CPU i GPU      | `outline.ts`, `bloom.ts`            |
| 2   | Macierze świata raz na klatkę: `scene.matrixWorldAutoUpdate = false` i jedno `updateMatrixWorld()` przed przebiegami                                                                   | ~3 ms CPU              | `outline.ts` (potok)                |
| 3   | Maska bloomu bez podmiany materiału na obiekt (`selectiveMaterial`) — materiał maski w cache lub `overrideMaterial` z wyjątkami                                                        | ~1–2 ms CPU            | `bloom.ts`                          |
| 4   | 1382 wywołania rysowania na Dachach: sprawdzić pokrycie `staticBatch` i instancjonowanie powtarzalnych obiektów                                                                        | GPU/CPU, do zmierzenia | `render/staticBatch.ts`, dane areny |
| 5   | `renderWithViewmodel` przechodzi całą scenę po światła w każdym przebiegu — włączać warstwę viewmodelu światłom raz, przy dodaniu                                                      | ~0,5–1 ms CPU          | `viewmodelLayer.ts`                 |
| 6   | Deszcz (`weather.ts`) liczony na CPU co klatkę → ruch kropel w shaderze wierzchołków                                                                                                   | ~0,5 ms CPU            | `vfx/weather.ts`                    |

Punkty 1–2 dotyczą `outline.ts`, które zmienia otwarty PR #70 — robić po jego scaleniu.

## Kiedy Rust/WASM ma sens

- **Budowa nawigacji areny przy ładowaniu:** 310–325 ms na arenie 450×300 m (`ArenaSurfaceNavigation`, `ArenaNavigation`). To czas ładowania, nie klatki — kandydat, jeśli ładowanie aren zacznie przeszkadzać (Rust zwykle 3–10× szybciej w takich pętlach na siatkach).
- **AI przy dużo większej liczbie wrogów** (separacja, zapytania przestrzenne) — dziś limit `maxAlive` 12 trzyma symulację ≤ 2,4 ms.
- Warunek: interfejs partiami (cała siatka / wszyscy wrogowie w jednym wywołaniu, wspólna pamięć), a nie wywołanie WASM na obiekt; test, że wynik jest identyczny z wersją TS (determinizm seeda).
