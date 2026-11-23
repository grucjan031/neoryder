import './prototypeHud.css';

export interface PrototypeHudState {
  title: string;
  status: string;
  hp: { label: string; current: number; max: number };
  /** Drugi pasek (uwalnianie, postęp trasy); `null` ukrywa. */
  bar: { label: string; value: number } | null;
  detail: string;
  outcome: 'success' | 'failure' | null;
}

/** HUD prototypów S4-03 (DOM nad canvasem): stan celu, paski, komunikat końcowy. */
export class PrototypeHud {
  private readonly root = document.createElement('section');
  private readonly title = document.createElement('strong');
  private readonly detail = document.createElement('span');
  private readonly status = document.createElement('p');
  private readonly hpLabel = document.createElement('label');
  private readonly hp = document.createElement('progress');
  private readonly barLabel = document.createElement('label');
  private readonly bar = document.createElement('progress');
  private readonly outcome = document.createElement('p');

  constructor(parent: HTMLElement = document.body) {
    this.root.className = 'proto-hud';
    const header = document.createElement('header');
    header.append(this.title, this.detail);
    this.status.setAttribute('role', 'status');
    this.outcome.className = 'proto-outcome';
    this.hp.max = 1;
    this.bar.max = 1;
    this.hpLabel.append(document.createTextNode(''), this.hp);
    this.barLabel.append(document.createTextNode(''), this.bar);
    this.root.append(
      header,
      this.status,
      this.hpLabel,
      this.barLabel,
      this.outcome,
    );
    parent.append(this.root);
  }

  update(state: PrototypeHudState): void {
    this.title.textContent = state.title;
    this.detail.textContent = state.detail;
    this.status.textContent = state.status;
    this.hpLabel.firstChild!.textContent = `${state.hp.label}: ${Math.ceil(state.hp.current)}/${state.hp.max}`;
    this.hp.value = state.hp.max > 0 ? state.hp.current / state.hp.max : 0;
    this.barLabel.hidden = state.bar === null;
    if (state.bar) {
      this.barLabel.firstChild!.textContent = state.bar.label;
      this.bar.value = state.bar.value;
    }
    this.outcome.hidden = state.outcome === null;
    this.outcome.textContent = state.outcome ? state.status : '';
    if (state.outcome) this.root.dataset.outcome = state.outcome;
    else delete this.root.dataset.outcome;
  }

  dispose(): void {
    this.root.remove();
  }
}
