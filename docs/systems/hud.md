# Minimalny HUD — F1 #15

`src/ui/hud.ts` tworzy warstwę HTML nad canvasem, bez Three.js i bez odczytu
modułów symulacji. Style są w sekcji `.hud` pliku `src/ui/styles.css`.

## Elementy i zdarzenia

| Element                                                | Zdarzenie                      | Filtr                               |
| ------------------------------------------------------ | ------------------------------ | ----------------------------------- |
| Zdrowie: biały pasek, czerwony akcent, liczba          | `health_changed`               | `id === playerId`                   |
| Energia: cyan, liczba                                  | `energy_changed`               | `id === playerId`                   |
| Ciepło: magenta, liczba, migotanie i tekst przegrzania | `heat_changed`                 | `id === playerId`                   |
| Odmowa mocy pod celownikiem                            | `power_denied`                 | `user === playerId`                 |
| Czerwona winieta trafienia                             | `damage_dealt`                 | `target === playerId`, `amount > 0` |
| Dialog śmierci                                         | `player_died`                  | `id === playerId`                   |
| Licznik fali / komunikat wyczyszczenia                 | `wave_started`, `wave_cleared` | globalne                            |

Paski startują jako puste z liczbą „—”, do pierwszego zdarzenia. Scena powinna
utworzyć HUD przed początkowymi emisjami zdrowia, energii i ciepła albo wyemitować
aktualny stan po jego utworzeniu. `PlayerEnergy` emituje energię, a `Blaster`
ciepło; HUD nie odpytuje tych obiektów. Szerokości są ograniczone do 0–100%;
maksimum równe zero daje pusty pasek. Liczby są zaokrąglane do całości.
Niezmienione szerokości, teksty i stan przegrzania nie zapisują ponownie DOM.

Celownik jest centralnym krzyżykiem z `mix-blend-mode: difference`. Paski mają
ciemne półprzezroczyste tło. Kolory, odstępy i czasy efektów ustawia się przez
zmienne CSS `--hud-*`. Odmowa trwa domyślnie 0,6 s, winieta 0,3 s; kolejne
trafienie lub odmowa restartuje animację, a jej koniec ukrywa element.

Teksty pochodzą z `src/data/ui/hud.pl.json`: `health`, `energy`, `heat`,
`overheated`, `noEnergy`, `cooldown`, `died`, `retry`, `wave`, `waveCleared`.
Powody `no_energy` i `cooldown` mapują się na „Brak energii” i „Odnowienie”.

Dialog ma `role="dialog"` i etykietę „Zginąłeś”. Pokazanie przenosi fokus na
„Jeszcze raz”. Kliknięcie, Enter lub R ukrywa dialog, przywraca poprzedni fokus
i wywołuje opcjonalne `onRetry`. Przytrzymanie klawisza nie ponawia akcji.
Restart stanu gry i obsługę pointer lock zapewnia scena przez istniejący moduł
wejścia; HUD nie przechwytuje myszy. Jedynym elementem przechwytującym klik jest
przycisk ponowienia.

## Integracja w scenie areny

```ts
import { Hud } from '../ui/hud';

// W init, po ustaleniu playerId, przed początkowymi emisjami zasobów:
this.hud = new Hud(ctx.bus, {
  playerId,
  onRetry: () => this.reset(),
});

// W dispose:
this.hud?.dispose();
```

Pole sceny: `private hud?: Hud`. Opcja `root` pozwala zamontować warstwę we
wskazanym elemencie; domyślnie jest to `document.body`. Główny arkusz stylów
musi być załadowany przez aplikację. `dispose()` jest idempotentne: odpina
subskrypcje, zdarzenia klawiatury/przycisku/animacji i usuwa własny DOM.

Komenda weryfikacji integracji: `npm run dev`, następnie `?scene=arena&debug=1`
po zarejestrowaniu areny przez #16. Ręcznie: sprawdź liczby po obrażeniach,
zużycie energii, migotanie przegrzania, komunikaty odmowy i fal, czytelność
celownika na bieli i czerwieni oraz ponowienie po śmierci myszą i klawiaturą.
Scena demonstracyjna nie jest częścią #15.

Testy DOM: `npx vitest run tests/unit/hud.test.ts` (jsdom).
