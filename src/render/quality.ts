import type { Settings } from '../core/save';
import { tuning } from '../core/tuning';
import { getLiteFx } from './fxMode';

type Quality = Settings['quality'];
interface QualityTargets {
  renderer: {
    setPixelRatio(ratio: number): void;
    shadowMap: { enabled: boolean };
  };
  pipeline: { setSize(width: number, height: number): void };
  width: number;
  height: number;
  devicePixelRatio: number;
}

// Bez uruchomienia aplikacji zachowujemy dotychczasowe ustawienia scen debug.
let active: Quality = 'high';

export function getQuality(): Readonly<(typeof tuning.quality)[Quality]> {
  if (getLiteFx()) return liteQuality;
  return tuning.quality[active];
}

// Osobne ograniczenia debug: GUI i zapis jakości nie mogą przywrócić kosztownych efektów.
const liteQuality = Object.freeze({
  ...tuning.quality.low,
  pixelRatio: 1,
  rainDensity: 0,
  particleDensity: 0,
});

/** Motywy zachowują własne wartości; render odczytuje ograniczenia osobno. */
export function applyQuality(profile: Quality, targets?: QualityTargets): void {
  active = profile;
  if (!targets) return;
  const quality = getQuality();
  targets.renderer.setPixelRatio(
    quality.pixelRatio || targets.devicePixelRatio,
  );
  targets.renderer.shadowMap.enabled = quality.shadows > 0;
  targets.pipeline.setSize(targets.width, targets.height);
}
