import { prisma } from "../prisma/client.js";

export const assetCatalogRepository = {
  findAll() {
    return prisma.assetClassCatalog.findMany({ orderBy: [{ sortOrder: "asc" }, { className: "asc" }] });
  },

  findById(id: string) {
    return prisma.assetClassCatalog.findUnique({ where: { id } });
  },

  findByClassName(className: string) {
    return prisma.assetClassCatalog.findUnique({ where: { className } });
  },

  count() {
    return prisma.assetClassCatalog.count();
  },

  createMany(data: Array<{ className: string; types: string[]; sortOrder: number }>) {
    return prisma.assetClassCatalog.createMany({ data, skipDuplicates: true });
  },

  create(data: { className: string; types: string[]; sortOrder?: number }) {
    return prisma.assetClassCatalog.create({ data });
  },

  update(id: string, data: { className?: string; types?: string[]; sortOrder?: number }) {
    return prisma.assetClassCatalog.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.assetClassCatalog.delete({ where: { id } });
  }
};
