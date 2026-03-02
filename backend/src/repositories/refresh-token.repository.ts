import { prisma } from "../prisma/client.js";

export const refreshTokenRepository = {
  create(data: { tokenHash: string; userId: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data });
  },
  findValidToken(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: true
      }
    });
  },
  revokeByHash(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
};