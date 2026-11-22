import type { Vec3 } from '../core/math';
import type { DialogueLine, MissionDefinition } from '../world/missionSchema';
import type { MissionObjectives } from '../world/missionObjectives';
import { tuning } from '../core/tuning';
import text from '../data/ui/missionDialogue.pl.json';
import {
  MissionDialogue,
  MissionDialogueCard,
  splitDialogueText,
} from './missionDialogue';
import './missionUi.css';

export class MissionHud {
  private readonly root = document.createElement('aside');
  private readonly goals = document.createElement('div');
  private readonly rows = new Map<
    string,
    { label: HTMLElement; bar: HTMLProgressElement }
  >();
  constructor(
    private readonly model: MissionObjectives,
    private readonly currentOnly = false,
  ) {
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
      row.label.parentElement!.hidden =
        this.currentOnly && objective.id !== current;
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
  const conversation = new MissionDialogue([{ lines: mission.debrief }]);
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text.close;
  const dispose = () => {
    conversation.dispose();
    dialog.remove();
  };
  const finish = async () => {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await close();
      dialog.close();
      dispose();
    } catch {
      button.disabled = false;
    }
  };
  button.addEventListener('click', () => void finish());
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    void finish();
  });
  dialog.append(heading, conversation.root, button);
  document.body.append(dialog);
  document.exitPointerLock?.();
  dialog.showModal();
  if (!conversation.root.hidden)
    conversation.root.focus({ preventScroll: true });
  return dispose;
}

/** Radio należy do runu, dzięki czemu zmiana pokoju nie urywa kolejki. */
export class MissionRadio {
  private readonly root = document.createElement('div');
  private readonly card = new MissionDialogueCard();
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
    this.root.hidden = true;
    this.root.append(this.card.root);
    document.body.append(this.root);
  }
  signal(trigger: string): void {
    // Faza i ostatnie słowa muszą odpowiadać bieżącej walce, nie zaległej kolejce.
    if (trigger === 'boss:defeated' || /^boss:phase:[23]$/.test(trigger)) {
      this.queue.length = 0;
      this.remaining = 0;
      this.active = undefined;
    }
    for (const event of this.mission.radio)
      if (event.trigger === trigger)
        for (const { speaker, text, shortText } of event.lines)
          this.queue.push({ speaker, text: shortText ?? text });
  }
  step(dt: number): void {
    this.remaining -= dt;
    if (this.remaining > 0) return;
    const line = this.queue.shift();
    if (!line) {
      if (!this.root.hidden) {
        this.active = undefined;
        this.root.hidden = true;
        this.card.clear();
      }
      return;
    }
    this.root.hidden = false;
    const paragraph = this.card.line;
    const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight);
    const [first, ...rest] = splitDialogueText(line.text, (value) => {
      if (Array.from(value).length > tuning.mission.radioPageChars)
        return false;
      paragraph.textContent = value;
      const height = paragraph.getBoundingClientRect().height;
      return height === 0 || height <= 2 * lineHeight + 1;
    });
    this.queue.unshift(
      ...rest.map((text) => ({ speaker: line.speaker, text })),
    );
    this.active = { speaker: line.speaker, text: first! };
    paragraph.textContent = this.active.text;
    this.card.show(line.speaker, this.active.text);
    this.remaining = Math.max(
      tuning.mission.radioMinS,
      Array.from(this.active.text).length / tuning.mission.radioCharsPerS,
    );
  }
  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.root.remove();
  }
}

/** Znacznik względem kierunku patrzenia, także gdy cel znajduje się za plecami. */
export class MissionDirection {
  private readonly root = document.createElement('div');
  private readonly arrow = document.createElement('span');
  private readonly label = document.createElement('span');
  private readonly status = document.createElement('p');
  private readonly retry = document.createElement('button');
  constructor(onRetry?: () => void) {
    this.root.className = 'mission-direction';
    this.root.dataset.missionDirection = '';
    this.arrow.textContent = '↑';
    this.retry.textContent = text.retrySave;
    this.retry.hidden = true;
    this.retry.addEventListener('click', () => onRetry?.());
    this.root.append(this.arrow, this.label, this.status, this.retry);
    document.body.append(this.root);
  }
  update(
    model: MissionObjectives,
    player: { position: Vec3; yaw: number },
  ): void {
    const objective = model.mission.objectives.find(
      (item) =>
        model.ids.includes(item.id) &&
        model.objectives[item.id] !== 'done' &&
        model.unlocked(item),
    );
    const target = objective ? model.position(objective) : null;
    this.arrow.hidden = !target;
    this.label.hidden = !target;
    if (!target || !objective) return;
    const dx = target.x - player.position.x;
    const dz = target.z - player.position.z;
    const angle = Math.atan2(-dx, -dz) - player.yaw;
    this.arrow.style.transform = `rotate(${-angle}rad)`;
    this.label.textContent = text.direction
      .replace('{label}', objective.label)
      .replace('{distance}', String(Math.round(Math.hypot(dx, dz))));
  }
  setStatus(state: string, error: string | null): void {
    this.status.textContent = error
      ? text.saveError
      : state === 'respawning'
        ? text.respawning
        : '';
    this.retry.hidden = !error;
  }
  dispose(): void {
    this.root.remove();
  }
}

export function showLinearSummary(
  mission: MissionDefinition,
  back: () => void,
): () => void {
  const dialog = document.createElement('dialog');
  dialog.className = 'mission-debrief';
  dialog.dataset.missionSummary = mission.id;
  const heading = document.createElement('h2');
  heading.textContent = text.victory;
  const title = document.createElement('p');
  title.textContent = mission.title;
  const button = document.createElement('button');
  button.textContent = text.returnHub;
  button.addEventListener('click', back);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    back();
  });
  dialog.append(heading, title, button);
  document.body.append(dialog);
  document.exitPointerLock?.();
  dialog.showModal();
  return () => dialog.remove();
}
