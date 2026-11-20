# RoomScene — F3-04

`src/scenes/roomScene.ts` składa walkę pokoju z tych samych systemów co Arena:
osobny świat Rapier, `EntityRegistry`, obrażenia, statusy, pociski, AI, kontroler
gracza, ostrze, HeldItem, bronie, moce, synergie, HUD i efekty. Arena pozostaje
poligonem; jej skład nie został zmieniony. Deduplikacja jest w backlogu.

## Wejście i wyjście

```ts
const room = new RoomScene(definition, run, plannedWaves, {
  loadModels: true,
  implantDefinitions,
  patches: [], // DefinitionPatch[] (F4-03), domyślnie puste
});
await room.init(roomContext, three);
// roomContext.rng = rng runu .fork(`room:${run.currentNodeId}`)
// Host przekazuje ten sam EventBus między pokojami.
const resources = room.exportState(); // { hp, energy }
room.dispose();
```

Pokój wymaga bieżącego węzła mapy oraz znanego ekwipunku. Nie odczytuje loadoutu
z URL i nie bierze zdrowia z geometrii pokoju. Bazowe statystyki walki są
w `src/data/scenes/roomPlayer.json`, walidowane zod; odpowiadają bazie Areny.
Implanty otrzymuje jako mapę definicji od hosta (loader F3-09), a fale jako gotowe
`WavesDefinition` (planer F3-08). Nieznany implant przerywa konstrukcję sceny,
zamiast po cichu pomijać bonus.

Ekwipunek (`run.loadout`) przechodzi przez `resolveLoadout(run.loadout, patches)`
(`docs/systems/patches.md`): ostrze, bronie i moce pochodzą z `ResolvedLoadout`, a nie
z globalnych map; bez łatek definicje są tymi samymi obiektami co w mapach. Błędna łatka
na przedmiot z ekwipunku przerywa konstrukcję sceny. `query('resolvedLoadout')` zwraca
kopię użytych definicji.

Każdy modyfikator implantu jest dodawany do obu instancji `Stats` ze źródłem
`implant:<id>`. Dopiero potem `Health.set(run.hp)` i `PlayerEnergy.set(run.energy)`
przywracają zasoby z uwzględnieniem aktualnego maksimum. Nie ma leczenia ani
resetu zdrowia między pokojami. `exportState` daje nowy obiekt i nie zmienia
przekazanego `RunState`. Ciepło broni zaczyna od zera. Obsługa wyzwalaczy implantów
pozostaje w systemie implantów F3-09/10; RoomScene przekazuje ich tagi do synergii.

## Przebieg i drzwi

Po utworzeniu świata i wyposażenia wejście oraz wyjście są zamkniętymi czarnymi
bryłami z colliderami świata. `room_entered` niesie id węzła, id układu, typ
i warstwę. Fale startują po tym zdarzeniu, ze strumieniem `ctx.rng.fork('waves')`
(`ctx.rng` = `new Rng(seed runu).fork('room:<nodeId>')`, tworzony przez host).
Limit żywych wrogów uwzględnia zarówno definicję fal, jak i limit pokoju oraz
limit ciał fizycznych. Lokalizacje fal pochodzą od planera, bez modyfikacji sceny.

Po `wave_cleared` ostatniej fali (`wave === totalWaves`) scena wyłącza collider i
widok drzwi exit (drzwi to bryły z materiałem `interactive`, rozmiar i pozycja z
definicji), a następnie emituje `room_cleared {nodeId, type, timeS}` dokładnie raz. Wejście pozostaje zamknięte.
`timeS` to suma dodatnich kroków symulacji podczas żywej walki, bez hitstopu
ani czasu po ukończeniu. Host przejmuje dalszy przepływ runu. `clear()` usuwa
wrogów, statusy i pociski oraz kończy pokój bez czekania na kolejkę fal.
Śmierć zatrzymuje fale i moce; `clear()` po śmierci nie otwiera drzwi i nie
emituje ukończenia. Pokój nie oferuje restartu ani wyboru buildu.

Pokoje shop/rest nie mają fal: host (`RunScene.openRoom`) przekazuje definicję fal
bez fal (`waves: []`, `firstBreakS` 0, `maxAlive` 1) i zaraz po `init` woła
`room.clear()`; ten sam pusty plan dostają pokoje w trybie (`modeId`, `maxAlive`
z trybu) i pokój bossa (`maxAlive` = `layout.maxAlive ?? 1`). Pusty `WaveDirector`
kończy od razu w fazie `done` bez `wave_cleared`.

**Limit żywych wrogów (`spawnEnemy`):** odmowa, gdy żywi (stan ≠ `dead`) ≥
`min(waves.maxAlive, layout.maxAlive ?? waves.maxAlive)` albo liczba ciał Rapiera ≥
`tuning.physics.maxDynamicBodies`.

**Gdy `completeRoom` jest zablokowane** (zwraca bez `room_cleared`): tryb przejęcia /
szturmu / skoku bez `outcome === 'victory'`; węzeł stały misji z celami bez
ukończonej misji; poziom liniowy (`linearMission`) zawsze; pokój już ukończony,
gracz martwy lub scena zwolniona. W przejęciu/szturmie/skoku fale nie startują
(`director.start()` pomijane), a spawn wrogów prowadzi tryb: co krok
`arena.spawnPosition(layout, gracz, pozycje wrogów, ctx.rng, okluzja)` i, gdy jest
pozycja, `ctx.rng.pick(definition.enemies)` (szczegóły losowania:
[arenas.md](arenas.md), [modes.md](modes.md)); zwycięstwo trybu wywołuje
`completeRoom`. Śmierć w szturmie i skoku nie kończy runu: licznik odrodzenia
(`stepRespawn`), po nim `respawnAssault` (pełne zdrowie/energia, reset broni i
mocy, teleport do `assault.sector.playerSpawn` lub punktu ekstrakcji).

**Misja w pokoju** (`run.missionId` lub `linearMission`): `MissionObjectives` z
promieniami `tuning.mission.zoneRadiusM` i `pickupRadiusM`; strażnicy węzła stałego
(`fixedNodes[].guards`) powstają przy `init` na okręgu wokół celu/pozycji, kąt
`π/2 + i·2π/n`; posiłki celu uruchamiają osobny `WaveDirector` z
`ctx.rng.fork('reinforcement:<klucz celu>')` na punktach `layout.spawnPoints`
(chyba że host poda `options.reinforce`, jak poziom liniowy). Węzeł stały z celami
kończy pokój po ukończeniu wszystkich celów. Zabicie bossa w misji oznacza cele
`killBoss` jako wykonane i rozpuszcza pozostałych wrogów.

**Zwycięski rozpad** (`enterVictoryHold`, wołane przez host po ostatnim pokoju):
zatrzymuje dyrektora, usuwa pociski i statusy, nadaje graczowi mnożnik
`damageTaken` 0 (źródło `victory-hold`) i zabija pozostałych wrogów obrażeniami ze
źródła `null` z tagiem `#victory_hold` (rozpad bez zabójstw i kredytów).

**Tryb bossa (F3-17):** gdy `layout.bossEnemy` jest ustawione, `RoomScene` nie startuje
`WaveDirector` (fale są ignorowane), tworzy bossa po inicjalizacji (po
`room_entered`) w pozycji rekwizytu `props[kind='bossSpawn']` (brak → `0,0,0`;
wróg musi być typu boss, inaczej wyjątek) i wywołuje `completeRoom` na
`enemy_killed` bossa. Fazy bossa 2 i 3 wysyłają sygnał misji `boss:phase:<n>`. Dodatkowe komendy: `boss phase <n>`,
`boss pattern summon|shield`; `query('boss')`. Punkty spawnu układu trafiają do
`EnemyManager` jako punkty wezwań. Szczegóły: `docs/systems/enemies.md`, `runScene.md`.

## HeldItem i debug

`Loadout.startHeld` ustawia jedną rzecz w ręku. Tak jak w Arenie, HeldItem
rozdziela wejście ostrza i spust broni: R zmienia rękę, PPM przywraca ostrze
i blok, rzut przywraca ostrze, 1/2/3 wybiera broń, moce działają niezależnie.
`hold blade|gun` ustawia rękę natychmiast. Pozostałe komendy walki:
`god`, `spawn <id> [n]` (1–50, 8 m przed graczem), `hit <dmg>`, `kill all`, `wave <n>`,
`status <id> [s]`, `hurt <n>`, `tp <x> <z> [yawDeg] [pitchDeg] [floorY]`,
`look <yawDeg> [pitchDeg]`, `execute ready`, `weaken <procent>`, `hazard list`,
`hazard detonate <id>`, `implant <id>`, `talent <id>|reset`, `boss phase <n>`,
`boss pattern summon|shield`, a w trybach `conquest capture <A–E>`,
`conquest tickets <n>`, `assault destroy <A|B>`, `assault lives <n>`,
`heist grab|drop|extract|lives <n>` i w misji `objective done <id>`.
Zapytania: `horizon`, `weather`, `executable`, `resolvedLoadout`, `boss`.
Komendy `run` należą do hosta; używa on `room.clear()`, które nie usuwa żywego
bossa celu `killBoss`.

`?scene=room-test&room=combatYard&loadout=gunner&seed=room-check` tworzy syntetyczny
run oraz stałe dwie fale z `src/data/waves/roomTest.json`. Punkty spawnu i limity
bierze z wybranego pokoju. Drugi układ: `room=combatPillars`. Tylko scena testowa
rejestruje `run clear` i usuwa tę komendę przy zwalnianiu sceny.

W 30 sekund: poczekaj na falę 1, sprawdź ogień LPM i przełączanie R/PPM,
wykonaj `hold blade`, potem `run clear`. Wyjście znika, wejście pozostaje
zamknięte. W feel zwróć uwagę na brak jednoczesnego strzelania i cięcia oraz
na identyczny czas zamiany przedmiotu jak w Arenie.

## Zasoby i testy

`dispose()` odpina subskrypcje i komendy, resetuje aktywne moce, usuwa widoki,
zwalnia kontroler oraz `world.free()`. Ponowne `dispose()` jest bezpieczne.
`roomModels.ts` buforuje obietnice ostylowanych modeli bloków GLB (także brak
pliku); każdy pokój dostaje własne węzły i współdzieloną geometrię. Geometria
cache żyje przez sesję i nie jest zwalniana przez pokój. Bryły zastępcze i drzwi
należą do pokoju. Widoki wrogów i ostrza mają własny istniejący cache modeli.

`tests/unit/roomScene.test.ts` działa w Node, bez DOM i z `loadModels: false`:
przenoszenie HP 37 i energii, obrażenia, brak leczenia, implanty na obu Stats,
HeldItem, kolejność zdarzeń, ostatnia fala, drzwi, czas, śmierć, deterministyczność
i trzy światy na jednym busie bez wycieków z kontrolą `world.free()`.
`tests/unit/roomModels.test.ts` sprawdza współdzielenie geometrii, osobne węzły
i cache błędów. `tests/e2e/roomScene.spec.ts` sprawdza oba układy, loadout,
pierwszą falę, `hold` oraz otwarcie drzwi przez `run clear`.

## Host poziomu liniowego

Scena `mission` przekazuje `RoomCombatState` (zasoby i wyposażenie bez RunState)
i jawny `options.node`. `linearMission` podaje definicję z pozycjami poziomu,
kolejność celów i zapisane stany; blokuje automatyczne `completeRoom`.
Host zarządza własnymi WaveDirector, checkpointami i bramami przez API opisane
w `docs/api.md`. `staticCellSize` włącza komórki istniejącego batchera statyki.
HUD nie pokazuje Kredytów runu ani nakładki śmierci. Standardowy konstruktor
z RunState i wszystkie domyślne opcje zachowują dotychczasowe działanie.
