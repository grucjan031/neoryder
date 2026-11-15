# Balans F2 — symulacja TTK

Data wygenerowania (UTC): 2026-11-15. Generator: `npm run balance`.

**Bramka: ZALICZONA** (TTK paczki 5 wrogów, otwarta przestrzeń). Poza przedziałem: brak. Wariant przy ścianie jest informacyjny i nie wpływa na bramkę (w przedziale: NIE).
Miara: dla każdego wroga każda ścieżka musi mieć TTK paczki w [mediana / 2, mediana × 2]. Nieskończony TTK nie zalicza bramki. Ocena używa pełnej precyzji, tabele zaokrąglają do 0,001 s.

## Założenia

- Prawdziwe Weapon, createPower, PlasmaBlade, DamageSystem, StatusSystem, PlayerEnergy i Stats; stały krok SIM_DT = 1/60 s (0.017 s), limit 120 s na parę. Bez renderu, DOM i inicjalizacji Rapier.
- **TTK paczki:** czas zabicia 5 wrogów danego typu po kolei. Po śmierci kolejny pojawia się natychmiast w tym samym miejscu (świeże HP); ciepło broni, odnowienia, energia gracza i zegary przechodzą między celami, a statusy znikają z martwym celem. Kolejny cel nie dostaje cięcia ostrza, które zabiło poprzednika (jedno cięcie = jeden cel). To miara tempa czyszczenia fali. Pojedyncze TTK (jeden cel) zostaje w tabelach informacyjnie: karze bronie zabijające jednym strzałem (1/60 s wobec 0,4 s ostrza).
- 100% celności. Nieruchomy cel w zasięgu każdego narzędzia; brak czasu dojścia, lotu pocisku i odrzucania celu poza zasięg. Trafienia w korpus (mnożnik hurtboxa drona z danych), bez premii za głowę.
- Wszystkie śruty trafiają. Zgodnie z idealizacją briefu adapter sumuje na jednym celu także wszystkie przebicia z pierceFalloff. To optymistyczne skupienie obrażeń wielu celów: w grze ProjectileSystem nie trafia ponownie tej samej encji. Łańcuch mocy zachowuje własną regułę bez powtórzeń, więc na pojedynczym celu nie przeskakuje.
- Tarczownik atakowany z flanki: tarcza pominięta. Egzekutor nie paruje. Cel nie kontratakuje; ogłuszenie i wyładowanie obsługuje StatusSystem. Wyładowanie przeciążenia nie rani nosiciela, więc bez sąsiednich celów nie dodaje DPS.
- Każda para zaczyna z pełnym HP celu, pełną energią (100), zimną bronią, bez cooldownów i statusów. Bazy jak na arenie: regeneracja energii 25/s (po opóźnieniu z tuning.ts po każdym wydatku), pojemność ciepła 100, chłodzenie 45/s. Bez implantów i synergii.
- Półautomat ponawia wciśnięcie tak szybko, jak pozwala cooldown (zwolnienie spustu bez przesuwania zegarów przez cool(0)). Combo lekkie buforuje kolejne kliknięcia. Ciężki atak to rzeczywiste przytrzymanie i puszczenie po naładowaniu; zawiera poprzedzający go lekki cios wynikający z PlasmaBlade.
- Czas od wejścia do symulacji do końca kroku ostatniego zabójstwa; pierwsze natychmiastowe trafienie ma TTK 1/60 s, nigdy 0. To czas symulacji, bez pauz prezentacyjnego hitstopu i slowmo. DPS = faktycznie zdjęte HP / czas do końca starcia (bez overkill); przy ∞ DPS = zdjęte HP / pełny limit.
- Ostrze: lepszy TTK combo lub ciężkiego z loadout blade. Strzelec: najlepsza pojedyncza broń loadout gunner, bez przełączania podczas walki. Moc: wszystkie ofensywne moce loadout resonance, oba sloty ponawiane w każdym kroku ze wspólną energią; sprawdzane wszystkie stałe priorytety slotów i wybierany najlepszy wynik dla wroga (osobno dla paczki i dla pojedynczego celu).
- Moce bez obrażeń pomijane; nieobsługiwany rodzaj mocy pomijany z ostrzeżeniem. Błędy walidacji danych gry nadal przerywają ładowanie.
- Wariant przy ścianie (0 m za celem, wall-slam w następnym kroku) jest informacyjny: nagroda za grę pozycyjną, nie część bramki. Ma osobną medianę.

## Ścieżki — TTK paczki ×5, otwarta przestrzeń (bramka)

| Wróg | Ostrze paczki (s) | Moc paczki (s) | Strzelec paczki (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | W przedziale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| assaulter | 3.083 | 1.683 | 2.683 | 2.683 | 1.149 | 0.627 | 1.000 | TAK |
| drone | 0.917 | 0.850 | 0.917 | 0.917 | 1.000 | 0.927 | 1.000 | TAK |
| executor | 8.250 | 21.317 | 11.017 | 11.017 | 0.749 | 1.935 | 1.000 | TAK |
| gunner | 2.083 | 1.683 | 2.683 | 2.083 | 1.000 | 0.808 | 1.288 | TAK |
| shielder | 3.083 | 2.100 | 5.017 | 3.083 | 1.000 | 0.681 | 1.627 | TAK |
| sniper | 1.583 | 0.850 | 2.683 | 1.583 | 1.000 | 0.537 | 1.695 | TAK |

| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |
| --- | --- | --- | --- |
| assaulter | plasmaBlade:combo | chain → push | scatter |
| drone | plasmaBlade:combo | chain → push | rifle |
| executor | plasmaBlade:combo | chain → push | scatter |
| gunner | plasmaBlade:combo | chain → push | scatter |
| shielder | plasmaBlade:combo | chain → push | sniper |
| sniper | plasmaBlade:combo | chain → push | scatter |

## Ścieżki — pojedyncze TTK, otwarta przestrzeń (informacyjnie)

| Wróg | Ostrze TTK (s) | Moc TTK (s) | Strzelec TTK (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | W przedziale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| assaulter | 0.417 | 0.017 | 0.017 | 0.017 | 25.000 | 1.000 | 1.000 | NIE |
| drone | 0.083 | 0.017 | 0.017 | 0.017 | 5.000 | 1.000 | 1.000 | NIE |
| executor | 1.583 | 0.617 | 1.267 | 1.267 | 1.250 | 0.487 | 1.000 | NIE |
| gunner | 0.250 | 0.017 | 0.017 | 0.017 | 15.000 | 1.000 | 1.000 | NIE |
| shielder | 0.417 | 0.017 | 0.017 | 0.017 | 25.000 | 1.000 | 1.000 | NIE |
| sniper | 0.250 | 0.017 | 0.017 | 0.017 | 15.000 | 1.000 | 1.000 | NIE |

| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |
| --- | --- | --- | --- |
| assaulter | plasmaBlade:combo | chain → push | scatter |
| drone | plasmaBlade:combo | chain → push | scatter |
| executor | plasmaBlade:combo | chain → push | sniper |
| gunner | plasmaBlade:combo | chain → push | scatter |
| shielder | plasmaBlade:combo | chain → push | sniper |
| sniper | plasmaBlade:combo | chain → push | scatter |

## Każda broń, moc i ostrze — otwarta przestrzeń

| Narzędzie | Wróg | TTK (s) | DPS (HP/s) | TTK paczki ×5 (s) | DPS paczki (HP/s) |
| --- | --- | ---: | ---: | ---: | ---: |
| Laser ciągły (beam) | assaulter | 1.500 | 40.000 | 19.883 | 15.088 |
| Laser ciągły (beam) | drone | 0.500 | 36.000 | 5.583 | 16.119 |
| Laser ciągły (beam) | executor | 13.233 | 16.625 | 78.633 | 13.989 |
| Laser ciągły (beam) | gunner | 1.200 | 37.500 | 15.283 | 14.722 |
| Laser ciągły (beam) | shielder | 3.833 | 23.478 | 31.633 | 14.226 |
| Laser ciągły (beam) | sniper | 0.900 | 38.889 | 10.683 | 16.381 |
| Blaster (blaster) | assaulter | 0.350 | 171.429 | 5.017 | 59.801 |
| Blaster (blaster) | drone | 0.017 | 1080.000 | 0.683 | 131.707 |
| Blaster (blaster) | executor | 3.017 | 72.928 | 22.350 | 49.217 |
| Blaster (blaster) | gunner | 0.350 | 128.571 | 5.017 | 44.850 |
| Blaster (blaster) | shielder | 0.683 | 131.707 | 9.350 | 48.128 |
| Blaster (blaster) | sniper | 0.183 | 190.909 | 2.850 | 61.404 |
| Granat EMP (emp) | assaulter | 5.267 | 11.392 | 35.267 | 8.507 |
| Granat EMP (emp) | drone | 1.267 | 14.211 | 12.767 | 7.050 |
| Granat EMP (emp) | executor | 24.767 | 8.883 | ∞ | 8.250 |
| Granat EMP (emp) | gunner | 3.767 | 11.947 | 27.767 | 8.103 |
| Granat EMP (emp) | shielder | 9.767 | 9.215 | 57.767 | 7.790 |
| Granat EMP (emp) | sniper | 2.517 | 13.907 | 20.267 | 8.635 |
| Pistolet (pistol) | assaulter | 0.267 | 225.000 | 2.267 | 132.353 |
| Pistolet (pistol) | drone | 0.017 | 1080.000 | 1.017 | 88.525 |
| Pistolet (pistol) | executor | 1.517 | 145.055 | 13.517 | 81.381 |
| Pistolet (pistol) | gunner | 0.267 | 168.750 | 2.267 | 99.265 |
| Pistolet (pistol) | shielder | 0.517 | 174.194 | 4.767 | 94.406 |
| Pistolet (pistol) | sniper | 0.267 | 131.250 | 2.267 | 77.206 |
| Karabin (rifle) | assaulter | 0.417 | 144.000 | 6.617 | 45.340 |
| Karabin (rifle) | drone | 0.117 | 154.286 | 0.917 | 98.182 |
| Karabin (rifle) | executor | 4.617 | 47.653 | 30.417 | 36.164 |
| Karabin (rifle) | gunner | 0.317 | 142.105 | 4.717 | 47.703 |
| Karabin (rifle) | shielder | 0.717 | 125.581 | 10.917 | 41.221 |
| Karabin (rifle) | sniper | 0.217 | 161.538 | 2.817 | 62.130 |
| Rozpraszacz (scatter) | assaulter | 0.017 | 3600.000 | 2.683 | 111.801 |
| Rozpraszacz (scatter) | drone | 0.017 | 1080.000 | 2.683 | 33.540 |
| Rozpraszacz (scatter) | executor | 1.350 | 162.963 | 11.017 | 99.849 |
| Rozpraszacz (scatter) | gunner | 0.017 | 2700.000 | 2.683 | 83.851 |
| Rozpraszacz (scatter) | shielder | 0.683 | 131.707 | 6.850 | 65.693 |
| Rozpraszacz (scatter) | sniper | 0.017 | 2100.000 | 2.683 | 65.217 |
| Snajperka (sniper) | assaulter | 0.017 | 3600.000 | 5.017 | 59.801 |
| Snajperka (sniper) | drone | 0.017 | 1080.000 | 5.017 | 17.940 |
| Snajperka (sniper) | executor | 1.267 | 173.684 | 11.267 | 97.633 |
| Snajperka (sniper) | gunner | 0.017 | 2700.000 | 5.017 | 44.850 |
| Snajperka (sniper) | shielder | 0.017 | 5400.000 | 5.017 | 89.701 |
| Snajperka (sniper) | sniper | 0.017 | 2100.000 | 5.017 | 34.884 |
| Błyskawica (chain) | assaulter | 0.017 | 3600.000 | 1.683 | 178.218 |
| Błyskawica (chain) | drone | 0.017 | 1080.000 | 1.683 | 53.465 |
| Błyskawica (chain) | executor | 0.850 | 258.824 | 15.783 | 69.694 |
| Błyskawica (chain) | gunner | 0.017 | 2700.000 | 1.683 | 133.663 |
| Błyskawica (chain) | shielder | 0.433 | 207.692 | 3.767 | 119.469 |
| Błyskawica (chain) | sniper | 0.017 | 2100.000 | 1.683 | 103.960 |
| Pchnięcie Rezonansu (push) | assaulter | 0.617 | 97.297 | 5.417 | 55.385 |
| Pchnięcie Rezonansu (push) | drone | 0.017 | 1080.000 | 2.417 | 37.241 |
| Pchnięcie Rezonansu (push) | executor | 3.617 | 60.829 | 65.433 | 16.811 |
| Pchnięcie Rezonansu (push) | gunner | 0.617 | 72.973 | 5.417 | 41.538 |
| Pchnięcie Rezonansu (push) | shielder | 1.217 | 73.973 | 17.433 | 25.813 |
| Pchnięcie Rezonansu (push) | sniper | 0.017 | 2100.000 | 2.417 | 72.414 |
| Fala uderzeniowa (shockwave) | assaulter | 15.150 | 3.960 | 101.550 | 2.954 |
| Fala uderzeniowa (shockwave) | drone | 1.533 | 11.739 | 29.550 | 3.046 |
| Fala uderzeniowa (shockwave) | executor | 72.750 | 3.024 | ∞ | 2.917 |
| Fala uderzeniowa (shockwave) | gunner | 11.550 | 3.896 | 83.550 | 2.693 |
| Fala uderzeniowa (shockwave) | shielder | 25.950 | 3.468 | ∞ | 2.917 |
| Fala uderzeniowa (shockwave) | sniper | 7.950 | 4.403 | 65.550 | 2.670 |
| Ostrze: combo lekkie (plasmaBlade:combo) | assaulter | 0.417 | 144.000 | 3.083 | 97.297 |
| Ostrze: combo lekkie (plasmaBlade:combo) | drone | 0.083 | 216.000 | 0.917 | 98.182 |
| Ostrze: combo lekkie (plasmaBlade:combo) | executor | 1.583 | 138.947 | 8.250 | 133.333 |
| Ostrze: combo lekkie (plasmaBlade:combo) | gunner | 0.250 | 180.000 | 2.083 | 108.000 |
| Ostrze: combo lekkie (plasmaBlade:combo) | shielder | 0.417 | 216.000 | 3.083 | 145.946 |
| Ostrze: combo lekkie (plasmaBlade:combo) | sniper | 0.250 | 140.000 | 1.583 | 110.526 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | assaulter | 0.667 | 90.000 | 5.333 | 56.250 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | drone | 0.083 | 216.000 | 2.417 | 37.241 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | executor | 2.417 | 91.034 | 14.083 | 78.107 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | gunner | 0.667 | 67.500 | 5.333 | 42.188 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | shielder | 0.667 | 135.000 | 5.333 | 84.375 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | sniper | 0.667 | 52.500 | 5.333 | 32.813 |

## Wariant przy ścianie — TTK paczki ×5 (informacyjnie)

| Wróg | Ostrze paczki (s) | Moc paczki (s) | Strzelec paczki (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | W przedziale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| assaulter | 3.083 | 2.433 | 2.683 | 2.683 | 1.149 | 0.907 | 1.000 | TAK |
| drone | 0.917 | 2.417 | 0.917 | 0.917 | 1.000 | 2.636 | 1.000 | NIE |
| executor | 8.250 | 29.433 | 11.017 | 11.017 | 0.749 | 2.672 | 1.000 | NIE |
| gunner | 2.083 | 2.433 | 2.683 | 2.433 | 0.856 | 1.000 | 1.103 | TAK |
| shielder | 3.083 | 5.417 | 5.017 | 5.017 | 0.615 | 1.080 | 1.000 | TAK |
| sniper | 1.583 | 2.417 | 2.683 | 2.417 | 0.655 | 1.000 | 1.110 | TAK |

| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |
| --- | --- | --- | --- |
| assaulter | plasmaBlade:combo | chain → push | scatter |
| drone | plasmaBlade:combo | chain → push | rifle |
| executor | plasmaBlade:combo | chain → push | scatter |
| gunner | plasmaBlade:combo | chain → push | scatter |
| shielder | plasmaBlade:combo | chain → push | sniper |
| sniper | plasmaBlade:combo | chain → push | scatter |

### Wariant przy ścianie — pojedyncze TTK

| Wróg | Ostrze TTK (s) | Moc TTK (s) | Strzelec TTK (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | W przedziale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| assaulter | 0.417 | 0.033 | 0.017 | 0.033 | 12.500 | 1.000 | 0.500 | NIE |
| drone | 0.083 | 0.017 | 0.017 | 0.017 | 5.000 | 1.000 | 1.000 | NIE |
| executor | 1.583 | 1.817 | 1.267 | 1.583 | 1.000 | 1.147 | 0.800 | TAK |
| gunner | 0.250 | 0.033 | 0.017 | 0.033 | 7.500 | 1.000 | 0.500 | NIE |
| shielder | 0.417 | 0.617 | 0.017 | 0.417 | 1.000 | 1.480 | 0.040 | NIE |
| sniper | 0.250 | 0.017 | 0.017 | 0.017 | 15.000 | 1.000 | 1.000 | NIE |

| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |
| --- | --- | --- | --- |
| assaulter | plasmaBlade:combo | chain → push | scatter |
| drone | plasmaBlade:combo | chain → push | scatter |
| executor | plasmaBlade:combo | chain → push | sniper |
| gunner | plasmaBlade:combo | chain → push | scatter |
| shielder | plasmaBlade:combo | chain → push | sniper |
| sniper | plasmaBlade:combo | chain → push | scatter |

### Moce przy ścianie (tylko narzędzia, których wynik różni się od otwartej przestrzeni)

| Narzędzie | Wróg | TTK (s) | DPS (HP/s) | TTK paczki ×5 (s) | DPS paczki (HP/s) |
| --- | --- | ---: | ---: | ---: | ---: |
| Błyskawica (chain) | assaulter | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | drone | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | executor | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | gunner | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | shielder | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | sniper | ∞ | 0.000 | ∞ | 0.000 |
| Pchnięcie Rezonansu (push) | assaulter | 0.033 | 1800.000 | 2.433 | 123.288 |
| Pchnięcie Rezonansu (push) | drone | 0.017 | 1080.000 | 2.417 | 37.241 |
| Pchnięcie Rezonansu (push) | executor | 1.817 | 121.101 | 29.433 | 37.373 |
| Pchnięcie Rezonansu (push) | gunner | 0.033 | 1350.000 | 2.433 | 92.466 |
| Pchnięcie Rezonansu (push) | shielder | 0.617 | 145.946 | 5.417 | 83.077 |
| Pchnięcie Rezonansu (push) | sniper | 0.017 | 2100.000 | 2.417 | 72.414 |
| Fala uderzeniowa (shockwave) | assaulter | 1.550 | 38.710 | 29.567 | 10.147 |
| Fala uderzeniowa (shockwave) | drone | 0.033 | 540.000 | 11.567 | 7.781 |
| Fala uderzeniowa (shockwave) | executor | 22.350 | 9.843 | ∞ | 8.083 |
| Fala uderzeniowa (shockwave) | gunner | 1.550 | 29.032 | 29.567 | 7.610 |
| Fala uderzeniowa (shockwave) | shielder | 4.367 | 20.611 | 47.567 | 9.460 |
| Fala uderzeniowa (shockwave) | sniper | 1.533 | 22.826 | 29.550 | 5.922 |

## Wnioski

- Bramka (paczka ×5, otwarta przestrzeń): 0/6 wrogów poza przedziałem (brak). Pojedyncze TTK (informacyjnie): 6/6. Przy ścianie (informacyjnie, paczka): 2/6.
- Pojedyncze TTK jest bardzo wrażliwe na obrażenia jednego trafienia (zabójstwo w 1/60 s wobec 0,4 s ostrza); dlatego bramkę liczy paczka.
- Wynik jest liczbową podstawą decyzji o danych. Nie zastępuje playtestu 12 fal ani oceny feel.

## Meta-progres (F4)

Symulacja 5 typowych runów nowego gracza na Poziomie zagrożenia 0 (`src/balance/metaSim.ts`, `tests/unit/metaBalance.test.ts`). **Wynik: poziom 7, 4 zakupów w warsztacie** (cel bramki F4: poziom 5–8, 2–4 zakupy, pierwszy run co najmniej 1 poziom, żaden run więcej niż 3 poziomy).

Model runu: stała ścieżka przez sektor Kurogane Arms (warstwy: walka, walka, walka, elita, sklep, elita, odpoczynek, boss). `roomsCleared` to wszystkie ukończone węzły (tak liczy `RunManager`: także sklep i odpoczynek, a przy zwycięstwie boss), więc śmierć w warstwie L daje L − 1 pokoi, a zwycięstwo 8. `elitesCleared`: 0, 1, 1, 2. Zabójstwa: 6 na pokój walki, 10 na elitę, boss 1 + 4 pomocników. `elapsedS`: suma `expectedDurationS` ukończonych pokoi. Po każdym runie gracz kupuje zachłannie talenty (najtańszy dostępny węzeł, remis: id) za wszystkie wolne punkty oraz odblokowania (najtańsze dostępne, Dane i Rdzenie), dopóki go stać.

| Run | Pokoje | Elity | Zabójstwa | Czas (s) | XP | Dane | Rdzenie | Poziom po runie | Talenty kupione | Zakupy w warsztacie | Dane po zakupach | Rdzenie po zakupach |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1. Śmierć w warstwie 3 | 2 | 0 | 12 | 300 | 50 | 22 | 0 | 2 | 1 | — | 22 | 0 |
| 2. Śmierć w warstwie 5 | 4 | 1 | 28 | 660 | 140 | 48 | 1 | 3 | 1 | — | 70 | 1 |
| 3. Zwycięstwo | 8 | 2 | 43 | 1275 | 330 | 113 | 5 | 5 | 2 | power:grab, weapon:rifle | 23 | 6 |
| 4. Śmierć w warstwie 6 | 5 | 1 | 28 | 720 | 165 | 53 | 1 | 6 | 1 | — | 76 | 7 |
| 5. Zwycięstwo | 8 | 2 | 43 | 1275 | 330 | 113 | 5 | 7 | 1 | slot:power2, power:shockwave | 89 | 4 |

Nagrody za typowe zwycięstwo i śmierć w warstwie 5 na Poziomach zagrożenia 0–3 (Rdzenie nie mnożą się przez `rewardMult`, zwycięstwo dolicza `victoryCores`):

| Poziom zagrożenia | `rewardMult` | Zwycięstwo: XP | Dane | Rdzenie | Śmierć w warstwie 5: XP | Dane | Rdzenie |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 1 | 330 | 113 | 5 | 140 | 48 | 1 |
| 1 | 1.15 | 379 | 130 | 6 | 161 | 55 | 1 |
| 2 | 1.3 | 429 | 147 | 6 | 182 | 62 | 1 |
| 3 | 1.45 | 479 | 164 | 6 | 203 | 70 | 1 |

## Decyzje i strojenie

Decyzje koordynatora, zastosowane zmiany i opcje strojenia opisuje [specyfikacja symulatora](systems/balance.md#decyzje-koordynatora-2026-11-14).

### Ograniczenie loadera nieznanych mocy

Symulator ostrzega i pomija nieobsługiwane rodzaje udostępnione przez rejestr. Obecny rejestr gry jednak waliduje wszystkie JSON-y przez powerSchema już podczas importu: rodzaj spoza jego unii przerwie import przed uruchomieniem symulatora. Pełne pomijanie surowego JSON-a z nieznanym kind wymaga zmiany loadera poza dozwolonym zakresem; do decyzji Architekta.

Ostrzeżenie: Pominięto nieobsługiwany rodzaj mocy: grab (grab).
