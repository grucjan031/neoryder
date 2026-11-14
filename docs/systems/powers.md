# Rezonans — moce i energia (F1 #11, F2-05–09)

Właściciel: Moce. Kod: `src/combat/powers/`, dane: `src/data/powers/*.json`, sceny: `?scene=push-test` (dwa sloty, ściana, `StatusSystem`, łuki błyskawicy) i `?scene=melee-test` (Pchnięcie z F1).

## Rejestr i wspólna baza

- `powerSchema.ts`: `powerSchema` to unia zod po `kind` (`cone`, `chain`, `focus`, `barrier`, `grab`). `registry.ts` eksportuje schemat i typ `PowerDefinition`; ładuje wszystkie `src/data/powers/*.json` przez `import.meta.glob` i waliduje je przy starcie. Nieznany `kind`, błędne parametry i powtórzone `id` kończą się błędem.
- `registerPowerKind(kind, factory)` rejestruje mechanizm raz; ponowna rejestracja tego samego rodzaju kończy się błędem. `createPower(id, deps)` tworzy osobny stan mocy przez fabrykę, a nieznane `id` zgłasza błędem. Nowy wariant istniejącego rodzaju wymaga wyłącznie nowego JSON-a. Nowy rodzaj wymaga gałęzi unii i jednej fabryki.
- `Power` udostępnia `def`, `cooldownRemaining`, `active`, `step(dt, input)` i `reset()`. `PowerInput` niesie `pressed`, `held`, `released` konkretnej akcji. `PowerDeps` zawiera wspólną energię, obrażenia, celowanie, cele, promień ściany, bus i tuning; opcjonalne `projectiles` jest wymagane przez Barierę. Skupienie komunikuje skalę czasu zdarzeniem `focus`; scena przekazuje mocą `ctx.feel.playerDt(dt)`.
- `PowerBase` jako jedyna obsługuje koszt przez `PlayerEnergy.spend`, odnowienie `cooldownS`, odmowę `power_denied` (`cooldown` ma pierwszeństwo przed `no_energy`), hak warunkowy `protected canActivate(): boolean` (domyślnie `true`, sprawdzany przed kosztem) i zdarzenie `power_used` przy udanym użyciu. Nieudana próba nie zużywa energii. Samo trzymanie nie ponawia użycia.
- Wciśnięcie przy `dt = 0` trafia do kolejki, wykonywanej raz w pierwszym kroku z `dt > 0`. Hitstop zatrzymuje odnowienie i efekt (także lot do ściany). `reset()` usuwa kolejkę, odnowienie i stan efektu; nie uzupełnia energii.
- `ConePower` zawiera wyłącznie efekt stożka i uderzeń w ścianę. Pchnięcie i Fala korzystają z tej samej klasy, `active = false` (efekt natychmiastowy). `ResonancePush` zachowuje konstruktor, `step(dt, InputSnapshot)`, `use(): number | null` i `reset()` z F1. Jego `loadPush` nadal ogranicza kąt do 180° dla zgodności; ogólny rejestr przyjmuje do 360°.

## Dwa sloty

`PowerSlots` przyjmuje do dwóch mocy lub `null`: slot 0 dostaje `power` (F), slot 1 `power2` (E). Każdy krok przekazuje osobne `pressed/held/released`, również w hitstopie. Pusty slot nic nie robi, `get` poza zakresem zwraca `null`. Obie moce dzielą energię gracza, ale mają osobne odnowienia. `reset()` resetuje obie moce.

## Energia (`PlayerEnergy`)

- `ResourcePool` zasilany `Stats`: max = `maxEnergy` (100), regeneracja = `energyRegen` (25/s), startuje po `tuning.powers.energyRegenDelayS` (2 s) od ostatniego **zużycia**.
- Ładowanie z akcji (nie wstrzymuje regeneracji): zabójstwo wręcz (`enemy_killed` z `killer` = gracz i tagiem `#melee`) +`meleeKillEnergy` (15), udane parowanie (`parry_success`) +`parryEnergy` (10).
- Ostrze (blok) zużywa energię przez `PlayerEnergy.pool` — jedna pula dla mocy i bloku.
- `energy_changed { id, current, max }` przy każdej zmianie z akcji, a w trakcie regeneracji co najwyżej co `energyEventIntervalS` (0,1 s) — dla HUD (#15).

## Pchnięcie Rezonansu (`ResonancePush`, klawisz F)

| Parametr (dane)                   | Start        | Znaczenie                                                       |
| --------------------------------- | ------------ | --------------------------------------------------------------- |
| `cost`                            | 25           | energia za użycie                                               |
| `cooldownS`                       | 0,6          | odnowienie                                                      |
| `coneAngleDeg`, `range`           | 70°, 7 m     | stożek przed oczami (kąt pełny)                                 |
| `damage`, `knockback`             | 10, 14       | obrażenia i impuls w `damage_dealt`                             |
| `wallSlamDamage`, `wallSlamRange` | 30, 3,5 m    | uderzenie w ścianę                                              |
| `knockbackLift`, `shakeDurationS` | 0,15; 0,25 s | minimalna składowa Y kierunku przed normalizacją; czas wstrząsu |

- Odmowa: brak energii → `power_denied { reason: 'no_energy' }`, trwające odnowienie → `reason: 'cooldown'`. Udane użycie → `power_used`, wstrząs kamery (`pushShake`), a przy trafieniu hitstop `pushHitstopMs` (40 ms).
- Cele w stożku dostają obrażenia z tagiem `#power` i odrzut (`damage_dealt.knockback`, kierunek od gracza z lekkim uniesieniem). Ruch po odrzucie realizuje odbiorca (wróg, manekin) — ten sam kanał co ostatni cios combo.
- **Uderzenie w ścianę** jest przewidywane promieniem w chwili pchnięcia: jeśli geometria świata jest bliżej niż `wallSlamRange` w kierunku odrzutu, po czasie lotu (`dystans / knockback`) cel dostaje `wallSlamDamage` z tagami `#power`, `#wall`. Deterministyczne i niezależne od fizyki konkretnego wroga. Ograniczenie: przeszkoda, która pojawi się po pchnięciu, nie liczy się (do oceny w playteście).
- Drużyny filtruje `DamageSystem` (pchnięcie nie rani sojuszników).

## Fala uderzeniowa (`shockwave.json`, klawisz E w push-test)

To wyłącznie dane `kind: "cone"`: pełny kąt `coneAngleDeg = 360` pomija filtr kierunku, więc obejmuje także cele dokładnie za plecami. Zasięg nadal liczony jest w 3D od oczu, odrzut biegnie od gracza do danego celu.

| Parametr                          | Wartość startowa  |
| --------------------------------- | ----------------- |
| `cost`, `cooldownS`               | 40 energii, 1,5 s |
| `coneAngleDeg`, `range`           | 360°, 4 m         |
| `damage`, `knockback`             | 10, 9             |
| `wallSlamDamage`, `wallSlamRange` | 20, 2,5 m         |
| `knockbackLift`, `shakeDurationS` | 0,15; 0,25 s      |

Krótszy zasięg i słabszy odrzut w zamian za kontrolę otoczenia; wyższy koszt i dłuższe odnowienie ograniczają częste czyszczenie przestrzeni. Tagi i feedback jak w Pchnięciu. To balans startowy do F2-18.

## Błyskawica (`chain.json`, `kind: 'chain'`, F2-07)

| Parametr (dane)                        | Wartość startowa           | Znaczenie                                                         |
| -------------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| `cost`, `cooldownS`                    | 30 energii, 1,2 s          | koszt użycia i odnowienie                                         |
| `rangeM`, `coneDeg`                    | 14 m, 20°                  | zasięg i pełny kąt stożka wyboru pierwszego celu                  |
| `jumps`, `jumpRangeM`                  | 3, 5 m                     | maksymalna liczba przeskoków i zasięg pojedynczego przeskoku      |
| `damage`, `falloff`                    | 18, 0,25                   | obrażenia bazowe i spadek: n-ty cel dostaje `damage × 0,75^(n−1)` |
| `statuses`                             | `overload` (4 s, 1 stos)   | nakładane przez `DamageSystem.deal` → `StatusSystem`              |
| `tags`                                 | `#power`, `#elektrycznosc` | tagi obrażeń każdego ogniwa                                       |
| `vfx: { arcLifeS, jitterM, segments }` | 0,2 s, 0,12 m, 6           | czas życia łuku, amplituda zygzaka i liczba odcinków na ogniwo    |

- **Pierwszy cel:** spośród żywych celów w `rangeM` i w stożku `coneDeg` wokół osi celowania (`deps.aim().dir`), niezasłoniętych ścianą (`castWall`), wybierany jest cel o najmniejszym kącie do osi celowania (w razie remisu — bliższy).
- **Brak celu w stożku:** `ChainPower.canActivate()` zwraca `false`, więc moc nie strzela — nie pobiera energii, nie ustawia odnowienia i nie emituje `power_used` ani `power_denied`.
- **Łańcuch przeskoków:** z ostatniego trafionego celu łuk skacze do najbliższego jeszcze nietrafionego celu w `jumpRangeM` (maksymalnie `jumps` razy). Każdy cel może zostać trafiony najwyżej raz w jednym użyciu. Ściana między punktami (`deps.castWall(from, dir, dystans)` przed celem) blokuje trafienie i przeskok.
- **Obrażenia i statusy:** każde trafienie idzie przez `DamageSystem.deal` ze źródłem `owner`, tagami `#power`, `#elektrycznosc` i `statuses` (`overload`), dzięki czemu `StatusSystem` nakłada przeciążenie (przy 3 stosach cel zostaje ogłuszony i wyzwala wyładowanie obszarowe).
- **Wizualizacja (`LightningRenderer`):** `ChainPower` przechowuje aktywne łuki w `arcs` (`{ points, ageS }`), postarzane w `step(dt)` i usuwane po `vfx.arcLifeS` (oraz przy `reset()`). `src/render/lightningRenderer.ts` rysuje zygzak z `segments` odcinków na ogniwo z odchyleniem `±jitterM`, używając materiału `power` z zanikaniem przezroczystości i ponownym użyciem geometrii.

## Chwyt i rzut (`grab.json`, `kind: 'grab'`, F2-09)

| Parametr | Wartość startowa |
| --- | --- |
| `cost`, `cooldownS` | 20 energii, 1,5 s od puszczenia |
| `rangeM`, `aimConeDeg` | 12 m, pełny stożek 36° |
| `maxMassKg` | 100 kg |
| `drainPerS`, `maxHoldS` | 12 energii/s czasu gracza, 5 s |
| `holdDistanceM`, `throwSpeed` | 3 m, 22 m/s |
| `minImpactSpeed`, `impactDamage` | co najmniej 5 m/s, 35 obrażeń |
| `landingNormalY`, `landingSpeedMps` | normalna podparcia ≥ 0,5; całkowita prędkość ≤ 1 m/s |

Wciśnięcie F/E wybiera najbliższy środek ciała w stożku celowania z linią
widzenia do `rangeM`. Wrogowie pochodzą z `EnemyManager.grabTargets()`,
a dynamiczne czarne obiekty scena rejestruje przez `GrabPhysics.registerObject`
z masą. Bliższy ciężki cel nie jest pomijany na rzecz dalszego lekkiego.
`grabbable !== true` albo masa ponad limit emituje `too_heavy` („Za ciężki”);
brak widocznego kandydata emituje `out_of_range` („Za daleko”). Te odmowy
nie pobierają energii ani nie zaczynają odnowienia. Koszt i odmowa braku
energii nadal korzystają ze wspólnej bazy `PowerBase`.

Po koszcie początkowym ciało staje się kinematyczne; punkt przed kamerą
podąża za symulowanym celowaniem. Przelot kształtu od oka blokuje przenikanie
ścian, a odstęp od kapsuły gracza wynosi co najmniej `tuning.powers.grabClearanceM`
(0,02 m). Brak miejsca bezpiecznie zwalnia chwyt. Wróg jest przejęty,
nie porusza się przez AI, nie atakuje i natychmiast
oddaje token oraz miejsce w kolejce dyrektora. Tarcza Tarczownika jest
opuszczona. Odpływ energii, limit czasu i odnowienie używają czasu gracza
(`ctx.feel?.playerDt(dt) ?? dt`); hitstop je zatrzymuje. Wciśnięcie i puszczenie
z hitstopu są buforowane tylko dla aktywnego lub zakolejkowanego chwytu.
Sam hitstop wyrównuje snapshoty wrogów, skrzyń i wiązki, więc render nie
interpoluje ich ruchu. Samo przytrzymanie nie ponawia nieudanego chwytu.

Puszczenie klawisza nadaje dynamicznemu ciału prędkość `throwSpeed` zgodną
z aktualnym celowaniem i włącza CCD. Brak energii lub limit trzymania upuszcza
je z zerową prędkością bez obrażeń. W obu przypadkach zaczyna się odnowienie.
`power_used` pozostaje zdarzeniem kosztu aktywacji; HUD pokazuje „Trzymanie”,
a odliczanie uruchamia dopiero `power_released`. Nowy chwyt zeruje stary licznik
HUD. Puszczenie ma pierwszeństwo przed końcem energii/czasu w tej samej klatce.
Szybki chwyt i puszczenie po hitstopie zatwierdzają punkt trzymania przed rzutem.

Odczyt kontaktów Rapiera i przelot kształtu wykrywają świat oraz wrogów,
w tym sensor Drona i początkowe nakładanie. Lot jest sprawdzany już w klatce
puszczenia, w czasie świata (`worldDt`), niezależnie od Skupienia. Pierwsze
kwalifikujące uderzenie przy prędkości co najmniej równej progowi
zadaje po `impactDamage` rzucanemu wrogowi i trafionemu wrogowi, każdemu raz;
skrzynia nie wymaga własnego `Health`. Oba trafienia wykonują
`DamageSystem.deal` ze źródłem gracza i tagami `#power`, `#grab`; śmierć
rzucanego w pierwszym trafieniu nie przerywa drugiego. Kolejne odbicia
i lądowanie nie powtarzają obrażeń. Upuszczenie bez rzutu nigdy nie rani.
Przy kontakcie ze światem próg dotyczy prędkości w kierunku normalnej
uderzenia; tarcie po podłodze lub styczny kontakt ze ścianą nie wystarczają.
Podłoga i lądowanie wymagają małej całkowitej prędkości po kroku solvera.
Jednoczesny kontakt z wrogiem ma pierwszeństwo przed światem.
Podparcie (także na skrzyni), po wyhamowaniu, kończy przejęcie i przywraca
żywemu wrogowi AI. Skrzynia po pierwszym trafieniu wraca do zwykłej fizyki
dynamicznej, zachowując ruch i tracąc możliwość kolejnych obrażeń tego rzutu.
Kontakt z czarnym obiektem sam w sobie nie zadaje obrażeń Chwytu.

Śmierć/despawn trzymanego celu natychmiast odłącza chwyt. Śmierć gracza
upuszcza cel i wyłącza obrażenia pozostałych lotów. `reset()` przywraca typy
ciał i CCD, zwalnia przejęcia, kolejkę wejścia, wiązkę oraz subskrypcje.
Subskrypcje trwają tylko podczas chwytu/lotu. Nie ma interceptorów pocisków
ani bezpośredniego nakładania statusów.

`GrabRenderer` odczytuje interpolowane `previous/current` wiązki z
`GrabPower.beam`, rysując cyjanową linię od dłoni do celu wyłącznie podczas
trzymania. Geometria jest wielokrotnie używana, a zwalniana przy dispose.
Kolor, przezroczystość i położenie dłoni są w `tuning.vfx.grab*` i lil-gui.

### Scena `grab-test` — kontrola w 30 sekund

1. Otwórz `?scene=grab-test&debug=1`, kliknij canvas, przytrzymaj F na przednim
   Szturmowcu: podąża przed kamerą, nie atakuje, widać wiązkę i odpływ energii.
   Puść w kierunku wroga lub białej ściany; sprawdź pojedyncze obrażenia.
2. Wyceluj w Drona i Tarczownika po bokach, następnie w Egzekutora za plecami
   i dużą skrzynię po prawej: dwa ostatnie cele odmawiają „Za ciężki”.
   Celowanie w pustą przestrzeń daje „Za daleko”, bez kosztu.
3. Chwyć małą czarną skrzynię i rzuć we wroga. Podczas kolejnego chwytu wpisz
   `energy 0` lub trzymaj 5 s: cel opada bez rzutu. `energy 100` uzupełnia energię,
   `kill held` sprawdza śmierć trzymanego wroga, `reset` odtwarza scenę,
   `god` pozwala spokojnie ocenić zachowanie wrogów.

Feel do oceny: czy wybór najbliższego celu i skok do punktu 3 m są czytelne,
czy prędkość 22 m/s i obrażenia 35 dają satysfakcjonujący rzut, czy koszt
20 + 12/s pozwala szybko zdecydować o celu rzutu, i czy puszczenie przy
braku energii wyraźnie różni się od rzutu.

Testy: `grabPower.test.ts` (prawdziwy Rapier: wybór, odmowy, energia, kinematyka,
pięć archetypów, tokeny i kolejka, hitstop, upuszczenie, kolizje, sensory,
jednokrotność obrażeń, śmierć, reset), `grabTest.test.ts` (scena, czas gracza,
komendy, reset bez narastania ciał, HUD, interpolacja i sprzątanie renderera).
E2E i ręczny playtest wykonuje koordynator.

Wyniki przeglądu i testy regresji: `docs/issues/F2/grabReview.md`.

## Scena `push-test`

Wariant `melee-test` ze ścianą 2–3 m za przednimi manekinami, `StatusSystem` i `LightningRenderer`. `src/data/scenes/pushTest.json` ustawia sloty `["push", "shockwave"]`, trzy przednie manekiny i dwa za plecami gracza w odstępach pozwalających łańcuchowi Błyskawicy przeskoczyć przez 4 cele. Kolejność pierwszych trzech manekinów oraz pozycja gracza i ściany pozostają zgodne z testem F1. Manekiny ślizgają się po odrzucie z tarciem i zatrzymują na ścianach (to samo dotyczy odrzutu ostatniego ciosu combo w `melee-test`). Query: `energy`, `dummyHp`, `dummyPos`, `powerSlots`, `powerCooldowns`.

Komenda debug `power <slot 1|2> <id>` wstawia dowolną moc z rejestru do wskazanego slotu jako świeżą instancję. Resetuje zastępowaną moc (usuwa kolejkę i oczekujące uderzenia), zachowuje stan drugiego slotu i bieżącą energię. Błędny slot lub id zwraca pomoc i listę dostępnych mocy. `energy [n]` pokazuje lub ustawia energię. Sceny `melee-test` i `parry-test` zachowują sterowanie F z F1.

### Kontrola w 30 sekund

1. Otwórz `?scene=push-test&debug=1`, kliknij canvas i naciśnij F: środkowy manekin leci do ściany, traci łącznie 40 HP; tylne manekiny pozostają nietknięte.
2. Użyj debug `reset`, naciśnij E i obróć się: wszystkie pobliskie manekiny, także dwa z tyłu, dostają obrażenia i odrzut. Energia spada o 40; natychmiastowe ponowne E jest odrzucone z powodu odnowienia.
3. Wpisz `power 1 chain`, `reset` i naciśnij F patrząc w środkowego manekina: łuk Błyskawicy trafia środkowego manekina i przeskakuje po sąsiednich (łącznie 4 cele ze spadkiem obrażeń i nałożeniem `overload`), a magenta zygzak zanika po 0,2 s. Odwróć wzrok w bok (poza stożek) i naciśnij F — brak strzału i brak kosztu energii. Trzykrotne trafienie grupy (`energy 100` między strzałami) dobija do 3 stosów `overload` i wyzwala wyładowanie.

## Testy

F2-06 i F2-08: `focusPower.test.ts` sprawdza start, koszt, odpływ według
`playerDt`, wygaśnięcie, wcześniejsze wyłączenie, brak energii, odnowienie od
końca, reset i bufor hitstopu. Istniejące `feel.test.ts` oraz `arenaFocus.test.ts`
pokrywają dystans gracza, powrót czasu i limit `SIM_DT × 2` bez powielania ich
asercji. `focusWorld.test.ts` uzupełnia je o rzeczywisty ruch wroga i pocisku
Rapier (0,3 dystansu w sekundę) oraz hitstop w `GameLoop`; pomiar poziomego
ruchu izoluje skalę czasu przez wyłączenie docisku kapsuły do podłoża.
`barrierPower.test.ts` obejmuje rzeczywiste odbicie do strzelca, właściciela
i drużynę gracza, tył, energię, odpinanie interceptora, ignorowanie kolejnego
wciśnięcia, wybuch obszarowy i odczyt stanu przez renderer.
`barrierTest.test.ts` sprawdza scenę, klawisze F/E, reset i sprzątanie.

`tests/unit/powers.test.ts` i `reviewFixes.test.ts` zachowują asercje F1 (energia, odmowy, stożek, ściana, hitstop i reset). `powerRegistry.test.ts` sprawdza ładowanie i błędy rejestru, wspólną bazę na osobnej mocy testowej, sloty i ich wspólną energię, Falę 360° oraz usuwanie oczekujących uderzeń. `chainPower.test.ts` sprawdza wybór pierwszego celu w stożku, kolejność przeskoków bez powtórzeń, przerwanie powyżej `jumpRangeM`, spadek obrażeń, nakładanie `overload` przez `StatusSystem`, blokadę przez ścianę, brak kosztu przy braku celu, wygasanie `arcs` oraz `LightningRenderer`. `pushTest.test.ts` sprawdza dane sceny, F ze ścianą, E w hitstopie i za plecami, reset, komendę `power`, sprzątanie i zgodność scen F1. `tests/e2e/pushTest.spec.ts` pozostaje bez zmian (prawdziwe F: odrzut ponad 1 m, −40 HP, zużycie energii); uruchamia go menedżer.

## Skupienie (`focus.json`, `kind: 'focus'`, F2-06)

Parametry startowe: `cost = 20`, `durationS = 3`, `drainPerS = 15`,
`worldScale = 0.3`, `cooldownS = 4`. Wszystkie są danymi walidowanymi zod.
Wciśnięcie emituje `focus { worldScale, durationS }` i pobiera koszt startowy.
Kolejne kroki pobierają `drainPerS × dtPlayer`, najwyżej za pozostały czas
działania. Gdy energii nie wystarcza na krok, zużywana jest reszta puli i moc
gaśnie. Opłacony krok pozostawia moc aktywną nawet przy dokładnie zerowej
energii; koniec następuje, gdy następnego kroku nie da się opłacić. Naturalny
koniec, ponowne wciśnięcie, brak energii i reset aktywnej mocy wysyłają
`focus { worldScale, durationS: 0 }`. Samo trzymanie F nie kończy mocy.
Odnowienie zaczyna się dopiero po zakończeniu, niezależnie od jego przyczyny;
reset zeruje je. `startCooldown()` emituje `power_cooldown { power, user,
cooldownS }`, od którego HUD zaczyna odnowienie. Hitstop wstrzymuje odpływ,
zegar mocy oraz odliczanie aktywnego Skupienia i spowolnienia w `FeelSystem`.
Ponieważ pętla nie udostępnia stanu hitstopu, `FeelSystem` śledzi maksymalny
pozostały czas z tych samych zdarzeń `hitstop`. Slowmo F1 bez aktywnego
Skupienia nadal odlicza czas rzeczywisty. Test z sekundą hitstopu wywołuje
`feel.update` przez cały cykl i potwierdza pełne `durationS` czasu gracza oraz
powrót świata do 1 po `slowmoRecoverS`.

Obie moce interpretują wciśnięcie według stanu w chwili jego odebrania, również
w hitstopie. Wciśnięcie podczas Skupienia wyłącza je, a podczas Bariery jest
ignorowane, także jeśli moc naturalnie wygasa w tym samym kroku; bez nowej
aktywacji lub fałszywego `power_denied`. Kolejność `PowerBase.step` pozostałych
mocy pozostaje bez zmian.

`FeelSystem` pozostaje właścicielem skali czasu i płynnego powrotu świata;
sceny przekazują graczowi i mocom `playerDt`, a wrogom i pociskom czas świata.

## Bariera (`barrier.json`, `kind: 'barrier'`, F2-08)

Parametry startowe: `cost = 20`, `durationS = 2`, `arcDeg = 160`,
`costPerReflect = 5`, `cooldownS = 4` (od aktywacji). Ponowne wciśnięcie
aktywnej Bariery nic nie robi i nie pobiera kosztu.

Aktywacja dołącza interceptor. Trafienie musi pochodzić od drużyny `enemy`,
mieć cel równy graczowi oraz mieścić się w przednim łuku 3D: kąt między
kierunkiem patrzenia i `-hit.dir` ≤ `arcDeg / 2`. Po pobraniu kosztu odbicia
`reflect` kieruje pocisk do bieżącej pozycji strzelca z `targets()`; scena
podaje środek tułowia z danych modelu. Jeśli strzelca już nie ma, pocisk wraca
przeciwnie do kierunku lotu. Nowy właściciel to gracz, drużyna `player`,
prędkość i obrażenia bez mnożników. Odbicie emituje `projectile_reflected`.
Pocisk z tyłu trafia normalnie. Brak energii na odbicie wyłącza Barierę,
odpina interceptor i przepuszcza to samo trafienie. Koniec czasu i reset też
odpinają interceptor. Promienie ciągłe i wybuchy obszarowe omijają ten kanał.

`BarrierRenderer` w `src/render/` czyta wyłącznie `active` i
`reflectionFlashS`, pokazując cyjanowy płat przed kamerą. Geometria i
przezroczystość są strojone przez `tuning.vfx.barrier*`, czas błysku przez
`tuning.powers.barrierFlashS`; wszystkie wartości są w lil-gui. Render nie
odlicza czasu ani nie zmienia mocy.

`AiTest.render` wybiera aktywną Barierę z dowolnego slotu (F lub E).
`push-test` przekazuje `projectiles` do fabryk; komenda `power <1|2> barrier`
działa, a błąd tworzenia nieobsługiwanej mocy zwraca komunikat i zachowuje slot.
Testy Bariery obejmują również kąt boczny 90°, dokładną granicę `arcDeg/2`,
wektor odbicia bez strzelca oraz odnowienie czasu życia i historii trafień
przez `ProjectileSystem.reflect`. Reset `barrier-test` kończy Skupienie,
a kolejne `feel.update` przywracają skalę świata do 1.

## Scena `barrier-test` — kontrola obu mocy w 30 sekund

`src/data/scenes/barrierTest.json` ustawia trzy Strzelce przed graczem,
sloty `["focus", "barrier"]`, energię 100 i regenerację 20/s. Scena bazuje na
`AiTest`, pokazuje energię, aktywność i odnowienie F/E. Komenda `energy [n]`
uzupełnia energię; dostępne są również `god` i `spawn` sceny AI. Query:
`energy`, `powerSlots`, `powerActive`, `playerPos`.

1. Otwórz `?scene=barrier-test&debug=1`, kliknij canvas i naciśnij F. Idź w bok:
   gracz reaguje normalnie, przeciwnicy i ich pociski zwalniają. Ponowne F
   kończy efekt; zwróć uwagę na płynny powrót świata i odpływ energii.
2. Ustaw `energy 100`, patrz na Strzelców i naciśnij E tuż przed dolotem salwy.
   Cyjanowy płat błyska przy odbiciu, pociski wracają do strzelców i mogą ich
   zranić. Kolejne E nie odnawia czasu osłony. Po dwóch sekundach osłona znika.
3. Odwróć się plecami podczas działania: pociski trafiają normalnie. Ustaw
   `energy 0` podczas aktywnej osłony: następny przedni pocisk ją wyłącza i
   trafia gracza. W razie potrzeby użyj `god` do obserwacji i resetu sceny.

Do oceny przez człowieka: czytelność przedniego łuku, widoczność błysku bez
zasłaniania celów, możliwość uników podczas Skupienia i tempo wydawania
wspólnej energii przy obu mocach. E2E uruchamia koordynator (ograniczenie
Playwright EPERM w sandboxie workera).
