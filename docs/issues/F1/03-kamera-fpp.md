# [F1][Ruch i kamera] Kamera FPP: FOV i wstrząs

Agent: Ruch i kamera
Folder: /src/player
Zależy od: #02 (kontroler FPP)
Filar: Walka, która „czuje się” świetnie

## Cel

Kamera pierwszoosobowa z regulowanym FOV i systemem wstrząsów skalowanych siłą trafień, dającym warstwę „kamera/kontroler” feedbacku.

## Wymagania

- Kamera podąża za kapsułą (wysokość oczu w `tuning.ts`), interpolacja w `render(alpha)`.
- FOV z `tuning.camera.fov` (domyślnie 90) i z `Settings.fov`; krótki „kick” FOV przy sprincie (do strojenia).
- Wstrząs: tłumiony szum (translacja i rotacja), amplituda ≤ `tuning.camera.shakeMax` (0,4), intensywność skalowana obrażeniami.
- Wstrząs wyzwalany zdarzeniem `damage_dealt` (gdy cel to gracz lub cios gracza) i `camera_shake`; lekkie kołysanie przy bieganiu (do wyłączenia).
- Wstrząs działa także podczas hitstopu (render niezależny od `dt = 0`).
- Wszystkie liczby w `tuning.camera`, widoczne w lil-gui.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

```ts
camera_shake: { intensity: number; duration: number; dir?: { x: number; y: number; z: number } }
```

Zależność od `damage_dealt` (z #01) jest opcjonalna: kamera działa i bez niej przez `camera_shake`.

## Kryteria akceptacji

- [ ] Vitest: funkcja skalowania wstrząsu zwraca wartość w [0, `shakeMax`]
- [ ] Vitest: wstrząs wygasa do 0 po `duration`
- [ ] Vitest: FOV czytany na żywo z `tuning` (zmiana wartości zmienia wynik)
- [ ] Scena `?scene=player-test` ma komendę debug `shake <intensity>`
- [ ] Aktualizacja /docs/systems/movement.md (sekcja kamera)

## Poza zakresem

Przełącznik redukcji wstrząsu w ustawieniach (F7), animacje rąk i broni.
