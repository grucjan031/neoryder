# Misja 04 — Ładunek klasy K

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| I | Kurogane Arms | Huty, kolej towarowa i bocznice przeładunkowe | Eskorta (opancerzony wagon) | Noc (tempo wyznacza prędkość składu; postoje przy blokadach) | Po Misji 03 (List przewozowy); odblokowuje Misję 05 (Adiutant) |

## W skrócie

Dwie doby po zdobyciu listów przewozowych Mira przejmuje na starej rozrządni lokomotywę manewrową z doczepionym kontenerem chłodniczym klasy K i przekierowuje skład na boczne tory w stronę Niecki. Kurier osłania powoli jadący wagon przez kolejne odcinki torowiska, usuwając zapory, przestawiając zwrotnice i odpierając ataki oddziałów pościgowych, żeby transport utrzymał się na szynach do zjazdu technicznego. W finałowym starciu z Egzekutorem Brandta drzwi kontenera wyrywa od środka magentowy błysk — w aparaturze medycznej leży kobieta z kodem K-112, która pyta jedynie o godzinę.

## Tło fabularne

Dokumenty z Magazynu 9 wskazały dokładnie jeden nocny skład towarowy wywożący raz w tygodniu tajemniczy „ładunek biologiczny klasy K” do Zakładu Kalibracji Helixa na Tarasie. Zamiast przebijać się do pilnowanej windy towarowej pod wieżami korporacji, Iskra postanawia przechwycić wagon wcześniej — na płaskich bocznicach wschodnich Hut, zanim pociąg opuści poziom gruntu.

Mira spędza dzień na wpięciu zdalnego sterownika w przekaźniki rozrządowe starej lokomotywy manewrowej. Maszyna jest powolna, głośna i nie ma żadnego uzbrojenia, więc po przestawieniu pierwszej zwrotnicy cała ochrona sektora w ciągu minut orientuje się, że skład zjechał z rozkładowej trasy. Oskar Brandt wysyła za wagonem oddziały przechwytujące z rozkazem zatrzymania składu lub zniszczenia ciągnika przed zjazdem do tunelu.

Gracz nie wie jeszcze, kogo dokładnie wiezie w środku ani czym jest biała aparatura podłączona do pasażera. Nie wie także, że doktor Helena Wolan widziała ten sam układ przewodów piętnaście lat wcześniej w laboratoriach Helixa.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Eskortować wolno jadącą lokomotywę z wagonem i kontenerem klasy K przez kolejne odcinki bocznic kolejowych do tunelu zjazdowego.
  - Usuwać barykady na torach, wyłączać laserowe rogatki oraz przestawiać dwie zwrotnice w wyznaczonych punktach trasy.
  - Utrzymać wytrzymałość wagonu powyżej zera podczas ataków pościgowych i pokonać Egzekutora z oddziału Brandta na końcowym rozjeździe.
- **Warunki porażki:**
  - Śmierć Kuriera (powrót do kryjówki z zachowaniem stałego postępu i powtórka misji).
  - Zniszczenie wagonu lub rozbicie agregatu kontenera klasy K (wytrzymałość spada do 0).
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Czysta blacha* (wagon dociera na końcowy rozjazd z wytrzymałością powyżej 70% — propozycja do strojenia) — nagroda: +25 Danych.
  - *Szybki rozjazd* (obie zwrotnice awaryjne przestawione tak, aby skład nie stał przed zaporą dłużej niż 10 s łącznie — propozycja do strojenia) — nagroda: +15 Danych.

## Mapa

- **Miejsce i nastrój:** Złożona rozrządnia kolejowa na obrzeżach Hut, biegnąca w stronę nieczynnych tuneli technicznych Niecki, motyw `neonStreet` (noc, rzęsisty deszcz bębniący o dachy wagonów, iskry spod kół, ciężka para z chłodnic). Otoczenie ciemne i chłodne. Paleta ADR 0006: **bursztynowe** semafory na bramownicach, sygnalizatory zwrotnic w **zieleni**, numery torów malowane pod lampami w **ciepłej bieli**, dalekie świetlówki hal produkcyjnych i magazynów w **błękicie królewskim** i **fiolecie**. Na ciemnym torowisku jaskrawo świecą **czerwone** reflektory pościgowe i pancerze Kurogane, **cyanowe** ostrze Kuriera oraz **magentowy** wybuch Rezonansu z kontenera w finale.
- **Struktura sektora:** Run w sektorze `kurogane` liczy **7 warstw** ułożonych wzdłuż osi toru (stałe pokoje fabularne na torze głównym przeplatane krótkimi odejściami serwisowymi dla zwiadu, zaopatrzenia i zdjęcia blokad):
  - **Warstwa 1 (Nastawnia rozrządowa — start):** punkt wejścia na bazie `alleyUnderpass` przy rozjeździe głównym. Mira przestawia zwrotnicę, a lokomotywa wyciąga wagon na boczny tor.
  - **Warstwa 2 (Odcinek I — bocznica załadunkowa):** wybór między oczyszczeniem równoległego korytarza załadunkowego (`combatCorridor`) a szybkim dozbrojeniem w wagonie technicznym przemytników (`shopRoom`).
  - **Warstwa 3 (Pierwsza brama towarowa i rogatka — stały pokój fabularny):** obowiązkowy węzeł oparty na `combatLaserYard`. Zapora laserowa na szynach zatrzymuje skład; Kurier musi rozbić skrzynkę zasilającą z boku toru i przestawić pierwszą dźwignię zwrotnicy pod ostrzałem z kładek.
  - **Warstwa 4 (Przejście między torami):** wybór między krótką regeneracją w suchej budce dróżnika (`restRoom`) a oczyszczeniem sąsiedniej estakady (`combatPlatforms`), z której strzelcy ostrzeliwują pociąg.
  - **Warstwa 5 (Rozjazd wschodni — stały pokój fabularny):** obowiązkowy węzeł na bazie `combatYard`. Długa prosta toru z barykadą z wagoników technicznych; na skład nacierają Tarczownicy i Szturmowcy próbujący podłożyć ładunki pod podwozie, a Drony atakują agregat kontenera z góry.
  - **Warstwa 6 (Wiadukt przed zjazdem):** wybór między ostatnim zapleczem technicznym (`shopRoom` lub `restRoom`) a halą podtrzymującą wiadukt (`combatPillars`), gdzie czeka zwiad pościgowy.
  - **Warstwa 7 (Rozjazd zjazdowy — Finał — stały pokój fabularny):** zadaszony peron przy wlocie do tunelu technicznego na bazie `eliteCourtyard` lub `combatWarehouse`. Ciężka blokada toru i lądowisko pościgowe: wkracza **Egzekutor (`executor`)** z elitarnym oddziałem Brandta. Podczas kulminacji walki aparatura w kontenerze ulega przeciążeniu i z wnętrza uderza magentowy błysk, który wyrywa stalowe drzwi.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Wagon z kontenerem klasy K:** porusza się stałym tempem (ok. 3–4 m/s — do strojenia) wzdłuż wyznaczonej szyny; ma własny pasek wytrzymałości i zderzak, za którym Kurier może chwilowo osłonić się przed ogniem z przodu.
  - **Skrzynki rogatek i dźwignie zwrotnic (Warstwy 3 i 5):** wymagają ok. 2 s interakcji lub zniszczenia zamka blokady, zanim lokomotywa ruszy dalej.
  - **Kontener K-112 (Warstwa 7, po walce):** otwarte wyrwane wrota z osmalonymi krawędziami; wewnątrz biała kapsuła medyczna z kablami podpiętymi do młodej kobiety.
- **Wrogowie:**
  - Frakcja: **Kurogane Arms** (czerwone oznaczenia).
  - Archetypy w Misji 04:
    - **Szturmowiec (`assaulter`):** priorytetowo biegnie pod wagon, próbując uszkodzić podwozie lub agregat chłodniczy z bliska.
    - **Strzelec (`gunner`):** zajmuje rampy wzdłuż toru i prowadzi ogień ciągły w kadłub kontenera.
    - **Tarczownik (`shielder`):** blokuje podejście do dźwigni zwrotnic w Warstwach 3 i 5.
    - **Dron (`drone`):** krąży nad składem, atakując dach kontenera poza zasięgiem osłon bocznych.
    - **Wieżyczka (`turret`):** zamontowana na stałych słupach przy bramie laserowej w Warstwie 3.
    - **Egzekutor (`executor`, elita):** dowódca oddziału pościgowego Brandta w Warstwie 7, wspierany przez strzelców i drony.
- **Zagrożenia środowiskowe:**
  - Kable wysokiego napięcia i iskry wzdłuż zdewastowanych peronów w Warstwie 5.
  - Ograniczone pole manewru między poruszającym się wagonem a ścianami oporowymi torowiska (ryzyko zgniecenia lub odcięcia przez własną osłonę).

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Mira prezentuje zdalny moduł sterowania lokomotywą i uprzedza o niskiej prędkości składu. Szron wyznacza priorytety: najpierw tor i zwrotnice, potem pościg.
2. **Przejęcie składu (Warstwy 1–2):** Lokomotywa rusza z trzeciego toru rozrządni w ulewny deszcz. Pierwsze patrole orientują się po kilkudziesięciu sekundach, że wagon zmienił zwrotnicę.
3. **Brama towarowa i rogatka (Warstwa 3):** Zapora laserowa zatrzymuje pociąg. Kurier niszczy zasilanie bramki pod ogniem z kładek, przestawia pierwszą zwrotnicę i wraca na główny tor.
4. **Odcinek środkowy i Rozjazd wschodni (Warstwy 4–5):** Po przejściu obok estakady skład wpada na blokadę z wózków i atak skoordynowany z góry. Kurier odpiera napastników od agregatu kontenera i odblokowuje drugą zwrotnicę.
5. **Rozjazd zjazdowy i oddział Brandta (Warstwy 6–7):** Tuż przed tunelem prowadzącym w dół ku Niecce drogę zamyka grupa pościgowa Brandta z Egzekutorem na czele. Walka toczy się bezpośrednio przy wagonie. Gdy Egzekutor pada (lub w punkcie krytycznym starcia), wskaźniki chłodnicze na ścianie kontenera gasną, z wnętrza bije silny **magentowy** impuls Rezonansu i wyrywa stalowe drzwi z zawiasów.
6. **Odkrycie K-112:** W kłębach pary i białych przewodów leży nieprzytomna dotąd kobieta w aparaturze medycznej z wygrawerowanym kodem **K-112** na kołnierzu skrzyni. Na moment otwiera oczy, wypowiada cicho jedno pytanie („Która godzina?”) i traci przytomność.
7. **Powrót na Kamienną (`hideout`):** Skład wjeżdża w stary tunel techniczny; Mira i Tomasz pomagają przenieść kobietę na łóżko polowe w kąciku łączności. Doktor Helena Wolan podchodzi z torbą lekarską, rozpoznaje konstrukcję aparatury i zastyga nad nią na kilka sekund dłużej, zanim zaczyna odłączać zbędne przewody.

## Dialogi

### Odprawa (kryjówka)

**Mira:** Pociąg jest nasz, przynajmniej na papierze. Wpięłam przekaźnik w stary ciągnik spalinowy z drugiego peronu, idzie jak pierdolony wóz z węglem — dwanaście na godzinę, szybciej nie wyciągnie, bo się zagotuje.
**Szron:** Jeśli pojedzie wolniej, dogonią go pieszo. Jak szybko po rozjeździe zorientują się, że wagon zniknął z głównego toru?
**Bajt:** Daję nam dwie minuty, zanim dyspozytor zauważy brak sygnału na wadze przy śluzie. Potem Brandt rzuci wszystko, co stoi pod ręką na wschodzie Hut.
**Mira:** Na trasie są dwie ręczne zwrotnice i jedna rogatka z laserem. Z kabiny tego nie przełączę. Musisz biec przy wagonie i otwierać tor.
**Szron:** Wagon ma pancerz, ale agregat chłodniczy na dachu jest odsłonięty. Jeśli przestanie pracować, nie wiemy, co stanie się z ładunkiem w środku.
**Wolan:** Temperatura w tych skrzyniach nie służy do mrożenia tkanek, Szron. Przy czterystu kilogramach z własnym zasilaniem to może być układ podtrzymywania życia. Ostrożnie ze wstrząsami.
**Tomasz:** Brzmi, jakby w środku był ktoś żywy. Uważaj na zakręcie za estakadą, tam zawsze zwalniają przed mostem.
**Szron:** Doprowadź wagon do wlotu starego tunelu technicznego. Tam zamkniemy za wami kratę.

### W trakcie misji (radio)

**Start eskorty (Warstwa 1):**
**Mira:** Zwrotnica przerzucona, skład wyszedł na bocznicę. Uruchamiam hamulce manewrowe na minimum — pilnuj obu stron wagonu.
**Bajt:** Dyspozytornia już miga na czerwono. Zgłosili nieautoryzowany zjazd z toru numer trzy.

**Pierwsza rogatka laserowa (Warstwa 3):**
**Mira:** Stoję, kurwa! Rogatka na wprost zablokowała tory. Skrzynka zasilająca jest po prawej stronie wiaty, na słupie.
**Szron:** Zdejmij ogień z kładki, potem wyłącz zaporę i rwij dźwignię zwrotnicy. Nie zostawiaj wagonu bez osłony dłużej niż trzeba.

**Po odblokowaniu rogatki:**
**Mira:** Przeszliśmy. Chłodnica na dachu oberwała kilka razy, ale trzyma ciśnienie. Ruszamy dalej.

**Rozjazd wschodni — atak z dwóch stron (Warstwa 5):**
**Bajt:** Jasna cholera, z prawej wjeżdżają lekkie wozy pościgowe, z góry idą drony! Chcą zatrzymać agregat!
**Mira:** Szarpią za złączki pod podwoziem, skurwiele! Zdejmij szturmowców spod kół, zanim odczepią mi lokomotywę od platformy!
**Szron:** Użyj wagonu jako osłony przed ogniem z ramp i oczyść wózki na torze przed ciągnikiem.

**Wjazd na końcowy rozjazd i przybycie oddziału Brandta (Warstwa 7):**
**Bajt:** Przechwyciłem kanał kierowniczy Brandta! Na peronie przed tunelem zjazdowym wylądował jego oddział pościgowy — prowadzi ich Egzekutor!
**Szron:** To ostatni odcinek przed kratą. Jeśli zamkną ten wjazd, zostaniemy między halami. Rozbij obstawę i wyłącz Egzekutora.

**Przeciążenie aparatury — wybuch z wnętrza kontenera (kulminacja Warstwy 7):**
**Mira:** Co jest, kurwa?! Wskaźnik zasilania kontenera skoczył na maksa, w moim pulpicie wybiło bezpieczniki!
**Bajt:** Odsuń się od drzwi wagonu! Cały zapis napięcia... to nie jest zwarcie!
*(Magentowe wyładowanie Rezonansu wyrywa stalowe drzwi kontenera od środka.)*
**Szron:** Co tam się stało? Kurier, widzisz środek?
**Mira:** Drzwi leżą pięć metrów od toru... Kurwa, tam w środku naprawdę ktoś leży. W białej aparaturze.
**Ida *(słabo, z wnętrza kontenera)*:** ...Która godzina?
**Wolan *(cicho, po chwili milczenia na kanale)*:** To... młoda kobieta. Kod na kołnierzu: K-112. Nie ruszajcie głównych przewodów na karku, dopóki nie zjedziecie na dół.
**Szron:** Brama tunelu wolna. Wciągamy wagon na ślepy tor za kratą, Mira, ruszaj.

### Po misji (kryjówka)

*(Kącik łączności przy peronie B. Na łóżku polowym leży nieprzytomna Ida; obok stoi zdemontowana część białej aparatury z kontenera K-112.)*

**Mira:** Odłączyliśmy najcięższą ramę jeszcze w tunelu, resztę przytaszczyliśmy tutaj na wózku. Ma tętno równe, ale śpi jak pod mocnym znieczuleniem.
**Bajt:** Na blasze kontenera jest tylko numer serii: K-112 i stempel kontroli z Hut. Żadnego nazwiska, żadnej karty pacjenta.
**Tomasz:** Słyszałem przez przekaźnik. Wyrwała stalowe drzwi jednym ruchem, bez dotykania zamka. Takiego Rezonansu nie widziałem w Niecce od lat.
**Szron:** Doktor Wolan? To sprzęt z twojej starej firmy.
**Wolan *(patrzy na otwartą kasetę aparatury przez kilka sekund bez słowa)*:** ...Tak. To moduł stabilizacji korowej z późniejszych serii Helixa. Rzadko wyjeżdża poza Taras.
**Mira:** Wyglądasz, jakbyś widziała ten model wcześniej, niż go przywieźliśmy.
**Wolan:** Znam podstawowy układ elektrod z dawnych publikacji technicznych. Przekrój wiązki jest nietypowy — to nie miało jej leczyć, tylko utrzymywać w płytkim śnie i odczytywać wzorzec.
**Szron:** Odłączysz ją bezpiecznie?
**Wolan:** Zostawię ją tutaj, w kąciku łączności, żeby nie wozić po całym peronie. Obudzi się sama, kiedy zejdą leki z kroplówki. Nie wcześniej niż za kilka dni.
**Bajt:** Tymczasem na górze zrobiło się gorąco. Brandt zamknął wszystkie bramy sektorowe w Hutach i cofnął zdalne przepustki. Ktoś naprawdę bardzo nie chciał stracić tej pieprzonej paczki numer sto dwanaście.
**Szron:** Jeśli zamknął sieć z zewnątrz, to znaczy, że szuka naszego dojścia. Przygotujcie się — zanim otworzy się okno na Taras, musimy zobaczyć, co ma na serwerach w swojej bazie.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 110 Danych oraz 1 Rdzeń za ukończenie misji (oraz do 40 Danych z celów opcjonalnych); Kredyty z pokojów działają wyłącznie w ramach bieżącego runu.
  - Odblokowanie ulepszenia pojemności lub mocy Rezonansu w warsztacie Miry.
- **Zmiany w kryjówce:**
  - W kąciku łączności na stacji Kamienna pojawia się łóżko polowe z białą aparaturą i nieprzytomną Idą; doktor Helena Wolan przenosi tam część swojego stanowiska i obserwuje parametry pacjentki (pozostaje tam aż do Misji 08).
  - Na tablicy taktycznej przybywa adnotacja o zamknięciu Hut przez Brandta i kodzie K-112.
- **Co misja otwiera dalej:**
  - Odblokowuje **Misję 05 — Adiutant** (pościg za łączniczką Brandta przez dachy Hut w celu zdobycia fizycznej karty dostępu do sieci ochrony).
  - Wprowadza Idę jako kluczową postać dalszych aktów i zasiewa pierwszą subtelną wątpliwość wokół reakcji doktor Wolan na aparaturę.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Sektor `kurogane`, mapa wyboru ścieżki, szablony pokojów (`alleyUnderpass`, `combatCorridor`, `combatLaserYard`, `combatPlatforms`, `combatYard`, `combatPillars`, `eliteCourtyard`, `combatWarehouse`, `restRoom`, `shopRoom`).
  - Wrogowie: `assaulter`, `gunner`, `shielder`, `drone`, `turret`, `executor`.
- **Nowe elementy potrzebne dla Misji 04:**
  - Jednostka eskortowa **lokomotywa + wagon z kontenerem K-112**: ruch po szynie ze stałą prędkością, pasek wytrzymałości, zatrzymywanie się przed blokadą i automatyczne ruszanie po usunięciu przeszkody.
  - Interaktywne punkty na trasie: skrzynka zasilająca rogatki laserowej (Warstwa 3) oraz ręczne dźwignie zwrotnic (Warstwy 3 i 5).
  - Sekwencja skryptowa w Warstwie 7: magentowy impuls z wnętrza kontenera po kulminacji walki (efekt VFX wyłamania drzwi bez obrażeń dla gracza) i krótkie odsłonięcie postaci Idy.
  - Aktualizacja kryjówki `hideout`: łóżko z nieprzytomną Idą i stanowisko Wolan.
- **Propozycje do backlogu (poza minimum F5):**
  - Widoczne iskrzenie spod kół lokomotywy przy hamowaniu przed zaporami oraz licznik obrażeń na agregacie kontenera.
