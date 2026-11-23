# System interfejsu („Neon Noir console”)

Etap U1. Projekt i decyzje: `briefs/ui.md` (wizja), `docs/adr/0006-neon-noir.md` (kolory zarezerwowane).

## Tokeny

Jedyny zestaw: `src/ui/theme/tokens.css` (importowany z `styles.css`). Grupy: kolory (`--c-*`), typografia (`--font-*`, `--fs-12…64`), odstępy (`--sp-*`), ruch (`--t-*`, `--slide`), cięcie rogu (`--cut`), skala z-index (`--z-*`).

- Akcent UI = bursztyn (`--c-accent`). Cyan (`--c-player`) tylko dla gracza, czerwień (`--c-enemy`) tylko wrogowie, magenta (`--c-resonance`) tylko Rezonans. Sukces: `--c-success`. „Porażka” i błędy: ciepła biel + bursztyn.
- Fonty lokalnie z `@fontsource` (OFL): Chakra Petch 500/600/700 (nagłówki), Inter 400/500/600 (tekst).
- Stare zmienne `--ui-*`, `--hud-*` (kolory), `--tp-*` są aliasami w tokens.css; ekrany U2/U3 mają przejść na `--c-*`, potem aliasy znikną. `--settings-*` usunięte.
- Skala z-index (jedyna): `--z-hud-aux 12 < --z-panel 90 < --z-meta-bar 92 < --z-map 95 < --z-hud 100 < --z-hud-panel 101 < --z-hud-top 102 < --z-screen 104 < --z-toast 105 < --z-overlay 110 < --z-run-screen 120 < --z-menu-layer 130 < --z-blocking 900 < --z-debug 1000 < --z-boot 1100`. Pasek meta kryjówki leży pod nakładkami stacji.

## Skala interfejsu

`html { font-size: calc(clamp(12px, 1.48vh, 24px) * var(--ui-scale)) }`; wszystkie nowe wymiary w `rem`. Ustawienie „Skala interfejsu” (80–140%, krok 10%) trafia do `Settings.uiScale`, `applyUiSettings` (`theme/applySettings.ts`) ustawia `--ui-scale`, `data-reduce-motion` i `data-fx` na `<html>`. Starsze ekrany w px nie skalują się (U2/U3). Uwaga: przy 768 px wysokości rem = 12 px, więc tekst 14 px ma ok. 10,5 px; pomaga skala 120%+.

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
