# Tryby areny

Przejęcie (S2b-01) uruchamia się z tablicy misji, sekcja „Tryby areny”, albo
`?scene=run&mode=conquest&loadout=classic&debug=1`. Szturm i Kradzież rdzenia
są nieaktywne. Tryb wyklucza parametr misji i nie zmienia kampanii.

## Dane i reguły

`src/data/modes/conquest.json` przechodzi `modeSchema` i walidację geometrii:
trzy różne punkty A/B/C, wolne koła na podłodze, odstęp minimum 12 m,
osiągalność jak w `validateLayout`, znany pokój combat i obsługiwana biała lista
wrogów. `combatRing` ma podłogę 28×28 m, bez przenośnych skrzyń. Punkty:
A (−10, 0, −9), B (10, 0, −9), C (0, 0, 9); promienie 2 m. Odległości
20 m i około 20,59 m. Strefy omijają filary i osłony.

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

Spawn preferuje punkty wroga, następnie narożniki podłogi odsunięte od krawędzi
o 2 m. Zawsze zachowuje 15 m od gracza, wolny margines 0,8 m i odstęp od
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
przez posiłki (lokalne unikanie przeszkód, bez nowego pathfindingu).

## Dodanie trybu

Dodaj definicję w `src/data/modes`, wariant `modeIdSchema`, walidację pokoju
i archetypów, kontroler czystej symulacji oraz integrację hosta i widoku.
Udostępnij pozycję tablicy w tekstach PL, debug query i testy reguł, zapisu
oraz pełnej ścieżki. Nowe zasady nagród lub trwały stan wymagają osobnego
kontraktu; nie omijaj `finish()` i istniejącego rozliczania.
