import { describe, expect, it } from 'vitest';
import {
  bladeDefinitions,
  bladeSchema,
} from '../../src/combat/melee/bladeSchema';
import {
  powerDefinitions,
  powerSchema,
} from '../../src/combat/powers/registry';
import type { PowerDefinition } from '../../src/combat/powers/registry';
import type { ChainPowerDefinition } from '../../src/combat/powers/powerSchema';
import {
  weaponDefinitions,
  weaponSchema,
} from '../../src/combat/weapons/weaponSchema';
import type { DefinitionPatch } from '../../src/core/metaTypes';
import { loadLoadout } from '../../src/progression/loadout';
import { applyPatches, resolveLoadout } from '../../src/progression/patches';

const patch = (
  target: DefinitionPatch['target'],
  op: DefinitionPatch['op'],
  path: string,
  value: unknown,
): DefinitionPatch => ({ target, op, path, value });

const chain = powerDefinitions.get('chain') as ChainPowerDefinition;
const blaster = weaponDefinitions.get('blaster')!;
const twin = bladeDefinitions.get('twinBlades')!;

const loadout = loadLoadout({
  id: 'custom',
  name: 'Test',
  blade: 'twinBlades',
  weapons: ['blaster', 'pistol'],
  powers: ['chain', 'push'],
  tags: [],
});

function chainOf(resolved: ReturnType<typeof resolveLoadout>): PowerDefinition {
  return resolved.powers.find((power) => power.id === 'chain')!;
}

describe('applyPatches', () => {
  it('add, mul i set zmieniają kopię i nie ruszają definicji globalnej', () => {
    const snapshot = structuredClone(chain);
    const result = applyPatches(
      chain,
      powerSchema,
      [
        patch('power:chain', 'add', 'jumps', 1),
        patch('power:chain', 'mul', 'damage', 1.5),
        patch('power:chain', 'set', 'cooldownS', 0.2),
      ],
      'test',
    ) as typeof chain;
    expect(result).not.toBe(chain);
    expect(result.jumps).toBe(chain.jumps + 1);
    expect(result.damage).toBe(chain.damage * 1.5);
    expect(result.cooldownS).toBe(0.2);
    expect(chain).toEqual(snapshot);
    expect(powerDefinitions.get('chain')).toBe(chain);
    expect(powerSchema.safeParse(result).success).toBe(true);
  });

  it('indeksuje tablice segmentem liczbowym', () => {
    const snapshot = structuredClone(twin);
    const result = applyPatches(
      twin,
      bladeSchema,
      [
        patch('blade:twinBlades', 'add', 'combo.2.knockback', 3),
        patch('blade:twinBlades', 'mul', 'heavy.damage', 2),
      ],
      'test',
    );
    expect(result.combo[2]!.knockback).toBe(twin.combo[2]!.knockback + 3);
    expect(result.combo[1]!.knockback).toBe(twin.combo[1]!.knockback);
    expect(result.heavy.damage).toBe(twin.heavy.damage * 2);
    expect(twin).toEqual(snapshot);
  });

  it('set dodaje pole dopuszczone przez schemat i podmienia tablice', () => {
    expect(blaster.statuses).toBeUndefined();
    const statuses = [{ id: 'burn', durationS: 2 }];
    const result = applyPatches(
      blaster,
      weaponSchema,
      [patch('weapon:blaster', 'set', 'statuses', statuses)],
      'test',
    );
    expect(result.statuses).toEqual(statuses);
    expect(result.statuses).not.toBe(statuses);
    expect(blaster.statuses).toBeUndefined();
  });

  it('bez łatek zwraca tę samą definicję', () => {
    expect(applyPatches(blaster, weaponSchema, [], 'test')).toBe(blaster);
  });

  it('nieistniejąca ścieżka daje czytelny błąd z labelem, celem i ścieżką', () => {
    for (const path of ['nope', 'combo.9.damage', 'heavy.nope', 'a.b.c']) {
      const run = () =>
        applyPatches(
          twin,
          bladeSchema,
          [patch('blade:twinBlades', 'add', path, 1)],
          'talent:xyz',
        );
      expect(run).toThrow(
        `talent:xyz: łatka blade:twinBlades add ${path}: nieznana ścieżka`,
      );
    }
    expect(() =>
      applyPatches(
        twin,
        bladeSchema,
        [patch('blade:twinBlades', 'set', 'combo.9', {})],
        'talent:xyz',
      ),
    ).toThrow('indeks poza tablicą');
  });

  it('set na polu spoza schematu daje błąd nieznanej ścieżki', () => {
    expect(() =>
      applyPatches(
        blaster,
        weaponSchema,
        [patch('weapon:blaster', 'set', 'fantasy', 1)],
        'talent:xyz',
      ),
    ).toThrow('talent:xyz: łatka weapon:blaster set fantasy: nieznana ścieżka');
  });

  it('add i mul na nieliczbie lub z nieliczbą dają błąd', () => {
    expect(() =>
      applyPatches(
        chain,
        powerSchema,
        [patch('power:chain', 'add', 'tags', 1)],
        'talent:xyz',
      ),
    ).toThrow('talent:xyz: łatka power:chain add tags: pole nie jest liczbą');
    expect(() =>
      applyPatches(
        chain,
        powerSchema,
        [patch('power:chain', 'mul', 'name', 2)],
        'talent:xyz',
      ),
    ).toThrow('pole nie jest liczbą');
    expect(() =>
      applyPatches(
        chain,
        powerSchema,
        [patch('power:chain', 'add', 'damage', '5')],
        'talent:xyz',
      ),
    ).toThrow('wartość musi być liczbą skończoną');
  });

  it('wynik niezgodny ze schematem daje błąd i nie zmienia definicji', () => {
    const snapshot = structuredClone(chain);
    expect(() =>
      applyPatches(
        chain,
        powerSchema,
        [patch('power:chain', 'mul', 'jumps', 1.5)],
        'talent:xyz',
      ),
    ).toThrow(
      'talent:xyz: łatka power:chain mul jumps: wynik nie przechodzi schematu',
    );
    expect(() =>
      applyPatches(
        chain,
        powerSchema,
        [patch('power:chain', 'add', 'damage', -1000)],
        'talent:xyz',
      ),
    ).toThrow('nie przechodzi schematu');
    expect(chain).toEqual(snapshot);
  });

  it('odrzuca puste segmenty i klucze prototypu', () => {
    for (const path of ['', 'a..b', '__proto__.x', 'constructor']) {
      expect(() =>
        applyPatches(
          blaster,
          weaponSchema,
          [patch('weapon:blaster', 'set', path, 1)],
          'test',
        ),
      ).toThrow();
    }
  });

  it('kolejność łatek decyduje o wyniku i jest deterministyczna', () => {
    const a = [
      patch('power:chain', 'set', 'damage', 10),
      patch('power:chain', 'add', 'damage', 5),
    ];
    const b = [a[1]!, a[0]!];
    const apply = (list: DefinitionPatch[]) =>
      applyPatches(chain, powerSchema, list, 'test') as typeof chain;
    expect(apply(a).damage).toBe(15);
    expect(apply(b).damage).toBe(10);
    expect(apply(a)).toEqual(apply(a));
  });
});

describe('resolveLoadout', () => {
  it('bez łatek zwraca definicje z globalnych map', () => {
    const resolved = resolveLoadout(loadout, []);
    expect(resolved.loadout).toBe(loadout);
    expect(resolved.blade).toBe(twin);
    expect(resolved.weapons).toEqual([
      weaponDefinitions.get('blaster'),
      weaponDefinitions.get('pistol'),
    ]);
    expect(resolved.weapons[0]).toBe(blaster);
    expect(resolved.powers[0]).toBe(chain);
  });

  it('stosuje łatki do ostrza, broni i mocy bez zmiany map globalnych', () => {
    const snapshot = structuredClone([twin, blaster, chain]);
    const resolved = resolveLoadout(loadout, [
      patch('power:chain', 'add', 'jumps', 1),
      patch('weapon:blaster', 'mul', 'damage', 2),
      patch('blade:twinBlades', 'add', 'combo.0.damage', 4),
    ]);
    const patchedChain = chainOf(resolved);
    expect(patchedChain.kind === 'chain' && patchedChain.jumps).toBe(4);
    expect(resolved.weapons[0]!.id).toBe('blaster');
    expect('damage' in resolved.weapons[0]! && resolved.weapons[0].damage).toBe(
      40,
    );
    expect(resolved.blade.combo[0]!.damage).toBe(twin.combo[0]!.damage + 4);
    expect(resolved.weapons[1]).toBe(weaponDefinitions.get('pistol'));
    expect(resolved.powers[1]).toBe(powerDefinitions.get('push'));
    expect([twin, blaster, chain]).toEqual(snapshot);
  });

  it('pomija łatki na przedmioty spoza ekwipunku', () => {
    const resolved = resolveLoadout(loadout, [
      patch('power:grab', 'add', 'rangeM', 100),
      patch('weapon:sniper', 'set', 'nope', 1),
      patch('blade:plasmaBlade', 'add', 'nope', 1),
      patch('power:chain', 'add', 'jumps', 1),
    ]);
    expect(resolved.powers[1]).toBe(powerDefinitions.get('push'));
    expect(resolved.blade).toBe(twin);
    expect(
      chainOf(resolved).kind === 'chain' &&
        (chainOf(resolved) as { jumps: number }).jumps,
    ).toBe(4);
  });

  it('łatki stosuje w kolejności tablicy, deterministycznie', () => {
    const list = [
      patch('weapon:blaster', 'set', 'damage', 10),
      patch('power:chain', 'add', 'jumps', 2),
      patch('weapon:blaster', 'add', 'damage', 5),
    ];
    const first = resolveLoadout(loadout, list);
    const second = resolveLoadout(loadout, list);
    expect(first).toEqual(second);
    expect('damage' in first.weapons[0]! && first.weapons[0].damage).toBe(15);
  });

  it('nieznany prefiks celu to błąd, także dla przedmiotu spoza ekwipunku', () => {
    expect(() =>
      resolveLoadout(loadout, [
        {
          target: 'item:x' as DefinitionPatch['target'],
          op: 'add',
          path: 'a',
          value: 1,
        },
      ]),
    ).toThrow('Nieznany prefiks celu łatki: item:x');
  });

  it('błąd łatki niesie cel jako label', () => {
    expect(() =>
      resolveLoadout(loadout, [patch('power:chain', 'add', 'nope', 1)]),
    ).toThrow('power:chain: łatka power:chain add nope: nieznana ścieżka');
  });

  it('nieznany przedmiot ekwipunku to błąd', () => {
    expect(() => resolveLoadout({ ...loadout, blade: 'missing' }, [])).toThrow(
      'Nieznany ekwipunek: missing',
    );
  });
});
