# Pogoda sterowana danymi

Profile `src/data/weather/<id>.json` waliduje `weatherSchema` w warstwie renderu.
Pokój wybiera profil opcjonalnym `weather`; brak pola zachowuje dokładnie
dotychczasową ścieżkę motywu: deszcz, mgłę, połysk i częstotliwość burzy.
Nie ma zdarzeń rozgrywki, sił fizycznych ani wpływu pogody na AI lub obrażenia.

| Profil      | Opad / pył                                   | Wiatr           | Widoczność i nawierzchnia           |
| ----------- | -------------------------------------------- | --------------- | ----------------------------------- |
| rain        | Dotychczasowe smugi neonStreet, gęstość 0,65 | 1 m/s           | Dotychczasowa mgła i odbicia        |
| storm       | Ulewa, pełna pula                            | 7 m/s + porywy  | Mocny połysk, wyładowania co 5–13 s |
| smog        | Bez opadu, miękkie billboardy pyłu           | 0,65 m/s        | Gęsta mgła do wysokości 9 m         |
| drizzleWind | Krótkie, cienkie smugi mżawki                | 10 m/s + porywy | Umiarkowana mgła i mokrość          |
| clearNight  | Bez opadu i pyłu                             | 0,5 m/s         | Lekka mgiełka i mokre plamy         |

## Parametry i integracja

`precipitation` określa rodzaj, gęstość, prędkość, kolor, przezroczystość,
ekspozycję i szerokość smug. `wind` ma normalizowany kierunek XZ, siłę,
amplitudę i okres porywów. `fog` ma kolor, gęstość, wysokość zaniku oraz
parametry mgły odległościowej. `surface` steruje połyskiem materiałów miejskich,
siłą istniejących odbić neonów i maską kałuż. Nie dodaje SSR ani odbić całej sceny.
`lightning` określa przedział losowania czasu, jasność, czas zaniku i wyłącznie
ciepłą biel `#fff1d6`. `dust` określa gęstość, rozmiar, czas życia, kolor i alfę.
`ambience` definiuje warstwy rain/wind z głośnością i zasięgiem.

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

Testy: `arenaWeather.test.ts` (schemat, profile, seed wyładowań, przywracanie
stanu), istniejące `cityFx`/`rainShelters` (regresja starego deszczu).
`tests/e2e/arenaWeather.spec.ts` sprawdza start portu i przełączanie pięciu profili
bez błędów konsoli. Test e2e przygotowano, lecz zgodnie z briefem nie uruchamiano.
GLSL, wygląd i odsłuch wymagają oceny w przeglądarce przez managera.
