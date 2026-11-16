# Misja 18 — Strojenie

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| III | Orbis Grid | Bulwar, targ w zaciemnieniu | Zniszczenie przekaźnika + mini-boss (Tymon zsynchronizowany) | Noc (okno sześciu godzin awaryjnego zasilania przychodni) | Po Misji 17 (Przerwa w dostawie); odblokowuje Misję 19 (Pion) |

## W skrócie

W odpowiedzi na zaciemnienie dołu miasta Orbis uruchamia lokalną próbę Chóru na awaryjnym zasilaniu Masztu i obejmuje sygnałem cały Bulwar w promieniu kilometra. Cywile z Akordem stoją nieruchomo w deszczu na targu, podczas gdy żołnierze zbrojeniówki i ochrony walczą w idealnym, zgranym rytmie. Kurier przebija się do przekaźnika Chóru, pokonuje bez zabijania zsynchronizowanego Tymona i niszczy nadajnik, odzyskując brata Miry wraz z kodami do wind serwisowych Masztu.

## Tło fabularne

Kilkadziesiąt minut po wyłączeniu trzech podstacji Bulwar tonie w ciemności — działają wyłącznie neony na akumulatorach przy pojedynczych budkach i awaryjne lampy na estakadach. Orbis Grid nie przerywa jednak prac nad Chórem. Korzystając z rezerwy energetycznej Masztu oraz z ciszy radiowej wywołanej brakiem miejskiego oświetlenia, uruchamia lokalny przekaźnik na głównym targu Bulwaru.

Sygnał przejmuje wszystkich użytkowników Akordu w promieniu kilometra. Zwykli mieszkańcy, którzy wzięli implant na raty w bezpłatnych przychodniach Helixa, tracą wolę ruchu i zamierają w deszczu pod wiatami. Z kolei żołnierze pod komendą Orbis zostają spięci jedną pętlą taktyczną — reagują jednocześnie, jak jedno ciało, na ten sam impuls akustyczny i świetlny.

Wśród przywiezionych na plac akordowców jest Tymon, zabrany podczas nalotu na Kamienną. Ponieważ był już wcześniej dostrajany przez Idę, Orbis używa go jako węzła pośredniego przy przekaźniku. Gracz nie wie jeszcze, jak łatwo będzie przełamać jego synchronizację ani co Tymon zapamiętał ze szkolenia akordowców przed ucieczką do Kurogane.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Przedostać się przez zaciemniony targ Bulwaru do centralnego placu z lokalnym przekaźnikiem Chóru.
  - Pokonać strzegącego dostępu zsynchronizowanego Tymona (mini-boss; zbicie zdrowia do progu ogłuszenia zamiast zabicia) i zniszczyć przekaźnik Chóru.
  - Bezpiecznie wyprowadzić oswobodzonego Tymona do punktu zbiórki przy windzie towarowej pod estakadą.
- **Warunki porażki:**
  - Śmierć Kuriera.
  - Śmiertelne trafienie Tymona nie następuje (układ nie pozwala na zadanie śmiertelnego ciosu po spadku zdrowia do progu 10% — do strojenia), lecz celowe lub przypadkowe zaatakowanie nieruchomych cywilów obniża reputację i wywołuje ostrzeżenie radiowe (cywile nie stanowią celu i są chronieni przed ogniem gracza albo blokują ścieżkę jako żywe przeszkody, które trzeba omijać).
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Wykonanie pięciu perfekcyjnych parowań zgranych ataków w rytmie Chóru* — nagroda: +25 Danych.
  - *Zniszczenie trzech bocznych wzmacniaczy kablowych w Warstwie 5 przed wejściem na plac główny* (osłabia siłę impulsu na arenie finałowej) — nagroda: +30 Danych.

## Mapa

- **Miejsce i nastrój:** Targ na estakadzie Bulwaru w całkowitym zaciemnieniu miejskim, motyw `neonStreet` w ulewnym deszczu. Holoreklamy nad dachami są czarne; jedynym światłem otoczenia pozostają zasilane bateryjnie szyldy małych budek z makaronem i kramów z palety ADR 0006: przygaszony **bursztyn**, **ciepła biel** żarówek nad ladą, **zieleń** oznaczeń zejść ewakuacyjnych oraz pojedyncze witryny w **fiolecie** i **błękicie królewskim**. Nieruchomi cywile stoją w strugach deszczu z ledwo widoczną, pulsującą **czerwienią** przy skroniach; wrogie oddziały i przekaźnik Chóru jarzą się mocną **czerwienią** na każdym takcie sygnału. Ostrze Kuriera daje **cyanowy** ślad w deszczu, a Rezonans **magentowy**.
- **Struktura sektora:** Run liczy **7 warstw** na mapie wyboru ścieżki, z trzema stałymi pokojami fabularnymi w warstwach 3, 5 i 7:
  - **Warstwa 1 (Wejście):** `alleyUnderpass` — wyjście schodami technicznymi z Niecki na ciemną krawędź estakady Bulwaru.
  - **Warstwa 2 (Obrzeża targu):** wybór między pustą alejką za straganami (`alleyBackstreet`) a otwartą jeszcze budką na akumulatorze (`noodleShop` / `shopRoom` — sprzedawca bez Akordu chowa się za blachą i handluje zapasami).
  - **Warstwa 3 (Pierwszy krąg synchronizacji — stały pokój fabularny):** wariant `alleyMarket`. Dziesiątki nieruchomych cywilów stoją między straganami, nie reagując na walkę. Pierwszy oddział zsynchronizowanych żołnierzy atakuje w równym takcie co 2,4 s (propozycja do strojenia).
  - **Warstwa 4 (Pasaże pod dachem):** wybór między zalanym przejściem pod wiatami (`combatCorridor` / `combatRing`) a bezpiecznym zapleczem kuchni (`restRoom` — generator na ropę, moment na oddech i przestrojenie modułów).
  - **Warstwa 5 (Węzeł wzmacniający — stały pokój fabularny):** wariant `plazaHolo`. Ekrany placu są czarne, a po mokrym betonie ciągną się grube czerwone kable do trzech wzmacniaczy bocznych. Drugi zsynchronizowany oddział wspierany przez drony i hakera.
  - **Warstwa 6 (Przedpole placu głównego):** wybór między górnymi pomostami nad targiem (`combatPlatforms`) a punktem zaopatrzenia i odpoczynku (`restRoom` albo `shopRoom`).
  - **Warstwa 7 (Plac z przekaźnikiem Chóru — stały pokój fabularny):** wariant `eliteCourtyard` / duży `alleyMarket`. Pośrodku stoi rozstawiony przekaźnik polowy Orbis połączony wiązką kabli z ciężkim transformatorem na wozie. Przed przekaźnikiem stoi **Tymon zsynchronizowany** oraz wspierający go akordowcy.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Cywile z Akordem (element środowiskowy):** stoją nieruchomo pod zadaszeniami i na przejściach; po zniszczeniu przekaźnika osuwają się na kolana i odzyskują przytomność.
  - **Boczne wzmacniacze kablowe (x3, Warstwa 5):** można je przeciąć ostrzem plazmowym albo rozbić Pchnięciem (ok. 1 s interakcji lub 1–2 uderzenia).
  - **Przekaźnik Chóru (Warstwa 7):** trzyczęściowy maszt nadawczy na podwoziu. Gdy Tymon zostaje ogłuszony przy progu zdrowia, osłona przekaźnika opada i gracz ma okno ok. 12 s na rozbicie rdzenia nadajnika (albo rozbicie go po kolei w przerwach między falami taktu).
- **Wrogowie:**
  - Frakcja: **Orbis Grid** + oddziały zsynchronizowanych akordowców.
  - **Zsynchronizowani żołnierze (modyfikator taktu na istniejących archetypach `assaulter`, `gunner`, `shielder`):** wszyscy żołnierze w danym pokoju otrzymują wspólną zapowiedź ataku na jednym wyraźnym pulsie dźwiękowo-wizualnym (czerwony błysk i krótki sygnał metronomu Chóru). Ułatwia to parowanie ostrzem kilku ciosów albo pocisków w jednym rytmie, ale spóźnienie oznacza przyjęcie zgranej salwy naraz.
  - Wsparcie niesynchronizowane: **Dron (`drone`)** oraz **Dron-haker (`hacker`)**.
  - **Mini-boss (Warstwa 7): Tymon zsynchronizowany** (propozycja do backlogu: wariant akordowca z czerwonym Pchnięciem, Błyskawicą i krótkim dashem w rytmie Chóru; wariant zastępczy: `executor` z modyfikatorem rytmicznych zapowiedzi i czerwoną falą uderzeniową). Tymon nie mówi w trakcie walki — porusza się spokojnie, bez agresywnych krzyków, zawsze w rytmie nadajnika.
- **Zagrożenia środowiskowe:**
  - **Puls Chóru:** co kilka taktów przekaźnik wysyła słaby impuls zakłócający interfejs (delikatne migotanie krawędzi ekranu, bez wyłączania mocy Kuriera — pełne zagłuszenie następuje dopiero w Misji 20).
  - Nieruchomi cywile zawężają alejki targowe, zmuszając do walki z czystą kontrolą kierunku rzutów i Pchnięć Rezonansu.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Krótka narada przy awaryjnych lampach. Wolan tłumaczy, czym jest zgranie w jednym takcie — Chór wyrównuje czas reakcji akordowców kosztem ich własnej woli. Mira nalega, by nie zabijać Tymona; Szron wyznacza warunek: jeśli Tymon stanie na drodze, trzeba go unieruchomić i rozbić przekaźnik.
2. **Wejście na ciemny targ (Warstwy 1–2):** Kurier wychodzi na estakadę w gęsty deszcz. Panuje dziwna cisza — słychać tylko krople na blachach i stłumiony, jednostajny ton niskiej częstotliwości z głębi placu. Na skraju targu widać pierwszych ludzi stojących bez ruchu z oczami otwartymi w ciemność.
3. **Pierwsze starcie w rytmie (Warstwa 3):** Kurier wchodzi między budki. Oddział zsynchronizowanych żołnierzy otwiera ogień i naciera w tym samym ułamku sekundy. Wyłapanie rytmu pozwala odbić salwę ostrzem plazmowym jednym płynnym ruchem.
4. **Węzeł wzmacniający (Warstwy 4–5):** Na małym placu z czarnymi ekranami Wolan namierza kable zasilające z awaryjnej linii Masztu. Rozbicie bocznych wzmacniaczy osłabia pole przed głównym placem.
5. **Tymon i przekaźnik Chóru (Warstwy 6–7):** Na głównym placu targowym stoi Tymon. Nie szarpie się jak w Misji 9, tylko czeka pośrodku kałuż w rytmie pulsu Chóru. Walka wymaga czytania zgranych ataków jego i eskorty. Gdy zdrowie Tymona spada do progu bezpieczeństwa, klęka ogłuszony pętlą zwrotną. Kurier rozbija przekaźnik ostrzem plazmowym.
6. **Przerwanie synchronizacji (Warstwa 7):** Czerwone światła przy skroniach cywilów gasną; ludzie na targu kaszlą, upadają na mokry bruk lub rozglądają się zdezorientowani. Tymon łapie oddech i wypowiada cicho: „Słyszałem ich wszystkich naraz. To było… spokojne.” Kurier odprowadza go do wozu ewakuacyjnego Miry na skraju estakady.
7. **Powrót na Kamienną (`hideout`):** Tymon siada z Mirą w wagonie-warsztacie. Przekazuje Iskrze kody do wind serwisowych Masztu, których uczono akordowców na szkoleniach awaryjnych Orbis — jedyną drogę w górę bez przebijania się przez zamknięte szyby od zewnątrz.

## Dialogi

### Odprawa (kryjówka)

**Bajt:** Przekaźnik stoi na głównym placu targowym Bulwaru. Ciągnie prąd prosto ze szczytu Masztu, jakby reszta dzielnicy w ogóle ich nie obchodziła.
**Wolan:** Bo nie obchodzi. Testują wąską wiązkę Chóru. Z moich odczytów wynika, że objęli każdego użytkownika Akordu w promieniu kilometra.
**Szron:** Co to znaczy w praktyce, kiedy wejdzie tam Kurier?
**Wolan:** Dwie rzeczy. Zwykli mieszkańcy, którzy mają tani Akord z przychodni, prawdopodobnie staną bez ruchu — sieć wysyła sygnał podtrzymania bez rozkazów. Za to uzbrojone oddziały dostaną wspólny takt motoryczny.
**Mira:** Czyli będą uderzać jednocześnie?
**Wolan:** Dokładnie w tej samej dziesiątej sekundy. Zero wahania, zero własnej inicjatywy. Ale to działa w dwie strony — kto wyłapie rytm sygnału, wyłapie wszystkie ataki naraz.
**Mira:** Tymon tam jest.
**Bajt:** Na skanie z drona nad placem mignęła jego sygnatura z Akordu. Stoi przy samym wozie przekaźnika.
**Mira:** Kurier, nie wolno go zabić. Zbij osłonę, ogłusz tak jak na placu z hologramami i rozwal tę skrzynkę, która nim steruje.
**Szron:** Pamiętaj o cywilach na targu. Nie rzucaj w tłum i nie puszczaj fali w ślepe zaułki, dopóki nie widzisz, kto stoi za rogiem.
**Wolan:** Przychodnie mają już niecałe pięć godzin baterii. Nie zatrzymuj się po drodze dłużej, niż trzeba.
**Szron:** Wchodzisz schodami z Niecki. Mira i ja mamy nasłuch, Bajt pilnuje częstotliwości. Ruszaj.

### W trakcie misji (radio)

**Wejście na zaciemniony Bulwar (Warstwa 1):**
**Bajt:** Sygnał nośny wchodzi bardzo czysto. Słyszysz ten niski brzęk w słuchawce? To nie zakłócenia — to metronom Chóru.
**Mira:** Cały Bulwar jest ciemny jak w dupie. Zostały tylko baterie przy budkach z jedzeniem. Uważaj na ludzi pod wiatami.

**Pierwszy krąg synchronizacji — nieruchomi cywile i zgrany oddział (Warstwa 3):**
**Wolan:** Widzę z odczytu kilkanaście sygnatur w bezruchu. To cywile w strefie postoju — nie atakują i nie uciekną przed ostrzałem.
**Szron:** Oddział przed tobą właśnie się zsynchronizował. Słuchaj impulsu przed salwą: wszystkie lufy i ostrza schodzą w jednym takcie. Wykorzystaj to do parowania.

**Opcjonalnie — po serii udanych parowań w rytmie:**
**Bajt:** Nieźle! Ich własny sygnał podaje ci tempo na tacy. Kiedy zdejmujesz rytm, ich osłona sypie się cała naraz.

**Węzeł wzmacniający (Warstwa 5):**
**Wolan:** Na tym małym placu idzie trójfazowy rozgałęźnik do głównego przekaźnika. Jak zetniesz te trzy skrzynki po bokach, osłabisz pole na końcu targu.
**Mira:** Zrób to po drodze, jeśli starczy osłon. Na głównym placu każda sekunda bez zakłóceń się przyda.

**Wejście na plac główny — spotkanie z Tymonem (Warstwa 7):**
**Bajt:** Przekaźnik stoi pod zadaszeniem wozu transmisyjnego. I... kurwa, tak, to Tymon. Jest sam przed maszyną, za nim reszta ochrony.
**Mira:** Tymon? Słyszysz nas?
**Szron:** Nie słyszy. Jest podpięty bezpośrednio pod węzeł. Kurier, nie próbuj z nim rozmawiać — zbij mu gardę i ogłusz, zanim wejdą posiłki z boków.
**Wolan:** Uwaga na jego Akord — w trybie Chóru kopiuje ruchy znacznie szybciej niż na pokazie dla inwestorów. Czytaj błysk przekaźnika, on wyprzedza jego ciosy o pół taktu.

**Ogłuszenie Tymona i odsłonięcie przekaźnika:**
**Mira:** Teraz! Osunął się, pętla go trzyma na kolanach. Rozwal ten przekaźnik, zanim system zresetuje synchronizację!

**Zniszczenie przekaźnika Chóru (Warstwa 7):**
**Bajt:** Nośna spadła do zera! Wszystkie czerwone sygnatury wokół targu właśnie zgasły.
**Wolan:** Większość cywili wraca do siebie. Kilku starszych ludzi już nie wstanie, ich serca nie wytrzymały pętli. Zostaw ich medykom z budek i podejdź do Tymona, sprawdź czy oddycha.
**Tymon:** *(cicho, z trudem łapiąc oddech, na otwartym kanale z nadajnika Kuriera)* Co... gdzie jesteśmy? Co się, kurwa, stało z prądem na Bulwarze?
**Mira:** Tymon. Trzymaj się pionu, jedziemy na dół.
**Tymon:** Słyszałem ich wszystkich naraz. To było… spokojne. Pierwszy raz w głowie nie było żadnego szumu, tylko jeden takt.
**Szron:** Przekaźnik padł. Zabierz go w stronę wschodniej rampy, Kurier. Zanim Orbis przyśle nowy oddział z góry.

### Po misji (kryjówka)

**Mira:** *(w wagonie-warsztacie, podając kubek z wodą)* Pij powoli. Ręce przestaną się trząść za dziesięć minut.
**Tymon:** Nie trzęsą się z zimna. Zastanawiam się tylko, co im jest w tych przychodniach, kiedy światło zgaśnie do końca.
**Wolan:** Zostały jeszcze cztery godziny zapasu, zanim wyłączą awaryjne generatory. Musimy wejść na Maszt przed świtem, żeby nie trzymać dołu miasta bez sieci przez kolejny dzień.
**Szron:** Potrzebujemy wejścia do środka Masztu od fundamentów w Hutach. Osłony zewnętrzne padły, ale wszystkie główne bramy i szyby towarowe mają osobne szyfrowanie.
**Tymon:** Ja je mam.
**Bajt:** Że co, kurwa? Przecież zwinęli cię prosto z magazynu, nie pracowałeś przy sieci Orbis.
**Tymon:** Kiedy byłem w oddziale Kurogane przed tamtym pokazem, przez dwa tygodnie wozili nas, kurwa, na nocne ćwiczenia do szybu serwisowego Masztu. Orbis testował na nas przemieszczanie się w pionie na wypadek awarii głównych wind.
**Mira:** I pamiętasz te kody?
**Tymon:** Kody zmiany szybów i hasło awaryjne pierwszego poziomu mam w pamięci roboczej implantu. Zanim się rozstroi albo zgaśnie, lepiej spisz to na papier, Bajt.
**Bajt:** Już spisuję. Z tymi kodami możemy jechać kolejnymi windami od samych Hut aż pod poziom Korony, bez przebijania grodzi pancernych.
**Szron:** Dobra robota, Kurier. Tymon zostaje tutaj z Mirą, a Nadia sprawdzi z pamięci dawne czasy mijanek wind z lat kurierskich. Za godzinę ruszamy na Maszt.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 110 Danych oraz 2 Rdzenie za ukończenie misji (plus do 55 Danych z celów opcjonalnych).
  - Odblokowanie modyfikacji nagradzającej parowanie w oknie rytmicznym (krótki zastrzyk energii Rezonansu albo wydłużenie okna Skupienia po czystym parowaniu).
- **Zmiany w kryjówce:**
  - **Tymon wraca na Kamienną** — nie siedzi już w zamkniętym magazynie pod antresolą, tylko razem z Mirą w wagonie-warsztacie.
  - Rozmowy w kryjówce dotyczą dziwnego spokoju w Chórze oraz pośpiechu przed wyczerpaniem akumulatorów w przychodniach.
- **Co misja otwiera dalej:**
  - Odblokowuje **Misję 19 — Pion** (wspinaczka Masztem od Hut aż do Korony z użyciem kodów Tymona i harmonogramu Nadii).
  - Daje pełne dane dostępowe potrzebne do wejścia w główny trzon wieży Orbis Grid.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Szablony pokojów (`alleyUnderpass`, `alleyBackstreet`, `alleyMarket`, `combatCorridor`, `combatRing`, `plazaHolo`, `combatPlatforms`, `eliteCourtyard`, `noodleShop`, `restRoom`, `shopRoom`) w motywie `neonStreet` w trybie zaciemnionym.
  - Archetypy `assaulter`, `gunner`, `shielder`, `drone`, `hacker`.
- **Nowe elementy potrzebne dla Misji 18:**
  - **Modyfikator synchronizacji taktu (Chór):** wspólny zegar pokoju wyzwalający zapowiedź i wykonanie ataków wszystkich zsynchronizowanych jednostek na jednym pulsie (z czytelnym sygnałem wizualnym/dźwiękowym wspierającym parowanie).
  - **Nieruchomi cywile z Akordem** jako nieagresywne obiekty terenowe z czerwoną diodą przy skroni (chronieni przed auto-namierzaniem gracza, reagujący obudzeniem po zniszczeniu przekaźnika).
  - **Obiekt przekaźnika Chóru** w Warstwie 7 powiązany z progiem ogłuszenia mini-bossa (nie można zabić Tymona; po zbiciu do 10% HP odsłania rdzeń przekaźnika do zniszczenia).
- **Propozycje do backlogu:**
  - Dedykowany mini-boss **Tymon zsynchronizowany** jako ulepszony wariant akordowca (czerwone wersje mocy Rezonansu zgrane z metronomem Chóru; w pierwszej wersji zastępowalny przez `executor` z modyfikatorem taktu).
  - Opcjonalne niszczenie bocznych wzmacniaczy kablowych w Warstwie 5 wpływające na częstotliwość pulsu w Warstwie 7.
