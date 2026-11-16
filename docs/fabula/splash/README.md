# Splasharty NEORYDER

57 ilustracji koncepcyjnych na ekrany ładowania, przygotowanych wbudowanym narzędziem generowania obrazów.

## Struktura i rozdzielczość

- Format WebP stratny (quality 90, method 6), skonwertowany z PNG.
- 57 plików WebP w katalogu `splash/`, wszystkie 1920×1080 px (FullHD, 16:9).
- Generator daje natywnie 1672×941 px. Obrazy przycięto centralnie do 16:9, przeskalowano filtrem Lanczos do 2560×1440 z delikatnym UnsharpMask (radius=1.4, percent=115, threshold=3), a potem zmniejszono Lanczosem do 1920×1080. Wersje 2560×1440 usunięto na prośbę właściciela gry, bo nie wnosiły szczegółów ponad natywny render.
- Natywne rendery zostają poza repozytorium, w `C:\Users\Gracjan\.codex\generated_images\` (podkatalogi wątków Codexa).

## Wspólny styl promptu

Kinowa, stylizowana ilustracja koncepcyjna; mocne czytelne bryły i sylwetki, malarska faktura, bez fotorealizmu. Noc (chyba że scena dzieje się we wnętrzu), zwykle deszcz, mokre nawierzchnie odbijające neony oraz mgła z poświatą miasta. Otoczenie ciemne i chłodne: granat, grafit, stalowy błękit. Neony otoczenia wyłącznie: bursztyn #ffae1a, zieleń #6dff4a, fiolet #8a5cff, błękit królewski #3d7bff, ciepła biel #fff1d6. Czerwień #e0262b na wrogach i wrogiej technologii korporacji (sztuczna kopia Rezonansu, rdzeń i przekaźniki Chóru); cyan #00e5ff tylko na bohaterze i ostrzu plazmowym; magenta #ff2bd6 tylko na prawdziwym Rezonansie. Zwykłe otoczenie nie używa czerwieni, cyanu ani magenty; wyjątkiem jest wyraźnie oznaczona wroga technologia korporacji. Kompozycja 16:9, główny motyw w górnych dwóch trzecich, dolna jedna trzecia spokojna i ciemna. Bez UI, czytelnego tekstu, liter, cyfr, logotypów, znaków wodnych i podpisów; szyldy i ekrany to abstrakcyjne, nieczytelne glify. Postacie jako sylwetki, z tyłu albo z daleka, bez szczegółowych twarzy. Bez krwi, makabry, znaków towarowych i nawiązań do franczyz.

## Pliki

| Plik | Temat | Powiązanie | Natywny rozmiar generatora |
| --- | --- | --- | --- |
| `splash-01-neo-ryd.webp` | Panorama pionowego Neo-Ryd i Maszt | 1, 19, 20 | 1672×941 px |
| `splash-02-niecka.webp` | Zalane ulice Niecki pod estakadami | 1, 14, 17 | 1672×941 px |
| `splash-03-kamienna.webp` | Kryjówka Iskry na stacji Kamienna | 15 | 1672×941 px |
| `splash-04-rampa.webp` | Prolog na rampie towarowej; przebudzenie Rezonansu | Prolog | 1672×941 px |
| `splash-05-maszty.webp` | Maszt nasłuchowy i patrol Kurogane | 1 | 1672×941 px |
| `splash-06-odlewnia.webp` | Odlewnia Kurogane i formacja żołnierzy | 6 | 1672×941 px |
| `splash-07-ladunek.webp` | Kontener klasy K na bocznicy | 3, 4 | 1672×941 px |
| `splash-08-bulwar.webp` | Targ na wielopoziomowym Bulwarze | 7, 9, 18 | 1672×941 px |
| `splash-09-kwarantanna.webp` | Blok w strefie kwarantanny | 8 | 1672×941 px |
| `splash-10-zaklad-kalibracji.webp` | Kamertony w Zakładzie Kalibracji | 13 | 1672×941 px |
| `splash-11-nadajnik.webp` | Nadajnik na dachu i zbliżające się drony | 11 | 1672×941 px |
| `splash-12-sala-monitorow.webp` | Sala Monitorów Orbis | 16 | 1672×941 px |
| `splash-13-zaciemnienie.webp` | Niecka podczas zaciemnienia | 17 | 1672×941 px |
| `splash-14-chor.webp` | Nieruchomy tłum, czerwony oddział i czerwony maszt przekaźnika Chóru | 18 | 1672×941 px |
| `splash-15-pion.webp` | Zewnętrzna winda serwisowa na Maszcie | 19 | 1672×941 px |
| `splash-16-szczyt-masztu.webp` | Czerwony rdzeń i przewody Chóru na szczycie Masztu | 20 | 1672×941 px |
| `splash-17-epilog.webp` | Spokojny moment przy ogniu w Kamiennej | Epilog po 20 | 1672×941 px |

| `splash-18-neoryder.webp` | Kurier na elektrycznym motocyklu na spiralnej rampie towarowej | uniwersum — Kurier, rampy Neo-Rydu | 1672×941 px |
| `splash-19-winda-towarowa.webp` | Otwarta winda towarowa z ludźmi, skrzyniami i wózkami | uniwersum — transport między poziomami Neo-Rydu | 1672×941 px |
| `splash-20-przepompownia.webp` | Gigantyczne pompy, rury i robotnicy nad wodą | uniwersum — Niecka, stara przepompownia | 1672×941 px |
| `splash-21-port-hut.webp` | Suwnice, kontenery i statek przy nabrzeżu | uniwersum — port w Hutach | 1672×941 px |
| `splash-22-ogrody-tarasu.webp` | Szklane kopuły ogrodów i sterylni czerwoni strażnicy | uniwersum — Taras, Helixa Dynamics | 1672×941 px |
| `splash-23-ladowiska-korony.webp` | Statki pionowego startu nad chmurami i burzą | uniwersum — lądowiska Korony | 1672×941 px |
| `splash-24-bloki-bulwaru.webp` | Wielkie bloki, balkony, pranie i kładki | uniwersum — mieszkania Bulwaru | 1672×941 px |
| `splash-25-budka-z-makaronem.webp` | Kucharz w parze i klienci pod estakadą | uniwersum — budka na Bulwarze | 1672×941 px |
| `splash-26-warsztat-miry.webp` | Warsztat we wraku wagonu, blaster i cyanowe ostrze Kuriera | uniwersum — Mira, Kamienna | 1672×941 px |
| `splash-27-kacik-bajta.webp` | Stanowisko łączności, abstrakcyjne dane i sylwetka hakera | uniwersum — Bajt, Kamienna | 1672×941 px |
| `splash-28-poligon.webp` | Trening Kuriera z cyanowym ostrzem w tunelu metra | uniwersum — poligon Kamiennej | 1672×941 px |
| `splash-29-patrol-dronow.webp` | Czerwone drony przeszukują mokre dachy reflektorami | uniwersum — Niecka, patrole Koalicji | 1672×941 px |
| `splash-30-sciana-tarcz.webp` | Ciężcy czerwoni żołnierze napierają tunelem | uniwersum — Kurogane, tunele dołu miasta | 1672×941 px |
| `splash-31-pojedynek.webp` | Cyanowe ostrze Kuriera przeciw czerwonemu ostrzu elitarnego żołnierza | uniwersum — Kurier, dachy Neo-Rydu | 1672×941 px |
| `splash-32-rezonans.webp` | Magentowy Rezonans unosi skrzynie i odrzuca czerwonych żołnierzy | uniwersum — Kurier, zaułki Neo-Rydu | 1672×941 px |
| `splash-33-fabryka-akordu.webp` | Sterylna zrobotyzowana linia produkcji implantów | uniwersum — Akord, Helixa Dynamics | 1672×941 px |
| `splash-34-zalany-tunel.webp` | Sylwetki z latarkami brną obok porzuconego wagonu | uniwersum — zalane metro Niecki | 1672×941 px |
| `splash-35-gabinet-w-koronie.webp` | Puste biuro z panoramą miasta za ogromnym oknem | uniwersum — Korona, Orbis Grid | 1672×941 px |
| `splash-36-zlomowisko.webp` | Mechanicy rozbierają wraki dronów i pancerzy pod estakadą | uniwersum — złomowisko Niecki | 1672×941 px |
| `splash-37-sciana-zaginionych.webp` | Maleńkie fotografie zaginionych, znicze i milczące sylwetki | uniwersum — Iskra, Kamienna | 1672×941 px |

| `splash-38-skok-po-dachach.webp` | Skok kuriera między dachami nad przepaścią ulicy | uniwersum — dachy Niecki, trasy kurierskie | 1672×941 px |
| `splash-39-pralnia.webp` | Całodobowa pralnia i czekający mieszkańcy | uniwersum — pralnia w Niecce | 1672×941 px |
| `splash-40-nielegalna-klinika.webp` | Nielegalna klinika implantów w piwnicy | uniwersum — podziemna klinika Niecki | 1672×941 px |
| `splash-41-kolejka-do-przychodni.webp` | Kolejka do sterylnej przychodni korporacji | uniwersum — przychodnia Helixa Dynamics | 1672×941 px |
| `splash-42-dzieci-w-zaulku.webp` | Dzieci grające w piłkę w zalanym zaułku | uniwersum — zaułki Niecki | 1672×941 px |
| `splash-43-tama.webp` | Ogromna tama i przelewy nad najniższą dzielnicą | uniwersum — tama Niecki | 1672×941 px |
| `splash-44-podstacja.webp` | Podstacja z czerwonymi kontrolkami korporacji | uniwersum — energetyka Niecki | 1672×941 px |
| `splash-45-dworzec.webp` | Stary dworzec zamieniony w noclegownię | uniwersum — dworzec dolnego miasta | 1672×941 px |
| `splash-46-akordowiec.webp` | Żołnierz otoczony czerwonym sztucznym Rezonansem | uniwersum — Akord, korporacyjny żołnierz | 1672×941 px |
| `splash-47-rozstrojony.webp` | Rozstrojona sylwetka z iskrzącym implantem | uniwersum — blok mieszkalny Niecki | 1672×941 px |
| `splash-48-pokoj-przesluchan.webp` | Pusty pokój przesłuchań i cienie za lustrem | uniwersum — korporacyjny ośrodek przesłuchań | 1672×941 px |
| `splash-49-magazyn-chlodniczy.webp` | Zasypana szronem hala kontenerów chłodniczych | uniwersum — magazyn korporacyjny | 1672×941 px |
| `splash-50-radio-iskry.webp` | Kryjówka z radiem i mapą miasta | uniwersum — kryjówka Iskry | 1672×941 px |
| `splash-51-pionowy-cmentarz.webp` | Galerie urn i zniczy w ścianie wieżowca | uniwersum — pionowy cmentarz Neo-Rydu | 1672×941 px |
| `splash-52-burza-nad-masztem.webp` | Maszt i pionowe miasto w burzy | uniwersum — Maszt, Neo-Ryd | 1672×941 px |
| `splash-53-snajper.webp` | Snajper korporacji na gzymsie nad ulicą | uniwersum — Kurogane, dachy Neo-Rydu | 1672×941 px |
| `splash-54-kolej-nadziemna.webp` | Pociąg nadziemny między wieżowcami | uniwersum — kolej Neo-Rydu | 1672×941 px |
| `splash-55-rezonantka.webp` | Rezonantka z unoszącymi się drobnymi przedmiotami | uniwersum — peron metra, Rezonans | 1672×941 px |
| `splash-56-bar-hutnikow.webp` | Zadymiony bar robotników po zmianie | uniwersum — bar w dzielnicy Hut | 1672×941 px |
| `splash-57-przed-switem.webp` | Dachy dolnego miasta tuż przed świtem | uniwersum — dolne miasto Neo-Rydu | 1672×941 px |

## Korekta kolorów technologii Chóru

Obrazy 14 i 16 wygenerowano ponownie: korporacyjna kopia Rezonansu świeci czerwienią #e0262b i pokrewnymi odcieniami, bez magenty w kadrze. Na obrazie 14 sylwetkę na podwyższeniu zastępuje maszt przekaźnika. Obraz 08 sprawdzono wizualnie: reklamy pozostają w dozwolonej palecie, bez różu i magenty; plik zachowano. Natywne rozmiary nowych renderów: 1672×941 px. Obróbka jak w sekcji „Struktura i rozdzielczość”.


## Kontrola nowej partii

Obejrzano wszystkie nowe ilustracje pod kątem tematu, malarskiego stylu, palety, braku tekstu i interfejsu oraz spokojnej dolnej jednej trzeciej. Ponownie wygenerowano 19 (różowe światła w odległym tle), 22 (niezamówiona duża postać z cyanem), 25 (cyanowe światło w tle), 26 (cyan na ubraniu mechaniczki), 30 (widok zza bohatera zamiast pierwszej osoby), 31 (czerwone światła poza przeciwnikiem) i 37 (plener zamiast wnętrza kryjówki). Do katalogu trafiają wyłącznie wybrane finalne warianty.
