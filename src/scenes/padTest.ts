import type { GameContext } from '../core/context';
import { actionSchema } from '../core/input';
import { setInputGlyph } from '../ui/inputGlyphs';
import labels from '../data/ui/settings.pl.json';
import type { Scene } from './index';

export class PadTest implements Scene {
  readonly id = 'pad-test';
  private input: GameContext['input'];
  private readonly root = document.createElement('section');
  private readonly raw = document.createElement('pre');

  init(ctx: GameContext): void {
    this.input = ctx.input;
    this.root.style.cssText =
      'position:fixed;inset:3rem auto 3rem 1rem;overflow:auto;padding:1rem;background:#151a22;color:#f1efe6;z-index:10';
    const title = document.createElement('h1');
    title.textContent = 'Test pada';
    const list = document.createElement('dl');
    list.style.cssText =
      'display:grid;grid-template-columns:repeat(2, auto max-content);gap:0.25rem 0.75rem';
    for (const action of actionSchema.options) {
      const term = document.createElement('dt');
      term.textContent = labels.actions[action];
      const value = document.createElement('dd');
      value.style.margin = '0';
      value.append(setInputGlyph(document.createElement('kbd'), action));
      list.append(term, value);
    }
    this.root.append(title, this.raw, list);
    document.body.append(this.root);
  }

  step(): void {}

  render(): void {
    const state = this.query('pad');
    const next = state
      ? [
          state.id,
          `${state.device} / ${state.layout}`,
          `Osie: ${state.axes.join(' / ')}`,
          `Lewy: ${state.move.x} / ${state.move.y} · Prawy: ${state.look.x} / ${state.look.y}`,
          ...[0, 6, 12].map((start) =>
            state.buttons
              .slice(start, start + 6)
              .map(
                ({ pressed, value }, index) =>
                  `${start + index}: ${value}${pressed ? '*' : ''}`,
              )
              .join('   '),
          ),
        ].join('\n')
      : 'Naciśnij przycisk na padzie ze standardowym mapowaniem.';
    if (this.raw.textContent !== next) this.raw.textContent = next;
  }

  query(name: string) {
    const frame = this.input?.padFrame;
    if (name !== 'pad' || !frame) return null;
    const round = (n: number) => Number(n.toFixed(3));
    return {
      id: frame.pad.id,
      layout: frame.layout,
      device: this.input?.activeDevice.device,
      axes: frame.pad.axes.map(round),
      buttons: frame.pad.buttons.map(({ pressed, value }) => ({
        pressed,
        value: round(value),
      })),
      move: { x: round(frame.move.x), y: round(frame.move.y) },
      look: { x: round(frame.look.x), y: round(frame.look.y) },
    };
  }

  dispose(): void {
    this.root.remove();
  }
}
