# Misja 01 — Maszty

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| I | Kurogane Arms | Niecka, uliczki pod estakadami | Sabotaż (trzy obiekty) | Noc przed świtem (propozycja: brak twardego limitu albo 12–15 min do strojenia) | Po prologu; odblokowuje Misję 02 (Punkt kontrolny) |

## W skrócie

Tej nocy po incydencie na rampie Kurogane Arms stawia w Niecce trzy prowizoryczne maszty nasłuchowe, żeby przed świtem zamknąć triangulację na Kurierze. Kurier wchodzi w uliczki pod estakadami, wysadza przekaźniki ładunkami od Miry i odpiera ściągane wybuchami patrole. W rozbitej obudowie drugiego masztu znajduje element z oznaczeniem Helixa Dynamics — pierwszy ślad, że obławą nie interesuje się wyłącznie zbrojeniówka.

## Tło fabularne

W prologu implant ruchowy Kuriera wpada w Rezonans na rampie towarowej w Hutach i zatrzymuje spadający kontener. Kwadrans później sygnaturę łapią maszty nasłuchowe Kurogane. Szron wyciąga Kuriera na stację Kamienna szybciej niż patrol i testuje jego zdolności na poligonie.

Od tej nocy Kurier figuruje na liście poszukiwanych, a Kurogane zagęszcza sieć: w najniższym sektorze miasta stawia trzy przenośne maszty podpięte pod miejskie skrzynki zasilania. Jeśli przed szóstą rano zakończą strojenie, wykryją każdy skok Rezonansu w Niecce i odetną kryjówkę od reszty dzielnicy. Nawigację przez radio bierze na siebie Stary Tomasz, który zna układ zaułków pod estakadami sprzed wielkiej powodzi.

Gracz nie wie jeszcze, dlaczego zbrojeniówka inwestuje w wyłapywanie Rezonantów ani jaki interes ma w tym laboratorium Helixa na Tarasie. Nie wie również, że Tomasz od dziewięciu lat przekazuje Oskarowi Brandtowi raporty o Rezonantach działających poza Iskrą — w tym zgłoszenie z nocy prologu — i że jego pewność co do nawyków patroli w Niecce nie wynika wyłącznie z obserwacji.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Dotrzeć do trzech masztów nasłuchowych Kurogane w sektorze Niecki, zneutralizować osłonę i podłożyć przy każdym ładunek od Miry.
  - Zabezpieczyć nienaruszony moduł nasłuchu wyrzucony z obudowy drugiego masztu.
  - Po zniszczeniu trzeciego masztu przetrwać lub zgubić falę posiłków i opuścić sektor przez właz serwisowy prowadzący do kanałów Kamiennej.
- **Warunki porażki:**
  - Śmierć Kuriera (standardowy powrót do kryjówki z zachowaniem stałego postępu i powtórka misji).
  - Opcjonalny warunek do strojenia na wyższym progu trudności: przekroczenie okna czasowego przed porannym dostrojeniem o 06:00.
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Zgranie logów konserwacyjnych przy drugim maszcie* (krótka interakcja przy skrzynce kablowej przed odpaleniem ładunku) — nagroda: +15 Danych oraz notatka o częstotliwości dostaw z Tarasu (propozycja do strojenia).
  - *Czyste wyjście po trzeciej detonacji* (wejście do włazu ewakuacyjnego w ciągu 35 s od wybuchu trzeciego masztu — propozycja do strojenia) — nagroda: +20 Danych.

## Mapa

- **Miejsce i nastrój:** Zaułki Niecki poniżej linii powodziowej, motyw `neonStreet` (noc, drobny deszcz, mokry asfalt, zacieki na betonowych podporach estakad). Otoczenie ciemne i chłodne; nieliczne neony mieszczą się w palecie ADR 0006: przybrudzone szyldy w **ciepłej bieli** i **bursztynie** nad wejściami do warsztatów, tabliczki wyjść technicznych w **zieleni**, pojedyncze witryny zamkniętych lokali w **fiolecie** i **błękicie królewskim**. Na tym tle wyraźnie odcinają się **czerwone** diody masztów, wieżyczek i pancerzy Kurogane, **cyanowe** ostrze plazmowe gracza oraz **magentowe** wyładowania Rezonansu.
- **Struktura sektora:** Run w sektorze liczy **7 warstw** na mapie wyboru ścieżki (propozycja do strojenia). Trzy pokoje fabularne mają stałą, obowiązkową pozycję na ścieżce; między nimi gracz wybiera wariant przejścia:
  - **Warstwa 1 (Wejście):** punkt startowy oparty na `alleyUnderpass` (zejście ze śluzy technicznej pod podporę estakady).
  - **Warstwa 2 (Podejście):** rozwidlenie na walkę (`alleyBackstreet` lub `combatCorridor`) albo boczny zaułek z punktem zaopatrzenia (`noodleShop` lub `shopRoom` — nocny punkt wymiany w bramie).
  - **Warstwa 3 (Maszt 1 — stały pokój fabularny):** obowiązkowy węzeł dla wszystkich ścieżek, wariant `alleyCrossing`. Na skrzyżowaniu wąskich przejść stoi pierwszy maszt z osłoną.
  - **Warstwa 4 (Środek sektora):** wybór między walką w zalanym przejściu (`combatFloodedTunnel` lub `combatYard`) a pokojem odpoczynku (`restRoom` — sucha kotłownia pod filarem).
  - **Warstwa 5 (Maszt 2 — stały pokój fabularny):** obowiązkowy węzeł na bazie `alleyMarket`. Zamknięty na noc placyk targowy między metalowymi roletami; z tego masztu wypada biały moduł Helixa.
  - **Warstwa 6 (Przedostatnia):** wybór między trudniejszą walką o większy łup (`combatPillars` lub `combatPlatforms`) a spokojniejszym przejściem z regeneracją lub handlem (`restRoom` albo `shopRoom`).
  - **Warstwa 7 (Maszt 3 i ewakuacja — stały pokój fabularny):** finałowy węzeł misji na bazie `combatYard` lub większego wariantu `alleyCrossing`, z trzecim masztem, podwójną osłoną i włazem ewakuacyjnym przy wschodnim murze.
  - W Misji 01 nie występuje pokój bossa ani wydzielony pokój `elita` (pierwsze spotkanie z elitą zaplanowano na Misję 02).
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Maszty nasłuchowe (x3):** trzymetrowe kratownice z logo Kurogane, czerwoną lampą na szczycie i skrzynką zasilania u podstawy. Podłożenie ładunku trwa ok. 2,5 s, po czym następuje 6 s odliczania do wybuchu (liczby do strojenia).
  - **Moduł nasłuchu Helixa (przy Maszcie 2):** biała kaseta z tworzywa wyrzucona z wnętrza obudowy przez detonację; wymaga podniesienia przed opuszczeniem placu.
  - **Skrzynka serwisowa (opcjonalna, Maszt 2):** terminal konserwacyjny spięty z miejskim zasilaniem.
  - **Właz kanału zrzutowego (Maszt 3):** odblokowuje się po zniszczeniu trzeciego masztu; otwarcie korbą trwa ok. 2 s (propozycja do strojenia).
- **Wrogowie:**
  - Frakcja: **Kurogane Arms** (czerwone oznaczenia, ciężki sprzęt przemysłowy).
  - Archetypy w Misji 01:
    - **Szturmowiec (`assaulter`):** patroluje podejścia i tworzy pierwszą falę posiłków po wybuchu; skraca dystans, zmusza do użycia ostrza plazmowego lub mocy Rezonansu.
    - **Strzelec (`gunner`):** pilnuje skrzyżowań i kładek zza osłon.
    - **Wieżyczka (`turret`):** stacjonarna przy każdym maszcie (1 przy Maszcie 1, 1 przy Maszcie 2, 2 krzyżujące ogień przy Maszcie 3 — propozycja do strojenia), oznaczona czerwonym promieniem celownika.
  - Archetypy `shielder`, `drone`, `sniper` oraz `executor` nie pojawiają się w tej misji — wchodzą do gry od Misji 02 i 03.
- **Zagrożenia środowiskowe:**
  - Płytka woda w niższych przejściach (szczególnie `combatFloodedTunnel`), ograniczająca widoczność w deszczu i tworząca ciasne gardła przy kontenerach.
  - Eksplozja masztu zadaje obrażenia w promieniu 4 m (propozycja do strojenia) zarówno graczowi, jak i znajdującym się w pobliżu wrogom Kurogane.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Szron omawia cel i okno czasowe przed świtem. Mira wydaje trzy ładunki i tłumaczy bezpieczny dystans. Bajt spina kanał radiowy, a Tomasz zgłasza się do prowadzenia przez zaułki.
2. **Wejście do Niecki (Warstwy 1–2):** Kurier wychodzi ze śluzy w deszcz. Tomasz wyznacza kierunek po charakterystycznej spalonej latarni. Gracz oswaja się z walką w wąskich zaułkach i może odwiedzić nocny punkt zaopatrzenia.
3. **Maszt 1 — Skrzyżowanie pod estakadą (Warstwa 3):** Pierwsza wieżyczka kryje podejście do skrzynki zasilania. Po zdjęciu osłony i podłożeniu ładunku maszt wylatuje w powietrze, a wybuch ściąga pierwszą falę posiłków z bocznych przejść. Bajt odnotowuje natychmiastowy skok mocy na pozostałych dwóch przekaźnikach.
4. **Przejście przez środek sektora (Warstwa 4):** Krótki oddech w suchej kotłowni albo walka w zalanym pasie technicznym z patrolami zaalarmowanymi pierwszym wybuchem.
5. **Maszt 2 — Zamknięty targ (Warstwa 5):** Plac pod roletami z wieżyczką na środku i strzelcami na podestach. Po detonacji i odparciu posiłków Kurier zauważa wyrzuconą z rozbitego korpusu białą kasetę. Gdy podnosi ją do torby, Bajt przechwytuje jej identyfikator serwisowy i rozpoznaje sygnaturę Helixa Dynamics.
6. **Podejście pod kanał zrzutowy (Warstwa 6):** Wybór trasy do ostatniego węzła. Tomasz ostrzega przed układem kładek przy wylocie kanału, gdzie oddziały Kurogane od lat zamykają drogę odwrotu.
7. **Maszt 3 i ewakuacja (Warstwa 7):** Najtrudniejsze starcie w misji: dwie wieżyczki ustawione na krzyż i cięższa fala posiłków po wybuchu. Po zniszczeniu trzeciego masztu sieć nasłuchowa w Niecce cichnie, a Kurier przebija się do włazu przy wschodnim murze i schodzi w głąb starych tuneli.
8. **Powrót na Kamienną (`hideout`):** Bajt rozkręca zdobyczny moduł na swoim stanowisku i stwierdza, że to przerobiony czujnik medyczny do badania implantów. Iskra zyskuje pierwszy trop, ale nie zna jeszcze celu tych pomiarów.

## Dialogi

### Odprawa (kryjówka)

**Szron:** Trzy maszty w Niecce. Stanęły dziś w nocy, wszystkie na tym samym paśmie, które złapało cię na rampie.
**Bajt:** O szóstej kończą kalibrację. Jak się zestroją, każdy skok Rezonansu w dolnym sektorze zaświeci im jak latarnia na dachu.
**Szron:** Masz na to czas do świtu. Ładunki są od Miry.
**Mira:** Trzy sztuki, z krótkim zapalnikiem. Przykładaj do skrzynki zasilania u podstawy, nie do samej kratownicy.
**Mira:** I nie stój w promieniu czterech metrów, kiedy tyka. Zapasowych kurierów tu nie trzymamy.
**Bajt:** Mówi to osoba, która spawała te zapalniki z zegarków z bazaru.
**Mira:** Zegarki działają. W przeciwieństwie do twojego skanera częstotliwości w zeszłym tygodniu.
**Szron:** Dosyć. Przy każdym maszcie stoi co najmniej jedna wieżyczka, a wybuch ściągnie patrole z sąsiednich ulic. Nie wdawaj się w długą wymianę ognia, jeśli nie musisz.
**Tomasz:** Ja poprowadzę przez radio. Znam pod estakadą każdy suchy zaułek i każdą ślepą bramę.
**Szron:** Na pewno? Ostatnio chodziłeś tamtędy, kiedy jeszcze działały pompy.
**Tomasz:** Beton się nie rusza, Szron. A patrole chodzą zawsze tam, gdzie wygodnie im nie zamoczyć butów.
**Bajt:** Łączność ustawiona na krótki kanał. Wchodzisz śluzą pod trzecim filarem, kryptonim w eterze: Kurier.
**Tomasz:** Weź ze sobą łyk czegoś ciepłego, zanim zejdziesz w ten deszcz. Tam na dole wiatr ciągnie od rzeki.
**Szron:** Ruszaj. Po trzecim maszcie schodzisz starym kanałem zrzutowym prosto na Kamienną.

### W trakcie misji (radio)

**Wejście do sektora:**
**Tomasz:** Słychać mnie dobrze? Jesteś pod trzecią podporą, za plecami masz zejście do kanału.
**Tomasz:** Idź wzdłuż muru na wschód. Tam jeszcze wczoraj wisiała spalona latarnia z bursztynowym kloszem, za nią zaczynają się pierwsze alejki.
**Bajt:** Sygnał z masztów wchodzi czysto. Pierwszy stoi tuż za skrzyżowaniem, sto metrów dalej.

**Maszt 1 (podejście):**
**Szron:** Wieżyczka na wprost wejścia. Najpierw ją zdejmij albo odetnij jej linię strzału.
**Mira:** Pamiętaj, cztery metry. Jak zgaśnie czerwona dioda na górze, nie wracaj, kurwa, po nic.

**Maszt 1 (detonacja):**
**Bajt:** Pierwszy ucichł. Reszta sieci podbiła moc o trzydzieści procent — wiedzą już, że to nie awaria bezpieczników.

**Posiłki (po wybuchu pierwszego masztu):**
**Szron:** Dwa oddziały z bocznej ulicy. Nie zatrzymuj się na placu, wykorzystaj osłony.
**Tomasz:** W prawo, w przejście za kontenerem na gruz. Zawsze zostawiają tam pół metra prześwitu, żeby śmieciarka mogła zawrócić.

**Maszt 2 (podejście):**
**Bajt:** Drugi nadajnik stoi na starym targu, za opuszczonymi roletami. Ktoś podłączył go na krótko do skrzynki miejskiej.
**Tomasz:** Z tego placyku wyjście prowadzi tylko na zachód albo przez kramy. Wybierz drogę, zanim zamkną wejścia.

**Maszt 2 (detonacja i odkrycie modułu Helixa):**
**Mira:** Czekaj — coś w tym pieprzonym złomie jeszcze nie zgasło. Pod pokrywą leży nienaruszony moduł. Zgarnij go, przyda się w warsztacie.
**Bajt:** Chwila... zanim schowasz, wyłapałem jego identyfikator serwisowy. To nie jest blok Kurogane. To ma sygnaturę Helixa Dynamics.
**Szron:** Zostaw zgadywanie na później. Pakuj to do torby i ruszaj pod trzeci maszt, patrole już idą po śladzie.

**Maszt 3 (podejście):**
**Tomasz:** Przy kanale zrzutowym uważaj na kładki po bokach. Od lat tak zamykają wylot, kiedy kogoś szukają na dole.
**Szron:** Dwie wieżyczki kryją plac na krzyż. Jeśli wejdziesz w środek przed czasem, posiłki przygniotą cię przy ścianie.

**Maszt 3 (detonacja):**
**Bajt:** Trzeci padł, kurwa mać! Pasma w Niecce są puste, przed świtem niczego już nie zestroją.

**Wyjście:**
**Szron:** Z placu rusza cięższa grupa. Właz do tunelu jest przy wschodnim murze, za transformatorem.
**Mira:** Otwieraj i schodź. Jak przekręcisz zawór od środka, nie przejdą bez palników.
**Bajt:** Jeszcze kilka metrów, Kurier. Zamykam za tobą kanał nasłuchowy.

### Po misji (kryjówka)

**Bajt:** Dobra, mam to. Zerwałem obudowę Kurogane, a w środku siedzi pełna elektronika Helixa Dynamics.
**Szron:** Do łączności?
**Bajt:** Właśnie nie. Znam ten układ ze starych specyfikacji z Bulwaru — to przerobiony czujnik medyczny do badania implantów ruchowych. Wyciągnęli z niego głowicę i podpięli pod wzmacniacz radiowy.
**Mira:** Po co, do cholery, zbrojeniówce skaner medyczny w zaułku pod estakadą?
**Bajt:** Nie mam pojęcia. Szukał nie tylko samego wyładowania, ale konkretnej sygnatury w korze ruchowej. Jakby ktoś sprawdzał, kto z ulicy nosi w sobie coś więcej niż zwykły drut na raty.
**Szron:** Czyli to nie był przypadek z tą rampą w Hutach. A w Niecce połowa kurierów ma ten sam tani implant co ty.
**Mira:** Zostało tam jeszcze coś w jednym kawałku, czy wszystko poszło z dymem?
**Bajt:** Ten jeden wystarczy. Zaraz przepuszczę numer partii przez stare rejestry dostaw, może wyjdzie, skąd je ciągną.
**Tomasz:** Zostaw to do jutra, Bajt. Masz podkrążone oczy jak po nocnej zmianie.
**Tomasz:** Usiądź przy beczce, Kurier. Herbata jeszcze ciepła.
**Szron:** Rano sprawdzimy, kogo jeszcze zwinęli tej nocy, zanim maszty zgasły. Idź odpocząć.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 60 Danych za ukończenie misji (oraz do 35 Danych z celów opcjonalnych); Kredyty z pokojów działają jak w zwykłym runie.
  - 1 losowy moduł lub schemat ulepszenia z początkowej puli warsztatu Miry.
- **Zmiany w kryjówce:**
  - Brak zmian przestrzennych na stacji Kamienna po Misji 01 (pierwsze stałe zmiany zaczynają się po Misji 02).
  - Na biurku Bajta leży rozebrana biała obudowa modułu Helixa; postacie w kryjówce zyskują komentarze o skanerach medycznych i nocnej obławie w Niecce.
- **Co misja otwiera dalej:**
  - Odblokowuje **Misję 02 — Punkt kontrolny** (po utracie masztów Kurogane zaczyna bezpośrednią obławę na kurierów z implantami ruchowymi w Niecce).
  - Stawia główne pytanie Aktu I: co łączy ochronę Kurogane z aparaturą badawczą Helixa Dynamics.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Pełna pętla runu w sektorze `kurogane` z mapą wyboru ścieżki, pokojami walki, sklepu i odpoczynku oraz motywami `neonStreet` (misja) i `hideout` (kryjówka).
  - Szablony pokojów (`alleyUnderpass`, `alleyBackstreet`, `alleyCrossing`, `alleyMarket`, `combatCorridor`, `combatFloodedTunnel`, `combatYard`, `combatPillars`, `combatPlatforms`, `noodleShop`, `restRoom`, `shopRoom`) i wszyscy wrogowie Misji 01 (`assaulter`, `gunner`, `turret`).
- **Nowe elementy potrzebne dla Misji 01:**
  - Stałe węzły fabularne w warstwach 3, 5 i 7 generatora mapy sektora.
  - Obiekt interaktywny **maszt nasłuchowy**: podkładanie ładunku (ok. 2,5 s przytrzymania), odliczanie do detonacji (6 s), obrażenia obszarowe od wybuchu i wyzwalacz fali posiłków po zniszczeniu.
  - Obiekt **moduł Helixa** pojawiający się po zniszczeniu Masztu 2 oraz wyjście ewakuacyjne (właz) odblokowywane po zniszczeniu Masztu 3.
  - Wyzwalacze komunikatów radiowych powiązane ze stanem misji (wejście, maszt 1–3, posiłki, podniesienie modułu, wyjście) i sceny odpraw w `hideout`.
- **Propozycje do backlogu (poza minimum F5):**
  - Opcjonalny zegar porannego dostrojenia jako modyfikator trudności.
  - Pobieranie logów ze skrzynki serwisowej przy Maszcie 2 jako mikro-cel dodatkowy.
