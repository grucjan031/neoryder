# Oprawa miasta — Neon Noir

Samodzielne moduły renderu korzystające z `SignDef`, `CityLightDef`, `DecalDef`
i `AmbientFxDef` z `src/world/dressingSchema.ts`. Nie tworzą colliderów, nie
zmieniają symulacji i nie konsumują RNG runu. Integrację RoomScene i Areny
wykonuje integrator. Materiały, motywy i pipeline pozostają oddzielnym zadaniem.

## Kontrakt integracji

Każdy moduł udostępnia `root: Group`, `update(dtWorldS, dtRealS, camera)` oraz
idempotentne `dispose()`. Pozycje definicji są współrzędnymi świata; dodaj `root`
do sceny bez dodatkowej transformacji. Wywołuj `update` raz na klatkę renderu.
`dtWorldS` to suma kroków symulacji od poprzedniej klatki (z uwzględnieniem
Skupienia, hitstopu i pauzy), `dtRealS` to czas rzeczywisty klatki. Zaktualizuj
kamerę przed efektami. Nie przeliczaj czasu świata ponownie przez timeScale.

```ts
const signs = new SignRenderer(room.signs ?? [], cosmeticSeed);
const decals = new DecalRenderer(room.decals ?? []);
const lights = new CityLights(room.lights ?? [], floorY);
const rain = new Weather({ density: 0.7 }, floorY, cosmeticSeed);
const ambient = new AmbientFx(room.ambientFx ?? [], floorY, cosmeticSeed);
const effects = [signs, decals, lights, rain, ambient];
for (const effect of effects) three.add(effect.root);
// W renderze, po interpolacji kamery:
for (const effect of effects) effect.update(dtWorldS, dtRealS, camera);
// Przy opuszczaniu pokoju:
for (const effect of effects) effect.dispose();
```

Importy: `src/render/city/{signs,decals,lights}.ts` i
`src/vfx/{weather,ambientFx}.ts`. Seed jest stringiem lub liczbą. Ten sam seed,
definicje i sekwencja dt dają te same cząsteczki i migotanie. Domyślne seedy są
stałe; integrator powinien podać osobne seedy kosmetyczne pokoju. Nie używamy
`Math.random()`.

## Napisy i hologramy

`SignRenderer(defs, seed?, textureLoad?)` ładuje tekstury z
`/assets/textures/signs/<texture>.webp` lub `/assets/textures/holo/<texture>.webp`.
Płaszczyzna patrzy w +Z przy yaw=0. `tint` mnoży kolor tekstury. Czarne tło jest
niewidoczne przy addytywnym mieszaniu; kanał alfa pozostaje respektowany.
Materiały mają `toneMapped=false`, `depthWrite=false`, `userData.bloom=true`.

Uwaga dla integratora pipeline: obecny pass normalnych w `outline.ts` stosuje
globalny `overrideMaterial`. Bez filtrowania przezroczystej oprawy może rysować
kontur całych quadów pary, plam i deszczu. Warstwa oprawy nie zmienia tego passu;
pomijanie przezroczystych VFX w buforze normalnych należy sprawdzić przy integracji
nowego pipeline. `depthWrite=false` dotyczy materiału koloru, nie globalnego override.

Neon ma ciemną płytę za tekstem. `flicker=0` daje stałą jasność; wyższe wartości
włączają krótkie zaniki, buczenie jasności i częściowe wygaszenie komórek UV.
Hologram dodatkowo ma linie skanowania, okresowe przesunięcia pasów i kanałów
RGB, zanik przy dolnej krawędzi oraz słaby stożek projektora z wierzchołkiem
na dole. Animacja napisów i płynność świateł używają `dtRealS`.

Do czasu załadowania obrazu widoczny jest canvas z identyfikatorem `texture`:
biały tekst i obramowanie mnożone przez tint materiału. Brak pliku pozostawia
fallback i wywołuje jedno ostrzeżenie na identyfikator w całej sesji. Nie ma
odrzuconej obietnicy ani wyjątku. Przeglądarka może osobno pokazać HTTP 404
dla brakujących zasobów. W środowisku bez DOM używany jest 1×1 DataTexture.
Tekstury są własnością instancji, także fallbacki i odpowiedzi przychodzące
po `dispose()`; nie należy ich współdzielić z innymi właścicielami.

## Naklejki i światła

`DecalRenderer(defs, textureLoad?)` używa `/assets/textures/decals/…`, kanału alfa,
`opacity` oraz niewielkiego odsunięcia wzdłuż normalnej powierzchni i polygonOffset.
Naklejki nie zapisują głębi i mają jawne `userData.bloom=false`. Dla podłogi
normalna wskazuje +Y; yaw obraca obraz w jej płaszczyźnie. Naklejki są statyczne.

`CityLights(defs, floorY=0)` tworzy dokładnie `tuning.city.maxLights` obiektów
PointLight (domyślnie 8), również gdy definicji jest mniej. Nie usuwa świateł
ani nie przełącza ich widoczności w trakcie aktualizacji. Intensywność 0
zachowuje liczbę świateł w shaderach. Wybór: rosnąca odległość od kamery spośród
świateł, których kula zasięgu przecina frustum; remis rozstrzyga indeks definicji.
Światło poza kadrem może zatem nadal oświetlać widoczny fragment ulicy.

Przy zmianie zestawu stare światło wygasa, dopiero przy progu bliskim zeru
zmienia pozycję/kolor i płynnie narasta. Nie interpolujemy położenia światła
przez ulicę. Każda definicja ma własną addytywną, radialną plamę na `floorY`,
także gdy nie ma przypisanego PointLight. Plamy nie uruchamiają bloomu.
To stylizowana poświata na mokrej nawierzchni, bez odbicia geometrii ani SSR.

## Deszcz i efekty otoczenia

`Weather(params?, floorY=0, seed?)` ma publiczne, mutowalne `params: RainParams`:
`enabled`, `density` (0..1), `speed` (m/s), `windX` (m/s), `color`, `opacity`.
Domyślne wartości pochodzą z `tuning.city`. Deszcz to stała pula 4000 instancji;
gęstość zmienia tylko liczbę rysowanych instancji. Objętość 28×14×28 m podąża
za kamerą; modulo zawija pozycje również po teleportacji i dużym dt. Smugi
mają kierunek wiatru i długość zależną od szybkości oraz `rainExposureS`.
Poniżej `floorY` są ukryte. Przecięcie podłogi emituje pierścień i kroplę,
łącznie do 300 instancji w dwóch stałych pulach. Emisja ma osobny limit na sekundę.

`stormEnabled=false` domyślnie; po włączeniu rzadki błysk ustawia publiczne
`flash` w zakresie 0..1. Kompozycję błysku podpina integrator. Ruch deszczu,
rozbryzgi i błysk używają czasu świata.

`AmbientFx(defs, floorY=0, seed?)` ma osobne pule: para 100, iskry 180, krople
100 i rozbryzgi 80. Para to miękkie billboardy, które unoszą się, rosną i gasną.
Iskry są emitowane seriami, podlegają grawitacji i odbijają się od podłogi;
tylko ich materiał ma flagę bloom. Krople spadają i tworzą pierścień przy
podłodze. `rate` oznacza emisje/s, dla `sparks` serie/s; 0 wyłącza emiter.
Efekty używają czasu świata i stałych pul z zastępowaniem starszych cząsteczek.
Nie ma kolizji z dachami i przeszkodami: integrator wybiera miejsca emisji,
obszar deszczu oraz wysokość płaskiej podłogi.

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
barwy deszczu, betonu i pary. Barwy gracza, Rezonansu i wrogów nie są używane.

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

Testy `tests/unit/cityFx.test.ts`: najbliższe światła/frustum/stała pula,
zawijanie deszczu, gęstość i pauza, deterministyczny seed, limity i kapanie,
fallback canvas, późne ładowanie, naklejki i jednokrotne zwalnianie zasobów.
Ocena wizualna wymaga Chromium/WebGL; testy jednostkowe nie kompilują GLSL.
