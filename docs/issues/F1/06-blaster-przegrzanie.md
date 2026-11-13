# [F1][Bronie] Blaster z przegrzaniem i pociski z poolingiem

Agent: Bronie
Folder: /src/combat/weapons
Zależy od: #01 (model obrażeń), #02 (kontroler FPP)
Filar: Build-crafting

## Cel

Pierwsza broń strzelecka: blaster, w którym zamiast amunicji działa pasek ciepła, plus wspólny system pocisków używany także przez wrogów.

## Wymagania

- Definicja blastera w pliku danych `src/data/weapons/blaster.json` walidowana zod (obrażenia, szybkostrzelność, ciepło na strzał, prędkość pocisku).
- **Ciepło:** pasek 0 → `heatCapacity` (stat); spadek z `coolingRate`; przegrzanie = blokada 1,5 s (`tuning.weapons.overheatLockS`).
- **Aktywne chłodzenie** (opcjonalnie w tym zadaniu): wciśnięcie `shoot` w idealnym oknie podczas blokady skraca ją (okno w `tuning`); jeśli zbyt duże, odłożyć do F2 i zapisać w backlogu.
- **Pociski** w puli (max z `tuning`): pozycja, prędkość, właściciel, `damage`, `tags`; kolizja z grupami `PlayerProjectile` / `EnemyProjectile`; pociski mają zmieniać właściciela (potrzebne do parowania, #10).
- Wspólny `ProjectileSystem` z API do spawnu pocisków wroga (używa AI Strzelec, #09).
- Trafienie przez `applyDamage` z #01; losowość tylko przez `Rng`.
- Bez `Math.random()` i bez ref do Three.js w stanie symulacji.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

```ts
weapon_fired: {
  weapon: string;
  owner: EntityId;
}
heat_changed: {
  id: EntityId;
  value: number;
  max: number;
  overheated: boolean;
}
projectile_spawned: {
  id: EntityId;
  owner: EntityId;
  speed: number;
}
projectile_reflected: {
  id: EntityId;
  newOwner: EntityId;
}
```

`projectile_reflected` jest emitowane przez ProjectileSystem na prośbę parowania (#10).

## Kryteria akceptacji

- [ ] Vitest: ciepło rośnie przy strzale, spada po czasie, przegrzanie blokuje strzał na 1,5 s
- [ ] Vitest: pociski wracają do puli po trafieniu lub czasie życia
- [ ] Vitest: pocisk zadaje obrażenia raz i emituje `damage_dealt`
- [ ] Vitest: zmiana właściciela pocisku zmienia warstwę kolizji
- [ ] Scena `?scene=blaster-test` z manekinami i paskiem ciepła w debug
- [ ] Aktualizacja /docs/systems/weapons.md

## Poza zakresem

Inne typy broni i moduły (F2), animacje i model broni, rysowanie HUD (#15).
