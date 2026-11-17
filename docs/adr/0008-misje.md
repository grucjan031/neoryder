# ADR 0008 — Misje fabularne i postęp kampanii

- **Status:** przyjęty 17 XI 2026 (decyzja właściciela D1: misje wchodzą do kodu od razu).
- **Zakres pierwszej implementacji:** szkielet systemu + misja 01 „Maszty”. Kolejne: 03 „List przewozowy” (obrona), 06 „Odlewnia” (boss + dane + ewakuacja). Misje 02 i 04 warunkowo (plan, D2).
- **Źródła treści:** `docs/fabula/misje.md`, `docs/fabula/misje/misja-NN-*.md`. Teksty z tych plików kopiujemy do danych gry; pliki w `docs/fabula` zostają nietknięte.

## 1. Misja = run z warunkiem celu

Misja korzysta z pętli runu (ADR 0005): sektor, mapa wyboru ścieżki, pokoje, nagrody, sklep, odpoczynek. Dokłada:

- **stałe węzły fabularne** na wskazanych warstwach (jeden węzeł w warstwie, wszystkie ścieżki przez niego przechodzą),
- **cele** przypięte do stałych węzłów,
- **komunikaty radiowe** i **odprawy** (tekst, bez głosu),
- **warunek zwycięstwa** zależny od celów zamiast „pokonaj bossa”.

Zwykły run (tablica misji → „Zwykły run”) działa bez zmian.

## 2. Dane: `src/data/missions/<id>.json` + `src/world/missionSchema.ts` (zod)

```ts
interface MissionDefinition {
  id: string; // 'm01-maszty'
  number: number; // 1
  title: string; // 'Maszty'
  act: 1 | 2 | 3;
  sectorId: string; // 'kurogane'
  requires: string[]; // id misji, które muszą być ukończone
  layers: number; // liczba warstw mapy misji (nadpisuje sektor)
  typeWeights?: SectorDefinition['typeWeights']; // opcjonalnie, inaczej z sektora
  fixedNodes: {
    layer: number;
    type: NodeType; // zwykle 'combat'
    roomId: string; // np. 'alleyCrossing'
    objectives: string[]; // id celów aktywnych w tym pokoju
    final?: boolean; // ukończenie tego węzła kończy misję
  }[];
  objectives: MissionObjective[];
  briefing: DialogueLine[];
  debrief: DialogueLine[];
  radio: { trigger: RadioTrigger; lines: DialogueLine[] }[];
  rewards: { firstClear: { data: number; cores?: number } };
  splashAct?: 1 | 2 | 3 | 4; // akt splashy odblokowany po ukończeniu
}
interface DialogueLine {
  speaker:
    'szron' | 'mira' | 'bajt' | 'tomasz' | 'ida' | 'wolan' | 'nadia' | 'tymon' | 'brandt';
  text: string;
}
type MissionObjective =
  | {
      id: string;
      kind: 'sabotage';
      label: string;
      position: Vec3;
      holdS: number;
      fuseS: number;
      blastRadiusM: number;
      blastDamage: number;
      reinforcements?: string; /* id fali */
    }
  | {
      id: string;
      kind: 'pickup';
      label: string;
      spawnAfter: string /* id celu */;
      offset: Vec3;
    }
  | {
      id: string;
      kind: 'exit' | 'interact'; // interact: np. serwer M06, bez samodzielnego kończenia pokoju
      label: string;
      position: Vec3;
      holdS: number;
      unlockAfter: string[];
    }
  | {
      id: string;
      kind: 'defend';
      label: string;
      position: Vec3;
      radiusM: number;
      durationS: number;
    } // M03
  | { id: string; kind: 'killBoss'; label: string }; // M06
type RadioTrigger =
  | 'runStart'
  | 'boss:phase:2' | 'boss:phase:3' | 'boss:defeated'
  | `enterNode:${number}`
  | `objective:${string}:started`
  | `objective:${string}:done`
  | 'objectivesDone';
```

Walidacja przy starcie (jak inne dane): `roomId` istnieje i ma typ zgodny z `type`; każdy cel z `fixedNodes` jest zdefiniowany; `spawnAfter`/`unlockAfter` wskazują istniejące cele; dokładnie jeden węzeł `final`; warstwy w zakresie `1..layers`.

### 2a. Uzupełnienie 17 XI 2026 (po eskalacji wykonawcy)

- **Pule pokojów:** opcjonalne `roomPools?: { fromLayer: number; toLayer: number; type: NodeType; rooms: string[] }[]` — dla węzłów niestałych danego typu w zakresie warstw losujemy pokój tylko z tej listy (deterministycznie z ziarna). Bez wpisu — zwykłe losowanie sektora.
- **Wrogowie misji:** opcjonalne `enemies?: string[]` — biała lista archetypów dla planowania fal we wszystkich pokojach misji (budżet zagrożenia sektora bez zmian, wybór tylko z listy). Ograniczenia warstw sektora (np. wieżyczki od warstwy 4) w misji nie obowiązują dla archetypów z listy. M01: `assaulter`, `gunner`, `turret`.
- **Osłona celów:** opcjonalne `guards?: { enemy: string; count: number; nearObjective: string; radiusM: number }[]` przy węźle stałym — wrogowie ustawieni na starcie pokoju przy celu (np. wieżyczki przy masztach: 1, 1, 2), niezależnie od fal; pokój kończy się, gdy cele są `done` (osłona nie musi zginąć).
- **Typ pokoju vs węzeł:** walidacja wymaga zgodności typów. Gdy misja potrzebuje geometrii pokoju o innym typie (M01 warstwa 1: `alleyUnderpass` ma typ `elite`), tworzymy wariant danych `<id>Mission` z tą samą geometrią i właściwym typem (`alleyUnderpassMission`, `combat`); oryginał bez zmian, zwykły run go nie losuje (pokoje `*Mission` wykluczone z puli sektora).

## 3. Interakcja: strefy z paskiem postępu, bez nowego klawisza

W runie `E` to `power2`, a `F` to `power`, więc cele **nie** używają klawisza interakcji. Każdy cel interaktywny to **strefa**: gracz stoi w niej przez `holdS`, pasek postępu w świecie i w HUD rośnie; wyjście ze strefy zatrzymuje postęp (nie zeruje). Ten sam mechanizm obsługuje `defend` (M03: postęp tylko, gdy gracz jest w strefie). `pickup` zbiera się przez wejście w mały promień.

- `sabotage`: strefa przy podstawie celu → po `holdS` start lontu `fuseS` (widoczne odliczanie, czerwone miganie) → wybuch: obrażenia w `blastRadiusM` dla wszystkich (gracz też; źródło `null`, jak hazardy), obiekt znika, emituje `objective:<id>:done`, odpala falę `reinforcements`.
- `exit`: zablokowany do ukończenia `unlockAfter`; po `holdS` kończy pokój (`completeRoom`).
- Wrogowie nie zatrzymują postępu; ogranicza go tylko obecność gracza w strefie.

## 4. Mapa misji

`generateMissionMap(mission, sector, seed)` w `src/world/sectorMap.ts` (obok generatora sektora): warstwy `mission.layers`, na warstwach z `fixedNodes` dokładnie jeden węzeł, do którego prowadzą wszystkie węzły poprzedniej warstwy i z którego wychodzą wszystkie krawędzie do następnej. `MapNode` dostaje opcjonalne `fixed?: { roomId: string; objectives: string[]; final?: boolean }`. Wybór pokoju dla węzła z `fixed` bierze `roomId` zamiast losowania. Deterministycznie z ziarna, jak dziś.

## 5. Stan próby (run) a stan kampanii (meta)

- **Run** (`RunState`, zapis runu): opcjonalne `missionId?: string` i `objectives?: Record<string, 'pending' | 'active' | 'done'>`, `objectiveProgress?: Record<string, number>` (0..1). Pola opcjonalne → stare zapisy runu wczytują się bez migracji. Śmierć resetuje cele (nowa próba = nowy run).
- **Ukończenie misji:** ukończenie węzła `final` przy wszystkich celach tego węzła `done` → `finish('victory')`. W zwykłym runie śmierć bossa kończy run jak dotąd. W M06 śmierć bossa kończy tylko cel `killBoss`, a pozostali wrogowie rozpadają się ze źródłem null (bez statystyk zabójstw). Następnie serwer (`interact`, 3 s) odblokowuje windę (`exit`, 2 s). Dopiero winda kończy pokój i run, uruchamiając zwykłą ciszę po zwycięstwie oraz podsumowanie. Bez zmiany wersji zapisu, rozliczania nagród i balansu bossa.
- **`RunSummary`**: opcjonalne `missionId?: string`, `missionCompleted?: boolean`.
- **Kampania** (metazapis): `campaign: { completed: string[]; pendingDebrief: string | null }`. Nowa wersja metazapisu + migracja: stare zapisy dostają `{ completed: [], pendingDebrief: null }`.
- **Nagrody:** zwykłe nagrody runu jak dziś; przy pierwszym ukończeniu dodatkowo `rewards.firstClear`. Kolejne ukończenia — tylko zwykłe nagrody. Idempotencja przez istniejące `appliedRunIds` (`applyRun` nie nalicza dwa razy tego samego runu) i przez `campaign.completed` (bonus pierwszego ukończenia tylko gdy misji jeszcze tam nie ma).
- **Splasharty:** `unlockedSplashAct` liczy akt z kampanii (`max(splashAct)` ukończonych misji, minimum 1). Próg po zwycięstwach (S0-05) zostaje tylko jako zapas, gdy kampania jest pusta, albo zostaje usunięty — decyzja w implementacji, opisana w PR.

## 6. Interfejs

- **Tablica misji** (`src/ui/hub/missionsPanel.ts`): lista misji z numerem, tytułem i stanem (zablokowana z powodem / dostępna / ukończona) + pozycja „Zwykły run”. Wybór misji → odprawa (linie `briefing`, mówca kolorem z palety UI) → „Rozpocznij misję”. Poziom zagrożenia działa także dla misji.
- **Cel w HUD**: krótka lista aktywnych celów bieżącego pokoju z postępem; ukończony cel przekreślony. Nie zasłania celownika ani pasków zdrowia/energii.
- **Radio**: napisy w dolnej części ekranu (nazwa mówcy + tekst), kolejka, czas wyświetlania z długości tekstu, maks. 2 linie naraz; nie zasłania wskaźników obrażeń i celów. Teksty z danych misji.
- **Po powrocie**: kryjówka przy wejściu pokazuje `debrief` jako krótką rozmowę (jednorazowo, `pendingDebrief`), potem czyści pole.
- **Odprawa Odlewni (D3)**: karta do sieci Brandta przekazana w odprawie M06, bez misji M05. Pierwsza kwestia Szrona: „Karta Wirskiej już jest. Kontakt Nadii zdjął ją z konwoju, zanim Brandt zamknął Huty.”

## 7. Poza zakresem pierwszej implementacji

Cele opcjonalne z nagrodą, zegar porannego dostrojenia, zmiany przestrzenne kryjówki po misjach (poza debriefem), dubbing, misje aktu II–III.
