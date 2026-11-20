# Budżet zagrożenia — F3-08

`src/world/threat.ts` eksportuje `planWaves(room, sector, node, rng)` oraz
`roomPlanner` implementujący `RoomPlanner`. Funkcja jest synchroniczna, nie
używa DOM, Three.js ani EventBus: zwraca dane dla istniejącego `WaveDirector`.
Przyjmuje główny RNG runu i tworzy niezależny `rng.fork('room:<nodeId>')`.
Stan nadrzędnego RNG nie wpływa na wynik i nie jest zmieniany: `Rng.fork(label)`
tworzy `new Rng(hashSeed("<ziarno liczbowe rodzica>:<label>"))`, więc zależy tylko od
ziarna rodzica i etykiety, nie od liczby wcześniejszych losowań.

Kolejność losowań z `fork('room:<nodeId>')` (zmiana kolejności zmienia wynik dla tego samego seeda):

1. `int(waveCount.min, waveCount.max)` — liczba fal;
2. dla każdej fali po kolei, w pętli „kup wroga”: jedno `next()` na wybranego wroga
   (próg = `next() × suma wag affordable`; wagi sumowane w kolejności wpisów puli w JSON,
   wybierany pierwszy wpis, przy którym suma przekroczy próg, domyślnie ostatni).
   Wybrani wrogowie trafiają do `Map` grupy w kolejności pierwszego wystąpienia (gwarantowany
   Egzekutor jest pierwszy w ostatniej fali), a liczba w grupie rośnie przy kolejnych trafieniach.
   Sama funkcja nie ma innych losowań (kolejność i punkty spawnu losuje później `WaveDirector`, patrz niżej).

## Budżet i losowanie

Budżet wynosi `(base[type] + perLayer[type] * (layer - 1)) *
(room.threatMultiplier ?? 1) * budgetMult` (bez zaokrąglania; `budgetMult` z Poziomu
zagrożenia, patrz niżej). `layer` musi być dodatnią liczbą całkowitą. Obsługiwane są combat i elite;
boss ma własny system, pozostałe typy nie planują walki (`RunScene` dla pozostałych typów węzłów, np. misji, wywołuje planner z węzłem przepisanym na `combat`;
sklepy, odpoczynek, pokoje bossa i tryby (`state.modeId`) nie używają planera — dostają pusty plan,
patrz `runScene.md`). Gdy misja ma listę `enemies`, `RunScene` filtruje pule `combat` i `elite` sektora
do tych id i zeruje `unlockLayer` (odblokowania nie obowiązują). Brak wymaganej konfiguracji,
nieznany wróg lub brak kosztu powodują błąd.

Liczba fal jest losowana z przedziału `waveCount[type]`. Dodatnie, niemalejące
`waveWeights` są liniowo próbkowane do tej liczby fal (dla dwóch fal
z [1, 1.3, 1.6] otrzymujemy [1, 1.6]), następnie dzielone przez sumę.
Dla jednej fali cały budżet trafia do niej. Przydział fali `i` (poza ostatnią) to
`min(pozostały budżet, reszta z poprzedniej fali + (budżet do podziału × waga[i] / suma wag))`,
gdzie budżet do podziału to budżet minus koszt gwarantowanego Egzekutora. Niewydana reszta
przechodzi do następnej fali; ostatnia otrzymuje cały pozostały budżet. Wrogowie są
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
      "sniper": 1,
      "turret": 1,
      "hacker": 1
    },
    "elite": {
      "assaulter": 3,
      "gunner": 2,
      "drone": 1,
      "shielder": 3,
      "sniper": 2,
      "executor": 1,
      "turret": 2,
      "hacker": 1
    }
  },
  "unlockLayer": { "sniper": 3, "executor": 4, "turret": 4 },
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
gunner 1.5, shielder 2.5, sniper 2.5, hacker 2.5, turret 3, executor 6. To startowe wartości ADR;
przeliczenie po kolejnych pomiarach `npm run balance` wymaga osobnej decyzji
balansowej (TTK samo w sobie nie mierzy presji ostrzału, tarczy i parowania).

## Weryfikacja i integracja

`tests/unit/threat.test.ts` sprawdza 200 seedów, osiem warstw i oba typy walki:
budżet, odblokowania, gwarancję, poprawność schematu i limity fal. Pozostałe
testy obejmują mnożnik pokoju, deterministyczność, normalizację wag, pacing,
domyślne wartości, błędne konfiguracje, kompletność kosztów we wszystkich
plikach wrogów i przejście `WaveDirector` do done.

Integracja: `RunScene` (`src/scenes/run.ts`) wywołuje `planWaves` ze `state.threatLevel`
i przekazuje plan do `RoomScene`; `room-test` używa statycznych fal z `src/data/waves/roomTest.json`.
Playtest powinien sprawdzić tempo narastania presji i czytelność wejścia
Egzekutora w ostatniej fali elity; obecne koszty wymagają oceny człowieka.

## WaveDirector — odtwarzanie planu

`WaveDirector` (`src/world/waves.ts`) konsumuje `WavesDefinition` (plan z `planWaves` lub plik
`src/data/waves/*.json`). Strumień Rng: `RoomScene` i `Arena` podają `ctx.rng.fork('waves')`
(arena przy restarcie `start(1, ctx.rng.fork('waves'))`), posiłki `fork('reinforcement:<klucz>')`.
Fazy: `stopped` → `break` (`firstBreakS`) → `spawning` → `fighting` → `break` (`breakS`) → … → `done`.
Początek fali: zdarzenie `wave_started { wave, count }`, kolejka = grupy rozwinięte do pojedynczych
wrogów (liczność `max(1, round(count × difficulty.count))`), potem **`rng.shuffle(queue)`** (Fisher–Yates od końca,
`int(0, i)`). Spawn: gdy licznik `spawnIntervalS` ≤ 0, kolejka niepusta i żywych < `max(1, round(maxAlive × difficulty.maxAlive))`:
`rng.pick` punktu spawnu spośród punktów oddalonych od gracza o ≥ `minSpawnDistance` (gdy żaden nie spełnia — spośród wszystkich;
`y = 0`), `spawn(enemy, punkt)`, zwrot `null` (limit ciał) przerywa próbę do następnego kroku. Fala kończy się, gdy kolejka pusta
i zginął ostatni żywy z fali: `wave_last_kill { wave, id }`, `wave_cleared { wave }`, po ostatniej fali faza `done`.
Poziom trudności zamraża się przy `start()` (parametr `difficulty` albo `combatDifficulty(bus)`).

## Poziom zagrożenia (F4-05)

Poziom zagrożenia (0–10, `RunState.threatLevel`, dane `src/data/meta/threat.json`, tabela w [balance.md](../balance.md)) działa na dwa sposoby, oba przez dane:

1. **Budżet fal.** `planWaves(room, sector, node, rng, threatLevel = 0)` mnoży budżet przez `budgetMult` poziomu: `(base + perLayer * (layer - 1)) * (room.threatMultiplier ?? 1) * budgetMult`. Zaokrąglanie bez zmian względem F3; poziom 0 (mnożnik 1) daje plan identyczny jak dotąd. `RoomPlanner.planWaves` ma opcjonalny 5. parametr; `RunScene` przekazuje `state.threatLevel`.
2. **Statystyki wrogów.** `threatModifiers(level)` zwraca `StatModifier[]` ze źródłem `threat:<poziom>`: `maxHealth` (`percent` = `enemyHealth`) i `damage` (`percent` = `enemyDamage`); dla poziomu 0 pustą tablicę. `EnemyManager.setSpawnModifiers(mods)` ustawia je dla każdego nowo spawnowanego wroga (także pomocników i bossa); trafiają do `EnemyDependencies.spawnModifiers` i są dodawane do `Stats` w konstruktorze wroga, przed utworzeniem `Health`, więc wróg startuje z pełnym, powiększonym HP, a `boss_spawned.maxHealth` jest poprawne.

`threatLevelDef(level)` zwraca definicję z danych i rzuca błąd dla nieznanego poziomu.

Scena: `?scene=room-test&threat=<n>` (syntetyczny `RunState.threatLevel`). `RoomScene` wywołuje `setSpawnModifiers(threatModifiers(run.threatLevel))` zaraz po utworzeniu `EnemyManager`.

### Tabela poziomów 0–10

Wartości pochodzą z `src/data/meta/threat.json` (źródło prawdy; strojenie wyłącznie w danych). Poziom 0 jest neutralny. Wzrosty zdrowia i obrażeń to modyfikatory `percent` źródła `threat:<poziom>`; budżet fal mnoży budżet z `planWaves`.

| Poziom | Nazwa                | Zdrowie wrogów | Obrażenia wrogów | Budżet fal | Nagrody | Rdzenie za zwycięstwo |
| ------ | -------------------- | -------------- | ---------------- | ---------- | ------- | --------------------- |
| 0      | Rutyna               | —              | —                | ×1         | ×1      | 0                     |
| 1      | Podwyższona czujność | +10%           | +5%              | ×1.1       | ×1.15   | 1                     |
| 2      | Alarm                | +20%           | +10%             | ×1.2       | ×1.3    | 1                     |
| 3      | Wzmocniony patrol    | +30%           | +15%             | ×1.3       | ×1.45   | 1                     |
| 4      | Obława               | +40%           | +20%             | ×1.4       | ×1.6    | 2                     |
| 5      | Stan wyjątkowy       | +50%           | +25%             | ×1.5       | ×1.75   | 2                     |
| 6      | Blokada dzielnicy    | +60%           | +30%             | ×1.6       | ×1.9    | 2                     |
| 7      | Pełna mobilizacja    | +70%           | +35%             | ×1.7       | ×2.05   | 3                     |
| 8      | Nocna czystka        | +80%           | +40%             | ×1.8       | ×2.2    | 3                     |
| 9      | Zero tolerancji      | +90%           | +45%             | ×1.9       | ×2.35   | 3                     |
| 10     | Totalna blokada      | +100%          | +50%             | ×2         | ×2.5    | 4                     |

Strojenie tabeli to zadanie 11 (symulacja balansu meta). Uwaga: `docs/balance.md` jest generowany przez `npm run balance` i sprawdzany testem, dlatego tabela leży tutaj.
