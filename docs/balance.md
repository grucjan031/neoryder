# Balans F2 — symulacja TTK

Data wygenerowania (UTC): 2026-11-25. Generator: `npm run balance`.

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
| hacker | 0.917 | 0.850 | 0.917 | 0.917 | 1.000 | 0.927 | 1.000 | TAK |
| helixGuard | 2.083 | 2.100 | 2.683 | 2.100 | 0.992 | 1.000 | 1.278 | TAK |
| helixMedic | 1.583 | 0.850 | 2.683 | 1.583 | 1.000 | 0.537 | 1.695 | TAK |
| rozstrojony | 2.083 | 1.683 | 2.683 | 2.083 | 1.000 | 0.808 | 1.288 | TAK |
| shielder | 3.083 | 2.100 | 5.017 | 3.083 | 1.000 | 0.681 | 1.627 | TAK |
| sniper | 1.583 | 0.850 | 2.683 | 1.583 | 1.000 | 0.537 | 1.695 | TAK |
| turret | 3.083 | 2.100 | 2.683 | 2.683 | 1.149 | 0.783 | 1.000 | TAK |

| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |
| --- | --- | --- | --- |
| assaulter | plasmaBlade:combo | chain → push | scatter |
| drone | plasmaBlade:combo | chain → push | rifle |
| executor | plasmaBlade:combo | chain → push | scatter |
| gunner | plasmaBlade:combo | chain → push | scatter |
| hacker | plasmaBlade:combo | chain → push | rifle |
| helixGuard | plasmaBlade:combo | chain → push | scatter |
| helixMedic | plasmaBlade:combo | chain → push | scatter |
| rozstrojony | plasmaBlade:combo | chain → push | scatter |
| shielder | plasmaBlade:combo | chain → push | sniper |
| sniper | plasmaBlade:combo | chain → push | scatter |
| turret | plasmaBlade:combo | chain → push | scatter |

## Ścieżki — pojedyncze TTK, otwarta przestrzeń (informacyjnie)

| Wróg | Ostrze TTK (s) | Moc TTK (s) | Strzelec TTK (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | W przedziale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| assaulter | 0.417 | 0.017 | 0.017 | 0.017 | 25.000 | 1.000 | 1.000 | NIE |
| drone | 0.083 | 0.017 | 0.017 | 0.017 | 5.000 | 1.000 | 1.000 | NIE |
| executor | 1.583 | 0.617 | 1.267 | 1.267 | 1.250 | 0.487 | 1.000 | NIE |
| gunner | 0.250 | 0.017 | 0.017 | 0.017 | 15.000 | 1.000 | 1.000 | NIE |
| hacker | 0.083 | 0.017 | 0.017 | 0.017 | 5.000 | 1.000 | 1.000 | NIE |
| helixGuard | 0.250 | 0.017 | 0.017 | 0.017 | 15.000 | 1.000 | 1.000 | NIE |
| helixMedic | 0.250 | 0.017 | 0.017 | 0.017 | 15.000 | 1.000 | 1.000 | NIE |
| rozstrojony | 0.250 | 0.017 | 0.017 | 0.017 | 15.000 | 1.000 | 1.000 | NIE |
| shielder | 0.417 | 0.017 | 0.017 | 0.017 | 25.000 | 1.000 | 1.000 | NIE |
| sniper | 0.250 | 0.017 | 0.017 | 0.017 | 15.000 | 1.000 | 1.000 | NIE |
| turret | 0.417 | 0.017 | 0.017 | 0.017 | 25.000 | 1.000 | 1.000 | NIE |

| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |
| --- | --- | --- | --- |
| assaulter | plasmaBlade:combo | chain → push | scatter |
| drone | plasmaBlade:combo | chain → push | scatter |
| executor | plasmaBlade:combo | chain → push | sniper |
| gunner | plasmaBlade:combo | chain → push | scatter |
| hacker | plasmaBlade:combo | chain → push | scatter |
| helixGuard | plasmaBlade:combo | chain → push | scatter |
| helixMedic | plasmaBlade:combo | chain → push | scatter |
| rozstrojony | plasmaBlade:combo | chain → push | scatter |
| shielder | plasmaBlade:combo | chain → push | sniper |
| sniper | plasmaBlade:combo | chain → push | scatter |
| turret | plasmaBlade:combo | chain → push | scatter |

## Każda broń, moc i ostrze — otwarta przestrzeń

| Narzędzie | Wróg | TTK (s) | DPS (HP/s) | TTK paczki ×5 (s) | DPS paczki (HP/s) |
| --- | --- | ---: | ---: | ---: | ---: |
| Laser ciągły (beam) | assaulter | 1.500 | 40.000 | 19.883 | 15.088 |
| Laser ciągły (beam) | drone | 0.500 | 36.000 | 5.583 | 16.119 |
| Laser ciągły (beam) | executor | 13.233 | 16.625 | 78.633 | 13.989 |
| Laser ciągły (beam) | gunner | 1.200 | 37.500 | 15.283 | 14.722 |
| Laser ciągły (beam) | hacker | 0.600 | 40.000 | 6.083 | 19.726 |
| Laser ciągły (beam) | helixGuard | 3.533 | 20.377 | 27.033 | 13.317 |
| Laser ciągły (beam) | helixMedic | 0.800 | 40.000 | 10.183 | 15.712 |
| Laser ciągły (beam) | rozstrojony | 1.200 | 37.500 | 15.283 | 14.722 |
| Laser ciągły (beam) | shielder | 3.833 | 23.478 | 31.633 | 14.226 |
| Laser ciągły (beam) | sniper | 0.900 | 38.889 | 10.683 | 16.381 |
| Laser ciągły (beam) | turret | 3.333 | 21.000 | 24.483 | 14.295 |
| Blaster (blaster) | assaulter | 0.350 | 171.429 | 5.017 | 59.801 |
| Blaster (blaster) | drone | 0.017 | 1080.000 | 0.683 | 131.707 |
| Blaster (blaster) | executor | 3.017 | 72.928 | 22.350 | 49.217 |
| Blaster (blaster) | gunner | 0.350 | 128.571 | 5.017 | 44.850 |
| Blaster (blaster) | hacker | 0.183 | 130.909 | 2.850 | 42.105 |
| Blaster (blaster) | helixGuard | 0.517 | 139.355 | 7.183 | 50.116 |
| Blaster (blaster) | helixMedic | 0.183 | 174.545 | 2.850 | 56.140 |
| Blaster (blaster) | rozstrojony | 0.350 | 128.571 | 5.017 | 44.850 |
| Blaster (blaster) | shielder | 0.683 | 131.707 | 9.350 | 48.128 |
| Blaster (blaster) | sniper | 0.183 | 190.909 | 2.850 | 61.404 |
| Blaster (blaster) | turret | 0.517 | 135.484 | 7.183 | 48.724 |
| Kusza magnetyczna (crossbow) | assaulter | 0.017 | 3600.000 | 4.483 | 66.914 |
| Kusza magnetyczna (crossbow) | drone | 0.017 | 1080.000 | 4.483 | 20.074 |
| Kusza magnetyczna (crossbow) | executor | 0.017 | 13200.000 | 4.483 | 245.353 |
| Kusza magnetyczna (crossbow) | gunner | 0.017 | 2700.000 | 4.483 | 50.186 |
| Kusza magnetyczna (crossbow) | hacker | 0.017 | 1440.000 | 4.483 | 26.766 |
| Kusza magnetyczna (crossbow) | helixGuard | 0.017 | 4320.000 | 4.483 | 80.297 |
| Kusza magnetyczna (crossbow) | helixMedic | 0.017 | 1920.000 | 4.483 | 35.688 |
| Kusza magnetyczna (crossbow) | rozstrojony | 0.017 | 2700.000 | 4.483 | 50.186 |
| Kusza magnetyczna (crossbow) | shielder | 0.017 | 5400.000 | 4.483 | 100.372 |
| Kusza magnetyczna (crossbow) | sniper | 0.017 | 2100.000 | 4.483 | 39.033 |
| Kusza magnetyczna (crossbow) | turret | 0.017 | 4200.000 | 4.483 | 78.067 |
| Granat EMP (emp) | assaulter | 5.267 | 11.392 | 35.267 | 8.507 |
| Granat EMP (emp) | drone | 1.267 | 14.211 | 12.767 | 7.050 |
| Granat EMP (emp) | executor | 24.767 | 8.883 | ∞ | 8.250 |
| Granat EMP (emp) | gunner | 3.767 | 11.947 | 27.767 | 8.103 |
| Granat EMP (emp) | hacker | 1.267 | 18.947 | 12.767 | 9.399 |
| Granat EMP (emp) | helixGuard | 8.267 | 8.710 | 50.267 | 7.162 |
| Granat EMP (emp) | helixMedic | 2.517 | 12.715 | 20.267 | 7.895 |
| Granat EMP (emp) | rozstrojony | 3.767 | 11.947 | 27.767 | 8.103 |
| Granat EMP (emp) | shielder | 9.767 | 9.215 | 57.767 | 7.790 |
| Granat EMP (emp) | sniper | 2.517 | 13.907 | 20.267 | 8.635 |
| Granat EMP (emp) | turret | 6.767 | 10.345 | 42.767 | 8.184 |
| Pistolet (pistol) | assaulter | 0.267 | 225.000 | 2.267 | 132.353 |
| Pistolet (pistol) | drone | 0.017 | 1080.000 | 1.017 | 88.525 |
| Pistolet (pistol) | executor | 1.517 | 145.055 | 13.517 | 81.381 |
| Pistolet (pistol) | gunner | 0.267 | 168.750 | 2.267 | 99.265 |
| Pistolet (pistol) | hacker | 0.017 | 1440.000 | 1.017 | 118.033 |
| Pistolet (pistol) | helixGuard | 0.517 | 139.355 | 4.767 | 75.524 |
| Pistolet (pistol) | helixMedic | 0.017 | 1920.000 | 1.017 | 157.377 |
| Pistolet (pistol) | rozstrojony | 0.267 | 168.750 | 2.267 | 99.265 |
| Pistolet (pistol) | shielder | 0.517 | 174.194 | 4.767 | 94.406 |
| Pistolet (pistol) | sniper | 0.267 | 131.250 | 2.267 | 77.206 |
| Pistolet (pistol) | turret | 0.517 | 135.484 | 4.767 | 73.427 |
| Rewolwer (revolver) | assaulter | 0.017 | 3600.000 | 2.150 | 139.535 |
| Rewolwer (revolver) | drone | 0.017 | 1080.000 | 2.150 | 41.860 |
| Rewolwer (revolver) | executor | 1.083 | 203.077 | 8.450 | 130.178 |
| Rewolwer (revolver) | gunner | 0.017 | 2700.000 | 2.150 | 104.651 |
| Rewolwer (revolver) | hacker | 0.017 | 1440.000 | 2.150 | 55.814 |
| Rewolwer (revolver) | helixGuard | 0.017 | 4320.000 | 2.150 | 167.442 |
| Rewolwer (revolver) | helixMedic | 0.017 | 1920.000 | 2.150 | 74.419 |
| Rewolwer (revolver) | rozstrojony | 0.017 | 2700.000 | 2.150 | 104.651 |
| Rewolwer (revolver) | shielder | 0.017 | 5400.000 | 2.150 | 209.302 |
| Rewolwer (revolver) | sniper | 0.017 | 2100.000 | 2.150 | 81.395 |
| Rewolwer (revolver) | turret | 0.017 | 4200.000 | 2.150 | 162.791 |
| Karabin (rifle) | assaulter | 0.417 | 144.000 | 6.617 | 45.340 |
| Karabin (rifle) | drone | 0.117 | 154.286 | 0.917 | 98.182 |
| Karabin (rifle) | executor | 4.617 | 47.653 | 30.417 | 36.164 |
| Karabin (rifle) | gunner | 0.317 | 142.105 | 4.717 | 47.703 |
| Karabin (rifle) | hacker | 0.117 | 205.714 | 0.917 | 130.909 |
| Karabin (rifle) | helixGuard | 0.617 | 116.757 | 10.417 | 34.560 |
| Karabin (rifle) | helixMedic | 0.217 | 147.692 | 2.817 | 56.805 |
| Karabin (rifle) | rozstrojony | 0.317 | 142.105 | 4.717 | 47.703 |
| Karabin (rifle) | shielder | 0.717 | 125.581 | 10.917 | 41.221 |
| Karabin (rifle) | sniper | 0.217 | 161.538 | 2.817 | 62.130 |
| Karabin (rifle) | turret | 0.517 | 135.484 | 8.517 | 41.096 |
| Rozpraszacz (scatter) | assaulter | 0.017 | 3600.000 | 2.683 | 111.801 |
| Rozpraszacz (scatter) | drone | 0.017 | 1080.000 | 2.683 | 33.540 |
| Rozpraszacz (scatter) | executor | 1.350 | 162.963 | 11.017 | 99.849 |
| Rozpraszacz (scatter) | gunner | 0.017 | 2700.000 | 2.683 | 83.851 |
| Rozpraszacz (scatter) | hacker | 0.017 | 1440.000 | 2.683 | 44.720 |
| Rozpraszacz (scatter) | helixGuard | 0.017 | 4320.000 | 2.683 | 134.161 |
| Rozpraszacz (scatter) | helixMedic | 0.017 | 1920.000 | 2.683 | 59.627 |
| Rozpraszacz (scatter) | rozstrojony | 0.017 | 2700.000 | 2.683 | 83.851 |
| Rozpraszacz (scatter) | shielder | 0.683 | 131.707 | 6.850 | 65.693 |
| Rozpraszacz (scatter) | sniper | 0.017 | 2100.000 | 2.683 | 65.217 |
| Rozpraszacz (scatter) | turret | 0.017 | 4200.000 | 2.683 | 130.435 |
| Pistolet maszynowy (smg) | assaulter | 0.483 | 124.138 | 5.483 | 54.711 |
| Pistolet maszynowy (smg) | drone | 0.150 | 120.000 | 0.950 | 94.737 |
| Pistolet maszynowy (smg) | executor | 3.250 | 67.692 | 25.050 | 43.912 |
| Pistolet maszynowy (smg) | gunner | 0.350 | 128.571 | 3.383 | 66.502 |
| Pistolet maszynowy (smg) | hacker | 0.150 | 160.000 | 0.950 | 126.316 |
| Pistolet maszynowy (smg) | helixGuard | 0.617 | 116.757 | 7.583 | 47.473 |
| Pistolet maszynowy (smg) | helixMedic | 0.217 | 147.692 | 2.717 | 58.896 |
| Pistolet maszynowy (smg) | rozstrojony | 0.350 | 128.571 | 3.383 | 66.502 |
| Pistolet maszynowy (smg) | shielder | 0.750 | 120.000 | 9.683 | 46.472 |
| Pistolet maszynowy (smg) | sniper | 0.283 | 123.529 | 3.050 | 57.377 |
| Pistolet maszynowy (smg) | turret | 0.550 | 127.273 | 7.250 | 48.276 |
| Snajperka (sniper) | assaulter | 0.017 | 3600.000 | 5.017 | 59.801 |
| Snajperka (sniper) | drone | 0.017 | 1080.000 | 5.017 | 17.940 |
| Snajperka (sniper) | executor | 1.267 | 173.684 | 11.267 | 97.633 |
| Snajperka (sniper) | gunner | 0.017 | 2700.000 | 5.017 | 44.850 |
| Snajperka (sniper) | hacker | 0.017 | 1440.000 | 5.017 | 23.920 |
| Snajperka (sniper) | helixGuard | 0.017 | 4320.000 | 5.017 | 71.761 |
| Snajperka (sniper) | helixMedic | 0.017 | 1920.000 | 5.017 | 31.894 |
| Snajperka (sniper) | rozstrojony | 0.017 | 2700.000 | 5.017 | 44.850 |
| Snajperka (sniper) | shielder | 0.017 | 5400.000 | 5.017 | 89.701 |
| Snajperka (sniper) | sniper | 0.017 | 2100.000 | 5.017 | 34.884 |
| Snajperka (sniper) | turret | 0.017 | 4200.000 | 5.017 | 69.767 |
| Błyskawica (chain) | assaulter | 0.017 | 3600.000 | 1.683 | 178.218 |
| Błyskawica (chain) | drone | 0.017 | 1080.000 | 1.683 | 53.465 |
| Błyskawica (chain) | executor | 0.850 | 258.824 | 15.783 | 69.694 |
| Błyskawica (chain) | gunner | 0.017 | 2700.000 | 1.683 | 133.663 |
| Błyskawica (chain) | hacker | 0.017 | 1440.000 | 1.683 | 71.287 |
| Błyskawica (chain) | helixGuard | 0.433 | 166.154 | 3.767 | 95.575 |
| Błyskawica (chain) | helixMedic | 0.017 | 1920.000 | 1.683 | 95.050 |
| Błyskawica (chain) | rozstrojony | 0.017 | 2700.000 | 1.683 | 133.663 |
| Błyskawica (chain) | shielder | 0.433 | 207.692 | 3.767 | 119.469 |
| Błyskawica (chain) | sniper | 0.017 | 2100.000 | 1.683 | 103.960 |
| Błyskawica (chain) | turret | 0.433 | 161.538 | 3.767 | 92.920 |
| Pchnięcie Rezonansu (push) | assaulter | 0.617 | 97.297 | 5.417 | 55.385 |
| Pchnięcie Rezonansu (push) | drone | 0.017 | 1080.000 | 2.417 | 37.241 |
| Pchnięcie Rezonansu (push) | executor | 3.617 | 60.829 | 65.433 | 16.811 |
| Pchnięcie Rezonansu (push) | gunner | 0.617 | 72.973 | 5.417 | 41.538 |
| Pchnięcie Rezonansu (push) | hacker | 0.017 | 1440.000 | 2.417 | 49.655 |
| Pchnięcie Rezonansu (push) | helixGuard | 1.217 | 59.178 | 17.433 | 20.650 |
| Pchnięcie Rezonansu (push) | helixMedic | 0.017 | 1920.000 | 2.417 | 66.207 |
| Pchnięcie Rezonansu (push) | rozstrojony | 0.617 | 72.973 | 5.417 | 41.538 |
| Pchnięcie Rezonansu (push) | shielder | 1.217 | 73.973 | 17.433 | 25.813 |
| Pchnięcie Rezonansu (push) | sniper | 0.017 | 2100.000 | 2.417 | 72.414 |
| Pchnięcie Rezonansu (push) | turret | 0.617 | 113.514 | 5.417 | 64.615 |
| Fala uderzeniowa (shockwave) | assaulter | 15.150 | 3.960 | 101.550 | 2.954 |
| Fala uderzeniowa (shockwave) | drone | 1.533 | 11.739 | 29.550 | 3.046 |
| Fala uderzeniowa (shockwave) | executor | 72.750 | 3.024 | ∞ | 2.917 |
| Fala uderzeniowa (shockwave) | gunner | 11.550 | 3.896 | 83.550 | 2.693 |
| Fala uderzeniowa (shockwave) | hacker | 4.350 | 5.517 | 47.550 | 2.524 |
| Fala uderzeniowa (shockwave) | helixGuard | 22.350 | 3.221 | ∞ | 2.650 |
| Fala uderzeniowa (shockwave) | helixMedic | 7.950 | 4.025 | 65.550 | 2.441 |
| Fala uderzeniowa (shockwave) | rozstrojony | 11.550 | 3.896 | 83.550 | 2.693 |
| Fala uderzeniowa (shockwave) | shielder | 25.950 | 3.468 | ∞ | 2.917 |
| Fala uderzeniowa (shockwave) | sniper | 7.950 | 4.403 | 65.550 | 2.670 |
| Fala uderzeniowa (shockwave) | turret | 18.750 | 3.733 | 119.550 | 2.928 |
| Ostrze: combo lekkie (plasmaBlade:combo) | assaulter | 0.417 | 144.000 | 3.083 | 97.297 |
| Ostrze: combo lekkie (plasmaBlade:combo) | drone | 0.083 | 216.000 | 0.917 | 98.182 |
| Ostrze: combo lekkie (plasmaBlade:combo) | executor | 1.583 | 138.947 | 8.250 | 133.333 |
| Ostrze: combo lekkie (plasmaBlade:combo) | gunner | 0.250 | 180.000 | 2.083 | 108.000 |
| Ostrze: combo lekkie (plasmaBlade:combo) | hacker | 0.083 | 288.000 | 0.917 | 130.909 |
| Ostrze: combo lekkie (plasmaBlade:combo) | helixGuard | 0.250 | 288.000 | 2.083 | 172.800 |
| Ostrze: combo lekkie (plasmaBlade:combo) | helixMedic | 0.250 | 128.000 | 1.583 | 101.053 |
| Ostrze: combo lekkie (plasmaBlade:combo) | rozstrojony | 0.250 | 180.000 | 2.083 | 108.000 |
| Ostrze: combo lekkie (plasmaBlade:combo) | shielder | 0.417 | 216.000 | 3.083 | 145.946 |
| Ostrze: combo lekkie (plasmaBlade:combo) | sniper | 0.250 | 140.000 | 1.583 | 110.526 |
| Ostrze: combo lekkie (plasmaBlade:combo) | turret | 0.417 | 168.000 | 3.083 | 113.514 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | assaulter | 0.667 | 90.000 | 5.333 | 56.250 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | drone | 0.083 | 216.000 | 2.417 | 37.241 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | executor | 2.417 | 91.034 | 14.083 | 78.107 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | gunner | 0.667 | 67.500 | 5.333 | 42.188 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | hacker | 0.083 | 288.000 | 2.417 | 49.655 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | helixGuard | 0.667 | 108.000 | 5.333 | 67.500 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | helixMedic | 0.667 | 48.000 | 5.333 | 30.000 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | rozstrojony | 0.667 | 67.500 | 5.333 | 42.188 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | shielder | 0.667 | 135.000 | 5.333 | 84.375 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | sniper | 0.667 | 52.500 | 5.333 | 32.813 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | turret | 0.667 | 105.000 | 5.333 | 65.625 |

## Wariant przy ścianie — TTK paczki ×5 (informacyjnie)

| Wróg | Ostrze paczki (s) | Moc paczki (s) | Strzelec paczki (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | W przedziale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| assaulter | 3.083 | 2.433 | 2.683 | 2.683 | 1.149 | 0.907 | 1.000 | TAK |
| drone | 0.917 | 2.417 | 0.917 | 0.917 | 1.000 | 2.636 | 1.000 | NIE |
| executor | 8.250 | 29.433 | 11.017 | 11.017 | 0.749 | 2.672 | 1.000 | NIE |
| gunner | 2.083 | 2.433 | 2.683 | 2.433 | 0.856 | 1.000 | 1.103 | TAK |
| hacker | 0.917 | 2.417 | 0.917 | 0.917 | 1.000 | 2.636 | 1.000 | NIE |
| helixGuard | 2.083 | 5.417 | 2.683 | 2.683 | 0.776 | 2.019 | 1.000 | NIE |
| helixMedic | 1.583 | 2.417 | 2.683 | 2.417 | 0.655 | 1.000 | 1.110 | TAK |
| rozstrojony | 2.083 | 2.433 | 2.683 | 2.433 | 0.856 | 1.000 | 1.103 | TAK |
| shielder | 3.083 | 5.417 | 5.017 | 5.017 | 0.615 | 1.080 | 1.000 | TAK |
| sniper | 1.583 | 2.417 | 2.683 | 2.417 | 0.655 | 1.000 | 1.110 | TAK |
| turret | 3.083 | 5.417 | 2.683 | 3.083 | 1.000 | 1.757 | 0.870 | TAK |

| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |
| --- | --- | --- | --- |
| assaulter | plasmaBlade:combo | chain → push | scatter |
| drone | plasmaBlade:combo | chain → push | rifle |
| executor | plasmaBlade:combo | chain → push | scatter |
| gunner | plasmaBlade:combo | chain → push | scatter |
| hacker | plasmaBlade:combo | chain → push | rifle |
| helixGuard | plasmaBlade:combo | chain → push | scatter |
| helixMedic | plasmaBlade:combo | chain → push | scatter |
| rozstrojony | plasmaBlade:combo | chain → push | scatter |
| shielder | plasmaBlade:combo | chain → push | sniper |
| sniper | plasmaBlade:combo | chain → push | scatter |
| turret | plasmaBlade:combo | chain → push | scatter |

### Wariant przy ścianie — pojedyncze TTK

| Wróg | Ostrze TTK (s) | Moc TTK (s) | Strzelec TTK (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | W przedziale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| assaulter | 0.417 | 0.033 | 0.017 | 0.033 | 12.500 | 1.000 | 0.500 | NIE |
| drone | 0.083 | 0.017 | 0.017 | 0.017 | 5.000 | 1.000 | 1.000 | NIE |
| executor | 1.583 | 1.817 | 1.267 | 1.583 | 1.000 | 1.147 | 0.800 | TAK |
| gunner | 0.250 | 0.033 | 0.017 | 0.033 | 7.500 | 1.000 | 0.500 | NIE |
| hacker | 0.083 | 0.017 | 0.017 | 0.017 | 5.000 | 1.000 | 1.000 | NIE |
| helixGuard | 0.250 | 0.617 | 0.017 | 0.250 | 1.000 | 2.467 | 0.067 | NIE |
| helixMedic | 0.250 | 0.017 | 0.017 | 0.017 | 15.000 | 1.000 | 1.000 | NIE |
| rozstrojony | 0.250 | 0.033 | 0.017 | 0.033 | 7.500 | 1.000 | 0.500 | NIE |
| shielder | 0.417 | 0.617 | 0.017 | 0.417 | 1.000 | 1.480 | 0.040 | NIE |
| sniper | 0.250 | 0.017 | 0.017 | 0.017 | 15.000 | 1.000 | 1.000 | NIE |
| turret | 0.417 | 0.617 | 0.017 | 0.417 | 1.000 | 1.480 | 0.040 | NIE |

| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |
| --- | --- | --- | --- |
| assaulter | plasmaBlade:combo | chain → push | scatter |
| drone | plasmaBlade:combo | chain → push | scatter |
| executor | plasmaBlade:combo | chain → push | sniper |
| gunner | plasmaBlade:combo | chain → push | scatter |
| hacker | plasmaBlade:combo | chain → push | scatter |
| helixGuard | plasmaBlade:combo | chain → push | scatter |
| helixMedic | plasmaBlade:combo | chain → push | scatter |
| rozstrojony | plasmaBlade:combo | chain → push | scatter |
| shielder | plasmaBlade:combo | chain → push | sniper |
| sniper | plasmaBlade:combo | chain → push | scatter |
| turret | plasmaBlade:combo | chain → push | scatter |

### Moce przy ścianie (tylko narzędzia, których wynik różni się od otwartej przestrzeni)

| Narzędzie | Wróg | TTK (s) | DPS (HP/s) | TTK paczki ×5 (s) | DPS paczki (HP/s) |
| --- | --- | ---: | ---: | ---: | ---: |
| Błyskawica (chain) | assaulter | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | drone | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | executor | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | gunner | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | hacker | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | helixGuard | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | helixMedic | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | rozstrojony | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | shielder | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | sniper | ∞ | 0.000 | ∞ | 0.000 |
| Błyskawica (chain) | turret | ∞ | 0.000 | ∞ | 0.000 |
| Pchnięcie Rezonansu (push) | assaulter | 0.033 | 1800.000 | 2.433 | 123.288 |
| Pchnięcie Rezonansu (push) | drone | 0.017 | 1080.000 | 2.417 | 37.241 |
| Pchnięcie Rezonansu (push) | executor | 1.817 | 121.101 | 29.433 | 37.373 |
| Pchnięcie Rezonansu (push) | gunner | 0.033 | 1350.000 | 2.433 | 92.466 |
| Pchnięcie Rezonansu (push) | hacker | 0.017 | 1440.000 | 2.417 | 49.655 |
| Pchnięcie Rezonansu (push) | helixGuard | 0.617 | 116.757 | 5.417 | 66.462 |
| Pchnięcie Rezonansu (push) | helixMedic | 0.017 | 1920.000 | 2.417 | 66.207 |
| Pchnięcie Rezonansu (push) | rozstrojony | 0.033 | 1350.000 | 2.433 | 92.466 |
| Pchnięcie Rezonansu (push) | shielder | 0.617 | 145.946 | 5.417 | 83.077 |
| Pchnięcie Rezonansu (push) | sniper | 0.017 | 2100.000 | 2.417 | 72.414 |
| Pchnięcie Rezonansu (push) | turret | 0.617 | 113.514 | 5.417 | 64.615 |
| Fala uderzeniowa (shockwave) | assaulter | 1.550 | 38.710 | 29.567 | 10.147 |
| Fala uderzeniowa (shockwave) | drone | 0.033 | 540.000 | 11.567 | 7.781 |
| Fala uderzeniowa (shockwave) | executor | 22.350 | 9.843 | ∞ | 8.083 |
| Fala uderzeniowa (shockwave) | gunner | 1.550 | 29.032 | 29.567 | 7.610 |
| Fala uderzeniowa (shockwave) | hacker | 0.033 | 720.000 | 11.567 | 10.375 |
| Fala uderzeniowa (shockwave) | helixGuard | 4.367 | 16.489 | 47.567 | 7.568 |
| Fala uderzeniowa (shockwave) | helixMedic | 1.533 | 20.870 | 29.550 | 5.415 |
| Fala uderzeniowa (shockwave) | rozstrojony | 1.550 | 29.032 | 29.567 | 7.610 |
| Fala uderzeniowa (shockwave) | shielder | 4.367 | 20.611 | 47.567 | 9.460 |
| Fala uderzeniowa (shockwave) | sniper | 1.533 | 22.826 | 29.550 | 5.922 |
| Fala uderzeniowa (shockwave) | turret | 4.350 | 16.092 | 47.550 | 7.361 |

## Bossowie — pojedyncze starcia (informacyjnie)

Symulacja korzysta z progów HP i wzorców faz z danych bossa oraz długości nietykalności z `tuning.enemies.phaseShiftS`. Gracz ponawia ataki także podczas przejść i działania tarczy. Pojedynki z bossami są liczone poza bramką F2.

### Otwarta przestrzeń

| Wróg | Ostrze TTK (s) | Moc TTK (s) | Strzelec TTK (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | W przedziale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| orbisDirector | 6.917 | 15.917 | 6.267 | 6.917 | 1.000 | 2.301 | 0.906 | NIE |
| securityChief | 8.417 | 23.717 | 6.267 | 8.417 | 1.000 | 2.818 | 0.745 | NIE |

| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |
| --- | --- | --- | --- |
| orbisDirector | plasmaBlade:combo | chain → push | sniper |
| securityChief | plasmaBlade:combo | chain → push | sniper |

| Narzędzie | Boss | TTK (s) | DPS (HP/s) | Wejścia w fazy (s) |
| --- | --- | ---: | ---: | --- |
| Laser ciągły (beam) | orbisDirector | 50.633 | 14.220 | 1 (0.000) → 2 (15.583) → 3 (34.283) |
| Laser ciągły (beam) | securityChief | 95.183 | 9.455 | 1 (0.000) → 2 (20.283) → 3 (43.683) |
| Blaster (blaster) | orbisDirector | 15.683 | 45.909 | 1 (0.000) → 2 (3.350) → 3 (9.517) |
| Blaster (blaster) | securityChief | 20.517 | 43.867 | 1 (0.000) → 2 (5.183) → 3 (13.517) |
| Kusza magnetyczna (crossbow) | orbisDirector | 2.250 | 320.000 | 1 (0.000) → 2 (0.017) → 3 (1.133) |
| Kusza magnetyczna (crossbow) | securityChief | 4.483 | 200.743 | 1 (0.000) → 2 (1.133) → 3 (3.367) |
| Granat EMP (emp) | orbisDirector | 87.767 | 8.204 | 1 (0.000) → 2 (29.267) → 3 (60.767) |
| Granat EMP (emp) | securityChief | ∞ | 6.333 | 1 (0.000) → 2 (36.767) → 3 (75.767) |
| Pistolet (pistol) | orbisDirector | 8.767 | 82.129 | 1 (0.000) → 2 (1.767) → 3 (5.767) |
| Pistolet (pistol) | securityChief | 13.267 | 67.839 | 1 (0.000) → 2 (2.267) → 3 (7.767) |
| Rewolwer (revolver) | orbisDirector | 5.350 | 134.579 | 1 (0.000) → 2 (1.083) → 3 (3.217) |
| Rewolwer (revolver) | securityChief | 6.417 | 140.260 | 1 (0.000) → 2 (1.617) → 3 (4.283) |
| Karabin (rifle) | orbisDirector | 18.917 | 38.062 | 1 (0.000) → 2 (4.817) → 3 (12.617) |
| Karabin (rifle) | securityChief | 24.817 | 36.266 | 1 (0.000) → 2 (6.817) → 3 (16.617) |
| Rozpraszacz (scatter) | orbisDirector | 8.183 | 87.984 | 1 (0.000) → 2 (2.017) → 3 (5.350) |
| Rozpraszacz (scatter) | securityChief | 8.850 | 101.695 | 1 (0.000) → 2 (2.017) → 3 (5.350) |
| Pistolet maszynowy (smg) | orbisDirector | 18.150 | 39.669 | 1 (0.000) → 2 (4.950) → 3 (11.983) |
| Pistolet maszynowy (smg) | securityChief | 22.217 | 40.510 | 1 (0.000) → 2 (5.483) → 3 (13.950) |
| Snajperka (sniper) | orbisDirector | 6.267 | 114.894 | 1 (0.000) → 2 (1.267) → 3 (3.767) |
| Snajperka (sniper) | securityChief | 6.267 | 143.617 | 1 (0.000) → 2 (1.267) → 3 (3.767) |
| Błyskawica (chain) | orbisDirector | 9.150 | 78.689 | 1 (0.000) → 2 (1.267) → 3 (3.767) |
| Błyskawica (chain) | securityChief | 15.783 | 57.022 | 1 (0.000) → 2 (1.683) → 3 (6.183) |
| Pchnięcie Rezonansu (push) | orbisDirector | 32.033 | 22.477 | 1 (0.000) → 2 (4.217) → 3 (22.233) |
| Pchnięcie Rezonansu (push) | securityChief | 60.633 | 14.843 | 1 (0.000) → 2 (4.817) → 3 (27.033) |
| Fala uderzeniowa (shockwave) | orbisDirector | ∞ | 2.850 | 1 (0.000) → 2 (87.150) |
| Fala uderzeniowa (shockwave) | securityChief | ∞ | 2.875 | 1 (0.000) → 2 (108.750) |
| Ostrze: combo lekkie (plasmaBlade:combo) | orbisDirector | 6.917 | 104.096 | 1 (0.000) → 2 (1.750) → 3 (4.417) |
| Ostrze: combo lekkie (plasmaBlade:combo) | securityChief | 8.417 | 106.931 | 1 (0.000) → 2 (2.250) → 3 (5.583) |
| Ostrze: ciężki atak (plasmaBlade:heavy) | orbisDirector | 10.000 | 72.000 | 1 (0.000) → 2 (3.000) → 3 (6.500) |
| Ostrze: ciężki atak (plasmaBlade:heavy) | securityChief | 11.167 | 80.597 | 1 (0.000) → 2 (3.000) → 3 (7.083) |

### Przy ścianie

| Wróg | Ostrze TTK (s) | Moc TTK (s) | Strzelec TTK (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | W przedziale |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| orbisDirector | 6.917 | 15.033 | 6.267 | 6.917 | 1.000 | 2.173 | 0.906 | NIE |
| securityChief | 8.417 | 22.233 | 6.267 | 8.417 | 1.000 | 2.642 | 0.745 | NIE |

| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |
| --- | --- | --- | --- |
| orbisDirector | plasmaBlade:combo | chain → push | sniper |
| securityChief | plasmaBlade:combo | chain → push | sniper |

| Narzędzie | Boss | TTK (s) | DPS (HP/s) | Wejścia w fazy (s) |
| --- | --- | ---: | ---: | --- |
| Laser ciągły (beam) | orbisDirector | 50.633 | 14.220 | 1 (0.000) → 2 (15.583) → 3 (34.283) |
| Laser ciągły (beam) | securityChief | 95.183 | 9.455 | 1 (0.000) → 2 (20.283) → 3 (43.683) |
| Blaster (blaster) | orbisDirector | 15.683 | 45.909 | 1 (0.000) → 2 (3.350) → 3 (9.517) |
| Blaster (blaster) | securityChief | 20.517 | 43.867 | 1 (0.000) → 2 (5.183) → 3 (13.517) |
| Kusza magnetyczna (crossbow) | orbisDirector | 2.250 | 320.000 | 1 (0.000) → 2 (0.017) → 3 (1.133) |
| Kusza magnetyczna (crossbow) | securityChief | 4.483 | 200.743 | 1 (0.000) → 2 (1.133) → 3 (3.367) |
| Granat EMP (emp) | orbisDirector | 87.767 | 8.204 | 1 (0.000) → 2 (29.267) → 3 (60.767) |
| Granat EMP (emp) | securityChief | ∞ | 6.333 | 1 (0.000) → 2 (36.767) → 3 (75.767) |
| Pistolet (pistol) | orbisDirector | 8.767 | 82.129 | 1 (0.000) → 2 (1.767) → 3 (5.767) |
| Pistolet (pistol) | securityChief | 13.267 | 67.839 | 1 (0.000) → 2 (2.267) → 3 (7.767) |
| Rewolwer (revolver) | orbisDirector | 5.350 | 134.579 | 1 (0.000) → 2 (1.083) → 3 (3.217) |
| Rewolwer (revolver) | securityChief | 6.417 | 140.260 | 1 (0.000) → 2 (1.617) → 3 (4.283) |
| Karabin (rifle) | orbisDirector | 18.917 | 38.062 | 1 (0.000) → 2 (4.817) → 3 (12.617) |
| Karabin (rifle) | securityChief | 24.817 | 36.266 | 1 (0.000) → 2 (6.817) → 3 (16.617) |
| Rozpraszacz (scatter) | orbisDirector | 8.183 | 87.984 | 1 (0.000) → 2 (2.017) → 3 (5.350) |
| Rozpraszacz (scatter) | securityChief | 8.850 | 101.695 | 1 (0.000) → 2 (2.017) → 3 (5.350) |
| Pistolet maszynowy (smg) | orbisDirector | 18.150 | 39.669 | 1 (0.000) → 2 (4.950) → 3 (11.983) |
| Pistolet maszynowy (smg) | securityChief | 22.217 | 40.510 | 1 (0.000) → 2 (5.483) → 3 (13.950) |
| Snajperka (sniper) | orbisDirector | 6.267 | 114.894 | 1 (0.000) → 2 (1.267) → 3 (3.767) |
| Snajperka (sniper) | securityChief | 6.267 | 143.617 | 1 (0.000) → 2 (1.267) → 3 (3.767) |
| Błyskawica (chain) | orbisDirector | ∞ | 0.000 | 1 (0.000) |
| Błyskawica (chain) | securityChief | ∞ | 0.000 | 1 (0.000) |
| Pchnięcie Rezonansu (push) | orbisDirector | 15.033 | 47.894 | 1 (0.000) → 2 (1.833) → 3 (7.000) |
| Pchnięcie Rezonansu (push) | securityChief | 22.233 | 40.480 | 1 (0.000) → 2 (2.433) → 3 (7.850) |
| Fala uderzeniowa (shockwave) | orbisDirector | 87.150 | 8.262 | 1 (0.000) → 2 (25.967) → 3 (58.367) |
| Fala uderzeniowa (shockwave) | securityChief | ∞ | 6.500 | 1 (0.000) → 2 (33.167) → 3 (72.767) |
| Ostrze: combo lekkie (plasmaBlade:combo) | orbisDirector | 6.917 | 104.096 | 1 (0.000) → 2 (1.750) → 3 (4.417) |
| Ostrze: combo lekkie (plasmaBlade:combo) | securityChief | 8.417 | 106.931 | 1 (0.000) → 2 (2.250) → 3 (5.583) |
| Ostrze: ciężki atak (plasmaBlade:heavy) | orbisDirector | 10.000 | 72.000 | 1 (0.000) → 2 (3.000) → 3 (6.500) |
| Ostrze: ciężki atak (plasmaBlade:heavy) | securityChief | 11.167 | 80.597 | 1 (0.000) → 2 (3.000) → 3 (7.083) |

## Wnioski

- Bramka (paczka ×5, otwarta przestrzeń): 0/11 wrogów poza przedziałem (brak). Pojedyncze TTK (informacyjnie): 11/11. Przy ścianie (informacyjnie, paczka): 4/11.
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
