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
    for (const objective of this.model.mission.objectives) {
      const row = this.rows.get(objective.id);
      if (!row) continue;
      const done = this.model.objectives[objective.id] === 'done';
      const fuse = this.model.fuses[objective.id];
      row.label.textContent = `${objective.label}${fuse === undefined ? (this.model.unlocked(objective) ? '' : ` · ${text.locked}`) : ` · ${text.fuse}: ${fuse.toFixed(1)} s`}`;
      row.label.style.textDecoration = done ? 'line-through' : 'none';
      row.bar.value = this.model.progress[objective.id] ?? 0;
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

/** Radio należy do runu, dzięki czemu zmiana pokoju nie urywa kolejki. */
export class MissionRadio {
  private readonly root = document.createElement('div');
  private readonly queue: DialogueLine[] = [];
  private remaining = 0;
  constructor(private readonly mission: MissionDefinition) {
    this.root.className = 'mission-radio mission-radio--run';
    this.root.setAttribute('aria-live', 'polite');
    this.root.hidden = true;
    document.body.append(this.root);
  }
  signal(trigger: string): void {
    for (const event of this.mission.radio)
      if (event.trigger === trigger)
        for (const line of event.lines) {
          let chunk = '';
          for (const word of line.text.split(' ')) {
            if (
              chunk &&
              chunk.length + word.length > tuning.mission.radioChunkChars
            ) {
              this.queue.push({ ...line, text: chunk });
              chunk = '';
            }
            chunk += (chunk ? ' ' : '') + word;
          }
          if (chunk) this.queue.push({ ...line, text: chunk });
        }
  }
  step(dt: number): void {
    this.remaining -= dt;
    if (this.remaining > 0) return;
    const line = this.queue.shift();
    this.root.hidden = !line;
    this.root.replaceChildren();
    if (line) {
      this.root.append(dialogueLines([line]));
      this.remaining = Math.max(
        tuning.mission.radioMinS,
        line.text.length / tuning.mission.radioCharsPerS,
      );
    }
  }
  dispose(): void {
    this.root.remove();
  }
}
