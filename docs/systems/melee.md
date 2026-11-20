# Ostrze plazmowe (F1 #07)

Z5: `BladeDeps.attackSpeed()` (opcjonalne, domyślnie 1) dzieli czasy zamachu,
fazy aktywnej i odnowienia lekkiego oraz ciężkiego ciosu. Odczyt pochodzi z
`playerStats` pokoju/areny, baza wynosi 1. Mnożnik jest ograniczony przez
`tuning.melee.attackSpeedMin = 0.5` i `attackSpeedMax = 2` (wspólne z bronią,
widoczne w panelu strojenia). Przy 1,25 czasy wynoszą 80% pierwotnych;
krok symulacji może zaokrąglić przejście fazy. Okna parowania i combo,
ładowanie ciężkiego ciosu oraz rzut i cięcie z dashem pozostają bez zmian.
Testy kontraktu: `tests/unit/playerDamageStats.test.ts`.

Właściciel: Walka wręcz. Kod: `src/combat/melee/` (`plasmaBlade.ts`, `bladeSchema.ts`), dane: `src/data/blades/*.json` (`plasmaBlade`, `twinBlades`, `staffBlade`), scena: `?scene=melee-test`.

## Sterowanie

W arenie wejście rozdziela [HeldItem](hands.md): LPM tnie tylko z ostrzem w ręku,
R zamienia ostrze/broń, a środkowy przycisk przy broni przywraca ostrze natychmiast
i przekazuje rzut w tym samym kroku; PPM z bronią to celowanie (blok tylko z ostrzem). Okno parowania pozostaje
liczone od kroku rozpoczęcia bloku. Podczas zamiany ostrze nie dostaje akcji
ataku; żądanie dobycia broni podczas ciosu czeka maksymalnie `hands.swapBufferS`.
Lot ostrza nie blokuje zamiany i trwa również przy broni w ręku. Sceny testowe
ostrza zachowują dotychczasowe sterowanie.

| Wejście           | Działanie                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| LPM klik          | lekki cios; kolejne kliknięcia w oknie = combo 1 → 2 → 3                                                                |
| LPM przytrzymanie | po `heavyHoldS` ładowanie ciężkiego; puszczenie po `heavyChargeS` (od wciśnięcia) = ciężki cios; wcześniej = anulowanie |
| PPM przytrzymanie | blok                                                                                                                    |

## Maszyna stanów

`idle → light (windup → active → recovery) → idle`, `charging → heavy (windup → active → recovery)`, `blocking`.

- **Lekki cios startuje od razu** po wciśnięciu (zero opóźnienia). `holdS` liczy się od wciśnięcia LPM. Gdy `holdS ≥ heavyHoldS` i stan to `idle` albo lekki cios **nie** w fazie `active` (czyli `windup` lub `recovery`), cios jest przerywany i następuje przejście w `charging` (bufor ataku zerowany). W fazie `active` przejście czeka na jej koniec. Z `heavy` i `charging` nie da się wejść w blok.
- **Puszczenie LPM w `charging`:** `holdS ≥ heavyChargeS` → ciężki cios (`melee_swing` z `stage: 'heavy'`, etap 0), inaczej anulowanie do `idle`. Puszczenie poza `charging` tylko kasuje `holding`.
- **Combo:** następny cios można zacząć w fazie `recovery` poprzedniego (o ile `stage < combo.length`) albo do `comboWindowS` po jego końcu (licznik `sinceSwingS` od `endSwing`); później (lub po ostatnim etapie, lub po ciężkim) combo wraca do etapu 1. W `idle` po `comboWindowS` etap resetuje się do 0. Etapy, obrażenia, odrzut, zasięg i szerokość łuku są w danych (`combo[]` 1–5 etapów, `heavy`).
- **Bufor ataku** `attackBufferMs` (120 ms, maleje w czasie symulacji, nie w hitstopie): kliknięcie wykona się, gdy stan to `idle` albo `recovery` lekkiego ciosu. Kliknięcie w `windup`/`active`, po którym cios nie zdąży się skończyć w 120 ms, przepada. Niezerowy bufor ataku wyłącza też blok.
- **Trafienia:** faza `active` zaczyna sprawdzać trafienia od kroku **po** przejściu z `windup`. W każdym kroku fazy aktywnej scena pyta o hurtboxy (`queryArc(reach, width, shape)`): `arc` = prostopadłościan o środku `oczy + patrzenie × reach/2`, połowy wymiarów `width/2` × **0,6** (stała `ARC_HALF_HEIGHT_M` w `bladeQueries.ts`, nie w tuningu) × `reach/2`, obrócony kwaternionem patrzenia (pitch+yaw); `spin` = kula o promieniu `reach` wokół oczu. Filtr: grupa Gracz → Wróg; jeden hurtbox na encję (o największym mnożniku). `Hitbox` (czas życia = długość fazy `active`) gwarantuje jedno trafienie na cel na cios; mnożnik hurtboxa (głowa ×1,5) mnoży obrażenia ze strike. Punkt trafienia łuku = `oczy + patrzenie × reach × 0,6`, kierunek = patrzenie; dla `spin` punkt = pozycja hurtboxa, kierunek = poziomo od gracza do celu (odrzut na zewnątrz).
- **Hitstop** raz na cios, w kroku pierwszego trafienia: `tuning.time.hitstopLightMs` (40 ms) dla lekkiego, `hitstopHeavyMs` (80 ms) dla ciężkiego albo gdy w **tym samym kroku** padł cel (zabójstwo w późniejszym kroku nie podbija już hitstopu zwykłego cięcia). Wstrząs kamery wynika z `damage_dealt` (FpsCamera).
- **Ciężki cios** dostaje tag `#heavy` (`PIERCE_BLOCK_TAG`) — przebija blok celu.
- **Czasy faz:** `bazowy czas z tuning.melee × timeScale ostrza / attackSpeed`, gdzie `attackSpeed` (z `BladeDeps.attackSpeed()`, domyślnie 1) jest ograniczony do `[attackSpeedMin, attackSpeedMax]` i próbkowany na początku każdej fazy.
- **Przerwanie przez blok:** PPM w `idle` albo w `windup`/`recovery` lekkiego ciosu (przy `guardBrokenS ≤ 0` i pustym buforze ataku) kończy cios i wchodzi w blok; w fazie `active` blok nie wchodzi.

## Wykończenia (Z3)

`ExecuteSystem` jest czystą logiką symulacji. Żywy wróg jest gotowy, jeśli
ma najwyżej 25% HP albo status `stunned`; Egzekutor (`kind: 'executor'`)
ma próg 15%. Boss (`kind: 'boss'`) i wróg nietykalny nigdy nie są gotowi.
Nietykalność odczytuje `DamageSystem.isInvulnerable`: zarówno okno po
trafieniu, jak i callback encji. Gotowość sprawdzana jest ponownie przy ataku (na żywo, bez cache).
`step(dt)` ignoruje `dt ≤ 0` (hitstop nie odświeża gotowości).

Lekki atak z ostrzem wybiera cel o najmniejszym kącie względem osi kamery
w stożku o pełnym kącie 50° i odległości do 2,8 m od oczu do środka korpusu.
Remis rozstrzyga odległość. Raycast świata wyklucza trafienia przez ściany.
Rzut i dash-cięcie mają pierwszeństwo i nie używają haka; ciężki cios również
go nie woła. Jak dotąd przytrzymanie LPM zaczyna się lekkim ciosem, więc
gotowy cel może zostać wykończony już w chwili wciśnięcia.

Obrażenia przez `DamageSystem.deal`: `amount = maxHP celu × 10` (zapas na
redukcje `damageTaken` i mnożnik gracza < 1; `Health` obcina do pozostałego HP),
źródło gracza, `['#melee', '#execute']`, kierunek od oczu do pozycji celu
i odrzut `executeKnockback`. Jeśli cel po `deal` żyje (np. zablokowany `guard`),
ochrona gracza wraca do poprzedniej wartości, wykończenie się nie liczy
(zwraca `false`) i uruchamia się zwykły lekki cios. Udane wykończenie nie
emituje `melee_swing`, nie otwiera hitboxa, nie zaczyna combo (`stage = 0`,
`sinceSwingS = ∞`) i kasuje przytrzymanie LPM (nie przejdzie w ładowanie);
animacja `view().execution` trwa `(lightActiveS + lightRecoveryS) × timeScale`
i nie blokuje kolejnych akcji. Hak wołany tylko ze startu lekkiego ciosu, więc
rzut i dash-cięcie mają pierwszeństwo.
Tarcza Tarczownika i parowanie Egzekutora przepuszczają `#execute`;
zwykły lekki cios nadal jest blokowany. Po śmierci celu combo resetuje się,
energia rośnie o 20, zdrowie o 6 (dotychczasowe API i limity zasobów).
Zwykła nagroda energii za zabójstwo wręcz nadal działa niezależnie.
Ochrona gracza trwa 0,4 s czasu świata i obejmuje synchroniczne skutki
zabójstwa. Callback rejestracji gracza łączy ją z nietykalnością dashu.

Feedback: hitstop 110 ms, slowmo 0,35 przez 0,3 s, camera shake 0,6 przez
`executeSlowmoS` (0,3 s; osobnego czasu wstrząsu nie ma) z kierunkiem do celu. `execute_performed` gra istniejący `hitHeavy`, a standardowe
zabójstwo dodaje dźwięk rozbicia. Czerwony obrys nad głową pulsuje do
ciepłej bieli z częstotliwością 3 Hz; nie zmienia materiału całego wroga.
HUD pokazuje `[LPM] Wykończ` pod celownikiem tylko z ostrzem w ręku,
z dostępnym celem w zasięgu/stożku, poza lotem ostrza.

W pokoju i arenie: ostrze rozstrzyga akcję, następnie w bloku `dt > 0`
po `statuses.step(dt)` następuje `execute.step(dt)` (czas świata).
Render odczytuje gotowość bez referencji do Three.js w symulacji.
`readyIds()` udostępnia stałą tablicę tylko do odczytu, aktualizowaną w miejscu;
nie należy traktować jej jako snapshotu. System ponownie wykorzystuje zbiór
roboczy zamiast `filter/map` i nowego `Set` w każdym kroku. Arena i pokój
przechowują pulę obiektów `ExecuteEnemy` z mutowanymi pozycjami oraz jedną
tablicę wejścia czyszczoną przez `length = 0`. Podpowiedź HUD korzysta z celu
zapisanego na końcu ostatniego kroku; render nie odbudowuje listy wrogów.
Reset areny odtwarza system i usuwa stare okno nietykalności.

Zdarzenia:

- `enemy_executable { id, ready }` tylko przy zmianie stanu (także wyjście
  ze zbioru po śmierci/usunięciu lub przy dispose).
- `execute_performed { attacker, target, point }` po udanym wykończeniu;
  dla synergii zdarzenie bez celu, analogicznie do `parry_success`.
- `hitstop`, `slowmo`, `camera_shake` przez istniejący EventBus.

Wszystkie liczby w grupie `tuning.melee`, automatycznie widoczne w lil-gui:
`executeHpFrac 0.25`, `executeHpFracElite 0.15`, `executeRangeM 2.8`,
`executeArcDeg 50`, `executeKnockback 10`, `executeEnergy 20`,
`executeHeal 6`, `executeHitstopMs 110`, `executeSlowmoScale 0.35`,
`executeSlowmoS 0.3`, `executeShake 0.6`, `executeInvulnS 0.4`,
`executeMarkerPulseHz 3`.

Debug: `weaken <procent>` ustawia HP wszystkich żywych wrogów (0 < procent
≤ 100); `execute ready` wypisuje gotowe ID; query `executable` zwraca ID.
Test w 30 sekund: `?scene=room-test&room=combatYard&loadout=blade&seed=exec-e2e&debug=1`,
poczekaj na falę, `weaken 10`, podejdź do znacznika i kliknij LPM.
Oceń czytelność obrysu i podpowiedzi oraz siłę zatrzymania/spowolnienia.
Alternatywnie `status stunned 3` testuje przejście moc → ostrze.
Testy: `execute.test.ts`, dopisane przypadki w `damage.test.ts`,
`plasmaBlade.test.ts`, `synergies.test.ts` oraz `execute.spec.ts`.

## Blok

- Wejście w blok (`blockAgeS = 0`, dalej rośnie co krok symulacji) dodaje graczowi `StatModifier { stat: 'damageTaken', type: 'mult', value: blockDamageMult (0,3), source: 'block' }`; wyjście go zdejmuje. Redukcję liczy `DamageSystem` — ostrze nie modyfikuje obrażeń samo. Blok kończy się, gdy PPM puszczone, bufor ataku > 0, rozbita garda, rzut, dash-cięcie lub `reset`.
- Każde `damage_dealt` na właścicielu w stanie bloku, w którym blok faktycznie coś zatrzymał (`blocked > 0`: ciosy i pociski; nie `#heavy`, tiki `#status` ani zagrożenia `#hazard`), zużywa energię: `blockEnergyPerHit (6) + (amount + blocked) × blockEnergyPerDamage (0,4)` (dane ostrza) i emituje `melee_blocked { defender, attacker, amount = blocked }`. `blocked` liczy `DamageSystem` (różnica `damageTaken` z blokiem i bez), więc inne modyfikatory nie przekłamują kosztu.
- **Rozbicie gardy:** gdy energii brakuje (`spend` zawodzi) — energia spada do 0 (`set(0)`), blok wyłącza się, `guardBrokenS = guardBreakLockS` (0,8 s, maleje w czasie symulacji także w locie i dash-cięciu), `camera_shake { intensity: guardBreakShake (0,5), durationS: guardBreakShakeS (0,3), dir null }`. Obrażenie, które rozbiło gardę, jest już zredukowane.
- Ciosy z tagiem `#heavy` przechodzą przez blok w całości i nie zużywają energii (`DamageSystem` pomija modyfikatory o źródle `block`).
- `view().blockAgeS` — czas trwania bloku, pod okno parowania (#10).

## Zdarzenia

`melee_swing { attacker, stage }` (na początku zamachu; dash-cięcie emituje `stage: 1`, wykończenie nie emituje wcale), `hitstop { ms }`, `melee_blocked`, oraz `damage_dealt` z `point`, `dir` (kierunek patrzenia) i `knockback` z danych etapu (plazmowe: etapy 1–2 = 0, etap 3 = 7, ciężki 10; bliźniacze: etap 4 = 5, ciężki 8; dwustronne: etap 3 = 7, ciężki 10).

## Strojenie (`tuning.melee`)

`lightWindupS 0.05`, `lightActiveS 0.1`, `lightRecoveryS 0.16`, `comboWindowS 0.3`, `attackBufferMs 120`, `heavyHoldS 0.22`, `heavyChargeS 0.6`, `heavyWindupS 0.04`, `heavyActiveS 0.12`, `heavyRecoveryS 0.38`, `guardBreakLockS 0.8`, `guardBreakShake 0.5`, `guardBreakShakeS 0.3`, `attackSpeedMin 0.5`, `attackSpeedMax 2`.

Rzut i dash-cięcie: `dashCutGraceS 0.1`, `dashCutHeightM 1.2`, `throwSpinRadS 28`, `throwLengthM 1.1`, `throwThicknessM 0.04` (trzy ostatnie tylko render).

Parowanie: `parryWindowMs 150`, `parryArcDeg 160`, `parryHitstopMs 60`, `parryShake 0.3`, `parryShakeS 0.2`, `meleeParryWindowMs 200`, `meleeParryStunS 0.9`, `meleeParryKnockback 4`, `meleeParrySparkM 0.8`, `meleeParrySparkOffsetYM -0.35`, `parrySpeedMult 1.8`, `parryDamageMult 2`. Wykończenia: patrz wyżej.

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
  bez mnożnika głowy, odrzut 0. Zasięg lotu liczy się z sumy faktycznego
  przesunięcia (`rangeM`); powrót kończy się, gdy ostrze dotrze do oczu
  (`blade_returned`). Rzut startuje tylko ze stanu `idle`, `blocking` albo
  `recovery` lekkiego ciosu (kończy blok/cios, zeruje combo i bufory) i od razu
  wykonuje pierwszy krok lotu. W locie `step` ignoruje całe wejście (bufory nie
  są ustawiane). Dane rzutu / dash-cięcia wariantów: bliźniacze 23 / 33
  (odrzut dash-cięcia 5), dwustronne 38 / 55 (odrzut 7). Zdarzenia: `blade_thrown`, `blade_returned` z `owner`.
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
- **Warunki:** stan `blocking`, pocisk innej drużyny niż gracz, blok trwa nie dłużej niż `parryWindowMs` (150 ms; `blockAgeS × 1000 > okno` odrzuca) — czyli blok trzeba **wcisnąć** tuż przed trafieniem, trzymanie bloku daje tylko redukcję −70%; pocisk nadlatuje z przodu: kąt (w 3D) między −kierunkiem lotu a patrzeniem ≤ `parryArcDeg`/2, gdzie `parryArcDeg` bierze się z ostrza (`def.parryArcDeg`, np. 240 dla dwustronnego), a gdy brak — z `tuning.melee`.
- **Efekt:** `ProjectileSystem.reflect` — pocisk zmienia właściciela i drużynę na gracza, leci w strzelca (`positionOf`, w razie braku — z powrotem po torze), szybciej ×`parrySpeedMult` (1,8) i mocniej ×`parryDamageMult` (2). Cel odbicia to pozycja strzelca + 1,2 m w górę. Emisja `parry_success { defender, projectile, attacker }` (energia +`powers.parryEnergy` = 10 przez `PlayerEnergy`), hitstop `parryHitstopMs` (60 ms), wstrząs `parryShake` (0,3) przez `parryShakeS` (0,2 s), bez kierunku.
- Scena `?scene=parry-test`: wariant piaskownicy, w którym środkowy manekin co 1,6 s strzela wolnym pociskiem (9 m/s, 12 obrażeń) w gracza. Ćwiczenie: wciśnij PPM w ostatniej chwili.
- Testy: `tests/unit/parry.test.ts` (prawdziwy Rapier: odbicie w oknie trafia strzelca ×2, blok poza oknem −70% bez odbicia, brak bloku = obrażenia, pocisk z tyłu nieparowany), `tests/e2e/parryTest.spec.ts`.

## Parowanie ciosów wręcz

- **Warunki:** blok trwa nie dłużej niż `meleeParryWindowMs` (200 ms), cios ma tag `#melee` i nie ma `#heavy` (cios nie do zablokowania, bursztynowa zapowiedź, przebija także zwykły blok), atakujący jest w łuku `parryArcDeg`/2 przed graczem (kąt liczony **poziomo**, w płaszczyźnie XZ, względem patrzenia; `parryArcDeg` z ostrza jak przy pociskach), stan to `blocking`, a źródło ciosu nie jest `null`. Obrona działa jako dodatkowy guard (`DamageSystem.addGuard`), wykonywany także gdy główny `guard` celu już zwrócił 0.
- **Efekt:** obrażenia zanegowane (guard `0` dopisany przez `DamageSystem.addGuard`), zdarzenia `melee_parried { defender, attacker, point }` i `parry_success { projectile: null, attacker }`, hitstop `parryHitstopMs`, wstrząs `parryShake` przez `parryShakeS`, iskra cyan (`vfx.parrySparkCount` cząstek, `meleeParrySparkM` przed oczami w stronę atakującego, `meleeParrySparkOffsetYM` w pionie). Przez `parry_success` parowanie wręcz daje energię +`powers.parryEnergy`, dźwięk `parry` i liczy się w implantach, synergiach, naszywkach i samouczku tak samo jak odbicie pocisku. Atakujący (Szturmowiec) dostaje stan `stunned` na `meleeParryStunS` (0,9 s) i odrzut `meleeParryKnockback` (4); jego cios jest przerwany.
- Brak pozycji atakującego (`positionOf` zwraca `null`) wyklucza parowanie — łuku nie da się sprawdzić.
- Blok poza oknem działa jak dotąd (−70%, koszt energii).
- Testy: `tests/unit/meleeParry.test.ts`, `tests/unit/enemies.test.ts` (ogłuszenie, prawdziwy cios sparowany w trakcie `strike`), `tests/e2e/meleeParry.spec.ts` (prawdziwy pokój: Szturmowiec, blok co chwilę, licznik `meleeParries`).
- Sprawdzenie w 30 s: `?scene=room-test&loadout=blade&debug=1`, w konsoli `god`, `kill all`, `spawn assaulter 1`; wciśnij PPM tuż przed ciosem. Zapytanie `meleeParries` w `roomScene` liczy sparowane ciosy gracza.

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
