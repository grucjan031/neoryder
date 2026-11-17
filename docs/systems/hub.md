# Kryjówka (hub) — F4-07

Opcjonalne `lights[].flicker`, `signs[].flicker` oraz `stations[].sign.flicker`
przyjmują `{ pattern: 'buzz' | 'fail' | 'pulse', strength?: 0..1, periodS?: >0 }`.
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

- `src/data/hub/hideout.json`, walidowany przez `src/world/hubSchema.ts` (`loadHubLayout`). Format pokoju:
  `playerSpawn`, `blocks` (`material`, `model` `city_*`), pola oprawy z `dressingSchema` (`theme`, `signs`, `lights`,
  `decals`, `ambientFx`, `decor`) plus pola kryjówki:
  - `blocks[].interactive: true` — jasny obiekt interaktywny (materiał `interactive`, #d9dde3);
  - `stations: { id, position {x,z}, radius, focus {position {x,y,z}, size {x,y,z}}, label, sign? }[]` — `id` z `HUB_STATION_IDS`, środek strefy na podłodze;
    `focus` określa środek i dodatnie wymiary bryły obiektu (dla poligonu: wejścia tunelu);
    `sign` (pozycja, rozmiar, `yaw`, `color`) to neonowy napis z tekstu `label` (płótno, mieszanie addytywne);
  - `blocks[].yaw` — obrót modelu `city_*` wokół środka (wielokrotność 90°; `size` jest już w osiach świata);
    `blocks[].material` ma poza materiałami pokoju także `wood`, `fabric`, `machine`, `paint`, `lacquer`, `plastic`,
    `rubber` i świecące paski `neon_amber|green|violet|blue|white` (bloom);
  - `panels: { kind: 'tiles' | 'screen' | 'poster', texture, position, size, yaw, tileM?, tint? }[]` — okładziny bez collidera:
    `tiles` to kafle ściany (dowolna tekstura z `surfaces/`, powtarzana co `tileM` m, domyślnie 3), `screen` to świecący ekran
    (`screens/screen_*` jako nadruk `mat_screen_*`, bloom), `poster` to nieprzezroczysty plakat, baner albo mural
    (`posters/<texture>.webp`, ładowany przez `HubDecor`, bo `dressingSchema` nie ma tej kategorii), a `tunnel` to
    malowany proceduralnie wylot tunelu (płótno: żebra obudowy, szyny i podkłady zbiegające się w mroku, kable, zielony
    i bursztynowy sygnał; materiał nieoświetlony z bloomem, bez pliku tekstury — `texture` jest tylko nazwą);
  - `npcs: { id, position {x, z, y?}, rotationDeg, animation?, accent, seat?: { heightM, offset {x,y,z} } }[]` — postacie (sekcja „NPC”);
  - `blocks[].shape: 'barrel'` — otwarta beczka z blachy (walec z obręczami i ciemnym wnętrzem), z koliderem walca;
  - `fires: { position, size? }[]` — płomień w beczce (skrzyżowane płaszczyzny z gradientem, addytywnie, bloom, migotanie w `HubDecor.update`).
- Walidacja układu używa `validateLayout` z `roomSchema.ts` (ta sama co spawny pokoi): środki stref i stojących NPC muszą
  leżeć na podłodze na poziomie `playerSpawn.y`, poza blokami i być osiągalne od `playerSpawn` na siatce 1 m (komórka
  1 × 1 m musi mieścić się w jednym bloku podłogi, więc krawędzie podłóg i przejść leżą na całkowitych współrzędnych;
  cienkie nakładki, np. pasy ostrzegawcze, mają dolną krawędź ponad podłogą i nie są przeszkodą). Dodatkowo: jedna
  stacja każdego `id`, jeden NPC każdego `id`, strefy nie nachodzą na siebie (odległość środków ≥ suma promieni).
  Siedzący NPC (`animation` zaczyna się od `Sitting`) wymaga `seat` i siedziska pod miednicą, więc nie podlega walidacji bloków dla stojących postaci.
- Motyw `hideout` (`src/data/themes/hideout.json`, na bazie `neonStreet`): bez deszczu i burzy, bez panoramy
  miasta, ciemniejsza ciepła mgła, słabsze światło kluczowe. Układ definiuje 26 świateł (limit testu: 28), a
  `CityLights` włącza naraz 8 najbliższych kamery (`tuning.city.maxLights`); reszta to emisja i poświata (neony,
  paski `neon_*`, płomień, lampy w wagonie).

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

Kanapę przy zachodniej ścianie peronu B obrócono i przestawiono pod ścianę południową, stolik oraz
dodatkowy stołek przesunięto obok. Dwie niepalące się beczki stoją teraz na targu. Dzięki temu wejście
z targu ma wolne dojście przez peron. Bar zachowuje neon i stołki; jego pełny collider `city_stall`
zastępują lada, blat, słupki i daszek, pozostawiające miejsce za ladą. Pozycje stacji, ich `focus`,
spawn i pięć istniejących NPC pozostają bez zmian. Ekrany i gotowe neony wystarczają do oznaczenia
nowych wnętrz; format danych i kod oprawy nie wymagają rozszerzenia.

### Rezerwacje miejsc dla przyszłych NPC

To wyłącznie przygotowanie scenografii: `npcs` i teksty dialogów nie zawierają nowych postaci.
Wszystkie pozycje mają poziom podłogi y = 0. Obrót NPC: 0 = +Z, 90 = +X, 180 = −Z.
Siedziska mają górną powierzchnię y = 0,48; środek pod miednicą podano w tabeli.
Przyszłe siedzące postacie używają tego samego `seat.heightM: 0.48` i
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
| Bokser                         | {x: 16,1, z: −2,4}    | 90          | wolny kwadrat 2 × 2 m                  |

### Proponowane trasy piesze

Punkty `(x, z)` mają y = 0 i są łączone odcinkami prostymi. Trasy ii i iii są zamknięte,
trasę i można przechodzić w obu kierunkach. Korytarze mają co najmniej 2 m szerokości; test
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

Wszystkie perony i przejścia są na poziomie 0, więc strefy są osiągalne bez skoków (podwójny skok jest talentem);
antresola jest opcjonalna. Na obu końcach niecki torów (x ±20, z 3…8) są wyloty tunelu (`panels` kind `tunnel`) z parą
z niecki i kapaniem. Każda stacja ma własny kolor widoczny z daleka: misje bursztyn (napis `MISJE` nad tablicą),
warsztat zieleń (neon `warsztat`), talenty fiolet (napis `TALENTY` nad wejściem do kącika łączności), poligon błękit
(napis i światło nad wejściem). Na blacie warsztatu stoją pomniejszone modele (`city_generator`, `city_crates`). Neony `iskra`, `warsztat`, `sign_bar` i `metro`, ekrany `screen_talents`, `screen_missions`,
`screen_comms`, `screen_status`, `screen_menu`, `screen_map`, `screen_news`, plakaty `poster_iskra_recruit` i
`poster_koalicja_defaced` na hali, graffiti; para z kratki, kapanie, iskry (także z beczki), lampiony, kable i paski
neonowe na filarach.

## Stacje i strefy

`selectHubFocus` i `HubStations` (`src/world/hubStations.ts`, bez DOM i Three.js, testowalne w Vitest):

- wybór (`selectHubTarget`: stacje i NPC razem, `selectHubFocus` zwraca tylko stację) wymaga przecięcia promienia z oka
  gracza w kierunku kamery (yaw + pitch) z AABB `focus` stacji lub NPC, powiększonym z każdej strony o `tuning.hub.focusPaddingM` (0,2 m). Odległość od oka
  do trafienia musi być ≤ `tuning.hub.interactRangeM` (3,5 m). Wygrywa najbliższe trafienie,
  także z bliska i przy spojrzeniu w dół. Wysokość oka uwzględnia przysiad;
  `radius` nie ogranicza interakcji;
- samo wejście w promień niczego nie otwiera. Dopiero zbocze naciśnięcia E (istniejąca akcja `power2`,
  nazwana w scenie `HUB_INTERACT_ACTION`) otwiera wybraną stację i emituje `hub_station_opened { station }`;
  `HubScene` nasłuchuje tego zdarzenia i pokazuje nakładkę przez `HubScreens.show`;
- `HubPrompt` (`src/ui/hubPrompt.ts`) pokazuje klawisz E w ramce i `label` stacji na środku dolnej części ekranu
  (dla NPC: „Porozmawiaj” z imieniem nad etykietą, trzeci argument `update`).
  Podpowiedź znika przy braku stacji w celowniku lub otwartej nakładce. Teksty: sekcja `hub` w
  `src/data/ui/meta.pl.json`; aktualizacja DOM podpowiedzi odbywa się podczas renderowania;
- przy otwartej stacji gracz stoi w miejscu (scena nie krokuje kontrolera ani fizyki), a kursor jest zwolniony
  (`HtmlHubScreens.show` robi `exitPointerLock`, jak ekrany runu);
- przy otwartej nakładce E nic nie robi. Po zamknięciu nowe naciśnięcie E może otworzyć tę samą stację
  bez wychodzenia ze strefy; nie ma histerezy ani automatycznego ponownego otwierania. Pierwszy snapshot wejścia
  po zamknięciu ignoruje interakcję, aby odrzucić zaległe E z czasu pauzy, gdy pętla nie wykonywała kroków;
- zamknięcie (`Zamknij`, Esc, `hub close`) wywołuje `ctx.resume`, więc gra wraca do przechwyconej myszy.

Stacje: `talents` (terminal drzewek, kącik łączności), `workshop` (stół w wagonie), `missions` (tablica misji w hali),
`arena` (tunel na poligon).

## NPC

Pięć postaci (nie wrogowie): Mira (mechaniczka, wagon-warsztat), Doktor Wolan (badaczka Rezonansu, przy terminalu),
Kapitan Szron (koordynator, przy tablicy misji), Bajt (haker, siedzi przy ekranach w kąciku łączności), Stary Tomasz
(weteran, siedzi przy beczce z ogniem).

- **Dane:** `hideout.json` → `npcs: { id, position {x, z, y?}, rotationDeg, animation?, accent, scale?, seat?, route? }[]`
  (`hubNpcSchema`, `src/world/hubSchema.ts`). `rotationDeg` to kierunek patrzenia na podłodze: 0 = +Z (w stronę
  torów), 90 = +X, 180 = −Z. `animation` to klip z `public/assets/models/npc_anims.glb` (`Idle_Loop`, `Idle_Talking_Loop`,
  `Idle_Torch_Loop`, `Sitting_Idle_Loop`, `Sitting_Talking_Loop`, `Fixing_Kneeling`, `Crouch_Idle_Loop`, `Interact`, `Walk_Loop`, `Jog_Fwd_Loop`, `Dance_Loop`, `PickUp_Table`,
  `Punch_Jab`, `Punch_Cross`, `Sword_Idle`, `Spell_Simple_Idle_Loop`, `Push_Loop`;
  domyślnie `Idle_Loop`), `accent` ∈ `amber|green|violet|blue|white` (paleta ADR 0006; każdy NPC inny).
- **Siedziska:** dla siedzących `position` oznacza punkt na podłodze pod miednicą i środkiem siedziska.
  `seat.heightM` to wysokość jego górnej powierzchni nad tym punktem, a `seat.offset` to wektor od środka tej
  powierzchni do korzenia modelu, w lokalnych osiach NPC. `npcRootPosition` obraca offset wraz z tułowiem,
  zachowując miednicę nad nieruchomym stołkiem. Focus i kolider pozostają przy `position`.
  Pomiar `node tools/hub/measureSeatedPose.mjs` odtwarza klipy `npc_anims.glb` na `enemy_trooper.glb`:
  miednica `DEF-hips` ma lokalne położenie `(0,002812; 0,543908; −0,333626) m`, podeszwa `−0,000613 m`.
  Dla obu pętli siedzenia stołek ma wysokość `0,48 m`, offset korzenia `(−0,002812; −0,48; 0,333626) m`;
  miednica leży `0,063908 m` nad siedziskiem, stopy na podłodze. Biurko Bajta ma otwartą przestrzeń na nogi.
  `hubSeating.test.ts` sprawdza prawdziwy klip w 121 próbkach i trzech kątach tułowia: ±0,08 m nad siedziskiem,
  podparcie w X/Z oraz obie stopy i skórkowaną podeszwę przy podłodze.
- **Wygląd (`src/scenes/hubNpcs.ts`, `HubNpcs`):** ten sam manekin UAL co wrogowie (`enemy_trooper.glb`, tylko ciało
  `armored_body`, bez płyt, broni i wizjera) w materiale toon grafit/granat (każdy NPC inny odcień) ze słabą poświatą
  krawędzi w kolorze akcentu (bez czerwieni wrogów). Niebojowe akcesoria na głowie (czapka, gogle, okulary,
  słuchawki) i ubiór na kościach `DEF-spine003` / `DEF-hips`: kamizelka w jaśniejszym odcieniu, kołnierz, pas
  ze świecącą klamrą i pasek akcentu oraz rekwizyt roli (Mira — ładownice i klucz, Wolan — poły płaszcza,
  Szron — pagony i naszywka, Bajt — plecak z ekranem, Tomasz — ładownice i płyta na plecach). Klipy bezczynne z `npc_anims.glb` (wycięte z Quaternius UAL CC0 skryptem
  `tools/hub/extractNpcAnimations.mjs`, 2 851 548 bajtów; źródło `tools/blender/sources/ual/`), przesunięte w czasie i lekko
  różne tempem, żeby NPC nie byli zsynchronizowani. Bez modelu (testy, `loadModels: false`) zostają collider i dialog.
- **Obrót do gracza:** w zasięgu `tuning.hub.npcTurnRangeM` NPC obraca głowę i szyję (kości `DEF-head`, `DEF-neck`;
  obrót wokół osi Y świata, `npcHeadMaxRad`) i powoli tułów (`npcTurnSpeedRadS`, do `npcStandBodyMaxRad` /
  `npcSeatedBodyMaxRad` od kierunku bazowego); po odejściu gracza wraca do pozy bazowej. Czysta logika:
  `updateNpcLook` (`src/world/hubNpcs.ts`).
- **Kolizja:** statyczny NPC ma nieruchomy collider walca (promień 0,4 m; 1,8 m wysokości, siedzący 1,35 m), grupa świata.
  `focus` NPC wylicza `npcFocusBox` z tego kolidera.
- **Rozmowa:** spojrzenie na NPC w zasięgu pokazuje „[E] Porozmawiaj” z imieniem; E pokazuje u dołu ekranu dymek
  (`HubDialog`, `src/ui/hubDialog.ts`, styl „wizjer”): imię, rola i jedna kwestia. Kolejne E (na tego samego NPC)
  daje następną kwestię w pętli (`NpcDialogue`, osobny licznik na NPC), dymek znika po `tuning.hub.npcLineS` (5 s) albo
  po odejściu gracza dalej niż zasięg interakcji + 1 m; otwarcie stacji też go zamyka. Podczas rozmowy podpowiedź
  jest ukryta. Teksty: `src/data/hub/npcs.pl.json` (`{ talkPrompt, npcs: [{ id, name, role, lines[] }] }`, schemat
  `npcTextsSchema`; id muszą pasować do `hideout.json`).

### Skala, trasy i podsłuchane rozmowy

- `scale` jest opcjonalne (0,55–1,15; domyślnie 1; dzieci: 0,68). Skaluje model, promień i wysokość
  walca, focus oraz lokalny `seat.offset`. `seat.heightM` pozostaje fizyczną wysokością istniejącego siedziska.
- `route`: `points` (co najmniej 2 punkty X/Z), `mode` (`loop`, domyślnie, albo `pingpong`),
  `speedMS` (domyślnie `npcWalkSpeedMS`), `pauseS` (domyślnie 0, także w punkcie startowym),
  `moveAnimation` (domyślnie `Walk_Loop`) i `pauseAnimation` (domyślnie animacja NPC albo `Idle_Loop`).
  `position` musi równać się pierwszemu punktowi; trasa wyklucza siedzenie i animacje siedzące.
- `stepNpcRoute` i `NpcRuntime` w `src/world/hubNpcs.ts` działają w stałym kroku bez Three.js/DOM/RNG.
  Stan trasy (pozycja, segment, kierunek, yaw, pozostały postój, ruch) można zapisać jako JSON.
  Tułów obraca się z `npcWalkTurnRadS`. Gracz w stożku kierunku ruchu (`npcYieldConeCos`) bliżej niż
  `npcYieldRadiusM` zatrzymuje NPC do zwolnienia drogi. Dymek E zatrzymuje adresata i kieruje jego wzrok
  do gracza; po dialogu postać wraca na trasę. Statyczni NPC zachowują dotychczasowy zakres patrzenia,
  ale stan obrotu jest teraz aktualizowany w `step`, a nie w renderze.
- Trasy mają walce na `kinematicPositionBased`, przesuwane przed krokiem świata fizyki; zatrzymują
  character controller gracza tak samo jak statyczne walce. Focus i debug używają bieżącej pozycji.
  Render interpoluje poprzednią i bieżącą pozycję oraz yaw (najkrótszy łuk). Zmiana klipu używa
  `npcAnimFadeS`; wszystkie klipy, także `PickUp_Table` i `Punch_*`, są zapętlone. Ekstraktor zeruje
  poziome translacje kości `root` w `Walk_Loop` i `Jog_Fwd_Loop`: przesunięcie pochodzi tylko z trasy.
- Walidacja sprawdza punkty i odcinki co `npcRouteSampleM` (0,25 m), w `loop` również ostatni→pierwszy:
  podłoga na `playerSpawn.y`, zapas promienia walca od krawędzi i bloków, co najmniej
  `npcRouteStaticClearanceM` (0,9 m) od statycznych NPC. Istniejąca walidacja osiągalności startu pozostaje.
- Odległe od kamery postacie (ponad `npcAnimFarM`, 18 m) krokują mixer co `npcAnimFarFrames` (3) klatki,
  sumując dt. Interpolacja pozycji nadal działa co klatkę; pętla widoków nie tworzy obiektów tymczasowych.
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
  (`src/ui/hubChatter.ts`, CSS) rysuje mniejsze, półprzezroczyste napisy nad dymkiem/podpowiedzią,
  z imieniem w akcencie NPC. DOM zmienia się tylko w renderze i przy zmianie kwestii; wejście jest
  łagodne, a `prefers-reduced-motion` wyłącza animację.
- Strojenie wszystkich nowych parametrów znajduje się w `tuning.hub`, automatycznie widocznym w lil-gui.
- Debug: `hub chatter <id>` wymusza start bez zasięgu i odnowienia (cała wymuszona rozmowa ignoruje
  dystans; E/stacja nadal ją przerywa). `query('hubChatter')` → `{ conversation, npc, text } | null`;
  `query('npcs')` zawiera aktualne X/Y/Z i yaw chodzących NPC.
- Testy: `hubNpcLife.test.ts` (trasy loop/pingpong, postoje, ustępowanie, dialog, determinizm i JSON,
  skala/focus/siedzisko, walidacja tras i rozmów, 17 klipów i brak poziomego ruchu korzenia),
  `hubNpcView.test.ts` (prawdziwe GLB: interpolacja/skala, crossfade, pętle, sumowanie dt odległych mixerów),
  `hubChatter.test.ts` (promień, środek ruchomych uczestników, czas, przerwy, odnowienie, przerwania,
  jedna rozmowa, debug, determinizm), `hubChatterUi.test.ts` (jsdom i brak zbędnych zmian DOM),
  `hubScene.test.ts` z `tests/fixtures/hubLife.ts` (bez DOM: ruch, E/stacja/debug, zdarzenie i kolizja
  skalowanego ciała kinematycznego). Dane produkcyjne nie są potrzebne do demonstracji tych rozszerzeń.

Przykład NPC do `npcs` w układzie (pozycje wymagają wolnej podłogi):

```json
{
  "id": "ada", "position": { "x": 0, "z": 0 }, "rotationDeg": 90,
  "scale": 0.68, "accent": "amber", "animation": "Idle_Loop",
  "route": {
    "points": [{ "x": 0, "z": 0 }, { "x": 4, "z": 0 }],
    "mode": "pingpong", "speedMS": 1.3, "pauseS": 2,
    "moveAnimation": "Walk_Loop", "pauseAnimation": "Idle_Loop"
  }
}
```

Przykład wpisu do `conversations` w tekstach (oba id muszą istnieć w układzie):

```json
{
  "id": "ada_mira", "npcs": ["ada", "mira"], "radiusM": 5,
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
stacja bez fabryki w rejestrze (`arena`) zostaje zaślepką: tytuł i opis, „Przejdź na poligon” → `?scene=arena`
oraz „Zamknij” (Esc też zamyka). Nawigacja zachowuje `?debug=1`. Teksty zaślepek: `src/data/ui/meta.pl.json`,
sekcja `hub`. `HubScreens` ma opcjonalne `refresh()`: scena woła je po zdarzeniach meta, a nakładka przekazuje je
do otwartego panelu.

## Menu główne

`src/ui/mainMenu.ts`: „Kryjówka” (główny przycisk → `?scene=hub`), „Kontynuuj run”, „Poligon”. „Nowy run (presety)”
z polem seeda, `BuildSelect` i przycisk „Sceny debug” (→ `?scenes=1`, z `debug=1`, jeśli był) pojawiają się tylko w
trybie debug (`?debug=1` albo `npm run dev`). Bez `?scene=` gra zawsze pokazuje menu gry; lista scen debug jest pod
`?scenes=1` (tylko w trybie debug, `src/ui/sceneMenu.ts`).

## Debug

- `hub open <talents|workshop|missions|arena>`, `hub close`;
- `hub look <talents|workshop|missions|arena|npc>` — obraca kamerę na środek bryły `focus` stacji albo NPC (id z
  `hideout.json`) w następnym kroku;
- `hub talk <npc>` — pokazuje kolejną kwestię NPC bez patrzenia na niego (nie wymaga bliskości; znika po 5 s);
- `hub tp <x> <z> [yawDeg] [pitchDeg]` — teleport gracza (yaw 0 patrzy w −Z; ruch myszy symulowany w następnym
  kroku); teleport nie otwiera nakładki;
- `query('hubStation')` (otwarta stacja albo `null`), `query('hubFocus')` (stacja w celowniku albo `null`),
  `query('hubNpc')` (id NPC w celowniku albo `null`), `query('hubTalk')` (bieżąca kwestia `{ id, name, role, line }`
  albo `null`), `query('npcs')` (id, pozycja i `bodyYaw` NPC),
  `query('playerPos')`, `query('stations')`, `query('meta')`
  (stan meta), `query('level')` (poziom, XP, punkty);
- komendy meta (`registerMetaCommands`): `meta state|xp|data|cores|threat|unlock all|reset`; `meta threat <n>` ustawia
  `threat.max` (odblokowanie kolejnych Poziomów zagrożenia bez grania); po każdej komendzie pasek i panel się odświeżają;
- `reset` wraca na `playerSpawn`.

## Testy

`tests/unit/hubLayout.test.ts` (walidacja układu: stacje w granicach i osiągalne, strefy rozłączne, paleta, zasoby),
`hubStations.test.ts` (ray–AABB, zasięg, najbliższe trafienie, otwieranie na żądanie), `hubPrompt.test.ts` (jsdom, podpowiedź),
`hubScene.test.ts` (scena bez DOM: spojrzenie i zbocze E, komendy, zatrzymanie ruchu, niecka torów,
nawigacja, `dispose` bez subskrypcji, meta, NPC: cel `hubNpc`, kwestie w pętli, wygasanie dymka, kolidery, obrót),
`hubNpcs.test.ts` (teksty NPC, kolejność kwestii, `focus` z kolidera, `selectHubTarget`, `updateNpcLook`),
`hubDialog.test.ts` (jsdom, dymek), `hubScreens.test.ts` (jsdom, hostowanie paneli),
`missionsPanel.test.ts`, `metaBar.test.ts`, `mainMenu.test.ts`; e2e: `tests/e2e/hub.spec.ts`.
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
Antresola: `hub tp -12 1.4 0` i trzymać W (schody). Kładka: `hub tp 5.5 3.6 180`; łączność: `hub tp 9.2 10.6 262`.

### Terminal drzewek

`src/ui/hub/talentsPanel.ts` (+ `talentsPanel.css`) eksportuje `createTalentsPanel: HubPanelFactory` (kontrakt:
`src/ui/hub/hubPanel.ts`). Panel czyta i zmienia wyłącznie `MetaManager`; montuje go nakładka stacji `talents`.

- Nagłówek: „Wolne punkty: N”, „Poziom L”. Trzy kolumny (Ostrze, Rezonans, Strzelec) z węzłami pogrupowanymi wg
  progu 1–4 (podpis: wymagane punkty w drzewku i bieżąco wydane), pod nimi „Hybrydy”.
- Karta węzła to `<button>`: nazwa, koszt, stan kupiony / dostępny / zablokowany z krótkim powodem
  („wymaga: <nazwa>”, „próg: N pkt w drzewku”, „wymaga 3 pkt w Ostrze i 3 pkt w Rezonans”, „za mało punktów”).
  Niedostępne karty mają `aria-disabled="true"` i nie wołają `buyTalent`. Opis węzła w panelu szczegółów po
  najechaniu lub fokusie.
- Kupno: klik/Enter/Spacja → `buyTalent` → `await ctx.save()` → odświeżenie kart (bez przebudowy DOM, fokus
  zostaje). Błąd `buyTalent` trafia do linii statusu (`role="status"`).
- Reset: „Resetuj talenty” → „Potwierdź reset” (wygasa po `RESET_CONFIRM_MS` = 4 s) → `resetTalents` → zapis.
- Reguły stanu węzła: czysta funkcja `talentNodeState` (`src/ui/hub/talentState.ts`) odwzorowuje `buyTalent`
  (wymagane węzły, próg drzewka, punkty w drzewkach, wolne punkty); testy: `tests/unit/talentsPanel.test.ts`.
- Akcenty drzewek: Ostrze cyan, Rezonans magenta, Strzelec bursztyn, Hybrydy fiolet. Teksty:
  `src/data/ui/talents.pl.json`.

### Warsztat

`createWorkshopPanel` (`src/ui/hub/workshopPanel.ts`, kontrakt `HubPanel`) to samodzielny panel stacji `workshop`;
podpięty w rejestrze paneli sceny kryjówki. Nagłówek pokazuje Dane, Rdzenie i poziom gracza.

- **Odblokowania:** lista pogrupowana (Bronie, Moce, Ostrza, Sloty) wg `unlocks.json`; startowe pozycje są pokazane
  jako „Posiadane”. Wiersz: nazwa, cena (Dane i/lub Rdzenie) i stan: „Posiadane”, „Wymagany poziom N”, „Za mało
  Danych” / „Za mało Rdzeni” (kolejność sprawdzeń jak w `buyUnlock`) albo aktywny przycisk „Kup”. Niedostępny
  przycisk ma `disabled`. Kup → `buyUnlock` → `ctx.save()` → odświeżenie.
- **Ekwipunek:** ostrze (jedno z odblokowanych), bronie i moce jako przełączniki z limitem `weaponSlots` /
  `powerSlots` (licznik „Bronie: 1/2”; kolejność wyboru = kolejność slotów, pierwsza broń to slot 1). UI blokuje
  ponad limit i odznaczenie ostatniej pozycji, zanim zmiana trafi do `setLoadout`. Każda zmiana → `setLoadout` →
  `save` → odświeżenie.
- **Błędy:** `Error` z `MetaManager` (lub z zapisu) trafia do linii `role="status"`; stan zostaje bez zmian.
- **Logika bez DOM:** `src/ui/hub/workshopState.ts` (`unlockRows`, `groupRows`, `equipmentState`,
  `toggleSelection`, `nextLoadout`); nazwy broni i mocy z definicji (`name`), nazwy ostrzy i slotów z
  `src/data/ui/workshop.pl.json` (ostrza nie mają pola `name`). Styl: `workshopPanel.css`.
- Testy: `tests/unit/workshopPanel.test.ts` (jsdom + czyste funkcje).

### Panele stacji

Kontrakt: `src/ui/hub/hubPanel.ts` (`HubPanelContext { manager, save, navigate, close }`, `HubPanel { root, refresh,
dispose }`, `HubPanelFactory`). `HubScene` (`src/scenes/hub.ts`) przy `init` wczytuje meta (`loadMetaManager(store,
bus)`; `store` z opcji `metaStore`, domyślnie IndexedDB), rejestruje komendy meta (`registerMetaCommands`, sprzątane w
`dispose`) i buduje `HtmlHubScreens` z rejestrem `Partial<Record<HubStationId, HubPanelFactory>>`:
`missions: createMissionsPanel`, `talents: createTalentsPanel`, `workshop: createWorkshopPanel` (opcja `panels`
podmienia rejestr). `show(station)` montuje panel w treści nakładki (pod tytułem, nad „Zamknij”; nakładka jest wtedy
szersza, klasa `hub-screen--panel`), a `hide()`, kolejne `show()` i `dispose()` wołają `panel.dispose()`. Kontekst:
`save` = `saveMetaManager(store, manager)`, `navigate` doklejający `debug=1` z URL sceny, `close` zamyka nakładkę
(wznawia ruch). Po zdarzeniach meta scena woła `screens.refresh()` → `panel.refresh()`.

### Tablica misji

`src/ui/hub/missionsPanel.ts` (+ `missionsPanel.css`), `createMissionsPanel`; teksty `src/data/ui/missions.pl.json`
(sekcja `missions`).

- Karta sektora „Kurogane Arms” (nazwa i krótki opis).
- Poziomy zagrożenia 0..ostatni z `threat.json` jako przyciski z nazwą. Poziomy `<= threat.max` są aktywne, wyższe
  mają `aria-disabled="true"` i podpowiedź „Wygraj na poziomie N, aby odblokować” (N = poprzedni poziom); kliknięcie
  nic nie zmienia ani nie zapisuje. Poziom `max` (gdy `> 0`) ma znacznik „zalecany”. Wybór → `selectThreat` →
  `ctx.save()` → odświeżenie; błąd trafia do linii `role="status"`.
- Opis wybranego poziomu: „Wrogowie +X% zdrowia, +Y% obrażeń, +Z% liczebności” (z `enemyHealth`, `enemyDamage`,
  `budgetMult`; poziom 0: „Bez modyfikatorów wrogów”), „Nagrody +N%” (`rewardMult`) i „+K Rdzeń/Rdzenie/Rdzeni za
  zwycięstwo” (`victoryCores`, tylko gdy `> 0`).
- Pole opcjonalnego seeda i „Rozpocznij run” → `navigate('?scene=run&loadout=meta&seed=<seed lub losowy>')`; host
  dokleja `debug=1`. Losowy seed z `crypto.getRandomValues` (to UI, nie symulacja). Run czyta wybrany poziom z meta
  (`RunScene`, `loadout=meta`).
- Testy: `tests/unit/missionsPanel.test.ts`; e2e: `hub.spec.ts` (`meta threat 2` → wybór → run z `threatLevel` 2).

### Pasek meta

`src/ui/hub/metaBar.ts` (+ `metaBar.css`), `createMetaBar(manager, bus)`: stała belka u góry ekranu kryjówki
(`.meta-bar`, `pointer-events: none`, pod nakładkami): „Poziom L”, pasek doświadczenia z podpisem „xp / następny XP”
(na limicie poziomu „MAX” i pełny pasek), „Dane”, „Rdzenie”, „Wolne punkty: N” (wyróżnione bursztynem, gdy `> 0`).
Odświeża się po zdarzeniach `meta_rewards`, `level_up`, `talents_changed`, `unlock_purchased`, `loadout_changed`,
`threat_selected` oraz po każdej komendzie meta (te nie zawsze emitują zdarzenia). Scena tworzy pasek, gdy sama
tworzy nakładki (opcja `metaBar` pozwala to zmienić). Teksty: `missions.pl.json`, sekcja `bar`.
Testy: `tests/unit/metaBar.test.ts`.

## Dźwięk otoczenia i pociąg

`HubSoundscape` podpina do AudioSystem źródła wyciągane z układu i jawne wpisy
`src/data/hub/ambience.json`: gwar hali, jukebox przy barze na peronie B oraz
radio przy biurku Bajta. Nowe skrzydła mogą dopisywać źródła do tego pliku.
Szczegóły syntezy, głośności i limitów opisuje sekcja „Otoczenie” w audio.md.

`HubTrain` działa w stałym kroku: pierwszy przejazd po 25–40 s, kolejne co
70–140 s od początku poprzedniego, według `ctx.rng.fork('hub-train')`.
Przejazd trwa 7 s i emituje `hub_train_passed` na początku; w szczycie lekki
`camera_shake` respektowany przez FpsCamera (`screenShake`) i ciepłoszary pył
z kilku skupisk pod sufitem w pobliżu gracza. Pył ma stałą pulę i interpolowany
render, nie tworzy ciał Rapiera; parametry są w `hub.train*` i lil-gui.
Pauza zamraża harmonogram i wycisza audio. Światła pozostają bez zmian:
ich sterowanie jest prywatne w `src/render/**`.

Ręczna próba w 30 s: otwórz `?scene=hub&debug=1`, odblokuj audio kliknięciem,
w konsoli wykonaj `hub train`; po około 3,5 s sprawdź delikatny wstrząs i pył.
`window.__neoryder.query('hubAmbience')` zwraca aktywne źródła i ich gain.
