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

| Id          | Nazwa     | Bronie                       | Moce                | Tagi               |
| ----------- | --------- | ---------------------------- | ------------------- | ------------------ |
| `classic`   | Klasyczny | `blaster`                    | `push`              | —                  |
| `blade`     | Ostrze    | `pistol`                     | `push`              | `#build_blade`     |
| `resonance` | Moc       | `blaster`                    | `push`, `shockwave` | `#build_resonance` |
| `gunner`    | Strzelec  | `rifle`, `scatter`, `sniper` | `push`              | `#build_gunner`    |

`?loadout=<id>` wybiera zestaw przy inicjalizacji sceny. Bez parametru arena
zachowuje konfigurację F1 (`classic`); nieznane id wybiera `classic`, a w debug
pojawia się `console.warn`. Ekran wyboru i fale F2 należą do F2-17.

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

## Otwarte (do playtestu / kolejnych zadań)

- Wydajność **symulacji** zmierzona testem `tests/unit/arenaPerf.test.ts`: 30 wrogów (20 Szturmowców + 10 Strzelców) ≈ 1 ms na krok, rozpad 30 wrogów naraz (440 odłamków) ≈ 1 ms na krok (lokalnie; budżet testu 6 ms przy 16,7 ms klatki). **Render** zmierzony 2026-11-14 (Chromium, ANGLE/D3D11, RTX 4070, 1920×1080, obrys włączony): fala 1 / 30 wrogów / rozpad 30 wrogów = 60 / 60 / 60 FPS (limit odświeżania); z CPU spowolnionym 4× (przybliżenie słabszego laptopa) = 60 / 55 / 60 FPS. Na słabszych GPU pierwszym kandydatem do optymalizacji jest obrys (3 przebiegi; `render.outline = 0` wyłącza).
- Dźwięki (#14) — brak.
