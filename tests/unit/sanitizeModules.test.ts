import { describe, expect, it, vi } from 'vitest';
import { sanitizeModules } from '../../src/progression/moduleSchema';

vi.mock('../../src/data/meta/progression.json', async (importOriginal) => {
  const original = await importOriginal<{
    default: typeof import('../../src/data/meta/progression.json');
  }>();
  return {
    default: { ...original.default, moduleSlotsPerWeapon: 2 },
  };
});

describe('sanitizeModules', () => {
  it('pomija nieznane i niepasujące moduły bez zajmowania slotu', () => {
    expect(
      sanitizeModules(['beam'], {
        beam: [
          'unknown',
          'ricochet',
          'superconductor',
          'collimator',
          'incendiary',
        ],
      }),
    ).toEqual({ beam: ['collimator', 'incendiary'] });
  });

  it('zachowuje pierwszy wpis slotu i kolejność wejścia, bez duplikatów', () => {
    expect(
      sanitizeModules(['blaster'], {
        blaster: [
          'incendiary',
          'incendiary',
          'superconductor',
          'pierce',
          'ricochet',
        ],
      }),
    ).toEqual({ blaster: ['incendiary', 'pierce'] });
  });

  it('respektuje limit z danych także gdy jest niższy niż liczba slotów', () => {
    expect(
      sanitizeModules(['blaster'], {
        blaster: ['scope', 'incendiary', 'pierce'],
      }),
    ).toEqual({ blaster: ['scope', 'incendiary'] });
  });

  it('usuwa broń spoza ekwipunku i nie mutuje ani nie współdzieli tablic wejścia', () => {
    const modules = Object.freeze({
      blaster: Object.freeze(['pierce']),
      pistol: Object.freeze(['ricochet']),
    });
    const result = sanitizeModules(Object.freeze(['blaster']), modules);
    expect(result).toEqual({ blaster: ['pierce'] });
    result.blaster!.push('incendiary');
    expect(modules.blaster).toEqual(['pierce']);
    expect(sanitizeModules([], modules)).toEqual({});
    expect(sanitizeModules(['blaster'], undefined)).toEqual({});
  });
});
