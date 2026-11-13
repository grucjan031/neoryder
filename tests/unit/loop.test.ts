import { describe, expect, it, vi } from 'vitest';
import { GameLoop, SIM_DT, MAX_STEPS_PER_FRAME } from '../../src/core/loop';
import type { FrameScheduler } from '../../src/core/loop';

const frameMs = SIM_DT * 1000;
function setup() {
  const step = vi.fn();
  const render = vi.fn();
  return { step, render, loop: new GameLoop({ step, render }) };
}

describe('GameLoop', () => {
  it('hitstop wywołany w step zamraża kolejne kroki tej samej klatki', () => {
    const values: number[] = [];
    const loop = new GameLoop({
      step: (dt, tick) => {
        values.push(dt);
        if (tick === 1) loop.hitstop(frameMs * 2);
      },
      render: () => {},
    });
    loop.advance(frameMs * 3);
    expect(values).toEqual([SIM_DT, 0, 0]);
    loop.advance(frameMs);
    expect(values.at(-1)).toBe(SIM_DT);
  });
  it('akumuluje czas i renderuje z interpolacją', () => {
    const { loop, step, render } = setup();
    expect(loop.advance(frameMs / 2)).toBe(0);
    expect(render).toHaveBeenLastCalledWith(0.5, SIM_DT / 2);
    expect(loop.advance(frameMs / 2)).toBe(1);
    expect(step).toHaveBeenLastCalledWith(SIM_DT, 1);
    expect(loop.tick).toBe(1);
  });
  it('timeScale zmienia dt, zachowując częstotliwość kroków', () => {
    const { loop, step } = setup();
    loop.timeScale = 0.25;
    expect(loop.advance(frameMs * 2)).toBe(2);
    expect(step).toHaveBeenNthCalledWith(1, SIM_DT * 0.25, 1);
    expect(step).toHaveBeenNthCalledWith(2, SIM_DT * 0.25, 2);
    loop.timeScale = 0;
    loop.advance(frameMs);
    expect(step).toHaveBeenLastCalledWith(0, 3);
  });
  it('hitstop stosuje maksimum, nadal wywołuje step i wygasa w czasie rzeczywistym', () => {
    const { loop, step } = setup();
    loop.hitstop(frameMs * 2);
    loop.hitstop(frameMs);
    loop.advance(frameMs);
    expect(step).toHaveBeenLastCalledWith(0, 1);
    loop.advance(frameMs);
    expect(step).toHaveBeenLastCalledWith(0, 2);
    loop.advance(frameMs);
    expect(step).toHaveBeenLastCalledWith(SIM_DT, 3);
  });
  it('dłuższy hitstop zastępuje pozostały i nie sumuje się', () => {
    const { loop, step } = setup();
    loop.hitstop(frameMs);
    loop.hitstop(frameMs * 2);
    for (let i = 0; i < 3; i++) loop.advance(frameMs);
    expect(step.mock.calls.map(([dt]) => dt)).toEqual([0, 0, SIM_DT]);
  });
  it('ogranicza kroki i odrzuca nadmiar; hitstop nie zależy od odrzuconych kroków', () => {
    const { loop, step, render } = setup();
    loop.hitstop(200);
    expect(loop.advance(1000)).toBe(MAX_STEPS_PER_FRAME);
    expect(loop.advance(0)).toBe(0);
    loop.advance(frameMs);
    expect(step).toHaveBeenLastCalledWith(SIM_DT, MAX_STEPS_PER_FRAME + 1);
    const alpha = render.mock.lastCall?.[0] as number;
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });
  it('pauza nie akumuluje czasu i nadal renderuje', () => {
    const { loop, step, render } = setup();
    loop.paused = true;
    expect(loop.advance(5000)).toBe(0);
    expect(render).toHaveBeenCalledOnce();
    expect(step).not.toHaveBeenCalled();
    loop.paused = false;
    expect(loop.advance(frameMs)).toBe(1);
  });
  it('obsługuje Clock/scheduler, idempotentny start/stop i wznowienie bez zaległego czasu', () => {
    let now = 0;
    let callback: ((timeMs: number) => void) | undefined;
    const scheduler: FrameScheduler = {
      request: vi.fn((cb) => {
        callback = cb;
        return 7;
      }),
      cancel: vi.fn(),
    };
    const step = vi.fn();
    const loop = new GameLoop(
      { step, render: vi.fn() },
      { clock: { now: () => now }, scheduler },
    );
    loop.start();
    loop.start();
    expect(scheduler.request).toHaveBeenCalledOnce();
    now = frameMs;
    callback?.(now);
    expect(step).toHaveBeenLastCalledWith(SIM_DT, 1);
    loop.stop();
    loop.stop();
    expect(scheduler.cancel).toHaveBeenCalledOnce();
    now += 5000;
    loop.start();
    callback?.(now);
    expect(loop.tick).toBe(1);
  });
});
