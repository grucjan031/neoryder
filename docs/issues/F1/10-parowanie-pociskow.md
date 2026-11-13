# [F1][Walka wręcz] Parowanie pocisków ostrzem

Agent: Walka wręcz
Folder: /src/combat/melee
Zależy od: #07 (ostrze plazmowe), #09 (Strzelec i wolne pociski)
Filar: Walka, która „czuje się” świetnie

## Cel

Gracz wciskający blok w oknie czasowym odbija pocisk w kierunku strzelca.

## Wymagania

- Okno parowania czytane z `tuning.ts` (domyślnie 150 ms), widoczne w panelu lil-gui.
- Parowanie = pocisk dochodzi do gracza w oknie liczonym od wciśnięcia `block` (bufor inputu opcjonalny, ustalany w `tuning`).
- Odbity pocisk zmienia właściciela na gracza (przez ProjectileSystem z #06) i leci do źródła (strzelca), z lekkim naprowadzaniem do strzelca w zasięgu.
- Poza oknem blok działa normalnie (−70% obrażeń, zużycie energii).
- Zdarzenie EventBus: `parry_success { projectile, attacker }` (istnieje); przy zdarzeniu energia +10 (`tuning.melee.parryEnergy`) przez `ResourcePool`.
- Feedback: hitstop 60 ms, błysk (hook VFX), dźwięk parry (hook audio #14), wstrząs kamery.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

Używa istniejących: `parry_success`, `hitstop`, `projectile_reflected` (zdefiniowane w #06), `damage_dealt`. Brak nowych zdarzeń.

## Kryteria akceptacji

- [ ] Vitest: parowanie w oknie 150 ms odbija, poza oknem nie
- [ ] Vitest: odbity pocisk zadaje obrażenia strzelcowi
- [ ] Vitest: udane parowanie dodaje energię i emituje `parry_success` raz
- [ ] Vitest: okno z `tuning` zmienia wynik (np. 50 ms vs 300 ms)
- [ ] Scena debug `?scene=parry-test` w podglądzie PR
- [ ] Aktualizacja /docs/systems/melee.md

## Poza zakresem

Parowanie ataków wręcz (osobne issue po bramce F1), Bariera odbijająca pociski (F2), synergie hybrydowe.
