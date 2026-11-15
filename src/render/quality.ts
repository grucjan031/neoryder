import type { Settings } from '../core/save';
import { tuning } from '../core/tuning';

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
  return tuning.quality[active];
}

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
