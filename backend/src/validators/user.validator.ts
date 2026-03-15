import { z } from "zod";

export const createEmployeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters")
});
export const updateProfileSchema = z.object({
  contactNumber:   z.string().max(20).nullable().optional(),
  education:       z.string().max(200).nullable().optional(),
  dateOfJoining:   z.string().datetime({ offset: true }).nullable().optional()
                    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()),
  experienceInOrg: z.string().max(100).nullable().optional(),
  currentCtc:      z.string().max(100).nullable().optional()
});