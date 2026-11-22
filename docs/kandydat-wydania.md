# S10-02 — przejście dema na jednym zapisie

## Zakres automatu

Plik: `tests/e2e/demoPath.spec.ts`. Jeden test, jedna strona i jeden kontekst
Playwright, bez resetowania zapisu pomiędzy etapami. Wszystkie pięć misji dema
(M01, M02, M03, M04, M06 — w kolejności kampanii) to poziomy liniowe (scena
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
7. M06 „Odlewnia”: pięć spotkań z bramami, punkt kontrolny `przed-arena`,
   arena z zamkniętymi wrotami, trzy fazy Brandta zabite przez system obrażeń,
   serwer w gabinecie, winda towarowa.
8. Powtórka M01, M02, M03, M04 i M06 na tym samym zapisie.
9. Końcowa tablica: pięć misji „Ukończona”, kampania bez oczekującego debriefu.

Po każdej misji (dziesięć razy): podsumowanie → kryjówka → debrief → zakończenie
rozmowy → reload strony. Po reloadzie cały stan meta (kampania, waluty,
historia rozliczeń, naszywki) musi być identyczny ze stanem sprzed odświeżenia,
a debrief nie może się pojawić ponownie.

Przed każdym startem tablica jest sprawdzana względem postępu kampanii:
M02 jest „Zablokowana” do ukończenia M01, M03 do ukończenia M02, M04 do M03,
M06 do M04 (wymagania z `src/data/missions/*.json`), ukończone misje mają
status „Ukończona”, a żadna nie ma „Wkrótce”.

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
- `encounter clear` pomija walkę w spotkaniach M02, M03, M04 i M06 (także posiłki
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
