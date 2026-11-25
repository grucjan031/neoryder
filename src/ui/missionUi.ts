import type { Vec3 } from '../core/math';
import type { MissionDefinition, RadioPriority } from '../world/missionSchema';
import type { MissionObjectives } from '../world/missionObjectives';
import { tuning } from '../core/tuning';
import text from '../data/ui/missionDialogue.pl.json';
import {
  MissionDialogue,
  MissionDialogueCard,
  RadioQueue,
  splitDialogueText,
  type RadioCard,
} from './missionDialogue';
import './missionUi.css';

export class MissionHud {
  private readonly root = document.createElement('aside');
  private readonly goals = document.createElement('div');
  private readonly rows = new Map<
    string,
    { label: HTMLElement; bar: HTMLProgressElement }
  >();
  private readonly bonusRows = new Map<string, HTMLElement>();
  constructor(
    private readonly model: MissionObjectives,
    private readonly currentOnly = false,
    bonuses: MissionDefinition['bonuses'] = [],
    private readonly bonusState?: (id: string) => string | undefined,
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
    for (const b of bonuses) {
      const row = document.createElement('div');
      row.dataset.label = b.label;
      this.bonusRows.set(b.id, row);
      this.goals.append(row);
    }
    this.goals.hidden = this.rows.size === 0;
    this.root.append(this.goals);
    document.body.append(this.root);
  }
  step(): void {
    for (const [id, row] of this.bonusRows) {
      const state = this.bonusState?.(id) ?? 'pending';
      if (state === row.dataset.state) continue;
      row.dataset.state = state;
      row.textContent = `${state === 'done' ? '✓ ' : state === 'failed' ? '✗ ' : ''}Dodatkowo: ${row.dataset.label}`;
      row.style.textDecoration = state === 'failed' ? 'line-through' : '';
    }
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
  private readonly queue = new RadioQueue();
  private readonly resize = () => {
    if (!this.queue.active) return;
    this.queue.requeueActive();
    this.step(0);
  };
  constructor(private readonly mission: MissionDefinition) {
    window.addEventListener('resize', this.resize);
    this.root.className = 'mission-radio mission-radio--run';
    this.root.hidden = true;
    this.root.append(this.card.root);
    document.body.append(this.root);
  }
  signal(trigger: string, objectives?: Readonly<Record<string, string>>): void {
    // Faza i ostatnie słowa muszą odpowiadać bieżącej walce, nie zaległej kolejce.
    if (trigger === 'boss:defeated' || /^boss:phase:[23]$/.test(trigger))
      this.queue.clear();
    for (const event of this.mission.radio)
      if (
        event.trigger === trigger &&
        (!event.beforeObjective ||
          objectives?.[event.beforeObjective] !== 'done')
      )
        this.queue.push(
          event.lines.map(({ speaker, text, shortText }) => ({
            speaker,
            text: shortText ?? text,
          })),
          event.priority ?? 'tactical',
        );
  }
  /** Host zgłasza walkę; kwestie `story` czekają wtedy na spokój. */
  setCombat(combat: boolean): void {
    this.queue.setCombat(combat);
  }
  snapshot(): {
    active: RadioCard | null;
    pending: Readonly<Record<RadioPriority, number>>;
  } {
    return { active: this.queue.active ?? null, pending: this.queue.pending };
  }
  step(dt: number): void {
    const next = this.queue.step(dt);
    if (next === undefined) return;
    if (next === null) {
      this.root.hidden = true;
      delete this.root.dataset.priority;
      this.card.clear();
      return;
    }
    this.root.hidden = false;
    this.root.dataset.priority = next.priority;
    const paragraph = this.card.line;
    const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight);
    const [first, ...rest] = splitDialogueText(next.text, (value) => {
      if (Array.from(value).length > tuning.mission.radioPageChars)
        return false;
      paragraph.textContent = value;
      const height = paragraph.getBoundingClientRect().height;
      return height === 0 || height <= 2 * lineHeight + 1;
    });
    this.queue.unshift(
      rest.map((text) => ({ speaker: next.speaker, text })),
      next.priority,
    );
    next.text = first!;
    paragraph.textContent = first!;
    this.card.show(next.speaker, first!);
    this.queue.hold(
      Math.max(
        tuning.mission.radioMinS,
        Array.from(first!).length / tuning.mission.radioCharsPerS,
      ),
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
  bonuses: readonly { label: string; done: boolean; data: number }[] = [],
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
  dialog.append(heading, title);
  for (const b of bonuses) {
    const row = document.createElement('p');
    row.textContent = `${b.done ? '✓' : '✗'} ${b.label} · +${b.data} Danych`;
    dialog.append(row);
  }
  dialog.append(button);
  document.body.append(dialog);
  document.exitPointerLock?.();
  dialog.showModal();
  return () => dialog.remove();
}
