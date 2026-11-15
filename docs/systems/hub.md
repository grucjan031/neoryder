# Kryjówka (hub) — F4-07

Grywalna kryjówka komórki ruchu oporu „Iskra” w nieczynnej stacji metra: scena `?scene=hub`
(`src/scenes/hub.ts`, `HubScene`). Gracz chodzi kontrolerem FPP (ruch, skok, dash, ślizg) bez wrogów, fal i systemów
walki; ręce pokazują ostrze plazmowe w spoczynku (`FppViewModel` z nieruchomym `BladeView`). Podejście do stacji,
spojrzenie na nią i naciśnięcie E otwiera nakładkę UI. Decyzje: `docs/adr/0007-meta-progres-f4.md` pkt 10,
styl: `docs/adr/0006-neon-noir.md`.

## Układ i dane

- `src/data/hub/hideout.json`, walidowany przez `src/world/hubSchema.ts` (`loadHubLayout`). Format pokoju:
  `playerSpawn`, `blocks` (`material`, `model` `city_*`), pola oprawy z `dressingSchema` (`theme`, `signs`, `lights`,
  `decals`, `ambientFx`, `decor`) plus pola kryjówki:
  - `blocks[].interactive: true` — jasny obiekt interaktywny (materiał `interactive`, #d9dde3);
  - `stations: { id, position {x,z}, radius, focus {position {x,y,z}, size {x,y,z}}, label, sign? }[]` — `id` z `HUB_STATION_IDS`, środek strefy na podłodze;
    `focus` określa środek i dodatnie wymiary bryły obiektu (dla poligonu: wejścia tunelu);
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

`selectHubFocus` i `HubStations` (`src/world/hubStations.ts`, bez DOM i Three.js, testowalne w Vitest):

- wybór wymaga przecięcia promienia z oka gracza w kierunku kamery (yaw + pitch) z AABB `focus`
  stacji, powiększonym z każdej strony o `tuning.hub.focusPaddingM` (0,2 m). Odległość od oka
  do trafienia musi być ≤ `tuning.hub.interactRangeM` (3,5 m). Wygrywa najbliższe trafienie,
  także z bliska i przy spojrzeniu w dół. Wysokość oka uwzględnia przysiad;
  `radius` nie ogranicza interakcji;
- samo wejście w promień niczego nie otwiera. Dopiero zbocze naciśnięcia E (istniejąca akcja `power2`,
  nazwana w scenie `HUB_INTERACT_ACTION`) otwiera wybraną stację i emituje `hub_station_opened { station }`;
  `HubScene` nasłuchuje tego zdarzenia i pokazuje nakładkę przez `HubScreens.show`;
- `HubPrompt` (`src/ui/hubPrompt.ts`) pokazuje klawisz E w ramce i `label` stacji na środku dolnej części ekranu.
  Podpowiedź znika przy braku stacji w celowniku lub otwartej nakładce. Teksty: sekcja `hub` w
  `src/data/ui/meta.pl.json`; aktualizacja DOM podpowiedzi odbywa się podczas renderowania;
- przy otwartej stacji gracz stoi w miejscu (scena nie krokuje kontrolera ani fizyki), a kursor jest zwolniony
  (`HtmlHubScreens.show` robi `exitPointerLock`, jak ekrany runu);
- przy otwartej nakładce E nic nie robi. Po zamknięciu nowe naciśnięcie E może otworzyć tę samą stację
  bez wychodzenia ze strefy; nie ma histerezy ani automatycznego ponownego otwierania. Pierwszy snapshot wejścia
  po zamknięciu ignoruje interakcję, aby odrzucić zaległe E z czasu pauzy, gdy pętla nie wykonywała kroków;
- zamknięcie (`Zamknij`, Esc, `hub close`) wywołuje `ctx.resume`, więc gra wraca do przechwyconej myszy.

Stacje: `talents` (terminal drzewek), `workshop` (warsztat), `missions` (tablica misji), `arena` (tunel na poligon).

## Nakładki (`HubScreens`)

Interfejs `show(station, actions) / hide() / dispose()` wstrzykiwany przez opcję `screens` (w testach atrapa).
`HtmlHubScreens` (`src/ui/hubScreens.ts` + `hubScreens.css`) hostuje panele stacji (sekcja „Panele stacji”);
stacja bez fabryki w rejestrze (`arena`) zostaje zaślepką: tytuł i opis, „Przejdź na poligon” → `?scene=arena`
oraz „Zamknij” (Esc też zamyka). Nawigacja zachowuje `?debug=1`. Teksty zaślepek: `src/data/ui/meta.pl.json`,
sekcja `hub`. `HubScreens` ma opcjonalne `refresh()`: scena woła je po zdarzeniach meta, a nakładka przekazuje je
do otwartego panelu.

## Menu główne

`src/ui/mainMenu.ts`: „Kryjówka” (główny przycisk → `?scene=hub`), „Kontynuuj run”, „Poligon”. „Nowy run (presety)”
z polem seeda, `BuildSelect` i przycisk „Sceny debug” (→ `?scenes=1`, z `debug=1`, jeśli był) pojawiają się tylko w
trybie debug (`?debug=1` albo `npm run dev`). Bez `?scene=` gra zawsze pokazuje menu gry; lista scen debug jest pod
`?scenes=1` (tylko w trybie debug, `src/ui/sceneMenu.ts`).

## Debug

- `hub open <talents|workshop|missions|arena>`, `hub close`;
- `hub look <talents|workshop|missions|arena>` — obraca kamerę na środek bryły `focus` stacji w następnym kroku;
- `hub tp <x> <z> [yawDeg] [pitchDeg]` — teleport gracza (yaw 0 patrzy w −Z; ruch myszy symulowany w następnym
  kroku); teleport nie otwiera nakładki;
- `query('hubStation')` (otwarta stacja albo `null`), `query('hubFocus')` (stacja w celowniku albo `null`),
  `query('playerPos')`, `query('stations')`, `query('meta')`
  (stan meta), `query('level')` (poziom, XP, punkty);
- komendy meta (`registerMetaCommands`): `meta state|xp|data|cores|threat|unlock all|reset`; `meta threat <n>` ustawia
  `threat.max` (odblokowanie kolejnych Poziomów zagrożenia bez grania); po każdej komendzie pasek i panel się odświeżają;
- `reset` wraca na `playerSpawn`.

## Testy

`tests/unit/hubLayout.test.ts` (walidacja układu: stacje w granicach i osiągalne, strefy rozłączne, paleta, zasoby),
`hubStations.test.ts` (ray–AABB, zasięg, najbliższe trafienie, otwieranie na żądanie), `hubPrompt.test.ts` (jsdom, podpowiedź),
`hubScene.test.ts` (scena bez DOM: spojrzenie i zbocze E, komendy, zatrzymanie ruchu, niecka torów,
nawigacja, `dispose` bez subskrypcji, meta), `hubScreens.test.ts` (jsdom, hostowanie paneli),
`missionsPanel.test.ts`, `metaBar.test.ts`, `mainMenu.test.ts`; e2e: `tests/e2e/hub.spec.ts`.
Ręcznie: `?scene=hub&debug=1`, `hub tp 6 -3.2 180` — brak podpowiedzi mimo zasięgu; `hub look talents` —
podpowiedź „E TALENTY”; E otwiera, Esc zamyka, kolejne E ponownie otwiera. Sprawdzić też tablicę misji,
warsztat i poligon oraz zasięg i margines brył interakcji (parametry `hub` w lil-gui).
Z bliska: `hub tp 6 -5.45`, `hub look talents` — podpowiedź widoczna, E otwiera terminal.

### Terminal drzewek

`src/ui/hub/talentsPanel.ts` (+ `talentsPanel.css`) eksportuje `createTalentsPanel: HubPanelFactory` (kontrakt:
`src/ui/hub/hubPanel.ts`). Panel czyta i zmienia wyłącznie `MetaManager`; montuje go nakładka stacji `talents`.

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

### Warsztat

`createWorkshopPanel` (`src/ui/hub/workshopPanel.ts`, kontrakt `HubPanel`) to samodzielny panel stacji `workshop`;
podpięty w rejestrze paneli sceny kryjówki. Nagłówek pokazuje Dane, Rdzenie i poziom gracza.

- **Odblokowania:** lista pogrupowana (Bronie, Moce, Ostrza, Sloty) wg `unlocks.json`; startowe pozycje są pokazane
  jako „Posiadane”. Wiersz: nazwa, cena (Dane i/lub Rdzenie) i stan: „Posiadane”, „Wymagany poziom N”, „Za mało
  Danych” / „Za mało Rdzeni” (kolejność sprawdzeń jak w `buyUnlock`) albo aktywny przycisk „Kup”. Niedostępny
  przycisk ma `disabled`. Kup → `buyUnlock` → `ctx.save()` → odświeżenie.
- **Ekwipunek:** ostrze (jedno z odblokowanych), bronie i moce jako przełączniki z limitem `weaponSlots` /
  `powerSlots` (licznik „Bronie: 1/2”; kolejność wyboru = kolejność slotów, pierwsza broń to slot 1). UI blokuje
  ponad limit i odznaczenie ostatniej pozycji, zanim zmiana trafi do `setLoadout`. Każda zmiana → `setLoadout` →
  `save` → odświeżenie.
- **Błędy:** `Error` z `MetaManager` (lub z zapisu) trafia do linii `role="status"`; stan zostaje bez zmian.
- **Logika bez DOM:** `src/ui/hub/workshopState.ts` (`unlockRows`, `groupRows`, `equipmentState`,
  `toggleSelection`, `nextLoadout`); nazwy broni i mocy z definicji (`name`), nazwy ostrzy i slotów z
  `src/data/ui/workshop.pl.json` (ostrza nie mają pola `name`). Styl: `workshopPanel.css`.
- Testy: `tests/unit/workshopPanel.test.ts` (jsdom + czyste funkcje).

### Panele stacji

Kontrakt: `src/ui/hub/hubPanel.ts` (`HubPanelContext { manager, save, navigate, close }`, `HubPanel { root, refresh,
dispose }`, `HubPanelFactory`). `HubScene` (`src/scenes/hub.ts`) przy `init` wczytuje meta (`loadMetaManager(store,
bus)`; `store` z opcji `metaStore`, domyślnie IndexedDB), rejestruje komendy meta (`registerMetaCommands`, sprzątane w
`dispose`) i buduje `HtmlHubScreens` z rejestrem `Partial<Record<HubStationId, HubPanelFactory>>`:
`missions: createMissionsPanel`, `talents: createTalentsPanel`, `workshop: createWorkshopPanel` (opcja `panels`
podmienia rejestr). `show(station)` montuje panel w treści nakładki (pod tytułem, nad „Zamknij”; nakładka jest wtedy
szersza, klasa `hub-screen--panel`), a `hide()`, kolejne `show()` i `dispose()` wołają `panel.dispose()`. Kontekst:
`save` = `saveMetaManager(store, manager)`, `navigate` doklejający `debug=1` z URL sceny, `close` zamyka nakładkę
(wznawia ruch). Po zdarzeniach meta scena woła `screens.refresh()` → `panel.refresh()`.

### Tablica misji

`src/ui/hub/missionsPanel.ts` (+ `missionsPanel.css`), `createMissionsPanel`; teksty `src/data/ui/missions.pl.json`
(sekcja `missions`).

- Karta sektora „Kurogane Arms” (nazwa i krótki opis).
- Poziomy zagrożenia 0..ostatni z `threat.json` jako przyciski z nazwą. Poziomy `<= threat.max` są aktywne, wyższe
  mają `aria-disabled="true"` i podpowiedź „Wygraj na poziomie N, aby odblokować” (N = poprzedni poziom); kliknięcie
  nic nie zmienia ani nie zapisuje. Poziom `max` (gdy `> 0`) ma znacznik „zalecany”. Wybór → `selectThreat` →
  `ctx.save()` → odświeżenie; błąd trafia do linii `role="status"`.
- Opis wybranego poziomu: „Wrogowie +X% zdrowia, +Y% obrażeń, +Z% liczebności” (z `enemyHealth`, `enemyDamage`,
  `budgetMult`; poziom 0: „Bez modyfikatorów wrogów”), „Nagrody +N%” (`rewardMult`) i „+K Rdzeń/Rdzenie/Rdzeni za
  zwycięstwo” (`victoryCores`, tylko gdy `> 0`).
- Pole opcjonalnego seeda i „Rozpocznij run” → `navigate('?scene=run&loadout=meta&seed=<seed lub losowy>')`; host
  dokleja `debug=1`. Losowy seed z `crypto.getRandomValues` (to UI, nie symulacja). Run czyta wybrany poziom z meta
  (`RunScene`, `loadout=meta`).
- Testy: `tests/unit/missionsPanel.test.ts`; e2e: `hub.spec.ts` (`meta threat 2` → wybór → run z `threatLevel` 2).

### Pasek meta

`src/ui/hub/metaBar.ts` (+ `metaBar.css`), `createMetaBar(manager, bus)`: stała belka u góry ekranu kryjówki
(`.meta-bar`, `pointer-events: none`, pod nakładkami): „Poziom L”, pasek doświadczenia z podpisem „xp / następny XP”
(na limicie poziomu „MAX” i pełny pasek), „Dane”, „Rdzenie”, „Wolne punkty: N” (wyróżnione bursztynem, gdy `> 0`).
Odświeża się po zdarzeniach `meta_rewards`, `level_up`, `talents_changed`, `unlock_purchased`, `loadout_changed`,
`threat_selected` oraz po każdej komendzie meta (te nie zawsze emitują zdarzenia). Scena tworzy pasek, gdy sama
tworzy nakładki (opcja `metaBar` pozwala to zmienić). Teksty: `missions.pl.json`, sekcja `bar`.
Testy: `tests/unit/metaBar.test.ts`.
