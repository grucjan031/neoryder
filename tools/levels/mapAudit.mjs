import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { json: { type: 'boolean' }, report: { type: 'boolean' } },
});
if (values.report && (positionals.length || values.json))
  throw new Error('--report wymaga pełnego audytu bez --json.');
const server = await createServer({
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true, watch: null, ws: false },
});
try {
  const { auditMap } = await server.ssrLoadModule('/src/world/mapAudit.ts');
  const { auditMaps } = await server.ssrLoadModule(
    '/tools/levels/mapAuditCatalog.ts',
  );
  const ids = positionals.length
    ? [...new Set(positionals)]
    : [...auditMaps.keys()].sort();
  const results = ids.map((mapId) => {
    const map = auditMaps.get(mapId);
    if (!map)
      throw new Error(
        `Nieznana mapa „${mapId}”. Dostępne: ${[...auditMaps.keys()].sort().join(', ')}`,
      );
    const findings = auditMap(map, { mapId });
    const errors = findings.filter((f) => f.severity === 'error').length;
    return { mapId, errors, warnings: findings.length - errors, findings };
  });
  const row = (f) => {
    const p = f.position;
    return `${f.severity} · ${f.rule} · \`${f.path}\` · (${[p.x, p.y, p.z].map((n) => Number(n.toFixed(2))).join(', ')}) · ${f.message}`;
  };
  if (values.json) console.log(JSON.stringify(results, null, 2));
  else if (values.report) {
    const path = 'docs/audits/mapAudit-report.md';
    const marker = '<!-- mapAudit:generated -->';
    const preface = (await readFile(path, 'utf8')).split(marker)[0].trimEnd();
    const lines = [
      preface,
      '',
      marker,
      '',
      '## Wyniki według mapy',
      '',
      '| Mapa | error | warn |',
      '| --- | ---: | ---: |',
      ...results.map((r) => `| ${r.mapId} | ${r.errors} | ${r.warnings} |`),
    ];
    for (const r of results)
      lines.push(
        '',
        '### ' + r.mapId,
        '',
        ...(r.findings.length
          ? r.findings.map((f) => '- ' + row(f))
          : ['Brak zgłoszeń.']),
      );
    await writeFile(path, lines.join('\n') + '\n');
    console.log(`Zapisano ${results.length} map do ${path}.`);
  } else
    for (const r of results) {
      console.log(`${r.mapId}: ${r.errors} error, ${r.warnings} warn`);
      if (positionals.length)
        for (const f of r.findings) console.log('  ' + row(f));
    }
} finally {
  await server.close();
}
