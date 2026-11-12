import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { ProjectsService } from './projects.service.js';

describe('ProjectsService', () => {
  it('orders projects by sortOrder', async () => {
    const findMany = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([
      {
        name: 'Card',
        description: 'API',
        url: 'https://example.test/card',
        repositoryUrl: 'https://example.test/repo',
      },
    ]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: { project: { findMany } } },
      ],
    }).compile();

    await expect(moduleRef.get(ProjectsService).list()).resolves.toEqual([
      {
        name: 'Card',
        description: 'API',
        url: 'https://example.test/card',
        repositoryUrl: 'https://example.test/repo',
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: 'asc' },
    });
  });
});
