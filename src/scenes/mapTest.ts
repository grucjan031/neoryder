import type { GameContext } from '../core/context';
import type { SectorMap } from '../core/runTypes';
import { generateSectorMap } from '../world/sectorMap';
import { kuroganeSector } from '../world/sectors';
import type { Scene } from './index';

export class MapTest implements Scene {
  readonly id = 'map-test';
  private map?: SectorMap;
  private output?: HTMLPreElement;
  private off?: () => void;

  init(ctx: GameContext): void {
    const seed =
      new URLSearchParams(globalThis.location?.search ?? '').get('seed') ??
      'map-test';
    this.map = generateSectorMap(kuroganeSector, seed);
    const text = `Mapa: ${kuroganeSector.name} · seed: ${seed}\n\n${this.map.layers.map((layer) => layer.map((node) => `${node.id} ${node.type} → ${node.next.join(', ') || 'koniec'}`).join('\n')).join('\n\n')}`;
    if (typeof document !== 'undefined') {
      this.output = document.createElement('pre');
      this.output.setAttribute('aria-label', 'Mapa sektora');
      this.output.style.cssText =
        'position:fixed;inset:48px 12px 40px;overflow:auto;z-index:5;background:white;color:black;padding:16px;margin:0;';
      this.output.textContent = text;
      document.body.append(this.output);
    }
    this.off = ctx.commands?.register(
      'map',
      'map — wypisz mapę sektora',
      () => text,
    );
  }

  step(): void {}
  render(): void {}

  query(name: string): unknown {
    return name === 'map' ? this.map : undefined;
  }

  dispose(): void {
    this.off?.();
    this.output?.remove();
  }
}
