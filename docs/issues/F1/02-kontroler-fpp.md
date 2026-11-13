# [F1][Ruch i kamera] Kontroler FPP na character controllerze Rapier

Agent: Ruch i kamera
Folder: /src/player, /src/physics
Zależy od: — (tylko F0: pętla, Input, Rapier)
Filar: Walka, która „czuje się” świetnie

## Cel

Gracz biega po arenie w widoku FPP z responsywnym, wybaczającym sterowaniem, które daje się dostroić z panelu lil-gui.

## Wymagania

- Character controller Rapier (`KinematicCharacterController`) z kapsułą gracza w grupie `CollisionGroup.Player`.
- Ruch WASD względem kierunku patrzenia, bieg i sprint (`sprint`), skok oraz **podwójny skok**.
- **Coyote time** (domyślnie 100 ms) i **bufor inputu skoku** (domyślnie 120 ms) — wartości w `tuning.ts` w sekcji `player`.
- Przyspieszenie i hamowanie, kontrola w powietrzu, grawitacja z `tuning.physics.gravity`.
- Obrót myszą (`lookDelta`), limit pitchu, czułość z `Settings.mouseSensitivity`.
- Wejście tylko przez `InputSnapshot`; pointer lock i pauza obsługiwane przez `src/core/input/`.
- Kroki w `step()` ze stałym `SIM_DT`; pozycja zapamiętana do interpolacji w `render(alpha)`.
- Stan gracza serializowalny; bez `three` w logice ruchu.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

```ts
player_jumped: {
  id: EntityId;
  double: boolean;
}
player_landed: {
  id: EntityId;
  speed: number;
}
```

Kamera i audio używają ich do efektów lądowania.

## Kryteria akceptacji

- [ ] Vitest: skok w oknie coyote time działa, poza oknem nie
- [ ] Vitest: bufor skoku — wciśnięcie tuż przed lądowaniem daje skok po lądowaniu
- [ ] Vitest: podwójny skok działa raz na lot, reset po lądowaniu
- [ ] Vitest: sprint zwiększa prędkość o mnożnik z `tuning.ts`
- [ ] Scena debug `?scene=player-test` (podłoga, schody, platformy) w podglądzie PR
- [ ] Wartości ruchu widoczne w panelu lil-gui
- [ ] Aktualizacja /docs/systems/movement.md

## Poza zakresem

Dash i slide (#04), kamera i FOV (#03), wspinaczka i bieg po ścianach (backlog).
