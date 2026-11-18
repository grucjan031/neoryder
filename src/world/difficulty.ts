import { z } from 'zod';
import data from '../data/difficulty.json';
import type { StatModifier } from '../core/stats';
import type { EventBus } from '../core/events';

export const difficultyIdSchema = z.enum([
  'easy',
  'normal',
  'hard',
  'nightmare',
]);
export type DifficultyId = z.infer<typeof difficultyIdSchema>;
const positive = z.number().finite().positive();
const chance = z.number().finite().min(0).max(1);
export const difficultyProfileSchema = z.object({
  health: positive,
  damage: positive,
  count: positive,
  maxAlive: positive,
  telegraph: positive.min(0.7),
  attackTokens: z.number().int().positive(),
  shotTokens: z.number().int().positive(),
  accuracy: positive,
  spread: positive,
  burstBreak: positive,
  flankChance: chance,
  coverUse: chance,
  groupAttack: chance,
  heavyDodgeChance: chance,
  dashDodgeChance: chance,
});
export type DifficultyProfile = Readonly<
  z.infer<typeof difficultyProfileSchema>
>;
export const difficultySchema = z.object({
  easy: difficultyProfileSchema,
  normal: difficultyProfileSchema,
  hard: difficultyProfileSchema,
  nightmare: difficultyProfileSchema,
});
export const difficulties = difficultySchema.parse(data);
for (const profile of Object.values(difficulties)) Object.freeze(profile);
Object.freeze(difficulties);

// Czytnik rejestruje SaveStore; moduł danych nie importuje zapisu ani DOM.
let readSetting: () => DifficultyId | undefined = () => undefined;
let override: DifficultyId | undefined;
export function registerDifficultySetting(reader: typeof readSetting): void {
  readSetting = reader;
}
export function setDifficultyOverride(value: unknown): boolean {
  if (value === null || value === undefined) {
    override = undefined;
    return true;
  }
  const parsed = difficultyIdSchema.safeParse(value);
  if (!parsed.success) return false;
  override = parsed.data;
  return true;
}
export function selectedDifficulty(): DifficultyId {
  return override ?? difficultyIdSchema.catch('normal').parse(readSetting());
}
/** Brak pola w starym runie zawsze oznacza normal, niezależnie od nowych ustawień. */
export function runDifficulty(state: object): DifficultyId {
  return difficultyIdSchema
    .catch('normal')
    .parse(Reflect.get(state, 'difficulty'));
}
export type DifficultyRunState = { difficulty?: DifficultyId };
const combatDifficulties = new WeakMap<EventBus, DifficultyId>();
/** Manager i fale tej samej symulacji używają jednej, zamrożonej trudności. */
export function bindCombatDifficulty(bus: EventBus, id: DifficultyId): void {
  combatDifficulties.set(bus, id);
}
export function combatDifficulty(bus: EventBus): DifficultyId {
  return combatDifficulties.get(bus) ?? selectedDifficulty();
}
export function difficultyModifiers(
  profile: DifficultyProfile,
): StatModifier[] {
  return [
    {
      stat: 'maxHealth',
      type: 'mult',
      value: profile.health,
      source: 'difficulty',
    },
    {
      stat: 'damage',
      type: 'mult',
      value: profile.damage,
      source: 'difficulty',
    },
  ];
}
