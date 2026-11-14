# Odłamki wrogów — F1 #12

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
