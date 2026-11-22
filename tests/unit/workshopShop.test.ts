// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectileSpec } from '../../src/combat/weapons/projectiles';
import { Weapon } from '../../src/combat/weapons/weapon';
import {
  weaponDefinitions,
  weaponSchema,
} from '../../src/combat/weapons/weaponSchema';
import type { WeaponDefinition } from '../../src/combat/weapons/weaponSchema';
import { EventBus } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { MetaManager } from '../../src/progression/meta';
import {
  MODULE_SHAPES_BY_SLOT,
  MODULE_SLOTS,
  moduleDefinitions,
  moduleFitsWeapon,
  moduleLootSchema,
  moduleSchema,
} from '../../src/progression/moduleSchema';
import { moddedWeapon } from '../../src/progression/moddedWeapon';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { unlockDefinitions } from '../../src/progression/unlocksSchema';
import { FppBlaster } from '../../src/render/fppBlaster';
import type { HubPanel } from '../../src/ui/hub/hubPanel';
import { createWorkshopPanel } from '../../src/ui/hub/workshopPanel';
import {
  equipmentState,
  shopCard,
  shopPreview,
  shopRows,
  statLines,
  toggleModuleLoadout,
  weaponSheet,
} from '../../src/ui/hub/workshopState';

const NEW_MODULES = [
  'holo',
  'laser',
  'compensator',
  'foregrip',
  'extendedCell',
  'pulseCell',
] as const;

type Shot = Exclude<WeaponDefinition, { fireMode: 'beam' }>;
const shot = (weaponId: string, modules: string[] = []): Shot => {
  const def = moddedWeapon(weaponId, modules);
  if (!def || def.fireMode === 'beam') throw new Error('Test wymaga pocisków');
  return def;
};

function rich(): MetaManager {
  const manager = new MetaManager(createStarterMetaState());
  manager.debugAddData(10_000);
  manager.debugAddCores(100);
  manager.debugAddXp(1_000_000);
  return manager;
}

describe('nowe dodatki: dane i zgodność', () => {
  it('sześć nowych dodatków przechodzi schemat, a kształt pasuje do gniazda', () => {
    expect(MODULE_SLOTS).toEqual(['muzzle', 'cell', 'optic', 'grip']);
    for (const id of NEW_MODULES) {
      const module = moduleDefinitions.get(id)!;
      expect(moduleSchema.safeParse(module).success, id).toBe(true);
      expect(MODULE_SHAPES_BY_SLOT[module.slot]).toContain(module.visual.shape);
      const wrong = MODULE_SLOTS.find((slot) => slot !== module.slot)!;
      expect(
        moduleSchema.safeParse({ ...module, slot: wrong }).success,
        id,
      ).toBe(false);
    }
    expect(
      NEW_MODULES.map((id) => moduleDefinitions.get(id)!.slot).sort(),
    ).toEqual(['cell', 'cell', 'grip', 'grip', 'muzzle', 'optic']);
  });

  it('zgodność z rodzajem broni: snajperka bez chwytu, laser ciągły tylko z ogniwem', () => {
    const fits = (weaponId: string) =>
      NEW_MODULES.filter((id) =>
        moduleFitsWeapon(moduleDefinitions.get(id)!, weaponId),
      );
    expect(fits('blaster')).toEqual([...NEW_MODULES]);
    expect(fits('sniper')).toEqual([
      'compensator',
      'extendedCell',
      'pulseCell',
    ]);
    expect(fits('beam')).toEqual(['extendedCell']);
    expect(fits('emp')).toEqual(['compensator', 'extendedCell']);
  });

  it('każdy dodatek daje poprawną definicję każdej zgodnej broni, także w komplecie', () => {
    for (const weaponId of weaponDefinitions.keys()) {
      const fitting = [...moduleDefinitions.values()].filter((module) =>
        moduleFitsWeapon(module, weaponId),
      );
      for (const module of fitting)
        expect(
          weaponSchema.safeParse(moddedWeapon(weaponId, [module.id])).success,
          `${weaponId}+${module.id}`,
        ).toBe(true);
      // Po jednym dodatku z każdego gniazda (limit ogranicza `sanitizeModules`).
      const set = MODULE_SLOTS.flatMap(
        (slot) => fitting.find((module) => module.slot === slot)?.id ?? [],
      );
      expect(
        weaponSchema.safeParse(moddedWeapon(weaponId, set)).success,
        weaponId,
      ).toBe(true);
    }
  });

  it('każdy nowy dodatek ma cenę w sklepie i wymóg poziomu', () => {
    for (const id of NEW_MODULES) {
      const unlock = unlockDefinitions.get(`module:${id}`)!;
      expect(unlock.cost.data, id).toBeGreaterThan(0);
      expect(unlock.minLevel, id).toBeGreaterThanOrEqual(2);
    }
    expect(unlockDefinitions.get('module:pulseCell')!.cost.cores).toBe(2);
  });
});

describe('nowe dodatki: efekty', () => {
  it('każdy dodatek zmienia właściwą statystykę broni', () => {
    const base = shot('blaster');
    const holo = shot('blaster', ['holo']);
    expect(holo.aimInScale).toBe(0.7);
    expect(holo.aimSpreadScale).toBe(0.35);
    expect(holo.aimFovScale).toBeUndefined();

    expect(shot('blaster', ['laser']).hipSpreadScale).toBe(0.4);

    const compensator = shot('blaster', ['compensator']);
    expect(compensator.recoilScale).toBeCloseTo(0.5);
    expect(compensator.spreadDeg).toBeCloseTo(base.spreadDeg * 0.8);

    const foregrip = shot('blaster', ['foregrip']);
    expect(foregrip.fireRateHz).toBeCloseTo(base.fireRateHz * 1.08);
    expect(foregrip.recoilScale).toBeCloseTo(0.7);
    expect(
      shot('blaster', ['foregrip', 'compensator']).recoilScale,
    ).toBeCloseTo(0.35);

    expect(shot('blaster', ['extendedCell']).heatCapacityScale).toBe(1.3);

    const pulse = shot('blaster', ['pulseCell']);
    expect(pulse.damage).toBeCloseTo(base.damage * 1.4);
    expect(pulse.fireRateHz).toBeCloseTo(base.fireRateHz * 0.7);
    expect(pulse.heatPerShot).toBeCloseTo(base.heatPerShot * 1.25);
    expect(weaponDefinitions.get('blaster')).toEqual(base);
  });

  const fire = (def: WeaponDefinition, aim: number, capacity = 100) => {
    const spawn = vi.fn<(spec: ProjectileSpec) => number>(() => 1);
    const stats = new Stats({ heatCapacity: capacity, coolingRate: 10 });
    const weapon = new Weapon(
      1,
      { bus: new EventBus(), tuning, rng: new Rng('shop-spread') },
      stats,
      { projectiles: { spawn } },
      def,
    );
    weapon.step(SIM_DT, {
      triggerHeld: true,
      origin: { x: 0, y: 0, z: 0 },
      dir: { x: 0, y: 0, z: -1 },
      aim,
    });
    return { dirs: spawn.mock.calls.map(([spec]) => spec.dir), weapon, stats };
  };
  const angle = (dir: { z: number }) => Math.acos(Math.min(1, -dir.z));

  it('celownik laserowy zawęża rozrzut tylko bez celowania', () => {
    const plain = fire(shot('scatter'), 0).dirs;
    const laser = fire(shot('scatter', ['laser']), 0).dirs;
    expect(plain.length).toBeGreaterThan(1);
    plain.forEach((dir, i) =>
      expect(angle(laser[i]!)).toBeCloseTo(angle(dir) * 0.4, 3),
    );
    expect(fire(shot('scatter', ['laser']), 1).dirs).toEqual(
      fire(shot('scatter'), 1).dirs,
    );
  });

  it('celownik holograficzny zawęża rozrzut w celowaniu, bez zmiany strzału z biodra', () => {
    const plain = fire(shot('scatter'), 1).dirs;
    const holo = fire(shot('scatter', ['holo']), 1).dirs;
    plain.forEach((dir, i) =>
      expect(angle(holo[i]!)).toBeCloseTo(angle(dir) * 0.35, 3),
    );
    expect(fire(shot('scatter', ['holo']), 0).dirs).toEqual(
      fire(shot('scatter'), 0).dirs,
    );
  });

  it('rozszerzone ogniwo mnoży pojemność ze Stats (także z modyfikatorem)', () => {
    const { weapon, stats } = fire(shot('blaster', ['extendedCell']), 0);
    expect(weapon.heat.max).toBeCloseTo(130);
    stats.add({ stat: 'heatCapacity', type: 'flat', value: 20, source: 't' });
    expect(weapon.heat.max).toBeCloseTo(156);
    expect(fire(shot('blaster'), 0).weapon.heat.max).toBe(100);
  });

  it('odrzut w widoku FPP maleje z kompensatorem i chwytem', () => {
    const kick = (modules: string[]) => {
      const bus = new EventBus();
      const gun = new FppBlaster(bus, 1, { modulesOf: () => modules });
      bus.emit('weapon_switched', { owner: 1, weapon: 'blaster', slot: 0 });
      const scale = (gun as unknown as { recoilScale: number }).recoilScale;
      gun.dispose();
      return scale;
    };
    expect(kick([])).toBe(1);
    expect(kick(['compensator'])).toBeCloseTo(0.5);
    expect(kick(['compensator', 'foregrip'])).toBeCloseTo(0.35);
    // Błędny zestaw nie zatrzymuje widoku broni.
    expect(kick(['unknown'])).toBe(1);
  });

  it('balans: żaden nowy dodatek nie podnosi obrażeń na sekundę o więcej niż 10%', () => {
    for (const id of NEW_MODULES) {
      const module = moduleDefinitions.get(id)!;
      for (const [weaponId, base] of weaponDefinitions) {
        if (!moduleFitsWeapon(module, weaponId)) continue;
        const before = weaponSheet(base);
        const after = weaponSheet(moddedWeapon(weaponId, [id])!);
        expect(after.dps! / before.dps!, `${weaponId}+${id}`).toBeLessThan(1.1);
        // Zysk w jednej statystyce albo zmiana charakteru: coś musi się zmienić.
        expect(after, `${weaponId}+${id}`).not.toEqual(before);
      }
    }
    // Ogniwo impulsowe: mocniejszy strzał kosztem tempa, obrażenia na sekundę bez zysku.
    const pulse = weaponSheet(moddedWeapon('blaster', ['pulseCell'])!);
    const plain = weaponSheet(weaponDefinitions.get('blaster')!);
    expect(pulse.damage!).toBeGreaterThan(plain.damage!);
    expect(pulse.dps!).toBeLessThanOrEqual(plain.dps!);
  });
});

describe('zakupy w warsztacie', () => {
  it('broń kosztuje Dane (droższa także Rdzenie) i wymaga poziomu', () => {
    const fresh = new MetaManager(createStarterMetaState());
    expect(() => fresh.buyUnlock('weapon:rifle')).toThrow('Za mało Danych');
    fresh.debugAddData(1000);
    expect(() => fresh.buyUnlock('weapon:sniper')).toThrow('Wymagany poziom 3');
    // XP wpisane w stan: bez nagród za poziomy, które dałyby Rdzenie.
    const poor = new MetaManager({
      ...createStarterMetaState(),
      xp: 400,
      data: 1000,
    });
    expect(poor.level).toBeGreaterThanOrEqual(3);
    expect(() => poor.buyUnlock('weapon:sniper')).toThrow('Za mało Rdzeni');
    expect(poor.state.data).toBe(1000);
    poor.debugAddCores(2);
    poor.buyUnlock('weapon:sniper');
    expect(poor.state.data).toBe(860);
    expect(poor.state.cores).toBe(0);
    expect(poor.isUnlocked('weapon:sniper')).toBe(true);
    expect(() => poor.buyUnlock('weapon:sniper')).toThrow('Już odblokowane');
    expect(poor.state.data).toBe(860);
    expect(unlockDefinitions.get('weapon:beam')!.cost).toEqual({
      data: 180,
      cores: 4,
    });
  });

  it('dodatek kupuje się raz, a potem montuje w kilku broniach', () => {
    const manager = rich();
    const before = manager.state.data;
    manager.buyUnlock('module:holo');
    expect(manager.state.data).toBe(before - 190);
    expect(() => manager.buyUnlock('module:holo')).toThrow('Już odblokowane');
    manager.debugUnlockAll();
    manager.setLoadout({
      ...manager.state.loadout,
      weapons: ['blaster', 'rifle'],
      modules: { blaster: ['holo'], rifle: ['holo'] },
    });
    expect(manager.loadout().modules).toEqual({
      blaster: ['holo'],
      rifle: ['holo'],
    });
  });

  it('istniejący zapis zachowuje kupione bronie i moduły bez migracji', () => {
    const old = createStarterMetaState();
    old.unlocks.push('weapon:sniper', 'weapon:beam', 'module:pierce');
    old.loadout.weapons = ['sniper'];
    old.loadout.modules = { sniper: ['pierce'] };
    const restored = MetaManager.restore(structuredClone(old));
    expect(restored.serialize()).toEqual(old);
    expect(restored.isUnlocked('weapon:beam')).toBe(true);
    expect(() => restored.buyUnlock('weapon:sniper')).toThrow(
      'Już odblokowane',
    );
    expect(restored.loadout().modules).toEqual({ sniper: ['pierce'] });
  });

  it('limit trzech dodatków na broń przy czterech gniazdach', () => {
    const manager = rich();
    manager.debugUnlockAll();
    const base = manager.state.loadout;
    const three = ['compensator', 'pulseCell', 'holo'];
    expect(() =>
      manager.setLoadout({
        ...base,
        modules: { blaster: [...three, 'laser'] },
      }),
    ).toThrow('Limit modułów na broń: 3');
    expect(() =>
      manager.setLoadout({
        ...base,
        modules: { blaster: ['laser', 'foregrip'] },
      }),
    ).toThrow('Slot grip');
    manager.setLoadout({ ...base, modules: { blaster: three } });
    const slots = equipmentState(manager).modules[0]!.slots;
    expect(slots.map((slot) => slot.blocked)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(shopCard(manager, 'module:laser', 'blaster')).toMatchObject({
      action: 'equip',
      blocked: 'slots',
    });
    manager.setLoadout(toggleModuleLoadout(manager, 'blaster', 'holo', false));
    manager.setLoadout(toggleModuleLoadout(manager, 'blaster', 'laser', true));
    expect(manager.state.loadout.modules.blaster).toEqual([
      'compensator',
      'pulseCell',
      'laser',
    ]);
  });

  it('wydobycie modułu z runu działa także dla nowych dodatków', () => {
    expect(moduleLootSchema.safeParse(['holo', 'laser']).success).toBe(true);
    expect(moduleLootSchema.safeParse(['holo', 'holo']).success).toBe(false);
    const manager = new MetaManager({
      ...createStarterMetaState(),
      pendingExtractions: [{ runId: 'seed:1', moduleIds: ['holo', 'pierce'] }],
    });
    manager.extractModule('seed:1', 'holo');
    expect(manager.isUnlocked('module:holo')).toBe(true);
    expect(manager.isUnlocked('module:pierce')).toBe(false);
    expect(manager.state.pendingExtractions).toEqual([]);
    expect(manager.state.data).toBe(0);
    // Kupiony dodatek znika z oczekujących ofert wydobycia.
    const buyer = new MetaManager({
      ...createStarterMetaState(),
      pendingExtractions: [{ runId: 'seed:2', moduleIds: ['foregrip'] }],
    });
    buyer.debugAddData(500);
    buyer.debugAddXp(1_000_000);
    buyer.buyUnlock('module:foregrip');
    expect(buyer.state.pendingExtractions).toEqual([]);
  });
});

describe('stan sklepu', () => {
  it('wiersze: bronie i dodatki w kolejności gniazd, ze stanem założenia', () => {
    const manager = rich();
    manager.debugUnlockAll();
    manager.setLoadout({
      ...manager.state.loadout,
      modules: { blaster: ['holo'] },
    });
    const weapons = shopRows(manager, 'weapon');
    expect(weapons.find((row) => row.key === 'blaster')!.equipped).toBe(true);
    expect(weapons.find((row) => row.key === 'rifle')!.equipped).toBe(false);
    const modules = shopRows(manager, 'module', 'blaster');
    expect(modules).toHaveLength(moduleDefinitions.size);
    const order = modules.map((row) => MODULE_SLOTS.indexOf(row.slot!));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(modules.filter((row) => row.equipped).map((row) => row.key)).toEqual(
      ['holo'],
    );
  });

  it('karta: powód niedostępności, potem kup, załóż i zdejmij', () => {
    expect(
      shopCard(
        new MetaManager(createStarterMetaState()),
        'module:holo',
        'blaster',
      ),
    ).toMatchObject({ action: 'buy', blocked: 'level' });
    const manager = new MetaManager({ ...createStarterMetaState(), xp: 900 });
    expect(shopCard(manager, 'module:holo', 'blaster')!.blocked).toBe('data');
    expect(shopCard(manager, 'weapon:sniper')!.blocked).toBe('data');
    manager.debugAddData(1000);
    expect(shopCard(manager, 'weapon:sniper')!.blocked).toBe('cores');
    expect(shopCard(manager, 'module:holo', 'blaster')!.blocked).toBeNull();
    manager.buyUnlock('module:holo');
    manager.buyUnlock('weapon:rifle');
    expect(shopCard(manager, 'module:holo', 'blaster')).toMatchObject({
      action: 'equip',
      blocked: null,
    });
    // Jeden slot broni: karabin kupiony, ale nie ma gdzie go wziąć.
    expect(shopCard(manager, 'weapon:rifle')).toMatchObject({
      action: 'equip',
      blocked: 'full',
    });
    expect(shopCard(manager, 'weapon:blaster')).toMatchObject({
      action: 'unequip',
      blocked: 'last',
    });
    expect(shopCard(manager, 'module:holo', 'rifle')!.blocked).toBe('noWeapon');
    manager.setLoadout(toggleModuleLoadout(manager, 'blaster', 'holo', true));
    expect(shopCard(manager, 'module:holo', 'blaster')).toMatchObject({
      action: 'unequip',
      blocked: null,
    });
    expect(shopCard(manager, 'power:grab')).toBeNull();
  });

  it('karta dodatku niepasującego do broni z podglądu', () => {
    const manager = rich();
    manager.debugUnlockAll();
    manager.setLoadout({ ...manager.state.loadout, weapons: ['sniper'] });
    const card = shopCard(manager, 'module:foregrip', 'sniper')!;
    expect(card.blocked).toBe('unfit');
    expect(card.lines).toEqual([]);
    expect(card.fits).toEqual([
      'Blaster',
      'Pistolet',
      'Karabin',
      'Rozpraszacz',
    ]);
  });

  it('tabela statystyk pokazuje różnice przed i po z oceną zmiany', () => {
    const manager = rich();
    manager.debugUnlockAll();
    const line = (id: string, key: string) =>
      shopCard(manager, `module:${id}`, 'blaster')!.lines.find(
        (entry) => entry.key === key,
      );
    expect(line('holo', 'aimSpread')).toMatchObject({
      before: '0,24°',
      after: '0,08°',
      trend: 'better',
    });
    expect(line('holo', 'aimIn')).toMatchObject({ trend: 'better' });
    expect(line('laser', 'hipSpread')).toMatchObject({
      before: '0,6°',
      after: '0,24°',
      trend: 'better',
    });
    expect(line('compensator', 'recoil')).toMatchObject({
      before: '100%',
      after: '50%',
      trend: 'better',
    });
    expect(line('foregrip', 'fireRate')).toMatchObject({ trend: 'better' });
    expect(line('pulseCell', 'damage')).toMatchObject({
      before: '20',
      after: '28',
      trend: 'better',
    });
    expect(line('pulseCell', 'fireRate')).toMatchObject({ trend: 'worse' });
    expect(line('pulseCell', 'heatPerShot')).toMatchObject({ trend: 'worse' });
    expect(line('extendedCell', 'shots')).toMatchObject({
      before: '8',
      after: '10',
      trend: 'better',
    });
    expect(line('extendedCell', 'heatCapacity')).toMatchObject({
      before: '100',
      after: '130',
    });
    expect(line('scope', 'zoom')).toMatchObject({ trend: 'changed' });
    // Podpalenie nie zmienia liczb: zostają same wiersze podstawowe.
    expect(
      shopCard(manager, 'module:incendiary', 'blaster')!.lines.every(
        (entry) => entry.trend === 'same',
      ),
    ).toBe(true);
  });

  it('porównanie liczy dodatek na broni z pozostałymi gniazdami bez zmian', () => {
    const manager = rich();
    manager.debugUnlockAll();
    manager.setLoadout({
      ...manager.state.loadout,
      modules: { blaster: ['compensator', 'laser'] },
    });
    const lines = shopCard(manager, 'module:foregrip', 'blaster')!.lines;
    // Chwyt zastępuje laser w gnieździe, kompensator zostaje po obu stronach.
    expect(lines.find((entry) => entry.key === 'recoil')).toMatchObject({
      before: '50%',
      after: '35%',
    });
    expect(lines.find((entry) => entry.key === 'hipSpread')).toMatchObject({
      before: '0,48°',
      after: '0,48°',
      trend: 'same',
    });
  });

  it('broń porównuje się z pierwszą bronią ekwipunku; bez odniesienia same wartości', () => {
    const manager = new MetaManager(createStarterMetaState());
    const own = shopCard(manager, 'weapon:blaster')!;
    expect(own.baseline).toBeNull();
    expect(own.lines.every((entry) => entry.before === null)).toBe(true);
    const rifle = shopCard(manager, 'weapon:rifle')!;
    expect(rifle.baseline).toBe('Blaster');
    expect(rifle.lines.find((entry) => entry.key === 'damage')).toMatchObject({
      before: '20',
      after: '12',
      trend: 'worse',
    });
    const beam = shopCard(manager, 'weapon:beam')!;
    expect(beam.lines.find((entry) => entry.key === 'dps')).toMatchObject({
      before: '120/s',
      after: '40/s',
    });
    expect(
      statLines(weaponSheet(weaponDefinitions.get('beam')!), null).map(
        (entry) => entry.key,
      ),
    ).toEqual(['dps', 'heatPerS']);
  });

  it('podgląd: przymiarka niezałożonego dodatku i podświetlenie gniazda', () => {
    const manager = rich();
    manager.debugUnlockAll();
    manager.setLoadout({
      ...manager.state.loadout,
      modules: { blaster: ['collimator', 'pierce'] },
    });
    expect(shopPreview(manager, 'weapon:blaster')).toMatchObject({
      weaponId: 'blaster',
      moduleIds: ['collimator', 'pierce'],
      tryOn: null,
      highlight: null,
    });
    const tryOn = shopPreview(manager, 'module:holo')!;
    expect(tryOn.moduleIds).toEqual(['pierce', 'holo']);
    expect(tryOn.tryOn).toBe('holo');
    expect(tryOn.highlight).toBe('optic');
    expect(tryOn.slots.map((slot) => slot.moduleId)).toEqual([
      'pierce',
      null,
      'collimator',
      null,
    ]);
    expect(shopPreview(manager, 'module:collimator')).toMatchObject({
      tryOn: null,
      highlight: 'optic',
    });
    // Broń spoza ekwipunku: sam model, bez gniazd.
    expect(shopPreview(manager, 'weapon:sniper')).toMatchObject({
      weaponId: 'sniper',
      moduleIds: [],
      slots: [],
    });
  });
});

describe('panel sklepu', () => {
  const panels: HubPanel[] = [];
  afterEach(() => {
    panels.splice(0).forEach((panel) => panel.dispose());
    document.body.replaceChildren();
  });
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  function setup(manager: MetaManager) {
    const save = vi.fn(() => Promise.resolve());
    const panel = createWorkshopPanel({
      manager,
      save,
      navigate: vi.fn(),
      close: vi.fn(),
    });
    panels.push(panel);
    document.body.append(panel.root);
    const q = <T extends HTMLElement = HTMLElement>(selector: string) =>
      panel.root.querySelector<T>(selector)!;
    return { panel, save, q };
  }

  it('zakładki Bronie i Dodatki przełączają listę, kartę i podgląd', () => {
    const { q } = setup(rich());
    expect(q('[data-tab="weapon"]').getAttribute('aria-selected')).toBe('true');
    expect(q('[data-pane="weapon"]').hidden).toBe(false);
    expect(q('[data-pane="module"]').hidden).toBe(true);
    expect(q('[data-card]').dataset.card).toBe('weapon:blaster');
    q<HTMLButtonElement>('[data-tab="module"]').click();
    expect(q('[data-pane="module"]').hidden).toBe(false);
    expect(q('[data-pane="weapon"]').hidden).toBe(true);
    expect(
      [...q('[data-pane="module"]').querySelectorAll('h3')].map(
        (node) => node.textContent,
      ),
    ).toEqual(['Wylot', 'Ogniwo', 'Optyka', 'Podwieszenie']);
    q('[data-unlock="module:holo"]').click();
    expect(q('[data-card]').dataset.card).toBe('module:holo');
    expect(q('[data-unlock="module:holo"]').getAttribute('aria-current')).toBe(
      'true',
    );
    const preview = q('[data-testid="weapon-preview"]');
    expect(preview.dataset.modules).toBe('holo');
    expect(preview.dataset.tryOn).toBe('holo');
    expect(preview.dataset.highlight).toBe('optic');
  });

  it('kup broń, kup dodatek, załóż i zdejmij z karty', async () => {
    const manager = rich();
    const { q, save } = setup(manager);
    q('[data-unlock="weapon:rifle"]').click();
    expect(q('[data-testid="weapon-preview"]').dataset.weapon).toBe('rifle');
    const action = () => q<HTMLButtonElement>('[data-action="card"]');
    expect(action().dataset.cardAction).toBe('buy');
    expect(q('.workshop__card-state').textContent).toBe('Cena: 80 Dane');
    action().click();
    await flush();
    expect(manager.isUnlocked('weapon:rifle')).toBe(true);
    // Jeden slot broni: karta mówi, dlaczego nie da się wziąć karabinu.
    expect(action().dataset.cardAction).toBe('equip');
    expect(action().disabled).toBe(true);
    expect(q('[data-blocked]').dataset.blocked).toBe('full');

    q<HTMLButtonElement>('[data-tab="module"]').click();
    q('[data-unlock="module:holo"]').click();
    action().click();
    await flush();
    expect(manager.isUnlocked('module:holo')).toBe(true);
    expect(action().dataset.cardAction).toBe('equip');
    expect(action().disabled).toBe(false);
    action().click();
    await flush();
    expect(manager.state.loadout.modules).toEqual({ blaster: ['holo'] });
    const preview = q('[data-testid="weapon-preview"]');
    expect(preview.dataset.weapon).toBe('blaster');
    expect(preview.dataset.modules).toBe('holo');
    expect(preview.dataset.tryOn).toBe('');
    expect(q('[data-unlock="module:holo"]').dataset.equipped).toBe('true');
    expect(q('[data-slot="optic"]').textContent).toContain(
      'Celownik holograficzny',
    );
    expect(q('[data-slot="optic"]').getAttribute('aria-pressed')).toBe('true');
    expect(q('.workshop__card-state').dataset.state).toBe('equipped');
    expect(action().dataset.cardAction).toBe('unequip');
    action().click();
    await flush();
    expect(manager.state.loadout.modules).toEqual({});
    expect(save).toHaveBeenCalledTimes(4);
  });

  it('karta niedostępnego przedmiotu podaje powód i blokuje zakup', () => {
    const manager = new MetaManager(createStarterMetaState());
    const spy = vi.spyOn(manager, 'buyUnlock');
    const { q } = setup(manager);
    q('[data-unlock="weapon:scatter"]').click();
    expect(q('[data-blocked]').textContent).toBe('Wymagany poziom 2');
    expect(q<HTMLButtonElement>('[data-action="card"]').disabled).toBe(true);
    q('[data-unlock="weapon:rifle"]').click();
    expect(q('[data-blocked]').textContent).toBe('Za mało Danych');
    q<HTMLButtonElement>('[data-action="card"]').click();
    expect(spy).not.toHaveBeenCalled();
  });

  it('gniazdo pod podglądem otwiera dodatki tego gniazda, wiersz działa z klawiatury', () => {
    const manager = rich();
    manager.debugUnlockAll();
    const { q } = setup(manager);
    q<HTMLButtonElement>('[data-action="slot"][data-slot="grip"]').click();
    expect(q('[data-tab="module"]').getAttribute('aria-selected')).toBe('true');
    expect(q('[data-card]').dataset.card).toBe('module:foregrip');
    q('[data-unlock="module:laser"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(q('[data-card]').dataset.card).toBe('module:laser');
    const rows = [...q('.workshop__stats tbody').querySelectorAll('tr')];
    expect(
      rows.find((row) => row.dataset.stat === 'hipSpread')!.dataset.trend,
    ).toBe('better');
  });

  it('czwarte gniazdo w ekwipunku jest zablokowane limitem z podpowiedzią', () => {
    const manager = rich();
    manager.debugUnlockAll();
    manager.setLoadout({
      ...manager.state.loadout,
      modules: { blaster: ['compensator', 'pulseCell', 'holo'] },
    });
    const { q } = setup(manager);
    const grip = q<HTMLSelectElement>(
      'select[data-weapon="blaster"][data-slot="3"]',
    );
    expect(grip.disabled).toBe(true);
    expect(grip.title).toContain('Limit 3 dodatków');
    expect(
      q<HTMLSelectElement>('select[data-weapon="blaster"][data-slot="0"]')
        .disabled,
    ).toBe(false);
  });
});
