# Naszywki Iskry — osiągnięcia (S4b-01)

Powód do kolejnego runu (filar 3) i do grania każdą ścieżką (filar 2). Osiągnięcia to **naszywki** cząstki Iskra: pamiątki z runów, z jednorazową nagrodą w walucie lub przedmiotach. Niektóre naszywki dodatkowo otwierają zakupy w warsztacie.

Kod: `src/progression/achievementsSchema.ts` (schemat, dane), `achievements.ts` (reguły, postęp z podsumowania), `achievementTracker.ts` (liczenie w runie), `meta.ts` (`applyRun`, `buyUnlock`). UI: `src/ui/hub/achievementsPanel.ts`, `src/ui/achievementToast.ts`, `src/ui/achievementIcons.ts`, teksty `src/data/ui/achievements.pl.json`.

## Dane

`src/data/meta/achievements.json` (36 pozycje), walidacja zod przy ładowaniu (obiekt ścisły; id unikalne, format kebab-case):

```ts
{ id, title, description, hint,
  category: 'walka' | 'sciezki' | 'misje' | 'progres',
  kind: 'counter' | 'flag',
  counter?: string; target?: number,   // tylko dla kind: 'counter' (target całkowity >= 1)
  reward: { data?: number; cores?: number; unlocks?: string[] },   // liczby całkowite >= 0; {} = sama naszywka
  icon: string }                        // klucz z zestawu w achievementIcons.ts
```

`kind: 'counter'` wymaga `counter` i `target`; `kind: 'flag'` ich nie ma. Osiągnięcie-licznik jest spełnione, gdy łączny licznik meta >= `target`; osiągnięcie-flaga, gdy jego id znajdzie się wśród flag runu (lub flag nadawanych poza runem).

Liczniki (`counter`) to zamknięty zbiór `ACHIEVEMENT_COUNTERS`: `parry_success`, `execute_performed`, `synergy_triggered`, `dash_used`, `kills_melee`, `kills_power`, `kills_gun`, `runs_ended`, `victories`. Progi zdarzeń, których dane nie wyrażają, to `ACHIEVEMENT_RULES` w `achievements.ts`: seria 5 zabójstw w oknie 2 s, udział ścieżki 0,8, Poziom zagrożenia 3, poziom postaci 10, mapowanie misji (`m01-maszty` → `cisza-w-niecce`, `m03-list-przewozowy` → `list-w-reku`, `m06-odlewnia` → `ja-tylko-dowoze`), rodzaj bossa `securityChief`, punkty Podboju `A`, `B`, `C`.

### Nagrody przedmiotowe

`reward.unlocks` przyjmuje identyfikatory z `unlockIdSchema`. Przy rozliczeniu trafiają jednokrotnie do `meta.unlocks`. Wczytanie starszego profilu uzupełnia przedmioty za zdobyte naszywki bez ponownej wypłaty waluty.

| Naszywka       | Skin            |
| -------------- | --------------- |
| Bez zadrapania | Złoty chrom     |
| Zwierciadło    | Zwierciadło     |
| Upadek Brandta | Kurtyna Brandta |
| Weteran hut    | Żar hut         |

Dziesięć naszywek mistrzowskich ma kategorię „Walka”. Każda wymaga 150 zabójstw jedną bronią i daje 1 Rdzeń oraz jej własny skin „Wzorzec”. Liczniki `kills_blaster`, `kills_pistol`, `kills_rifle`, `kills_scatter`, `kills_sniper`, `kills_beam`, `kills_emp`, `kills_revolver` („Sześć komór”), `kills_smg` („Ulewa ołowiu”) i `kills_crossbow` („Cewka i bełt”) korzystają z broni gracza w chwili trafienia oznaczonego `#gun`. Zmiana broni między tym trafieniem a śmiercią celu zachowuje przypisanie.

### Pozostałe naszywki i ich nagrody walutowe

Nagrody: D = Dane, R = Rdzenie, „—” = sama naszywka.

| Kategoria | Id                    | Tytuł               | Warunek                                           | Nagroda | Ikona    |
| --------- | --------------------- | ------------------- | ------------------------------------------------- | ------- | -------- |
| walka     | `pierwsza-krew`       | Pierwsza krew       | flaga: pierwsze zabójstwo gracza w runie          | —       | spark    |
| walka     | `zwierciadlo`         | Zwierciadło         | `parry_success` >= 25                             | 20 D    | mirror   |
| walka     | `odbicie-mistrza`     | Odbicie mistrza     | `parry_success` >= 150                            | 1 R     | mirror   |
| walka     | `egzekutor`           | Egzekutor           | `execute_performed` >= 25                         | 25 D    | execute  |
| walka     | `seria`               | Seria               | flaga: 5 zabójstw w 2 s                           | 25 D    | chain    |
| walka     | `rezonator`           | Rezonator           | `synergy_triggered` >= 20                         | 20 D    | rings    |
| walka     | `akrobata`            | Akrobata            | `dash_used` >= 200                                | 15 D    | dash     |
| walka     | `bez-zadrasniecia`    | Bez zadrapania      | flaga: pokój elity ukończony bez obrażeń gracza   | 2 R     | aegis    |
| sciezki   | `taniec-ostrza`       | Taniec ostrza       | `kills_melee` >= 150                              | 30 D    | blade    |
| sciezki   | `glos-rezonansu`      | Głos Rezonansu      | `kills_power` >= 120                              | 30 D    | wave     |
| sciezki   | `reka-strzelca`       | Ręka strzelca       | `kills_gun` >= 200                                | 30 D    | gun      |
| sciezki   | `droga-ostrza`        | Droga ostrza        | flaga: zwycięstwo, >= 80% obrażeń z ostrza        | 2 R     | crown    |
| sciezki   | `droga-rezonansu`     | Droga Rezonansu     | flaga: zwycięstwo, >= 80% obrażeń z mocy          | 2 R     | crown    |
| sciezki   | `droga-strzelca`      | Droga strzelca      | flaga: zwycięstwo, >= 80% obrażeń z broni palnej  | 2 R     | crown    |
| misje     | `cisza-w-niecce`      | Cisza w Niecce      | flaga: ukończona misja `m01-maszty`               | 20 D    | antenna  |
| misje     | `list-w-reku`         | List w ręku         | flaga: ukończona misja `m03-list-przewozowy`      | 25 D    | letter   |
| misje     | `ja-tylko-dowoze`     | Ja tylko dowożę     | flaga: ukończona misja `m06-odlewnia`             | 2 R     | foundry  |
| misje     | `pelna-kontrola`      | Pełna kontrola      | flaga: zwycięstwo w trybie `conquest` (Przejęcie) | 25 D    | flag     |
| misje     | `trzy-punkty`         | Trzy punkty         | flaga: A, B i C gracza naraz w Przejęciu          | 1 R     | triad    |
| progres   | `pierwsze-zwyciestwo` | Pierwsze zwycięstwo | flaga: pierwsze zwycięstwo                        | —       | trophy   |
| progres   | `dziesiec-prob`       | Dziesięć prób       | `runs_ended` >= 10                                | 30 D    | repeat   |
| progres   | `upadek-brandta`      | Upadek Brandta      | flaga: zabity `securityChief`                     | 1 R     | target   |
| progres   | `zagrozenie-3`        | Zagrożenie 3        | flaga: zwycięstwo na Poziomie zagrożenia >= 3     | 2 R     | alert    |
| progres   | `weteran-hut`         | Weteran hut         | `victories` >= 5                                  | 1 R     | chevrons |
| progres   | `pierwszy-zakup`      | Pierwszy zakup      | flaga: pierwszy udany `buyUnlock`                 | —       | cart     |
| progres   | `poziom-10`           | Poziom 10           | flaga: poziom postaci >= 10                       | 2 R     | level    |

Ikony (23 klucze): `spark`, `mirror`, `execute`, `chain`, `rings`, `dash`, `aegis`, `blade`, `wave`, `gun`, `crown`, `antenna`, `letter`, `foundry`, `flag`, `triad`, `trophy`, `repeat`, `target`, `alert`, `chevrons`, `cart`, `level`. Ikony to proste kontury SVG rysowane `currentColor`; paleta tylko bursztyn `#ffae1a`, ciepła biel `#fff1d6`, zieleń `#6dff4a` (bez cyanu, czerwieni i magenty, ADR 0006).

## Stan w metazapisie

`MetaState.achievements: { unlocked: string[]; counters: Record<string, number> }`. Dodane w `SAVE_VERSION` 5 (obecnie 7). Migracja meta 4→5: jeśli pole `achievements` nie istnieje, jest zasilane z istniejącego zapisu (nie jest puste): `runs_ended` = `stats.runs`, `victories` = `stats.victories` (tylko gdy > 0); flagi `pierwsze-zwyciestwo` (`stats.victories` > 0), `pierwszy-zakup` (liczba odblokowań większa niż startowych) i `poziom-10` (poziom z `xp` >= 10); odblokowane zostają wszystkie osiągnięcia, których warunek jest już spełniony, **bez** nagród walutowych. Migracja runu 4→5 to tożsamość, 5→6 także. `metaStateSchema` czyta uszkodzone `achievements` jako puste, bez unieważniania reszty meta. `RunSummary.achievements?` (`{ counters, flags }`, także w `runEndedSchema`) niesie przyrosty runu, więc przeżywa odświeżenie strony w stanie „zakończony, nierozliczony”; schemat przyjmuje wyłącznie znane liczniki z wartością całkowitą 0..10 000 (`MAX_RUN_COUNTER`) i flagi zdarzeniowe (`pierwsza-krew`, `seria`, `bez-zadrasniecia`, `trzy-punkty`, `upadek-brandta`). `MetaRunRecord.achievements` (id) pozwala pokazać naszywki w podsumowaniu po odświeżeniu.

## Liczenie

1. **W trakcie runu** `AchievementTracker` (tworzony przez `RunScene`, subskrybuje `EventBus`) zbiera przyrosty liczników i flagi. Liczy tylko akcje gracza i tylko w aktywnym runie (`manager.active`); areny testowe i poligon go nie mają, więc nic nie liczą.
   - `parry_success` (`defender` = gracz; odbity pocisk i sparowany cios wręcz), `execute_performed` (`attacker` = gracz), `synergy_triggered` (`user` = gracz), `dash_used` (`user` = gracz).
   - **Zabójstwa wg źródła:** `enemy_killed` nie niesie typu obrażeń, więc tracker zapamiętuje kategorię (tag `#melee` / `#power` / `#gun`) ostatniego `damage_dealt` gracza (kwota > 0) na danym wrogu i przypisuje jej zabójstwo (`kills_melee` | `kills_power` | `kills_gun`). Obrażenia bez tych tagów (statusy, wybuchy) nie nadpisują kategorii; zabójstwo bez znanej kategorii nie zwiększa żadnego licznika `kills_*`, ale liczy się do flag. Tag w kolejności sprawdzania: `#melee`, `#power`, `#gun`.
   - Flagi: `pierwsza-krew` (dowolne zabójstwo gracza), `seria` (5 zabójstw gracza w oknie 2 s czasu symulacji, `manager.state.elapsedS`), `bez-zadrasniecia` (`room_cleared` typu elite, gdy od `room_entered` tego pokoju nie było `damage_dealt` z kwotą > 0 na graczu), `trzy-punkty` (`conquest_captured`: w migawce `owners` punkty A, B i C należą do `player`), `upadek-brandta` (zabity przez gracza wróg o `kind` = `securityChief`, rodzaj z `entity_spawned`).
   - Przekroczenie progu względem stanu meta z początku runu (stan bazowy plus przyrosty runu) emituje `achievement_earned { id }` (raz na osiągnięcie; nie dla już zdobytych): komunikat w HUD „Naszywka: <tytuł>” przez 3 s (`ACHIEVEMENT_TOAST_MS`) w lewym górnym rogu, kolejka po jednym. Nagroda wpływa dopiero przy rozliczeniu. Po wznowieniu `continue=1` (`restore`) już przekroczone progi nie wywołują komunikatu.
2. **Przy końcu runu** `RunScene` dokleja do podsumowania `achievements = tracker.tracked` (tylko przyrosty ze zdarzeń; zapis akceptuje wyłącznie znane liczniki <= 10 000 i flagi zdarzeniowe). Postęp wynikający z samego podsumowania (`summaryProgress`) liczy `MetaManager.applyRun` i **zawsze**, także gdy podsumowanie nie ma pola `achievements`: licznik `runs_ended` +1 przy każdym runie; przy zwycięstwie dodatkowo `victories` +1 (także zwycięska misja liniowa) i flagi `pierwsze-zwyciestwo`, `zagrozenie-3` (gdy `threatLevel` >= 3), `pelna-kontrola` (gdy `modeId` = `conquest`), flaga misji z mapowania (gdy `missionCompleted` i `missionId` w tabeli), `droga-*` (kategoria `melee`/`power`/`gun`, której udział w sumie `damage.melee + power + gun + other` wynosi >= 0,8; sprawdzane w tej kolejności, suma <= 0 = brak).
3. **`MetaManager.applyRun`** scala postęp z podsumowania i przyrosty trackera (flagi trackera tylko z listy flag zdarzeniowych; przyrost licznika obcinany do 10 000, wartości niefinitne lub <= 0 pomijane, nieznane liczniki ignorowane) i dolicza je razem z nagrodami runu. Idempotencję zapewnia `appliedRunIds`: ponowienie zapisu lub odświeżenie nie dubluje liczników ani nagród. Przekroczenie progu → dopisanie do `unlocked` + jednorazowa nagroda dodana do `data` / `cores` (poza `rewards` runu, które zostają bez zmian; `ApplyRunResult.achievements` zawiera `{ id, reward }` nowych naszywek dla podsumowania). Po każdej zdobytej naszywce emitowane jest `achievement_unlocked`. Postęp liczy się także przy porażce (wtedy z podsumowania tylko `runs_ended`, plus przyrosty trackera). Przy rozliczeniu sprawdzany jest też poziom postaci (`poziom-10` po `applyRun`).
4. **Poza runem** (w `MetaManager`): `pierwszy-zakup` przy udanym `buyUnlock`, `poziom-10` w `debugAddXp`. `selectThreat` nie ma własnego osiągnięcia.

## Bramkowanie zakupów

`unlocks.json` ma opcjonalne `requiresAchievement`. `MetaManager.buyUnlock` odrzuca zakup bez naszywki (komunikat „Wymagana naszywka: <tytuł>.”, sprawdzane po „Już odblokowane”, przed poziomem i kosztem), a warsztat pokazuje kłódkę z nazwą wymaganej naszywki („Wymaga naszywki: <tytuł>”) zamiast przycisku. Bramkowane są tylko rzadkie odblokowania za Rdzenie:

| Odblokowanie            | Naszywka                               |
| ----------------------- | -------------------------------------- |
| `blade:staffBlade`      | `taniec-ostrza` (150 zabójstw ostrzem) |
| `power:focus`           | `glos-rezonansu` (120 zabójstw mocą)   |
| `module:superconductor` | `reka-strzelca` (200 zabójstw bronią)  |
| `slot:weapon3`          | `weteran-hut` (5 zwycięstw)            |
| `weapon:crossbow`       | `droga-strzelca` (zwycięstwo z co najmniej 80% obrażeń z broni palnej) |

Każdą z tych naszywek da się zdobyć z wyposażeniem startowym (ostrze plazmowe, Pchnięcie, Blaster), czyli bez przedmiotu, który odblokowuje; pilnuje tego test na danych.

### Wpływ na symulację balansu F4

Symulacja `metaSim` (`src/balance/metaSim.ts`) nie symuluje zdarzeń w runie: zachłanny gracz modelowy nie zdobywa naszywek licznikowych, więc nie kupi bramkowanych pozycji. Podsumowania symulacji niosą tylko flagę `pierwsza-krew`; reszta wynika z `summaryProgress` (naszywki bez nagród walutowych `pierwsza-krew`, `pierwsze-zwyciestwo` wchodzą do symulacji, `pierwszy-zakup` też, bo `buyUnlock` je przyznaje). Wynik bramki F4 (raport `docs/balance.md`): **poziom 7, 4 zakupy**: `power:grab`, `weapon:rifle`, `slot:power2`, `power:shockwave`.

## Panel w kryjówce

Zakładka **„Naszywki Iskry”** w terminalu drzewek (`talents`): to miejsce trwałej progresji postaci, a tablica misji ma już sektor, zagrożenie i briefingi. Zakładki mają role `tablist`/`tab`/`tabpanel`, strzałki Lewo/Prawo przełączają. Panel jest tylko do odczytu: nagłówek, licznik „Zdobyte: X z 36”, wprowadzenie i siatka kart pogrupowana w cztery kategorie (Walka, Ścieżki, Misje i tryby, Progres); zdobyte mają bursztynową ramkę i jasną ikonę, brakujące są szare z `hint`, a licznikowe mają pasek postępu (`role="progressbar"`) i napis „x / cel” (postęp licznika obcięty do celu; zdobyta pokazuje cel/cel). Każda karta pokazuje nagrodę („Nagroda: 20 Danych”, „2 Rdzenie”, „Nagroda: sama naszywka”); karta bramkująca dodatkowo „Pozwala kupić: <przedmiot>”. Karty są fokusowalne (roving tabindex: strzałki, Home, End).

Podsumowanie runu pokazuje sekcję „Nowe naszywki Iskry” z nagrodami (linia „<tytuł> — <nagroda>” albo sam tytuł).

## Debug

- Komenda `achievement grant <id>`: oznacza naszywkę jako zdobytą (bez nagrody i bez sprawdzania warunku; nieznane id = komunikat błędu, zdobyta wcześniej = bez zmian), zapisuje meta.
- `query('achievements')` (run i kryjówka): stan meta `{ unlocked, counters }`; `query('runAchievements')` (run): przyrosty z bieżącego runu.

## Znane ograniczenia

- Przyrosty trackera trafiają do `RunState.achievementProgress` przy każdym zapisie mapy i wracają przy `continue=1`; zdarzenia w trakcie pokoju (przed ukończeniem) giną przy odświeżeniu pokoju.
- Nagrody walutowe naszywek „automatycznych” (`pierwsza-krew`, `pierwsze-zwyciestwo`, `pierwszy-zakup`) to `{}`: sama naszywka, bo inaczej symulacja F4 wychodzi poza bramkę (5 zakupów).
- `conquest_captured` niesie `owner` (także `neutral`) i migawkę `owners` wszystkich punktów; `trzy-punkty` wymaga 3× `player` w migawce.
- Zwycięstwa w misjach liniowych zwiększają licznik `victories` (i `runs_ended`), ale nie podnoszą `threat.max` i nie dają nagród runu (patrz `meta.md`).
