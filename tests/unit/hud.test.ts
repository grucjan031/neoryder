// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import {
  Hud,
  HEALTH_SEGMENTS,
  damageIndicatorAngle,
  heatLevel,
  segmentFill,
} from '../../src/ui/hud';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { createPower } from '../../src/combat/powers/registry';
import { PlayerEnergy } from '../../src/combat/powers/energy';
import { DamageSystem } from '../../src/combat/damage';
import { EntityRegistry } from '../../src/core/entities';
import { SIM_DT } from '../../src/core/loop';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';

describe('Hud', () => {
  it('shows jammed only for player power slots and clears on expiry and reset', () => {
    const loadout = { weapons: ['rifle'], powers: ['push', 'chain'] };
    hud.setLoadout(loadout);
    bus.emit('energy_changed', { id: 1, current: 100, max: 100 });
    const apply = (target: number) =>
      bus.emit('status_applied', {
        target,
        status: 'jammed',
        source: 2,
        stacks: 1,
        durationS: 3,
      });
    apply(2);
    expect(root.querySelectorAll('.hud__power--jammed')).toHaveLength(0);
    apply(1);
    expect(root.querySelectorAll('.hud__power--jammed')).toHaveLength(2);
    expect(root.querySelectorAll('.hud__power--dim')).toHaveLength(2);
    expect(query('.hud__power-jammed').textContent).toBe('ZAGŁUSZONE');
    bus.emit('status_expired', { target: 1, status: 'jammed' });
    expect(root.querySelectorAll('.hud__power--jammed')).toHaveLength(0);
    expect(root.querySelectorAll('.hud__power--dim')).toHaveLength(0);
    apply(1);
    hud.setLoadout(loadout);
    expect(root.querySelectorAll('.hud__power--jammed')).toHaveLength(0);
  });
  let bus: EventBus;
  let hud: Hud;
  let root: HTMLElement;
  let onRetry: ReturnType<typeof vi.fn<() => void>>;

  it('dims the weapon for the player blade, restores it for the gun and ignores other owners', () => {
    const weapon = query('.hud__weapon');
    bus.emit('held_item_changed', { owner: 1, held: 'blade', weapon: null });
    expect(weapon.classList.contains('hud__weapon--inactive')).toBe(true);
    bus.emit('held_item_changed', { owner: 2, held: 'gun', weapon: 'rifle' });
    expect(weapon.classList.contains('hud__weapon--inactive')).toBe(true);
    bus.emit('held_item_changed', { owner: 1, held: 'gun', weapon: 'rifle' });
    expect(weapon.classList.contains('hud__weapon--inactive')).toBe(false);
  });

  function query<T extends HTMLElement = HTMLElement>(selector: string): T {
    const node = root.querySelector<T>(selector);
    if (!node) throw new Error(`Brak elementu ${selector}`);
    return node;
  }

  const damage = (target: number, amount = 10): void => {
    bus.emit('damage_dealt', {
      source: 2,
      target,
      amount,
      tags: [],
      point: null,
      dir: null,
      knockback: 0,
      killed: false,
    });
  };

  beforeEach(() => {
    bus = new EventBus();
    root = document.createElement('main');
    document.body.append(root);
    onRetry = vi.fn();
    hud = new Hud(bus, { playerId: 1, root, onRetry });
  });

  afterEach(() => {
    hud.dispose();
    root.remove();
    vi.restoreAllMocks();
  });

  it('błyska przy utracie zdrowia i odzyskaniu energii, bez ponawiania dla tego samego stanu', () => {
    const health = query('.hud__meter--health');
    const energy = query('.hud__meter--energy');
    bus.emit('health_changed', { id: 1, current: 100, max: 100 });
    bus.emit('energy_changed', { id: 1, current: 50, max: 100 });
    expect(health.dataset.change).toBeUndefined();
    expect(energy.dataset.change).toBeUndefined();
    bus.emit('health_changed', { id: 2, current: 10, max: 100 });
    expect(health.dataset.change).toBeUndefined();
    bus.emit('health_changed', { id: 1, current: 80, max: 100 });
    expect(health.dataset.change).toBe('a');
    bus.emit('health_changed', { id: 1, current: 80, max: 100 });
    bus.emit('health_changed', { id: 1, current: 90, max: 100 });
    expect(health.dataset.change).toBe('a');
    bus.emit('health_changed', { id: 1, current: 70, max: 100 });
    expect(health.dataset.change).toBe('b');
    bus.emit('energy_changed', { id: 1, current: 25, max: 100 });
    expect(energy.dataset.change).toBeUndefined();
    bus.emit('energy_changed', { id: 1, current: 75, max: 100 });
    expect(energy.dataset.change).toBe('a');
    bus.emit('energy_changed', { id: 1, current: 75, max: 100 });
    expect(energy.dataset.change).toBe('a');
    bus.emit('energy_changed', { id: 1, current: 100, max: 100 });
    expect(energy.dataset.change).toBe('b');
  });

  it.each(['energy', 'stamina', 'heat'] as const)(
    'aktualizuje pasek %s i pomija identyczny stan',
    (kind) => {
      const update = (current: number, max: number): void => {
        const payload = { id: 1, current, max };
        if (kind === 'heat')
          bus.emit('heat_changed', { ...payload, overheated: false });
        else if (kind === 'stamina') bus.emit('stamina_changed', payload);
        else bus.emit('energy_changed', payload);
      };
      update(25, 100);
      const meter = query(`.hud__meter--${kind}`);
      const fill = query(`.hud__meter--${kind} .hud__fill`);
      const value = query(`.hud__meter--${kind} .hud__value`);
      const p = () => fill.style.getPropertyValue('--p');
      expect(p()).toBe('0.250');
      expect(value.textContent).toBe('25 / 100');
      const observer = new MutationObserver(() => {});
      observer.observe(meter, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
      update(25, 100);
      expect(observer.takeRecords()).toHaveLength(0);
      update(25.1, 100.4);
      expect(value.textContent).toBe('25 / 100');
      update(50, 100);
      expect(p()).toBe('0.500');
      update(1, 0);
      expect(p()).toBe('0.000');
      update(-5, 100);
      expect(p()).toBe('0.000');
      update(150, 100);
      expect(p()).toBe('1.000');
      observer.disconnect();
    },
  );

  it('pokazuje wytrzymałość pod energią, filtruje gracza i pulsuje przy zerze oraz odmowie', () => {
    const meter = query('.hud__meter--stamina');
    const value = query('.hud__meter--stamina .hud__value');
    const energy = query('.hud__meter--energy');
    expect(energy.nextElementSibling?.textContent).toBe('MOB // WYTRZYMAŁOŚĆ');
    expect(energy.nextElementSibling?.nextElementSibling).toBe(meter);
    bus.emit('stamina_changed', { id: 2, current: 40, max: 100 });
    expect(value.textContent).toBe('—');
    bus.emit('stamina_changed', { id: 1, current: 100, max: 100 });
    bus.emit('stamina_changed', { id: 1, current: 0, max: 100 });
    expect(value.textContent).toBe('0 / 100');
    expect(meter.dataset.change).toBe('a');
    bus.emit('stamina_changed', { id: 1, current: 0, max: 100 });
    expect(meter.dataset.change).toBe('a');
    bus.emit('stamina_denied', { user: 2, action: 'dash' });
    expect(query('.hud__denial').hidden).toBe(true);
    bus.emit('stamina_denied', { user: 1, action: 'dash' });
    expect(meter.dataset.change).toBe('b');
    expect(query('.hud__denial').hidden).toBe(false);
    expect(query('.hud__denial').textContent).toBe('Brak wytrzymałości');
    query('.hud__denial').dispatchEvent(new Event('animationend'));
    expect(query('.hud__denial').hidden).toBe(true);
    bus.emit('stamina_denied', { user: 1, action: 'doubleJump' });
    expect(meter.dataset.change).toBe('a');
    expect(query('.hud__denial').hidden).toBe(false);
  });

  it('zdrowie rysuje 10 segmentów i obcina wartości', () => {
    const fills = () =>
      [...root.querySelectorAll<HTMLElement>('.hud__seg-fill')].map((n) =>
        Number(n.dataset.fill),
      );
    expect(fills()).toHaveLength(HEALTH_SEGMENTS);
    bus.emit('health_changed', { id: 1, current: 25, max: 100 });
    expect(fills()).toEqual([1, 1, 0.5, 0, 0, 0, 0, 0, 0, 0]);
    expect(query('.hud__meter--health .hud__value').textContent).toBe(
      '25 / 100',
    );
    bus.emit('health_changed', { id: 1, current: 100, max: 100 });
    expect(fills().every((f) => f === 1)).toBe(true);
    bus.emit('health_changed', { id: 1, current: -3, max: 100 });
    expect(fills().every((f) => f === 0)).toBe(true);
    expect(segmentFill(0.95, 9)).toBeCloseTo(0.5);
  });

  it('duch utraconego zdrowia ma własną wartość segmentu (znika z opóźnieniem w CSS)', () => {
    bus.emit('health_changed', { id: 1, current: 100, max: 100 });
    bus.emit('health_changed', { id: 1, current: 50, max: 100 });
    const seg = query('.hud__seg:nth-child(10)');
    expect(seg.querySelector<HTMLElement>('.hud__seg-fill')?.dataset.fill).toBe(
      '0.00',
    );
    expect(
      seg
        .querySelector<HTMLElement>('.hud__seg-ghost')
        ?.style.getPropertyValue('--f'),
    ).toBe('0.00');
  });

  it('stan krytyczny obejmuje 30% HP, zmienia mikrotekst i znika po leczeniu lub śmierci', () => {
    const low = query('.hud__lowhp');
    const micro = query('.hud__vital-micro');
    expect(low.hidden).toBe(true);
    expect(micro.textContent).toBe('VIT // SYNC 100%');
    bus.emit('health_changed', { id: 1, current: 31, max: 100 });
    expect(low.hidden).toBe(true);
    bus.emit('health_changed', { id: 1, current: 30, max: 100 });
    expect(low.hidden).toBe(false);
    expect(micro.textContent).toBe('VIT // KRYTYCZNE');
    bus.emit('health_changed', { id: 1, current: 29, max: 100 });
    expect(low.hidden).toBe(false);
    bus.emit('health_changed', { id: 1, current: 60, max: 100 });
    expect(low.hidden).toBe(true);
    expect(micro.textContent).toBe('VIT // SYNC 100%');
    bus.emit('health_changed', { id: 1, current: 10, max: 100 });
    bus.emit('health_changed', { id: 1, current: 0, max: 100 });
    expect(low.hidden).toBe(true);
    expect(micro.textContent).toBe('VIT // SYNC 100%');
  });

  it('ignoruje wszystkie zdarzenia dotyczące innej encji', () => {
    const observer = new MutationObserver(() => {});
    observer.observe(root, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    bus.emit('health_changed', { id: 2, current: 0, max: 100 });
    bus.emit('energy_changed', { id: 2, current: 0, max: 100 });
    bus.emit('heat_changed', {
      id: 2,
      current: 100,
      max: 100,
      overheated: true,
    });
    bus.emit('power_denied', { user: 2, power: 'push', reason: 'no_energy' });
    bus.emit('player_died', { id: 2 });
    damage(2);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('stany ciepła i przegrzanie, także bez zmiany liczby', () => {
    const meter = query('.hud__meter--heat');
    const overheat = query('.hud__overheat');
    const heat = (current: number, overheated: boolean) =>
      bus.emit('heat_changed', { id: 1, current, max: 100, overheated });
    expect(overheat.hidden).toBe(true);
    heat(10, false);
    expect(meter.dataset.level).toBe('cool');
    heat(60, false);
    expect(meter.dataset.level).toBe('warm');
    heat(85, false);
    expect(meter.dataset.level).toBe('hot');
    expect(heatLevel(0.5)).toBe('warm');
    heat(30, true);
    expect(meter.classList.contains('hud__meter--overheated')).toBe(true);
    expect(overheat.hidden).toBe(false);
    expect(overheat.textContent).toBe('Przegrzanie');
    hud.setCoolingHint('window');
    expect(overheat.textContent).toBe('[G] Chłodź teraz');
    hud.setCoolingHint('penalty');
    expect(overheat.textContent).toBe('Blokada wydłużona');
    hud.setCoolingHint(undefined);
    expect(overheat.textContent).toBe('Przegrzanie');
    heat(30, false);
    expect(meter.classList.contains('hud__meter--overheated')).toBe(false);
    expect(overheat.hidden).toBe(true);
  });

  it('shows initial data names, event-driven weapon changes and current weapon heat', () => {
    hud.dispose();
    hud = new Hud(bus, {
      playerId: 1,
      root,
      loadout: loadoutDefinitions.get('gunner')!,
    });
    expect(query('.hud__weapon-name').textContent).toBe('Karabin');
    expect(root.querySelectorAll('.hud__power-name')[0]?.textContent).toBe(
      'Pchnięcie Rezonansu',
    );
    expect(root.querySelectorAll('.hud__power-name')[1]?.textContent).toBe('—');
    bus.emit('weapon_switched', { owner: 2, weapon: 'sniper', slot: 2 });
    expect(query('.hud__weapon-name').textContent).toBe('Karabin');
    bus.emit('weapon_switched', { owner: 1, weapon: 'scatter', slot: 1 });
    bus.emit('heat_changed', {
      id: 1,
      current: 28,
      max: 100,
      overheated: false,
    });
    expect(query('.hud__weapon-name').textContent).toBe('Rozpraszacz');
    // Długie jedno słowo: mniejszy krój zamiast łamania „ROZPRASZA / CZ”.
    expect(
      query('.hud__weapon-name').classList.contains('hud__weapon-name--long'),
    ).toBe(true);
    expect(query('.hud__meter--heat .hud__value').textContent).toBe('28 / 100');
    bus.emit('weapon_switched', { owner: 1, weapon: 'rifle', slot: 0 });
    expect(
      query('.hud__weapon-name').classList.contains('hud__weapon-name--long'),
    ).toBe(false);
  });

  it('counts down both data cooldowns from power_cooldown, freezes in hitstop and flashes the denied slot', () => {
    hud.setLoadout({ weapons: [], powers: ['push', 'shockwave'] });
    const slots = root.querySelectorAll<HTMLElement>('.hud__power');
    expect(slots[0]?.querySelector('kbd')?.textContent).toBe('F');
    expect(slots[1]?.querySelector('kbd')?.textContent).toBe('E');
    expect(slots[1]?.querySelector('.hud__power-name')?.textContent).toBe(
      'Fala uderzeniowa',
    );
    const cooldown = (slot: number) =>
      slots[slot]?.querySelector('.hud__power-cooldown')?.textContent;
    bus.emit('power_cooldown', { user: 2, power: 'push', cooldownS: 0.6 });
    bus.emit('power_cooldown', { user: 1, power: 'missing', cooldownS: 1 });
    expect(cooldown(0)).toBe('');
    bus.emit('power_cooldown', { user: 1, power: 'push', cooldownS: 0.6 });
    bus.emit('power_cooldown', { user: 1, power: 'shockwave', cooldownS: 1.5 });
    expect(cooldown(0)).toBe('0.6 s');
    expect(cooldown(1)).toBe('1.5 s');
    hud.step(0);
    expect(cooldown(0)).toBe('0.6 s');
    hud.step(0.2);
    expect(cooldown(0)).toBe('0.4 s');
    expect(cooldown(1)).toBe('1.3 s');
    bus.emit('power_denied', {
      user: 1,
      power: 'shockwave',
      reason: 'cooldown',
    });
    const denied = slots[1]?.querySelector<HTMLElement>('.hud__power-denial');
    expect(denied?.hidden).toBe(false);
    expect(
      slots[0]?.querySelector<HTMLElement>('.hud__power-denial')?.hidden,
    ).toBe(true);
    denied?.dispatchEvent(new Event('animationend'));
    expect(denied?.hidden).toBe(true);
    hud.step(0.4);
    expect(cooldown(0)).toBe('');
    expect(cooldown(1)).toBe('0.9 s');
    hud.step(1);
    expect(cooldown(1)).toBe('');
    bus.emit('power_cooldown', { user: 1, power: 'push', cooldownS: 0.6 });
    expect(cooldown(0)).toBe('0.6 s');
  });

  it('Skupienie rozpoczyna odnowienie HUD od końca mocy, nie od power_used', () => {
    hud.setLoadout({ weapons: [], powers: ['focus', 'barrier'] });
    const entities = new EntityRegistry(bus);
    const energy = new PlayerEnergy(
      1,
      new Stats({ maxEnergy: 100, energyRegen: 0 }),
      bus,
      tuning,
    );
    const power = createPower('focus', {
      owner: 1,
      bus,
      tuning,
      energy,
      damage: new DamageSystem(bus, entities),
      aim: () => ({ origin: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 } }),
      targets: () => [],
      castWall: () => null,
    });
    try {
      power.step(SIM_DT, { pressed: true, held: true, released: false });
      hud.step(1);
      expect(query('.hud__power-cooldown').textContent).toBe('');
      power.step(power.def.kind === 'focus' ? power.def.durationS : 0, {
        pressed: false,
        held: false,
        released: false,
      });
      expect(query('.hud__power-cooldown').textContent).toBe('4.0 s');
      hud.step(0);
      expect(query('.hud__power-cooldown').textContent).toBe('4.0 s');
      hud.step(1);
      expect(query('.hud__power-cooldown').textContent).toBe('3.0 s');
    } finally {
      power.reset();
      energy.dispose();
    }
  });

  it('resets cooldowns and the death dialog with new loadout data and disposes countdown events', () => {
    hud.setLoadout({ weapons: [], powers: ['push', 'shockwave'] });
    bus.emit('power_cooldown', { user: 1, power: 'shockwave', cooldownS: 1.5 });
    bus.emit('player_died', { id: 1 });
    hud.setLoadout(loadoutDefinitions.get('blade')!);
    expect(query('[role="dialog"]').hidden).toBe(true);
    expect(query('.hud__weapon-name').textContent).toBe('Pistolet');
    expect(query('.hud__power-cooldown').textContent).toBe('');
    bus.emit('power_cooldown', { user: 1, power: 'push', cooldownS: 0.6 });
    const node = query('.hud');
    hud.dispose();
    const observer = new MutationObserver(() => {});
    observer.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    hud.step(1);
    bus.emit('power_cooldown', { user: 1, power: 'push', cooldownS: 0.6 });
    bus.emit('weapon_switched', { owner: 1, weapon: 'sniper', slot: 2 });
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('pokazuje właściwy powód odmowy i restartuje animację', () => {
    const denial = query('.hud__denial');
    bus.emit('power_denied', { user: 1, power: 'push', reason: 'no_energy' });
    expect(denial.hidden).toBe(false);
    expect(denial.textContent).toBe('Brak energii');
    const previousClass = denial.className;
    bus.emit('power_denied', { user: 1, power: 'push', reason: 'no_energy' });
    expect(denial.className).not.toBe(previousClass);
    bus.emit('power_denied', { user: 1, power: 'push', reason: 'cooldown' });
    expect(denial.textContent).toBe('Odnowienie');
    denial.dispatchEvent(new Event('animationend'));
    expect(denial.hidden).toBe(true);
  });

  it('pokazuje winietę tylko dla dodatnich obrażeń gracza i wygasza ją', () => {
    const vignette = query('.hud__damage');
    damage(1, 0);
    expect(vignette.hidden).toBe(true);
    damage(1);
    expect(vignette.hidden).toBe(false);
    const previousClass = vignette.className;
    damage(1);
    expect(vignette.className).not.toBe(previousClass);
    vignette.dispatchEvent(new Event('animationend'));
    expect(vignette.hidden).toBe(true);
  });

  it('wyświetla falę, licznik wrogów i baner; pomija zapis tego samego tekstu', () => {
    const wave = query('.hud__wave');
    expect(wave.hidden).toBe(true);
    bus.emit('wave_started', { wave: 3, count: 2 });
    const label = query('.hud__wave-label');
    expect(label.textContent).toBe('Fala 3');
    expect(query('.hud__wave-left').textContent).toBe('Wrogowie 2');
    const banner = query('.hud__banner');
    expect(banner.hidden).toBe(false);
    expect(banner.textContent).toBe('Fala 3');
    expect(banner.classList.contains('hud__banner--clear')).toBe(false);
    banner.dispatchEvent(new Event('animationend'));
    expect(banner.hidden).toBe(true);
    const spy = vi.spyOn(label, 'textContent', 'set');
    bus.emit('wave_started', { wave: 3, count: 2 });
    expect(spy).not.toHaveBeenCalled();
    bus.emit('enemy_killed', { id: 9, killer: 1, tags: [] });
    expect(query('.hud__wave-left').textContent).toBe('Wrogowie 1');
    bus.emit('enemy_killed', { id: 10, killer: 1, tags: [] });
    bus.emit('enemy_killed', { id: 11, killer: 1, tags: [] });
    expect(query('.hud__wave-left').textContent).toBe('Wrogowie 0');
    bus.emit('wave_cleared', { wave: 3 });
    expect(banner.hidden).toBe(false);
    expect(banner.textContent).toBe('Fala czysta');
    expect(banner.classList.contains('hud__banner--clear')).toBe(true);
  });

  it('pokazuje numer fali z sumą, gdy scena poda totalWaves', () => {
    hud.dispose();
    hud = new Hud(bus, { playerId: 1, root, totalWaves: 12 });
    bus.emit('wave_started', { wave: 3, count: 5 });
    expect(query('.hud__wave-label').textContent).toBe('Fala 3 / 12');
  });

  it('znacznik trafienia: kill wyróżniony, obrażenia 0 i cudze pomijane', () => {
    const marker = query('.hud__hitmarker');
    const hit = (
      source: number,
      target: number,
      amount: number,
      killed: boolean,
    ) =>
      bus.emit('damage_dealt', {
        source,
        target,
        amount,
        tags: [],
        point: null,
        dir: null,
        knockback: 0,
        killed,
      });
    hit(1, 5, 0, false);
    hit(2, 5, 10, false);
    expect(marker.hidden).toBe(true);
    hit(1, 5, 10, false);
    expect(marker.hidden).toBe(false);
    expect(marker.classList.contains('hud__hitmarker--kill')).toBe(false);
    hit(1, 5, 10, true);
    expect(marker.classList.contains('hud__hitmarker--kill')).toBe(true);
    marker.dispatchEvent(new Event('animationend'));
    expect(marker.hidden).toBe(true);
    hit(1, 5, 10, false);
    expect(marker.classList.contains('hud__hitmarker--kill')).toBe(false);
  });

  it('celownik rozszerza się przy strzale gracza', () => {
    const ticks = query('.hud__crosshair-ticks');
    bus.emit('weapon_fired', { weapon: 'rifle', owner: 2 });
    expect(ticks.classList.contains('hud__crosshair-ticks--fire')).toBe(false);
    bus.emit('weapon_fired', { weapon: 'rifle', owner: 1 });
    expect(ticks.classList.contains('hud__crosshair-ticks--fire')).toBe(true);
    ticks.dispatchEvent(new Event('animationend'));
    expect(ticks.classList.contains('hud__crosshair-ticks--fire')).toBe(false);
  });

  it.each([
    [{ x: 0, z: 1 }, 0, 0],
    [{ x: -1, z: 0 }, 0, 90],
    [{ x: 1, z: 0 }, 0, -90],
    [{ x: 0, z: 1 }, Math.PI / 2, 90],
    [{ x: 1, z: 0 }, Math.PI / 2, 0],
  ])('kierunek obrażeń dir=%j yaw=%d daje %d stopni', (dir, yaw, expected) => {
    expect(damageIndicatorAngle(dir, yaw)).toBeCloseTo(expected);
  });

  it('kierunek obrażeń z tyłu daje 180 stopni', () => {
    expect(Math.abs(damageIndicatorAngle({ x: 0, z: -1 }, 0))).toBeCloseTo(180);
  });

  it('wskaźnik kierunku obrażeń podąża za obrotem kamery i pomija obrażenia własne oraz bez kierunku', () => {
    const indicator = query('.hud__dmgdir');
    const hurt = (
      source: number,
      dir: { x: number; y: number; z: number } | null,
    ) =>
      bus.emit('damage_dealt', {
        source,
        target: 1,
        amount: 5,
        tags: [],
        point: null,
        dir,
        knockback: 0,
        killed: false,
      });
    hurt(2, null);
    hurt(1, { x: 0, y: 0, z: 1 });
    expect(indicator.hidden).toBe(true);
    hurt(2, { x: -1, y: 0, z: 0 });
    expect(indicator.hidden).toBe(false);
    expect(indicator.style.getPropertyValue('--angle')).toBe('90deg');
    hud.setViewYaw(Math.PI / 2);
    expect(indicator.style.getPropertyValue('--angle')).toBe('180deg');
  });

  it('moc bez energii jest przygaszona, odliczanie ustawia radialny postęp', () => {
    hud.setLoadout(loadoutDefinitions.get('resonance')!);
    const slots = root.querySelectorAll<HTMLElement>('.hud__power');
    expect(slots[0]?.classList.contains('hud__power--dim')).toBe(true);
    bus.emit('energy_changed', { id: 1, current: 100, max: 100 });
    expect(slots[0]?.classList.contains('hud__power--dim')).toBe(false);
    bus.emit('energy_changed', { id: 1, current: 5, max: 100 });
    expect(slots[0]?.classList.contains('hud__power--dim')).toBe(true);
    bus.emit('power_cooldown', { user: 1, power: 'chain', cooldownS: 2 });
    expect(slots[0]?.style.getPropertyValue('--cd')).toBe('1.00');
    hud.step(1);
    expect(slots[0]?.style.getPropertyValue('--cd')).toBe('0.50');
    hud.step(1);
    expect(slots[0]?.style.getPropertyValue('--cd')).toBe('0.00');
  });

  it('wskaźnik slotów broni pojawia się tylko przy kilku brońach i podświetla bieżący', () => {
    hud.setLoadout({ weapons: ['rifle'], powers: [] });
    expect(query('.hud__slots').hidden).toBe(true);
    hud.setLoadout({ weapons: ['rifle', 'sniper', 'scatter'], powers: [] });
    const slots = query('.hud__slots');
    expect(slots.hidden).toBe(false);
    const items = () => [...slots.children].map((n) => n.className);
    expect(items()[0]).toContain('hud__slot--active');
    bus.emit('weapon_switched', { owner: 1, weapon: 'sniper', slot: 1 });
    expect(items()[0]).not.toContain('hud__slot--active');
    expect(items()[1]).toContain('hud__slot--active');
  });

  it('toast synergii i wskaźnik ostrza w locie', () => {
    const toast = query('.hud__toast');
    bus.emit('synergy_triggered', { synergy: 'nieistniejaca', user: 2 });
    expect(toast.hidden).toBe(true);
    bus.emit('synergy_triggered', { synergy: 'nieistniejaca', user: 1 });
    expect(toast.hidden).toBe(false);
    expect(toast.textContent).toBe('nieistniejaca');
    const blade = query('.hud__blade');
    expect(blade.hidden).toBe(true);
    bus.emit('blade_thrown', { owner: 1 });
    expect(blade.hidden).toBe(false);
    bus.emit('blade_returned', { owner: 1 });
    expect(blade.hidden).toBe(true);
  });

  it.each(['click', 'Enter', 'r'])(
    'pokazuje dialog, ustawia fokus i ponawia przez %s',
    (action) => {
      const previous = document.createElement('button');
      root.append(previous);
      previous.focus();
      bus.emit('player_died', { id: 1 });
      const dialog = query('[role="dialog"]');
      const retry = query<HTMLButtonElement>('.hud__retry');
      expect(dialog.hidden).toBe(false);
      expect(dialog.getAttribute('aria-label')).toBe('Zginąłeś');
      expect(document.activeElement).toBe(retry);
      bus.emit('player_died', { id: 1 });
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', repeat: true }),
      );
      expect(onRetry).not.toHaveBeenCalled();
      if (action === 'click') retry.click();
      else window.dispatchEvent(new KeyboardEvent('keydown', { key: action }));
      expect(onRetry).toHaveBeenCalledOnce();
      expect(dialog.hidden).toBe(true);
      expect(document.activeElement).toBe(previous);
      retry.click();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(onRetry).toHaveBeenCalledOnce();
    },
  );

  it('działa bez callbacku i domyślnie montuje w body', () => {
    hud.dispose();
    hud = new Hud(bus, { playerId: 1 });
    const node = document.body.querySelector<HTMLElement>('.hud');
    expect(node?.parentElement).toBe(document.body);
    bus.emit('player_died', { id: 1 });
    node?.querySelector<HTMLButtonElement>('button')?.click();
    expect(node?.querySelector<HTMLElement>('[role="dialog"]')?.hidden).toBe(
      true,
    );
  });

  it('dispose usuwa własny DOM, subskrypcje i listenery', () => {
    hud.dispose();
    hud = new Hud(bus, { playerId: 1, root, onRetry });
    const node = query('.hud');
    const retry = query<HTMLButtonElement>('.hud__retry');
    bus.emit('player_died', { id: 1 });
    hud.dispose();
    hud.dispose();
    expect(root.contains(node)).toBe(false);
    const observer = new MutationObserver(() => {});
    observer.observe(node, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    bus.emit('health_changed', { id: 1, current: 1, max: 100 });
    bus.emit('energy_changed', { id: 1, current: 1, max: 100 });
    bus.emit('heat_changed', { id: 1, current: 1, max: 100, overheated: true });
    bus.emit('power_denied', { user: 1, power: 'push', reason: 'no_energy' });
    bus.emit('player_died', { id: 1 });
    bus.emit('wave_started', { wave: 9, count: 1 });
    bus.emit('wave_cleared', { wave: 9 });
    damage(1);
    retry.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    node
      .querySelector('.hud__denial')
      ?.dispatchEvent(new Event('animationend'));
    expect(observer.takeRecords()).toHaveLength(0);
    expect(onRetry).not.toHaveBeenCalled();
    observer.disconnect();
  });
});
