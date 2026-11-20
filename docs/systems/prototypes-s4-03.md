# Prototypy eskorty więźnia i wagonu (S4-03)

Zadanie S4-03 z `docs/backlog-rozwoju-2026-2027.md`: dwa proste prototypy do decyzji właściciela D2
(czy misje M02 „Punkt kontrolny” i M04 „Ładunek klasy K” wchodzą do dema). Fabuła:
`docs/fabula/misje/misja-02-punkt-kontrolny.md` (więzień, Nadia z paskiem HP),
`docs/fabula/misje/misja-04-ladunek-klasy-k.md` (wagon z wytrzymałością).
To prototyp w izolowanych modułach i scenach debug (wariant A): system misji, AI wrogów, zapis
i fizyka nie zostały zmienione. Prototyp **nie jest** typem celu misji.

## Jak uruchomić (30 s)

| Prototyp        | Adres                         | Co zrobić                                                                                                                                                                   |
| --------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eskorta więźnia | `?scene=escort-test&debug=1`  | Podejdź do klęczącego więźnia (bursztynowy pierścień) i stój przy nim 1,5 s. Prowadź go do białej strefy ewakuacji (ok. 90 m w linii prostej, trasa z zakrętami).           |
| Eskorta wagonu  | `?scene=payload-test&debug=1` | Podejdź do wagonu na torze (bursztynowy pierścień zasięgu pchania). Skład jedzie, dopóki jesteś przy nim, a wrogowie nie stoją w pobliżu. Postoje: Brama, Rozjazd, Wiadukt. |

Parametr `room=<id>` podmienia pokój (wymaga `arena` w danych; pozycje w JSON są pod pokój domyślny):
domyślnie `arenaContainerPort` (eskorta) i `arenaRailYard` (wagon). `seed`, `loadout`, `threat`
działają jak w `room-test`. Plik szybkiej weryfikacji: `god` na początku, potem `kill all` zamiast
walki.

### Komendy debug (konsola `` ` ``)

| Komenda                 | Efekt                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| `escort free`           | uwalnia więźnia bez czekania                                         |
| `escort tp <x> <z>`     | przenosi więźnia (test utknięć i smyczy)                             |
| `escort status`         | JSON ze stanem więźnia (stan, pozycja, HP, `stuckEvents`)            |
| `escort hp <n>`         | ustawia HP więźnia (`0` = porażka)                                   |
| `payload status`        | JSON ze stanem wagonu (status, dystans, postęp, HP, postój)          |
| `payload skip`          | skok do następnego postoju (z postoju: do kolejnego; na końcu: meta) |
| `payload hp <n>`        | ustawia wytrzymałość wagonu (`0` = porażka)                          |
| `god`, `kill all`, `tp` | istniejące komendy pokoju                                            |

`window.__neoryder.query('escort')`, `query('escortPath')` (ścieżka nawigacji więzień → ewakuacja)
i `query('payload')` zwracają to samo dla testów e2e.

## Zachowanie

### Więzień — `src/world/escortNpc.ts`

Czysta logika kinematyczna (bez Three, DOM i fizyki), stopy w `position`, wysokość z punktów nawigacji.

| Stan        | Opis                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `waiting`   | klęczy; gracz w `freeRadiusM` przez `freeHoldS` (albo `escort free`) → `following`                                           |
| `following` | idzie za graczem po `ArenaNavigation.next`, trzyma `followDistanceM`, biegnie z `catchUpSpeedMps` powyżej `catchUpDistanceM` |
| `holding`   | gracz dalej niż `leashM` → staje; rusza, gdy gracz wróci w `leashResumeM`                                                    |
| `evacuated` | wszedł w strefę ewakuacji (`evacRadiusM`) → sukces                                                                           |
| `dead`      | HP 0 → porażka                                                                                                               |

Utknięcie: w `following` przesunięcie < `stuckEpsM` przez `stuckS` zwiększa licznik `stuckEvents`
(raport) i przesuwa więźnia do następnego punktu `path()` (>= `unstickMinStepM`).

Brief mówił o „akcji interakcji”. W grze nie ma klawisza interakcji (misje używają przebywania
w strefie, jak cele `interact`), więc uwolnienie to **postój w promieniu** przez `freeHoldS`. Dodanie
akcji wymaga zmiany `src/core/input` (Architekt) i wchodzi do wariantu B.

### Wagon — `src/world/railPayload.ts`

Trasa to polilinia z danych (`route`), postoje (`stops`) mają dystans `atM`, `holdS`, nazwę fali
i `clearRequired`.

| Status          | Opis                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `waitingPlayer` | gracz dalej niż `pushRadiusM`: wagon stoi                                                                 |
| `contested`     | żywy wróg w `contestRadiusM`: wagon stoi                                                                  |
| `moving`        | jedzie z `speedMps`                                                                                       |
| `holding`       | postój: hak `reinforce(wave, stopId)` raz, rusza po `holdS` i (gdy `clearRequired`) po wyczyszczeniu fali |
| `arrived`       | koniec trasy → sukces                                                                                     |
| `destroyed`     | HP 0 → porażka                                                                                            |

Wyczyszczenie fali to brak żywych wrogów w pokoju **i** brak wrogów jeszcze niewprowadzonych przez
dyrektora fal (`pending`). Hak `reinforce` w scenie uruchamia `WaveDirector` z definicji fal w danych
(własne punkty spawnu przy trasie), a nie `reinforceMission`.

### Obrażenia i wrogowie

- Cele mają `Health` i hurtbox (collider bez ciała) w grupie `Player` z filtrem tylko
  `EnemyProjectile`. Pociski wrogów je trafiają; ostrze gracza, pociski i promienie gracza oraz
  kontroler gracza już nie (test: `tests/unit/prototypeScenes.test.ts`). Drużyna `neutral`: ich śmierć
  nie emituje `enemy_killed` ani `player_died`.
- Wrogowie nadal celują **wyłącznie w gracza** (`getTarget` bez zmian), więc cele obrywają tylko
  rykoszetem pocisków lecących w gracza (strzelcy). Wrogowie wręcz (`assaulter`) ich nie biją:
  `strike()` bierze tylko `target.id`.
- Scena ustawia `enemy.moveGoal = ArenaNavigation.next(wróg, gracz)` (jak tryb Przejęcia): marsz
  po nawigacji działa dla `assaulter` i `gunner`, dalej niż `detectRangeM` od gracza.
- Gracz poza siatką nawigacji (np. na torach) dostaje najbliższy punkt siatki (`navGoal`).

### Znane niedoskonałości prototypu

- Baner fal HUD gry pokazuje „FALA n / 99”: fale bazowe `RoomScene` mają nieosiągalną liczbę (99),
  żeby `wave_cleared` fal prototypów nie zamykał pokoju (otwarcie wyjścia, `room_cleared`).
- Po śmierci gracza prototypy nie mają własnej obsługi (działa ekran śmierci pokoju); `god` ją omija.
- Wrogowie wręcz i drony nie robią krzywdy celom (patrz wyżej), a strzelcy tylko przypadkiem.

## Liczby (`src/core/tuning.ts`, `prototypes`, widoczne w lil-gui)

| Klucz                                    | Wartość   | Znaczenie                        |
| ---------------------------------------- | --------- | -------------------------------- |
| `escort.maxHealth`                       | 120       | HP więźnia                       |
| `escort.speedMps` / `catchUpSpeedMps`    | 4,5 / 8   | marsz / bieg (gracz: 7 / 11)     |
| `escort.followDistanceM`                 | 3         | odległość zatrzymania za graczem |
| `escort.catchUpDistanceM`                | 10        | od tej odległości bieg           |
| `escort.leashM` / `leashResumeM`         | 25 / 20   | smycz (stop) / powrót do marszu  |
| `escort.freeRadiusM` / `freeHoldS`       | 2,5 / 1,5 | uwolnienie                       |
| `escort.evacRadiusM`                     | 4         | strefa ewakuacji                 |
| `escort.stuckS` / `stuckEpsM`            | 2,5 / 0,5 | wykrywanie utknięcia             |
| `payload.maxHealth`                      | 400       | wytrzymałość wagonu              |
| `payload.speedMps`                       | 3,5       | prędkość (fabuła: 3–4 m/s)       |
| `payload.pushRadiusM` / `contestRadiusM` | 9 / 22    | pchanie / blokada przez wroga    |

Pozostałe (rozmiary hurtboxa, wysokość znaczników, czas przejścia animacji) są w tym samym bloku.
Dane poziomów: `src/data/prototypes/escortTest.json` (pokój, więzień, strefa ewakuacji, fala pościgu),
`src/data/prototypes/payloadTest.json` (pokój, trasa, postoje, fale). Walidacja zod w
`src/world/prototypes.ts` (m.in. rosnące `atM` w granicach trasy, istniejące fale).
Teksty HUD: `src/data/ui/prototypes.pl.json`.

## Widok i HUD

- Więzień: `npc_civilian.glb` z klipami `npc_anims.glb` (`Crouch_Idle_Loop`, `Idle_Loop`, `Walk_Loop`,
  `Jog_Fwd_Loop`; ładowanie przez te same loadery co kryjówka, strój bez rekwizytów, kolory z tuning
  kryjówki). Bez modeli: kapsuła zastępcza. Poległy leży, ewakuowany znika.
- Wagon: `public/assets/models/city/port_flatcar.glb` (zastępczo prostopadłościan). Brak modelu
  lokomotywy: skład to sam wagon.
- Znaczniki: bursztynowy pierścień i słup (uwolnienie, postoje, zasięg pchania), biały (ewakuacja, meta
  trasy). Paleta ADR 0006: bez czerwieni, cyanu i magenty.
- HUD w DOM (`src/ui/prototypeHud.ts`): stan, pasek HP, pasek uwalniania albo postępu trasy,
  komunikat sukcesu i porażki, licznik `stuckEvents`.

## Koszt

| Obszar                      | Pliki                                                                                                                                                      | Linie |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Logika                      | `src/world/escortNpc.ts`, `railPayload.ts`, `prototypes.ts`                                                                                                | ~500  |
| Sceny, widoki, HUD          | `src/scenes/prototypeScene.ts`, `escortTest.ts`, `payloadTest.ts`, `prototypeViews.ts`, `src/ui/prototypeHud.ts` + `.css`                                  | ~1050 |
| Dane i teksty               | `src/data/prototypes/*.json`, `src/data/ui/prototypes.pl.json`                                                                                             | ~165  |
| Testy                       | `tests/unit/escortNpc`, `railPayload`, `prototypeData`, `prototypeScenes`, `tests/e2e/prototypes.spec.ts`                                                  | ~800  |
| Zmiany w istniejącym kodzie | `roomScene.ts` (11 pól i 2 metody `private` → `protected`), `roomTest.ts` (wydzielone `roomTestRun`), `hubNpcs.ts` (2 × `export`), `index.ts`, `tuning.ts` | ~80   |

Całość to około 2,5 tys. linii (z testami) w 16 nowych plikach i 5 zmienionych. Szacunek wersji
produkcyjnej (wariant B, typy celów w systemie misji, checkpointy, nawigacja w liniowych poziomach,
reakcja AI na cele): kilka razy więcej; największe pozycje to zmiany AI wrogów i zapis stanu NPC.

## Ryzyka dla wersji produkcyjnej

1. **Wrogowie nie atakują celowo więźnia ani wagonu.** `getTarget()` zwraca tylko gracza, melee
   bierze `target.id`, drony i wieżyczki celują w gracza. Prototyp pokazuje wyłącznie rykoszet.
   Wersja produkcyjna potrzebuje: listy celów (gracz + eskortowany) i reguły wyboru celu w AI
   (`src/enemies/*`, `types.ts`), rozdziału uwagi (priorytet agro, np. szturmowcy pod wagon wg fabuły
   M04), wspólnego `getTargets()` oraz `melee`/pocisków w grupie celu. To największy koszt i dotyka
   cudzego folderu (AI wrogów).
2. **Brak nawigacji w poziomach liniowych.** `ArenaNavigation` istnieje tylko dla pokoi z `arena`
   (duże areny). Poziomy liniowe misji (`levelSchema`) jej nie mają; trzeba zbudować siatkę albo
   użyć tras/waypointów w danych (dla wagonu wystarczy polilinia).
3. **Utknięcia więźnia.** Ruch jest kinematyczny po komórkach siatki (bez fizyki ani kolizji
   z innymi NPC/wrogami), więc przechodzi przez wrogów i inne obiekty dynamiczne. Gracz poza siatką
   (tory, skrzynie, dachy) wymaga przybliżania celu (`navGoal`); brak ścieżki daje utknięcia, które
   prototyp tylko liczy i przeskakuje o krok. Pola odległości `ArenaNavigation` są cache'owane
   dla każdej komórki celu, a cel (gracz) zmienia komórkę co 2 m, więc pamięć rośnie w czasie
   (przy produkcji: limit cache albo cel w stałych punktach).
4. **Czytelność.** Przy walce więzień jest szary i niski; wymaga akcentu w palecie (ciepła biel lub
   bursztyn), wskaźnika kierunku do strefy i komunikatów głosowych (Szron/Tomasz) o stanie. Wagon
   potrzebuje paska nad modelem (dziś tylko HUD) i czytelnego sygnału „stoję, bo wróg blisko”.
   Smycz 25 m i promień pchania 9 m wymagają playtestu. Hurtbox wagonu jest prostopadłościanem:
   pociski stają na nim jak na osłonie (gracz może się za nim chować, co fabuła M04 dopuszcza).
5. **Checkpointy i zapis stanu NPC.** Brak: stan więźnia i wagonu (pozycja, HP, dystans, indeks
   postoju, żyjące fale) nie jest serializowany. Mission checkpoint (`missionCheckpoint.ts`) i
   `saveVersion` wymagają rozszerzenia o te pola oraz decyzji, co dzieje się po śmierci gracza
   (powtórka od checkpointu z NPC w stanie z checkpointu?).
6. **Brak modelu lokomotywy.** Jest tylko `port_flatcar` z kontenerami; fabuła opisuje ciągnik
   spalinowy z wagonem i kontenerem klasy K, drzwi wyrwane magentowym błyskiem (finał). Potrzebne:
   model lokomotywy manewrowej, wagon z możliwością otwarcia i animacja finału (Grafika/Codex).
7. **Interakcja.** Brak akcji „użyj”: uwolnienie to postój w strefie, a dźwignie zwrotnic i rogatki
   z fabuły M04 oraz otwieranie kontenerów M02 wymagają jej albo reuse celu `interact`.
8. **Koszt wydajności.** Wrogowie liczą `ArenaNavigation.next` co krok; przy 5 wrogach i dużych
   arenach koszt był zaniedbywalny, ale prototyp nie mierzył 12 wrogów (limit areny).

## Zalecenie kolejnych kroków (bez decyzji za właściciela)

Jeśli D2 będzie pozytywna: wariant B, czyli typy celów `escort` i `payload` w systemie misji
(`missionSchema`, `missionObjectives`) z pojedynczym kontraktem „cel wrażliwy” (HP, pozycja,
stan, zdarzenia `objective_target_*` na `EventBus`), przeniesienie logiki `EscortNpc`/`RailPayload`
bez zmian (czyste moduły), nawigacja albo waypointy w poziomach liniowych, rozszerzenie AI o listę
celów (osobne zadanie dla właściciela `src/enemies/`), zapis stanu w checkpointach i trzeci
prototyp UI (wskaźnik kierunku, pasek nad wagonem). Jeśli D2 będzie negatywna: usunięcie
`src/scenes/{prototypeScene,escortTest,payloadTest,prototypeViews}.ts`, `src/world/{escortNpc,railPayload,prototypes}.ts`,
`src/data/prototypes/`, wpisu w `tuning.ts` i rejestrze scen nie wpływa na resztę gry (zmiany
w `roomScene.ts` to tylko widoczność pól).

## Testy

- `tests/unit/escortNpc.test.ts`: przejścia stanów, uwolnienie, smycz, ewakuacja, śmierć, utknięcie.
- `tests/unit/railPayload.test.ts`: pchanie, blokada przez wroga, postoje i hak fal, `clearRequired`,
  koniec trasy, porażka, `skip`, polilinia, walidacja.
- `tests/unit/prototypeData.test.ts`: walidacja danych, istnienie pokoi i wrogów, ścieżka więzień → ewakuacja,
  punkty spawnu w siatce nawigacji.
- `tests/unit/prototypeScenes.test.ts`: sceny bez przeglądarki, uwolnienie, obrażenia pociskami wrogów (nie
  gracza), brak blokowania gracza, postój z falą, koniec trasy.
- `tests/e2e/prototypes.spec.ts`: pełne przejścia obu prototypów oraz porażki.
