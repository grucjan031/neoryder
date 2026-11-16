# Misja 09 — Brat

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| II | Kurogane Arms + Helixa Dynamics | Bulwar, plac z hologramami | Pojmanie żywcem | Późna noc (po unieruchomieniu celu obrona strefy przez 45–60 s do przyjazdu transportu) | Po Misji 08 (Kwarantanna); odblokowuje Misję 10 (Archiwum) |

## W skrócie

Kurogane Arms i Helixa Dynamics urządzają na placu z hologramami w Bulwarze zamknięty pokaz polowy możliwości Akordu dla potencjalnych nabywców, a w oddziale demonstracyjnym służy Tymon — brat Miry. Mira wymusza na Szronie nocne uderzenie, zanim kolejna partia Akordu podzieli los rozstrojonego bloku z kwarantanny. Kurier przebija się przez kordon na placu, pokonuje Tymona bez zadawania śmiertelnego ciosu, zakłada mu neutralizator i utrzymuje bramę załadunkową do przyjazdu furgonetki Miry.

## Tło fabularne

Rejestr wykradziony z przychodni w Misji 07 potwierdził, że Tymon jedenaście miesięcy temu podpisał kontrakt z Kurogane i przyjął darmowy Akord. Tragedia w odciętym bloku kwarantanny pokazała natomiast, że użytkownik Akordu nie może po prostu odłączyć się od sygnału swojego kamertonu — brak stabilizacji zamienia implant w śmiertelną pułapkę dla układu nerwowego.

Bajt wyłapuje z nocnego ruchu miejskiego rezerwację placu z hologramami na Bulwarze: zewnętrzna ochrona Kurogane zamyka kładki pod pozorem testów reklamowych, a Helixa przygotowuje pokaz polowy sprzętu dla przedstawicieli korporacyjnych działów bezpieczeństwa. W składzie oddziału pokazowego figuruje numer służbowy Tymona.

Szron uważa akcję za zbędne ryzyko dla całego zespołu: pojmanie jednego żołnierza na otwartym placu dwóch korporacji nie przybliża Iskry do źródła produkcji i zdradza obecność Rezonanta po stronie oporu. Mira nie ustępuje — grozi, że pojedzie na Bulwar bez wsparcia. Szron zezwala na operację pod warunkiem ostrej dyscypliny czasowej i powrotu przed świtem.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Dotrzeć przez zabezpieczone kładki Bulwaru na plac z hologramami, gdzie trwa pokaz Akordu.
  - Rozbić osłonę pokazową i zredukować zdrowie Tymona do progu obezwładnienia, **nie zabijając go**, a następnie założyć mu opaskę neutralizującą od Miry.
  - Utrzymać północną bramę załadunkową placu do przyjazdu furgonetki Miry (ok. 45–60 s obrony pozycji — propozycja do strojenia).
- **Warunki porażki:**
  - Śmierć Kuriera (powrót do kryjówki z zachowaniem postępu i powtórka misji).
  - Śmierć Tymona (zbyt silne obrażenia po przekroczeniu progu obezwładnienia lub brak założenia opaski w oknie czasowym, gdy implant zaczyna się przeciążać).
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Odcięcie wzmacniaczy projekcji na placu* (zniszczenie dwóch masztów holograficznych zakłócających łączność przed walką z Tymonem) — nagroda: +20 Danych (propozycja do strojenia).
  - *Ochrona cywilnych techników obsługi placu* (brak ofiar po stronie nieuzbrojonego personelu technicznego w bocznych budkach podczas strzelaniny) — nagroda: +20 Danych i +1 Rdzeń (propozycja do strojenia).

## Mapa

- **Miejsce i nastrój:** Reprezentacyjny plac handlowo-widowiskowy w wyższej części Bulwaru oraz przyległe estakady załadunkowe, motyw `neonStreet` (noc, deszcz zmywający asfalt pod wysokimi projektorami). Otoczenie ciemne i chłodne, ale rozświetlone pustą na noc zabudową komercyjną w palecie ADR 0006: wysokie słupy holograficzne i reklamy w **fiolecie**, **błękicie królewskim** i **ciepłej bieli**, barierki robocze w **bursztynie**, oznaczenia wyjść ewakuacyjnych w **zieleni**. Na placu ostro odcinają się **czerwone** pancerze Kurogane, **czerwone** wizjery obsługi Helixa oraz **czerwone** wyładowania sztucznego Rezonansu Tymona i jego oddziału — w wyraźnym kontraście do **cyanowego** ostrza plazmowego gracza i **magentowych** mocy Kuriera.
- **Struktura sektora:** Run liczy **7 warstw** na mapie wyboru ścieżki (propozycja do strojenia), z trzema stałymi węzłami fabularnymi w drugiej połowie trasy:
  - **Warstwa 1 (Punkt wysadzenia):** `alleyUnderpass` — podjazd pod estakadą dwie przecznice od placu. Tu Mira odstawia Kuriera z furgonetki i wraca na pozycję wyczekiwania.
  - **Warstwa 2 (Kładki nad aleją):** wybór między bezpośrednim przejściem przez patrol kordonu (`combatPlatforms`) a bocznym skrzyżowaniem pod trasą kolejki (`alleyCrossing`).
  - **Warstwa 3 (Zaplecze techniczne):** wybór między ukrytym sklepem z osprzętem w zamkniętym pasażu (`shopRoom`) a korytarzem zaopatrzeniowym ochrony (`combatCorridor`).
  - **Warstwa 4 (Przedpole placu):** wybór między halą kolumnową pod trybuną (`combatPillars`) a spokojniejszym pokojem technicznym z regeneracją (`restRoom`).
  - **Warstwa 5 (Strefa kontroli dostępu — stały pokój fabularny):** wariant `combatLaserYard` na bezpośrednim wejściu za ogrodzenie pokazu. Mieszany posterunek Kurogane i Helixa z barierami laserowymi oraz cywilnymi technikami oświetlenia w bocznej budce sterowniczej (niebiorącymi udziału w walce).
  - **Warstwa 6 (Plac z hologramami — walka z Tymonem, stały pokój fabularny):** główny pokój `plazaHolo`. Szeroki, piętrowy plac z makietami kontenerów jako osłonami testowymi, dwoma projektorami prezentacji na bokach oraz przeszkloną galerią obserwacyjną na drugim piętrze, skąd pokaz oglądają zaproszeni nabywcy. Tu stacjonuje oddział akordowców pod dowództwem Tymona.
  - **Warstwa 7 (Brama załadunkowa — obrona do przyjazdu furgonetki, stały pokój fabularny):** wariant `combatYard` przy północnym wylocie z `plazaHolo` (lub druga faza tego samego kompleksu). Otwarty podjazd towarowy, gdzie Kurier osłania unieruchomionego Tymona przed pościgiem obu korporacji aż do wjazdu furgonetki Miry przez bramę serwisową.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Projektory pokazowe na `plazaHolo` (x2, opcjonalne):** wyłączane interakcją lub zniszczone w walce — usuwają z placu migające siatki danych i skracają zasięg namierzania wsparcia.
  - **Obezwładnienie Tymona:** po zbiciu paska zdrowia Tymona do progu ok. 15% (propozycja do strojenia) elita przyklęka w przeciążeniu Akordu; Kurier ma ok. 10 s na podejście i założenie opaski neutralizującej (interakcja ok. 1,5 s).
  - **Północna brama załadunkowa (Warstwa 7):** punkt obrony strefy; zegar odjazdu spowalnia lub zatrzymuje się, jeśli wróg przejmie rampę tuż przy nieprzytomnym Tymonie.
- **Wrogowie:**
  - Połączone siły **Kurogane Arms** i **Helixa Dynamics**:
    - Kordon i osłona placu: `assaulter`, `gunner`, `shielder` (Kurogane), wsparcie medyczne Helixa z granatami-strzykawkami (wariant zastępczy: `gunner` / `hacker`) oraz drony obserwacyjne (`drone`).
    - **Akordowcy** (propozycja do backlogu: żołnierze z podstawowymi wersjami Akordu, wykonujący krótkie czerwone doskoki i lekkie pchnięcia; wariant zastępczy: szybki `assaulter` o podniesionej mobilności).
    - **Elita — Tymon:** uzbrojony w karabinek oraz wysokiej klasy wojskowy wariant Akordu. W walce korzysta z **czerwonych** kopii mocy Rezonansu: czerwonego pchnięcia odpychającego, szybkiego uniku z czerwoną smugą i rzutu elementami otoczenia. Chroni się za osłonami testowymi placu i przechodzi do kontrataku z bliska, gdy Kurier skraca dystans ostrzem plazmowym.
- **Zagrożenia środowiskowe:**
  - Osłony testowe na `plazaHolo` ulegają częściowemu zniszczeniu pod wpływem mocy Rezonansu i ciężkiego ognia, zmieniając układ linii strzału w trakcie pojedynku.
  - Przeszklona galeria obserwacyjna jest poza zasięgiem bezpośredniego wejścia gracza, ale automatyczne wieżyczki (`turret`) podwieszone pod jej krawędzią osłaniają plac podczas drugiej fazy.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Mira rzuca na stół wydruk z grafiku pokazów na Bulwarze i żąda natychmiastowego wyjścia po brata. Szron odmawia wejścia na otwarty teren dwóch korporacji, ale po krótkim, twardym spięciu ustępuje — stawia warunek: żadnych zbytecznych walk po drodze i szybka ewakuacja. Mira przekazuje Kurierowi opaskę neutralizującą, która ma wygasić implant Tymona bez rozrywania sygnału w głowie.
2. **Podejście pod plac (Warstwy 1–4):** Mira wysadza Kuriera dwie przecznice od placu i wjeżdża w boczną alejkę towarową. Kurier przechodzi przez zewnętrzne kładki Kurogane, zbierając po drodze wyposażenie albo omijając boczne patrole.
3. **Strefa kontroli dostępu (Warstwa 5):** Za barierami laserowymi obsługa techniczna w budkach sterowniczych nie bierze udziału w walce — wystarczy minąć posterunek ochrony i otworzyć grodzie serwisowe na plac główny.
4. **Pokaz Akordu na placu z hologramami (Warstwa 6):** Z głośników nad placem testowym płynie spokojny głos prezentacji handlowej: parametry refleksu, przewidywalny koszt jednostki, pełna kontrola w polu. Na środku stoją kontenery testowe i trzech akordowców wraz z Tymonem. Gdy Kurier wyskakuje na plac z magentowym wyładowaniem lub cyanowym ostrzem, prezentacja urywa się w pół zdania, a goście w przeszklonej galerii podnoszą alarm.
5. **Pojedynek i pojmanie Tymona:** Oddział osłaniający pada lub rozprasza się po placu. Tymon walczy twardo, używając czerwonych kopii tych samych ruchów, którymi operuje Kurier. Kiedy jego zdrowie spada do progu krytycznego i pada na jedno kolano, Kurier zamiast dobicia zakłada mu opaskę neutralizującą na kark. Tymon podnosi wzrok bez śladu skruchy i rzuca tylko krótkie „Nie prosiłem o ratunek”, zanim traci przytomność.
6. **Obrona bramy załadunkowej (Warstwa 7):** Kurier przenosi Tymona na rampę załadunkową przy północnym wyjściu. Przez niecałą minutę odpiera pościg ochrony Kurogane i Helixa z kładek bocznych, dopóki furgonetka Miry nie wyłamuje szlabanu od strony ulicy i nie zgarnia obu z placu.
7. **Powrót na Kamienną (`hideout`):** Tymon zostaje zamknięty w małym magazynie pod antresolą. W ostrej, krótkiej wymianie zdań z Mirą tłumaczy swój wybór bez przepraszania — spłacał rodzinny dług. Po rozmowie Wolan ostrzega, że sama opaska nie zatrzyma rozstrojenia na dłużej niż kilka godzin. Szron patrzy na Idę, która po dłuższej chwili wahania godzi się utrzymywać Tymona własnym wzorcem na odległość, żeby nie podzielił losu ludzi z kwarantanny.

## Dialogi

### Odprawa (kryjówka)

**Mira:** Jest na liście ochrony pokazu. Dzisiejsza noc, plac z hologramami w górnym Bulwarze.
**Szron:** To nie jest dyskusja. Wchodzisz między dwie korporacje naraz, przed zamkniętą galerią z zarządami i ochroną obu stron.
**Mira:** Widziałeś wczoraj, co zostało z tamtego bloku. Jeśli jego dawca padnie za tydzień albo za godzinę, nie będzie już kogo wyciągać.
**Szron:** Nie narażam ludzi na rzeź dla jednego żołnierza, który sam podpisał papier.
**Mira:** Jadę po niego dziś w nocy, kurwa. Z kanałem wsparcia albo bez niego. Furgonetka stoi zatankowana na rampie technicznej.
**Bajt:** Jeśli już tam wchodzimy… w kordonie zewnętrznym siedzą głównie ludzie Kurogane, a środek placu obsługuje mały zespół Helixa. Zdołam zagłuszyć ich kamerę wyjazdową na minutę, zanim zorientują się, że coś wjechało na podjazd.
**Szron:** Minuta to za mało, jeśli plac stanie na nogi.
**Mira:** Wystarczy, żeby wejść na bramę załadunkową i nie dać im czasu na ściągnięcie transporterów.
**Szron:** Dobra. Zrobimy to po mojemu, nie na ślepo. Bierzesz ten neutralizator od Wolan — ma zbić napięcie implantu bez całkowitego odcięcia.
**Wolan:** Opaska musi trafić na kark dopiero wtedy, kiedy przestanie stawiać opór. Jeśli uderzysz zbyt mocno po progu przeciążenia, uszkodzisz korę ruchową na stałe.
**Szron:** Słyszysz, Kurier? Żywego. Jeśli Tymon zginie na placu, nie ma po co wracać przez tę samą bramę.
**Mira:** Wysadzam cię dwie przecznice dalej. Złap go, zejdź na północną rampę i trzymaj drzwi, aż podjadę pod szlaban.

### W trakcie misji (radio)

**Punkt wysadzenia:**
**Mira:** Stoję w bocznej alei za magazynem warzyw. Stąd masz prostą drogę kładkami nad trasą kolejki.
**Bajt:** Przekaz zewnętrzny czysty. Na placu odpalili już pokazówkę, słychać ją aż z mikrofonów przy drodze.

**Zbliżenie do strefy kontroli (Warstwa 5):**
**Bajt:** Uwaga, w budkach przy wjeździe siedzą cywile od oświetlenia. Nie mają broni, nie wchodź im w okno, to nie ruszą przycisku alarmu.
**Szron:** Oczyść kordon przed barierą laserową i otwórz przejście techniczne.

**Wejście na plac z hologramami (`plazaHolo`):**
**Głośnik na placu (nagranie prezentacji):** *…stabilność reakcji przy obciążeniu powyżej stu czterdziestu procent normy, pełna wymienność podzespołu w warunkach polowych i przewidywalny koszt jednostkowy…*
**Bajt:** Cholernie świetna reklama. Trzech akordowców na środku placu, czwarty ma wyższą sygnaturę na barkach — to musi być Tymon.
**Mira:** To on. Stoi przy lewym kontenerze. Zbij najpierw jego osłonę, potem uważaj na siłę ciosów.

**W trakcie walki z Tymonem:**
**Wolan:** Uważaj na czerwone wyładowania. Jego układ kopiuje te same manewry, które zna z treningu na poligonie ochrony — pchnięcie i rzut na dystans.
**Szron:** Jeśli chcesz wyłączyć mu pole widzenia, zdejmij projektory po bokach placu.
**Mira:** Nie daj mu się zamknąć przy ścianie, Kurier. Ma krótszy czas reakcji niż zwykli ochroniarze.

**Obezwładnienie Tymona:**
**Wolan:** Puls spada, opór w obwodzie pękł! Teraz opaska — masz kilka sekund, zanim implant zacznie szarpać ciałem.
**Tymon (bezpośrednio na placu, oparty o kontener):** Nie prosiłem o ratunek.

**Obrona bramy załadunkowej (Warstwa 7):**
**Mira:** Wyjechałam z alei, wbijam się pod górkę. Minuta, jeśli nie zamkną kraty przed rampą!
**Bajt:** Z galerii zbiegła ochrona obu firm. Odciągnij ich od nieprzytomnego, dopóki furgonetka nie przejdzie przez bramę.
**Szron:** Trzydzieści sekund. Oszczędzaj energię na wejście od strony kładek.
**Mira:** Już wjeżdżam, kurwa! Ładuj go na pakę i wskakuj przez tylne drzwi, nie wyłączam silnika!

### Po misji (kryjówka)

**Tymon (z wnętrza zamkniętego magazynu pod antresolą):** Mocne zamki tu macie, kurwa. Jak na szczury z zalanego peronu.
**Mira:** Zamknij się i siedź na skrzyni.
**Tymon:** Po co mnie tu ściągnęłaś, do cholery? Miałem ciepłe łóżko w koszarach, pełną miskę i dwa lata spłaty do końca umowy.
**Mira:** Widziałam wczoraj pięćdziesiąt osób z takim samym drutem w głowie. Zdechnął im dawca i zaczęli rwać własnych sąsiadów na kawałki.
**Tymon:** Gówno mnie obchodzi, jak sobie pilnują sprzętu w laboratoriach. Mój egzemplarz działał czysto.
**Mira:** Działał? A skąd wziąłeś na spłatę długu po wypadku ojca, co? Z pensji kuriera?
**Tymon:** Wy macie ideały. Ja miałem ratę. Ktoś musiał ją zamknąć, zanim komornik z Kurogane wszedł na dół po ostatnie narzędzia z twojego warsztatu.
**Szron:** Wystarczy. Klucz od magazynu zostaje u mnie, Tymon nie wychodzi poza te drzwi.
**Wolan:** Szron… opaska tylko spowalnia rozstrojenie. Bez sygnału podtrzymującego jego Akord zacznie puszczać przed południem.
**Mira:** Masz jakąś inną aparaturę?
**Wolan:** Nie. Ale mamy w kryjówce kogoś, kto potrafi nadawać wzorzec bez maszyn.
**Ida:** Nie.
**Szron:** Ida, jeśli nie podtrzymasz go choćby do czasu, aż znajdziemy sposób na bezpieczne rozbrojenie tego złomu, stracimy go w tym pomieszczeniu.
**Ida:** On świeci na czerwono. Jak oni wszyscy tam w środku. Głowa boli od samego stania pod drzwiami.
**Mira:** Proszę. Tylko do czasu, aż znajdziemy wyjście z tego układu.
**Ida:** Dobrze. Ale drzwi zostają zamknięte. Nie chcę go widzieć przy ogniu.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 110 Danych oraz 2 Rdzenie za ukończenie misji (plus do 40 Danych i +1 Rdzeń za cele opcjonalne).
  - Odblokowanie dostępu do obserwacji zaawansowanych wariantów Akordu w zapisach Bajta.
- **Zmiany w kryjówce:**
  - **Tymon** trafia do zamkniętego magazynu pod antresolą; **Mira** przenosi swój stołek pod drzwi magazynu i spędza tam większość czasu między misjami.
  - **Ida** podchodzi okresowo pod ścianę magazynu, utrzymując w milczeniu sygnał stabilizujący; pojawia się u niej wyraźne zmęczenie i niechęć do rozmów o Tymonie.
  - Szron zaostrza dyscyplinę wokół wejść do kryjówki, komentując ryzyko wynikające z trzymania żołnierza Kurogane pod dachem Kamiennej.
- **Co misja otwiera dalej:**
  - Odblokowuje **Misję 10 — Archiwum** (Wolan wskazuje stary serwer badawczy na Tarasie jako jedyną drogę do znalezienia metody bezpiecznego rozstrojenia Akordu dla Tymona i reszty użytkowników).
  - Pogłębia osobisty ciężar kampanii: Iskra ma w bazie żywego akordowca wymagającego stałego podtrzymywania przez Idę, co wymusza pilne rozwiązanie problemu samego implantu.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Pokoje `plazaHolo`, `alleyUnderpass`, `alleyCrossing`, `combatPlatforms`, `combatCorridor`, `combatPillars`, `combatLaserYard`, `combatYard`, `restRoom`, `shopRoom`.
  - Archetypy `assaulter`, `gunner`, `shielder`, `drone`, `turret` oraz zestaw mocy Rezonansu gracza jako baza do lustrzanych ataków Tymona.
- **Nowe elementy potrzebne dla Misji 09:**
  - Mechanika **pojmania żywcem** na elicie Tymona: próg krytycznego zdrowia (ok. 15%) przełączający bossa/elitę w stan ogłuszenia bez natychmiastowej śmierci od ostatniego trafienia (ochrona przed przypadkowym zabiciem pojedynczym ciosem poniżej progu albo czytelny stan przełamania) + interakcja założenia neutralizatora w oknie czasowym.
  - Sekwencja obrony strefy na rampie w Warstwie 7 z licznikiem przyjazdu furgonetki (45–60 s) i przyjazdem pojazdu w finale pokoju.
  - Osobna logika ochrony cywilnych techników w Warstwie 5 (brak agresji wobec gracza, licznik celu dodatkowego).
- **Propozycje do backlogu:**
  - Dedykowany archetyp **Akordowca** (czerwone warianty dashu i pchnięcia Rezonansu) oraz pełny zestaw lustrzanych umiejętności dla elity **Tymona**.
  - W pełni reaktywna scena pokazowa na `plazaHolo` z dynamicznie niszczonymi osłonami testowymi.
