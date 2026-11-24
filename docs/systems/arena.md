# Arena z falami (F1 #16, F2-15)

Scena `?scene=arena` (pierwsza pozycja w menu) — pierwsza pełna pętla walki F1. Kod: `src/scenes/arena.ts`, `src/world/waves.ts`; dane: `src/data/scenes/arena.json` (układ), `src/data/waves/arena.json` (fale).

## Klatka w Dolnym Mieście

Arena, Endless i Arena wyzwań korzystają z tego samego ringu na dawnym placu przeładunkowym. Cztery rolety wskazują osiowe wejścia fal, a drzwi na obu końcach północnego i południowego muru wskazują wejścia narożne. Bursztynowa Iskra nad północną roletą wyznacza stronę organizatorów. Po przeciwnej stronie świeci niebieskie Arcade. Fioletowy bar oznacza zachód, zielony warsztat wschód.

Gracz startuje pod otwartą bramownicą. Może okrążać filary od środka, przebiec między nimi a osłonami albo przenieść walkę na obwód. Boczne bariery chronią przed ostrzałem z szerokiej strony. Na oba agregaty, kontener i paletę skrzyń można wejść zwykłym skokiem. W każdej ćwiartce jest zniszczalna skrzynia.

Deszcz, odgłosy ulicy, neony i hologramy korzystają ze wspólnej oprawy pokoi. Trzy okapy osłaniają stragan, terminal i południowy dok. Mutator `darkness` przyciemnia światło globalne. Lampiony ringu i oznaczenia wejść pozostają widoczne.

## Co łączy

| Element                                            | Moduł                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Ruch, dash, ślizg, kamera FPP                      | `PlayerController`, `FpsCamera`                                          |
| Ostrze: combo, ciężki, blok, parowanie pocisków    | `PlasmaBlade` + `FppBlade` (widok), przechwytywanie w `ProjectileSystem` |
| Moce F/E, energia                                  | `PowerSlots`, `createPower`, `PlayerEnergy` (wspólna pula z blokiem)     |
| Bronie (R, przytrzymanie), sloty 1–3, przegrzanie  | `Weapon`, `Loadout`, `FppBlaster`, renderery promienia i wybuchu         |
| Wrogowie: wszystkie archetypy z `waves/arena.json` | `EnemyManager`, `EnemyView`                                              |
| Fale                                               | `WaveDirector`                                                           |
| Rozpad wrogów                                      | `DebrisSystem`, `DebrisRenderer`, `EnemyShatter`                         |
| HUD i ekran śmierci                                | `Hud`                                                                    |
| Hitstop, spowolnienie po ostatnim zabójstwie fali  | `FeelSystem` (main.ts)                                                   |

## Fale (`WaveDirector`)

Dane `src/data/waves/arena.json`: `firstBreakS` 2, `breakS` 4, `maxAlive` 10,
`minSpawnDistance` 9 m, 8 punktów spawnu XZ, 12 fal. Rosnąca liczebność (3 → 21):

| Fala | Interwał (s) | Skład                                                                      | Razem |
| ---- | ------------ | -------------------------------------------------------------------------- | ----- |
| 1    | 0,9          | assaulter 3                                                                | 3     |
| 2    | 0,8          | assaulter 3, gunner 2                                                      | 5     |
| 3    | 0,8          | assaulter 2, gunner 1, drone 3                                             | 6     |
| 4    | 0,7          | assaulter 4, gunner 1, sniper 1                                            | 6     |
| 5    | 0,7          | assaulter 3, drone 3, sniper 1, hacker 1                                   | 8     |
| 6    | 0,65         | shielder 2, assaulter 3, gunner 2, turret 1                                | 8     |
| 7    | 0,6          | shielder 2, assaulter 4, drone 2, sniper 1                                 | 9     |
| 8    | 0,6          | executor 1, assaulter 5, gunner 3, hacker 1                                | 10    |
| 9    | 0,5          | assaulter 5, gunner 3, drone 3, sniper 2, turret 1                         | 14    |
| 10   | 0,45         | shielder 3, assaulter 4, gunner 3, drone 3, sniper 2, hacker 1             | 16    |
| 11   | 0,4          | executor 1, shielder 2, assaulter 6, gunner 3, drone 3, turret 1           | 16    |
| 12   | 0,35         | executor 2, shielder 3, assaulter 6, sniper 2, drone 4, hacker 2, turret 2 | 21    |

Algorytm i determinizm (`src/world/waves.ts`):

- Fazy: `stopped` → `break` → `spawning` → `fighting` → `break`… → `done`.
  `start(wave=1, rng?)` czyści stan, ustawia fazę `break` z timerem `firstBreakS`;
  dla `wave>1` indeks bieżącej fali ustawia się tak, że następna w kolejce to `wave`.
- Początek fali (timer ≤ 0): kolejka = grupy w kolejności z danych, każda rozwinięta
  do `max(1, round(count × mnożnik trudności.count))` wpisów; potem **jedno**
  `rng.shuffle(kolejka)` (Fisher–Yates od końca, `int(0,i)`). Emituje
  `wave_started {wave, count}` (count po mnożniku), `timerS = 0` (pierwszy
  spawn w tym samym kroku).
- Spawn: w pętli, dopóki `timerS ≤ 0`, kolejka niepusta i żywych <
  `max(1, round(maxAlive × mnożnik trudności.maxAlive))`: weź pierwszy wpis, wybierz
  punkt (poniżej), `spawn(enemy, punkt)`; wynik `null` (limit
  `tuning.arena.maxEnemies` = 30 żywych, limit ciał Rapiera
  `tuning.physics.maxDynamicBodies`) przerywa pętlę i próbuje w kolejnym kroku bez
  zużycia wpisu; sukces zdejmuje wpis, dodaje id do `alive` i `timerS += spawnIntervalS`
  fali (może więc spawnować kilku wrogów w jednym kroku przy dużym dt). Po
  ostatnim wpisie faza `fighting`.
- Punkt spawnu: spośród punktów z odległością XZ od gracza ≥ `minSpawnDistance`
  (gdy żaden — wszystkie), `rng.pick`; pozycja ma `y = 0`. Kolejność losowań z
  `Rng`: shuffle przy starcie fali, potem po jednym `pick` na każdy próbowany spawn
  (także nieudany, bo punkt wybierany jest przed `spawn`).
- Koniec fali: zdarzenie `enemy_killed` wroga z `alive` (inni, np. z konsoli,
  nie liczą się); gdy `alive` puste i kolejka pusta → `wave_last_kill {wave, id}`
  (spowolnienie 0,3 s), `wave_cleared {wave}`; po ostatniej fali faza `done`,
  inaczej `break` z `breakS`.
- `goto(n)` (komenda `wave`): natychmiast zaczyna falę `n`, bez przerwy, `alive`
  wyczyszczone (żywi wrogowie zostają poza licznikiem). `stop()` czyści kolejkę.
- Strumień: scena tworzy dyrektora z `ctx.rng.fork('waves')`, a `reset()` przekazuje
  świeże `ctx.rng.fork('waves')` do `start(1, rng)` — ten sam `?seed=` daje ten sam
  przebieg także po „Jeszcze raz”. `spawnLog` zapisuje `{wave, enemy, x, z}`.
- `step` dyrektora dostaje czas świata `dt` (nie czas gracza ze Skupienia).
- Mnożniki trudności (`count`, `maxAlive`) pochodzą z `difficulties[poziom]`
  ([difficulty.md](difficulty.md)); poziom odczytany raz przy `start()`.

## Śmierć i powtórka

`player_died` → stan `dead`, `WaveDirector.stop()`, aktywne moce zresetowane, mysz zwolniona, HUD pokazuje „Zginąłeś” i „Jeszcze raz” (klik / Enter / R) → `reset()`: wrogowie, pociski, odłamki i statusy usunięte, ekwipunek i ostrze od nowa, zdrowie, energia i wytrzymałość pełne, gracz na starcie, licznik zabójstw 0, fale od 1 z nowym strumieniem `ctx.rng.fork('waves')`. W stanie `dead` wrogowie nadal krokują (`manager.step`), reszta symulacji stoi; w stanie `select` nic nie krokuje.

## Arena wyzwań z mutatorem (F6)

Scena `?scene=arena-mutators` (przycisk „Arena wyzwań” w menu) to zwykła arena
z jednym mutatorem losowanym z seeda (`?seed=`; bez parametru seed to bieżąca
data, więc mutator zmienia się codziennie). Definicje: `src/data/mutators/*.json`
(schemat `arenaMutatorSchema`): `low-gravity` (`gravityScale` 0.5),
`fast-enemies` (`moveSpeed` ×1.5), `limited-ammo` (`ammoCapacity` 60, wspólna
pula na wszystkie bronie, odnawiana przy restarcie) i `darkness`
(`arenaLightScale` 0.2, skaluje tylko światła globalne; kolory otoczenia
bez zmian, neony pozostają). Efekt to `StatModifier` ze źródłem `arena:mutator`.
Opis mutatora widać na ekranie wyboru zestawu i w HUD. Debug: `mutator [id|seed]`,
`query('mutator')`. Zwykła arena (`?scene=arena`) działa bez mutatorów.

## Konsola debug

`spawn <id> [n]`, `kill all`, `hit <dmg>`, `wave <n>`, `god`, `loadout <id>`, `build`, `status <id> [s]`, `hold blade|gun`, `tp <x> <z> [yawDeg] [pitchDeg]`, `look <yawDeg> [pitchDeg]`, `execute ready`, `weaken <procent>`; globalne (`main.ts`): `reset`, `seed`, `timescale <n>`, `hitstop <ms>`. Query: `wave`, `phase`, `enemies`, `state` (`select|playing|dead`), `spawnLog`, `playerHp`, `energy`, `heat`, `dead`, `kills`, `debris`, `bodies`, `loadout`, `weapon`, `weaponHeat`, `powerSlots`, `powerCooldowns`, `beam`.

## Ekwipunek (F2-15)

`src/progression/loadout.ts` ładuje `src/data/loadouts/*.json` przez zod.
Schemat sprawdza znane id broni i mocy, ostrze `plasmaBlade`, 1–3 bronie i 1–2
moce, tagi z `#` i brak powtórzonych broni, mocy oraz id ekwipunków.
Arena buduje ostrze, bronie i moce z `resolveLoadout(preset, [])` (F4-03, bez łatek,
zachowanie jak dotąd); nadpisanie ostrza (`?blade=`) nadal wygrywa z ostrzem ekwipunku.

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
`?blade=<id>` nadpisuje ostrze ekwipunku (F2-11, patrz `docs/systems/melee.md`); ekran
wyboru ma rząd „Ostrze:” (Plazmowe / Bliźniacze / Dwustronne), a wybór obowiązuje na cały run.

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

Fale 1–12 (`src/data/waves/arena.json`) wprowadzają archetypy stopniowo: Dron (fala 3),
Snajper (4), Haker (5), Tarczownik i Wieżyczka (6), Egzekutor (8), potem mieszanki; fala 12
to 21 wrogów z dwoma Egzekutorami. Liczebność nie maleje (test), `maxAlive` zostaje 10. Wydajność:
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
