import type { AmbienceKind, AmbienceSource } from '../audio/ambienceSchema';
import { tuning } from '../core/tuning';
import type { Tuning } from '../core/tuning';
import type { Vec3 } from '../core/math';
import type { HubLayout } from './hubSchema';

/** Wyłącznie dane: bez renderu, DOM i losowości. */
export function hubAmbienceSources(
  layout: HubLayout,
  extra: { sources: readonly AmbienceSource[] },
  audio: Tuning['audio'] = tuning.audio,
): AmbienceSource[] {
  const sources: AmbienceSource[] = [];
  const add = (kind: AmbienceKind, position: Vec3): void => {
    sources.push({
      kind,
      position: { ...position },
      radiusM: audio.ambienceProfiles[kind].radiusM,
    });
  };
  for (const fire of layout.fires ?? []) add('fire', fire.position);
  for (const block of layout.blocks)
    if (block.model === 'city_generator') add('generator', block.position);
  for (const fx of layout.ambientFx ?? [])
    if (fx.kind === 'drip' || fx.kind === 'steam') add(fx.kind, fx.position);
  const screens = (layout.panels ?? []).filter((p) => p.kind === 'screen');
  const remaining = new Set(screens);
  // Skupisko ma promień <= 4 m od pierwszego ekranu (bez łańcucha przez całą halę).
  for (const anchor of screens) {
    if (!remaining.delete(anchor)) continue;
    const center = { ...anchor.position };
    let count = 1;
    for (const panel of remaining) {
      if (
        Math.hypot(
          panel.position.x - anchor.position.x,
          panel.position.y - anchor.position.y,
          panel.position.z - anchor.position.z,
        ) > audio.ambienceScreenClusterM
      )
        continue;
      remaining.delete(panel);
      center.x += panel.position.x;
      center.y += panel.position.y;
      center.z += panel.position.z;
      count++;
    }
    center.x /= count;
    center.y /= count;
    center.z /= count;
    add('screens', center);
  }
  for (const source of extra.sources)
    sources.push({ ...source, position: { ...source.position } });
  return sources;
}
