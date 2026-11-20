# Łatki definicji i ResolvedLoadout — F4-03

Talenty zmieniają działanie broni, mocy i ostrzy przez **łatki danych** stosowane do kopii definicji przy starcie pokoju (ADR 0007 pkt 5). Nowy wariant to dane (łatka w węźle talentu), nie nowy kod. Kod: `src/progression/patches.ts`; schemat łatki: `src/progression/patchSchema.ts`; typ `DefinitionPatch`: `src/core/metaTypes.ts`.

## Format łatki

```json
{ "target": "power:chain", "op": "add", "path": "jumps", "value": 1 }
```

| Pole     | Znaczenie                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| `target` | `weapon:<id>`, `power:<id>` albo `blade:<id>`; inny prefiks to błąd                                           |
| `op`     | `set` (ustaw), `add` (dodaj liczbę), `mul` (pomnóż przez liczbę), `append` (dopisz elementy na końcu tablicy) |
| `path`   | segmenty rozdzielone kropką; segment liczbowy indeksuje tablicę                                               |
| `value`  | liczba skończona dla `add`/`mul`; tablica dla `append`; dowolny JSON dla `set`                                |

`target` ma postać `weapon:<id>` / `power:<id>` / `blade:<id>` (id niepuste), a `path` jest niepustym tekstem. Schemat łatki (`definitionPatchSchema`) odrzuca `add`/`mul` z wartością inną niż liczba skończona i `append` z wartością inną niż tablica. Łatki w danych węzłów talentów (`effects.patches`) i modułów broni (`patches`; w module bez `target`, bo cel wynika z broni, do której moduł jest zamontowany) przechodzą ten schemat przy ładowaniu.

## Ścieżki

- `jumps`, `damage`, `cooldownS` — pola najwyższego poziomu definicji.
- `combo.2.knockback` — trzeci cios combo ostrza (indeks od 0); `heavy.damage`, `throw.damage` — pola zagnieżdżone.
- `statuses` — cała tablica (`set`, albo `append` dopisujący elementy; pole opcjonalne, istnieje w schemacie broni i mocy `chain`, `append` na brakującym polu tworzy tablicę).
- Segmenty puste (`a..b`) oraz `__proto__`, `constructor`, `prototype` są odrzucane.
- Indeks poza tablicą to błąd „indeks poza tablicą” (łatki nie dopisują elementów pod nieistniejącym indeksem; do dopisywania służy `append` na całej tablicy).

## Reguły

1. `applyPatches` pracuje na `structuredClone` definicji. Definicje w globalnych mapach (`bladeDefinitions`, `weaponDefinitions`, `powerDefinitions`) nigdy się nie zmieniają. Bez łatek zwracana jest ta sama definicja (ta sama referencja).
2. `add` i `mul` działają tylko na istniejącej liczbie; inaczej błąd „pole nie jest liczbą” lub „nieznana ścieżka”. Rodzic ścieżki musi istnieć i być obiektem lub tablicą, inaczej „nieznana ścieżka”.
3. `set` ustawia istniejące pole albo pole dopuszczone przez schemat. Po walidacji wartość pod ścieżką musi istnieć i być równa (porównanie głębokie JSON) ustawionej. Zod usuwa nieznane klucze, więc `set` na polu spoza schematu daje błąd „nieznana ścieżka”. Wartość, którą schemat przekształca (np. dopisuje pola domyślne), też daje błąd („schemat zmienił ustawioną wartość”). To samo sprawdzenie dotyczy `append` (porównanie całej tablicy po dopisaniu). `append` na istniejącym polu, które nie jest tablicą, daje błąd „pole nie jest tablicą”.
4. Po **każdej** łatce wynik przechodzi ponownie przez schemat zod definicji (`bladeSchema`, `weaponSchema`, `powerSchema`), a wynik walidacji staje się definicją dla następnej łatki. Np. `mul jumps 1.5` łamie `int()` i daje błąd.
5. Kolejność: łatki są stosowane w kolejności tablicy. W `RoomScene` tablica to: łatki talentów (`resolveTalents`: węzły w kolejności posortowanych id, w węźle wg tablicy `effects.patches`; powtórzone id liczą się raz), potem łatki modułów broni (`modulePatches`: broń po broni wg ekwipunku, w broni moduły wg slotów `muzzle`, `cell`, `optic`, każdy cel `weapon:<id broni>`; moduły przechodzą wcześniej `sanitizeModules`), na końcu `options.patches`. `set` po `add` na tej samej ścieżce wygrywa i odwrotnie.
6. Błąd ma postać `${label}: łatka ${target} ${op} ${path}: powód`. Błąd łatki to błąd danych wykryty testem, nie cicha zmiana.
7. Wartości z `tuning.ts` (okno parowania, hitstop) nie są łatkowane.

## resolveLoadout

`resolveLoadout(loadout, patches)` zwraca `ResolvedLoadout { loadout, blade, weapons, powers }`: definicje z globalnych map w kolejności ekwipunku plus łatki. Łatki na przedmioty spoza ekwipunku są pomijane (talent może łatać broń, której gracz nie ma w tym runie). Nieznany prefiks celu jest błędem nawet dla przedmiotu spoza ekwipunku. Nieznane id w ekwipunku daje `Nieznany ekwipunek: <id>`. W `resolveLoadout` label błędu to cel łatki (np. `power:chain`).

## Użycie w grze

- `RoomScene` (łatki z talentów i modułów runu oraz `options.patches`, domyślnie brak) buduje ostrze, bronie i moce z `ResolvedLoadout`: moc przez `createPowerFromDefinition`, broń z definicji, ostrze z `resolved.blade`. `query('resolvedLoadout')` zwraca użyte definicje (debug, testy).
- `Arena` używa `resolveLoadout(preset, [])`; zachowanie bez zmian. Nadpisanie ostrza (`?blade=`, ekran buildu) nadal wygrywa (`withBladeOverride`).
- Symulator balansu (`src/balance/`) czyta definicje wprost z map i nie jest łatkowany.

## Przykłady

| Cel                                                              | Łatka                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Błyskawica przeskakuje o 1 cel więcej                            | `{ "target": "power:chain", "op": "add", "path": "jumps", "value": 1 }`                                                              |
| Blaster +25% obrażeń                                             | `{ "target": "weapon:blaster", "op": "mul", "path": "damage", "value": 1.25 }`                                                       |
| Trzeci cios ostrza mocniej odrzuca                               | `{ "target": "blade:plasmaBlade", "op": "add", "path": "combo.2.knockback", "value": 2 }`                                            |
| Pistolet podpala                                                 | `{ "target": "weapon:pistol", "op": "set", "path": "statuses", "value": [{ "id": "burning", "durationS": 2 }] }`                     |
| Moduł Podpalenie dopisuje status (bez nadpisywania istniejących) | `{ "op": "append", "path": "statuses", "value": [{ "id": "burning", "durationS": 3 }] }` (cel `weapon:<broń>` dodawany przy montażu) |

## Debug i testy

- Mechanizm: `tests/unit/patches.test.ts`.
- Zachowanie w pokoju: `tests/unit/roomPatches.test.ts` (6 wrogów w stożku: Błyskawica trafia 4 cele bez łatki i 5 z łatką `power:chain add jumps 1`).
- Ręcznie: `new RoomScene(room, run, waves, { patches })`, potem `query('resolvedLoadout')`. Łatki z talentów (`docs/systems/talents.md`) i modułów (`docs/systems/weaponModules.md`) dochodzą automatycznie z `RunState` (talenty, ekwipunek z modułami).
