# Przedmiot w ręku

Kod symulacji: `src/combat/heldItem.ts`. Scena: `?scene=arena&loadout=gunner&debug=1`.
Gracz trzyma jeden przedmiot: ostrze plazmowe (`blade`) albo broń z wybranego
slotu (`gun`). Moce F/E pozostają niezależne od tego wyboru.

## Sterowanie i zamiana

- LPM (`attack`): ostrze — dotychczasowe combo, ciężki atak i dash-cięcie;
  broń — spust trzymany przez cały czas przytrzymania LPM.
- R (`swap`): zamiana ostrze/broń. Trwa `tuning.hands.swapS` (0,24 s czasu
  gracza). W zamianie oba ataki są zablokowane. Stan `held` zmienia się dopiero
  po zakończeniu; wejście ataku wraca od następnego kroku.
- Zamiana ostrze → broń czeka na `idle`. Inne stany ostrza są zajęte, poza
  `throwing`: lot ostrza nie blokuje zamiany. Żądanie czeka najwyżej
  `tuning.hands.swapBufferS` (0,4 s), potem przepada. Hitstop zatrzymuje zegary,
  ale pozwala zapamiętać naciśnięcie R. Kolejne żądania w trwającej zamianie
  nie rozpoczynają nowej zamiany.
- PPM (`block`) przy broni lub w zamianie natychmiast przywraca ostrze,
  anuluje zamianę i bufor, przekazuje blok do ostrza w tym samym kroku.
  Okno parowania zaczyna się bez opóźnienia wynikającego z zamiany.
- Środkowy przycisk (`bladeThrow`) analogicznie natychmiast przywraca ostrze
  i przekazuje rzut. Zasady dostępności rzutu i bloku w samym ostrzu pozostają
  takie jak w module walki wręcz.
- 1/2/3 (`weapon1..3`): wybór istniejącego slotu i żądanie dobycia broni,
  także po naciśnięciu bieżącego slotu. Nieistniejący slot jest ignorowany.
  Broń → inna broń zmienia model natychmiast, bez zamiany z ostrzem.

`HeldItem.step` zwraca `bladeInput` i `triggerHeld`. Przy broni usuwa
`attack/block/bladeThrow` z held, pressed i released kopii wejścia ostrza.
Pozostałe akcje przechodzą dalej. Nietrzymana broń jest krokowana przez
`Weapon.cool`, więc stygnie i przerywa wiązkę; nie strzela. Ostrze w locie
nadal symuluje lot przy broni w ręku.

## Dane, zdarzenia i widok

Loadout przyjmuje opcjonalne `startHeld: 'blade' | 'gun'`, domyślnie `blade`.
`gunner`, `stormGunner` i `resonancePistolero` zaczynają z `gun`. Reset areny
przywraca tę wartość i czyści zamianę oraz bufor.

Obie liczby z `tuning.hands` są dostępne w lil-gui. Po ukończeniu zamiany,
natychmiastowym przywróceniu ostrza oraz resecie moduł emituje
`held_item_changed: { owner, held, weapon }`. `weapon` to id wybranego slotu
przy broni, `null` przy ostrzu; id pochodzi z `weapon_switched` właściciela.
`dispose()` odpina ten nasłuch.

`Arena.heldView()` i `query('heldItem')` udostępniają `{ held, target, swapping,
swapT }`. Postęp zamiany wynosi 0..1, a poza zamianą 1. Pierwsza połowa pokazuje
przedmiot źródłowy, druga docelowy. Ostrze FPP jest dodatkowo ukryte w locie;
oba modele FPP są ukryte poza stanem `playing`. HUD przygasza blok broni przy
ostrzu na podstawie zdarzenia. Komenda debug `hold blade|gun` ustawia rękę
natychmiast i kasuje bufor/zamianę.

## Kontrola w 30 sekund

Otwórz arenę z gunner, włącz `god`. LPM strzela. R, odczekanie 0,24 s i kliknięcie
LPM daje cięcie bez strzału. PPM podczas strzelania ma od razu blokować i parować;
środkowy przycisk ma od razu rzucać ostrzem. Podczas lotu wciśnij 2, a następnie
LPM — wybrana broń strzela. Po resecie wraca karabin w ręku.

W ocenie feel zwróć uwagę na długość przerwy 0,24 s, tolerancję bufora 0,4 s
po cięciu, natychmiastowy blok i czytelność zmiany modelu w połowie zamiany.
