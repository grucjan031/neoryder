# Sterowanie, zapis i zgłaszanie problemów

## Sterowanie domyślne

Poniższa tabela przedstawia domyślne przypisania klawiszy i przycisków myszy. Wszystkie klawisze klawiatury możesz zmienić w grze w menu **Ustawienia → Sterowanie**.

| Klawisz / przycisk myszy        | Akcja                    | Uwagi                                                                                                                      |
| ------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `W`                             | Ruch do przodu           |                                                                                                                            |
| `S`                             | Ruch do tyłu             |                                                                                                                            |
| `A`                             | Ruch w lewo              |                                                                                                                            |
| `D`                             | Ruch w prawo             |                                                                                                                            |
| `Spacja`                        | Skok                     | Ponowne naciśnięcie w powietrzu wykonuje podwójny skok (po odblokowaniu talentu lub na poligonie)                          |
| `Lewy Shift` / `Prawy Shift`    | Sprint                   | Przytrzymanie przyspiesza bieg                                                                                             |
| `Q`                             | Doskok                   | Krótki ruch unikowy (dash)                                                                                                 |
| `Lewy Ctrl` / `Prawy Ctrl`      | Przysiad / ślizg         | Naciśnięcie podczas sprintu uruchamia ślizg                                                                                |
| `LPM` (lewy przycisk myszy)     | Atak / strzał            | Z ostrzem: kliknięcie = szybkie cięcie lub wykończenie gotowego wroga, przytrzymanie = ciężki atak; z bronią palną: strzał |
| `ŚPM` (środkowy przycisk myszy) | Rzut ostrzem             | Działa także z bronią palną w ręce — przywraca ostrze i rzuca nim przed siebie                                             |
| `PPM` (prawy przycisk myszy)    | Blok / celowanie         | Z ostrzem: blok (wciśnięty tuż przed trafieniem = parowanie); z bronią palną: celowanie (przybliżenie)                     |
| `R`                             | Zmień ostrze / broń      | Przełącza między ostrzem a aktywną bronią palną                                                                            |
| `1` / `2` / `3`                 | Broń 1 / Broń 2 / Broń 3 | Wybiera broń palną z odpowiedniego slotu ekwipunku                                                                         |
| `F`                             | Moc 1                    | Używa mocy Rezonansu z pierwszego slotu                                                                                    |
| `E`                             | Moc 2 / interakcja       | W walce używa mocy z drugiego slotu; w kryjówce otwiera stacje, rozpoczyna rozmowy i aktywuje rekwizyty                    |
| `M`                             | Plan stacji              | W kryjówce otwiera i zamyka plan stacji Kamienna                                                                           |
| `Tab`                           | Menu ulepszeń (run)      | W trakcie runu otwiera podgląd implantów, synergii, broni, modułów i mocy                                                  |

### Dodatkowe informacje o sterowaniu

- **Pauza (`Esc`):** otwiera menu pauzy lub zamyka bieżące okno interfejsu. Klawisz `Esc` oraz `` ` `` są zarezerwowane i nie można ich przypisać do innych akcji.
- **Przechwycenie kursora (pointer lock):** obracanie kamery działa po kliknięciu w okno gry. Przełączenie okna, ukrycie karty przeglądarki lub wyjście z przechwycenia kursora automatycznie pauzuje symulację i muzykę.
- **Celowanie a blok:** akcja **Celowanie (PPM z bronią palną)** współdzieli domyślnie prawy przycisk myszy z blokiem; w ustawieniach sterowania możesz dodatkowo przypisać do niej osobny klawisz klawiatury. Przyciski myszy nie podlegają przemapowaniu.

---

## Jak działa zapis

Gra zapisuje postępy **automatycznie i lokalnie w Twojej przeglądarce** — nie wymaga zakładania konta ani połączenia z chmurą.

### Co i gdzie jest zapisywane

1. **Baza przeglądarki (IndexedDB)** przechowuje oddzielnie trzy rodzaje danych:
   - **Postęp stały:** poziom postaci, doświadczenie, waluty (Dane i Rdzenie), wykupione talenty, odblokowania w warsztacie, ustawiony ekwipunek i moduły, odblokowany i wybrany Poziom zagrożenia, statystyki, ukończone misje fabularne oraz zdobyte Naszywki Iskry.
   - **Bieżący run:** aktywna mapa sektora, ziarno (seed), zdrowie, kredyty, implanty i stan rozliczenia nagrody po zakończeniu runu. Zapis następuje automatycznie przy wejściu na mapę sektora, zdobyciu implantu, zakupie w sklepie, zmianie liczby kredytów oraz na końcu runu.
   - **Punkt kontrolny misji:** w misjach liniowych zapisuje ostatnio osiągnięty punkt kontrolny oraz ukończone cele.
2. **Pamięć lokalna (`localStorage`)** przechowuje Twoje ustawienia: przypisania klawiszy, czułość myszy, odwrócenie osi Y, pole widzenia (FOV), głośność, jakość grafiki, wstrząsy kamery, błyski ekranu oraz poziom trudności.

> **Ważne podczas przerwania gry w pokoju:** postęp walki wewnątrz pojedynczego, jeszcze nieukończonego pokoju nie jest zapisywany na bieżąco. Po odświeżeniu strony wrócisz na mapę sektora sprzed wejścia do tego pokoju (zdobyte już kredyty, implanty oraz zakupy w sklepie zostają zachowane).

### Co kasuje wyczyszczenie danych witryny

Ponieważ cały zapis znajduje się wyłącznie w pamięci lokalnej przeglądarki:

- **Wyczyszczenie danych witryny** (ciasteczek, pamięci podręcznej witryn / IndexedDB oraz `localStorage` dla adresu gry) **trwale usuwa cały postęp stały, aktywny run, punkty kontrolne misji oraz ustawienia**.
- Gra uruchomiona w **oknie prywatnym / incognito** traci cały zapis po zamknięciu wszystkich okien tego trybu.
- Postępy nie przenoszą się automatycznie między różnymi przeglądarkami ani różnymi urządzeniami.

---

## Jak zgłosić problem

Znalazłeś błąd w grze, problem z płynnością lub niejasne zachowanie interfejsu? Zgłoś go pod adresem:

**<LINK DO ZGŁOSZEŃ>**

Aby ułatwić odtworzenie problemu, dołącz do zgłoszenia następujące informacje:

1. **Numer wersji gry** oraz **ziarno runu (seed)** widoczne w grze (wersję i build pokazuje menu główne, a menu pauzy także seed i przycisk kopiujący dane techniczne do zgłoszenia; ziarno znajdziesz też na mapie sektora i na ekranie podsumowania runu).
2. **Krótki opis sytuacji:** gdzie wystąpił błąd (kryjówka, samouczek, konkretna misja, tryb areny lub pokój runu) i co robiłeś chwilę wcześniej.
3. **Przeglądarkę i system operacyjny** (np. Chrome na Windows 11) oraz — jeśli to możliwe — zrzut ekranu lub treść komunikatu z gry.
