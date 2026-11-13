export interface ResourcePoolOptions {
  /** Maksimum (zwykle ze Stats, np. maxEnergy / heatCapacity) — czytane na żywo. */
  max: () => number;
  /** Zmiana na sekundę po upływie opóźnienia. Dodatnia = regeneracja, ujemna = chłodzenie. */
  regenPerS: () => number;
  /** Ile sekund po ostatnim użyciu wstrzymać regenerację (domyślnie 0). */
  regenDelayS?: () => number;
  /** Wartość startowa; domyślnie max. */
  start?: number;
}

/**
 * Wspólny zasób z limitem: energia Rezonansu (spend + regeneracja)
 * oraz ciepło broni (add z resetDelay + ujemna regeneracja = chłodzenie).
 */
export class ResourcePool {
  private value: number;
  private sinceUseS = Number.POSITIVE_INFINITY;

  constructor(private readonly opts: ResourcePoolOptions) {
    this.value = clamp(opts.start ?? opts.max(), 0, opts.max());
  }

  get max(): number {
    return Math.max(0, this.opts.max());
  }

  get current(): number {
    return Math.min(this.value, this.max);
  }

  get fraction(): number {
    const max = this.max;
    return max > 0 ? this.current / max : 0;
  }

  /** Zużywa n; gdy brakuje — zwraca false i nic nie zmienia. Wstrzymuje regenerację. */
  spend(n: number): boolean {
    if (!(n >= 0) || this.current < n) return false;
    this.value = this.current - n;
    this.sinceUseS = 0;
    return true;
  }

  /** Dodaje n (może być ujemne), obcina do [0, max]. resetDelay: traktuj jak użycie (np. nagrzanie broni). */
  add(n: number, opts: { resetDelay?: boolean } = {}): void {
    if (!Number.isFinite(n)) return;
    this.value = clamp(this.current + n, 0, this.max);
    if (opts.resetDelay) this.sinceUseS = 0;
  }

  set(n: number): void {
    if (Number.isFinite(n)) this.value = clamp(n, 0, this.max);
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    const delay = Math.max(0, this.opts.regenDelayS?.() ?? 0);
    this.sinceUseS += dt;
    // Regeneruj tylko za część kroku po upływie opóźnienia (Infinity = dawno nieużywany).
    const active = Math.min(dt, Math.max(0, this.sinceUseS - delay));
    if (active > 0)
      this.value = clamp(
        this.current + this.opts.regenPerS() * active,
        0,
        this.max,
      );
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}
