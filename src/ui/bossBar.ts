import type { EntityId, EventBus } from '../core/events';
import { tuning } from '../core/tuning';
import text from '../data/ui/hud.pl.json';
import { loadSettings } from '../core/save';
import { getLiteFx } from '../render/fxMode';

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function restartAnimation(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const roman = (n: number): string => ROMAN[n - 1] ?? String(n);

/**
 * Pasek bossa w stylu wizjera: zapowiedź z nazwą przy wejściu, zdrowie podzielone progami faz
 * (z opóźnionym „duchem” straconego zdrowia), licznik faz, wytrzymałość tarczy, komunikat osłony
 * przy zmianie fazy i stempel po zwycięstwie. Słucha wyłącznie `EventBus`; animacje w CSS.
 */
export class BossBar {
  readonly node = element('div', 'run-hud__boss');
  /** Stempel po śmierci bossa (osobny węzeł: pasek znika od razu, stempel gaśnie animacją). */
  readonly verdict = element('div', 'run-hud__boss-verdict');
  private readonly micro = element('span', 'hud__micro', text.microBoss);
  private readonly phase = element('span', 'run-hud__boss-phase');
  private readonly name = element('span', 'run-hud__boss-name');
  private readonly track = element('div', 'run-hud__boss-track');
  private readonly ghost = element('div', 'run-hud__boss-ghost');
  private readonly fill = element('div', 'run-hud__boss-fill');
  private readonly ticks = element('div', 'run-hud__boss-ticks');
  private readonly shield = element('div', 'run-hud__boss-shield');
  private readonly shieldFill = element('div', 'run-hud__boss-shield-fill');
  private readonly status = element(
    'span',
    'run-hud__boss-status',
    text.bossShift,
  );
  private readonly verdictName = element('span', 'run-hud__boss-verdict-name');
  private readonly unsubscribe: (() => void)[];
  private bossId: EntityId | null = null;
  private phases = 1;

  constructor(bus: EventBus) {
    this.node.hidden = true;
    this.verdict.hidden = true;
    this.verdict.setAttribute('role', 'status');
    this.verdict.append(
      element('span', 'hud__micro', text.microBossDown),
      element('span', 'run-hud__boss-verdict-title', text.bossDown),
      this.verdictName,
    );
    this.track.setAttribute('role', 'progressbar');
    this.track.setAttribute('aria-label', text.bossHealth);
    this.setRatio(1);
    this.track.append(this.ghost, this.fill, this.ticks);
    this.shield.hidden = true;
    this.shield.append(this.shieldFill);
    this.status.setAttribute('aria-hidden', 'true');
    const head = element('div', 'run-hud__boss-head');
    head.append(this.micro, this.phase);
    this.node.append(head, this.name, this.shield, this.track, this.status);
    this.node.style.setProperty('--shift-s', `${tuning.enemies.phaseShiftS}s`);
    this.node.style.setProperty('--intro-s', `${tuning.vfx.bossIntroS}s`);
    this.verdict.style.setProperty('--hold-s', `${tuning.vfx.bossDeathFxS}s`);

    this.unsubscribe = [
      bus.on('boss_spawned', ({ id, name, maxHealth, phaseThresholds }) => {
        this.bossId = id;
        this.phases = phaseThresholds.length + 1;
        this.name.textContent = name;
        this.verdictName.textContent = name;
        this.track.setAttribute('aria-valuetext', `${maxHealth}`);
        this.setRatio(1);
        this.setPhaseTicks(phaseThresholds);
        this.setPhase(1);
        this.shield.hidden = true;
        delete this.node.dataset.phase;
        this.node.classList.remove('run-hud__boss--phase');
        this.verdict.hidden = true;
        this.syncFlashes();
        this.node.hidden = false;
        // Zapowiedź: tylko animacja (sterowanie zostaje u gracza); w fx=lite pominięta.
        if (!getLiteFx()) restartAnimation(this.node, 'run-hud__boss--intro');
      }),
      bus.on('health_changed', ({ id, current, max }) => {
        if (id !== this.bossId) return;
        this.setRatio(max > 0 ? Math.min(1, Math.max(0, current / max)) : 0);
        this.track.setAttribute(
          'aria-valuetext',
          `${Math.round(current)} / ${Math.round(max)}`,
        );
      }),
      bus.on('boss_phase', ({ id, phase, phases }) => {
        if (id !== this.bossId) return;
        this.phases = phases;
        this.node.dataset.phase = String(phase);
        this.setPhase(phase);
        this.syncFlashes();
        this.node.classList.remove('run-hud__boss--intro');
        restartAnimation(this.node, 'run-hud__boss--phase');
      }),
      bus.on('boss_shield', ({ id, current, max }) => {
        if (id !== this.bossId) return;
        this.shield.hidden = max <= 0 || current <= 0;
        this.shieldFill.style.setProperty(
          '--p',
          max > 0 ? (current / max).toFixed(3) : '0',
        );
      }),
      bus.on('enemy_killed', ({ id }) => this.hide(id, true)),
      bus.on('entity_despawned', ({ id }) => this.hide(id, false)),
    ];
  }

  /** Ustawienie „błyski” czytane przy każdym zdarzeniu: zmiana w pauzie działa od razu. */
  private syncFlashes(): void {
    const off = !loadSettings().flashes;
    this.node.classList.toggle('run-hud__boss--no-flashes', off);
    this.verdict.classList.toggle('run-hud__boss-verdict--no-flashes', off);
  }

  private setRatio(ratio: number): void {
    const value = ratio === 1 ? '1' : ratio.toFixed(3);
    this.fill.style.setProperty('--p', value);
    this.ghost.style.setProperty('--p', value);
  }

  private setPhase(phase: number): void {
    this.phase.textContent = `${text.bossPhase} ${roman(phase)} / ${roman(this.phases)}`;
  }

  private setPhaseTicks(thresholds: readonly number[]): void {
    this.ticks.replaceChildren();
    for (const threshold of thresholds) {
      const tick = element('span', 'run-hud__boss-tick');
      // --at = ułamek zdrowia do stracenia; pasek ubywa od prawej, więc znacznik stoi w (1 − at).
      tick.style.setProperty('--at', (1 - threshold).toFixed(3));
      this.ticks.append(tick);
    }
  }

  private hide(id: EntityId, killed: boolean): void {
    if (id !== this.bossId) return;
    this.bossId = null;
    this.node.hidden = true;
    this.node.classList.remove('run-hud__boss--intro', 'run-hud__boss--phase');
    if (killed) {
      this.syncFlashes();
      this.verdict.hidden = false;
      restartAnimation(this.verdict, 'run-hud__boss-verdict--show');
    }
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.node.remove();
    this.verdict.remove();
  }
}

/**
 * Pasek bossa dla scen bez pełnego HUD (np. `boss-test`): własny kontener `.hud`.
 * Zwraca funkcję sprzątającą.
 */
export function mountBossBar(
  bus: EventBus,
  parent: HTMLElement = document.body,
): () => void {
  const root = element('div', 'hud hud--boss-only');
  const layer = element('div', 'run-hud');
  const bar = new BossBar(bus);
  layer.append(bar.node, bar.verdict);
  root.append(layer);
  parent.append(root);
  return () => {
    bar.dispose();
    root.remove();
  };
}
