import { tuning } from '../core/tuning';
import player from '../data/scenes/roomPlayer.json';
import type { EnemyDefinition } from '../enemies/enemySchema';
import { insideLevelZone } from '../world/levelRuntime';
import { levelDefinitions, levelWaves } from '../world/levels';
import { missionCatalog } from '../world/missionCatalog';
import { RailPayload } from '../world/railPayload';
import type { WavesDefinition } from '../world/waves';
import { enemyDefinitions, PACK_SIZE, runBalance } from './simulator';
import type { BalanceResult } from './simulator';

export const reportSettings = { approachS: 1.5, accuracy: 0.35 };
export const severity = (percent: number) =>
  percent > 100 ? 'zabójcze' : percent > 60 ? 'ciężkie' : '—';
export const lowReserve = (percent: number) => percent < 25;
export const trend = (before: number, after: number) =>
  after > 2 * before ? 'skok' : after < before ? 'spadek' : '';

export function attackDps(e: EnemyDefinition): number {
  if (e.boss) {
    const phases = e.boss.phases;
    return phases.reduce((sum, phase, i) => {
      const weight = phase.hpThreshold - (phases[i + 1]?.hpThreshold ?? 0);
      let seconds = 0;
      let damage = 0;
      for (const pattern of phase.patterns) {
        seconds += pattern.telegraphS + pattern.recoveryS + pattern.cooldownS;
        damage +=
          pattern.damage *
          (pattern.kind === 'fan' ? pattern.projectileCount : 1);
      }
      return sum + (weight * damage) / seconds;
    }, 0);
  }
  if (e.hack) return e.damage / (e.hack.hackTelegraphS + e.hack.hackCooldownS);
  if (e.projectileDamage !== undefined) {
    const count = e.burstCount!;
    return (
      (e.projectileDamage * count) /
      (e.aimTelegraphS! + (count - 1) * e.burstIntervalS! + e.cooldownS)
    );
  }
  return (
    e.damage /
    (e.telegraphS + e.swingActiveS + Math.max(e.cooldownS, e.recoveryS))
  );
}

const mean = (values: number[]) =>
  values.reduce((sum, n) => sum + n, 0) / values.length;

export function measureWave(
  wave: WavesDefinition,
  levelLimit: number,
  balance: BalanceResult,
  settings = reportSettings,
) {
  const limit = Math.min(wave.maxAlive, levelLimit, tuning.level.maxAlive);
  const times = [0, 0, 0];
  const damage = [0, 0, 0];
  let health = 0;
  let peak = 0;
  let peakDps = 0;
  let priority = '';
  let highestDps = -1;
  const composition = wave.waves.map(({ groups }) => {
    const rates: number[] = [];
    const duration = [0, 0, 0];
    const counts = new Map<string, number>();
    for (const { enemy, count } of groups)
      counts.set(enemy, (counts.get(enemy) ?? 0) + count);
    for (const [enemy, count] of counts) {
      const e = enemyDefinitions.get(enemy)!;
      health += count * e.maxHealth;
      const rate = attackDps(e) * settings.accuracy;
      if (rate > highestDps) {
        highestDps = rate;
        priority = enemy;
      }
      rates.push(...Array<number>(count).fill(rate));
      const single = [...balance.singlePaths, ...balance.bossPaths].find(
        (row) => row.enemy === enemy,
      )!.ttkS;
      const pack = balance.paths.find((row) => row.enemy === enemy)?.ttkS;
      for (const [i, first] of single.entries()) {
        const next = pack ? (pack[i]! - first) / (PACK_SIZE - 1) : first;
        duration[i]! += first + (count - 1) * next + count * settings.approachS;
      }
    }
    const concurrent = rates.sort((a, b) => b - a).slice(0, limit);
    const dps = concurrent.reduce((sum, rate) => sum + rate, 0);
    peak = Math.max(peak, concurrent.length);
    peakDps = Math.max(peakDps, dps);
    duration.forEach((seconds, i) => {
      times[i]! += seconds;
      damage[i]! += dps * seconds;
    });
    return [...counts].map(([id, n]) => `${id} ×${n}`).join(', ');
  });
  const pressure = damage.map((hp) => (100 * hp) / player.maxHealth);
  return {
    health,
    peak,
    peakDps,
    priority,
    composition,
    times,
    pressure,
    limit,
    seconds: mean(times),
    percent: mean(pressure),
  };
}

export function analyzeAct(balance = runBalance(), settings = reportSettings) {
  return [...missionCatalog.values()]
    .filter((m) => m.act === 1)
    .sort((a, b) => a.number - b.number)
    .map((m) => {
      const level = levelDefinitions.get(m.level!)!;
      const rows = level.encounters
        .map((e) => {
          const section = level.sections.findIndex((s) =>
            insideLevelZone(e.zone.position, s.zone),
          );
          if (section < 0)
            throw new Error(`Starcie poza sekcjami: ${m.id}/${e.id}`);
          const key = e.reinforcementFor;
          const [objectiveId, index] = key?.split(':') ?? [];
          const objective = m.objectives.find((o) => o.id === objectiveId);
          const threshold =
            objective?.kind === 'defend'
              ? objective.waves?.[Number(index)]?.atProgress
              : undefined;
          const trigger =
            threshold !== undefined
              ? `${key} przy ${threshold.toLocaleString('pl-PL', { style: 'percent', maximumFractionDigits: 3 }).replace(/\s/g, '')}`
              : objective?.kind === 'sabotage'
                ? `wybuch ${objective.id}`
                : e.after
                  ? `strefa po ${e.after.id}`
                  : 'strefa';
          const wave = levelWaves.get(e.wave)!;
          return {
            id: e.id,
            wave: e.wave,
            section,
            sectionId: level.sections[section]!.id,
            trigger,
            waveLimit: wave.maxAlive,
            ...measureWave(
              wave,
              level.maxAlive ?? tuning.level.maxAlive,
              balance,
              settings,
            ),
          };
        })
        .sort((a, b) => a.section - b.section);
      const escorts = m.objectives
        .filter((o) => o.kind === 'escortPayload')
        .map((o) => {
          const data = level.payload!;
          const params = tuning.prototypes.payload;
          const route = new RailPayload(data.route, [], params, {
            reinforce: () => {},
          });
          // RoomScene przekazuje AI tylko gracza i drużynę. Wagon jest neutralnym hurtboxem.
          const attackers = 0;
          const targetedDps = 0;
          const travelS = route.lengthM / params.speedMps;
          const reserve =
            100 * (1 - (targetedDps * travelS) / params.maxHealth);
          return {
            id: o.id,
            length: route.lengthM,
            speed: params.speedMps,
            health: params.maxHealth,
            stops: data.stops.length,
            travelS,
            attackers,
            targetedDps,
            reserve,
          };
        });
      return {
        id: m.id,
        title: m.title,
        rows,
        escorts,
        levelLimit: level.maxAlive ?? tuning.level.maxAlive,
        seconds: mean(rows.map((r) => r.seconds)),
        percent: mean(rows.map((r) => r.percent)),
      };
    });
}

type Mission = ReturnType<typeof analyzeAct>[number];
const format = (v: number) => v.toFixed(1).replace('.', ',');
const triple = (v: number[]) => v.map(format).join(' / ');
const paths = ['Ostrze', 'Moc', 'Strzelec'];

function changes(
  previous: { seconds: number; percent: number } | undefined,
  current: { seconds: number; percent: number },
) {
  if (!previous) return '—';
  return (
    (['seconds', 'percent'] as const)
      .flatMap((key) => {
        const label = trend(previous[key], current[key]);
        return label
          ? [
              `${key === 'seconds' ? 'czas' : 'presja'} ${label} ×${format(current[key] / previous[key])}`,
            ]
          : [];
      })
      .join(', ') || '—'
  );
}

export function renderMissionReport(
  act: Mission[],
  date: string,
  settings = reportSettings,
) {
  const entries = act.flatMap((m) =>
    m.rows.map((row) => ({ mission: m.id, row })),
  );
  const ranked = entries
    .filter(({ row }) => Math.max(...row.pressure) > 60)
    .sort((a, b) => Math.max(...b.row.pressure) - Math.max(...a.row.pressure));
  const lines = [
    '# Balans misji aktu I — fale i eskorta',
    '',
    `Data wygenerowania (UTC): ${date}. Generator: \`npm run balance:missions\`.`,
    '',
    '## Założenia',
    '',
    `Poziom normalny, bazowe ${player.maxHealth} HP gracza. Kolejność wartości w trójkach: Ostrze / Moc / Strzelec. Symulator z [raportu TTK](balance.md) wybiera dla typu wroga najlepsze combo lub ciężkie cięcie, priorytet mocy albo broń odpowiedniego loadoutu w otwartej przestrzeni. Pierwszy cel kosztuje pojedynczy TTK; każdy kolejny tego typu w tej samej turze kosztuje (TTK paczki − pojedynczy TTK) / ${PACK_SIZE - 1}. Boss korzysta z pojedynczego pomiaru. Dodano ${format(settings.approachS)} s dojścia na każdego wroga. Czasy obejmują wyłącznie czyszczenie.`,
    '',
    `W każdej turze sumujemy DPS najsilniejszych przeciwników do limitu żywych i mnożymy przez skuteczność ${format(100 * settings.accuracy)}% oraz czas czyszczenia daną ścieżką. Sumujemy obrażenia kolejnych tur. To scenariusz utrzymania pełnej presji aż do ostatniego zabójstwa. Tabela pokazuje szczyt DPS po korekcie celności. Kolumna żywych podaje szczyt / maxAlive fali / maxAlive poziomu; dodatkowy limit globalny wynosi ${tuning.level.maxAlive}.`,
    '',
    'DPS serii = obrażenia pocisku × liczba pocisków / (celowanie + odstępy w serii + odnowienie). W zwarciu cykl obejmuje zapowiedź, aktywne cięcie i dłuższy z czasów odzyskania gotowości i odnowienia. Haker korzysta z cyklu zakłócenia. Dla Brandta sumujemy obrażenia i czasy wzorców każdej fazy, licząc pociski wachlarza i ważąc DPS udziałem fazy w HP. Pomijamy dodatkową osłonę i przywołanych pomocników w presji bossa.',
    '',
    'Środek strefy startowej przypisuje starcie do sekcji. W sekcji zachowujemy kolejność wpisów poziomu. W M01 wybuch masztu przekazuje klucz celu przez RoomScene.reinforceMission. W M03 MissionObjectives przekazuje klucz celu i indeks po przekroczeniu progu obrony. MissionScene uruchamia wpis reinforcementFor o tym kluczu; blokada ponownego startu zapobiega podwójnemu naliczeniu posiłków po sabotażu, także przy aktywacji strefy. Spotkania mogą trwać równolegle.',
    '',
    '## Dziesięć starć o najwyższej presji',
    '',
    'Ranking według największego odsetka HP spośród trzech ścieżek. Propozycje dotyczą prób w playteście.',
    '',
    ...ranked.slice(0, 10).map(({ mission, row }, i) => {
      const percent = Math.max(...row.pressure);
      const proposal =
        row.peak < row.waveLimit && row.peak > 1
          ? `sprawdzić maxAlive ${row.waveLimit} → ${row.peak - 1} (obecny szczyt: ${row.peak})`
          : `sprawdzić skład fali po usunięciu jednej jednostki typu ${row.priority}`;
      return `${i + 1}. **${mission} / ${row.id}** (${row.wave}) — ${paths[row.pressure.indexOf(percent)]}, ${format(percent)}% HP; ${proposal}.`;
    }),
    '',
    '## Starcia w kolejności sekcji',
    '',
    'Flagi ścieżek według niezaokrąglonego wyniku: powyżej 60% HP ciężkie, powyżej 100% zabójcze. Zmiana porównuje średnie z trzech ścieżek z poprzednim starciem, również na granicy misji. Skok oznacza wzrost ponad dwukrotny. Strzałka w składzie oddziela kolejne tury.',
  ];
  let previous: Mission['rows'][number] | undefined;
  for (const m of act) {
    lines.push(
      '',
      `### ${m.id} — ${m.title}`,
      '',
      '| Sekcja / starcie | Wyzwalacz | Fala i skład tur | HP | Żywi | DPS | Czas (s) | Utrata HP (%) | Flagi ścieżek | Zmiana |',
      '| --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |',
    );
    for (const r of m.rows) {
      lines.push(
        `| ${r.sectionId} / ${r.id} | ${r.trigger} | ${r.wave}: ${r.composition.join(' → ')} | ${r.health} | ${r.peak} / ${r.waveLimit} / ${m.levelLimit} | ${format(r.peakDps)} | ${triple(r.times)} | ${triple(r.pressure)} | ${r.pressure.map(severity).join(' / ')} | ${changes(previous, r)} |`,
      );
      previous = r;
    }
  }
  lines.push(
    '',
    '## Eskorty',
    '',
    '| Misja / cel | HP | m/s | Trasa (m) | Jazda bez postojów (s) | Postoje | Celujących | Celowany DPS | Zapas HP | Flaga <25% |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  );
  for (const m of act)
    for (const e of m.escorts) {
      lines.push(
        `| ${m.id} / ${e.id} | ${e.health} | ${format(e.speed)} | ${format(e.length)} | ${format(e.travelS)} | ${e.stops} | ${e.attackers} | ${e.targetedDps} | ${format(e.reserve)}% | ${lowReserve(e.reserve) ? 'niski zapas' : '—'} |`,
      );
    }
  lines.push(
    '',
    `RoomScene przekazuje AI gracza i sojuszników. Neutralny wagon przyjmuje przypadkowe trafienia przez hurtbox. Ich częstość zależy od ustawienia drużyny i linii ognia. Zapas opisuje wyłącznie ogień celowany. RailPayload mierzy długość łamanej w 3D; wymaga gracza w promieniu ${tuning.prototypes.payload.pushRadiusM} m, a wróg w promieniu ${tuning.prototypes.payload.contestRadiusM} m blokuje ruch. W playteście warto zmierzyć HP na mecie oraz czas unieruchomienia przy każdym postoju.`,
    ...act.flatMap((m) =>
      m.escorts.map(
        (e) =>
          `\nPróg dla ${m.id}: utrata ponad ${format(e.health * 0.75)} HP zostawi mniej niż 25% zapasu. Przy samym czasie jazdy odpowiada to średnio ponad ${format((e.health * 0.75) / e.travelS)} HP/s przypadkowych trafień. Postoje wydłużają ekspozycję.`,
      ),
    ),
    '',
    '## Krzywa aktu I',
    '',
    'Każde starcie i każda ścieżka mają równą wagę w średniej misji.',
    '',
    '| Misja | Starcia | Średni czas (s) | Średnia utrata HP (%) | Zmiana względem poprzedniej misji |',
    '| --- | ---: | ---: | ---: | --- |',
  );
  act.forEach((m, i) =>
    lines.push(
      `| ${m.id} | ${m.rows.length} | ${format(m.seconds)} | ${format(m.percent)} | ${changes(act[i - 1], m)} |`,
    ),
  );
  for (const [label, series] of [
    ['Misje', act],
    ['Starcia', entries.map((e) => e.row)],
  ] as const) {
    const monotone = (key: 'seconds' | 'percent') =>
      series.every((r, i) => !i || r[key] >= series[i - 1]![key])
        ? 'tak'
        : 'nie';
    lines.push(
      '',
      `${label} — przebieg niemalejący: czas ${monotone('seconds')}, presja ${monotone('percent')}.`,
    );
  }
  lines.push(
    '',
    '## Ograniczenia',
    '',
    'Model pomija oczekiwanie na spawny, osłony, tokeny ataku, utratę linii widzenia, podział ognia na sojuszników oraz zmniejszanie się liczby żywych. Zawyża ekspozycję, gdy gracz szybko eliminuje najgroźniejszy cel. Z kolei pominięcie nakładania się spotkań może zaniżyć presję. Celność gracza i warunki trafienia pochodzą z symulatora TTK. Wynik powyżej 100% oznacza wyczerpanie bazowego HP w tym scenariuszu, a nie zmierzone prawdopodobieństwo śmierci.',
    '',
    '## Wynik generatora',
    '',
    `\`npm run balance:missions\` — liczba misji: ${act.length}, starć: ${entries.length}, eskort: ${act.reduce((sum, m) => sum + m.escorts.length, 0)}. ${ranked.length} starć przekracza 60% HP dla co najmniej jednej ścieżki.`,
    '',
    '### Sprawdzenia wersji R4 z 24.11.2026',
    '',
    '- `npm run check` — kod 0 po powtórzeniu bez Playwrighta. TypeScript i ESLint przeszły. Vitest: 3887 + 39 = 3926 zaliczonych testów w 319 plikach. Pierwsza próba przy równoległym E2E przekroczyła pięć budżetów w arenaPerf.',
    '- `vitest run tests/unit/missionBalance.test.ts` — 4/4 testy przeszły, w tym niezależne generowanie tekstu i progi na syntetycznych danych.',
    '- Próba mutacyjna — test progów wykrył 4/4 podstawień operatorów na granicach 60%, 100%, 25% i ×2.',
    '- `npm run balance` — bramka otwartej przestrzeni zaliczona. Następnie `git diff --exit-code -- docs/balance.md` zwrócił kod 0.',
    '- Playwright — 39/133 scenariuszy zaliczonych. Przebieg zatrzymano podczas demoPath, aby powtórzyć pomiary wydajności areny bez obciążenia przeglądarką.',
    '',
  );
  return lines.join('\n');
}
