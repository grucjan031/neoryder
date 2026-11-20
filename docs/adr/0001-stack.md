# ADR 0001 — Stack F0 i granica symulacji

Status: przyjęty w briefie F0.

Projekt używa npm i modułów ES, Vite (stabilna wersja z rejestru przy instalacji)
oraz TypeScript strict z `noUncheckedIndexedAccess`. Three.js odpowiada za WebGL2,
a Rapier compat zawiera osadzony WASM i nie wymaga pluginu Vite. Dane JSON waliduje
zod; lil-gui i stats.js są narzędziami debug. Vitest działa w Node, zapis testujemy
na fake-indexeddb, a Playwright uruchamia produkcyjny build w Chromium.

Symulacja działa wyłącznie w `step()` ze stałą częstotliwością 60 Hz. Render
interpoluje poprzedni i bieżący stan, nie krokuje fizyki. `timeScale` i hitstop
zmieniają dt symulacji, zachowując kroki wejścia; dt=0 pomija fizykę. Core nie
importuje wartości z Three.js i nie wymaga WebGL; moduł wejścia jest jedyną
przeglądarkową granicą wejścia w core, a GUI jest tworzone wyłącznie w debug.

ESLint flat config i typescript-eslint wymuszają styl i granice importów,
Prettier formatuje pliki. CI na Node 22 sprawdza typy, lint, testy, build i e2e.
Podgląd hostowany: Vercel (produkcja i podglądy PR przez integrację z GitHubem);
dawny `netlify.toml` usunięty w S0-10.
