import { projectRepository } from "../repositories/project.repository.js";
import { conflict, notFound } from "../utils/errors.js";

export const projectService = {
  list() {
    return projectRepository.findMany();
  },
  async create(payload: { name: string; description?: string }) {
    const existing = await projectRepository.findByName(payload.name);
    if (existing) {
      throw conflict("Project with this name already exists");
    }

    return projectRepository.create({
      name: payload.name,
      description: payload.description
    });
  },
  async remove(id: string) {
    const existing = await projectRepository.findById(id);
    if (!existing) {
      throw notFound("Project not found");
    }

    await projectRepository.delete(id);
    return { deleted: true };
  }
};