# S10-02 — przejście dema na jednym zapisie

## Zakres automatu

Plik: `tests/e2e/demoPath.spec.ts`. Jeden test, jedna strona i jeden kontekst
Playwright, bez resetowania zapisu pomiędzy etapami. Wszystkie siedem misji
(M01–M07 w kolejności kampanii) to poziomy liniowe (scena
`mission`) i startują tak, jak u gracza: tablica misji w kryjówce → odprawa →
„Rozpocznij misję”.

Ścieżka:

1. Pusty kontekst (kontrola `storageState` z IndexedDB), menu i przycisk
   „Samouczek”. Produkcyjne menu nie ma przycisku „Nowa gra”; dostępne są
   „Samouczek” i „Kryjówka”.
2. Wszystkie ćwiczenia samouczka: znaczniki, podwójny skok, doskok i ślizg,
   trzy ciosy combo, ciężki cios, dwa parowania, przegrzanie i chłodzenie,
   Pchnięcie w ścianę, wykończenie, ostatnia fala. Kontrola znacznika ukończenia
   w localStorage i powrót przyciskiem do kryjówki.
3. M01 „Maszty”: cele `mast-1`, `mast-2`, `helix`, `mast-3`, `exit` przez
   wejście w strefę każdego celu.
4. M02 „Punkt kontrolny”: trzy spotkania z bramami, trzy cele-rygle z pościgami
   (po drugim Nadia dołącza do drużyny), punkt kontrolny `zbiorka`, osłona
   suwnicy, Egzekutor zabity przez system obrażeń, zachodnia brama, punkt
   kontrolny `ewakuacja`, wyjście.
5. M03 „List przewozowy”: cztery spotkania przed terminalem (każde otwiera
   swoją bramę), pełna obrona terminala — 2 s połączenia i 90 s transferu
   w strefie, z posiłkami na progach 25/55/85% — brama dokowa, punkt kontrolny
   `dok`, wyjście.
6. M04 „Ładunek klasy K”: eskorta wagonu — pięć celów postojów (`objective
done`), Egzekutor, wagon przeskakiwany komendą `payload skip` do końca trasy,
   wyjście.
7. M05 „Adiutant”: pościg, tylna straż, estakada, suwnice, lądowisko ze
   snajperami i osłoną, przejęcie karty, wyjście.
8. M06 „Odlewnia”: pięć spotkań z bramami, punkt kontrolny `przed-arena`,
   arena z zamkniętymi wrotami, walka z Brandtem przez system obrażeń,
   serwer w gabinecie, winda towarowa.
9. M07 „Nocny dyżur”: krata, cichy pas przy ścianie i alarm na środku hali,
   wieżyczka magazynu, kapsuła, obrona transferu z posiłkami, trzy spotkania
   na targu i winda towarowa.
10. Powtórka M01–M07 na tym samym zapisie.
11. Końcowa tablica pokazuje siedem misji „Ukończona”. Kampania nie ma oczekującego debriefu.

Po każdej z czternastu prób automat przechodzi z podsumowania do kryjówki,
kończy rozmowę i przeładowuje stronę. Po reloadzie cały stan meta (kampania, waluty,
historia rozliczeń, naszywki) musi być identyczny ze stanem sprzed odświeżenia,
a debrief nie może się pojawić ponownie.

Przed każdym startem tablica jest sprawdzana względem postępu kampanii:
M02–M07 czekają na ukończenie poprzedniej misji (wymagania z `src/data/missions/*.json`).
Ukończone misje mają status „Ukończona”.

Każdy etap ma `test.step` i nazwane limity `expect.poll`. Załączniki Playwright
`demo-rc-etapy`, `demo-rc-nagrody` i `demo-rc-bledy` powstają również przy
niepowodzeniu. Test zbiera wszystkie `console.error` i `pageerror` od pierwszej
nawigacji do końca; lista dozwolonych wyjątków (`ALLOWED_ERRORS`) jest pusta.

## Nagrody i debug

Reguła (`docs/systems/missions.md`): pierwsze ukończenie misji liniowej daje
zwykłe nagrody runu i jednorazowy bonus `firstClear`, powtórka — same zwykłe
nagrody. Na Poziomie zagrożenia 0 premia za zwycięstwo wynosi 50 XP, 30 Danych
oraz 3 Rdzenie. Każde zabójstwo gracza dodaje 1 Daną. Bonus `firstClear`
wynosi 60 Danych w M01, a w M07 90 Danych i 1 Rdzeń.

Po każdej misji automat sprawdza dokładną nagrodę próby z uwzględnieniem
zabójstw i jednorazowego `firstClear`. Sprawdza też przyrost zabójstw w meta,
różnice XP, Danych i Rdzeni wraz z nagrodami za nowe naszywki oraz jeden nowy,
unikalny identyfikator próby w `appliedRunIds`.

Użyte komendy:

| Komenda                   | Cel                                                          | Pomija logikę ukończenia celu?                            |
| ------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| `tp x z yaw pitch floorY` | Przeniesienie do strefy spotkania, celu, punktu kontroli     | Nie; silnik nadal sprawdza pozycję, kolejność i czas      |
| `encounter clear`         | Usunięcie wrogów aktywnych spotkań bez kredytu gracza        | Oznacza spotkanie jako wygrane                          |
| `kill all`                | Obrażenia ze źródłem gracza, m.in. walka z Brandtem          | Uruchamia system obrażeń, fazy bossa i nalicza zabójstwa |
| `timescale 0.1`, `1`, `4` | Precyzyjne ćwiczenia samouczka; przyspieszenie transferu M03 | Nie; nadal naliczany jest wymagany czas symulacji         |
| `god`                     | Ochrona przed śmiercią podczas automatyzacji                 | Nie                                                       |
| `hub open missions`       | Otwarcie tablicy misji                                       | Omija dojście do stacji, nie cele misji                   |
| `objective done`          | Kontrole kolejności celów oraz skrócona eskorta wagonu w M04 | Przed spełnieniem zależności komenda zwraca odmowę        |

Automat nie używa
`campaign complete`, `checkpoint`, `tutorial step`, komend przyznających waluty
ani bezpośrednich zapisów do bazy. To więcej niż we wzorcowym
`missionList.spec.ts`, który kończy terminal i wyjście M03 komendą
`objective done`.

Seed wszystkich URL: `demo-rc`. Init script dodaje brakujący parametr po
nawigacjach menu/kryjówki, zanim uruchomi się gra; nie zmienia zapisu ani celów.
Misje dostają seed przez pole na tablicy.

## Wynik przebiegu M01–M07

Playwright na porcie 4264 z jednym workerem zaliczył kampanię w **12,8 min**.
Wszystkie czternaście prób rozliczono na jednym zapisie. Po każdym reloadzie
automat potwierdził stan meta i wygaszony debrief. Na końcu tablica pokazała
siedem ukończonych misji, a zapis miał 700 XP, 1213 Danych i 53 Rdzenie.
Test zarejestrował zero `console.error` i `pageerror`.

| Próba M07 | Czas z debriefem i reloadem | XP | Dane | Rdzenie |
| --- | ---: | ---: | ---: | ---: |
| Pierwsze ukończenie | 47,2 s | 50 | 120 | 4 |
| Powtórka | 54,4 s | 50 | 30 | 3 |

Różnica w M07 wyniosła dokładnie `firstClear`, czyli 90 Danych i 1 Rdzeń.
Nagroda w obu próbach M06 uwzględniła 1 Daną za zabicie Brandta.
Szczegóły przebiegu są w załącznikach `demo-rc-etapy`, `demo-rc-nagrody`
i `demo-rc-bledy`.

## Wyniki historyczne (M01–M04 i M06)

**Automat przechodzi: cała pięciomisyjna kampania dema jest do ukończenia
z tablicy misji na jednym zapisie.** Jeden przebieg zielony (15,0 min), zero
`console.error` i `pageerror`, końcowo 500 XP, 870 Danych, 39 Rdzeni i dokładnie
pięć ukończonych misji. Nie wykryto utraty postępu po reloadzie ani powtórnego
przyznania `firstClear`. Automat nie znalazł błędu gry.

### Czasy etapów

Sekundy czasu ściennego z załącznika `demo-rc-etapy`. Chromium headless,
SwiftShader, `fx=lite`, port 4245, w tle pracowały inne procesy. Liczby opisują
koszt automatu, nie czas przejścia ani wydajność gry na GPU gracza.

| Etap                         | Pierwsze ukończenie [s] | Powtórka [s] |
| ---------------------------- | ----------------------: | -----------: |
| Pusty zapis i menu           |                     4,9 |            — |
| Samouczek i kryjówka         |                   233,7 |            — |
| M01, debrief, reload         |                   129,0 |         51,9 |
| M02, debrief, reload         |                   107,3 |         41,4 |
| M03, debrief, reload         |                    85,2 |         55,5 |
| M04, debrief, reload         |                    52,8 |         28,5 |
| M06, debrief, reload         |                    64,7 |         43,7 |
| Końcowa tablica              |                     0,4 |            — |
| Cały test według Playwrighta |                15,0 min |            — |

### Dowód rozliczenia

Wartości z załącznika `demo-rc-nagrody`.

| Próba        | Nagroda próby: XP / Dane / Rdzenie | Nowe naszywki                           | Stan po reloadzie: XP / Dane / Rdzenie |
| ------------ | ---------------------------------- | --------------------------------------- | -------------------------------------- |
| M01 pierwsza | 50 / 90 / 3                        | `cisza-w-niecce`, `pierwsze-zwyciestwo` | 50 / 110 / 3                           |
| M02 pierwsza | 50 / 110 / 4                       | —                                       | 100 / 220 / 7                          |
| M03 pierwsza | 50 / 125 / 4                       | `list-w-reku`                           | 150 / 370 / 11                         |
| M04 pierwsza | 50 / 140 / 4                       | —                                       | 200 / 510 / 15                         |
| M06 pierwsza | 50 / 180 / 6                       | `ja-tylko-dowoze`, `weteran-hut`        | 250 / 690 / 24                         |
| M01 powtórka | 50 / 30 / 3                        | —                                       | 300 / 720 / 27                         |
| M02 powtórka | 50 / 30 / 3                        | —                                       | 350 / 750 / 30                         |
| M03 powtórka | 50 / 30 / 3                        | —                                       | 400 / 780 / 33                         |
| M04 powtórka | 50 / 30 / 3                        | —                                       | 450 / 810 / 36                         |
| M06 powtórka | 50 / 30 / 3                        | `dziesiec-prob`                         | 500 / 870 / 39                         |

Różnica między pierwszą próbą a powtórką jest w każdej misji równa `firstClear`
(M02: 80 Danych i 1 Rdzeń; M04: 110 Danych i 1 Rdzeń).

### Wyniki poleceń

```text
npm run typecheck   → tsc --noEmit, exit 0
npm run lint        → eslint ., exit 0
npx playwright test -c pw.dp.config.ts tests/e2e/demoPath.spec.ts
  ✓  1 … S10-02: całe demo na jednym zapisie (15.0m)
  1 passed (15.8m)
```

`pw.dp.config.ts` był tymczasową kopią konfiguracji z portem 4245 (równoległa
praca w innych worktree) i został usunięty po testach. Nie uruchamiano całego
e2e ani testów jednostkowych.

Pierwsza próba nowej wersji zatrzymała się w samouczku na podwójnym skoku:
krótkie naciśnięcie spacji wypadło między klatkami obciążonej maszyny. To
słabość automatu, nie gry — ćwiczenie jest teraz ponawiane od pozycji startowej,
tak jak wcześniej combo i parowanie.

## Luki pokrycia

- Teleporty nie dowodzą drożności poziomu ani czytelności nawigacji; bramy są
  sprawdzane w stanie gry (`openGates`), nie przez przejście kolizji.
- `encounter clear` pomija walkę w spotkaniach M02–M07 (także posiłki
  transferu i pościg); `kill all` i `god` nie sprawdzają balansu. Skład fal,
  trudność i wzorce Brandta nie są oceniane.
- M01 jest przechodzona samymi teleportami do celów, bez spotkań i bram.
- Transfer M03 biegnie przy `timescale 4`; pauza transferu po wyjściu ze strefy
  nie jest sprawdzana.
- Bez śmierci, respawnu z punktu kontrolnego i „Kontynuuj misję” po przerwaniu —
  reloady następują po zapisanym debriefie (to pokrywa `missionLinear.spec.ts`).
- Bez awarii zapisu i ścieżki „Ponów zapis”.
- Treść odprawy, debriefu i radia nie jest oceniana, tylko ich pojawienie się.
- Wejście myszy w samouczku jest syntetyczne; bez pointer lock i ręcznego
  celowania. Tylko Chromium na SwiftShaderze, 1280×720, `fx=lite`.
- Poziom zagrożenia 0 i startowe wyposażenie; zakupy w warsztacie i talenty
  między misjami nie są wykonywane.
- Test nie zastępuje playtestu. Review Architekta pozostaje do wykonania.
