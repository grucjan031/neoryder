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
  it('emituje i odbiera wszystkie zdarzenia pętli runu F3', () => {
    const bus = new EventBus();
    const received: { type: string; payload: unknown }[] = [];
    const summary = {
      outcome: 'victory' as const,
      seed: 'seed-1',
      loadoutId: 'classic',
      elapsedS: 920,
      kills: 42,
      roomsCleared: 8,
      layerReached: 8,
      implants: ['overclock'],
      damage: { melee: 500, power: 300, gun: 200, other: 50 },
    };

    bus.on('node_selected', (payload) =>
      received.push({ type: 'node_selected', payload }),
    );
    bus.on('room_entered', (payload) =>
      received.push({ type: 'room_entered', payload }),
    );
    bus.on('room_cleared', (payload) =>
      received.push({ type: 'room_cleared', payload }),
    );
    bus.on('reward_offered', (payload) =>
      received.push({ type: 'reward_offered', payload }),
    );
    bus.on('implant_acquired', (payload) =>
      received.push({ type: 'implant_acquired', payload }),
    );
    bus.on('currency_changed', (payload) =>
      received.push({ type: 'currency_changed', payload }),
    );
    bus.on('shop_purchase', (payload) =>
      received.push({ type: 'shop_purchase', payload }),
    );
    bus.on('rest_used', (payload) =>
      received.push({ type: 'rest_used', payload }),
    );
    bus.on('boss_spawned', (payload) =>
      received.push({ type: 'boss_spawned', payload }),
    );
    bus.on('boss_phase', (payload) =>
      received.push({ type: 'boss_phase', payload }),
    );
    bus.on('run_ended', (payload) =>
      received.push({ type: 'run_ended', payload }),
    );

    bus.emit('node_selected', { nodeId: 'L1N0', type: 'combat' });
    bus.emit('room_entered', {
      nodeId: 'L1N0',
      roomId: 'combatYard',
      type: 'combat',
      layer: 1,
    });
    bus.emit('room_cleared', { nodeId: 'L1N0', type: 'combat', timeS: 48.5 });
    bus.emit('reward_offered', {
      nodeId: 'L1N0',
      options: ['overclock', 'capacitor', 'gyro'],
    });
    bus.emit('implant_acquired', {
      id: 'overclock',
      rarity: 'rare',
      source: 'reward',
    });
    bus.emit('currency_changed', {
      currency: 'credits',
      amount: 120,
      delta: 30,
    });
    bus.emit('shop_purchase', {
      item: 'overclock',
      kind: 'implant',
      price: 80,
    });
    bus.emit('rest_used', { choice: 'upgrade', implant: 'overclock' });
    bus.emit('boss_spawned', {
      id: 99,
      name: 'Dyrektor Ochrony',
      maxHealth: 800,
      phaseThresholds: [0.65, 0.3],
    });
    bus.emit('boss_phase', { id: 99, phase: 2, phases: 3 });
    bus.emit('run_ended', { outcome: 'victory', summary });

    expect(received).toEqual([
      {
        type: 'node_selected',
        payload: { nodeId: 'L1N0', type: 'combat' },
      },
      {
        type: 'room_entered',
        payload: {
          nodeId: 'L1N0',
          roomId: 'combatYard',
          type: 'combat',
          layer: 1,
        },
      },
      {
        type: 'room_cleared',
        payload: { nodeId: 'L1N0', type: 'combat', timeS: 48.5 },
      },
      {
        type: 'reward_offered',
        payload: {
          nodeId: 'L1N0',
          options: ['overclock', 'capacitor', 'gyro'],
        },
      },
      {
        type: 'implant_acquired',
        payload: { id: 'overclock', rarity: 'rare', source: 'reward' },
      },
      {
        type: 'currency_changed',
        payload: { currency: 'credits', amount: 120, delta: 30 },
      },
      {
        type: 'shop_purchase',
        payload: { item: 'overclock', kind: 'implant', price: 80 },
      },
      {
        type: 'rest_used',
        payload: { choice: 'upgrade', implant: 'overclock' },
      },
      {
        type: 'boss_spawned',
        payload: { id: 99, name: 'Dyrektor Ochrony', maxHealth: 800, phaseThresholds: [0.65, 0.3] },
      },
      {
        type: 'boss_phase',
        payload: { id: 99, phase: 2, phases: 3 },
      },
      {
        type: 'run_ended',
        payload: { outcome: 'victory', summary },
      },
    ]);
  });
});
