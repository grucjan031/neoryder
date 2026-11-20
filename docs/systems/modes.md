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

Rdzeń ma stany `base`, `player`, `dropped`, `enemy`. Wróg dotykający
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
wrogów. Pole `arenas` zawiera kolejno `arenaContainerPort`, `arenaOverpass`,
`arenaRooftops`. `combatRing` pozostaje pokojem zwykłego runu.
Punkty są w `room.arena.points`, spawny w pokoju lub opcjonalnym
`room.arena.spawnPoints`. Stary format `roomId` + `points` nadal jest odczytywany.
Port ma 100×100 m, pogodę storm i punkty A (−32, 0, −28), B (32, 0, −23),
C (0, 0, 33), każdy o promieniu 4 m. Zachowany combatRing ma punkty
A (−10, 0, −9), B (10, 0, −9), C (0, 0, 0), promienie 2,75 / 2,75 / 3,5 m.
Spawny trybu są walidowane poza strefami z marginesem; zwykłe spawny combatRing
nie są zmieniane. Szczegóły: [arenas.md](arenas.md), [weather.md](weather.md).

Estakada (100×100 m, `smog`): A (−12, 0, −12), B (−12, 11,6, 12),
C (32, 0, 10). Targ (90×90 m, `drizzleWind`): A (−28, 0, 0),
B (28, 2, −24), C (28, 6, 24). Promienie 4 m. Wyższe punkty mają
rzeczywiste dojścia rampami dla gracza i obu archetypów przeciwników.

Bez wpisanego seeda start z tablicy i bezpośredniego URL wybiera pierwszą arenę
(port), a run nadal dostaje losowy seed. Wpisany `?seed=` wybiera arenę przez
osobny strumień `Rng(seed).fork('conquest-arena')`. Debugowy `?arena=<id>` ma
pierwszeństwo i akceptuje tylko id z listy; poza debug jest ignorowany.
Wybrany id jest zapisany w istniejącym `MapNode.fixed.roomId`, więc wznowienie
nie losuje areny ponownie i zachowuje stare zapisy combatRing.

Domyślna pula to 120, a domyślny limit to 8 żywych. Arena może ustawić
`arena.enemyTickets` oraz `arena.maxAlive` (maksymalnie 12 i nie więcej
niż limit pokoju, jeśli pokój go podaje). Jeden spawn co 3 s, przejęcie neutralnego
punktu 6 s. Gracz przesuwa postęp ku +1, wróg ku −1, wspólna obecność
zatrzymuje postęp. Właściciel utrzymuje punkt do wyzerowania postępu;
przeciwna strona przejmuje go po dalszych 6 s. Pełne przejęcie emituje
`conquest_captured` i komunikat HUD. Ubytek zaczyna się od ścisłej większości
i rośnie liniowo do pełnego posiadania. Stawki z danych trybu to 1/s przy
większości i 3/s przy wszystkich punktach. Przy pięciu punktach cztery pod
kontrolą gracza odejmują 2/s. Każde zabójstwo odejmuje 1. Pula nie spada poniżej zera.

Kontroler `Conquest` nie korzysta z DOM ani renderu. Host `RoomScene` podaje
pozycje żywych wrogów, tworzy posiłki i ustawia `Enemy.moveGoal`. Szturmowiec
i strzelec poza promieniem wykrycia 10 m idą do najbliższego obcego punktu;
po wykryciu gracza wracają do zwykłej walki. Wszystkie punkty wroga oznaczają
pozostanie na stanowisku. Bez `moveGoal` AI działa jak przed dodaniem trybu.

Bez `spawnRing` spawn preferuje punkty wroga, następnie spawny konkretnej areny. Stary układ
bez danych areny zachowuje narożniki podłogi odsunięte od krawędzi o 2 m.
Zawsze zachowuje 15 m od gracza, wolny margines 0,8 m i odstęp od
żywych wrogów. Brak bezpiecznego miejsca odracza spawn. Losowanie korzysta
z `Rng`. Wspólne odległości i wysokość strefy są w `tuning.modes.conquest`
(automatycznie widoczne w lil-gui). Dla aren z `spawnRing` kolejność wyboru
opisuje [Silnik dużych map](arenas.md#silnik-dużych-map). Wieżyczki nie uczestniczą.

Pula 0 i brak żywych kończą pokój; istniejący `finish()` i ścieżka rozliczania
kończą run. Śmierć gracza oznacza porażkę. `roomsCleared` wynosi 6 przy
zwycięstwie i 0 przy porażce; `summary.modeId = 'conquest'`. Pozostałe składniki
nagród liczy dotychczasowa ekonomia. Opcjonalne `modeId` w stanie i podsumowaniu
zachowuje zapis v4, bez migracji i zmian kolejności rozliczania. Wznowienie
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
przez posiłki. Port korzysta z naziemnej siatki `ArenaNavigation`: pola odległości
do A/B/C i widoczne waypointy trafiają do istniejącego `Enemy.moveGoal`.
W porcie punkty są na gruncie, a wyższe trasy są skrótami dla gracza.
Estakada i targ oznaczają powierzchnie `walkable`; warstwy wysokości i rampy
rozszerzają tę samą nawigację, bez zmian zachowań walki. Walidacja sprawdza
dojście do punktu na jego wysokości, również ze wszystkich spawnów.
CombatRing zachowuje
lokalne unikanie przeszkód; zwykłe runy nie korzystają z nowej nawigacji.

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
