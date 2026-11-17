# Misje fabularne

Pole `summary` zawiera krótki opis wyświetlany na tablicy po wyborze misji. Radio mierzy tekst w bieżącej szerokości: cała kwestia pozostaje razem, jeśli mieści się w dwóch liniach, a dłuższe dzieli tylko między zdaniami. Pojedyncze zbyt długie zdanie dopasowuje rozmiarem tekstu, bez urywania treści.

Misja jest runem sektora z mapą i celami opisanymi w `src/data/missions`. Kontrakt: ADR 0008 wraz z uzupełnieniem 2a. Rejestr `missions.ts` waliduje schemat, przypisania celów, zależności oraz typy pokojów. `generateMissionMap` zachowuje jedno przejście przez każdą warstwę stałą; nie dokłada bossa ani gwarancji elit zwykłego sektora.

M01 ma siedem warstw. Wariant `alleyUnderpassMission` zachowuje geometrię oryginału, ale jest walką. Zwykły run wyklucza pokoje z sufiksem `Mission`. Pule misji ograniczają wybór pokojów warstw 2, 4 i 6. Biała lista ogranicza planowanie fal; osłona celów powstaje niezależnie od budżetu.

`MissionObjectives` jest czystą symulacją. Obecność w strefie zwiększa postęp, wyjście go zatrzymuje. Sabotaż uruchamia lont, następnie obrażenia dla wszystkich ze źródłem `null` i falę wskazaną w danych. Moduł czeka na zniszczenie masztu; właz na spełnienie zależności. Host pokoju kończy węzeł z celami dopiero po ich wykonaniu, niezależnie od żywej osłony. Finał uruchamia zwycięstwo. Nowy run resetuje cele.

Metazapis v4 dodaje kampanię; migracja v3 zachowuje dotychczasowy postęp i dopisuje pustą listę ukończeń oraz pusty debrief. Rozliczenie stosuje `appliedRunIds` i `campaign.completed`: bonus firstClear tylko raz. Debrief znika po zakończeniu rozmowy i zapisie meta. Splash korzysta z kampanii; przy pustej kampanii zachowano wcześniejszy próg zwycięstw.

Nową misję dodaje się jako JSON: unikalne id, sektor, warstwy, pokoje stałe i dokładnie jeden finał, cele z zależnościami, pule oraz dialogi i nagrody. Fale posiłków są plikami `src/data/waves`, wskazywanymi przez `reinforcements`. Liczby interakcji są w danych misji, wspólne promienie stref i tempo napisów w `tuning.mission` (panel debug).

Sprawdzenie M01: `?scene=run&mission=m01-maszty&debug=1`. Komendy `mission start m01-maszty`, `objective done <id>`, `query('mission')`; cele: `mast-1`, `mast-2`, `helix`, `mast-3`, `exit`. Zwykłe pokoje: `run clear`. Ręcznie sprawdzić zatrzymywanie paska po odejściu, sześć sekund na ucieczkę przed wybuchem, obrażenia i radio, jasny moduł oraz właz przy murze.

M03/M06: schemat rezerwuje defend i killBoss; kompletna integracja obrony, śmierci bossa, danych oraz ewakuacji wymaga osobnych zleceń. Cele opcjonalne, zegar dostrojenia i pełne dialogi nie należą do M01.
