import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { toExperienceModel } from './experience.mapper.js';
import type { ExperienceModel } from './experience.model.js';

@Injectable()
export class ExperienceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ExperienceModel[]> {
    const experiences = await this.prisma.experience.findMany({
      orderBy: { sortOrder: 'asc' },
      // One batched achievements query for the whole list, not one per role.
      include: {
        achievements: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return experiences.map(toExperienceModel);
  }
}
