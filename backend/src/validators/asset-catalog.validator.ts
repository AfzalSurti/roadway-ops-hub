import { z } from "zod";

export const createAssetCatalogSchema = z.object({
  className: z.string().trim().min(1),
  types: z.array(z.string().trim().min(1)).default([])
});

export const updateAssetCatalogSchema = z
  .object({
    className: z.string().trim().min(1).optional(),
    types: z.array(z.string().trim().min(1)).optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, "At least one field is required");
