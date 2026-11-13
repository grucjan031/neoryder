# [F1][Ruch i kamera] Dash i slide

Agent: Ruch i kamera
Folder: /src/player
Zależy od: #02 (kontroler FPP)
Filar: Walka, która „czuje się” świetnie

## Cel

Dwa szybkie ruchy unikowe: dash (Q) i slide (Ctrl w biegu), które pozwalają wymijać pociski i skracać dystans do wrogów.

## Wymagania

- **Dash:** krótki doskok w kierunku wejścia (domyślnie do przodu), odnowienie i czas trwania w `tuning.player` (propozycje: 0,18 s, odnowienie 1,2 s, 1 ładunek), możliwość w powietrzu.
- Podczas dashu opcjonalne krótkie okno nietykalności (flaga w `tuning`, domyślnie wyłączone).
- **Slide:** `crouch` podczas sprintu na ziemi, zachowuje pęd, wygasa po spadku prędkości, niższa kapsuła; wyjście przez skok (slide-jump).
- Dash resetuje się zgodnie z modyfikatorami `Stats` (hybryda „Tancerz ostrzy” skraca odnowienie w przyszłości — przewidzieć stat lub `StatModifier` bez zmiany kodu; nowy `StatId` zgłosić Architektowi).
- Zdarzenia z sekcji Kontrakt; wejście tylko przez `InputSnapshot`.
- Wszystkie liczby w `tuning.ts`.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

```ts
dash_used: {
  user: EntityId;
  dir: {
    x: number;
    y: number;
    z: number;
  }
}
slide_started: {
  user: EntityId;
}
slide_ended: {
  user: EntityId;
}
```

## Kryteria akceptacji

- [ ] Vitest: dash przesuwa gracza o oczekiwany dystans w czasie z `tuning`
- [ ] Vitest: odnowienie dashu blokuje kolejny dash do końca cooldownu
- [ ] Vitest: slide wymaga sprintu na ziemi, kończy się przy małej prędkości
- [ ] Vitest: dash nie przechodzi przez ściany (character controller)
- [ ] Scena `?scene=player-test` z torem przeszkód do testu dashu i slide
- [ ] Aktualizacja /docs/systems/movement.md

## Poza zakresem

Dash-cięcie z atakiem (F2), wspinaczka i ruch po ścianach (backlog), efekty VFX (szum prędkości).
