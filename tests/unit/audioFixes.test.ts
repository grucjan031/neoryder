import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { AudioSystem } from '../../src/audio/audioSystem';
import { MusicSystem } from '../../src/audio/music';
import type { MusicTimer } from '../../src/audio/music';
import { loadMusic } from '../../src/audio/musicSchema';
import { loadSfx } from '../../src/audio/sfxSchema';
import type { AudioBackend } from '../../src/audio/synth';
import musicData from '../../src/data/audio/music.json';
import sfxData from '../../src/data/audio/sfx.json';

interface FakeNode {
  connected: boolean;
  onended?: () => void;
  [key: string]: unknown;
}

/** Atrapa Web Audio śledząca odpięcie węzłów i zakończenie źródeł. */
function fakeContext(state = 'running') {
  const nodes: FakeNode[] = [];
  const sources: FakeNode[] = [];
  let starts = 0;
  const param = (value = 0) => {
    const p = {
      value,
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
  const node = (extra: object = {}): FakeNode => {
    const n: FakeNode = {
      connected: true,
      connect: () => undefined,
      disconnect: () => {
        n.connected = false;
      },
      ...extra,
    };
    nodes.push(n);
    return n;
  };
  const source = (extra: object = {}) => {
    const n = node({
      start: () => {
        starts++;
      },
      stop: () => undefined,
      ...extra,
    });
    sources.push(n);
    return n;
  };
  const ctx = {
    currentTime: 0,
    state,
    sampleRate: 8000,
    destination: {},
    createGain: () => node({ gain: param(1) }),
    createStereoPanner: () => node({ pan: param() }),
    createOscillator: () =>
      source({ type: 'sine', frequency: param(440), detune: param() }),
    createBiquadFilter: () =>
      node({ type: 'lowpass', frequency: param(), Q: param() }),
    createBufferSource: () =>
      source({ buffer: null, loop: false, playbackRate: param(1) }),
    createBuffer: (_c: number, length: number) => {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    },
    resume: async () => undefined,
    close: async () => undefined,
  };
  return {
    ctx: ctx as unknown as AudioBackend & { currentTime: number },
    nodes,
    sources,
    starts: () => starts,
  };
}

function setupAudio(fake = fakeContext()) {
  let created = 0;
  const audio = new AudioSystem(new EventBus(), loadSfx(sfxData), {
    createContext: () => {
      created++;
      return fake.ctx;
    },
    tuning: structuredClone(tuning),
    masterVolume: () => 1,
    listener: () => ({ position: { x: 0, y: 1.6, z: 0 }, yaw: 0 }),
    seed: 'fixes',
  });
  return { audio, fake, created: () => created };
}

describe('AudioSystem: sprzątanie głosów', () => {
  it('po zakończeniu głosu odpina jego węzły od mastera', () => {
    const { audio, fake } = setupAudio();
    audio.play('kill', { point: { x: 3, y: 1, z: -3 } });
    const count = fake.nodes.length;
    expect(count).toBeGreaterThan(2);
    fake.ctx.currentTime = 30;
    expect(audio.activeVoices).toBe(0);
    for (const s of fake.sources) s.onended?.();
    // Jedynym połączonym węzłem zostaje wspólny master (pierwszy utworzony).
    expect(fake.nodes.filter((n) => n.connected)).toEqual([fake.nodes[0]]);
  });

  it('kradzież głosu odpina węzły ukradzionego głosu', () => {
    const { audio, fake } = setupAudio();
    const max = tuning.audio.maxVoices;
    for (let i = 0; i < max; i++) audio.play('kill');
    const before = fake.nodes.filter((n) => !n.connected).length;
    audio.play('kill');
    expect(fake.nodes.filter((n) => !n.connected).length).toBeGreaterThan(
      before,
    );
  });

  it('play po dispose nie tworzy nowego kontekstu', () => {
    const { audio, created } = setupAudio();
    audio.play('kill');
    expect(created()).toBe(1);
    audio.dispose();
    expect(audio.play('kill')).toBe(false);
    expect(created()).toBe(1);
  });
});

describe('AudioSystem: dudnienie pociągu bez źródeł ambientu', () => {
  it('zakończenie przejazdu zatrzymuje dźwięk', () => {
    const { audio, fake } = setupAudio();
    audio.setTrainPass(0.5, tuning.hub);
    audio.updateAmbience();
    const started = fake.starts();
    expect(started).toBeGreaterThan(0);
    const playing = fake.sources.filter((s) => s.connected).length;
    audio.setTrainPass(null, tuning.hub);
    audio.updateAmbience();
    expect(fake.sources.filter((s) => s.connected).length).toBeLessThan(
      playing,
    );
  });
});

describe('MusicSystem', () => {
  function manualTimer(): MusicTimer {
    return { set: () => 1, clear: () => undefined };
  }
  function setupMusic(fake = fakeContext()) {
    const music = new MusicSystem(loadMusic(musicData), {
      getContext: () => fake.ctx,
      tuning,
      masterVolume: () => 1,
      musicVolume: () => 1,
      timer: manualTimer(),
    });
    return { music, fake };
  }

  it('po skoku czasu pomija zaległe kroki zamiast je nadrabiać', () => {
    const { music, fake } = setupMusic();
    music.setState('calm');
    music.update();
    const afterFirst = fake.starts();
    fake.ctx.currentTime = 600;
    music.update();
    const burst = fake.starts() - afterFirst;
    // Zwykłe okno planowania (1,5 s) to kilkadziesiąt źródeł; nadrabianie 10 minut to tysiące.
    expect(burst).toBeLessThan(afterFirst * 3);
  });

  it('nie planuje nut przy zawieszonym kontekście', () => {
    const { music, fake } = setupMusic(fakeContext('suspended'));
    music.setState('calm');
    music.update();
    expect(fake.starts()).toBe(0);
  });

  it('dispose odpina szyny pętli', () => {
    const { music, fake } = setupMusic();
    music.setState('calm');
    music.update();
    music.dispose();
    // [0] = wyjście, [1] = szyna calm
    expect(fake.nodes[0]!.connected).toBe(false);
    expect(fake.nodes[1]!.connected).toBe(false);
  });

  it('zakończona nuta odpina swoje węzły', () => {
    const { music, fake } = setupMusic();
    music.setState('combat');
    music.update();
    const before = fake.nodes.filter((n) => n.connected).length;
    for (const s of fake.sources) s.onended?.();
    expect(fake.nodes.filter((n) => n.connected).length).toBeLessThan(
      before / 2,
    );
  });
});
