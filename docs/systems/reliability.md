# Niezawodność sesji i zapisu

Specyfikacja zachowań odpornościowych: pauza, zapis, migracje, uszkodzone i nowsze zapisy, rozliczanie nagród. `SAVE_VERSION = 6` (`src/core/save.ts`). Wartości liczbowe pochodzą z kodu (stan na 20.11.2026).

## Pauza i utrata fokusu

- `GameLoop` (`src/core/loop.ts`): stały krok `SIM_DT = 1/60` s, najwyżej `MAX_STEPS_PER_FRAME = 5` kroków na klatkę (opcja konstruktora `maxStepsPerFrame` tylko dla testów; po przekroczeniu limitu nadmiar akumulatora jest odrzucany modulo `SIM_DT`). W pauzie `advance` nie wykonuje kroków, tylko woła `render`.
- Każda zmiana `paused` resetuje zegar ściany pętli (`lastMs`), więc czas pauzy, także ukrytej karty bez klatek RAF, nigdy nie jest nadrabiany po wznowieniu.
- Wejście (`src/core/input/index.ts`) czyści wszystkie klawisze i przyciski myszy oraz wywołuje nasłuchiwaczy utraty fokusu przy: `blur` okna, `visibilitychange` z `document.hidden`, wyjściu z pointer lock. `main.ts` podpina do tego pauzę. Start w ukrytej karcie od razu wchodzi w pauzę.
- Wznowienie (kliknięcie w canvas) jest zablokowane, gdy `document.hidden`; po wznowieniu ponownie żądany jest pointer lock.
- Pauza zawiesza wspólny `AudioContext` (`suspend`), wznowienie robi `resume`. Zdarzenia `pointerdown` / `keydown` / `touchstart` odblokowują audio tylko poza pauzą. Zegar dyrektora muzyki to `audioContext.currentTime`, więc muzyka też stoi. Muzyka jest wyłączona pod automatem (`navigator.webdriver`) i w `fx=lite`.
- Logika wrogów, pocisków, statusów, cooldownów i trybów korzysta z `step(dt)`, więc w pauzie stoi razem z pętlą.

## Rozgrzewka renderu przy wczytywaniu sceny

Za ekranem ładowania `main.ts` (po `scene.init()`) i `RunScene.openRoom` (po `room.init()`, przed `roomReady`) wołają `warmUpRender()` (`src/render/renderWarmUp.ts`, opis: [render.md](render.md#rozgrzewka-renderu-wczytywanie-sceny)). Jest to optymalizacja, nigdy warunek startu:

- Błąd rozgrzewki (wyjątek renderera, utrata kontekstu) tylko loguje `console.warn`; scena startuje bez niej, a shadery kompilują się w pierwszej klatce jak dawniej.
- Limit `tuning.ui.renderWarmUpTimeoutMs` = 10 s: wiszące `compileAsync` nie blokuje wejścia do gry. Po przekroczeniu `warmUp` dostaje `cancelled() === true` i nie rysuje już fazy 2 w trakcie gry.
- Sprzątanie po przerwanym init zachowane: `RunScene.openRoom` sprawdza `disposed` dopiero po `await warmUpRender()` i wtedy zwalnia pokój; zdarzenia podpięte przez pokój znikają razem z nim (test w `tests/unit/runScene.test.ts`).
- `fx=lite` (testy na rendererze programowym) nie rejestruje rozgrzewki, więc e2e w trybie lite nie płacą za kompilację.
- Rozgrzewka nie zmienia stanu symulacji ani `Rng`: tylko rysuje pipeline z `dt = 0`; `window.__neoryder` (debug) i `scene_loaded` pojawiają się po niej.

## Przechowywanie

- IndexedDB `neoryder` (wersja bazy 1), jeden object store `saves`; klucze rekordów: `meta`, `run`, `mission`. Każde połączenie jest krótkie (otwarte na jedną transakcję). `onblocked` odrzuca operację błędem „Baza zapisu jest zablokowana.”.
- Każdy rekord ma `saveVersion` (literał `SAVE_VERSION` po migracji). `MetaSave` = `{ saveVersion, createdAt, updatedAt, meta }`; `RunSave` = `{ saveVersion, seed, startedAt, run, ended? }`; `MissionSave` = punkt kontrolny misji liniowej + `saveVersion`. Schematy zod odrzucają nieznany kształt.
- Ustawienia (`neoryder.settings`) są w `localStorage`, poza migracją postępu. Odczyt jest odporny: brak dostępu lub zły JSON daje wartości domyślne, a każde pole z osobna ma `catch` (liczby spoza zakresu są przycinane, błędne wartości zastępowane domyślnymi, nieznane akcje i kody klawiszy w `bindings` odrzucane). Błąd zapisu ustawień tylko loguje ostrzeżenie.
- `write` (zapis i usunięcie) i kontrola „zapis z nowszej wersji” odbywają się w jednej transakcji `readwrite`: odczyt bieżącego rekordu, odmowa przy nowszej wersji, kopia bezpieczeństwa uszkodzonego rekordu, dopiero potem `put`/`delete`. Wyjątek w tej kolejności przerywa transakcję (`abort`), a poprzedni rekord zostaje.
- `saveMetaManager` (`src/progression/metaSave.ts`) kolejkuje zapisy do jednego `SaveStore` (starszy stan nie nadpisze nowszego), migawkę stanu robi w chwili wywołania i zachowuje `createdAt` istniejącego rekordu (błąd odczytu istniejącego = nowy `createdAt`).

## Migracje

`migrate(dane, migracje, cel)` stosuje kolejno `migracje[wersja]` (każda daje wersję + 1). Błędy: wersja nie jest nieujemną liczbą całkowitą, wersja nowsza niż cel, brak migracji dla wersji.

Meta (indeks = wersja źródłowa): 0→1 i 1→2 tożsamość; 2→3 dopisuje `meta` ze stanu startowego z danych, gdy brak; 3→4 dopisuje `campaign { completed: [], pendingDebrief: null }`; 4→5 dopisuje `achievements` zasilone z `stats`, `xp` i `unlocks` (patrz `docs/systems/achievements.md`; jeśli pole już istnieje, zostaje); 5→6 tożsamość.

Run: 0→1 tożsamość; 1→2 zapis v1 miał tylko szkielet (`seed`, `startedAt`) bez stanu do kontynuowania, więc staje się `run: null` i `loadRun` zwraca `null`; 2→3 dopisuje pełny ekwipunek z presetu `loadoutId`, `talents: []`, `threatLevel: 0` (nieznany preset = zapis nieczytelny); 3→4, 4→5, 5→6 tożsamość.

Misja liniowa (`mission`): brak migracji, akceptowana wyłącznie wersja bieżąca; starsza daje „Brak migracji” i traktowana jest jak uszkodzona.

## Zapis z nowszej wersji

Rekord z `saveVersion` większym niż `SAVE_VERSION` nie jest uszkodzony: odczyt zwraca `null`, pokazuje komunikat (`#save-warning`, `role="alert"`, popover, przycisk „Zamknij komunikat”: „Zapis pochodzi z nowszej wersji gry…”) i loguje ostrzeżenie; zapis i usunięcie tego klucza są odrzucane wyjątkiem „Zapis pochodzi z nowszej wersji gry.”. Rekord pozostaje nietknięty, nie jest wczytywany ani migrowany wstecz. Dotyczy wszystkich trzech kluczy. Wariant `loadMetaStrict` rzuca ten sam wyjątek zamiast zwracać `null`.

## Uszkodzenie i kopie bezpieczeństwa

- Odczyt zwykły (`loadMeta`, `loadRun`, `loadMission`) łapie każdy błąd migracji i walidacji, pokazuje komunikat („Nie można odczytać zapisu. Zachowano oryginał i kopię bezpieczeństwa; ten postęp nie może zostać wznowiony.”), loguje `console.warn` i zwraca `null`. Gra może zacząć nową sesję; dane zostają w bazie.
- Odczyt ścisły meta (`loadMetaStrict`, używany przy rozliczaniu nagród) odróżnia brak zapisu (`null`) od zapisu nieczytelnego (wyjątek), żeby nie nadpisać meta stanem startowym. `loadMetaManager` (start gry) przy każdym błędzie daje stan startowy z ostrzeżeniem w konsoli, ale niczego nie zapisuje do pierwszego `saveMetaManager`.
- Kopia: przy odczycie, zapisie i usunięciu uszkodzonego (ale nie nowszego) rekordu, w tej samej transakcji, do object store `saves` trafia niezmieniony surowy rekord pod kluczem tablicowym `['corrupt', nazwaRekordu, czasMs, uuid]` (również tekst niepoprawnego JSON). Każdy odczyt tworzy osobną kopię; kopie nie są kasowane automatycznie. Błąd zapisu kopii przerywa transakcję, więc nie dojdzie do destrukcyjnej podmiany bez kopii. Rekord runu, który po migracji jest `run: null` (v1), nie jest uszkodzeniem.
- Meta: uszkodzone `achievements` nie unieważniają reszty (schemat zamienia je na puste); reszta pól jest ścisła.

## Rozliczanie nagród i wznowienie runu (`RunScene`)

- Punkty zapisu runu: wejście na mapę (`showMap`, pełny stan i `achievementProgress`, adres zmieniany na `continue=1`), a w trakcie pokoju migawka `RunManager.checkpoint()`: stan sprzed wejścia do pokoju z zachowanymi kredytami, implantami (w sklepie także `hp`) i `roomCredits`. Zapis następuje natychmiast po `implant_acquired` i `shop_purchase` (mikrozadanie), a po `currency_changed` z opóźnieniem `REWARD_SAVE_INTERVAL_MS = 2000`; `run_ended` i wejście na mapę anulują oczekujący zapis.
- `roomCredits` (węzeł → kredyty już wypłacone) zapobiega ponownemu pobieraniu kredytów w tym samym pokoju po F5: nagroda za pokój jest liczona jako maksimum zarobku, a wypłacana jest tylko różnica. Postęp walki w pokoju nie jest utrwalany; F5 w pokoju przywraca ekran mapy ze stanem sprzed wejścia do pokoju (poza kredytami, implantami i `roomCredits`).
- Zakończenie runu (`run_ended`): `RunScene.settle` w kolejce zapisów: (1) zapis runu ze śladem `ended { runId, summary }`; (2) świeży `loadMetaManagerStrict`; (3) `MetaManager.applyRun` (idempotentne po `runId`); (4) `saveMetaManager`, jeśli `applied`; (5) `clearRun` (błąd tylko loguje). Błąd (1) lub (2) lub (4) = błąd `save` (ponów), `ZodError` lub błąd `applyRun` = błąd `apply` (jedyne wyjście: jawne „Porzuć nagrodę”, które usuwa zapis runu bez nagrody). Nagroda już obecna w `lastRuns` na dysku: bez zapisu meta, tylko `clearRun` i podsumowanie z rekordu.
- Watchdog: po `tuning.run.rewardSaveTimeoutS` = 10 s wisząca próba rozliczenia pokazuje błąd `save` i pozwala ponowić (liczony czasem ściennym, działa także w pauzie; ponowienie czeka w kolejce za wiszącą próbą).
- Wejście z `continue=1`: brak zapisu runu = powrót do menu; zapis z `ended` = rozliczenie i podsumowanie zamiast gry; inaczej `RunManager.restore` (walidacja `runStateSchema`) i `AchievementTracker.restore`. Nowy run przy zostawionym, nierozliczonym runie najpierw go rozlicza; błąd odczytu wstrzymuje nowy run („nowy run wstrzymany, żeby nie nadpisać nierozliczonej nagrody”).
- Misja liniowa (`src/scenes/mission.ts`): kontynuacja (`continue=1`) bez pasującego punktu kontrolnego (brak, inna misja lub inny poziom) rzuca „Brak punktu kontrolnego tej misji.”; zabezpieczenie magazynu nie odtwarza brakujących danych. Nowa próba przy istniejącym ukończonym punkcie kontrolnym przechodzi najpierw na `continue=1`, żeby rozliczyć przerwane zapisanie meta. Walidacja zapisu (`validateSnapshot`): znany punkt kontrolny, zgodny zestaw celów, ukończony zapis ma wszystkie cele `done`.

## Ograniczenia znane

- Postęp walki w bieżącym pokoju (zabici wrogowie, zebrane nagrody pokoju poza kredytami i implantami) nie jest utrwalany; F5 w pokoju wraca na mapę sprzed wejścia do pokoju.
- Zdarzenia osiągnięć w trakcie pokoju giną przy odświeżeniu pokoju (patrz `achievements.md`).
- Ustawienia localStorage nie są częścią migracji postępu IndexedDB.

## Weryfikacja

- `tests/unit/reliability.test.ts`: migracje v1–v5 (minimalne fixtury per wersja), przyszłe meta/run/misja, brakujące pola i niepoprawny JSON, kopie bezpieczeństwa, abort transakcji, wznowienie pętli bez klatek RAF w tle. Pozostałe: `tests/unit/save.test.ts`, `achievementsSave.test.ts`.
- `tests/e2e/reliability.spec.ts`: ukrycie karty przez 5 s i wznowienie, pauza przez 5 s, F5 z zapisanymi kredytami i implantem, start z uszkodzonym i z przyszłym zapisem. Każdy test ma własną przeglądarkę (współdzielony proces Chromium zawieszał test uszkodzonego zapisu na buildzie produkcyjnym); limit 60 s; ukrycie karty jest symulowane przez `document.hidden` i `visibilitychange`.
- Ręcznie: w walce Alt-Tab i Esc, odczekać 5 s, wznowić, sprawdzić ruch myszy oraz zatrzymanie i kontynuację muzyki; F5 po nagrodzie odtwarza mapę.
