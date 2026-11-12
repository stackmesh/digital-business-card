import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { CANONICAL_PROFILE_KEY } from '../src/database/canonical-profile.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { ProfileService } from '../src/profile/profile.service.js';
import {
  parseSeedDocument,
  seedCanonicalProfile,
} from '../src/database/seed-profile.js';
import { createApplication } from './support/create-application.js';
import {
  applyMigrations,
  clearCard,
  createLoggingPrisma,
  resolveTestDatabaseUrl,
} from './support/test-database.js';

const profileQuery = readFileSync(
  join(import.meta.dirname, '../examples/profile.graphql'),
  'utf8',
);

const databaseUrl = resolveTestDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.DATABASE_URL = databaseUrl;

describe('business card against PostgreSQL', () => {
  let prisma: PrismaClient;
  let queries: string[];
  let app: INestApplication;

  beforeAll(async () => {
    applyMigrations(databaseUrl);
    const logging = createLoggingPrisma(databaseUrl);
    prisma = logging.prisma;
    queries = logging.queries;
    app = await createApplication(prisma);
  });

  beforeEach(async () => {
    await clearCard(prisma);
    queries.length = 0;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns null from the profile service and query when the card is absent', async () => {
    const service = app.get(ProfileService);

    await expect(service.getProfile()).resolves.toBeNull();

    const response = await post(app, profileQuery);

    expect(response.status).toBe(200);
    expect(response.body.data.profile).toBeNull();
  });

  it('returns the nested card in display order with a nullable end date', async () => {
    await seedOrderedCard(prisma);
    const service = app.get(ProfileService);
    const card = await service.getProfile();

    expect(card).toMatchObject({
      name: 'Example Person',
      links: [
        { label: 'Repository', url: 'https://example.com/repository' },
        { label: 'Site', url: 'https://example.com/site' },
      ],
      skills: [
        { name: 'TypeScript', category: 'Language' },
        { name: 'GraphQL', category: 'API' },
      ],
      experience: [
        {
          company: 'Example Company',
          position: 'Engineer',
          endDate: new Date('2001-12-31T00:00:00.000Z'),
          achievements: [
            { description: 'First achievement' },
            { description: 'Second achievement' },
          ],
        },
        {
          company: 'Second Example Company',
          position: 'Consultant',
          endDate: null,
          achievements: [],
        },
      ],
      projects: [
        { name: 'Card', repositoryUrl: 'https://example.com/card.git' },
        { name: 'Later project', repositoryUrl: null },
      ],
    });

    const response = await post(app, profileQuery);

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.profile.experience).toEqual([
      expect.objectContaining({
        company: 'Example Company',
        startDate: '2000-01-01',
        endDate: '2001-12-31',
        achievements: [
          { description: 'First achievement' },
          { description: 'Second achievement' },
        ],
      }),
      expect.objectContaining({
        company: 'Second Example Company',
        startDate: '2002-01-01',
        endDate: null,
        achievements: [],
      }),
    ]);
    expect(
      response.body.data.profile.skills.map(
        (skill: { name: string }) => skill.name,
      ),
    ).toEqual(['TypeScript', 'GraphQL']);
    expect(
      response.body.data.profile.projects.map(
        (project: { name: string }) => project.name,
      ),
    ).toEqual(['Card', 'Later project']);
  });

  it('serves standalone skills, experience, and projects queries', async () => {
    await seedOrderedCard(prisma);

    const response = await post(
      app,
      `query Collections {
        skills { name category }
        experience { company endDate achievements { description } }
        projects { name url repositoryUrl }
      }`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.skills).toEqual([
      { name: 'TypeScript', category: 'Language' },
      { name: 'GraphQL', category: 'API' },
    ]);
    expect(response.body.data.experience).toEqual([
      {
        company: 'Example Company',
        endDate: '2001-12-31',
        achievements: [
          { description: 'First achievement' },
          { description: 'Second achievement' },
        ],
      },
      {
        company: 'Second Example Company',
        endDate: null,
        achievements: [],
      },
    ]);
    expect(response.body.data.projects).toEqual([
      {
        name: 'Card',
        url: 'https://example.com/card',
        repositoryUrl: 'https://example.com/card.git',
      },
      {
        name: 'Later project',
        url: 'https://example.com/later',
        repositoryUrl: null,
      },
    ]);
  });

  it('returns empty arrays when the card has no related rows', async () => {
    await prisma.profile.create({
      data: {
        singletonKey: CANONICAL_PROFILE_KEY,
        name: 'Example Person',
        description: 'A card with no collections.',
      },
    });

    const response = await post(app, profileQuery);

    expect(response.status).toBe(200);
    expect(response.body.data.profile).toMatchObject({
      name: 'Example Person',
      links: [],
      skills: [],
      experience: [],
      projects: [],
    });
  });

  it('rejects an unknown GraphQL field', async () => {
    const response = await post(app, 'query { profile { missingField } }');

    expect(response.body.data).toBeUndefined();
    expect(response.body.errors[0].message).toMatch(/missingField/);
  });

  it('keeps the nested profile query count stable as child rows grow', async () => {
    await seedSizedCard(prisma, 1, 1);
    queries.length = 0;
    const small = await post(app, profileQuery);
    const smallCount = queries.length;

    await clearCard(prisma);
    await seedSizedCard(prisma, 6, 5);
    queries.length = 0;
    const large = await post(app, profileQuery);
    const largeCount = queries.length;

    expect(small.status).toBe(200);
    expect(large.status).toBe(200);
    expect(large.body.data.profile.experience).toHaveLength(6);
    expect(smallCount).toBeGreaterThan(0);
    expect(largeCount).toBe(smallCount);
  });

  it('replaces the canonical card without adding rows on a second seed', async () => {
    const document = parseSeedDocument(
      JSON.parse(
        readFileSync(
          join(import.meta.dirname, '../prisma/seed-data/profile.example.json'),
          'utf8',
        ),
      ) as unknown,
    );

    const first = await seedCanonicalProfile(prisma, document);
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { singletonKey: CANONICAL_PROFILE_KEY },
    });
    await prisma.skill.create({
      data: {
        profileId: profile.id,
        name: 'Unexpected skill',
        category: 'Extra',
        sortOrder: 50,
      },
    });

    const second = await seedCanonicalProfile(prisma, document);
    const counts = await cardCounts(prisma);

    expect(second.profileId).toBe(first.profileId);
    expect(second.replacedExistingProfile).toBe(true);
    expect(counts).toEqual({
      profiles: 1,
      links: document.profile.links.length,
      skills: document.profile.skills.length,
      experiences: document.profile.experience.length,
      achievements: document.profile.experience.reduce(
        (total, role) => total + role.achievements.length,
        0,
      ),
      projects: document.profile.projects.length,
    });
    expect(
      await prisma.skill.findFirst({ where: { name: 'Unexpected skill' } }),
    ).toBeNull();
  });
});

async function post(
  app: INestApplication,
  query: string,
): Promise<request.Response> {
  return request(app.getHttpServer() as Server)
    .post('/graphql')
    .set('Content-Type', 'application/json')
    .send({ query });
}

async function seedOrderedCard(prisma: PrismaClient): Promise<void> {
  await prisma.profile.create({
    data: {
      singletonKey: CANONICAL_PROFILE_KEY,
      name: 'Example Person',
      description: 'Fixture card for tests.',
      professionalLinks: {
        create: [
          { label: 'Site', url: 'https://example.com/site' },
          { label: 'Repository', url: 'https://example.com/repository' },
        ],
      },
      skills: {
        create: [
          { name: 'GraphQL', category: 'API', sortOrder: 1 },
          { name: 'TypeScript', category: 'Language', sortOrder: 0 },
        ],
      },
      experiences: {
        create: [
          {
            company: 'Second Example Company',
            position: 'Consultant',
            startDate: new Date('2002-01-01T00:00:00.000Z'),
            endDate: null,
            description: 'Current fixture role.',
            sortOrder: 1,
          },
          {
            company: 'Example Company',
            position: 'Engineer',
            startDate: new Date('2000-01-01T00:00:00.000Z'),
            endDate: new Date('2001-12-31T00:00:00.000Z'),
            description: 'Past fixture role.',
            sortOrder: 0,
            achievements: {
              create: [
                { description: 'Second achievement', sortOrder: 1 },
                { description: 'First achievement', sortOrder: 0 },
              ],
            },
          },
        ],
      },
      projects: {
        create: [
          {
            name: 'Later project',
            description: 'Second fixture project.',
            url: 'https://example.com/later',
            repositoryUrl: null,
            sortOrder: 1,
          },
          {
            name: 'Card',
            description: 'First fixture project.',
            url: 'https://example.com/card',
            repositoryUrl: 'https://example.com/card.git',
            sortOrder: 0,
          },
        ],
      },
    },
  });
}

async function seedSizedCard(
  prisma: PrismaClient,
  experienceCount: number,
  achievementsEach: number,
): Promise<void> {
  await prisma.profile.create({
    data: {
      singletonKey: CANONICAL_PROFILE_KEY,
      name: 'Example Person',
      description: 'Load fixture.',
      experiences: {
        create: Array.from({ length: experienceCount }, (_, index) => ({
          company: `Example Company ${index}`,
          position: 'Engineer',
          startDate: new Date(Date.UTC(2000, 0, index + 1)),
          endDate: null,
          description: 'Fixture role.',
          sortOrder: index,
          achievements: {
            create: Array.from(
              { length: achievementsEach },
              (_, achievement) => ({
                description: `Achievement ${index}-${achievement}`,
                sortOrder: achievement,
              }),
            ),
          },
        })),
      },
    },
  });
}

async function cardCounts(prisma: PrismaClient): Promise<{
  profiles: number;
  links: number;
  skills: number;
  experiences: number;
  achievements: number;
  projects: number;
}> {
  const [profiles, links, skills, experiences, achievements, projects] =
    await Promise.all([
      prisma.profile.count(),
      prisma.professionalLink.count(),
      prisma.skill.count(),
      prisma.experience.count(),
      prisma.achievement.count(),
      prisma.project.count(),
    ]);

  return { profiles, links, skills, experiences, achievements, projects };
}
