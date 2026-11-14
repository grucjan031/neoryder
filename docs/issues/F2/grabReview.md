# F2-09 — przegląd zewnętrzny

Każdy punkt sprawdzono w kodzie przed poprawką. Testy odtwarzające błędy
uruchomiono na pierwotnej implementacji: 15 z pierwszych 17 regresji było
czerwonych; dokładniejszy test marginesu Drona też odtworzył zakleszczenie.
Dotychczasowe asercje zachowano (poza wcześniej dozwolonym dodaniem `grab`
do listy danych). Testy są w `grabPower.test.ts` i `grabTest.test.ts`.

Weryfikacja końcowa: `npm run check` zielone — typecheck, lint, 506 testów
w 51 plikach. Dwa pliki Chwytu zawierają 59 zielonych testów (23 nowe).
`git diff --check` bez błędów. E2E i ręczna ocena feel pozostają koordynatorowi.

| Punkt | Wynik i dowód | Zmiana |
| --- | --- | --- |
| 1 | Potwierdzony: po upuszczeniu przy ścianie Dron pozostawał na ok. 0,53 m zamiast wrócić na 2,6 m. Zwykły skośny rzut nie odtwarzał błędu. | Po przejęciu odzyskuje margines `skinM`; testy obejmują upuszczenie przy ścianie oraz rzut, lądowanie, wznoszenie i ruch AI. |
| 2 | Potwierdzony: szybka skrzynia pomijała bliski sensor Drona w pierwszym kroku. | Sweep po obsłudze puszczenia obejmuje nowy lot; początkowe nakładanie też jest trafieniem. |
| 3 | Potwierdzony: poziomy rzut przy podłodze ranił rzucanego; szybki chwyt i puszczenie startowały z poprzedniej pozycji (błąd 5 m w teście). | Lądowanie/podłoga używają całkowitej prędkości; świat wymaga normalnej prędkości uderzenia ≥ progu. Punkt trzymania jest zatwierdzany przed rzutem. |
| 4 | Potwierdzony testem kontaktów: pierwszy kontakt ze światem odbierał trafienie wrogowi. | Priorytet wroga dla jednoczesnych kontaktów, także przy tym samym czasie sweep. |
| 5 | Potwierdzony: sweep dostawał 1/60 s zamiast 0,3/60 s świata. | Opcjonalny `worldDt` w API mocy/slotów; scena przekazuje go osobno od czasu gracza. Testy jednostkowe i integracyjne Skupienia. |
| 6 | Potwierdzony: puszczenie bez chwytu podczas hitstopu rzucało późniejszy chwyt. | Bufor puszczenia tylko dla chwytu aktywnego lub zakolejkowanego. |
| 7 | Potwierdzony dla energii i maxHoldS: puszczenie kończyło się zerową prędkością. | Jawne puszczenie obsługiwane przed limitami. |
| 8 | Potwierdzony: trzy archetypy przechodziły w stunned podczas przejęcia, a przejęty Egzekutor parował. Kod zwolnienia ustawiał idle bez sprawdzenia statusu. | Brak reakcji ruchu/stanu podczas controlled; zwolnienie zachowuje aktywne ogłuszenie, parowanie wyłączone. |
| 9 | Potwierdzony: po pojawieniu się cienkiej ściany cel pozostawał po jej dalszej stronie. | Cast od oka i odstęp od kapsuły gracza; przy braku miejsca bezpieczne upuszczenie. Test z rzeczywistą kapsułą. |
| 10 | Częściowo potwierdzony: masa była brana z geometrii ciała, zamiast z danych. Hipoteza masy równej 0 została odrzucona — test limitu 0,01 kg odmawiał chwytu już przed zmianą. | Zgodnie z żądaniem jawna masa 5 kg w `drone.massKg`, używana dla limitu i ciała; test limitu 4 kg. |
| 11 | Potwierdzony: druga instancja mogła przejąć już trzymanego wroga. | Kandydaci pomijają `controlled`, również w locie. |
| 12 | Potwierdzony: poprzedni snapshot wiązki pozostawał różny od bieżącego; scena wracała przed aktualizacją snapshotów, HUD zachowywał licznik. | W hitstopie previous = current; nowy chwyt zeruje licznik HUD. Testy porównują render przy alpha 0 i 1. |
| 13 | Wykonane. | Regresje: Dron przy ścianie i po rzucie, powrót do wznoszenia/AI, poziomy rzut przy podłodze, bliski sensor, czas świata w Skupieniu. |

Ręcznie w `?scene=grab-test&debug=1`: rzucić Dronem w ścianę, poczekać na
lądowanie i powrót do lotu; rzucić poziomo z przysiadu; szybko nacisnąć i puścić
F podczas hitstopu; sprawdzić prowadzenie celu przy cienkiej ścianie.
Ocenić, czy bezpieczne upuszczenie przy braku miejsca jest czytelne i czy
powrót Drona do lotu nie wygląda jak nagłe przesunięcie. E2E uruchamia koordynator.
