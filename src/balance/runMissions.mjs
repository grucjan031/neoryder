import { writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
});
try {
  const { analyzeAct, renderMissionReport } = await server.ssrLoadModule(
    '/src/balance/missionBalance.ts',
  );
  const text = renderMissionReport(
    analyzeAct(),
    new Date().toISOString().slice(0, 10),
  );
  await writeFile('docs/balance-misje.md', text, 'utf8');
  console.log('Zapisano docs/balance-misje.md.');
} finally {
  await server.close();
}
