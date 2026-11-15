# Kryjówka (hub) — F4-07

Grywalna kryjówka komórki ruchu oporu „Iskra” w nieczynnej stacji metra: scena `?scene=hub`
(`src/scenes/hub.ts`, `HubScene`). Gracz chodzi kontrolerem FPP (ruch, skok, dash, ślizg) bez wrogów, fal i systemów
walki; ręce pokazują ostrze plazmowe w spoczynku (`FppViewModel` z nieruchomym `BladeView`). Wejście w strefę
stacji otwiera nakładkę UI. Decyzje: `docs/adr/0007-meta-progres-f4.md` pkt 10, styl: `docs/adr/0006-neon-noir.md`.

## Układ i dane

- `src/data/hub/hideout.json`, walidowany przez `src/world/hubSchema.ts` (`loadHubLayout`). Format pokoju:
  `playerSpawn`, `blocks` (`material`, `model` `city_*`), pola oprawy z `dressingSchema` (`theme`, `signs`, `lights`,
  `decals`, `ambientFx`, `decor`) plus pola kryjówki:
  - `blocks[].interactive: true` — jasny obiekt interaktywny (materiał `interactive`, #d9dde3);
  - `stations: { id, position {x,z}, radius, label, sign? }[]` — `id` z `HUB_STATION_IDS`, środek strefy na podłodze;
    `sign` (pozycja, rozmiar, `yaw`, `color`) to neonowy napis z tekstu `label` (płótno, mieszanie addytywne);
  - `panels: { kind: 'tiles' | 'screen', texture, position, size, yaw, tileM?, tint? }[]` — okładziny bez collidera:
    `tiles` to kafle ściany (`surfaces/tiles_wall`, powtarzane co `tileM` m, domyślnie 3), `screen` to świecący ekran
    (`screens/screen_*` jako nadruk `mat_screen_*`, bloom).
- Walidacja układu używa `validateLayout` z `roomSchema.ts` (ta sama co spawny pokoi): środki stref muszą leżeć na
  podłodze na poziomie `playerSpawn.y`, poza blokami i być osiągalne od `playerSpawn` na siatce 1 m. Dodatkowo: jedna
  stacja każdego `id`, strefy nie nachodzą na siebie (odległość środków ≥ suma promieni).
- Motyw `hideout` (`src/data/themes/hideout.json`, na bazie `neonStreet`): bez deszczu i burzy, bez panoramy
  miasta, ciemniejsza ciepła mgła, słabsze światło kluczowe. Do 8 świateł punktowych (`CityLights`).

## Peron

Peron 40 × 10,5 m ze ścianą tylną i sufitem na 5 m (wnętrze 15 m od tylnej ściany do ściany za torami), filary,
pas ostrzegawczy (`hazard`) przy krawędzi, kafle na dolnej części ścian. Tory leżą w niecce 0,8 m poniżej peronu:
dno ma collider, a skok (`jumpVelocity` 8 m/s ≈ 1,6 m) wyprowadza z niej z powrotem na peron, więc nie ma
pułapek. Na tylnej ścianie od lewej: warsztat, tablica misji, neon ISKRA, terminal drzewek, generator, wejście do
tunelu „POLIGON” (korytarz-ślepy zaułek z bursztynowym światłem). Neony `iskra`, `warsztat` i `metro`, ekrany
`screen_talents` i `screen_missions`, graffiti `graffiti_iskra`; para z kratki, kapanie, iskry; lampiony i kable.

## Stacje i strefy

`HubStations` (`src/world/hubStations.ts`, bez DOM, testowalna w Vitest):

- wejście w promień stacji otwiera ją i emituje `hub_station_opened { station }`; `HubScene` nasłuchuje tego zdarzenia
  i pokazuje nakładkę przez `HubScreens.show`;
- przy otwartej stacji gracz stoi w miejscu (scena nie krokuje kontrolera ani fizyki), a kursor jest zwolniony
  (`HtmlHubScreens.show` robi `exitPointerLock`, jak ekrany runu);
- po zamknięciu ta sama stacja otwiera się ponownie dopiero po wyjściu poza promień + `tuning.hub.exitMarginM`
  (0,75 m, histereza); inne stacje nie są blokowane;
- zamknięcie (`Zamknij`, Esc, `hub close`) wywołuje `ctx.resume`, więc gra wraca do przechwyconej myszy.

Stacje: `talents` (terminal drzewek), `workshop` (warsztat), `missions` (tablica misji), `arena` (tunel na poligon).

## Nakładki (`HubScreens`)

Interfejs `show(station, actions) / hide() / dispose()` wstrzykiwany przez opcję `screens` (w testach atrapa).
`HtmlHubScreens` (`src/ui/hubScreens.ts` + `hubScreens.css`) to na razie zaślepki: tytuł i opis stacji, przycisk
„Zamknij” (Esc też zamyka). `missions` dodaje „Rozpocznij run” → `?scene=run&loadout=classic&seed=<losowy>`
(tymczasowo; zadanie 10 poda ekwipunek z meta), `arena` dodaje „Przejdź na poligon” → `?scene=arena`. Nawigacja
zachowuje `?debug=1`. Teksty: `src/data/ui/meta.pl.json`, sekcja `hub`. Zadania 08–10 podmieniają zaślepki na
pełne ekrany talentów, warsztatu i tablicy misji.

## Menu główne

`src/ui/mainMenu.ts`: „Kryjówka” (główny przycisk → `?scene=hub`), „Kontynuuj run”, „Poligon”. „Nowy run (presety)”
z polem seeda i `BuildSelect` pojawia się tylko, gdy menu dostanie `?debug=1` w parametrach.

## Debug

- `hub open <talents|workshop|missions|arena>`, `hub close`;
- `hub tp <x> <z> [yawDeg] [pitchDeg]` — teleport gracza (yaw 0 patrzy w −Z; ruch myszy symulowany w następnym
  kroku); teleport w strefę stacji ją otwiera;
- `query('hubStation')` (otwarta stacja albo `null`), `query('playerPos')`, `query('stations')`;
- `reset` wraca na `playerSpawn`.

## Testy

`tests/unit/hubLayout.test.ts` (walidacja układu: stacje w granicach i osiągalne, strefy rozłączne, paleta, zasoby),
`hubStations.test.ts` (histereza), `hubScene.test.ts` (scena bez DOM: komendy, zatrzymanie ruchu, niecka torów,
nawigacja, `dispose` bez subskrypcji), `hubScreens.test.ts` (jsdom), `mainMenu.test.ts`; e2e: `tests/e2e/hub.spec.ts`.
Ręcznie: `?scene=hub&debug=1`, przejść do tablicy misji i terminalu, sprawdzić napisy, ekrany i światła; `hub tp`
ułatwia ustawienie kamery.

### Terminal drzewek

`src/ui/hub/talentsPanel.ts` (+ `talentsPanel.css`) eksportuje `createTalentsPanel: HubPanelFactory` (kontrakt:
`src/ui/hub/hubPanel.ts`). Panel czyta i zmienia wyłącznie `MetaManager`; podpięcie do nakładki robi zadanie 10.

- Nagłówek: „Wolne punkty: N”, „Poziom L”. Trzy kolumny (Ostrze, Rezonans, Strzelec) z węzłami pogrupowanymi wg
  progu 1–4 (podpis: wymagane punkty w drzewku i bieżąco wydane), pod nimi „Hybrydy”.
- Karta węzła to `<button>`: nazwa, koszt, stan kupiony / dostępny / zablokowany z krótkim powodem
  („wymaga: <nazwa>”, „próg: N pkt w drzewku”, „wymaga 3 pkt w Ostrze i 3 pkt w Rezonans”, „za mało punktów”).
  Niedostępne karty mają `aria-disabled="true"` i nie wołają `buyTalent`. Opis węzła w panelu szczegółów po
  najechaniu lub fokusie.
- Kupno: klik/Enter/Spacja → `buyTalent` → `await ctx.save()` → odświeżenie kart (bez przebudowy DOM, fokus
  zostaje). Błąd `buyTalent` trafia do linii statusu (`role="status"`).
- Reset: „Resetuj talenty” → „Potwierdź reset” (wygasa po `RESET_CONFIRM_MS` = 4 s) → `resetTalents` → zapis.
- Reguły stanu węzła: czysta funkcja `talentNodeState` (`src/ui/hub/talentState.ts`) odwzorowuje `buyTalent`
  (wymagane węzły, próg drzewka, punkty w drzewkach, wolne punkty); testy: `tests/unit/talentsPanel.test.ts`.
- Akcenty drzewek: Ostrze cyan, Rezonans magenta, Strzelec bursztyn, Hybrydy fiolet. Teksty:
  `src/data/ui/talents.pl.json`.
