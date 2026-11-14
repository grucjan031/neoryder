# Wrogowie — F1 #08–09

Szturmowiec (`assaulter`) naciera z pałką elektryczną. Ma 60 HP, porusza się
z prędkością 4,2 m/s, zatrzymuje się 1,8 m od celu i zapowiada cios przez 0,4 s.
Aktywny wymach trwa 0,12 s i zadaje 15 obrażeń przez `Hitbox` oraz `DamageSystem`.
Źródłem zdarzenia `damage_dealt` jest encja wroga. Jeden wymach trafia cel raz;
odejście poza zasięg lub poza obszar przed wrogiem pozwala uniknąć ciosu.

## Dane i rejestr

`src/data/enemies/*.json` ładowane są przez rejestr i walidowane `enemySchema`
z zod. `id` określa wariant, `kind` wybiera implementację archetypu.
`enemyRegistry` to mapa id → fabryka; `availableEnemyIds()` podaje dostępne id,
a `createEnemy(ctx, deps, id, position)` tworzy wroga. Nieznane rodzaje,
powtórzone id i niepoprawne dane zatrzymują ładowanie.

Wspólne pola: `maxHealth`, `moveSpeed`, `turnRateDegS`, `attackRange`,
`telegraphS`, `swingActiveS`, `recoveryS`, `cooldownS`, `damage`,
`knockbackResist` (0–1), `stunOnHeavyS`, `repathJitter`.
Blok `body` zawiera geometrię kapsuły ruchu, hurtboxów i ciosu, odstęp kontrolera
oraz tłumienie odrzutu. Blok `animation` zawiera długość kroku, kąty kończyn,
przechył ogłuszenia i pulsowanie pałki. Te bloki są opcjonalne w schemacie
ogólnym; Szturmowiec wymaga `body`, a jego dane dostarczają również `animation`.
Zdrowie, prędkość oraz obrażenia korzystają ze `Stats`.

## Symulacja i maszyna stanów

`Assaulter` nie importuje Three.js i nie dotyka DOM. `step(dt)` działa w stałym
kroku symulacji; `dt=0` nie zmienia stanu. Snapshoty `previous/current`
przechowują pozycję stóp, yaw, stan, czas stanu, prędkość i przebytą drogę.

```mermaid
stateDiagram-v2
  idle --> chase: cel dostępny
  chase --> idle: brak celu
  chase --> telegraph: zasięg, obrót i odnowienie gotowe
  telegraph --> swing: telegraphS
  swing --> recovery: swingActiveS
  recovery --> chase: recoveryS
  chase --> stunned: ciężki cios lub duży odrzut
  telegraph --> stunned: ciężki cios lub duży odrzut
  swing --> stunned: ciężki cios lub duży odrzut
  recovery --> stunned: ciężki cios lub duży odrzut
  stunned --> chase: stunOnHeavyS
```

Wejście w `telegraph` emituje `enemy_telegraph { id, kind: 'swing', durationS }`.
Kierunek ciosu zostaje ustalony przy zapowiedzi: wróg nie śledzi celu podczas
telegrafu ani wymachu. Zapytanie Rapiera przed wrogiem wybiera hurtbox gracza;
przed trafieniem sprawdzany jest też dystans do aktualnej pozycji celu.
Odnowienie `cooldownS` zaczyna się przy wejściu w `recovery` i biegnie równolegle
z regeneracją po ciosie. Wróg może ponownie zapowiedzieć atak dopiero po obu.

Pościg obraca wroga z ograniczeniem `turnRateDegS`. Promień na wysokości ciała
sprawdza ściany w `tuning.enemies.wallProbe`; przeszkoda wywołuje ruch boczny.
Stronę i odstęp kolejnego sprawdzenia wybiera strumień `Rng.fork('enemy:<id>')`.
`repathJitter` rozprasza momenty kolejnych prób. To lokalne omijanie przeszkód,
bez pathfindingu grafowego. Sąsiedzi z managera odpychają się wewnątrz
`tuning.enemies.separationRadius`; kolizje kapsuł dodatkowo ograniczają nakładanie.
Separacja działa również podczas ataku i ogłuszenia. Gdy spawn umieści kapsuły
w tym samym miejscu, filtr kontrolera pozwala im wyłącznie oddalać się od siebie
do chwili rozdzielenia; później przywraca zwykłe kolizje.

## Wspólne ciało i obrażenia

`EnemyBody` udostępnia ruch po ziemi z grawitacją, próbę ściany i odrzut.
Kinematyczna kapsuła w `CollisionGroup.Enemy` współpracuje z character controllerem
Rapiera. Dwa dodatkowe sensory przyjmują obrażenia: kapsuła tułowia ×1 i kula
głowy ×1,5. Wszystkie collidery są związane z encją przez `EntityRegistry`;
tylko sensory należą do `Hurtboxes`. Ciało i hurtboxy poruszają się razem.
Scena wykonuje **jeden** `world.step()` po krokach gracza i managera.

`damage_dealt` dla własnego id dodaje poziomy impuls z pola `knockback`,
skalowany przez `1 - knockbackResist`, z wykładniczym tłumieniem z danych.
Kierunek pochodzi z `dir`; przy `null` można go odtworzyć z pozycji celu będącego
atakującym. Nieznany kierunek pomija sam odrzut. Tag `PIERCE_BLOCK_TAG`
lub impuls co najmniej `tuning.enemies.stunKnockback` przerywa aktualny atak,
przełącza stan na `stunned` i emituje `enemy_stunned { id, durationS }`.
Ponowne ogłuszenie odświeża czas. Ogłuszony wróg nie atakuje.

Zdarzenie `enemy_killed` z `DamageSystem` przełącza dowolny stan na `dead`.
Wróg przestaje działać i znika wizualnie. Po `tuning.enemies.corpseS` manager
usuwa kontroler, ciało, hurtboxy, rejestrację obrażeń i encję. Zdarzenie śmierci
emituje wyłącznie `DamageSystem`, raz. Odłamki należą do zadania #12.

`EnemyManager`: `spawn(id, position)`, `step(dt)`, `forEach(cb)`, `despawnAll()`,
`dispose()`. Utrzymuje wspólną listę sąsiadów, wywołuje AI i usuwa zwolnione
instancje. Sam nie krokuje świata ani `DamageSystem` — robi to właściciel.

## Render i animacja

`EnemyView` ładuje `enemy_trooper.glb` raz do cache i tworzy niezależny klon
hierarchii dla każdego wroga. Geometria oraz materiały stylu pozostają wspólne;
nie są zwalniane przez pojedynczy widok. Materiały źródłowe GLB są zwalniane po
`applyStyle`. Cache przechowuje jeden szablon na archetyp na czas życia aplikacji.
Brak modelu pozostawia czerwone bryły z analogicznymi pivotami.

Model patrzy w +Z. Pozycja i yaw interpolują się według `alpha`, z najkrótszą
drogą obrotu. Chód wynika z przebytej drogi i obraca `leg_upper_*`, `leg_lower_*`
oraz `arm_upper_*`. Telegraph cofa prawe ramię i zgina łokieć; `baton_tip`
pulsuje skalą względem skali bazowej. Wymach szybko opuszcza ramię, recovery
przywraca pozę, a ogłuszenie przechyla `pelvis`. Bazowe obroty GLB są zachowane.
Animacja pozostaje wyłącznie w renderze i nie steruje trafieniami symulacji.

## Scena ai-test i weryfikacja

`?scene=ai-test&debug=1` zawiera arenę z osłonami `cover_low`, filarem `pillar`
i dwoma Szturmowcami oraz jednym Strzelcem. Konfiguracja sceny jest w `src/data/scenes/aiTest.json`,
walidowana zod. Gracz korzysta z `PlayerController` i `FpsCamera`, ma 100 HP,
hurtbox kapsuły oraz nietykalność po trafieniu z `tuning.damage.playerInvulnMs`.
Napis HTML pokazuje HP. Śmierć resetuje gracza i wrogów po 1 s symulacji;
reset zeruje także okno nietykalności. `dispose` usuwa napis i subskrypcje.

- `spawn <id> [n]`: wróg lub grupa 8 m przed graczem.
- `hit <dmg>`: obrażenia wszystkim wrogom, źródło gracz, tag `#debug`.
- `kill all`: zabija wszystkich przez `DamageSystem`.
- `god`: przełącza `damageTaken` ×0 przez modyfikator `Stats`; działa od razu.
- `reset`: reset sceny przez istniejący mechanizm debug.
- Query: `enemies` (żywi), `enemyStates` (id i stan żywych), `playerHp`.

W 30 sekund: otwórz scenę, pozwól wrogom podejść i odskocz podczas uniesienia
pałki. Oceń czytelność 0,4 s zapowiedzi, ruch wokół filara i okno po ciosie.
Włącz `god`, użyj `spawn assaulter 2`, następnie `hit 1000`; licznik ma spaść do 0.

`tests/unit/enemies.test.ts` korzysta z prawdziwego Rapiera w Node: dane, fabryka,
hurtbox głowy, pościg, czasy ataków, pudło po odejściu, hitstop, odrzut,
ogłuszenie, śmierć, separacja i deterministyczne omijanie ściany.
`aiTest.test.ts` sprawdza scenę, komendy, god, reset po śmierci i sprzątanie.
`enemyView.test.ts` sprawdza interpolację, animację, klonowanie i cache GLB.
`tests/e2e/aiTest.spec.ts` sprawdza ładowanie bez błędów konsoli oraz spawn/kill,
czekając na kroki symulacji przez `waitSimSteps` i `SIM_TIMEOUT`.

## Dodawanie wariantu i archetypu

Wariant istniejącego Szturmowca: dodaj JSON w `src/data/enemies/` z nowym `id`
i `kind: 'assaulter'`, pozostałymi polami, `body` i `animation`. Rejestr wykryje
plik automatycznie; `spawn <nowe-id>` działa bez zmiany kodu zachowania.

Nowy archetyp: rozszerz schemat o potrzebne pola opcjonalne, dodaj
implementację interfejsu `Enemy` i fabrykę dla nowego `kind` w `registry.ts`.
Może korzystać z `EnemyBody`, istniejącego managera i własnego widoku.
Dodaj dane, testy i scenę w zakresie zatwierdzonego zadania. Kontrakty nowych
zdarzeń zatwierdza Architekt w `docs/api.md` przed implementacją.

## Strzelec — F1 #09

`gunner` jest drugim archetypem w rejestrze. `src/data/enemies/gunner.json`
ustala 45 HP, prędkość ruchu 3,4 m/s i preferowany dystans 9 m z tolerancją
2 m (pasmo 7–11 m). Pola dystansowe są opcjonalne dla innych archetypów;
walidator wymaga ich i `body` dla `kind: 'gunner'`. Dane Szturmowca pozostają poprawne.
`maxHealth`, `moveSpeed` i obrażenia pocisku przechodzą przez `Stats`.

Cykl: `idle → reposition → aim → burst → cooldown → reposition`.
Z bliska Strzelec odchodzi, z daleka podchodzi, dodając lekki ruch boczny
(`strafeScale`). Stronę i rozrzut wybiera wyłącznie własny strumień
`Rng.fork('enemy:<id>')`. Korzysta z `EnemyBody`, separacji sąsiadów oraz
istniejącej próby ściany `tuning.enemies.wallProbe`.

W paśmie z widocznym celem zatrzymuje się i emituje
`enemy_telegraph { id, kind: 'aim', durationS: 0.5 }`. Przez całe 0,5 s
celuje i obraca się do gracza, dopiero potem oddaje trzy strzały co 0,22 s
(z dokładnością do stałego kroku). Każdy strzał mierzy w aktualną pozycję celu
z rozrzutem ±2° na osiach yaw i pitch. Po serii odpoczywa 1,6 s.
Ogłuszenie przerywa zapowiedź lub serię; obsługa odrzutu, śmierci i usuwania
ciała jest taka jak u Szturmowca.

Przy `losRequired: true` raycast Rapiera sprawdza `CollisionGroup.World`
od ciała do wylotu i od wylotu do celu. Brak widoczności przerywa celowanie
lub serię i kieruje Strzelca do celu w stanie `reposition`. Odcinek do wylotu
zapobiega strzelaniu przez osłonę, w którą wszedł model karabinu.

Scena przekazuje wspólny `ProjectileSystem` w `EnemyDependencies.projectiles`
(wymagany przy tworzeniu Strzelca). Pocisk ma `team: 'enemy'`, właściciela
równego id Strzelca, tag `#gun`, prędkość **11 m/s**, obrażenia **12** i czas
życia 4 s. Po `reflect(id, playerId, 'player', dir)` może zranić Strzelca.
Wylot symulacji określa lokalny wektor `muzzle` w danych; nie zależy od renderu.

`EnemyView` ładuje i klonuje `enemy_gunner.glb`, stosuje `applyStyle` i zachowuje
czerwony fallback z karabinem i wizjerem. Chód korzysta z przebytej drogi.
Celowanie unosi oba ramiona i utrzymuje poziom karabinu; widoczny `visor`
oraz węzeł `muzzle` pulsują. `shotTimeS` w snapshotach uruchamia odrzut
`rifle`, także po ostatnim strzale serii. Parametry animacji są w JSON.

`ai-test` ma jedną pulę pocisków i `ProjectileRenderer` z `InstancedMesh`.
Scena krokuje pociski po `world.step()`, render interpoluje pozycje i ustawia
orientację wzdłuż lotu. Pociski wrogów używają `enemy_projectile.glb`,
`enemyGlow` i skali 1,6; przy braku modelu pozostaje większa bryła zastępcza.
Reset czyści aktywne pociski, a dispose usuwa pulę i zasoby renderu.

Kontrola w 30 sekund: `?scene=ai-test&debug=1&seed=gunner`, `kill all`,
`spawn gunner 1`. Sprawdź pulsowanie wizjera przed serią, widoczność wolnych
pocisków i możliwość zejścia z toru lotu. Podejdź bliżej niż 7 m, potem odejdź
ponad 11 m; wróg powinien odzyskać dystans. Osłoń się filarem — nie powinien
strzelać przez ścianę. `god` pozwala obserwować kolejne serie bez śmierci.

Testy Rapiera w `enemies.test.ts` obejmują dane obu archetypów, dystans,
zapowiedź, serię, LOS, prędkość i obrażenia pocisku, odbicie, deterministyczność
oraz przerwanie serii przez ogłuszenie. `aiTest.test.ts` sprawdza pociski sceny
i ich czyszczenie przy resecie, a `enemyView.test.ts` — osobny cache Strzelca,
celowanie, pulsowanie i odrzut. Playwright `aiTest.spec.ts` sprawdza
`spawn gunner 1` oraz utratę HP od pocisków z wyłączonym `god`, czekając
na kroki symulacji przez `waitSimSteps` i `SIM_TIMEOUT`.

## Dyrektor wrogów — F2-12

`EnemyDirector` (`src/enemies/director.ts`) koordynuje grupę, żeby walka z wieloma
wrogami była czytelna: naraz atakuje tylko kilku, reszta otacza gracza i czeka.
Tworzy go `EnemyManager`, gdy scena poda dane `director`
(`new EnemyManager(ctx, deps, { director })`). Manager wstrzykuje go wrogom
w `EnemyDependencies.director` i woła `director.step(dt)` po krokach wszystkich
wrogów. Bez danych `director` wrogowie zachowują się dokładnie jak w F1.

**Tokeny.** `attackTokens` ogranicza jednoczesne ataki wręcz, `shotTokens` —
jednoczesne celowanie i serie. Wróg, który chce zacząć atak, woła
`requestToken(id, kind)` w każdym kroku. Czekający stoją w kolejce FIFO:
zwolniony token dostaje najdłużej czekający, więc przy `shotTokens: 1` Strzelcy
strzelają na zmianę (ostrzał zaporowy). Zgłoszenie, którego wróg nie ponowił
w kroku, wypada z kolejki. `dt = 0` (hitstop) niczego nie przedawnia. Token
wraca do puli przy `releaseToken`, a sam dyrektor zwalnia go przy `enemy_killed`,
`entity_despawned`, `enemy_stunned` i `status_applied` ze statusem `stunned`.
Bezpiecznik `maxHoldS` odbiera token trzymany zbyt długo.

**Sloty flankowania.** Dwie pule kątów wokół gracza (`slots.melee`, `slots.shot`:
`count`, `offsetDeg` od osi +Z). Kąt przydziela dyrektor, promień podaje wróg:
`slot(id, kind, radiusM)` zwraca punkt na okręgu wokół aktualnej pozycji celu.
Pierwszy przydział to najbliższy wolny slot; remis rozstrzyga niższy indeks.
Co `reassignS` przydział liczony jest od nowa zachłannie (pary wróg–slot od
najbliższej), żeby wrogowie nie przebiegali przez gracza, gdy ten zmieni stronę.
Slot zasłonięty przez świat (promień od gracza na wysokości `probeHeightM` nad
jego pozycją, grupa `World`) jest pomijany. Przy braku wolnego slotu `slot`
zwraca `null`. Slot, o który wróg nie zapytał w kroku, zostaje zwolniony.

**Szturmowiec.** W pościgu prosi o token, gdy jest bliżej niż
`flankDistanceM + attackRange` (lub już go ma). Z tokenem naciera i atakuje jak
w F1. Bez tokenu idzie do slotu na promieniu `flankDistanceM` (dane, 4 m), twarzą
do gracza; bez slotu zatrzymuje się na tym promieniu na linii do gracza. Token
trzymają tylko zapowiedź i wymach. Wejście w regenerację, ogłuszenie, śmierć
albo utrata celu go oddaje. `flankDistanceM` musi być większy niż `attackRange`.

**Strzelec.** Prosi o token strzału dopiero, gdy jest w paśmie dystansu, widzi
cel i jest do niego obrócony. Bez tokenu, przy widocznym celu, czeka w slocie
na promieniu `preferredRange`. Bez widoczności działa jak w F1 (podchodzi).
Token trzymają celowanie i seria. Przejście w `cooldown`, utrata widoczności,
ogłuszenie albo śmierć go oddaje.

Dane: blok `director` w `src/data/scenes/aiTest.json` (2 tokeny wręcz, 1 strzału)
i `arena.json` (3 i 2 — arena zostaje wymagająca; fale F2 dostroi zadanie 17).
Zapytania debug: `director` w ai-test i `enemyDirector` w arenie zwracają
`snapshot()` (tokeny, kolejki, sloty).

Kontrola w 30 sekund: `?scene=ai-test&debug=1`, `god`, `spawn assaulter 6`, komenda `director` (kto ma tokeny, kto czeka, sloty).
Naraz zapowiada cios najwyżej dwóch Szturmowców, reszta stoi w kręgu ok. 4 m
i przesuwa się za graczem. `kill all`, `spawn gunner 3`: Strzelcy rozstawiają
się wokół i strzelają seriami po kolei, nie razem. Ocena feel: czy krąg nie
wygląda sztywno i czy przerwy między atakami nie są za długie.

Testy: `tests/unit/director.test.ts` (logika tokenów i slotów bez fizyki oraz
Szturmowcy i Strzelcy w prawdziwym Rapierze: limit ataków, rotacja tokenów,
krążenie na `flankDistanceM`, naprzemienne serie, zwolnienie przy ogłuszeniu
i śmierci, walidacja danych) i `aiTest.test.ts` (dyrektor z danych sceny).

**Statusy (F2-02).** `EnemyDependencies.statuses` (z `StatusSystem` sceny):
status `stunned` przełącza wroga w stan `stunned` na czas trwania statusu
(emisja `enemy_stunned`, zwolnienie tokenu dyrektora). Szczegóły: `docs/systems/status.md`.

## Snajper i Dron — F2-13

**Snajper** (`sniper.json`, `kind: 'sniper'`) to archetyp Strzelca z innymi
danymi — ta sama klasa `Gunner`, model i animacja. Trzyma dystans 16 m ± 3,5
(z bliska odchodzi), celuje 1,6 s z widoczną linią lasera, przez ostatnie
`aimLockS` = 0,35 s cel jest zamrożony (laser grubieje ×`laserLockScale`), potem
oddaje jeden strzał 30 obrażeń z tagami `projectileTags: ['#gun', '#heavy']`:
blok ostrzem go nie osłabia, trzeba zejść z linii po zamrożeniu albo sparować.
Nowe opcjonalne pola Strzelca: `aimLockS` (krótszy niż `aimTelegraphS`),
`laserSight`, `projectileTags` (domyślnie `['#gun']`), w `animation`:
`laserRadiusM`, `laserLockScale`. Snapshot ma `aim` (punkt celowania)
w stanach `aim` i `burst`; bez `aimLockS` cel jest śledzony do końca serii
jak w F1. Laser rysuje `EnemyView` w przestrzeni lokalnej widoku: od `muzzle`
z danych do `aim`, tylko w stanie `aim`.

**Dron** (`drone.json`, `kind: 'drone'`, klasa `Drone`) lata bez character
controllera: kinematyczne ciało z sensorem-kulą (hurtbox `radiusM`,
`hurtboxMultiplier`) na stałej wysokości `hoverHeightM` nad punktem spawnu.
W `reposition` i `cooldown` krąży wokół celu w odległości `preferredRange`
z prędkością kątową `orbitSpeedDegS` (kierunek z `Rng`), w `aim`/`burst` wisi
w miejscu. Strzela seriami jak Strzelec (pola `gunnerFields`, token `shot`
dyrektora, widoczność promieniem do celu). Każdy ruch to `world.castShape`
kuli po grupie `World` z odstępem `skinM`: dron zatrzymuje się przed ścianą
i odwraca kierunek krążenia, odrzut jest wtedy wygaszany. Odrzut działa w 3D
z tłumieniem `knockbackDamping`; po nim dron wraca na wysokość lotu. Ciężki
cios, duży odrzut i status `stunned` ogłuszają go (przechył, wolne wirniki,
brak strzałów). Pozycja snapshotów to środek drona. Widok `DroneView`
(prymitywy: korpus, oko `enemyGlow`, cztery wirniki; liczby w `drone`
w danych). Sceny tworzą widoki przez `createEnemyView` (`src/enemies/views.ts`).

Kontrola w 30 sekund: `?scene=ai-test&debug=1`, `god`, `kill all`,
`spawn sniper 1` — laser przez 1,6 s, na końcu grubieje; odskocz po
zgrubieniu: strzał chybia. `spawn drone 3` — drony krążą nad graczem,
omijają filar i ściany, strzelają seriami na zmianę. Ocena feel: czy zgrubienie
lasera wystarcza jako sygnał uniku i czy drony nie są za trudne do trafienia
ostrzem (wiszą na 2,6 m).

Testy: `tests/unit/sniperDrone.test.ts` — dane, telegraf i śledzenie lasera,
blokada celu (unik po zamrożeniu), ciężki strzał i ucieczka Snajpera; lot
drona na wysokości i krążenie, brak wejścia w ścianę z odwróceniem kierunku,
serie, ogłuszenie ciosem i statusem, śmierć i sprzątanie, deterministyczność;
`DroneView`, laser w `EnemyView`, `createEnemyView`.

## Tarczownik i Egzekutor — F2-14

Oba archetypy używają `Assaulter`, wspólnego ciała, odrzutu, maszyny stanów
i tokenu `melee` dyrektora. Opcjonalne bloki danych `shield`, `parry` oraz
`attackTags` rozszerzają zachowanie; bez nich Szturmowiec działa jak dotąd.

**Tarczownik** (`shielder.json`, `kind: 'shielder'`): 90 HP, ruch 3 m/s,
cios 12 obrażeń. Podniesiona tarcza blokuje tagi `#gun` i `#melee` w łuku
120° przed wrogiem. Obrona porównuje `-DamageInfo.dir` z kierunkiem patrzenia;
trafienia z tyłu i z boku poza łukiem oraz bez `dir` przechodzą normalnie.
`#heavy` z przodu przechodzi, opuszcza tarczę na `shield.downS` = 3 s
i uruchamia istniejące ogłuszenie ciężkim ciosem. Odliczanie biegnie tylko
w czasie symulacji. Ogłuszenie (stan lub status) i `StatusQuery.has(id,
'overload')` wyłączają tarczę; po ich zakończeniu wraca, jeśli minęło `downS`.
W snapshotach `shieldUp` określa widoczność tarczy.

**Egzekutor** (`executor.json`, `kind: 'executor'`): 220 HP, odporność
na odrzut 0,6, cios 28 obrażeń z `attackTags: ['#melee', '#heavy']`.
Zapowiedź trwa 0,7 s i emituje `enemy_telegraph.kind: 'heavy'`. Paruje lekki
`#melee` raz na `parry.cooldownS` = 2,5 s w stanie `idle` lub `chase`,
jeśli nie jest ogłuszony. Kolejne cięcia w odnowieniu, ciężkie ciosy
i strzały trafiają normalnie. Gdy gracz jest w zasięgu 1,8 m, sparowanie
od razu rozpoczyna zapowiedź kontry skierowanej do gracza. Kontra prosi
o ten sam token `melee` co zwykły atak; brak tokenu pozwala tylko sparować.
Podczas zapowiedzi, wymachu, regeneracji i ogłuszenia Egzekutor nie paruje.

Obie obrony korzystają z `DamageTargetOptions.guard` (kontrakt F2-14):
blok zwraca 0, nie emituje `damage_dealt`, emituje za to
`melee_blocked { defender, attacker, amount }` z pierwotną kwotą trafienia.
Statusy są nakładane tylko przez zwykłą ścieżkę obrażeń; przeciążenie z mocy
z tagiem `#power` przechodzi przez tarczę.

**Widok:** oba warianty używają `enemy_trooper`. Tarcza jest osobnym meshem
materiału `enemy` pod `root`, więc pozostaje po wczytaniu GLB; widoczność
wynika z `shieldUp`. Jej rozmiar to `animation.shieldSizeM`. Egzekutor
zastępuje pałkę dłuższym ostrzem `enemyGlow`, o rozmiarze
`animation.bladeSizeM`, także w modelu GLB. Pozostałe archetypy zachowują
dotychczasowy wygląd. Geometrie obu dodatków są zwalniane z widokiem.

**Kontrola w 30 sekund:** `?scene=ai-test&debug=1`, `god`, `kill all`,
`spawn shielder 1`: strzel lub tnij z przodu, potem zajdź z boku; ciężki
cios powinien odsłonić wroga na 3 s. Sprawdź przeciążenie mocą z tagiem
`#power`. Następnie `kill all`, `spawn executor 1`: lekkie cięcie wywołuje
parowanie i długą zapowiedź ciężkiej kontry; odskocz, potem wykorzystaj
odnowienie parowania. Ciężki cios przerywa kontrę. Ocena feel: czy tarcza
czytelnie znika po wytrąceniu i czy 0,7 s wystarcza na rozpoznanie kontry.

Testy: `tests/unit/shielderExecutor.test.ts` — prawdziwy Rapier, walidacja
i rejestr, przedni łuk i jego granica, flankowanie, ciężki cios, powrót
tarczy, hitstop, przeciążenie i ogłuszenie, brak kierunku, parowanie,
ciężka kontra, odnowienie i token dyrektora; widok fallback i GLB, materiały,
proporcje oraz zwalnianie geometrii. `damage.test.ts` sprawdza kontrakt `guard`.
