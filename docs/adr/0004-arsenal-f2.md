# ADR 0004 — Architektura arsenału (F2)

Status: **propozycja Architekta — do akceptacji razem z bramką F1** (F2 startuje dopiero po playteście F1)
Data: 2026-11-14

F2 mnoży zawartość: 6 broni, 6–8 mocy, warianty ostrza, 5–6 archetypów wrogów, statusy, synergie. Zasada nadrzędna z `AGENTS.md`: **nowy wariant = nowy plik danych, nowe zachowanie = nowy kod tylko raz**. Poniższe decyzje ustalają, gdzie przebiega ta granica.

## 1. Bronie: tryby strzału w kodzie, liczby w danych

`src/data/weapons/*.json` (zod) z polem `fireMode`. Tryb to kod (`src/combat/weapons/fireModes/`), broń to dane.

| `fireMode`   | Zachowanie                                          | Bronie                                        |
| ------------ | --------------------------------------------------- | --------------------------------------------- |
| `projectile` | pocisk z puli (istnieje — blaster)                  | pistolet, karabin (`fireRateHz`, `automatic`) |
| `spread`     | N pocisków w stożku                                 | rozpraszacz (`pellets`, `spreadDeg`)          |
| `pierce`     | pocisk przebija do N celów, maleje obrażenie        | snajperka (`pierceCount`, `pierceFalloff`)    |
| `beam`       | ciągły promień (raycast co krok), ciepło na sekundę | ciągły laser (`dps`, `heatPerS`, `rangeM`)    |
| `lob`        | pocisk balistyczny + wybuch w promieniu             | granat EMP (`gravity`, `radiusM`, `statuses`) |

Wspólne: przegrzanie (`ResourcePool`, jak blaster), moduły broni (F3/F4) jako `StatModifier` + tagi. **Ekwipunek:** `Loadout { blade, weapon, powers[2] }`; przełączanie broni klawiszami 1–3 tylko w poligonie/arenie wyboru, w runie — znalezione bronie (F3).

## 2. Moce: jeden interfejs i rejestr

```ts
interface Power {
  readonly def: PowerDefinition; // dane: koszt, odnowienie, parametry
  step(dt: number, input: PowerInput): void;
  reset(): void;
}
type PowerFactory = (def, deps: PowerDeps) => Power; // rejestr po def.kind
```

`ResonancePush` zostaje przepisane do tego interfejsu (bez zmiany zachowania). Dwa sloty: **F** i **E** (`power`, `power2` w `inputBindings.json`). Koszt i odmowa (`power_denied`) obsługuje wspólna baza, nie każda moc osobno.

| Moc              | Mechanizm (nowy kod)                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Pchnięcie        | istnieje                                                                                                |
| Fala uderzeniowa | to samo co Pchnięcie z kątem 360° — **tylko dane** (`kind: 'cone'`)                                     |
| Błyskawica       | łańcuch najbliższych celów w zasięgu, status `overload`                                                 |
| Chwyt i rzut     | trzymanie obiektu interaktywnego / lekkiego wroga przed kamerą, rzut = pocisk fizyczny z obrażeniem     |
| Bariera          | `ProjectileSystem.addInterceptor` przez `durationS` — odbija wszystko z przodu (jak parowanie bez okna) |
| Skupienie        | patrz pkt 4                                                                                             |

## 3. Statusy przez obrażenia

`DamageInfo.statuses?: readonly StatusApplication[]` (`{ id, durationS, stacks? }`) → przenoszone w `damage_dealt.statuses` → `StatusSystem` (nowy, `src/combat/status/`) je nakłada. Definicje w `src/data/statuses/*.json`:

| Status     | Efekt                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `burning`  | obrażenia co 0,5 s (`#fire`), zanikanie                                                                               |
| `overload` | +25% otrzymywanych obrażeń (`StatModifier` na `damageTaken`); przy 3 stosach — ogłuszenie i wyładowanie na pobliskich |
| `stunned`  | wróg nie atakuje (dziś `enemy_stunned` z ciężkiego ciosu — przenosimy do statusu)                                     |

Obrażenia ze statusów idą zwykłą drogą `DamageSystem.deal` (źródło = nakładający, tag statusu) — feedback, synergie i statystyki działają bez wyjątków.

## 4. Skupienie: osobna skala czasu gracza

„Spowolnienie czasu na 3 s” ma spowolnić **świat**, nie gracza. Decyzja: `FeelSystem` dostaje `playerTimeScale` (domyślnie 1). Sceny krokują gracza (`PlayerController`, ostrze, broń, moce) z `dtPlayer = dtSim / worldScale × playerTimeScale` i ograniczeniem do `SIM_DT × 2` (stabilność fizyki), a wrogów i pociski zwykłym `dtSim`. Hitstop (dt = 0) zatrzymuje oba. Zdarzenie `focus` (`{ worldScale, durationS }`) obsługuje `FeelSystem`, kumulując się z `slowmo` jak dziś (mocniejsze wygrywa).

Konsekwencja: `Scene.step(dt, input)` dostaje drugi czas przez `GameContext` (`ctx.feel.playerDt(dt)`), a nie nowy argument — istniejące sceny działają bez zmian.

## 5. Synergie na tagach (dane)

`src/data/synergies/*.json`: `{ when: { event, tagsAny, ... }, requires: [loadout/implant tags], effect: { kind, ... } }`, wykonawca `SynergySystem` (słucha zdarzeń jak `AudioSystem`). Efekty: `add_energy`, `cool_weapon`, `stat_modifier_timed`, `chain_on_hit`. Trzy hybrydy ze specyfikacji (Pistolero Rezonansu, Tancerz ostrzy, Burzowy strzelec) to **tylko dane** na tych efektach. Implanty F3 będą dodawać tagi do `requires`.

## 6. AI: tokeny ataku i sloty flankowania

`EnemyDirector` (w `src/enemies/`): ograniczona liczba jednoczesnych ataków wręcz (`attackTokens`, np. 2) i dystansowych (`shotTokens`) — reszta krąży/zajmuje sloty wokół gracza (flankowanie: sloty po kątach, przypisanie najbliższe wolne). Ostrzał zaporowy = Strzelcy dostają `shotTokens` naprzemiennie. Archetypy F2: Snajper (laser celujący, długi telegraf), Tarczownik (hurtbox tarczy z przodu: `multiplier 0` + tag blokujący; flank / ciężki / Chwyt), Dron (lot bez character controllera, kinematyka 3D, mało HP), Egzekutor (elita: własny `PlasmaBlade`, paruje ciosy gracza).

## 7. Balans: symulacja TTK z danych

Skrypt `npm run balance` (node, bez renderu): dla każdej broni/mocy × wroga liczy TTK z danych (szybkostrzelność, ciepło, obrażenia, mnożniki, statusy), zapisuje `docs/balance.md`. Test pilnuje, żeby żadna ścieżka nie odstawała o > 2× od mediany.

## Konsekwencje dla kontraktów (`docs/api.md`, dopisać przy starcie F2)

- `DamageInfo.statuses`, `damage_dealt.statuses`; zdarzenia `status_applied`, `status_expired`, `focus`.
- `Power`, `PowerRegistry`, `WeaponDefinition.fireMode`, `Loadout`.
- `GameContext.feel` (lub `playerDt`) — skala czasu gracza.
- Akcje wejścia `power2`, `weapon1..3`.
