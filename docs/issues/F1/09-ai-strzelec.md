# [F1][AI wrogów] Archetyp Strzelec i wolne widoczne pociski

Agent: AI wrogów
Folder: /src/enemies
Zależy od: #06 (blaster i ProjectileSystem), #08 (Szturmowiec — rejestr i baza wroga)
Filar: Walka, która „czuje się” świetnie

## Cel

Wróg dystansowy ostrzeliwujący gracza wolnymi, wyraźnie widocznymi pociskami, które da się parować i unikać.

## Wymagania

- Definicja w `src/data/enemies/shooter.json` (zod): zdrowie, dystans preferowany, szybkostrzelność, prędkość pocisku, obrażenia.
- Zachowania: utrzymuje dystans (cofa się, gdy gracz blisko), strafe, strzał z telegrafem 0,4 s (laserowy znacznik/ błysk), przeładowanie.
- Pociski przez `ProjectileSystem` z #06: wolne (prędkość startowa w `tuning.enemies.shooterProjectileSpeed`, np. 10 m/s), duże i widoczne, właściciel = wróg, warstwa `EnemyProjectile`.
- Pocisk można odbić (zmiana właściciela, #10) i zadaje wtedy obrażenia strzelcowi.
- Celność z rozrzutem losowanym z `Rng`; brak strzału bez linii widzenia (raycast Rapier).
- Rejestracja w `enemyRegistry`.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

Nowe zdarzenia nie są potrzebne poza już zdefiniowanymi `enemy_telegraph` (#08) i `projectile_spawned` (#06). API: `ProjectileSystem.spawnEnemyProjectile(owner, origin, dir, speed, damage)` — zgłosić do api.md razem z #06.

## Kryteria akceptacji

- [ ] Vitest: strzelec utrzymuje dystans w zakresie z danych
- [ ] Vitest: pocisk leci z zadaną, niską prędkością i zadaje obrażenia graczowi
- [ ] Vitest: brak strzału bez linii widzenia
- [ ] Vitest: odbity pocisk rani strzelca (test integracyjny z #06)
- [ ] Scena `?scene=enemy-test` z komendą `spawn shooter`
- [ ] Aktualizacja /docs/systems/enemies.md

## Poza zakresem

Snajper, Dron, Tarczownik (F2), ostrzał zaporowy i koordynacja grupy (F2), parowanie (to robi #10), efekty rozpadu (#12).
