import { MAX_TIME_S, PLAYER_STATS, runBalance } from './simulator';
import type { BalanceResult } from './simulator';
import { SIM_DT } from '../core/loop';

// Brief sumuje wszystkie przebicia na jednym celu. Oba warianty otoczenia
// pokazujemy osobno, bo kontrakt zadania nie określa obecności ściany.
export function generateBalance() {
  return {
    open: runBalance({ repeatPierce: true, wallDistanceM: null }),
    wall: runBalance({ repeatPierce: true, wallDistanceM: 0 }),
  };
}

export type BalanceReport = ReturnType<typeof generateBalance>;

const number = (value: number) =>
  Number.isFinite(value) ? value.toFixed(3) : '∞';

function pathTable(result: BalanceResult): string[] {
  return [
    '| Wróg | Ostrze TTK (s) | Moc TTK (s) | Strzelec TTK (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | Bramka |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...result.paths.map(
      (row) =>
        `| ${row.enemy} | ${row.ttkS.map(number).join(' | ')} | ${number(row.medianS)} | ${row.ratios.map(number).join(' | ')} | ${row.passed ? 'TAK' : 'NIE'} |`,
    ),
    '',
    '| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |',
    '| --- | --- | --- | --- |',
    ...result.paths.map(
      (row) => `| ${row.enemy} | ${row.choices.join(' | ')} |`,
    ),
  ];
}

function attackTable(result: BalanceResult): string[] {
  return [
    '| Narzędzie | Wróg | TTK (s) | DPS (HP/s) |',
    '| --- | --- | ---: | ---: |',
    ...result.attacks.flatMap((attack) =>
      attack.results.map(
        (value, i) =>
          `| ${attack.name} (${attack.id}) | ${result.enemies[i]!.id} | ${number(value.ttkS)} | ${number(value.dps)} |`,
      ),
    ),
  ];
}

export function renderReport(results: BalanceReport, date: string): string {
  const { open, wall } = results;
  return (
    [
      '# Balans F2 — symulacja TTK',
      '',
      `Data wygenerowania (UTC): ${date}. Generator: \`npm run balance\`.`,
      '',
      `**Bramka: ${open.passed && wall.passed ? 'ZALICZONA' : 'NIEZALICZONA'}.** Otwarta przestrzeń: ${open.passed ? 'TAK' : 'NIE'}; cel przy ścianie: ${wall.passed ? 'TAK' : 'NIE'}.`,
      'Dla każdego wroga każda ścieżka musi mieć TTK w [mediana / 2, mediana × 2]. Nieskończony TTK nie zalicza bramki. Ocena używa pełnej precyzji, tabele zaokrąglają do 0,001 s.',
      '',
      '## Założenia',
      '',
      `- Prawdziwe Weapon, createPower, PlasmaBlade, DamageSystem, StatusSystem, PlayerEnergy i Stats; stały krok SIM_DT = 1/60 s (${number(SIM_DT)} s), limit ${MAX_TIME_S} s na parę. Bez renderu, DOM i inicjalizacji Rapier.`,
      '- 100% celności. Nieruchomy, pojedynczy cel w zasięgu każdego narzędzia; brak czasu dojścia, lotu pocisku i odrzucania celu poza zasięg. Trafienia w korpus (mnożnik hurtboxa drona z danych), bez premii za głowę.',
      '- Wszystkie śruty trafiają. Zgodnie z idealizacją briefu adapter sumuje na jednym celu także wszystkie przebicia z pierceFalloff. To optymistyczne skupienie obrażeń wielu celów: w grze ProjectileSystem nie trafia ponownie tej samej encji. Łańcuch mocy zachowuje własną regułę bez powtórzeń, więc na pojedynczym celu nie przeskakuje.',
      '- Tarczownik atakowany z flanki: tarcza pominięta. Egzekutor nie paruje. Cel nie kontratakuje; ogłuszenie i wyładowanie obsługuje StatusSystem. Wyładowanie przeciążenia nie rani nosiciela, więc bez sąsiednich celów nie dodaje DPS.',
      `- Każda para zaczyna z pełnym HP celu, pełną energią (${PLAYER_STATS.maxEnergy}), zimną bronią, bez cooldownów i statusów. Bazy jak na arenie: regeneracja energii ${PLAYER_STATS.energyRegen}/s, pojemność ciepła ${PLAYER_STATS.heatCapacity}, chłodzenie ${PLAYER_STATS.coolingRate}/s; opóźnienia i blokady z tuning.ts. Bez implantów i synergii.`,
      '- Półautomat ponawia wciśnięcie tak szybko, jak pozwala cooldown (zwolnienie spustu bez przesuwania zegarów przez cool(0)). Combo lekkie buforuje kolejne kliknięcia. Ciężki atak to rzeczywiste przytrzymanie i puszczenie po naładowaniu; zawiera poprzedzający go lekki cios wynikający z PlasmaBlade.',
      '- Czas od wejścia do symulacji do końca kroku zabójstwa; pierwsze natychmiastowe trafienie ma TTK 1/60 s, nigdy 0. Jest to czas symulacji, bez pauz prezentacyjnego hitstopu i slowmo. DPS = faktycznie zdjęte HP / czas do śmierci (bez overkill); przy ∞ DPS = zdjęte HP / pełny limit. To DPS danego starcia, nie nieskończonego ostrzału.',
      '- Ostrze: lepszy TTK combo lub ciężkiego z loadout blade. Strzelec: najlepsza pojedyncza broń loadout gunner, bez przełączania podczas walki. Moc: wszystkie ofensywne moce loadout resonance, oba sloty ponawiane w każdym kroku ze wspólną energią; sprawdzane wszystkie stałe priorytety slotów i wybierany najlepszy wynik dla wroga.',
      '- Moce bez obrażeń pomijane; nieobsługiwany rodzaj mocy pomijany z ostrzeżeniem. Błędy walidacji danych gry nadal przerywają ładowanie.',
      '- Brief nie określa ścian: raport pokazuje dwa warianty, bez rozstrzygania za koordynatora. Główne tabele: otwarta przestrzeń, bez wall-slam. Drugi wariant: ściana tuż za celem (0 m), dodatkowe obrażenia z ConePower w następnym kroku. Każdy wariant ma osobną medianę i bramkę.',
      '',
      '## Ścieżki — otwarta przestrzeń',
      '',
      ...pathTable(open),
      '',
      '## Każda broń, moc i ostrze — otwarta przestrzeń',
      '',
      ...attackTable(open),
      '',
      '## Wrażliwość na ścianę — ścieżki',
      '',
      ...pathTable(wall),
      '',
      '### Moce przy ścianie',
      '',
      ...attackTable({
        ...wall,
        attacks: wall.attacks.filter(
          (row) =>
            !open.attacks
              .find((other) => other.id === row.id)
              ?.results.every(
                (value, i) => value.ttkS === row.results[i]!.ttkS,
              ),
        ),
      }),
      '',
      '## Wnioski',
      '',
      `- Otwarta przestrzeń: ${open.paths.filter((row) => !row.passed).length}/${open.paths.length} wrogów poza bramką. Cel przy ścianie: ${wall.paths.filter((row) => !row.passed).length}/${wall.paths.length} poza bramką.`,
      '- Jednostrzałowe zabójstwa Strzelca mają TTK jednego kroku, podczas gdy ostrze potrzebuje zamachu, a Moc kolejnych aktywacji. Ilorazy przy małym HP są przez to bardzo wrażliwe na obrażenia pojedynczego trafienia. Test nie ukrywa tego przez uśrednianie wrogów.',
      '- Wynik jest liczbową podstawą decyzji o danych i założeniach bramki. Nie zastępuje playtestu 12 fal ani oceny feel. Liczby balansu w danych nie zostały zmienione.',
      '',
      '## Propozycja do decyzji koordynatora (niezastosowana)',
      '',
      'Historyczna próba pięciu zmian pól, jej dokładne wartości i wyniki są opisane w [specyfikacji symulatora](systems/balance.md#propozycja-danych-do-decyzji-koordynatora-2026-11-14). Dane gry nie zostały zmienione. Wybór wariantu otoczenia i kierunku strojenia wymaga decyzji koordynatora.',
      '',
      '### Ograniczenie loadera nieznanych mocy',
      '',
      'Symulator ostrzega i pomija nieobsługiwane rodzaje udostępnione przez rejestr. Obecny rejestr gry jednak waliduje wszystkie JSON-y przez powerSchema już podczas importu: rodzaj spoza jego unii przerwie import przed uruchomieniem symulatora. Pełne pomijanie surowego JSON-a z nieznanym kind wymaga zmiany loadera poza dozwolonym zakresem; do decyzji Architekta.',
      '',
      ...[...new Set([...open.warnings, ...wall.warnings])].map(
        (warning) => `Ostrzeżenie: ${warning}`,
      ),
    ]
      .join('\n')
      .trimEnd() + '\n'
  );
}
