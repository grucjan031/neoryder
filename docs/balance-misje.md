# Balans misji — fale i eskorta

Data wygenerowania (UTC): 2026-11-25. Generator: `npm run balance:missions`.

## Założenia

Poziom normalny, bazowe 100 HP gracza. Kolejność wartości w trójkach: Ostrze / Moc / Strzelec. Symulator z [raportu TTK](balance.md) wybiera dla typu wroga najlepsze combo lub ciężkie cięcie, priorytet mocy albo broń odpowiedniego loadoutu w otwartej przestrzeni. Pierwszy cel kosztuje pojedynczy TTK; każdy kolejny tego typu w tej samej turze kosztuje (TTK paczki − pojedynczy TTK) / 4. Boss korzysta z pojedynczego pomiaru. Dodano 1,5 s dojścia na każdego wroga. Czasy obejmują wyłącznie czyszczenie.

W każdej turze sumujemy DPS najsilniejszych przeciwników do limitu żywych i mnożymy przez skuteczność 35,0% oraz czas czyszczenia daną ścieżką. Sumujemy obrażenia kolejnych tur. To scenariusz utrzymania pełnej presji aż do ostatniego zabójstwa. Tabela pokazuje szczyt DPS po korekcie celności. Kolumna żywych podaje szczyt / maxAlive fali / maxAlive poziomu; dodatkowy limit globalny wynosi 12.

DPS serii = obrażenia pocisku × liczba pocisków / (celowanie + odstępy w serii + odnowienie). W zwarciu cykl obejmuje zapowiedź, aktywne cięcie i dłuższy z czasów odzyskania gotowości i odnowienia. Haker korzysta z cyklu zakłócenia. Dla Brandta sumujemy obrażenia i czasy wzorców każdej fazy, licząc pociski wachlarza i ważąc DPS udziałem fazy w HP. Pomijamy dodatkową osłonę i przywołanych pomocników w presji bossa.

Środek strefy startowej przypisuje starcie do sekcji. W sekcji zachowujemy kolejność wpisów poziomu. W M01 wybuch masztu przekazuje klucz celu przez RoomScene.reinforceMission. W M03 MissionObjectives przekazuje klucz celu i indeks po przekroczeniu progu obrony. MissionScene uruchamia wpis reinforcementFor o tym kluczu; blokada ponownego startu zapobiega podwójnemu naliczeniu posiłków po sabotażu, także przy aktywacji strefy. Spotkania mogą trwać równolegle.

## Dziesięć starć o najwyższej presji

Ranking według największego odsetka HP spośród trzech ścieżek. Propozycje dotyczą prób w playteście.

1. **m06-odlewnia / formowanie-tyl** (m06Rozdzielnia) — Ostrze, 258,2% HP; sprawdzić maxAlive 8 → 5 (obecny szczyt: 6).
2. **m03-list-przewozowy / poscig** (m03Pursuit) — Ostrze, 209,3% HP; sprawdzić maxAlive 8 → 4 (obecny szczyt: 5).
3. **m05-adiutant / oslona-ladowiska** (m05Escort) — Ostrze, 209,3% HP; sprawdzić maxAlive 8 → 4 (obecny szczyt: 5).
4. **m06-odlewnia / piece** (m06Piece) — Ostrze, 199,9% HP; sprawdzić skład fali po usunięciu jednej jednostki typu gunner.
5. **m03-list-przewozowy / posterunek-magazynu** (m03Forecourt) — Ostrze, 189,1% HP; sprawdzić skład fali po usunięciu jednej jednostki typu gunner.
6. **m06-odlewnia / formowanie-front** (m06Formowanie) — Ostrze, 182,9% HP; sprawdzić maxAlive 8 → 4 (obecny szczyt: 5).
7. **m01-maszty / oslona-trzeciego** (m01MastThree) — Ostrze, 166,2% HP; sprawdzić maxAlive 4 → 2 (obecny szczyt: 3).
8. **m05-adiutant / tarcze-suwnic** (m05Shields) — Strzelec, 160,9% HP; sprawdzić skład fali po usunięciu jednej jednostki typu drone.
9. **m04-ladunek-klasy-k / wschodni** (m04Junction) — Ostrze, 159,5% HP; sprawdzić maxAlive 6 → 4 (obecny szczyt: 5).
10. **m04-ladunek-klasy-k / executor** (m04Executor) — Ostrze, 159,3% HP; sprawdzić maxAlive 6 → 3 (obecny szczyt: 4).

## Starcia w kolejności sekcji

Flagi ścieżek według niezaokrąglonego wyniku: powyżej 60% HP ciężkie, powyżej 100% zabójcze. Zmiana porównuje średnie z trzech ścieżek z poprzednim starciem, również na granicy misji. Skok oznacza wzrost ponad dwukrotny. Strzałka w składzie oddziela kolejne tury.

### m01-maszty — Maszty

| Sekcja / starcie | Wyzwalacz | Fala i skład tur | HP | Żywi | DPS | Czas (s) | Utrata HP (%) | Flagi ścieżek | Zmiana |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| sluza / patrol-wejscie | strefa | m01Approach: assaulter ×2 | 120 | 2 / 8 / 12 | 7,4 | 4,1 / 3,4 / 3,7 | 30,2 / 25,4 / 27,2 | — / — / — | — |
| targ / oslona-pierwszego | strefa po patrol-wejscie | m01MastOne: assaulter ×1, turret ×1 → assaulter ×1, gunner ×1 | 235 | 2 / 2 / 12 | 8,7 | 7,5 / 6,1 / 6,1 | 57,4 / 46,6 / 46,6 | — / — / — | — |
| targ / reinforce-mast-1 | wybuch mast-1 | missionPatrol: assaulter ×2, gunner ×1 | 165 | 3 / 6 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | czas spadek ×0,8 |
| tunel / patrol-tunel | strefa po mast-1 | m01Patrol: assaulter ×2 → assaulter ×2, gunner ×1 | 285 | 3 / 3 / 12 | 12,4 | 9,9 / 8,4 / 8,9 | 102,3 / 86,5 / 91,5 | zabójcze / ciężkie / ciężkie | — |
| dziedziniec / oslona-drugiego | strefa po patrol-tunel | m01MastTwo: assaulter ×2, turret ×1 → assaulter ×2, gunner ×1 | 355 | 3 / 3 / 12 | 12,4 | 11,8 / 9,9 / 10,4 | 134,4 / 112,6 / 118,3 | zabójcze / zabójcze / zabójcze | — |
| dziedziniec / reinforce-mast-2 | wybuch mast-2 | missionPatrol: assaulter ×2, gunner ×1 | 165 | 3 / 6 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | czas spadek ×0,5, presja spadek ×0,5 |
| zaplecze / patrol-rusztowania | strefa po helix | m01Patrol: assaulter ×2 → assaulter ×2, gunner ×1 | 285 | 3 / 3 / 12 | 12,4 | 9,9 / 8,4 / 8,9 | 102,3 / 86,5 / 91,5 | zabójcze / ciężkie / ciężkie | — |
| plac / patrol-plac | strefa po patrol-rusztowania | m01Assault: assaulter ×2, gunner ×1 → assaulter ×2 → assaulter ×1, gunner ×1 | 390 | 3 / 4 / 12 | 12,4 | 13,6 / 11,4 / 11,9 | 134,0 / 112,8 / 117,7 | zabójcze / zabójcze / zabójcze | — |
| plac / oslona-trzeciego | strefa po patrol-plac | m01MastThree: assaulter ×2, turret ×1 → assaulter ×2, gunner ×1 → assaulter ×1, gunner ×1 | 460 | 3 / 4 / 12 | 12,4 | 15,5 / 12,9 / 13,4 | 166,2 / 138,9 / 144,6 | zabójcze / zabójcze / zabójcze | — |
| plac / reinforce-mast-3 | wybuch mast-3 | m01Assault: assaulter ×2, gunner ×1 → assaulter ×2 → assaulter ×1, gunner ×1 | 390 | 3 / 4 / 12 | 12,4 | 13,6 / 11,4 / 11,9 | 134,0 / 112,8 / 117,7 | zabójcze / zabójcze / zabójcze | czas spadek ×0,9, presja spadek ×0,8 |

### m02-punkt-kontrolny — Punkt kontrolny

| Sekcja / starcie | Wyzwalacz | Fala i skład tur | HP | Żywi | DPS | Czas (s) | Utrata HP (%) | Flagi ścieżek | Zmiana |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| kordon / patrol-kordon | strefa | m02Patrol: assaulter ×2, gunner ×1 | 165 | 3 / 6 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | czas spadek ×0,4, presja spadek ×0,5 |
| bocznica / rampa | strefa po patrol-kordon | m02Ramp: gunner ×3, turret ×1 | 205 | 4 / 4 / 12 | 17,9 | 7,6 / 6,9 / 7,4 | 135,6 / 122,8 / 131,7 | zabójcze / zabójcze / zabójcze | — |
| cele / straz-cel | strefa po rampa | m02Guards: assaulter ×2, gunner ×2 | 210 | 4 / 6 / 12 | 17,3 | 7,8 / 6,9 / 7,4 | 134,9 / 118,9 / 127,6 | zabójcze / zabójcze / zabójcze | presja spadek ×1,0 |
| cele / poscig-1 | strefa po cell-1 | m02Pursuit: assaulter ×4 | 240 | 4 / 4 / 12 | 14,8 | 8,4 / 7,3 / 8,0 | 124,5 / 107,5 / 118,6 | zabójcze / zabójcze / zabójcze | presja spadek ×0,9 |
| cele / poscig-2 | strefa po cell-2 | m02Pursuit: assaulter ×4 | 240 | 4 / 4 / 12 | 14,8 | 8,4 / 7,3 / 8,0 | 124,5 / 107,5 / 118,6 | zabójcze / zabójcze / zabójcze | — |
| dowodztwo / oslona-suwnicy | strefa po cell-2 | m02Ramp: gunner ×3, turret ×1 | 205 | 4 / 4 / 12 | 17,9 | 7,6 / 6,9 / 7,4 | 135,6 / 122,8 / 131,7 | zabójcze / zabójcze / zabójcze | czas spadek ×0,9 |
| dowodztwo / egzekutor | strefa po cell-3 | m02Executor: executor ×1, gunner ×2 | 310 | 3 / 6 / 12 | 15,6 | 6,8 / 5,6 / 6,5 | 106,1 / 86,7 / 100,7 | zabójcze / ciężkie / zabójcze | czas spadek ×0,9, presja spadek ×0,8 |
| dowodztwo / poscig-3 | strefa po cell-3 | m02Pursuit: assaulter ×4 | 240 | 4 / 4 / 12 | 14,8 | 8,4 / 7,3 / 8,0 | 124,5 / 107,5 / 118,6 | zabójcze / zabójcze / zabójcze | — |

### m03-list-przewozowy — List przewozowy

| Sekcja / starcie | Wyzwalacz | Fala i skład tur | HP | Żywi | DPS | Czas (s) | Utrata HP (%) | Flagi ścieżek | Zmiana |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| nabrzeze / patrol-nabrzeze | strefa | m03Quay: assaulter ×3, gunner ×1 | 225 | 3 / 3 / 12 | 12,4 | 8,0 / 6,9 / 7,4 | 98,8 / 84,8 / 91,0 | ciężkie / ciężkie / ciężkie | czas spadek ×0,9, presja spadek ×0,8 |
| plac-celny / oslona-celna | strefa po patrol-nabrzeze | m03Customs: shielder ×2, drone ×2, turret ×1 | 286 | 5 / 5 / 12 | 15,7 | 9,3 / 8,3 / 9,0 | 146,1 / 130,2 / 141,9 | zabójcze / zabójcze / zabójcze | — |
| przedpole / posterunek-magazynu | strefa po oslona-celna | m03Forecourt: shielder ×2, gunner ×2, turret ×2 | 410 | 4 / 4 / 12 | 15,9 | 11,9 / 10,5 / 11,6 | 189,1 / 167,3 / 185,2 | zabójcze / zabójcze / zabójcze | — |
| magazyn / pierwsza-zmiana | strefa po posterunek-magazynu | m03Quay: assaulter ×3, gunner ×1 | 225 | 3 / 3 / 12 | 12,4 | 8,0 / 6,9 / 7,4 | 98,8 / 84,8 / 91,0 | ciężkie / ciężkie / ciężkie | czas spadek ×0,7, presja spadek ×0,5 |
| magazyn / transfer-1 | terminal:0 przy 25% | missionPatrol: assaulter ×2, gunner ×1 | 165 | 3 / 6 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | czas spadek ×0,7, presja spadek ×0,7 |
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
| estakada / tylna-straz | strefa | m05RearGuard: assaulter ×2, gunner ×1, turret ×1 → assaulter ×2 | 355 | 4 / 4 / 12 | 15,4 | 11,8 / 9,9 / 10,4 | 149,2 / 124,7 / 130,4 | zabójcze / zabójcze / zabójcze | presja spadek ×0,9 |
| suwnice / tarcze-suwnic | strefa po estakada | m05Shields: shielder ×3, drone ×2 | 306 | 5 / 5 / 12 | 15,7 | 9,5 / 8,8 / 10,3 | 149,7 / 137,8 / 160,9 | zabójcze / zabójcze / zabójcze | czas spadek ×0,9 |
| ladowisko / snajperzy | strefa po suwnice | m05Snipers: sniper ×2, gunner ×1, assaulter ×1 | 175 | 4 / 4 / 12 | 13,9 | 7,3 / 6,3 / 6,7 | 100,8 / 87,0 / 93,4 | zabójcze / ciężkie / ciężkie | czas spadek ×0,7, presja spadek ×0,6 |
| ladowisko / oslona-ladowiska | strefa po snajperzy | m05Escort: assaulter ×3, gunner ×2 | 270 | 5 / 8 / 12 | 21,0 | 10,0 / 8,8 / 9,5 | 209,3 / 184,6 / 200,3 | zabójcze / zabójcze / zabójcze | presja skok ×2,1 |

### m06-odlewnia — Odlewnia

| Sekcja / starcie | Wyzwalacz | Fala i skład tur | HP | Żywi | DPS | Czas (s) | Utrata HP (%) | Flagi ścieżek | Zmiana |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| sluza / patrol-sluza | strefa | m06Sluza: assaulter ×2, gunner ×2 | 210 | 4 / 4 / 12 | 17,3 | 7,8 / 6,9 / 7,4 | 134,9 / 118,9 / 127,6 | zabójcze / zabójcze / zabójcze | czas spadek ×0,8, presja spadek ×0,6 |
| piece / piece | strefa po patrol-sluza | m06Piece: assaulter ×3, gunner ×2, drone ×1 | 288 | 4 / 4 / 12 | 17,3 | 11,5 / 10,3 / 11,1 | 199,9 / 178,4 / 191,3 | zabójcze / zabójcze / zabójcze | — |
| formowanie / formowanie-front | strefa po piece | m06Formowanie: shielder ×2, gunner ×2, turret ×1 | 340 | 5 / 8 / 12 | 18,8 | 9,7 / 8,5 / 9,5 | 182,9 / 159,9 / 178,3 | zabójcze / zabójcze / zabójcze | czas spadek ×0,8, presja spadek ×0,9 |
| formowanie / formowanie-tyl | strefa po formowanie-front | m06Rozdzielnia: drone ×2, assaulter ×3, gunner ×1 | 261 | 6 / 8 / 12 | 22,9 | 11,3 / 10,1 / 10,6 | 258,2 / 230,7 / 242,5 | zabójcze / zabójcze / zabójcze | — |
| przedpokoj / straz | strefa po formowanie-tyl | m06Straz: executor ×1, shielder ×1, sniper ×1, gunner ×1 | 390 | 4 / 8 / 12 | 16,2 | 8,5 / 6,7 / 7,3 | 138,0 / 108,3 / 118,8 | zabójcze / zabójcze / zabójcze | czas spadek ×0,7, presja spadek ×0,5 |
| centrum / brandt | strefa po straz | m06Brandt: securityChief ×1 | 900 | 1 / 1 / 12 | 5,6 | 9,9 / 25,2 / 7,8 | 55,1 / 140,1 / 43,1 | — / zabójcze / — | presja spadek ×0,7 |

### m07-nocny-dyzur — Nocny dyżur

| Sekcja / starcie | Wyzwalacz | Fala i skład tur | HP | Żywi | DPS | Czas (s) | Utrata HP (%) | Flagi ścieżek | Zmiana |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| przychodnia / cisza-hala | strefa | m07CiszaHala: assaulter ×1, gunner ×1, drone ×1 | 123 | 3 / 3 / 12 | 12,1 | 5,3 / 4,5 / 4,5 | 63,3 / 54,9 / 54,9 | ciężkie / — / — | czas spadek ×0,3, presja spadek ×0,7 |
| przychodnia / cisza-magazyn | strefa | m07CiszaMagazyn: gunner ×1, assaulter ×1 | 105 | 2 / 2 / 12 | 8,7 | 3,7 / 3,0 / 3,0 | 31,7 / 26,3 / 26,3 | — / — / — | czas spadek ×0,7, presja spadek ×0,5 |
| przychodnia / alarm-hala | po alarmie (przychodnia) | m07Hala: shielder ×1, gunner ×2 | 180 | 3 / 6 / 12 | 12,9 | 5,6 / 5,0 / 5,2 | 72,4 / 63,8 / 67,0 | ciężkie / ciężkie / ciężkie | presja skok ×2,4 |
| przychodnia / wieza-magazynu | po alarmie (przychodnia) | m07Magazyn: turret ×1, drone ×1 | 88 | 2 / 4 / 12 | 6,4 | 3,5 / 3,0 / 3,0 | 22,4 / 19,4 / 19,4 | — / — / — | czas spadek ×0,6, presja spadek ×0,3 |
| serwerownia / czujnik-serwera | serwer:0 przy 60% | m07Serwer: assaulter ×2, gunner ×1 | 165 | 3 / 5 / 12 | 12,4 | 5,8 / 5,0 / 5,2 | 72,1 / 61,2 / 64,2 | ciężkie / ciężkie / ciężkie | presja skok ×3,2 |
| serwerownia / alarm-serwerownia | strefa po serwer | m07Alarm: shielder ×1, assaulter ×2, gunner ×1 | 255 | 4 / 6 / 12 | 15,3 | 7,8 / 6,5 / 6,7 | 118,7 / 99,0 / 102,9 | zabójcze / ciężkie / zabójcze | — |
| targ / poscig-targ-1 | strefa po serwer | m07Poscig1: assaulter ×2, drone ×2 | 156 | 4 / 6 / 12 | 14,2 | 7,4 / 6,7 / 6,9 | 104,8 / 94,6 / 98,4 | zabójcze / ciężkie / ciężkie | presja spadek ×0,9 |
| targ / poscig-targ-2 | strefa po poscig-targ-1 | m07Poscig2: shielder ×1, gunner ×2, hacker ×1 | 204 | 4 / 6 / 12 | 13,0 | 7,2 / 6,5 / 6,7 | 93,7 / 84,0 / 87,3 | ciężkie / ciężkie / ciężkie | czas spadek ×1,0, presja spadek ×0,9 |
| targ / blokada-windy | strefa po poscig-targ-2 | m07Blokada: shielder ×2, gunner ×1, turret ×1 | 295 | 4 / 6 / 12 | 13,9 | 7,8 / 6,6 / 7,3 | 107,5 / 91,2 / 101,3 | zabójcze / ciężkie / zabójcze | — |

## Eskorty

| Misja / cel | HP | m/s | Trasa (m) | Jazda bez postojów (s) | Postoje | Celujących | Celowany DPS | Zapas HP | Flaga <25% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| m04-ladunek-klasy-k / payload | 400 | 3,5 | 228,0 | 65,1 | 6 | 6 | 20,6 | 59,4% | — |

Celowany DPS to najwyższa wśród tur oczekiwana suma DPS sabotażystów. Model uśrednia tasowaną kolejkę spawnów i trzy ścieżki gracza. Na zauważenie zasadzki zakłada 1,5 s (jeden odcinek dojścia z modelu). Następnie na każdy cel przypada dojście i pojedynczy TTK. Ekspozycja kolejnego celu uwzględnia odstęp spawnów. Przy czystej linii ognia model zakłada trafienie dużego wagonu każdym atakiem. Osłony, prowokacja i przypadkowe trafienia zmieniają rzeczywisty wynik. HUD pokazuje bieżące i maksymalne HP wagonu.

m04-ladunek-klasy-k: oczekiwana utrata 162,3 HP z 400, zapas 59,4%.

## Krzywa misji

Każde starcie i każda ścieżka mają równą wagę w średniej misji.

| Misja | Starcia | Średni czas (s) | Średnia utrata HP (%) | Zmiana względem poprzedniej misji |
| --- | ---: | ---: | ---: | --- |
| m01-maszty | 10 | 8,8 | 91,1 | — |
| m02-punkt-kontrolny | 8 | 7,1 | 112,7 | czas spadek ×0,8 |
| m03-list-przewozowy | 8 | 7,8 | 115,6 | — |
| m04-ladunek-klasy-k | 4 | 7,2 | 118,0 | czas spadek ×0,9 |
| m05-adiutant | 4 | 9,1 | 144,0 | — |
| m06-odlewnia | 6 | 10,0 | 155,9 | — |
| m07-nocny-dyzur | 9 | 5,5 | 70,5 | czas spadek ×0,6, presja spadek ×0,5 |

Misje — przebieg niemalejący: czas nie, presja nie.

Starcia — przebieg niemalejący: czas nie, presja nie.

## Ograniczenia

Model pomija oczekiwanie na spawny, osłony, tokeny ataku, utratę linii widzenia, podział ognia na sojuszników oraz zmniejszanie się liczby żywych. Zawyża ekspozycję, gdy gracz szybko eliminuje najgroźniejszy cel. Z kolei pominięcie nakładania się spotkań może zaniżyć presję. Celność gracza i warunki trafienia pochodzą z symulatora TTK. Wynik powyżej 100% oznacza wyczerpanie bazowego HP w tym scenariuszu, a nie zmierzone prawdopodobieństwo śmierci.

## Wynik generatora

`npm run balance:missions` — liczba misji: 7, starć: 49, eskort: 1. 45 starć przekracza 60% HP dla co najmniej jednej ścieżki.

### Sprawdzenia wersji R4 z 24.11.2026

- `npm run check` — kod 0 po powtórzeniu bez Playwrighta. TypeScript i ESLint przeszły. Vitest: 3887 + 39 = 3926 zaliczonych testów w 319 plikach. Pierwsza próba przy równoległym E2E przekroczyła pięć budżetów w arenaPerf.
- `vitest run tests/unit/missionBalance.test.ts` — 4/4 testy przeszły, w tym niezależne generowanie tekstu i progi na syntetycznych danych.
- Próba mutacyjna — test progów wykrył 4/4 podstawień operatorów na granicach 60%, 100%, 25% i ×2.
- `npm run balance` — bramka otwartej przestrzeni zaliczona. Następnie `git diff --exit-code -- docs/balance.md` zwrócił kod 0.
- Playwright — 39/133 scenariuszy zaliczonych. Przebieg zatrzymano podczas demoPath, aby powtórzyć pomiary wydajności areny bez obciążenia przeglądarką.
