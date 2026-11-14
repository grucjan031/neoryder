# Zadania fazy F1 — Prototyp walki

Zadania w kolejności realizacji (numer = kolejność z uwzględnieniem zależności). Szacunek: S ≈ 0,5–1 dnia sesji, M ≈ 1–2 dni, L ≈ 2–4 dni. Wspólne wymagania i definicja ukończenia: `AGENTS.md`. Nowe zdarzenia opisane w sekcjach „Kontrakt” trzeba zatwierdzić w `docs/api.md` przed kodem.

## Stan (2026-11-14)

Wszystkie 16 zadań F1 zrealizowane i scalone na `main` (testy jednostkowe + e2e, CI zielone). Następny krok: **bramka fazy** — playtest według `docs/playtest-F1.md`, scena `?scene=arena`.

## Tabela zadań

| Nr                              | Tytuł                                                | Agent                | Zależy od              | Szac. |
| ------------------------------- | ---------------------------------------------------- | -------------------- | ---------------------- | ----- |
| [01](01-model-obrazen.md)       | Model obrażeń i komponenty Health / Hitbox / Hurtbox | Architekt            | —                      | M     |
| [02](02-kontroler-fpp.md)       | Kontroler FPP na Rapier                              | Ruch i kamera        | —                      | L     |
| [03](03-kamera-fpp.md)          | Kamera FPP: FOV i wstrząs                            | Ruch i kamera        | 02                     | S     |
| [04](04-dash-i-slide.md)        | Dash i slide                                         | Ruch i kamera        | 02                     | M     |
| [05](05-shader-stylu.md)        | Shader: biały świat, czerwoni wrogowie               | Grafika, VFX i audio | —                      | M     |
| [06](06-blaster-przegrzanie.md) | Blaster z przegrzaniem i pociski z poolingiem        | Bronie               | 01, 02                 | L     |
| [07](07-ostrze-plazmowe.md)     | Ostrze plazmowe: combo, ciężki atak, blok            | Walka wręcz          | 01, 02                 | L     |
| [08](08-ai-szturmowiec.md)      | Archetyp Szturmowiec                                 | AI wrogów            | 01, 02                 | M     |
| [09](09-ai-strzelec.md)         | Archetyp Strzelec i wolne pociski                    | AI wrogów            | 06, 08                 | M     |
| [10](10-parowanie-pociskow.md)  | Parowanie pocisków ostrzem                           | Walka wręcz          | 07, 09                 | M     |
| [11](11-pchniecie-rezonansu.md) | Pchnięcie Rezonansu i pasek energii                  | Moce                 | 01, 08                 | M     |
| [12](12-rozpad-na-odlamki.md)   | Rozpad wrogów na odłamki z poolingiem                | Grafika, VFX i audio | 01, 05, 08             | M     |
| [13](13-hitstop-i-slowmo.md)    | Hitstop i spowolnienie przy ostatnim zabójstwie      | Architekt            | 01                     | S     |
| [14](14-sfx-trafien.md)         | SFX trafień                                          | Grafika, VFX i audio | 01                     | M     |
| [15](15-hud-minimalny.md)       | Minimalny HUD: zdrowie, energia, ciepło              | UI/UX                | 01, 06, 11             | S     |
| [16](16-arena-fal-i-debug.md)   | Arena z falami wrogów i konsola debug (spawn)        | Architekt            | 07, 08, 09, 11, 12, 13 | L     |

Graf zależności jest acykliczny: każde zadanie zależy tylko od zadań o niższym numerze. Zadania 01, 02 i 05 nie mają zależności i mogą ruszyć od razu (po F0).

Uwaga: konsola debug ze spawnem jest częścią zadania 16 (jeden agent, ten sam folder), a każdy agent AI dodaje własną komendę `spawn <typ>` w swojej scenie testowej.

## Proponowany podział na 3 równoległe sesje

Sesje wg roadmapy: Architekt, Gameplay (ruch + walka), QA. Zadania prezentacji (05, 12, 14, 15) bierze sesja QA w przerwach między testami, bo nie blokują ścieżki krytycznej gameplayu; QA dodatkowo pisze testy e2e dla każdego scalonego zadania.

| Krok | Architekt                                      | Gameplay                                    | QA (+ prezentacja)                          |
| ---- | ---------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| 1    | 01 Model obrażeń                               | 02 Kontroler FPP                            | 05 Shader stylu                             |
| 2    | 13 Hitstop i slowmo                            | 03 Kamera, 04 Dash i slide                  | 14 SFX trafień, e2e smoke dla 02 i 01       |
| 3    | przegląd PR, zatwierdzanie kontraktów w api.md | 06 Blaster, 07 Ostrze, 08 Szturmowiec       | e2e scen testowych, próg FPS                |
| 4    | — (review)                                     | 09 Strzelec, 10 Parowanie, 11 Pchnięcie     | 12 Rozpad na odłamki, 15 HUD                |
| 5    | 16 Arena i konsola debug                       | poprawki z playtestu, strojenie `tuning.ts` | e2e areny, raport regresji, test wydajności |

Ścieżka krytyczna: 01 → 06/08 → 09 → 10 → 16 (równolegle 02 → 07 i 11 → 16).

## Bramka fazy

Po zadaniu 16 człowiek gra 15 minut na `?scene=arena`. Wynik „chcę kolejną rundę” otwiera F2; w przeciwnym razie tydzień strojenia `tuning.ts` bez nowych funkcji.
