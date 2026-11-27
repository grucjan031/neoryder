# NEORYDER

Roguelite z widokiem z pierwszej osoby w cyberpunkowym mieście Neo-Ryd. Grasz agentem komórki ruchu oporu „Iskra” przeciwko Koalicji korporacji: ostrze plazmowe, blastery i moce Rezonansu w ręku, nocne neonowe uliczki, czerwoni wrogowie. Każdy run kończy się trwałym postępem postaci.

Gra działa w przeglądarce (TypeScript, Three.js, Rapier).

## Co jest w grze

- **Samouczek** (`?scene=tutorial`): 11 ćwiczeń ruchu i walki, zakończonych przejściem do kryjówki.
- **Kampania fabularna:** 10 misji (od „Maszty” do „Archiwum”) z dialogami przez radio, celami dodatkowymi i punktami kontrolnymi. „Nocny dyżur” ma cichą fazę: patrole i kamery wykrywają gracza, a alarm zmienia przebieg misji.
- **Trzy ścieżki buildów:** Ostrze, Rezonans (moce) i Strzelec, plus hybrydy z synergiami. Dziesięć broni (m.in. pistolet, rewolwer, karabin, kusza, snajperka, broń wiązkowa i EMP) i moduły broni.
- **Drużyna:** do dwóch towarzyszy (Nadia, Szron) w misjach i runach.
- **Run 15–25 minut:** mapa sektora z wyborem ścieżki, pokoje walki i elit, sklep, odpoczynek, boss. Dzielnicę wybiera się na tablicy misji:
  - **Kurogane Arms**: magazyn i galeria handlowa,
  - **Bulwar · Helixa Dynamics** (po misji „Nocny dyżur”): bezpłatna przychodnia na 61. piętrze, z blokiem operacyjnym i przeszklonym atrium. Trudniejsze walki, wyższa wypłata.
- **Wrogowie** od szturmowców i dronów po ochroniarzy i sanitariuszy Helixy (mgła spowalniająca ze strzykawki).
- **Implanty na czas runu** i **trwały postęp:** poziom postaci, drzewka talentów, odblokowania broni, mocy i modułów.
- **Kryjówka** w nieczynnej stacji metra: terminal drzewek, warsztat, tablica misji z Poziomem zagrożenia i wyborem dzielnicy, poligon.

## Uruchomienie

Wymaga Node.js 22.12 lub nowszego.

```bash
npm install
npm run dev        # http://localhost:5173
```

Z menu wybierz „Kryjówka”, podejdź do tablicy misji i rozpocznij run.

## Sterowanie

| Klawisz / mysz | Akcja                                                    |
| -------------- | -------------------------------------------------------- |
| W / S / A / D  | ruch                                                     |
| Shift          | sprint                                                   |
| Spacja (×2)    | skok i podwójny skok                                     |
| Q              | dash                                                     |
| Ctrl           | kucanie (w sprincie: ślizg)                              |
| LPM            | cios lub strzał; przytrzymanie ostrza = ciężki atak      |
| PPM            | blok; wciśnięty tuż przed trafieniem pocisku = parowanie |
| R              | zamiana ostrze / broń                                    |
| 1 / 2 / 3      | wybór broni                                              |
| F              | moc Rezonansu                                            |
| E              | interakcja w kryjówce                                    |
| Esc            | pauza i ustawienia                                       |

## Komendy

| Komenda                    | Co robi                                                 |
| -------------------------- | ------------------------------------------------------- |
| `npm run dev`              | serwer deweloperski z panelem strojenia                 |
| `npm run check`            | typy, lint i testy jednostkowe                          |
| `npm run e2e`              | testy w przeglądarce (Playwright)                       |
| `npm run build`            | build produkcyjny do `dist/`                            |
| `npm run balance`          | symulacja balansu, raport w `docs/balance.md`           |
| `npm run balance:missions` | raport balansu misji kampanii w `docs/balance-misje.md` |

## Wdrożenie

Produkcja i podgląd każdego PR idą przez Vercel (integracja z GitHubem): Vercel sam wykrywa Vite, buduje `npm run build` i publikuje `dist/`. Repo nie ma innej konfiguracji hostingu.

## Dokumentacja

- `docs/gdd.md` — projekt gry
- `docs/roadmap.md` — wizja i fazy
- `docs/systems/` — specyfikacje systemów
- `docs/api.md` — kontrakty między modułami
