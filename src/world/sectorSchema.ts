import { z } from 'zod';
import { NODE_TYPES, RARITIES } from '../core/runTypes';

const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
const positiveInt = z.number().int().min(1);
const nodeTypeSchema = z.enum(NODE_TYPES);
const raritySchema = z.enum(RARITIES);

export const intRangeSchema = z
  .object({
    min: positiveInt,
    max: positiveInt,
  })
  .refine((range) => range.min <= range.max, {
    message: 'Wartość min nie może być większa niż max.',
  });

export const layerTypeWeightsSchema = z
  .object({
    fromLayer: positiveInt,
    toLayer: positiveInt,
    weights: z.partialRecord(nodeTypeSchema, nonnegative),
  })
  .refine((entry) => entry.fromLayer <= entry.toLayer, {
    message: 'fromLayer nie może być większe niż toLayer.',
  });

export const sectorGuaranteeSchema = z
  .object({
    type: nodeTypeSchema,
    min: positiveInt,
    fromLayer: positiveInt,
    toLayer: positiveInt,
  })
  .refine((entry) => entry.fromLayer <= entry.toLayer, {
    message: 'fromLayer nie może być większe niż toLayer.',
  });

export const sectorLimitsSchema = z.object({
  maxPerLayer: z.partialRecord(nodeTypeSchema, positiveInt),
  maxElitesPerPath: positiveInt,
});

export const sectorThreatSchema = z.object({
  base: z.partialRecord(nodeTypeSchema, nonnegative),
  perLayer: z.partialRecord(nodeTypeSchema, nonnegative),
  waveCount: z.partialRecord(nodeTypeSchema, intRangeSchema),
  pools: z.partialRecord(nodeTypeSchema, z.record(z.string().min(1), positive)),
  unlockLayer: z.record(z.string().min(1), positiveInt).optional(),
});

export const sectorRewardWeightsSchema = z.partialRecord(
  nodeTypeSchema,
  z.partialRecord(raritySchema, nonnegative),
);

export const sectorEconomySchema = z.object({
  creditsPerThreat: positive,
  eliteBonusCredits: nonnegative.optional(),
  shopPrices: z.record(raritySchema, z.number().int().nonnegative()),
  shopHealPrice: z.number().int().nonnegative(),
  shopHealFraction: positive.max(1),
  puzzleCredits: z.number().int().nonnegative(),
  restHealFraction: positive.max(1),
});

export const sectorRoomPoolsSchema = z.partialRecord(
  nodeTypeSchema,
  z.array(z.string().min(1)).min(1),
);

/** Definicja sektora z src/data/sectors/*.json (ADR 0005 pkt 1, 3, 7). */
export const sectorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  layers: z.number().int().min(2),
  nodesPerLayer: intRangeSchema,
  extraEdgeChance: z.number().finite().min(0).max(1),
  typeWeights: z.array(layerTypeWeightsSchema).min(1),
  guarantees: z.array(sectorGuaranteeSchema),
  limits: sectorLimitsSchema,
  expectedDurationS: z.record(nodeTypeSchema, positive),
  threat: sectorThreatSchema.optional(),
  rewardWeights: sectorRewardWeightsSchema.optional(),
  economy: sectorEconomySchema.optional(),
  roomPools: sectorRoomPoolsSchema.optional(),
});

export type SectorDefinition = z.infer<typeof sectorSchema>;

export function loadSector(data: unknown): SectorDefinition {
  return sectorSchema.parse(data);
}
export const loadSectorDefinition = loadSector;
