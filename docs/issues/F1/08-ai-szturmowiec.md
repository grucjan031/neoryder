# [F1][AI wrogów] Archetyp Szturmowiec

Agent: AI wrogów
Folder: /src/enemies
Zależy od: #01 (model obrażeń), #02 (kontroler FPP — pozycja gracza jako cel)
Filar: Walka, która „czuje się” świetnie

## Cel

Pierwszy wróg: Szturmowiec z pałką elektryczną, który napiera na gracza i daje wyraźne okna do kontry.

## Wymagania

- Definicja w `src/data/enemies/assaulter.json` (zod): zdrowie, prędkość, obrażenia pałki, zasięg, czas wymachu, odnowienie.
- Zachowania: bezczynność → pościg (nawigacja prosta po arenie, unikanie ścian) → wymach (telegraph 0,4 s czytelny wizualnie) → cios → odrzut/odskok.
- Ciało Rapier w grupie `CollisionGroup.Enemy`, `Hurtbox` z #01; po zgonie emituje `enemy_killed`.
- Odrzut i krótkie ogłuszenie po trafieniu ostatnim ciosem combo i Pchnięciu.
- Rejestr archetypów `enemyRegistry` z fabryką po `id` (używany przez arenę #16 i konsolę debug).
- Losowość (rozrzut zachowań) tylko przez `Rng`; bez `Math.random()`.
- Wszystkie liczby w danych lub `tuning.enemies`.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

```ts
enemy_telegraph: {
  id: EntityId;
  kind: string;
  duration: number;
}
enemy_stunned: {
  id: EntityId;
  duration: number;
}
```

`entity_spawned` (`kind: 'assaulter'`) emitowane przy tworzeniu.

## Kryteria akceptacji

- [ ] Vitest: Szturmowiec zbliża się do gracza i atakuje w zasięgu po czasie telegrafu
- [ ] Vitest: trafienie ostatnim ciosem combo odrzuca i ogłusza
- [ ] Vitest: śmierć emituje `enemy_killed` raz
- [ ] Vitest: schemat zod odrzuca niepoprawne dane wroga
- [ ] Scena `?scene=enemy-test` z komendą debug `spawn assaulter`
- [ ] Aktualizacja /docs/systems/enemies.md

## Poza zakresem

Strzelec i pociski (#09), koordynacja grupy i flankowanie (F2), bossowie, rozpad na odłamki (#12), pathfinding grafowy.
