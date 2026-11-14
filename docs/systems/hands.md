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
- Zamiana ostrze → broń czeka na `idle`. Inne stany ostrza są zajęte, poza
  `throwing`: lot ostrza nie blokuje zamiany. Żądanie czeka najwyżej
  `tuning.hands.swapBufferS` (0,4 s), potem przepada. Hitstop zatrzymuje zegary,
  ale pozwala zapamiętać naciśnięcie R. Kolejne żądania w trwającej zamianie
  nie rozpoczynają nowej zamiany.
- PPM (`block`) przy broni lub w zamianie natychmiast przywraca ostrze,
  anuluje zamianę i bufor, przekazuje blok do ostrza w tym samym kroku.
  Okno parowania zaczyna się bez opóźnienia wynikającego z zamiany.
- Środkowy przycisk (`bladeThrow`) analogicznie natychmiast przywraca ostrze
  i przekazuje rzut. Zasady dostępności rzutu i bloku w samym ostrzu pozostają
  takie jak w module walki wręcz.
- 1/2/3 (`weapon1..3`): wybór istniejącego slotu i żądanie dobycia broni,
  także po naciśnięciu bieżącego slotu. Nieistniejący slot jest ignorowany.
  Broń → inna broń zmienia model natychmiast, bez zamiany z ostrzem.

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

Broń palna jest po prawej, przy pozycji `[0.32, -0.28, -0.42]` w układzie
kamery. Prawa dłoń używa `socket_gun` i `gripGun`; `weapon_fired` właściciela
przełącza ją w `gripGunFire`, z powrotem razem z zanikiem odrzutu. Węzeł
`support` aktualnego modelu broni wyznacza położenie lewej dłoni (`support`,
`socket_support`). Gdy węzła nie ma, lewa dłoń nie podpiera broni.

Cały viewmodel jest na osobnej warstwie i rysowany drugim przebiegiem z ściśniętą głębią, więc przedmiot i ręce nie wchodzą w ściany ani wrogów (szczegóły: `docs/systems/render.md`, „Viewmodel zawsze na wierzchu”).

Bronie dwuręczne (węzeł `support` przed chwytem: rifle, scatter, sniper_rifle, beam, emp_launcher) mają osobną pozę `TWO_HAND_POSE` (niżej i bliżej środka) i lewą dłoń obróconą o `TWO_HAND_SUPPORT_YAW`, tak by przedramię wchodziło od lewego dołu kadru (stałe w `src/render/fppBlaster.ts`).

### Gest mocy i wolna lewa dłoń

`FppOffhand` przy pojedynczym ostrzu trzyma lewą dłoń schowaną poniżej dolnej krawędzi kadru (niewidoczną); wjeżdża tylko na czas gestu mocy.
`power_used` właściciela wyzwala gest `open`: szybkie wysunięcie dłoni,
następnie wolniejszy powrót w czasie `castS` czasu klatki. Przy broni lewa
dłoń płynnie opuszcza `support` i wraca do jego aktualnej transformacji.
Bez `support` pojawia się tylko na czas gestu. Przy trzymanych bliźniaczych
ostrzach wolna dłoń i gest są wyłączone. `resonance_core` i dodatkowy blask
na `palm_center` wzmacniają magentę; materiał jest własny dla instancji,
więc gest nie zmienia materiałów innych obiektów. Po zakończeniu wraca jasność
spoczynkowa. Nasłuch zdarzenia jest odpinany w `dispose()`.

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

Pozycje i kąty widoku do strojenia są w stałych na górze `fppBlade.ts`,
`fppBlaster.ts`, `fppOffhand.ts`; pozy przegubów pozostają w JSON.

## Kontrola w 30 sekund

Otwórz arenę z gunner, włącz `god`. LPM strzela. R, odczekanie 0,24 s i kliknięcie
LPM daje cięcie bez strzału. PPM podczas strzelania ma od razu blokować i parować;
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
