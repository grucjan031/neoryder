# Kryjówka (hub) — F4-07

## Rekwizyty

`hideout.json.props` definiuje `id`, `kind` (`jukebox`, `noodles`, `radio`, `bag`, `seat`),
`label` i `focus` o dodatnich wymiarach, takim jak dla stacji. Id są unikalne.
E używa najbliższego trafienia promieniem z oka spośród stacji, NPC i rekwizytów
w `interactRangeM`; podpowiedź pokazuje E i etykietę. Przytrzymanie nie powtarza
użycia. Teksty i nazwy utworów są w walidowanym `src/data/hub/props.pl.json`.

- Szafa grająca na peronie B przełącza utwory 0→1→2→0 (start: „Ostatni peron”,
  dalej „Deszcz na kredyt”, „Świt odwołany”). Trzy oryginalne frazy basu i padów
  mają inne tempa i akordy; źródło ambience otrzymuje `track`. Chatter podaje
  nazwę utworu jako „Szafa grająca”.
- Lada Heli: „Zjedz miskę” losuje kwestię z danych przez `Rng.fork('hub-props')`.
  Przez 2 s ciepłe przyciemnienie krawędzi zanika nad canvasem. CSS wyłącza je
  przy `prefers-reduced-motion: reduce`, pozostawiając komunikat.
- Radio na biurku Leny wymusza `lena_radio_broadcast`; następne E wyłącza
  audycję także podczas przerwy między kwestiami i przed końcem cooldownu.
- Worek w hali ma osobną siatkę `fabric` z obręczą `rubber` i liną do sufitu.
  E lub zbocze ataku w zasięgu nadaje impuls w kierunku spojrzenia. Wahadło X/Z
  integruje kąt i prędkość w `step()`, render interpoluje poprzedni i bieżący kąt.
  Tłumienie zatrzymuje ruch; brak collidera zapobiega zakleszczeniu gracza.
  Reguła `hub_prop_used` z `kind: 'bag'` wybiera miękki dźwięk `bagHit`.

Każde zaakceptowane użycie emituje `hub_prop_used { prop, kind }`.
Cooldown per id: `tuning.hub.propCooldownS = 1`, dla miski
`noodlesCooldownS = 20`. Parametry wahadła i wyglądu liny: `tuning.hub.bag*`.
`hub use <propId>` pomija dystans, zachowuje cooldown; `query('hubProps')`
zwraca `{ id, kind, cooldownLeft, track?, angle? }[]`. `hub look <propId>`
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
rzadką awarię co 25 s. Dwie lampy korytarza mają `fail` (17/21 s), lampa
przy wschodnim generatorze i neon metra — słabe `buzz`.

Trzy strzałki ze ściany hali leżą teraz na podłodze korytarza na y=0,012 m,
z=−9,75 m: dwie kierują na zachód ku jadłodajni, jedna na wschód ku radiu.
Jaśniejsze okładziny `tiles_wall` na istniejących ścianach poprawiają orientację
bez dodatkowych świateł (nadal 28) i colliderów. Drzwi, przejście ≥2 m,
pozycje NPC oraz ich trasy pozostają bez zmian.

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
  - `neonTexts?: { text, position {x,y,z}, size {w,h}, yaw, color, flicker? }[]` — niezależne napisy oprawy,
    rysowane tak samo jak `sign` stacji; `color` to wyłącznie `#ffae1a`, `#6dff4a`, `#8a5cff`,
    `#3d7bff` lub `#fff1d6`. Oznaczenia: NA ANTENIE, JADŁODAJNIA, KWATERY, RADIO ISKRA i TARG;
  - `blocks[].yaw` — obrót modelu `city_*` wokół środka (wielokrotność 90°; `size` jest już w osiach świata);
    `blocks[].material` ma poza materiałami pokoju także `wood`, `fabric`, `machine`, `paint`, `lacquer`, `plastic`,
    `rubber` i świecące paski `neon_amber|green|violet|blue|white` (bloom);
  - `panels: { kind: 'tiles' | 'screen' | 'poster', texture, position, size, yaw, tileM?, tint? }[]` — okładziny bez collidera:
    `tiles` to kafle ściany (dowolna tekstura z `surfaces/`, powtarzana co `tileM` m, domyślnie 3), `screen` to świecący ekran
    (`screens/screen_*` jako nadruk `mat_screen_*`, bloom), `poster` to nieprzezroczysty plakat, baner albo mural
    (`posters/<texture>.webp`, ładowany przez `HubDecor`, bo `dressingSchema` nie ma tej kategorii), a `tunnel` to
    malowany proceduralnie wylot tunelu (płótno: żebra obudowy, szyny i podkłady zbiegające się w mroku, kable, zielony
    i bursztynowy sygnał; materiał nieoświetlony z bloomem, bez pliku tekstury — `texture` jest tylko nazwą);
  - `npcs: { id, position {x, z, y?}, rotationDeg, animation?, accent, scale?, route?, look?, seat?: { heightM, offset {x,y,z} } }[]` — postacie (sekcja „NPC”);
  - `blocks[].shape: 'barrel'` — otwarta beczka z blachy (walec z obręczami i ciemnym wnętrzem), z koliderem walca;
  - `fires: { position, size? }[]` — płomień w beczce (skrzyżowane płaszczyzny z gradientem, addytywnie, bloom, migotanie w `HubDecor.update`).
- Walidacja układu używa `validateLayout` z `roomSchema.ts` (ta sama co spawny pokoi): środki stref i stojących NPC muszą
  leżeć na podłodze na poziomie `playerSpawn.y`, poza blokami i być osiągalne od `playerSpawn` na siatce 1 m (komórka
  1 × 1 m musi mieścić się w jednym bloku podłogi, więc krawędzie podłóg i przejść leżą na całkowitych współrzędnych;
  cienkie nakładki, np. pasy ostrzegawcze, mają dolną krawędź ponad podłogą i nie są przeszkodą). Dodatkowo: jedna
  stacja każdego `id`, jeden NPC każdego `id`, strefy nie nachodzą na siebie (odległość środków ≥ suma promieni).
  Siedzący NPC (`animation` zaczyna się od `Sitting`) wymaga `seat` i siedziska pod miednicą, więc nie podlega walidacji bloków dla stojących postaci.
- Motyw `hideout` (`src/data/themes/hideout.json`, na bazie `neonStreet`): bez deszczu i burzy, bez panoramy
  miasta, ciemniejsza ciepła mgła, słabsze światło kluczowe. Układ definiuje 28 świateł (limit testu: 28), a
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
spawn i pięć istniejących NPC pozostają bez zmian. Ekrany i gotowe neony uzupełniają oznaczenia
nowych wnętrz z opcjonalnej tablicy `neonTexts`.

Uzupełnienie oprawy skrzydła północnego: kwatery mają pięć miejsc do spania (dwie prycze piętrowe),
zasłony, koce z przygaszonymi akcentami tkanin `tiles/tarp`, walizki, dywaniki, ubrania na wieszaku,
pranie pod sufitem, książki, kubki, plakaty, puszkę farby i grzejnik. Dolna prycza mieszkańca zachowuje
siedzisko na 0,48 m. Radio ma wysunięty regał odbiorników z ekranami i błękitnymi paskami, mikrofon
na wysięgniku, słuchawki, mikser, wiązki kabli, wygłuszenie `tarp`/`rubber` i baner Iskry. W korytarzu
dodano rury, przewody, lampy kratowe co 4 m (naprzemiennie bursztyn i ciepła biel), skrzynki, beczki,
kratkę z parą, kapanie, graffiti, naklejki i malowane strzałki. Dwa nowe światła punktowe korytarza mają
krótki zasięg; kwatery korzystają z dwóch istniejących. Mniejszy neon METRO przy treningu przesunięto
wyżej i wzdłuż ściany, poza bezpośrednie tło worka; istniejące światło skierowano na jego widoczną stronę.
Budżety scalania, stacje, `npcs`, rezerwacje i trasy pozostają bez zmian. Kontrola z kamer:
`hub tp -4.5 -12 0 -15`, `hub tp 4.5 -12.5 0 -12`, `hub tp 4.5 -9.75 90 -8`,
`hub tp 15.5 -1 -120 -10`.

### Miejsca mieszkańców i rezerwacje

Miejsca poniżej zajmują mieszkańcy z listy NPC; jedzący C i D pozostają wolnymi rezerwacjami.
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

21 postaci (nie wrogowie). Pięć kluczowych: Mira (mechaniczka, wagon-warsztat), Doktor Wolan (badaczka Rezonansu, przy terminalu),
Kapitan Szron (koordynator, przy tablicy misji), Bajt (haker, siedzi przy ekranach w kąciku łączności), Stary Tomasz
(weteran, siedzi przy beczce z ogniem).

18 mieszkańców poniżej ma `position.y = 0`; pozycja chodzących oznacza początek trasy.
Wszystkie miejsca i kierunki odpowiadają przygotowanym rekwizytom, bez korekt współrzędnych.

| id     | Miejsce / zajęcie              | position (x; z) | rotationDeg | animation            | look: shade / headwear / torso / prop |
| ------ | ------------------------------ | --------------- | ----------- | -------------------- | ------------------------------------- |
| hela   | kuchnia, za ladą               | −17; −18,4      | 0           | PickUp_Table         | 5 / bandana / apron / none            |
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
  zachowuje unikalne akcenty, wśród mieszkańców rozkład wynosi 4/3/3/3/3).
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
  Paleta ma 10 ciemnych odcieni grafitu, granatu, szarości, oliwki, brązu i śliwki (`look.shade` barwi wierzchnią
  warstwę: kamizelkę, fartuch, kurtkę, bluzę, płaszcz, kaptur); sąsiedzi mają różne odcienie. Koszule i spodnie
  dobiera deterministycznie id NPC z `tuning.hub.npcShirtColors` / `npcPantsColors` (ciepłe szarości, grafit, granat);
  buty, skóra (ciepła szarość), rekwizyty i metal: `npcBootsColor`, `npcSkinColor`, `npcGearColor`, `npcMetalColor`.
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
  `tools/hub/extractNpcAnimations.mjs`, 2 851 548 bajtów; źródło `tools/blender/sources/ual/`), przesunięte w czasie i lekko
  różne tempem, żeby NPC nie byli zsynchronizowani. Bez modelu (testy, `loadModels: false`) zostają collider i dialog.
- **Obrót do gracza:** w zasięgu `tuning.hub.npcTurnRangeM` NPC obraca głowę i szyję (kości `DEF-head`, `DEF-neck`;
  obrót wokół osi Y świata, `npcHeadMaxRad`) i powoli tułów (`npcTurnSpeedRadS`, do `npcStandBodyMaxRad` /
  `npcSeatedBodyMaxRad` od kierunku bazowego); po odejściu gracza wraca do pozy bazowej. Czysta logika:
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
  (`HubDialog`, `src/ui/hubDialog.ts`, styl „wizjer”): imię, rola i jedna kwestia. Kolejne E (na tego samego NPC)
  daje następną kwestię w pętli (`NpcDialogue`, osobny licznik na NPC), dymek znika po `tuning.hub.npcLineS` (5 s) albo
  po odejściu gracza dalej niż zasięg interakcji + 1 m; otwarcie stacji też go zamyka. Podczas rozmowy podpowiedź
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
  `npcAnimFadeS`; wszystkie klipy, także `PickUp_Table` i `Punch_*`, są zapętlone. Ekstraktor zeruje
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
  (`src/ui/hubChatter.ts`, CSS) rysuje mniejsze, półprzezroczyste napisy nad dymkiem/podpowiedzią,
  z imieniem w akcencie NPC. DOM zmienia się tylko w renderze i przy zmianie kwestii; wejście jest
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
stacja bez fabryki w rejestrze (`arena`) zostaje zaślepką: tytuł i opis, „Przejdź na poligon” → `?scene=arena`
oraz „Zamknij” (Esc też zamyka). Nawigacja zachowuje `?debug=1`. Teksty zaślepek: `src/data/ui/meta.pl.json`,
sekcja `hub`. `HubScreens` ma opcjonalne `refresh()`: scena woła je po zdarzeniach meta, a nakładka przekazuje je
do otwartego panelu.

## Plan stacji

Klawisz M (akcja `map`, `src/data/inputBindings.json`; M było wolne, więc Tab nie jest potrzebny) przełącza nakładkę
„Plan stacji Kamienna” (`src/ui/hubMap.ts` + `hubMap.css`, ten sam język „wizjera” co mapa sektorów).

- Dane: opcjonalne `zones: { id, label, rect { x0, z0, x1, z1 }, color? }[]` w `hideout.json` (schemat `hubZoneSchema`
  w `hubSchema.ts`). Prostokąty są w osiach świata (x0 < x1, z0 < z1), muszą mieścić się w obrysie bloków układu,
  `id` są unikalne, `color` to wyłącznie `amber|green|violet|blue|white` (domyślnie `white`; cyan, czerwień i magenta
  są zarezerwowane). Strefy odpowiadają wierszom tabeli „Układ”: Hala (peron A), Tory, Peron B, Korytarz,
  Jadłodajnia, Kwatery, Radio Iskry, Targ wymiany, Kącik łączności, Bar i parkiet, Antresola, Wagon-warsztat, Kładka,
  Trening. Strefy zagnieżdżone (np. Antresola w hali) są rysowane później, więc leżą na wierzchu.
- Model: `hubMapModel(layout, playerPos, playerYaw)` w `src/world/hubMap.ts` (czysta funkcja). Plan północą w górę (−Z u góry, +X w prawo), współrzędne x i y w 0..1 osobno dla osi względem obszaru stref z marginesem `tuning.hub.mapPaddingM`; proporcje niesie `aspect` (ramka UI ma te same proporcje i może być szersza niż wyższa). Strefy są posortowane od największej, więc zagnieżdżone rysują się nad rodzicem. Podpis strefy (`caption`) leży w lewym górnym rogu, a gdy zajmuje go strefa zagnieżdżona albo stacja, w prawym; strefa węższa niż 5 m lub płytsza niż 3 m nie ma podpisu (tylko `<title>`; progi w `tuning.hub.mapLabel*`). Zwraca też stacje (kolor napisu: misje bursztyn, warsztat zieleń, talenty fiolet, poligon błękit), rekwizyty jako punkty i gracza (punkt, `headingRad` = −yaw). NPC nie są na planie. Podpisy stacji: pod znacznikiem, na ciemnej podkładce, większe i jaśniejsze niż podpisy stref.
- UI: SVG budowany raz przy pierwszym otwarciu (obrysy stref w kolorze strefy, półprzezroczyste ciemne wypełnienie,
  podpisy, znaczniki stacji z etykietą, kropki rekwizytów); w `render()` scena przesuwa wyłącznie znacznik gracza
  (strzałka w cyanie), tylko gdy plan jest otwarty. `role="dialog"`, `aria-label`, `pointer-events: none`. Teksty:
  `src/data/ui/meta.pl.json`, `hub.map`.
- Zachowanie: plan nie zatrzymuje symulacji i nie rusza pointer locka; zamyka go M, Esc, otwarcie stacji
  (`hub open`, E). Otwarty plan blokuje interakcję (E, uderzenie w worek) i chowa podpowiedź. Przy otwartej stacji
  albo trwającej rozmowie z NPC M nic nie robi.
- Debug: `hub map` (przełącza), `query('hubMap')` → `{ open }`. Testy: `tests/unit/hubMap.test.ts`,
  `hubMapUi.test.ts`, `hubScene.test.ts`, e2e `hub: hub map ...`.

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
- `hub map` — przełącza plan stacji, `query('hubMap')` → `{ open }`;
- `hub sit <seatId>` / `hub stand` — siadanie i wstawanie (patrz „Siadanie”), `query('hubSeat')` → id siedziska albo `null`,
  `query('playerLook')` → `{ yaw, pitch }`;
- `reset` wraca na `playerSpawn`.

## Zwierzęta

Czysto kosmetyczne, bez interakcji E (`selectHubTarget` i `HubPrompt` bez zmian). Układ: `fauna` w `hideout.json`
(`HubLayout.fauna`, walidacja w `hubSchema.ts`; trasa kota jak trasy NPC: podłoga, poza blokami, min. 0,6 m od
statycznych NPC). Liczby w `tuning.hub` (`cat*`, `rat*`, `fauna*`).

- Kot stacji „Węgielek”: pętla tras przez spokojne miejsca (beczka Tomasza na peronie B, budka z makaronem, kwatery,
  bar, kładka nad torami). Idzie do kolejnego punktu, odpoczywa losowo `restS` (siedzi albo leży), czasem się myje.
  Zatrzymuje się, gdy gracz stoi na drodze bliżej niż 0,8 m; gdy gracz biegnie w jego stronę bliżej niż 2 m, odbiega
  w bok (tylko po bezpiecznej podłodze) i wraca na punkt opuszczenia trasy.
- Dzieci przy kocie (`src/world/hubKidsCat.ts`, `KidsCatEncounter`; `tuning.hub.kidsCat*`): gdy Węgielek odpoczywa
  (siedzi, leży, myje się) w zasięgu `kidsCatRangeM` od `ola` lub `stas` i minęło odnowienie `kidsCatCooldownS`,
  dziecko schodzi z trasy, podchodzi truchtem na `kidsCatStandM` od kota (tylko gdy odcinek leży na podłodze fauny,
  inaczej stoi na trasie), patrzy na kota i kuca (`Crouch_Idle_Loop`) przez `kidsCatPetS`, po czym wraca w punkt
  zejścia i biegnie dalej. Drugie dziecko w `kidsCatJoinM` od kota dołącza z drugiej strony. Kot nie reaguje na dzieci;
  gdy przestanie odpoczywać (np. ucieczka przed graczem), dzieci wracają na trasę. Raz na spotkanie scena wymusza
  rozmowę `ola_stas_cat` (promień 0,001 m, żeby sama się nie włączała), o ile nic innego nie trwa i gracz jest w
  `chatterRadiusM`. Debug: `hub kidscat`, `query('hubKidsCat')` → `{ active, kids, cooldownLeft }`.
- Szczury: 2-3 pasy po dnie niecki torów i pod ścianą targu; co `intervalS` przebiega losowy pas (2,5-3,5 m/s,
  drobne zrywy) i znika; gdy gracz jest bliżej niż 3 m od startu pasa, wybierany jest inny pas albo czekanie;
  maksymalnie 2 naraz (pooling).
- Wygląd kota (`src/scenes/hubFauna.ts`): model `public/assets/models/hub_cat.glb` (Blender, `build_hub_cat`; opis
  w `docs/assets.md`) — czarny, fasetowany low-poly kot ze szkieletem (biodra, kręgosłup, pierś, szyja, głowa, cztery
  łapy po 3–4 kości, ogon w 4 członach), bursztynowe oczy z delikatnym blaskiem (`catEyeColor`, `catEyeGain`),
  futro w toon `catColor` ze słabą poświatą krawędzi (`faunaRimColor`, `catRimGain`). `HubFauna.load()` wczytuje model
  (bez modelu — testy, `loadModels: false` — kot nie ma widoku, symulacja i mruczenie działają). `AnimationMixer`
  odtwarza klipy wybrane przez `catClip(stan)`: `sit` / `lie` / `groom` przy odpoczynku i myciu, `walk` w ruchu
  (`walk`, `flee`, `return`), `idle` gdy kot stoi na trasie (np. czeka, aż gracz zejdzie z drogi). Tempo `walk` =
  prędkość ruchu / `catWalkClipSpeedMS` (prędkość łap w klipie, bez poślizgu), najwyżej `catWalkMaxTimeScale`;
  zmiana klipu przenika się przez `catAnimFadeS`. Mixer idzie czasem symulacji kota (interpolowany `ageS`), więc
  pauza zatrzymuje animację. Zachowanie (trasa, odpoczynek, ucieczka, dzieci) bez zmian.
- Wygląd szczurów: proceduralne siatki z prymitywów (współdzielone geometrie), `ratColor`; render interpoluje stan.
- Dźwięk: mruczenie `purr` (ruchome źródło ambience, ok. 3 m, gdy kot odpoczywa), rzadkie miau i pisk szczura przez
  zdarzenie `hub_fauna_sound` (zob. `audio.md`, `api.md`).
- Debug: `hub cat` (kot 2 m przed graczem, odpoczynek), `hub rat` (przebieg najbliższym pasem),
  `query('hubFauna')` → `{ cat: { x, z, state } | null, rats }`.

## Testy

`tests/unit/hubLayout.test.ts` (walidacja układu: stacje w granicach i osiągalne, strefy rozłączne, paleta, zasoby),
`hubStations.test.ts` (ray–AABB, zasięg, najbliższe trafienie, otwieranie na żądanie), `hubPrompt.test.ts` (jsdom, podpowiedź),
`hubScene.test.ts` (scena bez DOM: spojrzenie i zbocze E, komendy, zatrzymanie ruchu, niecka torów,
nawigacja, `dispose` bez subskrypcji, meta, NPC: cel `hubNpc`, kwestie w pętli, wygasanie dymka, kolidery, obrót),
`hubNpcs.test.ts` (teksty NPC, kolejność kwestii, `focus` z kolidera, `selectHubTarget`, `updateNpcLook`),
`hubCatView.test.ts` (prawdziwy `hub_cat.glb`: szkielet, pięć zapętlonych klipów, łapy i tułów przy podłodze w każdym
klipie, prędkość łapy w podporze klipu `walk` = `catWalkClipSpeedMS`, mapowanie stanów kota na klipy),
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

## Reakcje na powrót

Mieszkańcy korzystają z istniejących tekstów `reactions.firstVisit`, `victory`
i `death` w `src/data/hub/npcs.pl.json`. Listy są opcjonalne, ale obecna lista
musi zawierać co najmniej jedną niepustą kwestię. Zwykłe `lines` nie zmieniają się.

Przy wejściu czysta funkcja `hubArrivalContext(meta, greeted)` ustala kontekst:
`stats.runs === 0` daje `firstVisit` z kluczem `first-visit`, inaczej
`lastRuns[0]` daje wynik `victory`/`death` i klucz `runId`. Brak rekordu lub
już przywitany klucz wyłącza reakcje w tej wizycie. Pamięć jest wstrzykiwana przez
`HubSceneOptions.greetings` (`last`, `mark`); domyślny adapter UI używa localStorage
`neoryder.hub.greeted`, z odczytem i zapisem w try/catch. Brak dostępu do pamięci
nie blokuje sceny: w bieżącej wizycie powitanie występuje najwyżej raz.

Po `hub.arrivalDelayS` (2,5 s, edytowalne w lil-gui) NPC z reakcją najbliższy
pozycji startowej gracza wypowiada losową kwestię przez istniejące napisy rozmów.
`HubArrival` wybiera tekst deterministycznie (`Rng`, seed `${key}:${npcId}`),
a `HubChatter.say` emituje `hub_chatter_line` z `conversation: 'arrival'`,
pomijając promień rozmów. Po wyświetleniu scena zapisuje klucz powitania.
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

## Siadanie

Rekwizyt `seat` ma dodatkowe pole `sit: { position, yawDeg }` (wymagane dla `seat`, niedozwolone dla
pozostałych rodzajów): `position` to punkt oka gracza po usiądnięciu (ok. 1,15 m nad podłogą), `yawDeg` kierunek
patrzenia (0 = −Z, jak w `hub tp`). Etykiety „Usiądź” i „Wstań” są w `props.pl.json` (`labels.seat`, `labels.stand`).
Cztery siedziska gracza w `hideout.json`, wszystkie poza miejscami NPC: `seat_platform_couch` (kanapa na peronie B
przy beczce z ogniem), `seat_canteen_bench` (wolne miejsce na ławie w jadłodajni), `seat_bar_stool` (stołek przy
barze), `seat_bunk_edge` (krawędź pryczy w kwaterach).

E na siedzisku siada: kamera płynnie (`hub.sitBlendS`, 0,4 s) przechodzi do `sit.position`, a obrót ciągnie się
do `yawDeg`. Potem mysz obraca widok w zakresie ±`hub.sitYawLimitDeg` (100°) wokół `yawDeg`, pitch jak zwykle.
Ciało gracza stoi w miejscu (kontroler jest krokowany z pustym wejściem poza ruchem myszy), więc WASD, skok i dash
są ignorowane. Podpowiedź pokazuje „E — Wstań”. Ponowne E albo naciśnięcie klawisza ruchu (WASD) wstaje: kamera
wraca na pozycję przed siedziskiem. Otwarty plan stacji (M), stacja i dymek rozmowy blokują siadanie jak inne
interakcje (komenda `hub sit` również); `hub tp` i `reset` zdejmują siedzenie od razu. Siedzenie nie emituje
`hub_prop_used`. Stan: `query('hubSeat')`. Ręczna próba w 30 s: `hub tp -16.1 -11.4`, `hub look seat_canteen_bench`,
E; albo `hub sit seat_bar_stool`, poruszaj myszą, `hub stand`.

Testy: `hubScene.test.ts` (siadanie, wstawanie E i WASD, ograniczenie yaw, blokady, komendy), `hubProps.test.ts`
(schemat `seat`, brak siedzisk na NPC), e2e `hub.spec.ts`.

## Znaczniki reakcji

Gdy kontekst przybycia (`HubArrival`) jest aktywny, NPC z jeszcze niewykorzystaną reakcją (pierwsza rozmowa E da
reakcję) mają nad głową mały znacznik: pionowy romb w ciepłej bieli (#fff1d6, jasność HDR dla bloomu), ok. 0,12 m,
lekko pulsujący w czasie klatki. Wysokość jest obniżona dla siedzących i niskich póz. Znacznik znika, gdy gracz z tym
NPC rozmawia, i po wykorzystaniu reakcji; bez kontekstu przybycia nie ma żadnych. Geometria i materiał są
współdzielone przez wszystkich NPC (`HubNpcs`), bez alokacji w klatce (`HubArrival.isPending(id)`). Liczby w
`hub.marker*` (`tuning.ts`, lil-gui). `query('hubArrival')` zawiera `pending: string[]` (id NPC ze znacznikiem).

Testy: `hubArrival.test.ts` (`pending`, `isPending`) i `hubScene.test.ts` (pending po wejściu z kontekstem, znika po
rozmowie, brak bez kontekstu). Ręcznie: `hub arrive victory` i rozejrzyj się po NPC.

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
Pauza zamraża harmonogram i wycisza audio; to samo dzieje się przy otwartej stacji (zegar stoi, więc
`HubScene` przekazuje `render(alpha, suspended)`, a audio dostaje `loop.paused || stacja otwarta`),
nawet bez pointer locka, np. po `hub open`. Po zamknięciu stacji dźwięk wraca. Światła pozostają bez zmian:
ich sterowanie jest prywatne w `src/render/**`.

Ręczna próba w 30 s: otwórz `?scene=hub&debug=1`, odblokuj audio kliknięciem,
w konsoli wykonaj `hub train`; po około 3,5 s sprawdź delikatny wstrząs i pył.
`window.__neoryder.query('hubAmbience')` zwraca aktywne źródła i ich gain.

## Spadek napięcia

Co losowy czas (`hub.powerDipIntervalS`, domyślnie 240–480 s od początku poprzedniego;
pierwszy po `powerDipFirstS` 90–180 s, Rng `hub-power-dip`) prąd w kryjówce przygasa na
`powerDipDurationS` (2,5 s). Krzywa (`powerLevel`, `src/world/hubPowerDip.ts`): 3 szybkie
mrugnięcia do `powerDipBlinkLevel`, spadek do `powerDipMinLevel` (0,15), ok. 1 s ciemności,
powrót z jednym dodatkowym mrugnięciem. Przy wyłączonym ustawieniu „Błyski ekranu” zamiast
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
