import { readFileSync } from 'node:fs';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

const profileQuery = readFileSync(
  new URL('../examples/profile.graphql', import.meta.url),
  'utf8',
);

describe('Profile GraphQL (e2e)', () => {
  const unexpectedQuery = (): never => {
    throw new Error('Nested fields must not issue their own queries');
  };

  const profileFindUnique = vi.fn();
  const skillFindMany = vi.fn(unexpectedQuery);
  const experienceFindMany = vi.fn(unexpectedQuery);
  const projectFindMany = vi.fn(unexpectedQuery);

  let app: INestApplication<App>;

  beforeEach(async () => {
    profileFindUnique.mockReset();
    skillFindMany.mockReset();
    experienceFindMany.mockReset();
    projectFindMany.mockReset();
    skillFindMany.mockImplementation(unexpectedQuery);
    experienceFindMany.mockImplementation(unexpectedQuery);
    projectFindMany.mockImplementation(unexpectedQuery);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        profile: { findUnique: profileFindUnique },
        skill: { findMany: skillFindMany },
        experience: { findMany: experienceFindMany },
        project: { findMany: projectFindMany },
        $disconnect: async () => undefined,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers the nested profile query from one profile read', async () => {
    profileFindUnique.mockResolvedValue({
      name: 'Example',
      description: 'A digital card',
      professionalLinks: [
        { label: 'Site', url: 'https://example.test' },
        { label: 'Repository', url: 'https://example.test/repo' },
      ],
      skills: [
        { name: 'TypeScript', category: 'Language' },
        { name: 'GraphQL', category: 'API' },
      ],
      experiences: [
        {
          company: 'Northwind',
          position: 'Engineer',
          startDate: new Date('2018-01-01T00:00:00.000Z'),
          endDate: new Date('2020-06-30T00:00:00.000Z'),
          description: 'Platform work',
          achievements: [
            { description: 'Launched the API' },
            { description: 'Cut query fan-out' },
          ],
        },
        {
          company: 'Contoso',
          position: 'Consultant',
          startDate: new Date('2021-02-01T00:00:00.000Z'),
          endDate: null,
          description: 'Current role',
          achievements: [],
        },
      ],
      projects: [
        {
          name: 'Card',
          description: 'This service',
          url: 'https://example.test/card',
          repositoryUrl: null,
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: profileQuery })
      .expect(200);

    expect(response.body).toEqual({
      data: {
        profile: {
          name: 'Example',
          description: 'A digital card',
          links: [
            { label: 'Site', url: 'https://example.test' },
            { label: 'Repository', url: 'https://example.test/repo' },
          ],
          skills: [
            { name: 'TypeScript', category: 'Language' },
            { name: 'GraphQL', category: 'API' },
          ],
          experience: [
            {
              company: 'Northwind',
              position: 'Engineer',
              startDate: '2018-01-01',
              endDate: '2020-06-30',
              achievements: [
                { description: 'Launched the API' },
                { description: 'Cut query fan-out' },
              ],
            },
            {
              company: 'Contoso',
              position: 'Consultant',
              startDate: '2021-02-01',
              endDate: null,
              achievements: [],
            },
          ],
          projects: [{ name: 'Card', url: 'https://example.test/card' }],
        },
      },
    });
    expect(profileFindUnique).toHaveBeenCalledTimes(1);
    expect(skillFindMany).not.toHaveBeenCalled();
    expect(experienceFindMany).not.toHaveBeenCalled();
    expect(projectFindMany).not.toHaveBeenCalled();
  });

  it('returns null when the card has not been created', async () => {
    profileFindUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: profileQuery })
      .expect(200);

    expect(response.body).toEqual({ data: { profile: null } });
  });

  it('serves standalone collection queries', async () => {
    skillFindMany.mockResolvedValue([{ name: 'GraphQL', category: 'API' }]);
    experienceFindMany.mockResolvedValue([]);
    projectFindMany.mockResolvedValue([
      {
        name: 'Card',
        description: 'This service',
        url: 'https://example.test/card',
        repositoryUrl: null,
      },
    ]);

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query Collections {
            skills { name category }
            experience { company achievements { description } }
            projects { name url }
          }
        `,
      })
      .expect(200);

    expect(response.body).toEqual({
      data: {
        skills: [{ name: 'GraphQL', category: 'API' }],
        experience: [],
        projects: [{ name: 'Card', url: 'https://example.test/card' }],
      },
    });
    expect(skillFindMany).toHaveBeenCalledTimes(1);
    expect(experienceFindMany).toHaveBeenCalledTimes(1);
    expect(projectFindMany).toHaveBeenCalledTimes(1);
    expect(profileFindUnique).not.toHaveBeenCalled();
  });
});
