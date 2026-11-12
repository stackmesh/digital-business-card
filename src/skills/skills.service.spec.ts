import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { SkillsService } from './skills.service.js';

describe('SkillsService', () => {
  it('orders skills by sortOrder', async () => {
    const findMany = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([
      { name: 'GraphQL', category: 'API' },
      { name: 'TypeScript', category: 'Language' },
    ]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        SkillsService,
        { provide: PrismaService, useValue: { skill: { findMany } } },
      ],
    }).compile();

    await expect(moduleRef.get(SkillsService).list()).resolves.toEqual([
      { name: 'GraphQL', category: 'API' },
      { name: 'TypeScript', category: 'Language' },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: 'asc' },
    });
  });
});
