import type { LoadoutChoice } from '../../core/metaTypes';
import { playUiSound } from '../../audio/uiSounds';
import { bindUiFeedback } from '../components/feedback';
import { uiConfirm } from '../components/modal';
import { createTabs } from '../components/tabs';
import type { UiTabs } from '../components/tabs';
import { createSelect, uiBadge } from '../components/controls';
import { uiButton } from '../components/button';
import uiText from '../../data/ui/ui.pl.json';
import type { HubPanel, HubPanelContext, HubPanelFactory } from './hubPanel';
import {
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

type Category = ShopTab | 'equipment' | 'unlocks' | 'extraction';
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

const TREND_MARK = {
  better: '▲',
  worse: '▼',
  changed: '◆',
} as const;

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
  let tab: Category = ctx.manager.state.pendingExtractions.length
    ? 'extraction'
    : 'weapon';
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
  const run = async (
    change: () => void,
    okMessage?: string,
  ): Promise<boolean> => {
    if (disposed) return false;
    if (busy) {
      refresh();
      return false;
    }
    busy = true;
    let ok = false;
    try {
      change();
      await ctx.save();
      status = okMessage ?? (extractionNeedsSave ? text.extraction.saved : '');
      extractionNeedsSave = false;
      ok = true;
    } catch (error) {
      status = message(error);
      playUiSound('error');
    } finally {
      busy = false;
    }
    if (!disposed) refresh();
    return ok;
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

  /** Zakup z potwierdzeniem w oknie modalnym; dźwięk zakupu albo braku środków. */
  const buy = async (id: string): Promise<void> => {
    const row = unlockRows(ctx.manager).find(
      (candidate) => candidate.id === id,
    );
    if (!row || busy || disposed) return;
    if (row.status !== 'buyable') {
      status = purchaseLabel(row) ?? '';
      playUiSound('error');
      refresh();
      return;
    }
    const { data, cores } = ctx.manager.state;
    const left = [
      `${data - row.cost.data} ${text.currency.data}`,
      `${cores - row.cost.cores} ${text.currency.cores}`,
    ].join(', ');
    const confirmed = await uiConfirm({
      title: fill(text.shop.confirm.title, { name: row.name }),
      message: fill(text.shop.confirm.message, {
        cost: costLabel(row) || text.shop.priceFree,
        left,
      }),
      confirmLabel: text.shop.confirm.confirm,
      cancelLabel: text.shop.confirm.cancel,
    });
    if (!confirmed || disposed) return;
    const ok = await run(
      () => ctx.manager.buyUnlock(id),
      fill(text.shop.purchased, { name: row.name }),
    );
    if (ok) playUiSound('purchase');
  };

  const setChoice = (choice: LoadoutChoice): Promise<boolean> =>
    run(() => ctx.manager.setLoadout(choice));

  const renderExtractions = (): HTMLElement => {
    const offers = ctx.manager.state.pendingExtractions;
    const section = el('section', 'workshop__section');
    section.dataset.section = 'extraction';
    section.append(el('h2', 'ui-heading', text.extraction.title));
    for (const { runId, moduleIds } of offers) {
      const seed = runId.slice(0, runId.lastIndexOf(':'));
      section.append(
        el('p', 'workshop__note', fill(text.extraction.choose, { seed })),
      );
      const list = el('div', 'workshop__stack');
      for (const id of moduleIds) {
        const button = uiButton({
          label: fill(text.extraction.claim, { name: itemName('module', id) }),
          variant: 'primary',
          onClick: () =>
            void run(() => {
              ctx.manager.extractModule(runId, id);
              extractionNeedsSave = true;
            }),
        });
        button.disabled = busy;
        button.dataset.key = `extract:${runId}:${id}`;
        list.append(button);
      }
      section.append(list);
    }
    if (extractionNeedsSave && !busy) {
      section.append(
        uiButton({
          label: text.extraction.retry,
          onClick: () => void run(() => {}),
        }),
      );
    }
    return section;
  };

  /** Stan zasobów: Dane, Rdzenie i poziom (odczyt przy zakupach). */
  const renderStats = (): HTMLElement => {
    const { data, cores } = ctx.manager.state;
    const box = el('div', 'workshop__stats-box');
    const stat = (label: string, value: number, key: string) => {
      const item = el('span', 'workshop__stat');
      item.dataset.stat = key;
      item.append(el('span', 'workshop__stat-label', label));
      item.append(el('strong', 'ui-num', String(value)));
      return item;
    };
    box.append(
      stat(text.header.data, data, 'data'),
      stat(text.header.cores, cores, 'cores'),
      stat(text.header.level, ctx.manager.level, 'level'),
    );
    return box;
  };

  /** Tytuł wiersza z powodem blokady (poziom, środki, naszywka). */
  const renderRowMain = (row: UnlockRow): HTMLElement => {
    const main = el('div', 'workshop__row-main');
    main.append(el('span', 'ui-list-item__title workshop__name', row.name));
    const reason = row.status === 'owned' ? null : purchaseLabel(row);
    if (reason !== null) {
      const state = el('span', 'workshop__state is-blocked', reason);
      if (row.status === 'achievement') {
        state.classList.add('is-locked');
        state.dataset.lock = row.requires?.id ?? '';
        state.prepend(createLockIcon());
      }
      main.append(state);
    }
    return main;
  };

  /** Wiersz listy odblokowań z własnym przyciskiem zakupu (moce, ostrza, sloty). */
  const renderRow = (row: UnlockRow, ownedLabel: string): HTMLLIElement => {
    const item = el('li', 'workshop__row ui-list-item ui-list-item--no-icon');
    item.dataset.unlock = row.id;
    item.dataset.status = row.status;
    item.append(renderRowMain(row));
    const side = el('div', 'workshop__row-side');
    if (row.status === 'owned') side.append(uiBadge(ownedLabel, 'success'));
    else {
      side.append(el('span', 'workshop__cost ui-num', costLabel(row)));
      const button = uiButton({
        label: text.unlocks.buy,
        variant: row.status === 'buyable' ? 'primary' : 'secondary',
        sound: false,
        onClick: () => void buy(row.id),
      });
      button.dataset.action = 'buy';
      button.dataset.key = `buy:${row.id}`;
      button.setAttribute('aria-disabled', String(row.status !== 'buyable'));
      bindUiFeedback(button, row.status === 'buyable' ? false : 'error');
      side.append(button);
    }
    item.append(side);
    return item;
  };

  const select = (id: string): void => {
    const { kind, key } = splitId(id);
    if (kind !== 'weapon' && kind !== 'module') return;
    selected[kind] = id;
    if (kind === 'weapon' && ctx.manager.state.loadout.weapons.includes(key))
      wantedPreview = key;
    if (tab !== kind) tabs.select(kind);
    else refresh();
  };

  /** Wiersz sklepu: cały wiersz wybiera przedmiot do karty i podglądu. */
  const renderShopRow = (row: ShopRow, current: boolean): HTMLLIElement => {
    const item = el(
      'li',
      'workshop__row workshop__item ui-list-item ui-list-item--no-icon ui-interactive',
    );
    item.dataset.unlock = row.id;
    item.dataset.status = row.status;
    item.dataset.equipped = String(row.equipped);
    item.dataset.key = `row:${row.id}`;
    item.tabIndex = 0;
    if (current) item.setAttribute('aria-current', 'true');
    item.append(renderRowMain(row));
    const side = el('div', 'workshop__row-side');
    if (row.status === 'owned')
      side.append(
        uiBadge(
          row.equipped
            ? row.kind === 'weapon'
              ? text.shop.state.inLoadout
              : text.shop.state.equipped
            : text.unlocks.owned,
          row.equipped ? 'accent' : 'success',
        ),
      );
    else side.append(el('span', 'workshop__cost ui-num', costLabel(row)));
    item.append(side);
    item.addEventListener('click', () => select(row.id));
    item.addEventListener('keydown', (event) => {
      if (event.target !== item) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      select(row.id);
    });
    bindUiFeedback(item, 'confirm');
    return item;
  };

  const renderCatalog = (
    kind: ShopTab,
    rows: ShopRow[],
    current: string | undefined,
  ): HTMLElement => {
    const pane = el('div', 'workshop__pane ui-scroll');
    pane.dataset.pane = kind;
    pane.id = `workshop-pane-${kind}`;
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-label', text.shop.listLabel[kind]);
    pane.hidden = kind !== tab;
    let list: HTMLUListElement | null = null;
    let slot: string | undefined;
    for (const row of rows) {
      if (!list || row.slot !== slot) {
        slot = row.slot;
        if (row.slot)
          pane.append(
            el(
              'h3',
              'ui-heading workshop__group-title',
              text.equipment.moduleSlots[row.slot],
            ),
          );
        list = el('ul', 'workshop__list ui-list');
        pane.append(list);
      }
      list.append(renderShopRow(row, kind === tab && row.id === current));
    }
    return pane;
  };

  /** Podgląd 3D: przełącznik broni z ekwipunku, trwały canvas i gniazda dodatków. */
  const renderPreview = (shown: ShopPreview | null): HTMLElement => {
    const block = el('div', 'workshop__preview-block');
    block.dataset.group = 'preview';
    const weapons = ctx.manager.state.loadout.weapons;
    if (weapons.length > 1) {
      const switcher = el('div', 'workshop__preview-switch');
      switcher.setAttribute('role', 'group');
      switcher.setAttribute('aria-label', text.preview.switchLabel);
      for (const id of weapons) {
        const button = el(
          'button',
          'workshop__choice workshop__chip ui-interactive',
          itemName('weapon', id),
        );
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
        bindUiFeedback(button, 'tab');
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
        const button = el('button', 'workshop__slot ui-interactive');
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
        bindUiFeedback(button, 'tab');
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
    if (card.blocked) {
      status = blockedLabel(card, card.blocked);
      playUiSound('error');
      refresh();
      return;
    }
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

  /** Karta wybranego przedmiotu: stan, opis, statystyki przed/po (▲▼) i główna akcja. */
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
          tr.append(
            el('td', 'workshop__stats-before ui-num', line.before ?? ''),
          );
        const after = el('td', 'workshop__stats-after ui-num', line.after);
        if (line.trend !== 'same') {
          const trend = el('span', 'workshop__trend');
          trend.dataset.trend = line.trend;
          trend.append(
            el('span', 'workshop__trend-mark', TREND_MARK[line.trend]),
            el('span', 'workshop__trend-text', text.shop.trend[line.trend]),
          );
          after.append(trend);
        }
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
    const button = uiButton({
      label: labels[card.action],
      variant: card.action === 'unequip' ? 'secondary' : 'primary',
      sound: false,
      onClick: () => cardAction(card),
    });
    button.classList.add('workshop__action');
    button.dataset.action = 'card';
    button.dataset.cardAction = card.action;
    button.dataset.key = `card:${row.id}`;
    // Zablokowana akcja zostaje klikalna: kliknięcie tłumaczy powód i gra dźwięk braku środków.
    button.setAttribute('aria-disabled', String(card.blocked !== null));
    button.disabled = busy;
    bindUiFeedback(
      button,
      card.blocked ? 'error' : card.action === 'buy' ? false : 'confirm',
    );
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

  const renderUnlocks = (): HTMLElement => {
    const groups = groupRows(unlockRows(ctx.manager)).filter(
      (group) => group.kind !== 'weapon' && group.kind !== 'module',
    );
    const section = el('section', 'workshop__section workshop__pane ui-scroll');
    section.dataset.section = 'unlocks';
    section.dataset.pane = 'unlocks';
    section.id = 'workshop-pane-unlocks';
    section.setAttribute('role', 'tabpanel');
    section.hidden = tab !== 'unlocks';
    for (const group of groups) {
      section.append(
        el(
          'h3',
          'ui-heading workshop__group-title',
          text.unlocks.groups[group.kind],
        ),
      );
      const list = el('ul', 'workshop__list ui-list');
      for (const row of group.rows)
        list.append(renderRow(row, text.unlocks.owned));
      section.append(list);
    }
    return section;
  };

  /** Przycisk przełączny (wybrane ostrze, broń, moc) w stylu wiersza listy. */
  const toggleButton = (name: string, order?: number | null): HTMLElement => {
    const button = el(
      'button',
      'workshop__choice ui-list-item ui-list-item--no-icon ui-interactive',
    );
    button.type = 'button';
    button.append(el('span', 'ui-list-item__title', name));
    if (order !== null && order !== undefined)
      button.append(
        el(
          'span',
          'workshop__order ui-list-item__value',
          fill(text.equipment.slotOrder, { n: order }),
        ),
      );
    button.setAttribute('aria-label', name);
    bindUiFeedback(button, 'confirm');
    return button;
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
      'workshop__counter ui-heading workshop__group-title',
      fill(text.equipment.counter, { label, used, slots }),
    );
    counter.dataset.counter = part;
    group.append(counter);
    const list = el('ul', 'workshop__list ui-list');
    for (const option of options) {
      const item = el('li', 'workshop__row workshop__row--choice');
      const button = toggleButton(option.name, option.order);
      button.dataset.action = 'toggle';
      button.dataset.part = part;
      button.dataset.item = option.key;
      button.dataset.key = `${part}:${option.key}`;
      button.setAttribute('aria-pressed', String(option.selected));
      if (option.blocked) {
        button.setAttribute('aria-disabled', 'true');
        button.title =
          option.blocked === 'full'
            ? text.equipment.fullHint
            : text.equipment.lastHint;
      }
      button.addEventListener('click', () => {
        if (option.blocked) {
          status = button.title;
          refresh();
          return;
        }
        const choice = nextLoadout(ctx.manager, part, option.key);
        if (choice) void setChoice(choice);
      });
      item.append(button);
      list.append(item);
    }
    group.append(list);
    return group;
  };

  const renderEquipment = (): HTMLElement => {
    const equipment = equipmentState(ctx.manager);
    const section = el('section', 'workshop__section workshop__pane ui-scroll');
    section.dataset.section = 'equipment';
    section.dataset.pane = 'equipment';
    section.id = 'workshop-pane-equipment';
    section.setAttribute('role', 'tabpanel');
    section.hidden = tab !== 'equipment';

    const blades = el('div', 'workshop__group');
    blades.dataset.group = 'blade';
    blades.append(
      el('h3', 'ui-heading workshop__group-title', text.equipment.blade),
    );
    const bladeList = el('ul', 'workshop__list ui-list');
    for (const blade of equipment.blades) {
      const item = el('li', 'workshop__row workshop__row--choice');
      const button = toggleButton(blade.name);
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
      group.append(
        el('h3', 'ui-heading workshop__group-title', weapon.weaponName),
      );
      weapon.slots.forEach((slot, index) => {
        const label = el('div', 'workshop__module-slot');
        const slotTitle = el(
          'span',
          'workshop__module-label',
          text.equipment.moduleSlots[slot.slot],
        );
        slotTitle.id = `module-label-${weapon.weaponId}-${slot.slot}-${index}`;
        label.append(slotTitle);
        const hint = slot.blocked
          ? fill(text.equipment.slotLimitHint, {
              n: ctx.manager.moduleSlotsPerWeapon,
            })
          : (slot.options.find((option) => option.id === slot.selected)
              ?.description ?? '');
        const field = createSelect<string>({
          label: text.equipment.moduleSlots[slot.slot],
          labelledBy: slotTitle.id,
          value: slot.selected,
          options: [
            { value: '', label: text.equipment.emptyModule },
            ...slot.options.map((option) => ({
              value: option.id,
              label: option.name,
              description: option.description,
            })),
          ],
          onChange: (value) => {
            void run(() =>
              ctx.manager.setLoadout(
                nextModuleLoadout(ctx.manager, weapon.weaponId, index, value),
              ),
            );
          },
        });
        field.root.classList.add('workshop__module-select');
        const trigger = field.trigger;
        trigger.dataset.weapon = weapon.weaponId;
        trigger.dataset.slot = String(index);
        trigger.dataset.key = `module:${weapon.weaponId}:${index}`;
        field.setDisabled(slot.blocked);
        trigger.title = hint;
        label.append(field.root);
        const description = el('span', 'workshop__module-description', hint);
        description.id = `module-description-${weapon.weaponId}-${slot.slot}`;
        trigger.setAttribute('aria-describedby', description.id);
        label.append(description);
        group.append(label);
      });
      weapons.append(group);
    }
    return section;
  };

  const nav = el('nav', 'workshop__nav');
  const tabDefs: { id: Category; label: string }[] = [
    { id: 'extraction', label: text.shop.tabs.extraction },
    { id: 'weapon', label: text.shop.tabs.weapon },
    { id: 'module', label: text.shop.tabs.module },
    { id: 'equipment', label: text.shop.tabs.equipment },
    { id: 'unlocks', label: text.shop.tabs.unlocks },
  ];
  const tabs: UiTabs = createTabs({
    prefix: 'workshop',
    label: text.shop.tabsLabel,
    vertical: true,
    tabs: tabDefs,
    onSelect: (id) => {
      tab = id as Category;
      if (!disposed) refresh();
    },
  });
  for (const [id, button] of tabs.buttons) {
    button.dataset.action = 'tab';
    button.dataset.tab = id;
    button.dataset.key = `tab:${id}`;
    button.setAttribute('aria-controls', `workshop-pane-${id}`);
  }
  const navStats = el('div', 'workshop__nav-stats');
  const statusLine = el('p', 'workshop__status');
  statusLine.setAttribute('role', 'status');
  nav.append(tabs.root, navStats, statusLine);
  const main = el('div', 'workshop__main');
  const side = el('aside', 'workshop__side ui-scroll');
  root.append(nav, main, side);

  const extractionPending = (): boolean =>
    ctx.manager.state.pendingExtractions.length > 0 || extractionNeedsSave;

  function refresh(): void {
    if (disposed) return;
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset
      ?.key;
    const hadFocus = root.contains(document.activeElement);
    const pending = extractionPending();
    const extractionTab = tabs.buttons.get('extraction');
    if (extractionTab) extractionTab.hidden = !pending;
    if (!pending && tab === 'extraction') tab = 'weapon';
    for (const [id, button] of tabs.buttons) {
      button.setAttribute('aria-selected', String(id === tab));
      button.tabIndex = id === tab ? 0 : -1;
    }
    const manager = ctx.manager;
    const firstWeapon = manager.state.loadout.weapons[0];
    const weaponRows = shopRows(manager, 'weapon');
    const pickWeapon = weaponRows.some((row) => row.id === selected.weapon)
      ? selected.weapon
      : firstWeapon === undefined
        ? weaponRows[0]?.id
        : `weapon:${firstWeapon}`;
    // Na zakładce dodatków podgląd pokazuje broń z ekwipunku, a wybrany dodatek jest przymierzany.
    const target = shopPreview(manager, undefined, wantedPreview);
    const moduleRows = shopRows(manager, 'module', target?.weaponId);
    const pickModule = moduleRows.some((row) => row.id === selected.module)
      ? selected.module
      : moduleRows[0]?.id;
    const current =
      tab === 'weapon' ? pickWeapon : tab === 'module' ? pickModule : undefined;
    const shown = shopPreview(manager, current, wantedPreview);
    const card = current ? shopCard(manager, current, shown?.weaponId) : null;

    statusLine.textContent = status;
    navStats.replaceChildren(renderStats());
    const panes: HTMLElement[] = [
      renderCatalog('weapon', weaponRows, pickWeapon),
      renderCatalog('module', moduleRows, pickModule),
      renderEquipment(),
      renderUnlocks(),
    ];
    if (pending) {
      const extraction = renderExtractions();
      extraction.classList.add('workshop__pane', 'ui-scroll');
      extraction.hidden = tab !== 'extraction';
      extraction.setAttribute('role', 'tabpanel');
      extraction.id = 'workshop-pane-extraction';
      panes.unshift(extraction);
    }
    main.replaceChildren(...panes);
    side.replaceChildren(
      el('h2', 'ui-heading', text.preview.title),
      renderPreview(shown),
      ...(card ? [renderCard(card)] : []),
    );
    if (focusKey && root.isConnected) {
      const focusTarget = [
        ...root.querySelectorAll<HTMLElement>('[data-key]'),
      ].find((node) => node.dataset.key === focusKey);
      (
        focusTarget ??
        (hadFocus
          ? root.querySelector<HTMLElement>('button:not(:disabled)')
          : null)
      )?.focus();
    }
  }

  tabs.select(tab);
  return {
    root,
    refresh,
    dispose() {
      disposed = true;
      preview?.dispose();
      preview = null;
      root.replaceChildren();
    },
    actions: [
      { keys: '{navigate}', label: uiText.navigate, decorative: true },
      { keys: '{confirm}', label: uiText.select, decorative: true },
      { keys: '{tabs}', label: text.shop.tabsLabel, decorative: true },
    ],
    cycleTab(direction) {
      const visible = tabDefs
        .map((def) => def.id)
        .filter((id) => !tabs.buttons.get(id)?.hidden);
      const index = visible.indexOf(tab);
      const next =
        visible[(index + direction + visible.length) % visible.length];
      if (next && next !== tab) {
        playUiSound('tab');
        tabs.select(next, true);
      }
    },
  };
};
