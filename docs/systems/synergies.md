# Synergie buildów (F2-16)

Z5: `SynergyContext.stats` przyjmuje `Stats | readonly Stats[]`. Efekt
`stat_modifier_timed` dodaje, odświeża i usuwa modyfikatory we wszystkich
przekazanych instancjach, również przy wygaśnięciu, usunięciu wyzwalacza,
`reset` i `dispose`. Pojedynczy `Stats` zachowuje dotychczasową obsługę.
Pokój i arena przekazują `[playerStats, player.stats]`, dzięki czemu czasowy
bonus `damage` dociera do statystyk walki, a bonus dashu do kontrolera ruchu.

## F3-10: implanty i progi

`setTags` liczy wystąpienia tagów. `requires` nadal wymaga obecności każdego tagu;
`requiresCount` dodatkowo wymaga podanej liczby wystąpień. RoomScene przekazuje
`Loadout.tags` i `ImplantSystem.tags()` bez usuwania powtórzeń. Podgląd buildu
uwzględnia te same progi, więc nie pokazuje synergii wymagających implantów na starcie.

Trzy nowe definicje: Mistrzostwo ostrza (3 × `#melee`), Splot Rezonansu
(3 × `#power`), Zimny arsenał (3 × `#gun`). Parametry efektów są w JSON.

`setImplantTriggers(implantSystem.triggers())` przekazuje wyzwalacze do wspólnego
wykonawcy synergii. Każdy wyzwalacz ma osobne odnowienie i identyfikator
`implant:<id>:<index>`. Zdarzenia obrażeń z `#synergy` są ignorowane, również przez
implanty. Usunięcie implantu usuwa jego odnowienia i aktywne modyfikatory czasowe.
Zmiana implantów w pokoju odświeża tagi i wyzwalacze; inicjalizacja pokoju także je odtwarza.

Sprawdzenie ręczne: `?scene=room-test`, `implant servoTendons`, kolejne implanty
z `#melee`, następnie `query('synergies')`. Listę implantów podaje pomoc komendy.

`SynergySystem` (`src/progression/synergies.ts`) wykonuje hybrydy buildów zapisane jako dane w `src/data/synergies/*.json`. Nowa synergia = nowy plik JSON, bez zmian w kodzie (ADR 0004 pkt 5).

## Model danych

```json
{
  "id": "bladeDancer",
  "name": "Tancerz ostrzy",
  "requires": ["#build_blade", "#build_resonance"],
  "when": { "event": "parry_success" },
  "effects": [{ "kind": "add_energy", "amount": 10 }],
  "cooldownS": 1.5
}
```

- `id` — unikalny (powtórzone id = błąd przy ładowaniu), `name` — nazwa w UI (pl).
- `requires` — tagi ekwipunku; synergia jest aktywna, gdy **wszystkie** są w tagach ustawionych przez `setTags(tags)`. Brak któregokolwiek = synergia nie działa. Implanty F3 będą dodawać tagi do tej listy.
- `cooldownS` (opcjonalne) — odnowienie liczone w czasie symulacji (`step(dt)`), startuje przy wyzwoleniu.
- Walidacja: zod (`synergySchema`), loader `loadSynergyDefinitions`, domyślny zestaw `synergyDefinitions` (`import.meta.glob`).

## Warunki (`when`)

| `event`                | Dotyczy gracza, gdy         | `tagsAny` / `targetStatus` |
| ---------------------- | --------------------------- | -------------------------- |
| `enemy_killed`         | `killer === user`           | tak (cel = zabity wróg)    |
| `damage_dealt`         | `source === user`           | tak (cel = trafiony)       |
| `parry_success`        | zawsze (paruje tylko gracz) | nie                        |
| `power_used`           | `user === user`             | nie                        |
| `dash_used`            | `user === user`             | nie                        |
| `projectile_reflected` | `newOwner === user`         | nie                        |

- `tagsAny` — wystarczy jeden z tagów zdarzenia.
- `targetStatus` — cel zdarzenia musi mieć status (`StatusQuery.has`); bez `statuses` w kontekście warunek nie jest spełniony.
- `tagsAny`/`targetStatus` przy innych zdarzeniach oraz `chain_on_hit` poza `damage_dealt` są odrzucane przy ładowaniu.

## Efekty (`effects`, co najmniej jeden)

Z4 dodaje `when.targetIsUser?: boolean`, wyłącznie dla `damage_dealt`. `true`
wybiera obrażenia otrzymane przez użytkownika (`target === user`, również bez źródła).
`false` i brak pola zachowują dotychczasowe `source === user`. Filtry tagów,
statusu i zakaz wyzwalania przez `#synergy` obowiązują w obu wariantach.

- `heal { amount > 0 }` — leczy przez opcjonalne `ctx.heal(amount)`.
- `explode { at, radiusM > 0, damage >= 0, knockback? >= 0, tags }` — środek
  to `ctx.position(target)` lub opcjonalne `ctx.userPosition()`. Każdy cel z
  `ctx.targets()` w sferze (łącznie z granicą i celem zdarzenia) otrzymuje
  `damage` przez `ctx.damage.deal`, ze źródłem `ctx.user`, tagami efektu oraz
  `#synergy` i znormalizowanym kierunkiem od środka (wektor zerowy w środku).
  Emituje `explosion { point, radiusM, owner: user, tags }` z tymi samymi tagami;
  sama emisja wybuchu liczy się jako efekt, także bez trafionych celów.
- `apply_status_area { at, radiusM >= 0, status, durationS > 0, stacks? >= 1 }`
  — przez opcjonalne `ctx.applyStatus(target, { id: status, durationS, stacks })`.
  Stosy muszą być całkowite. Promień 0 oznacza wyłącznie cel zdarzenia, bez
  odczytu pozycji; przy braku celu nic się nie dzieje. Dodatni promień wybiera
  cele tak jak wybuch. Status musi istnieć w rejestrze `src/data/statuses/`;
  walidacja w `effectSchema` importuje sam schemat statusów bez cyklu zależności.

W obu efektach obszarowych `at` to `target` lub `user`. `at: 'target'` jest
dozwolone wyłącznie przy `enemy_killed` i `damage_dealt` (walidacja synergii
i wyzwalaczy implantów, także używanych przez talenty). Brak wymaganej funkcji
kontekstu albo pozycji pomija efekt. Brak celów statusu również nie jest
wyzwoleniem. Pominięte efekty nie emitują `synergy_triggered` ani nie uruchamiają
odnowienia, chyba że inny efekt tego samego wyzwalacza zadziałał.

Nowe opcjonalne pola `SynergyContext`: `heal(amount: number): void`,
`userPosition(): Vec3 | null`, `applyStatus(target: EntityId, app: StatusApplication): void`.
Arena przekazuje `Health.heal` wraz z emisją `health_changed`, pozycję kontrolera
i `StatusSystem.apply(target, app, playerId)`. Integracja tych pól w `RoomScene`
wymaga osobnego wklejenia przez architekta. Wyzwalacze implantów z `heal`,
`explode` lub `apply_status_area` muszą podawać dodatni `cooldownS`.

- `add_energy { amount }` — `ctx.addEnergy(amount)`.
- `cool_weapon { amount: number | "full" }` — `ctx.coolWeapon(amount)`.
- `stat_modifier_timed { stat, type, value, durationS }` — `StatModifier` ze źródłem `synergy:<id>`, zdejmowany po `durationS` czasu symulacji. Ponowne wyzwolenie odświeża czas, modyfikatory się nie kumulują.
- `chain_on_hit { jumpRangeM, damageMult, tags }` — najbliższy inny cel z `ctx.targets()` w `jumpRangeM` od trafionego zadaje `damage × damageMult` (`ctx.damage.deal`, źródło = gracz, tagi + `#synergy`). Brak celu w zasięgu = efekt nie zadziałał. Synergia liczy się jako wyzwolona (`synergy_triggered`, start `cooldownS`) tylko wtedy, gdy zadziałał choć jeden jej efekt.

Każde wyzwolenie emituje `synergy_triggered { synergy, user }`.

## Brak pętli

Zdarzenia z tagiem `#synergy` nigdy nie wyzwalają synergii. Obrażenia z `chain_on_hit` mają ten tag, więc nie powodują kolejnych skoków ani zabójstw wyzwalających inne synergie.

## Dane w grze

| Plik                      | Synergia            | Wymaga                              | Warunek                             | Efekt                                               |
| ------------------------- | ------------------- | ----------------------------------- | ----------------------------------- | --------------------------------------------------- |
| `resonancePistolero.json` | Pistolero Rezonansu | `#build_resonance`, `#build_gunner` | zabójstwo z tagiem `#power`         | pełne schłodzenie broni                             |
| `bladeDancer.json`        | Tancerz ostrzy      | `#build_blade`, `#build_resonance`  | udane parowanie                     | +10 energii, `dashCooldown` ×0,5 przez 3 s          |
| `stormGunner.json`        | Burzowy strzelec    | `#build_gunner`, `#build_resonance` | trafienie `#gun` w cel z `overload` | skok na cel w 6 m za 50% obrażeń (`#elektrycznosc`) |

## API

`new SynergySystem(bus, ctx, defs?)`, `setTags`, `active()` (id aktywnych — debug/HUD), `step(dt)` (dt ≤ 0 nic nie zmienia), `reset()` (zdejmuje modyfikatory, zeruje odnowienia), `dispose()` (odpina słuchaczy + reset).

`SynergyContext`: `user`, `addEnergy`, `coolWeapon`, `stats`, `damage` (`deal`), `statuses?`, `targets()`, `position(id)`. **Kontekst — w szczególności `addEnergy` i `coolWeapon` — dostarcza scena.** Arena (F2-17) ustawia tagi z `Loadout.tags` przy każdym resecie, krokuje synergie w czasie gracza i podaje `[playerStats, player.stats]` (walka, dash, ruch), `PlayerEnergy.add` oraz `Weapon.vent` aktywnej broni; hybrydy wybiera się na ekranie wyboru buildu (`docs/systems/arena.md`).

## Jak dodać synergię

1. Dodaj `src/data/synergies/<id>.json` według modelu powyżej (liczby balansu tylko tu).
2. Jeśli potrzebny jest nowy tag w `requires`, dopisz go do `tags` ekwipunku (`src/data/loadouts/`).
3. Nowy rodzaj efektu lub warunku to zmiana kodu (`synergySchema` + `SynergySystem`) i test.

## Jak sprawdzić

`npx vitest run tests/unit/synergies.test.ts` — walidacja definicji, `requires`, warunki, efekty, brak pętli, odnowienie, trzy hybrydy z GDD. W grze: `?scene=arena&debug=1`, wybierz hybrydę, `__neoryder.query('synergies')` pokazuje aktywne synergie, a zdarzenie `synergy_triggered` — odpalenia; test integracji: `arenaBuild.test.ts`.
