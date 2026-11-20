# Implanty (F3-09)

Implanty to per-runowe ulepszenia zdobywane z nagród po pokojach, w sklepie oraz rozwijane podczas odpoczynku (ADR 0005 pkt 6). Definicje znajdują się w `src/data/implants/*.json` (jeden plik na implant), a walidację, ładowanie i nakładanie modyfikatorów realizują `src/progression/implantSchema.ts` oraz `src/progression/implants.ts`.

## Schemat danych (`ImplantDefinition`)

```json
{
  "id": "overclock",
  "name": "Przetaktowanie rdzenia",
  "description": "Podkręcony koprocesor walki zwiększa obrażenia oraz zdrowie i ładuje energię po udanym parowaniu.",
  "rarity": "rare",
  "tags": ["#melee", "#power", "#gun"],
  "modifiers": [
    { "stat": "damage", "type": "percent", "value": 0.15 },
    { "stat": "maxHealth", "type": "flat", "value": 20 }
  ],
  "triggers": [
    {
      "when": { "event": "parry_success" },
      "effects": [{ "kind": "add_energy", "amount": 8 }],
      "cooldownS": 1.5
    }
  ],
  "upgradesTo": "overclockPlus"
}
```

Reguły walidacji (`implantSchema` i `loadImplantDefinitions`):

- `id` — niepusty identyfikator, unikalny w kolekcji (powtórzenie = błąd ładowania). Konwencja: zgodny z nazwą pliku `<id>.json` — loader tego nie sprawdza.
- `name` (wymagane), `description` (opcjonalne w schemacie, w danych zawsze obecne) — polskie teksty UI w stylistyce cyberpunkowej, bez nazw chronionych z `AGENTS.md`.
- `rarity` — `'common' | 'rare' | 'epic' | 'legendary'`.
- `tags` — tablica tagów zaczynających się od `#` (`#melee`, `#power`, `#gun`, `#elektrycznosc`).
- `modifiers` — modyfikatory statystyk (`stat ∈ STAT_IDS`, `type ∈ 'flat' | 'percent' | 'mult'`, `value` skończone; wartość statu = `max(0, (baza + Σflat) × (1 + Σpercent) × Πmult)`); pole `source` (`implant:<id>`) nadaje `ImplantSystem` przy nakładaniu.
- `triggers` (opcjonalne) — wyzwalacze `{ when, effects (≥ 1), cooldownS? > 0 }` oparte o te same schematy `whenSchema` i `effectSchema` co `SynergySystem` (`heal`, `explode`, `apply_status_area`, `add_energy`, `cool_weapon`, `stat_modifier_timed`, `chain_on_hit`). Reguły: `heal`, `explode` i `apply_status_area` wymagają `cooldownS`; `at: 'target'` tylko przy `enemy_killed`/`damage_dealt`; `tagsAny`/`targetStatus` tylko przy tych dwóch zdarzeniach; `chain_on_hit` tylko przy `damage_dealt`; `targetIsUser` tylko przy `damage_dealt`. Odnowienie jest per wyzwalacz, startuje tylko gdy choć jeden efekt zadziałał (patrz `synergies.md`).
- `upgradesTo` (opcjonalne) — id implantu o **dokładnie jedną rzadkość wyżej** (`common → rare → epic → legendary`). Implant o rzadkości `legendary` nie może mieć `upgradesTo`, implant nie może wskazywać sam na siebie, a cel musi istnieć w zestawie danych i mieć rzadkość `nextRarity(rarity)`.

## `ImplantSystem` i nakładanie na `Stats`

```ts
const system = new ImplantSystem([playerStats, controllerStats], {
  health,
  bus,
  definitions: implantDefinitions,
});
```

- **Dwie instancje `Stats`:** w pokoju (`RoomScene`) statystyki walki (`maxHealth`, `damage`, `attackSpeed`, `maxEnergy`, `energyRegen`, `heatCapacity`, `coolingRate`, `damageTaken`) żyją w `playerStats`, a statystyki ruchu (`moveSpeed`, `dashCooldown`) w `PlayerController.stats`. `ImplantSystem` nakłada i zdejmuje modyfikatory ze źródłem `implant:<id>` na wszystkie przekazane instancje `Stats`.
- **Unikalność:** ten sam implant nie może wystąpić dwa razy w runie — `add(id)` zwraca `false` dla duplikatu, nie podwaja modyfikatorów i nie emituje zdarzenia. Nieznany id w `add`/`set` to błąd. `add(id, source = 'reward')` emituje `implant_acquired { id, rarity, source }`.
- **Pozostałe operacje:** `remove(id)` (false, gdy nie założony), `clear()`/`reset()` (zdejmują wszystko), `set(ids, { adjustHealth = true, emit = false, source = 'reward' })` (usuwa duplikaty z wejścia, zdejmuje stare i nakłada nowe modyfikatory; `implant_acquired` tylko dla id nieposiadanych wcześniej i tylko przy `emit`; zwraca `tags()`), `has`, `get`, `ids()`, `list()` (kolejność nabycia), `canUpgrade`, `upgradeTarget`. Callback `onChange` jest wołany po każdej zmianie zestawu.
- **Korekta `maxHealth`:** gdy nałożenie (`add`, `set`) lub ulepszenie (`upgrade`) implantu zwiększa `maxHealth` (zarówno `flat`, jak i `percent`), `ImplantSystem` dodaje dodatnią różnicę `nextMax - prevMax` do bieżącego zdrowia `Health` (o ile gracz żyje). Zdjęcie implantu zmniejszającego `maxHealth` przycina bieżące zdrowie do nowego maksimum (`min(bieżące, nowe max)`; to samo dotyczy każdego spadku maksimum). Maksimum jest czytane z pierwszej instancji `Stats`, której `maxHealth > 0`. Dodatnia korekta nie działa na martwego gracza (`dead` lub zdrowie ≤ 0) i nie przekracza nowego maksimum.
- **Ulepszenie (`upgrade(id)`):** zastępuje posiadany implant jego docelowym `upgradesTo` na tej samej pozycji listy, wymienia modyfikatory na `Stats`, dodaje tylko różnicę `maxHealth`, pilnuje unikalności (`upgrade` zwraca `false`, jeśli implant nie jest założony, nie ma `upgradesTo` albo cel jest już posiadany; niespójne dane — brak celu lub zła rzadkość — rzucają błąd) i emituje `implant_acquired` ze źródłem `'upgrade'`. Gdy w runie działa `RunManager`, przed `implantSystem.upgrade(id)` należy wywołać `runManager.upgradeImplant(id, targetId)`.
- **Tagi i wyzwalacze:** `tags()` zwraca płaską tablicę tagów wszystkich założonych implantów (z zachowaniem krotności wystąpień dla progów `requiresCount` w `SynergySystem`), a `triggers()` zwraca listę wyzwalaczy aktywnych implantów.

## Pula implantów (24 definicje, 6 łańcuchów ulepszeń)

| Łańcuch (common → rare → epic → legendary)                                                | Tagi                       | Główne modyfikatory                                 | Wyzwalacz (epic / legendary / rare)                                                                  |
| ----------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `servoTendons` → `servoTendonsRare` → `servoTendonsEpic` → `servoTendonsApex`             | `#melee`                   | `attackSpeed`, `moveSpeed`, `dashCooldown`          | `dash_used` → czasowy bonus `attackSpeed` (+ energia na `legendary`)                                 |
| `subdermalWeave` → `subdermalWeaveRare` → `subdermalWeaveEpic` → `subdermalWeaveApex`     | `#melee`                   | `maxHealth`, `damage`, `damageTaken`                | `enemy_killed` (`#melee`) → `add_energy` (+ czasowy `moveSpeed` na `legendary`)                      |
| `cortexCapacitor` → `cortexCapacitorRare` → `cortexCapacitorEpic` → `cortexCapacitorApex` | `#power`                   | `maxEnergy`, `energyRegen`, `damage`                | `power_used` → `cool_weapon` (+ czasowy `damage` na `legendary`)                                     |
| `stormSynapse` → `stormSynapseRare` → `stormSynapseEpic` → `stormSynapseApex`             | `#power`, `#elektrycznosc` | `energyRegen`, `maxEnergy`, `moveSpeed`             | `projectile_reflected` → `add_energy` (`rare`); `damage_dealt` → `chain_on_hit` (`epic`/`legendary`) |
| `cryoVents` → `cryoVentsRare` → `cryoVentsEpic` → `cryoVentsApex`                         | `#gun`                     | `heatCapacity`, `coolingRate`, `damage`             | `enemy_killed` (`#gun`) → `cool_weapon` (+ `add_energy` na `legendary`)                              |
| `corePrimer` → `overclock` → `overclockPlus` → `overclockApex`                            | `#melee`, `#power`, `#gun` | `damage`, `maxHealth`, `coolingRate`, `energyRegen` | `parry_success` → `add_energy` (+ `cool_weapon` na `epic`/`legendary`)                               |

## Z4 — 10 nowych rodzin (20 definicji)

Każda nowa rodzina ma wariant `rare` i ulepszenie `epic` (`Plus`). Implanty
przeklęte mają tag `#cursed`, dodatni bonus oraz stałą wadę: obniżone zdrowie
lub zwiększone `damageTaken`. Opis zaczyna się od „Przeklęty:” i ujawnia wadę.
Ulepszenie wzmacnia bonus i może łagodzić wadę, ale nigdy jej nie usuwa.
Wszystkie liczby pozostają w JSON; nowe efekty wymagają `cooldownS`.

| Rodzina (rare → epic)                     | Tagi                                  | Wyzwalacz                                     | Efekty: rare → epic                                                                |
| ----------------------------------------- | ------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `nanoBloodstream` → `nanoBloodstreamPlus` | `#melee`                              | {"event":"enemy_killed","tagsAny":["#melee"]} | leczenie 6 → 8; CD 1 → 0,8 s                                                       |
| `thermalFuse` → `thermalFusePlus`         | `#gun`                                | {"event":"enemy_killed","tagsAny":["#gun"]}   | wybuch 16 → 21, promień 2,5 → 3 m, odrzut 2 → 2,5; burning 2 → 2,5 s; CD 3 → 2,5 s |
| `recoilCapacitor` → `recoilCapacitorPlus` | `#melee`, `#elektrycznosc`            | {"event":"dash_used"}                         | wybuch 6 → 8, promień 2,5 → 3 m, odrzut 8 → 10; CD 2 → 1,6 s                       |
| `reactiveArmor` → `reactiveArmorPlus`     | `#melee`, `#elektrycznosc`            | {"event":"damage_dealt","targetIsUser":true}  | wybuch 10 → 13, promień 3 → 3,5 m, odrzut 14 → 18; CD 8 → 6,5 s                    |
| `parrySpark` → `parrySparkPlus`           | `#melee`, `#power`, `#elektrycznosc`  | {"event":"parry_success"}                     | overload 3 → 4 s, promień 3 → 3,5 m; energia 6 → 8; CD 3 → 2,5 s                   |
| `emberEdge` → `emberEdgePlus`             | `#melee`                              | {"event":"damage_dealt","tagsAny":["#melee"]} | burning 2 → 3 s tylko na celu; CD 1,5 → 1,2 s                                      |
| `resonanceLoop` → `resonanceLoopPlus`     | `#power`                              | {"event":"power_used"}                        | leczenie 4 → 6; damage +12% przez 3 s → +16% przez 4 s; CD 4 → 3,5 s               |
| `mirrorCoil` → `mirrorCoilPlus`           | `#gun`, `#power`, `#elektrycznosc`    | {"event":"projectile_reflected"}              | chłodzenie 12 → 16; energia 5 → 7; CD 1 → 0,8 s                                    |
| `glassCore` → `glassCorePlus`             | `#melee`, `#gun`, `#power`, `#cursed` | stałe modyfikatory                            | damage +35% → +45%; maxHealth −25% → −20%                                          |
| `overdriveHeart` → `overdriveHeartPlus`   | `#melee`, `#power`, `#cursed`         | stałe modyfikatory                            | moveSpeed +15% → +20%; energyRegen +25% → +35%; damageTaken +20% → +15%            |

`resonanceLoop` korzysta z `stat_modifier_timed`. Pokój i arena przekazują
`[playerStats, player.stats]`, więc czasowe modyfikatory trafiają do obu obiektów
`Stats` (walka i ruch). `DamageSystem` odczytuje `playerStats.damage` przez
mnożnik `outgoing`; wyjątki to `#hazard`, `#status` i `#derived`. Bonusy
`resonanceLoop` i `glassCore` wpływają na trafienia. Łańcuch używa `#derived`,
ponieważ bazuje na już zadanych obrażeniach; wybuch z danych nadal się skaluje.
W pokoju i arenie podpięto `heal` (z emisją `health_changed`), `userPosition`
i `applyStatus` (zwraca wynik `StatusSystem.apply`).

## Integracja z `RoomScene` i sprawdzenie w 30 sekund

`RoomScene` domyślnie korzysta z `implantDefinitions` (z możliwością nadpisania przez `options.implantDefinitions` w testach) i przekazuje tagi z `ImplantSystem.tags()` do `SynergySystem`.

Sprawdzenie ręczne (`?scene=room-test&debug=1`):

1. Otwórz konsolę debug i sprawdź początkowe zdrowie: `__neoryder.query('playerHp')` (100).
2. Wykonaj komendę `implant subdermalWeave` — w konsoli pojawi się potwierdzenie, a `__neoryder.query('playerHp')` oraz `__neoryder.query('playerMaxHp')` wzrosną do `120`.
3. Wykonaj `implant overclock` — zdrowie wzrośnie do `140`, a `__neoryder.query('implants')` zwróci `['subdermalWeave', 'overclock']`.
