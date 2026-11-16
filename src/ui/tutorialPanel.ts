import { loadSettings } from '../core/save';
import { tutorialTextParts } from '../data/tutorial/text';
import type { TutorialStep } from '../data/tutorial/schema';
import text from '../data/ui/tutorial.pl.json';
import './tutorialPanel.css';

export class TutorialPanel {
  private readonly root = document.createElement('section');
  private readonly number = document.createElement('div');
  private readonly instruction = document.createElement('p');
  private readonly feedback = document.createElement('span');
  private readonly completion = document.createElement('dialog');
  private current?: TutorialStep;
  private bindings = '';
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly parent: Element = document.querySelector('#app') ??
      document.body,
    private readonly navigate: (url: string) => void = (url) =>
      location.assign(url),
  ) {
    parent.classList.add('tutorial-active');
    this.root.className = 'tutorial-panel';
    this.root.setAttribute('role', 'status');
    this.number.className = 'tutorial-panel__number';
    this.feedback.className = 'tutorial-panel__feedback';
    this.feedback.hidden = true;
    this.root.append(this.number, this.instruction, this.feedback);
    // Wspólny znacznik ekranu rozgrywki zapobiega otwarciu pauzy nad zakończeniem.
    this.completion.className = 'run-screen tutorial-completion';
    this.completion.hidden = true;
    this.completion.setAttribute('aria-labelledby', 'tutorial-completed-title');
    const title = document.createElement('h1');
    title.id = 'tutorial-completed-title';
    title.textContent = text.completed;
    const summary = document.createElement('p');
    summary.textContent = text.steps.complete;
    this.completion.append(title, summary);
    for (const [label, scene] of [
      [text.hub, 'hub'],
      [text.repeat, 'tutorial'],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label!;
      button.addEventListener('click', () => {
        const params = new URLSearchParams({ scene: scene! });
        if (new URLSearchParams(location.search).get('debug') === '1')
          params.set('debug', '1');
        this.navigate(`?${params}`);
      });
      this.completion.append(button);
    }
    this.completion.addEventListener('cancel', (event) =>
      event.preventDefault(),
    );
    parent.append(this.root, this.completion);
  }
  show(
    step: TutorialStep,
    number: number,
    total: number,
    completedPrevious: boolean,
  ): void {
    this.current = step;
    this.number.textContent = `${text.progress} · ${number} / ${total}`;
    this.bindings = '';
    this.syncBindings();
    this.feedback.hidden = !completedPrevious;
    this.feedback.textContent = text.done;
    clearTimeout(this.timer);
    this.root.classList.toggle(
      'tutorial-panel--flash',
      completedPrevious && loadSettings().flashes,
    );
    if (completedPrevious)
      this.timer = setTimeout(() => {
        this.feedback.hidden = true;
      }, 1500);
    this.completion.hidden = !step.complete;
    this.root.hidden = step.complete;
    if (step.complete) {
      if (!this.completion.open) this.completion.showModal();
      document.exitPointerLock?.();
    } else if (this.completion.open) this.completion.close();
  }
  syncBindings(): void {
    if (!this.current) return;
    const settings = loadSettings();
    if (!settings.flashes) this.root.classList.remove('tutorial-panel--flash');
    const signature = JSON.stringify(settings.bindings);
    if (signature === this.bindings) return;
    this.bindings = signature;
    const template = text.steps[this.current.text as keyof typeof text.steps];
    this.instruction.replaceChildren(
      ...tutorialTextParts(template, settings.bindings).map((part) => {
        if (!part.key) return document.createTextNode(part.text);
        const key = document.createElement('kbd');
        key.textContent = part.text;
        return key;
      }),
    );
  }
  dispose(): void {
    clearTimeout(this.timer);
    this.completion.close();
    this.completion.remove();
    this.root.remove();
    this.parent.classList.remove('tutorial-active');
  }
}
