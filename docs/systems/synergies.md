# Synergie buildów (F2-16)

Z5: `SynergyContext.stats` przyjmuje `Stats | readonly Stats[]`. Efekt
`stat_modifier_timed` dodaje, odświeża i usuwa modyfikatory we wszystkich
przekazanych instancjach, również przy wygaśnięciu, usunięciu wyzwalacza,
`reset` i `dispose`. Pojedynczy `Stats` zachowuje dotychczasową obsługę.
Pokój i arena przekazują `[playerStats, player.stats]`, dzięki czemu czasowy
bonus `damage` dociera do statystyk walki, a bonus dashu do kontrolera ruchu.
`DamageSystem` skaluje trafienia przez `outgoing` odczytujące `playerStats.damage`;
wyjątki to `#hazard`, `#status` i `#derived`. Wybuch używa bazowej wartości
z danych i podlega skalowaniu, a łańcuch już zadanych obrażeń nie skaluje ponownie.

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
`userPosition(): Vec3 | null`, `applyStatus(target: EntityId, app: StatusApplication): boolean`.
Pokój i arena przekazują `Health.heal` wraz z emisją `health_changed`, pozycję kontrolera
i wynik `StatusSystem.apply(target, app, playerId)`. Efekt statusu liczy się jako
wykonany tylko po nałożeniu na co najmniej jeden cel, także przy promieniu 0.
Martwy cel nie zużywa odnowienia i nie emituje `synergy_triggered`.
Wyzwalacze implantów z `heal`,
`explode` lub `apply_status_area` muszą podawać dodatni `cooldownS`.

- `add_energy { amount }` — `ctx.addEnergy(amount)`.
- `cool_weapon { amount: number | "full" }` — `ctx.coolWeapon(amount)`.
- `stat_modifier_timed { stat, type, value, durationS }` — `StatModifier` ze źródłem `synergy:<id>`, zdejmowany po `durationS` czasu symulacji. Ponowne wyzwolenie odświeża czas, modyfikatory się nie kumulują.
- `chain_on_hit { jumpRangeM, damageMult, tags }` — najbliższy inny cel z `ctx.targets()` w `jumpRangeM` od trafionego zadaje `damage × damageMult` (`ctx.damage.deal`, źródło = gracz, tagi + `#synergy` i `#derived`). Brak celu w zasięgu = efekt nie zadziałał. Synergia liczy się jako wyzwolona (`synergy_triggered`, start `cooldownS`) tylko wtedy, gdy zadziałał choć jeden jej efekt.

Każde wyzwolenie emituje `synergy_triggered { synergy, user }`.

## Brak pętli

Zdarzenia z tagiem `#synergy` nigdy nie wyzwalają synergii. Obrażenia z `chain_on_hit` mają ten tag, więc nie powodują kolejnych skoków ani zabójstw wyzwalających inne synergie.

## Dane w grze

| Plik                      | Synergia            | Wymaga                              | Warunek                             | Efekt                                               |
| ------------------------- | ------------------- | ----------------------------------- | ----------------------------------- | --------------------------------------------------- |
| `resonancePistolero.json` | Pistolero Rezonansu | `#build_resonance`, `#build_gunner` | zabójstwo z tagiem `#power`         | pełne schłodzenie broni                             |
| `bladeDancer.json`        | Tancerz ostrzy      | `#build_blade`, `#build_resonance`  | udane parowanie                     | +10 energii, `dashCooldown` ×0,5 przez 3 s          |
| `stormGunner.json`        | Burzowy strzelec    | `#build_gunner`, `#build_resonance` | trafienie `#gun` w cel z `overload` | skok na cel w 6 m za 50% obrażeń (`#elektrycznosc`) |

## Z11: osiem nowych synergii zawartości

Wszystkie poniższe definicje korzystają z istniejącego schematu i wykonawcy.
Schemat nie ma pola opisu; dokładne działanie opisuje ta tabela. Wymagania
par ścieżek to tagi `#build_blade`, `#build_resonance`, `#build_gunner`.

| id                | Nazwa             | Wymagania                  | Wyzwalacz                                | Efekty                                                                                                        | Odnowienie |
| ----------------- | ----------------- | -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| `parryLock`       | Rygiel            | Ostrze + Rezonans          | `parry_success`                          | ogłuszenie wrogów w 2,5 m od gracza na 0,6 s; parowanie otwiera okno podejścia                                | 4 s        |
| `shockFracture`   | Iskrowy rozłam    | Ostrze + Rezonans          | `damage_dealt`, `#melee`, cel `stunned`  | wybuch przy celu: 8 obrażeń, promień 2 m, `#elektrycznosc`; wykorzystuje okno ogłuszenia                      | 3 s        |
| `executionVent`   | Zimny finisz      | Ostrze + Strzelec          | `execute_performed`                      | schłodzenie aktywnej broni o 30, `moveSpeed` ×1,12 przez 2 s; egzekucja przygotowuje powrót do strzelania     | 3 s        |
| `killSwitch`      | Przełącznik       | Ostrze + Strzelec          | `enemy_killed`, `#gun`                   | +6 energii, `dashCooldown` ×0,6 przez 2 s; zabójstwo strzałem przygotowuje doskok z ostrzem                   | 3 s        |
| `emberRelay`      | Żarowy przekaźnik | Rezonans + Strzelec        | `damage_dealt`, `#power`, cel `burning`  | wybuch przy celu: 8 obrażeń, promień 2 m, `#fire`; podpal pociskiem z modułem incendiary, następnie traf mocą | 3 s        |
| `resonanceSiphon` | Żywy obwód        | Rezonans + Strzelec        | `enemy_killed`, `#power`                 | +4 HP; osłab strzałami, dobij mocą                                                                            | 4 s        |
| `mirrorBurst`     | Lustrzany impuls  | 3 × `#elektrycznosc`       | `projectile_reflected`                   | wybuch przy graczu: 8 obrażeń, promień 2,5 m, `#elektrycznosc`; odbijanie pocisków razi także pobliską grupę  | 4 s        |
| `closeCircuit`    | Domknięcie obwodu | 2 × `#melee`, 1 × `#power` | `damage_dealt`, `#melee`, cel `overload` | +8 energii i +3 HP; po nałożeniu przeciążenia mocą podejdź z ostrzem                                          | 4 s        |

Bazowy pierwszy cios `plasmaBlade.combo[0].damage` = 25; budżet dodatkowych
bazowych obrażeń to 10 na cel i wyzwolenie. Nowe wybuchy zadają 8 (32% ciosu),
leczenie wynosi najwyżej 4 HP. Wybuchy mogą objąć wiele celów i nadal podlegają
istniejącym modyfikatorom obrażeń. Nowe dane nie używają zależnego od obrażeń
trafienia `chain_on_hit` ani bonusu `damage`, więc nie obchodzą tego budżetu.
`stunned` nie zadaje obrażeń; tag `#elektrycznosc` wybuchu sam nie nakłada
`overload`. Każda nowa definicja ma dodatnie `cooldownS`.

`execute_performed` dotyczy `attacker === user`; nie udostępnia filtrów
`tagsAny` ani `targetStatus`. Rygiel działa wokół gracza, ponieważ
`parry_success` nie udostępnia celu efektom obszarowym. Modyfikatory czasowe
nie kumulują się, a odnowienie nie skraca już trwającego dashu.

Testy zawartości: `tests/unit/contentZ11.test.ts` — loader, rozkład wymagań,
budżet dodatkowych obrażeń (w tym statusów) i leczenia, dodatnie odnowienia.

## API

`new SynergySystem(bus, ctx, defs?)`, `setTags`, `active()` (id aktywnych — debug/HUD), `step(dt)` (dt ≤ 0 nic nie zmienia), `reset()` (zdejmuje modyfikatory, zeruje odnowienia), `dispose()` (odpina słuchaczy + reset).

`SynergyContext`: `user`, `addEnergy`, `coolWeapon`, `stats`, `damage` (`deal`), `statuses?`, `targets()`, `position(id)`. **Kontekst — w szczególności `addEnergy` i `coolWeapon` — dostarcza scena.** Arena (F2-17) ustawia tagi z `Loadout.tags` przy każdym resecie, krokuje synergie w czasie gracza i podaje `[playerStats, player.stats]` (walka, dash, ruch), `PlayerEnergy.add` oraz `Weapon.vent` aktywnej broni; hybrydy wybiera się na ekranie wyboru buildu (`docs/systems/arena.md`).

## Jak dodać synergię

1. Dodaj `src/data/synergies/<id>.json` według modelu powyżej (liczby balansu tylko tu).
2. Jeśli potrzebny jest nowy tag w `requires`, dopisz go do `tags` ekwipunku (`src/data/loadouts/`).
3. Nowy rodzaj efektu lub warunku to zmiana kodu (`synergySchema` + `SynergySystem`) i test.

## Jak sprawdzić

`npx vitest run tests/unit/synergies.test.ts` — walidacja definicji, `requires`, warunki, efekty, brak pętli, odnowienie, trzy hybrydy z GDD. W grze: `?scene=arena&debug=1`, wybierz hybrydę, `__neoryder.query('synergies')` pokazuje aktywne synergie, a zdarzenie `synergy_triggered` — odpalenia; test integracji: `arenaBuild.test.ts`.
