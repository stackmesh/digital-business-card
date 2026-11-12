import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANONICAL_PROFILE_KEY } from './canonical-profile.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { runSeed } from './seed-cli.js';
import {
  SeedDataError,
  parseSeedDocument,
  placeholderWarning,
  seedCanonicalProfile,
  selectSeedDataFile,
  type SeedDocument,
} from './seed-profile.js';

const examplePath = join(
  import.meta.dirname,
  '../../prisma/seed-data/profile.example.json',
);

describe('seed data selection', () => {
  it('prefers SEED_DATA_PATH, then the local file, then the example template', () => {
    expect(
      selectSeedDataFile({
        configuredPath: '/tmp/card.json',
        localFileExists: true,
        localPath: '/data/profile.local.json',
        examplePath: '/data/profile.example.json',
      }),
    ).toEqual({ filePath: '/tmp/card.json', origin: 'SEED_DATA_PATH' });

    expect(
      selectSeedDataFile({
        configuredPath: '  ',
        localFileExists: true,
        localPath: '/data/profile.local.json',
        examplePath: '/data/profile.example.json',
      }),
    ).toEqual({
      filePath: '/data/profile.local.json',
      origin: 'profile.local.json',
    });

    expect(
      selectSeedDataFile({
        configuredPath: undefined,
        localFileExists: false,
        localPath: '/data/profile.local.json',
        examplePath: '/data/profile.example.json',
      }),
    ).toEqual({
      filePath: '/data/profile.example.json',
      origin: 'profile.example.json',
    });
  });

  it('warns for the example template and stays quiet for supplied data', () => {
    const warning = placeholderWarning({
      origin: 'profile.example.json',
      kind: 'example-template',
      filePath: examplePath,
    });
    expect(warning).toContain('not a real profile');
    expect(warning).toContain('profile name and description');
    expect(warning).toContain('achievements (description)');
    expect(warning).toContain('profile.local.json');

    expect(
      placeholderWarning({
        origin: 'profile.local.json',
        kind: 'supplied-profile',
        filePath: '/data/profile.local.json',
      }),
    ).toBeNull();
  });
});

describe('parseSeedDocument', () => {
  const example = parseSeedDocument(
    JSON.parse(readFileSync(examplePath, 'utf8')) as unknown,
  );

  it('loads the committed example as placeholders', () => {
    expect(example.kind).toBe('example-template');
    expect(example.profile.name).toBe('Example Person');
    expect(example.profile.links.length).toBeGreaterThan(0);
    expect(example.profile.skills.length).toBeGreaterThan(0);
    expect(example.profile.experience.length).toBeGreaterThan(0);
    expect(
      example.profile.experience.some((role) => role.achievements.length > 0),
    ).toBe(true);
    expect(example.profile.projects.length).toBeGreaterThan(0);
    expect(JSON.stringify(example)).not.toMatch(/linkedin|github\.com/i);
  });

  it('rejects an end date before the start date', () => {
    const document = structuredClone(example);
    const role = document.profile.experience[0];
    if (!role) {
      throw new Error('example experience is missing');
    }
    role.startDate = '2001-01-01';
    role.endDate = '2000-01-01';

    expect(() => parseSeedDocument(document)).toThrow(SeedDataError);
    expect(() => parseSeedDocument(document)).toThrow(/on or after/);
  });

  it('rejects duplicate skill names', () => {
    const document = structuredClone(example);
    const skill = document.profile.skills[0];
    if (!skill) {
      throw new Error('example skill is missing');
    }
    document.profile.skills.push({ ...skill });

    expect(() => parseSeedDocument(document)).toThrow(/Duplicate skill name/);
  });
});

describe('seedCanonicalProfile', () => {
  it('rewrites the canonical card without increasing counts on a second run', async () => {
    const document = parseSeedDocument(
      JSON.parse(readFileSync(examplePath, 'utf8')) as unknown,
    );
    const database = memoryDatabase();

    const first = await seedCanonicalProfile(database.client, document);
    const afterFirst = database.counts();
    database.tables.skill.push({
      id: 'extra-skill',
      profileId: first.profileId,
      name: 'Unexpected skill',
      category: 'Extra',
      sortOrder: 50,
    });

    const second = await seedCanonicalProfile(database.client, document);

    expect(first.replacedExistingProfile).toBe(false);
    expect(second.replacedExistingProfile).toBe(true);
    expect(second.profileId).toBe(first.profileId);
    expect(database.counts()).toEqual(afterFirst);
    expect(database.counts()).toEqual({
      profile: 1,
      professionalLink: document.profile.links.length,
      skill: document.profile.skills.length,
      experience: document.profile.experience.length,
      achievement: document.profile.experience.reduce(
        (total, role) => total + role.achievements.length,
        0,
      ),
      project: document.profile.projects.length,
    });
    expect(database.tables.profile[0]).toMatchObject({
      singletonKey: CANONICAL_PROFILE_KEY,
      name: 'Example Person',
    });
    expect(database.tables.skill.map((skill) => skill.sortOrder)).toEqual(
      document.profile.skills.map((_, index) => index),
    );
    expect(database.tables.experience.map((role) => role.sortOrder)).toEqual(
      document.profile.experience.map((_, index) => index),
    );
    expect(
      database.tables.skill.some((skill) => skill.id === 'extra-skill'),
    ).toBe(false);
  });

  it('drops a skill that was removed from the seed file', async () => {
    const document = parseSeedDocument(
      JSON.parse(readFileSync(examplePath, 'utf8')) as unknown,
    );
    const database = memoryDatabase();
    await seedCanonicalProfile(database.client, document);

    const reduced: SeedDocument = {
      ...document,
      profile: {
        ...document.profile,
        skills: document.profile.skills.slice(0, 1),
      },
    };
    await seedCanonicalProfile(database.client, reduced);

    expect(database.tables.skill).toHaveLength(1);
    expect(database.tables.skill[0]?.name).toBe(
      reduced.profile.skills[0]?.name,
    );
  });
});

describe('seed command', () => {
  it('returns a nonzero code when the seed file is not valid JSON', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'seed-invalid-'));
    const filePath = join(directory, 'bad.json');
    writeFileSync(filePath, '{');
    const errors: unknown[][] = [];
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => {
        errors.push(args);
      });

    try {
      const code = await runSeed({
        ...process.env,
        SEED_DATA_PATH: filePath,
      });

      expect(code).toBe(1);
      expect(errors.flat().join(' ')).toContain('not valid JSON');
    } finally {
      errorSpy.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('returns a nonzero code when DATABASE_URL is missing', async () => {
    const errors: unknown[][] = [];
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => {
        errors.push(args);
      });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const code = await runSeed({
        ...process.env,
        DATABASE_URL: ' ',
        SEED_DATA_PATH: '',
      });

      expect(code).toBe(1);
      expect(errors.flat().join(' ')).toContain('DATABASE_URL is required');
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});

type MemoryRow = Record<string, unknown> & { id: string };

function memoryDatabase(): {
  client: PrismaClient;
  tables: Record<string, MemoryRow[]>;
  counts: () => Record<string, number>;
} {
  const tables: Record<string, MemoryRow[]> = {
    profile: [],
    professionalLink: [],
    skill: [],
    experience: [],
    achievement: [],
    project: [],
  };
  let nextId = 0;
  const id = (): string => `row-${++nextId}`;

  const transaction = {
    profile: {
      findUnique: async ({
        where,
      }: {
        where: { singletonKey: string };
      }): Promise<{ id: string } | null> => {
        const row = tables.profile.find(
          (item) => item.singletonKey === where.singletonKey,
        );
        return row ? { id: row.id } : null;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { singletonKey: string };
        create: MemoryRow;
        update: MemoryRow;
      }): Promise<{ id: string }> => {
        const existing = tables.profile.find(
          (item) => item.singletonKey === where.singletonKey,
        );
        if (!existing) {
          const row = { ...create, id: id() };
          tables.profile.push(row);
          return { id: row.id };
        }
        Object.assign(existing, update);
        return { id: existing.id };
      },
    },
    experience: {
      findMany: async ({
        where,
      }: {
        where: { profileId: string };
      }): Promise<{ id: string }[]> =>
        tables.experience
          .filter((item) => item.profileId === where.profileId)
          .map((item) => ({ id: item.id })),
      deleteMany: async ({
        where,
      }: {
        where: { profileId: string };
      }): Promise<{ count: number }> => {
        const removed = tables.experience.filter(
          (item) => item.profileId === where.profileId,
        );
        tables.experience = tables.experience.filter(
          (item) => item.profileId !== where.profileId,
        );
        return { count: removed.length };
      },
      create: async ({
        data,
      }: {
        data: MemoryRow & {
          achievements: { create: MemoryRow[] };
        };
      }): Promise<{ id: string }> => {
        const { achievements, ...experience } = data;
        const experienceId = id();
        tables.experience.push({ ...experience, id: experienceId });
        for (const achievement of achievements.create) {
          tables.achievement.push({
            ...achievement,
            id: id(),
            experienceId,
          });
        }
        return { id: experienceId };
      },
    },
    achievement: {
      deleteMany: async ({
        where,
      }: {
        where: { experienceId: { in: string[] } };
      }): Promise<{ count: number }> => {
        const ids = new Set(where.experienceId.in);
        const before = tables.achievement.length;
        tables.achievement = tables.achievement.filter(
          (item) => !ids.has(String(item.experienceId)),
        );
        return { count: before - tables.achievement.length };
      },
    },
    professionalLink: collection('professionalLink'),
    skill: collection('skill'),
    project: collection('project'),
  };

  function collection(table: string) {
    return {
      deleteMany: async ({
        where,
      }: {
        where: { profileId: string };
      }): Promise<{ count: number }> => {
        const rows = tables[table] ?? [];
        const before = rows.length;
        tables[table] = rows.filter(
          (item) => item.profileId !== where.profileId,
        );
        return { count: before - (tables[table]?.length ?? 0) };
      },
      createMany: async ({
        data,
      }: {
        data: MemoryRow[];
      }): Promise<{ count: number }> => {
        for (const item of data) {
          tables[table]?.push({ ...item, id: id() });
        }
        return { count: data.length };
      },
    };
  }

  const client = {
    $transaction: async <T>(
      callback: (tx: typeof transaction) => Promise<T>,
    ): Promise<T> => callback(transaction),
  };

  return {
    client: client as unknown as PrismaClient,
    tables,
    counts: () =>
      Object.fromEntries(
        Object.entries(tables).map(([table, rows]) => [table, rows.length]),
      ),
  };
}
