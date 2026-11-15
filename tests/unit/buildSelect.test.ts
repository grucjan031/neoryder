// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import data from '../../src/data/ui/buildSelect.pl.json';
import { BuildSelect, buildOptions } from '../../src/ui/buildSelect';

afterEach(() => {
  document.body.replaceChildren();
});

it('dane ekranu: trzy czyste buildy i trzy hybrydy, każda z aktywną synergią', () => {
  const { options } = buildOptions(data);
  const clean = options.filter((o) => !o.hybrid);
  const hybrids = options.filter((o) => o.hybrid);
  expect(clean.map((o) => o.id)).toEqual(['blade', 'resonance', 'gunner']);
  expect(hybrids.map((o) => o.id)).toEqual([
    'bladeDancer',
    'resonancePistolero',
    'stormGunner',
  ]);
  for (const option of clean) expect(option.synergies).toEqual([]);
  for (const option of hybrids)
    expect(option.synergies.length).toBeGreaterThan(0);
  expect(options.find((o) => o.id === 'bladeDancer')!.synergies).toEqual([
    'Tancerz ostrzy',
    'Rygiel',
    'Iskrowy rozłam',
  ]);
  for (const option of options) {
    expect(option.weapons.length).toBeGreaterThan(0);
    expect(option.powers.length).toBeGreaterThan(0);
  }
});

it('odrzuca nieznany i powtórzony ekwipunek', () => {
  const build = (id: string) => ({ id, description: 'x' });
  expect(() =>
    buildOptions({ ...data, builds: [build('blade'), build('nieMa')] }),
  ).toThrow(/nieznany ekwipunek nieMa/);
  expect(() =>
    buildOptions({ ...data, builds: [build('blade'), build('blade')] }),
  ).toThrow(/powtórzony ekwipunek blade/);
});

it('ekran: pokazanie ustawia fokus na pierwszej karcie, wybór chowa ekran raz', () => {
  const onSelect = vi.fn();
  const screen = new BuildSelect({ onSelect });
  const root = document.querySelector<HTMLElement>('.build-select')!;
  expect(root.hidden).toBe(true);
  screen.show();
  expect(screen.visible).toBe(true);
  const first = document.activeElement as HTMLButtonElement;
  expect(first.dataset.loadout).toBe('blade');
  expect(first.getAttribute('aria-labelledby')).toBe('build-select-blade-name');
  const gunner = document.querySelector<HTMLButtonElement>(
    '[data-loadout="gunner"]',
  )!;
  gunner.click();
  gunner.click();
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('gunner');
  expect(root.hidden).toBe(true);
  screen.dispose();
  expect(document.querySelector('.build-select')).toBeNull();
});

it('rząd „Ostrze:” z trzema wariantami; wybór wariantu trafia do onSelect', () => {
  const onSelect = vi.fn();
  const screen = new BuildSelect({ onSelect });
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-blade]'),
  ];
  expect(buttons.map((b) => b.dataset.blade)).toEqual([
    'plasmaBlade',
    'twinBlades',
    'staffBlade',
  ]);
  expect(buttons.map((b) => b.querySelector('span')?.textContent)).toEqual([
    'Plazmowe',
    'Bliźniacze',
    'Dwustronne',
  ]);
  expect(
    document.querySelector('.build-select__blades-label')?.textContent,
  ).toBe('Ostrze:');
  // Domyślnie zaznaczone plazmowe, a wybór karty nie nadpisuje ostrza ekwipunku.
  expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual([
    'true',
    'false',
    'false',
  ]);
  screen.show();
  buttons[2]!.click();
  expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual([
    'false',
    'false',
    'true',
  ]);
  document.querySelector<HTMLButtonElement>('[data-loadout="blade"]')!.click();
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('blade', 'staffBlade');
  screen.dispose();
});

it('odrzuca nieznane ostrze w danych ekranu', () => {
  expect(() =>
    buildOptions({
      ...data,
      blade: {
        title: 'Ostrze:',
        options: [{ id: 'nieMa', name: 'X', description: 'x' }],
      },
    }),
  ).toThrow();
});
