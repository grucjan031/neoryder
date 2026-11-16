# Misja 05 — Adiutant

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| I | Kurogane Arms | Huty, dachy hal fabrycznych i górne estakady | Pościg (limitowane odcinki + przejęcie karty) | Noc (limit ok. 90–120 s na odcinek pościgu — do strojenia) | Po Misji 04 (Ładunek klasy K); odblokowuje Misję 06 (Odlewnia) |

## W skrócie

Po utracie kontenera K-112 Oskar Brandt zamyka Huty, odcina zdalny dostęp do sieci ochrony i przenosi klucze uwierzytelniające do obiegu fizycznego. Bajt namierza sygnał jego adiutantki, porucznik Hanny Wirskiej, która przewozi kartę główną trasą po dachach hal i górnych estakadach. Kurier rusza w pościg na czas, wykorzystując skróty wysokościowe, aż osacza Wirską na lądowisku pod ogniem snajperów — kobieta oddaje kartę i na dźwięk nazwiska Szrona wyznaje, że Brandt powiedział ludziom, iż Szron utonął dziewięć lat temu w Niecce.

## Tło fabularne

Przejęcie K-112 wywołało w Kurogane Arms natychmiastową reakcję kryzysową: wszystkie ulice na dole Hut zablokowano ciężkimi rogatkami, a serwery wewnętrzne siedziby ochrony w odlewni odpięto od sieci miejskiej. Bez fizycznej karty autoryzacyjnej Iskra nie dostanie się do dokumentacji transportów ani do samego Brandta.

Zamiast szturmować zaplombowane ulice, Bajt szuka ruchu w paśmie oficerskim i łapie otwarty identyfikator porucznik Hanny Wirskiej — bezpośredniej adiutantki Brandta, która regularnie kursuje między jego biurem a punktami dowodzenia z zapasową kartą dostępu. Żeby ominąć korki i własne blokady na poziomie gruntu, jej konwój porusza się korytarzem technicznym na wysokości dachów hal walcowni i estakad rurociągowych.

Gracz nie zna jeszcze szczegółów wspólnej służby Szrona i Brandta sprzed dziewięciu lat ani treści, które kryje prywatny serwer dyrektora ochrony w odlewni.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Ścigać porucznik Hannę Wirską i jej eskortę przez kolejne odcinki dachów i górnych estakad w Hutach przed upływem limitu czasu na każdym etapie pościgu.
  - Przebić się przez grodzie zamykane przez uciekającą eskortę lub ominąć je górnymi skrótami ruchowymi (podwójny skok, dash, ślizg).
  - Na dachu lądowiska zlikwidować snajperów osłony oraz eskortę, a następnie przejąć kartę sieci ochrony od poddającej się Wirskiej.
- **Warunki porażki:**
  - Śmierć Kuriera (powrót do kryjówki z zachowaniem stałego postępu i powtórka misji).
  - Ucieczka Wirskiej — przekroczenie licznika czasu na którymkolwiek z odcinków pościgu (lub po wejściu na lądowisko przed przybyciem Kuriera).
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Górą szybciej* (pokonanie co najmniej dwóch etapów pościgu przy użyciu skrótów wysokościowych dla podwójnego skoku, dasha lub ślizgu bez otwierania głównych śluz) — nagroda: +20 Danych.
  - *Walizka łącznościowa* (przejęcie zapasowego szyfratora porzuconego przez uciekający oddział na punkcie przesiadkowym w Warstwie 5) — nagroda: +15 Danych.

## Mapa

- **Miejsce i nastrój:** Wysokie dachy hal fabrycznych, rurociągi technologiczne i górne estakady łącznikowe w Hutach, motyw `neonStreet` (noc, poziomy deszcz i silny wiatr na otwartych przęsłach, kłęby pary z kominów chłodniczych pod spodem). Otoczenie ciemne i chłodne. Neony z palety ADR 0006: **bursztynowe** światła przeszkodowe dla śmigłowców na narożnikach dachów, tabliczki wyjść awaryjnych na kładkach w **zieleni**, oznaczenia central wentylacyjnych w **ciepłej bieli**, dalekie szyldy Bulwaru ponad halami w **błękicie królewskim** i **fiolecie**. W deszczu wyraźnie tną przestrzeń **czerwone** wiązki celowników snajperskich i sygnalizacja eskorty, **cyanowe** ostrze gracza oraz **magentowy** Rezonans.
- **Struktura sektora:** Run w sektorze `kurogane` liczy **7 warstw** o wyraźnym układzie pionowym i nastawieniu na tempo przemieszczania się (stałe pokoje fabularne na trasie pościgu w Warstwach 3, 5 i 7):
  - **Warstwa 1 (Wejście na dachy):** punkt startowy oparty na `alleyUnderpass` / wyjściu szybu technicznego na dach walcowni, skąd widać oddalający się oddział Wirskiej.
  - **Warstwa 2 (Ciąg wentylacyjny):** wybór między trasą po kładkach (`combatPlatforms` — z górnym skrótem na rurach wentylacyjnych dla podwójnego skoku) a krótkim dojściem przez zadaszony korytarz (`combatCorridor`).
  - **Warstwa 3 (Estakada załadunkowa — pierwszy odcinek pościgu na czas — stały pokój fabularny):** obowiązkowy węzeł na bazie `combatCorridor` i `combatLaserYard`. Wirska przebiega na drugi koniec estakady i zamyka grodzie; Kurier ma ok. 95 s (do strojenia) na pokonanie obstawy i wyłączenie bramki lub przeciśnięcie się ślizgiem pod niedomkniętą roletą serwisową z boku.
  - **Warstwa 4 (Przeskok między halami):** wybór między krótkim odpoczynkiem w maszynowni windy dachowej (`rooftopRest`) a szybkim przejściem przez zbiorniki azotu (`combatPillars`).
  - **Warstwa 5 (Węzeł suwnic nad odlewnią — drugi odcinek pościgu na czas — stały pokój fabularny):** obowiązkowy węzeł oparty na `combatPlatforms`. Otwarte przęsła i wysięgniki suwnic nad przepaścią; limit ok. 110 s (do strojenia). Dolna kładka obstawiona jest przez Tarczowników, natomiast górna trasa przez belki i rurociąg wymaga precyzyjnego użycia podwójnego skoku oraz dasha w powietrzu. Przy punkcie przesiadkowym leży porzucona walizka łącznościowa (cel dodatkowy).
  - **Warstwa 6 (Podejście pod lądowisko):** wybór między kanciapą techników na dachu (`shopRoom`) a krótkim tarasem z wieżyczkami (`combatYard`), gdzie widać już światła lądowiska.
  - **Warstwa 7 (Dach lądowiska sektorowego — Finał — stały pokój fabularny):** otwarty dach z płytą lądowiska i wyższymi gzymsami po bokach na bazie `eliteCourtyard` (wariant dachowy). Wirska czeka przy krawędzi na śmigłowiec transportowy; jej odwrót osłaniają **Snajperzy (`sniper`)** rozstawieni na wyższych konstrukcjach oraz grupa szturmowa na płycie. Po oczyszczeniu osłony Wirska nie podejmuje walki — odrzuca broń i oddaje kartę dostępu.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Skróty ruchowe (Warstwy 2, 3 i 5):** niskie prześwity pod roletami (ślizg), rurociągi i wysięgniki nad lukami (podwójny skok + dash), które skracają czas odcinka o kilkanaście sekund względem głównej śluzy.
  - **Walizka łącznościowa (Warstwa 5 — opcjonalna):** upuszczona przy próbie przesiadki na linę transportową; podniesienie trwa ok. 1,5 s.
  - **Porucznik Hanna Wirska (Warstwa 7):** postać fabularna przy relingu lądowiska (nie jest celem do zabicia); po zlikwidowaniu snajperów i eskorty uruchamia się krótka sekwencja przejęcia karty.
- **Wrogowie:**
  - Frakcja: **Kurogane Arms** (czerwone oznaczenia).
  - Archetypy w Misji 05:
    - **Snajper (`sniper` — pierwsze pełne wystąpienie taktyczne w akcie):** ustawiony na dachach i gzymsach w Warstwach 5 i 7; namierza Kuriera widoczną czerwoną wiązką przez deszcz przed oddaniem ciężkiego strzału, zmuszając do ruchu między kominami wentylacyjnymi i korzystania z dasha lub Błyskawicy/Chwytu.
    - **Szturmowiec (`assaulter`)** i **Strzelec (`gunner`):** tylna straż konwoju blokująca przejścia w trakcie pościgu.
    - **Tarczownik (`shielder`):** zamyka wąskie kładki w Warstwie 5, zachęcając do obejścia górnym skrótem.
    - **Dron (`drone`):** patroluje luki między dachami, utrudniając dłuższe skoki.
    - **Wieżyczka (`turret`):** przy zamkniętej śluzie na estakadzie w Warstwie 3.
- **Zagrożenia środowiskowe:**
  - Przepaście między halami i suwnicami w Warstwie 5 — upadek poza kładkę lub rurę powoduje cofnięcie na poprzednią krawędź i utratę zdrowia oraz cennych sekund pościgu.
  - Odsłonięte przestrzenie dachu lądowiska w Warstwie 7, przez które przechodzą linie ognia kilku snajperów jednocześnie.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Bajt pokazuje na ekranie odcięcie sieci Hut i wyśledzony nadajnik adiutantki Brandta. Mira wskazuje na planach dachowe rurociągi i kanały wentylacyjne jako jedyną drogę szybszą od windy eskorty. Szron milknie wyraźnie na nazwisko Brandta i wydaje rozkaz wzięcia karty żywcem.
2. **Wyjście na górę i pierwszy odcinek (Warstwy 1–3):** Kurier wchodzi szybem na poziom dachów. Na estakadzie załadunkowej widzi w deszczu znikającą sylwetkę Wirskiej i jej straży. Czas rusza: albo przebija zamek śluzy, albo przeciska się ślizgiem pod boczną roletą.
3. **Suwnice i skróty nad odlewnią (Warstwy 4–5):** Po krótkim odpoczynku w maszynowni zaczyna się najtrudniejszy etap wysokościowy — wyścig nad czynnymi halami odlewni, gdzie skróty nad lukami pozwalają wyprzedzić czas zamykania kolejnej bramy.
4. **Lądowisko pod ogniem snajperów (Warstwy 6–7):** Na ostatnim dachu śmigłowiec transportowy dopiero podchodzi z zachodu, ale osłonę przejęli już snajperzy na nadbudówkach. Kurier wykorzystuje zbiorniki i kominy jako osłonę, zdejmuje strzelców na gzymsach i rozbija eskortę przy płycie.
5. **Poddanie się Wirskiej:** Pozbawiona obstawy porucznik Hanna Wirska rzuca pistolet na mokry beton i wyciąga z kieszeni plastikową kartę kodującą. Gdy przez otwarty głośnik komunikatora pada nazwisko Szrona, Wirska zastyga — jest przekonana, że porucznik Szron utonął dziewięć lat temu podczas zamieszek przy przepompowni w Niecce.
6. **Odwrót i powrót na Kamienną (`hideout`):** Kurier zabiera kartę i znika w szybie technicznym, zanim transport doleci nad lądowisko. W kryjówce Szron bez zbędnych słów potwierdza swoją przeszłość w Kurogane i wyznacza ostatni cel Aktu I: odlewnię, w której siedzi Oskar Brandt.

## Dialogi

### Odprawa (kryjówka)

**Bajt:** Wszystkie bramy naziemne w Hutach zaryglowane, a sieć ochrony zdjęta z łączy miejskich. Bez fizycznej karty autoryzacyjnej nie wejdziemy nawet do przedpokoju Brandta.
**Mira:** Skąd ją weźmiemy, skoro sam siedzi w odlewni pod podwójną zmianą?
**Bajt:** Mam coś lepszego niż samego Brandta. Jego adiutantka, porucznik Hanna Wirska, wyszła właśnie z bocznego skrzydła z kopią karty na zmianę szyfrów. Jedzie górnymi estakadami na wschodnie lądowisko.
**Szron *(po krótkiej pauzie)*:** Wirska. Znam jej teczkę. Nie będzie się bić do ostatniego naboju, jeśli straci osłonę, ale ma kwadrans przewagi na czystych drogach.
**Mira:** Na dole nie ma, kurwa, żadnych czystych dróg, wszystko stoi w blokadach. Kurier musi iść górami — po dachach walcowni i ciągach wentylacyjnych.
**Mira:** Tam pełno starych rur i niedomkniętych rolet serwisowych. Nie szukaj zamków, jak możesz przelecieć górą albo prześlizgnąć się pod blachą.
**Bajt:** Jeśli dopadnie śmigłowca na lądowisku, karta zniknie z sektora. Zegar ruszy, jak tylko złapią twój ślad na pierwszym dachu.
**Szron:** Jedna uwaga: potrzebujemy karty w całości i w miarę możliwości samej Wirskiej przytomnej, nie podziurawionej. Wytnij eskortę, nie ją.
**Tomasz:** Wiatr na wysokości hal potrafi zepchnąć z rury podczas deszczu. Pilnuj krawędzi, Kurier.

### W trakcie misji (radio)

**Wejście na dachy (Warstwa 1):**
**Bajt:** Sygnał z karty Wirskiej jest sto metrów przed tobą, na wysokości czwartego piętra. Już ruszyli w stronę estakady.
**Szron:** Zaczynaj pościg. Nie wdawaj się w długie strzelaniny na kładkach, jeśli nie blokują ci przejścia.

**Estakada załadunkowa — zamknięcie grodzi (Warstwa 3):**
**Bajt:** Zamknęli główną śluzę na estakadzie, sukinsyny! Licznik idzie w dół — jeśli nie przebijesz się w półtorej minuty, wjadą na lądowisko przed czasem!
**Mira:** Patrz na prawo od bramy, przy skrzynkach elektrycznych. Blacha rolety serwisowej wisi dwadzieścia centymetrów nad betonem — przelecisz ślizgiem, nie musisz stać przy zamku!

**Po przejściu pierwszego odcinka:**
**Bajt:** Jesteś z powrotem na ogonie konwoju! Przestawili się na szybsze przejście w stronę starych suwnic.

**Węzeł suwnic — drugi odcinek pościgu (Warstwa 5):**
**Mira:** Tu zaczyna się wesoło. Albo walczysz z tarczami na dolnej kładce, albo skaczesz po żółtych wysięgnikach suwnic nad przepaścią. W powietrzu dopal dasha, inaczej nie dosięgniesz przeciwnego dachu.
**Bajt:** Widzę tam też porzucony pakunek w bocznym gnieździe — pewnie rzucili zapasowy szyfrator, żeby lżej biec. Zgarnij, jeśli wyrobisz się w czasie.

**Pojawienie się snajperów (Warstwa 6–7):**
**Szron:** Uwaga! Czerwone linie przez deszcz — na wyższych gzymsach wokół lądowiska siedzą snajperzy. Nie zatrzymuj się na otwartej płycie.
**Bajt:** Wirska jest już przy relingu! Transportowiec podchodzi od wschodu, masz ostatnią minutę na oczyszczenie dachu!

**Po zdjęciu osłony i snajperów (Warstwa 7 — scena poddania):**
*(Porucznik Hanna Wirska rzuca pistolet na mokry asfalt i podnosi puste dłonie.)*
**Wirska:** Pieprzyć to, wystarczy. Nie jestem warta kulki za podpis dyrektora. Karta leży w prawej kieszeni kurtki.
**Szron *(wchodząc na głośnik komunikatora Kuriera)*:** Zostaw broń tam, gdzie leży, porucznik. Karta i kody zmiany na dzisiejszą noc.
**Wirska *(zastyga, patrząc w komunikator)*:** Czekaj... znam ten głos. Szron?
**Szron:** Zostawiamy cię bez radia. Zanim przyleci wóz z hali, zdążymy wyjść z sektora.
**Wirska:** Niemożliwe... Brandt powiedział całemu garnizonowi, że utonąłeś w Niecce dziewięć lat temu. Na odprawie po przepompowni odczytali twój akt zgonu.
**Szron *(krótko, po sekundzie ciszy)*:** Jak widać, nie doczytał do końca. Zabieraj kartę, Kurier, i znikaj szybem za kominami.

### Po misji (kryjówka)

**Bajt:** Karta jest czysta, zero zdalnego czyszczenia. Mamy klucz do wejścia serwisowego pod odlewnią i do sieci ochrony Brandta.
**Mira *(odkładając narzędzia)*:** Akt zgonu, Szron. Przez tydzień mówiłeś o Brandcie, jakbyś znał go z gazety.
**Szron:** Służyłem pod nim. Dziewięć lat temu.
**Mira:** To wszystko?
**Tomasz:** Przepompownia w Niecce. Tamtej nocy wyłączyli pompy, a ludzie stanęli przy zaworach.
**Szron:** Tomasz.
**Tomasz:** Dobrze, dobrze.
**Szron:** Przy jednym zaworze stał chłopak z kluczem w rękach. Miał może szesnaście lat. *(cisza)* Za godzinę Wirska złoży meldunek i Brandt będzie wiedział wszystko. Nie czekamy do jutra.
**Wolan:** K-112 nadal ma bardzo niskie ciśnienie. Ale serwer Brandta to jedyne, co wyjaśni, po co Helixa kupuje te odczyty.
**Mira:** Odlewnia pracuje całą noc. Hałas pieców przykryje wejście.
**Szron:** Karta otwiera dolne drzwi serwisowe. Zbieraj sprzęt, Kurier.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 115 Danych oraz 1 Rdzeń za ukończenie misji (oraz do 35 Danych z celów opcjonalnych); Kredyty z pokojów działają wyłącznie w ramach bieżącego runu.
  - Odblokowanie ulepszenia mobilności (dash/skok) lub karabinu precyzyjnego w warsztacie Miry.
- **Zmiany w kryjówce:**
  - Przy biurku Bajta pojawia się fizyczna karta dostępu Kurogane w czytniku deszyfrującym.
  - Postacie w kryjówce komentują przeszłość Szrona i zbliżające się uderzenie na główną siedzibę Brandta; Ida nadal leży nieprzytomna w kąciku łączności pod opieką Wolan.
- **Co misja otwiera dalej:**
  - Odblokowuje finał Aktu I: **Misję 06 — Odlewnia** (likwidacja Oskara Brandta i przejęcie serwera ochrony).

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Sektor `kurogane`, mapa wyboru ścieżki, szablony pokojów (`alleyUnderpass`, `combatCorridor`, `combatLaserYard`, `combatPlatforms`, `rooftopRest`, `combatPillars`, `shopRoom`, `combatYard`, `eliteCourtyard`).
  - Wrogowie: `assaulter`, `gunner`, `shielder`, `drone`, `turret` oraz `sniper`.
- **Nowe elementy potrzebne dla Misji 05:**
  - Zegar odcinka pościgu w Warstwach 3 i 5 (odliczanie z warunkiem porażki po wyzerowaniu, resetowane przy osiągnięciu przejścia do kolejnej warstwy).
  - Układy geometryczne ze skrótami ruchowymi (niskie szczeliny do prześlizgu pod roletami, wysokie ciągi rur dla podwójnego skoku i dasha).
  - Scenka/interakcja poddania się porucznik Hanny Wirskiej w Warstwie 7 po pokonaniu eskorty i snajperów (przekazanie karty zamiast walki z nią).
- **Propozycje do backlogu (poza minimum F5):**
  - Widoczna sylwetka uciekającej eskorty Wirskiej przebiegającej przed zamknięciem śluzy na początku Warstwy 3 i 5 (wzmacniająca poczucie pościgu w czasie rzeczywistym).
