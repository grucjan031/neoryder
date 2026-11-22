# Lista zmian

Wszystkie istotne zmiany w wersji demonstracyjnej gry **NEORYDER** są dokumentowane w tym pliku.

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/).

## [0.1.0-demo] — niewydane

### Walka

- Płynne poruszanie się z perspektywy pierwszej osoby: bieg, sprint, skok, podwójny skok (odblokowywany jako talent), doskok oraz ślizg w biegu, powiązane z paskiem wytrzymałości.
- Walka ostrzem plazmowym: seria szybkich cięć (combo), ładowany ciężki cios przebijający tarcze i blok, blok redukujący obrażenia kosztem energii, rzut ostrzem wracającym do gracza oraz cięcie z doskoku.
- Parowanie pocisków oraz ciosów wręcz ostrzem (wciśnięcie bloku tuż przed trafieniem odbija pocisk w stronę strzelca lub ogłusza napastnika i odnawia energię).
- Wykończenia osłabionych lub ogłuszonych przeciwników po zbliżeniu się z ostrzem (przebijają tarczę i parowanie wroga, odnawiają część zdrowia i energii).
- Celowanie z broni palnej prawym przyciskiem myszy (przybliżenie i zmniejszenie rozrzutu) oraz buforowanie spustu w broni półautomatycznej.
- System przegrzania broni palnej zamiast amunicji.
- Efekty statusów w walce: Podpalenie, Przeciążenie (wyładowanie przy trzech ładunkach), Ogłuszenie oraz Zagłuszenie blokujące aktywację nowych mocy.
- Zagrożenia środowiskowe na arenach: pola pod napięciem, cykliczne bramki laserowe i wybuchowe beczki (w tym reakcje łańcuchowe).
- Wyraźne czucie każdego trafienia: zatrzymanie klatki (hitstop), wstrząsy kamery, rozpad pokonanych wrogów na odłamki oraz spowolnienie czasu przy ostatnim zabójstwie w fali.
- Przewracanie humanoidalnych wrogów mocnym odrzutem i ich animowane wstawanie.

### Moce i bronie

- Trzy warianty ostrza: Ostrze plazmowe (zrównoważone), Ostrza bliźniacze (szybsza seria czterech cięć) oraz Ostrze dwustronne (szerokie cięcia, obrót 360° w ciężkim ataku i szerszy kąt odbijania pocisków).
- Siedem rodzajów broni palnej: Blaster, Pistolet, Karabin, Rozpraszacz, Snajperka, Laser ciągły oraz Granat EMP.
- Sześć mocy Rezonansu z obsługą dwóch aktywnych slotów: Pchnięcie Rezonansu, Chwyt i rzut (przenoszenie i rzucanie wrogów oraz obiektów), Błyskawica (przeskoki między celami i Przeciążenie), Fala uderzeniowa, Bariera (odbija pociski przed graczem) oraz Skupienie (spowalnia świat wokół gracza).
- Warsztat modułów broni z trzema slotami (Wylot, Ogniwo, Optyka), obracanym podglądem 3D i widocznymi elementami na modelach broni: Rykoszet, Przebicie, Podpalenie, Nadprzewodnik, Kolimator i Luneta.
- Zestawy startowe i 14 synergii (m.in. Tancerz ostrzy, Pistolero Rezonansu, Burzowy strzelec oraz hybrydy oparte na tagach ostrza, mocy, broni i elektryczności).

### Wrogowie i bossowie

- Osiem podstawowych typów przeciwników Koalicji o wyraźnych sylwetkach i rolach: Szturmowiec, Strzelec, Snajper (z linią lasera celowniczego i blokadą celu), latający Dron, Dron-haker (zagłuszający moce), Tarczownik (blokujący ataki z przodu), elitarny Egzekutor (parujący lekkie cięcia i kontrujący ciężkim ciosem) oraz stacjonarna Wieżyczka.
- Walka z bossem sektora — Dyrektorem Ochrony Kurogane Arms (Oskar Brandt) — z trzema fazami, nietykalną osłoną fazową, uderzeniem obszarowym, wachlarzem pocisków do odbicia i wzywaniem wsparcia.
- Koordynacja taktyczna przeciwników: kolejkowanie ataków i ostrzału w grupie, flankowanie, chowanie się Strzelców za osłonami oraz uniki przed ciężkim ciosem i doskokiem.

### Run i progresja

- Pętla runu w sektorze Kurogane Arms: generowana z ziarna (seed) mapa warstw z wyborem trasy przez pokoje walki, elity, sklepy i miejsca odpoczynku aż do starcia z bossem.
- 44 tymczasowe implanty zdobywane po pokojach, w sklepie i podczas odpoczynku (w tym warianty zmieniające zasady walki oraz implanty przeklęte z efektem ubocznym).
- Podgląd bieżącego ekwipunku, implantów, synergii, broni, modułów i mocy w trakcie runu pod klawiszem `Tab`.
- Trwała meta-progresja: zdobywanie doświadczenia i poziomów postaci (do 20. poziomu), cztery drzewka talentów (Ostrze, Rezonans, Strzelec i Hybrydy — łącznie 29 węzłów z możliwością darmowego resetu) oraz waluty Dane i Rdzenie.
- Warsztat z trwałymi odblokowaniami broni, mocy, wariantów ostrzy, dodatkowych slotów uzbrojenia i modułów.
- System 26 osiągnięć („Naszywki Iskry”) przyznający jednorazowe nagrody oraz otwierający dostęp do zakupu rzadkich ulepszeń.
- Jedenaście poziomów zagrożenia (od Rutyny do Totalnej blokady) zwiększających wyzwanie i premie do nagród po kolejnych zwycięstwach.
- Automatyczny zapis w przeglądarce (oddzielnie trwały postęp, bieżący run i punkty kontrolne misji fabularnych) z opcją kontynuacji z menu głównego.

### Kryjówka

- Grywalna baza ruchu oporu „Iskra” na nieczynnej stacji metra Kamienna, łącząca Tablicę misji, Warsztat w wagonie metra, Terminal drzewek w kąciku łączności i wejście na Poligon.
- Dwa skrzydła mieszkalne i użytkowe (jadłodajnia, kwatery, Radio Iskry, targ wymiany, bar z parkietem) oraz plan stacji dostępny pod klawiszem `M`.
- 23 postacie niezależne (w tym Kapitan Szron, Mira, Doktor Wolan, Bajt i Stary Tomasz), podsłuchiwane rozmowy między mieszkańcami, znaczniki oczekujących reakcji oraz komentarze po powrocie z runów i misji.
- Interaktywne elementy stacji: szafa grająca z trzema utworami, miska ciepłego makaronu, radio, worek treningowy oraz siedziska, na których można usiąść.
- Zwierzęta na stacji (kot Węgielek reagujący na głaskanie oraz szczury) i okresowe spadki napięcia przygaszające światła w kryjówce.

### Misje i tryby

- Trzy misje fabularne pierwszego aktu z odprawami, przerywnikami, łącznością radiową w trakcie akcji i zmianami w kryjówce po ukończeniu:
  - **Maszty** — liniowa misja sabotażowa w Niecce z punktami kontrolnymi i ucieczką przed wybuchami.
  - **List przewozowy** — misja z obroną strefy terminala w porcie towarowym i odpieraniem fal podczas transferu danych.
  - **Odlewnia** — natarcie na siedzibę ochrony Kurogane, starcie z Oskarem Brandtem, zgranie serwera i ewakuacja windą towarową.
- Trzy tryby areny uruchamiane z tablicy misji: **Przejęcie** (walka o kontrolę punktów i wyczerpanie puli posiłków Koalicji), **Szturm** (wysadzanie par stacji i przesuwanie frontu przez sektory) oraz **Kradzież rdzenia** (przejęcie rdzenia z bazy wroga i doniesienie go do strefy ewakuacji).
- Siedem dużych aren dla trybów dodatkowych: Terminal kontenerowy, Węzeł Estakada, Dachy Starego Miasta, Elektrownia, Budowa wieżowca, Zajezdnia Maglev i Zalane Doki.
- Samouczek na Poligonie Iskry (11 kroków uczących ruchu, walki ostrzem, parowania, chłodzenia broni, mocy i wykończeń) oraz Poligon treningowy do swobodnej walki z falami.

### Audio i grafika

- Komiksowa oprawa Neon Noir: nocne, deszczowe dzielnice, wyraźny kontur skalowany z odległością, neony, hologramy reklamowe, mokre odbicia na asfalcie i selektywny bloom.
- Czytelna paleta ról w walce: czerwień i poświata krawędzi wyróżniająca wrogów z daleka, cyjan dla gracza i ostrza, magenta dla Rezonansu oraz jasne obiekty interaktywne.
- Profile pogodowe dla dużych aren: deszcz, burza, mżawka z wiatrem, smog, opad popiołu i śnieg, z osłoną przed opadami pod zadaszeniami.
- Widok rąk FPP w rękawicach taktycznych oraz dedykowane modele 3D broni, ostrzy, przeciwników, bossa, mieszkańców kryjówki i rekwizytów miejskich.
- Holograficzny HUD w stylu wizjera hełmu, wyraźne bursztynowe zapowiedzi ciosów nie do zablokowania, wskaźnik zagrożeń spoza kadru, ekran porażki z przyczyną śmierci i wskazówką oraz 57 ilustracji na ekranach ładowania z poradami (bez spoilerów z dalszych aktów).
- Syntezowane efekty dźwiękowe walki i tła kryjówki oraz dynamiczna muzyka przechodząca między spokojem, walką i starciem z bossem.

### Ustawienia i dostępność

- Menu pauzy i ekran ustawień (Sterowanie, Obraz, Dźwięk) dostępny z menu głównego oraz podczas gry.
- Możliwość przemapowania wszystkich klawiszy klawiatury (z automatycznym rozwiązywaniem konfliktów), regulacja czułości myszy i odwrócenie osi Y.
- Cztery poziomy trudności (Łatwy, Normalny, Trudny, Koszmar — domyślnie Trudny) skalujące parametry oraz zachowania taktyczne przeciwników.
- Ustawienia obrazu i komfortu: pole widzenia (FOV), trzy profile jakości grafiki stosowane na żywo (Niska, Średnia, Wysoka), suwak siły wstrząsów kamery oraz wyłącznik błysków ekranu (ograniczający także migotanie świateł i spadki napięcia).
- Osobne suwaki głośności głównej, efektów dźwiękowych i muzyki.

### Wydajność

- Wstępna kompilacja shaderów na ekranie ładowania usuwająca zacięcia po wejściu do nowej sceny lub pokoju.
- Scalanie statycznej geometrii w pokojach i kryjówce oraz optymalizacja dużych aren (mniejsza liczba wywołań rysowania, deszcz liczony w shaderze i szybsze rysowanie broni w widoku FPP).
- Pooling pocisków i odłamków oraz ograniczanie aktualizacji animacji postaci znajdujących się poza kadrem.

### Poprawki

- Zabezpieczono rozliczanie nagród po zakończeniu runu i misji przed utratą lub podwojeniem w razie błędu zapisu oraz dodano możliwość ponowienia zapisu z ekranu podsumowania.
- Zabezpieczono kredyty, implanty i punkty kontrolne przed utratą po odświeżeniu strony oraz dopracowano automatyczną pauzę przy utracie fokusu, zminimalizowaniu okna lub przełączeniu karty (wraz z zatrzymaniem muzyki).
- Poprawiono kolorystykę efektów na arenie bossa (czytelna czerwień zamiast odcieni zbliżonych do magenty Rezonansu), przenikanie poświat przez ściany oraz oświetlenie ciemnych okien.
- Wyeliminowano blokowanie się wrogów na ścianach i meblach, kolizje oraz zasłanianie linii wzroku NPC w kryjówce, a także zacinające się przejścia i zwalnianie pamięci przy zmianie scen.
- Poprawiono działanie modyfikatorów obrażeń i szybkości ataku gracza, wyzwalanie synergii bez podwójnych mnożników, obsługę zapisów pochodzących z nowszych wersji oraz spójność polskich opisów i elementów HUD.
