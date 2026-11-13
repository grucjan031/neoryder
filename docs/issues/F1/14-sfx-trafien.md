# [F1][Grafika, VFX i audio] SFX trafień

Agent: Grafika, VFX i audio
Folder: /src/audio
Zależy od: #01 (zdarzenie `damage_dealt`)
Filar: Walka, która „czuje się” świetnie

## Cel

Dźwięki trafień jako trzecia warstwa feedbacku: ostrze, blaster, blok, parowanie, zabójstwo — z wariacjami, żeby nie męczyły.

## Wymagania

- Web Audio API (lub Howler.js), odblokowanie kontekstu audio po pierwszym kliknięciu — wyłącznie w `src/audio/`.
- Zestaw dźwięków: lekkie trafienie, ciężkie trafienie, zabójstwo, blok, parowanie, strzał blastera, przegrzanie, Pchnięcie, lądowanie.
- Mapowanie zdarzeń → dźwięk w pliku danych `src/data/audio/sfx.json` (zod): próbki, głośność, zakres pitch.
- Wariacje: losowy wybór próbki i pitch (kosmetyczny `Rng`, nie symulacyjny); limit równoczesnych głosów (`tuning.audio.maxVoices`).
- Placeholdery CC0 lub syntezowane (oscylatory); głośność główna z `Settings.masterVolume`.
- Dźwięk przestrzenny prosty (pan/odległość) dla trafień wrogów.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

Brak nowych zdarzeń; moduł nasłuchuje: `damage_dealt`, `enemy_killed`, `parry_success`, `weapon_fired`, `heat_changed`, `power_used`, `melee_blocked`, `player_landed` (po ich zatwierdzeniu w #01–#11).

## Kryteria akceptacji

- [ ] Vitest (atrapa AudioContext): zdarzenie wybiera właściwy dźwięk z mapy
- [ ] Vitest: limit głosów nie jest przekroczony, pitch w zakresie z danych
- [ ] Vitest: schemat zod odrzuca mapę z nieznanym zdarzeniem
- [ ] Scena `?scene=sfx-test` z przyciskami lil-gui do odtwarzania każdego dźwięku
- [ ] Playwright: po kliknięciu kontekst audio ma stan `running`
- [ ] Aktualizacja /docs/systems/audio.md

## Poza zakresem

Muzyka i dźwięk reaktywny (F7), miksowanie i ustawienia głośności per kanał, nagrywanie własnych próbek.
