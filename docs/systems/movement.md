# Ruch FPP — F1 #02

`PlayerController` w `src/player/playerController.ts` przyjmuje id encji, świat
Rapier, `bus` i `tuning` z kontekstu, pozycję środka kapsuły oraz ustawienia myszy.
Nie importuje Three.js i nie korzysta z DOM. `getState()` zwraca kopię stanu
serializowalnego: pozycję, prędkość, yaw/pitch, grounded, pozostałe czasy coyote
i bufora oraz licznik skoków w powietrzu `airJumpsUsed`. Świat należy do sceny:
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
kasuje coyote. Po wygaśnięciu okna pozostają skoki w powietrzu do limitu
`floor(stats.get('extraJumps'))`, również po zejściu z platformy bez skoku.
Baza wynosi 0: podwójny skok odblokowuje talent `hybridDoubleJump` za 1 punkt.
Lądowanie resetuje licznik. `player-test` ma bazę `extraJumps: 1` w danych,
pokoje runu i arena mają 0.
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

| Parametr              | Domyślnie | Znaczenie                                              |
| --------------------- | --------- | ------------------------------------------------------ |
| walkSpeed             | 7         | Docelowa prędkość chodu, m/s                           |
| sprintSpeed           | 11        | Docelowa prędkość sprintu, m/s                         |
| groundAccel           | 90        | Przyspieszenie i zmiana kierunku na ziemi, m/s²        |
| airAccel              | 30        | Przyspieszenie i zmiana kierunku w locie, m/s²         |
| groundFriction        | 12        | Współczynnik hamowania wykładniczego, 1/s              |
| jumpVelocity          | 8         | Prędkość zwykłego skoku, m/s                           |
| doubleJumpVelocity    | 7.5       | Prędkość podwójnego skoku, m/s                         |
| coyoteTimeMs          | 100       | Okno zwykłego skoku po krawędzi, ms                    |
| jumpBufferMs          | 120       | Czas ważności naciśnięcia skoku, ms                    |
| capsuleHeight         | 1.8       | Całkowita wysokość kapsuły, m                          |
| capsuleRadius         | 0.35      | Promień kapsuły, m                                     |
| eyeHeight             | 1.65      | Wysokość kamery nad spodem kapsuły, m                  |
| stepHeight            | 0.35      | Maksymalna wysokość automatycznego stopnia, m          |
| maxSlopeDeg           | 45        | Granica wspinania i początek zsuwania, stopnie         |
| lookSensitivity       | 0.0022    | Bazowy obrót, rad/piksel                               |
| maxPitchDeg           | 89        | Symetryczny limit pitch, stopnie                       |
| controllerOffset      | 0.02      | Odstęp kapsuły od przeszkód, m                         |
| stepMinWidth          | 0.2       | Minimalna szerokość miejsca za stopniem, m             |
| snapToGroundDistance  | 0.3       | Zasięg przyciągania do podłoża, m                      |
| groundStickSpeed      | 2         | Minimalna prędkość próby kontaktu w dół na ziemi, m/s  |
| staminaRegenDelayS    | 0.8       | Opóźnienie regeneracji od ostatniego zużycia, s        |
| sprintStaminaPerS     | 20        | Koszt faktycznego sprintu na sekundę                   |
| dashStaminaCost       | 30        | Pełny koszt dashu                                      |
| doubleJumpStaminaCost | 25        | Pełny koszt każdego skoku w powietrzu                  |
| sprintMinStamina      | 15        | Po wyczerpaniu sprint wraca dopiero powyżej tego progu |

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

Próg `sprintMovementEpsilonM` (0,001 m na krok, dostępny w lil-gui) pomija
mikrokorekty kontaktu Rapiera przy sprawdzaniu faktycznego ruchu sprintu.

## Wytrzymałość

`PlayerController.stamina` (`PlayerStamina` w `src/player/stamina.ts`) korzysta
z `ResourcePool` i statystyk kontrolera. Bazy w danych sceny to `maxStamina: 100`,
`staminaRegen: 30` na sekundę i `extraJumps: 0`; brakujące pola przyjmują te same
wartości przez zod. Talenty i implanty modyfikują je przez `Stats` + `StatModifier`.
Sceny przekazują bazy jako szósty argument kontrolera. Pula zaczyna pełna,
również po przejściu do kolejnego pokoju; nie jest częścią `RunState`.

Sprint pobiera `sprintStaminaPerS * dt` tylko z dodatnim kierunkiem do przodu,
po faktycznym poziomym przesunięciu kapsuły, poza dashem, slide i przysiadem.
Ostatnie zużycie obcina pulę do 0. Po wyczerpaniu gracz idzie i regeneruje zasób,
nawet z trzymanym Shiftem; sprint wraca dopiero przy zapasie **> 15**. Zwykły
skok z ziemi lub w oknie coyote jest darmowy. Dash wymaga 30, a każdy dodatkowy
skok w powietrzu 25 wytrzymałości. Odmowa nie pobiera kosztu, nie uruchamia
dashu ani jego odnowienia; zwykły ruch pozostaje dostępny. Bufor skoku nadal
może wykonać darmowy skok przy lądowaniu. Odmowa skoku emituje jeden sygnał
na naciśnięcie (bez powtarzania co krok bufora).

Regeneracja zaczyna się po 0,8 s od ostatniego udanego zużycia i rozlicza tylko
część kroku po opóźnieniu. `dt=0`, pauza i hitstop nie zmieniają zasobu.
`stamina_changed { id, current, max }` zasila HUD; sceny emitują stan po jego
utworzeniu przez `stamina.set(stamina.max)`. `stamina_denied { user, action }`
(`dash` lub `doubleJump`) daje krótki komunikat i puls paska w HUD.
Query `stamina` oraz `extraJumps` są dostępne w pokoju i arenie. W pokoju komenda
`talent hybridDoubleJump` pozwala sprawdzić odblokowanie na żywo.

Kontrola w 30 sekund: `?scene=room-test&debug=1` — podwójny skok początkowo
nie działa; wpisz `talent hybridDoubleJump`, skocz dwa razy, sprawdź koszt 25.
Trzymaj Shift+W do wyczerpania, sprawdź chód i powrót sprintu po przekroczeniu
progu; wykonuj dash, aż pojawi się odmowa. `?scene=player-test` zachowuje skok
w powietrzu do testowania przeszkód. Testy: `stamina.test.ts`,
`playerController.test.ts`, `dashSlide.test.ts`, `talents.test.ts`, `hud.test.ts`.

## Dash (F1 #04)

Wciśnięcie `dash` (Q) uruchamia poziomy doskok w kierunku wejścia WASD, a bez wejścia — w kierunku patrzenia. Dash działa także w powietrzu.

- Przez `dashDurationS` (0,18 s) gracz porusza się ze stałą prędkością `dashDistance / dashDurationS` (6 m), bez grawitacji. Ostatni krok jest skracany tak, żeby dystans był dokładny.
- Po dashu prędkość pozioma spada do `dashExitSpeed` (9 m/s) w kierunku dashu — płynne wyjście zamiast nagłego zatrzymania.
- Odnowienie pochodzi ze statu **`dashCooldown`** (baza `dashCooldownS` = 1,2 s). Synergie skracają je modyfikatorem (np. `mult 0.5`) bez zmiany kodu.
- Ściany zatrzymuje character controller — dash nie przechodzi przez geometrię.
- `dashInvulnerable` (0/1): `PlayerController.isInvulnerable()` zwraca `true` w trakcie dashu; arena podpina to jako `DamageTargetOptions.invulnerable` (sprawdzane **przed** zadaniem obrażeń).
- Zdarzenie `dash_used { user, dir }`. Dash przerywa slide. Zbuforowany skok nie wykonuje się w trakcie dashu (także przy lądowaniu na platformie), tylko po jego końcu, jeśli bufor nie wygasł.

## Slide i przysiad (F1 #04)

- Start: wciśnięcie `crouch` (Ctrl) na ziemi przy prędkości poziomej ≥ `slideMinSpeed` (9 m/s, czyli w praktyce sprint). Prędkość rośnie o `slideBoost` (do `slideMaxSpeed`).
- W trakcie: tarcie wykładnicze `slideFriction` (niskie), sterowanie `slideSteer` obraca wektor prędkości bez przyspieszania, kapsuła obniżona do `slideCapsuleHeight` (1 m) ze stopami w miejscu.
- Koniec: prędkość < `slideEndSpeed`, czas ≥ `slideMaxS`, puszczenie `crouch`, zejście z ziemi albo skok. **Slide-jump** zachowuje pęd poziomy.
- Wstawanie sprawdza miejsce nad głową (zapytanie kształtem pełnej kapsuły). Gdy nad graczem jest przeszkoda, zostaje w **przysiadzie** (`crouched`) i porusza się z `crouchSpeed`, a wstaje automatycznie, gdy jest miejsce i `crouch` nie jest przytrzymany.
- Zdarzenia `slide_started`, `slide_ended`.

## Kamera FPP (F1 #03)

`src/player/fpsCamera.ts` — czysta logika zwracająca `CameraPose` (pozycja, pitch, yaw, roll, FOV); scena przepisuje ją na kamerę Three.js. Działa na **czasie rzeczywistym klatki** (`Scene.render(alpha, frameDt)`), więc wstrząs trwa też w hitstopie.

| Efekt           | Model                                                                                                                                       | Parametry `tuning.camera`                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Wstrząs         | trauma 0..1 (sumowana, max 1), amplituda = trauma² × `shakeMax`, wygasa liniowo w `durationS`; gładki szum na pitch/yaw/roll i przesunięcie | `shakeMax`, `shakeMaxAngleDeg`, `shakeMaxOffset`, `shakeFrequency` |
| Źródła wstrząsu | `camera_shake`; `damage_dealt` gdy cel = gracz (trauma = obrażenia / `shakeDamageRef`) lub gdy gracz zadaje cios (× `shakeOnHitScale`)      | `shakeDamageRef`, `shakeOnHitScale`                                |
| FOV             | baza `fov` czytana na żywo + `sprintFovKick` / `dashFovKick`, wygładzanie wykładnicze                                                       | `fov`, `sprintFovKick`, `dashFovKick`, `fovLerpRate`               |
| Kołysanie       | faza z przebytej drogi (`bobStride` m na cykl), waga zależna od prędkości, wyłączane `bobEnabled = 0`; nie działa w slide i w powietrzu     | `bobEnabled`, `bobAmount`, `bobStride`                             |
| Lądowanie       | ugięcie proporcjonalne do prędkości pionowej (od 3 m/s), powrót wykładniczy                                                                 | `landingDipPerSpeed`, `landingDipMax`, `landingRecoverRate`        |
| Wysokość oczu   | liczona od stóp (`height − (capsuleHeight − eyeHeight)`), wygładzana przy slide i przysiadzie                                               | `eyeLerpRate`                                                      |

Komenda debug w `player-test`: `shake <0..1> [s]`. Query: `trauma`, `fov`, `sliding`, `crouched`, `height`, `dashCooldown`.

Tor w `player-test`: niski tunel (prześwit 1,25 m, x ≈ 16) do przejścia tylko ślizgiem i ściana (x = −14) do testu dashu.

**Uwaga:** `Settings.fov` (preferencja gracza) zostanie podpięty jako baza FOV razem z menu ustawień (F7); do tego czasu bazą jest `tuning.camera.fov`.
