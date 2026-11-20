# Dźwięki (F1 #14)

Właściciel: Grafika, VFX i audio. Kod: `src/audio/` (`audioSystem.ts`, `synth.ts`, `sfxSchema.ts`,
`ambience.ts`, `ambienceSynth.ts`, `ambienceSchema.ts`, `music.ts`, `musicDirector.ts`, `musicSchema.ts`),
dane: `src/data/audio/sfx.json`, `src/data/audio/music.json`, `src/data/hub/ambience.json`, liczby w
`tuning.audio` (`src/core/tuning.ts`), scena: `?scene=sfx-test`.

Wszystkie dźwięki, ambient i muzyka są syntezowane w locie, bez plików audio. Dokument opisuje zachowanie
na tyle dokładnie, by odtworzyć je w innym silniku (przepisy, reguły i wartości są w plikach danych, które
przechodzą 1:1).

## Zasady

- **Synteza w locie, bez plików.** Każdy dźwięk (SFX) to przepis: lista wariantów, a wariant to lista warstw. Warstwa
  to oscylator (`sine`, `square`, `sawtooth`, `triangle`) albo szum (`noise`), z przemiataniem
  częstotliwości (`freq` → `freqEnd`, wykładnicze), obwiednią (`attackS`, `durationS`, `gain`), opóźnieniem
  startu (`delayS`) i opcjonalnym filtrem (`lowpass`/`highpass`/`bandpass`, `freq`, opcjonalnie `freqEnd`
  i `q`). Placeholdery do czasu prawdziwych próbek (F7) — styl „czysty, cyfrowy”.
- **Parametry warstwy** (`synth.ts`, `playLayers`): start = chwila odtworzenia + `delayS`; koniec = start +
  `durationS` (max 3 s). Obwiednia: gain startuje od 0,0001, rośnie liniowo do `gain` przez
  `attackS` (domyślnie 0,003 s, nie więcej niż połowa `durationS`), potem wykładniczo spada do 0,0001 w
  chwili końca (`gain` mniejszy niż 0,0001 jest podnoszony do 0,0001). Źródło jest zatrzymywane 20 ms
  po końcu. Filtr (jeśli jest) stoi przed obwiednią (źródło → filtr → obwiednia → wyjście głosu); `q`
  ustawiane tylko gdy podane. Przemiatanie częstotliwości oscylatora i filtra jest wykładnicze, do
  wartości docelowej w chwili końca warstwy. Domyślna częstotliwość oscylatora bez `freq`: 440 Hz.
- **Szum:** jeden współdzielony bufor białego szumu (mono, 1 s, próbki z kosmetycznego `Rng`), odtwarzany w
  pętli od początku bufora; `pitch` zmienia jego prędkość odtwarzania.
- **Pitch** (`pitch: [min, max]`): mnożnik wylosowany z `[min, max)` (gdy min = max — stały). Mnoży
  częstotliwości oscylatorów, `freqEnd`, częstotliwości filtrów i prędkość szumu. Warianty i pitch losuje
  kosmetyczny `Rng('audio')` (nie wpływa na symulację); wariant wybierany równomiernie.
- **`cooldownS`** tłumi spam: dźwięk o tej nazwie nie zagra, jeśli od ostatniego odtworzenia minęło mniej
  niż `cooldownS` (czas zegara kontekstu audio; zagrany dźwięk blokowany cooldownem nie wchodzi do
  `recentSounds`). Cooldowny są zerowane razem ze stanem alertów (zob. niżej).
- **Reguły zdarzenie → dźwięk** są w danych (`rules`) i sprawdzane po kolei w kolejności z pliku —
  dla danego zdarzenia gra pierwsza pasująca reguła, reszta jest pomijana. Reguła bez `when` pasuje
  zawsze. Warunki `when` (wszystkie podane muszą być spełnione, schemat `strict`): `kind`
  (`hub_prop_used`: `jukebox|noodles|radio|bag`), `faunaKind` (`meow|rat`), `tagsAny` (co najmniej jeden
  tag), `tagsNone` (żaden tag), `killed`, `targetIsPlayer`, `sourceIsPlayer`, `actorIsPlayer`, `team`
  (`player|enemy|neutral`), `minSpeed` (>=), `overheatRising`, `heatWarningRising`, `lowHealthRising`,
  `telegraphKind` (dokładna równość z `enemy_telegraph.kind`), `positiveDelta`. Schemat zod odrzuca
  nieznane zdarzenia, nieznane warunki i reguły wskazujące nieistniejący dźwięk (oraz `pitch` z min > max).
- **Zdarzenia obsługiwane** (`SFX_EVENTS`): `hub_prop_used`, `hub_fauna_sound`, `execute_performed`,
  `explosion`, `damage_dealt`, `melee_swing`, `melee_blocked`, `parry_success`, `melee_parried`,
  `weapon_fired`, `projectile_spawned`, `heat_changed`, `health_changed`, `currency_changed`,
  `implant_acquired`, `meta_rewards`, `power_used`, `power_denied`, `player_landed`, `dash_used`,
  `enemy_telegraph`, `wave_started`, `wave_cleared`. `melee_parried` jest nasłuchiwane, ale nie ma dla niego
  żadnej reguły (cisza).
- **Skąd bierze się „aktor”** (`actorIsPlayer`): `melee_swing.attacker`, `weapon_fired.owner`,
  `projectile_spawned.owner`, `power_used.user`, `power_denied.user`, `dash_used.user`,
  `player_landed.id`, `health_changed.id`, `heat_changed.id`. `targetIsPlayer`/`sourceIsPlayer` biorą
  `damage_dealt.target`/`source`. Gdy gracz nie jest jeszcze znany, każdy z tych warunków z wartością `true`
  jest niespełniony.
- **Gracz** rozpoznawany po `entity_spawned` z `kind: 'player'` (zapamiętane ID); `entity_despawned` tego
  ID czyści je. Sceny nie muszą nic przekazywać.
- **Limit głosów** `tuning.audio.maxVoices` (24): przed każdym odtworzeniem wygasłe głosy (koniec + 50 ms)
  są usuwane; jeśli nadal jest >= limit, najstarszy głos jest wyciszany do 0 i zatrzymywany (powtarzane,
  aż zmieści się nowy).
- **Przestrzeń:** dźwięki z `spatial: true` odtworzone z punktem (`damage_dealt.point`,
  `hub_fauna_sound.point`) i przy znanym słuchaczu dostają panoramę (do `tuning.audio.maxPan` = 0,8) oraz
  tłumienie `min(1, refDistance / odległość)` (`tuning.audio.refDistance` = 4 m), mnożone przez `volume`.
  Odległość liczona **w poziomie** (XZ, bez osi Y). Panorama = rzut kierunku do źródła na prawą oś kamery
  (`prawo = (cos yaw, 0, −sin yaw)`, przód kamery `(−sin yaw, 0, −cos yaw)`), przycięty do [−1, 1],
  razy `maxPan`. Bez punktu, bez słuchacza lub bez `spatial` — pełna głośność, środek. Słuchacz = kamera
  (pozycja, `rotation.y`). Odległość < 1e−6 → panorama 0, tłumienie 1.
- **Łańcuch miksu SFX:** warstwa → gain głosu (`volume` × tłumienie) → [panner] → szyna `master` →
  wyjście. `master.gain = max(0, tuning.audio.masterGain × Settings.masterVolume × Settings.sfxVolume)`;
  `masterGain` = 0,7. Gain jest ustawiany przy każdym odtworzeniu, przy `updateAmbience` i przy zmianie
  ustawień (`AudioSystem.updateVolume()` wołane z ekranu ustawień).
- **Ustawienia głośności** (localStorage, `src/core/save.ts`): `masterVolume` (domyślnie 1),
  `sfxVolume` (1), `musicVolume` (0,7), każde 0–1, suwaki w ekranie ustawień. Szyna ambience przechodzi
  przez `master` (więc podlega `sfxVolume`); muzyka ma własną szynę (zob. „Muzyka”).
- **Kontekst audio i odblokowanie:** kontekst (`AudioContext`) tworzy `main.ts` leniwie (przy pierwszym
  użyciu przez SFX/muzykę/ambient); brak Web Audio → system działa „na sucho” (nic nie gra, `play`
  zwraca `false`). Odblokowanie: `main.ts` podpina na `window` `pointerdown`/`keydown`/`touchstart` i
  przy każdym woła `resume()` kontekstu (pomija, gdy gra jest zapauzowana); `resume()` gry też
  wymusza odblokowanie. **Pauza gry zawiesza (`suspend`) cały kontekst** (SFX, ambient i muzykę) i
  wznawia go po wznowieniu — sprawdzane co klatkę. Metoda `AudioSystem.attachUnlock(window)` istnieje
  (ten sam zestaw zdarzeń), ale aplikacja jej nie używa; scena `sfx-test` tylko o niej wspomina w komentarzu.
- **Debug:** `AudioSystem.state` (`none|suspended|running|closed`), `lastSound` i `recentSounds` (ostatnie 16)
  służą diagnostyce i testom.

## Reguły zdarzenie → dźwięk (stan obecny)

Kolejność w tabeli = kolejność sprawdzania w `sfx.json` dla danego zdarzenia.

| Zdarzenie                       | Warunek (`when`)                     | Dźwięk                      | Co gracz rozpoznaje                                          |
| ------------------------------- | ------------------------------------ | --------------------------- | ------------------------------------------------------------ |
| `enemy_telegraph`               | `telegraphKind: heavy`               | `telegraphHeavy`            | Cios przebijający blok — trzeba uskoczyć                     |
| `enemy_telegraph`               | `telegraphKind: aim`                 | `telegraphAim`              | Celowanie przed strzałem (strzelec, dron, wachlarz)          |
| `enemy_telegraph`               | inne rodzaje (też `summon`/`shield`) | `telegraph`                 | Nadchodzący cios wręcz (do zablokowania)                     |
| `health_changed`                | aktor = gracz, `lowHealthRising`     | `lowHealth`                 | Niskie zdrowie (<25%), jednorazowo                           |
| `currency_changed`              | `positiveDelta`                      | `pickup`                    | Przyrost waluty; wydatki i delta 0 są ciche                  |
| `implant_acquired`              | —                                    | `pickup`                    | Zdobycie lub ulepszenie implantu                             |
| `meta_rewards`                  | —                                    | `runReward`                 | Rozliczenie nagrody runu, także po śmierci                   |
| `explosion`                     | —                                    | `explosion`                 | Wybuch (niezależnie od koloru VFX); nieprzestrzenny          |
| `execute_performed`             | —                                    | `hitHeavy`                  | Wykończenie                                                  |
| `damage_dealt`                  | cel = gracz                          | `playerHurt`                | Otrzymanie obrażeń                                           |
| `damage_dealt`                  | `killed`                             | `kill`                      | Zabójstwo (ma pierwszeństwo przed typem trafienia)           |
| `damage_dealt`                  | tag `#wall`                          | `wallSlam`                  | Uderzenie w ścianę                                           |
| `damage_dealt`                  | tag `#heavy`                         | `hitHeavy`                  | Ciężkie trafienie                                            |
| `damage_dealt`                  | tag `#melee` lub `#power`            | `hitLight`                  | Trafienie wręcz / mocą                                       |
| `damage_dealt`                  | tag `#gun`                           | `hitGun`                    | Trafienie z broni                                            |
| `melee_swing`                   | aktor = gracz                        | `swing`                     | Zamach ostrzem                                               |
| `melee_blocked`                 | —                                    | `block`                     | Zwykły blok (niski dwuton)                                   |
| `parry_success`                 | —                                    | `parry`                     | Udane odbicie (jasne „dzyń”)                                 |
| `weapon_fired`                  | aktor = gracz                        | `blasterShot`               | Strzał gracza                                                |
| `projectile_spawned`            | `team: enemy`                        | `enemyShot`                 | Strzał wroga                                                 |
| `heat_changed`                  | `overheatRising`                     | `overheat`                  | Broń przegrzana (zbocze false → true)                        |
| `heat_changed`                  | aktor = gracz, `heatWarningRising`   | `heatWarning`               | Zbliżające się przegrzanie (>=75%)                           |
| `power_used`                    | aktor = gracz                        | `push`                      | Użycie mocy                                                  |
| `power_denied`                  | aktor = gracz                        | `denied`                    | Odmowa użycia mocy                                           |
| `player_landed`                 | `minSpeed: 7` (m/s)                  | `land`                      | Twarde lądowanie                                             |
| `dash_used`                     | aktor = gracz                        | `dash`                      | Unik                                                         |
| `wave_started` / `wave_cleared` | —                                    | `waveStart` / `waveCleared` | Początek / koniec fali (tonalne arpeggia)                    |
| `hub_prop_used`                 | `kind: bag`                          | `bagHit`                    | Uderzenie w worek (jukebox/noodles/radio: cisza)             |
| `hub_fauna_sound`               | `faunaKind: meow` / `rat`            | `hub_meow` / `hub_rat`      | Kryjówka: rzadkie miau / cichy pisk, przestrzennie w `point` |

Uwagi:

- `kill` nadal może towarzyszyć zniszczeniu beczki (`damage_dealt.killed` na neutralnym celu); rozpoznawanie
  neutralnych celów nie jest zmieniane.
- Nie ma osobnego faktu trafienia krytycznego ani osobnego rodzaju zapowiedzi snajpera — używane są
  zabójstwo i `aim`.
- `enemy_telegraph` nie niesie punktu, więc żaden telegraf nie jest przestrzenny (także `telegraphHeavy`,
  mimo `spatial: true` w danych — flaga nie ma wtedy efektu).
- `explosion` też nie jest przestrzenny (adapter faktów nie przekazuje jego `point`).

### Alerty progowe (`alerts` w `sfx.json`)

`alerts` jest opcjonalne; bez niego alerty `heatWarning`/`lowHealth` są wyłączone. Wartości obecne:
`heatThreshold` 0,75, `heatReset` 0,6, `healthThreshold` 0,25, `healthReset` 0,35 (schemat wymaga
histerezy: `heatReset < heatThreshold`, `healthReset > healthThreshold`).

- **Ciepło** (`heat_changed`, tylko aktualny gracz, `max > 0`): stan ostrzeżenia włącza się przy
  `current/max >= heatThreshold`, wyłącza przy `<= heatReset` (pomiędzy — bez zmian). Fakt `heatWarningRising`
  = stan przeszedł z wyłączonego na włączony **i** broń nie jest przegrzana; fakt `overheatRising` =
  `overheated` przeszło z false na true (stan `overheated` pamiętany per ID gracza). Reguła
  `overheat` jest pierwsza, więc skok bezpośrednio do przegrzania odtwarza tylko `overheat`.
- **Zdrowie** (`health_changed`, tylko aktualny gracz, `max > 0`): stan włącza się przy
  `current/max < healthThreshold` (ostro), wyłącza przy `>= healthReset`. `lowHealthRising` = stan przeszedł na
  włączony i `current > 0` (zero zdrowia nie wyzwala alarmu). Pierwsza obserwacja już w stanie alarmowym też
  daje sygnał.
- Alerty nie zapętlają dźwięków; `cooldownS` = 1 s w przepisach dodatkowo tłumi szybkie kolejne przekroczenia
  (przekroczenie podczas cooldownu nie jest kolejkowane).
- **Resety** (stan ciepła i zdrowia, mapa `overheated` oraz wszystkie cooldowny): `entity_spawned` gracza,
  despawn gracza, `run_started`, `scene_loaded` (nie zmienia zapamiętanego ID gracza — w aplikacji
  przychodzi po jego spawnie). `weapon_switched` właściciela-gracza zeruje ostrzeżenie ciepła i stan
  przegrzania tej broni przed migawką nowej.

## Przepisy SFX (`sfx.json`, 29 dźwięków)

Parametry odtwarzania (głośność przepisu `volume`, `pitch`, `spatial`, `cooldownS`) — pełne warstwy są w
pliku danych i przenoszą się 1:1:

| Dźwięk           | volume | pitch     | spatial | cooldownS | Charakter                                                                                                                            |
| ---------------- | -----: | --------- | :-----: | --------: | ------------------------------------------------------------------------------------------------------------------------------------ |
| `bagHit`         |    0,5 | 0,92–1,06 |    —    |      0,15 | sinus 95→42 Hz + niski szum                                                                                                          |
| `explosion`      |    0,6 | 0,96–1,04 |    —    |         — | szum lowpass 1400→90 Hz (Q 0,7, gain 0,9) + sinus 55→40 Hz, obie 0,6 s, attack 5 ms                                                  |
| `swing`          |   0,35 | 0,9–1,15  |    —    |      0,05 | szum bandpass 900→2600 Hz (2 warianty)                                                                                               |
| `hitLight`       |    0,6 | 0,92–1,12 |    ✓    |         — | krótki szum highpass + sinus/trójkąt opadający (2 warianty)                                                                          |
| `hitHeavy`       |    0,8 | 0,9–1,05  |    ✓    |         — | szum lowpass 1600→400 Hz + sinus 150→45 Hz + kwadrat 75→50 Hz                                                                        |
| `hitGun`         |   0,45 | 0,95–1,2  |    ✓    |         — | szum bandpass 2500 Hz + sinus 420→200 Hz                                                                                             |
| `kill`           |   0,75 | 0,9–1,15  |    ✓    |         — | klik sinus 7200 Hz / 25 ms, szum highpass (tłuczone szkło), krystaliczne „pingi” 1,7–3,3 kHz, dół 120→40 Hz (2 warianty, klik w obu) |
| `wallSlam`       |    0,8 | 0,9–1,05  |    ✓    |         — | sinus 95→38 Hz + szum lowpass 500 Hz                                                                                                 |
| `block`          |    0,6 | 1–1       |    —    |      0,04 | niski dwuton sinus 380 + 570 Hz, 200 ms                                                                                              |
| `parry`          |    0,7 | 0,97–1,03 |    —    |      0,04 | trzask (szum highpass 5 kHz, 30 ms), metaliczne „dzyń” 1,87/2,99/4,86 kHz i krótki dół 180→90 Hz, 160 ms                             |
| `blasterShot`    |    0,4 | 0,93–1,1  |    —    |         — | piła 950→180 Hz lowpass 3 kHz + szum highpass                                                                                        |
| `enemyShot`      |   0,35 | 0,9–1,05  |    —    |         — | kwadrat 420→140 Hz lowpass 1,8 kHz                                                                                                   |
| `overheat`       |    0,6 | 1–1       |    —    |         — | szum bandpass 4000→900 Hz (0,7 s) + sinus 320→140 Hz                                                                                 |
| `push`           |   0,75 | 0,95–1,05 |    —    |         — | szum lowpass 250→1400 Hz + sinus 85→40 Hz + trójkąt 660→990 Hz                                                                       |
| `denied`         |    0,4 | 1–1       |    —    |       0,2 | dwa krótkie kwadraty 180 i 150 Hz (opóźnienie 0,1 s)                                                                                 |
| `land`           |    0,5 | 0,9–1,1   |    —    |         — | sinus 120→55 Hz + szum lowpass 350 Hz                                                                                                |
| `dash`           |   0,45 | 0,95–1,1  |    —    |         — | szum bandpass 2400→500 Hz                                                                                                            |
| `playerHurt`     |    0,7 | 0,92–1,05 |    —    |         — | piła 210→85 Hz lowpass 1,1 kHz + szum                                                                                                |
| `telegraph`      |    0,3 | 0,97–1,03 |    —    |       0,1 | narastający sinus 700→1150 Hz, 120 ms                                                                                                |
| `telegraphHeavy` |   0,55 | 0,97–1,03 |   ✓*    |       0,1 | warkot piły 110→220 Hz (lowpass 500→1400) + kwadrat 55→70 Hz, na końcu tyknięcie 1320 Hz (opóźnienie 0,36 s)                         |
| `telegraphAim`   |    0,6 | 1–1       |    —    |       0,1 | wolno narastający sinus 2100→3400 Hz, attack 0,15 s, 450 ms                                                                          |
| `waveStart`      |    0,5 | 1–1       |    —    |         — | trójkąty 440 + 660 Hz (opóźnienie 0,14 s)                                                                                            |
| `waveCleared`    |    0,5 | 1–1       |    —    |         — | trójkąty 660/880/1320 Hz co 0,1 s                                                                                                    |
| `hub_meow`       |   0,22 | 0,94–1,06 |    ✓    |        20 | piła 620→380 Hz przez bandpass 1400→780 Hz (Q 3)                                                                                     |
| `hub_rat`        |   0,14 | 0,95–1,08 |    ✓    |       0,5 | pisk sinus 2200→3300 Hz + dwa cichsze tupnięcia szumu                                                                                |
| `heatWarning`    |    0,6 | 1–1       |    —    |         1 | dwa opadające tony sinus 1800 → 1500 Hz                                                                                              |
| `lowHealth`      |   0,65 | 1–1       |    —    |         1 | dwa niskie pulsy (~92 i ~84 Hz z oktawą), drugi po 0,26 s                                                                            |
| `pickup`         |    0,6 | 1–1       |    —    |      0,12 | arpeggio sinus 880/1100/1320 Hz co 80 ms                                                                                             |
| `runReward`      |    0,6 | 1–1       |    —    |         1 | dłuższe arpeggio 440/550/660/880 Hz co 160 ms (do 1,03 s)                                                                            |

\* flaga `spatial` bez efektu (brak punktu w `enemy_telegraph`).

Zasada rozróżnialności: obrona (blok, parowanie), zagrożenie (wręcz, celowanie), ciepło, trafienie
(w tym obrażenia gracza i niskie zdrowie), nagroda mają brzmieć rozpoznawalnie względem siebie; kontrolują
to metryki poniżej. Wszystkie trzy nagrody są tonalne, bez warstw szumu.

### Odbiór offline

`node tools/audio/render-sfx.mjs <katalog>` zapisuje WAV PCM16 mono 44,1 kHz dla każdego dźwięku z `sfx.json`
(obecnie 29), `metrics.json` i `clarity.json`. Wariant 0, pitch 1, gain warstw i głośność przepisu, bez szyn
master/SFX. Szum ma stały seed; render jest powtarzalny. Oscylatory są naiwne (bez ograniczenia pasma),
filtry jednobiegunowe; bandpass jest kaskadą HP/LP i nie odwzorowuje Q filtra Web Audio. Obwiednia:
liniowy atak od 0,0001, następnie wykładniczy zanik do 0,0001. Nie renderuje się 20 ms technicznego ogona
źródeł z `synth.ts`. Czas dźwięku = najdalszy koniec warstwy (`delayS + durationS`).

Centroid amplitudowy: FFT całego sygnału z dopełnieniem zerami do potęgi dwóch, bez DC, suma
`Hz × moduł FFT / suma modułów FFT`. RMS i szczyt są liczone przed kwantyzacją PCM; skrypt zgłasza błąd
dla peak > 1 zamiast ukrywać przesterowanie (obecnie największy szczyt 0,902, `explosion`).

`clarity.json`: wszystkie 93 pary pomiędzy kategoriami (obrona, zagrożenie, ciepło, trafienie, nagroda).
Różnica liczona względem mniejszej wartości: centroid >= 30% lub długość >= 40%; alternatywa obwiedni:
różnica ataku >= 10 ms i stosunek >= 3. Każda para zapisuje spełnione warunki. Wszystkie 93 pary
przechodzą. Sygnały otoczenia, ruchu i samo wystrzelenie broni są poza tymi kategoriami. Parowanie kontra
blok: centroid 6923 Hz kontra 449 Hz, 160 ms kontra 200 ms.

### Metryki odbioru (wariant 0, pitch 1; stan z renderu `render-sfx.mjs`)

| SFX            | Czas [s] | Szczyt |    RMS | Centroid [Hz] |
| -------------- | -------: | -----: | -----: | ------------: |
| bagHit         |    0,220 |  0,328 | 0,0601 |          1272 |
| explosion      |    0,600 |  0,902 | 0,1044 |          4895 |
| swing          |    0,140 |  0,058 | 0,0068 |          7470 |
| hitLight       |    0,090 |  0,845 | 0,0982 |          9806 |
| hitHeavy       |    0,280 |  0,873 | 0,1367 |          4114 |
| hitGun         |    0,060 |  0,271 | 0,0439 |          5843 |
| kill           |    0,400 |  0,892 | 0,0927 |         10363 |
| wallSlam       |    0,320 |  0,883 | 0,1380 |          2123 |
| block          |    0,200 |  0,500 | 0,0729 |           449 |
| parry          |    0,160 |  0,892 | 0,0837 |          6923 |
| blasterShot    |    0,120 |  0,198 | 0,0206 |          8757 |
| enemyShot      |    0,160 |  0,087 | 0,0214 |          2454 |
| overheat       |    0,700 |  0,236 | 0,0326 |          8264 |
| push           |    0,380 |  0,694 | 0,1084 |          2434 |
| denied         |    0,180 |  0,120 | 0,0291 |          1389 |
| land           |    0,120 |  0,350 | 0,0711 |          1299 |
| dash           |    0,200 |  0,102 | 0,0110 |          8840 |
| playerHurt     |    0,220 |  0,243 | 0,0337 |          3423 |
| telegraph      |    0,120 |  0,149 | 0,0411 |           811 |
| telegraphHeavy |    0,420 |  0,401 | 0,0674 |          1151 |
| telegraphAim   |    0,450 |  0,299 | 0,0822 |          2414 |
| waveStart      |    0,360 |  0,195 | 0,0294 |          1183 |
| waveCleared    |    0,500 |  0,171 | 0,0269 |          1850 |
| hub_meow       |    0,320 |  0,015 | 0,0019 |          3958 |
| hub_rat        |    0,265 |  0,014 | 0,0020 |          3897 |
| heatWarning    |    0,320 |  0,329 | 0,0807 |          1653 |
| lowHealth      |    0,460 |  0,507 | 0,0749 |           175 |
| pickup         |    0,360 |  0,298 | 0,0809 |          1103 |
| runReward      |    1,030 |  0,242 | 0,0602 |           655 |

Pomiary są przybliżeniem pojedynczego SFX; nie dowodzą rozpoznawania na słuch w miksie walki i nie obejmują
losowych pitchy/wariantów. Ręcznie: `?scene=sfx-test` — przycisk lil-gui dla każdego dźwięku z
`sfx.json`, demo panoramy i odległości (`hitLight` z lewej/prawej, `kill` z 30 m) oraz komenda `sfx <nazwa>`
(np. `sfx parry`, `sfx block`, `sfx telegraphHeavy`, `sfx heatWarning`, `sfx lowHealth`, `sfx pickup`,
`sfx runReward`); porównać czytelność i poziomy w miksie walki.

## Integracja

`main.ts` tworzy jeden `AudioSystem` przed `scene.init` (żeby usłyszał spawn gracza), słuchacz = kamera,
`GameContext.audio`. Debug: `window.__neoryder.query('audioState' | 'lastSound' | 'recentSounds' | 'music')`, w `sfx-test` komenda `sfx <nazwa>` i przyciski lil-gui.

Testy: `tests/unit/audio.test.ts` (atrapa AudioContext: wybór dźwięku dla zdarzeń, warunki i zbocze
przegrzania, cooldown, limit głosów, wygasanie, pitch w zakresie, panorama, odblokowanie, brak Web Audio),
`tests/unit/sfxClarity.test.ts`, `tests/unit/ambience.test.ts`, `tests/unit/music.test.ts`,
`tests/e2e/sfxTest.spec.ts` (kontekst `running` po kliknięciu), `tests/e2e/arena.spec.ts` (zabicie gra
`kill`), `tests/e2e/hub.spec.ts`.

## Otoczenie (ambient)

`AudioSystem.setAmbience(sources | null)` podmienia listę źródeł (kopiuje je) i niszczy dotychczasowy
`Ambience`; grafy powstają dopiero w `AudioSystem.updateAmbience(paused)`, wołanym co klatkę przez scenę
(obecnie tylko `HubSoundscape.render`). `setPowerLevel(0–1)` mnoży głośność źródeł zasilanych z sieci
(`generator`, `screens`, `jukebox`, `radio`). `updateAmbienceSource(index, position, gain)` przesuwa/
zmienia źródło bez restartu grafów (gain przycinany do >= 0).

**Źródło** (`ambienceSchema.ts`, `strict`): `kind` (`rain|wind|fire|generator|drip|steam|screens|crowd|radio|
jukebox|cooking|purr`), `position {x,y,z}` (skończone), `radiusM` (> 0), opcjonalnie `gain` (>= 0, nadpisuje
domyślny z profilu), opcjonalnie `track` (0–2, tylko `jukebox`: numer utworu).

**Wybór i poziom** (`ambience.ts`), co klatkę, tylko gdy kontekst ma stan `running`, scena nie jest zapauzowana
i znany jest słuchacz (w przeciwnym razie wszystkie grafy są zatrzymywane i odłączane, powrót odtwarza je
od zera z buforów):

1. Kandydaci: odległość 3D < `radiusM` i `gain` (domyślnie 1) > 0; sortowanie rosnąco po odległości (remis
   — mniejszy indeks); bierze się `tuning.audio.ambienceMaxActive` (8) najbliższych. Grafy niewybranych są
   niszczone.
2. Gain źródła = (`source.gain` lub `ambienceProfiles[kind].gain`) × tłumienie × (poziom zasilania dla
   źródeł zasilanych, inaczej 1). Tłumienie smoothstep w 3D: `d = min(1, odległość / radiusM)`,
   `(1 − d)² × (1 + 2d)` — dokładne zero na `radiusM`. Gain ustawiany skokowo co klatkę (bez wygładzania).
3. Panorama = ta sama funkcja co SFX (`spatialize`: oś prawa kamery, poziomo, `maxPan` 0,8).
4. Szyna ambience: `bus.gain = tuning.audio.ambienceGain` (0,32), podłączona do szyny `master` SFX, więc
   końcowo `masterGain × masterVolume × sfxVolume × ambienceGain × gain źródła`.

**Profile** (`tuning.audio.ambienceProfiles`: zasięg `radiusM`, domyślny `gain`, `filterHz`, `toneHz`) i
synteza (`ambienceSynth.ts`); każda „warstwa” to: źródło → filtr (Q = `ambienceFilterQ` 0,7, o ile nie
podano inaczej) → wzmacniacz z wolną modulacją amplitudy → gain/pan źródła:

| Rodzaj      | Zasięg | Gain | Warstwy                                                            |
| ----------- | -----: | ---: | ------------------------------------------------------------------ |
| `rain`      |    100 |  0,6 | szum, highpass 2400 Hz                                             |
| `wind`      |    100 | 0,45 | szum, lowpass 380 Hz                                               |
| `purr`      |      3 |  0,2 | szum, lowpass 160 Hz; modulacja 25 Hz (zob. niżej)                 |
| `fire`      |     10 | 0,65 | szum lowpass 250 Hz (poziom 0,45) + bufor trzasków highpass 550 Hz |
| `generator` |     13 | 0,32 | piła 52 Hz, lowpass 190 Hz                                         |
| `drip`      |      9 |  0,8 | bufor kropli, lowpass 3000 Hz                                      |
| `steam`     |      9 | 0,22 | szum, highpass 1600 Hz                                             |
| `screens`   |      7 |  0,1 | kwadrat 110 Hz, lowpass 550 Hz                                     |
| `crowd`     |     24 |  0,7 | trzy pasma szumu bandpass 350/850/1700 Hz, Q 2, poziom 0,45 każde  |
| `radio`     |      8 |  0,3 | bufor szumu i przerywanych tonów, bandpass 1100 Hz                 |
| `jukebox`   |     13 | 0,32 | bufor frazy (zob. niżej), lowpass 1700 Hz                          |
| `cooking`   |      9 | 0,25 | szum, highpass 2400 Hz (skwierczenie)                              |

Modulacja amplitudy (każda warstwa ma własny LFO sinus): zwykłe rodzaje — częstotliwość
`ambienceLfoHz` (0,18 Hz) × losowo z [`ambienceLfoRateMin` 0,7; `ambienceLfoRateMax` 1,3], głębokość
`ambienceLfoDepth` (0,25): amplituda = `poziom × (1 − d)` + LFO o amplitudzie `poziom × d`, czyli waha się
w [1 − 2d; 1] × poziom. `purr`: LFO `ambiencePurrPulseHz` (25 Hz), `ambiencePurrDepth` (0,85), baza
`1 − D/2`, LFO `D/2` (zakres [1 − D; 1]). Brak własnych timerów — wszystko na kontekście audio.

Bufory (mono, powstają raz dla rodzaju i są współdzielone; losowość z kosmetycznego `Rng` z podziałem na
rodzaj): długość pętli `ambienceLoopS` (12 s). Podłoga szumu `ambienceNoiseFloorGain` (0,16; `fire`:
`ambienceFireNoiseFloorGain` 0,02; `drip`: 0). Impulsy mają obwiednię `sin(π·t/span) × exp(−6·t/span)`
(`ambiencePulseDecay` = 6) i dodają się do bufora w losowych chwilach:

- `drip`: ping sinus `ambienceDripHz` (1600 Hz), `span` = `ambienceDripDecayS × 6` (0,27 s), odstępy
  losowe z [`ambienceDripMinS` 0,7; `ambienceDripMaxS` 2,8] s.
- `fire`: trzask szumu o gainie `ambienceFireCrackleGain` (0,8), `span` `ambienceFireCrackleS` (18 ms),
  odstępy wykładnicze (proces Poissona) o intensywności `ambienceFireCrackleRate` (9/s).
- `radio`: ton sinus `ambienceRadioToneHz` (720 Hz), gain `ambienceRadioToneGain` (0,18), `span`
  `ambienceRadioToneS` (0,16 s), Poisson o intensywności `ambienceRadioToneRate` (1,3/s).
- Po złożeniu (nie dotyczy `jukebox`) początek i koniec bufora są wygaszane liniowo przez 18 ms
  (`ambienceFireCrackleS`, wspólne dla wszystkich tych rodzajów) — gładka spoina pętli.
- `jukebox`: oryginalna fraza bez melodii, `ambienceJukeboxBars` (8) taktów po `ambienceJukeboxBeatsPerBar`
  (4) uderzeń. W każdym takcie ton podstawowy = `ambienceJukeboxRootHz` (55 Hz) × `2^(półtony/12)`, gdzie półton
  to kolejny element listy `roots` (cyklicznie po taktach). Bas: sinus tonu podstawowego, faza liczona od
  początku uderzenia, obwiednia `sin(π·b) × exp(−ambienceJukeboxBassDecay · b)` (b = pozycja w uderzeniu 0–1,
  decay 5), gain `ambienceJukeboxBassGain` (0,5). Pad: suma sinusów `ton × 2^(półton akordu/12)` (faza
  liczona od początku taktu), obwiednia `sin²(π · pozycja w takcie)`, gain `ambienceJukeboxPadGain` (0,12).
  Utwory (`track`): 0 — 90 BPM (`ambienceJukeboxBpm`), `roots` = `ambienceJukeboxRoots`
  [0,0,−5,−5,−2,−2,−7,−7], akord = `ambienceJukeboxChordSemitones` [12,15,19,22]; 1 (`rain`) — 76 BPM,
  `roots` [0,−4,−7,−2], akord [12,15,19,26]; 2 (`dawn`) — 104 BPM, `roots` [−2,−7,0,−5], akord
  [12,17,19,22]. Bufor każdego utworu jest osobny (klucz rodzaj+track).

**Pociąg** (kryjówka): osobny graf `train` na tej samej szynie ambience (nie przechodzi selekcji źródeł):
szum lowpass `hub.trainFilterHz` (130 Hz) + sinus `hub.trainLowHz` (38 Hz) przez ten sam filtr o poziomie
`hub.trainToneGain` (0,45), z tą samą modulacją amplitudy. Gain = `hub.trainGain` (0,9) × `sin²(π · postęp)`
(postęp 0–1 ustawia `setTrainPass`); panorama = `(2·postęp − 1) × cos(yaw) × maxPan` (zachód → wschód
zależnie od obrotu słuchacza). Postęp `null` niszczy graf. `setAmbience(null)` i `dispose` zwalniają
wszystkie grafy, także pociąg.

### Źródła kryjówki

`hubAmbienceSources` (`src/world/hubAmbience.ts`) buduje listę z układu kryjówki: po jednym źródle `fire`
na każdy wpis `fires`; `generator` na każdy blok o modelu `city_generator`; `drip`/`steam` z `ambientFx`
(zasięgi z profilu); `screens` z paneli `kind: screen` zgrupowanych zachłannie — skupisko = pierwszy
nieprzypisany ekran plus ekrany w promieniu `ambienceScreenClusterM` (4 m) od niego (bez łańcuchowania),
pozycja = średnia pozycji członków. Do tego dochodzą źródła z `src/data/hub/ambience.json` (walidowane
zod, `strict`; nieznane pola to błąd): gwar `crowd` w hali (zasięg 24) oraz w dwóch lokalnych punktach
(zasięg 14/gain 0,8 i zasięg 12/gain 0,7), `jukebox` przy barze (13), dwa `radio` (8 i 9) i `cooking` (9).
Na końcu `HubSoundscape` dopina źródła ruchome (`hubFauna`, mruczenie kota).

`query('hubAmbience')` pokazuje aktywne `{ kind, gain }` (gain przed mnożnikami szyn: po tłumieniu i
zasilaniu); komenda `hub train` wymusza przejazd pociągu. `HubSoundscape` ustawia też numer utworu
szafy grającej (`setJukeboxTrack` — przepisuje `track` wszystkich źródeł `jukebox` i podmienia listę
źródeł, co restartuje grafy ambientu).

Fauna kryjówki: rodzaj `purr` jest ruchomym źródłem dodanym na końcu listy; gain > 0 (domyślny z profilu)
tylko gdy kot odpoczywa, w przeciwnym razie 0 (wtedy wypada z selekcji). Zdarzenie
`hub_fauna_sound { kind: 'meow' | 'rat'; point }` mapują reguły z warunkiem `faunaKind` na `hub_meow` i
`hub_rat` (przestrzennie w `point`).

Ręcznie: `?scene=hub&debug=1`, kliknij grę, przejdź od beczki przez generatory i ekrany do baru/Bajta; obróć
kamerę, zmień głośność efektów, sprawdź ciszę po Esc i wznowienie, następnie `hub train`.

## Warstwy pogody

Profile pogody (`src/data/weather/*.json`, pole `ambience`) mogą zawierać źródła `rain` (szum highpass) i
`wind` (szum lowpass) z `gain` i `radiusM` (np. 100 m). `CityDressing` przekazuje je przez
`AudioSystem.setAmbience` (pozycja początkowa 0,0,0) i co klatkę przesuwa do pozycji kamery przez
`updateAmbienceSource` (więc słuchacz jest zawsze w środku źródła, tłumienie = 1). Parametry filtrów są w
`tuning.audio.ambienceProfiles`, poziomy w danych pogody. Profile bez pola `ambience` nie tworzą audio
pogody. Uwaga: grafy ambientu powstają tylko przez `updateAmbience`, które obecnie woła wyłącznie
`HubSoundscape`. Szczegóły cyklu życia i odsłuchu: [weather.md](weather.md).

## Muzyka

Syntezowana w locie (Web Audio, bez plików i cudzych próbek), pięć pętli w `src/data/audio/music.json`
(walidacja zod: `src/audio/musicSchema.ts`). Trzy „stany” sterowane walką: **calm** (kryjówka, mapa, poza
walką; 74 BPM, pad + puls basu + delikatne arpeggio, bez perkusji), **combat** (126 BPM, bas ósemkowy,
kick/snare/hat, stabsy) i **boss** (140 BPM, 16-kowy bas, klastry z półtonami i trytonem, „alarm”) oraz dwa
warianty spokoju wybierane szafą grającą w kryjówce: **calmRain** (62 BPM, pad trójkąt, bas sinus, „dzwonek”,
deszczowy hat) i **calmDawn** (92 BPM, pad piła, puls trójkąt, arpeggio, cicha stopa i hat). Każda pętla
ma 16 taktów po 4 uderzenia, 4 kroki na uderzenie.

- **Dane.** Pętla = `bpm` (40–220), `beatsPerBar` (1–8), `stepsPerBeat` (1–8),
  `bars` (8–16) i `tracks`; globalnie `fadeS` (0,2–6, obecnie 1,8 s). Ścieżka `tone` ma `wave`, `detuneCents`
  (0–100, opcjonalnie: drugi oscylator rozstrojony o tyle centów), `attackS`, `releaseS`, `filter`
  (typ, `freq`, opcjonalnie `freqEnd`/`q`) i `pan` (−1..1); ścieżki `kick`/`snare`/`hat` to perkusja. Każda
  ścieżka ma `id` (unikalne w pętli), `gain` (0–2) i `pattern`: tablica napisów, po jednym na takt, używana
  cyklicznie (jej długość musi dzielić `bars`); każdy takt ma dokładnie `beatsPerBar × stepsPerBeat` tokenów
  rozdzielonych spacją. Token tonowy: `.` pauza, nuta `A1` (`C#3`, `Bb2`), akord `A3+C4+E4`, długość w
  krokach `*4` (domyślnie 1), głośność `@0.6` (0–1, domyślnie 1), np. `A3+C4*16@0.8`; perkusja: `.`, `x`
  (pełna siła 1), `o` (cicha 0,5). Nuta nie może wychodzić poza 4 takty od startu.
  Częstotliwość = `440 × 2^((MIDI − 69)/12)`, MIDI = `(oktawa+1)×12 + półton + (#:+1, b:−1)`.
- **Ścieżki (wartości z `music.json`)**; wzorce (`pattern`) przenosi się razem z plikiem danych:

| Pętla      | Ścieżka  | Rodzaj/fala | gain | detune | attack | release | filtr                      | pan   |
| ---------- | -------- | ----------- | ---: | -----: | -----: | ------: | -------------------------- | ----- |
| `calm`     | pad      | piła        | 0,34 |      9 |    1,6 |     2,2 | lowpass 650→1100 Hz, Q 0,7 | —     |
|            | puls     | sinus       | 0,55 |      — |   0,02 |     0,5 | lowpass 160 Hz             | —     |
|            | arpeggio | trójkąt     | 0,22 |      — |   0,01 |     0,9 | lowpass 2400 Hz, Q 0,8     | 0,3   |
|            | szum     | hat         | 0,05 |      — |      — |       — | —                          | —     |
| `combat`   | kick     | kick        |  0,9 |      — |      — |       — | —                          | —     |
|            | snare    | snare       |  0,5 |      — |      — |       — | —                          | —     |
|            | hat      | hat         | 0,22 |      — |      — |       — | —                          | —     |
|            | bas      | piła        |  0,5 |      — |  0,005 |    0,12 | lowpass 520→240 Hz, Q 2    | —     |
|            | pad      | piła        |  0,2 |     12 |    0,6 |     1,2 | lowpass 800 Hz, Q 0,8      | —     |
|            | stab     | kwadrat     | 0,17 |      — |  0,004 |    0,15 | lowpass 2600→500 Hz, Q 1,5 | −0,25 |
| `boss`     | kick     | kick        |    1 |      — |      — |       — | —                          | —     |
|            | snare    | snare       |  0,6 |      — |      — |       — | —                          | —     |
|            | hat      | hat         | 0,24 |      — |      — |       — | —                          | —     |
|            | bas      | piła        |  0,5 |      6 |  0,004 |     0,1 | lowpass 420→180 Hz, Q 3    | —     |
|            | klaster  | piła        |  0,2 |     18 |    0,5 |     1,4 | lowpass 900→1600 Hz, Q 1,2 | —     |
|            | alarm    | kwadrat     | 0,09 |      — |   0,01 |    0,25 | bandpass 1500 Hz, Q 1,2    | 0,2   |
|            | stab     | kwadrat     | 0,17 |      — |  0,003 |    0,12 | lowpass 3000→400 Hz, Q 2   | −0,25 |
| `calmRain` | pad      | trójkąt     | 0,42 |      6 |    2,2 |     2,6 | lowpass 520→900 Hz, Q 0,6  | —     |
|            | bas      | sinus       |  0,5 |      — |   0,03 |     0,8 | lowpass 140 Hz             | —     |
|            | dzwonek  | sinus       |  0,2 |      — |  0,005 |     1,6 | lowpass 3200 Hz, Q 0,5     | −0,3  |
|            | deszcz   | hat         | 0,03 |      — |      — |       — | —                          | —     |
| `calmDawn` | pad      | piła        | 0,26 |     12 |    0,8 |     1,8 | lowpass 900→1800 Hz, Q 0,7 | —     |
|            | puls     | trójkąt     | 0,55 |      — |   0,01 |     0,3 | lowpass 220 Hz             | —     |
|            | arpeggio | trójkąt     | 0,24 |      — |   0,01 |     0,6 | lowpass 3000 Hz, Q 0,8     | 0,25  |
|            | stopa    | kick        | 0,35 |      — |      — |       — | —                          | —     |
|            | szum     | hat         | 0,05 |      — |      — |       — | —                          | —     |

- **Synteza nuty tonowej** (`music.ts`, `tone`): głośność zdarzenia `g = gain ścieżki × @głośność`; szczyt
  obwiedni = `g / sqrt(liczba nut akordu × (detune ? 2 : 1))` (min 0,0001). Koniec nuty = start +
  `max(długość_w_krokach × czas_kroku, attackS)`; obwiednia: od 0,0001 liniowo do szczytu przez `attackS`,
  trzymanie do końca nuty, wykładniczy zanik do 0,0001 przez `releaseS`; oscylatory zatrzymane 50 ms po
  zaniku. Każda nuta akordu = oscylator `wave` (+ drugi o `detuneCents` centów, jeśli podano), wszystkie
  przez wspólny filtr (z przemiataniem `freq→freqEnd` do końca nuty) → obwiednia → opcjonalny panner →
  szyna pętli. Czas kroku = `60 / bpm / stepsPerBeat`.
- **Perkusja** (kolejne wartości stałe w kodzie, `music.ts`): `kick` — sinus 155→42 Hz (wykładniczo, 0,13 s),
  atak 4 ms, zanik do 0,0001 w 0,32 s, gain = `g`. `snare` — szum bandpass 1900 Hz (Q 0,8), atak 2 ms,
  zanik 0,17 s + trójkąt 190→120 Hz (0,1 s), atak 3 ms, zanik 0,12 s, gain 0,5·`g`. `hat` — szum highpass
  7500 Hz (Q 0,7), atak 2 ms, zanik 0,05 s. Szum perkusji: ten sam bufor szumu, start z losowego offsetu
  [0; 0,8) s z `Rng` muzyki. Zdarzenie perkusyjne ma `g = gain ścieżki × (1 lub 0,5)`.
- **`MusicSystem`** (`music.ts`): `setState('calm'|'combat'|'boss'|'calmRain'|'calmDawn'|'off')`, `update()`,
  `dispose()`. Harmonogram z wyprzedzeniem (1,5 s) na `AudioContext.currentTime`: tyknięcie co 250 ms
  (`setInterval`) planuje kroki aż do horyzontu, więc opóźnienie timera i zawieszony kontekst (przed pierwszym
  gestem lub w pauzie) nie rozjeżdżają rytmu ani nie kumulują nut. Zmiana stanu to crossfade
  `fadeS` (1,8 s): stara szyna schodzi liniowo do 0 (i jest odłączana ~0,1 s po końcu), nowa rośnie liniowo
  od 0 do 1, nowa pętla startuje od taktu 1, 50 ms po chwili zmiany. Powtórzenie tego samego stanu nic nie
  zmienia; `off` tylko wycisza starą pętlę. Każdy tick woła też `onTick` (dyrektor liczy histerezę).
- **Kontekst i głośność.** Ten sam `AudioContext` co SFX (`AudioSystem.getContext()`). Własna szyna idzie wprost
  do `destination`: `max(0, masterGain × masterVolume × musicVolume × musicGain)`, `tuning.audio.musicGain` =
  0,35; **bez** `sfxVolume` i bez szyny `master`. Wartość jest czytana na każdym tyknięciu.
- **`MusicDirector`** (`musicDirector.ts`, czysta logika, zegar = czas kontekstu audio): stan docelowy liczony
  w kolejności: ręczne wymuszenie (`setOverride`) → „wyciszenie” (po śmierci/końcu runu) = `calm` → boss
  (`bossId` ustawiony) = `boss` → walka (fala trwa lub `now < combatUntil`) = `combat` → w przeciwnym razie
  wariant spokoju z szafy: `calm` / `calmRain` / `calmDawn` (indeks utworu szafy 0–2).
  - `scene_loaded`: zeruje szafę (0), bossa, falę, histerezę i wyciszenie.
  - `wave_started` → walka do `wave_cleared`, potem jeszcze `combatHoldS` (4 s); ignorowane w stanie wyciszenia.
  - Obrażenia z udziałem gracza (`damage_dealt`, gracz jako `source` lub `target`) i `enemy_killed`
    przedłużają walkę o 4 s (histereza).
  - `boss_spawned` → boss (priorytet) do `entity_despawned`/`enemy_killed` bossa, potem walka jeszcze 4 s.
  - `player_died` i `run_ended` → calm do następnej sceny lub nowego gracza (`entity_spawned` gracza zdejmuje
    wyciszenie).
  - `hub_prop_used` z `kind: jukebox` → następny utwór szafy (`(n + 1) mod 3`) i natychmiastowe przeliczenie.
  - Stan początkowy po utworzeniu: `calm`. Sceny nie muszą nic przekazywać.
- **Podpięcie** w `main.ts` (obok `AudioSystem`). Muzyka (system i dyrektor) jest wyłączona przy `?fx=lite` i
  pod automatem (`navigator.webdriver`: Playwright), więc e2e nie płacą za syntezę. Dyrektor zgłasza `calm`
  już przy utworzeniu, więc `MusicSystem` tworzy kontekst audio przy starcie (zawieszony do gestu).
- **Debug.** Komenda `music <calm|combat|boss|off|auto>` (konsola `` ` ``; `auto` wraca do dyrektora; warianty
  `calmRain`/`calmDawn` komenda nie przyjmuje), `window.__neoryder.query('music')` → `{ state, playing }`.
  Odsłuch bez gry: `node tools/audio/renderMusic.mjs [katalog] [calm|combat|boss]` renderuje pętle do WAV
  uproszczoną syntezą offline (32 kHz) i wypisuje szczyt/RMS (przybliżenie brzmienia, nie kopia Web Audio).
- **Testy:** `tests/unit/music.test.ts` (schemat, dyrektor, harmonogram na atrapie kontekstu, crossfade,
  `dispose`, głośność, `musicVolume`).
