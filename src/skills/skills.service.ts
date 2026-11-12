import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { SkillModel } from './skill.model.js';
import { toSkillModel } from './skill.mapper.js';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<SkillModel[]> {
    const skills = await this.prisma.skill.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return skills.map(toSkillModel);
  }
}
