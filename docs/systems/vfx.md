# Odłamki wrogów — F1 #12

## Wybuch ognia (Z21)

`ExplosionRenderer(bus, options?)` wzmacnia wybuch z parą `#hazard` +
`#explosion` oraz z `#fire`. Pierwszeństwo mają `#power` i `#elektrycznosc`:
zachowują dotychczasową kulę, kolor, czas i opacity, bez nowego feedbacku.
Ogień ma rdzeń ciepłej bieli z bloomem, kulę od `#ffb84d` do ciemnego
żółtawego pomarańczu `#a66b08` i addytywny pierścień na podłodze.
Materiały testują głębię, nie zapisują jej; nowe efekty nie dostają konturu.
Stała pula 16 wybuchów ma po trzy meshe, współdzieloną sferę i pierścień.
Po przepełnieniu zastępowany jest najstarszy wybuch; dispose zwalnia własne zasoby.

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

Kula ognia używa czasu 0,3 s, narasta według pierwiastka postępu od 15%
promienia i zanika liniowo. Pierścień narasta tak samo do 120% promienia.
`options.floorY` ustawia podłogę (domyślnie 0).
`options.burstSparks(point, count, color)` podpina istniejący `HitSparks.burst`;
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
oś Y jest spłaszczona do 25%, obrót do ±12 rad/s na oś. Parametry te są
lokalnymi stałymi kosmetycznymi; grupa tuningu ma wyłącznie osiem pól z briefu.

`floorY` określa dolną granicę pozycji fragmentu. Opcjonalne
`walls(pos, dir, dist)` otrzymuje jednostkowy kierunek i długość przemieszczenia
w metrach; zwraca odległość najbliższego trafienia albo `null`. Zapytanie powinno
obejmować tylko statyczny świat. Ponieważ kontrakt nie przekazuje normalnej,
uderzenie odwraca prędkość wzdłuż promienia z restytucją 0.3; pozostawia 1 mm
odstępu od ściany. Są to kolizje punktowe, bez kosztu brył fizycznych i bez
zużycia `maxDynamicBodies`.

## Zdarzenia i sylwetka

`EnemyShatter(bus, debris, { positionOf, tuning })` nasłuchuje
`damage_dealt.killed`. `positionOf(id)` zwraca pozycję stóp wroga albo `null`
dla gracza i nieznanych encji. Filtr ten zapobiega rozpadaniu gracza na czerwono.
Liczba fragmentów to zaokrąglone
`clamp(debrisMin + amount * debrisPerDamage, debrisMin, debrisMax)`.
Siła to `debrisStrength + knockback + amount * debrisPerDamage * debrisSize`
(ujemne obrażenia i odrzut są ograniczane do zera).

Łączny limit obejmuje dwa wybuchy: około 80% odłamków pochodzi z tułowia
(1 m nad stopami, półwymiary 0.3 × 0.65 × 0.2 m), reszta z głowy
(1.65 m nad stopami, półwymiary 0.18 m). Zachowuje to pionowy zarys humanoida
bez pobierania węzłów modelu. Oba wybuchy dziedziczą kierunek ciosu.

`DamageSystem` emituje `damage_dealt` przed `enemy_killed`. Identyfikator
zabitego wroga jest zapamiętany, więc para zdarzeń daje jeden rozpad.
Samotne `enemy_killed` daje minimalny rozpad z `dir: null`. Pozycja musi być
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
przekazuje `(pos, quat, scale, alpha)`; referencje są pożyczone, nie należy ich
modyfikować ani zachowywać. `alpha` materiału jest zawsze 1, zanik jest już
uwzględniony w skali. Renderer zwalnia własną geometrię i instancje, zachowując
współdzielony materiał. Scena zapewnia oświetlenie przez `createStyleLights()`.

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
odłamków to `droneDebrisCountMult` (0.5) razy liczba humanoida, rozmiar
`droneDebrisSizeMult` (0.55), rozrzut `droneDebrisSpreadMult` (1.4) razy
domyślny. Odłamki lecą w powietrzu i opadają grawitacją jak pozostałe.

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
`MeshBasicMaterial`. Pojemności ustala `tuning.vfx.maxStatusFlames/Sparks/Stars`;
po wyczerpaniu pula zastępuje najstarszą cząsteczkę, a gwiazdki ponad limit
są pomijane. Pozostałe pola `statusFlame*`, `statusSpark*`, `statusStar*`
są w panelu lil-gui.

## Iskry trafień

`HitSparks` + `HitSparksRenderer` (jedna `InstancedMesh`, kolor na instancję):
przy `damage_dealt` z niepustym `point` rozprysk `hitSparkCount` iskier w
kierunku `dir`. Cyan (`#00e5ff`), gdy źródłem jest gracz; czerwone, gdy celem
jest gracz, a źródłem ktoś inny. Trafienia w gracza bliżej kamery niż
`hitSparkCameraMinM` są pomijane. Pula: `maxHitSparks`. Błysk wylotu broni to
osobne zadanie.

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
  stygnie (`debrisEdgeCoolS`, `debrisEdgeBrightness`) do czerwieni wroga; przy
  zabiciu mocą (`#power`) do magenty Rezonansu. `forEachActive` przekazuje
  dodatkowo wiek fragmentu i barwę (`tint` z `DebrisBurst`).
- **Błyski walki.** `DebrisSystem.flash()` przechowuje 24 kosmetyczne błyski
  (starzeją się w `step()`, nie zużywają puli odłamków, `clear()` je czyści).
  `EnemyShatter` dodaje: przy zabiciu — rozbłysk rdzenia i pierścień w barwie
  rozpadu (`killFlashS`, `killFlashCoreM`, `killFlashRingM`); przy trafieniu
  żywego wroga (bez obrażeń statusów `#status`) — obrys sylwetki (fresnel na
  kapsule bryły, `hitFlashS`, `hitFlashBrightness`) i gwiazdkę iskry w punkcie
  trafienia (`hitFlashStarSizeM`). Kapsuła obrysu bierze wymiary z bryły wroga
  (`enemyBody()`), a gwiazdka bliżej kamery niż `hitFlashCameraMinM` jest
  pomijana.
- **Fale Rezonansu.** `ResonanceWaveFx` (w `LightningRenderer`, który dostaje
  listę mocy, kamerę oraz `EventBus`) startuje po zdarzeniu `power_used`
  dla mocy stożkowej z listy (w scenach gry tylko gracza): Pchnięcie to magentowa czasza z echem w kierunku
  celowania (`resonanceWaveS`), Fala uderzeniowa — pierścień przy podłodze
  (`resonanceRingS`, `resonanceRingDropM`).
- **Chwyt.** Cyan linia (dłoń gracza) zostaje; dookoła magentowa rurka z
  płynącymi pasami i kula przy celu (`grabGlow*`, `grabOrbM`).
- **Bariera.** Cyan płat zostaje; nad nim magentowa siatka heksów z ramą,
  skanem i falą przy odbiciu (`barrierLattice*`).
- **Statusy.** Podpalenie: wąskie języki ognia przy powierzchni bryły zamiast
  rombów nad głową. Przeciążenie: łuk to zygzak 3 cienkich odcinków (połowa
  częstości łuków, ~1,5× dawnej liczby instancji, pula bez zmian).
- **Wybuch ognia.** Kula ma szum turbulencji i wypalanie (dissolve) zamiast
  płaskiej kopuły; gęstsza sfera (24×16). Program shadera jest rozgrzewany w
  pierwszych dwóch klatkach niewidoczną kopią, żeby kompilacja nie zjadła
  pierwszego wybuchu. Po wybuchu beczki `HazardView` zostawia osmalenie,
  bursztynowy żar (1,4 s) i 6 kłębów ciemnego dymu (2,6 s, niskie krycie).
- **Lasery.** Wiązka to miękka rurka z gorącą osią (shader), ostrzeżenie to
  przerywana, maszerująca bursztynowa smuga — telegraf czytelny z daleka.
- **Maska bloomu.** Shadery efektów zwracają krycie równe jasności (zwykłe
  mieszanie), bo kompozycja bloomu przyciemnia obraz alfą maski.
- Ukryte pule efektów mają `userData.vfxPool = true`; `roomStaticBatch.test.ts`
  odejmuje je od pomiaru siatek Z19 (jak rdzenie i pierścienie wybuchów).
