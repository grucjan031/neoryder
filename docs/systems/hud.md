# HUD — F1 #15, F2-15, nowy HUD

## Kryjówka: przewodnik i objaśnienia — S10-01

Osobny `.hub-guide` (`data-hub-guide`, `data-target`) pokazuje bursztynową
strzałkę i odległość u góry na środku, pod paskiem meta. Teksty i tytuły stacji
pochodzą z `meta.pl.json`; reguły celu i ukrywania opisuje `hub.md`.
Nie przechwytuje wskaźnika, strzałka dekoracyjna ma `aria-hidden`.

Dane, Rdzenie i punkty talentów na pasku meta mają własne dymki z objaśnieniem
(hover i fokus klawiatury, `tabindex="0"`, `aria-describedby`). Gdy stacja jest
otwarta, pasek leży nad jej warstwą. Szczegóły i jednorazowe objaśnienie po
pierwszym runie: `hub.md`. Teksty są w `missions.pl.json.bar`.

## Wersja, sterowanie, zgłoszenia

Menu pokazuje wersję z `package.json` i krótki hash Git (bez Git: `dev`).
Pauza dodaje seed i scenę bieżącej gry: `main.ts` przekazuje dostawcę danych
(seed użyty przez `Rng`, dla runu seed ze stanu runu, `scene.id`), więc
seed jest widoczny także bez `?seed` w adresie.
„Sterowanie i zapis” czyta `inputBindings.json` oraz aktualne przypisania
z `loadSettings()` / `resolveBindings()`. Opis przypomina, że wyczyszczenie
danych przeglądarki usuwa zapis. Osobny dialog pozostawia pauzę otwartą;
Esc wraca do pauzy i oddaje fokus bez wznowienia gry ani pointer lock.
„Zgłoś problem” jest aktywny od razu i kopiuje wersję, build, seed, scenę,
userAgent, rozmiar okna i datę ISO; gdy schowek odmawia, pokazuje zaznaczone
pole do skopiowania. Adres zgłoszeń i teksty pochodzą z `aboutDemo.json`
(zod). Stopka i nakładka używają tokenów UI z `styles.css`.
Kontrola: `?scene=arena` → wybór zestawu → Esc → obie nowe akcje → Esc.
Testy: `buildInfo.test.ts` i `aboutDemo.spec.ts` (arena z seedem i bez,
odmowa schowka).

`src/ui/hud.ts` tworzy warstwę HTML nad canvasem, bez Three.js i bez odczytu
modułów symulacji. Style są w `src/ui/hud.css`, importowanym przez `src/ui/styles.css`.
Korzeń `.hud` jest `position: fixed; inset: 0; z-index: 100`, bez zdarzeń wskaźnika
(poza przyciskami ekranu śmierci i podpowiedziami implantów), z `perspective: 1100px`,
czcionką Rajdhani 500 14 px, `tabular-nums`, rozstrzeleniem 0,06 em i cieniem
`0 1px 3px #000, 0 0 9px #00e5ff45`. Zmienne korzenia: `--hud-health #00e5ff`,
`--hud-energy #ff2bd6`, `--hud-stamina #c8ff5a`, `--hud-heat #ff2bd6`,
`--hud-warm #ffae1a`, `--hud-danger #e0262b`, `--hud-text #edf7ff`,
`--hud-inset clamp(26px, 3vw, 58px)`, `--hud-denial-duration 0.6s`,
`--hud-damage-duration 0.35s`, `--hud-ticks` (maska kresek: czarny 2 px, przezroczysty 2 px).

Opcje `Hud` (`HudOptions`): `playerId` (wymagane), `loadout` (`weapons`, `powers`),
`totalWaves`, `root`, `onRetry`, `onChangeBuild`, `run` (stan do odtworzenia Kredytów
i implantów), `threats` + `threatOrigin` (wskaźniki zagrożeń), `deathScreen: false`
(nie pokazuje ekranu śmierci; ustawiane w misjach liniowych), `showWaves: false`
(ignoruje `wave_started`/`wave_cleared`, brak licznika i banera). Dodatkowe
metody: `setViewYaw(rad)`, `setAim(0–1)`, `setExecuteHint(bool)`, `step(dt)`,
`setLoadout`, `dispose`.

## Styl — wizjer hełmu

### S10-01: zapowiedzi ataków

Opcjonalne `HudOptions.threats` dostarcza snapshoty `{ id, removed, current:
{ position, state, stateTimeS } }`, a `threatOrigin` pozycję gracza. Arena i RoomScene
czytają je przez `EnemyManager.forEach` i `player.getState()`. Obrót pochodzi
z istniejącego `setViewYaw(pose.yaw)`. Rodzaj i czas trwania zapowiedzi dostarcza
`enemy_telegraph`; postęp to `stateTimeS / durationS`, więc respektuje czas świata.
Nieaktywny stan, usunięcie wroga lub koniec czasu usuwa sygnał.

`threatIndicator.ts` wybiera maksymalnie cztery najbliższe zagrożenia w promieniu
22 m (odległość 3D), poza poziomym stożkiem ±40°. Kąt względem przodu i prawej
kamery obraca wskaźnik wokół celownika: prawo +90°, tył 180°. Nie bada przesłon
ani pionowego pola widzenia. Strzałka czerwona oznacza atak wręcz, podwójna
bursztynowa — `heavy`, cienka czerwona linia z wypełnieniem — `aim`.
Jasność rośnie bez migania. Powrót do stożka ukrywa wskaźnik.

EnemyView dla `telegraph` z `PIERCE_BLOCK_TAG` klonuje materiały wizjera,
końcówki pałki/ostrza i rdzenia per siatka. Bursztyn przechodzi do ciepłej bieli
w ostatnich 30% zapowiedzi. Po przerwaniu/końcu, wymianie modelu i `dispose()`
wracają dokładne referencje oryginalnych materiałów, a klony są zwalniane.
Puls ma mnożnik 2; `loadSettings().flashes === false` daje stałą skalę.
Kolory, końcowa frakcja, mnożnik pulsu, promień, półkąt i limit są w `tuning.vfx`
i automatycznie pojawiają się w panelu debug. Czasy ataków pozostają bez zmian.

Wskaźnik w DOM: pusty element o szerokości 0 w środku ekranu obrócony o kąt,
a w nim znacznik 56×26 px (`heavy` 56×40, `aim` 76×7 z paskiem postępu) w odległości
`clamp(90px, 30vmin, 320px)` od celownika. Przezroczystość `0,7 + 0,3 × postęp`,
skala `0,85 + 0,3 × postęp`, czarny kontur. Kolor: atak wręcz `tuning.render.enemy`;
`heavy` `tuning.vfx.heavyTelegraphColor` (`#ffd27a`), przechodzący w
`heavyTelegraphEndColor` (`#fff4dc`) w ostatnich `heavyTelegraphEndFraction` (0,3)
zapowiedzi. Parametry wyboru: `threatRadiusM 22`, `threatHalfAngleDeg 40`,
`threatMaxIndicators 4`. Wskaźniki działają tylko, gdy scena poda `threats`;
liczą się wrogowie w stanie `telegraph` lub `aim`, a wpisy znikają razem z końcem stanu.

Kontrola ręczna: `?scene=arena&debug=1`, wybierz build, otwórz konsolę debug,
wykonaj `god`, `kill all`, `look 0`, `spawn executor 1`, `look 180`.
Po zamknięciu konsoli wróg podejdzie od tyłu i rozpocznie `heavy`.
`look 0` pozwala obejrzeć bursztynowe elementy modelu i znikanie wskaźnika.
`spawn gunner 1` pozwala sprawdzić celowanie. `ai-test` ma `spawn`, ale nie ten HUD;
`melee-test` służy do manekinów, więc pełny test sygnałów wykonuj na arenie.

HUD to unoszące się holograficzne grupy bez paneli, pełnych teł i ramek.
`frame_*.webp` nie są używane w HUD walki, meta ani podpowiedzi interakcji.
Lokalny Rajdhani (OFL w `public/assets/fonts/Rajdhani-OFL.txt`; pliki
`Rajdhani-Medium.ttf` 500 i `Rajdhani-SemiBold.ttf` 600–800) daje duże,
wąskie liczby z `tabular-nums`; mikroteksty mają 9 px, wielkie litery,
odstęp 0,18 em i kolor `#8faebc`. Teksty techniczne są w `src/data/ui/hud.pl.json`.
Ikony to maski kolorowane `background-color` (`public/assets/ui/hud/icon_gun.webp`,
`icon_blade.webp`, `icon_power.webp`, `icon_credits.webp`, `icon_data.webp`,
`icon_cores.webp`). Duże liczby zdrowia i Kredytów mają delikatną maskę skanowania
(`repeating-linear-gradient(0deg, #000 0 3px, #000c 3px 4px)`).

- **Lewy dół:** grupa (`.hud__vitals`, szerokość 340 px, 290 px poniżej 1000 px)
  zakotwiczona `--hud-inset` od lewej i dołu, ma `rotateY(10deg)` względem lewej
  krawędzi. Każdy miernik to siatka: etykieta/pasek po lewej, liczba po prawej
  (kolumna 110 px, odstęp 15 px). Mikrotekst nad zdrowiem „VIT // SYNC 100%”.
  Cyanowe HP: liczba 32 px „aktualne / maks”, pasek 7 px z 10 segmentów i pionowych
  kresek (maska `--hud-ticks`), tło segmentu `#00e5ff20`. Energia: magenta,
  mikrotekst „REZONANS // ENERGIA”, pasek 4 px (tło `#ffffff16`) i liczba 18 px.
  Pod energią wytrzymałość: limonkowy `#c8ff5a`
  kreskowy pasek 4 px, liczba 18 px i mikrotekst „MOB // WYTRZYMAŁOŚĆ”. Wzrost
  energii daje biały błysk paska 0,24 s (krycie 0,7→0); spadek wytrzymałości do 0
  lub `stamina_denied` daje błysk limonkowy w czasie `--hud-denial-duration`, a
  `stamina_denied` pokazuje też napis „Brak wytrzymałości” pod celownikiem.
  Podkreślenie (gradient `#00e5ff90`→`#00e5ff20`, 1 px) kończy się cyanowym rombem 5 px. Biały ślad
  obrażeń zostaje na 0,4 s, a potem kurczy się przez 0,4 s. Przy HP ≤ 30%
  (i powyżej zera) pulsuje cały miernik zdrowia (animacja 1,2 s, alternate, do
  krycia 0,55), a mikrotekst zmienia się na
  bursztynowe (`--hud-warm`) „VIT // KRYTYCZNE”.
- **Prawy dół:** broń jest nad mocami w kolumnie (odstęp 28 px, 20 px poniżej 1000 px)
  wyrównanej do prawej krawędzi;
  arsenał zachowuje `rotateY(-10deg)` względem prawej krawędzi. Szerokość broni to
  `min(285px, 18vw − inset)` (245 px poniżej 1000 px).
  W 1280×720 i 1920×1080 pozostawia to dolny pas 45–80% szerokości wolny
  od grupy broni, poza blaskiem ostrza viewmodelu. Duża nazwa broni (28 px, wielkie litery, pochylona
  `skewX(-8deg)`; słowo dłuższe niż 8 znaków zmniejsza krój do 21 px) stoi obok maskowanej ikony
  broni 34×28 px (cyan). Sloty 1/2/3 są rombami 8 px (ramka `#00e5ff85`), aktywny jest pełny cyan; widoczne tylko
  przy ≥ 2 broniach (maks. 3). Nagłówek broni przygasa na 0,86 jasności raz na
  8,6 s (klatki 94–96% cyklu). Mikrotekst nad bronią: „ARM // UZBROJENIE”. Gdy w ręku jest
  ostrze (`held_item_changed.held === 'blade'`), cały blok broni ma krycie 0,6.
  Ciepło ma cienkie kreski (pasek 4 px): gradient `--hud-warm` `#ffae1a` (do 30%) → `#e0262b`, liczba 15 px
  (przy poziomie `hot` kolor `#ff6266`); w stanie przegrzania pasek jest cały `#e0262b`.
  „PRZEGRZANIE” (17 px, `#ff6266`, nad paskiem) ma jednorazowy
  glitch: cyan i magenta kopie tekstu przesunięte o 1–2 px, trwający 0,18 s (3 kroki).
  Dla dobytego blastera napis pokazuje fazę aktywnego chłodzenia. W idealnym oknie
  zmienia się w cyanowy komunikat „[G] Chłodź teraz” z aktualnie przypisanym klawiszem.
  Wynik próby pokazuje „Blokada skrócona” albo „Blokada wydłużona”.
- **Moce:** dwa sloty (klawisze „F” i „E”, `powerKeys`) w rzędzie z odstępem 16 px (10 px
  poniżej 1000 px) pod mikrotekstem „REZONANS // MOCE”. Slot 68 px: sześciokąt 56×58 px
  (wierzchołki 25%/75% góra i dół, tło `#ff2bd61c`, wewnętrzna płytka `#07152280`),
  ikona Rezonansu 30 px magenta (krycie `1 − 0,8 × --cd`), okrągły znacznik klawisza 19 px
  (ramka `#ff2bd6a0`, tło `#08131b`, tekst `#ffb6f3`, 13 px) w prawym górnym rogu,
  radialne zaciemnienie (`conic-gradient`, `#020914db`), sekundy odnowienia 18 px na środku
  oraz nazwa mocy 10 px pod spodem. Slot bez mocy ma krycie 0,4 i nazwę „—”. Brak energii
  lub zagłuszenie (`status_applied` `jammed` na graczu) przygasza slot (krycie 0,4);
  zagłuszenie dodatkowo pokazuje „ZAGŁUSZONE” pod nazwą.
- **Fale i komunikaty:** `.hud__wave` (góra, środek, `top: 25px`, min. 220 px):
  nad tekstem mikrotekst „SEKTOR KUROGANE // FALA”, tekst „FALA n / N” 25 px, otoczony
  poziomymi liniami 65 px z gradientem cyan, pod nim „Wrogowie k” 10 px (`#b2c7d2`).
  Krótkotrwały baner fali (`top: 180px`, 28 px, 1,9 s: wejście z −8 px, pełne krycie
  w 14–70%, zanik) pojawia się pod bossem; „FALA CZYSTA” jest cyan. Toast synergii
  (`top: 240px`, 16 px, magenta, 1,8 s) niżej. Środek walki jest wolny. Baner i toast mają
  maks. szerokość `min(520px, 65vw)`.
- **Prawa góra:** Kredyty (`top`/`right` = `--hud-inset`, `rotateY(-10deg)`, min. 145 px):
  mikrotekst „Kredyty”, ikona 25 px (`--hud-warm`), duża liczba 32 px `#ffe2a9` i podkreślenie
  (gradient `#ffae1a10`→`#ffae1aaa`); delta ma osobny wiersz pod spodem (15 px, 1,2 s).
  Implanty (`top: inset + 112px`, szer. maks. 220 px, odstęp 13 px, wyrównane do prawej)
  są rombami 20×20 px z inicjałami (maks. 2 litery; inicjały słów nazwy, dla jednego
  słowa — dwie pierwsze litery) i kolorem rzadkości (patrz „HUD runu”); mają
  podpowiedź z nazwą i opisem, nowy implant błyska poświatą 0,5 s. Mikrotekst „IMPLANTY // AKTYWNE”
  stoi 17 px nad rzędem.
- **Boss:** patrz „HUD runu”: nazwa wielkimi literami 18 px, czerwony kreskowy pasek
  10 px ze ściętymi narożnikami, przerwy w miejscu progów faz oraz biała tarcza 3 px
  nad paskiem.
- **Celownik:** cyanowa kropka 2 px i cztery kreski 1×5 px (przesunięcie 7 px od środka
  w dół/w prawo i 12 px w górę/w lewo) z przerwą, cień czarny. Strzał rozszerza kreski
  (skala 1,6 → 1) w 0,16 s. Celowanie (`setAim`, 0–1) zbliża kreski: skala `1 − 0,45 × aim`;
  przy `aim ≥ 0,5` krycie kresek 0,85.
  Trafienie (`damage_dealt` gracza w cel) daje cztery ukośne białe kreski 2×7 px (0,22 s);
  zabójstwo — czerwone (`#e0262b`, poświata) o skali 1,6 przez 0,45 s.
  Pod środkiem, 32 px niżej, podpowiedź „[LPM] Wykończ” (14 px, `--hud-health`),
  widoczna, gdy gracz trzyma ostrze (nie w locie) i ma wykonalny cel wykończenia
  (`setExecuteHint`). Napisy odmowy mocy i wytrzymałości (`.hud__denial`, `top: 50% + 40px`,
  `#ff6266`, wielkie litery, 0,6 s) pojawiają się pod celownikiem.
  Kierunek obrażeń i winiety zachowują dotychczasową funkcję (łuk: okrąg 250 px, wycinek 60°
  od środka, ramka 3 px `#e0262b`, 1,1 s; winieta obrażeń: `inset box-shadow 14vmin 3vmin`
  `#e0262b`, 0,35 s; winieta niskiego HP: `inset 8vmin #e0262b28`, pulsuje 1,4 s do 0,55).
- **Meta kryjówki** (`src/ui/hub/metaBar.ts`, `.meta-bar`, `position: fixed`,
  `top: 26px; left: 32px`, `z-index: 90`, wiersz z zawijaniem, odstępy 22/32 px, maks. szerokość
  `100vw − 100px`, `rotateY(10deg)` grup): oddzielne grupy w lewej górze, bez pełnej belki.
  Tożsamość (210 px, 170 px poniżej 900 px): „ISKRA // OPERATOR” 9 px, „POZIOM n” 32 px cyan, kreskowy
  pasek XP 4 px (cyan na `#00e5ff20`) i tekst „x / y XP” (11 px, `#a0b8c6`; na
  maks. poziomie „MAX”). Obok Dane (ikona bursztyn `#ffae1a`, wartość 28 px `#ffe1a3`,
  podkreślenie bursztyn) i Rdzenie (ikona magenta `#ff2bd6`, wartość `#ffb6f3`) z
  etykietami 9 px „Dane:”/„Rdzenie:”. Wolne punkty: „Punkty talentów: n” (12 px; `#92a8b8`, a
  przy n > 0 kolor `#ffcf77` i pulsowanie do krycia 0,55 w 1,6 s, romb pełny).
  Pasek odświeża się po zdarzeniach `meta_rewards`, `level_up`, `talents_changed`,
  `unlock_purchased`, `loadout_changed`, `threat_selected`.
  W debug (`import.meta.env.DEV` lub `?debug=1`) lewy margines 108 px
  pozostawia wolne 80×48 px panelu FPS. Selektory i pełne teksty walut
  pozostają dostępne również po rozdzieleniu etykiet i liczb.
- **Podpowiedź kryjówki:** `.hub-prompt` (`fixed`, środek, `bottom: 22%`, `z-index: 90`, wejście 0,18 s
  z przesunięciem 8 px) ma okrągły znaczek `kbd` 28 px z „E” (ramka `#00e5ff90`, tekst cyan),
  mikrotekst (9 px, `#8faebc`) z podpisem (domyślnie „INTERAKCJA”, dla NPC imię)
  i nazwę stacji 18 px wielkimi literami; pod całością linia gradient cyan→przezroczysty.
  Ukryta, gdy nie ma celu lub otwarta jest nakładka.

Poświata jest lokalna. Skanowanie jest delikatną maską dużych liczb, a nie
nakładką na ekran. Jedna grupa (nagłówek broni) ma krótkie, subtelne osłabienie
jasności co 8,6 s; nie używa losowości ani czasu symulacji. `prefers-reduced-motion`
wyłącza glitch, pulsowanie, migotanie, skanowanie, poświatę i przesuwanie komunikatów.
Skończone animacje zachowują `animationend`, by usuwać komunikaty po ich czasie.
Czasy efektów są w CSS; nie zmieniają liczb rozgrywki w `tuning.ts`.

Układ jest ograniczony szerokościami grup i przeznaczony dla 1280×720 oraz
1920×1080. Poniżej 1000 px grupy się zwężają, poniżej 760 px zmienia się kolejność
w kolumnie arsenału i znika pochylenie. Kontrola ręczna: `?scene=room-test&room=combatYard&loadout=classic&debug=1`,
`?scene=boss-test&debug=1`, `?scene=hub&debug=1`; zrzuty ocenia manager.

## Wspólny język interfejsu

Tokeny w `src/ui/styles.css` (`:root`, prefiks `--ui-`): font Rajdhani dla
wszystkich ekranów, cyan tylko dla elementów gracza i fokusu, magenta dla
Rezonansu, czerwień dla zagrożenia; informacje (Kredyty, podpowiedzi) bursztyn,
leczenie zieleń, hybrydy i synergie fiolet. Panele (menu, pauza, ustawienia,
ekrany runu, stacje kryjówki) mają tę samą ramkę z narożnikami (`--ui-frame`),
małą etykietę nad tytułem (np. `ISKRA // WSTRZYMANO`) i wielkie litery w
nagłówkach. Mikroanimacje wejścia trwają 160–240 ms i są wyłączane przez
`prefers-reduced-motion`.

Wartości tokenów: `--ui-cyan #00e5ff`, `--ui-magenta #ff2bd6`, `--ui-danger #e0262b`
(tekst `--ui-danger-text #ff6b6f`), `--ui-amber #ffae1a`, `--ui-violet #8a5cff`
(tekst `#ad92ff`), `--ui-blue #3d7bff` (tekst `#7aa4ff`), `--ui-green #6dff4a`,
`--ui-warm #fff1d6`, `--ui-text #edf7ff`, `--ui-muted #a9bccb`, `--ui-faint #7d93a3`,
`--ui-bg #040810`, `--ui-panel rgba(6,12,24,.92)`, `--ui-panel-solid #070d1a`,
`--ui-raise rgba(12,22,38,.9)`, `--ui-line rgba(0,229,255,.22)`,
`--ui-line-strong rgba(0,229,255,.6)`, `--ui-focus` (ramka 1 px `--ui-bg` + 3 px cyan),
`--ui-in 200ms cubic-bezier(.2,.8,.2,1)`; `--ui-frame` rysuje cyanowe narożniki
(ramiona 14 px, linia 1 px), `--ui-scan` to poziome linie `rgba(0,229,255,.025)` co 3 px.
Podpowiedź utraty pointer locka: środek ekranu, szer. `min(420px, 100vw − 32px)`, tło
`#0b1220`, tekst `#fff1d6` 20 px, ramka 1 px `#ffae1a`, po najechaniu tło `#302719`.

## Pauza i ustawienia

`PauseMenu` (`src/ui/pauseMenu.ts`) otwiera się po Esc i utracie fokusu.
`loop.paused=true` zatrzymuje tick symulacji; render pozostaje aktywny.
Wznów (również Esc w menu) zamyka dialog, wznawia pętlę i prosi o pointer lock.
Przy pauzie i zmianie klawiszy wejście czyści przytrzymane akcje. Pauza zatrzymuje też
dźwięk (`syncAudioPause`). Menu (tytuł „Pauza”) zawiera w tej kolejności: Wznów, Ustawienia,
Wróć do kryjówki (tylko w scenie `mission` oraz w scenie `run` z `loadoutId='custom'`,
także po kontynuacji) i Menu główne (`/`). Powrót używa tej samej nawigacji
do `?scene=hub` i zachowania `debug=1` (oraz trybu lite FX) co `RunScreens`; nie tworzy nowego zapisu
w środku walki. Kontynuacja korzysta z dotychczasowego checkpointu mapy.

Nie nakładamy pauzy na widoczny interfejs: `.run-screen`, `.hub-screen`, `.build-select`,
`.hud__death` (jeśli nie ukryte) oraz `[data-mission-summary][open]` (mapa, nagrody,
podsumowanie, sklep, odpoczynek, nakładki kryjówki, wybór buildu, ekran śmierci,
podsumowanie misji, menu ulepszeń).
Widoczna konsola debug zachowuje własne sterowanie. Menu pauzy obsługuje
strzałki góra/dół, Tab i Enter. Natywne dialogi modalne utrzymują fokus w UI.
Globalny `Input` mapuje klawiaturę na akcje również bez pointer locka.
Warunek `isEditing()` blokuje akcje przy otwartym dialogu modalnym albo gdy
cel zdarzenia lub `document.activeElement` jest kontrolką UI (pole formularza,
przycisk, link, `[contenteditable]`) lub leży wewnątrz otwartego dialogu,
widocznego `[role="dialog"]`, `.run-screen`, `.hub-screen`, `.sector-map`
lub `.build-select`. Obejmuje to mapę, nagrody, podsumowanie, nakładki kryjówki,
pauzę i ustawienia. W UI przypisanie np. dash do Tab nie blokuje nawigacji:
nie zapisuje akcji ani nie wywołuje `preventDefault()`.
Ruch myszy obraca kamerę wyłącznie przy pointer locku własnego canvasu.

Odmowa pointer lock (odrzucona obietnica, wyjątek lub `pointerlockerror`)
pokazuje na środku ekranu „Kliknij w grę, aby przechwycić mysz”. Tekst pochodzi
z `src/data/ui/input.pl.json`, styl `pointerLockHint.css` nawiązuje do pauzy.
Kliknięcie komunikatu ponawia prośbę; kliknięcie canvasu nadal wznawia grę.
Komunikat znika po `pointerlockchange` z własnym canvasem. `Input.dispose()`
usuwa go wraz z listenerami; spóźniona odmowa po sukcesie lub dispose nie
przywraca komunikatu. Sam brak pointer locka nie blokuje klawiszy gry.
Testy jsdom: `tests/unit/pointerLockHint.test.ts`.

`SettingsScreen` jest dostępny z menu głównego i pauzy (zamknięcie wraca do pauzy).
Zakładki Sterowanie, Obraz i Dźwięk mają nawigację strzałkami lewo/prawo, Home/End oraz Tab.
Suwaki reagują na klawiaturę; zmiana zapisuje `saveSettings` natychmiast. Zawartość:
Sterowanie — lista „Poziom trudności” (Łatwy/Normalny/Trudny/Koszmar, domyślnie Normalny;
działa od następnego runu), „Czułość myszy” (0,1–5, krok 0,1, domyślnie 1), „Odwróć oś Y”,
przypisania wszystkich akcji (kolejność: ruch przód/tył/lewo/prawo, skok, sprint, doskok,
przysiad/ślizg, atak/strzał, blok, celowanie, zamiana ostrze/broń, moc 1, moc 2/interakcja,
broń 1–3, rzut ostrzem, plan stacji, menu ulepszeń) i „Przywróć domyślne”; Obraz —
„Pole widzenia (FOV)” (60–110, krok 1, domyślnie `tuning.camera.fov` = 90), „Wstrząsy kamery”
(0–100%, domyślnie 100%), „Błyski ekranu” (domyślnie włączone), „Jakość grafiki”
(Niska/Średnia/Wysoka, domyślnie Wysoka, stosowana na bieżąco); Dźwięk — „Głośność główna”
(domyślnie 100%), „Efekty dźwiękowe” (100%), „Muzyka” (70%), wszystkie 0–100% co 1%.
Domyślne klawisze (`src/data/inputBindings.json`): W/S/A/D ruch, Spacja skok, Shift
sprint, Q doskok, Ctrl przysiad/ślizg, R zamiana ostrze/broń, F moc 1, E moc 2 i
interakcja, 1/2/3 broń, M plan stacji, Tab menu ulepszeń; mysz: LPM atak/strzał,
środkowy rzut ostrzem, PPM blok/celowanie.
Teksty i nazwy akcji: `src/data/ui/settings.pl.json`. Styl wykorzystuje lokalny
Rajdhani, ciemne tło, ciepłą biel i bursztynowy fokus. Długa lista sterowania
przewija się wewnątrz dialogu, zostawiając dostępne zakładki i Wróć.

Klik przypisania przechwytuje następny `KeyboardEvent.code`; Esc anuluje,
Backquote jest zarezerwowany dla konsoli. Nowe przypisanie wypiera starą akcję:
wraca ona do wolnego domyślnego klawisza albo pozostaje bez klawisza, co UI
pokazuje wprost. Pusty string w nadpisaniu utrwala brak klawisza. Mapowanie
myszy pozostaje niezmienione. Przywróć domyślne resetuje zakładkę Sterowanie
(czułość do 1, odwrócenie osi Y i przypisania; poziom trudności pozostaje). Ustawienia są wspólnym obiektem sesji,
więc kontroler, wejście i efekty korzystają z aktualnych wartości; szczegóły w API.

`flashes=false` wyłącza trzy pełnoekranowe efekty: impuls obrażeń `PostFxState`
(w tym debug `fx damage`), winietę trafienia `.hud__damage` oraz burzę
(`skyFlash` w końcowej kompozycji `outline.ts`, zarówno oprawa miejska,
jak i `city-fx-test`). Wskaźnik kierunku obrażeń, celownik i miejscowe efekty
broni pozostają czytelne. Dodatkowo winieta niskiego HP pozostaje statyczna:
klasa `.hud--no-flashes` na korzeniu HUD wyłącza jej `hud-pulse` i ustawia
stałe opacity 0,55. Klasa synchronizuje ustawienie przy utworzeniu HUD,
w `step()` (także przy dt=0) oraz w `setViewYaw()` wywoływanym przez render,
również podczas pauzy i bez zmiany kąta kamery. Zmiana nie wymaga kolejnego
`health_changed`; ponowne włączenie błysków przywraca pulsowanie.
Testy regresji: `inputZ12.test.ts`, `hudAccessibilityZ12.test.ts`.
`screenShake=0` zeruje amplitudę wstrząsu, także
trwającego. Głośność efektów to `tuning.audio.masterGain` × master × SFX
(`AudioSystem.updateVolume`); głośność muzyki jest mnożona dodatkowo przez
master (szczegóły: `audio.md`). Jakość grafiki zmienia ustawienia oprawy na bieżąco.
Po każdej zmianie w ustawieniach wejście czyści przytrzymane akcje, FOV kamery
przyjmuje `settings.fov` i odświeża się głośność.

Kontrola w 30 sekund: `/` → Ustawienia → zmień czułość i dash na V → odśwież;
`?scene=room-test&debug=1` → Esc → Ustawienia → Obraz → wyłącz wstrząsy/błyski
→ Wróć → Wznów. Testy: `tests/unit/settings.test.ts`, `tests/e2e/settings.spec.ts`.
Test E2E i ocenę wyglądu na 1280×720 oraz 1920×1080 wykonuje architekt.

## Układ

W arenie LPM — atak/strzał, R — zamiana ostrze/broń, PPM — blok z ostrzem,
celowanie z bronią (celownik się zwęża), środkowy przycisk — rzut ostrzem, 1/2/3 — slot broni i jej dobycie.
HUD słucha `held_item_changed` dla gracza: `held: 'blade'` dodaje
`.hud__weapon--inactive` (opacity 0,6), `held: 'gun'` ją usuwa. Ciepło i nazwa
wybranego slotu pozostają widoczne. Reset areny publikuje początkowy stan ręki.

| Miejsce              | Elementy                                                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lewy dół             | zdrowie: 10 segmentów cyan + liczba (`.hud__segments`), pod nim pasek energii (magenta)                                                                                                      |
| Prawy dół            | blok broni: nazwa (`.hud__weapon-name`), wskaźnik slotów 1/2/3 (tylko gdy broni > 1), pasek ciepła bursztyn → czerwień, „PRZEGRZANIE” (krótki glitch nad nazwą); obok sześciokąty mocy F i E |
| Góra, środek         | „FALA 3 / 12” i „Wrogowie N”; baner „FALA 3” / „FALA CZYSTA” pojawiający się i znikający; toast synergii (magenta) pod banerem                                                               |
| Środek               | celownik CSS: kropka i cztery kreski, znacznik trafienia, łuk kierunku obrażeń, odmowa mocy pod celownikiem                                                                                  |
| Nad dolnymi panelami | „Ostrze w locie” (ikona ostrza, cyan, 12 px, środek ekranu, `bottom: inset + 140px`)                                                                                                         |
| Krawędzie            | czerwona winieta pulsująca po obrażeniach; delikatna przy HP ≤ 30%                                                                                                                           |

Zdrowie: segment i ma wypełnienie `clamp(ratio * 10 - i, 0, 1)` (`data-fill`
na `.hud__seg-fill`). Pod każdym segmentem leży biały „duch” (`.hud__seg-ghost`);
przy utracie HP wypełnienie spada od razu, a duch dochodzi do tej wartości z
opóźnieniem 0,4 s (CSS `transition`). Przy HP ≤ 30% (i powyżej 0) panel zdrowia i winieta `.hud__lowhp` pulsują.

Ciepło: `data-level` na `.hud__meter--heat` to `cool` (< 50%), `warm` (< 80%), `hot` (≥ 80%).
Przy `overheated` pojawia się `.hud__overheat` i klasa `hud__meter--overheated`.

Moce: sześciokąt z okrągłym znaczkiem klawisza, nazwą, sekundami odnowienia i radialnym odliczaniem
(`conic-gradient`, zmienna `--cd` = pozostała część odnowienia 0–1, aktualizowana
tylko przy zmianie o 0,01). Brak energii na koszt mocy (`def.cost`) przygasza
sześciokąt (`hud__power--dim`). `power_denied` daje czerwony błysk (0,4 s, `#e0262b90`)
właściwego sześciokąta i tekst pod celownikiem wg `reason`: `no_energy` „Brak energii”,
`cooldown` „Odnowienie”, `jammed` „ZAGŁUSZONE”, `too_heavy` „Za ciężki”, `out_of_range`
„Za daleko”. Po końcu odnowienia sześciokąt nie pokazuje tekstu. Chwyt (`power_used` mocy
`grab`) zeruje odliczanie i pokazuje „Trzymanie” aż do `power_cooldown` po puszczeniu.

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

| Element                            | Zdarzenie                                                                                         | Filtr                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Zdrowie, winieta niskiego HP       | `health_changed`                                                                                  | `id === playerId`                            |
| Energia, przygaszanie mocy         | `energy_changed`                                                                                  | `id === playerId`                            |
| Wytrzymałość                       | `stamina_changed`                                                                                 | `id === playerId`                            |
| Odmowa dashu/skoku                 | `stamina_denied`                                                                                  | `user === playerId`                          |
| Ciepło, przegrzanie                | `heat_changed`                                                                                    | `id === playerId`                            |
| Nazwa broni, aktywny slot          | `weapon_switched`                                                                                 | `owner === playerId`                         |
| Rozszerzenie celownika             | `weapon_fired`                                                                                    | `owner === playerId`                         |
| Odnowienie mocy                    | `power_cooldown`, `power_used` (Chwyt)                                                            | `user === playerId`                          |
| Odmowa mocy                        | `power_denied`                                                                                    | `user === playerId`                          |
| Winieta, łuk kierunku              | `damage_dealt`                                                                                    | `target === playerId`, `amount > 0`          |
| Znacznik trafienia / zabójstwa     | `damage_dealt`                                                                                    | `source === playerId`, `amount > 0`          |
| Fala, baner                        | `wave_started`, `wave_cleared`                                                                    | globalne                                     |
| Pozostali wrogowie                 | `wave_started.count`, `enemy_killed`                                                              | globalne (licznik schodzi do 0)              |
| Toast synergii (nazwa z definicji) | `synergy_triggered`                                                                               | `user === playerId`                          |
| Ostrze w locie                     | `blade_thrown`, `blade_returned`                                                                  | `owner === playerId`                         |
| Dialog śmierci                     | `player_died` (`cause`)                                                                           | `id === playerId`                            |
| Zagłuszenie slotów mocy            | `status_applied`, `status_expired`                                                                | `target === playerId`, `status === 'jammed'` |
| Wskaźniki zapowiedzi               | `enemy_telegraph` (`kind`, `durationS`)                                                           | tylko z opcją `threats`                      |
| Kredyty, implanty                  | `currency_changed`, `implant_acquired`                                                            | globalne                                     |
| Pasek bossa                        | `boss_spawned`, `boss_phase`, `boss_shield`, `health_changed`, `enemy_killed`, `entity_despawned` | po id bossa                                  |
| Przygaszenie bloku broni           | `held_item_changed`                                                                               | `owner === playerId`                         |

Paski startują puste z liczbą „—”, do pierwszego zdarzenia. Scena powinna utworzyć
HUD przed początkowymi emisjami zdrowia, energii, wytrzymałości i ciepła albo wyemitować aktualny
stan po jego utworzeniu. HUD nie odpytuje symulacji. Niezmienione wartości,
teksty i stany nie zapisują ponownie DOM. Liczby są zaokrąglane do całości,
szerokości ograniczone do 0–100%.

Teksty pochodzą z `src/data/ui/hud.pl.json`. Łącznej liczby fal nie ma w
zdarzeniach, więc scena podaje opcję `totalWaves`; bez niej napis to „FALA 3”.

## Ekran śmierci i wybór buildu

Dialog ma `role="dialog"` i etykietę „Zginąłeś”. Pełny ekran (tło radialne
`#0a0d14d9`→`#0a0d14f2`, kolumna wyśrodkowana, odstęp 28 px): tytuł „ZGINĄŁEŚ”
(44 px, `#e0262b`, rozstrzelenie 0,36 em, po bokach linie gradient czerwony), linia
„Przyczyna: …” i linia „Wskazówka: …” (`defeatMessage(cause)` z `player_died.cause`,
kolor `#c8d6e2`, maks. 42 rem; patrz `textClarity.md`), przyciski. Pokazanie przenosi fokus na
„Jeszcze raz”. Kliknięcie, Enter lub R (przechwytywane na `window` w fazie przechwytywania)
ukrywa dialog, przywraca poprzedni fokus
i wywołuje opcjonalne `onRetry`. Przytrzymanie klawisza nie ponawia akcji. Gdy
scena poda `onChangeBuild`, obok jest „Zmień zestaw” (ramka i tekst magenta; przyciski ze
ściętymi narożnikami 10 px, 13 px, rozstrzelenie 0,2 em, tło `#0a0d14`, po najechaniu
wypełnienie magentą); Enter i R nadal
oznaczają „Jeszcze raz”. Enter na zogniskowanym „Zmień zestaw” oraz klawisze wpisywane
w polu lub oknie modalnym (np. konsoli debug) nie są przechwytywane. Przyciski i karty ekranu wyboru buildu
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
`document.body`. `setLoadout(loadout)` odtwarza sześciokąty mocy i wskaźnik slotów,
zeruje odnowienia i chowa chwilowe elementy (baner, toast, znaczniki, dialog).
`dispose()` jest idempotentne.

Arena przekazuje do `Hud.step(dt)` czas gracza przed krokiem mocy: odnowienie
zatrzymuje się w hitstopie i pauzie oraz zgadza się z czasem mocy w Skupieniu.
Wyświetla dziesiąte części sekundy („1.4 s”). `setViewYaw` i `step` odświeżają też
klasę `hud--no-flashes`.

## Kontrola w 30 sekund

`?scene=arena&loadout=gunner&debug=1`: sprawdź segmenty zdrowia po obrażeniach,
ciepło i „PRZEGRZANIE” przy długim ogniu, sloty 1/2/3 (klawisze 1–3), znacznik
trafienia i licznik wrogów (`hit 5`, `kill all`), baner fali (`wave 3`). Wpisz
`loadout resonance`: sześciokąty F/E z odliczaniem, przygaszenie przy braku energii.
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
- **Implanty** (pod Kredytami): kafelek (romb 20 px) z inicjałami nazwy i ramką w kolorze
  rzadkości (common szary `#9aa0a6`, rare cyan `#00e5ff`, epic magenta `#ff2bd6`,
  legendary złoty `#ffc400`; tło 12% koloru). Powtórne `implant_acquired` tego samego id jest ignorowane. Podpowiedź (`title`) zawiera nazwę i opis z definicji.
  `implant_acquired` ze `source: 'upgrade'` zastępuje w rzędzie implant, którego
  `upgradesTo` wskazuje nowe id (zamiast dodawać drugi kafelek).
- **Pasek HP bossa** (`BossBar`, `src/ui/bossBar.ts`; góra, środek, `top: clamp(18px, 3.2vh, 30px)`,
  szerokość `min(580px, 46vw)`): `boss_spawned` pokazuje nagłówek („ZAGROŻENIE // SYGNAŁ” po lewej,
  licznik faz „Faza I / III” cyframi rzymskimi po prawej), nazwę wielkimi literami
  (18 px, rozstrzelenie 0,2 em, po bokach linie czerwone), pasek i resetuje stan. Pasek: 10 px,
  ścięte narożniki 6 px, kreskowe tło, wypełnienie czerwone (`#ff5a52` górne 45%, reszta `#e0262b`,
  poświata `#ff4a1c`), z opóźnionym „duchem” `#ffd2c4` (krycie 0,75, zejście 0,55 s po 0,28 s).
  `health_changed` dla id bossa ustawia wypełnienie (stosunek 0–1).
  Progi faz: `boss_spawned.phaseThresholds` (ułamki zdrowia do stracenia) rysują od razu
  `phases − 1` przerw 3 px w pasku (pozycja `(1 − próg)` od lewej; pasek ubywa od prawej);
  `phases = phaseThresholds.length + 1`. `boss_phase` ustawia licznik faz, błysk paska
  (0,7 s; jasność 3,2) i powiększenie licznika, a na czas `tuning.enemies.phaseShiftS`
  (1 s) pokazuje komunikat „Osłona fazowa // nietykalny” (mruga, przy ograniczonym
  ruchu świeci stale). W fazie 3 wypełnienie pulsuje jasnością (0,9 s). `boss_shield`
  pokazuje nad paskiem cienki biały pasek wytrzymałości tarczy (3 px, kreskowy) tylko gdy
  `current > 0`. Zapowiedź wejścia (pomijana w `fx=lite`): przez `tuning.vfx.bossIntroS` (1,7 s)
  pasek jest powiększony 1,55× w górnej tercji (21vh), „ładuje się” i wraca na miejsce.
  `enemy_killed` z id bossa chowa pasek i pokazuje stempel „ZAGROŻENIE // ZNEUTRALIZOWANE” /
  „Sygnał utracony” + przekreślona nazwa przez `tuning.vfx.bossDeathFxS + 0,6` s (1,7 + 0,6 s);
  `entity_despawned` chowa pasek bez stempla. Przy wyłączonych błyskach znikają rozjaśnienia paska.
  Poniżej 760 px pasek ma `top: 120px`, szerokość `100vw − 32px`. Scena `boss-test` używa
  samego paska (`mountBossBar`, korzeń `.hud.hud--boss-only`).
- **Nowy pokój:** `Hud` jest tworzony od nowa w każdym pokoju, więc opcja
  `run: { credits, implants }` odtwarza licznik i rząd implantów ze stanu runu
  (przekazuje ją `RoomScene`).

Kontrola: `?scene=room-test`, komendy `credits`, `implant <id>`; test:
`npx vitest run tests/unit/runHud.test.ts`.

## Menu i mapa sektora — F3-13

Bez `?scene=` pokazywany jest `MainMenu` (`src/ui/mainMenu.ts`): tytuł „NEORYDER”,
podtytuł „Wybierz swoją ścieżkę przez sektor.”, „Samouczek”, „Kryjówka”, „Kontynuuj run”,
linia statusu zapisu, „Poligon”, „Ustawienia”. W trybie debug (`?debug=1` lub serwer dev) dochodzą:
pole seeda, „Nowy run (presety)” i „Sceny debug” (lista scen pod `?scenes=1`). Poza debugiem
nie ma przycisku Nowy run (run startuje z kryjówki). Nowy run otwiera istniejący BuildSelect
i przechodzi do
`?scene=run&seed=…&loadout=…`; puste pole generuje seed przez Web Crypto.
Status zapisu: „Odczytywanie zapisu…”, „Brak zapisanego runu”, „Warstwa: n · Zdrowie: hp”,
a przy zakończonym runie komunikaty o rozliczeniu nagrody lub „Nie można odczytać zapisu.”.
Wybór dotyczy buildu z przypisanym ostrzem: dodatkowy wybór wariantu ostrza
jest ukryty, ponieważ RunState przechowuje loadoutId, a nie nadpisanie ostrza.
Arena / poligon prowadzi do `?scene=arena`. Kontynuuj jest nieaktywne podczas
odczytu, bez zapisu i przy błędzie IndexedDB; zapis udostępnia warstwę oraz HP.
Kontynuacja przechodzi do `?scene=run&continue=1`.

`MapScreen` (`src/ui/mapScreen.ts`, style `mapScreen.css`) rysuje pełną mapę:
warstwa 1 na dole, boss u góry, połączenia SVG za przyciskami. Węzły wyglądają
jak stacje na planie metra: typ rozpoznajesz po kształcie znacznika i kolorze
(walka — koło, elita — czerwony romb, sklep — bursztynowy kwadrat, odpoczynek —
zielone koło z plusem, zagadka — fioletowe koło przerywane, boss — czerwony
sześciokąt) oraz po podpisie, a legenda używa tych samych znaczników. Bieżący
węzeł ma wypełniony cyanowy znacznik, dostępne pulsują cyanowym pierścieniem
z płynącą przerywaną krawędzią, droga z bieżącej pozycji do bossa jest
jaśniejsza (`is-reachable`), a węzły poza nią przygaszone (`is-off-route`).
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

Ekrany runu pokazują karty implantów z rzadkością, opisem, tagami i nowo aktywowanymi synergiami. Rzadkość widać od razu: kolor górnej krawędzi i poświaty karty (rare `#3d7bff`, epic `#8a5cff`, legendary `#ffae1a`; pospolita neutralna) oraz kształt znacznika przy nazwie rzadkości (pospolity — koło, rzadki — kwadrat, epicki — romb, legendarny — gwiazda). Tagi ścieżek są chipami z nazwą ścieżki (Ostrze cyan, Moc magenta, Strzelec bursztyn), cena w sklepie to bursztynowy chip, który robi się czerwony, gdy brakuje Kredytów. Pierwsze trzy przyciski mają podpowiedź klawisza 1/2/3 rysowaną przez CSS (`content: attr(data-key) / ''`, bez wpływu na nazwę dostępną). Nakładka runu leży nad HUD (`z-index` 120), a animacja wejścia gra tylko przy zmianie ekranu (`run-screen--enter`), żeby odświeżenia (np. Kredyty) nie migały. Sklep blokuje nieopłacalne zakupy, a odpoczynek pokazuje dostępną następną rzadkość. Obsługa: mysz, 1/2/3 i Enter; sceną kontrolną jest `?scene=run`.

## Menu ulepszeń (Tab w runie)

`RunInventoryMenu` (`src/ui/runInventory.ts`, teksty `src/data/ui/inventory.pl.json`)
otwiera się akcją `inventory` (domyślnie Tab) w trakcie walki. Wstrzymuje pętlę
(`loop.paused`), zwalnia pointer lock i ma klasę `run-screen`, więc menu pauzy nie
nakłada się na nie. Zamykają je ten sam klawisz, Tab, Esc lub przycisk „Wróć do gry”
(wznowienie przez `ctx.resume`). Panel „Menu ulepszeń” pokazuje: Kredyty,
„Implanty (n)” (nazwa, etykieta rzadkości Zwykły/Rzadki/Epicki/Legendarny, opis;
pusto: „Brak implantów. Zdobywaj je w nagrodach, sklepach i na odpoczynku.”),
„Synergie (n)” (aktywne; pusto: „Brak aktywnych synergii.”), „Moce” i „Broń i moduły”
(ostrze oraz bronie z modułami: `nazwa: opis`, albo „bez modułów”). Opisy mocy i synergii
pochodzą z `descriptions.pl.json`. Stopka: „Tab lub Esc: wróć do gry”. Węzeł DOM
istnieje tylko w czasie otwarcia.

## Splasharty i porady ładowania

Nakładka startowa (`#boot-splash`; na czas wyświetlania `#app` jest `inert`; zdejmowana
wygaszeniem 320 ms, a bez niego przy `fx=lite` i `prefers-reduced-motion`) i ładowanie pokoju
w runie pokazują obraz pełnoekranowy, a w prawym górnym rogu (16 px od krawędzi, szer. `min(560px, 100% − 32px)`,
tło gradient `rgba(2,4,9,.94)`→`.78`, tekst `#fff1d6`) podpis obrazu (tytuł wpisu) i poradę z `src/data/ui/loadingTips.pl.json`. Dane zawierają
40 wpisów `{ text, kind: 'gameplay' | 'lore' }` oraz `labels` z nagłówkami
„Porada” i „Neo-Ryd”. Leniwa walidacja zod wyłącza porady przy błędnych danych.
Wybór przez `hashSeed(klucz) mod liczba wpisów`: klucz to `scena:seed` (`menu` bez sceny), w pokoju run + seed + id węzła.
Co `tuning.ui.loadingTipS` (domyślnie 7 s, także w lil-gui) pojawia się kolejny
wpis (po kolei, z zawinięciem; zanik 0,4 s). Nagłówek porady (12 px, `#ffae1a`) to etykieta
rodzaju, treść 14–17 px. Wygaszenie, ukrycie, błąd obrazu i dispose sprzątają timer.
Tekst dekoracyjny ma `aria-hidden`, ciepłą biel, bursztynowy nagłówek i ciemny
gradient pod spodem. Pasek przy napisie ładowania sygnalizuje pracę.
`prefers-reduced-motion` wyłącza animację zmiany i paska; `fx=lite` wyłącza
obrazy, porady i pasek splashu.

`pickSplash(maxAct = 1, all = getSplashes(), random = Math.random)` wybiera
jednostajnie losowo spośród wszystkich odblokowanych splashartów (`entry.act <= maxAct`),
bez powtórzenia ostatnio wybranego obrazu, gdy pula ma co najmniej 2 obrazy
(pamięć w zmiennej modułu). Opcjonalne pola `scenes`, `rooms` i `themes` w
`src/data/ui/splash.json` pozostają w danych i schemacie jako metadane, ale
nie wpływają na wybór. Domyślny generator `Math.random` jest tu dozwolony jako
kosmetyka UI poza symulacją.

Splasharty nie zdradzają fabuły: każdy wpis ma wymagane `act` (1 prolog, akt I
i neutralne, 2 akt II, 3 akt III, 4 epilog), a `pickSplash` bierze pod uwagę
wyłącznie `act <= maxAct`. `unlockedSplashAct` wyznacza akt z ukończonych misji
kampanii lub (przy pustej kampanii) ze zwycięstw w meta-zapisie i progów
`tuning.ui.splashActVictories` (domyślnie 0/1/3/5); brak lub błąd zapisu daje
akt 1. Nakładka startowa nie czeka z uruchomieniem gry: gdy `maxAct` jest liczbą,
obraz montuje się od razu; gdy jest obietnicą (odczyt z IndexedDB, najdłużej po
`tuning.ui.splashMetaTimeoutMs`), montuje się po jej rozwiązaniu, a przy błędzie
z aktem 1.

Kontrola: `/`, `?scene=hub`, `?scene=arena`, `?scene=tutorial` i `?scene=run`.
Przy spowolnionym ładowaniu sprawdź czytelność i zmianę porady po 7 s;
test jsdom `splash.test.ts` sprawdza rotację zegarem pozorowanym.
