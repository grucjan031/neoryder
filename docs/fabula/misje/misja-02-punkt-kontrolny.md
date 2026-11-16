# Misja 02 — Punkt kontrolny

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| I | Kurogane Arms | Niecka, bocznica towarowa przy nasypie | Odbicie więźnia (trzy kontenery-cele i eskorta) | Noc (brak twardego limitu; presja pościgów po otwarciu cel) | Po Misji 01 (Maszty); odblokowuje Misję 03 (List przewozowy) |

## W skrócie

Po zniszczeniu masztów nasłuchowych Kurogane Arms traci podgląd Rezonansu w Niecce i przechodzi do ręcznych zatrzymań. Patrole zgarniają z ulic kurierów z tanimi implantami ruchowymi i zamykają ich na prowizorycznym punkcie kontrolnym przy starej bocznicy, gdzie prowadzą selekcję skanerami Helixa. Kurier wchodzi na bocznicę, otwiera pod ostrzałem trzy kontenery-cele, uwalnia Nadię Korsak wraz z pozostałymi zatrzymanymi i osłania ich odwrót przez bramę zachodnią po pokonaniu Egzekutora dowodzącego placówką.

## Tło fabularne

Zniszczenie trzech masztów w Misji 01 zablokowało Kurogane automatyczną triangulację na dole miasta, ale biały moduł Helixa wyciągnięty z drugiego przekaźnika potwierdził, że zbrojeniówka szuka konkretnej sygnatury w korze ruchowej. Zamiast stawiać nowe nadajniki w zaułkach, oddziały Brandta zamykają główne przejścia pod estakadami i zatrzymują nocnych dostawców na wyrywkową kontrolę.

Z punktu zbornego przy nieczynnej bocznicy towarowej od rana nie wróciło kilkunastu kurierów z Niecki, w tym Nadia Korsak — dawna koleżanka Kuriera z dyspozytorni. Zwiad Iskry potwierdza, że na miejscu rozstawiono kontenery przeładunkowe oraz przenośną aparaturę pomiarową, a zatrzymani czekają na poranny transport w głąb Hut.

Gracz nie wie jeszcze, dokąd dokładnie trafiają ludzie wywożeni z Niecki ani dlaczego Helixa Dynamics udostępnia ochronie swoje czujniki medyczne. Nie wie też, że część zatrzymań w dzielnicy odbywa się na podstawie krótkich donosów z wewnątrz, ani czym dokładnie jest „ładunek”, o którym mówią przewoźnicy z portu.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Przedostać się przez kordon na bocznicę towarową w Niecce.
  - Otworzyć trzy kontenery-cele pod ostrzałem (złamanie rygla lub rozbicie skrzynki zamka przy każdym kontenerze), uwalniając Nadię Korsak i pozostałych zatrzymanych kurierów.
  - Osłonić uciekających do bramy ewakuacyjnej po zachodniej stronie placu i pokonać Egzekutora dowodzącego punktem kontrolnym.
- **Warunki porażki:**
  - Śmierć Kuriera (powrót do kryjówki z zachowaniem trwałego postępu i powtórka misji).
  - Śmierć Nadii Korsak w trakcie przejścia z kontenera do bramy ewakuacyjnej.
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Pełna ewakuacja* (wszyscy zatrzymani z trzech kontenerów docierają żywi za bramę zachodnią) — nagroda: +20 Danych (propozycja do strojenia).
  - *Rejestr skanów* (zgranie dysku z przenośnego stanowiska kontrolnego Helixa przed wyjściem z placu) — nagroda: +15 Danych oraz wykaz numerów seryjnych badanych implantów.

## Mapa

- **Miejsce i nastrój:** Zarośnięta, podmokła bocznica towarowa w Niecce pod ceglanym nasypem kolejowym, motyw `neonStreet` (noc, ciągły deszcz, kałuże wody zmieszanej z olejem między podkładami). Otoczenie ciemne i chłodne. Oświetlenie z palety ADR 0006: **bursztynowe** lampy robocze na prowizorycznych masztach nad wagonami, tabliczki kierunkowe bocznicy w **zieleni**, przygaszony szyld starej dyspozytorni w **ciepłej bieli**, jarzeniówki w budce wagi towarowej w **błękicie królewskim** i **fiolecie**. Na tym tle odcinają się **czerwone** pancerze i światła blokad Kurogane, **cyanowe** ostrze plazmowe gracza oraz **magentowe** wyładowania Rezonansu.
- **Struktura sektora:** Run liczy **7 warstw** na mapie wyboru ścieżki (propozycja do strojenia), z trzema stałymi pokojami fabularnymi wyznaczającymi oś punktu kontrolnego:
  - **Warstwa 1 (Wejście):** punkt startowy oparty na `alleyUnderpass` (wyjście kanałem odpływowym pod nasypem).
  - **Warstwa 2 (Kordon zewnętrzny):** wybór między walką z patrolem na dojściu (`alleyBackstreet` lub `combatCorridor`) a cichym przejściem przez punkt wymiany w starym wagoniku (`shopRoom` lub `noodleShop`).
  - **Warstwa 3 (Rampa wstępnej selekcji — stały pokój fabularny):** obowiązkowy węzeł oparty na `alleyCrossing`. Porzucone skutery kurierskie przy szlabanie, pierwsza wieżyczka oraz stanowisko wstępnej kontroli dokumentów.
  - **Warstwa 4 (Środek sektora):** wybór między zalanym przepustem pod torami (`combatFloodedTunnel`), walką między składami gruzu (`combatPillars`) a pokojem odpoczynku w starej nastawni (`restRoom`).
  - **Warstwa 5 (Zaplecze bocznicy):** wybór między podejściem od strony ramp (`combatPlatforms`) a bocznym składem narzędziowym (`shopRoom` lub `restRoom`).
  - **Warstwa 6 (Zewnętrzny plac bocznicy — Kontenery 1 i 2 — stały pokój fabularny):** obowiązkowy węzeł na bazie `combatYard`. Dwa zamknięte kontenery-cele po przeciwnych stronach placu oraz białe stanowisko skanera Helixa pod brezentową wiatą. W drugim kontenerze przebywa Nadia Korsak. Po otwarciu obu kontenerów uciekinierzy ruszają za Kurierem do śluzy przy budce zwrotniczego.
  - **Warstwa 7 (Główny punkt kontrolny i brama zachodnia — Kontener 3 i Egzekutor — stały pokój fabularny):** finałowy węzeł na bazie `eliteCourtyard` lub rozbudowanego `combatWarehouse`. Trzeci kontener stoi pod suwnicą naprzeciwko bramy zachodniej; dostępu broni dowódca punktu — **Egzekutor (`executor`)** — wspierany przez strzelców i wieżyczkę. Po otwarciu trzeciej celi i pokonaniu Egzekutora brama odblokowuje się dla całej grupy.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Kontenery-cele (x3):** ciężkie kontenery transportowe z dorobionym zewnętrznym ryglem elektrycznym i czerwoną lampką blokady. Otwarcie zamka trwa ok. 2 s interakcji lub wymaga rozbicia skrzynki zasilającej (liczby do strojenia).
  - **Stanowisko skanera Helixa (Warstwa 6):** biała, sterylna konsola medyczna wstawiona pod prowizoryczną wiatę; obok stolik z dyskiem rejestru (cel dodatkowy).
  - **Punkt zborny przy budce zwrotniczego (przejście W6–W7):** bezpieczny narożnik za stalową płytą, gdzie Nadia i uwolnieni z pierwszych dwóch kontenerów czekają na sygnał do przebiegnięcia pod bramę zachodnią.
  - **Brama zachodnia (Warstwa 7):** ciężka krata towarowa otwierana od wewnątrz dźwignią po zlikwidowaniu Egzekutora.
- **Wrogowie:**
  - Frakcja: **Kurogane Arms** (czerwone oznaczenia).
  - Archetypy w Misji 02:
    - **Szturmowiec (`assaulter`):** szybkie grupy przechwytujące reagujące po otwarciu każdego kontenera; starają się odcinać drogę uciekinierom.
    - **Strzelec (`gunner`):** obstawa na dachach wagonów i przy budce wagi.
    - **Wieżyczka (`turret`):** stacjonarne osłony przy rampie w Warstwie 3 oraz przy bramie zachodniej w Warstwie 7.
    - **Egzekutor (`executor`, elita — pierwsze pojawienie się w kampanii):** dowódca punktu kontrolnego w Warstwie 7; ciężki pancerz, agresywne szarże na krótki dystans i ciężkie ataki wymuszające parowanie lub użycie mocy Rezonansu.
  - Archetypy `shielder` i `drone` nadal nie występują — ich debiut przypada na Misję 03.
- **Zagrożenia środowiskowe:**
  - Zastoiny wody między szynami ograniczające szybkie uniki poza podkładami i rampami.
  - Krzyżowy ostrzał z podestów wagonów w Warstwie 6, szczególnie niebezpieczny dla nieopancerzonych kurierów podczas przejścia między osłonami.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Bajt potwierdza obławę na kurierów i lokalizację punktu na bocznicy. Szron określa warunek: najpierw uwolnić zatrzymanych, dopiero potem wycinać dowództwo. Mira wskazuje słabe punkty rygli kontenerowych.
2. **Podejście przez kordon (Warstwy 1–5):** Kurier wychodzi pod nasypem, omija lub przebija się przez wysunięte patrole. Na rampie selekcji (Warstwa 3) trafia na porzucone skutery i dokumenty potwierdzające kontrolę wszystkich posiadaczy implantów ruchowych z Niecki.
3. **Plac kontenerowy — Kontenery 1 i 2 (Warstwa 6):** Po oczyszczeniu pierwszej linii osłon Kurier otwiera pierwszy kontener, a następnie drugi — tam znajduje Nadię Korsak i trójkę innych dostawców. Nadia rozpoznaje Kuriera i przekazuje strzęp rozmowy strażników: zeszłomiesięcznych zatrzymanych wywieziono do Magazynu 9 w porcie. Z boku placu Kurier zauważa białe stanowisko skanera Helixa, z którego może zgrać rejestr badań.
4. **Przejście do strefy bramy (W6 → W7):** Nadia z grupą kryje się za osłonami przy budce zwrotniczego i porusza się etapami za Kurierem, kiedy ten eliminuje wysuniętych strzelców.
5. **Kontener 3 i starcie z Egzekutorem (Warstwa 7):** Pod suwnicą czeka dowódca punktu (**Egzekutor**) ze swoją obstawą. Kurier rozbija osłonę, uwalnia trzecią grupę kurierów spod wiaty i staje do walki z Egzekutorem. Po jego pokonaniu otwiera bramę zachodnią, osłania ucieczkę cywilów w stronę zaułków Niecki i wycofuje się kanałem powrotnym.
6. **Powrót na Kamienną (`hideout`):** Nadia nie zostaje na stałe w podziemiach — wraca na powierzchnię w rejon Bulwaru, by obserwować ruchy kurierów i dostaw dla Iskry. Zespół analizuje trop wskazujący na Magazyn 9 w porcie Hut.

## Dialogi

### Odprawa (kryjówka)

**Bajt:** Od rana zniknęło jedenaście osób z nocnej zmiany kurierskiej. Wszystkie sygnały urywają się przy starej bocznicy pod nasypem.
**Szron:** Nie stawiają nowych masztów. Zbierają ludzi z ulicy ręcznie, zanim znikną z pola widzenia.
**Mira:** Sprawdziłam stare plany tej bocznicy. Trzymają ich w zwykłych kontenerach morskich z dorobionym zamkiem na siłowniku.
**Mira:** Skrzynka sterująca wisi zawsze po prawej stronie wrót. Dwa uderzenia ostrzem albo zwarcie na kablach i rygiel puszcza.
**Tomasz:** Z tamtej zmiany wywieźli też Nadię Korsak z dyspozytorni. Znasz ją z tras na dole, prawda?
**Szron:** Jeśli jest w środku, ma wyjść żywa. Nie interesują nas w tym miejscu długie wymiany ognia — otwierasz trzy kontenery, wyprowadzasz ludzi przez zachodnią bramę.
**Bajt:** Na placu stoi jakiś biały sprzęt, którego nie widziałem nigdy w zbrojowniach Kurogane. Jeśli uda się podejść do konsoli, zgarnij logi, zanim je skasują.
**Tomasz:** Cywile nie mają pancerzy, Kurier. Gdy otworzysz drzwi, nie zostawiaj ich na otwartym torze.
**Szron:** Na bramie może siedzieć cięższa obstawa. Zrób przejście i wyprowadź wszystkich.

### W trakcie misji (radio)

**Wejście do sektora (Warstwa 1):**
**Bajt:** Jesteś pod ceglanym nasypem. Na górze stoi przynajmniej pięć patroli, trzymają światła nisko przy torach.
**Szron:** Trzymaj się krawędzi cienia przy ścianie oporowej. Rampa wstępna jest dwieście metrów na wschód.

**Rampa selekcji (Warstwa 3):**
**Mira:** Widzisz te skutery pod plandeką? Z każdej ramy wycięli nadajnik, skurwiele. Ktoś bardzo nie chce, żeby firmy kurierskie szukały zaginionych.
**Szron:** Zdejmij wieżyczkę przy szlabanie i ruszaj dalej w głąb bocznicy.

**Zewnętrzny plac — otwarcie Kontenera 1 (Warstwa 6):**
**Bajt:** Pierwsze wrota puszczają! Wyprowadź ludzi za budkę z wagą, z lewej strony placu nie sięgają reflektory.
**Mira:** Dobrze. Jeszcze dwa kontenery. Drugi stoi za białą wiatą ze skanerem.

**Otwarcie Kontenera 2 — spotkanie z Nadią (Warstwa 6):**
**Nadia:** Czekaj... to naprawdę ty? Myślałam, że cię wywieźli dwa tygodnie temu, jak wszystkich z nocnej trasy.
**Szron:** Nadia, tu Szron. Słyszysz mnie przez komunikator? Trzymaj ludzi z tyłu, nie wychylajcie się zza osłon.
**Nadia:** Rozumiem. Słuchajcie — sprawdzają tu każdego białym skanerem medycznym. Kto miał czysty wynik, szedł na bok. A tych, którym coś piszczało przy głowie, ładowali jak bydło w zeszłym miesiącu do ciężarówek na Magazyn 9 w porcie.

**Stanowisko skanera Helixa (opcjonalnie w Warstwie 6):**
**Bajt:** To samo białe tworzywo co w drugim maszcie, tylko w obudowie lekarskiej. Jak podepniesz na sekundę złącze, zgarnę listę numerów seryjnych.

**Przejście do bramy zachodniej i Kontenera 3 (Warstwa 7):**
**Szron:** Uwaga na dach przy suwnicy. Wychodzi ciężki pancerz z dowództwa punktu — Egzekutor. Nie daj mu się zamknąć przy ścianie.
**Nadia:** Trzeci kontener stoi tuż obok nich, słychać, jak pukają od środka, kurwa! Osłoń nas chwilę, przyciśniemy się do wagonów!
**Mira:** Nie spiesz się z bramą, dopóki ten skurwiel stoi na nogach. Rozwal go albo zrzuć z toru, potem rwij rygiel trzeciej celi.

**Po pokonaniu Egzekutora i otwarciu bramy (Warstwa 7):**
**Bajt:** Brama zachodnia odblokowana. Droga w kanały za nasypem jest czysta przez najbliższe trzy minuty.
**Nadia:** Wszyscy wyszli! Wracaj z nami, zanim ściągną posiłki z głównej bramy Hut!
**Szron:** Zamykaj przejście za ostatnim człowiekiem i wracaj na Kamienną. Dobra robota.

### Po misji (kryjówka)

**Mira:** Opatrunek na ramieniu zmieniony, z resztą wrócili w jednym kawałku. Nadia poszła już wyżej, na Bulwar.
**Szron:** Zostaje tam?
**Mira:** Tak powiedziała. Ma tam starych znajomych z dyspozytorni i legalną przepustkę do korytarzy towarowych. Będzie nam dawać znać przez twój szyfrowany przekaźnik, Bajt.
**Bajt:** Już ją wpiąłem w boczny kanał przy biurku. A z tym skanerem z bocznicy sprawa robi się jasna i paskudna zarazem.
**Tomasz:** Czyli to nie są zwykłe łapanki pod przymusowe roboty.
**Bajt:** Zdecydowanie nie. Skaner Helixa badał reakcję kory ruchowej na impuls, dokładnie tak jak głowica z masztu. Tych, którzy nic nie wykazali, wypisywali z karą albo puszczali na drugą zmianę. Resztę kierowali dalej.
**Szron:** Do Magazynu 9 w porcie Hut.
**Bajt:** Tak jak powiedziała Nadia. W spisie wywozu nie ma nazwisk, są tylko daty i numery wozów. Żeby zobaczyć, dokąd jadą z portu, trzeba wejść na terminal spedycji na miejscu.
**Mira:** W porcie mają już pełne patrole, nie prowizorkę z bocznicy. Następnym razem trzeba będzie zabrać coś cięższego niż łom do zamków.
**Tomasz:** Najpierw niech wszyscy złapią oddech. Jutro wieczorem sprawdzimy dojścia do nabrzeża.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 80 Danych oraz 1 Rdzeń za ukończenie misji (oraz do 35 Danych z celów opcjonalnych); Kredyty z pokojów działają wyłącznie w ramach bieżącego runu.
  - Odblokowanie kolejnej puli podstawowych schematów w warsztacie Miry.
- **Zmiany w kryjówce:**
  - Przy biurku Bajta aktywuje się boczny terminal łączności, z którego w przerwach między misjami odzywa się Nadia Korsak z raportami z Bulwaru.
  - Na tablicy przy peronie pojawiają się notatki o obławach na kurierów oraz zaznaczony sektor portu towarowego w Hutach.
- **Co misja otwiera dalej:**
  - Odblokowuje **Misję 03 — List przewozowy** w Magazynie 9 portu Hut.
  - Wprowadza Nadię Korsak jako stałego informatora Iskry na górnych poziomach pod korporacją.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Sektor `kurogane`, mapa wyboru ścieżki, motyw `neonStreet` i `hideout`, szablony pokojów (`alleyUnderpass`, `alleyBackstreet`, `alleyCrossing`, `combatCorridor`, `combatFloodedTunnel`, `combatPillars`, `combatPlatforms`, `combatYard`, `combatWarehouse`, `eliteCourtyard`, `restRoom`, `shopRoom`, `noodleShop`).
  - Wrogowie: `assaulter`, `gunner`, `turret` oraz elita `executor`.
- **Nowe elementy potrzebne dla Misji 02:**
  - Obiekty interaktywne **kontener-cela (x3)** z krótkim czasem otwierania i wyzwalaczem fali pościgu po odblokowaniu.
  - Prosta logika eskorty NPC (Nadia i grupa kurierów) w obrębie Warstw 6–7: poruszanie się do punktu osłony po oczyszczeniu zagrożenia, pasek zdrowia Nadii (warunek porażki) oraz bezpieczny punkt zborny przy przejściu do Warstwy 7.
  - Obiekt fabularny **stanowisko skanera Helixa** z opcjonalną interakcją pobrania dysku.
  - Aktualizacja kryjówki `hideout`: dialogi/komunikaty radiowe Nadii przy biurku Bajta.
- **Propozycje do backlogu (poza minimum F5):**
  - Wyróżnienie wizualne cywilnych kurierów (robocze kurtki z odblaskami bez czerwonych oznaczeń) oraz animacje wybiegania z kontenerów.
