import { Injectable } from '@nestjs/common';
import { CANONICAL_PROFILE_KEY } from '../database/canonical-profile.js';
import { PrismaService } from '../database/prisma.service.js';
import type { ProfileModel } from './profile.model.js';
import { toProfileModel } from './profile.mapper.js';

const profileInclude = {
  professionalLinks: {
    orderBy: [{ label: 'asc' as const }, { url: 'asc' as const }],
  },
  skills: {
    orderBy: { sortOrder: 'asc' as const },
  },
  experiences: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      achievements: {
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
  projects: {
    orderBy: { sortOrder: 'asc' as const },
  },
};

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(): Promise<ProfileModel | null> {
    // Relations are loaded with the profile. Nested GraphQL fields read the
    // objects already returned here, so they do not query again.
    const profile = await this.prisma.profile.findUnique({
      where: { singletonKey: CANONICAL_PROFILE_KEY },
      include: profileInclude,
    });

    return profile === null ? null : toProfileModel(profile);
  }
}
