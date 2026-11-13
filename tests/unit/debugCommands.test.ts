import { describe, expect, it, vi } from 'vitest';
import {
  parseCommand,
  createCommandExecutor,
} from '../../src/ui/debugCommands';

describe('komendy debug', () => {
  it.each([
    ['help', { type: 'help' }],
    [' reset ', { type: 'reset' }],
    ['SEED', { type: 'seed' }],
    [' spawn  cube ', { type: 'spawnCube' }],
    ['timescale 0.2', { type: 'timescale', value: 0.2 }],
    ['timescale 0', { type: 'timescale', value: 0 }],
    ['hitstop 80', { type: 'hitstop', value: 80 }],
  ])('parsuje %s', (line, expected) => {
    expect(parseCommand(line)).toEqual(expected);
  });
  it.each([
    '',
    'spawn enemy',
    'reset extra',
    'help extra',
    'timescale',
    'timescale -1',
    'timescale NaN',
    'timescale Infinity',
    'hitstop -10',
    'hitstop 3 extra',
  ])('odrzuca %s', (line) => {
    expect(parseCommand(line).type).toBe('error');
  });
  it('ta sama funkcja wykonuje efekty i zwraca wynik do konsoli oraz debug handle', () => {
    const actions = {
      reset: vi.fn(),
      spawnCube: vi.fn(() => true),
      seed: 'run-1',
      timescale: vi.fn(),
      hitstop: vi.fn(),
    };
    const command = createCommandExecutor(actions);
    expect(command('seed')).toBe('run-1');
    expect(command('help')).toContain('spawn cube');
    command('reset');
    expect(actions.reset).toHaveBeenCalledOnce();
    command('spawn cube');
    expect(actions.spawnCube).toHaveBeenCalledOnce();
    command('timescale 0.3');
    expect(actions.timescale).toHaveBeenCalledWith(0.3);
    command('hitstop 40');
    expect(actions.hitstop).toHaveBeenCalledWith(40);
    command('timescale -2');
    expect(actions.timescale).toHaveBeenCalledOnce();
    actions.spawnCube.mockReturnValue(false);
    expect(command('spawn cube')).toContain('limit');
  });
});
