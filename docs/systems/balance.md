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

Ścieżki biorą wyposażenie z `blade`, `resonance`, `gunner`. Ostrze wybiera lepszy
tryb, Strzelec najlepszą pojedynczą broń. Moc używa obu ofensywnych slotów,
gdy są gotowe i starcza wspólnej energii. Runner sprawdza wszystkie stałe
priorytety slotów i wybiera najniższy TTK osobno dla każdego wroga. Nie modeluje
rotacji z celowym opóźnianiem gotowych mocy. Przeciążenie zwiększa otrzymywane
obrażenia przez `Stats`; przy maksimum nakłada ogłuszenie. Wyładowanie omija
nosiciela, więc w starciu z jednym celem nie dodaje obrażeń.

Raport pokazuje oddzielnie otwartą przestrzeń i cel tuż przed ścianą (0 m,
wall-slam rozliczany w następnym kroku). Brief nie rozstrzyga wariantu otoczenia;
wybór wariantu bramki wymaga decyzji koordynatora. Każdy wariant ma własną medianę.
Bramka sprawdza oba końce przedziału `[mediana / 2, mediana × 2]` bez zaokrąglania;
każde ∞ oznacza niezaliczenie.

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
  dostępny w rejestrze daje ostrzeżenie; po implementacji jego mechaniki trzeba
  dodać obsługę idealnego wejścia i zależności w `damagingPowerIds`/`simulate`.
  Uwaga: obecny loader rejestru waliduje wszystkie pliki przed uruchomieniem
  symulatora. Rodzaj spoza unii `powerSchema` przerwie import; pełne pomijanie
  takich surowych plików wymaga zmiany kontraktu loadera poza zakresem F2-18.
- Statusy obsługuje rzeczywisty `StatusSystem` i jego loader; nowy status
  istniejącego mechanizmu nie wymaga osobnego wzoru DPS.

## Sprawdzenie

`tests/unit/balance.test.ts` używa tej samej funkcji co CLI. Sprawdza ręcznie
wyliczony przypadek, przegrzanie, półautomat, cooldown, wspólną energię,
regenerację, podpalenie, przeciążenie, mnożnik celu, limit, oba progi bramki,
deterministyczność oraz aktualność raportu (z pominięciem różnicy daty).
Przy obecnych danych test bramki ma status `todo` z jawną przyczyną; po
zaliczeniu obu wariantów automatycznie staje się aktywną asercją. Po wyborze
jednego wariantu przez koordynatora należy dopasować tę politykę.

Nie dodano nowej mechaniki gry ani sceny. Przegląd w 30 sekund: `npm run balance`,
tabela ścieżek w `docs/balance.md`; do ręcznego porównania feel istnieją
`?scene=weapons-test`, `?scene=melee-test`, `?scene=push-test`, `?scene=status-test`.
Zwrócić uwagę na jednorazowy burst Strzelca, koszt kolejnych użyć Mocy i różnicę
walki przy ścianie. Akceptacja bramki fazy i review Architekta pozostają osobnymi
decyzjami człowieka.

## Propozycja danych do decyzji koordynatora (2026-11-14)

Próba wyłącznie w pamięci procesu, dla otwartej przestrzeni: pięć zmian pól
wystarcza do zaliczenia bramki. Nie zastosowano ich do danych gry. Nie jest to
dowód globalnie minimalnej liczby zmian ani ocena feel.

| Plik w src/data       | Pole      | Obecnie                | Propozycja | Powód                                                                        |
| --------------------- | --------- | ---------------------- | ---------- | ---------------------------------------------------------------------------- |
| loadouts/gunner.json  | weapons   | rifle, scatter, sniper | rifle      | Usunięcie jednorazowych zabójstw z pomiaru ścieżki, bez zmiany danych broni. |
| powers/push.json      | cost      | 25                     | 1          | Ograniczenie wielosekundowych przerw po wyczerpaniu energii.                 |
| powers/push.json      | cooldownS | 0.6                    | 0.1        | Tempo obrażeń bliższe combo ostrza.                                          |
| powers/shockwave.json | cost      | 40                     | 25         | Oba sloty dostępne w dłuższym starciu.                                       |
| powers/shockwave.json | damage    | 10                     | 7          | Pierwsze aktywacje dają razem 17, poniżej 18 HP drona.                       |

| Wróg      | Ostrze (s) | Moc (s) | Strzelec (s) |
| --------- | ---------: | ------: | -----------: |
| assaulter |      0.417 |   0.600 |        0.417 |
| drone     |      0.083 |   0.133 |        0.117 |
| executor  |      1.583 |   2.350 |        4.617 |
| gunner    |      0.250 |   0.367 |        0.317 |
| shielder  |      0.417 |   0.950 |        0.717 |
| sniper    |      0.250 |   0.250 |        0.217 |

W tej próbie wszystkie sześć bramek przechodzi, stosunki do mediany mieszczą się
w 0.581–1.965. Alternatywa zachowująca trzy bronie w ekwipunku: zamiast zmiany
`loadouts/gunner.json` zmniejszyć `scatter.damage` z 10 do 2 i `sniper.damage`
z 80 do 7 (łącznie sześć pól z korektami mocy powyżej). Próba daje te same TTK,
bo wygrywa karabin; oznacza duże osłabienie pozostałych broni. Obie propozycje
silnie zmieniają feel i nie zaliczają wariantu przy ścianie. Koordynator powinien
wybrać otoczenie pomiaru i kierunek strojenia przed zastosowaniem zmian.
