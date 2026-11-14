# Bronie i pociski — F1 #06

Kod symulacji: `src/combat/weapons/`. Render: `src/render/projectileRenderer.ts`.
Scena: `?scene=blaster-test&debug=1&seed=test`. Symulacja nie importuje Three.js
ani DOM, używa stałego kroku i przekazanego `EventBus` oraz `Rng`.

## Dane blastera

`src/data/weapons/blaster.json` jest importowany przez Vite i walidowany przy
ładowaniu przez `weaponSchema.ts`. `loadWeapon(unknown)` rzuca czytelny wyjątek
z nazwą błędnego pola. Wariant broni powstaje przez dane zgodne z tym schematem.

| Pole                | Wartość początkowa | Jednostka                 |
| ------------------- | ------------------ | ------------------------- |
| id                  | blaster            | identyfikator             |
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
zerowy/nieskończony kierunek. Stan pocisku zawiera tylko liczby, wektory i tagi.

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
trafienia. Pocisk wraca do puli przed emisją obrażeń, więc trafia tylko raz.
Trafienie świata/innego collidera lub koniec życia również niszczy encję i zwalnia
slot. Dodatkowe reguły drużyn i nietykalności nadal należą do `DamageSystem`.

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

## Weryfikacja

`tests/unit/weapons.test.ts`: walidacja danych, ciepło i opóźnienie, blokada,
tempo ognia, żywe statystyki, deterministyczny rozrzut, prawdziwe sweeps Rapier,
pojedyncze obrażenia i zdarzenia, świat, czas życia, odbicie i pełna pula.
`tests/unit/blasterTest.test.ts`: scena bez sieci, komendy, LPM, respawn i dispose.
`tests/e2e/blasterTest.spec.ts`: ładowanie modeli bez błędów, `fire 3` obniża HP,
`overheat` ustawia blokadę; oczekiwanie przez `waitSimSteps` i `SIM_TIMEOUT`.

Ręcznie w 30 sekund: otwórz scenę, wyceluj w środkowy manekin, przytrzymaj LPM,
oceń tempo, czytelność cyan i paska ciepła, blokadę po przegrzaniu oraz powrót
do strzelania. Porównaj `fire 3` i `overheat` w konsoli; oceń pozycję broni
i zmianę koloru otworów chłodzenia podczas ruchu kamery.
