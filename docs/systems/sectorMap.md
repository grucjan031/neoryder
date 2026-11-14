# Generator mapy sektora — F3-02

`generateSectorMap(def, seed)` w `src/world/sectorMap.ts` jest funkcją czystą:
waliduje definicję przez `loadSector`, nie zmienia wejścia, używa wyłącznie
`new Rng(seed).fork('map')`, nie importuje Three.js ani DOM. Zwraca `SectorMap`
gotową do zapisania w `RunState`. Warstwy mają numery od 1, indeksy węzłów od 0,
id od `L1N1`. Ten sam seed i definicja dają identyczny graf.

## Algorytm

1. Liczba węzłów z `nodesPerLayer`; boss ma jeden węzeł. Pierwsza warstwa to
   walka, przedostatnia odpoczynek, ostatnia boss.
2. Pozycja pozioma to `(index + 0.5) / liczbaWęzłów`. Każdy węzeł dostaje
   najbliższego następnika. Remisy rozstrzyga mniejszy indeks. Brakujące wejścia
   naprawiane są od najbliższego poprzednika, zanim powstaną dodatkowe krawędzie.
   Drugi najbliższy następnik jest dodawany z `extraEdgeChance`, o ile krawędź
   nie przecina istniejącej. Wspólne końce krawędzi są dozwolone.
3. Typy pośrednich warstw są losowane proporcjonalnie do wag. Każda z tych
   warstw wymaga dokładnie jednego pasującego przedziału z dodatnią sumą wag.
   Boss poza ostatnią warstwą jest zabroniony. Wagi zerowe nie są losowane.
4. Typ łamiący `maxPerLayer` lub `maxElitesPerPath` jest zamieniany na `combat`
   w stabilnej kolejności warstw i indeksów. Maksymalna liczba elit propagowana
   jest przez cały graf, więc kontrola uwzględnia także rozgałęzienia i scalenia.
5. Gwarancje liczą węzły w domkniętym przedziale warstw, nie na każdej ścieżce.
   Braki uzupełniane są przez zamianę walk w kolejności id, z nawrotami przy
   naruszeniu limitów. Jeśli losowe typy blokują gwarancje, typy pośrednich
   warstw są resetowane do walk i gwarancje rozwiązywane ponownie. Sprzeczne
   reguły kończą się czytelnym błędem; nie ma nieograniczonego ponawiania seedów.

## Dane i czas

`src/data/sectors/kurogane.json` jest ładowany i walidowany w
`src/world/sectors.ts` jako `kuroganeSector`. Zawiera 8 warstw, 2–4 węzły
(boss: 1), gwarantowany sklep i dwie elity w warstwach 3–6, maksymalnie jedną
elitę/zagadkę na warstwę i dwie elity na ścieżkę. Zagadka ma wagę zero.
Sekcje `threat`, `rewardWeights`, `economy`, `roomPools` uzupełnią kolejne zadania.

Szacowany czas ścieżki to suma `expectedDurationS` jej węzłów: walka 150 s,
elita 210 s, sklep 60 s, odpoczynek 45 s, zagadka 90 s, boss 300 s.
Test enumeruje wszystkie ścieżki na 200 seedach i wymaga 900–1500 s dla
co najmniej 95% ścieżek każdej mapy oraz całej próbki. Rzeczywisty czas i feel
walki pozostają do oceny podczas playtestu bramki F3.

## Sprawdzenie ręczne w 30 sekund

Otwórz `?scene=map-test&seed=sektor-02`. Tekst pokazuje seed, typy i następników
wszystkich węzłów. W konsoli debug wpisz `map`, aby otrzymać ten sam opis.
Odświeżenie zachowuje mapę; zmiana seeda daje nową. Warstwy 1, 7 i 8 mają
odpowiednio walki, odpoczynki i jednego bossa. To scena diagnostyczna;
docelowy wybór ścieżki jest częścią F3-13. `query('map')` zwraca graf.

## Testy

`tests/unit/sectorMap.test.ts`: 200 seedów, deterministyczność, różnorodność,
unikalne id, osiągalność i dojście do bossa, brak przecięć, limity, gwarancje,
czas każdej ścieżki, skrajne wagi, sprzeczne reguły, izolacja RNG i brak
`Math.random`. `tests/unit/mapTest.test.ts`: rejestr sceny, seed URL,
tekst/komenda `map`, usunięcie UI i komendy przy `dispose`.
