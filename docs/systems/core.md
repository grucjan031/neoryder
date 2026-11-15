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

Kontrakty F2-01 rozszerzają `GameEvents` o `status_applied`, `status_expired`,
`focus`, `weapon_switched`, `blade_thrown`, `blade_returned` i `synergy_triggered`
zgodnie z `docs/api.md` → „Kontrakty F2”. `damage_dealt` ma opcjonalne
`statuses` przekazywane z `DamageInfo`. To deklaracje kontraktów dla kolejnych
zadań F2; samo dodanie typów nie uruchamia reakcji na te zdarzenia.

`Stats` liczy `(base + suma flat) × (1 + suma percent) × iloczyn mult`, z dolną
granicą zero. Cache unieważnia zmiana bazy oraz dodanie/usunięcie modyfikatorów.
Modyfikatory są kopiowane i zamrażane, a lista zwracana jako kopia. `Rng` używa
mulberry32 i xmur3; szczegóły i odtwarzanie strumieni opisuje ADR 0002.

`SaveStore` rozdziela klucze `meta` i `run` w IndexedDB `neoryder`, magazyn `saves`.
Implementacja pamięciowa zachowuje te same zasady kopiowania. Schematy zod
walidują dane (`SAVE_VERSION = 3`, w `RunSave` pole `run: RunState` walidowane przez `runStateSchema`, w `MetaSave` pole `meta: MetaState`).
Migracja 0→1 zachowuje pola istniejącego szkieletu i podnosi wersję; migracja 1→2 jest
neutralna dla `meta`, natomiast szkielet `run` v1 (bez pola `run`) traktuje jako brak
aktywnego runu (`loadRun()` zwraca `null` bez ostrzeżenia). Brakujące lub uszkodzone pola
są odrzucane z ostrzeżeniem (`null`). Nowszy zapis zwraca `null` z ostrzeżeniem;
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

Akcje F2-01: `power2` pod `KeyE`, `weapon1`–`weapon3` pod `Digit1`–`Digit3`
oraz `bladeThrow` pod środkowym przyciskiem myszy (`"1"`). `Input` blokuje
domyślne akcje środkowego `mousedown` i `auxclick` na canvasie, w tym autoscroll.
Mapowania udostępniają wejście dla kolejnych zadań F2, bez obsługi nowych mechanik.

## Dodanie sceny debug

Zaimplementuj `Scene` z `src/scenes/index.ts`, dodaj fabrykę do `scenes` i otwórz
`?scene=<id>&debug=1&seed=test`. Buduj obiekty w `init`, aktualizuj stan wyłącznie
w `step`, interpoluj pozycję i rotację w `render(alpha)`, a w `dispose` zwolnij
WASM, geometrie i materiały. Nowy wspólny kontrakt najpierw uzgodnij w `docs/api.md`.
Statyczna kamera F0 jest ustawiana w main; kontrakt kamery FPP należy do F1.

Backquote otwiera konsolę. `CommandRegistry` z `src/ui/debugCommands.ts` wykonuje
komendy zarówno konsoli, jak i `window.__neoryder.command`. Rejestr dopasowuje
najpierw nazwę dwuwyrazową, potem jednowyrazową; ignoruje wielkość liter nazwy,
zachowuje wielkość liter argumentów. Nieznana komenda zwraca komunikat z sugestią
`help`, a wyjątek handlera staje się komunikatem błędu. Duplikat nadpisuje komendę
z ostrzeżeniem `console.warn`. `help()` zbiera opisy bieżących rejestracji.

Scena rejestruje komendy w `init` przez opcjonalne
`ctx.commands?.register(name, help, run)` i zachowuje zwrócone funkcje unsubscribe,
które wywołuje w `dispose`. Odpięcie starej rejestracji nie usuwa jej zastępcy.
Sandbox rejestruje `spawn cube`, player-test — `tp <x> <y> <z>`, damage-test —
`hit`, `heal`, `block`, `slash`. Eksport `registerCommand` obsługuje domyślną
instancję używaną w main; testy mogą przekazać własny rejestr przez `GameContext`.

Main rejestruje `help`, `reset`, `seed`, `timescale <n>` i `hitstop <ms>`.
Wartości czasu muszą być skończone i nieujemne. `reset` deleguje do opcjonalnej
metody `scene.reset()`, a zapytania do `scene.query(name)`. Main nie rozpoznaje
konkretnych klas scen. Debug handle jest zamrożony i wystawiany tylko w debug;
e2e używają `?debug=1`. `cubeY` pochodzi z bieżącego stanu pierwszej kostki,
a `bodies` obejmuje podłogę i dynamiczne kostki.

## Weryfikacja

`npm run check` uruchamia typy, ESLint i Vitest (Node, pula worker threads).
`npx playwright install chromium` instaluje przeglądarkę. `npm run e2e` buduje
grę i uruchamia `npm run preview` na stałym porcie 4173; testy używają SwiftShader.
Ręcznie: sprawdź spadek kostki, reset/spawn, zmianę grawitacji, fov i wysokości,
hitstop, historię komend oraz pauzę po Escape/utracie fokusu i wznowienie kliknięciem.

## FeelSystem — czas gry (F1 #13)

`src/core/feel.ts` jest jedynym właścicielem czasu (ADR 0003 pkt 5). Systemy walki tylko emitują zdarzenia:

- `hitstop { ms }` → `loop.hitstop(ms)` (kumulacja jako max w pętli; ignorowane w pauzie).
- `slowmo { timeScale, durationS }` i `wave_last_kill` (→ `tuning.time.lastKillTimeScale` 0,2 przez `lastKillSlowmoS` 0,3 s) → spowolnienie liczone w **czasie rzeczywistym** (`update(frameDt)` z `main.ts`), potem płynny powrót w `slowmoRecoverS` (0,15 s). Kumulacja: mocniejsze spowolnienie wygrywa, czas jako max.
- `baseTimeScale` — cel powrotu; komenda debug `timescale <n>` zmienia bazę, nie nadpisuje efektów. `reset()` przy zmianie sceny.

## Skupienie: czas gracza — F2-06

`FeelSystem` obsługuje zdarzenie `focus { worldScale, durationS }` jak `slowmo`
(kumulacja: mocniejsze spowolnienie wygrywa, czas jako max), ale dodatkowo
wyjmuje gracza spod spowolnienia: `playerDt(dtSim)` zwraca w Skupieniu
`dtSim / loop.timeScale × playerTimeScale` (najwyżej `SIM_DT × 2`), poza nim
`dtSim`; hitstop (0) zostaje 0. `focusActive` trwa przez `durationS` czasu
rzeczywistego z wyłączeniem hitstopu i przez płynny powrót świata (`time.slowmoRecoverS`), żeby gracz
nie zwalniał przy wychodzeniu ze Skupienia. `durationS: 0` kończy je przed
czasem (np. brak energii). `main.ts` ustawia `ctx.feel`; sceny krokują gracza,
ostrze, moce, broń i energię z `ctx.feel?.playerDt(dt) ?? dt`, a wrogów,
pociski, statusy, obrażenia i fizykę zwykłym `dt` (arena, ai-test). Ostatnie
zabójstwo fali i inne `slowmo` nadal spowalniają także gracza.

Testy: `feel.test.ts` (dystans gracza w 1 s czasu rzeczywistego jak bez
Skupienia, świat 0,3; hitstop, limit, powrót, wcześniejsze zakończenie,
kumulacja) i `arenaFocus.test.ts` (prawdziwa arena). Moc `kind: 'focus'`
jest w rejestrze mocy; `focusPower.test.ts` sprawdza synchronizację mocy i świata
z sekundą hitstopu oraz naturalne zakończenie przez `focus { durationS: 0 }`.
`FeelSystem` śledzi hitstop z tych samych zdarzeń co `GameLoop` (pętla nie
udostępnia pozostałego czasu); samodzielne slowmo F1 odlicza czas jak dotąd.
