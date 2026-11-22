import type { Group } from 'three';
import type { Action, InputSnapshot } from '../core/input';
import type { Tuning } from '../core/tuning';
import type { EventBus } from '../core/events';
import { AllyView } from '../render/allyView';
import { SquadHud } from '../ui/squadHud';
import { ArenaNavigation } from '../world/arenaNavigation';
import type { RoomDefinition } from '../world/roomSchema';
import type { AllyNavigation } from './ally';
import type { AllySquad } from './squad';

/** Kopia wejścia bez jednej akcji (klawisz przejęty przez interakcję z sojusznikiem). */
export function withoutAction(
  input: InputSnapshot,
  action: Action,
): InputSnapshot {
  const strip = (set: ReadonlySet<Action>): ReadonlySet<Action> => {
    if (!set.has(action)) return set;
    const copy = new Set(set);
    copy.delete(action);
    return copy;
  };
  return {
    ...input,
    held: strip(input.held),
    pressed: strip(input.pressed),
    released: strip(input.released),
  };
}

/**
 * Siatka nawigacji sojuszników dla układu bez danych trybu (arena fal, zwykłe pokoje): podłoga
 * na wysokości startu, bez bloków `walkable`. null, gdy siatki nie da się zbudować.
 */
export function buildFloorNavigation(
  layout: Pick<RoomDefinition, 'blocks' | 'playerSpawn'>,
  tuning: Tuning,
): AllyNavigation | null {
  const t = tuning.allies;
  try {
    return new ArenaNavigation({
      ...layout,
      blocks: layout.blocks.map((block) => ({ ...block, walkable: undefined })),
      // Siatka podłogi potrzebuje tylko rozmiaru komórki i prześwitu.
      arena: {
        navigationCellM: t.navCellM,
        navigationClearanceM: t.navClearanceM,
      },
    } as unknown as RoomDefinition);
  } catch {
    return null;
  }
}

/**
 * Widoki sojuszników i HUD drużyny wspólne dla scen walki (`RoomScene`, arena): tworzy widoki
 * w miarę dołączania sojuszników, interpoluje pozy w `render(alpha)` i sprząta po sobie.
 */
export class SquadPresenter {
  private readonly views = new Map<string, AllyView>();
  private readonly hud?: SquadHud;

  constructor(
    private readonly squad: AllySquad,
    private readonly root: Group,
    private readonly tuning: Tuning,
    bus: EventBus,
    private readonly loadModels: boolean,
  ) {
    if (typeof document !== 'undefined')
      this.hud = new SquadHud(bus, () => tuning.allies.barkShowS);
  }

  render(
    alpha: number,
    frameDt: number,
    camera: { x: number; y: number; z: number } | undefined,
    canRevive: boolean,
  ): void {
    const { squad } = this;
    if (squad.size === 0 && this.views.size === 0) {
      this.hud?.update([], squad.order, null);
      return;
    }
    const snapshots = squad.snapshots();
    const seen = new Set<string>();
    let index = 0;
    squad.forEachPose((ally, a, b) => {
      const id = ally.definition.id;
      seen.add(id);
      let view = this.views.get(id);
      if (!view) {
        view = new AllyView(this.tuning, ally.definition);
        this.views.set(id, view);
        this.root.add(view.root);
        if (this.loadModels) void view.load();
      }
      let dyaw = b.yaw - a.yaw;
      dyaw -= Math.PI * 2 * Math.round(dyaw / (Math.PI * 2));
      view.update(
        {
          position: {
            x: a.position.x + (b.position.x - a.position.x) * alpha,
            y: a.position.y + (b.position.y - a.position.y) * alpha,
            z: a.position.z + (b.position.z - a.position.z) * alpha,
          },
          yaw: a.yaw + dyaw * alpha,
        },
        snapshots[index++]!,
        frameDt,
        camera,
      );
    });
    for (const [id, view] of this.views)
      if (!seen.has(id)) {
        view.dispose();
        this.views.delete(id);
      }
    const candidate = canRevive ? squad.reviveCandidate() : null;
    this.hud?.update(
      snapshots,
      squad.order,
      candidate
        ? {
            name: candidate.definition.name,
            progress: candidate.snapshot().reviveProgress,
          }
        : null,
    );
  }

  dispose(): void {
    for (const view of this.views.values()) view.dispose();
    this.views.clear();
    this.hud?.dispose();
  }
}
