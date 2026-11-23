import { z } from 'zod';
import { allyDefinitions } from '../allies/allySchema';
import type { AllyDefinition } from '../allies/allySchema';
import { isAllyUnlocked, sanitizeSquad } from '../allies/roster';
import { tuning } from '../core/tuning';
import textData from '../data/ui/squad.pl.json';
import { missionCatalog } from '../world/missionCatalog';
import { bindUiFeedback } from './components/feedback';
import './squadPicker.css';

const text = z
  .object({
    title: z.string().min(1),
    hint: z.string().min(1),
    roles: z.record(z.string(), z.string()),
    selected: z.string().min(1),
    available: z.string().min(1),
    locked: z.string().min(1),
    summary: z.string().min(1),
    none: z.string().min(1),
  })
  .parse(textData);

const STORAGE_KEY = 'neoryder.squad';

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/** Ostatni wybór drużyny (ustawienie interfejsu, nie stan gry): localStorage, błędy ignorowane. */
export function loadSquadChoice(): string[] {
  try {
    const raw = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]',
    ) as unknown;
    return z.array(z.string()).catch([]).parse(raw);
  } catch {
    return [];
  }
}

export function saveSquadChoice(ids: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Brak miejsca albo zablokowany zapis: wybór obowiązuje tylko w tej sesji.
  }
}

export interface SquadPickerOptions {
  /** Ukończone misje kampanii (warunki odblokowania). */
  completed: () => readonly string[];
  onChange?: (selected: readonly string[]) => void;
  definitions?: ReadonlyMap<string, AllyDefinition>;
}

export interface SquadPicker {
  readonly root: HTMLElement;
  /** Wybrani członkowie w kolejności wyboru (tylko odblokowani). */
  selected(): string[];
  setSelected(ids: readonly string[]): void;
  /** Odświeża karty po zmianie listy ukończonych misji. */
  refresh(): void;
  dispose(): void;
}

function lockedHint(definition: AllyDefinition): string {
  const id = definition.unlock?.mission ?? '';
  const mission = missionCatalog.get(id);
  return fill(text.locked, {
    mission: mission
      ? `${String(mission.number).padStart(2, '0')} · ${mission.title}`
      : id,
  });
}

/** Sekcja „Drużyna”: karty portretów z przełącznikami (0–2 odblokowanych towarzyszy). */
export function createSquadPicker(options: SquadPickerOptions): SquadPicker {
  const definitions = options.definitions ?? allyDefinitions;
  const max = tuning.allies.maxPicked;
  const check = (ids: readonly string[]): string[] =>
    sanitizeSquad(ids, options.completed(), max, false, definitions);
  const root = document.createElement('section');
  root.className = 'squad-picker';
  root.dataset.squadPicker = '';
  const heading = document.createElement('h3');
  heading.className = 'squad-picker__title';
  heading.textContent = text.title;
  const hint = document.createElement('p');
  hint.className = 'squad-picker__hint';
  hint.textContent = text.hint;
  const grid = document.createElement('div');
  grid.className = 'squad-picker__grid';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', text.title);
  const summary = document.createElement('p');
  summary.className = 'squad-picker__summary';
  summary.setAttribute('aria-live', 'polite');
  root.append(heading, hint, grid, summary);

  let touched = false;
  let chosen = check(loadSquadChoice());
  const cards = [...definitions.values()].map((definition) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'squad-picker__card ui-interactive';
    bindUiFeedback(card, 'tab');
    card.dataset.ally = definition.id;
    const portrait = document.createElement('span');
    portrait.className = 'squad-picker__portrait';
    portrait.setAttribute('aria-hidden', 'true');
    portrait.textContent = definition.name.slice(0, 1).toUpperCase();
    const body = document.createElement('span');
    body.className = 'squad-picker__body';
    const name = document.createElement('strong');
    name.textContent = definition.name;
    const role = document.createElement('span');
    role.className = 'squad-picker__role';
    role.textContent = text.roles[definition.role] ?? definition.role;
    const status = document.createElement('span');
    status.className = 'squad-picker__status';
    body.append(name, role, status);
    card.append(portrait, body);
    const onClick = (): void => toggle(definition.id);
    card.addEventListener('click', onClick);
    grid.append(card);
    return { definition, card, status, onClick };
  });

  function render(): void {
    const completed = options.completed();
    for (const { definition, card, status } of cards) {
      const unlocked = isAllyUnlocked(definition, completed);
      const picked = chosen.includes(definition.id);
      card.setAttribute('aria-pressed', String(picked));
      card.setAttribute('aria-disabled', String(!unlocked));
      card.dataset.state = !unlocked
        ? 'locked'
        : picked
          ? 'selected'
          : 'available';
      status.textContent = !unlocked
        ? lockedHint(definition)
        : picked
          ? text.selected
          : text.available;
    }
    summary.textContent = chosen.length
      ? fill(text.summary, { count: chosen.length, max })
      : text.none;
  }

  function set(ids: readonly string[], notify: boolean): void {
    touched = true;
    chosen = check(ids);
    saveSquadChoice(chosen);
    render();
    if (notify) options.onChange?.(chosen);
  }

  function toggle(id: string): void {
    const definition = definitions.get(id);
    if (!definition || !isAllyUnlocked(definition, options.completed())) return;
    // Pełna drużyna: nowy wybór wypiera najstarszy.
    set(
      chosen.includes(id)
        ? chosen.filter((entry) => entry !== id)
        : [...chosen, id].slice(-max),
      true,
    );
  }

  render();
  return {
    root,
    selected: () => [...chosen],
    setSelected: (ids) => set(ids, false),
    refresh() {
      // Przed pierwszym kliknięciem wybór wraca z zapisu: lista ukończonych misji mogła dojść później.
      chosen = check(touched ? chosen : loadSquadChoice());
      render();
    },
    dispose() {
      for (const { card, onClick } of cards)
        card.removeEventListener('click', onClick);
      root.remove();
    },
  };
}
