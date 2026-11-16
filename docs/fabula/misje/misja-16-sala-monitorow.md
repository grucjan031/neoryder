# Misja 16 — Sala monitorów

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| III | Orbis Grid | Bulwar, Sala Monitorów Orbis | Infiltracja bez wykrycia (eskorta) | Noc (propozycja: brak twardego limitu; okno między zmianami warty) | Po Misji 15 (Kamienna); odblokowuje Misję 17 (Przerwa w dostawie) |

## W skrócie

Po ataku na Kamienną Iskra nie ma już czasu na obronę i musi poznać konstrukcję Masztu oraz harmonogram projektu „Chór”. Bajt wraca do swojego dawnego stanowiska w Sali Monitorów Orbis na Bulwarze, bo potrzebnych planów nie da się wyciągnąć z zewnątrz. Kurier przeprowadza go przez budynek trasą dostaw od Nadii, omijając drony-kamery i unikając zamknięcia grodzi.

## Tło fabularne

Tej nocy w stacji Kamienna woda ze starej zastawki przeciwpowodziowej wciąż stoi na torach i części peronu B. Tomasz został przy zaworze i nie wrócił, a oddział Orbis Grid zabrał z magazynu Tymona, traktując go jako własność sieci. Beczka na peronie jest zimna, sprzęt przeniesiono wyżej na antresolę, a reszta ludzi zbiera się po ewakuacji.

Szron decyduje się na uderzenie w górę, zanim Orbis dokończy wdrożenie Chóru. Dokumenty z Zakładu Kalibracji potwierdziły, że Orbis kupuje całą produkcję Akordu, ale nie zawierały specyfikacji samego Masztu. Jedynym człowiekiem w Iskrze, który zna układ serwerowni Orbis na Bulwarze, jest Bajt — pracował tam dwa lata na kontrakcie, zanim odszedł po wysłaniu człowieka „do opieki”.

Nadia Korsak ustaliła przez dawnych znajomych kurierów, kiedy na tylną rampę budynku wjeżdżają nocne wózki z zaopatrzeniem. Gracz nie wie jeszcze, jak mało czasu zostało do uruchomienia Chóru ani że dawni koledzy Bajta zostali w dużej mierze zastąpieni przez automatykę.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Przeprowadzić Bajta od rampy rozładunkowej na parterze do jego dawnego stanowiska w Sali Monitorów Orbis.
  - Zminimalizować wykrycie przez drony-kamery (wykrycie nie kończy misji, ale wywołuje alarm, zamyka grodzie i wzywa posiłki, wydłużając i utrudniając drogę).
  - Osłaniać Bajta podczas fizycznego podpięcia się do terminala i pobrania planów Masztu oraz harmonogramu Chóru, a następnie opuścić budynek przez szyb techniczny.
- **Warunki porażki:**
  - Śmierć Kuriera lub utrata przytomności Bajta (propozycja do strojenia: w strefie skradania Bajt trzyma się za osłonami za graczem, a w razie alarmu chowa się we wnęce technicznej, dopóki Kurier nie oczyści przejścia).
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Pełne przejście bez wywołania alarmu* (brak wykrycia przez drony-kamery do momentu zakończenia pobierania) — nagroda: +35 Danych.
  - *Odpięcie przekaźnika nagrań w archiwum taśm* (krótka interakcja w Warstwie 3, która wymazuje z pamięci lokalnej zapis wjazdu z rampy) — nagroda: +20 Danych.

## Mapa

- **Miejsce i nastrój:** Boczna bryła kompleksu Orbis Grid przy estakadzie Bulwaru. Na zewnątrz motyw `neonStreet` (noc, ciągły deszcz, mokry beton rampy), wewnątrz ciemne, chłodne korytarze techniczne i półmrok hal operatorskich. Oświetlenie wyłącznie z palety ADR 0006: nad bramami rampy **ciepła biel** i **bursztyn** lamp ostrzegawczych, przy wyjściach **zieleń** piktogramów, za mokrymi szybami korytarza rozmyty **fiolet** i **błękit królewski** reklam z Bulwaru. Stożki skanerów dronów-kamer, zamki grodzi i patrole Orbis świecą **czerwienią**; ostrze gracza jest **cyanowe**, a Rezonans **magentowy**.
- **Struktura sektora:** Run liczy **7 warstw** na mapie wyboru ścieżki. Pokoje w warstwach 3, 5 i 7 są stałymi węzłami fabularnymi; między nimi gracz wybiera trasę bardziej techniczną lub bojową:
  - **Warstwa 1 (Wejście):** punkt startowy na bazie `alleyUnderpass` — tylny podjazd pod estakadą Bulwaru i śluza przy rampie rozładunkowej.
  - **Warstwa 2 (Zaplecze parteru):** wybór między cichym przejściem za szafami kablowymi (`combatCorridor`) a skrytką kurierską Nadii w nieużywanej sortowni (`shopRoom` — wymiana kredytów na ulepszenia przed wejściem głębiej).
  - **Warstwa 3 (Hala załadunkowa — stały pokój fabularny):** wariant `combatWarehouse`. Rzędy palet i kontenerów tworzą osłony przed pierwszymi dronami-kamerami patrolującymi w ustalonym rytmie; w rogu stoi skrzynka lokalnego archiwum taśm.
  - **Warstwa 4 (Pion techniczny):** wybór między rusztowaniem w szybie wentylacyjnym (`combatPlatforms`, skróty ruchowe dla podwójnego skoku i dasha) a dyżurką techniczną z bezpiecznikami (`restRoom` — odpoczynek i zrzut napięcia przed piętrem operatorskim).
  - **Warstwa 5 (Korytarz serwerowy — stały pokój fabularny):** wariant `combatLaserYard` przerobiony na korytarz z bramkami laserowymi i grodziami bezpieczeństwa. Jeśli na niższych poziomach doszło do wykrycia, grodzie są opuszczone i wymagają ręcznego obejścia lub przebicia się pod ogniem posiłków.
  - **Warstwa 6 (Przedpole Sali):** wybór między przejściem przez salę kolumnową ochrony (`combatPillars`) a bocznym magazynem sprzętu biurowego (`restRoom` albo `shopRoom`).
  - **Warstwa 7 (Sala Monitorów i ewakuacja — stały pokój fabularny):** wariant `eliteHall` / `plazaHolo` w ciemnej wersji wnętrzarskiej. Półkolista hala pełna rzędów wygaszonych i półwygaszonych ekranów, z jednym działającym stanowiskiem w narożniku i oknem szybu ewakuacyjnego od strony estakady.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Panele wyłączników lokalnych:** pozwalają Bajtowi na krótkie wygaszenie pojedynczych bramek laserowych (interakcja ok. 1,5 s — do strojenia).
  - **Grodzie bezpieczeństwa:** otwarte przy cichym przejściu; po alarmie zamykają główne przejścia i wymagają obejścia przez kanał boczny albo przecięcia zamka (ok. 3 s, hałas ściąga patrol).
  - **Dawne stanowisko Bajta (Warstwa 7):** terminal bez dostępu zdalnego; fizyczne zgranie pakietu trwa ok. 25 s (propozycja do strojenia).
  - **Klapa szybu technicznego (Warstwa 7):** wyjście ewakuacyjne na zewnętrzną kładkę pod estakadą Bulwaru.
- **Wrogowie:**
  - Frakcja: **Orbis Grid** (smukłe sylwetki, czerwona optyka).
  - **Dron-kamera (propozycja do backlogu; wariant zastępczy: `drone` + `hacker` ze stożkiem detekcji):** jednostka zwiadowcza z szerokim czerwonym stożkiem skanu. Nie zadaje dużych obrażeń, lecz pełne namierzenie (ok. 1,5 s w świetle stożka — do strojenia) wyzwala alarm piętra. Można go zniszczyć z zaskoczenia jednym czystym uderzeniem ostrza lub rzutem, zanim prześle sygnał.
  - W razie alarmu lub w strefach chronionych: **Szturmowiec (`assaulter`)**, **Strzelec (`gunner`)**, **Dron (`drone`)**, **Dron-haker (`hacker`)** oraz **Wieżyczka (`turret`)** przy zamkniętych grodziach.
- **Zagrożenia środowiskowe:**
  - Ruchome bramki laserowe w korytarzu serwerowym (cykl 3 s włączone / 2 s przerwy — do strojenia).
  - Alarm nie przerywa misji, ale na stałe zamyka skróty w Warstwie 5 i uruchamia dwie dodatkowe fale ochrony podczas pobierania w Warstwie 7.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Na suchym końcu peronu A Szron rozkłada szkic Bulwaru. Beczka stoi pusta i zimna, woda chlupie na torach poniżej. Bajt spina zestaw złącza bezpośredniego i nie ukrywa, że boi się powrotu na stare piętro. Nadia przez radio podaje kod bramy rozładunkowej i okno między dostawami.
2. **Rampa rozładunkowa (Warstwy 1–2):** Kurier i Bajt wchodzą w cieniu między wózkami towarowymi. Nadia utrzymuje krótką łączność z ulicy, pilnując czy na estakadzie nie stoi patrol.
3. **Hala załadunkowa (Warstwa 3):** Pierwsze drony-kamery przeczesują rzędy palet czerwonym światłem. Kurier wyczyszcza przejście po cichu albo wykorzystuje Rezonans do odciągnięcia uwagi i otwiera wewnętrzny właz dla Bajta.
4. **Pion techniczny i korytarz serwerowy (Warstwy 4–5):** Przejście wyżej. Jeśli dotąd obyło się bez alarmu, grodzie stoją otworem, a bramki laserowe da się przejść w rytmie cyklu. Po wcześniejszym wykryciu Kurier przebija się przez zamknięte przejścia i oddział Orbis z dronem-hakerem.
5. **Sala Monitorów Orbis (Warstwy 6–7):** Bajt dociera do narożnego rzędu stanowisk. Ku zaskoczeniu obojga przy biurku obok siedzi kobieta w wieku trzydziestu kilku lat z papierowym kubkiem po zimnej kawie — Marta Górska, jego dawna koleżanka ze zmiany. Patrzy na Bajta, rozpoznaje go i nie sięga po przycisk alarmu. Wypowiada kilka cichych słów o tym, że ludzie już niczego tu nie oznaczają.
6. **Pobieranie i wyjście (Warstwa 7):** Bajt zgrywa plany konstrukcyjne Masztu i harmonogram uruchomienia Chóru. Gdy dane są pełne, okazuje się, że aktywacja nastąpi za trzy dni. Kurier wyprowadza Bajta przez szyb techniczny na kładkę pod estakadą, zanim następna zmiana dronów zamknie sektor.
7. **Powrót na Kamienną (`hideout`):** Bajt rozrzuca schematy Masztu na stole przy stanowisku łączności. Wolan analizuje pobór mocy i wskazuje trzy podstacje zasilające osłony wieży — jedyną drogę, żeby dostać się do środka przed upływem trzech dni.

## Dialogi

### Odprawa (kryjówka)

**Szron:** Woda stanęła pod drugim słupem, dalej nie podejdzie. Zostajemy na Kamiennej, ale nie możemy tu siedzieć i czekać na kolejny nalot.
**Mira:** Magazyn pod antresolą jest pusty. Zabrali tylko Tymona, reszty sprzętu nawet nie tknęli.
**Bajt:** Bo nie przyszli po lutownice. Wiedzieli dokładnie, kogo zabrać.
**Szron:** Tymonem zajmiemy się zaraz po tym, jak zobaczymy, co stawiają na szczycie Masztu. Bajt, mów o budynku na Bulwarze.
**Bajt:** Sala Monitorów Orbis, trzecie piętro nad rozładunkiem. Plany Masztu i harmonogram nie wiszą w otwartej sieci — siedzą w zamkniętym lanie za moim dawnym stanowiskiem. Muszę podpiąć się kablem.
**Mira:** I nie ma tam nikogo z twoich starych znajomych, kto pamięta twarz?
**Bajt:** Z tej zmiany, co ze mną zaczynała, pewnie nikt już nie został. Ludzie nie wytrzymują tam dłużej niż dwa lata.
**Nadia (radio):** Tu Nadia. Wózki z matrycami wjeżdżają na rampę od północy dokładnie za dwadzieścia minut. Kierowca zawsze zostawia bramę niedomkniętą na szerokość palety, żeby nie wpisywać nowego zlecenia na czytniku.
**Szron:** Wchodzisz z Bajtem tym samym przejściem, Kurier. Bez strzelania na wejściu, dopóki nie będzie trzeba.
**Bajt:** Drony-kamery mają tam wąskie korytarze i długie czerwone stożki. Jak cię złapie światło i zdąży nadać impuls, zrzucą grodzie na piątej kondygnacji.
**Mira:** Jak zamkną grodzie, otworzysz je tylko cięciem albo ładunkiem, a wtedy zlecą się z całego piętra. Trzymaj Bajta za plecami i wycinaj te pieprzone puszki, zanim pisną.
**Wolan:** Potrzebuję dokładnego schematu zasilania osłon Masztu. Bez tego nawet z moim sygnałem nie przebijemy się przez pancerz radiowy na górze.
**Szron:** Kurier, ruszaj z Bajtem przez kanał pod trzecim filarem. Nadia poda czyste wyjście pod estakadę.

### W trakcie misji (radio)

**Wejście pod rampę (Warstwa 1):**
**Nadia:** Widzę was spod przystanku kolejki. Wózek właśnie minął bramę, masz jakieś czterdzieści sekund, zanim ochroniarz wróci do budki.
**Bajt:** Dobra, wlazłem. Ręce mi trochę drżą, nie byłem tu od trzech lat. Prowadź, Kurier.

**Hala załadunkowa — pierwsze drony-kamery (Warstwa 3):**
**Bajt:** Widzisz te czerwone stożki przy suficie? To nowe patrole, wcześniej siedzieli tam ludzie na krzesłach.
**Szron:** Nie czekaj, aż się obrócą do ściany. Użyj osłon z palet albo zdejmij drona, zanim zapali pełny sygnał.

**Opcjonalnie — w razie wykrycia i włączenia alarmu:**
**Bajt:** Kurwa, złapał nas! Słyszysz ten brzęczyk? Grodzie na korytarzu serwerowym właśnie poszły w dół.
**Szron:** Spokojnie. Zmień trasę na kanał boczny albo tnij zamek. Będą iść z góry, szykuj ostrze.

**Opcjonalnie — bez wykrycia w połowie drogi (Warstwa 4):**
**Bajt:** Czysto. Jeszcze nigdy nie przeszedłem tego piętra tak cicho, nawet jak tu pracowałem.
**Nadia:** Na zewnątrz bez zmian, nikt nie wyjeżdża z garażu. Trzymajcie tempo.

**Korytarz serwerowy (Warstwa 5):**
**Bajt:** Tutaj kiedyś trzeba było skanować identyfikator co dziesięć metrów. Teraz wystarcza rytm bramek laserowych.
**Mira:** Nie spiesz się na siłę, Kurier. Wyłączniki po lewej zdejmują pojedyncze bariery na kilka sekund.

**Sala Monitorów Orbis — wejście i spotkanie z Martą (Warstwa 7):**
**Bajt:** Czekaj... tam w rogu pali się jedno stanowisko. Ktoś siedzi na nocnej zmianie.
**Szron:** Zdejmij cel po cichu albo omiń przy ścianie.
**Bajt:** Nie, poczekaj. Znam ten profil... Marta?
**Marta:** Czwarty rząd, drugie od okna. Nikt go nie przypisał od lat. Pomyślałam, że tylko ty mógłbyś po niego wrócić, najmniejszy.
**Bajt:** Nie wołasz patrolu?
**Marta:** Po co? Nikt tu już niczego nie oznacza, Bajt. Robią to drony.
**Bajt:** Długo już tak?
**Marta:** Od pół roku. Dwie osoby na zmianę, reszta to krzesła.
**Bajt:** Mogłaś odejść.
**Marta:** Mogłam. Mam kredyt.
**Bajt:** Marta...
**Marta:** Nie tłumacz się. Ty wyszedłeś, ja zostałam. Ktoś musiał.
**Bajt:** Pamiętasz to nagranie z manifestacji?
**Marta:** Pamiętam. Nie pytaj o więcej. Dwie godziny do końca zmiany. Rób to, po co przyszedłeś, zanim system porówna logi z bramki. Ja dopiję kawę.

**Pobieranie danych (Warstwa 7):**
**Bajt:** Kabel wpięty. Ten sam fotel, kurwa, ten sam ekran. Mam architekturę Masztu... i plik harmonogramu. Kurier, osłaniaj wejście, na wszelki wypadek.
**Bajt:** Już jest. Chwila... Szron, słyszysz to? Data uruchomienia Chóru to za trzy dni. Równo o północy.
**Szron:** Trzy dni. Zwijaj sprzęt i wychodzicie szybem na estakadę.

**Ewakuacja na zewnątrz:**
**Nadia:** Klapa pod przęsłem numer cztery jest otwarta. Zostawiłam wam drabinkę serwisową.
**Bajt:** Dane są na dysku, bez strat. Wracamy na dół, Kurier.

### Po misji (kryjówka)

**Bajt:** Cała konstrukcja Masztu od fundamentów w Hutach aż po iglicę na Koronie. I pełny harmonogram rozruchu Chóru — za trzy noce o północy.
**Wolan:** Pokaż schematy zasilania. Ten węzeł na szczycie nie ciągnie energii z jednego kabla... Osłony Masztu trzymają trzy zewnętrzne podstacje.
**Szron:** Gdzie?
**Wolan:** Jedna w Hutach, druga na estakadzie Bulwaru, trzecia przy starej tamie w Niecce. Kiedy zgaśnie jedna, sieć natychmiast przerzuca obciążenie na dwie pozostałe.
**Mira:** Czyli nie możemy zdejmować ich po jednej przez tydzień. Muszą paść wszystkie naraz, w jednym oknie.
**Bajt:** Wtedy Maszt straci osłony na tyle długo, żeby przebić się przez piętra.
**Mira:** Dobrze. Im szybciej wyłączymy im prąd, tym szybciej wejdziemy po Tymona. Ja biorę jutro prowadzenie przez radio.
**Szron:** Zgoda. Ale najpierw odpocznijcie kilka godzin. Od jutra dół miasta gaśnie razem z nimi.
**Bajt:** Wiesz, Szron... w tej sali było prawie pusto. Dwa rzędy krzeseł, trzy osoby na krzyż i szum wentylatorów. Resztę robią już same maszyny.
**Szron:** Tym łatwiej będzie je odłączyć. Zrób kopię planów dla Wolan i idź spać.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 95 Danych oraz 2 Rdzenie za ukończenie misji (plus do 55 Danych z celów opcjonalnych).
  - Odblokowanie schematu ulepszenia ocalałego z warsztatu (lub zniżki na modyfikację skradania/zasięgu wykrywania w sklepie runu).
- **Zmiany w kryjówce:**
  - Na biurku Bajta pojawiają się rozłożone schematy przekroju Masztu oraz odliczanie do aktywacji Chóru (3 dni).
  - Beczka Tomasza nadal pozostaje zimna; woda stoi w niższej części tunelu. Postacie komentują powrót Bajta do Sali Monitorów i trzydniowe okno.
- **Co misja otwiera dalej:**
  - Odblokowuje **Misję 17 — Przerwa w dostawie** (wyłączenie trzech podstacji zasilających osłony Masztu w jednym oknie czasowym).
  - Wskazuje konkretny cel finału Aktu III: wejście na Maszt i zatrzymanie Chóru przed upływem trzech dni.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Pętla runu w sektorze `korona` / `bulwar` (motyw `neonStreet`), szablony pokojów (`alleyUnderpass`, `combatCorridor`, `combatWarehouse`, `combatPlatforms`, `combatLaserYard`, `combatPillars`, `eliteHall`, `restRoom`, `shopRoom`) oraz wrogowie `assaulter`, `gunner`, `drone`, `hacker`, `turret`.
- **Nowe elementy potrzebne dla Misji 16:**
  - Logika **eskorty skradankowej Bajta** (sojusznik podążający za graczem od osłony do osłony, bez samodzielnej walki, czekający w punkcie bezpiecznym w razie alarmu).
  - Mechanika **globalnego stanu alarmu w runie**: wykrycie w Warstwach 3–6 zamyka główne grodzie w Warstwie 5 i dodaje fale posiłków w Warstwie 7.
  - Krótka scena fabularna z **Martą** przy stanowisku w Warstwie 7 (bez walki, kwestia wyzwalana po podejściu do biurka).
  - Terminal pobierania danych z paskiem postępu (ok. 25 s) oraz wyjście szybem ewakuacyjnym.
- **Propozycje do backlogu:**
  - Archetyp **drona-kamery** ze stożkiem widzenia na podłodze, licznikiem wykrycia i możliwością cichej eliminacji z bliska (do czasu wdrożenia zastępowalny dronem z wyzwalaczem alarmu).
  - Opcjonalne czyszczenie logów z archiwum taśm w Warstwie 3.
