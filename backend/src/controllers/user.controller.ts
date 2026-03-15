import type { Request, Response } from "express";
import { userService } from "../services/user.service.js";
import { sendSuccess } from "../utils/response.js";

function serializeUser(user: {
  id: string; name: string; email: string; role: string;
  contactNumber?: string | null; education?: string | null;
  yearOfPassing?: string | null;
  dateOfJoining?: Date | null; experienceInOrg?: string | null;
  currentCtc?: string | null; createdAt: Date; updatedAt: Date;
}) {
  const formatExperience = (fromDate: Date | null | undefined) => {
    if (!fromDate) return null;

    const start = new Date(fromDate);
    if (Number.isNaN(start.getTime())) return null;

    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (months < 0) months = 0;

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years === 0) return `${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
    if (remainingMonths === 0) return `${years} year${years === 1 ? "" : "s"}`;
    return `${years} year${years === 1 ? "" : "s"} ${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
  };

  const passingDate = user.yearOfPassing ? new Date(`${user.yearOfPassing}-01T00:00:00.000Z`) : null;
  const totalExperience = formatExperience(passingDate);
  const experienceInOrganization = formatExperience(user.dateOfJoining);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    contactNumber: user.contactNumber ?? null,
    education: user.education ?? null,
    yearOfPassing: user.yearOfPassing ?? null,
    totalExperience,
    dateOfJoining: user.dateOfJoining ? user.dateOfJoining.toISOString() : null,
    experienceInOrg: experienceInOrganization,
    currentCtc: user.currentCtc ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export const userController = {
  async getProfile(req: Request, res: Response) {
    const userId = (req as Request & { user?: { id: string } }).user!.id;
    const user = await userService.getProfile(userId);
    return sendSuccess(res, serializeUser(user));
  },
  async updateProfile(req: Request, res: Response) {
    const userId = (req as Request & { user?: { id: string } }).user!.id;
    const user = await userService.updateProfile(userId, req.body);
    return sendSuccess(res, serializeUser(user));
  },
  async createEmployee(req: Request, res: Response) {
    const user = await userService.createEmployee(req.body);
    return sendSuccess(res, serializeUser(user), 201);
  },
  async listEmployees(_req: Request, res: Response) {
    const users = await userService.listEmployees();
    return sendSuccess(res, users.map(serializeUser));
  },
  async deleteEmployee(req: Request, res: Response) {
    const result = await userService.deleteEmployee(req.params.id);
    return sendSuccess(res, result);
  }
};