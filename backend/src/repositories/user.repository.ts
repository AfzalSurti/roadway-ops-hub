import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  findEmployees() {
    return prisma.user.findMany({ where: { role: "EMPLOYEE" } });
  },
  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }
};