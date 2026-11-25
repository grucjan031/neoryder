# Backlog — pomysły „po premierze / poza bieżącą fazą”

Zasada: zadania spoza bieżącej fazy trafiają tutaj, nie do kodu. Przegląd na bramce każdej fazy; Producent przenosi pozycję do issues dopiero po akceptacji człowieka.

## Walka i ruch

| Pomysł                                 | Dlaczego odłożone                                              |
| -------------------------------------- | -------------------------------------------------------------- |
| Rzut ostrzem (bumerang) i dash-cięcie | Zaplanowane na F2; F1 weryfikuje podstawy ostrza — **zaimplementowane, czeka na playtest (`plasmaBlade`: stany `throwing`, `dashCut`)** |
| Warianty ostrzy (podwójne, dwustronne) | F2, wymaga stabilnego combo i danych broni — **zaimplementowane, czeka na playtest (`src/data/blades`: `twinBlades`, `staffBlade`)** |
| Parowanie ataków wręcz | Najpierw parowanie pocisków; osobne issue po bramce F1 — **zaimplementowane, czeka na playtest (`meleeParryWindowMs`, `docs/systems/melee.md`)** |
| Wspinaczka, bieg po ścianach           | Ryzyko dla czytelności aren, brak pewności, że wzmacnia filary |
| Wykończenia (execution) z animacją     | Po ustaleniu feel hitstopu; wymaga animacji                    |
| Rzucanie obiektami fizycznymi (Chwyt) | F2 (moc Chwyt i rzut) — **zaimplementowane, czeka na playtest (moc `grab`)** |

## Moce i bronie

- Aktywne chłodzenie blastera w idealnym oknie podczas przegrzania — zaimplementowane, czeka na playtest w `?scene=blaster-test&debug=1`. [Opis mechaniki](systems/weapons.md#aktywne-chłodzenie-blastera).

| Pomysł                                                                 | Dlaczego odłożone                 |
| ---------------------------------------------------------------------- | --------------------------------- |
| Pozostałe moce Rezonansu (Chwyt, Błyskawica, Fala, Bariera, Skupienie) | F2, po sprawdzeniu pierwszej mocy — **zaimplementowane, czeka na playtest (`src/data/powers`)** |
| Pozostałe typy broni, moduły (rykoszet, przebicie, podpalenie) | F2 — **zaimplementowane, czeka na playtest (`src/data/weapons`, `src/data/modules`)** |
| Efekty statusów (podpalenie, przeciążenie, ogłuszenie) | F2 — **zaimplementowane, czeka na playtest (`src/data/statuses`)** |
| Granaty EMP, ciągły laser | F2, wymagają statusów — **zaimplementowane, czeka na playtest (`emp.json`, `beam.json`)** |
| Ulepszenia mocy zmieniające działanie                                  | F4 (drzewka)                      |

## Wrogowie i bossowie

- Symulacja TTK bossa z progami HP, nietykalnością przejść i wzorcami faz:
  osobne zadanie po F3-16. Raport balansu F2 pomija `kind: 'boss'`, ponieważ
  model paczek zwykłych wrogów nie odtwarza tych mechanik.

| Pomysł                                            | Dlaczego odłożone                |
| ------------------------------------------------- | -------------------------------- |
| Snajper, Dron, Tarczownik, Egzekutor | F2 — **zaimplementowane, czeka na playtest (`src/data/enemies`)** |
| Koordynacja grupy (flankowanie, ostrzał zaporowy) | F2 — **zaimplementowane, czeka na playtest (flankowanie i taktyki w `tuning.enemies`)** |
| Bossowie Helixa, Kurogane, Orbis                  | Pierwszy boss w F3, kolejni w F5 |
| Ataki środowiskowe i pułapki | Po stabilnym generatorze pokoi — **zaimplementowane, czeka na playtest (`src/world/hazards.ts`)** |

## Roguelite i progresja

| Pomysł                              | Dlaczego odłożone                     |
| ----------------------------------- | ------------------------------------- |
| Implanty per run i rzadkości | F3 — **zaimplementowane, czeka na playtest (`src/progression/implants.ts`)** |
| Drzewka talentów i hybrydy | F4 — **zaimplementowane, czeka na playtest (`src/data/talents`)** |
| Waluty Dane i Rdzenie, odblokowania | F4 — **zaimplementowane, czeka na playtest (`src/progression/meta.ts`, `unlocks`)** |
| Poziom zagrożenia | F4 — **zaimplementowane, czeka na playtest (`threatSchema.ts`)** |
| Wydobywanie modułów z runu          | Po meta-progresie, ryzyko dla balansu |
| Codzienne wyzwania z tabelą online  | Wymaga backendu, poza demo            |

## Świat i fabuła

| Pomysł                                        | Dlaczego odłożone                     |
| --------------------------------------------- | ------------------------------------- |
| Generator sektorów, moduły pokoi | F3 — **zaimplementowane, czeka na playtest (`src/world`, `src/data/sectors`)** |
| Kryjówka jako grywalny hub | F4 — **zaimplementowane, czeka na playtest (`src/scenes/hub.ts`)** |
| Misje fabularne i dialogi z portretami        | F5                                    |
| Pełny łuk fabularny, zakończenia alternatywne | Po premierze, zależne od odbioru demo |
| Kolejne dzielnice Neo-Rydu                    | Po premierze                          |

## Tryby

| Pomysł                                           | Dlaczego odłożone                              |
| ------------------------------------------------ | ---------------------------------------------- |
| Nieskończona strefa, areny z mutatorami, poligon | F6                                             |
| Tryb Challenge z codziennym seedem lokalnym      | F6; wersja online po premierze                 |
| Co-op 2 graczy                                   | Wymaga architektury sieciowej, poza zakresem   |
| Tryb speedrun z timerem i duchami                | Po premierze, wymaga deterministycznego replay |

## Technologia i platforma

| Pomysł                                | Dlaczego odłożone                           |
| ------------------------------------- | ------------------------------------------- |
| Build Electron lub Tauri na Steam     | F7                                          |
| Osiągnięcia Steam, chmura zapisów     | Po wyborze platformy desktopowej            |
| Wsparcie gamepada                     | Po demo, wymaga przeprojektowania celowania |
| Replay i nagrywanie przebiegu z seeda | Przydatne w QA, niski priorytet przed F7    |
| Tryb VR                               | Poza zakresem                               |

## Audio, UI i dostępność

- Odsłuch wnętrz (bryły odsłuchu, wyciszenie ulicy w klinice run2) — P1, projekt [`docs/maps/run2.md` §2](maps/run2.md#2-fundamenty-właściwe-dla-bulwaru).

| Pomysł                                                        | Dlaczego odłożone                            |
| ------------------------------------------------------------- | -------------------------------------------- |
| Muzyka reaktywna | F7 — **zaimplementowane, czeka na playtest (PR #34, `src/audio/musicDirector.ts`)** |
| Pełne ustawienia (klawisze, czułość, FOV, dostępność) | F7 — **zaimplementowane, czeka na playtest (`src/ui/settingsScreen.ts`, `inputBindings.json`)** |
| Tryb dla osób z fotoczułością (wyłączenie wstrząsów, błysków) | F7, ale rozważyć wcześniej mały przełącznik — **zaimplementowane, czeka na playtest (ustawienia: wstrząsy ekranu, błyski)** |
| Lokalizacja na inne języki                                    | Po premierze                                 |
| Samouczek interaktywny | F7 — **zaimplementowane, czeka na playtest (`src/scenes/tutorial.ts`, `src/data/tutorial`)** |
| Kosmetyki (skórki ostrza, neonów)                             | Po premierze, monetyzacja poza zakresem demo |

## Jakość i narzędzia

| Pomysł                                   | Dlaczego odłożone                                    |
| ---------------------------------------- | ---------------------------------------------------- |
| Boty grające w Playwright z raportem DPS | F2 (QA i balans)                                     |
| Test FPS w CI                            | Po pierwszych falach z odłamkami, F1 końcówka lub F2 |
| Edytor poziomów w grze, mody             | Poza zakresem                                        |

## Wynikłe z zadań F2

| Pomysł                                                                                   | Dlaczego odłożone                                                           |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Ogłuszenie ciężkim ciosem jako status `stunned` (dziś stan wroga z `stunOnHeavyS`)       | F2-02 dodało status, ale migracja zmieniłaby feel F1; decyzja po playteście |
| ~~Bufor wciśnięcia spustu broni półautomatycznej~~ — zrobione (`tuning.weapons.triggerBufferS`, `docs/systems/weapons.md`) | Feel pistoletu i snajperki — ocenić w playteście |

## Wynikłe z zadań F3

| Pomysł | Dlaczego odłożone |
| --- | --- |
| Wspólny skład walki `Arena` i `RoomScene` | F3-04 powiela skład, by zachować Arenę i jej asercje bez zmian; wydzielenie rdzenia wymaga pełnej regresji jednostkowej i e2e Areny |
| Zagadka z Chwytem (F3-19, typ węzła `puzzle`) | Płyta naciskowa i blokada fotonowa. `typeWeights.puzzle` = 0,08 w danych sektora |
| TTK bossa w symulatorze balansu (`docs/balance.md`), jeśli jeszcze go nie ma | Strojenie po playteście F3 |
| ~~Oddzielenie viewmodelu od głębi świata~~ | Zaimplementowane. Próba przy ścianie: `?scene=room-test&viewmodel=wall&debug=1` |

## Wynikłe z planu F4

| Pomysł | Dlaczego odłożone |
| --- | --- |
| NPC ruchu oporu w kryjówce, dialogi | F5 |
| Automatyczny wzrost Poziomu zagrożenia z poziomem postaci | Odrzucone w ADR 0007; wrócić, jeśli playtest F4 pokaże, że gra robi się za łatwa |

## Playtest 2026-11-23

| Pomysł | Dlaczego odłożone |
| --- | --- |
| Mapy misji i aren za duże na liczbę wrogów: wskaźnik położenia ostatnich wrogów (znacznik / kierunek na HUD) i audyt wszystkich map (które się nadają, które poprawić) | Bierze Gracjan |
| Drzewko wyboru ścieżki w runie: punkty (węzły) za małe, trudno trafić i odczytać | Interfejs: uzgodnić z Gracjanem (audyt UI) |
| Skok przy obiektach blokuje gracza „od góry” (dziwne zatrzymanie, jakby uderzenie w sufit) | Fizyka ruchu, sprawdzić z Gracjanem (jego obszar) |
