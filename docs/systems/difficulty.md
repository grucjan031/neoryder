# Poziomy trudności i taktyczne AI

Dane: `src/data/difficulty.json`, schemat zod i wybór poziomu: `src/world/difficulty.ts`.
Poziomy: `easy` (Łatwy), `normal` (Normalny), `hard` (Trudny), `nightmare` (Koszmar).

## Wartości poziomów

| Pole               | easy | normal | hard | nightmare | Działanie                                                                                              |
| ------------------ | ---- | ------ | ---- | --------- | ------------------------------------------------------------------------------------------------------ |
| `health`           | 0,75 | 1,0    | 1,3  | 1,6       | mnożnik `maxHealth` wrogów (Stats, łączy się z Poziomem zagrożenia)                                    |
| `damage`           | 0,6  | 1,0    | 1,35 | 1,7       | mnożnik `damage` wrogów, w tym pocisków                                                                |
| `count`            | 0,8  | 1,0    | 1,25 | 1,5       | liczba wrogów w każdej grupie fali (zaokrąglenie, min. 1)                                              |
| `maxAlive`         | 0,8  | 1,0    | 1,25 | 1,5       | limit żywych wrogów fali                                                                               |
| `telegraph`        | 1,2  | 1,0    | 0,85 | 0,72      | czasy zapowiedzi (`telegraphS`, `aimTelegraphS`, `aimLockS`, hak, wzorce bossa); schemat wymusza ≥ 0,7 |
| `attackTokens`     | 1    | 3      | 4    | 5         | tokeny wręcz dla typowego pokoju (3); inne pokoje przesuwa ta sama różnica, min. 1                     |
| `shotTokens`       | 1    | 2      | 3    | 4         | tokeny strzału dla typowego pokoju (2), jak wyżej                                                      |
| `accuracy`         | 0,7  | 1,1    | 1,15 | 1,3       | celność: dzieli rozrzut                                                                                |
| `spread`           | 1,4  | 0,9    | 0,8  | 0,6       | mnożnik rozrzutu; efektywnie `spreadDeg × spread / accuracy` (≤ 90°)                                   |
| `burstBreak`       | 1,3  | 1,0    | 0,8  | 0,65      | przerwy między seriami i atakami (`cooldownS`, hak, wzorce bossa)                                      |
| `flankChance`      | 0,1  | 0,45   | 0,65 | 0,9       | szansa flankowania Szturmowca                                                                          |
| `coverUse`         | 0,15 | 0,35   | 0,65 | 0,85      | szansa szukania osłony przez Strzelca                                                                  |
| `groupAttack`      | 0    | 0,35   | 0,7  | 1,0       | szansa skoordynowanej pary zapowiedzi i ostrzału przy bloku; 0 = brak koordynacji                      |
| `heavyDodgeChance` | 0,05 | 0,2    | 0,45 | 0,7       | odskok wroga wręcz przed ciężkim ciosem gracza                                                         |
| `dashDodgeChance`  | 0,1  | 0,3    | 0,6  | 0,85      | Strzelec przerywa celowanie i ucieka w bok przed doskokiem                                             |

Efektywny rozrzut Strzelca (bazowo 2°): easy 4,0°, normal 1,64°, hard 1,39°, Koszmar 0,92°.
Najkrótsza zapowiedź: Koszmar 72% bazowej (Szturmowiec 0,29 s zamiast 0,4 s).

`normal` zachowuje liczby obecnej gry (HP, obrażenia, liczebność, czasy, tokeny pokoju)
i dodaje taktyki oraz celniejszych strzelców. Mocniejszy wariant, sprawdzony w symulacji, opisuje sekcja „Normalny trudniejszy niż dziś”.

## Wybór i zamrożenie

- `Settings.difficulty?` (`src/core/save.ts`): brak w starym zapisie oznacza `normal`; błędna wartość też. `SAVE_VERSION` bez zmian.
- `selectedDifficulty()`: nadpisanie z `?difficulty=<id>` (`src/main.ts`) albo komendy debug `difficulty <id>`, potem ustawienie, potem `normal`.
- `RunManager.newRun()` zapisuje wybór w `RunState.difficulty` (pole opcjonalne, pomijane dla `normal`). Checkpoint i serializacja je przenoszą; zmiana ustawień w trakcie runu nie zmienia runu. Stary run bez pola → `normal`.
- `EnemyManager` (`src/enemies/manager.ts`): `options.difficulty`, potem `options.run` (RunState z `seed` → trudność runu; stan walki misji bez `seed` → bieżące ustawienie), potem `selectedDifficulty()`. Wiąże poziom z `EventBus`, więc `WaveDirector` tej samej sceny używa tego samego poziomu (`combatDifficulty`), zamrożonego przy `start()`.
- Czasy i rozrzut skaluje kopia definicji w `src/enemies/registry.ts` (`definitionFor`), HP i obrażenia: modyfikatory Stats o źródle `difficulty`.

## Zachowania AI

Wszystkie losowania idą przez `Rng` wroga (`spawn:<n>`) lub dyrektora (`coordination`), bez `Math.random`.
Promienie taktyczne (`src/enemies/tactics.ts`, `clearWorld`) widzą tylko geometrię świata, bez wrogów i sensorów.

1. **Flankowanie (Szturmowiec, Egzekutor, Tarczownik)**, `src/enemies/assaulter.ts` (`tryFlank`, ruch po łuku w gałęzi `chase`).
   Gdy inny wróg wręcz zapowiada lub zadaje cios, a ten stoi w kącie < 60° od niego względem gracza,
   z szansą `flankChance` wybiera punkt na promieniu flankowania przesunięty o ±60–120° wokół gracza.
   Idzie tam po łuku (krok celu ≤ 15°, żeby nie przechodzić przez gracza), korzystając z istniejącego ruchu i omijania ścian.
   Jeden raycast sprawdza, czy punkt nie jest za ścianą; ponowna próba najwcześniej po 1,5 s, limit dojścia 3 s.
2. **Krycie się (Strzelec)**, `src/enemies/gunner.ts` (`seekCover`, `updateCover`).
   Po serii albo przy HP ≤ 35% z szansą `coverUse` szuka w promieniu 3 i 6 m (16 kierunków) punktu bez linii strzału do gracza,
   osiągalnego prostą drogą, z podłożem i dość szerokiego dla kapsuły. Idzie tam, czeka 1,2 s za osłoną (bez celowania),
   wraca na poprzednią pozycję i strzela kolejną serią. Bez osłony zostaje jak dziś. Snajper nie korzysta z osłony.
   Widoczność z osłony jest sprawdzana co 0,25 s (cache), szukanie najwyżej raz na 1,5 s.
3. **Atak grupowy**, `src/enemies/director.ts` (`requestGroupToken`, `pressure`).
   Wróg wręcz gotowy do ciosu czeka do 0,35 s na partnera z innej strony (≥ 60°). Obaj dostają token w tym samym kroku,
   więc zapowiedzi zaczynają się prawie jednocześnie. Po `melee_blocked` gracza przez 1,2 s trwa okno ostrzału:
   Strzelcy z szansą `groupAttack` skracają odpoczynek i zaczynają celowanie, bez skracania zapowiedzi.
   Na `easy` (`groupAttack: 0`) koordynacji brak.
4. **Reakcja na gracza.**
   Ciężki cios gracza (`melee_swing` stage `heavy`) skierowany w wroga wręcz w zasięgu 5 m
   z szansą `heavyDodgeChance` przerywa jego zapowiedź i cofa go o ok. 0,35 s ruchu (`assaulter.ts`, nasłuch `melee_swing`).
   Doskok gracza (`dash_used`) w stronę Strzelca w zasięgu 10 m z szansą `dashDodgeChance` przerywa celowanie i odsuwa go w bok
   (`gunner.ts`, nasłuch `dash_used`).

## Symulacja poziomów

`tests/unit/difficultySim.test.ts`, bez renderu, prawdziwy Rapier i `ProjectileSystem`, harness `tests/unit/difficultyHarness.ts`.
Jedna fala: 6 Szturmowców i 2 Strzelców (liczebność wg poziomu), spawn na okręgu 9 m, tokeny pokoju 3/2, 30 s, 4 seedy.
Gracz stoi w środku i ma nieskończone HP; „śmierć” to pierwsze 100 odebranych obrażeń (HP gracza w pokojach).

- bot `block`: stoi i blokuje (×0,3, ciężkie ciosy przebijają) i emituje `melee_blocked` jak ostrze;
- bot `fight`: bez bloku, obrót 240°/s do najbliższego, cios 35 co 0,9 s (co trzeci ciężki) w stożku ±35° i 2,8 m, co 4 s doskok w stronę Strzelca.

`baseline` to gra sprzed zmian: wszystkie mnożniki 1, tokeny pokoju, taktyki wyłączone.

| Poziom          | block: obrażenia / 30 s | block: „śmierć” [s] | fight: obrażenia / 30 s | fight: „śmierć” [s] | fight: zabici | wrogów w fali |
| --------------- | ----------------------- | ------------------- | ----------------------- | ------------------- | ------------- | ------------- |
| baseline (dziś) | 550                     | 7,0                 | 1077                    | 2,7                 | 6             | 8             |
| easy            | 118                     | 24,7                | 325                     | 7,2                 | 5             | 7             |
| normal          | 583                     | 6,7                 | 1085                    | 2,9                 | 6             | 8             |
| hard            | 1153                    | 4,2                 | 2951                    | 2,5                 | 8             | 11            |
| nightmare       | 1678                    | 3,6                 | 4344                    | 2,2                 | 9             | 12            |

Test wymaga monotonicznego wzrostu z zapasem ≥ 20% między kolejnymi poziomami i deterministycznego przebiegu dla tego samego seeda.

### Normalny trudniejszy niż dziś

Same taktyki dają w symulacji `normal` ≈ dziś (+6% przy bloku, +1% w walce). Bot widzi wszystko, a blok działa dookoła,
więc flankowanie i krycie się nie dają tu przewagi, jaką mają przy realnym polu widzenia; zabierają za to czas na ruch.
Pomiar wariantu `normal` z `health` 1,1, `damage` 1,1, `attackTokens` 4 i `burstBreak` 0,9:
block 723 (+31% względem dziś), fight 1266 (+18%). Ten wariant zmienia liczby, które sprawdza ok. 30 istniejących testów
(m.in. `aiTest`, `enemies`, `enemiesZ16`, testy Poziomu zagrożenia i pokoju bossa), dlatego nie jest włączony.

## Kontrakt integracji

- `DifficultyId`, `difficulties`, `selectedDifficulty()`, `setDifficultyOverride()`, `runDifficulty()` w `src/world/difficulty.ts`.
- `NewRunOptions.difficulty?` wymusza poziom runu; bez niego `selectedDifficulty()`.
- `EnemyManagerOptions.difficulty? | run? | profile?` (`profile` tylko dla testów i symulacji); `EnemyManager.difficulty` jest tylko do odczytu.
- `WaveDirectorDeps.difficulty?`: identyfikator lub czytnik; bez niego poziom managera z tej samej szyny zdarzeń.
- `EnemyDependencies.difficulty?`, `targetForward?`; `getTarget()` może zwrócić `yaw` (kierunek patrzenia gracza).
- `EnemyDirectorApi.requestGroupToken?`, `pressure?`.

UI zapisuje `Settings.difficulty` przez `saveSettings`; zmiana działa od następnego runu.
