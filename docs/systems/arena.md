# Arena z falami (F1 #16)

Scena `?scene=arena` (pierwsza pozycja w menu) — pierwsza pełna pętla walki F1. Kod: `src/scenes/arena.ts`, `src/world/waves.ts`; dane: `src/data/scenes/arena.json` (układ), `src/data/waves/arena.json` (fale).

## Co łączy

| Element                                           | Moduł                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| Ruch, dash, ślizg, kamera FPP                     | `PlayerController`, `FpsCamera`                                          |
| Ostrze: combo, ciężki, blok, parowanie pocisków   | `PlasmaBlade` + `FppBlade` (widok), przechwytywanie w `ProjectileSystem` |
| Pchnięcie Rezonansu (F), energia                  | `ResonancePush`, `PlayerEnergy` (wspólna pula z blokiem)                 |
| Blaster (R, przytrzymanie) z przegrzaniem         | `Blaster`                                                                |
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

`spawn <id> [n]`, `kill all`, `hit <dmg>`, `wave <n>`, `god`, `reset` (wbudowane), plus `timescale`, `hitstop`, `seed`. Query: `wave`, `phase`, `enemies`, `playerHp`, `energy`, `heat`, `dead`, `kills`, `debris`, `bodies`.

## Otwarte (do playtestu / kolejnych zadań)

- Test wydajności „30 wrogów bez spadku FPS” — nie zmierzony automatycznie (CI renderuje programowo); do sprawdzenia ręcznie na `wave 12` + `spawn assaulter 20`.
- Blaster nie ma jeszcze modelu w widoku FPP (strzela z oczu, ciepło widać w HUD).
- Dźwięki (#14) — brak.
