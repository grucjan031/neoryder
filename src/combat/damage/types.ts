import type { EntityId } from '../../core/events';
import type { Vec3 } from '../../core/math';

export interface StatusApplication {
  id: string;
  durationS: number;
  /** Liczba stosów, domyślnie 1. */
  stacks?: number;
}

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
  statuses?: readonly StatusApplication[];
}

export const FRIENDLY_FIRE_TAG = '#friendly_fire';

/** Tag ciosu przebijającego blok (ciężki atak ostrzem, ciężkie ataki wrogów). */
export const PIERCE_BLOCK_TAG = '#heavy';

/** Źródło modyfikatora damageTaken nakładanego przez blok (ignorowane przy PIERCE_BLOCK_TAG). */
export const BLOCK_SOURCE = 'block';
