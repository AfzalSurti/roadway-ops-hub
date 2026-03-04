import { userRepository } from "../repositories/user.repository.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import { hashPassword } from "../utils/password.js";

export const userService = {
  listEmployees() {
    return userRepository.findEmployees();
  },
  async createEmployee(payload: { name: string; email: string; password: string }) {
    const existing = await userRepository.findByEmail(payload.email);
    if (existing) {
      throw conflict("User with this email already exists");
    }

    return userRepository.create({
      name: payload.name,
      email: payload.email,
      role: "EMPLOYEE",
      passwordHash: await hashPassword(payload.password)
    });
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