import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CANONICAL_PROFILE_KEY } from '../database/canonical-profile.js';
import { PrismaService } from '../database/prisma.service.js';
import { ProfileService } from './profile.service.js';

describe('ProfileService', () => {
  const findUnique = jest.fn<(args: unknown) => Promise<unknown>>();

  beforeEach(() => {
    findUnique.mockReset();
  });

  async function createService(): Promise<ProfileService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: { profile: { findUnique } },
        },
      ],
    }).compile();

    return moduleRef.get(ProfileService);
  }

  it('returns null when the canonical profile does not exist', async () => {
    findUnique.mockResolvedValue(null);
    const service = await createService();

    await expect(service.getProfile()).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { singletonKey: CANONICAL_PROFILE_KEY },
      }),
    );
  });

  it('loads relations in one query and keeps database order', async () => {
    const startDate = new Date('2020-03-01T00:00:00.000Z');
    findUnique.mockResolvedValue({
      name: 'Example',
      description: 'A card',
      professionalLinks: [{ label: 'Site', url: 'https://example.test' }],
      skills: [{ name: 'TypeScript', category: 'Language' }],
      experiences: [
        {
          company: 'Northwind',
          position: 'Engineer',
          startDate,
          endDate: null,
          description: 'Built APIs',
          achievements: [{ description: 'Shipped the card' }],
        },
      ],
      projects: [
        {
          name: 'Card',
          description: 'This API',
          url: 'https://example.test/card',
          repositoryUrl: null,
        },
      ],
    });
    const service = await createService();

    await expect(service.getProfile()).resolves.toEqual({
      name: 'Example',
      description: 'A card',
      links: [{ label: 'Site', url: 'https://example.test' }],
      skills: [{ name: 'TypeScript', category: 'Language' }],
      experience: [
        {
          company: 'Northwind',
          position: 'Engineer',
          startDate,
          endDate: null,
          description: 'Built APIs',
          achievements: [{ description: 'Shipped the card' }],
        },
      ],
      projects: [
        {
          name: 'Card',
          description: 'This API',
          url: 'https://example.test/card',
          repositoryUrl: null,
        },
      ],
    });

    const args = findUnique.mock.calls[0]?.[0] as unknown as {
      include: {
        professionalLinks: { orderBy: unknown };
        skills: { orderBy: unknown };
        experiences: {
          orderBy: unknown;
          include: { achievements: { orderBy: unknown } };
        };
        projects: { orderBy: unknown };
      };
    };

    expect(args.include.skills.orderBy).toEqual({ sortOrder: 'asc' });
    expect(args.include.experiences.orderBy).toEqual({ sortOrder: 'asc' });
    expect(args.include.experiences.include.achievements.orderBy).toEqual({
      sortOrder: 'asc',
    });
    expect(args.include.projects.orderBy).toEqual({ sortOrder: 'asc' });
    expect(args.include.professionalLinks.orderBy).toEqual([
      { label: 'asc' },
      { url: 'asc' },
    ]);
  });
});
