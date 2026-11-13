# [F1][Moce] Pchnięcie Rezonansu i pasek energii

Agent: Moce
Folder: /src/combat/powers
Zależy od: #01 (model obrażeń), #08 (Szturmowiec — cel odrzutu)
Filar: Build-crafting

## Cel

Pierwsza moc Rezonansu: stożkowe Pchnięcie zużywające energię, z odrzutem wrogów i bonusem za uderzenie w ścianę.

## Wymagania

- Definicja w `src/data/powers/push.json` (zod): koszt energii, kąt i zasięg stożka, siła odrzutu, obrażenia, odnowienie.
- **Energia:** `Stats` (`maxEnergy` 100, `energyRegen`); regeneracja startuje po 2 s bez użycia (`tuning.powers.energyRegenDelayS`); API ładowania (parowanie, zabójstwa wręcz).
- Implementacja `ResourcePool` z #07 (spend/add) zasilana `Stats`.
- Pchnięcie: wrogowie w stożku dostają impuls; **odrzut w ścianę = dodatkowe obrażenia** (raycast/kolizja po impulsie); brak energii = brak użycia i zdarzenie odmowy.
- Wejście `power` (klawisz F); losowość tylko `Rng`.
- Hook feedback: hitstop 40 ms, wstrząs kamery, błysk magenta (VFX), dźwięk.
- Tagi `#power` na obrażeniach.

## Kontrakt (do zatwierdzenia w docs/api.md)

> Obowiązuje ujednolicona wersja z `docs/adr/0003-kontrakty-f1.md` (nazwy, payloady, `ResourcePool`, `DamageSystem`, `ProjectileSystem`).

```ts
energy_changed: {
  id: EntityId;
  current: number;
  max: number;
}
power_denied: {
  power: string;
  user: EntityId;
  reason: 'no_energy' | 'cooldown';
}
power_used: {
  power: string;
  user: EntityId;
} // istnieje
```

## Kryteria akceptacji

- [ ] Vitest: użycie zużywa energię, brak energii = odmowa
- [ ] Vitest: regeneracja po 2 s bez użycia, nie wcześniej
- [ ] Vitest: wróg w stożku odrzucony, poza stożkiem nietknięty
- [ ] Vitest: odrzut w ścianę zadaje dodatkowe obrażenia
- [ ] Vitest: zabójstwo wręcz i parowanie ładują energię (zdarzenia `enemy_killed` z tagiem `#melee`, `parry_success`)
- [ ] Scena `?scene=push-test` ze ścianą i manekinami
- [ ] Aktualizacja /docs/systems/powers.md

## Poza zakresem

Pozostałe moce (Chwyt, Błyskawica, Fala, Bariera, Skupienie — F2), ulepszenia z drzewek, synergie hybrydowe, rysowanie paska (#15).
