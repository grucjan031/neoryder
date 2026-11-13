# [F1][UI/UX] Minimalny HUD: zdrowie, energia, ciepło

Agent: UI/UX
Folder: /src/ui
Zależy od: #01 (`health_changed`), #06 (`heat_changed`), #11 (`energy_changed`)
Filar: Czytelny styl wizualny

## Cel

Trzy paski nad canvasem (HTML/CSS) czytelne w stylu gry; agent UI/UX startuje wyjątkowo w F1 tylko z tym zadaniem.

## Wymagania

- Paski: zdrowie (czerwony akcent na białym tle), energia (cyan), ciepło (magenta, migotanie przy przegrzaniu).
- Dane wyłącznie przez zdarzenia EventBus; HUD nie wywołuje modułów gry bezpośrednio.
- Celownik w środku ekranu; wskaźnik przegrzania i krótki wskaźnik odmowy użycia mocy (`power_denied`).
- HTML/CSS na warstwie nad canvasem; bez `three`; aktualizacja DOM tylko przy zmianie wartości.
- Układ i kolory w CSS zmiennych; teksty UI po polsku w pliku danych.
- Ekran śmierci tylko jako placeholder (komunikat i przycisk „Jeszcze raz”) wywoływany przez `player_died`.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

Używa zdarzeń z #01 (`health_changed`, `player_died`), #06 (`heat_changed`), #11 (`energy_changed`, `power_denied`). Nowych zdarzeń nie definiuje.

## Kryteria akceptacji

- [ ] Vitest (jsdom lub czyste funkcje): zdarzenie zmienia szerokość paska proporcjonalnie
- [ ] Vitest: przegrzanie włącza stan `overheated`, powrót go wyłącza
- [ ] Vitest: `player_died` pokazuje ekran śmierci
- [ ] Scena `?scene=hud-test` z suwakami do symulowania zdarzeń
- [ ] Playwright: HUD widoczny w arenie, zrzut ekranu bez nakładania się z celownikiem
- [ ] Aktualizacja /docs/systems/ui.md

## Poza zakresem

Menu, hub, ekrany nagród (F2–F4), ustawienia, paski zdrowia wrogów, wskaźniki obrażeń na ekranie.
