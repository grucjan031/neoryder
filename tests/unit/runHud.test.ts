// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Hud } from '../../src/ui/hud';
import { implantBadge } from '../../src/ui/runHud';
import { implantDefinitions } from '../../src/progression/implants';

describe('RunHud', () => {
  let bus: EventBus;
  let hud: Hud;
  let root: HTMLElement;

  const q = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const node = root.querySelector<T>(selector);
    if (!node) throw new Error(`Brak elementu ${selector}`);
    return node;
  };
  const all = (selector: string): HTMLElement[] => [
    ...root.querySelectorAll<HTMLElement>(selector),
  ];
  const credits = (amount: number, delta: number): void =>
    bus.emit('currency_changed', { currency: 'credits', amount, delta });

  beforeEach(() => {
    bus = new EventBus();
    root = document.createElement('main');
    document.body.append(root);
    hud = new Hud(bus, { playerId: 1, root });
  });
  afterEach(() => {
    hud.dispose();
    root.remove();
  });

  it('keeps every run element hidden until its event arrives', () => {
    expect(q('.run-hud__credits').hidden).toBe(true);
    expect(q('.run-hud__implants').hidden).toBe(true);
    expect(q('.run-hud__boss').hidden).toBe(true);
  });

  describe('credits', () => {
    it('appears after the first currency_changed and shows the amount', () => {
      credits(40, 40);
      expect(q('.run-hud__credits').hidden).toBe(false);
      expect(q('.run-hud__credits-value').textContent).toBe('40');
      credits(15, -25);
      expect(q('.run-hud__credits-value').textContent).toBe('15');
    });

    it('animates the delta with sign and kind', () => {
      credits(40, 40);
      const delta = q('.run-hud__credits-delta');
      expect(delta.textContent).toBe('+40');
      expect(delta.dataset.sign).toBe('gain');
      expect(delta.classList.contains('run-hud__credits-delta--show')).toBe(
        true,
      );
      credits(15, -25);
      expect(delta.textContent).toBe('−25');
      expect(delta.dataset.sign).toBe('spend');
    });

    it('is shown at once from the run seed', () => {
      const seeded = new Hud(new EventBus(), {
        playerId: 1,
        root,
        run: { credits: 70, implants: [] },
      });
      const value = all('.run-hud__credits-value').at(-1);
      expect(value?.textContent).toBe('70');
      seeded.dispose();
    });
  });

  describe('implants', () => {
    const first = [...implantDefinitions.values()].find((d) => d.upgradesTo);
    if (!first?.upgradesTo) throw new Error('Brak implantu z upgradesTo');
    const next = implantDefinitions.get(first.upgradesTo);
    if (!next) throw new Error('Brak celu ulepszenia');

    it('adds a badge with rarity and a tooltip with name and description', () => {
      bus.emit('implant_acquired', {
        id: first.id,
        rarity: first.rarity,
        source: 'reward',
      });
      expect(q('.run-hud__implants').hidden).toBe(false);
      const badge = q(`.run-hud__implant[data-implant="${first.id}"]`);
      expect(badge.dataset.rarity).toBe(first.rarity);
      expect(badge.title).toContain(first.name);
      expect(badge.title).toContain(first.description);
      expect(badge.textContent).toBe(implantBadge(first.name));
    });

    it('replaces the previous rarity on upgrade instead of adding a badge', () => {
      bus.emit('implant_acquired', {
        id: first.id,
        rarity: first.rarity,
        source: 'reward',
      });
      bus.emit('implant_acquired', {
        id: next.id,
        rarity: next.rarity,
        source: 'upgrade',
      });
      const badges = all('.run-hud__implant');
      expect(badges).toHaveLength(1);
      expect(badges[0]?.dataset.implant).toBe(next.id);
      expect(badges[0]?.dataset.rarity).toBe(next.rarity);
    });

    it('restores owned implants from the run seed', () => {
      const seeded = new Hud(new EventBus(), {
        playerId: 1,
        root,
        run: { credits: 0, implants: [first.id] },
      });
      expect(all(`.run-hud__implant[data-implant="${first.id}"]`)).toHaveLength(
        1,
      );
      seeded.dispose();
    });
  });

  describe('boss bar', () => {
    const spawn = (): void =>
      bus.emit('boss_spawned', { id: 7, name: 'Strażnik', maxHealth: 400 });
    const fill = (): string =>
      q('.run-hud__boss-fill').style.getPropertyValue('--p');

    it('appears on boss_spawned with name and full bar', () => {
      spawn();
      expect(q('.run-hud__boss').hidden).toBe(false);
      expect(q('.run-hud__boss-name').textContent).toBe('Strażnik');
      expect(fill()).toBe('1');
    });

    it('follows health_changed for the boss only', () => {
      spawn();
      bus.emit('health_changed', { id: 7, current: 100, max: 400 });
      expect(fill()).toBe('0.250');
      bus.emit('health_changed', { id: 1, current: 1, max: 400 });
      expect(fill()).toBe('0.250');
    });

    it('draws phases-1 ticks and animates the phase change', () => {
      spawn();
      expect(all('.run-hud__boss-tick')).toHaveLength(0);
      bus.emit('boss_phase', { id: 7, phase: 1, phases: 3 });
      expect(all('.run-hud__boss-tick')).toHaveLength(2);
      expect(q('.run-hud__boss').dataset.phase).toBe('1');
      expect(
        q('.run-hud__boss').classList.contains('run-hud__boss--phase'),
      ).toBe(true);
    });

    it('hides when the boss dies', () => {
      spawn();
      bus.emit('enemy_killed', { id: 3, killer: 1, tags: [] });
      expect(q('.run-hud__boss').hidden).toBe(false);
      bus.emit('enemy_killed', { id: 7, killer: 1, tags: [] });
      expect(q('.run-hud__boss').hidden).toBe(true);
    });
  });
});
