import type { Scene as ThreeScene } from 'three';
import { enemyDefinitions, simulate } from '../balance/simulator';
import { blasterDefinition } from '../combat/weapons/weaponSchema';
import type { GameContext } from '../core/context';
import type { Enemy } from '../enemies/types';
import { BossArenaFx } from '../render/bossArenaFx';
import { BossFieldView } from '../render/bossFieldView';
import { mountBossBar } from '../ui/bossBar';
import { AiTest, aiTestSchema } from './aiTest';
import data from '../data/scenes/bossTest.json';
import orbis from '../data/scenes/orbisTest.json';

/** `?scene=boss-test`: ai-test z bossem oraz jego oprawą (pasek, zapowiedź, telegrafy, fazy). */
export class BossTest extends AiTest {
  private bossFx?: BossArenaFx;
  private unmountBar?: () => void;
  private unregisterTtk?: () => void;
  private readonly bossId: string;
  private fieldView?: BossFieldView;
  private prompt?: HTMLElement;
  private getSlideHeight: () => number = () => 0;
  private gone = false;

  constructor(loadModels = true, search = globalThis.location?.search) {
    const selected =
      new URLSearchParams(search).get('boss') === 'orbisDirector';
    const bossId = selected ? 'orbisDirector' : data.initialEnemies[0]!.id;
    super(loadModels, {
      id: 'boss-test',
      data: aiTestSchema.parse({
        ...data,
        ...(selected ? orbis : {}),
        initialEnemies: [{ ...data.initialEnemies[0], id: bossId }],
      }),
    });
    this.bossId = bossId;
  }

  override async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    if (this.bossId === 'orbisDirector') {
      this.getSlideHeight = () => ctx.tuning.player.slideCapsuleHeight;
      this.fieldView = new BossFieldView();
      this.root.add(this.fieldView.root);
      if (typeof document !== 'undefined') {
        this.prompt = document.createElement('p');
        this.prompt.setAttribute('role', 'status');
        this.prompt.style.cssText =
          'position:absolute;top:22%;width:100%;text-align:center;pointer-events:none;color:white;text-shadow:0 1px 3px black';
        document.body.append(this.prompt);
      }
    }
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
    if (this.gone) return;
    this.root.add(this.bossFx.root);
    this.unregisterTtk = ctx.commands?.register(
      'boss ttk',
      'boss ttk — TTK i przebieg faz dla blastera',
      () => {
        const boss = enemyDefinitions.get(this.bossId);
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
    if (this.fieldView) {
      let boss: Enemy | undefined;
      this.manager.forEach((enemy) => {
        if (enemy.definition.id === this.bossId && !enemy.removed) boss = enemy;
      });
      const hint = this.fieldView.render(boss, this.getSlideHeight());
      if (this.prompt && this.prompt.textContent !== hint)
        this.prompt.textContent = hint;
    }
    this.bossFx?.render(alpha, frameDt);
    this.bossFx?.applyLights(this.lights);
  }

  override dispose(): void {
    this.gone = true;
    this.unregisterTtk?.();
    this.fieldView?.dispose();
    this.prompt?.remove();
    this.unmountBar?.();
    this.bossFx?.dispose();
    super.dispose();
  }
}
