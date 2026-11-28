# Cywile — naukowcy Kurogane Arms

Neutralne postacie w pokojach walki: nie atakują, nie są przeciwnikami ani
sojusznikami. Nie uczestniczą w dyrektorze walki, aim assist, celowaniu wrogów,
liczeniu zabójstw wrogów ani warunku ukończenia pokoju. Brak nagród i kar.

## Dane i symulacja

`src/data/civilians/scientist.json`, walidacja zod w `civilianSchema.ts`:
`id`, `model`, `clothingVariants` (`parts`, `coatColor`, `pantsColor`, `accent`),
`maxHealth`, `fleeSpeedMps`, `visionRangeM`, `visionAngleDeg` (pełny kąt),
`reactionS`. Początkowo 40 HP, bieg 5 m/s, wzrok 18 m / 160°, reakcja 0,3 s.
Pozostałe liczby są w `tuning.civilians`, dostępne w lil-gui.

Pokój przyjmuje opcjonalne `civilians: [{ id, position, yaw? }]` i `hideSpots`.
Pozycja oznacza stopy, yaw jest w radianach, przód modelu to +Z. Powtórzenie
id definicji tworzy odrębne encje. Pokoje bez `civilians` działają jak wcześniej.

Maszyna `idle → fleeing → crouching`; `dead` jest końcowy. Gracz musi być
w zasięgu, kącie i linii wzroku przez cały czas reakcji. Utrata widoczności
przed reakcją zeruje licznik; po panice postać kontynuuje ucieczkę bez
ponownego wykrywania. Kucanie trwa do końca pokoju, nawet gdy gracz podejdzie.

Bez `hideSpots` kandydaci powstają z rogów i środków krawędzi podłogi oraz
okolic bloków. Odwrócone bloki uwzględniają yaw. Kandydat musi mieć podparcie,
wolną przestrzeń i trasę nawigacji. Preferencja: brak linii wzroku z wysokości
kucającej postaci, następnie większa odległość od gracza. Remisy rozstrzyga
osobny `Rng.fork`, deterministycznie dla seeda. Rezerwacje wykluczają sąsiednie
miejsca i pozostają do końca pokoju. Gdy brakuje osiągalnych kryjówek, cywil
pozostaje w stanie ucieczki i ponawia wybór; nie przenika przez ścianę.

`CivilianPopulation.step` działa w stałym kroku sceny. Ruch używa istniejącej
nawigacji oraz kontrolera postaci Rapiera z kolizją świata. Stan do odczytu
jest serializowalny; nie zawiera Three.js ani DOM. Nie zmienia formatu zapisu runu.

## Obrażenia i widok

Każdy cywil ma neutralną encję, `Stats`, `Health` oraz hurtbox. Grupa kolizji
Enemy pozwala istniejącym zapytaniom broni i ostrza wykryć trafienie; logika
nie rejestruje cywila w `EnemyManager`. `DamageSystem` przyjmuje wyłącznie
obrażenia gracza, w tym moce i odbite przez niego pociski. Wrogowie ani
sojusznicy nie ranią naukowców. Śmierć usuwa hurtbox i wyłącza collider,
emituje `civilianKilled { id, by }`; panika emituje `civilianPanicked { id }`.

Widok współdzieli cache modeli, klipy i wybór części stroju z postaciami hubu
(`render/npcAssets.ts`, kompatybilne eksporty w `scenes/hubNpcs.ts`). Fartuch
`top_coat` ma sterylną biel/szarość, spodnie są ciemne; akcenty zgodne z ADR 0006.
Bezczynność: `Idle_Loop`, bieg: `Jog_Fwd_Loop`, schowanie: `Crouch_Idle_Loop`.
Po śmierci poza szkieletu zamiera, korzeń w ciągu 0,7 s obraca się i opada
w kierunku trafienia. Kierunek i czas pochodzą z symulacji. Model ciała pozostaje
do zwolnienia pokoju; brak rozpadu i zanikania.

## Sprawdzenie ręczne (30 sekund)

Uruchom `?scene=scientist-test&seed=scientists`. W pokoju są trzej naukowcy,
osłony i fala dwóch wrogów po 8 sekundach. Sprawdź:

- Naukowcy widzą start gracza, biegną do różnych kryjówek, omijają osłony
  i pozostają w kuckach po podejściu gracza. Powtórzenie seeda daje ten sam wybór.
- Biały fartuch i ciemne spodnie, brak czerwonej poświaty i broni.
- Strzał, ostrze i moc zadają obrażenia; wrogowie ignorują naukowców.
- Śmiertelne trafienie przewraca ciało od uderzenia w 0,7 s, również z kucek;
  ciało pozostaje po zabiciu wrogów i otwarciu wyjścia.
- Celownik wspomagający wybiera wrogów; żywi naukowcy nie blokują ukończenia.

Debug: `civilian spawn scientist` dodaje postać przed graczem,
`query('civilians')` zwraca HP, pozycje, stan, kryjówki i kierunki upadku.
`civilian status` wypisuje stan i pozycję każdego cywila, a `civilian kill`
zadaje śmiertelne obrażenia najbliższemu żywemu (ta sama ścieżka co trafienie gracza:
`damage_dealt` → upadek ciała → `civilianKilled`). Działa w każdej scenie pokoju
z cywilami, np. `?scene=room-test&room=run8`.
Testy: `tests/unit/civilians.test.ts`. Weryfikację obrazu wykonuje manager.
