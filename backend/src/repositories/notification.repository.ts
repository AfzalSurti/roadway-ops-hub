import { prisma } from "../prisma/client.js";

export const notificationRepository = {
  createMany(items: Array<{ userId: string; title: string; message: string; entityType: string; entityId: string }>) {
    if (!items.length) {
      return Promise.resolve({ count: 0 });
    }

    return prisma.notification.createMany({ data: items });
  },
  listForUser(userId: string, limit = 30) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  },
  markRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true }
    });
  },
  markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  }
};
