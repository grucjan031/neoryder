import type { DamageInfo } from './types';

/** Zdrowie encji. Obrażenia zadawaj wyłącznie przez DamageSystem.deal (heal wolno wołać bezpośrednio). */
export class Health {
  private value: number;

  constructor(private readonly maxFn: () => number) {
    this.value = Math.max(0, maxFn());
  }

  get max(): number {
    return Math.max(0, this.maxFn());
  }

  get current(): number {
    return Math.min(this.value, this.max);
  }

  get dead(): boolean {
    return this.current <= 0;
  }

  /** Zwraca faktycznie zadane obrażenia (nie więcej niż pozostałe zdrowie). Redukcje stosuje wołający. */
  apply(info: Pick<DamageInfo, 'amount'>): number {
    if (this.dead || !(info.amount > 0)) return 0;
    const dealt = Math.min(this.current, info.amount);
    this.value = this.current - dealt;
    return dealt;
  }

  heal(n: number): void {
    if (this.dead || !(n > 0)) return;
    this.value = Math.min(this.max, this.current + n);
  }

  /** Przywraca pełne zdrowie (respawn, reset sceny). */
  reset(): void {
    this.value = this.max;
  }
}
