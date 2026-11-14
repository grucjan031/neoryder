# Rezonans — moce i energia (F1 #11)

Właściciel: Moce. Kod: `src/combat/powers/` (`energy.ts`, `push.ts`), dane: `src/data/powers/push.json`, sceny: `?scene=push-test` (ze ścianą) i `?scene=melee-test`.

## Energia (`PlayerEnergy`)

- `ResourcePool` zasilany `Stats`: max = `maxEnergy` (100), regeneracja = `energyRegen` (25/s), startuje po `tuning.powers.energyRegenDelayS` (2 s) od ostatniego **zużycia**.
- Ładowanie z akcji (nie wstrzymuje regeneracji): zabójstwo wręcz (`enemy_killed` z `killer` = gracz i tagiem `#melee`) +`meleeKillEnergy` (15), udane parowanie (`parry_success`) +`parryEnergy` (10).
- Ostrze (blok) zużywa energię przez `PlayerEnergy.pool` — jedna pula dla mocy i bloku.
- `energy_changed { id, current, max }` przy każdej zmianie z akcji, a w trakcie regeneracji co najwyżej co `energyEventIntervalS` (0,1 s) — dla HUD (#15).

## Pchnięcie Rezonansu (`ResonancePush`, klawisz F)

| Parametr (dane)                   | Start     | Znaczenie                           |
| --------------------------------- | --------- | ----------------------------------- |
| `cost`                            | 25        | energia za użycie                   |
| `cooldownS`                       | 0,6       | odnowienie                          |
| `coneAngleDeg`, `range`           | 70°, 7 m  | stożek przed oczami (kąt pełny)     |
| `damage`, `knockback`             | 10, 14    | obrażenia i impuls w `damage_dealt` |
| `wallSlamDamage`, `wallSlamRange` | 30, 3,5 m | uderzenie w ścianę                  |

- Odmowa: brak energii → `power_denied { reason: 'no_energy' }`, trwające odnowienie → `reason: 'cooldown'`. Udane użycie → `power_used`, wstrząs kamery (`pushShake`), a przy trafieniu hitstop `pushHitstopMs` (40 ms).
- Cele w stożku dostają obrażenia z tagiem `#power` i odrzut (`damage_dealt.knockback`, kierunek od gracza z lekkim uniesieniem). Ruch po odrzucie realizuje odbiorca (wróg, manekin) — ten sam kanał co ostatni cios combo.
- **Uderzenie w ścianę** jest przewidywane promieniem w chwili pchnięcia: jeśli geometria świata jest bliżej niż `wallSlamRange` w kierunku odrzutu, po czasie lotu (`dystans / knockback`) cel dostaje `wallSlamDamage` z tagami `#power`, `#wall`. Deterministyczne i niezależne od fizyki konkretnego wroga. Ograniczenie: przeszkoda, która pojawi się po pchnięciu, nie liczy się (do oceny w playteście).
- Drużyny filtruje `DamageSystem` (pchnięcie nie rani sojuszników).

## Scena `push-test`

Wariant `melee-test` ze ścianą 2–3 m za manekinami. Manekiny ślizgają się po odrzucie z tarciem i zatrzymują na ścianach (to samo dotyczy odrzutu ostatniego ciosu combo w `melee-test`). Query: `energy`, `dummyHp`, `dummyPos`.

## Testy

`tests/unit/powers.test.ts` (koszt i odmowa, odnowienie, regeneracja po opóźnieniu, ładowanie z zabójstw wręcz i parowania, `energy_changed`, stożek/zasięg/plecy, uderzenie w ścianę po czasie lotu, brak uderzenia przy dalekiej ścianie), `tests/e2e/pushTest.spec.ts` (prawdziwe F: odrzut ponad 1 m, −40 HP, zużycie energii).
