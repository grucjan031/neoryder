# [F1][Architekt] Hitstop i spowolnienie przy ostatnim zabójstwie w fali

Agent: Architekt
Folder: /src/core
Zależy od: #01 (zdarzenie `damage_dealt`, `enemy_killed`)
Filar: Walka, która „czuje się” świetnie

## Cel

Centralny moduł „feel czasu”: hitstop 40–80 ms przy trafieniach i spowolnienie czasu 0,3 s po zabiciu ostatniego wroga fali.

## Wymagania

- Moduł `feel` w `src/core/` słucha zdarzeń i steruje `GameLoop.hitstop(ms)` i `timeScale`.
- Hitstop: lekki trafienie 40 ms, ciężkie i zabójstwo 80 ms (`tuning.time.hitstopLightMs`, `hitstopHeavyMs`); kumulacja jako max (zgodnie z pętlą).
- Zdarzenie `hitstop { ms }` (istnieje) wyzwala ten sam mechanizm; moduł nie duplikuje wywołań dla jednego trafienia.
- Spowolnienie: po `wave_last_kill` `timeScale = tuning.time.lastKillTimeScale` (0,2) przez `tuning.time.lastKillSlowmoS` (0,3 s), z płynnym powrotem do 1.
- Hitstop ignorowany podczas pauzy; `timeScale` przywracany przy zmianie sceny.
- Wartości w `tuning.time` widoczne w lil-gui.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

```ts
wave_last_kill: {
  wave: number;
  id: EntityId;
} // emituje arena (#16)
```

## Kryteria akceptacji

- [ ] Vitest (z `GameLoop.advance`): trafienie lekkie zamraża symulację na 40 ms, zabójstwo na 80 ms
- [ ] Vitest: dwa trafienia w jednym kroku dają max, nie sumę
- [ ] Vitest: `wave_last_kill` ustawia `timeScale` na 0,2 na 0,3 s, potem 1
- [ ] Vitest: scena dispose przywraca `timeScale` 1
- [ ] Komenda debug `emit wave_last_kill` w scenie testowej `?scene=feel-test`
- [ ] Aktualizacja /docs/systems/core.md lub /docs/systems/feel.md (nowy plik)

## Poza zakresem

Wstrząs kamery (#03), efekty VFX i dźwięk, moc Skupienie (spowolnienie czasu na życzenie gracza, F2).
