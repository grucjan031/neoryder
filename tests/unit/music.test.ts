import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { loadSettings } from '../../src/core/save';
import { tuning } from '../../src/core/tuning';
import { MusicSystem } from '../../src/audio/music';
import type { MusicTimer } from '../../src/audio/music';
import { MusicDirector } from '../../src/audio/musicDirector';
import {
  ALL_MUSIC_LOOPS,
  CALM_VARIANTS,
  MUSIC_LOOPS,
  compileTrack,
  loadMusic,
  noteToMidi,
} from '../../src/audio/musicSchema';
import type { MusicState } from '../../src/audio/musicSchema';
import type { AudioBackend } from '../../src/audio/synth';
import musicData from '../../src/data/audio/music.json';

const clone = (): typeof musicData => structuredClone(musicData);

describe('schemat muzyki', () => {
  it('przyjmuje dane gry i trzyma tempa oraz długości z kontraktu', () => {
    const def = loadMusic(musicData);
    const range = { calm: [70, 80], combat: [120, 130], boss: [135, 145] };
    for (const id of MUSIC_LOOPS) {
      const loop = def.loops[id];
      expect(loop.bpm).toBeGreaterThanOrEqual(range[id][0] as number);
      expect(loop.bpm).toBeLessThanOrEqual(range[id][1] as number);
      expect(loop.bars).toBeGreaterThanOrEqual(8);
      expect(loop.bars).toBeLessThanOrEqual(16);
      for (const track of loop.tracks)
        expect(compileTrack(loop, track).length).toBeGreaterThan(0);
    }
  });

  it('warianty spokoju szafy mają inne tempo niż calm i poprawne wzorce', () => {
    const def = loadMusic(musicData);
    expect(ALL_MUSIC_LOOPS).toHaveLength(MUSIC_LOOPS.length + 2);
    const bpms = new Set<number>([def.loops.calm.bpm]);
    for (const id of CALM_VARIANTS) {
      const loop = def.loops[id];
      bpms.add(loop.bpm);
      for (const track of loop.tracks)
        expect(compileTrack(loop, track).length).toBeGreaterThan(0);
    }
    expect(bpms.size).toBe(3);
  });

  it('parsuje nazwy nut', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C#3')).toBe(49);
    expect(noteToMidi('Bb1')).toBe(34);
    expect(Number.isNaN(noteToMidi('H2'))).toBe(true);
  });

  it('odrzuca błędne dane', () => {
    const bad: ((d: ReturnType<typeof clone>) => void)[] = [
      (d) => {
        d.loops.calm.tracks[0]!.pattern[0] = 'A1 A1';
      },
      (d) => {
        d.loops.combat.tracks[0]!.pattern.push(
          'x . . . x . . . x . . . x . . .',
        );
        d.loops.combat.tracks[0]!.pattern.push(
          'x . . . x . . . x . . . x . . .',
        );
        d.loops.combat.tracks[0]!.pattern.push(
          'x . . . x . . . x . . . x . . .',
        );
      },
      (d) => {
        d.loops.boss.tracks[3]!.pattern[0] = Array(16).fill('H9').join(' ');
      },
      (d) => {
        d.loops.boss.tracks[0]!.pattern[0] = Array(16).fill('z').join(' ');
      },
      (d) => {
        d.loops.calm.bpm = 5;
      },
      (d) => {
        d.loops.calm.bars = 40;
      },
      (d) => {
        d.loops.calm.tracks[1]!.id = d.loops.calm.tracks[0]!.id;
      },
      (d) => {
        delete (d.loops as Partial<typeof d.loops>).boss;
      },
      (d) => {
        (d as Record<string, unknown>).nieznane = 1;
      },
      (d) => {
        d.fadeS = 0;
      },
    ];
    for (const mutate of bad) {
      const d = clone();
      mutate(d);
      expect(() => loadMusic(d)).toThrow();
    }
  });
});

describe('MusicDirector', () => {
  function setup(hold = 4) {
    const bus = new EventBus();
    let now = 0;
    const states: MusicState[] = [];
    const director = new MusicDirector(bus, {
      now: () => now,
      onState: (s) => states.push(s),
      combatHoldS: hold,
    });
    bus.emit('entity_spawned', { id: 1, kind: 'player' });
    return {
      bus,
      director,
      states,
      advance: (s: number) => {
        now += s;
        director.poll();
      },
    };
  }
  const hit = (source: number | null, target: number) => ({
    source,
    target,
    amount: 5,
    tags: [],
    point: null,
    dir: null,
    knockback: 0,
    killed: false,
  });

  it('startuje w calm', () => {
    const { states, director } = setup();
    expect(director.state).toBe('calm');
    expect(states).toEqual(['calm']);
  });

  it('fala = walka, a po wave_cleared walka trwa jeszcze czas histerezy', () => {
    const { bus, director, advance } = setup();
    bus.emit('wave_started', { wave: 1, count: 3 });
    expect(director.state).toBe('combat');
    advance(60);
    expect(director.state).toBe('combat');
    bus.emit('wave_cleared', { wave: 1 });
    expect(director.state).toBe('combat');
    advance(3.9);
    expect(director.state).toBe('combat');
    advance(0.2);
    expect(director.state).toBe('calm');
  });

  it('obrażenia z udziałem gracza wydłużają walkę, obce nie', () => {
    const { bus, director, advance } = setup();
    bus.emit('damage_dealt', hit(5, 6));
    expect(director.state).toBe('calm');
    bus.emit('damage_dealt', hit(1, 6));
    expect(director.state).toBe('combat');
    advance(3);
    bus.emit('damage_dealt', hit(7, 1));
    advance(3);
    expect(director.state).toBe('combat');
    advance(1.5);
    expect(director.state).toBe('calm');
  });

  it('boss ma priorytet nad walką i po jego śmierci wraca przez walkę do calm', () => {
    const { bus, director, advance } = setup();
    bus.emit('wave_started', { wave: 1, count: 1 });
    bus.emit('boss_spawned', {
      id: 9,
      name: 'B',
      maxHealth: 100,
      phaseThresholds: [],
    });
    expect(director.state).toBe('boss');
    bus.emit('wave_cleared', { wave: 1 });
    advance(30);
    expect(director.state).toBe('boss');
    bus.emit('enemy_killed', { id: 9, killer: 1, tags: [] });
    expect(director.state).toBe('combat');
    advance(4.1);
    expect(director.state).toBe('calm');
  });

  it('śmierć gracza i koniec runu wyciszają do calm, aż do nowej sceny', () => {
    const { bus, director } = setup();
    bus.emit('boss_spawned', {
      id: 9,
      name: 'B',
      maxHealth: 100,
      phaseThresholds: [],
    });
    bus.emit('player_died', { id: 1 });
    expect(director.state).toBe('calm');
    bus.emit('wave_started', { wave: 2, count: 1 });
    bus.emit('damage_dealt', hit(1, 6));
    expect(director.state).toBe('calm');
    bus.emit('scene_loaded', { sceneId: 'arena' });
    bus.emit('wave_started', { wave: 1, count: 1 });
    expect(director.state).toBe('combat');
  });

  it('override wymusza stan (także off), null wraca do automatu', () => {
    const { bus, director, states } = setup();
    director.setOverride('boss');
    expect(director.state).toBe('boss');
    director.setOverride('off');
    expect(states.at(-1)).toBe('off');
    bus.emit('wave_started', { wave: 1, count: 1 });
    director.setOverride(null);
    expect(director.state).toBe('combat');
  });

  it('szafa grająca przełącza utwór spokoju po kolei i wraca do calm', () => {
    const { bus, director, states } = setup();
    const use = () =>
      bus.emit('hub_prop_used', { prop: 'jukebox', kind: 'jukebox' });
    use();
    expect(director.state).toBe('calmRain');
    use();
    expect(director.state).toBe('calmDawn');
    use();
    expect(director.state).toBe('calm');
    use();
    expect(states.slice(-2)).toEqual(['calm', 'calmRain']);
  });

  it('inne rekwizyty nie ruszają muzyki, a walka ma pierwszeństwo przed utworem szafy', () => {
    const { bus, director } = setup();
    bus.emit('hub_prop_used', { prop: 'radio', kind: 'radio' });
    expect(director.state).toBe('calm');
    bus.emit('hub_prop_used', { prop: 'jukebox', kind: 'jukebox' });
    bus.emit('wave_started', { wave: 1, count: 1 });
    expect(director.state).toBe('combat');
    bus.emit('wave_cleared', { wave: 1 });
    bus.emit('scene_loaded', { sceneId: 'hub' });
    expect(director.state).toBe('calm');
    expect(director.jukeboxTrack).toBe(0);
  });

  it('dispose odpina słuchaczy', () => {
    const { bus, director } = setup();
    director.dispose();
    bus.emit('wave_started', { wave: 1, count: 1 });
    expect(director.state).toBe('calm');
  });
});

/** Atrapa Web Audio z zapisem planowania nut i rampy głośności. */
function fakeContext() {
  const log = {
    oscStarts: [] as number[],
    gains: [] as ReturnType<typeof param>[],
    disconnected: 0,
    destinationConnections: 0,
  };
  function param(initial = 0) {
    const p = {
      value: initial,
      ramps: [] as { v: number; t: number }[],
      setValueAtTime: (v: number) => {
        p.value = v;
        return p;
      },
      linearRampToValueAtTime: (v: number, t: number) => {
        p.ramps.push({ v, t });
        return p;
      },
      exponentialRampToValueAtTime: () => p,
      cancelScheduledValues: () => p,
    };
    return p;
  }
  const destination = {
    connect: () => undefined,
    disconnect: () => undefined,
  };
  const node = () => ({
    connect: (target: unknown) => {
      if (target === destination) log.destinationConnections++;
    },
    disconnect: () => {
      log.disconnected++;
    },
  });
  const source = () => ({
    ...node(),
    start: (t: number) => {
      log.oscStarts.push(t);
    },
    stop: () => undefined,
  });
  const ctx = {
    currentTime: 0,
    state: 'running',
    sampleRate: 8000,
    destination,
    createGain: () => {
      const gain = param(1);
      log.gains.push(gain);
      return { ...node(), gain };
    },
    createOscillator: () => ({
      ...source(),
      type: 'sine',
      frequency: param(440),
      detune: param(0),
    }),
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
    createStereoPanner: () => ({ ...node(), pan: param(0) }),
    resume: async () => undefined,
  };
  return { ctx: ctx as unknown as AudioBackend & { currentTime: number }, log };
}

function manualTimer() {
  const handles = new Map<number, () => void>();
  let next = 1;
  const timer: MusicTimer = {
    set: (fn) => {
      handles.set(next, fn);
      return next++;
    },
    clear: (h) => {
      handles.delete(h as number);
    },
  };
  return {
    timer,
    active: () => handles.size,
    tick: () => handles.forEach((f) => f()),
  };
}

function setupMusic(master = 1, musicVolume = 1) {
  const fake = fakeContext();
  const t = manualTimer();
  let ticks = 0;
  const music = new MusicSystem(loadMusic(musicData), {
    getContext: () => fake.ctx,
    tuning,
    masterVolume: () => master,
    musicVolume: () => musicVolume,
    timer: t.timer,
    onTick: () => {
      ticks++;
    },
  });
  return { music, fake, t, ticks: () => ticks };
}

describe('MusicSystem', () => {
  it('bez stanu nic nie planuje i nie tworzy kontekstu', () => {
    const { music, fake } = setupMusic();
    music.update();
    expect(fake.log.oscStarts).toHaveLength(0);
    expect(music.playing).toBeNull();
  });

  it('planuje nuty z wyprzedzeniem i nie dubluje ich przy kolejnych tyknięciach', () => {
    const { music, fake } = setupMusic();
    music.setState('calm');
    music.update();
    const first = fake.log.oscStarts.length;
    expect(first).toBeGreaterThan(0);
    // Planowanie sięga najwyżej lookahead (1,5 s) + krok w przód.
    expect(Math.max(...fake.log.oscStarts)).toBeLessThanOrEqual(1.5 + 0.1);
    music.update();
    expect(fake.log.oscStarts).toHaveLength(first);
    fake.ctx.currentTime = 1;
    music.update();
    expect(fake.log.oscStarts.length).toBeGreaterThan(first);
    for (let i = 1; i < fake.log.oscStarts.length; i++)
      expect(fake.log.oscStarts[i]!).toBeGreaterThanOrEqual(0);
    expect(Math.max(...fake.log.oscStarts)).toBeLessThanOrEqual(2.6);
  });

  it('tyknięcie harmonogramu woła onTick', () => {
    const { music, t, ticks } = setupMusic();
    t.tick();
    t.tick();
    expect(ticks()).toBe(2);
    music.dispose();
  });

  it('crossfade: stara szyna cichnie, nowa narasta, potem stara jest odpinana', () => {
    const { music, fake } = setupMusic();
    music.setState('calm');
    music.update();
    const oldBus = fake.log.gains[1]!; // [0] = wyjście, [1] = szyna calm
    expect(oldBus.ramps.at(-1)).toEqual({ v: 1, t: 1.8 });
    fake.ctx.currentTime = 10;
    music.setState('combat');
    expect(music.playing).toBe('combat');
    expect(oldBus.ramps.at(-1)?.v).toBe(0);
    expect(oldBus.ramps.at(-1)!.t).toBeCloseTo(11.8);
    const newBus = fake.log.gains.at(-1)!;
    expect(newBus).not.toBe(oldBus);
    expect(newBus.ramps.at(-1)).toEqual({ v: 1, t: 11.8 });
    const before = fake.log.disconnected;
    fake.ctx.currentTime = 12.5;
    music.update();
    expect(fake.log.disconnected).toBeGreaterThan(before);
  });

  it('off wycisza i zatrzymuje planowanie', () => {
    const { music, fake } = setupMusic();
    music.setState('boss');
    music.update();
    music.setState('off');
    expect(music.playing).toBeNull();
    const n = fake.log.oscStarts.length;
    fake.ctx.currentTime = 5;
    music.update();
    expect(fake.log.oscStarts).toHaveLength(n);
  });

  it('głośność = masterGain × master × music × musicGain', () => {
    const { music, fake } = setupMusic(0.5, 0.4);
    music.setState('calm');
    music.update();
    const expected =
      tuning.audio.masterGain * 0.5 * 0.4 * tuning.audio.musicGain;
    expect(fake.log.gains[0]!.value).toBeCloseTo(expected, 6);
  });

  it('dispose czyści zegar, odpina wyjście i nic już nie planuje', () => {
    const { music, fake, t } = setupMusic();
    music.setState('combat');
    music.update();
    expect(t.active()).toBe(1);
    music.dispose();
    expect(t.active()).toBe(0);
    expect(fake.log.gains[0]!.value).toBe(0);
    const n = fake.log.oscStarts.length;
    fake.ctx.currentTime = 20;
    music.update();
    music.setState('boss');
    expect(fake.log.oscStarts).toHaveLength(n);
  });

  it('działa bez Web Audio (getContext zwraca null)', () => {
    const music = new MusicSystem(loadMusic(musicData), {
      getContext: () => null,
      tuning,
      masterVolume: () => 1,
      musicVolume: () => 1,
      timer: manualTimer().timer,
    });
    expect(() => {
      music.setState('combat');
      music.update();
    }).not.toThrow();
    expect(music.playing).toBeNull();
  });
});

describe('ustawienie musicVolume', () => {
  const storage = (raw: string | null): Storage =>
    ({ getItem: () => raw }) as unknown as Storage;

  it('ma wartość domyślną', () => {
    expect(loadSettings(storage(null)).musicVolume).toBe(0.7);
    expect(loadSettings(storage('{"masterVolume":0.4}')).musicVolume).toBe(0.7);
  });

  it('naprawia błędną wartość przez catch, zachowuje poprawną', () => {
    expect(loadSettings(storage('{"musicVolume":"głośno"}')).musicVolume).toBe(
      0.7,
    );
    expect(loadSettings(storage('{"musicVolume":3}')).musicVolume).toBe(0.7);
    expect(loadSettings(storage('{"musicVolume":0.25}')).musicVolume).toBe(
      0.25,
    );
  });
});
