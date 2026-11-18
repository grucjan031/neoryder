import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import { weatherDefinitions } from '../render/weatherSchema';
import { RunScene } from './run';
import type { Scene } from './index';

/** Pełna arena z kolizjami; wybór pogody dostępny także bez otwierania konsoli. */
export class WeatherTest implements Scene {
  readonly id = 'weatherTest';
  private readonly run = new RunScene({
    params: new URLSearchParams({ scene: 'weatherTest', mode: 'conquest' }),
  });
  private controls?: HTMLDivElement;
  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    await this.run.init(ctx, three);
    ctx.commands?.execute('god');
    if (typeof document === 'undefined') return;
    const controls = document.createElement('div');
    controls.dataset.weatherControls = '';
    Object.assign(controls.style, {
      position: 'fixed',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '30',
      display: 'flex',
      gap: '6px',
    });
    for (const profile of weatherDefinitions.values()) {
      const button = document.createElement('button');
      button.textContent = profile.title;
      button.dataset.weather = profile.id;
      button.addEventListener('click', () =>
        ctx.commands?.execute(`weather ${profile.id}`),
      );
      controls.append(button);
    }
    document.body.append(controls);
    this.controls = controls;
  }
  step(dt: number, input: InputSnapshot): void {
    this.run.step(dt, input);
  }
  render(alpha: number, frameDt = 0): void {
    this.run.render(alpha, frameDt);
  }
  query(name: string): unknown {
    return this.run.query(name);
  }
  dispose(): void {
    this.controls?.remove();
    this.run.dispose();
  }
}
