// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EventBus } from '../../src/core/events';
import { loadSettings } from '../../src/core/save';
import { Hud } from '../../src/ui/hud';

let hud: Hud | undefined;
let previousFlashes: boolean;
const bus = new EventBus();
const style = document.createElement('style');

beforeEach(() => {
  previousFlashes = loadSettings().flashes;
  style.textContent = readFileSync('src/ui/hud.css', 'utf8');
  document.head.append(style);
});

afterEach(() => {
  hud?.dispose();
  hud = undefined;
  loadSettings().flashes = previousFlashes;
  style.remove();
});

function lowHealth(): HTMLElement {
  bus.emit('health_changed', { id: 1, current: 20, max: 100 });
  return document.querySelector<HTMLElement>('.hud__lowhp')!;
}

function expectStatic(vignette: HTMLElement): void {
  expect(vignette.hidden).toBe(false);
  expect(vignette.closest('.hud--no-flashes')).not.toBeNull();
  expect(getComputedStyle(vignette).animation).toBe('none');
  expect(Number(getComputedStyle(vignette).opacity)).toBeCloseTo(0.55);
}

it('flashes=false od początku pozostawia statyczną, łagodną winietę niskiego HP', () => {
  loadSettings().flashes = false;
  hud = new Hud(bus, { playerId: 1 });
  expectStatic(lowHealth());
});

it('zmiana flashes przy już niskim HP działa bez nowego health_changed i upływu symulacji', () => {
  const settings = loadSettings();
  settings.flashes = true;
  hud = new Hud(bus, { playerId: 1 });
  const vignette = lowHealth();
  expect(getComputedStyle(vignette).animation).toContain('hud-pulse');
  settings.flashes = false;
  hud.setViewYaw(0);
  expectStatic(vignette);
  settings.flashes = true;
  hud.step(0);
  expect(vignette.closest('.hud--no-flashes')).toBeNull();
  expect(getComputedStyle(vignette).animation).toContain('hud-pulse');
});
