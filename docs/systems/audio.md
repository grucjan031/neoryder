# Dźwięki (F1 #14)

## S7-02 — audyt czytelności SFX (2026-11-18)

| Zdarzenie gry / fakt                                         | Przed                                                 | Po                                                                                                   | Co gracz rozpoznaje                                             |
| ------------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `parry_success` / `melee_blocked`                            | `parry` 370 ms, `block` 120 ms; parowanie zbyt długie | `parry` 160 ms: trzask, metaliczne „dzyń” 1,9/3,0/4,9 kHz i krótki dół; `block` 200 ms, niski dwuton | Udane odbicie kontra zwykły blok                                |
| `enemy_telegraph`, `swing`/`slam`                            | Wspólny `telegraph` dla wszystkich ataków             | `telegraph`, narastający ton 700–1150 Hz                                                             | Nadchodzący cios wręcz (do zablokowania)                        |
| `enemy_telegraph`, `heavy`                                   | Ten sam `telegraph`                                   | `telegraphHeavy`, przestrzenny warkot 110→220 Hz zakończony tyknięciem                               | Cios przebijający blok — trzeba uskoczyć                        |
| `enemy_telegraph`, `aim`                                     | Ten sam `telegraph` co wręcz                          | `telegraphAim`, wolniej narastający ton 2100–3400 Hz                                                 | Celowanie przed strzałem (strzelec, dron, wachlarz bossa)       |
| `heat_changed`, przekroczenie 75%                            | Brak                                                  | `heatWarning`, dwa opadające tony                                                                    | Zbliżające się przegrzanie                                      |
| `heat_changed`, zbocze `overheated`                          | `overheat`                                            | `overheat`, pierwszeństwo przed ostrzeżeniem                                                         | Broń przegrzana                                                 |
| `damage_dealt`, `#melee`/`#power`, `#heavy`, `#gun`, `#wall` | `hitLight`, `hitHeavy`, `hitGun`, `wallSlam`          | Te same rozróżnione sygnały                                                                          | Rodzaj trafienia                                                |
| `damage_dealt.killed`                                        | `kill`, szum i tony                                   | `kill` z dodatkowym klikiem 7200 Hz / 25 ms w obu wariantach                                         | Zabójstwo; kod nie zawiera osobnego faktu trafienia krytycznego |
| `damage_dealt`, cel = gracz                                  | `playerHurt`                                          | `playerHurt`                                                                                         | Otrzymanie obrażeń                                              |
| `health_changed`, zdrowie <25%                               | Brak                                                  | `lowHealth`, dwa niskie pulsy, jednorazowo                                                           | Niskie zdrowie                                                  |
| `currency_changed`, `delta > 0`                              | Brak                                                  | `pickup`, arpeggio 880/1100/1320 Hz                                                                  | Przyrost waluty; wydatki i delta 0 są ciche                     |
| `implant_acquired`                                           | Brak                                                  | `pickup`                                                                                             | Zdobycie lub ulepszenie implantu                                |
| `wave_cleared`                                               | `waveCleared`, tonalne arpeggio                       | Bez zmian                                                                                            | Koniec fali                                                     |
| `meta_rewards`                                               | Brak                                                  | `runReward`, dłuższe arpeggio 440/550/660/880 Hz                                                     | Rozliczenie nagrody runu, także po śmierci                      |

Przepisy i progi są w `sfx.json`. `alerts` jest opcjonalne dla zgodności ze
starszymi definicjami; bez niego dodatkowe alerty progowe są wyłączone.
Ciepło uzbraja alert przy >=75%, ponownie dopiero po zejściu do <=60%.
Zdrowie uruchamia alert przy <25%, ponownie po powrocie do >=35%; zero zdrowia
nie wyzwala alarmu. Pierwsza obserwacja w stanie alarmowym także daje sygnał.
Oba alerty dotyczą wyłącznie aktualnego gracza; niepoprawne maksimum <=0 jest
ignorowane. Alerty nie zapętlają dźwięków. Ich `cooldownS` = 1 s dodatkowo tłumi
szybkie kolejne przekroczenia. Przekroczenie podczas cooldownu nie jest kolejkowane.
Skok bezpośrednio do przegrzania odtwarza tylko `overheat`.

Spawn gracza, despawn, `run_started` i `scene_loaded` resetują stan progów oraz
cooldowny. `scene_loaded` zachowuje ID gracza, ponieważ w aplikacji przychodzi po
spawnie. `weapon_switched` resetuje stan ciepła gracza przed migawką nowej broni.
`enemy_telegraph.kind` już zawiera `aim` i `heavy` (cios przebijający blok); nie zmieniono kontraktów ani emitentów.
Inne rodzaje zapowiedzi (także `summon`/`shield`) zachowują ogólny sygnał.

### Odbiór offline

`node tools/audio/render-sfx.mjs <katalog>` zapisuje 28 plików WAV PCM16 mono
44,1 kHz, `metrics.json` oraz `clarity.json`. Wariant 0, pitch 1, gain warstw i
głośność przepisu, bez szyn master/SFX. Szum ma stały seed; render jest powtarzalny.
Oscylatory są naiwne (bez ograniczenia pasma), filtry jednobiegunowe;
bandpass jest kaskadą HP/LP i nie odwzorowuje Q filtra Web Audio. Obwiednia:
liniowy atak od 0,0001, następnie wykładniczy zanik do 0,0001.
Nie renderujemy 20 ms technicznego ogona źródeł z `synth.ts`.

Centroid amplitudowy: FFT całego sygnału z dopełnieniem zerami do potęgi dwóch,
bez DC, suma `Hz × moduł FFT / suma modułów FFT`. RMS i szczyt są liczone przed
kwantyzacją PCM; skrypt zgłasza błąd dla peak >1 zamiast ukrywać przesterowanie.
Podczas odbioru wykryto peak 1,353 w istniejącym `explosion`; volume zmniejszono
z 0,9 do 0,6 (peak 0,902), bez zmian warstw i bez zmian muzyki.

`clarity.json` zawiera wszystkie 93 pary pomiędzy kategoriami: obrona (blok,
parowanie), zagrożenie (wręcz, celowanie), ciepło, trafienie (w tym obrażenia
gracza i niskie zdrowie), nagroda. Różnica jest liczona względem mniejszej wartości:
centroid >=30% lub długość >=40%. Alternatywa obwiedni to różnica ataku >=10 ms
i stosunek >=3; każda para zapisuje konkretne spełnione warunki. Wszystkie 93
pary przechodzą. Sygnały otoczenia, ruchu i samo wystrzelenie broni są poza tymi
pięcioma kategoriami. Parowanie: centroid 4749 Hz kontra 449 Hz bloku, 40 ms
kontra 200 ms. Wszystkie trzy nagrody są tonalne, bez warstw szumu.

### Metryki odbioru (wariant 0, pitch 1)

| SFX          | Czas [s] | Szczyt |    RMS | Centroid [Hz] |
| ------------ | -------: | -----: | -----: | ------------: |
| bagHit       |    0,220 |  0,328 | 0,0601 |          1272 |
| explosion    |    0,600 |  0,902 | 0,1044 |          4895 |
| swing        |    0,140 |  0,058 | 0,0068 |          7470 |
| hitLight     |    0,090 |  0,845 | 0,0982 |          9806 |
| hitHeavy     |    0,280 |  0,873 | 0,1367 |          4114 |
| hitGun       |    0,060 |  0,271 | 0,0439 |          5843 |
| kill         |    0,400 |  0,892 | 0,0927 |         10363 |
| wallSlam     |    0,320 |  0,883 | 0,1380 |          2123 |
| block        |    0,200 |  0,500 | 0,0729 |           449 |
| parry        |    0,040 |  0,520 | 0,0870 |          4749 |
| blasterShot  |    0,120 |  0,198 | 0,0206 |          8757 |
| enemyShot    |    0,160 |  0,087 | 0,0214 |          2454 |
| overheat     |    0,700 |  0,236 | 0,0326 |          8264 |
| push         |    0,380 |  0,694 | 0,1084 |          2434 |
| denied       |    0,180 |  0,120 | 0,0291 |          1389 |
| land         |    0,120 |  0,350 | 0,0711 |          1299 |
| dash         |    0,200 |  0,102 | 0,0110 |          8840 |
| playerHurt   |    0,220 |  0,243 | 0,0337 |          3423 |
| telegraph    |    0,120 |  0,149 | 0,0411 |           811 |
| waveStart    |    0,360 |  0,195 | 0,0294 |          1183 |
| waveCleared  |    0,500 |  0,171 | 0,0269 |          1850 |
| hub_meow     |    0,320 |  0,015 | 0,0019 |          3958 |
| hub_rat      |    0,265 |  0,014 | 0,0020 |          3897 |
| heatWarning  |    0,320 |  0,329 | 0,0807 |          1653 |
| lowHealth    |    0,660 |  0,470 | 0,0871 |            81 |
| telegraphAim |    0,450 |  0,299 | 0,0822 |          2414 |
| pickup       |    0,360 |  0,298 | 0,0809 |          1103 |
| runReward    |    1,030 |  0,242 | 0,0602 |           655 |

### Ograniczenia i ręczny odbiór

Pomiary są przybliżeniem pojedynczego SFX; nie dowodzą rozpoznawania na słuch
w miksie walki, nie obejmują wszystkich losowych pitchy/wariantów. Nie wykonano
odsłuchu ani przeglądarki zgodnie z zakresem odbioru. Ręcznie: istniejąca scena
`?scene=sfx-test`, komendy `sfx parry`, `sfx block`, `sfx telegraph`,
`sfx telegraphAim`, `sfx telegraphHeavy`, `sfx heatWarning`, `sfx overheat`, `sfx lowHealth`,
`sfx pickup`, `sfx runReward`; porównać czytelność i poziomy w miksie walki.
Nie ma osobnego faktu krytyka ani osobnego rodzaju zapowiedzi snajpera:
wykorzystano istniejące zabójstwo i celowanie. `pickup` obejmuje dodatni przyrost
waluty niezależnie od źródła oraz implant z nagrody/sklepu/ulepszenia.
Nie dodano żadnego `emit`, nie zmieniono plików poza dozwolonym zakresem.
Nie wskazano katalogu wersji ani ścieżki wyjścia `-o`; raport jest w tym dokumencie
i odpowiedzi końcowej. Nie wykonano commitów ani płatnych wywołań API (koszt: 0).

### Raport zmian i sprawdzeń

Zmienione pliki: `src/audio/audioSystem.ts`, `src/audio/sfxSchema.ts`,
`src/data/audio/sfx.json`, `docs/systems/audio.md`; nowe:
`tests/unit/sfxClarity.test.ts`, `tools/audio/render-sfx.mjs`.
Zastany `.zlecenie-audio.md` pozostawiono bez zmian. Żadnych nowych `emit`.

| Polecenie                                                                                                                                                                         | Wynik                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `npx.cmd tsc --noEmit -p .`                                                                                                                                                       | exit 0, bez błędów                                          |
| `npx.cmd vitest run tests/unit/sfxClarity.test.ts`                                                                                                                                | 6 passed                                                    |
| `npx.cmd vitest run tests/unit/audio.test.ts`                                                                                                                                     | 15 passed                                                   |
| `npx.cmd vitest run tests/unit/sfxClarity.test.ts tests/unit/audio.test.ts`                                                                                                       | 2 files passed, 21 tests passed                             |
| `npx.cmd vitest run tests/unit -t audio`                                                                                                                                          | 3 files passed / 217 skipped; 8 tests passed / 2290 skipped |
| `node tools/audio/render-sfx.mjs "$env:TEMP\neoryder-sfx-s7-02"`                                                                                                                  | 28 WAV; 93 par, 0 niespełnionych; peak <=0,902; exit 0      |
| `npx.cmd prettier --check src/audio/audioSystem.ts src/audio/sfxSchema.ts src/data/audio/sfx.json tests/unit/sfxClarity.test.ts tools/audio/render-sfx.mjs docs/systems/audio.md` | All matched files use Prettier code style!                  |

PowerShell odrzucił początkowe `npx` przez politykę wykonywania `npx.ps1`;
użyto równoważnego `npx.cmd`, bez zmiany polityki systemu. Filtr `-t audio`
nie obejmuje wszystkich polskich nazw testów, dlatego wykonano także cały
istniejący plik `audio.test.ts`. Przegląd własny obejmował diff, emitentów,
kolejność zdarzeń, progi/histerezę, pierwszeństwo przegrzania oraz render.
Poprawiono reset ID przy `scene_loaded` i przesterowanie wybuchu, następnie
powtórzono testy. Niezależny review Architekta pozostaje po stronie odbiorcy.
Zgodnie ze zleceniem nie uruchamiano e2e, przeglądarki, mutacji ani pełnego CI.

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

| Zdarzenie                             | Warunek                | Dźwięk                                          |
| ------------------------------------- | ---------------------- | ----------------------------------------------- |
| `explosion`                           | każde zdarzenie        | `explosion` (niski grzmot, Z21)                 |
| `damage_dealt`                        | cel = gracz            | `playerHurt`                                    |
|                                       | `killed`               | `kill` (tłuczone szkło + krystaliczne „pingi”)  |
|                                       | `#wall`                | `wallSlam`                                      |
|                                       | `#heavy`               | `hitHeavy`                                      |
|                                       | `#melee` / `#power`    | `hitLight`                                      |
|                                       | `#gun`                 | `hitGun`                                        |
| `melee_swing` (gracz)                 |                        | `swing`                                         |
| `melee_blocked`                       |                        | `block`                                         |
| `parry_success`                       |                        | `parry`                                         |
| `weapon_fired` (gracz)                |                        | `blasterShot`                                   |
| `projectile_spawned`                  | drużyna `enemy`        | `enemyShot`                                     |
| `heat_changed`                        | zbocze przegrzania     | `overheat`                                      |
| `power_used` / `power_denied` (gracz) |                        | `push` / `denied`                               |
| `player_landed`                       | prędkość ≥ 7 m/s       | `land`                                          |
| `dash_used` (gracz)                   |                        | `dash`                                          |
| `enemy_telegraph`                     | `heavy` / `aim` / inne | `telegraphHeavy` / `telegraphAim` / `telegraph` |
| `wave_started` / `wave_cleared`       |                        | `waveStart` / `waveCleared`                     |

## Integracja

Z21: przepis `explosion` ma szum przez lowpass 1400 → 90 Hz (Q 0,7)
i sinus 55 → 40 Hz, obie warstwy po 0,6 s, attack 5 ms. Głośność przepisu
0,6 (korekta S7-02), gain warstw 0,9 / 1, pitch 0,96–1,04. Reguła bez warunku gra dla
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
