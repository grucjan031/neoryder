# ADR 0010 — Misje jako liniowe poziomy

- **Status:** przyjęty 17 XI 2026 (decyzja właściciela po uwadze autora fabuły: „misje to tylko runy z dialogami”).
- **Zastępuje** ADR 0008 pkt 1 i 4 (misja jako losowa mapa sektora ze stałymi węzłami). Pozostałe punkty ADR 0008 (cele w strefach, kampania, odprawy, radio, przerywniki) obowiązują dalej.

## 1. Decyzja

Misja fabularna to **liniowy, ręcznie zaprojektowany poziom**: ciąg własnych miejsc misji (segmentów), bez ekranu wyboru drogi, bez losowych pokoi z puli sektora. Każdy segment ma unikalną geometrię, cele i zdarzenia skryptowe. Zwykły run, tryby areny i roguelite'owa pętla zostają bez zmian.

## 2. Realizacja na istniejącej pętli (bez przepisywania zapisu i nagród)

- Misja liniowa ma `structure: 'linear'` i listę `segments`. Generator buduje z niej mapę z **dokładnie jednym węzłem na warstwę** (`MapNode.fixed`), a `RunScene` **pomija ekran mapy** — po ukończeniu segmentu od razu ładuje następny (ekran ładowania ze splashartem jak dziś).
- Dzięki temu bez zmian zostają: zapis runu i wznowienie (węzeł = segment), rozliczenie nagród (ADR 0007, S0-01), cisza po zwycięstwie, kampania.
- Pokoje segmentów leżą w `src/data/rooms/missions/<missionId>/*.json` (ten sam schemat pokoju, typ `combat`/`rest`/`shop`/`boss`), są wyłączone z losowania sektora i mogą być większe niż pokoje runu.

## 3. Segment

```ts
interface MissionSegment {
  id: string;
  roomId: string; // pokój z src/data/rooms/missions/<missionId>/
  objectives: string[]; // cele z ADR 0008 (sabotage, pickup, exit, defend, interact, killBoss)
  events?: ScriptEvent[]; // zdarzenia skryptowe w segmencie
  after?: 'implant' | 'none'; // po segmencie: wybór 1 z 3 implantów (build-crafting zostaje) albo nic
  service?: 'shop' | 'rest'; // segment-usługa (np. skrytka Nadii = sklep, kotłownia = odpoczynek)
  final?: boolean;
}
interface ScriptEvent {
  id: string;
  once?: boolean; // domyślnie true
  trigger:
    | { kind: 'enterZone'; position: Vec3; radiusM: number }
    | { kind: 'objective'; id: string; phase: 'started' | 'done' }
    | { kind: 'waveCleared'; wave: string }
    | { kind: 'segmentStart' }
    | {
        kind: 'timer';
        afterS: number;
        from?: string; /* id innego zdarzenia */
      };
  actions: (
    | { kind: 'radio'; lines: DialogueLine[] }
    | { kind: 'spawnWave'; wave: string; at?: Vec3[] }
    | { kind: 'openDoor'; door: string }
    | { kind: 'lockDoor'; door: string }
    | { kind: 'unlockObjective'; id: string }
    | { kind: 'fx'; effect: 'explosion' | 'alarm' | 'shake'; position?: Vec3 }
  )[];
}
```

- Segment kończy się, gdy wszystkie jego cele są `done` i gracz przejdzie przez drzwi `exit` (otwierane akcją `openDoor` albo po celach). Drzwi `exit` zamknięte do tego czasu.
- Fale wrogów w segmencie wyłącznie ze zdarzeń (`spawnWave`) i `guards` — bez losowego budżetu sektora; liczby w danych misji.
- Radio z ADR 0008 przechodzi na zdarzenia (`radio` jako akcja), więc kwestie padają w konkretnych miejscach poziomu.

## 4. Kolejność wdrożenia

1. Silnik: `structure: 'linear'`, pomijanie mapy, segmenty, zdarzenia skryptowe, drzwi zamykane/otwierane, testy.
2. **M01 „Maszty”** jako pierwszy poziom liniowy (projekt: `docs/poziomy/m01-maszty.md`), zrzuty i granie właściciela/autora fabuły.
3. Po akceptacji M01: M03 i M06 przerabiane na poziomy liniowe (te same cele, dialogi i przerywniki; nowe segmenty).
4. Stare misje „run” zostają w kodzie do czasu przerobienia (nie psujemy kampanii).

## 5. Konsekwencje

- Najwięcej pracy to geometria segmentów (pokoje JSON z blokami, modelami, światłami, dekoracjami) — każdy segment oglądany na zrzutach z GPU przed akceptacją.
- Build-crafting w misji zostaje dzięki `after: 'implant'` i segmentom-usługom.
- Szacunek: silnik — 1 duże zlecenie; jeden poziom — 1 duże zlecenie geometrii + poprawki wizualne.
