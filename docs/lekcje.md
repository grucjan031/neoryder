# Lekcje z historii NEORYDER

Dokument zbiera błędy, regresje, decyzje „feel” i pułapki z ok. 550 commitów (14–20 XI 2026), `docs/issues/**`, `docs/adr/*.md`, `docs/playtest*.md`, `docs/backlog.md` i `docs/systems/*.md`. Każda lekcja to zasada na przyszłość (także przy przenoszeniu modułów do Rusta/WASM) i ma dowód w postaci hasha commita; szczegóły: `git show <hash>`.

Uwaga o źródłach: `docs/playtest-F1.md`, `-F3.md` i `-F4.md` to nadal puste szablony (tabele wyników niewypełnione), a bramki F2 i F4 mają status „czeka na playtest”. Prawdziwy playtest zapisany w historii to 18 XI (`2e3698f`, `457b5ad`). Większość wartości „feel” poniżej to więc wartości początkowe architekta, które przetrwały bez zmian, a nie wyniki strojenia po graniu; tabela końcowa to rozróżnia.

## Walka i feel

**L01. Zdarzenie emitowane synchronicznie w trakcie kroku potrafi zniszczyć obiekt, który właśnie jest krokowany.** Sparowanie ciosu w `strike()` Szturmowca przełączało go w `stunned` i zerowało hitbox, a ten sam krok wołał potem `hitbox.step` na `undefined` (TypeError, gra się wywracała). Pierwsza wersja parowania przeszła testy, bo atakujący w testach nie był w trakcie prawdziwego ciosu. Zasada: zdarzenia w trakcie kroku kolejkuj i dostarczaj po zakończeniu kroku encji (lub po całej pętli), albo każdy handler ma zakładać, że stan nadawcy mógł się zmienić. Dodaj test z prawdziwym ciosem w toku.
Dowód: `694b4d2` (test regresyjny „bez poprawki: TypeError”), `0e7792e`.

**L02. Bez danych o atakującym odmawiaj parowania, nie przyznawaj go.** Gdy `positionOf` zwracało `null`, cios zza pleców był parowany. Warunek geometryczny (łuk z przodu) musi być fail-closed.
Dowód: `694b4d2`.

**L03. Obrona/osłona dopisana do systemu obrażeń musi się odpinać przy zniszczeniu właściciela.** `DamageSystem.addGuard` początkowo nie zwracał funkcji zdejmującej, więc podmiana ostrza zostawiała stare guardy; pierwszy test „dispose” nawet nie wykrywał wycieku. Każda rejestracja (guard, nasłuch, modyfikator) zwraca uchwyt do wyrejestrowania, a test sprawdza faktyczny stan po `dispose`.
Dowód: `cc49596`, `694b4d2`.

**L04. Zdarzenie „sukces parowania” musi nieść właściciela (kto parował), a nagrody liczyć dokładnie raz.** Energia, synergie i osiągnięcia liczyły każde parowanie na magistrali zdarzeń (także cudze), a parowanie wręcz było najpierw liczone dwa razy (osobno energia z `melee_parried` i z `parry_success`). Jedno zdarzenie domenowe niesie `defender`, a konsumenci filtrują po właścicielu; efekty uboczne podpinaj pod jedno zdarzenie, nie pod dwa równoległe.
Dowód: `9990f06`, `c2cc569`.

**L05. Kierunek patrzenia i wektory efektów w osi oczu dają NaN.** Iskra parowania pozycjonowana „w stronę atakującego” zdegenerowała się, gdy atakujący stał dokładnie w osi kamery. Każda normalizacja wektora w efektach ma awaryjny kierunek (patrzenia), a test ma przypadek zerowej długości.
Dowód: `9990f06`; analogicznie shader reliefu z NaN w pochodnych dawał czarny pas przed kamerą: `d1b5c24`.

**L06. Szybkość ataku (mnożnik prędkości animacji/faz) zamrażaj na początku ciosu.** Gdy modyfikator szybkości zmienił się w trakcie ciosu, faza animacji i okno hitboxa rozjechały się. Hitbox i faza muszą czytać z jednego zegara i jednej wartości zamrożonej na fazę.speed_scale`czytany niezależnie.
Dowód:`85869aa`, `835965a`.

**L07. Nietykalność przez „czas nietykalności po trafieniu” jest czytana PO zadaniu obrażeń.** Zwracanie ogromnej wartości invuln w trakcie dashu zadawało obrażenia i dawało „~11 dni” nietykalności. Nietykalność to predykat sprawdzany PRZED zadaniem obrażeń (`invulnerable()`), osobno od okna ochronnego po trafieniu (`playerInvulnMs`).
Dowód: `60f79d1`.

**L08. Pociski trafiają wyłącznie hurtboxy (i geometrię świata), nie kapsułę ruchu.** Kapsuła ruchu wroga obejmowała sensor głowy i połykała strzały w głowę (0 obrażeń). Rozdziel warstwy: ciało ruchu, hurtbox obrażeń, sensor.
Dowód: `8a8f20d`, ADR 0003 pkt 7 (`docs/adr/0003-kontrakty-f1.md`).

**L09. Wciśnięcia klawiszy muszą przeżyć hitstop i być bufowane.** Hitstop wywołuje krok z `dt = 0`, więc wejście i UI nadal działają, ale rozstrzygnięcie akcji (np. Pchnięcie wciśnięte w hitstopie) czeka na pierwszy krok z `dt > 0`. Bez tego akcje „znikały” albo odpalały się podwójnie. Bufory: skok 120 ms, atak 120 ms, spust półautomatu 150 ms; coyote 100 ms.
Dowód: `8a8f20d`, `de2405e`, `802c791`, `1b5d5dc`; `docs/systems/movement.md` (krok 2).

**L10. Czas gry ma jednego właściciela.** Hitstop, slow-mo i Skupienie (czas gracza vs świata) obsługuje jeden `FeelSystem`; reszta tylko emituje zdarzenia (`hitstop`, `slowmo`, `focus`). Slow-mo liczy się w czasie rzeczywistym z płynnym powrotem (0,15 s), a nie w czasie gry, bo inaczej samo się wydłuża.
Dowód: `477a602`, ADR 0003 pkt 5; `docs/systems/core.md` (FeelSystem).

**L11. Efekty prezentacyjne starzeją się zegarem gracza/klatki, nie zegarem świata ani czasem ściennym.** Cięcie wykończenia było niewidoczne w slow-mo, bo efekt FPP liczył czas świata; efekty mocy używały `performance.now()` i rozjeżdżały się z pauzą i hitstopem.
Dowód: `2e3698f`, `aca02c0`; start efektu ze zdarzenia, nie ze „skoku odnowienia”: `70418f1`.

**L12. Śmierć obiektu neutralnego nie jest zabójstwem.** Beczki i inne neutralne encje emitowały `enemy_killed`, co dawało energię, kredyty i wyzwalało synergie. Rozdziel zdarzenie fizyczne (`damage_dealt.killed`) od domenowego (`enemy_killed`) i filtruj po drużynie.
Dowód: `c998a6a`.

**L13. Statystyka zdefiniowana w danych bez konsumenta jest cichym błędem.** Bonusy `damage` i `attackSpeed` z implantów, talentów i synergii czytali tylko wrogowie; gracz je ignorował, więc 23 pliki danych nie miały żadnego efektu, a nikt tego nie zauważył. Test powinien przejść po wszystkich danych i sprawdzić, że każda deklarowana statystyka ma czytelnika w kodzie gracza.
Dowód: `8a1de69`; łańcuch synergii z podwójnym mnożnikiem: `ffc43a7` (tag `#derived`).

**L14. Efekty wyzwalane efektami (synergie, implanty) potrzebują tagu pochodzenia.** Obrażenia z łańcucha miały wyzwalać kolejne synergie i podwajać mnożniki; rozwiązanie to tag `#derived`/`#synergy` blokujący rekurencję, a status obszarowy liczony tylko po faktycznym nałożeniu (nie na martwym celu).
Dowód: `ffc43a7`; `docs/systems/synergies.md`.

**L15. Nowa mechanika zmieniająca znaczenie klawisza wymaga reguły „co jest w ręku”.** PPM = blok z ostrzem, celowanie (ADS) z bronią palną; „jedna rzecz w ręku” z wymianą 0,24 s, a PPM i rzut ostrzem natychmiast wracają do ostrza, żeby parowanie nie miało opóźnienia. Ponowne naciśnięcie numeru aktywnej broni wraca do ostrza (po playteście). Zaprojektuj mapę wejść jako stan (`held_item`), nie zbiór niezależnych klawiszy.
Dowód: `efaa25a`, `9d0391b`, `2e3698f`.

**L16. Czytelność ataku na słuch i wzrok jest częścią feelu, nie dodatkiem.** Cios nie do zablokowania świeci bursztynem i ma wskaźnik zagrożeń spoza kadru; parowanie to metaliczne „dzyń”, ostrzeżenie o cieple ma histerezę, a rozróżnialność dźwięków mierzono offline (metryki WAV).
Dowód: `1047638`, `1dfd115`.

**L17. Kontr-zagrożenia i oprawa bossa podlegają regule kolorów zarezerwowanych.** Fale bossa „różowiały” na fioletowej podłodze i zlewały się z magentą Rezonansu; naprawiano to kolejnymi commitami (barwa wroga, cień mnożący, pomarańczowa krawędź). Paletę zarezerwowaną (wróg, gracz, moc) wpisz w pipeline materiałów od razu i testuj kontrast na każdej podłodze.
Dowód: `3b52d6c`, `e0b87d4`, `4c5c087`, `962aeb0`; ADR 0006.

**L18. Cisza po zwycięstwie nad bossem: usuń zagrożenia, ale nie zmieniaj wyniku.** Pozostali wrogowie rozpadają się „od świata” (bez sprawcy), pociski i statusy są czyszczone, gracz nietykalny; podsumowanie ma być identyczne jak bez tej sekwencji (test porównawczy).
Dowód: `7cfbd8f`, `9ff76e4`.

## AI wrogów

**L19. Tokeny ataku i sloty flankowania w jednym dyrektorze, a nie logika w każdym wrogu.** Szturmowcy proszą o token wręcz, strzelcy o token strzału; kolejka FIFO, token wraca przy śmierci/ogłuszeniu/ucieczce gracza, a bezpiecznik `maxHoldS` odbiera token trzymany za długo. Bez zwalniania tokenu, gdy gracz ucieknie poza zasięg, wróg blokował slot na zawsze.
Dowód: `67fa65c`, `0839da6`; `docs/systems/enemies.md` (sekcja Tokeny).

**L20. Telegraf ataku ustala kierunek przy zapowiedzi i go nie śledzi.** Szturmowiec: zapowiedź 0,4 s, wymach 0,12 s, regeneracja 0,6 s, cios zadaje hitbox raz na wymach; Strzelec: celowanie 0,5 s i wolne pociski (11 m/s) „czytelne”. Śledzenie celu w telegrafie zabija możliwość uniku i parowania.
Dowód: `3886d4b`, `51e64ac`; `src/data/enemies/assaulter.json`, `gunner.json`.

**L21. Ruch AI przy ścianach: ślizg po osiach, nie zamarzanie.** Dron krążył wokół celu leżącego za ścianą i stawał; po upuszczeniu przy ścianie zostawał 0,53 m od niej zamiast 2,6 m. Krążenie liczone jako składowa styczna + korekta promienia, przy kolizji ślizg po osiach, test z celem za ścianą i z upuszczeniem przy ścianie. Snajper po zamrożeniu celu nie przerywa strzału przy utracie widoczności.
Dowód: `139018e`, `docs/issues/F2/grabReview.md` (pkt 1).

**L22. Wróg przejęty mocą (Chwyt) potrzebuje stanu `controlled` odpornego na wszystko.** Review znalazło 12 z 13 potwierdzonych błędów: trzy archetypy przechodziły w ogłuszenie w trakcie przejęcia, przejęty Egzekutor parował, drugi chwytak mógł przejąć już trzymanego wroga, szybka skrzynia pomijała sensor Drona, pierwszy kontakt ze światem odbierał trafienie wrogowi. Przy każdym „mechanicznym” stanie zewnętrznym (przejęty, ogłuszony, przewrócony) spisz macierz: co go przerywa, kto go może przejąć, jakie stany wychodzą.
Dowód: `docs/issues/F2/grabReview.md`, `9d1c2a1`.

**L23. Losowość AI wiązać z numerem spawnu, nie z rosnącym ID encji.** ID encji zależy od liczby wcześniej utworzonych obiektów (efekty, pociski), więc ten sam seed dawał różne przebiegi po retry. Każdy wróg dostaje własny fork `Rng` od etykiety `spawn:<n>`; dyrektor od `coordination`.
Dowód: `8a8f20d`; `docs/systems/difficulty.md`.

**L24. Autostep i przyciąganie do podłoża muszą się zgadzać z nawigacją.** Nawigacja uznaje schody do 0,35 m za chodzone, więc kapsuła wroga dostała autostep 0,35 m; ale „snap do podłoża” gubił trasę przy barierze wykopu, więc został wyłączony (`snapToGroundDistance: 0`). Włączony globalnie autostep po scaleniu z gałęzią zmienił krążenie szturmowców w tłumie (3,50 m zamiast 4 m), więc na starych pokojach autostep jest opcjonalny (`stepClimbing`). Zasada: parametry ruchu AI i generatora nawigacji definiuj w jednym miejscu i testuj razem.
Dowód: `d4465f2`, `8fda856`, `0320488`.

**L25. Poziom trudności to mnożniki w danych + zamrożenie w stanie runu.** Mnożniki HP, obrażeń, liczby, tokenów, celności i szans taktyk; czasy zapowiedzi mają twardy dolny próg (≥ 0,7 bazowej, żeby Koszmar nie był niegrywalny), a trudność jest zapisana w runie, więc zmiana ustawień w trakcie niczego nie zmienia. Nowy gracz startuje na Trudnym (decyzja właściciela).
Dowód: `0dbe557`; `docs/systems/difficulty.md`.

**L26. Taktyki AI (osłona, flankowanie) kosztują raycasty; cache'uj i ograniczaj częstotliwość.** Widoczność z osłony co 0,25 s, szukanie osłony najwyżej raz na 1,5 s, 16 próbek kierunków w promieniu 3 i 6 m, ponowna próba flanku po 1,5 s; raycasty taktyczne widzą tylko geometrię świata.
Dowód: `0dbe557`; `docs/systems/difficulty.md` (Zachowania AI).

**L27. Posiłki w trybach dużych aren pojawiają się w pierścieniu od gracza, nie losowo na całej mapie.** Pula ≥ 16 punktów, wybór w zakresie min–max odległości, preferencja punktów bliskich spornej strefie i zasłoniętych przed wzrokiem gracza; wróg „z drugiego końca mapy” psuł tempo walki.
Dowód: `97db0d1`; ADR 0011 D4.

**L28. Wróg musi być czytelny z daleka, a nie tylko z bliska.** Z 20 m linie kontur wewnątrz bryły zakrywały cienkie kończyny (zostawało ok. 20% czerwonych pikseli postaci). Rozwiązanie: kontur wewnętrzny zanika z odległością (6 → 16 m), poświata krawędzi rośnie z odległością i jest kompensowana mgłą, kombinezon jaśniejszy; pomiar „% czerwonych pikseli” zrobiono automatem.
Dowód: `a430688`, `40485bc`, `5fde27d`.

## Fizyka i ruch

**L29. Kolejność kroku kontrolera gracza jest częścią kontraktu feelu; spisz ją.** 15 kroków: obrót zawsze (także przy `dt=0`), zapamiętanie wciśnięć, stamina, coyote, dash, skok z bufora, slide, ruch, grawitacja całkowana ręcznie, kontroler kinematyczny, stan `grounded`, lądowanie. Przy portowaniu na `CharacterBody3D` zachowaj tę kolejność i ręczną grawitację (−20 m/s², nie domyślne −9,8).
Dowód: `docs/systems/movement.md`; `b436fff`, `de2405e`.

**L30. Dash ma odnowienie bez bufora, a ślizg zachowuje pęd skoku.** Wciśnięcie dashu w odnowieniu przepada (brak bufora, decyzja projektowa); `dashInvulnerable` domyślnie 0 po błędzie L07. Slide wymaga prędkości ≥ 9 m/s, boost 2,5, max 1,1 s.
Dowód: `2640fc6`, `60f79d1`.

**L31. Świat Rapier = jeden na scenę; sprzątaj także na ścieżce błędu.** Każdy pokój runu to nowy świat i nowa instancja sceny; przerwany `init()` zostawiał słuchaczy zdarzeń i świat fizyki. Po poprawce zmierzono 6 cykli hub → run → hub: geometrie, tekstury, programy, ciała, collidery i słuchacze były stałe.
Dowód: `1cb7a8d`; ADR 0005 pkt 4.

**L32. Pociski liczone sweepem w każdym kroku, trafienia wręcz zapytaniem kształtem.** Bez osobnej fizyki hitboxów: hitboxy to collidery w grupach, ruch pocisku to cast promieniem/kapsułą. Chwyt wymaga osobnego `worldDt` (Skupienie spowalnia świat, nie gracza) – bez tego sweep dostawał 1/60 s zamiast 0,3/60 s.
Dowód: ADR 0003 pkt 7; `docs/issues/F2/grabReview.md` (pkt 5).

**L33. Trzymany obiekt: zatwierdzaj punkt trzymania przed rzutem i obsłuż ciasne miejsca.** Poziomy rzut przy podłodze ranił rzucanego; szybki chwyt+puszczenie startował z poprzedniej pozycji (błąd 5 m); cienka ściana między okiem a celem zostawiała cel po drugiej stronie. Cast od oka, odstęp od kapsuły gracza, a przy braku miejsca bezpieczne upuszczenie.
Dowód: `docs/issues/F2/grabReview.md` (pkt 3, 6, 9).

**L34. Ręce/broń w widoku FPP nie mogą wchodzić w geometrię świata.** Rozwiązanie: osobna warstwa viewmodelu rysowana drugim przebiegiem ze ściśniętą głębią (projekcja zajmuje pierwsze ułamki bufora), obrys i bloom zachowane.
Dowód: `56b4f00`; `docs/systems/render.md` („Viewmodel zawsze na wierzchu”).

**L35. Przewrócenie wroga przy mocnym odrzucie to prezentacja (kip-up) liczona z danych odrzutu, nie osobna fizyka.** Trafienie z `knockback ≥ 6` zapisuje kierunek przewrócenia w snapshocie; widok animuje upadek 0,22 s, leżenie i kip-up 0,32 s; czas ogłuszenia i obrażenia bez zmian. Logika i prezentacja rozdzielone, więc działa w testach bez grafiki.
Dowód: `7b32181`.

## Render i styl

**L36. Kontur/tusz liczony w przestrzeni ekranu musi skalować się z rozdzielczością i odległością.** Stała grubość w pikselach dawała „czarne sylwetki” dalekich postaci i grubą aureolę przy małych oknach. Docelowy wzór: promień = szerokość × clamp(4 m / głębia, 0,25, mnożnik blisko), poniżej 0,5 px linia 1 px wygasająca 45–80 m; detale z normalnych 55% promienia i wygasają 8–24 m. Wzór wygaszania zapisano jako czystą funkcję z testem (nie tylko w GLSL).
Dowód: `1d48144`, `a430688`, `e74ba94`; `docs/systems/render.md`.

**L37. Ochrona konturu tylko tam, gdzie ma sens.** Pogrubiony tusz na jasnym, nienasyconym tle (białe ściany, jasne niebo) robił bladoszarą aureolę; tusz chroniono wyłącznie na neonach (jasne i nasycone). Neony i ostrze rysowane bez tuszu.
Dowód: `8070ac8`, `beab7e3`.

**L38. Bloom selektywny z maską emisji musi uwzględniać głębię, inaczej poświaty prześwitują przez ściany.** Maska rysuje tylko materiały emisyjne (połowa kosztu), a zasłanianie bierze z tekstury głębi koloru; porównanie 4 próbek w ćwiartkach teksela, tolerancja = 2 kroki kwantyzacji głębi, niezależnie od odległości. Przezroczyste materiały nie trafiają do maski ani odbić.
Dowód: `2d6e577`, `5f833b5`, `369cce1`, `8017c51`.

**L39. Chroń shadery przed NaN w pochodnych ekranowych.** Relief powierzchni liczony z `dFdx/dFdy` dawał NaN → czarny pas ~6 m przed kamerą wzdłuż ulic. Straż: przy zerowych/NaN pochodnych zwróć niezaburzoną normalną; test jednostkowy.
Dowód: `d1b5c24`, `8017c51` (osłony NaN).

**L40. Zasięg widzenia i horyzont liczone z obwiedni sceny, nie ze stałych.** Przy mapach 100 m stałe far=220 m i pierścienie panoramy 66–162 m wystarczały; areny 240–450 m miały urwany horyzont, a panorama wchodziła w teren gry. Far, mgła, panorama, kopuła nieba i grunt zewnętrzny liczone z obwiedni, mgła zasłania geometrię, zanim utnie ją płaszczyzna odcięcia; scena testowa 600×600 m.
Dowód: `97db0d1`; ADR 0011 D3.

**L41. Paleta jako kontrakt: kolory zarezerwowane (wróg, gracz, moc) zakazane w otoczeniu.** Neon Noir: czerwień, cyan, magenta tylko dla ról; otoczenie bursztyn, zieleń, fiolet, błękit, ciepła biel. Testy kontrastu per motyw zapobiegły zlewaniu się bossa z podłogą (L17). Zdecyduj to na przyszłość w jednym pliku palety i zrób z tego lint.
Dowód: ADR 0006 (`bc74935`), `3b52d6c`.

**L42. Efekty kosmetyczne pod ustawienia dostępności od pierwszego dnia.** „Błyski ekranu” wyłączają impuls obrażeń, winietę, błysk burzy i migotanie; mnożnik wstrząsów w ustawieniach; osobny tryb `fx=lite` dla testów. Dodawane po fakcie wymagały przechodzenia przez każdy nowy efekt (rozpad, wybuchy, fale Rezonansu, poświata).
Dowód: `8223080`, `3b0c63f`, `5043f5c`.

**L43. Profile jakości (niska/średnia/wysoka) definiuj od początku i stosuj na żywo.** Parametry: rozdzielczość renderu, obrys, bloom, odbicia, liczba świateł, gęstość deszczu i cząstek, mgła; nowe instalacje na średniej. Koszt klatki zależał niemal wyłącznie od liczby pikseli (550 ms przy pixel ratio 1 vs 50–100 ms przy 0,25 na programowym renderze).
Dowód: `4850a4d`, `9d0c2ae`.

**L44. Światła dynamiczne mają budżet i histerezę przydziału.** ADR: do 8 aktywnych świateł punktowych; przydział z ważnością i premią histerezy (żeby światła nie migotały przy przełączaniu), pozostałe oświetlenie jako poświata/plama w shaderze.
Dowód: ADR 0006 pkt 7; `f25ea70`.

**L45. Zrzuty wzorcowe e2e trzeba aktualizować świadomie przy każdej zmianie stylu.** Cieńszy tusz zmienił zrzut `style-test` (jedyny błąd z 95), a commit z `[skip ci]` ukrył to do ręcznego uruchomienia. Wzorce wizualne porównuj z tolerancją i regeneruj w jednym, nazwanym kroku.
Dowód: `fbe9fd9`, `1d48144`.

## UI i wejście

**L46. Pointer lock: pierwsze zdarzenie ruchu po przechwyceniu myszy może mieć ogromny skok.** Chromium/Linux przenosił kursor na środek, a kamera „skakała”; filtr: ignoruj pierwsze zdarzenie po locku i skoki > 400 px.
Dowód: `3886d4b`, `369cce1`.

**L47. Blokada wejścia gry zależy od fokusu UI i modali, nie od „brak przechwyconej myszy”.** Warunek „mysz nie jest przechwycona” blokował klawisze w kryjówce i w testach (6 testów e2e padło). Stan wejścia = tryb sceny (rozgrywka / UI / modal), a nie stan kursora.
Dowód: `7ce60b7`; `docs/systems/core.md`.

**L48. Pauza i utrata fokusu to jedno miejsce w kodzie.** Pauza przy `blur`, ukryciu karty i utracie pointer lock zeruje wejście i zatrzymuje zegar; wznowienie wymaga świadomego kliknięcia. Wcześniej wznowienie przed następną klatką mogło nadrobić cały czas ukrycia (patrz L58).
Dowód: `17e4253`; AGENTS.md pkt 8.

**L49. Przypisania klawiszy: konflikty i zarezerwowane klawisze od pierwszej wersji.** Model ustawień z konfliktami, zarezerwowanymi Esc i `` ` ``, odwrócona oś Y, głośności, wstrząsy; migracja ustawień obcina wartości do zakresów. Klawiatura nie steruje grą poza rozgrywką.
Dowód: `1e417f6`, `8223080`.

**L50. Interakcja „spojrzenie + E” zamiast otwierania stacji po wejściu w strefę.** Auto-otwieranie nakładek po wejściu w strefę irytowało i wymagało histerezy wyjścia; zastąpiono podpowiedzią `[E]` po spojrzeniu (stożek 30° w `12b4d3c`, dziś zasięg 3,5 m; promień celuje w bryłę stacji). Dla elementów, które mają „potwierdzić wybór”, dodano opóźnienie 1 s przed wyborem implantu (anty-misclick).
Dowód: `3fb7766`, `12b4d3c`, `5a142ff`.

**L51. UI skalowane (zoom) musi liczyć maksymalne wysokości z uwzględnieniem skali.** Panele były ucinane góra/dół, bo `max-height` nie dzielono przez `--ui-zoom`; poprawka: `100dvh`, przewijanie wewnątrz panelu.
Dowód: `457b5ad`.

**L52. Fokus klawiatury/pada musi być zawsze widoczny.** Fokus rysowany `clip-path` był przycinany; poprawka: rysowanie obramowania wewnątrz elementu i wariant dla trybu wysokiego kontrastu. Podobnie ekran ustawień uproszczony względem HUD (jedna ramka, bez skanów i poświat), bo ozdoby przeszkadzały w czytelności formularza.
Dowód: `8ea4e6f`, `769f4c3`, `6ec121c`.

**L53. Teksty UI o zmiennej długości (nazwy broni, radio, cele) projektuj na najdłuższy wariant.** Nazwa broni łamała się w środku słowa; radio misji ograniczono do całych zdań (maks. 2 linie), cele kompaktowe na telefonie. Każdy nowy tekst w danych ma test długości lub zrzut w skrajnym przypadku.
Dowód: `5c4a325`, `ff804a4`, `8ff4e61`.

## Audio

**L54. Odblokowanie audio w jednym miejscu, pauza zawiesza cały kontekst.** Przeglądarkowy `AudioContext` startuje dopiero po pierwszym geście; to jedno miejsce (`AudioSystem.attachUnlock`) i nikt inny nie dotyka kontekstu. Pauza zawiesza kontekst (muzyka i otoczenie stoją), a kliknięcia w menu pauzy nie odblokowują audio.
Dowód: `17e4253`; `docs/systems/audio.md` (Odblokowanie).

**L55. Zegar muzyki z zegara audio, nie z zegara gry.** Dyrygent muzyki planuje z wyprzedzeniem na `AudioContext.currentTime`, z crossfade i histerezą 4 s przy przejściu spokój↔walka; boss ma priorytet, śmierć wraca do spokoju. Muzyka z zegara gry przeskakuje przy hitstopie i slow-mo.
Dowód: `c4bedaf`, `17e4253`.

**L56. Dźwięki jako przepisy w danych + limity głosów i klastrowanie.** Synteza w locie z przepisów JSON, limit 24 głosów, maks. 8 aktywnych pętli otoczenia, klastry źródeł ekranów w 4 m, panorama maks. 0,8. Dźwięki otoczenia i pociągu pauzują przy otwartej stacji. Na przyszłość zdecyduj o puli odtwarzaczy i priorytetach przed dodaniem dźwięków.
Dowód: `fe045e9`, `699484e`, `d25bf32`.

**L57. Audio w testach: sprawdzaj stan kontekstu, nie odsłuch.** Muzyka jest świadomie wyłączona w trybie testowym (`webdriver` / `fx=lite`); e2e sprawdzają stan wspólnego kontekstu i atrapę, a nie sam dźwięk. Odsłuch zostaje człowiekowi.
Dowód: `17e4253`; `docs/systems/reliability.md`.

## Zapis i postęp

**L58. Pauza i ukryta karta nie mogą nadrabiać czasu.** Pętla ograniczała liczbę kroków, ale wznowienie przed następnym klatką mogło nadrobić czas ukrycia; poprawka: reset zegara przy zmianie pauzy i blokada wznowienia ukrytej karty.
Dowód: `17e4253`.

**L59. Nagroda za run jest rozliczana idempotentnie, a zapis runu znika dopiero po udanym zapisie meta.** Pierwsza wersja kasowała zapis runu mimo błędu zapisu meta (nagroda przepadała) albo mogła naliczyć ją dwa razy po odświeżeniu. Rozwiązanie: stan `ended` w zapisie runu (`runId` + podsumowanie), `appliedRunIds` w meta, „Ponów zapis”, każdy odczyt meta przy rozliczeniu świeży z dysku, przyciski „Nowy run/Kryjówka” wyłączone do końca zapisu.
Dowód: `ed1e246`, `bc8167a`, `61be7a5`, `2df7b6e`; ADR 0007 pkt 2.

**L60. Błąd odczytu zapisu nie może prowadzić do nadpisania zapisu.** Wariant „ścisły” (`loadMetaManagerStrict`) przy błędzie odczytu nie nadpisuje meta; nieczytelny zapis nadal wymaga komunikatu, a oryginał zostaje nietknięty (kopia pod osobnym kluczem). Zapis z przyszłej wersji gry jest chroniony i nie jest migrowany wstecz.
Dowód: `2df7b6e`, `17e4253`; `docs/systems/reliability.md`.

**L61. Migracje zapisu mają fixtures dla każdej wersji.** Test generuje minimalny realistyczny zapis v1…v6 i sprawdza zachowanie dostępnych pól; opcjonalne pola nowych funkcji nie podnoszą wersji (stary zapis wczytuje się jak dotąd). Zapis trzyma `saveVersion`, a meta-progres i stan runu są osobno.
Dowód: `17e4253`, `598a1a7`, `5cde173`, `ed1e246`.

**L62. F5/zamknięcie w trakcie pokoju: autosave i checkpoint, bez podwójnych nagród.** Zapis co ≤ 2 s i natychmiast przy zakupie/implancie; checkpoint wraca na mapę przed pokojem, a `roomCredits` blokuje podwójne kredyty za powtórkę pokoju. Zdecyduj od początku, co gra gwarantuje po awarii (tu: pokój do powtórki, nagrody zostają).
Dowód: `1a4ad49`; `docs/systems/reliability.md` (Ograniczenia).

**L63. Dane z łatkami definicji walidowane po każdej łatce.** „Zmiana działania przez dane” (talenty) to łatki `add/mul/set` na kopii definicji, a wynik po każdej łatce przechodzi ponownie przez schemat; definicje globalne nigdy się nie mutują.
Dowód: `0d0ea7a`; `docs/systems/patches.md`.

**L64. Kolejność przetwarzania zbiorów wpływa na wynik; sortuj.** Węzły talentów przetwarzane w posortowanej kolejności id, duplikaty liczone raz, żeby ten sam zestaw dawał ten sam build (determinizm i testy).
Dowód: `f6473df`; `docs/systems/talents.md`.

## Determinizm

**L65. Jeden RNG z seeda, `fork(label)` na podsystem.** mulberry32 (jeden 32-bitowy stan, serializowalny) + fork haszujący `<seed>:<label>` z oryginalnego seeda, nie z bieżącego stanu, więc kolejność wywołań w jednym podsystemie nie przesuwa innych. Wektor referencyjny w testach. Zmiana algorytmu = migracja zapisów.
Dowód: ADR 0002; `0a33375` (test deterministyczności runu).

**L66. „Jeszcze raz” musi dawać identyczny przebieg dla tego samego seeda.** Retry areny nie czyścił stanu walki i używał niezresetowanego fork RNG; poprawka: świeży fork RNG fal, `reset()` wszystkich systemów walki, log spawnów do porównań. Test: dwa przebiegi z tego samego seeda mają identyczny `spawnLog`.
Dowód: `8a8f20d`.

**L67. Efekty kosmetyczne mogą używać innego losowania, ale nie mogą zmieniać kolejności RNG symulacji.** Optymalizacja deszczu (liczenie tylko rysowanych kropli) zachowała „kolejność RNG i wygląd bez zmian”; migotanie świateł i wstawki animacji NPC są deterministyczne (funkcje czasu), a respektują ustawienie błysków.
Dowód: `e3a7038`, `5043f5c`, `aa679bd`.

**L68. Testy na losowości muszą mieć stałe losowanie.** Test łuków przeciążenia raz padł wynikiem „9 vs 9” (liczenie na szczęście); zastąpiono stałym seedem. Podobnie dla generatorów aren (stały seed w generatorze).
Dowód: `12e100b`; ADR 0011 D5, `106be44`.

**L69. Ściana czasu (wall-clock) tylko dla watchdogów I/O, nie dla rozgrywki.** Timeout rozliczenia nagrody używa czasu ściennego i działa w pauzie (to świadome), ale timery rozgrywki, efekty i cooldowny liczone z `step(dt)`. Mieszanie obu źródeł czasu dawało niedeterministyczne testy i zjazd efektów przy pauzie.
Dowód: `aca02c0`; `docs/systems/reliability.md` (Ograniczenia).

**L70. Symulacja w stałym kroku 60 Hz, render interpoluje.** ADR 0001: `timeScale` i hitstop zmieniają `dt` przekazywane do kroku, a nie częstotliwość; render czyta poprzedni i bieżący stan z `alpha`. Limit kroków nadrabiania na klatkę (5) chroni przed „spiralą śmierci”, ale na wolnych maszynach spowalnia czas gry (patrz L77).
Dowód: ADR 0001; `e55ce13`.

## Wydajność

**L71. Scalaj statyczną geometrię w komórkach i mierz liczbę wywołań rysowania per przebieg.** Scalanie według materiału: targ 1683 → 156 siatek, magazyn i odlewnia ~3,7× mniej; kryjówka -19% wywołań rysowania, ale komórki 10–20 m (nie jedna bryła), żeby culling nadal działał. Pomija instancje, skóry i batch.
Dowód: `c6ec13b`, `293b878`, `0ade40c`, `721b752`, `369cce1`.

**L72. Postaci animowane: culling i rzadsza aktualizacja miksera poza kadrem.** Stała sfera ograniczająca na ciele NPC, aktualizacja mixerów poza kadrem rzadsza (bez skoku po powrocie). Masowe NPC w hubie (23) to głównie koszt animacji, nie rysowania.
Dowód: `f55186e`, `a33a6aa`.

**L73. Profiler przebiegów renderu zbuduj wcześnie.** Czasy CPU i GPU per przebieg (kolor, normalne, maska bloomu, odbić, rozmycia), liczniki wywołań i trójkątów. Dopiero on pokazał, że bloom to najdroższy dodatek (+10–15 ms), maska bloomu o połowę tańsza po ograniczeniu do materiałów emisyjnych w 1/4 rozdzielczości, a deszcz powinien wysyłać na GPU tylko zakres rysowanych kropli.
Dowód: `cb30a88`, `5f833b5`, `e3a7038`.

**L74. Pętle gorącej ścieżki bez alokacji, pule dla pocisków i odłamków od pierwszej wersji.** Pooling pocisków (limit 256), wykończenia z pulą celów bez alokacji co klatkę, efekty ostrza bez alokacji, stałe modułu zamiast tablic w pętli. W języku z GC (GDScript/C#) to samo: pule obiektów, brak tworzenia `Array`/`Vector3` w `_process`.
Dowód: `aedf65f`, `15dd4da`, `18d31ae`, `9ff76e4`.

**L75. Budżety wydajności jako testy z medianą, nie progiem punktowym.** Cele: symulacja ≤ 2 ms/krok z 12 wrogami (zmierzono 0,76 ms), nawigacja 450×300 m ~240 ms (limit 500), ≤ 800 wywołań rysowania. Test wydajności z jednym pomiarem padał pod obciążeniem (509–571 ms), więc mierzy medianę z 3 przebiegów; testy siatek mają budżety bezwzględne zamiast sztywnych liczb.
Dowód: `97db0d1`, `ccac5c1`, `a39fc60`, `0489aab`; ADR 0011 D8.

**L76. Nawigację dużych aren buduj z danych i mierz jej koszt.** Duże areny (do 450 m) wymagają nawigacji wielopoziomowej (schody, rampy, kładki) i generatora deterministycznego z seedem; sprawdzaj dojście wrogów na schodach i przewężeniach automatem, bo ręcznie tego nie zobaczysz.
Dowód: `506c666`, `106be44`, `97db0d1`; ADR 0011 (D5, D8), audyt: `docs/audits/mapy-2026-11-18.md`.

## Proces i testy

**L77. Testy e2e czekają na kroki symulacji, nie na czas ścienny.** Na wolnym CI (render programowy) klatka pokoju trwała 15–20 s, a limit kroków na klatkę (5) sprawiał, że 1 s czasu gry trwał minuty; testy zakładające „3 s” padały. Rozwiązanie: `waitSimSteps(n)`, tryb `fx=lite` (render w 1/4 rozdzielczości, bez deszczu, bloomu, cieni) i podniesiony limit kroków na klatkę tylko w tym trybie.
Dowód: `da09a53`, `e55ce13`, `9d0c2ae`, `a448f89`.

**L78. Test, który ma sprawdzić przepływ, nie powinien przeżywać walki.** Gracz ginął na wolnym CI w zwykłym pokoju przed `run clear` albo między zapytaniami; poprawki to nieśmiertelność na cały run i gotowość + akcja w jednym `evaluate`. Testy przepływu (mapa → pokój → nagroda → boss) odizoluj od testów walki.
Dowód: `587228f`, `ae9cd36`, `e9d4492`, `bb02578`, `4b06cf0`.

**L79. `[skip ci]` ukrywa regresje; w historii użyto go w 143 z 550 commitów (26%).** Najczęściej na gałęziach równoległych i merge’ach, a awarie e2e wychodziły dopiero później i były łatane osobnymi commitami „E2E: …”. Skutek: zielone „check” lokalnie (np. „e2e 62/62”), ale zrzuty wzorcowe i testy zależne od czasu padały po scaleniu. Zasada: nie używaj skip ci dla niczego, co dotyka kodu lub zasobów; skracaj CI sharding’iem i cache, nie pomijaniem.
Dowód: `fbe9fd9`, `c397e7a`, `8420855`, `bc13b71`, `4d5754f`; statystyka: `git log --grep='skip ci' --oneline | wc -l`.

**L80. Współdzielony proces przeglądarki między testami powoduje trudne do zdiagnozowania zawieszenia.** Test uszkodzonego zapisu zatrzymywał się dopiero przy kolejnych testach na wspólnym procesie Chromium; stabilizowała dopiero izolacja: przeglądarka na każdy test. Zasada: test, który manipuluje trwałym stanem (zapis, ustawienia), dostaje świeży proces/profil.
Dowód: `docs/systems/reliability.md` (Dogrywka); `a448f89` (znany błąd rzadkiego zawieszenia).

**L81. Testy regresji uruchamiaj na kodzie sprzed poprawki.** W przeglądzie Chwytu 15 z 17 testów regresji było czerwonych na pierwotnej implementacji; poprawka P1 pocisków miała test „bez poprawki pada”. Test, który przechodzi na starym i nowym kodzie, niczego nie chroni (przykład: test dispose z L03).
Dowód: `docs/issues/F2/grabReview.md`, `8a8f20d`, `694b4d2`.

**L82. Niezależny przegląd znajduje realne błędy, ale zweryfikuj każdy.** Przeglądy zewnętrzne (Codex gpt-6-astra, Gemini) znalazły token Szturmowca, zamarzanie Drona, blokadę celu Snajpera, pociski połykane przez kapsułę; każde znalezisko „zweryfikowane w kodzie i testami” przed poprawką, a jedną hipotezę (masa 0) odrzucono po teście.
Dowód: `8a8f20d`, `0839da6`, `139018e`; `docs/issues/F2/grabReview.md` (pkt 10).

**L83. Bramki playtestu bez wypełnionych wyników nie są bramkami.** Playtesty F1/F3/F4 mają szablony, ale tabele wyników są puste; F2 i F4 „czekają na playtest” mimo dziesiątek scalonych funkcji, a plan rozwoju przesuwa bramki na właściciela. Pierwszy realny playtest (18 XI) znalazł sześć błędów walki i UI w jednej sesji. Zasada: pierwszy grywalny pion (ruch + jedno ostrze + jeden wróg) jak najwcześniej do grania, wyniki zapisywane w repo.
Dowód: `docs/playtest-F1.md`, `docs/playtest-F3.md`, `docs/playtest-F4.md`, `docs/plan-rozwoju-2026-2027.md`, `2e3698f`, `457b5ad`.

**L84. Kontrakt przed kodem: jedno zdarzenie na jedną rzecz.** ADR 0003 ujednolicił propozycje `entity_hit` i `damage_dealt` do jednego zdarzenia z punktem, kierunkiem i `killed`, jeden typ zasobu (`ResourcePool` dla energii i ciepła), jedno miejsce czasu. Bez tego równoległe zadania wprowadzały duplikaty. Na przyszłość wydaj ADR-y sygnałów i zasobów, zanim zespół zacznie pisać systemy.
Dowód: ADR 0003; `docs/api.md`.

**L85. Równoległe gałęzie psują się na scaleniu; zapisz zasady współistnienia.** Po scaleniu `main` do gałęzi aren test dyrektora dawał 3,50 m zamiast 4 m (autostep, L24); ADR 0011 D9 wymienia pliki, których dana gałąź nie rusza, a `roomScene.ts` zmieniają tylko minimalnie. Duże pliki-węzły (sceny) to punkt konfliktów; wydzielaj logikę do modułów.
Dowód: `0320488`, `f20794d`, ADR 0011 D9.

**L86. Dokumentacja statusów dryfuje; generuj ją albo testuj.** Backlog i plan rozwoju wymagały osobnych commitów „aktualne statusy pozycji”; `docs/balance.md` jest generowany przez `npm run balance` i sprawdzany testem, a formatowanie (Prettier) na `main` przez pewien czas nie przechodziło w 10 plikach. Wszystko, co da się policzyć (balans, listy danych), generuj w CI.
Dowód: `0cf9d9e`, `a126b3c`, `9066f49`; `docs/systems/balance.md`.

**L87. Testy ze sztywnymi liczbami blokują rozwój.** Lista „dokładnie pięciu NPC”, dokładna wersja zapisu, „10 rozmów” czy liczba siatek padały przy każdym rozszerzeniu; zastąpiono je minimami i budżetami (≥ 16 rozmów, bezwzględny budżet siatek, brak sztywnej wersji zapisu).
Dowód: `50935bf`, `5f1f58b`, `a39fc60`, `ec22d8b`.

**L88. Symulator balansu mierzy „tempo czyszczenia”, nie TTK pojedynczego wroga.** Pojedyncze TTK karze bronie zabijające jednym strzałem; bramka to TTK paczki 5 wrogów w przedziale [mediana/2, mediana×2]. Pierwsza propozycja ścieżki Mocy dawała 77–∞ s na paczkę; wybrano opcję B (mniej radykalna zmiana obrażeń), a symulator „nie zastępuje playtestu”.
Dowód: `bfd8090`, `54ee619`, `b3a2112`; `docs/systems/balance.md`.

**L89. Dane przed kodem: nowy wariant = nowy plik danych, ale tylko z walidacją i testem „co się stanie z każdym plikiem”.** AGENTS.md wymusza JSON + zod; w praktyce błędy danych (L13, `grab` pominięty przez symulator, schematy z polami opcjonalnymi) wychodziły w testach przechodzących po wszystkich plikach danych.
Dowód: `8a1de69`, `0d0ea7a`, `docs/systems/balance.md` (ostrzeżenie o `grab`).

**L90. Zlecenia dla agentów muszą być wznawialne.** Zadania przerwane limitem (Codex) kończył inny agent, a część commitów ma adnotację „stan roboczy: efekty nieobejrzane na zrzutach”. Dla migracji: dziel pracę na kroki z własnym kryterium ukończenia i zrzutem wyniku, a „gotowe” ogłasza odbiorca.
Dowód: `0dbe557`, `106be44`, `25184ee`.

## Decyzje feel z playtestów

Wartości z `src/core/tuning.ts` i `src/data/**` (stan na 20 XI 2026). Kolumna „Skąd” rozróżnia: **playtest** (zmieniono po graniu 18 XI), **review** (po recenzji/zewnętrznym przeglądzie), **symulacja** (symulator balansu), **start** (wartość początkowa architekta, bez zapisanego strojenia po graniu; traktuj jako punkt wyjścia do własnego playtestu na przyszłość).

| Parametr (klucz)                                                 | Wartość końcowa                                                                             | Dlaczego                                                                                                                                        | Skąd              | Commit               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------- |
| `time.hitstopLightMs` / `hitstopHeavyMs`                         | 40 / 80 ms                                                                                  | raz na cios, zabójstwo podbija do ciężkiego; krótko, żeby combo płynęło                                                                         | start             | `de2405e`, `802c791` |
| `melee.executeHitstopMs`, `executeSlowmoScale`, `executeSlowmoS` | 110 ms, 0,35, 0,3 s                                                                         | wykończenie ma być dłuższym „akcentem” niż zwykły cios                                                                                          | start             | `03514fc`            |
| `time.lastKillTimeScale` / `lastKillSlowmoS` / `slowmoRecoverS`  | 0,2 / 0,3 s / 0,15 s                                                                        | slow-mo na ostatnie zabójstwo fali; płynny powrót w czasie rzeczywistym                                                                         | start             | `de2405e`, `477a602` |
| `melee.parryWindowMs` / `parryArcDeg` (pociski)                  | 150 ms / 160°                                                                               | okno „osiągalne”; pytanie playtestowe F1 (czy 150 ms jest osiągalne) pozostało bez zapisanej odpowiedzi                                         | start             | `477a602`            |
| `melee.parrySpeedMult` / `parryDamageMult`                       | 1,8 / 2                                                                                     | odbity pocisk ma dawać frajdę (szybszy i mocniejszy)                                                                                            | start             | `477a602`            |
| `melee.parryHitstopMs` / `parryShake`                            | 60 ms / 0,3                                                                                 | parowanie ma „zabrzmieć” mocniej niż zwykły cios                                                                                                | start             | `477a602`            |
| `melee.meleeParryWindowMs` (wręcz)                               | 200 ms, tylko z przodu, nie dotyczy `#heavy`                                                | szersze okno niż dla pocisków (brak uzasadnienia liczbowego w commicie; wynik oceny „czeka na playtest”); ciężki cios przebija blok z założenia | start             | `0e7792e`            |
| `melee.meleeParryStunS` / `meleeParryKnockback`                  | 0,9 s / 4                                                                                   | nagroda za parowanie: atakujący ogłuszony, cios przerwany                                                                                       | start             | `0e7792e`, `694b4d2` |
| `melee.lightWindupS` / `lightActiveS` / `lightRecoveryS`         | 0,05 / 0,1 / 0,16 s                                                                         | lekki cios startuje od razu (zero opóźnienia); ciężki zawsze poprzedza szybkie cięcie                                                           | start             | `802c791`            |
| `melee.comboWindowS` / `attackBufferMs`                          | 0,3 s / 120 ms                                                                              | płynne combo 1-2-3 z buforem wejścia                                                                                                            | start             | `802c791`            |
| `melee.heavyHoldS` / `heavyChargeS`                              | 0,22 s / 0,6 s                                                                              | ciężki atak „uczciwy”; przebija blok                                                                                                            | start             | `802c791`            |
| `plasmaBlade.json`: `blockDamageMult`, `blockEnergyPerHit`       | 0,3, 6                                                                                      | blok tnie obrażenia o 70% i kosztuje energię; brak energii = rozbicie gardy                                                                     | start             | `802c791`            |
| `player.coyoteTimeMs` / `jumpBufferMs`                           | 100 ms / 120 ms                                                                             | standardowe okna wybaczania; wejście przeżywa hitstop                                                                                           | start             | `de2405e`            |
| `player.dashDistance` / `dashDurationS` / `dashCooldownS`        | 6 m / 0,18 s / 1,2 s                                                                        | dash krótki i responsywny; pytanie F1 „czy nie za długi” bez zapisanej odpowiedzi                                                               | start             | `2640fc6`            |
| `player.dashInvulnerable`                                        | 0 (wyłączone)                                                                               | nietykalność w dashu wyłączona po błędzie „tryb boga”; predykat sprawdzany przed obrażeniami                                                    | review            | `60f79d1`            |
| `player.slideMinSpeed` / `slideMaxS`                             | 9 m/s / 1,1 s                                                                               | ślizg zachowuje pęd skoku; startuje tylko z biegu                                                                                               | start             | `2640fc6`            |
| `camera.fov` / `sprintFovKick` / `dashFovKick`                   | 90° / +6 / +12                                                                              | poczucie prędkości przez FOV                                                                                                                    | start             | `de2405e`, `2640fc6` |
| `player.aim.*` (ADS)                                             | wejście 0,18 s, FOV ×0,72, czułość ×0,7, ruch ×0,6, rozrzut ×0,4, odrzut ×0,7               | PPM = celowanie z bronią palną; sprint niedostępny w celowaniu                                                                                  | start             | `9d0391b`            |
| `weapons.triggerBufferS`                                         | 0,15 s                                                                                      | klik tuż przed końcem odnowienia strzela po nim (feel pistoletu/snajperki)                                                                      | start             | `1b5d5dc`            |
| `weapons.overheatLockS`                                          | 1,5 s                                                                                       | przegrzanie ma wymuszać decyzje, nie tylko irytować                                                                                             | start             | `2640fc6`            |
| `powers.energyRegenDelayS` / `meleeKillEnergy` / `parryEnergy`   | 2 s / 15 / 10                                                                               | regeneracja dopiero po 2 s bez wydatku; energia z walki wręcz i parowania                                                                       | start             | `b0f78d2`            |
| `powers/chain.json`: `damage` / `cost` / `cooldownS`             | 60 / 10 / 0,4 s (było 18 / 30 / 1,2)                                                        | bramka TTK paczki; ścieżka Mocy była nieużywalna (77–∞ s na paczkę)                                                                             | symulacja         | `b3a2112`            |
| `powers/push.json`: `damage` / `cost`                            | 35 / 10 (było 10 / 25)                                                                      | j.w.; Pchnięcie jako kontrola grup i ścian                                                                                                      | symulacja         | `b3a2112`            |
| `weapons/sniper.json`: `fireRateHz`                              | 0,8 (odnowienie 1,25 s; było 1)                                                             | podniosło medianę Egzekutora tak, by Moc mieściła się w przedziale                                                                              | symulacja         | `b3a2112`            |
| `assaulter.json`: `telegraphS` / `swingActiveS` / `recoveryS`    | 0,4 s / 0,12 s / 0,6 s                                                                      | czas reakcji na cios wręcz; kierunek ustalony przy zapowiedzi                                                                                   | start             | `3886d4b`            |
| `gunner.json`: `aimTelegraphS` / `projectileSpeed`               | 0,5 s / 11 m/s                                                                              | wolne, czytelne pociski do parowania                                                                                                            | start             | `51e64ac`            |
| `difficulty.json`: `telegraph`                                   | 1,2 / 1,0 / 0,85 / 0,72 (min 0,7)                                                           | skalowanie zapowiedzi z poziomem trudności z twardym dolnym progiem                                                                             | start             | `0dbe557`            |
| Poziom trudności nowego gracza                                   | Trudny (`hard`)                                                                             | decyzja właściciela                                                                                                                             | start (decyzja)   | `0dbe557`            |
| `run.rewardDelayS`                                               | 1 s                                                                                         | opóźnienie przed wyborem implantu, by nie klikać przez przypadek                                                                                | start             | `12b4d3c`            |
| `hub.interactRangeM` / `focusPaddingM`                           | 3,5 m / 0,2 m (kąt stożka 30° i wysokość 1,25 m były w `12b4d3c`, potem usunięte z tuningu) | stacje otwierane spojrzeniem + `[E]`, nie automatycznie                                                                                         | start             | `3fb7766`, `12b4d3c` |
| `enemies.stepHeight` / `stepMinWidth` / `snapToGroundDistance`   | 0,35 m / 0,2 m / 0                                                                          | zgodne z nawigacją; snap do podłoża gubił trasę, więc wyłączony                                                                                 | review            | `d4465f2`, `8fda856` |
| `vfx.enemyRimNearM` / `FarM` / `FarGain`                         | 4 m / 20 m / 2,5                                                                            | poświata krawędzi wroga rośnie z odległością, kompensowana mgłą                                                                                 | playtest (zrzuty) | `40485bc`            |
| `render.outlineFadeNear` / `outlineFadeFar`                      | 6 m / 16 m                                                                                  | kontur wewnętrzny zanika z odległością; z 20 m było 20% czerwonych pikseli, po zmianie 100%                                                     | playtest (pomiar) | `a430688`            |
| `inkWidth` (look a/b/c)                                          | 2,2 → 1,9 (c: 2,4 → 2,05), ok. 15% cieńszy, skala z odległością                             | dalekie postacie nie mogą zamieniać się w czarne sylwetki                                                                                       | playtest (zrzuty) | `1d48144`            |
| `enemies.shieldHeadClearanceM`                                   | 0,03 m                                                                                      | tarcza nie wchodzi w hełm podczas biegu                                                                                                         | playtest 18.11    | `2e3698f`            |
| Szybkość strzału po namierzaniu laserem                          | snajper i haker 120 m/s, wieżyczka 60 m/s                                                   | szybkie strzały po laserze (raycast odcinkowy) zamiast pocisku „z opóźnieniem”                                                                  | playtest 18.11    | `2e3698f`            |
| `physics.gravity`                                                | −20 m/s²                                                                                    | mocniejsza grawitacja niż rzeczywista, bardziej „zwarty” skok                                                                                   | start             | `de2405e`            |
| `damage.playerInvulnMs`                                          | 250 ms                                                                                      | okno ochronne po trafieniu gracza                                                                                                               | start             | `de9c694`            |
| `weapons.maxProjectiles`                                         | 256                                                                                         | limit pocisków w puli                                                                                                                           | start             | `2640fc6`            |
| `horizon.*` (far 220 m dla małych map, pierścienie 66–162 m)     | liczone z obwiedni sceny dla dużych aren                                                    | stałe zaniżały horyzont na arenach 240–450 m                                                                                                    | review            | `97db0d1`            |

Uzupełnienie: wartość startowa w kolumnie „Skąd” nie oznacza, że jest zła, tylko że historia nie zawiera zapisu jej strojenia po graniu. Pytania do oceny na przyszłość mają odpowiedniki w `docs/playtest-F1.md` (sekcje „Co ocenić” i „Pokrętła”).
