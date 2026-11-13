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
    ['tp -2 5 0', { type: 'teleport', position: { x: -2, y: 5, z: 0 } }],
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
    'tp 0 5',
    'tp 0 5 0 extra',
    'tp 0 NaN 0',
    'tp Infinity 5 0',
  ])('odrzuca %s', (line) => {
    expect(parseCommand(line).type).toBe('error');
  });
  it('tp jest opcjonalne dla sandboxa i przekazuje współrzędne tylko obsługującej scenie', () => {
    const actions = {
      reset: vi.fn(),
      spawnCube: vi.fn(() => false),
      seed: 'tp',
      timescale: vi.fn(),
      hitstop: vi.fn(),
    };
    expect(createCommandExecutor(actions)('tp 0 5 0')).toContain('niedostępny');
    const teleport = vi.fn();
    const command = createCommandExecutor({ ...actions, teleport });
    expect(command('help')).toContain('tp <x> <y> <z>');
    expect(command('tp -2 5 0')).toBe('Gracz teleportowany.');
    expect(teleport).toHaveBeenCalledExactlyOnceWith({ x: -2, y: 5, z: 0 });
    command('tp 0 NaN 0');
    expect(teleport).toHaveBeenCalledTimes(1);
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
