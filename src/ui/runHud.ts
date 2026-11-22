import type { EventBus } from '../core/events';
import type { Rarity } from '../core/runTypes';
import text from '../data/ui/hud.pl.json';
import defeatText from '../data/ui/defeat.pl.json';
import { implantDefinitions } from '../progression/implants';
import { BossBar } from './bossBar';

/** Nieznane i stare zdarzenia nie ujawniają graczowi technicznych identyfikatorów. */
export function defeatMessage(cause?: string): { cause: string; tip: string } {
  const entry = Object.hasOwn(defeatText.causes, cause ?? '')
    ? defeatText.causes[cause as keyof typeof defeatText.causes]
    : defeatText.causes.unknown;
  return {
    cause: `${defeatText.causeLabel}: ${entry.label}`,
    tip: `${defeatText.tipLabel}: ${entry.tips[0]}`,
  };
}

/** Stan runu potrzebny do odtworzenia HUD po wejściu do nowego pokoju. */
export interface RunHudSeed {
  credits: number;
  implants: readonly string[];
}

interface ImplantEntry {
  id: string;
  rarity: Rarity;
  node: HTMLElement;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

/** Skrót etykiety implantu: inicjały słów nazwy, maks. 2 znaki. */
export function implantBadge(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? words.map((word) => word.charAt(0)).join('')
      : name.trim();
  return letters.slice(0, 2).toUpperCase();
}

function restartAnimation(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

/**
 * Warstwa HUD runu: Kredyty, zdobyte implanty i pasek bossa (`BossBar`). Elementy są
 * ukryte, dopóki nie nadejdzie odpowiednie zdarzenie, więc poza runem (Arena)
 * HUD wygląda jak dotąd.
 */
export class RunHud {
  readonly node = element('div', 'run-hud');
  private readonly credits = element('div', 'run-hud__credits');
  private readonly creditsLabel = element(
    'span',
    'run-hud__credits-label',
    text.credits,
  );
  private readonly creditsValue = element('span', 'run-hud__credits-value');
  private readonly creditsDelta = element('span', 'run-hud__credits-delta');
  private readonly implants = element('ul', 'run-hud__implants');
  private readonly boss: BossBar;
  private readonly entries: ImplantEntry[] = [];
  private readonly unsubscribe: (() => void)[];

  constructor(bus: EventBus, seed?: RunHudSeed) {
    this.credits.hidden = true;
    this.credits.setAttribute('role', 'status');
    const creditsIcon = element('span', 'run-hud__credits-icon');
    creditsIcon.setAttribute('aria-hidden', 'true');
    this.credits.append(
      this.creditsLabel,
      creditsIcon,
      this.creditsValue,
      this.creditsDelta,
    );
    this.implants.hidden = true;
    this.implants.setAttribute('aria-label', text.implants);
    this.implants.dataset.micro = text.microImplants;
    this.boss = new BossBar(bus);
    this.node.append(
      this.credits,
      this.implants,
      this.boss.node,
      this.boss.verdict,
    );

    if (seed) {
      this.setCredits(seed.credits);
      for (const id of seed.implants) {
        const rarity = implantDefinitions.get(id)?.rarity;
        if (rarity) this.addImplant(id, rarity, 'reward');
      }
    }

    this.unsubscribe = [
      bus.on('currency_changed', ({ amount, delta }) => {
        this.setCredits(amount);
        this.showDelta(delta);
      }),
      bus.on('implant_acquired', ({ id, rarity, source }) =>
        this.addImplant(id, rarity, source),
      ),
    ];
  }

  private setCredits(amount: number): void {
    this.credits.hidden = false;
    this.creditsValue.textContent = String(amount);
  }

  private showDelta(delta: number): void {
    if (delta === 0) return;
    this.creditsDelta.textContent = delta > 0 ? `+${delta}` : `−${-delta}`;
    this.creditsDelta.dataset.sign = delta > 0 ? 'gain' : 'spend';
    restartAnimation(this.creditsDelta, 'run-hud__credits-delta--show');
  }

  private addImplant(
    id: string,
    rarity: Rarity,
    source: 'reward' | 'shop' | 'upgrade',
  ): void {
    const previous =
      source === 'upgrade'
        ? this.entries.findIndex(
            (entry) => implantDefinitions.get(entry.id)?.upgradesTo === id,
          )
        : -1;
    if (this.entries.some((entry) => entry.id === id)) return;
    const definition = implantDefinitions.get(id);
    const name = definition?.name ?? id;
    const node = element('li', 'run-hud__implant', implantBadge(name));
    const badge = element(
      'span',
      'run-hud__implant-label',
      node.textContent ?? '',
    );
    node.replaceChildren(badge);
    node.dataset.rarity = rarity;
    node.dataset.implant = id;
    node.title = definition ? `${name}\n${definition.description}` : name;
    node.setAttribute('aria-label', node.title);
    const entry: ImplantEntry = { id, rarity, node };
    const old = this.entries[previous];
    if (old) {
      old.node.replaceWith(node);
      this.entries[previous] = entry;
    } else {
      this.entries.push(entry);
      this.implants.append(node);
    }
    restartAnimation(node, 'run-hud__implant--new');
    this.implants.hidden = false;
  }

  clearImplants(): void {
    for (const { node } of this.entries) node.remove();
    this.entries.length = 0;
    this.implants.hidden = true;
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.boss.dispose();
    this.node.remove();
  }
}
