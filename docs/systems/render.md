# Render — styl F1 #05

Warstwa `src/render/` nie uczestniczy w symulacji. Materiały i obrys służą szybkiej
identyfikacji roli obiektu: białe otoczenie, czerwone zagrożenia, czarne rekwizyty,
cyan dla gracza i magenta dla Rezonansu.

## Paleta i materiały

Źródłem bieżących kolorów jest `tuning.render`. `palette.ts` pozostaje paletą
bazową starszych scen i tła. Panel lil-gui pokazuje liczby oraz pola hex przez
`addColor`.

| Nazwa w glTF        | MaterialKind  | Domyślny kolor | Materiał          |
| ------------------- | ------------- | -------------- | ----------------- |
| `mat_world`         | `world`       | `#ffffff`      | MeshToonMaterial  |
| `mat_enemy`         | `enemy`       | `#e0262b`      | MeshToonMaterial  |
| `mat_interactive`   | `interactive` | `#080808`      | MeshToonMaterial  |
| `mat_enemy_glow`    | `enemyGlow`   | `#ff5050`      | MeshBasicMaterial |
| `mat_player_cyan`   | `player`      | `#00e5ff`      | MeshBasicMaterial |
| `mat_power_magenta` | `power`       | `#ff2bd6`      | MeshBasicMaterial |

`getMaterial(kind)` zwraca współdzieloną instancję z cache; nieznany rodzaj rzuca
`Error`. Trzy materiały toon współdzielą `DataTexture` 3×1 z progami 150, 200, 255,
filtrem `NearestFilter` i bez mipmap. Płaskie normalne pochodzą z modeli low-poly.
Neony są unlit i mają `toneMapped = false`; efekt nie używa bloom.

`applyStyle(root)` przechodzi po wszystkich `Mesh` (także `InstancedMesh`), obsługuje
tablice materiałów i zachowuje geometrię. Nieznana nazwa dostaje `world` oraz
`console.warn` raz na nazwę w czasie życia aplikacji. Kolejne wywołanie jest
bezpieczne: materiały rejestru zachowują nazwy `mat_*`. Funkcja nie niszczy
materiałów źródłowych, ponieważ mogą należeć do innych użytkowników modelu.
Właściciel załadowanego modelu zwalnia je po podmianie, jeśli nie są już potrzebne.
Sceny nie zwalniają współdzielonych materiałów ani ich mapy gradientowej.

`syncMaterials()` czyta kolory z `tuning.render` co klatkę i aktualizuje istniejące
instancje. Wywołuje ją pipeline (również z wyłączonym obrysem), a scena testowa
robi to dodatkowo, aby paleta działała przed integracją pipeline. Wybrano odczyt
co klatkę zamiast `onChange`: reaguje również na zmiany programowe bez zależności
od panelu debug.

## Oświetlenie

`createStyleLights()` z `src/render/lights.ts` zwraca grupę z `HemisphereLight`
i ukośnym `DirectionalLight` z góry. Dodaj ją do sceny i wywołuj `lights.sync()`
w jej `render()`. Intensywności czytane są z `hemiIntensity` i `keyIntensity`.
Górne powierzchnie są prawie białe, boczne jaśniejszym odcieniem szarości.
Domyślny renderer używa `NoToneMapping`; zachowaj to ustawienie, aby oba tryby
obrysu dawały tę samą paletę. Dynamiczne cienie pozostają wyłączone.

## Pipeline obrysu

`StylePipeline` / `createRenderPipeline(renderer)` z `src/render/outline.ts`
nie wymagają EffectComposer. Włączony pipeline wykonuje:

1. Render koloru do celu liniowego HalfFloat.
2. Render geometrii z `scene.overrideMaterial = MeshNormalMaterial` i teksturą
   głębi. Tło jest pomijane w tym przebiegu.
3. Pełnoekranowy Sobel 3×3 na normalnych i głębi, kompozycję ciemnoszarej linii
   z kolorem oraz konwersję do wyjściowej przestrzeni barw renderera.

Głębia jest linearyzowana według typu kamery (perspektywiczna lub ortograficzna).
Próg głębi dotyczy różnicy względem odległości środka próbki, co ogranicza zależność
od odległości kamery. Gradienty Sobela są dzielone przez 8. Grubość jest odstępem
próbek w pikselach bufora GPU (nie CSS), a kolor pochodzi z `outlineColor`.
`outlineDepthThreshold` i `outlineNormalThreshold` regulują wykrywanie krawędzi;
wyższy próg usuwa drobniejsze krawędzie. `outlineThickness = 0` ukrywa linię.
`outline = 0` całkowicie omija cele i shader, wykonując zwykły `renderer.render`.

`setSize(w, h)` przyjmuje rozmiar CSS i uwzględnia aktualne DPR renderera.
Pipeline wykrywa też zmianę rozmiaru bufora przy renderowaniu. Stan tła,
overrideMaterial, celu, autoClear i koloru czyszczenia jest przywracany także
przy błędzie. `dispose()` zwalnia cele, teksturę głębi i pełnoekranową geometrię.
Wydajność na słabym GPU i czytelność w 0,2 s wymagają oceny człowieka; przełącznik
obrysu pozwala porównać koszt dodatkowych przebiegów.

## Integracja w main.ts (po stronie Architekta)

1. Importuj `createRenderPipeline` z `./render/outline`.
2. Po skonfigurowaniu renderera utwórz jedną instancję:
   `const pipeline = createRenderPipeline(renderer);`.
3. W callbacku renderowania zachowaj `scene.render(alpha)`, a następnie zamiast
   `renderer.render(three, camera)` wywołaj `pipeline.render(three, camera)`.
4. W `resize`, po `renderer.setSize(window.innerWidth, window.innerHeight)`, wywołaj
   `pipeline.setSize(window.innerWidth, window.innerHeight)`.
5. W zamykaniu aplikacji wywołaj `pipeline.dispose()` przed `renderer.dispose()`.
6. W `src/scenes/index.ts` importuj `StyleTest` z `./styleTest` i dopisz
   `'style-test': () => new StyleTest()`.

Pliki `main.ts` i rejestr scen pozostają do integracji przez Architekta.
Pipeline nie dodaje świateł do scen automatycznie: nowe sceny powinny używać
`createStyleLights()`; `StyleTest` już to robi.

## Dodawanie obiektu

W Blenderze przypisz materiał `mat_*` z tabeli (katalog: `docs/assets.md`), załaduj
GLB i wywołaj `applyStyle(gltf.scene)` przed dodaniem do sceny. Bryłom proceduralnym
przypisz `getMaterial(kind)`. Nie twórz lokalnych wariantów kolorystycznych dla
istniejących ról. Powtarzalne nieruchome obiekty rysuj przez `InstancedMesh`,
współdzieląc geometrię i materiał; ich macierze muszą zawierać transformację
węzła modelu. Symulacja nie importuje `src/render`.

## Weryfikacja

`StyleTest` buduje statyczny pokaz: podłoga, ściany, filary, osłony, dwie skrzynie,
dwaj wrogowie, broń na stojaku, pocisk oraz próbka magenty. Ładuje modele z
`public/assets/models/`; przy błędzie zostają proste bryły. Powtarzalne ściany,
filary i osłony używają instancji. Konstruktor `new StyleTest(false)` pozwala
testować bez DOM i sieci.

Po rejestracji otwórz `?scene=style-test&debug=1`. W ciągu 30 sekund porównaj
obrys 0/1, jasne boki i górę filarów, sylwetki czerwonych wrogów na tle ściany,
czarne skrzynie oraz cyan/magentę. Zmień kolor w panelu i sprawdź wszystkie
współdzielone obiekty. Oceń, czy role widać w 0,2 s i czy obrys nie zasłania broni.

`tests/e2e/style.spec.ts` jest oznaczony `test.fixme` do rejestracji sceny.
Po integracji usuń fixme, utwórz i przejrzyj wzorzec przez
`npm run e2e -- tests/e2e/style.spec.ts --update-snapshots`; następne uruchomienia
porównują canvas z `maxDiffPixelRatio: 0.02`. Jednostkowe testy renderu obejmują
mapowanie, cache, gradient, synchronizację, przebiegi i przywracanie stanu;
test sceny obejmuje fallback, GLB, instancje i zwalnianie zasobów.
