# Areny Przejęcia

`src/data/modes/conquest.json` wskazuje listę `arenas`. Arena jest istniejącą
definicją pokoju combat z metadanymi `arena`; nie ma osobnego loadera geometrii.
`arena.exclusive` wyłącza port z puli zwykłego runu. Dotychczasowe dane
combatRing mają dodatkowe punkty/spawny trybu, bez zmiany zwykłego układu.
Wybór, zgodność `roomId` i zapis: [modes.md](modes.md).

## Port kontenerowy

Główna ciągła podłoga: 100×100 m, granice XZ −50…50 m, zamknięte statycznymi
colliderami. Nawierzchnia: asfalt, beton i płyty nabrzeża. Dalsza tafla za
południową granicą jest oprawą niedostępną dla gracza. Pogoda: `storm`.

| Strefa | Pozycja X/Y/Z (m) | Charakter i dojścia                                                       |
| ------ | ----------------- | ------------------------------------------------------------------------- |
| A      | −32 / 0 / −28     | Plac przy zachodnich stosach, dojście zachodem i przez środkowe przejazdy |
| B      | 32 / 0 / −23      | Pod suwnicą, cztery słupy, dostęp od północy, zachodu i wschodu           |
| C      | 0 / 0 / 33        | Szerokie nabrzeże, niskie osłony, dostęp z obu boków oraz ze środka       |

Promień każdego punktu: 4 m. Odległości między środkami: ok. 64 / 69 / 65 m.
Gracz zaczyna przy (−38, 0, 39), posiłki mają sześć pozycji na obrzeżach
oddzielonych od stref. Wspólny bezpieczny odstęp od gracza nadal wynosi 15 m.

Kontenery mają 12×3×4 m, część jest piętrowa. Zachodnia rampa (18 m biegu)
prowadzi na 6 m; druga (12 m biegu) na 3 m. Kładka na 6 m łączy stosy,
z przejściami poniżej. Dwa biegi schodów po 15 stopni (0,2×0,6 m)
prowadzą przez spocznik 3 m do podestu suwnicy 6 m. Wymiary i obroty ramp
są w JSON-ie; render i Rapier dostają tę samą transformację. Wszystkie punkty
są na gruncie, wyższe poziomy służą flankowaniu i zmianie linii widoku.

`ArenaNavigation` buduje naziemną siatkę 1 m z marginesem 0,8 m i pola odległości
do punktów. Wygładza trasę do widocznego waypointu. `RoomScene` przekazuje go
przez istniejące `Enemy.moveGoal`; blisko gracza nadal działa zwykła walka.
Rampy są omijane przez naziemną nawigację, bez zmiany AI innych scen.
Walidacja obejmuje wolne koła stref, ich odległości, granice, dostępność,
wolny margines spawnów i ich położenie poza punktami.

Oprawa korzysta z istniejących GLB: latarni, generatora, skrzyń, bariery,
kiosku, rur, kabla, anteny, worków i projektora. Kontenery, suwnica, podesty
i bolardy mają na razie bryły proceduralne z istniejącymi materiałami/teksturami.
Neony: bursztyn, zieleń i fiolet; jasne znaczniki punktów i interakcje.
Nie dodano nowych modeli ani zasobów zewnętrznych.

## Wydajność i pomiar

Port wykorzystuje wzorzec commita `0ade40c`: jeden `static-world` dla brył,
modeli i dekoracji oraz jedno scalanie według materiału w komórkach 20 m.
Kontenery i bolardy są `InstancedMesh`, także grupowane w komórkach dla cullingu.
Pozostałe pokoje zachowują swój dotychczasowy sposób scalania. Collider każdego
bloku jest statyczny. Smugi i rozbryzgi mają istniejące pule, bez tworzenia
obiektów na każdą kroplę. Bufory instancji i scalone geometrie są zwalniane.

Pomiar strukturalny 2026-11-17, prawdziwe GLB, `arenaStaticBatch.test.ts`:

| Zakres                                         | Przed scalaniem | Po scalaniu |
| ---------------------------------------------- | --------------: | ----------: |
| Statyczne siatki portu (łącznie z instancjami) |             286 |         123 |
| Partie instancji (kontenery i bolardy)         |              14 |          14 |

To liczba siatek, **nie zmierzona liczba wywołań rysowania całej klatki**:
frustum culling i przebiegi koloru, normalnych, odbić oraz bloom zmieniają wynik.
Pomiar GPU jest zablokowany w sandboxie: start Chromium zwraca `spawn EPERM`,
a host dostępu do przeglądarki i natywna aplikacja są niedostępne. Nie podano
fikcyjnego wyniku wywołań. Manager powinien uzupełnić go przed akceptacją areny.

Na działającym serwerze poza sandboxem:

```powershell
node tools/perf/profile.mjs --url 'http://127.0.0.1:5173/?mode=conquest&arena=arenaContainerPort&seed=port-review' --scene run --quality medium --seconds 10
```

1280×720, DPR 1, medium, pogoda storm, startowa kamera. Raport zawiera liczniki
wywołań per przebieg; `window.__neoryder.query('renderInfo')` daje także sumę
wywołań ostatniej pełnej klatki. Pomiar należy podać z pozycją kamery, liczbą
wrogów i jakością. Nie uruchamiać go z `fx=lite` przy ocenie oprawy.

## Sprawdzenie w 30 sekund

Otwórz `?scene=conquest&arena=arenaContainerPort&debug=1`, wpisz `god`, obejrzyj
plac i podesty. Komendy `tp -32 -28`, `tp 32 -23`, `tp 0 33` pozwalają szybko
obejrzeć trzy różne strefy. Sprawdź `query('room')`, `query('weather')` i
`query('conquest')`. `?scene=weatherTest&debug=1` udostępnia pięć przycisków pogody.
`?scene=conquest&arena=combatRing&debug=1` sprawdza drugą arenę.

Dłuższy przegląd feel: przejdź naziemne drogi A–B–C, wejdź obiema rampami,
przejdź po kładce i oboma biegami schodów suwnicy. Sprawdź czytelność czerwonych
wrogów w ulewie, osłony, możliwość flankowania i tempo dochodzenia posiłków.
Przejście kapsuły bez skoków po gruncie, rampach, kładce i schodach pokrywa
`arenaTraversal.test.ts`; obydwa archetypy ze wszystkich sześciu spawnów do A/B/C
sprawdza `arenaEnemies.test.ts` na prawdziwym Rapierze. Ocena widoku i dźwięku
pozostaje ręczna. Test e2e jest napisany, nieuruchomiony zgodnie z briefem.

## Modele do osobnego zadania graficznego

| Model                                         | Wymiary docelowe (m)                        | Największa korzyść                                            |
| --------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Kontener zamknięty, warianty drzwi i oznaczeń | 12×3×4                                      | Czytelna skala, narożniki, żebrowanie, gniazda do piętrowania |
| Kontener otwarty / przechodni                 | 12×3×4, prześwit ≥2,2                       | Wiarygodne skróty i przejścia                                 |
| Suwnica modułowa                              | rozstaw 22, wysokość 9, belka 25            | Główna sylweta portu i orientacja przy B                      |
| Podest / pomost kratowy                       | segmenty 4×0,4×4                            | Wyraźna konstrukcja tras na 3 i 6 m                           |
| Schody przemysłowe                            | bieg 4×3×9, stopień 0,2×0,6                 | Balustrady i konstrukcja bez zmiany colliderów                |
| Rampa stalowa                                 | szerokość 4, bieg 12 lub 18, wznios 3 lub 6 | Obramowanie i tekstura antypoślizgowa                         |
| Bolard portowy                                | 0,6×0,9×0,6                                 | Sylweta i rytm nabrzeża                                       |
| Odbojnica gumowa i drabina kei                | 1,5×1×0,4 / 0,6×3×0,2                       | Rozpoznawalność granicy portu                                 |
| Bęben kablowy / paleta ładunkowa              | 2×2×1,5 / 1,2×0,2×1                         | Zróżnicowanie niskich osłon                                   |

Nowe modele mają zastąpić bryły w osobnym zadaniu; obecny zakres nie tworzy GLB.
