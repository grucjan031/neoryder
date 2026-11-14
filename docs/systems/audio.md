# Dźwięki (F1 #14)

Właściciel: Grafika, VFX i audio. Kod: `src/audio/` (`audioSystem.ts`, `synth.ts`, `sfxSchema.ts`), dane: `src/data/audio/sfx.json`, scena: `?scene=sfx-test`.

## Zasady

- **Synteza w locie, bez plików.** Każdy dźwięk to przepis: warstwy oscylatorów (`sine`, `square`, `sawtooth`, `triangle`) lub szumu, z przemiataniem częstotliwości (`freq` → `freqEnd`), obwiednią (`attackS`, wykładnicze wygaszenie w `durationS`), opóźnieniem (`delayS`) i filtrem (`lowpass`/`highpass`/`bandpass`, też z przemiataniem). Placeholdery do czasu prawdziwych próbek (F7) — styl „czysty, cyfrowy” pasuje do estetyki gry.
- **Wariacje:** losowy wariant i wysokość z zakresu `pitch` z kosmetycznego `Rng('audio')` (nie wpływa na symulację). `cooldownS` tłumi spam (np. świst ostrza).
- **Reguły zdarzenie → dźwięk** w danych, sprawdzane po kolei — gra pierwsza pasująca. Warunki: `tagsAny`, `tagsNone`, `killed`, `targetIsPlayer`, `sourceIsPlayer`, `actorIsPlayer`, `team`, `minSpeed`, `overheatRising`. Schemat zod odrzuca nieznane zdarzenia, nieznane warunki i reguły wskazujące nieistniejący dźwięk.
- **Gracz** rozpoznawany po `entity_spawned` z `kind: 'player'` — sceny nie muszą nic przekazywać.
- **Limit głosów** `tuning.audio.maxVoices` (24): przy przekroczeniu najstarszy głos jest wyciszany i zatrzymywany.
- **Przestrzeń:** dźwięki z `spatial: true` i punktem zdarzenia (`damage_dealt.point`) dostają panoramę (`StereoPannerNode`, do `maxPan`) względem prawej osi kamery i tłumienie `min(1, refDistance / odległość)`.
- **Głośność:** `tuning.audio.masterGain × Settings.masterVolume`.
- **Odblokowanie** (polityka autoodtwarzania): `AudioSystem.attachUnlock(window)` wznawia kontekst przy pierwszym `pointerdown` / `keydown` / `touchstart`. Tylko tutaj — inne moduły nie dotykają `AudioContext`.

## Mapa (stan F1)

| Zdarzenie                             | Warunek             | Dźwięk                                          |
| ------------------------------------- | ------------------- | ----------------------------------------------- |
| `damage_dealt`                        | cel = gracz         | `playerHurt`                                    |
|                                       | `killed`            | `kill` (tłuczone szkło + krystaliczne „pingi”)  |
|                                       | `#wall`             | `wallSlam`                                      |
|                                       | `#heavy`            | `hitHeavy`                                      |
|                                       | `#melee` / `#power` | `hitLight`                                      |
|                                       | `#gun`              | `hitGun`                                        |
| `melee_swing` (gracz)                 |                     | `swing`                                         |
| `melee_blocked`                       |                     | `block`                                         |
| `parry_success`                       |                     | `parry`                                         |
| `weapon_fired` (gracz)                |                     | `blasterShot`                                   |
| `projectile_spawned`                  | drużyna `enemy`     | `enemyShot`                                     |
| `heat_changed`                        | zbocze przegrzania  | `overheat`                                      |
| `power_used` / `power_denied` (gracz) |                     | `push` / `denied`                               |
| `player_landed`                       | prędkość ≥ 7 m/s    | `land`                                          |
| `dash_used` (gracz)                   |                     | `dash`                                          |
| `enemy_telegraph`                     |                     | `telegraph` (ostrzeżenie przed ciosem/strzałem) |
| `wave_started` / `wave_cleared`       |                     | `waveStart` / `waveCleared`                     |

## Integracja

`main.ts` tworzy jeden `AudioSystem` przed `scene.init` (żeby usłyszał spawn gracza), słuchacz = kamera, `GameContext.audio`. Debug: `window.__neoryder.query('audioState' | 'lastSound')`, w `sfx-test` komenda `sfx <nazwa>` i przyciski lil-gui.

## Testy

`tests/unit/audio.test.ts` (atrapa AudioContext: wybór dźwięku dla zdarzeń, warunki i zbocze przegrzania, cooldown, limit głosów, wygasanie, pitch w zakresie, panorama, odblokowanie, brak Web Audio), `tests/e2e/sfxTest.spec.ts` (kontekst `running` po kliknięciu), `tests/e2e/arena.spec.ts` (zabicie gra `kill`).
