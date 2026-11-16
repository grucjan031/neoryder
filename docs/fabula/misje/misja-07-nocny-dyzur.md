# Misja 07 — Nocny dyżur

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| II | Helixa Dynamics | Bulwar, przychodnia i targ | Zwiad i kradzież | Nocna zmiana (bez twardego limitu; po alarmie ucieczka pod presją czasu) | Po Misji 06 (Odlewnia); odblokowuje Misję 08 (Kwarantanna) |

## W skrócie

Po otwarciu drogi na estakady Bulwaru Iskra sprawdza bezpłatną przychodnię Helixa Dynamics, w której mieszkańcy dołu miasta ustawiają się od rana po „neuroprotezę ruchową”. Kurier wchodzi nocą przez zaplecze sąsiedniej budki z makaronem, zdobywa fabryczną próbkę Akordu z magazynu i zgrywa rejestr pacjentów z lokalnego serwera. W wykradzionej bazie widnieje nazwisko Tymona — brata Miry — z własnoręcznym podpisem na kontrakcie Kurogane sprzed jedenastu miesięcy.

## Tło fabularne

Na serwerze Oskara Brandta w Odlewni Iskra znalazła umowy z Helixą Dynamics, słowa „Akord” i „kamerton” oraz listę kilkuset Rezonantów przekazanych na Taras w ciągu sześciu lat. Zabezpieczony folder „Palacz” pozostaje u Bajta w trakcie łamania, a wyjście z Hut otworzyło przejścia techniczne w górę — na estakady Bulwaru.

Na tym poziomie Helixa prowadzi sieć bezpłatnych przychodni reklamowanych jako program wsparcia dla pracowników fizycznych. Nadia Korsak, która po uwolnieniu w Misji 02 wróciła na Bulwar jako oczy Iskry, obserwuje punkt przy targu od tygodnia. Kolejka stoi przed drzwiami już od świtu: chętni dostają ulepszony implant za darmo, jeśli podpiszą kontrakt ochronny z Kurogane Arms, albo na wieloletnie raty bez umowy. Nikt w Kamiennej nie widział jeszcze nowego Akordu w fabrycznej kapsule, a listy pacjentów mogą ujawnić, kto z Niecki trafił pod nóż w ostatnich miesiącach.

Mira wciąż zakłada, że jej młodszy brat Tymon został zgarnięty przez obławę rok temu i przepadł w jednym z transportów na Taras. Doktor Helena Wolan przygląda się doniesieniom z przychodni z chłodnym dystansem i prosi wyłącznie o nienaruszoną próbkę wszczepu — nie wspomina jednak nic o dawnych badaniach nad kopiowaniem wzorca.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Przedostać się nocą do przychodni Helixa Dynamics przez zaplecze budki z makaronem przy wejściu na estakadę.
  - Zabrać fabryczną próbkę Akordu w kapsule chłodzącej z magazynu farmaceutycznego.
  - Zgrać pełny rejestr pacjentów z serwera przychodni.
  - Opuścić sektor przez targ i szyb towarowy prowadzący z powrotem w dół do Niecki.
- **Warunki porażki:**
  - Śmierć Kuriera (powrót do kryjówki z zachowaniem stałego postępu i powtórka misji).
  - Wykrycie w fazie zwiadu **nie kończy** misji — uruchamia alarm, zamyka część rolet i przestawia przychodnię oraz targ w tryb pościgu.
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Ciche przejście do magazynu* (dotarcie do kapsuły z próbką Akordu bez uruchomienia alarmu w hali przychodni) — nagroda: +20 Danych (propozycja do strojenia).
  - *Zgranie harmonogramu transportów chłodziwa* (dodatkowa interakcja przy terminalu w magazynie przed wyjściem na targ) — nagroda: +15 Danych i skrócony czas namierzania przy następnych wejściach na Bulwar (propozycja do strojenia).

## Mapa

- **Miejsce i nastrój:** Poziom handlowy Bulwaru na betonowych estakadach nad Niecką, motyw `neonStreet` (noc, deszcz spływający z krawędzi wyższych tarasów na zadaszenia kramów). Otoczenie ciemne i chłodne, kontrastujące sterylną zabudową przychodni z ciasnym targiem obok. Neony mieszczą się w palecie ADR 0006: **ciepła biel** nad wejściem do przychodni i w korytarzach po godzinach, **bursztyn** przy budce z makaronem i lampach ulicznych, **zieleń** tabliczek ewakuacyjnych, **fiolet** i **błękit królewski** na wygaszonych na noc szyldach targu. Na tym tle odcinają się **czerwone** wizjery i celowniki ochrony Helixa, **cyanowe** ostrze plazmowe gracza oraz **magentowe** wyładowania Rezonansu.
- **Struktura sektora:** Run liczy **7 warstw** na mapie wyboru ścieżki (propozycja do strojenia), z czterema stałymi węzłami fabularnymi:
  - **Warstwa 1 (Wejście — stały pokój fabularny):** `noodleShop` — zamknięta na noc budka z makaronem przy samej estakadzie. Przejście przez zaplecze kuchenne i ciasny szyb dostawczy do bocznego korytarza przychodni.
  - **Warstwa 2 (Podejście zewnętrzne):** wybór między cichym zaułkiem za blokami usługowymi (`alleyBackstreet`) a nocnym punktem zaopatrzenia u znajomego Nadii (`shopRoom`).
  - **Warstwa 3 (Hala przychodni — stały pokój fabularny):** wariant `combatPillars` lub `combatCorridor` w sterylnej oprawie gabinetów i recepcji. Przeszklone boksy zabiegowe i lady tworzą osłony pozwalające ominąć patrole ochrony Helixa albo szybko zlikwidować pojedynczych strażników, zanim podniosą alarm.
  - **Warstwa 4 (Magazyn implantów — stały pokój fabularny):** wariant `combatWarehouse` w chłodniejszym, technicznym skrzydle przychodni. Regały z lodówkami na komponenty oraz zamknięta szafa z próbką Akordu.
  - **Warstwa 5 (Serwerownia rejestrów — stały pokój fabularny):** wariant `combatCorridor` zakończony przeszklonym pomieszczeniem administratora. Tu stoi lokalny serwer z bazą pacjentów; podpięcie czytnika trwa kilka sekund i domyślnie podrywa system zabezpieczeń całego skrzydła.
  - **Warstwa 6 (Ucieczka przez targ):** rozwidlenie na otwarty plac targowy pod roletami (`alleyMarket`) albo dłuższą drogę przez skrzyżowanie estakad (`alleyCrossing`) z opcjonalnym przystankiem technicznym (`restRoom` — suchy składzik z częściami). Po alarmie sektor zalewają patrole pościgowe.
  - **Warstwa 7 (Zejście z estakady — stały pokój fabularny):** wariant `alleyUnderpass` na krawędzi Bulwaru z windą towarową i szybem zrzutowym w dół do Niecki. Ostatnia blokada ochrony Helixa przed otwarciem kraty zjazdowej.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Krata za zapleczem budki z makaronem:** otwierana wytrychem lub przecięciem zamka (ok. 1,5 s — propozycja do strojenia), cichy punkt wejścia.
  - **Chłodziarka z próbką Akordu (Warstwa 4):** kapsuła transportowa w bocznym magazynie; wyjęcie próbki trwa ok. 2 s i nie włącza alarmu, o ile nie rozbije się szyby zamiast odpiąć zatrzask.
  - **Serwer rejestrów (Warstwa 5):** zgranie bazy zajmuje ok. 8 s (propozycja do strojenia). W tym czasie można osłaniać korytarz; po zakończeniu transferu system przychodni automatycznie wysyła sygnał naruszenia strefy medycznej.
  - **Przycisk windy towarowej (Warstwa 7):** uruchomienie wymaga ok. 3 s przytrzymania i otwiera zjazd w dół po wyczyszczeniu krawędzi estakady lub odcięciu pościgu.
- **Wrogowie:**
  - Frakcja: **Helixa Dynamics** (czerwone wizjery masek i oznaczenia pancerza).
  - Archetypy w Misji 07:
    - **Ochroniarz Helixa** (propozycja do backlogu: gładki pancerz z płyt, sterylna maska, powolniejszy i bardziej wytrzymały niż oddziały Kurogane; wariant zastępczy: `assaulter` i `gunner` o podniesionym pancerzu).
    - **Sanitariusz bojowy Helixa** (propozycja do backlogu: granaty-strzykawki tworzące krótkotrwałą strefę spowalniającego aerozolu; wariant zastępczy: `gunner` wspierany granatami lub `hacker` z efektem spowolnienia).
    - **Dron patrolujący (`drone`):** pojedyncze sztuki na targu i przy windzie towarowej po uruchomieniu alarmu.
    - **Wieżyczka (`turret`):** stacjonarna nad wejściem do magazynu lub przy kracie wyjściowej, wyłączana z panelu obok albo niszczona w walce.
  - Brak bossa oraz brak wydzielonej elity (pierwsza walka z nowymi typami zagrożeń Helixa bez ciężkiego dowódcy).
- **Zagrożenia środowiskowe:**
  - Czujniki ruchu w głównym korytarzu przychodni (bursztynowe wiązki na wysokości pasa — do przeskoczenia lub obejścia przez boksy zabiegowe).
  - Śliskie chodniki targowe w deszczu oraz zwężenia między zamkniętymi straganami podczas ucieczki po alarmie.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Nadia opisuje wygląd przychodni od ulicy, godzinę zmiany ochrony i bezpieczne wejście przez kuchnię budki z makaronem, której właściciel udaje, że nie słyszy nocnych kroków. Wolan określa, jak ma wyglądać kapsuła z próbką Akordu, a Bajt daje czytnik pod serwer. Mira pilnuje przygotowania torby termoizolacyjnej, licząc na listę wywiezionych z Niecki.
2. **Zaplecze budki z makaronem (Warstwy 1–2):** Kurier wchodzi do pustej kuchni pachnącej starym olejem i deszczem zza uchylonej rolety. Przechodzi kładką serwisową na tyły budynku przychodni. Ma możliwość szybkiego zaopatrzenia u kontaktu Nadii lub wejścia od razu przez właz wentylacyjny.
3. **Cicha faza w przychodni (Warstwy 3–4):** Nocna zmiana ochrony liczy zaledwie kilka patroli. Kurier przemyka między boksami zabiegowymi, omija wiązki w korytarzu i dociera do chłodzonego magazynu. Otwiera chłodziarkę i zabiera pojedynczą kapsułę z fabrycznym Akordem. Jeśli strażnicy wcześniej wykryją ruch, włączają syreny i zamykają główne rolety — ale wejście do serwerowni pozostaje dostępne przez szyb techniczny.
4. **Serwerownia rejestrów (Warstwa 5):** W pomieszczeniu administratora Kurier wpina czytnik Bajta. Nawet jeśli do tej pory udało się uniknąć wykrycia, kopiowanie pełnej bazy pacjentów uruchamia cichy alert w centrali ochrony i po chwili rozlega się alarm całego piętra. Kurier zabiera czytnik, gdy pasek transferu dobiega końca.
5. **Ucieczka przez targ (Warstwa 6):** Przychodnia wypluwa posiłki na sąsiedni nocny targ pod estakadą. W deszczu między kramami pojawiają się drony i grupy pościgowe ochrony Helixa z gładkimi maskami oraz granatami-strzykawkami. Gracz przebija się przez plac lub boczne skrzyżowanie ku krawędzi Bulwaru.
6. **Zejście z estakady (Warstwa 7):** Na końcu pomostu stoi ostatnia blokada przy windzie towarowej. Kurier rozbija osłonę, uruchamia zjazd w dół i wraca szybem serwisowym do Niecki.
7. **Powrót na Kamienną (`hideout`):** Wolan zabezpiecza kapsułę Akordu w kąciku przy nieprzytomnej Idzie. Bajt otwiera zgrany rejestr na swoim stanowisku, przegląda umowy na darmowe wszczepy w zamian za kontrakt Kurogane i trafia na znajome nazwisko. W obecności Szrona i Kuriera Mira czyta skan umowy Tymona sprzed jedenastu miesięcy.

## Dialogi

### Odprawa (kryjówka)

**Nadia:** Przychodnia stoi przy zachodnim rogu targu, tuż pod pętlą estakady. Od szóstej rano kolejka zawija się aż pod automat z wodą.
**Mira:** I ludzie naprawdę biorą ten szajs dobrowolnie?
**Nadia:** Za darmo dają każdemu, kto podpisze przydział do ochrony Kurogane. Reszta dostaje na raty, połowę taniej niż zwykły implant ruchowy u prywaciarzy.
**Bajt:** Brzmi jak promocja z haczykiem wielkości dźwigu portowego.
**Wolan:** Interesuje mnie nienaruszona kapsuła z serii produkcyjnej. Powinna leżeć w chłodziarce w magazynie zabiegowym, w roztworze soli. Nie uszkodźcie obudowy.
**Szron:** Wejście od frontu odpada. Nadia znalazła drogę bokiem.
**Nadia:** Przez budkę z makaronem dwie bramy dalej. Właściciel zamyka o jedenastej i nie wraca przed piątą. Tylna krata prowadzi prosto na pomost za przychodnią.
**Bajt:** Do tego mój czytnik do lokalnego serwera. Chcę pełną bazę przyjęć z ostatniego roku — imiona, daty, numery partii, kto podpisał kontrakt, a kogo przysłano bez pytania.
**Mira:** Sprawdź też, czy nie przepuszczali tam ludzi złapanych w Niecce. Z zeszłej wiosny wciąż brakuje kilkunastu osób.
**Szron:** Najpierw bez hałasu. Ochrona Helixa ma mało ludzi na nocnej zmianie, ale jak podniesiesz alarm, odetną targ od estakady.
**Szron:** Jeśli cię zauważą, nie zatrzymuj się przy drzwiach. Baza ma trafić do nas, a nie zostać w serwerowni.
**Mira:** Torba termoizolacyjna wisi na prawej klamrze. Kapsuła ma wejść ciasno w piankę, inaczej pęknie przy pierwszym skoku z murka.

### W trakcie misji (radio)

**Wejście przez budkę z makaronem:**
**Nadia:** Jesteś w środku? Kuchnia powinna być pusta, tylko wyłącznik wentylatora nad piecem czasem iskrzy.
**Bajt:** Łączność czysta. Przechodzisz kratą na tyłach zaplecza — zaraz za śmietnikiem zaczynają się okna gabinetów.

**Hala przychodni (ciche podejście):**
**Szron:** Dwa patrole na piętrze i czujniki w głównym przejściu. Omiń wiązki przez boksy zabiegowe, nie idź środkiem korytarza.
**Nadia:** W gabinetach po lewej trzymają tylko opatrunki i puste formularze. Magazyn jest na końcu, za podwójnymi drzwiami.

**Jeśli gracz zostanie wykryty przed serwerownią:**
**Bajt:** Kurwa, złapali ruch w korytarzu, rolety od frontu lecą w dół.
**Szron:** Nie cofaj się. Szyb techniczny nad rejestracją zostaje otwarty — bierz próbkę i idź prosto do serwera.

**Magazyn (zabezpieczenie próbki Akordu):**
**Wolan:** Chłodziarka stoi przy ścianie z filtrami. Kapsuły są opisane kodem serii na etykiecie z numerem partii.
**Mira:** Masz? Dobra, dociśnij wieko torby, zanim zaczniesz biec.

**Serwerownia (podpięcie czytnika):**
**Bajt:** Czytnik widzi dysk. Zgrywam rejestr pacjentów... chwila, to ma ponad cztery tysiące wpisów, potrzebuję kilku sekund.
**Bajt:** Cholera, serwer wysłał sygnał o nieautoryzowanym kopiowaniu. Za moment postawią na nogi cały budynek.

**Ucieczka przez targ:**
**Szron:** Od strony alei idzie ekipa w gładkich maskach i dwa drony. Nie walcz na środku placu, między straganami łatwiej zerwać linię ognia.
**Mira:** Uważaj na te ich granaty ze strzykawkami — jak rozleje się chmura na asfalcie, zwalnia stawy i wyżera filtr w masce.
**Nadia:** Za stoiskiem z elektroniką jest zejście na krawędź estakady. Tam stoi stara winda towarowa do Niecki.

**Krawędź estakady (wyjście):**
**Bajt:** Plik siedzi w pamięci cały. Zamykaj bramę windy, zanim dopadną pomostu.
**Szron:** Dobra robota, Kurier. Zjeżdżaj na dół, widzimy się na Kamiennej.

### Po misji (kryjówka)

**Wolan:** Kapsuła jest cała. Płyn w środku nie zmętniał — jutro rozbiorę obudowę i sprawdzę, jak łączą elektrody z korą ruchową.
**Szron:** A baza pacjentów?
**Bajt:** Właśnie ją porządkuję. Cztery tysiące dwieście nazwisk z Bulwaru i Niecki. Większość to zwykli kurierzy, magazynierzy, operatorzy dźwigów...
**Mira:** Szukaj dat sprzed roku. Kwiecień, maj. Albo bezpłatnych skierowań z adnotacją „transport”.
**Bajt:** Filtruję... czekaj. Mam pełno darmowych wszczepów podpiętych pod kontrakty ochrony Kurogane. Nawet z własnoręcznym podpisem i skanem siatkówki.
**Mira:** Pokaż to.
**Bajt:** Mira, zaczekaj chwilę... tu jest wpis z przedostatniej strony...
**Mira:** Przesuń kursor, Bajt.
**Szron:** Co tam jest?
**Bajt:** Tymon. Jedenaście miesięcy temu. Wiek, numer implantu ruchowego z warsztatu na dole, adres: stary kwadrat w Niecce.
**Mira:** To nie może być jego podpis. Złapali go na zmianie w porcie, nie zdążył nawet wrócić do domu.
**Bajt:** Tu jest zapis kamery ze stanowiska rejestracji. Przyszedł sam o dziewiątej rano. Zgoda na warunki kontraktu z Kurogane Arms, Akord wszczepiony bez zaliczki.
**Mira:** Zostaw ten ekran. Przewiń jeszcze raz datę.
**Szron:** Mira...
**Mira:** Nie mów nic. Przez rok sprawdzałam każdy spalony kontener i każdą listę z Hut. A on siedział piętro wyżej i podpisał, kurwa, papier na własne nazwisko.
**Szron:** Na dziś wystarczy. Dajcie jej chwilę przy stole. Kurier — bez tej listy nadal szukalibyśmy w ciemno. Odpocznij przed kolejnym wyjściem.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 90 Danych oraz 1 Rdzeń za ukończenie misji (plus do 35 Danych za cele dodatkowe).
  - Odblokowanie informacji o kontrakcie Tymona w aktach kryjówki oraz podstawowych danych o konstrukcji Akordu u Wolan.
- **Zmiany w kryjówce:**
  - Mira przez kolejną dobę przesiaduje przy biurku Bajta lub na krawędzi wagonu-warsztatu, przeglądając kopię rejestru; jej kwestie w bazie stają się bardziej napięte i krótkie.
  - Na stole Wolan pojawia się rozebrana kapsuła Akordu w chłodziarce obok aparatury nieprzytomnej Idy.
  - W kolejnej misji (M8) budzi się Ida — jej przebudzenie następuje w bezpośrednim następstwie pojawienia się rozstrojonego bloku na Bulwarze.
- **Co misja otwiera dalej:**
  - Odblokowuje **Misję 08 — Kwarantanna** (gwałtowne rozstrojenie partii Akordu za estakadą w Bulwarze).
  - Przesuwa konflikt w kryjówce na poziom osobisty: Mira wie już, że Tymon dobrowolnie wszedł w służbę Kurogane, ale nie wie jeszcze, gdzie służy i jak działa jego implant.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Pętla runu, mapa wyboru ścieżki z pokojami (`noodleShop`, `alleyBackstreet`, `alleyMarket`, `alleyCrossing`, `alleyUnderpass`, `combatCorridor`, `combatPillars`, `combatWarehouse`, `restRoom`, `shopRoom`), motyw `neonStreet` i `hideout`.
  - Drony (`drone`), wieżyczki (`turret`) oraz podstawowe archetypy strzelców i szturmowców jako tymczasowa obsada ochrony Helixa.
- **Nowe elementy potrzebne dla Misji 07:**
  - Stałe pokoje fabularne w warstwach 1, 3, 4, 5 i 7 generatora sektora Bulwar.
  - Prosta faza cichego podejścia w Warstwie 3 i 4 (strefy widzenia patroli + wiązki czujników ruchu), z płynnym przejściem w stan alarmu zamiast twardego resetu misji.
  - Dwa obiekty interaktywne z paskiem postępu: **chłodziarka z próbką Akordu** oraz **serwer rejestrów** (czas pobierania uruchamiający alert).
  - Wyjście z sektora (winda towarowa) otwierane po zakończeniu pobierania danych.
- **Propozycje do backlogu:**
  - Dedykowane archetypy frakcji Helixa Dynamics: powolniejszy, opancerzony strażnik w sterylnej masce oraz sanitariusz rzucający granaty-strzykawki zostawiające strefę spowalniającej mgły.
  - Pełne nagrania skanu rejestracyjnego jako element inspekcji przy terminalu Bajta w kryjówce.
