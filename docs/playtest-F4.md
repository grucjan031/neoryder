# Playtest F4 — bramka „meta-progres i kryjówka”

Cel bramki (`docs/issues/F4/README.md`): po 5 runach czuć progres, ale gra nadal stawia opór. Kryteria automatyczne (symulacja balansu `tests/unit/metaBalance.test.ts`, bot e2e `tests/e2e/metaBot.spec.ts`) są zielone — ten dokument dotyczy tego, czego bot nie oceni: czytelności kryjówki, wyborów w drzewkach i warsztacie oraz odczucia rozwoju między runami.

## Start

```bash
npm run dev        # http://localhost:5173 → menu główne → „Kryjówka”
```

Do oceny bramki graj **bez cheatów meta**, zaczynając od czystego stanu (`meta reset` w konsoli debug `` ` ``). W kryjówce (`?scene=hub`) poruszasz się kontrolerem FPP; stacje — **terminal drzewek**, **warsztat**, **tablica misji** i **przejście na poligon** — otwierają się automatycznie po wejściu w strefę (ponowne otwarcie wymaga wyjścia ze strefy).

Komendy debug do ewentualnych testów pobocznych (poza właściwą oceną 5 runów): `meta state`, `meta xp <n>`, `meta data <n>`, `meta cores <n>`, `meta reset`, `talent <id>`, `talent reset`, `threat <n>`, `hub open <stacja>`.

## Co mierzyć (wpisz do tabeli)

Zagraj **5 runów z rzędu od zera** (od `meta reset`), po każdym wracając do kryjówki i wydając zdobyte punkty oraz waluty. Po każdym runie zanotuj:

1. **Wynik, warstwa i czas** — zwycięstwo/śmierć, osiągnięta warstwa oraz czas z ekranu podsumowania.
2. **Poziom zagrożenia** — wybrany przed runem na tablicy misji.
3. **Zdobyte zasoby** — Doświadczenie, Dane i Rdzenie z podsumowania runu.
4. **Poziom po runie** — aktualny poziom postaci w kryjówce.
5. **Zakupy** — kupione talenty (w tym reset/zmiana buildu) i odblokowania w warsztacie.
6. **Odczucie trudności** — czy ten run był wyraźnie łatwiejszy niż poprzedni (wpisz w *Uwagi*).

## Pytania o feel (1–5 i jedno zdanie)

- **Kryjówka i stacje** — czy układ stacji metra jest czytelny i od razu wiadomo, gdzie jest terminal drzewek, warsztat, tablica misji i poligon?
- **Wybory w drzewkach** — czy talenty dają ciekawe wybory (zmiana działania broni/mocy/ostrza, nie tylko liczby) i zachęcają do budowania synergii?
- **Warsztat i ekwipunek** — czy odblokowania i zmiana ekwipunku w warsztacie zachęcają do eksperymentów między runami?
- **Nagrody po śmierci** — czy zdobyte po przegranym runie Doświadczenie, Dane i Rdzenie motywują do „jeszcze jednego runu”?
- **Poziom zagrożenia** — czy opis modyfikatorów i premii na tablicy misji jest czytelny i kusi do podnoszenia poprzeczki?
- **Opór po 5 runach** — czy po 5 runach gra nadal stawia opór i wymaga uwagi w walce?
- **Wydajność kryjówki** — FPS w kryjówce i przy otwieraniu nakładek stacji (cel 60).

## Tabela wyników

| Run | Seed | Poziom zagrożenia | Wynik | Czas | Warstwa | Doświadczenie | Dane | Rdzenie | Poziom po runie | Zakupy | Uwagi |
| --- | ---- | ----------------- | ----- | ---- | ------- | ------------- | ---- | ------- | --------------- | ------ | ----- |
| 1   |      |                   |       |      |         |               |      |         |                 |        |       |
| 2   |      |                   |       |      |         |               |      |         |                 |        |       |
| 3   |      |                   |       |      |         |               |      |         |                 |        |       |
| 4   |      |                   |       |      |         |               |      |         |                 |        |       |
| 5   |      |                   |       |      |         |               |      |         |                 |        |       |

## Wynik bramki

- [ ] Czuć progres i opór → **F5**
- [ ] Progres za wolny/za szybki → strojenie `src/data/meta/progression.json`, `unlocks.json`
- [ ] Gra za łatwa po 5 runach → strojenie `threat.json` / limity talentów
- [ ] Kryjówka/UI do poprawy → lista 3 największych problemów
