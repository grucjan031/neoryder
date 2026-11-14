# Bronie i pociski — F1 #06, F2-03

Kod symulacji: `src/combat/weapons/`. Render: `src/render/projectileRenderer.ts`.
Scena: `?scene=blaster-test&debug=1&seed=test`. Symulacja nie importuje Three.js
ani DOM, używa stałego kroku i przekazanego `EventBus` oraz `Rng`.

## Dane blastera

`src/data/weapons/*.json` są ładowane przez `import.meta.glob` i walidowane przy
ładowaniu przez `weaponSchema.ts`. `weaponDefinitions: ReadonlyMap<string,
WeaponDefinition>` pomija `plasmaBlade.json`. `loadWeapon(unknown)` rzuca czytelny
wyjątek z nazwą błędnego pola, a `loadWeaponDefinitions` odrzuca powtórzone ID.
Wariant broni powstaje przez dane zgodne ze schematem.

| Pole                | Wartość początkowa | Jednostka                 |
| ------------------- | ------------------ | ------------------------- |
| id                  | blaster            | identyfikator             |
| name                | Blaster            | nazwa UI                  |
| fireMode            | projectile         | tryb strzału              |
| automatic           | true               | ogień ciągły              |
| damage              | 20                 | obrażenia                 |
| fireRateHz          | 6                  | strzały/s                 |
| heatPerShot         | 14                 | ciepło/strzał             |
| projectileSpeed     | 60                 | m/s                       |
| projectileLifetimeS | 2                  | s                         |
| spreadDeg           | 0.6                | półkąt stożka w stopniach |
| tags                | `['#gun']`         | tagi obrażeń              |

`Blaster(owner, ctx, stats, projectiles, definition?, team?)` otrzymuje zależności
w konstruktorze. Scena zapewnia bazowe `Stats({ heatCapacity: 100, coolingRate: 45 })`.
`step(dt, { triggerHeld, origin, dir })` strzela przy trzymaniu spustu, z odstępem
`1 / fireRateHz`. Zwolnienie spustu nie kumuluje zaległych strzałów. `dt <= 0`
nie przesuwa czasu ani nie strzela. Rozrzut pochodzi z `ctx.rng.fork('blaster')`;
jest deterministyczny, niezależny od strumienia rodzica, równomierny na dysku
prostopadłym do kierunku strzału. Każdy strzał emituje `weapon_fired`.

## Tryby i dane F2-03

`Weapon(owner, ctx, stats, deps, definition, team?)` obsługuje wspólne tempo,
ciepło, blokadę i zbocze spustu. `deps.projectiles` udostępnia `spawn`.
`Blaster extends Weapon` zachowuje konstruktor i publiczne API F1, domyślne liczby
oraz strumień RNG `fork('blaster')`. Pozostałe bronie używają `fork(definition.id)`;
`reset()` odtwarza strumień i zeruje ciepło, blokadę, odnowienie oraz stan spustu.
Licznik `shots` pozostaje kumulacyjny, jak w F1.

`WeaponDefinition` to `z.discriminatedUnion('fireMode', ...)`. Wspólne pola:
`id`, polska nazwa `name`, `damage`, `fireRateHz`, `automatic`, `heatPerShot`,
`tags`, opcjonalne `statuses: [{ id, durationS, stacks? }]`. Obecne tryby mają
także `projectileSpeed`, `projectileLifetimeS` i `spreadDeg`.
Pola wspólne są oddzielone od pól pocisku, aby rozszerzyć unię w F2-04.

| Tryb         | Działanie i dodatkowe pola                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectile` | Jeden pocisk na strzał, rozrzut jak blaster F1.                                                                                               |
| `spread`     | `pellets` (całkowite ≥ 2) pocisków, każdy z pełnym `damage`, każdy kierunek losowany niezależnie przez `Rng` w stożku o półkącie `spreadDeg`. |
| `pierce`     | Jeden pocisk, `pierceCount` (całkowite ≥ 1) różnych celów, `pierceFalloff` w zakresie 0..1.                                                   |

Kod trybów jest w `src/combat/weapons/fireModes/`. Dla `automatic: false`
strzał zachodzi tylko przy `triggerHeld: false → true`. Wciśnięcie podczas
odnowienia lub przegrzania przepada; trzymanie nie wywoła strzału po odblokowaniu.
Dla `automatic: true` trzymanie strzela z częstotliwością `fireRateHz`.
Ciepło i `weapon_fired` naliczane są raz na strzał, również dla rozpraszacza.
Tryby `beam` i `lob` nie są jeszcze obsługiwane (F2-04).

Wszystkie dane mają tag `#gun`. Wstępny balans względem blastera (F2-18 dopracuje TTK):

| ID / nazwa              | Tryb / spust      | Obrażenia  | Strzały/s | Ciepło | Prędkość m/s | Życie s | Półkąt ° | Parametry                                      |
| ----------------------- | ----------------- | ---------- | --------- | ------ | ------------ | ------- | -------- | ---------------------------------------------- |
| `blaster` / Blaster     | projectile / auto | 20         | 6         | 14     | 60           | 2       | 0,6      | Bez zmiany zachowania F1.                      |
| `pistol` / Pistolet     | projectile / semi | 32         | 4         | 9      | 70           | 2       | 0,35     | Mocniejszy i oszczędniejszy pojedynczy strzał. |
| `rifle` / Karabin       | projectile / auto | 12         | 10        | 10     | 75           | 2       | 1,1      | Szybka seria, mniejsze obrażenia pocisku.      |
| `scatter` / Rozpraszacz | spread / semi     | 10 na śrut | 1,5       | 28     | 45           | 0,3     | 6        | 8 śrutów, maksymalny zasięg 13,5 m.            |
| `sniper` / Snajperka    | pierce / semi     | 80         | 1         | 45     | 180          | 2       | 0        | 3 cele; spadek 0,25: obrażenia 80 → 60 → 45.   |

## Ciepło

`blaster.heat` to wspólny `ResourcePool`: start 0, maksimum czytane na żywo
z `stats.get('heatCapacity')`, zmiana/s z `-stats.get('coolingRate')`.
Strzał wykonuje `heat.add(heatPerShot, { resetDelay: true })`.
Chłodzenie zaczyna się po `tuning.weapons.coolDelayS` (0,25 s).

Osiągnięcie maksimum uruchamia blokadę `tuning.weapons.overheatLockS` (1,5 s).
Chłodzenie działa w czasie blokady, a po jej upływie strzały są ponownie dozwolone.
Hitstop wstrzymuje oba zegary. `overheat()` ustawia maksimum i rozpoczyna blokadę
natychmiast (komenda debug). `overheated` i `shots` są dostępnymi odczytami.
`heat_changed` zawiera `{ id, current, max, overheated }`: emisja przy strzale,
wejściu/wyjściu z przegrzania oraz najwyżej co 0,1 s podczas chłodzenia.
Aktywne chłodzenie jest odłożone do F2 i zapisane w backlogu.

## Wspólny ProjectileSystem

Konstruktor przyjmuje `(world, entities, hurtboxes, damage, bus, tuning)`.
System jest wspólny dla gracza, AI i parowania. `spawn(spec)` zwraca nowy
`EntityId`, rejestruje encję `kind: 'projectile'` z drużyną ze specyfikacji
i emituje `projectile_spawned { id, owner, team }`.

Pula ma `tuning.weapons.maxProjectiles` slotów (256), zaalokowanych przy tworzeniu
systemu. Sloty ponownie wykorzystują obiekty pozycji i kierunku. Przy pełnej puli
**najstarszy aktywny pocisk jest usuwany**, jego encja niszczona, a slot używany
przez nowy pocisk z nowym ID. Limit określa pojemność przy tworzeniu systemu;
zmiana w panelu obowiązuje dla następnej instancji. Nie powstają ciała Rapier
ani collidery pocisków. `activeCount` zwraca zajętość, `dispose()` zwalnia encje.

`ProjectileSpec` zawiera pola z kontraktu F1: `owner`, `team`, `origin`, `dir`,
`speed`, `damage`, `tags`. Opcjonalne `lifetimeS` wybiera czas życia; bez niego
obowiązuje `projectileLifetimeS` z danych blastera (2 s). Blaster przekazuje
czas życia swojej definicji. System kopiuje origin, normalizuje dir i odrzuca
zerowy/nieskończony kierunek. Opcjonalne `statuses` są kopiowane do slotu
i przekazywane do `DamageInfo.statuses`, dalej zwykłą drogą przez `DamageSystem`.
Stan pocisku zawiera liczby, wektory, tagi, statusy i tablicę ID trafionych celów.

W każdym dodatnim kroku Rapier wykonuje `castRayAndGetNormal` po całym odcinku
przemieszczenia, najwyżej do pozostałego czasu życia. Zapobiega to przelatywaniu
szybkiego pocisku przez cienkie przeszkody. Filtry zapytania:

| Drużyna | Grupa promienia                    | Trafiane grupy         |
| ------- | ---------------------------------- | ---------------------- |
| player  | PlayerProjectile                   | Enemy + World          |
| enemy   | EnemyProjectile                    | Player + World         |
| neutral | PlayerProjectile + EnemyProjectile | Player + Enemy + World |

Filtr collidera celu musi dopuszczać odpowiednią grupę pocisku. Collider
właściciela jest pomijany przez predykat rejestru. Trafiony hurtbox przekazuje
obrażenia przez `DamageSystem.deal`, z mnożnikiem hurtboxa oraz punktem i kierunkiem
trafienia. Bez `pierce` pocisk wraca do puli przed emisją obrażeń, więc trafia
tylko raz. Trafienie świata lub koniec życia również niszczy encję i zwalnia slot.
Dodatkowe reguły drużyn i nietykalności nadal należą do `DamageSystem`.

`ProjectileSpec.pierce: { count, falloff }` pozwala trafić łącznie do `count`
różnych encji. Po trafieniu system omiata pozostały odcinek tego samego kroku,
pomijając wszystkie hurtboxy wcześniej trafionych encji, także w kolejnych
krokach. N-ty cel dostaje `damage × (1 − falloff)^(n−1)` przed mnożnikiem hurtboxa.
Ściana zatrzymuje także pocisk przebijający. Historia trafień, pozostały limit
i spadek obrażeń są zachowane po odbiciu; przechwycone trafienie nie zużywa limitu.
Nowy pocisk w slocie zeruje historię i nadpisuje statusy oraz parametry przebicia.
ID slotu jest sprawdzane po synchronicznych zdarzeniach, aby stary sweep nie
przesuwał nowego pocisku utworzonego przez handler obrażeń.

`reflect(id, newOwner, newTeam, dir)` zmienia właściciela, kierunek oraz drużynę
w slocie i `EntityRegistry.setTeam`, emitując `projectile_reflected`.
Następny sweep używa nowego filtra; prędkość, obrażenia i pozostały czas życia
są zachowane. Nieaktywny ID jest ignorowany. `forEachActive(cb)` udostępnia
`(id, pos, dir, team)` rendererowi; przekazanych wektorów nie należy modyfikować.

## Render i scena testowa

`ProjectileRenderer` ma dwa `InstancedMesh` ze współdzieloną geometrią wydłużoną
w osi Z: cyan `getMaterial('player')` i czerwony `getMaterial('enemyGlow')`.
Orientacja odpowiada kierunkowi lotu. Scena zachowuje poprzednie pozycje przed
krokiem i interpoluje je w `render(alpha)`; współdzielone materiały nie są
zwalniane przez scenę.

`blaster-test` używa wyłącznie publicznego API `PlayerController`; kamera FPP
interpoluje stan gracza. Strzały wychodzą z pozycji oka i bieżącego kierunku
symulacji (nie z interpolowanego kadru). **LPM to akcja `attack`**, zgodnie
z `src/data/inputBindings.json`; scena używa jej jako spustu blastera. Globalne
mapowanie pozostaje bez zmian (`shoot` jest przypisane do R).

Model `blaster.glb` jest dzieckiem kamery w prawym dolnym rogu. `applyStyle`
nadaje styl, a osobne lokalne materiały neonowe węzłów `heat_vents` i `heat_cell`
interpolują cyan → czerwień wraz z `heat.fraction`. Neony używają materiału unlit
zgodnie z rendererem stylu, co daje stałą jasność bez świateł. Brak GLB zastępuje
prosta bryła. Trzej manekini `enemy_trooper.glb` mają po 100 HP ze `Stats`,
hurtbox tułowia ×1 i głowy ×1,5. Śmierć wyłącza model/collidery, odrodzenie po
`tuning.damage.respawnS` przywraca HP i emituje `health_changed`.

Debug zawiera prosty pasek HTML ciepła, przegrzania i HP. `dispose` usuwa HTML,
komendy, subskrypcje, instancje renderu, lokalne materiały/geometrie i świat WASM.

| Komenda / query                    | Działanie                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `fire <n>`                         | kolejkuje n strzałów przed siebie, respektując szybkostrzelność i przegrzanie |
| `heat`                             | pokazuje bieżące ciepło / maksimum                                            |
| `overheat`                         | ustawia maksimum i uruchamia blokadę                                          |
| query `heat`, `overheated`         | liczba ciepła, stan blokady                                                   |
| query `activeProjectiles`, `shots` | aktywne pociski, licznik strzałów                                             |
| query `dummyHp`                    | tablica HP trzech manekinów                                                   |

## Poligon F2: weapons-test

`?scene=weapons-test&debug=1&seed=test` korzysta z `PlayerController`, wspólnego
`ProjectileSystem` i prostych brył. `src/data/scenes/weaponsTest.json` (zod)
określa sloty (`pistol`, `rifle`, `scatter`), statystyki ciepła, rozmiary,
pozycje i HP manekinów, podłogę, ścianę oraz bryłę broni. Trzy manekiny stoją
jeden za drugim przed ścianą; czwarty za nią. Zniszczone manekiny odradzają się
po `tuning.damage.respawnS`.

`1`/`2`/`3` (`weapon1..3`, zbocze `pressed`) wybierają slot, LPM (`attack`)
obsługuje spust. Komenda `weapon <id>` wstawia dowolną definicję do bieżącego slotu,
np. `weapon sniper`; nieznany ID wyświetla listę. Instancja i ciepło są osobne dla
każdej broni, zachowane przy zmianie slotu i komendzie. Nieużywane bronie nadal
stygną i odliczają blokadę. `heat` i `overheat` dotyczą bieżącej broni.
Prosty HTML pokazuje slot, polską nazwę, ciepło, przegrzanie i HP manekinów.
`dispose()` usuwa HUD, komendy, subskrypcje, encje, render i świat fizyki;
przywraca rodzica kamery i zachowuje współdzielone materiały.

Query: `weapon`, `slot` (0..2), `slots`, `heat`, `weaponHeat` (ciepło według ID),
`overheated`, `shots` (bieżącej broni), `activeProjectiles`, `dummyHp`.

Kontrola w 30 sekund: przytrzymaj LPM z pistoletem (jeden strzał), naciśnij `2`
i przytrzymaj LPM (seria), wróć na `1` i porównaj ciepło. Na `3` obejrzyj śrut.
W konsoli wpisz `weapon sniper`, wyceluj w rząd i kliknij: HP powinno wynosić
20 / 40 / 55 / 100. Przesuń się w bok, strzel w ścianę i sprawdź zatrzymanie
pocisku; `overheat` sprawdza blokadę. Oceń czytelność rozrzutu, rytm półautomatu,
tempo karabinu oraz koszt cieplny snajperki i rozpraszacza.

## Weryfikacja

`tests/unit/weapons.test.ts`: walidacja danych, ciepło i opóźnienie, blokada,
tempo ognia, żywe statystyki, deterministyczny rozrzut, prawdziwe sweeps Rapier,
pojedyncze obrażenia i zdarzenia, świat, czas życia, odbicie i pełna pula.
`tests/unit/blasterTest.test.ts`: scena bez sieci, komendy, LPM, respawn i dispose.
`tests/unit/fireModes.test.ts`: dane wszystkich broni, błędne tryby i powtórzone ID,
liczba pocisków i ciepło strzału, semi/auto, przegrzanie, rozrzut dla seeda,
limity i spadek przebicia, pomijanie kolejnych hurtboxów, ściany, statusy,
odbicia, czas życia i ponowne użycie puli także z handlera obrażeń.
`tests/unit/weaponsTest.test.ts`: rejestracja i ładowanie poligonu, sloty,
ciepło per broń, komenda `weapon`, HUD, przebicie rzędu, respawn i sprzątanie.
`tests/e2e/blasterTest.spec.ts`: ładowanie modeli bez błędów, `fire 3` obniża HP,
`overheat` ustawia blokadę; oczekiwanie przez `waitSimSteps` i `SIM_TIMEOUT`.

Ręcznie w 30 sekund: otwórz scenę, wyceluj w środkowy manekin, przytrzymaj LPM,
oceń tempo, czytelność cyan i paska ciepła, blokadę po przegrzaniu oraz powrót
do strzelania. Porównaj `fire 3` i `overheat` w konsoli; oceń pozycję broni
i zmianę koloru otworów chłodzenia podczas ruchu kamery.
