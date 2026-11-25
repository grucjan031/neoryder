import type { Scene } from 'three';
import type { GameContext } from '../core/context';
import { roomSchema } from '../world/roomSchema';
import { RoomScene } from './roomScene';
import { roomTestRun } from './roomTest';
import { protoBaseWaves, protoParams } from './prototypeScene';

const point = (x: number, z: number, y = 0) => ({ x, y, z });
const posts = [point(0, 1), point(-6, -4), point(5, -6), point(7, 0)];
const block = (
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  y = h / 2,
) => ({
  position: point(x, z, y),
  size: point(w, d, h),
  material: 'concrete',
  walkable: y < 0,
});
const hall = roomSchema.parse({
  id: 'stealthHall',
  name: 'Hala nadzoru',
  type: 'combat',
  playerSpawn: point(0, 8),
  spawnPoints: posts,
  blocks: [
    block(0, 0, 22, 24, 1, -0.5),
    block(-11, 0, 1, 24, 4),
    block(11, 0, 1, 24, 4),
    block(0, -12, 22, 1, 4),
    block(0, 12, 22, 1, 4),
    block(-3, 4, 2, 3, 2),
    block(3, -2, 2, 3, 2),
  ],
  doors: ['entry', 'exit'].map((role, i) => ({
    id: role,
    role,
    position: point(0, i ? -12 : 12, 1.5),
    size: point(2, 0.4, 3),
  })),
});

export class StealthTest extends RoomScene {
  override readonly id = 'stealth-test';
  private readonly unregister: (() => void)[] = [];
  constructor() {
    super(hall, roomTestRun(hall, protoParams()), protoBaseWaves(hall), {
      manualEncounter: true,
    });
  }
  override async init(ctx: GameContext, three: Scene) {
    await super.init(ctx, three);
    if (this.disposed) return;
    const reset = () => {
      this.prepareEncounter({
        passive: false,
        invulnerable: true,
        held: 'gun',
        position: point(
          0,
          8,
          ctx.tuning.player.capsuleHeight / 2 +
            ctx.tuning.player.controllerOffset,
        ),
      });
      for (const [i, pos] of posts.entries()) {
        const sentry = i === posts.length - 1;
        const enemy = this.manager.spawn(
          sentry ? 'drone' : i === 1 ? 'gunner' : 'assaulter',
          pos,
          {
            groupId: 'hala',
            sentry,
            patrol: sentry
              ? undefined
              : {
                  points: [pos, point(pos.x, pos.z - 4)],
                  mode: 'pingpong',
                  waitS: 1,
                },
          },
        );
        enemy.current.yaw = enemy.previous.yaw = Math.PI;
      }
      return 'Patrole na stanowiskach.';
    };
    reset();
    const off = ctx.commands?.register(
      'stealth',
      'stealth state | suspect | alarm | reset | cones on/off',
      ([action, value]) => {
        if (action === 'reset') return reset();
        if (action === 'suspect') {
          const point = this.playerSnapshot().position;
          this.manager.forEach((enemy) => {
            if (enemy.current.state !== 'dead')
              enemy.perception?.suspect(point);
          });
          return 'Strażnicy badają pozycję gracza.';
        }
        if (action === 'alarm') {
          this.manager.forceAlarm('hala');
          return 'Alarm w hali.';
        }
        const rows: string[] = [];
        this.manager.forEach((e) => {
          const p = e.perception;
          if (!p || e.current.state === 'dead') return;
          if (action === 'cones' && (value === 'on' || value === 'off'))
            p.showCone = value === 'on';
          rows.push(
            `#${e.id} ${e.definition.kind} ${p.state} ${p.awareness.toFixed(2)}`,
          );
        });
        return rows.join('\n');
      },
    );
    if (off) this.unregister.push(off);
  }
  override dispose() {
    for (const off of this.unregister.splice(0)) off();
    super.dispose();
  }
}
