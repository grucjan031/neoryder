import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';

const distance = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Członek drużyny gracza widziany przez wroga; `position` to punkt celowania (środek sylwetki). */
export interface HostileCandidate {
  id: EntityId;
  position: Vec3;
  kind: 'player' | 'ally';
  yaw?: number;
}

export interface HostileTargetOptions {
  /** Mnożnik odległości do sojusznika (> 1: przy podobnej odległości wygrywa gracz). */
  allyBias: number;
  /** Mnożnik odległości do bieżącego celu (< 1: wróg nie skacze między celami). */
  stickyBias: number;
  currentId?: EntityId | null;
}

/**
 * Cel wroga spośród drużyny gracza: najmniejsza ważona odległość. Gracz ma wagę 1,
 * sojusznik `allyBias`, bieżący cel dodatkowo `stickyBias`. Remis: gracz, potem niższe id.
 */
export function selectHostileTarget(
  from: Vec3,
  candidates: readonly HostileCandidate[],
  options: HostileTargetOptions,
): HostileCandidate | null {
  let best: HostileCandidate | null = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const score =
      distance(from, candidate.position) *
      (candidate.kind === 'ally' ? options.allyBias : 1) *
      (candidate.id === options.currentId ? options.stickyBias : 1);
    if (
      score < bestScore ||
      (score === bestScore &&
        best !== null &&
        (candidate.kind === 'player'
          ? best.kind !== 'player' || candidate.id < best.id
          : best.kind !== 'player' && candidate.id < best.id))
    ) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** Wróg widziany przez sojusznika; `position` to punkt celowania. */
export interface AllyTargetCandidate {
  id: EntityId;
  position: Vec3;
  /** Wróg ostatnio ranił gracza albo właśnie w niego celuje. */
  attackingPlayer: boolean;
}

export interface AllyTargetOptions {
  rangeM: number;
  attackerBias: number;
  stickyBias: number;
  currentId?: EntityId | null;
}

/**
 * Cel sojusznika: najbliższy widoczny wróg w zasięgu, z preferencją wroga atakującego gracza
 * i bieżącego celu. `visible` (raycast) jest wołane tylko dla kolejnych najlepszych kandydatów.
 */
export function selectAllyTarget(
  from: Vec3,
  candidates: readonly AllyTargetCandidate[],
  options: AllyTargetOptions,
  visible: (candidate: AllyTargetCandidate) => boolean,
): AllyTargetCandidate | null {
  const ranked: { candidate: AllyTargetCandidate; score: number }[] = [];
  for (const candidate of candidates) {
    const d = distance(from, candidate.position);
    if (d > options.rangeM) continue;
    ranked.push({
      candidate,
      score:
        d *
        (candidate.attackingPlayer ? options.attackerBias : 1) *
        (candidate.id === options.currentId ? options.stickyBias : 1),
    });
  }
  ranked.sort((a, b) => a.score - b.score || a.candidate.id - b.candidate.id);
  for (const entry of ranked)
    if (visible(entry.candidate)) return entry.candidate;
  return null;
}
