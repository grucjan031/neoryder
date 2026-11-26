# Generator mapy sektora — F3-02

`generateSectorMap(def, seed)` w `src/world/sectorMap.ts` jest funkcją czystą:
waliduje definicję przez `loadSector`, nie zmienia wejścia, używa wyłącznie
`new Rng(seed).fork('map')`, nie importuje Three.js ani DOM. Zwraca `SectorMap`
gotową do zapisania w `RunState`. Warstwy mają numery od 1, indeksy węzłów od 0,
id od `L1N1`. Ten sam seed i definicja dają identyczny graf.

Opcjonalne pole sektora `eliteGuarantee` wskazuje wroga w ostatniej fali węzła
`elite`. Kurogane korzysta z wartości domyślnej `executor`. Koszt jednostki
uwzględnia [planer fal](threat.md#budżet-i-losowanie).

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

## Kolejność losowań `Rng` (determinizm)

Jeden strumień `rng = new Rng(seed).fork('map')`, zużywany w tej kolejności:

1. Dla warstw 1…`layers−1` po kolei jedno `rng.int(nodesPerLayer.min, max)`
   (warstwa ostatnia = boss, 1 węzeł, bez losowania).
2. Dla każdej pary kolejnych warstw (od pierwszej): dla każdego węzła `from` w
   kolejności indeksów, **tylko jeśli** istnieje drugi najbliższy następnik,
   jedno `rng.chance(extraEdgeChance)` (`rng.next() < p`); przy braku drugiego
   następnika losowanie nie następuje. Odległość do następnika to
   `|(from.index+0,5)·nextCount − (to.index+0,5)·currentCount|`, remis → mniejszy
   indeks. Krawędź dodatkowa jest pomijana, jeśli przecina istniejącą
   (`(Δindex_from)·(Δindex_to) < 0`). Listy `next` sortowane wg indeksów następników.
3. Typy: dla każdego węzła zmiennego (warstwy 2…`layers−2`, w kolejności warstw i
   indeksów) jedno `rng.float(0, sumaWag)`; typ wybierany przez odejmowanie wag w
   kolejności `NODE_TYPES` = `combat, elite, shop, rest, puzzle, boss`. Zaraz po
   przypisaniu, gdy graf narusza `limits`, węzeł wraca do `combat` (bez
   losowania). Gwarancje nie losują.

Warstwa 1 jest zawsze walką (wagi `fromLayer 1` dla niej nie działają; dla warstwy 2
działa wpis obejmujący 2), `layers−1` to odpoczynek, `layers` boss.

### Mapa misji (`generateMissionMap`)

`new Rng(seed).fork('mission-map')`; warstwy 1…`mission.layers`. Warstwa z
`fixedNodes[].layer` ma jeden węzeł o typie z danych i polem `fixed
{roomId, objectives, final?}` (bez losowania). Pozostałe: `rng.int(nodesPerLayer)`
węzłów sektora, potem dla każdego węzła `rng.float(0, suma)` po typach o wadze >0
(wagi `mission.typeWeights ?? sector.typeWeights`, wymagany dokładnie jeden wpis
na warstwę; kolejność `NODE_TYPES`). Krawędzie jak wyżej, po zbudowaniu wszystkich
warstw (cała pętla losowań liczby węzłów i typów poprzedza `chance` krawędzi).
Nie obowiązują limity, gwarancje, odpoczynek przed bossem ani boss na końcu —
chyba że wynikają z `fixedNodes`. `RunScene` wywołuje to dla runów z `missionId`
(seed runu), inaczej `generateSectorMap`.

## Dane i czas

`src/data/sectors/kurogane.json` jest ładowany i walidowany w
`src/world/sectors.ts` jako `kuroganeSector`. Zawiera 8 warstw, 2–4 węzły
(boss: 1), gwarantowany sklep i dwie elity w warstwach 3–6, maksymalnie jedną
elitę/zagadkę na warstwę i dwie elity na ścieżkę.
Wagi typów: warstwy 1–2 `combat` 1; warstwy 3–6 `combat` 7, `elite` 3, `shop` 1,
`rest` 0, `puzzle` 0,08. `extraEdgeChance` wynosi 0,3. Sekcje `threat` ([threat.md](threat.md)),
`rewardWeights`, `economy` (`creditsPerThreat` 5, `eliteBonusCredits` 30, ceny sklepu
40/75/120/180, leczenie 35 kr za 30% HP, `restHealFraction` 0,4, `puzzleCredits` 60)
i `roomPools` ([rooms.md](rooms.md)) są wypełnione w tym samym pliku.

Szacowany czas ścieżki to suma `expectedDurationS` jej węzłów: walka 150 s,
elita 210 s, sklep 60 s, odpoczynek 45 s, zagadka 90 s, boss 300 s.
Test enumeruje wszystkie ścieżki na 200 seedach i wymaga 900–1500 s dla
co najmniej 95% ścieżek każdej mapy oraz całej próbki. Rzeczywisty czas i feel
walki pozostają do oceny podczas playtestu bramki F3.

## Sprawdzenie ręczne w 30 sekund

Otwórz `?scene=map-test&seed=sektor-02` (bez `seed` domyślnie `map-test`). Tekst pokazuje seed, typy i następników
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
