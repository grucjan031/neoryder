import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkArena } from './lib/check.mjs';
import { writeArenaSvg } from './lib/map.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const runDirectory = resolve(directory, 'run');

/** Generator runu leży w tools/arenas/run/<id>.mjs i jest sprawdzany profilem `run`. */
async function build(id) {
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(id) || id === 'build')
    throw new Error(`Niepoprawne id generatora: ${id}.`);
  const runFile = resolve(runDirectory, `${id}.mjs`);
  const isRun = existsSync(runFile);
  const generator = await import(
    pathToFileURL(isRun ? runFile : resolve(directory, `${id}.mjs`)).href
  );
  if (typeof generator.default !== 'function')
    throw new Error(`${id}.mjs musi eksportować default function generate().`);
  const arena = await generator.default();
  if (arena.toRoom().id !== id)
    throw new Error(`Id wyniku nie pasuje do nazwy generatora ${id}.`);
  const demo = id === 'arenaLibDemo';
  if (generator.fixtureOnly && !demo)
    throw new Error('fixtureOnly jest zarezerwowane dla arenaLibDemo.');
  const report = checkArena(arena, arena.metadata, {
    demo,
    ...(isRun ? { profile: 'run' } : {}),
  });
  const destination = demo
    ? resolve(root, `tests/fixtures/${id}.json`)
    : resolve(root, `src/data/rooms/${id}.json`);
  const svg = demo
    ? resolve(root, `tests/fixtures/${id}.svg`)
    : resolve(root, `docs/arenas/${isRun ? 'run/' : ''}${id}.svg`);
  console.log(
    `${id}${isRun ? ' [run]' : ''}: ${report.metrics.widthM}×${report.metrics.depthM} m; chodzenie ≈${report.metrics.areaM2} m²; strefy ${report.metrics.zones}; poziomy ${report.metrics.levels.join('/')} m; spawny ${report.metrics.spawnCount}`,
  );
  console.log(
    `  Obwiednia: ${JSON.stringify(report.metrics.bounds)}; wypełnienie ${(report.metrics.outlineFillRatio * 100).toFixed(1)}%; strefy: ${report.metrics.zoneKinds.join(', ')}`,
  );
  const prop = report.metrics.mostCommonProp;
  console.log(
    `  Rekwizyty: ${report.metrics.propCount}; najczęstszy: ${prop ? `${prop.model} ${prop.count} (${(prop.share * 100).toFixed(1)}%)` : 'brak'}`,
  );
  if (isRun)
    console.log(
      `  Bloki: ${arena.toRoom().blocks.length}; światła: ${arena.toRoom().lights?.length ?? 0}; trasa start→wyjście: zablokowane ${report.metrics.routeBlockedM} m, strefy ${report.metrics.routeZones}`,
    );
  for (const issue of report.issues)
    console.log(
      `  ${issue.severity === 'error' ? 'BŁĄD' : 'UWAGA'} [${issue.code}] ${issue.message}${issue.details ? ` ${JSON.stringify(issue.details)}` : ''}`,
    );
  // Rzut błędnego projektu pomaga w review, ale JSON gry zapisujemy dopiero bez błędów.
  writeArenaSvg(svg, arena);
  if (report.errors.length) return false;
  arena.write(destination);
  console.log(`  JSON: ${destination}\n  SVG: ${svg}`);
  return true;
}

const generatorIds = (dir) =>
  readdirSync(dir)
    .filter((file) => file.endsWith('.mjs') && file !== 'build.mjs')
    .map((file) => file.slice(0, -4))
    .sort();

const args = process.argv.slice(2);
try {
  if (args.length !== 1)
    throw new Error('Użycie: node tools/arenas/build.mjs <id> | --all | --run');
  // run/ zawiera także pliki pomocnicze; generatorem jest plik eksportujący default.
  const ids =
    args[0] === '--all'
      ? generatorIds(directory)
      : args[0] === '--run'
        ? generatorIds(runDirectory).filter((id) => !id.startsWith('_'))
        : args;
  let success = true;
  for (const id of ids) {
    try {
      if (!(await build(id))) success = false;
    } catch (error) {
      console.error(`${id}: ${error.message}`);
      success = false;
    }
  }
  process.exitCode = success ? 0 : 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
