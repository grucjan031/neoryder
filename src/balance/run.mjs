import { writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
});
try {
  const { generateBalance, renderReport } = await server.ssrLoadModule(
    '/src/balance/report.ts',
  );
  const results = generateBalance();
  await writeFile(
    'docs/balance.md',
    renderReport(results, new Date().toISOString().slice(0, 10)),
    'utf8',
  );
  for (const warning of new Set([
    ...results.open.warnings,
    ...results.wall.warnings,
  ]))
    console.warn(warning);
  console.log(
    `Zapisano docs/balance.md. Bramka (otwarta przestrzeń / ściana): ${results.open.passed} / ${results.wall.passed}.`,
  );
  console.table(
    results.open.paths.map(({ enemy, ttkS, medianS, passed }) => ({
      wróg: enemy,
      Ostrze: ttkS[0],
      Moc: ttkS[1],
      Strzelec: ttkS[2],
      mediana: medianS,
      bramka: passed,
    })),
  );
} finally {
  await server.close();
}
