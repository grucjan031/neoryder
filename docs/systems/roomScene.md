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
i warstwę. Fale startują po tym zdarzeniu, z `ctx.rng.fork('waves')`.
Limit żywych wrogów uwzględnia zarówno definicję fal, jak i limit pokoju oraz
limit ciał fizycznych. Lokalizacje fal pochodzą od planera, bez modyfikacji sceny.

Po `wave_cleared` ostatniej fali scena wyłącza collider i widok drzwi exit,
a następnie emituje `room_cleared` dokładnie raz. Wejście pozostaje zamknięte.
`timeS` to suma dodatnich kroków symulacji podczas żywej walki, bez hitstopu
ani czasu po ukończeniu. Host przejmuje dalszy przepływ runu. `clear()` usuwa
wrogów, statusy i pociski oraz kończy pokój bez czekania na kolejkę fal.
Śmierć zatrzymuje fale i moce; `clear()` po śmierci nie otwiera drzwi i nie
emituje ukończenia. Pokój nie oferuje restartu ani wyboru buildu.

Pokoje z nakładkami sklepu/odpoczynku wymagają integracji odpowiednich zadań F3;
w F3-04 wyczyszczenie obsługuje `WaveDirector`.

**Tryb bossa (F3-17):** gdy `layout.bossEnemy` jest ustawione, `RoomScene` nie startuje
`WaveDirector` (fale są ignorowane), tworzy bossa po inicjalizacji i wywołuje
`completeRoom` na `enemy_killed` bossa. Dodatkowe komendy: `boss phase <n>`,
`boss pattern summon|shield`; `query('boss')`. Punkty spawnu układu trafiają do
`EnemyManager` jako punkty wezwań. Szczegóły: `docs/systems/enemies.md`, `runScene.md`.

## HeldItem i debug

`Loadout.startHeld` ustawia jedną rzecz w ręku. Tak jak w Arenie, HeldItem
rozdziela wejście ostrza i spust broni: R zmienia rękę, PPM przywraca ostrze
i blok, rzut przywraca ostrze, 1/2/3 wybiera broń, moce działają niezależnie.
`hold blade|gun` ustawia rękę natychmiast. Pozostałe komendy walki:
`god`, `spawn <id> [n]`, `hit <dmg>`, `kill all`, `wave <n>`, `status <id> [s]`,
`hurt <n>`. Komendy `run` należą do hosta; używa on `room.clear()`.

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
