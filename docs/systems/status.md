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

## Reguły

| Pole                  | Znaczenie                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `maxStacks`           | Kolejne nałożenia dodają `stacks` (domyślnie 1) do limitu.                                                                            |
| czas                  | Nowe nałożenie ustawia dłuższy z czasów: obecnego i nowego.                                                                           |
| `tick`                | `damage × stosy` co `intervalS`; pierwszy tik po `intervalS`, łącznie `floor(czas / intervalS)` tików.                                |
| `damageTakenPerStack` | `StatModifier` `percent` na `damageTaken` celu (`source: status:<id>`), przeliczany przy zmianie stosów.                              |
| `onMaxStacks`         | Po osiągnięciu `maxStacks`: status znika (stosy zużyte), `apply` nakłada statusy na ten sam cel, `discharge` rani innych w promieniu. |

Czas płynie w `step(dt)` w czasie symulacji: hitstop (`dt = 0`) zatrzymuje
statusy, spowolnienie je wydłuża. Obrażenia statusów (tiki, wyładowanie) idą
przez `DamageSystem.deal` ze źródłem równym nakładającemu, z tagami statusu
i `#status` (`STATUS_TAG`), **bez** `statuses` — wyładowanie nie nakłada
przeciążenia na sąsiadów, więc nie powstaje pętla łańcuchowa. Wyładowanie
liczy odległość od pozycji celu (`deps.position`) do pozostałych `deps.targets()`.

`status_applied { target, status, stacks, durationS, source }` przy każdym
nałożeniu; `status_expired { target, status }` przy wygaśnięciu, zużyciu stosów
i `clear`. Śmierć (`enemy_killed`, `player_died`) i `entity_despawned` czyszczą
statusy celu. `reset()` (nowy run) usuwa wszystko bez zdarzeń i zdejmuje
modyfikatory. Zapytania: `has`, `stacks`, `remaining`, `list` (HUD, debug).

## Dane F2

| Status                    | Efekt                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `burning` (Podpalenie)    | 4 obrażenia `#fire` co 0,5 s, 1 stos.                                                                                    |
| `overload` (Przeciążenie) | +25% otrzymywanych obrażeń na stos, 3 stosy; przy 3: ogłuszenie 1,5 s i wyładowanie 12 `#elektrycznosc` w promieniu 4 m. |
| `stunned` (Ogłuszenie)    | Wróg nie atakuje (`STUNNED`).                                                                                            |

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
