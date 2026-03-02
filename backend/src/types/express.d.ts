import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: Role;
      email: string;
    }

    interface Request {
      user?: UserContext;
      requestId?: string;
    }
  }
}

export {};