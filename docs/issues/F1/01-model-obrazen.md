# [F1][Architekt] Model obrażeń i komponenty Health / Hitbox / Hurtbox

Agent: Architekt
Folder: /src/combat/damage
Zależy od: — (tylko F0: EventBus, Stats, Rapier)
Filar: Walka, która „czuje się” świetnie

## Cel

Jeden wspólny model obrażeń, z którego korzystają ostrze, blaster, moce i pociski wrogów. Dzięki temu wszystkie trafienia przechodzą tą samą drogą i emitują te same zdarzenia.

## Wymagania

- `Health { current, max }` z `max` liczonym przez `Stats` (`maxHealth`); metody `damage`, `heal`, `isDead`.
- `Hitbox` (zadaje obrażenia: właściciel, `damage`, `tags`, kierunek, czas życia) i `Hurtbox` (przyjmuje: ref do `Health`, mnożnik, warstwa kolizji z `CollisionGroup`).
- Funkcja `applyDamage(source, target, amount, tags, hit)` — jedyna droga zmiany zdrowia; liczy redukcję (np. blok −70%) przez `StatModifier`, nie na własną rękę.
- Zdarzenia: `damage_dealt` i `enemy_killed` (istnieją), nowe zdarzenia z sekcji Kontrakt.
- Brak friendly fire między tą samą warstwą; filtrowanie przez `interactionGroups`.
- Stan serializowalny, bez referencji do Three.js; wartości (np. okno nietykalności po trafieniu) w `tuning.ts` w sekcji `damage`.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

```ts
damage_dealt: { target: EntityId; source: EntityId | null; amount: number;
              point: { x: number; y: number; z: number };
              dir: { x: number; y: number; z: number }; tags: readonly string[]; killed: boolean }
health_changed: { id: EntityId; current: number; max: number }
player_died: { id: EntityId }
```

Moduły `vfx`, `audio`, kamera i feel czytają `damage_dealt` (punkt i kierunek ciosu) zamiast liczyć samodzielnie.

## Kryteria akceptacji

- [ ] Vitest: `applyDamage` zmniejsza zdrowie, zdrowie nie spada poniżej 0, `enemy_killed` emitowane raz
- [ ] Vitest: modyfikator redukcji (−70%) zmienia wynik zgodnie z `computeStat`
- [ ] Vitest: hitbox nie rani właściciela ani tej samej frakcji
- [ ] Vitest: `damage_dealt` niesie punkt, kierunek i flagę `killed`
- [ ] Scena debug `?scene=damage-test` z manekinem i komendą `hit <dmg>` w konsoli debug
- [ ] Aktualizacja /docs/systems/damage.md (nowy plik) i wpis w api.md po zatwierdzeniu

## Poza zakresem

Efekty statusów (F2), pancerz i odporności, rysowanie pasków zdrowia (to robi HUD, zadanie #15).
