import { DEFAULT_ASSET_CATALOG } from "../data/default-asset-catalog.js";
import { assetCatalogRepository } from "../repositories/asset-catalog.repository.js";
import { badRequest, notFound } from "../utils/errors.js";

export const assetCatalogService = {
  async ensureSeeded() {
    const count = await assetCatalogRepository.count();
    if (count > 0) {
      return;
    }

    await assetCatalogRepository.createMany(
      DEFAULT_ASSET_CATALOG.map((entry, index) => ({
        className: entry.className,
        types: entry.types,
        sortOrder: index
      }))
    );
  },

  async list() {
    await this.ensureSeeded();
    return assetCatalogRepository.findAll();
  },

  async create(payload: { className: string; types: string[] }) {
    await this.ensureSeeded();
    const existing = await assetCatalogRepository.findByClassName(payload.className.trim());
    if (existing) {
      throw badRequest("Asset class already exists");
    }

    const count = await assetCatalogRepository.count();
    return assetCatalogRepository.create({
      className: payload.className.trim(),
      types: payload.types.map((type) => type.trim()).filter(Boolean),
      sortOrder: count
    });
  },

  async update(id: string, payload: { className?: string; types?: string[] }) {
    const existing = await assetCatalogRepository.findById(id);
    if (!existing) {
      throw notFound("Asset class not found");
    }

    if (payload.className && payload.className.trim() !== existing.className) {
      const duplicate = await assetCatalogRepository.findByClassName(payload.className.trim());
      if (duplicate) {
        throw badRequest("Asset class already exists");
      }
    }

    return assetCatalogRepository.update(id, {
      className: payload.className?.trim(),
      types: payload.types?.map((type) => type.trim()).filter(Boolean)
    });
  },

  async remove(id: string) {
    const existing = await assetCatalogRepository.findById(id);
    if (!existing) {
      throw notFound("Asset class not found");
    }

    await assetCatalogRepository.delete(id);
    return { deleted: true };
  }
};
