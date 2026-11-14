# Arena z falami (F1 #16, F2-15)

Scena `?scene=arena` (pierwsza pozycja w menu) — pierwsza pełna pętla walki F1. Kod: `src/scenes/arena.ts`, `src/world/waves.ts`; dane: `src/data/scenes/arena.json` (układ), `src/data/waves/arena.json` (fale).

## Co łączy

| Element                                           | Moduł                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| Ruch, dash, ślizg, kamera FPP                     | `PlayerController`, `FpsCamera`                                          |
| Ostrze: combo, ciężki, blok, parowanie pocisków   | `PlasmaBlade` + `FppBlade` (widok), przechwytywanie w `ProjectileSystem` |
| Moce F/E, energia                                 | `PowerSlots`, `createPower`, `PlayerEnergy` (wspólna pula z blokiem)     |
| Bronie (R, przytrzymanie), sloty 1–3, przegrzanie | `Weapon`, `Loadout`, `FppBlaster`, renderery promienia i wybuchu         |
| Wrogowie: Szturmowiec, Strzelec                   | `EnemyManager`, `EnemyView`                                              |
| Fale                                              | `WaveDirector`                                                           |
| Rozpad wrogów                                     | `DebrisSystem`, `DebrisRenderer`, `EnemyShatter`                         |
| HUD i ekran śmierci                               | `Hud`                                                                    |
| Hitstop, spowolnienie po ostatnim zabójstwie fali | `FeelSystem` (main.ts)                                                   |

## Fale (`WaveDirector`)

- 12 fal o rosnącej liczebności (2 → 16 wrogów), skład i interwał spawnu w danych (zod).
- Kolejność wrogów i punkty spawnu losuje `Rng` (`ctx.rng.fork('waves')`) — **ten sam `?seed=` daje ten sam przebieg**.
- Spawn co `spawnIntervalS`, najwyżej `maxAlive` (10) żywych naraz, punkt spawnu dalej niż `minSpawnDistance` od gracza, gdy to możliwe. Odmowa spawnu (limit `tuning.arena.maxEnemies`, limit ciał Rapier) — ponowienie w kolejnym kroku.
- Koniec fali: kolejka pusta i zginął ostatni wróg fali → `wave_last_kill` (spowolnienie 0,3 s) i `wave_cleared`, przerwa `breakS`, następna fala (`wave_started`). Wrogowie z konsoli nie liczą się do fali. Po ostatniej fali faza `done`.

## Śmierć i powtórka

`player_died` → fale stop, mysz zwolniona, HUD pokazuje „Zginąłeś” i „Jeszcze raz” (klik / Enter / R) → `reset()`: wrogowie i pociski usunięci, zdrowie i energia pełne, gracz na starcie, fale od 1.

## Konsola debug

`spawn <id> [n]`, `kill all`, `hit <dmg>`, `wave <n>`, `god`, `loadout <id>`, `reset` (wbudowane), plus `timescale`, `hitstop`, `seed`. Query: `wave`, `phase`, `enemies`, `playerHp`, `energy`, `heat`, `dead`, `kills`, `debris`, `bodies`, `loadout`, `weapon`, `weaponHeat`, `powerSlots`, `powerCooldowns`, `beam`.

## Ekwipunek (F2-15)

`src/progression/loadout.ts` ładuje `src/data/loadouts/*.json` przez zod.
Schemat sprawdza znane id broni i mocy, ostrze `plasmaBlade`, 1–3 bronie i 1–2
moce, tagi z `#` i brak powtórzonych broni, mocy oraz id ekwipunków.

| Id                   | Nazwa               | Bronie                       | Moce                | Tagi                                |
| -------------------- | ------------------- | ---------------------------- | ------------------- | ----------------------------------- |
| `classic`            | Klasyczny           | `blaster`                    | `push`              | —                                   |
| `blade`              | Ostrze              | `pistol`                     | `push`              | `#build_blade`                      |
| `resonance`          | Moc                 | `blaster`                    | `chain`, `push`     | `#build_resonance`                  |
| `gunner`             | Strzelec            | `rifle`, `scatter`, `sniper` | `push`              | `#build_gunner`                     |
| `bladeDancer`        | Tancerz ostrzy      | `pistol`                     | `push`, `shockwave` | `#build_blade`, `#build_resonance`  |
| `resonancePistolero` | Pistolero Rezonansu | `pistol`, `scatter`          | `shockwave`, `push` | `#build_resonance`, `#build_gunner` |
| `stormGunner`        | Burzowy strzelec    | `rifle`, `emp`               | `chain`, `push`     | `#build_gunner`, `#build_resonance` |

`?loadout=<id>` wybiera zestaw przy inicjalizacji sceny i pomija ekran wyboru;
nieznane id wybiera `classic`, a w debug pojawia się `console.warn`. Bez parametru
arena z rejestru scen zaczyna od ekranu wyboru buildu (F2-17). `classic` (konfiguracja
F1) nie ma karty na ekranie; zostaje dla testów i `?loadout=classic`.

Każda broń ma osobną instancję, zasób ciepła i blokadę. Naciśnięcie 1–3 wybiera
istniejący slot (indeks 0–2 w zdarzeniu), emituje `weapon_switched`, a zaraz po
nim `heat_changed` nowej broni. Ponowny wybór tego samego lub pustego slotu nic
nie robi. Tylko aktywna broń dostaje spust R; pozostałe używają `cool(dt)` bez
zdarzeń. Wszystkie bronie używają obecnie jednego modelu FPP `FppBlaster`.
Laser korzysta z najbliższego hurtboxa/ściany Rapier, pomijając gracza;
`BeamRenderer` i `ExplosionRenderer` pokazują laser i EMP dla ekwipunków z tych danych.

`PowerSlots` tworzy moce przez `createPower`: F = slot 0, E = slot 1, wspólna
energia z osobnymi odnowieniami. Wciśnięcia w hitstopie pozostają w kolejce mocy.
`loadout <id>` wykonuje pełny reset areny z nowym zestawem: czyści wrogów,
pociski i efekty, przywraca zdrowie, energię, zimne bronie, pierwszy slot oraz
moce bez odnowienia. Zwykły reset zachowuje wybrany ekwipunek. Nieprawidłowa
komenda pokazuje dostępne zestawy i nie zmienia stanu.

Kontrola w 30 sekund: otwórz `?scene=arena&loadout=gunner&debug=1`, przytrzymaj R,
wybierz 2, strzel i wróć do 1. Sprawdź nazwę i odrębne ciepło w HUD.
Wpisz `loadout resonance`, użyj F/E i obserwuj dwa odnowienia. Oceń płynność
przełączania, brak skoków paska od schowanych broni i czytelność slotów.
Testy: `loadout.test.ts`, `weaponCooling.test.ts`, `arenaLoadout.test.ts`,
`hud.test.ts`; e2e: `arenaLoadout.spec.ts` (Digit2 oraz query `weapon`).

## Ekran wyboru buildu i fale F2 (F2-17)

Bez `?loadout=` arena startuje w stanie `select`: fale stoją, gracz nie krokuje, a nad
HUD jest ekran `BuildSelect` (`src/ui/buildSelect.ts`). Karty i opisy pochodzą z
`src/data/ui/buildSelect.pl.json`: trzy czyste buildy (Ostrze, Moc, Strzelec) i trzy
hybrydy. Bronie i moce karta bierze z ekwipunku, a listę synergii wylicza z
`src/data/synergies/` tak samo jak `SynergySystem.active()` (wszystkie `requires` w tagach
ekwipunku). Ekwipunki `gunner + resonance` aktywują dwie synergie naraz (Pistolero i
Burzowy strzelec), więc obie hybrydy z tymi tagami pokazują obie. Kliknięcie karty to
gest użytkownika: nowy run od fali 1 z ekwipunkiem i przechwycenie myszy (`ctx.resume`).
Na ekranie śmierci obok „Jeszcze raz” (ten sam build) jest „Zmień build”; komenda debug
`build` robi to samo w trakcie gry.

`SynergySystem` działa w arenie od F2-17: tagi ustawia każdy reset, efekty w czasie
gracza. `stats` synergii to `PlayerController.stats` (dash i ruch), `cool_weapon` woła
`vent()` aktywnej broni.

Fale 1–12 (`src/data/waves/arena.json`) wprowadzają archetypy po jednym: Dron (3),
Snajper (4), Tarczownik (6), Egzekutor (8), potem mieszanki; fala 12 to 17 wrogów z
dwoma Egzekutorami. Liczebność nie maleje (test), `maxAlive` zostaje 10. Wydajność:
`arenaPerf.test.ts` mierzy 30 wrogów z mieszanki wszystkich archetypów F2.

Kontrola w 30 sekund: `?scene=arena&debug=1` → ekran wyboru, wybierz hybrydę, w konsoli
`synergies` przez `__neoryder.query('synergies')`, `wave 8` (Egzekutor), potem `build`.
Testy: `arenaBuild.test.ts`, `buildSelect.test.ts`, `waves.test.ts`, `arenaPerf.test.ts`;
e2e: `buildSelect.spec.ts` (każdy z sześciu buildów startuje arenę).

## Otwarte (do playtestu / kolejnych zadań)

- Gracz ma dwa obiekty `Stats`: `PlayerController.stats` (ruch, dash) i statystyki areny
  (zdrowie, energia, ciepło). Synergie widzą tylko pierwszy — do ujednolicenia przed
  implantami F3.
- Balans fal F2 i hybryd do potwierdzenia symulatorem TTK (F2-18) i playtestem bramki.

- Wydajność **symulacji** zmierzona testem `tests/unit/arenaPerf.test.ts`: 30 wrogów (20 Szturmowców + 10 Strzelców) ≈ 1 ms na krok, rozpad 30 wrogów naraz (440 odłamków) ≈ 1 ms na krok (lokalnie; budżet testu 6 ms przy 16,7 ms klatki). **Render** zmierzony 2026-11-14 (Chromium, ANGLE/D3D11, RTX 4070, 1920×1080, obrys włączony): fala 1 / 30 wrogów / rozpad 30 wrogów = 60 / 60 / 60 FPS (limit odświeżania); z CPU spowolnionym 4× (przybliżenie słabszego laptopa) = 60 / 55 / 60 FPS. Na słabszych GPU pierwszym kandydatem do optymalizacji jest obrys (3 przebiegi; `render.outline = 0` wyłącza).
- Dźwięki (#14) — brak.
