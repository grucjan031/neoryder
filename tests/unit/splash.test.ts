// @vitest-environment jsdom
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { getTips, loadTips, pickTip } from '../../src/ui/loadingTips';
import tipData from '../../src/data/ui/loadingTips.pl.json';
import { tuning } from '../../src/core/tuning';
import { createLoadingTip } from '../../src/ui/loadingTipView';
import { readFileSync } from 'node:fs';
import { configureFx } from '../../src/render/fxMode';
import { showBootSplash } from '../../src/ui/bootSplash';
import { getSplashes, loadSplashes, pickSplash } from '../../src/ui/splash';
import { HtmlRunScreens } from '../../src/ui/runScreens';
import type { RunScreenView } from '../../src/ui/runScreens';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { roomDefinitions } from '../../src/world/rooms';
import { themeDefinitions } from '../../src/render/themes';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  configureFx(new URLSearchParams());
  document.body.replaceChildren();
});

it('porady walidują strukturę, rodzaje i etykiety; błąd daje pustą listę', () => {
  expect(getTips()).toHaveLength(40);
  expect(loadTips(tipData)).toEqual(getTips());
  for (const bad of [
    null,
    {},
    { tips: [] },
    { ...tipData, labels: {} },
    { ...tipData, tips: [{ text: 'x', kind: 'other' }] },
    { ...tipData, tips: [{ text: '', kind: 'lore' }] },
  ])
    expect(loadTips(bad)).toEqual([]);
  expect(pickTip('x', [])).toBeNull();
  expect(pickTip('hub:seed')).toEqual(pickTip('hub:seed'));
  expect(
    new Set(
      Array.from({ length: 40 }, (_, i) => pickTip(`run:seed:N${i}`)?.text),
    ).size,
  ).toBeGreaterThan(10);
  for (const tip of getTips()) expect(tip.label).toBe(tipData.labels[tip.kind]);
});

it('sceny splasharów są zarejestrowane (menu oznacza brak parametru sceny)', () => {
  // Odczyt rejestru bez importowania scen i ich zależności WebGL do jsdom.
  const registry = readFileSync(
    resolve(__dirname, '../../src/scenes/index.ts'),
    'utf8',
  );
  const registered = [
    ...registry.matchAll(/^ {2}(?:'([^']+)'|(\w+)): \(\) =>/gm),
  ].map((match) => match[1] ?? match[2]);
  for (const entry of getSplashes())
    for (const scene of entry.scenes ?? [])
      expect(['menu', ...registered], entry.file).toContain(scene);
  for (const scene of ['menu', 'hub', 'arena', 'tutorial']) {
    for (let i = 0; i < 10; i++)
      expect(
        pickSplash(`s${i}`, { scene, room: 'eliteFoundry', theme: 'hideout' })
          ?.scenes,
      ).toContain(scene);
  }
  expect(
    pickSplash('x', { scene: 'unknown', room: 'eliteFoundry' })?.file,
  ).toContain('odlewnia');
});

it('start pokazuje poradę z nagłówkiem, rotuje i usuwa timer przy dismiss', () => {
  vi.useFakeTimers();
  const root = mountBoot();
  const boot = showBootSplash(new URLSearchParams('seed=test'), 'hub');
  const tip = root.querySelector('.loading-tip')!;
  expect(tip.getAttribute('aria-hidden')).toBe('true');
  expect(tip.querySelector('strong')?.textContent).toBe(
    pickTip('hub:test')?.label,
  );
  expect(tip.querySelector('p')?.textContent).toBe(pickTip('hub:test')?.text);
  const before = tip.textContent;
  vi.advanceTimersByTime(tuning.ui.loadingTipS * 1000);
  expect(tip.textContent).not.toBe(before);
  boot.dismiss();
  vi.runAllTimers();
  expect(vi.getTimerCount()).toBe(0);
});

it('run rotuje porady bez restartu przy odświeżeniu, resetuje klucz węzła i czyści timery', () => {
  vi.useFakeTimers();
  const screens = new HtmlRunScreens();
  screens.show(busyView, actions);
  const tip = document.querySelector('.loading-tip')!;
  expect(tip.querySelector('p')?.textContent).toBe(
    pickTip('run:test:L1N1')?.text,
  );
  expect(tip.querySelector('strong')?.textContent).toBe(
    pickTip('run:test:L1N1')?.label,
  );
  const before = tip.textContent;
  vi.advanceTimersByTime(tuning.ui.loadingTipS * 500);
  screens.show(busyView, actions);
  expect(document.querySelector('.loading-tip')).toBe(tip);
  vi.advanceTimersByTime(tuning.ui.loadingTipS * 500);
  expect(tip.textContent).not.toBe(before);
  screens.show(
    { ...busyView, state: { ...busyView.state, currentNodeId: 'L2N2' } },
    actions,
  );
  expect(document.querySelector('.loading-tip p')?.textContent).toBe(
    pickTip('run:test:L2N2')?.text,
  );
  screens.hide();
  expect(vi.getTimerCount()).toBe(0);
  screens.show(busyView, actions);
  screens.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

it('fx=lite nie pokazuje porad, obrazów ani ich timerów na obu nakładkach', () => {
  vi.useFakeTimers();
  const params = new URLSearchParams('debug=1&fx=lite');
  configureFx(params);
  mountBoot();
  const boot = showBootSplash(params, 'hub');
  const screens = new HtmlRunScreens();
  screens.show(busyView, actions);
  expect(document.querySelector('.loading-tip')).toBeNull();
  expect(document.querySelector('img')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  screens.dispose();
  boot.dismiss();
});

it('ograniczony ruch wyłącza animację rotacji, ale zachowuje zmianę porady', () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const tip = createLoadingTip('menu:test');
  const animate = vi.fn();
  tip.root.animate = animate;
  const before = tip.root.textContent;
  vi.advanceTimersByTime(tuning.ui.loadingTipS * 1000);
  expect(tip.root.textContent).not.toBe(before);
  expect(animate).not.toHaveBeenCalled();
  tip.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

it('błąd obrazu sprząta timer porady na obu nakładkach', () => {
  vi.useFakeTimers();
  const root = mountBoot();
  const boot = showBootSplash(new URLSearchParams(), 'hub');
  root.querySelector('img')!.dispatchEvent(new Event('error'));
  expect(root.querySelector('.loading-copy')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  boot.dismiss();
  vi.runAllTimers();
  const screens = new HtmlRunScreens();
  screens.show(busyView, actions);
  document
    .querySelector('.run-screen__splash-img')!
    .dispatchEvent(new Event('error'));
  expect(vi.getTimerCount()).toBe(0);
  screens.dispose();
});

it('lista splasharów odpowiada plikom w public/assets/splash i mieści się w budżecie', () => {
  for (const entry of getSplashes()) {
    const path = resolve(__dirname, '../../public/assets/splash', entry.file);
    expect(existsSync(path), entry.file).toBe(true);
    expect(statSync(path).size, entry.file).toBeLessThanOrEqual(190 * 1024);
  }
});

it('rooms[] i themes[] wskazują istniejące pokoje i motywy', () => {
  for (const entry of getSplashes()) {
    for (const room of entry.rooms ?? [])
      expect(roomDefinitions.has(room), `${entry.file}: pokój ${room}`).toBe(
        true,
      );
    for (const theme of entry.themes ?? [])
      expect(themeDefinitions.has(theme), `${entry.file}: motyw ${theme}`).toBe(
        true,
      );
  }
});

it('schemat odrzuca duplikaty i złe nazwy plików', () => {
  expect(() =>
    loadSplashes([
      { file: 'a.webp', title: 'A' },
      { file: 'a.webp', title: 'B' },
    ]),
  ).toThrow(/Powtórzony/);
  expect(() => loadSplashes([{ file: '../a.png', title: 'A' }])).toThrow();
});

it('wybór jest deterministyczny i respektuje pokój oraz motyw', () => {
  expect(pickSplash('ziarno:L1N1')).toEqual(pickSplash('ziarno:L1N1'));
  expect(pickSplash('x', {}, [])).toBeNull();
  const keys = Array.from({ length: 40 }, (_, i) => `s${i}:N`);
  expect(
    new Set(keys.map((key) => pickSplash(key)!.file)).size,
  ).toBeGreaterThan(10);
  expect(pickSplash('x', { room: 'eliteFoundry' })!.file).toContain('odlewnia');
  for (const key of keys)
    expect(pickSplash(key, { theme: 'hideout' })!.themes).toContain('hideout');
  // Nieznany motyw i pokój: pełna lista.
  expect(pickSplash('x', { theme: 'brak', room: 'brak' })).toEqual(
    pickSplash('x'),
  );
});

const nodes = [
  { id: 'L1N1', index: 0, layer: 1, type: 'combat' as const, next: [] },
];
const busyView: RunScreenView = {
  screen: 'room',
  nodes,
  summary: null,
  busy: true,
  error: null,
  splash: { file: 'splash-06-odlewnia.webp', title: 'Odlewnia' },
  state: {
    seed: 'test',
    sectorId: 'test',
    loadoutId: 'classic',
    loadout: loadoutDefinitions.get('classic')!,
    talents: [],
    threatLevel: 0,
    startedAtMs: 0,
    elapsedS: 0,
    map: { sectorId: 'test', layers: [nodes] },
    currentNodeId: 'L1N1',
    visited: [],
    hp: 100,
    energy: 100,
    credits: 0,
    implants: [],
    stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
  },
};
const actions = { selectNode() {}, next() {}, menu() {} };

it('ekran ładowania pokazuje dekoracyjny splashart, zostawia napis i znika po pokoju', () => {
  const screens = new HtmlRunScreens();
  screens.show(busyView, actions);
  const root = document.querySelector('.run-screen')!;
  const image = root.querySelector<HTMLImageElement>(
    '.run-screen__splash-img',
  )!;
  expect(image.getAttribute('src')).toBe(
    '/assets/splash/splash-06-odlewnia.webp',
  );
  expect(image.alt).toBe('');
  expect(
    root.querySelector('.run-screen__splash')!.getAttribute('aria-hidden'),
  ).toBe('true');
  expect(root.querySelector('.run-screen__splash-title')!.textContent).toBe(
    'Odlewnia',
  );
  expect(root.querySelector('.run-screen__loading')!.textContent).toContain(
    'Ładowanie',
  );
  // Odświeżenie tego samego ekranu nie podmienia obrazu (brak migania i restartu zoomu).
  screens.show(busyView, actions);
  expect(root.querySelector('.run-screen__splash-img')).toBe(image);
  screens.show({ ...busyView, busy: false, splash: undefined }, actions);
  expect(root.querySelector('.run-screen__splash')).toBeNull();
  expect(root.classList.contains('run-screen--splash')).toBe(false);
  screens.dispose();
});

it('błąd ładowania obrazu przywraca ekran bez pustej ramki', () => {
  const screens = new HtmlRunScreens();
  screens.show(busyView, actions);
  const root = document.querySelector('.run-screen')!;
  root
    .querySelector('.run-screen__splash-img')!
    .dispatchEvent(new Event('error'));
  expect(root.querySelector('.run-screen__splash')).toBeNull();
  expect(root.classList.contains('run-screen--splash')).toBe(false);
  expect(root.querySelector('.run-screen__loading')).not.toBeNull();
  screens.dispose();
});

function mountApp(): HTMLElement {
  const node = document.createElement('div');
  node.id = 'app';
  document.body.append(node);
  return node;
}

function mountBoot(): HTMLElement {
  const node = document.createElement('div');
  node.id = 'boot-splash';
  document.body.append(node);
  return node;
}

it('nakładka startowa: obraz poza fx=lite, #app inert do dismiss, potem wygaszenie', () => {
  const root = mountBoot();
  const app = mountApp();
  const boot = showBootSplash(new URLSearchParams('scene=hub'), 'hub');
  expect(app.inert).toBe(true);
  const image = root.querySelector('img')!;
  expect(image.getAttribute('src')).toMatch(/^\/assets\/splash\//);
  expect(image.alt).toBe('');
  boot.dismiss();
  expect(app.inert).toBe(false);
  expect(root.classList.contains('boot-splash--out')).toBe(true);
  boot.dismiss();
});

it('błędne dane splasharów nie blokują startu (pusta lista, brak obrazu)', () => {
  expect(() => loadSplashes([{ file: 'x', title: '' }])).toThrow();
  expect(pickSplash('k', {}, [])).toBeNull();
});

it('stary obraz tła nie zdejmuje nowego po błędzie', () => {
  const screens = new HtmlRunScreens();
  screens.show(busyView, actions);
  const root = document.querySelector('.run-screen')!;
  const oldImage = root.querySelector('.run-screen__splash-img')!;
  screens.show(
    { ...busyView, splash: { file: 'splash-08-bulwar.webp', title: 'Bulwar' } },
    actions,
  );
  expect(root.querySelector('.run-screen__splash-img')).not.toBe(oldImage);
  oldImage.dispatchEvent(new Event('error'));
  expect(root.querySelector('.run-screen__splash')).not.toBeNull();
  screens.dispose();
});

it('nakładka startowa w fx=lite jest samym tłem i znika od razu', () => {
  const params = new URLSearchParams('debug=1&fx=lite');
  configureFx(params);
  const root = mountBoot();
  const app = mountApp();
  const boot = showBootSplash(params, 'run');
  expect(root.querySelector('img')).toBeNull();
  expect(app.inert).toBe(true);
  boot.dismiss();
  expect(app.inert).toBe(false);
  expect(document.getElementById('boot-splash')).toBeNull();
});

it('brak elementu nakładki nie psuje startu', () => {
  expect(() =>
    showBootSplash(new URLSearchParams(), null).dismiss(),
  ).not.toThrow();
});
