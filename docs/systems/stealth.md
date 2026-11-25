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

Scena pokazuje alarm nad postaciami. Integracja z celami misji, radiem i posiłkami korzysta z identyfikatora grupy w zdarzeniu `alarm_raised`.
