# Symulator balansu F2-18

`npm run balance` uruchamia `src/balance/run.mjs` w Node. Istniejący Vite przez
`createServer` w trybie middleware i `ssrLoadModule` przekształca TypeScript oraz
`import.meta.glob` loaderów. Nie uruchamia serwera HTTP, przeglądarki ani Rapier;
zamyka runner po zapisaniu `docs/balance.md`. Bez nowych zależności. Niezaliczona
bramka nie jest błędem generatora: wynik i ostrzeżenia są w raporcie.

`simulate` tworzy osobną parę gracz–cel z rzeczywistymi `Weapon`, mocami z
`createPower`, `PlasmaBlade`, `DamageSystem`, `StatusSystem`, `PlayerEnergy` i
`Stats`. Krok to `SIM_DT`; kolejność: zegar obrażeń, regeneracja energii,
statusy, atak. Limit 120 s; niezabity cel ma TTK ∞. DPS oznacza efektywnie
zdjęte HP podzielone przez czas starcia, bez overkill. Pierwsze trafienie
rozliczane jest na końcu pierwszego kroku, czyli po 1/60 s.

Atrapa `spawn` natychmiast przekazuje obrażenia pocisku i eksplozji przez
`DamageSystem`. Zgodnie z briefem sumuje też wszystkie przebicia z ich
spadkiem obrażeń na jednym celu. Właściwy `ProjectileSystem` nie trafia ponownie
tej samej encji — tę idealizację należy uwzględnić przy interpretacji wyniku.
Promień i łuk cięcia zawsze widzą nieruchomy cel w zasięgu. Trafienia są w korpus;
bez headshotów, tarczy Tarczownika i parowania Egzekutora. Nie ma otrzymywanych
obrażeń, efektów areny, implantów ani synergii. Bazowe zasoby odzwierciedlają
`Arena.playerStats`; przy zmianie baz areny trzeba zaktualizować `PLAYER_STATS`.
Czas pomija prezentacyjne pauzy hitstopu i slowmo.

Combo ponawia kliknięcia z buforem. Ciężki atak przytrzymuje wejście do pełnego
naładowania, następnie puszcza; zawiera lekki cios rozpoczynający przytrzymanie
w obecnym `PlasmaBlade`. Półautomat zwalnia spust przez publiczne `cool(0)` podczas
oczekiwania, dzięki czemu trafia w pierwszy krok dopuszczony przez cooldown.

## TTK paczki (miara bramki)

`SimulationOptions.count` (domyślnie 1) każe zabić `count` wrogów po kolei;
`PACK_SIZE = 5` to paczka bramki. Po śmierci celu natychmiast pojawia się
następny, świeży, w tym samym miejscu (nowa encja, pełne HP, bez statusów i
oczekujących wall-slamów poprzednika). Przechodzą dalej: ciepło i cooldown broni,
odnowienia mocy, energia gracza z opóźnieniem regeneracji, energia za zabójstwo
w zwarciu oraz stan ostrza. Statusy znikają z martwym celem (`StatusSystem`
czyści je przy `enemy_killed`). Następca nie dostaje cięcia ostrza, które zabiło
poprzednika (jedno cięcie = jeden cel), bo inaczej jedno cięcie czyściłoby paczkę.
`SimulationResult.ttkS` to czas ostatniego zabójstwa (∞, gdy nie wszystkie
padły), `killTimesS` to czasy kolejnych zabójstw.

Uzasadnienie (decyzja koordynatora): pojedyncze TTK karze bronie zabijające jednym
strzałem (1/60 s wobec 0,4 s ostrza), a na arenie liczy się tempo czyszczenia
fali. Tabele pojedynczego TTK zostają w raporcie informacyjnie.

Ścieżki biorą wyposażenie z `blade`, `resonance`, `gunner`. Ostrze wybiera lepszy
tryb, Strzelec najlepszą pojedynczą broń. Moc używa ofensywnych slotów, gdy są
gotowe i starcza wspólnej energii. Runner sprawdza wszystkie stałe priorytety
slotów i wybiera najniższy czas osobno dla każdego wroga (osobno dla paczki i dla
pojedynczego celu). Nie modeluje rotacji z celowym opóźnianiem gotowych mocy.
Przeciążenie zwiększa otrzymywane obrażenia przez `Stats`; przy maksimum nakłada
ogłuszenie. Wyładowanie omija nosiciela, więc w starciu z jednym celem nie dodaje
obrażeń.

Bramka: tylko wariant „otwarta przestrzeń”. Dla każdego wroga każda ścieżka ma
mieć TTK paczki w `[mediana / 2, mediana × 2]`, gdzie mediana to środkowa z trzech
wartości (Ostrze, Moc, Strzelec; oba końce bez zaokrąglania; ∞ i mediana ≤ 0 to
niezaliczenie). Wrogowie w teście: wszystkie typy z `src/data/enemies/` poza bossami
(obecnie assaulter, drone, executor, gunner, hacker, shielder, sniper, turret;
`securityChief` pominięty, bo jego TTK wymaga symulacji faz). Ostrze używa
`plasmaBlade` (lepszy z `combo` i `heavy`), ścieżki biorą ekwipunek z presetów
`blade`, `gunner`, `resonance`. Wariant „cel przy ścianie” (0 m, wall-slam rozliczany w następnym
kroku) zostaje w raporcie jako informacyjny: wall-slam to nagroda za grę
pozycyjną, nie część bramki.

## Dane i rozszerzanie

- Nowa broń obsługiwanego trybu: JSON w `src/data/weapons/`, walidowany przez
  loader gry, automatycznie trafia do tabeli. Włączenie do ścieżki wymaga id
  w odpowiednim ekwipunku.
- Nowy wróg: JSON w `src/data/enemies/` zgodny z `enemySchema`. HP, bazowe
  statystyki i mnożnik hurtboxa drona pochodzą z danych; obrony kierunkowe są
  pomijane zgodnie z założeniami. `targetModifiers` pozwala testować modyfikatory
  przez `Stats`, bez własnego liczenia bonusów.
- Nowa moc istniejącego rodzaju `cone` lub `chain`: rejestr gry dostarcza
  fabrykę i definicję, symulator automatycznie uwzględnia ofensywne dane.
  Moce bez obrażeń i rodzaje `focus`/`barrier` są pomijane. Inny rodzaj
  dostępny w rejestrze (np. `grab`) daje ostrzeżenie; po implementacji jego
  mechaniki trzeba dodać obsługę idealnego wejścia i zależności w
  `damagingPowerIds`/`simulate`. Uwaga: obecny loader rejestru waliduje wszystkie
  pliki przed uruchomieniem symulatora. Rodzaj spoza unii `powerSchema` przerwie
  import; pełne pomijanie takich surowych plików wymaga zmiany kontraktu loadera
  poza zakresem F2-18.
- Statusy obsługuje rzeczywisty `StatusSystem` i jego loader; nowy status
  istniejącego mechanizmu nie wymaga osobnego wzoru DPS.

## Sprawdzenie

`tests/unit/balance.test.ts` używa tej samej funkcji co CLI. Sprawdza ręcznie
wyliczony przypadek, przegrzanie, półautomat, cooldown, wspólną energię,
regenerację, podpalenie, przeciążenie, mnożnik celu, limit i oba progi bramki,
deterministyczność oraz aktualność raportu (z pominięciem różnicy daty). Testy
paczki: ręcznie wyliczone zabójstwa w krokach 1/31/61, przenoszenie ciepła
(paczka 2×20 HP = jeden cel 40 HP), przenoszenie energii i odnowień mocy,
znikanie statusów z martwym celem, osobne cięcie ostrza dla następcy oraz
spójność ścieżek z wynikami paczki. Testy mocy pinują wartości przez
`withPowers`, więc strojenie danych nie łamie ręcznych wyliczeń. Asercja bramki
(otwarta przestrzeń, paczka) jest aktywna, gdy bramka przechodzi; w przeciwnym razie
jest `todo` z listą wrogów poza przedziałem.

Nie dodano nowej mechaniki gry ani sceny. Przegląd w 30 sekund: `npm run balance`,
tabela ścieżek w `docs/balance.md`; do ręcznego porównania feel istnieją
`?scene=weapons-test`, `?scene=melee-test`, `?scene=push-test`, `?scene=status-test`.
Zwrócić uwagę na jednorazowy burst Strzelca, koszt kolejnych użyć Mocy i różnicę
walki przy ścianie. Akceptacja bramki fazy i review Architekta pozostają osobnymi
decyzjami człowieka.

## Decyzje koordynatora (2026-11-14)

Rozstrzygnięte (stare propozycje z pierwszej wersji symulatora — usunięcie
`rifle`-only ze Strzelca oraz `push.cost = 1` — nie są stosowane):

1. Bramka liczona tylko dla „otwartej przestrzeni”; ściana informacyjnie.
2. Miara bramki to TTK paczki 5 wrogów (sekcja wyżej); reguła `[mediana / 2, mediana × 2]` bez zmian.
3. Ekwipunek ścieżki Moc (`src/data/loadouts/resonance.json`): moce `["chain", "push"]`
   (było `["push", "shockwave"]`) — Błyskawica jako główne obrażenia, Pchnięcie jako
   kontrola. Opis na ekranie buildu (`src/data/ui/buildSelect.pl.json`): „Rezonans zamiast
   lufy: Błyskawica przeskakuje między wrogami, Pchnięcie rozbija grupy i miażdży o
   ściany.” Hybrydy `bladeDancer` i `resonancePistolero` nadal używają Pchnięcia i Fali
   uderzeniowej (bez zmian). Ekwipunek Strzelca bez zmian.
4. Dozwolone strojenie (tylko te pola): `chain` (`damage`, `cost`, `cooldownS`), `push`
   (`damage`, `cost`, `cooldownS`), `shockwave` (`damage`, `cost`), `scatter` (obrażenia,
   śruty, tempo), `sniper` (obrażenia, tempo). Ograniczenia feel: `push.cost` ≥ 10,
   `push.cooldownS` ≥ 0,35, `chain.cooldownS` ≥ 0,4, rozpraszacz zabija Szturmowca z
   bliska w ≤ 2 strzałach (śruty × obrażenia ≥ 30), snajperka zabija Strzelca jednym
   strzałem (obrażenia ≥ 45). Bez zmian: dane ostrza, HP wrogów, `tuning.ts`.
5. Jeśli w tych granicach bramka nie przechodzi — nie łamać ograniczeń, opisać opcje.

### Wynik po zmianie ekwipunku (dane mocy bez zmian)

(Stan historyczny z chwili decyzji, wtedy 6 typów wrogów; dziś 8, z `hacker` i `turret`.)
Bramka NIEZALICZONA, 6/6 wrogów poza przedziałem. Ścieżka Mocy (chain 18 / 30 energii /
1,2 s, Pchnięcie 10 / 25 / 0,6 s) potrzebowała na paczkę 5 wrogów: assaulter 77,8 s,
drone 17,9 s, executor ∞, gunner 62,8 s, shielder ∞, sniper 47,8 s przy medianach
0,9–10 s. Przyczyna: Błyskawica to 15 DPS na pojedynczym celu, ostrze ok. 100 DPS, a pula
energii to 100 z regeneracją 25/s dopiero po 2 s bez wydatku
(`tuning.powers.energyRegenDelayS`); po opróżnieniu puli każde użycie kosztuje ~2 s
opóźnienia. Paczka 5 Egzekutorów to 1100 HP. Samo skrócenie opóźnienia regeneracji
(poza dozwolonymi polami) nie wystarcza: Egzekutor 102 s przy 0 s.

Przy `chain.cost` ≥ 10 i `chain.damage` ≤ 45 poza przedziałem zostaje tylko Egzekutor
(38,1 s przy medianie 13,7 s, 2,79×, w najlepszej próbie z wolniejszym Strzelcem).
Zaliczenie wymagało `chain.damage` ≥ 60 przy koszcie ≥ 10 (z wolniejszą snajperką),
`chain.damage` ≥ 100 przy koszcie 10 (bez zmian Strzelca) albo kosztu `chain` ≤ 5.

### Opcje rozważone

| Opcja           | Zmiany pól                                                                                       | Najgorszy iloraz do mediany |
| --------------- | ------------------------------------------------------------------------------------------------ | --------------------------- |
| A               | `chain`: damage 100, cost 10, cooldownS 0,6; `push`: damage 18                                   | 1,44                        |
| **B (wybrana)** | `chain`: damage 60, cost 10, cooldownS 0,4; `push`: damage 35, cost 10; `sniper`: fireRateHz 0,8 | 1,94                        |
| C               | `chain`: damage 36, cost 2, cooldownS 0,4; `push`: damage 35, cost 10                            | 1,70                        |

### Wybrana opcja B (decyzja koordynatora)

Zastosowane wartości (pozostałe pola bez zmian; `shockwave` i `scatter` nietknięte):

| Plik w src/data     | Pole       | Było | Jest                    |
| ------------------- | ---------- | ---- | ----------------------- |
| powers/chain.json   | damage     | 18   | 60                      |
| powers/chain.json   | cost       | 30   | 10                      |
| powers/chain.json   | cooldownS  | 1,2  | 0,4                     |
| powers/push.json    | damage     | 10   | 35                      |
| powers/push.json    | cost       | 25   | 10                      |
| weapons/sniper.json | fireRateHz | 1    | 0,8 (odnowienie 1,25 s) |

Uzasadnienie: B daje najmniejsze skoki obrażeń spośród opcji zaliczających bramkę
(A podnosi Błyskawicę ponad 5×, tak że zabijałaby grupy jednym użyciem) i zachowuje
rolę energii: Błyskawica kosztuje 10 z puli 100, więc po 10 użyciach trzeba czekać na
regenerację (C z kosztem 2 znosi tę rolę). Wolniejsza snajperka (1,25 s) podnosi
medianę Egzekutora do 11,0 s, co mieści Moc (21,3 s); snajperka nadal zabija Strzelca
jednym strzałem (obrażenia 80 ≥ 45). Ograniczenia z punktu 4 spełnione:
`push.cost` 10, `push.cooldownS` 0,6, `chain.cooldownS` 0,4; rozpraszacz bez zmian
(8 × 10 obrażeń, zabija Szturmowca w jednym strzale).

Wynik (otwarta przestrzeń, paczka ×5): bramka ZALICZONA, najgorszy iloraz do mediany
1,935 (executor: Moc 21,3 s, mediana 11,0 s); pozostałe ilorazy Mocy 0,54–0,93,
Strzelca do 1,70 (sniper). Margines przy Egzekutorze jest mały (1,935 wobec limitu 2);
dalsze strojenie Mocy lub snajperki wymaga ponownego `npm run balance`. Symulacja nie
zastępuje playtestu: do oceny feel zostaje playtest człowieka (Błyskawica 60 obrażeń
co 0,4 s, Pchnięcie 35 obrażeń przy koszcie 10, wolniejsza snajperka).

Symulator nie modeluje Chwytu (`grab`), dlatego `npm run balance` zostawia
ostrzeżenie „Pominięto nieobsługiwany rodzaj mocy: grab”.

Wartości z tabeli „Zastosowane wartości” zgadzają się z danymi w `src/data` (sprawdzone
20.11.2026): `chain` damage 60 / cost 10 / cooldownS 0,4; `push` damage 35 / cost 10 /
cooldownS 0,6; `sniper` damage 80, fireRateHz 0,8; `scatter` 8 śrutów × 10; ekwipunek
`resonance` = moce `chain`, `push`; HP wrogów: assaulter 60, drone 18, executor 220,
gunner 45, shielder 90, sniper 35. Energia gracza w symulacji: 100, regeneracja 25/s po
opóźnieniu `tuning.powers.energyRegenDelayS` = 2 s; ciepło: pojemność 100, chłodzenie 45/s;
limit czasu pary 120 s (`MAX_TIME_S`), `PACK_SIZE` = 5.

## Balans meta-progresu (bramka F4)

`src/balance/metaSim.ts` (test `tests/unit/metaBalance.test.ts`, sekcja w `docs/balance.md`)
symuluje 5 typowych runów nowego gracza na Poziomie zagrożenia 0 przez prawdziwy
`MetaManager.applyRun`: stała ścieżka sektora (walka, walka, walka, elita, sklep, elita,
odpoczynek, boss), 6 zabójstw w pokoju walki, 10 w elicie, 5 z bossem; `roomsCleared` to
wszystkie ukończone węzły. Runy: śmierć w warstwie 3, śmierć w warstwie 5, zwycięstwo,
śmierć w warstwie 6, zwycięstwo. Po każdym runie gracz zachłannie kupuje talenty (wg kosztu,
potem id) i odblokowania (wg sumy kosztu, potem id). Bramka: poziom po 5 runach 5–8, 2–4
zakupy odblokowań, pierwszy run daje co najmniej 1 poziom, żaden run więcej niż 3. Wynik:
poziom 7, 4 zakupy. Formuły nagród, krzywa poziomów i poziomy zagrożenia: `docs/systems/meta.md`.
Raport zawiera też tabelę nagród za typowe zwycięstwo i śmierć w warstwie 5 na poziomach
zagrożenia 0–3 (`rewardMult`: 1; 1,15; 1,3; 1,45; Rdzenie za zwycięstwo +`victoryCores`).
Trudność (`src/data/difficulty.json`: easy, normal, hard, nightmare) nie jest częścią żadnej
z tych symulacji; opisuje ją `docs/systems/difficulty.md`.
