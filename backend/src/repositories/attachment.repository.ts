import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const attachmentRepository = {
  create(data: Prisma.AttachmentUncheckedCreateInput) {
    return prisma.attachment.create({ data });
  }
};