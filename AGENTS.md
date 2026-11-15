# AGENTS.md — zasady dla agentów NEORYDER

Czytaj ten plik przed każdym zadaniem. Źródła prawdy: `docs/roadmap.md` (wizja, fazy), `docs/gdd.md` (projekt gry), `docs/api.md` (kontrakty między modułami), `docs/systems/*.md` (specyfikacje systemów).

## Gra w skrócie
FPP roguelite, cyberpunk, styl Neon Noir (nocne, deszczowe uliczki bliskiej przyszłości, ciemne chłodne otoczenie z neonami bursztyn/zieleń/fiolet/błękit/ciepła biel, obiekty interaktywne jasne). Kolory zarezerwowane, zakazane w otoczeniu: czerwień dla wrogów, cyan dla gracza, magenta dla Rezonansu. Szczegóły: `docs/adr/0006-neon-noir.md`. Trzy ścieżki: Ostrze, Moc (Rezonans), Strzelec. Każda decyzja wspiera co najmniej jeden filar: feel walki, build-crafting, trwała progresja, czytelny styl.

**Zakaz nazw chronionych:** nie używaj „Jedi”, „Sith”, „lightsaber”, „the Force” ani nazw z Superhot w kodzie, danych, tekstach i commitach. Używaj: *ostrze plazmowe* (`plasmaBlade`), *Rezonans* (`resonance`), *Rezonanci*.

## Stack i komendy
TypeScript strict, Vite, Three.js, Rapier (`@dimforge/rapier3d-compat`), zod, lil-gui, stats.js, Vitest, Playwright, ESLint + Prettier. Menedżer pakietów: **npm**.

| Komenda | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski (http://localhost:5173) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (zapis) |
| `npm test` | Vitest (testy jednostkowe, bez przeglądarki) |
| `npm run e2e` | Playwright (buduje i uruchamia grę w Chromium headless) |
| `npm run build` | build produkcyjny do `dist/` |
| `npm run check` | typecheck + lint + test (to samo co CI bez e2e) |

Parametry URL: `?scene=<id>` wybiera scenę (domyślnie `sandbox`), `?debug=1` włącza panel lil-gui, stats.js i konsolę debug (w `npm run dev` debug jest włączony zawsze), `?seed=<tekst>` ustawia seed runu, `?scenes=1` (tylko w trybie debug) pokazuje listę scen debug zamiast menu gry.

## Architektura (obowiązuje każdego agenta)
1. **Symulacja oddzielona od renderu.** Logika gry i Rapier działają w stałym kroku `SIM_DT = 1/60` s w `step()`. Three.js tylko rysuje stan w `render(alpha)` z interpolacją między poprzednim i bieżącym stanem. Kod symulacji nie importuje `three` poza typami matematycznymi i nie dotyka DOM — dzięki temu działa w Vitest.
2. **Data-driven.** Bronie, moce, wrogowie, implanty, węzły drzewek, misje to pliki JSON w `src/data/`, walidowane schematem zod przy ładowaniu. Nowy wariant = nowy plik danych, nie nowy kod.
3. **Liczby „feel” tylko w `src/core/tuning.ts`** (hitstop, okno parowania, odrzut, prędkości). Każda wartość widoczna w panelu lil-gui. Żadnych magicznych liczb rozgrywki w kodzie.
4. **Statystyki tylko przez `Stats` + `StatModifier`** (`src/core/stats.ts`). Nikt nie liczy bonusów na własną rękę.
5. **Komunikacja między modułami przez typowany `EventBus`** (`src/core/events.ts`). Moduły nie wołają się nawzajem bezpośrednio, poza API opisanym w `docs/api.md`.
6. **Losowość tylko przez `Rng`** (`src/core/rng.ts`) z seeda runu. Zakaz `Math.random()` w symulacji (dozwolony tylko w czysto kosmetycznym VFX).
7. **Zapis** przez `SaveStore` (`src/core/save.ts`): IndexedDB, pole `saveVersion`, migracje; meta-progres i stan runu osobno; ustawienia w localStorage.
8. **Pułapki przeglądarki w jednym miejscu:** pointer lock, pauza przy utracie fokusu — `src/core/input/`; odblokowanie audio po kliknięciu — `src/audio/`.
9. **Wydajność od początku:** pooling pocisków i odłamków, `InstancedMesh` dla powtarzalnych obiektów, limity ciał fizycznych w `tuning.ts`.
10. **Debug:** każda nowa mechanika ma scenę testową `?scene=<id>` (rejestr w `src/scenes/`) i, jeśli ma sens, komendę w konsoli debug.

## Struktura i właściciele folderów
| Folder | Właściciel | Zawartość |
|---|---|---|
| `docs/` | Producent | GDD, specyfikacje systemów, ADR (`docs/adr/`), `api.md` |
| `src/core/` | **Architekt** (tylko on zmienia wspólne typy) | pętla, eventbus, rng, stats, save, input, tuning |
| `src/render/` | Grafika/VFX | scena Three.js, kamera, shader, postprocess |
| `src/physics/` | Ruch i kamera | świat Rapier, warstwy kolizji, character controller |
| `src/player/` | Ruch i kamera | kontroler FPP |
| `src/combat/melee/` `powers/` `weapons/` | Walka wręcz / Moce / Bronie | |
| `src/combat/damage/` | Architekt | wspólny model obrażeń |
| `src/enemies/` | AI wrogów | archetypy, zachowania, bossowie |
| `src/progression/` | Progresja | drzewka, implanty, waluty |
| `src/world/` | Świat | generator sektorów, pokoje, misje |
| `src/scenes/` | Architekt (rejestr), autorzy scen | sceny debug i rozgrywki |
| `src/ui/` | UI/UX | HUD, menu, hub (HTML/CSS nad canvasem) |
| `src/vfx/` `src/audio/` | Grafika/VFX | cząsteczki, odłamki, dźwięki |
| `src/data/` | autorzy systemów (misje: Fabuła) | JSON + schematy zod |
| `tests/unit/` `tests/e2e/` | QA (+ autor zmiany) | Vitest, Playwright |
| `public/assets/` | Grafika | .glb, dźwięki, tekstury (tylko CC0 lub własne) |

## Zasady pracy
1. Jedno zadanie = jedno issue = jeden PR. Nie dotykaj cudzego folderu bez zgody Architekta.
2. **Kontrakt przed kodem:** gdy potrzebujesz czegoś od innego modułu (zdarzenie, funkcja, typ), najpierw dopisz to do `docs/api.md`.
3. Każdy PR ma testy i przechodzi `npm run check` oraz `npm run e2e`.
4. Zmieniasz zachowanie systemu — aktualizujesz jego dokument w `docs/systems/` w tym samym PR.
5. Nie przechodź do kolejnej fazy bez akceptacji człowieka (bramki faz w `docs/roadmap.md`).
6. Zadania spoza bieżącej fazy trafiają do `docs/backlog.md`, nie do kodu.

## Styl kodu
- TypeScript strict, `noUncheckedIndexedAccess`, bez `any` (wyjątek z komentarzem uzasadniającym).
- Moduły ES, importy względne, nazwy plików `camelCase.ts`, klasy `PascalCase`.
- Identyfikatory w kodzie po angielsku; dokumentacja i teksty UI po polsku (teksty UI docelowo w plikach danych).
- Funkcje czyste tam, gdzie się da; stan symulacji serializowalny (bez referencji do obiektów Three.js).
- Komentarze tylko tam, gdzie kod nie mówi sam za siebie.

## Definicja ukończenia (każdy PR)
- [ ] `npm run check` i `npm run e2e` zielone
- [ ] nowe liczby w danych lub `tuning.ts`, nie w kodzie
- [ ] dokument systemu zaktualizowany
- [ ] review Architekta
- [ ] scena `?scene=` pozwala sprawdzić zmianę w 30 sekund
- [ ] opis PR: co przetestować ręcznie i na co zwrócić uwagę w „feel”
