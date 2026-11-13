# System obrażeń (F1 #01)

Właściciel: Architekt. Kod: `src/combat/damage/`, `src/core/entities.ts`, `src/core/resource.ts`, `src/core/math.ts`. Kontrakty: `docs/api.md` → „Kontrakty F1”, decyzje: `docs/adr/0003-kontrakty-f1.md`.

## Zasada

Każde trafienie — ostrze, blaster, moc, pocisk wroga, środowisko — przechodzi przez **`DamageSystem.deal(target, info)`**. Nikt inny nie zmniejsza zdrowia. Dzięki temu zdarzenia, friendly fire, nietykalność i modyfikatory działają tak samo dla wszystkich.

```
atak (melee / pocisk / moc)
  └─ zapytanie fizyki: queryHurtboxes(...) / sweep pocisku  → Hurtbox { entity, multiplier }
       └─ Hitbox.strike(target, damage, { point, dir, multiplier })   // limit trafień, czas życia
            └─ DamageSystem.deal(target, DamageInfo)
                 ├─ canDamage: drużyny, samotrafienie (#friendly_fire omija)
                 ├─ okno nietykalności (czas symulacji)
                 ├─ × damageTaken (modyfikatory Stats, baza zawsze 1)
                 ├─ Health.apply → faktyczne obrażenia (≤ pozostałe HP)
                 └─ emit: damage_dealt → health_changed → enemy_killed | player_died
```

## Elementy

| Element | Rola |
|---|---|
| `EntityRegistry` | id encji, rodzaj (`kind`), drużyna (`Team`), mapa collider → encja. Emituje `entity_spawned/despawned`. `setTeam` przy odbiciu pocisku. |
| `Health` | `current`, `max` (funkcja — zwykle `stats.get('maxHealth')`, czytana na żywo), `dead`, `apply`, `heal`, `reset`. |
| `DamageSystem` | `register(id, health, { stats?, invulnMs? })`, `deal`, `canDamage`, `step(dt)` (czas dla nietykalności). |
| `Hitbox` | aktywny obszar ciosu: właściciel, drużyna, obrażenia, tagi, `lifetimeS`, `hitsPerTarget` (domyślnie 1). Geometrię dostarcza wołający. |
| `Hurtboxes` + `queryHurtboxes` | collidery przyjmujące obrażenia z mnożnikiem (np. głowa 1,5). Zapytanie kształtem Rapier zwraca jeden hurtbox na encję — z największym mnożnikiem. |
| `ResourcePool` | energia (spend + regeneracja po opóźnieniu) i ciepło (`add(n, { resetDelay: true })` + ujemna regeneracja = chłodzenie). |

## Reguły

- **Drużyny:** `player`, `enemy`, `neutral`. Ta sama drużyna = brak obrażeń. `neutral` jako źródło rani wszystkich (np. wybuchowa beczka). `source = null` (środowisko) rani wszystkich. Tag `#friendly_fire` omija filtr.
- **Redukcje** wyłącznie przez `StatModifier` na statystyce `damageTaken` celu. Blok ostrzem = `{ stat: 'damageTaken', type: 'mult', value: 0.3, source: 'block' }`, zdejmowany `removeBySource('block')`. `damageTaken` ma zawsze bazę 1 — wartość bazowa w `Stats` jest ignorowana.
- **Nietykalność** po trafieniu tylko tam, gdzie podano `invulnMs` (gracz). Liczona w czasie symulacji, więc hitstop i spowolnienie ją wydłużają.
- **Obrażenia zerowe** (zignorowane, ujemne, cel martwy) nie emitują zdarzeń.
- **Kolejność zdarzeń:** `damage_dealt` → `health_changed` → `enemy_killed` lub `player_died`. `enemy_killed` emitowane dla każdej drużyny poza `player`.
- **Kolizje:** hurtboxy to zwykłe collidery Rapier z grupami `CollisionGroup`; filtr zapytania to `interactionGroups(grupaAtakującego, grupyCelów)`. Nie ma osobnej fizyki hitboxów.

## Strojenie

Wartości trafień (obrażenia ciosów, odrzut) są w danych broni i w `tuning.ts`. Planowana grupa `tuning.damage` (dodawana razem ze sceną `damage-test`): `playerInvulnMs` (start 250 ms).

## Testy

`tests/unit/damage.test.ts` (rejestr, Health, DamageSystem, Hitbox, zapytanie Rapier), `tests/unit/resource.test.ts` (energia, ciepło).

## Do zrobienia w ramach #01

- Scena `?scene=damage-test` z manekinem i komendą `hit <dmg>` — po scaleniu kontrolera FPP (#02), bo obie zmiany dotykają rejestru scen i komend.
