# Ruch FPP — F1 #02

`PlayerController` w `src/player/playerController.ts` przyjmuje id encji, świat
Rapier, `bus` i `tuning` z kontekstu, pozycję środka kapsuły oraz ustawienia myszy.
Nie importuje Three.js i nie korzysta z DOM. `getState()` zwraca kopię stanu
serializowalnego: pozycję, prędkość, yaw/pitch, grounded, pozostałe czasy coyote
i bufora oraz znacznik wykorzystania podwójnego skoku. Świat należy do sceny:
po `player.step(dt, snapshot)` scena wykonuje jeden `world.step()`.
`dispose()` usuwa kontroler i ciało; świat jest zwalniany osobno przez scenę.

Kapsuła ma **całkowitą** wysokość `capsuleHeight` (część cylindryczna Rapiera ma
połowę wysokości `capsuleHeight / 2 - capsuleRadius`). Kinematyczne ciało używa
`CollisionGroup.Player`; zapytania ignorują sensory i respektują maski kolizji.
Kontroler Rapiera obsługuje ślizganie po przeszkodach, autostep, granicę nachylenia
i snap do podłoża. Snap działa tylko podczas grounded i bez skoku. Na ziemi
minimalny ruch próbny w dół określa `groundStickSpeed`: utrzymuje kontakt kapsuły
z podłożem i ogranicza przycięcia przy bardzo małych przesunięciach pionowych.
Nie jest dodawany do prędkości upadku ani payloadu lądowania.

WASD określa kierunek względem yaw; pitch nie wpływa na chodzenie. Kierunek jest
normalizowany, więc przekątna nie przyspiesza ruchu. Sprint wymaga przytrzymania
`sprint` oraz dodatniego kierunku do przodu (W+S nie daje sprintu). Baza `moveSpeed`
w `Stats` przyjmuje aktualne `walkSpeed` lub `sprintSpeed`; modyfikatory są liczone
wyłącznie przez `Stats`. Prędkość pozioma zbliża się do celu o maksymalnie
`groundAccel * dt` albo `airAccel * dt`. Bez kierunku na ziemi hamowanie jest
wykładnicze: `v *= exp(-groundFriction * dt)`. W powietrzu bez wejścia poziomy
pęd pozostaje zachowany. Prędkość pozioma stanu oznacza pęd wejściowy;
przemieszczenie jest ograniczane przez kolizje Rapiera.

Pionowa prędkość jest całkowana ręcznie: `vy += tuning.physics.gravity * dt`.
Skok ustawia ją na `jumpVelocity`, podwójny na `doubleJumpVelocity`. Coyote pozwala
wykonać **zwykły** skok po zejściu z krawędzi, do `coyoteTimeMs`. Skok natychmiast
kasuje coyote. Po wygaśnięciu okna pozostaje tylko podwójny skok, raz na lot,
również po zejściu z platformy bez skoku. Lądowanie resetuje jego limit.
Kontakt z sufitem kasuje wznoszenie, bez odświeżania skoków.

`pressed jump` zapisuje żądanie na `jumpBufferMs`. Dostępny skok jest wykonywany
od razu; gdy podwójny został wykorzystany, żądanie czeka na lądowanie. Jeśli bufor
jest wtedy aktywny, emitowane jest lądowanie i zwykły skok, a ruch w górę zaczyna
się w następnym kroku. Przytrzymanie spacji nie powtarza skoków. Czasy maleją
w czasie symulacji. `dt=0` odbiera obrót i zapamiętuje żądanie, ale nie zmienia
pozycji, prędkości, liczników czasu ani świata fizyki.

Każdy wykonany skok emituje `player_jumped { id, double }`. Przejście z lotu na
podłoże emituje pojedyncze `player_landed { id, speed }`, gdzie speed to moduł
pionowej prędkości po grawitacji, przed wyzerowaniem przez kontakt. Pierwszy
kontakt po spawnie lub teleporcie także jest lądowaniem. `teleport(position)`
zeruje pęd, grounded, coyote, bufor i limit skoków, zachowując kierunek patrzenia.

Obrót: `yaw -= lookDelta.x * lookSensitivity * Settings.mouseSensitivity`,
analogicznie pitch dla osi Y. Domyślna `mouseSensitivity` z `loadSettings()`
wynosi już 1 i jest mnożnikiem. Pitch jest ograniczony do ±`maxPitchDeg`.

## Parametry `tuning.player`

Wszystkie są dostępne w lil-gui i odczytywane na bieżąco, także geometria kapsuły.

| Parametr             | Domyślnie | Znaczenie                                             |
| -------------------- | --------- | ----------------------------------------------------- |
| walkSpeed            | 7         | Docelowa prędkość chodu, m/s                          |
| sprintSpeed          | 11        | Docelowa prędkość sprintu, m/s                        |
| groundAccel          | 90        | Przyspieszenie i zmiana kierunku na ziemi, m/s²       |
| airAccel             | 30        | Przyspieszenie i zmiana kierunku w locie, m/s²        |
| groundFriction       | 12        | Współczynnik hamowania wykładniczego, 1/s             |
| jumpVelocity         | 8         | Prędkość zwykłego skoku, m/s                          |
| doubleJumpVelocity   | 7.5       | Prędkość podwójnego skoku, m/s                        |
| coyoteTimeMs         | 100       | Okno zwykłego skoku po krawędzi, ms                   |
| jumpBufferMs         | 120       | Czas ważności naciśnięcia skoku, ms                   |
| capsuleHeight        | 1.8       | Całkowita wysokość kapsuły, m                         |
| capsuleRadius        | 0.35      | Promień kapsuły, m                                    |
| eyeHeight            | 1.65      | Wysokość kamery nad spodem kapsuły, m                 |
| stepHeight           | 0.35      | Maksymalna wysokość automatycznego stopnia, m         |
| maxSlopeDeg          | 45        | Granica wspinania i początek zsuwania, stopnie        |
| lookSensitivity      | 0.0022    | Bazowy obrót, rad/piksel                              |
| maxPitchDeg          | 89        | Symetryczny limit pitch, stopnie                      |
| controllerOffset     | 0.02      | Odstęp kapsuły od przeszkód, m                        |
| stepMinWidth         | 0.2       | Minimalna szerokość miejsca za stopniem, m            |
| snapToGroundDistance | 0.3       | Zasięg przyciągania do podłoża, m                     |
| groundStickSpeed     | 2         | Minimalna prędkość próby kontaktu w dół na ziemi, m/s |

Geometria wymaga dodatniego promienia i wysokości co najmniej dwukrotności
promienia, a offset dodatniej wartości. Zmiana rozmiaru nie usuwa istniejących
penetracji; przy dużej zmianie użyj resetu sceny.

## Scena i ręczna weryfikacja

`?scene=player-test&debug=1`: WASD, Shift+W, Spacja (ponownie w locie), mysz po
kliknięciu canvasu. Schody po lewej z przodu mają stopnie 0.25 m, rampa na wprost
30°, po prawej 55°. Platformy z tyłu po lewej sprawdzają podwójny skok. Skrzynie,
filar, ściana i osłona wczytują GLB przez GLTFLoader; proste bryły są niezależnymi
colliderami i pozostają widocznym zamiennikiem przy błędzie ładowania.
Testy Node wyłączają pobieranie modeli, zachowując ten sam układ kolizji.

Kamera przekazana z `main.ts` przez opcjonalne `GameContext.camera` interpoluje
pozycję, yaw i pitch między poprzednim a bieżącym krokiem. Jest to minimalne
rozszerzenie kontraktu do review Architekta; `docs/api.md` nie jest zmieniany
w zadaniu #02. Teleport wyrównuje oba stany, aby kamera nie przelatywała przez świat.
Pointer lock oraz pauza pozostają w istniejącym `Input` i `main.ts`.

Konsola i debug handle obsługują `tp x y z` (środek kapsuły, także współrzędne
ujemne); `reset` przywraca spawn. Sandbox zachowuje istniejące komendy i query.
Zapytania sceny: `playerPos`, `playerVel`, `grounded` zwracają stan symulacji.
W 30 sekund: przejdź po schodach, spróbuj obu ramp, skocz dwukrotnie i wykonaj
`tp 0 5 0`. Oceń czas rozpędzania, hamowanie, sterowanie w locie i brak
przyklejania do podłogi przy skoku. Kamera nie ma zmian FOV ani wstrząsów.
