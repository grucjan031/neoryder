import { describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { AudioSystem } from '../../src/audio/audioSystem';
import { AmbienceSynth } from '../../src/audio/ambienceSynth';
import { ambienceAttenuation, selectAmbience } from '../../src/audio/ambience';
import {
  ambienceKindSchema,
  loadAmbience,
} from '../../src/audio/ambienceSchema';
import type { AmbienceSource } from '../../src/audio/ambienceSchema';
import type { AudioBackend } from '../../src/audio/synth';
import { loadSfx } from '../../src/audio/sfxSchema';
import { EventBus } from '../../src/core/events';
import type { GameContext } from '../../src/core/context';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { HubSoundscape } from '../../src/scenes/hubSoundscape';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { hubAmbienceSources } from '../../src/world/hubAmbience';
import { loadHubLayout } from '../../src/world/hubSchema';
import { HubTrain } from '../../src/world/hubTrain';
import { TrainDust } from '../../src/vfx/trainDust';
import hideout from '../../src/data/hub/hideout.json';
import extra from '../../src/data/hub/ambience.json';
import sfx from '../../src/data/audio/sfx.json';

function fakeBackend() {
  const log = {
    started: 0,
    stopped: 0,
    nodes: 0,
    disconnected: 0,
    gains: [] as { value: number }[],
    pans: [] as { value: number }[],
    buffers: [] as Float32Array[],
  };
  const param = (value = 0) => {
    const p = {
      value,
      setValueAtTime(v: number) {
        p.value = v;
        return p;
      },
      linearRampToValueAtTime() {
        return p;
      },
      exponentialRampToValueAtTime() {
        return p;
      },
      cancelScheduledValues() {
        return p;
      },
    };
    return p;
  };
  const node = () => {
    log.nodes++;
    return {
      connect() {},
      disconnect() {
        log.disconnected++;
      },
    };
  };
  const source = () => ({
    ...node(),
    start() {
      log.started++;
    },
    stop() {
      log.stopped++;
    },
  });
  const ctx = {
    currentTime: 0,
    state: 'running',
    sampleRate: 8000,
    destination: {},
    createGain() {
      const gain = param(1);
      log.gains.push(gain);
      return { ...node(), gain };
    },
    createStereoPanner() {
      const pan = param();
      log.pans.push(pan);
      return { ...node(), pan };
    },
    createOscillator: () => ({
      ...source(),
      frequency: param(440),
      type: 'sine',
    }),
    createBiquadFilter: () => ({
      ...node(),
      frequency: param(),
      Q: param(),
      type: 'lowpass',
    }),
    createBufferSource: () => ({
      ...source(),
      buffer: null,
      loop: false,
      playbackRate: param(1),
    }),
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      log.buffers.push(data);
      return { getChannelData: () => data };
    },
    async resume() {
      ctx.state = 'running';
    },
    async close() {},
  };
  return { ctx: ctx as unknown as AudioBackend & { state: string }, log };
}

function setup() {
  const fake = fakeBackend();
  const bus = new EventBus();
  const t = structuredClone(tuning);
  const listener = { position: { x: 0, y: 0, z: 0 }, yaw: 0 };
  let master = 1,
    sfxVolume = 1;
  const audio = new AudioSystem(bus, loadSfx(sfx), {
    createContext: () => fake.ctx,
    tuning: t,
    listener: () => listener,
    masterVolume: () => master,
    sfxVolume: () => sfxVolume,
    seed: 'ambience-test',
  });
  return {
    fake,
    audio,
    t,
    listener,
    setVolume(m: number, s: number) {
      master = m;
      sfxVolume = s;
    },
  };
}
const source = (x = 0): AmbienceSource => ({
  kind: 'generator',
  position: { x, y: 0, z: 0 },
  radiusM: 10,
  gain: 1,
});

it('trzy frazy jukebox mają różne tempa, bufory i akordy, a źródło przekazuje track', () => {
  const { ctx, log } = fakeBackend();
  const synth = new AmbienceSynth(
    ctx,
    ctx.createBuffer(1, 1, ctx.sampleRate),
    tuning.audio,
    new Rng('tracks'),
  );
  const out = ctx.createGain();
  const graphs = [0, 1, 2].map((track) =>
    synth.create('jukebox', out, undefined, track),
  );
  const buffers = log.buffers.slice(1);
  expect(new Set(buffers.map((b) => b.length)).size).toBe(3);
  expect(tuning.audio.ambienceJukeboxPhrases.rain.chordSemitones).not.toEqual(
    tuning.audio.ambienceJukeboxChordSemitones,
  );
  expect(tuning.audio.ambienceJukeboxPhrases.dawn.chordSemitones).not.toEqual(
    tuning.audio.ambienceJukeboxChordSemitones,
  );
  const count = log.buffers.length;
  graphs.push(synth.create('jukebox', out, undefined, 1));
  expect(log.buffers).toHaveLength(count);
  for (const graph of graphs) graph.dispose();
  const a = setup();
  a.audio.setAmbience([{ ...source(), kind: 'jukebox', track: 2 }]);
  a.audio.updateAmbience(false);
  expect(a.fake.log.buffers.at(-1)!.length).toBe(buffers[2]!.length);
  a.audio.dispose();
});

it('soundscape przekazuje utwór 0→1→2→0 do źródła jukebox', () => {
  const c = setup();
  const setAmbience = vi.spyOn(c.audio, 'setAmbience');
  const soundscape = new HubSoundscape(
    {
      audio: c.audio,
      bus: new EventBus(),
      rng: new Rng('source'),
      tuning,
    } as GameContext,
    new Group(),
    loadHubLayout(hideout),
  );
  for (const track of [1, 2, 0]) {
    soundscape.setJukeboxTrack(track);
    const sources = setAmbience.mock.calls.at(-1)![0]!;
    expect(sources.find((s) => s.kind === 'jukebox')?.track).toBe(track);
  }
  soundscape.dispose();
  c.audio.dispose();
});

describe('źródła kryjówki', () => {
  it('wyciąga ogień, generatory, kapanie, parę i skupiska ekranów bez mutacji', () => {
    const layout = loadHubLayout(hideout);
    layout.fires = [{ position: { x: 1, y: 1, z: 0 } }];
    layout.blocks = [
      {
        position: { x: 2, y: 1, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        model: 'city_generator',
      },
    ];
    layout.ambientFx = [
      { kind: 'drip', position: { x: 3, y: 3, z: 0 } },
      { kind: 'steam', position: { x: 4, y: 0, z: 0 } },
      { kind: 'sparks', position: { x: 0, y: 0, z: 0 } },
    ];
    layout.panels = [0, 3, 9].map((x) => ({
      kind: 'screen',
      texture: 'screen_status',
      position: { x, y: 2, z: 0 },
      size: { w: 1, h: 1 },
      yaw: 0,
    }));
    const before = JSON.stringify(layout);
    const result = hubAmbienceSources(layout, loadAmbience(extra));
    expect(result.map((s) => s.kind)).toEqual([
      'fire',
      'generator',
      'drip',
      'steam',
      'screens',
      'screens',
      ...loadAmbience(extra).sources.map((s) => s.kind),
    ]);
    expect(
      result.filter((s) => s.kind === 'screens').map((s) => s.position.x),
    ).toEqual([1.5, 9]);
    expect(JSON.stringify(layout)).toBe(before);
    result[0]!.position.x = 99;
    expect(layout.fires[0]!.position.x).toBe(1);
  });

  it('ambience.json przechodzi walidację; nieznane pola, rodzaje, ujemne wartości i nieskończoności są błędem', () => {
    expect(loadAmbience(extra).sources.length).toBeGreaterThanOrEqual(3);
    for (const patch of [
      { kind: 'unknown' },
      { radiusM: 0 },
      { gain: -1 },
      { position: { x: Infinity, y: 0, z: 0 } },
      { typo: 1 },
    ])
      expect(() =>
        loadAmbience({ sources: [{ ...source(), ...patch }] }),
      ).toThrow();
  });
});

describe('przestrzenne otoczenie', () => {
  it('szum i losowe impulsy powtarzają się dla tego samego ziarna', () => {
    const a = setup(),
      b = setup();
    for (const c of [a, b]) {
      c.audio.setAmbience([{ ...source(), kind: 'drip' }]);
      c.audio.updateAmbience();
    }
    expect(a.fake.log.buffers).toEqual(b.fake.log.buffers);
    a.audio.dispose();
    b.audio.dispose();
  });
  it('tłumienie jest gładkie, uwzględnia wysokość, ma dokładne zero na granicy', () => {
    const origin = { x: 0, y: 0, z: 0 };
    expect(ambienceAttenuation(origin, origin, 10)).toBe(1);
    expect(ambienceAttenuation({ x: 5, y: 0, z: 0 }, origin, 10)).toBeCloseTo(
      0.5,
    );
    expect(ambienceAttenuation({ x: 0, y: 10, z: 0 }, origin, 10)).toBe(0);
    expect(ambienceAttenuation({ x: 11, y: 0, z: 0 }, origin, 10)).toBe(0);
    expect(
      selectAmbience([source(7), source(3), source(1), source(11)], origin, 2),
    ).toEqual([2, 1]);
  });

  it('grają najbliższe źródła, panorama śledzi obrót; poza zasięgiem grafy są zatrzymane i odłączone', () => {
    const c = setup();
    c.t.audio.ambienceMaxActive = 2;
    c.audio.setAmbience([source(7), source(3), source(1), source(11)]);
    c.audio.updateAmbience();
    expect(c.audio.activeAmbience.map((s) => s.gain)).toEqual([
      expect.closeTo(0.972),
      expect.closeTo(0.784),
    ]);
    expect(c.fake.log.pans.map((p) => p.value)).toEqual([
      c.t.audio.maxPan,
      c.t.audio.maxPan,
    ]);
    c.listener.yaw = Math.PI;
    c.audio.updateAmbience();
    expect(c.fake.log.pans[0]!.value).toBeCloseTo(-c.t.audio.maxPan);
    c.listener.position.x = 100;
    c.audio.updateAmbience();
    expect(c.audio.activeAmbience).toEqual([]);
    expect(c.fake.log.stopped).toBe(c.fake.log.started);
    const started = c.fake.log.started;
    for (let i = 0; i < 10; i++) c.audio.updateAmbience();
    expect(c.fake.log.started).toBe(started);
    c.audio.dispose();
  });

  it('szyna mnoży gain przez master i efekty; pauza i zawieszony kontekst zatrzymują wszystkie pętle', () => {
    const c = setup();
    c.setVolume(0.5, 0.25);
    c.audio.setAmbience([source()]);
    c.audio.updateAmbience();
    expect(c.fake.log.gains[0]!.value).toBeCloseTo(
      c.t.audio.masterGain * 0.5 * 0.25,
    );
    expect(c.fake.log.gains[1]!.value).toBe(c.t.audio.ambienceGain);
    c.audio.updateAmbience(true);
    expect(c.audio.activeAmbience).toEqual([]);
    expect(c.fake.log.stopped).toBe(c.fake.log.started);
    c.audio.updateAmbience(false);
    expect(c.audio.activeAmbience).toHaveLength(1);
    c.fake.ctx.state = 'suspended';
    c.audio.updateAmbience();
    expect(c.audio.activeAmbience).toEqual([]);
    c.audio.dispose();
  });

  it.each(ambienceKindSchema.options)(
    '%s ma graf, który setAmbience(null) i dispose całkowicie sprzątają',
    (kind) => {
      const c = setup();
      c.audio.setAmbience([{ ...source(), kind }]);
      c.audio.updateAmbience();
      expect(c.audio.activeAmbience).toHaveLength(1);
      expect(c.fake.log.started).toBeGreaterThan(0);
      c.audio.setTrainPass(0.5, c.t.hub);
      c.audio.updateAmbience();
      c.audio.setAmbience(null);
      expect(c.audio.activeAmbience).toEqual([]);
      expect(c.fake.log.stopped).toBe(c.fake.log.started);
      // Pozostaje wyłącznie wspólny master AudioSystem.
      expect(c.fake.log.disconnected).toBe(c.fake.log.nodes - 1);
      c.audio.setAmbience([{ ...source(), kind }]);
      c.audio.updateAmbience();
      c.audio.dispose();
      expect(c.fake.log.stopped).toBe(c.fake.log.started);
      expect(c.audio.activeAmbience).toEqual([]);
      const started = c.fake.log.started;
      c.audio.updateAmbience();
      expect(c.fake.log.started).toBe(started);
      for (const buffer of c.fake.log.buffers)
        expect(buffer.every(Number.isFinite)).toBe(true);
    },
  );

  it('dudnienie narasta i cichnie, przechodzi z zachodu na wschód i sprząta graf po przejeździe', () => {
    const c = setup();
    c.audio.setAmbience([]);
    c.audio.setTrainPass(0, c.t.hub);
    c.audio.updateAmbience();
    expect(c.fake.log.pans[0]!.value).toBe(-c.t.audio.maxPan);
    const trainGain = c.fake.log.gains[2]!;
    expect(trainGain.value).toBe(0);
    c.audio.setTrainPass(0.5, c.t.hub);
    c.audio.updateAmbience();
    expect(trainGain.value).toBe(c.t.hub.trainGain);
    c.audio.setTrainPass(1, c.t.hub);
    c.audio.updateAmbience();
    expect(trainGain.value).toBeCloseTo(0);
    expect(c.fake.log.pans[0]!.value).toBe(c.t.audio.maxPan);
    c.audio.setTrainPass(null, c.t.hub);
    c.audio.updateAmbience();
    expect(c.fake.log.stopped).toBe(c.fake.log.started);
    c.audio.dispose();
  });

  it('brak Web Audio jest obsłużony bez wyjątku', () => {
    const audio = new AudioSystem(new EventBus(), loadSfx(sfx), {
      createContext: () => null,
      tuning,
      masterVolume: () => 1,
    });
    audio.setAmbience([source()]);
    audio.updateAmbience();
    audio.setAmbience(null);
    audio.dispose();
    expect(audio.activeAmbience).toEqual([]);
  });
});

describe('pociąg w kryjówce', () => {
  it('harmonogram jest deterministyczny dla seeda, mieści się w zakresach i daje jeden szczyt', () => {
    function schedule(seed: string) {
      const bus = new EventBus(),
        passes: number[] = [],
        peaks: number[] = [];
      let time = 0;
      bus.on('hub_train_passed', ({ durationS }) => {
        expect(durationS).toBe(tuning.hub.trainDurationS);
        passes.push(time);
      });
      const train = new HubTrain(new Rng(seed), tuning.hub, bus);
      train.step(0);
      train.step(-1);
      for (let i = 0; i < 60 * 450; i++) {
        time = (i + 1) / 60;
        if (train.step(1 / 60)) peaks.push(time);
      }
      return { passes, peaks };
    }
    const a = schedule('metro');
    expect(a).toEqual(schedule('metro'));
    expect(a.passes).not.toEqual(schedule('other').passes);
    expect(a.passes[0]).toBeGreaterThanOrEqual(tuning.hub.trainFirstS.min);
    expect(a.passes[0]).toBeLessThanOrEqual(
      tuning.hub.trainFirstS.max + 1 / 60,
    );
    for (let i = 1; i < a.passes.length; i++) {
      const interval = a.passes[i]! - a.passes[i - 1]!;
      expect(interval).toBeGreaterThanOrEqual(tuning.hub.trainIntervalS.min);
      expect(interval).toBeLessThanOrEqual(
        tuning.hub.trainIntervalS.max + 1 / 60,
      );
    }
    expect(a.peaks.length).toBe(a.passes.length);
    expect(a.peaks[0]! - a.passes[0]!).toBeCloseTo(
      tuning.hub.trainDurationS / 2,
      1,
    );
  });

  it('hub train emituje zdarzenie, szczyt wywołuje słaby wstrząs i pulę pyłu; dispose wyrejestrowuje komendę', () => {
    const bus = new EventBus(),
      commands = new CommandRegistry(),
      parent = new Group();
    let passes = 0,
      shakes = 0;
    bus.on('hub_train_passed', () => passes++);
    bus.on('camera_shake', ({ intensity }) => {
      expect(intensity).toBeLessThan(tuning.vfx.explosionShakeIntensity);
      shakes++;
    });
    const ctx = {
      bus,
      commands,
      tuning,
      rng: new Rng('cmd'),
      loop: { paused: false },
    } as unknown as GameContext;
    const soundscape = new HubSoundscape(ctx, parent, loadHubLayout(hideout));
    expect(commands.execute('hub train extra')).toContain('Użycie');
    expect(passes).toBe(0);
    expect(commands.execute('hub train')).toContain('Pociąg');
    expect(passes).toBe(1);
    for (let i = 0; i < 220; i++) soundscape.step(1 / 60, { x: 0, y: 1, z: 0 });
    soundscape.render(0.5);
    expect(shakes).toBe(1);
    expect(parent.getObjectByName('hub-train-dust')).toHaveProperty(
      'count',
      tuning.hub.trainDustCount,
    );
    soundscape.dispose();
    expect(parent.children).toHaveLength(0);
    expect(commands.execute('hub train')).toContain('Nieznana');
  });

  it('pył używa stałej puli, jest deterministyczny i znika po czasie życia', () => {
    const layout = loadHubLayout(hideout);
    const a = new TrainDust(new Rng('dust'), tuning.hub, layout),
      b = new TrainDust(new Rng('dust'), tuning.hub, layout);
    const particles = [...a.particles];
    a.burst({ x: 0, y: 1, z: 0 });
    b.burst({ x: 0, y: 1, z: 0 });
    a.step(1 / 60);
    b.step(1 / 60);
    expect(a.particles).toEqual(b.particles);
    a.burst({ x: 0, y: 1, z: 0 });
    expect(a.particles.every((p, i) => p === particles[i])).toBe(true);
    a.step(tuning.hub.trainDustLifeS + 1);
    expect(a.particles.every((p) => p.age >= tuning.hub.trainDustLifeS)).toBe(
      true,
    );
  });
});
