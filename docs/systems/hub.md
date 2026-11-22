# Kryjówka (hub) — F4-07

## Rekwizyty

`hideout.json.props` definiuje `id`, `kind` (`jukebox`, `noodles`, `radio`, `bag`, `seat`),
`label` i `focus` o dodatnich wymiarach, takim jak dla stacji. Id są unikalne (`^[a-z0-9_]+$`).
E używa najbliższego trafienia promieniem z oka spośród stacji, NPC, rekwizytów i kota
w `interactRangeM`, pomijając cele zasłonięte wysoką geometrią (kolider bloku z górną krawędzią wyżej niż `losOccluderMinTopM` = 1,4 m nad podłogą;
lady, stoły i ławki nie zasłaniają, ściany i filary tak), i bierze wtedy kolejny niezasłonięty cel; podpowiedź pokazuje E i `label` z układu (nie z tekstów). Przytrzymanie nie powtarza
użycia (liczy się zbocze `power2`). Teksty i nazwy utworów są w walidowanym `src/data/hub/props.pl.json`
(`labels.{jukebox,noodles,radio,bag,seat,stand}`, `jukebox.{speaker,tracks[3]}`, `noodles.lines[≥2]`); do podpowiedzi
służy z nich tylko `labels.stand` („Wstań”), pozostałe etykiety bierze się z układu.

| id                    | kind    | label                  | focus: środek (x; y; z) → wymiary (x × y × z) |
| --------------------- | ------- | ---------------------- | --------------------------------------------- |
| `jukebox`             | jukebox | Przełącz utwór         | −6,8; 0,9; 15,4 → 0,9 × 1,8 × 0,65            |
| `noodles`             | noodles | Zjedz miskę            | −17; 1,15; −17,6 → 3,4 × 0,4 × 0,85           |
| `radio`               | radio   | Włącz / wyłącz audycję | 5,1; 1,1; −16,9 → 0,85 × 0,45 × 0,58          |
| `bag`                 | bag     | Uderz w worek          | 18,3; 2,1; −2,4 → 0,6 × 1,8 × 0,6             |
| `seat_platform_couch` | seat    | Usiądź                 | −15,1; 0,6; 9,05 → 1,2 × 0,9 × 0,9            |
| `seat_canteen_bench`  | seat    | Usiądź                 | −16,1; 0,4; −13,55 → 1 × 0,8 × 0,56           |
| `seat_bar_stool`      | seat    | Usiądź                 | −3; 0,3; 12,9 → 0,5 × 0,6 × 0,5               |
| `seat_bunk_edge`      | seat    | Usiądź                 | −1,5; 0,5; −17,2 → 0,7 × 0,7 × 1,2            |

- Szafa grająca na peronie B przełącza utwory 0→1→2→0 (start: „Ostatni peron”,
  dalej „Deszcz na kredyt”, „Świt odwołany”). Trzy oryginalne frazy basu i padów
  mają inne tempa i akordy; źródło ambience `jukebox` otrzymuje `track` (0–2). Chatter (`conversation` = id
  rekwizytu) podaje nazwę utworu jako kwestię mówiącego „Szafa grająca”.
- Lada Heli: „Zjedz miskę” losuje kwestię z danych przez `Rng.fork('hub-props')` i podaje ją przez chatter jako `hela`
  (`conversation` = `noodles`). Przez `noodlesWarmthS` = 2 s ciepłe przyciemnienie krawędzi zanika liniowo nad canvasem
  (pełnoekranowa nakładka: radialny gradient od przezroczystości do 45% promienia, na krawędzi `rgb(84 44 12 / 48%)`;
  krycie = pozostały czas / 2 s). CSS wyłącza je przy `prefers-reduced-motion: reduce`, pozostawiając komunikat.
- Radio na biurku Leny wymusza `lena_radio_broadcast`; następne E wyłącza
  audycję (z odnowieniem tej rozmowy) także podczas przerwy między kwestiami i przed końcem cooldownu.
- Worek w hali (bez collidera, żeby nie zakleszczyć gracza): bryła `fabric` o wymiarach `focus.size`, obręcz `rubber`
  (`size + bagRimExtraM` = 0,02 m, wysokość `bagRimHeightM` = 0,1 m) przy dnie i lina `rubber` (walec o promieniu
  `bagRopeRadiusM` = 0,018 m, 8 ścian) do punktu zawieszenia na wysokości `bagCeilingM` = 5 m nad osią focusu.
  E albo zbocze `attack` (LPM) przy wycelowanym worku nadaje impuls `bagImpulseRadS` = 0,8 rad/s:
  `v.x −= sin(yaw)·0,8`, `v.z −= cos(yaw)·0,8` (yaw gracza). Wahadło X/Z integruje w `step()`:
  `v −= bagGravityRadS2·sin(kąt)·dt` (3,4), `v *= exp(−bagDamping·dt)` (0,75), kąt ograniczony do ±`bagMaxAngleRad`
  (0,5 rad), spoczynek przy |kąt| i |v| < `bagRestEpsilon` (0,001). Render interpoluje poprzedni i bieżący kąt:
  `pivot.rotation.z = −kąt.x`, `pivot.rotation.x = kąt.z`. Reguła `hub_prop_used` z `kind: 'bag'` wybiera miękki dźwięk
  `bagHit`; scena nie pokazuje przy worku żadnego napisu.
- Siedziska (`seat`) opisuje sekcja „Siadanie”.

Każde zaakceptowane użycie (poza `seat`) emituje `hub_prop_used { prop, kind }` (kind ∈ jukebox|noodles|radio|bag).
Cooldown per id: `tuning.hub.propCooldownS = 1`, dla miski `noodlesCooldownS = 20`; radio można wyłączyć mimo cooldownu.
Użycie jukeboxa, miski i radia kończy dymek NPC i anuluje jeszcze nieodegrane powitanie (zob. „Reakcje na powrót”).
Przy otwartej stacji użycie jest odrzucane. Parametry wahadła i wyglądu liny: `tuning.hub.bag*`.
`hub use <propId>` pomija dystans, zachowuje cooldown (dla siedziska przełącza siadanie); `query('hubProps')`
zwraca `{ id, kind, cooldownLeft, track?, angle?: { x, z } }[]`. `hub look <propId>`
ustawia spojrzenie do testu E.

Kamery do sprawdzenia w `?scene=hub&debug=1` (po teleportacji można użyć
`hub look <propId>`):

| Rekwizyt      | Kamera                     |
| ------------- | -------------------------- |
| Szafa grająca | `hub tp -6.8 13.9 180 -10` |
| Makaron       | `hub tp -17 -15.5 0 -16`   |
| Radio         | `hub tp 5 -18.3 180 -24`   |
| Worek         | `hub tp 18.3 0 0 12`       |
| Korytarz      | `hub tp 4.5 -9.75 90 -8`   |

## Migotanie i korytarz północny

`neonTexts[].flicker` korzysta z tego samego schematu i `HubDecor` co napisy
stacji: „NA ANTENIE” łagodnie pulsuje, „TARG” lekko brzęczy, „KWATERY” ma
rzadką awarię co 25 s (parametry: „NA ANTENIE” `pulse` 0,2 / 4 s, „KWATERY” `fail` 0,55 / 25 s, „TARG” `buzz` 0,07 / 0,35 s).
Lampy z migotaniem: dwie lampy korytarza (4,5; 4; −9) i (−17,5; 2,9; −8,8) mają `fail` 0,55 (21 s / 17 s), lampa
nad wejściem na poligon (14; 3,6; −6,2, błękit `#3d7bff`) ma `buzz` 0,08 / 0,3 s. Neony `signs[]`: `iskra` 0,12,
`warsztat` 0,05, `sign_bar` 0,15, `metro` przy peronie B (0; 3,5; 15,9) `buzz` 0,08 / 0,4 s, `metro` na zachodniej
ścianie hali 0,3 (liczba 0..1 to starszy format migotania napisów); pozostałe neony i hologram nie migają.

Trzy strzałki (`floor_arrow` 0,85 × 0,65 m) leżą na podłodze korytarza na y = 0,012 m, z = −9,75 m
(x −15,2 i −7 — yaw +90°, x 1,7 — yaw −90°): dwie kierują ku jadłodajni, jedna ku radiu.
Okładziny `tiles_wall` (odcień `#c9d2e3`) na ścianach poprawiają orientację
bez dodatkowych świateł (nadal 28) i colliderów. Przejście ma ≥ 2 m szerokości.

Opcjonalne `lights[].flicker`, `signs[].flicker` oraz `stations[].sign.flicker`
przyjmują `{ pattern: 'buzz' | 'fail' | 'pulse', strength?: 0..1, periodS?: >0 }`
(dla `signs[]` dopuszczalna jest też sama liczba 0..1 — starszy format).
`CityDressing` aktualizuje światła i napisy teksturowe, `HubDecor.update(frameDt)`
aktualizuje niezależne materiały napisów stacji. Wszystko używa czasu renderu
i osobnych ziaren kosmetycznych. Wyłączenie „Błyski ekranu” zatrzymuje buzz/fail,
zostawia pulse. Domyślne liczby: `tuning.city.flicker*`.
Format, wzory i scena podglądu: [city.md](city.md#wzory-migotania).

Grywalna kryjówka komórki ruchu oporu „Iskra” w nieczynnej stacji metra: scena `?scene=hub`
(`src/scenes/hub.ts`, `HubScene`). Gracz chodzi kontrolerem FPP (ruch, skok, dash, ślizg) bez wrogów, fal i systemów
walki; ręce pokazują ostrze plazmowe w spoczynku (`FppViewModel` z nieruchomym `BladeView`). Podejście do stacji,
spojrzenie na nią i naciśnięcie E otwiera nakładkę UI. Decyzje: `docs/adr/0007-meta-progres-f4.md` pkt 10,
styl: `docs/adr/0006-neon-noir.md`.

## Układ i dane

- `src/data/hub/hideout.json` (`id` `hideout`, `name` „Kryjówka Iskry”, `theme` `hideout`, `playerSpawn` (0; 0; 0,8)), walidowany przez
  `src/world/hubSchema.ts` (`loadHubLayout`). Obecnie: 480 bloków, 4 stacje, 23 NPC, 78 `panels`, 5 `neonTexts`, 8 `signs`, 28 `lights`,
  36 `decals`, 17 `ambientFx`, 42 `decor`, 1 ogień, 8 rekwizytów, 14 stref planu. Format pokoju:
  `playerSpawn`, `blocks` (`material`, `model` `city_*`), pola oprawy z `dressingSchema` (`theme`, `signs`, `lights`,
  `decals`, `ambientFx`, `decor`) plus pola kryjówki:
  - `blocks[].interactive: true` — jasny obiekt interaktywny (materiał `interactive`, #d9dde3);
  - `stations: { id, position {x,z}, radius, focus {position {x,y,z}, size {x,y,z}}, label, sign? }[]` — `id` z `HUB_STATION_IDS`, środek strefy na podłodze;
    `focus` określa środek i dodatnie wymiary bryły obiektu (dla poligonu: wejścia tunelu);
    `sign` (pozycja, rozmiar `{w,h}`, `yaw`, `color?` hex — domyślnie `#ffae1a`, `flicker?`) to neonowy napis z tekstu `label` (płótno, mieszanie addytywne);
  - `neonTexts?: { text, position {x,y,z}, size {w,h}, yaw, color, flicker? }[]` — niezależne napisy oprawy,
    rysowane tak samo jak `sign` stacji; `color` to wyłącznie `#ffae1a`, `#6dff4a`, `#8a5cff`,
    `#3d7bff` lub `#fff1d6`. Oznaczenia: NA ANTENIE, JADŁODAJNIA, KWATERY, RADIO ISKRA i TARG;
  - `blocks[].yaw` — obrót modelu `city_*` wokół środka (wielokrotność 90°; `size` jest już w osiach świata);
    `blocks[].material` ma poza materiałami pokoju także `wood`, `fabric`, `machine`, `paint`, `lacquer`, `plastic`,
    `rubber` i świecące paski `neon_amber|green|violet|blue|white` (bloom);
  - `panels: { kind: 'tiles' | 'screen' | 'poster' | 'tunnel', texture (^[a-z0-9_]+$), position, size, yaw, tileM?, tint? }[]` — okładziny bez collidera:
    `tiles` to kafle ściany (dowolna tekstura z `surfaces/`, powtarzana co `tileM` m, domyślnie 3), `screen` to świecący ekran
    (`screens/screen_*` jako nadruk `mat_screen_*`, bloom), `poster` to nieprzezroczysty plakat, baner albo mural
    (`posters/<texture>.webp`, ładowany przez `HubDecor`, bo `dressingSchema` nie ma tej kategorii), a `tunnel` to
    malowany proceduralnie wylot tunelu (płótno: żebra obudowy, szyny i podkłady zbiegające się w mroku, kable, zielony
    i bursztynowy sygnał; materiał nieoświetlony z bloomem, bez pliku tekstury — `texture` jest tylko nazwą);
  - `npcs: { id, position {x, z, y?}, rotationDeg, animation?, accent, scale?, route?, look?, seat?: { heightM, offset {x,y,z} } }[]` — postacie (sekcja „NPC”);
  - `blocks[].shape: 'barrel'` — otwarta beczka z blachy (walec z obręczami i ciemnym wnętrzem), z koliderem walca;
  - `fires: { position, size? }[]` — płomień w beczce (skrzyżowane płaszczyzny z gradientem, addytywnie, bloom, migotanie w `HubDecor.update`);
  - `props` (rekwizyty — sekcja „Rekwizyty”), `fauna` (sekcja „Zwierzęta”), `zones` (plan stacji — sekcja „Plan stacji”).
- Walidacja układu używa `validateLayout` z `roomSchema.ts` (ta sama co spawny pokoi): środki stref i stojących NPC muszą
  leżeć na podłodze na poziomie `playerSpawn.y`, poza blokami i być osiągalne od `playerSpawn` na siatce 1 m (komórka
  1 × 1 m musi mieścić się w jednym bloku podłogi, więc krawędzie podłóg i przejść leżą na całkowitych współrzędnych;
  cienkie nakładki, np. pasy ostrzegawcze, mają dolną krawędź ponad podłogą i nie są przeszkodą). Dodatkowo: jedna
  stacja każdego `id`, jeden NPC każdego `id`, strefy nie nachodzą na siebie (odległość środków ≥ suma promieni).
  Siedzący NPC (`animation` zaczyna się od `Sitting`) wymaga `seat` i siedziska pod miednicą, więc nie podlega walidacji bloków dla stojących postaci.
- Motyw `hideout` (`src/data/themes/hideout.json`): bez deszczu i burzy (`rain.enabled: false`), bez panoramy miasta
  (`panoramaEnabled: 0`), niebo `skyTop #05070d` / `skyHorizon #1c1612`, ciepła mgła `#241a16` (`fogStrength` 0,85, blisko 6 m, daleko 60 m,
  `heightFogDensity` 0,012), światło otoczenia `hemiSky #6a7898` / `hemiGround #41385c` (`hemiIntensity` 1,4), słabsze światło kluczowe
  `#d8c6a8` (`keyIntensity` 1,1), bloom 0,8 / promień 1,4, winieta 0,28, kolor `interactive` `#d9dde3`, wróg `#e0262b`, gracz
  `#00e5ff`, Rezonans `#ff2bd6`, kontur `#0c1220`. Układ definiuje 28 świateł (limit testu: 28), a
  `CityLights` włącza naraz 8 najbliższych kamery (`tuning.city.maxLights`); reszta to emisja i poświata (neony,
  paski `neon_*`, płomień, lampy w wagonie).

### Wygląd okładzin, napisów, płomieni i beczek (`HubDecor`, `HubScene.buildBlocks`)

Wszystko kosmetyczne, bez colliderów; płaszczyzny patrzą w +Z przy `yaw` = 0. Nieruchome okładziny (kafle, plakaty, ekrany) są scalane po
materiale w komórkach 20 m (`HUB_BATCH_CELL_M`); wylot tunelu, napisy i płomienie zostają osobnymi siatkami.

- `tiles`: materiał standardowy (roughness 0,55, metalness 0), kolor `tint` (domyślnie `#8e9ab0`), tekstura `surfaces/<texture>`
  powtarzana co `tileM` m (domyślnie 3) przez skalowanie UV; kafle o tej samej teksturze i barwie dzielą materiał.
- `screen`: materiał nadruku `mat_<texture>` (świeci w bloomie), UV odwrócone w V, bez konturu.
- `poster`: `/assets/textures/posters/<texture>.webp` (obecne: `banner_iskra`, `mural_spark`, `poster_iskra_recruit`,
  `poster_koalicja_defaced`), roughness 0,85, kolor sRGB, anizotropia 4, `polygonOffset` (−1; −2) dla płaszczyzn przy ścianie; brak pliku
  daje jednolity kolor `#3a4458` i ostrzeżenie w konsoli.
- `tunnel`: płótno 96 px/m, materiał nieoświetlony (`MeshBasic`, bez tone mappingu) z bloomem tylko dla sygnałów. Malowanie: tło `#020308`;
  mgła głębi — gradient radialny wokół punktu zbiegu (x 50%, y 58% wysokości) `#000000` → `#141c30` (8%) → `#0a0f1c` (45%) →
  `#020308`; 9 żeber obudowy (łuki w kolorze `#3a4d74`, coraz mniejsze i słabsze w głąb); 14 podkładów `#1b2233`; dwie szyny
  (gradient `#5d6f94` → `#0a0f1c`); 2 × 2 wiązki kabli `#111827`; dwa sygnały — zielony `#6dff4a` bliżej (po lewej) i bursztynowy
  `#ffae1a` daleko (po prawej) z jasnym rdzeniem `#fff1d6`; górny brzeg przyciemniony. Wyloty: `tunnel_west` (−19,97; 5,5) i
  `tunnel_east` (19,97; 5,5).
- Napisy (`sign` stacji i `neonTexts`): płótno 256 px na metr szerokości; kolor z `color` (domyślnie `#ffae1a`); ramka
  (`max(3 px, 6% wysokości)`) i tekst w `bold monospace` o wysokości 56% płótna (zmniejszany tak, by tekst zajmował najwyżej 86% szerokości),
  wyśrodkowany, poświata `shadowBlur` = 12% wysokości; materiał `MeshBasic` z mieszaniem addytywnym, bloom. Jasność = globalny poziom
  zasilania × migotanie (`sourceFlicker`).
- Ogień (`fires[]`): tekstura 64 × 96 px — kropla płomienia z gradientem `#fff1d6` → `#ffae1a` → przezroczysty; `firePlanes` = 2 płaszczyzny
  obrócone co π/2, rozmiar `size` (domyślnie `fireDefaultSizeM` 0,6; w układzie 0,95 przy (−13,5; 0,95; 11,5)) × `fireHeightRatio` 1,4 w pionie,
  skala `fireSizeScale` 0,45, jasność `fireBrightness` 0,38, krycie `fireOpacity` 0,55, addytywnie, `depthTest` włączony, `depthWrite` wyłączony.
  Migotanie wysokości: `1 + 0,1·sin(φ) + 0,06·sin(2,7·φ + 1,3)`, `φ = czas·7 Hz + indeks·2,1 + płaszczyzna·1,7`
  (`fireFlickerHz`, `fireFlicker*Amplitude`, `fireSeedPhase`, `firePlanePhase`).
- Beczka (`blocks[].shape: 'barrel'`): collider walca (promień `size.x/2`, wysokość `size.y`); widok — otwarty walec `rust` (20 ścian),
  cztery obręcze `metal` (promień ×1,03, grubość 4% wysokości) na poziomach −0,44, −0,22, +0,22, +0,48 wysokości oraz ciemny dysk `rubber`
  (promień ×0,98, grubość 2%) na poziomie +0,36 wysokości jako wnętrze.
- Bloki bez modelu rysują się jako prostopadłościan (materiał `interactive` dla `interactive: true`, inaczej `material`, domyślnie `world`);
  blok z `model` `city_*` zastępuje bryłę modelem ustawionym na dolnej ścianie bloku i obróconym o `yaw`.

## Układ (dwa skrzydła mieszkalne)

Współrzędne: +Z w stronę torów i peronu B, +X na wschód; sufit na 5 m. Obrys podłóg obejmuje
x −34…20, z −19…16. Nowe skrzydła dodają 448 m² podłogi na poziomie 0 (336 m² północ, 112 m² zachód).

| Strefa             | Zakres                       | Zawartość                                                                                                                                                                                                            |
| ------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hala (peron A)     | x −20…20, z −7…3             | główna hala ze spawnem (0; 0,8); tylna ściana: antresola, tablica misji (stacja `missions`, Kapitan Szron), neon ISKRA, automat, kiosk, generator, wejście na poligon w tunelu (x 12,5…15,5; stacja `arena`)         |
| Antresola          | x −20…−11, z −7…−3, y 2,4    | podest z barierką i kolizyjnymi stopniami (12 × 0,2 m, bieg 0,3 m; autostep gracza 0,35 m), skrzynie, pod spodem magazyn z zielonym światłem                                                                         |
| Tory               | z 3…8, dno y −0,8            | niecka z szynami i podkładami; skok (`jumpVelocity` 8 m/s ≈ 1,6 m) wyprowadza z niej na peron, więc nie ma pułapek                                                                                                   |
| Wagon-warsztat     | x −16…−3, z 3…7, podłoga y 0 | wrak wagonu metra na torach: dwoje drzwi od strony hali (x −13…−11 i −8…−6), okna od strony peronu B, stół warsztatowy (stacja `workshop`), ławki, generator, Mira                                                   |
| Kładka             | x 4…7, z 3…8, poziom peronu  | metalowy pomost z barierkami nad torami, łączy halę z peronem B                                                                                                                                                      |
| Peron B            | x −20…20, z 8…16             | zachód: strefa wypoczynku (otwarty bar i neon `sign_bar`, beczka z ogniem i Stary Tomasz, dwie kanapy, stolik, skrzynie, mural `mural_spark`, sznury lampek); środek: automat i kiosk; baner `banner_iskra` na targu |
| Kącik łączności    | x 8…20, z 8…16               | pomieszczenie z wejściem 3 m (z 10…13): szafy serwerowe z ekranami, terminal drzew (stacja `talents`, Doktor Wolan), biurko Bajta z ekranem `screen_comms`, hologram Kurogane, projektor, antena, kable              |
| Przejście północne | x −20…8, z −11…−8            | poprzeczny korytarz 3 m; wejście z hali x 3…6 przez ścianę z −8…−7, wysokość 3,5 m; rozdzielnia i wnęka robocza elektryczki                                                                                          |
| Jadłodajnia        | x −20…−8, z −19…−11          | wejście x −16…−12; budka z makaronem, garnki z parą, menu i neon `noodles`, dwa stoły z czterema ławami na wysokości 0,48 m, zapasy i lampiony; bursztyn/ciepła biel                                                 |
| Kwatery            | x −8…1, z −19…−11            | wejście x −6…−3; trzy łóżka ze skrzyń i materacy `fabric`, zasłony, szafka medyczna, rzeczy osobiste, przygaszona ciepła biel                                                                                        |
| Radio Iskry        | x 1…8, z −19…−11             | wejście x 3…6; biurko z otwartą przestrzenią na nogi, stołek 0,48 m, mikrofon, sześć odbiorników z ekranami, antena i kable; błękit                                                                                  |
| Targ wymiany       | x −34…−20, z 8…16            | wejście przez zachodnią ścianę x −21…−20, z 11…15 (4 m), z dala od baru; `city_stall`, `city_kiosk`, skrzynie, lada handlarza, plandeka, lampki; zieleń/fiolet                                                       |
| Trening w hali     | x 15,1…19, z −3,4…−1,4       | worek `fabric`/`rubber` na linie; wolny kwadrat 2 × 2 m obok                                                                                                                                                         |
| Bar i parkiet      | x −7,5…−1,4, z 11,8…16       | szafa grająca z paskami zieleni/fioletu, parkiet 2 × 2 m, otwarta lada z miejscem dla barmana                                                                                                                        |

Kanapa peronu B stoi pod ścianą południową (stolik i dodatkowy stołek obok), dwie niepalące się beczki stoją na targu,
dzięki czemu wejście z targu ma wolne dojście przez peron. Bar ma neon `sign_bar` i stołki; zamiast pełnego collidera
`city_stall` jest lada, blat, słupki i daszek, z miejscem za ladą. Oznaczenia wnętrz północnych i targu pochodzą z `neonTexts` i ekranów.

Oprawa skrzydła północnego: kwatery mają pięć miejsc do spania (dwie prycze piętrowe),
zasłony, koce z przygaszonymi akcentami tkanin `tiles/tarp`, walizki, dywaniki, ubrania na wieszaku,
pranie pod sufitem, książki, kubki, plakaty, puszkę farby i grzejnik. Dolna prycza mieszkańca zachowuje
siedzisko na 0,48 m. Radio ma wysunięty regał odbiorników z ekranami i błękitnymi paskami, mikrofon
na wysięgniku, słuchawki, mikser, wiązki kabli, wygłuszenie `tarp`/`rubber` i baner Iskry. W korytarzu
są rury, przewody, lampy kratowe co 4 m (naprzemiennie bursztyn i ciepła biel), skrzynki, beczki,
kratkę z parą, kapanie, graffiti, naklejki i malowane strzałki. Światła punktowe korytarza mają
krótki zasięg; kwatery korzystają z dwóch świateł. Mały neon METRO przy treningu (`x 19,9; y 4,15; z −5,2`, 1,6 × 0,8 m) wisi
poza bezpośrednim tłem worka. Kontrola z kamer:
`hub tp -4.5 -12 0 -15`, `hub tp 4.5 -12.5 0 -12`, `hub tp 4.5 -9.75 90 -8`,
`hub tp 15.5 -1 -120 -10`.

### Miejsca mieszkańców i rezerwacje

Miejsca poniżej zajmują mieszkańcy z listy NPC: Kucharka = `hela`, jedzący A–D = `jarek`, `ewa`, `bogna`, `feliks`, radiowa = `lena`,
sanitariuszka = `zofia`, mieszkaniec pryczy = `teo`, elektryczka = `iga`, handlarz = `marek`, wartownik = `grzes`, barman = `rudy`,
tancerka = `nina`, bokser = `witek`; wolnych rezerwacji nie ma.
Wszystkie pozycje mają poziom podłogi y = 0. Obrót NPC: 0 = +Z, 90 = +X, 180 = −Z.
Siedziska mają górną powierzchnię y = 0,48; środek pod miednicą podano w tabeli.
Siedzące postacie używają tego samego `seat.heightM: 0.48` i
`seat.offset: { x: -0.002812, y: -0.48, z: 0.333626 }` co Tomasz i Bajt.

| Rola                           | position {x,z}        | rotationDeg | Siedzisko: środek {x,y,z}, wysokość    |
| ------------------------------ | --------------------- | ----------- | -------------------------------------- |
| Kucharka stojąca               | {x: −17, z: −18,4}    | 0           | —                                      |
| Jedzący A                      | {x: −17,6, z: −13,55} | 180         | {x: −17,6, y: 0,48, z: −13,55}, 0,48 m |
| Jedzący B, naprzeciw A         | {x: −17,6, z: −16,05} | 0           | {x: −17,6, y: 0,48, z: −16,05}, 0,48 m |
| Jedzący C, drugi stół          | {x: −10,5, z: −13,55} | 180         | {x: −10,5, y: 0,48, z: −13,55}, 0,48 m |
| Jedzący D, drugi stół          | {x: −10,5, z: −16,05} | 0           | {x: −10,5, y: 0,48, z: −16,05}, 0,48 m |
| Radiowa siedząca               | {x: 5, z: −15,9}      | 180         | {x: 5, y: 0,48, z: −15,9}, 0,48 m      |
| Sanitariuszka klęcząca         | {x: −3,5, z: −13,4}   | 90          | wolny kwadrat 1 × 1 m przy łóżku       |
| Mieszkaniec na krawędzi pryczy | {x: −6,5, z: −16,4}   | 0           | {x: −6,5, y: 0,48, z: −16,4}, 0,48 m   |
| Elektryczka kucająca           | {x: −10, z: −8,7}     | 0           | wolny kwadrat 1 × 1 m przed puszką     |
| Handlarz                       | {x: −25, z: 15,4}     | 180         | —                                      |
| Wartownik przy wejściu         | {x: −22,5, z: 10,7}   | 0           | —                                      |
| Barman                         | {x: −3, z: 15,2}      | 180         | —                                      |
| Tancerka                       | {x: −6,5, z: 12,8}    | 180         | wolny kwadrat 2 × 2 m                  |
| Bokser                         | {x: 17,35, z: −2,4}   | 90          | wolny kwadrat 2 × 2 m                  |

### Trasy piesze

Punkty `(x, z)` mają y = 0 i są łączone odcinkami prostymi. Trasy ii i iii są zamknięte,
trasę i Kuba przechodzi w obu kierunkach (`pingpong`, bez postoju). Paweł korzysta z trasy ii
(`loop`, `Walk_Loop`, postoje 1,5 s), Ola i Staś z trasy iii (`loop`, `Jog_Fwd_Loop`, 2,2 m/s,
bez postoju). Ola zaczyna w (0,5; 11), Staś w przeciwległym (6; 13,5), z tą samą kolejnością obiegu.
W danych pętle nie powtarzają pierwszego punktu na końcu — zamyka je `mode: loop`.
Wszyscy chodzący mają `pauseAnimation: Idle_Loop`, aby podczas postoju i zatrzymania na rozmowę stać w miejscu.
Kuba i Paweł idą z domyślną prędkością `npcWalkSpeedMS` (1,3 m/s), Kuba bez postoju (`pauseS` 0, `pingpong`).
Korytarze mają co najmniej 2 m szerokości; test
`hubLayout.test.ts` sprawdza podłogę, metr odstępu od brył i 0,9 m od obecnych oraz zarezerwowanych NPC
wzdłuż całych odcinków (próbki co najwyżej 0,1 m).

| Trasa                                                    | Kolejne punkty (x, z)                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| i: targ → peron B → kładka → hala → północ → jadłodajnia | (−30, 13) → (−10, 13) → (−10, 11) → (5.5, 11) → (5.5, −2.5) → (4.5, −2.5) → (4.5, −9.75) → (−14, −9.75) → (−14, −12.5) |
| ii: pętla hali                                           | (−7, −2.5) → (6, −2.5) → (6, −0.5) → (−7, −0.5) → (−7, −2.5)                                                           |
| iii: pętla dzieci na peronie B                           | (0.5, 11) → (6, 11) → (6, 13.5) → (0.5, 13.5) → (0.5, 11)                                                              |

Kamery kontrolne nowych stref (`?scene=hub&debug=1`; yaw kamery 0 = −Z, pitch ujemny = w dół):

| Strefa       | Komenda                   | Co sprawdzić                                                    |
| ------------ | ------------------------- | --------------------------------------------------------------- |
| Jadłodajnia  | `hub tp -14 -12.5 0 -12`  | dwa stoły, ławy 0,48 m, kuchnia z parą i zapasami               |
| Kwatery      | `hub tp -4.5 -12 0 -15`   | materace, odsłonięta krawędź pryczy, miejsce przy łóżku polowym |
| Radio Iskry  | `hub tp 4.5 -12.5 0 -12`  | mikrofon, odbiorniki, stołek i przestrzeń na nogi               |
| Korytarz     | `hub tp 4.5 -9.75 90 -8`  | wolny korytarz, przejścia do stref, rozdzielnia na końcu        |
| Targ         | `hub tp -22 13 90 -10`    | stragany, plandeka, miejsce za ladą, przejście na peron         |
| Trening      | `hub tp 15.5 -1 -120 -10` | worek na linie i wolne miejsce obok                             |
| Bar / taniec | `hub tp -6.5 11 180 -10`  | szafa grająca, parkiet i otwarta przestrzeń barmana             |

Znacznik warsztatu używa zieleni `#6dff4a`, a znacznik nieznanej stacji ciepłej bieli `#fff1d6`, zgodnie z ADR 0006.

Wszystkie perony i przejścia są na poziomie 0, więc strefy są osiągalne bez skoków (podwójny skok jest talentem);
antresola jest opcjonalna. Na obu końcach niecki torów (x ±20, z 3…8) są wyloty tunelu (`panels` kind `tunnel`) z parą
z niecki i kapaniem. Każda stacja ma własny kolor widoczny z daleka: misje bursztyn (napis `MISJE` `#ffae1a` nad tablicą),
warsztat zieleń (neon `warsztat`; stacja nie ma `sign`), talenty fiolet (napis `TALENTY` `#8a5cff` nad wejściem do kącika łączności),
poligon błękit (napis `POLIGON` `#3d7bff` i światło nad wejściem). Na blacie warsztatu stoją pomniejszone modele (`city_generator`, `city_crates`). Neony `iskra`, `warsztat`, `sign_bar` i `metro`, ekrany `screen_talents`, `screen_missions`,
`screen_comms`, `screen_status`, `screen_menu`, `screen_map`, `screen_news`, plakaty `poster_iskra_recruit` i
`poster_koalicja_defaced` na hali, graffiti; para z kratki, kapanie, iskry (także z beczki), lampiony, kable i paski
neonowe na filarach.

## Stacje i strefy

`selectHubTarget`, `selectHubFocus` i `HubStations` (`src/world/hubStations.ts`, bez DOM i Three.js, testowalne w Vitest):

- wybór (`selectHubTarget`: stacje, NPC i rekwizyty razem, w tej kolejności przy remisie; `selectHubFocus` zwraca tylko stację) wymaga przecięcia promienia z oka
  gracza w kierunku kamery (yaw + pitch; kierunek `(−sin yaw·cos pitch, sin pitch, −cos yaw·cos pitch)`) z AABB `focus` stacji, NPC lub rekwizytu, powiększonym z każdej strony o `tuning.hub.focusPaddingM` (0,2 m). Odległość od oka
  do trafienia musi być ≤ `tuning.hub.interactRangeM` (3,5 m). Wygrywa najbliższe trafienie,
  także z bliska i przy spojrzeniu w dół. Wysokość oka uwzględnia przysiad;
  `radius` nie ogranicza interakcji (służy walidacji rozłączności stref i średnicy pierścienia znacznika);
- przy celu NPC lub Węgielku `HubScene` sprawdza promień Rapierem do trafienia w AABB. Bryła otoczenia
  przed celem ukrywa podpowiedź i blokuje E. Plakat Iskry w hali wisi powyżej schodów na antresolę,
  a ekran na zachodniej ścianie jest odsunięty od drzwi;
- samo wejście w promień niczego nie otwiera. Dopiero zbocze naciśnięcia E (istniejąca akcja `power2`,
  nazwana w scenie `HUB_INTERACT_ACTION`) otwiera wybraną stację i emituje `hub_station_opened { station }`;
  `HubScene` nasłuchuje tego zdarzenia i pokazuje nakładkę przez `HubScreens.show`;
- `HubPrompt` (`src/ui/hubPrompt.ts`) pokazuje klawisz E w ramce i `label` stacji lub rekwizytu na środku dolnej części ekranu
  (dla NPC: „Porozmawiaj” z imieniem NPC jako małym podpisem nad etykietą, trzeci argument `update`; podczas siedzenia: „Wstań”).
  Wygląd: nakładka `fixed`, środek poziomo, `bottom: 22%`, siatka 30 px (okrągły znacznik klawisza 28 px z obwódką `#00e5ff90`, litera E
  `600 18px Rajdhani` w kolorze `#00e5ff`) + etykieta (`600 18px Rajdhani`, wielkie litery, odstęp liter 0,12 em, kolor `#edf7ff`);
  nad etykietą mały podpis 9 px (`#8faebc`, wielkie litery, odstęp 0,18 em) — domyślnie „Interakcja”, dla NPC imię; pod spodem cienka linia
  gradientowa `#00e5ffb0` → przezroczysta; wejście 0,18 s (przesunięcie o 8 px w górę, zanik), wyłączone przy `prefers-reduced-motion`.
  Podpowiedź znika przy braku celu w celowniku lub otwartej nakładce/planie; podczas dymka NPC jest ukryta. Teksty: sekcja `hub` w
  `src/data/ui/meta.pl.json`; aktualizacja DOM podpowiedzi odbywa się podczas renderowania;
- przy otwartej stacji gracz stoi w miejscu (scena nie krokuje kontrolera ani fizyki), a kursor jest zwolniony
  (`HtmlHubScreens.show` robi `exitPointerLock`, jak ekrany runu);
- przy otwartej nakładce E nic nie robi. Po zamknięciu nowe naciśnięcie E może otworzyć tę samą stację
  bez wychodzenia ze strefy; nie ma histerezy ani automatycznego ponownego otwierania. Pierwszy snapshot wejścia
  po zamknięciu ignoruje interakcję, aby odrzucić zaległe E z czasu pauzy, gdy pętla nie wykonywała kroków;
- zamknięcie (`Zamknij`, Esc, `hub close`) wywołuje `ctx.resume`, więc gra wraca do przechwyconej myszy.
- Otwarta odprawa misji (`[data-mission-debrief][open]`) działa jak otwarta stacja: `main.ts` (`ownsInterface`) nie otwiera nad nią menu pauzy, a `HubScene` wstrzymuje ruch i powitanie po powrocie do zamknięcia odprawy (opcja `debriefOpen` w testach).

Stacje (`HUB_STATION_IDS`: `talents`, `workshop`, `missions`, `arena`; wartości z `hideout.json`):

| id         | label    | opis                              | strefa: środek (x; z), promień | focus: środek (x; y; z) → wymiary (x × y × z) | napis `sign` (pozycja; rozmiar; yaw; kolor)    |
| ---------- | -------- | --------------------------------- | ------------------------------ | --------------------------------------------- | ---------------------------------------------- |
| `workshop` | WARSZTAT | stół w wagonie-warsztacie         | −9,5; 4,4; r 2                 | −9,5; 0,475; 6,2 → 2,6 × 0,95 × 1,1           | brak (neon `warsztat` z `signs`)               |
| `missions` | MISJE    | tablica misji w hali              | −6; −4,4; r 2,4                | −6; 1,2; −6,85 → 3,2 × 2,4 × 0,3              | (−6; 3,05; −6,94); 2,4 × 0,6; 0; `#ffae1a`     |
| `talents`  | TALENTY  | terminal drzewek, kącik łączności | 14,05; 13,6; r 2               | 14,05; 1; 15,65 → 1,3 × 2 × 0,7               | (7,95; 3,4; 11,5); 2,6 × 0,65; −π/2; `#8a5cff` |
| `arena`    | POLIGON  | wejście w tunel na poligon        | 14; −4,8; r 2                  | 14; 1,75; −7,2 → 3 × 3,5 × 0,6                | (14; 4,1; −6,94); 2,8 × 0,7; 0; `#3d7bff`      |

Nad każdą stacją wisi znacznik `HubStationMarkers` (`src/render/hubStationMarkers.ts`): pływający napis `label` (sprite 4,6 m szerokości,
płótno 512 × 176 px, `700 92px Rajdhani`, poświata i strzałka w dół, rysowany bez testu głębi, `renderOrder` 30), wąski świecący słup od
podłogi (walec r 0,035 m, krycie 0,32, addytywnie) i pierścień strefy na podłodze (szerokość 0,09 m przy promieniu strefy, krycie 0,55, pulsuje
`0,8 + 0,2·sin(2,4·t)`). Wysokość napisu: `max(3,3 m, góra focusu + 1,5 m)`, kołysze się o ±0,09 m (`sin(1,6·t)`). Kolor: `sign.color`, a bez niego
workshop `#00e5ff`, missions `#ffae1a`, talents `#8a5cff`, arena `#3d7bff`. Krycie rośnie z odległością od strefy: 0,3 przy stacji
(odległość od krawędzi strefy ≤ 2,5 m), gładko do 1,0 po dalszych 6 m.

## NPC

23 postacie (nie wrogowie; 23 wpisy tekstów w `npcs.pl.json`). Pięć kluczowych: Mira (mechaniczka, wagon-warsztat), Doktor Wolan (badaczka Rezonansu, przy terminalu),
Kapitan Szron (koordynator, przy tablicy misji), Bajt (haker, siedzi przy ekranach w kąciku łączności), Stary Tomasz
(weteran, siedzi przy beczce z ogniem).

Kluczowi (bez `look`; strój roli w `KEY_OUTFITS`, każdy z unikalnym akcentem; `position.y` = 0):

| id     | Miejsce                           | position (x; z) | rotationDeg | animation         | accent | nakrycie głowy    |
| ------ | --------------------------------- | --------------- | ----------- | ----------------- | ------ | ----------------- |
| mira   | wagon-warsztat, przy stole        | −7,4; 5,4       | 90          | Idle_Loop         | green  | opaska (`mira`)   |
| wolan  | przy terminalu drzewek            | 15,9; 14,6      | 300         | Idle_Loop         | violet | gogle (`wolan`)   |
| szron  | przy tablicy misji                | −3,2; −5,4      | 240         | Idle_Loop         | amber  | czapka z paskiem  |
| bajt   | biurko w kąciku łączności, siedzi | 18,4; 12        | 90          | Sitting_Idle_Loop | blue   | słuchawki         |
| tomasz | przy beczce z ogniem, siedzi      | −11,8; 11,5     | 270         | Sitting_Idle_Loop | white  | czapka z naszywką |

18 mieszkańców poniżej ma `position.y = 0`; pozycja chodzących oznacza początek trasy.
Wszystkie miejsca i kierunki odpowiadają przygotowanym rekwizytom, bez korekt współrzędnych.

| id     | Miejsce / zajęcie              | position (x; z) | rotationDeg | animation            | look: shade / headwear / torso / prop |
| ------ | ------------------------------ | --------------- | ----------- | -------------------- | ------------------------------------- |
| hela   | kuchnia, za ladą               | −17; −18,4      | 0           | Idle_Loop            | 5 / bandana / apron / none            |
| jarek  | ława przy pierwszym stole      | −17,6; −13,55   | 180         | Sitting_Talking_Loop | 1 / headphones / jacket / satchel     |
| ewa    | przeciwległa ława              | −17,6; −16,05   | 0           | Sitting_Idle_Loop    | 6 / hood / jacket / pouches           |
| bogna  | drugi stół, ława               | −10,5; −13,55   | 180         | Sitting_Talking_Loop | 7 / bandana / apron / none            |
| feliks | drugi stół, przeciwległa ława  | −10,5; −16,05   | 0           | Sitting_Idle_Loop    | 4 / glasses / vest / toolbelt         |
| lena   | radio, stołek przed mikrofonem | 5; −15,9        | 180         | Sitting_Talking_Loop | 8 / headphones / vest / none          |
| zofia  | przy łóżku polowym             | −3,5; −13,4     | 90          | Fixing_Kneeling      | 4 / none / coat / satchel             |
| teo    | krawędź pryczy                 | −6,5; −16,4     | 0           | Sitting_Idle_Loop    | 9 / cap / coat / none                 |
| iga    | rozdzielnia w korytarzu        | −10; −8,7       | 0           | Crouch_Idle_Loop     | 7 / goggles / vest / toolbelt         |
| marek  | za ladą na targu               | −25; 15,4       | 180         | Idle_Talking_Loop    | 6 / beanie / coat / satchel           |
| grzes  | wejście na targ                | −22,5; 10,7     | 0           | Idle_Torch_Loop      | 2 / cap_stripe / jacket / pouches     |
| rudy   | za barem                       | −3; 15,2        | 180         | Idle_Loop            | 5 / none / apron / none               |
| nina   | parkiet                        | −6,5; 12,8      | 180         | Dance_Loop           | 9 / glasses / jacket / none           |
| witek  | przed workiem treningowym      | 17,35; −2,4     | 90          | Punch_Jab            | 0 / bandana / vest / none             |
| kuba   | trasa i                        | −30; 13         | 90          | Walk_Loop            | 3 / beanie / vest / backpack          |
| pawel  | trasa ii                       | −7; −2,5        | 90          | Walk_Loop            | 7 / cap_stripe / jacket / pouches     |
| ola    | trasa iii, scale 0,68          | 0,5; 11         | 90          | Jog_Fwd_Loop         | 8 / beanie / hoodie / backpack        |
| stas   | trasa iii, scale 0,6           | 6; 13,5         | 270         | Jog_Fwd_Loop         | 2 / cap / hoodie / none               |

- **Dane:** `hideout.json` → `npcs: { id, position {x, z, y?}, rotationDeg, animation?, accent, scale?, seat?, route?, look? }[]`
  (`hubNpcSchema`, `src/world/hubSchema.ts`). `rotationDeg` to kierunek patrzenia na podłodze: 0 = +Z (w stronę
  torów), 90 = +X, 180 = −Z. `animation` to klip z `public/assets/models/npc_anims.glb` (`Idle_Loop`, `Idle_Talking_Loop`,
  `Idle_Torch_Loop`, `Sitting_Idle_Loop`, `Sitting_Talking_Loop`, `Fixing_Kneeling`, `Crouch_Idle_Loop`, `Interact`, `Walk_Loop`, `Jog_Fwd_Loop`, `Dance_Loop`, `PickUp_Table`,
  `Punch_Jab`, `Punch_Cross`, `Sword_Idle`, `Spell_Simple_Idle_Loop`, `Push_Loop`;
  domyślnie `Idle_Loop`), `accent` ∈ `amber|green|violet|blue|white` (paleta ADR 0006; pięć kluczowych NPC
  zachowuje unikalne akcenty, wśród mieszkańców rozkład amber/green/violet/blue/white wynosi 4/4/4/3/3). Akcenty to kolory
  `#ffae1a`, `#6dff4a`, `#8a5cff`, `#3d7bff`, `#fff1d6`.
- **Wygląd z danych:** opcjonalne `look` zawiera wyłącznie opcjonalne pola:
  `shade` — liczba całkowita 0–9; `headwear` — `none|cap|cap_stripe|beanie|goggles|glasses|headphones|bandana|hood`;
  `torso` — `vest|apron|coat|jacket|hoodie|none`; `prop` — `none|pouches|backpack|wrench|satchel|toolbelt`.
  `torso` wybiera wariant stroju z `npc_civilian.glb` (`npcOutfit`, `src/scenes/hubNpcs.ts`):
  `none` — sama koszula (`top_shirt`), `vest` — koszula + kamizelka (`over_vest`), `apron` — koszula + fartuch
  (`over_apron`: panel od piersi do kolan, pasek na karku, troki), `jacket` — kurtka ze stójką (`top_jacket`),
  `hoodie` — bluza z kieszenią i zsuniętym kapturem (`top_hoodie`), `coat` — płaszcz z połami do kolan i rozcięciem
  (`top_coat`). Zawsze widoczne są `civ_skin` (głowa i dłonie), `civ_pants` i `civ_boots`. `headwear: hood` pokazuje
  kaptur na głowie (`head_hood`, odsłania twarz); pozostałe nakrycia głowy to proste bryły w kodzie na kości `DEF-head`
  (czapki, gogle z okrągłymi szkłami, okulary, słuchawki, bandana). `prop` pokazuje `prop_<nazwa>`: saszetki przy pasie,
  plecak z paskami i ekranikiem, torba na ukos przy lewym biodrze, pas z kieszeniami i narzędziami, klucz.
  Brak odcienia zachowuje dotychczasowy wybór z pierwszych pięciu kolorów według kolejności NPC;
  brak rekwizytu bierze strój roli per id (niżej), brak `torso` daje kamizelkę. Jawne `none` pomija daną część.
  Pięć kluczowych postaci nie ma `look`; ich strój roli jest w `KEY_OUTFITS`: Mira — kamizelka, saszetki i klucz,
  Wolan — płaszcz i gogle, Szron — kurtka z pagonami i naszywką (`role_szron`) oraz czapka z paskiem,
  Bajt — kamizelka, plecak z ekranikiem i słuchawki, Tomasz — kamizelka, saszetki i czapka z naszywką.
  Paleta ma 10 ciemnych odcieni grafitu, granatu, szarości, oliwki, brązu i śliwki: `#3b4254`, `#2f3f66`, `#424856`, `#2c3f63`, `#4a4e5a`,
  `#4b5040`, `#50463c`, `#383c34`, `#55585c`, `#484052` (`look.shade` barwi wierzchnią
  warstwę: kamizelkę, fartuch, kurtkę, bluzę, płaszcz, kaptur; materiał toon z gradientem, dwustronny); sąsiedzi mają różne odcienie.
  Wierzchnia warstwa ma poświatę krawędzi w akcencie: `emisja += akcent · 0,55 · (1 − |dot(normalna, kierunek do kamery)|)^2,6`. Koszule i spodnie
  dobiera deterministycznie id NPC (hash FNV-1a z `id + ':shirt'` / `id + ':pants'`) z `tuning.hub.npcShirtColors` (`#5b5852`, `#4f535a`,
  `#625a50`, `#4a4844`) / `npcPantsColors` (`#20232b`, `#272624`, `#1c2130`); buty, skóra, rekwizyty i metal: `npcBootsColor` `#141416`,
  `npcSkinColor` `#8a8279`, `npcGearColor` `#2f2c28`, `npcMetalColor` `#6d737b` (materiały toon, dwustronne).
  Akcent NPC (bursztyn, zieleń, fiolet, błękit, ciepła biel) to tylko mały świecący detal (zamek kurtki i kamizelki,
  troki bluzy, ekranik plecaka, klamra pasa, naszywka) i słaba poświata krawędzi wierzchniej warstwy; bez czerwieni,
  cyjanu i magenty. Geometrie brył nakryć głowy są współdzielone pomiędzy NPC w jednym `HubNpcs` i zwalniane raz
  przy `dispose`; materiały skóry, butów, koszul, spodni i rekwizytów są wspólne (klucz: kolor).
- **Siedziska:** dla siedzących `position` oznacza punkt na podłodze pod miednicą i środkiem siedziska.
  `seat.heightM` to wysokość jego górnej powierzchni nad tym punktem, a `seat.offset` to wektor od środka tej
  powierzchni do korzenia modelu, w lokalnych osiach NPC. `npcRootPosition` obraca offset wraz z tułowiem,
  zachowując miednicę nad nieruchomym stołkiem. Focus i kolider pozostają przy `position`.
  Pomiar `node tools/hub/measureSeatedPose.mjs` odtwarza klipy `npc_anims.glb` na `npc_civilian.glb` (ten sam
  szkielet i skala co manekin wrogów; podeszwa liczona z `civ_boots`):
  miednica `DEF-hips` ma lokalne położenie `(0,002812; 0,543908; −0,333626) m`, podeszwa `−0,000613 m`.
  Dla obu pętli siedzenia stołek ma wysokość `0,48 m`, offset korzenia `(−0,002812; −0,48; 0,333626) m`;
  miednica leży `0,063908 m` nad siedziskiem, stopy na podłodze. Biurko Bajta ma otwartą przestrzeń na nogi.
  `hubSeating.test.ts` sprawdza prawdziwy klip w 121 próbkach i trzech kątach tułowia: ±0,08 m nad siedziskiem,
  podparcie w X/Z oraz obie stopy i skórkowaną podeszwę przy podłodze.
- **Wygląd (`src/scenes/hubNpcs.ts`, `HubNpcs`):** cywil `public/assets/models/npc_civilian.glb` (Blender,
  `build_npc_civilian` w `tools/blender/build_assets.py`; opis w `docs/assets.md`) na szkielecie manekina UAL — ta sama
  skala, kości i położenie stóp co `enemy_trooper.glb`, więc klipy `npc_anims.glb` i siedziska działają bez zmian.
  Strój to skórowane, dopasowane do sylwetki siatki (koszula/kurtka/bluza/płaszcz, kamizelka/fartuch, spodnie,
  buty, kaptur) zamiast brył przypiętych do pojedynczych kości; dawne prostopadłościany ubioru (`dressBody`:
  kamizelka-pudło, kołnierz, pas, bloki barków, klapy, ładownice) — przyczyna zgłoszonych „kwadratów” — zniknęły.
  `load()` klonuje model, usuwa części spoza `npcOutfit(def)`, podmienia materiały po nazwie (`mat_npc_outer`,
  `mat_npc_shirt`, `mat_npc_pants`, `mat_npc_boots`, `mat_npc_skin`, `mat_npc_gear`, `mat_npc_metal`,
  `mat_npc_accent`) i wiąże wszystkie skórowane części z jednym szkieletem (jedna aktualizacja kości na NPC).
  Tkaniny są dwustronne (otwarte rękawy, brzegi). Klipy bezczynne z `npc_anims.glb` (wycięte z Quaternius UAL CC0 skryptem
  `tools/hub/extractNpcAnimations.mjs`, 2 851 548 bajtów; źródło `tools/blender/sources/ual/`), przesunięte w czasie
  (start klipu = hash(id) · długość klipu) i lekko różne tempem (0,92 + hash(id + `!`) · 0,16), żeby NPC nie byli zsynchronizowani.
  Głowa i szyja obracają się o yaw rozdzielony 60% / 40% (`DEF-head` / `DEF-neck`). Bez modelu (testy, `loadModels: false`) zostają collider i dialog.
- **Obrót do gracza:** w zasięgu `tuning.hub.npcTurnRangeM` NPC obraca głowę i szyję (kości `DEF-head`, `DEF-neck`;
  obrót wokół osi Y świata, `npcHeadMaxRad` 1 rad, prędkość 2,5 × `npcTurnSpeedRadS`) i powoli tułów (`npcTurnSpeedRadS` 2 rad/s, do `npcStandBodyMaxRad` 1,9 rad /
  `npcSeatedBodyMaxRad` 0,5 rad od kierunku bazowego; zasięg `npcTurnRangeM` 4,5 m); po odejściu gracza wraca do pozy bazowej. Czysta logika:
  `updateNpcLook` (`src/world/hubNpcs.ts`).
  Cel spojrzenia to domyślnie gracz; w podsłuchanej rozmowie wieloosobowej (`HubChatter.lookTargetFor`) słuchacze
  patrzą na aktualnie mówiącego uczestnika (także w przerwie między kwestiami), mówiący na najbliższego innego
  uczestnika — tym samym `updateNpcLook` (parametr celu), w dotychczasowych limitach głowy i tułowia. Rozmowy
  jednoosobowe i powitania (`arrival`) patrzą na gracza jak dotąd, a NPC w rozmowie z graczem przez dymek zawsze
  patrzy na niego (dymek ma pierwszeństwo). Podczas dymka NPC z bazą `Idle_Loop` / `Sitting_Idle_Loop` gra
  `Idle_Talking_Loop` / `Sitting_Talking_Loop` (jak mówiący w podsłuchanej rozmowie), potem wraca do bazowej.
- **Kolizja:** statyczny NPC ma nieruchomy collider walca (promień 0,4 m; 1,8 m wysokości, siedzący 1,35 m), grupa świata.
  `focus` NPC wylicza `npcFocusBox` z tego kolidera.
- **Rozmowa:** spojrzenie na NPC w zasięgu pokazuje „[E] Porozmawiaj” z imieniem; E pokazuje u dołu ekranu dymek
  (`HubDialog`, `src/ui/hubDialog.ts`, styl „wizjer”): imię, rola i jedna kwestia. Wygląd: `fixed`, środek poziomo, `bottom: 9%`, szerokość
  `min(640 px, 100vw − 32 px)`, tło poziomy gradient `transparent → #070b16c8 (14%) → #070b16c8 (86%) → transparent`, cienka górna linia
  `#ffae1a90` i dolna `#00e5ffb0` (8% marginesu z każdej strony); imię `700 22px Rajdhani`, wielkie litery, odstęp 0,14 em, kolor `#ffae1a`;
  rola 10 px, `#8faebc`, odstęp 0,2 em; kwestia `500 19px Rajdhani`; wejście 0,2 s (8 px w górę + zanik, wyłączone przy `prefers-reduced-motion`),
  `role="status"`, `aria-live="polite"`, nie przechwytuje myszy; każda nowa kwestia restartuje animację. Kolejne E (na tego samego NPC)
  daje następną kwestię w pętli (`NpcDialogue`, osobny licznik na NPC), dymek znika po `tuning.hub.npcLineS` (5 s) albo
  po odejściu gracza dalej niż zasięg interakcji + 1 m (w płaszczyźnie XZ od pozycji NPC; `hub talk` tego nie sprawdza); rozmowa zatrzymuje
  chodzącego adresata, przerywa podsłuchaną rozmowę i zastępuje poprzedni dymek; otwarcie stacji też go zamyka. Podczas rozmowy podpowiedź
  jest ukryta. Teksty: `src/data/hub/npcs.pl.json` (`{ talkPrompt, npcs: [{ id, name, role, lines[] }] }`, schemat
  `npcTextsSchema`; id muszą pasować do `hideout.json`).

### Skala, trasy i podsłuchane rozmowy

- `scale` jest opcjonalne (0,55–1,15; domyślnie 1; Ola: 0,68, Staś: 0,6). Skaluje model, promień i wysokość
  walca, focus oraz lokalny `seat.offset`. `seat.heightM` pozostaje fizyczną wysokością istniejącego siedziska.
- `route`: `points` (co najmniej 2 punkty X/Z), `mode` (`loop`, domyślnie, albo `pingpong`),
  `speedMS` (domyślnie `npcWalkSpeedMS`), `pauseS` (domyślnie 0, także w punkcie startowym),
  `moveAnimation` (domyślnie `Walk_Loop`) i `pauseAnimation` (domyślnie animacja NPC albo `Idle_Loop`).
  `position` musi równać się pierwszemu punktowi; trasa wyklucza siedzenie i animacje siedzące.
- `stepNpcRoute` i `NpcRuntime` w `src/world/hubNpcs.ts` działają w stałym kroku bez Three.js/DOM/RNG.
  Stan trasy (pozycja, segment, kierunek, yaw, pozostały postój, ruch) można zapisać jako JSON.
  Tułów obraca się z `npcWalkTurnRadS`. Gracz w stożku kierunku ruchu (`npcYieldConeCos`) bliżej niż
  `npcYieldRadiusM` zatrzymuje NPC do zwolnienia drogi. Strefa kontaktu: NPC też czeka, gdy w następnym kroku odległość pozioma
  od gracza spadłaby poniżej promienia walca NPC (ze `scale`) + `player.capsuleRadius` + `npcContactMarginM`
  (0,15 m), chyba że gracz jest ponad 0,2 m za nim wzdłuż kierunku ruchu; dzięki temu kinematyczny walec
  nie wlecze stojącego obok gracza. Dymek E zatrzymuje adresata i kieruje jego wzrok
  do gracza; po dialogu postać wraca na trasę. Statyczni NPC zachowują dotychczasowy zakres patrzenia,
  ale stan obrotu jest teraz aktualizowany w `step`, a nie w renderze.
- Trasy mają walce na `kinematicPositionBased`, przesuwane przed krokiem świata fizyki; zatrzymują
  character controller gracza tak samo jak statyczne walce. Focus i debug używają bieżącej pozycji.
  Render interpoluje poprzednią i bieżącą pozycję oraz yaw (najkrótszy łuk). Zmiana klipu używa
  `npcAnimFadeS`; klipy stanów, także `PickUp_Table` i `Punch_*`, są zapętlone. Użycie miski uruchamia
  osobny, jednorazowy `Interact` z `npc_anims.glb` dla Heli. `HubPropView` rysuje miskę z zupą na ladzie
  i przesuwa ją podczas gestu według fazy klipu. Postęp podawania (czas klipu i przesuw miski) idzie czasem symulacji (`HubNpcs.step`, wołane z `HubScene.step`), więc pauza go zatrzymuje, a render tylko interpoluje; podczas podawania tułów Heli wraca do `baseYaw` w stanie symulacji (`NpcRuntime.faceBase`), po klipie crossfade wraca do poprzedniej animacji, a sklonowany klip jest zwalniany (`uncacheAction` + `uncacheClip`). Geometria i kolory miski są w `src/data/hub/interactions.json` (schemat `hubInteractionsSchema`), przesuw i ułamki klipu w `tuning.hub.soup*`. Ekstraktor zeruje
  poziome translacje kości `root` w `Walk_Loop` i `Jog_Fwd_Loop`: przesunięcie pochodzi tylko z trasy.
- Wstawki animacji (`NPC_IDLE_VARIETY`, `src/world/hubNpcs.ts`): NPC bez trasy, którzy nie mówią (dymek
  ani podsłuchana rozmowa), co `tuning.hub.npcIdleVarietyS` ([18, 45] s; pierwsza wstawka z losowym
  przesunięciem) grają przez `npcIdleVarietyLenS` ([3, 5] s) klip z puli bazowej (`Idle_Loop` →
  `Idle_Talking_Loop`/`Interact`/`PickUp_Table`; `Idle_Talking_Loop` → `Idle_Loop`/`Interact`;
  `Sitting_Idle_Loop` ↔ `Sitting_Talking_Loop`), potem wracają do bazowej; inne klipy bazowe i chodzący
  nie mają wstawek. Losowość z `ctx.rng.fork('hub-npc-idle:<id>')`; rozmowa przerywa wstawkę.
  `query('npcs')` zwraca bieżący `clip`.
- Walidacja sprawdza punkty i odcinki co `npcRouteSampleM` (0,25 m), w `loop` również ostatni→pierwszy:
  podłoga na `playerSpawn.y`, zapas promienia walca od krawędzi i bloków, co najmniej
  `npcRouteStaticClearanceM` (0,9 m) od statycznych NPC. Istniejąca walidacja osiągalności startu pozostaje.
- Odległe od kamery postacie (ponad `npcAnimFarM`, 18 m) krokują mixer co `npcAnimFarFrames` (3) klatki,
  sumując dt. Interpolacja pozycji nadal działa co klatkę; pętla widoków nie tworzy obiektów tymczasowych.
- Cullowanie NPC: siatka ciała ma `frustumCulled` i stałą sferę (`npcBoundsCenterM`, `npcBoundsRadiusM`,
  zweryfikowaną testem na pozach wszystkich klipów); akcesoria na kościach są cullowane domyślnie.
  `HubNpcs.cull(camera)` (po ustawieniu kamery w klatce) testuje sferę NPC z zapasem `npcCullMarginM`.
  NPC poza kadrem krokuje mixer co `npcAnimFarFrames` (bliski) lub `npcAnimHiddenFrames` (20, dalszy niż
  `npcAnimFarM`), sumując dt; wracający do kadru dostaje zaległy dt od razu, bez skoku. NPC nie rzucają
  cieni. Debug: `query('hubNpcVisible')` — liczba NPC w kadrze.
- Siatki na NPC: 3 stałe (skóra, spodnie, buty), 1–4 części stroju (góra, nakładka, akcent), 0–6 rekwizytów
  i 0–5 brył nakrycia głowy — zwykle 6–12 wywołań rysowania. Model ma ok. 7700 trójkątów ze wszystkimi
  wariantami; po usunięciu nieużywanych części NPC rysuje ok. 3,7–4,3 tys. (skóra 1867, spodnie 622, buty 392, góra 744–920).
- Teksty mogą zawierać `conversations: [{ id, npcs: [id], radiusM?, lines: [{ npc, text }] }]`.
  Uczestników jest 1–3, każda kwestia należy do uczestnika, wszystkie id muszą istnieć w układzie;
  scena sprawdza to przez `loadNpcTexts(data, layout.npcs)`.
- `HubChatter` (`src/world/hubChatter.ts`) wybiera jedną najbliższą rozmowę w `radiusM` (domyślnie
  `chatterRadiusM`, 5 m) od środka bieżących pozycji uczestników. Otwarcie stacji lub dymek E blokuje
  start i przerywa aktywną rozmowę. Kwestia trwa `chatterLineBaseS + chatterLineCharS * text.length`,
  między kwestiami jest `chatterGapS`. Po ostatniej kwestii odnowienie tej rozmowy trwa `chatterCooldownS`
  (45 s). Wyjście poza promień + `chatterExitMarginM` przerywa; powrót zaczyna od pierwszej kwestii.
  Przerwanie nie nakłada odnowienia. Każda nowa kwestia emituje `hub_chatter_line { conversation, npc, text }`.
- Mówca w bezczynności przechodzi w `Idle_Talking_Loop` lub `Sitting_Talking_Loop`, z crossfade;
  po kwestii wraca do swojego klipu. Ruch i inne zajęcia zachowują swój klip. `HubChatterUi`
  (`src/ui/hubChatter.ts`, CSS) rysuje mniejsze, półprzezroczyste napisy nad dymkiem/podpowiedzią (`bottom: 26%`, środek poziomo,
  szerokość do `min(76vw, 760px)`, wypełnienie 0,5 × 0,9 rem, promień 3 px, tło `rgb(9 12 20 / 55%)`, tekst `rgb(239 238 231 / 82%)` 0,95 rem,
  wyśrodkowany), z imieniem (waga 600, kolor akcentu NPC: `#ffae1a`/`#6dff4a`/`#8a5cff`/`#3d7bff`/`#fff1d6`, po nim „: ”). Szafa grająca ma napis „Szafa grająca:” w bieli (`#fff1d6`), miska — „Hela:” w akcencie Heli (amber). DOM zmienia się tylko w renderze i przy zmianie kwestii; wejście jest
  łagodne, a `prefers-reduced-motion` wyłącza animację.
- Strojenie wszystkich nowych parametrów znajduje się w `tuning.hub`, automatycznie widocznym w lil-gui.
- Debug: `hub chatter <id>` wymusza start bez zasięgu i odnowienia (cała wymuszona rozmowa ignoruje
  dystans; E/stacja nadal ją przerywa). `query('hubChatter')` → `{ conversation, npc, text } | null`;
  `query('npcs')` zawiera aktualne X/Y/Z i yaw chodzących NPC.
- Testy: `hubNpcLife.test.ts` (trasy loop/pingpong, postoje, ustępowanie, dialog, determinizm i JSON,
  skala/focus/siedzisko, walidacja tras i rozmów, 17 klipów i brak poziomego ruchu korzenia),
  `hubNpcView.test.ts` (bez WebGL, prawdziwe GLB `npc_civilian.glb`: tylko części stroju z `look`, dokładnie jedna
  góra, brak `BoxGeometry` w stroju, wspólny szkielet części, strój i kolory pięciu kluczowych postaci, kaptur,
  paleta, współdzielenie i zwalnianie geometrii, sfera cullowania na wszystkich wariantach i klipach,
  interpolacja/skala, crossfade, pętle, sumowanie dt odległych mixerów),
  `hubChatter.test.ts` (promień, środek ruchomych uczestników, czas, przerwy, odnowienie, przerwania,
  jedna rozmowa, debug, determinizm), `hubChatterUi.test.ts` (jsdom i brak zbędnych zmian DOM),
  `hubScene.test.ts` z `tests/fixtures/hubLife.ts` (bez DOM: ruch, E/stacja/debug, zdarzenie i kolizja
  skalowanego ciała kinematycznego). Dane produkcyjne nie są potrzebne do demonstracji tych rozszerzeń.

Przykład NPC do `npcs` w układzie (pozycje wymagają wolnej podłogi):

```json
{
  "id": "ada",
  "position": { "x": 0, "z": 0 },
  "rotationDeg": 90,
  "scale": 0.68,
  "accent": "amber",
  "animation": "Idle_Loop",
  "route": {
    "points": [
      { "x": 0, "z": 0 },
      { "x": 4, "z": 0 }
    ],
    "mode": "pingpong",
    "speedMS": 1.3,
    "pauseS": 2,
    "moveAnimation": "Walk_Loop",
    "pauseAnimation": "Idle_Loop"
  }
}
```

Przykład wpisu do `conversations` w tekstach (oba id muszą istnieć w układzie):

```json
{
  "id": "ada_mira",
  "npcs": ["ada", "mira"],
  "radiusM": 5,
  "lines": [
    { "npc": "ada", "text": "Mogę pomóc przy naprawie?" },
    { "npc": "mira", "text": "Podaj mi klucz z półki." }
  ]
}
```

Kontrola ręczna: na `?scene=hub&debug=1` po dodaniu takich danych przez autora układu podejść do trasy,
zasłonić drogę, nacisnąć E przy NPC i odejść. Sprawdzić płynność obrotu/crossfade, brak poślizgu korzenia,
kolizję z dzieckiem, napisy oraz powrót do trasy po dialogu. `hub chatter ada_mira` pozwala sprawdzić napisy
bez czekania na zasięg lub odnowienie.

## Nakładki (`HubScreens`)

Interfejs `show(station, actions) / hide() / dispose()` wstrzykiwany przez opcję `screens` (w testach atrapa).
`HtmlHubScreens` (`src/ui/hubScreens.ts` + `hubScreens.css`) hostuje panele stacji (sekcja „Panele stacji”);
stacja bez fabryki w rejestrze (`arena`) zostaje zaślepką: tytuł, opis, notka „Ekran tymczasowy — pełna wersja trafi do kryjówki w kolejnych
zadaniach.”, przycisk „Przejdź na poligon” → `?scene=arena` (tylko `arena`) oraz „Zamknij” (Esc też zamyka, zdarzenie `keydown` na `window`,
bez powtórzeń). Stacja z panelem pokazuje tytuł (bez opisu), panel, „Zamknij” i podpowiedź „Esc zamyka okno. Spójrz na stację i naciśnij E,
by otworzyć ją ponownie.”; fokus trafia na pierwszy przycisk panelu (zaślepki: pierwszy przycisk). Nawigacja zachowuje `?debug=1`
(i tryb lite FX). Teksty: `src/data/ui/meta.pl.json`, sekcja `hub` (tytuły: „Terminal drzewek”, „Warsztat”, „Tablica misji”, „Poligon”;
opisy: talenty — „Punkty talentów zdobywasz przy awansie. Wydasz je na Ostrze, Rezonans, Strzelca i Hybrydy.”, warsztat — „Dane i Rdzenie płacą
za trwałe odblokowania broni, mocy, ostrzy, miejsc ekwipunku i modułów. Cena jest przy zakupie.”, misje — „Tu wybierzesz sektor i Poziom zagrożenia,
a stąd wyruszysz na run.”, poligon — „Tunel prowadzi na poligon treningowy: fale wrogów bez stawki.”).
Wygląd: pełnoekranowa warstwa (`z-index 100`, rozmycie tła 4 px, ciemny radialny gradient `rgba(4,8,16,.72)` → `rgba(2,4,9,.94)`), panel
wyśrodkowany o szerokości `min(620px, 100%)` (z panelem stacji `min(1040px, 100%)`), maks. wysokość 90% okna, tytuł wielkimi literami
`600 28px` w cyanie `#00e5ff` z nadtytułem „KRYJÓWKA ISKRY // STACJA” (10 px, `#7d93a3`), przyciski pełnej szerokości; wejście 160/200 ms,
wyłączone przy `prefers-reduced-motion`. `HubScreens` ma opcjonalne `refresh()`: scena woła je po zdarzeniach meta, a nakładka przekazuje je
do otwartego panelu.

## Plan stacji

Klawisz M (akcja `map`, `src/data/inputBindings.json`; M było wolne, więc Tab nie jest potrzebny) przełącza nakładkę
„Plan stacji Kamienna” (`src/ui/hubMap.ts` + `hubMap.css`, ten sam język „wizjera” co mapa sektorów).

- Dane: opcjonalne `zones: { id, label, rect { x0, z0, x1, z1 }, color? }[]` w `hideout.json` (schemat `hubZoneSchema`
  w `hubSchema.ts`). Prostokąty są w osiach świata (x0 < x1, z0 < z1), muszą mieścić się w obrysie bloków układu,
  `id` są unikalne, `color` to wyłącznie `amber|green|violet|blue|white` (domyślnie `white`; cyan, czerwień i magenta
  są zarezerwowane). Strefy odpowiadają wierszom tabeli „Układ” (14, `id` → etykieta, kolor): `hall` Hala (peron A) amber, `tracks` Tory white, `platform_b` Peron B amber,
  `corridor` Korytarz white, `canteen` Jadłodajnia amber, `quarters` Kwatery white, `radio` Radio Iskry blue, `market` Targ wymiany green,
  `comms` Kącik łączności violet, `bar` Bar i parkiet violet, `mezzanine` Antresola white, `wagon` Wagon green, `footbridge` Kładka white,
  `training` Trening blue (prostokąty jak w kolumnie „Zakres” tabeli „Układ”). Strefy zagnieżdżone (np. Antresola w hali) są rysowane później, więc leżą na wierzchu.
- Model: `hubMapModel(layout, playerPos, playerYaw)` w `src/world/hubMap.ts` (czysta funkcja). Plan północą w górę (−Z u góry, +X w prawo), współrzędne x i y w 0..1 osobno dla osi względem obszaru stref z marginesem `tuning.hub.mapPaddingM`; proporcje niesie `aspect` (ramka UI ma te same proporcje i może być szersza niż wyższa). Strefy są posortowane od największej, więc zagnieżdżone rysują się nad rodzicem. Podpis strefy (`caption`) leży w lewym górnym rogu, a gdy zajmuje go strefa zagnieżdżona albo stacja, w prawym; strefa węższa niż 5 m lub płytsza niż 3 m nie ma podpisu (tylko `<title>`; progi w `tuning.hub.mapLabel*`). Zwraca też stacje (kolor napisu: misje bursztyn, warsztat zieleń, talenty fiolet, poligon błękit), rekwizyty (bez siedzisk) jako punkty w środku ich `focus` i gracza (punkt, `headingRad` = −yaw). Obszar planu to obwiednia stref (x −34…20, z −19…16) z marginesem 2 m. NPC nie są na planie. Podpisy stacji: pod znacznikiem, na ciemnej podkładce, większe i jaśniejsze niż podpisy stref.
- UI: SVG o wysokości `viewBox` 100 (szerokość = 100 × `aspect`) budowany raz przy pierwszym otwarciu (obrysy stref 1,5 px w kolorze strefy
  `amber #ffae1a`, `green #6dff4a`, `violet #ad92ff`, `blue #7aa4ff`, `white #fff1d6`, wypełnienie `rgba(5,10,20,.72)`; podpisy 2,3 jednostki, wielkie litery,
  krycie 0,75; znaczniki stacji — kółko r 1,6 z obwódką w kolorze stacji i podpisem 3,2 jednostki na podkładce; kropki rekwizytów r 0,7 `#a9bccb`;
  znacznik gracza — czworokąt o wierzchołkach (0; −2,2), (1,6; 1,6), (0; 0,7), (−1,6; 1,6), obrócony o `headingRad`, w cyanie `#00e5ff`); ramka planu ma proporcję `aspect` i szerokość
  `min(90vw − 50px, (80vh − 150px) · aspect)`; nad ramką nadtytuł „KRYJÓWKA ISKRY // PLAN” i tytuł „Plan stacji Kamienna” (`600 24px`, cyan), w rogu
  „↑ Północ”, pod ramką legenda (Stacja, Rekwizyt, Ty) i podpowiedź „M — zamknij”; nakładka `z-index 95`, tło z siatką 32 px; w `render()` scena przesuwa wyłącznie znacznik gracza
  (strzałka w cyanie), tylko gdy plan jest otwarty. `role="dialog"`, `aria-label`, `pointer-events: none`. Teksty:
  `src/data/ui/meta.pl.json`, `hub.map`.
- Zachowanie: plan nie zatrzymuje symulacji i nie rusza pointer locka; zamyka go M, Esc (własny nasłuch `keydown`), otwarcie stacji
  (`hub open`, E). Otwarty plan blokuje interakcję (E, uderzenie w worek) i chowa podpowiedź. Przy otwartej stacji
  albo trwającej rozmowie z NPC M nic nie robi.
- Debug: `hub map` (przełącza), `query('hubMap')` → `{ open }`. Testy: `tests/unit/hubMap.test.ts`,
  `hubMapUi.test.ts`, `hubScene.test.ts`, e2e `hub: hub map ...`.

## Menu główne

`src/ui/mainMenu.ts` (tytuł „NEORYDER”, podtytuł „Wybierz swoją ścieżkę przez sektor.”): „Samouczek” (→ `?scene=tutorial`, polecany — dodatkowa
podpowiedź „Nowy gracz? Zacznij tutaj” — gdy nie ma zapisu meta i samouczek nie jest ukończony), „Kryjówka” (główny przycisk → `?scene=hub`), „Kontynuuj run” (→ `?scene=run&continue=1`,
nieaktywny bez zapisu; linia statusu: „Warstwa: N · Zdrowie: M”, „Brak zapisanego runu”, „Nierozliczony run — …”), „Poligon” (→ `?scene=arena`), „Ustawienia”. „Nowy run (presety)”
z polem seeda, `BuildSelect` i przycisk „Sceny debug” (→ `?scenes=1`, z `debug=1`, jeśli był) pojawiają się tylko w
trybie debug (`?debug=1` albo `npm run dev`). Bez `?scene=` gra zawsze pokazuje menu gry; lista scen debug jest pod
`?scenes=1` (tylko w trybie debug, `src/ui/sceneMenu.ts`).

## Debug

- `hub open <talents|workshop|missions|arena>`, `hub close`;
- `hub look <talents|workshop|missions|arena|npc|propId>` — obraca kamerę na środek bryły `focus` stacji, NPC (id z
  `hideout.json`; cel o 0,35 m wyżej niż środek bryły) albo rekwizytu w następnym kroku;
- `hub talk <npc>` — pokazuje kolejną kwestię NPC bez patrzenia na niego (nie wymaga bliskości; znika po 5 s; odrzucane przy otwartej stacji);
- `hub use <propId>`, `hub sit <seatId>`, `hub stand`, `hub arrive <firstVisit|victory|death>`, `hub chatter <id>`, `hub kidscat`, `hub cat`,
  `hub rat`, `hub train`, `hub dip`, `hub map` — opisane przy odpowiednich systemach;
- `hub tp <x> <z> [yawDeg] [pitchDeg]` — teleport gracza (yaw 0 patrzy w −Z; ruch myszy symulowany w następnym
  kroku); teleport nie otwiera nakładki;
- `query('hubStation')` (otwarta stacja albo `null`), `query('hubFocus')` (stacja w celowniku albo `null`),
  `query('hubNpc')` (id NPC w celowniku albo `null`), `query('hubTalk')` (bieżąca kwestia `{ id, name, role, line }`
  albo `null`), `query('npcs')` (`id`, `x`, `y`, `z`, `bodyYaw` i bieżący `clip` NPC),
  `query('playerPos')`, `query('stations')` (`id`, `x`, `z`, `radius`), `query('meta')`
  (stan meta), `query('achievements')` (stan naszywek), `query('level')` (poziom, XP, `talentPoints`, `freePoints`),
  `query('hubChatter')` (bieżąca linia podsłuchanej rozmowy albo `null`), `query('hubNpcVisible')` (liczba NPC w kadrze),
  `query('hubFauna')`, `query('hubKidsCat')`, `query('hubPower')`, `query('hubAmbience')`, `query('hubArrival')`, `query('horizon')`;
- komendy meta (`registerMetaCommands`): `meta state|xp|data|cores|threat|unlock all|reset`; `meta threat <n>` ustawia
  `threat.max` (odblokowanie kolejnych Poziomów zagrożenia bez grania); po każdej komendzie pasek i panel się odświeżają;
- `hub campaign <missionId...|clear>`, `hub arrive mission <missionId>` — patrz „Kryjówka po misjach”;
- `hub map` — przełącza plan stacji, `query('hubMap')` → `{ open }`;
- `hub sit <seatId>` / `hub stand` — siadanie i wstawanie (patrz „Siadanie”), `query('hubSeat')` → id siedziska albo `null`,
  `query('playerLook')` → `{ yaw, pitch }`;
- `reset` wraca na `playerSpawn`.

## Zwierzęta

Układ zwierząt: `fauna` w `hideout.json`
(`HubLayout.fauna`, walidacja w `hubSchema.ts`; trasa kota jak trasy NPC: podłoga, poza blokami, min. 0,6 m od
statycznych NPC). Liczby w `tuning.hub` (`cat*`, `rat*`, `fauna*`).

- Kot stacji „Węgielek”: `fauna.cat` = `route` (22 punkty X/Z, pętla zamknięta ostatni→pierwszy, start (−14,5; 12,5): peron B przy beczce
  Tomasza i barze, kładka (x 4,5…5,5), korytarz północny, odnogi do budki z makaronem (−14; −16) i kwater (−4,5; −14,5)), `restS` [4, 12] s,
  `speedMS` 0,75 (domyślnie `catSpeedMS`). Idzie do kolejnego punktu i odpoczywa losowo `restS`: z szansą `catGroomChance` 0,3 myje się
  (`groom`), inaczej z szansą `catLieChance` 0,4 leży, w pozostałych przypadkach siedzi; w marszu co [`catGroomIntervalMinS`, `catGroomIntervalMaxS`]
  = [12; 28] s z tą samą szansą 0,3 przystaje się umyć na [`catGroomMinS`, `catGroomMaxS`] = [1,5; 3] s. Po rozpoczęciu odpoczynku, gdy minęło
  `catMeowCooldownS` (25 s, pierwszy raz od startu), z szansą `catMeowChance` 0,16 miauczy (`hub_fauna_sound { kind: 'meow' }`).
  Zatrzymuje się, gdy gracz jest bliżej niż `catYieldM` 0,8 m w kierunku jego ruchu (cos kąta ≥ `catYieldConeCos` 0,3); gdy gracz biegnie
  w jego stronę (sprint: prędkość ≥ `catRunThresholdMS` 8 m/s, chód 7, sprint 11; stożek `catApproachConeCos` 0,6) bliżej niż `catFleeM` 2 m, odbiega o `catFleeSideM`
  1,1 m w bok (losowa strona, tylko po bezpiecznej podłodze) z prędkością `catFleeSpeedMS` 2,4 m/s i wraca na punkt opuszczenia trasy;
  kolejna ucieczka dopiero po `catFleeCooldownS` 4 s. Ciało: promień `catRadiusM` 0,22 m, wysokość `catHeightM` 0,6 m, odstęp od NPC
  `catStaticClearanceM` 0,6 m.
- Gracz może podejść do Węgielka i nacisnąć E po wyświetleniu „Pogłaszcz Węgielka”. Prawa dłoń FPP
  wysuwa się, wykonuje dwa ruchy głaskania i wraca, a kot kładzie się, pochyla głowę i miauczy
  (`hub_fauna_sound` → `hub_meow`). Logika głaskania (licznik czasu, położenie kota, miauknięcie) jest w `HubFaunaRuntime`; zasięg liczony poziomo (XZ) od oka,
  `catPetRangeM` 2,2 m, czas `catPetDurationS` 1,5 s, `catPetStrokes`, `catPetStrokeM`, `catPetReachFraction` w `tuning.hub`; pozycje dłoni w `src/data/hub/interactions.json`,
  etykieta w `props.pl.json`. W debugu `hub look cat` ustawia cel, gdy kot jest w zasięgu (`hub cat` stawia go 2 m przed graczem).
- Dzieci przy kocie (`src/world/hubKidsCat.ts`, `KidsCatEncounter`; `tuning.hub.kidsCat*`): gdy Węgielek odpoczywa
  (siedzi, leży, myje się) w zasięgu `kidsCatRangeM` od `ola` lub `stas` i minęło odnowienie `kidsCatCooldownS`,
  dziecko schodzi z trasy, podchodzi truchtem na `kidsCatStandM` od kota (tylko gdy odcinek leży na podłodze fauny,
  inaczej stoi na trasie), patrzy na kota i kuca (`Crouch_Idle_Loop`) przez `kidsCatPetS`, po czym wraca w punkt
  zejścia i biegnie dalej. Drugie dziecko w `kidsCatJoinM` od kota dołącza z drugiej strony. Kot nie reaguje na dzieci;
  gdy przestanie odpoczywać (np. ucieczka przed graczem), dzieci wracają na trasę. Raz na spotkanie scena wymusza
  rozmowę `ola_stas_cat` (promień 0,001 m, żeby sama się nie włączała), o ile nic innego nie trwa i gracz jest w
  `chatterRadiusM`. Debug: `hub kidscat`, `query('hubKidsCat')` → `{ active, kids, cooldownLeft }`.
- Szczury: `fauna.rats` = 3 pasy `{ from, to }` na stałym poziomie: dwa po dnie niecki torów (y −0,8; x −19…19 przy z 3,4 oraz
  19…−19 przy z 7,55) i jeden pod ścianą targu (x −33,5; z 10…14; y 0); co `intervalS` [8; 18] s przebiega losowy pas (2,5–3,5 m/s,
  zrywy `ratBurstFraction` 0,12 przy `ratBurstHz` 8) i znika; nieudana próba ponawiana co `ratRetryS` 1 s; gdy gracz jest bliżej niż 3 m od startu pasa, wybierany jest inny pas albo czekanie;
  maksymalnie 2 naraz (pooling).
- Wygląd kota (`src/scenes/hubFauna.ts`): model `public/assets/models/hub_cat.glb` (Blender, `build_hub_cat`; opis
  w `docs/assets.md`) — czarny, fasetowany low-poly kot ze szkieletem (biodra, kręgosłup, pierś, szyja, głowa, cztery
  łapy po 3–4 kości, ogon w 4 członach), bursztynowe oczy z delikatnym blaskiem (`catEyeColor`, `catEyeGain`),
  futro w toon `catColor` ze słabą poświatą krawędzi (`faunaRimColor`, `catRimGain`). `HubFauna.load()` wczytuje model
  (bez modelu — testy, `loadModels: false` — kot nie ma widoku, symulacja i mruczenie działają). `AnimationMixer`
  odtwarza klipy wybrane przez `catClip(stan)`: `sit` / `lie` / `groom` przy odpoczynku i myciu, `walk` w ruchu
  (`walk`, `flee`, `return`), `idle` gdy kot stoi na trasie (np. czeka, aż gracz zejdzie z drogi). Tempo `walk` =
  prędkość ruchu / `catWalkClipSpeedMS` (prędkość łap w klipie, bez poślizgu), najwyżej `catWalkMaxTimeScale`;
  zmiana klipu przenika się przez `catAnimFadeS` (0,3 s; `catWalkClipSpeedMS` 0,55 m/s, `catWalkMaxTimeScale` 2,5). Mixer idzie czasem symulacji kota (interpolowany `ageS`), więc
  pauza zatrzymuje animację. Kolory: `catColor` `#25282d`, oczy `catEyeColor` `#ffae1a`, poświata krawędzi `faunaRimColor` `#fff1d6`.
- Wygląd szczurów: proceduralne siatki z prymitywów (ciało, głowa z uszami i oczami, łapy i ogon kołyszące się z dystansem, współdzielone
  geometrie), `ratColor` `#34312f`; render interpoluje stan.
- Dźwięk: mruczenie `purr` (ruchome źródło ambience: promień 3 m, gain 0,2 tylko gdy kot odpoczywa, 0 w marszu), rzadkie miau i pisk szczura przez
  zdarzenie `hub_fauna_sound` (zob. `audio.md`, `api.md`).
- Debug: `hub cat` (kot 2 m przed graczem, odpoczynek), `hub rat` (przebieg najbliższym pasem),
  `query('hubFauna')` → `{ cat: { x, z, state } | null, rats }`.

## Zdarzenia i stan

Zdarzenia `EventBus` kryjówki: `hub_station_opened { station }`, `hub_prop_used { prop, kind }`, `hub_chatter_line { conversation, npc, text }`,
`hub_fauna_sound { kind: 'meow' | 'rat', point }`, `hub_train_passed { durationS }`, `hub_power_dip { durationS }` oraz `camera_shake` (pociąg);
zdarzenia meta (`meta_rewards`, `level_up`, `talents_changed`, `unlock_purchased`, `loadout_changed`, `threat_selected`) odświeżają pasek i panel.
Trwały stan kryjówki to wyłącznie meta (`SaveStore`, IndexedDB; zapis przez panele) i klucz `neoryder.hub.greeted` w `localStorage` (ostatnio
przywitany kontekst przybycia); stan chodzących NPC, zwierząt, pociągu i spadków napięcia nie jest zapisywany.

## Testy

`tests/unit/hubLayout.test.ts` (walidacja układu: stacje w granicach i osiągalne, strefy rozłączne, paleta, zasoby),
`hubStations.test.ts` (ray–AABB, zasięg, najbliższe trafienie, otwieranie na żądanie), `hubPrompt.test.ts` (jsdom, podpowiedź),
`hubScene.test.ts` (scena bez DOM: spojrzenie i zbocze E, komendy, zatrzymanie ruchu, niecka torów,
nawigacja, `dispose` bez subskrypcji, meta, NPC: cel `hubNpc`, kwestie w pętli, wygasanie dymka, kolidery, obrót),
`hubNpcs.test.ts` (teksty NPC, kolejność kwestii, `focus` z kolidera, `selectHubTarget`, `updateNpcLook`),
`hubCatView.test.ts` (prawdziwy `hub_cat.glb`: szkielet, pięć zapętlonych klipów, łapy i tułów przy podłodze w każdym
klipie, prędkość łapy w podporze klipu `walk` = `catWalkClipSpeedMS`, mapowanie stanów kota na klipy),
`hubDialog.test.ts` (jsdom, dymek), `hubScreens.test.ts` (jsdom, hostowanie paneli),
`missionsPanel.test.ts`, `metaBar.test.ts`, `mainMenu.test.ts`, `hubFauna.test.ts`, `hubKidsCat.test.ts`, `hubPowerDip.test.ts`,
`hubStationMarkers.test.ts`, `hubStaticBatch.test.ts`, `hubNpcIdleVariety.test.ts`, `hubNpcConversationLook.test.ts`, `achievementsUi.test.ts`;
e2e: `tests/e2e/hub.spec.ts`.
Ręcznie: `?scene=hub&debug=1`, `hub tp 14.05 13.6 0` — brak podpowiedzi mimo zasięgu; `hub look talents` —
podpowiedź „E TALENTY”; E otwiera, Esc zamyka, kolejne E ponownie otwiera. Sprawdzić też tablicę misji,
warsztat i poligon oraz zasięg i margines brył interakcji (parametry `hub` w lil-gui).
Ze strefy stacji: `hub tp <x> <z>` z `query('stations')` i `hub look <stacja>` — podpowiedź widoczna, E otwiera.

### Kontrola poprawek oprawy kryjówki (bug1–bug6)

W `tools/hub/` nie ma generatora układu; `hideout.json` jest edytowany bezpośrednio. Jasność obiektów interaktywnych
pozostaje `#d9dde3`, ale dotyczy teraz cienkich blatów i listew: warsztat ma metalowe szafki, tablica misji ciemne
plecy i ramę, terminal talentów ciemny korpus i cokół, a portal ciemne słupki z jasnymi paskami. `focus` stacji
zachowuje poprzednie położenie i rozmiar; sprawdzić podpowiedź oraz E po `hub look <stacja>`.

Blada ściana widoczna z boku terminalu w `bug3` odpowiadała jednolicie jasnemu bokowi bryły `talents`.
Dodatkowo dwie okładziny ścianki łączności rozciągały się przez drzwi: są teraz podzielone na pełne odcinki
`z 8…10`, `13…16` i nadproże `y 2,8…5`. Płaszczyzny pozostają jednostronne, zwrócone do właściwego wnętrza;
test sprawdza ich orientację oraz pełne podparcie na blokach.

Ogień miał trzy nakładające się addytywne płaszczyzny o szerokości 0,95 m. Teraz ma dwie, szerokość 0,4275 m,
wysokość bazową 0,5985 m, jasność 0,38 i krycie 0,55. Parametry rozmiaru, jasności i migotania są w `tuning.hub.fire*`
(lil-gui); materiał ma jawne `depthTest: true`, `depthWrite: false`. Beczki mają otwarte metalowe walce,
obręcze i ciemne wnętrze zamiast sześcianów. Nie ma pasującego modelu beczki w `models/city/`.

`graffiti_resist` (OPÓR) odsunięto od narożnika do `z −4,5` i zmniejszono do 1,6 × 1,6 m (zakres `z −5,3…−3,7`).
`sticker_cluster` przeniesiono z wnętrza ścianki (`x 8,3`) na jej zachodnie lico (`x 7,98`).
`hubLayout.test.ts` używa `wallDecalFitsBlock` z `dressingSchema` dla wszystkich naklejek ściennych i okładzin.

Bursztynowe lampiony ze zrzutów to `city_lantern_string` pod sufitem (`y 4,7`), a pionowe paski filarów to bloki
`neon_*`. `HubDecor` nie tworzy odrębnych bursztynowych prostokątów w hali. Ich halo/rozmyte kopie powstają we
wspólnej ścieżce renderowania (`materials`, `bloom`, `reflections`), obsługiwanej przez równoległe zadanie.
Ta poprawka kryjówki nie zmienia plików `src/render/**` ani globalnych parametrów oprawy miasta.

Kamery kontrolne w `?scene=hub&debug=1` (yaw 0 = −Z, pitch ujemny = w dół):

| Punkt / zrzut         | Komendy konsoli                                                                                                                              | Co sprawdzić                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1, Tomasz / bug2      | `hub tp -10.2 10.2 129 -22`, potem opcjonalnie `hub look tomasz`                                                                             | Miednica nad stołkiem, obie stopy na podłodze; po podejściu obrót nie przesuwa miednicy.                  |
| 1, Bajt / bug3        | `hub tp 17 13.8 -38 -20`, potem `hub look bajt`                                                                                              | Stołek pod miednicą, nogi mieszczą się pod biurkiem.                                                      |
| 2, blada bryła / bug3 | `hub tp 18 14.3 105 -8`                                                                                                                      | Ciemny bok terminalu po lewej; brak płaszczyzny w otworze drzwi łączności.                                |
| 3, warsztat / bug1    | `hub tp -9.5 4.4 180 -18`, potem `hub look workshop`                                                                                         | Ciemne szafki, cienki jasny blat, E otwiera warsztat.                                                     |
| 3, pozostałe stacje   | `hub tp -6 -4.4 0`, potem `hub look missions`; `hub tp 14.05 13.6 180`, potem `hub look talents`; `hub tp 14 -4.8 0`, potem `hub look arena` | Ramy i korpusy, jasne akcenty, niezmienione działanie E.                                                  |
| 4, ogień / bug2       | `hub tp -11.2 10 123 -12`                                                                                                                    | Płomień mieści się nad otworem beczki, obręcze pozostają czytelne; beczka zasłania dolną część płomienia. |
| 5, OPÓR / bug4        | `hub tp -17.5 -3 59 5`                                                                                                                       | Cały prostokąt graffiti na zachodniej ścianie; brzegi nie wystają za narożnik.                            |
| 6, lampy / bug1       | `hub tp -8 10.6 90 5`                                                                                                                        | Hala w stronę Tomasza, wagon po prawej; kontrola wspólnego halo na filarach.                              |
| 6, lampy / bug6       | `hub tp -12 10.6 -90 5`                                                                                                                      | Wagon po lewej, bar po prawej; kontrola rozmytych kopii lampionów.                                        |

Testy regresji: `hubSeating.test.ts`, `hubDecor.test.ts`, rozszerzone `hubLayout.test.ts` oraz dotychczasowe
testy sceny i interakcji. E2E i zrzuty kontrolne wykonuje manager.
NPC: `hub tp -8.2 3.9 255`, `hub look mira` — „MIRA / POROZMAWIAJ”, E pokazuje dymek, kolejne E następną kwestię.
Hela: `hub tp -16.9 -16.75`, `hub look noodles`, E. Iga: `hub look iga` po `hub tp -10 -5.5` i po
`hub tp -10 -9.9`. Węgielek na początku wizyty: `hub tp -14.5 13.5`, `hub look cat`, E.
Antresola: `hub tp -12 1.4 0` i trzymać W (schody). Kładka: `hub tp 5.5 3.6 180`; łączność: `hub tp 9.2 10.6 262`.

### Terminal drzewek

`src/ui/hub/talentsPanel.ts` (+ `talentsPanel.css`) eksportuje `createTalentsPanel: HubPanelFactory` (kontrakt:
`src/ui/hub/hubPanel.ts`). Panel czyta i zmienia wyłącznie `MetaManager`; montuje go nakładka stacji `talents` (tytuł „Terminal drzewek”).

- Zakładki (`role=tablist`, etykieta „Terminal drzewek”): „Drzewka talentów” (domyślna) i „Naszywki Iskry”; strzałki ←/→ przełączają i
  przenoszą fokus (zawijanie). Zakładka naszywek to osobny panel tylko do odczytu (sekcja „Naszywki Iskry” niżej).
- Nagłówek drzewek: „Punkty talentów: N” (bursztyn `#ffae1a`), „Poziom L”. Cztery sekcje w kolejności Ostrze, Rezonans, Strzelec,
  Hybrydy w siatce 3 kolumn (Hybrydy zajmują pierwszą kolumnę drugiego rzędu; ≤ 760 px szerokości — 1 kolumna; węzły Hybryd w `auto-fill` ≥ 190 px). Węzły są pogrupowane wg progu 1–4;
  podpis progu: „Próg N — K pkt w drzewku (wydane: S)” albo „Próg N — bez wymagań (wydane: S)” dla progu 0; Hybrydy mają sam podpis „Próg N”.
- Karta węzła to `<button>`: nazwa i linia stanu: „kupiony · Koszt: N pkt talentów”, „dostępny · Koszt: …” albo „zablokowany: <powód> · Koszt: …”.
  Powody: „wymaga: <nazwa węzła>”, „próg: N pkt w drzewku”, „wymaga 3 pkt w Ostrze i 3 pkt w Rezonans” (wiele drzewek łączy „ i ”),
  „za mało punktów”. Niedostępne karty mają `aria-disabled="true"` i nie wołają `buyTalent`. Opis węzła w panelu szczegółów po
  najechaniu lub fokusie („Najedź na węzeł lub wybierz go klawiaturą, by zobaczyć opis.” / nazwa — „Koszt: N pkt talentów” + opis).
- Kupno: klik/Enter/Spacja → `buyTalent` → `await ctx.save()` → odświeżenie kart (bez przebudowy DOM, fokus
  zostaje); komunikat „Kupiono: <nazwa>.”. Błąd `buyTalent` trafia do linii statusu (`role="status"`), błąd zapisu: „Nie udało się zapisać postępu.”.
- Reset: „Resetuj talenty” → „Potwierdź reset” (wygasa po `RESET_CONFIRM_MS` = 4 s) → `resetTalents` → zapis → „Talenty zresetowane.”.
- Reguły stanu węzła: czysta funkcja `talentNodeState` (`src/ui/hub/talentState.ts`) odwzorowuje `buyTalent` w kolejności: kupiony →
  brak wymaganego węzła → próg drzewka (`tierThresholds[tier − 1]` vs wydane w drzewku) → `requiresTreePoints` (hybrydy) → wolne punkty < koszt;
  testy: `tests/unit/talentsPanel.test.ts`.
- Akcenty drzewek (obwódka kolumny 3 px, lewy pasek karty 4 px): Ostrze cyan `#00e5ff`, Rezonans magenta `#ff2bd6`, Strzelec bursztyn
  `#ffae1a`, Hybrydy fiolet `#8a5cff`. Teksty: `src/data/ui/talents.pl.json`.

### Naszywki Iskry (zakładka terminalu)

`src/ui/hub/achievementsPanel.ts` (+ `achievementsPanel.css`), teksty `src/data/ui/achievements.pl.json`, dane i reguły: [achievements.md](achievements.md).
Nagłówek „Naszywki Iskry”, licznik „Zdobyte: X z Y” (`role=status`), wstęp („Naszywki to pamiątki z runów. Każda daje jednorazową nagrodę, a niektóre
pozwalają kupić rzadkie odblokowania w warsztacie.”), potem sekcje kategorii „Walka”, „Ścieżki”, „Misje i tryby”, „Progres” z siatką kart. Karta: ikona
(`createAchievementIcon`), tytuł, opis; niezdobyta (`data-state="missing"`, szara) pokazuje dodatkowo podpowiedź (`hint`); licznikowa — pasek postępu
(`progressbar`) i „current / target”; zawsze „Nagroda: 10 Danych i 1 Rdzeń” (odmiana Rdzeń/Rdzenie/Rdzeni) albo „Nagroda: sama naszywka”; jeśli
`unlocks.json` wiąże z nią zakup (`requiresAchievement`) — „Pozwala kupić: <przedmiot>”. Karty są fokusowalne (roving tabindex, strzałki, Home/End);
zdobyte świecą bursztynem. Odświeżenie przebudowuje DOM, zachowując fokus karty po `id`.

### Warsztat

`createWorkshopPanel` (`src/ui/hub/workshopPanel.ts`, kontrakt `HubPanel`) to samodzielny panel stacji `workshop` (tytuł „Warsztat”);
podpięty w rejestrze paneli sceny kryjówki. Nagłówek pokazuje Dane, Rdzenie i poziom gracza.

- **Odblokowania:** lista pogrupowana (Bronie, Moce, Ostrza, Sloty, Moduły — grupa pojawia się, gdy ma wiersze) wg `unlocks.json`; w grupie
  posiadane (w tym startowe spoza listy zakupów) na początku. Wiersz: nazwa, cena („140 Dane”, „50 Dane + 1 Rdzenie” — liczba i nazwa waluty
  z `currency`) i stan: „Posiadane”, „Wymaga naszywki: <tytuł>” (z ikoną kłódki), „Wymagany poziom N”, „Za mało Danych” / „Za mało Rdzeni”
  (kolejność sprawdzeń jak w `buyUnlock`: naszywka, poziom, Dane, Rdzenie) albo aktywny przycisk „Kup”. Niedostępny przycisk ma `disabled`.
  Kup → `buyUnlock` → `ctx.save()` → odświeżenie. Id odblokowań mają postać `<rodzaj>:<klucz>` (`weapon:`, `power:`, `blade:`, `slot:`, `module:`).
- **Ekwipunek:** sekcja „Ekwipunek” zawiera kolejno:
  - „Podgląd broni”: obracany podgląd 3D wybranej broni z założonymi modułami (`WeaponPreview`, canvas 360 × 220 px, kamera FOV 28°, widok 3/4 z lekkim
    nachyleniem 0,12 rad; przeciąganie obraca (czułość 0,011 rad/px w poziomie, 0,006 w pionie, nachylenie ≤ 25° i wraca z prędkością 2,5/s); po 3 s
    bezczynności autoobrót 15°/s, przy `prefers-reduced-motion` bez autoobrotu). Bez WebGL2 zamiast płótna: „Podgląd 3D niedostępny w tej przeglądarce.”.
    Przy więcej niż jednej broni w ekwipunku nad podglądem są przyciski wyboru broni (grupa „Broń w podglądzie”); domyślnie pierwsza broń ekwipunku.
  - „Ostrze”: przyciski (`aria-pressed`) dla odblokowanych ostrzy: „Ostrze plazmowe”, „Ostrza bliźniacze”, „Ostrze dwustronne” (wybór dokładnie jednego).
  - „Bronie” i „Moce”: przełączniki z limitem `weaponSlots` / `powerSlots` (licznik „Bronie: 1/2”; kolejność wyboru = kolejność slotów, obok wybranych „Slot N”;
    pierwsza broń to slot 1). UI blokuje ponad limit (podpowiedź „Limit slotów wyczerpany”) i odznaczenie ostatniej pozycji („Wymagana co najmniej jedna
    pozycja”), zanim zmiana trafi do `setLoadout`. Odznaczenie broni usuwa jej moduły z ekwipunku.
  - Pod grupą broni dla każdej wybranej broni sekcja modułów z trzema listami: „Wylot”, „Ogniwo”, „Optyka” (opcje „— brak —” oraz odblokowane i pasujące
    do broni moduły danego slotu; pod listą opis wybranego modułu). Zmiana → `nextModuleLoadout` (moduły sortowane wg kolejności slotów) → `setLoadout`.
    Każda zmiana → `setLoadout` → `save` → odświeżenie (z zachowaniem fokusu po `data-key`).
- **Błędy:** `Error` z `MetaManager` (lub z zapisu) trafia do linii `role="status"` (bez wyjątku: „Operacja nie powiodła się.”); stan zostaje bez zmian.
  Równoległe operacje są odrzucane (`busy`).
- **Logika bez DOM:** `src/ui/hub/workshopState.ts` (`unlockRows`, `groupRows`, `equipmentState`, `toggleSelection`, `nextLoadout`, `nextModuleLoadout`,
  `previewTarget`); nazwy broni, mocy i modułów z definicji (`name`), nazwy ostrzy i slotów z
  `src/data/ui/workshop.pl.json` (ostrza nie mają pola `name`; sloty: „Drugi slot broni”, „Trzeci slot broni”, „Drugi slot mocy”). Styl: `workshopPanel.css`.
- Testy: `tests/unit/workshopPanel.test.ts` (jsdom + czyste funkcje).

### Panele stacji

Kontrakt: `src/ui/hub/hubPanel.ts` (`HubPanelContext { manager, missionSave?, save, navigate, close }`, `HubPanel { root, refresh,
dispose }`, `HubPanelFactory`). `HubScene` (`src/scenes/hub.ts`) przy `init` wczytuje meta (`loadMetaManager(store,
bus)`; `store` z opcji `metaStore`, domyślnie IndexedDB) oraz zapis aktywnej misji kampanii (`store.loadMission`; błąd odczytu → `null` z ostrzeżeniem),
rejestruje komendy meta (`registerMetaCommands`, sprzątane w
`dispose`) i buduje `HtmlHubScreens` z rejestrem `Partial<Record<HubStationId, HubPanelFactory>>`:
`missions: createMissionsPanel`, `talents: createTalentsPanel`, `workshop: createWorkshopPanel` (opcja `panels`
podmienia rejestr). `show(station)` montuje panel w treści nakładki (pod tytułem, nad „Zamknij”; nakładka jest wtedy
szersza, klasa `hub-screen--panel`), a `hide()`, kolejne `show()` i `dispose()` wołają `panel.dispose()`. Kontekst:
`save` = `saveMetaManager(store, manager)`, `navigate` doklejający `debug=1` z URL sceny, `close` zamyka nakładkę
(wznawia ruch). Po zdarzeniach meta (`meta_rewards`, `level_up`, `talents_changed`, `unlock_purchased`, `loadout_changed`, `threat_selected`)
scena woła `screens.refresh()` → `panel.refresh()`.

Po wejściu do kryjówki, jeśli `meta.state.campaign.pendingDebrief` wskazuje znaną misję kampanii (i scena tworzy własne nakładki), pokazuje się odprawa
powrotna (`showDebrief`, `src/ui/missionUi.ts`; teksty `missionDialogue.pl.json`: „Powrót na Kamienną”, „Wróć do kryjówki”); jej zamknięcie czyści
`pendingDebrief` (`clearDebrief`) i zapisuje meta.

### Tablica misji

`src/ui/hub/missionsPanel.ts` (+ `missionsPanel.css`), `createMissionsPanel`; teksty `src/data/ui/missions.pl.json`
(sekcja `missions`), `missionDialogue.pl.json` i `modes.pl.json`. Kampania i tryby: [missions.md](missions.md), [modes.md](modes.md).

- Karta sektora u góry: domyślnie „Kurogane Arms” (nazwa i krótki opis); po wyborze misji lub trybu pokazuje jego tytuł i opis.
- Lista wyboru: opcjonalne „Kontynuuj misję · <tytuł>” (gdy istnieje zapis misji; → `?scene=mission&mission=<id>&continue=1`), przyciski misji kampanii
  posortowane po `number`: „NN · Tytuł — stan” (obecnie 01 Maszty, 03 List przewozowy, 06 Odlewnia), gdzie stan to „Wkrótce” (misja bez `level`),
  „Zablokowane · Wymagane misje: <id, …>” (nieukończone `requires`), „Ukończona” albo „Dostępna” (przyciski niedostępne są `disabled`),
  „Zwykły run”, nagłówek „Tryby areny” i przyciski „Przejęcie”, „Szturm”, „Kradzież rdzenia” (lista „wkrótce” jest pusta).
- Wybór misji pokazuje odprawę zamiast listy i poziomów: nagłówek „Odprawa · <tytuł>”, kwestie dialogu (`dialogueLines`), opcjonalna wstawka (`interlude`:
  tytuł i kwestie), „Wróć do tablicy”; przycisk startu zmienia podpis na „Rozpocznij misję”. „Zwykły run” przywraca „Rozpocznij run”; tryby zmieniają podpis na
  „Rozpocznij Przejęcie” / „Rozpocznij Szturm” / „Rozpocznij Kradzież rdzenia”.
- Poziomy zagrożenia 0..ostatni z `threat.json` (0 Rutyna, 1 Podwyższona czujność, 2 Alarm, 3 Wzmocniony patrol, 4 Obława, 5 Stan wyjątkowy, 6 Blokada
  dzielnicy, 7 Pełna mobilizacja, 8 Nocna czystka, 9 Zero tolerancji, 10 Totalna blokada) jako przyciski „Poziom N · nazwa” pod nagłówkiem „Poziom zagrożenia”.
  Poziomy `<= threat.max` są aktywne, wyższe
  mają `aria-disabled="true"` i podpowiedź „Wygraj na poziomie N, aby odblokować” (N = poprzedni poziom); kliknięcie
  nic nie zmienia ani nie zapisuje. Poziom `max` (gdy `> 0`) ma znacznik „zalecany”. Wybór → `selectThreat` →
  `ctx.save()` → odświeżenie; błąd trafia do linii `role="status"` („Nie można zapisać wyboru.” gdy brak komunikatu).
- Opis wybranego poziomu: „Wrogowie +X% zdrowia, +Y% obrażeń, +Z% liczebności” (z `enemyHealth`, `enemyDamage`,
  `budgetMult − 1`; poziom bez modyfikatorów: „Bez modyfikatorów wrogów”), „Nagrody +N%” (`rewardMult − 1`; przy 1: „Nagrody bez premii”) i „+K Rdzeń/Rdzenie/Rdzeni za
  zwycięstwo” (`victoryCores`, tylko gdy `> 0`).
- Pole opcjonalnego seeda („Seed (opcjonalnie)”, placeholder „losowy”) i przycisk startu → `navigate('?' + params)`, gdzie `loadout=meta`,
  `scene` = `mission` (wybrana misja ma `level`) albo `run`, `seed` = wpisany albo losowy (jeśli wybrano tryb areny i seed pusty — brak `seed`),
  `mission=<id>` dla misji, `mode=<id>` dla trybu; host dokleja `debug=1`. Losowy seed to 4 liczby hex z `crypto.getRandomValues` połączone `-`
  (to UI, nie symulacja). Run czyta wybrany poziom z meta (`RunScene`, `loadout=meta`).
- Testy: `tests/unit/missionsPanel.test.ts`; e2e: `hub.spec.ts` (`meta threat 2` → wybór → run z `threatLevel` 2).

### Pasek meta

`src/ui/hub/metaBar.ts` (+ `metaBar.css`), `createMetaBar(manager, bus)`: stała belka w lewym górnym rogu ekranu kryjówki (`.meta-bar`,
`position: fixed; top: 26px; left: 32px` — `108px` przy `data-debug="true"`, żeby ominąć panel debug; `pointer-events: none`, `z-index 90`, pod nakładkami):
blok tożsamości (nadpis „ISKRA // OPERATOR”, „Poziom L” `600 32px` w cyanie `#00e5ff`, pasek doświadczenia 4 px z podpisem „xp / następny XP” albo „MAX”
i pełnym paskiem na limicie poziomu), „Dane” (ikona `#ffae1a`, wartość `#ffe1a3`), „Rdzenie” (ikona `#ff2bd6`, wartość `#ffb6f3`) i
„Punkty talentów: N” (szare, wyróżnione bursztynem `#ffcf77` z pulsowaniem krycia, gdy `> 0`; pulsowanie wyłączone przy `prefers-reduced-motion`).
Bloki są lekko obrócone w perspektywie (`rotateY(10deg)`). Odświeża się po zdarzeniach `meta_rewards`, `level_up`, `talents_changed`,
`unlock_purchased`, `loadout_changed`, `threat_selected` oraz po każdej komendzie meta (te nie zawsze emitują zdarzenia). Scena tworzy pasek, gdy sama
tworzy nakładki (opcja `metaBar` pozwala to zmienić). Teksty: `missions.pl.json`, sekcja `bar` (`label`, `level`, `xp`, `xpMax`, `data`, `cores`,
`freePoints`), nadpis z `hud.pl.json` (`microOperator`). Testy: `tests/unit/metaBar.test.ts`.

## Reakcje na powrót

Mieszkańcy korzystają z istniejących tekstów `reactions.firstVisit`, `victory`
i `death` w `src/data/hub/npcs.pl.json`. Listy są opcjonalne, ale obecna lista
musi zawierać co najmniej jedną niepustą kwestię. Zwykłe `lines` nie zmieniają się.

Przy wejściu czysta funkcja `hubArrivalContext(meta, greeted)` ustala kontekst:
`stats.runs === 0` daje `firstVisit` z kluczem `first-visit`, inaczej
`lastRuns[0]` daje wynik `victory`/`death` i klucz `runId`. Brak rekordu lub
już przywitany klucz wyłącza reakcje w tej wizycie. Pamięć jest wstrzykiwana przez
`HubSceneOptions.greetings` (`last()`, `mark(key)`); domyślny adapter UI używa localStorage
`neoryder.hub.greeted`, z odczytem i zapisem w try/catch. Brak dostępu do pamięci
nie blokuje sceny: w bieżącej wizycie powitanie występuje najwyżej raz.

Po `hub.arrivalDelayS` (2,5 s, edytowalne w lil-gui) NPC, który ma reakcję dla bieżącego kontekstu i leży najbliżej pozycji startowej gracza
(odległość 3D od `playerSpawn`; w danych: Szron), wypowiada losową kwestię przez istniejące napisy rozmów. Reakcje mają: Mira, Wolan, Szron, Bajt, Tomasz
(firstVisit 2, victory 3, death 3 kwestie) oraz Hela, Zofia, Rudy, Witek, Ola (1 / 2 / 2).
`HubArrival` wybiera tekst deterministycznie (`Rng`, seed `${key}:${npcId}`),
a `HubChatter.say` emituje `hub_chatter_line` z `conversation: 'arrival'`,
pomijając promień rozmów. Po wyświetleniu scena zapisuje klucz powitania. Użycie jukeboxa, miski lub radia przed upływem opóźnienia anuluje powitanie
(rekwizyt ma pierwszeństwo).
Pauza i otwarta stacja zatrzymują odliczanie; aktywna rozmowa E odracza powitanie
do końca dymka. Powitanie korzysta z istniejącego czasu napisów i może być przerwane
przez E lub otwarcie stacji.

Pierwsza rozmowa E z każdym NPC posiadającym reakcję dla kontekstu pokazuje tę
reakcję. U witającego NPC wybór pomija tekst powitania, jeżeli lista zawiera
więcej niż jedną różną kwestię (także gdy gracz zagada przed powitaniem).
Następne rozmowy idą przez zwykłe `lines`, od pierwszej kwestii, w dotychczasowej
pętli. Zapisanie powitania nie usuwa kontekstu trwającej wizyty.

Ręczna próba w 30 s: `?scene=hub&debug=1`, komenda `hub arrive victory`, odczekaj
około 2,5 s i sprawdź napis. `window.__neoryder.query('hubArrival')` zwraca
`{ kind, key, greetedNpc, reacted, pending }` albo `null`. Podejdź do witającego NPC
lub użyj `hub talk <greetedNpc>`: pierwsza kwestia jest inną reakcją, druga zwykłym
tekstem. Powtórz z `hub arrive death` i `hub arrive firstVisit`; komenda czyści
stan reakcji i ponownie planuje powitanie (klucz `debug:<kind>`).

Testy: `hubArrival.test.ts`, `hubGreetings.test.ts`, rozszerzone `hubScene.test.ts`,
`hubNpcs.test.ts` i `hubChatter.test.ts` (kontekst, opóźnienie, odległość, losowanie,
rozmowy E, pamięć między wizytami i brak localStorage).

## Kryjówka po misjach (S2-03, S7-01)

Kryjówka zmienia się po ukończeniu misji dema (`meta.state.campaign.completed`). Wszystkie pola są
opcjonalne, a `missionId` musi istnieć w `src/data/missions/` (sprawdza `assertCampaignMissions` przy
starcie sceny oraz test `hubCampaign.test.ts`). Logika w `src/world/hubCampaign.ts`.

**Teksty (`npcs.pl.json`):**

- `reactions.afterMission: { <missionId>: [kwestie] }` — przy powrocie z tej misji (kontekst `victory` z
  `missionId`, ustalany z `campaign.pendingDebrief`, gdy misja jest ukończona) NPC używa tych kwestii zamiast
  ogólnego `victory`. Pozostali NPC zostają przy `victory`. NPC z samym `afterMission` (bez `victory`) też dostaje
  reakcję, ale tylko po tej misji.
- `campaignLines: [{ after, lines }]` — po ukończeniu `after` kwestie na stałe dołączają do `lines` NPC.
- `conversations[].after` / `until` — rozmowa pojawia się po ukończeniu `after` i znika po ukończeniu `until`.

**Otoczenie i NPC (`hideout.json`):** `panels[]`, `neonTexts[]` i `decor[]` przyjmują `after` / `until`
(widoczne po `after`, do `until`); NPC przyjmuje `campaignPositions: [{ after, position, rotationDeg? }]`
(ostatni pasujący wariant wygrywa, brak `rotationDeg` zostawia bazowy kierunek). Filtr stosuje
`applyHubCampaign` jednorazowo przy starcie sceny; układ po filtrze przechodzi tę samą walidację.

Zmiany dema: po M01 zielony napis „NIECKA: MASZTY CISZA” przy stanowisku Bajta; po M03 skrzynie z
odzyskanego ładunku przy północnej ścianie hali; po M06 duży świecący X (`cross: true` w `neonTexts`, ciepła biel) na mapie tablicy misji i Szron
przy tablicy. Treść: 6 reakcji M01, 4 M03, 6 M06 oraz trwałe kwestie i trzy nowe rozmowy.

**Debug:** `hub campaign <missionId...|clear>` ustawia ukończone misje przez parametr `?campaign=` i
przeładowuje scenę (bez zapisu do IndexedDB, zapis meta nietknięty; parametr działa tylko z konsolą debug).
`hub arrive mission <missionId>` odtwarza powrót z tej misji (reakcje `afterMission`).
Próba w 30 s: `?scene=hub&debug=1`, `hub campaign m01-maszty m03-list-przewozowy m06-odlewnia`, potem
`hub arrive mission m06-odlewnia` i `hub talk szron`.

## Siadanie

Rekwizyt `seat` ma dodatkowe pole `sit: { position, yawDeg }` (wymagane dla `seat`, niedozwolone dla
pozostałych rodzajów): `position` to punkt oka gracza po usiądnięciu (ok. 1,15 m nad podłogą), `yawDeg` kierunek
patrzenia (0 = −Z, jak w `hub tp`). Etykiety „Usiądź” i „Wstań” są w `props.pl.json` (`labels.seat`, `labels.stand`).
Cztery siedziska gracza w `hideout.json`, wszystkie poza miejscami NPC: `seat_platform_couch` (kanapa na peronie B
przy beczce z ogniem; oko (−15,1; 1,15; 9,3), yaw −143°), `seat_canteen_bench` (wolne miejsce na ławie w jadłodajni; (−16,1; 1,15; −13,45), yaw 0°),
`seat_bar_stool` (stołek przy barze; (−3; 1,15; 12,9), yaw 180°), `seat_bunk_edge` (krawędź pryczy w kwaterach; (−1,55; 1,15; −17,2), yaw −90°).

E na siedzisku siada: kamera płynnie (`hub.sitBlendS`, 0,4 s) przechodzi do `sit.position`, a obrót ciągnie się
do `yawDeg`. Potem mysz obraca widok w zakresie ±`hub.sitYawLimitDeg` (100°) wokół `yawDeg`, pitch jak zwykle.
Ciało gracza stoi w miejscu (kontroler jest krokowany z pustym wejściem poza ruchem myszy), więc WASD (które dodatkowo wstaje), skok i dash
są ignorowane; przejście kamery używa krzywej smoothstep po `sitBlendS`, a obrót do `yawDeg` — wygładzenia wykładniczego o stałej `sitBlendS / 3`. Podpowiedź pokazuje klawisz E i „Wstań”. Ponowne E albo naciśnięcie klawisza ruchu (WASD) wstaje: kamera
wraca na pozycję przed siedziskiem. Otwarty plan stacji (M), stacja i dymek rozmowy blokują siadanie jak inne
interakcje (komenda `hub sit` również); `hub tp` i `reset` zdejmują siedzenie od razu. Siedzenie nie emituje
`hub_prop_used`. Stan: `query('hubSeat')`. Ręczna próba w 30 s: `hub tp -16.1 -11.4`, `hub look seat_canteen_bench`,
E; albo `hub sit seat_bar_stool`, poruszaj myszą, `hub stand`.

Testy: `hubScene.test.ts` (siadanie, wstawanie E i WASD, ograniczenie yaw, blokady, komendy), `hubProps.test.ts`
(schemat `seat`, brak siedzisk na NPC), e2e `hub.spec.ts`.

## Znaczniki reakcji

Gdy kontekst przybycia (`HubArrival`) jest aktywny, NPC z jeszcze niewykorzystaną reakcją (pierwsza rozmowa E da
reakcję) mają nad głową mały znacznik: pionowy romb w ciepłej bieli (#fff1d6, jasność HDR dla bloomu), ok. 0,12 m,
lekko pulsujący w czasie klatki. Bryła: ośmiościan o szerokości `markerSizeM · markerWidthRatio` (0,12 × 0,45 m) i wysokości 0,12 m, mnożona przez
`1 + markerPulseAmp · sin(2π · markerPulseHz · t)` (amplituda 0,18, 0,8 Hz); krycie `min(1, 0,75 + (puls − 1) · 1,4)`; kolor `#fff1d6` × `markerGlow` 1,8 (bloom,
bez mgły i testu głębi). Wysokość: `markerHeightM` 2,25 m nad stopami NPC (w układzie NPC, więc razem ze `scale`), obniżona o `markerSeatedDropM` 0,5 m dla
siedzących i `markerLowDropM` 0,7 m dla póz `Crouch_Idle_Loop` i `Fixing_Kneeling`. Znacznik znika, gdy ten NPC jest
bieżącym rozmówcą (dymek E lub mówiący w podsłuchanej rozmowie), i po wykorzystaniu reakcji; bez kontekstu przybycia nie ma żadnych. Geometria i materiał są
współdzielone przez wszystkich NPC (`HubNpcs`), bez alokacji w klatce (`HubArrival.isPending(id)`). Liczby w
`hub.marker*` (`tuning.ts`, lil-gui). `query('hubArrival')` zawiera `pending: string[]` (id NPC ze znacznikiem).

Testy: `hubArrival.test.ts` (`pending`, `isPending`) i `hubScene.test.ts` (pending po wejściu z kontekstem, znika po
rozmowie, brak bez kontekstu). Ręcznie: `hub arrive victory` i rozejrzyj się po NPC.

## Dźwięk otoczenia i pociąg

`HubSoundscape` podpina do AudioSystem trzy grupy źródeł (`{ kind, position, radiusM, gain?, track? }`):
(1) wyciągane z układu przez `hubAmbienceSources` — `fire` przy każdym `fires[]`, `generator` przy każdym bloku z modelem `city_generator`, `drip` i
`steam` z `ambientFx[]` oraz `screens` (ekrany `panels` kind `screen` zgrupowane w skupiska o promieniu ≤ `audio.ambienceScreenClusterM` = 4 m od pierwszego
ekranu, źródło w środku skupiska); promień z `tuning.audio.ambienceProfiles[kind].radiusM`; (2) jawne wpisy `src/data/hub/ambience.json` (7 źródeł):
`crowd` (0; 1,6; −2) r 24 — gwar hali, `jukebox` (−6,8; 1,2; 15,2) r 13 — szafa grająca przy barze na peronie B, `radio` (19,2; 1,2; 12) r 8 — odbiornik
przy biurku Bajta, `cooking` (−17; 1,1; −17,8) r 9 — jadłodajnia, `crowd` (−14; 1,3; −14,8) r 14 gain 0,8, `radio` (5; 1,2; −17,5) r 9 — studio Leny,
`crowd` (−27; 1,5; 12) r 12 gain 0,7 — targ; (3) ruchome źródło `purr` kota. Nowe skrzydła mogą dopisywać źródła do `ambience.json`.
Szczegóły syntezy, głośności i limitów opisuje sekcja „Otoczenie” w audio.md.

`HubTrain` działa w stałym kroku: pierwszy przejazd po 25–40 s, kolejne co
70–140 s od początku poprzedniego, według `ctx.rng.fork('hub-train')`.
Przejazd trwa `trainDurationS` = 7 s i emituje `hub_train_passed { durationS }` na początku; w szczycie (po połowie czasu) lekki
`camera_shake` (`trainShakeIntensity` 0,16, `trainShakeS` 1,5 s, bez kierunku) respektowany przez FpsCamera (`screenShake`) i ciepłoszary pył `#b7ada0`:
`trainDustCount` = 60 sześciennych drobin (pula `trainDustMax` 96) w `trainDustClusters` = 4 skupiskach rozrzuconych w promieniu `trainDustRadiusM` 3 m od gracza
(rozrzut w skupisku 0,45 m), startujących tuż pod sufitem (najniższa dolna krawędź bloku nad graczem albo `playerSpawn.y + 4,4 m`, minus 0,08 m),
opadających z prędkością 0,3 m/s (przyspieszenie −0,8 m/s², dryf ±0,2 m/s), żyjących 3,6 s, rozmiar 0,035 m malejący do zera; znikają po dotknięciu
podłogi. Pył ma stałą pulę i interpolowany render (`InstancedMesh`), nie tworzy ciał Rapiera; parametry są w `hub.train*` i lil-gui. Dźwięk przejazdu:
`trainGain` 0,9, `trainLowHz` 38, `trainFilterHz` 130, `trainToneGain` 0,45 (szczegóły w audio.md).
Pauza zamraża harmonogram i wycisza audio; to samo dzieje się przy otwartej stacji (zegar stoi, więc
`HubScene` przekazuje `HubSoundscape.render(alpha, suspended)`, a audio dostaje `loop.paused || stacja otwarta`),
nawet bez pointer locka, np. po `hub open`. Po zamknięciu stacji dźwięk wraca. Światła pozostają bez zmian:
ich sterowanie jest prywatne w `src/render/**`.

Ręczna próba w 30 s: otwórz `?scene=hub&debug=1`, odblokuj audio kliknięciem,
w konsoli wykonaj `hub train`; po około 3,5 s sprawdź delikatny wstrząs i pył.
`window.__neoryder.query('hubAmbience')` zwraca aktywne źródła i ich gain.

## Spadek napięcia

Co losowy czas (`hub.powerDipIntervalS`, domyślnie 240–480 s od początku poprzedniego;
pierwszy po `powerDipFirstS` 90–180 s, Rng `hub-power-dip`) prąd w kryjówce przygasa na
`powerDipDurationS` (2,5 s). Krzywa (`powerLevel`, `src/world/hubPowerDip.ts`): 3 szybkie
mrugnięcia do `powerDipBlinkLevel` (0,4; każde `powerDipBlinkS` 0,09 s przy przerwie `powerDipBlinkGapS` 0,07 s), liniowy spadek do `powerDipMinLevel`
(0,15) w `powerDipFallS` 0,25 s, ok. 1,26 s ciemności, powrót w `powerDipRiseS` 0,25 s z jednym dodatkowym mrugnięciem po przerwie
`powerDipReturnGapS` 0,1 s. Przy wyłączonym ustawieniu „Błyski ekranu” zamiast
mrugnięć jest łagodny spadek i powrót bez skoków (`powerDipSoftFallS/RiseS`).

Gasną światła punktowe i plamy, lampy, napisy, neony (`neon_*`, `light_white`) i ekrany
(globalny mnożnik `setPowerLevel`, mnożony z migotaniem). Ogień w beczkach i płomienie nie
gasną. Generator, ekrany, jukebox i radio w audio otoczenia cichną proporcjonalnie do poziomu.
Światła kluczowe sceny (ambient, kierunkowe) nie są zmieniane, więc przy minimum ogólna
jasność hali spada tylko o część pochodzącą ze świateł punktowych i emisji.

Po powrocie prądu najbliższy graczowi mieszkaniec z wpisem w `src/data/hub/events.pl.json`
(promień `powerDipCommentRadiusM`, 14 m) mówi losową kwestię przez `HubChatter.say`
(`conversation: 'power_dip'`), o ile nie trwa dymek, rozmowa podsłuchana ani otwarta
stacja/plan. Zdarzenie `hub_power_dip { durationS }` jest emitowane na początku.

Debug: `hub dip` wymusza spadek, `query('hubPower')` → `{ level, active, nextInS }`.
