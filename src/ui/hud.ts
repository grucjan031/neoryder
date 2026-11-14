import type { EntityId, EventBus } from '../core/events';
import text from '../data/ui/hud.pl.json';
import { powerDefinitions } from '../combat/powers/registry';
import { weaponDefinitions } from '../combat/weapons/weaponSchema';
import type { Loadout } from '../progression/loadout';

type HudLoadout = Pick<Loadout, 'weapons' | 'powers'>;

interface HudOptions {
  playerId: EntityId;
  root?: HTMLElement;
  onRetry?: () => void;
  loadout?: HudLoadout;
}

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

function setText(node: HTMLElement, content: string): void {
  if (node.textContent !== content) node.textContent = content;
}

function createMeter(kind: 'health' | 'energy' | 'heat') {
  const node = element('div', `hud__meter hud__meter--${kind}`);
  const label = element('span', 'hud__label', text[kind]);
  const value = element('span', 'hud__value', text.empty);
  const track = element('div', 'hud__track');
  const fill = element('div', 'hud__fill');
  fill.style.width = '0%';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', text[kind]);
  track.setAttribute('aria-valuetext', text.empty);
  track.append(fill);
  node.append(label, value, track);
  let lastCurrent: number | undefined;
  let lastMax: number | undefined;
  let lastWidth = '0%';
  return {
    node,
    label,
    update(current: number, max: number): void {
      if (current === lastCurrent && max === lastMax) return;
      lastCurrent = current;
      lastMax = max;
      const width = `${max > 0 ? Math.min(1, Math.max(0, current / max)) * 100 : 0}%`;
      if (width !== lastWidth) {
        fill.style.width = width;
        lastWidth = width;
      }
      const content = `${Math.round(current)} / ${Math.round(max)}`;
      setText(value, content);
      if (track.getAttribute('aria-valuetext') !== content)
        track.setAttribute('aria-valuetext', content);
    },
  };
}

function createFlash(className: string) {
  const node = element('div', className);
  node.hidden = true;
  let alternate = false;
  const hide = (event: AnimationEvent): void => {
    if (event.target === node) node.hidden = true;
  };
  node.addEventListener('animationend', hide);
  return {
    node,
    show(): void {
      alternate = !alternate;
      node.classList.toggle('hud__flash--alternate', alternate);
      node.hidden = false;
    },
    dispose(): void {
      node.removeEventListener('animationend', hide);
    },
  };
}

/** Widok stanu gracza; wszystkie dane rozgrywki pochodzą z EventBus. */
export class Hud {
  private readonly unsubscribe: (() => void)[];
  private readonly root = element('div', 'hud');
  private readonly retryButton = element('button', 'hud__retry', text.retry);
  private readonly death = element('section', 'hud__death');
  private readonly denial = createFlash('hud__denial');
  private readonly damage = createFlash('hud__damage');
  private readonly weaponName = element('span', 'hud__weapon-name');
  private readonly powers = element('div', 'hud__powers');
  private powerSlots: {
    id: string;
    cooldownS: number;
    remaining: number;
    value: HTMLElement;
    denial: ReturnType<typeof createFlash>;
  }[] = [];
  private previousFocus: HTMLElement | null = null;
  private disposed = false;

  constructor(
    bus: EventBus,
    private readonly opts: HudOptions,
  ) {
    const health = createMeter('health');
    const energy = createMeter('energy');
    const heat = createMeter('heat');
    const meters = element('div', 'hud__meters');
    const weapon = element('div', 'hud__weapon');
    weapon.append(element('span', 'hud__label', text.weapon), this.weaponName);
    meters.append(health.node, energy.node, weapon, heat.node);
    this.powers.setAttribute('aria-label', text.powers);
    const crosshair = element('div', 'hud__crosshair');
    crosshair.setAttribute('aria-hidden', 'true');
    this.damage.node.setAttribute('aria-hidden', 'true');
    this.denial.node.setAttribute('role', 'status');
    const wave = element('div', 'hud__wave');
    wave.setAttribute('role', 'status');
    this.death.hidden = true;
    this.death.setAttribute('role', 'dialog');
    this.death.setAttribute('aria-label', text.died);
    this.retryButton.type = 'button';
    this.death.append(
      element('h1', 'hud__death-title', text.died),
      this.retryButton,
    );
    this.root.append(
      this.damage.node,
      meters,
      this.powers,
      crosshair,
      this.denial.node,
      wave,
      this.death,
    );
    (opts.root ?? document.body).append(this.root);
    this.setLoadout(opts.loadout ?? { weapons: [], powers: [] });
    this.retryButton.addEventListener('click', this.retry);
    window.addEventListener('keydown', this.onKeyDown, true);
    let overheated = false;
    this.unsubscribe = [
      bus.on('health_changed', ({ id, current, max }) => {
        if (id === opts.playerId) health.update(current, max);
      }),
      bus.on('energy_changed', ({ id, current, max }) => {
        if (id === opts.playerId) energy.update(current, max);
      }),
      bus.on('heat_changed', ({ id, current, max, overheated: next }) => {
        if (id !== opts.playerId) return;
        heat.update(current, max);
        if (overheated !== next) {
          overheated = next;
          heat.node.classList.toggle('hud__meter--overheated', next);
          setText(heat.label, next ? text.overheated : text.heat);
        }
      }),
      bus.on('weapon_switched', ({ owner, weapon }) => {
        if (owner === opts.playerId)
          setText(
            this.weaponName,
            weaponDefinitions.get(weapon)?.name ?? text.empty,
          );
      }),
      bus.on('power_used', ({ user, power }) => {
        if (user !== opts.playerId) return;
        for (const slot of this.powerSlots) {
          if (slot.id !== power) continue;
          slot.remaining = slot.cooldownS;
          this.showCooldown(slot);
        }
      }),
      bus.on('power_denied', ({ user, power, reason }) => {
        if (user !== opts.playerId) return;
        setText(
          this.denial.node,
          reason === 'no_energy' ? text.noEnergy : text.cooldown,
        );
        this.denial.show();
        for (const slot of this.powerSlots) {
          if (slot.id !== power) continue;
          setText(slot.denial.node, this.denial.node.textContent ?? '');
          slot.denial.show();
        }
      }),
      bus.on('damage_dealt', ({ target, amount }) => {
        if (target === opts.playerId && amount > 0) this.damage.show();
      }),
      bus.on('wave_started', ({ wave: number }) =>
        setText(wave, `${text.wave} ${number}`),
      ),
      bus.on('wave_cleared', () => setText(wave, text.waveCleared)),
      bus.on('player_died', ({ id }) => {
        if (id !== opts.playerId || !this.death.hidden) return;
        this.previousFocus =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        this.death.hidden = false;
        this.retryButton.focus();
      }),
    ];
  }

  /** Dane startowe ekwipunku; dalsze zmiany zasobów pochodzą wyłącznie ze zdarzeń. */
  setLoadout(loadout: HudLoadout): void {
    for (const slot of this.powerSlots) slot.denial.dispose();
    this.powerSlots = [];
    this.powers.replaceChildren();
    setText(
      this.weaponName,
      weaponDefinitions.get(loadout.weapons[0] ?? '')?.name ?? text.empty,
    );
    for (const [index, key] of text.powerKeys.entries()) {
      const def = powerDefinitions.get(loadout.powers[index] ?? '');
      const node = element('div', 'hud__power');
      const value = element(
        'span',
        'hud__power-cooldown',
        def ? text.ready : text.empty,
      );
      const denial = createFlash('hud__power-denial');
      node.append(
        element('kbd', 'hud__power-key', key),
        element('span', 'hud__power-name', def?.name ?? text.empty),
        value,
        denial.node,
      );
      this.powers.append(node);
      this.powerSlots.push({
        id: def?.id ?? '',
        cooldownS: def?.cooldownS ?? 0,
        remaining: 0,
        value,
        denial,
      });
    }
    this.death.hidden = true;
    this.denial.node.hidden = true;
    this.damage.node.hidden = true;
    this.restoreFocus();
  }

  /** Czas gracza, także 0 podczas hitstopu; bez odpytywania obiektów symulacji. */
  step(dt: number): void {
    if (this.disposed || !(dt > 0)) return;
    for (const slot of this.powerSlots) {
      if (!(slot.remaining > 0)) continue;
      slot.remaining = Math.max(0, slot.remaining - dt);
      if (slot.remaining < Number.EPSILON * 16) slot.remaining = 0;
      this.showCooldown(slot);
    }
  }

  private showCooldown(slot: (typeof this.powerSlots)[number]): void {
    setText(
      slot.value,
      slot.remaining > 0
        ? `${slot.remaining.toFixed(1)} ${text.seconds}`
        : text.ready,
    );
  }

  private readonly retry = (): void => {
    if (this.disposed || this.death.hidden) return;
    this.death.hidden = true;
    this.restoreFocus();
    this.opts.onRetry?.();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.death.hidden || event.repeat) return;
    if (
      event.key !== 'Enter' &&
      event.code !== 'KeyR' &&
      event.key.toLowerCase() !== 'r'
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    this.retry();
  };

  private restoreFocus(): void {
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    else this.retryButton.blur();
    this.previousFocus = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    window.removeEventListener('keydown', this.onKeyDown, true);
    this.retryButton.removeEventListener('click', this.retry);
    this.denial.dispose();
    this.damage.dispose();
    for (const slot of this.powerSlots) slot.denial.dispose();
    this.restoreFocus();
    this.root.remove();
  }
}
