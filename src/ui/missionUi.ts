import type { DialogueLine, MissionDefinition } from '../world/missionSchema';
import type { MissionObjectives } from '../world/missionObjectives';
import { tuning } from '../core/tuning';
import text from '../data/ui/missionDialogue.pl.json';
import './missionUi.css';

export function dialogueLines(lines: readonly DialogueLine[]): HTMLElement {
  const root = document.createElement('div');
  root.className = 'mission-dialogue';
  for (const line of lines) {
    const paragraph = document.createElement('p');
    const speaker = document.createElement('strong');
    speaker.dataset.speaker = line.speaker;
    if (line.speaker === 'brandt') speaker.style.color = '#ff5050';
    speaker.textContent = `${text.speakers[line.speaker]}: `;
    paragraph.append(speaker, document.createTextNode(line.text));
    root.append(paragraph);
  }
  return root;
}

export class MissionHud {
  private readonly root = document.createElement('aside');
  private readonly goals = document.createElement('div');
  private readonly rows = new Map<
    string,
    { label: HTMLElement; bar: HTMLProgressElement }
  >();
  constructor(private readonly model: MissionObjectives) {
    this.root.className = 'mission-hud';
    this.goals.className = 'mission-goals';
    const title = document.createElement('strong');
    title.textContent = text.heading;
    this.goals.append(title);
    for (const objective of model.mission.objectives.filter((o) =>
      model.ids.includes(o.id),
    )) {
      const row = document.createElement('div');
      const label = document.createElement('span');
      const bar = document.createElement('progress');
      bar.max = 1;
      bar.setAttribute('aria-label', objective.label);
      row.append(label, bar);
      this.goals.append(row);
      this.rows.set(objective.id, { label, bar });
    }
    this.goals.hidden = this.rows.size === 0;
    this.root.append(this.goals);
    document.body.append(this.root);
  }
  step(): void {
    const current =
      this.model.mission.objectives.find(
        (objective) =>
          this.model.ids.includes(objective.id) &&
          this.model.objectives[objective.id] !== 'done' &&
          this.model.unlocked(objective),
      )?.id ?? this.model.ids.at(-1);
    for (const objective of this.model.mission.objectives) {
      const row = this.rows.get(objective.id);
      if (!row) continue;
      const done = this.model.objectives[objective.id] === 'done';
      const fuse = this.model.fuses[objective.id];
      row.label.textContent = `${objective.label}${fuse === undefined ? (this.model.unlocked(objective) ? '' : ` · ${text.locked}`) : ` · ${text.fuse}: ${fuse.toFixed(1)} s`}`;
      if (objective.kind === 'defend') {
        const connected =
          (this.model.progress[`${objective.id}:connection`] ?? 0) >= 1 ||
          (this.model.progress[objective.id] ?? 0) > 0;
        const percent = Math.floor(
          (this.model.progress[objective.id] ?? 0) * 100,
        );
        row.label.textContent =
          connected || done
            ? `${text.transfer}: ${percent}%${!done && this.model.paused[objective.id] ? `\n${text.transferPaused}` : ''}`
            : `${text.connecting}: ${Math.floor((this.model.progress[`${objective.id}:connection`] ?? 0) * 100)}%`;
        row.label.style.whiteSpace = 'normal';
      }
      row.label.style.textDecoration = done ? 'line-through' : 'none';
      row.label.parentElement!.dataset.current = String(
        objective.id === current,
      );
      row.bar.value = this.model.progress[objective.id] ?? 0;
      if (
        objective.kind === 'defend' &&
        !done &&
        (this.model.progress[`${objective.id}:connection`] ?? 0) < 1 &&
        !this.model.progress[objective.id]
      )
        row.bar.value = this.model.progress[`${objective.id}:connection`] ?? 0;
    }
  }
  dispose(): void {
    this.root.remove();
  }
}

export function showDebrief(
  mission: MissionDefinition,
  close: () => Promise<void>,
): () => void {
  const dialog = document.createElement('dialog');
  dialog.className = 'mission-debrief';
  dialog.dataset.missionDebrief = mission.id;
  const heading = document.createElement('h2');
  heading.textContent = text.debrief;
  heading.tabIndex = -1;
  heading.setAttribute('autofocus', '');
  const button = document.createElement('button');
  button.textContent = text.close;
  const finish = async () => {
    button.disabled = true;
    try {
      await close();
      dialog.close();
      dialog.remove();
    } catch {
      button.disabled = false;
    }
  };
  button.addEventListener('click', () => void finish());
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    void finish();
  });
  dialog.append(heading, dialogueLines(mission.debrief), button);
  document.body.append(dialog);
  dialog.showModal();
  return () => dialog.remove();
}

/** Dzielimy wyłącznie między zdaniami i tylko wtedy, gdy cała kwestia nie mieści się w dwóch liniach. */
export function splitRadioText(
  text: string,
  fits: (text: string) => boolean,
): string[] {
  if (fits(text)) return [text];
  const sentences = text.split(/(?<=[.!?])\s+(?=\p{Lu})/u);
  const chunks: string[] = [];
  let chunk = '';
  for (const sentence of sentences) {
    const candidate = chunk ? `${chunk} ${sentence}` : sentence;
    if (chunk && !fits(candidate)) {
      chunks.push(chunk);
      chunk = sentence;
    } else chunk = candidate;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

/** Radio należy do runu, dzięki czemu zmiana pokoju nie urywa kolejki. */
export class MissionRadio {
  private readonly root = document.createElement('div');
  private readonly queue: DialogueLine[] = [];
  private remaining = 0;
  private active?: DialogueLine;
  private readonly resize = () => {
    if (!this.active) return;
    this.queue.unshift(this.active);
    this.remaining = 0;
    this.step(0);
  };
  constructor(private readonly mission: MissionDefinition) {
    window.addEventListener('resize', this.resize);
    this.root.className = 'mission-radio mission-radio--run';
    this.root.setAttribute('aria-live', 'polite');
    this.root.hidden = true;
    document.body.append(this.root);
  }
  signal(trigger: string): void {
    // Faza i ostatnie słowa muszą odpowiadać bieżącej walce, nie zaległej kolejce.
    if (trigger === 'boss:defeated' || /^boss:phase:[23]$/.test(trigger)) {
      this.queue.length = 0;
      this.remaining = 0;
    }
    for (const event of this.mission.radio)
      if (event.trigger === trigger) this.queue.push(...event.lines);
  }
  step(dt: number): void {
    this.remaining -= dt;
    if (this.remaining > 0) return;
    const queued = this.queue.shift();
    const line = queued ? { ...queued } : undefined;
    this.active = line;
    this.root.hidden = !line;
    this.root.replaceChildren();
    if (line) {
      this.root.style.fontSize = '';
      const fits = (value: string) => {
        this.root.replaceChildren(dialogueLines([{ ...line, text: value }]));
        const paragraph = this.root.querySelector('p')!;
        return (
          paragraph.getBoundingClientRect().height <=
          parseFloat(getComputedStyle(paragraph).lineHeight) * 2 + 1
        );
      };
      const chunks = splitRadioText(line.text, fits);
      const first = chunks.shift()!;
      this.queue.unshift(...chunks.map((text) => ({ ...line, text })));
      line.text = first;
      // Pojedynczego długiego zdania nie urywamy: dopasowujemy jego rozmiar do dwóch linii.
      let size = parseFloat(getComputedStyle(this.root).fontSize);
      while (!fits(first) && size > 10) {
        size -= 0.5;
        this.root.style.fontSize = `${size}px`;
      }
      this.remaining = Math.max(
        tuning.mission.radioMinS,
        line.text.length / tuning.mission.radioCharsPerS,
      );
    }
  }
  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.root.remove();
  }
}
