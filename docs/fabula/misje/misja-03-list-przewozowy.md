# Misja 03 — List przewozowy

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| I | Kurogane Arms | Huty, port towarowy, Magazyn 9 | Obrona (strefa przy terminalu) | Noc (ok. 90 s czystego czasu transferu — do strojenia) | Po Misji 02 (Punkt kontrolny); odblokowuje Misję 04 (Ładunek klasy K) |

## W skrócie

Trop od Nadii prowadzi Iskrę do Magazynu 9 w porcie towarowym Hut, gdzie trafiali zatrzymani po pozytywnym skanie implantów. Kurier wchodzi do strzeżonego portu, stawia czoło nowym oddziałom Kurogane z Tarczownikami i dronami, a następnie utrzymuje pozycję przy terminalu spedycji, dopóki dekoder Bajta nie pobierze ksiąg wywozowych. Dokumenty ujawniają regularny cotygodniowy transport kontenera chłodniczego opisanego jako „ładunek biologiczny klasy K”, wysyłanego koleją z Hut prosto do Zakładu Kalibracji Helixa Dynamics na Tarasie.

## Tło fabularne

Zapisy z bocznicy pokazały, że Kurogane zatrzymuje wyłącznie tych kurierów, których implanty reagują niestandardowo na głowicę Helixa, a następnie kieruje ich do Magazynu 9 w głębi portu przemysłowego. Nikt ze znikniętych przed miesiącem nie pojawił się już na ulicach Niecki ani w oficjalnych rejestrach zakładu karnego.

W porcie panuje wzmożona czujność po ucieczce Nadii i rozbiciu punktu kontrolnego, dlatego stary skład spedycyjny zabezpieczono ciężkimi oddziałami osłonowymi i patrolami powietrznymi. Żeby wyciągnąć pełne listy przewozowe z lokalnej sieci odciętej od internetu miejskiego, trzeba fizycznie wpiąć dekoder Bajta w główną konsolę magazynu i zostać przy niej aż do zakończenia zrzutu.

Gracz nie wie jeszcze, co kryje się pod kodem „klasa K”, czy transportowani ludzie żyją, ani dlaczego przesyłki odbiera laboratorium badawcze na Tarasie zamiast oddziału zbrojeniówki.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Przedostać się przez nabrzeże portu towarowego do głównej hali Magazynu 9.
  - Podłączyć dekoder Bajta do terminala spedycji i utrzymywać się wewnątrz strefy zasięgu urządzenia aż do osiągnięcia 100% transferu (postęp zatrzymuje się natychmiast po wyjściu Kuriera ze strefy).
  - Po zakończeniu pobierania wydostać się przez dok załadunkowy na barkę ewakuacyjną.
- **Warunki porażki:**
  - Śmierć Kuriera (powrót do kryjówki z zachowaniem stałego postępu i powtórka misji).
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Kontrola ramp bocznych* (zeskanowanie dwóch manifestów paletowych na podestach Magazynu 9 przed uruchomieniem głównego terminala) — nagroda: +15 Danych.
  - *Bez przestoju* (czas łączny poza strefą terminala od momentu startu transferu nie przekracza 15 s — propozycja do strojenia) — nagroda: +25 Danych.

## Mapa

- **Miejsce i nastrój:** Wschodni port towarowy Hut nad kanałem przemysłowym, motyw `neonStreet` (noc, gęsta mżawka i mgła znad wody, mokry beton nabrzeża, ciężkie suwnice bramowe nad głową). Otoczenie ciemne i chłodne. Neony z palety ADR 0006: **bursztynowe** koguty ostrzegawcze na suwnicach, tablice numerów doków w **zieleni**, szyld zamkniętej portowej stołówki w **ciepłej bieli**, oświetlenie biur dyspozytorskich w **błękicie królewskim** i **fiolecie**. Na tym tle jaskrawo odcinają się **czerwone** tarcze, promienie skanujące dronów i wizjery Kurogane, **cyanowe** ostrze gracza oraz **magentowe** wyładowania Rezonansu.
- **Struktura sektora:** Run w sektorze `kurogane` liczy **7 warstw** na mapie wyboru ścieżki (propozycja do strojenia), w tym trzy stałe pokoje fabularne:
  - **Warstwa 1 (Wejście):** punkt startowy oparty na `combatCorridor` lub `alleyUnderpass` (tunel techniczny pod nabrzeżem towarowym).
  - **Warstwa 2 (Nabrzeże):** wybór między placem kontenerów (`combatYard`) a punktem zaopatrzenia w kontenerze warsztatowym (`shopRoom`).
  - **Warstwa 3 (Plac celny — pierwsze spotkanie z Tarczownikami i dronami — stały pokój fabularny):** obowiązkowy węzeł oparty na `combatLaserYard`. Bramki laserowe między stosami skrzyń; drogę zamyka pierwsza formacja z **Tarczownikiem (`shielder`)** wspieranym przez **Drony (`drone`)**.
  - **Warstwa 4 (Zaplecze doków):** wybór między kładkami nad kanałem (`combatPlatforms`), zalaną strefą śluzy (`combatFloodedTunnel`) a pokojem odpoczynku w sterowni dźwigu (`restRoom`).
  - **Warstwa 5 (Antresola przeładunkowa):** wybór między trudniejszą walką o zasoby (`combatPillars`) a ostatnim zaopatrzeniem przed halą (`shopRoom` lub `restRoom`).
  - **Warstwa 6 (Przedpole Magazynu 9 — stały pokój fabularny):** obowiązkowy węzeł na bazie `eliteHall` lub większego wariantu `combatWarehouse`. Ciężki posterunek przed bramą magazynu z dwiema wieżyczkami i osłoną z Tarczowników; na jednym z bocznych terminali czeka zapiska o zmianie harmonogramu pociągów.
  - **Warstwa 7 (Magazyn 9 — Terminal spedycji — stały pokój fabularny):** finałowa arena na bazie `combatWarehouse` z podwyższonym podestem konsoli na środku sali. Wokół terminala wyznaczona jest strefa zasięgu o promieniu ok. 6 m (propozycja do strojenia). Po zakończeniu zrzutu danych otwiera się grodziowa brama dokowa prowadząca do kanału ewakuacyjnego.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Terminal spedycji (Warstwa 7):** ciężka konsola przemysłowa otoczona widocznym na podłodze okręgiem zasięgu dekodera Bajta. Wpięcie urządzenia trwa ok. 2 s, transfer ok. 90 s aktywnego czasu w strefie (do strojenia).
  - **Manifesty paletowe (x2, Warstwa 7 — opcjonalne):** czytniki przy bocznych rampach hali dostępne przed uruchomieniem pobierania.
  - **Brama dokowa (Warstwa 7):** odblokowuje się natychmiast po osiągnięciu 100% pobierania; wymaga dobiegnięcia przez halę pod ogniem niedobitków.
- **Wrogowie:**
  - Frakcja: **Kurogane Arms** (czerwone oznaczenia).
  - Archetypy w Misji 03:
    - **Tarczownik (`shielder` — debiut fabularny):** ciężki piechur z pełnowymiarową tarczą balistyczną; prze do przodu w wąskiej strefie terminala, próbując wypchnąć Kuriera z pola zasięgu dekodera. Wymusza obejście z boku, przełamanie albo odrzut mocami Rezonansu.
    - **Dron (`drone` — debiut fabularny):** lekka jednostka latająca ostrzeliwująca podest z góry ponad niskimi osłonami wokół konsoli.
    - **Szturmowiec (`assaulter`)** i **Strzelec (`gunner`):** kolejne fale z górnych galerii Magazynu 9 w trakcie pobierania (np. przy 25%, 55% i 85% postępu — propozycja do strojenia).
    - **Wieżyczka (`turret`):** rozstawiona przy bramkach w Warstwie 3 oraz nad wejściem na antresolę w Warstwie 6.
  - Brak bossa i brak elity `executor` w tej misji (ciężar starcia przeniesiony jest na utrzymanie małej strefy przeciw nowym formacjom `shielder` + `drone`).
- **Zagrożenia środowiskowe:**
  - Laserowe zapory przeładunkowe w Warstwie 3 (cyklicznie wyłączane skrzynkami sterowniczymi).
  - Otwarte kładki nad pustymi dokami i mało osłon w bezpośrednim kręgu wokół terminala w Warstwie 7 — wyjście za skrzynie daje osłonę przed ostrzałem, ale natychmiast zatrzymuje postęp pobierania.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Nadia przekazuje z Bulwaru schemat zmian wart w porcie, a Bajt wręcza dekoder krótkiego zasięgu. Szron uprzedza przed nowymi jednostkami osłonowymi przerzuconymi z fabryk do portu.
2. **Nabrzeże i plac celny (Warstwy 1–3):** Kurier wchodzi kanałem pod nabrzeże. Na placu celnym pierwszy raz trafia na Tarczowników wspieranych przez drony zwiadowcze; musi przebić się przez laserowe zapory.
3. **Przeprawa do strefy załadunkowej (Warstwy 4–6):** Przejście przez zaplecze doków do przedpola Magazynu 9. Zewnętrzna straż na antresoli stawia twardszy opór, ale po otwarciu głównych wrót magazyn stoi otworem.
4. **Terminal w Magazynie 9 (Warstwa 7):** Opcjonalne sprawdzenie ramp bocznych, następnie wpięcie dekodera. Zaczyna się 90-sekundowa obrona strefy wokół podestu: kolejne fale Szturmowców, Tarczowników i Dronów nacierają ze wszystkich stron, próbując wypchnąć Kuriera poza zasięg sygnału.
5. **Zakończenie zrzutu i odwrót:** Przy 100% Bajt przerywa transmisję i otwiera zdalnie grodzie na kanał portowy. Kurier zbiera dekoder i schodzi na zacumowaną łódź techniczną w śluzie.
6. **Powrót na Kamienną (`hideout`):** Bajt rozkłada zdobyte listy przewozowe. Zespół po raz pierwszy widzi nazwę odbiorcy i regularny cykl kolejowy: co tydzień kontener chłodniczy z „ładunkiem biologicznym klasy K” jedzie na Taras do Zakładu Kalibracji Helixa. Najbliższy skład odjeżdża za dwa dni.

## Dialogi

### Odprawa (kryjówka)

**Nadia *(przez radio przy biurku Bajta)*:** Zmiana na nabrzeżu przechodzi o północy, ale w Magazynie 9 nie gaszą już lamp w ogóle. Od wczoraj stoi tam podwójny patrol.
**Bajt:** Dobrze cię słyszeć z góry, Nadia. To urządzenie wygląda jak kostka do lutowania, ale ma antenę kierunkową krótkiego zasięgu. Wpinasz w terminal spedycji i stoisz w promieniu sześciu metrów.
**Mira:** Dlaczego, kurwa, nie możesz tego zgrać z zewnątrz, tylko trzeba warować przy biurku jak stróż nocny?
**Bajt:** Bo port ma własną sieć w miedzianym oplocie, odciętą od linii miejskich. Jak wyjdziesz poza krąg, bufor staje. Jak wyrwą wtyczkę, zaczynamy od zera.
**Szron:** Nowy problem w porcie: wyciągnęli z magazynów drużyny z tarczami balistycznymi i lekkie drony bojowe.
**Mira:** Na tarcze nie pchaj się od frontu. Obejdź z boku albo przestaw ich z miejsca Rezonansem. Drony zdejmuj od razu, zanim wejdą ci nad głowę.
**Tomasz:** Przejście pod nabrzeżem jest wąskie i śliskie po przypływie. Jeśli zaczną zamykać śluzy, uciekaj w stronę kanału wodnego, nie wracaj przez plac celny.
**Szron:** Bierz kostkę i ruszaj. Potrzebujemy wiedzieć, dokąd wyjeżdżają ludzie z tych skanów.

### W trakcie misji (radio)

**Wejście do sektora (Warstwa 1):**
**Bajt:** Jesteś w kanale kablowym pod pierwszym pirsem. Woda niska, czujniki ruchu przy studzience wyłączone — Nadia mówiła prawdę o konserwacji.
**Nadia *(przez przekaźnik)*:** Uważaj za załomem przy starych żurawiach. Wyłożyli tam tymczasowe bramki laserowe.

**Plac celny — pojawienie się Tarczowników i dronów (Warstwa 3):**
**Szron:** Uwaga, przed tobą ciężka tarcza i dwa drony na górze. Nie stój w świetle bramki.
**Mira:** Widzisz, jak ta płyta zasłania im cały tułów? Zmuś ich do obrotu albo strąć drona z boku. Z tym nie wygrasz na cierpliwość.
**Bajt:** Dobry refleks. Dron miał rejestrator wideo, ale nie zdążył wysłać pakietu do centrali.

**Przedpole Magazynu 9 (Warstwa 6):**
**Nadia:** Ten wysoki budynek z zielonym numerem dziewięć nad wrotami to stary magazyn chłodniczy. Ostatnia brama przed samą halą jest uzbrojona.
**Szron:** Wyczyść przedpole i wejdź do środka. Po wpięciu dekodera nie będzie już czasu na rozglądanie się po kątach.

**Wejście do Magazynu 9 (Warstwa 7):**
**Bajt:** Terminal spedycji stoi na podeście pośrodku hali, widać stąd błękitne diody serwera. Jeśli chcesz sprawdzić manifesty na bocznych rampach, zrób to teraz, zanim włączymy transmisję.

**Podłączenie dekodera (start transferu):**
**Bajt:** Mam połączenie! Nie odchodź od konsoli dalej niż na sześć metrów, bo sygnał rwie się na stalowych regałach.
**Szron:** Pierwsza zmiana wchodzi z galerii po lewej. Trzymaj środek hali.

**Wyjście poza strefę (komunikat warunkowy):**
**Bajt:** Transfer stanął, cholera! Wracaj pod terminal, tracimy okno przed zmianą warty!

**Połowa transferu — fala Tarczowników i dronów:**
**Mira:** Wypuszczają tarczowników po schodach z obu stron, skurwiele. Chcą cię zepchnąć z podestu za osłony!
**Szron:** Drony nad głową, najpierw strąć obserwatorów, potem rozbij szyk na dole. Została niecała minuta.

**90% transferu:**
**Bajt:** Ostatnia paczka plików idzie przez bufor, dziewięćdziesiąt procent! Słyszę, jak otwierają ciężką bramę z tyłu — kończę i odblokowuję wyjście dokowe!

**100% i ewakuacja:**
**Bajt:** Mam wszystko! Wyciągaj dekoder i zjeżdżaj na wschodni dok, grodzie są otwarte!
**Szron:** Nie walcz z posiłkami na środku hali. Przebij się prosto do kanału, łódź czeka za śluzą.

### Po misji (kryjówka)

**Bajt:** Dobra, przegrzało mi się pieprzone gniazdo w dekoderze, ale rejestr z trzech miesięcy jest czysty. Tylko... to się nie klei z żadnym transportem więziennym.
**Szron:** Mów krótko. Gdzie są ludzie z Niecki?
**Bajt:** W papierach spedycji nie ma ludzi. Jest jedna powtarzająca się pozycja co siedem dni: „ładunek biologiczny klasy K”, waga brutto czterysta dwadzieścia kilogramów, kontener chłodniczy z własnym zasilaniem.
**Mira:** Czterysta kilo z agregatem? To akurat jeden człowiek w ciężkiej skrzyni z aparaturą. Dokąd to jedzie?
**Bajt:** Wyłącznie koleją towarową na północ, przez główną windę towarową na Taras. Odbiorca: Helixa Dynamics, Zakład Kalibracji.
**Tomasz:** Czyli nie zamykają ich w więzieniu w Hutach. Wywożą ich na górę, do laboratoriów.
**Mira:** Sprawdź rozkład, Bajt. Kiedy następny skład?
**Bajt:** Za dwie noce, w środę o drugiej dwadzieścia. Wyjeżdża z trzeciego toru rozrządni, zanim przeładują go na pionowy szyb towarowy.
**Szron:** Dwa dni to wystarczająco mało, żeby nic nie poszło zgodnie z planem, jeśli nie ruszymy ich na torach. W Zakładzie na Tarasie nikt ich już nie wyciągnie.
**Mira:** Jeśli jedzie torami z Hut, to mój teren. Potrzebuję tylko planu zwrotnic przy rozrządni. Przejmiemy im ten wagon po drodze.
**Tomasz:** Zaczekajcie tylko, aż sprawdzimy, co właściwie siedzi w tym kontenerze. Żeby nie wciągnąć do tunelu czegoś, czego nie utrzymamy przy życiu.
**Szron:** Zbierajcie dane o wagonie. Za dwie noce stajemy na rozjeździe.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 95 Danych oraz 1 Rdzeń za ukończenie misji (oraz do 40 Danych z celów opcjonalnych); Kredyty z pokojów działają wyłącznie w trakcie bieżącego runu.
  - Dostęp do kolejnych ulepszeń broni dystansowej lub implantów defensywnych przeciw tarczom w warsztacie Miry.
- **Zmiany w kryjówce:**
  - Na tablicy taktycznej przy peronie B pojawia się schemat linii kolejowej Huty–Taras oraz zaznaczona godzina odjazdu najbliższego kontenera klasy K.
  - Postacie w kryjówce komentują pojawienie się Tarczowników w porcie i cel wywózki na Taras.
- **Co misja otwiera dalej:**
  - Odblokowuje **Misję 04 — Ładunek klasy K** (przejęcie i eskorta pociągu towarowego na bocznicach Hut).
  - Łączy zbrojeniówkę Kurogane z konkretną jednostką badawczą na Tarasie — Zakładem Kalibracji Helixa Dynamics.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Sektor `kurogane`, mapa wyboru ścieżki, szablony pokojów (`combatCorridor`, `alleyUnderpass`, `combatYard`, `combatLaserYard`, `combatPlatforms`, `combatFloodedTunnel`, `combatPillars`, `eliteHall`, `combatWarehouse`, `restRoom`, `shopRoom`).
  - Wrogowie: `assaulter`, `gunner`, `turret`, `shielder`, `drone`.
- **Nowe elementy potrzebne dla Misji 03:**
  - Mechanika strefy pobierania wokół terminala spedycji w Warstwie 7: widoczny okrąg zasięgu (6 m), pasek postępu (ok. 90 s), pauza transferu natychmiast po wyjściu gracza poza okrąg oraz wyzwalacze fal wrogów na określonych progach procentowych (25%, 55%, 85%).
  - Dwa opcjonalne punkty interakcji (manifesty paletowe) na bocznych rampach Magazynu 9.
  - Rozmieszczenie barier laserowych w `combatLaserYard` z wyłącznikami skrzynkowymi.
- **Propozycje do backlogu (poza minimum F5):**
  - Dynamiczne komunikaty głosowe lub świetlne w hali przy każdym progu 25% transferu i otwarciu górnych rolet dla posiłków.
