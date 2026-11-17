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
| `explosion`                           | każde zdarzenie     | `explosion` (niski grzmot, Z21)                 |
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

Z21: przepis `explosion` ma szum przez lowpass 1400 → 90 Hz (Q 0,7)
i sinus 55 → 40 Hz, obie warstwy po 0,6 s, attack 5 ms. Głośność przepisu
0,9, gain warstw 0,9 / 1, pitch 0,96–1,04. Reguła bez warunku gra dla
każdego zdarzenia `explosion`, niezależnie od wyboru koloru VFX.
`SFX_EVENTS` obejmuje teraz to zdarzenie. Dźwięk jest nieprzestrzenny:
obecny adapter faktów audio nie przekazuje punktu `explosion`.
Dotychczasowy `kill` z `damage_dealt.killed` nadal może towarzyszyć zniszczeniu
beczki; nie zmieniono rozpoznawania neutralnych celów. Przepis i rzeczywistą
obsługę zdarzenia na atrapie Web Audio sprawdza `audio.test.ts`.

`main.ts` tworzy jeden `AudioSystem` przed `scene.init` (żeby usłyszał spawn gracza), słuchacz = kamera, `GameContext.audio`. Debug: `window.__neoryder.query('audioState' | 'lastSound')`, w `sfx-test` komenda `sfx <nazwa>` i przyciski lil-gui.

## Testy

`tests/unit/audio.test.ts` (atrapa AudioContext: wybór dźwięku dla zdarzeń, warunki i zbocze przegrzania, cooldown, limit głosów, wygasanie, pitch w zakresie, panorama, odblokowanie, brak Web Audio), `tests/e2e/sfxTest.spec.ts` (kontekst `running` po kliknięciu), `tests/e2e/arena.spec.ts` (zabicie gra `kill`).

## Otoczenie

`AudioSystem.setAmbience(sources | null)` zarządza zapętlonymi grafami na wspólnym
kontekście. `ambience.ts` wybiera najbliższe źródła (maksymalnie
`audio.ambienceMaxActive`, startowo 8). Tłumienie smoothstep uwzględnia trzy osie,
osiąga dokładne zero na `radiusM`; panorama używa tej samej osi kamery co SFX.
Źródła poza zasięgiem, niewybrane, podczas pauzy albo zawieszenia kontekstu są
zatrzymywane i odłączane, a nie tylko ściszane. Powrót odtwarza graf z buforów.
Szyna ambience ma gain `audio.ambienceGain`, następnie przechodzi przez istniejący
master: `audio.masterGain × Settings.masterVolume × Settings.sfxVolume`.
Odblokowanie nadal odbywa się wyłącznie w `AudioSystem.attachUnlock`.

`ambienceSynth.ts` syntezuje ogień (szum i krótkie trzaski), generator (piła przez
lowpass), krople (losowo rozstawione pingi), parę i skwierczenie (highpass), ekrany
(110 Hz z harmonicznymi), gwar (trzy pasma bandpass), radio (szum i przerywane
tony) oraz szafę grającą (oryginalna fraza basu i minorowych padów: 90 BPM,
osiem taktów, bez melodii). Wszystkie grafy mają wolną modulację amplitudy;
bufory impulsów i frazy powstają raz dla danego rodzaju i są współdzielone.
Kosmetyczny `Rng` zapewnia powtarzalność bez zużywania losowości symulacji.
Parametry syntezy, domyślne zasięgi i gainy są w `audio.ambience*`, dostępne w GUI.

`hubAmbienceSources` wyciąga źródła z `fires`, modeli generatora w blokach,
kapania/pary `ambientFx` i skupisk ekranów (promień 4 m od pierwszego ekranu).
Łączy je z `src/data/hub/ambience.json`, walidowanym przez zod: rodzaj, skończona
pozycja, dodatni promień, opcjonalny nieujemny gain; nieznane pola są błędem.
Plik dodaje gwar hali, jukebox przy barze i radio przy Bajcie.

Pociąg ma oddzielny graf na szynie ambience: szum lowpass i sinus 38 Hz,
obwiednia narastająca i opadająca w czasie symulacji oraz panorama zachód →
wschód zależna od obrotu słuchacza. `setAmbience(null)` i `dispose` zwalniają
wszystkie grafy, także pociąg. `query('hubAmbience')` pokazuje aktywne
`{ kind, gain }` przed mnożnikami szyn, a `hub train` wymusza przejazd.

Weryfikacja: `tests/unit/ambience.test.ts` (ekstrakcja, schemat, przestrzeń,
limit, pauza, brak Web Audio, sprzątanie każdego rodzaju i pociągu, harmonogram,
komenda i pula pyłu), `tests/e2e/hub.spec.ts` (odblokowanie, źródła, przejazd bez
błędów Web Audio). Ręcznie: `?scene=hub&debug=1`, kliknij grę, przejdź od beczki
przez generatory i ekrany do baru/Bajta; obróć kamerę, zmień głośność efektów,
sprawdź ciszę po Esc i wznowienie, następnie wykonaj `hub train`.

### Fauna kryjówki

Rodzaj ambience `purr` (pulsujący niski szum, `ambiencePurrPulseHz`/`ambiencePurrDepth`, zasięg ok. 3 m) jest
ruchomym źródłem: `AudioSystem.updateAmbienceSource(index, position, gain)` przesuwa je bez restartu grafów, a
`HubSoundscape` dodaje je na końcu listy źródeł; gain > 0 tylko gdy kot odpoczywa. Zdarzenie `hub_fauna_sound
{ kind: 'meow' | 'rat'; point }` mapują reguły sfx z warunkiem `faunaKind` na przepisy `hub_meow` (rzadkie miau) i
`hub_rat` (cichy pisk/tupanie), odtwarzane przestrzennie w `point`.

## Warstwy pogody

Profile pogody mogą włączyć `rain` (szum filtrowany górnoprzepustowo) i `wind`
(szum dolnoprzepustowy) w istniejącym `AmbienceSynth`. Parametry filtrów są
w `tuning.audio.ambienceProfiles`, poziomy w danych pogody. `CityDressing`
przekazuje źródła przez `AudioSystem.setAmbience` i przesuwa je do kamery przez
`updateAmbienceSource`; istniejące odblokowanie gestem, pauza i głośność pozostają
wspólne. Profile bez pola weather nie tworzą audio pogody. Szczegóły cyklu życia
i odsłuchu: [weather.md](weather.md).

## Muzyka

Syntezowana w locie (Web Audio, bez plików i cudzych próbek), trzy pętle w `src/data/audio/music.json`
(walidacja zod: `src/audio/musicSchema.ts`): **calm** (kryjówka, mapa, poza walką; 74 BPM, pad + puls basu +
delikatne arpeggio, bez perkusji), **combat** (126 BPM, bas ósemkowy, kick/snare/hat z szumu, stabsy) i
**boss** (140 BPM, 16-kowy bas, klastry z półtonami i trytonem, „alarm”). Każda pętla ma 16 taktów.

- **Dane.** Pętla = `bpm`, `beatsPerBar`, `stepsPerBeat`, `bars` (8–16) i ścieżki. Ścieżka `tone` ma barwę
  (`wave`, `detuneCents`, `attackS`, `releaseS`, `filter` z przemiataniem, `pan`), ścieżki `kick`/`snare`/`hat` są
  perkusją. `pattern` to tablica napisów, po jednym na takt, używana cyklicznie (jej długość musi dzielić `bars`);
  każdy takt ma dokładnie `beatsPerBar × stepsPerBeat` tokenów. Token tonowy: `.` pauza, `A1`, akord `A3+C4+E4`,
  długość w krokach `*4`, głośność `@0.6` (np. `A3+C4*16@0.8`); perkusja: `.`, `x` (mocne), `o` (ciche).
- **`MusicSystem`** (`music.ts`): `setState('calm'|'combat'|'boss'|'off')`, `update()`, `dispose()`. Harmonogram z
  wyprzedzeniem (1,5 s) na `AudioContext.currentTime`: tyknięcie co 250 ms planuje kroki aż do horyzontu,
  więc opóźnienie timera i zawieszony kontekst (przed pierwszym gestem) nie rozjeżdżają rytmu ani nie
  kumulują nut. Zmiana stanu to crossfade `fadeS` (1,8 s) między szynami pętli; nowa pętla startuje od taktu 1.
- **Kontekst i głośność.** Ten sam `AudioContext` co SFX (`AudioSystem.getContext()`), odblokowywany tylko w
  `attachUnlock`. Własna szyna idzie wprost do `destination`: `masterGain × masterVolume × musicVolume ×
musicGain` (`tuning.audio.musicGain` = 0,35; bez `sfxVolume`). `Settings.musicVolume` (domyślnie 0,7)
  ma suwak w ustawieniach obok głośności głównej; wartość jest czytana na każdym tyknięciu.
- **`MusicDirector`** (`musicDirector.ts`, czysta logika): `scene_loaded` zeruje stan; `wave_started` →
  combat do `wave_cleared` + 4 s; obrażenia z udziałem gracza i `enemy_killed` przedłużają walkę o 4 s
  (histereza); `boss_spawned` → boss (priorytet) do `entity_despawned`/`enemy_killed` bossa, potem walka
  jeszcze 4 s; `player_died` i `run_ended` → calm do następnej sceny lub nowego gracza. Sceny nie muszą
  nic przekazywać.
- **Podpięcie** w `main.ts` (obok `AudioSystem`). Wyłączona przy `?fx=lite` i pod automatem
  (`navigator.webdriver`: Playwright), więc e2e nie płacą za syntezę. W menu głównym (bez sceny) muzyki nie ma.
- **Debug.** Komenda `music <calm|combat|boss|off|auto>` (konsola `` ` ``; `auto` wraca do dyrektora),
  `window.__neoryder.query('music')` → `{ state, playing }`. Odsłuch bez gry:
  `node tools/audio/renderMusic.mjs [katalog] [calm|combat|boss]` renderuje pętle do WAV uproszczoną syntezą
  offline i wypisuje szczyt/RMS (przybliżenie brzmienia, nie kopia Web Audio).
- **Testy:** `tests/unit/music.test.ts` (schemat, dyrektor, harmonogram na atrapie kontekstu, crossfade,
  `dispose`, głośność, `musicVolume`).
