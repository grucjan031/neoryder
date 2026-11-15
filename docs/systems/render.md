# Render — styl F1 #05

## Profile jakości (Z9)

`tuning.quality` zawiera komplet identycznych kluczy dla `low`, `medium`, `high`.
`applyQuality(profile, targets?)` w `src/render/quality.ts` wybiera ograniczenia
oprawy; z rendererem i pipeline aktualizuje też DPR, cienie i rozmiary celów.
`main.ts` stosuje zapis przed utworzeniem sceny oraz po zmianie ustawień.
Ekran ustawień wybiera profil również bez aktywnego renderera (menu główne).
Motyw i jego przywracanie nie nadpisują jakości: pipeline odczytuje ograniczenia
oddzielnie, nie zmieniając wartości `tuning.render`.

| Klucz `quality`   | low              | medium | high               | Koszt / decyzja                                                                                                                                                           |
| ----------------- | ---------------- | ------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pixelRatio`      | 0,75             | 1      | 0 = DPR urządzenia | Koszt pikseli rośnie kwadratowo; high zachowuje wcześniejsze pełne DPR, bez nowego limitu 2                                                                               |
| `outline`         | 0                | 1      | 1                  | Kolor + normalne/głębia + kompozycja: 3 przebiegi; low korzysta ze zwykłego renderu                                                                                       |
| `bloom`           | 0                | 1      | 1                  | Maska sceny i 4 rozmycia; low pomija wszystkie                                                                                                                            |
| `bloomResolution` | 0,5 (nieaktywny) | 0,5    | 1                  | Mnożnik rozdzielczości: medium maska 1/4 bufora, rozmycia 1/8; high jak wcześniej 1/2 i 1/4                                                                               |
| `reflections`     | 0                | 0      | 1                  | Odbita scena emisyjna + 2 rozmycia w 1/2; medium usuwa 3 przebiegi                                                                                                        |
| `maxLights`       | 2                | 4      | 8                  | Limit dodatkowy dla `city.maxLights`; nieaktywne światła są niewidoczne, a nie tylko wyzerowane (mniej świateł w shaderach Standard)                                      |
| `rainDensity`     | 0,25             | 0,5    | 1                  | Mnożnik gęstości motywu w `CityDressing.render`; mniej smug i rozbryzgów, pula deszczu nadal ma do 4000 miejsc                                                            |
| `particleDensity` | 0,25             | 0,5    | 1                  | Rysowany ułamek aktywnych cząsteczek `CityParticleBatch`: para, iskry, kapanie i rozbryzgi; mniejszy overdraw i mniej aktualizacji macierzy, pule CPU pozostają bez zmian |
| `heightFog`       | 0                | 1      | 1                  | Mnożnik gęstości mgły wysokościowej; obliczenia wykładnicze w kompozycji, bez dodatkowego przebiegu                                                                       |
| `shadows`         | 0                | 0      | 0                  | Dynamiczne cienie były i pozostają wyłączone                                                                                                                              |

W `low` wyłączenie `outline` zgodnie z dotychczasową semantyką omija cały
pipeline stylu, także gradient nieba, mgłę odległości, winietę i impulsy postFx.
Materiały, oświetlenie, geometria i viewmodel nadal są rysowane. W `medium`
zostają kontury, atmosfera i impulsy, a koszt maleje dzięki DPR, bloomowi,
światłom i wyłączeniu odbić. Bez viewmodelu i impulsu neonStreet ma odpowiednio
1 / 8 / 11 przebiegów. Są to koszty strukturalne, nie wyniki pomiaru FPS.

Wszystkie zmiany działają na żywo, także podczas pauzy; deszcz zachowuje bazową
gęstość motywu, a ograniczenie stosuje tylko na czas aktualizacji oprawy.
Notka w ustawieniach pochodzi z `settings.pl.json`:
„Zmiany jakości są stosowane na bieżąco.” Zmiana rozdzielczości bloomu działa także
przy niezmienionym DPR. Bufory nieaktywnych efektów pozostają do ponownego użycia
i są zwalniane w `dispose()` pipeline. Zmiana liczby widocznych świateł może
spowodować jednorazową kompilację wariantu shadera.

Brak zapisu ustawień oznacza `medium`. Istniejące `high` oraz starszy zapis bez
pola jakości zachowują `high`. `tests/unit/quality.test.ts` sprawdza profile na
atrapie WebGLRenderer, przebiegi i rozdzielczości, powrót low → high, motywy,
oprawę miasta i zachowanie zapisu.

Pomiar architekta: `PERF_QUALITY=low|medium|high` dla `tests/e2e/perf.spec.ts`
(domyślnie `high`). Test ustawia localStorage przed nawigacją, odrzuca nieznany
profil i dopisuje `quality` do `perf-report/arena.json` oraz załącznika testu.
Cel 60 FPS na średnim laptopie dla `medium` wymaga pomiaru na docelowym GPU.
Kontrola ręczna: w `?scene=neon-test` zmienić jakość w ustawieniach pauzy,
porównać kontury, bloom, odbicia, światła i gęstość deszczu.
Powrót do `high` powinien przywrócić wygląd sprzed Z9.

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
Neony są unlit i mają `toneMapped = false`. Materiały `enemyGlow`, `player` i `power`
mają `userData.bloom = true` (klony też), dzięki czemu świecą w bloomie selektywnym.
Materiał `world` ma w `onBeforeCompile` siatkę płytek podłogi (patrz niżej).

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

Motyw `neonStreet` (poprawka oświetlenia): `hemiIntensity` 1,35 (ciemne partie czytelne, bryły i przejścia widoczne), `bloomStrength` 0,65 i `bloomRadius` 1,2 (neony świecą bez mlecznej mgiełki na całym kadrze). Światło dynamiczne i poświata neonów, hologramów i latarni: `docs/systems/city.md`, sekcja „Ocena świateł”; parametry w `tuning.city` (widoczne w lil-gui).
Domyślny renderer używa `NoToneMapping`; zachowaj to ustawienie, aby oba tryby
obrysu dawały tę samą paletę. Dynamiczne cienie pozostają wyłączone.

## Pipeline stylu

`StylePipeline` / `createRenderPipeline(renderer)` z `src/render/outline.ts`
nie wymagają EffectComposer. Pełny przebieg (każdy pass pomijany, gdy wyłączony):

1. Render koloru do celu liniowego HalfFloat (pełna rozdzielczość bufora).
2. Render geometrii z `scene.overrideMaterial = MeshNormalMaterial` i teksturą
   głębi. Tło jest pomijane w tym przebiegu.
   Obiekty z `userData.noOutline = true` (efekty, przezroczyste quady oprawy) są w tym
   przebiegu ukryte, więc nie dostają obrysu; bloom i odbicia nadal je rysują.
3. **Bloom selektywny** (`bloom = 1` i `bloomStrength > 0`; `bloom.ts`): maska w 1/2
   rozdzielczości, w której kolor mają tylko materiały emisyjne (flaga
   `userData.bloom`, albo nasycony materiał unlit bez flagi; `userData.bloom = false`
   wyłącza), a pozostałe siatki zapisują wyłącznie głębię (zasłaniają neony, same nie
   świecą). Siatki przezroczyste lub niezapisujące głębi, bez emisji (deszcz, para,
   naklejki, plamy świateł), są na czas maski ukryte, a nie podmieniane na zasłaniający
   materiał (inaczej wycinałyby prostokątne dziury w halo i odbiciach). Obiekty bez
   materiału siatki (linie, punkty, sprite) bez emisji są na czas maski ukryte. Potem 4 przebiegi rozmycia Gaussa w 1/4 rozdzielczości
   (dwa o promieniu `bloomRadius`, dwa 2,5 raza szersze).
4. **Kompozycja** (pełny ekran, jeden shader): Sobel 3×3 na normalnych i głębi, niebo,
   mgła, kontur, bloom, winieta, konwersja do przestrzeni wyjściowej.
5. **Pass impulsów** (`postFx = 1` i aktywny impuls; `postFx.ts`): aberracja
   chromatyczna, czerwone krawędzie, odcień i desaturacja Skupienia. Pomijany, gdy
   `damage` i `focus` wynoszą 0, więc w stanie spoczynku kosztu nie ma (kompozycja
   rysuje wtedy prosto na ekran).

Biały świat się nie rozmywa: bloom nie jest progiem jasności, lecz maską emisyjną
nakładaną metodą "over" (`kolor * (1 - pokrycie) + halo`), co daje widoczne halo także na bieli.

Głębia jest linearyzowana według typu kamery (perspektywiczna lub ortograficzna).
Próg głębi dotyczy różnicy względem odległości środka próbki, co ogranicza zależność
od odległości kamery. Gradienty Sobela są dzielone przez 8. Grubość jest odstępem
próbek w pikselach bufora GPU (nie CSS), a kolor pochodzi z `outlineColor`.
`outlineDepthThreshold` i `outlineNormalThreshold` regulują wykrywanie krawędzi;
wyższy próg usuwa drobniejsze krawędzie. `outlineThickness = 0` ukrywa linię.
**`outline = 0` omija cały pipeline stylu** (zwykły `renderer.render`, bez mgły, gradientu,
bloomu i postFx; materiały nadal się synchronizują, a siatka podłogi działa).

### Atmosfera i głębia

Liczone w shaderze kompozycji na podstawie bufora głębi (nie `scene.fog`):

- **Niebo**: piksele bez geometrii (głębia 1) dostają pionowy gradient od `skyHorizon`
  (przy horyzoncie) do `skyTop` (według kierunku patrzenia kamery; wysokość przejścia
  `skyGradientHeight`, w jednostkach składowej Y kierunku). `skyGradient = 0` zostawia
  tło sceny.
- **Mgła odległości**: `smoothstep(fogNear, fogFar, głębia) * fogStrength` ku `fogColor`;
  ta sama wartość rozjaśnia też kolor konturu, więc dalekie linie bledną.
  `fogStrength = 0` wyłącza.
- **Siatka podłogi** (`materials.ts`, `onBeforeCompile` materiału `world`): linie co
  `gridSize` m w przestrzeni świata, tylko na powierzchniach poziomych (normalna z
  pochodnych pozycji, działa z `InstancedMesh`), kontrast `gridContrast` (0 = brak),
  grubość `gridLineWidth` px, zanik przy zbyt gęstych płytkach (moiré).

### Kompozycja końcowa i impulsy

Stan (`PostFxState`, bez GPU, czas rzeczywisty klatki, więc hitstop i slowmo go nie
rozciągają):

- `damage` 0..1: spadek HP gracza (`health_changed` encji z `entity_spawned` kind
  `player`) ustawia `max(damage, damagePulseMin + udział_utraconego_HP * damagePulseHpGain)`,
  zbity do 1; potem liniowo maleje do 0 w `damagePulseS`. Leczenie i pierwszy odczyt
  HP nie wywołują impulsu.
- `focus` 0..1: zdarzenie `focus` z `durationS > 0` włącza (narastanie `focusFadeInS`),
  `durationS = 0` wyłącza (zanik `focusFadeOutS`); koniec naturalny i reset emitują
  `focus { durationS: 0 }` (patrz `api.md`), więc timer po stronie renderu nie jest potrzebny.

Efekt: aberracja `damageAberration` (rośnie od środka ku krawędziom), czerwony odcień
krawędzi `damageTint` w kolorze `damageTintColor`, dla Skupienia mieszanie z
`focusTintColor` siłą `focusTint` i desaturacja `focusDesaturate`. Winieta
(`vignetteStrength`, `vignetteRadius`, `vignetteSoftness`) działa w kompozycji, więc
nie dodaje passu. `postFx = 0` wyłącza winietę i impulsy.

`bindEvents(bus)` podpina zdarzenia (wywołane w `main.ts` zaraz po utworzeniu busa;
odpina je `dispose()`). `fxState` daje bezpośredni dostęp do stanu; komenda konsoli
debug `fx <damage|focus|off>` uruchamia impulsy do oceny wizualnej.

### Parametry `tuning.render`

| Pole                                                       | Domyślnie                    | Znaczenie                                                  |
| ---------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| `bloom`, `postFx`                                          | 1, 1                         | przełączniki jakości (0 pomija pass)                       |
| `bloomStrength`, `bloomRadius`                             | 0,6, 1,2                     | siła halo, mnożnik odstępu próbek rozmycia                 |
| `skyGradient`, `skyTop`, `skyHorizon`, `skyGradientHeight` | 1, `#ffffff`, `#e3e7ea`, 0,5 | gradient nieba                                             |
| `fogStrength`, `fogColor`, `fogNear`, `fogFar`             | 0,85, `#eef1f3`, 14, 80      | mgła odległości (m)                                        |
| `skyFlash`                                                 | 0                            | błysk burzy: dodatek do nieba i mgły (0..1), ustawia scena |
| `viewmodelDepth`                                           | 0,01                         | ułamek zakresu głębi dla rąk i przedmiotu                  |
| `gridSize`, `gridContrast`, `gridLineWidth`                | 2, 0,1, 1                    | siatka podłogi (m, 0..1, px)                               |
| `vignetteStrength`, `vignetteRadius`, `vignetteSoftness`   | 0,2, 0,55, 0,6               | winieta                                                    |
| `damagePulseS`, `damagePulseMin`, `damagePulseHpGain`      | 0,4, 0,35, 2                 | czas i siła impulsu obrażeń                                |
| `damageAberration`, `damageTint`, `damageTintColor`        | 0,018, 0,5, `#ff1a2a`        | aberracja i czerwień krawędzi                              |
| `focusTint`, `focusTintColor`, `focusDesaturate`           | 0,14, `#ff2bd6`, 0,3         | Skupienie                                                  |
| `focusFadeInS`, `focusFadeOutS`                            | 0,15, 0,35                   | narastanie i zanik Skupienia                               |

### Viewmodel zawsze na wierzchu

Ręce i trzymany przedmiot (`FppViewModel`) leżą na warstwie `VIEWMODEL_LAYER` (1)
Three.js (`src/render/viewmodelLayer.ts`). `renderWithViewmodel` rysuje świat (warstwa 0),
a potem, tylko gdy istnieje jakiś viewmodel, drugi przebieg warstwy 1 tym samym celem bez
czyszczenia, z macierzą projekcji kamery ściskającą głębię do pierwszych
`viewmodelDepth` zakresu bufora. Dzięki temu viewmodel nie przenika ścian, osłon ani wrogów,
a między swoimi elementami zachowuje poprawną głębię. Przebieg jest używany w trzech
miejscach: kolor, normalne/głębia (obrys) i maska bloomu, więc obrys i bloom rąk działają.
Shader obrysu przywraca pełny zakres głębi pikseli viewmodelu (`depth / viewmodelDepth`).
Światła dostają warstwę 1 w tym przebiegu (Three zbiera światła wg maski warstw kamery).

### Koszt

Pomiar w Chromium z SwiftShader (render programowy na CPU, `?scene=arena&loadout=classic`,
1280×720, kolejne konfiguracje w jednej sesji; środowisko zaszumione, ±10 ms): zwykły render
(`outline = 0`) ok. 18 ms; obrys bez dodatków (odpowiednik poprzedniego pipeline'u) ok.
52-65 ms; atmosfera (niebo + mgła) +3-8 ms; bloom +10-15 ms (maska to druga scena, ale w
1/4 pikseli); winieta w kompozycji praktycznie bez kosztu; pass impulsów działa tylko
podczas impulsu (jeden pełnoekranowy pass HalfFloat); wszystko razem ok. 65-85 ms. Wartości
absolutne na CPU nie przekładają się na GPU, ale proporcje pokazują, że bloom jest
najdroższym dodatkiem: na słabym sprzęcie ustaw `bloom = 0`, potem `postFx = 0`.
Cele pośrednie bloomu i passu impulsów są tworzone przy pierwszym użyciu i zmieniają
rozmiar razem z oknem.

`setSize(w, h)` przyjmuje rozmiar CSS i uwzględnia aktualne DPR renderera.
Pipeline wykrywa też zmianę rozmiaru bufora przy renderowaniu. Stan tła,
overrideMaterial, celu, autoClear i koloru czyszczenia jest przywracany także
przy błędzie. `dispose()` zwalnia cele (także bloomu i impulsów), teksturę głębi,
materiały shaderów, geometrię pełnoekranową i subskrypcje zdarzeń.
Wydajność na słabym GPU i czytelność w 0,2 s wymagają oceny człowieka.

## Integracja w main.ts (po stronie Architekta)

1. Importuj `createRenderPipeline` z `./render/outline`.
2. Po skonfigurowaniu renderera utwórz jedną instancję:
   `const pipeline = createRenderPipeline(renderer);`.
3. W callbacku renderowania zachowaj `scene.render(alpha)`, a następnie zamiast
   `renderer.render(three, camera)` wywołaj `pipeline.render(three, camera, frameDt)`
   (`frameDt` to czas rzeczywisty klatki w s). Po utworzeniu `EventBus` wywołaj
   `pipeline.bindEvents(bus)`.
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
mapowanie, cache, gradient, synchronizację, przebiegi i przywracanie stanu,
przełączniki bloom/postFx, maskę emisyjną, impulsy obrażeń i Skupienia, siatkę
podłogi i zwalnianie zasobów (`renderPostFx.test.ts`);
test sceny obejmuje fallback, GLB, instancje i zwalnianie zasobów.

## Motywy Neon Noir

`src/data/themes/{white,neonStreet}.json` zawierają pełne zestawy parametrów
`render` oraz dane `rain` dla modułu deszczu. Schemat zod znajduje się w
`themeSchema.ts`, eager loader i wybór URL w `themes.ts`. Motyw `white` zachowuje
wszystkie wcześniejsze wartości `tuning.render`; nowe efekty są wyłączone.
`applyTheme()` zapisuje poprzedni stan i zwraca idempotentne przywrócenie.
Pokoje i arena posiadają `SceneAtmosphere`, która stosuje motyw i sprząta go
przy opuszczaniu sceny. `?theme=<id>` nadpisuje dane układu. Nieznany identyfikator
ostrzega raz i wybiera white. Deszcz nie jest tu renderowany.

Materiały miejskie (`src/render/urbanMaterials.ts`, lista `urbanKinds`) są
materiałami Standard i przyjmują kolorowe PointLight (limit 8 obsługuje integrator
świateł). Rozpoznawane po nazwie glTF `mat_<rodzaj>`; kolor bazowy to
`tuning.render[rodzaj]` (nadpisywany przez motyw), a wygląd definiuje tabela
`urbanLooks`: tekstura, `scale` (powtórzenia na metr), roughness, metalness,
`bump` (mnożnik reliefu) i `wetness`. Rzut tekstur jest trójplanarny w przestrzeni
świata.

| Rodzaj       | Tekstura (`surfaces/`) | Skala | Rough. | Metal. | Bump | Przeznaczenie                           |
| ------------ | ---------------------- | ----: | -----: | -----: | ---: | --------------------------------------- |
| `concrete`   | `concrete`             |  0,25 |    0,8 |      0 |  0,5 | beton, bariery, chodniki (wetness 0,22) |
| `asphalt`    | `asphalt`              |  0,25 |    0,3 |      0 | 0,25 | jezdnia, mokra (wetness 1)              |
| `metal`      | `metal_panel`          |  0,25 |    0,8 |   0,35 |  0,5 | blacha, konstrukcje                     |
| `facade`     | `brick`                |  0,25 |    0,8 |      0 |  0,9 | ściany budynków, okna, rolety           |
| `trim`       | `metal_panel`          |  0,25 |    0,8 |   0,35 |  0,3 | listwy, obramowania                     |
| `glass`      | `grime`                |  0,25 |    0,8 |      0 |    0 | szkło (proceduralna łuna)               |
| `cable`      | `grime`                |  0,25 |    0,8 |      0 |    0 | kable, czarne detale                    |
| `paint`      | `painted_metal`        |   0,7 |   0,55 |   0,25 |  0,7 | malowana blacha: kontenery, drzwi       |
| `lacquer`    | `painted_metal`        |   0,5 |    0,3 |    0,3 | 0,25 | lakier: karoseria, automaty             |
| `rust`       | `rust_metal`           |   0,8 |   0,85 |    0,3 |    1 | skorodowany metal: schody, rury         |
| `corrugated` | `corrugated`           |   0,5 |   0,55 |   0,35 |  1,4 | blacha falista: daszki, rolety          |
| `plastic`    | `plastic`              |     1 |    0,6 |      0 |  0,5 | plastik: skrzynki, pokrywy              |
| `hivis`      | `plastic`              |     1 |    0,5 |      0 |  0,5 | odzież ostrzegawcza, pachołki           |
| `rubber`     | `rubber`               |   1,2 |    0,9 |      0 |  0,7 | guma: koła, worki, uszczelki            |
| `wood`       | `wood_planks`          |   0,8 |   0,85 |      0 |  1,1 | drewno: palety, lady                    |
| `fabric`     | `tarp`                 |   0,9 |   0,95 |      0 |  0,8 | tkanina: markizy, noren, lampiony       |
| `machine`    | `tech_panel`           |   0,6 |    0,5 |   0,35 |    1 | urządzenia: panele, klawiatury          |
| `paving`     | `paving`               |   0,5 |   0,55 |      0 |    1 | kostka brukowa, chodnik (wetness 0,45)  |
| `plaster`    | `plaster`              |   0,3 |    0,9 |      0 |  0,8 | tynk (wetness 0,1)                      |
| `hazard`     | `plastic`              |     1 |   0,55 |      0 |  0,4 | pasy ostrzegawcze (patrz niżej)         |

Relief: z jasności tekstury powierzchni (`cityHeight`) różniczkowanej w przestrzeni
ekranu liczone jest zaburzenie normalnej (bez UV), skalowane przez
`tuning.render.cityBumpStrength` × `bump` rodzaju. Gaśnie z odległością, gdy piksel
obejmuje kilka tekseli (`smoothstep(1, 4, texeli na piksel)`), co ogranicza
migotanie. Wartość 0 daje powierzchnie płaskie (motyw `white`); neonStreet używa 1.
Roughness jest dodatkowo modulowany jasnością tekstury. Całość wyłącza
`citySurfaceDetail` = 0.

Materiał `hazard` rysuje w shaderze bursztynowo-czarne ukośne pasy w przestrzeni
świata; okres pasów w metrach to `tuning.render.cityHazardPeriod` (domyślnie 0,3).

Nadruki UV (`src/render/propPrints.ts`): `mat_label_<x>` i `mat_screen_<x>`
(rozpoznawane przez `isPrintMaterialName`, tworzone przez `printMaterial(name)`
i podpinane w `applyStyle`) mapują teksturę po UV modelu zamiast rzutu świata.
Naklejka (`/assets/textures/labels/label_<x>.webp`) to oświetlany
`MeshStandardMaterial` z odcięciem alfy 0,5; ekran
(`/assets/textures/screens/screen_<x>.webp`) to `MeshBasicMaterial` bez tone
mappingu z `userData.bloom = true` (świeci w bloomie). Oba mają polygon offset,
żeby nie walczyć z podłożem. Do załadowania tekstury materiał jest niewidoczny.
Bez detalu miasta (`citySurfaceDetail` 0, motyw `white`) naklejka jest biała, a
ekran ciemny. Tekstury ładuje wspólny `assetTexture(folder, id)` z
`src/render/surfaceTextures.ts` (foldery `surfaces`, `labels`, `screens`);
`surfaceTexture(name)` to jego skrót dla `surfaces`. Konwencja UV i lista nadruków:
`docs/assets.md`.

Nowe pola motywu `render`: `cityBumpStrength` (≥ 0, siła reliefu) i
`cityHazardPeriod` (> 0, okres pasów w m) obok `citySurfaceDetail`; kolory
nowych rodzajów (`paint`, `lacquer`, `rust`, `corrugated`, `plastic`, `hivis`,
`rubber`, `wood`, `fabric`, `machine`, `paving`, `plaster`, `hazard`) są polami
`render` w motywach i domyślnie w `tuning.ts`.

Tekstury concrete/asphalt/metal_panel/brick/grime (oraz nowe z tabeli)
są próbkowane triplanarnie z pozycji świata; maska asphalt_puddles w XZ.
Pliki `/assets/textures/surfaces/*.webp` są ładowane leniwie i współdzielone.
Manifest glob pozwala pominąć żądanie brakującego pliku. Brak lub niepoprawny plik
daje jeden warning i proceduralny szum, bez przerwania renderu.
Po dodaniu nowych plików w trakcie sesji należy odświeżyć stronę.
Fasady mają siatkę okien, ramy, rolety, gzymsy oraz ciepłą/zimną emisję z hasha
komórki. Ich `userData.bloomMaterial` rysuje tylko słabą emisję okien w maskach.
Szkło odbija kolor łuny proceduralnie. `mat_neon_amber|green|violet|blue|white`
i `mat_light_white` są unlit z jawnym bloomem. Czerwień, cyan i magenta pozostają
rolami walki. W neonStreet skrzynie są jasne, a wróg ma czerwony rim Fresnela.

Odbicia (`reflections.ts`) używają odbitej względem `playerSpawn.y` kamery,
globalnej płaszczyzny odcinającej geometrię poniżej podłogi i selekcji emisji
z bloomu. Kamera odbić pomija viewmodel. Maska i dwa rozmycia Gaussa mają 1/2
szerokości i wysokości bufora. Kanał A istniejącego przebiegu normalnych koduje
`userData.wetness`: asphalt 1, paving 0.45, concrete 0.22, plaster 0.1, pozostałe 0. Kompozycja rekonstruuje
pozycję świata, sprawdza normalną w górę i tolerancję wysokości podłogi,
projektuje odbicie, dodaje Fresnel, maskę kałuż i animowane zniekształcenie.
W white nie powstają cele odbić i nie ma dodatkowych przebiegów.

Mgła wysokościowa w kompozycji używa całki gęstości wzdłuż promienia widzenia,
ze spadkiem wykładniczym względem wysokości nad podłogą. Nie obejmuje viewmodelu.
Panorama to trzy warstwy InstancedMesh, proceduralne okna, bursztynowo-białe
światła dachowe oraz trzy odległe panele z gradientem i szumem. Osobny `Rng`
z identyfikatora pokoju zapewnia powtarzalność, bez dotykania RNG symulacji.
Nie ma colliderów. `panoramaDensity` i `panoramaHeight` przebudowują instancje
tylko po zmianie wartości; reszta aktualizuje uniformy.

Wszystkie nowe pola `tuning.render` widoczne są automatycznie w lil-gui:
`reflectionStrength/Distortion/Puddles/FloorTolerance`,
`heightFogDensity/Falloff`, `panoramaEnabled/Density/Height/WindowWarm/WindowCool`,
`enemyRimStrength/Power`, kolory świateł i materiałów, `citySurfaceDetail`,
`cityBumpStrength`, `cityHazardPeriod`.

### Koszt i kontrola

Przy włączonym bloomie, bez impulsu i viewmodelu: white = **8 przebiegów**,
neonStreet = **11 przebiegów**. W obu: kolor i normalne/głębia w pełnej
rozdzielczości, maska bloomu w 1/2, cztery rozmycia w 1/4, kompozycja w pełnej.
Neon dodaje maskę odbicia i dwa rozmycia w 1/2. Panorama uczestniczy w istniejących
przebiegach geometrii. Viewmodel dodaje po jednym wywołaniu renderu w kolorze,
normalnych i bloomie: odpowiednio 11/14; aktywny impuls dodaje jeden pełny pass.
Przy `outline=0` nadal omijany jest cały pipeline stylu.

`?scene=neon-test`: uliczka 8 × 30 m, fasady, asfalt, beton, metal, szkło,
jasna skrzynia i trzy czerwone manekiny, pięć neonów z kolorowymi światłami.
Porównaj z `?scene=neon-test&theme=white`. Sprawdź odbicia poniżej neonów,
brak odbić na ścianach i skrzyni, daleką panoramę i czytelność wroga.
Jednostkowo sprawdzane są dane, przywracanie motywu, deterministyczność panoramy,
liczba i rozdzielczość passów, mokra maska oraz przywracanie stanu po błędzie.
W sandboxie wykonawcy Chromium/SwiftShader zwrócił `spawn EPERM`; zrzuty i
kompilacja shaderów na GPU wymagają weryfikacji przez integratora.

## Dłonie FPP — animacja

`HandRig` animuje przegubowe modele R/L pozami Euler XYZ z walidowanych danych
`src/data/hands/handPoses.json`, względem orientacji spoczynkowych. Przypięcie
jest oparte na odwrotności macierzy gniazda dłoni. `FppBlade` / `FppBlaster`
rysują prawy chwyt oraz drugi chwyt bliźniaczych; `FppOffhand` obsługuje wolną
lewą dłoń, podparcie na `support` broni i gest mocy z własnym magentowym materiałem.
`FppMotion` dodaje opad zamiany, sway i bob wyłącznie w renderze. Strojenie:
`tuning.hands` w lil-gui oraz stałe pozycji/kątów na górze plików FPP.
Szczegóły i kontrola ręczna: [hands.md](hands.md#render-przegubowych-dłoni).
