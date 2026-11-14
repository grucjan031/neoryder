import { z } from 'zod';
import text from '../data/ui/buildSelect.pl.json';
import {
  bladeDefinitions,
  DEFAULT_BLADE_ID,
} from '../combat/melee/bladeSchema';
import { powerDefinitions } from '../combat/powers/registry';
import { weaponDefinitions } from '../combat/weapons/weaponSchema';
import { loadoutDefinitions } from '../progression/loadout';
import type { Loadout } from '../progression/loadout';
import { synergyDefinitions } from '../progression/synergies';
import type { SynergyDefinition } from '../progression/synergies';

const buildSelectSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string(),
  hybridsTitle: z.string().min(1),
  weapons: z.string().min(1),
  powers: z.string().min(1),
  synergies: z.string().min(1),
  blade: z.object({
    title: z.string().min(1),
    options: z
      .array(
        z.object({
          id: z
            .string()
            .refine((id) => bladeDefinitions.has(id), 'Nieznane ostrze'),
          name: z.string().min(1),
          description: z.string().min(1),
        }),
      )
      .min(1),
  }),
  builds: z
    .array(
      z.object({
        id: z.string().min(1),
        hybrid: z.boolean().default(false),
        description: z.string().min(1),
      }),
    )
    .min(1),
});

export type BuildSelectText = z.infer<typeof buildSelectSchema>;

/** Karta ekranu wyboru: wszystko, co gracz widzi o ekwipunku, wyliczone z danych. */
export interface BuildOption {
  id: string;
  name: string;
  description: string;
  hybrid: boolean;
  weapons: string[];
  powers: string[];
  /** Nazwy synergii, których `requires` zawierają się w tagach ekwipunku (jak SynergySystem.active). */
  synergies: string[];
}

export function buildOptions(
  data: unknown,
  loadouts: ReadonlyMap<string, Loadout> = loadoutDefinitions,
  synergies: readonly SynergyDefinition[] = synergyDefinitions,
): { text: BuildSelectText; options: BuildOption[] } {
  const parsed = buildSelectSchema.parse(data);
  const seen = new Set<string>();
  const options = parsed.builds.map((build): BuildOption => {
    const loadout = loadouts.get(build.id);
    if (!loadout)
      throw new Error(`Ekran wyboru buildu: nieznany ekwipunek ${build.id}`);
    if (seen.has(build.id))
      throw new Error(`Ekran wyboru buildu: powtórzony ekwipunek ${build.id}`);
    seen.add(build.id);
    const tags = new Set(loadout.tags);
    return {
      id: loadout.id,
      name: loadout.name,
      description: build.description,
      hybrid: build.hybrid,
      weapons: loadout.weapons.map(
        (id) => weaponDefinitions.get(id)?.name ?? id,
      ),
      powers: loadout.powers.map((id) => powerDefinitions.get(id)?.name ?? id),
      synergies: synergies
        .filter((s) => s.requires.every((tag) => tags.has(tag)))
        .map((s) => s.name),
    };
  });
  return { text: parsed, options };
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

interface BuildSelectOptions {
  /** `bladeId` tylko gdy gracz wybrał wariant ostrza (nadpisanie ostrza ekwipunku). */
  onSelect: (loadoutId: string, bladeId?: string) => void;
  root?: HTMLElement;
  /** Teksty i lista buildów; domyślnie src/data/ui/buildSelect.pl.json. */
  data?: unknown;
}

/** Ekran wyboru buildu przed falą 1 (F2-17). HTML nad canvasem; wybór to gest użytkownika. */
export class BuildSelect {
  private readonly root = element('section', 'build-select');
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly bladeButtons = new Map<string, HTMLButtonElement>();
  /** Wybrany wariant ostrza; null = ostrze ekwipunku (domyślnie plazmowe). */
  private bladeId: string | null = null;
  private readonly listeners: (() => void)[] = [];
  private disposed = false;

  constructor(private readonly opts: BuildSelectOptions) {
    const { text: t, options } = buildOptions(opts.data ?? text);
    this.root.hidden = true;
    this.root.setAttribute('aria-labelledby', 'build-select-title');
    const panel = element('div', 'build-select__panel');
    const title = element('h2', 'build-select__title', t.title);
    title.id = 'build-select-title';
    panel.append(title, element('p', 'build-select__subtitle', t.subtitle));
    const builds = element('div', 'build-select__grid');
    const hybrids = element('div', 'build-select__grid');
    for (const option of options) {
      const button = this.card(option, t);
      (option.hybrid ? hybrids : builds).append(button);
    }
    panel.append(this.bladeRow(t), builds);
    if (hybrids.childElementCount > 0)
      panel.append(
        element('h3', 'build-select__section', t.hybridsTitle),
        hybrids,
      );
    this.root.append(panel);
    (opts.root ?? document.body).append(this.root);
  }

  get visible(): boolean {
    return !this.disposed && !this.root.hidden;
  }

  show(): void {
    if (this.disposed) return;
    this.root.hidden = false;
    this.buttons[0]?.focus();
  }

  hide(): void {
    this.root.hidden = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.listeners.splice(0)) off();
    this.root.remove();
  }

  private bladeRow(t: BuildSelectText): HTMLElement {
    const row = element('div', 'build-select__blades');
    row.setAttribute('role', 'group');
    const label = element('span', 'build-select__blades-label', t.blade.title);
    label.id = 'build-select-blade-title';
    row.setAttribute('aria-labelledby', label.id);
    row.append(label);
    for (const option of t.blade.options) {
      const button = element('button', 'build-select__blade');
      button.type = 'button';
      button.dataset.blade = option.id;
      button.title = option.description;
      button.append(
        element('span', 'build-select__blade-name', option.name),
        element('span', 'build-select__blade-desc', option.description),
      );
      const onClick = (): void => this.chooseBlade(option.id);
      button.addEventListener('click', onClick);
      this.listeners.push(() => button.removeEventListener('click', onClick));
      this.bladeButtons.set(option.id, button);
      row.append(button);
    }
    this.markBlade();
    return row;
  }

  private chooseBlade(id: string): void {
    this.bladeId = id;
    this.markBlade();
  }

  private markBlade(): void {
    const current = this.bladeId ?? DEFAULT_BLADE_ID;
    for (const [id, button] of this.bladeButtons)
      button.setAttribute('aria-pressed', String(id === current));
  }

  private card(option: BuildOption, t: BuildSelectText): HTMLButtonElement {
    const button = element(
      'button',
      option.hybrid
        ? 'build-select__card build-select__card--hybrid'
        : 'build-select__card',
    );
    button.type = 'button';
    button.dataset.loadout = option.id;
    const name = element('span', 'build-select__name', option.name);
    name.id = `build-select-${option.id}-name`;
    const details = element('span', 'build-select__details');
    details.id = `build-select-${option.id}-details`;
    details.append(
      element('span', 'build-select__description', option.description),
      this.line(t.weapons, option.weapons),
      this.line(t.powers, option.powers),
    );
    if (option.synergies.length > 0)
      details.append(this.line(t.synergies, option.synergies, true));
    button.setAttribute('aria-labelledby', name.id);
    button.setAttribute('aria-describedby', details.id);
    button.append(name, details);
    const onClick = (): void => this.select(option.id);
    button.addEventListener('click', onClick);
    this.listeners.push(() => button.removeEventListener('click', onClick));
    this.buttons.push(button);
    return button;
  }

  private line(
    label: string,
    items: readonly string[],
    synergy = false,
  ): HTMLElement {
    const node = element(
      'span',
      synergy
        ? 'build-select__line build-select__line--synergy'
        : 'build-select__line',
    );
    node.append(
      element('span', 'build-select__label', label),
      element('span', 'build-select__items', items.join(', ')),
    );
    return node;
  }

  private select(id: string): void {
    if (!this.visible) return;
    this.hide();
    if (this.bladeId === null) this.opts.onSelect(id);
    else this.opts.onSelect(id, this.bladeId);
  }
}
