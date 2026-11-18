# Niezawodność sesji — S9-02

`SAVE_VERSION = 6` pozostaje bez zmian.

## Dogrywka: zatrzymanie testu uszkodzonego zapisu

`.pw-local.config.ts` buduje aplikację i uruchamia `vite preview`, nie dev server.
Zatrzymanie odtworzono przy kolejnych testach korzystających ze wspólnego procesu
Chromium. Trace pokazał niedokończone ładowanie produkcyjnego bundla JS oraz
zablokowane `page.evaluate`, a nie wielokrotne ukończone odczyty `undefined`.
Dodatkowa asercja gotowości pierwszego menu zatrzymała się jeszcze **przed**
wpisaniem `'{broken'` do IndexedDB. Samo oczekiwanie na menu, przygotowanie danych
na statycznej stronie, wyłączenie cache i pominięcie dodatkowego screenshotu
nie dały stabilnego pełnego przebiegu; tych prób nie pozostawiono w kodzie.

W osobnej przeglądarce ten sam build produkcyjny odczytał uszkodzony zapis i
uruchomił mapę. Tymczasowy pomiar pokazał zakończone transakcje IndexedDB w około
2–3 ms oraz `console.warn(ZodError)` w około 2 ms. Nie potwierdzono zakleszczenia
magazynu ani wyjątku gry przed instalacją debug API. Nie ustalono wewnętrznej
przyczyny zatrzymania Chromium; ustalono zależność od współdzielenia jego procesu.

`reliability.spec.ts` tworzy teraz przeglądarkę na każdy test zamiast korzystać
z jednego procesu przez cały worker. Publiczny fixture `playwright` zachowuje
opcje uruchomienia i kontekstu projektu oraz obsługę trace/screenshotów.
Przeglądarka jest zamykana także po błędzie zamknięcia kontekstu. Wszystkie
asercje, screenshoty i limit 60 s pozostały; dodano asercję braku `pageerror` dla
obu wariantów zapisu. Test F5 nadal korzysta z tego samego kontekstu i IndexedDB
przed odświeżeniem i po nim. W dogrywce nie zmieniano kodu gry ani konfiguracji.

Weryfikacja dogrywki: Vitest `32 passed (32)` (save + reliability), TypeScript
i Prettier zielone. Dwa kolejne pełne przebiegi po izolacji: `5 passed (2.6m)`
i `5 passed (2.7m)`, oba z kodem 0, na `.pw-local.config.ts`, `PW_PORT=4366`.
Test uszkodzonego zapisu trwał odpowiednio 13,2 s i 15,3 s. Po zakończeniu
wszystkich testów w obu przebiegach ręcznie zatrzymano wyłącznie uruchomiony przez
runner proces preview, żeby odblokować teardown w tym środowisku Windows.
Wyniki poniżej opisują wcześniejszy etap, przed tą poprawką izolacji testów.

| Kryterium                         | Stan przed                                                                                                                                 | Zmiana                                                                                                                      | Stan po                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Blur, ukrycie karty, pointer lock | Input wywoływał pauzę i czyścił klawisze. Pętla ograniczała liczbę kroków, ale wznowienie przed następnym RAF mogło nadrobić czas ukrycia. | Reset zegara przy zmianie pauzy, blokada wznowienia ukrytej karty, pauza także po inicjalizacji w tle.                      | Symulacja stoi; powrót wymaga świadomego wznowienia.                                                                              |
| Pauza walki i trybów              | Logika wrogów, pocisków, statusów, cooldownów, Kradzieży rdzenia i Szturmu korzystała z `step(dt)`. Muzyka i dźwięki grały dalej.          | Zawieszenie wspólnego AudioContext; zegar dyrektora muzyki korzysta z czasu kontekstu. Odblokowanie audio respektuje pauzę. | Symulacja i kontekst audio stoją; kliknięcia w menu nie odblokowują audio.                                                        |
| F5                                | Run zapisywany na mapie, URL zmieniany na `continue=1`.                                                                                    | Bez zmiany formatu i punktów zapisu. Test odświeżenia z niezerowymi kredytami i implantem.                                  | Zachowany ostatni zapis na mapie; postęp bieżącego pokoju nadal nie jest utrwalany — patrz ograniczenia.                          |
| Atomowość                         | `put` i kontrola przyszłej wersji w jednej transakcji IndexedDB. Nagrody: zapis `ended`, idempotentne rozliczenie meta, usunięcie runu.    | Test wymuszonego abortu po `put`. Kopia uszkodzonych danych należy do transakcji odczytu lub podmiany.                      | Abort pozostawia poprzedni rekord. Nie ma potrzeby dodatkowego klucza staging dla prawidłowego zapisu.                            |
| Migracje                          | Migracje meta i runu v1–v5 istniały.                                                                                                       | Minimalne realistyczne fixtures generowane dla każdej wersji przez `fixtures(version)` w nowym teście.                      | Zachowane dostępne pola postępu. V1 miał tylko szkielet runu; nie zawierał stanu do kontynuowania. Meta-progres pojawił się w v3. |
| Przyszła wersja                   | Meta/run zwracały null i ostrzeżenie w konsoli; zapis i usuwanie były blokowane. Odczyt misji rzucał.                                      | Komunikat dla gracza, bezpieczny odczyt misji; testy ochrony wszystkich trzech kluczy.                                      | Rekord pozostaje nietknięty. Nie jest wczytywany do gry ani migrowany wstecz.                                                     |
| Uszkodzenie                       | Meta/run zwracały null bez kopii. Misja rzucała wyjątek.                                                                                   | Kopia surowej wartości przed odczytem, nadpisaniem lub usunięciem; odczyt misji zwraca null; komunikat.                     | Gra może rozpocząć nową sesję. Nieczytelne dane pozostają dostępne do odzyskania.                                                 |

## Kopie bezpieczeństwa

Object store `saves` przechowuje kopie pod kluczami tablicowymi
`['corrupt', nazwaRekordu, czasMs, uuid]`. Wartością jest niezmieniony surowy rekord,
również tekst niepoprawnego JSON. Oryginał nie jest usuwany przez odczyt.
Każdy odczyt uszkodzonego rekordu tworzy osobną kopię; kopie nie są automatycznie
kasowane. Przyszłe wersje nie są kwalifikowane jako uszkodzenie.
Brak miejsca na kopię przerywa transakcję, zamiast dopuścić destrukcyjną podmianę.

## Ograniczenia i kod poza zakresem

- `src/scenes/run.ts:745` (`showMap`) utrwala stan wyłącznie przy wejściu na mapę;
  `src/scenes/run.ts:211` nalicza kredyty za zabójstwo tylko w pamięci. F5 przed
  kolejnym zapisem cofa te kredyty i niezapisany wybór nagrody. Plik nie jest na
  liście dozwolonych zmian. Pełne wznowienie pokoju wymaga również decyzji o stanie
  przeciwników i zapobieganiu ponownemu pobieraniu nagród; samo zapisywanie salda
  nie wystarczy.
- `src/scenes/run.ts:403`: timeout rozliczenia nagrody korzysta z czasu ściennego.
  Jest to watchdog operacji I/O, nie timer rozgrywki — powinien działać w pauzie.
- `src/scenes/mission.ts:111`: kontynuacja z brakującym/nieczytelnym checkpointem
  nadal nie może wznowić misji. Zabezpieczenie magazynu nie odtwarza brakujących
  danych i nie zmienia obsługi tego stanu w chronionej scenie.
- Muzyka jest celowo wyłączana przez istniejący warunek `webdriver` / `fx=lite`.
  E2E sprawdza stan wspólnego AudioContext, a nie odsłuch muzyki.
- Ustawienia localStorage nie są częścią migracji postępu IndexedDB.

## Weryfikacja

- `tests/unit/reliability.test.ts`: migracje v1–v5, przyszłe meta/run/mission,
  brakujące pola i niepoprawny JSON, kopie, abort transakcji, timery dwóch trybów,
  wznowienie bez klatek RAF w tle.
- `tests/e2e/reliability.spec.ts`: ukrycie karty przez 5 s i wznowienie, pauza
  przez 5 s, F5 z zapisanymi kredytami i implantem, start z uszkodzonym/przyszłym
  zapisem oraz zrzuty komunikatów. Limit każdego testu: 60 s; wszystkie poll mają
  jawne timeouty. Ukrycie karty jest symulowane zmianą `document.hidden` i emisją
  `visibilitychange`, nie przez sterowanie kartą systemu operacyjnego.
- Ręcznie: w walce Alt-Tab i Esc, odczekać 5 s, wznowić, sprawdzić ruch myszy oraz
  zatrzymanie i kontynuację muzyki. F5 po nagrodzie odtwarza mapę; F5 przed zapisem
  nadal cofa do poprzedniego punktu.

## Wyniki poleceń (18.11.2026)

- `npx.cmd tsc --noEmit -p .`: kod 0.
- `npx.cmd eslint` dla trzech zmienionych plików źródłowych i dwóch nowych plików
  testowych: kod 0.
- Vitest dla save, loop, input, runScene, runMeta, music, audio i reliability:
  `Test Files 8 passed (8)`, `Tests 143 passed (143)`.
- `npx.cmd vitest run`: `Test Files 2 failed | 223 passed (225)`,
  `Tests 2 failed | 2338 passed (2340)`. Niepowodzenia: próg 6 ms w arenaPerf
  (19.376 ms przy równoległym obciążeniu) i timeout 20 s w arenaEnemies.
  Powtórki osobno: arenaPerf `5 passed`, arenaEnemies `6 passed`.
  Dodatkową powtórkę całego zestawu z `--maxWorkers=2` przerwano po ponad ośmiu
  minutach bez końcowego wyniku i przy silnym spowolnieniu środowiska.
- Playwright: scenariusze ukrycia karty, pauzy i przyszłego zapisu przeszły
  w końcowym przebiegu z `--global-timeout=180000`; runner zgłosił
  `3 passed (3.0m)`, `2 did not run` oraz timeout zestawu i jego teardown.
  Start z uszkodzonym zapisem i F5 przechodziły we wcześniejszych przebiegach.
  Cały plik e2e nie ma potwierdzonego zielonego zakończenia.
  Końcowe osobne próby `--grep uszkodzonym` i `--grep F5`: oba testy zaliczone;
  po asercjach ręcznie zatrzymano wyłącznie proces preview utworzony przez
  dany test, aby odblokować teardown runnera. Próba uszkodzonego zapisu:
  `1 passed (58.2s)`, kod 0; F5: `1 passed (1.3m)`, kod 0
  (sam test 36.0 s; pozostały czas to build i sprzątanie serwera).
  Nie zmieniano konfiguracji Playwright.
- Build Vite używany przez Playwright uruchomił preview; pozostaje ostrzeżenie
  o chunkach powyżej 500 kB.
- `npx.cmd prettier --check .`: kod 1, istniejące różnice formatowania w 45
  plikach poza zmianą (m.in. docs/fabula, tools i graphify-out).
  Sprawdzenie wszystkich sześciu plików tego zadania: kod 0,
  `All matched files use Prettier code style!`.
- `git diff --check`: kod 0. Bez commitów, zmiany zależności i SAVE_VERSION.
- Przegląd własny wykonany; niezależne review Architekta oraz testy mutacyjne
  nie zostały wykonane. Projekt nie ma skonfigurowanego runnera mutacji;
  nie instalowano nowych zależności. Nie deklarujemy zamknięcia całego etapu.

PowerShell blokuje uruchamianie `npx.ps1`; użyto istniejącego `npx.cmd`, bez
zmiany polityki wykonywania skryptów. Timeout runnera Playwright nie jest
potwierdzonym błędem gry ani potwierdzoną odmową piaskownicy.
