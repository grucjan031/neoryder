# Odłamki wrogów — F1 #12

## Wybuch ognia (Z21)

`ExplosionRenderer(bus, options?)` (`src/render/explosionRenderer.ts`, zdarzenie
`explosion { point, radiusM, tags }`) wzmacnia wybuch z parą `#hazard` +
`#explosion` oraz z `#fire`. Pierwszeństwo mają `#power` i `#elektrycznosc`:
zachowują dotychczasową kulę, kolor, czas i opacity, bez nowego feedbacku
(kula `#power` ma barwę materiału `power` = magenta Rezonansu `#ff2bd6`, `#elektrycznosc`
ciepłą biel `#fff1d6`, pozostałe wybuchy bez ognia `#ffb84d`; zwykła kula rośnie liniowo
do `radiusM` przez `explosionDurationS` i zanika liniowo od krycia `explosionOpacity`).
Ogień ma rdzeń ciepłej bieli `#fff1d6` × `explosionFlashBrightness` z bloomem, kulę od `#ffb84d` do ciemnego
żółtawego pomarańczu `#a66b08` i addytywny pierścień `#ffb84d` na podłodze
(`RingGeometry(explosionRingInnerFrac, 1, 32)`, płasko na `floorY + explosionRingFloorOffsetM`).
Materiały testują głębię, nie zapisują jej; nowe efekty nie dostają konturu
(kula ognia też nie; zwykła kula zachowuje kontur).
Stała pula 16 wybuchów (`maxExplosions`) ma po trzy meshe (kula 24 × 16 segmentów, rdzeń, pierścień),
współdzieloną sferę i pierścień.
Po przepełnieniu zastępowany jest najstarszy wybuch; dispose zwalnia własne zasoby.
Shader kuli ognia (tylko ogień): szum wartościowy 3D `q = pozycja * 3,2 + (0; −4 t; 0)`,
`n = 0,6 szum(q) + 0,4 szum(2,3 q + 7,1)`, wypalanie przez rosnący próg `burn = 0,95 * postęp`
(`keep = smoothstep(burn − 0,12; burn + 0,12; n)`, żar na krawędzi wypalania
`smoothstep(burn; burn + 0,22; n)` rozjaśnia do `(1; 0,95; 0,85)`), krycie × `keep` × gęstość
środka (`mix(0,25; 1; facing^0,8)`) × `(0,75 + 0,5 n)`, rozjaśnienie brzegu
`facing^3 * 0,35 * (1 − burn)`; czas shadera = wiek + numer wybuchu × 3,7 s (różne
wzory). Program jest rozgrzewany w pierwszych dwóch klatkach niewidoczną kopią.
Przy `fx=lite` wybuchy są niewidoczne i nie wydają iskier.

Parametry `tuning.vfx` (promienie jako mnożniki `explosion.radiusM`):

| Pole                                                                         | Domyślnie                 |
| ---------------------------------------------------------------------------- | ------------------------- |
| `explosionDurationS` / `explosionOpacity`                                    | 0,3 s / 0,4 (stary efekt) |
| `explosionFlashS` / `explosionFlashRadiusScale` / `explosionFlashBrightness` | 0,10 s / 0,22 / 2,5       |
| `explosionFireOpacity` / `explosionFireStartRadiusScale`                     | 0,8 / 0,15                |
| `explosionRingS` / `explosionRingRadiusScale` / `explosionRingInnerFrac`     | 0,28 s / 1,2 / 0,9        |
| `explosionRingOpacity` / `explosionRingFloorOffsetM`                         | 0,65 / 0,025 m            |
| `explosionSparkCount`                                                        | 32                        |
| `explosionShakeIntensity` / `explosionShakeS` / `explosionShakeRadiusScale`  | 0,7 / 0,22 s / 2          |
| `explosionHitstopMs`                                                         | 45 ms                     |
| `maxExplosions`                                                              | 16                        |

Kula ognia używa czasu 0,3 s, narasta według pierwiastka postępu od 15%
promienia i zanika liniowo (krycie `explosionFireOpacity` × (1 − postęp)). Pierścień narasta
tak samo do 120% promienia (czas `explosionRingS`, krycie `explosionRingOpacity` × (1 − postęp)).
Rdzeń ma promień 22% promienia wybuchu, krycie `1 − t/explosionFlashS` i znika po 0,1 s.
`options.floorY` ustawia podłogę (domyślnie 0).
`options.burstSparks(point, count, color)` podpina istniejący `HitSparks.burst`
(wywołanie: `explosionSparkCount` iskier w kolorze `#ffb84d`, tylko dla ognia);
opcjonalny czwarty argument tej metody zmienia liczbę iskier (domyślnie nadal
`hitSparkCount`). RoomScene i Arena używają wspólnej puli 128 iskier;
prędkości, czas życia i grawitacja pozostają z `hitSpark*`. Silny łańcuch
wybuchów może zastępować wcześniejsze iskry. Losowość jest wyłącznie kosmetyczna.

`options.playerPosition()` daje środek gracza. Dla ognia `camera_shake.intensity`
maleje liniowo od 0,7 w centrum do 0 w odległości `2 * radiusM`.
`screenShake=0` blokuje emisję; ułamkowe ustawienie skaluje amplitudę w FpsCamera
dokładnie raz. Hitstop 45 ms występuje tylko przy odległości ≤ `radiusM`.
Domyślne ustawienia są czytane przez `loadSettings()`; można wstrzyknąć
`options.settings`. `flashes=false` ukrywa rdzeń również w trakcie błysku,
zostawiając kulę, pierścień i iskry. Bez dodatkowego PointLight: CityLights
rezerwuje pełną pulę `city.maxLights` i nie udostępnia przydziału chwilowego.

Testy: `explosionVfx.test.ts`, rozszerzenia `roomHazards.test.ts` i
`arenaLoadout.test.ts`. `roomStaticBatch.test.ts` jawnie sprawdza 16 nowych
rdzeni i 16 pierścieni, po czym odejmuje je od historycznego pomiaru Z19;
próg redukcji statycznej geometrii pozostaje bez zmian.
Kontrola dla architekta: pokój `combatWarehouse`,
`hazard detonate warehouse-north`; porównaj bliski i daleki wybuch oraz
`flashes=false` i `screenShake=0`. Z21 nie uruchamia przeglądarki ani zrzutów;
czytelność, bloom i siła odczucia wymagają oceny wizualnej.

`src/vfx/debris.ts` zawiera kosmetyczną kinematykę bez Three.js, DOM i ciał
Rapier. Efekt nie uczestniczy w obrażeniach ani kolizjach gracza. Każdy fragment
ma pozycję, prędkość, kwaternion, prędkość kątową i skalę. Pula jest tworzona
raz; po wyczerpaniu miejsc nowy fragment zastępuje najstarszy aktywny fragment.
`clear()` usuwa wszystkie aktywne odłamki, zachowując pamięć puli.

## Parametry

Wartości `tuning.vfx` są dostępne w panelu lil-gui:

| Pole              | Domyślnie | Znaczenie                                               |
| ----------------- | --------- | ------------------------------------------------------- |
| `maxDebris`       | 600       | Pojemność puli i InstancedMesh, ustalana przy tworzeniu |
| `debrisMin`       | 12        | Minimalna łączna liczba fragmentów wroga                |
| `debrisMax`       | 30        | Maksymalna łączna liczba fragmentów wroga               |
| `debrisPerDamage` | 0.25      | Przyrost liczby na punkt obrażeń                        |
| `debrisStrength`  | 6         | Bazowa prędkość wyrzutu w m/s                           |
| `debrisLifetimeS` | 2.2       | Bazowy czas życia w sekundach                           |
| `debrisGravity`   | -18       | Przyspieszenie pionowe w m/s²                           |
| `debrisSize`      | 0.18      | Bazowy rozmiar fragmentu w metrach                      |

Poza pojemnością wartości są odczytywane na bieżąco: grawitacja w `step()`,
czas życia przy `burst()`, pozostałe parametry przy zabójstwie.
Prędkość początkowa to znormalizowany `dir * strength` oraz symetryczny rozrzut
(domyślnie ±65% siły na każdej osi). `dir: null` daje rozrzut bez kierunku ciosu.
`bounds` rozkłada początki odłamków wewnątrz prostopadłościanu wokół `origin`.
Lokalny mulberry32 ma opcjonalny liczbowy `seed` (domyślnie `0xdecaf`), niezależny
od RNG rozgrywki. Ten sam seed i te same kroki dają identyczny efekt.

Stałe kosmetycznego modelu: czas życia ma rozrzut 80–120%, końcowe 0.4 s
zmniejsza skalę do zera. Restytucja podłogi wynosi 0.3, prędkość pozioma po
odbiciu jest mnożona przez 0.65. Przy prędkości poniżej 0.5 m/s na podłodze
fragment przestaje się poruszać i obracać. Rozmiary osi mają rozrzut 70–130%,
oś Y jest spłaszczona do 25%, obrót do ±12 rad/s na oś. Początkowa orientacja:
oś obrotu = wektor prędkości kątowej, kąt losowy 0..π. Pozycja początkowa
jest obcinana od dołu do `floorY`. Przy zerze miejsc zastępowany jest fragment o
najniższym numerze seryjnym (najstarszy). Uśpiony fragment (po zatrzymaniu) żyje do końca
czasu życia i nadal się zmniejsza. Parametry te są
lokalnymi stałymi kosmetycznymi; grupa tuningu ma osiem pól odłamków z briefu (plus mnożniki drona).

`floorY` określa dolną granicę pozycji fragmentu. Opcjonalne
`walls(pos, dir, dist)` otrzymuje jednostkowy kierunek i długość przemieszczenia
w metrach; zwraca odległość najbliższego trafienia albo `null`. Zapytanie powinno
obejmować tylko statyczny świat. Ponieważ kontrakt nie przekazuje normalnej,
uderzenie odwraca prędkość wzdłuż promienia z restytucją 0.3; pozostawia 1 mm
odstępu od ściany. Są to kolizje punktowe, bez kosztu brył fizycznych i bez
zużycia `maxDynamicBodies`.

## Zdarzenia i sylwetka

`EnemyShatter(bus, debris, { positionOf, tuning, bodyOf?, cameraPosition?, settings? })` nasłuchuje
`damage_dealt.killed`. `positionOf(id)` zwraca pozycję stóp wroga albo `null`
dla gracza i nieznanych encji. Filtr ten zapobiega rozpadaniu gracza na czerwono.
Opcjonalne `bodyOf(id)` daje bryłę wroga (`{x, y (dół), z, height, radius}`, `enemyBody()`:
wysokość 1,8 m i promień 0,3 m domyślnie, dron liczony od środka z `drone.radiusM`);
bez niej błysk przyjmuje bryłę humanoida 1,8 × 0,3 m albo drona o promieniu 0,25 m.
`cameraPosition()` służy do pomijania gwiazdy trafienia, `settings.flashes` (domyślnie
`loadSettings()`) wycisza błyski.
Liczba fragmentów to zaokrąglone
`clamp(debrisMin + amount * debrisPerDamage, debrisMin, debrisMax)`.
Siła to `debrisStrength + knockback + amount * debrisPerDamage * debrisSize`
(ujemne obrażenia i odrzut są ograniczane do zera).

Łączny limit obejmuje dwa wybuchy: około 80% odłamków pochodzi z tułowia
(1 m nad stopami, półwymiary 0.3 × 0.65 × 0.2 m), reszta z głowy
(1.65 m nad stopami, półwymiary 0.18 m; liczba z głowy = `max(1, floor(liczba / 5))`).
Zachowuje to pionowy zarys humanoida
bez pobierania węzłów modelu. Oba wybuchy dziedziczą kierunek ciosu.

`DamageSystem` emituje `damage_dealt` przed `enemy_killed`. Identyfikator
zabitego wroga jest zapamiętany, więc para zdarzeń daje jeden rozpad.
Samotne `enemy_killed` daje minimalny rozpad z kierunkiem zdarzenia, jeśli go
podano. Arena, pokoje i scena `ai-test` synchronizują główny rozpad z upadkiem
wroga. W momencie śmierci pojawia się błysk i około 25% fragmentów z miejsca
trafienia. Po 0,14 s reszta wylatuje z przesuniętej sylwetki. Egzekucje
i wieżyczki rozpadają się od razu. Pozycja musi być
dostępna podczas obsługi zdarzenia: twórz `EnemyShatter` przed subskrypcją,
która usuwa wroga ze sceny. `entity_spawned` i `entity_despawned` czyszczą
zapamiętane ID; `dispose()` odpina wszystkie subskrypcje.

## Podłączenie w scenie

```ts
const debris = new DebrisSystem({
  maxDebris: ctx.tuning.vfx.maxDebris,
  tuning: ctx.tuning.vfx,
  seed: ctx.rng.fork('debris').getState(),
  floorY: 0,
  walls: raycastStaticWorld, // opcjonalne
});
const debrisRenderer = new DebrisRenderer(debris);
const shatter = new EnemyShatter(ctx.bus, debris, {
  positionOf: (id) => enemyFeetPosition(id),
  tuning: ctx.tuning,
});
three.add(debrisRenderer.root);

// scene.step(dt):
debris.step(dt);

// scene.render(alpha):
debrisRenderer.render(alpha);

// scene.dispose():
shatter.dispose();
debrisRenderer.dispose();
debris.clear();
```

`DebrisRenderer` rysuje jeden `InstancedMesh` z fasetowanym tetraedrem i
współdzielonym `getMaterial('enemy')`, bez przezroczystości. Wyłączone
`frustumCulled` zapobiega znikaniu instancji poza początkową obwiednią.
Pozycje, rotacje i skale są interpolowane między stanami `step()`. Nie trzeba
wywoływać osobnego `capturePrevious()`. `forEachActive(cb, interpolation = 1)`
przekazuje `(pos, quat, scale, alpha, age, tint)`; referencje są pożyczone, nie należy ich
modyfikować ani zachowywać. `alpha` materiału jest zawsze 1, zanik jest już
uwzględniony w skali. Renderer zwalnia własną geometrię i instancje, zachowując
współdzielony materiał. Scena zapewnia oświetlenie przez `createStyleLights()`.

## Odłamki otoczenia (fizyka B-P1)

`DebrisBurst.tint` ma paletę: 0 czerwień wroga, 1 magenta Rezonansu (walka) oraz
2 beton `#2b303c`, 3 metal `#4a5260`, 4 tworzywo/drewno `#5c4a38`, 5 szkło `#8ab4f8`
(stała `DEBRIS_TINT`). Barwy otoczenia nie używają czerwieni, cyanu ani magenty
(ADR 0006). `DebrisRenderer` rysuje tint ≥ 2 w osobnej warstwie `debris-env`
(drugi `InstancedMesh` z kolorem instancji + skorupa żaru bursztynowego / ciepłej bieli),
obie siatki mają `vfxPool`. `DebrisBurst.lifetimeS` skraca bazowy czas życia.

`DebrisOptions.walls` może zwrócić `number | null` (stary kontrakt: odbicie wzdłuż
promienia, restytucja `debrisWallRestitution`) albo `{ distance, normal }`. Z normalną
odłamek odbija się fizycznie: składowa normalna `−e·vₙ`, styczna mnożona przez
`debrisWallFriction`. Sceny `RoomScene` i `Arena` podają normalną z `castRayAndGetNormal`.

`src/vfx/worldDebris.ts` (`WorldDebris(bus, debris, { tuning })`) słucha dwóch zdarzeń:
`explosion` z tagami `#hazard` + `#explosion` (beczka, sabotaż) wyrzuca
`barrelDebrisCount` metalowych odłamków promieniście; `world_hit` (pocisk trafił geometrię,
emituje `ProjectileSystem`, także przy rykoszecie) i `prop_destroyed` (rozbita skrzynia, patrz `hazards.md`: odłamki tworzywa `tint 4`) sypie `worldChipCount` okruchów betonu
wzdłuż normalnej na `worldChipLifetimeS`. Zero ciał Rapiera; losowanie tylko z własnego
RNG puli (nie z `ctx.rng`).

| Parametr (`tuning.vfx`)  | Wartość | Opis                                              |
| ------------------------ | ------- | ------------------------------------------------- |
| `debrisWallRestitution`  | 0.3     | Restytucja normalna odbicia od ściany             |
| `debrisWallFriction`     | 0.8     | Mnożnik składowej stycznej po odbiciu             |
| `barrelDebrisCount`      | 18      | Odłamki blachy przy wybuchu beczki                |
| `barrelDebrisStrength`   | 11      | Prędkość wyrzutu, m/s                             |
| `barrelDebrisSize`       | 0.16    | Rozmiar, m                                        |
| `worldChipCount`         | 3       | Okruchy na trafienie pocisku w świat              |
| `worldChipStrength`      | 4.5     | Prędkość okruchów, m/s                            |
| `worldChipSize`          | 0.065   | Rozmiar okruchu, m                                |
| `worldChipLifetimeS`     | 0.9     | Czas życia okruchów, s                            |

Komenda `shatterProp <crate|barrel|wall>` w `debris-test` pokazuje paletę;
w `?scene=room-test&room=combatWarehouse` strzał w ścianę i `hazard detonate` dają ten sam efekt w grze.

## Pokaz i weryfikacja

Otwórz `?scene=debris-test&debug=1&seed=demo`. Statyczna kamera pokazuje białą
podłogę i ścianę, a co 1.2 s wirtualny wróg rozsypuje się w innym kierunku.
`shatter [n]` wywołuje n rozpadów, `perf` czyści pulę i tworzy 20 maksymalnych
rozpadów (600 odłamków). Obie komendy zatrzymują automatyczny pokaz do komendy
`reset`, aby dało się obserwować wygaśnięcie. `query('debris')` zwraca liczbę
aktywnych fragmentów. W ciągu 30 sekund sprawdź kierunek wyrzutu, kanciaste
czerwone płytki, odbicia od podłogi/ściany i zanik przez zmniejszenie skali.

Testy `tests/unit/debris.test.ts` obejmują pulę, kierunek, grawitację, odbicie,
ściany, czas życia, determinizm, interpolację, renderer, zdarzenia i wydajność
600 fragmentów przez 1000 kroków (próg 200 ms w Node). Test przeglądarkowy
`tests/e2e/debrisTest.spec.ts` sprawdza błędy konsoli, `shatter 3`, `perf` oraz
wygaśnięcie, czekając na kroki symulacji przez `waitSimSteps` / `SIM_TIMEOUT`.
Ocena czytelności i odczucia ciosu pozostaje częścią review Architekta.

## Odłamki drona

`EnemyShatter` zapamiętuje rodzaj encji z `entity_spawned.kind`. Dla `drone`
pojedynczy wybuch startuje ze środka bryły (pozycja drona to jego środek, bez
przesunięcia o metr jak u humanoida), w sześcianie o półboku 0.3 m. Liczba
odłamków to `droneDebrisCountMult` (0.5) razy liczba humanoida (`round`, minimum 1,
bez dolnego progu `debrisMin`), rozmiar
`droneDebrisSizeMult` (0.55), rozrzut `droneDebrisSpreadMult` (1.4) razy
domyślny (`strength * 0.65 * 1.4`). Siła drona to `debrisStrength + knockback`
(bez składnika od obrażeń, w odróżnieniu od humanoida). Odłamki lecą w powietrzu
i opadają grawitacją jak pozostałe.

## Efekty statusów na wrogach

`StatusVfx` (`statusVfx.ts`, bez Three.js) słucha `status_applied`,
`status_expired`, `enemy_killed` i `entity_despawned`. Pozycje bierze z
`bodyOf(id, alpha)` (`enemyBody.ts`: interpolowana bryła z publicznego stanu
wroga, dron liczony od środka). Cząsteczki kosmetyczne używają `Math.random()` i
zegara klatki; nie wpływają na symulację.

| Status     | Efekt                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `burning`  | unoszące się płomyki: czerwona podstawa, pomarańczowy pas, biały czubek (kolory wierzchołków)      |
| `overload` | magentowe cienkie łuki wokół korpusu; częstość rośnie liniowo z liczbą stosów                      |
| `stunned`  | pierścień `statusStarCount` białych trójkątów nad głową; kontur z postprocessu czyni je widocznymi |

`StatusVfxRenderer` rysuje trzy `InstancedMesh` (po jednej na typ) z
`MeshBasicMaterial` (dwustronny, bez bloomu; płomienie z kolorami wierzchołków,
łuki i gwiazdki z kolorem instancji). Pojemności ustala `tuning.vfx.maxStatusFlames/Sparks/Stars`
(160 / 96 / 40); po wyczerpaniu pula zastępuje najstarszą cząsteczkę, a gwiazdki ponad limit
są pomijane. Pozostałe pola `statusFlame*`, `statusSpark*`, `statusStar*`
są w panelu lil-gui.

Parametry: język ognia (geometria: dwustożek 4-boczny, wierzchołek górny `#ffffff`,
pas `#ff8a1f`, dolny `#e0262b`): emisja `statusFlameRate` 26/s na płonącego wroga, życie
`statusFlameLifeS` 0,7 s × (0,45–0,9) × (1 − 0,45 h), unoszenie `statusFlameRiseMS` 1,4 m/s ×
(0,45–0,85), rozmiar `statusFlameSizeM` 0,14 m × (0,6–1,3); pojawia się na powierzchni bryły
(promień 0,75–1,1 promienia wroga, wysokość h^0,8 × 92% wysokości), rośnie przez pierwsze 20%
życia, potem zwęża się (`sx` = rozmiar × (0,8 − 0,35 k), `sy` = rozmiar × (1,9 + 1,2 k)), oś
pionowa z lekkim dryfem poziomym. Łuk przeciążenia: zygzak 3 odcinków (`#ff2bd6`, środkowy
`#ffb8f2`), emisja `statusSparkRate` 18/s × `max(1, stosy)` / 2 łuków, życie `statusSparkLifeS`
0,18 s × (0,6–1,4), długość `statusSparkLengthM` 0,45 m × (0,35–0,6) na odcinek, szerokość
`statusSparkWidthM` 0,04 m × (0,3 + 0,25 × zanik), wysokość 15–95% bryły, od 60% życia skraca
się liniowo do zera. Ogłuszenie: `statusStarCount` 5 białych trójkątów na promieniu
`statusStarRadiusM` 0,32 m, obrót `statusStarSpinRadS` 4 rad/s, 0,22 m nad czubkiem
(kołysanie ±0,04 m), rozmiar `statusStarSizeM` 0,1 m. Czas statusów to czas ścienny klatki.

## Iskry trafień

`HitSparks` + `HitSparksRenderer` (jedna `InstancedMesh`, kolor na instancję):
przy `damage_dealt` z niepustym `point` rozprysk `hitSparkCount` iskier w
kierunku `dir`. Cyan (`#00e5ff`), gdy źródłem jest gracz; czerwone (`#e0262b`), gdy celem
jest gracz, a źródłem ktoś inny. Trafienia w gracza bliżej kamery niż
`hitSparkCameraMinM` (0,6 m) są pomijane. Pula: `maxHitSparks` (128). Zdarzenie
`melee_parried` z obrońcą = gracz wydaje `parrySparkCount` (18) cyanowych iskier bez
kierunku (rozprysk dookoła `point`). Parametry iskry: życie
`hitSparkLifeS` 0,28 s × (0,7–1,3), prędkość `hitSparkSpeedMS` 7 m/s × (0,6–1,4) wzdłuż `dir` plus losowy
rozrzut ±`hitSparkSpreadMS` 3,5 m/s na każdej osi, grawitacja `hitSparkGravity` −12, rysowana jako wydłużony
prostopadłościan (bez konturu, z bloomem, kolor na instancję): długość `hitSparkLengthM` 0,24 m × losowy
rozmiar 0,7–1,3 × (1 − wiek/życie), szerokość `hitSparkWidthM` 0,025 m × (0,5 + 1 − wiek/życie), oś
wzdłuż prędkości. Losowość: `Math.random()` (czysto kosmetyczna). Błysk wylotu broni to
osobne zadanie.

## Pył pociągu w kryjówce

`TrainDust` (`src/vfx/trainDust.ts`, używany przez `hubSoundscape`) to stała pula
`tuning.hub.trainDustMax` (96) cząstek, wyzwalana przy przejeździe pociągu: `trainDustCount` 60 pyłków w
`trainDustClusters` (4) skupiskach o promieniu `trainDustRadiusM` 3 m wokół gracza (rozrzut w skupisku
`trainDustSpreadM` 0,45 m), startujących tuż pod sufitem (`playerSpawn.y + trainDustCeilingM` 4,4 m albo
spód najniższej bryły nad graczem w tym miejscu, minus `trainDustCeilingGapM` 0,08 m). Prędkość
pozioma ±`trainDustDriftMS` 0,2 m/s, początkowa pionowa −`trainDustFallMS` 0,3 m/s, grawitacja
`trainDustGravity` −0,8, życie `trainDustLifeS` 3,6 s lub do dotknięcia podłogi; rozmiar
`trainDustSizeM` 0,035 m malejący liniowo do zera, kolor `trainDustColor` `#b7ada0`.
Losowość z `Rng` sceny (`hub-train-dust`).

## Podłączenie i weryfikacja

Arena i sceny `ai-test`/`status-test` tworzą `StatusVfx`, `HitSparks` i ich
renderery, wołają `render(alpha, frameDt)` (statusy) i `render(frameDt)`
(iskry), czyszczą je w `reset()` i zwalniają w `dispose()`. Komenda `status <id>
[s]` (arena i status-test) nakłada status na wszystkich wrogów. Kontrola w 30 s:
`?scene=status-test&debug=1`, poczekaj aż wrogowie podejdą, `status burning`,
`status overload`, `status stunned`; w arenie `spawn drone 3`, `kill all`.
Testy: `tests/unit/vfxEffects.test.ts`.

## Szlif efektów walki (Neon Noir)

Wszystkie zmiany są kosmetyczne: nie dotykają symulacji, obrażeń ani zdarzeń.
Nowe liczby są w `tuning.vfx` (panel lil-gui); istniejące wartości bez zmian.

- **Żar krawędzi cięcia.** `DebrisRenderer` rysuje nad odłamkami drugą
  `InstancedMesh` (`debris-edges`, wspólna macierz instancji) z krawędziami z
  barycentrycznych współrzędnych tetraedru. Żar jest biały w chwili rozpadu i
  stygnie (`debrisEdgeCoolS` 0,35 s, `debrisEdgeBrightness` 1,6) do czerwieni wroga `#ff3b2f`; przy
  zabiciu mocą (`#power`) do magenty Rezonansu `#ff2bd6`. `forEachActive` przekazuje
  dodatkowo wiek fragmentu i barwę (`tint` z `DebrisBurst`). Skorupa żaru ma skalę 1,04
  względem odłamka, miesza zwykłym (nie addytywnym) mieszaniem z bloomem, `renderOrder` 2,
  bez zapisu głębi i konturu. Shader: krawędź = `1 − smoothstep(0,02; 0,07 + 1,5 aa; min(bary))`
  (współrzędne barycentryczne ścian tetraedru), `ciepło = exp(−wiek / debrisEdgeCoolS)`,
  kolor = `mix(barwa, #fff1d6, ciepło² * 0,85) * jasność`, alfa =
  `krawędź * (0,35 + 1,4 ciepło) + (1 − krawędź) * ciepło * 0,45` (obcięta do 0..1).
  Odłamek: tetraedr (`TetrahedronGeometry(1)`), materiał `enemy` (czerwień wroga), bez
  przezroczystości.
- **Błyski walki.** `DebrisSystem.flash()` przechowuje 24 kosmetyczne błyski
  (starzeją się w `step()`, nie zużywają puli odłamków, `clear()` je czyści).
  `EnemyShatter` dodaje: przy zabiciu — rozbłysk rdzenia i pierścień w barwie
  rozpadu (`killFlashS`, `killFlashCoreM`, `killFlashRingM`); przy trafieniu
  żywego wroga (bez obrażeń statusów `#status`, tylko gdy `amount > 0`) — obrys sylwetki (fresnel na
  kapsule bryły, `hitFlashS`, `hitFlashBrightness`) i gwiazdkę iskry w punkcie
  trafienia (`hitFlashStarSizeM`). Kapsuła obrysu bierze wymiary z bryły wroga
  (`enemyBody()`), a gwiazdka bliżej kamery niż `hitFlashCameraMinM` jest
  pomijana. Wartości: `hitFlashS` 0,13 s, `hitFlashBrightness` 1,4, `hitFlashStarSizeM` 0,55 m,
  `hitFlashCameraMinM` 1 m, `killFlashS` 0,34 s, `killFlashCoreM` 0,55 m, `killFlashRingM` 1,7 m.
  Rysowanie (24 widoki, zgodnie z 24 slotami; postęp `k = wiek/czas`, `fade = 1 − k`, barwa gorąca
  `#ff3b2f` albo `#ff2bd6` dla `#power`): obrys = kapsuła (`CapsuleGeometry`) o promieniu
  bryły × 1,4 (trafienie) lub × 1,5 (zabicie), wysokość max(bryła; 2 promienie), pęcznieje
  `1 + 0,08 k` (trafienie) lub `1 + 0,35 k` (zabicie); shader `krycie = (1 − |n·v|)^2,2 * jasność * fade²`
  (jasność 1,4 trafienie / 1,6 zabicie, ×0,35 przy wyłączonych błyskach), kolor
  `mix(gorąca, #fff1d6, 0,8 fade) * 1,3`. Zabicie: rdzeń (ikosfera) biały → gorący, promień
  `killFlashCoreM * (0,45 + 0,55 √kRdzenia)`, `kRdzenia = min(1; 2,4 k)`, krycie `(1 − kRdzenia)^1,5`,
  addytywny, ukryty przy wyłączonych błyskach; pierścień (`RingGeometry(0,82; 1; 40)`, zwrócony ku
  kamerze, zwykłe mieszanie, kolor gorący) o promieniu `killFlashRingM * (0,25 + 0,75 √k)`, krycie `fade² * 0,9`
  (`0,3` przy wyłączonych błyskach). Trafienie: gwiazdka (sprite 64 px: jasny rdzeń, cztery promienie, halo;
  addytywna) o rozmiarze `hitFlashStarSizeM * (0,6 + 0,6 √k)`, krycie `fade`, kolor biały → gorący, ukryta przy
  wyłączonych błyskach i gdy brak punktu trafienia. Rozgrzewka shaderów w pierwszych 2 klatkach (niewidoczne
  kopie). Przy `fx=lite` żar i błyski są ukryte.
- **Fale Rezonansu.** `ResonanceWaveFx` (w `LightningRenderer`, który dostaje
  listę mocy, kamerę oraz `EventBus`) startuje po zdarzeniu `power_used`
  dla mocy stożkowej z listy (w scenach gry tylko gracza): Pchnięcie to magentowa czasza z echem w kierunku
  celowania (`resonanceWaveS`), Fala uderzeniowa — pierścień przy podłodze
  (`resonanceRingS`, `resonanceRingDropM`). Szczegóły: 6 slotów fal (zastępowana najstarsza),
  moc stożkowa = `def.kind === 'cone'` z `coneAngleDeg` (domyślnie 70°) i `range` (domyślnie 5 m);
  `coneAngleDeg ≥ 360` = pierścień. Barwy `#ff2bd6` i jasna `#ffd6f5`, bez zapisu głębi,
  dwustronne, `renderOrder` 19, z bloomem. Czasza = fragment sfery (40 × 6 segmentów, połowa kąta =
  połowa kąta stożka, 10–170°) o wierzchołku 0,15 m za okiem, 3 fale w echu przesunięte o 0,14 czasu: dla
  fali `i` `local = (k − 0,14 i) / (1 − 0,14 i)`, `ease = 1 − (1 − local)^2,5`, długość
  `max(0,05; 0,6 + zasięg * 0,85 * ease)`, szerokość boczna = długość × `(1 − 0,6 ease)`, krycie
  `(1 − local)^1,6` × (1 dla pierwszej, 0,45 dla echa); jasna krawędź `1 − smoothstep(0; 0,32; v)`
  i smugi `|sin((22 u + 1,5 t) π)|^18`. Pierścień (`RingGeometry(0,02; 1; 48)`) leży płasko na
  wysokości oka − `resonanceRingDropM` 1,45 m, promień `zasięg * (1 − (1 − k)³)`, krycie
  `(1 − k)^1,5 * 1,3`, jasne czoło na zewnętrznym brzegu. Czas `resonanceWaveS` 0,34 s,
  `resonanceRingS` 0,42 s.
- **Chwyt.** Cyan linia (dłoń gracza) zostaje; dookoła magentowa rurka z
  płynącymi pasami i kula przy celu (`grabGlow*`, `grabOrbM`). Linia: `grabBeamColor` `#00e5ff`,
  krycie `grabBeamOpacity` 0,85, od punktu dłoni (z kamery: `grabHandSideM` 0,25 w prawo,
  `grabHandDownM` 0,2 w dół, `grabHandForwardM` 0,35 do przodu) do celu. Rurka: otwarty walec
  12 segmentów o promieniu `grabGlowRadiusM` 0,055 m × `(1 + 0,12 sin(18 t))`, barwa `grabGlowColor`
  `#ff2bd6`, rdzeń `#ffd6f5`, krycie `grabGlowOpacity` 1,1, pasy płyną od celu do dłoni; kula
  (ikosfera) o promieniu `grabOrbM` 0,2 m × `(1 + 0,18 sin(11 t))`, addytywna, barwa × 0,55; `renderOrder` 18.
- **Bariera.** Cyan płat zostaje; nad nim magentowa siatka heksów z ramą,
  skanem i falą przy odbiciu (`barrierLattice*`). Płat to fragment bocznej powierzchni walca (kąt łuku z
  definicji mocy, promień `barrierRadiusM` 1,25 m, wysokość `barrierHeightM` 1,1 m, 32 segmenty) 0,9 m
  (`barrierDistanceM`) przed kamerą; kolor `render.player` (cyan), krycie `barrierOpacity` 0,12 do
  `barrierFlashOpacity` 0,55 w czasie błysku odbicia. Siatka: `barrierLatticeColor` `#ff2bd6`, krycie
  0,75, 7 komórek na metr, ramka płata, skan w górę (0,6 cyklu/s) i pierścieniowa fala odbicia z jasnym
  `#ffd6f5`; `renderOrder` 1, z bloomem.
- **Statusy.** Podpalenie: wąskie języki ognia przy powierzchni bryły zamiast
  rombów nad głową. Przeciążenie: łuk to zygzak 3 cienkich odcinków (połowa
  częstości łuków, ~1,5× dawnej liczby instancji, pula bez zmian).
- **Wybuch ognia.** Kula ma szum turbulencji i wypalanie (dissolve) zamiast
  płaskiej kopuły; gęstsza sfera (24×16). Program shadera jest rozgrzewany w
  pierwszych dwóch klatkach niewidoczną kopią, żeby kompilacja nie zjadła
  pierwszego wybuchu. Po wybuchu beczki `HazardView` zostawia osmalenie,
  bursztynowy żar (1,4 s) i 6 kłębów ciemnego dymu (2,6 s, niskie krycie).
- **Lasery.** Wiązka to miękka rurka z gorącą osią (shader), ostrzeżenie to
  przerywana, maszerująca bursztynowa smuga — telegraf czytelny z daleka. Szczegóły
  (`HazardView`): rdzeń to walec o promieniu 0,03 m (12 segmentów), halo to otwarty walec o promieniu
  0,14 m (16 segmentów, shader, bloom, bez konturu); bursztyn `#ffb84d`, ciepła biel `#fff1d6`.
  Faza `off`: rdzeń niewidoczny, światło emitera 0,12; `warn`: halo przerywane (promień ×0,55,
  intensywność `0,55 + 0,6 · fala`, `fala = 0,5 + 0,5 sin(12π · postęp fazy)`), rdzeń ×0,4 dla
  bramy laserowej; `on`: ciepła biel, halo intensywność 1,25 o pełnej szerokości. Pole elektryczne:
  płyta + addytywna powierzchnia (shader), intensywność `off` 0,08, `warn` `0,2 + 0,4 · fala`, `on` 1.
  Beczka wybuchowa po detonacji zostawia osmalenie (koło o promieniu 1,15 m, krycie 0,7 po 0,15 s),
  żar (sprite `#ffae1a`, 1,4 s, krycie `(1 − t)^1,5` z migotaniem) i 6 kłębów dymu (2,6 s, krycie do 0,5).
- **Wiązka broni gracza** (`BeamRenderer`): walec o promieniu `beamRadiusM` 0,018 m
  (8 segmentów) o kolorze gracza (cyan), krycie 0,6, plus trzy warstwy względem promienia:
  biały rdzeń `#f2feff` (×0,45, pełne krycie, jako jedyny zapisuje głębię), cyan `#00e5ff`
  (×2,6, krycie 0,38) i poświata `#3fd8ff` (×6, krycie 0,12), grubość poświat drga
  `1 + 0,12 sin(47 t) + 0,06 sin(113 t)` (krok zegara ≤ 0,1 s). Z bloomem, bez konturu.
- **Maska bloomu.** Shadery efektów zwracają krycie równe jasności (zwykłe
  mieszanie), bo kompozycja bloomu przyciemnia obraz alfą maski.
- Ukryte pule efektów mają `userData.vfxPool = true`; `roomStaticBatch.test.ts`
  odejmuje je od pomiaru siatek Z19 (jak rdzenie i pierścienie wybuchów).

## Pozostałe parametry `tuning.vfx`

Wartości domyślne grup, które nie mają własnej sekcji powyżej (czytają je renderery z
`src/render/`, HUD i widok wrogów; wszystko kosmetyczne):

| Grupa                                 | Klucze i wartości                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Czytelność wrogów (`enemyRim.ts`)     | `enemyDarkShade` 0,3 (jasność `mat_enemy_dark` względem czerwieni), `enemyRimNearM` 4, `enemyRimFarM` 20 (m, poświata krawędzi rośnie między nimi), `enemyRimFarGain` 2,5, `enemyRimFarPower` 1,3, `enemyRimFarFill` 0,2 (płaskie wypełnienie bryły czerwienią z daleka), `enemyRimFogCompensation` 1; siła i wykładnik z motywu: `enemyRimStrength` 0,85, `enemyRimPower` 2,5; kolor `render.enemy`                                                                                                                                                                                                                                                                                                                                    |
| Telegraf ciężkiego ciosu i zagrożenia | `heavyTelegraphColor` `#ffd27a`, `heavyTelegraphEndColor` `#fff4dc`, `heavyTelegraphEndFraction` 0,3, `heavyTelegraphPulseMultiplier` 2, `threatRadiusM` 22, `threatHalfAngleDeg` 40, `threatMaxIndicators` 4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Klinga FPP (`fppBladeFx.ts`)          | `bladeCoreFrac` 0,07, `bladeInnerFrac` 0,3, `bladeOuterFrac` 0,44, `bladeOuterOpacity` 0,85 (granice stref jako ułamek półszerokości quada poświaty), `bladeBands` 4, `bladeBandWidth` 0,35, `bladeBandSwell` 0,02, `bladeBandSpeed` 1,4 (pasm/s), `bladeBandSpeedCalm` 0,15 (przy wyłączonych błyskach), `bladeBandSlashBoost` 2,5; barwy: rdzeń `#e8feff`, wnętrze `#1ef2ff`, otoczka `#00d2f0`, pasma ≈ `#7ff8ff` (liniowo (0,212; 0,94; 1)), flara `#7ff4ff`                                                                                                                                                                                                                                                                        |
| Błyskawica Rezonansu                  | `lightningCoreWidthM` 0,035, `lightningGlowWidthM` 0,16, `lightningGlowOpacity` 0,55, `lightningCoreColor` `#ffe3ff` (poświata w kolorze `power`, magenta), `lightningStrikeFrac` 0,3, `lightningFlickerHz` 30, `lightningFlickerAmount` 0,35, `lightningBranchChance` 0,3, `lightningBranchLengthM` 0,6, `lightningImpactSizeM` 0,35, `lightningMaxArcs` 8, punkt dłoni `lightningHandSideM` −0,22, `lightningHandDownM` 0,2, `lightningHandForwardM` 0,4, zwężanie bliżej niż `lightningNearTaperM` 2 do ułamka `lightningNearMinScale` 0,2                                                                                                                                                                                           |
| Przewrócenie wroga (`enemyKnockdown`) | Upadek 0,22 s do 86°, odbicie 0,07 m. Kip-up 0,62 s. Do 32% nogi dochodzą do 125° w biodrach i 35° w kolanach, korzeń do 120° i 0,22 m. Do 36% zatrzymanie. Do 60% wybicie do 25°, biodra −20°, łuk pleców 35°. Lot po paraboli do 0,75 m. Kontakt przy 80% (korzeń −14°, biodra 75°, kolana 95°), 16 czerwonych iskier. Do 100% powrót do pozy bojowej z przeregulowaniem 4%. |
| Prezentacja bossa                     | `bossIntroS` 1,7, `bossIntroDim` 0,3, `bossWakeAtS` 0,55, `bossWaveRadiusM` 16, `bossWaveS` 0,9, `bossPhaseTint` 0,2, `bossPhaseFlash` 1,7, `bossPhaseShake` 0,35, `bossPhaseShakeS` 0,35, `bossGlowRadiusM` 3,4, `bossAuraRadiusM` 1,25, `bossFanLengthM` 14, `bossDeathFxS` 1,7, `bossDeathShake` 0,7, `bossDeathShakeS` 0,5, `bossDeathSlowmo` 0,3, `bossDeathSlowmoS` 0,6, `bossVictoryHoldS` 1,8, `bossNoFlashFlare` 0,3                                                                                                                                                                                                                                                                                                           |
| Barwy bossa                           | `bossColor` `#ff4a1c` (szkarłat ku pomarańczy), `bossHotColor` `#ffd2c4`, `bossShadeColor` `#ff4a00`, `bossWaveEdgeColor` `#ff8a3c`; telegraf z bliska: `bossTelegraphNearM` 1,8, `bossTelegraphFarM` 6,5, `bossTelegraphNearFill` 0,2, `bossTelegraphNearEdge` 0,55                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `bossArena`                           | `summonRadiusM` 3,2, `shieldRadiusM` 2,8, `phaseEchoRadius` 0,6, `phaseEchoTime` 0,8, `phaseEchoDelayS` 0,14, `phaseEchoStrength` 0,6, `deathCoreWave` {0,35; 0,3; 0; 1,2}, `deathWave` {1,15; 1,25; 0,18; 1}, `deathEchoWave` {1,15; 1,7; 0,5; 0,5} (promień, czas, opóźnienie, siła), `deathColumnRadiusM` 1,5, `deathColumnHeightM` 34, `minionColumnRadiusM` 0,9, `minionColumnHeightM` 9, `minionColumnS` 0,7, `deathSparks` {burst 0 s/46, ember 0,16 s/34, fade 0,42 s/22}, `deathGlowS` 0,9, `slamWaveS` 0,28, `slamWaveStrength` 1,3, `waveShadeStrength` 1, `waveShadeCover` 2,5, `zoneShadeCover` 2,5, `glowShadeCover` 2,5, `shadeMargin` 0,25, `waveShadeMargin` 0,3, `airWarmth` 0,8, `glowWarmth` 0,8, `airShadeCover` 2 |

Uwaga o kolorach: wszystkie barwy bossa są ciepłe (pomarańczowo-czerwone), by nie
zbliżać się do magenty Rezonansu `#ff2bd6` ani cyanu `#00e5ff`; błyskawica Rezonansu i Chwyt
korzystają z magenty (własność Rezonansu), a nie z kolorów otoczenia.

## Arena bossa bez różu (ADR 0006)

Czerwień bossa dodana do fioletowej podłogi dawała róż bliski magencie
Rezonansu. Poprawka tylko w pokoju bossa (`BossArenaFx` i `bossRoom.json`):
światła punktowe areny mają stalowy granat `#8a96b0` zamiast fioletu i
błękitu (neony na ścianach bez zmian); cień mnożący (`bossShadeColor`, bez
błękitu) leży pod polem rażenia, poświatą (także gasnącą po rozpadzie) i całym
śladem fal, z zapasem promienia na bloom (`tuning.vfx.bossArena.*ShadeCover`,
`shadeMargin`, `waveShadeMargin`). Rozbłysk, powłoka fazy i słup rozpadu mają
własny cień mnożący pod sobą oraz cieplejszą bazę (`airWarmth`, poświata
`glowWarmth`). Odbić kałuż (post) cień nie obejmuje. Pomiar:
`node tools/vfx/hueCheck.mjs --url <serwer> --out <katalog> --label <nazwa>`
(GPU, 1280x720; udział odcieni 290–340° w obszarze efektu na podłodze < 2%).

## Profile pogody

Istniejący `Weather` obsługuje teraz opcjonalny `WeatherProfile`:
smugi deszczu/mżawki, wiatr XZ z porywami, wyładowania z deterministycznych
odstępów i dodatkową pulę pyłu. Bez profilu pozostaje stara ścieżka deszczu,
rozbryzgów, stref bez deszczu i burzy. Wszystko jest kosmetyczne, aktualizowane
czasem świata i sprzątane z właścicielem sceny. Dane, limity i test 30 s:
[weather.md](weather.md).
