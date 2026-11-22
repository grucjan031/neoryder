import { z } from 'zod';
import { actionSchema, resolveBindings } from '../core/input';
import { loadSettings } from '../core/save';
import defaults from '../data/inputBindings.json';
import settingsData from '../data/ui/settings.pl.json';
import { aboutDemoText as text } from '../data/ui/aboutDemoSchema';
import { bugReportText } from './buildInfo';
import type { BuildInfo } from './buildInfo';
import { keyLabel, setInputHint } from './inputGlyphs';
import './aboutDemo.css';

const controls = z
  .object({
    actions: z.record(actionSchema, z.string()),
    unbound: z.string(),
  })
  .parse(settingsData);

export class AboutDemo {
  private readonly root = document.createElement('dialog');
  private readonly content = document.createElement('div');
  private previousFocus: HTMLElement | null = null;
  private generation = 0;

  constructor() {
    this.root.className = 'about-demo';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = text.close;
    close.addEventListener('click', () => this.hide());
    this.root.append(this.content, close);
    this.root.addEventListener('cancel', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.hide();
    });
    this.root.addEventListener('keydown', (event) => event.stopPropagation());
    document.body.append(this.root);
  }

  showControls(): void {
    this.open(text.title);
    const list = document.createElement('dl');
    const resolved = resolveBindings(loadSettings().bindings);
    for (const action of actionSchema.options) {
      const keys = Object.entries(resolved)
        .filter(([, owner]) => owner === action)
        .map(([code]) => keyLabel(code));
      const mouse = Object.entries(defaults.mouse)
        .filter(([, owner]) => actionSchema.parse(owner) === action)
        .map(([code]) => keyLabel(`mouse${code}`));
      const label = document.createElement('dt');
      label.textContent = controls.actions[action];
      const value = document.createElement('dd');
      setInputHint(
        value,
        action === 'pause'
          ? '{pause}'
          : [...keys, ...mouse].join(' / ') || controls.unbound,
        `{${action}}`,
      );
      list.append(label, value);
    }
    const look = document.createElement('p');
    setInputHint(look, text.look, '{look} — rozglądanie');
    const pause = document.createElement('p');
    setInputHint(
      pause,
      text.pauseKey,
      '{pause} — pauza. {back} — zamknij okno',
    );
    const heading = document.createElement('h2');
    heading.textContent = text.saveTitle;
    const save = document.createElement('p');
    save.textContent = text.saveDescription;
    this.content.append(look, pause, list, heading, save);
  }

  async showReport(info: BuildInfo): Promise<void> {
    this.open(text.report);
    const generation = this.generation;
    const report = bugReportText({
      ...info,
      userAgent: navigator.userAgent,
      resolution: { width: window.innerWidth, height: window.innerHeight },
      date: new Date().toISOString(),
    });
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = text.copyPending;
    const link = document.createElement('a');
    link.href = text.reportUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `${text.reportLink}: ${text.reportUrl}`;
    this.content.append(status, link);
    try {
      await navigator.clipboard.writeText(report);
      if (generation === this.generation) status.textContent = text.copied;
    } catch {
      if (generation !== this.generation) return;
      status.textContent = text.copyFallback;
      const field = document.createElement('textarea');
      field.readOnly = true;
      field.setAttribute('aria-label', text.reportData);
      field.value = report;
      this.content.append(field);
      field.focus();
      field.select();
    }
  }

  private open(title: string): void {
    this.generation++;
    this.previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    this.root.setAttribute('aria-label', title);
    const heading = document.createElement('h1');
    heading.textContent = title;
    this.content.replaceChildren(heading);
    if (!this.root.open) this.root.showModal();
    this.root.querySelector('button')?.focus();
  }

  hide(): void {
    if (!this.root.open) return;
    this.generation++;
    this.root.close();
    this.previousFocus?.focus();
  }

  dispose(): void {
    this.generation++;
    this.root.remove();
  }
}
