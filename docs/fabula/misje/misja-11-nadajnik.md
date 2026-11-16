# Misja 11 — Nadajnik

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| II | Orbis Grid (wsparcie ochrony Helixa) | Bulwar, dach z masztem telewizyjnym | Obrona (trzy węzły nadajnika) | Noc (ok. 10–12 min runu, w tym ok. 3,5 min samej transmisji — propozycja do strojenia) | Po Misji 10 (Archiwum); odblokowuje Misję 12 (Śluza) |

## W skrócie

Iskra postanawia ujawnić w miejskiej sieci dowody przeciwko Koalicji: listy przewozowe Brandta, nagrania z zakażonej kłamstwem strefy kwarantanny oraz dane Akordu z przychodni w Bulwarze. Kurier wchodzi nocą na stary dach z nieużywanym masztem telewizyjnym, uruchamia zestaw Bajta i broni trzech rozproszonych węzłów nadajnika przed dronami i snajperami Orbis Grid. Transmisja dochodzi do ekranów dzielnicy, ale pół godziny później Orbis przejmuje przekaz i przerabia go w całym mieście na dowód ataku terrorystycznego na przychodnię.

## Tło fabularne

Po odkryciu w archiwum na Tarasie (Misja 10) w kryjówce panuje chłodne milczenie wokół Heleny Wolan. Szron nadal nie ufa jej motywom, ale nie usuwa jej z zespołu, bo tylko ona rozumie mechanizm kopiowania wzorca. Tymon siedzi pod zamknięciem w magazynie pod antresolą, a Mira pilnuje zmiany opatrunków i godzin dostrojenia u Idy.

W Bulwarze nadal działają bezpłatne przychodnie Helixa. Kolejki stoją od świtu, bo nikt poza Iskrą nie wie, co naprawdę dzieje się w Zakładzie Kalibracji i skąd wzięli się rozstrojeni w zablokowanym bloku mieszkalnym. Nadia Korsak odnajduje nad targiem stary miejski maszt telewizyjny, wyłączony z głównego obiegu po uruchomieniu Masztu Orbis, ale fizycznie nadal spięty z lokalnymi ekranami reklamowymi dzielnicy.

Kurier i Iskra wiedzą już o roli Kurogane w łapankach i o metodzie Helixa. Nie wiedzą jeszcze, że Orbis Grid skupuje całą produkcję Akordu do projektu „Chór”, ani dlaczego sieć informacyjna miasta reaguje z tak chirurgiczną precyzją. W tej misji Orbis po raz pierwszy wychodzi z cienia kamer i odpowiada bezpośrednio — najpierw w powietrzu nad dachem, potem na każdym holoekranie Bulwaru.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Dotrzeć na dach z masztem telewizyjnym nad Bulwarem i aktywować główną konsolę nadajnika przygotowaną przez Bajta.
  - Utrzymać transmisję do osiągnięcia 100% przesyłu paczki danych, broniąc trzech zewnętrznych węzłów (Północnego, Wschodniego i Zachodniego) przed atakami dronów, dronów-hakerów i oddziałów zrzutowych.
  - Naprawiać uszkodzone lub zhakowane węzły krótką interakcją przy skrzynce (ok. 2 s przytrzymania — propozycja do strojenia); gdy wszystkie trzy węzły stoją, przesył biegnie z pełną prędkością, przy jednym aktywnym zwalnia o 60%.
  - Po zakończeniu nadawania zejść z dachu pasażem technicznym na dolny plac Bulwaru i dotrzeć do zejścia kanalizacyjnego.
- **Warunki porażki:**
  - Śmierć Kuriera.
  - Spadek integralności głównego masztu do 0% wskutek jednoczesnego przeciążenia wszystkich trzech węzłów utrzymującego się przez ponad 20 s (propozycja do strojenia).
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Obejście lokalnego bufora reklamowego przed startem transmisji* (krótka interakcja przy skrzynce kablowej w warstwie 3 wydłuża czysty czas nadawania o 15 s przed pierwszą falą — propozycja do strojenia) — nagroda: +20 Danych.
  - *Utrzymanie co najmniej dwóch węzłów aktywnych przez całą transmisję* (ani razu nie spadną dwa naraz) — nagroda: +1 Rdzeń.

## Mapa

- **Miejsce i nastrój:** Dachy nad poziomem handlowym Bulwaru oraz pasaż z ekranami w drodze powrotnej, motyw `neonStreet` (noc, ciągły deszcz bębniący o blachę kanałów wentylacyjnych, podmuchy wiatru między wieżami). Otoczenie ciemne i chłodne, odcięte od gęstej mgły Niecki blaskiem reklam z sąsiednich estakad. Paleta ADR 0006: **błękit królewski** i **fiolet** z wysokich pylonów reklamowych otaczających dach, **bursztynowe** światła ostrzegawcze lądowisk i krawędzi dachów, **zielone** diody skrzynek transmisyjnych, **ciepła biel** reflektorów na klatkach schodowych. Na tym tle wyraźnie odcinają się **czerwone** wiązki snajperów, drony i pancerze Orbis, **cyanowe** ostrze plazmowe gracza oraz **magentowy** Rezonans.
- **Struktura sektora:** Run liczy **7 warstw** na mapie wyboru ścieżki (propozycja do strojenia), w tym 3 stałe pokoje fabularne:
  - **Warstwa 1 (Wejście):** punkt startowy oparty na `rooftopRest` — wyjście z klatki technicznej nad zapleczem targu, skąd Nadia wypatrzyła drogę na górę.
  - **Warstwa 2 (Podejście):** wybór między walką na kładkach między budynkami (`combatPlatforms`) a cichym punktem wymiany na strychu u zaprzyjaźnionego kuriera (`shopRoom`).
  - **Warstwa 3 (Przedpole dachu — stały pokój fabularny):** wariant `combatLaserYard` na szerokim łączniku między blokami. Czujniki ruchu i pierwszy patrol zwiadowczy Orbis; tutaj stoi skrzynka bufora reklamowego do opcjonalnego przejęcia.
  - **Warstwa 4 (Zaplecze techniczne):** wybór między gęstą zabudową central wentylacyjnych (`combatPillars`) a spokojną maszynownią wind (`restRoom`).
  - **Warstwa 5 (Dach z masztem telewizyjnym — stały pokój fabularny, arena obrony):** rozbudowana arena łącząca cechy `rooftopRest` i `combatPlatforms`. Na środku wznosi się stara kratownica masztu z konsolą Bajta, a wokół niej na trzech osobnych podestach stoją Węzeł Północny (przy niskiej kładce), Węzeł Wschodni (za rzędem agregatów chłodniczych) i Węzeł Zachodni (pod wygaszonym ekranem wielkoformatowym).
  - **Warstwa 6 (Zejście po transmisji):** wybór między zbiegiem przez korytarz serwisowy pod ostrzałem pościgu (`combatCorridor`) a krótkim oddechem w pustej rozdzielni (`restRoom`).
  - **Warstwa 7 (Plac z ekranem i ewakuacja — stały pokój fabularny):** wariant `plazaHolo` na dolnym pasażu Bulwaru. Mija pół godziny od zejścia z dachu. Plac jest prawie pusty w deszczu, nad głową świeci wielki holoekran dzielnicy, a przy kracie zejścia do kanału stoi mniejszy terminal komunikacyjny.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Konsola główna masztu:** podpięty wcześniej przez Bajta wzmacniacz z paczką dowodów; uruchomienie zajmuje ok. 2 s i rozpoczyna transmisję.
  - **Trzy węzły transmisyjne:** rozstawione w odległości 18–25 m od środka (propozycja do strojenia), żeby wymusić ciągły ruch po dachu zamiast statycznej obrony jednego miejsca. Wyłączony węzeł zmienia diodę z zielonej na czerwoną i wymaga 2 s naprawy ręcznej.
  - **Osłony dachowe:** klimatyzatory, stalowe parapety i skrzynki kablowe chroniące przed linią strzału snajperów z sąsiednich gzymsów.
  - **Krata kanału zrzutowego (`plazaHolo`):** wyjście z sektora po obejrzeniu zmienionego przekazu.
- **Wrogowie:**
  - Frakcja: **Orbis Grid** (smukłe sylwetki w ciemnych, matowych pancerzach z czerwonymi wizjerami, nacisk na dystans, drony i zakłócanie) oraz lokalne wsparcie ochrony Helixa z przychodni.
  - Archetypy w Misji 11:
    - **Dron (`drone`):** atakuje z powietrza bezpośrednio węzły i spycha gracza z kładek.
    - **Dron-haker (`hacker`):** kluczowy przeciwnik misji; podlatuje do aktywnego węzła i z dystansu uruchamia wiązkę zakłócającą, która w kilka sekund wyłącza przekaźnik.
    - **Snajper (`sniper`):** rozstawia się na podwyższonych gzymsach po zewnętrznej stronie dachu, oznaczony czerwonym promieniem celownika.
    - **Strzelec (`gunner`) i Szturmowiec (`assaulter`):** desant ze śmigłowców lub klatek schodowych w drugiej połowie transmisji.
  - Propozycja do backlogu: *operator zakłóceń Orbis* (piechur stawiający tymczasowe strefy tłumienia sygnału przy węzłach; wariant zastępczy: `hacker` w asyście `gunner`).
- **Zagrożenia środowiskowe:**
  - Brak barierek na części krawędzi dachu w warstwie 2 i 5 — mocne Pchnięcie lub nieuwaga przy dashu może zrzucić wroga (albo zmusić gracza do szybkiej korekty skokiem).
  - Ruchome bariery czujników w warstwie 3, wzywające dodatkowego drona po przecięciu wiązki.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Szron zbiera zespół przy tablicy misji; Wolan stoi kilka kroków z boku i nie wtrąca się do planu. Nadia łączy się przez radio przy biurku Bajta i potwierdza ślepą strefę nad starym masztem telewizyjnym. Bajt przygotował wzmacniacz i zmontował paczkę dowodów bez żadnych znaków wskazujących na Kamienną.
2. **Podejście przez dachy (Warstwy 1–4):** Kurier wychodzi nad targiem, mija czujniki na łączniku między blokami i dociera na główny dach. Bajt tłumaczy przez radio, że główny blok wpiął wcześniej, ale samo rozesłanie sygnału po pasmach wymaga otwarcia trzech węzłów na powierzchni.
3. **Obrona trzech węzłów (Warstwa 5):**
   - *0–35% przesyłu:* Węzły ruszają, okoliczne holoekrany Bulwaru gasną na sekundę i łapią sygnał Iskry. Pojawiają się pierwsze drony i para dronów-hakerów celujących w Węzeł Zachodni.
   - *35–70% przesyłu:* Orbis Grid przełącza obronę automatyczną na tryb alarmowy. Na gzymsach za dachem siadają snajperzy, a drony-hakerzy zaczynają atakować dwa przeciwległe węzły jednocześnie.
   - *70–100% przesyłu:* Na dach zjeżdża po linach oddział szturmowy z dodatkowymi dronami. Kurier krąży między podestami, zdejmując hakerów i stawiając węzły z powrotem na nogi, aż pasek przesyłu dochodzi do 100%.
4. **Zejście do Bulwaru (Warstwa 6):** Gdy transmisja dobiega końca, Bajt zrywa połączenie z masztem, żeby Orbis nie namierzył źródła zwrotnego, a Kurier zbiega schodami serwisowymi w głąb poziomu handlowego.
5. **Przejęcie przekazu na placu (Warstwa 7):** Pół godziny później Kurier wychodzi na pasaż `plazaHolo` w drodze do kanału powrotnego. Na wielkim ekranie nad placem zamiast raportu o skażeniu i listów Brandta leci płynny, profesjonalnie zmontowany serwis informacyjny: ujęcia płonącej kliniki, wyrwane z kontekstu kadry z Kurierem o cyanowym ostrzu i głos spikera ogłaszający zbrojny napad na darmową pomoc medyczną. Na małym ekranie przy zejściu do kanału zapala się krótki komunikat tekstowy z podpisem Wiktora Sarneckiego: *„Dziękujemy za materiał.”*
6. **Powrót na Kamienną (`hideout`):** Bajt jest rozbity szybkością i czystością kontrataku Orbis. Wolan zauważa spokojnie, że taki montaż musiał czekać gotowy w szablonach od tygodni. Szron zamyka etap ostrzegania miasta — skoro nie da się wygrać w eterze, następny ruch idzie prosto w Zakład Kalibracji pod Tarasem.

## Dialogi

### Odprawa (kryjówka)

**Szron:** Listy Brandta i nagrania z kwarantanny leżą u nas od tygodnia. Jeśli mają coś zmienić, Bulwar musi je zobaczyć przed następną zmianą w przychodniach.
**Bajt:** Maszt nad starym targiem stoi martwy od trzech lat, ale kable dalej wiszą na tych samych rozdzielnicach co połowa tablic reklamowych w dzielnicy.
**Nadia (radio):** Sprawdzałam klatki schodowe od strony makaroniarza. Klapa na dach ma zerwaną plombę, a patrole Helixy po ostatnich zamieszkach trzymają się parteru.
**Mira:** Na ile minut tam wchodzimy?
**Bajt:** Zrobiłem wczoraj obejście na głównej skrzynce, kiedy jeszcze było ciemno. Wystarczy spiąć trzy węzły na dachu i utrzymać pasmo przez niecałe cztery minuty.
**Szron:** Orbis nie puści takiego włamania w swoją sieć bez odpowiedzi. Spodziewaj się dronów i ludzi na gzymsach, zanim licznik dobije do połowy.
**Bajt:** Paczka ma trzy megabity czystego tekstu, skany z kwarantanny i wykaz transportów z portu. Zero naszych znaków, zero namiarów na Nieckę.
**Mira:** Sprawdziłeś dwa razy, czy nie zostały jakieś nagłówki z Kamiennej?
**Bajt:** Nie jestem na etacie pierwszy tydzień, Mira.
**Wolan:** Jeśli materiał przejdzie przez otwarte pasmo, Helixa zamknie przychodnie na jeden dzień albo dwie godziny, po czym zmieni nazwy programów.
**Szron:** Nie pytaliśmy o prognozę, doktor Wolan. Kurier, zbieraj sprzęt. Nadia poprowadzi cię do wejścia na dachy, potem kanał przejmuje Bajt.
**Nadia (radio):** Jak miniesz zielony szyld za kramami, skręć w wąskie schody w lewo. Daj znać, jak zobaczysz deszcz.

### W trakcie misji (radio)

**Wejście na dachy:**
**Nadia:** Czysto na zapleczu. Na dachu wieje od rzeki, trzymaj się nisko przy kominach wentylacyjnych.
**Bajt:** Łapię twój sygnał czysto. Przed tobą łącznik między blokami — pamiętaj, że Orbis wiesza tam własne czujniki ruchu pod reklamy.

**Opcjonalny bufor reklamowy (warstwa 3):**
**Bajt:** Widzisz tę skrzynkę pod fioletowym neonem? Jak zrzucisz z niej pamięć bufora, ich automaty w Centrali stracą kilkanaście sekund na rozruch.

**Wejście na dach z masztem (warstwa 5):**
**Bajt:** Jest. Stara kratownica na środku, trzy węzły rozstawione po krawędziach. Podłącz główną konsolę i nie odchodź daleko od kładek.
**Mira:** Jak któryś węzeł zgaśnie na czerwono, nie czekaj, aż spali pozostałe. Skocz do skrzynki i postaw go z powrotem.

**Start transmisji (0%):**
**Bajt:** Poszło. Ekrany nad targiem właśnie mignęły. Ludzie na dole patrzą w górę.
**Szron:** Dwadzieścia sekund spokoju i zacznie się nalot. Obserwuj skraj dachu.

**Pierwszy atak dronów-hakerów (ok. 35%):**
**Bajt:** Cholera, wykryli wpięcie! Dwa drony-hakerzy lecą prosto na Węzeł Zachodni — zdejmuj je pierwsze, inaczej odetną paczkę w locie.
**Szron:** Z prawej strony masz jeszcze snajperów na sąsiednim gzymsie. Nie stój w jednym miejscu przy skrzynkach.

**Środek transmisji (ok. 70%):**
**Bajt:** Siedemdziesiąt procent! Przepchnęliśmy już cały wykaz z Odlewni i nagrania z zablokowanego bloku.
**Mira:** Wytrzymaj jeszcze minutę, Kurier. Zbliża się desant z górnej śluzy, idą, skurwiele, wprost na środek dachu.
**Bajt:** Trzymam przepustowość na maksa, nie daj im położyć wszystkich trzech węzłów naraz!

**Koniec transmisji (100%):**
**Bajt:** Sto procent! Zamknąłem pętlę i spaliłem końcówkę na maszcie, żeby nie cofnęli śladu.
**Szron:** Dobra robota. Schodź z dachu w stronę dolnego pasażu, zanim zamkną klatki schodowe od dołu.

**Plac z ekranem (`plazaHolo`, pół godziny później):**
**Nadia:** Kurier... jesteś już pod ekranem na placu? Spójrz w górę.
**Bajt:** Co jest? Przecież u nas sygnał poszedł czysto, mam potwierdzenie z dwunastu węzłów.
**Nadia:** Patrzcie. To nie jest nasza taśma. Zrobili z tego napad na przychodnię. Wycięli płonące kontenery z Hut i podłożyli pod to ujęcia z ulicy.
**Bajt:** Pół godziny, kurwa... Przecież tyle trwa samo zgranie surowego pliku, nie montaż z lektorem!
**Szron:** Zostaw ekran. Przy kracie zejścia masz mały terminal, zaświecił się na czysto.
**Bajt:** To nie automat... Podpis systemowy z Korony. Wiktor Sarnecki. „Dziękujemy za materiał.”
**Szron:** Wracaj do kanału, Kurier. Nic tu po nas.

### Po misji (kryjówka)

**Bajt:** Zostawili z naszego materiału tylko jedną klatkę — dokładnie tę, gdzie na dachu błyska cyanowe ostrze. Resztę pocięli tak, że jutro połowa Bulwaru będzie zgłaszać każdego neorydera za samą sylwetkę.
**Mira:** To było, kurwa, bez sensu. Ryzykowaliśmy kanał i człowieka dla trzydziestu minut reklamy dla Orbis.
**Wolan:** Nie dla trzydziestu minut. Ten materiał był gotowy wcześniej, brakowało im tylko wiarygodnego sprawcy z ulicy. My dostarczyliśmy im twarz bez twarzy.
**Szron:** Wystarczy. Słyszeliście wszyscy. Nie wygramy z nimi na ekranach, bo ekrany należą do nich.
**Bajt:** I co teraz? Mamy udawać, że nic się nie stało?
**Szron:** Nie. Przestajemy pisać ulotki. Następny cel leży pod kampusem na Tarasie. Dopóki Zakład Kalibracji pracuje, będą produkować kolejne Akordy bez względu na to, co ludzie myślą na dole.
**Tomasz:** Herbata gotowa. Kurier, usiądź przy ogniu i odetchnij chwilę — noc jeszcze się nie skończyła.
**Szron:** Doktor Wolan, jutro po zmianie chcę mieć na stole wszystko, co pani pamięta z budowy pierwszego zakładu pod Tarasem.
**Wolan:** Rozumiem. Zajmę się tym od razu.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia):**
  - 95 Danych oraz 1 Rdzeń za ukończenie misji (plus do +20 Danych i +1 Rdzeń za cele opcjonalne).
  - Odblokowanie ulepszenia wykrywania lub szybszej interakcji przy terminalach w warsztacie Miry (opcjonalny schemat wsparcia).
- **Zmiany w kryjówce:**
  - Brak zmian przestrzennych na stacji Kamienna.
  - Na jednym z monitorów Bajta wyświetla się zatrzymana klatka ze zmienionej wiadomości Orbis; Nadia przez radio komentuje wzmożone kontrole w Bulwarze.
  - Rozmowy NPC przesuwają ciężar z ujawniania prawdy na konieczność bezpośredniego uderzenia w Zakład Kalibracji.
- **Co misja otwiera dalej:**
  - Odblokowuje **Misję 12 — Śluza** (zejście kanałami oczyszczalni pod kampus Helixa na Tarasie).
  - Wprowadza bezpośrednio **Wiktora Sarneckiego** i **Orbis Grid** jako aktywną siłę zarządzającą przekazem miasta.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Pętla runu z motywem `neonStreet`, szablony `rooftopRest`, `combatPlatforms`, `combatLaserYard`, `combatPillars`, `combatCorridor`, `plazaHolo`, `shopRoom`, `restRoom`.
  - Wrogowie `drone`, `hacker`, `sniper`, `gunner`, `assaulter`.
- **Nowe elementy potrzebne dla Misji 11:**
  - Mechanika wielopunktowej obrony w warstwie 5: trzy obiekty węzłów z niezależnym stanem (aktywny / zakłócony), postępem transmisji zależnym od liczby aktywnych węzłów oraz akcją ręcznej naprawy (2 s).
  - Priorytetowy skrypt AI dla `hacker` kierujący go ku aktywnym węzłom transmisyjnym zamiast samego gracza.
  - Sekwencja końcowa w `plazaHolo`: wyzwalacz odtwarzający na wielkim ekranie zmieniony przekaz oraz pojawienie się krótkiej wiadomości tekstowej Sarneckiego na terminalu przy wyjściu.
- **Propozycje do backlogu:**
  - Dedykowany przeciwnik Orbis stawiający strefy zagłuszania sygnału (obecnie zastąpiony przez `hacker` + `gunner`).
  - Dynamiczne reakcje ekranów w tle podczas trwania transmisji (migotanie reklam na budynkach w miarę wzrostu procentu przesyłu).
