# Zagrożenia w pokojach (Z2)

Kod: `src/world/hazards.ts`, `src/render/hazardView.ts`. Kontrakt: `docs/api.md`.
Zagrożenia wspierają pozycjonowanie w walce: pole jako cel Pchnięcia wroga,
beczki do detonowania grup i laser do przeskoczenia.

## Dane i walidacja

Opcjonalne `RoomDefinition.hazards` zawiera unię walidowaną przez zod:

| kind               | Pola poza unikalnym `id`                                           |
| ------------------ | ------------------------------------------------------------------ |
| `electric_field`   | `position` (środek), `size` (dodatnie wymiary), opcjonalny `cycle` |
| `explosive_barrel` | `position` (podstawa walca)                                        |
| `laser_gate`       | `from`, `to` (końce odcinka 3D), obowiązkowy `cycle`               |

`cycle = { onS, offS, offsetS? }`: czasy on/off dodatnie, offset nieujemny.
Walidator odrzuca powtórzone id, zagrożenia poza podłogą (beczka: kwadrat ±0,4 m wokół pozycji,
pole: cztery rogi, laser: oba końce) oraz spawn gracza lub wroga w rzucie pola/lasera na XZ z marginesem 1 m
(również gdy hazard jest wyłączony). Dla beczek margines spawnu nie jest sprawdzany walidatorem
(kontroluje to `contentZ11.test.ts`).

## Cykl i trafienia

Czas lokalny to `(czasSymulacji + offsetS) % (offS + onS)`.
Cykl zaczyna się od `off`; ostatnie `min(warnS, offS)` to `warn`, potem `on`.
Pole bez cyklu jest stale włączone (`on`, dopóki żyje). `phaseT` to postęp 0–1 w bieżącej fazie:
`on` — `(t − offS) / onS`; `warn` — `(t − offS + warn) / warn`; `off` — `t / (offS − warn)`; dla zagrożeń
bez cyklu wynosi 0. Beczka (bez cyklu) ma fazę `on`, dopóki żyje, potem `off`. Pauza (`dt <= 0`) nie
zmienia stanu ani zegara. Czas symulacji rośnie o `dt` na początku `step`, przed obliczeniem faz.
Faza `warn` nie rani; tylko `on` zadaje obrażenia.

Pole sprawdza **środek kapsuły**, nie stopy ani przecięcie jej powierzchni.
Dla gracza jest to `PlayerState.position`, dla wroga pozycja plus `body.centerY`;
dron jest kulą. Granice prostopadłościanu (po osiach X, Y, Z względem `position` ± `size/2`) są włączone.
Cele pola i lasera to także **żywe beczki** (cel: środek `y + 0,55`, promień 0,4, `halfHeight` 0,15) —
pole lub laser może więc je zniszczyć i zdetonować. Każde pole ma własny
licznik: pierwsze trafienie dopiero po `electricTickS` czasu w fazie `on` (nie natychmiast po włączeniu),
potem co `electricTickS`; licznik zeruje się poza `on`. Trafienie: `electricDamage`, bez odrzutu.
Trafienie ma `source: null`, tagi `#hazard`, `#elektrycznosc` oraz
`statuses: [{ id: 'overload', durationS: electricOverloadS }]`.

Laser mierzy odległość 3D od odcinka do pionowej osi kapsuły. Trafia, gdy
odległość jest mniejsza od `laserRadiusM + radius` (równość nie trafia).
Okno `laserInvulnS` jest osobne dla każdej encji i każdej bramki (wpisy znikają, gdy encji nie ma
już wśród celów). Obrażenia `laserDamage`, bez odrzutu i statusu. Tagi: `#hazard`, `#laser`; `source: null`.
W pokoju `puzzleLaser` callback `laserBlocked(id)` przełącza wskazaną bramkę
w fazę `off` dla obrażeń i renderu, gdy osłona przecina wiązkę. Po zaliczeniu
celu przekaźnik utrzymuje stan `off` do wyjścia z pokoju.

Wszystkie obrażenia przechodzą przez `DamageSystem`: obowiązują modyfikatory,
blok i nietykalność celu. Statusy przekazuje zdarzenie `damage_dealt`.
W `RoomScene.step`, tylko dla `dt > 0`, kolejność to
`damage.step(dt)` → `hazards.step(dt)` → `statuses.step(dt)`.
Najpierw aktualizuje się zegar nietykalności, potem trafienia, potem statusy.

## Beczki i kredyt zabójstw

Beczka jest neutralną encją z `Health(barrelHealth)` i hurtboxem. Statyczny
walec Rapier ma promień 0,4 m i wysokość 1,1 m. Grupy World | Enemy umożliwiają
blokowanie ruchu/pocisków i wyszukiwanie hurtboxu przez ostrze; drużyna nadal
pozostaje `neutral`. Beczki nie należą do listy wrogów, fal ani HUD bossa.

`damage_dealt.killed` uruchamia wybuch raz i usuwa collider oraz hurtbox.
Śmierć neutralnej encji nadal emituje `damage_dealt` i `health_changed`,
ale nie `enemy_killed` (dotyczy również neutralnej skrzyni w scenie Chwytu).

Wybuch obejmuje odległość 3D (z osią Y) do środka celu ≤ `barrelRadiusM`, bez testu zasłonięcia;
środek wybuchu to podstawa beczki + 0,55 m w górę. Zdarzenie `explosion { point, radiusM, owner, tags }`
jest emitowane przed obrażeniami.
Obrażenia maleją liniowo od `barrelDamage` do
`barrelDamage * barrelMinDamageFrac` na krawędzi. Odrzut jest skierowany
od środka; przy zerowej odległości w górę. Tag `#friendly_fire`, obok
`#hazard` i `#explosion`, pozwala zranić także gracza, który odpalił beczkę.
Inna beczka w promieniu zostaje zaplanowana do detonacji po
`barrelChainDelayS`; pierwsze zaplanowane źródło zostaje zachowane. Zaplanowane detonacje wykonuje
`step` (na jego początku, po zwiększeniu zegara), więc łańcuch przesuwa się o co najmniej jeden krok;
detonacja zadaje beczce obrażenia równe jej bieżącemu zdrowiu.

- Zniszczenie obrażeniami: wybuch dziedziczy ich `source`.
- Łańcuch: kolejne beczki dziedziczą źródło pierwszego wybuchu.
- `source: null`: obrażenia i zabójstwa nadal mają null; jedynie wymagane
  `explosion.owner` otrzymuje id gracza jako fallback.
- Debug `detonate(id)`: źródłem obrażeń i właścicielem wybuchu jest gracz.

## Strojenie i prezentacja

Wszystkie parametry obrażeń, cykli, odrzutu i opóźnień są w `tuning.hazards`;
rekurencyjny panel lil-gui pokazuje tę grupę automatycznie. Wartości: `electricTickS` 0,5,
`electricDamage` 8, `electricOverloadS` 2, `warnS` 0,6, `barrelHealth` 20, `barrelRadiusM` 4,5,
`barrelDamage` 60, `barrelMinDamageFrac` 0,3, `barrelKnockback` 12, `barrelChainDelayS` 0,15,
`laserDamage` 25, `laserInvulnS` 0,6, `laserRadiusM` 0,15. Wymiary beczki (walec 0,4 × 1,1 m,
cel `halfHeight` 0,15) są stałymi w kodzie `hazards.ts`.
Widok używa bursztynu `#ffb84d`, ciepłej bieli `#fff1d6` i współdzielonego
materiału `hazard` (jasne i ciemne pasy). Nie używa kolorów zarezerwowanych.
Emisja zmienia intensywność sinusoidalnie względem `phaseT`, bez nowego shadera.
`material.userData.bloom` korzysta z istniejącej maski bloomu i testu głębi ścian.
`dispose()` widoku usuwa korzeń, własne geometrie i materiały emisyjne;
współdzielony materiał `hazard` pozostaje własnością cache materiałów.

Symulacja nie używa DOM, Three.js ani losowości. Kolejność: definicje JSON,
gracz, wrogowie w kolejności managera, beczki w kolejności definicji.
Bufory celów, obiekty celów i zbiór id są używane ponownie; odległość lasera
nie tworzy tablic. Migawki `state()`, zdarzenia trafień i wybuchy mogą alokować.
Istniejące `PlayerController.getState()` również tworzy kopię stanu — jego
API pozostaje bez zmian. Migawka celów kroku jest zachowana podczas wybuchu
wywołanego trafieniem pola, aby ponowne zbieranie celów nie nadpisało puli.
`dispose()` symulacji odpina nasłuch, usuwa collidery, hurtboxy, rejestracje
zdrowia, encje i kolejki; kolejne wywołanie jest bezpieczne.

## Debug i testy

`?scene=room-test&room=combatWarehouse&loadout=gunner&seed=hazard-e2e&debug=1`.
`query('hazards')` zwraca kopię serializowalnych stanów (`id`, `kind`, `phase`,
`alive`, `phaseT`). `hazard list` wypisuje te same dane;
`hazard detonate warehouse-north` detonuje wskazaną żywą beczkę.
`targetIds()` zwraca id encji żywych beczek, a nie tekstowe id definicji.

Testy: `hazards.test.ts` (walidacja, pole, laser, wybuchy, neutralni, determinizm,
sprzątanie), `roomHazards.test.ts` (prawdziwy Rapier i pokój bez modeli),
`hazards.spec.ts` (detonacja przez publiczne debug API w przeglądarce).
Ręcznie w 30 s: uruchom pokój, wpisz `hazard list`, detonuj beczkę przy wrogu;
sprawdź zniknięcie i odrzut. W `eliteFoundry` porównaj przesunięte cykle laserów.
Ocena czytelności, bloomu i „feel” pozostaje po stronie architekta.

## Dodanie zagrożenia

Dopisz obiekt do `hazards` w JSON pokoju, nadaj unikalne id, zachowaj wolne
spawny i obejście. Istniejące warianty nie wymagają zmian kodu. Nowy rodzaj
wymaga rozszerzenia unii zod, kontraktu API, symulacji, widoku i testów.
Obecne pokoje: `combatWarehouse` — 4 beczki; `alleyUnderpass` i `alleyUnderpassMission` — pole 2 × 2 m
`onS: 2`, `offS: 3`; `eliteFoundry` — 3 przesunięte bramki (`onS: 2`, `offS: 3`, offsety 0, 1 i 2,5 s) i 2 beczki;
`combatYard` — pole cykliczne przy prasie i 3 beczki; `arenaPowerPlant` — 2 pola cykliczne (`westBus` 6 × 1 × 9 m `onS: 3`, `offS: 2`;
`eastBus` 7 × 1 × 9 m `onS: 4`, `offS: 2`, offset 1 s).

### Z11: nowe pokoje z zagrożeniami

Wszystkie cztery pokoje mają motyw `neonStreet`, wejście od południa, wyjście
na północ i trafiają do jawnych pul `roomPools` sektora Kurogane. Podane wymiary
obejmują podłogę wraz ze ścianami obwodowymi grubości 1 m.

| id                    | Typ i podłoga     | Zagrożenia                                                                                         | Wybór taktyczny                                                                                                                                  |
| --------------------- | ----------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `combatSubstation`    | combat, 80 × 88 m | 4 pola łuków (6 × 3 i 5 × 3 m) między transformatorami, `onS: 2–2.5`, `offS: 3.5–4`, różne offsety; 3 beczki | środkowa bryła rozdziela przejścia; wybierz cykl po lewej lub prawej albo suche obejście 2 m przy ścianie; beczki zatrzymują grupę od północy    |
| `combatLaserYard`     | combat, 24 × 28 m | 3 lasery na wysokości 0,7 m, długości 21,6 m; cykle on/off/offset: 1,5/2,5/0 s, 2/3/1 s, 1/2/0,5 s | cztery strefy rozdzielone bramkami; czekaj za niską osłoną na przerwę albo przeskocz laser                                                       |
| `eliteChemPlant`      | elite, 80 × 110 m | 6 beczek w dwóch trójkach; 4 toksyczne kałuże (pola cykliczne 4–5 × 3 m) i pole 2 × 6 m przy zachodniej ścianie | detonuj wybraną grupę z dystansu albo zepchnij wroga Pchnięciem w stałe pole; wewnątrz grup beczki dzieli 2–2,24 m, poniżej `barrelRadiusM: 4.5` |
| `combatFloodedTunnel` | combat, 12 × 32 m | centralne pole-kałuża 6 × 20 m, `onS: 2`, `offS: 5`                                                | szybka szeroka trasa przez wyłączoną kałużę albo dwa stale suche obejścia po 2 m; pod dachem tunelu spawny pozostają na suchych końcach          |

Wysokość wszystkich pól: 1,4 m, środek y = 0,7 m. Spawny gracza i wrogów
przechodzą `validateLayout`, w tym margines 1 m od pola i lasera oraz
osiągalność. Beczki są poza spawnami i blokami, co dodatkowo kontroluje
`contentZ11.test.ts`. Combat ma po 5 spawnów, elite ma 7.
Oprawa jest skromna: po jednym istniejącym napisie, dwa światła, naklejki
podłogowe i dwie dekoracje; kolory wyłącznie z palety ADR 0006.

Kontrola ręczna dla architekta: `?scene=room-test&room=<id>&debug=1`, następnie
`hazard list`. W podstacji porównaj oba cykle, na placu przejdź trzy bramki,
w zakładzie detonuj `chem-west-a`, a w tunelu porównaj środek i suche obejścia.
Ocena wyglądu, czytelności i „feel” należy do architekta.

## Ograniczenia

Pchnięcie i Błyskawica nie trafiają beczek; beczkę odpalają ciosy ostrza,
pociski, wybuchy i pola. Beczki pozostają poza callbackiem celów mocy,
nie są chwytane ani przesuwane.

Audio: `AudioSystem.facts` udostępnia `team` wyłącznie dla
`projectile_spawned`; dla `damage_dealt` nie ma drużyny celu ani źródła.
Reguła `{ killed: true, team: 'neutral' }` nigdy by tu nie pasowała.
`sfx.json` pozostaje bez zmian: zniszczenie beczki może nadal wybrać `kill`.
Rozdzielenie tego dźwięku wymaga rozszerzenia faktów audio poza zakresem Z2.

## Zniszczalne skrzynie (fizyka B-P2)

`PropPhysicsSystem` (`src/world/propPhysics.ts`) przejmuje z układu pokoju i areny bloki
`model: "crate"` (duża, 1 m) i `"crate_small"` (mała, 0,5 m), chyba że mają `destructible: false`,
`walkable`, `instance` lub `visible: false` (pole `destructible` jest opcjonalne w `roomBlockSchema`).
Scena wywołuje `props.claim(blok)` zamiast tworzyć statyczny collider i siatkę; rysuje je
`PropRenderer` (`src/render/propRenderer.ts`: `InstancedMesh` na część modelu i rodzaj, interpolacja,
uśpione skrzynie nie odświeżają macierzy; bez GLB zostaje box w materiale `interactive`).

- **Duża skrzynia**: nieruchomy collider (grupy `World | Enemy`, jak beczka), `Health` = `props.crateHealth` (35).
  Blokuje ruch i wzrok do rozbicia; hurtbox przyjmuje pociski (także wrogów), ostrze i wybuchy.
- **Mała skrzynia**: dynamiczne ciało Rapiera (`smallCrateMassKg` 15, tłumienie `propDamping`), `Health` 15.
  Startuje w spoczynku; trafienie daje impuls `(knockback + hitMinKnockback) · hitImpulseScale` w stronę
  trafienia z lekkim wzniesieniem, gracz popycha ją biegiem (`enableDynamicPush`). Ciało wolniejsze niż
  `physics.propSleepLinvel` przez `propSleepDelayS` jest usypiane.
- **Limity**: `physics.maxPropBodies` (24) to twardy limit ciał dynamicznych rekwizytów; nadmiar skrzyń zostaje
  nieruchomy, ale zniszczalny. Spawn wrogów nadal sprawdza `maxDynamicBodies` (300).
- **Drzwi i osiągalność**: dynamiczna jest tylko mała skrzynia startująca dalej niż `doorClearM + maxDriftM`
  (4 + 2,5 m) od środka drzwi; ciało odsunięte dalej niż `maxDriftM` od miejsca startu jest zamrażane
  (`Fixed`). Rozbicie usuwa collider, więc przejście nigdy się nie pogarsza. `ArenaNavigation` liczy skrzynie
  jako przeszkody od startu (konserwatywnie): po rozbiciu siatka nie rozszerza się, więc osiągalność jest co najmniej
  taka jak przed zmianą.
- **Zniszczenie**: `damage_dealt` z `killed` usuwa collider/ciało, hurtbox i `Health`, emituje
  `prop_destroyed { id, kind, point, size, dir }`; `WorldDebris` robi z tego `crateDebrisCount` (20) /
  `smallCrateDebrisCount` (12) odłamków tworzywa (`tint 4`) z własnego RNG puli. System nie losuje i nie
  dotyka `ctx.rng`.
- **Wybuchy**: `RoomScene` dopisuje `props.targets()` do celów `HazardSystem`; beczka rozbija skrzynie w
  promieniu (obrażenia `barrelDamage · frac`, mała skrzynia zawsze, duża przy ok. 2/3 promienia).
- **Ograniczenia**: Pchnięcie i Błyskawica nie trafiają skrzyń (jak beczek, patrz wyżej); elektryczne pola i lasery
  także rozbijają skrzynie, które w nich stoją. `Arena` nie ma hazardów, więc wybuchy tam nie sięgają skrzyń.

Parametry: `tuning.props` (`crateHealth` 35, `smallCrateHealth` 15, `smallCrateMassKg` 15, `propDamping` 2,5,
`propFriction` 0,8, `propRestitution` 0,05, `crateDebrisCount` 20, `smallCrateDebrisCount` 12, `debrisStrength` 5,
`debrisSize` 0,14, `hitImpulseScale` 12, `hitMinKnockback` 4, `hitLift` 0,3, `doorClearM` 4, `maxDriftM` 2,5)
oraz `tuning.physics` (`maxPropBodies` 24, `propSleepLinvel` 0,15, `propSleepDelayS` 0,6).
Sprawdzenie w 30 s: `?scene=room-test&room=combatWarehouse&debug=1` — przed spawnem stoją trzy małe skrzynie
(popchnij je, przestrzel, `hazard detonate warehouse-south`), cztery duże służą za osłonę do rozbicia;
`query('props')` zwraca `{ alive, bodies, awake }`. Testy: `tests/unit/propPhysics.test.ts`, `tests/unit/propRoom.test.ts`.

## Wywracalne dekoracje (fizyka B-P3)

`ScatterProps` (`src/world/scatterProps.ts`, rysuje `ScatterRenderer`) zamienia pachołki `city_traffic_cone` i worki
`city_trash_bags` z `layout.decor` w lekkie przeszkody reagujące na ruch. `RoomScene` wybiera do
`props.scatterMaxItems` (16) najbliższych punktu startu gracza i wyłącza je ze scalonego `static-decor`
(osobne modele); przy `quality: 'low'` oraz `fx=lite` dekoracje zostają statyczne. `Arena` nie używa tego mechanizmu.

- Ciało dynamiczne powstaje dopiero przy zakłóceniu (limit `scatterMaxBodies` 12) i znika po uspokojeniu
  (`scatterSleepSpeed` 0,2 m/s przez `scatterSleepS` 0,8 s): dekoracja zostaje w pozie końcowej bez collidera.
- Zakłócenia: `dash_used` gracza (promień `scatterRadiusM` 2,2 m, impuls `scatterImpulse` 5,5 m/s), `explosion`
  (promień wybuchu + `scatterRadiusM`, impuls ×1,6) oraz sprint, ślizg lub dash gracza z prędkością ≥ `scatterMinSpeed`
  (8 m/s) w odległości `scatterTouchM` (0,9 m; raz na zbliżenie). Kierunek poziomo od źródła + `scatterLift`, obrót
  koziołkujący; bez losowości.
- Kolizje: `Debris` z filtrem `World` (czysto kosmetyczne: ani gracz, ani wrogowie, pociski czy wzrok ich nie czują; impuls od gracza
  pochodzi z pozycji i zdarzeń, nie z kolizji). Dlatego zależność od jakości grafiki jest dopuszczalna. Kształt i masa: `props.scatter` (`radiusM`, `heightM`, `massKg` per model).
- Pchnięcie Rezonansu nie przewraca dekoracji (moce celują tylko w wrogów, jak przy beczkach i skrzyniach).

Sprawdzenie: `?scene=room-test&room=combatWarehouse&debug=1` — pachołki przy rogach pokoju; sprint/dash obok
nich albo `hazard detonate warehouse-west`. Testy: `tests/unit/scatterProps.test.ts`.

Kroki `PropPhysicsSystem.step` i `ScatterProps.step` w `RoomScene` wołane są po `world.step()`. Encja rozbitej skrzyni jest usuwana z
`EntityRegistry` w następnym kroku (nie w obsłudze `damage_dealt`, żeby `DamageSystem` nie wyemitował `enemy_killed`).
Ciało skrzyni poza `maxDriftM` (albo spadające głębiej niż `fallLimitM`) jest zamrażane dopiero po opadnięciu.
