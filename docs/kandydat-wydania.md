# S10-02 — przejście dema na jednym zapisie

## Zakres automatu

Plik: `tests/e2e/demoPath.spec.ts`. Jeden test, jedna strona i jeden kontekst
Playwright, bez resetowania zapisu pomiędzy etapami. Wszystkie trzy misje dema
są poziomami liniowymi (scena `mission`) i startują tak, jak u gracza:
tablica misji w kryjówce → odprawa → „Rozpocznij misję”.

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
4. M03 „List przewozowy”: cztery spotkania przed terminalem (każde otwiera
   swoją bramę), pełna obrona terminala — 2 s połączenia i 90 s transferu
   w strefie, z posiłkami na progach 25/55/85% — brama dokowa, punkt kontrolny
   `dok`, wyjście.
5. M06 „Odlewnia”: pięć spotkań z bramami, punkt kontrolny `przed-arena`,
   arena z zamkniętymi wrotami, trzy fazy Brandta zabite przez system obrażeń,
   serwer w gabinecie, winda towarowa.
6. Powtórka M01, M03 i M06 na tym samym zapisie.
7. Końcowa tablica: trzy misje „Ukończona”, kampania bez oczekującego debriefu.

Po każdej misji (sześć razy): podsumowanie → kryjówka → debrief → zakończenie
rozmowy → reload strony. Po reloadzie cały stan meta (kampania, waluty,
historia rozliczeń, naszywki) musi być identyczny ze stanem sprzed odświeżenia,
a debrief nie może się pojawić ponownie.

Przed każdym startem tablica jest sprawdzana względem postępu kampanii:
M03 jest „Zablokowana” do ukończenia M01, M06 do ukończenia M03, ukończone
misje mają status „Ukończona”, a żadna nie ma „Wkrótce”.

Każdy etap ma `test.step` i nazwane limity `expect.poll`. Załączniki Playwright
`demo-rc-etapy`, `demo-rc-nagrody` i `demo-rc-bledy` powstają również przy
niepowodzeniu. Test zbiera wszystkie `console.error` i `pageerror` od pierwszej
nawigacji do końca; lista dozwolonych wyjątków (`ALLOWED_ERRORS`) jest pusta.

## Nagrody i debug

Reguła (`docs/systems/missions.md`): pierwsze ukończenie misji liniowej daje
zwykłe nagrody runu i jednorazowy bonus `firstClear`, powtórka — same zwykłe
nagrody. Zwykła nagroda na Poziomie zagrożenia 0 to premia za zwycięstwo:
50 XP, 30 Danych, 3 Rdzenie. `firstClear`: M01 60 Danych, M03 95 Danych
i 1 Rdzeń, M06 150 Danych i 3 Rdzenie.

Asercje po każdej misji: dokładna nagroda rozliczonej próby (z `firstClear`
lub bez), różnice XP, Danych i Rdzeni równe nagrodzie próby plus nagrodom nowo
zdobytych naszywek, jedna nowa pozycja w `appliedRunIds` i unikalność
identyfikatorów prób.

Użyte komendy:

| Komenda                   | Cel                                                          | Pomija logikę ukończenia celu?                            |
| ------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| `tp x z yaw pitch floorY` | Przeniesienie do strefy spotkania, celu, punktu kontroli     | Nie; silnik nadal sprawdza pozycję, kolejność i czas      |
| `encounter clear`         | Usunięcie wrogów aktywnych spotkań (M03, M06)                | Nie celu; pomija walkę — spotkanie liczy się jako wygrane |
| `kill all`                | Obrażenia śmiertelne: fazy Brandta, ostatnia fala samouczka  | Nie; pozostają zdarzenia śmierci i fazy bossa             |
| `timescale 0.1`, `1`, `4` | Precyzyjne ćwiczenia samouczka; przyspieszenie transferu M03 | Nie; nadal naliczany jest wymagany czas symulacji         |
| `god`                     | Ochrona przed śmiercią podczas automatyzacji                 | Nie                                                       |
| `hub open missions`       | Otwarcie tablicy misji                                       | Omija dojście do stacji, nie cele misji                   |
| `objective done exit`     | Jedna kontrola negatywna w M03 przed transferem              | Oczekiwany wynik to odmowa („Cel niedostępny.”)           |

Żaden cel nie jest oznaczany komendą jako ukończony. Automat nie używa
`campaign complete`, `checkpoint`, `tutorial step`, komend przyznających waluty
ani bezpośrednich zapisów do bazy. To więcej niż we wzorcowym
`missionList.spec.ts`, który kończy terminal i wyjście M03 komendą
`objective done`.

Seed wszystkich URL: `demo-rc`. Init script dodaje brakujący parametr po
nawigacjach menu/kryjówki, zanim uruchomi się gra; nie zmienia zapisu ani celów.
Misje dostają seed przez pole na tablicy.

## Wyniki

**Automat przechodzi: cała kampania dema jest do ukończenia z tablicy misji
na jednym zapisie.** Trzy kolejne przebiegi zielone (jeden pojedynczy
i wymagana seria `--repeat-each=2`), w każdym zero `console.error` i zero
`pageerror`, końcowo 300 XP, 530 Danych, 25 Rdzeni i dokładnie trzy ukończone
misje. Nie wykryto utraty postępu po reloadzie ani powtórnego przyznania
`firstClear`. Automat nie znalazł błędu gry.

### Czasy etapów

Sekundy czasu ściennego z załącznika `demo-rc-etapy`. Chromium headless,
SwiftShader, `fx=lite`, port 4215, w tle pracowały inne procesy. Liczby opisują
koszt automatu, nie czas przejścia ani wydajność gry na GPU gracza.

| Etap                         | Przebieg 1 | Przebieg 2 | Przebieg 3 |
| ---------------------------- | ---------: | ---------: | ---------: |
| Pusty zapis i menu           |        0,5 |        0,6 |        0,6 |
| Samouczek i kryjówka         |      133,4 |      118,9 |      124,8 |
| M01, debrief, reload         |       62,5 |       61,7 |       58,2 |
| M03, debrief, reload         |      108,4 |       72,4 |       60,7 |
| M06, debrief, reload         |       53,7 |      104,1 |       51,8 |
| Powtórka M01 i reload        |       63,1 |       82,9 |       55,8 |
| Powtórka M03 i reload        |       66,8 |       69,7 |       64,4 |
| Powtórka M06 i reload        |       61,3 |       50,4 |       73,9 |
| Końcowa tablica              |        0,3 |        0,4 |        0,7 |
| Cały test według Playwrighta |    9,2 min |    9,4 min |    8,3 min |

Poprzednia wersja (M03/M06 przez warstwy runu) trwała 17–19 min na przebieg.

### Dowód rozliczenia

Wszystkie trzy przebiegi uzyskały te same wartości (załącznik `demo-rc-nagrody`).

| Próba        | Nagroda próby: XP / Dane / Rdzenie | Nowe naszywki (Dane / Rdzenie)                   | Stan po reloadzie: XP / Dane / Rdzenie |
| ------------ | ---------------------------------- | ------------------------------------------------ | -------------------------------------- |
| M01 pierwsza | 50 / 90 / 3                        | „Cisza w Niecce” (20 / 0), „Pierwsze zwycięstwo” | 50 / 110 / 3                           |
| M03 pierwsza | 50 / 125 / 4                       | „List w ręku” (25 / 0)                           | 100 / 260 / 7                          |
| M06 pierwsza | 50 / 180 / 6                       | „Ja tylko dowożę” (0 / 2)                        | 150 / 440 / 15                         |
| M01 powtórka | 50 / 30 / 3                        | —                                                | 200 / 470 / 18                         |
| M03 powtórka | 50 / 30 / 3                        | „Weteran hut” (0 / 1)                            | 250 / 500 / 22                         |
| M06 powtórka | 50 / 30 / 3                        | —                                                | 300 / 530 / 25                         |

Różnica między pierwszą próbą a powtórką jest w każdej misji równa `firstClear`.

### Wyniki poleceń

```text
npm run typecheck   → tsc --noEmit, exit 0
npm run lint        → eslint ., exit 0
npx playwright test -c pw.b.config.ts tests/e2e/demoPath.spec.ts --repeat-each=2
  ✓  1 … S10-02: całe demo na jednym zapisie (9.4m)
  ✓  2 … S10-02: całe demo na jednym zapisie (8.3m)
  2 passed (17.9m)
```

`pw.b.config.ts` był tymczasową kopią konfiguracji z portem 4215 (równoległa
praca w innych worktree) i został usunięty po testach. Nie uruchamiano całego
e2e ani testów jednostkowych.

Pierwsza próba nowej wersji zatrzymała się w samouczku na podwójnym skoku:
krótkie naciśnięcie spacji wypadło między klatkami obciążonej maszyny. To
słabość automatu, nie gry — ćwiczenie jest teraz ponawiane od pozycji startowej,
tak jak wcześniej combo i parowanie.

## Luki pokrycia

- Teleporty nie dowodzą drożności poziomu ani czytelności nawigacji; bramy są
  sprawdzane w stanie gry (`openGates`), nie przez przejście kolizji.
- `encounter clear` pomija walkę w spotkaniach M03 i M06 (także posiłki
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

## Do wyjaśnienia

`docs/systems/missions.md` (opis nagród misji liniowej) podaje, że przy
`roomsCleared` = 0 i `elitesCleared` = 0 „liczą się zabójstwa i premia za
zwycięstwo”, a `src/scenes/mission.ts:507` przekazuje do rozliczenia
`kills: 0`. Nagroda nie zależy więc od liczby zabitych; automat i
`missionLinear.spec.ts` oczekują samej premii za zwycięstwo. Do decyzji, czy
poprawić zdanie w dokumencie, czy liczyć zabójstwa w scenie.
