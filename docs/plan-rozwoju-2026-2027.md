# NEORYDER — plan rozwoju (etapy po kolei, bez dat)

- **Opracowanie:** 17 listopada 2026, na podstawie propozycji `NEORYDER_plan_rozwoju_2026-2027.md` (właściciel) i przeglądu repozytorium.
- **Stan odniesienia:** `main` = `1999b06` (ten sam commit, na którym oparto propozycję).
- **Backlog zadań:** [`backlog-rozwoju-2026-2027.md`](backlog-rozwoju-2026-2027.md). Pomysły „po demie” zostają w [`backlog.md`](backlog.md).
- **Status dokumentu:** plan przyjęty 17 XI 2026. Zatwierdzone przez właściciela: D1 (misje wchodzą do kodu od S1) i D2 wstępnie (3 misje bazowe, 5 warunkowo). Bramki F2/F4 nadal czekają na playtest (sekcja 6).
- **Decyzje właściciela 17 XI 2026:** D1 — tak; D2 — 3 bazowe + 2 warunkowo, ostatecznie w S8; playtest walki (S0-02) po scaleniu S0-07 i S0-08.

## 1. Stan repozytorium — co potwierdzono

Oznaczenia: **[kod]** potwierdzone w kodzie, **[dok]** tylko w dokumentacji, **[rek]** rekomendacja.

| Obszar       | Stan                                                                                                                                                                                             | Źródło                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Walka        | Ostrze (3 warianty), 7 broni, 6 mocy, statusy, implanty, synergie. PPM = blok; z bronią palną PPM wymusza ostrze. Wrogowie nie przewracają się (ogłuszenie = klip `Hit_Chest`).                  | [kod] `src/data/inputBindings.json`, `src/combat/heldItem.ts`, `src/enemies/enemyAnimation.ts` |
| Pętla runu   | Sektor Kurogane, mapa, pokoje, nagrody, sklep, odpoczynek, boss `securityChief`, cisza po zwycięstwie. Pokój bossa kończy run zwycięstwem.                                                       | [kod] `src/world/run.ts`, `src/scenes/run.ts`                                                  |
| Meta i zapis | Waluty, poziomy, drzewka, warsztat, zagrożenie. `applyRun` jest idempotentne (`appliedRunIds`), ale `finishMeta()` przy błędzie zapisu meta i tak woła `clearRun()` → **ryzyko utraty nagrody**. | [kod] `src/scenes/run.ts` `finishMeta`, `src/progression/meta.ts`                              |
| Kryjówka     | Stacja Kamienna: NPC, reakcje, siadanie, spadek napięcia, dzieci i kot, scalanie statyki (komórki 20 m).                                                                                         | [kod] `src/scenes/hub*.ts`, `docs/systems/hub.md`                                              |
| Fabuła       | 20 misji w 3 aktach — wyłącznie dokumenty. Tablica misji uruchamia zwykły run (zagrożenie + ziarno), brak systemu kampanii.                                                                      | [dok] `docs/fabula/`; [kod] `src/ui/hub/missionsPanel.ts`                                      |
| Splasharty   | 57 ilustracji na ekranach ładowania. W toku (gałąź `szlif-fabula`): podział na akty, odblokowanie po zwycięstwach — tymczasowo, do czasu postępu kampanii.                                       | [kod] `src/ui/splash.ts`                                                                       |
| Bramki       | F2: zadania 01–18 gotowe, czeka playtest człowieka. F4: 01–12 gotowe, czeka playtest wg `docs/playtest-F4.md`. F3 zaakceptowana 2026-11-15.                                                      | [dok] `docs/issues/F2–F4/README.md`                                                            |
| Wydajność    | `perf.spec.ts` raportuje FPS bez progu; Playwright renderuje programowo (SwiftShader) — nie mierzy sprzętu docelowego.                                                                           | [kod] `tests/e2e/perf.spec.ts`, `playwright.config.ts`                                         |
| Wdrożenie    | Produkcja i podglądy PR przez Vercel (integracja z GitHubem). `netlify.toml` w repo jest pozostałością.                                                                                          | [kod] repo; [rek] usunąć albo opisać `netlify.toml`                                            |

**Różnice względem propozycji:** brak nowych funkcji od `1999b06`. Nieaktualne: wzmianka o `netlify.toml` jako dystrybucji. Dodatkowo w toku są cztery poprawki spoza propozycji (zadania S0-05…S0-08 w backlogu): splasharty wg aktów, róż podłogi areny bossa, celowanie pod PPM przy broni palnej, przewracanie i wstawanie wrogów.

## 2. Cel półrocza

Publiczne demo przeglądarkowe w maju 2027: dopracowana walka, działająca kampania i bezpieczny zapis. **[rek]** Zakres bazowy 3 misje (Maszty, List przewozowy, Odlewnia), rozszerzenie do 5 (Punkt kontrolny, Ładunek klasy K) tylko po pozytywnych prototypach ratowania NPC i wagonu.

## 3. Założenia pojemności

- Człowiek: 15–20 h/tydz. → 30–40 h na sprint dwutygodniowy; planujemy **24–28 h** (70–75%), reszta to bufor na integrację, retesty i poprawki.
- Agenci: implementacja, testy, zrzuty i pomiary wg zleceń (skill `orkiestra`); **domyślnie jeden wykonawca naraz**. Praca agentów nie zastępuje oceny grywalności — każda bramka kończy się graniem człowieka.
- Estymacje w backlogu: **Cz** = godziny człowieka (projekt, granie, odbiór, decyzje), **Ag** = przybliżony rozmiar pracy agenta (S ≤ 1 zlecenie, M = 2–3 zlecenia, L = 4+).
- **Bez ram czasowych (decyzja właściciela 17 XI 2026):** etapy realizujemy po kolei, następny zaczyna się po bramce poprzedniego. Daty z propozycji nie obowiązują.

## 4. Etapy (kolejność)

| Etap    | Kolejność | Cel                                                     | Bramka na koniec                                                                         |
| ------- | --------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **S0**  | 1         | Domknięcie podstaw                                      | Bezpieczny zapis nagrody; playtesty F2/F4 zapisane; decyzje D1–D4; poprawki z S0 scalone |
| **S1**  | 2         | Kontrakt misji i kampanii                               | ADR 0008 (misje), schemat danych misji, stan kampanii w zapisie z migracją               |
| **S2**  | 3         | „Maszty” od odprawy do powrotu                          | Maszty do ukończenia bez debug; porażka/ponowienie/wczytanie bez zepsutego stanu         |
| **S2b** | 3b        | Tryby areny: Przejęcie (potem Szturm, Kradzież rdzenia) | Przejęcie grywalne z kryjówki, nagrody jak za run; decyzja właściciela 17 XI 2026        |
| **S3**  | 4         | „List przewozowy” (obrona)                              | Obrona strefy z postępem pobierania i czytelnym zatrzymaniem                             |
| **S4**  | 5         | „Odlewnia” + prototypy NPC i wagonu                     | 3 misje = wewnętrzne demo; raport kosztu prototypów                                      |
| **S4b** | 5b        | Osiągnięcia i naszywki Iskry                            | Osiągnięcia liczone, naszywki w kryjówce, bramki tylko na rzadkie odblokowania           |
| **S4c** | 5c        | Warsztat broni z widocznymi modułami                    | Sloty Wylot/Ogniwo/Optyka, element na modelu, podgląd 3D w kryjówce                      |
| **S5**  | 6         | Testy nowych graczy, tura 1                             | 4–6 osób, trzy najważniejsze problemy wybrane                                            |
| **S6**  | 7         | Poprawki + tura 2; warunkowo Punkt kontrolny            | Decyzja o „Ładunku klasy K”                                                              |
| **S7**  | 8         | Zawartość: narracja, kryjówka, audio                    | Konsekwencje w kryjówce po każdej misji dema                                             |
| **S8**  | 9         | Zamknięcie zakresu; warunkowo Ładunek klasy K           | Decyzja 3 vs 5 misji; od tej chwili nowe pomysły → backlog                               |
| **S9**  | 10        | Wydajność i niezawodność                                | Raport sprzętowy; godzinna sesja bez błędów                                              |
| **S10** | 11        | Czytelność i pierwsze minuty                            | Kandydat do wydania                                                                      |
| **S11** | 12        | Ostatnia tura testów, publikacja                        | Publiczne demo z numerem wersji                                                          |
| **S12** | 13        | Zgłoszenia i pierwsza aktualizacja                      | Priorytety zgłoszeń, aktualizacja 1                                                      |

Przejście do kolejnego etapu zależy wyłącznie od grywalnego wyniku bramki; gdy bramka nie przechodzi, najpierw poprawki. Kolejność zależności zostaje. Misje (S1–S4) idą od razu po domknięciu S0 (decyzja D1).

## 5. Zależności (kolejność, której nie zmieniamy)

```
S0 zapis nagrody ─┐
S0 playtest F2/F4 ┼─► S1 kontrakt misji ─► S2 Maszty ─► S3 List ─► S4 Odlewnia ─► S5/S6 testy graczy
S0 decyzje D1–D4 ─┘                                       S4 prototypy NPC/wagon ─► S6/S8 misje rozszerzone
S1 pomiar referencyjny ─────────────────────────────────────────────────────────► S9 wydajność
```

Splasharty wg aktu (S0-05) przechodzą na postęp kampanii, gdy powstanie S1-03 (jedna funkcja `unlockedSplashAct`).

## 6. Decyzje właściciela

| #   | Decyzja                                                                   | Rekomendacja                                                                             | Termin                      |
| --- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| D1  | Czy misje z `docs/fabula/misje` wchodzą do kodu (dotąd: tylko dokumenty). | Tak, od S1, zaczynając od kontraktu; pozostałe misje dalej tylko w dokumentach.          | koniec S0                   |
| D2  | Zakres dema: 3 czy 5 misji.                                               | 3 bazowe, 5 warunkowo po prototypach (S4) — decyzja ostateczna w S8.                     | wstępnie S0, ostatecznie S8 |
| D3  | Karta do Odlewni bez misji M5 „Adiutant”.                                 | Karta przekazana na odprawie jako wynik działania innego członka Iskry.                  | S1                          |
| D4  | Ocena bramek F2 i F4 po playtestach.                                      | Zapisać wyniki w `docs/playtest-F4.md` i README faz; akceptacja tylko przez właściciela. | koniec S0                   |
| D5  | Komputer referencyjny, rozdzielczość i profil jakości do pomiaru 60 FPS.  | Laptop średniej klasy właściciela, 1920×1080, profil „średni”.                           | S1                          |
| D6  | Zasady powtarzania misji (nagroda za pierwsze ukończenie vs kolejne).     | Pierwsze ukończenie: nagroda fabularna + waluta; kolejne: tylko zwykłe nagrody runu.     | S1                          |
| D7  | Wspierane przeglądarki demo.                                              | Chrome i Edge (desktop); Firefox „najlepiej jak się da”.                                 | S9                          |
| D8  | Build desktopowy / Steam w maju.                                          | Nie obiecywać; prototyp tylko przy zapasie w S10.                                        | S10                         |

## 7. Ryzyka

| Ryzyko                                                                       | Skutek                                      | Ograniczenie                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| Utrata nagrody przy błędzie zapisu                                           | Utrata zaufania testerów                    | S0-01 przed jakimikolwiek testami z ludźmi                          |
| Misje eskortowe i ratunkowe (pathfinding sojuszników, poruszający się wagon) | Przekroczenie harmonogramu                  | Prototypy w S4, wariant 3 misji jako bezpieczny                     |
| Brak pomiaru na sprzęcie                                                     | „60 FPS” niesprawdzone, przycięcia u graczy | D5 + raport w S1, powtórka w S9                                     |
| Zielone testy brane za akceptację                                            | Demo nudne mimo braku błędów                | Każda bramka = granie człowieka i zapis w playteście                |
| Zmiana zapisu (stan kampanii)                                                | Utrata postępu starych zapisów              | Migracja wersji + testy starych zapisów (S1-04)                     |
| Rozrost zakresu (nowe pomysły w trakcie)                                     | Brak czasu na testy                         | Od S8 nowe pomysły tylko do `backlog.md`; kolejność cięć z sekcji 8 |
| Wolne CI / niestabilne e2e                                                   | Spowolnione scalanie                        | Testy atomowe (jak `runBot.spec.ts`), shardy, semafor lokalnie      |

## 8. Co odkładamy i kolejność cięć

Poza półroczem: akty II i III, nowe dzielnice i bossowie, nieskończony freeplay, multiplayer, pełny dubbing, bronie bez wykazanej potrzeby, rozbudowa kryjówki niezwiązana z misjami.

Cięcia przy opóźnieniu, w tej kolejności: (1) dekoracje i poboczne interakcje, (2) scenki i warstwy audio, (3) druga misja eskortowa, (4) rozszerzenie 3 → 5 misji, (5) build desktopowy. Zapis, zrozumiałe cele, przyjemność walki i czas na testy graczy zostają zawsze.

## 9. Pierwszy etap (S0)

| Zadanie                                                                 | Kto            | Cz         | Ag  |
| ----------------------------------------------------------------------- | -------------- | ---------- | --- |
| S0-01 Bezpieczne rozliczenie runu po błędzie zapisu                     | agent + odbiór | 2          | M   |
| S0-02 Playtest F2: trzy czyste ścieżki na arenie                        | człowiek       | 4          | —   |
| S0-03 Playtest F4: 5 runów od zera                                      | człowiek       | 6          | —   |
| S0-04 Decyzje D1, D2 (wstępnie), D4                                     | właściciel     | 2          | —   |
| S0-05 Splasharty wg aktów (bez spoilerów)                               | agent + odbiór | 0,5        | S   |
| S0-06 Róż podłogi areny bossa                                           | agent + odbiór | 0,5        | S   |
| S0-07 Celowanie pod PPM z bronią palną                                  | agent + odbiór | 1,5        | M   |
| S0-08 Przewracanie i wstawanie wrogów                                   | agent + odbiór | 1,5        | M   |
| S0-09 Statusy w roadmapie i backlogu (gotowe i ocenione → … → odłożone) | agent          | 0,5        | S   |
| S0-10 Porządek wdrożenia: `netlify.toml`                                | agent          | 0,25       | S   |
| **Suma**                                                                |                | **≈ 19 h** |     |

S0-07 i S0-08 zmieniają odczucie walki, więc playtest F2 (S0-02) najlepiej zrobić **po** ich scaleniu.

## 10. Kolejne rundy (od 23 XI 2026)

Stan wyjściowy: kampania liniowa M01–M06 (akt I) + M07 w budowie, sojusznicy z AI i drużyna w trybach, warsztat-sklep z dodatkami, dialogi w trakcie misji, automat całego dema (`tests/e2e/demoPath.spec.ts`), wersja 0.9.0. Scenariusze: `docs/fabula/misje/` (20 misji, trzy akty). Podział pracy: Gracjan — pad, areny runów, interfejs, animacje wrogów, fizyka, wydajność (Rust); Mikołaj — misje, sojusznicy, warsztat, modele broni. Bez wersji mobilnej.

Zasada kolejności: **najpierw dopracowany kandydat dema z aktem I, potem akt II**. Każda runda kończy się bramką ze zdaniem „gotowe, gdy…”; 

**Zasada publikacji (decyzja właścicieli, 23 XI 2026):** nic nie wychodzi publicznie (demo, Next Fest, wczesny dostęp, 1.0), dopóki **obaj właściciele (Mikołaj i Gracjan) niezależnie nie uznają**, że gra jest gotowa do pokazania. W planie nie ma dat premiery — zamiast nich bramka „Zgoda na publikację”: lista kontrolna w `docs/kandydat-wydania.md` (feel walki, czytelność, brak błędów, wygląd każdej misji, pierwsze 10 minut, wydajność), którą obaj przechodzą, grając samodzielnie. Jedno „nie” = kolejna runda poprawek zamiast publikacji.

| Runda                                      | Zakres                                                                                                                                                                                                                                                                                                                          | Gotowe, gdy                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **R3** (w toku)                            | M05 „Adiutant” (pościg z limitem czasu — nowy cel czasowy), M07 „Nocny dyżur” (otwarcie aktu II), szlif: kompensator, jasność M04                                                                                                                                                                                               | Automat dema przechodzi M01–M07; zrzuty map ocenione                                                                                          |
| **R4 — kandydat dema**                     | Decyzja zakresu (rekomendacja: akt I M01–M06 + M07 jako zwiastun aktu II); ręczny playtest całej kampanii z drużyną (balans fal, eskorta M04, pościg M05); poprawki po playteście; S10-02 kandydat; S11-01: opis gry, krótki materiał z rozgrywki, strona zgłoszeń; zabójstwa w nagrodzie misji liniowych (`kills: 0`, backlog) | Nowa osoba przechodzi demo bez pomocy; publikacja tylko po „Zgodzie na publikację” obu właścicieli (do tego czasu link prywatny dla testerów) |
| **R5 — fundamenty aktu II**                | Prosty system wykrywania (stożek widzenia, alarm, poszukiwania) — potrzebny w M10 i M16, poprawi też M07; cel „pojmanie żywcem” (obezwładnienie zamiast zabicia) dla M09; motyw dzielnicy Bulwar/Taras (Helixa: chłodna biel, zieleń); warianty wrogów Helixy i „Rozstrojeni” (M08)                                             | Scena debug każdej mechaniki; M07 poprawiona wykrywaniem                                                                                      |
| **R6 — misje M08–M10**                     | Kwarantanna (przetrwanie i ewakuacja), Brat (pojmanie żywcem), Archiwum (kradzież i zniszczenie, skradanie)                                                                                                                                                                                                                     | Automat przechodzi M01–M10                                                                                                                    |
| **R7 — M11–M13 + boss Helixy**             | Nadajnik (obrona trzech węzłów — reużycie `defend`), Śluza (przeprawa na czas — reużycie celu czasowego z M05), Kamerton (odbicie więźniów + nowy boss Helixy, wzór: Brandt/Orbis, symulacja TTK bossa)                                                                                                                         | Koniec aktu II grywalny; boss przechodzi TTK i playtest                                                                                       |
| **R8 — build desktopowy i Steam (F7)**     | Prototyp Electron/Tauri (D8), strona Steam, trailer z misji aktu I–II, Steam Playtest; razem z Gracjanem: wydajność 60 FPS na laptopie referencyjnym (D5)                                                                                                                                                                       | Build instaluje się i uruchamia na czystym Windows; strona Steam gotowa do recenzji                                                           |
| **R9 — akt III: M14–M17**                  | Fundamenty: ruchoma platforma (reużycie `RailPayload` z M04), sabotaż sekwencyjny na czas, eskorta w infiltracji (wykrywanie z R5 + sojusznik); misje Palacz, Kamienna, Sala monitorów, Przerwa w dostawie                                                                                                                      | Automat przechodzi do M17                                                                                                                     |
| **R10 — M18–M20 i finał**                  | Strojenie (mini-boss Tymon), Pion (platforma w burzy), Cisza (finał — boss systemowy Orbis, reużycie `orbisDirector`); odblokowanie freeplay po kampanii                                                                                                                                                                        | Cała kampania 20 misji do przejścia; zakończenie                                                                                              |
| **R11 — polish i balans kampanii (F6/F7)** | Pełny playtest kampanii, krzywa trudności 20 misji, freeplay („godzina gry bez powtórek” — bramka F6), audio misji, ostatni szlif map                                                                                                                                                                                           | Bramki F6 i F7 z `docs/roadmap.md` zaliczone przez człowieka                                                                                  |

Ryzyka planu: wykrywanie (R5) to nowy system AI — jeśli wyjdzie słabo, M10 i M16 przechodzą na wariant bez skradania (jak M07 dziś); boss Helixy (R7) i finał (R10) to najdroższe pozycje; build desktopowy zależy od decyzji D8. Kolejność cięć przy braku czasu: R11 → R10 → R9 (akt III po premierze dema),  Cięcia zakresu nigdy nie obniżają jakości — lepiej mniej misji dopracowanych niż więcej przeciętnych.

### Rundy R12–R30 (kierunek po kampanii)

Od R12 plan jest kierunkiem, nie zobowiązaniem: kolejność i zakres potwierdza właściciel po danych z dema (R4) i z wczesnego dostępu. Pozycje pochodzą z `docs/backlog.md` („po premierze”), faz F6–F7 `docs/roadmap.md` i ścieżki wydania na Steam (demo → Next Fest → wczesny dostęp → 1.0).

| Runda                                                           | Zakres                                                                                                                                                                                               | Gotowe, gdy                                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **R12 — przygotowanie do Next Fest** (po Zgodzie na publikację) | Demo z aktu I na Steam (build z R8), ekran „lista życzeń”, telemetria lokalna z opt-in (gdzie gracze odpadają: misja, sekcja, przyczyna śmierci), szybkie poprawki po pierwszych recenzjach          | Demo na Steam stabilne, 0 znanych crashy, dane o odpadaniu zbierane     |
| **R13 — samouczek 2.0 i pierwsze minuty**                       | Samouczek wpleciony w M01 zamiast osobnej sceny, podpowiedzi kontekstowe (pierwsze parowanie, pierwsza moc, pierwszy dodatek), na podstawie telemetrii z R12                                         | ≥ 8/10 nowych graczy kończy M01 bez wychodzenia z gry                   |
| **R14 — freeplay: nieskończona strefa**                         | Sektory bez końca z rosnącym zagrożeniem, lokalna tabela wyników, mutatory z aren Gracjana w nieskończonej strefie; drużyna sojuszników dostępna                                                     | Bramka F6: godzina gry bez poczucia powtarzalności (playtest)           |
| **R15 — poligon i build-crafting**                              | Poligon: spawn wrogów, test DPS, podgląd statystyk buildu (dodatki, implanty, talenty); porównanie buildów w warsztacie                                                                              | Gracz umie sprawdzić build w 30 s bez wchodzenia do misji               |
| **R16 — sojusznicy 2.0**                                        | Rozwój członków drużyny (poziomy, 2 umiejętności na postać, wyposażenie), komendy (osłona, skup ogień, zostań), relacje w kryjówce po misjach                                                        | Drużyna zmienia sposób gry, nie tylko dodaje ogień (playtest)           |
| **R17 — arsenał 2.0**                                           | 2–3 nowe bronie z lukami w buildach, dodatki zmieniające działanie (rykoszet, przebicie, podpalenie jako moduły drugiej generacji), modele GLB nowych broni                                          | Każda ścieżka (Ostrze, Moc, Strzelec) ma ≥ 2 grywalne warianty end-game |
| **R18 — wczesny dostęp: przygotowanie**                         | Zapis w chmurze Steam (wybór platformy z R8), osiągnięcia Steam (mapowanie istniejących naszywek), ustawienia graficzne PC (FOV, jakość, skalowanie UI — z Gracjanem), stabilność zapisów i migracji | Checklisty Steam zaliczone; migracja zapisów od 0.9 bez strat           |
| **R19 — wczesny dostęp: premiera** (po Zgodzie na publikację)   | Akty I–II + freeplay jako zakres EA, strona i trailer EA, plan aktualizacji publiczny, kanał zgłoszeń                                                                                                | Premiera EA bez blokujących błędów w 72 h                               |
| **R20 — aktualizacja EA 1**                                     | Najczęstsze zgłoszenia, balans na danych z telemetrii, jakość życia (szybszy restart misji, pomijanie przerywników)                                                                                  | Ocena „przeważnie pozytywna” utrzymana; top 10 zgłoszeń zamknięte       |
| **R21 — akt III w EA**                                          | Wydanie misji M14–M20 z R9–R10 jako aktualizacja treści, finał kampanii                                                                                                                              | Kampania 20 misji dostępna w EA                                         |
| **R22 — kolejna dzielnica**                                     | Nowa dzielnica Neo-Rydu (motyw, 6–8 modułów pokoi, nowe areny runów — z Gracjanem), wrogowie lokalni                                                                                                 | Run i freeplay losują nową dzielnicę                                    |
| **R23 — wyzwania i tryby**                                      | Tryb wyzwań z codziennym seedem rozszerzony (tygodniowe mutatory), tryb speedrun z timerem misji (bez duchów), rankingi lokalne                                                                      | Tryby mają własne cele i nagrody kosmetyczne                            |
| **R24 — kosmetyki**                                             | Skórki ostrza i neonów broni, wygląd drużyny, odblokowywane w grze (bez mikropłatności w EA)                                                                                                         | ≥ 20 kosmetyków odblokowywanych przez osiągnięcia                       |
| **R25 — lokalizacja**                                           | Wydzielenie wszystkich tekstów do plików językowych, wersja angielska (UI, dialogi, misje), sprawdzenie długości tekstów w UI                                                                        | Gra w pełni grywalna po angielsku                                       |
| **R26 — zakończenia alternatywne**                              | Wybory w aktach II–III wpływające na finał (2–3 zakończenia), konsekwencje w kryjówce                                                                                                                | Dwa przejścia kampanii dają różne zakończenia                           |
| **R27 — replay i QA**                                           | Deterministyczny zapis przebiegu z seeda (replay do zgłoszeń błędów i analizy balansu), boty grające całe misje w CI                                                                                 | Zgłoszenie błędu może dołączyć replay odtwarzający problem              |
| **R28 — 1.0: zamknięcie zakresu**                               | Zamrożenie funkcji, pełny balans kampanii i freeplay, wydajność na sprzęcie minimalnym, dostępność (napisy, tryb fotoczułości, remapowanie, pad — z Gracjanem)                                       | Lista blokujących 1.0 pusta                                             |
| **R29 — premiera 1.0** (po Zgodzie na publikację)               | Trailer premierowy, materiały prasowe, wersja 1.0 na Steam                                                                                                                                           | Premiera bez błędów blokujących; plan wsparcia na 3 miesiące            |
| **R30 — po premierze**                                          | Decyzja o dalszej drodze na danych: DLC fabularne (akt IV), tryb kooperacji 2 graczy (wymaga architektury sieciowej — osobna analiza), konsole                                                       | Decyzja właściciela zapisana w ADR                                      |

Poza planem do odwołania (z backlogu): edytor poziomów i mody, VR, tabele online wymagające backendu — wracają tylko po osobnej decyzji.
