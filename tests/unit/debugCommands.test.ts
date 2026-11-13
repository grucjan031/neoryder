import { describe, expect, it, vi } from 'vitest';
import {
  CommandRegistry,
  defaultCommands,
  registerCommand,
} from '../../src/ui/debugCommands';

describe('CommandRegistry', () => {
  it('registers commands, preserves arguments and matches two words first', () => {
    const registry = new CommandRegistry();
    const run = vi.fn((args: string[]) => args.join(','));
    registry.register('spawn', 'spawn <kind>', () => 'one');
    registry.register('spawn cube', 'spawn cube <name>', run);
    expect(registry.execute(' SPAWN   CUBE MixedCase 2 ')).toBe('MixedCase,2');
    expect(run).toHaveBeenCalledWith(['MixedCase', '2']);
    expect(registry.execute('spawn other')).toBe('one');
  });

  it('unsubscribes, handles unknown commands and isolates registries', () => {
    const registry = new CommandRegistry();
    const off = registry.register('test', 'test', () => 'ok');
    expect(registry.execute('test')).toBe('ok');
    expect(new CommandRegistry().execute('test')).toBe(
      'Nieznana komenda. Wpisz help.',
    );
    off();
    off();
    for (const line of ['test', '', 'missing command'])
      expect(registry.execute(line)).toBe('Nieznana komenda. Wpisz help.');
  });

  it('overwrites duplicates with a warning and protects the replacement from old unsubscribe', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const registry = new CommandRegistry();
      const off = registry.register('test', 'old', () => 'old');
      registry.register(' TEST ', 'new', () => 'new');
      expect(warn).toHaveBeenCalledOnce();
      off();
      expect(registry.execute('test')).toBe('new');
      expect(registry.help()).toBe('new');
    } finally {
      warn.mockRestore();
    }
  });

  it('returns errors without throwing and continues executing', () => {
    const registry = new CommandRegistry();
    registry.register('fail', 'fail', () => {
      throw new Error('boom');
    });
    registry.register('text', 'text', () => {
      throw 'failure';
    });
    registry.register('ok', 'ok', () => 'ok');
    expect(registry.execute('fail')).toContain('boom');
    expect(registry.execute('text')).toContain('failure');
    expect(registry.execute('ok')).toBe('ok');
  });

  it('generates help from current registrations', () => {
    const registry = new CommandRegistry();
    registry.register('help', 'help', () => registry.help());
    const off = registry.register('hit', 'hit <dmg>', () => 'hit');
    expect(registry.execute('help')).toBe('help · hit <dmg>');
    off();
    expect(registry.help()).toBe('help');
  });

  it('exports the API registration helper and validates names', () => {
    const off = registerCommand('contract', 'contract', () => 'ok');
    expect(defaultCommands.execute('contract')).toBe('ok');
    off();
    const registry = new CommandRegistry();
    expect(() => registry.register('', '', () => '')).toThrow();
    expect(() => registry.register('one two three', '', () => '')).toThrow();
  });
});
