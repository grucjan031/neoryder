# Samouczek — Z10

`?scene=tutorial` komponuje `RoomScene` z maszyną kroków. Układ
`src/data/tutorial/tutorialRange.json` jest poza globem `data/rooms/*.json`,
więc nie trafia do sektorów. Samouczek korzysta z presetu `classic` (ostrze,
blaster, Pchnięcie), bez zapisu runu i bez nagród meta.

## Kontrakt rozszerzenia RoomScene

Opcja `manualEncounter` zatrzymuje automatyczny start fal. Bez niej zachowanie
dotychczasowych scen pozostaje takie samo. `prepareEncounter` czyści poprzednią
walkę, odnawia zasoby i ustawia nieśmiertelność, pasywność AI oraz opcjonalnie
pozycję i rękę. `spawnEncounterEnemy` tworzy istniejący archetyp z opcjonalnymi
modyfikatorami Stats i ułamkiem HP. `fireEncounterProjectile` używa istniejącego
systemu pocisków. `startEncounterWave` uruchamia istniejący WaveDirector.
`playerSnapshot` i `playerId` zwracają stan do odczytu. Kontrakt zapisano tutaj,
ponieważ Z10 nie dopuszcza edycji `docs/api.md`.

Przejścia i restarty wykonujemy po ticku, poza stosami zdarzeń obrażeń.
Kroki 1–9 mają `damageTaken × 0`; krok 10 resetuje walkę po śmierci, odnawiając
HP, energię, broń i trzyosobową falę. Ukończenie ustawia
`localStorage['neoryder.tutorialDone']='1'`. „Kryjówka” w menu zawsze prowadzi
bezpośrednio do `hub`, także podczas odczytu zapisu. Nie ma dialogu pierwszego
uruchomienia ani zapisu flagi przy wejściu do kryjówki. „Samouczek” jest pierwszym
przyciskiem. Dopiero potwierdzony brak meta-zapisu oraz brak flagi wyróżniają go
bursztynowym akcentem i poświatą z dopiskiem „Nowy gracz? Zacznij tutaj”. Zapis
meta, flaga ukończenia lub błąd odczytu wyłączają wyróżnienie; przycisk pozostaje
dostępny. Tekst dopisku znajduje się w `src/data/ui/tutorial.pl.json` (`menuHint`).

## Kroki i warunki

| #   | Ćwiczenie            | Warunek                                                                          |
| --- | -------------------- | -------------------------------------------------------------------------------- |
| 1   | Ruch, mysz           | `reach_marker` na początku toru                                                  |
| 2   | Skok i podwójny skok | `player_jumped` z `double=true` oraz `land_on` na podeście                       |
| 3   | Dash i ślizg         | `dash_used`, `slide_started`, przejazd ślizgiem pod belką i dojście do znacznika |
| 4   | Combo                | trzy dodatnie `damage_dealt` w ten sam manekin, po etapach `melee_swing` 1–2–3   |
| 5   | Ciężki atak          | trafienie manekina z tarczą, tagi `#melee`, `#heavy`                             |
| 6   | Parowanie            | `parry_success` ×2; pasywny strzelec wysyła pociski jak `parry-test`             |
| 7   | Blaster              | dobycie broni, `heat_changed.overheated=true`, potem brak przegrzania i ciepło 0 |
| 8   | Pchnięcie            | trafienie celu z tagami `#power`, `#wall` (ściana za prawym torem)               |
| 9   | Wykończenie          | `execute_performed` na osłabionym celu                                           |
| 10  | Fala                 | `wave_cleared`; dwóch szturmowców i jeden strzelec; restart po `player_died`     |
| 11  | Koniec               | ekran ukończenia, zapis flagi, „Do kryjówki” i „Powtórz”                         |

Manekiny korzystają z istniejących archetypów i dużego mnożnika HP przez
`Stats`. Nie mają celu AI, ale nadal przyjmują trafienia, odrzut i osłonę.
Osłabiony cel ma 10% HP i znacznik z istniejącego `ExecuteSystem`.
Przypadkowe zabicie celu bez zaliczenia mechaniki odtwarza bieżące ćwiczenie.
Poligon tymczasowo daje talent `hybridDoubleJump`; nie odblokowuje go w meta.

## Dodanie kroku

1. Dodaj polski tekst do `src/data/ui/tutorial.pl.json`, sekcja `steps`.
   Akcje zapisuj jako `{dash}`, `{attack}` itd. Panel rozwiązuje je przez
   `resolveBindings(Settings.bindings)` i stałe przyciski myszy. Zmiany w pauzie
   odświeżają podpowiedzi; brak przypisania jest opisany wprost.
2. Dodaj rekord do `src/data/tutorial/steps.json`: unikalne `id`, klucz `text`,
   `condition`. Opcjonalne `requires` zawiera dodatkowe warunki, które muszą
   zostać spełnione w tym samym ćwiczeniu. Zaliczone warunki pomocnicze pamiętamy
   do przejścia/restartu; główny znacznik wymaga aktualnej obecności gracza.
3. Wybierz `event` z jawnej, typowanej listy `tutorialEvents` w `schema.ts`;
   ustaw `count` oraz opcjonalne filtry `tags`, `double`, `held`, `combo`.
   Nowy rodzaj warunku wymaga walidatora i obsługi w czystej `TutorialMachine`.
4. Opcjonalnie ustaw `marker`, `held`, `spawn` z istniejącym id wroga, jego
   pozycją, pasywnością i HP. `wave` uruchamia dane finału z `config.json`.
   Opcjonalne `start: { x, z, yawDeg }` opisuje start tylko dla komendy debug.
   Wszystkie obecne kroki mają własny start. Host ustawia stopy na wysokości
   podłogi poligonu, uwzględnia kapsułę, a istniejące `tp` z `RoomScene` ustawia
   współrzędne i obrót kamery (pitch 0). Granice pól odpowiadają walidacji `tp`.
   Zwykłe przejście, odtworzenie celu i restart po śmierci nie teleportują gracza.
5. Sprawdź nowy krok przez `tutorial step <n>`, test maszyny oraz scenę headless.
   Parametry ćwiczeń są w JSON; liczby normalnej walki pozostają w danych gry
   i `tuning.ts`. Nie dopisuj poligonu do `data/rooms/` ani definicji sektorów.

## Sprawdzenie ręczne przez architekta

`?scene=tutorial&debug=1`: panel 1/11, ruch do jasnego pierścienia, skok na
podest, ślizg pod belką. `tutorial step 6`: dwa odbicia w oknie parowania;
`tutorial step 10`: zwykłe obrażenia i ponowna fala po śmierci;
`tutorial step 11`: ukończenie i przycisk kryjówki. Przeskok komendą przenosi
gracza na start wybranego kroku i obraca go w stronę celu; normalne przejście
zachowuje pozycję oraz obrót. W kroku 6 start `(0, -7)`, yaw 0, znajduje się
za podestem (`z=3`) i belką (`z=-2`), przed strzelcem `(0, -12)`. Bryły ćwiczeń
ruchowych pozostają na miejscu; nie zasłaniają widoku ani toru pocisku z tego startu.
W feel sprawdzić rytm combo, widoczność pocisków oraz czas całości 3–4 minuty.

Testy: `tests/unit/tutorial*.test.ts` i przygotowany, nieuruchamiany w Z10,
`tests/e2e/tutorial.spec.ts`. Zrzuty i kontrola wizualna wymagają osobnego
odbioru; testy headless nie potwierdzają wyglądu ani tempa nauki.

## Regresje Z17

- `mainMenu.test.ts`, `tutorialMenu.test.ts`: kolejność menu, wyróżnienie przy
  braku meta i flagi, brak wyróżnienia po ukończeniu lub przy meta-zapisie,
  bezpośrednia kryjówka również podczas odczytu i po błędzie zapisu.
- `tutorial.test.ts`: opcjonalność i walidacja `start`, komplet danych 11 kroków.
- `tutorialScene.test.ts`: start i obrót wszystkich kroków, brak teleportu przy
  normalnym przejściu i restarcie finału; promień od rzeczywistej kamery przez
  świat Rapier do celów kroków 4, 5, 6, 8, 9 nie trafia w świat, a trafia we wroga.
  Spy obserwuje rzeczywisty świat i nie zastępuje symulacji. Osobny test sprawdza
  emisję pocisku przez `ProjectileSystem` w ciągu 5 s oraz kierunek ku graczowi.
  Test parowania wymaga dwóch rzeczywistych odbić bez dodatkowej komendy `tp`.
- Z17: `npm run typecheck`, `npm run lint`, `npx vitest run --maxWorkers=2`.
  Playwright i build pozostają poza tym zleceniem.
