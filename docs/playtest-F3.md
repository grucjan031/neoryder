# Playtest F3 — bramka „pełny run z bossem”

Cel bramki (`docs/issues/F3/README.md`): jeden run 15–25 min przez sektor Kurogane Arms kończy się bossem; śmierć wraca do menu z podsumowaniem. Kryteria automatyczne (bot e2e `tests/e2e/runBot.spec.ts`, determinizm `tests/unit/runDeterminism.test.ts`) są zielone — ten dokument dotyczy tego, czego bot nie oceni: tempa, czytelności i „chcę jeszcze raz”.

## Start

```bash
npm run dev        # http://localhost:5173 → menu główne → „Nowy run”
```

Wybierz ekwipunek i zacznij run; mapa → pokój → nagroda → mapa… aż do bossa. Ekrany obsługujesz myszą oraz `1`/`2`/`3` i `Enter`. Panel strojenia (po prawej) i konsola debug (`` ` ``, `help`) działają jak w F1. Sterowanie walką jak w `docs/playtest-F1.md`; nowe ręce FPP (zamiana R, gest mocy, chwyt broni) oceniasz poniżej.

Powtórka konkretnego runu: `?scene=run&seed=<tekst>&loadout=classic`. Przydatne komendy: `god`, `kill all`, `run clear`, `run state`, `credits <n>`, `implant <id>`.

## Co mierzyć (wpisz do tabeli)

1. **Czas runu** — z ekranu podsumowania. Cel: **15–25 min** (grane normalnie, bez cheatów).
2. **Śmierci** — w którym pokoju/warstwie, od czego (wróg, boss, brak leczenia).
3. **Wybory ścieżki** — czy mapa daje realny wybór (walka / elita / sklep / odpoczynek)? Czy wybierałeś/aś świadomie?
4. **Czytelność bossa** — czy widać fazy, telegrafy uderzenia obszarowego i wachlarza, wezwanie Tarczowników i fazę tarczy (co ją łamie)?
5. **Ekonomia** — czy Kredyty wystarczają na zakup w sklepie? Czy odpoczynek leczy za mało/za dużo? Czy brak regeneracji HP jest uczciwy?
6. **Implanty i synergie** — czy nagrody z 3 opcji dają ciekawy wybór; czy czujesz build po 3–4 implantach?

## Pytania o feel (1–5 i jedno zdanie)

- **Tempo pokoju** — czy fale w pokojach nie dłużą się? Czy pokój elity jest wyraźnie trudniejszy?
- **Przejścia** — czy ładowanie pokoju i przejścia między ekranami nie wybijają z rytmu?
- **Zamiana R** — czy zamiana broni/ręki klawiszem R jest naturalna i widoczna w rękach?
- **Gest mocy** — czy gest ręki przy użyciu mocy zgadza się z efektem i nie zasłania widoku?
- **Chwyt broni** — czy chwyt/trzymanie broni wygląda dobrze, a ręce nie wchodzą w ściany nadmiernie?
- **Boss** — czy walka jest wyzwaniem, nie ścianą? Czy faza tarczy jest zrozumiała?
- **„Jeszcze raz”** — po śmierci/zwycięstwie: klikasz „Nowy run” od razu?
- **Wydajność** — FPS w pokoju elity i w walce z bossem (cel 60).

## Tabela wyników

| Run | Seed | Ekwipunek | Wynik (zwycięstwo/śmierć) | Czas (mm:ss) | Pokoje | Implanty | Gdzie/od czego śmierć | Uwagi |
| --- | ---- | --------- | ------------------------- | ------------ | ------ | -------- | --------------------- | ----- |
| 1   |      |           |                           |              |        |          |                       |       |
| 2   |      |           |                           |              |        |          |                       |       |
| 3   |      |           |                           |              |        |          |                       |       |

## Wynik bramki

- [ ] Run mieści się w 15–25 min, boss czytelny, chcę jeszcze raz → **F4**
- [ ] Run za krótki/za długi → strojenie budżetu zagrożenia (`src/data/sectors/kurogane.json`), liczba warstw
- [ ] Boss lub ekonomia do poprawy → lista 3 największych problemów
