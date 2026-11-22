import type { LoadoutChoice } from '../../core/metaTypes';
import type { HubPanel, HubPanelContext, HubPanelFactory } from './hubPanel';
import {
  SHOP_TABS,
  equipmentState,
  groupRows,
  nextLoadout,
  itemName,
  nextModuleLoadout,
  shopCard,
  shopPreview,
  shopRows,
  splitId,
  toggleModuleLoadout,
  unlockRows,
  workshopText as text,
} from './workshopState';
import type {
  ChoiceOption,
  LoadoutPart,
  ShopBlock,
  ShopCard,
  ShopPreview,
  ShopRow,
  ShopTab,
  UnlockRow,
} from './workshopState';
import { achievementText } from '../achievementText';
import { createLockIcon } from '../achievementIcons';
import {
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  WeaponPreview,
  canCreateWeaponPreview,
} from '../../render/weaponPreview';
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
  let extractionNeedsSave = false;
  let wantedPreview: string | undefined;
  let shownPreview = '';
  let tab: ShopTab = 'weapon';
  /** Wybrany przedmiot każdej zakładki (id odblokowania); brak = pozycja domyślna. */
  const selected: Partial<Record<ShopTab, string>> = {};

  // Kontener podglądu żyje między odświeżeniami (canvas i kontekst WebGL powstają raz).
  const previewBox = el('div', 'workshop__preview');
  previewBox.dataset.testid = 'weapon-preview';
  const previewCanvas = el('canvas', 'workshop__preview-canvas');
  previewCanvas.width = PREVIEW_WIDTH;
  previewCanvas.height = PREVIEW_HEIGHT;
  previewCanvas.setAttribute('role', 'img');
  previewCanvas.setAttribute('aria-label', text.preview.title);
  const previewNote = el(
    'p',
    'workshop__preview-note',
    text.preview.unavailable,
  );
  previewNote.hidden = true;
  previewBox.append(previewCanvas, previewNote);
  let preview: WeaponPreview | null = null;
  if (canCreateWeaponPreview()) {
    try {
      preview = new WeaponPreview(previewCanvas);
    } catch {
      preview = null;
    }
  }
  previewCanvas.hidden = preview === null;
  previewNote.hidden = preview !== null;

  const message = (error: unknown): string =>
    error instanceof Error ? error.message : text.errors.generic;

  /** Wykonuje zmianę meta, zapisuje i odświeża; błąd trafia do linii statusu. */
  const run = async (change: () => void): Promise<void> => {
    if (disposed) return;
    if (busy) {
      refresh();
      return;
    }
    busy = true;
    try {
      change();
      await ctx.save();
      status = extractionNeedsSave ? text.extraction.saved : '';
      extractionNeedsSave = false;
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

  const renderExtractions = (): HTMLElement[] => {
    const offers = ctx.manager.state.pendingExtractions;
    if (!offers.length && !extractionNeedsSave) return [];
    const section = el('section', 'workshop__section');
    section.dataset.section = 'extraction';
    section.append(el('h2', undefined, text.extraction.title));
    for (const { runId, moduleIds } of offers) {
      const seed = runId.slice(0, runId.lastIndexOf(':'));
      section.append(
        el('p', undefined, fill(text.extraction.choose, { seed })),
      );
      for (const id of moduleIds) {
        const button = el(
          'button',
          'workshop__buy',
          fill(text.extraction.claim, { name: itemName('module', id) }),
        );
        button.type = 'button';
        button.disabled = busy;
        button.dataset.key = `extract:${runId}:${id}`;
        button.addEventListener(
          'click',
          () =>
            void run(() => {
              ctx.manager.extractModule(runId, id);
              extractionNeedsSave = true;
            }),
        );
        section.append(button);
      }
    }
    if (extractionNeedsSave && !busy) {
      const retry = el('button', 'workshop__buy', text.extraction.retry);
      retry.type = 'button';
      retry.addEventListener('click', () => void run(() => {}));
      section.append(retry);
    }
    return [section];
  };

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

  /** Powód, dla którego przedmiotu nie da się kupić; `null` dla posiadanych i dostępnych. */
  const purchaseLabel = (row: UnlockRow): string | null => {
    switch (row.status) {
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
      case 'owned':
      case 'buyable':
        return null;
    }
  };

  /** Wiersz listy: nazwa, cena, stan i przycisk zakupu (wspólny dla sklepu i odblokowań). */
  const renderRow = (row: UnlockRow, ownedLabel: string): HTMLLIElement => {
    const item = el('li', 'workshop__row');
    item.dataset.unlock = row.id;
    item.dataset.status = row.status;
    item.append(el('span', 'workshop__name', row.name));
    if (row.status !== 'owned')
      item.append(el('span', 'workshop__cost', costLabel(row)));
    const label = row.status === 'owned' ? ownedLabel : purchaseLabel(row);
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
    return item;
  };

  const select = (id: string): void => {
    const { kind, key } = splitId(id);
    if (kind !== 'weapon' && kind !== 'module') return;
    tab = kind;
    selected[kind] = id;
    if (kind === 'weapon' && ctx.manager.state.loadout.weapons.includes(key))
      wantedPreview = key;
    refresh();
  };

  /** Wiersz sklepu: cały wiersz wybiera przedmiot do karty i podglądu. */
  const renderShopRow = (row: ShopRow, current: boolean): HTMLLIElement => {
    const item = renderRow(
      row,
      row.equipped
        ? row.kind === 'weapon'
          ? text.shop.state.inLoadout
          : text.shop.state.equipped
        : text.unlocks.owned,
    );
    item.classList.add('workshop__item');
    item.dataset.equipped = String(row.equipped);
    item.dataset.key = `row:${row.id}`;
    item.tabIndex = 0;
    if (current) item.setAttribute('aria-current', 'true');
    item.addEventListener('click', () => select(row.id));
    item.addEventListener('keydown', (event) => {
      if (event.target !== item) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      select(row.id);
    });
    return item;
  };

  const renderCatalog = (
    rows: Record<ShopTab, ShopRow[]>,
    current: string | undefined,
  ): HTMLElement => {
    const catalog = el('div', 'workshop__catalog');
    for (const kind of SHOP_TABS) {
      const pane = el('div', 'workshop__pane');
      pane.dataset.pane = kind;
      pane.id = `workshop-pane-${kind}`;
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-label', text.shop.listLabel[kind]);
      pane.hidden = kind !== tab;
      let list: HTMLUListElement | null = null;
      let slot: string | undefined;
      for (const row of rows[kind]) {
        if (!list || row.slot !== slot) {
          slot = row.slot;
          if (row.slot)
            pane.append(
              el('h3', undefined, text.equipment.moduleSlots[row.slot]),
            );
          list = el('ul', 'workshop__list');
          pane.append(list);
        }
        list.append(renderShopRow(row, kind === tab && row.id === current));
      }
      catalog.append(pane);
    }
    return catalog;
  };

  const renderTabs = (): HTMLElement => {
    const tabs = el('div', 'workshop__tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', text.shop.tabsLabel);
    for (const kind of SHOP_TABS) {
      const button = el('button', 'workshop__tab', text.shop.tabs[kind]);
      button.type = 'button';
      button.dataset.action = 'tab';
      button.dataset.tab = kind;
      button.dataset.key = `tab:${kind}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(kind === tab));
      button.setAttribute('aria-controls', `workshop-pane-${kind}`);
      button.addEventListener('click', () => {
        tab = kind;
        refresh();
      });
      tabs.append(button);
    }
    return tabs;
  };

  /** Podgląd 3D: przełącznik broni z ekwipunku, trwały canvas i gniazda dodatków. */
  const renderPreview = (shown: ShopPreview | null): HTMLElement => {
    const block = el('div', 'workshop__preview-block');
    block.dataset.group = 'preview';
    block.append(el('h3', undefined, text.preview.title));
    const weapons = ctx.manager.state.loadout.weapons;
    if (weapons.length > 1) {
      const switcher = el('div', 'workshop__preview-switch');
      switcher.setAttribute('role', 'group');
      switcher.setAttribute('aria-label', text.preview.switchLabel);
      for (const id of weapons) {
        const button = el('button', 'workshop__choice', itemName('weapon', id));
        button.type = 'button';
        button.dataset.action = 'preview';
        button.dataset.item = id;
        button.dataset.key = `preview:${id}`;
        button.setAttribute('aria-pressed', String(id === shown?.weaponId));
        button.addEventListener('click', () => {
          wantedPreview = id;
          if (tab === 'weapon') selected.weapon = `weapon:${id}`;
          refresh();
        });
        switcher.append(button);
      }
      block.append(switcher);
    }
    previewBox.hidden = shown === null;
    if (shown) {
      previewBox.dataset.weapon = shown.weaponId;
      previewBox.dataset.modules = shown.moduleIds.join(',');
      previewBox.dataset.tryOn = shown.tryOn ?? '';
      previewBox.dataset.highlight = shown.highlight ?? '';
      const key = `${shown.weaponId}|${shown.moduleIds.join(',')}`;
      if (preview && key !== shownPreview) {
        shownPreview = key;
        preview.show(shown.weaponId, shown.moduleIds).catch(() => {});
      }
      preview?.highlight(shown.highlight);
    }
    block.append(previewBox);
    if (shown?.tryOn)
      block.append(
        el(
          'p',
          'workshop__try-on',
          fill(text.shop.tryOn, { name: itemName('module', shown.tryOn) }),
        ),
      );
    if (shown && shown.slots.length > 0) {
      const slots = el('div', 'workshop__slots');
      slots.setAttribute('role', 'group');
      slots.setAttribute(
        'aria-label',
        fill(text.shop.slotsLabel, {
          weapon: itemName('weapon', shown.weaponId),
        }),
      );
      for (const slot of shown.slots) {
        const button = el('button', 'workshop__slot');
        button.type = 'button';
        button.dataset.action = 'slot';
        button.dataset.slot = slot.slot;
        button.dataset.module = slot.moduleId ?? '';
        button.dataset.key = `slot:${slot.slot}`;
        button.setAttribute(
          'aria-pressed',
          String(shown.highlight === slot.slot),
        );
        button.append(
          el(
            'span',
            'workshop__slot-label',
            text.equipment.moduleSlots[slot.slot],
          ),
          el(
            'span',
            slot.name ? 'workshop__slot-name' : 'workshop__slot-name is-empty',
            slot.name ?? text.shop.emptySlot,
          ),
        );
        button.addEventListener('click', () => {
          const rows = shopRows(ctx.manager, 'module', shown.weaponId);
          const pick =
            rows.find((row) => row.key === slot.moduleId) ??
            rows.find((row) => row.slot === slot.slot);
          if (pick) select(pick.id);
        });
        slots.append(button);
      }
      block.append(slots);
    }
    return block;
  };

  const blockedLabel = (card: ShopCard, block: ShopBlock): string => {
    switch (block) {
      case 'achievement':
      case 'level':
      case 'data':
      case 'cores':
        return purchaseLabel(card.row) ?? '';
      case 'slots':
        return fill(text.shop.blocked.slots, {
          n: ctx.manager.moduleSlotsPerWeapon,
        });
      case 'unfit':
      case 'full':
      case 'last':
      case 'noWeapon':
        return fill(text.shop.blocked[block], {
          weapon: card.weaponId ? itemName('weapon', card.weaponId) : '',
        });
    }
  };

  const cardAction = (card: ShopCard): void => {
    const { row } = card;
    if (card.action === 'buy') {
      void buy(row.id);
      return;
    }
    if (row.kind === 'weapon') {
      const choice = nextLoadout(ctx.manager, 'weapons', row.key);
      if (choice) void setChoice(choice);
      return;
    }
    const weaponId = card.weaponId;
    if (!weaponId) return;
    void run(() =>
      ctx.manager.setLoadout(
        toggleModuleLoadout(
          ctx.manager,
          weaponId,
          row.key,
          card.action === 'equip',
        ),
      ),
    );
  };

  /** Karta wybranego przedmiotu: stan, opis, statystyki przed/po i główna akcja. */
  const renderCard = (card: ShopCard): HTMLElement => {
    const { row } = card;
    const node = el('article', 'workshop__card');
    node.dataset.card = row.id;
    node.dataset.status = row.status;
    node.dataset.equipped = String(row.equipped);
    const head = el('div', 'workshop__card-head');
    head.append(el('h3', 'workshop__card-name', row.name));
    head.append(
      el(
        'span',
        'workshop__card-kind',
        row.slot
          ? `${text.shop.slot}: ${text.equipment.moduleSlots[row.slot]}`
          : text.shop.tabs.weapon,
      ),
    );
    node.append(head);
    if (card.description)
      node.append(el('p', 'workshop__card-text', card.description));
    if (card.fits.length > 0)
      node.append(
        el(
          'p',
          'workshop__card-note',
          fill(text.shop.fits, { weapons: card.fits.join(', ') }),
        ),
      );

    const weaponName = card.weaponId ? itemName('weapon', card.weaponId) : '';
    if (card.lines.length > 0) {
      const compared = card.lines.some((line) => line.before !== null);
      const table = el('table', 'workshop__stats');
      table.append(
        el(
          'caption',
          undefined,
          row.kind === 'module'
            ? fill(text.shop.compareModule, { weapon: weaponName })
            : card.baseline
              ? fill(text.shop.compareWeapon, { baseline: card.baseline })
              : text.shop.statsOnly,
        ),
      );
      if (compared) {
        const header = el('tr');
        // Bronie porównujemy nazwami, dodatek — stanem przed i po założeniu.
        for (const column of [
          text.shop.columns.stat,
          card.baseline ?? text.shop.columns.before,
          card.baseline ? row.name : text.shop.columns.after,
        ]) {
          const cell = el('th', undefined, column);
          cell.scope = 'col';
          header.append(cell);
        }
        const thead = el('thead');
        thead.append(header);
        table.append(thead);
      }
      const body = el('tbody');
      for (const line of card.lines) {
        const tr = el('tr');
        tr.dataset.stat = line.key;
        tr.dataset.trend = line.trend;
        const label = el('th', undefined, line.label);
        label.scope = 'row';
        tr.append(label);
        if (compared)
          tr.append(el('td', 'workshop__stats-before', line.before ?? ''));
        const after = el('td', 'workshop__stats-after', line.after);
        if (line.trend !== 'same')
          after.append(
            el('span', 'workshop__trend', text.shop.trend[line.trend]),
          );
        tr.append(after);
        body.append(tr);
      }
      table.append(body);
      node.append(table);
      if (
        row.kind === 'module' &&
        card.lines.every((line) => line.trend === 'same')
      )
        node.append(el('p', 'workshop__card-note', text.shop.noChange));
    }

    const foot = el('div', 'workshop__card-foot');
    const state = el('span', 'workshop__card-state');
    state.dataset.state =
      row.status !== 'owned'
        ? card.blocked
          ? 'locked'
          : 'available'
        : row.equipped
          ? 'equipped'
          : 'owned';
    state.textContent =
      row.status !== 'owned'
        ? `${text.shop.price}: ${costLabel(row)}`
        : row.equipped
          ? row.kind === 'weapon'
            ? text.shop.state.inLoadout
            : text.shop.state.equipped
          : text.shop.state.owned;
    foot.append(state);
    const labels = {
      buy: text.unlocks.buy,
      equip: row.kind === 'weapon' ? text.shop.equipWeapon : text.shop.equip,
      unequip:
        row.kind === 'weapon' ? text.shop.unequipWeapon : text.shop.unequip,
    };
    const button = el('button', 'workshop__action', labels[card.action]);
    button.type = 'button';
    button.dataset.action = 'card';
    button.dataset.cardAction = card.action;
    button.dataset.key = `card:${row.id}`;
    button.disabled = busy || card.blocked !== null;
    button.addEventListener('click', () => cardAction(card));
    foot.append(button);
    node.append(foot);
    if (card.blocked) {
      const reason = el(
        'p',
        'workshop__card-blocked',
        blockedLabel(card, card.blocked),
      );
      reason.dataset.blocked = card.blocked;
      if (card.blocked === 'achievement') reason.prepend(createLockIcon());
      node.append(reason);
    } else if (row.kind === 'module' && row.status === 'owned' && weaponName)
      node.append(
        el(
          'p',
          'workshop__card-note',
          fill(text.shop.target, { weapon: weaponName }),
        ),
      );
    return node;
  };

  const renderShop = (): HTMLElement => {
    const section = el('section', 'workshop__section');
    section.dataset.section = 'shop';
    section.append(el('h2', undefined, text.shop.title), renderTabs());
    const manager = ctx.manager;
    const fallback: Record<ShopTab, string | undefined> = {
      weapon:
        manager.state.loadout.weapons[0] === undefined
          ? undefined
          : `weapon:${manager.state.loadout.weapons[0]}`,
      module: undefined,
    };
    const weaponRows = shopRows(manager, 'weapon');
    const pickWeapon = weaponRows.some((row) => row.id === selected.weapon)
      ? selected.weapon
      : (fallback.weapon ?? weaponRows[0]?.id);
    // Na zakładce dodatków podgląd pokazuje broń z ekwipunku, a wybrany dodatek jest przymierzany.
    const target = shopPreview(manager, undefined, wantedPreview);
    const moduleRows = shopRows(manager, 'module', target?.weaponId);
    const pickModule = moduleRows.some((row) => row.id === selected.module)
      ? selected.module
      : moduleRows[0]?.id;
    const current = tab === 'weapon' ? pickWeapon : pickModule;
    const shown = shopPreview(manager, current, wantedPreview);
    const card = current ? shopCard(manager, current, shown?.weaponId) : null;

    const layout = el('div', 'workshop__shop');
    const stage = el('div', 'workshop__stage');
    stage.append(renderPreview(shown));
    if (card) stage.append(renderCard(card));
    layout.append(
      renderCatalog({ weapon: weaponRows, module: moduleRows }, current),
      stage,
    );
    section.append(layout);
    return section;
  };

  const renderUnlocks = (): HTMLElement | null => {
    const groups = groupRows(unlockRows(ctx.manager)).filter(
      (group) => group.kind !== 'weapon' && group.kind !== 'module',
    );
    if (groups.length === 0) return null;
    const section = el('section', 'workshop__section');
    section.dataset.section = 'unlocks';
    section.append(el('h2', undefined, text.unlocks.title));
    for (const group of groups) {
      section.append(el('h3', undefined, text.unlocks.groups[group.kind]));
      const list = el('ul', 'workshop__list');
      for (const row of group.rows)
        list.append(renderRow(row, text.unlocks.owned));
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

    const weapons = renderChoices(
      'weapons',
      text.equipment.weapons,
      equipment.weapons.options,
      equipment.weapons.used,
      equipment.weapons.slots,
    );
    section.append(
      blades,
      weapons,
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
          el('span', undefined, text.equipment.moduleSlots[slot.slot]),
        );
        const field = el('select', 'workshop__module-select');
        field.dataset.weapon = weapon.weaponId;
        field.dataset.slot = String(index);
        field.dataset.key = `module:${weapon.weaponId}:${index}`;
        const empty = el('option', undefined, text.equipment.emptyModule);
        empty.value = '';
        field.append(empty);
        for (const option of slot.options) {
          const node = el('option', undefined, option.name);
          node.value = option.id;
          node.title = option.description;
          field.append(node);
        }
        field.value = slot.selected;
        field.disabled = slot.blocked;
        const hint = slot.blocked
          ? fill(text.equipment.slotLimitHint, {
              n: ctx.manager.moduleSlotsPerWeapon,
            })
          : (slot.options.find((option) => option.id === slot.selected)
              ?.description ?? '');
        field.title = hint;
        field.addEventListener('change', () => {
          void run(() =>
            ctx.manager.setLoadout(
              nextModuleLoadout(
                ctx.manager,
                weapon.weaponId,
                index,
                field.value,
              ),
            ),
          );
        });
        label.append(field);
        const description = el('span', 'workshop__module-description', hint);
        description.id = `module-description-${weapon.weaponId}-${slot.slot}`;
        field.setAttribute('aria-describedby', description.id);
        label.append(description);
        group.append(label);
      });
      weapons.append(group);
    }
    return section;
  };

  function refresh(): void {
    if (disposed) return;
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset
      ?.key;
    const hadFocus = root.contains(document.activeElement);
    const statusLine = el('p', 'workshop__status', status);
    statusLine.setAttribute('role', 'status');
    const unlocks = renderUnlocks();
    root.replaceChildren(
      renderHeader(),
      ...renderExtractions(),
      renderShop(),
      statusLine,
      renderEquipment(),
      ...(unlocks ? [unlocks] : []),
    );
    if (focusKey && root.isConnected) {
      const target = [...root.querySelectorAll<HTMLElement>('[data-key]')].find(
        (node) => node.dataset.key === focusKey,
      );
      (
        target ??
        (hadFocus
          ? root.querySelector<HTMLElement>('button:not(:disabled)')
          : null)
      )?.focus();
    }
  }

  refresh();
  return {
    root,
    refresh,
    dispose() {
      disposed = true;
      preview?.dispose();
      preview = null;
      root.replaceChildren();
    },
  };
};
