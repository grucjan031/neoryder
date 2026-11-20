# NEORYDER

Roguelite z widokiem z pierwszej osoby w cyberpunkowym mieście Neo-Ryd. Grasz agentem komórki ruchu oporu „Iskra” przeciwko Koalicji korporacji: ostrze plazmowe, blastery i moce Rezonansu w ręku, nocne neonowe uliczki, czerwoni wrogowie. Każdy run kończy się trwałym postępem postaci.

Gra działa w przeglądarce (TypeScript, Three.js, Rapier).

## Co jest w grze

- **Samouczek** (`?scene=tutorial`): 11 ćwiczeń ruchu i walki, zakończonych przejściem do kryjówki.
- **Trzy ścieżki buildów:** Ostrze, Rezonans (moce) i Strzelec, plus hybrydy z synergiami.
- **Run 15–25 minut:** mapa sektora Kurogane Arms z wyborem ścieżki, pokoje walki i elit, sklep, odpoczynek, boss.
- **Implanty na czas runu** i **trwały postęp:** poziom postaci, drzewka talentów, odblokowania broni, mocy i modułów.
- **Kryjówka** w nieczynnej stacji metra: terminal drzewek, warsztat, tablica misji z Poziomem zagrożenia, poligon.

## Uruchomienie

Wymaga Node.js 22.12 lub nowszego.

```bash
npm install
npm run dev        # http://localhost:5173
```

Z menu wybierz „Kryjówka”, podejdź do tablicy misji i rozpocznij run.

## Sterowanie

| Klawisz / mysz           | Akcja                                                        |
| ------------------------ | ------------------------------------------------------------ |
| W / S / A / D            | ruch                                                         |
| Shift                    | sprint                                                       |
| Spacja (×2)              | skok i podwójny skok                                         |
| Q                        | dash                                                         |
| Ctrl w sprincie          | ślizg                                                        |
| LPM                      | cios lub strzał; przytrzymanie ostrza = ciężki atak          |
| PPM                      | blok; wciśnięty tuż przed trafieniem pocisku = parowanie     |
| R                        | zamiana ostrze / broń                                        |
| 1 / 2 / 3                | wybór broni                                                  |
| F                        | moc Rezonansu                                                |
| E                        | interakcja w kryjówce                                        |
| Esc                      | pauza i ustawienia                                           |

## Komendy

| Komenda           | Co robi                                         |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | serwer deweloperski z panelem strojenia         |
| `npm run check`   | typy, lint i testy jednostkowe                  |
| `npm run e2e`     | testy w przeglądarce (Playwright)               |
| `npm run build`   | build produkcyjny do `dist/`                    |
| `npm run balance` | symulacja balansu, raport w `docs/balance.md`   |

## Wdrożenie

Produkcja i podgląd każdego PR idą przez Vercel (integracja z GitHubem): Vercel sam wykrywa Vite, buduje `npm run build` i publikuje `dist/`. Repo nie ma innej konfiguracji hostingu.

## Dokumentacja

- `docs/gdd.md` — projekt gry
- `docs/roadmap.md` — wizja i fazy
- `docs/systems/` — specyfikacje systemów
- `docs/api.md` — kontrakty między modułami
