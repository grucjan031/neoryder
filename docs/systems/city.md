# Oprawa miasta — Neon Noir

## Tło leśne rezydencji (run6, etap A)

`lighting.panoramaKind: "forest"` w profilu pogody wybiera `ForestPanorama`.
Brak pola zachowuje miejską `Panorama`; przełączanie pogody zwalnia stare tło.
Generator `forestLayout.ts` jest czystym TS i używa osobnego `Rng(seed).fork('forest')`.
Uwzględnia światowe AABB budynku, także przesuniętego, z marginesem 3 m oraz
pełnym promieniem korony i zapasem kołysania. Drzewa stoją na powierzchni pagórków.

Domyślne pule: 480 iglaków w trzech warstwach, 200 liściastych, 240 kęp podszytu,
28 pagórków, 24 wstęgi mgły, 64 słupy ogrodzenia, 6 dronów, 2 bliskie przeloty,
8 par oczu. Pnie i gałęzie, warstwowe korony, wielobryłowe korony liściaste i paprocie
mają osobne partie `InstancedMesh`. Całe tło to 14 partii (limit 20), bez fizyki
i bez świateł punktowych. Pozostałe elementy to podłoże, ogrodzenie z bursztynowymi
lampami, maszt, lądowisko H-06 z pierścieniem lamp oraz kopuła z księżycem.
Lokalna mgła i poświata są liczone w shaderach lasu, bez mgły we wnętrzu.
Parametry i budżety są w folderze `forest` panelu lil-gui; zmiana przebudowuje pule.

Loader obsługuje prefiks `res_`; audyt zna ścienne, przejściowe i sufitowe fixtures
z §2.1 mapy run6. Materiały `res_arch_concrete`, `res_dark_walnut`, `res_nero_marble`
i `res_plush_carpet` działają na blokach i przez `mat_res_*` w GLB. Do etapu C
korzystają odpowiednio z `concrete_raw_cast`, `off_wood_slat_wall`,
`off_polished_granite`, `off_carpet_tile`. Docelowe pliki `res_*.webp` mają
pierwszeństwo po dodaniu; parametry materiałów są już docelowe.

Sprawdzenie w 30 s: `?scene=horizonTest&profile=kuroganeForestResidence&debug=1&seed=run6`.
Start za 22-metrową szybą, próbki czterech materiałów i szczelne `rainShelters`.
Przycisk profilu jest w pasku sceny. `fly` włącza wolną kamerę. Porównaj z
`?scene=horizonTest&profile=kuroganeOfficeTower&debug=1`: miejska panorama powinna
zachować wygląd. Testy: `forestLayout.test.ts`, `arenaWeather.test.ts`, `skyline.test.ts`.
Ocena naturalności sylwetek, deszczu za szybą i rzeczywistego kosztu całej sceny
wymaga przeglądu w przeglądarce; limit partii dotyczy samego tła.

## Koszt struktury pokoju po scalaniu Z19

Poniżej `meshe przed → po (unikalne materiały przed = po)`, zmierzone na
prawdziwych GLB przez `tests/unit/roomStaticBatch.test.ts`. Materiały w różnych
wierszach mogą być współdzielone, więc ich liczby nie są addytywne.

| Źródło                                        |    alleyMarket | combatWarehouse |  eliteFoundry |
| --------------------------------------------- | -------------: | --------------: | ------------: |
| Bloki proceduralne, w tym fasady wokół pokoju |     22 → 4 (4) |      20 → 3 (3) |    20 → 3 (3) |
| Modele GLB bloków                             |    419 → 2 (1) |       7 → 2 (2) |    12 → 3 (3) |
| Dekoracje GLB, także bryły latarni            | 1113 → 21 (21) |   379 → 17 (17) | 429 → 17 (17) |
| Napisy i hologramy                            |   27 → 27 (27) |    18 → 18 (18) |  21 → 21 (21) |
| Plamy świateł                                 |   16 → 16 (16) |    10 → 10 (10) |  11 → 11 (11) |
| Stożki latarni (InstancedMesh)                |      1 → 1 (1) |       1 → 1 (1) |     1 → 1 (1) |
| Naklejki                                      |   11 → 11 (11) |       8 → 8 (8) |  10 → 10 (10) |
| Efekty otoczenia                              |      4 → 4 (4) |       4 → 4 (4) |     4 → 4 (4) |
| Pogoda                                        |      3 → 3 (3) |       3 → 3 (3) |     3 → 3 (3) |
| Panorama                                      |      7 → 7 (3) |       7 → 7 (3) |     7 → 7 (3) |

Okna atlasowe nie tworzą osobnych meshy: są częścią shadera fasady. PointLight
także nie jest meshem; pula świateł pozostaje bez zmian. Statyczne naklejki
pozostawiono osobno ze względu na przezroczyste materiały i sortowanie.
Animowane napisy, plamy, stożki, pogoda i efekty zachowują swoich właścicieli
i dotychczasowe aktualizacje. Nie zmieniono `CityDressing` ani loaderów, więc
arena, kryjówka i galeria modeli zachowują dotychczasową strukturę.
Opis własności geometrii, wykluczeń i ograniczeń pomiaru: [render.md](render.md#statyczna-geometria-pokoju-z19).

Samodzielne moduły renderu korzystające z `SignDef`, `CityLightDef`, `DecalDef`
i `AmbientFxDef` z `src/world/dressingSchema.ts`. Nie tworzą colliderów, nie
zmieniają symulacji i nie konsumują RNG runu. RoomScene i Arena tworzą je z pól
układu przez `CityDressing` (`src/render/city/dressing.ts`): napisy, światła
(`floorY = playerSpawn.y`), naklejki i efekty otoczenia z danych układu oraz deszcz,
gdy motyw ma `rain.enabled` (parametry z motywu). `step(dt)` zbiera czas świata,
`render(frameDt, camera)` woła `update(dtWorld, dtReal, camera)`; `dispose()` zwalnia
wszystko. Kolejność aktualizacji w klatce: napisy, światła, stożki latarni, naklejki,
efekty otoczenia, głośność audio pogody, deszcz/pogoda. Błysk burzy `Weather.flash`
trafia do `tuning.render.skyFlash` (bez profilu pogody skalowany `tuning.city.stormFlash`
0,35, z profilem 1:1); burza włącza się polem `rain.storm`
motywu (`neonStreet`: tak, średnio jeden błysk na ok. 40 s, `tuning.city.stormRate`);
w `city-fx-test` przełącza ją komenda `storm <0|1>`. Jasność neonów: `tuning.city.signBrightness` (3,2).
Gęstość deszczu jest mnożona przez `quality.rainDensity` (patrz „Mapowanie jakości”).
Deszcz powstaje tylko wtedy, gdy motyw ma `rain.enabled` (parametry `density`, `speed`,
`windX`, `color`, `opacity` biorą się z motywu, nie z `tuning.city.rain*`; wartości
`tuning.city.rain*` są tylko wartościami domyślnymi `Weather`). Tryb `fx=lite` pomija
deszcz i efekty otoczenia.

Wspólny mnożnik zasilania `getPowerLevel()` (`src/render/powerLevel.ts`, 0..1,
domyślnie 1; ustawia go scena, np. spadek napięcia w kryjówce) mnoży jasność
PointLight, plam, napisów, halo, projektorów i stożków latarni razem z migotaniem.
Płomienie i światła kluczowe go ignorują.

## Kontrakt integracji

Każdy moduł udostępnia `root: Group`, `update(dtWorldS, dtRealS, camera)` oraz
idempotentne `dispose()`. Pozycje definicji są współrzędnymi świata; dodaj `root`
do sceny bez dodatkowej transformacji. Wywołuj `update` raz na klatkę renderu.
`dtWorldS` to suma kroków symulacji od poprzedniej klatki (z uwzględnieniem
Skupienia, hitstopu i pauzy), `dtRealS` to czas rzeczywisty klatki. Zaktualizuj
kamerę (pozycja, rotacja i `updateMatrixWorld()`) przed `render`/`update` efektów. Nie przeliczaj czasu świata ponownie przez timeScale.

```ts
const signs = new SignRenderer(
  room.signs ?? [],
  cosmeticSeed,
  undefined,
  room.lights ?? [],
);
const decals = new DecalRenderer(room.decals ?? []);
const lights = new CityLights(room.lights ?? [], floorY, cosmeticSeed);
const rain = new Weather({ density: 0.7 }, floorY, cosmeticSeed);
const ambient = new AmbientFx(room.ambientFx ?? [], floorY, cosmeticSeed);
const effects = [signs, decals, lights, rain, ambient];
for (const effect of effects) three.add(effect.root);
// W renderze, po interpolacji kamery:
for (const effect of effects) effect.update(dtWorldS, dtRealS, camera);
// Przy opuszczaniu pokoju:
for (const effect of effects) effect.dispose();
```

Importy: `src/render/city/{signs,decals,lights,lamps}.ts` i
`src/vfx/{weather,ambientFx}.ts`. Seed jest stringiem lub liczbą. Ten sam seed,
definicje i sekwencja dt dają te same cząsteczki i migotanie. Domyślne seedy są
stałe; integrator powinien podać osobne seedy kosmetyczne pokoju (`CityDressing`
używa `<seed>:signs`, `:lights`, `:ambient`, `:rain`). Nie używamy
`Math.random()` (wyjątek: iskry trafień i statusy w [vfx.md](vfx.md), czysto
kosmetyczne).

## Dane oprawy (kontrakt `src/world/dressingSchema.ts`)

Wszystkie pola są czysto kosmetyczne (brak colliderów, brak wpływu na symulację
i walidację osiągalności). Kolory to `#rrggbb`, id tekstur to `[a-z0-9_]+`
(nazwa pliku `.webp` bez rozszerzenia).

| Pole układu     | Struktura                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `signs[]`       | `kind` (`neon` / `holo`), `texture`, `position`, `size {w, h}` (m), `yaw` (rad; płaszczyzna patrzy w +Z przy 0), opcjonalnie `tint`, `flicker` (liczba 0..1 albo obiekt wzoru) |
| `lights[]`      | `position`, `color`, `intensity` > 0, `range` > 0, opcjonalnie `groundGlow` (false = bez plamy), `flicker` (obiekt), `floorY` (podłoga plamy)                                  |
| `decals[]`      | `texture`, `position`, `size {w, h}`, `yaw`, `surface` (`wall` / `floor`), opcjonalnie `opacity` 0..1                                                                          |
| `ambientFx[]`   | `kind` (`steam` / `sparks` / `drip`), `position`, opcjonalnie `rate` ≥ 0 (emisje na sekundę, dla iskier serie na sekundę; 0 wyłącza)                                           |
| `rainShelters`  | lista AABB `{ position (środek), size (pełne wymiary XYZ) }`                                                                                                                   |
| `decor[]`       | `model` (plik `/assets/models/city/<model>.glb`), `position`, opcjonalnie `yaw`, `scale`; bez kolizji                                                                          |
| `weather`       | id profilu pogody ([weather.md](weather.md))                                                                                                                                   |
| `weatherFloorY` | najniższa podłoga opadu i efektów otoczenia (brak = `playerSpawn.y`)                                                                                                           |
| `theme`         | id motywu (`white` domyślnie, `neonStreet`, `hideout`)                                                                                                                         |

Plamy świateł: pozycja Y plamy to `def.floorY` albo `floorY` sceny; dla światła
położonego poniżej podłogi startu i bez własnego `floorY` plama leży na
najwyższej nieobróconej bryle układu pod światłem (`lightSpotFloors`).

## Napisy i hologramy

### Wzory migotania

Opcjonalne `flicker` w `lights[]`, `signs[]` oraz `stations[].sign` kryjówki:

```json
{ "pattern": "fail", "strength": 0.8, "periodS": 8 }
```

`pattern`: `buzz` (szybkie, drobne drgania), `fail` (długi stabilny odcinek,
seria 2–5 przygaśnięć, czasem pełne wyłączenie na 0,3 s), `pulse` (sinusoidalne
oddychanie). `strength` jest opcjonalne, 0..1 (0 = stała jasność), domyślnie
`tuning.city.flickerStrength` = 0,8. `periodS` musi być dodatnie; domyślnie
`buzz` = 1/37 s, `fail` = 8 s, `pulse` = 4 s. Dla `fail` okres określa średni
odstęp serii z rozrzutem; bardzo krótkie okresy skracają całą serię, zachowując
stabilną część. Dla `buzz` okres określa krok zmian jasności. Parametry wzorów
są w `tuning.city.flicker*`, także w lil-gui. Starsze liczbowe `signs[].flicker`
0..1 nadal działa według poprzedniego algorytmu.

Mnożnik to czysta funkcja czasu renderu `t`, ziarna źródła i wzoru (bez stanu;
ziarno źródła = fork RNG po indeksie definicji). Z `d = strength` (0 → zawsze 1):

- `pulse`: `1 − d * (0,5 − 0,5 cos((t / period + n0) * 2π))`, `period` = `periodS` albo
  `flickerPulsePeriodS` 4 s, `n0` = stały szum ziarna 0..1 (faza).
- `buzz`: `1 − d * flickerBuzzDepth * szum(ziarno, floor(t / period))`, `flickerBuzzDepth` 0,12,
  `period` = `flickerBuzzPeriodS` 1/37 s; szum 0..1 to hasz bitowy (mieszanie
  w stylu mulberry32: `(seed + imul(index, 0x6d2b79f5))`, dwa kroki xorshift/imul).
- `fail`: czas przesunięty o `n0 * period`; w każdym cyklu długości `period`
  seria zaczyna się w `period * (0,5 + (szum − 0,5) * flickerFailJitter)` (jitter 0,25),
  ma `flickerFailMinDips` 2 … `flickerFailMaxDips` 5 (losowo, całkowite) przygaśnięć:
  przygaśnięcie trwa `flickerFailDipS` 0,055 s (jasność `1 − d`), przerwa
  `flickerFailGapS` 0,065 s. Po serii z szansą `flickerFailDarkChance` 0,3 następuje
  pełne wyłączenie (mnożnik 0) na `flickerFailDarkS` 0,3 s; poza tym 1. Czas serii
  jest skalowany w dół (`min(1, period * (0,5 − jitter/2) / (dips * (dip + gap) + dark))`),
  by zmieścić się w cyklu.

Starszy algorytm (liczbowe `flicker` `f`, tylko gdy „błyski” włączone): co
`signOutageS` (0,09 s) losowanie wyłączenia z szansą `1 − exp(−f * signOutageRate (1,4) * signOutageS)`;
wyłączenie trwa `signOutageS * (0,3..1)` i obniża jasność do `signOutageBrightness`
0,04. Poza tym brzęczenie `1 + sin(t * signBuzzHz (37) * 2π) * f * signBuzzAmount (0,08)`.
Równolegle losowane jest „częściowe wygaszenie komórek”: szansa
`1 − exp(−f * signPartialRate (0,7) * signOutageS)`, czas `signPartialS` 0,18 s
(w tym czasie shader gasi komórki UV 12 × 16 z progiem losowania 0,3, ziarno komórek losowane
na nowo). Czas napisu `time` startuje od losowego 0..10 s (przy wzorze obiektowym od 0).

Mnożnik 0..1 dotyczy jasności PointLight, plamy na podłodze, emisji napisu,
halo i projektora. Wybór świateł do ograniczonej puli nadal używa jasności
bazowej, więc przygasanie nie zmienia priorytetów. Źródło spoza puli nie dostaje
dodatkowego PointLight; po powrocie używa aktualnego czasu i własnego ziarna.
Napisy mają niezależne materiały (również napisy stacji).
Wyłączenie „Błyski ekranu” (`Settings.flashes`) od następnej klatki wyłącza
`buzz`, `fail` i starsze migotanie; `pulse` pozostaje aktywne.

Podgląd w 30 s: `?scene=city-fx-test&seed=migotanie`. Od wejścia kolory lamp
i odpowiadających im neonów: bursztyn = `buzz`, zieleń = `fail`, fiolet = `pulse`,
potem wzory się powtarzają. Poczekaj 10–20 s na serię zielonej lampy; podejdź
WASD, by sprawdzić zmiany przydziału puli. Porównaj po wyłączeniu błysków
w ustawieniach. Testy: `tests/unit/flicker.test.ts`.

`SignRenderer(defs, seed?, textureLoad?, lights?)` ładuje tekstury z
`/assets/textures/signs/<texture>.webp` lub `/assets/textures/holo/<texture>.webp`
(czwarty argument to światła pokoju, z których halo bierze kolor, patrz niżej).
Płaszczyzna patrzy w +Z przy yaw=0. `tint` (domyślnie `#fff1d6`) mnoży kolor tekstury. Czarne tło jest
niewidoczne przy addytywnym mieszaniu; kanał alfa pozostaje respektowany. W shaderze
alfa jest dodatkowo skalowana luminancją (rgb·a bez zmian), więc czarne tło bez kanału
alfa nie przyciemnia bloomu.
Materiały mają `toneMapped=false`, `depthTest=true`, `depthWrite=false`, `userData.bloom=true`.
Płaszczyzny napisów i halo są jednostronne, odsunięte o `surfaceOffsetM` (0,012 m).

Kontur: pass normalnych/głębi w `outline.ts` używa globalnego `overrideMaterial`, więc
przezroczyste quady dostałyby obrys. Obiekty z `userData.noOutline = true` są na czas
tego passu (normalne, wet normals) ukrywane (`src/render/noOutline.ts`); bloom i
odbicia nadal je widzą. Flagę mają: deszcz, rozbryzgi, para, iskry, kapanie, plamy
światła, naklejki, płaszczyzny napisów i hologramów oraz stożek projektora. Ramy
neonów (pełne bryły) są obrysowane.

Neon ma ciemną ramę/płytę za tekstem: prostopadłościan `#111824` (bez bloomu) o wymiarach
napisu + `signFrameM` (0,09 m) w szerokości i wysokości oraz grubości 0,09 m,
cofnięty tak, że jego przednia ściana leży w płaszczyźnie napisu (środek na z = −0,045 m).
`flicker=0` daje stałą jasność; wyższe wartości
włączają krótkie zaniki, buczenie jasności i częściowe wygaszenie komórek UV.
Kolor piksela napisu: `(próbka koloru z rozdzieleniem kanałów) * tint * jasność * maska * skan`,
alfa = alfa tekstury * zanik * `opacity`; `jasność` = `signBrightness` (3,2) * moc * migotanie.
Hologram (`opacity` `holoOpacity` 0,72) dodatkowo ma linie skanowania
(`0,78 + 0,22 sin((v * holoScanLines (110) − t * holoScanHz (2)) * 2π)`), co
`holoGlitchIntervalS` (3,7 s) przez `holoGlitchS` (0,16 s) przesunięcia poziome pasów
(16 pasów w pionie, przesunięcie UV `(hasz − 0,5) * holoGlitchUv`, czyli ±0,0175,
zmienne 20 razy na sekundę) i rozdzielenie kanałów R/B o `holoGlitchUv` 0,035 w UV, zanik przy dolnej krawędzi
(`smoothstep(0; 0,45; v)`) oraz słaby stożek projektora (otwarty `ConeGeometry`
o promieniu podstawy w/2 i wysokości h, 24 segmenty, dwustronny, addytywny, kolor `tint` albo
`#8a5cff`, krycie `holoProjectorOpacity` 0,06 * jasność, bloom włączony) z
wierzchołkiem na dole, pod napisem (środek stożka w y = −h/2). Animacja napisów i płynność świateł używają `dtRealS`.

Do czasu załadowania obrazu widoczny jest canvas 512 × 256 z identyfikatorem `texture`
(czcionka monospace bold, rozmiar `min(66, 700 / długość id)` px, wyśrodkowany, oraz
podpis „NEORYDER / 24H”):
biały tekst i obramowanie mnożone przez tint materiału. Brak pliku pozostawia
fallback i wywołuje jedno ostrzeżenie na identyfikator w całej sesji. Nie ma
odrzuconej obietnicy ani wyjątku. Przeglądarka może osobno pokazać HTTP 404
dla brakujących zasobów. W środowisku bez DOM używany jest 1×1 DataTexture.
Tekstury są własnością instancji, także fallbacki i odpowiedzi przychodzące
po `dispose()`; nie należy ich współdzielić z innymi właścicielami.

## Naklejki i światła

`DecalRenderer(defs, textureLoad?)` używa `/assets/textures/decals/…`, kanału alfa,
`opacity` (domyślnie 1) oraz odsunięcia wzdłuż normalnej powierzchni o `surfaceOffsetM`
(0,012 m) i polygonOffset (współczynnik −1, jednostki −1). Materiał zwykły (nieoświetlony),
dwustronny, przezroczysty, bez zapisu głębi, mieszanie zwykłe (nie addytywne).
Naklejki mają jawne `userData.bloom=false` i nie mają konturu. Dla podłogi
normalna wskazuje +Y; yaw obraca obraz w jej płaszczyźnie. Naklejki są statyczne.

`wallDecalFitsBlock(decal, block, surfaceToleranceM=0.1)` z
`src/world/dressingSchema.ts` jest czystym, eksportowanym sprawdzeniem nośnika.
Przyjmuje blok AABB `{ position: {x,y,z}, size: {x,y,z} }`, rozpoznaje jego pionową
ścianę po pozycji i normalnej naklejki (`yaw`) i sprawdza szerokość oraz wysokość
całego prostokąta względem jednej ściany. Tolerancja 0,1 m uwzględnia istniejące
odsunięcia danych od płaszczyzny; nie rozszerza granic ściany. Zaokrąglone kąty
np. 1,5708 są obsługiwane, naklejki podłogowe zwracają `false`.
Bez dodawania pól lub ograniczeń do schematu; można użyć tej samej funkcji dla
bloków kryjówki. `tests/unit/cityDecalBounds.test.ts` sprawdza wszystkie JSON-y
pokoi i wymaga, by każda naklejka ścienna mieściła się na co najmniej jednym bloku.

`CityLights(defs, floorY=0, seed?)` (`floorY` to liczba albo tablica podłóg na definicję)
tworzy dokładnie `tuning.city.maxLights` obiektów
PointLight (domyślnie 8; kolor początkowy `#fff1d6`, `distance` = `range` światła,
`decay` = `lightDecay`), również gdy definicji jest mniej. Nie usuwa świateł
ani nie przełącza ich widoczności w trakcie aktualizacji; jedynie sloty powyżej
limitu `min(maxLights, quality.maxLights)` (jakość low 2, medium 4, high 8) są
ukrywane i zerowane. Intensywność 0
zachowuje liczbę świateł w shaderach. Wybór: rosnąca odległość od kamery spośród
świateł, których kula zasięgu przecina frustum; remis rozstrzyga indeks definicji.
Światło poza kadrem może zatem nadal oświetlać widoczny fragment ulicy.

Przy zmianie zestawu stare światło wygasa, dopiero przy progu bliskim zeru
(`lightSwitchThreshold` 0,01) zmienia pozycję/kolor i płynnie narasta. Nie interpolujemy położenia światła
przez ulicę. Wygaszanie i narastanie to wykładniczy filtr z czasem rzeczywistym:
`jasność += (cel − jasność) * (1 − exp(−lightFadeRate * dtReal))`, `lightFadeRate` 6.
Cel = `intensity * lightIntensityScale` (2,5); wynik mnożony przez moc zasilania i migotanie
definicji. Każda definicja ma własną addytywną, radialną plamę na `floorY`,
także gdy nie ma przypisanego PointLight (chyba że `groundGlow: false`). Plamy nie uruchamiają bloomu. Mają być delikatną poświatą: bok
kwadratowej plamy to `range * 2 * lightSpotScale` (0,6), czyli promień `0,6 * range`; siła
`lightSpotOpacity` (0,12) * moc * migotanie, profil jak niżej. Plama leży na
`floorY + surfaceOffsetM`, jest płaska (obrócona o −90° wokół X), z testem głębi.
To stylizowana poświata na mokrej nawierzchni, bez odbicia geometrii ani SSR.

### Ocena świateł (poprawka oświetlenia)

- **Wybór do puli 8 świateł:** nadal frustum + odległość od kamery, ale odległość² jest dzielona przez `(intensity*range/40)^lightImportance` (jasne, dalekie źródła wygrywają z bliskimi słabymi), a światła już przydzielone dostają premię `lightKeepBonus` (histereza: bez przełączania przy remisie). `lightImportance=0` przywraca czystą odległość (`lightScore`, `selectCityLights(..., priority)`). Wygaszanie przed przestawieniem bez zmian.
- **Siła i spadek:** intensywność każdego światła mnożona przez `lightIntensityScale`, wykładnik spadku `lightDecay` (mniejszy = łagodniej). Neony i hologramy oświetlają więc kolorem ściany i mokrą nawierzchnię bez twardej granicy.
- **Plamy pod światłem:** profil `(1 - smoothstep(0,1,r))^lightSpotPower` (miękki środek i brzeg), siła `lightSpotOpacity`.
- **Poświata napisów:** każdy neon i hologram ma addytywny, miękki halo-quad w płaszczyźnie napisu (rozmiar `min(signGlowScale, signGlowMaxScale)` × rozmiar napisu, domyślnie maks. 1,6× zamiast 2,3×; siła `signGlowOpacity`, hologramy × `signGlowHoloFactor`). Definicja napisu nie zawiera wymiarów nośnika, dlatego stosowany jest ten limit oraz dodatkowe wygaszenie do zera na całym obwodzie (`signGlowEdgeFade`, pas UV 0,2). Kolor: `tint` napisu, w razie braku kolor najbliższego światła w `signGlowLightRangeM` (`signGlowColor`), w ostateczności ciepła biel. Jasność podąża za migotaniem napisu (zaniki i buczenie zostają): alfa halo = `signGlowOpacity` (0,45) * (1 dla neonu, `signGlowHoloFactor` 0,5 dla hologramu) * `min(1,25; moc * migotanie)`; profil `(1 − smoothstep(0,1,r))^signGlowPower` (2,2), r = odległość od środka quada w jednostkach połowy boku. Halo leży w płaszczyźnie napisu przesunięte o `surfaceOffsetM`. Bez bloomu, bez konturu.
- **Latarnie** (`src/render/city/lamps.ts`): dla dekoracji `city_street_lamp` (z `layout.decor`, przekazywanych przez `CityDressing`) powstaje światło punktowe (`lampLightIntensity` 4, `lampLightRange` 7, `lampColor` `#fff1d6`, bez migotania) dołączone do puli (po światłach z układu) i plama pod lampą (podłoga = wysokość dekoracji) oraz subtelny stożek: jeden `InstancedMesh`, addytywny, bez cieni, gaśnie ku ziemi i na brzegach sylwetki (`lampCone*`). Położenie głowicy: `lampHeadHeightM` 4,31 m nad pozycją dekoracji, `lampHeadForwardM` 0,34 m w kierunku yaw (obie × skala dekoracji; yaw obraca przesunięcie: x += sin(yaw), z += cos(yaw)). Światło punktowe leży 0,25 m poniżej głowicy. Stożek: otwarty stożek (28 segmentów, dwustronny) o wierzchołku w głowicy, rozwarty ku dołowi na wysokość od głowicy do podstawy słupa (min. 0,1 m), połowa kąta `lampConeAngleDeg` 32°; alfa = `lampConeOpacity` (0,2) * moc * `(1 − odległość_od_głowicy/wysokość)^lampConePower` (1,6) * `|cos(kąt normalnej do kamery)|^lampConeEdgePower` (1,4).
- **Zasłanianie poświat:** napisy, halo, plamy, stożki i addytywne cząsteczki mają jawne `depthTest=true`, `depthWrite=false` i `renderOrder=glowRenderOrder` (1), po geometrii nieprzezroczystej. Halo nie używa polygonOffset; odsunięcie nie przekracza `surfaceOffsetM`. Jednostronne są quady oraz billboardy cząsteczek; otwarte stożki pozostają dwustronne, bo kamera może wejść do środka.
- **Maska bloomu i odbić:** `BloomPass` renderuje geometrię z własnym buforem głębi i zachowuje test głębi materiałów emisyjnych. Nieemisyjne halo/plamy/stożki lamp są ukrywane w obu maskach. Zasłony zapisują teraz także zerowe RGBA (`NoBlending`, opacity 0, bez mgły), usuwając kolor źródła narysowanego wcześniej; samo `colorWrite=false` zostawiało daleką emisję pod bliższą ścianą/filarem. `NoBlending` zapobiega wymuszeniu alfy 1 przez wariant `OPAQUE` Three.js. Wyłączony test głębi w pełnoekranowych przebiegach rozmycia dotyczy wyłącznie gotowej tekstury, nie geometrii sceny. Testy: `tests/unit/cityGlowOcclusion.test.ts`; wizualną ocenę rozmycia i GLSL wykonuje się w przeglądarce.

### Okna budynków (atlasy)

- Okna fasad (materiał `facade`: budynki wokół pokoi i panorama w tle) pochodzą z atlasów `atlas/windows_lit.webp` i `atlas/windows_dark.webp` (siatka 4×4, komórki 256 px). Shader (`src/render/urbanMaterials.ts`, `windowCode`) wybiera okno deterministycznie z indeksu okna na ścianie (rzut świata, bez migotania między wczytaniami); wersja referencyjna w TS: `src/render/city/windowAtlas.ts` (`windowChoice`, `windowCellUv`, testy `tests/unit/windowAtlas.test.ts`).
- Siatka okien: rozstaw `windowPitchXM × windowPitchYM` (2,4 × 3,2 m), wymiary okna losowane z `windowMin/MaxWidthM` (1,2–1,6 m) i `windowMin/MaxHeightM` (1,6–2,2 m) — okna pionowe, mniejsze niż dawne płachty.
- `windowLitFraction` (0,4) = udział okien z atlasu oświetlonego, reszta z ciemnego. Emisja: `windowLitEmission` (0,5) i `windowDarkEmission` (0,02); siła w bloomie `windowBloom` (0,35). Mipmapy próbkowane `textureGrad` po ciągłych UV okna (bez szwów na krawędziach komórek). Do załadowania atlasu okna są wyłączone.
- Algorytm komórki: współrzędne świata ściany (`zy` dla ścian o normalnej bliższej osi X, w przeciwnym razie `xy`) dzielone przez rozstaw dają indeks komórki; `lit` gdy `hasz(komórka) < windowLitFraction`; komórka atlasu 4×4 = `floor(hasz(komórka + (9,1; 23,7)) * 16)`; wymiary okna = `lerp(min, max, hasz(komórka + (17,3; 5,1)))` (szerokość) i `hasz(komórka + (3,7; 41,9))` (wysokość); `hasz(x,y) = fract(sin(x * 127,1 + y * 311,7) * 43758,5453)`. Okno rysowane tylko na ścianach (normalna Y < 0,5), wycentrowane w komórce. Kolor: `mix(kolorŚciany, tekstura * 0,3, maska)`, górne 6% wysokości każdej komórki (pas stropu) przyciemnione o 35%, emisja = `tekstura * mix(windowDarkEmission, windowLitEmission, lit) * maska`, wszystko × `citySurfaceDetail` motywu (0 w `white` = bez okien). Materiał masek bloomu fasady: kolor = `tekstura * windowBloom`, alfa = `0,18 * maska * lit`, tylko okna oświetlone.
- Bez nowych świateł; ten sam materiał i atlas w panoramie (dalekie okna uśredniają się mipmapami). Wolne gaśnięcie/zapalanie okien nie zostało wdrożone.

## Panorama miasta i niebo

Motywy z `panoramaEnabled` (`neonStreet`) dostają tło z `src/render/panorama.ts`:
deterministyczny układ z `src/render/skyline.ts` (osobny strumień RNG, brak ciał i świateł
punktowych) i nieoświetlone shadery z `src/render/skyMaterials.ts`. Razem 7 meshy:

- **Wieżowce** — jeden `InstancedMesh` (kilkaset brył, zależnie od gęstości; bryła =
  sześcian 1×1×1 skalowany do `width × height × depth`, `yaw` obraca lokalne +Z ku środkowi pokoju): 4 pierścienie
  (r ≈ 66/92/124/162 m, każdy budynek z rozrzutem promienia ±4/6/7/8 m),
  szerokość 7–13 / 9–16 / 10–19 / 12–24 m, wysokość = `panoramaHeight` (32 m) × (0,55–0,95 /
  0,85–1,35 / 1,15–1,8 / 1,4–2,2) × (0,55–1,1), wieże (13% szans) × (1,35–1,7), głębokość 0,7–1,1
  szerokości, jasność ściany (`tone`) 0,62 / 0,5 / 0,4 / 0,32 ±15% mnoży kolor ściany; nieregularne
  przerwy (`0,25 + (1 − panoramaDensity) * 1,6` szerokości budynku w kroku kąta, 7% szans na dodatkowy
  odstęp 1–2,5 kroku), uskoki (42% szans: nadbudowa 0,5–0,78 szerokości, wysokość 10–28% budynku,
  ten sam obrys środka), podstawy 24 m pod ulicą (`floorY − 24`), wszystko liczone
  deterministycznie z seeda (`seed` oprawy pokoju, osobny strumień `skyline`).
  Okna w shaderze: siatka 2,6 × 3,4 m (okno zajmuje 0,3–0,7 × 0,3–0,72 komórki, bez rzędu przyziemnego i
  bez górnych 2,6 m), rytm pięter (18% pięter całkiem zgaszonych) i ciągów 2–5 okien (oświetlone
  gdy `hasz < lit` budynku, `lit` 0,18–0,45), daleko
  uśrednione pokrycie zamiast migotania (`smoothstep(0,35; 0,9; pochodna ekranowa)`); kolor okna z palety:
  ciepła biel 62%, bursztyn 26%, błękit 7%, fiolet 5% (wybór na budynek), pojedyncze okna (7%) bursztynowe
  lub błękitne, jasność okna × (0,4 + 0,6 hasz); wybrane wieże (35% wież, 6% reszty; kolor z palety) z
  neonowym wieńcem pod dachem (pas 1,2–1,9 m od góry) i podświetlonymi krawędziami narożników; kolor
  ściany = `panoramaWall` × `tone` × ściana (przód 1, boki 0,72, dach 0,45) + poświata od dołu
  bursztyn `0,06 * exp(−wysokość/22 m)` + pasy stropów (−18% co rząd); zgaszone okna = prawie czarne
  `(0,006; 0,008; 0,014)`; światło okien × `panoramaWindowEmission` (0,5). Głębię daje mgła
  kompozycji. Do maski bloomu idzie osobny
  materiał (`userData.bloomMaterial`) z samym światłem okien i wieńcami.
- **Punkty orientacyjne** — 3 smukłe wieże z trzema stopniami (szerokość × 1 / 0,72 / 0,45, wysokość 72% / 18% / 10%
  całości) i masztem (szerokość 0,9 m; 42% wysokości dla głównej, 30% dla pozostałych) o wysokościach 3,3 / 2,7 / 2,4 ×
  `panoramaHeight` i szerokości 15 / 13 / 12 m, promienie 108 / 132 / 118 m, kąty (od +Z, rad) π+0,3 (główna, bliska
  −Z, widoczna ze spawnu większości pokojów), 0,55 i π/2+0,2; zwykłe budynki nie stoją w ich sąsiedztwie) i **bursztynowe** światła ostrzegawcze (szczyt i połowa masztu, 4 narożniki każdego stopnia, część
  dachów warstw 0–2: 22% budynków bez uskoku i 50% nadbudów): addytywne billboardy z minimalnym rozmiarem
  kątowym 0,032 rad; błysk `0,45 + 0,55 * impuls`, impuls = wejście 0–0,04 okresu i zejście 0,12–0,34 okresu (okres
  1,4 s na maszcie, 2,2 s na narożnikach, 1,6–3 s na dachach); rdzeń `smoothstep(0,1; 0,22; r)` jasny × 2,5 (mieszany 30% do
  ciepłej bieli), halo `(1 − r)^3 * 0,6`, całość × `panoramaBeaconBrightness` (1). Billboard jest przesunięty o 0,6 rozmiaru ku kamerze.
- **Hologramy reklam** — 3 panele w górnej części fasad (pas znaków, baner, znak), kolory tylko
  z palety otoczenia (fiolet, bursztyn, zieleń), położone na najwyższych (kątowo) budynkach warstw 1–2
  w sektorach kąta π−0,45, π+0,75 i π/2−0,2 (3 m poniżej dachu; gdy sektor pusty, wolny panel 10 × 4,5/12 m na promieniu
  90 m); shader addytywny z siatką znaków 3×3 zmieniającą się co 4 s, ramką, migotaniem
  `0,85 + 0,15 * skok` (zmiana 9 razy na sekundę), liniami skanowania i rzadkim zanikiem panelu (−70% w 1,5% sekund, próbkowane 3 razy na sekundę);
  kolor ×1,4 z palety.
- **Pojazdy** — `round(panoramaTraffic * 16)` torów (domyślnie 10 przy 0,6); każdy tor to para świateł (ciepła biel z przodu
  w kierunku ruchu, bursztyn z tyłu, odstęp 1,4 m) na okręgu o promieniu 74–140 m, wysokości `floorY + 22…58` m,
  prędkości kątowej 0,12–0,26 rad/s (losowy znak), z kołysaniem pionowym ±0,8 m; pojazd pojawia
  się i znika (`smoothstep` 0–0,08 oraz zanik 0,55–0,65 cyklu `fract((prędkość * t + faza) * 0,35)`); billboard 0,55 m
  (minimalny rozmiar kątowy 0,02 rad), rdzeń × 1,8 + halo 0,4. Ruch liczony w shaderze wierzchołków (zero pracy CPU).
- **Niebo** — kopuła (podgrupa `city-sky`, kula 32×16 skalowana promieniem kopuły, `renderOrder` −10, bez zapisu głębi,
  przesuwana za kamerą i rysowana na samej płaszczyźnie dalekiej): łuna miasta tuż nad horyzontem (bursztyn `#ffae1a`
  → fiolet `#8a5cff`, nierówna w azymucie: mnożnik `0,6 + 0,4 (0,5 + 0,5 sin(2 az + 2,6)) (0,6 + 0,4 sin(5 az − 0,7))`;
  `exp(−7 y)` z wygaszeniem poniżej horyzontu, mieszanie `exp(−16 y)` między 0,05 × fiolet a 0,085 × bursztyn)
  i pokład chmur/smogu (rzut płaski `xz / (y + 0,22) * 1,1`, szum fbm 5 oktaw, dryf `skyCloudSpeed` 0,004 × 6 jedn./s,
  próg `smoothstep(0,42; 0,72; …)`, spód oświetlony od dołu: ciepło przy horyzoncie, fiolet wyżej, przy samym horyzoncie
  wygaszany `smoothstep(0,01; 0,12; y)`), dryfujący w czasie; siła `skyGlowStrength` / `skyCloudStrength` (1 / 1).
  Mieszanie addytywne (to źródła światła).

Kopuła, panorama i zasięg kamery podążają za obwiednią areny (patrz „Horyzont dużych aren”).

Wszystko, co nie zapisuje głębi, jest addytywne z `premultipliedAlpha` i alfą równą
luminancji (inaczej poświata bloomu „over” zastępowała ostry punkt rozmytą wersją).
Strojenie: `tuning.render.panoramaDensity/panoramaHeight` (motyw: 0,65 / 32) oraz
`tuning.city.panoramaTraffic` 0,6, `panoramaWindowEmission` 0,5, `panoramaBeaconBrightness` 1,
`panoramaWall` `#1e2638`, `skyGlowStrength` 1, `skyCloudStrength` 1, `skyCloudSpeed` 0,004.
Panorama jest tworzona, gdy `tuning.render.panoramaEnabled > 0` (motyw), ukrywana przy 0, a
układ przebudowywany przy zmianie gęstości, wysokości, ruchu, pierścieni, punktów
orientacyjnych, torów i reklam. `panoramaExclusion` (AABB świata) usuwa budynki, których
obwiednia go przecina. Motywowe `panoramaWindowWarm`/`panoramaWindowCool` ustawiają uniformy
`windowWarm`/`windowCool` materiałów miejskich, ale żaden shader ich nie czyta. Testy:
`tests/unit/skyline.test.ts`.

### Horyzont dużych aren

`SceneAtmosphere` (`src/render/sceneAtmosphere.ts`) łączy motyw, tło i panoramę dla
sceny. Obwiednia areny (`worldEnvelope`: AABB wszystkich bloków z obrotami plus punkt
startu) daje środek, promień `radiusM = hypot(szerokość, głębokość)/2` i wysokość.
Horyzont jest „rozszerzony” (`expanded`), gdy `radiusM` lub wysokość > `legacyRadiusM`
(50 m); wtedy (`tuning.horizon`):

- pierścienie panoramy, punkty orientacyjne, tory pojazdów i wolne reklamy przesuwają się
  o `ringOffsetM = max(0, radiusM + ringClearanceM (20) − firstRingM (66))`;
- kopuła nieba ma promień `hypot(czwarty pierścień + domeClearanceM (40), wysokość) + radiusM`
  (bez rozszerzenia `legacyDomeM` 100 m), panorama jest wyśrodkowana na obwiedni;
- `far` kamery = `max(legacyFarM 220, kopuła + clipClearanceM 32)`, `near` =
  `max(legacyNearM 0,1; far / nearRatio 2200)` (bez rozszerzenia 0,1 / 220); mgła skalowana
  o `min(far / 220, (far − 32) / fogFar)`, gdy rozszerzona;
- pod areną leży płaszczyzna „outer-ground” (kolor `groundColor` `#151923`, bok
  `2 * (far + radiusM)`, na `min Y obwiedni − groundOffsetM 0,12`), tło sceny ma kolor mgły
  motywu (poza rozszerzeniem `tuning.render.world`); opcjonalna płaszczyzna wody
  (`{ shoreZ, y, color }`) rozciąga się od linii brzegu na południe o `far + radiusM`;
- `scene.userData.reflectionFloorY` = podłoga pokoju (płaszczyzna odbić).

Pozostałe klucze `tuning.horizon`: `firstRingM` 66, `secondRingM` 92, `thirdRingM` 124,
`fourthRingM` 162, `firstLandmarkM` 108, `secondLandmarkM` 132, `thirdLandmarkM` 118,
`trafficMinM` 74, `trafficMaxM` 140, `freestandingAdM` 90, `flySpeedMps` 55
(prędkość kamery swobodnej w scenach testowych).

### „Żywe miasto” dla wysoko położonych map (`panoramaDropM`)

Gdy pokój podaje `panoramaDropM >= tuning.horizon.elevated.minDropM` (domyślnie `100` m, np. `180` m dla 60. piętra biurowca Kurogane Arms), `SceneAtmosphere`, `Panorama`, `buildSkyline` i `skyMaterials` przechodzą w tryb wysoko położonego miasta (wszystkie dotychczasowe mapy bez wysokiego `panoramaDropM` pozostają bez zmian):

- **`outer-ground` i zasięg kamery (`SceneAtmosphere`):** dla map z `panoramaDropM >= minDropM` płaszczyzna gruntu powstaje na dnie kanionu (`min Y obwiedni − panoramaDropM − groundOffsetM`), a płaszczyzna `far` kamery i kopuła nieba rozszerzają się tak, aby objąć pełną przekątną 3D aż do dna kanionu i koron sąsiednich wieżowców (również gdy rzut poziomy mapy ma `radiusM <= 50 m`).
- **Bliskie cyber-wieżowce sąsiednie (`buildSkyline`, strumień `skyline-elevated`):** `towerCount` (8) megastruktur na promieniach `towerNearM..towerFarM` (`56..115` m, z gwarancją odsunięcia od `facadeBounds` o `towerClearanceM` 18 m), o szerokości `18..26` m i koronach `crownMinY..crownMaxY` (`+25..+90` m względem podłogi mapy), z uskokami (`setbackHeightM` 10 m, `setbackScale` 0,66), neonowymi wieńcami i podświetlonymi narożnikami (`layer: 4`), masztami (`mastHeightM` 8 m, `mastWidthM` 1 m) oraz migającymi światłami ostrzegawczymi **wyłącznie** w barwach bursztynu (`#ffae1a`) i ciepłej bieli (`#fff1d6`) — **zero czerwieni**.
- **6 animowanych billboardów (`skyline-ad`):** `adCount` (6) paneli na fasadach bliskich wieżowców na wysokości pięter gry (`adMinY..adMaxY`: `−15..+24` m, odsunięcie `adOffsetM` 0,6 m).
- **3 pułapy latających pojazdów (`InstancedMesh`, 1 draw call na pulę):**
  1. **Dno kanionu** (`skyline-traffic`, `tier: 'canyon'`): `floorY + canyonTrafficMinY..canyonTrafficMaxY` (`+25..+95` m od dna kanionu).
  2. **Wysokość pięter gry** (`skyline-traffic`, `tier: 'window'`): do `windowTrafficMax` (14) torów w promieniu `windowTrafficNearM..windowTrafficFarM` (`62..135` m) na wysokości `windowTrafficMinY..windowTrafficMaxY` (`−12..+26` m).
  3. **2 tory bliskiego przelotu za szybą** (`skyline-flyby`, 1 `InstancedMesh`): wzdłuż fasady północnej (`flybyNorthY` `+3,2` m) i zachodniej (`flybyWestY` `+9` m) w odległości `flybyClearanceM` (`12` m, zakres 9–15 m), co `flybyPeriodS` (`11` s) przy prędkości `flybySpeedMps` (`40` m/s), długości smugi `flybyLengthM` (`9` m) i wysokości `flybyHeightM` (`1,4` m); przednie światło `#fff1d6`, tylne światło i smuga `#ffae1a`.
- **Animacja okien i perspektywa powietrzna (`skyMaterials.ts`):** w `computeWindows()` wybrane deterministycznym haszem ciągi okienne (`windowAnimatedShare` 0,28) powoli zapalają się i gasną (`windowCycleHz` 0,18 Hz, płynne przejście `windowFadeShare` 0,22), a `buildingFragment` dokłada perspektywę powietrzną (`hazeNearM..hazeFarM` `90..220` m) oraz łunę głębokiego kanionu poniżej `canyonGlowDepthM` (`40` m, siła `canyonGlowStrength` 0,045) bez użycia globalnej mgły we wnętrzu.

Podgląd w 30 s: `?scene=horizonTest&profile=kuroganeOfficeTower&debug=1` (lub przycisk „Wieżowiec 60p (drop 180 m)” w pasku `?scene=horizonTest&debug=1`). Testy: `tests/unit/skyline.test.ts`.

### Gradient nieba w przebiegu koloru

`StylePipeline` (`outline.ts`) na czas przebiegu koloru dodaje do sceny pełnoekranowy quad
`sky-background` (głębia NDC 1, bez zapisu głębi, `renderOrder` najniższy, alfa =
`skyGradient`). Rysuje się tylko tam, gdzie nie ma geometrii nieprzezroczystej, i przed
wszystkimi obiektami przezroczystymi, więc hologramy, deszcz i viewmodel mieszają się z
gradientem, a nie z płaskim kolorem tła. Kompozycja na pikselach nieba (głębia koloru = 1) już
nie podmienia koloru, tylko dodaje błysk burzy; mgła na niebie nadal nie działa. Quad nie
trafia do przebiegów normalnych, bloomu ani odbić. Test: `tests/unit/renderOutline.test.ts`.

## Deszcz i efekty otoczenia

`Weather(params?, floorY=0, seed?, shelters?)` ma publiczne, mutowalne `params: RainParams`:
`enabled`, `density` (0..1), `speed` (m/s), `windX` (m/s), `color`, `opacity`.
Domyślne wartości pochodzą z `tuning.city` (`rainDensity` 0,7, `rainSpeed` 18,
`rainWindX` −2,2, `rainColor` `#a6a4c4`, `rainOpacity` 0,26); motyw `neonStreet` podaje
własne: gęstość 0,65, prędkość 18, `windX` 1, kolor `#8294b0`, alfa 0,26, `storm` true.
Deszcz to stała pula 4000 instancji;
gęstość zmienia tylko liczbę rysowanych instancji. Objętość 28×14×28 m podąża
za kamerą; modulo zawija pozycje również po teleportacji i dużym dt. Smugi
mają kierunek wiatru i długość zależną od szybkości oraz `rainExposureS`
(0,025 s; długość = `|(windX, speed)| * rainExposureS`, szerokość `rainStreakWidthM` 0,013 m).
Poniżej `floorY` są ukryte. Przecięcie podłogi emituje pierścień i kroplę,
łącznie do 300 instancji w dwóch stałych pulach (po 150). Emisja ma osobny limit na sekundę
(`rainSplashRate` 100/s * gęstość). Pełny opis geometrii, mieszania i rozbryzgów (te same
reguły co dla profili pogody): [weather.md](weather.md).

`stormEnabled=false` domyślnie; po włączeniu rzadki błysk ustawia publiczne
`flash` w zakresie 0..1 (1 w starej ścieżce; z profilem do `lightning.brightness`,
storm 1,4). Kompozycję błysku podpina integrator. Ruch deszczu,
rozbryzgi i błysk używają czasu świata.

`AmbientFx(defs, floorY=0, seed?)` ma osobne pule: para (`steamMax`) 100, iskry (`sparkMax`) 180,
krople (`dripMax`) 100 i rozbryzgi (`dripSplashMax`) 80. Wszystkie cząstki to billboardy zwrócone
ku kamerze, addytywne, z testem głębi, bez zapisu głębi i konturu; kolor instancji mnożony przez zanik.
Para to miękkie billboardy (`steamColor` `#8b91ae`, alfa `steamOpacity` 0,17, rozmiar
`steamSizeM` 0,55 m mnożony przez `1 + steamGrowth * wiek/życie` (`steamGrowth` 2,8, czyli do 3,8×), życie `steamLifeS` 3,8 s,
unoszenie `steamRiseMS` 0,65 m/s, rozrzut startu ±`steamSpreadM` 0,2 m w X i Z, dryf w X
±`steamDriftMS` 0,15 m/s; jasność `sin(π * wiek/życie)`; profil
`pow(1 − r², 3) * (0,8 + 0,2 sin(24 u + sin(18 v)))`), które unoszą się, rosną i gasną.
Iskry są emitowane seriami (`sparkBurstCount` 12 iskier na serię; odstęp kolejnej serii
`(0,5..1,5) / rate`, `rate` domyślnie `sparkBurstRate` 0,45), kolor bursztyn `#ffae1a`,
prędkość startowa losowa (X, Z ±`sparkSpeedMS` 3,5; Y 0,2–1 × 3,5 m/s), życie `sparkLifeS` 1,1 s,
rozmiar `sparkSizeM` 0,035 m (wysokość × 2), grawitacja `sparkGravity` −9, odbicie od podłogi z
mnożnikiem `sparkBounce` 0,35, zanik liniowy; tylko ich materiał ma flagę bloom. Krople
(kolor `#c8c5d9`, rozmiar `dripSizeM` 0,025 m, wysokość × 4, prędkość startowa `−dripSpeedMS` 3 m/s,
życie `dripLifeS` 8 s, `rate` domyślnie `dripRate` 2, grawitacja jak iskry) spadają i tworzą
pierścień przy podłodze (jak rozbryzg deszczu). `rate` oznacza emisje/s, dla `sparks` serie/s;
0 wyłącza emiter; pierwsza emisja każdego emitera po losowym opóźnieniu 0..1 s.
Efekty używają czasu świata i stałych pul z zastępowaniem starszych cząsteczek.
Nie ma kolizji z dachami i przeszkodami: integrator wybiera miejsca emisji,
obszar deszczu oraz wysokość płaskiej podłogi.

### Strefy bez deszczu (Z21)

Opcjonalne `rainShelters: [{ position, size }]` w danych oprawy to AABB:
`position` oznacza środek świata, `size` pełne dodatnie wymiary XYZ.
Granice należą do strefy. CityDressing przekazuje definicje jako czwarty
argument `Weather(params, floorY, seed, shelters?)`. Brak pola zachowuje
dotychczasowy deszcz. Strefy są kosmetyczne i nie tworzą colliderów.

Ruch i zawijanie kropli liczy shader wierzchołków (`Weather`, [weather.md](weather.md#ruch-w-shaderze)).
Przecięcie strefy przez obwiednię smugi zdegeneruje quad (strefy są teksturą RGBA32F
`rainShelters`); `Weather.dropMatrix` to referencja CPU tego testu.
`isRainSheltered(point, shelters, halfSize?)` to czyste sprawdzenie bez alokacji:
opcjonalne półwymiary rozszerzają test o obwiednię całej smugi. Dzięki temu
koniec smugi nie wystaje pod strop, gdy środek kropli jest jeszcze nad nim.
Przecięcie podłogi w strefie nie emituje rozbryzgów; jawne emitery kapania
(`ambientFx: drip`) nadal działają. Deszcz nad stropem i poza obrysem dachu
pozostaje widoczny. Pauza (dt = 0) zatrzymuje ruch: nie zmienia się żaden uniform ruchu.

Strefy od podłogi do spodu stropu. Pierwotne dwa pokoje:

| Pokój                 | Środek       | Pełne wymiary   |
| --------------------- | ------------ | --------------- |
| `combatFloodedTunnel` | (0; 2; 0)    | 12 × 4 × 24 m   |
| `alleyUnderpass`      | (0; 3,25; 0) | 16 × 6,5 × 22 m |

Dane stref mają obecnie także `alleyUnderpassMission` (jak `alleyUnderpass`), `restRoom`
((0; 1,7; −0,5), 10 × 3,4 × 8 m) oraz areny (liczba stref): `arenaConstructionSite` 2,
`arenaContainerPort` 6, `arenaFloodedDocks` 39, `arenaOverpass` 27, `arenaPowerPlant` 8,
`arenaRailYard` 17, `arenaRooftops` 61 (bryły kamienic; razem z `weatherFloorY` −14).
Pełne listy: pole `rainShelters` w `src/data/rooms/<id>.json`.

Testy `rainShelters.test.ts`: schemat, granice, dane stropów, referencyjne
macierze kropli (`dropMatrix`), rozbryzgi, pauza i przekazanie przez
CityDressing. Ocena architekta w `?scene=room-test&room=<id>` powinna
uwzględnić krawędzie stropu przy wietrze: ukrywana jest cała smuga,
której obwiednia przecina strefę. Może to dawać wąski pas bez smug tuż
poza dachem; shader nie przycina części smugi na samej granicy.

## Strojenie i zasoby

Wszystkie parametry animacji oraz limity są w `tuning.city`, automatycznie
widoczne w lil-gui. Limity ustalają rozmiar buforów przy konstrukcji; aby je
zwiększyć, odtwórz moduł. Obniżenie `maxLights` ogranicza wybór w istniejącej
puli, jej rozmiar pozostaje stały. Parametry wymiarów i czasów powinny być
dodatnie, limity całkowite dodatnie, gęstość/opacity w 0..1.
Zmiana `RainParams` działa od następnej klatki. Scena testowa na bieżąco
kopiuje speed/windX/color/opacity z GUI do `RainParams`.

Każda instancja zwalnia geometrie, materiały, tekstury i bufory InstancedMesh.
Nie ma globalnego cache GPU. `dispose()` odłącza root, czyści pule i ignoruje
dalsze aktualizacje. Wspólna geometria plam światła jest zwalniana raz.

Kolory otoczenia: bursztyn `#ffae1a`, zieleń `#6dff4a`, fiolet `#8a5cff`, błękit
królewski `#3d7bff`, ciepła biel `#fff1d6`. Dodatkowo chłodne, słabo nasycone
barwy deszczu (`#8294b0` w motywie i profilach, `#a6a4c4` domyślna), pary (`#8b91ae`),
kropli (`#c8c5d9`), betonu i pyłu (`#8991a0`), a także bursztynowe iskry (`#ffae1a`).
Barwy gracza (cyan `#00e5ff`), Rezonansu (magenta `#ff2bd6`) i wrogów (czerwień
`#e0262b`, `#ff5050`) nie są używane w otoczeniu; panorama i oprawa pokoju wybierają
kolory wyłącznie z palety pięciu neonów (indeksy 0 bursztyn, 1 ciepła biel, 2 błękit,
3 fiolet, 4 zieleń).

## Motywy (dane `src/data/themes/<id>.json`)

Pokój wybiera motyw polem `theme` (brak = `white`; parametr URL `?theme=<id>` ma
pierwszeństwo; nieznany id → ostrzeżenie i `white`). Motyw nakłada całą sekcję `render`
na `tuning.render` (przywracaną przy wyjściu ze sceny), a sekcja `rain` konfiguruje
`Weather`. Schemat: `src/render/themeSchema.ts` (pełna lista kluczy i ich zakresów:
[render.md](render.md)). Trzy motywy:

| Klucz                                                               | `neonStreet` (nocna ulica)                                  | `hideout` (kryjówka)              | `white` (klasyczny)                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| Kolory materiałów (poniżej)                                         | paleta ciemnych błękitów                                    | jak `neonStreet`                  | wszystkie `#ffffff` poza `cable`, `rubber` `#080808` |
| `hemiSky` / `hemiGround` / `keyColor`                               | `#7184b0` / `#2b1f3d` / `#adc3ed`                           | `#6a7898` / `#41385c` / `#d8c6a8` | `#ffffff` ×3                                         |
| `hemiIntensity` / `keyIntensity`                                    | 1,35 / 1,9                                                  | 1,4 / 1,1                         | 0,6 / 2,4                                            |
| `citySurfaceDetail` / `cityBumpStrength`                            | 1 / 1                                                       | 1 / 1                             | 0 / 0 (bez tekstur, okien, reliefu)                  |
| `reflectionStrength` / `reflectionPuddles` / `reflectionDistortion` | 0,95 / 1 / 0,008                                            | 0,6 / 0,45 / 0,008                | 0 / 1 / 0,008                                        |
| `heightFogDensity` / `heightFogFalloff`                             | 0,025 / 0,48                                                | 0,012 / 0,48                      | 0 / 0,6                                              |
| `fogColor` / `fogStrength` / `fogNear` / `fogFar`                   | `#2b1f3d` / 0,72 / 18 / 135                                 | `#241a16` / 0,85 / 6 / 60         | `#eef1f3` / 0,85 / 14 / 80                           |
| `skyTop` / `skyHorizon` / `skyGradientHeight`                       | `#070b16` / `#3a2a2a` / 0,65                                | `#05070d` / `#1c1612` / 0,65      | `#ffffff` / `#e3e7ea` / 0,5                          |
| `world` (kolor tła)                                                 | `#394457`                                                   | `#394457`                         | `#ffffff`                                            |
| `bloom` / `bloomStrength` / `bloomRadius`                           | 1 / 0,65 / 1,2                                              | 1 / 0,8 / 1,4                     | 1 / 0,6 / 1,2                                        |
| `panoramaEnabled` / `panoramaDensity` / `panoramaHeight`            | 1 / 0,65 / 32                                               | 0 / 0,65 / 32                     | 0 / 0,65 / 32                                        |
| `outlineColor` / `outlineThickness`                                 | `#0c1220` / 0,7                                             | `#0c1220` / 0,7                   | `#30343b` / 1                                        |
| `vignetteStrength`                                                  | 0,2                                                         | 0,28                              | 0,2                                                  |
| `interactive`                                                       | `#d9dde3`                                                   | `#d9dde3`                         | `#080808`                                            |
| `rain`                                                              | włączony, 0,65, 18, windX 1, `#8294b0`, 0,26, `storm: true` | wyłączony                         | wyłączony (alfa 0,3, bez `storm`)                    |

Wspólne dla wszystkich trzech: `enemy` `#e0262b`, `enemyGlow` `#ff5050`, `player` `#00e5ff`,
`power` `#ff2bd6`, neony `neon_amber` `#ffae1a`, `neon_green` `#6dff4a`, `neon_violet` `#8a5cff`,
`neon_blue` `#3d7bff`, `neon_white`/`light_white` `#fff1d6`, `enemyRimStrength` 0,85 (w
`white` 0), `enemyRimPower` 2,5, `reflectionFloorTolerance` 0,08, `cityHazardPeriod` 0,3,
`skyGradient` 1, `skyFlash` 0, `vignetteRadius` 0,55, `vignetteSoftness` 0,6,
`damagePulseS` 0,4, `damagePulseMin` 0,35, `damagePulseHpGain` 2, `damageAberration` 0,018,
`damageTint` 0,5 (`damageTintColor` `#ff1a2a`), `focusTint` 0,14 (`focusTintColor` `#ff2bd6`),
`focusDesaturate` 0,3, `focusFadeInS` 0,15, `focusFadeOutS` 0,35, `panoramaWindowWarm`
`#fff1d6`, `panoramaWindowCool` `#3d7bff`.

Paleta materiałów miejskich w `neonStreet` i `hideout` (klucze `render.<rodzaj>`, rodzaj
materiału = klucz `urbanKinds`): `concrete` `#56627a`, `asphalt` `#2a3344`, `metal` `#435169`,
`facade` `#46516a`, `trim` `#8894a8`, `glass` `#18243a`, `cable` `#171d2a`, `paint` `#3e5a48`,
`lacquer` `#2c3766`, `rust` `#a39a90`, `corrugated` `#7a8599`, `plastic` `#4a5d7a`,
`hivis` `#d08a1c`, `rubber` `#3a3d44`, `wood` `#9c8a76`, `fabric` `#5a4c86`,
`machine` `#66718a`, `paving` `#6d7890`, `plaster` `#6a7080`, `hazard` `#e09a1a`.
Wartości kontur/ink/cel/hatch i `outlineFade*` (opcjonalne) opisuje [render.md](render.md).

## Mapowanie jakości

`tuning.quality` (wybór gracza: `low` / `medium` / `high`; domyślnie `high` bez
uruchomienia aplikacji) ogranicza oprawę nakładaną na motyw; wartości dla oprawy miasta:

| Pole               | low  | medium | high               | Działanie w oprawie                                                                                                       |
| ------------------ | ---- | ------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `maxLights`        | 2    | 4      | 8                  | liczba aktywnych PointLight w `CityLights`                                                                                |
| `rainDensity`      | 0,25 | 0,5    | 1                  | mnożnik gęstości opadu (też płatków i budżetu rozbryzgów)                                                                 |
| `particleDensity`  | 0,25 | 0,5    | 1                  | część rysowanych cząstek w każdej partii (para, iskry, krople, rozbryzgi, pył); akumulator, więc rozkład jest równomierny |
| `pixelRatio`       | 0,75 | 1      | 0 (DPR urządzenia) | rozdzielczość renderu                                                                                                     |
| `outline`, `bloom` | 0, 0 | 1, 1   | 1, 1               | kontur i bloom (kompozycja)                                                                                               |
| `bloomResolution`  | 0,5  | 0,5    | 1                  | rozdzielczość bloomu                                                                                                      |
| `reflections`      | 0    | 0      | 1                  | odbicia mokrej nawierzchni                                                                                                |
| `heightFog`        | 0    | 1      | 1                  | mgła wysokościowa                                                                                                         |
| `shadows`          | 0    | 0      | 0                  | cienie wyłączone                                                                                                          |

Tryb `?debug=1&fx=lite` (tylko debug) wymusza jak `low`, z `pixelRatio` 0,25,
`rainDensity` 0 i `particleDensity` 0 oraz wyłącza kosztowne efekty (deszcz, efekty
otoczenia, żar odłamków i błyski, wybuchy, fale Rezonansu, poświatę Chwytu i siatkę
Bariery). Zapis jakości i ustawienia dostępności (`flashes`, `screenShake`) żyją w
`Settings` (`src/core/save.ts`).

## Scena i kontrola ręczna

Otwórz `?scene=city-fx-test&seed=city-review` (opcjonalnie `&debug=1`). Widać
6 neonów, 2 hologramy, 6 świateł, naklejki, deszcz, parę, iskry i kapanie,
jasną skrzynię oraz sylwetki wieżowców z oknami. Proste bryły są lokalnym
stanowiskiem testowym, bez zależności od nowych modeli i motywów.
WASD + mysz: lot, Spacja/Ctrl: pion, Shift: szybciej. Brak kolizji kamery jest
celowy. Tło, gradient horyzontu i mgła są lokalne. Scena czasowo wyłącza globalny
gradient i mgłę kompozycji, a przy dispose przywraca wcześniejsze ustawienia,
tło, mgłę i rejestrację komendy.

- `rain 0`, `rain 1`: porównaj ulicę bez deszczu i z pełną gęstością.
- `timescale 0.15`: deszcz/para/iskry zwalniają; neony i światła nadal animują się.
- Odwróć kamerę i wróć: światła powinny płynnie zmienić zestaw bez skoków koloru.
- Podejdź do napisów: oceń skanowanie, częściowe zaniki i czytelność znaków.
- Oceń, czy efekty nie zasłaniają centralnej osi walki i jasnej skrzyni.
- Sprawdź napisy i lampy zza filara oraz z obu stron ściany: źródło zasłonięte bryłą nie może zostawiać prostokąta w masce bloom ani odbić. Przy krawędzi wąskiego napisu halo powinno miękko zanikać w granicach 1,6×; porównaj też z wyłączonym bloomem i odbiciami.

Testy `tests/unit/cityFx.test.ts`: najbliższe światła/frustum/stała pula,
zawijanie deszczu, gęstość i pauza, deterministyczny seed, limity i kapanie,
fallback canvas, późne ładowanie, naklejki i jednokrotne zwalnianie zasobów.
Ocena wizualna wymaga Chromium/WebGL; testy jednostkowe nie kompilują GLSL.

## Galeria modeli: `?scene=city-props-test`

W pokojach i Arenie modele `city_*` oraz `port_*` zachowują własne materiały również przy ustawionym `material` bloku; materiał bloku nadal dotyczy bryły zastępczej i pozostałych modeli. Oba prefiksy korzystają z cache `cloneCityModel` i katalogu `/assets/models/city/`.

Skala modeli bloków w pokojach (`placeBlockModel` w `src/scenes/roomScene.ts`): proste bryły `pillar`, `cover_low` i `wall_segment` są rozciągane niejednorodnie do `size` bloku (bounding box modelu = kolizja, spód i środek bboxu w spodzie i środku bloku); gdy dłuższy bok podstawy bloku leży w osi Z, osłona obraca się o 90° wokół Y, żeby nie ściskać profilu. Rekwizyty `city_*`, `port_*` i skrzynie zostają w skali 1. `RoomScene` obraca model wraz z colliderem wokół środka bloku. Wymiary modeli miejskich sprawdza `tests/unit/roomBlockModelFit.test.ts` (tolerancja 5%, rozciągliwe: 2%); obwiednie kontenerów w arenie, także po obrocie, sprawdza `arenaStaticBatch.test.ts`. Złożone dekoracje portu mają oddzielne proste collidery w blokach `visible: false`.

Uliczka ok. 10 × 44 m zawiera pierwotne 24 modele `city_*.glb` (bloki i podłoże na chodnikach, modele ścienne na fasadach, rozpięcia w poprzek ulicy). Obok, na osobnym placu 52 × 166 m, stoją modele estakady i targu dachowego: 12 nowych brył oraz fioletowy wariant straganu, razem **37 modeli** w galerii. Rozstaw 24 m i dwie kolumny pozwalają oglądać duże segmenty bez przecinania fasad. Lista modeli w `src/scenes/cityPropsTest.ts`.

Parametry: `prop=<nazwa>` (np. `city_overpass_deck`, kamera 3/4 kadrowana według AABB), `yaw=<stopnie>` (obrót kamery wokół modelu, domyślnie 35), `view=0|1|2|3|4|5|6|7|8|9` (ulica, odwrotnie, z góry, plac portu, zestaw estakady, zestaw targu, zestaw „budowa i elektrownia”, zestaw „port i zajezdnia”: nabrzeże, zajezdnia, zestaw „estakada, dachy, doki”). `prop` ma pierwszeństwo przed `view`; `yaw=145` pozwala ocenić tył modelu. Nowe stanowiska mają własne ustawienie świateł do zbliżeń. Po załadowaniu modeli `document.body.dataset.cityPropsReady = '1'`.

Wymiary, materiały, budżety i punkty montażu: tabela zestawu aren Przejęcia w `docs/assets.md`.

**Plac zestawu „estakada, dachy, doki” (`view=9`).** 22 modele `hw_*`, `roof_*`, `dock_*` dużych aren
(ADR 0011) stoją na osobnym placu zamiast uliczki i portu: trzy pasy podłoża od zachodu — asfalt
(estakada: wieża wentylacyjna, urwany wiadukt, bramka, wiata z dwoma dystrybutorami, kanał burzowy,
obozowisko), papa dachowa (wieża zegarowa, szyld, wyjście z klatki, świetlik, komin) i beton nabrzeża
(przepompownia, śluza, wrak, barka, ponton, pal, łódź). Lista: `OVERPASS_ROOFS_DOCKS_PROP_MODELS`
w `src/scenes/cityPropsTest.ts`. Panorama nie stawia wieżowców w obwiedni placu i korytarza kamery
(`panoramaExclusion` z `SceneAtmosphere`); plac ma własne światła (ciepła biel, zieleń, bursztyn,
fiolet, błękit). `prop=<model zestawu>` (np. `prop=dock_pump_house&yaw=150`) przełącza na ten plac
i ładuje tylko kadrowany model, żeby sąsiednie bryły nie zasłaniały ujęcia. Nowe materiały zestawu
(`gas_station_tiles`, `highway_asphalt_worn`, `flood_brick_algae`, `boardwalk_planks`,
`canal_stone_wall`) są w `urbanKinds` i mają podpięte tekstury z `public/assets/textures/surfaces/`
(wpisy w `arenaMaterials.json` bez `flat`). Wymiary, punkty odniesienia i powierzchnie chodzenia: sekcja „Estakada, dachy, doki”
w `docs/assets.md`. Modele nie dodają aren, pogody ani kolizji; galeria służy do oceny sylwetki, skali i materiałów. Płaskie płyty estakady i kładki oraz komplet 37 plików sprawdza `tests/unit/cityModels.test.ts`.

Plac estakady/targu przeniesiono na zachód: x −73,5…−21,5 m,
z −47…119 m, środek (−47,5; 0; 36). Kolumny modeli stoją przy x = −60
i −35. Poprzedni plac x 16,5…68,5 nachodził na port x 9…44,4, z ±23.
Po przesunięciu obwiednie nie przecinają się. `view=3` nadal pokazuje port,
`view=4` estakadę, `view=5` targ; kadry 4/5 podążają za nowym położeniem.
Parametr `prop` nadal kadruje rzeczywiste AABB modelu.

Zestaw „port i zajezdnia” (24 modele `port_*` i `rail_*`, `PORT_RAIL_PROP_MODELS`, ADR 0011)
stoi na osobnym placu daleko na północy: x −70…80 m, z −440…−260 m (`SET_ORIGIN` = (0; −330)),
czyli poza pierścieniami panoramy (r ≤ ok. 170 m) — wieżowce tła nie przecinają statku ani
suwnicy, a pozostałe widoki go nie widzą (dalej niż płaszczyzna odcięcia 220 m). Południe placu
to keja i ciemna woda: kontenerowiec złożony z rufy, `port_ship_mid` z kontenerami 40 ft na
pokrywach, `port_ship_mid_hold` i dziobu, suwnica STS z wysięgnikiem nad statkiem, trap do luki
w relingu, wagony towarowe i fragment hali (cztery moduły ścian, dwie kratownice). Północ to
zajezdnia: cztery tory po 9 modułów z kozłami, peron 1,75 m z trzema wiatami przy składzie
(wagon, otwarty wagon, czoło), osobne czoło na drugim torze, słupy sieci, bramownica, nastawnia,
obrotnica w otworze placu (model na y = −1,5) i zaspy. `view=7` pokazuje nabrzeże, `view=8`
zajezdnię; `prop=<nazwa>` kadruje pierwsze wystąpienie. Dziewięć świateł placu (ciepła biel,
bursztyn, błękit) dołącza do puli `CityLights`. Wymiary i powierzchnie chodzenia:
`docs/assets.md`, „Zestaw port i zajezdnia”.

Za prawą pierzeją (x 9–44,4 m, z ±23 m, wewnątrz pierwszego pierścienia panoramy) stoi plac portu ze wszystkimi 15 modelami `port_*.glb` (`PORT_PROP_MODELS`): suwnica nad trzema rzędami kontenerów (stosy do 3 warstw), kładka na dwóch stosach 20 ft, wózek podnoszący kontener, maszt oświetleniowy, 11 modułów krawędzi nabrzeża (wierzch na poziomie placu, ciemna woda za nimi) i pachołki. Dodatkowe światła placu (ciepła biel masztu i suwnicy, bursztyn, błękit, fiolet) dołączają do puli `CityLights`. `prop=port_<nazwa>` kadruje pierwsze wystąpienie modelu (np. `prop=port_reach_stacker`, `prop=port_lashing_platform`). Galeria używa wspólnego loadera i `applyStyle`, tak samo jak gra; zastępstwo `PORT_PREVIEW` zostało usunięte. Plac używa `quay_lines`.

Materiały `mat_container_navy/olive/ochre/graphite`, `mat_crane_paint`,
`mat_quay_concrete`, `mat_rubber_fender`, `mat_steel_grating` są zarejestrowane
w `urbanKinds`. Korzystają z odpowiadających im tekstur `container_corrugated_*`,
`crane_paint`, `quay_concrete`, `rubber_fender`, `steel_grating`. Materiał podłoża
`quay_lines` jest dostępny w danych bloków. Parametry skali na metr, reliefu,
metaliczności, szorstkości i udziału w mokrych odbiciach są w walidowanym zod
`src/data/render/portMaterials.json` (wspólny format wpisu: `texture`, opcjonalnie `tint`
albo `themeTint` (`asphalt` / `concrete` z aktywnego motywu), `scale` = powtórzenia
tekstury na metr, `roughness`, `metalness`, `bump`, `wetness` = udział w odbiciach,
opcjonalnie `flat: true` = czysta barwa `tint` bez tekstury i shadera miasta; do
`urbanLooks` scalane są kolejno pliki `portMaterials`, `arenaMaterials`,
`portRailMaterials`, `overpassMaterials`, a przy powtórzonym kluczu wygrywa późniejszy:
`hazard_stripes_worn` i `scaffold_planks` z `overpassMaterials.json` nadpisują wpisy z
`arenaMaterials.json`). Kontenery mają w danych osobne ciemne
barwy lakieru (`container_navy` `#283a62`, `container_olive` `#4e5638`,
`container_ochre` `#a97c26`, `container_graphite` `#343a44`); `steel_grating` ma `#4b5462`;
`quay_concrete` i `quay_lines` używają odpowiednio barw `concrete` i `asphalt`
aktywnego motywu miasta. `crane_paint` i `rubber_fender` nie mają `tint`, więc zachowują biały
mnożnik. Barwa `tint` jest stosowana tylko gdy `citySurfaceDetail` motywu > 0 (albo wpis
ma `flat`, albo jest to jedna z czterech posadzek `turbine_hall_floor`, `power_quay_floor`,
`overpass_street`, `overpass_forecourt`); w przeciwnym razie `#ffffff`.
W motywie `white`, przy wyłączonym detalu, również kontenery są białe.
Materiały zestawu „port i zajezdnia” (`ship_hull_paint`, `ship_deck_steel`,
`rail_ballast`, `rail_sleeper_concrete`, `maglev_body_panel`, `snow`, `snow_asphalt`,
`snow_concrete`; w GLB nazwy `mat_<rodzaj>`) są
w `urbanKinds` jako `portRailKinds` z danymi w `src/data/render/portRailMaterials.json`
(rodzaj `snow` używa pliku tekstury `snow_concrete`). Wszystkie pliki tekstur z
`public/assets/textures/surfaces/` istnieją; do czasu załadowania tekstury (`surfaceReady`)
shader używa wzoru zastępczego (proceduralny szum zamiast mapy).
Przykładowe dane (`tint`, `scale`, `roughness`, `metalness`, `bump`, `wetness`):
`ship_hull_paint` `#2f3a4d`, 0,25, 0,6, 0,3, 0,4, 0,5; `ship_deck_steel` `#434d4c`, 0,5, 0,7, 0,35, 0,5, 0,6;
`rail_ballast` `#57544f`, 1, 0,95, 0, 1, 0,2; `rail_sleeper_concrete` `#6b717b`, 0,5, 0,85, 0, 0,5, 0,3;
`maglev_body_panel` `#4b586c`, 0,25, 0,35, 0,45, 0,3, 0,5; `snow` `#c8d2e0`, 0,5, 0,95, 0, 0,3, 0;
`snow_asphalt` `#303a4b`, 0,25, 0,95, 0, 0,4, 0; `snow_concrete` `#56627a`, 0,25, 0,95, 0, 0,4, 0.
Reszta wpisów (aren, estakady) leży w `arenaMaterials.json` i `overpassMaterials.json`
(`overpass_street` `#202a38`, `overpass_forecourt` `#313c49`, `canal_water` płaska `#24324a` z `flat`).
Wzory trójplanarne: tekstura próbkowana 3 razy po osiach świata (`zy`, `xz`, `xy`) z wagami
`normalna^4`, relief z jasności (różniczki ekranowe, wygaszany z odległością), brud
(`grime`), a mokrość materiału (`wetness`) trafia do kanału alfa przebiegu normalnych odbić.
Rodzaje bazowe miasta mają wpisy w kodzie (`urbanLooks`): `concrete` (tekstura `concrete`,
skala 0,25, szorstkość 0,8, metaliczność 0, relief 0,5, `wetness` 0,22), `asphalt` (0,25,
0,3, 0, 0,25, 1), `metal` (`metal_panel`, 0,25, 0,8, 0,35, 0,5, 0), `facade` (`brick`, 0,25, 0,8, 0, 0,9, 0),
`trim` (`metal_panel`, 0,25, 0,8, 0,35, 0,3), `glass`/`cable` (`grime`, 0,25, 0,8, 0, 0),
`paint` (`painted_metal`, 0,7, 0,55, 0,25, 0,7), `lacquer` (`painted_metal`, 0,5, 0,3, 0,3, 0,25),
`rust` (`rust_metal`, 0,8, 0,85, 0,3, 1), `corrugated` (0,5, 0,55, 0,35, 1,4), `plastic`/`hivis`
(`plastic`, 1, 0,6 / 0,5, 0, 0,5), `rubber` (1,2, 0,9, 0, 0,7), `wood` (`wood_planks`, 0,8, 0,85, 0, 1,1),
`fabric` (`tarp`, 0,9, 0,95, 0, 0,8), `machine` (`tech_panel`, 0,6, 0,5, 0,35, 1), `paving` (0,5, 0,55, 0, 1, 0,45),
`plaster` (0,3, 0,9, 0, 0,8, 0,1), `hazard` (`plastic`, 1, 0,55, 0, 0,4; pasy ostrzegawcze `cityHazardPeriod` 0,3 m, ciemne pasy × 0,07).
Szkło (`glass`) dodaje emisję `skyHorizon` × `citySurfaceDetail` × `0,3 + 0,7 * fresnel^3`.
Wspólny shader miejski zachowuje rzut trójplanarny, brud, relief, sterowanie
detalem oraz `weatherGloss` profilu pogody; `syncMaterials` zachowuje ten wygląd.

Ręczny przegląd: `?scene=city-props-test&view=3` oraz
`?scene=conquest&arena=arenaContainerPort&debug=1`. Porównaj barwy i detale
kontenerów, mokre linie placu, beton kei, kratę pomostów i odbojnice. Integracja
areny zachowuje komórki 20 m jako dolny próg podziału (dalej: podział budżetem trójkątów,
[render.md](render.md#wywołania-rysowania-dużych-aren-budżet-adr-0011-d8)),
instancjonowane kontenery i jedną fazę scalania statyki; aktualny pomiar 776 → 326 siatek (53 partie instancji) opisuje
[arenas.md](arenas.md). Test materiałów sprawdza mapowanie nazw GLB, wybór
tekstury, wspólny uniform pogody i trwałość materiału po synchronizacji.

`?scene=city-props-test&view=6` otwiera osobny plac z 18 modelami budowy
i elektrowni. `prop=build_<nazwa>` lub `prop=power_<nazwa>` pokazuje wybrany
model bez sąsiednich eksponatów, a `yaw` obraca kamerę wokół niego.
Materiały nowych powierzchni mają ciemne kolory zastępcze w
`src/data/render/arenaMaterials.json`. Wymiary i profile chodzenia
opisano w [katalogu zasobów](../assets.md#budowa-i-elektrownia).

## Pogoda pokoju i oprawa portu

Opcjonalne pole `weather` zastępuje parametry deszczu motywu profilem z danych;
bez niego CityDressing zachowuje dotychczasowe zachowanie. Ten sam moduł
obsługuje zmianę profilu, mgłę, mokrość i tło audio, przywracając ustawienia przy
wyjściu. `city-fx-test` pozostaje bez zmian; `weatherTest` pokazuje profile na
pełnej arenie portu. Szczegóły: [weather.md](weather.md), [arenas.md](arenas.md).

## Oprawa wnętrza przemysłowego

Wybierz `"weather": "indoorIndustrial"`. Profil wyłącza opad, wyładowania i panoramę, ustawia chłodną mgłę, pył i szum generatora. Wartości `lighting.hemiIntensity` (0,55) i `lighting.keyIntensity` (0,45) zostawiają miejsce na lokalne źródła. Zmiana na profil zewnętrzny przywraca światło i panoramę motywu.

Bloki przyjmują materiały `tiles_wall` i `tread_plate` z wariantami komiksowymi, a także `machine`, `paint`, `lacquer`, `plastic`, `rubber`, `wood`, `fabric`, `hivis`, `neon_blue`, `neon_violet` i `neon_white`. Model `wall_segment` rozciąga się do wymiarów bloku. Dla płyt stropu ustaw `ceiling: true`. Scena `?scene=map-audit&map=indoorTest&debug=1` ukrywa je w ujęciach `top`, `high-west` i `high-east`. Komenda `audit view spawn` pokazuje sufit ponownie.

Przykładowe fragmenty danych pokoju:

```json
{
  "weather": "indoorIndustrial",
  "blocks": [
    {"position":{"x":0,"y":5.2,"z":0},"size":{"x":20,"y":0.4,"z":20},"material":"metal","ceiling":true}
  ],
  "lights": [
    {"position":{"x":-7,"y":4.9,"z":-5},"color":"#ffcf91","intensity":20,"range":10,"cone":true}
  ],
  "decals": [
    {"texture":"floor_sector_k09","position":{"x":0,"y":0,"z":-3},"size":{"w":3,"h":1},"surface":"floor","yaw":0,"tint":"#ffdbab"}
  ]
}
```

Światło z `cone: true` tworzy stożek w kolorze źródła. Stożek i plama światła sięgają najwyższego płaskiego bloku pod źródłem. Jawne `lights[].floorY` umożliwia ustawienie wysokości ręcznie. Decale `floor_lane_line`, `floor_pallet_bay` i `floor_sector_k09` mają neutralną farbę i kanał alfa. `tint` mnoży kolor tekstury, domyślnie przez biel. Renderer scala rozłączne naklejki na tej samej płaszczyźnie o zgodnej teksturze, kolorze i kryciu.
