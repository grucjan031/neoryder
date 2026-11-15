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

## Ograniczenia

Pchnięcie i Błyskawica nie trafiają beczek; beczkę odpalają ciosy ostrza,
pociski, wybuchy i pola. Beczki pozostają poza callbackiem celów mocy,
nie są chwytane ani przesuwane.

Audio: `AudioSystem.facts` udostępnia `team` wyłącznie dla
`projectile_spawned`; dla `damage_dealt` nie ma drużyny celu ani źródła.
Reguła `{ killed: true, team: 'neutral' }` nigdy by tu nie pasowała.
`sfx.json` pozostaje bez zmian: zniszczenie beczki może nadal wybrać `kill`.
Rozdzielenie tego dźwięku wymaga rozszerzenia faktów audio poza zakresem Z2.
