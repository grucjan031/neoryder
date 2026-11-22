import { tuning } from '../core/tuning';
import text from '../data/ui/missionDialogue.pl.json';
import type { DialogueLine, RadioPriority } from '../world/missionSchema';

/** W razie potrzeby dzieli przy końcu zdania, wyrazu lub znaku w długim wyrazie. */
export function splitDialogueText(
  value: string,
  fits: (candidate: string) => boolean,
): string[] {
  const pages: string[] = [];
  let remaining = value.trim();
  while (!fits(remaining) && remaining.length > 0) {
    const characters = Array.from(remaining);
    let lower = 1;
    let upper = characters.length;
    while (lower < upper) {
      const middle = Math.ceil((lower + upper) / 2);
      if (fits(characters.slice(0, middle).join(''))) lower = middle;
      else upper = middle - 1;
    }
    const prefix = characters.slice(0, lower).join('');
    const preview = prefix + (characters[lower] ?? '');
    const sentence = preview.match(/^.*[.!?](?=\s)/su)?.[0];
    const word = preview.match(/^.*\S(?=\s)/su)?.[0];
    const page = sentence || word || prefix;
    pages.push(page);
    remaining = remaining.slice(page.length).trimStart();
  }
  if (remaining || !pages.length) pages.push(remaining);
  return pages;
}

export interface RadioLine {
  speaker: DialogueLine['speaker'];
  text: string;
}
export interface RadioCard extends RadioLine {
  priority: RadioPriority;
}

/**
 * Kolejka radia bez DOM: jedna karta naraz, dwa priorytety.
 * `tactical` gra od razu (w kolejności zgłoszeń) i przerywa kartę `story`;
 * `story` czeka na spokój — brak walki przez `radioCalmDelayS` — a przerwana
 * wraca na początek swojej kolejki, chyba że była już widoczna przez
 * `radioStoryReadFraction` swojego czasu (wtedy liczy się jako przeczytana).
 * Po `radioStoryMaxWaitS` czekania jedna kwestia `story` gra mimo walki,
 * żeby treść nie przepadła w długim starciu.
 */
export class RadioQueue {
  private readonly tactical: RadioLine[] = [];
  private readonly story: RadioLine[] = [];
  private current?: RadioCard;
  private remainingS = 0;
  private heldS = 0;
  private combat = false;
  // Bez hosta zgłaszającego walkę (misja-run) kwestie fabularne nie czekają.
  private calmS = Infinity;
  private storyWaitS = 0;

  get active(): RadioCard | undefined {
    return this.current;
  }
  get pending(): Readonly<Record<RadioPriority, number>> {
    return { tactical: this.tactical.length, story: this.story.length };
  }

  push(lines: readonly RadioLine[], priority: RadioPriority): void {
    this[priority].push(...lines);
  }

  /** Dalsze strony podzielonej kwestii albo karta do ponownego złożenia. */
  unshift(lines: readonly RadioLine[], priority: RadioPriority): void {
    this[priority].unshift(...lines);
  }

  setCombat(combat: boolean): void {
    if (this.combat && !combat) this.calmS = 0;
    this.combat = combat;
  }

  /** Bieżąca karta znika przy najbliższym kroku, o ile nic jej nie zastąpi. */
  clear(): void {
    this.tactical.length = 0;
    this.story.length = 0;
    this.remainingS = 0;
    this.storyWaitS = 0;
  }

  /** Oddaje bieżącą kartę do kolejki (zmiana szerokości okna wymaga nowego podziału). */
  requeueActive(): void {
    if (!this.current) return;
    const { priority, ...line } = this.current;
    this[priority].unshift(line);
    this.current = undefined;
    this.remainingS = 0;
  }

  /** Czas wyświetlania bieżącej karty zależy od długości pokazanego tekstu. */
  hold(seconds: number): void {
    this.remainingS = seconds;
    this.heldS = seconds;
  }

  /**
   * Zwraca nową kartę do pokazania, `null` gdy radio ma zniknąć,
   * `undefined` gdy nic się nie zmienia.
   */
  step(dt: number): RadioCard | null | undefined {
    this.remainingS -= dt;
    if (this.combat) this.calmS = 0;
    else this.calmS += dt;
    if (this.story.length) this.storyWaitS += dt;
    const interrupt =
      this.remainingS > 0 &&
      this.current?.priority === 'story' &&
      this.tactical.length > 0;
    if (this.remainingS > 0 && !interrupt) return undefined;
    if (interrupt) {
      const read = 1 - this.remainingS / this.heldS;
      if (read < tuning.mission.radioStoryReadFraction) this.requeueActive();
    }
    const tactical = this.tactical.shift();
    if (tactical) return (this.current = { ...tactical, priority: 'tactical' });
    const calm = this.calmS >= tuning.mission.radioCalmDelayS;
    if (
      this.story.length &&
      (calm || this.storyWaitS >= tuning.mission.radioStoryMaxWaitS)
    ) {
      this.storyWaitS = 0;
      return (this.current = { ...this.story.shift()!, priority: 'story' });
    }
    if (!this.current) return undefined;
    this.current = undefined;
    return null;
  }
}

export class MissionDialogueCard {
  readonly root = document.createElement('div');
  readonly line = document.createElement('p');
  private readonly speaker = document.createElement('strong');
  private readonly icon = document.createElement('span');
  private readonly announcement = document.createElement('span');

  constructor() {
    this.root.className = 'mission-dialogue';
    this.icon.className = 'mission-dialogue__icon';
    this.icon.setAttribute('aria-hidden', 'true');
    this.line.className = 'mission-dialogue__text';
    this.line.setAttribute('aria-hidden', 'true');
    this.announcement.className = 'mission-dialogue__announcement';
    this.announcement.setAttribute('role', 'status');
    this.root.append(this.icon, this.speaker, this.line, this.announcement);
  }

  show(speaker: DialogueLine['speaker'], value: string): void {
    const name = text.speakers[speaker];
    this.root.dataset.speaker = speaker;
    this.icon.textContent = text.speakerIcons[speaker];
    this.speaker.textContent = name;
    this.announcement.textContent = `${name}. ${value}`;
  }

  clear(): void {
    delete this.root.dataset.speaker;
    this.icon.textContent = '';
    this.speaker.textContent = '';
    this.line.textContent = '';
    this.announcement.textContent = '';
  }
}

interface DialogueSection {
  title?: string;
  lines: readonly DialogueLine[];
  interlude?: boolean;
}

export class MissionDialogue {
  readonly root = document.createElement('section');
  private readonly heading = document.createElement('h3');
  private readonly card = new MissionDialogueCard();
  private readonly next = document.createElement('button');
  private readonly auto = document.createElement('input');
  private readonly pages: {
    section: DialogueSection;
    speaker: DialogueLine['speaker'];
    value: string;
  }[];
  private index = 0;
  private characters: string[] = [];
  private visible = 0;
  private timer?: number;
  private readonly reducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(sections: readonly DialogueSection[]) {
    this.pages = sections.flatMap((section) =>
      section.lines.flatMap(({ speaker, text }) =>
        splitDialogueText(
          text,
          (value) =>
            Array.from(value).length <= tuning.mission.dialoguePageChars,
        ).map((value) => ({ section, speaker, value })),
      ),
    );
    this.root.className = 'mission-dialogue-player';
    this.root.tabIndex = -1;
    this.next.type = 'button';
    this.next.textContent = text.next;
    this.next.setAttribute('aria-keyshortcuts', 'Space');
    const shortcut = document.createElement('kbd');
    shortcut.textContent = text.space;
    shortcut.setAttribute('aria-hidden', 'true');
    this.next.append(shortcut);
    this.auto.type = 'checkbox';
    const label = document.createElement('label');
    label.append(this.auto, text.autoAdvance);
    const controls = document.createElement('div');
    controls.className = 'mission-dialogue-player__controls';
    controls.append(label, this.next);
    this.root.append(this.heading, this.card.root, controls);
    this.root.hidden = !this.pages.length;
    this.next.addEventListener('click', () => this.advance());
    this.card.root.addEventListener('click', () => {
      this.root.focus({ preventScroll: true });
      this.advance();
    });
    this.root.addEventListener('keydown', (event) => {
      if (
        (event.code !== 'Space' && event.key !== ' ') ||
        (event.target !== this.root && event.target !== this.next)
      )
        return;
      event.preventDefault();
      if (!event.repeat) this.advance();
    });
    this.auto.addEventListener('change', () => {
      if (this.visible === this.characters.length) this.scheduleAuto();
    });
    this.showPage();
  }

  private showPage(): void {
    const page = this.pages[this.index];
    if (!page) return;
    this.heading.textContent = page.section.title ?? '';
    this.heading.hidden = !page.section.title;
    this.root.toggleAttribute(
      'data-mission-interlude',
      !!page.section.interlude,
    );
    this.card.show(page.speaker, page.value);
    this.characters = Array.from(page.value);
    this.visible = 0;
    this.next.hidden = false;
    if (this.reducedMotion || !this.characters.length) this.revealPage();
    else this.typeNext();
  }

  private typeNext(): void {
    if (++this.visible >= this.characters.length) {
      this.revealPage();
      return;
    }
    this.card.line.textContent = this.characters
      .slice(0, this.visible)
      .join('');
    this.timer = window.setTimeout(
      () => this.typeNext(),
      1000 / tuning.mission.dialogueCharsPerS,
    );
  }

  private revealPage(): void {
    this.visible = this.characters.length;
    this.card.line.textContent = this.characters.join('');
    if (!this.pages[this.index + 1]) {
      if (document.activeElement === this.next)
        this.root.focus({ preventScroll: true });
      this.next.hidden = true;
    }
    this.scheduleAuto();
  }

  private scheduleAuto(): void {
    window.clearTimeout(this.timer);
    if (!this.auto.checked || !this.pages[this.index + 1]) return;
    this.timer = window.setTimeout(
      () => this.advance(),
      1000 *
        Math.max(
          tuning.mission.dialogueAutoMinS,
          this.characters.length / tuning.mission.radioCharsPerS,
        ),
    );
  }

  private advance(): void {
    if (this.visible < this.characters.length) {
      this.revealPage();
    } else if (this.pages[this.index + 1]) {
      window.clearTimeout(this.timer);
      this.index++;
      this.showPage();
    }
  }

  dispose(): void {
    window.clearTimeout(this.timer);
    this.root.remove();
  }
}
