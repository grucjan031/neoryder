// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Hud } from '../../src/ui/hud';

describe('Hud', () => {
  let bus: EventBus;
  let hud: Hud;
  let root: HTMLElement;
  let onRetry: ReturnType<typeof vi.fn<() => void>>;

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

  it.each(['health', 'energy', 'heat'] as const)(
    'aktualizuje pasek %s i pomija identyczny stan',
    (kind) => {
      const update = (current: number, max: number): void => {
        const payload = { id: 1, current, max };
        if (kind === 'heat')
          bus.emit('heat_changed', { ...payload, overheated: false });
        else if (kind === 'health') bus.emit('health_changed', payload);
        else bus.emit('energy_changed', payload);
      };
      update(25, 100);
      const meter = query(`.hud__meter--${kind}`);
      const fill = query(`.hud__meter--${kind} .hud__fill`);
      const value = query(`.hud__meter--${kind} .hud__value`);
      expect(fill.style.width).toBe('25%');
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
      expect(
        observer.takeRecords().some((record) => record.target === value),
      ).toBe(false);
      update(50, 100);
      expect(fill.style.width).toBe('50%');
      expect(value.textContent).toBe('50 / 100');
      update(50, 200);
      expect(fill.style.width).toBe('25%');
      expect(value.textContent).toBe('50 / 200');
      update(1, 0);
      expect(fill.style.width).toBe('0%');
      update(-5, 100);
      expect(fill.style.width).toBe('0%');
      update(150, 100);
      expect(fill.style.width).toBe('100%');
      observer.disconnect();
    },
  );

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

  it('dodaje i zdejmuje przegrzanie, także bez zmiany liczby', () => {
    const meter = query('.hud__meter--heat');
    bus.emit('heat_changed', {
      id: 1,
      current: 30,
      max: 100,
      overheated: true,
    });
    expect(meter.classList.contains('hud__meter--overheated')).toBe(true);
    expect(query('.hud__meter--heat .hud__label').textContent).toBe(
      'Przegrzanie',
    );
    bus.emit('heat_changed', {
      id: 1,
      current: 30,
      max: 100,
      overheated: false,
    });
    expect(meter.classList.contains('hud__meter--overheated')).toBe(false);
    expect(query('.hud__meter--heat .hud__label').textContent).toBe('Ciepło');
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

  it('wyświetla falę i pomija zapis tego samego tekstu', () => {
    bus.emit('wave_started', { wave: 3, count: 5 });
    const wave = query('.hud__wave');
    expect(wave.textContent).toBe('Fala 3');
    const spy = vi.spyOn(wave, 'textContent', 'set');
    bus.emit('wave_started', { wave: 3, count: 4 });
    expect(spy).not.toHaveBeenCalled();
    bus.emit('wave_cleared', { wave: 3 });
    expect(wave.textContent).toBe('Fala wyczyszczona');
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
