# Misja 10 — Archiwum

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| II | Helixa Dynamics | Taras, wieża badawcza | Kradzież i zniszczenie | Noc (bez twardego limitu; fale pościgowe podczas pobierania danych i po zniszczeniu serwera) | Po Misji 09 (Brat); odblokowuje Misję 11 (Nadajnik) |

## W skrócie

Doktor Helena Wolan wskazuje stary, odcięty od sieci serwer w wieży badawczej Helixa Dynamics na Tarasie, gdzie leżą pierwotne obliczenia metody kopiowania wzorca potrzebne do bezpiecznego rozstrojenia Akordu Tymona. Kurier po raz pierwszy wchodzi na czysty, wyżej położony poziom Tarasu, przebija się przez snajperów i wieżyczki do archiwum, zgrywa dane i niszczy rdzeń serwerowy zgodnie z naleganiem Wolan. W trakcie transferu Bajt odczytuje na otwartym kanale nazwisko głównej autorki protokołu — doktor Heleny Wolan — co dociera wprost do Szrona.

## Tło fabularne

Po pojmaniu Tymona w Misji 09 Iskra stoi przed bezpośrednim ograniczeniem czasowym: dopóki Ida podtrzymuje jego implant swoim wzorcem, Tymon nie rozstraja się jak mieszkańcy bloku kwarantanny, ale żadne z nich nie wytrzyma takiego obciążenia w nieskończoność. Potrzebny jest sposób na trwałe rozstrojenie i wyłączenie Akordu bez uszkodzenia układu nerwowego użytkownika.

Wolan zwraca się do Szrona z precyzyjnym planem: w starej wieży badawczej na skraju kampusu Helixa na Tarasie stoi odizolowane archiwum sprzed piętnastu lat, odpięte od głównej sieci korporacyjnej po przeniesieniu produkcji do nowego zakładu. Znajduje się tam pierwotna dokumentacja matematyczna kopiowania wzorca. Wolan podkreśla dwa warunki: dane trzeba skopiować na przenośny nośnik, a sam serwer fizycznie zniszczyć, by Helixa nie sięgnęła po wczesne warianty obejść zabezpieczeń.

Szron zatwierdza pierwsze wyjście Iskry powyżej estakad Bulwaru, na poziom Tarasu. Ani on, ani Bajt, ani Kurier nie wiedzą jeszcze, że Wolan nie tylko zna archiwum z dawnej pracy w laboratorium — to ona przed piętnastu laty stworzyła ten protokół jako jednorazową terapię z udziałem ochotnika i odeszła dopiero wtedy, gdy firma zaczęła utrzymywać stałych dawców w aparaturze.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Przedostać się z windy towarowej przez zewnętrzny pasaż Tarasu do starej wieży badawczej Helixa Dynamics.
  - Otworzyć odciętą od sieci serwerownię archiwum na wyższym poziomie wieży.
  - Podpiąć nośnik Bajta do głównego rdzenia archiwum i utrzymać salę do zakończenia pobierania danych.
  - Fizycznie zniszczyć rdzeń serwera po zakończeniu transferu i ewakuować się szybem technicznym w dół.
- **Warunki porażki:**
  - Śmierć Kuriera (powrót do kryjówki z zachowaniem postępu i powtórka misji).
  - Przerwanie pobierania nie kończy misji porażką, ale cofa postęp transferu do ostatniego progu kontrolnego i wymaga ponownej obrony serwera.
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Wyłączenie przekaźnika snajperskiego na pasażu pod kopułą* (krótka interakcja przy panelu łączności w Warstwie 2, osłabiająca koordynację snajperów na dalszych piętrach) — nagroda: +20 Danych (propozycja do strojenia).
  - *Zabezpieczenie fizycznej kasety rezerwowej z bocznej szafy archiwum* (przed zniszczeniem głównego rdzenia w Warstwie 6) — nagroda: +20 Danych i +1 Rdzeń (propozycja do strojenia).

## Mapa

- **Miejsce i nastrój:** Zewnętrzny pasaż oraz stara wieża badawcza na kampusie Helixa Dynamics na poziomie Tarasu, motyw `neonStreet` (noc, deszcz spływający z szklanych kopuł ogrodowych do stalowych rynien — tu woda nigdy nie stoi w kałużach tak jak w Niecce). Otoczenie ciemne, sterylne i chłodne; wyczyszczony beton, szkło i stal zamiast rdzy Hut. Neony wyłącznie z palety ADR 0006: **ciepła biel** na krawędziach mostków i korytarzy laboratoryjnych, **błękit królewski** oznaczeń kampusu Helixa, **zieleń** przy kopułach botanicznych i wyjściach ewakuacyjnych, pojedyncze akcenty w **fiolecie** i **bursztynie** na panelach archiwalnych. Kontrastem są **czerwone** wiązki celowników snajperskich, **czerwone** wizjery ochrony i wieżyczek, **cyanowe** ostrze plazmowe gracza oraz **magentowe** wyładowania Rezonansu.
- **Struktura sektora:** Run liczy **7 warstw** na mapie wyboru ścieżki (propozycja do strojenia), z trzema stałymi węzłami fabularnymi w drugiej połowie wieży:
  - **Warstwa 1 (Mostek wejściowy):** wariant `combatPlatforms` przy wylocie windy technicznej z Bulwaru. Czysta kładka nad przepaścią między poziomami, nocny wiatr i pierwsze światła kopuł Tarasu.
  - **Warstwa 2 (Ogrody pod kopułą i pasaż):** wybór między przeszklonym pasażem z wysuniętymi stanowiskami strzeleckimi (`alleyCrossing`) a boczną halą techniczną z kolumnami (`combatPillars`). Tu po raz pierwszy na tym poziomie pojawiają się dalekosiężne wiązki snajperów Helixa.
  - **Warstwa 3 (Zaplecze techniczne wieży):** wybór między cichą stacją filtrów (`restRoom`) a zautomatyzowanym automatem zaopatrzenia technicznego na tyłach laboratorium (`shopRoom`).
  - **Warstwa 4 (Korytarze wieży archiwalnej):** wybór między pasażem z barierami laserowymi (`combatLaserYard`) a piętrowym korytarzem badawczym (`combatCorridor`) bronionym przez wieżyczki na sufitach.
  - **Warstwa 5 (Przedpole serwerowni — stały pokój fabularny):** wariant `eliteHall` przerobiony na dwupoziomową galerię przeładunkową danych. Na górnym balkonie rozstawieni są snajperzy osłaniający wejście do archiwum oraz dwie krzyżujące ogień wieżyczki przy drzwiach głównych.
  - **Warstwa 6 (Stare Archiwum Badawcze — stały pokój fabularny):** wariant `combatSubstation` lub większy `eliteHall` z rzędami piętnastoletnich szaf serwerowych i centralnym rdzeniem chłodzonym cieczą. Tu zachodzi dwuetapowy finał: obrona pokoju w trakcie pobierania danych oraz fizyczne zniszczenie rdzenia po komunikacie Bajta.
  - **Warstwa 7 (Szyb ewakuacyjny wieży — stały pokój fabularny):** wariant `rooftopRest` / `combatPlatforms` na zewnętrznej kładce serwisowej piętra. Po zniszczeniu archiwum Kurier przebija się przez ostatnią blokadę snajperów i zjeżdża szybem technicznym z powrotem na niższe poziomy.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Główny rdzeń archiwum (Warstwa 6):** podpięcie nośnika Bajta trwa ok. 2 s, samo pobieranie ok. 30 s w dwóch fazach (po połowie następuje odczyt danych przez Bajta i dodatkowa fala ochrony). Po 100% transferu aktywuje się zniszczenie rdzenia — przecięcie przewodów zasilania ostrzem plazmowym albo założenie ładunku wybuchowego (ok. 3 s).
  - **Panel przekaźnika pod kopułą (Warstwa 2, opcjonalny):** wyłącza wsparcie naprowadzania snajperów na dolnych piętrach wieży.
  - **Szafa kasety rezerwowej (Warstwa 6, opcjonalna):** z boku sali archiwum, wymaga krótkiej interakcji przed detonacją serwera.
- **Wrogowie:**
  - Frakcja: **Helixa Dynamics** (gładkie pancerze z płyt, sterylne maski, czerwone wizjery i lasery).
  - Archetypy w Misji 10:
    - **Snajperzy (`sniper`):** rozstawieni na wyższych galeriach i mostkach Tarasu, wymuszający korzystanie z osłon, szybkiego doskoku oraz odbijania pocisków ostrzem plazmowym.
    - **Wieżyczki (`turret`):** stacjonarne stanowiska ogniowe w korytarzach wieży oraz na bokach serwerowni archiwum.
    - **Ochrona wieży:** `gunner`, `shielder` oraz elitarny dowódca ochrony obiektu w Warstwie 5 lub podczas drugiej fazy obrony archiwum (`executor` albo wzmocniony ochroniarz Helixa w pancerzu płytowym).
    - **Drony (`drone`):** patrolujące przestrzeń pod kopułą i szyb ewakuacyjny.
- **Zagrożenia środowiskowe:**
  - Długie linie strzału na kładkach i w przeszklonych halach Tarasu (snajperzy widoczni wcześniej po czerwonym promieniu celownika).
  - Bariery laserowe w korytarzach wieży (`combatLaserYard`) odcinające skróty do czasu zdjęcia zasilania.
  - Pęknięte przewody chłodzenia wokół rdzenia archiwum po rozpoczęciu jego niszczenia — w promieniu kilku metrów pojawia się krótki wybuch pary i spięcia elektrycznego.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Wolan przedstawia lokalizację starego archiwum na Tarasie i prosi o misję, tłumacząc, że bez pierwotnych równań kopiowania wzorca nie rozbroi Akordu Tymona bez wywołania rozstrojenia. Naciska na zniszczenie całego serwera zaraz po pobraniu plików. Szron z rezerwą ocenia ryzyko wejścia na Taras, ale nie ma lepszej opcji i wyznacza wejście szybem z krawędzi Bulwaru.
2. **Wyjście na Taras (Warstwy 1–2):** Kurier wyjeżdża na czyste mostki nad poziomem chmur i wchodzi pod szklane kopuły ogrodów. Już na pierwszym pasażu pojawiają się czerwone lasery snajperów Helixa z wyższych galerii.
3. **Korytarze wieży badawczej (Warstwy 3–5):** Cicha droga przez zautomatyzowane zaplecze techniczne zamienia się w ciężkie starcie na przedpolu serwerowni. Pod ostrzałem wieżyczek i snajperów z balkonu Kurier otwiera grodzie starego archiwum.
4. **Stare Archiwum Badawcze (Warstwa 6 — pobieranie):** Odpięty od sieci pokój jest chłodny, zakurzony jak na standardy Tarasu i pełen starszych szaf sprzed piętnastu lat. Kurier wpina nośnik Bajta do głównego rdzenia i odpiera ochronę wieży zbiegającą klatkami.
5. **Ujawnienie autorstwa na otwartym kanale:** W połowie transferu Bajt przegląda pierwsze rozkodowane nagłówki, żeby sprawdzić kompletność dokumentacji. Na wspólnym kanale radiowym odczytuje na głos nazwisko autorki protokołu bazowego: „doktor Helena Wolan”. Na linii zapada ciężka cisza. Szron żąda potwierdzenia; Wolan nie odpowiada wprost i naciska tylko, by Kurier natychmiast zniszczył serwer po zakończeniu zrzutu.
6. **Zniszczenie serwera i ewakuacja (Warstwy 6–7):** Gdy pasek dochodzi do końca, Kurier rozcina chłodzenie lub odpala ładunek na rdzeniu, niszcząc stare szafy archiwum. Przebija się przez szyb ewakuacyjny pod ogniem ostatnich snajperów i zjeżdża w dół do Niecki.
7. **Powrót na Kamienną (`hideout`):** Szron czeka na Wolan przy pustym stole bez innych świadków poza Bajtem, Mirą i Kurierem. Wolan przyznaje wszystko spokojnie i bez uników: piętnaście lat temu stworzyła metodę jako terapię urazów kory ruchowej z jednorazowym udziałem dawcy-ochotnika, a odeszła z Helixa, gdy zobaczyła stałe klatki z kamertonami. Nie powiedziała Iskrze ze strachu, że Szron nigdy nie dopuści jej do pracy. Szron nie wybacza zatajenia, ale zostawia ją w zespole — tylko ona rozumie te dane. Bajt na boku cicho pokazuje kopię całości, którą zachował na własnym dysku przed wysadzeniem serwera.

## Dialogi

### Odprawa (kryjówka)

**Wolan:** Bez bazowej dokumentacji mogę co najwyżej opóźniać rozstrojenie u Tymona o kolejne dni. Nie wyłączę tego z pamięci.
**Szron:** A w bazie z przychodni nie było żadnych schematów technicznych?
**Wolan:** Tylko instrukcje kalibracji gotowych sztuk. Wzór matematyczny leży w starym archiwum badawczym na skraju Tarasu. Dwadzieścia lat temu tam zaczynał cały dział neuroinżynierii, dziś budynek stoi prawie pusty.
**Bajt:** Sprawdziłem ruch sieciowy tej wieży. Zero połączeń wychodzących. Jeśli ten serwer tam jeszcze stoi, naprawdę jest całkowicie odcięty od głównego systemu Helixa.
**Szron:** Wejście na Taras to nie wypad do magazynu w Hutach. Tam są ich wieże, snajperzy i krótkie czasy reakcji.
**Wolan:** Wiem. Ale bez tych danych Ida będzie musiała trzymać Tymona swoim sygnałem aż do całkowitego wyczerpania.
**Mira:** Trzeba tam iść. Jeśli istnieje sposób, żeby zdjąć mu ten szajs z głowy bez zabicia go przy okazji, bierzemy go dziś w nocy.
**Wolan:** Jeszcze jedno. Po zgraniu plików serwer trzeba zniszczyć fizycznie. Rdzeń i dyski zapasowe.
**Szron:** Po co? Przecież sama mówisz, że nikt z niego nie korzysta.
**Wolan:** Jeśli zobaczą wyczyszczone dyski bez uszkodzeń, od razu zrozumieją, czego dokładnie szukamy. Zniszczony rdzeń wygląda jak zwykły sabotaż.
**Szron:** Niech będzie. Kurier, wchodzisz windą techniczną od strony krawędzi Bulwaru. Zgrywaj dane, pal rdzeń i wracaj tym samym szybem, zanim zamkną kopułę.

### W trakcie misji (radio)

**Wyjście na Taras (Warstwa 1):**
**Bajt:** Jesteś nad chmurami, Kurier. Nawet deszcz mają tu odprowadzany w stalowe rynny, ani jednej kałuży na betonie.
**Szron:** Nie daj się zwieść porządkowi. Przeszukaj najpierw krawędzie wyższych galerii, zanim wyjdziesz na otwarty mostek.

**Ogrody pod kopułą (pierwszy kontakt ze snajperami):**
**Szron:** Czerwona wiązka po przekątnej — snajper na piętrze pod kopułą. Jeśli słyszysz brzęczenie przed strzałem, zejdź z linii albo odbij pocisk ostrzem.
**Bajt:** Przy prawym filarze stoi lokalny przekaźnik naprowadzania. Jak go wyłączysz, zdejmiesz im część oczu na kładkach.

**Przedpole serwerowni (Warstwa 5):**
**Bajt:** Jesteś pod drzwiami starego archiwum. Na balkonie rozstawili podwójną obsadę snajperską i dwie wieżyczki przy śluzie.
**Szron:** Najpierw zdejmij wysokość, potem otwieraj drzwi. Tam za tobą nie ma dokąd się cofać.

**Archiwum (podpięcie i pobieranie danych):**
**Bajt:** Nośnik widzi rdzeń. Zaczynam kopiowanie... stare formaty sprzed piętnastu lat, ale ścieżki są czytelne.
**Wolan:** Trzymaj ich z dala od głównej szafy podczas zapisu. Jeśli uszkodzą dyski przed końcem transferu, wrócimy z niczym.

**Odczyt w połowie pobierania:**
**Bajt:** Dobra, przechodzi połowa paczki. Zgrywam od razu nagłówki protokołu pierwotnego, żeby sprawdzić kompletność...
**Bajt:** Chwila... kurwa. „Protokół K-0, jednostronny transfer wzorca kory ruchowej. Data zatwierdzenia: piętnaście lat wstecz. Główny autor projektu: doktor Helena Wolan.”
**Szron:** ...
**Szron:** Wolan. Potwierdź to.
**Wolan:** Kurier, jak tylko nośnik piknie, rozwal rdzeń chłodzenia.
**Szron:** Wolan, pytam drugi raz. Czyje nazwisko tam stoi?
**Wolan:** Zrób to, o co prosiłam. Porozmawiamy na stacji.

**Zniszczenie serwera i odwrót (Warstwy 6–7):**
**Bajt:** Transfer skończony, wyciągaj nośnik!
**Szron:** Pal rdzeń, Kurier, i wychodź na kładkę za szybem technicznym. Ochrona z niższych pięter już jedzie windą.
**Mira:** Szyb jest wolny od strony Bulwaru. Zjeżdżaj na dół, czekam przy wylocie.

### Po misji (kryjówka)

**Szron:** Zamknijcie przejście na peron. Zostają tylko ci, którzy byli na kanale.
**Mira:** Naprawdę to ty napisałaś?
**Wolan:** Tak. Piętnaście lat temu.
**Bajt:** Ja tylko przeczytałem nagłówek, ja nie...
**Szron:** Nie przepraszaj. *(do Wolan)* Piętnaście lat. A przy naszym stole siedzisz od...
**Wolan:** Wiem, od kiedy.
**Mira:** Miała to być terapia, tak? Jeden dawca, trzy dni i do domu.
**Wolan:** Tak.
**Mira:** A potem ktoś postawił klatki.
**Wolan:** Odeszłam tydzień po pierwszym stałym stanowisku.
**Szron:** Tydzień. I nikomu ani słowa.
**Wolan:** Nikomu.
**Szron:** Kazałaś spalić serwer, żeby spalić nazwisko.
**Wolan:** Tak. *(pauza)* Nie proszę, żebyś mi wierzył. Proszę, żeby ktoś policzył te równania. Nikt inny tego nie umie.
**Mira:** Jeśli zostajesz, zaczynasz od mojego brata. Gówno mnie obchodzi twoje sumienie.
**Wolan:** Zaczynam od Tymona.
**Szron:** Zostajesz w kąciku technicznym. Każdy raport najpierw u mnie i u Bajta.
**Wolan:** Zgoda.
**Bajt (cicho do Kuriera, gdy Szron odchodzi od stołu):** Tak między nami… zanim zgrałem to na dysk roboczy dla Wolan, zrobiłem drugą, zaszyfrowaną kopię u siebie. Na wszelki wypadek.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 120 Danych oraz 2 Rdzenie za ukończenie misji (plus do 40 Danych i +1 Rdzeń z celów dodatkowych).
  - Odblokowanie badań Wolan nad bezpiecznym rozstrojeniem Akordu (postęp fabularny prowadzący do zaprojektowania dysonansu w Akcie III).
- **Zmiany w kryjówce:**
  - **Wolan** pracuje odtąd samotnie w swoim kącie przy stole badawczym; inne postacie w bazie wyraźnie jej unikają i pojawiają się nowe kwestie o winie i współodpowiedzialności.
  - Szron i Mira rozmawiają z nią wyłącznie służbowo; Ida patrzy na nią uważnie z dystansu od strony beczki Tomasza.
  - Na biurku Bajta spoczywa bezpieczny nośnik z pełnym archiwum K-0.
- **Co misja otwiera dalej:**
  - Odblokowuje **Misję 11 — Nadajnik** (Iskra ma już komplet dowodów z Hut, kwarantanny i pierwotnych dokumentów Helixa — postanawia nadać je na ekranach Bulwaru, by pokazać miastu, czym naprawdę są bezpłatne przychodnie).
  - Zamyka główną tajemnicę Wolan w Akcie II i stawia Szrona w sytuacji bez dobrego wyjścia: musi współpracować z autorką projektu, który niszczy ludzi w mieście.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Szablony pokojów (`combatPlatforms`, `alleyCrossing`, `combatPillars`, `combatCorridor`, `combatLaserYard`, `eliteHall`, `combatSubstation`, `rooftopRest`, `restRoom`, `shopRoom`) i archetypy (`sniper`, `turret`, `gunner`, `shielder`, `drone`, `executor`).
  - Mechanika obrony terminala podczas pobierania (analogiczna do Misji 03, z przerwą narracyjną w połowie postępu na odczyt nazwiska Wolan).
- **Nowe elementy potrzebne dla Misji 10:**
  - Wariant oprawy Tarasu w obrębie `neonStreet` (czystsze tekstury szkła i stali, szklane kopuły, brak kałuż błota z Niecki, zachowana paleta ADR 0006).
  - Dwufazowy cel w Warstwie 6: najpierw obrona podczas pobierania danych z przerwą fabularną w 50%, następnie interakcja zniszczenia rdzenia serwera (ładunek lub rozcięcie ostrzem) uruchamiająca alarm ewakuacyjny.
  - Opcjonalny przekaźnik snajperski w Warstwie 2 wyłączający wspomaganie celowania w kolejnych pokojach.
- **Propozycje do backlogu:**
  - Dedykowany **Elitarny ochroniarz wieży Helixa** z ciężką tarczą i granatami-strzykawkami jako strażnik progu przed archiwum.
  - Wizualne rozróżnienie starego, zakurzonego sprzętu badawczego sprzed 15 lat od nowoczesnych laboratoriów Tarasu.
