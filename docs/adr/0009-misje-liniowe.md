# ADR 0009 — Misje liniowe

- **Status:** przyjęty 17 XI 2026 (decyzja właściciela). Zastępuje sekcję 1 ADR 0008 („Misja = run z warunkiem celu”) dla misji z poziomem; reszta ADR 0008 (dane misji, cele, radio, odprawy, kampania, nagroda za pierwsze ukończenie) obowiązuje dalej.
- **Zakres pierwszej implementacji:** M01 „Maszty”.

## Kontekst

Właściciel ocenił, że misje fabularne mają być kompletnie liniowym doświadczeniem singleplayer — gracz przechodzi przez ciągłą mapę, wykonuje cele i walczy z wrogami po drodze — a nie runem z warstwami, mapą wyboru ścieżki, sklepem i odpoczynkiem. Na razie przerabiamy tylko M01 „Maszty”.

## Decyzje

### D1. Osobna scena `mission`
Misje liniowe działają w osobnej scenie `mission` (`?scene=mission&mission=m01-maszty`), bez `RunState`, mapy sektora, sklepu, odpoczynku, nagród za pokoje i ulepszeń runu. Zwykły run i Przejęcie działają bez zmian.

### D2. Poziom jako jedna ciągła mapa
Poziom to pojedynczy plik w `src/data/levels/<id>.json`, walidowany schematem zod. Geometria korzysta z formatu pokoju; nowe elementy poziomu to:
- **spotkania:** strefa wyzwalająca, fala z `src/data/waves`, opcjonalny warunek `after`,
- **punkty kontrolne,**
- **bramy:** znikające po ukończeniu wskazanego celu lub spotkania,
- **pozycje celów.**

### D3. Struktura M01 „Maszty”
5–7 różnych odcinków, ścieżka ok. 250–400 m, jeden kierunek. Cele w ustalonej kolejności: `mast-1` → `mast-2` → `helix` → `mast-3` → `exit`. 6–10 spotkań z narastającą trudnością; bramy wymuszają kolejność przejścia.

### D4. Punkty kontrolne i zapis
Punkty kontrolne zapisywane są przez `SaveStore` jako osobny rekord misji (nie stan runu), z migracją `saveVersion`. Śmierć odradza gracza w ostatnim punkcie kontrolnym; spotkania za punktem resetują się, a wykonane cele zostają. Kryjówka proponuje „Kontynuuj misję”, gdy zapisany rekord jest aktywny.

### D5. Wyposażenie i nagrody
Gracz wchodzi z wyposażeniem z meta-progresu kryjówki, bez ulepszeń w trakcie misji. Nagroda przyznawana jest wyłącznie za pierwsze ukończenie (bez podwójnego naliczania).

### D6. Zgodność i dostępność misji
Misja z polem `level` jest liniowa; misje bez niego działają jak w ADR 0008. M03 i M06 zostają ukryte na tablicy misji z etykietą „wkrótce” do czasu przeróbki na poziomy liniowe.

### D7. Wydajność
Cała mapa ładowana jest naraz, statyczna geometria scalana w komórkach, a aktywni pozostają wyłącznie wrogowie bieżących spotkań. Wartości liczbowe pochodzą z danych poziomu albo `tuning.ts`.

### D8. Debug
Komendy konsoli debug i diagnostyki: `mission start <id>`, `checkpoint <id>`, `objective done <id>`, `encounter clear`, `query('mission')`.

## Konsekwencje

**Plusy:**
- prowadzona narracja,
- pełna kontrola tempa rozgrywki,
- ręcznie projektowane sceny i starcia.

**Minusy i ryzyka:**
- większy nakład pracy na mapy dla każdej misji,
- mniejsza powtarzalność w porównaniu z runem,
- rozmiar ciągłej mapy a budżet wydajności,
- konieczność późniejszej przeróbki M03 i M06,
- zmiana schematu zapisu wymagająca migracji `saveVersion`.

## Alternatywy odrzucone

- **Zostawić misję jako run z warstwami:** odrzucone przez właściciela (nie daje ciągłego doświadczenia singleplayer).
- **Misja jako sekwencja osobnych pokojów z ekranem ładowania:** gorsza ciągłość świata i przepływu gry niż jedna mapa.
