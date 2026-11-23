# ui

Nakładki HTML/CSS, konsola debug i czysty parser komend. Właściciel: UI/UX.
Nie przechowuj stanu rozgrywki w DOM ani nie dodawaj mechanik spoza bieżącej fazy.

## System komponentów (U1)

Tokeny: `theme/tokens.css`, style komponentów: `theme/components.css`, helpery TS: `components/`, menedżer warstw: `layers.ts`, dźwięki: `src/audio/uiSounds.ts`. Nowe ekrany budujemy z tych elementów i tokenów `--c-*` (nie `--ui-*`). Opis: `docs/systems/ui.md`.
