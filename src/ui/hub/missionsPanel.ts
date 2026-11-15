import { z } from 'zod';
import textData from '../../data/ui/missions.pl.json';
import { threatLevels } from '../../progression/threatSchema';
import type { ThreatLevel } from '../../progression/threatSchema';
import type { HubPanel, HubPanelFactory } from './hubPanel';
import './missionsPanel.css';

const text = z
  .object({
    sector: z.object({ name: z.string(), description: z.string() }),
    threat: z.object({
      heading: z.string(),
      level: z.string(),
      recommended: z.string(),
      locked: z.string(),
      modifiers: z.string(),
      baseline: z.string(),
      reward: z.string(),
      baseReward: z.string(),
      victoryCores: z.object({
        one: z.string(),
        few: z.string(),
        many: z.string(),
      }),
      saveError: z.string(),
    }),
    seed: z.object({ label: z.string(), placeholder: z.string() }),
    start: z.string(),
  })
  .parse(textData.missions);

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

const percent = (fraction: number): number => Math.round(fraction * 100);

function coresText(count: number): string {
  const forms = text.threat.victoryCores;
  const last = count % 10;
  const form =
    count === 1
      ? forms.one
      : last >= 2 && last <= 4 && (count % 100 < 12 || count % 100 > 14)
        ? forms.few
        : forms.many;
  return fill(form, { count });
}

/** Seed runu z kryjówki: czysto interfejsowy (symulacja dostaje go przez URL), więc nie przechodzi przez `Rng`. */
function randomSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) =>
    value.toString(16),
  ).join('-');
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function detailLines(level: ThreatLevel): string[] {
  const neutral =
    level.enemyHealth === 0 &&
    level.enemyDamage === 0 &&
    level.budgetMult === 1;
  const lines = [
    neutral
      ? text.threat.baseline
      : fill(text.threat.modifiers, {
          health: percent(level.enemyHealth),
          damage: percent(level.enemyDamage),
          budget: percent(level.budgetMult - 1),
        }),
    level.rewardMult === 1
      ? text.threat.baseReward
      : fill(text.threat.reward, { percent: percent(level.rewardMult - 1) }),
  ];
  if (level.victoryCores > 0) lines.push(coresText(level.victoryCores));
  return lines;
}

/** Tablica misji (F4-10): karta sektora, wybór Poziomu zagrożenia, opcjonalny seed i start runu z meta. */
export const createMissionsPanel: HubPanelFactory = (ctx): HubPanel => {
  const { manager } = ctx;
  const root = el('div', 'missions-panel');
  root.dataset.panel = 'missions';

  const sector = el('section', 'missions-panel__sector');
  sector.append(
    el('h2', 'missions-panel__sector-name', text.sector.name),
    el('p', 'missions-panel__sector-text', text.sector.description),
  );

  const heading = el('h3', 'missions-panel__heading', text.threat.heading);
  const list = el('div', 'missions-panel__levels');
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', text.threat.heading);
  const details = el('ul', 'missions-panel__details');
  details.setAttribute('aria-live', 'polite');
  const status = el('p', 'missions-panel__status');
  status.setAttribute('role', 'status');

  let disposed = false;
  let busy = false;

  async function select(level: number): Promise<void> {
    const { max, selected } = manager.state.threat;
    if (busy || disposed || level > max || level === selected) return;
    busy = true;
    try {
      manager.selectThreat(level);
      await ctx.save();
      status.textContent = '';
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : text.threat.saveError;
    } finally {
      busy = false;
    }
    if (!disposed) refresh();
  }

  const buttons = threatLevels.map((level) => {
    const button = el('button', 'missions-panel__level');
    button.type = 'button';
    button.dataset.level = String(level.level);
    button.append(
      el(
        'strong',
        undefined,
        `${fill(text.threat.level, { level: level.level })} · ${level.name}`,
      ),
    );
    const note = el('span', 'missions-panel__note');
    button.append(note);
    button.addEventListener('click', () => void select(level.level));
    list.append(button);
    return { level, button, note };
  });

  const seedLabel = el('label', 'missions-panel__seed', text.seed.label);
  const seedInput = el('input');
  seedInput.type = 'text';
  seedInput.placeholder = text.seed.placeholder;
  seedInput.autocomplete = 'off';
  seedLabel.append(seedInput);

  const start = el('button', 'missions-panel__start', text.start);
  start.type = 'button';
  start.dataset.action = 'start-run';
  start.addEventListener('click', () => {
    const params = new URLSearchParams({
      scene: 'run',
      loadout: 'meta',
      seed: seedInput.value.trim() || randomSeed(),
    });
    ctx.navigate(`?${params}`);
  });

  root.append(sector, heading, list, details, status, seedLabel, start);

  function refresh(): void {
    const { max, selected } = manager.state.threat;
    for (const { level, button, note } of buttons) {
      const locked = level.level > max;
      button.setAttribute('aria-disabled', String(locked));
      button.setAttribute('aria-pressed', String(level.level === selected));
      button.dataset.state = locked
        ? 'locked'
        : level.level === selected
          ? 'selected'
          : 'available';
      note.textContent = locked
        ? fill(text.threat.locked, { level: level.level - 1 })
        : level.level === max && max > 0
          ? text.threat.recommended
          : '';
    }
    const current = threatLevels[selected];
    details.replaceChildren(
      ...(current ? detailLines(current) : []).map((line) =>
        el('li', undefined, line),
      ),
    );
  }

  refresh();
  return {
    root,
    refresh,
    dispose(): void {
      disposed = true;
      root.remove();
    },
  };
};
