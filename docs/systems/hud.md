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

| Miejsce | Elementy |
| --- | --- |
| Lewy dół | zdrowie: 10 skośnych segmentów + liczba (`.hud__segments`), pod nim cienki pasek energii (cyan) |
| Prawy dół | blok broni: nazwa (`.hud__weapon-name`), wskaźnik slotów 1/2/3 (tylko gdy broni > 1), pasek ciepła cyan → magenta → czerwień, „PRZEGRZANIE” (migający wiersz nad nazwą); obok kwadraty mocy F i E |
| Góra, środek | „FALA 3 / 12” i „Wrogowie N”; baner „FALA 3” / „FALA CZYSTA” wjeżdżający i znikający; toast synergii (magenta) pod banerem |
| Środek | celownik (kropka + 4 kreski), znacznik trafienia, łuk kierunku obrażeń, odmowa mocy pod celownikiem |
| Dół, środek | „Ostrze w locie” |
| Krawędzie | czerwona winieta pulsująca po obrażeniach; słaba stała poniżej 30% HP |

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

| Element | Zdarzenie | Filtr |
| --- | --- | --- |
| Zdrowie, winieta niskiego HP | `health_changed` | `id === playerId` |
| Energia, przygaszanie mocy | `energy_changed` | `id === playerId` |
| Ciepło, przegrzanie | `heat_changed` | `id === playerId` |
| Nazwa broni, aktywny slot | `weapon_switched` | `owner === playerId` |
| Rozszerzenie celownika | `weapon_fired` | `owner === playerId` |
| Odnowienie mocy | `power_cooldown`, `power_used` (Chwyt) | `user === playerId` |
| Odmowa mocy | `power_denied` | `user === playerId` |
| Winieta, łuk kierunku | `damage_dealt` | `target === playerId`, `amount > 0` |
| Znacznik trafienia / zabójstwa | `damage_dealt` | `source === playerId`, `amount > 0` |
| Fala, baner | `wave_started`, `wave_cleared` | globalne |
| Pozostali wrogowie | `wave_started.count`, `enemy_killed` | globalne (licznik schodzi do 0) |
| Toast synergii (nazwa z definicji) | `synergy_triggered` | `user === playerId` |
| Ostrze w locie | `blade_thrown`, `blade_returned` | `owner === playerId` |
| Dialog śmierci | `player_died` | `id === playerId` |

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
