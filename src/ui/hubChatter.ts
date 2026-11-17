import type { ChatterLine } from '../world/hubChatter';
import type { NpcTexts } from '../world/hubNpcs';
import type { HubNpcDef, NpcAccent } from '../world/hubSchema';
import './hubChatter.css';

/** Napisy podsłuchiwanej rozmowy; scena wywołuje update wyłącznie podczas renderu. */
export class HubChatterUi {
  private readonly root = document.createElement('div');
  private readonly name = document.createElement('span');
  private readonly text = document.createElement('span');
  private current: ChatterLine | null = null;
  private readonly speakers = new Map<
    string,
    { name: string; accent: NpcAccent }
  >();

  constructor(
    npcs: readonly HubNpcDef[],
    texts: NpcTexts,
    parent: Element = document.querySelector('#app') ?? document.body,
  ) {
    for (const npc of npcs)
      this.speakers.set(npc.id, {
        name: texts.npcs.find(({ id }) => id === npc.id)?.name ?? npc.id,
        accent: npc.accent,
      });
    this.root.className = 'hub-chatter';
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.name.className = 'hub-chatter__name';
    this.text.className = 'hub-chatter__text';
    this.root.append(this.name, this.text);
    parent.append(this.root);
  }

  update(line: ChatterLine | null): void {
    if (line === this.current) return;
    this.current = line;
    this.root.hidden = line === null;
    if (!line) return;
    const speaker = this.speakers.get(line.npc);
    this.name.textContent = `${speaker?.name ?? line.npc}: `;
    this.text.textContent = line.text;
    this.root.dataset.accent = speaker?.accent ?? 'white';
    this.root.dataset.npc = line.npc;
    this.root.dataset.conversation = line.conversation;
  }

  dispose(): void {
    this.root.remove();
  }
}
