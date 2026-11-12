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

  // Prisma 7 connects on the first query. Migrations are applied with
  // `prisma migrate deploy`, so process startup does not require PostgreSQL.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
