# Misja 12 — Śluza

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| II | Helixa Dynamics | Taras, oczyszczalnia odpadów medycznych pod kampusem | Przeprawa na czas | Limit okna zmiany procedur (propozycja: 9–11 min na przejście sekcji zalewowych) | Po Misji 11 (Nadajnik); odblokowuje Misję 13 (Kamerton) |

## W skrócie

Po przejęciu przekazu przez Orbis jedynym sposobem na powstrzymanie produkcji Akordu jest uderzenie w Zakład Kalibracji pod kampusem Helixa. Frontowe wejścia na Tarasie są zamknięte po nocnym alarmie, więc Kurier wchodzi od spodu przez podziemną oczyszczalnię odpadów medycznych. Przez radio prowadzi doktor Helena Wolan, która piętnaście lat temu projektowała pierwszy zakład — i po raz pierwszy jej przeszłość daje Iskrze realną przewagę przed drzwiami, za którymi czeka doktor Agata Lind.

## Tło fabularne

Od Misji 10 nikt w kryjówce nie patrzy na Wolan tak jak dawniej. Szron ograniczył z nią kontakt do niezbędnych pytań technicznych, a Bajt rozmawia z nią tylko o plikach. Mimo to, kiedy trzeba wejść do Zakładu Kalibracji bez przebijania się przez cały garnizon Tarasu, okazuje się, że tylko ona zna układ techniczny podziemi.

Piętnaście lat temu, zanim Helixa Dynamics przekształciła jej terapię w przemysłową hodowlę wzorców, Wolan zatwierdzała plan pierwszego skrzydła badawczego i połączonej z nim oczyszczalni odpadów. Zbiorniki zalewane są cyklicznie roztworem sterylizującym między zmianami filtrów, a główne grodzie ciśnieniowe zostawiają krótkie okno przejścia podczas nocnego płukania.

Gracz nie zna jeszcze skali zakupów Orbis Grid ani nazwy projektu „Chór” (te informacje pojawią się dopiero w Zakładzie Kalibracji w Misji 13). Wie natomiast, że w środku leżą żywe kamertony, a wśród personelu znajduje się dawna uczennica Wolan — doktor Agata Lind, której Akord zestrojono bezpośrednio z Idą.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Przejść przez strefę oczyszczalni odpadów medycznych pod Tarasem w ramach okna zmiany procedur, zanim system automatycznie zablokuje grodzie główne.
  - Otworzyć trzy grodzie ciśnieniowe przez ręczne obejście na panelach zaworów (każde obejście trwa ok. 2 s — propozycja do strojenia).
  - Dotrzeć do zewnętrznej śluzy serwisowej Zakładu Kalibracji i wgrać klucz dostępu na kolejne uderzenie.
- **Warunki porażki:**
  - Śmierć Kuriera (od ognia ochrony, laserów lub środka sterylizującego w zalanych nieckach).
  - Wygaśnięcie zegara okna zmiany procedur przed otwarciem trzeciej grodzi ciśnieniowej.
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Zgranie grafiku dyżurów z terminala dozowania* (warstwa 4 lub 5, przed końcem zegara) — nagroda: +20 Danych oraz wcześniejszy wgląd w obsadę skrzydeł w Misji 13.
  - *Przejście obu komór dekontaminacyjnych bez dotknięcia rozlanego sterylizantu* — nagroda: +1 Rdzeń.

## Mapa

- **Miejsce i nastrój:** Podziemna oczyszczalnia odpadów medycznych między górnym poziomem Bulwaru a fundamentami Tarasu, wariant podziemno-przemysłowy bez deszczu z zewnątrz, z ciężką wilgocią, parą z rur i zapachem ozonu. Otoczenie ciemne, gładki beton i stal kwasoodporna w chłodnym cieniu. Paleta ADR 0006: **ciepła biel** lamp sterylnych (przygasająca tuż przed każdym zrzutem płynu), **bursztynowe** lampy ostrzegawcze cyklu zalewania, **zielone** wskaźniki otwartych zaworów i bezpiecznych pomostów, **błękit królewski** zbiorników filtracyjnych, **fiolet** świetlówek UV w śluzach przejściowych. Czerwone są wyłącznie wiązki barier laserowych ochrony, czujniki wieżyczek oraz patrole Helixa; cyan — ostrze gracza; magenta — Rezonans.
- **Struktura sektora:** Run liczy **6 warstw** nastawionych na tempo, skoki, dash i czytanie rytmu środowiska (mniej masowej walki niż w poprzednich misjach, więcej przeszkód technicznych). Trzy pokoje fabularne mają stałą pozycję:
  - **Warstwa 1 (Wejście):** kolektor przelewowy oparty na `combatFloodedTunnel` — rura spustowa od strony estakad, płytka woda na dnie, pierwsza krata wyjściowa.
  - **Warstwa 2 (Hala filtrów):** wariant `combatLaserYard` — rzędy wysokich kadzi z ruchomymi barierami laserowymi ochrony i dwoma patrolami technicznymi.
  - **Warstwa 3 (Komora Dekontaminacyjna A — stały pokój fabularny):** zmodyfikowany `combatCorridor` z cyklicznym zalewaniem dolnej niecki (ok. 22 s suchego przejścia -> 4 s sygnału ostrzegawczego -> 10 s zalewu sterylizantem — propozycja do strojenia). Nad podłogą biegną rury i wąskie pomosty serwisowe do przejścia górą.
  - **Warstwa 4 (Rozdział tras):** wybór między szybką, ryzykowną przeprawą po kratownicach nad osadnikiem (`combatPlatforms`, skraca drogę o ok. 45 s zegara) a suchą maszynownią pomocniczą z regeneracją (`restRoom`) lub ukrytą szafką z modułami (`shopRoom` — porzucony wózek techniczny).
  - **Warstwa 5 (Komora Dekontaminacyjna B i Gródź Główna — stały pokój fabularny):** wariant `eliteChemPlant`. Wielopoziomowa hala pomp z podwójnym torem laserów, dwoma zaworami obejścia grodzi do przestawienia w odpowiedniej kolejności oraz wieżyczkami pilnującymi górnych kładek.
  - **Warstwa 6 (Śluza Zakładu Kalibracji — stały pokój fabularny):** sterylny łącznik oparty na `combatCorridor` kończący się ciężkimi drzwiami pancernymi z oznaczeniem Zakładu Kalibracji. Po zamknięciu grodzi za plecami gracza zegar okna procedur zatrzymuje się, a Kurier zabezpiecza zamek serwisowy pod podejście zespołu w Misji 13.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Zawory i panele obejścia grodzi (x3):** przy wejściu do Komory A, w hali pomp i przed ostatnim łącznikiem; wymagają krótkiego przytrzymania interakcji, żeby zablokować zamykanie wrót.
  - **Skrzynki zasilania barier laserowych:** w warstwie 2 i 5 pozwalają ręcznie wyłączyć jedną linię laserów zamiast przeskakiwać przez wiązkę lub przeciskać się ślizgiem.
  - **Terminal dozowania (opcjonalny):** przy bocznym podeście w warstwie 5.
  - **Zamek serwisowy Zakładu Kalibracji (warstwa 6):** po podpięciu kodu od Wolan otwiera stały dostęp od spodu pod kolejną misję.
- **Wrogowie:**
  - Frakcja: **Helixa Dynamics** (nieliczna wewnętrzna ochrona techniczna w gładkich białych płytach z czerwonymi wizjerami — zgodnie z założeniem misji stawiającej na środowisko).
  - Archetypy w Misji 12:
    - **Wieżyczka (`turret`):** stacjonarna nad panelami zaworów i przy wrotach grodzi.
    - **Dron (`drone`):** patrole inspekcyjne nad kadziami i zbiornikami.
    - **Strzelec (`gunner`) i Szturmowiec (`assaulter`):** pojedyncze pary konserwatorów ochrony w śluzach przejściowych.
  - Propozycja do backlogu: *technik dekontaminacji Helixa* (odporny na roztwór sterylizujący w nieckach, rzuca granaty-strzykawki z gazem żrącym; wariant zastępczy: `gunner` z ostrzałem strefowym).
- **Zagrożenia środowiskowe:**
  - **Środek sterylizujący w komorach zalewowych:** w momencie zalania podłoga w niecce zadaje ciągłe obrażenia (propozycja: 12 pkt/s — do strojenia) i spowalnia ruch; przejście górą po rurach i kładkach jest całkowicie bezpieczne.
  - **Bariery laserowe:** stałe (omijane podwójnym skokiem lub ślizgiem pod górną wiązką) oraz naprzemienne w rytmie co 3 s.
  - **Grodzie ciśnieniowe:** opadają po upływie czasu okna procedury; w trakcie zamykania dają 5 s bursztynowego sygnału alarmowego.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Szron wyznacza wejście pod kampus jeszcze tej nocy. Zwraca się do Wolan krótko i oficjalnie, prosząc o schematy dolnej oczyszczalni. Wolan podaje okno między płukaniem komór i zgłasza się do prowadzenia przez radio. Ida nie mówi wiele, ale patrzy na szkic zakładu i wspomina, że pamięta zapach ozonu za ostatnią śluzą.
2. **Kolektor i hala filtrów (Warstwy 1–2):** Kurier schodzi do rury przelewowej pod Tarasem, przebija się przez pierwsze bariery laserowe i cicho zdejmuje drony inspekcyjne, żeby nie uruchomić głównego alarmu przed wejściem w komory.
3. **Komora Dekontaminacyjna A (Warstwa 3):** Rozpoczyna się odliczanie okna procedur. Wolan z pamięci dyktuje rytm płukania: po błysku bursztynowych lamp sterylizant zalewa dno niecki. Kurier skacze po rurach pod sufitem, zrzuca pojedynczych strażników na pomost i przestawia pierwszy zawór obejścia.
4. **Skok przez osadnik lub maszynownię (Warstwa 4):** Gracz wybiera albo zysk czasowy na kładkach nad zbiornikami osadu, albo szybkie uzupełnienie sił w suchej maszynowni.
5. **Komora B i rozbieżność w planach (Warstwa 5):** W hali pomp jeden z dwóch zaworów znajduje się w innym miejscu, niż pamiętała Wolan — budynek modernizowano już po jej odejściu. Wolan nie szuka wymówek, szybko wylicza kierunek przepływu po ciśnieniomierzu na ścianie i naprowadza Kuriera na właściwą skrzynkę między wiązkami laserów i ogniem wieżyczek.
6. **Przed drzwiami Zakładu Kalibracji (Warstwa 6):** Kurier zamyka za sobą ostatnią gródź ciśnieniową, przechodzi sterylny korytarz i wpina obejście w zamek drzwi pancernych. Na chwilę w eterze robi się cicho. Z kryjówki odzywa się Ida — po raz pierwszy z wyraźnym napięciem w głosie: *„Ona jest w środku. Lind. Czuję ją.”*
7. **Powrót na Kamienną (`hideout`):** Po zabezpieczeniu dostępu przez śluzę Kurier wycofuje się tą samą rurą przelewową na zbiórkę przed szturmem (trasa pod zamkniętą komorą zostaje już na stałe otwarta obejściem). W kryjówce Szron bez komentarza przyznaje, że prowadzenie Wolan zadziałało bez błędu. Reszta przygotowuje się do wejścia w głąb zakładu.

## Dialogi

### Odprawa (kryjówka)

**Szron:** Kampus na górze stoi pod pełną strażą od akcji w Bulwarze. Bramą frontową nie przejdziemy bez ciężkich strat.
**Wolan:** Jest jedno wejście od spodu. Oczyszczalnia odpadów medycznych między podporami Tarasu a kanałem zrzutowym.
**Bajt:** Próbowałem złapać tam kamery, ale ten odcinek ma lokalną pętlę bez wyjścia na miasto. Ciemna dziura.
**Wolan:** Bo nigdy nie miał mieć podglądu z zewnątrz. Zatwierdzałam projekt pierwszego skrzydła piętnaście lat temu. Między drugą a trzecią w nocy pompy płuczą obie komory dekontaminacji w stałym cyklu — w tym oknie grodzie ciśnieniowe zostają na trybie serwisowym.
**Szron:** Ile mamy czasu w takim oknie?
**Wolan:** Około dziesięciu minut, zanim automaty zamkną obejścia. Jeśli nie przestawimy trzech ręcznych zaworów po drodze, śluza pod zakładem zarygluje się do rana.
**Mira:** A co, kurwa, leci tymi rurami, kiedy pompy zaczynają płukanie?
**Wolan:** Roztwór sterylizujący. Nie zabija od razu, ale przeżre uszczelki i skórę w kilkanaście sekund. Trzeba trzymać się górnych rur i pomostów.
**Szron:** Prowadzisz przez radio, doktor Wolan. Bez dygresji.
**Wolan:** Tak będzie najlepiej.
**Ida:** Tam śmierdzi ozonem. I zimnym metalem. Nawet jak oczy są zamknięte, słychać te pompy pod podłogą.
**Mira:** Nie musisz tam schodzić, Ida. Zostajesz na górze z Bajtem.
**Ida:** Ona jeszcze nie wie, że tam idziemy. Ale jak przekroczysz ostatnią gródź, od razu poczuje.
**Szron:** Zostawimy jej mało czasu na myślenie. Kurier, kanał stoi otwarty. Wchodzisz przed drugą.

### W trakcie misji (radio)

**Wejście do kolektora (warstwa 1):**
**Wolan:** Jesteś w kanale przelewowym. Rura przed tobą wychodzi pod halę filtrów.
**Bajt:** Na krótkim paśmie słychać tylko szum pomp. Ochrona siedzi na wyższych poziomach, tu na dole trzymają głównie automaty.

**Hala filtrów (warstwa 2):**
**Wolan:** Za kadziami zaczynają się bariery laserowe. Skrzynki odcinające stoją po lewej stronie każdego rzędu, ale jeśli spieszysz się przed zegarem, przejdziesz pod górną wiązką ślizgiem.

**Start okna w Komorze A (warstwa 3):**
**Wolan:** Zaczęło się płukanie. Masz dziesięć minut na przejście przez obie komory do głównej śluzy.
**Wolan:** Patrz na bursztynowe lampy pod sufitem. Trzy sekundy po pierwszym błysku spuszczają sterylizant na dno niecki — wskakuj wtedy na rurociąg nad głową.
**Mira:** I nie zdejmuj osłon na buty w biegu, jak ci chlapnie to gówno na spodnie. Wytrzymają parę kroków, nie dłużej.

**Rozwidlenie nad osadnikiem (warstwa 4):**
**Bajt:** Jeśli pójdziesz górną kratownicą nad osadnikiem, oszczędzisz prawie minutę, ale nie ma tam gdzie usiąść. Maszynownia z boku wygląda spokojniej.
**Szron:** Wybierz drogę pod swój zapas czasu, Kurier. Bez zbędnego ryzyka, jeśli masz przewagę.

**Komora B — zmiana po modernizacji (warstwa 5):**
**Wolan:** Zawór obejścia powinien być na środkowym filarze, między dwiema wieżyczkami.
**Wolan:** Chwileczkę... widzę po skoku ciśnienia na twoim odczycie, że przenieśli kolektor. Przebudowali tę sekcję już po moim odejściu.
**Szron:** Gdzie teraz stoi?
**Wolan:** Nie zgaduję — patrz na główną rurę w kolorze błękitu pod sufitem, idzie w prawo. Zawór musi być na końcu tej nitki, za drugą linią laserów.
**Bajt:** Kurwa, zgadza się, złapałem krótkie echo przekaźnika po prawej! Dobry strzał, doktorze.

**Za ostatnią grodzią (warstwa 6):**
**Wolan:** Gródź zamknięta. Automaty nie przerzucą już blokady wstecz, jesteś w suchym łączniku pod zakładem.
**Szron:** Podepnij klucz do zamka serwisowego przy drzwiach pancernych. Zamek otworzy nam drogę dla ludzi z noszami.
**Ida:** ...Zaczekaj. Nie otwieraj jeszcze tych drzwi.
**Mira:** Ida? Co się dzieje?
**Ida:** Ona jest w środku. Lind. Czuję ją przez ścianę — ma ten sam wzorzec co ja, tylko głośniejszy. Zimniejszy.
**Szron:** Zapisaliśmy sygnał, Kurier. Odsuń się od śluzy i wracaj kanałem powrotnym. Wchodzimy tam wszyscy razem, jak tylko zbierzemy zespół ewakuacyjny.

### Po misji (kryjówka)

**Szron:** Obejście zamka działa. Sprawdziłem odczyt z końcówki — drzwi do Zakładu Kalibracji możemy otworzyć w dowolnym momencie od spodu.
**Mira:** Ile czasu straciliśmy przy tym przestawionym zaworze?
**Wolan:** Osiemnaście sekund. Wystarczyło na zejście do śluzy przed blokadą.
**Bajt:** Przynajmniej wiemy, czego się spodziewać w instalacjach. Jeśli zmienili układ rur po pani odejściu, mogli też dołożyć nowe stanowiska w samym zakładzie.
**Wolan:** Mogli. Zwłaszcza jeśli zwiększyli produkcję tak, jak wynikało z rejestru z Bulwaru.
**Szron:** Dobrze poprowadziłaś, Helena. Bez tych schematów stracilibyśmy pół nocy na szukanie obejść pod ostrzałem.
**Wolan:** Piętnaście lat temu podpisałam odbiór tych rur. To żaden powód do podziękowań.
**Ida:** Agata tam siedzi. Nie śpi. Kiedy zbliżysz się do centralnej hali, od razu rozpozna, że idzie ktoś z zewnątrz — nie z jej maszyn.
**Mira:** Więc nie damy jej czasu na ustawienie ludzi przy wyjściach. Pakuję sprzęt do wyważenia grodzi i nosze na antresolę.
**Szron:** Odpocznij godzinę, Kurier. Następnym razem nie wracamy pustą rurą — wyprowadzamy stamtąd ludzi.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia):**
  - 95 Danych oraz 1 Rdzeń za ukończenie misji (plus do +20 Danych i +1 Rdzeń za cele opcjonalne).
  - Odblokowanie modyfikacji odporności środowiskowej / krótszego czasu odnowienia dasha w warsztacie Miry (opcjonalnie).
- **Zmiany w kryjówce:**
  - Brak zmian przestrzennych na stacji Kamienna; na stole przy tablicy misji pojawiają się rozłożone schematy oczyszczalni i szkic trzech skrzydeł Zakładu Kalibracji.
  - Szron w rozmowach z Wolan wraca do rzeczowej współpracy roboczej, choć bez dawnej bliskości; Ida staje się wyraźnie niespokojna przed wejściem do zakładu.
- **Co misja otwiera dalej:**
  - Odblokowuje **Misję 13 — Kamerton** (bezpośredni szturm na Zakład Kalibracji pod kampusem i starcie z dr Agatą Lind).

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Szablony `combatFloodedTunnel`, `combatLaserYard`, `combatCorridor`, `combatPlatforms`, `eliteChemPlant`, `restRoom`, `shopRoom`.
  - Przeciwnicy `turret`, `drone`, `gunner`, `assaulter`.
- **Nowe elementy potrzebne dla Misji 12:**
  - Globalny licznik okna zmiany procedur dla warstw 3–5 (zatrzymujący się w momencie zamknięcia grodzi w warstwie 6).
  - Cykliczne zagrożenie środowiskowe w `combatCorridor` i `eliteChemPlant`: ostrzeżenie wizualno-dźwiękowe (bursztynowe lampy), podniesienie poziomu płynu sterylizującego w nieckach i zadawanie obrażeń przy kontakcie z podłogą.
  - Interaktywne zawory obejścia grodzi i skrzynki odcinające wybrane linie barier laserowych.
- **Propozycje do backlogu:**
  - Technik dekontaminacji Helixa z kombinezonem ochronnym i granatami-strzykawkami (obecnie zastępowany przez `gunner`).
  - Wpływ opcjonalnego grafiku dyżurów z warstwy 5 na czytelność oznaczeń skrzydeł w Misji 13.
