import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    tag: { type: 'string', default: 'before' },
  },
});
const [mapId] = positionals;
if (
  positionals.length !== 1 ||
  !/^[a-zA-Z0-9_-]+$/.test(mapId) ||
  !['before', 'after'].includes(values.tag)
)
  throw new Error(
    'Użycie: node tools/screens/mapAudit.mjs <mapId> [--out katalog] [--tag before|after]',
  );
const output = resolve(
  values.out ?? join('artifacts', 'maps', mapId, values.tag),
);
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, open: false },
  logLevel: 'error',
});
let browser;
const diagnostics = [];
try {
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string')
    throw new Error('Vite nie przydzielił portu TCP.');
  const url = new URL(`http://127.0.0.1:${address.port}`);
  url.search = new URLSearchParams({
    scene: 'map-audit',
    map: mapId,
    debug: '1',
    seed: 'map-audit',
  }).toString();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  page.setDefaultTimeout(180_000);
  page.on('pageerror', (e) => diagnostics.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') diagnostics.push(m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().endsWith('.glb'))
      diagnostics.push(`GLB ${r.status()}: ${r.url()}`);
  });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__neoryder || document.querySelector('.scene-error'),
  );
  const views = await page.evaluate((id) => {
    const failure = document.querySelector('.scene-error');
    if (failure) throw new Error(failure.textContent);
    const api = window.__neoryder;
    if (api?.query('auditMap') !== id)
      throw new Error('Gra nie wczytała mapy ' + id);
    return api.query('auditViews');
  }, mapId);
  if (
    !Array.isArray(views) ||
    !views.includes('top') ||
    !views.includes('spawn') ||
    views.length < 8
  )
    throw new Error('Scena nie przygotowała kompletu kamer.');
  await mkdir(output, { recursive: true });
  for (const [index, view] of views.entries()) {
    const selected = await page.evaluate(
      (v) => window.__neoryder.command('audit view ' + v),
      view,
    );
    if (selected !== view) throw new Error(selected);
    await page.waitForFunction(
      (v) => window.__neoryder.query('auditView') === v,
      view,
    );
    if (diagnostics.length) throw new Error('Błąd renderowania.');
    const file = join(
      output,
      `${String(index + 1).padStart(2, '0')}-${view}.png`,
    );
    await page.screenshot({ path: file });
    console.log(file);
  }
} catch (error) {
  throw new Error(
    `Audyt wizualny ${mapId}: ${error.message}\n${diagnostics.join('\n')}`,
    { cause: error },
  );
} finally {
  try {
    await browser?.close();
  } finally {
    await server.close();
  }
}
