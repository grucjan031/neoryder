# [F1][Walka wręcz] Ostrze plazmowe: combo, ciężki atak, blok

Agent: Walka wręcz
Folder: /src/combat/melee
Zależy od: #01 (model obrażeń), #02 (kontroler FPP)
Filar: Walka, która „czuje się” świetnie

## Cel

Ostrze plazmowe z 3-hitowym combo, ciężkim atakiem i blokiem — rdzeń ścieżki Ostrze.

## Wymagania

- Definicja w `src/data/weapons/plasmaBlade.json` (zod): 25 / 25 / 40 obrażeń w combo, ostatni cios z odrzutem; ciężki atak 80 obrażeń, 0,6 s ładowania, przebija blok; blok −70% obrażeń zużywający energię.
- Maszyna stanów: bezczynność → cios 1 → 2 → 3 (okno kontynuacji combo w `tuning.melee`), ciężki atak po przytrzymaniu `attack`, blok po przytrzymaniu `block`.
- Hitbox łuku cięcia sprawdzany w kroku symulacji; jedno trafienie na cel na cios.
- Feedback (3 warstwy): hitstop 40 ms lekki / 80 ms ciężki przez `tuning.time`, wstrząs kamery skalowany obrażeniami, hook dla VFX i dźwięku przez zdarzenia (bez bezpośrednich wywołań).
- Energia przez `Stats` (`maxEnergy`); pasek energii zasilany przez zadanie #11 — tu tylko zużycie bloku przez interfejs `ResourcePool` (do uzgodnienia z Moce przez api.md).
- Bufor inputu ataku (120 ms) tak jak skoku.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

```ts
melee_swing: {
  attacker: EntityId;
  stage: 1 | 2 | 3 | 'heavy';
}
melee_blocked: {
  defender: EntityId;
  attacker: EntityId | null;
  amount: number;
}
hitstop: {
  ms: number;
} // istnieje, używane tutaj
```

Interfejs `ResourcePool { current; spend(n): boolean; add(n): void }` zgłosić do api.md; implementuje #11.

## Kryteria akceptacji

- [ ] Vitest: combo 1→2→3 w oknie, reset poza oknem
- [ ] Vitest: obrażenia 25 / 25 / 40 i 80 dla ciężkiego z `tuning`/danych
- [ ] Vitest: blok redukuje obrażenia o 70% i zużywa energię; ciężki atak przebija blok
- [ ] Vitest: hitstop 40 ms dla lekkiego i 80 ms dla ciężkiego (emisja `hitstop`)
- [ ] Scena `?scene=melee-test` z manekinami i hitboxami w debug
- [ ] Aktualizacja /docs/systems/melee.md

## Poza zakresem

Parowanie pocisków (#10), parowanie ataków wręcz (osobne issue po F1), rzut ostrzem i dash-cięcie (F2), warianty ostrzy.
