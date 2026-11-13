# [F1][Architekt] Arena z falami wrogów i konsola debug (spawn)

Agent: Architekt
Folder: /src/scenes, /src/core (konsola debug)
Zależy od: #07 (ostrze), #08 (Szturmowiec), #09 (Strzelec), #11 (Pchnięcie), #12 (odłamki), #13 (hitstop i slowmo)
Filar: Walka, która „czuje się” świetnie

## Cel

Scena `?scene=arena`, w której grasz falami wrogów 15 minut i chcesz kolejną rundę; plus komendy debug do spawnu wrogów dla szybkiego strojenia.

## Wymagania

- Scena `arena` zarejestrowana w `src/scenes/index.ts`: zamknięta arena z osłonami, punkty spawnu, gracz z ostrzem, blasterem i Pchnięciem.
- Fale zdefiniowane w danych `src/data/waves/arena.json` (zod): skład (Szturmowiec / Strzelec), liczby, opóźnienia, rosnąca trudność przez 10+ fal.
- Spawn losowany przez `Rng` z seeda (`?seed=`) — ten sam seed daje ten sam przebieg.
- Przejście do następnej fali po wyczyszczeniu; po ostatnim wrogu fali emisja `wave_last_kill`; krótka przerwa i licznik fali.
- Śmierć gracza → ekran z przyciskiem „Jeszcze raz” (reset areny jednym klawiszem).
- **Konsola debug** (`window.__neoryder.command`): `spawn <typ> [n]`, `kill all`, `reset`, `wave <n>`, `god`, `hit <dmg>`; komendy rozszerzalne rejestrem.
- Limity: maks. wrogów na raz i liczba ciał Rapier z `tuning.ts`.
- Test wydajności: 30 wrogów jednocześnie nie obniża FPS poniżej progu.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

```ts
wave_started: {
  wave: number;
  count: number;
}
wave_cleared: {
  wave: number;
}
wave_last_kill: {
  wave: number;
  id: EntityId;
} // zdefiniowane w #13
```

Interfejs rejestru komend: `registerCommand(name: string, run: (args: string[]) => string): void`.

## Kryteria akceptacji

- [ ] Vitest: definicja fal przechodzi walidację zod, liczba wrogów rośnie między falami
- [ ] Vitest: ten sam seed daje ten sam skład i miejsca spawnu
- [ ] Vitest: wyczyszczenie fali emituje `wave_cleared`, ostatnie zabójstwo `wave_last_kill`
- [ ] Vitest: `spawn assaulter 3` zwraca potwierdzenie i tworzy 3 encje
- [ ] Playwright: wejście na `?scene=arena`, `spawn`, zabicie wrogów, następna fala startuje
- [ ] Scena pozwala sprawdzić zmianę w 30 sekund; opis PR z listą „feel” do ręcznego testu
- [ ] Aktualizacja /docs/systems/arena.md i /docs/systems/core.md (konsola)

## Poza zakresem

Generator sektorów i pokoje (F3), boss, nagrody i implanty, freeplay i mutatory (F6), ekran podsumowania runu.
