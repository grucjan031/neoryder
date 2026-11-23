import { z } from 'zod';
import textData from '../data/ui/meta.pl.json';
import './hubScreens.css';
import { setInputGlyph } from './inputGlyphs';

const text = z
  .object({ hub: z.object({ interact: z.string() }) })
  .parse(textData).hub;

/** Podpowiedź interakcji; scena przekazuje etykietę wybranej stacji podczas renderowania. */
export class HubPrompt {
  private readonly root = document.createElement('div');
  private readonly label = document.createElement('span');

  constructor(
    parent: Element = document.querySelector('#app') ?? document.body,
  ) {
    this.root.className = 'hub-prompt';
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-label', text.interact);
    const key = setInputGlyph(document.createElement('kbd'), 'power2');
    this.root.append(key, this.label);
    parent.append(this.root);
  }

  /** `caption` zastępuje domyślny podpis nad etykietą (np. imię NPC); bez niego wraca „interakcja”. */
  update(
    label: string | null,
    overlayOpen = false,
    caption: string = text.interact,
  ): void {
    this.root.hidden = label === null || overlayOpen;
    this.label.textContent = label ?? '';
    if (this.root.getAttribute('aria-label') !== caption)
      this.root.setAttribute('aria-label', caption);
  }

  dispose(): void {
    this.root.remove();
  }
}
