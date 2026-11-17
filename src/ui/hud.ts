import type { EntityId, EventBus } from '../core/events';
import { loadSettings } from '../core/save';
import text from '../data/ui/hud.pl.json';
import { powerDefinitions } from '../combat/powers/registry';
import { weaponDefinitions } from '../combat/weapons/weaponSchema';
import { RunHud, type RunHudSeed } from './runHud';
import type { Loadout } from '../progression/loadout';
import { synergyDefinitions } from '../progression/synergies';

type HudLoadout = Pick<Loadout, 'weapons' | 'powers'>;

interface HudOptions {
  playerId: EntityId;
  root?: HTMLElement;
  onRetry?: () => void;
  /** F2-17: drugi przycisk na ekranie śmierci — powrót do wyboru buildu. */
  onChangeBuild?: () => void;
  loadout?: HudLoadout;
  /** Liczba fal do napisu „FALA 3 / 12”; bez niej pokazywany jest sam numer. */
  totalWaves?: number;
  /** Stan runu do odtworzenia Kredytów i implantów w nowym pokoju. */
  run?: RunHudSeed;
}

/** Liczba segmentów paska zdrowia. */
export const HEALTH_SEGMENTS = 10;
/** Maksymalna liczba slotów broni pokazywanych we wskaźniku. */
const MAX_WEAPON_SLOTS = 3;
const HEAT_WARM = 0.5;
const HEAT_HOT = 0.8;
const LOW_HEALTH = 0.3;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Kąt źródła obrażeń w stopniach, zgodnie z ruchem wskazówek od góry ekranu
 * (−180..180]. `dir` to kierunek lotu ataku (źródło → gracz), `yaw` to obrót kamery.
 */
export function damageIndicatorAngle(
  dir: { x: number; z: number },
  yaw: number,
): number {
  const sx = -dir.x;
  const sz = -dir.z;
  const forward = sx * -Math.sin(yaw) + sz * -Math.cos(yaw);
  const right = sx * Math.cos(yaw) + sz * -Math.sin(yaw);
  return Math.atan2(right, forward) * RAD_TO_DEG;
}

export function heatLevel(ratio: number): 'cool' | 'warm' | 'hot' {
  return ratio >= HEAT_HOT ? 'hot' : ratio >= HEAT_WARM ? 'warm' : 'cool';
}

/** Wypełnienie i-tego segmentu (0–1) dla stosunku zdrowia 0–1. */
export function segmentFill(ratio: number, index: number): number {
  return Math.min(1, Math.max(0, ratio * HEALTH_SEGMENTS - index));
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

const ratioOf = (current: number, max: number): number =>
  max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;

function createBar(kind: 'energy' | 'stamina' | 'heat') {
  const node = element('div', `hud__meter hud__meter--${kind}`);
  const value = element('span', 'hud__value', text.empty);
  const track = element('div', 'hud__track');
  const fill = element('div', 'hud__fill');
  fill.style.setProperty('--p', '0');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', text[kind]);
  track.setAttribute('aria-valuetext', text.empty);
  track.append(fill);
  node.append(element('span', 'hud__meter-label', text[kind]), track, value);
  let lastCurrent: number | undefined;
  let lastMax: number | undefined;
  let lastP = '0';
  return {
    node,
    value,
    fill,
    pulse(): void {
      node.dataset.change = node.dataset.change === 'a' ? 'b' : 'a';
    },
    /** Zwraca stosunek 0–1 przy zmianie, inaczej undefined. */
    update(current: number, max: number): number | undefined {
      if (current === lastCurrent && max === lastMax) return undefined;
      if (
        lastCurrent !== undefined &&
        ((kind === 'energy' && current > lastCurrent) ||
          (kind === 'stamina' && current <= 0 && lastCurrent > 0))
      )
        node.dataset.change = node.dataset.change === 'a' ? 'b' : 'a';
      lastCurrent = current;
      lastMax = max;
      const ratio = ratioOf(current, max);
      const p = ratio.toFixed(3);
      if (p !== lastP) {
        fill.style.setProperty('--p', p);
        lastP = p;
      }
      const content = `${Math.round(current)} / ${Math.round(max)}`;
      setText(value, content);
      if (track.getAttribute('aria-valuetext') !== content)
        track.setAttribute('aria-valuetext', content);
      return ratio;
    },
  };
}

function createHealth() {
  const node = element('div', 'hud__meter hud__meter--health');
  const track = element('div', 'hud__segments');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', text.health);
  track.setAttribute('aria-valuetext', text.empty);
  const fills: HTMLElement[] = [];
  const ghosts: HTMLElement[] = [];
  const shown: string[] = [];
  for (let i = 0; i < HEALTH_SEGMENTS; i++) {
    const seg = element('span', 'hud__seg');
    const ghost = element('span', 'hud__seg-ghost');
    const fill = element('span', 'hud__seg-fill');
    fill.dataset.fill = '0';
    seg.append(ghost, fill);
    track.append(seg);
    fills.push(fill);
    ghosts.push(ghost);
    shown.push('0');
  }
  const value = element('span', 'hud__value', text.empty);
  node.append(element('span', 'hud__meter-label', text.health), track, value);
  let lastCurrent: number | undefined;
  let lastMax: number | undefined;
  return {
    node,
    value,
    update(current: number, max: number): number | undefined {
      if (current === lastCurrent && max === lastMax) return undefined;
      if (lastCurrent !== undefined && current < lastCurrent)
        node.dataset.change = node.dataset.change === 'a' ? 'b' : 'a';
      lastCurrent = current;
      lastMax = max;
      const ratio = ratioOf(current, max);
      for (let i = 0; i < HEALTH_SEGMENTS; i++) {
        const f = segmentFill(ratio, i).toFixed(2);
        if (f === shown[i]) continue;
        shown[i] = f;
        const fill = fills[i];
        const ghost = ghosts[i];
        if (!fill || !ghost) continue;
        fill.dataset.fill = f;
        fill.style.setProperty('--f', f);
        ghost.style.setProperty('--f', f);
      }
      const content = `${Math.round(current)} / ${Math.round(max)}`;
      setText(value, content);
      track.setAttribute('aria-valuetext', content);
      return ratio;
    },
  };
}

/** Element pokazywany animacją jednorazową; koniec animacji ukrywa go, kolejne show() restartuje. */
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
  private readonly changeBuildButton = element(
    'button',
    'hud__retry hud__change-build',
    text.changeBuild,
  );
  private readonly death = element('section', 'hud__death');
  private readonly denial = createFlash('hud__denial');
  private readonly damage = createFlash('hud__damage');
  private readonly lowHealth = element('div', 'hud__lowhp');
  private readonly damageDir = createFlash('hud__dmgdir');
  private readonly hitMarker = createFlash('hud__hitmarker');
  private readonly banner = createFlash('hud__banner');
  private readonly toast = createFlash('hud__toast');
  private readonly blade = element('div', 'hud__blade', text.bladeInFlight);
  private readonly crosshairTicks = element('div', 'hud__crosshair-ticks');
  private crosshair: HTMLElement | null = null;
  private aim = 0;
  private readonly executeHint = element(
    'div',
    'hud__execute-hint',
    text.execute,
  );

  setExecuteHint(ready: boolean): void {
    this.executeHint.hidden = !ready;
  }
  private readonly overheat = element('div', 'hud__overheat', text.overheated);
  private readonly weaponName = element('span', 'hud__weapon-name');
  private readonly weapon = element('div', 'hud__weapon');
  private readonly slots = element('div', 'hud__slots');
  private readonly powers = element('div', 'hud__power-list');
  private readonly waveLabel = element('span', 'hud__wave-label');
  private readonly waveLeft = element('span', 'hud__wave-left');
  private readonly wave = element('div', 'hud__wave');
  private readonly heat = createBar('heat');
  private powerSlots: {
    id: string;
    cost: number;
    total: number;
    remaining: number;
    cd: string;
    node: HTMLElement;
    value: HTMLElement;
    denial: ReturnType<typeof createFlash>;
  }[] = [];
  private fireAlternate = false;
  private energy = 0;
  private jammed = false;
  private remaining = 0;
  private slotCount = 0;
  private activeSlot = -1;
  private damageDirection: { x: number; z: number } | null = null;
  private viewYaw = 0;
  private shownAngle = 0;
  private previousFocus: HTMLElement | null = null;
  private readonly runHud: RunHud;
  private disposed = false;

  constructor(
    bus: EventBus,
    private readonly opts: HudOptions,
  ) {
    const health = createHealth();
    const energy = createBar('energy');
    const stamina = createBar('stamina');
    const vitals = element('div', 'hud__vitals');
    const vitalMicro = element(
      'span',
      'hud__micro hud__vital-micro',
      text.microHealth,
    );
    vitals.append(
      vitalMicro,
      health.node,
      element('span', 'hud__micro', text.microEnergy),
      energy.node,
      element('span', 'hud__micro', text.microStamina),
      stamina.node,
    );

    const weapon = this.weapon;
    const weaponHead = element('div', 'hud__weapon-head');
    weaponHead.append(this.weaponName, this.slots);
    this.heat.node.dataset.level = 'cool';
    this.overheat.hidden = true;
    this.overheat.dataset.text = text.overheated;
    weapon.append(
      element('span', 'hud__micro', text.microWeapon),
      this.overheat,
      weaponHead,
      this.heat.node,
    );
    const arsenal = element('div', 'hud__arsenal');
    this.powers.setAttribute('aria-label', text.powers);
    this.powers.dataset.micro = text.microPowers;
    arsenal.append(weapon, this.powers);

    const crosshair = element('div', 'hud__crosshair');
    this.crosshair = crosshair;
    this.executeHint.hidden = true;
    this.executeHint.style.cssText =
      'position:absolute;top:calc(50% + 32px);left:50%;transform:translateX(-50%);color:var(--hud-health);font-size:14px;font-weight:600;letter-spacing:0.08em;text-shadow:0 1px 3px #000;white-space:nowrap';
    crosshair.setAttribute('aria-hidden', 'true');
    for (const side of ['up', 'right', 'down', 'left'])
      this.crosshairTicks.append(
        element('span', `hud__tick hud__tick--${side}`),
      );
    crosshair.append(element('span', 'hud__dot'), this.crosshairTicks);
    this.damage.node.setAttribute('aria-hidden', 'true');
    this.damageDir.node.setAttribute('aria-hidden', 'true');
    this.damageDir.node.append(element('span', 'hud__dmgdir-arc'));
    this.hitMarker.node.setAttribute('aria-hidden', 'true');
    this.hitMarker.node.append(
      element('span', 'hud__hit-bar'),
      element('span', 'hud__hit-bar'),
      element('span', 'hud__hit-bar'),
      element('span', 'hud__hit-bar'),
    );
    this.lowHealth.hidden = true;
    this.lowHealth.setAttribute('aria-hidden', 'true');
    this.blade.hidden = true;
    this.denial.node.setAttribute('role', 'status');
    this.banner.node.setAttribute('role', 'status');
    this.toast.node.setAttribute('role', 'status');
    this.wave.setAttribute('role', 'status');
    this.wave.hidden = true;
    this.wave.append(
      element('span', 'hud__micro', text.microWave),
      this.waveLabel,
      this.waveLeft,
    );
    this.death.hidden = true;
    this.death.setAttribute('role', 'dialog');
    this.death.setAttribute('aria-label', text.died);
    this.retryButton.type = 'button';
    this.changeBuildButton.type = 'button';
    const actions = element('div', 'hud__actions');
    actions.append(this.retryButton);
    if (opts.onChangeBuild) actions.append(this.changeBuildButton);
    this.death.append(element('h1', 'hud__death-title', text.died), actions);
    this.runHud = new RunHud(bus, opts.run);
    this.root.append(
      this.runHud.node,
      this.lowHealth,
      this.damage.node,
      this.damageDir.node,
      vitals,
      arsenal,
      crosshair,
      this.executeHint,
      this.hitMarker.node,
      this.denial.node,
      this.blade,
      this.wave,
      this.banner.node,
      this.toast.node,
      this.death,
    );
    (opts.root ?? document.body).append(this.root);
    this.refreshFlashes();
    this.setLoadout(opts.loadout ?? { weapons: [], powers: [] });
    this.retryButton.addEventListener('click', this.retry);
    this.changeBuildButton.addEventListener('click', this.changeBuild);
    window.addEventListener('keydown', this.onKeyDown, true);
    this.crosshairTicks.addEventListener('animationend', this.endFire);
    let overheated = false;
    this.unsubscribe = [
      bus.on('health_changed', ({ id, current, max }) => {
        if (id !== opts.playerId) return;
        const ratio = health.update(current, max);
        if (ratio === undefined) return;
        const low = current > 0 && ratio <= LOW_HEALTH;
        setText(vitalMicro, low ? text.microCritical : text.microHealth);
        if (this.lowHealth.hidden === low) this.lowHealth.hidden = !low;
      }),
      bus.on('energy_changed', ({ id, current, max }) => {
        if (id !== opts.playerId) return;
        energy.update(current, max);
        if (current !== this.energy) {
          this.energy = current;
          this.refreshDim();
        }
      }),
      bus.on('stamina_changed', ({ id, current, max }) => {
        if (id === opts.playerId) stamina.update(current, max);
      }),
      bus.on('stamina_denied', ({ user }) => {
        if (user !== opts.playerId) return;
        stamina.pulse();
        setText(this.denial.node, text.noStamina);
        this.denial.show();
      }),
      bus.on('heat_changed', ({ id, current, max, overheated: next }) => {
        if (id !== opts.playerId) return;
        const ratio = this.heat.update(current, max);
        if (ratio !== undefined) {
          const level = heatLevel(ratio);
          if (this.heat.node.dataset.level !== level)
            this.heat.node.dataset.level = level;
        }
        if (overheated !== next) {
          overheated = next;
          this.heat.node.classList.toggle('hud__meter--overheated', next);
          this.overheat.hidden = !next;
        }
      }),
      bus.on('held_item_changed', ({ owner, held }) => {
        if (owner !== opts.playerId) return;
        this.weapon.classList.toggle('hud__weapon--inactive', held === 'blade');
      }),
      bus.on('weapon_switched', ({ owner, weapon, slot }) => {
        if (owner !== opts.playerId) return;
        setText(
          this.weaponName,
          weaponDefinitions.get(weapon)?.name ?? text.empty,
        );
        this.setActiveSlot(slot);
      }),
      bus.on('weapon_fired', ({ owner }) => {
        if (owner !== opts.playerId) return;
        this.fireAlternate = !this.fireAlternate;
        this.crosshairTicks.classList.toggle(
          'hud__flash--alternate',
          this.fireAlternate,
        );
        this.crosshairTicks.classList.add('hud__crosshair-ticks--fire');
      }),
      bus.on('power_cooldown', ({ user, power, cooldownS }) => {
        if (user !== opts.playerId) return;
        for (const slot of this.powerSlots) {
          if (slot.id !== power) continue;
          slot.remaining = cooldownS;
          slot.total = cooldownS;
          this.showCooldown(slot);
        }
      }),
      // F2-09: Chwyt nie ma odnowienia w trakcie trzymania; odnowienie pokaże power_cooldown po puszczeniu.
      bus.on('power_used', ({ user, power }) => {
        if (user !== opts.playerId) return;
        if (powerDefinitions.get(power)?.kind !== 'grab') return;
        for (const slot of this.powerSlots) {
          if (slot.id !== power) continue;
          slot.remaining = 0;
          this.setCooldownFill(slot, 0);
          setText(slot.value, text.holding);
        }
      }),
      bus.on('power_denied', ({ user, power, reason }) => {
        if (user !== opts.playerId) return;
        setText(
          this.denial.node,
          {
            no_energy: text.noEnergy,
            cooldown: text.cooldown,
            jammed: text.jammed,
            too_heavy: text.tooHeavy,
            out_of_range: text.outOfRange,
          }[reason],
        );
        this.denial.show();
        for (const slot of this.powerSlots)
          if (slot.id === power) slot.denial.show();
      }),
      bus.on('status_applied', ({ target, status }) => {
        if (target === opts.playerId && status === 'jammed')
          this.setJammed(true);
      }),
      bus.on('status_expired', ({ target, status }) => {
        if (target === opts.playerId && status === 'jammed')
          this.setJammed(false);
      }),
      bus.on('damage_dealt', ({ source, target, amount, dir, killed }) => {
        if (!(amount > 0)) return;
        if (target === opts.playerId) {
          if (loadSettings().flashes) this.damage.show();
          if (dir && source !== opts.playerId) {
            this.damageDirection = { x: dir.x, z: dir.z };
            this.placeDamageDir(true);
            this.damageDir.show();
          }
        } else if (source === opts.playerId) {
          this.hitMarker.node.classList.toggle('hud__hitmarker--kill', killed);
          this.hitMarker.show();
        }
      }),
      bus.on('enemy_killed', () => {
        if (this.remaining > 0) this.setRemaining(this.remaining - 1);
      }),
      bus.on('wave_started', ({ wave: number, count }) => {
        this.wave.hidden = false;
        const total = opts.totalWaves;
        setText(
          this.waveLabel,
          `${text.wave} ${number}${total ? ` / ${total}` : ''}`,
        );
        this.setRemaining(count);
        this.showBanner(`${text.wave} ${number}`, false);
      }),
      bus.on('wave_cleared', () => {
        this.setRemaining(0);
        this.showBanner(text.waveCleared, true);
      }),
      bus.on('synergy_triggered', ({ synergy, user }) => {
        if (user !== opts.playerId) return;
        setText(
          this.toast.node,
          synergyDefinitions.find((def) => def.id === synergy)?.name ?? synergy,
        );
        this.toast.show();
      }),
      bus.on('blade_thrown', ({ owner }) => {
        if (owner === opts.playerId) this.blade.hidden = false;
      }),
      bus.on('blade_returned', ({ owner }) => {
        if (owner === opts.playerId) this.blade.hidden = true;
      }),
      bus.on('player_died', ({ id }) => {
        if (id === opts.playerId) this.setJammed(false);
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
    this.jammed = false;
    for (const slot of this.powerSlots) slot.denial.dispose();
    this.powerSlots = [];
    this.powers.replaceChildren();
    setText(
      this.weaponName,
      weaponDefinitions.get(loadout.weapons[0] ?? '')?.name ?? text.empty,
    );
    this.slotCount = Math.min(loadout.weapons.length, MAX_WEAPON_SLOTS);
    this.slots.replaceChildren();
    for (let i = 0; i < this.slotCount; i++)
      this.slots.append(element('span', 'hud__slot', String(i + 1)));
    this.slots.hidden = this.slotCount <= 1;
    this.activeSlot = -1;
    this.setActiveSlot(0);
    for (const [index, key] of text.powerKeys.entries()) {
      const def = powerDefinitions.get(loadout.powers[index] ?? '');
      const node = element('div', 'hud__power');
      if (!def) node.classList.add('hud__power--empty');
      const value = element('span', 'hud__power-cooldown', '');
      const denial = createFlash('hud__power-denial');
      node.append(
        element('span', 'hud__power-face'),
        element('kbd', 'hud__power-key', key),
        element('span', 'hud__power-name', def?.name ?? text.empty),
        element('span', 'hud__power-jammed', text.jammed),
        value,
        denial.node,
      );
      node.style.setProperty('--cd', '0');
      this.powers.append(node);
      this.powerSlots.push({
        id: def?.id ?? '',
        cost: def?.cost ?? 0,
        total: 0,
        remaining: 0,
        cd: '0',
        node,
        value,
        denial,
      });
    }
    this.refreshDim();
    this.death.hidden = true;
    this.denial.node.hidden = true;
    this.damage.node.hidden = true;
    this.damageDir.node.hidden = true;
    this.hitMarker.node.hidden = true;
    this.banner.node.hidden = true;
    this.toast.node.hidden = true;
    this.blade.hidden = true;
    this.lowHealth.hidden = true;
    this.restoreFocus();
  }

  /** Obrót kamery (rad), by znacznik kierunku obrażeń podążał za widokiem. */
  /** Celowanie 0–1: celownik zwęża się (CSS `--aim`), pełne celowanie dodaje klasę. */
  setAim(aim: number): void {
    if (this.disposed || !this.crosshair) return;
    const k = Math.round(Math.min(1, Math.max(0, aim)) * 100) / 100;
    if (k === this.aim) return;
    this.aim = k;
    this.crosshair.style.setProperty('--aim', String(k));
    this.crosshair.classList.toggle('hud__crosshair--aim', k >= 0.5);
  }

  setViewYaw(yaw: number): void {
    if (this.disposed) return;
    this.refreshFlashes();
    if (yaw === this.viewYaw) return;
    this.viewYaw = yaw;
    if (!this.damageDir.node.hidden) this.placeDamageDir(false);
  }

  /** Czas gracza, także 0 podczas hitstopu; bez odpytywania obiektów symulacji. */
  step(dt: number): void {
    if (this.disposed) return;
    this.refreshFlashes();
    if (!(dt > 0)) return;
    for (const slot of this.powerSlots) {
      if (!(slot.remaining > 0)) continue;
      slot.remaining = Math.max(0, slot.remaining - dt);
      if (slot.remaining < Number.EPSILON * 16) slot.remaining = 0;
      this.showCooldown(slot);
    }
  }

  private refreshFlashes(): void {
    const disabled = !loadSettings().flashes;
    if (this.root.classList.contains('hud--no-flashes') !== disabled)
      this.root.classList.toggle('hud--no-flashes', disabled);
  }

  private placeDamageDir(force: boolean): void {
    if (!this.damageDirection) return;
    const angle = Math.round(
      damageIndicatorAngle(this.damageDirection, this.viewYaw),
    );
    if (!force && angle === this.shownAngle) return;
    this.shownAngle = angle;
    this.damageDir.node.style.setProperty('--angle', `${angle}deg`);
  }

  private setActiveSlot(slot: number): void {
    if (slot === this.activeSlot) return;
    this.activeSlot = slot;
    [...this.slots.children].forEach((child, index) =>
      child.classList.toggle('hud__slot--active', index === slot),
    );
  }

  private setRemaining(count: number): void {
    this.remaining = count;
    setText(this.waveLeft, `${text.enemiesLeft} ${count}`);
  }

  private showBanner(content: string, clear: boolean): void {
    setText(this.banner.node, content);
    this.banner.node.classList.toggle('hud__banner--clear', clear);
    this.banner.show();
  }

  private setJammed(active: boolean): void {
    this.jammed = active;
    this.refreshDim();
  }

  private refreshDim(): void {
    for (const slot of this.powerSlots) {
      const dim = slot.id !== '' && (this.jammed || this.energy < slot.cost);
      slot.node.classList.toggle(
        'hud__power--jammed',
        this.jammed && slot.id !== '',
      );
      if (slot.node.classList.contains('hud__power--dim') !== dim)
        slot.node.classList.toggle('hud__power--dim', dim);
    }
  }

  private setCooldownFill(
    slot: (typeof this.powerSlots)[number],
    fraction: number,
  ): void {
    const cd = fraction.toFixed(2);
    if (cd === slot.cd) return;
    slot.cd = cd;
    slot.node.style.setProperty('--cd', cd);
  }

  private showCooldown(slot: (typeof this.powerSlots)[number]): void {
    setText(
      slot.value,
      slot.remaining > 0 ? `${slot.remaining.toFixed(1)} ${text.seconds}` : '',
    );
    this.setCooldownFill(
      slot,
      slot.remaining > 0 && slot.total > 0
        ? Math.min(1, slot.remaining / slot.total)
        : 0,
    );
  }

  private readonly endFire = (event: AnimationEvent): void => {
    if (event.target === this.crosshairTicks)
      this.crosshairTicks.classList.remove('hud__crosshair-ticks--fire');
  };

  private readonly retry = (): void => {
    if (this.disposed || this.death.hidden) return;
    this.death.hidden = true;
    this.restoreFocus();
    this.opts.onRetry?.();
  };

  private readonly changeBuild = (): void => {
    if (this.disposed || this.death.hidden) return;
    this.death.hidden = true;
    this.previousFocus = null;
    this.changeBuildButton.blur();
    this.opts.onChangeBuild?.();
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
    this.executeHint.remove();
    if (this.disposed) return;
    this.disposed = true;
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    window.removeEventListener('keydown', this.onKeyDown, true);
    this.retryButton.removeEventListener('click', this.retry);
    this.changeBuildButton.removeEventListener('click', this.changeBuild);
    this.crosshairTicks.removeEventListener('animationend', this.endFire);
    this.runHud.dispose();
    this.denial.dispose();
    this.damage.dispose();
    this.damageDir.dispose();
    this.hitMarker.dispose();
    this.banner.dispose();
    this.toast.dispose();
    for (const slot of this.powerSlots) slot.denial.dispose();
    this.restoreFocus();
    this.root.remove();
  }
}
