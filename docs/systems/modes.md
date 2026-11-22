# Tryby areny

Przejęcie (S2b-01) uruchamia się z tablicy misji, sekcja „Tryby areny”, albo
`?scene=run&mode=conquest&loadout=classic&debug=1`. Szturm jest drugim aktywnym
trybem; Kradzież rdzenia jest dostępna z tablicy oraz przez URL. Tryb wyklucza parametr misji
i nie zmienia kampanii.
Szturm i Kradzież mają też duże areny (sekcja niżej); `?arena=<id>` w debug wybiera arenę.
Skrót uruchomienia Przejęcia: `?scene=conquest&arena=arenaContainerPort&debug=1`.
Skrót korzysta z tego samego hosta RunScene (debug `sceneId()` zwraca `run`).

## Dane i reguły

### Kradzież rdzenia — S2b-03

Uruchomienie: `?scene=run&mode=heist&debug=1`. Jeden węzeł w istniejącym
`combatRing`, największej arenie combat (28×28 m). Przeciwległe końce osi Z
oddzielają bazę `(0, 0, -11.5)` od ewakuacji `(0, 0, 10)` o 21,5 m.
Kolumny zapewniają osłony i boczne drogi; baza leży za niską osłoną,
z odstępem pozwalającym zmieścić pełny promień podniesienia. Dane pokoju bez zmian.

W `src/data/modes/heist.json`: 3 życia, odrodzenie po 2 s, promień podniesienia
1,2 m, ewakuacji 2 m, wymagany nieprzerwany pobyt z rdzeniem 3 s.
Wyjście ze strefy zeruje postęp. `carrySpeed=0.75` nakłada `StatModifier`
na ruch; dash, sprint i ślizg są blokowane na czas niesienia. Podniesienie
przerywa trwający dash/ślizg. Śmierć zostawia rdzeń na podłodze w miejscu
gracza i odejmuje jedno życie; odrodzenie przy ewakuacji resetuje zasoby
i wyposażenie tak jak w Szturmie. Przy zerze żyć następuje porażka.
Limit czasu `timeLimitS=0` jest wyłączony; dodatnia wartość kończy próbę
porażką. Zegar i symulacja czekają podczas odrodzenia.

Rdzeń ma stany `base`, `player`, `dropped`, `enemy`. Podniesienie jest automatyczne: gracz
wchodzący w `pickupRadiusM` (1,2 m, XZ) od rdzenia w stanie `base` albo `dropped` zostaje
nosicielem (chyba że blokuje to debugowy `heist drop`). Upuszczony rdzeń leży na wysokości bazy.
Zabicie nosiciela-wroga upuszcza rdzeń; zniknięcie nosiciela z listy też. Gracz niosący rdzeń
zlicza `extractElapsedS` tylko w `extractRadiusM` (2 m) od ewakuacji, przy `extractS` (3 s) wygrywa. Wróg dotykający
upuszczonego rdzenia staje się nosicielem; `moveGoal` wskazuje mu bazę.
Dotarcie do bazy odkłada rdzeń, śmierć nosiciela upuszcza go w aktualnej pozycji.
Pozostali wrogowie otrzymują cel na gracza z rdzeniem albo na sam rdzeń.
Nosiciel otrzymuje `enemyCarrySpeed=0.55` przez `Stats` oraz priorytet marszu:
ignoruje gracza poza `enemyDefendRangeM=2` m. W tym promieniu wraca do zwykłej
reakcji bojowej swojego archetypu; nadal niesie rdzeń i pozostaje spowolniony.
Powrót przerywa rozpoczęty atak, ale nie ogłuszenie ani kontrolę Rezonansem.
Odłożenie lub utrata rdzenia usuwa modyfikator i przywraca poprzedni zasięg
reakcji. Pozostali wrogowie i pozostałe tryby nie dostają tych ustawień.

Posiłki: maksymalnie 6 żywych, spawn co 3 s, `assaulter`/`gunner`, punkty
`(-10,0,-10)`, `(10,0,-10)`, `(-5,0,-11)`, `(5,0,-11)`. Minimum 5 m od
gracza, 1,6 m od wrogów i 0,8 m wolnej podłogi. Brak bezpiecznego punktu
odracza spawn. Zwycięstwo rozlicza `rewardRooms=6`, porażka 0, `modeId=heist`;
bez zmiany wersji zapisu ani kolejności nagród. Wznowienie rozpoczyna arenę od nowa.

HUD pokazuje stan opisowo, życia, kierunek i dystans do celu, pasek ewakuacji
i ograniczenia ruchu. Bursztyn `#ffae1a` oznacza rdzeń/gracza, czerwień
`#e0262b` nosiciela wroga. Rdzeń ma emisyjne pasy i bursztynowe światło,
podczas niesienia znajduje się nad nosicielem. Na telefonie HUD zajmuje pas
pod kredytami. Nowy tryb nie modyfikuje celów misji.

Debug: `heist grab`, `heist drop`, `heist extract`, `heist lives <n>`,
`query('heist')`. `extract` wymaga niesionego rdzenia i pomija odliczanie tylko
jako komenda debug. Po debugowym `drop` trzeba odejść ze strefy, aby znów
podnieść rdzeń. Ręcznie: dojść do bazy, podnieść rdzeń, sprawdzić brak dasha
i sprintu, wrócić do pierścienia ewakuacji i utrzymać go przez 3 s.
Osobno: zginąć z rdzeniem, odzyskać go po odrodzeniu i sprawdzić finał życia.

### Przejęcie

`src/data/modes/conquest.json` przechodzi `modeSchema` i walidację geometrii:
3–5 różnych punktów, kolejno od A do E, wolne koła na podłodze, odstęp minimum 12 m,
osiągalność jak w `validateLayout`, znany pokój combat i obsługiwana biała lista
wrogów. Pole `arenas` zawiera siedem aren (kolejność ma znaczenie dla wyboru bez
seeda i dla losowania z seeda): `arenaContainerPort`, `arenaOverpass`,
`arenaRooftops`, `arenaPowerPlant`, `arenaConstructionSite`, `arenaRailYard`,
`arenaFloodedDocks`. Wszystkie mają pięć punktów A–E o promieniu 5 m (poza
`arenaRailYard`: spawny z marginesem 1,1 m, reszta 0,8 m), `arena.maxAlive` 12,
`arena.enemyTickets` 180–200 (port 200, estakada 200, dachy 190, elektrownia 200,
budowa 180, bocznica 200, doki 190), `arena.exclusive` (nie trafiają do zwykłego
runu) i `spawnRing` (`minM` 25, `maxM` 85–100; 24–41 spawnów, w dokach z listy `spawnPoints` pokoju, w pozostałych z `arena.spawnPoints`).
Pogody: port `storm`, estakada `smog`, dachy `drizzleWind`, elektrownia `ashfall`,
budowa `clearNight`, bocznica `snow`, doki `rain`. Punkty i geometria każdej areny:
[arenas.md](arenas.md). Dawny `combatRing` nie jest już na liście trybu (stary format
`roomId` + `points` w definicji trybu nadal jest odczytywany).
Punkty są w `room.arena.points`, spawny w pokoju lub opcjonalnym
`room.arena.spawnPoints`. Spawny trybu są walidowane poza strefami z marginesem
`navigationClearanceM`; zwykłe spawny pokoi nie są zmieniane. Szczegóły: [arenas.md](arenas.md), [weather.md](weather.md).

Bez wpisanego seeda start z tablicy i bezpośredniego URL wybiera pierwszą arenę
(port), a run nadal dostaje losowy seed. Wpisany `?seed=` wybiera arenę przez
osobny strumień `new Rng(seed).fork('conquest-arena').pick(arenas)` (jedno losowanie
z listy w kolejności z pliku). Debugowy `?arena=<id>` ma
pierwszeństwo i akceptuje tylko id z listy (inne id w debug = błąd); poza debug jest ignorowany.
Wybrany id jest zapisany w istniejącym `MapNode.fixed.roomId`, więc wznowienie
nie losuje areny ponownie i zachowuje stare zapisy combatRing.

Wartości z `conquest.json`: pula 120 i limit 8 żywych (domyślne; każda obecna arena
nadpisuje je przez `arena.enemyTickets` i `arena.maxAlive`, które nie mogą przekroczyć
`tuning.modes.conquest.maxAlive` = 12 ani limitu pokoju, jeśli go podaje). `spawnIntervalS` 3,
`captureS` 6, `bleed` 1/s (`holdTwoPerS`) i 3/s (`holdThreePerS`), `rewardRooms` 6,
wrogowie `assaulter` i `gunner`. Siła punktu: gracz w kole (promień punktu, wysokość
w granicach `zoneHeightM` = 2 m) przesuwa postęp ku +1 o `dt / captureS`, wróg ku −1,
wspólna obecność (`contested`) albo brak obecności nie zmienia postępu. Przejście przez 0
oddaje punkt jako `neutral`, pełne +1 / −1 daje właściciela `player` / `enemy`; przeciwna
strona przejmuje więc punkt po łącznie 2·`captureS` (6 s do zera i dalsze 6 s).
Zmiana właściciela emituje `conquest_captured { id, owner, owners }` (`owners` = właściciele
wszystkich punktów) i komunikat HUD. Ubytek puli na sekundę: niech `held` = punkty gracza,
`total` = wszystkie, `majority = floor(total/2)+1`; `held == total` → `holdThreePerS`,
`held >= majority` → `holdTwoPerS + (holdThreePerS − holdTwoPerS)·(held − majority)/(total − majority)`,
inaczej 0 (przy pięciu punktach 3 → 1/s, 4 → 2/s, 5 → 3/s). Każde zabójstwo wroga odejmuje 1.
Pula nie spada poniżej zera, spawn nie zużywa puli.

Kontroler `Conquest` nie korzysta z DOM ani renderu. Host `RoomScene` podaje
pozycje żywych wrogów, tworzy posiłki i ustawia `Enemy.moveGoal`. Szturmowiec
i strzelec dalej niż `detectRangeM` (10 m) od gracza idą do najbliższego (w linii prostej, XZ)
punktu, który nie należy do wroga (neutralnego lub gracza); w promieniu 10 m od gracza `moveGoal`
jest czyszczony i wracają do zwykłej walki. Gdy wszystkie punkty należą do wroga, cel to
własna pozycja (stanowisko). Dla aren z siatką nawigacji (`arena.exclusive` lub `spawnRing`) cel
przechodzi przez `ArenaNavigation.next` (kolejny waypoint). Bez `moveGoal` AI działa jak przed dodaniem trybu.

Spawn (co `spawnIntervalS` = 3 s, pierwszy od razu; wstrzymany przy puli <= 0, wyniku trybu,
limicie żywych `maxAlive`): kandydat jest bezpieczny, gdy ma wolną podłogę z marginesem
`spawnClearanceM` (0,8 m), >= `minSpawnDistanceM` (15 m) od gracza i >= 2·`spawnClearanceM`
od żywych wrogów. Bez `spawnRing`: kandydaci to bezpieczne punkty areny należące do wroga;
gdy ich brak, bezpieczne spawny areny (`arena.spawnPoints` albo `spawnPoints` pokoju), a w
starym układzie bez danych areny cztery narożniki podłogi odsunięte od krawędzi o
`edgeInsetM` (2 m); wybór: jedno `rng.pick`. Z `spawnRing`: spawny bezpieczne i co najmniej
`ring.minM` od gracza; preferowane te w `ring.maxM`, a wśród nich niewidoczne dla gracza (zasłonięte
bryłą, promień z wysokością `spawnSightHeightM` = 1,5 m); jeśli takich brak, widoczne w pierścieniu,
w ostateczności dowolny dozwolony. Ocena: odległość do najbliższego celu (punkty sporne, a gdy
ich nie ma, punkty niebędące własnością wroga), mniejsza lepsza; poza pierścieniem odległość od gracza.
Spośród remisów na najlepszym wyniku jedno `rng.pick`. Brak kandydata odracza spawn bez losowania.
Walidacja wymaga w arenach z `spawnRing` co najmniej `minRingSpawns` (16) różnych spawnów.
Wspólne odległości i wysokość strefy są w `tuning.modes.conquest`
(`maxAlive` 12, `minRingSpawns` 16, `spawnSightHeightM` 1,5, `minPointDistanceM` 12,
`minSpawnDistanceM` 15, `detectRangeM` 10, `zoneHeightM` 2, `spawnClearanceM` 0,8,
`edgeInsetM` 2, `goalStopM` 0,5; automatycznie widoczne w lil-gui). Dla aren z `spawnRing` kolejność wyboru
opisuje [Silnik dużych map](arenas.md#silnik-dużych-map). Wieżyczki nie uczestniczą.

Zwycięstwo (`outcome = 'victory'`) następuje, gdy pula jest równa 0 i żywych wrogów jest 0
(sprawdzane co krok); wtedy pokój wysyła `room_cleared`, a `RunManager.completeRoom` woła
`finish('victory')`. Śmierć gracza oznacza porażkę. `roomsCleared` wynosi 6 przy
zwycięstwie i 0 przy porażce; `summary.modeId = 'conquest'`. Pozostałe składniki
nagród liczy dotychczasowa ekonomia. Pole `modeId` w stanie i podsumowaniu
jest opcjonalne, bez migracji i zmian kolejności rozliczania. Wznowienie
niezakończonej areny zaczyna jej pokój od początku; zapis zakończonej areny
zachowuje wynik i idempotentne rozliczenie.

## Szturm i Kradzież rdzenia na dużych arenach

Oba tryby działają na dużych arenach ADR 0011, tak jak Przejęcie. Układy są w danych
pokoju areny (`room.arena`), obok `points`:

- `arena.assault: { sectors: [...] }` — 3–4 sektory w kształcie dawnego `assault.json`:
  `playerSpawn`, `stations` (dokładnie dwie pozycje) i `spawnPoints`. Pozycje mają `y`.
- `arena.heist: { playerSpawn, base, extraction, spawnPoints }`.
- `arena.maxAlive` (do 12) nadpisuje limit żywych wrogów trybu, `arena.spawnRing` włącza
  pierścień posiłków, `arena.navigationClearanceM` wyznacza margines wolnej podłogi.

Pliki trybów dostają `arenas: string[]`. Dotychczasowe `roomId` + `sectors` / `base` /
`extraction` zostają trybem na małym pokoju (`combatCorridor`, `combatRing`).
`assaultForArena` i `heistForArena` (`modeSchema.ts`) łączą definicję trybu z danymi areny.

**Wybór areny** jak w Przejęciu (`selectArena`, wspólne API): bez seeda pierwsza z listy
(Szturm: Zajezdnia Maglev, Kradzież: Terminal kontenerowy), z wpisanym `?seed=` losowanie
przez `Rng(seed).fork('<tryb>-arena')`, debugowy `?arena=<id>` ma pierwszeństwo i
akceptuje id z listy albo dawny `roomId`. Tablica misji nie ma osobnego wyboru areny,
więc z kryjówki Szturm i Kradzież startują na pierwszej arenie z listy, a przy wpisanym
seedzie na wylosowanej. Mały pokój: `?scene=run&mode=assault&arena=combatCorridor&debug=1`
albo `mode=heist&arena=combatRing`.

**Walidacja** (`validateMode`, ładowanie `modes.ts`): pozycje stacji, bazy, ewakuacji, startów
i spawnów mają wolne koło z marginesem nawigacji, strefy się nie nakładają, pula posiłków
(`arena.spawnPoints` lub pokoju) ma co najmniej `tuning.modes.<tryb>.minRingSpawns` różnych
punktów, a `ArenaNavigation.path` istnieje: start → stacje, spawny → stacje, sektor → następny
sektor; w Kradzieży start → baza, baza ↔ ewakuacja, spawny → baza.

**Wrogowie i posiłki.** `RoomScene` buduje `ArenaNavigation` i przekazuje `moveGoal`
przez `navigation.next`: Szturm — obrona najbliższej niezniszczonej stacji, Kradzież — cele z
reguł wyżej (nosiciel niesie rdzeń do bazy, pozostali gonią nosiciela albo rdzeń).
Posiłki wybiera `selectArenaSpawn` jak w Przejęciu: pierścień `arena.spawnRing` wokół gracza,
najpierw punkty zasłonięte geometrią, spośród nich najbliższe stacjom aktywnego sektora
(Szturm) albo rdzeniowi (Kradzież). Pula to spawny sektora lub `heist.spawnPoints` oraz pula
areny. Gracz startuje i odradza się w `playerSpawn` sektora lub Kradzieży (na małym pokoju
`extraction`). Wspólne liczby feel: `tuning.modes.assault` i `tuning.modes.heist`
(`spawnSightHeightM`, `minRingSpawns`, `zoneHeightM`, `carryFootOffsetM`).
Strefy rdzenia (podniesienie, ewakuacja, dotarcie nosiciela do bazy) sprawdzają także
wysokość (`zoneHeightM`), a upuszczony rdzeń na arenie leży na podłodze pod nosicielem.

Nawigacja warstwowa łączy sąsiednie komórki tylko wtedy, gdy nie przecina ich przeszkoda
w połowie odcinka (cienkie bariery na granicy komórek nie przepuszczają już wrogów).

Pozycje i pokrycie: [arenas.md](arenas.md#szturm-i-kradzież-rdzenia-na-dużych-arenach).
Testy: `tests/unit/arenaModes.test.ts`, budżety w `arenaPerf.test.ts`.

## Determinizm i kolejność kroku (wszystkie tryby)

Tryb nie ma własnego `Rng`: używa `ctx.rng` pokoju, czyli `new Rng(seed).fork('room:<nodeId>')`
(`nodeId` = `conquest`, `assault` albo `heist`; losowanie areny Przejęcia jest wcześniejsze i osobne,
patrz wyżej). Ten strumień dzieli z resztą pokoju, więc powtarzalność wymaga stałego kroku `SIM_DT`
i tej samej kolejności zdarzeń. Kolejność w jednym kroku symulacji pokoju (gdy gracz żyje i pokój
nie jest ukończony): 1) dla każdego żywego wroga `moveGoal` (Przejęcie/Szturm: z kontrolera, a przy
nawigacji przez waypoint; Kradzież rdzenia: po `step` kontrolera); 2) `step` kontrolera trybu
(Przejęcie: punkty i pula; Szturm: stacje i front; Kradzież: rdzeń, zegar, odliczanie); 3) próba
spawnu: `spawnPosition` (jedno `rng.pick` albo `selectArenaSpawn`, tylko gdy są kandydaci i spełnione
cooldown, pula, limit żywych); 4) tylko gdy znaleziono punkt: `rng.pick(definition.enemies)` wybiera
archetyp (`assaulter` albo `gunner`), `spawnEnemy`, a przy powodzeniu `spawned()` uruchamia
cooldown `spawnIntervalS` (Przejęcie zwiększa też licznik żywych); 5) przy `outcome === 'victory'`
`room_cleared`. Gdy `spawnEnemy` zawiedzie, losowania i tak zostały zużyte.

Wspólne dla Szturmu i Kradzieży rdzenia: kandydaci spawnu to punkty z danych (sektor frontu /
`spawnPoints`) z wolną podłogą (`spawnClearanceM` 0,8 m), >= `minSpawnDistanceM` (5 m) od gracza i

> = 2·`spawnClearanceM` od żywych wrogów; wybór jedno `rng.pick`. Śmierć gracza w obu trybach
> wywołuje `died()` kontrolera (jedno życie mniej, odrodzenie po `respawnS` = 2 s; w trakcie
> odrodzenia kontroler, zegar i spawn stoją). Odrodzenie resetuje statusy, pociski, moce, ostrze,
> broń (slot 0) i zdrowie/energię/wytrzymałość oraz teleportuje gracza (Szturm: `playerSpawn`
> aktywnego sektora, Kradzież: `playerSpawn` układu areny, na małym pokoju punkt ewakuacji) z kierunkiem patrzenia yaw 0, pitch 0.

## Prezentacja i sprawdzenie

HUD zawiera wszystkie punkty areny, postęp, właściciela lub napis „Sporny” oraz pulę.
Gracz: bursztyn, Koalicja: czerwień, neutralny: grafit. W świecie są kręgi
i litery; sporny punkt ma białą literę i powiększony krąg. Na telefonie HUD
jest pod licznikiem kredytów. `ConquestView` zwalnia geometrię, materiały,
tekstury, DOM i subskrypcję przy wyjściu.

Debug: `conquest capture A`, `conquest tickets 0`, `kill all`,
`query('conquest')` → `{ points, tickets, alive }`. Ręczny test w 30 s:
wejdź na arenę, przejmij A/B/C komendami, wyzeruj pulę i zabij wrogów;
sprawdź nagrodę i powrót do kryjówki. Osobno `hurt 99999` sprawdza porażkę.
W zwykłej grze sprawdź czytelność stref, tempo przejęcia i omijanie filarów
przez posiłki. Areny z `arena.exclusive` albo `spawnRing` korzystają z `ArenaNavigation`
(siatka o boku `navigationCellM`, pola odległości do punktów; bez fizyki, renderu i losowości):
pole odległości do najbliższego celu i widoczne waypointy trafiają do istniejącego
`Enemy.moveGoal`. Gdy któryś blok areny ma `walkable`, siatkę zastępuje nawigacja po powierzchniach
(`ArenaSurfaceNavigation`) z warstwami wysokości i rampami; nie zmienia ona zachowań walki.
Walidacja sprawdza dojście do punktu na jego wysokości, również ze wszystkich spawnów.
Pokoje bez danych areny zachowują lokalne unikanie przeszkód; zwykłe runy nie używają nowej nawigacji.

## Dodanie trybu

Dodaj definicję w `src/data/modes`, wariant `modeIdSchema`, walidację pokoju
i archetypów, kontroler czystej symulacji oraz integrację hosta i widoku.
Udostępnij pozycję tablicy w tekstach PL, debug query i testy reguł, zapisu
oraz pełnej ścieżki. Nowe zasady nagród lub trwały stan wymagają osobnego
kontraktu; nie omijaj `finish()` i istniejącego rozliczania.

## Szturm (S2b-02)

Start: tablica → „Tryby areny” → „Szturm” → „Rozpocznij Szturm” albo
`?scene=run&mode=assault&loadout=classic&debug=1`. Jeden węzeł, trzy kolejne
sektory w `combatCorridor`. Płaska podłoga 16×32 m i wejście od dodatniego Z
dają czytelny kierunek natarcia ku ujemnemu Z. Stacje omijają osłony i ściany;
istniejące przewężenie między sektorami pozostawia przejście środkiem.

Stacje A i B każdego sektora to cele `sabotage` wspólnego `MissionObjectives` (id `A`, `B`;
strefa i promień podniesienia = `radiusM`). Lont i wybuch (`blastRadiusM` 3 m, `blastDamage` 80,
tagi `#hazard`, `#explosion`, `#friendly_fire`, źródło `null`) trafiają gracza i wszystkich
wrogów w zasięgu. Po zniszczeniu pary sektor rośnie, powstają nowe stacje, `noticeS` (3 s)
odlicza komunikat, a licznik spawnu jest zerowany (kolejny wróg pojawia się od razu). Wrogowie
bez gracza w `detectRangeM` (8 m) idą do najbliższej niezniszczonej stacji (XZ).

Wszystkie pozycje poniżej mają Y=0 (podłoga):

| Sektor | Stacja A (X,Z) | Stacja B (X,Z) | Odrodzenie (X,Z) | Posiłki wroga (X,Z) |
| ------ | -------------- | -------------- | ---------------- | ------------------- |
| 1      | −4, 9          | 4, 9           | 0, 12            | −5, 0,5 oraz 5, 0,5 |
| 2      | −4, 1          | 4, 1           | 0, 4             | −5, −9 oraz 5, −9   |
| 3      | −4, −9         | 4, −9          | 0, −4            | −5, −13 oraz 5, −13 |

`src/data/modes/assault.json`: 3 życia łącznie (dwa możliwe odrodzenia),
odrodzenie po 2 s, maksymalnie 6 wrogów, jeden spawn co 3 s, archetypy
`assaulter`/`gunner`. Strefa 1,5 m, podkładanie 3 s, lont 3 s, wybuch 3 m
i 80 obrażeń także dla gracza. Postęp podkładania utrzymuje się poza strefą;
lont działa bez obecności gracza. Wspólne `MissionObjectives` i `MissionView`
zachowują reguły, wybuch, maszt, pasek i krąg sabotażu z misji.

Dopiero obie zniszczone stacje aktywują nową parę i przesuwają punkty spawnu.
Komunikat „Front przesunięty” trwa 3 s. Żywi wrogowie pozostają w pokoju,
a `moveGoal` kieruje ich do najbliższej niezniszczonej stacji. Gracz w promieniu
8 m przywraca zwykłą walkę. Spawn wymaga wolnej podłogi z marginesem 0,8 m,
5 m od gracza i 1,6 m od innych wrogów; brak bezpiecznego punktu odracza spawn.
Walidacja sprawdza też osiągalność, kolejność sektorów, rozdzielenie stref,
odrodzenia i punkty posiłków po stronie końca pokoju względem stacji.

Śmierć odejmuje jedno życie tylko raz. Podczas 2 s oczekiwania symulacja pokoju
(także lonty i wrogowie) czeka, HUD pokazuje odliczanie. Gracz wraca nad podłogę
początku aktywnego sektora z pełnym zdrowiem, energią i wytrzymałością,
wyzerowanymi statusami, mocami i ostrzem; broń wraca do stanu startowego
(slot 0, reset ciepła, przeładowania i stanu strzału), przedmiot w ręku według
loadoutu. Stacje i żywi wrogowie zachowują stan. Brak żyć oznacza porażkę;
śmiertelny wybuch przy ostatnim życiu ma pierwszeństwo przed zwycięstwem.

Ostatnia para kończy arenę przez istniejące `completeRoom()`/`finish()`.
`summary.modeId = 'assault'`, `rewardRooms = 6` przy zwycięstwie, 0 przy porażce.
Brak bonusu kampanii, bez migracji zapisu v4 i bez zmiany kolejności nagród.
Wznowienie niezakończonej areny rozpoczyna ją od pierwszego sektora z nową pulą.

HUD: sektor 1/3, stacje A/B (cała / podkładanie / lont / zniszczona), życia,
odliczanie i komunikat frontu. Bursztyn #ffae1a oznacza gracza i jego postęp,
czerwień #e0262b stacje wroga. Na 390×844 panel jest pod kredytami;
stan jest opisany tekstem, a nie samym kolorem.

Debug: `assault destroy A`, `assault destroy B`, `assault lives 1`,
`query('assault')`. W 30 s: włącz `god`, niszcz obie stacje w każdym sektorze,
sprawdź nowe pary, finał, nagrodę i powrót. Osobno bez `god`: `hurt 99999`
trzy razy, czekając na odrodzenia; sprawdź pełne zdrowie, pozycję i porażkę.
Ręczny feel: podejdź do kręgu, podłóż ładunek, odejdź przed końcem lontu;
oceń tempo natarcia i czy obrońcy nie blokują przejścia.

## Wyzwanie dnia

Jedna próba na lokalny dzień kalendarzowy, bez backendu. Seed runu to data
`RRRR-MM-DD` z `localChallengeDate()` (data jest wstrzykiwana, więc funkcja jest
testowalna); ta sama data daje tę samą mapę. Preset startowy i trudność są w
`src/data/modes/dailyChallenge.json`, teksty w `src/data/ui/challenge.pl.json`.

Próba jest rezerwowana przed startem (`begin`), więc wyjście lub odświeżenie kończy ją
bez wyniku (`null` w historii). Wynik (rezultat, czas, zabici, pokoje) trafia wyłącznie
do rekordu `challenge`; meta-progres, nagrody i zapis zwykłego runu nie są dotykane.
Rekord ma własną wersję `challengeVersion` (patrz `docs/api.md`).

W 30 s: menu główne, "Wyzwanie dnia" (lub `?daily=1`) pokazuje historię i przycisk
startu; `?scene=challenge` startuje próbę bezpośrednio. Drugie wejście tego samego dnia
wraca do historii z zablokowanym startem. Usunięcie klucza `challenge` w IndexedDB
(narzędzia przeglądarki) zeruje historię.
