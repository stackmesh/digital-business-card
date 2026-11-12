import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { toProjectModel } from './project.mapper.js';
import type { ProjectModel } from './project.model.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ProjectModel[]> {
    const projects = await this.prisma.project.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return projects.map(toProjectModel);
  }
}
