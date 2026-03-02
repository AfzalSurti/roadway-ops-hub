import { userRepository } from "../repositories/user.repository.js";
import { conflict } from "../utils/errors.js";
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
  }
};