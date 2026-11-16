# Misja 06 — Odlewnia

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| I (finał) | Kurogane Arms | Huty, czynna odlewnia — siedziba ochrony | Likwidacja dyrektora (boss: Oskar Brandt) + zgranie serwera | Noc / przedświt (brak limitu czasowego) | Po Misji 05 (Adiutant); zamyka Akt I, odblokowuje **Bulwar** i **Taras** (Misja 07) |

## W skrócie

Z kartą zdobytą na porucznik Wirskiej Kurier otwiera wejście serwisowe czynnej odlewni we wschodnich Hutach, gdzie mieści się główna siedziba ochrony Kurogane Arms. Przebija się przez hale wytopu i elitarną straż aż do centrum dowodzenia nad kadziami, gdzie Oskar Brandt rozpoznaje przez radio głos Szrona — swojego dawnego porucznika uznanego za zmarłego. Po trzyfazowym starciu z Brandtem i jego ostatnim wyznaniu („Ja tylko dowożę”) Kurier zgrywa z serwera dowody: sześcioletnie kontrakty z Helixą, powtarzające się słowa „Akord” i „kamerton”, listę setek przekazanych Rezonantów oraz zaszyfrowany folder o nazwie „Palacz”.

## Tło fabularne

Meldująca o zasadzce Wirska postawiła ochronę odlewni w stan najwyższej gotowości, ale zapasowa karta nadal otwiera techniczne przejście od strony chłodni, zanim Brandt zdąży fizycznie wymienić zamki na wszystkich poziomach. Dla Iskry to jedyna okazja, żeby wejść w serce zbrojeniówki, zanim dowództwo Kurogane przeniesie serwery pod osłonę górnych dzielnic.

Oskar Brandt to były żołnierz liniowy, który awansował na Dyrektora Ochrony i traktuje wyłapywanie Rezonantów jak zwykły kontrakt logistyczny. Nie lubi naukowców z Helixa Dynamics, ale wykonuje umowę bez pytań, a przed laty zamknął sprawę dezercji Szrona fałszywym wpisem o śmierci w Niecce. Obie strony wiedzą, że z tej hali wyjdzie tylko jedna z nich.

Gracz nie wie jeszcze, czym są wymienione w kontraktach „Akord” i „kamerton”, ani że w zaszyfrowanym folderze „Palacz” kryją się meldunki informatora działającego od dziewięciu lat wewnątrz samej Iskry.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Użyć karty Wirskiej do otwarcia wejścia serwisowego Odlewni i dotrzeć do głównego centrum dowodzenia nad halą wytopu.
  - Pokonać Dyrektora Ochrony Oskara Brandta (`securityChief`, trzy fazy walki: 100%, 65% i 30% zdrowia).
  - Po walce zgrać zawartość głównego serwera ochrony na nośnik Bajta i opuścić zakład windą towarową na wschodnim skrzydle.
- **Warunki porażki:**
  - Śmierć Kuriera (powrót do kryjówki z zachowaniem stałego postępu i powtórka misji).
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Wyłączenie chłodzenia zapasowego* (zniszczenie dwóch zaworów ciśnieniowych w hali formowania w Warstwie 3, co ogranicza wsparcie wentylacji/wieżyczek przy podejściu) — nagroda: +15 Danych.
  - *Księga kadr* (zgranie lokalnego rejestru zmian z biura nadzorcy w Warstwie 6 przed wejściem na arenę bossa) — nagroda: +20 Danych.

## Mapa

- **Miejsce i nastrój:** Czynna odlewnia przemysłowa zaadaptowana na sztab ochrony Kurogane Arms na wschodzie Hut, motyw `neonStreet` (wnętrza hal z wysokimi świetlikami, za którymi widać nocny deszcz, para wodna i pył metalowy w powietrzu). Otoczenie ciemne i chłodne mimo żaru głębokich kadzi. Oświetlenie wyłącznie z palety ADR 0006: rozgrzany metal w kadziach oraz lampy ostrzegawcze suwnic w **bursztynie**, kontrolki paneli bezpieczeństwa w **zieleni**, reflektory robocze przy sufitach w **ciepłej bieli**, przeszklenia biur dowodzenia w **błękicie królewskim** i **fiolecie**. Jedyną **czerwienią** w halach są pancerze Kurogane, wieżyczki, tarcza i wzorce bojowe Brandta; ostrze gracza świeci **cyanem**, a Rezonans **magentą**.
- **Struktura sektora:** Run w sektorze `kurogane` liczy **7 warstw** (finałowa ścieżka Aktu I ze stałymi pokojami w Warstwach 3, 6 i 7):
  - **Warstwa 1 (Wejście serwisowe):** punkt startowy oparty na `combatCorridor` — śluza techniczna za kratą chłodniczą otwarta kartą Wirskiej.
  - **Warstwa 2 (Strefa pieców wstępnych):** wybór między otwartą walką wśród form odlewniczych (`combatYard`) a schowkiem przemytniczym za magazynem złomu (`shopRoom`).
  - **Warstwa 3 (Hala formowania — stały pokój fabularny):** obowiązkowy węzeł oparty na `eliteFoundry`. Rozległa hala z kładkami nad pustymi kadziami, ciężką linią Tarczowników, Strzelców i Wieżyczek oraz dwoma opcjonalnymi zaworami chłodzenia.
  - **Warstwa 4 (Zaplecze rozdzielni):** wybór między regeneracją w ekranowanej rozdzielni elektrycznej (`restRoom`) a walką wśród gęstych słupów nośnych (`combatPillars`).
  - **Warstwa 5 (Górna antresola nadzorców):** wybór między starciem na kładkach nad piecami (`combatPlatforms`) a ostatnim punktem zaopatrzenia przed sztabem (`shopRoom` lub `restRoom`).
  - **Warstwa 6 (Przedpokój sztabu — stały pokój fabularny):** obowiązkowy węzeł oparty na `eliteHall`. Krótki, mocno broniony korytarz przed drzwiami centrum dowodzenia: straż przyboczna Brandta (`executor`, `shielder`, `sniper` na górnej galerii). W bocznej dyżurce stoi terminal nadzorcy (cel dodatkowy).
  - **Warstwa 7 (Centrum dowodzenia Odlewni — Boss — stały pokój fabularny):** wielopoziomowa arena na bazie `bossRoom`. Pośrodku szeroka płyta stalowa nad głównym kanałem odlewniczym, otoczona ciężkimi osłonami ze zbrojonych płyt; w głębi podwyższenie z głównym serwerem ochrony i pancerną szybą gabinetu Brandta, przez którą dyrektor schodzi do walki.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Czytnik karty Wirskiej (Warstwa 1):** otwiera wejście do strefy przemysłowej na starcie misji.
  - **Zawory chłodzenia zapasowego (Warstwa 3 — opcjonalne):** dwie skrzynie ciśnieniowe przy bocznych krawędziach hali.
  - **Główny serwer ochrony Brandta (Warstwa 7, za areną):** odblokowuje się po pokonaniu bossa; podłączenie dysku Bajta trwa ok. 3 s i otwiera wyjście na windę towarową.
- **Wrogowie:**
  - Frakcja: **Kurogane Arms** (czerwone oznaczenia).
  - Pełny przekrój oddziałów w Warstwach 1–6: `assaulter`, `gunner`, `shielder`, `drone`, `turret`, `sniper` oraz `executor` jako dowódca straży w Warstwie 6.
  - **Boss (Warstwa 7): Oskar Brandt (`securityChief`) — trzy fazy walki:**
    - **Faza 1 (100%–65% zdrowia):** Brandt walczy w ciężkim pancerzu wspomaganym na średnim i krótkim dystansie. Naprzemiennie wykonuje skokowe uderzenie o posadzkę (**slam** z czytelną czerwoną zapowiedzią obszarową wokół punktu lądowania) oraz **wachlarz pocisków** z ciężkiego miotacza, zmuszający do krycia się za stalowymi płytami lub odbijania pojedynczych strzałów ostrzem.
    - **Faza 2 (65%–30% zdrowia):** po spadku zdrowia do 65% Brandt cofa się o krok, aktywuje **energetyczną tarczę do rozbicia** (odporną na zwykłe muśnięcia — wymaga przełamania serią uderzeń ostrza plazmowego, broni ciężkiej lub mocami Rezonansu, zanim obrażenia znów trafią pancerz) oraz **wzywa wsparcie** przez boczne śluzy (`assaulter` i `gunner`). Sekwencje `slam` stają się szybsze i często łączą się z wachlarzem pocisków tuż po wylądowaniu.
    - **Faza 3 (30%–0% zdrowia):** ostatnia faza przy progu 30% zdrowia. Brandt ponownie podnosi **tarczę do rozbicia** (z krótszym oknem czasowym przed ponownym ładowaniem) i wzywa drugą falę **wsparcia** (w tym `shielder` lub `drone`), skracając dystans podwójnymi seriami `slam` i poszerzonym wachlarzem pocisków aż do wyeliminowania.
- **Zagrożenia środowiskowe:**
  - Otwarte uskoki nad kanałami odlewniczymi na obrzeżach `eliteFoundry` i `combatPlatforms`.
  - Wybuchy pary z przewodów chłodniczych przy krawędziach areny `bossRoom`, zasłaniające na moment widoczność przy cofaniu się przed uderzeniem `slam`.

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Szron rozkłada plan odlewni, Bajt przekazuje czysty nośnik do zgrania serwera Brandta, a Mira ostrzega przed ciężkim pancerzem osobistym dyrektora.
2. **Wejście i hale wytopu (Warstwy 1–5):** Kurier otwiera śluzę kartą Wirskiej i przebija się przez kolejne poziomy odlewni, tłumiąc opór w hali formowania oraz na antresoli nadzorców.
3. **Przedpokój sztabu (Warstwa 6):** Elitarna straż Brandta próbuje zamknąć ostatni korytarz z pomocą Egzekutora i snajperów na galerii. Po ich pokonaniu drzwi do centrum dowodzenia stoją otworem.
4. **Rozmowa przed walką (Warstwa 7):** Gdy Kurier wchodzi na główną płytę centrum dowodzenia, Brandt przechwytuje krótkie pasmo Iskry i słyszy głos Szrona wydającego komendę przez radio. Zamiast wykrzykiwać groźby, rozmawia z nim rzeczowo jak dowódca z byłym podwładnym — potwierdza, że zamknął sprawę dziewięć lat temu wygodnym aktem zgonu, i zamyka łącze przed walką.
5. **Trzyfazowe starcie z Oskarem Brandtem (Warstwa 7):** Kurier mierzy się z Brandtem (`securityChief`) przez progi 100%, 65% i 30% zdrowia — unika fal `slam`, przechodzi między osłonami podczas wachlarza pocisków, rozbija tarcze w drugiej i trzeciej fazie oraz czyści wsparcie wchodzące przez boczne śluzy.
6. **Koniec dyrektora i zgranie serwera:** Pokonany Brandt opiera się o stalową barierę podestu z prostym, pozbawionym skruchy podsumowaniem swojej roli („Ja tylko dowożę”). Kurier podpina dysk Bajta do głównego serwera ochrony i wycofuje się windą towarową na zewnątrz Hut.
7. **Powrót na Kamienną i finał Aktu I (`hideout`):** Bajt podłącza zgrany serwer przy swoim stanowisku. Na ekranie pojawiają się dokumenty kończące zagadkę z początku kampanii i otwierające kolejne pytania: sześcioletnie kontrakty z Helixą Dynamics, rejestr setek przekazanych Rezonantów, powracające słowa **„Akord”** i **„kamerton”** oraz prywatny, mocno zaszyfrowany folder **„Palacz”**. Mapa Hut zostaje zamknięta, a droga w górę — na Bulwar i Taras — otwarta.

## Dialogi

### Odprawa (kryjówka)

**Szron:** Karta otwiera chłodnicze wejście serwisowe od wschodu. Po meldunku Wirskiej na górze nie będzie już elementu zaskoczenia — wejdą wszystkie zmiany.
**Mira:** Brandt nie wychodzi z hali bez ciężkiego pancerza wspomaganego. Ma zamontowany miotacz wachlarzowy i siłowniki skokowe — jak uderzy z góry o stalową płytę, nie stój blisko krawędzi.
**Mira:** I jeszcze jedno: jeśli uruchomi tarczę energetyczną, zwykłe ostrze ześlizgnie się jak po szkle. Trzeba ją najpierw przełamać ciężką serią albo Rezonansem.
**Bajt:** Jak już padnie, serwer stoi pod tylną ścianą jego gabinetu, za hartowaną szybą. Wystarczy włożyć mój dysk w wolny port i poczekać trzy sekundy, resztę zrobi skrypt zrzutu.
**Tomasz:** Odlewnia jest duża i głośna, w nocy łatwo stracić orientację między piecami. Pamiętaj, którędy prowadzą wyjścia na windę towarową.
**Wolan:** Jeśli na tym serwerze są listy transportowe z ostatnich lat... sprawdźcie szczególnie oznaczenia partii z Tarasu. Może być napisane, co zrobili z ludźmi sprzed K-112.
**Szron:** Zajmij się Brandtem i weź serwer. Na rozmowy przyjdzie czas po powrocie.

### W trakcie misji (radio i hala bossa)

**Wejście do Odlewni (Warstwa 1):**
**Bajt:** Karta Wirskiej przeszła przez zamek bez błędu! Śluza chłodnicza otwarta, jesteś w głównym ciągu pod halami.
**Szron:** Idź prosto na hale formowania. Pamiętaj, że znają już twój profil walki z raportów.

**Hala formowania (Warstwa 3):**
**Mira:** Dwa zawory głównego chłodzenia masz po bokach tej hali. Jak je rozwalisz, w górnych przewodach spadnie ciśnienie — na dalszych poziomach będzie mniej pary i część automatycznych wieżyczek straci zasilanie.
**Bajt:** Z prawej idą tarczownicy, z góry szykują drony. Wyczyść halę, zanim wejdziesz na rozdzielnię.

**Przedpokój sztabu (Warstwa 6):**
**Szron:** Ostatnia linia przed gabinetem Brandta. Za nimi są tylko pancerne wrota centrum dowodzenia.
**Bajt:** W dyżurce z boku widać aktywny terminal nadzorcy. Jak masz trzy sekundy spokoju po walce, zgraj rejestr kadr — przyda się przy porównaniu z serwerem.

**Wejście na arenę bossa — rozmowa Brandta i Szrona (Warstwa 7):**
*(Kurier wchodzi na stalową płytę centrum dowodzenia. Na konsoli pod pancerną szybą zapala się przechwyt częstotliwości.)*
**Szron:** Jesteś w środku. Uważaj na górny podest, Brandt wychodzi z...
**Brandt *(przez głośniki hali, spokojnie)*:** Zostaw ten kanał otwarty, poruczniku. Poznałem twój akcent jeszcze na pierwszym słowie.
**Bajt:** Kurwa, wlazł nam na pasmo kierownicze!
**Szron *(krótko)*:** Brandt.
**Brandt:** Wirska mówiła, że w eterze kręci się stary głos z Kurogane. Dziewięć lat, Szron. Cały ten czas siedziałeś w kanałach pod Niecką?
**Szron:** Ktoś musiał pilnować dołu, skoro ty zająłeś się łapankami na zlecenie korporacji.
**Brandt:** Pilnowałem kontraktu. Wtedy przy przepompowni i dzisiaj tutaj. Kiedy zamknąłem twoje akta z adnotacją o utonięciu, zrobiłem ci przysługę — przynajmniej nikt z góry nie szukał cię przez dekadę.
**Szron:** Szkoda tylko, że za ten spokój płacą kurierzy z ulicy. Zrobiłeś z oddziału ochronę transportu dla laboratoriów Helixa.
**Brandt:** Zrobiłem to, co było w zleceniu. A teraz zobaczę, kogo właściwie przysłałeś zamiast siebie.
*(Pancerne wrota podestu otwierają się; Oskar Brandt schodzi na główną płytę hali w ciężkim pancerzu bojowym.)*

**Faza 1 walki (100%–65%):**
**Mira:** Skacze, kurwa! Odsuń się ze strefy lądowania, jak tylko ugnie nogi w pancerzu!
**Szron:** Między wachlarzem pocisków masz krótkie okno z boku. Nie daj się przypiąć do barierki.

**Faza 2 walki (65% — tarcza i wsparcie):**
**Brandt:** Otworzyć boczne śluzy. Drużyny przechwytujące na główną płytę.
**Bajt:** Podniósł tarczę polową i wezwał wsparcie z boków! Przebij osłonę Rezonansem albo ciężkim ogniem, inaczej nic mu nie zrobisz!
**Szron:** Zdejmij najpierw tych, którzy wchodzą przez śluzy, żeby nie zaszli cię od pleców podczas rozbijania tarczy.

**Faza 3 walki (30% — drugie przełamanie i finał):**
**Mira:** Pancerz ma już popękany na przegubach! Znowu ładuje tarczę — tym razem ma krótszy cykl, wciśnij go w środek płyty, zanim się zregeneruje!
**Brandt:** Do końca procedury. Zamykać wyjścia.
**Szron:** Ostatnie wsparcie na hali. Dokończ to, Kurier.

**Pokonanie Oskara Brandta (ostatnie słowa):**
*(Brandt osuwa się pod barierę podestu; pancerz wyłącza się z głuchym sykiem siłowników.)*
**Brandt *(cicho, ciężko oddychając)*:** ...Bez różnicy. Przyślą następnego.
**Brandt:** ...Ja tylko dowożę.
*(Łączność wewnętrzna w hali milknie.)*

**Zgranie serwera i ewakuacja (Warstwa 7):**
**Szron:** Sprawdź puls. ...Dobrze. Podpinaj dysk do głównego serwera pod ścianą.
**Bajt:** Już ciągnie! Trzy sekundy... mamy pełny zrzut partycji ochrony i dodatkowy zbiór z prywatnego dysku!
**Mira:** Winda towarowa po lewej stronie odblokowana. Wyjeżdżaj na zewnątrz, zanim zlecą się oddziały z Bulwaru.

### Po misji (kryjówka)

*(Przy stanowisku Bajta zbierają się wszyscy poza nieprzytomną Idą. Mapa Hut na tablicy obok peronu jest już przekreślona grubą kreską; Szron stoi przy niej dłużej niż zwykle, zanim podchodzi do ekranu.)*

**Bajt:** Mam cały serwer Brandta. Sześć lat dokumentów bez jednej dziury. Wszystko zaczyna się od tego samego kontraktu z Helixą Dynamics.
**Mira:** Pokaż liczby. Ilu naszych wywieźli na górę?
**Bajt:** Kilkuset. Dokładnie trzysta osiemnaście osób z rejestrów „przekazań”, wszystkie oznaczone datą i wynikiem skanu kory ruchowej. Ale w samej korespondencji powtarzają się bez przerwy dwa słowa, których nie widziałem w żadnej specyfikacji.
**Mira:** Trzysta osiemnaście osób. Kurwa.
**Szron:** Jakie to słowa?
**Bajt:** „Akord” i „kamerton”. Całe rozliczenie z Helixą opiera się na liczbie sprawnych kamertonów i partiach Akordu schodzących z Zakładu Kalibracji.
**Wolan *(patrzy w ekran bardzo uważnie, głosem opanowanym, choć sztywniejszym niż zwykle)*:** ...Zatem zmienili nazewnictwo handlowe. Ale nie ma tu jeszcze opisu samej procedury z Tarasu?
**Bajt:** Nie, to tylko logistyka z Hut: kto, kiedy i ile ton. Żeby zrozumieć, co robią w środku, musimy wejść wyżej — na Bulwar i Taras, prosto do laboratoriów Helixa.
**Tomasz:** Przynajmniej Huty mamy na razie z głowy. Bez Brandta miną tygodnie, zanim złoży im się nowa komenda na dole.
**Bajt:** Jest jeszcze jedna rzecz. Na samym dole partycji Brandta leży ukryty folder z lokalnym szyfrem, niepodpiętym do sieci Kurogane. Nazwa pliku: „Palacz”.
**Mira:** Nazwisko? Kryptonim?
**Bajt:** Nie wiem. Klucz jest podwójny, ręcznie mieszany. Puszczam skrypt łamiący w tle — zajmie mi to trochę czasu, może do końca następnych akcji na górze.
**Szron *(wracając wzrokiem na mapę miasta)*:** Zostaw go, niech chodzi w tle. Od dzisiejszej nocy mamy otwarte przejście wyżej.
**Szron:** Nadia zgłasza z Bulwaru bezpłatną przychodnię Helixa, w której zapisują ludzi na dziwne implanty ruchowe. Doktor Wolan zostaje przy aparaturze Idy, a my przenosimy rozpoznanie na poziom estakad.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 150 Danych oraz 3 Rdzenie za ukończenie finału Aktu I (oraz do 35 Danych z celów opcjonalnych); Kredyty z pokojów działają wyłącznie w ramach bieżącego runu.
  - Odblokowanie wyższego progu ulepszeń broni, ostrza plazmowego i implantów w warsztacie Miry (przejście na poziom II kampanii).
- **Zmiany w kryjówce:**
  - Na tablicy misji mapa sektora **Huty** zostaje przekreślona, a obok niej pojawiają się plany **Bulwaru** i **Tarasa**.
  - Szron częściej i dłużej stoi przy tablicy taktycznej, analizując kolejne etapy kampanii.
  - Na monitorze Bajta stale widać pasek procesu łamania szyfru folderu **„Palacz”**.
- **Co misja otwiera dalej:**
  - Zamyka **Akt I — Huty (Kurogane Arms)**.
  - Odblokowuje sektory **Bulwar** i **Taras** (Helixa Dynamics) oraz rozpoczyna **Akt II** od **Misji 07 — Nocny dyżur**.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Sektor `kurogane`, mapa wyboru ścieżki, szablony pokojów (`combatCorridor`, `combatYard`, `eliteFoundry`, `restRoom`, `combatPillars`, `combatPlatforms`, `eliteHall`, `bossRoom`, `shopRoom`).
  - Wrogowie: pełna pula Kurogane (`assaulter`, `gunner`, `shielder`, `drone`, `turret`, `sniper`, `executor`) oraz istniejący boss **`securityChief`** (Oskar Brandt).
- **Nowe elementy potrzebne dla Misji 06:**
  - Konfiguracja trzech faz bossa `securityChief` na progach **100%**, **65%** i **30%** zdrowia:
    - bazowe wzorce `slam` i wachlarz pocisków;
    - w fazach 2 i 3 aktywacja tarczy wymagającej rozbicia (oddzielny pasek osłony przed zadawaniem obrażeń w zdrowie) oraz wyzwalacz wejścia fal wsparcia bocznymi śluzami.
  - Wyzwalacz rozmowy radiowej Brandt–Szron przy wejściu do `bossRoom` przed startem walki oraz krótka sekwencja końcowa po spadku zdrowia bossa do zera („Ja tylko dowożę”).
  - Interakcja z głównym serwerem ochrony po pokonaniu bossa i odblokowanie windy ewakuacyjnej.
  - Aktualizacja stanu kampanii po zakończeniu misji: odblokowanie sektorów Bulwar i Taras oraz zmiana wizualna mapy na tablicy w `hideout`.
- **Propozycje do backlogu (poza minimum F5):**
  - Zniszczalne zawory chłodzenia w Warstwie 3 wpływające na widoczność pary i aktywność części wieżyczek w kolejnych pokojach Odlewni.
