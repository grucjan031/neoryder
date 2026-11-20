import { z } from 'zod';
import { powerDefinitions } from '../combat/powers/registry';
import { weaponDefinitions } from '../combat/weapons/weaponSchema';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import type { Rarity, RunState } from '../core/runTypes';
import type { Loadout } from '../progression/loadout';
import { moduleDefinitions } from '../progression/moduleSchema';
import { implantDefinitions } from '../progression/implants';
import type { ImplantDefinition } from '../progression/implantSchema';
import { synergyDefinitions } from '../progression/synergies';
import descriptionData from '../data/ui/descriptions.pl.json';
import bladeText from '../data/ui/buildSelect.pl.json';
import textData from '../data/ui/inventory.pl.json';
import './runScreens.css';

const text = z
  .object({
    title: z.string(),
    credits: z.string(),
    implants: z.string(),
    noImplants: z.string(),
    noDescription: z.string(),
    synergies: z.string(),
    noSynergies: z.string(),
    powers: z.string(),
    weapons: z.string(),
    noModules: z.string(),
    blade: z.string(),
    close: z.string(),
    hint: z.string(),
    rarities: z.object({
      common: z.string(),
      rare: z.string(),
      epic: z.string(),
      legendary: z.string(),
    }),
  })
  .parse(textData);

export interface InventoryEntry {
  name: string;
  description: string;
  rarity?: Rarity;
  tags?: string[];
}

export interface RunInventoryView {
  /** Brak (undefined) = bez wiersza Kredytów (np. arena). */
  credits?: number;
  implants: InventoryEntry[];
  synergies: InventoryEntry[];
  powers: InventoryEntry[];
  weapons: { name: string; modules: InventoryEntry[] }[];
  blade?: string;
}

type Descriptions = Record<string, string>;

const tagsActive = (
  tags: readonly string[],
  def: (typeof synergyDefinitions)[number],
): boolean =>
  def.requires.every((tag) => tags.includes(tag)) &&
  Object.entries(def.requiresCount ?? {}).every(
    ([tag, count]) => tags.filter((entry) => entry === tag).length >= count,
  );

/** Widok ekwipunku z danych runu lub areny; czysta funkcja, bez DOM. */
export function buildRunInventoryView(
  source: {
    loadout: Loadout;
    implants?: readonly string[];
    credits?: number;
  },
  definitions: ReadonlyMap<string, ImplantDefinition> = implantDefinitions,
): RunInventoryView {
  const implants = (source.implants ?? []).map((id): InventoryEntry => {
    const def = definitions.get(id);
    return {
      name: def?.name ?? id,
      description: def?.description ?? text.noDescription,
      rarity: def?.rarity,
      tags: def?.tags,
    };
  });
  const tags = [
    ...source.loadout.tags,
    ...(source.implants ?? []).flatMap((id) => definitions.get(id)?.tags ?? []),
  ];
  const synergyText = descriptionData.synergies as Descriptions;
  const powerText = descriptionData.powers as Descriptions;
  const modules = source.loadout.modules ?? {};
  const blade = bladeText.blade.options.find(
    (option) => option.id === source.loadout.blade,
  );
  return {
    credits: source.credits,
    implants,
    synergies: synergyDefinitions
      .filter((def) => tagsActive(tags, def))
      .map((def) => ({
        name: def.name,
        description: synergyText[def.id] ?? text.noDescription,
      })),
    powers: source.loadout.powers.map((id) => ({
      name: powerDefinitions.get(id)?.name ?? id,
      description: powerText[id] ?? text.noDescription,
    })),
    weapons: source.loadout.weapons.map((id) => ({
      name: weaponDefinitions.get(id)?.name ?? id,
      modules: (modules[id] ?? []).map((moduleId) => {
        const module = moduleDefinitions.get(moduleId);
        return {
          name: module?.name ?? moduleId,
          description: module?.description ?? text.noDescription,
        };
      }),
    })),
    blade: blade?.name ?? source.loadout.blade,
  };
}

export type RunInventoryState = Pick<
  RunState,
  'loadout' | 'implants' | 'credits'
>;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

/**
 * Menu ulepszeń w trakcie gry (Tab): wstrzymuje pętlę jak menu pauzy i pokazuje, co gracz
 * ma. Klasa `run-screen` sprawia, że `main.ts` nie otwiera nad nim menu pauzy (Esc, utrata
 * pointer locka). Zamknięcie: ten sam klawisz, Tab, Esc albo przycisk; wznowienie przez
 * `ctx.resume` (zdejmuje pauzę i prosi o pointer lock).
 */
export class RunInventoryMenu {
  private readonly root = element('div', 'run-screen run-inventory');
  private readonly body = element('div', 'run-inventory__body');
  private readonly footer = element('div', 'run-inventory__footer');
  private lastCode = '';
  private openedBy = 'Tab';
  private readonly onKey = (event: KeyboardEvent): void => {
    if (!this.visible) {
      if (!event.repeat) this.lastCode = event.code;
      return;
    }
    if (event.repeat) return;
    if (
      event.target instanceof Element &&
      event.target.closest('dialog.debug-console')
    )
      return;
    if (
      event.code === 'Escape' ||
      event.code === 'Tab' ||
      event.code === this.openedBy
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.close();
    }
  };

  constructor(
    private readonly ctx: Pick<GameContext, 'loop' | 'resume'>,
    private readonly getView: () => RunInventoryView,
  ) {
    this.root.hidden = true;
    this.root.dataset.screen = 'inventory';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', text.title);
    const panel = element('section', 'run-screen__panel run-inventory__panel');
    panel.append(element('h1', undefined, text.title), this.body, this.footer);
    this.root.append(panel);
    // Panel trafia do dokumentu tylko na czas otwarcia: ukryty `.run-screen` w DOM mylił
    // selektory ekranów runu (testy e2e trybów) i logikę „czy jakiś ekran jest otwarty”.
    window.addEventListener('keydown', this.onKey, true);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  /** Wołać w kroku sceny, gdy gracz jest w grze (nie na ekranie mapy/nagrody). */
  step(input: InputSnapshot): void {
    if (this.visible || !input.pressed.has('inventory')) return;
    this.open();
  }

  open(): void {
    if (this.visible || this.ctx.loop.paused) return;
    this.openedBy = this.lastCode || 'Tab';
    this.render();
    // Panel jest już widoczny, więc utrata pointer locka nie otworzy menu pauzy.
    document.body.append(this.root);
    this.root.hidden = false;
    this.ctx.loop.paused = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.root.querySelector('button')?.focus();
  }

  close(): void {
    if (!this.visible) return;
    this.root.hidden = true;
    this.root.remove();
    this.ctx.loop.paused = false;
    this.ctx.resume?.();
  }

  private render(): void {
    const view = this.getView();
    const section = (heading: string, count?: number): HTMLElement => {
      const node = element('section', 'run-inventory__section');
      node.append(
        element(
          'h2',
          undefined,
          count === undefined ? heading : `${heading} (${count})`,
        ),
      );
      return node;
    };
    const list = (entries: InventoryEntry[], empty: string): HTMLElement => {
      const ul = element('ul', 'run-inventory__list');
      if (!entries.length && empty)
        ul.append(element('li', 'run-inventory__empty', empty));
      for (const entry of entries) {
        const li = element('li', 'run-inventory__item');
        if (entry.rarity) li.dataset.rarity = entry.rarity;
        const head = element('div', 'run-inventory__name', entry.name);
        if (entry.rarity)
          head.append(
            element(
              'span',
              'run-inventory__rarity',
              text.rarities[entry.rarity],
            ),
          );
        li.append(head, element('p', undefined, entry.description));
        ul.append(li);
      }
      return ul;
    };
    const implants = section(text.implants, view.implants.length);
    implants.classList.add('run-inventory__section--wide');
    implants.append(list(view.implants, text.noImplants));
    const synergies = section(text.synergies, view.synergies.length);
    synergies.append(list(view.synergies, text.noSynergies));
    const powers = section(text.powers);
    powers.append(list(view.powers, ''));
    const weapons = section(text.weapons);
    const weaponList = element('ul', 'run-inventory__list');
    if (view.blade)
      weaponList.append(
        element('li', 'run-inventory__item', `${text.blade}: ${view.blade}`),
      );
    for (const weapon of view.weapons) {
      const li = element('li', 'run-inventory__item');
      li.append(element('div', 'run-inventory__name', weapon.name));
      if (!weapon.modules.length)
        li.append(element('p', undefined, text.noModules));
      for (const module of weapon.modules)
        li.append(
          element('p', undefined, `${module.name}: ${module.description}`),
        );
      weaponList.append(li);
    }
    weapons.append(weaponList);
    // Przycisk powstaje dopiero przy otwarciu: ukryty panel nie ma żadnych przycisków
    // (testy liczą `.run-screen button` na ekranach runu).
    const close = element('button', 'run-screen__primary', text.close);
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    this.footer.replaceChildren(
      element('p', 'run-inventory__hint', text.hint),
      close,
    );
    this.body.replaceChildren();
    if (view.credits !== undefined) {
      const credits = element('p', 'run-inventory__credits');
      credits.append(
        `${text.credits}: `,
        element('b', undefined, String(view.credits)),
      );
      this.body.append(credits);
    }
    this.body.append(implants, synergies, powers, weapons);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey, true);
    if (this.visible) this.ctx.loop.paused = false;
    this.root.remove();
  }
}
