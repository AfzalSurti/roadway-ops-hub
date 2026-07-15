import { z } from "zod";

export const createInfraTeamMemberSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required").nullable().optional(),
  phone: z.string().min(5).max(20).nullable().optional(),
  manpowerGroup: z.enum(["Key Personnel", "Sub Professional Staff", "Support Staff"]),
  manpowerRole: z.string().min(2, "Manpower role is required"),
  notes: z.string().max(500).nullable().optional()
});

export const updateInfraTeamMemberSchema = createInfraTeamMemberSchema.partial();

export const createProjectAssignmentSchema = z.object({
  teamMemberId: z.string().min(1, "Team member is required"),
  mobilizedAt: z.string().datetime({ offset: true }).optional().nullable()
});

export const updateProjectAssignmentSchema = z.object({
  mobilizedAt: z.string().datetime({ offset: true }).optional().nullable(),
  demobilizedAt: z.string().datetime({ offset: true }).optional().nullable()
});