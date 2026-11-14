import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { AudioSystem, spatialize } from '../../src/audio/audioSystem';
import { loadSfx } from '../../src/audio/sfxSchema';
import type { SfxDefinition } from '../../src/audio/sfxSchema';
import type { AudioBackend } from '../../src/audio/synth';
import sfxData from '../../src/data/audio/sfx.json';

/** Atrapa Web Audio: zapisuje wartości parametrów i wywołania start/stop. */
function fakeContext() {
  const log = {
    oscillators: [] as { freq: number }[],
    started: 0,
    stopped: 0,
    panners: [] as number[],
    resumed: 0,
  };
  const param = (initial = 0) => {
    const p = {
      value: initial,
      setValueAtTime: (v: number) => {
        p.value = v;
        return p;
      },
      linearRampToValueAtTime: () => p,
      exponentialRampToValueAtTime: () => p,
      cancelScheduledValues: () => p,
    };
    return p;
  };
  const node = () => ({
    connect: () => undefined,
    disconnect: () => undefined,
  });
  const source = () => ({
    ...node(),
    start: () => {
      log.started++;
    },
    stop: () => {
      log.stopped++;
    },
  });
  const ctx = {
    currentTime: 0,
    state: 'suspended',
    sampleRate: 8000,
    destination: node(),
    createGain: () => ({ ...node(), gain: param(1) }),
    createOscillator: () => {
      const frequency = param(440);
      const osc = { ...source(), type: 'sine', frequency };
      const entry = {
        get freq() {
          return frequency.value;
        },
      };
      log.oscillators.push(entry);
      return osc;
    },
    createBiquadFilter: () => ({
      ...node(),
      type: 'lowpass',
      frequency: param(),
      Q: param(),
    }),
    createBufferSource: () => ({
      ...source(),
      buffer: null,
      loop: false,
      playbackRate: param(1),
    }),
    createBuffer: (_c: number, length: number) => {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    },
    createStereoPanner: () => {
      const pan = param(0);
      const panner = { ...node(), pan };
      const original = pan.setValueAtTime;
      pan.setValueAtTime = (v: number) => {
        log.panners.push(v);
        return original(v);
      };
      return panner;
    },
    resume: async () => {
      log.resumed++;
      ctx.state = 'running';
    },
    close: async () => undefined,
  };
  return {
    ctx: ctx as unknown as AudioBackend & {
      currentTime: number;
      state: string;
    },
    log,
  };
}

const def = loadSfx(sfxData);

function setup(
  definition: SfxDefinition = def,
  listener = { position: { x: 0, y: 1.6, z: 0 }, yaw: 0 },
) {
  const bus = new EventBus();
  const fake = fakeContext();
  const t = structuredClone(tuning);
  const audio = new AudioSystem(bus, definition, {
    createContext: () => fake.ctx,
    tuning: t,
    masterVolume: () => 1,
    listener: () => listener,
    seed: 'test',
  });
  bus.emit('entity_spawned', { id: 1, kind: 'player' });
  return { bus, audio, fake, t };
}

const hit = (
  over: Partial<{
    source: number | null;
    target: number;
    tags: string[];
    killed: boolean;
  }> = {},
) => ({
  source: 1,
  target: 2,
  amount: 25,
  tags: ['#melee'],
  point: { x: 0, y: 1, z: -3 },
  dir: null,
  knockback: 0,
  killed: false,
  ...over,
});

describe('dane dźwięków', () => {
  it('sfx.json jest poprawne, każda reguła wskazuje istniejący dźwięk', () => {
    expect(Object.keys(def.sounds).length).toBeGreaterThanOrEqual(9);
  });

  it('schemat odrzuca regułę z nieznanym zdarzeniem i nieznanym dźwiękiem', () => {
    expect(() =>
      loadSfx({ ...sfxData, rules: [{ event: 'teleported', sound: 'kill' }] }),
    ).toThrow(/dźwięków/);
    expect(() =>
      loadSfx({
        ...sfxData,
        rules: [{ event: 'parry_success', sound: 'nope' }],
      }),
    ).toThrow(/nieznany dźwięk/);
    expect(() =>
      loadSfx({
        ...sfxData,
        rules: [
          { event: 'parry_success', when: { bogus: true }, sound: 'parry' },
        ],
      }),
    ).toThrow();
  });
});

describe('AudioSystem — reguły', () => {
  it('zdarzenia wybierają właściwy dźwięk z mapy', () => {
    const c = setup();
    const cases: [() => void, string][] = [
      [() => c.bus.emit('damage_dealt', hit()), 'hitLight'],
      [
        () => c.bus.emit('damage_dealt', hit({ tags: ['#melee', '#heavy'] })),
        'hitHeavy',
      ],
      [() => c.bus.emit('damage_dealt', hit({ killed: true })), 'kill'],
      [
        () => c.bus.emit('damage_dealt', hit({ source: 2, target: 1 })),
        'playerHurt',
      ],
      [
        () => c.bus.emit('damage_dealt', hit({ tags: ['#power', '#wall'] })),
        'wallSlam',
      ],
      [() => c.bus.emit('damage_dealt', hit({ tags: ['#gun'] })), 'hitGun'],
      [
        () =>
          c.bus.emit('melee_blocked', { defender: 1, attacker: 2, amount: 10 }),
        'block',
      ],
      [
        () => c.bus.emit('parry_success', { projectile: 9, attacker: 2 }),
        'parry',
      ],
      [
        () => c.bus.emit('weapon_fired', { weapon: 'blaster', owner: 1 }),
        'blasterShot',
      ],
      [
        () =>
          c.bus.emit('projectile_spawned', { id: 7, owner: 2, team: 'enemy' }),
        'enemyShot',
      ],
      [() => c.bus.emit('power_used', { power: 'push', user: 1 }), 'push'],
      [() => c.bus.emit('player_landed', { id: 1, speed: 12 }), 'land'],
      [() => c.bus.emit('wave_started', { wave: 1, count: 2 }), 'waveStart'],
    ];
    for (const [emit, expected] of cases) {
      c.fake.ctx.currentTime += 1; // poza cooldownami
      c.audio.lastSound = null;
      emit();
      expect(c.audio.lastSound, expected).toBe(expected);
    }
  });

  it('reguły z warunkami: obce zdarzenia i słabe lądowanie ciche, przegrzanie tylko na zboczu', () => {
    const c = setup();
    c.bus.emit('weapon_fired', { weapon: 'blaster', owner: 5 });
    c.bus.emit('player_landed', { id: 1, speed: 3 });
    expect(c.audio.lastSound).toBeNull();
    const heat = (overheated: boolean) =>
      c.bus.emit('heat_changed', { id: 1, current: 100, max: 100, overheated });
    heat(true);
    expect(c.audio.lastSound).toBe('overheat');
    c.audio.lastSound = null;
    heat(true);
    expect(c.audio.lastSound).toBeNull();
    heat(false);
    heat(true);
    expect(c.audio.lastSound).toBe('overheat');
  });

  it('cooldown dźwięku tłumi spam (swing)', () => {
    const c = setup();
    expect(c.audio.play('swing')).toBe(true);
    expect(c.audio.play('swing')).toBe(false);
    c.fake.ctx.currentTime += 1;
    expect(c.audio.play('swing')).toBe(true);
  });
});

describe('AudioSystem — głosy i wariacje', () => {
  it('limit głosów nie jest przekroczony (kradzież najstarszego)', () => {
    const c = setup();
    c.t.audio.maxVoices = 4;
    for (let i = 0; i < 20; i++) c.audio.play('kill');
    expect(c.audio.activeVoices).toBeLessThanOrEqual(4);
    expect(c.fake.log.stopped).toBeGreaterThan(0);
  });

  it('głosy wygasają po czasie', () => {
    const c = setup();
    c.audio.play('hitLight');
    expect(c.audio.activeVoices).toBe(1);
    c.fake.ctx.currentTime += 5;
    expect(c.audio.activeVoices).toBe(0);
  });

  it('pitch w zakresie z danych (częstotliwość oscylatora / bazowa)', () => {
    const one: SfxDefinition = {
      sounds: {
        beep: {
          volume: 1,
          pitch: [0.8, 1.25],
          variants: [[{ wave: 'sine', freq: 1000, durationS: 0.1, gain: 1 }]],
        },
      },
      rules: [],
    };
    const c = setup(one);
    for (let i = 0; i < 50; i++) {
      c.fake.ctx.currentTime += 1;
      c.audio.play('beep');
    }
    const ratios = c.fake.log.oscillators.map((o) => o.freq / 1000);
    expect(Math.min(...ratios)).toBeGreaterThanOrEqual(0.8);
    expect(Math.max(...ratios)).toBeLessThan(1.25);
    expect(new Set(ratios.map((r) => r.toFixed(3))).size).toBeGreaterThan(10);
  });

  it('dźwięk przestrzenny: trafienie z prawej panoramowane w prawo', () => {
    const c = setup();
    c.bus.emit('damage_dealt', hit({ tags: ['#melee'] }));
    c.bus.emit('damage_dealt', { ...hit(), point: { x: 6, y: 1, z: 0 } });
    expect(c.fake.log.panners[0]).toBeCloseTo(0);
    expect(c.fake.log.panners[1]).toBeCloseTo(c.t.audio.maxPan);
  });

  it('spatialize: tłumienie ≤ 1 w promieniu ref, maleje z odległością', () => {
    const l = { position: { x: 0, y: 0, z: 0 }, yaw: 0 };
    expect(spatialize({ x: 0, y: 0, z: -2 }, l, 4, 0.8).attenuation).toBe(1);
    expect(
      spatialize({ x: 0, y: 0, z: -16 }, l, 4, 0.8).attenuation,
    ).toBeCloseTo(0.25);
    expect(spatialize({ x: -5, y: 0, z: 0 }, l, 4, 0.8).pan).toBeCloseTo(-0.8);
  });

  it('attachUnlock wznawia kontekst po pierwszej interakcji i odpina słuchaczy przy dispose', () => {
    const c = setup();
    const handlers = new Map<string, () => void>();
    const target = {
      addEventListener: (e: string, h: () => void) => handlers.set(e, h),
      removeEventListener: (e: string) => handlers.delete(e),
    };
    c.audio.attachUnlock(target as unknown as Window);
    handlers.get('pointerdown')?.();
    expect(c.fake.log.resumed).toBe(1);
    c.audio.dispose();
    expect(handlers.size).toBe(0);
  });

  it('bez Web Audio (createContext = null) nic nie odtwarza i nie rzuca', () => {
    const bus = new EventBus();
    const audio = new AudioSystem(bus, def, {
      createContext: () => null,
      tuning,
      masterVolume: () => 1,
    });
    expect(audio.play('kill')).toBe(false);
    expect(audio.state).toBe('none');
    bus.emit('damage_dealt', hit({ killed: true }));
  });
});
