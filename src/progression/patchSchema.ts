import { z } from 'zod';
import type { DefinitionPatch } from '../core/metaTypes';

export const PATCH_OPS = ['set', 'add', 'mul'] as const;

/** Łatka definicji (ADR 0007 pkt 5); `add` i `mul` wymagają liczby skończonej. */
export const definitionPatchSchema: z.ZodType<DefinitionPatch> = z
  .object({
    target: z.templateLiteral([
      z.enum(['weapon', 'power', 'blade']),
      ':',
      z.string().min(1),
    ]),
    op: z.enum(PATCH_OPS),
    path: z.string().min(1),
    value: z.unknown(),
  })
  .superRefine((patch, ctx) => {
    if (
      patch.op !== 'set' &&
      !(typeof patch.value === 'number' && Number.isFinite(patch.value))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: `Operacja ${patch.op} wymaga liczby skończonej.`,
      });
  });

export function loadDefinitionPatch(data: unknown): DefinitionPatch {
  return definitionPatchSchema.parse(data);
}
