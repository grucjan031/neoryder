# System: Drzewka talentów (F4-04)

Źródła: `docs/adr/0007-meta-progres-f4.md` (pkt 4–5), `docs/api.md` (Kontrakty F4), `docs/systems/meta.md`, `docs/systems/patches.md`. Kod: `src/progression/talentSchema.ts` (schemat i loader), `src/progression/talents.ts` (`resolveTalents`, `TalentSystem`), `src/progression/meta.ts` (zakup i reset), `src/scenes/roomScene.ts` (działanie w pokoju), `src/world/run.ts` (Kredyty i zdrowie na start runu). Dane: `src/data/talents/{blade,resonance,gunner,hybrid}.json`.

## Drzewka i progi

Trzy drzewka ścieżek (Ostrze, Rezonans, Strzelec; po 8 węzłów) i drzewko Hybryd (6 węzłów), razem 30. Każdy węzeł ma `tier` 1–4, `cost` 1–3 punkty, `requires` (wszystkie wymagane węzły, dowolne drzewo) i opcjonalnie `requiresTreePoints` (punkty wydane w danym drzewku, tylko hybrydy).

`tierThresholds[tier - 1]` to liczba punktów wydanych w **tym samym drzewku** (suma `cost` kupionych węzłów drzewka), jaka jest potrzebna, by kupić węzeł danego progu. Drzewka ścieżek mają progi `[0, 1, 4, 7]`: korzeń (próg 1, koszt 1) otwiera próg 2, a 4 punkty w drzewku próg 3. Hybrydy mają progi `[0, 0, 0, 0]` i opcjonalne `requiresTreePoints` (punkty wydane w drzewkach ścieżek; punkty wydane w hybrydach nie liczą się do drzewek źródłowych). `hybridDoubleJump` nie ma tego wymagania i jest dostępny od pierwszego punktu: daje `extraJumps +1`, odblokowując jeden skok w powietrzu za 25 wytrzymałości. Pokoje stosują modyfikator przez istniejący `TalentSystem` na `PlayerController.stats`.

Uwaga o danych: pierwotne progi `[0, 2, 5, 8]` zakleszczały każde drzewko (jedyny węzeł progu 1 to korzeń za 1 punkt, a próg 2 wymagał 2), więc w F4-04 przesunięto je o 1. Test `talents.test.ts` pilnuje, że każdy z 30 węzłów jest osiągalny.

## Zakup i reset

Pula punktów: `talentPoints(level) = level - 1`, `freePoints = talentPoints - spentPoints` (`spentPoints` = suma `cost` kupionych węzłów).

`MetaManager.buyTalent(id)` (błędy to `Error` z polskim komunikatem) sprawdza po kolei: węzeł istnieje, nie jest kupiony, `freePoints >= cost`, wszystkie `requires` kupione, punkty wydane w drzewku węzła ≥ `tierThresholds[tier - 1]`, każde `requiresTreePoints[drzewko]` spełnione. Po sukcesie emituje `talents_changed { talents }`. `resetTalents()` jest darmowy i zawsze pełny: czyści listę, punkty wracają do puli, emituje `talents_changed`. `spentInTree(drzewko)` zwraca punkty wydane w drzewku. `debugGrantTalent(id)` dodaje talent bez kosztu i bez sprawdzania progów (konsola debug; nieznany id to błąd, już posiadany jest pominięty bez zdarzenia).

## Walidacja danych (`talentSchema.ts`)

Węzeł (`.strict()`): `id`, `name`, `description` niepuste, `tier` ∈ {1,2,3,4}, `cost` całkowity 1–3, `requires` (węzeł nie może wymagać samego siebie), opcjonalne `requiresTreePoints` (drzewko → całkowita liczba ≥ 1), `effects` (`.strict()`: `modifiers` o schemacie `implantModifierSchema`, `triggers` o schemacie `implantTriggerSchema` – z jego regułami, w tym obowiązkowym `cooldownS` dla `heal`/`explode`/`apply_status_area`, `tags` zaczynające się od `#`, `patches`, `runStart.credits` całkowite ≥ 0). Drzewko: dokładnie 4 progi, niemalejące; id węzłów unikalne w drzewku i w całym komplecie; jedno drzewko na id; każde `requires` musi wskazywać istniejący węzeł (w dowolnym drzewku).

## Efekty węzła (`effects`)

| Pole               | Działanie                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `modifiers`        | `StatModifier` ze źródłem `talent:<id>` na obu instancjach `Stats` gracza (jak implanty) |
| `triggers`         | te same wyzwalacze co implanty, wykonuje je `SynergySystem`                              |
| `tags`             | dokładane do tagów synergii (np. `#build_blade` z korzenia)                              |
| `patches`          | łatki definicji ekwipunku (`docs/systems/patches.md`)                                    |
| `runStart.credits` | Kredyty doliczane przy starcie runu                                                      |

Limity z ADR (testowane na danych): na drzewko suma `damage` (percent) ≤ 0.15, `maxHealth` (flat) ≤ 20, najwyżej 2 węzły zawierające wyłącznie `modifiers`.

## `resolveTalents` i `TalentSystem`

`resolveTalents(ids, trees?)` → `{ modifiers, triggers, tags, patches, runStartCredits }`. Węzły są przetwarzane w kolejności posortowanych id (determinizm, duplikaty liczą się raz), łatki trafiają więc do `resolveLoadout` posortowane po id węzła, w węźle wg tablicy. Nieznany id to błąd `Nieznany talent: <id>`. `triggers` ma postać `{ talentId, trigger }`.

`TalentSystem` (analogiczny do `ImplantSystem`) nakłada i zdejmuje modyfikatory po źródle `talent:<id>` na podanych instancjach `Stats` (`add`, `set`, `clear`; brak pojedynczego `remove`), udostępnia `has()`, `ids()` (kolejność nabycia), `tags()`, `triggers()`, `patches()` (te trzy liczone przez `resolveTalents`, więc w kolejności posortowanych id, a `tags()` zachowuje powtórzenia, które liczą się do `requiresCount` synergii). `add` zwraca `false` dla duplikatu, nieznany id to błąd. Przy zmianie `maxHealth` (odczyt z pierwszej instancji `Stats` o wartości > 0) koryguje bieżące zdrowie tak jak `ImplantSystem`: wzrost dodaje różnicę (tylko żywemu graczowi), spadek przycina do nowego maksimum; opcja `adjustHealth: false` wyłącza korektę (pokój używa jej przy wstępnym `set` z `run.talents`, bo `run.hp` już zawiera premię).

## Działanie w pokoju i w runie

- `RunManager.newRun(seed, loadoutId, { talents, baseMaxHealth? })` zamraża talenty w `RunState.talents` (bez duplikatów, nieznany id to błąd), ustawia startowe Kredyty na `runStartCredits` (suma `runStart.credits` talentów) i startowe `hp` na `initialHp` menedżera (100) plus przyrost `maxHealth` z talentów liczony na `Stats` z bazą `baseMaxHealth` (domyślnie `initialHp`; uwzględnia tylko modyfikatory `maxHealth`, flat i percent). Dzięki temu run z talentem `maxHealth +15` startuje z pełnym zdrowiem 115, a `RoomScene` jak dotąd startuje z `run.hp`.
- `RoomScene` czyta talenty z `run.talents`: modyfikatory na `playerStats` i `player.stats`, tagi talentów obok tagów ekwipunku i implantów w `SynergySystem.setTags`, wyzwalacze talentów razem z wyzwalaczami implantów w `setImplantTriggers` (id synergii `implant:talent:<id>:<n>`, zachowanie implantów bez zmian). Dzięki temu `#build_blade` + `#build_resonance` z korzeni włącza synergię `bladeDancer` (`query('synergies')`).
- Łatki: `resolveLoadout(run.loadout, [...łatki talentów (po id węzła), ...options.patches])`.

### Odnowienia wyzwalaczy talentów (`cooldownS`, s)

`bladeRiposte` 1; `bladeHeavyBreaker` 2 (wyzwalacz: `damage_dealt` z tagiem `#heavy`); `bladePhantomStep` 1,5; `resonanceArcConduct` 1,5 (wyzwalacz: `damage_dealt` z tagiem `#elektrycznosc`; łańcuch ma tag `#synergy`, więc nie wyzwala sam siebie); `resonanceFluxReturn` 1; `gunnerIncendiaryRounds` 1; `gunnerHeadhunter` 2; `hybridStormDancer` 2; `hybridResonanceGunner` 1,5; `hybridBladeGunner` 2 (dash) i 1,5 (zabójstwo `#melee`); `hybridArcBlade` 1,5 (trafienie `#melee`, łańcuch 5 m × 0,35, tag `#elektrycznosc`); `hybridApexProtocol` 2 (dowolne zabójstwo gracza: +10 energii, −20 ciepła). Wyzwalacze wszystkich talentów działają jak wyzwalacze implantów (osobne odnowienie na wyzwalacz, efekt czasowy odświeżany bez kumulacji).

## Debug

W pokoju (`room-test`, `run`): `talent <id>` dodaje talent na żywo (modyfikatory, tagi, wyzwalacze; premia do `maxHealth` podnosi też bieżące zdrowie); **łatki ekwipunku z komendy działają dopiero od następnego pokoju** (ekwipunek jest budowany raz przy starcie pokoju, a przebudowa zresetowałaby ciepło broni i odnowienia mocy). `talent reset` zdejmuje wszystkie talenty z bieżącego pokoju. `query('talents')` zwraca id aktywnych talentów. Sprawdzenie w 30 sekund: `?scene=room-test`, `talent bladeRoot`, `talent resonanceRoot`, `query('synergies')` zawiera `bladeDancer`; `talent bladeServoFrame` podnosi `query('playerMaxHp')` z 100 do 115.

## Lista węzłów

### Ostrze (`blade`, progi [0,1,4,7])

| id                  | Nazwa              | Próg | Koszt | Wymaga          | Efekt                                                                                                              |
| ------------------- | ------------------ | ---- | ----- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `bladeRoot`         | Rdzeń Ostrza       | 1    | 1     | —               | Odblokowuje styl Ostrza (#build_blade) i zwiększa zasięg cięć w combo o 10%.                                       |
| `bladeRiposte`      | Kontra parowania   | 2    | 1     | bladeRoot       | Udane parowanie regeneruje 10 energii i skraca czas odnowienia dashu o 30% na 3 s.                                 |
| `bladeDashCut`      | Cięcie w ślizgu    | 2    | 2     | bladeRoot       | Zwiększa obrażenia cięcia z dashu o 25% oraz jego szerokość o 0.5 m dla wszystkich ostrzy.                         |
| `bladeServoFrame`   | Serwomotory klingi | 2    | 2     | bladeRoot       | Zwiększa szybkość ataku o 12% i wytrzymałość o 15 pkt zdrowia.                                                     |
| `bladeThrowEdge`    | Bumerang plazmowy  | 3    | 2     | bladeDashCut    | Rzut ostrzem plazmowym zadaje o 25% więcej obrażeń, leci o 4 m dalej i zapewnia 30 kredytów na start runu.         |
| `bladeAegisBlock`   | Defleksyjna garda  | 3    | 2     | bladeRiposte    | Zmniejsza obrażenia przyjmowane w bloku o 0.1 oraz koszt energii za trafienie o 2 pkt.                             |
| `bladeHeavyBreaker` | Rozbijacz pancerza | 4    | 3     | bladeThrowEdge  | Ciężki atak ostrzem zyskuje +25% obrażeń i +3 odrzutu, a każde ciężkie trafienie zwiększa obrażenia o 10% na 4 s.  |
| `bladePhantomStep`  | Widmowy krok       | 4    | 3     | bladeAegisBlock | Zabójstwo w zwarciu przyspiesza ruch o 20% na 3 s i skraca odnowienie dashu o 25% na 3 s, a obrażenia rosną o 10%. |

### Rezonans (`resonance`, progi [0,1,4,7])

| id                      | Nazwa                                 | Próg | Koszt | Wymaga                | Efekt                                                                                                                       |
| ----------------------- | ------------------------------------- | ---- | ----- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `resonanceRoot`         | Rdzeń Rezonansu                       | 1    | 1     | —                     | Odblokowuje styl Rezonansu (#build_resonance) i obniża koszt energii wszystkich zdolności Rezonansu o 15%.                  |
| `resonanceChainSplit`   | Błyskawica: rozgałęzienie             | 2    | 2     | resonanceRoot         | Błyskawica wykonuje o 1 przeskok więcej, ma o 2 m większy zasięg przeskoku i zadaje o 20% wyższe obrażenia.                 |
| `resonanceKineticWave`  | Pchnięcie i Fala: rezonans kinetyczny | 2    | 1     | resonanceRoot         | Pchnięcie Rezonansu i Fala uderzeniowa zyskują +25% obrażeń od zderzenia ze ścianą oraz +2 m zasięgu.                       |
| `resonanceCapacitor`    | Kondensator synaptyczny               | 2    | 2     | resonanceRoot         | Zwiększa maksymalną energię o 25 pkt oraz jej regenerację o 3/s.                                                            |
| `resonanceBarrierFocus` | Bariera i Skupienie: stabilizacja     | 3    | 2     | resonanceKineticWave  | Wydłuża czas trwania Bariery i Skupienia o 1 s oraz rozszerza łuk Bariery do 220°.                                          |
| `resonanceGrabThrow`    | Chwyt i rzut: przeciążenie            | 3    | 2     | resonanceChainSplit   | Chwyt i rzut podnosi cięższe cele (+50 kg), zadaje o 30% większe obrażenia przy zderzeniu i daje 25 kredytów na start runu. |
| `resonanceArcConduct`   | Przewodnictwo burzowe                 | 4    | 3     | resonanceGrabThrow    | Trafienia elektrycznością przeskakują na cel w promieniu 5.5 m za 45% obrażeń i zwiększają obrażenia o 10% na 3 s.          |
| `resonanceFluxReturn`   | Odbicie fazowe                        | 4    | 3     | resonanceBarrierFocus | Odbicie pocisku przywraca 8 energii i schładza broń o 20 pkt, a bazowe obrażenia i zdrowie rosną o 12% i 15 pkt.            |

### Strzelec (`gunner`, progi [0,1,4,7])

| id                       | Nazwa                                     | Próg | Koszt | Wymaga             | Efekt                                                                                                               |
| ------------------------ | ----------------------------------------- | ---- | ----- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `gunnerRoot`             | Rdzeń Strzelca                            | 1    | 1     | —                  | Odblokowuje styl Strzelca (#build_gunner) i zmniejsza nagrzewanie wszystkich broni palnych o 15%.                   |
| `gunnerScatterChoke`     | Rozpraszacz: ciasny czok                  | 2    | 2     | gunnerRoot         | Rozpraszacz wystrzeliwuje o 2 śruciny więcej i zawęża rozrzut o 2°.                                                 |
| `gunnerRapidCaliber`     | Blaster, Pistolet i Karabin: szybki zamek | 2    | 2     | gunnerRoot         | Zwiększa szybkostrzelność Blastera, Pistoletu i Karabinu o 20% oraz obrażenia Blastera o 15%.                       |
| `gunnerCryoChamber`      | Komora kriogeniczna                       | 2    | 1     | gunnerRoot         | Zwiększa pojemność cieplną broni o 25 pkt oraz tempo chłodzenia o 20%.                                              |
| `gunnerSniperBeam`       | Snajperka i Laser ciągły: przebicie       | 3    | 2     | gunnerRapidCaliber | Snajperka przebija o 1 cel więcej przy mniejszym spadku obrażeń (−0.1), a Laser ciągły zyskuje +4 m zasięgu.        |
| `gunnerEmpIncendiary`    | Granat EMP: wyładowanie wtórne            | 3    | 2     | gunnerScatterChoke | Granat EMP zwiększa promień wybuchu o 1.5 m, nakłada o 1 stos przeciążenia więcej i daje 35 kredytów na start runu. |
| `gunnerIncendiaryRounds` | Pistolet i Karabin: amunicja termiczna    | 4    | 3     | gunnerSniperBeam   | Strzały Pistoletu i Karabinu podpalają cel na 3 s, a zabójstwo bronią palną schładza broń o 25 pkt.                 |
| `gunnerHeadhunter`       | Zimna precyzja                            | 4    | 3     | gunnerCryoChamber  | Trafienia bronią palną przyspieszają chłodzenie o 25% na 3 s, a bazowe obrażenia i zdrowie rosną o 12% i 15 pkt.    |

### Hybrydy (`hybrid`, progi [0,0,0,0])

| id                      | Nazwa           | Próg | Koszt | Wymaga                                        | Efekt                                                                                                                      |
| ----------------------- | --------------- | ---- | ----- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `hybridStormDancer`     | Tancerz burzy   | 1    | 2     | 3 pkt: blade, 3 pkt: resonance                | Użycie zdolności Rezonansu zwiększa szybkość ataku o 20% i skraca odnowienie dashu o 30% na 3 s.                           |
| `hybridDoubleJump`      | Podwójny skok   | 1    | 1     | brak                                          | Jeden dodatkowy skok w powietrzu (`extraJumps +1`), koszt: 25 wytrzymałości.                                               |
| `hybridResonanceGunner` | Spust Rezonansu | 1    | 2     | 3 pkt: resonance, 3 pkt: gunner               | Zabójstwo zdolnością Rezonansu schładza broń o 40 pkt, a Błyskawica zadaje o 20% wyższe obrażenia.                         |
| `hybridBladeGunner`     | Ostrze i lufa   | 1    | 2     | 3 pkt: blade, 3 pkt: gunner                   | Dash zwiększa obrażenia o 18% na 2.5 s, a zabójstwo w zwarciu schładza broń palną o 35 pkt.                                |
| `hybridArcBlade`        | Iskrząca klinga | 1    | 3     | 4 pkt: blade, 4 pkt: resonance                | Trafienie ostrzem plazmowym wyzwala łuk elektryczny w promieniu 5 m za 35% obrażeń i przyspiesza ruch o 10%.               |
| `hybridApexProtocol`    | Protokół Apex   | 1    | 3     | 3 pkt: blade, 3 pkt: resonance, 3 pkt: gunner | Zabójstwo daje +10 energii i −20 ciepła, a bazowe obrażenia, zdrowie i startowe kredyty rosną o 12%, 20 pkt i 40 kredytów. |

## Testy

`tests/unit/talents.test.ts` (dane: komplet węzłów, polskie teksty, limity, tagi korzeni, osiągalność, łatki względem celów; `resolveTalents`, `TalentSystem`, `newRun`, pokój bez przeglądarki z `bladeDancer`, łatkami i komendami) oraz `tests/unit/meta.test.ts` (zakup, progi, hybrydy, reset).
