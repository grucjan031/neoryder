# Budżet zagrożenia — F3-08

`src/world/threat.ts` eksportuje `planWaves(room, sector, node, rng)` oraz
`roomPlanner` implementujący `RoomPlanner`. Funkcja jest synchroniczna, nie
używa DOM, Three.js ani EventBus: zwraca dane dla istniejącego `WaveDirector`.
Przyjmuje główny RNG runu i tworzy niezależny `rng.fork('room:<nodeId>')`.
Stan nadrzędnego RNG nie wpływa na wynik i nie jest zmieniany.

## Budżet i losowanie

Budżet wynosi `(base[type] + perLayer[type] * (layer - 1)) *
(room.threatMultiplier ?? 1)`. Obsługiwane są combat i elite; boss ma własny
system, pozostałe typy nie planują walki. Brak wymaganej konfiguracji,
nieznany wróg lub brak kosztu powodują błąd.

Liczba fal jest losowana z przedziału `waveCount[type]`. Dodatnie, niemalejące
`waveWeights` są liniowo próbkowane do tej liczby fal (dla dwóch fal
z [1, 1.3, 1.6] otrzymujemy [1, 1.6]), następnie dzielone przez sumę.
Dla jednej fali cały budżet trafia do niej. Niewydana reszta przechodzi
do następnej fali; ostatnia otrzymuje cały pozostały budżet. Wrogowie są
losowani proporcjonalnie do wag puli, wyłącznie spośród odblokowanych
i mieszczących się w bieżącym przydziale. Wynik grupuje identyczne id.

Każda elita rezerwuje dokładnie jednego gwarantowanego Egzekutora w ostatniej
fali, niezależnie od unlockLayer i obecności w puli. Koszt jest odejmowany
przed podziałem budżetu. Po odblokowaniu losowanie może dodać kolejnych
Egzekutorów z puli. Jeśli budżet jest mniejszy niż koszt gwarancji, plan
zawiera wyłącznie tego jednego Egzekutora; to jedyny wyjątek od sufitu budżetu.

Puste fale są usuwane: `wavesSchema` wymaga niepustych grup, a pustej fali
`WaveDirector` nie mógłby zakończyć przez zabójstwo. Liczba wynikowych fal może
więc być mniejsza niż wylosowana, zwłaszcza przy małym budżecie elity.
Pusty plan combat jest błędem konfiguracji. W każdej fali obowiązuje twardy
limit `tuning.arena.maxEnemies`; konfiguracja, której budżetu nie można
wydać do reszty mniejszej niż najtańszy dostępny wróg z powodu limitu,
jest odrzucana. Pula bez odblokowanych wrogów nie pozwala wydawać reszty.

`spawnPoints` i `minSpawnDistance` pochodzą z pokoju (brak odległości oznacza 0).
`maxAlive` to minimum limitu pokoju i `tuning.arena.maxEnemies`; brak limitu
pokoju oznacza twardy sufit. Plan przechodzi `wavesSchema` przed zwróceniem.

## Dane startowe Kurogane Arms

`src/data/sectors/kurogane.json` zawiera następującą sekcję threat:

```json
{
  "base": { "combat": 4, "elite": 8 },
  "perLayer": { "combat": 1.5, "elite": 2 },
  "waveCount": {
    "combat": { "min": 2, "max": 3 },
    "elite": { "min": 2, "max": 3 }
  },
  "pools": {
    "combat": {
      "assaulter": 4,
      "gunner": 3,
      "drone": 2,
      "shielder": 1,
      "sniper": 1
    },
    "elite": {
      "assaulter": 3,
      "gunner": 2,
      "drone": 1,
      "shielder": 3,
      "sniper": 2,
      "executor": 1
    }
  },
  "unlockLayer": { "sniper": 3, "executor": 4 },
  "waveWeights": [1, 1.3, 1.6],
  "pacing": {
    "combat": { "firstBreakS": 2, "breakS": 4, "spawnIntervalS": 0.8 },
    "elite": { "firstBreakS": 2, "breakS": 4, "spawnIntervalS": 0.8 }
  }
}
```

`waveWeights` i `pacing` są opcjonalne. Brak wag daje [1, 1.3, 1.6]; brak
tempa typu lub jego pól daje odpowiednio 2 s, 4 s i 0.8 s. Schemat odrzuca
puste/malejące wagi i niedodatni interwał spawnu. Parametry są balansem danych,
nie wartościami feel w tuning. Koszty w plikach wrogów: assaulter 1, drone 1,
gunner 1.5, shielder 2.5, sniper 2.5, executor 6. To startowe wartości ADR;
przeliczenie po kolejnych pomiarach `npm run balance` wymaga osobnej decyzji
balansowej (TTK samo w sobie nie mierzy presji ostrzału, tarczy i parowania).

## Weryfikacja i integracja

`tests/unit/threat.test.ts` sprawdza 200 seedów, osiem warstw i oba typy walki:
budżet, odblokowania, gwarancję, poprawność schematu i limity fal. Pozostałe
testy obejmują mnożnik pokoju, deterministyczność, normalizację wag, pacing,
domyślne wartości, błędne konfiguracje, kompletność kosztów we wszystkich
plikach wrogów i przejście `WaveDirector` do done.

Integracja RunScene, room-test i podgląd planu pozostają w F3-07 zgodnie
z decyzją zlecającego. Moduł nie dodaje sceny ani testu e2e. Po integracji
playtest powinien sprawdzić tempo narastania presji i czytelność wejścia
Egzekutora w ostatniej fali elity; obecne koszty wymagają oceny człowieka.
