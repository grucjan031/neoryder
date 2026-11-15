import type { z } from 'zod';
import { bladeDefinitions, bladeSchema } from '../combat/melee/bladeSchema';
import type { BladeDefinition } from '../combat/melee/bladeSchema';
import { powerDefinitions, powerSchema } from '../combat/powers/registry';
import type { PowerDefinition } from '../combat/powers/registry';
import {
  weaponDefinitions,
  weaponSchema,
} from '../combat/weapons/weaponSchema';
import type { WeaponDefinition } from '../combat/weapons/weaponSchema';
import type { DefinitionPatch } from '../core/metaTypes';
import type { Loadout } from './loadout';

/** Definicje ekwipunku gracza po zastosowaniu łatek (ADR 0007 pkt 5). */
export interface ResolvedLoadout {
  loadout: Loadout;
  blade: BladeDefinition;
  weapons: WeaponDefinition[];
  powers: PowerDefinition[];
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ARRAY_INDEX = /^\d+$/;

function describe(label: string, patch: DefinitionPatch): string {
  return `${label}: łatka ${patch.target} ${patch.op} ${patch.path}`;
}

function isContainer(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasKey(container: Record<string, unknown>, key: string): boolean {
  if (Array.isArray(container))
    return ARRAY_INDEX.test(key) && Number(key) < container.length;
  return Object.hasOwn(container, key);
}

/** Wartość pod ścieżką albo `undefined` w polu `found`, gdy ścieżka nie istnieje. */
function readPath(
  root: unknown,
  segments: readonly string[],
): { found: boolean; value?: unknown } {
  let current: unknown = root;
  for (const segment of segments) {
    if (!isContainer(current) || !hasKey(current, segment))
      return { found: false };
    current = current[segment];
  }
  return { found: true, value: current };
}

function jsonEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!isContainer(a) || !isContainer(b)) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) => Object.hasOwn(b, key) && jsonEqual(a[key], b[key]),
  );
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(korzeń)'}: ${issue.message}`)
    .join('; ');
}

function applyOne(
  root: Record<string, unknown>,
  patch: DefinitionPatch,
  prefix: string,
): string[] {
  const segments = patch.path.split('.');
  if (segments.some((segment) => segment === ''))
    throw new Error(`${prefix}: pusty segment ścieżki.`);
  if (segments.some((segment) => FORBIDDEN_KEYS.has(segment)))
    throw new Error(`${prefix}: niedozwolony segment ścieżki.`);
  const parentPath = segments.slice(0, -1);
  const key = segments[segments.length - 1]!;
  const parent = readPath(root, parentPath);
  if (!parent.found || !isContainer(parent.value))
    throw new Error(`${prefix}: nieznana ścieżka.`);
  const container = parent.value;
  const exists = hasKey(container, key);
  if (Array.isArray(container) && !exists)
    throw new Error(`${prefix}: indeks poza tablicą.`);

  if (patch.op === 'set') {
    container[key] = structuredClone(patch.value);
    return segments;
  }
  if (!(typeof patch.value === 'number' && Number.isFinite(patch.value)))
    throw new Error(`${prefix}: wartość musi być liczbą skończoną.`);
  const current = exists ? container[key] : undefined;
  if (typeof current !== 'number')
    throw new Error(
      exists
        ? `${prefix}: pole nie jest liczbą.`
        : `${prefix}: nieznana ścieżka.`,
    );
  container[key] =
    patch.op === 'add' ? current + patch.value : current * patch.value;
  return segments;
}

/**
 * Stosuje łatki do kopii definicji (nigdy nie mutuje wejścia). Bez łatek zwraca tę samą definicję.
 * Po każdej łatce wynik przechodzi przez `schema`; dla `set` wartość pod ścieżką musi po walidacji
 * istnieć i być równa ustawionej (zod usuwa nieznane klucze, co daje błąd „nieznana ścieżka”).
 */
export function applyPatches<T extends object>(
  definition: T,
  schema: z.ZodType<T>,
  patches: readonly DefinitionPatch[],
  label: string,
): T {
  if (patches.length === 0) return definition;
  let current = structuredClone(definition) as Record<string, unknown>;
  for (const patch of patches) {
    const prefix = describe(label, patch);
    const segments = applyOne(current, patch, prefix);
    const result = schema.safeParse(current);
    if (!result.success)
      throw new Error(
        `${prefix}: wynik nie przechodzi schematu (${formatIssues(result.error)}).`,
      );
    if (patch.op === 'set') {
      const written = readPath(result.data, segments);
      if (!written.found) throw new Error(`${prefix}: nieznana ścieżka.`);
      if (!jsonEqual(written.value, patch.value))
        throw new Error(
          `${prefix}: schemat zmienił ustawioną wartość (nieznana ścieżka lub wartość spoza schematu).`,
        );
    }
    current = result.data as Record<string, unknown>;
  }
  return current as T;
}

type TargetKind = 'weapon' | 'power' | 'blade';

function splitTarget(patch: DefinitionPatch): { kind: TargetKind; id: string } {
  const separator = patch.target.indexOf(':');
  const kind = patch.target.slice(0, separator);
  const id = patch.target.slice(separator + 1);
  if (
    separator < 0 ||
    (kind !== 'weapon' && kind !== 'power' && kind !== 'blade')
  )
    throw new Error(`Nieznany prefiks celu łatki: ${patch.target}`);
  if (id === '') throw new Error(`Pusty id celu łatki: ${patch.target}`);
  return { kind, id };
}

function resolveOne<T extends object>(
  kind: TargetKind,
  id: string,
  definitions: ReadonlyMap<string, T>,
  schema: z.ZodType<T>,
  patches: readonly DefinitionPatch[],
): T {
  const definition = definitions.get(id);
  if (!definition) throw new Error(`Nieznany ekwipunek: ${id}`);
  const target = `${kind}:${id}`;
  return applyPatches(
    definition,
    schema,
    patches.filter((patch) => patch.target === target),
    target,
  );
}

/**
 * Definicje ekwipunku z globalnych map plus łatki (kolejność łatek zgodnie z tablicą).
 * Łatki na przedmioty spoza ekwipunku są pomijane; nieznany prefiks celu to błąd.
 */
export function resolveLoadout(
  loadout: Loadout,
  patches: readonly DefinitionPatch[],
): ResolvedLoadout {
  for (const patch of patches) splitTarget(patch);
  return {
    loadout,
    blade: resolveOne(
      'blade',
      loadout.blade,
      bladeDefinitions,
      bladeSchema,
      patches,
    ),
    weapons: loadout.weapons.map((id) =>
      resolveOne('weapon', id, weaponDefinitions, weaponSchema, patches),
    ),
    powers: loadout.powers.map((id) =>
      resolveOne('power', id, powerDefinitions, powerSchema, patches),
    ),
  };
}
