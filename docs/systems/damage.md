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

| Element                        | Rola                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EntityRegistry`               | id encji, rodzaj (`kind`), drużyna (`Team`), mapa collider → encja. Emituje `entity_spawned/despawned`. `setTeam` przy odbiciu pocisku.            |
| `Health`                       | `current`, `max` (funkcja — zwykle `stats.get('maxHealth')`, czytana na żywo), `dead`, `apply`, `heal`, `reset`.                                   |
| `DamageSystem`                 | `register(id, health, { stats?, invulnMs? })`, `deal`, `canDamage`, `step(dt)` (czas dla nietykalności).                                           |
| `Hitbox`                       | aktywny obszar ciosu: właściciel, drużyna, obrażenia, tagi, `lifetimeS`, `hitsPerTarget` (domyślnie 1). Geometrię dostarcza wołający.              |
| `Hurtboxes` + `queryHurtboxes` | collidery przyjmujące obrażenia z mnożnikiem (np. głowa 1,5). Zapytanie kształtem Rapier zwraca jeden hurtbox na encję — z największym mnożnikiem. |
| `ResourcePool`                 | energia (spend + regeneracja po opóźnieniu) i ciepło (`add(n, { resetDelay: true })` + ujemna regeneracja = chłodzenie).                           |

## Reguły

- **Statusy (F2-01):** `DamageInfo.statuses?: readonly StatusApplication[]` opisuje statusy trafienia: `id`, `durationS`, opcjonalne `stacks` (domyślnie 1). `damage_dealt.statuses` otrzymuje podaną tablicę bez zmian, także pustą; gdy jej nie podano, pole nie występuje w zdarzeniu. Samo przekazanie nie nakłada statusów i nie zmienia dotychczasowych warunków emisji obrażeń.
- **Statystyki celu:** `DamageSystem.stats(id): Stats | undefined` zwraca instancję przekazaną przez `register(id, health, { stats })`; bez statystyk, dla niezarejestrowanego celu i po `unregister` zwraca `undefined`.
- **Drużyny:** `player`, `enemy`, `neutral`. Ta sama drużyna = brak obrażeń. `neutral` jako źródło rani wszystkich (np. wybuchowa beczka). `source = null` (środowisko) rani wszystkich. Tag `#friendly_fire` omija filtr.
- **Redukcje** wyłącznie przez `StatModifier` na statystyce `damageTaken` celu. Blok ostrzem = `{ stat: 'damageTaken', type: 'mult', value: 0.3, source: 'block' }`, zdejmowany `removeBySource('block')`. `damageTaken` ma zawsze bazę 1 — wartość bazowa w `Stats` jest ignorowana.
- **Nietykalność** po trafieniu tylko tam, gdzie podano `invulnMs` (gracz). Liczona w czasie symulacji, więc hitstop i spowolnienie ją wydłużają.
- **Obrażenia zerowe** (zignorowane, ujemne, cel martwy) nie emitują zdarzeń.
- **Kolejność zdarzeń:** `damage_dealt` → `health_changed` → `enemy_killed` lub `player_died`. `enemy_killed` emitowane dla każdej drużyny poza `player`.
- **Kolizje:** hurtboxy to zwykłe collidery Rapier z grupami `CollisionGroup`; filtr zapytania to `interactionGroups(grupaAtakującego, grupyCelów)`. Nie ma osobnej fizyki hitboxów.

## Strojenie

Wartości trafień (obrażenia ciosów, odrzut) są w danych broni i w `tuning.ts`.
Grupa `tuning.damage` zawiera `playerInvulnMs` (250 ms, okno nietykalności gracza)
oraz `respawnS` (1,5 s, czas odrodzenia manekina). Manekin nie ma nietykalności.

## Testy

`tests/unit/damage.test.ts` (rejestr, Health, DamageSystem, Hitbox, zapytanie Rapier), `tests/unit/resource.test.ts` (energia, ciepło).

## Scena damage-test

`?scene=damage-test&debug=1` pokazuje model `enemy_trooper.glb` na białej podłodze,
ze statycznej kamery. Przy błędzie ładowania model zastępuje czerwona bryła.
Manekin ma 100 HP ze `Stats`, kapsułę tułowia (×1) i kulę głowy (×1,5).
Napis HTML aktualizuje się ze zdarzenia `health_changed`.

- `hit <dmg>` zadaje obrażenia przez `DamageSystem` ze źródłem gracza i tagiem `#debug`.
- `heal` przywraca pełne zdrowie i emituje `health_changed`.
- `block on|off` dodaje lub zdejmuje modyfikator `damageTaken` ×0,3, źródło `block`.
- `slash` tworzy nowy Hitbox (25 obrażeń, 0,1 s). Cuboid na wysokości 1,2 m
  przecina tułów i głowę. Zapytanie wybiera głowę, więc pojedynczy cios bez bloku
  zadaje 37,5 obrażeń; kolejne kroki tego samego Hitboxa nie trafiają ponownie.

Po `enemy_killed` model i collidery znikają, a po `tuning.damage.respawnS` czasu
symulacji manekin wraca z pełnym zdrowiem. Debug query udostępnia `dummyHp`,
`dummyAlive` i `lastDamage` (ostatni payload `damage_dealt`). Scena odpina komendy,
subskrypcje i napis oraz zwalnia zasoby przy `dispose`.

`tests/unit/damageTest.test.ts` sprawdza scenę z prawdziwym Rapierem w Node,
a `tests/e2e/damageTest.spec.ts` weryfikuje ładowanie i trafienie w przeglądarce.
