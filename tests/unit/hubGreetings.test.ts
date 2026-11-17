import { afterEach, expect, it, vi } from 'vitest';
import { createHubGreetings } from '../../src/ui/hub/greetings';

afterEach(() => vi.unstubAllGlobals());

it('adapter UI czyta i zapisuje dedykowany klucz localStorage', () => {
  const values = new Map<string, string>();
  const getItem = vi.fn((key: string) => values.get(key) ?? null);
  const setItem = vi.fn((key: string, value: string) => values.set(key, value));
  vi.stubGlobal('localStorage', { getItem, setItem });
  const greetings = createHubGreetings();
  expect(greetings.last()).toBeNull();
  greetings.mark('run:10');
  expect(createHubGreetings().last()).toBe('run:10');
  expect(getItem).toHaveBeenCalledWith('neoryder.hub.greeted');
  expect(setItem).toHaveBeenCalledWith('neoryder.hub.greeted', 'run:10');
});

it.each(['missing', 'denied'])(
  'brak dostępu do localStorage (%s) daje pustą pamięć bez wyjątku',
  (mode) => {
    const denied = () => {
      throw new Error('Brak dostępu');
    };
    vi.stubGlobal(
      'localStorage',
      mode === 'missing'
        ? undefined
        : {
            getItem: denied,
            setItem: denied,
          },
    );
    const greetings = createHubGreetings();
    expect(greetings.last()).toBeNull();
    expect(() => greetings.mark('run:1')).not.toThrow();
    expect(greetings.last()).toBeNull();
  },
);
