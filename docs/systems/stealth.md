# Skradanie i alarm

W starciu z opcją `stealth` każdy strażnik pamięta czujność od 0 do 1 i ostatnią zauważoną pozycję lub źródło dźwięku. Domyślny stożek ma pełny kąt 90° i zasięg 18 m. Kąt mierzony jest w poziomie, odległość w trzech wymiarach. Promień Rapiera biegnie od środka sylwetki do pozycji gracza. Blokują go kolidery świata.

Wykrycie stojącego gracza trwa od 0,9 s w pobliżu do 2,6 s na granicy zasięgu. Czas interpoluje się liniowo względem odległości. Dron potrzebuje 1,5 s. Ruch poziomy powyżej 0,15 m/s mnoży przyrost przez 1,35, a kucanie przez 0,5. Oba mnożniki mogą działać razem.

| Stan         | Zachowanie                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unaware`    | Patrol między punktami trasy lub oczekiwanie na stanowisku.                                                                                                |
| `suspicious` | Od czujności 0,32 strażnik podchodzi do ostatniej znanej pozycji i rozgląda się. Bursztynowy znak zapytania pokazuje poziom czujności.                     |
| `alerted`    | Przy czujności 1 strażnik zgłasza alarm i otrzymuje cel walki. Czerwony wykrzyknik sygnalizuje namierzenie. Dron otwiera ogień po rozesłaniu alarmu grupy. |
| `searching`  | Po sekundzie bez kontaktu strażnik sprawdza ostatnią znaną pozycję. Po 6 s wraca do patrolu. Grupa pamięta ogłoszony alarm.                                |

Strzał słychać w promieniu 22 m, wybuch w promieniu 38 m, a zamach ostrzem w promieniu 2,5 m. Ściany przesłaniają wzrok. Hałas i zauważona śmierć podnoszą czujność co najmniej do progu podejrzenia. Czujność maleje o 0,12/s, a badanie bodźca trwa co najmniej 3 s. Obrót przy rozglądaniu wynosi 48°/s.

Pierwszy strażnik, który przeżyje 0,65 s od namierzenia, alarmuje swoją grupę. Śmierć przerywa jego zgłoszenie. Pozostali mogą dokończyć własne. Każda grupa emituje `alarm_raised` raz. Reset sceny usuwa grupy i zgłoszenia.

Trafienie ostrzem strażnika w stanie `unaware` lub `suspicious` z tylnego sektora 100° albo spoza jego widoczności kończy się wykończeniem. Świadek dostaje ostatnią pozycję ofiary. Zasięgi i czasy zmienia się w `tuning.enemies.perception` i `tuning.enemies.alarm`.

## Odbiór w hali

Otwórz `?scene=stealth-test&debug=1`, wpisz `stealth reset`, potem `stealth cones on`. Przed graczem stoi szturmowiec. Komenda `stealth suspect` ustawia u patroli „?”, a `stealth alarm` ustawia „!”. Podejrzenie można także wywołać strzałem obok strażnika. Komenda `stealth state` wypisuje id, archetyp, stan i czujność ocalałych. Łatwy wariant podejścia od tyłu zaczyna się po resecie i przełączeniu na ostrze komendą `hold blade`.

## M07

Hala i magazyn dzielą grupę `przychodnia`. Stanowisko z polem `patrols[].enemy` przydziela trasę według archetypu i ustawia strażnika w pierwszym punkcie. Pojedynczy punkt oznacza posterunek. Dzięki temu kolejność wylosowana przez dyrektora fali nie przestawia kamery ani ochrony chłodziarki. Ujemna strona hali za przegrodą przy z = −3,4 prowadzi obok patroli.

Cichy patrol ma lokalny cykl fali. Radio pozostaje w trybie spokojnym, a Nadia otwiera ogień do strażnika po jego namierzeniu. Starcie kończy się po śmierci ostatniego wroga albo po opuszczeniu sekcji przed alarmem. Ominięci strażnicy pozostają na mapie. Wykrycie uruchamia pościg i zamyka rolety na czas starcia w hali. Przy 60% transferu serwer zgłasza tę samą grupę. Ten sygnał obsługuje kwestia transferu. Kwestia o meldunku patrolu pada przy wcześniejszym wykryciu. Istniejący rozkaz zabrania próbki przy starcie pościgu ma warunek `beforeObjective: kapsula`, więc po odebraniu kapsuły Bajt nie przerywa transmisji sprzecznym komunikatem.

Do podglądu uruchom odblokowaną M07 z `debug=1`, wpisz `objective done krata`, `checkpoint hala`, potem `tp 132 0 -90`. Wzrok skierowany jest wzdłuż głównego przejścia. `alarm state` zwraca grupy, meldunki, stany strażników i wynik premii. `alarm przychodnia` wymusza meldunek, a `hurt 99999` przy wyłączonej nieśmiertelności pozwala sprawdzić powrót do checkpointu.

Scena pokazuje alarm nad postaciami. Integracja z celami misji, radiem i posiłkami korzysta z identyfikatora grupy w zdarzeniu `alarm_raised`.
