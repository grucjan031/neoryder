import { setInputHint } from './inputGlyphs';
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
import { createRunPanel } from './runPanel';
import { uiButton } from './components/button';
import { playUiSound } from '../audio/uiSounds';

const text = z
  .object({
    title: z.string(),
    kicker: z.string(),
    columns: z.object({
      implants: z.string(),
      build: z.string(),
      weapons: z.string(),
    }),
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
    padHint: z.string(),
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
  private readonly credits = element('p', 'run-inventory__credits');
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
      playUiSound('back');
      this.close();
      return;
    }
    // Strzałki lewo/prawo (i D-pad) przechodzą między kolumnami i przyciskiem „Wróć do gry”.
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      const stops = [
        ...this.root.querySelectorAll<HTMLElement>(
          '.run-inventory__column, .run-inventory__footer button',
        ),
      ];
      const index = stops.indexOf(document.activeElement as HTMLElement);
      const next =
        stops[
          Math.min(
            stops.length - 1,
            Math.max(0, index + (event.code === 'ArrowRight' ? 1 : -1)),
          )
        ];
      event.preventDefault();
      next?.focus();
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
    this.root.setAttribute('aria-modal', 'true');
    const { frame, body: scroll } = createRunPanel('run-inventory__panel');
    const head = element('div', 'run-screen__head');
    const titles = element('div');
    titles.append(
      element('p', 'ui-kicker', text.kicker),
      element('h1', 'ui-title', text.title),
    );
    head.append(titles, this.credits);
    scroll.append(head, this.body);
    frame.append(this.footer);
    this.root.append(frame);
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
    this.root
      .querySelector<HTMLElement>('.run-inventory__footer button')
      ?.focus();
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
    const column = (label: string): HTMLElement => {
      const node = element('div', 'run-inventory__column ui-scroll');
      node.tabIndex = 0;
      node.setAttribute('role', 'region');
      node.setAttribute('aria-label', label);
      return node;
    };
    const implants = section(text.implants, view.implants.length);
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
      for (const module of weapon.modules) {
        const line = element('p', 'run-inventory__module');
        line.append(
          element('b', undefined, module.name),
          `: ${module.description}`,
        );
        li.append(line);
      }
      weaponList.append(li);
    }
    weapons.append(weaponList);
    // Przycisk powstaje dopiero przy otwarciu: ukryty panel nie ma żadnych przycisków
    // (testy liczą `.run-screen button` na ekranach runu).
    const close = uiButton({
      label: text.close,
      variant: 'primary',
      sound: 'back',
      onClick: () => this.close(),
    });
    close.classList.add('run-screen__primary');
    this.footer.replaceChildren(
      setInputHint(
        element('p', 'run-inventory__hint'),
        text.hint,
        text.padHint,
      ),
      close,
    );
    this.credits.replaceChildren();
    this.credits.hidden = view.credits === undefined;
    if (view.credits !== undefined)
      this.credits.append(
        `${text.credits}: `,
        element('b', undefined, String(view.credits)),
      );
    const left = column(text.columns.implants);
    left.append(implants);
    const middle = column(text.columns.build);
    middle.append(synergies, powers);
    const right = column(text.columns.weapons);
    right.append(weapons);
    this.body.replaceChildren(left, middle, right);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey, true);
    if (this.visible) this.ctx.loop.paused = false;
    this.root.remove();
  }
}
