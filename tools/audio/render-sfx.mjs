// Synteza przybliżona: wariant 0, pitch 1, bez szyn master i muzyki.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const sampleRate = 44100;
const silence = 0.0001;
const sweep = (start, end, fraction) =>
  start * ((end ?? start) / start) ** fraction;

export function renderSound(sound) {
  const layers = sound.variants[0];
  const duration = Math.max(
    ...layers.map((l) => (l.delayS ?? 0) + l.durationS),
  );
  const samples = new Float64Array(Math.ceil(duration * sampleRate));
  for (const layer of layers) {
    let phase = 0,
      low = 0,
      band = 0,
      seed = 1234567;
    const offset = Math.round((layer.delayS ?? 0) * sampleRate);
    const attack = Math.min(layer.attackS ?? 0.003, layer.durationS / 2);
    const gain = Math.max(silence, layer.gain);
    for (
      let i = 0;
      i < Math.ceil(layer.durationS * sampleRate) &&
      offset + i < samples.length;
      i++
    ) {
      const t = i / sampleRate;
      const fraction = t / layer.durationS;
      const p = phase % 1;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      let value;
      switch (layer.wave) {
        case 'noise':
          value = seed / 2147483648 - 1;
          break;
        case 'sine':
          value = Math.sin(2 * Math.PI * p);
          break;
        case 'square':
          value = p < 0.5 ? 1 : -1;
          break;
        case 'sawtooth':
          value = 2 * p - 1;
          break;
        case 'triangle':
          value = 1 - 4 * Math.abs(p - 0.5);
          break;
        default:
          throw new Error(`Nieznana fala: ${layer.wave}`);
      }
      phase += sweep(layer.freq ?? 440, layer.freqEnd, fraction) / sampleRate;
      if (layer.filter) {
        const f = layer.filter;
        const cutoff = Math.min(
          sampleRate * 0.49,
          sweep(f.freq, f.freqEnd, fraction),
        );
        const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
        low += a * (value - low);
        if (f.type === 'lowpass') value = low;
        else if (f.type === 'highpass') value -= low;
        else {
          // Kaskada HP/LP pierwszego rzędu; Q nie jest odwzorowane.
          band += a * (value - low - band);
          value = band;
        }
      }
      const env =
        t < attack
          ? silence + ((gain - silence) * t) / attack
          : gain *
            (silence / gain) ** ((t - attack) / (layer.durationS - attack));
      samples[offset + i] += value * env * sound.volume;
    }
  }
  return samples;
}

// FFT radix-2; centroid amplitudowy całego sygnału z dopełnieniem zerami.
export function measure(samples) {
  let n = 1;
  while (n < samples.length) n *= 2;
  const re = new Float64Array(n),
    im = new Float64Array(n);
  re.set(samples);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let size = 2; size <= n; size *= 2) {
    for (let start = 0; start < n; start += size) {
      for (let j = 0; j < size / 2; j++) {
        const angle = (-2 * Math.PI * j) / size;
        const c = Math.cos(angle),
          s = Math.sin(angle);
        const a = start + j,
          b = a + size / 2;
        const r = re[b] * c - im[b] * s,
          v = re[b] * s + im[b] * c;
        re[b] = re[a] - r;
        im[b] = im[a] - v;
        re[a] += r;
        im[a] += v;
      }
    }
  }
  let mass = 0,
    weighted = 0,
    peak = 0,
    energy = 0;
  for (let k = 1; k <= n / 2; k++) {
    const magnitude = Math.hypot(re[k], im[k]);
    mass += magnitude;
    weighted += (magnitude * k * sampleRate) / n;
  }
  for (const value of samples) {
    peak = Math.max(peak, Math.abs(value));
    energy += value * value;
  }
  return {
    durationS: samples.length / sampleRate,
    peak,
    rms: Math.sqrt(energy / samples.length),
    centroidHz: mass ? weighted / mass : 0,
  };
}

function wav(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, i) =>
    buffer.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, value)) * 32767),
      44 + i * 2,
    ),
  );
  return buffer;
}

export function clarityAudit(sounds, metrics) {
  const categories = {
    defense: ['block', 'parry'],
    threat: ['telegraph', 'telegraphAim'],
    heat: ['heatWarning', 'overheat'],
    hit: [
      'hitLight',
      'hitHeavy',
      'hitGun',
      'kill',
      'wallSlam',
      'playerHurt',
      'lowHealth',
    ],
    reward: ['pickup', 'waveCleared', 'runReward'],
  };
  const entries = Object.entries(categories).flatMap(([category, names]) =>
    names.map((name) => ({ category, name })),
  );
  const pairs = [];
  const ratio = (a, b) => Math.max(a, b) / Math.min(a, b);
  // Wolne narastanie kontra impuls: >= 3x i co najmniej 10 ms różnicy.
  const attack = (name) =>
    Math.min(
      ...sounds[name].variants[0].map((l) =>
        Math.min(l.attackS ?? 0.003, l.durationS / 2),
      ),
    );
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i],
        b = entries[j];
      if (a.category === b.category) continue;
      const reasons = [];
      if (ratio(metrics[a.name].centroidHz, metrics[b.name].centroidHz) >= 1.3)
        reasons.push('centroid');
      if (ratio(metrics[a.name].durationS, metrics[b.name].durationS) >= 1.4)
        reasons.push('duration');
      if (
        Math.abs(attack(a.name) - attack(b.name)) >= 0.01 &&
        ratio(attack(a.name), attack(b.name)) >= 3
      )
        reasons.push('attack');
      pairs.push({ a: a.name, b: b.name, reasons });
    }
  return { pairs, failures: pairs.filter((p) => p.reasons.length === 0) };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (!process.argv[2])
    throw new Error('Użycie: node tools/audio/render-sfx.mjs <katalog>');
  const out = resolve(process.argv[2]);
  mkdirSync(out, { recursive: true });
  const data = JSON.parse(
    readFileSync(
      new URL('../../src/data/audio/sfx.json', import.meta.url),
      'utf8',
    ),
  );
  const metrics = {};
  for (const [name, sound] of Object.entries(data.sounds)) {
    const samples = renderSound(sound);
    metrics[name] = measure(samples);
    writeFileSync(join(out, `${name}.wav`), wav(samples));
  }
  writeFileSync(
    join(out, 'metrics.json'),
    JSON.stringify(metrics, null, 2) + '\n',
  );
  const clarity = clarityAudit(data.sounds, metrics);
  writeFileSync(
    join(out, 'clarity.json'),
    JSON.stringify(clarity, null, 2) + '\n',
  );
  console.table(metrics);
  console.log(
    `Rozróżnialność: ${clarity.pairs.length} par, ${clarity.failures.length} niespełnionych.`,
  );
  if (clarity.failures.length) {
    console.table(clarity.failures);
    process.exitCode = 1;
  }
  if (Object.values(metrics).some((m) => m.peak > 1)) {
    console.error('Przesterowanie: peak > 1 (WAV ograniczony do zakresu PCM).');
    process.exitCode = 1;
  }
}
