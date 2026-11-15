# Łatki definicji i ResolvedLoadout — F4-03

Talenty zmieniają działanie broni, mocy i ostrzy przez **łatki danych** stosowane do kopii definicji przy starcie pokoju (ADR 0007 pkt 5). Nowy wariant to dane (łatka w węźle talentu), nie nowy kod. Kod: `src/progression/patches.ts`; schemat łatki: `src/progression/patchSchema.ts`; typ `DefinitionPatch`: `src/core/metaTypes.ts`.

## Format łatki

```json
{ "target": "power:chain", "op": "add", "path": "jumps", "value": 1 }
```

| Pole | Znaczenie |
| --- | --- |
| `target` | `weapon:<id>`, `power:<id>` albo `blade:<id>`; inny prefiks to błąd |
| `op` | `set` (ustaw), `add` (dodaj liczbę), `mul` (pomnóż przez liczbę) |
| `path` | segmenty rozdzielone kropką; segment liczbowy indeksuje tablicę |
| `value` | liczba skończona dla `add`/`mul`; dowolny JSON dla `set` |

## Ścieżki

- `jumps`, `damage`, `cooldownS` — pola najwyższego poziomu definicji.
- `combo.2.knockback` — trzeci cios combo ostrza (indeks od 0); `heavy.damage`, `throw.damage` — pola zagnieżdżone.
- `statuses` — cała tablica (tylko `set`); pole istnieje w schemacie broni i mocy `chain`.
- Segmenty puste (`a..b`) oraz `__proto__`, `constructor`, `prototype` są odrzucane.
- Indeks poza tablicą to błąd (łatki nie dopisują elementów).

## Reguły

1. `applyPatches` pracuje na `structuredClone` definicji. Definicje w globalnych mapach (`bladeDefinitions`, `weaponDefinitions`, `powerDefinitions`) nigdy się nie zmieniają. Bez łatek zwracana jest ta sama definicja (ta sama referencja).
2. `add` i `mul` działają tylko na istniejącej liczbie; inaczej błąd „pole nie jest liczbą” lub „nieznana ścieżka”.
3. `set` ustawia istniejące pole albo pole dopuszczone przez schemat. Po walidacji wartość pod ścieżką musi istnieć i być równa ustawionej. Zod usuwa nieznane klucze, więc `set` na polu spoza schematu daje błąd „nieznana ścieżka”. Wartość, którą schemat przekształca (np. dopisuje pola domyślne), też daje błąd.
4. Po **każdej** łatce wynik przechodzi ponownie przez schemat zod definicji (`bladeSchema`, `weaponSchema`, `powerSchema`). Np. `mul jumps 1.5` łamie `int()` i daje błąd.
5. Kolejność: łatki są stosowane w kolejności tablicy (zadanie 04 poda je posortowane po id węzła, w węźle wg tablicy). `set` po `add` na tej samej ścieżce wygrywa i odwrotnie.
6. Błąd ma postać `${label}: łatka ${target} ${op} ${path}: powód`. Błąd łatki to błąd danych wykryty testem, nie cicha zmiana.
7. Wartości z `tuning.ts` (okno parowania, hitstop) nie są łatkowane.

## resolveLoadout

`resolveLoadout(loadout, patches)` zwraca `ResolvedLoadout { loadout, blade, weapons, powers }`: definicje z globalnych map w kolejności ekwipunku plus łatki. Łatki na przedmioty spoza ekwipunku są pomijane (talent może łatać broń, której gracz nie ma w tym runie). Nieznany prefiks celu jest błędem nawet dla przedmiotu spoza ekwipunku. Nieznane id w ekwipunku daje `Nieznany ekwipunek: <id>`. W `resolveLoadout` label błędu to cel łatki (np. `power:chain`).

## Użycie w grze

- `RoomScene` (`options.patches`, domyślnie `[]`) buduje ostrze, bronie i moce z `ResolvedLoadout`: moc przez `createPowerFromDefinition`, broń z definicji, ostrze z `resolved.blade`. `query('resolvedLoadout')` zwraca użyte definicje (debug, testy).
- `Arena` używa `resolveLoadout(preset, [])`; zachowanie bez zmian. Nadpisanie ostrza (`?blade=`, ekran buildu) nadal wygrywa (`withBladeOverride`).
- Symulator balansu (`src/balance/`) czyta definicje wprost z map i nie jest łatkowany.

## Przykłady

| Cel | Łatka |
| --- | --- |
| Błyskawica przeskakuje o 1 cel więcej | `{ "target": "power:chain", "op": "add", "path": "jumps", "value": 1 }` |
| Blaster +25% obrażeń | `{ "target": "weapon:blaster", "op": "mul", "path": "damage", "value": 1.25 }` |
| Trzeci cios ostrza mocniej odrzuca | `{ "target": "blade:plasmaBlade", "op": "add", "path": "combo.2.knockback", "value": 2 }` |
| Pistolet podpala | `{ "target": "weapon:pistol", "op": "set", "path": "statuses", "value": [{ "id": "burn", "durationS": 2 }] }` |

## Debug i testy

- Mechanizm: `tests/unit/patches.test.ts`.
- Zachowanie w pokoju: `tests/unit/roomPatches.test.ts` (6 wrogów w stożku: Błyskawica trafia 4 cele bez łatki i 5 z łatką `power:chain add jumps 1`).
- Ręcznie: `new RoomScene(room, run, waves, { patches })`, potem `query('resolvedLoadout')`. Łatki z talentów dojdą z zadaniem 04.
