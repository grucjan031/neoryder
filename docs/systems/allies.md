# Sojusznicy

Sojuszniczy NPC z własną inteligencją: idą za graczem, walczą z wrogami, ściągają na siebie ogień,
padają i dają się podnieść. Pierwsze użycie to misje liniowe (autor dodaje sojusznika w danych
poziomu); drużyna w runie i na arenie to kolejny krok — API jest już wspólne (`RoomScene.addAlly`).

Kontrakt: `docs/api.md`, sekcja „Sojusznicy”. Kod: `src/allies/` (symulacja), `src/render/allyView.ts`,
`src/ui/squadHud.ts`, integracja w `src/scenes/roomScene.ts`.

## Jak sprawdzić w 30 sekund

`?scene=ally-test&debug=1` — plac `combatYard`, Nadia i Szron, fale wrogów w pętli
(`src/data/scenes/allyTest.json`; `room=<id>` podmienia pokój).

1. Stań i patrz: po 3 s rusza fala, sojusznicy strzelają, przy portretach pojawiają się kwestie.
2. Przejdź na drugi koniec placu — drużyna idzie za tobą; wejdź w sojusznika — schodzi w bok.
3. `T` — „trzymać pozycję”; odejdź, drużyna zostaje i walczy z miejsca. `T` jeszcze raz — wraca.
4. `ally down nadia` — Nadia leży, bursztynowy pierścień. Podejdź, przytrzymaj `E` przez 2 s.

| Komenda                    | Efekt                                                  |
| -------------------------- | ------------------------------------------------------ |
| `ally spawn <id>`          | dodaje sojusznika przy graczu (działa w każdym pokoju) |
| `ally down <id>`           | powala sojusznika                                      |
| `ally revive <id>`         | podnosi powalonego bez czekania                        |
| `ally hold`, `ally follow` | rozkaz drużyny                                         |
| `ally status`              | JSON ze stanem drużyny                                 |
| `ally waves <on\|off>`     | tylko `ally-test`: zatrzymuje albo wznawia fale        |

Zapytania debug: `query('allies')` (migawki), `query('allyKills')`, `query('squadOrder')`.

## Dane — `src/data/allies/*.json`

Schemat `src/allies/allySchema.ts` (`allySchema`, ścisły). Nowy sojusznik = nowy plik.

| Pole                              | Znaczenie                                                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `name`, `role`              | rola: `rifleman` albo `support` (opis postaci; zachowanie wynika z liczb)                                                                                                            |
| `hp`, `moveSpeed`                 | bazy statystyk `maxHealth` i `moveSpeed` (`Stats`)                                                                                                                                   |
| `weapon`                          | profil strzału jak u Strzelca: `model`, `damage`, `projectileSpeed`, `burstCount`, `burstIntervalS`, `cooldownS`, `pellets`, `pelletSpreadDeg`, `burstsPerReload`, `reloadS`, `tags` |
| `accuracy`                        | 0–1; rozrzut = `(1 − accuracy) × tuning.allies.maxSpreadDeg`                                                                                                                         |
| `followDistanceM`, `engageRangeM` | odstęp w szyku i zasięg podejmowania walki                                                                                                                                           |
| `reviveS`                         | ile gracz trzyma klawisz, żeby podnieść                                                                                                                                              |
| `look`                            | strój z części `npc_civilian.glb` i kolory (bez czerwieni, cyanu, magenty)                                                                                                           |
| `barks`                           | kwestie po polsku: `contact`, `reload`, `downed`, `revived`, `objective`                                                                                                             |

Na start: `nadia` (zwiadowczyni, karabin, szybka, celna) i `szron` (ciężki, rozpraszacz, wolniejszy,
więcej zdrowia). Wspólne liczby zachowania (smycz, osłony, czasy, ustępowanie) są w
`tuning.allies` i widać je w panelu lil-gui.

## Maszyna stanów — `src/allies/ally.ts`

```
follow | hold  ──wróg widoczny w zasięgu──▶  engage  ──po serii──▶  reposition ──▶ engage
   ▲                                            │  └─mało zdrowia──▶ takeCover ──▶ engage / follow
   └──────────── brak celu / smycz ◀────────────┘
dowolny stan ──zdrowie 0──▶ downed ⇄ reviving ──reviveS──▶ follow | hold
```

- **follow** — miejsce w szyku za plecami gracza (`slotSpreadDeg` na boki). Rusza po oddaleniu
  o `followDistanceM + followSlackM`, powyżej `catchUpDistanceM` biegnie, powyżej
  `teleportDistanceM` (albo po utknięciu) dołącza skokiem za plecy gracza.
- **hold** — rozkaz gracza: zostaje w punkcie, walczy z miejsca, po walce wraca na punkt.
- **engage** — cel wybiera `selectAllyTarget`: najbliższy widoczny wróg w `engageRangeM`,
  z preferencją wroga, który ranił gracza w ostatnich `threatMemoryS`. Fazy: celowanie (`aimS`),
  seria, przerwa; co `burstsPerReload` serii przeładowanie. Każdy strzał wymaga czystej linii
  od wylotu do celu (raycast w geometrię świata) — sojusznik nie strzela przez ściany.
- **reposition** — po serii, z szansą `repositionChance`: krok w bok o `repositionM`.
- **takeCover** — poniżej `coverHpFraction` zdrowia szuka punktu, którego cel nie widzi
  (pierścienie `coverRadiusM`), czeka `coverHoldS` i odzyskuje `coverRegenPerS`.
- **downed / reviving** — zdrowie 0. Gracz w `reviveRadiusM` trzyma klawisz interakcji przez
  `reviveS`; puszczenie cofa postęp. Po podniesieniu `reviveHpFraction` zdrowia i `reviveInvulnS`
  nietykalności. Bez pomocy przez `downedTimeoutS` sojusznik znika z pola walki (`ally_evacuated`)
  i wraca przy checkpoincie albo po fali. Nie ginie na stałe.
- W rozkazie „za mną” sojusznik dalej niż `leashM` od gracza zrywa walkę i dogania go.

Ruch: `ArenaNavigation.next`, gdy scena ma siatkę (tryby aren; dla zwykłych pokoi i poziomów
`RoomScene` buduje siatkę podłogi na wysokości startu), w pozostałych miejscach prosto do celu.
Każdy krok sprawdzają dwa promienie (klatka, próg) i podłoże pod stopami, przy przeszkodzie
sojusznik próbuje odchyleń 45° i 90°. Sojusznik nie ma bryły blokującej: gracz i wrogowie przez
niego przechodzą, a gdy gracz podejdzie bliżej niż `yieldRadiusM`, sojusznik schodzi w bok.

Logika jest czysta (bez Three.js, DOM i Rapiera): świat dostaje przez `AllyEnvironment`,
losowość z `Rng` (`ctx.rng.fork('ally:<id>')`), stan to liczby i wektory.

## Drużyna i model obrażeń — `src/allies/squad.ts`

`AllySquad` tworzy sojuszników i spina ich ze sceną:

- encja `ally:<id>` w drużynie `neutral`, `Health` i `Stats` w `DamageSystem` — powalenie nie emituje
  `player_died` ani `enemy_killed`;
- hurtbox: sensor w grupie `Player` z filtrem `EnemyProjectile | Enemy` — trafiają go pociski
  i ciosy wrogów; pociski gracza, ostrze i kontrolery postaci go nie widzą;
- obrona (`guard`): źródła z drużyny gracza i inni sojusznicy zadają 0 (wybuchy, moce obszarowe);
- strzały: `ProjectileSystem.spawn` z `team: 'player'` i `owner` = encja sojusznika; zabójstwo
  trafia do `enemy_killed.killer` i licznika `kills` sojusznika, nie gracza.

## Wrogowie widzą sojuszników

`selectHostileTarget` (`src/allies/targeting.ts`) wybiera cel wroga spośród gracza i stojących
sojuszników: najmniejsza odległość ważona — gracz ×1, sojusznik × `enemyAllyBias` (1,25), bieżący
cel × `enemyStickyBias` (0,8). Przy podobnej odległości wygrywa gracz, wyraźnie bliższy sojusznik
ściąga ogień, a histereza chroni przed skakaniem między celami. Powalony nie jest celem.

`RoomScene` podaje to przez `EnemyDependencies.getTargetFor`; `EnemyManager` daje wtedy każdemu
wrogowi własne `getTarget`, więc kod archetypów się nie zmienił. Bez sojuszników wynik jest ten sam
co dawniej (gracz). Dyrektor wrogów nadal ustawia sloty wokół gracza (`getTarget` bez argumentu).

## Komendy gracza

- `T` (akcja `squadCommand`, do zmiany w ustawieniach) przełącza „za mną” / „trzymać pozycję”.
- Podnoszenie: klawisz interakcji, czyli akcja `power2` (`E`) — jak w kryjówce. Gdy powalony jest
  w zasięgu, `RoomScene` odbiera ten klawisz mocom na czas podnoszenia.

## Render i HUD

`AllyView`: postać z `npc_civilian.glb` w stroju z danych, klipy `Idle_Loop` / `Walk_Loop` /
`Jog_Fwd_Loop` (`npc_anims.glb`) oraz `Pistol_Aim_Neutral` i `Pistol_Idle_Loop` ze Strzelca (ten sam
szkielet), broń z `weapon.model` w dłoni, błysk wylotu. Nad głową mały cyanowy znacznik drużyny;
pasek zdrowia tylko gdy ranny. Powalony leży, ma bursztynowy pierścień i pulsujący znacznik,
podnoszony klęka. Pozycja i obrót są interpolowane w `render(alpha)`.

`SquadHud` (lewa krawędź): portret z inicjałem, imię, stan, pasek zdrowia, rozkaz drużyny z klawiszem,
dymek kwestii (`ally_bark`, widoczny `barkShowS`) i podpowiedź „Przytrzymaj [E] — podnieś: …”.

## Misje liniowe

Pole `allies` poziomu (`src/world/levelSchema.ts`):

```json
"allies": [
  { "id": "nadia", "spawn": { "x": 12, "y": 0, "z": 3 } },
  { "id": "szron", "spawn": { "x": 60, "y": 0, "z": 0 },
    "joinAfter": { "kind": "objective", "id": "mast-1" } }
]
```

`loadLevel` sprawdza id sojusznika, zależność i osiągalność punktu. `RoomScene` czyta `allies`
z układu (albo z `RoomSceneOptions.allies`), dołącza sojuszników na starcie albo po ukończeniu celu,
a przy `resetLevelCombat` (odrodzenie na checkpoincie) stawia całą drużynę przy checkpoincie
z pełnym zdrowiem. Po ukończeniu celu drużyna rzuca kwestię `objective`.

Do dopięcia w `src/scenes/mission.ts` (poza tym zadaniem):

1. `joinAfter` typu `encounter`: po ukończeniu spotkania `this.room.allyDependencyDone('encounter', id)`
   oraz to samo dla spotkań już ukończonych przy wznowieniu z checkpointu.
2. Powrót ewakuowanych przy nowym checkpoincie: w `checkpoint(id)` wywołać `this.room.restoreAllies()`.

## Ograniczenia MVP

- Sojusznicy nie reagują na zagrożenia otoczenia (`HazardSystem` ich nie widzi) i nie mają statusów.
- Bez dźwięku strzałów i głosu (kwestie tylko jako napisy).
- Arena wyzwań (`src/scenes/arena.ts`) nie ma drużyny; stan drużyny nie trafia do zapisu.
- Sloty dyrektora wrogów liczą się wokół gracza, także gdy wróg celuje w sojusznika.

## Testy

`tests/unit/allies.test.ts` (dane, wybór celów, maszyna stanów, drużyna w świecie Rapiera, ściana),
`tests/unit/allyScene.test.ts` (scena bez przeglądarki), `tests/e2e/allies.spec.ts`.
