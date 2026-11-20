// Pomiar referencyjny wydajności (S1-04): build produkcyjny + vite preview + Playwright na prawdziwym GPU.
// Uruchomienie: npm run perf:bench -- [opcje]  (opis opcji: docs/systems/render.md, „Pomiar referencyjny”).
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const { values } = parseArgs({
  options: {
    quality: { type: 'string', default: 'medium' },
    seconds: { type: 'string', default: '10' },
    scenario: { type: 'string', default: 'all' },
    runs: { type: 'string', default: '2' },
    gpu: { type: 'string', default: 'high' },
    'cpu-throttle': { type: 'string', default: '1' },
    uncapped: { type: 'boolean', default: false },
    port: { type: 'string', default: '4174' },
    'idle-threshold': { type: 'string', default: '15' },
    'idle-timeout-min': { type: 'string', default: '20' },
    'no-wait-idle': { type: 'boolean', default: false },
    tag: { type: 'string', default: '' },
    'load-timeout': { type: 'string', default: '45' },
  },
});
const SCENARIOS = [
  'hub',
  'combat',
  'heaviest',
  'boss',
  'shatter',
  'transition',
  'arenas',
];
const seconds = Number(values.seconds);
const runs = Number(values.runs);
const throttle = Number(values['cpu-throttle']);
const port = Number(values.port);
if (!Number.isFinite(seconds) || seconds <= 0)
  throw new Error('--seconds musi być dodatnie.');
if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs >= 1.');
if (!['low', 'medium', 'high'].includes(values.quality))
  throw new Error('--quality: low, medium albo high.');
if (!['low', 'high'].includes(values.gpu))
  throw new Error('--gpu: low albo high.');
if (!Number.isFinite(throttle) || throttle < 1)
  throw new Error('--cpu-throttle >= 1.');
const wanted =
  values.scenario === 'all' ? SCENARIOS : values.scenario.split(',');
for (const name of wanted)
  if (!SCENARIOS.includes(name))
    throw new Error(`Nieznany scenariusz: ${name}. Dostępne: ${SCENARIOS}`);

const loadTimeoutMs = Number(values['load-timeout']) * 1000;
const WARMUP_MS = 3000;
const SURVEY_WARMUP_MS = 1000;
const SURVEY_MS = 2000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- obciążenie CPU (inne procesy na tej maszynie) ----------
function cpuSnapshot() {
  let idle = 0;
  let total = 0;
  for (const { times } of cpus()) {
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  return { idle, total };
}
async function sampleCpuLoad() {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const a = cpuSnapshot();
    await sleep(1000);
    const b = cpuSnapshot();
    samples.push(100 * (1 - (b.idle - a.idle) / (b.total - a.total)));
  }
  return samples.reduce((x, y) => x + y, 0) / samples.length;
}
function foreignProcesses() {
  try {
    const script =
      "Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(node|vitest|chrome|chromium|msedge|headless_shell)' } | ForEach-Object { '{0}|{1}|{2}|{3}' -f $_.ProcessId, $_.ParentProcessId, $_.Name, ($_.CommandLine -replace '\\s+',' ') }";
    const out = execFileSync('powershell', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    return out
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [pid, ppid, name, ...rest] = line.split('|');
        return {
          pid: Number(pid),
          ppid: Number(ppid),
          name,
          command: rest.join('|').slice(0, 140),
        };
      })
      .filter((p) => p.pid !== process.pid && p.pid !== process.ppid);
  } catch {
    return [];
  }
}
let idleGaveUp = false;
async function waitForIdle(label) {
  const threshold = Number(values['idle-threshold']);
  const deadline = Date.now() + Number(values['idle-timeout-min']) * 60_000;
  let load = await sampleCpuLoad();
  if (values['no-wait-idle'] || idleGaveUp)
    return { label, cpuLoadPct: load, waitedS: 0, timedOut: false };
  const startedAt = Date.now();
  while (load > threshold && Date.now() < deadline) {
    console.log(
      `[idle] obciążenie CPU ${load.toFixed(1)}% > ${threshold}% — czekam 60 s...`,
    );
    await sleep(57_000);
    load = await sampleCpuLoad();
  }
  if (load > threshold) idleGaveUp = true;
  return {
    label,
    cpuLoadPct: load,
    waitedS: Math.round((Date.now() - startedAt) / 1000),
    timedOut: load > threshold,
    foreignProcesses: foreignProcesses(),
  };
}

// ---------- serwer preview ----------
async function startPreview() {
  const child = spawn(
    process.execPath,
    [
      join(ROOT, 'node_modules/vite/bin/vite.js'),
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: ROOT, stdio: 'ignore' },
  );
  let exited = false;
  child.on('exit', () => (exited = true));
  const base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) {
    if (exited) throw new Error(`vite preview nie wystartował (port ${port}).`);
    try {
      if ((await fetch(base)).ok) return { child, base };
    } catch {
      // serwer jeszcze nie słucha
    }
    await sleep(200);
  }
  child.kill();
  throw new Error('vite preview nie odpowiada.');
}

// ---------- statystyki ----------
function frameStats(deltas) {
  const n = deltas.length;
  if (n === 0) return null;
  const sum = deltas.reduce((a, b) => a + b, 0);
  const sorted = [...deltas].sort((a, b) => b - a);
  const worst = Math.max(1, Math.ceil(n * 0.01));
  const worstMean = sorted.slice(0, worst).reduce((a, b) => a + b, 0) / worst;
  return {
    frames: n,
    avgFps: (1000 * n) / sum,
    low1Fps: 1000 / worstMean,
    p99Ms: sorted[Math.min(n - 1, Math.floor(n * 0.01))],
    over33: deltas.filter((d) => d > 33.3).length,
    over50: deltas.filter((d) => d > 50).length,
    maxMs: sorted[0],
  };
}

// ---------- definicje przypadków ----------
async function listJson(dir) {
  return (await readdir(join(ROOT, dir)))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}
const roomCase = (scenario, name, room, extra = {}) => ({
  scenario,
  name,
  query: `scene=room-test&room=${room}&loadout=classic&seed=bench`,
  ready: 'sceneId',
  expectScene: 'room-test',
  commands: ['god'],
  ...extra,
});

// Funkcja uruchamiana w stronie: czeka na gotowość sceny.
const READY = {
  sceneId: (expectScene) => window.__neoryder?.sceneId() === expectScene,
  run: () => {
    const g = window.__neoryder;
    return !!g && g.query('loading') === false && g.query('screen') === 'room';
  },
  playing: () => {
    const g = window.__neoryder;
    return !!g && g.query('screen') === 'playing';
  },
  boss: () => {
    const g = window.__neoryder;
    return g?.sceneId() === 'room-test' && g.query('boss') != null;
  },
};

async function openPage(browser, base, def, quality, withProbe) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript((quality) => {
    try {
      const raw = localStorage.getItem('neoryder.settings');
      const settings = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        'neoryder.settings',
        JSON.stringify({ ...settings, quality }),
      );
    } catch {
      // zapis ustawień nie blokuje pomiaru
    }
  }, quality);
  if (withProbe)
    await context.addInitScript(() => {
      const probe = { frames: [], readyAt: null, last: undefined };
      window.__bp = probe;
      const loop = (now) => {
        if (probe.last !== undefined)
          probe.frames.push([now, now - probe.last]);
        probe.last = now;
        if (probe.readyAt === null) {
          const g = window.__neoryder;
          if (g && g.query('screen') === 'playing') probe.readyAt = now;
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  const page = await context.newPage();
  const issues = { pageErrors: [], consoleErrors: [], consoleWarnings: [] };
  page.on('pageerror', (e) => issues.pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') issues.consoleErrors.push(m.text());
    else if (m.type() === 'warning') issues.consoleWarnings.push(m.text());
  });
  if (throttle > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  return { context, page, issues };
}

async function waitReady(page, def) {
  const fn = READY[def.ready];
  await page.waitForFunction(fn, def.expectScene, { timeout: loadTimeoutMs });
  if (def.waitFor)
    await page.waitForFunction(def.waitFor, undefined, { timeout: 60_000 });
}

// Pomiar w stronie: pętla rAF z czasami klatek, próbkowanie profilera i liczników.
async function measureInPage(page, ms, killAtMs) {
  return page.evaluate(
    async ({ ms, killAtMs }) => {
      const debug = window.__neoryder;
      const gl = document.querySelector('#app canvas')?.getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      const gpu =
        gl && ext
          ? {
              vendor: String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)),
              renderer: String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)),
            }
          : null;
      const heap = () => performance.memory?.usedJSHeapSize ?? null;
      const counters = () => ({
        enemies: Number(debug.query('enemies') ?? 0) || 0,
        bodies: Number(debug.query('bodies') ?? 0) || 0,
        debris: Number(debug.query('debris') ?? 0) || 0,
      });
      const heapBefore = heap();
      debug.command('profile on');
      const deltas = [];
      const stageSum = {};
      let stageN = 0;
      let callsSum = 0;
      let trisSum = 0;
      let infoN = 0;
      let renderInfoMem = null;
      let profileMeta = null;
      const peak = { enemies: 0, bodies: 0, debris: 0 };
      let killIndex = null;
      const sampleProfile = () => {
        const p = debug.query('frameProfile');
        if (p && p.frames > 0) {
          for (const [stage, t] of Object.entries(p.stages)) {
            const s = (stageSum[stage] ??= { cpu: 0, gpu: 0, gpuN: 0 });
            s.cpu += t.cpuMs;
            if (t.gpuMs !== null) {
              s.gpu += t.gpuMs;
              s.gpuN++;
            }
          }
          stageN++;
          profileMeta = {
            gpuAvailable: p.gpuAvailable,
            counters: { ...p.counters },
            frameMs: p.frameMs,
          };
        }
        const c = counters();
        for (const k of Object.keys(peak)) peak[k] = Math.max(peak[k], c[k]);
      };
      const start = performance.now();
      let last = start;
      let lastSample = start;
      await new Promise((resolve) => {
        const frame = (now) => {
          deltas.push(now - last);
          last = now;
          const info = debug.query('renderInfo');
          if (info) {
            callsSum += info.calls;
            trisSum += info.triangles;
            infoN++;
            renderInfoMem = {
              geometries: info.geometries,
              textures: info.textures,
            };
          }
          if (
            killAtMs !== null &&
            killIndex === null &&
            now - start >= killAtMs
          ) {
            debug.command('kill all');
            killIndex = deltas.length;
          }
          if (now - lastSample >= 500) {
            sampleProfile();
            lastSample = now;
          }
          if (now - start < ms) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      sampleProfile();
      debug.command('profile off');
      const stages = {};
      for (const [stage, s] of Object.entries(stageSum))
        stages[stage] = {
          cpuMs: s.cpu / stageN,
          gpuMs: s.gpuN ? s.gpu / s.gpuN : null,
        };
      return {
        deltas: deltas.slice(1),
        killIndex: killIndex === null ? null : killIndex - 1,
        gpu,
        userAgent: navigator.userAgent,
        heapBefore,
        heapAfter: heap(),
        stages,
        profileMeta,
        renderInfo: infoN
          ? {
              calls: callsSum / infoN,
              triangles: trisSum / infoN,
              ...renderInfoMem,
            }
          : null,
        countersLast: counters(),
        countersPeak: peak,
      };
    },
    { ms, killAtMs },
  );
}

async function runStandard(browser, base, def, ms, warmupMs) {
  const { context, page, issues } = await openPage(
    browser,
    base,
    def,
    values.quality,
    false,
  );
  try {
    await page.goto(`${base}?${def.query}&debug=1`);
    await waitReady(page, def);
    for (const c of def.commands ?? [])
      await page.evaluate((line) => window.__neoryder.command(line), c);
    await page.waitForTimeout(warmupMs);
    const raw = await measureInPage(page, ms, def.killAtMs ?? null);
    const result = {
      stats: frameStats(raw.deltas),
      stages: raw.stages,
      renderInfo: raw.renderInfo,
      heapBeforeMB: raw.heapBefore && raw.heapBefore / 1048576,
      heapAfterMB: raw.heapAfter && raw.heapAfter / 1048576,
      countersLast: raw.countersLast,
      countersPeak: raw.countersPeak,
      gpu: raw.gpu,
      userAgent: raw.userAgent,
      gpuTimerAvailable: raw.profileMeta?.gpuAvailable ?? null,
    };
    if (raw.killIndex !== null) {
      const after = raw.deltas.slice(raw.killIndex);
      result.afterKill = frameStats(after);
    }
    return { ...result, issues };
  } catch (e) {
    e.issues = issues;
    throw e;
  } finally {
    await context.close();
  }
}

async function runTransition(browser, base, def) {
  const { context, page, issues } = await openPage(
    browser,
    base,
    def,
    values.quality,
    true,
  );
  try {
    await page.goto(`${base}?scene=hub&debug=1&seed=bench`);
    await waitReady(page, { ready: 'sceneId', expectScene: 'hub' });
    await page.waitForTimeout(WARMUP_MS);
    const t0 = Date.now();
    await page.evaluate(() =>
      window.__neoryder.command('mission start m01-maszty'),
    );
    const readyAt = await (async () => {
      const deadline = Date.now() + 150_000;
      while (Date.now() < deadline) {
        const v = await page
          .evaluate(() => window.__bp?.readyAt ?? null)
          .catch(() => null);
        if (v !== null) return v;
        await sleep(100);
      }
      throw new Error('Przejście: scena misji nie osiągnęła stanu playing.');
    })();
    await page.waitForTimeout(5000);
    const probe = await page.evaluate(() => ({
      origin: performance.timeOrigin,
      frames: window.__bp.frames,
      readyAt: window.__bp.readyAt,
    }));
    const loading = probe.frames
      .filter(([t]) => t <= readyAt)
      .map(([, d]) => d);
    const after = probe.frames.filter(([t]) => t > readyAt).map(([, d]) => d);
    const firstFrameMs = probe.origin + (probe.frames[0]?.[0] ?? 0) - t0;
    return {
      transition: {
        route: 'hub -> mission m01-maszty (przeładowanie strony)',
        timeToFirstFrameMs: firstFrameMs,
        timeToPlayingMs: probe.origin + probe.readyAt - t0,
        longestFramesWhileLoadingMs: [...loading]
          .sort((a, b) => b - a)
          .slice(0, 5),
        loadingFrames: loading.length,
      },
      stats: frameStats(after),
      issues,
    };
  } catch (e) {
    e.issues = issues;
    throw e;
  } finally {
    await context.close();
  }
}

// ---------- główny przebieg ----------
function buildCases(roomIds, conquestArenas) {
  return {
    hub: [
      {
        scenario: 'hub',
        name: 'hub',
        query: 'scene=hub&seed=bench',
        ready: 'sceneId',
        expectScene: 'hub',
        commands: [],
      },
    ],
    combat: [
      roomCase('combat', 'combatYard', 'combatYard', {
        commands: ['god', 'spawn assaulter 3', 'spawn gunner 3'],
      }),
    ],
    boss: [
      roomCase('boss', 'bossRoom', 'bossRoom', {
        ready: 'boss',
      }),
    ],
    shatter: [
      roomCase('shatter', 'combatYard', 'combatYard', {
        commands: ['god', 'spawn assaulter 10', 'spawn gunner 10'],
        killAtMs: 2000,
      }),
    ],
    arenas: [
      ...conquestArenas.map((arena) => ({
        scenario: 'arenas',
        name: `conquest:${arena}`,
        query: `scene=conquest&arena=${arena}&loadout=classic&seed=bench`,
        ready: 'run',
        expectScene: 'run',
        commands: ['god'],
      })),
      ...['assault', 'heist'].map((mode) => ({
        scenario: 'arenas',
        name: `${mode}`,
        query: `scene=run&mode=${mode}&loadout=classic&seed=bench`,
        ready: 'run',
        commands: ['god'],
      })),
      {
        scenario: 'arenas',
        name: 'mission:m01-maszty',
        query: 'scene=mission&mission=m01-maszty&seed=bench',
        ready: 'playing',
        commands: ['god'],
      },
    ],
    survey: roomIds.map((room) =>
      roomCase('heaviest', room, room, { ready: 'sceneId' }),
    ),
  };
}

function launchArgs() {
  const args = [
    '--use-angle=d3d11',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--enable-precise-memory-info',
  ];
  if (values.gpu === 'low') args.push('--force_low_power_gpu');
  if (values.uncapped)
    args.push('--disable-gpu-vsync', '--disable-frame-rate-limit');
  return args;
}

const pct = (a, b) =>
  a && b ? (100 * Math.abs(a - b)) / Math.max(a, b) : null;
const f1 = (v) => (v === null || v === undefined ? '-' : Number(v).toFixed(1));

let report_skipped = [];
async function main() {
  const allRooms = await listJson('src/data/rooms');
  // Pokoje bez punktów spawnu (sklep, odpoczynek) nie wczytują się w room-test: pomijamy je w przeglądzie.
  const roomIds = [];
  const skippedRooms = [];
  for (const id of allRooms) {
    const room = JSON.parse(
      await readFile(join(ROOT, `src/data/rooms/${id}.json`), 'utf8'),
    );
    (room.spawnPoints?.length ? roomIds : skippedRooms).push(id);
  }
  const conquest = JSON.parse(
    await readFile(join(ROOT, 'src/data/modes/conquest.json'), 'utf8'),
  );
  report_skipped = skippedRooms;
  const cases = buildCases(roomIds, conquest.arenas);
  const { child, base } = await startPreview();
  const report = {
    date: new Date().toISOString(),
    options: {
      quality: values.quality,
      seconds,
      runs,
      gpu: values.gpu,
      cpuThrottle: throttle,
      uncapped: values.uncapped,
      scenarios: wanted,
      viewport: '1920x1080@1',
    },
    idleChecks: [],
    gpuInfo: null,
    userAgent: null,
    surveyRanking: null,
    skippedRooms: [],
    runs: [],
  };
  let heaviestId = null;
  try {
    for (let run = 1; run <= runs; run++) {
      report.idleChecks.push(await waitForIdle(`run ${run}`));
      const idle = report.idleChecks.at(-1);
      console.log(
        `[run ${run}] obciążenie CPU przed pomiarem: ${idle.cpuLoadPct.toFixed(1)}%${idle.timedOut ? ' (PRZEKROCZONY limit czekania)' : ''}`,
      );
      const browser = await chromium.launch({ args: launchArgs() });
      const runResult = { run, results: [] };
      const record = (def, data) => {
        runResult.results.push({
          scenario: def.scenario,
          name: def.name,
          ...data,
        });
        if (data.gpu && !report.gpuInfo) report.gpuInfo = data.gpu;
        if (data.userAgent && !report.userAgent)
          report.userAgent = data.userAgent;
        const s = data.stats;
        console.log(
          `  ${def.scenario}/${def.name}: ${s ? `${f1(s.avgFps)} FPS, 1%low ${f1(s.low1Fps)}, p99 ${f1(s.p99Ms)} ms, >33ms: ${s.over33}` : 'BRAK DANYCH'}${data.error ? ` BŁĄD: ${data.error}` : ''}`,
        );
      };
      const safe = async (def, fn) => {
        const idleCase = await waitForIdle(`${def.scenario}/${def.name}`);
        report.idleChecks.push(idleCase);
        try {
          const data = await fn();
          data.cpuLoadBeforePct = idleCase.cpuLoadPct;
          record(def, data);
        } catch (e) {
          record(def, {
            error: String(e?.message ?? e),
            cpuLoadBeforePct: idleCase.cpuLoadPct,
            issues: e?.issues ?? {
              pageErrors: [],
              consoleErrors: [],
              consoleWarnings: [],
            },
          });
        }
      };
      try {
        for (const name of wanted) {
          if (name === 'heaviest') {
            if (run === 1 || heaviestId === null) {
              const ranking = [];
              for (const def of cases.survey) {
                await safe(def, () =>
                  runStandard(browser, base, def, SURVEY_MS, SURVEY_WARMUP_MS),
                );
                const r = runResult.results.at(-1);
                r.scenario = 'survey';
                const stageCost = r.stages
                  ? Object.values(r.stages).reduce(
                      (a, t) => a + (t.gpuMs ?? t.cpuMs),
                      0,
                    )
                  : 0;
                ranking.push({
                  room: def.name,
                  meanFrameMs: r.stats ? 1000 / r.stats.avgFps : null,
                  p99Ms: r.stats?.p99Ms ?? null,
                  maxMs: r.stats?.maxMs ?? null,
                  stageCostMs: stageCost,
                  calls: r.renderInfo?.calls ?? null,
                  triangles: r.renderInfo?.triangles ?? null,
                });
              }
              // Najcięższy = najwyższy sumaryczny koszt etapów (GPU, a bez zapytań CPU); przy równości średni czas klatki.
              ranking.sort(
                (a, b) =>
                  b.stageCostMs - a.stageCostMs ||
                  (b.meanFrameMs ?? 0) - (a.meanFrameMs ?? 0),
              );
              heaviestId = ranking[0]?.room ?? null;
              if (run === 1) report.surveyRanking = ranking;
              console.log(`[przegląd pokoi] najcięższy: ${heaviestId}`);
            }
            if (heaviestId)
              await safe({ scenario: 'heaviest', name: heaviestId }, () =>
                runStandard(
                  browser,
                  base,
                  roomCase('heaviest', heaviestId, heaviestId, {
                    commands: ['god', 'spawn assaulter 3', 'spawn gunner 3'],
                  }),
                  seconds * 1000,
                  WARMUP_MS,
                ),
              );
          } else if (name === 'transition') {
            await safe({ scenario: 'transition', name: 'hub->mission' }, () =>
              runTransition(browser, base, {}),
            );
          } else {
            for (const def of cases[name])
              await safe(def, () =>
                runStandard(browser, base, def, seconds * 1000, WARMUP_MS),
              );
          }
        }
      } finally {
        await browser.close();
      }
      report.runs.push(runResult);
    }
  } finally {
    child.kill();
  }
  return report;
}

function printTables(report) {
  const rows = [];
  const first = report.runs[0]?.results ?? [];
  for (const r of first.filter((x) => x.scenario !== 'survey')) {
    const others = report.runs
      .slice(1)
      .map((run) =>
        run.results.find((x) => x.scenario === r.scenario && x.name === r.name),
      );
    const diff = others.length
      ? Math.max(
          ...others.map((o) => pct(r.stats?.avgFps, o?.stats?.avgFps) ?? 0),
        )
      : null;
    const top = Object.entries(r.stages ?? {})
      .sort((a, b) => (b[1].gpuMs ?? b[1].cpuMs) - (a[1].gpuMs ?? a[1].cpuMs))
      .slice(0, 3)
      .map(
        ([k, t]) =>
          `${k} ${f1(t.cpuMs)}/${t.gpuMs === null ? '-' : f1(t.gpuMs)}`,
      )
      .join(', ');
    rows.push({
      scenariusz: `${r.scenario}/${r.name}`,
      'avg FPS': f1(r.stats?.avgFps),
      '1% low': f1(r.stats?.low1Fps),
      'p99 ms': f1(r.stats?.p99Ms),
      '>33ms': r.stats?.over33 ?? '-',
      '>50ms': r.stats?.over50 ?? '-',
      'max ms': f1(r.stats?.maxMs),
      calls: r.renderInfo ? Math.round(r.renderInfo.calls) : '-',
      tris: r.renderInfo ? Math.round(r.renderInfo.triangles) : '-',
      'top CPU/GPU ms': top,
      'różnica FPS %': diff === null ? '-' : f1(diff),
    });
  }
  console.table(rows);
  if (report.surveyRanking)
    console.table(
      report.surveyRanking.map((r) => ({
        pokój: r.room,
        'klatka ms': f1(r.meanFrameMs),
        'p99 ms': f1(r.p99Ms),
        'max ms': f1(r.maxMs),
        'koszt etapów ms': f1(r.stageCostMs),
        calls: r.calls === null ? '-' : Math.round(r.calls),
        tris: r.triangles === null ? '-' : Math.round(r.triangles),
      })),
    );
}

const report = await main();
report.skippedRooms = report_skipped;
const software = /swiftshader|llvmpipe|software/i.test(
  `${report.gpuInfo?.renderer ?? ''} ${report.gpuInfo?.vendor ?? ''}`,
);
report.softwareRenderer = software;
const tag = [
  `gpu-${values.gpu}`,
  values.uncapped ? 'uncapped' : 'vsync',
  throttle > 1 ? `cpu${throttle}x` : '',
  values.quality,
  values.tag,
]
  .filter(Boolean)
  .join('-');
const dir = join(ROOT, 'perf-report');
await mkdir(dir, { recursive: true });
const path = join(
  dir,
  `bench-${tag}-${report.date.replace(/[:.]/g, '-')}.json`,
);
await writeFile(path, JSON.stringify(report, null, 2) + '\n', 'utf8');
printTables(report);
console.log(
  `GPU: ${report.gpuInfo?.renderer ?? '?'} (${report.gpuInfo?.vendor ?? '?'})`,
);
if (software)
  console.error(
    'UWAGA: renderer programowy (SwiftShader) — wynik nie jest pomiarem GPU!',
  );
console.log(`Raport: ${path}`);
const issues = report.runs.flatMap((run) =>
  run.results.flatMap((r) =>
    [
      ...(r.issues?.pageErrors ?? []).map(() => 'pageerror'),
      ...(r.issues?.consoleErrors ?? []).map(() => 'error'),
    ].map((k) => `${run.run}:${r.scenario}/${r.name}:${k}`),
  ),
);
if (issues.length)
  console.log(
    `Błędy konsoli/strony w ${issues.length} miejscach (szczegóły w JSON).`,
  );
