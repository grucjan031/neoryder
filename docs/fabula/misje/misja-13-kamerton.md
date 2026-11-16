# Misja 13 — Kamerton

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| II (finał aktu) | Helixa Dynamics | Taras, Zakład Kalibracji pod kampusem | Odbicie więźniów + boss | Brak twardego limitu ogólnego (ok. 15–18 min runu; w skrzydłach okna stabilizacji po ok. 15 s — do strojenia) | Po Misji 12 (Śluza); kończy Akt II, odblokowuje Koronę i Misję 14 (Palacz) |

## W skrócie

Kurier przechodzi przez otwartą śluzę do Zakładu Kalibracji pod kampusem Helixa, gdzie od lat leżą żywi Rezonanci podpięci do aparatury jako „kamertony”. Odłącza stanowiska w trzech skrzydłach zakładu, przerywając synchronizację pobliskich akordowców, po czym w centralnej hali badawczej staje do walki z dyrektor laboratorium, doktor Agatą Lind. Po pokonaniu Lind i ewakuacji kilkunastu ocalałych windą towarową dokumenty z hali ujawniają, że od dwóch lat całą produkcję Akordu wykupuje Orbis Grid na potrzeby projektu „Chór”.

## Tło fabularne

Od pierwszych dni w kryjówce Iskra składała kawałki układanki: czujniki w masztach Kurogane (M1), cotygodniowe kontenery klasy K z portu (M3), Idę wyrwaną z pociągu jako obiekt K-112 (M4), wreszcie dokumenty Brandta o Akordzie i kamertonach (M6) oraz przyznanie się Heleny Wolan do autorstwa metody (M10).

Teraz śluza od spodu jest otwarta (M12). Cel nie ogranicza się do kradzieży danych: w trzech skrzydłach Zakładu Kalibracji leżą ludzie, z których część jest podłączona od lat. Z doświadczeń w strefie kwarantanny (M8) Iskra wie, że gwałtowne przerwanie pętli zabija kamertona albo wywołuje natychmiastowe rozstrojenie użytkowników. Wolan napisała więc skrypt stopniowego wygaszania aparatury, który pozwala bezpiecznie odłączyć kapsuły.

Na miejscu dowodzi doktor Agata Lind, dawna uczennica Wolan. Traktuje kamertony jak „koszt kliniczny” postępu i nosi najlepszy prototyp Akordu w firmie, dostrojony do Idy. Gracz jeszcze nie wie, dla kogo Helixa pracuje na wyłączność i czym jest projekt „Chór” — ta prawda zamyka Akt II.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Odłączyć stanowiska kamertonów w trzech skrzydłach Zakładu Kalibracji (**Wschodnim**, **Zachodnim** i **Północnym**), uruchamiając procedurę wygaszania na konsolach i broniąc stanowisk przez czas stabilizacji kapsuł (ok. 15 s na skrzydło — propozycja do strojenia).
  - Pokonać w centralnej hali badawczej bossa — **doktor Agatę Lind**.
  - Zabezpieczyć dokumentację główną zakładu z konsoli za centralnym stanowiskiem i uruchomić ewakuację uwolnionych kamertonów przez wschodnią windę towarową, gdzie czeka ekipa wsparcia Miry.
- **Warunki porażki:**
  - Śmierć Kuriera.
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Zgranie rejestru zakupów ze sterowni nad centralną halą* (przed rozpoczęciem walki z Lind lub tuż po otwarciu antresoli serwisowej) — nagroda: +25 Danych.
  - *Ukończenie wygaszania w trzech skrzydłach bez przerwania procedury przy żadnej konsoli* (brak przejęcia konsoli przez przeciwnika podczas 15 s stabilizacji) — nagroda: +1 Rdzeń.

## Mapa

- **Miejsce i nastrój:** Podziemny kompleks badawczo-produkcyjny pod kampusem Helixa na Tarasie, motyw wewnętrzny bez deszczu. Sterylne, chłodne pomieszczenia z jasnoszarego betonu, szkła zbrojonego i stali, rzędy kapsuł podtrzymujących życie połączonych grubymi wiązkami przewodów pod sufitem. Paleta ADR 0006: **ciepła biel** oświetlenia operacyjnego nad stanowiskami, **błękit królewski** monitorów parametrów życiowych, **zieleń** lampek stabilizacji po bezpiecznym odłączeniu kapsuły, **bursztyn** lamp ostrzegawczych przy windzie towarowej, **fiolet** oznaczeń sektorowych na ścianach. Zarezerwowane kolory zachowują pełną czytelność: **czerwone** pancerze ochrony Helixa, akordowcy oraz czerwone kopie mocy Lind; **magentowa** poświata żywego Rezonansu przy kapsułach kamertonów i u Kuriera; **cyanowe** ostrze plazmowe gracza.
- **Struktura sektora:** Run liczy **8 warstw** (najdłuższa misja Aktu II), w tym 5 stałych pokoi fabularnych:
  - **Warstwa 1 (Wejście):** `combatCorridor` — śluza techniczna z Misji 12, wyjście na korytarz podziemny zakładu.
  - **Warstwa 2 (Zaplecze techniczne):** wybór między starciem w magazynie odczynników (`combatWarehouse`) a uzupełnieniem zapasów przed skrzydłami (`shopRoom` — porzucony punkt serwisowy z zasobnikami technicznymi).
  - **Warstwa 3 (Skrzydło Wschodnie — stały pokój fabularny):** wariant `eliteChemPlant`. Dwa rzędy po 3 kapsuły kamertonów, pośrodku konsola wygaszania osłonięta niskimi przegrodami ze szkła.
  - **Warstwa 4 (Skrzydło Zachodnie — stały pokój fabularny):** wariant `combatPillars`. Wysoka hala z kolumnami kablowymi, galerią strzelców nad wejściem i drugą konsolą wygaszania pod wschodnią ścianą.
  - **Warstwa 5 (Śluza buforowa):** wybór między szybkim przejściem przez salę kontrolną (`combatCorridor`) a pokojem regeneracji w punkcie socjalnym personelu (`restRoom`).
  - **Warstwa 6 (Skrzydło Północne — stały pokój fabularny):** wariant `eliteCourtyard` (wewnętrzne laboratorium ze sztucznym świetlikiem w kolorze ciepłej bieli i ciężką obstawą przed centrum). Trzecia konsola wygaszania.
  - **Warstwa 7 (Centralna Hala Kalibracji — stały pokój fabularny, BOSS):** `bossRoom`. Przestronna, symetryczna hala z pustym centralnym stanowiskiem pomiarowym (dawnym miejscem K-112 / Idy) pośrodku, sześcioma grubymi kolumnami technologicznymi do krycia się przed falami mocy, oszkloną sterownią na podwyższeniu oraz szerokimi wrotami windy towarowej po stronie wschodniej.
  - **Warstwa 8 (Winda towarowa — stały pokój fabularny):** krótka strefa ewakuacyjna za wrotami, bez ciężkiej walki — miejsce przekazania dokumentów i wyjazdu ocalałych w dół do kanału.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Konsole wygaszania (x3):** w każdym ze skrzydeł; wgranie skryptu Wolan zajmuje 2,5 s, potem przez 15 s konsola odlicza bezpieczne odłączenie. W tym czasie wrogowie próbują dobiec do terminala (przerwanie cofa licznik o połowę, ale nie zabija kamertonów). Po wygaszeniu kapsuły odblokowują zamki, a pobliscy akordowcy tracą synchronizację i na 20 s stają się znacznie podatniejsi na obrażenia (propozycja do strojenia).
  - **Kolumny osłonowe w `bossRoom`:** kluczowe dla przetrwania fal Pchnięcia i rzutów Chwytu dr Lind.
  - **Terminal główny za centralnym stanowiskiem:** odblokowuje się po pokonaniu Lind; zawiera kontrakty z Orbis Grid.
  - **Winda towarowa:** uruchamiana po zabraniu dokumentów; zamyka misję.
- **Wrogowie:**
  - Frakcja: **Helixa Dynamics** (sterylne maski, pancerze z gładkich płyt, wysoka wytrzymałość).
  - Archetypy obecne: `gunner`, `shielder`, `turret`, `drone`, `executor`.
  - Propozycje do backlogu (z wariantem zastępczym):
    - **Akordowiec:** szturmowiec ze słabszym, **czerwonym** Pchnięciem lub szarżą Rezonansu; odłączenie kamertonów w danym skrzydle natychmiast odbiera mu moc i zdejmuje część pancerza (wariant zastępczy: `assaulter` / `executor` z czerwonym efektem i debuffem po aktywacji konsoli).
    - **Sanitariusz Helixa:** rzuca granaty-strzykawki tworzące chmurę drażniącą oraz regeneruje pancerz sojuszników (wariant zastępczy: `gunner` z ostrzałem obszarowym + `drone`).
- **BOSS — dr Agata Lind (3 fazy, czerwone kopie mocy gracza):**
  Lind walczy w sterylnym pancerzu laboratoryjnym bez hełmu bojowego, z widocznym implantem na skroni świecącym ostrą **czerwienią**. Wszystkie jej moce to czerwone kopie zdolności gracza — **Pchnięcia**, **Bariery** i **Chwytu** (liczby do strojenia):
  - **Faza 1 — Kalibracja (100%–65% HP):** Lind bada zasięg Kuriera na średnim dystansie, wspierana przez dwa drony serwisowe. Używa **czerwonego Pchnięcia** (czytelne 0,8 s ładowania dłoni przed wypchnięciem szerokiej fali odrzucającej gracza na kolumnę i zadającej dodatkowe obrażenia przy zderzeniu) oraz **czerwonej Bariery** (4-sekundowa tarcza z przodu odbijająca pociski z broni palnej; można ją obejść dashem na flankę, przełamać ciężkim ciosem ostrza plazmowego z bliska albo zbić Falą uderzeniową / Granatem EMP).
  - **Faza 2 — Przeciążenie wzorca (65%–30% HP):** Lind przełącza swój Akord na maksymalny pobór i włącza do zestawu **czerwony Chwyt** (po 1-sekundowej czerwonej wiązce naprowadzającej podnosi luźne skrzynie aparatury albo odłamki płyt i ciska nimi w gracza; jeśli Kurier stoi bez osłony w linii wiązki, Chwyt chwyta go na 1 s i rzuca o podłogę — unik przez dash w bok lub przerwanie trafieniem w czasie ładowania). Lind łączy Chwyt z natychmiastowym Pchnięciem po lądowaniu oraz stawia Barierę podczas wzywania pary akordowców z bocznych drzwi.
  - **Faza 3 — Rozstrojenie (30%–0% HP):** Po odłączeniu wszystkich trzech skrzydeł i uszkodzeniu rezerwowych kabli w hali (przejście do fazy na progu 30% HP) implant Lind traci swój kamerton-matkę (Idę, której nie ma w zakładzie, oraz odłączone stanowiska zapasowe). Jej czerwone wyładowania rwą się i iskrzą: Pchnięcie i Chwyt mają krótsze przerwy, ale są mniej celne, a **Bariera** gaśnie po jednym mocniejszym ciosie lub sama rozpada się z przegrzania. Po każdej serii dwóch mocy Lind na 1,5–2 s wpada w drgawki rozstrojenia (wyraźne okno do ataku ostrzem). Na 0% HP jej Akord gaśnie całkowicie; upada pod konsoletą, niezdolna do dalszego ruchu, wciąż przytomna.
- **Zagrożenia środowiskowe:**
  - Odłamki szkła i rozbite kapsuły w centralnej hali jako amunicja dla czerwonego Chwytu Lind.
  - Wieżyczki podwieszone pod sufitem w Skrzydle Północnym i przy sterowni.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Szron dzieli role: Kurier idzie przodem przez odblokowaną śluzę z M12, a Mira z kilkorgiem ludzi Iskry zajmuje boczny szyb serwisowy przy zewnętrznej windzie towarowej, gotowa odebrać rannych. Wolan wręcza nośnik z procedurą bezpiecznego wygaszania kapsuł i przypomina, żeby nie zostawiać włączonego zasilania przy żadnym skrzydle.
2. **Wejście i trzy skrzydła (Warstwy 1–6):** Kurier wchodzi w głąb Zakładu Kalibracji. W Skrzydle Wschodnim, Zachodnim i Północnym widzi rzędy ludzi podłączonych do aparatury — cichych, wychudzonych, z nikłą magentową poświatą na skroniach. Po każdym wygaszeniu konsoli przez 15 s odpiera próby przerwania procedury; po udanym odłączeniu pobliscy akordowcy tracą czerwony Rezonans i łapią się za głowy, ułatwiając wyczyszczenie pokoju.
3. **Wejście do Centralnej Hali (Warstwa 7):** Ida przez radio z kryjówki potwierdza obecność Lind tuż za drzwiami. Gdy Kurier staje naprzeciw pustego stanowiska K-112, dr Agata Lind wychodzi ze sterowni. Nie wygłasza gróźb ani przemów; mówi jak kierownik projektu zaskoczony udaną ingerencją w jej laboratorium i traktuje walkę jak test dwóch typów implantów.
4. **Walka z dr Agatą Lind (3 fazy):** Kurier przebija się przez jej czerwoną Barierę, unika Chwytu i Pchnięć między kolumnami, aż na ostatnim progu zdrowia jej Akord rozstraja się na oczach gracza. Lind opada pod konsolę, przyciskając dłoń do skroni.
5. **Dokumenty i projekt „Chór” (Warstwa 7–8):** W krótkiej wymianie zdań po walce Lind broni swojej pracy jednym argumentem procedury: *„My tylko produkujemy. Wiesz, kto kupuje?”*. Kurier zostawia ją w wygaszonej hali (Helixa ogłosi ją później ofiarą zamachu) i zgrywa główny rejestr dostaw. Z dokumentów wynika, że od dwóch lat 100% produkcji Akordu skupuje **Orbis Grid** pod projekt o nazwie **„Chór”**.
6. **Ewakuacja windą towarową (Warstwa 8):** Mira z ludźmi wchodzi wschodnimi wrotami. Kilkunastu uwolnionych Rezonantów, większość ledwo trzymających się na nogach, zjeżdża windą w dół ku tunelom Niecki.
7. **Powrót na Kamienną (`hideout`):** Na antresoli stacji stają prowizoryczne prycze dla ocalałych kamertonów. Wolan bada pierwsze wyniki — ludzie przeżyją, choć czeka ich długa rehabilitacja. Bajt i Szron oglądają kontrakty Orbis Grid: cały Akt II był tylko linią produkcyjną, a odbiorca siedzi na szczycie Korony.

## Dialogi

### Odprawa (kryjówka)

**Szron:** Śluza pod zakładem stoi otworem. Za godzinę wchodzi poranna zmiana, więc robimy to teraz.
**Wolan:** Wrzucam na twój czytnik skrypt wygaszania. Przy każdej grupie kapsuł podepnij go do głównej konsoli skrzydła i nie wyrywaj kabli siłą — przy nagłym odcięciu serce dawcy staje w pół minuty.
**Mira:** Ja i chłopaki czekamy w szybie za wschodnią windą towarową. Jak tylko otworzysz wrota po drugiej stronie centralnej hali, wjeżdżamy po ludzi z noszami.
**Bajt:** Pamiętaj o głównym terminalu w centrum. Jeśli Helixa ma tam bazę odbiorców Akordu, chcę widzieć każdy rachunek z ostatnich dwóch lat.
**Ida:** Doktor Lind nie zejdzie sama do skrzydeł, dopóki nie wyłączysz pierwszego rzędu. Będzie czekać w sali pośrodku — tam, gdzie stało moje łóżko.
**Szron:** Jeśli jest tak dobra, jak mówią akta, ma na sobie kopię twoich ruchów. Nie dawaj się zamykać pod ścianą.
**Wolan:** Agata uważa, że zrobiła z błędu medycznego narzędzie masowe. Nie przemówisz jej do rozsądku. Po prostu ją zatrzymaj i wyłącz aparaturę.
**Szron:** Trzy skrzydła, centralna hala, winda. Ruszaj, Kurier.

### W trakcie misji (radio)

**Wejście do Zakładu Kalibracji (warstwa 1):**
**Wolan:** Jesteś wewnątrz. Śluza zamknęła się za tobą, alarm jeszcze śpi na głównym piętrze. Kieruj się w prawo, na Skrzydło Wschodnie.

**Skrzydło Wschodnie — start procedury (warstwa 3):**
**Bajt:** Widzę skok obciążenia na sieci zakładu. Jak wpinasz skrypt, ochrona dostaje żółtą lampę na piętrze — masz kilkanaście sekund utrzymania, zanim kapsuły puszczą blokadę.
**Wolan:** Odliczanie idzie równo. Nie pozwól im przerwać połączenia przy konsoli.

**Skrzydło Wschodnie — po odłączeniu:**
**Wolan:** Pierwsza szóstka jest czysta, funkcje życiowe w normie.
**Mira:** Słyszysz ten trzask w eterze? Ich ludzie przy drzwiach stracili czerwone tarcze, kurwa, wreszcie. Wykorzystaj to, zanim zresetują układy!

**Skrzydło Zachodnie i Północne (warstwy 4–6):**
**Bajt:** Dwa skrzydła wygaszone. Na korytarzach robi się tłoczno, ściągają wszystkich z górnego skrzydła kampusu.
**Ida:** ...Została jeszcze północna sala. Ona już wie. Czuję, jak ciągnie sygnał przez całą halę, szuka mojego starego stanowiska.

**Wejście do Centralnej Hali — spotkanie z dr Agatą Lind (warstwa 7):**
**Agata Lind (głośniki w hali):** Proszę. Bez przepustki i bez rejestracji w systemie. A jednak widzę wzorzec mojej dawnej promotorki w samym kodzie przejęcia.
**Wolan (radio):** Agata... wyłącz resztę stanowisk rezerwowych. Sama wiesz, co dzieje się przy takim poborze bez kamertonu.
**Agata Lind:** Heleno, piętnaście lat minęło, a ty nadal liczysz pojedyncze przypadki zamiast tysięcy stabilnych implantów na rynku. Zobaczymy, ile wart jest oryginał bez zaplecza klinicznego.

**Walka z dr Lind — Faza 2 (65% HP):**
**Mira (radio):** Kurier, uważaj na jej lewą rękę — podnosi wszystko z podłogi tym samym Chwytem co ty! Zrywaj linię wiązki, zanim zamknie dłoń!
**Agata Lind:** Czysta replika. Nawet nie trzeba było pełnej matrycy, wystarczyła jedna dobra próbka z K-112.

**Walka z dr Lind — Faza 3 (30% HP, rozstrojenie):**
**Ida (radio):** Teraz! Zapasowe linie w podłodze padły, jej Akord nie ma już czego się złapać!
**Agata Lind:** Nie... brak nośnej... zresetować bufor... dlaczego pętla nie trzyma...
**Bajt (radio):** Kurwa, jej sygnał rwie jak stary głośnik! Jak tylko zastygnie po wyładowaniu, dobij jej osłony!

**Po pokonaniu Lind (warstwa 7, na miejscu):**
**Agata Lind:** Niespójność wzorca... dwadzieścia procent... To niczego nie zmienia. Przychodnie na Bulwarze stoją pełne.
**Szron (radio):** Zbieraj dyski z konsoli za nią, Kurier. Zostaw ją, nie jest już uzbrojona.
**Agata Lind:** My tylko produkujemy... Wiesz, kto kupuje? Myślisz, że robiliśmy to dla kilku patroli z Hut?

**Odkrycie w terminalu i winda towarowa (warstwa 7–8):**
**Bajt:** Czekaj... kurwa, mam zrzut z głównego rejestru dostaw! Cała produkcja Akordu od dwudziestu czterech miesięcy... sto procent partii idzie do jednego odbiorcy.
**Szron:** Do kogo?
**Bajt:** Orbis Grid. Kod zamówienia: projekt „Chór”. Nie kupują tego dla ochrony. Kupują wszystko.
**Mira:** Wrota windy otwarte, wchodzimy z noszami! Kurier, osłoń korytarz, zabieramy ludzi w dół!

### Po misji (kryjówka)

**Mira:** Dwanaście osób na noszach, czworo idzie o własnych siłach. Ustawiliśmy prycze na całej antresoli.
**Wolan:** Większość nie używała mięśni od dwóch do pięciu lat. Przeżyją, ale nie wstaną z łóżek przez najbliższe tygodnie. Trzech w Skrzydle Północnym zmarło przy odłączaniu. Przy takim stanie pytanie brzmiało nie czy, tylko kiedy.
**Ida:** W mojej głowie jest ciszej. Pierwszy raz od tamtej nocy, kiedy otworzyły się drzwi kontenera.
**Bajt:** Za to u mnie na biurku zrobiło się bardzo głośno. Spójrzcie na te faktury z Zakładu Kalibracji. Od dwóch lat Kurogane nie bierze nawet jednej trzeciej Akordu. Wszystko, co wychodziło spod ręki Lind, po kryjomu kupował Orbis Grid.
**Szron:** Po co firmie od sieci i kamer dziesiątki tysięcy wojskowych implantów Rezonansu?
**Bajt:** Nazwa projektu to „Chór”. I więcej nie wycisnę z plików Helixa, bo końcowe umowy są podpisane kluczami Korony.
**Tomasz:** Przynajmniej dzisiejszej nocy nikt już nikogo nie trzyma pod tą podłogą na Tarasie. Zostawimy tamtych ludzi na antresoli pod opieką doktor Wolan — tu na dole mają ciszę i ciepłą wodę.
**Szron:** Koniec z dołem miasta i laboratoriami. Ktoś na samej górze kupował każdą partię tego złomu, zanim trafiła do przychodni. Otwieramy na tablicy górne sektory Korony.
**Bajt:** I jeszcze jedno, Szron. W trakcie gdy byliście w zakładzie, mój skrypt z Odlewni wreszcie pękł. Ten zaszyfrowany folder od Brandta — „Palacz”.
**Szron:** O czym mówi?
**Bajt:** Chodź do mojego biurka. Lepiej, żebyśmy nie czytali tego na środku peronu.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia):**
  - 140 Danych oraz 2 Rdzenie za ukończenie finału Aktu II (plus do +25 Danych i +1 Rdzeń za cele opcjonalne).
  - Odblokowanie ulepszeń wyższych poziomów mocy Rezonansu w warsztacie Miry (opcjonalny schemat z puli Aktu III).
- **Zmiany w kryjówce:**
  - Trwała zmiana środowiskowa zgodnie z kanonem: na **antresoli** pojawiają się prycze z uwolnionymi kamertonami; Wolan krąży między nimi a swoim terminalem, inni mieszkańcy kryjówki zmieniają ton wobec niej z wrogiego na ostrożnie roboczy.
  - Na tablicy misji odblokowuje się poziom **Korony** (Orbis Grid).
- **Co misja otwiera dalej:**
  - Zamyka Akt II i otwiera Akt III: **Misję 14 — Palacz** (rozliczenie zdrady odkrytej w folderze Brandta) oraz dalszą walkę z projektem „Chór”.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Szablony `combatCorridor`, `combatWarehouse`, `shopRoom`, `restRoom`, `eliteChemPlant`, `combatPillars`, `eliteCourtyard`, `bossRoom`.
  - Archetypy `gunner`, `shielder`, `turret`, `drone`, `executor`.
- **Nowe elementy potrzebne dla Misji 13:**
  - Obiekt **konsola wygaszania** z 15-sekundowym procesem stabilizacji i efektem osłabienia pobliskich przeciwników Akordu po zakończeniu odliczania.
  - Pełny boss **dr Agata Lind** w `bossRoom`: trzy fazy z sygnalizacją czerwonych kopii mocy gracza (Pchnięcie, Bariera, Chwyt), fazą przerw i drgawek rozstrojenia poniżej 30% HP oraz dialogiem końcowym bez wybuchu śmierci.
  - Sekwencja odbioru dokumentacji w centralnej hali i przejścia do wschodniej windy towarowej z grupą ewakuacyjną.
- **Propozycje do backlogu:**
  - Dedykowane archetypy **akordowiec** (czerwone wyładowania) i **sanitariusz Helixa** (granaty-strzykawki, wsparcie pancerza), zastępowane tymczasowo przez warianty `assaulter`, `executor`, `gunner` i `drone`.
  - Pasek lub licznik stanu kamertonów podczas obrony konsoli wygaszania.
