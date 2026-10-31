import { z } from "zod";

export const twinStateSchema = z.object({
  instanceId: z.string(),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
  mode: z.literal("simulation"),
  supplyLps: z.number().finite().positive(),
  householdCount: z.number().int().positive(),
  leak: z.object({
    id: z.literal("L-01"),
    active: z.boolean(),
    lossLps: z.number().min(0).max(8),
    location: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  }),
  householdTotalLps: z.number().nonnegative(),
  perHouseholdLps: z.number().nonnegative(),
  flowMultiplier: z.number().min(0).max(1),
  blender: z.object({
    connected: z.boolean(),
    appliedRevision: z.number().nullable(),
    synchronized: z.boolean(),
  }),
});
export const twinEventSchema = z.object({
  id: z.string(),
  type: z.enum(["leak_started", "leak_updated", "leak_repaired"]),
  time: z.string(),
  state: twinStateSchema,
});
export const twinCommandSchema = z
  .object({
    pipeId: z.literal("L-01").default("L-01"),
    active: z.boolean(),
    lossLps: z.number().finite().min(0).max(8).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.active
        ? v.lossLps === undefined || v.lossLps > 0
        : v.lossLps === undefined || v.lossLps === 0,
    "Use a positive loss for a leak and zero for repair",
  );
export type TwinState = z.infer<typeof twinStateSchema>;
export type TwinEvent = z.infer<typeof twinEventSchema>;
export type TwinSnapshot = { state: TwinState; events: TwinEvent[] };
