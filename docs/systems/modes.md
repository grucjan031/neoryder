# Tryby areny

Przejęcie (S2b-01) uruchamia się z tablicy misji, sekcja „Tryby areny”, albo
`?scene=run&mode=conquest&loadout=classic&debug=1`. Szturm jest drugim aktywnym
trybem; Kradzież rdzenia pozostaje nieaktywna. Tryb wyklucza parametr misji
i nie zmienia kampanii.
Skrót uruchomienia Przejęcia: `?scene=conquest&arena=arenaContainerPort&debug=1`.
Skrót korzysta z tego samego hosta RunScene (debug `sceneId()` zwraca `run`).

## Dane i reguły

`src/data/modes/conquest.json` przechodzi `modeSchema` i walidację geometrii:
trzy różne punkty A/B/C, wolne koła na podłodze, odstęp minimum 12 m,
osiągalność jak w `validateLayout`, znany pokój combat i obsługiwana biała lista
wrogów. Pole `arenas` zawiera kolejno `arenaContainerPort`, `arenaOverpass`,
`arenaRooftops`, `combatRing`.
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

Pula 120, maksymalnie 8 żywych, jeden spawn co 3 s, przejęcie neutralnego
punktu 6 s. Gracz przesuwa postęp ku +1, wróg ku −1, wspólna obecność
zatrzymuje postęp. Właściciel utrzymuje punkt do wyzerowania postępu;
przeciwna strona przejmuje go po dalszych 6 s. Pełne przejęcie emituje
`conquest_captured` i komunikat HUD. Dwa punkty gracza odejmują 1/s,
trzy 3/s, każde zabójstwo 1. Pula nie spada poniżej zera.

Kontroler `Conquest` nie korzysta z DOM ani renderu. Host `RoomScene` podaje
pozycje żywych wrogów, tworzy posiłki i ustawia `Enemy.moveGoal`. Szturmowiec
i strzelec poza promieniem wykrycia 10 m idą do najbliższego obcego punktu;
po wykryciu gracza wracają do zwykłej walki. Wszystkie punkty wroga oznaczają
pozostanie na stanowisku. Bez `moveGoal` AI działa jak przed dodaniem trybu.

Spawn preferuje punkty wroga, następnie spawny konkretnej areny. Stary układ
bez danych areny zachowuje narożniki podłogi odsunięte od krawędzi o 2 m.
Zawsze zachowuje 15 m od gracza, wolny margines 0,8 m i odstęp od
żywych wrogów. Brak bezpiecznego miejsca odracza spawn. Losowanie korzysta
z `Rng`. Wspólne odległości i wysokość strefy są w `tuning.modes.conquest`
(automatycznie widoczne w lil-gui). Wieżyczki nie uczestniczą.

Pula 0 i brak żywych kończą pokój; istniejący `finish()` i ścieżka rozliczania
kończą run. Śmierć gracza oznacza porażkę. `roomsCleared` wynosi 6 przy
zwycięstwie i 0 przy porażce; `summary.modeId = 'conquest'`. Pozostałe składniki
nagród liczy dotychczasowa ekonomia. Opcjonalne `modeId` w stanie i podsumowaniu
zachowuje zapis v4, bez migracji i zmian kolejności rozliczania. Wznowienie
niezakończonej areny zaczyna jej pokój od początku; zapis zakończonej areny
zachowuje wynik i idempotentne rozliczenie.

## Prezentacja i sprawdzenie

HUD zawiera A/B/C, postęp, właściciela lub napis „Sporny” oraz pulę.
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
