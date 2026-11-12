import { Test } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { ExperienceService } from './experience.service.js';

describe('ExperienceService', () => {
  it('loads every role and its achievements in one findMany', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        company: 'Northwind',
        position: 'Engineer',
        startDate: new Date('2019-01-01T00:00:00.000Z'),
        endDate: new Date('2021-05-01T00:00:00.000Z'),
        description: 'APIs',
        achievements: [{ description: 'First' }, { description: 'Second' }],
      },
    ]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ExperienceService,
        {
          provide: PrismaService,
          useValue: { experience: { findMany } },
        },
      ],
    }).compile();

    const result = await moduleRef.get(ExperienceService).list();

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: 'asc' },
      include: {
        achievements: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    expect(result[0]?.achievements.map((item) => item.description)).toEqual([
      'First',
      'Second',
    ]);
  });
});
