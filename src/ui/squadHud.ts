import type { AllyOrder, AllySnapshot } from '../allies/ally';
import type { EventBus } from '../core/events';
import text from '../data/ui/allies.pl.json';
import { setInputHint } from './inputGlyphs';
import './squadHud.css';

interface Row {
  root: HTMLLIElement;
  status: HTMLSpanElement;
  hp: HTMLElement;
  bark: HTMLParagraphElement;
  barkUntilMs: number;
}

export interface SquadRevivePrompt {
  name: string;
  progress: number;
}

/**
 * Portrety drużyny przy lewej krawędzi (DOM nad canvasem): zdrowie, stan, rozkaz, dymki kwestii
 * (`ally_bark`) i podpowiedź podnoszenia powalonego.
 */
export class SquadHud {
  private readonly root = document.createElement('section');
  private readonly order = document.createElement('p');
  private readonly list = document.createElement('ul');
  private readonly revive = document.createElement('p');
  private readonly reviveLabel = document.createElement('span');
  private readonly reviveFill = document.createElement('i');
  private readonly rows = new Map<string, Row>();
  private readonly off: () => void;

  constructor(
    bus: EventBus,
    private readonly barkShowS: () => number,
  ) {
    this.root.className = 'squad-hud';
    this.root.setAttribute('aria-label', text.title);
    this.root.hidden = true;
    this.order.className = 'squad-hud__order';
    this.list.className = 'squad-hud__list';
    this.revive.className = 'squad-hud__revive';
    this.revive.setAttribute('role', 'status');
    this.revive.hidden = true;
    const track = document.createElement('span');
    track.className = 'squad-hud__revive-track';
    track.append(this.reviveFill);
    this.revive.append(this.reviveLabel, track);
    this.root.append(this.order, this.list, this.revive);
    document.body.append(this.root);
    this.off = bus.on('ally_bark', ({ ally, text: line }) => {
      const row = this.rows.get(ally);
      if (!row) return;
      row.bark.textContent = line;
      row.bark.hidden = false;
      row.barkUntilMs = performance.now() + this.barkShowS() * 1000;
    });
  }

  update(
    allies: readonly AllySnapshot[],
    order: AllyOrder,
    revive: SquadRevivePrompt | null,
  ): void {
    this.root.hidden = allies.length === 0;
    if (this.root.hidden) return;
    setInputHint(
      this.order,
      `${text.title}: ${text.orders[order]} [{squadCommand}]`,
    );
    const now = performance.now();
    const seen = new Set<string>();
    for (const ally of allies) {
      seen.add(ally.id);
      const row = this.rows.get(ally.id) ?? this.createRow(ally);
      const state = ally.evacuated ? 'evacuated' : ally.state;
      if (row.root.dataset.state !== state) {
        row.root.dataset.state = state;
        row.status.textContent = text.states[state];
      }
      const width = `${Math.round((ally.maxHp > 0 ? ally.hp / ally.maxHp : 0) * 100)}%`;
      if (row.hp.style.width !== width) row.hp.style.width = width;
      if (!row.bark.hidden && now >= row.barkUntilMs) row.bark.hidden = true;
    }
    for (const [id, row] of this.rows)
      if (!seen.has(id)) {
        row.root.remove();
        this.rows.delete(id);
      }
    this.revive.hidden = revive === null;
    if (revive) {
      setInputHint(
        this.reviveLabel,
        text.revive
          .replace('{key}', '[{power2}]')
          .replace('{name}', revive.name),
      );
      this.reviveFill.style.width = `${Math.round(revive.progress * 100)}%`;
    }
  }

  dispose(): void {
    this.off();
    this.root.remove();
  }

  private createRow(ally: AllySnapshot): Row {
    const root = document.createElement('li');
    root.className = 'squad-hud__member';
    root.dataset.ally = ally.id;
    const portrait = document.createElement('span');
    portrait.className = 'squad-hud__portrait';
    portrait.setAttribute('aria-hidden', 'true');
    portrait.textContent = ally.name.charAt(0);
    const body = document.createElement('div');
    const name = document.createElement('span');
    name.className = 'squad-hud__name';
    const status = document.createElement('span');
    status.className = 'squad-hud__status';
    name.append(ally.name, status);
    const track = document.createElement('span');
    track.className = 'squad-hud__hp';
    track.setAttribute('aria-label', text.hp);
    const hp = document.createElement('i');
    track.append(hp);
    body.append(name, track);
    const bark = document.createElement('p');
    bark.className = 'squad-hud__bark';
    bark.hidden = true;
    root.append(portrait, body, bark);
    this.list.append(root);
    const row: Row = { root, status, hp, bark, barkUntilMs: 0 };
    this.rows.set(ally.id, row);
    return row;
  }
}
