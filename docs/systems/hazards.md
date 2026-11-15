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
Walidator odrzuca powtórzone id, zagrożenia poza podłogą oraz spawn gracza
lub wroga w rzucie pola/lasera na XZ z marginesem 1 m (również gdy hazard jest wyłączony).

## Cykl i trafienia

Czas lokalny to `(czasSymulacji + offsetS) % (offS + onS)`.
Cykl zaczyna się od `off`; ostatnie `min(warnS, offS)` to `warn`, potem `on`.
Pole bez cyklu jest stale włączone. `phaseT` to postęp 0–1 w bieżącej fazie;
dla zagrożeń bez cyklu wynosi 0. Pauza (`dt <= 0`) nie zmienia stanu.

Pole sprawdza **środek kapsuły**, nie stopy ani przecięcie jej powierzchni.
Dla gracza jest to `PlayerState.position`, dla wroga pozycja plus `body.centerY`;
dron jest kulą. Granice prostopadłościanu są włączone. Każde pole ma własny
licznik: trafia co `electricTickS` czasu aktywnego, licznik zeruje się poza `on`.
Trafienie ma `source: null`, tagi `#hazard`, `#elektrycznosc` oraz
`statuses: [{ id: 'overload', durationS: electricOverloadS }]`.

Laser mierzy odległość 3D od odcinka do pionowej osi kapsuły. Trafia, gdy
odległość jest mniejsza od `laserRadiusM + radius` (równość nie trafia).
Okno `laserInvulnS` jest osobne dla każdej encji i każdej bramki.
Tagi: `#hazard`, `#laser`; `source: null`.

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

Wybuch obejmuje odległość do środka celu ≤ `barrelRadiusM`, bez testu zasłonięcia.
Obrażenia maleją liniowo od `barrelDamage` do
`barrelDamage * barrelMinDamageFrac` na krawędzi. Odrzut jest skierowany
od środka; przy zerowej odległości w górę. Tag `#friendly_fire`, obok
`#hazard` i `#explosion`, pozwala zranić także gracza, który odpalił beczkę.
Inna beczka w promieniu zostaje zaplanowana do detonacji po
`barrelChainDelayS`; pierwsze zaplanowane źródło zostaje zachowane.

- Zniszczenie obrażeniami: wybuch dziedziczy ich `source`.
- Łańcuch: kolejne beczki dziedziczą źródło pierwszego wybuchu.
- `source: null`: obrażenia i zabójstwa nadal mają null; jedynie wymagane
  `explosion.owner` otrzymuje id gracza jako fallback.
- Debug `detonate(id)`: źródłem obrażeń i właścicielem wybuchu jest gracz.

## Strojenie i prezentacja

Wszystkie parametry obrażeń, cykli, odrzutu i opóźnień są w `tuning.hazards`;
rekurencyjny panel lil-gui pokazuje tę grupę automatycznie.
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
Obecne pokoje: `combatWarehouse` — 4 beczki; `alleyUnderpass` — pole cykliczne;
`eliteFoundry` — 2 przesunięte bramki i 2 beczki; `combatYard` — stałe pole i beczka.

### Z11: nowe pokoje z zagrożeniami

Wszystkie cztery pokoje mają motyw `neonStreet`, wejście od południa, wyjście
na północ i trafiają do jawnych pul `roomPools` sektora Kurogane. Podane wymiary
obejmują podłogę wraz ze ścianami obwodowymi grubości 1 m.

| id                    | Typ i podłoga     | Zagrożenia                                                                                         | Wybór taktyczny                                                                                                                                  |
| --------------------- | ----------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `combatSubstation`    | combat, 24 × 24 m | 2 pola 6 × 3 m, `onS: 2.5`, `offS: 3.5`, offsety 0 i 3 s; 2 beczki przy północnych spawnach        | środkowa bryła rozdziela przejścia; wybierz cykl po lewej lub prawej albo suche obejście 2 m przy ścianie; beczki zatrzymują grupę od północy    |
| `combatLaserYard`     | combat, 24 × 28 m | 3 lasery na wysokości 0,7 m, długości 21,6 m; cykle on/off/offset: 1,5/2,5/0 s, 2/3/1 s, 1/2/0,5 s | cztery strefy rozdzielone bramkami; czekaj za niską osłoną na przerwę albo przeskocz laser                                                       |
| `eliteChemPlant`      | elite, 28 × 30 m  | 6 beczek w dwóch trójkach; stałe pole 2 × 6 m przy zachodniej ścianie                              | detonuj wybraną grupę z dystansu albo zepchnij wroga Pchnięciem w stałe pole; wewnątrz grup beczki dzieli 2–2,24 m, poniżej `barrelRadiusM: 4.5` |
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
