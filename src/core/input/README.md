# core/input

Mapowanie wejścia, snapshot na krok symulacji oraz obsługa fokusu i blokady myszy. Właściciel: Ruch i kamera / Architekt.
Nie obsługuj pułapek przeglądarki w kontrolerach rozgrywki.

`Input.update(frameDt, gameplayEnabled)` odczytuje Gamepad API raz na
klatkę, również podczas pauzy. Obsługuje kontrolery z mapowaniem `standard`.
Zmiana aktywnego urządzenia emituje `input:deviceChanged`. `activeDevice`
zwraca stan do odczytu synchronicznego, a `padFrame` udostępnia dane
diagnostyce i nawigacji menu.

Akcje, w tym krótkie i długie gesty, są zdefiniowane w
`src/data/inputBindings.json`. Nadpisania i opcje są zapisywane przez
`Settings.gamepad` w localStorage. `snapshot()` przekazuje akcje raz
na krok oraz bieżący wektor ruchu i prędkość obrotu w rad/s.
Strojenie gałek, przytrzymań, celowania i wibracji jest w `tuning.gamepad`.
Scena `?scene=pad-test` pokazuje surowe dane, wynik filtrów, układ i glify.
