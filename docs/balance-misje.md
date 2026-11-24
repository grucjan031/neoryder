# Balans misji aktu I — fale i eskorta

Data wygenerowania (UTC): 2026-11-24. Generator: `npm run balance:missions`.

## Założenia

Poziom normalny, bazowe 100 HP gracza. Kolejność wartości w trójkach: Ostrze / Moc / Strzelec. Symulator z [raportu TTK](balance.md) wybiera dla typu wroga najlepsze combo lub ciężkie cięcie, priorytet mocy albo broń odpowiedniego loadoutu w otwartej przestrzeni. Pierwszy cel kosztuje pojedynczy TTK; każdy kolejny tego typu w tej samej turze kosztuje (TTK paczki − pojedynczy TTK) / 4. Boss korzysta z pojedynczego pomiaru. Dodano 1,5 s dojścia na każdego wroga. Czasy obejmują wyłącznie czyszczenie.

W każdej turze sumujemy DPS najsilniejszych przeciwników do limitu żywych i mnożymy przez skuteczność 35,0% oraz czas czyszczenia daną ścieżką. Sumujemy obrażenia kolejnych tur. To scenariusz utrzymania pełnej presji aż do ostatniego zabójstwa. Tabela pokazuje szczyt DPS po korekcie celności. Kolumna żywych podaje szczyt / maxAlive fali / maxAlive poziomu; dodatkowy limit globalny wynosi 12.

DPS serii = obrażenia pocisku × liczba pocisków / (celowanie + odstępy w serii + odnowienie). W zwarciu cykl obejmuje zapowiedź, aktywne cięcie i dłuższy z czasów odzyskania gotowości i odnowienia. Haker korzysta z cyklu zakłócenia. Dla Brandta sumujemy obrażenia i czasy wzorców każdej fazy, licząc pociski wachlarza i ważąc DPS udziałem fazy w HP. Pomijamy dodatkową osłonę i przywołanych pomocników w presji bossa.

Środek strefy startowej przypisuje starcie do sekcji. W sekcji zachowujemy kolejność wpisów poziomu. W M01 wybuch masztu przekazuje klucz celu przez RoomScene.reinforceMission. W M03 MissionObjectives przekazuje klucz celu i indeks po przekroczeniu progu obrony. MissionScene uruchamia wpis reinforcementFor o tym kluczu; blokada ponownego startu zapobiega podwójnemu naliczeniu posiłków po sabotażu, także przy aktywacji strefy. Spotkania mogą trwać równolegle.

## Dziesięć starć o najwyższej presji

Ranking według największego odsetka HP spośród trzech ścieżek. Propozycje dotyczą prób w playteście.

1. **m01-maszty / oslona-trzeciego** (m01MastThree) — Ostrze, 593,5% HP; sprawdzić skład fali po usunięciu jednej jednostki typu gunner.
2. **m01-maszty / patrol-plac** (m01Assault) — Ostrze, 417,9% HP; sprawdzić maxAlive 8 → 6 (obecny szczyt: 7).
3. **m01-maszty / reinforce-mast-3** (m01Assault) — Ostrze, 417,9% HP; sprawdzić maxAlive 8 → 6 (obecny szczyt: 7).
4. **m01-maszty / oslona-drugiego** (m01MastTwo) — Ostrze, 285,2% HP; sprawdzić maxAlive 8 → 5 (obecny szczyt: 6).
5. **m06-odlewnia / piece** (m06Piece) — Ostrze, 281,8% HP; sprawdzić maxAlive 8 → 5 (obecny szczyt: 6).
6. **m03-list-przewozowy / posterunek-magazynu** (m03Forecourt) — Ostrze, 259,3% HP; sprawdzić maxAlive 8 → 5 (obecny szczyt: 6).
7. **m06-odlewnia / formowanie-tyl** (m06Rozdzielnia) — Ostrze, 258,2% HP; sprawdzić maxAlive 8 → 5 (obecny szczyt: 6).
8. **m01-maszty / patrol-tunel** (m01Patrol) — Ostrze, 209,3% HP; sprawdzić maxAlive 8 → 4 (obecny szczyt: 5).
9. **m01-maszty / patrol-rusztowania** (m01Patrol) — Ostrze, 209,3% HP; sprawdzić maxAlive 8 → 4 (obecny szczyt: 5).
10. **m03-list-przewozowy / poscig** (m03Pursuit) — Ostrze, 209,3% HP; sprawdzić maxAlive 8 → 4 (obecny szczyt: 5).

## Starcia w kolejności sekcji

Flagi ścieżek według niezaokrąglonego wyniku: powyżej 60% HP ciężkie, powyżej 100% zabójcze. Zmiana porównuje średnie z trzech ścieżek z poprzednim starciem, również na granicy misji. Skok oznacza wzrost ponad dwukrotny. Strzałka w składzie oddziela kolejne tury.

### m01-maszty — Maszty

| Sekcja / starcie | Wyzwalacz | Fala i skład tur | HP | Żywi | DPS | Czas (s) | Utrata HP (%) | Flagi ścieżek | Zmiana |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| sluza / patrol-wejscie | strefa | m01Approach: assaulter ×2 | 120 | 2 / 8 / 12 | 7,4 | 4,1 / 3,4 / 3,7 | 30,2 / 25,4 / 27,2 | — / — / — | — |
| targ / oslona-pierwszego | strefa po patrol-wejscie | m01MastOne: assaulter ×2, gunner ×1, turret ×1 | 235 | 4 / 8 / 12 | 15,4 | 7,8 / 6,5 / 6,7 | 119,0 / 99,3 / 103,1 | zabójcze / ciężkie / zabójcze | presja skok ×3,9 |
| targ / reinforce-mast-1 | wybuch mast-1 | missionPatrol: assaulter ×2, gunner ×1 | 165 | 3 / 6 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | czas spadek ×0,8, presja spadek ×0,6 |
| tunel / patrol-tunel | strefa po mast-1 | m01Patrol: assaulter ×3, gunner ×2 | 270 | 5 / 8 / 12 | 21,0 | 10,0 / 8,8 / 9,5 | 209,3 / 184,6 / 200,3 | zabójcze / zabójcze / zabójcze | presja skok ×3,0 |
| dziedziniec / oslona-drugiego | strefa po patrol-tunel | m01MastTwo: assaulter ×3, gunner ×2, turret ×1 | 340 | 6 / 8 / 12 | 24,0 | 11,9 / 10,3 / 11,1 | 285,2 / 247,3 / 265,3 | zabójcze / zabójcze / zabójcze | — |
| dziedziniec / reinforce-mast-2 | wybuch mast-2 | missionPatrol: assaulter ×2, gunner ×1 | 165 | 3 / 6 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | czas spadek ×0,5, presja spadek ×0,2 |
| zaplecze / patrol-rusztowania | strefa po helix | m01Patrol: assaulter ×3, gunner ×2 | 270 | 5 / 8 / 12 | 21,0 | 10,0 / 8,8 / 9,5 | 209,3 / 184,6 / 200,3 | zabójcze / zabójcze / zabójcze | presja skok ×3,0 |
| plac / patrol-plac | strefa po patrol-rusztowania | m01Assault: assaulter ×4, gunner ×3 | 375 | 7 / 8 / 12 | 29,7 | 14,1 / 12,6 / 13,9 | 417,9 / 374,3 / 411,4 | zabójcze / zabójcze / zabójcze | presja skok ×2,0 |
| plac / oslona-trzeciego | strefa po patrol-plac | m01MastThree: assaulter ×4, gunner ×3, turret ×2 | 515 | 8 / 8 / 12 | 32,7 | 18,2 / 16,2 / 17,5 | 593,5 / 527,8 / 573,4 | zabójcze / zabójcze / zabójcze | — |
| plac / reinforce-mast-3 | wybuch mast-3 | m01Assault: assaulter ×4, gunner ×3 | 375 | 7 / 8 / 12 | 29,7 | 14,1 / 12,6 / 13,9 | 417,9 / 374,3 / 411,4 | zabójcze / zabójcze / zabójcze | czas spadek ×0,8, presja spadek ×0,7 |

### m02-punkt-kontrolny — Punkt kontrolny

| Sekcja / starcie | Wyzwalacz | Fala i skład tur | HP | Żywi | DPS | Czas (s) | Utrata HP (%) | Flagi ścieżek | Zmiana |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| kordon / patrol-kordon | strefa | m02Patrol: assaulter ×2, gunner ×1 | 165 | 3 / 6 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | czas spadek ×0,4, presja spadek ×0,2 |
| bocznica / rampa | strefa po patrol-kordon | m02Ramp: gunner ×2, turret ×1 | 160 | 3 / 6 / 12 | 12,9 | 5,6 / 5,0 / 5,2 | 72,7 / 64,0 / 67,2 | ciężkie / ciężkie / ciężkie | czas spadek ×1,0 |
| cele / straz-cel | strefa po rampa | m02Guards: assaulter ×2, gunner ×2 | 210 | 4 / 6 / 12 | 17,3 | 7,8 / 6,9 / 7,4 | 134,9 / 118,9 / 127,6 | zabójcze / zabójcze / zabójcze | — |
| cele / poscig-1 | strefa po cell-1 | m02Pursuit: assaulter ×2 | 120 | 2 / 6 / 12 | 7,4 | 4,1 / 3,4 / 3,7 | 30,2 / 25,4 / 27,2 | — / — / — | czas spadek ×0,5, presja spadek ×0,2 |
| cele / poscig-2 | strefa po cell-2 | m02Pursuit: assaulter ×2 | 120 | 2 / 6 / 12 | 7,4 | 4,1 / 3,4 / 3,7 | 30,2 / 25,4 / 27,2 | — / — / — | — |
| dowodztwo / oslona-suwnicy | strefa po cell-2 | m02Ramp: gunner ×2, turret ×1 | 160 | 3 / 6 / 12 | 12,9 | 5,6 / 5,0 / 5,2 | 72,7 / 64,0 / 67,2 | ciężkie / ciężkie / ciężkie | presja skok ×2,5 |
| dowodztwo / egzekutor | strefa po cell-3 | m02Executor: executor ×1, gunner ×2 | 310 | 3 / 6 / 12 | 15,6 | 6,8 / 5,6 / 6,5 | 106,1 / 86,7 / 100,7 | zabójcze / ciężkie / zabójcze | — |
| dowodztwo / poscig-3 | strefa po cell-3 | m02Pursuit: assaulter ×2 | 120 | 2 / 6 / 12 | 7,4 | 4,1 / 3,4 / 3,7 | 30,2 / 25,4 / 27,2 | — / — / — | czas spadek ×0,6, presja spadek ×0,3 |

### m03-list-przewozowy — List przewozowy

| Sekcja / starcie | Wyzwalacz | Fala i skład tur | HP | Żywi | DPS | Czas (s) | Utrata HP (%) | Flagi ścieżek | Zmiana |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| nabrzeze / patrol-nabrzeze | strefa | m03Quay: assaulter ×2, gunner ×1 | 165 | 3 / 8 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | presja skok ×2,4 |
| plac-celny / oslona-celna | strefa po patrol-nabrzeze | m03Customs: shielder ×1, drone ×2, turret ×1 | 196 | 4 / 8 / 12 | 12,8 | 7,1 / 6,3 / 6,3 | 91,0 / 79,9 / 80,1 | ciężkie / ciężkie / ciężkie | — |
| przedpole / posterunek-magazynu | strefa po oslona-celna | m03Forecourt: shielder ×2, gunner ×2, turret ×2 | 410 | 6 / 8 / 12 | 21,8 | 11,9 / 10,5 / 11,6 | 259,3 / 229,5 / 254,0 | zabójcze / zabójcze / zabójcze | presja skok ×3,0 |
| magazyn / pierwsza-zmiana | strefa po posterunek-magazynu | missionPatrol: assaulter ×2, gunner ×1 | 165 | 3 / 6 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | czas spadek ×0,5, presja spadek ×0,3 |
| magazyn / transfer-1 | terminal:0 przy 25% | missionPatrol: assaulter ×2, gunner ×1 | 165 | 3 / 6 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | — |
| magazyn / transfer-2 | terminal:1 przy 55% | missionDockShields: shielder ×2, drone ×2 | 216 | 4 / 6 / 12 | 12,7 | 7,4 / 6,8 / 7,5 | 93,9 / 86,1 / 95,6 | ciężkie / ciężkie / ciężkie | — |
| magazyn / transfer-3 | terminal:2 przy 85% | missionPatrol: assaulter ×2, gunner ×1 | 165 | 3 / 6 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | czas spadek ×0,7, presja spadek ×0,7 |
| magazyn / poscig | strefa po terminal | m03Pursuit: assaulter ×3, gunner ×2 | 270 | 5 / 8 / 12 | 21,0 | 10,0 / 8,8 / 9,5 | 209,3 / 184,6 / 200,3 | zabójcze / zabójcze / zabójcze | presja skok ×3,0 |

### m04-ladunek-klasy-k — Ładunek klasy K

| Sekcja / starcie | Wyzwalacz | Fala i skład tur | HP | Żywi | DPS | Czas (s) | Utrata HP (%) | Flagi ścieżek | Zmiana |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| nastawnia / patrol | strefa | m04Patrol: assaulter ×2, gunner ×1 | 165 | 3 / 6 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | czas spadek ×0,6, presja spadek ×0,3 |
| rogatka / rogatka | strefa po barricade | m04Gate: shielder ×1, gunner ×2, turret ×1 | 250 | 4 / 6 / 12 | 15,9 | 7,5 / 6,5 / 6,7 | 119,8 / 102,7 / 106,7 | zabójcze / zabójcze / zabójcze | — |
| wschodni / wschodni | strefa po switch-1 | m04Junction: assaulter ×2, shielder ×1, drone ×2 | 246 | 5 / 6 / 12 | 17,2 | 9,3 / 8,2 / 8,4 | 159,5 / 140,3 / 144,9 | zabójcze / zabójcze / zabójcze | — |
| rozjazd / executor | strefa po switch-2 | m04Executor: executor ×1, gunner ×2, drone ×1 | 328 | 4 / 6 / 12 | 19,0 | 8,4 / 7,1 / 8,0 | 159,3 / 134,4 / 151,6 | zabójcze / zabójcze / zabójcze | czas spadek ×0,9 |

### m05-adiutant — Adiutant

| Sekcja / starcie | Wyzwalacz | Fala i skład tur | HP | Żywi | DPS | Czas (s) | Utrata HP (%) | Flagi ścieżek | Zmiana |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| estakada / tylna-straz | strefa | m05RearGuard: assaulter ×2, gunner ×1, turret ×1 | 235 | 4 / 8 / 12 | 15,4 | 7,8 / 6,5 / 6,7 | 119,0 / 99,3 / 103,1 | zabójcze / ciężkie / zabójcze | czas spadek ×0,9, presja spadek ×0,7 |
| suwnice / tarcze-suwnic | strefa po estakada | m05Shields: shielder ×2, drone ×2 | 216 | 4 / 8 / 12 | 12,7 | 7,4 / 6,8 / 7,5 | 93,9 / 86,1 / 95,6 | ciężkie / ciężkie / ciężkie | presja spadek ×0,9 |
| ladowisko / snajperzy | strefa po suwnice | m05Snipers: sniper ×2 | 70 | 2 / 8 / 12 | 5,3 | 3,6 / 3,2 / 3,7 | 18,8 / 16,9 / 19,3 | — / — / — | czas spadek ×0,5, presja spadek ×0,2 |
| ladowisko / oslona-ladowiska | strefa po snajperzy | m05Escort: assaulter ×3, gunner ×2 | 270 | 5 / 8 / 12 | 21,0 | 10,0 / 8,8 / 9,5 | 209,3 / 184,6 / 200,3 | zabójcze / zabójcze / zabójcze | czas skok ×2,7, presja skok ×10,8 |

### m06-odlewnia — Odlewnia

| Sekcja / starcie | Wyzwalacz | Fala i skład tur | HP | Żywi | DPS | Czas (s) | Utrata HP (%) | Flagi ścieżek | Zmiana |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| sluza / patrol-sluza | strefa | m06Sluza: assaulter ×2, gunner ×1 | 165 | 3 / 8 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | czas spadek ×0,6, presja spadek ×0,3 |
| piece / piece | strefa po patrol-sluza | m06Piece: assaulter ×3, gunner ×2, drone ×1 | 288 | 6 / 8 / 12 | 24,4 | 11,5 / 10,3 / 11,1 | 281,8 / 251,5 / 269,8 | zabójcze / zabójcze / zabójcze | czas skok ×2,1, presja skok ×4,1 |
| formowanie / formowanie-front | strefa po piece | m06Formowanie: shielder ×2, gunner ×2, turret ×1 | 340 | 5 / 8 / 12 | 18,8 | 9,7 / 8,5 / 9,5 | 182,9 / 159,9 / 178,3 | zabójcze / zabójcze / zabójcze | czas spadek ×0,8, presja spadek ×0,6 |
| formowanie / formowanie-tyl | strefa po formowanie-front | m06Rozdzielnia: drone ×2, assaulter ×3, gunner ×1 | 261 | 6 / 8 / 12 | 22,9 | 11,3 / 10,1 / 10,6 | 258,2 / 230,7 / 242,5 | zabójcze / zabójcze / zabójcze | — |
| przedpokoj / straz | strefa po formowanie-tyl | m06Straz: executor ×1, shielder ×1, sniper ×1, gunner ×1 | 390 | 4 / 8 / 12 | 16,2 | 8,5 / 6,7 / 7,3 | 138,0 / 108,3 / 118,8 | zabójcze / zabójcze / zabójcze | czas spadek ×0,7, presja spadek ×0,5 |
| centrum / brandt | strefa po straz | m06Brandt: securityChief ×1 | 900 | 1 / 1 / 12 | 5,6 | 9,9 / 25,2 / 7,8 | 55,1 / 140,1 / 43,1 | — / zabójcze / — | presja spadek ×0,7 |

## Eskorty

| Misja / cel | HP | m/s | Trasa (m) | Jazda bez postojów (s) | Postoje | Celujących | Celowany DPS | Zapas HP | Flaga <25% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| m04-ladunek-klasy-k / payload | 400 | 3,5 | 228,0 | 65,1 | 6 | 0 | 0 | 100,0% | — |

RoomScene przekazuje AI gracza i sojuszników. Neutralny wagon przyjmuje przypadkowe trafienia przez hurtbox. Ich częstość zależy od ustawienia drużyny i linii ognia. Zapas opisuje wyłącznie ogień celowany. RailPayload mierzy długość łamanej w 3D; wymaga gracza w promieniu 9 m, a wróg w promieniu 22 m blokuje ruch. W playteście warto zmierzyć HP na mecie oraz czas unieruchomienia przy każdym postoju.

Próg dla m04-ladunek-klasy-k: utrata ponad 300,0 HP zostawi mniej niż 25% zapasu. Przy samym czasie jazdy odpowiada to średnio ponad 4,6 HP/s przypadkowych trafień. Postoje wydłużają ekspozycję.

## Krzywa aktu I

Każde starcie i każda ścieżka mają równą wagę w średniej misji.

| Misja | Starcia | Średni czas (s) | Średnia utrata HP (%) | Zmiana względem poprzedniej misji |
| --- | ---: | ---: | ---: | --- |
| m01-maszty | 10 | 9,6 | 229,6 | — |
| m02-punkt-kontrolny | 8 | 5,1 | 63,7 | czas spadek ×0,5, presja spadek ×0,3 |
| m03-list-przewozowy | 8 | 7,0 | 110,6 | — |
| m04-ladunek-klasy-k | 4 | 7,2 | 118,0 | — |
| m05-adiutant | 4 | 6,8 | 103,8 | czas spadek ×0,9, presja spadek ×0,9 |
| m06-odlewnia | 6 | 9,7 | 158,7 | — |

Misje — przebieg niemalejący: czas nie, presja nie.

Starcia — przebieg niemalejący: czas nie, presja nie.

## Ograniczenia

Model pomija oczekiwanie na spawny, osłony, tokeny ataku, utratę linii widzenia, podział ognia na sojuszników oraz zmniejszanie się liczby żywych. Zawyża ekspozycję, gdy gracz szybko eliminuje najgroźniejszy cel. Z kolei pominięcie nakładania się spotkań może zaniżyć presję. Celność gracza i warunki trafienia pochodzą z symulatora TTK. Wynik powyżej 100% oznacza wyczerpanie bazowego HP w tym scenariuszu, a nie zmierzone prawdopodobieństwo śmierci.

## Wynik generatora

`npm run balance:missions` — liczba misji: 6, starć: 40, eskort: 1. 35 starć przekracza 60% HP dla co najmniej jednej ścieżki.

### Sprawdzenia wersji R4 z 24.11.2026

- `npm run check` — kod 0 po powtórzeniu bez Playwrighta. TypeScript i ESLint przeszły. Vitest: 3887 + 39 = 3926 zaliczonych testów w 319 plikach. Pierwsza próba przy równoległym E2E przekroczyła pięć budżetów w arenaPerf.
- `vitest run tests/unit/missionBalance.test.ts` — 4/4 testy przeszły, w tym niezależne generowanie tekstu i progi na syntetycznych danych.
- Próba mutacyjna — test progów wykrył 4/4 podstawień operatorów na granicach 60%, 100%, 25% i ×2.
- `npm run balance` — bramka otwartej przestrzeni zaliczona. Następnie `git diff --exit-code -- docs/balance.md` zwrócił kod 0.
- Playwright — 39/133 scenariuszy zaliczonych. Przebieg zatrzymano podczas demoPath, aby powtórzyć pomiary wydajności areny bez obciążenia przeglądarką.
