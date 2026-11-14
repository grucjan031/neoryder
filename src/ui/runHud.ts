import type { EntityId, EventBus } from '../core/events';
import type { Rarity } from '../core/runTypes';
import text from '../data/ui/hud.pl.json';
import { implantDefinitions } from '../progression/implants';

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
 * Warstwa HUD runu: Kredyty, zdobyte implanty i pasek HP bossa. Elementy są
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
  private readonly boss = element('div', 'run-hud__boss');
  private readonly bossName = element('span', 'run-hud__boss-name');
  private readonly bossTrack = element('div', 'run-hud__boss-track');
  private readonly bossFill = element('div', 'run-hud__boss-fill');
  private readonly bossTicks = element('div', 'run-hud__boss-ticks');
  private readonly entries: ImplantEntry[] = [];
  private readonly unsubscribe: (() => void)[];
  private bossId: EntityId | null = null;

  constructor(bus: EventBus, seed?: RunHudSeed) {
    this.credits.hidden = true;
    this.credits.setAttribute('role', 'status');
    this.credits.append(
      this.creditsLabel,
      this.creditsValue,
      this.creditsDelta,
    );
    this.implants.hidden = true;
    this.implants.setAttribute('aria-label', text.implants);
    this.boss.hidden = true;
    this.bossTrack.setAttribute('role', 'progressbar');
    this.bossTrack.setAttribute('aria-label', text.bossHealth);
    this.bossFill.style.setProperty('--p', '1');
    this.bossTrack.append(this.bossFill, this.bossTicks);
    this.boss.append(this.bossName, this.bossTrack);
    this.node.append(this.credits, this.implants, this.boss);

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
      bus.on('boss_spawned', ({ id, name, maxHealth }) => {
        this.bossId = id;
        this.bossName.textContent = name;
        this.bossTrack.setAttribute('aria-valuetext', `${maxHealth}`);
        this.bossFill.style.setProperty('--p', '1');
        this.bossTicks.replaceChildren();
        delete this.boss.dataset.phase;
        this.boss.hidden = false;
      }),
      bus.on('health_changed', ({ id, current, max }) => {
        if (id !== this.bossId) return;
        const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
        this.bossFill.style.setProperty('--p', ratio.toFixed(3));
        this.bossTrack.setAttribute(
          'aria-valuetext',
          `${Math.round(current)} / ${Math.round(max)}`,
        );
      }),
      bus.on('boss_phase', ({ id, phase, phases }) => {
        if (id !== this.bossId) return;
        this.setPhaseTicks(phases);
        this.boss.dataset.phase = String(phase);
        restartAnimation(this.boss, 'run-hud__boss--phase');
      }),
      bus.on('enemy_killed', ({ id }) => this.hideBoss(id)),
      bus.on('entity_despawned', ({ id }) => this.hideBoss(id)),
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

  private setPhaseTicks(phases: number): void {
    const count = Math.max(1, Math.floor(phases));
    if (this.bossTicks.childElementCount === count - 1) return;
    this.bossTicks.replaceChildren();
    for (let i = 1; i < count; i++) {
      const tick = element('span', 'run-hud__boss-tick');
      tick.style.setProperty('--at', (i / count).toFixed(3));
      this.bossTicks.append(tick);
    }
  }

  private hideBoss(id: EntityId): void {
    if (id !== this.bossId) return;
    this.bossId = null;
    this.boss.hidden = true;
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.node.remove();
  }
}
