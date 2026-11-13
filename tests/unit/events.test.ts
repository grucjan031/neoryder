import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';

describe('EventBus', () => {
  it('emituje synchronicznie w kolejności rejestracji', () => {
    const bus = new EventBus();
    const calls: string[] = [];
    bus.on('run_started', ({ seed }) => calls.push(seed));
    bus.on('run_started', () => calls.push('drugi'));
    bus.emit('run_started', { seed: 'pierwszy' });
    expect(calls).toEqual(['pierwszy', 'drugi']);
  });
  it('once działa raz również przy rekurencyjnej emisji i można go odpiąć przez off', () => {
    const bus = new EventBus();
    const handler = vi.fn(() => bus.emit('hitstop', { ms: 1 }));
    bus.once('hitstop', handler);
    bus.emit('hitstop', { ms: 2 });
    bus.emit('hitstop', { ms: 3 });
    expect(handler).toHaveBeenCalledOnce();
    bus.once('hitstop', handler);
    bus.off('hitstop', handler);
    bus.emit('hitstop', { ms: 4 });
    expect(handler).toHaveBeenCalledOnce();
  });
  it('off, unsubscribe i clear usuwają subskrypcje', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const off = bus.on('hitstop', handler);
    off();
    off();
    bus.emit('hitstop', { ms: 0 });
    bus.on('hitstop', handler);
    bus.off('hitstop', handler);
    bus.emit('hitstop', { ms: 0 });
    bus.on('hitstop', handler);
    bus.clear();
    bus.emit('hitstop', { ms: 0 });
    expect(handler).not.toHaveBeenCalled();
  });
  it('iteruje po kopii przy odpinaniu i dodawaniu w trakcie emisji', () => {
    const bus = new EventBus();
    const second = vi.fn();
    const added = vi.fn();
    bus.once('hitstop', () => {
      bus.off('hitstop', second);
      bus.on('hitstop', added);
    });
    bus.on('hitstop', second);
    bus.emit('hitstop', { ms: 1 });
    expect(second).toHaveBeenCalledOnce();
    expect(added).not.toHaveBeenCalled();
    bus.emit('hitstop', { ms: 1 });
    expect(second).toHaveBeenCalledOnce();
    expect(added).toHaveBeenCalledOnce();
  });
  it('loguje wyjątek i wywołuje pozostałych', () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const bus = new EventBus();
      const error = new Error('test');
      const next = vi.fn();
      bus.on('hitstop', () => {
        throw error;
      });
      bus.on('hitstop', next);
      bus.emit('hitstop', { ms: 1 });
      expect(logger).toHaveBeenCalledWith(error);
      expect(next).toHaveBeenCalledOnce();
    } finally {
      logger.mockRestore();
    }
  });
});
