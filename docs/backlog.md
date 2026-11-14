# Backlog — pomysły „po premierze / poza bieżącą fazą”

Zasada: zadania spoza bieżącej fazy trafiają tutaj, nie do kodu. Przegląd na bramce każdej fazy; Producent przenosi pozycję do issues dopiero po akceptacji człowieka.

## Walka i ruch

| Pomysł                                 | Dlaczego odłożone                                              |
| -------------------------------------- | -------------------------------------------------------------- |
| Rzut ostrzem (bumerang) i dash-cięcie  | Zaplanowane na F2; F1 weryfikuje podstawy ostrza               |
| Warianty ostrzy (podwójne, dwustronne) | F2, wymaga stabilnego combo i danych broni                     |
| Parowanie ataków wręcz                 | Najpierw parowanie pocisków; osobne issue po bramce F1         |
| Wspinaczka, bieg po ścianach           | Ryzyko dla czytelności aren, brak pewności, że wzmacnia filary |
| Wykończenia (execution) z animacją     | Po ustaleniu feel hitstopu; wymaga animacji                    |
| Rzucanie obiektami fizycznymi (Chwyt)  | F2 (moc Chwyt i rzut)                                          |

## Moce i bronie

- Aktywne chłodzenie blastera w idealnym oknie podczas przegrzania — F2, po ocenie podstawowego zarządzania ciepłem w F1 #06.

| Pomysł                                                                 | Dlaczego odłożone                 |
| ---------------------------------------------------------------------- | --------------------------------- |
| Pozostałe moce Rezonansu (Chwyt, Błyskawica, Fala, Bariera, Skupienie) | F2, po sprawdzeniu pierwszej mocy |
| Pozostałe typy broni, moduły (rykoszet, przebicie, podpalenie)         | F2                                |
| Efekty statusów (podpalenie, przeciążenie, ogłuszenie)                 | F2                                |
| Granaty EMP, ciągły laser                                              | F2, wymagają statusów             |
| Ulepszenia mocy zmieniające działanie                                  | F4 (drzewka)                      |

## Wrogowie i bossowie

- Symulacja TTK bossa z progami HP, nietykalnością przejść i wzorcami faz:
  osobne zadanie po F3-16. Raport balansu F2 pomija `kind: 'boss'`, ponieważ
  model paczek zwykłych wrogów nie odtwarza tych mechanik.

| Pomysł                                            | Dlaczego odłożone                |
| ------------------------------------------------- | -------------------------------- |
| Snajper, Dron, Tarczownik, Egzekutor              | F2                               |
| Koordynacja grupy (flankowanie, ostrzał zaporowy) | F2                               |
| Bossowie Helixa, Kurogane, Orbis                  | Pierwszy boss w F3, kolejni w F5 |
| Ataki środowiskowe i pułapki                      | Po stabilnym generatorze pokoi   |

## Roguelite i progresja

| Pomysł                              | Dlaczego odłożone                     |
| ----------------------------------- | ------------------------------------- |
| Implanty per run i rzadkości        | F3                                    |
| Drzewka talentów i hybrydy          | F4                                    |
| Waluty Dane i Rdzenie, odblokowania | F4                                    |
| Poziom zagrożenia                   | F4                                    |
| Wydobywanie modułów z runu          | Po meta-progresie, ryzyko dla balansu |
| Codzienne wyzwania z tabelą online  | Wymaga backendu, poza demo            |

## Świat i fabuła

| Pomysł                                        | Dlaczego odłożone                     |
| --------------------------------------------- | ------------------------------------- |
| Generator sektorów, moduły pokoi              | F3                                    |
| Kryjówka jako grywalny hub                    | F4                                    |
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

| Pomysł                                                        | Dlaczego odłożone                            |
| ------------------------------------------------------------- | -------------------------------------------- |
| Muzyka reaktywna                                              | F7                                           |
| Pełne ustawienia (klawisze, czułość, FOV, dostępność)         | F7                                           |
| Tryb dla osób z fotoczułością (wyłączenie wstrząsów, błysków) | F7, ale rozważyć wcześniej mały przełącznik  |
| Lokalizacja na inne języki                                    | Po premierze                                 |
| Samouczek interaktywny                                        | F7                                           |
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
| Bufor wciśnięcia spustu broni półautomatycznej (klik w trakcie odnowienia przepada)      | Feel pistoletu i snajperki — ocenić w playteście F2                         |

## Wynikłe z zadań F3

| Pomysł | Dlaczego odłożone |
| --- | --- |
| Wspólny skład walki `Arena` i `RoomScene` | F3-04 powiela skład, by zachować Arenę i jej asercje bez zmian; wydzielenie rdzenia wymaga pełnej regresji jednostkowej i e2e Areny |
| Zagadka z Chwytem (F3-19, typ węzła `puzzle`) | Niski priorytet; `typeWeights.puzzle` = 0 w danych sektora |
| TTK bossa w symulatorze balansu (`docs/balance.md`), jeśli jeszcze go nie ma | Strojenie po playteście F3 |
| Oddzielenie viewmodelu od głębi świata (ręce mogą wchodzić w ściany) | Osobne zadanie grafiki/renderu |
