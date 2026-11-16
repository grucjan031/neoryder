# Misja 17 — Przerwa w dostawie

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| III | Orbis Grid (wsparcie ochrony Kurogane) | Huty, Bulwar, Niecka: trzy podstacje | Sabotaż sekwencyjny na czas | Okno czasowe od wyłączenia pierwszej podstacji (propozycja: 6 min 30 s) | Po Misji 16 (Sala monitorów); odblokowuje Misję 18 (Strojenie) |

## W skrócie

Osłony radiowe Masztu zasilają trzy podstacje rozrzucone między Hutami, Bulwarem i starą tamą w Niecce. Kurier sam wybiera kolejność na mapie sektora i w jednym oknie czasowym wybija wszystkie trzy, zanim sieć Orbis ustabilizuje przerzut obciążenia, pokonując elitarne oddziały strzegące każdego węzła. Po zrzuceniu ostatniego wyłącznika cały dół miasta zapada w ciemność — zostają tylko neony na akumulatorach, ostrze gracza i sześć godzin zapasu w przychodniach Helixa.

## Tło fabularne

Plany wyniesione przez Bajta z Sali Monitorów pokazały, dlaczego szczyt Masztu jest nieosiągalny bez uderzenia w infrastrukturę poniżej: barierę radiową wokół węzła Chóru trzymają trzy rezerwowe magistrale wysokiego napięcia. Zegar uruchomienia Chóru schodzi poniżej trzech dni.

Od ataku na Kamienną i ponownej utraty Tymona Mira przestała siedzieć cicho przy warsztacie. Zamiast Szrona bierze mikrofon do prowadzenia operacji, bo zna schematy rozdzielni w Hutach i Niecce z czasów przed Iskrą. Jest spięta, szorstka i traktuje wyłączenie podstacji jako warunek jakiegokolwiek dalszego ruchu po brata.

Wolan ostrzega przed skutkami ubocznymi: z tych samych transformatorów ciągną zasilanie bezpłatne przychodnie Helixa w Bulwarze i punkty opieki na dole miasta. Po odcięciu linii głównej przejdą na akumulatory awaryjne, których wystarczy na sześć godzin. Gracz nie wie jeszcze, że Orbis spróbuje natychmiast odpowiedzieć na zaciemnienie przyspieszoną próbą Chóru w Bulwarze.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Wybrać kolejność na mapie sektora i dotrzeć do trzech podstacji zasilających osłony Masztu: w Hutach, na Bulwarze oraz przy tamie w Niecce.
  - Przy każdej podstacji pokonać elitarną obstawę i zrzucić główną szynę zasilania.
  - Wyłączyć drugą i trzecią podstację w jednym oknie czasowym liczonym od momentu odcięcia pierwszej (propozycja do strojenia: 6 min 30 s), zanim automatyczne przełączniki Orbis zamkną pętlę obejścia i przywrócą pełną osłonę.
- **Warunki porażki:**
  - Śmierć Kuriera.
  - Przekroczenie okna czasowego po wyłączeniu pierwszej podstacji — sieć przełącza obciążenie na linie awaryjne i zamyka grodzie transformatorów (powrót do kryjówki z zachowaniem stałego postępu).
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Odpięcie kondensatorów buforowych przed wyłączeniem drugiej podstacji* (krótka interakcja w pokoju podejścia — spowalnia narastanie obciążenia o 20 s) — nagroda: +25 Danych.
  - *Wyłączenie wszystkich trzech podstacji z zapasem co najmniej 60 s na liczniku* — nagroda: +30 Danych.

## Mapa

- **Miejsce i nastrój:** Trzy poziomy dolnego i środkowego Neo-Rydu połączone ciągami technicznymi w nocnym deszczu (`neonStreet`). W Hutach ciężki zapach ozonu i mokrego żelaza; na Bulwarze wiatr pod estakadą i rozmyte reklamy; przy tamie w Niecce dudnienie wody za betonową ścianą. Kolory otoczenia ciemne i chłodne, neony ADR 0006: **bursztyn** lamp przemysłowych w Hutach, **fiolet** i **błękit królewski** na estakadzie Bulwaru, **zieleń** wyjść serwisowych i **ciepła biel** tablic ostrzegawczych przy tamie. Po odcięciu ostatniej podstacji wszystkie lampy sieciowe gasną — zostaje ciemność deszczu, słabe neony podtrzymywane akumulatorami, **czerwone** wizjery niedobitków, **cyanowe** ostrze plazmowe gracza i **magentowy** błysk Rezonansu.
- **Struktura sektora (trzy odnogi w wybranej kolejności):**
  - **Warstwa 1 (Węzeł zborny — start):** `alleyUnderpass` na styku szybów między Niecką a wschodnią rampą. Z tego miejsca mapa sektora otwiera trzy równoległe gałęzie prowadzące do trzech podstacji — gracz sam decyduje, w jakiej kolejności je odwiedzi (zależnie od tego, czy woli zacząć od najtrudniejszej elity na czystym czasie, czy zostawić łatwiejszy powrót).
  - **Gałąź A — Podstacja Huty (wschód dołu):**
    - Pokój podejścia: wybór między `combatWarehouse` (plac rozładunkowy transformatorów) a `shopRoom` (skrytka złomiarzy z wymiennikami).
    - Stały pokój fabularny: `combatSubstation` (otwarta hala rozdzielni wysokiego napięcia z szynami pod prądem i elitą **Egzekutorem** w pancerzu Kurogane wspieranym przez strzelców).
  - **Gałąź B — Podstacja Bulwar (estakady):**
    - Pokój podejścia: wybór między `combatPlatforms` (mostki serwisowe pod torowiskiem kolejki) a `restRoom` (sucha studzienka kablowa).
    - Stały pokój fabularny: `eliteCourtyard` / `combatSubstation` w wariancie estakadowym (taras transformatorowy nad targiem; elitarny **Tarczownik-dowódca** lub `executor` w osłonie snajperów i dronów Orbis).
  - **Gałąź C — Podstacja Niecka (tama przeciwpowodziowa):**
    - Pokój podejścia: wybór między `combatFloodedTunnel` (zalany chodnik rewizyjny pod zaporą) a `restRoom` / `shopRoom`.
    - Stały pokój fabularny: `combatSubstation` / `combatLaserYard` przy maszynowni tamy (krzyżowy ogień wieżyczek i **elitarny Akordowiec** — propozycja do backlogu; wariant zastępczy: `executor` + `hacker`).
  - **Warstwa końcowa (Punkt zrzutu po trzeciej podstacji):** krótki odcinek wyjściowy w całkowitym zaciemnieniu (`alleyCrossing` bez zasilania sieciowego) prowadzący do szybu zejścia na Kamienną.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Szyny wyłącznika głównego (x3, po jednej w każdej podstacji):** ciężkie dźwignie sprzężone z zamkiem bezpieczeństwa; opuszczenie wymaga przytrzymania interakcji przez ok. 2,5 s (propozycja do strojenia) po wyeliminowaniu elity lub przełamaniu jej osłony. Wyłączenie pierwszej podstacji natychmiast uruchamia licznik przeciążenia sieci.
  - **Skrzynka kondensatorów buforowych (opcjonalna):** pozwala upuścić część ładunku przed kolejnym węzłem.
  - **Właz szybu zejściowego (koniec misji):** otwiera się automatycznie po wygaśnięciu trzeciej podstacji i zabezpieczeniu wyjścia.
- **Wrogowie:**
  - Frakcja: **Orbis Grid** wspierana przez najemne oddziały ochrony **Kurogane Arms** przy starszych węzłach w Hutach i Niecce.
  - Archetypy: **Szturmowiec (`assaulter`)**, **Strzelec (`gunner`)**, **Tarczownik (`shielder`)**, **Snajper (`sniper`)**, **Dron (`drone`)**, **Dron-haker (`hacker`)**, **Wieżyczka (`turret`)**.
  - **Elity przy podstacjach:**
    - Huty: **Egzekutor (`executor`)** z ciężkim uzbrojeniem i czerwonym ostrzem/młotem przemysłowym.
    - Bulwar: **Dowódca ochrony Orbis** (propozycja do backlogu: elitarny `shielder` ze wsparciem dronów; wariant zastępczy: `executor` + `hacker`).
    - Niecka (tama): **Elitarny Akordowiec** (propozycja do backlogu: elita używająca czerwonych kopii mocy Pchnięcia i Fali; wariant zastępczy: `executor` wspierany przez `turret`).
- **Zagrożenia środowiskowe:**
  - **Przerzut obciążenia sieci:** po wyłączeniu pierwszej podstacji dwie pozostałe dostają nadwyżkę mocy — wyładowania łukowe przy uszkodzonych transformatorach (cykliczne strefy porażenia w promieniu 2,5 m — do strojenia) oraz szybsza reakcja wieżyczek.
  - Płytka woda przy tamie w Niecce przewodzi wyładowania łukowe z rozdzielni.
  - Nagłe zaciemnienie po trzecim wyłączniku obniża widoczność daleką podczas odwrotu do szybu.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Mira przejmuje konsolę łączności. Szron nie protestuje, choć ton Miry jest ostry i pozbawiony cierpliwości. Wolan zaznacza na schemacie, że po odcięciu podstacji przychodnie w Bulwarze utrzymają się na akumulatorach tylko przez sześć godzin. Kurier dostaje wybór kolejności wejścia na podstacje.
2. **Wybór kolejności i pierwsza podstacja:** Kurier wybiera pierwszą gałąź na mapie sektora (Huty, Bulwar lub Nieckę). Dopóki pierwsza podstacja działa, zegar przeciążenia jeszcze nie tyka — to najlepszy moment na spokojne przygotowanie w pokoju podejścia. Po pokonaniu pierwszej elity i zrzuceniu szyny sieciowej zegar rusza, a pozostałe dwie podstacje przejmują nadwyżkę prądu.
3. **Przerzut obciążenia i druga podstacja:** Przejście do drugiej gałęzi pod presją czasu. Transformatory na placu iskrzą, wieżyczki kręcą się szybciej, a Orbis wysyła drony-hakery, by spowolnić podejście. Po pokonaniu drugiej elity i zbiciu wyłącznika Mira odczytuje gwałtowny skok napięcia na ostatnim ocalałym węźle.
4. **Trzecia podstacja i zaciemnienie:** Walka przy ostatniej rozdzielni w warunkach najwyższego przeciążenia. Gdy pada trzecia elita i Kurier zrzuca ostatnią szynę, przez linię idzie suchy trzask bezpieczników wysokiego napięcia. Gasną wszystkie lampy uliczne, reflektory hal i wieże reklamowe w Hutach, na Bulwarze i w Niecce.
5. **Odwrót w ciemności:** Przez chwilę słychać tylko deszcz i szum wyłączonych transformatorów. W ciemności widać wyłącznie neony podpięte pod lokalne akumulatory, czerwone światła ocalałych patroli i cyanowe ostrze Kuriera. Wolan podaje przez radio sześciogodzinny limit dla przychodni, po czym Kurier schodzi szybem do Kamiennej.
6. **Powrót na Kamienną (`hideout`):** Na stacji świecą jedynie awaryjne lampy na akumulatorach. Maszt nad miastem ma wyłączone osłony zewnętrzne, ale zegar Wolan zaczyna odliczać sześć godzin. Chwilę później Bajt wyłapuje z Bulwaru niepokojący skok mocy z zasilania awaryjnego Masztu.

## Dialogi

### Odprawa (kryjówka)

**Mira:** Trzy podstacje. Huty na wschodzie, transformatory pod estakadą Bulwaru i stara rozdzielnia przy tamie w Niecce. Prowadzę przez radio.
**Szron:** Kolejność wybierasz na mapie podejścia. Dopóki nie zrzucisz pierwszej szyny, sieć pracuje normalnie i nie ma licznika.
**Mira:** Kiedy padnie pierwsza, Orbis przerzuci całe obciążenie na dwie pozostałe. Zacznie iskrzyć na placach, a system zamknie grodzie awaryjne, jeśli zejdzie za długo.
**Wolan:** Chcę przypomnieć o jednej rzeczy. Z tej samej linii zasilane są przychodnie Helixa na Bulwarze i stacje dializ w Niecce.
**Mira:** Przełączą się na akumulatory.
**Wolan:** Na sześć godzin, może sześć i pół, jeśli odłączą oświetlenie. Potem ludzie z niskim Akordem i ciężsi pacjenci zostaną bez aparatury.
**Mira:** Ilu umrze, jeśli się nie wyrobimy?
**Wolan:** Kilkunastu na pewno. Dokładniej nie umiem policzyć.
**Mira:** Tymon też jest na ich aparaturze albo gorzej. Jeśli nie zdejmiemy osłon Masztu dziś w nocy, za dwa dni włączą Chór i nikt na dole nie będzie już sobą.
**Szron:** Czas jest krótki. Nie wracamy z pustymi rękami.
**Bajt:** Przy każdej podstacji postawili osobną ochronę — ciężki sprzęt Kurogane albo nowe jednostki Orbis. Zrób obejście, jeśli zobaczysz na podejściu kondensatory buforowe; jak je rozłączysz, zyskasz trochę sekund na zegarze.
**Mira:** Dość, kurwa, gadania. Sprzęt sprawdzony, Kurier? Wchodzisz w sieć szybów pod rozjazdami i wybierasz pierwszy cel.

### W trakcie misji (radio)

**Start przy rozjazdach (Warstwa 1):**
**Mira:** Jesteś na węźle zbornym. Huty są za wschodnim tunelem, Bulwar nad głową, tama w Niecce prosto w dół. Wybierz, od czego zaczynasz, i daj znać przed wejściem na halę.

**Pierwsza podstacja — przed wyłączeniem:**
**Mira:** Elita na stanowisku. Zdejmij obstawę, zanim dotkniesz głównej szyny — jak staniesz przy dźwigni z ogniem na plecach, nie zdążysz pociągnąć.

**Po wyłączeniu pierwszej podstacji (uruchomienie zegara):**
**Bajt:** Pierwsza spadła! Obciążenie skoczyło na dwie pozostałe o czterdzieści procent. Zegar idzie, mamy okno trochę ponad sześć minut.
**Mira:** Nie stój przy rozdzielni, wyjdź z zasięgu łuku i leć do następnej. Zostaw dobijanie niedobitków, jeśli nie blokują przejścia.

**Wariant dla Hut (jeśli wybrane jako 2. lub 3.):**
**Mira:** Huty wyją na przeciążeniu. Uważaj na rozlane chłodziwo przy szafach — jak przeskoczy iskra, parzy przez pancerz.
**Szron:** Egzekutor pilnuje bramy wschodniej. Najpierw rozbij mu osłonę ogniową z boku.

**Wariant dla Bulwaru (jeśli wybrany jako 2. lub 3.):**
**Bajt:** Na estakadzie Bulwaru dorzucili drony-hakery do podstacji. Jak zaczną ci grzebać w interfejsie, zdejmuj je pierwsze.
**Mira:** Szybciej, kurwa. Na zegarze nie przybywa, a ten taras ma dwa wejścia dla snajperów z góry.

**Wariant dla Niecki / tamy (jeśli wybrana jako 2. lub 3.):**
**Mira:** Przy tamie woda stoi po kostki. Nie wpadaj w kałuże pod uszkodzonymi kablami, kiedy puszczają łuk.
**Bajt:** Sygnatura przy wyłączniku jest mocno czerwona — mają tam żołnierza z podkręconym Akordem. Trzymaj dystans przed falą uderzeniową.

**Ostatnie dwie minuty okna czasowego (ostrzeżenie):**
**Mira:** Dwie minuty! Jeśli nie zrzucisz ostatniej szyny przed automatycznym przełączeniem, cała robota pójdzie w cholerę i trzeba będzie wracać do punktu wyjścia.

**Wyłączenie trzeciej podstacji — zaciemnienie:**
**Bajt:** Ostatnia poszła! Osłony zewnętrzne Masztu zeszły do zera... Czekaj. Kurwa, cała magistrala dolna leci w dół!
**Mira:** Mówiłam, że polecą bezpieczniki na głównym rozdzielniku. Całe Huty i Niecka są czarne.
**Wolan:** Zgasiło połowę miasta. Przychodnie mają zapas na sześć godzin. Zdążcie.
**Mira:** Zbieraj się do szybu, Kurier. Zostały ci tylko światła na bateriach i własne ostrze, żeby wrócić na Kamienną.

### Po misji (kryjówka)

**Bajt:** Osłony radiowe wokół dolnych pięter Masztu zniknęły z radaru. Ale spójrz na wykres zużycia — oni już przekierowują energię ze szczytu.
**Mira:** Z czego? Z własnych generatorów na Koronie?
**Bajt:** Tak. I nie tylko tam. Na Bulwarze właśnie włączył się lokalny przekaźnik na zasilaniu awaryjnym Masztu. Ktoś próbuje robić test Chóru w środku zaciemnienia.
**Szron:** Po co robić test w ciemnym sektorze, kiedy zegar pełnego startu ma jeszcze dwa dni?
**Wolan:** Żeby sprawdzić, czy po odcięciu podstacji nadal utrzymają synchronizację na mniejszym zasięgu. Albo żeby wysłać sygnał, którego nikt nie zagłuszy szumem sieci miejskiej.
**Mira:** Kto jest w zasięgu tego przekaźnika na Bulwarze?
**Bajt:** Promień około kilometra wokół głównego targu. W tym wszyscy z Akordem na tym poziomie... i pewnie ci, których ściągnęli z Kamiennej.
**Mira:** Tymon.
**Szron:** Nie wiemy na pewno, czy jest właśnie tam.
**Mira:** Jest na tyle świeży po naszym strojeniu przez Idę, że na pewno spróbują go przepchnąć przez pierwszą próbę. Musimy rozbić ten przekaźnik teraz, zanim rozjadą się dalej i zanim skończą się baterie w przychodniach.
**Wolan:** Zostało pięć i pół godziny. Jeśli wejdziecie na targ, nie strzelajcie na oślep w tłum — zsynchronizowani cywile mogą nawet nie uciekać.
**Szron:** Odpocznij chwilę, Kurier. Zaraz wchodzimy na Bulwar.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 100 Danych i 2 Rdzenie za ukończenie misji (plus do 55 Danych z celów opcjonalnych).
  - Odblokowanie modyfikacji zwiększającej odporność na obrażenia od wyładowań/przeciążeń albo skracającej czas interakcji technicznych.
- **Zmiany w kryjówce:**
  - Kamienna przechodzi na słabsze oświetlenie awaryjne (część lamp przygaszona, głośniejsza praca lokalnych akumulatorów); beczka pozostaje zimna.
  - Mira wraca z konsoli łączności do sprawdzania sprzętu bojowego, wciąż spięta; na tablicy misji pojawia się strefa zaciemnionego Bulwaru.
- **Co misja otwiera dalej:**
  - Zdejmuje osłony dolnych kondygnacji Masztu, umożliwiając podejście do wspinaczki w Misji 19.
  - Odblokowuje natychmiast **Misję 18 — Strojenie** (reakcja na lokalną próbę Chóru w zaciemnionym Bulwarze).

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Szablony pokojów (`alleyUnderpass`, `combatSubstation`, `combatWarehouse`, `combatPlatforms`, `combatFloodedTunnel`, `eliteCourtyard`, `combatLaserYard`, `alleyCrossing`, `restRoom`, `shopRoom`) oraz wrogowie `assaulter`, `gunner`, `shielder`, `sniper`, `drone`, `hacker`, `turret`, `executor`.
- **Nowe elementy potrzebne dla Misji 17:**
  - **Nieliniowy wybór kolejności gałęzi** na mapie sektora (trzy odnogi startujące z Warstwy 1, łączące się po ukończeniu wszystkich trzech w pokój ewakuacji).
  - **Globalny licznik okna czasowego** uruchamiany dopiero w momencie wyłączenia pierwszej podstacji (propozycja: 390 s) wraz ze skalowaniem zagrożeń środowiskowych (łuki elektryczne) na pozostałych podstacjach.
  - Dynamiczne **przełączenie oświetlenia sektora** po trzecim wyłączniku (wygaszenie świateł miejskich z pozostawieniem neonów akumulatorowych, emisji wrogów i cyanu gracza).
- **Propozycje do backlogu:**
  - Dedykowani **elitarny Akordowiec** (czerwone wersje mocy Rezonansu) oraz **elitarny Tarczownik-dowódca** przy podstacjach w Niecce i Bulwarze (zastępowalne przez `executor` + `turret` / `hacker`).
  - Opcjonalne rozłączanie kondensatorów buforowych przedłużające okno czasowe o 20 s.
