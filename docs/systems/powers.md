# Rezonans — moce i energia (F1 #11, F2-05)

Właściciel: Moce. Kod: `src/combat/powers/`, dane: `src/data/powers/*.json`, sceny: `?scene=push-test` (dwa sloty, ściana) i `?scene=melee-test` (Pchnięcie z F1).

## Rejestr i wspólna baza

- `powerSchema.ts`: `powerSchema` to unia zod po `kind`, obecnie z jednym mechanizmem `cone`. `registry.ts` eksportuje schemat i typ `PowerDefinition`; ładuje wszystkie `src/data/powers/*.json` przez `import.meta.glob` i waliduje je przy starcie. Nieznany `kind`, błędne parametry i powtórzone `id` kończą się błędem.
- `registerPowerKind(kind, factory)` rejestruje mechanizm raz; ponowna rejestracja tego samego rodzaju kończy się błędem. `createPower(id, deps)` tworzy osobny stan mocy przez fabrykę, a nieznane `id` zgłasza błędem. Nowy wariant `cone` wymaga wyłącznie nowego JSON-a. Nowy rodzaj wymaga gałęzi unii i jednej fabryki.
- `Power` udostępnia `def`, `cooldownRemaining`, `active`, `step(dt, input)` i `reset()`. `PowerInput` niesie `pressed`, `held`, `released` konkretnej akcji. `PowerDeps` zawiera wspólną energię, obrażenia, celowanie, cele, promień ściany, bus i tuning; opcjonalne `projectiles` czeka na Barierę. `FocusControl` i pole `feel` doda F2-06.
- `PowerBase` jako jedyna obsługuje koszt przez `PlayerEnergy.spend`, odnowienie `cooldownS`, odmowę `power_denied` (`cooldown` ma pierwszeństwo przed `no_energy`) i zdarzenie `power_used` przy udanym użyciu. Nieudana próba nie zużywa energii. Samo trzymanie nie ponawia użycia.
- Wciśnięcie przy `dt = 0` trafia do kolejki, wykonywanej raz w pierwszym kroku z `dt > 0`. Hitstop zatrzymuje odnowienie i efekt (także lot do ściany). `reset()` usuwa kolejkę, odnowienie i stan efektu; nie uzupełnia energii.
- `ConePower` zawiera wyłącznie efekt stożka i uderzeń w ścianę. Pchnięcie i Fala korzystają z tej samej klasy, `active = false` (efekt natychmiastowy). `ResonancePush` zachowuje konstruktor, `step(dt, InputSnapshot)`, `use(): number | null` i `reset()` z F1. Jego `loadPush` nadal ogranicza kąt do 180° dla zgodności; ogólny rejestr przyjmuje do 360°.

## Dwa sloty

`PowerSlots` przyjmuje do dwóch mocy lub `null`: slot 0 dostaje `power` (F), slot 1 `power2` (E). Każdy krok przekazuje osobne `pressed/held/released`, również w hitstopie. Pusty slot nic nie robi, `get` poza zakresem zwraca `null`. Obie moce dzielą energię gracza, ale mają osobne odnowienia. `reset()` resetuje obie moce.

## Energia (`PlayerEnergy`)

- `ResourcePool` zasilany `Stats`: max = `maxEnergy` (100), regeneracja = `energyRegen` (25/s), startuje po `tuning.powers.energyRegenDelayS` (2 s) od ostatniego **zużycia**.
- Ładowanie z akcji (nie wstrzymuje regeneracji): zabójstwo wręcz (`enemy_killed` z `killer` = gracz i tagiem `#melee`) +`meleeKillEnergy` (15), udane parowanie (`parry_success`) +`parryEnergy` (10).
- Ostrze (blok) zużywa energię przez `PlayerEnergy.pool` — jedna pula dla mocy i bloku.
- `energy_changed { id, current, max }` przy każdej zmianie z akcji, a w trakcie regeneracji co najwyżej co `energyEventIntervalS` (0,1 s) — dla HUD (#15).

## Pchnięcie Rezonansu (`ResonancePush`, klawisz F)

| Parametr (dane)                   | Start        | Znaczenie                                                       |
| --------------------------------- | ------------ | --------------------------------------------------------------- |
| `cost`                            | 25           | energia za użycie                                               |
| `cooldownS`                       | 0,6          | odnowienie                                                      |
| `coneAngleDeg`, `range`           | 70°, 7 m     | stożek przed oczami (kąt pełny)                                 |
| `damage`, `knockback`             | 10, 14       | obrażenia i impuls w `damage_dealt`                             |
| `wallSlamDamage`, `wallSlamRange` | 30, 3,5 m    | uderzenie w ścianę                                              |
| `knockbackLift`, `shakeDurationS` | 0,15; 0,25 s | minimalna składowa Y kierunku przed normalizacją; czas wstrząsu |

- Odmowa: brak energii → `power_denied { reason: 'no_energy' }`, trwające odnowienie → `reason: 'cooldown'`. Udane użycie → `power_used`, wstrząs kamery (`pushShake`), a przy trafieniu hitstop `pushHitstopMs` (40 ms).
- Cele w stożku dostają obrażenia z tagiem `#power` i odrzut (`damage_dealt.knockback`, kierunek od gracza z lekkim uniesieniem). Ruch po odrzucie realizuje odbiorca (wróg, manekin) — ten sam kanał co ostatni cios combo.
- **Uderzenie w ścianę** jest przewidywane promieniem w chwili pchnięcia: jeśli geometria świata jest bliżej niż `wallSlamRange` w kierunku odrzutu, po czasie lotu (`dystans / knockback`) cel dostaje `wallSlamDamage` z tagami `#power`, `#wall`. Deterministyczne i niezależne od fizyki konkretnego wroga. Ograniczenie: przeszkoda, która pojawi się po pchnięciu, nie liczy się (do oceny w playteście).
- Drużyny filtruje `DamageSystem` (pchnięcie nie rani sojuszników).

## Fala uderzeniowa (`shockwave.json`, klawisz E w push-test)

To wyłącznie dane `kind: "cone"`: pełny kąt `coneAngleDeg = 360` pomija filtr kierunku, więc obejmuje także cele dokładnie za plecami. Zasięg nadal liczony jest w 3D od oczu, odrzut biegnie od gracza do danego celu.

| Parametr                          | Wartość startowa  |
| --------------------------------- | ----------------- |
| `cost`, `cooldownS`               | 40 energii, 1,5 s |
| `coneAngleDeg`, `range`           | 360°, 4 m         |
| `damage`, `knockback`             | 10, 9             |
| `wallSlamDamage`, `wallSlamRange` | 20, 2,5 m         |
| `knockbackLift`, `shakeDurationS` | 0,15; 0,25 s      |

Krótszy zasięg i słabszy odrzut w zamian za kontrolę otoczenia; wyższy koszt i dłuższe odnowienie ograniczają częste czyszczenie przestrzeni. Tagi i feedback jak w Pchnięciu. To balans startowy do F2-18.

## Scena `push-test`

Wariant `melee-test` ze ścianą 2–3 m za przednimi manekinami. `src/data/scenes/pushTest.json` ustawia sloty `["push", "shockwave"]`, trzy dotychczasowe manekiny i dwa za plecami gracza. Kolejność pierwszych trzech manekinów oraz pozycja gracza i ściany pozostają zgodne z testem F1. Manekiny ślizgają się po odrzucie z tarciem i zatrzymują na ścianach (to samo dotyczy odrzutu ostatniego ciosu combo w `melee-test`). Query: `energy`, `dummyHp`, `dummyPos`, `powerSlots`, `powerCooldowns`.

Komenda debug `power <slot 1|2> <id>` wstawia dowolną moc z rejestru do wskazanego slotu jako świeżą instancję. Resetuje zastępowaną moc (usuwa kolejkę i oczekujące uderzenia), zachowuje stan drugiego slotu i bieżącą energię. Błędny slot lub id zwraca pomoc i listę dostępnych mocy. `energy [n]` pokazuje lub ustawia energię. Sceny `melee-test` i `parry-test` zachowują sterowanie F z F1.

### Kontrola w 30 sekund

1. Otwórz `?scene=push-test&debug=1`, kliknij canvas i naciśnij F: środkowy manekin leci do ściany, traci łącznie 40 HP; tylne manekiny pozostają nietknięte.
2. Użyj debug `reset`, naciśnij E i obróć się: wszystkie pobliskie manekiny, także dwa z tyłu, dostają obrażenia i odrzut. Energia spada o 40; natychmiastowe ponowne E jest odrzucone z powodu odnowienia.
3. Wpisz `power 1 shockwave`, potem `energy 100`: F uruchamia teraz Falę. Przy ocenie „feel” porównaj kierunkową siłę Pchnięcia z krótszym odrzutem Fali wokół gracza.

## Testy

`tests/unit/powers.test.ts` i `reviewFixes.test.ts` zachowują asercje F1 (energia, odmowy, stożek, ściana, hitstop i reset). `powerRegistry.test.ts` sprawdza ładowanie i błędy rejestru, wspólną bazę na osobnej mocy testowej, sloty i ich wspólną energię, Falę 360° oraz usuwanie oczekujących uderzeń. `pushTest.test.ts` sprawdza dane sceny, F ze ścianą, E w hitstopie i za plecami, reset, komendę `power`, sprzątanie i zgodność scen F1. `tests/e2e/pushTest.spec.ts` pozostaje bez zmian (prawdziwe F: odrzut ponad 1 m, −40 HP, zużycie energii); uruchamia go menedżer.
