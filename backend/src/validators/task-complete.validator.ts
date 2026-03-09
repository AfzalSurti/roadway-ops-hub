import { z } from "zod";

export const completeTaskSchema = z.object({
  note: z.string().trim().max(2000).optional()
});
