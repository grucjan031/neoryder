# NEORYDER — Roadmapa dla agentów AI

Nov 13, 2026 · @Gracjan

## Wizja i filary

NEORYDER to FPP roguelite w świecie cyberpunk, w którym każdy run kończy się trwałym postępem postaci, a sercem gry jest bardzo satysfakcjonująca walka. Gracz jest agentem komórki ruchu oporu walczącej z Koalicją wielkich korporacji.

**Pitch w jednym zdaniu:** ostrze plazmowe, blaster i moce w ręku, nocne neonowe miasto z czytelnymi czerwonymi wrogami, a każda śmierć czyni cię silniejszym.

**Cztery filary (każda decyzja agenta musi wspierać przynajmniej jeden):**

1. **Walka, która „czuje się” świetnie** — hitstop, rozpad wrogów na odłamki, parowanie strzałów ostrzem, czytelny feedback dźwiękowy i kamerowy.
2. **Build-crafting** — trzy główne ścieżki (Ostrze, Moc, Strzelec) i hybrydy z synergiami między nimi.
3. **Trwała progresja** — poziom, drzewka i odblokowania zostają po śmierci; run daje dodatkowo tymczasowe implanty, które budują napięcie.
4. **Czytelny styl wizualny** — Neon Noir (ADR 0006): nocne, deszczowe cyberpunkowe uliczki w stylizowanych, czytelnych bryłach z konturem; otoczenie ciemne i chłodne z neonami w kolorach bursztynu, zieleni, fioletu, błękitu i ciepłej bieli. Czerwień (wrogowie), cyan (gracz) i magenta (Rezonans) są zarezerwowane i nie występują w otoczeniu; obiekty interaktywne są jasne. Czytelność walki ponad efekty; Superhot zostaje inspiracją w czytelności ról obiektów, nie w kolorze świata.

**Tryby gry:**

- **Kryjówka (hub)** — drzewka, sklep z modułami, wybór misji, NPC ruchu oporu.
- **Misje** — krótkie zadania fabularne z celami (sabotaż, odbicie więźnia, likwidacja dyrektora).
- **Freeplay** — nieskończona strefa, areny z mutatorami, poligon do testowania buildów.

**Uwaga prawna:** inspiracje Star Wars i Superhot są OK, ale agenci nie używają nazw chronionych (Jedi, Sith, lightsaber, „the Force”). Własne nazwy: *ostrze plazmowe*, *Rezonans* (moc), *Rezonanci* (użytkownicy mocy).

## Decyzje techniczne

Wybrany stack: **TypeScript + Three.js + Rapier**. Gra działa w przeglądarce od pierwszego dnia, a na Steam trafi później jako aplikacja desktopowa (Electron albo Tauri).

| Warstwa | Narzędzie | Po co |
| --- | --- | --- |
| Język | TypeScript (tryb strict) | Typy pilnują, żeby kod różnych agentów do siebie pasował |
| Build i dev server | Vite | Przeładowanie gry na żywo, szybki build |
| Grafika | Three.js (WebGL2) | Scena, kamera, shader Superhot, postprocessing |
| Fizyka | Rapier (`@dimforge/rapier3d-compat`, WASM) | Kolizje, character controller, odłamki, rzucanie obiektami |
| Modele i poziomy | Blender → glTF (.glb) | Moduły pokoi, wrogowie, rekwizyty |
| Audio | Web Audio API (np. Howler.js) | SFX z wariacjami, muzyka, dźwięk przestrzenny |
| UI | HTML/CSS na warstwie nad canvasem | HUD, menu, hub, ekrany nagród |
| Testy | Vitest (logika) + Playwright (gra w przeglądarce) | Testy jednostkowe i „boty” klikające grę z zrzutami ekranu |
| Debug | lil-gui + stats.js | Panel strojenia liczb na żywo, licznik FPS |
| Publikacja | itch.io / Netlify, później Electron/Tauri na Steam | Link do gry zamiast instalacji |

**Zasady architektury (do AGENTS.md):**

- **Symulacja oddzielona od renderu** — logika gry i Rapier w stałym kroku 60 Hz, Three.js tylko rysuje stan (z interpolacją). Dzięki temu logikę testuje się w Vitest bez przeglądarki.
- **Data-driven** — bronie, moce, wrogowie, implanty, węzły drzewek i misje to pliki JSON w `/src/data`, walidowane schematem (zod). Nowa broń = nowy plik danych, nie nowy kod.
- **Komponenty** — `Health`, `Hitbox`, `Hurtbox`, `Stats`, `StatusEffects` składane w encje (lekki ECS lub kompozycja klas).
- **System modyfikatorów statystyk** — każdy bonus to `StatModifier {stat, typ: flat/percent/mult, źródło}`; jedno miejsce liczenia wartości.
- **Typowany EventBus** — zdarzenia typu `enemy_killed`, `parry_success`, `power_used`, pod które podpinają się synergie, UI, audio i statystyki.
- **Seedowany RNG** — każdy run ma seed; błąd da się odtworzyć.
- **Zapis z wersją** — IndexedDB z polem `saveVersion` i migracjami, osobno meta-progres i stan runu; ustawienia w localStorage.
- **Wszystkie liczby „feel” w `tuning.ts`** (hitstop, okno parowania, siła odrzutu) i podpięte pod panel lil-gui, żebyś stroił w trakcie gry.
- **Pułapki przeglądarki w jednym miejscu** — pointer lock, odblokowanie audio po kliknięciu, pauza przy utracie fokusu, obsługiwane w `/src/core/input` i `/src/audio`.
- **Wydajność od początku** — pooling pocisków i odłamków, `InstancedMesh` dla powtarzalnych obiektów, limit ciał fizycznych.
- **Konsola debug i cheaty** — spawn wroga, dodaj walutę, odblokuj wszystko.

**Struktura repo:**

```
/docs          GDD, specyfikacje systemów, decyzje (ADR), api.md
/src
  /core        pętla gry, eventbus, rng, stats, save, input, tuning.ts
  /render      scena Three.js, kamera, shader Superhot, postprocess
  /physics     świat Rapier, warstwy kolizji, character controller
  /player      kontroler FPP, ruch
  /combat      melee, weapons, powers, damage
  /enemies     AI, archetypy, bossowie
  /progression drzewka, implanty, waluty
  /world       generator sektorów, pokoje, misje
  /ui          HUD, menu, hub (HTML/CSS)
  /vfx /audio  cząsteczki, odłamki, dźwięki
  /data        JSON: bronie, moce, wrogowie, implanty, misje
/public/assets modele .glb, dźwięki, tekstury
/tests
  /unit        Vitest
  /e2e         Playwright
AGENTS.md      zasady dla agentów
```

**Narzędzia:** VS Code, Git + GitHub (issues = zadania agentów, PR = wynik), ESLint + Prettier, GitHub Actions uruchamiające `typecheck`, Vitest i Playwright, podgląd każdego PR pod własnym linkiem (Netlify lub Vercel) — każdą zmianę agenta ogrywasz w przeglądarce przed merge. Assety CC0 (Kenney, Quaternius) jako placeholdery.

## Zespół agentów

Trzynastu wyspecjalizowanych agentów, każdy właścicielem jednego folderu; Ty jesteś dyrektorem kreatywnym i jedyną osobą, która ocenia „feel”.

| Agent | Odpowiada za | Folder | Startuje od fazy |
| --- | --- | --- | --- |
| Producent (orkiestrator) | Rozbija roadmapę na issues, pilnuje kolejności i zależności | /docs, GitHub | F0 |
| Architekt | Core, pętla gry, typy i API między modułami, code review każdego PR | /src/core | F0 |
| Ruch i kamera | Kontroler FPP na Rapier, dash, slide, skoki, kamera, FOV | /src/player, /src/physics | F1 |
| Walka wręcz | Ostrze plazmowe: combo, blok, parowanie, hitstop | /src/combat/melee | F1 |
| Moce | Rezonans: pchnięcie, chwyt, błyskawica, energia | /src/combat/powers | F1 |
| Bronie | Blastery, przegrzanie, pociski, moduły broni | /src/combat/weapons | F1 |
| AI wrogów | Archetypy, zachowania, koordynacja grupy, bossowie | /src/enemies | F1 |
| Grafika, VFX i audio | Shader Superhot, postprocess, odłamki, cząsteczki, SFX | /src/render, /src/vfx, /src/audio | F1 |
| Progresja i ekonomia | Drzewka, implanty, waluty, zapis meta-progresu | /src/progression | F3 |
| Świat i generator | Sektory, pokoje, seedy, struktura runu, freeplay | /src/world | F3 |
| UI/UX | HUD, menu, hub, ekrany wyboru nagród (HTML/CSS) | /src/ui | F2 |
| Fabuła i misje | Lore, frakcje, dialogi, definicje misji (JSON) | /src/data/missions | F5 |
| QA i balans | Vitest, Playwright, boty, symulacje DPS, raporty regresji | /tests | F0 |

**Zasady współpracy:**

1. **Jedno zadanie = jedno issue = jeden PR.** PR nie dotyka folderów innego agenta bez zgody Architekta.
2. **Kontrakt przed kodem.** Jeśli moduł potrzebuje czegoś od innego, agent najpierw dopisuje interfejs/sygnał do `/docs/api.md`, Architekt zatwierdza.
3. **Każdy PR ma testy** i przechodzi CI w trybie headless.
4. **Specyfikacja w /docs jest źródłem prawdy.** Agent, który zmienia zachowanie systemu, aktualizuje jego dokument w tym samym PR.
5. **Bramki ludzkie.** Na koniec każdej fazy grasz 15–30 minut i spisujesz uwagi; agenci nie przechodzą do kolejnej fazy bez Twojego „OK”.
6. **Małe moduły.** Jeden folder = jeden właściciel, a wspólne typy w /src/core zmienia tylko Architekt.

W praktyce nie musisz uruchamiać 12 agentów naraz. Na start wystarczą 3 równoległe sesje: Architekt, Gameplay (ruch + walka) i QA.

## Roadmapa fazami

Osiem faz od fundamentów do demo na Steam, ok. 9–12 miesięcy przy 15–20 h tygodniowo Twojej pracy; najważniejsza bramka to F1 — jeśli walka nie jest fun na jednej arenie, nic dalej nie ma sensu.

| Faza | Cel | Czas | Bramka wyjścia |
| --- | --- | --- | --- |
| F0 Fundamenty | Repo, zasady, szkielet projektu | 1–2 tyg. | CI zielone, pusta scena działa w przeglądarce |
| F1 Prototyp walki | Jedna arena, która jest fun | 4–5 tyg. | Chcesz zagrać „jeszcze raz” |
| F2 Arsenał | 3 ścieżki buildów grywalne | 5–6 tyg. | Każda ścieżka wygrywa na arenie |
| F3 Pętla runu | Sektory, nagrody, boss, śmierć | 4 tyg. | Pełny run 15–25 min |
| F4 Meta-progres | Drzewka, waluty, zapis, hub | 4 tyg. | Po 5 runach czuć wzrost siły |
| F5 Misje i fabuła | Zadania fabularne, frakcje | 4–5 tyg. | 5 misji od początku do końca |
| F6 Freeplay | Nieskończona strefa, areny, poligon | 3 tyg. | Godzina gry bez powtórek |
| F7 Polish i demo | Balans, audio, UI, wydajność, Steam | 6–8 tyg. | Publiczne demo / Steam Playtest |

### F0 — Fundamenty

- **Producent:** GDD w `/docs/gdd.md` z filarami z tego dokumentu; issues dla F0–F1.
- **Architekt:** projekt Vite + TypeScript strict, Three.js i Rapier, pętla gry ze stałym krokiem, struktura folderów, `AGENTS.md`, EventBus, `Stats` + `StatModifier`, seedowany RNG, szkielet zapisu w IndexedDB, `tuning.ts` z panelem lil-gui.
- **QA:** Vitest, Playwright, GitHub Actions, podgląd każdego PR pod linkiem, szablon PR.
- **Gotowe gdy:** CI zielone, pusta scena z podłogą i kostką Rapier działa pod linkiem, każdy agent ma opisany swój folder.

### F1 — Prototyp walki (vertical slice „feel”)

- **Ruch:** kontroler FPP (bieg, sprint, dash, slide, podwójny skok), coyote time, buforowanie inputów.
- **Walka wręcz:** ostrze plazmowe — 3-hitowe combo, ciężki atak, blok, parowanie z oknem ok. 150 ms odbijające strzały w strzelca.
- **Bronie:** jeden blaster z przegrzewaniem zamiast amunicji.
- **Moce:** jedna moc — Pchnięcie Rezonansu — z paskiem energii.
- **AI:** 2 archetypy — Szturmowiec (wręcz) i Strzelec.
- **VFX/audio:** shader Superhot (biały świat, czerwoni wrogowie), rozpad wroga na odłamki, hitstop 40–80 ms, wstrząs kamery, dźwięki trafień.
- **Gotowe gdy:** arena z falami wrogów; grasz 15 minut i chcesz kolejną rundę. Tu zatrzymaj się i stroj `tuning.ts`, aż będzie dobrze — to najważniejszy tydzień projektu.

### F2 — Arsenał i ścieżki buildów

- **Bronie:** 5–6 typów (pistolet, karabin, rozpraszacz, snajperka, ciągły laser, granat EMP).
- **Moce:** 6–8 mocy (Pchnięcie, Chwyt i rzut, Błyskawica, Fala uderzeniowa, Bariera, Skupienie — spowolnienie czasu).
- **Walka wręcz:** rzut ostrzem, dash-cięcie, warianty ostrzy (podwójne, dwustronne).
- **AI:** 5–6 archetypów + koordynacja grupy (flankowanie, ostrzał zaporowy).
- **Systemy:** efekty statusów (podpalenie, przeciążenie, ogłuszenie), zasób energii, HUD.
- **QA/balans:** symulacja TTK dla każdej broni i mocy vs każdy wróg, raport w `/docs/balance.md`.
- **Gotowe gdy:** czysty build Ostrza, Mocy i Strzelca każdy przechodzi arenę i gra się wyraźnie inaczej.

### F3 — Pętla runu (roguelite)

- **Świat:** generator sektorów z pokojów ręcznie zrobionych (moduły), mapa wyboru ścieżki, typy pokoi: walka, elita, sklep, odpoczynek, zagadka.
- **Progresja:** implanty per-run (wybór 1 z 3 po pokoju), rzadkości, synergie zależne od tagów.
- **AI:** pierwszy boss (dyrektor ochrony korporacji).
- **UI:** ekran wyboru nagród, ekran podsumowania runu.
- **Gotowe gdy:** pełny run 15–25 min z bossem; śmierć wraca do menu z podsumowaniem.

### F4 — Meta-progres i kryjówka

- **Progresja:** trwały poziom postaci, 3 drzewka + węzły hybrydowe, waluta trwała (Dane) i rzadka (Rdzenie), odblokowania broni i mocy.
- **Zapis:** meta-progres zapisywany po każdym runie, migracje wersji.
- **Świat/UI:** kryjówka ruchu oporu jako grywalny hub: terminal drzewek, warsztat modułów, tablica misji.
- **Balans:** „Poziom zagrożenia” — trudność rośnie razem z siłą gracza i daje lepsze nagrody.
- **Gotowe gdy:** po 5 runach czuć progres, ale gra nadal stawia opór.

### F5 — Misje i fabuła

- **Fabuła:** 3 korporacje Koalicji, każda z własną stylistyką wrogów i bossem; kilka NPC w kryjówce; prosty łuk fabularny.
- **Świat:** system misji oparty na danych — cele (sabotaż, odbicie więźnia, eskorta, obrona, likwidacja), warunki, nagrody.
- **UI:** dziennik zadań, krótkie dialogi (tekst + portret).
- **Gotowe gdy:** 5 misji fabularnych od początku do końca, każda używa innego celu.

### F6 — Freeplay

- **Nieskończona strefa** — sektory bez końca, rosnące zagrożenie, tabela wyników lokalna.
- **Areny wyzwań** — mutatory (tylko ostrze, podwójna prędkość, jeden hit = śmierć), codzienny seed.
- **Poligon** — spawnowanie wrogów, test DPS, podgląd statystyk buildu.
- **Gotowe gdy:** godzina gry w freeplayu bez poczucia powtarzalności.

### F7 — Polish, balans i demo

- Ustawienia (czułość, FOV, klawiszologia, dostępność), muzyka, optymalizacja (pooling odłamków i pocisków), samouczek.
- QA: boty grane przez skrypty, testy wydajności, raport crashy.
- Build desktopowy (Electron lub Tauri), strona na Steam, trailer, demo, Steam Playtest.
- **Gotowe gdy:** 60 FPS w Chrome na średnim laptopie, 0 znanych crashy, demo publicznie dostępne.

## Specyfikacja kluczowych systemów

Te opisy agenci rozwijają w osobne pliki `/docs/systems/*.md`; liczby to wartości startowe do strojenia, nie ostateczne.

### Game feel (obowiązkowe dla każdego trafienia)

- Hitstop 40 ms (lekki atak) – 80 ms (ciężki, zabójstwo), wstrząs kamery skalowany obrażeniami.
- Wróg po śmierci rozpada się na czerwone odłamki z fizyką (Superhot), kierunek zgodny z ciosem.
- Każda akcja ma 3 warstwy feedbacku: obraz (VFX), dźwięk, kamera/kontroler.
- Zabójstwo ostatniego wroga w fali = krótkie spowolnienie czasu (0,3 s).

### Ostrze plazmowe (ścieżka Ostrze)

| Akcja | Opis | Wartość startowa |
| --- | --- | --- |
| Combo lekkie | 3 ciosy, ostatni z odrzutem | 25 / 25 / 40 obrażeń |
| Ciężki atak | Przytrzymanie, przebija blok | 80 obrażeń, 0,6 s |
| Blok | Redukuje obrażenia, zużywa energię | −70% obrażeń |
| Parowanie | Blok w oknie czasowym odbija pocisk w strzelca | okno 150 ms |
| Rzut ostrzem | Bumerang, wraca do ręki | 50 obrażeń, 1,2 s |
| Dash-cięcie | Doskok do celu z cięciem | zasięg 8 m |

### Rezonans — moce (ścieżka Moc)

- **Zasób:** Energia 100 pkt, regeneracja po 2 s bez użycia; parowanie i zabójstwa wręcz też ją ładują.
- **Moce startowe:** Pchnięcie (stożek, odrzut w ściany = dodatkowe obrażenia), Chwyt i rzut (wrogowie i obiekty), Błyskawica (przeskakuje między celami), Fala uderzeniowa (wokół gracza), Bariera (odbija pociski przez 2 s), Skupienie (spowolnienie czasu na 3 s).
- Każda moc ma 2–3 ulepszenia w drzewku zmieniające działanie, nie tylko liczby (np. Pchnięcie zostawia pole elektryczne).

### Bronie laserowe (ścieżka Strzelec)

- **Przegrzanie zamiast amunicji:** pasek ciepła, przegrzanie = 1,5 s blokady; aktywne chłodzenie w idealnym momencie (jak active reload) daje bonus.
- **Typy:** pistolet, karabin, rozpraszacz, snajperka (przebija wrogów), ciągły laser, granaty EMP.
- **Moduły:** 2 sloty na broń (rykoszet, przebicie, podpalenie, pociski nadprzewodzące).
- Pociski wrogów są wolne i widoczne (styl Superhot), żeby parowanie i uniki były czytelne.

### Synergie hybrydowe (przykłady)

- **Pistolero Rezonansu:** zabójstwo mocą natychmiast schładza broń.
- **Tancerz ostrzy:** każde udane parowanie daje 10 energii i skraca odnowienie dasha.
- **Burzowy strzelec:** strzały w wroga pod Błyskawicą przeskakują na kolejny cel.
- Synergie działają na tagach (`#melee`, `#power`, `#gun`, `#elektryczność`), żeby agenci dodawali nowe bez kodu specjalnego.

### Progresja

| Warstwa | Co zostaje po śmierci | Przykład |
| --- | --- | --- |
| Poziom postaci | Tak | Punkty talentów do drzewek |
| Drzewka (Ostrze / Moc / Strzelec + hybrydy) | Tak | Nowa umiejętność, wariant mocy |
| Odblokowania | Tak | Nowa broń w puli, nowa moc |
| Waluta Dane | Tak | Zakupy w warsztacie |
| Implanty | Nie (per run) | +30% obrażeń przy pełnej energii |
| Moduły znalezione w runie | Nie, chyba że wydobyte | Rykoszet do blastera |

Zasada: trwały progres daje głównie **nowe opcje**, a w mniejszym stopniu surową siłę — inaczej gra szybko robi się za łatwa. Poziom zagrożenia skaluje trudność w górę.

### Wrogowie Koalicji

| Archetyp | Rola | Kontra |
| --- | --- | --- |
| Szturmowiec | Pałka elektryczna, napiera | Combo, Pchnięcie |
| Strzelec | Ostrzał z dystansu | Parowanie, osłona |
| Snajper | Laser celujący, duże obrażenia | Dash, Bariera |
| Dron | Szybki, lata, mało HP | Błyskawica, broń auto |
| Tarczownik | Tarcza z przodu | Ciężki atak, flank, Chwyt |
| Egzekutor (elita) | Ma własne ostrze, paruje | Moce, strzały w przerwach |
| Boss korporacji | Unikalny dla frakcji | Wzorce faz |

### Tryby

- **Misje:** cel + warunek + nagroda w pliku danych; misje fabularne odblokowują kolejne strefy i NPC.
- **Freeplay:** nieskończona strefa, areny z mutatorami, codzienny seed, poligon.
- **Kryjówka:** hub z terminalem drzewek, warsztatem, tablicą misji i postaciami ruchu oporu.

## Szablon zadania i definicja ukończenia

Każde zadanie dla agenta to issue w tym formacie — im precyzyjniejsze kryteria, tym mniej poprawek.

```markdown
# [F1][Walka wręcz] Parowanie pocisków ostrzem

Agent: Walka wręcz
Folder: /src/combat/melee
Zależy od: #12 (Hurtbox), #15 (pociski wrogów)
Filar: Walka, która „czuje się” świetnie

## Cel
Gracz wciskający blok w oknie czasowym odbija pocisk w kierunku strzelca.

## Wymagania
- Okno parowania czytane z tuning.ts (domyślnie 150 ms), widoczne w panelu lil-gui
- Odbity pocisk zmienia właściciela na gracza i leci do źródła
- Zdarzenie EventBus: parry_success { projectile, attacker }
- Feedback: hitstop 60 ms, błysk, dźwięk parry

## Kryteria akceptacji
- [ ] Vitest: parowanie w oknie odbija, poza oknem nie
- [ ] Vitest: odbity pocisk zadaje obrażenia strzelcowi
- [ ] Scena debug ?scene=parry-test w podglądzie PR
- [ ] Aktualizacja /docs/systems/melee.md

## Poza zakresem
Parowanie ataków wręcz (osobne issue)
```

**Definicja ukończenia (każdy PR):**

- [ ] CI zielone (typecheck, ESLint, Vitest, Playwright)
- [ ] Nowe wartości liczbowe w plikach danych lub `tuning.ts`, nie w kodzie
- [ ] Dokument systemu zaktualizowany
- [ ] Review Architekta zatwierdzone
- [ ] Link do podglądu PR pozwala sprawdzić zmianę w 30 sekund
- [ ] Opis PR mówi, co przetestować ręcznie i na co zwrócić uwagę w „feel”

## Ryzyka

Największe ryzyko to rozrost zakresu: gra ma 3 ścieżki, 3 tryby i fabułę, a jeden człowiek z agentami realnie dowiezie małe, dopracowane demo.

| Ryzyko | Skutek | Jak zapobiegać |
| --- | --- | --- |
| Rozrost zakresu | Nic nie jest skończone | Bramki faz, lista „po premierze” w /docs, Producent odrzuca zadania spoza fazy |
| Agenci nie czują „feel” | Walka technicznie poprawna, ale nudna | Twoje playtesty na końcu faz, wszystkie liczby w `tuning.ts` |
| Dryf architektury | Każdy agent pisze po swojemu | AGENTS.md, review Architekta, kontrakty w /docs/api.md |
| Konflikty w kodzie | Rozjechane typy i importy po merge | Małe moduły, jeden właściciel, strict TypeScript, PR-y jeden po drugim w danym folderze |
| Trwały progres psuje trudność | Po 10 h gra jest za łatwa | Progres = nowe opcje, Poziom zagrożenia, symulacje balansu |
| Słabe modele 3D | Gra wygląda amatorsko | Styl Superhot wybacza: low-poly, płaski shading, assety CC0 |
| Wydajność przy odłamkach | Spadki FPS w dużych falach | Pooling, InstancedMesh, limit odłamków i ciał Rapier, test FPS w Playwright |
| Naruszenie IP Star Wars | Problemy przy publikacji na Steam | Własne nazwy i wygląd, zakaz nazw chronionych w AGENTS.md |

## Pierwsze 2 tygodnie

Cel: skończyć F0 i mieć pierwszy ruch postaci na szarej arenie.

**Tydzień 1 — fundamenty**

- [ ] Załóż repo na GitHubie i projekt Vite + TypeScript + Three.js + Rapier
- [ ] Napisz z agentem `AGENTS.md` (zasady z sekcji „Zespół agentów” i „Decyzje techniczne”)
- [ ] Producent: `/docs/gdd.md` na bazie tego dokumentu + issues dla F0 i F1
- [ ] Architekt: struktura folderów, EventBus, StatsComponent, RNG, `tuning.ts`
- [ ] QA: Vitest + Playwright + GitHub Actions, podgląd każdego PR pod linkiem

**Tydzień 2 — pierwszy ruch**

- [ ] Ruch: kontroler FPP na character controllerze Rapier (bieg, sprint, skok, dash) z pointer lock na szarej arenie testowej
- [ ] VFX: pierwsza wersja shadera Superhot (białe otoczenie, czerwone manekiny)
- [ ] Walka wręcz: placeholder ostrza z jednym ciosem i hitboxem
- [ ] Konsola debug: spawn manekina, reset areny
- [ ] Twój playtest 15 min i lista uwag do poruszania się
