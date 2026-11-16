# HUD — F1 #15, F2-15, nowy HUD

`src/ui/hud.ts` tworzy warstwę HTML nad canvasem, bez Three.js i bez odczytu
modułów symulacji. Style są w `src/ui/hud.css`, importowanym przez `src/ui/styles.css`.

## Styl — wizjer hełmu

HUD to unoszące się holograficzne grupy bez paneli, pełnych teł i ramek.
`frame_*.webp` nie są używane w HUD walki, meta ani podpowiedzi interakcji.
Lokalny Rajdhani (OFL w `public/assets/fonts/Rajdhani-OFL.txt`) daje duże,
wąskie liczby z `tabular-nums`; mikroteksty mają 9 px, wielkie litery
oraz odstęp 0,18 em. Teksty techniczne są w `src/data/ui/hud.pl.json`.

- **Lewy dół:** grupa zdrowia/energii/wytrzymałości ma `rotateY(10deg)` względem zewnętrznej
  krawędzi i perspektywę 1100 px. Cyanowe HP: liczba 32 px, pasek 7 px
  z pionowych kresek (maska `repeating-linear-gradient`). Energia: magenta,
  pasek 4 px i mniejsza liczba. Pod energią wytrzymałość: limonkowy `#c8ff5a`
  kreskowy pasek 4 px, liczba i mikrotekst „MOB // WYTRZYMAŁOŚĆ”. Wyczerpanie
  lub odmowa dashu/skoku daje krótki puls w czasie `--hud-denial-duration`.
  Podkreślenie kończy się rombem. Biały ślad
  obrażeń zostaje na 0,4 s, a potem kurczy się przez 0,4 s. Przy HP ≤ 30%
  (i powyżej zera) pulsuje liczba i pasek, a mikrotekst zmienia się na
  bursztynowe „VIT // KRYTYCZNE”.
- **Prawy dół:** broń jest nad mocami w kolumnie wyrównanej do prawej krawędzi;
  arsenał zachowuje `rotateY(-10deg)`. Szerokość broni to maksymalnie 285 px,
  ograniczona do prawego pasa 18% ekranu z uwzględnieniem marginesu.
  W 1280×720 i 1920×1080 pozostawia to dolny pas 45–80% szerokości wolny
  od grupy broni, poza blaskiem ostrza viewmodelu. Duża nazwa broni jest pochylona
  `skewX(-8deg)`; obok maskowana ikona. Sloty są rombami, aktywny jest pełny.
  Ciepło ma cienkie kreski bursztyn → czerwień. „PRZEGRZANIE” ma jednorazowy
  glitch cyan/magenta o przesunięciu 1–2 px, trwający 0,18 s.
- **Moce:** małe sześciokąty CSS z ikoną Rezonansu, okrągłym znacznikiem F/E
  (19 px), radialnym zaciemnieniem i sekundami odnowienia. Nazwy pozostają
  pod ikonami, brak energii przygasza grupę.
- **Fale i komunikaty:** tekst otoczony poziomymi liniami z gradientem,
  nad nim mikrotekst sektora, pod nim licznik wrogów. Krótkotrwały komunikat
  fali pojawia się pod bossem; toast synergii niżej. Środek walki jest wolny.
- **Prawa góra:** Kredyty jako mikrotekst, ikona, duża liczba i podkreślenie;
  delta ma osobny wiersz. Implanty są małymi rombami z inicjałami i kolorem
  rzadkości; zachowują podpowiedzi z nazwą/opisem.
- **Boss:** nazwa wielkimi literami, czerwony kreskowy pasek 5 px,
  pionowe znaczniki faz oraz biała tarcza 2 px nad paskiem, bez ramki.
- **Celownik:** cyanowa kropka i cztery krótkie kreski CSS z przerwą.
  Trafienie daje cztery ukośne kreski; zabójstwo czerwony błysk.
  Kierunek obrażeń i winiety zachowują dotychczasową funkcję.
- **Meta kryjówki:** oddzielne grupy w lewej górze, bez pełnej belki.
  „ISKRA // OPERATOR”, duży poziom, kreskowy XP; obok Dane i Rdzenie
  z ikonami, liczbami i podkreśleniami. Wolne punkty pulsują, gdy > 0.
  W debug (`import.meta.env.DEV` lub `?debug=1`) lewy margines 108 px
  pozostawia wolne 80×48 px panelu FPS. Selektory i pełne teksty walut
  pozostają dostępne również po rozdzieleniu etykiet i liczb.
- **Podpowiedź kryjówki:** `.hub-prompt` ma okrągły znaczek `kbd` z „E”,
  mikrotekst „INTERAKCJA” z istniejącej etykiety i nazwę stacji z podkreśleniem.

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

## Pauza i ustawienia

`PauseMenu` (`src/ui/pauseMenu.ts`) otwiera się po Esc i utracie fokusu.
`loop.paused=true` zatrzymuje tick symulacji; render pozostaje aktywny.
Wznów (również Esc w menu) zamyka dialog, wznawia pętlę i prosi o pointer lock.
Przy pauzie i zmianie klawiszy wejście czyści przytrzymane akcje. Menu zawiera
Wznów, Ustawienia, Menu główne, a w runie z kryjówki (`loadoutId='custom'`,
także po kontynuacji) również Wróć do kryjówki. Powrót używa tej samej nawigacji
do `?scene=hub` i zachowania `debug=1` co `RunScreens`; nie tworzy nowego zapisu
w środku walki. Kontynuacja korzysta z dotychczasowego checkpointu mapy.

Nie nakładamy pauzy na widoczny interfejs runu (mapa, nagrody, podsumowanie,
sklep, odpoczynek), nakładkę kryjówki, wybór buildu ani ekran śmierci.
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

`SettingsScreen` jest dostępny z menu głównego i pauzy. Zakładki Sterowanie,
Obraz i Dźwięk mają nawigację strzałkami lewo/prawo, Home/End oraz Tab.
Suwaki reagują na klawiaturę; zmiana zapisuje `saveSettings` natychmiast.
Teksty i nazwy akcji: `src/data/ui/settings.pl.json`. Styl wykorzystuje lokalny
Rajdhani, ciemne tło, ciepłą biel i bursztynowy fokus. Długa lista sterowania
przewija się wewnątrz dialogu, zostawiając dostępne zakładki i Wróć.

Klik przypisania przechwytuje następny `KeyboardEvent.code`; Esc anuluje,
Backquote jest zarezerwowany dla konsoli. Nowe przypisanie wypiera starą akcję:
wraca ona do wolnego domyślnego klawisza albo pozostaje bez klawisza, co UI
pokazuje wprost. Pusty string w nadpisaniu utrwala brak klawisza. Mapowanie
myszy pozostaje niezmienione. Przywróć domyślne resetuje zakładkę Sterowanie
(czułość, odwrócenie osi Y i przypisania). Ustawienia są wspólnym obiektem sesji,
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
trwającego. Głośność efektów to master × SFX × dotychczasowy gain audio.
Muzyka i jakość są tylko zapisywane, bez nowych trybów renderowania czy muzyki.

Kontrola w 30 sekund: `/` → Ustawienia → zmień czułość i dash na V → odśwież;
`?scene=room-test&debug=1` → Esc → Ustawienia → Obraz → wyłącz wstrząsy/błyski
→ Wróć → Wznów. Testy: `tests/unit/settings.test.ts`, `tests/e2e/settings.spec.ts`.
Test E2E i ocenę wyglądu na 1280×720 oraz 1920×1080 wykonuje architekt.

## Układ

W arenie LPM — atak/strzał, R — zamiana ostrze/broń, PPM — natychmiast ostrze
i blok, środkowy przycisk — ostrze i rzut, 1/2/3 — slot broni i jej dobycie.
HUD słucha `held_item_changed` dla gracza: `held: 'blade'` dodaje
`.hud__weapon--inactive` (opacity 0,6), `held: 'gun'` ją usuwa. Ciepło i nazwa
wybranego slotu pozostają widoczne. Reset areny publikuje początkowy stan ręki.

| Miejsce              | Elementy                                                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lewy dół             | zdrowie: 10 segmentów cyan + liczba (`.hud__segments`), pod nim pasek energii (magenta)                                                                                                      |
| Prawy dół            | blok broni: nazwa (`.hud__weapon-name`), wskaźnik slotów 1/2/3 (tylko gdy broni > 1), pasek ciepła bursztyn → czerwień, „PRZEGRZANIE” (krótki glitch nad nazwą); obok sześciokąty mocy F i E |
| Góra, środek         | „FALA 3 / 12” i „Wrogowie N”; baner „FALA 3” / „FALA CZYSTA” pojawiający się i znikający; toast synergii (magenta) pod banerem                                                               |
| Środek               | celownik CSS: kropka i cztery kreski, znacznik trafienia, łuk kierunku obrażeń, odmowa mocy pod celownikiem                                                                                  |
| Nad dolnymi panelami | „Ostrze w locie”                                                                                                                                                                             |
| Krawędzie            | czerwona winieta pulsująca po obrażeniach; delikatna przy HP ≤ 30%                                                                                                                           |

Zdrowie: segment i ma wypełnienie `clamp(ratio * 10 - i, 0, 1)` (`data-fill`
na `.hud__seg-fill`). Pod każdym segmentem leży biały „duch” (`.hud__seg-ghost`);
przy utracie HP wypełnienie spada od razu, a duch dochodzi do tej wartości z
opóźnieniem 0,4 s (CSS `transition`). Przy HP ≤ 30% (i powyżej 0) panel zdrowia i winieta `.hud__lowhp` pulsują.

Ciepło: `data-level` na `.hud__meter--heat` to `cool` (< 50%), `warm` (< 80%), `hot`.
Przy `overheated` pojawia się `.hud__overheat` i klasa `hud__meter--overheated`.

Moce: sześciokąt z okrągłym znaczkiem klawisza, nazwą, sekundami odnowienia i radialnym odliczaniem
(`conic-gradient`, zmienna `--cd` = pozostała część odnowienia 0–1, aktualizowana
tylko przy zmianie o 0,01). Brak energii na koszt mocy (`def.cost`) przygasza
sześciokąt (`hud__power--dim`). `power_denied` daje czerwony błysk właściwego sześciokąta
i tekst pod celownikiem. Po końcu odnowienia sześciokąt nie pokazuje tekstu.

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
| Wytrzymałość                       | `stamina_changed`                      | `id === playerId`                   |
| Odmowa dashu/skoku                 | `stamina_denied`                       | `user === playerId`                 |
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
HUD przed początkowymi emisjami zdrowia, energii, wytrzymałości i ciepła albo wyemitować aktualny
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
`document.body`. `setLoadout(loadout)` odtwarza sześciokąty mocy i wskaźnik slotów,
zeruje odnowienia i chowa chwilowe elementy (baner, toast, znaczniki, dialog).
`dispose()` jest idempotentne.

Arena przekazuje do `Hud.step(dt)` czas gracza przed krokiem mocy: odnowienie
zatrzymuje się w hitstopie i pauzie oraz zgadza się z czasem mocy w Skupieniu.
Wyświetla dziesiąte części sekundy.

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
