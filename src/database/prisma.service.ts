import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { EnvironmentVariables } from '../config/env.validation.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    const adapter = new PrismaPg({
      connectionString: configService.getOrThrow('DATABASE_URL'),
    });
    super({ adapter });
  }

  // No domain models exist yet, so bootstrap does not open a connection.
  // Prisma Client connects on the first query.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
