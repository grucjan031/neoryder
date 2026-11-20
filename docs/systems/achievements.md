# Naszywki Iskry — osiągnięcia (S4b-01)

Powód do kolejnego runu (filar 3) i do grania każdą ścieżką (filar 2). Osiągnięcia to **naszywki** cząstki Iskra: pamiątki z runów, z jednorazową nagrodą w Danych lub Rdzeniach. Naszywka **pozwala kupić** rzadkie odblokowanie w warsztacie, ale go nie daje, więc balans waluty F4 zostaje.

Kod: `src/progression/achievementsSchema.ts` (schemat, dane), `achievements.ts` (reguły, postęp z podsumowania), `achievementTracker.ts` (liczenie w runie), `meta.ts` (`applyRun`, `buyUnlock`). UI: `src/ui/hub/achievementsPanel.ts`, `src/ui/achievementToast.ts`, `src/ui/achievementIcons.ts`, teksty `src/data/ui/achievements.pl.json`.

## Dane

`src/data/meta/achievements.json` (26 pozycji), walidacja zod przy ładowaniu:

```ts
{ id, title, description, hint,
  category: 'walka' | 'sciezki' | 'misje' | 'progres',
  kind: 'counter' | 'flag',
  counter?: string; target?: number,   // tylko dla kind: 'counter'
  reward: { data?: number; cores?: number },   // co najmniej jedna waluta > 0
  icon: string }                        // klucz z zestawu w achievementIcons.ts
```

Liczniki (`counter`) to zamknięty zbiór `ACHIEVEMENT_COUNTERS`: `parry_success`, `execute_performed`, `synergy_triggered`, `dash_used`, `kills_melee`, `kills_power`, `kills_gun`, `runs_ended`, `victories`. Flagi mają id równe id osiągnięcia. Progi zdarzeń, których dane nie wyrażają (seria 5 zabójstw w 2 s, 80% udziału ścieżki, Poziom zagrożenia 3, poziom postaci 10, mapowanie misji, rodzaj bossa), to `ACHIEVEMENT_RULES` w `achievements.ts`.

Ikony to proste kontury SVG rysowane `currentColor`; paleta tylko bursztyn `#ffae1a`, ciepła biel `#fff1d6`, zieleń `#6dff4a` (bez cyanu, czerwieni i magenty, ADR 0006).

## Stan w metazapisie

`MetaState.achievements: { unlocked: string[]; counters: Record<string, number> }`. `SAVE_VERSION` 4 → 5. Migracja meta 4→5 dopisuje puste osiągnięcia (reszta zapisu nietknięta, v3 przechodzi przez v4); migracja runu 4→5 to tożsamość. `RunSummary.achievements?` (opcjonalne, także w `runEndedSchema`) niesie przyrosty runu, więc przeżywa odświeżenie strony w stanie „zakończony, nierozliczony”.

## Liczenie

1. **W trakcie runu** `AchievementTracker` (tworzony przez `RunScene`, subskrybuje `EventBus`) zbiera przyrosty liczników i flagi. Liczy tylko akcje gracza i tylko w aktywnym runie (`manager.active`); areny testowe i poligon go nie mają, więc nic nie liczą.
   - `parry_success` (parujący = gracz; odbity pocisk i sparowany cios wręcz), `execute_performed` (atakujący = gracz), `synergy_triggered`, `dash_used`.
   - **Zabójstwa wg źródła:** `enemy_killed` nie niesie typu obrażeń, więc tracker zapamiętuje kategorię (`#melee` / `#power` / `#gun`) ostatniego `damage_dealt` gracza na danym wrogu i przypisuje jej zabójstwo (`kills_melee` | `kills_power` | `kills_gun`). Obrażenia bez tych tagów (statusy, wybuchy) nie nadpisują kategorii.
   - Flagi: `pierwsza-krew`, `seria` (5 zabójstw w oknie 2 s czasu symulacji, `manager.state.elapsedS`), `bez-zadrasniecia` (`room_cleared` elity bez `damage_dealt` na graczu od `room_entered`), `trzy-punkty` (`conquest_captured`: A, B i C gracza naraz), `upadek-brandta` (zabity `securityChief`).
   - Przekroczenie progu względem stanu meta z początku runu emituje `achievement_earned { id }` (raz na osiągnięcie): komunikat w HUD „Naszywka: <tytuł>” przez 3 s w lewym górnym rogu. Nagroda wpływa dopiero przy rozliczeniu.
2. **Przy końcu runu** `RunScene` dokleja do podsumowania `achievements = tracker.tracked` (tylko przyrosty ze zdarzeń; zapis akceptuje wyłącznie znane liczniki ≤ 10 000 i flagi zdarzeniowe). Postęp wynikający z podsumowania (`summaryProgress`) liczy sam `MetaManager.applyRun`: `runs_ended`, `victories`, `pierwsze-zwyciestwo`, `zagrozenie-3`, `pelna-kontrola`, misje (`cisza-w-niecce`, `list-w-reku`, `ja-tylko-dowoze` po id misji; `m06-odlewnia` zadziała, gdy misja trafi do main) i `droga-*` (≥ 80% obrażeń z `summary.damage` w jednej kategorii, zwycięski run). Kolejność rozliczania w `RunScene.settle` bez zmian.
3. **`MetaManager.applyRun`** dolicza postęp z podsumowania i przyrosty trackera razem z nagrodami runu. Idempotencję zapewnia `appliedRunIds`: ponowienie zapisu lub odświeżenie nie dubluje liczników ani nagród. Przekroczenie progu → `unlocked` + jednorazowa nagroda dodana do `data` / `cores` (poza `rewards` runu, które zostają bez zmian; `ApplyRunResult.achievements` wylicza nowe naszywki dla podsumowania). Postęp liczy się także przy porażce. Podsumowanie bez pola `achievements` (stare zapisy, symulacja balansu) niczego nie dolicza. Nieznane liczniki są ignorowane.
4. **Poza runem** (w `MetaManager`): `pierwszy-zakup` przy udanym `buyUnlock`, `poziom-10` przy rozliczeniu runu i w `debugAddXp`. `selectThreat` nie ma własnego osiągnięcia.

## Bramkowanie zakupów

`unlocks.json` ma opcjonalne `requiresAchievement`. `MetaManager.buyUnlock` odrzuca zakup bez naszywki (komunikat „Wymagana naszywka: <tytuł>.”), a warsztat pokazuje kłódkę z nazwą wymaganej naszywki zamiast przycisku. Bramkowane są tylko rzadkie odblokowania za Rdzenie:

| Odblokowanie | Naszywka |
| --- | --- |
| `blade:staffBlade` | `taniec-ostrza` (150 zabójstw ostrzem) |
| `power:focus` | `glos-rezonansu` (120 zabójstw mocą) |
| `module:superconductor` | `reka-strzelca` (200 zabójstw bronią) |
| `slot:weapon3` | `weteran-hut` (5 zwycięstw) |

Każdą z tych naszywek da się zdobyć z wyposażeniem startowym (ostrze plazmowe, Pchnięcie, Blaster), czyli bez przedmiotu, który odblokowuje; pilnuje tego test na danych.

### Wpływ na symulację balansu F4

Symulacja `metaSim` nie ma osiągnięć, więc zachłanny gracz modelowy nie kupi bramkowanych pozycji i nie dostanie nagrody za pierwszy zakup (+10 Danych). Wynik bramki F4 zostaje: **poziom 7, 4 zakupy** (wcześniej `module:superconductor`, `power:grab`, `weapon:rifle`, `power:shockwave`; teraz `power:grab`, `weapon:rifle`, `slot:power2`, `power:shockwave`). `docs/balance.md` jest odświeżony.

## Panel w kryjówce

Zakładka **„Naszywki Iskry”** w terminalu drzewek (`talents`): to miejsce trwałej progresji postaci, a tablica misji ma już sektor, zagrożenie i briefingi. Zakładki mają role `tablist`/`tab`/`tabpanel`, strzałki Lewo/Prawo przełączają. Panel to siatka kart pogrupowana w cztery kategorie; zdobyte mają bursztynową ramkę i jasną ikonę, brakujące są szare z `hint`, paskiem postępu licznika (`role="progressbar"`) i napisem „x / cel”. Karta bramkująca pokazuje „Pozwala kupić: <przedmiot>”. Karty są fokusowalne (roving tabindex: strzałki, Home, End).

Podsumowanie runu pokazuje sekcję „Nowe naszywki Iskry” z nagrodami.

## Debug

- Komenda `achievement grant <id>`: oznacza naszywkę jako zdobytą (bez nagrody i bez sprawdzania warunku), zapisuje meta.
- `query('achievements')` (run i kryjówka): stan meta `{ unlocked, counters }`; `query('runAchievements')` (run): przyrosty z bieżącego runu.

## Znane ograniczenia

- Przyrosty trackera trafiają do `RunState.achievementProgress` przy każdym zapisie mapy i wracają przy `continue=1`; zdarzenia w trakcie pokoju (przed ukończeniem) giną przy odświeżeniu pokoju.
- Nagrody walutowe naszywek „automatycznych” (`pierwsza-krew`, `pierwsze-zwyciestwo`, `pierwszy-zakup`) to `{}`: sama naszywka, bo inaczej symulacja F4 wychodzi poza bramkę (5 zakupów). `metaSim` uwzględnia naszywki typowego gracza (podsumowaniowe + `pierwsza-krew`).
- `conquest_captured` niesie `owner` (także `neutral`) i migawkę `owners` wszystkich punktów; `trzy-punkty` wymaga 3× `player` w migawce.
- Migracja meta 4→5 zasila `victories` i `runs_ended` ze `stats` i odblokowuje przekroczone progi (także `poziom-10`, `pierwszy-zakup`) bez nagród walutowych. `metaStateSchema` czyta uszkodzone `achievements` jako puste, bez unieważniania reszty meta. `MetaRunRecord.achievements` (id) pozwala pokazać naszywki w podsumowaniu po odświeżeniu.
