import { notificationRepository } from "../repositories/notification.repository.js";

export const notificationService = {
  async notifyUsers(args: {
    userIds: string[];
    title: string;
    message: string;
    entityType: string;
    entityId: string;
  }) {
    const uniqueUserIds = Array.from(new Set(args.userIds.filter(Boolean)));
    await notificationRepository.createMany(
      uniqueUserIds.map((userId) => ({
        userId,
        title: args.title,
        message: args.message,
        entityType: args.entityType,
        entityId: args.entityId
      }))
    );
  },

  listForUser(userId: string, limit?: number) {
    return notificationRepository.listForUser(userId, limit);
  },

  async markRead(id: string, userId: string) {
    const result = await notificationRepository.markRead(id, userId);
    return { updated: result.count > 0 };
  },

  async markAllRead(userId: string) {
    const result = await notificationRepository.markAllRead(userId);
    return { updated: result.count };
  }
};
