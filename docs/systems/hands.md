# Przedmiot w ręku

Kod symulacji: `src/combat/heldItem.ts`. Scena: `?scene=arena&loadout=gunner&debug=1`.
Gracz trzyma jeden przedmiot: ostrze plazmowe (`blade`) albo broń z wybranego
slotu (`gun`). Moce F/E pozostają niezależne od tego wyboru.

## Sterowanie i zamiana

- LPM (`attack`): ostrze — dotychczasowe combo, ciężki atak i dash-cięcie;
  broń — spust trzymany przez cały czas przytrzymania LPM.
- R (`swap`): zamiana ostrze/broń. Trwa `tuning.hands.swapS` (0,24 s czasu
  gracza). W zamianie oba ataki są zablokowane. Stan `held` zmienia się dopiero
  po zakończeniu; wejście ataku wraca od następnego kroku.
- Zamiana broń → ostrze rusza od razu (nie czeka na nic), a ostrze → broń
  startuje w pierwszym kroku z `dt > 0`, w którym ostrze nie jest zajęte. Zajęte
  = stan ostrza inny niż `idle` i `throwing` (`bladeBusy` podaje scena; Arena
  i RoomScene używają tego samego `HeldItem`). Zamiana ostrze → broń czeka na `idle`. Inne stany ostrza są zajęte, poza
  `throwing`: lot ostrza nie blokuje zamiany. Żądanie czeka najwyżej
  `tuning.hands.swapBufferS` (0,4 s), potem przepada. Hitstop zatrzymuje zegary,
  ale pozwala zapamiętać naciśnięcie R. Kolejne żądania w trwającej zamianie
  nie rozpoczynają nowej zamiany.
- PPM (`block`) w trakcie zamiany natychmiast przywraca ostrze, anuluje zamianę
  i bufor, przekazuje blok do ostrza w tym samym kroku. Z bronią palną w ręce (bez
  zamiany) PPM to celowanie — patrz niżej.
- Celowanie (ADS, S0-07): z bronią palną w ręce (poza zamianą) PPM to celowanie
  (akcja `aim`, opcjonalnie też klawisz), a nie blok — nie wymusza ostrza. Liczby w
  `tuning.player.aim`: wejście 0,18 s, wyjście 0,15 s, FOV × 0,72 (broń może mieć
  `aimFovScale`, snajperka 0,45), czułość × 0,7, ruch × 0,6 (`StatModifier` źródła `aim`),
  brak sprintu, rozrzut × 0,4, odrzut broni w widoku × 0,7, broń przy oku, węższy celownik.
  Celowanie kończą: przełączenie broni (ponowne wciśnięcie PPM), przegrzanie, dash, zamiana
  na ostrze, ŚPM i śmierć; puszczenie wejścia przy pauzie/utracie fokusu kończy je w następnym
  kroku. Żeby blokować z bronią, przełącz na ostrze (R).
  Mechanika: wejściem celowania jest `aim` albo `block` (PPM). `aimT` rośnie liniowo
  w czasie `aim.inS × aimInScale` (skala z definicji broni; Arena jej nie przekazuje,
  RoomScene tak) i maleje w `aim.outS`; wartość widoczna dla reszty gry
  `aim = smoothstep(aimT)`. Celowanie trwa, gdy broń jest w ręku, nie trwa zamiana,
  wejście jest trzymane, brak zatrzasku i scena zezwala (`canAim`: stan `playing`,
  broń nieprzegrzana, `dashS <= 0`). Zatrzask (`aimLatch`) po przerwaniu celowania
  przez zmianę broni, `cancelAim()` (śmierć/reset) albo puszczenie wejścia wymaga
  puszczenia przycisku przed ponownym celowaniem. `aim` zasila: rozrzut broni,
  FOV (`aimFovScale` broni, wartość domyślna `aim.fovScale`), czułość
  (`1 + (aim.sensitivity × aimSensitivityScale − 1) × aim`), mnożnik `moveSpeed`
  (`1 + (aim.moveSpeed − 1) × aim`, `StatModifier` źródła `aim`) i render
  (poza broni między `POSE` a `AIM_POSE`, odrzut × `aim.recoil`).
- Środkowy przycisk (`bladeThrow`) analogicznie natychmiast przywraca ostrze
  i przekazuje rzut. Zasady dostępności rzutu i bloku w samym ostrzu pozostają
  takie jak w module walki wręcz.
- 1/2/3 (`weapon1..3`): wybór istniejącego slotu (scena wywołuje `selectWeapon`
  i `HeldItem.requestGun()`). Nieistniejący slot jest ignorowany.
  Broń → inna broń zmienia model natychmiast, bez zamiany z ostrzem.
  Wyjątek: gdy w ręku jest broń i naciśnięto klawisz **bieżącego** slotu (a w tym
  kroku nie było `weapon_switched` z inną bronią/slotem), `HeldItem` traktuje to
  jak przełącznik i rozpoczyna zamianę na ostrze. Zmiana broni w tym samym kroku
  tłumi ten przełącznik (flaga `weaponChanged`).

`HeldItem.step` zwraca `bladeInput` i `triggerHeld`. Przy broni usuwa
`attack/block/bladeThrow` z held, pressed i released kopii wejścia ostrza.
Pozostałe akcje przechodzą dalej. Nietrzymana broń jest krokowana przez
`Weapon.cool`, więc stygnie i przerywa wiązkę; nie strzela. Ostrze w locie
nadal symuluje lot przy broni w ręku.

## Dane, zdarzenia i widok

Loadout przyjmuje opcjonalne `startHeld: 'blade' | 'gun'`, domyślnie `blade`.
`gunner`, `stormGunner` i `resonancePistolero` zaczynają z `gun`. Reset areny
przywraca tę wartość i czyści zamianę oraz bufor.

Wszystkie liczby z `tuning.hands` są dostępne w lil-gui. Po ukończeniu zamiany,
natychmiastowym przywróceniu ostrza oraz resecie moduł emituje
`held_item_changed: { owner, held, weapon }`. `weapon` to id wybranego slotu
przy broni, `null` przy ostrzu; id pochodzi z `weapon_switched` właściciela.
`dispose()` odpina ten nasłuch.

`Arena.heldView()` i `query('heldItem')` udostępniają `{ held, target, swapping,
swapT }`. Postęp zamiany wynosi 0..1, a poza zamianą 1. Pierwsza połowa pokazuje
przedmiot źródłowy, druga docelowy. Model ostrza FPP jest ukryty w locie,
a pusta prawa dłoń pozostaje widoczna. Przedmioty i dłonie FPP są ukryte poza
stanem `playing`. HUD przygasza blok broni przy
ostrzu na podstawie zdarzenia. Komenda debug `hold blade|gun` ustawia rękę
natychmiast i kasuje bufor/zamianę.

## Render przegubowych dłoni

### Model rąk — taktyczna rękawica (szlif 2026-11-18)

Generator `build_player_arm` w `tools/blender/build_assets.py` zachowuje ciągłą
skinowaną siatkę `tactical_glove`, 18 kości (te same nazwy i osie) i wszystkie
nazwy węzłów oraz gniazd; lustro L jest wypiekane w wierzchołkach. Test
`player_arm GLB contract` w `tests/unit/handRig.test.ts` sprawdza w obu GLB kości,
gniazda, jedyną skinowaną siatkę, budżet trójkątów i nazwy części pod materiały FPP.

- **Anatomia:** dłoń ok. 19 cm od nadgarstka do czubka środkowego. Palce mają różne
  długości (środkowy najdłuższy, serdeczny i wskazujący krótsze, mały wyraźnie
  krótszy), paliczki w proporcji ok. 1 : 0,65 : 0,5, spłaszczony przekrój (szerszy
  niż głębszy), wyraźne kłykcie, bruzdy zgięć od strony dłoni, poduszki paliczków
  i opuszki. Kciuk wyrasta nisko i z boku z mocnego kłębu (thenar), z osią
  zgięcia skręconą ku palcom (opozycja). Kłąb małego palca, wklęsłe wnętrze dłoni
  i poduszki pod kłykciami są częścią powierzchni. Przekroje rękawicy i
  nadgarstka są niemal walcowe — bez przewężenia w nadgarstku.
- **Rękawica** (sztywne części na kościach): `plate_knuckle_*` — gięte, fazowane
  płytki na paliczkach bliższych (staw międzypaliczkowy wolny); `plate_tip_index`,
  `plate_tip_thumb` — wzmocnione czubki; `plate_hand` — trapezowa płyta grzbietu
  pod `resonance_core`, wąski segment przy nadgarstku i poduszka na kłębie małego
  palca; cyan: `dorsal_trace` (linia wzdłuż płyty) i `wrist_light` (lamówka
  mankietu). `resonance_core` (magenta) i `resonance_mount` są w tym samym miejscu
  co wcześniej.
- **Przedramię** (kość `forearm`): `plate_bracer` to rękaw kurtki (owalny,
  zwężający się przekrój, kołnierz mankietu z grubością brzegu, kilka miękkich,
  ukośnych fałd), niski karwasz na grzbiecie rękawa i mankiet rękawicy;
  `trim_bracer` — panel karwasza, śruby i klamra paska; `grip_strap` — paski
  karwasza i mankietu; `bracer_light` — linia światła na panelu. Części o tej samej
  kości i materiale są scalone, żeby nie przekroczyć budżetu liczby siatek sceny
  (`roomStaticBatch.test.ts`, cztery dłonie w `FppViewModel`).
- **Cieniowanie:** sztywne części mają gładkie łuki i ostre krawędzie powyżej 40°
  (kontur toon bez prążków fasetek). Materiały nadaje gra po nazwie węzła:
  `plate_*` pancerz, `trim_*` stal, `grip_*` guma, `tactical_glove` rękawica.
- **Budżet:** 11 898 trójkątów na rękę (wcześniej 10 440; budżet 6–12 tys.):
  rękawica 7 312, `plate_bracer` 1 790, reszta to płytki, paski i akcenty;
  16 siatek na rękę (wcześniej 12); GLB 342 kB (wcześniej 306 kB).

`src/data/hands/bladeGrip.json` zawiera liczby wspólne dla gry i podglądów:

- `socketPosition`: `[0, 0.039, -0.08544]` m względem roota dłoni — rękojeść
  jest o 3,2 mm bliżej wnętrza dłoni, między kciukiem a zgiętymi palcami.
  Blender zapisuje gniazdo w obu GLB; po zmianie tej wartości przebuduj modele.
- `idlePosition`: `[0.24, -0.30, -0.40]` m w układzie kamery — o 4 cm niżej.
- `idleRotation`: `[0.923, -0.477, 1.09]` rad Euler **YXZ** — dawna poza
  `[0.9, -0.7, 0.8]` obrócona w układzie kamery o 0,16 rad wokół osi widzenia
  (czubek ku środkowi) i o 0,08 rad do przodu. Na ekranie ostrze pochyla się
  o kilka stopni ku środkowi kadru zamiast na zewnątrz; ręka nadal wchodzi z prawego
  dolnego rogu. Test `handRig.test.ts` mierzy to pochylenie w rzucie perspektywicznym.
- `offhandDropM`: `0.02` m — lewy chwyt bliźniaczych jest lustrzany i niższy.

Dane waliduje zod w `src/render/handPoses.ts`; `FppBlade` używa ich dla
`plasmaBlade`, `staffBlade` i `twinBlades`. `HandRig` używa tej samej pozycji
gniazda w modelu zastępczym. Kąty palców pozostają w `handPoses.json`.

Pozy chwytów dobrano pomiarem w Blenderze: dłoń dosuwana wnętrzem do boku
rękojeści (luz 0,5 mm), palce zamykane staw po stawie do kontaktu, potem lokalny
szlif kątów. `gripBlade` obejmuje rękojeść `plasmaBlade` (luz do 5 mm), w `twinBlades`
wnika najwyżej ok. 2 mm.

#### Chwyt dopasowany do broni (pole `grip`)

Każda broń w `src/data/weapons/*.json` ma pole `grip` (schemat `weaponGripSchema`
w `src/combat/weapons/weaponSchema.ts`):

```json
"grip": {
  "offset": [0.0003, -0.014, 0.032],
  "pose": "gripRifle",
  "firePose": "gripRifleFire",
  "support": { "offset": [0.0165, 0.0024, 0.0001], "pose": "supportRifle" }
}
```

- `offset` / `rotation` (opcjonalny, rad, Euler XYZ jak Three.js) — położenie gniazda
  `socket_gun` prawej dłoni w układzie modelu broni (m, osie glTF). `FppBlaster`
  stawia dłoń `placeAt(M_grip, 'socket_gun')` zamiast w początku modelu.
- `pose` / `firePose` — pozy z `handPoses.json` dla chwytu i strzału (mieszane
  odrzutem jak dawniej `gripGun` → `gripGunFire`).
- `support` — dłoń podpierająca: `offset`/`rotation` gniazda `socket_support`
  (w pozie dłoni) w układzie macierzy węzła `support` **po** stałych
  `TWO_HAND_SUPPORT_*` i poza (`supportPose` przekazywana do `FppOffhand`). Brak
  pola = `support`. Kierunek przedramienia zostaje taki jak bez korekty (łokieć pod
  dolną krawędzią kadru): dane tylko przesuwają dłoń (do 5 cm wzdłuż łoża i w pionie)
  i zginają nadgarstek w pozie (kość `wrist`, do 0,3 rad); `rotation` jest wtedy
  dokładnie kompensacją zgięcia, a nie obrotem ręki. Pilnuje tego test
  `tests/unit/supportForearm.test.ts`: łokieć (najdalszy narożnik bboxu `plate_bracer`)
  w kadrze gry (FOV `tuning.camera.fov`, 16:9, spoczynek i celowanie) ma NDC y < −1
  albo leży w lewym dolnym rogu, a rzut rękawa zajmuje najwyżej 25% szerokości kadru.
- Chwyt wybiera się po nazwie wyświetlanego modelu (`weaponGripOfModel`), więc zastępczy
  `blaster.glb` dostaje chwyt blastera; bryła zastępcza bez modelu — chwyt domyślny
  (gniazdo w początku, `gripGun`/`gripGunFire`, `support`). Nieznana nazwa pozy też
  wraca do domyślnej; test `weaponGrip.test.ts` pilnuje, by wszystkie istniały.

Pozy: `gripGun`/`gripGunFire` (blaster), `gripPistol`, `gripRifle`, `gripScatter`,
`gripSniper`, `gripBeam`, `gripEmp` (+ `…Fire`), `supportRifle`, `supportScatter`,
`supportSniper`, `supportBeam`, `supportEmp`, `supportPistol`. Pozy kadru (`POSE`, `TWO_HAND_POSE`,
`AIM_POSE`, `TWO_HAND_SUPPORT_*`), położenie broni w kadrze i ruch są bez zmian —
przesuwa się tylko dłoń względem broni. Pistolet i blaster trzymane są oburącz:
lewa dłoń (`supportPistol`, palce zawinięte) obejmuje rękojeść z przodu i od lewej,
na prawej dłoni, a przedramię schodzi skosem w lewy dół kadru (`grip.support` w
`pistol.json` / `blaster.json`; blaster ma węzeł `support` 2 cm niżej, stąd wyższe `offset.y`).

Wynik pomiaru (mm; ujemne = przenikanie; luz liczony na paliczkach środkowego,
serdecznego, małego i dystalnym wskazującego oraz `thumb_2/3`):

| Broń           | prawa: min / maks. luz | wskazujący do spustu  | lewa: min / maks. luz |
| -------------- | ---------------------- | --------------------- | --------------------- |
| `pistol`       | +0,5 / 2,5             | 2,7                   | —                     |
| `blaster`      | −0,2 / 2,4             | ok. 7 (pod kabłąkiem) | —                     |
| `rifle`        | −0,3 / 4,5             | 1,2                   | −0,4 / 14,8           |
| `scatter`      | −0,9 / 3,2             | 0 (przód chwytu)      | −1,2 / 12,6           |
| `sniper_rifle` | +0,4 / 3,3             | 1,2                   | −0,5 / 12,0           |
| `beam`         | −0,4 / 2,6             | 0,9                   | −0,2 / 5,9            |
| `emp_launcher` | −0,6 / 7,7 (kciuk)     | 10,7 (przód chwytu)   | −0,6 / 9,6            |

Spusty pistoletu i blastera są schowane w kabłąku, a `scatter` i `emp_launcher`
— w chwycie; wtedy wskazujący leży pod kabłąkiem / na przedniej krawędzi chwytu
tuż pod komorą. Pozy `…Fire` dociskają wskazujący (chwilowo do ok. 3 mm w bryłę).
Dłoń podpierająca leży pod łożem z palcami wzdłuż niego i dociśniętymi opuszkami;
przy zachowanym kierunku przedramienia palce nie owijają łoża w poprzek. Największe
luzy (lewa kolumna, maks.) są na kciuku (do ok. 15 mm), paliczkach bliższych
wskazującego i małego (w `scatter` wskazujący do 24 mm, środkowy do 11 mm). Gniazda w GLB: `socket_gun` `(0.040, 0.0425, -0.094)`,
`socket_support` `(0.0042, 0.0215, -0.1032)`; bryła zastępcza w `handRig.ts`
ma te same gniazda, `palm_center` i `resonance_core`.

Budowanie: `--only player_arm_L,player_arm_R`; komplet podglądów:
`--only hand_previews`. W `tools/blender/previews/` pliki
`*_before.png` (np. `player_arm_R_before.png`, `hand_grip_pistol_before.png`)
są kopiami stanu przed szlifem rękawicy. Porównuj je z plikami bez przyrostka.
Zbliżenia: `hand_dorsal_detail.png`, `hand_palm_detail.png`, `hand_wrist_detail.png`,
`hand_fist_side.png`, `hand_fist_front.png`, `hand_fpp_view_detail.png` (chwyt
pistoletu od strony kamery gry). Podgląd lewej dłoni na karabinie stosuje te same
przesunięcie i obroty co `FppBlaster.supportMatrix()`. Dodatkowo
`hand_fpp_plasmaBlade.png`, `hand_fpp_staffBlade.png`, `hand_fpp_twinBlades.png`
pokazują tę samą pozę co gra (kamera 70°, 16:9, bez efektów gry), a
`hand_grip_<wariant>_detail.png` pokazują zamknięcie chwytu. Podglądy broni palnej
kontrolują zachowanie dotychczasowego chwytu po pogrubieniu dłoni.

`src/render/handRig.ts` ładuje `player_arm_R.glb` i `player_arm_L.glb` przez
wspólny cache z `applyStyle`. Każda instancja klonuje hierarchię przegubów;
geometria i materiały stylu pozostają współdzielone. Brak pliku albo
`loadModels=false` daje prostą bryłę z taką samą hierarchią nazw i gniazdami.
Kod działa również w testach bez DOM. Zwolnienie dłoni nie zwalnia zasobów cache.

`handPoses.ts` waliduje `src/data/hands/handPoses.json` przez zod: wymagane są
`relaxed`, `open`, `fist`, `gripBlade`, `gripGun`, `gripGunFire`, `support`;
nieznane nazwy węzłów i niefinitywne kąty są błędem. Kąty są w radianach Euler
XYZ. Docelowy kwaternion to `q_rest × q_pose`; `setPose(from, to, t)` miesza
kwaterniony slerpem i przywraca spoczynek pominiętym węzłom, bez kumulacji obrotu.

`socketMatrix(name)` zwraca transformację gniazda względem root dłoni.
Przypięcie liczymy jako `M_hand = M_item × inverse(M_socket)`. Prawa dłoń
ostrza używa `socket_blade` i `gripBlade`. Przy bliźniaczych druga dłoń korzysta
z modelu L i jego gniazda; ujemna skala dotyczy wyłącznie modelu lewego ostrza.
W locie ostrza prawa dłoń zostaje w spoczynkowym położeniu ostrza z pozą `open`.
Podczas całej aktywnej fazy obrotu dwustronnego ostrza dłoń jest ukryta.

Broń palna jest po prawej, przy pozycji `[0.23, -0.17, -0.41]` (`POSE` w `fppBlaster.ts`) w układzie
kamery. Prawa dłoń używa `socket_gun` i pozy z pola `grip` bieżącego modelu
(domyślnie `gripGun`); `weapon_fired` właściciela przełącza ją w pozę strzału,
z powrotem razem z zanikiem odrzutu. Węzeł `support` aktualnego modelu broni
(z `grip.support`) wyznacza położenie lewej dłoni (`socket_support`, poza z
`grip.support.pose`, domyślnie `support`). Gdy węzła nie ma, lewa dłoń nie podpiera broni.

Cały viewmodel jest na osobnej warstwie i rysowany drugim przebiegiem z ściśniętą głębią, więc przedmiot i ręce nie wchodzą w ściany ani wrogów (szczegóły: `docs/systems/render.md`, „Viewmodel zawsze na wierzchu”).

### Wygląd przedmiotów FPP (czysto wizualny)

V lub przytrzymanie Y na padzie uruchamia oglądanie przedmiotu. Gracz unosi
blaster, pokazuje oba boki i wylot lufy, a ostrze obraca wokół rękojeści.
Ponowne wciśnięcie po połowie animacji zaczyna ją od początku. Strzał, zamach,
celowanie i zamiana przedmiotu płynnie przywracają zwykłą pozę. Czas, punkt
obrotu i klatki obu animacji można stroić w panelu `hands.inspect`.

- **Materiały** (`src/render/fppMaterials.ts`): broń, rękojeści, rękawica i karwasz nie używają
  współdzielonego `mat_interactive` (w motywie neon jest jasny), tylko własnych materiałów toon
  po nazwie węzła: `frame`/`hilt`/`plate_*` grafitowy pancerz, `trim*` stal, `grip*` guma,
  `tactical_glove` rękawica. Każdy ma chłodną krawędź światła (rim) i miękkie kolano jasności
  (najwyżej ok. 1,8× albedo), żeby lampy miasta tuż przy kamerze nie przepalały broni do bieli.
- **Ostrze** (`src/render/fppBladeFx.ts`): `blade_core` jest zwężony i jasnocyjanowy, wzdłuż
  ostrza leży addytywna poświata zwrócona do kamery (pulsuje), u emitera rozbłysk, a w aktywnej
  fazie cięcia (lekkie, ciężkie, prowadząca dłoń bliźniaczych) smuga w układzie kamery
  (próbki żyją 0,13 s). Efekty mają `noOutline` i bloom; żadnych dodatkowych świateł punktowych.
- **Broń palna**: błysk wylotu to addytywna gwiazda, miękki biały rdzeń i dwa skrzyżowane płatki
  wzdłuż lufy, z losowym obrotem przy każdym strzale. Ciepło przechodzi z cyanu w biel
  rozgrzanego metalu (nie w czerwień, zarezerwowaną dla wrogów); przegrzanie pulsuje między
  bielą a przygaszonym cyanem, a wylot świeci poświatą zależną od ciepła.
- **Pociski i wiązka**: bełt gracza (smukły, z grubszą głowicą) z addytywną otoczką; wiązka
  `beam` ma biały rdzeń, cyjanową warstwę i dwie drgające poświaty; rzucone ostrze ma biały
  rdzeń z poświatą. Wszystkie bez konturu (kontur na cienkich bryłach rysował czarne kreski).
- **Pozy**: blok trzyma ostrze ukośnie przez kadr (rękojeść z prawego dołu, czubek w lewym
  górnym rogu, środek ekranu wolny). Kij (`staffBlade`) w spoczynku i ładowaniu jest blisko
  kamery, a wysuwa się o 0,2 m tylko na obrót (dłoń jest wtedy ukryta), więc koniec rękawa
  nie wchodzi w kadr.

Bronie dwuręczne (węzeł `support` przed chwytem: rifle, scatter, sniper_rifle, beam, emp_launcher) mają osobną pozę `TWO_HAND_POSE` (pos 0.15, -0.27, -0.45; rot X 0.1, Y 0.11, Z -0.15: lufa wzdłuż kierunku patrzenia, lekki przechył; dalej od kamery przedramię lewej dłoni kończyłoby się w kadrze) i lewą dłoń obróconą o `TWO_HAND_SUPPORT_YAW` oraz pochyloną o `TWO_HAND_SUPPORT_PITCH` (0.8), tak by przedramię wchodziło od lewego dołu kadru i wychodziło poza dolną krawędź (stałe w `src/render/fppBlaster.ts`). Prawa dłoń na chwycie jest w większości zasłonięta przez model broni (widać palce).

### Gest mocy i wolna lewa dłoń

`FppOffhand` przy pojedynczym ostrzu trzyma lewą dłoń schowaną poniżej dolnej krawędzi kadru (niewidoczną); wjeżdża tylko na czas gestu mocy.
`power_used` właściciela wyzwala gest `open`: szybkie wysunięcie dłoni,
następnie wolniejszy powrót w czasie `castS` czasu klatki. Przy broni lewa
dłoń płynnie opuszcza `support` i wraca do jego aktualnej transformacji.
Bez `support` pojawia się tylko na czas gestu. Przy trzymanych bliźniaczych
ostrzach wolna dłoń i gest są wyłączone. `resonance_core` i dodatkowy blask
na `palm_center` wzmacniają magentę; materiał jest własny dla instancji,
więc gest nie zmienia materiałów innych obiektów. Po zakończeniu wraca jasność
spoczynkowa i kolor cyan. Nasłuch zdarzenia jest odpinany w `dispose()`.

### Zamiana i kołysanie

`FppMotion` jest krokowany raz na `render()` czasem klatki. Pierwsza połowa
`swapT` opuszcza stary przedmiot z dłońmi i obraca go w dół (ease-in).
Druga podnosi docelowy zestaw od dołu (ease-out). W połowie oba zestawy mają
tę samą maksymalną transformację opadu; zmienia się widoczny przedmiot.
Ta sama dodatkowa macierz kamery trafia do ostrza, broni i lewej dłoni.

Sway reaguje na różnicę yaw/pitch kamery między klatkami, ze sprężynowym
powrotem i ograniczeniem kąta. Bob ma amplitudę zależną od prędkości poziomej
gracza, wygładzoną także po zatrzymaniu. Kod nie zmienia kamery ani symulacji;
odrzut i gest mogą działać w hitstopie. `arena`, `RoomScene` (pokoje runu),
`melee-test` i `weapons-test` używają wspólnego `FppViewModel`, który posiada
`FppBlade`, `FppBlaster`, `FppOffhand` i `FppMotion`. Scena wywołuje jego
`place()` raz na klatkę; sceny testowe przekazują stały rodzaj przedmiotu.
RoomScene korzysta z tego samego gestu mocy, zamiany i kołysania co Arena.

| Parametry `tuning.hands`                             | Znaczenie                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `swapS`, `swapBufferS`                               | Dotychczasowe zegary symulacji, 0,24 / 0,4 s                              |
| `swapDropM`, `swapAngle`                             | Opad i pochylenie przy zamianie, 0,8 m / −0,8 rad                         |
| `castS`, `castOutFraction`, `castGlow`               | Gest 0,35 s, szczyt przy 22% czasu, przyrost jasności ×3                  |
| `swayAmount`, `swayMax`, `swayReturn`                | Reakcja na obrót, limit w radianach, sztywność powrotu                    |
| `bobAmount`, `bobFrequency`, `bobSpeed`, `bobReturn` | Amplituda w m, faza na metr ruchu, prędkość pełnej amplitudy, wygładzanie |

Spoczynkowa pozycja ostrza i jego chwyt są w `src/data/hands/bladeGrip.json`.
Pozostałe pozy walki są na górze `fppBlade.ts`, pozy broni i wolnej dłoni
w `fppBlaster.ts`, `fppOffhand.ts`; pozy przegubów pozostają w `handPoses.json`.

## Kontrola w 30 sekund

Otwórz arenę z gunner, włącz `god`. LPM strzela. R, odczekanie 0,24 s i kliknięcie
LPM daje cięcie bez strzału. PPM podczas strzelania celuje (przybliżenie), bez ostrza;
środkowy przycisk ma od razu rzucać ostrzem. Podczas lotu wciśnij 2, a następnie
LPM — wybrana broń strzela. Po resecie wraca karabin w ręku.

W ocenie feel zwróć uwagę na długość przerwy 0,24 s, tolerancję bufora 0,4 s
po cięciu, natychmiastowy blok i czytelność zmiany modelu w połowie zamiany.
Sprawdź też palce na chwycie i spuście, lewą dłoń na łożu karabinu oraz F/E:
czy dłoń szybko wychodzi i spokojnie wraca bez przeskoku. R ma chować cały
zestaw poza ekran. Przy rzucie ostrza dłoń pozostaje otwarta; `blade twinBlades`
pokazuje dwa chwyty bez wolnej lewej dłoni, `blade staffBlade` ukrywa dłoń
podczas ciężkiego obrotu. Ruch myszy i chodzenie powinny dawać lekkie opóźnienie
i kołysanie bez utrudniania celowania. Szybkie sceny kontrolne:
`?scene=melee-test&debug=1` i `?scene=weapons-test&debug=1`.
