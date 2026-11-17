# Warsztat modułów broni

Moduły wspierają build-crafting: gracz odblokowuje je trwale w warsztacie kryjówki,
a potem montuje w wybranych broniach w sekcji Ekwipunek. Odblokowanie nie jest
zużywalnym przedmiotem: jeden moduł może działać równocześnie w kilku broniach.

## Dane i montaż

Definicje: `src/data/modules/*.json`, schemat zod i rejestr:
`src/progression/moduleSchema.ts`. Pola: `id`, polskie `name` i `description`,
`tags: string[]`, wymagane `slot` i `visual`, opcjonalne `weaponKinds: string[]` oraz `patches`.
`weaponKinds` odnosi się do `fireMode` broni; jego brak dopuszcza wszystkie tryby.
Łatka modułu zawiera wyłącznie `op`, `path`, `value`; cel wynika z montażu.

`progression.json.moduleSlotsPerWeapon` ustala limit (3). W
`LoadoutChoice.modules` kluczem jest id broni, a wartością uporządkowane id modułów.
Puste sloty nie mają wpisu; po usunięciu modułu pozostałe zachowują kolejność.
`MetaManager.setLoadout` sprawdza odblokowania, obecność broni w ekwipunku,
limit, brak duplikatów i konfliktów slotów w broni oraz zgodność trybu. Walidacja poprzedza zmianę stanu.
Zmiana w panelu wywołuje `setLoadout`, potem zapis meta. Usunięcie broni czyści
jej przypisania modułów.

## Moduły startowe

| Id               | Nazwa         | Działanie                                                        | Odblokowanie         | Tryby broni                     |
| ---------------- | ------------- | ---------------------------------------------------------------- | -------------------- | ------------------------------- |
| `ricochet`       | Rykoszet      | Jedno odbicie od geometrii świata                                | 160 Danych, poziom 3 | projectile, spread, pierce, lob |
| `pierce`         | Przebicie     | `pierceCount +1`: jeden dodatkowy cel, zachowany `pierceFalloff` | 180 Danych, poziom 4 | projectile, spread, pierce      |
| `incendiary`     | Podpalenie    | Dopisuje `burning` na 3 s do statusów trafienia                  | 200 Danych, poziom 4 | wszystkie                       |
| `superconductor` | Nadprzewodnik | Prędkość pocisku +20%, ciepło na strzał −15%                     | 6 Rdzeni, poziom 5   | projectile, spread, pierce, lob |

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
i trzech slotów w ciemnym panelu warsztatu.

## Sloty i optyka (S4c, runda A)

Kolejność łatek jest stała: Wylot (`muzzle`), Ogniwo (`cell`), Optyka (`optic`),
niezależnie od kolejności tablicy. Po jednym module na slot. Przy wczytywaniu meta
starszy konflikt (np. Przebicie + Rykoszet) zachowuje pierwszy wpis slotu.
`SAVE_VERSION` nadal 6; nie zmienia się struktura zapisu.

| Slot   | Moduł         | Kształt / akcent |
| ------ | ------------- | ---------------- |
| Wylot  | Przebicie     | rail / white     |
| Wylot  | Rykoszet      | brake / amber    |
| Ogniwo | Podpalenie    | canister / amber |
| Ogniwo | Nadprzewodnik | coil / green     |
| Optyka | Kolimator     | reddot / green   |
| Optyka | Luneta        | scope / white    |

Kolimator: 140 Danych, poziom 2, wszystkie tryby poza `pierce`; czas wejścia ADS
×0,5, FOV ×0,85 względem bazowego, rozrzut ADS ×0,6 względem tuningu.
Luneta: 220 Danych, poziom 5, `projectile` i `beam`; czas wejścia ×1,6,
FOV ×0,5, czułość ADS ×0,6. Bez optyki nowe mnożniki wynoszą 1.
Wyjście z celowania i ruch pozostają bez zmian. Panel pokazuje tylko odblokowane,
zgodne moduły danego slotu, nazwę slotu, „— brak —” i opis efektu pod wyborem.

Fabryka `weaponModuleVisuals.ts` tworzy proceduralne bryły z własnymi materiałami
FPP i umiarkowaną emisją (0,25). Zaczepy wynikają z bbox `frame`, `heat_cell` i
położenia `muzzle`; optyka stoi na 60% długości korpusu od tyłu. Błysk i poświata
wylotu przesuwają się na koniec dodatku, demontaż przywraca ich pozycję.
`modulesOf` dostarcza zamrożone moduły runu w `RoomScene` (także misja liniowa).
Zmiana broni i dispose zdejmują dodatki. Ręce i pozy FPP pozostają istniejące.

Kontrola wizualna dla Claude: uruchom `npm run dev`, następnie
`node tools/screens/moduleVisuals.mjs http://localhost:5173 artifacts/module-visuals`.
Skrypt wymaga deweloperskiego serwera Vite i Chromium Playwright. Tworzy 84 PNG
(7 modeli × 6 kształtów × biodro/poza ADS) oraz manifest. Używa prawdziwego
`FppViewModel` na neutralnym tle; kombinacje niedostępne w grze są oznaczone jako
kontrola geometrii. To kontrola brył i póz, bez symulowania FOV optyki ani bloomu
rozgrywki; bloom i czytelność w scenie należy sprawdzić ręcznie. Skrypt nie był
uruchamiany w rundzie Codexa zgodnie ze zleceniem. Podgląd kryjówki 3D jest rundą B.

Vitest: `modules.test.ts` (dane, schematy, kopie, zgodność, przebicie i transport
parametrów), `patches.test.ts` (`append` i błędne dane),
`meta.test.ts` (walidacja i stare meta), `runMeta.test.ts` (zamrożenie modułów),
`fireModes.test.ts` (Rapier: jedno odbicie, pozostały dystans, druga ściana,
wróg, czas życia i ponowne użycie puli), `roomPatches.test.ts`
(pistolet rzeczywiście nakłada `burning`), `workshopPanel.test.ts`
(montaż, zapis, usuwanie i filtrowanie).
