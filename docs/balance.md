# Balans F2 — symulacja TTK

Data wygenerowania (UTC): 2026-11-14. Generator: `npm run balance`.

**Bramka: NIEZALICZONA.** Otwarta przestrzeń: NIE; cel przy ścianie: NIE.
Dla każdego wroga każda ścieżka musi mieć TTK w [mediana / 2, mediana × 2]. Nieskończony TTK nie zalicza bramki. Ocena używa pełnej precyzji, tabele zaokrąglają do 0,001 s.

## Założenia

- Prawdziwe Weapon, createPower, PlasmaBlade, DamageSystem, StatusSystem, PlayerEnergy i Stats; stały krok SIM_DT = 1/60 s (0.017 s), limit 120 s na parę. Bez renderu, DOM i inicjalizacji Rapier.
- 100% celności. Nieruchomy, pojedynczy cel w zasięgu każdego narzędzia; brak czasu dojścia, lotu pocisku i odrzucania celu poza zasięg. Trafienia w korpus (mnożnik hurtboxa drona z danych), bez premii za głowę.
- Wszystkie śruty trafiają. Zgodnie z idealizacją briefu adapter sumuje na jednym celu także wszystkie przebicia z pierceFalloff. To optymistyczne skupienie obrażeń wielu celów: w grze ProjectileSystem nie trafia ponownie tej samej encji. Łańcuch mocy zachowuje własną regułę bez powtórzeń, więc na pojedynczym celu nie przeskakuje.
- Tarczownik atakowany z flanki: tarcza pominięta. Egzekutor nie paruje. Cel nie kontratakuje; ogłuszenie i wyładowanie obsługuje StatusSystem. Wyładowanie przeciążenia nie rani nosiciela, więc bez sąsiednich celów nie dodaje DPS.
- Każda para zaczyna z pełnym HP celu, pełną energią (100), zimną bronią, bez cooldownów i statusów. Bazy jak na arenie: regeneracja energii 25/s, pojemność ciepła 100, chłodzenie 45/s; opóźnienia i blokady z tuning.ts. Bez implantów i synergii.
- Półautomat ponawia wciśnięcie tak szybko, jak pozwala cooldown (zwolnienie spustu bez przesuwania zegarów przez cool(0)). Combo lekkie buforuje kolejne kliknięcia. Ciężki atak to rzeczywiste przytrzymanie i puszczenie po naładowaniu; zawiera poprzedzający go lekki cios wynikający z PlasmaBlade.
- Czas od wejścia do symulacji do końca kroku zabójstwa; pierwsze natychmiastowe trafienie ma TTK 1/60 s, nigdy 0. Jest to czas symulacji, bez pauz prezentacyjnego hitstopu i slowmo. DPS = faktycznie zdjęte HP / czas do śmierci (bez overkill); przy ∞ DPS = zdjęte HP / pełny limit. To DPS danego starcia, nie nieskończonego ostrzału.
- Ostrze: lepszy TTK combo lub ciężkiego z loadout blade. Strzelec: najlepsza pojedyncza broń loadout gunner, bez przełączania podczas walki. Moc: wszystkie ofensywne moce loadout resonance, oba sloty ponawiane w każdym kroku ze wspólną energią; sprawdzane wszystkie stałe priorytety slotów i wybierany najlepszy wynik dla wroga.
- Moce bez obrażeń pomijane; nieobsługiwany rodzaj mocy pomijany z ostrzeżeniem. Błędy walidacji danych gry nadal przerywają ładowanie.
- Brief nie określa ścian: raport pokazuje dwa warianty, bez rozstrzygania za koordynatora. Główne tabele: otwarta przestrzeń, bez wall-slam. Drugi wariant: ściana tuż za celem (0 m), dodatkowe obrażenia z ConePower w następnym kroku. Każdy wariant ma osobną medianę i bramkę.

## Ścieżki — otwarta przestrzeń

| Wróg | Ostrze TTK (s) | Moc TTK (s) | Strzelec TTK (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | Bramka |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| assaulter | 0.417 | 9.233 | 0.017 | 0.417 | 1.000 | 22.160 | 0.040 | NIE |
| drone | 0.083 | 0.017 | 0.017 | 0.017 | 5.000 | 1.000 | 1.000 | NIE |
| executor | 1.583 | 57.233 | 1.017 | 1.583 | 1.000 | 36.147 | 0.642 | NIE |
| gunner | 0.250 | 6.233 | 0.017 | 0.250 | 1.000 | 24.933 | 0.067 | NIE |
| shielder | 0.417 | 18.233 | 0.017 | 0.417 | 1.000 | 43.760 | 0.040 | NIE |
| sniper | 0.250 | 3.233 | 0.017 | 0.250 | 1.000 | 12.933 | 0.067 | NIE |

| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |
| --- | --- | --- | --- |
| assaulter | plasmaBlade:combo | push → shockwave | scatter |
| drone | plasmaBlade:combo | push → shockwave | scatter |
| executor | plasmaBlade:combo | push → shockwave | sniper |
| gunner | plasmaBlade:combo | push → shockwave | scatter |
| shielder | plasmaBlade:combo | push → shockwave | sniper |
| sniper | plasmaBlade:combo | push → shockwave | scatter |

## Każda broń, moc i ostrze — otwarta przestrzeń

| Narzędzie | Wróg | TTK (s) | DPS (HP/s) |
| --- | --- | ---: | ---: |
| Laser ciągły (beam) | assaulter | 1.500 | 40.000 |
| Laser ciągły (beam) | drone | 0.500 | 36.000 |
| Laser ciągły (beam) | executor | 13.233 | 16.625 |
| Laser ciągły (beam) | gunner | 1.200 | 37.500 |
| Laser ciągły (beam) | shielder | 3.833 | 23.478 |
| Laser ciągły (beam) | sniper | 0.900 | 38.889 |
| Blaster (blaster) | assaulter | 0.350 | 171.429 |
| Blaster (blaster) | drone | 0.017 | 1080.000 |
| Blaster (blaster) | executor | 3.017 | 72.928 |
| Blaster (blaster) | gunner | 0.350 | 128.571 |
| Blaster (blaster) | shielder | 0.683 | 131.707 |
| Blaster (blaster) | sniper | 0.183 | 190.909 |
| Granat EMP (emp) | assaulter | 5.267 | 11.392 |
| Granat EMP (emp) | drone | 1.267 | 14.211 |
| Granat EMP (emp) | executor | 24.767 | 8.883 |
| Granat EMP (emp) | gunner | 3.767 | 11.947 |
| Granat EMP (emp) | shielder | 9.767 | 9.215 |
| Granat EMP (emp) | sniper | 2.517 | 13.907 |
| Pistolet (pistol) | assaulter | 0.267 | 225.000 |
| Pistolet (pistol) | drone | 0.017 | 1080.000 |
| Pistolet (pistol) | executor | 1.517 | 145.055 |
| Pistolet (pistol) | gunner | 0.267 | 168.750 |
| Pistolet (pistol) | shielder | 0.517 | 174.194 |
| Pistolet (pistol) | sniper | 0.267 | 131.250 |
| Karabin (rifle) | assaulter | 0.417 | 144.000 |
| Karabin (rifle) | drone | 0.117 | 154.286 |
| Karabin (rifle) | executor | 4.617 | 47.653 |
| Karabin (rifle) | gunner | 0.317 | 142.105 |
| Karabin (rifle) | shielder | 0.717 | 125.581 |
| Karabin (rifle) | sniper | 0.217 | 161.538 |
| Rozpraszacz (scatter) | assaulter | 0.017 | 3600.000 |
| Rozpraszacz (scatter) | drone | 0.017 | 1080.000 |
| Rozpraszacz (scatter) | executor | 1.350 | 162.963 |
| Rozpraszacz (scatter) | gunner | 0.017 | 2700.000 |
| Rozpraszacz (scatter) | shielder | 0.683 | 131.707 |
| Rozpraszacz (scatter) | sniper | 0.017 | 2100.000 |
| Snajperka (sniper) | assaulter | 0.017 | 3600.000 |
| Snajperka (sniper) | drone | 0.017 | 1080.000 |
| Snajperka (sniper) | executor | 1.017 | 216.393 |
| Snajperka (sniper) | gunner | 0.017 | 2700.000 |
| Snajperka (sniper) | shielder | 0.017 | 5400.000 |
| Snajperka (sniper) | sniper | 0.017 | 2100.000 |
| Błyskawica (chain) | assaulter | 2.417 | 24.828 |
| Błyskawica (chain) | drone | 0.017 | 1080.000 |
| Błyskawica (chain) | executor | 24.433 | 9.004 |
| Błyskawica (chain) | gunner | 2.417 | 18.621 |
| Błyskawica (chain) | shielder | 8.433 | 10.672 |
| Błyskawica (chain) | sniper | 1.217 | 28.767 |
| Pchnięcie Rezonansu (push) | assaulter | 7.833 | 7.660 |
| Pchnięcie Rezonansu (push) | drone | 0.617 | 29.189 |
| Pchnięcie Rezonansu (push) | executor | 55.833 | 3.940 |
| Pchnięcie Rezonansu (push) | gunner | 4.833 | 9.310 |
| Pchnięcie Rezonansu (push) | shielder | 16.833 | 5.347 |
| Pchnięcie Rezonansu (push) | sniper | 1.817 | 19.266 |
| Fala uderzeniowa (shockwave) | assaulter | 15.150 | 3.960 |
| Fala uderzeniowa (shockwave) | drone | 1.533 | 11.739 |
| Fala uderzeniowa (shockwave) | executor | 72.750 | 3.024 |
| Fala uderzeniowa (shockwave) | gunner | 11.550 | 3.896 |
| Fala uderzeniowa (shockwave) | shielder | 25.950 | 3.468 |
| Fala uderzeniowa (shockwave) | sniper | 7.950 | 4.403 |
| Ostrze: combo lekkie (plasmaBlade:combo) | assaulter | 0.417 | 144.000 |
| Ostrze: combo lekkie (plasmaBlade:combo) | drone | 0.083 | 216.000 |
| Ostrze: combo lekkie (plasmaBlade:combo) | executor | 1.583 | 138.947 |
| Ostrze: combo lekkie (plasmaBlade:combo) | gunner | 0.250 | 180.000 |
| Ostrze: combo lekkie (plasmaBlade:combo) | shielder | 0.417 | 216.000 |
| Ostrze: combo lekkie (plasmaBlade:combo) | sniper | 0.250 | 140.000 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | assaulter | 0.667 | 90.000 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | drone | 0.083 | 216.000 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | executor | 2.417 | 91.034 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | gunner | 0.667 | 67.500 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | shielder | 0.667 | 135.000 |
| Ostrze: ciężki atak (plasmaBlade:heavy) | sniper | 0.667 | 52.500 |

## Wrażliwość na ścianę — ścieżki

| Wróg | Ostrze TTK (s) | Moc TTK (s) | Strzelec TTK (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | Bramka |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| assaulter | 0.417 | 0.033 | 0.017 | 0.033 | 12.500 | 1.000 | 0.500 | NIE |
| drone | 0.083 | 0.017 | 0.017 | 0.017 | 5.000 | 1.000 | 1.000 | NIE |
| executor | 1.583 | 9.250 | 1.017 | 1.583 | 1.000 | 5.842 | 0.642 | NIE |
| gunner | 0.250 | 0.033 | 0.017 | 0.033 | 7.500 | 1.000 | 0.500 | NIE |
| shielder | 0.417 | 0.633 | 0.017 | 0.417 | 1.000 | 1.520 | 0.040 | NIE |
| sniper | 0.250 | 0.033 | 0.017 | 0.033 | 7.500 | 1.000 | 0.500 | NIE |

| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |
| --- | --- | --- | --- |
| assaulter | plasmaBlade:combo | push → shockwave | scatter |
| drone | plasmaBlade:combo | push → shockwave | scatter |
| executor | plasmaBlade:combo | push → shockwave | sniper |
| gunner | plasmaBlade:combo | push → shockwave | scatter |
| shielder | plasmaBlade:combo | push → shockwave | sniper |
| sniper | plasmaBlade:combo | push → shockwave | scatter |

### Moce przy ścianie

| Narzędzie | Wróg | TTK (s) | DPS (HP/s) |
| --- | --- | ---: | ---: |
| Błyskawica (chain) | assaulter | ∞ | 0.000 |
| Błyskawica (chain) | drone | ∞ | 0.000 |
| Błyskawica (chain) | executor | ∞ | 0.000 |
| Błyskawica (chain) | gunner | ∞ | 0.000 |
| Błyskawica (chain) | shielder | ∞ | 0.000 |
| Błyskawica (chain) | sniper | ∞ | 0.000 |
| Pchnięcie Rezonansu (push) | assaulter | 0.633 | 94.737 |
| Pchnięcie Rezonansu (push) | drone | 0.033 | 540.000 |
| Pchnięcie Rezonansu (push) | executor | 7.850 | 28.025 |
| Pchnięcie Rezonansu (push) | gunner | 0.617 | 72.973 |
| Pchnięcie Rezonansu (push) | shielder | 1.217 | 73.973 |
| Pchnięcie Rezonansu (push) | sniper | 0.033 | 1050.000 |
| Fala uderzeniowa (shockwave) | assaulter | 1.550 | 38.710 |
| Fala uderzeniowa (shockwave) | drone | 0.033 | 540.000 |
| Fala uderzeniowa (shockwave) | executor | 22.350 | 9.843 |
| Fala uderzeniowa (shockwave) | gunner | 1.550 | 29.032 |
| Fala uderzeniowa (shockwave) | shielder | 4.367 | 20.611 |
| Fala uderzeniowa (shockwave) | sniper | 1.533 | 22.826 |

## Wnioski

- Otwarta przestrzeń: 6/6 wrogów poza bramką. Cel przy ścianie: 6/6 poza bramką.
- Jednostrzałowe zabójstwa Strzelca mają TTK jednego kroku, podczas gdy ostrze potrzebuje zamachu, a Moc kolejnych aktywacji. Ilorazy przy małym HP są przez to bardzo wrażliwe na obrażenia pojedynczego trafienia. Test nie ukrywa tego przez uśrednianie wrogów.
- Wynik jest liczbową podstawą decyzji o danych i założeniach bramki. Nie zastępuje playtestu 12 fal ani oceny feel. Liczby balansu w danych nie zostały zmienione.

## Propozycja do decyzji koordynatora (niezastosowana)

Historyczna próba pięciu zmian pól, jej dokładne wartości i wyniki są opisane w [specyfikacji symulatora](systems/balance.md#propozycja-danych-do-decyzji-koordynatora-2026-11-14). Dane gry nie zostały zmienione. Wybór wariantu otoczenia i kierunku strojenia wymaga decyzji koordynatora.

### Ograniczenie loadera nieznanych mocy

Symulator ostrzega i pomija nieobsługiwane rodzaje udostępnione przez rejestr. Obecny rejestr gry jednak waliduje wszystkie JSON-y przez powerSchema już podczas importu: rodzaj spoza jego unii przerwie import przed uruchomieniem symulatora. Pełne pomijanie surowego JSON-a z nieznanym kind wymaga zmiany loadera poza dozwolonym zakresem; do decyzji Architekta.
