import { test, expect } from '@playwright/test';
import { SIM_TIMEOUT } from './helpers';

const builds = [
  { id: 'blade', name: 'Ostrze', synergies: 0 },
  { id: 'resonance', name: 'Moc', synergies: 0 },
  { id: 'gunner', name: 'Strzelec', synergies: 0 },
  // Tagi presetów: blade + resonance → bladeDancer, parryLock, shockFracture.
  { id: 'bladeDancer', name: 'Tancerz ostrzy', synergies: 3 },
  // resonance + gunner → emberRelay, resonancePistolero, resonanceSiphon, stormGunner.
  { id: 'resonancePistolero', name: 'Pistolero Rezonansu', synergies: 4 },
  { id: 'stormGunner', name: 'Burzowy strzelec', synergies: 4 },
];

for (const build of builds)
  test(`ekran wyboru buildu: ${build.name} startuje arenę`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/?scene=arena&debug=1&seed=build-e2e');
    const q = (name: string) =>
      page.evaluate((n) => window.__neoryder?.query(n), name);
    await expect.poll(() => q('state')).toBe('select');
    await expect(
      page.getByRole('heading', { name: 'Wybierz build' }),
    ).toBeVisible();
    const card = page.getByRole('button', { name: build.name, exact: true });
    await expect(card).toBeVisible();
    await card.click();
    await expect.poll(() => q('state')).toBe('playing');
    expect(await q('loadout')).toBe(build.id);
    expect(await q('synergies')).toHaveLength(build.synergies);
    await expect(card).toBeHidden();
    await expect.poll(() => q('wave'), { timeout: SIM_TIMEOUT }).toBe(1);
    await expect
      .poll(() => q('enemies'), { timeout: SIM_TIMEOUT })
      .toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
