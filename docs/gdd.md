# NEORYDER — Game Design Document

Wersja robocza 0.1 · Producent · źródła: `docs/roadmap.md`, `AGENTS.md`, `docs/api.md`. Wszystkie liczby to **wartości startowe do strojenia** (docelowo w `src/core/tuning.ts` lub plikach `src/data/`), nie ostateczne.

## 1. Wizja i pitch

NEORYDER to FPP roguelite w świecie cyberpunk. Gracz jest agentem komórki ruchu oporu walczącej z Koalicją wielkich korporacji. Każdy run kończy się trwałym postępem, a sercem gry jest bardzo satysfakcjonująca walka.

**Pitch w jednym zdaniu:** ostrze plazmowe, blaster i moce w ręku, biało-czerwony świat, a każda śmierć czyni cię silniejszym.

**Dla kogo:** gracze lubiący krótkie, intensywne sesje (run 15–25 min), szybkie FPS-y i roguelite z buildami (Hades, Ultrakill, Risk of Rain w roli odniesienia dla pętli, nie kopiowania).

**Platforma:** przeglądarka (Chrome) od pierwszego dnia, później aplikacja desktopowa na Steam.

## 2. Filary projektu

Każda decyzja musi wspierać co najmniej jeden filar.

| # | Filar | Co to znaczy w praktyce | Test decyzji |
| --- | --- | --- | --- |
| 1 | Walka, która „czuje się” świetnie | Hitstop, rozpad wrogów na odłamki, parowanie ostrzem, 3 warstwy feedbacku (obraz, dźwięk, kamera) | Czy trafienie da się „poczuć” z zamkniętymi oczami? |
| 2 | Build-crafting | 3 ścieżki (Ostrze, Moc, Strzelec) i hybrydy z synergiami na tagach | Czy zmienia to sposób gry, a nie tylko liczby? |
| 3 | Trwała progresja | Poziom, drzewka i odblokowania zostają; implanty są tymczasowe | Czy po śmierci gracz ma powód do „jeszcze jednego runu”? |
| 4 | Czytelny styl wizualny | Biały płaski świat, czerwoni wrogowie, czarne obiekty interaktywne, cyan/magenta dla gracza i mocy | Czy w 0,2 s widać, kto jest kim i co jest groźne? |

## 3. Pętla rozgrywki

### Minuta (moment do momentu)
1. Gracz wchodzi do pokoju, ocenia wrogów (kolor = zagrożenie, pociski wolne i widoczne).
2. Manewruje (bieg, sprint, dash, slide, podwójny skok) i wybiera narzędzie: ostrze, blaster, moc.
3. Trafienie → hitstop → rozpad na odłamki → ładowanie zasobu (energia z parowania i zabójstw wręcz).
4. Ostatni wróg fali → spowolnienie czasu 0,3 s → chwila oddechu.

### Run (15–25 min)
1. Start z kryjówki z wybranym buildem i bazowym zestawem.
2. Sektor złożony z pokojów: walka, elita, sklep, odpoczynek, zagadka; mapa wyboru ścieżki.
3. Po pokoju wybór 1 z 3 implantów (rzadkości, synergie na tagach).
4. Boss korporacji; śmierć lub zwycięstwo → ekran podsumowania → powrót do kryjówki.

### Meta (godziny)
1. Poziom postaci daje punkty talentów do drzewek (Ostrze / Moc / Strzelec + węzły hybrydowe).
2. Waluty: **Dane** (trwała, zakupy w warsztacie) i **Rdzenie** (rzadka, odblokowania).
3. Odblokowania nowych broni i mocy w puli runu.
4. **Poziom zagrożenia** rośnie razem z siłą gracza i daje lepsze nagrody.

Zasada: trwały progres daje głównie **nowe opcje**, w mniejszym stopniu surową siłę.

## 4. Sterowanie (propozycja, do ustalenia w F1)

Mapowanie w danych, zgodne z typem `Action` z `docs/api.md`. Ustawienia (czułość, klawisze) dopiero w F7.

| Akcja (`Action`) | Klawisz / mysz | Uwagi |
| --- | --- | --- |
| `moveForward/Back/Left/Right` | W / S / A / D | |
| `jump` | Spacja | podwójny skok, coyote time, bufor inputu |
| `sprint` | Shift (trzymanie) | |
| `dash` | Q | krótki doskok, odnowienie |
| `crouch` | Ctrl | w biegu = slide |
| `attack` | LPM | atak/strzał; ostrze: combo 3 ciosów, przytrzymanie = ciężki atak |
| `block` | PPM | wciśnięcie w oknie 150 ms = parowanie |
| `swap` | R | zamiana ostrze/broń w bieżącym slocie |
| `power` | F | Pchnięcie Rezonansu |
| pauza | Esc | pointer lock i fokus obsługuje `src/core/input/` |

Gracz trzyma jeden przedmiot: ostrze albo broń. PPM natychmiast przywraca ostrze i blok, środkowy przycisk przywraca ostrze i rzuca. 1/2/3 wybierają slot broni i żądają jej dobycia. F/E działają niezależnie od ręki.

## 5. Trzy ścieżki buildów i hybrydy

| Ścieżka | Tożsamość | Główny zasób | Startowe narzędzia (F1) |
| --- | --- | --- | --- |
| **Ostrze** | Walka wręcz, rytm, parowanie | Energia (blok, parowanie) | Ostrze plazmowe |
| **Moc (Rezonans)** | Kontrola pola walki, kombinacje | Energia | Pchnięcie Rezonansu |
| **Strzelec** | Dystans, zarządzanie ciepłem | Ciepło | Blaster z przegrzaniem |

### Ostrze plazmowe (wartości startowe)
| Akcja | Opis | Wartość |
| --- | --- | --- |
| Combo lekkie | 3 ciosy, ostatni z odrzutem | 25 / 25 / 40 obrażeń |
| Ciężki atak | Przytrzymanie, przebija blok | 80 obrażeń, 0,6 s |
| Blok | Redukuje obrażenia, zużywa energię | −70% obrażeń |
| Parowanie | Blok w oknie odbija pocisk w strzelca | okno 150 ms |
| Rzut ostrzem (F2) | Bumerang | 50 obrażeń, 1,2 s |
| Dash-cięcie (F2) | Doskok do celu z cięciem | zasięg 8 m |

### Rezonans (moce)
- Energia 100 pkt, regeneracja po 2 s bez użycia; parowanie i zabójstwa wręcz ładują.
- Docelowo 6–8 mocy: Pchnięcie, Chwyt i rzut, Błyskawica, Fala uderzeniowa, Bariera (odbija pociski 2 s), Skupienie (spowolnienie czasu 3 s). **F1: tylko Pchnięcie** (stożek, odrzut w ścianę = dodatkowe obrażenia).
- Każda moc ma 2–3 ulepszenia zmieniające działanie, nie tylko liczby.

### Broń strzelecka
- Przegrzanie zamiast amunicji: przegrzanie = blokada 1,5 s; aktywne chłodzenie w idealnym momencie daje bonus.
- Docelowo 5–6 typów (pistolet, karabin, rozpraszacz, snajperka, ciągły laser, granat EMP) i 2 sloty modułów. **F1: jeden blaster.**

### Hybrydy i synergie
Działają na tagach `#melee`, `#power`, `#gun`, `#elektryczność`; nowa synergia = dane, nie kod specjalny.
- **Pistolero Rezonansu:** zabójstwo mocą natychmiast schładza broń.
- **Tancerz ostrzy:** udane parowanie daje 10 energii i skraca odnowienie dasha.
- **Burzowy strzelec:** strzały w wroga pod Błyskawicą przeskakują na kolejny cel.

## 6. Zasoby gracza

| Zasób | Rola | Zachowanie | Wartość startowa |
| --- | --- | --- | --- |
| Zdrowie | Przeżycie | Brak pasywnej regeneracji; odnowa przez pokoje odpoczynku, implanty | do strojenia w F1 (propozycja: 100) |
| Energia | Blok, moce | 100 pkt; regeneracja po 2 s bez użycia; ładowana parowaniem i zabójstwami wręcz | 100 pkt, 2 s |
| Ciepło | Broń strzelecka | Rośnie przy strzale, spada samo; przegrzanie = blokada | blokada 1,5 s |

Wszystkie statystyki (`maxHealth`, `maxEnergy`, `energyRegen`, `heatCapacity`, `coolingRate`, `damage`, `moveSpeed`, `attackSpeed`) liczy wyłącznie `Stats` + `StatModifier`.

## 7. Game feel (obowiązkowe dla każdego trafienia)

- Hitstop 40 ms (lekki atak) – 80 ms (ciężki, zabójstwo), wstrząs kamery skalowany obrażeniami.
- Wróg po śmierci rozpada się na czerwone odłamki z fizyką, kierunek zgodny z ciosem.
- Każda akcja ma 3 warstwy feedbacku: obraz (VFX), dźwięk, kamera/kontroler.
- Zabójstwo ostatniego wroga w fali = spowolnienie czasu 0,3 s.
- Pociski wrogów są wolne i widoczne, żeby parowanie i uniki były czytelne.

## 8. Wrogowie Koalicji

| Archetyp | Rola | Kontra | Faza |
| --- | --- | --- | --- |
| Szturmowiec | Pałka elektryczna, napiera | Combo, Pchnięcie | F1 |
| Strzelec | Ostrzał z dystansu wolnymi pociskami | Parowanie, osłona | F1 |
| Snajper | Laser celujący, duże obrażenia | Dash, Bariera | F2 |
| Dron | Szybki, lata, mało HP | Błyskawica, broń auto | F2 |
| Tarczownik | Tarcza z przodu | Ciężki atak, flank, Chwyt | F2 |
| Egzekutor (elita) | Własne ostrze, paruje | Moce, strzały w przerwach | F2–F3 |
| Boss korporacji | Unikalny dla frakcji, wzorce faz | Nauka faz | F3 (pierwszy), F5 (reszta) |

Od F2 koordynacja grupy: flankowanie, ostrzał zaporowy. Czytelność: wróg zawsze czerwony; elita wyróżniona kształtem i obrysem, nie innym kolorem.

## 9. Progresja

| Warstwa | Zostaje po śmierci | Przykład |
| --- | --- | --- |
| Poziom postaci | Tak | Punkty talentów |
| Drzewka (Ostrze / Moc / Strzelec + hybrydy) | Tak | Nowa umiejętność, wariant mocy |
| Odblokowania | Tak | Nowa broń w puli, nowa moc |
| Waluta Dane | Tak | Zakupy w warsztacie |
| Rdzenie | Tak | Odblokowania rzadkie |
| Implanty | Nie (per run) | +30% obrażeń przy pełnej energii |
| Moduły znalezione w runie | Nie, chyba że wydobyte | Rykoszet do blastera |

Zapis: IndexedDB, `saveVersion`, migracje; meta-progres i stan runu osobno.

## 10. Tryby gry

- **Kryjówka (hub)** — grywalna baza ruchu oporu: terminal drzewek, warsztat modułów, tablica misji, NPC (F4).
- **Misje** — krótkie zadania fabularne: cel + warunek + nagroda w pliku danych. Cele: sabotaż, odbicie więźnia, eskorta, obrona, likwidacja dyrektora (F5, 5 misji, każda z innym celem).
- **Freeplay** — nieskończona strefa z rosnącym zagrożeniem, areny z mutatorami (tylko ostrze, podwójna prędkość, jeden hit = śmierć), codzienny seed, poligon (F6).

## 11. Styl wizualny i audio

### Wizualia
| Element | Styl |
| --- | --- |
| Świat | Biały, płaski, low-poly, minimalne tekstury, wyraźne cienie lub ich brak |
| Wrogowie | Czerwoni, jednolity kolor, rozpad na czerwone odłamki |
| Obiekty interaktywne | Czarne (rekwizyty do rzucania, terminale, drzwi) |
| Gracz i moce | Neon cyan (ostrze, Rezonans) i magenta (energia, akcenty) |
| Pociski wrogów | Wolne, duże, widoczne; pociski gracza cyan |
| HUD | Minimalny: zdrowie, energia, ciepło; HTML/CSS nad canvasem |

Assety: CC0 (Kenney, Quaternius) lub własne; modele z Blendera do glTF.

### Audio
- Web Audio API, SFX z wariacjami (pitch, wybór próbki z `Rng` kosmetycznego), odblokowanie po pierwszym kliknięciu.
- Każde trafienie: osobny dźwięk lekkiego, ciężkiego trafienia, bloku, parowania, zabójstwa.
- Muzyka synthwave/industrial, reaktywna na intensywność walki (F7). Dźwięk przestrzenny dla wrogów i pocisków.

## 12. Świat i frakcje (szkic)

**Miasto:** Neo-Ryd — pionowa metropolia, góra należy do korporacji, dół do ruchu oporu. **Ruch oporu:** komórka „Iskra” z kryjówką w nieczynnej stacji metra.

**Rezonans:** rzadka zdolność wpływania na materię i energię przez implant w korze ruchowej. Ludzie z nią to **Rezonanci**; Koalicja ich poluje lub werbuje. Gracz jest Rezonansem w tajemnicy.

**Koalicja** — sojusz trzech korporacji współdzielących ochronę i wywiad:

| Korporacja | Branża | Stylistyka wrogów | Boss (szkic) |
| --- | --- | --- | --- |
| **Helixa Dynamics** | Biotechnologia, medycyna | Sterylne maski, biało-szare pancerze, strzykawki-granaty, powolni i pancerni | Dyrektor Laboratorium |
| **Kurogane Arms** | Zbrojeniówka | Ciężkie opancerzenie, tarcze, pociski zaporowe, formacje | Dyrektor Ochrony |
| **Orbis Grid** | Sieci, dane, drony | Smukłe sylwetki, drony, snajperzy, hakowanie przestrzeni | Dyrektor Systemów |

Wszyscy wrogowie pozostają czerwoni (filar 4); frakcje odróżniają kształt, obrys i zachowania. Łuk fabularny (F5): komórka Iskra odkrywa, że Koalicja produkuje sztuczne implanty Rezonansu; finał to uderzenie w jedną z korporacji.

## 13. Zakres demo (F7)

- Kryjówka z terminalem drzewek, warsztatem i tablicą misji.
- Pełny run 15–25 min: sektor, nagrody, implanty, jeden boss.
- 3 ścieżki buildów grywalne, 5–6 broni, 6–8 mocy, 5–6 archetypów wrogów.
- 5 misji fabularnych (każda z innym celem), freeplay w podstawowej formie.
- Ustawienia, samouczek, muzyka; 60 FPS w Chrome na średnim laptopie, 0 znanych crashy.
- Build desktopowy i Steam Playtest.

## 14. Zakres F1 (bieżąca faza)

Jedna arena z falami wrogów, grywalna 15 minut tak, żeby chciało się kolejną rundę. W F1: kontroler FPP, kamera, dash i slide, ostrze plazmowe (combo, ciężki atak, blok, parowanie), blaster z przegrzaniem, Pchnięcie Rezonansu, 2 archetypy wrogów, shader, odłamki, hitstop, SFX, minimalny HUD, konsola spawnu. Zadania w `docs/issues/F1/`. Cała reszta idzie do `docs/backlog.md`.

## 15. Poza zakresem (nie robimy w demo)

- Multiplayer i co-op.
- Wsparcie gamepada i VR (wstępnie backlog).
- Pełna lokalizacja (pierwsza wersja: polski).
- Własne, wysokiej jakości modele 3D i animacje motion-capture.
- Edytor poziomów dla graczy, mody.
- Crafting rozbudowany poza modułami i implantami.

Szczegółowa lista pomysłów odłożonych: `docs/backlog.md`.

## 16. Ryzyka i zasady produkcji

- **Rozrost zakresu** to ryzyko nr 1: Producent odrzuca zadania spoza fazy i kieruje je do backlogu.
- Brama F1 jest najważniejsza: jeśli walka na jednej arenie nie jest fun, nie idziemy do F2.
- Wszystkie liczby „feel” w `tuning.ts` — dyrektor kreatywny stroi na żywo przez panel lil-gui.
- Zakaz nazw chronionych w kodzie, danych, tekstach i commitach; własne nazwy: ostrze plazmowe, Rezonans, Rezonanci, Koalicja.
