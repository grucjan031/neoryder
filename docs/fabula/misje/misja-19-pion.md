# Misja 19 — Pion

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| III | Orbis Grid | Maszt, od fundamentów w Hutach do Korony | Wspinaczka — obrona ruchomej platformy i przeprawa w burzy | Noc burzowa (czas przejazdów wyznaczony rytmem wind; brak twardego zegara misji) | Po Misji 18 (Strojenie); odblokowuje Misję 20 (Cisza) |

## W skrócie

Z kodami Tymona i dawnymi czasami przejazdów od Nadii Kurier wchodzi do podstawy Masztu w Hutach, żeby wspiąć się pionowym kręgosłupem miasta aż na poziom Korony. Przeprawa składa się z trzech jazd otwartymi windami serwisowymi pod ogniem dronów, desantów i snajperów z sąsiednich wież oraz przejść po zewnętrznych kratownicach w nocnej burzy. Gdy w ostatnim szybie Orbis odcina liny i próbuje zrzucić platformę w przepaść, Ida z dołu chwyta hamulec windy Rezonansem, utrzymując ją w magentowej poświacie aż do progu Korony.

## Tło fabularne

Po rozbiciu przekaźnika na Bulwarze zostało niewiele czasu, zanim w przychodniach wyczerpią się akumulatory, a Orbis przestawi zegar Chóru. Kody przekazane przez Tymona otwierają wewnętrzne szyby serwisowe Masztu, na których zbrojeniówka ćwiczyła nocne przerzuty przed wprowadzeniem Akordu. Same kody nie wystarczą jednak w ruchu: windy mają automatyczne blokady mijanek i okna zrzutu balastu, które Nadia pamięta z czasów, gdy kurierzy jeździli pionowymi szybami z pilnymi przesyłkami.

Ponieważ osłony dolnych pięter Masztu zgasły w Misji 17, Orbis koncentruje obronę na samej trasie wspinaczki — w szybach krążą drony, a sąsiednie wieże Korony i Tarasu dają snajperom czyste pole strzału na każdą oświetloną platformę.

Ida schodzi razem z Kurierem w okolice dolnej hali fundamentów w Hutach. Choć jej Rezonans wciąż bywa nieopanowany, upiera się, że z dolnego pomostu sięgnie wyżej niż ktokolwiek inny w Iskrze. Gracz nie wie jeszcze, jak ogromny ciężar przyjdzie jej utrzymać w ostatnim szybie ani jak blisko szczytu znajduje się bezpośrednia śluza pod węzeł Chóru.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Otwierać kolejnymi kodami Tymona trzy sekcje wind serwisowych Masztu, zaczynając od fundamentów w Hutach.
  - Podczas każdej jazdy bronić ruchomej platformy przed dronami, hakerami, snajperami z sąsiednich wież oraz oddziałami wskakującymi z pomostów mijankowych.
  - Przejść w burzy po zewnętrznych pomostach łączących szyby między poziomami Bulwaru i Tarasu, a na koniec dotrzeć na platformie podtrzymywanej przez Idę do śluzy na poziomie Korony.
- **Warunki porażki:**
  - Śmierć Kuriera (upadek w przepaść szybu lub z kratownicy cofa gracza z utratą części zdrowia na krawędź platformy, dopóki ma punkty życia; zejście zdrowia do zera oznacza porażkę runu).
  - Przeciążenie i zniszczenie konsoli napędu windy w trakcie fazy jazdy (platforma ma własną wytrzymałość systemu sterowania w Fazie 1 i 2; w Fazie 3 hamulec przejmuje Ida).
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Utrzymanie integralności pierwszej i drugiej platformy powyżej 75% wytrzymałości* — nagroda: +30 Danych.
  - *Zrzucenie lub zestrzelenie trzech snajperów z wież bocznych podczas przejścia zewnętrznego (Warstwa 5)* — nagroda: +25 Danych.

## Mapa

- **Miejsce i nastrój:** Pionowa oś Masztu przechodząca przez wszystkie poziomy Neo-Rydu w nocnej burzy (`neonStreet` — silny wiatr, ulewa zacinająca pod kątem, błyskawice za chmurami, mokra stal kratownic). W dole widać zaciemnione Huty i Bulwar, w górze jarzą się zimne światła Korony. Paleta ADR 0006: na słupach prowadnic **bursztyn** lamp ostrzegawczych, przy włazach szybów **zieleń** kontrolek, wysoko na wieżach Korony **ciepła biel** i **błękit królewski** pasów nawigacyjnych, miejscami **fiolet** tablic przekaźnikowych. Celowniki laserowe snajperów, reflektory dronów i pancerze Orbis świecą **czerwienią**; ostrze gracza jest **cyanowe**. W punkcie kulminacyjnym z głębi ciemnego szybu bije stała, czysta **magentowa** poświata Rezonansu Idy.
- **Struktura sektora:** Run liczy **7 warstw** pnących się pionowo w górę, naprzemiennie: stałe pokoje wind (warstwy 2, 4 i 6) oraz pomosty przesiadkowe na konstrukcjach zewnętrznych:
  - **Warstwa 1 (Fundament w Hutach — start):** `combatSubstation` / `alleyUnderpass` w bazie Masztu. Grube żelbetowe filary i kraty szybu nr 1. Ida zostaje na dolnym pomoście inspekcyjnym przy głównym łożu hamulcowym.
  - **Warstwa 2 (Winda 1: Huty → Bulwar — stały pokój fabularny):** ruchoma platforma towarowa (wariant `combatPlatforms`). Przejazd trwa ok. 60 s (do strojenia); dwa przystanki mijankowe, z których na pokład wskakują szturmowcy, a wokół krążą drony.
  - **Warstwa 3 (Pomost na wysokości Bulwaru):** wybór między przejściem po wietrznej kratownicy z osłonami z kontenerów (`combatPlatforms`) a osłoniętą wnęką rozdzielczą wewnątrz trzonu wieży (`restRoom` albo `shopRoom` — polowy automat zaopatrzenia techników).
  - **Warstwa 4 (Winda 2: Bulwar → Taras — stały pokój fabularny):** szersza, częściowo osłonięta platforma z dwoma ekranami sterowania. Z sąsiednich wież Tarasu celują snajperzy; pojawiają się drony-hakery próbujące zresetować kod Tymona i zatrzymać wyciągarkę.
  - **Warstwa 5 (Konstrukcja zewnętrzna pod Tarasem):** wybór między otwartą kładką w burzy z laserami alarmowymi i gniazdami snajperów (`combatLaserYard` / `combatCorridor`) a bocznym szybem kablowym z punktem regeneracji (`restRoom` — sucha klitka techniczna z widokiem na deszcz).
  - **Warstwa 6 (Winda 3: Taras → Korona — stały pokój fabularny, kulminacja):** główny otwarty szyb transportowy o dużej prędkości. Połowa jazdy to ciężkie natarcie dronów i desant z górnego rusztowania. W połowie wysokości Orbis odpala ładunki na linach przeciwwagi i zwalnia mechaniczne szczęki hamulca. Z głębi szybu rozbłyska **magentowa** łuna — Ida trzyma platformę Rezonansem od dołu, stabilizując ją na ostatnich kilkudziesięciu metrach do górnej bramki.
  - **Warstwa 7 (Próg Korony):** `rooftopRest` na pierwszym zadaszonym tarasie Korony u podstawy iglicy Masztu. Oczyszczenie śluzy wejściowej do rdzenia i zabezpieczenie obejścia przed ostatnim skokiem w Misji 20.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Terminale kodowe szybów (x3):** przy wejściu do każdej windy; wpisanie kodu Tymona trwa ok. 1,5 s i uruchamia podjazd platformy.
  - **Konsola napędu na platformie (Windy 1–2):** cel ataków dronów-hakerów; jeśli zostanie zawieszona, platforma staje i wymaga 2 s ręcznego restartu.
  - **Kratownice mijankowe i barierki (Windy 1–3):** niskie barierki dają częściową osłonę przed ogniem snajperów i pozwalają spychać wrogów Pchnięciem Rezonansu prosto w przepaść szybu.
  - **Właz śluzy Korony (Warstwa 7):** zablokowanie go od środka otwiera stałą ścieżkę startową na szczyt dla Misji 20.
- **Wrogowie:**
  - Frakcja: **Orbis Grid**.
  - Archetypy: **Dron (`drone`)**, **Dron-haker (`hacker`)**, **Snajper (`sniper`)** na sąsiednich wieżach (czerwone wiązki celowników przed strzałem), **Szturmowiec (`assaulter`)** oraz **Strzelec (`gunner`)** wskakujący na platformę z mijanych pomostów, a przy progu Korony w Warstwie 7 pojedynczy **Tarczownik (`shielder`)** z eskortą.
- **Zagrożenia środowiskowe:**
  - **Otwarte krawędzie platformy i kratownic:** brak barier na części odcinków; silne podmuchy wiatru w Warstwie 5 lekko spychają przy skoku (do wykorzystania też przeciw wrogom przez Chwyt/Pchnięcie).
  - **Ogień krzyżowy snajperów w burzy:** między uderzeniami wiatru czerwone lasery tną deszcz z sąsiednich wież, wymagając korzystania z osłon na platformie lub szybkiego kontrostrzału / Błyskawicy.
  - **Zerwanie hamulca w Windzie 3:** krótkie szarpnięcie platformy w dół przed przechwyceniem jej przez Idę (wymaga przytrzymania równowagi lub uniknięcia krawędzi w momencie wstrząsu).

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Tymon dyktuje kody poszczególnych szybów, a Nadia z pamięci kreśli czasy mijanek i punkty, w których platformy zwalniają przy przejazdach między poziomami. Szron zatwierdza wejście od fundamentów w Hutach. Ida mówi mało, ale informuje krótko, że pójdzie na dolny pomost szybu zamiast zostać w Kamiennej.
2. **Podstawa Masztu (Warstwa 1):** Kurier dociera z Idą do betonowego cokołu Masztu w zaciemnionych Hutach. Ida staje przy otwartym dole szybu i patrzy w górę. Kurier wbija pierwszy kod Tymona i rusza pierwszą windą.
3. **Pierwszy przejazd i pomost Bulwaru (Warstwy 2–3):** Winda 1 wspina się w strugach deszczu. Nadia odlicza sekundy do mijanek, gdzie na platformę zeskakują pierwsi szturmowcy Orbis. Po wysiadce na poziomie Bulwaru Kurier przechodzi przez kratownicę w deszczu i wchodzi w drugi szyb.
4. **Drugi przejazd i zewnętrzna konstrukcja Tarasu (Warstwy 4–5):** Na wysokości Tarasu do walki wchodzą snajperzy z sąsiednich wież i drony-hakery siadające przy napędzie windy. Kurier broni konsoli i przebija się przez wietrzną kładkę zewnętrzną pod samym progiem najwyższego poziomu miasta.
5. **Trzeci szyb — próba zrzutu i wsparcie Idy (Warstwa 6):** Ostatnia, najdłuższa jazda ku Koronie. W połowie szybu Orbis detonuje klamry przeciwwagi. Platforma leci w dół na kilka metrów i nagle staje z metalicznym jękiem — z czarnej czeluści pod spodem rozlewa się jasne, magentowe światło. Ida przez radio mówi krótko, że trzyma hamulec, i każe czyścić resztę fali bez oglądania się w dół.
6. **Próg Korony i krótki powrót (`hideout`):** Kurier dociera na taras wejściowy Korony, zabezpiecza śluzę serwisową pod bezpośrednie podejście do węzła Chóru i schodzi zabezpieczonym ciągiem bocznym na dół po gotowy kartridż dysonansu od Wolan. W kryjówce zespół sprawdza ostatni raz sprzęt przed wejściem na sam szczyt.

## Dialogi

### Odprawa (kryjówka)

**Tymon:** Szyb numer jeden idzie od wschodniego fundamentu w Hutach. Pierwszy kod kończy się trójką, drugi ma przesunięcie co piętnaście minut. Wgrałem oba do twojego komunikatora, Kurier.
**Nadia (radio):** Kody otworzą bramki, ale windy mają jeszcze stare harmonogramy balastowe. Znam je z czasów, jak woziło się paczki szybem nocnym.
**Szron:** Mów po kolei, Nadia.
**Nadia (radio):** Pierwszy podjazd trwa minutę, po trzydziestej sekundzie zwalnia przy śluzie na Bulwarze — tam zawsze wskakuje zmiana. Drugi ma po lewej martwe pole od wież Tarasu, ale po prawej idą liny snajperów.
**Mira:** Jak wypuszczą drony-hakery na konsolę windy, platforma stanie w połowie szybu jak tarcza na strzelnicy. Zdejmuj je od razu, zanim wepną się w napęd.
**Ida:** Pójdę do fundamentów w Hutach. Zostanę pod szybem.
**Szron:** Ida, tam będzie otwarta strefa, jeśli zejdzie patrol z góry.
**Ida:** Na dole w Hutach jest ciemno i nikt tam teraz nie patrzy. Jeśli spróbują zablokować albo odciąć platformę z góry, poczuję napięcie na linach wcześniej niż wasze czujniki.
**Wolan:** Zostajesz w zasięgu bezpośredniego szybu? To kilkaset metrów w pionie.
**Ida:** Szyb jest prosty jak rura. Wystarczy widzieć światło na dole.
**Szron:** Zgoda. Kurier, wbijasz się od dołu do progu Korony i blokujesz tamtejszą śluzę serwisową. Po niej zostaje już tylko sam szczyt i dysonans od Wolan. Ruszajcie.

### W trakcie misji (radio)

**Wejście w szyb w Hutach (Warstwa 1):**
**Ida:** Jestem przy dolnym pomoście. Słychać stąd tylko wodę i wiatr w rurach. Kod wszedł — winda jest wolna, Kurier.
**Nadia:** Pamiętaj o zegarze przy wyjeździe. Masz minutę jazdy, zanim bramka na Bulwarze zamknie się na cykl serwisowy.

**Winda 1 — mijanka na wysokości Bulwaru (Warstwa 2):**
**Nadia:** Trzydzieści sekund, właśnie mijasz stary rozjazd kurierski! Uważaj na lewy pomost, stamtąd zawsze skakali kontrolerzy.
**Tymon:** Ochrona Orbis zna te same pieprzone skróty co my. Nie dawaj się przycisnąć do otwartej krawędzi.
**Nadia:** Dwóch zleciało z lewego pomostu. Nikt ich stamtąd nie zbierze.

**Przejście po konstrukcji pod Tarasem (Warstwa 5):**
**Mira:** Wiatr na tej wysokości ma spokojnie sześćdziesiąt na godzinę. Nie rób długich skoków pod podmuch, trzymaj się głównych belek.
**Szron:** Czerwone wiązki po prawej to snajperzy z wież Tarasu. Albo zdejmujesz ich z dystansu, albo chowasz się za rozdzielnicami, kiedy laser zmienia kolor przed strzałem.

**Winda 2 — atak hakerów na konsolę (Warstwa 4):**
**Bajt:** Cholera, dron-haker siadł na skrzynce napędu! Platforma zwalnia. Zbij go i zresetuj panel, bo zostaniesz w połowie drogi między piętrami!

**Winda 3 — zerwanie przeciwwagi i pomoc Idy (Warstwa 6):**
**Bajt:** Uwaga! Orbis właśnie zdetonował klamry na górnym kole wyciągu! Przeciwwaga leci w dół!
**Mira:** Kurwa, hamulec mechaniczny nie trzyma, czujniki poszły na zero! Trzymaj się czegoś!
*(Platforma szarpie w dół o kilka metrów, po czym gwałtownie zwalnia i staje w miejscu. Z czarnej głębi szybu pod kratownicą rozlewa się jasna, magentowa poświata.)*
**Tymon:** Co to, kurwa, za światło pod spodem...?
**Ida:** *(głos napięty, ale równy)* Mam hamulec. Trzymam go od dołu.
**Wolan:** Ida, to za duża masa na jeden kanał, puścisz w końcu!
**Ida:** Nie puszczę. Kurier, nie patrz w dół i czyść górę. Winda jedzie dalej, tylko wolniej.
**Szron:** Dotarło? Nie marnuj jej czasu, Kurier. Jeszcze jedna fala i jesteś na progu Korony.

**Próg Korony — zabezpieczenie śluzy (Warstwa 7):**
**Ida:** Jesteś na górnym podeście... Już czuję, że zaczepy weszły w próg. Puszczam.
**Bajt:** Czujniki na dole szaleją, ale żyje — widzę jej sygnaturę, zeszła z pomostu za filar.
**Nadia:** Śluza zablokowana od środka? Dobrze. Masz czystą drogę powrotną szybem bocznym po moduł od Wolan, a potem już tylko szczyt.

### Po misji (kryjówka)

**Wolan:** Moduł dysonansu jest gotowy. Zgrałam go na wytrzymały nośnik, który wepniesz prosto w konsolę węzła Chóru, kiedy Bajt otworzy kanał.
**Ida:** *(siedzi przy brzegu suchego peronu, oddycha ciężko, dłonie ma owinięte mokrym bandażem)* Winda stoi na górnych ryglach. Nie spadnie.
**Mira:** Dzięki za to tam na dole. Bez ciebie rozbiłoby platformę o fundament.
**Ida:** Szyb był prosty. Trzeba było tylko złapać stal, zanim nabrała prędkości.
**Tymon:** Na ile starczy nam jeszcze czasu w przychodniach na dole?
**Wolan:** Niecałe dwie godziny. Kiedy wejdziesz na Koronę, Kurier, Sarnecki pewnie przestawi cały system w tryb obrony wewnętrznej. Nie wpuści cię do środka bez walki.
**Bajt:** Jak tylko przełamiesz pierwsze linie przy węźle i zobaczysz gniazdo wgrania, daj sygnał. Ja puszczam dysonans zdalnie przez twój nośnik, ale potrzebuję kilkudziesięciu sekund czystego połączenia.
**Szron:** Śluza na Koronie już na ciebie czeka. Zamykamy to dziś w nocy.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 120 Danych oraz 3 Rdzenie za ukończenie misji (plus do 55 Danych z celów opcjonalnych).
  - Odblokowanie ulepszenia stabilności lub kosztu użycia mocy w powietrzu / podczas parowania strzałów snajperskich.
- **Zmiany w kryjówce:**
  - Ida wraca z fundamentów Hut zmęczona, ale przytomna; siedzi na peronie A i nie towarzyszy już w kolejnej misji terenowej, szykując siły.
  - Wolan kończy wgrywanie kartridża z **dysonansem** i przekazuje go graczowi przed finałem; mapa sektora wskazuje bezpośrednio szczyt Masztu na Koronie.
- **Co misja otwiera dalej:**
  - Odblokowuje finałową **Misję 20 — Cisza** (węzeł Chóru na szczycie Masztu i konfrontacja z systemem Wiktora Sarneckiego).

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Motyw `neonStreet` w wariancie burzowym, szablony `alleyUnderpass`, `combatSubstation`, `combatPlatforms`, `combatLaserYard`, `combatCorridor`, `rooftopRest`, `restRoom`, `shopRoom` oraz wrogowie `drone`, `hacker`, `sniper`, `assaulter`, `gunner`, `shielder`.
- **Nowe elementy potrzebne dla Misji 19:**
  - **Ruchoma arena platformy windy** (przesuwające się w pionie tło szybu, cykliczne dokowanie wrogów na mijankach, osobny pasek wytrzymałości konsoli napędu w Windach 1–2).
  - **Zdarzenie fabularne w Windzie 3:** animacja wstrząsu po zerwaniu liny, zapalenie się **magentowego** światła od dołu szybu (Ida), zablokowanie spadku wytrzymałości i dokończenie wjazdu na Koronę.
  - Modyfikator wiatru na zewnętrznych kratownicach w Warstwie 5.
- **Propozycje do backlogu:**
  - Pełna fizyka spadających elementów konstrukcji w tle burzy oraz dedykowany skrypt spychający przeciwników z platformy przy użyciu `Pchnięcia Rezonansu`.
