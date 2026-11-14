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

- `id` — niepusty identyfikator zgodny z nazwą pliku `<id>.json`, unikalny w kolekcji.
- `name`, `description` — polskie teksty UI w stylistyce cyberpunkowej, bez nazw chronionych z `AGENTS.md`.
- `rarity` — `'common' | 'rare' | 'epic' | 'legendary'`.
- `tags` — tablica tagów zaczynających się od `#` (`#melee`, `#power`, `#gun`, `#elektrycznosc`).
- `modifiers` — modyfikatory statystyk (`stat ∈ STAT_IDS`, `type ∈ 'flat' | 'percent' | 'mult'`, `value` skończone); pole `source` (`implant:<id>`) nadaje `ImplantSystem` przy nakładaniu.
- `triggers` (opcjonalne) — wyzwalacze oparte o te same schematy `whenSchema` i `effectSchema` co `SynergySystem` (`add_energy`, `cool_weapon`, `stat_modifier_timed`, `chain_on_hit`).
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
- **Unikalność:** ten sam implant nie może wystąpić dwa razy w runie — `add(id)` zwraca `false` dla duplikatu, nie podwaja modyfikatorów i nie emituje zdarzenia.
- **Korekta `maxHealth`:** gdy nałożenie (`add`, `set`) lub ulepszenie (`upgrade`) implantu zwiększa `maxHealth` (zarówno `flat`, jak i `percent`), `ImplantSystem` dodaje dodatnią różnicę `nextMax - prevMax` do bieżącego zdrowia `Health` (o ile gracz żyje). Zdjęcie implantu zmniejszającego `maxHealth` przycina bieżące zdrowie do nowego maksimum.
- **Ulepszenie (`upgrade(id)`):** zastępuje posiadany implant jego docelowym `upgradesTo` na tej samej pozycji listy, wymienia modyfikatory na `Stats`, dodaje tylko różnicę `maxHealth`, pilnuje unikalności (blokuje ulepszenie, jeśli docelowy implant jest już posiadany) i emituje `implant_acquired` ze źródłem `'upgrade'`. Gdy w runie działa `RunManager`, przed `implantSystem.upgrade(id)` należy wywołać `runManager.upgradeImplant(id, targetId)`.
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

## Integracja z `RoomScene` i sprawdzenie w 30 sekund

`RoomScene` domyślnie korzysta z `implantDefinitions` (z możliwością nadpisania przez `options.implantDefinitions` w testach) i przekazuje tagi z `ImplantSystem.tags()` do `SynergySystem`.

Sprawdzenie ręczne (`?scene=room-test&debug=1`):

1. Otwórz konsolę debug i sprawdź początkowe zdrowie: `__neoryder.query('playerHp')` (100).
2. Wykonaj komendę `implant subdermalWeave` — w konsoli pojawi się potwierdzenie, a `__neoryder.query('playerHp')` oraz `__neoryder.query('playerMaxHp')` wzrosną do `120`.
3. Wykonaj `implant overclock` — zdrowie wzrośnie do `140`, a `__neoryder.query('implants')` zwróci `['subdermalWeave', 'overclock']`.
