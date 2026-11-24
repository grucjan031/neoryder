import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three';
import { EventBus } from '../../src/core/events';
import { AchievementTracker } from '../../src/progression/achievementTracker';
import {
  MetaManager,
  equipSkin,
  ownedSkins,
  skinSource,
} from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import {
  loadSkinDefinitions,
  skinDefinitions,
  skinSchema,
} from '../../src/progression/skinSchema';
import { unlockIdSchema } from '../../src/progression/unlocksSchema';
import { applyWeaponSkin } from '../../src/render/weaponSkin';
import { savedLoadoutSchema } from '../../src/progression/loadout';
import { achievementDefinitions } from '../../src/progression/achievementsSchema';

const carbon = skinDefinitions.get('nocny-karbon')!;
describe('skiny broni', () => {
  it('ładuje katalog, sprawdza nazwę pliku, broń i identyfikatory odblokowań', () => {
    expect(skinDefinitions.size).toBe(16);
    const sources = [...skinDefinitions.values()].map((s) => {
      expect(skinSchema.safeParse(s).success).toBe(true);
      expect(unlockIdSchema.safeParse('skin:' + s.id).success).toBe(true);
      return skinSource(s.id).kind;
    });
    expect(sources.filter((s) => s === 'shop')).toHaveLength(5);
    expect(sources.filter((s) => s === 'achievement')).toHaveLength(11);
    expect(loadSkinDefinitions.bind(null, { 'inny.json': carbon })).toThrow();
    expect(
      skinSchema.safeParse({ ...carbon, weapons: ['nieznana'] }).success,
    ).toBe(false);
    expect(unlockIdSchema.safeParse('skin:nieznany').success).toBe(false);
  });
  it.each(['#e0262b', '#ff2bd6'])(
    'odrzuca %s na powierzchni i we wzorze',
    (color) => {
      for (const key of Object.keys(carbon.colors))
        expect(
          skinSchema.safeParse({
            ...carbon,
            colors: { ...carbon.colors, [key]: color },
          }).success,
        ).toBe(false);
      expect(
        skinSchema.safeParse({ ...carbon, patternColor: color }).success,
      ).toBe(false);
    },
  );
  it('rozlicza mistrzostwo i zachowuje wybór skina w runie', () => {
    const manager = new MetaManager(createStarterMetaState());
    const summary = {
      outcome: 'death' as const,
      seed: 'skin',
      loadoutId: 'custom',
      elapsedS: 1,
      kills: 150,
      roomsCleared: 0,
      elitesCleared: 0,
      threatLevel: 0,
      layerReached: 0,
      implants: [],
      damage: { melee: 0, power: 0, gun: 150, other: 0 },
      achievements: { counters: { kills_blaster: 150 }, flags: [] },
    };
    manager.applyRun(summary, 'skin:1');
    manager.applyRun(summary, 'skin:1');
    expect(manager.state.cores).toBe(createStarterMetaState().cores + 1);
    expect(
      manager.state.unlocks.filter((id) => id === 'skin:mistrz-blaster'),
    ).toHaveLength(1);
    expect(ownedSkins(manager.state, 'blaster').map((s) => s.id)).toContain(
      'mistrz-blaster',
    );
    expect(() => manager.buyUnlock('skin:mistrz-blaster')).toThrow();
    expect(() => equipSkin(manager.state, 'blaster', 'nocny-karbon')).toThrow();
    expect(() =>
      equipSkin(manager.state, 'pistol', 'mistrz-blaster'),
    ).toThrow();
    manager.setLoadout(equipSkin(manager.state, 'blaster', 'mistrz-blaster'));
    expect(savedLoadoutSchema.parse(manager.loadout()).skins).toEqual({
      blaster: 'mistrz-blaster',
    });
    manager.setLoadout(equipSkin(manager.state, 'blaster', null));
    expect(manager.state.loadout.skins).toEqual({});
  });
  it('uzupełnia stare zapisy bez ponownej wypłaty', () => {
    const meta = createStarterMetaState();
    meta.achievements.unlocked = ['zwierciadlo'];
    const { skins, ...old } = meta.loadout;
    expect(skins).toEqual({});
    const first = MetaManager.restore({ ...meta, loadout: old });
    expect(first.state.loadout.skins).toEqual({});
    expect(first.state.unlocks).toContain('skin:zwierciadlo');
    expect(first.state.data).toBe(meta.data);
    expect(MetaManager.restore(first.serialize()).serialize()).toEqual(
      first.state,
    );
    const run = first.loadout();
    expect(
      savedLoadoutSchema.parse({ ...run, skins: undefined }).skins,
    ).toBeUndefined();
  });
  it('każda broń ma własną naszywkę za 150 zabójstw', () => {
    for (const skin of skinDefinitions.values()) {
      if (skin.rarity !== 'mistrzowski') continue;
      expect(achievementDefinitions.get(skin.id)).toMatchObject({
        counter: 'kills_' + skin.weapons[0],
        target: 150,
        reward: { cores: 1, unlocks: ['skin:' + skin.id] },
      });
    }
  });
  it('przypisuje broń z chwili trafienia wyłącznie zabójcy-graczowi', () => {
    const bus = new EventBus();
    const tracker = new AchievementTracker(bus, {
      base: { unlocked: [], counters: {} },
      clock: () => 0,
    });
    bus.emit('entity_spawned', { id: 1, kind: 'player' });
    const switchTo = (weapon: string, owner = 1) =>
      bus.emit('weapon_switched', { owner, weapon, slot: 0 });
    const hit = (target: number, tag: string) =>
      bus.emit('damage_dealt', {
        source: 1,
        target,
        tags: [tag],
        amount: 1,
        point: null,
        dir: null,
        knockback: 0,
        killed: false,
      });
    const kill = (id: number, killer = 1) =>
      bus.emit('enemy_killed', { id, killer, tags: [] });
    hit(2, '#gun');
    kill(2);
    switchTo('pistol');
    switchTo('emp', 9);
    hit(3, '#gun');
    switchTo('rifle');
    kill(3);
    hit(4, '#gun');
    hit(4, '#power');
    kill(4);
    hit(5, '#gun');
    kill(5, 9);
    switchTo('nieznana');
    hit(6, '#gun');
    kill(6);
    expect(tracker.tracked.counters).toEqual({
      kills_gun: 3,
      kills_pistol: 1,
      kills_power: 1,
    });
    tracker.dispose();
  });
  it('przywraca fabryczne materiały, zachowuje rim i pomija cały dodatek', () => {
    const skin = skinDefinitions.get('biala-ceramika')!;
    const root = new Group(),
      module = new Group();
    module.userData.moduleSlot = 'optic';
    const source = new MeshStandardMaterial(),
      glow = new MeshBasicMaterial();
    glow.name = 'mat_player_cyan';
    const mesh = new Mesh(new BoxGeometry(), source),
      lamp = new Mesh(new BoxGeometry(), glow),
      lens = mesh.clone();
    root.add(mesh, lamp, module);
    module.add(lens);
    applyWeaponSkin(root, skin);
    const painted = mesh.material;
    expect(painted).not.toBe(source);
    expect(painted.onBeforeCompile).toBe(source.onBeforeCompile);
    expect(painted.color.getHexString()).toBe(skin.colors.armor.slice(1));
    expect(lamp.material.color.getHexString()).toBe(
      skin.colors.accent.slice(1),
    );
    expect(lens.material).toBe(source);
    applyWeaponSkin(root, null);
    expect(mesh.material).toBe(source);
    expect(lamp.material).toBe(glow);
    applyWeaponSkin(root, skin);
    expect(mesh.material).toBe(painted);
  });
});
