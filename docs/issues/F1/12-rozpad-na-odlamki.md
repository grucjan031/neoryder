# [F1][Grafika, VFX i audio] Rozpad wrogów na odłamki z poolingiem

Agent: Grafika, VFX i audio
Folder: /src/vfx
Zależy od: #01 (zdarzenie `damage_dealt`), #05 (shader i paleta), #08 (wróg do rozbicia)
Filar: Walka, która „czuje się” świetnie

## Cel

Po śmierci wróg rozpada się na czerwone odłamki z fizyką, kierunek zgodny z ciosem, bez spadków FPS w dużych falach.

## Wymagania

- Nasłuch `enemy_killed` oraz `damage_dealt` (punkt i kierunek ciosu); liczba odłamków skalowana siłą ciosu (np. 12–30).
- Odłamki jako `InstancedMesh` z pulą o stałym rozmiarze; recykling najstarszych po przekroczeniu limitu.
- Fizyka odłamków uproszczona (kinematyka własna lub Rapier z limitem `tuning.physics.maxDynamicBodies` = 300 i `tuning.vfx.maxDebris`), grupa `CollisionGroup.Debris`; odłamki znikają po czasie życia.
- Odłamki nie kolidują z graczem; kolizja z podłogą i ścianami.
- Losowość rozrzutu: tylko kosmetyczna (dozwolony lokalny generator, nie wpływa na symulację).
- Materiał z palety `enemy` (#05).
- Test wydajności: spawn 20 wrogów i zabicie ich naraz.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

Brak nowych zdarzeń. Opcjonalne API `debrisBurst(origin, dir, count, material)`.

## Kryteria akceptacji

- [ ] Vitest: pula nie przekracza limitu, najstarsze odłamki są recyklingowane
- [ ] Vitest: kierunek startowy odłamków zgodny z kierunkiem ciosu (kąt w tolerancji)
- [ ] Vitest: liczba odłamków rośnie z siłą ciosu
- [ ] Scena `?scene=debris-test` z komendą `spawn assaulter 20` i `kill all`
- [ ] Playwright: scena ładuje się, po zabiciu 20 wrogów FPS ≥ progu z QA (np. 45)
- [ ] Aktualizacja /docs/systems/vfx.md

## Poza zakresem

Cząsteczki iskier i błysków poza odłamkami, rozpad obiektów nie-wrogów, dźwięki (#14).
