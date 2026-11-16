# Misja 14 — Palacz

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| III (początek) | Orbis Grid + Kurogane Arms | Niecka i Huty, cztery punkty obserwacyjne | Zasadzka (kontrwywiad i przejęcie dowodu) | Noc przed świtem (ok. 12–15 min runu; w punktach obserwacyjnych krótkie okna czuwania) | Po Misji 13 (Kamerton); odblokowuje Misję 15 (Kamienna) |

## W skrócie

Bajt kończy łamanie zaszyfrowanego folderu „Palacz” z serwera Brandta i odkrywa, że od dziewięciu lat ktoś z kryjówki zgłaszał Kurogane samotnych Rezonantów — w tym Kuriera w noc prologu. Szron zastawia prostą pułapkę informacyjną na cztery osoby mające dostęp do tablicy misji, podając każdej inne miejsce rzekomego transportu kamertonów. Kurier pilnuje dwóch punktów w Niecce i Hutach, podczas gdy Bajt obserwuje pozostałe na kamerach; w drugim punkcie wpada oddział uderzeniowy Orbis z ludźmi Kurogane, a na tablecie dowódcy widnieją dokładne słowa, które Szron przekazał Staremu Tomaszowi.

## Tło fabularne

Folder „Palacz” leżał na dyskach Bajta od czasu szturmu na Odlewnię i śmierci Oskara Brandta (Misja 6). Kiedy po przejęciu dokumentacji z Zakładu Kalibracji udaje się wreszcie zdjąć wielowarstwowe szyfrowanie, wychodzi na jaw prowadzony od dziewięciu lat rejestr raportów z Niecki. Pierwsze wpisy pochodzą z tygodni tuż po pacyfikacji przepompowni — tym samym wydarzeniu, po którym Szron odszedł z Kurogane i trafił do Iskry.

Informator przekazywał Brandtowi dane wyłącznie o Rezonantach działających na własną rękę, poza strukturą Iskry. W zamian patrole omijały bezpośrednie okolice stacji Kamienna. Ostatni raport w folderze jest z nocy prologu: opisuje kuriera na tanim implancie ruchowym, który zatrzymał kontener na rampie towarowej w Hutach. Tylko przypadek sprawił, że Szron dotarł tam kilkanaście minut przed oddziałem pościgowym.

Szron nie chce urządzać polowania na czarownice wśród trzydziestu ludzi na stacji. Zawęża krąg do czterech osób mających dostęp do rozkładów i szyfrów tablicy misji: Miry, doktor Wolan, Nadii Korsak oraz Starego Tomasza. Każdej z nich przekazuje osobną, niegroźną wzmiankę o rzekomym nocnym przewozie ocalałego kamertonu w czterech różnych punktach miasta. Gracz na początku misji wie o teście Szrona, ale nie wie, kto otrzymał współrzędne którego punktu.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Obsadzić kolejno dwa wyznaczone punkty zasadzki (**Punkt A** w Niecce przy starej przepompowni oraz **Punkt B** na węźle przeładunkowym w Hutach) i utrzymać pozycję w oknie nasłuchu (ok. 30 s w Punkcie A — do strojenia).
  - W Punkcie B odeprzeć zasadzkę połączonego oddziału uderzeniowego Orbis Grid (który po śmierci Brandta przejął sieć wywiadowczą Kurogane) oraz niedobitków ochrony Kurogane.
  - Pokonać dowódcę oddziału uderzeniowego i zabezpieczyć jego tablet operacyjny, zanim zdalne czyszczenie zniszczy rozkaz wymarszu.
- **Warunki porażki:**
  - Śmierć Kuriera.
  - Ucieczka dowódcy oddziału z Punktu B lub pełne wyczyszczenie tabletu po jego pokonaniu (okno ok. 20 s na podniesienie upuszczonego tabletu — propozycja do strojenia).
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Rozbrojenie czujnika lokalizacyjnego przy przepompowni* (Punkt A — drobna bojka z dronem zwiadowczym przed końcem nasłuchu) — nagroda: +20 Danych.
  - *Przejęcie tabletu dowódcy w ciągu 10 s od jego pokonania* — nagroda: +1 Rdzeń.

## Mapa

- **Miejsce i nastrój:** Pogranicze zalanej wilgocią Niecki i przemysłowych torowisk wschodnich Hut, motyw `neonStreet` (noc przed świtem, gęsta mżawka, para z kolektorów i dym z odległych pieców). Otoczenie ciemne i chłodne, bez głośnego ruchu ulicznego — miasto o trzeciej nad ranem. Paleta ADR 0006: **bursztynowe** lampy nad nieczynną przepompownią, **zielone** oznaczenia zaworów na rurociągach, **fioletowe** resztki napisów na starej nastawni kolejowej, **ciepła biel** reflektorów suwnicy nad rozjazdem w Hutach, **błękit królewski** na estakadzie nad głową. Zarezerwowane barwy odcinają się ostro: **czerwone** wizjery oddziału Orbis i ciężkich pancerzy Kurogane, **cyanowe** ostrze gracza, **magentowy** Rezonans.
- **Struktura sektora:** Run liczy **7 warstw** prowadzących z Niecki na bocznice Hut, w tym 3 stałe pokoje fabularne:
  - **Warstwa 1 (Wejście):** `alleyUnderpass` — wyjście kanałem z Niecki w stronę nieczynnej strefy pomp.
  - **Warstwa 2 (Dojście w Niecce):** wybór między opuszczoną uliczką techniczną (`alleyBackstreet`) a nocnym punktem paserskim pod mostem kolejowym (`shopRoom`).
  - **Warstwa 3 (Punkt A — Stara przepompownia w Niecce, stały pokój fabularny):** wariant `combatSubstation` na podmokłym placu wokół budynku pomp (miejsce symboliczne dla przeszłości Szrona). Kurier uruchamia lokalny sygnał pozorowany i obserwuje plac z podwyższonej kładki. Zjawia się jedynie rutynowy dron rozpoznawczy — żadnego oddziału przechwytującego.
  - **Warstwa 4 (Przejście między poziomami):** wybór między zamkniętym łącznikiem rurociągu (`combatCorridor`) a suchą nastawnią rozjazdową (`restRoom` — krótki odpoczynek przed Hutami).
  - **Warstwa 5 (Obrzeża Hut):** wybór między placem kontenerowym (`combatYard`) a górnymi pomostami nad torami (`combatPlatforms`).
  - **Warstwa 6 (Punkt B — Węzeł przeładunkowy w Hutach, stały pokój fabularny):** rozbudowany wariant `eliteFoundry` lub `combatWarehouse` z czterema kontenerami, suwnicą nr 4 i podwójnym torem manewrowym. Po nadaniu umówionego impulsu wchodzi pełny oddział uderzeniowy Orbis wsparty tarczownikami Kurogane.
  - **Warstwa 7 (Odwrót ku zejściu na Kamienną — stały pokój fabularny):** wariant `alleyCrossing` z lekką blokadą odwrotu, którą Kurier mija lub rozbija po zgraniu tabletu, wracając w dół przed świtem.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Punkty nadania sygnału pozorowanego (Punkt A i Punkt B):** skrzynki przekaźnikowe uruchamiane krótką interakcją (ok. 1,5 s), dające znać potencjalnemu przechwytującemu, że fikcyjny transport zbliża się do rozjazdu.
  - **Tablet operacyjny dowódcy (Punkt B):** po upadku elity wypada z czerwonym wskaźnikiem odliczania zdalnego czyszczenia; wymaga podniesienia przed upływem czasu.
- **Wrogowie:**
  - Frakcja: **Orbis Grid** (wywiad i taktyczne jednostki uderzeniowe) w mieszanym szyku z **Kurogane Arms** (ciężka osłona przejęta po Brandcie).
  - Archetypy w Misji 14: `drone`, `hacker`, `sniper`, `assaulter`, `gunner`, `shielder`.
  - **Elita w Punkcie B — Dowódca oddziału uderzeniowego Orbis:** szybki przeciwnik taktyczny stawiający lokalne zakłócenia i wspierany przez dwa drony-hakery oraz parę `shielder` (propozycja do backlogu: mobilny operator Orbis z krótkim kamuflażem przeskokowym; wariant zastępczy: `executor` o zwiększonej mobilności z dwoma `drone` / `hacker`).
- **Zagrożenia środowiskowe:**
  - Wąskie przejścia między rurami przy przepompowni i ciężkie kontenery blokujące pole widzenia na węźle przeładunkowym, z których z boku wychodzą tarczownicy.
  - Reflektory suwnicy w Punkcie B oślepiają przy wejściu od zachodniej bramy, ułatwiając snajperom zajęcie kładki nad torami.

## Przebieg

1. **Odprawa w kryjówce (`hideout` — zamknięty kanał przy poligonie):** Szron i Bajt wywołują Kuriera osobno, tuż przy zejściu na poligon, z dala od peronu B i beczki Tomasza. Pokazują rozkodowany rejestr „Palacza” i wyjaśniają plan pułapki: czterem osobom mającym dostęp do tablicy misji podano cztery różne, odizolowane lokalizacje rzekomego transportu. Szron nie mówi Kurierowi, kto dostał które miejsce — żeby obserwator nie zachowywał się inaczej niż zwykle.
2. **Punkt A — Przepompownia w Niecce (Warstwy 1–3):** Kurier wchodzi na stary plac przy pompach, które dziewięć lat temu były świadkiem odejścia Szrona z Kurogane. Nadaje krótki sygnał pozorowany i czeka. Przez pół minuty nie dzieje się nic poza przelotem zwykłego drona patrolowego z dzielnicy. W tym samym czasie Bajt melduje z kamery, że punkty trzeci i czwarty (te w Bulwarze i przy porcie) również pozostają puste.
3. **Przejście do Hut i Punkt B (Warstwy 4–6):** Kurier schodzi ku rozjazdowi pod suwnicą numer cztery w Hutach. Z chwilą włączenia sygnału z czterech stron wysuwają się smukłe sylwetki Orbis Grid w asyście tarczowników Kurogane. Nie szukają patrolu — zamykają dokładnie oba wyloty toru, czekając na nieeskortowany transport o tej samej godzinie.
4. **Starcie z oddziałem uderzeniowym i tablet dowódcy (Warstwa 6):** Walka z grupą uderzeniową i jej dowódcą. Po zbiciu elity dowódca próbuje uruchomić czyszczenie danych na tablecie. Kurier przejmuje urządzenie, zanim pamięć wyparuje. Bajt czyta treść rozkazu na zamkniętym kanale: *„Stary rozjazd pod suwnicą numer cztery, ładunek bez eskorty, okno między pierwszą a drugą.”* Następuje chwila ciszy — dokładnie takie sformułowanie Szron podał przed południem **Staremu Tomaszowi**.
5. **Powrót na Kamienną (`hideout`):** Kurier wraca na stację, gdy na peronie B wciąż pali się ogień w beczce. Szron stoi naprzeciw Tomasza przy nikłym świetle żaru; wokół w półcieniu stoją Mira, Bajt i Wolan. Szron kładzie tablet na skrzynce obok ognia. Tomasz patrzy na ekran i nie zaprzecza. Spokojnym, równym głosem wyjaśnia umowę z Brandtem sprzed dziewięciu lat: nigdy nie wydał nikogo z Kamiennej, oddawał tylko samotnych Rezonantów spoza Iskry, żeby kupić spokój trzydziestu ludziom na stacji. W noc prologu wysłał raport z rampy jak zawsze — nie wiedział, że Szron zdąży pierwszy. Szron odbiera mu klucz do tunelu i każe zamknąć go w dyżurce za barem do świtu: o szóstej rano ma wyjść starym wyrobiskiem i nigdy nie wracać.

## Dialogi

### Odprawa (kryjówka, na zamkniętym kanale przy wejściu na poligon)

**Bajt:** Folder Brandta puścił godzinę temu. Dwadzieścia cztery pliki, każdy podpisany tym samym kryptonimem: „Palacz”.
**Szron:** Dziewięć lat raportów z Niecki. Zaczęło się dwa tygodnie po tym, jak wyciągnąłem pierwszych ludzi po pacyfikacji przepompowni.
**Bajt:** Informator nie podawał listy z kryjówki. Zgłaszał wyłącznie Rezonantów, którzy wpadli w sygnał sami, na mieście. Ostatni raport ma datę z nocy, kiedy na rampie spadł kontener.
**Szron:** Cztery osoby poza mną i Bajtem miały dziś dostęp do rozkładu na tablicy misji: Mira, doktor Wolan, Nadia i Tomasz. Każdej podałem inne miejsce, gdzie rzekomo wieziemy dziś jednego z uwolnionych z Tarasu bez pełnej eskorty.
**Bajt:** Sprawdziłem na miejskich kamerach dwa punkty od strony Bulwaru i portu — tam stoję ja. Dwa pozostałe, w Niecce i w Hutach, bierzesz na siebie.
**Szron:** Nie mówię ci, kto dostał które miejsce. Im mniej domysłów na kanale, tym trudniej cokolwiek przeczytać z głosu.
**Bajt:** Gdyby w którymś punkcie zjawili się zamiast zwykłego patrolu ludzie od sprzątania z Korony, nie zabijaj dowódcy na popiół. Zgrani mają przy sobie tablety z pełnym rozkazem wymarszu.
**Szron:** Wyjdź cicho bocznym zejściem, bez żegnania się na peronie. O drugiej wracasz z odpowiedzią.

### W trakcie misji (radio)

**Wejście do Niecki (warstwa 1):**
**Bajt:** Kanał zamknięty, nikt poza mną i Szronem nie ma podsłuchu na tej częstotliwości. Idziesz pod starą przepompownię, to nasz Punkt A.

**Punkt A — Stara przepompownia (warstwa 3):**
**Szron:** Włącz mały przekaźnik przy bramie pompowni i zejdź wyżej na kładkę. Daj im trzydzieści sekund na reakcję.
**Bajt:** ...Dwadzieścia sekund. Czysto na kamerze przy porcie i pod estakadą w Bulwarze. U ciebie?
**Szron:** Jeden dron zwiadowczy na rutynie. Nie zna częstotliwości sygnału. Pakuj się dalej na wschód, do Hut — Punkt B.

**Dojście do Hut (warstwa 5):**
**Bajt:** Sprawdzałem znowu pozostałe dwa punkty. Zero ruchu, nawet zwykłe patrole trzymają się z dala. Jeśli ktoś sprzedał tę trasę, wybrał rozjazd pod suwnicą numer cztery.
**Szron:** Szykuj sprzęt. Po śmierci Brandta wywiad Kurogane przejął Orbis Grid — nie przyślą samych tarczowników z odlewni.

**Punkt B — Węzeł przeładunkowy (warstwa 6):**
**Bajt:** Cholera, ruch na wszystkich torach dojazdowych! Trzy furgonetki bez znaków, podpięcie prosto pod sieć Korony!
**Szron:** Nie szukają podejrzanych. Ustawiają blokadę dokładnie na godzinę fikcyjnego transportu. Zatrzymaj ich i zdejmij dowódcę, zanim wymaże tablet!

**Walka z dowódcą Orbis (warstwa 6):**
**Bajt:** Łapię ich kanał: „Nie ten ładunek, kurwa. Mamy jednego. Zdejmować.” Ten z przodu ma szyfrowany terminal na przedramieniu. Po jego upadku system odpali czyszczenie pamięci w kilkanaście sekund!

**Przejęcie tabletu (warstwa 6):**
**Bajt:** Mam zrzut! Daj mi sekundę na rozbicie nagłówka... Jest tekst rozkazu: „Przechwycenie o pierwszej trzydzieści, stary rozjazd pod suwnicą numer cztery, ładunek bez eskorty.”
**Szron:** ...Powtórz dokładnie drugą linijkę.
**Bajt:** „Stary rozjazd pod suwnicą numer cztery, ładunek bez eskorty, okno między pierwszą a drugą.”
**Szron:** Tylko jedna osoba dostała te słowa dokładnie w takiej kolejności.
**Bajt:** Szron... na pewno się nie pomyliłeś z kartkami?
**Szron:** Nie mylę takich rzeczy. Zwijaj się stamtąd, Kurier. Wracaj od razu na Kamienną.

**Odwrót (warstwa 7):**
**Szron:** Zostaw niedobitków przy bocznicy, jeśli nie blokują zejścia. Nikt nie może wyprzedzić nas do stacji przed świtem.

### Po misji (kryjówka, przy beczce na peronie B)

**Mira:** O co chodzi, Szron? Wyciągasz wszystkich na peron o trzeciej w nocy, a nikt nie wraca z ładunkiem?
**Szron:** Ładunku nie było. Był za to oddział uderzeniowy Orbis z ludźmi Kurogane dokładnie pod suwnicą numer cztery.
**Bajt:** Z tabletu dowódcy. Słowo w słowo ta notatka, którą Szron zostawił tobie, Tomasz.
**Wolan:** Tomasz... przecież ty sam budowałeś tę stację.
**Tomasz:** Zgadza się. Dwanaście lat temu.
**Szron:** Dziewięć lat temu poszedłeś do Brandta. W folderze z Odlewni jest każdy raport. Pierwszy zaraz po przepompowni. Ostatni z nocy, kiedy Kurier zatrzymał kontener w Hutach.
**Tomasz:** Nie zgłosiłem nikogo z tej stacji. Ani jednej osoby z naszej trzydziestki.
**Mira:** Kurier miał zostać jednym z nas dopiero po tej nocy! Kurwa, wysłałeś po niego oddział!
**Tomasz:** Nie wiedziałem, kim jest. Zobaczyłem obcego na kamerze z portu i przekazałem Brandtowi ślad, jak co kilka miesięcy. Tak brzmiała umowa: ja pilnuję, żeby na dole nie robili bałaganu samotni ludzie bez opieki, a oni nie schodzą nigdy do starych tuneli pod linią powodziową.
**Szron:** Kupiłeś spokój dla nas cudzymi ludźmi z ulicy. Ludźmi, którzy potem trafiali na stoły pod kampusem.
**Tomasz:** Nie znałem słowa „kamerton”. Myślałem, że zamykają ich w celach, jak dawniej w Hutach. Ale gdybyś wiedział wcześniej... Gdybyś widział, ilu naszych, psia krew, przeżyło te dziewięć lat, bo patrole omijały Kamienną...
**Szron:** Nie mów mi o liczbach. Nikt cię, kurwa, nie prosił o taki handel.
**Tomasz:** Bo wiedziałem, że byś nie pozwolił. Ktoś musiał wziąć ten brud na siebie, żebyś ty mógł robić czystą robotę z tablicą misji.
**Bajt:** Przynajmniej teraz rozumiem, skąd zawsze wiedziałeś, którędy chodzą patrole pod estakadą.
**Tomasz:** Zostanę do rana, jeśli chcesz. Albo wyjdę od razu.
**Szron:** Nie wyjdziesz w ciemno, żeby im jeszcze powiedzieć, gdzie siedzimy. Zamkniesz się w starej dyżurce za barem. O świcie otworzę ci boczny szyb za Niecką. Pójdziesz na zachód i nie wrócisz pod ten adres.
**Tomasz:** Dobrze, Szron. Nie będę szarpał klamki.
**Mira:** Pilnuj lepiej tej stacji do rana, Szron. Jak jego dowódca nie wrócił z Hut, w Koronie już wiedzą, że coś tu, kurwa, śmierdzi.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia):**
  - 145 Danych oraz 2 Rdzenie za ukończenie misji (plus do +20 Danych i +1 Rdzeń za cele opcjonalne).
- **Zmiany w kryjówce:**
  - Tomasz znika z miejsca przy beczce z ogniem na peronie B — zostaje zamknięty w dyżurce za barem do świtu; beczka powoli dogasa bez dokładania drewna.
  - Atmosfera na stacji jest napięta i ciężka; przed świtem nikt nie idzie spać poza rannymi na antresoli.
- **Co misja otwiera dalej:**
  - Bezpośrednio wywołuje **Misję 15 — Kamienna**: zerwanie milczenia „Palacza” i brak powrotu oddziału uderzeniowego z Hut powodują natychmiastowy nocny szturm Orbis Grid i Kurogane Arms na kryjówkę Iskry.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Szablony `alleyUnderpass`, `alleyBackstreet`, `shopRoom`, `combatSubstation`, `combatCorridor`, `restRoom`, `combatYard`, `combatPlatforms`, `eliteFoundry`, `combatWarehouse`, `alleyCrossing`.
  - Archetypy `drone`, `hacker`, `sniper`, `assaulter`, `gunner`, `shielder`, `executor`.
- **Nowe elementy potrzebne dla Misji 14:**
  - Sekwencja krótkiego czuwania w Punkcie A (30 s od aktywacji sygnału, bez wymuszonej dużej bitwy, żeby zbudować napięcie przed Punktem B).
  - Mechanika upuszczanego **tabletu dowódcy** z zegarem zdalnego czyszczenia po pokonaniu elity w Punkcie B.
  - Osobna odprawa na poligonie / przy wejściu bez udziału pozostałych NPC w tle.
- **Propozycje do backlogu:**
  - Dedykowany **dowódca oddziału uderzeniowego Orbis** z krótkim przeskokiem optycznym i aktywnym wsparciem dronów zakłócających (obecnie zastępowany przez wariant `executor` + `hacker` + `drone`).
