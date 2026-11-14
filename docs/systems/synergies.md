# Synergie buildów (F2-16)

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

`SynergyContext`: `user`, `addEnergy`, `coolWeapon`, `stats`, `damage` (`deal`), `statuses?`, `targets()`, `position(id)`. **Kontekst — w szczególności `addEnergy` i `coolWeapon` — dostarcza scena.** Arena (F2-17) ustawia tagi z `Loadout.tags` przy każdym resecie, krokuje synergie w czasie gracza i podaje `PlayerController.stats` (dash, ruch), `PlayerEnergy.add` oraz `Weapon.vent` aktywnej broni; hybrydy wybiera się na ekranie wyboru buildu (`docs/systems/arena.md`).

## Jak dodać synergię

1. Dodaj `src/data/synergies/<id>.json` według modelu powyżej (liczby balansu tylko tu).
2. Jeśli potrzebny jest nowy tag w `requires`, dopisz go do `tags` ekwipunku (`src/data/loadouts/`).
3. Nowy rodzaj efektu lub warunku to zmiana kodu (`synergySchema` + `SynergySystem`) i test.

## Jak sprawdzić

`npx vitest run tests/unit/synergies.test.ts` — walidacja definicji, `requires`, warunki, efekty, brak pętli, odnowienie, trzy hybrydy z GDD. W grze: `?scene=arena&debug=1`, wybierz hybrydę, `__neoryder.query('synergies')` pokazuje aktywne synergie, a zdarzenie `synergy_triggered` — odpalenia; test integracji: `arenaBuild.test.ts`.
