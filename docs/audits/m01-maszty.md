# Audyt misji 1 „Maszty” (2026-11-22)

Zakres: `src/data/missions/m01-maszty.json`, `src/data/levels/m01-maszty.json` (generator `tools/levels/buildM01.mjs`), scenariusz `docs/fabula/misje/misja-01-maszty.md`. Zrzuty z przejścia (przed i po poprawkach) leżą poza repozytorium, w katalogu roboczym audytu (`m01-audyt/przed`, `m01-audyt/po`; m.in. `07-wejscie-targ`, `19-dziedziniec-walka`, `28-zaplecze-wejscie`).

Waga: **blokuje** (nie wolno wydawać), **ważne**, **drobne**. Status: poprawione w tym PR albo zostaje.

## Wnioski

| # | Waga | Obszar | Problem | Dowód | Zmiana | Status |
|---|---|---|---|---|---|---|
| 1 | blokuje | dialogi vs akcja | Odprawa miała 14 kwestii przed pierwszym krokiem; ładunki, ostrzeżenia o wieżyczkach i żarty padały, zanim gracz zobaczył cokolwiek z mapy. | `git show HEAD:src/data/missions/m01-maszty.json`, `briefing` | Odprawa 3 kwestie; reszta w radiu na `runStart` (`story`), `encounter:patrol-wejscie:done`, `encounter:oslona-pierwszego:done`, `checkpoint:po-maszcie-1`, `checkpoint:po-helixie`. Treść bez zmian. | poprawione |
| 2 | ważne | wrogowie i osłony | Posiłki z masztu 3 były falą `missionPatrol`, mimo że poziom (`buildM01.mjs`, `reinforce-mast-3`) i cel wskazywały inną; wybuch ostatniego masztu nie był trudniejszy niż pierwszego. Spotkania startowały w miejscu, w którym gracz dobijał poprzednie. | `m01-maszty.json` cel `mast-3`: `reinforcements`; `buildM01.mjs` tablica `encounters` | `reinforcements: "m01Assault"` dla masztu 3 i cztery punkty spawnu; strefy spotkań przesunięte za bramę poprzedniego (x=26, 152, 236, 266). | poprawione |
| 3 | ważne | błędy wizualne | Otwarte place (targ, dziedziniec, plac) bez stropu: asfalt, osłony i wrogowie zlewały się z nocą, maszt trudno było znaleźć wzrokiem. | zrzuty `przed/10-targ-srodek`, `21-dziedziniec-srodek` | Po dwie plamy ciepłego światła na plac i bursztynowy reflektor przy maszcie (`level.lights` w generatorze). | poprawione |
| 4 | ważne | czytelność celów i trasy | Radio o włazie padało dopiero na włazie, ok. 2 s przed końcem misji; właz stał w środku kanału, nieosłonięty. | `radio` M01: `objective:exit:started` | Kwestie o włazie na `checkpoint:ewakuacja`; właz przy wschodnim murze (x=316) za transformatorem, `manhole` przesunięty na x=307. | poprawione |
| 5 | ważne | zgodność ze scenariuszem | Stare `section.radio` (`enterNode:3/5/7`) wiązały radio z nazwą węzła z runu sektora, a nie z miejscem na mapie; kwestie mogły zagrać w złym momencie. | `buildM01.mjs` (usunięte pole `radio` sekcji) | Radio na `enterSection:<id>` (targ, dziedziniec, zaplecze, plac); sceny sprawdzają istnienie id przy starcie. | poprawione |
| 6 | ważne | tempo | Cztery odcinki bez żadnej chwili ciszy: kolejna walka zaczynała się natychmiast po poprzedniej, więc radio nie miało gdzie zagrać. | zrzuty `po/04`–`po/09` | Kolejka radia: `story` czeka na spokój (`radioCalmDelayS`), `tactical` gra od razu (zob. `docs/systems/missions.md`). | poprawione |
| 7 | drobne | dialogi vs akcja | Debrief miał 11 kwestii. | `m01-maszty.json`, `debrief` | Skrócony do 6; reszta zostaje w scenariuszu. | poprawione |
| 8 | drobne | czytelność | Pierwsza wieżyczka stoi na wprost wejścia na targ; ostrzeżenie `enterSection:targ` pada w tej samej chwili co pierwsze strzały. | e2e `missionLinear.spec.ts` | Zostaje: ostrzeżenie jest taktyczne i krótkie; do oceny w teście ręcznym. | zostaje |
| 9 | drobne | wrogowie | Nie zmierzono rzeczywistej liczby klatek na dziedzińcu przy dwóch wieżyczkach i posiłkach (brak pomiaru GPU w repozytorium). | `docs/audits/mapy-2026-11-18.md`, uwagi o pomiarach | Do zmierzenia ręcznie na urządzeniu docelowym. | zostaje |

## Czego nie sprawdzono

- Odsłuchu i faktycznego „feel” walki z ludźmi; ocena tempa opiera się na zrzutach i liczbie spotkań, nie na grze przez testerów.
- Pełnej zgodności wszystkich zrzutów „po” z tekstem scenariusza słowo w słowo (podział kwestii zachowuje treść; weryfikuje to `tests/unit/missionBriefing.test.ts`).
