# Zadania fazy F2 — Arsenał i ścieżki buildów

Architektura: `docs/adr/0004-arsenal-f2.md` (zaakceptowana 2026-11-14 razem z bramką F1). Kontrakty: `docs/api.md`, sekcja „Kontrakty F2”. Wspólne wymagania i definicja ukończenia: `AGENTS.md`. Szacunek: S ≈ 0,5–1 dnia sesji, M ≈ 1–2 dni, L ≈ 2–4 dni.

**Bramka fazy:** czysty build Ostrza, Mocy i Strzelca przechodzi arenę (12 fal) i każdy gra się wyraźnie inaczej. Raport TTK w `docs/balance.md` bez ścieżki odstającej o więcej niż 2× od mediany.

## Stan (2026-11-14)

Bramka F1 zaliczona (playtest człowieka). Gotowe: 01, 12. W toku: 03 (Codex).

## Decyzje wspólne

- **Sterowanie:** `F` — moc 1, `E` — moc 2, `1`/`2`/`3` — wybór broni (tylko poza runem: arena, poligon), środkowy przycisk myszy — rzut ostrzem, atak w trakcie dashu — dash-cięcie. Bez nowych klawiszy dla wariantów ostrza (wybór na ekranie buildu).
- **Ekwipunek:** `Loadout { blade, weapons[1..3], powers[1..2] }` z danych (`src/data/loadouts/*.json`). Arena wybiera go na ekranie wyboru buildu; `?loadout=<id>` pomija ekran (testy, e2e).
- **Modele:** bryły zastępcze z prymitywów jak w F1 (czytelny styl ważniejszy niż detal). Modele `.glb` broni i wrogów F2 robi Grafika poza ścieżką krytyczną.
- **Statusy tylko przez obrażenia:** `DamageInfo.statuses` → `damage_dealt.statuses` → `StatusSystem`. Żaden system nie nakłada statusu bezpośrednio.
- **Każde zadanie:** dane w `src/data/`, liczby feel w `tuning.ts`, scena testowa `?scene=<id>`, dokument w `docs/systems/`.

## Tabela zadań

| Nr  | Tytuł                                                                | Agent             | Zależy od  | Szac. | Stan   |
| --- | -------------------------------------------------------------------- | ----------------- | ---------- | ----- | ------ |
| 01  | Kontrakty F2: statusy w obrażeniach, akcje wejścia, zdarzenia        | Architekt         | —          | S     | gotowe |
| 02  | `StatusSystem`: podpalenie, przeciążenie, ogłuszenie                 | Architekt         | 01         | M     | —      |
| 03  | Tryby strzału i dane broni: pistolet, karabin, rozpraszacz, snajperka | Bronie            | 01         | L     | w toku |
| 04  | Ciągły laser i granat EMP                                            | Bronie            | 02, 03     | M     | —      |
| 05  | Rejestr mocy, drugi slot, Fala uderzeniowa                           | Moce              | 01         | M     | —      |
| 06  | Skupienie: osobna skala czasu gracza                                 | Architekt + Moce  | 05         | M     | —      |
| 07  | Błyskawica (łańcuch, przeciążenie)                                   | Moce              | 02, 05     | S     | —      |
| 08  | Bariera                                                              | Moce              | 05         | S     | —      |
| 09  | Chwyt i rzut                                                         | Moce              | 05         | L     | —      |
| 10  | Rzut ostrzem i dash-cięcie                                           | Walka wręcz       | 01         | M     | —      |
| 11  | Warianty ostrzy: podwójne i dwustronne                               | Walka wręcz       | 10         | M     | —      |
| 12  | `EnemyDirector`: tokeny ataku, flankowanie, ostrzał zaporowy         | AI wrogów         | 01         | M     | gotowe |
| 13  | Snajper i Dron                                                       | AI wrogów         | 12         | M     | —      |
| 14  | Tarczownik i Egzekutor                                               | AI wrogów         | 02, 12     | L     | —      |
| 15  | Ekwipunek, przełączanie broni, HUD mocy i broni                      | UI/UX + Architekt | 03, 05     | M     | —      |
| 16  | Synergie na tagach i 3 hybrydy                                       | Progresja         | 02, 03, 05 | M     | —      |
| 17  | Ekran wyboru buildu i fale F2 na arenie                              | Architekt + UI/UX | 13, 14, 15 | M     | —      |
| 18  | Symulator TTK (`npm run balance`) i `docs/balance.md`                | QA                | 04, 09, 14 | M     | —      |

Graf jest acykliczny (zależności tylko od niższych numerów). Ścieżka krytyczna: 01 → 05 → 15 → 17 oraz 01 → 12 → 14 → 17. Po 01 równolegle mogą ruszyć 02, 03, 05, 10 i 12 (rozłączne foldery).

## Zadania

### 01 Kontrakty F2

Dopisanie do kodu typów z `docs/api.md` („Kontrakty F2”): `StatusApplication`, `DamageInfo.statuses`, nowe zdarzenia w `GameEvents`, akcje wejścia `power2`, `weapon1..3`, `bladeThrow` i ich klawisze. Bez zachowania — tylko typy, dane i przejście `statuses` przez `DamageSystem.deal` do `damage_dealt`.
**Gotowe:** `npm run check` zielone, test: `statuses` z `DamageInfo` trafia do `damage_dealt`.

### 02 StatusSystem

`src/combat/status/` + `src/data/statuses/{burning,overload,stunned}.json`. Nakłada statusy z `damage_dealt.statuses`, odlicza czas, emituje `status_applied` / `status_expired`. Podpalenie zadaje obrażenia co `tickS` przez `DamageSystem.deal`. Przeciążenie to modyfikator `damageTaken` (`percent` na stos); przy `maxStacks` zużywa stosy, nakłada ogłuszenie i wyładowanie w promieniu. Ogłuszony wróg nie atakuje (wrogowie pytają `StatusQuery.has`). Scena `?scene=status-test`, komenda `status <id> [s]`.
**Gotowe:** testy czasu trwania, odświeżania, stosów, wyładowania (bez łańcuchowej pętli), resetu; obrażenia statusów mają źródło nakładającego i tag `#status`.

### 03 Tryby strzału i dane broni

`WeaponDefinition` jako unia po `fireMode`, klasa `Weapon` z trybami `projectile`, `spread`, `pierce` w `src/combat/weapons/fireModes/`. `Blaster` zostaje (to `Weapon` z danymi blastera, bez zmiany zachowania). Pliki danych: `pistol`, `rifle`, `scatter`, `sniper`. Broń półautomatyczna strzela raz na wciśnięcie. Przebicie: pocisk trafia do `pierceCount` celów, każdy kolejny o `pierceFalloff` słabiej. Scena `?scene=weapons-test` z przełączaniem broni.
**Gotowe:** testy każdego trybu (liczba pocisków, stożek rozrzutu z `Rng`, przebicie i spadek obrażeń, semi vs auto, przegrzanie), istniejące testy blastera bez zmian.

### 04 Ciągły laser i granat EMP

Tryb `beam` (promień co krok, obrażenia w tikach `tickHz`, ciepło na sekundę) i `lob` (pocisk balistyczny, wybuch w promieniu z `statuses`, np. przeciążenie). Dane `beam.json`, `emp.json`. Wizualizacja promienia i wybuchu w `src/render/`.
**Gotowe:** testy tików promienia, zasięgu, trafienia ściany, toru balistycznego i obrażeń w promieniu.

### 05 Rejestr mocy, drugi slot, Fala uderzeniowa

Interfejs `Power`, baza kosztu i odnowienia (`power_denied`, kolejkowanie w hitstopie), rejestr po `def.kind`, `PowerSlots` (F i E). `ResonancePush` przepisane na `kind: 'cone'` bez zmiany zachowania. Fala uderzeniowa = `shockwave.json` (`kind: 'cone'`, 360°) — tylko dane.
**Gotowe:** dotychczasowe testy Pchnięcia przechodzą bez zmian asercji, testy rejestru, slotów i fali 360°.

### 06 Skupienie

`FeelSystem.playerTimeScale`, `GameContext.feel.playerDt(dt)` (ADR 0004 pkt 4), zdarzenie `focus`. Moc `kind: 'focus'`: świat zwalnia (np. 0,3), gracz porusza się normalnie przez `durationS`, energia drenowana na sekundę. Sceny krokują gracza, ostrze, broń i moce z `playerDt`.
**Gotowe:** testy: gracz w Skupieniu przebywa w 1 s czasu rzeczywistego ten sam dystans co bez niego, wrogowie i pociski — 0,3 tego; hitstop zatrzymuje oba; `playerDt` ograniczone do `SIM_DT × 2`.

### 07 Błyskawica

`kind: 'chain'`: pierwszy cel w stożku celowania, potem `jumps` przeskoków do najbliższych w `jumpRangeM`, każdy przeskok słabszy o `falloff`, nakłada `overload`. Wizualizacja łuków.
**Gotowe:** testy kolejności przeskoków, braku powtórzeń celu, zasięgu i spadku obrażeń.

### 08 Bariera

`kind: 'barrier'`: przez `durationS` `ProjectileSystem.addInterceptor` odbija pociski wrogów trafiające z przodu (kąt `arcDeg`) z powrotem do strzelca; koszt energii na odbity pocisk. Wizualizacja tarczy.
**Gotowe:** testy odbicia z przodu, przepuszczenia z tyłu i końca działania.

### 09 Chwyt i rzut

`kind: 'grab'`: przytrzymanie `power` łapie obiekt interaktywny (czarny) albo lekkiego wroga (`grabbable` w danych wroga) w zasięgu, trzyma go przed kamerą, puszczenie rzuca — rzucone ciało zadaje obrażenia przy zderzeniu (wróg i cel). Energia drenowana w trakcie trzymania.
**Gotowe:** testy chwytu, odmowy (za ciężki, za daleko), rzutu i obrażeń przy zderzeniu.

### 10 Rzut ostrzem i dash-cięcie

Rzut: ostrze leci prosto `throwRangeM`, przecina wszystkich na drodze (raz każdego), wraca do gracza; w locie brak cięć i bloku. Dash-cięcie: atak w trakcie dashu tnie wszystkich wzdłuż toru dashu (`dashCut` w danych ostrza). Zdarzenia `blade_thrown`, `blade_returned`.
**Gotowe:** testy toru, jednokrotnego trafienia, powrotu, blokady cięć w locie, dash-cięcia.

### 11 Warianty ostrzy

Dane `src/data/blades/` (przeniesienie `plasmaBlade.json`): `twinBlades` (podwójne: szybsze, 4-etapowe combo, słabszy blok), `staffBlade` (dwustronne: szerokie łuki, ciężki atak to obrót 360°, odbijanie pocisków w szerszym kącie). Różnice tylko w danych i w kształcie trafienia (`arc` vs `spin`).
**Gotowe:** testy każdego wariantu, wybór wariantu z `Loadout`.

### 12 EnemyDirector

`src/enemies/director.ts`: tokeny ataku wręcz i strzału (`attackTokens`, `shotTokens` w danych sceny), sloty flankowania wokół gracza, ostrzał zaporowy (naprzemienne tokeny strzału). Wrogowie bez tokenu krążą w slocie.
**Gotowe:** testy limitu jednoczesnych ataków, zwalniania tokenu przy śmierci i ogłuszeniu, przydziału slotów (najbliższy wolny).

### 13 Snajper i Dron

Snajper: długi telegraf z widoczną linią lasera, strzał przebijający, ucieka od gracza. Dron: lot bez character controllera (kinematyka 3D), mało HP, krąży i strzela seriami. Dane `sniper.json`, `drone.json`.
**Gotowe:** testy maszyn stanów, telegrafu (`enemy_telegraph`), lotu drona bez wchodzenia w ściany.

### 14 Tarczownik i Egzekutor

Tarczownik: hurtbox tarczy z przodu (mnożnik 0), pokonuje się go flankiem, ciężkim ciosem (wytrąca tarczę), Chwytem albo przeciążeniem. Egzekutor (elita): własne ostrze, paruje część ciosów gracza (okno z danych), ciężkie ataki z telegrafem.
**Gotowe:** testy tarczy z przodu i z tyłu, wytrącenia tarczy, parowania Egzekutora.

### 15 Ekwipunek i HUD

`Loadout` z danych, przełączanie broni `1`–`3` (`weapon_switched`), HUD: ikony/nazwy dwóch mocy z odnowieniem, nazwa broni, ciepło bieżącej broni. Teksty HUD w `src/data/ui/hud.pl.json`.
**Gotowe:** testy przełączania (stan ciepła per broń), HUD na zdarzeniach, e2e: zmiana broni na arenie.

### 16 Synergie

`SynergySystem` (`src/progression/synergies.ts`) i `src/data/synergies/*.json` według ADR 0004 pkt 5. Trzy hybrydy jako dane: Pistolero Rezonansu, Tancerz ostrzy, Burzowy strzelec. Zdarzenie `synergy_triggered`.
**Gotowe:** testy warunków (`event`, `tagsAny`, `requires`) i każdego efektu, test, że hybryda nie działa bez wymaganych tagów ekwipunku.

### 17 Ekran wyboru buildu i fale F2

Ekran przed falą 1: trzy gotowe buildy (Ostrze, Moc, Strzelec) i hybrydy, `?loadout=` pomija ekran. Fale 1–12 z nowymi archetypami (`src/data/waves/arena.json`).
**Gotowe:** e2e: wybór każdego buildu startuje arenę, fale z nowymi wrogami przechodzą test wydajności 30 wrogów.

### 18 Symulator TTK

`npm run balance` (node, bez renderu): TTK każdej broni i mocy wobec każdego wroga z danych, z uwzględnieniem ciepła, odnowień, mnożników i statusów. Zapis `docs/balance.md`. Test: żadna ścieżka buildu nie odstaje o więcej niż 2× od mediany.
**Gotowe:** raport wygenerowany, test balansu w Vitest.
