import { tuning } from '../../core/tuning';
import type { FlickerDef } from '../../world/dressingSchema';

/** Statyczne mieszanie bitów; indeks czasu zastępuje mutowalny generator. */
function noise(seed: number, index: number): number {
  let value = (seed + Math.imul(index, 0x6d2b79f5)) >>> 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

/** Czysty mnożnik emisji: bez stanu i alokacji, niezależny od liczby klatek. */
export function flickerIntensity(
  pattern: FlickerDef['pattern'],
  t: number,
  seed: number,
  strength = tuning.city.flickerStrength,
  periodS?: number,
): number {
  const f = tuning.city;
  const depth = Math.max(0, Math.min(1, strength));
  if (depth === 0) return 1;
  if (pattern === 'pulse') {
    const period = periodS ?? f.flickerPulsePeriodS;
    return (
      1 -
      depth *
        (0.5 - 0.5 * Math.cos((t / period + noise(seed, 0)) * Math.PI * 2))
    );
  }
  if (pattern === 'buzz') {
    const period = periodS ?? f.flickerBuzzPeriodS;
    return 1 - depth * f.flickerBuzzDepth * noise(seed, Math.floor(t / period));
  }
  const period = periodS ?? f.flickerFailPeriodS;
  const shifted = t + noise(seed, 0) * period;
  const cycle = Math.floor(shifted / period);
  const local = shifted - cycle * period;
  // Każdy cykl ma własny początek serii; stabilny odcinek nie wymaga iteracji historii.
  const start =
    period * (0.5 + (noise(seed, cycle * 4 + 1) - 0.5) * f.flickerFailJitter);
  const dips =
    f.flickerFailMinDips +
    Math.floor(
      noise(seed, cycle * 4 + 2) *
        (f.flickerFailMaxDips - f.flickerFailMinDips + 1),
    );
  const spacing = f.flickerFailDipS + f.flickerFailGapS;
  // Krótkie periodS skaluje serię, zachowując stabilną część każdego cyklu.
  const scale = Math.min(
    1,
    (period * (0.5 - f.flickerFailJitter / 2)) /
      (dips * spacing + f.flickerFailDarkS),
  );
  const elapsed = (local - start) / scale;
  if (elapsed < 0) return 1;
  if (elapsed < dips * spacing) {
    return elapsed % spacing < f.flickerFailDipS ? 1 - depth : 1;
  }
  if (
    elapsed < dips * spacing + f.flickerFailDarkS &&
    noise(seed, cycle * 4 + 3) < f.flickerFailDarkChance
  )
    return 0;
  return 1;
}

/** Dostępność: szybkie wzory mają stałą jasność po wyłączeniu błysków. */
export function sourceFlicker(
  def: FlickerDef | undefined,
  t: number,
  seed: number,
  flashes: boolean,
): number {
  if (!def || (!flashes && def.pattern !== 'pulse')) return 1;
  if (def.strength === 0) return 1;
  return flickerIntensity(def.pattern, t, seed, def.strength, def.periodS);
}
