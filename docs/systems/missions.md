# Misje fabularne

Pole `summary` zawiera krótki opis wyświetlany na tablicy po wyborze misji. Radio mierzy tekst w bieżącej szerokości: cała kwestia pozostaje razem, jeśli mieści się w dwóch liniach, a dłuższe dzieli tylko między zdaniami. Pojedyncze zbyt długie zdanie dopasowuje rozmiarem tekstu, bez urywania treści.

Misja jest runem sektora z mapą i celami opisanymi w `src/data/missions`. Kontrakt: ADR 0008 wraz z uzupełnieniem 2a. Rejestr `missions.ts` waliduje schemat, przypisania celów, zależności oraz typy pokojów. `generateMissionMap` zachowuje jedno przejście przez każdą warstwę stałą; nie dokłada bossa ani gwarancji elit zwykłego sektora.

M01 ma siedem warstw. Wariant `alleyUnderpassMission` zachowuje geometrię oryginału, ale jest walką. Zwykły run wyklucza pokoje z sufiksem `Mission`. Pule misji ograniczają wybór pokojów warstw 2, 4 i 6. Biała lista ogranicza planowanie fal; osłona celów powstaje niezależnie od budżetu.

`MissionObjectives` jest czystą symulacją. Obecność w strefie zwiększa postęp, wyjście go zatrzymuje. Sabotaż uruchamia lont, następnie obrażenia dla wszystkich ze źródłem `null` i falę wskazaną w danych. Moduł czeka na zniszczenie masztu; właz na spełnienie zależności. Host pokoju kończy węzeł z celami dopiero po ich wykonaniu, niezależnie od żywej osłony. Finał uruchamia zwycięstwo. Nowy run resetuje cele.

Metazapis v4 dodaje kampanię; migracja v3 zachowuje dotychczasowy postęp i dopisuje pustą listę ukończeń oraz pusty debrief. Rozliczenie stosuje `appliedRunIds` i `campaign.completed`: bonus firstClear tylko raz. Debrief znika po zakończeniu rozmowy i zapisie meta. Splash korzysta z kampanii; przy pustej kampanii zachowano wcześniejszy próg zwycięstw.

Nową misję dodaje się jako JSON: unikalne id, sektor, warstwy, pokoje stałe i dokładnie jeden finał, cele z zależnościami, pule oraz dialogi i nagrody. Fale posiłków są plikami `src/data/waves`, wskazywanymi przez `reinforcements`. Liczby interakcji są w danych misji, wspólne promienie stref i tempo napisów w `tuning.mission` (panel debug).

Sprawdzenie M01: `?scene=run&mission=m01-maszty&debug=1`. Komendy `mission start m01-maszty`, `objective done <id>`, `query('mission')`; cele: `mast-1`, `mast-2`, `helix`, `mast-3`, `exit`. Zwykłe pokoje: `run clear`. Ręcznie sprawdzić zatrzymywanie paska po odejściu, sześć sekund na ucieczkę przed wybuchem, obrażenia i radio, jasny moduł oraz właz przy murze.

M03 „List przewozowy” odblokowuje ukończenie M01 (M02 poza demem). Warstwy stałe: 3 — plac laserowy, 6 i 7 — magazyn. Osłona bez celu może wskazywać `position` zamiast `nearObjective`; pozycje nie zmieniają warunków ukończenia walki.

`defend` ma opcjonalne `holdS` (domyślnie 0) na podłączenie dekodera oraz `durationS` samego transferu. Obie fazy postępują tylko w promieniu `radiusM`; wrogowie nie blokują transferu. Wyjście zatrzymuje, ale nie zeruje czasu. `objectiveProgress[id]` oznacza transfer, a klucz `id:connection` zachowuje ułamek podłączenia (bez zmiany formatu zapisu). `MissionObjectives.paused` opisuje bieżącą obecność poza strefą. Hook `reinforce(wave, key)` zleca hostowi uruchomienie fali z danych.

Opcjonalne `defend.waves: { atProgress: number; wave: string }[]` uruchamia posiłki dokładnie raz przy przekroczeniu progu (0 < próg ≤ 1). Radio obsługuje `objective:<id>:progress:<0-100>` (całkowity procent), `started` po podłączeniu, `paused` przy pierwszym wyjściu po podłączeniu i `done` przy końcu transferu. Progi już osiągnięte nie powtarzają się po odtworzeniu postępu. HUD rozróżnia podłączanie, procent transferu i „TRANSFER WSTRZYMANY — wróć do strefy”. Dopiero osobny cel `exit` odblokowany przez terminal kończy misję.

M03: podłączenie 2 s, transfer 90 s, promień 6 m, fale przy 25/55/85%, radio w połowie i przy 90%. Brama po przeciwnej stronie od wejścia wymaga 2 s. Pierwsze ukończenie: 95 Danych i 1 Rdzeń. `campaign complete <id>` jest komendą debug: oznacza ukończenie bez nagród i debriefu, zapisuje kampanię. Sprawdzenie: `?scene=run&mission=m03-list-przewozowy&debug=1` po odblokowaniu M01, `objective done terminal`, następnie `objective done exit`. `run clear` nie omija terminala ani bramy.

M06: schemat rezerwuje killBoss; integracja śmierci bossa, danych oraz ewakuacji wymaga osobnego zlecenia. Cele opcjonalne i zegar dostrojenia pozostają poza zakresem.
