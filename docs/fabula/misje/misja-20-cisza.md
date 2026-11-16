# Misja 20 — Cisza

| Akt | Frakcja | Miejsce | Typ celu | Czas | Odblokowanie |
| --- | --- | --- | --- | --- | --- |
| III (Finał) | Orbis Grid | Korona, szczyt Masztu (węzeł Chóru i biuro Dyrektora Systemów) | Finał — boss systemowy (trzy fazy) | Noc przed świtem (bez twardego limitu; tempo Fazy 2 wyznacza wgrywanie dysonansu) | Po Misji 19 (Pion); kończy kampanię i odblokowuje tryb freeplay |

## W skrócie

Kurier wchodzi przez zabezpieczoną śluzę na szczyt Masztu, żeby zniszczyć główny węzeł Chóru przed wyczerpaniem zasilania awaryjnego w mieście. Wiktor Sarnecki nie staje do walki osobiście — steruje z ekranów obroną hali, a w drugiej fazie uruchamia Chór na pełną moc, zagłuszając naturalny Rezonans Kuriera do czasu wgrania dysonansu Wolan przez Bajta. Po rozbiciu rdzenia w cichym biurze na zapleczu czeka zwykły człowiek przy biurku, którego obraz Bajt puszcza na żywo na wszystkie ekrany Neo-Rydu, zanim Maszt ostatecznie milknie.

## Tło fabularne

Śluza serwisowa Korony została zablokowana od środka pod koniec wspinaczki w Misji 19, dzięki czemu Kurier omija zewnętrzną obronę wież i wchodzi bezpośrednio w górną koronę Masztu. W przychodniach Helixa na dole miasta kończą się resztki baterii awaryjnych, ale Orbis nie wstrzymuje kalibracji — zamiast tego przyspiesza uruchomienie głównego węzła Chóru.

Helena Wolan ukończyła dysonans: sygnał zapisany na nośniku, który po wpięciu w konsolę sterującą odwróci falę nośną Chóru i bezpiecznie wygasi wszystkie Akordy w Neo-Rydzie bez szkody dla ich użytkowników. Żeby zadziałał, Kurier musi przebić się do centralnej komory na szczycie i utrzymać połączenie wystarczająco długo, by Bajt zdalnie przepchnął kod przez obronę Orbis.

Wiktor Sarnecki od początku kampanii pozostawał wyłącznie głosem w transmisjach, podpisem pod procedurą i operatorem dronów. Nikt w Iskrze nie widział go z bliska i nikt nie wie, czy Dyrektor Systemów nosi w sobie najnowszą wersję Akordu, czy nie ma w głowie ani jednego drutu.

## Cel misji

- **Cel główny i warunek zwycięstwa:**
  - Przebić się przez górny pierścień ochrony Korony do komory węzła Chóru na szczycie Masztu.
  - Pokonać trzy fazy systemu obronnego sterowanego przez Wiktora Sarneckiego:
    - **Faza 1:** przełamać początkową obronę węzła i dotrzeć do gniazda wgrania dysonansu.
    - **Faza 2:** po uruchomieniu zagłuszania Rezonansu przetrwać natarcie przy pomocy ostrza plazmowego i broni palnej oraz osłaniać antenę transferu, aż Bajt wgra dysonans Wolan.
    - **Faza 3:** przy odzyskanej pełni Rezonansu zniszczyć odsłonięty rdzeń Chóru.
  - Wejść do biura za komorą rdzenia i zamknąć transmisję sieciową Masztu (scena bez walki).
- **Warunki porażki:**
  - Śmierć Kuriera (standardowy powrót do kryjówki i powtórka finałowego runu).
  - Przerwanie transferu w Fazie 2 nie kończy misji natychmiast, lecz zatrzymuje pasek postępu wgrywania do momentu oczyszczenia strefy przy konsoli przez Kuriera.
- **Cele dodatkowe (opcjonalne) z nagrodą:**
  - *Ukończenie Fazy 2 bez resetu konsoli wgrywania przez drony-hakery* — nagroda: +40 Danych.
  - *Zniszczenie wszystkich czterech wieżyczek obwodowych w Fazie 1 przed przejściem do wgrywania dysonansu* — nagroda: +30 Danych.

## Mapa

- **Miejsce i nastrój:** Szczyt Masztu na poziomie Korony, ponad pasmem niskich deszczowych chmur (`neonStreet` w wariancie wysokogórskiej nocy: zimny wiatr, drobna mżawka, gładka ciemna stal i szkło). Otoczenie ciemne i sterylne, bez reklam ulicznych; jedyne światła architektoniczne mieszczą się w palecie ADR 0006: **ciepła biel** listew serwisowych, **błękit królewski** prowadnic konstrukcji i **zieleń** oznaczeń śluz ewakuacyjnych. W komorze węzła dominują **czerwone** reflektory wieżyczek, dronów, zsynchronizowanych akordowców i samego rdzenia Chóru; podczas Fazy 2 **czerwona** poświata fali zagłuszającej zalewa całą halę, ostro odcinając **cyanowe** ostrze gracza. W Fazie 3 wgrany dysonans rozcina rdzeń **magentowymi** wyładowaniami. Za grodzią węzła leży suche, ciche biuro w **ciepłej bieli** pojedynczej lampki na biurku.
- **Struktura sektora:** Kompaktowy, sześciowarstwowy finał prowadzący w głąb iglicy Masztu:
  - **Warstwa 1 (Wejście — śluza Korony):** `rooftopRest` na pierwszym poziomie iglicy, zabezpieczony wcześniej w Misji 19.
  - **Warstwa 2 (Pierścień antenowy):** `combatLaserYard` / `combatCorridor` — pierwsza linia bram laserowych i wieżyczek pod okiem dronów Orbis.
  - **Warstwa 3 (Bufor przedkomorowy):** wybór między trudniejszą salą elity (`eliteHall` — zsynchronizowani akordowcy i tarczownicy) a stacją serwisową (`restRoom` / `shopRoom` — ostatni punkt regeneracji i wymiany ekwipunku przed bossem).
  - **Warstwa 4 (Korytarz przedwęzłowy):** `combatPillars` — wysoki korytarz z kolumnami nośnymi Masztu i ogniem snajperskim z galerii.
  - **Warstwa 5 (Węzeł Chóru — pokój bossa systemowego):** `bossRoom`. Okrągła, dwupoziomowa hala z zawieszonym pośrodku wielopierścieniowym rdzeniem Chóru. Na ścianach biegną szyny wieżyczek, z sufitu spuszczają się drony, a pod rdzeniem stoi konsola wgrania dysonansu z wyraźną strefą połączenia.
  - **Warstwa 6 (Biuro Dyrektora Systemów — stały pokój zakończenia):** niewielkie, wyciszone pomieszczenie za grubą grodzią techniczną za rdzeniem. Wykładzina tłumiąca kroki, biurko z jednym monitorem, panoramiczne okno na ciemne miasto bez prądu na dole i nieruchoma kamera transmisji miejskiej na ścianie. Brak wrogów i zagrożeń.
- **Kluczowe miejsca i obiekty interaktywne:**
  - **Konsola transferu dysonansu (Warstwa 5):** aktywowana interakcją na starcie Fazy 2 (ok. 1,5 s podpięcia nośnika Wolan); utrzymanie strefy w promieniu 4 m wokół konsoli przyspiesza transfer Bajta (ok. 35 s aktywnego czasu — do strojenia).
  - **Cztery wieżyczki szynowe na obwodzie (Warstwa 5):** można je niszczyć lub chwilowo wyłączać osłoną.
  - **Rdzeń Chóru (Warstwa 5):** w Fazie 3 po opadnięciu osłon przyjmuje bezpośrednie obrażenia od ostrza plazmowego, broni palnej i pełnych mocy Rezonansu.
  - **Gródź do biura i terminal transmisji (Warstwa 6):** otwiera się automatycznie po rozbiciu rdzenia.
- **Wrogowie:**
  - Frakcja: **Orbis Grid**.
  - **Boss systemowy: Wiktor Sarnecki (system obrony Masztu)** — brak postaci bossa na arenie; Sarnecki steruje halą z monitorów, przełączając wieżyczki, wypuszczając kolejne grupy dronów i zsynchronizowanych żołnierzy oraz sterując mocą samego rdzenia.
  - Jednostki w walce: **Wieżyczka (`turret`)**, **Dron (`drone`)**, **Dron-haker (`hacker`)**, **Snajper (`sniper`)** na górnym podeście, **Tarczownik (`shielder`)** oraz **zsynchronizowani `assaulter` i `gunner`** (wspólny rytm zapowiedzi ataków z Misji 18, do czasu wgrania dysonansu).
- **Zagrożenia środowiskowe:**
  - **Faza 2 — Zagłuszenie Rezonansu:** gdy rdzeń przechodzi na pełną moc przeciwfazy, wszystkie moce Rezonansu Kuriera zostają silnie stłumione (propozycja do strojenia: brak rzucania obiektami i Fali uderzeniowej albo skrajne wydłużenie odnowienia i spadek siły o 80%); gracz musi polegać na parowaniu **ostrzem plazmowym**, ruchu i **broni palnej**.
  - **Pulsacyjne łuki rdzenia:** rotujące sektory podłogi sygnalizowane czerwoną kratką przed uderzeniem wyładowania (cykl co 6 s — do strojenia).

## Przebieg

1. **Odprawa w kryjówce (`hideout`):** Krótka, rzeczowa odprawa przy awaryjnych światłach. Beczka stoi zimna. Szron sprawdza plan wejścia ze śluzy Korony, Wolan przypomina kolejność podpięcia dysonansu, a Bajt otwiera kanał bezpośredniej transmisji zwrotnej na wypadek przejęcia kamer w budynku.
2. **Wejście na Koronę (Warstwy 1–4):** Kurier wchodzi przez odblokowaną śluzę ponad poziomem chmur. Walka przez pierścień antenowy i korytarze pod szczytem. Na ekranach serwisowych nie ma już sloganów — pojawiają się krótkie komunikaty systemowe o przejściu Masztu w tryb izolacji.
3. **Boss systemowy, Faza 1 — Obrona węzła (Warstwa 5):** W hali rdzenia Sarnecki uruchamia pierwsze pierścienie wieżyczek i oddziały zsynchronizowanych akordowców, próbując nie dopuścić Kuriera do konsoli transferowej. Teksty na ekranach hali opisują kolejne korekty przydziału ognia jak raport ze stanu zasobów.
4. **Boss systemowy, Faza 2 — Zagłuszenie (Warstwa 5):** Gdy pierwsze linie padają, Sarnecki przestawia rdzeń Chóru na pełną przeciwfazę. Czerwone światło zalewa halę; moce Rezonansu Kuriera gasną pod ciężarem zakłócenia. Kurier wpina nośnik Wolan w konsolę i utrzymuje pozycję w walce samym ostrzem plazmowym, parowaniem i bronią palną, zdejmując drony-hakery, dopóki Bajt nie zamknie wgrania dysonansu.
5. **Boss systemowy, Faza 3 — Zniszczenie rdzenia (Warstwa 5):** Dysonans Wolan uderza w nośną Chóru. Czerwony sygnał rwie się i gaśnie, naturalny Rezonans Kuriera wraca w pełni magentowym błyskiem, a zsynchronizowani żołnierze tracą wspólny takt. Kurier rozbija osłabiony rdzeń Chóru. W całym mieście wszystkie Akordy cichną naraz.
6. **Ciche biuro Sarneckiego (Warstwa 6):** Za rozbitą komorą rdzenia otwierają się zwykłe, wyciszone drzwi. W środku nie ma ochrony ani generatorów — siedzi zwykły mężczyzna po pięćdziesiątce bez żadnych widocznych implantów. Nie sięga po broń i nie wygłasza mowy. Mówi krótko o statystyce i mieście, które nie ma się o co potykać. Gdy pada jego ostatnie zdanie („Ktoś to kupi. Zawsze ktoś kupuje.”), Bajt przełącza sygnał z kamery ściennej bezpośrednio na każdy działający ekran w Neo-Rydzie — bez montażu Orbis. Chwilę później Maszt milknie całkowicie.
7. **Epilog w kryjówce (`hideout`):** Na Kamiennej panuje spokój bez euforii. Przychodnie na dole odzyskują zasilanie po przerzuceniu sieci miejskiej poza Maszt; kamertony z antresoli przechodzą na normalną opiekę. Akordy w mieście zgasły — jedni mieszkańcy dziękują, inni są wściekli za utratę refleksu i pracy. Tymon siedzi z Mirą w warsztacie bez swojego sztucznego Rezonansu i wciąż nie wie, co o tym myśleć. Ida podchodzi do zimnej beczki Tomasza na peronie B i jednym, cichym magentowym wyładowaniem rozpala w niej ogień.

## Dialogi

### Odprawa (kryjówka)

**Szron:** Śluza na progu Korony jest nasza. Zostało ostatnie piętro nad nią — hala węzła Chóru i centrala sterowania.
**Wolan:** Kartridż z dysonansowym pakietem wpinasz w główną konsolę pod rdzeniem. Dopóki Chór pracuje na małej mocy, nie wyłączy ci Rezonansu, ale kiedy poczują zagrożenie, na pewno podbiją przeciwfazę.
**Mira:** Czyli w połowie walki możesz zostać, kurwa, z samym ostrzem i lufą. Sprawdź ogniwa i magazynki przed wyjściem, bo tam na górze nie będzie na co liczyć poza żelazem.
**Bajt:** Kiedy wepniesz nośnik, potrzebuję około trzydziestu pięciu sekund czystego łącza, żeby przepchnąć kod Wolan do rdzenia. Jak siądzie na nim dron-haker albo stracisz zasięg przy konsoli, transfer stanie w miejscu.
**Tymon:** Ochrona przy samym węźle będzie w pełnej synchronizacji. Czytaj rytm tak jak na Bulwarze, dopóki nie wejdzie dysonans. Zgrani jak pieprzony zegarek.
**Ida:** Gdy Chór zacznie zagłuszać na pełnej mocy, nie używaj na siłę Rezonansu — zaboli i nic nie pchnie. Poczekaj na sygnał Bajta.
**Szron:** Idziemy po to, żeby ten Maszt zamilkł przed świtem. Kanał otwarty, Kurier. Wchodź na górę.

### W trakcie misji (radio i finał)

**Wejście na poziom Korony (Warstwa 1):**
**Bajt:** Jesteś za śluzą. Powietrze na górze jest czyste, nawet chmury zostały niżej.
**Szron:** Przed tobą pierścień antenowy. Zdejmuj wieżyczki z dystansu albo odcinaj im linię strzału między kolumnami.

**Przed wejściem do komory węzła (Warstwa 4):**
**Bajt:** Jesteś za wewnętrznym progiem Masztu. Ekrany w korytarzu przełączyły się na tryb zamknięty — Sarnecki wie, że tam jesteś.
**Tekst na ekranach hali (komunikat Sarneckiego):** *Wykryto zakłócenie poziomu trzeciego. Przełączono obwód węzła na zarządzanie bezpośrednie.*

**Faza 1 — wejście do węzła Chóru (Warstwa 5):**
**Sarnecki (głośnik hali, spokojnie i bez emocji):** Sektor wejściowy stracony z wyprzedzeniem czterech minut względem modelu. Zamykam grodzie i zwiększam gęstość ognia wieżyczek o trzydzieści procent.
**Szron:** Nie odpowiada bezpośrednio tobie, mówi do własnych logów. Nie daj się zamknąć między krzyżowymi wieżyczkami i przebij się pod konsolę.

**Faza 2 — uruchomienie pełnego zagłuszania Chóru:**
**Sarnecki (głośnik hali):** Ochrona zewnętrzna niewystarczająca. Włączam pełną przeciwfazę Chóru na sektorze szczytu.
*(Czerwony puls przetacza się przez halę; ostrze plazmowe Kuriera przygasa na ułamek sekundy i wraca wyraźnym cyanem, ale ikony mocy Rezonansu blokują się pod czerwonym zakłóceniem.)*
**Wolan:** Przeciwfaza weszła! Twój Rezonans jest zagłuszony, Kurier — nie marnuj energii na moce, trzymaj się ostrza i broni!
**Bajt:** Wpinaj kartridż w konsolę pod rdzeniem! Teraz!

**Faza 2 — podczas wgrywania dysonansu:**
**Bajt:** Mam połączenie! Dwadzieścia procent... Trzymaj się w zasięgu konsoli i zdejmuj drony-hakery, próbują odciąć port!
**Mira:** Tnij z bliska i paruj w rytmie, Kurier! Jak przeżyjesz jeszcze chwilę, cały ten system sam im się posypie!
**Bajt:** Sześćdziesiąt procent... osiemdziesiąt... Kurwa, zrzuca ostatni oddział z górnej galerii!

**Faza 3 — wgranie dysonansu i odsłonięcie rdzenia:**
**Bajt:** Sto procent! Dysonans poszedł w nośną!
*(Czerwone światło na rdzeniu pęka od środka magentowymi wyładowaniami; wieżyczki obwodowe wyłączają się kolejno z trzaskiem, a żołnierze na podłodze gubią takt.)*
**Wolan:** Przeciwfaza rozerwana! Twój Rezonans wrócił — rozbij rdzeń, zanim zdołają zrestartować węzeł!
**Szron:** Dobij to do zera, Kurier.

**Zniszczenie rdzenia Chóru:**
**Bajt:** Rdzeń martwy! Całe pasmo Chóru na Koronie zeszło do zera... Słyszysz? W eterze nie ma ani jednej nośnej Orbis.
**Mira:** Zostały jeszcze drzwi za komorą. Sprawdź, kto tam siedział przy tych ekranach.

**Ciche biuro Sarneckiego (Warstwa 6 — bez walki):**
*(Drzwi otwierają się bez oporu. W środku przy małym biurku z jedną ciepłą lampką siedzi Wiktor Sarnecki — zmęczony mężczyzna w ciemnej marynarce, bez implantów i bez broni. Za oknem widać wygaszony dół miasta. Na ścianie miga czerwona dioda otwartej przez Bajta kamery transmisyjnej.)*
**Sarnecki:** Drzwi nie są pancerne. Z wyłączonym węzłem nie ma już czego bronić.
**Bajt (radio, cicho):** Kurier, trzymaj kadr w stronę biurka. Właśnie przepiąłem sygnał z tej kamery na wszystkie aktywne ekrany w Bulwarze, Tarasie i Koronie. Tym razem bez ich montażu.
**Sarnecki:** *(patrzy krótko na kamerę, potem wraca wzrokiem do wygaszonego monitora na biurku)* W mieście mieszka ponad dwa miliony ludzi. Bez wspólnego rytmu odsetek zdarzeń nieprzewidzianych rośnie o rząd wielkości: dostawy, kolej, szpitale. Zapewniłem im przewidywalność. Chętnie z niej korzystali.
**Sarnecki:** Węzeł wyłączycie. Jutro ktoś znowu zapłaci za spokój, za lepszy refleks, za porządek na swojej ulicy. Ktoś to kupi. Zawsze ktoś kupuje.
**Bajt (radio):** Koniec przekazu. Wypalam główny przekaźnik na dachu... Maszt milknie, Kurier. Wracamy na Kamienną.

### Po misji (kryjówka — epilog)

**Bajt:** Miasto widziało wszystko na żywo. Żadnego cięcia, żadnego komentarza z offu — tylko puste ekrany z biura na szczycie i wyłączony węzeł. Orbis właśnie odwołał oświadczenie o awarii sieci, bo nikt na Bulwarze już im nie wierzy.
**Wolan:** Wszystkie Akordy w Neo-Rydzie zgasły. Część ludzi w przychodniach jest wściekła, bo stracili sprawność, za którą płacili w ratach; inni po raz pierwszy od miesięcy śpią bez szumu w głowie. Czternastu pacjentów zmarło, zanim wróciło zasilanie. Miejskie zasilanie wraca teraz na normalne tory poza Masztem.
**Szron:** Kurogane nie upadło, Helixa jutro otworzy inne skrzydło badań, a Orbis za pół roku postawi nowe kable. Ale kamertony z antresoli są wolne i Chór nigdy nie ruszył.
**Mira:** *(patrzy w stronę wagonu-warsztatu, gdzie siedzi Tymon z opuszczonymi dłońmi)* Tymon od wczoraj nic nie mówi. Nie wie, czy ma być wściekły za zabrany implant, czy wdzięczny, że znów jest w jednym kawałku.
**Szron:** Daj mu czas. Każdy tutaj coś spłacał.
*(Ida podchodzi powoli do zimnej, osmalonej beczki Tomasza na peronie B. Wyciąga dłoń nad suchym drewnem. Krótki, spokojny błysk magentowego Rezonansu — i w beczce zapala się równy ogień.)*
**Szron:** *(staje przy tablicy misji, patrząc na puste przypinki)* Tablica jest pusta. Pierwszy raz od dwunastu lat.
**Mira:** Nie przyzwyczajaj się.

## Nagrody i konsekwencje

- **Propozycje nagród (do strojenia w F5):**
  - 150 Danych oraz 5 Rdzeni za ukończenie finału kampanii (plus do 70 Danych z celów opcjonalnych).
  - Odblokowanie trybu **freeplay** (powtarzalnych zleceń na tablicy misji w różnych sektorach i poziomach trudności).
- **Zmiany w kryjówce (epilog):**
  - **Ogień w beczce Tomasza znów płonie** (zapalony przez Idę).
  - Woda na niższych torach nadal przypomina o obronie Kamiennej, ale przywrócono pełne oświetlenie stacji.
  - Tablica misji po krótkim wyczyszczeniu w scenie epilogu otwiera nowe, proceduralne zlecenia poboczne dla Iskry. Tymon zostaje z Mirą w warsztacie, Wolan porządkuje dokumentację medyczną uwolnionych kamertonów, a Nadia utrzymuje stały nasłuch z Bulwaru.
- **Co misja otwiera dalej:**
  - Zamyka główną fabułę Aktów I–III gry NEORYDER.
  - Przekazuje grę w tryb **freeplay** z pełnym dostępem do wszystkich sektorów, wyzwań i ulepszeń.

## Uwagi do implementacji

- **Dostępne od razu w obecnej grze:**
  - Szablony pokojów (`rooftopRest`, `combatLaserYard`, `combatCorridor`, `eliteHall`, `combatPillars`, `bossRoom`, `restRoom`, `shopRoom`) oraz motywy `neonStreet` (wysokogórska noc) i `hideout`.
  - Wszyscy wrogowie potrzebni do finału: `turret`, `drone`, `hacker`, `sniper`, `shielder`, `assaulter`, `gunner`.
- **Nowe elementy potrzebne dla Misji 20:**
  - **Trzyfazowy boss systemowy w `bossRoom`:** zarządzanie falami, przełączaniem wieżyczek i komunikatami tekstowymi na ekranach areny bez fizycznego awatara bossa.
  - **Mechanika Fazy 2 (Zagłuszenie Rezonansu):** tymczasowe zablokowanie/osłabienie aktywnych mocy gracza z komunikatem HUD, z jednoczesnym licznikiem transferu dysonansu przy konsoli (zatrzymywany przy oddaleniu się lub ataku drona-hakera).
  - **Scena zakończenia w Warstwie 6 (Biuro Sarneckiego):** spokojny pokój bez możliwości użycia broni przeciw NPC, wyzwolenie dialogu po podejściu do biurka i przejście do sekwencji epilogu na stacji Kamienna (`hideout`).
  - Flaga ukończenia kampanii zmieniająca stan kryjówki (zapalona beczka) i odblokowująca generator zleceń freeplay.
- **Propozycje do backlogu:**
  - Wyświetlanie w tle okna w biurze Sarneckiego dynamicznego stanu zaciemnienia i powracających świateł miejskich oraz animacji magentowego rozpalenia beczki przez Idę w epilogu.
