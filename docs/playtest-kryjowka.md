# Playtest kryjówki — lista kontrolna (15–20 minut)

Lista kontrolna ręcznego playtestu rozbudowanej kryjówki (`?scene=hub`). Wszystkie komendy wpisuj w konsoli debug (klawisz `` ` ``) dokładnie tak, jak podano poniżej.

## Przygotowanie

- [ ] Uruchom serwer deweloperski: `npm run dev` (adres `http://localhost:5173`).
- [ ] Otwórz w przeglądarce kryjówkę w trybie debug: `?scene=hub&debug=1`.
- [ ] Kliknij w okno gry (canvas), aby odblokować dźwięk i przechwycić mysz.
- [ ] Sprawdź, czy otwiera się konsola debug klawiszem `` ` `` oraz czy w lewym górnym rogu widać licznik FPS (stats.js).

---

## 1. Ekrany ładowania

_(Wskazówka: aby zdążyć obejrzeć poradę i jej zmianę po 7 s, w narzędziach deweloperskich przeglądarki włącz spowolnienie sieci, np. Slow 3G)._

- [ ] **Menu główne (`/`):** splashart pasuje do sceny (panorama Neo-Ryd, kurier lub dachy przed świtem); pod podpisem widać poradę z bursztynowym nagłówkiem „Porada” lub „Neo-Ryd” oraz pasek ładowania.
- [ ] **Kryjówka (`?scene=hub`):** splashart pasuje do sceny (obrazy `hideout`, budka z makaronem lub bar hutników); porada jest czytelna na ciemnym gradiencie.
- [ ] **Poligon (`?scene=arena`):** splashart pasuje do sceny (trening lub walka); porada z nagłówkiem jest widoczna.
- [ ] **Samouczek (`?scene=tutorial`):** splashart pasuje do sceny (rampa lub poligon); porada z nagłówkiem jest widoczna.
- [ ] **Rotacja porad przy dłuższym ładowaniu:** przy spowolnionej sieci po ok. 7 s pojawia się kolejna porada.

---

## 2. Spacer po strefach (`hub tp` / `hub look`)

Przejdź przez wszystkie strefy, wpisując poniższe komendy w konsoli debug (uwaga: po `hub tp` nakładka stacji nie otwiera się sama — sprawdź wygląd, napisy i działanie `E` / `Esc`).

- [ ] **Hala — tablica misji:** `hub tp -6 -4.4 0` a potem `hub look missions` → widać bursztynowy napis `MISJE`, ciemne plecy i ramę z jasnymi akcentami oraz Kapitana Szrona; podpowiedź „E”, naciśnięcie `E` otwiera tablicę misji, `Esc` zamyka.
- [ ] **Hala — poligon i graffiti:** `hub tp 14 -4.8 0` a potem `hub look arena` → błękitny napis i światło nad wejściem do tunelu, ciemne słupki z jasnymi paskami, `E` otwiera nakładkę poligonu, `Esc` zamyka. Następnie `hub tp -17.5 -3 59 5` → cały prostokąt graffiti `OPÓR` na zachodniej ścianie (brzegi nie wystają za narożnik), w hali widoczne neony `ISKRA` i `METRO`, plakaty, automat, kiosk oraz generator.
- [ ] **Antresola:** `hub tp -12 1.4 0` i przytrzymaj `W` → płynne wejście po stopniach na podest (`y = 2,4 m`) z barierką i skrzyniami; pod spodem widać magazyn z zielonym światłem.
- [ ] **Wagon-warsztat:** `hub tp -9.5 4.4 180 -18` a potem `hub look workshop` → wrak wagonu na torach z dwojgiem drzwi od hali i oknami od peronu B, zielony neon `warsztat`, ciemne szafki, cienki jasny blat z pomniejszonymi modelami, ławki i generator; `E` otwiera warsztat, `Esc` zamyka. Następnie `hub tp -8.2 3.9 255` i `hub look mira` → podpowiedź „MIRA / POROZMAWIAJ”.
- [ ] **Kładka i tory:** `hub tp 5.5 3.6 180` → metalowy pomost z barierkami nad niecką torów łączący halę z peronem B; na obu końcach torów wyloty tunelu z parą i kapaniem (zeskok w tory nie blokuje gracza — skok wyprowadza na peron).
- [ ] **Peron B — strefa wypoczynku, beczka i bar:**
  - `hub tp -11.2 10 123 -12` → płomień mieści się nad otworem metalowej beczki z obręczami, beczka zasłania dolną część płomienia.
  - `hub tp -8 10.6 90 5` oraz `hub tp -12 10.6 -90 5` → widać strefę wypoczynku z kanapami, stolikiem, sznurami lampek, muralem `mural_spark`, automatem, kioskiem i banerem `banner_iskra` w stronę targu.
  - `hub tp -6.5 11 180 -10` → bar z neonem `sign_bar` i otwartą ladą, szafa grająca z paskami zieleni/fioletu oraz parkiet 2 × 2 m.
- [ ] **Targ wymiany:** `hub tp -22 13 90 -10` → napis `TARG`, stragany, plandeka, skrzynie, dwie niepalące się beczki, lada handlarza z wolnym miejscem za ladą, lampki w zieleni/fiolecie i szerokie przejście na peron B.
- [ ] **Korytarz (przejście północne):** `hub tp 4.5 -9.75 90 -8` → wolny korytarz 3 m łączący strefy północne, rury, przewody, lampy kratowe co 4 m (naprzemiennie bursztyn i ciepła biel), kratka z parą, kapanie, graffiti, naklejki, strzałki i rozdzielnia z wnęką na końcu.
- [ ] **Jadłodajnia:** `hub tp -14 -12.5 0 -12` → napis `JADŁODAJNIA`, budka z makaronem, neon `noodles`, garnki z parą, menu, zapasy, lampiony oraz dwa stoły z czterema ławami (bursztyn/ciepła biel).
- [ ] **Kwatery:** `hub tp -4.5 -12 0 -15` → napis `KWATERY`, dwie prycze piętrowe i łóżko polowe, materace, koce, zasłony, szafka medyczna, walizki, dywaniki, wieszak, pranie pod sufitem i odsłonięta krawędź pryczy (przygaszona ciepła biel).
- [ ] **Radio Iskry:** `hub tp 4.5 -12.5 0 -12` → napisy `RADIO ISKRA` / `NA ANTENIE`, wysunięty regał sześciu odbiorników z ekranami i błękitnymi paskami, mikrofon na wysięgniku, słuchawki, mikser, kable, wygłuszenie, baner Iskry oraz stołek z miejscem na nogi pod biurkiem.
- [ ] **Trening w hali:** `hub tp 15.5 -1 -120 -10` → worek treningowy na linie i wolny kwadrat 2 × 2 m obok; mniejszy neon `METRO` umieszczony wyżej wzdłuż ściany, poza bezpośrednim tłem worka.
- [ ] **Kącik łączności:**
  - `hub tp 9.2 10.6 262` → wejście do kącika łączności, fioletowy napis `TALENTY` nad wejściem.
  - `hub tp 14.05 13.6 0` → brak podpowiedzi mimo zasięgu; potem `hub look talents` → pojawia się podpowiedź „E TALENTY”.
  - `hub tp 14.05 13.6 180` a potem `hub look talents` → `E` otwiera terminal drzewek, `Esc` zamyka.
  - `hub tp 18 14.3 105 -8` → ciemny bok terminalu po lewej, brak płaszczyzny zasłaniającej otwór drzwi.
  - `hub tp 17 13.8 -38 -20` a potem `hub look bajt` → szafy serwerowe z ekranami, biurko Bajta z ekranem `screen_comms`, hologram Kurogane, projektor, antena i kable.

---

## 3. Mieszkańcy (23 NPC)

W kryjówce przebywa 5 kluczowych postaci (`mira`, `wolan`, `szron`, `bajt`, `tomasz`) oraz 18 mieszkańców (`hela`, `jarek`, `ewa`, `bogna`, `feliks`, `lena`, `zofia`, `teo`, `iga`, `marek`, `grzes`, `rudy`, `nina`, `witek`, `kuba`, `pawel`, `ola`, `stas`).

- [ ] **Rozmowa `E` z kilkoma NPC:** podejdź i spójrz na postać (np. `mira`, `hela`, `rudy`, `nina`, `witek`) → widać podpowiedź „[E] Porozmawiaj” z imieniem; `E` otwiera dymek z imieniem, rolą i kwestią; kolejne `E` przełącza kwestie w pętli; dymek znika po ok. 5 s lub po odejściu. Sprawdź też komendę `hub talk mira` (dymek pojawia się bez patrzenia na NPC).
- [ ] **Różny wygląd:** sprawdź w różnych strefach (np. jadłodajnia, targ, kwatery, bar) — mieszkańcy różnią się odcieniem stroju, nakryciami głowy (czapki, gogle, okulary, słuchawki, bandana, kaptur), ubiorem (kamizelka, fartuch, płaszcz, kurtka) i rekwizytami (torby, plecaki, pas narzędziowy).
- [ ] **Chodzący ustępują:** znajdź `kuba` (trasa targ → peron B → kładka → hala → korytarz → jadłodajnia) lub `pawel` (pętla hali). Stań mu na drodze przed nim → zatrzymuje się i przechodzi w pozę bezczynną; po zejściu z drogi lub zakończeniu rozmowy `E` płynnie wraca na trasę bez poślizgu stóp.
- [ ] **Dzieci biegają:** znajdź `ola` i `stas` biegające w kółko po peronie B (mniejszy wzrost, różne miejsca startu) → płynny bieg bez przenikania przez przeszkody i z poprawną kolizją z graczem.
- [ ] **Siedzący siedzą poprawnie (i pozy robocze):**
  - `hub tp -10.2 10.2 129 -22` i `hub look tomasz` → miednica nad stołkiem, obie stopy na podłodze; po podejściu obrót tułowia nie przesuwa miednicy ze stołka.
  - `hub tp 17 13.8 -38 -20` i `hub look bajt` → stołek pod miednicą, nogi mieszczą się pod biurkiem.
  - Sprawdź siedzących w jadłodajni (`jarek`, `ewa`, `bogna`, `feliks`), w Radiu (`lena`) i na pryczy w kwaterach (`teo`), a także klęczącą `zofia` w kwaterach i kucającą `iga` przy rozdzielni w korytarzu → brak lewitowania i przenikania przez siedziska.
- [ ] **Wstawki bezczynności NPC:** obserwuj przez ok. 20–45 s stojących lub siedzących NPC bez trasy, którzy nie rozmawiają (np. przy barze, w kwaterach lub w jadłodajni) → co 18–45 s przez 3–5 s płynnie przechodzą w wariant klipu z puli bazowej (np. `Idle_Loop` → `Idle_Talking_Loop` / `Interact` / `PickUp_Table`; `Sitting_Idle_Loop` ↔ `Sitting_Talking_Loop`), po czym wracają do pozy bazowej; `window.__neoryder.query('npcs')` zwraca aktualny `clip`, a rozpoczęcie rozmowy przerywa wstawkę.

---

## 4. Podsłuchane rozmowy

- [ ] **Podejście do par / grupek NPC:** podejdź w pobliże pary mieszkańców (w promieniu ok. 5 m, np. w jadłodajni przy pierwszym lub drugim stole, przy barze lub na targu) → nad podpowiedzią pojawiają się mniejsze, półprzezroczyste napisy z imieniem mówcy w kolorze jego akcentu; mówca w bezczynności przechodzi w animację rozmowy.
- [ ] **Spojrzenia w rozmowach:** podczas podsłuchanej rozmowy wieloosobowej obserwuj uczestników → słuchacze patrzą na aktualnie mówiącego (także w przerwie między kwestiami), a mówiący patrzy na najbliższego innego uczestnika. Podczas rozmowy z graczem przez dymek (`E` lub `hub talk <id>`) rozmówca zawsze patrzy na gracza i gra animację rozmowy (`Idle_Talking_Loop` / `Sitting_Talking_Loop`), a po zakończeniu wraca do pozy bazowej.
- [ ] **Przerwanie odejściem:** odejdź dalej od rozmawiającej pary → napisy znikają; wróć w ich pobliże → rozmowa zaczyna się od pierwszej kwestii (bez czekania na 45 s odnowienia). Naciśnięcie `E` lub otwarcie stacji również przerywa podsłuchaną rozmowę.
- [ ] **Wymuszenie komendą:** wpisz `hub chatter <id>` (gdzie `<id>` to identyfikator rozmowy z danych, np. `lena_radio_broadcast`) → rozmowa startuje natychmiast niezależnie od dystansu i odnowienia; `window.__neoryder.query('hubChatter')` zwraca aktualną kwestię.

---

## 5. Reakcje na powrót (`hub arrive`)

- [ ] **Pierwsza wizyta (`firstVisit`):** wpisz `hub arrive firstVisit` i odczekaj ok. 2,5 s → najbliższy pozycji startowej NPC z reakcją wypowiada powitanie w napisach rozmów. Sprawdź `window.__neoryder.query('hubArrival')` → zwraca `{ kind: 'firstVisit', key, greetedNpc, reacted, pending }`.
- [ ] **Pierwsza rozmowa = reakcja:** podejdź do witającego NPC z `greetedNpc` (albo wpisz `hub talk <greetedNpc>`) → pierwsza kwestia jest reakcją (inną niż tekst powitania, jeśli lista ma więcej niż jedną kwestię), a drugie `E` / `hub talk` pokazuje już zwykłą kwestię z pętli.
- [ ] **Powrót po zwycięstwie:** wpisz `hub arrive victory`, odczekaj ok. 2,5 s → powitanie w napisach, a pierwsza rozmowa z witającym NPC daje reakcję na zwycięstwo.
- [ ] **Powrót po śmierci:** wpisz `hub arrive death`, odczekaj ok. 2,5 s → powitanie w napisach, a pierwsza rozmowa z witającym NPC daje reakcję na porażkę.
- [ ] **Znaczniki reakcji:** po `hub arrive victory` rozejrzyj się po kryjówce → nad głowami NPC z niewykorzystaną reakcją (lista `pending` w `window.__neoryder.query('hubArrival')`) widać mały, lekko pulsujący pionowy romb w ciepłej bieli (`#fff1d6`, obniżony dla siedzących i niskich póz). W trakcie rozmowy z tym NPC i po wykorzystaniu pierwszej reakcji znacznik znika; bez aktywnego kontekstu przybycia nie ma żadnych znaczników.

---

## 6. Rekwizyty (`hub use` / `E`)

_(Identyfikatory rekwizytów oraz ich stan — `id`, `kind`, `cooldownLeft`, `track`, `angle` — sprawdzisz w konsoli przez `window.__neoryder.query('hubProps')`; możesz też użyć `hub look <propId>` i `hub use <propId>`)._

- [ ] **Szafa grająca (peron B):** `hub tp -6.8 13.9 180 -10`, spójrz na szafę i naciśnij `E` (albo użyj `hub use <id>` z `query('hubProps')`) → kolejne użycia (po 1 s cooldownu) przełączają utwory `0 → 1 → 2 → 0` („Ostatni peron” → „Deszcz na kredyt” → „Świt odwołany”); zmienia się fraza basu i padów w dźwięku otoczenia, a w napisach pojawia się tytuł utworu podawany przez „Szafa grająca”.
- [ ] **Miska u Heli (jadłodajnia):** `hub tp -17 -15.5 0 -16`, spójrz na ladę i naciśnij `E` („Zjedz miskę”) → pojawia się wylosowana kwestia, a przez 2 s nad canvasem zanika ciepłe przyciemnienie krawędzi; w `query('hubProps')` widać cooldown 20 s (`cooldownLeft`).
- [ ] **Radio Leny (Radio Iskry):** `hub tp 5 -18.3 180 -24`, spójrz na radio na biurku i naciśnij `E` → wymusza audycję `lena_radio_broadcast` w napisach; kolejne `E` (lub `hub use <id>`) wyłącza audycję także podczas przerwy między kwestiami i przed końcem 1 s cooldownu.
- [ ] **Worek treningowy (hala):** `hub tp 18.3 0 0 12`, spójrz na worek i naciśnij `E` (lub uderz atakiem w zasięgu) → worek otrzymuje impuls w kierunku spojrzenia, kołysze się jak wahadło X/Z i wyhamowuje tłumieniem, słychać miękki dźwięk `bagHit`, brak zakleszczenia gracza; `query('hubProps')` zwraca aktualny `angle`.

---

## 7. Siadanie (`hub sit` / `hub stand` / `E`)

W kryjówce znajdują się 4 siedziska gracza: `seat_platform_couch` (kanapa na peronie B przy beczce z ogniem), `seat_canteen_bench` (wolne miejsce na ławie w jadłodajni), `seat_bar_stool` (stołek przy barze) oraz `seat_bunk_edge` (krawędź pryczy w kwaterach).

- [ ] **Siadanie przez `E`:** `hub tp -16.1 -11.4` a potem `hub look seat_canteen_bench` → widać podpowiedź „Usiądź”; naciśnięcie `E` płynnie (0,4 s) przenosi kamerę nad siedzisko i obraca ją w jego kierunku, a podpowiedź zmienia się na „E — Wstań”. `window.__neoryder.query('hubSeat')` zwraca `seat_canteen_bench`.
- [ ] **Ograniczenie kamery i ruchu:** po usiądnięciu poruszaj myszą na boki i góra/dół oraz wciskaj `WASD` / skok / dash → obrót poziomy jest ograniczony do ±100° wokół kierunku siedziska (`window.__neoryder.query('playerLook')`), pionowy działa normalnie, a postać nie schodzi z miejsca po samym skoku lub dashu; wciśnięcie `WASD` lub `E` wstaje i cofa kamerę przed siedzisko.
- [ ] **Komendy `hub sit` / `hub stand` i blokady:** wpisz `hub sit seat_bar_stool` → gracz siada na stołku przy barze; wpisz `hub stand` → wstaje (`query('hubSeat')` zwraca `null`). Sprawdź pozostałe siedziska (`seat_platform_couch`, `seat_bunk_edge`). Przy otwartym planie stacji (`M`), otwartej stacji lub dymku rozmowy `hub sit` i `E` są zablokowane; `hub tp` i `reset` od razu zdejmują siedzenie.

---

## 8. Plan stacji (`M` / `hub map`)

- [ ] **Otwieranie i czytelność:** naciśnij klawisz `M` (lub wpisz `hub map`) → otwiera się nakładka „Plan stacji Kamienna” północą w górę z podpisanymi strefami (Hala, Tory, Peron B, Korytarz, Jadłodajnia, Kwatery, Radio Iskry, Targ wymiany, Kącik łączności, Bar i parkiet, Antresola, Wagon-warsztat, Kładka, Trening), kolorowymi znacznikami stacji, kropkami rekwizytów i strzałką gracza w cyanie. `window.__neoryder.query('hubMap')` zwraca `{ open: true }`.
- [ ] **Ruch w tle i blokada interakcji:** z otwartym planem przejdź się po hali i obróć kamerę → symulacja nie zatrzymuje się, kursor pozostaje przechwycony, strzałka gracza porusza się i obraca na bieżąco; naciśnięcie `E` przy stacji lub NPC nic nie robi, a podpowiedź jest ukryta.
- [ ] **Zamykanie i blokady:** zamknij plan klawiszem `M` albo `Esc` (`query('hubMap')` → `{ open: false }`). Otwórz stację (np. `hub open missions`) lub rozpocznij rozmowę z NPC (`hub talk mira`) i naciśnij `M` → plan się nie otwiera.

---

## 9. Zwierzęta (`hub cat` / `hub rat`)

- [ ] **Kot stacji „Węgielek”:** wpisz `hub cat` → 2 m przed graczem pojawia się ciemnografitowy kot z małymi bursztynowymi oczami w stanie odpoczynku (siedzi lub leży, czasem się myje); z bliska (ok. 3 m) słychać mruczenie (`purr`), sporadycznie ciche miau. `window.__neoryder.query('hubFauna')` zwraca stan `cat`.
- [ ] **Reakcja kota na gracza:** znajdź kota idącego po trasie (peron B przy beczce, budka z makaronem, kwatery, bar, kładka) i stań mu na drodze (< 0,8 m) → zatrzymuje się; podbiegnij w jego stronę (< 2 m) → odbiega w bok po bezpiecznej podłodze i wraca na trasę.
- [ ] **Szczury:** wpisz `hub rat` → najbliższym pasem (dno niecki torów lub pod ścianą targu) przebiega szczur (2,5–3,5 m/s z drobnymi zrywami) i znika, czasem z krótkim piskiem; w `window.__neoryder.query('hubFauna')` widać aktywną listę `rats`.

---

## 10. Dźwięk otoczenia i pociąg

_(Upewnij się, że gra została kliknięta po załadowaniu; opcjonalnie sprawdź w konsoli `window.__neoryder.query('hubAmbience')`)._

- [ ] **Ogień:** stań przy beczce na peronie B (`hub tp -11.2 10 123 -12`) → słychać szum ognia i trzaski.
- [ ] **Generator:** podejdź do generatora w hali lub w wagonie-warsztacie (`hub tp -9.5 4.4 180 -18`) → słychać niski warkot.
- [ ] **Kapanie i para:** podejdź do niecki torów lub kratki w korytarzu (`hub tp 4.5 -9.75 90 -8`) → słychać pojedyncze krople i syk pary.
- [ ] **Gwar:** przejdź przez środek hali → słychać stłumiony gwar otoczenia.
- [ ] **Radio:** podejdź do biurka Bajta (`hub tp 17 13.8 -38 -20`) lub Radia Iskry → słychać szum i przerywane tony radia.
- [ ] **Szafa grająca:** podejdź do baru na peronie B (`hub tp -6.5 11 180 -10`) → słychać frazę basu i minorowych padów.
- [ ] **Kuchnia:** podejdź do budki z makaronem w jadłodajni (`hub tp -14 -12.5 0 -12`) → słychać parę i skwierczenie.
- [ ] **Przestrzeń i pauza:** obróć kamerę wokół wybranego źródła → słychać panoramę lewo/prawo i tłumienie wraz z oddalaniem; po naciśnięciu `Esc` dźwięki otoczenia milkną, po wznowieniu wracają.
- [ ] **Przejazd pociągu:** wpisz `hub train` → słychać narastający i opadający niski pomruk przelatujący z zachodu na wschód; po ok. 3,5 s pojawia się delikatny wstrząs kamery i ciepłoszary pył opadający z kilku skupisk pod sufitem w pobliżu gracza.

---

## 11. Migotanie świateł, napisów i spadek napięcia (`hub dip`)

- [ ] **Migotanie domyślne:** rozejrzyj się po hali, peronie B, korytarzu (`hub tp 4.5 -9.75 90 -8`), Radiu (`hub tp 4.5 -12.5 0 -12`), targu (`hub tp -22 13 90 -10`) i kwaterach (`hub tp -4.5 -12 0 -15`) → światła, lampy korytarza (`fail` 17/21 s), lampa przy wschodnim generatorze i neon `metro` (słabe `buzz`), napisy `neonTexts` („NA ANTENIE” — `pulse`, „TARG” — `buzz`, „KWATERY” — rzadka awaria `fail` co 25 s), napisy stacji oraz płomień w beczce wykazują zamierzone migotanie.
- [ ] **Spadek napięcia (`hub dip`):** wpisz `hub dip` w hali lub przy barze → 3 szybkie mrugnięcia, przygaśnięcie na ok. 1 s (gasną światła punktowe, lampy, napisy, neony i ekrany; ogień w beczkach nie gaśnie; generator, ekrany, szafa grająca i radio cichną proporcjonalnie) i powrót z jednym mrugnięciem (łącznie 2,5 s). Po powrocie prądu najbliższy mieszkaniec w promieniu 14 m wypowiada kwestię w napisach rozmów (`conversation: 'power_dip'`). `window.__neoryder.query('hubPower')` zwraca `{ level, active, nextInS }`.
- [ ] **Ustawienie „Błyski ekranu”:** naciśnij `Esc` → **Ustawienia** → zakładka **Obraz** → wyłącz **Błyski ekranu** → **Wróć** → **Wznów** → wzory `buzz` i `fail` przestają migotać, zostaje jedynie łagodny `pulse`. Wpisz ponownie `hub dip` → zamiast mrugnięć występuje łagodny spadek i powrót jasności bez skoków.
- [ ] **Przywrócenie ustawienia:** włącz ponownie **Błyski ekranu** → pełne migotanie i mrugnięcia przy spadku napięcia wracają.

---

## 12. Wydajność (licznik FPS w trybie debug)

Odczytaj i zapisz wartości FPS z panelu stats.js w lewym górnym rogu (cel: 60 FPS).

| Strefa / sytuacja                                            | Zmierzone FPS | Uwagi (np. spadki przy obrocie) |
| ------------------------------------------------------------ | ------------- | ------------------------------- |
| Hala (punkt startowy)                                        |               |                                 |
| Peron B (bar i ogień w beczce)                               |               |                                 |
| Kącik łączności                                              |               |                                 |
| Targ wymiany                                                 |               |                                 |
| Skrzydło północne (korytarz / jadłodajnia / kwatery / Radio) |               |                                 |
| Przejazd pociągu (`hub train`)                               |               |                                 |

---

## 13. Uwagi do „feel”

Odpowiedz krótko na poniższe pytania po ukończeniu spaceru:

1. **Czy kryjówka sprawia wrażenie zamieszkanej i żywej?** (ruch NPC, wstawki bezczynności, rozmowy, zwierzęta, dźwięki, detale w skrzydłach)

   > _Miejsce na odpowiedź:_

2. **Czy spadek napięcia jest wyczuwalny i nie męczy?**

   > _Miejsce na odpowiedź:_

3. **Czy siadanie jest wygodne (płynność kamery)?**

   > _Miejsce na odpowiedź:_

4. **Czy znaczniki reakcji są czytelne i nie za małe?**

   > _Miejsce na odpowiedź:_

5. **Czy plan stacji jest czytelny?**

   > _Miejsce na odpowiedź:_

6. **Czy coś w kryjówce męczy lub przeszkadza?** (np. migotanie, głośność lub miks dźwięków, ciasne przejścia, czytelność napisów / podpowiedzi)

   > _Miejsce na odpowiedź:_

7. **Czego brakuje albo co warto poprawić w pierwszej kolejności?**
   > _Miejsce na odpowiedź:_

### Lista znalezionych błędów / uwag

-
-
-
