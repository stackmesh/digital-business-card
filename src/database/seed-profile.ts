import { CANONICAL_PROFILE_KEY } from './canonical-profile.js';
import type { PrismaClient } from '../generated/prisma/client.js';

const TEXT_MAX_LENGTH = 20_000;

export class SeedDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeedDataError';
  }
}

export type SeedDataOrigin =
  'SEED_DATA_PATH' | 'profile.local.json' | 'profile.example.json';

export type SeedLink = {
  label: string;
  url: string;
};

export type SeedSkill = {
  name: string;
  category: string;
};

export type SeedAchievement = {
  description: string;
};

export type SeedExperience = {
  company: string;
  position: string;
  startDate: string;
  endDate: string | null;
  description: string;
  achievements: SeedAchievement[];
};

export type SeedProject = {
  name: string;
  description: string;
  url: string;
  repositoryUrl: string | null;
};

export type SeedDocument = {
  kind: 'example-template' | 'supplied-profile';
  profile: {
    name: string;
    description: string;
    links: SeedLink[];
    skills: SeedSkill[];
    experience: SeedExperience[];
    projects: SeedProject[];
  };
};

export type SeedCounts = {
  links: number;
  skills: number;
  experiences: number;
  achievements: number;
  projects: number;
};

export type SeedResult = {
  profileId: string;
  replacedExistingProfile: boolean;
  counts: SeedCounts;
};

/**
 * The seed file is the source of truth for the canonical card.
 * Each run upserts that profile and rewrites its links, skills, experience,
 * achievements, and projects inside one transaction. Rows that are no longer
 * in the file are removed. Repeating the same file does not add records.
 * Child primary keys are recreated; the profile id stays on `singletonKey`.
 */
export async function seedCanonicalProfile(
  prisma: PrismaClient,
  document: SeedDocument,
): Promise<SeedResult> {
  const { profile } = document;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.profile.findUnique({
      where: { singletonKey: CANONICAL_PROFILE_KEY },
      select: { id: true },
    });

    const saved = await tx.profile.upsert({
      where: { singletonKey: CANONICAL_PROFILE_KEY },
      create: {
        singletonKey: CANONICAL_PROFILE_KEY,
        name: profile.name,
        description: profile.description,
      },
      update: {
        name: profile.name,
        description: profile.description,
      },
      select: { id: true },
    });

    const experiences = await tx.experience.findMany({
      where: { profileId: saved.id },
      select: { id: true },
    });
    await tx.achievement.deleteMany({
      where: { experienceId: { in: experiences.map((item) => item.id) } },
    });
    await tx.experience.deleteMany({ where: { profileId: saved.id } });
    await tx.professionalLink.deleteMany({ where: { profileId: saved.id } });
    await tx.skill.deleteMany({ where: { profileId: saved.id } });
    await tx.project.deleteMany({ where: { profileId: saved.id } });

    if (profile.links.length > 0) {
      await tx.professionalLink.createMany({
        data: profile.links.map((link) => ({
          profileId: saved.id,
          label: link.label,
          url: link.url,
        })),
      });
    }

    if (profile.skills.length > 0) {
      await tx.skill.createMany({
        data: profile.skills.map((skill, sortOrder) => ({
          profileId: saved.id,
          name: skill.name,
          category: skill.category,
          sortOrder,
        })),
      });
    }

    for (const [sortOrder, experience] of profile.experience.entries()) {
      await tx.experience.create({
        data: {
          profileId: saved.id,
          company: experience.company,
          position: experience.position,
          startDate: calendarDate(experience.startDate),
          endDate:
            experience.endDate === null
              ? null
              : calendarDate(experience.endDate),
          description: experience.description,
          sortOrder,
          achievements: {
            create: experience.achievements.map((achievement, index) => ({
              description: achievement.description,
              sortOrder: index,
            })),
          },
        },
      });
    }

    if (profile.projects.length > 0) {
      await tx.project.createMany({
        data: profile.projects.map((project, sortOrder) => ({
          profileId: saved.id,
          name: project.name,
          description: project.description,
          url: project.url,
          repositoryUrl: project.repositoryUrl,
          sortOrder,
        })),
      });
    }

    return {
      profileId: saved.id,
      replacedExistingProfile: existing !== null,
      counts: {
        links: profile.links.length,
        skills: profile.skills.length,
        experiences: profile.experience.length,
        achievements: profile.experience.reduce(
          (total, experience) => total + experience.achievements.length,
          0,
        ),
        projects: profile.projects.length,
      },
    };
  });
}

export function selectSeedDataFile(input: {
  configuredPath: string | undefined;
  localFileExists: boolean;
  localPath: string;
  examplePath: string;
}): { filePath: string; origin: SeedDataOrigin } {
  const configured = input.configuredPath?.trim();
  if (configured) {
    return { filePath: configured, origin: 'SEED_DATA_PATH' };
  }
  if (input.localFileExists) {
    return { filePath: input.localPath, origin: 'profile.local.json' };
  }
  return { filePath: input.examplePath, origin: 'profile.example.json' };
}

export function placeholderWarning(input: {
  origin: SeedDataOrigin;
  kind: SeedDocument['kind'];
  filePath: string;
}): string | null {
  if (
    input.origin !== 'profile.example.json' &&
    input.kind !== 'example-template'
  ) {
    return null;
  }

  return [
    'This seed file is an example template, not a real profile.',
    `Source: ${input.filePath}`,
    'Replace all of the following before using the card as personal information:',
    '- profile name and description',
    '- professional links (label, url)',
    '- skills (name, category)',
    '- experience (company, position, startDate, endDate, description)',
    '- achievements (description)',
    '- projects (name, description, url, repositoryUrl)',
    'Write the real profile to prisma/seed-data/profile.local.json, or set SEED_DATA_PATH.',
    'Set "kind" to "supplied-profile".',
    'Display order is the array order in that file.',
  ].join('\n');
}

export function parseSeedDocument(value: unknown): SeedDocument {
  if (!isRecord(value)) {
    throw new SeedDataError('Seed data must be a JSON object.');
  }

  const kind = value.kind;
  if (kind !== 'example-template' && kind !== 'supplied-profile') {
    throw new SeedDataError(
      'kind must be "example-template" or "supplied-profile".',
    );
  }

  if (!isRecord(value.profile)) {
    throw new SeedDataError('profile must be an object.');
  }

  const profile = value.profile;
  const links = requireArray(profile, 'links', 'profile.links').map(
    (item, index) => parseLink(item, `profile.links[${index}]`),
  );
  const skills = requireArray(profile, 'skills', 'profile.skills').map(
    (item, index) => parseSkill(item, `profile.skills[${index}]`),
  );
  const experience = requireArray(
    profile,
    'experience',
    'profile.experience',
  ).map((item, index) => parseExperience(item, `profile.experience[${index}]`));
  const projects = requireArray(profile, 'projects', 'profile.projects').map(
    (item, index) => parseProject(item, `profile.projects[${index}]`),
  );

  requireUnique(
    links.map((link) => link.label),
    'link label',
  );
  requireUnique(
    links.map((link) => link.url),
    'link url',
  );
  requireUnique(
    skills.map((skill) => skill.name),
    'skill name',
  );
  requireUnique(
    experience.map(
      (item) => `${item.company}\0${item.position}\0${item.startDate}`,
    ),
    'experience company, position, and start date',
  );
  requireUnique(
    projects.map((project) => project.name),
    'project name',
  );
  requireUnique(
    projects.map((project) => project.url),
    'project url',
  );

  return {
    kind,
    profile: {
      name: requireString(profile, 'name', 'profile.name', 200),
      description: requireString(
        profile,
        'description',
        'profile.description',
        TEXT_MAX_LENGTH,
      ),
      links,
      skills,
      experience,
      projects,
    },
  };
}

function parseLink(value: unknown, path: string): SeedLink {
  const record = requireRecord(value, path);
  const url = requireString(record, 'url', `${path}.url`, 2048);
  return {
    label: requireString(record, 'label', `${path}.label`, 100),
    url: requireHttpUrl(url, `${path}.url`),
  };
}

function parseSkill(value: unknown, path: string): SeedSkill {
  const record = requireRecord(value, path);
  return {
    name: requireString(record, 'name', `${path}.name`, 100),
    category: requireString(record, 'category', `${path}.category`, 100),
  };
}

function parseExperience(value: unknown, path: string): SeedExperience {
  const record = requireRecord(value, path);
  const startDate = requireCalendarDate(
    requireString(record, 'startDate', `${path}.startDate`, 10),
    `${path}.startDate`,
  );
  const endDateValue = requireNullableString(
    record,
    'endDate',
    `${path}.endDate`,
    10,
  );
  const endDate =
    endDateValue === null
      ? null
      : requireCalendarDate(endDateValue, `${path}.endDate`);
  if (endDate !== null && endDate < startDate) {
    throw new SeedDataError(`${path}.endDate must be on or after startDate.`);
  }

  return {
    company: requireString(record, 'company', `${path}.company`, 200),
    position: requireString(record, 'position', `${path}.position`, 200),
    startDate,
    endDate,
    description: requireString(
      record,
      'description',
      `${path}.description`,
      TEXT_MAX_LENGTH,
    ),
    achievements: requireArray(
      record,
      'achievements',
      `${path}.achievements`,
    ).map((item, index) =>
      parseAchievement(item, `${path}.achievements[${index}]`),
    ),
  };
}

function parseAchievement(value: unknown, path: string): SeedAchievement {
  const record = requireRecord(value, path);
  return {
    description: requireString(
      record,
      'description',
      `${path}.description`,
      TEXT_MAX_LENGTH,
    ),
  };
}

function parseProject(value: unknown, path: string): SeedProject {
  const record = requireRecord(value, path);
  const url = requireString(record, 'url', `${path}.url`, 2048);
  const repositoryUrl = requireNullableString(
    record,
    'repositoryUrl',
    `${path}.repositoryUrl`,
    2048,
  );
  return {
    name: requireString(record, 'name', `${path}.name`, 200),
    description: requireString(
      record,
      'description',
      `${path}.description`,
      TEXT_MAX_LENGTH,
    ),
    url: requireHttpUrl(url, `${path}.url`),
    repositoryUrl:
      repositoryUrl === null
        ? null
        : requireHttpUrl(repositoryUrl, `${path}.repositoryUrl`),
  };
}

function calendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new SeedDataError(`Expected YYYY-MM-DD, received ${value}.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

function requireCalendarDate(value: string, path: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new SeedDataError(`${path} must be a YYYY-MM-DD date.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new SeedDataError(`${path} must be a real calendar date.`);
  }
  return value;
}

function requireHttpUrl(value: string, path: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SeedDataError(`${path} must be an absolute http(s) URL.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SeedDataError(`${path} must use http or https.`);
  }
  return value;
}

function requireUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new SeedDataError(`Duplicate ${label}: ${value}.`);
    }
    seen.add(value);
  }
}

function requireArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new SeedDataError(`${path} must be an array.`);
  }
  return value;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new SeedDataError(`${path} must be an object.`);
  }
  return value;
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  maxLength: number,
): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new SeedDataError(`${path} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new SeedDataError(`${path} must not be empty.`);
  }
  if (trimmed.length > maxLength) {
    throw new SeedDataError(`${path} must be at most ${maxLength} characters.`);
  }
  return trimmed;
}

function requireNullableString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  maxLength: number,
): string | null {
  if (!(key in record)) {
    throw new SeedDataError(`${path} is required.`);
  }
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new SeedDataError(`${path} must be a string or null.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new SeedDataError(`${path} must not be empty.`);
  }
  if (trimmed.length > maxLength) {
    throw new SeedDataError(`${path} must be at most ${maxLength} characters.`);
  }
  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
