import { userRepository } from "../repositories/user.repository.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";

import { hashPassword } from "../utils/password.js";
import { emailService } from "./email.service.js";
import { logger } from "../config/logger.js";

type EmployeeCreateResult = {
  user: Awaited<ReturnType<typeof userRepository.create>>;
  emailSent: boolean;
  message: string;
};

export const userService = {
  listEmployees() {
    return userRepository.findEmployees();
  },
  async getProfile(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw notFound("User not found");
    return user;
  },
  async updateProfile(id: string, payload: {
    name?: string;
    email?: string;
    contactNumber?: string | null;
    education?: string | null;
    yearOfPassing?: string | null;
    dateOfJoining?: string | null;
    experienceInOrg?: string | null;
    currentCtc?: string | null;
  }) {
    if (payload.email) {
      const normalizedEmail = payload.email.trim().toLowerCase();
      const existing = await userRepository.findByEmail(normalizedEmail);
      if (existing && existing.id !== id) {
        throw conflict("User with this email already exists");
      }
    }

    return userRepository.updateById(id, {
      name: payload.name?.trim(),
      email: payload.email?.trim().toLowerCase(),
      contactNumber: payload.contactNumber,
      education: payload.education,
      yearOfPassing: payload.yearOfPassing,
      dateOfJoining: payload.dateOfJoining ? new Date(payload.dateOfJoining) : null,
      currentCtc: payload.currentCtc
    });
  },
  async createEmployee(payload: { name: string; email: string; password: string }): Promise<EmployeeCreateResult> {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const normalizedName = payload.name.trim();

    const existing = await userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw conflict("User with this email already exists");
    }

    const user = await userRepository.create({
      name: normalizedName,
      email: normalizedEmail,
      role: "EMPLOYEE",
      passwordHash: await hashPassword(payload.password)
    });

    try {
      const emailSent = await emailService.sendEmployeeWelcomeEmail({
        to: normalizedEmail,
        employeeName: normalizedName,
        employeeEmail: normalizedEmail,
        password: payload.password
      });

      return {
        user,
        emailSent,
        message: emailSent ? `Email sent to ${normalizedEmail}` : "Employee created successfully, but email was not sent."
      };
    } catch (error) {
      logger.error({ err: error, email: normalizedEmail, userId: user.id }, "Failed to send employee welcome email");

      const reason = error instanceof Error && error.message ? error.message : "unknown email error";
      return {
        user,
        emailSent: false,
        message: `Employee created successfully, but email was not sent because ${reason}.`
      };
    }
  },
  async deleteEmployee(id: string) {
    const employee = await userRepository.findById(id);
    if (!employee || employee.role !== "EMPLOYEE") {
      throw notFound("Employee not found");
    }

    const usage = await userRepository.getEmployeeUsageSummary(id);
    if (usage.assignedTasks > 0 || usage.submittedReports > 0 || usage.comments > 0 || usage.uploads > 0) {
      throw badRequest("Cannot delete employee with existing tasks/reports/comments/uploads");
    }

    await userRepository.deleteById(id);
    return { deleted: true };
  }
};
