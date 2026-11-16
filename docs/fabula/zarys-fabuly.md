# Zarys fabuły — NEORYDER

Projekt fabuły pełnej kampanii (20 misji, trzy akty). Ten plik jest kanonem: `docs/fabula/misje.md` i pliki w `docs/fabula/misje/` muszą być z nim zgodne. Punkt wyjścia: `docs/gdd.md` §12 (Neo-Ryd, Iskra, Koalicja, Rezonans), ADR 0006 (Neon Noir) i postacie kryjówki z `src/data/hub/npcs.pl.json`.

## 1. W jednym akapicie

Neo-Ryd to miasto budowane na własnych dachach: korporacje na górze, reszta coraz niżej. Bohater jest kurierem z tanim implantem ruchowym na raty. Pewnej nocy implant budzi w nim Rezonans i od tej chwili Koalicja chce go mieć. Komórka ruchu oporu Iskra wyciąga go z obławy. Kampania prowadzi przez trzy korporacje, od zbrojeniówki przez laboratoria po sieć, i odsłania, skąd biorą się sztuczne implanty Rezonansu: Koalicja kopiuje wzorce żywych Rezonantów i trzyma ich latami w aparaturze jako „kamertony”. Finał to uderzenie w Orbis Grid, który chce połączyć wszystkie sztuczne implanty w jedną sieć i jednocześnie zagłuszyć każdego prawdziwego Rezonanta w mieście.

## 2. Ton i zasady pisania

**Ton:** noir, nie heroizm. Ludzie są zmęczeni, mówią krótko i żartują sucho. Nikt nie wygłasza przemów o wolności. Zło jest banalne: dyrektorzy to menedżerowie z wynikami kwartalnymi, mówią językiem raportów i procedur. Każda strona ma swoje powody, a Iskra też nie jest czysta. Zwycięstwa kosztują i po każdym akcie coś trwale zmienia się w kryjówce.

**Zasady (obowiązkowe dla wszystkich plików fabuły):**

1. **Cichy protagonista.** Bohater gracza nie ma kwestii. NPC zwracają się do niego bez form rodzajowych: tryb rozkazujący, czas teraźniejszy i przyszły, konstrukcje bezosobowe („Dobra robota”, „Słyszysz mnie?”, „Masz to?”, „Wracaj, zanim zamkną śluzę”, „Udało się”). Nigdy „zrobiłeś/zrobiłaś”, „gotowy/gotowa”, „sam/sama”. W eterze bohater ma kryptonim **Kurier**.
2. **Nazwy rzeczowe.** Tytuły misji mają jedno do trzech słów i nazywają miejsce, rzecz albo czynność. Zakazane: „Operacja …”, „Cień”, „Mrok”, „Zemsta”, „Ostateczny”, „Przebudzenie”, „Krwawy”, angielskie wtrącenia dla efektu, kalambury w tytułach, pseudonimy w stylu „Śmierć” czy „Wilk”. Postacie mają zwykłe imiona i nazwiska albo ksywki z konkretnym pochodzeniem.
3. **Dialogi.** Kwestie krótkie (zwykle do dwóch zdań), konkret zamiast patosu. Informacja wynika z rozmowy, a nie z wykładu. Bez one-linerów po zabójstwie, bez złoczyńców śmiejących się w głośnikach, bez „nie różnimy się tak bardzo”, bez „to dopiero początek”. Postacie przerywają sobie, mylą się, czegoś nie wiedzą.
4. **Humor** tylko sytuacyjny i suchy (głównie Mira i Bajt), nigdy w scenach straty.
5. **Zakaz nazw chronionych** (AGENTS.md): używamy wyłącznie *ostrze plazmowe*, *Rezonans*, *Rezonanci*, *Koalicja*.
6. **Kolory.** W opisach otoczenia tylko neony z palety ADR 0006: bursztyn, zieleń, fiolet, błękit królewski, ciepła biel; otoczenie ciemne i chłodne. Czerwień należy do wrogów, cyan do gracza, magenta do Rezonansu. Fabuła tę zasadę wykorzystuje (pkt 3.3).
7. **Cywile** nigdy nie są celem gracza. W misjach są osobami do uwolnienia, ochrony albo wyprowadzenia.
8. **Przekleństwa i brutalność.** Ludzie z dołu klną, jak klnie się naprawdę: pod ostrzałem, ze złości, ze strachu, po stracie. Przekleństwo ma wynikać z sytuacji i coś mówić o postaci, a nie zdobić co drugą kwestię; w spokojnej scenie jedno celne słowo działa mocniej niż pięć. Kto jak klnie:
   - **Mira** najczęściej, rzeczowo i bez złości („Kurwa, znowu zwarcie”); przy Tymonie przestaje żartować i klnie inaczej, ciszej.
   - **Tymon** zaczepnie, żeby sprowokować.
   - **Bajt** nerwowo, gdy coś się sypie.
   - **Szron** prawie nigdy; jeśli zaklnie, wszyscy wiedzą, że jest bardzo źle.
   - **Tomasz** rzadko, po staremu.
   - **Wolan** i **Ida** nie klną.
   - **Żołnierze Koalicji** klną w komunikatach i przy dowódcach. **Dyrektorzy nigdy:** mówią językiem raportów i ten kontrast jest zamierzony.

   Brutalność to także treść: ludzie giną w tle, decyzje kosztują, nikt nie wychodzi czysty. Zakazane są wyzwiska dotyczące pochodzenia, płci, orientacji czy niepełnosprawności. Przekleństwa nie trafiają do tytułów, nazw ani tekstów interfejsu.

**Przykład tonu:**

> **Szron:** Trzy maszty. Do rana.
> **Mira:** Ładunki są w torbie. Niebieski kabel do masy, nie do zapalnika. Powtórz.
> **Szron:** Mira.
> **Mira:** No co? Ostatni powtórzył źle. Zbieraliśmy go łopatą.

> **Bajt:** Kurwa, kurwa… dobra. Mam obraz. Trzech przy bramie, jeden na dachu.
> **Szron:** Oddychaj, Bajt. Kurier, dach jest twój.

> **Bajt:** Wiesz, co jest najgorsze w Sali Monitorów? Nie to, co widzisz. To, że po tygodniu przestajesz patrzeć.

## 3. Świat

### 3.1 Neo-Ryd

Pionowe miasto nad dawną deltą rzeki. Każdy poziom stoi na dachach poprzedniego, więc im niżej, tym mniej nieba.

| Poziom | Charakter | Kto rządzi |
| --- | --- | --- |
| **Niecka** | Najstarsza część, poniżej linii powodziowej: wilgoć, pompy, zamknięte linie metra, targi pod estakadami. Kryjówka Iskry: nieczynna stacja metra **Kamienna**, zamknięta po powodzi. | nikt; patrole Kurogane |
| **Huty** | Pas przemysłowy na wschodzie dołu: odlewnie, magazyny portowe, kolej towarowa, bocznice, podstacje. | Kurogane Arms |
| **Bulwar** | Poziom handlowy na estakadach: targ, budki z makaronem, holoreklamy, bloki mieszkalne, bezpłatne przychodnie Helixa. | wszyscy po trochu |
| **Taras** | Czyste ulice, ogrody pod kopułami, kampus Helixa Dynamics, wieże badawcze. | Helixa Dynamics |
| **Korona** | Szczyt: wieże Koalicji, lądowiska, siedziba Orbis Grid. | Orbis Grid |

Przez wszystkie poziomy przechodzi **Maszt**, wieża łączności Orbis: kręgosłup miasta od fundamentów w Hutach do szczytu Korony. Mniejsze maszty nasłuchowe, które Kurogane stawia na dole, są jego odnogami.

Między poziomami jeździ się windami towarowymi, rampami i szybami. Kurierów, którzy tym żyją, w Niecce nazywa się **neoryderami** (od Neo-Rydu i angielskiego *rider*, z czasów pierwszych firm kurierskich). Bohater był jednym z nich.

### 3.2 Rezonans

- Większość pracujących ludzi ma **implant ruchowy** Helixa w korze ruchowej: tani, na raty, poprawia refleks i pozwala obsługiwać maszyny. Mają go kurierzy, hutnicy, żołnierze.
- U bardzo nielicznych mózg **wpada w rezonans** z implantem i implant zaczyna sterować nie tylko ciałem, ale materią i energią wokół. To cecha mózgu, nie urządzenia: nikt nie wie, od czego zależy, i nie da się tego wywołać.
- Rezonans widać: wyładowania są magentowe.
- Oficjalnie Koalicja uważa Rezonantów za zagrożenie dla infrastruktury i „obejmuje opieką”. Nieoficjalnie traktuje ich jak surowiec.

### 3.3 Akord, kamertony i Chór (sekret kampanii)

- **Akord** to produkt Helixa: sztuczny implant Rezonansu. Kopiuje wzorzec aktywności z mózgu prawdziwego Rezonanta i narzuca go zwykłemu implantowi. Daje słabszy Rezonans i wymaga stałego dostrajania do żywego wzorca.
- Nazwa ma drugie dno: w Niecce „robota na akord” to praca od sztuki. Żołnierzy z Akordem ulica nazywa **akordowcami** i nikt nie traktuje tego jak komplementu.
- **Kamerton** to wewnętrzny termin Helixa na żywego Rezonanta podłączonego do aparatury jako źródło wzorca. Kamerton musi żyć i być minimalnie przytomny; jeden stroi kilkaset Akordów. Kamertony leżą latami w **Zakładzie Kalibracji** pod kampusem na Tarasie.
- **Sztuczny Rezonans świeci czerwienią, nie magentą.** Wrogowie z Akordem pozostają czerwoni (filar 4), a gracz od pierwszego spotkania widzi różnicę między oryginałem a kopią.
- Akordy się **rozstrajają**. Gdy kamerton umiera, wszyscy dostrojeni do niego użytkownicy tracą najpierw kontrolę nad ruchem, potem nad sobą. To **rozstrojeni**.
- **Chór** to projekt Orbis Grid: sieć, która stroi wszystkie Akordy naraz z jednego węzła na szczycie Masztu. Daje dwie rzeczy: każdy użytkownik Akordu staje się sterowalny z Korony, a ten sam sygnał w przeciwnej fazie zagłusza naturalny Rezonans w całym mieście. Koalicja dostaje armię posłusznych Rezonantów i miasto bez prawdziwych.

### 3.4 Koalicja

Sojusz trzech korporacji. Łańcuch jest prosty i każde ogniwo uważa, że tylko wykonuje swoją część: **Kurogane łapie, Helixa produkuje, Orbis kupuje.** Ten motyw wraca w ostatnich słowach każdego dyrektora.

| Korporacja | Poziom | Rola w spisku | Styl wrogów (kształt i zachowanie, zawsze czerwoni) | Dyrektor |
| --- | --- | --- | --- | --- |
| **Kurogane Arms** | Huty | Maszty nasłuchowe, obławy, transport Rezonantów do Helixy, testy Akordu na własnych żołnierzach | Ciężkie pancerze, tarcze, formacje, ostrzał zaporowy | **Oskar Brandt**, Dyrektor Ochrony |
| **Helixa Dynamics** | Taras, Bulwar | Produkcja Akordu, Zakład Kalibracji, bezpłatne przychodnie wszczepiające Akord | Sterylne maski, pancerze z gładkich płyt, granaty-strzykawki, powolni i wytrzymali | **dr Agata Lind**, Dyrektor Laboratorium |
| **Orbis Grid** | Korona | Monitoring miasta, kontrola przekazu, wykup całej produkcji Akordu, budowa Chóru | Smukłe sylwetki, drony, snajperzy, hakowanie przestrzeni | **Wiktor Sarnecki**, Dyrektor Systemów |

### 3.5 Iskra

Komórka ruchu oporu, około trzydziestu osób, w stacji Kamienna. Założył ją dwanaście lat temu Stary Tomasz z garstką uciekinierów z górnych poziomów. Operacjami kieruje Kapitan Szron. Iskra nie jest armią: sabotuje, odbija ludzi, kradnie informacje i żyje z tego, że Koalicja uważa ją za zbyt małą, żeby się nią zajmować. Pod koniec kampanii okazuje się, że to nie był przypadek.

## 4. Postacie

### 4.1 Bohater (Kurier)

Neoryder z Niecki, implant ruchowy na raty. W prologu, na rampie towarowej w Hutach, zatrzymuje spadający kontener, nie dotykając go. Kwadrans później maszty nasłuchowe Kurogane wyłapują sygnaturę i przyjeżdża patrol. Szron dociera pierwszy. Bohater jest od tej nocy na liście poszukiwanych. Motywacja zmienia się z przetrwania na ludzi, ale gra mówi o tym działaniem, nie słowami.

### 4.2 Iskra (postacie z kryjówki)

- **Kapitan Szron**, koordynator operacji. Były porucznik ochrony Kurogane, służył pod Brandtem. Odszedł po pacyfikacji przepompowni w Niecce dziewięć lat temu, gdy Kurogane strzelało do ludzi blokujących wyłączenie pomp. Spokojny, oszczędny w słowach, planuje do przesady i źle znosi rzeczy, których nie zaplanował. Wątki: Brandt (akt I), zaufanie do Wolan (akt II), Tomasz (akt III).
- **Mira**, mechaniczka. Sucha, konkretna, troskliwa w czynach, nie w słowach. Jej młodszy brat **Tymon** zniknął rok temu; Mira jest pewna, że go złapano. W akcie II okazuje się, że sam poszedł do Kurogane i wziął Akord, żeby spłacić dług rodziny.
- **Doktor Helena Wolan**, badaczka Rezonansu. Była naukowczyni Helixa i współautorka metody kopiowania wzorca: piętnaście lat temu opisała ją jako terapię, z jednorazowym udziałem dawcy-ochotnika. Odeszła, gdy dowiedziała się o stałych dawcach, ale nikomu w Iskrze nie powiedziała, że to jej metoda. Wątki: wina i jawność (M10), naprawa (M13, M20); to ona projektuje **dysonans**, sygnał rozstrajający Chór.
- **Bajt**, haker. Dwa lata pracował na kontrakcie w Sali Monitorów Orbis, oglądając obraz z miejskich kamer. Ksywka została z tamtej zmiany: był najmłodszy, „najmniejsza jednostka”. Kiedyś rutynowo oznaczył nagranie z manifestacją Rezonansu, a następnego dnia zobaczył tę osobę w rejestrze „przeniesionych do opieki”. Odszedł i od tamtej pory nie oznacza niczego. Humor ma obronny. Wątek: M16.
- **Stary Tomasz**, weteran i założyciel Iskry; pilnuje ognia w beczce na peronie B. Ciepły, mądry, wszyscy go lubią. **Sekret:** od dziewięciu lat jest informatorem Kurogane o pseudonimie **„Palacz”**. Umowa z Brandtem: Kurogane nie rusza Kamiennej, a Tomasz zgłasza Rezonantów działających na własną rękę, poza Iskrą. Wierzył, że kupuje życie trzydziestu ludzi za życie kilku obcych. To on zgłosił Kuriera w noc prologu; Szron był szybszy przypadkiem. Ujawnienie w M14, los w M15.

### 4.3 Nowi sojusznicy

- **Ida**, Rezonantka, w rejestrach Helixa kamerton K-112. Cztery lata w aparaturze. Odbita w M4, do M8 nieprzytomna w pracowni Wolan. Mówi mało, myśli szybko, ma kłopot z oddzieleniem snów od wspomnień z aparatury. Przez lata „słyszała” dostrajane do siebie Akordy i nadal je wyczuwa w pobliżu, co daje Iskrze przewagę. Jej Rezonans jest silniejszy niż Kuriera, ale nieopanowany. W akcie III wspiera z dystansu (M19, M20).
- **Tymon**, brat Miry, żołnierz Kurogane z Akordem. Przeciwnik w M9, potem więzień w kryjówce; Orbis zabiera go podczas nalotu w M15, Chór synchronizuje go w M18, gracz go odzyskuje. Nie przeprasza za swój wybór: „Wy macie ideały. Ja miałem ratę.”
- **Nadia Korsak**, kurierka, dawna koleżanka z dyspozytorni. Uwolniona w M2, zostaje w Bulwarze jako oczy Iskry. Nie walczy; zna trasy, windy i ludzi. Pojawia się w odprawach M7, M11, M16, M19.

### 4.4 Przeciwnicy

- **Oskar Brandt**, Dyrektor Ochrony Kurogane Arms (istniejący boss `securityChief`). Żołnierz, który awansował na menedżera. Lojalny wobec procedury, gardzi Helixą, ale wykonuje kontrakt. Zna Szrona osobiście i powiedział swoim ludziom, że Szron utonął w Niecce. Ginie w M6. Ostatnie słowa w duchu: „Ja tylko dowożę.”
- **dr Agata Lind**, Dyrektor Laboratorium Helixa, dawna uczennica Wolan. Uważa Akord za największe osiągnięcie medycyny stulecia, a kamertony za „koszt kliniczny”. Nosi najlepszy Akord, jaki zbudowano, dostrojony do Idy; Ida czuje ją z odległości. Pokonana w M13: jej Akord rozstraja się na oczach gracza, gdy kamertony zostają odłączone. Zostaje w zakładzie, a Helixa ogłasza ją ofiarą zamachu. Ostatnie słowa w duchu: „My tylko produkujemy.”
- **Wiktor Sarnecki**, Dyrektor Systemów Orbis Grid. Do M20 nie pojawia się osobiście: jest tekstem na ekranach, sterowaniem dronów, zmienionym przekazem. Nie ma żadnego implantu i nie potrzebuje. Wierzy w miasto, w którym nic nie dzieje się nieprzewidywalnie. W M20 okazuje się zwykłym człowiekiem w cichym biurze; gracz walczy z systemem, nie z nim. Ostatnie słowa w duchu: „Ktoś to kupi. Zawsze ktoś kupuje.”

## 5. Prolog (samouczek)

Noc, deszcz, rampa towarowa w Hutach. Kurier odbiera paczkę, gdy z suwnicy zrywa się kontener. Odruch, magentowy błysk, kontener zawisa metr nad ziemią. Syreny. Tunel serwisowy, obcy głos w słuchawce („Prosto, potem w lewo do kraty. Nie oglądaj się.”), ucieczka w dół do Niecki. Samouczek na poligonie Kamiennej to pierwsza noc w Iskrze: Szron sprawdza, co nowy człowiek potrafi.

Po samouczku w kryjówce:

> **Szron:** Kurogane ma cię na liście. Możesz siedzieć w tym tunelu do końca życia albo pomóc nam sprawić, żeby ta lista przestała działać.
> **Tomasz:** Usiądź najpierw. Herbata jest ciepła. Reszta poczeka do rana.

## 6. Łuk fabularny

### Akt I — Huty (M1–M6), Kurogane Arms

**Pytanie aktu:** dlaczego Kurogane nagle tak skutecznie poluje na Rezonantów i dokąd ich wozi?

Iskra niszczy maszty nasłuchowe, które wykryły Kuriera, i odkrywa w nich czujniki medyczne Helixa. Odbija zatrzymanych z obławy na kurierów, w tym Nadię. Z listów przewozowych w porcie dowiaduje się o cotygodniowych kontenerach „ładunku biologicznego klasy K” jadących z Hut na Taras. Przejmuje jeden z nich i znajduje w środku Idę w aparaturze. Brandt zamyka Huty; Iskra łapie jego adiutantkę z kartą do sieci ochrony i uderza w Odlewnię.

**Koniec aktu:** Brandt nie żyje. Jego serwer zawiera kontrakty z Helixą, słowa „Akord” i „kamerton”, listę kilkuset „przekazanych” Rezonantów z sześciu lat i zaszyfrowany folder „Palacz”, który Bajt zaczyna łamać.

### Akt II — Bulwar i Taras (M7–M13), Helixa Dynamics

**Pytanie aktu:** czym jest Akord i kto za niego płaci?

Nocne włamanie do bezpłatnej przychodni Helixa daje próbkę Akordu i rejestr pacjentów, a w nim nazwisko Tymona. Ida budzi się i prowadzi Iskrę do strefy kwarantanny, gdzie po śmierci jednego kamertonu rozstroił się cały blok. Mira wymusza akcję: Kurier łapie Tymona żywcem podczas pokazu Akordu dla inwestorów. Wolan prosi o misję w starym archiwum Helixa i wtedy wychodzi na jaw, że metoda kamertonów jest jej. Iskra nadaje dowody na ekranach Bulwaru, a Orbis w ciągu pół godziny podmienia przekaz w całym mieście. Kurier wchodzi do kampusu przez oczyszczalnię i uwalnia kamertony z Zakładu Kalibracji.

**Koniec aktu:** kilkunastu uwolnionych Rezonantów, większość w złym stanie. Lind pokonana. Dokumenty zakładu mówią, że od dwóch lat całą produkcję Akordu kupuje Orbis Grid na potrzeby projektu „Chór”.

### Akt III — Korona (M14–M20), Orbis Grid

**Pytanie aktu:** kto trzyma smycz i kto jest w środku Iskry?

Bajt łamie folder „Palacz”: w Iskrze jest informator, a ostatni raport opisuje noc prologu. Pułapka Szrona wskazuje Tomasza, który przyznaje się bez zaprzeczania. Szron wyznacza mu wygnanie o świcie, ale z chwilą zdemaskowania Tomasza stara umowa przestaje obowiązywać: Orbis, który po śmierci Brandta przejął wywiad Kurogane, uderza na Kamienną tej samej nocy. Tomasz otwiera starą zastawkę przeciwpowodziową i zalewa tunele, zatrzymując natarcie; zostaje przy niej. Orbis zabiera Tymona. Iskra przechodzi do ofensywy: Bajt wraca do Sali Monitorów po plany Masztu, Kurier wyłącza trzy podstacje zasilające osłony Masztu, przerywa lokalną próbę Chóru w Bulwarze i odzyskuje Tymona, a potem wspina się Masztem na szczyt.

**Koniec aktu i kampanii:** węzeł Chóru zniszczony, Maszt milczy. Sarnecki żyje, ale całe miasto ogląda jego biuro na każdym ekranie, tym razem bez montażu Orbis.

## 7. Zakończenie

Koalicja nie upada. Kurogane i Helixa nadal istnieją, Orbis odbuduje sieć. Ale kamertony są wolne, Chór nie powstał, a miasto po raz pierwszy zobaczyło, kto i jak nim steruje. Wszystkie Akordy w mieście gasną: część użytkowników jest wdzięczna, część wściekła, Tymon traci swój Rezonans i nie wie, co o tym myśleć.

Epilog w kryjówce: Ida zapala ogień w zimnej beczce Tomasza jednym magentowym wyładowaniem.

> **Szron:** Tablica jest pusta. Pierwszy raz od dwunastu lat.
> **Mira:** Nie przyzwyczajaj się.

Po epilogu gra przechodzi w freeplay: kolejne zlecenia na tablicy misji.

## 8. Wątki osobiste

| Postać | Akt I | Akt II | Akt III |
| --- | --- | --- | --- |
| Szron | Brandt rozpoznaje jego głos w M6; wychodzi na jaw jego przeszłość w Kurogane | Traci zaufanie do Wolan (M10), ale jej potrzebuje | Demaskuje Tomasza (M14), traci go (M15), prowadzi ofensywę |
| Mira | Ładunki, technika, przejęcie lokomotywy (M4) | Odkrywa wybór Tymona (M7), wymusza jego odbicie (M9) | Traci go ponownie (M15), odzyskuje (M18) |
| Wolan | Za długo patrzy na aparaturę Idy (M4) | Ujawnienie (M10), prowadzi przez oczyszczalnię (M12) | Projektuje dysonans (M20) |
| Bajt | Analiza masztów, łamanie „Palacza” | Nadaje dowody i przegrywa z montażem Orbis (M11) | Wraca do Sali Monitorów (M16) |
| Tomasz | Prowadzi przez radio w M1 (ironia widoczna dopiero po M14) | Opiekuje się Idą | Zdemaskowany (M14), zostaje przy zastawce (M15) |
| Ida | Odbita w M4 | Budzi się, prowadzi do kwarantanny (M8), stroi Tymona własnym wzorcem (po M9), czuje Lind (M12–M13) | Trzyma hamulec windy (M19), zapala ogień (epilog) |
| Tymon | — | Złapany (M9), w zamknięciu w kryjówce | Zabrany (M15), zsynchronizowany i odzyskany (M18), daje kody wind serwisowych (M19) |
| Nadia | Uwolniona (M2) | Informatorka w Bulwarze (M7, M11) | Trasy dostaw do Sali Monitorów (M16), czasy wind (M19) |

## 9. Motywy i symbole

- **Strojenie:** Akord, kamerton, rozstrojeni, Chór, dysonans, cisza. Ostatnia misja nazywa się „Cisza”.
- **Ogień w beczce:** pilnuje go Tomasz; gaśnie po M15; w epilogu zapala go Ida.
- **Maszty:** pierwsza misja niszczy małe maszty w Niecce, ostatnia — szczyt Masztu.
- **Kopia i oryginał:** czerwony Rezonans akordowców i magentowy Rezonans prawdziwych Rezonantów.
- **Dług:** w Niecce wszyscy coś spłacają: implant Kuriera, rata rodziny Tymona, umowa Tomasza z Brandtem, wina Wolan.
- **„Ja tylko…”:** Brandt dowozi, Lind produkuje, Sarnecki kupuje. Nikt nie czuje się winny.

## 10. Kryjówka zmienia się razem z fabułą

Zmiany są środowiskowe i w kwestiach NPC (dane kryjówki), bez nowych mechanik.

| Po misji | Zmiana |
| --- | --- |
| M2 | Nadia odzywa się przez radio przy biurku Bajta |
| M4 | W kąciku łączności łóżko z aparaturą i nieprzytomna Ida; Wolan przy niej |
| M6 | Mapa Hut na tablicy misji przekreślona; Szron dłużej stoi przy tablicy |
| M8 | Ida chodzi po kryjówce, siada przy ogniu z Tomaszem |
| M9 | Tymon zamknięty w magazynie pod antresolą; Mira siedzi przy drzwiach |
| M10 | Wolan pracuje sama, inni jej unikają; nowe kwestie o winie |
| M13 | Prycze z uwolnionymi kamertonami na antresoli |
| M15 | Tory i część peronu B pod wodą, beczka zimna, Tomasza nie ma, magazyn Tymona pusty |
| M18 | Tymon wraca, siedzi z Mirą w wagonie-warsztacie |
| M20 | Ida zapala ogień w beczce; epilog |

## 11. Powiązanie z rozgrywką

- **Misja to run.** Każda misja korzysta z pętli runu (`docs/systems/run.md`, `sectorMap.md`): sektor frakcji z mapą wyboru ścieżki, pokoje, implanty, sklep, odpoczynek. Misja dokłada warunek celu, pokoje fabularne o stałej pozycji i dialogi. Śmierć oznacza powrót do kryjówki i powtórkę misji; trwały progres zostaje.
- **Odblokowania sektorów:** Huty od początku (istniejący sektor `kurogane`), Bulwar i Taras po M6, Korona po M13.
- **Nowi wrogowie** wymienieni w plikach misji (akordowiec, rozstrojony, sanitariusz Helixa itp.) to propozycje do `docs/backlog.md`, nie zobowiązanie do kodu w bieżącej fazie. Do czasu ich powstania misje korzystają z istniejących archetypów.
- **Nagrody** w plikach misji to propozycje do zbalansowania w F5 (`docs/balance.md`).
- **Demo (F5, 5 misji z różnymi celami z GDD, wszystkie w sektorze Kurogane):** M1 sabotaż, M2 odbicie więźnia, M3 obrona, M4 eskorta, M6 likwidacja dyrektora.
