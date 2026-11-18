import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { AudioSystem } from '../../src/audio/audioSystem';
import { loadSfx, SFX_EVENTS } from '../../src/audio/sfxSchema';
import data from '../../src/data/audio/sfx.json';

const def = loadSfx(data);
function setup() {
  const bus = new EventBus();
  const audio = new AudioSystem(bus, def, {
    createContext: () => null,
    tuning,
    masterVolume: () => 1,
  });
  const play = vi.spyOn(audio, 'play').mockReturnValue(true);
  bus.emit('entity_spawned', { id: 1, kind: 'player' });
  return { bus, audio, play };
}

describe('audio S7-02 clarity', () => {
  it('waliduje wszystkie klucze mapy zdarzeń i cooldown nowych sygnałów', () => {
    for (const rule of def.rules) {
      expect(SFX_EVENTS).toContain(rule.event);
      expect(def.sounds[rule.sound]).toBeDefined();
    }
    for (const name of [
      'heatWarning',
      'lowHealth',
      'telegraphAim',
      'telegraphHeavy',
      'pickup',
      'runReward',
    ])
      expect(def.sounds[name]?.cooldownS).toBeGreaterThan(0);
    expect(() =>
      loadSfx({ ...data, alerts: { ...data.alerts, heatReset: 0.9 } }),
    ).toThrow();
  });

  it('ciepło: próg 75%, reset 60%, brak spamu i pierwszeństwo przegrzania', () => {
    const { bus, play } = setup();
    const heat = (current: number, overheated = false, id = 1) =>
      bus.emit('heat_changed', { id, current, max: 100, overheated });
    heat(80, false, 2);
    heat(74);
    expect(play).not.toHaveBeenCalled();
    heat(75);
    heat(76);
    heat(74);
    heat(75);
    heat(61);
    heat(75);
    expect(play.mock.calls.map((c) => c[0])).toEqual(['heatWarning']);
    heat(60);
    heat(75);
    expect(play.mock.calls.map((c) => c[0])).toEqual([
      'heatWarning',
      'heatWarning',
    ]);
    heat(0);
    heat(100, true);
    heat(100, true);
    expect(play.mock.calls.map((c) => c[0])).toEqual([
      'heatWarning',
      'heatWarning',
      'overheat',
    ]);
  });

  it('zdrowie: pojedyncze zejście poniżej 25%, histereza, brak alarmu śmierci i NPC', () => {
    const { bus, play } = setup();
    const hp = (current: number, id = 1) =>
      bus.emit('health_changed', { id, current, max: 100 });
    hp(10, 2);
    hp(100);
    hp(25);
    expect(play).not.toHaveBeenCalled();
    hp(24);
    hp(10);
    hp(26);
    hp(24);
    hp(34);
    hp(24);
    expect(play.mock.calls.map((c) => c[0])).toEqual(['lowHealth']);
    hp(35);
    hp(24);
    expect(play).toHaveBeenCalledTimes(2);
    hp(100);
    hp(0);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('reset sceny zachowuje gracza, despawn usuwa stan; wymiana broni resetuje ciepło', () => {
    const { bus, play, audio } = setup();
    const heat = () =>
      bus.emit('heat_changed', {
        id: 1,
        current: 80,
        max: 100,
        overheated: false,
      });
    heat();
    bus.emit('weapon_switched', { owner: 1, weapon: 'test', slot: 0 });
    heat();
    bus.emit('scene_loaded', { sceneId: 'test' });
    heat();
    expect(play).toHaveBeenCalledTimes(3);
    bus.emit('entity_despawned', { id: 1 });
    heat();
    expect(play).toHaveBeenCalledTimes(3);
    bus.emit('entity_spawned', { id: 1, kind: 'player' });
    heat();
    expect(play).toHaveBeenCalledTimes(4);
    audio.dispose();
    heat();
    expect(play).toHaveBeenCalledTimes(4);
  });

  it('różnicuje zapowiedzi i nagradza tylko dodatnią zmianę waluty', () => {
    const { bus, play } = setup();
    for (const kind of ['swing', 'heavy', 'aim'])
      bus.emit('enemy_telegraph', { id: 2, kind, durationS: 1 });
    for (const delta of [-5, 0, 5])
      bus.emit('currency_changed', { currency: 'credits', amount: 10, delta });
    bus.emit('implant_acquired', {
      id: 'test',
      rarity: 'common',
      source: 'reward',
    });
    bus.emit('meta_rewards', {
      runId: 'run',
      rewards: { xp: 10, data: 1, cores: 0 },
      levelBefore: 1,
      levelAfter: 1,
    });
    expect(play.mock.calls.map((c) => c[0])).toEqual([
      'telegraph',
      'telegraphHeavy',
      'telegraphAim',
      'pickup',
      'pickup',
      'runReward',
    ]);
    expect(def.rules.find((r) => r.event === 'meta_rewards')?.sound).toBe(
      'runReward',
    );
  });

  it('nagrody są tonalne, parowanie wyższe i nie dłuższe od bloku, zabójstwo ma wysoki klik', () => {
    for (const name of ['pickup', 'waveCleared', 'runReward'])
      for (const layers of def.sounds[name]!.variants)
        expect(layers.every((l) => l.wave !== 'noise')).toBe(true);
    const duration = (name: string) =>
      Math.max(
        ...def.sounds[name]!.variants[0]!.map(
          (l) => (l.delayS ?? 0) + l.durationS,
        ),
      );
    // Parowanie: nie dłuższe od bloku, a jego ton główny wyraźnie wyżej (metaliczne „dzyń”).
    const mainFreq = (name: string) =>
      Math.max(
        ...def.sounds[name]!.variants[0]!.filter((l) => l.wave !== 'noise').map(
          (l) => (l.gain >= 0.5 ? (l.freq ?? 0) : 0),
        ),
      );
    expect(duration('parry')).toBeLessThanOrEqual(duration('block'));
    expect(mainFreq('parry')).toBeGreaterThan(mainFreq('block') * 3);
    for (const layers of def.sounds.kill!.variants)
      expect(
        layers.some((l) => (l.freq ?? 0) >= 6000 && l.durationS <= 0.03),
      ).toBe(true);
  });
});
