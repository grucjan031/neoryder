import { ChainPower } from './chain';
import { BarrierPower } from './barrier';
import { FocusPower } from './focus';
import { ConePower } from './cone';
import { GrabPower } from './grab';
import type { Power, PowerDeps, PowerFactory } from './power';
import { powerDefinitions } from './definitions';
import type { PowerDefinition } from './powerSchema';

export { powerSchema } from './powerSchema';
export type { PowerDefinition } from './powerSchema';

export {
  loadPower,
  loadPowerDefinitions,
  powerDefinitions,
} from './definitions';

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

/** Moc z gotowej definicji (np. po łatkach talentów); `createPower` bierze definicję z globalnej mapy. */
export function createPowerFromDefinition(
  def: PowerDefinition,
  deps: PowerDeps,
): Power {
  const factory = factories.get(def.kind);
  if (!factory) throw new Error(`Nieznany mechanizm mocy: ${def.kind}`);
  return factory(def, deps);
}

export function createPower(id: string, deps: PowerDeps): Power {
  const def = powerDefinitions.get(id);
  if (!def) throw new Error(`Nieznane id mocy: ${id}`);
  return createPowerFromDefinition(def, deps);
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
