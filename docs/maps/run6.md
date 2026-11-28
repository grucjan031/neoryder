# Dokument projektowy mapy `run6` — Nocny targ pod estakadą (Bulwar)

Status: **projekt zatwierdzony przez architekta (2026-11-27), wiąże wykonawców.** Druga mapa walk i elit Bulwaru obok [run5](run5.md). Targ wycięty z dawnego `bulwar1` wraca jako osobne, spójne miejsce.

- Dane: `src/data/rooms/run6.json`, generator `tools/arenas/run/run6.mjs` + `_run6Kit.mjs`, `_run6Rooms.mjs`, `_run6Dress.mjs`.
- Wzorce: [run5](run5.md) (technika, nauczki z §6 niżej), [run3](run3.md) §1.2, [kontrakt pokoi](../systems/rooms.md), [ADR 0006](../adr/0006-neon-noir.md).
- Pule: `src/data/sectors/bulwar.json` → `roomPools.combat` i `roomPools.elite` = `["run5", "run6"]`; jeśli Kurogane ma regułę „bez tej samej mapy dwa razy z rzędu”, Bulwar korzysta z tej samej.

## 1. Idea miejsca

Pod płytą estakady Bulwaru, między filarami, od trzydziestu lat stoi targ, którego nikt nie zatwierdził. W dzień handluje się rybą z delty i makaronem, w nocy częściami do implantów i zabiegami „bez pytań”. Dziś Helixa postawiła na placu scenę: pokaz polowy Akordu, wstęp wolny. Ludzie uciekli w połowie — kramy zostały otwarte, zupa jeszcze paruje, na scenie migają ekrany. Deszcz leje przez szczeliny między płytami estakady.

Jeden styl: **ciasny, ciepły, prowizoryczny targ azjatycko-słowiański pod betonem.** Drewno, plandeki, blacha falista, plastikowe skrzynki, papierowe lampiony, para z garów, mokry bruk odbijający neony. Zero sterylności (to kontrast do run5). Technologia jest używana, połatana, z drugiej ręki.

## 2. Układ

Metry świata. `+X` wschód, `+Z` południe (wejście), `−Z` północ (wyjście). Posadzka `y = 0`. Poziom górny `y = 4.2` (dachy kramów, pomosty, antresola herbaciarni). Granice na liczbach całkowitych. Obrys `X ∈ [−30, 30]`, `Z ∈ [−38, 34]` (60 × 72 m).

```text
        X=-30          -4      -10 10              30
 Z=-38  +---------------+------------[EXIT winda]----+
        | T7 HERBACIARNIA|  T8 RAMPA DOSTAW / DOK     |
        |  z antresolą   |  kontenery, wagon maglev   |
 Z=-14  +------D----U----+----D-------------U---D-----+
        | T4 PASAŻ      D  T6 PLAC POD        D T5 GABINET |
        | CZĘŚCI        |  ESTAKADĄ, SCENA    | „BEZ PYTAŃ”|
 Z=  6  +------D--------+  POKAZU AKORDU      +-----D------+
        | T2 ALEJA      D  20 × 36            D T3 HALA    |
        | GARKUCHNI     |  (szczelina deszczu)| RYBNA      |
 Z= 22  |               +--------D------------+ I CHŁODNIA |
        |               D  T1 BRAMA TARGU     D            |
 Z= 34  +---------------+-------[ENTRY]-------+------------+
          D przejście dołem   U wejście na poziom górny
```

| ID | Strefa | X | Z | Wymiary | Przykrycie | Dominanta światła | Rozpoznanie w sekundę |
|---|---|---|---|---|---|---|---|
| T1 | Brama targu | −10…10 | 22…34 | 20 × 12 | wiata bramy 5,5 m | bursztyn + ciepła biel | wielka neonowa brama „NOCNY TARG”, budki, lampiony |
| T2 | Aleja garkuchni | −30…−10 | 6…34 | 20 × 28 | plandeki 3,6 m, nad nimi płyta 9 m | bursztyn | dwa rzędy wózków z garami, para, stołki, menu |
| T3 | Hala rybna i chłodnia | 10…30 | 6…34 | 20 × 28 | hala, strop 5,2 m | królewski błękit + ciepła biel | stoły z lodem i rybami, haki, kafle, drzwi chłodni |
| T4 | Pasaż części | −30…−10 | −14…6 | 20 × 20 | pasaż, strop 4,8 m | fiolet + błękit | ściany szuflad, protezy na hakach, ekrany, lutownice |
| T5 | Gabinet „bez pytań” | 10…30 | −14…6 | 20 × 20 | wnętrze, strop 4,2 m | zieleń | fotele zabiegowe z ramionami narzędzi, zasłony, dyplom |
| T6 | Plac pod estakadą ze sceną (największy) | −10…10 | −14…22 | 20 × 36 (720 m²) | płyta estakady na 10 m ze szczeliną deszczu | ciepła biel + fiolet sceny | scena z ekranami Helixy, filary estakady, kramy z plandekami, kałuże |
| T7 | Herbaciarnia pod estakadą | −30…−4 | −38…−14 | 26 × 24 | drewniany pawilon, strop 7,6 m, antresola 4,2 m | ciepła biel + bursztyn | niskie stoły, poduchy, lada z czajnikami, lampiony, antresola |
| T8 | Rampa dostaw i dok maglevu | −4…30 | −38…−14 | 34 × 24 | częściowo otwarty, płyta 10 m | błękit + bursztyn ostrzegawczy | kontenery, wózek widłowy, wagon maglevu przy peronie, winda |

### 2.1. Przejścia (światło ≥ 4,0 × 3,2 m, bez drzwi; rama z belek i szyld strefy docelowej)

| Połączenie | Otwór |
|---|---|
| ENTRY → T1 | Z = 34, X −2…2; drzwi `entry` (0, 1.5, 34.5), nad wejściem `bw_targ_gate` |
| T1 ↔ T2 | X = −10, Z 26…30 |
| T1 ↔ T3 | X = 10, Z 26…30 |
| T1 ↔ T6 | Z = 22, X −5…5 (szeroko) |
| T2 ↔ T6 | X = −10, Z 12…16 |
| T3 ↔ T6 | X = 10, Z 12…16 |
| T2 ↔ T4 | Z = 6, X −22…−18 |
| T3 ↔ T5 | Z = 6, X 18…22 |
| T4 ↔ T6 | X = −10, Z −6…−2 |
| T5 ↔ T6 | X = 10, Z −6…−2 |
| T4 ↔ T7 | Z = −14, X −22…−18 |
| T6 ↔ T8 | Z = −14, X 2…8 |
| T6 ↔ T7 | Z = −14, X −9…−5 |
| T5 ↔ T8 | Z = −14, X 20…24 |
| T7 ↔ T8 | X = −4, Z −28…−24 |
| T8 → EXIT | Z = −38, X 12…16; drzwi `exit` (14, 1.5, −38.5), portal `bw_freight_lift_frame` |

### 2.2. Poziom górny `y = 4.2`

- Antresola herbaciarni: X −30…−4, Z −38…−30 oraz pas X −30…−26, Z −30…−14 (L-kształt), schody-rampa wzdłuż ściany zachodniej (Z −16 → −26, 4,2 m na 10 m).
- Pomost nad pasażem części i placem: X −12…−8, Z −14…16 (po dachach kramów zachodniej pierzei placu), kładka w poprzek placu X −8…8, Z 4…7, pomost wschodni X 8…12, Z −14…16.
- Suwnica doku: pomost X −4…30, Z −18…−14 łączący oba pomosty z herbaciarnią (przejście w ścianie X = −4 na 4,2 m) i schodzący rampą w doku (X 20 → 30 wzdłuż Z −16, 4,2 → 0).
- Rampa z placu przy filarze południowo-wschodnim: X 6…9, od kładki Z 7 (4,2) do Z 17 (0).
- **Korekta (wiąże):** antresolę z suwnicą łączy pomost 3 m wzdłuż wschodniej ściany herbaciarni (X −7…−4, Z −30…−18), z przejściem w ścianie X = −4 na poziomie 4,2 m. Pod każdą rampą pokład ma wycięcie na całą długość biegu, tak by nad rampą był prześwit ≥ 2,6 m. Wykonawca może przesuwać pomosty, rampy i wycięcia o kilka metrów, jeśli zachowa obrys stref, rzędną 4,2 m, górną pętlę i trzy zejścia.
- Górna pętla: antresola → suwnica → pomost wschodni → kładka → pomost zachodni → suwnica. Trzy zejścia (herbaciarnia, dok, plac). Balustrady z desek i rur (bryły), ciągła kolizja.

### 2.3. Deszcz i panorama

- Profil pogody `bulwarNightMarket` (przywrócony): deszcz `density 0.36`, bez błyskawic, `panoramaEnabled: true`, mgła `density 0.004`, `surface { gloss 0.1, reflections 0.7, puddles 0.45 }`, `sky.horizonColor "#2b1f3d"`, `ambience`: `rain 0.3`, `crowd 0.06`. `panoramaDropM: 20` (targ leży niżej niż przychodnia — wieże górują).
- Płyta estakady nad placem i dokiem to trzy połacie z dwiema szczelinami 2 m (X = −3…−1 i 1…3 nad placem biegnące wzdłuż Z; w doku otwarty pas X 24…30). Pod pełnymi połaciami i wszystkimi dachami `rainShelters`; w szczelinach pada, na bruku pod nimi `puddle1/2` i `drip`.
- Wschodnia krawędź doku (X = 30, Z −38…−14) otwarta na miasto za barierą: widać panoramę, wiadukt maglevu z drugim wagonem, wieże z szyldami (jak w run5: 5–6 brył `facade`, 6 szyldów `neon`/`holo` z `flicker`).

### 2.4. Walka

- Gęste osłony: wózki, lady, stoły z lodem, skrzynki, filary estakady (pełne), kontenery; niskie: stołki, poduchy, skrzynki pojedyncze. Żadnego pustego kwadratu > 8 m; w promieniu 4 m od środka każdej strefy osłona.
- T2 i T4 to wąskie aleje (2,5–3 m) z przecinkami co kram; T6 to otwarta arena z pionem (pomosty, scena 1,2 m z rampami po bokach); T8 to długie linie strzału między kontenerami, przełamane wagonem.
- Zagrożenia: `electric_field` 3 × 2 m z cyklem przy rozdzielni sceny w T6 i przy agregacie chłodni w T3 (kałuża pod napięciem), `explosive_barrel` × 2 (butla gazowa przy garkuchni T2, beczka w doku T8). Obok ≥ 3 m obejścia.
- Spawny: 18. T1: 1, T2: 3, T3: 2, T4: 2, T5: 2, T6: 2, T7: 2, T8: 2 + 2 na poziomie górnym (`y = 4.2`: antresola, pomost wschodni). Kieszenie za pełną osłoną. `minSpawnDistance: 10`, `spawnRing: { minM: 10, maxM: 24 }`, `maxAlive: 10`. Start gracza (0, 0, 31).

## 3. Fundamenty

| ID | Zmiana | Pliki |
|---|---|---|
| F-01 | Profil `bulwarNightMarket` wg §2.3 | `src/data/weather/bulwarNightMarket.json` + listy profili w testach |
| F-02 | Trzy materiały: `targ_wet_pavers` (`scale 0.35, roughness 0.6, metalness 0.05, bump 0.45, wetness 0.55, tint "#3c4658"`), `targ_wood_planks` (`scale 0.4, roughness 0.85, metalness 0, bump 0.4, wetness 0.1, tint "#5a4a3c"`), `targ_fish_tiles` (`scale 0.5, roughness 0.7, metalness 0.02, bump 0.3, wetness 0.3, tint "#56627a"`) + wersje komiksowe | jak F-02 w run5 |
| F-03 | Nowe modele w listach audytu: `WALL_FIXTURES` (`bw_targ_cold_door`, `bw_targ_drawer_wall`), `PASSAGE_FIXTURES` (`bw_targ_gate`), `CEILING_FIXTURES` (`bw_targ_paper_lantern`, `bw_targ_hanging_rack`) | `src/world/mapAudit.ts` |

### 3.1. Modele Blender — nowy zestaw `tools/blender/sets/bulwar_market.py` (id `bw_targ_*`, prefiks `bw_` już zarejestrowany)

Materiały: drewno, blacha, plandeka (stonowany bursztyn-ochra, oliwka, granat — przez istniejące `mat_container_*`, `mat_wood`, `mat_metal`, `mat_trim`, `mat_rubber`, `mat_plastic` itd.; sprawdź PALETTE), akcenty `mat_neon_amber|green|blue|violet`, `mat_light_panel`. Zakaz czerwieni, cyanu, turkusu, magenty, różu. Przód +Z, środek podstawy w Y = 0.

| ID | Obwiednia X × Y × Z | Bryła |
|---|---|---|
| `bw_targ_gate` | 8,0 × 6,0 × 1,0 | Brama targu: dwa słupy z kratownicy obłożone blachą i drewnem, podwójna belka-dach z podgiętymi końcami, pod belką rama na szyld 5 × 1 m, po 3 lampiony na stronę, wiązki kabli. Światło przejścia 6,0 × 4,2. |
| `bw_targ_noodle_cart` | 2,6 × 2,5 × 1,5 | Wózek garkuchni: lada z desek, dwa wielkie gary z pokrywami i jeden otwarty, palnik, daszek z blachy falistej na czterech słupkach, kółka, wisząca chochla i menu-ramka 0,8 × 0,5 od frontu. |
| `bw_targ_wok_station` | 1,8 × 2,1 × 0,9 | Stanowisko wok: stalowy stół, dwa woki, butla gazowa z boku (nie czerwona: ochra), okap z rurą. |
| `bw_targ_stool_set` | 1,6 × 0,5 × 1,6 | Cztery plastikowe stołki wokół niskiej skrzynki-stolika z miskami i pałeczkami. |
| `bw_targ_tarp_canopy` | 4,0 × 3,6 × 3,0 | Plandeka na czterech rurach, ugięta połać z fałdami (geometria wygięta), odciągi, pod spodem żarówka-lampion. Kolizja tylko słupki. |
| `bw_targ_fish_table` | 2,4 × 1,1 × 1,2 | Stół rybny: pochylona wanna z lodem (jasne bryłki), 8–10 ryb (wrzecionowate bryły z płetwami, stal i błękit), waga, pojemnik. |
| `bw_targ_hanging_rack` | 2,4 × 1,6 × 0,3 | Wieszak sufitowy: rura na dwóch zawiesiach, na hakach ryby suszone i dwie protezy dłoni (wersja uniwersalna), góra styka się ze stropem. |
| `bw_targ_cold_door` | 2,4 × 2,6 × 0,3 | Drzwi chłodni: gruba izolowana płyta na szynie, dźwignia, okienko, błękitna dioda, paski PCV w szczelinie. |
| `bw_targ_parts_stall` | 3,0 × 2,6 × 1,4 | Stoisko części: lada-gablota ze szkłem, w niej dłonie i moduły, tył z półkami pełnymi pudełek i trzech małych ekranów, daszek, lampa na wysięgniku, lutownica na blacie. |
| `bw_targ_drawer_wall` | 3,0 × 2,8 × 0,5 | Ściana szuflad: 6 × 7 szufladek z uchwytami, kilka wysuniętych, etykiety, na górze pudła. |
| `bw_targ_implant_chair` | 1,2 × 2,3 × 2,1 | Fotel zabiegowy z drugiej ręki: połatany winyl, trzy ramiona narzędzi na słupie (wiertło, igła, chwytak), taca narzędzi, lampa z klosza, wiadro. |
| `bw_targ_curtain_screen` | 2,4 × 2,1 × 0,3 | Parawan: rama z rur, zasłona z fałdami (oliwka), kółka. |
| `bw_targ_tea_table` | 1,8 × 0,7 × 1,8 | Niski stół z drewna, cztery poduchy, czajnik, czarki, taca. |
| `bw_targ_tea_counter` | 3,6 × 2,4 × 1,0 | Lada herbaciarni: drewniany bar, za nim regał z puszkami herbaty (rytm walców), dwa samowary z kranikami, lampa. |
| `bw_targ_paper_lantern` | 0,5 × 0,9 × 0,5 | Papierowy lampion: żebrowana bryła obrotowa (`mat_light_panel` ciepły), górna i dolna obręcz, zawiesie 0,25 do stropu, chwost. Wariant `bw_targ_paper_lantern_amber` z `mat_neon_amber`. |
| `bw_targ_crate_stack` | 1,2 × 1,5 × 0,9 | Stos plastikowych skrzynek (ażurowe ścianki jako płyciny), w górnej warzywa (zielone i ochrowe bryły). |
| `bw_targ_stage` | 8,0 × 5,2 × 5,0 | Scena pokazu: podest 1,2 m z frontem z paneli, kratownica w kształcie bramy nad sceną z czterema reflektorami (bez stożków, `mat_light_panel`), dwie ramy ekranów 2,4 × 3,2 po bokach, mównica z błękitną linią, głośniki. Kolizja: podest + słupy kratownicy. |
| `bw_targ_neon_totem` | 1,0 × 6,0 × 0,6 | Pionowy totem szyldów: słup z pięcioma kasetonami na przemian po obu stronach (ramy pod tekstury), kable, anteny. |
| `bw_targ_shrine` | 1,0 × 1,6 × 0,7 | Kapliczka szczęścia: drewniana szafka z daszkiem, w środku figurka kota z uniesioną łapą (proste bryły), miseczki, dwie świeczki-diody bursztynowe. |

Podglądy do `tools/blender/previews/bulwar/`, wpisy w `docs/assets.md`, pomiary w `mapModelBounds.json`, test w `tests/unit/bulwarModels.test.ts`.

### 3.2. Tekstury — zestaw `targ` (kategorie tylko `surfaces`, `komiks/surfaces`, `signs`, `decals`)

Paleta: bursztyn `#ffae1a`, ciepła biel `#fff1d6`, zieleń `#6dff4a`, błękit `#3d7bff`, fiolet `#8a5cff`, drewno `#5a4a3c`, grafit `#2a3344`, ochra plandek `#d08a1c`. Zakaz czerwieni, cyanu, turkusu, magenty, różu.

| ID | Kategoria / rozmiar | Treść |
|---|---|---|
| `targ_wet_pavers`, `targ_wood_planks`, `targ_fish_tiles` | surfaces 1024² | Mokry bruk z płyt betonowych i kostki z fugami; deski podłogi herbaciarni; małe kafle hali rybnej z kratką odpływu. |
| `komiks_targ_*` (3) | komiks/surfaces 1024² | Wersje komiksowe. |
| `targ_sign_brama` | signs 1024×256 | „NOCNY TARG” — wielki neon bramy, rurki neonowe, piktogram lampionu. |
| `targ_sign_garkuchnie`, `targ_sign_ryby`, `targ_sign_czesci`, `targ_sign_gabinet`, `targ_sign_herbaciarnia`, `targ_sign_dostawy`, `targ_sign_scena`, `targ_sign_winda` | signs 512×256 | Neony ręcznej roboty, każdy inny krój (to targ, nie korporacja), piktogram + tekst: GARKUCHNIE, HALA RYBNA, CZĘŚCI I NAPRAWY, GABINET — BEZ PYTAŃ, HERBACIARNIA, DOSTAWY, POKAZ AKORDU — DZIŚ, WINDA. |
| `targ_screen_show` | decals 512×768 | Ekran sceny: logo podwójnej helisy, „AKORD — DOSTROJENI DO JUTRA”, błękit i fiolet. |
| `targ_menu_board` | decals 512×768 | Tablica menu kredą: lista dań z cenami (RAMEN 12, PIEROGI NA PARZE 9, ZUPA RYBNA 10). |
| `targ_price_tags` | decals 512×256 | Rząd kartonowych cenówek. |
| `targ_poster_wall` | decals 1024×512 | Ściana zdartych plakatów i ogłoszeń, warstwy papieru. |
| `targ_floor_stall_marks` | decals 1024×256 | Wytarte żółto-bursztynowe linie i numery stanowisk „12 13 14”. |
| `targ_tarp_pattern` | decals 512×512 | Łaty i ściegi plandeki (do naklejania na bryły). |

### 3.3. Easter eggi (12, każdy osobna tekstura `decals`)

| Nr | ID (rozmiar) | Gdzie | Treść | Nawiązanie |
|---|---|---|---|---|
| 1 | `targ_ee_zupa` (512×768) | T2, tablica przy wózku | „ZUPA DNIA: WCZORAJSZA. ZUPA WCZORAJ: PRZEDWCZORAJSZA.” | humor targu |
| 2 | `targ_ee_pokaz` (512×768) | T6, bok sceny | plakat: „POKAZ POLOWY AKORDU — WSTĘP WOLNY, WYJŚCIE NIEKONIECZNIE” | fabuła M09 |
| 3 | `targ_ee_list_gonczy` (512×768) | T1, słup bramy | list gończy z sylwetką w kapturze: „POSZUKIWANI: ISKRA — NAGRODA: UMORZENIE RATY” | fabuła, Iskra |
| 4 | `targ_ee_nadia` (256×256) | T3, pod ladą stołu rybnego | karteczka: „N.K. — PACZKA DLA ISKRY POD LADĄ U RYBNEGO. NIE PYTAĆ.” | fabuła, Nadia Korsak |
| 5 | `targ_ee_cennik` (512×768) | T4, przy stoisku | cennik: „RĘKA LEWA 300 / RĘKA PRAWA 500 / OBIE 700 (PROMOCJA) / GWARANCJA: DO ROGU ULICY” | motyw gry |
| 6 | `targ_ee_origami` (256×256) | T7, na niskim stole | rysunek-etykieta przy małym papierowym jednorożcu z brył: „KTOŚ ZOSTAWIŁ. NIE RUSZAĆ.” | popkultura |
| 7 | `targ_ee_herbata` (512×256) | T7, tabliczka na ladzie | „HERBATA DNIA: ŁZY W DESZCZU” | popkultura |
| 8 | `targ_ee_kamienna` (512×256) | T8, stary drogowskaz przy windzie | emaliowana tablica metra: „KAMIENNA ↓ — STACJA NIECZYNNA OD POWODZI” | fabuła, kryjówka |
| 9 | `targ_ee_dyplom` (512×512) | T5, ściana | dyplom w ramce: „CERTYFIKAT UKOŃCZENIA KURSU CHIRURGII (ONLINE, 3 DNI)” | motyw gry |
| 10 | `targ_ee_ulotka` (512×768) | T6, filar estakady | podarta ulotka: „BEZPŁATNA PRZYCHODNIA HELIXA — 61. PIĘTRO” ze sprayem „NIC NIE JEST BEZPŁATNE” | łącznik z run5 |
| 11 | `targ_ee_kot` (512×256) | T2/T1, przy kapliczce | „KOT SZEFA. NIE KARMIĆ. (KARMIONY 14 RAZY DZIŚ)” | humor |
| 12 | `targ_ee_parasolki` (512×256) | T8, szablon na kontenerze | „KUROGANE ARMS — ZAWARTOŚĆ: PARASOLKI (NA PEWNO)” | fabuła, Kurogane |

## 4. Wyposażenie stref

- **T1.** `bw_targ_gate` nad wejściem z `targ_sign_brama`, dwie budki `city_kiosk`, `bw_targ_neon_totem` × 2, `bw_targ_shrine`, lampiony w dwóch rzędach, `targ_poster_wall` na ścianach bocznych, EE3, EE11.
- **T2.** 8 × `bw_targ_noodle_cart` w dwóch rzędach naprzeciw siebie + 3 × `bw_targ_wok_station`, między nimi `bw_targ_stool_set` × 8, `bw_targ_tarp_canopy` nad stolikami, `steam` nad garami (ambientFx), `bw_targ_crate_stack` × 6, śmieci `city_trash_bags`, `targ_menu_board` przy każdym wózku, EE1.
- **T3.** 10 × `bw_targ_fish_table` w trzech rzędach, `bw_targ_hanging_rack` × 8 pod stropem, ściana z `bw_targ_cold_door` × 2 i agregatem (bryły + `city_ac_unit`), skrzynie z lodem, odpływy `city_vent_grate`, kafle `targ_fish_tiles`, błękitne świetlówki z brył, EE4.
- **T4.** Po obu stronach alei `bw_targ_parts_stall` × 6 i `bw_targ_drawer_wall` × 6, `bw_targ_hanging_rack` × 4 (protezy), `bw_implant_showcase` × 2 (używane, z run5), ekrany, kable w poprzek stropu `city_cable_span`, EE5.
- **T5.** 4 × `bw_targ_implant_chair` w boksach z `bw_targ_curtain_screen`, poczekalnia z `bw_waiting_seats` × 2 (z run5, „skądś wyniesione”), `bw_med_cart` × 3, `bw_sample_fridge` × 1, lada z kasą, zielone lampy, EE9.
- **T6.** `bw_targ_stage` przy północnej ścianie placu (Z ≈ −11) frontem na południe, na ramach ekranów `targ_screen_show`, `targ_sign_scena` nad sceną; 4 filary `city_overpass_pillar`; 6 kramów `city_stall`/`city_market_stall_canopy` pod pomostami; przewrócone `bw_targ_stool_set` i `bw_targ_crate_stack` (ślady ucieczki tłumu), `bw_targ_neon_totem` × 2, kałuże w szczelinach deszczu, `floor_stall_marks`, EE2, EE10.
- **T7.** Posadzka `targ_wood_planks`, 8 × `bw_targ_tea_table` (5 na dole, 3 na antresoli), `bw_targ_tea_counter`, parawany `bw_targ_curtain_screen`, lampiony gęsto (16+), drewniane słupy i belki stropu (bryły `wood`), `bw_targ_shrine`, EE6, EE7.
- **T8.** Kontenery `port_container_20_*` (bez czerwonych wariantów) w dwóch stosach, `wh_forklift`, `city_crates`, peron z `rail_maglev_car_open` przy wschodniej krawędzi (ładunek widoczny), bariery `city_highway_barrier`, `bw_freight_lift_frame` na wyjściu, bursztynowe lampy ostrzegawcze z brył, EE8, EE12.

## 5. Kryteria akceptacji

1. `node tools/levels/mapAudit.mjs run6` → `run6: 0 error, 0 warn`; `"run6": 0` w baseline; `npm run check` zielone.
2. `tests/unit/run6Navigation.test.ts` (start → wyjście, 18 spawnów, 8 stref, górna pętla na `y ≥ 4.2`, trzy zejścia, kapsuła na spawnach, brak pustego kwadratu > 8 m), `run6Mounts.test.ts`.
3. W każdym kadrze `shots`: ≤ 800 wywołań rysowania (cel ≤ 650) i ≤ 1,0 mln trójkątów.
4. Osiem kadrów FPP rozpoznawalnych w sekundę; w kadrze placu widać deszcz w szczelinie i mokre odbicia; z doku widać miasto.
5. Bramka architekta ≥ 7/10.

## 6. Nauczki z run5 (wiążą od pierwszego przebiegu)

1. **Światło:** żadne `lights[]` bliżej niż 1,6 m od ściany; wszystkie z `groundGlow: false` i `floorY`; zero `cone: true`; zero `city_street_lamp` i `city_lantern_string` (własne `bw_targ_paper_lantern`). Białe oprawy świecą ciepłą bielą, kolor strefy dają słabsze światła przy barwnych elementach i świecąca geometria.
2. **Połysk:** materiały o `roughness ≥ 0,6`, inaczej punktowe światła robią białe plamy.
3. **Wydajność:** bryły bez modelu NIE dostają `instance: true` (każdy unikalny rozmiar to osobne wywołanie) — idą do statyki łączonej po materiale; `instance: true` tylko dla powtarzalnych modeli; drobne bryły w 5–6 materiałach; `arenaMeta.batchCellM` 40 dla stropów.
4. **Gęstość:** ściany mają cokół, pas środkowy i rytm pionów; stropy mają belki; posadzki mają oznaczenia. Każda strefa ≥ 40 rekwizytów.
5. **Easter eggi:** plakaty min. 1,2 × 1,8 m, tabliczki min. 0,9 × 0,45 m, karteczki 0,45 m, środek na 1,5–1,7 m (poza leżącymi), kadry `ee01…ee12` prostopadle z 1,8–2,2 m.
6. **Tekstury** mapa wskazuje tylko z `decals/` (decal) i `signs/` (szyld); ekrany to decale na ciemnej bryle.
7. Szkło modeli (`mat_clinic_glass`) jest prawie przezroczyste — nie używać jako nośnika koloru.

## 7. Szlif i odbiór (2026-11-28)

Ocena architekta po szlifie: **7,3/10** (brama 7,5 · garkuchnie 8 · hala rybna 7,5 · pasaż 7,5 · gabinet 7 · plac 7,5 · herbaciarnia 7 · dok 7). Audyt 0/0, 63 światła (limit testu 64), najcięższy kadr 672 wywołania rysowania i 0,88 mln trójkątów.

Co zmienił szlif względem pierwszego przebiegu:

1. **Białe owale na stropach i posadzce to przepalenie, nie połysk.** Mocne, prawie białe oprawy blisko powierzchni wychodzą poza zakres jasności; zmiana materiału stropu nic nie dawała. Ciepła baza świeci teraz barwą `#ffd3a0` z mocą 0,27 pierwotnej (`WARM_SCALE`, `WARM_TINT` w `run6.mjs`), a profil pogody ma słabsze `hemiIntensity` i `keyIntensity`.
2. **Silnik zapala naraz tylko 8 świateł punktowych** (`tuning.city.maxLights`). Barwy strefy nie buduje się liczbą świateł: daje ją kilka mocnych akcentów z widocznym źródłem (świetlówka `neon_<barwa>` na lince) i świecąca listwa pod stropem na całym obwodzie strefy (`BAND` w `_run6Kit.mjs`).
3. Bazę przerzedzono do co trzeciej oprawy (gabinet co drugiej, herbaciarnia każda), żeby zmieścić akcenty w limicie 64 świateł.
4. Pomosty są z desek, stropy niskich stref z ciemnej papy z drewnianymi belkami w wysokich halach; numery stanowisk na posadzce zostały tylko w alei garkuchni i na placu; hala rybna i gabinet dostały ogłoszenia i ekrany na ścianach.
