import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { FeelSystem } from '../../src/core/feel';
import { tuning } from '../../src/core/tuning';

function setup() {
  const t = structuredClone(tuning);
  const bus = new EventBus();
  const hitstops: number[] = [];
  const loop = {
    paused: false,
    timeScale: 1,
    hitstop: (ms: number) => hitstops.push(ms),
  };
  const feel = new FeelSystem(bus, loop, t);
  const run = (seconds: number, frame = 1 / 60) => {
    for (let s = 0; s < seconds - 1e-9; s += frame) feel.update(frame);
  };
  return { t, bus, loop, feel, hitstops, run };
}

describe('FeelSystem', () => {
  it('zdarzenie hitstop wywołuje loop.hitstop raz na zdarzenie', () => {
    const c = setup();
    c.bus.emit('hitstop', { ms: c.t.time.hitstopLightMs });
    c.bus.emit('hitstop', { ms: c.t.time.hitstopHeavyMs });
    expect(c.hitstops).toEqual([40, 80]);
  });

  it('hitstop ignorowany w pauzie', () => {
    const c = setup();
    c.loop.paused = true;
    c.bus.emit('hitstop', { ms: 80 });
    expect(c.hitstops).toEqual([]);
  });

  it('wave_last_kill: timeScale 0,2 przez 0,3 s czasu rzeczywistego, potem płynny powrót do 1', () => {
    const c = setup();
    c.bus.emit('wave_last_kill', { wave: 1, id: 5 });
    expect(c.loop.timeScale).toBe(c.t.time.lastKillTimeScale);
    c.run(c.t.time.lastKillSlowmoS - 0.02);
    expect(c.loop.timeScale).toBe(c.t.time.lastKillTimeScale);
    c.run(0.05);
    const mid = c.loop.timeScale;
    expect(mid).toBeGreaterThan(c.t.time.lastKillTimeScale);
    expect(mid).toBeLessThan(1);
    c.run(c.t.time.slowmoRecoverS + 0.05);
    expect(c.loop.timeScale).toBe(1);
  });

  it('kumulacja spowolnień: mocniejsze wygrywa, czas jako max', () => {
    const c = setup();
    c.bus.emit('slowmo', { timeScale: 0.5, durationS: 1 });
    c.bus.emit('slowmo', { timeScale: 0.2, durationS: 0.2 });
    expect(c.loop.timeScale).toBe(0.2);
    c.run(0.5);
    expect(c.loop.timeScale).toBe(0.2);
  });

  it('pauza zatrzymuje upływ spowolnienia', () => {
    const c = setup();
    c.bus.emit('slowmo', { timeScale: 0.2, durationS: 0.3 });
    c.loop.paused = true;
    c.run(2);
    c.loop.paused = false;
    expect(c.loop.timeScale).toBe(0.2);
  });

  it('baseTimeScale (komenda timescale) jest celem powrotu, reset przywraca bazę', () => {
    const c = setup();
    c.feel.baseTimeScale = 0.5;
    c.run(0.1);
    expect(c.loop.timeScale).toBe(0.5);
    c.bus.emit('slowmo', { timeScale: 0.1, durationS: 5 });
    c.feel.reset();
    expect(c.loop.timeScale).toBe(0.5);
  });
});
