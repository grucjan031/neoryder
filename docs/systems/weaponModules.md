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

| Id               | Nazwa         | Działanie                                                        | Odblokowanie                                    | Tryby broni                     |
| ---------------- | ------------- | ---------------------------------------------------------------- | ----------------------------------------------- | ------------------------------- |
| `ricochet`       | Rykoszet      | Jedno odbicie od geometrii świata                                | 160 Danych, poziom 3                            | projectile, spread, pierce, lob |
| `pierce`         | Przebicie     | `pierceCount +1`: jeden dodatkowy cel, zachowany `pierceFalloff` | 180 Danych, poziom 4                            | projectile, spread, pierce      |
| `incendiary`     | Podpalenie    | Dopisuje `burning` na 3 s do statusów trafienia                  | 200 Danych, poziom 4                            | wszystkie                       |
| `superconductor` | Nadprzewodnik | Prędkość pocisku +20%, ciepło na strzał −15%                     | 6 Rdzeni, poziom 5, osiągnięcie `reka-strzelca` | projectile, spread, pierce, lob |

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
Rykoszet nie czyści listy trafionych celów: cel trafiony przed odbiciem nie dostanie
drugiego trafienia tego samego pocisku. Pocisk `lob` z rykoszetem odbija się od świata
przed wybuchem, a wybuch następuje dopiero po wyczerpaniu odbić (lub z końcem życia).
Pole `ricochets` istnieje tylko w trybach pociskowych (nie w `beam`).

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
Wzory (patrz też [weapons.md](weapons.md), [hands.md](hands.md)): czas wejścia
`tuning.player.aim.inS × aimInScale`; FOV = bazowy × `aimFovScale` (zastępuje domyślne
0,72, więc Kolimator 0,85 przybliża słabiej niż brak optyki); rozrzut
`1 + (aim.spread × aimSpreadScale − 1) × aim`; czułość
`1 + (aim.sensitivity × aimSensitivityScale − 1) × aim` (Luneta: 0,7 × 0,6 = 0,42).
`aimInScale` i `aimSensitivityScale` są podawane do `HeldItem`/`PlayerController`
tylko w `RoomScene`; Arena przekazuje wyłącznie `aimFovScale` (nie obsługuje modułów).
`beam` ignoruje `aimSpreadScale`. Wyjście z celowania i ruch pozostają bez zmian. Panel pokazuje tylko odblokowane,
zgodne moduły danego slotu, nazwę slotu, „— brak —” i opis efektu pod wyborem.

Fabryka `weaponModuleVisuals.ts` tworzy proceduralne bryły z własnymi materiałami
FPP. Parametry dopasowania są w `tuning.weaponModuleVisuals`.

### Dopasowanie do modelu broni

- Optyka opiera się na powierzchni siatki GLB w miejscu każdej stopy.
  Podkładki łączą stopę z korpusem także na nierównej powierzchni. W pełnym
  ADS widok ustawia się na znaku. Luneta ma otwarty okular i cienki pierścień
  celowniczy, przez którego środek widać cel. Kołysanie i opóźnienie
  obrotu wygaszają się wraz z wejściem w ADS, a odrzut nadal porusza bronią.
- W karabinie i rozpraszaczu chwyt przedni oraz laser wiszą centralnie pod osią
  wylotu (`socket.x`), przed dłonią podporową i bez jej przenikania; między
  dwoma lufami rozpraszacza stopa opiera się na parze symetrycznych podpór, a
  szerokość modułu mieści się w obrysie broni (`barrelSpanWidth`, tolerancja
  środka w X: `centerToleranceM` w `tuning.weaponModuleVisuals.grip`), dzięki
  czemu wiązka lasera biegnie w osi muszki. W blasterze i pistolecie stopa
  modułu jest przytwierdzona od spodu w osi lufy.
- Końcówkę (`compensator`, `brake`, `rail`) centruje gniazdo `muzzle`, a jej
  przekrój i długość wynikają z wymiarów czoła lufy; tylna krawędź opiera się o
  faktyczne czoło lufy — przedni pierścień/opaskę `trim` obejmującą oś wylotu w
  zasięgu szyjki (`maxSleeveDepth`) albo `frame.min.z`, gdy brak takiego
  pierścienia (tolerancja `rearToleranceM`), dzięki czemu moduł nasuwa się na
  zwężaną szyjkę bez przerwy powietrznej. Minimalna długość wynosi 14% długości
  modelu. Barwny akcent widać od strony strzelca. Górna krawędź końcówki mieści
  się pod linią celowania. Otwarta obejma rozszerza się od czoła do obudowy i
  zachowuje oba kanały rozpraszacza. Błysk i poświata przesuwają się na koniec
  dodatku, a demontaż przywraca ich pozycje.
- Położenie ogniwa wzdłuż korpusu bazuje na `heat_cell`. Dwie podpory łączą
  ogniwo z lokalną powierzchnią lewego boku, z uwzględnieniem wystających części.

`modulesOf` dostarcza zamrożone moduły runu w `RoomScene` (także misja liniowa).
Zmiana broni i dispose zdejmują dodatki.

Kontrola wizualna dla Claude: uruchom `npm run dev`, następnie
`node tools/screens/moduleVisuals.mjs http://localhost:5173 artifacts/module-visuals`.
Skrypt wymaga deweloperskiego serwera Vite i Chromium Playwright. Tworzy 252 PNG
(7 modeli × 12 kształtów × biodro/ADS/widok boczny) oraz manifest. Używa prawdziwego
`FppViewModel` na neutralnym tle; kombinacje niedostępne w grze są oznaczone jako
kontrola geometrii. To kontrola brył i póz, bez symulowania FOV optyki ani bloomu
rozgrywki. Kadr boczny obejmuje bryłę broni z dodatkiem na około 60% szerokości.
Kamerę ustala rzut wierzchołków widocznych części. Wiązka lasera, błyski
i poświaty są pomijane w tym ujęciu. Podgląd kryjówki 3D opisuje następna sekcja.

Vitest: `weaponModuleVisuals.test.ts` (styk mocowania, drożność lufy i widok przez
optykę dla zgodnych par), `modules.test.ts` (dane, schematy, kopie, zgodność, przebicie i transport
parametrów), `patches.test.ts` (`append` i błędne dane),
`meta.test.ts` (walidacja i stare meta), `runMeta.test.ts` (zamrożenie modułów),
`fireModes.test.ts` (Rapier: jedno odbicie, pozostały dystans, druga ściana,
wróg, czas życia i ponowne użycie puli), `roomPatches.test.ts`
(pistolet rzeczywiście nakłada `burning`), `workshopPanel.test.ts`
(montaż, zapis, usuwanie i filtrowanie).

## Podgląd 3D w warsztacie (runda B)

Sekcja Ekwipunek warsztatu ma podgląd wybranej broni z założonymi modułami
(`src/render/weaponPreview.ts`, klasa `WeaponPreview`). Model ładuje wspólna funkcja
`loadWeaponScene` (`weaponModelLoader.ts`, ta sama co FPP: styl gry i `applyFppSurfaces`),
moduły dodaje `attachModuleVisuals` na KLONIE modelu, więc cache FPP się nie zmienia.
Własny `WebGLRenderer` (przezroczyste tło, `preserveDrawingBuffer`) rysuje klatki tylko,
gdy canvas jest widoczny (`IntersectionObserver`, także `start()/stop()`) i coś się zmienia:
przeciąganie (pointer events, mysz i dotyk; obrót Y i nachylenie ±25°), autoobrót 15°/s
(od razu po otwarciu i 3 s po puszczeniu), nowa broń lub rozmiar. Przy
`prefers-reduced-motion: reduce` nie ma autoobrotu (osobnego ustawienia w `Settings` brak).
Bez WebGL2 (jsdom, stare przeglądarki) podgląd się nie tworzy, a panel pokazuje notkę.
Kontener ma `data-testid="weapon-preview"`, `data-weapon` i `data-modules` (id po przecinku,
po `sanitizeModules`). Wybór broni: przyciski `data-action="preview"` nad podglądem
(widoczne od dwóch broni w ekwipunku); stan pomocniczy w `previewTarget` (`workshopState.ts`).
Testy: `weaponPreview.test.ts`, `workshopPreview.test.ts`, `workshopPanel.test.ts`
(fallback), e2e `workshopPreview.spec.ts` (kryjówka `?scene=hub&debug=1&fx=lite`).

## Sklep warsztatu: bronie i dodatki

Warsztat (`workshopPanel.ts`, `workshopState.ts`) ma zakładki „Bronie” i „Dodatki”. Wiersz
wybiera przedmiot, karta pokazuje cenę, opis, zgodność i porównanie statystyk przed/po
(obrażenia, szybkostrzelność, DPS, rozrzut, odrzut, ciepło) liczone z `moddedWeapon()`
(`src/progression/moddedWeapon.ts`, definicja po łatkach modułów). Akcje: Kup / Załóż / Zdejmij;
niedostępne pozycje pokazują powód (poziom, Dane, Rdzenie, naszywka, brak zgodnej broni,
limit slotów, pełny ekwipunek). Kupno idzie przez `MetaManager.buyUnlock`; bronie mają wpisy
`weapon:<id>` w `unlocks.json` (bez zmiany zapisu, stare odblokowania zostają). Dodanie broni
do zestawu wymaga wolnego slotu (`slot:weapon2`, `slot:weapon3`).

Nowy slot `grip` (podwieszenie pod lufą) obok `muzzle`, `cell`, `optic`; limit
`moduleSlotsPerWeapon` bez zmian. Nowe pola broni (łatane przez moduły): `recoilScale`
(odrzut FPP), `hipSpreadScale` (rozrzut bez celowania), `heatCapacityScale`.

| Dodatek                | Slot   | Efekt                                               | Cena                         |
| ---------------------- | ------ | --------------------------------------------------- | ---------------------------- |
| Chwyt przedni          | grip   | odrzut ×0,7, szybkostrzelność ×1,08                 | 150 Dane, poz. 2             |
| Celownik laserowy      | grip   | rozrzut bez celowania ×0,4, zielona kropka          | 170 Dane, poz. 3             |
| Kompensator            | muzzle | odrzut ×0,5, rozrzut ×0,8                           | 170 Dane, poz. 3             |
| Celownik holograficzny | optic  | czas wejścia ×0,7, rozrzut w celowaniu ×0,35        | 190 Dane, poz. 4             |
| Rozszerzone ogniwo     | cell   | pojemność cieplna ×1,3                              | 200 Dane, poz. 4             |
| Ogniwo impulsowe       | cell   | obrażenia ×1,4, szybkostrzelność ×0,7, ciepło ×1,25 | 230 Dane + 2 Rdzenie, poz. 5 |

Wygląd: nowe kształty w `weaponModuleVisuals.ts` (ramka holo ze znakiem w bursztynie,
laser z kropką, kompensator, chwyt, ogniwa). Testy: `workshopShop.test.ts`, e2e
`workshopShop.spec.ts`.
