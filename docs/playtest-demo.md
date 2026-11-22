# Playtest demo — testy nowych graczy (S5-01, S6-01)

Cel: sprawdzić, czy osoba, która nie zna gry, sama przechodzi pierwsze minuty i chce zagrać jeszcze raz. Automaty (vitest, e2e, boty) tego nie ocenią. Ten dokument jest planem obserwacji i miejscem na notatki z obu tur.

- **Tura 1 (S5-01):** 4–6 osób. Wynik: trzy najważniejsze problemy, które trafiają do S5-02.
- **Tura 2 (S6-01):** 4–6 nowych osób, po poprawkach. Bramka: **8 z 10 samodzielnie dociera do pierwszego celu** misji „Maszty”, czyli co najmniej 80% testerów tury 2.

## Przygotowanie (prowadzący)

1. Build z wdrożenia (Vercel) albo `npm run build && npx vite preview`. Bez `?debug=1`.
2. Czysty stan przeglądarki: nowe okno incognito albo wyczyszczone dane strony (IndexedDB i localStorage — w tym `neoryder.tutorialDone`).
3. Dźwięk włączony, mysz, klawiatura, pełny ekran 1920×1080 jeśli się da.
4. Zapisz sprzęt i przeglądarkę testera (tabela niżej) — przydaje się w S9.
5. Nagrywanie ekranu za zgodą testera (OBS albo nagrywanie przeglądarki). Notatki rób w trakcie, nie po.

## Zasady prowadzenia

- Powiedz tylko: „To gra FPP w fazie testów. Graj tak, jakbyś był sam w domu. Mów na głos, co myślisz. Nie pomogę, chyba że utkniesz na dłużej niż 2 minuty”.
- **Nie podpowiadaj.** Każda podpowiedź to wpis w tabeli „Pomoc” z minutą i powodem — to najcenniejsze dane.
- Nie tłumacz, nie broń gry. Pytaj „co teraz myślisz?”, „czego się spodziewałeś?”.
- Sesja: ok. 30–40 minut gry + 5 minut pytań końcowych.

## Scenariusz (czego nie mówisz, a co obserwujesz)

Tester startuje z menu głównego i sam decyduje, co kliknąć.

| #   | Moment                       | Obserwuj                                                                                              | Sukces                                                     |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Menu główne                  | Czy wybiera „Samouczek” (wyróżniony dla nowego gracza), czy od razu „Kryjówka”?                       | Świadomy wybór, bez pytania prowadzącego                   |
| 2   | Samouczek (jeśli wybrał)     | Na którym kroku się zatrzymuje, czy czyta podpowiedzi, czy rozumie blok/parowanie i moc               | Kończy samouczek w ≤ 8 min                                 |
| 3   | Pierwsze wejście do kryjówki | Czy zauważa przewodnik „Cel: Tablica misji” i znaczniki stacji, czy błądzi, czy rozmawia z NPC        | Dochodzi do tablicy misji w ≤ 2 min                        |
| 4   | Tablica misji                | Czy rozumie wybór misji, Poziomu zagrożenia i nagrody; czy coś go blokuje                             | Rozpoczyna „Maszty” bez pomocy                             |
| 5   | Odprawa i pierwszy cel M01   | Czy czyta cel w HUD, czy używa strzałki z odległością                                                 | **Dociera do pierwszego celu samodzielnie** (bramka S6-01) |
| 6   | Pierwsza walka               | Czy widzi zapowiedzi ataków (czerwień, bursztyn dla ciosu bez bloku), czy wie, skąd dostaje obrażenia | Wygrywa pierwsze starcie albo rozumie, dlaczego przegrał   |
| 7   | Wyposażenie i synergie       | Czy zmienia broń/moc, czy zauważa synergie i talenty                                                  | Choć jedna świadoma zmiana buildu                          |
| 8   | Śmierć (jeśli nastąpi)       | Czy czyta przyczynę i wskazówkę, co klika potem                                                       | Umie powiedzieć, co zrobi inaczej                          |
| 9   | Powrót do kryjówki           | Czy rozumie Dane, Rdzenie i punkty talentów (podpowiedzi na pasku), czy wydaje punkty                 | Wydaje coś bez pytania                                     |
| 10  | Decyzja o kolejnej próbie    | Czy sam zaczyna kolejny run / misję                                                                   | Gra dalej bez zachęty                                      |

## Pytania końcowe (1–5 i jedno zdanie)

1. Jak szybko wiedziałeś, co masz robić? (samouczek, kryjówka, misja)
2. Czy walka była czytelna — widziałeś, skąd idzie zagrożenie?
3. Czy czułeś różnicę między Ostrzem, Rezonansem i Strzelcem?
4. Czy rozumiałeś, za co dostajesz Dane, Rdzenie i punkty talentów i na co je wydać?
5. Co było najbardziej frustrujące? Co najfajniejsze?
6. Zagrałbyś jeszcze raz teraz, bez proszenia? (tak / może / nie)

## Tabela testerów

| #   | Data | Tura | Doświadczenie z FPP (0–3) | Sprzęt / przeglądarka | FPS (orient.) | Samouczek (tak/nie, czas) | Do tablicy misji (min) | Pierwszy cel M01 sam? | Śmierci | Gra dalej? |
| --- | ---- | ---- | ------------------------- | --------------------- | ------------- | ------------------------- | ---------------------- | --------------------- | ------- | ---------- |
| 1   |      |      |                           |                       |               |                           |                        |                       |         |            |
| 2   |      |      |                           |                       |               |                           |                        |                       |         |            |
| 3   |      |      |                           |                       |               |                           |                        |                       |         |            |
| 4   |      |      |                           |                       |               |                           |                        |                       |         |            |
| 5   |      |      |                           |                       |               |                           |                        |                       |         |            |
| 6   |      |      |                           |                       |               |                           |                        |                       |         |            |

## Pomoc prowadzącego

| Tester | Minuta | Gdzie utknął | Co powiedziałeś |
| ------ | ------ | ------------ | --------------- |
|        |        |              |                 |

## Obserwacje (cytaty i zdarzenia)

| Tester | Moment (#) | Co się stało / cytat | Waga (1–3) |
| ------ | ---------- | -------------------- | ---------- |
|        |            |                      |            |

## Wynik tury

- **Tura 1 — trzy najważniejsze problemy** (najczęstsze × największa waga): 1. 2. 3.
- **Tura 2 — bramka S6-01:** ___ z ___ samodzielnie dotarło do pierwszego celu.
  - [ ] ≥ 8 z 10 → decyzja o „Ładunku klasy K” (S6) i dalej S7
  - [ ] < 8 z 10 → poprawki pierwszych minut, kolejna tura
