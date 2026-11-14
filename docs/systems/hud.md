# HUD — F1 #15, F2-15, nowy HUD

`src/ui/hud.ts` tworzy warstwę HTML nad canvasem, bez Three.js i bez odczytu
modułów symulacji. Style są w sekcji `.hud` pliku `src/ui/styles.css`.

## Styl

Cienkie linie 1–2 px, ścięte narożniki (`clip-path`), monospace. Ciemne
półprzezroczyste tło (`--hud-plate`) jest tylko małą tabliczką pod tekstem i
paskami, by były czytelne na białym świecie; reszta to linie i tekst z
lekkim cieniem. Kolory: biały tekst, cyan = zasoby gracza (energia, aktywny slot),
magenta = moce i ciepło, czerwień = zagrożenie i wrogowie. Kolory, odstępy i czasy
efektów ustawia się przez zmienne CSS `--hud-*`. Animacje używają `transform`
i `opacity` (ciepło używa `clip-path`); czasy animacji HUD są w CSS, nie w
`tuning.ts` (to nie liczby rozgrywki).

## Układ

W arenie LPM — atak/strzał, R — zamiana ostrze/broń, PPM — natychmiast ostrze
i blok, środkowy przycisk — ostrze i rzut, 1/2/3 — slot broni i jej dobycie.
HUD słucha `held_item_changed` dla gracza: `held: 'blade'` dodaje
`.hud__weapon--inactive` (opacity 0,4), `held: 'gun'` ją usuwa. Ciepło i nazwa
wybranego slotu pozostają widoczne. Reset areny publikuje początkowy stan ręki.

| Miejsce      | Elementy                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lewy dół     | zdrowie: 10 skośnych segmentów + liczba (`.hud__segments`), pod nim cienki pasek energii (cyan)                                                                                                   |
| Prawy dół    | blok broni: nazwa (`.hud__weapon-name`), wskaźnik slotów 1/2/3 (tylko gdy broni > 1), pasek ciepła cyan → magenta → czerwień, „PRZEGRZANIE” (migający wiersz nad nazwą); obok kwadraty mocy F i E |
| Góra, środek | „FALA 3 / 12” i „Wrogowie N”; baner „FALA 3” / „FALA CZYSTA” wjeżdżający i znikający; toast synergii (magenta) pod banerem                                                                        |
| Środek       | celownik (kropka + 4 kreski), znacznik trafienia, łuk kierunku obrażeń, odmowa mocy pod celownikiem                                                                                               |
| Dół, środek  | „Ostrze w locie”                                                                                                                                                                                  |
| Krawędzie    | czerwona winieta pulsująca po obrażeniach; słaba stała poniżej 30% HP                                                                                                                             |

Zdrowie: segment i ma wypełnienie `clamp(ratio * 10 - i, 0, 1)` (`data-fill`
na `.hud__seg-fill`). Pod każdym segmentem leży „duch” (`.hud__seg-ghost`) w czerwieni;
przy utracie HP wypełnienie spada od razu, a duch dochodzi do tej wartości z
opóźnieniem 0,4 s (CSS `transition`). Poniżej 30% HP (i powyżej 0) wypełnienie
robi się czerwone, a winieta `.hud__lowhp` pulsuje.

Ciepło: `data-level` na `.hud__meter--heat` to `cool` (< 50%), `warm` (< 80%), `hot`.
Przy `overheated` pojawia się `.hud__overheat` i klasa `hud__meter--overheated`.

Moce: kwadrat z literą klawisza, nazwą, sekundami odnowienia i radialnym odliczaniem
(`conic-gradient`, zmienna `--cd` = pozostała część odnowienia 0–1, aktualizowana
tylko przy zmianie o 0,01). Brak energii na koszt mocy (`def.cost`) przygasza
kwadrat (`hud__power--dim`). `power_denied` daje czerwony błysk właściwego kwadratu
i tekst pod celownikiem. Po końcu odnowienia kwadrat nie pokazuje tekstu.

Znacznik trafienia: biały X przy `damage_dealt` z `source === playerId` i `amount > 0`;
większy czerwony przy `killed`. Celownik rozszerza się na 0,16 s przy `weapon_fired`
gracza.

Kierunek obrażeń: `damage_dealt` z `target === playerId`, `amount > 0`, niepustym
`dir` i `source !== playerId` pokazuje czerwony łuk wokół środka, obrócony w stronę
źródła. Kąt liczy czysta funkcja `damageIndicatorAngle(dir, yaw)` (stopnie
zgodnie z ruchem wskazówek od góry ekranu, `dir` = kierunek lotu ataku). HUD nie zna
kamery, więc scena wywołuje `hud.setViewYaw(yaw)` co klatkę w `render()`; łuk
obraca się razem z widokiem, DOM jest zapisywany tylko przy zmianie zaokrąglonego
kąta. Gdy `dir` jest `null` (np. obrażenia obszarowe), łuk się nie pokazuje.

## Zdarzenia

| Element                            | Zdarzenie                              | Filtr                               |
| ---------------------------------- | -------------------------------------- | ----------------------------------- |
| Zdrowie, winieta niskiego HP       | `health_changed`                       | `id === playerId`                   |
| Energia, przygaszanie mocy         | `energy_changed`                       | `id === playerId`                   |
| Ciepło, przegrzanie                | `heat_changed`                         | `id === playerId`                   |
| Nazwa broni, aktywny slot          | `weapon_switched`                      | `owner === playerId`                |
| Rozszerzenie celownika             | `weapon_fired`                         | `owner === playerId`                |
| Odnowienie mocy                    | `power_cooldown`, `power_used` (Chwyt) | `user === playerId`                 |
| Odmowa mocy                        | `power_denied`                         | `user === playerId`                 |
| Winieta, łuk kierunku              | `damage_dealt`                         | `target === playerId`, `amount > 0` |
| Znacznik trafienia / zabójstwa     | `damage_dealt`                         | `source === playerId`, `amount > 0` |
| Fala, baner                        | `wave_started`, `wave_cleared`         | globalne                            |
| Pozostali wrogowie                 | `wave_started.count`, `enemy_killed`   | globalne (licznik schodzi do 0)     |
| Toast synergii (nazwa z definicji) | `synergy_triggered`                    | `user === playerId`                 |
| Ostrze w locie                     | `blade_thrown`, `blade_returned`       | `owner === playerId`                |
| Dialog śmierci                     | `player_died`                          | `id === playerId`                   |

Paski startują puste z liczbą „—”, do pierwszego zdarzenia. Scena powinna utworzyć
HUD przed początkowymi emisjami zdrowia, energii i ciepła albo wyemitować aktualny
stan po jego utworzeniu. HUD nie odpytuje symulacji. Niezmienione wartości,
teksty i stany nie zapisują ponownie DOM. Liczby są zaokrąglane do całości,
szerokości ograniczone do 0–100%.

Teksty pochodzą z `src/data/ui/hud.pl.json`. Łącznej liczby fal nie ma w
zdarzeniach, więc scena podaje opcję `totalWaves`; bez niej napis to „FALA 3”.

## Ekran śmierci i wybór buildu

Dialog ma `role="dialog"` i etykietę „Zginąłeś”. Pokazanie przenosi fokus na
„Jeszcze raz”. Kliknięcie, Enter lub R ukrywa dialog, przywraca poprzedni fokus
i wywołuje opcjonalne `onRetry`. Przytrzymanie klawisza nie ponawia akcji. Gdy
scena poda `onChangeBuild`, obok jest „Zmień build” (magenta); Enter i R nadal
oznaczają „Jeszcze raz”. Przyciski i karty ekranu wyboru buildu
(`.build-select*`) używają tego samego języka: ciemne tło, cienkie linie, ścięte
narożniki, cyan i magenta. Struktura DOM ekranu buildu jest w `src/ui/buildSelect.ts`.

## Integracja w scenie areny

```ts
this.hud = new Hud(ctx.bus, {
  playerId,
  loadout: this.loadout,
  totalWaves: waves.waves.length,
  onRetry: () => this.reset(),
});

// W render(), po ustawieniu kamery:
this.hud?.setViewYaw(pose.yaw);

// W step(): this.hud?.step(playerDt) — odliczanie odnowień; w dispose(): this.hud?.dispose();
```

Opcja `root` pozwala zamontować warstwę we wskazanym elemencie; domyślnie jest to
`document.body`. `setLoadout(loadout)` odtwarza kwadraty mocy i wskaźnik slotów,
zeruje odnowienia i chowa chwilowe elementy (baner, toast, znaczniki, dialog).
`dispose()` jest idempotentne.

Arena przekazuje do `Hud.step(dt)` czas gracza przed krokiem mocy: odnowienie
zatrzymuje się w hitstopie i pauzie oraz zgadza się z czasem mocy w Skupieniu.
Wyświetla dziesiąte części sekundy.

## Kontrola w 30 sekund

`?scene=arena&loadout=gunner&debug=1`: sprawdź segmenty zdrowia po obrażeniach,
ciepło i „PRZEGRZANIE” przy długim ogniu, sloty 1/2/3 (klawisze 1–3), znacznik
trafienia i licznik wrogów (`hit 5`, `kill all`), baner fali (`wave 3`). Wpisz
`loadout resonance`: kwadraty F/E z odliczaniem, przygaszenie przy braku energii.
Oceń czytelność na białym tle i czy HUD nie zasłania pola gry.

Testy DOM: `npx vitest run tests/unit/hud.test.ts` (jsdom).

## HUD runu (F3-15)

`src/ui/runHud.ts` (`RunHud`) jest tworzony przez `Hud` i montowany w jego
warstwie. Wszystkie elementy mają `hidden`, dopóki nie nadejdzie zdarzenie, więc
Arena wygląda jak dotąd. Teksty: `src/data/ui/hud.pl.json`
(`credits`, `implants`, `bossHealth`).

- **Kredyty** (prawy górny róg): panel pojawia się po pierwszym
  `currency_changed`; pokazuje `amount`, a `delta` wyświetla się krótko pod
  licznikiem (`+N` cyan, `−N` magenta).
- **Implanty** (pod Kredytami): kafelek z inicjałami nazwy i ramką w kolorze
  rzadkości (common szary, rare cyan `#00e5ff`, epic magenta `#ff2bd6`,
  legendary złoty). Podpowiedź (`title`) zawiera nazwę i opis z definicji.
  `implant_acquired` ze `source: 'upgrade'` zastępuje w rzędzie implant, którego
  `upgradesTo` wskazuje nowe id (zamiast dodawać drugi kafelek).
- **Pasek HP bossa** (góra, środek, pod plakietką fali): `boss_spawned` pokazuje
  nazwę i pełny pasek; `health_changed` dla id bossa ustawia wypełnienie;
  `boss_phase` rysuje `phases - 1` kresek w równych odstępach (kreski pojawiają
  się dopiero po pierwszym `boss_phase`, bo `boss_spawned` nie niesie liczby
  faz) i uruchamia krótki błysk; `enemy_killed` lub `entity_despawned` z id
  bossa chowa pasek.
- **Nowy pokój:** `Hud` jest tworzony od nowa w każdym pokoju, więc opcja
  `run: { credits, implants }` odtwarza licznik i rząd implantów ze stanu runu
  (przekazuje ją `RoomScene`).

Kontrola: `?scene=room-test`, komendy `credits`, `implant <id>`; test:
`npx vitest run tests/unit/runHud.test.ts`.

## Menu i mapa sektora — F3-13

Bez `?scene=` produkcja pokazuje `MainMenu` (`src/ui/mainMenu.ts`). W trybie
debug (`?debug=1` lub serwer dev) pozostaje dotychczasowa lista scen.
Nowy run otwiera istniejący BuildSelect i przechodzi do
`?scene=run&seed=…&loadout=…`; puste pole generuje seed przez Web Crypto.
Wybór dotyczy buildu z przypisanym ostrzem: dodatkowy wybór wariantu ostrza
jest ukryty, ponieważ RunState przechowuje loadoutId, a nie nadpisanie ostrza.
Arena / poligon prowadzi do `?scene=arena`. Kontynuuj jest nieaktywne podczas
odczytu, bez zapisu i przy błędzie IndexedDB; zapis udostępnia warstwę oraz HP.
Kontynuacja przechodzi do `?scene=run&continue=1`.

`MapScreen` (`src/ui/mapScreen.ts`, style `mapScreen.css`) rysuje pełną mapę:
warstwa 1 na dole, boss u góry, połączenia SVG za przyciskami. Symbole i legenda
odróżniają typy; elita i boss są czerwone, bieżący węzeł ma cyanową ramkę,
odwiedzone mają przerywaną krawędź, dostępne są podświetlone.
Dostępność pochodzi z next bieżącego węzła, na początku z pierwszej warstwy.
Pozostałe przyciski są disabled. Kliknięcie i 1/2/3 wybierają dostępny węzeł;
Enter wybiera przycisk z fokusem lub pierwszy dostępny. Tab + Enter pozwala
wybrać także czwarty węzeł. Pola tekstowe, modyfikatory i powtórzenia klawiszy
nie uruchamiają akcji. Ukrycie i dispose odłączają obsługę mapy.
Teksty menu, mapy, symbole i nazwy statusów są w `src/data/ui/run.pl.json`,
walidowane zod przy imporcie. Wymiary grafu są prezentacją CSS, bez liczb symulacji.

Domyślny `RunSavePort` (`src/ui/runSave.ts`) opakowuje IndexedDB SaveStore v2.
RunScene zapisuje pełen RunState przy wejściu na mapę, czyści przy run_ended;
kolejka gwarantuje, że zaległy zapis nie odtworzy zakończonego runu.
`continue=1` ładuje zapis i wywołuje restore, odtwarzając mapę, węzeł i zasoby.
Błędy zapisu są dostępne jako query('saveError'), zgodnie z istniejącym RunScene.
Po udanym zapisie na mapie RunScene zamienia URL przez history.replaceState
na continue=1 (usuwa seed/loadout, zachowuje debug). Dzięki temu odświeżenie
mapy oraz odświeżenie podczas walki wznawia ostatni zapis mapy.

Kontrola w 30 sekund: produkcyjne `/` → wpisz seed → Nowy run → build → mapa.
Sprawdź układ i podświetlenie, wybierz węzeł przez mysz lub 1/2/3 / Enter.
`?scene=run&seed=menu-test&debug=1`: `run clear` po wejściu do walki,
Dalej po nagrodzie → mapa; `/` → Kontynuuj ma zachować bieżący węzeł i zasoby.
Sprawdź czytelność grafu przy czterech węzłach i wąskim oknie.

Testy: jsdom `mainMenu.test.ts`, `mapScreen.test.ts`, `runScreens.test.ts`;
`runScene.test.ts` testuje domyślny adapter z fake-indexeddb, zapis po pokoju,
odtworzenie pełnego stanu i usunięcie zapisu. Playwright `mainMenu.spec.ts`
obejmuje nowy run oraz fixture mapy z Kredytami i implantem dla kontynuacji
oraz odświeżenia. Test listy scen w sandbox.spec.ts używa teraz `/?debug=1`;
asercje listy i istniejące sceny z `?scene=` pozostają bez zmian.

Ekrany runu pokazują karty implantów z rzadkością, opisem, tagami i nowo aktywowanymi synergiami. Sklep blokuje nieopłacalne zakupy, a odpoczynek pokazuje dostępną następną rzadkość. Obsługa: mysz, 1/2/3 i Enter; sceną kontrolną jest `?scene=run`.

HUD bossa rysuje kreski faz z boss_spawned.phaseThresholds (ułamki HP paska), widoczne od pojawienia się bossa. boss_shield aktualizuje pasek wytrzymałości, widoczny tylko przy aktywnej tarczy.
