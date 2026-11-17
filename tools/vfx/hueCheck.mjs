// Pomiar „różu” pod efektami bossa (ADR 0006: magenta #ff2bd6 to Rezonans gracza).
// Robi zrzuty 1280x720 na GPU (bez fx=lite): zwykła walka, przejście fazy, pole rażenia
// (telegraf), rozpad bossa. W obszarze efektu (piksele zmienione względem kadru odniesienia
// tuż przed efektem) liczy piksele o nasyceniu > 0.35 i jasności > 0.25 i podaje udział
// odcieni HSV 290–340°: w całym obszarze efektu oraz w jego części na podłodze areny
// (maska z pozy kamery). Kryterium (podłoga): < 2% na każdym zrzucie z efektem.
// Obok zrzutów zapisuje `*-roz.png`: róż w obszarze efektu zaznaczony na zielono.
//
// Użycie (serwer gry musi działać, np. `npx vite preview --port 4291`):
//   node tools/vfx/hueCheck.mjs --url http://127.0.0.1:4291 --out ./zrzuty --label po
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://127.0.0.1:4291' },
    out: { type: 'string', default: 'hue-report' },
    label: { type: 'string', default: 'pomiar' },
    seed: { type: 'string', default: 'hue-check' },
    quality: { type: 'string', default: 'high' },
    limit: { type: 'string', default: '0.02' },
  },
});
if (!/^[a-z0-9-]+$/i.test(values.label))
  throw new Error('--label może zawierać litery, cyfry i myślniki.');
if (!['low', 'medium', 'high'].includes(values.quality))
  throw new Error('--quality: low, medium albo high.');
const limit = Number(values.limit);
const url = new URL(values.url);
if (!['http:', 'https:'].includes(url.protocol))
  throw new Error('--url musi być adresem HTTP(S) działającego serwera.');
url.searchParams.set('scene', 'room-test');
url.searchParams.set('room', 'bossRoom');
url.searchParams.set('debug', '1');
url.searchParams.set('seed', values.seed);
url.searchParams.set('loadout', 'classic');
const out = resolve(values.out);
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const results = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript((quality) => {
    // Stałe FOV 90° (pionowe), żeby maska podłogi pokrywała się z obrazem.
    localStorage.setItem(
      'neoryder.settings',
      JSON.stringify({ quality, fov: 90 }),
    );
  }, values.quality);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url.href);
  await page.waitForFunction(
    () => window.__neoryder?.sceneId() === 'room-test',
    undefined,
    { timeout: 120_000 },
  );
  const command = (line) =>
    page.evaluate((text) => window.__neoryder.command(text), line);
  const query = (name) =>
    page.evaluate((key) => window.__neoryder.query(key), name);
  // Panele debug (lil-gui, stats.js, konsola) zasłaniają kadr: ukrywamy je tylko w zrzutach.
  await page.addStyleTag({
    content:
      '.lil-gui, .hud, body > div[style*="position: fixed"]:not(#app) { display: none !important; }',
  });
  await command('god');
  // Spokojny kadr na środek areny z lekkim spadkiem, żeby podłoga zajmowała dół obrazu.
  await page.waitForTimeout(4500);
  // Gracz `distance` m od bossa (w granicach areny 30x30), wzrok na bossa, spadek `pitch`.
  const aim = async (distance = 9, pitch = -24) => {
    const boss = await query('boss');
    const bx = boss?.x ?? 0;
    const bz = boss?.z ?? 0;
    const clamp = (v) => Math.max(-12, Math.min(12, v));
    const px = clamp(bx);
    const pz = clamp(bz + distance);
    // yaw 0 patrzy w -Z; wektor przodu (-sin yaw, -cos yaw).
    const yaw = (Math.atan2(-(bx - px), -(bz - pz)) * 180) / Math.PI;
    await command(
      `tp ${px.toFixed(2)} ${pz.toFixed(2)} ${yaw.toFixed(1)} ${pitch}`,
    );
  };

  // Zrzut z pozą kamery (do maski podłogi).
  const shot = async (name) => {
    const look = await query('playerLook');
    const boss = await query('boss');
    const pos = await query('playerPos');
    const buffer = await page.screenshot({ type: 'png' });
    await writeFile(join(out, `${values.label}-${name}.png`), buffer);
    return { b64: buffer.toString('base64'), look, pos, boss };
  };

  const analyze = (effect, reference) =>
    page.evaluate(
      async ({ effect, reference, look, pos, boss, eye, fov, half, body }) => {
        const load = async (b64) => {
          const image = new Image();
          image.src = `data:image/png;base64,${b64}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const g = canvas.getContext('2d', { willReadFrequently: true });
          g.drawImage(image, 0, 0);
          return g.getImageData(0, 0, image.width, image.height);
        };
        const a = await load(effect);
        const b = await load(reference);
        const { width, height } = a;
        const changed = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) {
          const d = Math.max(
            Math.abs(a.data[i * 4] - b.data[i * 4]),
            Math.abs(a.data[i * 4 + 1] - b.data[i * 4 + 1]),
            Math.abs(a.data[i * 4 + 2] - b.data[i * 4 + 2]),
          );
          changed[i] = d > 20 ? 1 : 0;
        }
        // Obszar efektu: zmienione piksele poszerzone o 6 px (krawędzie pierścieni).
        const R = 6;
        const row = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
          let run = -1e9;
          for (let x = 0; x < width; x++) {
            if (changed[y * width + x]) run = x;
            if (x - run <= R) row[y * width + x] = 1;
          }
          run = 1e9;
          for (let x = width - 1; x >= 0; x--) {
            if (changed[y * width + x]) run = x;
            if (run - x <= R) row[y * width + x] = 1;
          }
        }
        const mask = new Uint8Array(width * height);
        for (let x = 0; x < width; x++) {
          let run = -1e9;
          for (let y = 0; y < height; y++) {
            if (row[y * width + x]) run = y;
            if (y - run <= R) mask[y * width + x] = 1;
          }
          run = 1e9;
          for (let y = height - 1; y >= 0; y--) {
            if (row[y * width + x]) run = y;
            if (run - y <= R) mask[y * width + x] = 1;
          }
        }
        let area = 0;
        let vivid = 0;
        let pink = 0;
        // Maska podłogi areny: promień z kamery (rotacja YXZ, FOV pionowe) trafia w y = 0
        // wewnątrz ścian. Przybliżenie: bryły stojące na podłodze (boss, lady) też się liczą.
        const floor = new Uint8Array(width * height);
        const tanY = Math.tan(((fov / 2) * Math.PI) / 180);
        const tanX = tanY * (width / height);
        const yaw = (look.yawDeg * Math.PI) / 180;
        const pitch = (look.pitchDeg * Math.PI) / 180;
        const cp = Math.cos(pitch);
        const sp = Math.sin(pitch);
        const cy = Math.cos(yaw);
        const sy = Math.sin(yaw);
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const dx = ((2 * (x + 0.5)) / width - 1) * tanX;
            const dy0 = (1 - (2 * (y + 0.5)) / height) * tanY;
            // Rx(pitch), potem Ry(yaw); kamera patrzy w -Z.
            const dy = dy0 * cp + -1 * -sp;
            const dz1 = dy0 * sp + -1 * cp;
            const wx = dx * cy + dz1 * sy;
            const wz = -dx * sy + dz1 * cy;
            if (dy >= -1e-4) continue;
            const t = eye / -dy;
            // Bryła bossa (walec) zasłania podłogę: te piksele to boss, nie podłoga.
            if (boss && typeof boss.x === 'number') {
              const ox = pos.x - boss.x;
              const oz = pos.z - boss.z;
              const a2 = wx * wx + wz * wz;
              const b2 = 2 * (ox * wx + oz * wz);
              const c2 = ox * ox + oz * oz - body.radius * body.radius;
              const disc = b2 * b2 - 4 * a2 * c2;
              if (disc >= 0) {
                const tc = (-b2 - Math.sqrt(disc)) / (2 * a2);
                const yc = eye + dy * tc;
                if (tc > 0 && tc < t && yc < body.height) continue;
              }
            }
            const hx = pos.x + wx * t;
            const hz = pos.z + wz * t;
            if (Math.abs(hx) < half && Math.abs(hz) < half)
              floor[y * width + x] = 1;
          }
        let floorVivid = 0;
        let floorPink = 0;
        let frameVivid = 0;
        let framePink = 0;
        const overlay = new ImageData(width, height);
        for (let i = 0; i < width * height; i++) {
          const r = a.data[i * 4] / 255;
          const g = a.data[i * 4 + 1] / 255;
          const bl = a.data[i * 4 + 2] / 255;
          const max = Math.max(r, g, bl);
          const min = Math.min(r, g, bl);
          const s = max > 0 ? (max - min) / max : 0;
          let h = 0;
          if (max > min) {
            if (max === r) h = 60 * (((g - bl) / (max - min)) % 6);
            else if (max === g) h = 60 * ((bl - r) / (max - min) + 2);
            else h = 60 * ((r - g) / (max - min) + 4);
          }
          if (h < 0) h += 360;
          const isVivid = s > 0.35 && max > 0.25;
          const isPink = isVivid && h >= 290 && h <= 340;
          if (isVivid) frameVivid++;
          if (isPink) framePink++;
          // Podgląd: obraz przygaszony, obszar efektu jaśniej, róż w obszarze na zielono.
          const k = mask[i] ? 0.6 : 0.25;
          overlay.data[i * 4] = isPink && mask[i] ? 0 : a.data[i * 4] * k;
          overlay.data[i * 4 + 1] =
            isPink && mask[i] ? 255 : a.data[i * 4 + 1] * k;
          overlay.data[i * 4 + 2] =
            isPink && mask[i] ? 0 : a.data[i * 4 + 2] * k;
          overlay.data[i * 4 + 3] = 255;
          if (!mask[i]) continue;
          area++;
          if (isVivid) vivid++;
          if (isPink) pink++;
          if (floor[i] && isVivid) floorVivid++;
          if (floor[i] && isPink) floorPink++;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').putImageData(overlay, 0, 0);
        const overlayB64 = canvas.toDataURL('image/png').split(',')[1];
        return {
          overlayB64,
          area,
          vivid,
          pink,
          share: vivid ? pink / vivid : 0,
          floorVivid,
          floorPink,
          floorShare: floorVivid ? floorPink / floorVivid : 0,
          frameVivid,
          framePink,
          frameShare: frameVivid ? framePink / frameVivid : 0,
        };
      },
      {
        effect: effect.b64,
        reference: reference.b64,
        look: effect.look,
        boss: effect.boss,
        body: { radius: 1.6, height: 4.5 },
        pos: effect.pos,
        eye: 1.65,
        fov: 90,
        half: 14,
      },
    );

  const record = async (name, effect, reference) => {
    const { overlayB64, ...stats } = await analyze(effect, reference);
    await writeFile(
      join(out, `${values.label}-${name}-roz.png`),
      Buffer.from(overlayB64, 'base64'),
    );
    results.push({ name, effects: true, ...stats });
  };

  // 1. Zwykła walka bez efektów (do obejrzenia, czy arena nie jest szarą plamą).
  await aim();
  await page.waitForTimeout(600);
  await shot('walka');
  results.push({ name: 'walka', effects: false });

  // 2. Przejście fazy: kadr odniesienia, potem fale zmiany fazy w kilku chwilach.
  await aim();
  await page.waitForTimeout(400);
  let reference = await shot('faza-ref');
  await command('boss phase 2');
  for (const ms of [150, 350, 600]) {
    await page.waitForTimeout(ms === 150 ? 150 : ms === 350 ? 200 : 250);
    await record(`faza-${ms}ms`, await shot(`faza-${ms}ms`), reference);
  }

  // 3. Pole rażenia: czekamy na telegraf ataku bossa (slam/fan) i jego środek.
  // Gracz blisko bossa, żeby boss uderzył (slam); kadr odniesienia przed telegrafem.
  await page.waitForTimeout(1500);
  await aim(6, -30);
  await page.waitForTimeout(300);
  reference = await shot('pole-ref');
  let zone = false;
  const seen = new Set();
  for (let i = 0; i < 300 && !zone; i++) {
    const boss = await query('boss');
    seen.add(`${boss?.state}:${boss?.attack}`);
    if (boss?.state === 'telegraph' && (boss.stateTimeS ?? 0) > 0.15)
      zone = true;
    else {
      if (i % 40 === 39) {
        await aim(6, -30);
        await page.waitForTimeout(250);
        reference = await shot('pole-ref');
      }
      await page.waitForTimeout(30);
    }
  }
  if (!zone) console.warn('Brak telegrafu; stany bossa:', [...seen]);
  if (zone) await record('pole', await shot('pole'), reference);
  else results.push({ name: 'pole', effects: true, missing: true });

  // 4. Rozpad: ostatnia faza, potem zabicie bossa; fale rozpadu w kilku chwilach.
  await command('boss phase 3');
  await page.waitForTimeout(1500);
  await aim();
  await page.waitForTimeout(300);
  reference = await shot('rozpad-ref');
  await command('kill all');
  let last = 0;
  for (const ms of [200, 500, 900]) {
    await page.waitForTimeout(ms - last);
    last = ms;
    await record(`rozpad-${ms}ms`, await shot(`rozpad-${ms}ms`), reference);
  }
  if (errors.length) console.warn('Błędy strony:', errors);
} finally {
  await browser.close();
}

const report = {
  date: new Date().toISOString(),
  label: values.label,
  url: url.href,
  limit,
  results,
};
await writeFile(
  join(out, `${values.label}-hue.json`),
  JSON.stringify(report, null, 2) + '\n',
  'utf8',
);
console.table(
  results.map((r) => ({
    zrzut: r.name,
    'obszar px': r.area ?? '-',
    'nasycone px': r.vivid ?? '-',
    'róż px': r.pink ?? '-',
    'róż % (obszar)': r.share === undefined ? '-' : (r.share * 100).toFixed(2),
    'podłoga nasycone px': r.floorVivid ?? '-',
    'róż % (podłoga)':
      r.floorShare === undefined ? '-' : (r.floorShare * 100).toFixed(2),
    'róż % kadru':
      r.frameShare === undefined ? '-' : (r.frameShare * 100).toFixed(2),
  })),
);
const failed = results.filter(
  (r) => r.effects && (r.missing || (r.floorShare ?? 0) >= limit),
);
if (failed.length) {
  console.log(
    `NIE: ${failed.map((r) => r.name).join(', ')} (próg ${limit * 100}% na podłodze)`,
  );
  process.exitCode = 1;
} else
  console.log(
    `OK: na podłodze pod efektami < ${limit * 100}% różu na każdym zrzucie.`,
  );
