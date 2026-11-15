# Warsztat modułów broni

Moduły wspierają build-crafting: gracz odblokowuje je trwale w warsztacie kryjówki,
a potem montuje w wybranych broniach w sekcji Ekwipunek. Odblokowanie nie jest
zużywalnym przedmiotem: jeden moduł może działać równocześnie w kilku broniach.

## Dane i montaż

Definicje: `src/data/modules/*.json`, schemat zod i rejestr:
`src/progression/moduleSchema.ts`. Pola: `id`, polskie `name` i `description`,
`tags: string[]`, opcjonalne `weaponKinds: string[]` oraz `patches`.
`weaponKinds` odnosi się do `fireMode` broni; jego brak dopuszcza wszystkie tryby.
Łatka modułu zawiera wyłącznie `op`, `path`, `value`; cel wynika z montażu.

`progression.json.moduleSlotsPerWeapon` ustala limit (2). W
`LoadoutChoice.modules` kluczem jest id broni, a wartością uporządkowane id modułów.
Puste sloty nie mają wpisu; po usunięciu modułu pozostałe zachowują kolejność.
`MetaManager.setLoadout` sprawdza odblokowania, obecność broni w ekwipunku,
limit, brak duplikatów w broni i zgodność trybu. Walidacja poprzedza zmianę stanu.
Zmiana w panelu wywołuje `setLoadout`, potem zapis meta. Usunięcie broni czyści
jej przypisania modułów.

## Moduły startowe

| Id | Nazwa | Działanie | Odblokowanie | Tryby broni |
| --- | --- | --- | --- | --- |
| `ricochet` | Rykoszet | Jedno odbicie od geometrii świata | 160 Danych, poziom 3 | projectile, spread, pierce, lob |
| `pierce` | Przebicie | `pierceCount +1`: jeden dodatkowy cel, zachowany `pierceFalloff` | 180 Danych, poziom 4 | projectile, spread, pierce |
| `incendiary` | Podpalenie | Dopisuje `burning` na 3 s do statusów trafienia | 200 Danych, poziom 4 | wszystkie |
| `superconductor` | Nadprzewodnik | Prędkość pocisku +20%, ciepło na strzał −15% | 6 Rdzeni, poziom 5 | projectile, spread, pierce, lob |

Nadprzewodnik używa wariantu awaryjnego ustalonego w briefie. Istniejący
`DamageSystem` nie ma warunku obrażeń zależnego od statusu celu. Efekty
`damage_dealt` w `SynergySystem` potrafią dać czasowy modyfikator statystyk
albo trafić inny pobliski cel, ale nie dają +30% obrażeń temu samemu celowi.

## Rozwiązanie ekwipunku i zapis

`modulePatches(loadout)` przypisuje łatkom `target: weapon:<id>`, zachowując
kolejność broni i slotów. `RoomScene` podaje do `resolveLoadout` najpierw
łatki talentów (kolejność id węzłów), potem modułów, następnie `options.patches`.
Każda łatka zmienia kopię definicji i przechodzi ponowną walidację schematem broni.
`append` dopisuje tablicę do istniejącej tablicy; brakujące pole opcjonalne
traktuje jako `[]`. Istniejące statusy broni, np. przeciążenie EMP, zostają.

`loadoutChoiceSchema` domyślnie uzupełnia `modules: {}`, więc wcześniejsze
zapisy meta v3 nie wymagają migracji. Pełny `Loadout.modules` jest opcjonalny,
dlatego presety zachowują dotychczasowe działanie. `MetaManager.loadout()`
kopiuje przypisania; `RunManager.newRun` zamraża je wraz z resztą ekwipunku.
Zmiana warsztatu w trakcie runu nie zmienia już rozpoczętego zestawu.

## Rykoszet

Pole `ricochets` broni trafia do `ProjectileSpec.ricochets` i licznika w puli.
Trafienie w świat przy dodatnim liczniku odbija kierunek lustrzanie:
`d' = d − 2(d·n)n`. Tak samo odbijana jest prędkość pocisku balistycznego.
Licznik spada o jeden, a pocisk przebywa pozostały dystans bieżącego kroku.
Odbicie nie odnawia czasu życia, nie zmienia właściciela ani obrażeń.
Małe odsunięcie od powierzchni zapobiega ponownemu trafieniu wskutek precyzji Rapier.
Po wyczerpaniu odbić następna ściana kończy lot (EMP wybucha).
Wrogowie zużywają trafienia przebicia, nigdy licznik rykoszetów.

## Kontrola i testy

W 30 sekund: `?scene=hub&debug=1`, `meta unlock all`, otwórz Warsztat,
wybierz pistolet i zamontuj Podpalenie oraz Rykoszet. Uruchom run z ekwipunkiem
meta; `query('resolvedLoadout')` pokazuje statusy i `ricochets: 1`.
Strzel do wroga i pod kątem w ścianę. Oceń czytelność odbicia, podpalania
i obu slotów w ciemnym panelu warsztatu.

Vitest: `modules.test.ts` (dane, schematy, kopie, zgodność, przebicie i transport
parametrów), `patches.test.ts` (`append` i błędne dane),
`meta.test.ts` (walidacja i stare meta), `runMeta.test.ts` (zamrożenie modułów),
`fireModes.test.ts` (Rapier: jedno odbicie, pozostały dystans, druga ściana,
wróg, czas życia i ponowne użycie puli), `roomPatches.test.ts`
(pistolet rzeczywiście nakłada `burning`), `workshopPanel.test.ts`
(montaż, zapis, usuwanie i filtrowanie).
