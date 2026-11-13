# ADR 0003 — Kontrakty fazy F1

Status: **zaakceptowany, scalony z `docs/api.md`**
Data: 2026-11-14

Zebrane z sekcji „Kontrakt” w `docs/issues/F1/*.md` i ujednolicone. Tam, gdzie zadanie proponowało coś innego, obowiązuje ten dokument.

## Decyzje

1. **Jedno zdarzenie trafienia.** Proponowane `entity_hit` (#01) i istniejące `damage_dealt` opisują to samo. Zostaje `damage_dealt` z rozszerzonym payloadem (punkt, kierunek, `killed`). VFX, audio i kamera czytają z niego punkt i kierunek ciosu.
2. **Wspólny typ wektora** `Vec3 = { x; y; z }` w `src/core/math.ts` — zwykły obiekt, serializowalny, bez Three.js w symulacji.
3. **Drużyny.** `Team = 'player' | 'enemy' | 'neutral'`. Obrażenia między członkami tej samej drużyny są ignorowane (wyjątek: tag `#friendly_fire`). Parowanie zmienia drużynę pocisku.
4. **Jeden typ zasobu.** Energia (#11) i ciepło (#06) to `ResourcePool` z `src/core/resource.ts`. Nie ma osobnych `EnergyPool`/`HeatPool`. Max i regeneracja pochodzą ze `Stats` (`maxEnergy`, `energyRegen`, `heatCapacity`, `coolingRate`).
5. **Czasem rządzi jeden system.** `src/core/feel.ts` (zadanie #13) słucha zdarzeń `hitstop`, `slowmo`, `wave_last_kill` i jako jedyny woła `loop.hitstop()` i zmienia `loop.timeScale`. Inne moduły tylko emitują zdarzenia.
6. **Wstrząs kamery jako zdarzenie.** `camera_shake` emitują systemy walki; siłę skaluje kamera (#03) według `tuning.camera`. Kamera nie liczy obrażeń sama.
7. **Encje i kolizje.** `EntityRegistry` w `src/core/entities.ts` przydziela `EntityId` i mapuje uchwyt collidera Rapier → `EntityId`. Hurtboxy to collidery Rapier w grupach z `CollisionGroup`; trafienia wręcz liczy się zapytaniami kształtem (shape cast / intersections), pociski — sweepem promieniem w każdym kroku. Bez osobnej fizyki hitboxów.
8. **Konsola debug rozszerzalna.** Moduły rejestrują komendy przez `registerCommand`; konsola nie zna modułów.

## Kontrakty

Typy i zdarzenia przeniesiono do `docs/api.md` (sekcja „Kontrakty F1”).

## Konsekwencje dla zadań F1

- #01 implementuje `DamageSystem`, `Health`, `EntityRegistry`, `Vec3`, `ResourcePool` (wszystko Architekt).
- #06 i #11 nie implementują własnych pul zasobów — używają `ResourcePool`.
- #10 woła `ProjectileSystem.reflect`, nie zmienia pocisku bezpośrednio.
- #13 jest właścicielem `src/core/feel.ts`.
- #14 nasłuchuje `damage_dealt` zamiast `entity_hit`.
