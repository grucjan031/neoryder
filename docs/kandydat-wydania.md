# S10-02 — przejście dema na jednym zapisie

## Zakres automatu

Plik: `tests/e2e/demoPath.spec.ts`. Jeden test, jedna strona i jeden kontekst
Playwright, bez resetowania zapisu pomiędzy etapami. `helpers.ts` i kod gry
pozostają niezmienione. Nie wykonano commitów, instalacji ani zmian konfiguracji.

Ścieżka:

1. Pusty kontekst (kontrola `storageState` z IndexedDB), menu i przycisk
   „Samouczek”. Produkcyjne menu nie ma przycisku „Nowa gra”; dostępne są
   „Samouczek” i „Kryjówka”. Debugowy wybór nowego runu nie jest startem kampanii.
2. Wszystkie ćwiczenia samouczka: znaczniki, podwójny skok, doskok i ślizg,
   trzy ciosy combo, ciężki cios, dwa parowania, przegrzanie i chłodzenie,
   Pchnięcie w ścianę, wykończenie, ostatnia fala. Kontrola znacznika ukończenia
   w localStorage i powrót przyciskiem do kryjówki.
3. Tablica → odprawa M01 → cele `mast-1`, `mast-2`, `helix`, `mast-3`, `exit`
   → podsumowanie → debrief → reload. Kontrola całego stanu meta, nie tylko walut.
4. Kontrola dostępności M03 bezpośrednio po pierwszym ukończeniu M01.
   Dalsza diagnostyka wariantu run przez URL,
   na tym samym zapisie: siedem warstw, pełny transfer terminala i brama,
   debrief i reload.
5. Kontrola dostępności M06 bezpośrednio po pierwszym ukończeniu M03.
   Siedem warstw, zabicie bossa przez system obrażeń, serwer, winda, debrief i reload.
6. Końcowa kampania ma dokładnie trzy ukończone misje, bez oczekującego debriefu.
7. Dopiero teraz powtórki M01, M03 i M06 z kontrolą D6 i reloadem po każdej.
   Powtórka M01 nie daje nagrody runu; M03/M06 dają zwykłe nagrody, bez firstClear.

Każdy etap ma `test.step`, nazwane limity `expect.poll` i log czasu.
Załączniki Playwright `demo-rc-etapy` i `demo-rc-bledy` powstają również przy
niepowodzeniu. Test zbiera wszystkie `console.error` i `pageerror` od pierwszej
nawigacji do końca; lista wyjątków jest pusta.

## Nagrody i debug

M01: firstClear = 60 Danych, osobno 20 Danych z naszywki „Cisza w Niecce”.
M03: firstClear = 95 Danych i 1 Rdzeń. M06: 150 Danych i 3 Rdzenie.
Asercje porównują różnice XP, Danych i Rdzeni ze zwykłą nagrodą runu,
firstClear i nagrodami nowo zdobytych naszywek. Każda powtórka oczekuje zerowego
firstClear; zwykłe nagrody runów M03/M06 pozostają dozwolone przez D6.
Sprawdzana jest też liczba i unikalność identyfikatorów rozliczonych prób.

Użyte komendy:

| Komenda                                       | Cel                                                              | Pomija logikę ukończenia celu?                       |
| --------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| `tp x z yaw pitch floorY`                     | Przeniesienie do znacznika/celu                                  | Nie; silnik nadal sprawdza pozycję, kolejność i czas |
| `timescale 0.1`, `timescale 1`, `timescale 4` | Precyzyjne ćwiczenia samouczka; przyspieszenie runów i transferu | Nie; nadal naliczany jest wymagany czas symulacji    |
| `god`                                         | Ochrona przed śmiercią podczas automatyzacji                     | Nie                                                  |
| `kill all`                                    | Zwykłe obrażenia śmiertelne, także kolejne fazy bossa            | Nie; pozostają zdarzenia śmierci i fale              |
| `hub open missions`                           | Otwarcie tablicy misji                                           | Omija dojście do stacji, nie cele misji              |

Nie używa `objective done`, `campaign complete`, `tutorial step`, `run clear`,
`encounter clear`, komend przyznających waluty ani bezpośrednich zapisów do bazy.
Seed wszystkich URL: `demo-rc`. Init script dodaje brakujący parametr po
nawigacjach menu/kryjówki, zanim uruchomi się gra; nie zmienia zapisu ani celów.
M01 dostaje seed również przez pole tablicy, M03/M06 przez diagnostyczny URL.
Wewnętrzne pole `run.seed` samouczka ma stałą `tutorial`
(`src/scenes/tutorial.ts`), ale RNG kontekstu startuje z `demo-rc`.

## Wyniki i ograniczenia

**Demo nie spełnia kryterium kandydata do wydania: tablica blokuje M03 i M06.**
Wszystkie trzy przebiegi sprawdziły samouczek, misje, powtórki D6 i reloady;
dopiero na końcu otrzymały `fixme` za potwierdzone blokady tablicy.
Nie są to testy pominięte przed wykonaniem ani trzy zielone przejścia interfejsu gracza.
Nie wykryto utraty postępu ani powtórnego przyznania firstClear w sprawdzonym
zakresie. W każdym przebiegu: zero `console.error`, zero `pageerror`, końcowo
1060 XP, 801 Danych, 25 Rdzeni i dokładnie trzy ukończone misje.

### Czasy etapów

Sekundy czasu ściennego, z logów i załącznika `demo-rc-etapy`. Chromium headless,
SwiftShader, `fx=lite`; debug spowalnia precyzyjne ćwiczenia i przyspiesza runy.
Te liczby opisują koszt automatu, nie czas przejścia ani wydajność gry na GPU gracza.

| Etap                                    | Przebieg 1 | Przebieg 2 | Przebieg 3 |
| --------------------------------------- | ---------: | ---------: | ---------: |
| Pusty zapis i menu                      |      3,103 |      6,388 |      5,722 |
| Samouczek i kryjówka                    |     80,330 |    115,439 |     94,346 |
| M01, debrief, reload                    |     50,925 |     77,470 |     77,315 |
| Tablica M03, potwierdzenie po reloadzie |      8,992 |     24,709 |     17,052 |
| M03, debrief, reload                    |    180,887 |    309,297 |    225,321 |
| Tablica M06, potwierdzenie po reloadzie |     35,792 |     34,947 |     14,315 |
| M06, debrief, reload                    |    216,619 |    183,393 |    209,240 |
| Powtórka M01 i reload                   |     90,621 |     50,158 |    109,036 |
| Powtórka M03 i reload                   |    279,232 |    132,306 |    175,996 |
| Powtórka M06 i reload                   |    176,107 |     99,471 |    188,197 |
| Suma etapów (bez builda i fixture)      |   1122,608 |   1033,578 |   1116,540 |

### Dowód rozliczenia D6

Wszystkie trzy przebiegi uzyskały poniższe wartości. Zwykła część nagrody jest
niezależnie liczona z warstw, elit i zabójstw, a naszywki rozliczane osobno.

| Próba        | Nagroda runu: XP / Dane / Rdzenie | Naszywki: Dane / Rdzenie | Stan po reloadzie: XP / Dane / Rdzenie |
| ------------ | --------------------------------- | ------------------------ | -------------------------------------- |
| M01 pierwsza | 0 / 60 / 0                        | 20 / 0                   | 0 / 80 / 0                             |
| M03 pierwsza | 225 / 219 / 4                     | 50 / 0                   | 225 / 349 / 4                          |
| M06 pierwsza | 305 / 239 / 8                     | 0 / 4                    | 530 / 588 / 16                         |
| M01 powtórka | 0 / 0 / 0                         | 0 / 0                    | 530 / 588 / 16                         |
| M03 powtórka | 225 / 124 / 3                     | 0 / 1                    | 755 / 712 / 20                         |
| M06 powtórka | 305 / 89 / 5                      | 0 / 0                    | 1060 / 801 / 25                        |

Różnica firstClear M03: 95 Danych i 1 Rdzeń; M06: 150 Danych i 3 Rdzenie.
Dodatkowy Rdzeń z powtórki M03 pochodzi z nowej naszywki „Weteran hut”.

### Wyniki poleceń

Ostatnie wyniki sprawdzeń kodu (po review i zmianie kolejności etapów):

```text
> neoryder@0.0.0 typecheck
> tsc --noEmit
typecheck: exit=0, czas=15,07s

> neoryder@0.0.0 lint
> eslint .
lint: exit=0, czas=14,92s
```

Wymagana seria `npx playwright test tests/e2e/demoPath.spec.ts --repeat-each=3`:

```text
  -  1 tests\e2e\demoPath.spec.ts:415:1 › S10-02: całe demo na jednym zapisie
  -  2 tests\e2e\demoPath.spec.ts:415:1 › S10-02: całe demo na jednym zapisie
  -  3 tests\e2e\demoPath.spec.ts:415:1 › S10-02: całe demo na jednym zapisie

  3 skipped
Playwright: exit=0, czas=3 486,93s
```

Cała komenda: 58 min 6,93 s, wraz z buildem, fixture i oczekiwaniem na zamknięcie
serwera. Wynik oznacza trzy **udokumentowane fixme po wykonaniu diagnostyki**,
nie trzy zaliczone ścieżki z tablicy. Asercje nowych błędów i błędów konsoli
pozostają twarde, przed końcowym `test.fixme`.

### Potwierdzona blokada: M03 nie jest dostępna po M01

- Miejsce: `src/ui/hub/missionsPanel.ts:332` — `button.disabled = !mission.level || missing.length > 0`.
  Definicja `src/data/missions/m03-list-przewozowy.json:2` nie ma `level`.
- Odtworzenie: świeży zapis → samouczek → M01 → wszystkie cele → kryjówka →
  zakończenie debriefu → reload → tablica. M01 znajduje się w `campaign.completed`,
  a przycisk M03 jest nadal wyłączony („Wkrótce”).
- Skutek: **blokada ukończenia kampanii dema przez interfejs gracza**.
  Jest to jawne ograniczenie obecnej implementacji, nie wykazana regresja.
- Potwierdzenie: dwa niezależne przebiegi, każdy po rzeczywistym ukończeniu M01
  i kontroli zapisu; nazwane asercje dostępności wygasły po 59,299 i 59,501 s.
- `fixme` jest odroczone do końca testu. Pozostałe kroki, nagrody, zapis oraz
  błędy konsoli nadal są sprawdzane. Nowa awaria nie jest zamieniana w pominięcie.
  Playwright nie oferuje `test.fixme` ograniczonego do kroku; dlatego wywołanie
  następuje dopiero po całej diagnostyce, a blokady mają osobne adnotacje.
  Każdy nowy przebieg ponownie potwierdza wyłączony przycisk przed i po reloadzie,
  przy identycznym stanie meta. Gdy blokada zniknie, automat wybierze przycisk
  tablicy zamiast URL (nowa implementacja liniowa wymaga dostosowania celów testu).

Źródło reguł nagród: `docs/plan-rozwoju-2026-2027.md:81` (D6),
`src/progression/meta.ts:257` (nagrody misji liniowych),
`src/progression/meta.ts:267` (firstClear tylko przy pierwszym ukończeniu).

### Potwierdzona blokada: M06 nie jest dostępna po M03

- Miejsce: `src/ui/hub/missionsPanel.ts:332` oraz
  `src/data/missions/m06-odlewnia.json:2` — również brak pola `level`.
- Odtworzenie: po M01 uruchomić diagnostyczny wariant M03 przez URL,
  przejść siedem warstw, terminal i bramę, zakończyć debrief, odświeżyć,
  otworzyć tablicę. M03 jest zapisana jako ukończona, M06 nadal ma „Wkrótce”.
- Skutek: **blokada wejścia do finału dema przez interfejs gracza**.
- Potwierdzenie: wyłączony przycisk przed i po dodatkowym reloadzie przy
  identycznym stanie meta. Ponowne sprawdzenie wykonywane w każdym przebiegu.
  To ta sama jawna reguła dostępności, a nie wykazana utrata zapisu.
- Obejrzane zrzuty: `m03-list-przewozowy-tablica.png` i
  `m06-odlewnia-tablica.png` w katalogu wyniku tego testu (`test-results/`).

Pierwsze próby automatu ujawniły błędy samego testu: niejednoznaczny selektor
`canvas` (scena plus trzy canvasy statystyk) i synchronizację wejścia w trybie
`fx=lite`. Poprawiono wybór sceny po etykiecie oraz tempo precyzyjnych ćwiczeń.
Nie sklasyfikowano tych niepowodzeń jako błędów gry.
Review poprawił także wybór wyłącznie dostępnego węzła mapy i sprawdzanie
odblokowań przed powtórkami nagród. Lokalny skill `code-review`, wspomniany przez
`etap`, nie był dostępny; przegląd wykonano samodzielnie, bez delegacji.

Uruchomienie zwykłego polecenia Playwright zatrzymało się przed testami:
`EPERM ... node_modules/.vite-temp/vite.config.ts.timestamp-....mjs`.
`node_modules` jest junction do sąsiedniego repozytorium, poza obszarem zapisu.
Do uruchomień użyto natywnego loadera konfiguracji Vite przez argument procesu
`--configLoader native`; pliki konfiguracji i zależności nie zostały zmienione.
PowerShell blokuje `npm.ps1`, więc użyto równoważnych `npm.cmd` i `npx.cmd`.

Odtworzenie uruchomienia w tym sandboxie (parametr loadera tylko w procesach Vite):

```powershell
$demoLoader = 'if (process.argv[1]?.replaceAll(String.fromCharCode(92), "/").endsWith("/vite.js")) process.argv.push("--configLoader", "native");'
$env:NODE_OPTIONS = '--import=data:text/javascript;base64,' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($demoLoader))
npx.cmd playwright test tests/e2e/demoPath.spec.ts --repeat-each=3
```

Przed startami sprawdzano `netstat -ano` dla portu 4173. Jedna próba startu
została odrzucona, gdy kończył się jeszcze własny poprzedni runner; dalsze
uruchomienia następowały po zwolnieniu portu. Nie kończono cudzych procesów.
Nie uruchamiano całego e2e, unitów ani innych zestawów poza wskazanymi w zleceniu.
Build wykonał sam `webServer` Playwrighta.

**Ograniczenie środowiska:** po komunikacie o trzecim zakończonym teście runner
czekał na zamknięcie własnego Vite. Zweryfikowano PID 23592: start 13:25:22,
sekundę po buildzie tego worktree (22.11.2026). Zamknięto wyłącznie ten proces.
Runner natychmiast wypisał `3 skipped` i zakończył się kodem 0; ponowny `netstat`
potwierdził wolny port 4173. Nie uzyskano więc całkowicie samoczynnego cleanupu
`webServer` w tym sandboxie. Nie zmieniano konfiguracji, nie przypisano tego
problemu kodowi gry i nie oznaczono go jako błędu kampanii.

Luki pokrycia: teleporty nie dowodzą drożności poziomu, kompletności spotkań
ani czytelności nawigacji. God mode i debugowe obrażenia nie sprawdzają balansu
walki. Wariant run M03/M06 nie zastępuje przejścia misji liniowych z tablicy.
Nie badano awarii dysku, śmierci ani wznowienia przerwanej misji — tutaj
odświeżenia następują po zapisanym debriefie. Test nie zastępuje playtestu.
Wejście myszy jest syntetyczne; test nie sprawdza pointer lock ani ręcznego
celowania. Sprawdza trwałe wpisy kampanii, naszywki i waluty, nie ocenia treści
ponownie wyświetlanego debriefu. Niezależne review Architekta pozostaje do wykonania.
