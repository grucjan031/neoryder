# Pogoda sterowana danymi

Profile `src/data/weather/<id>.json` waliduje `weatherSchema` w warstwie renderu.
Pokój wybiera profil opcjonalnym `weather`; brak pola zachowuje dokładnie
dotychczasową ścieżkę motywu: deszcz, mgłę, połysk i częstotliwość burzy.
Nie ma zdarzeń rozgrywki, sił fizycznych ani wpływu pogody na AI lub obrażenia.

| Profil      | Opad / pył                                   | Wiatr            | Widoczność i nawierzchnia           |
| ----------- | -------------------------------------------- | ---------------- | ----------------------------------- |
| rain        | Dotychczasowe smugi neonStreet, gęstość 0,65 | 1 m/s            | Dotychczasowa mgła i odbicia        |
| storm       | Ulewa, pełna pula                            | 7 m/s + porywy   | Mocny połysk, wyładowania co 5–13 s |
| smog        | Bez opadu, miękkie billboardy pyłu           | 0,65 m/s         | Gęsta mgła do wysokości 9 m         |
| drizzleWind | Krótkie, cienkie smugi mżawki                | 10 m/s + porywy  | Umiarkowana mgła i mokrość          |
| clearNight  | Bez opadu i pyłu                             | 0,5 m/s          | Lekka mgiełka i mokre plamy         |
| snow        | Wolne, niebieskawobiałe płatki, gęstość 0,38 | 1,1 m/s + porywy | Chłodna mgła 24–170 m, matowy śnieg |
| ashfall     | Szare i ciepłoszare płatki, gęstość 0,28     | 1,6 m/s + porywy | Ciepła mgła 24–145 m, sucho         |

## Parametry i integracja

`precipitation` określa rodzaj, gęstość, prędkość, kolor, przezroczystość,
ekspozycję i szerokość smug. `wind` ma normalizowany kierunek XZ, siłę,
amplitudę i okres porywów. `fog` ma kolor, gęstość, wysokość zaniku oraz
parametry mgły odległościowej. `surface` steruje połyskiem materiałów miejskich,
siłą istniejących odbić neonów i maską kałuż. Nie dodaje SSR ani odbić całej sceny.
`lightning` określa przedział losowania czasu, jasność, czas zaniku i wyłącznie
ciepłą biel `#fff1d6`. `dust` określa gęstość, rozmiar, czas życia, kolor i alfę.
`ambience` definiuje warstwy rain/wind z głośnością i zasięgiem.

Rodzaje `snow` i `ash` wymagają `precipitation.flakes`: `sizeM` (średnica),
`swayM` (amplituda kołysania), `swayPeriodS` (okres), `windScatter` (rozrzut
prędkości dryfu) i `secondaryColor` (drugi kolor naprzemiennych instancji).
`precipitation.speed` pozostaje prędkością pionową. Śnieg: 1,2 m/s, płatek
0,075 m, kołysanie 0,22 m / 4,5 s, rozrzut 0,18. Popiół: 0,55 m/s,
0,065 m, kołysanie 0,6 m / 2,4 s, rozrzut 0,65. Dryf korzysta z wiatru
profilu; fazy zależą od indeksu instancji, pozycje początkowe od seeda.
Oba profile wyłączają rozbryzgi, kałuże, odbicia i wyładowania.
Płatki mają miękką okrągłą maskę alfa. Popiół ma dodatkowo krawędź
postrzępioną szumem. Płatki w odległości mniejszej niż 1,5 m od kamery
są ukrywane. Próg i parametry maski są w `tuning.weather`.

`surface.snowCoverage` (0..1, domyślnie 0) miesza kolor wierzchu z
`surface.snowColor`, zwiększa szorstkość do 1 i zmniejsza metaliczność.
Maska korzysta z dodatniej składowej Y normalnej świata: spody i ściany
pozostają bez śniegu. To minimalne przyprószenie bez geometrii i tekstur,
bez testu osłonięcia powierzchni przez dach. Profil snow ma pokrycie 0,6
i kolor `#9aa6bf`. Dwie próbki szumu w światowym XZ tworzą łaty
i wydłużone przetarcia, które odsłaniają ciemną nawierzchnię.
Ta sama maska steruje barwą, szorstkością i metalicznością.
Opcjonalny `sky.horizonColor` ustawia istniejącą łunę: snow `#344363`,
ashfall `#715632`. Powrót do starego profilu przywraca łunę motywu.
Śnieg ma cichy wiatr (gain 0,12); popiół wiatr 0,09 i istniejący niski
pomruk `generator` z gain 0,3. Nie dodano nowego syntezatora ani zasobów.

Koszt: ta sama pula 4000 instancji i jedno wywołanie rysowania opadu;
snow rysuje do 1520 płatków, ashfall do 1120 (przed mnożnikiem jakości).
Brak dodatkowej puli i alokacji na płatek; tablica kolorów instancji powstaje
przy pierwszym przełączeniu na płatki. Na aktywny płatek przypadają sin/cos
kołysania i sin rozrzutu. Shader miejski dodaje jeden interpolowany float,
transformację normalnej na wierzchołek oraz maskę max/mnożenie, dwa mix
(kolor, szorstkość) i mnożenie metaliczności na fragment, bez nowych próbek tekstur
i przebiegów.
Maska śniegu dodaje dwie próbki szumu proceduralnego na fragment z pokryciem.
Maska płatka dodaje interpolowane UV i radialne wygładzanie alfa.
Tylko popiół liczy cztery hasze i interpoluje szum krawędzi.
Nowe pola starych pięciu profili są neutralne; ich pliki pozostają bez zmian.

Opad i efekty otoczenia kończą się na `weatherFloorY` pokoju (domyślnie
`playerSpawn.y`). Areny z ulicą pod dachami (`arenaRooftops`: −14 m) podają dno
ulicy, a bryły kamienic są strefami bez deszczu, więc mżawka pada do ulicy,
a nie przez dachy.

`CityDressing.setWeather(id)` nakłada profil na istniejący `Weather`, ustawienia
mgły/odbicia i wspólny uniform mokrości w `urbanMaterials`. Zwraca false dla
nieznanego id. Pule opadu pozostają stałe; przełączenie czyści rozbryzgi i pył,
bez przebudowy pokoju, colliderów ani obiektów walki. Pył dostaje jedną pulę
240 instancji przy pierwszym użyciu. Wspólne limity smug i rozbryzgów pozostają
w `tuning.city`; nowe wspólne ustawienia są w `tuning.weather`, widocznym w GUI.

Czas efektów pochodzi ze skumulowanych kroków świata. Pauza zatrzymuje opad,
porywy i wyładowania. Burza losuje następny odstęp przez kosmetyczny `Rng`,
niezależny od RNG symulacji; port używa seeda runu i id pokoju. Ustawienie
dostępności „błyski” nadal odcina błysk w kompozycji. Stare sceny nie otrzymują
nowego profilu automatycznie ani nowego koloru błysku.

Warstwy audio wykorzystują `AmbienceSynth`: filtrowany szum i istniejącą
modulację. Źródła podążają za kamerą (stała głośność, bez przesuwania panoramy).
Odblokowanie dźwięku po geście, głośność i pauza pozostają w AudioSystem.
Wyjście ze sceny zwalnia pule, czyści audio i przywraca poprzednią mgłę,
odbicia, kolor błysku oraz uniform połysku. Nie zmienia dźwięków kryjówki.
Tryb `fx=lite` nadal wyłącza kosztowne cząsteczki.

## Sprawdzenie w 30 sekund

Otwórz `?scene=weatherTest&debug=1`. To grywalny port z kolizjami i włączoną
nieśmiertelnością. Przyciski u góry kolejno przełączają wszystkie profile.
Po pierwszym kliknięciu powinien działać dźwięk. Porównaj smugi, kierunek wiatru,
pył, mgłę i połysk; `clearNight` nie może pokazywać opadu. Dla burzy poczekaj
do 13 s na ciepły błysk. Konsola: `weather <id>`, odczyt `query('weather')`.
Sprawdź także starą scenę `?scene=city-fx-test`: bez komend pogody jej wygląd
i komendy `rain`/`storm` pozostają takie jak wcześniej.

Dla nowych profili: kliknij „Śnieg” (lub `weather snow`), obejrzyj miękkie
płatki i matowe wierzchy z ciemnymi przetarciami. Podejdź do płatków
i sprawdź, czy znikają przy kamerze. Kliknij „Opad popiołu”
(lub `weather ashfall`): płatki powinny opadać wolniej i bardziej chaotycznie,
pod ciepłą łuną; słychać niski pomruk. W obu profilach brak kałuż i rozbryzgów.
Przełącz na rain: powinny wrócić smugi, kolor łuny i mokre powierzchnie.

Testy: `arenaWeather.test.ts` (schemat, profile, seed wyładowań, przywracanie
stanu), istniejące `cityFx`/`rainShelters` (regresja starego deszczu).
`tests/e2e/arenaWeather.spec.ts` sprawdza start portu i przełączanie siedmiu profili
bez błędów konsoli. Test e2e przygotowano, lecz zgodnie z briefem nie uruchamiano.
GLSL, wygląd i odsłuch wymagają oceny w przeglądarce przez managera.
