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

## 3. Mieszkańcy (21 NPC)

W kryjówce przebywa 5 kluczowych postaci (`mira`, `wolan`, `szron`, `bajt`, `tomasz`) oraz 16 mieszkańców (`hela`, `jarek`, `ewa`, `lena`, `zofia`, `teo`, `iga`, `marek`, `grzes`, `rudy`, `nina`, `witek`, `kuba`, `pawel`, `ola`, `stas`).

- [ ] **Rozmowa `E` z kilkoma NPC:** podejdź i spójrz na postać (np. `mira`, `hela`, `rudy`, `nina`, `witek`) → widać podpowiedź „[E] Porozmawiaj” z imieniem; `E` otwiera dymek z imieniem, rolą i kwestią; kolejne `E` przełącza kwestie w pętli; dymek znika po ok. 5 s lub po odejściu. Sprawdź też komendę `hub talk mira` (dymek pojawia się bez patrzenia na NPC).
- [ ] **Różny wygląd:** sprawdź w różnych strefach (np. jadłodajnia, targ, kwatery, bar) — mieszkańcy różnią się odcieniem stroju, nakryciami głowy (czapki, gogle, okulary, słuchawki, bandana, kaptur), ubiorem (kamizelka, fartuch, płaszcz, kurtka) i rekwizytami (torby, plecaki, pas narzędziowy).
- [ ] **Chodzący ustępują:** znajdź `kuba` (trasa targ → peron B → kładka → hala → korytarz → jadłodajnia) lub `pawel` (pętla hali). Stań mu na drodze przed nim → zatrzymuje się i przechodzi w pozę bezczynną; po zejściu z drogi lub zakończeniu rozmowy `E` płynnie wraca na trasę bez poślizgu stóp.
- [ ] **Dzieci biegają:** znajdź `ola` i `stas` biegające w kółko po peronie B (mniejszy wzrost, różne miejsca startu) → płynny bieg bez przenikania przez przeszkody i z poprawną kolizją z graczem.
- [ ] **Siedzący siedzą poprawnie (i pozy robocze):**
  - `hub tp -10.2 10.2 129 -22` i `hub look tomasz` → miednica nad stołkiem, obie stopy na podłodze; po podejściu obrót tułowia nie przesuwa miednicy ze stołka.
  - `hub tp 17 13.8 -38 -20` i `hub look bajt` → stołek pod miednicą, nogi mieszczą się pod biurkiem.
  - Sprawdź siedzących w jadłodajni (`jarek`, `ewa`), w Radiu (`lena`) i na pryczy w kwaterach (`teo`), a także klęczącą `zofia` w kwaterach i kucającą `iga` przy rozdzielni w korytarzu → brak lewitowania i przenikania przez siedziska.

---

## 4. Podsłuchane rozmowy

- [ ] **Podejście do par / grupek NPC:** podejdź w pobliże pary mieszkańców (w promieniu ok. 5 m, np. w jadłodajni, przy barze lub na targu) → nad podpowiedzią pojawiają się mniejsze, półprzezroczyste napisy z imieniem mówcy w kolorze jego akcentu; mówca w bezczynności przechodzi w animację rozmowy.
- [ ] **Przerwanie odejściem:** odejdź dalej od rozmawiającej pary → napisy znikają; wróć w ich pobliże → rozmowa zaczyna się od pierwszej kwestii (bez czekania na 45 s odnowienia). Naciśnięcie `E` lub otwarcie stacji również przerywa podsłuchaną rozmowę.
- [ ] **Wymuszenie komendą:** wpisz `hub chatter <id>` (gdzie `<id>` to identyfikator rozmowy z danych) → rozmowa startuje natychmiast niezależnie od dystansu i odnowienia; `window.__neoryder.query('hubChatter')` zwraca aktualną kwestię.

---

## 5. Reakcje na powrót (`hub arrive`)

- [ ] **Pierwsza wizyta (`firstVisit`):** wpisz `hub arrive firstVisit` i odczekaj ok. 2,5 s → najbliższy pozycji startowej NPC z reakcją wypowiada powitanie w napisach rozmów. Sprawdź `window.__neoryder.query('hubArrival')` → zwraca `{ kind: 'firstVisit', key, greetedNpc, reacted }`.
- [ ] **Pierwsza rozmowa = reakcja:** podejdź do witającego NPC z `greetedNpc` (albo wpisz `hub talk <greetedNpc>`) → pierwsza kwestia jest reakcją (inną niż tekst powitania, jeśli lista ma więcej niż jedną kwestię), a drugie `E` / `hub talk` pokazuje już zwykłą kwestię z pętli.
- [ ] **Powrót po zwycięstwie:** wpisz `hub arrive victory`, odczekaj ok. 2,5 s → powitanie w napisach, a pierwsza rozmowa z witającym NPC daje reakcję na zwycięstwo.
- [ ] **Powrót po śmierci:** wpisz `hub arrive death`, odczekaj ok. 2,5 s → powitanie w napisach, a pierwsza rozmowa z witającym NPC daje reakcję na porażkę.

---

## 6. Dźwięk otoczenia i pociąg

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

## 7. Migotanie świateł i neonów

- [ ] **Migotanie domyślne:** rozejrzyj się po hali, peronie B i korytarzu → światła, neony (`signs` / `neonTexts`), napisy stacji i płomień w beczce wykazują zamierzone migotanie (`buzz`, `fail`, `pulse`).
- [ ] **Ustawienie „Błyski ekranu”:** naciśnij `Esc` → **Ustawienia** → zakładka **Obraz** → wyłącz **Błyski ekranu** → **Wróć** → **Wznów** → wzory `buzz` i `fail` przestają migotać, zostaje jedynie łagodny `pulse`.
- [ ] **Przywrócenie ustawienia:** włącz ponownie **Błyski ekranu** → pełne migotanie wraca.

---

## 8. Wydajność (licznik FPS w trybie debug)

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

## 9. Uwagi do „feel”

Odpowiedz krótko na poniższe pytania po ukończeniu spaceru:

1. **Czy kryjówka sprawia wrażenie zamieszkanej i żywej?** (ruch NPC, rozmowy, dźwięki, detale w skrzydłach)

   > _Miejsce na odpowiedź:_

2. **Czy coś w kryjówce męczy lub przeszkadza?** (np. migotanie, głośność lub miks dźwięków, ciasne przejścia, czytelność napisów / podpowiedzi)

   > _Miejsce na odpowiedź:_

3. **Czego brakuje albo co warto poprawić w pierwszej kolejności?**
   > _Miejsce na odpowiedź:_

### Lista znalezionych błędów / uwag

-
-
-
