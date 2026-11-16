import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { Enemy } from '../enemies/types';
import { BossArenaFx } from '../render/bossArenaFx';
import { mountBossBar } from '../ui/bossBar';
import { AiTest, aiTestSchema } from './aiTest';
import data from '../data/scenes/bossTest.json';

/** `?scene=boss-test`: ai-test z bossem oraz jego oprawą (pasek, zapowiedź, telegrafy, fazy). */
export class BossTest extends AiTest {
  private bossFx?: BossArenaFx;
  private unmountBar?: () => void;

  constructor(loadModels = true) {
    super(loadModels, { id: 'boss-test', data: aiTestSchema.parse(data) });
  }

  override async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    // Oprawa przed init: boss pojawia się (boss_spawned) w trakcie budowy sceny.
    this.bossFx = new BossArenaFx(ctx.bus, {
      enemy: (id) => {
        let found: Enemy | undefined;
        this.manager.forEach((enemy) => {
          if (enemy.id === id) found = enemy;
        });
        return found;
      },
      floorY: 0,
      tuning: ctx.tuning,
      burstSparks: (point, count, color) =>
        this.hitSparks.burst(point, null, color, count),
    });
    if (typeof document !== 'undefined')
      this.unmountBar = mountBossBar(ctx.bus, document.body, ctx.tuning);
    await super.init(ctx, three);
    this.root.add(this.bossFx.root);
  }

  override render(alpha: number, frameDt = 1 / 60): void {
    super.render(alpha, frameDt);
    this.bossFx?.render(alpha, frameDt);
    this.bossFx?.applyLights(this.lights);
  }

  override dispose(): void {
    this.unmountBar?.();
    this.bossFx?.dispose();
    super.dispose();
  }
}
