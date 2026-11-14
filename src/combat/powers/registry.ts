import { ChainPower } from './chain';
import { BarrierPower } from './barrier';
import { FocusPower } from './focus';
import { ConePower } from './cone';
import { GrabPower } from './grab';
import type { Power, PowerDeps, PowerFactory } from './power';
import { powerSchema } from './powerSchema';
import type { PowerDefinition } from './powerSchema';

export { powerSchema } from './powerSchema';
export type { PowerDefinition } from './powerSchema';

export function loadPower(data: unknown): PowerDefinition {
  const result = powerSchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowe dane mocy: ${result.error.message}`);
  return result.data;
}

export function loadPowerDefinitions(
  data: readonly unknown[],
): ReadonlyMap<string, PowerDefinition> {
  const definitions = new Map<string, PowerDefinition>();
  for (const raw of data) {
    const def = loadPower(raw);
    if (definitions.has(def.id))
      throw new Error(`Powtórzone id mocy: ${def.id}`);
    definitions.set(def.id, def);
  }
  return definitions;
}

const modules = import.meta.glob('../../data/powers/*.json', {
  eager: true,
  import: 'default',
});
export const powerDefinitions = loadPowerDefinitions(Object.values(modules));

const factories = new Map<string, PowerFactory>();

export function registerPowerKind(kind: string, factory: PowerFactory): void {
  if (factories.has(kind))
    throw new Error(`Mechanizm mocy już zarejestrowany: ${kind}`);
  factories.set(kind, factory);
}

registerPowerKind('cone', (def, deps) => {
  if (def.kind !== 'cone')
    throw new Error(`Nieprawidłowy mechanizm stożka: ${def.kind}`);
  return new ConePower(def, deps);
});

registerPowerKind('chain', (def, deps) => {
  if (def.kind !== 'chain')
    throw new Error(`Nieprawidłowy mechanizm łańcucha: ${def.kind}`);
  return new ChainPower(def, deps);
});

export function createPower(id: string, deps: PowerDeps): Power {
  const def = powerDefinitions.get(id);
  if (!def) throw new Error(`Nieznane id mocy: ${id}`);
  const factory = factories.get(def.kind);
  if (!factory) throw new Error(`Nieznany mechanizm mocy: ${def.kind}`);
  return factory(def, deps);
}

registerPowerKind('focus', (def, deps) => {
  if (def.kind !== 'focus')
    throw new Error(`Nieprawidłowy mechanizm Skupienia: ${def.kind}`);
  return new FocusPower(def, deps);
});

registerPowerKind('barrier', (def, deps) => {
  if (def.kind !== 'barrier')
    throw new Error(`Nieprawidłowy mechanizm Bariery: ${def.kind}`);
  return new BarrierPower(def, deps);
});

registerPowerKind('grab', (def, deps) => {
  if (def.kind !== 'grab')
    throw new Error(`Nieprawidłowy mechanizm chwytu: ${def.kind}`);
  return new GrabPower(def, deps);
});
