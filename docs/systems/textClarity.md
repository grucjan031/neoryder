# Czytelność tekstów — S10-01

Opisy talentów, implantów i modułów pozostają w ich danych. Opisy 6 mocy,
14 synergii i 4 statusów są w `src/data/ui/descriptions.pl.json`, powiązane
istniejącym identyfikatorem. Ich schematy mechaniki nie obsługują opisów;
nie rozszerzamy ich ani zapisu. Wybór zestawu pokazuje opisy mocy i synergii
w podpowiedziach oraz etykietach dostępności. Statusy mają przygotowane teksty,
ale obecny HUD ich jeszcze nie wyświetla.

Limit opisu: 140 znaków (schematy nie wyznaczają mniejszego limitu). CSS kart
nie ogranicza liczby znaków; panel podsumowania ma przewijanie. Nie wykonano
oceny wizualnej ani renderowania — zgodnie ze zleceniem.

Nazwy: Kredyty (sklep wyprawy, przepadają po jej końcu), Dane i Rdzenie
(trwałe odblokowania w warsztacie), punkty talentów (rozwój drzewek).
Doskok zastępuje mieszane „dash/zryw”; Rezonans zastępuje skrót „REZ”.

## Kontrakt informacji o porażce

- `GameEvents.player_died.cause?: string`: rodzaj źródła ostatniego trafienia.
- `GameEvents.run_ended.cause?: string`: przekazanie przyczyny do podsumowania.
- `DamageSystem` odczytuje źródło przed emisją zdarzeń obrażeń, zanim odbiorca
  może usunąć encję. Statusy i zagrożenia otoczenia mają pierwszeństwo przed
  rodzajem sprawcy. Nie zmienia się ilość obrażeń ani kolejność zdarzeń.
- `RunManager.finish(outcome, cause?)` przekazuje przyczynę tylko przy porażce.
- `RunScreenView.cause?` i `defeatMessage(cause?)` pokazują nazwę i jedną poradę
  z `src/data/ui/defeat.pl.json`. Brak lub nieznany kod daje komunikat o
  nieustalonym źródle, bez zgadywania przeciwnika. Wybór pierwszej porady nie
  zużywa generatora losowego rozgrywki.

## Pozostałe podłączenia poza zatwierdzonym zakresem

`src/scenes/run.ts` przekazuje pole zdarzenia do widoku podsumowania;
`src/ui/hud.ts` pokazuje przyczynę i jedną poradę na ekranie śmierci areny,
używając wspólnej funkcji `defeatMessage`. Testy obejmują śmiertelne trafienie
Egzekutora przez `DamageSystem`, rzeczywisty `RunScene` i HUD oraz ekran areny.
Misje liniowe odradzają gracza
w punkcie kontrolnym (`src/scenes/mission.ts`), więc wymagają komunikatu przy
odrodzeniu. Tryby z wieloma życiami wymagają zachowania ostatniej przyczyny
przez hosta i rozróżnienia limitu czasu Kradzieży rdzenia. Kody `timeout` i
`objectiveLost` mają porady, ale nie są jeszcze emitowane. Utrata punktu
Przejęcia sama nie kończy gry. Przegrzanie nie zadaje obrażeń.

Przyczyna jest ulotnym zdarzeniem, nie nowym polem zapisu. Stare podsumowania
bez niej korzystają z komunikatu zastępczego. `docs/api.md` wymaga uzupełnienia
przez właściciela kontraktów (plik poza zakresem tego zlecenia).

## Weryfikacja

`tests/unit/textClarity.test.ts`: kompletność i limit opisów, liczby z danych,
koszt i odnowienie mocy, stałe modyfikatory implantów, waluty, liczba modułów,
opisy w wyborze zestawu, komplet porad dla wrogów, priorytet źródeł śmierci,
usunięcie źródła podczas obsługi trafienia oraz przekazanie do zdarzenia końca
wyprawy i widoku. Kontrola liczb nie zastępuje oceny znaczenia tekstu: sprawdza
wartości i wybrane powiązania, a nie dowolną semantykę polskiej prozy.
