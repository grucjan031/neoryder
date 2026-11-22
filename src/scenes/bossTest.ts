import type { Scene as ThreeScene } from 'three';
import { enemyDefinitions, simulate } from '../balance/simulator';
import { blasterDefinition } from '../combat/weapons/weaponSchema';
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
  private unregisterTtk?: () => void;

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
    this.unregisterTtk = ctx.commands?.register(
      'boss ttk',
      'boss ttk — TTK i przebieg faz dla blastera',
      () => {
        const boss = enemyDefinitions.get(data.initialEnemies[0]?.id ?? '');
        if (boss?.kind !== 'boss') return 'Brak danych bossa tej sceny.';
        const result = simulate(
          { kind: 'weapon', definition: blasterDefinition },
          boss,
          {
            settings: ctx.tuning,
          },
        );
        const ttk = Number.isFinite(result.ttkS) ? result.ttkS.toFixed(3) : '∞';
        const timeline = result.bossTimeline?.map((event) => {
          const label =
            event.kind === 'phase' ? `faza ${event.phase}` : event.pattern;
          return `${label} (${event.timeS.toFixed(3)} s)`;
        });
        return `TTK ${boss.id} (blaster): ${ttk} s. ${timeline?.join(' → ')}`;
      },
    );
  }

  override render(alpha: number, frameDt = 1 / 60): void {
    super.render(alpha, frameDt);
    this.bossFx?.render(alpha, frameDt);
    this.bossFx?.applyLights(this.lights);
  }

  override dispose(): void {
    this.unregisterTtk?.();
    this.unmountBar?.();
    this.bossFx?.dispose();
    super.dispose();
  }
}
