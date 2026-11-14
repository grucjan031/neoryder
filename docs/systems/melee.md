# Ostrze plazmowe (F1 #07)

Właściciel: Walka wręcz. Kod: `src/combat/melee/` (`plasmaBlade.ts`, `bladeSchema.ts`), dane: `src/data/blades/*.json` (`plasmaBlade`, `twinBlades`, `staffBlade`), scena: `?scene=melee-test`.

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

## Rzut i dash-cięcie (F2-10)

- Środkowy przycisk myszy (`bladeThrow`) rzuca ostrze w kierunku celowania.
  Dane `throw` w `src/data/blades/plasmaBlade.json`: obrażenia 35,
  prędkość 20 m/s, zasięg 16 m, promień toru 0,35 m, powrót 26 m/s.
  Kierunek wylotu jest stały. Raycast Rapiera ograniczony do geometrii świata
  zatrzymuje środek ostrza o `radiusM` przed ścianą i przełącza na powrót;
  raycast uwzględnia promień także przed końcem bieżącego kroku. Powrót śledzi bieżący
  punkt oczu gracza i przechodzi przez geometrię. Każdy wróg otrzymuje obrażenia
  raz na cały lot, również gdy ma wiele hurtboxów. Obrażenia są stałe z danych,
  bez mnożnika głowy. Zdarzenia: `blade_thrown`, `blade_returned` z `owner`.
- W stanie `throwing` ostrze znika z dłoni. Cięcia, ładowanie ciężkiego, blok,
  parowanie i następny rzut są ignorowane. Brak kosztu energii i osobnego cooldownu.
  Render `FlyingBlade` interpoluje pozycję oraz obrót cyjanowego ostrza wyłącznie
  ze stanu symulacji; obrót i rozmiary są w `tuning.melee`.
- Atak podczas dashu lub przez `tuning.melee.dashCutGraceS` (0,1 s) po końcu
  zastępuje lekki cios dash-cięciem. Start jest zapamiętywany z `dash_used`
  przed ruchem gracza. Natychmiast sprawdzany jest cały odcinek do aktualnej
  pozycji, a kolejne kroki obejmują dalszy tor aż do końca dashu. W oknie po
  dashu używany jest zamrożony koniec toru. Dane `dashCut`: obrażenia 50,
  pełna szerokość pasa 2 m, odrzut 7 w kierunku toru. Pas jest poziomy,
  wysokość `dashCutHeightM` (1,2 m), na wysokości oczu. Każdy wróg raz,
  najwyżej jedno dash-cięcie na dash. Combo po nim zaczyna się od etapu 1.
- Obie mechaniki korzystają z `DamageSystem.deal`, źródła gracza, tagów ostrza
  i dotychczasowych zdarzeń obrażeń oraz hitstopu (lekki, ciężki przy zabójstwie).
  Po lekkim hitstopie zabójstwo w dalszym kroku podbija go raz do ciężkiego.
  Punkt obrażeń jest środkiem trafionego hurtboxa (fallback: pozycja encji),
  nie końcem toru. Dodatkowy raycast do celu wyklucza trafienia przez ścianę,
  również dla zerowego odcinka przy ścianie i pierwszego kroku powrotu.
  Gracz i ostrze są krokowane przez `ctx.feel?.playerDt(dt) ?? dt`.
  Nowe zależności `BladeDeps` są opcjonalne: bez nich zachowanie F1 pozostaje.
  Dźwięki nowych zdarzeń pominięte: obecny moduł audio wymaga zmiany listy
  obsługiwanych zdarzeń w kodzie, poza zakresem F2-10.

Rzut i atak używają buforów `tuning.melee.attackBufferMs`; czas bufora nie
upływa w hitstopie. Po wznowieniu sprawdzane są aktualne warunki dash-cięcia,
również na ostatnim kroku okna łaski. Nowe akcje nie przerywają windup/active
lekkiego ciosu ani ładowania i żadnej fazy ciężkiego ciosu (w tym recovery).
Lekki cios można zastąpić w recovery, ciężki dopiero w idle. Przejście po
zakończeniu ciosu odbywa się w następnym kroku, bez sumowania obrażeń akcji
w jednym kroku. Bufor może wygasnąć podczas chronionych faz.
Rzut w dash-cięciu czeka na jego koniec i nie czyści listy trafionych wrogów.
`guardBrokenS` upływa także w obu nowych akcjach.

Zerowy odcinek zachowuje kierunek dashu/celowania (obrót pasa i kierunek
obrażeń). W hitstopie poprzednia pozycja i wiek ostrza są zrównywane z
bieżącymi, więc interpolacja nie cofa lotu ani obrotu. Render lotu działa
także bez kamery w obu scenach. `melee-test` regeneruje energię w czasie
gracza; reset teleportuje gracza do punktu startu (kończy dash), odświeża
stan interpolacji gracza i wykonuje krok świata po przestawieniu manekinów.

`melee-test` zachowuje trzy manekiny; są ustawione w poprzeczny rząd
(dane sceny walidowane zod w `src/data/scenes/meleeTest.json`) i mają ścianę za
plecami. Warianty `push-test` i `parry-test` zachowują swoje ustawienie.
Podpięcie zapytań symulacji i render lotu są też na arenie.
Testy Rapiera: `tests/unit/bladeSpecials.test.ts` — tor, zasięg, powrót,
ściana (również cel 0,1 m za cienką ścianą), jednokrotne obrażenia, blokada
akcji, bufory/hitstop/reset, ochrona ciężkiego ciosu, punkt trafienia, pionowy
rzut, pas dash-cięcia (obrót i wysokość), zerowy tor i okno po dashu.
`tests/unit/bladeSpecialScenes.test.ts`: render bez kamery, energia w czasie
gracza, reset dashu i colliderów.

Ręcznie (około 30 s): podejdź z lewej strony rzędu, wyceluj wzdłuż niego
i naciśnij ŚPM; w czasie powrotu rusz się i spróbuj PPM/LPM. Rzuć w ścianę.
Następnie wykonaj Q tuż obok rzędu i kliknij LPM pod koniec dashu, później
tuż po nim. Oceń czas bez obrony, czytelność powrotu, hitstop przy grupie
oraz tolerancję późnego kliknięcia.

## Parowanie pocisków (F1 #10)

- `PlasmaBlade.interceptProjectile` jest rejestrowane w `ProjectileSystem.addInterceptor`. Gdy pocisk wroga trafia właściciela ostrza, przechwytywacz decyduje przed zadaniem obrażeń.
- **Warunki:** blok trwa nie dłużej niż `parryWindowMs` (150 ms) — czyli blok trzeba **wcisnąć** tuż przed trafieniem, trzymanie bloku daje tylko redukcję −70%; pocisk nadlatuje z przodu (kąt ≤ `parryArcDeg`/2 od kierunku patrzenia).
- **Efekt:** `ProjectileSystem.reflect` — pocisk zmienia właściciela i drużynę na gracza, leci w strzelca (`positionOf`, w razie braku — z powrotem po torze), szybciej ×`parrySpeedMult` (1,8) i mocniej ×`parryDamageMult` (2). Emisja `parry_success { projectile, attacker }` (energia +10 przez `PlayerEnergy`), hitstop `parryHitstopMs` (60 ms), wstrząs `parryShake`.
- Scena `?scene=parry-test`: wariant piaskownicy, w którym środkowy manekin co 1,6 s strzela wolnym pociskiem (9 m/s, 12 obrażeń) w gracza. Ćwiczenie: wciśnij PPM w ostatniej chwili.
- Testy: `tests/unit/parry.test.ts` (prawdziwy Rapier: odbicie w oknie trafia strzelca ×2, blok poza oknem −70% bez odbicia, brak bloku = obrażenia, pocisk z tyłu nieparowany), `tests/e2e/parryTest.spec.ts`.

## Warianty ostrzy (F2-11)

Jedna klasa `PlasmaBlade`, różnice w danych `src/data/blades/<id>.json` (zod, `bladeDefinitions`) i w kształcie trafienia ciężkiego ataku (`heavyShape`: `arc` | `spin`). Wariant wybiera `resolveBlade(loadout.blade, nadpisanie)`: ekran buildu (rząd „Ostrze:”) i `?blade=<id>` nadpisują ostrze ekwipunku na cały run. Zmiana wariantu w trakcie sceny: `PlasmaBlade.setDefinition` (reset stanu ostrza).

| Pole danych                                      | Znaczenie                                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeScale`                                      | mnożnik czasu faz lekkiego i ciężkiego ciosu (czas ładowania i okno combo bez zmian)                                                         |
| `heavyShape`                                     | `arc` (prostopadłościan przed oczami) albo `spin` (kula o promieniu `heavy.reach` wokół oczu — trafia też cele za plecami, odrzut od gracza) |
| `parryArcDeg`                                    | kąt odbijania pocisków; brak = `tuning.melee.parryArcDeg` (160°). Okno parowania `parryWindowMs` wspólne                                     |
| `model`, `offhand`, `doubleEnded`, `lengthScale` | widok FPP (patrz niżej)                                                                                                                      |

Wartości startowe (do strojenia w playteście):

|                            | Plazmowe          | Bliźniacze (`twinBlades`)          | Dwustronne (`staffBlade`)      |
| -------------------------- | ----------------- | ---------------------------------- | ------------------------------ |
| Combo (obrażenia)          | 25 / 25 / 40      | 16 / 16 / 16 / 26 (4 etapy)        | 28 / 28 / 44                   |
| Zasięg × szerokość lekkich | 2,2–2,4 × 2,2–2,6 | 1,8–2,0 × 2,0–2,4 (krótsze ostrze) | 2,2–2,4 × 3,5–4,2 (+60%)       |
| Ciężki                     | 80, łuk           | 52, łuk                            | 88, obrót 360° (promień 2,8 m) |
| Czas faz                   | ×1                | ×0,7                               | ×1,2                           |
| Blok (`blockDamageMult`)   | 0,3               | 0,55                               | 0,3                            |
| Kąt odbijania              | 160°              | 160°                               | 240°                           |

Rzut i dash-cięcie zachowują wszystkie warianty (obrażenia skalowane jak lekkie ciosy). Zdarzenie `melee_swing.stage` ma wartości `1 | 2 | 3 | 4 | 'heavy'`; audio (reguła `melee_swing`) i HUD nie zależą od etapu. Obrót `spin` nie sprawdza zasłonięcia ścianą (jak łuk).

**Widok FPP** (`src/render/fppBlade.ts`): model `/assets/models/<model>.glb`, a gdy pliku nie ma — `plasma_blade.glb` (z `lengthScale` na węźle `blade`), a potem bryła zastępcza. Bliźniacze: druga instancja ostrza, lustrzana, po lewej i niżej (między bronią palną a środkiem ekranu); etapy combo prowadzą naprzemiennie prawym (1, 3) i lewym (2, 4), ciężki i blok używają obu. Dwustronne: węzły `blade_back*` z modelu, a gdy ich brak — kopia przedniego ostrza obrócona o 180° od tyłu rękojeści; obrót 360° w ciężkim ataku to obrót modelu wokół pionowej osi kamery.

Scena `melee-test`: `?blade=<id>` i komenda debug `blade <id>` (przełączenie wariantu w locie), query `bladeId`. Arena: `?blade=<id>`, query `blade`.

Testy: `tests/unit/bladeVariants.test.ts` (dane i walidacja, wybór wariantu, kolejność i czasy combo 1→4, obrót 360° na prawdziwym Rapierze, szerszy łuk, kąt odbijania, słabszy blok), `tests/unit/buildSelect.test.ts` (rząd „Ostrze:”), `tests/unit/arenaBlade.test.ts` (ekran buildu i `?blade=` w arenie).

Ręcznie (ok. 30 s): `?scene=melee-test&blade=twinBlades&debug=1` — cztery szybkie cięcia kolejno prawym i lewym ostrzem, krótszy zasięg; `&blade=staffBlade` — przytrzymaj LPM i puść: obrót 360° rani wszystkie manekiny w zasięgu (komenda `blade <id>` zmienia wariant bez przeładowania).
