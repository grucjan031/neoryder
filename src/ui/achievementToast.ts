import type { EventBus } from '../core/events';
import { achievementDefinitions } from '../progression/achievementsSchema';
import { createAchievementIcon } from './achievementIcons';
import { achievementText } from './achievementText';
import './achievementToast.css';

/** Czas pokazania komunikatu (UI, nie symulacja). */
export const ACHIEVEMENT_TOAST_MS = 3000;

/**
 * Krótki komunikat „Naszywka: <tytuł>” przy przekroczeniu progu osiągnięcia w trakcie runu
 * (zdarzenie `achievement_earned`). Komunikaty ustawiają się w kolejce, po jednym na raz.
 * Element siedzi w rogu ekranu, poza celownikiem i paskami zdrowia.
 */
export class AchievementToast {
  readonly node = document.createElement('div');
  private readonly queue: string[] = [];
  private current: ReturnType<typeof setTimeout> | undefined;
  private readonly off: () => void;
  private disposed = false;

  constructor(
    bus: EventBus,
    parent: Element = document.querySelector('#app') ?? document.body,
    private readonly durationMs = ACHIEVEMENT_TOAST_MS,
  ) {
    this.node.className = 'achv-toast';
    this.node.hidden = true;
    this.node.setAttribute('role', 'status');
    this.node.setAttribute('aria-live', 'polite');
    parent.append(this.node);
    this.off = bus.on('achievement_earned', ({ id }) => {
      this.queue.push(id);
      if (this.current === undefined) this.next();
    });
  }

  private next(): void {
    if (this.disposed) return;
    const id = this.queue.shift();
    const def = id ? achievementDefinitions.get(id) : undefined;
    if (!def) {
      this.current = undefined;
      this.node.hidden = true;
      this.node.replaceChildren();
      if (this.queue.length > 0) this.next();
      return;
    }
    const icon = document.createElement('span');
    icon.className = 'achv-toast__icon';
    icon.append(createAchievementIcon(def.icon));
    const label = document.createElement('span');
    label.className = 'achv-toast__text';
    const kicker = document.createElement('span');
    kicker.className = 'achv-toast__kicker';
    kicker.textContent = `${achievementText.toast.prefix}:`;
    const title = document.createElement('span');
    title.className = 'achv-toast__title';
    title.textContent = def.title;
    label.append(kicker, ' ', title);
    this.node.replaceChildren(icon, label);
    this.node.dataset.id = def.id;
    this.node.hidden = false;
    this.current = setTimeout(() => this.next(), this.durationMs);
  }

  dispose(): void {
    this.disposed = true;
    this.off();
    if (this.current !== undefined) clearTimeout(this.current);
    this.node.remove();
  }
}
