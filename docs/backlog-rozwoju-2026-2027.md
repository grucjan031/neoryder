# NEORYDER — backlog rozwoju (etapy po kolei)

Zadania do planu [`plan-rozwoju-2026-2027.md`](plan-rozwoju-2026-2027.md). Pomysły spoza półrocza: [`backlog.md`](backlog.md).

**Statusy:** `gotowe i ocenione` → `zaimplementowane, czeka na playtest` → `w realizacji` → `zaplanowane` → `odłożone`.
**Priorytety:** P0 blokuje testy z ludźmi; P1 potrzebne do dema; P2 poprawia demo, można ciąć.
**Role:** Właściciel (decyzje, granie), Architekt (Claude: kontrakty, zlecenia, odbiór), Wykonawca (agent), QA (agent: testy, pomiary), Testerzy (osoby spoza projektu).
**Estymacja:** Cz = godziny człowieka; Ag = rozmiar pracy agenta (S/M/L, zob. plan, sekcja 3).

---

## S0 — domknięcie podstaw

### S0-01 Bezpieczne rozliczenie runu po błędzie zapisu

- **Cel:** nieudany zapis meta nie gubi ani nie podwaja nagrody. **P0** · Wykonawca + Architekt · Cz 2 · Ag M · status: zaimplementowane, czeka na playtest (PR #18)
- **Zależności:** —
- **Kryteria:** `clearRun` tylko po udanym `saveMeta`; ekran podsumowania pokazuje błąd i „Ponów zapis”; ponowienie, odświeżenie i Kontynuuj z menu naliczają nagrodę dokładnie raz; stare zapisy wczytują się bez zmian; ADR 0007 pkt 2 zaktualizowany.
- **Weryfikacja:** testy w `tests/unit/runMeta.test.ts` (błąd store → ponowienie → odświeżenie), zrzut komunikatu, recenzja niezależna (miejsce krytyczne: trwały postęp).

### S0-02 Playtest F2 — trzy czyste ścieżki

- **Cel:** ocena bramki F2 (Ostrze, Moc, Strzelec przechodzą arenę 12 fal i grają się inaczej). **P0** · Właściciel · Cz 4 · status: zaplanowane
- **Zależności:** najlepiej po S0-07 i S0-08 (zmieniają odczucie walki).
- **Kryteria:** wynik każdej ścieżki, mocne strony i momenty, w których styl przestaje bawić, zapisane w `docs/issues/F2/README.md`.
- **Weryfikacja:** decyzja właściciela (D4); bez niej bramka zostaje otwarta.

### S0-03 Playtest F4 — 5 runów od zera

- **Cel:** ocena progresu i oporu wg `docs/playtest-F4.md`. **P0** · Właściciel · Cz 6 · status: zaplanowane
- **Zależności:** S0-01 (żeby nagrody nie ginęły w trakcie testu).
- **Kryteria:** wypełniony szablon (poziom, zakupy, odczucie progresu i oporu po każdym runie).
- **Weryfikacja:** decyzja właściciela (D4).

### S0-04 Decyzje zakresowe D1, D2 (wstępnie), D4

- **Cel:** ustalić, czy misje wchodzą do kodu, wstępny zakres dema i ocenę bramek. **P0** · Właściciel · Cz 2 · status: w realizacji
- **Kryteria:** decyzje dopisane w planie, sekcja 6.
- **Stan 17 XI 2026:** D1 tak (misje do kodu od S1), D2 wstępnie 3 + 2 warunkowo. D4 czeka na playtesty S0-02 i S0-03.

### S0-05 Splasharty wg aktu fabuły

- **Cel:** ekrany ładowania nie zdradzają aktów II–III i epilogu. **P1** · Wykonawca · Cz 0,5 · Ag S · status: zaimplementowane, czeka na playtest (PR #15, #17)
- **Kryteria:** pole `act` w `splash.json`; przy 0 zwycięstw nigdy nie wypada akt 2+; progi w `tuning`; testy w `tests/unit/splash.test.ts`.
- **Weryfikacja:** testy, zrzuty ekranu ładowania; po S1-03 przejście na postęp kampanii.

### S0-06 Róż podłogi areny bossa

- **Cel:** efekty bossa czytają się jako czerwień wroga, nie magenta Rezonansu. **P2** · Wykonawca · Cz 0,5 · Ag S · status: zaimplementowane, czeka na playtest (PR #17)
- **Kryteria:** < 2% kolorowych pikseli o odcieniu 290–340° w obszarze efektu (pomiar skryptem z `tools/`).
- **Weryfikacja:** zrzuty GPU przed/po, liczby z pomiaru.

### S0-07 Celowanie pod PPM z bronią palną

- **Cel:** przybliżenie i precyzja przy broni palnej, bez utraty bloku przy ostrzu. **P1** · Wykonawca · Cz 1,5 · Ag M · status: zaimplementowane, czeka na playtest (PR #19)
- **Zależności:** S0-01 (jeden wykonawca naraz).
- **Kryteria:** z ostrzem PPM = blok jak dziś; z bronią palną PPM = celowanie (FOV ~65, ruch ×0,6, rozrzut ×0,4, brak sprintu), wejście/wyjście 0,15–0,2 s; wyjście przy przełączeniu, dashu, pauzie, utracie fokusu; samouczek uzupełniony.
- **Weryfikacja:** testy jednostkowe mapowania i mnożników, zrzuty w celowaniu dla każdej broni, granie właściciela.

### S0-08 Przewracanie i wstawanie wrogów („kip-up”)

- **Cel:** mocny odrzut przewraca humanoidalnych wrogów, którzy zwinnie wyskakują na nogi. **P2** · Wykonawca · Cz 1,5 · Ag M · status: zaimplementowane, czeka na playtest (PR #19)
- **Zależności:** S0-07 (to samo zlecenie).
- **Kryteria:** tylko przy odrzucie ≥ `stunKnockback`; cała sekwencja ≤ `stunOnHeavyS` (balans bez zmian); bez dronów, wieżyczek i bossa; śmierć w leżeniu = zwykły rozpad.
- **Weryfikacja:** testy czasu i warunków, arkusz klatek sekwencji, granie właściciela.

### S0-09 Statusy w roadmapie i backlogu

- **Cel:** agenci nie zlecają ponownie gotowych funkcji. **P1** · Wykonawca · Cz 0,5 · Ag S · status: w realizacji (gałąź `statusy-planu`)
- **Kryteria:** każda pozycja `docs/roadmap.md` (fazy) i `docs/backlog.md` ma jeden status ze skali wyżej.
- **Weryfikacja:** przegląd Architekta (zgodność z kodem).

### S0-10 Porządek wdrożenia

- **Cel:** jedno źródło prawdy o hostingu. **P2** · Wykonawca · Cz 0,25 · Ag S · status: zaimplementowane, czeka na playtest (netlify.toml usunięty, README: sekcja Wdrożenie)
- **Kryteria:** `netlify.toml` usunięty albo opisany jako nieużywany; README opisuje wdrożenie przez Vercel.
- **Weryfikacja:** podgląd PR na Vercel nadal działa.

---

## S1 — kontrakt misji i kampanii

### S1-01 ADR 0008: misje i kampania

- **Cel:** kontrakt przed kodem. **P1** · Architekt + Właściciel · Cz 4 · Ag S · status: zaimplementowane, czeka na playtest (ADR 0008 przyjęty, PR #21)
- **Zależności:** D1, D3, D6.
- **Kryteria:** stany misji (zablokowana, dostępna, w toku, ukończona), cele, warunki porażki, nagrody za pierwsze i kolejne ukończenie, odblokowania, rozdział postępu próby od postępu kampanii, reguły powtórki po śmierci.
- **Weryfikacja:** recenzja niezależna, akceptacja właściciela.

### S1-02 Schemat danych misji

- **Cel:** misja jako dane (zod), jak inne pliki `src/data`. **P1** · Wykonawca · Cz 1 · Ag M · status: zaimplementowane, czeka na playtest (PR #21)
- **Zależności:** S1-01.
- **Kryteria:** schemat + wpis „Maszty”; obowiązkowe pokoje fabularne o stałej pozycji w sektorze; walidacja przy starcie.
- **Weryfikacja:** testy schematu i generatora sektora z pokojem obowiązkowym.

### S1-03 Stan kampanii w zapisie

- **Cel:** trwały postęp kampanii. **P0** · Wykonawca · Cz 1,5 · Ag M · status: zaimplementowane, czeka na playtest (PR #21)
- **Zależności:** S1-01, S0-01.
- **Kryteria:** wersja zapisu + migracja; stare zapisy dostają pusty postęp; `unlockedSplashAct` czyta postęp kampanii zamiast zwycięstw.
- **Weryfikacja:** testy migracji na stałych plikach starych zapisów.

### S1-04 Pomiar referencyjny wydajności

- **Cel:** punkt odniesienia dla 60 FPS. **P1** · QA + Właściciel · Cz 2 · Ag S · status: zaimplementowane, czeka na playtest (`npm run perf:bench`, wyniki w `docs/systems/render.md`; pomiar na laptopie D5 robi właściciel)
- **Zależności:** D5.
- **Kryteria:** powtarzalny skrypt (build produkcyjny, GPU) mierzy kryjówkę, zwykłą walkę, najcięższy pokój, bossa, rozpad grupy i przejście scen; średnia, 1% low, przycięcia; raport w `docs/systems/render.md`.
- **Weryfikacja:** dwa przebiegi na sprzęcie referencyjnym różnią się < 5%.

## S2 — „Maszty”

### S2-01 Tablica misji, odprawa, cel w HUD

- **P1** · Wykonawca · Cz 2 · Ag M · zależności: S1-02, S1-03 · status: zaimplementowane, czeka na playtest (PR #21)
- **Kryteria:** wybór misji na tablicy, krótka odprawa, aktualny cel w HUD, komunikaty radiowe nie zasłaniają informacji walki.
- **Weryfikacja:** e2e: tablica → odprawa → run z celem; zrzuty desktop/telefon.

### S2-02 „Maszty” — sabotaż trzech masztów

- **P1** · Wykonawca + Architekt · Cz 4 · Ag L · zależności: S2-01 · status: zaimplementowane, czeka na playtest (PR #21, #22; liniowo: ADR 0009, misja M01)
- **Kryteria:** trzy cele sabotażu, reakcja przeciwników, rezultat fabularny i powrót; ukończenie bez debug; porażka i ponowienie bez zepsutego stanu; wczytanie zachowuje postęp.
- **Weryfikacja:** bot e2e misji, granie właściciela, 2–3 osoby spoza projektu wskazują cel bez podpowiedzi.

### S2-03 Reakcja Kamiennej po Masztach

- **P2** · Wykonawca · Cz 1 · Ag S · zależności: S2-02 · status: zaimplementowane, czeka na playtest
- **Kryteria:** nowe kwestie NPC i zmiana otoczenia wg `zarys-fabuly.md` sekcja 10.

## S2b — tryby areny (decyzja właściciela 17 XI 2026)

Tryby jednoosobowe inspirowane trybami drużynowymi strzelanek, zbudowane na strefach i celach z ADR 0008. Wejście z kryjówki obok zwykłego runu; nagrody jak za run (bez bonusu kampanii). Poziom zagrożenia działa.

### S2b-01 Przejęcie

- **Cel:** walka o punkty zamiast czyszczenia pokoju. **P1** · Wykonawca (Codex astra) + Architekt · Cz 2 · Ag L · status: zaimplementowane, czeka na playtest (PR #23)
- **Zależności:** S2-02 (strefy z paskiem postępu, fale z białą listą wrogów).
- **Kryteria:** arena z 3 punktami A/B/C; gracz przejmuje punkt, stojąc w strefie; wrogowie przejmują i odbijają punkty (AI idzie do najbliższego punktu nie-wroga); pula posiłków wroga spada szybciej, gdy gracz trzyma większość punktów; zwycięstwo przy wyczerpaniu puli, porażka przy śmierci; HUD: stan punktów i pula. Liczby w `tuning`.
- **Weryfikacja:** testy logiki punktów i puli, bot e2e (przejęcie cheatem → zwycięstwo), zrzuty HUD i stref, granie właściciela.

### S2b-02 Szturm

- **Cel:** front przesuwany przez wysadzanie par stacji. **P2** · Wykonawca · Cz 1,5 · Ag M · status: zaimplementowane, czeka na playtest (PR #30)
- **Zależności:** S2b-01, cel `sabotage`.
- **Kryteria:** sektory po 2 stacje; zniszczenie obu przesuwa front; limit posiłków gracza (dodatkowe życia) zamiast pojedynczej śmierci.

### S2b-03 Kradzież rdzenia

- **Cel:** zabrać rdzeń z bazy wroga i donieść do ewakuacji. **P2** · Wykonawca · Cz 1,5 · Ag M · status: zaimplementowane, czeka na playtest (PR #32)
- **Zależności:** S2b-01, cele `pickup` i `exit`.
- **Kryteria:** z rdzeniem wolniejszy ruch i brak dasha, wszyscy wrogowie gonią nosiciela; śmierć upuszcza rdzeń, wróg może go odnieść do bazy.

## S3 — „List przewozowy”

### S3-01 Cel obrony strefy

- **P1** · Wykonawca · Cz 3 · Ag L · zależności: S2-02 · status: zaimplementowane, czeka na playtest (PR #25)
- **Kryteria:** postęp pobierania danych w strefie, czytelne zatrzymanie po wyjściu, fale wymuszające zmianę pozycji i użycie mocy.
- **Weryfikacja:** testy logiki strefy, bot e2e, granie właściciela.

### S3-02 Treść misji „List przewozowy”

- **P1** · Wykonawca · Cz 2 · Ag M · zależności: S3-01 · status: zaimplementowane, czeka na playtest (PR #25)
- **Kryteria:** odprawa, pokoje, rezultat, odblokowanie następnej misji.

## S4 — „Odlewnia” i prototypy

### S4-01 Zwycięstwo misji poza pokojem bossa

- **P1** · Architekt + Wykonawca · Cz 2 · Ag M · zależności: S1-01 · status: zaimplementowane, czeka na playtest (PR #27)
- **Kryteria:** sukces = boss + pobranie danych + ewakuacja (dziś pokój bossa od razu kończy run zwycięstwem — rozszerzyć regułę w `src/world/run.ts`).
- **Weryfikacja:** testy przejść stanu runu, bot e2e.

### S4-02 „Odlewnia” — Brandt

- **P1** · Wykonawca · Cz 3 · Ag L · zależności: S4-01, D3 · status: zaimplementowane, czeka na playtest (PR #27)
- **Kryteria:** odprawa z kartą, wejście na arenę, zakończenie starcia, dane, ewakuacja, reakcje kryjówki.

### S4-03 Prototypy ratowania NPC i wagonu

- **P1** · Wykonawca · Cz 2 · Ag M · zależności: — · status: zaimplementowane, czeka na playtest (sceny `?scene=escort-test` i `?scene=payload-test`, raport `docs/systems/prototypes-s4-03.md`) · decyzja D2 właściciela
- **Kryteria:** proste poziomy testowe: więzień idzie do punktu ewakuacji i omija przeszkody; wagon jedzie po trasie z postojami. Raport kosztu i ryzyk.
- **Weryfikacja:** decyzja właściciela o wariancie rozszerzonym (wstęp do D2).

### S4-04 Krótka narracja łącząca 3 misje

- **P1** · Właściciel + Architekt · Cz 3 · zależności: D2, D3 · status: zaimplementowane, czeka na playtest (przerywniki, PR #27)

## S4b — osiągnięcia i naszywki Iskry (decyzja właściciela 17 XI 2026)

### S4b-01 Osiągnięcia z naszywkami

- **Cel:** powód do kolejnego runu (filar 3) i zachęta do grania każdą ścieżką (filar 2). **P2** · Wykonawca (Codex astra) + Architekt · Cz 2 · Ag L · status: zaimplementowane, czeka na playtest (PR #31)
- **Zależności:** S4-02 (wszystkie trzy misje dema), S0-01 (bezpieczne rozliczenie).
- **Kryteria:** ok. 25–30 osiągnięć w danych (walka, czyste ścieżki Ostrze/Moc/Strzelec, misje i tryby, progres); liczenie z istniejących zdarzeń `EventBus`; stan w metazapisie z migracją; jednorazowa nagroda w Danych/Rdzeniach (idempotentnie, jak nagrody runu); komunikat w HUD przy zdobyciu; panel „Naszywki Iskry” w kryjówce (zdobyte świecą, brakujące szare z podpowiedzią) i komentarz NPC; ikony w palecie bursztyn/biel/zieleń (bez cyanu i magenty).
- **Zasady projektu:**
  - Osiągnięcie **pozwala kupić** przedmiot, nie daje go za darmo (balans waluty zostaje).
  - Bramkujemy tylko rzadkie odblokowania za Rdzenie (Skupienie, dwustronne ostrze, Nadprzewodnik, slot broni 3) — nie wpływa to na bramkę F4 (5 runów: poziom 7, 4 zakupy).
  - Żadne osiągnięcie bramkujące nie wymaga przedmiotu, który samo odblokowuje.
- **Weryfikacja:** testy liczników i idempotencji, symulacja balansu F4 bez zmian, zrzuty panelu i komunikatu, granie właściciela.

## S4c — warsztat broni z widocznymi modułami (decyzja właściciela 17 XI 2026)

### S4c-01 Warsztat broni: sloty, wygląd, podgląd 3D

- **Cel:** dopasowanie broni z widoczną zmianą wyglądu (pomysł właściciela: jak warsztat broni w strzelankach), zgodnie z filarem 2 — moduł zmienia sposób gry, nie tylko liczby. **P2** · Wykonawca (Codex astra) + Architekt · Cz 2 · Ag L · status: zaimplementowane, czeka na playtest (PR #35, #36)
- **Zależności:** S0-07 (celowanie), S4b-01 (warsztat i bramki), istniejące moduły (`src/data/modules`) i części modeli broni (`muzzle`, `heat_cell`, `heat_vents`, `support`, `grip`…).
- **Kryteria:** sloty per broń: **Wylot** (`muzzle`), **Ogniwo** (`heat_cell`/`heat_vents`) i nowy **Optyka** (`support`, wpływa na celowanie: kolimator 1× szybsze wejście, luneta mocniejsze przybliżenie i wolniejsze wejście); każdy moduł ma element wizualny dokładany/podmieniany na właściwej części modelu (widoczny w widoku FPP i w podglądzie); warsztat w kryjówce z obracanym podglądem 3D, wyborem slotu i listą modułów z opisem „co zmienia”; zakładanie darmowe, odblokowanie za walutę jak dziś; kolory elementów bursztyn/biel/zieleń; brak modułów czysto liczbowych.
- **Poza zakresem:** rozbudowany crafting (GDD, sekcja „Poza zakresem”), skórki i kosmetyka bez wpływu na grę.
- **Weryfikacja:** testy schematu slotów i zgodności modułów z rodzajem broni, zrzuty każdej broni z modułami (FPP i podgląd), granie właściciela; symulacja balansu F4 bez zmiany wyniku.

## S5–S6 — testy nowych graczy

### S5-01 Tura testów 1 (4–6 osób)

- **P0** · Właściciel + Testerzy · Cz 8 · zależności: S4-02
- **Kryteria:** obserwacje wg planu (samouczek, tablica misji, wyposażenie, synergie, przyczyna śmierci, chęć kolejnej próby); trzy najważniejsze problemy.
- **Weryfikacja:** notatki w `docs/playtest-demo.md`.

### S5-02 Poprawki po turze 1

- **P1** · Wykonawca · Cz 3 · Ag M–L · zależności: S5-01

### S6-01 Tura testów 2 (4–6 osób)

- **P0** · Właściciel + Testerzy · Cz 8 · zależności: S5-02
- **Kryteria:** wskaźnik „8 z 10 samodzielnie dociera do pierwszego celu”.

### S6-02 (warunkowo) „Punkt kontrolny”

- **P2** · Wykonawca · Cz 4 · Ag L · zależności: S4-03 pozytywny, D2
- **Kryteria:** przewidywalne trasy więźniów, czytelne sygnały zagrożenia, rozdział uwagi wrogów, obsługa śmierci Nadii i gracza, reakcja kryjówki.

### S6-03 Przebudowa 2–3 najsłabszych pokoi

- **P2** · Wykonawca · Cz 2 · Ag M · zależności: S5-01
- **Kryteria:** nowa geometria zmienia decyzje (flankowanie, ruch, Rezonans).

## S7–S8 — zawartość i zamknięcie zakresu

### S7-01 Konsekwencje w kryjówce po misjach dema

- **P1** · Wykonawca · Cz 2 · Ag M · status: zaimplementowane, czeka na playtest

### S7-02 Audio walki i muzyka (spokój, walka, boss)

- **P2** · Wykonawca · Cz 3 · Ag M · status: zaimplementowane, czeka na playtest (PR #34, #40)
- **Kryteria:** wyraźne parowanie, zagrożenie, przegrzanie, trafienie, nagroda; trzy pętle muzyczne syntezowane.

### S8-01 (warunkowo) „Ładunek klasy K”

- **P2** · Wykonawca · Cz 5 · Ag L · zależności: S4-03, S6-02, D2

### S8-02 Decyzja 3 vs 5 misji i zamrożenie zakresu

- **P0** · Właściciel · Cz 1

## S9–S10 — jakość wydania

### S9-01 Wydajność na sprzęcie referencyjnym

- **P1** · QA + Wykonawca · Cz 3 · Ag M · zależności: S1-04
- **Kryteria:** cel 60 FPS w ustalonej rozdzielczości i profilu; analiza przycięć; pamięć po wielu zmianach scen nie rośnie.

### S9-02 Niezawodność

- **P1** · QA · Cz 3 · Ag M · status: zaimplementowane, czeka na playtest (PR #18, #48, #49)
- **Kryteria:** godzinna sesja, pauzy, utrata fokusu, odświeżenie, aktualizacja wersji bez utraty zapisu; wspierane przeglądarki (D7).

### S10-01 Czytelność i pierwsze minuty

- **P1** · Wykonawca + Właściciel · Cz 4 · Ag M · status: zaimplementowane, czeka na playtest (PR #41, #46, #83; tryb niskiej jakości i bez błysków; przewodnik „dokąd teraz” w kryjówce, nagroda i wymagania misji na tablicy, objaśnienia walut; plan obserwacji `docs/playtest-demo.md`)
- **Kryteria:** sygnały ataków, stan celów, opisy talentów, waluty, komunikaty porażki; tryb niskiej jakości i bez błysków.

### S10-02 Kandydat do wydania

- **P0** · Właściciel · Cz 4
- **Kryteria:** brak błędów blokujących ukończenie i niszczących postęp; całe demo przeszli nowi gracze.

## S11–S12 — publikacja

### S11-01 Publikacja dema

- **P1** · Wykonawca + Właściciel · Cz 4 · Ag M · status: w realizacji (wersja 0.9.0 i seed w menu i pauzie, `CHANGELOG.md`, „Zgłoś problem”, „Sterowanie i zapis” — zrobione; zostają: opis gry, krótki materiał z rozgrywki)
- **Kryteria:** numer wersji i ziarno widoczne w grze, lista zmian, sposób zgłaszania problemów, opis gry, krótki materiał z rozgrywki, opis sterowania i zapisu.

### S12-01 Pierwsza aktualizacja

- **P1** · Wykonawca · Cz 4 · Ag M–L · zależności: S11-01
- **Kryteria:** najczęstsze zgłoszenia naprawione; decyzja o kolejnym etapie na podstawie zachowań graczy.
