// @vitest-environment jsdom
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configureFx } from '../../src/render/fxMode';
import { showBootSplash } from '../../src/ui/bootSplash';
import { getSplashes, loadSplashes, pickSplash } from '../../src/ui/splash';
import { HtmlRunScreens } from '../../src/ui/runScreens';
import type { RunScreenView } from '../../src/ui/runScreens';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { roomDefinitions } from '../../src/world/rooms';
import { themeDefinitions } from '../../src/render/themes';

afterEach(() => {
  configureFx(new URLSearchParams());
  document.body.replaceChildren();
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
