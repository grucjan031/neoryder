import type { EntityId } from '../../core/events';
import type { Vec3 } from '../../core/math';

/** Opis pojedynczego trafienia. Liczby (obrażenia, odrzut) pochodzą z danych lub tuning.ts. */
export interface DamageInfo {
  amount: number;
  source: EntityId | null;
  /** '#melee' | '#gun' | '#power' | '#elektrycznosc' | '#heavy' | '#friendly_fire' | ... */
  tags: readonly string[];
  /** Punkt trafienia w świecie. */
  point?: Vec3;
  /** Kierunek ciosu (znormalizowany). */
  dir?: Vec3;
  /** Impuls odrzutu w N·s. */
  knockback?: number;
}

export const FRIENDLY_FIRE_TAG = '#friendly_fire';
