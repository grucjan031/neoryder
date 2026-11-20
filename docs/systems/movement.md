# Ruch FPP — F1 #02

`PlayerController` w `src/player/playerController.ts` przyjmuje id encji, świat
Rapier, `bus` i `tuning` z kontekstu, pozycję środka kapsuły oraz ustawienia myszy.
Nie importuje Three.js i nie korzysta z DOM. `getState()` zwraca kopię stanu
serializowalnego: pozycję, prędkość, yaw/pitch, grounded, pozostałe czasy coyote
i bufora oraz licznik skoków w powietrzu `airJumpsUsed`, a także `height`,
`dashS`, `dashCooldownS`, `dashDir`, `sliding`, `slideS`, `crouched`, `sprinting`.
Świat należy do sceny:
po `player.step(dt, snapshot)` scena wykonuje jeden `world.step()`.
`dispose()` usuwa kontroler i ciało; świat jest zwalniany osobno przez scenę.

## Kolejność kroku `step(dt, input)`

Stały krok `SIM_DT = 1/60`. Kolejność w kodzie (istotna dla odtworzenia feelu):

1. Obrót (`look`) — zawsze, także przy `dt = 0`.
2. Zapamiętanie wciśnięć: `jump` → licznik bufora := `tuning.player.jumpBufferMs` i reset
   flagi odmowy; `dash` → `dashQueued` (tylko gdy gracz nie niesie ładunku);
   `crouch` → `crouchQueued`. Przy `dt <= 0` krok kończy się tutaj (wciśnięcia
   przeżywają hitstop).
3. Flaga „sprint wyczerpany” ustawiana, gdy wytrzymałość ≤ 0 (przed regeneracją);
   `stamina.step(dt)`; flaga zdejmowana, gdy wytrzymałość > `sprintMinStamina`.
4. `configure()`: odczyt tuning na żywo (offset kontrolera, autostep
   `stepHeight`/`stepMinWidth`, brak autostepu na dynamicznych ciałach, kąt
   wspinania i zsuwania = `maxSlopeDeg`, rozmiar kapsuły).
5. Coyote maleje o `dt*1000` tylko w powietrzu; `dashCooldownS` maleje o `dt`.
6. Wejście ruchu; baza statu `dashCooldown` = `dashCooldownS`.
7. Start dashu, jeśli `dashQueued`, odnowienie = 0 i brak trwającego dashu.
   Flaga `dashQueued` jest kasowana w tym samym kroku — wciśnięcie podczas
   odnowienia przepada (brak bufora dashu).
8. Skok z bufora (tylko gdy nie trwa dash): zwykły przy `grounded` lub
   `coyoteMs > 0`, inaczej skok w powietrzu przy `airJumpsUsed < floor(extraJumps)`.
9. Start slide, jeśli `crouchQueued` (patrz niżej). Flaga kasowana w tym kroku.
10. Wyznaczenie `sprinting` (warunki niżej) i ruch poziomy: dash, slide albo bieg.
11. Grawitacja `vy += gravity * dt` (pomijana w dashu); `impactSpeed = |vy|`.
12. Snap do podłoża włączony tylko gdy `grounded && vy <= 0`; przesunięcie
    kontrolera Rapiera (na ziemi składowa Y = `min(vy, -groundStickSpeed) * dt`).
13. Rozliczenie sprintu (koszt wytrzymałości po faktycznym ruchu), pozycja,
    wyjście z dashu (prędkość pozioma := `dashDir * dashExitSpeed`).
14. `grounded = vy <= 0 && kontakt z podłożem`; lądowanie (emit + ewentualny skok
    z bufora) albo w powietrzu: koniec slide i kasowanie wznoszenia przy
    kontakcie z sufitem.
15. Wstawanie z przysiadu, gdy `crouched && !sliding && crouch niewciśnięty`;
    na końcu `jumpBufferMs` maleje o `dt*1000`.

Kapsuła ma **całkowitą** wysokość `capsuleHeight` (część cylindryczna Rapiera ma
połowę wysokości `capsuleHeight / 2 - capsuleRadius`). Kinematyczne ciało używa
`CollisionGroup.Player` (bity: World 1, Player 2, Enemy 4, PlayerProjectile 8,
EnemyProjectile 16, Debris 32; grupa = `(członek << 16) | filtr`, kapsuła gracza
koliduje ze wszystkim, filtr 0xffff; test wolnego miejsca przy wstawaniu sprawdza
tylko World, kształt o promieniu pomniejszonym o 0,02 m); zapytania ignorują sensory i respektują maski kolizji.
Kontroler Rapiera obsługuje ślizganie po przeszkodach, autostep, granicę nachylenia
i snap do podłoża. Snap działa tylko podczas grounded i bez skoku. Na ziemi
minimalny ruch próbny w dół określa `groundStickSpeed`: utrzymuje kontakt kapsuły
z podłożem i ogranicza przycięcia przy bardzo małych przesunięciach pionowych.
Nie jest dodawany do prędkości upadku ani payloadu lądowania.

WASD określa kierunek względem yaw; pitch nie wpływa na chodzenie. Kierunek jest
normalizowany, więc przekątna nie przyspiesza ruchu. Sprint wymaga przytrzymania
`sprint` oraz dodatniego kierunku do przodu (W+S nie daje sprintu). Sprint jest
wyłączony także: przy celowaniu (`aim > 0`), w przysiadzie, slide, dashu, podczas
noszenia ładunku (`setCarry`), po wyczerpaniu wytrzymałości i przy zapasie 0. Baza `moveSpeed`
w `Stats` przyjmuje aktualne `walkSpeed` lub `sprintSpeed`; modyfikatory są liczone
wyłącznie przez `Stats`. Prędkość pozioma zbliża się do celu o maksymalnie
`groundAccel * dt` albo `airAccel * dt`. Bez kierunku na ziemi hamowanie jest
wykładnicze: `v *= exp(-groundFriction * dt)`. W powietrzu bez wejścia poziomy
pęd pozostaje zachowany. Baza `moveSpeed` to `crouchSpeed` (przysiad), `sprintSpeed`
(sprint) albo `walkSpeed`; ustawiana tylko w kroku biegu (nie w slide i dashu). Prędkość pozioma stanu oznacza pęd wejściowy;
przemieszczenie jest ograniczane przez kolizje Rapiera.

Pionowa prędkość jest całkowana ręcznie: `vy += tuning.physics.gravity * dt`.
Skok ustawia ją na `jumpVelocity`, podwójny na `doubleJumpVelocity`. Coyote pozwala
wykonać **zwykły** skok po zejściu z krawędzi, do `coyoteTimeMs`. Skok natychmiast
kasuje coyote. Po wygaśnięciu okna pozostają skoki w powietrzu do limitu
`floor(stats.get('extraJumps'))`, również po zejściu z platformy bez skoku.
Baza wynosi 0: podwójny skok odblokowuje talent `hybridDoubleJump` za 1 punkt.
Lądowanie resetuje licznik. `player-test` ma bazę `extraJumps: 1` w danych,
pokoje runu i arena mają 0.
Kontakt z sufitem kasuje wznoszenie (normalna zderzenia skierowana w dół),
bez odświeżania skoków. Skok jest blokowany podczas dashu (bufor czeka, do
`jumpBufferMs`). Skok w trakcie slide kończy slide i zachowuje pęd poziomy.
Odmowa skoku w powietrzu (brak wytrzymałości) nie kasuje bufora: próba powtarza
się co krok do końca bufora, ale `stamina_denied` leci raz na naciśnięcie.

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
zeruje pęd, grounded, coyote, bufor, limit skoków, dash i jego odnowienie, slide
i przysiad (wysokość kapsuły wraca do `capsuleHeight`), zachowując kierunek
patrzenia. Nie zeruje wytrzymałości, flagi „sprint wyczerpany”, ani oczekujących
`dashQueued`/`crouchQueued`.

Obrót: `yaw -= lookDelta.x * s`, `pitch -= lookDelta.y * s * (invertY ? -1 : 1)`,
gdzie `s = lookSensitivity * Settings.mouseSensitivity * (1 + (aim.sensitivity * skalaBroni - 1) * aim)`
(`aim` 0..1 z `setAim`, `skalaBroni` = drugi argument `setAim`, domyślnie 1).
Domyślna `mouseSensitivity` z `loadSettings()` wynosi 1 i jest mnożnikiem. Pitch jest
ograniczony do ±`maxPitchDeg`.

**Celowanie (`setAim(aim, sensitivityScale)`):** `aim` obcięte do 0..1. Dodaje
modyfikator `moveSpeed` typu `mult` o wartości `1 + (aim.moveSpeed - 1) * aim`
(źródło `aim`), blokuje sprint. Parametry `tuning.player.aim`: `inS` 0,18 s,
`outS` 0,15 s, `fovScale` 0,72, `sensitivity` 0,7, `moveSpeed` 0,6, `spread` 0,4,
`recoil` 0,7 (czas, spread i recoil obsługuje broń/`HeldItem`, patrz weapons.md).

**Noszenie ładunku (`setCarry(speed | null)`, tryb Heist):** mnoży `moveSpeed`
przez `speed` (źródło `heistCarry`), blokuje dash, slide i sprint; w chwili
włączenia zeruje dash, slide i prędkość poziomą.

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

Kamera interpoluje pozycję, yaw i pitch między poprzednim a bieżącym krokiem
(`alpha`). Teleport wyrównuje oba stany, aby kamera nie przelatywała przez świat.
Pointer lock oraz pauza pozostają w istniejącym `Input` i `main.ts`.

Konsola i debug handle obsługują `tp x y z` (środek kapsuły, także współrzędne
ujemne); `reset` przywraca spawn. Sandbox zachowuje istniejące komendy i query.
Zapytania sceny: `playerPos`, `playerVel`, `grounded` zwracają stan symulacji.
W 30 sekund: przejdź po schodach, spróbuj obu ramp, skocz dwukrotnie i wykonaj
`tp 0 5 0`. Oceń czas rozpędzania, hamowanie, sterowanie w locie i brak
przyklejania do podłogi przy skoku.
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

Sprint zużywa zasób co krok (`min(zapas, sprintStaminaPerS·dt)`) tylko gdy
poziomy ruch kapsuły > `sprintMovementEpsilonM`; stojący w miejscu (np. o ścianę)
nie płaci i nie sprintuje. Każde zużycie (także sprint) odnawia 0,8 s opóźnienia
regeneracji, więc podczas sprintu zasób się nie regeneruje.
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
- Zdarzenie `dash_used { user, dir }`. Dash przerywa slide.
- Koszt `dashStaminaCost` (30) pobierany przy starcie; przy braku zasobu `stamina_denied { user, action: 'dash' }`, bez dashu i bez odnowienia. Odnowienie liczy się od startu dashu (maleje już w jego trakcie). Wciśnięcie w czasie odnowienia lub trwającego dashu przepada (brak bufora).
- Start: `velocity.y = 0`, w trakcie dashu brak grawitacji i skoku (bufor skoku czeka); po dashu grawitacja wraca od `vy = 0` (dash w powietrzu „zawiesza” spadek na 0,18 s).
- Wartość domyślna `dashInvulnerable` wynosi **0** — domyślnie dash NIE daje nietykalności.
- Wyjście z dashu: w kroku, w którym kończy się `dashS`, prędkość pozioma := `dashDir * dashExitSpeed` (9 m/s, ≥ `slideMinSpeed`, więc po dashu można od razu wejść w slide).
- Podczas noszenia ładunku (`setCarry`) dash jest zablokowany.

## Slide i przysiad (F1 #04)

- Start: wciśnięcie `crouch` (Ctrl) na ziemi przy prędkości poziomej ≥ `slideMinSpeed` (9 m/s, czyli w praktyce sprint). Prędkość rośnie o `slideBoost` (do `slideMaxSpeed`).
- W trakcie: tarcie wykładnicze `slideFriction` (niskie), sterowanie `slideSteer` obraca wektor prędkości bez przyspieszania, kapsuła obniżona do `slideCapsuleHeight` (1 m) ze stopami w miejscu.
- Warunki startu (wszystkie): wciśnięcie `crouch` w tym kroku, `grounded`, brak slide i dashu, brak noszenia ładunku, prędkość pozioma ≥ `slideMinSpeed`. Wciśnięcie `crouch` poniżej tej prędkości **nic nie robi** — przysiad poza slide nie istnieje (`crouched` ustawia tylko start slide).
- Start: prędkość := `min(slideMaxSpeed, v + slideBoost)` w kierunku ruchu; kapsuła zmniejszona do `slideCapsuleHeight` ze stopami w miejscu; `crouched = true`.
- Koniec: prędkość < `slideEndSpeed` (4), czas ≥ `slideMaxS` (1,1 s), zwolnienie `crouch` (zdarzenie `released`), zejście z ziemi albo skok. Jeśli po końcu slide gracz nadal trzyma `crouch`, zostaje w przysiadzie (`crouchSpeed`) do zwolnienia klawisza. **Slide-jump** zachowuje pęd poziomy.
- Wstawanie sprawdza miejsce nad głową (zapytanie kształtem pełnej kapsuły). Gdy nad graczem jest przeszkoda, zostaje w **przysiadzie** (`crouched`) i porusza się z `crouchSpeed`, a wstaje automatycznie, gdy jest miejsce i `crouch` nie jest przytrzymany.
- Zdarzenia `slide_started`, `slide_ended`.

## Kamera FPP (F1 #03)

`src/player/fpsCamera.ts` — czysta logika zwracająca `CameraPose` (pozycja, pitch, yaw, roll, FOV); scena przepisuje ją na kamerę Three.js. Działa na **czasie rzeczywistym klatki** (`Scene.render(alpha, frameDt)`), więc wstrząs trwa też w hitstopie.

| Efekt           | Model                                                                                                                                                                                                                                      | Parametry `tuning.camera`                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Wstrząs         | trauma 0..1 (sumowana, max 1), amplituda = trauma² × `shakeMax`, wygasa liniowo w `durationS`; gładki szum na pitch/yaw/roll i przesunięcie                                                                                                | `shakeMax`, `shakeMaxAngleDeg`, `shakeMaxOffset`, `shakeFrequency` |
| Źródła wstrząsu | `camera_shake`; `damage_dealt` gdy cel = gracz (trauma = obrażenia / `shakeDamageRef`) lub gdy gracz zadaje cios (× `shakeOnHitScale`)                                                                                                     | `shakeDamageRef`, `shakeOnHitScale`                                |
| FOV             | cel = `fov` + `sprintFovKick` (gdy `sprinting`) + `dashFovKick` (gdy `dashS > 0`), `fov += (cel − fov)·(1 − e^(−fovLerpRate·dt))`; wynik × `(1 + (aimFovScale − 1)·aim)`, `aimFovScale` domyślnie `player.aim.fovScale`                    | `fov`, `sprintFovKick`, `dashFovKick`, `fovLerpRate`               |
| Kołysanie       | faza += `v·dt / bobStride · 2π`; aktywne gdy `grounded`, nie slide, `v > 0,5 m/s`; waga → `min(1, v/walkSpeed)` wygładzana `1 − e^(−10·dt)`; `bobY = abs(sin)·bobAmount·waga`, `bobX = cos·bobAmount·0,5·waga`; wyłączane `bobEnabled = 0` | `bobEnabled`, `bobAmount`, `bobStride`                             |
| Lądowanie       | na `player_landed` z `speed ≥ 3`: `dip = max(dip, min(landingDipMax, speed·landingDipPerSpeed))`; powrót `dip *= e^(−landingRecoverRate·dt)`; odejmowane od wysokości oczu                                                                 | `landingDipPerSpeed`, `landingDipMax`, `landingRecoverRate`        |
| Wysokość oczu   | liczona od stóp (`height − (capsuleHeight − eyeHeight)`), wygładzana przy slide i przysiadzie                                                                                                                                              | `eyeLerpRate`                                                      |

Komenda debug w `player-test`: `shake <0..1> [s]`. Query: `trauma`, `fov`, `sliding`, `crouched`, `height`, `dashCooldown`.

Tor w `player-test`: niski tunel (prześwit 1,25 m, x ≈ 16) do przejścia tylko ślizgiem i ściana (x = −14) do testu dashu.

Szczegóły wstrząsu: `addTrauma(intensity, durationS)` dodaje i obcina do 1, a tempo wygasania := `trauma / durationS` (liczone od ostatniego dodania, więc kolejny wstrząs przedłuża całość). Z `damage_dealt`: `base = min(1, amount / max(1, shakeDamageRef))`; gdy cel = gracz, trauma `base` na 0,35 s; gdy gracz jest źródłem, `base · shakeOnHitScale` na 0,2 s. Amplituda = `trauma² · shakeMax · Settings.screenShake`; pitch/yaw/roll = amplituda · `shakeMaxAngleDeg` · szum, przesunięcie X/Y = amplituda · `shakeMaxOffset` · szum. Szum: `(sin(t+s) + 0,5·sin(2,17t+1,7s) + 0,25·sin(4,33t+2,3s)) / 1,75`, `t = czas·shakeFrequency`, ziarna 1,3 / 7,1 / 3,7 / 11,9 / 5,3 (pitch, yaw, roll, offX, offY). Krok czasu kamery jest obcięty do 0,1 s. Wartości domyślne: `fov` 90, `shakeMax` 0,4, `shakeMaxAngleDeg` 5, `shakeMaxOffset` 0,06, `shakeFrequency` 22, `shakeDamageRef` 40, `shakeOnHitScale` 0,3, `sprintFovKick` 6, `dashFovKick` 12, `fovLerpRate` 9, `bobEnabled` 1, `bobAmount` 0,03, `bobStride` 2,4, `landingDipPerSpeed` 0,012, `landingDipMax` 0,16, `landingRecoverRate` 9, `eyeLerpRate` 16.

Wartości `tuning.player` dla dashu, slide i przysiadu: `dashDistance` 6, `dashDurationS` 0,18, `dashCooldownS` 1,2, `dashExitSpeed` 9, `dashInvulnerable` 0, `slideMinSpeed` 9, `slideBoost` 2,5, `slideMaxSpeed` 15, `slideFriction` 1,4, `slideSteer` 6, `slideEndSpeed` 4, `slideMaxS` 1,1, `slideCapsuleHeight` 1,0, `crouchSpeed` 3,5. Grawitacja: `tuning.physics.gravity` = −20 m/s².

**Uwaga:** `Settings.fov` (preferencja gracza) zostanie podpięty jako baza FOV razem z menu ustawień (F7); do tego czasu bazą jest `tuning.camera.fov`.
