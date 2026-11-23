# ADR 0012 — wsadowa nawigacja i sąsiedztwo AI

Przyjęto 2026-11-22.

## Pomiar i decyzja

Na arenie `arenaPowerPlant`, przed zmianą, 60 wrogów zajmowało 1,470 ms/krok.
Z tego kontrolery Rapiera zajmowały 0,686 ms, krok świata 0,238 ms,
promienie 0,077 ms, nawigacja 0,082 ms, pozostała praca menedżera AI 0,269 ms.
Dodatkowa instrumentacja obu skanów sąsiadów (separacja i nakładające się
kapsuły) dała przy 60 wrogach 0,394 ms wobec 0,214 ms reszty AI i 0,162 ms
nawigacji w tym samym przebiegu. Czasy bezwzględne zależą od obciążenia CPU.

Rust buduje pola BFS na wielopoziomowych arenach i wybiera kolejne węzły w
kolejności krawędzi grafu TS. Buforuje do 32 ostatnio utworzonych pól celu.
Jedno wywołanie na krok zwraca prefiksy tras i uporządkowane listy pobliskich
aktorów. Promienie, kontakt i ruch kapsuł obsługuje Rapier. Geometria areny,
reguły taktyczne, dyrektor i RNG pozostają w dotychczasowych modułach.

## Uruchamianie i powtarzanie pomiaru

`npm run wasm` buduje workspace `rust/`, uruchamia generator wasm-bindgen
dla przeglądarki i umieszcza wynik w `src/wasm/neoryder-sim/`. Lockfile
przypina wersje zależności. Gra i testy korzystają z gotowych plików.
Start fizyki inicjuje oba moduły równolegle. Bajty WASM są też zakodowane
w module JS, dzięki czemu `initSync` działa również w Node. Błąd ładowania
pozostawia aktywny algorytm TS. Test parytetu wymaga udanej inicjalizacji WASM.

`npm run bench:ai` uruchamia rzeczywistą scenę Przejęcia bez renderu.
Seed to `bench-ai`, co trzeci wróg jest Strzelcem. Po 120 krokach rozgrzewki
skrypt mierzy 600 kroków po 1/60 s. Wyniki to czasy wyłączne, razem z kosztem
wywołań JS/WASM. Po zmianie kolumna nawigacji obejmuje również wsad sąsiedztwa.
Porównanie obejmuje nowy ruch, który zmienia przebieg kontaktów w Rapierze.

## Wynik na Windows, Node 22.13.0

Identyczny skrypt uruchomiono naprzemiennie na kodzie sprzed zmiany
(`b25f4797`) i na wersji z WASM. Każda kolumna podaje medianę trzech
przebiegów w ms/krok. Sumy obliczono osobno w każdym przebiegu.

| Moduł | 30 przed | 30 po | 60 przed | 60 po |
|---|---:|---:|---:|---:|
| Nawigacja (po zmianie także wsad sąsiedztwa) | 0,064 | 0,027 | 0,094 | 0,050 |
| Pozostałe AI | 0,127 | 0,094 | 0,317 | 0,139 |
| **Nawigacja i AI łącznie** | **0,196** | **0,121** | **0,407** | **0,189** |
| Promienie | 0,047 | 0,048 | 0,083 | 0,080 |
| Kontrolery ruchu | 0,416 | 0,413 | 0,712 | 0,708 |
| Krok świata Rapiera | 0,245 | 0,232 | 0,266 | 0,255 |
| Reszta sceny | 0,108 | 0,093 | 0,131 | 0,106 |
| **Cały krok** | **1,012** | **0,926** | **1,600** | **1,348** |

Przy 60 wrogach nawigacja i AI zajęły o 54% mniej czasu, a cały krok o 16%.
Przy 30 wrogach spadek wyniósł odpowiednio 38% i 8,5%.
