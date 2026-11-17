import type { LoadoutChoice } from '../../core/metaTypes';
import type { HubPanel, HubPanelContext, HubPanelFactory } from './hubPanel';
import {
  equipmentState,
  groupRows,
  nextLoadout,
  nextModuleLoadout,
  unlockRows,
  workshopText as text,
} from './workshopState';
import type { ChoiceOption, LoadoutPart, UnlockRow } from './workshopState';
import { achievementText } from '../achievementText';
import { createLockIcon } from '../achievementIcons';
import './workshopPanel.css';

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

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

function costLabel(row: UnlockRow): string {
  const parts: string[] = [];
  if (row.cost.data > 0) parts.push(`${row.cost.data} ${text.currency.data}`);
  if (row.cost.cores > 0)
    parts.push(`${row.cost.cores} ${text.currency.cores}`);
  return parts.join(' + ');
}

export const createWorkshopPanel: HubPanelFactory = (
  ctx: HubPanelContext,
): HubPanel => {
  const root = el('div', 'workshop');
  root.dataset.panel = 'workshop';
  let status = '';
  let disposed = false;
  let busy = false;

  const message = (error: unknown): string =>
    error instanceof Error ? error.message : text.errors.generic;

  /** Wykonuje zmianę meta, zapisuje i odświeża; błąd trafia do linii statusu. */
  const run = async (change: () => void): Promise<void> => {
    if (busy || disposed) return;
    busy = true;
    try {
      change();
      await ctx.save();
      status = '';
    } catch (error) {
      status = message(error);
    } finally {
      busy = false;
    }
    if (!disposed) refresh();
  };

  const buy = (id: string): Promise<void> =>
    run(() => ctx.manager.buyUnlock(id));

  const setChoice = (choice: LoadoutChoice): Promise<void> =>
    run(() => ctx.manager.setLoadout(choice));

  const renderHeader = (): HTMLElement => {
    const { data, cores } = ctx.manager.state;
    const header = el('div', 'workshop__header');
    const stat = (label: string, value: number, key: string) => {
      const item = el('span', 'workshop__stat');
      item.dataset.stat = key;
      item.append(el('span', 'workshop__stat-label', label));
      item.append(el('strong', undefined, String(value)));
      return item;
    };
    header.append(
      stat(text.header.data, data, 'data'),
      stat(text.header.cores, cores, 'cores'),
      stat(text.header.level, ctx.manager.level, 'level'),
    );
    return header;
  };

  const statusLabel = (row: UnlockRow): string | null => {
    switch (row.status) {
      case 'owned':
        return text.unlocks.owned;
      case 'achievement':
        return fill(achievementText.workshop.requires, {
          title: row.requires?.title ?? '',
        });
      case 'level':
        return fill(text.unlocks.requiredLevel, { level: row.minLevel ?? 1 });
      case 'data':
        return text.unlocks.notEnough.data;
      case 'cores':
        return text.unlocks.notEnough.cores;
      case 'buyable':
        return null;
    }
  };

  const renderUnlocks = (): HTMLElement => {
    const section = el('section', 'workshop__section');
    section.dataset.section = 'unlocks';
    section.append(el('h2', undefined, text.unlocks.title));
    for (const group of groupRows(unlockRows(ctx.manager))) {
      section.append(el('h3', undefined, text.unlocks.groups[group.kind]));
      const list = el('ul', 'workshop__list');
      for (const row of group.rows) {
        const item = el('li', 'workshop__row');
        item.dataset.unlock = row.id;
        item.dataset.status = row.status;
        item.append(el('span', 'workshop__name', row.name));
        if (row.status !== 'owned')
          item.append(el('span', 'workshop__cost', costLabel(row)));
        const label = statusLabel(row);
        if (label !== null) {
          const state = el(
            'span',
            row.status === 'owned'
              ? 'workshop__state'
              : 'workshop__state is-blocked',
            label,
          );
          if (row.status === 'achievement') {
            state.classList.add('is-locked');
            state.dataset.lock = row.requires?.id ?? '';
            state.prepend(createLockIcon());
          }
          item.append(state);
        }
        if (row.status !== 'owned') {
          const button = el('button', 'workshop__buy', text.unlocks.buy);
          button.type = 'button';
          button.dataset.action = 'buy';
          button.dataset.key = `buy:${row.id}`;
          button.disabled = row.status !== 'buyable';
          button.addEventListener('click', () => void buy(row.id));
          item.append(button);
        }
        list.append(item);
      }
      section.append(list);
    }
    return section;
  };

  const renderChoices = (
    part: LoadoutPart,
    label: string,
    options: readonly ChoiceOption[],
    used: number,
    slots: number,
  ): HTMLElement => {
    const group = el('div', 'workshop__group');
    group.dataset.group = part;
    const counter = el(
      'h3',
      'workshop__counter',
      fill(text.equipment.counter, { label, used, slots }),
    );
    counter.dataset.counter = part;
    group.append(counter);
    const list = el('ul', 'workshop__list');
    for (const option of options) {
      const item = el('li', 'workshop__row');
      const button = el('button', 'workshop__choice', option.name);
      button.type = 'button';
      button.dataset.action = 'toggle';
      button.dataset.part = part;
      button.dataset.item = option.key;
      button.dataset.key = `${part}:${option.key}`;
      button.setAttribute('aria-pressed', String(option.selected));
      if (option.blocked) {
        button.disabled = true;
        button.title =
          option.blocked === 'full'
            ? text.equipment.fullHint
            : text.equipment.lastHint;
      }
      button.addEventListener('click', () => {
        const choice = nextLoadout(ctx.manager, part, option.key);
        if (choice) void setChoice(choice);
      });
      item.append(button);
      if (option.order !== null)
        item.append(
          el(
            'span',
            'workshop__order',
            fill(text.equipment.slotOrder, { n: option.order }),
          ),
        );
      list.append(item);
    }
    group.append(list);
    return group;
  };

  const renderEquipment = (): HTMLElement => {
    const equipment = equipmentState(ctx.manager);
    const section = el('section', 'workshop__section');
    section.dataset.section = 'equipment';
    section.append(el('h2', undefined, text.equipment.title));

    const blades = el('div', 'workshop__group');
    blades.dataset.group = 'blade';
    blades.append(el('h3', undefined, text.equipment.blade));
    const bladeList = el('ul', 'workshop__list');
    for (const blade of equipment.blades) {
      const item = el('li', 'workshop__row');
      const button = el('button', 'workshop__choice', blade.name);
      button.type = 'button';
      button.dataset.action = 'blade';
      button.dataset.item = blade.key;
      button.dataset.key = `blade:${blade.key}`;
      button.setAttribute('aria-pressed', String(blade.selected));
      button.addEventListener('click', () => {
        if (blade.selected) return;
        void setChoice({ ...ctx.manager.state.loadout, blade: blade.key });
      });
      item.append(button);
      bladeList.append(item);
    }
    blades.append(bladeList);

    section.append(
      blades,
      renderChoices(
        'weapons',
        text.equipment.weapons,
        equipment.weapons.options,
        equipment.weapons.used,
        equipment.weapons.slots,
      ),
      renderChoices(
        'powers',
        text.equipment.powers,
        equipment.powers.options,
        equipment.powers.used,
        equipment.powers.slots,
      ),
    );
    for (const weapon of equipment.modules) {
      const group = el('div', 'workshop__modules');
      group.dataset.moduleWeapon = weapon.weaponId;
      group.append(el('h3', undefined, weapon.weaponName));
      weapon.slots.forEach((slot, index) => {
        const label = el('label', 'workshop__module-slot');
        label.append(
          el(
            'span',
            undefined,
            fill(text.equipment.moduleSlot, { n: index + 1 }),
          ),
        );
        const select = el('select', 'workshop__module-select');
        select.dataset.weapon = weapon.weaponId;
        select.dataset.slot = String(index);
        select.dataset.key = `module:${weapon.weaponId}:${index}`;
        const empty = el('option', undefined, text.equipment.emptyModule);
        empty.value = '';
        select.append(empty);
        for (const option of slot.options) {
          const node = el('option', undefined, option.name);
          node.value = option.id;
          node.title = option.description;
          select.append(node);
        }
        select.value = slot.selected;
        select.title =
          slot.options.find((option) => option.id === slot.selected)
            ?.description ?? '';
        select.addEventListener('change', () => {
          void setChoice(
            nextModuleLoadout(
              ctx.manager,
              weapon.weaponId,
              index,
              select.value,
            ),
          );
        });
        label.append(select);
        group.append(label);
      });
      section.querySelector('[data-group="weapons"]')!.append(group);
    }
    return section;
  };

  function refresh(): void {
    if (disposed) return;
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset
      ?.key;
    const statusLine = el('p', 'workshop__status', status);
    statusLine.setAttribute('role', 'status');
    root.replaceChildren(
      renderHeader(),
      renderUnlocks(),
      renderEquipment(),
      statusLine,
    );
    if (focusKey && root.isConnected) {
      const target = [...root.querySelectorAll<HTMLElement>('[data-key]')].find(
        (node) => node.dataset.key === focusKey,
      );
      target?.focus();
    }
  }

  refresh();
  return {
    root,
    refresh,
    dispose() {
      disposed = true;
      root.replaceChildren();
    },
  };
};
