# System interfejsu („Neon Noir console”)

Etap U1. Projekt i decyzje: `briefs/ui.md` (wizja), `docs/adr/0006-neon-noir.md` (kolory zarezerwowane).

## Tokeny

Jedyny zestaw: `src/ui/theme/tokens.css` (importowany z `styles.css`). Grupy: kolory (`--c-*`), typografia (`--font-*`, `--fs-12…64`), odstępy (`--sp-*`), ruch (`--t-*`, `--slide`), cięcie rogu (`--cut`), skala z-index (`--z-*`).

- Akcent UI = bursztyn (`--c-accent`). Cyan (`--c-player`) tylko dla gracza, czerwień (`--c-enemy`) tylko wrogowie, magenta (`--c-resonance`) tylko Rezonans. Sukces: `--c-success`. „Porażka” i błędy: ciepła biel + bursztyn.
- Fonty lokalnie z `@fontsource` (OFL): Chakra Petch 500/600/700 (nagłówki), Inter 400/500/600 (tekst).
- Stare zmienne `--ui-*`, `--hud-*` (kolory), `--tp-*` są aliasami w tokens.css; ekrany U2/U3 mają przejść na `--c-*`, potem aliasy znikną. `--settings-*` usunięte.
- Skala z-index (jedyna): `--z-hud-aux 12 < --z-panel 90 < --z-meta-bar 92 < --z-map 95 < --z-hud 100 < --z-hud-panel 101 < --z-hud-top 102 < --z-screen 104 < --z-toast 105 < --z-overlay 110 < --z-run-screen 120 < --z-menu-layer 130 < --z-blocking 900 < --z-debug 1000 < --z-boot 1100`. Pasek meta kryjówki leży pod nakładkami stacji.

## Skala interfejsu

`html { font-size: calc(clamp(13px, 1.48vh, 24px) * var(--ui-scale)) }`; wszystkie nowe wymiary w `rem`. Ustawienie „Skala interfejsu” (80–140%, krok 10%) trafia do `Settings.uiScale`, `applyUiSettings` (`theme/applySettings.ts`) ustawia `--ui-scale`, `data-reduce-motion` i `data-fx` na `<html>`. Ekrany kryjówki (U2) są już w rem; w px zostały tylko ekrany runu i HUD trybów (U3). Uwaga: przy 768 px wysokości rem = 13 px (minimum), więc tekst 14 px ma ok. 11,4 px; pomaga skala 110%+.

## Komponenty (`src/ui/theme/components.css` + `src/ui/components/*.ts`)

`uiButton` (primary/secondary/ghost/quiet/destructive bez czerwieni), `createTabs` (strzałki, Home/End, `cycle` dla LB/RB i Q/E), `uiRow` (wiersz listy), `createSlider` (natywny range), `createToggle` (`role=switch`), `createSelect` (własna lista, `inert` na resztę okna), `createStepper` (◀ wartość ▶, `data-pad-adjust`), `uiBadge`, `createProgress`, `attachTooltip`, `uiConfirm` (modal: `aria-modal`, pułapka fokusu `trapFocus`), `createScreen` (nagłówek: ścieżka + tytuł, treść, pasek akcji), `createActionBar`. Klasy: `ui-panel` (ścięty róg, obwódka 1px), `ui-scroll` (własny pasek przewijania; przewijają się tylko listy), `ui-interactive` (hover = fokus: bursztynowa obwódka, jaśniejsze tło, pasek 3px; `:active` skala 0.98).

Kontrolki dla pada: PadNavigation wysyła strzałki lewo/prawo na elementy z `data-pad-adjust`; LB/RB (przyciski 4/5) i Y (3) obsługuje ekran przez `PAD_MENU_INPUT`.

## Pasek akcji

`createActionBar([{ keys: '{confirm}', label, onClick?, end?, decorative? }])`; glify z `inputGlyphs` (`{confirm}`, `{back}`, `{navigate}`, `{tabs}` = Q/E albo LB/RB, `{reset}` = R albo Y) zmieniają się z `input:deviceChanged`. Element z `onClick` jest przyciskiem; `decorative` ukrywa duplikat przed czytnikami.

## Menedżer warstw

`src/ui/layers.ts` (`uiLayers`): `push(root, close, opener)` zwraca funkcję zdejmującą; Esc (B na padzie wysyła Esc) zamyka górną warstwę-panel, a fokus wraca na `opener`. Okna `dialog` zamykają się natywnie (`cancel`), ale też się rejestrują (stos, fokus).

## Dźwięki UI

`src/audio/uiSounds.ts`: proceduralne WebAudio (hover, confirm, back, tab, error, purchase), własny kontekst odblokowywany pierwszą interakcją (`attachUnlock`). Głośność = `masterVolume × uiVolume`. Komponenty wołają `bindUiFeedback`.

## Ustawienia

Nowe klucze `Settings`: `uiScale` (0.8–1.4), `uiVolume` (0–1, domyślnie 0.7), `reduceMotion`. Stare zapisy wczytują się z wartościami domyślnymi (test `uiSystem.test.ts`). Ekran: zakładki Rozgrywka, Grafika, Dźwięk, Sterowanie: klawiatura, Sterowanie: pad, Dostępność; „Przywróć domyślne” (R / Y) resetuje bieżącą zakładkę po potwierdzeniu modalem.

## Ekrany U1

Menu główne (kolumna z lewej na splashartcie; główna akcja Kontynuuj run / Kryjówka; podmenu Tryby; Samouczek mniejszy), ustawienia, pauza, ekran startowy (pasek postępu z etapów `main.ts`), toast naszywek, „Zgłoś problem”/„Sterowanie i zapis”. Zrzuty kontrolne: `briefs/ui-shots-u1/`.

## Kryjówka (U2)

Zrzuty kontrolne: `briefs/ui-shots-u2/` (1920×1080 i 1366×768, skrypt `shots.mjs`).

- **Nagłówek meta** (`src/ui/hub/metaBar.ts`): pełnej szerokości pasek pod górną krawędzią (poziom i XP po lewej, Dane, Rdzenie i wolne punkty po prawej, objaśnienia w dymkach). Dodaje klasę `has-meta-bar` na `<html>`, która ustawia `--meta-bar-h`; ekrany stacji (`.hub-screen`), plan stacji i przewodnik zaczynają się pod nim, więc nic się nie nakłada. Pasek leży w skali z-index poniżej ekranów, ale nie jest przez nie zasłaniany (ekran stacji ma `top: var(--meta-bar-h)`).
- **Ekran stacji** (`hubScreens.ts`): `createScreen` (ścieżka „Kryjówka Iskry”, tytuł stacji, treść, pasek akcji). Panel stacji (`HubPanel`) może podać `actions` (podpowiedzi paska, przed przyciskiem „Zamknij”) i `cycleTab(±1)`; ekran woła `cycleTab` na Q/E i LB/RB. Esc i B zamykają przez `uiLayers` (fokus wraca na element otwierający). Stacja bez panelu (Poligon) to lista trybów z opisami.
- **Warsztat** (`workshopPanel.ts`): trzy kolumny — kategorie (pionowe `createTabs`: Bronie, Dodatki, Wyposażenie, Odblokowania, Wydobycie tylko przy ofertach), lista, podgląd 3D z kartą (statystyki przed/po: ▲ zieleń = lepiej, ▼ bursztyn = gorzej, ◆ = zmiana neutralna; znak i tekst, nie sam kolor). **Zakup zawsze przez modal** (`uiConfirm` z ceną i stanem po zakupie), dźwięk `purchase` po sukcesie, `error` przy braku środków (przyciski zablokowane mają `aria-disabled`, klik tłumaczy powód w linii statusu). Główny przycisk karty jest przyklejony do dołu kolumny. Selektory testów: `data-action="tab"`, `data-key="row:<id>"`, `data-card`, `[data-action="card"]`, `data-pane`.
- **Tablica misji** (`missionsPanel.ts`): karty w grupach Fabuła / Tryby / Run (ikona typu z `missionIcons.ts`, stan, plakietka typu, zagrożenie wybranego poziomu, nagroda za pierwsze ukończenie), bez numeracji. Zablokowana karta ma `aria-disabled` (klik = dźwięk błędu). Po prawej: opis wyboru, kafelki Poziomu zagrożenia 0–10 (pełna nazwa w `title` i tekście dla czytników), seed i „Rozpocznij…”. Odprawa fabularna zastępuje listę kart w kolumnie lewej (`MissionDialogue` w ramce rozmowy).
- **Terminal drzewek** (`talentsPanel.ts`, `talentLayout.ts`): zakładki drzewek (Ostrze, Rezonans, Strzelec, Hybrydy) i Naszywki. Drzewko to graf: kolumny = progi, krawędzie SVG (kupiony → pełna linia w kolorze drzewka, otwarty → bursztyn, zablokowany → kreskowana). Węzeł: zablokowany (przygaszony, kreskowany znacznik), dostępny (bursztynowa obwódka), kupiony (kolor drzewka). Kolory drzewek: Ostrze błękit informacyjny, Rezonans magenta (zarezerwowana), Strzelec bursztyn, Hybrydy fiolet. Klik lub fokus wybiera węzeł, zakup tylko przyciskiem „Kup” w panelu szczegółów. Strzałki klawiatury i pad (nawigacja przestrzenna po przyciskach) przechodzą po węzłach; reset talentów przez modal.
- **Dialogi**: ramka rozmowy NPC (`hubDialog`: imię w bursztynie, rola, kwestia) i odprawa misji (`mission-dialogue*`: pasek w kolorze mówiącego, „Dalej” z glifem) na tokenach; wyborów w dialogach nie ma w danych, więc nie ma listy wyborów.
- **Pozostałe okna**: plan stacji (`hubMap.css`), przewodnik (`hubGuide.css`), podpowiedź interakcji i okienko rozmowy (`hubScreens.css`), szmer NPC (`hubChatter.css`) — wyłącznie tokeny `--c-*` i kroje z tokenów.
- **Implanty** są elementem runu (ekwipunek runu, nagrody) i przechodzą w U3; w kryjówce nie ma osobnego ekranu implantów.

Drobne poprawki U1 w tym etapie: minimalny rozmiar rem 13 px (zamiast 12), pauza pyta modalem o „Wróć do kryjówki” i „Menu główne” (Esc/B anuluje), naprawiony hover/fokus głównego przycisku (`ui-button--primary`), `createTabs({ vertical: true })`, `ActionBarItem.id`, klasa `.ui-sr`.
