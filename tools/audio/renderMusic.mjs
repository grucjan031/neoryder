// Renderuje pętle muzyki (src/data/audio/music.json) do WAV bez przeglądarki.
// Uproszczona synteza offline (naiwne oscylatory, filtry RBJ) — do odsłuchu i kontroli
// poziomów (szczyt, RMS), nie wierna kopia Web Audio.
// Użycie: node tools/audio/renderMusic.mjs [katalog-wyjściowy] [calm|combat|boss]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SR = 32000;
const data = JSON.parse(
  readFileSync(
    new URL('../../src/data/audio/music.json', import.meta.url),
    'utf8',
  ),
);
const outDir = process.argv[2] ?? join(tmpdir(), 'neoryder-music');
const only = process.argv[3];
mkdirSync(outDir, { recursive: true });

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = (name) => {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  const midi =
    (Number(m[3]) + 1) * 12 +
    SEMI[m[1]] +
    (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
};

let seed = 1234567;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const osc = (wave, phase) => {
  const p = phase - Math.floor(phase);
  if (wave === 'sine') return Math.sin(2 * Math.PI * p);
  if (wave === 'square') return p < 0.5 ? 1 : -1;
  if (wave === 'sawtooth') return 2 * p - 1;
  return 4 * Math.abs(p - 0.5) - 1;
};

/** Filtr biquad RBJ z przemiataniem częstotliwości (współczynniki co 64 próbki). */
function filter(buf, f, t0, t1) {
  if (!f) return buf;
  const out = new Float32Array(buf.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    a1 = 0,
    a2 = 0;
  const q = f.q ?? 0.707;
  for (let i = 0; i < buf.length; i++) {
    if (i % 64 === 0) {
      const k = Math.min(1, i / Math.max(1, (t1 - t0) * SR));
      const fr = f.freqEnd ? f.freq * (f.freqEnd / f.freq) ** k : f.freq;
      const w = (2 * Math.PI * Math.min(fr, SR * 0.45)) / SR;
      const alpha = Math.sin(w) / (2 * q);
      const c = Math.cos(w);
      let nb0, nb1, nb2;
      if (f.type === 'lowpass')
        [nb0, nb1, nb2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
      else if (f.type === 'highpass')
        [nb0, nb1, nb2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
      else [nb0, nb1, nb2] = [alpha, 0, -alpha];
      const a0 = 1 + alpha;
      b0 = nb0 / a0;
      b1 = nb1 / a0;
      b2 = nb2 / a0;
      a1 = (-2 * c) / a0;
      a2 = (1 - alpha) / a0;
    }
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

function parseTone(token) {
  if (token === '.') return null;
  const m = /^([^*@]+)(?:\*(\d+))?(?:@([0-9.]+))?$/.exec(token);
  return {
    freqs: m[1].split('+').map(hz),
    len: m[2] ? Number(m[2]) : 1,
    vel: m[3] ? Number(m[3]) : 1,
  };
}

function renderLoop(id, loop) {
  const perBar = loop.beatsPerBar * loop.stepsPerBeat;
  const stepS = 60 / loop.bpm / loop.stepsPerBeat;
  const loopS = loop.bars * perBar * stepS;
  const total = Math.ceil((loopS + 3) * SR);
  const mix = new Float32Array(total);
  const add = (buf, t) => {
    const start = Math.round(t * SR);
    for (let i = 0; i < buf.length && start + i < total; i++)
      mix[start + i] += buf[i];
  };
  const noiseHit = (t, g, decay, f) => {
    const n = Math.ceil((decay + 0.02) * SR);
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++)
      b[i] = (rand() * 2 - 1) * g * Math.exp((-6.9 * i) / SR / decay);
    add(filter(b, f, 0, decay), t);
  };
  for (const track of loop.tracks) {
    for (let bar = 0; bar < loop.bars; bar++) {
      const tokens = track.pattern[bar % track.pattern.length]
        .trim()
        .split(/\s+/);
      tokens.forEach((token, s) => {
        if (token === '.') return;
        const t = (bar * perBar + s) * stepS;
        if (track.kind === 'tone') {
          const ev = parseTone(token);
          const g =
            (track.gain * ev.vel) /
            Math.sqrt(ev.freqs.length * (track.detuneCents ? 2 : 1));
          const hold = Math.max(ev.len * stepS, track.attackS);
          const dur = hold + track.releaseS;
          const n = Math.ceil(dur * SR);
          const b = new Float32Array(n);
          const cents = track.detuneCents ? [0, track.detuneCents] : [0];
          for (const f0 of ev.freqs)
            for (const c of cents) {
              const f = f0 * 2 ** (c / 1200);
              for (let i = 0; i < n; i++) b[i] += osc(track.wave, (f * i) / SR);
            }
          const out = filter(b, track.filter, 0, hold);
          for (let i = 0; i < n; i++) {
            const tt = i / SR;
            const e =
              tt < track.attackS
                ? tt / track.attackS
                : tt < hold
                  ? 1
                  : Math.exp((-6.9 * (tt - hold)) / track.releaseS);
            out[i] *= e * g;
          }
          add(out, t);
        } else if (track.kind === 'kick') {
          const g = track.gain * (token === 'o' ? 0.5 : 1);
          const n = Math.ceil(0.35 * SR);
          const b = new Float32Array(n);
          let ph = 0;
          for (let i = 0; i < n; i++) {
            const tt = i / SR;
            ph += (42 + 113 * Math.exp((-tt / 0.13) * 2.2)) / SR;
            b[i] =
              Math.sin(2 * Math.PI * ph) *
              g *
              Math.min(1, tt / 0.004) *
              Math.exp(-tt * 14);
          }
          add(b, t);
        } else if (track.kind === 'snare') {
          const g = track.gain * (token === 'o' ? 0.5 : 1);
          noiseHit(t, g, 0.17, { type: 'bandpass', freq: 1900, q: 0.8 });
          const n = Math.ceil(0.14 * SR);
          const b = new Float32Array(n);
          for (let i = 0; i < n; i++)
            b[i] =
              osc('triangle', (150 * i) / SR) *
              g *
              0.5 *
              Math.exp((-i / SR) * 40);
          add(b, t);
        } else {
          noiseHit(t, track.gain * (token === 'o' ? 0.5 : 1), 0.05, {
            type: 'highpass',
            freq: 7500,
            q: 0.7,
          });
        }
      });
    }
  }
  // Zwinięcie ogona na początek, żeby WAV zapętlał się bez dziury.
  const loopN = Math.round(loopS * SR);
  const out = new Float32Array(loopN);
  for (let i = 0; i < total; i++) out[i % loopN] += mix[i];
  return { out, loopS };
}

function writeWav(path, samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++)
    buf.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767),
      44 + i * 2,
    );
  writeFileSync(path, buf);
}

for (const [id, loop] of Object.entries(data.loops)) {
  if (only && only !== id) continue;
  const { out, loopS } = renderLoop(id, loop);
  let peak = 0,
    sum = 0;
  for (const v of out) {
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  const rms = Math.sqrt(sum / out.length);
  const path = join(outDir, `music-${id}.wav`);
  writeWav(path, out);
  console.log(
    `${id}: ${loop.bpm} BPM, ${loop.bars} taktów, ${loopS.toFixed(1)} s, szczyt ${peak.toFixed(2)}, RMS ${rms.toFixed(3)} -> ${path}`,
  );
}
