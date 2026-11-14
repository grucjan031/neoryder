import { MAX_TIME_S, PACK_SIZE, PLAYER_STATS, runBalance } from './simulator';
import type { BalanceResult, PathRow } from './simulator';
import { SIM_DT } from '../core/loop';

// Brief sumuje wszystkie przebicia na jednym celu. Bramkę rozstrzyga tylko
// otwarta przestrzeń; wariant przy ścianie jest informacyjny (wall-slam to
// nagroda za grę pozycyjną).
export function generateBalance() {
  return {
    open: runBalance({ repeatPierce: true, wallDistanceM: null }),
    wall: runBalance({ repeatPierce: true, wallDistanceM: 0 }),
  };
}

export type BalanceReport = ReturnType<typeof generateBalance>;

const number = (value: number) =>
  Number.isFinite(value) ? value.toFixed(3) : '∞';

function pathTable(rows: PathRow[], unit: string): string[] {
  return [
    `| Wróg | Ostrze ${unit} (s) | Moc ${unit} (s) | Strzelec ${unit} (s) | Mediana (s) | Ostrze / mediana | Moc / mediana | Strzelec / mediana | W przedziale |`,
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...rows.map(
      (row) =>
        `| ${row.enemy} | ${row.ttkS.map(number).join(' | ')} | ${number(row.medianS)} | ${row.ratios.map(number).join(' | ')} | ${row.passed ? 'TAK' : 'NIE'} |`,
    ),
    '',
    '| Wróg | Wybrane ostrze | Priorytet mocy (oba sloty) | Wybrana broń |',
    '| --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.enemy} | ${row.choices.join(' | ')} |`),
  ];
}

function attackTable(result: BalanceResult, only?: Set<string>): string[] {
  return [
    `| Narzędzie | Wróg | TTK (s) | DPS (HP/s) | TTK paczki ×${PACK_SIZE} (s) | DPS paczki (HP/s) |`,
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...result.attacks
      .filter((attack) => !only || only.has(attack.id))
      .flatMap((attack) =>
        attack.results.map((value, i) => {
          const pack = attack.packResults[i]!;
          return `| ${attack.name} (${attack.id}) | ${result.enemies[i]!.id} | ${number(value.ttkS)} | ${number(value.dps)} | ${number(pack.ttkS)} | ${number(pack.dps)} |`;
        }),
      ),
  ];
}

const failing = (rows: PathRow[]) =>
  rows
    .filter((row) => !row.passed)
    .map((row) => row.enemy)
    .join(', ') || 'brak';

export function renderReport(results: BalanceReport, date: string): string {
  const { open, wall } = results;
  const wallOnly = new Set(
    wall.attacks
      .filter(
        (row, index) =>
          !row.packResults.every(
            (value, i) =>
              value.ttkS === open.attacks[index]!.packResults[i]!.ttkS,
          ),
      )
      .map((row) => row.id),
  );
  return (
    [
      '# Balans F2 — symulacja TTK',
      '',
      `Data wygenerowania (UTC): ${date}. Generator: \`npm run balance\`.`,
      '',
      `**Bramka: ${open.passed ? 'ZALICZONA' : 'NIEZALICZONA'}** (TTK paczki ${PACK_SIZE} wrogów, otwarta przestrzeń). Poza przedziałem: ${failing(open.paths)}. Wariant przy ścianie jest informacyjny i nie wpływa na bramkę (w przedziale: ${wall.passed ? 'TAK' : 'NIE'}).`,
      'Miara: dla każdego wroga każda ścieżka musi mieć TTK paczki w [mediana / 2, mediana × 2]. Nieskończony TTK nie zalicza bramki. Ocena używa pełnej precyzji, tabele zaokrąglają do 0,001 s.',
      '',
      '## Założenia',
      '',
      `- Prawdziwe Weapon, createPower, PlasmaBlade, DamageSystem, StatusSystem, PlayerEnergy i Stats; stały krok SIM_DT = 1/60 s (${number(SIM_DT)} s), limit ${MAX_TIME_S} s na parę. Bez renderu, DOM i inicjalizacji Rapier.`,
      `- **TTK paczki:** czas zabicia ${PACK_SIZE} wrogów danego typu po kolei. Po śmierci kolejny pojawia się natychmiast w tym samym miejscu (świeże HP); ciepło broni, odnowienia, energia gracza i zegary przechodzą między celami, a statusy znikają z martwym celem. Kolejny cel nie dostaje cięcia ostrza, które zabiło poprzednika (jedno cięcie = jeden cel). To miara tempa czyszczenia fali. Pojedyncze TTK (jeden cel) zostaje w tabelach informacyjnie: karze bronie zabijające jednym strzałem (1/60 s wobec 0,4 s ostrza).`,
      '- 100% celności. Nieruchomy cel w zasięgu każdego narzędzia; brak czasu dojścia, lotu pocisku i odrzucania celu poza zasięg. Trafienia w korpus (mnożnik hurtboxa drona z danych), bez premii za głowę.',
      '- Wszystkie śruty trafiają. Zgodnie z idealizacją briefu adapter sumuje na jednym celu także wszystkie przebicia z pierceFalloff. To optymistyczne skupienie obrażeń wielu celów: w grze ProjectileSystem nie trafia ponownie tej samej encji. Łańcuch mocy zachowuje własną regułę bez powtórzeń, więc na pojedynczym celu nie przeskakuje.',
      '- Tarczownik atakowany z flanki: tarcza pominięta. Egzekutor nie paruje. Cel nie kontratakuje; ogłuszenie i wyładowanie obsługuje StatusSystem. Wyładowanie przeciążenia nie rani nosiciela, więc bez sąsiednich celów nie dodaje DPS.',
      `- Każda para zaczyna z pełnym HP celu, pełną energią (${PLAYER_STATS.maxEnergy}), zimną bronią, bez cooldownów i statusów. Bazy jak na arenie: regeneracja energii ${PLAYER_STATS.energyRegen}/s (po opóźnieniu z tuning.ts po każdym wydatku), pojemność ciepła ${PLAYER_STATS.heatCapacity}, chłodzenie ${PLAYER_STATS.coolingRate}/s. Bez implantów i synergii.`,
      '- Półautomat ponawia wciśnięcie tak szybko, jak pozwala cooldown (zwolnienie spustu bez przesuwania zegarów przez cool(0)). Combo lekkie buforuje kolejne kliknięcia. Ciężki atak to rzeczywiste przytrzymanie i puszczenie po naładowaniu; zawiera poprzedzający go lekki cios wynikający z PlasmaBlade.',
      '- Czas od wejścia do symulacji do końca kroku ostatniego zabójstwa; pierwsze natychmiastowe trafienie ma TTK 1/60 s, nigdy 0. To czas symulacji, bez pauz prezentacyjnego hitstopu i slowmo. DPS = faktycznie zdjęte HP / czas do końca starcia (bez overkill); przy ∞ DPS = zdjęte HP / pełny limit.',
      '- Ostrze: lepszy TTK combo lub ciężkiego z loadout blade. Strzelec: najlepsza pojedyncza broń loadout gunner, bez przełączania podczas walki. Moc: wszystkie ofensywne moce loadout resonance, oba sloty ponawiane w każdym kroku ze wspólną energią; sprawdzane wszystkie stałe priorytety slotów i wybierany najlepszy wynik dla wroga (osobno dla paczki i dla pojedynczego celu).',
      '- Moce bez obrażeń pomijane; nieobsługiwany rodzaj mocy pomijany z ostrzeżeniem. Błędy walidacji danych gry nadal przerywają ładowanie.',
      '- Wariant przy ścianie (0 m za celem, wall-slam w następnym kroku) jest informacyjny: nagroda za grę pozycyjną, nie część bramki. Ma osobną medianę.',
      '',
      `## Ścieżki — TTK paczki ×${PACK_SIZE}, otwarta przestrzeń (bramka)`,
      '',
      ...pathTable(open.paths, 'paczki'),
      '',
      '## Ścieżki — pojedyncze TTK, otwarta przestrzeń (informacyjnie)',
      '',
      ...pathTable(open.singlePaths, 'TTK'),
      '',
      '## Każda broń, moc i ostrze — otwarta przestrzeń',
      '',
      ...attackTable(open),
      '',
      `## Wariant przy ścianie — TTK paczki ×${PACK_SIZE} (informacyjnie)`,
      '',
      ...pathTable(wall.paths, 'paczki'),
      '',
      '### Wariant przy ścianie — pojedyncze TTK',
      '',
      ...pathTable(wall.singlePaths, 'TTK'),
      '',
      '### Moce przy ścianie (tylko narzędzia, których wynik różni się od otwartej przestrzeni)',
      '',
      ...attackTable(wall, wallOnly),
      '',
      '## Wnioski',
      '',
      `- Bramka (paczka ×${PACK_SIZE}, otwarta przestrzeń): ${open.paths.filter((row) => !row.passed).length}/${open.paths.length} wrogów poza przedziałem (${failing(open.paths)}). Pojedyncze TTK (informacyjnie): ${open.singlePaths.filter((row) => !row.passed).length}/${open.singlePaths.length}. Przy ścianie (informacyjnie, paczka): ${wall.paths.filter((row) => !row.passed).length}/${wall.paths.length}.`,
      '- Pojedyncze TTK jest bardzo wrażliwe na obrażenia jednego trafienia (zabójstwo w 1/60 s wobec 0,4 s ostrza); dlatego bramkę liczy paczka.',
      '- Wynik jest liczbową podstawą decyzji o danych. Nie zastępuje playtestu 12 fal ani oceny feel.',
      '',
      '## Decyzje i strojenie',
      '',
      'Decyzje koordynatora, zastosowane zmiany i opcje strojenia opisuje [specyfikacja symulatora](systems/balance.md#decyzje-koordynatora-2026-11-14).',
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
