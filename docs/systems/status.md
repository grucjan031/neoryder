# Statusy — F2-02

`StatusSystem` (`src/combat/status/`) nakłada, odlicza i rozlicza statusy: podpalenie,
przeciążenie, ogłuszenie. Definicje to dane w `src/data/statuses/*.json` (zod,
`statusSchema`), ładowane `import.meta.glob`; powtórzone id, nieznany status
w `onMaxStacks.apply` albo status nakładający sam siebie zatrzymują ładowanie.

## Skąd biorą się statusy

Wyłącznie z obrażeń: `DamageInfo.statuses` → `damage_dealt.statuses` →
`StatusSystem`. Status nakłada się tylko, gdy obrażenia przeszły (`amount > 0`)
i cel przeżył (`killed: false`). Odrzucone trafienie (ta sama drużyna,
nietykalność) nie emituje `damage_dealt`, więc nie nakłada statusu. Metodę
`apply(target, app, source)` woła tylko sam system, testy i komendy debug.
`apply` zwraca `false` (bez zdarzenia), gdy cel nie jest zarejestrowany w
`DamageSystem`, jest martwy albo `durationS ≤ 0`; nieznane id statusu rzuca
wyjątek. Każde udane nałożenie (także odświeżenie) emituje `status_applied`,
a pole `source` instancji jest nadpisywane ostatnim nakładającym (to jego
dotyczą kolejne tiki).

## Reguły

| Pole                  | Znaczenie                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxStacks`           | Kolejne nałożenia dodają `stacks` (domyślnie 1) do limitu.                                                                                                                                                                                                                                                                                                                                                                                                              |
| czas                  | Nowe nałożenie ustawia dłuższy z czasów: obecnego i nowego.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `tick`                | `damage × stosy` co `intervalS`; pierwszy tik po `intervalS`, łącznie `floor(czas / intervalS)` tików (z tolerancją 1e-6). Licznik tików nie jest zerowany przy odświeżeniu. Tik (`#status`) nie przepada w oknie nietykalności celu po trafieniu (`invulnMs`) i go nie odnawia; blok ostrzem go nie zmniejsza. W jednym kroku wykonuje się tyle tików, ile mieści się w `dt`; tik liczony przed sprawdzeniem wygaśnięcia, więc ostatni tik wypada w kroku wygaśnięcia. |
| `damageTakenPerStack` | `StatModifier` `percent` na `damageTaken` celu (`source: status:<id>`), wartość `damageTakenPerStack × stosy`, przeliczany przy każdym nałożeniu; tylko gdy cel ma `Stats` zarejestrowane w `DamageSystem`. Zdejmowany przy wygaśnięciu, zużyciu stosów, `clear` i `reset`.                                                                                                                                                                                             |
| `onMaxStacks`         | Po osiągnięciu `maxStacks` (sprawdzane po emisji `status_applied`): status znika (`status_expired`, modyfikator zdjęty), `apply` nakłada statusy na ten sam cel (z tym samym źródłem), `discharge` rani innych w promieniu. Kolejność: `status_applied` (max stosów) → `status_expired` → `status_applied` statusów z `apply` → obrażenia wyładowania.                                                                                                                  |

Czas płynie w `step(dt)` w czasie symulacji: hitstop (`dt = 0`) zatrzymuje
statusy, spowolnienie je wydłuża. Obrażenia statusów (tiki, wyładowanie) idą
przez `DamageSystem.deal` ze źródłem równym nakładającemu, z tagami statusu
i `#status` (`STATUS_TAG`), **bez** `statuses` — wyładowanie nie nakłada
przeciążenia na sąsiadów, więc nie powstaje pętla łańcuchowa. Wyładowanie
liczy odległość 3D od pozycji celu (`deps.position`) do pozostałych `deps.targets()`
(pomija sam cel i encje bez pozycji; granica `radiusM + 1e-6`, bez zależności od
wysokości i bez zasłon). Obrażenia wyładowania niosą `point` = pozycję trafionego
i `dir` od środka celu (gdy odległość > 0); filtr drużyn i nietykalność stosuje
`DamageSystem`. Gdy pozycja źródłowego celu jest nieznana, wyładowania nie ma,
ale stosy i `apply` działają. Tiki nie mają `point` ani `dir`. `outgoing` gracza
nie mnoży obrażeń statusów (tag `#status`).

`status_applied { target, status, stacks, durationS, source }` przy każdym
nałożeniu; `status_expired { target, status }` przy wygaśnięciu, zużyciu stosów
i `clear`. Śmierć (`enemy_killed`, `player_died`) i `entity_despawned` czyszczą
statusy celu. `reset()` (nowy run) usuwa wszystko bez zdarzeń i zdejmuje
modyfikatory. Zapytania: `has`, `stacks`, `remaining`, `list` (HUD, debug).

## Zagłuszenie — Z16

`jammed` (Zagłuszenie): jeden stos, bez tików i modyfikatorów statystyk.
Haker nakłada go na 3 s przez `DamageInfo.statuses`; czas określa
`hacker.json.hack.durationS`, jak dla innych aplikacji statusów. Ponowne
trafienie odświeża czas, nie sumuje stosów. Wygaśnięcie, śmierć i despawn
korzystają ze zwykłej ścieżki `StatusSystem`.

`PowerDeps.statuses?: StatusQuery` pozwala `PowerBase.use()` odmówić nowej
aktywacji przed sprawdzaniem odnowienia i energii: `power_denied` z powodem
`jammed`, bez kosztu i nowego odnowienia. Już działające moce nie są anulowane.
Sceny muszą przekazać swój `StatusSystem` do zależności mocy.
HUD przyciemnia obsadzone sloty i wyświetla „ZAGŁUSZONE” na podstawie
`status_applied`/`status_expired` gracza. Śmierć i reset ekwipunku czyszczą
wskaźnik. Istniejąca reguła audio `power_denied` obsługuje nową odmowę.

## Dane F2

| Status                    | Efekt                                                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `burning` (Podpalenie)    | 4 obrażenia (tagi `#fire`, `#status`) co 0,5 s, 1 stos. Czas nakłada źródło (dane broni/mocy). Przy śmierci gracza od tiku `cause = 'burning'`.                                                                                   |
| `overload` (Przeciążenie) | tag `#elektrycznosc`; +25% otrzymywanych obrażeń na stos (1 stos +25%, 2 stosy +50%), 3 stosy; przy 3: ogłuszenie 1,5 s (`stunned`) i wyładowanie 12 `#elektrycznosc` w promieniu 4 m (przy śmierci gracza `cause = 'overload'`). |
| `stunned` (Ogłuszenie)    | 1 stos, bez tików. Wróg nie atakuje (`STUNNED`). Nałożenie na już ogłuszonego odświeża dłuższy z czasów. Ostrze odczytuje go jako gotowość do wykończenia (`melee.md`).                                                           |

## Wrogowie

`EnemyDependencies.statuses?: StatusQuery`. Szturmowiec i Strzelec traktują
status `stunned` jak ogłuszenie ciosem: przerywają atak, przechodzą w stan
`stunned` (emitują `enemy_stunned`, oddają token dyrektora) i trwają w nim,
dopóki trwa status. Ogłuszenie ciężkim ciosem działa jak w F1 (stan wroga);
przeniesienie go na status to osobna decyzja (backlog). Sceny `ai-test`,
`status-test` i `arena` mają `StatusSystem` krokowany po `DamageSystem`, przed
wrogami, i przekazany wrogom.

## Scena status-test i weryfikacja

`?scene=status-test&debug=1` to ai-test z danymi `src/data/scenes/statusTest.json`:
trzech Szturmowców blisko siebie (wyładowanie) i Strzelec. Napis pokazuje
statusy wrogów (`#id: overload×2`). Komenda `status <id> [s]` (domyślnie 3 s)
nakłada status na wszystkich żywych wrogów ze źródłem gracz.

Kontrola w 30 sekund: `god`, poczekaj na podejście wrogów, `status stunned 2`
— nikt nie atakuje przez 2 s. `status burning` — HP spada co 0,5 s.
Trzy razy `status overload` — przy trzecim wyładowania ranią sąsiadów, a wrogowie
padają ogłuszeni. Ocena: czy ogłuszenie jest czytelne bez osobnego efektu (VFX
statusów to osobne zadanie).

Testy: `tests/unit/status.test.ts` (nakładanie tylko z obrażeń, czas i hitstop,
odświeżanie, limit stosów, tiki ze źródłem i `#status`, śmierć w trakcie tików,
modyfikator `damageTaken`, wyładowanie bez pętli, despawn, reset, dispose,
walidacja danych) i `aiTest.test.ts` (scena status-test, ogłuszenie blokuje
ataki prawdziwych wrogów, reset czyści statusy).
