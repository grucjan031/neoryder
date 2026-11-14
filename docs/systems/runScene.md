# Host runu — F3-07

`src/scenes/run.ts`, scena `?scene=run&seed=test1&loadout=classic&debug=1`.
Host składa `RunManager`, pokoje i ekrany; logika stanu pozostaje w
`src/world/run.ts`. Kontrakty rozszerzeń są w `docs/api.md`.

## Przepływ

- Start generuje mapę sektora Kurogane Arms. `run_started` emituje wyłącznie
  `RunManager`; `main.ts` pomija własną emisję dla sceny `run`.
- Wybór dostępnego węzła (mysz, 1/2/3, Enter; Tab pozwala wybrać czwarty)
  tworzy nowy `RoomScene` i świat Rapier. Host przekazuje kopię `RunState`,
  ten sam EventBus i `new Rng(seed).fork('room:<nodeId>')`.
- Układ jest losowany z `sector.roomPools[type]`, a przy braku puli z pokojów
  tego typu. Do czasu dostarczenia pokojów specjalnych używany jest układ
  `combat`. Wybór ma osobny strumień `room-layout:<nodeId>`; `planWaves`
  otrzymuje główny RNG runu i sam wykonuje wymagany fork pokoju.
- `combat` i `elite`: `room_cleared` → eksport HP/energii → zniszczenie pokoju
  → nagroda → Dalej → mapa. Brak pasywnego leczenia.
- `shop` i `rest`: po inicjalizacji pokój jest czyszczony bez kroku walki,
  co otwiera exit i nakładkę. Dalej niszczy pokój i wraca na mapę.
- `puzzle`: tymczasowo czyszczenie i powrót na mapę; generator ma wagę 0.
- `boss`: tymczasowo fale zwykłego `combat`, z zachowaniem typu boss w
  zdarzeniach. `room_cleared` kończy run zwycięstwem, bez nagrody.
- `player_died` kończy run przez `RunManager`; host usuwa zapis, niszczy pokój
  i pokazuje proste podsumowanie z przyciskiem Menu (`/`).

Obsługa zakończenia pokoju/runu jest odroczona do końca kroku lub mikrozadania.
Świat nie jest zwalniany w środku `RoomScene.step`, `clear` ani strumienia
zdarzeń obrażeń. Zakończenie runu ma pierwszeństwo przed czyszczeniem pokoju.
`dispose()` podczas ładowania odpina hosta od razu, a pokój zwalnia po
zakończeniu jego inicjalizacji. Render i symulacja nie dotykają niegotowego pokoju.

## Integracje i elementy tymczasowe

`RunScreens` jest wstrzykiwany. Domyślne `HtmlRunScreens` w `src/ui/` używa
tekstów walidowanych przez zod z `src/data/ui/run.pl.json`. Nakładki zwalniają
kursor, wybór węzła wznawia grę przez `ctx.resume`. Zadania F3-13/14 zastąpią UI.
Nagroda emituje `reward_offered` z pustą listą i pokazuje „brak nagród”.
Oferty, zakupy, leczenie i ulepszenia pozostają integracją F3-09/11.

`RunSavePort` przenosi cały `RunState`: `loadRun`, `saveRun`, `clearRun`.
Domyślnie jest no-op, ponieważ obecny SaveStore v1 nie zapisuje stanu runu.
F3-06 może podpiąć adapter bez zmiany hosta. Zapis następuje przy każdym
wejściu na mapę, usunięcie przy `run_ended`. Operacje są szeregowane, aby
zaległy zapis nie odtworzył zakończonego runu. `?continue=1` odtwarza mapę
i bieżący węzeł z portu; brak zapisu zgłasza błąd. Błędy zapisu są widoczne
w `query('saveError')` i konsoli. Domyślny port nie zapewnia trwałego wznowienia.

Kredyty za zabójstwa gracza są przekazywane do `RunManager.creditKill`:
host śledzi `entity_spawned`/`entity_despawned` i `enemy_killed`, odczytuje
`threatCost` z istniejących definicji wrogów. Pokój ma osobny rejestr komend,
a host przekazuje do niego komendy walki; po zniszczeniu pokoju cheaty hosta
pozostają dostępne i nie występuje nadpisywanie `hurt`.

## Debug i test ręczny

- `run node <id>` wybiera wyłącznie dostępny węzeł, bez teleportacji po mapie.
- `run clear` czyści gotowy pokój; `run state` zwraca JSON stanu.
- `run end win|lose`, `hurt <n>`, `credits <n>` działają w scenie run.
- Opcjonalny `implant <id>` jest rejestrowany po wstrzyknięciu niepustego
  rejestru definicji; dodaje implant na mapie, a następny pokój nakłada go
  przez istniejące API RoomScene. Zmiana implantów podczas walki wymaga F3-09.
- `query`: `screen`, `runState`, `map`, `room` (id układu), `runLog`,
  `loading`, `runError`, `saveError`. Pozostałe nazwy trafiają do pokoju.

Weryfikacja w 30 sekund: otwórz powyższy URL, wybierz pierwszy węzeł,
wykonaj `run clear`, obejrzyj „brak nagród”, naciśnij Enter. Sprawdź dostępne
węzły kolejnej warstwy i brak zmiany HP. W walce zwróć uwagę na zachowanie
kamery i brak przypadkowego ataku po powrocie z nakładki.

`tests/unit/runScene.test.ts`: przepływ z atrapami, zapis mapy, wznowienie,
śmierć, trzy rzeczywiste pokoje (`loadModels: false`) bez wycieku handlerów
i z trzema `world.free()`, automatyczne nakładki, zastępczy boss, cheaty,
koniec podczas ładowania oraz kolejność save/clear.
`tests/unit/runScreens.test.ts`: mysz, klawiatura, czwarty węzeł i konsola.
`tests/e2e/runScene.spec.ts`: pierwszy pokój, clear, nagroda, mapa i drugi
pokój z klawiatury. Uruchomienie e2e pozostaje po stronie zlecającego.
