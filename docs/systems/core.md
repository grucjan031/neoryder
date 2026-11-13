# Fundamenty F0

`GameLoop` akumuluje czas rzeczywisty w sekundach i wykonuje kroki `SIM_DT=1/60`.
Limit pięciu kroków na klatkę odrzuca zaległości, zachowując ułamek do interpolacji.
`timeScale` skaluje wyłącznie dt; hitstop przyjmuje maksimum pozostałych czasów
i przekazuje dt=0, nadal odbierając wejście. Pauza zatrzymuje akumulowanie czasu;
render pozostaje aktywny. Zegar i scheduler można wstrzyknąć, `advance(ms)` działa
bez przeglądarki. Sandbox nie krokuje Rapier przy dt<=0.

`EventBus` jest instancją w `GameContext`, bez singletonu. Emisja synchroniczna
iteruje po kopii subskrypcji w kolejności rejestracji; odpięty w jej trakcie zwykły
handler bierze udział jeszcze w tej emisji. Wyjątki trafiają do `console.error`.
`once` jest zdejmowane przed wywołaniem, również przy zagnieżdżonej emisji.

`Stats` liczy `(base + suma flat) × (1 + suma percent) × iloczyn mult`, z dolną
granicą zero. Cache unieważnia zmiana bazy oraz dodanie/usunięcie modyfikatorów.
Modyfikatory są kopiowane i zamrażane, a lista zwracana jako kopia. `Rng` używa
mulberry32 i xmur3; szczegóły i odtwarzanie strumieni opisuje ADR 0002.

`SaveStore` rozdziela klucze `meta` i `run` w IndexedDB `neoryder`, magazyn `saves`.
Implementacja pamięciowa zachowuje te same zasady kopiowania. Schematy zod
walidują dane. Migracja 0→1 zachowuje pola istniejącego szkieletu i podnosi wersję;
brakujące wymagane pola są odrzucane. Nowszy zapis zwraca null z ostrzeżeniem;
nie można go nadpisać ani skasować przez `clearRun`. Odczyt migruje w pamięci,
bez automatycznego zapisu. Ustawienia w `neoryder.settings` w localStorage mają
domyślne wartości przy niedostępnej pamięci, błędnym JSON lub błędnych danych.

`tuning` jest mutowalne i czytane na bieżąco. Rekurencyjny panel lil-gui obejmuje
wszystkie pola liczbowe; fov, grawitacja, limit ciał i wysokość nowej kostki działają
na żywo. Zmiana wysokości nie teleportuje istniejących ciał. Liczby geometrii,
mgły i statycznego kadru sandboxu określają wyłącznie prezentację sceny F0.

`Input` ładuje mapowanie z `src/data/inputBindings.json` i waliduje je przez zod.
Snapshot zwraca kopie zbiorów, po czym zeruje krawędzie i deltę myszy. Wiele
klawiszy tej samej akcji jest liczone niezależnie. Fokus okna, widoczność dokumentu
i utrata pointer lock zerują wejście oraz wywołują subskrybentów pauzy. Kliknięcie
canvasu wznawia pętlę i prosi o pointer lock. Pisanie w polach UI nie uruchamia akcji.

## Dodanie sceny debug

Zaimplementuj `Scene` z `src/scenes/index.ts`, dodaj fabrykę do `scenes` i otwórz
`?scene=<id>&debug=1&seed=test`. Buduj obiekty w `init`, aktualizuj stan wyłącznie
w `step`, interpoluj pozycję i rotację w `render(alpha)`, a w `dispose` zwolnij
WASM, geometrie i materiały. Nowy wspólny kontrakt najpierw uzgodnij w `docs/api.md`.
Statyczna kamera F0 jest ustawiana w main; kontrakt kamery FPP należy do F1.

Backquote otwiera konsolę. Parser i executor komend są czyste i używane również
przez `window.__neoryder.command`: `help`, `reset`, `spawn cube`, `seed`,
`timescale <n>`, `hitstop <ms>`. Wartości muszą być skończone i nieujemne.
Debug handle jest zamrożony, wystawiany tylko w debug; e2e używają `?debug=1`.
`cubeY` pochodzi z bieżącego stanu symulacji pierwszej kostki, `bodies` obejmuje
podłogę i dynamiczne kostki. Sandbox ma lokalne metody do tych operacji;
nie rozszerzają interfejsu `Scene` ani `GameContext`.

## Weryfikacja

`npm run check` uruchamia typy, ESLint i Vitest (Node, pula worker threads).
`npx playwright install chromium` instaluje przeglądarkę. `npm run e2e` buduje
grę i uruchamia `npm run preview` na stałym porcie 4173; testy używają SwiftShader.
Ręcznie: sprawdź spadek kostki, reset/spawn, zmianę grawitacji, fov i wysokości,
hitstop, historię komend oraz pauzę po Escape/utracie fokusu i wznowienie kliknięciem.
