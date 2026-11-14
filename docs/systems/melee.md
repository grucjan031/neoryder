# Ostrze plazmowe (F1 #07)

Właściciel: Walka wręcz. Kod: `src/combat/melee/` (`plasmaBlade.ts`, `bladeSchema.ts`), dane: `src/data/weapons/plasmaBlade.json`, scena: `?scene=melee-test`.

## Sterowanie

| Wejście           | Działanie                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| LPM klik          | lekki cios; kolejne kliknięcia w oknie = combo 1 → 2 → 3                                                                |
| LPM przytrzymanie | po `heavyHoldS` ładowanie ciężkiego; puszczenie po `heavyChargeS` (od wciśnięcia) = ciężki cios; wcześniej = anulowanie |
| PPM przytrzymanie | blok                                                                                                                    |

## Maszyna stanów

`idle → light (windup → active → recovery) → idle`, `charging → heavy (windup → active → recovery)`, `blocking`.

- **Lekki cios startuje od razu** po wciśnięciu (zero opóźnienia). Przytrzymanie przechodzi w ładowanie po zakończeniu fazy aktywnej bieżącego ciosu — więc ciężki atak zawsze poprzedza szybkie cięcie (płynność, do oceny w playteście).
- **Combo:** następny cios można zacząć w fazie `recovery` poprzedniego albo do `comboWindowS` po jego końcu; później combo wraca do etapu 1. Etapy, obrażenia, odrzut, zasięg i szerokość łuku są w danych (`combo[]`, `heavy`).
- **Bufor ataku** `attackBufferMs` (120 ms): kliknięcie w trakcie fazy aktywnej wykona się, gdy tylko będzie możliwe.
- **Trafienia:** w fazie aktywnej każdy krok symulacji pyta o hurtboxy w łuku (`queryArc(reach, width)` — prostopadłościan przed oczami, obrócony zgodnie z patrzeniem). `Hitbox` gwarantuje jedno trafienie na cel na cios; mnożnik hurtboxa (głowa ×1,5) jest stosowany.
- **Hitstop** raz na cios przy pierwszym trafieniu: `tuning.time.hitstopLightMs` (40 ms) dla lekkiego, `hitstopHeavyMs` (80 ms) dla ciężkiego i dla zabójstwa. Wstrząs kamery wynika z `damage_dealt` (FpsCamera).
- **Ciężki cios** dostaje tag `#heavy` (`PIERCE_BLOCK_TAG`) — przebija blok celu.

## Blok

- Wejście w blok dodaje graczowi `StatModifier { stat: 'damageTaken', type: 'mult', value: blockDamageMult (0,3), source: 'block' }`; wyjście go zdejmuje. Redukcję liczy `DamageSystem` — ostrze nie modyfikuje obrażeń samo.
- Każdy zablokowany cios zużywa energię: `blockEnergyPerHit + obrażenia_przed_redukcją × blockEnergyPerDamage` i emituje `melee_blocked { defender, attacker, amount = obrażenia powstrzymane }`.
- **Rozbicie gardy:** gdy energii brakuje — energia spada do 0, blok wyłącza się na `guardBreakLockS` (0,8 s), wstrząs kamery.
- Ciosy z tagiem `#heavy` przechodzą przez blok w całości i nie zużywają energii (`DamageSystem` pomija modyfikatory o źródle `block`).
- `view().blockAgeS` — czas trwania bloku, pod okno parowania (#10).

## Zdarzenia

`melee_swing { attacker, stage }` (na początku zamachu), `hitstop { ms }`, `melee_blocked`, oraz `damage_dealt` z `point`, `dir` (kierunek patrzenia) i `knockback` (ostatni cios combo 7, ciężki 10).

## Strojenie (`tuning.melee`)

`lightWindupS 0.05`, `lightActiveS 0.1`, `lightRecoveryS 0.16`, `comboWindowS 0.3`, `attackBufferMs 120`, `heavyHoldS 0.22`, `heavyChargeS 0.6`, `heavyWindupS 0.04`, `heavyActiveS 0.12`, `heavyRecoveryS 0.38`, `guardBreakLockS 0.8`.

## Scena `melee-test`

Gracz z kamerą FPP, trzy manekiny (100 HP, odradzanie po `tuning.damage.respawnS`), ostrze w widoku FPP z proceduralną animacją (różne kierunki cięć dla etapów combo, odchylenie przy ładowaniu, poza bloku). W trybie debug łuk cięcia rysowany jest jako siatka cyan. Komendy: `enemyhit <dmg> [heavy]` (manekin uderza gracza — test bloku), `energy [n]`. Query: `dummyHp`, `bladeState`, `blocking`, `energy`, `playerHp`.

Energia pochodzi z `PlayerEnergy` (#11, patrz `docs/systems/powers.md`) — jedna pula dla bloku i mocy. W scenie działa też Pchnięcie (F), a manekiny ślizgają się po odrzucie.

## Testy

`tests/unit/plasmaBlade.test.ts` (dane, combo i reset, bufor, jedno trafienie na cios, odrzut, ciężki i anulowanie, hitstop 40/80, blok −70% i energia, przebicie, rozbicie gardy), `tests/e2e/meleeTest.spec.ts` (prawdziwy klik LPM rani manekina, PPM blokuje 40 → 12).

## Parowanie pocisków (F1 #10)

- `PlasmaBlade.interceptProjectile` jest rejestrowane w `ProjectileSystem.addInterceptor`. Gdy pocisk wroga trafia właściciela ostrza, przechwytywacz decyduje przed zadaniem obrażeń.
- **Warunki:** blok trwa nie dłużej niż `parryWindowMs` (150 ms) — czyli blok trzeba **wcisnąć** tuż przed trafieniem, trzymanie bloku daje tylko redukcję −70%; pocisk nadlatuje z przodu (kąt ≤ `parryArcDeg`/2 od kierunku patrzenia).
- **Efekt:** `ProjectileSystem.reflect` — pocisk zmienia właściciela i drużynę na gracza, leci w strzelca (`positionOf`, w razie braku — z powrotem po torze), szybciej ×`parrySpeedMult` (1,8) i mocniej ×`parryDamageMult` (2). Emisja `parry_success { projectile, attacker }` (energia +10 przez `PlayerEnergy`), hitstop `parryHitstopMs` (60 ms), wstrząs `parryShake`.
- Scena `?scene=parry-test`: wariant piaskownicy, w którym środkowy manekin co 1,6 s strzela wolnym pociskiem (9 m/s, 12 obrażeń) w gracza. Ćwiczenie: wciśnij PPM w ostatniej chwili.
- Testy: `tests/unit/parry.test.ts` (prawdziwy Rapier: odbicie w oknie trafia strzelca ×2, blok poza oknem −70% bez odbicia, brak bloku = obrażenia, pocisk z tyłu nieparowany), `tests/e2e/parryTest.spec.ts`.
