import { z } from "zod";

export const templateFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "select", "checkbox", "photo", "file", "textarea"]),
  required: z.boolean(),
  options: z.array(z.string().min(1)).optional()
});

export const templateFieldsSchema = z.array(templateFieldSchema).min(1);

export const createTemplateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  fields: templateFieldsSchema
});

export const updateTemplateSchema = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    fields: templateFieldsSchema.optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, "At least one field is required");