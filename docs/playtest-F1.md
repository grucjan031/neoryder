# Playtest F1 — bramka „chcę zagrać jeszcze raz”

Cel bramki (roadmapa, F1): grasz 15–30 minut na arenie i **chcesz kolejną rundę**. Jeśli nie — tydzień strojenia `tuning.ts` bez nowych funkcji. Ten dokument mówi, co ocenić i które pokrętła za to odpowiadają.

## Start

```bash
npm run dev        # http://localhost:5173 → „Arena — fale wrogów”
```

Kliknij w scenę (przechwycenie myszy). Panel **strojenia** jest po prawej (w `npm run dev` zawsze) — zmiany działają na żywo, bez restartu. Konsola debug: klawisz `` ` ``, `help`.

| Klawisz                  | Akcja                                                                             |
| ------------------------ | --------------------------------------------------------------------------------- |
| WASD, Shift, Spacja (×2) | ruch, sprint, skok i podwójny skok                                                |
| Q                        | dash (też w powietrzu)                                                            |
| Ctrl w sprincie          | ślizg (skok w ślizgu zachowuje pęd)                                               |
| LPM / przytrzymanie      | cios combo 1-2-3 / ciężki atak (przebija blok)                                    |
| PPM                      | blok; **wciśnięty tuż przed trafieniem pocisku = parowanie** (odbicie w strzelca) |
| F                        | Pchnięcie Rezonansu (wrogowie w ścianę = dodatkowe obrażenia)                     |
| R (przytrzymaj)          | blaster, przegrzewa się                                                           |

Przydatne komendy: `god` (nieśmiertelność), `wave 6` (skok do fali), `spawn gunner 3`, `kill all`, `timescale 0.3` (oglądanie w zwolnieniu).

## Co ocenić (zapisz 1–5 i jedno zdanie)

1. **Ruch** — czy bieg/skok/dash są responsywne? Czy dash nie jest za długi? Ślizg satysfakcjonujący?
2. **Trafienie ostrzem** — czy cios „klei się” do wroga (hitstop, wstrząs, dźwięk, odłamki)? Czy combo płynie?
3. **Ciężki atak** — czy ładowanie 0,6 s jest uczciwe? Czy szybkie cięcie przed ładowaniem przeszkadza?
4. **Blok i parowanie** — czy okno 150 ms jest osiągalne? Czy odbity pocisk daje frajdę?
5. **Pchnięcie** — czy wbijanie w ściany jest czytelne i warte energii?
6. **Blaster** — czy przegrzanie wymusza decyzje, czy tylko irytuje?
7. **Wrogowie** — czy telegraf Szturmowca (0,4 s) i celowanie Strzelca (0,5 s) dają czas na reakcję? Czy pociski są dość wolne i widoczne?
8. **Czytelność** — biały świat / czerwoni wrogowie: czy w chaosie fali 8+ widać, kto atakuje?
9. **Tempo fal** — czy 12 fal rośnie płynnie? Na której fali giniesz?
10. **„Jeszcze raz”** — po śmierci: czy od razu klikasz „Jeszcze raz”?

## Pokrętła (panel strojenia → grupa)

| Odczucie                      | Grupa / pola                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Trafienia za słabe / za mocne | `time.hitstopLightMs`, `hitstopHeavyMs`; `camera.shakeMax`, `shakeDamageRef`; `vfx.debrisMin/Max`, `debrisStrength` |
| Ostrze za wolne / za szybkie  | `melee.lightWindupS`, `lightActiveS`, `lightRecoveryS`, `comboWindowS`                                              |
| Ciężki atak                   | `melee.heavyHoldS`, `heavyChargeS`                                                                                  |
| Parowanie za trudne           | `melee.parryWindowMs`, `parryArcDeg`                                                                                |
| Blok drenuje energię          | dane `src/data/blades/plasmaBlade.json` (`blockEnergyPerHit`, `blockEnergyPerDamage`)                              |
| Ruch                          | `player.walkSpeed`, `sprintSpeed`, `groundAccel`, `jumpVelocity`, `coyoteTimeMs`                                    |
| Dash / ślizg                  | `player.dashDistance`, `dashDurationS`, `dashCooldownS`; `slideBoost`, `slideFriction`, `slideMaxS`                 |
| Kamera                        | `camera.fov`, `sprintFovKick`, `bobEnabled`, `bobAmount`                                                            |
| Energia                       | `powers.energyRegenDelayS`, `meleeKillEnergy`, `parryEnergy` (+ stat `energyRegen` w scenie)                        |
| Przegrzanie                   | `weapons.overheatLockS`, `coolDelayS` (+ dane `blaster.json`)                                                       |
| Wrogowie                      | dane `src/data/enemies/assaulter.json`, `gunner.json` (telegraf, obrażenia, prędkość pocisków)                      |
| Fale                          | `src/data/waves/arena.json` (skład, interwał, `maxAlive`, przerwy)                                                  |
| Dźwięk                        | `audio.masterGain`; przepisy w `src/data/audio/sfx.json`; odsłuch `?scene=sfx-test`                                 |

Gdy znajdziesz dobre wartości w panelu, przepisz je do `src/core/tuning.ts` (panel nie zapisuje zmian) albo podyktuj je agentowi.

## Wydajność

Na fali 12 albo po `spawn assaulter 20` sprawdź licznik FPS (lewy górny róg). Cel z roadmapy: 60 FPS. Jeśli spada — zanotuj liczbę wrogów i czy włączony był obrys (`render.outline = 0` wyłącza; to 3 przebiegi renderu).

## Wynik bramki

- [ ] Grałem/am ≥ 15 min, chcę jeszcze raz → **F2 (Arsenał)**
- [ ] Nie chcę jeszcze raz → lista 3 największych problemów „feel” → tydzień strojenia
