# Misja 08 — Kwarantanna

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| II | Helixa Dynamics (+ Rozstrojeni) | Bulwar, blok w strefie | Przetrwanie i ewakuacja | Noc / przed świtem (bez twardego limitu; lokalne presje czasowe przy grupach cywilów) | Po Misji 07 (Nocny dyżur); odblokowuje Misję 09 (Brat) |

## W skrócie

Ida budzi się w kryjówce i słyszy w głowie krzyk z drugiej strony estakady na Bulwarze, gdzie Helixa Dynamics odcięła cały blok mieszkalny pod pretekstem skażenia chemicznego. W środku wszyscy użytkownicy jednej partii Akordu rozstroili się naraz po śmierci swojego kamertonu, a firma wysłała ekipę czyszczącą. Kurier wchodzi do strefy kwarantanny, odnajduje trzy grupy uwięzionych cywilów bez implantu i wyprowadza je do punktu ewakuacji między walczącymi ze sobą oddziałami Helixa a rozstrojonymi.

## Tło fabularne

Od Misji 04 Ida leżała nieprzytomna pod opieką doktor Heleny Wolan w kąciku łączności na stacji Kamienna. Przez cztery lata w aparaturze Zakładu Kalibracji była kamertonem K-112 i jej kora ruchowa wciąż reaguje na sygnały dostrajania w mieście. W nocy po włamaniu do przychodni Ida odzyskuje przytomność z jednym komunikatem: za estakadą w Bulwarze ktoś „krzyczał w środku głowy”, a potem nagle ucichł — i od tamtej chwili cały budynek nad nią stracił rytm.

Bajt sprawdza miejskie komunikaty awaryjne: sześć godzin wcześniej Helixa ogrodziła stary blok mieszkalny na granicy Bulwaru, ogłaszając wyciek chłodziwa z podstacji. Mieszkańcy wyższych pięter mieli otrzymać „pomoc medyczną” z tej samej bezpłatnej przychodni, którą Kurier odwiedził poprzedniej nocy. Gdy umarł dawca wzorca dla tamtej partii, każdy nosiciel skopiowanego Akordu w budynku stracił kontrolę nad ruchem i świadomością.

Helixa nie ratuje rozstrojonych — wysłała uzbrojoną ekipę czyszczącą w maskach filtrujących, żeby zamknąć piętra przed świtem. W blokadzie utknęły jednak rodziny i pracownicy nocnej zmiany, którzy nie podpisali kontraktu i nie mają Akordu. Gracz nie wie jeszcze, że za część tych reakcji odpowiada dawny projekt samej Wolan, a Mira — wciąż wstrząśnięta odkryciem umowy Tymona — dopiero w tej akcji widzi na własne oczy, co czeka każdego z takim wszczepem po śmierci jego kamertonu.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Wejść do odciętego bloku mieszkalnego na Bulwarze.
  - Odnaleźć trzy uwięzione grupy cywilów bez Akordu (w Skrzydle A, Skrzydle B i przy dziedzińcu rozładunkowym), odblokować im drogę i przeprowadzić bezpiecznym szybem lub przejściem do punktu ewakuacji.
  - Utrzymać punkt ewakuacji przy windzie towarowej na końcu sektora do momentu odjazdu wszystkich trzech grup.
- **Warunki porażki:**
  - Śmierć Kuriera (powrót do kryjówki z zachowaniem postępu i powtórka misji).
  - Śmierć całej grupy cywilów podczas próby wyprowadzenia (jeśli zginą wszyscy uratowani z danej grupy, punkt ewakuacji nie zostaje zaliczony).
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Wyprowadzenie wszystkich cywilów bez strat* (zero ofiar wśród cywilów we wszystkich trzech grupach) — nagroda: +25 Danych i +1 Rdzeń (propozycja do strojenia).
  - *Zabezpieczenie czytnika medycznego dowódcy ekipy czyszczącej* (krótka interakcja przy ciele dowódcy w Skrzydle C przed wejściem do windy) — nagroda: +20 Danych (propozycja do strojenia).

## Mapa

- **Miejsce i nastrój:** Zablokowany kordonem blok mieszkalny z lat powodziowych na obrzeżach Bulwaru, motyw `neonStreet` (noc, deszcz zacinający w wewnętrzną studnię podwórza, mokre betonowe galerie). Otoczenie ciemne i chłodne; neony ograniczone do palety ADR 0006: **bursztynowe** lampy ostrzegawcze na prowizorycznych bramkach kwarantanny, **ciepła biel** świetlówek na klatkach schodowych, **zielone** oznaczenia wyjść ewakuacyjnych, **fioletowe** i **błękitne** projekcje miejskiego komunikatu o „skażeniu chemicznym”. Na tym tle świecą **czerwone** wizjery ekipy czyszczącej Helixa oraz nieregularne, **czerwone** iskry wyładowań w implantach rozstrojonych, **cyanowe** ostrze plazmowe gracza i **magentowe** wyładowania Rezonansu.
- **Struktura sektora:** Run liczy **7 warstw** na mapie wyboru ścieżki (propozycja do strojenia), z czterema stałymi węzłami fabularnymi:
  - **Warstwa 1 (Kordon zewnętrzny):** wariant `alleyUnderpass` lub `alleyCrossing` — opuszczona rogatka z bursztynową taśmą kwarantanny i porzuconym wozem medycznym Helixa.
  - **Warstwa 2 (Parter bloku):** wybór między zapleczem zamkniętej apteki osiedlowej (`shopRoom` — punkt wymiany i zaopatrzenia) a zablokowanym holem głównym (`combatCorridor`), gdzie po raz pierwszy widać ślady walki między ekipą czyszczącą a rozstrojonymi.
  - **Warstwa 3 (Skrzydło A — Grupa 1 cywilów, stały pokój fabularny):** wariant `alleyBackstreet` lub `combatPillars` przerobiony na zagraconą pralnię i piwnicę techniczną. Trójka pracowników nocnej zmiany zabarykadowała się za ciężką kratą; po oczyszczeniu dojścia Kurier otwiera rygiel i kieruje ich w boczny szyb serwisowy prowadzący do punktu zbornego.
  - **Warstwa 4 (Łącznik i studnia podwórza):** wybór między starciem trzech stron na wewnętrznym dziedzińcu (`combatYard`) a krótkim odpoczynkiem w suchej maszynowni wentylacji (`restRoom`).
  - **Warstwa 5 (Skrzydło B — Grupa 2 cywilów, stały pokój fabularny):** wariant `combatPlatforms` (otwarte galerie drugiego piętra nad studnią bloku). Dwoje mieszkańców i pielęgniarka po dyżurze utknęli w mieszkaniu narożnym, gdy ekipa Helixa próbuje odciąć klatkę schodową aerozolem usypiającym, a z górnego poziomu zbiegają rozstrojeni.
  - **Warstwa 6 (Przewiązka techniczna):** wybór między korytarzem z mobilnymi barierami laserowymi (`combatLaserYard`) a cichszym przejściem konserwacyjnym (`restRoom`).
  - **Warstwa 7 (Dziedziniec rozładunkowy — Grupa 3 i punkt ewakuacji, stały pokój fabularny):** wariant `eliteHall` lub większy `combatYard` przy rampie towarowej bloku. Tu ukrywa się trzecia grupa cywilów (cztery osoby z parteru), dołączają też ocaleni z poprzednich skrzydeł prowadzeni bocznym korytarzem przez krótkie radio Nadii/Bajta. Ostatnia walka przed odblokowaniem windy zjazdowej.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Barykady i zamki śluz przy Grupach 1 i 2:** otwarcie wymaga ok. 2 s interakcji; dopóki trwa starcie tuż przy drzwiach, cywile nie wychodzą na linię ognia.
  - **Punkt zborny przy rampie (Warstwa 7):** winda towarowa Iskry (uruchamiana na czas ok. 25 s po zabezpieczeniu dziedzińca, by wszystkie trzy grupy zdążyły wejść do klatki zjazdowej).
  - **Terminale zwiadowcze przy drzwiach kwarantanny:** pokazują rozkład pomieszczeń na piętrze i obecność ludzi bez sygnatury Akordu.
- **Wrogowie:**
  - Dwie niezależne frakcje wrogie graczowi i **walczące także między sobą**:
    - **Ekipa czyszcząca Helixa Dynamics** (gładkie pancerze z płyt, sterylne maski z filtrami, czerwone wizjery): sanitariusze bojowi z granatami-strzykawkami (wariant zastępczy: `gunner`), strzelcy zaporowi (`shielder` / `gunner`) i stacjonarne wieżyczki (`turret`) na przewiązkach.
    - **Rozstrojeni** (nowa propozycja elitarnego i podstawowego wroga do backlogu): byli mieszkańcy z tanim Akordem z jednej partii. Czerwone, rwane błyski z implantu na skroni i dłoniach, szarpane ruchy, brak taktyki osłon — rzucają się na najbliższy cel, niezależnie od tego, czy to Kurier, czy oddział Helixa. Wariant zastępczy: zmodyfikowany `assaulter` o nieregularnym tempie ataku i wyższej agresji; silniejsze jednostki z tej grupy działają jako odpowiednik elity.
  - Cywile bez Akordu nigdy nie są celem ataku gracza; ogień sojuszniczy nie rani ocalonych.
- **Zagrożenia środowiskowe:**
  - Chmury aerozolu z granatów-strzykawek ekipy czyszczącej (ograniczają widoczność i spowalniają ruch przez kilka sekund).
  - Wąskie galerie na drugim piętrze (`combatPlatforms`) bez pełnych balustrad — nieostrożny ruch lub pchnięcie Rezonansu mogą zrzucić zarówno wrogów, jak i gracza o poziom niżej.
  - Mobilne bariery laserowe rozstawione przez Helixę w Warstwie 6 w celu odcięcia pięter.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Ida siedzi na krawędzi pryczy, wciąż osłabiona po czterech latach w aparaturze, i opisuje nagły krzyk zza estakady oraz ciszę, która po nim zapadła. Bajt nakłada na mapę Bulwaru strefę zamkniętą pod pretekstem skażenia chemicznego. Szron podejrzewa, że w środku zostali zwykli mieszkańcy bez implantów. Wolan mówi mało i unika spojrzenia Idy, potwierdzając jedynie, że uszkodzony wzorzec może wywołać reakcję łańcuchową w całej partii.
2. **Wejście w kordon (Warstwy 1–2):** Kurier omija rogatki na skraju Bulwaru i wchodzi na parter bloku. W korytarzach widać już skutki awarii: przewrócone barierki Helixa i pierwszych rozstrojonych atakujących zarówno ludzi w sterylnych maskach, jak i intruza.
3. **Skrzydło A — Pierwsza grupa (Warstwa 3):** Przez hałas wentylacji słychać wołanie z pralni. Kurier przeczekuje lub wykorzystuje starcie między oddziałem czyszczącym a dwoma rozstrojonymi, dobija niedobitki i otwiera kratę. Trójka pracowników rusza bocznym szybem w stronę rampy według wskazówek Bajta.
4. **Studnia podwórza (Warstwa 4):** Krótki oddech w maszynowni albo bezpośrednia walka na zalanym deszczem dziedzińcu, gdzie rozstrojeni rozrywają kordon Helixa.
5. **Skrzydło B — Druga grupa (Warstwa 5):** Na otwartych galeriach drugiego piętra pielęgniarka i dwoje lokatorów czekają za zabarykadowanymi drzwiami. Kurier zdejmuje blokadę pod ogniem sanitariuszy rzucających granaty-strzykawki i spycha rozstrojonych z pomostu. Druga grupa schodzi wewnętrzną klatką na poziom rampy.
6. **Przewiązka i Dziedziniec rozładunkowy (Warstwy 6–7):** Za barierami laserowymi czeka trzecia grupa cywilów przyciśnięta do zamkniętych rolet magazynu. Kurier czyści dziedziniec z ciężkiego patrolu Helixa i fali rozstrojonych, osłania wejście wszystkich trzech grup do windy towarowej i zjeżdża w dół razem z ostatnim kursem.
7. **Powrót na Kamienną (`hideout`):** Uratowani trafiają na zaplecze stacji, skąd rozchodzą się bezpiecznymi kanałami Niecki. W kryjówce Ida po raz pierwszy podchodzi o własnych siłach do ciepłej beczki Tomasza. Gdy pada pytanie o źródło sygnału, mówi cicho, że człowiek, który umarł tej nocy, leżał obok niej w sali Zakładu Kalibracji. Mira słucha tego w milczeniu — w głowie ma już datę z umowy Tymona.

## Dialogi

### Odprawa (kryjówka)

**Wolan:** Puls się wyrównał, ale powinnaś jeszcze siedzieć.
**Ida:** Nie chcę siedzieć. Za estakadą coś pękło.
**Szron:** Co dokładnie?
**Ida:** Ktoś krzyczał w środku głowy. Bardzo głośno, jakby darli drut z kości. Potem cisza. Od tamtej pory cały blok nade mną drży i nie trafia rękami w drzwi.
**Bajt:** Sześć godzin temu Helixa ogrodziła stary blok na granicy Bulwaru. W papierach wyciek chłodziwa z podstacji.
**Mira:** Kolejny, kurwa, „wyciek”.
**Szron:** Kto jest w środku?
**Bajt:** Ponad połowa lokatorów nie ma Akordu. Nocna zmiana z magazynów, rodziny. Helixa nikogo nie wypuszcza i właśnie wpuściła tam ekipę w maskach.
**Szron:** Wchodzisz przed świtem, Kurier. Szukasz ludzi bez wszczepów i prowadzisz do windy towarowej przy tylnej rampie.
**Tomasz:** Zostań tu, mała. Woda zaraz się zagotuje.
**Ida:** Nie nazywaj mnie tak. I nie gaś tego światła.
**Szron:** Kanał ustawiony. Nie mieszaj się między obie strony, jeśli same do siebie strzelają. Nam zależy na tych za drzwiami.

### W trakcie misji (radio)

**Wejście w strefę:**
**Bajt:** Jesteś przy bramce kwarantanny. Czujniki Helixa zgłaszają tu czyste powietrze — kłamstwo o wycieku jest tylko dla kamer z zewnątrz.
**Szron:** Z prawej masz parter i aptekę, wyżej zaczynają się skrzydła mieszkalne. Sprawdzaj terminale przy klatkach, wyłowią pokoje bez aktywnego sygnału Akordu.

**Pierwsze spotkanie z rozstrojonymi i ekipą Helixa:**
**Bajt:** Jasna cholera, zobacz na odczyty… w środku walczą dwie grupy naraz. Oddział Helixa próbuje uśpić własnych pacjentów.
**Wolan:** Ich implanty wysyłają śmieciowy impuls. Nie celują. Atakują każdy ruch, który pojawi się w polu widzenia.
**Mira:** Kurwa. Więc tak to wygląda, kiedy po drugiej stronie kabla ktoś przestaje oddychać.

**Skrzydło A (Grupa 1 cywilów):**
**Bajt:** Sygnał z pralni na lewo od korytarza. Trzy osoby, zero aktywnych implantów bojowych.
**Szron:** Wyczyść podejście przed kratą. Dopiero jak przestaną latać granaty, otwórz zamek i skieruj ich w szyb serwisowy.
**Ida:** Nie krzycz na nich. Od tych świateł na korytarzu nie słyszą własnych myśli.

**Skrzydło B (Grupa 2 cywilów):**
**Bajt:** Drugie piętro, narożne mieszkanie za otwartą galerią. Ekipa czyszcząca już odcina im klatkę gazem.
**Mira:** Zostaw sobie trochę miejsca za plecami na tych pomostach. Ktoś spadnie z balustrady i skończysz, kurwa, piętro niżej.
**Szron:** Szybko. Kobieta w środku ma kartę medyczną bez Akordu, otworzy reszcie drogę na schody.

**Dziedziniec rozładunkowy (Grupa 3 i ewakuacja):**
**Bajt:** Wszyscy z pierwszych dwóch skrzydeł schodzą szybem na dół. Trzecia grupa siedzi jeszcze przy zamkniętych roletach rampy.
**Szron:** Ostatni oddział Helixa stoi przed windą, a z górnych schodów zbiega kolejna fala rozstrojonych. Wyczyść plac i trzymaj drzwi windy, aż wejdzie ostatnia osoba.
**Bajt:** Klatka pełna, liny idą w ruch. Zjeżdżaj razem z nimi, Kurier.

### Po misji (kryjówka)

**Tomasz:** Zostawiłem im stare koce przy przejściu w stronę kanału wodnego. Przed patrolem porannym będą u swoich w Niecce.
**Szron:** Ilu wróciło?
**Bajt:** Wszyscy z trzech grup. W samym bloku zostało kilkadziesiąt ciał. Część wystrzelali ci skurwiele z Helixy, reszta powpadała przez barierki.
**Mira:** Dlaczego przestali wszyscy naraz?
**Wolan:** Przestało to, do czego byli podpięci.
**Mira:** Jeden człowiek umiera, a kilkaset osób na ulicy zaczyna rwać własne mięśnie.
**Wolan:** Tak.
**Ida:** Ten, który umarł… leżał obok mnie.
**Szron:** Ida?
**Ida:** Numer na białej ścianie. Pompa z lewej strony. Cztery lata cichy, a dziś przestał liczyć oddechy.
**Tomasz:** Masz jeszcze herbatę. Usiądź przy ogniu, stopy masz jak lód.
**Mira:** A ci, co jeszcze żyją w oddziałach Kurogane? Kto stroi ich?
**Szron:** Mira, nie ruszaj się z Kamiennej bez rozkazu. Najpierw musimy wiedzieć, skąd biorą te partie.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 100 Danych oraz 1 Rdzeń za ukończenie misji (plus do 20 Danych z celu pobocznego oraz +25 Danych i +1 Rdzeń za bezbłędną ewakuację wszystkich cywilów).
  - Wpis do bazy taktycznej Bajta o zachowaniu rozstrojonych oraz składzie aerozolu ekipy czyszczącej Helixa.
- **Zmiany w kryjówce:**
  - Łóżko z aparaturą w kąciku łączności stoi już puste; **Ida** chodzi po stacji Kamienna i siada przy ciepłej beczce razem ze Starym Tomaszem.
  - Rozmowy w bazie dotyczą tragedii w bloku i bezpieczeństwa kurierów noszących tani sprzęt z Bulwaru.
  - Mira zamyka się przy wagonie-warsztacie i szykuje sprzęt transportowy, nie kryjąc już napięcia wobec Szrona.
- **Co misja otwiera dalej:**
  - Odblokowuje **Misję 09 — Brat** (Mira wymusza natychmiastową akcję odbicia Tymona, wiedząc już, czym grozi dalsza zależność jego Akordu od nieznanego kamertonu).
  - Dostarcza Iskrze pierwszego bezpośredniego dowodu, że każda partia Akordu jest przywiązana do konkretnego, śmiertelnego człowieka w zakładach Helixa.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Szablony pokojów (`alleyUnderpass`, `alleyCrossing`, `alleyBackstreet`, `combatCorridor`, `combatPillars`, `combatYard`, `combatPlatforms`, `combatLaserYard`, `eliteHall`, `restRoom`, `shopRoom`) i pętla runu w sektorze Bulwaru.
  - Archetypy `gunner`, `shielder`, `turret` (jako tymczasowa obsada ekipy czyszczącej Helixa) oraz `assaulter` (jako tymczasowy wariant bazowy dla rozstrojonych).
- **Nowe elementy potrzebne dla Misji 08:**
  - Stałe pokoje fabularne z grupami cywilów w warstwach 3, 5 i 7 oraz bezpieczna logika ewakuacji (po otwarciu śluzy grupa cywilów przechodzi skrótem do punktu zbornego w Warstwie 7 zamiast biec przez środek walki między pokojami).
  - Relacja trójstronna w AI starć (frakcja `helixa` oraz frakcja `rozstrojeni` traktują siebie nawzajem jako wrogów obok gracza).
  - Ochrona cywilów przed obrażeniami z broni gracza i czytelne oznaczenie grup bez Akordu (ciepła biel / zieleń punktu ewakuacji zamiast wrogiej czerwieni).
- **Propozycje do backlogu:**
  - Dedykowany archetyp **Rozstrojonego** (rwana animacja, brak osłon, wyładowania czerwonego Rezonansu przy atakach wręcz, wariant elitarny z niekontrolowanym pchnięciem).
  - Dedykowany **Sanitariusz bojowy Helixa** z granatami-strzykawkami tworzącymi chmurę spowalniającą.
